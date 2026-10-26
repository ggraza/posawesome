import frappe
import json
from frappe import _
from frappe.utils import nowdate, flt, cstr, getdate, add_days
import requests
from frappe import publish_realtime

@frappe.whitelist()
def create_kitchen_tickets(doc, method):

    if not frappe.db.exists("Sales Invoice", doc.name):
        frappe.enqueue(
            "posawesome.posawesome.api.kds.create_kitchen_tickets",
            doc=doc,
            enqueue_after_commit=True
        )
        return

    queue_name = None

    # Create Queue Ticket for dine-in orders
    if doc.posa_service_zone:
        queue_name = create_queue_ticket(doc)

    if not doc.posa_kot_on_each_save:
        return

    # ------------------------------------------------------------------
    # Load Kitchen Production Units
    # ------------------------------------------------------------------

    production_units = frappe.get_all(
        "Kitchen Production Unit",
        fields=["name", "pos_profile", "apply_on"]
    )

    item_code_to_unit = {}
    item_group_to_unit = {}

    for unit in production_units:

        # --------------------------------------------------------------
        # Validation
        # --------------------------------------------------------------

        if not unit.apply_on:
            frappe.throw(
                _("Please select Apply On in Kitchen Production Unit <b>{0}</b>").format(unit.name)
            )

        if not unit.pos_profile:
            frappe.throw(
                _("POS Profile is missing in Kitchen Production Unit <b>{0}</b>").format(unit.name)
            )

        item_details = frappe.get_all(
            "Kitchen Item Detail",
            filters={"parent": unit.name},
            fields=["item_code"]
        )

        group_details = frappe.get_all(
            "Kitchen Item Groups",
            filters={"parent": unit.name},
            fields=["item_group"]
        )

        # --------------------------------------------------------------
        # Validation according to Apply On
        # --------------------------------------------------------------

        if unit.apply_on == "Item Code":

            if not item_details:
                frappe.throw(
                    _("Please add Item Codes in Kitchen Production Unit <b>{0}</b>").format(unit.name)
                )

        elif unit.apply_on == "Item Group":

            if not group_details:
                frappe.throw(
                    _("Please add Item Groups in Kitchen Production Unit <b>{0}</b>").format(unit.name)
                )

        elif unit.apply_on == "Both":

            if not item_details and not group_details:
                frappe.throw(
                    _("Please configure at least one Item Code or Item Group in Kitchen Production Unit <b>{0}</b>").format(unit.name)
                )

        # --------------------------------------------------------------
        # Item Code Mapping
        # --------------------------------------------------------------

        if unit.apply_on in ("Item Code", "Both"):

            for row in item_details:

                if not row.item_code:
                    continue

                if row.item_code in item_code_to_unit:
                    frappe.throw(
                        _("Item Code <b>{0}</b> is already assigned to Kitchen Production Unit <b>{1}</b>")
                        .format(row.item_code, item_code_to_unit[row.item_code])
                    )

                item_code_to_unit[row.item_code] = unit.name

        # --------------------------------------------------------------
        # Item Group Mapping
        # --------------------------------------------------------------

        if unit.apply_on in ("Item Group", "Both"):

            for row in group_details:

                if not row.item_group:
                    continue

                # Ignore duplicate mapping for same unit
                if (
                    row.item_group in item_group_to_unit
                    and item_group_to_unit[row.item_group] != unit.name
                ):
                    frappe.throw(
                        _("Item Group <b>{0}</b> is already assigned to Kitchen Production Unit <b>{1}</b>")
                        .format(row.item_group, item_group_to_unit[row.item_group])
                    )

                item_group_to_unit[row.item_group] = unit.name

    # ------------------------------------------------------------------
    # calculate how much quantity has already been sent.
    # ------------------------------------------------------------------

    kot_qty_map = {}

    existing_kots = frappe.get_all(
        "Kitchen Ticket",
        filters={"sales_invoice": doc.name},
        fields=["name"]
    )

    for kot in existing_kots:
        items = frappe.get_all(
            "Kitchen Ticket Items",
            filters={"parent": kot.name},
            fields=["posa_row_id", "item_code", "qty"]
        )

        for d in items:
            key = d.posa_row_id or d.item_code
            kot_qty_map[key] = kot_qty_map.get(key, 0) + flt(d.qty)

    # ------------------------------------------------------------------
    # Group Sales Invoice Items
    # ------------------------------------------------------------------

    unit_items = {}

    for item in doc.items:

        key = item.posa_row_id or item.item_code

        already_created = flt(kot_qty_map.get(key, 0))
        remaining_qty = flt(item.qty) - already_created

        if remaining_qty <= 0:
            continue

        item_group = frappe.db.get_value(
            "Item",
            item.item_code,
            "item_group"
        )

        # Priority:
        # 1. Item Code
        # 2. Item Group

        unit_name = (
            item_code_to_unit.get(item.item_code)
            or item_group_to_unit.get(item_group)
        )

        if not unit_name:
            continue

        item.remaining_qty = remaining_qty
        unit_items.setdefault(unit_name, []).append(item)

    # ------------------------------------------------------------------
    # No KOT generated
    # ------------------------------------------------------------------

    if queue_name and not unit_items:

        queue = frappe.get_doc("Queue Ticket", queue_name)

        queue.status = "Ready"
        queue.time_ready = frappe.utils.nowtime()

        queue.save(ignore_permissions=True)

        refresh_los(queue.name)

        publish_realtime(
            event="queue_status_update",
            message={
                "queue": queue.name,
                "status": "Ready"
            },
            after_commit=True
        )

        return

    # ------------------------------------------------------------------
    # Create Kitchen Tickets
    # ------------------------------------------------------------------

    for unit_name, items in unit_items.items():

        kitchen_unit = frappe.get_doc("Kitchen Production Unit", unit_name)

        kt = frappe.new_doc("Kitchen Ticket")
        kt.sales_invoice = doc.name
        kt.company = doc.company
        kt.posting_date = doc.posting_date
        kt.pos_profile = kitchen_unit.pos_profile
        kt.kitchen_production_unit = kitchen_unit.name
        kt.time_created = frappe.utils.nowtime()

        for i in items:

            qty = i.remaining_qty

            kt.append("items", {
                "item_code": i.item_code,
                "item_name": i.item_name,
                "item_group": frappe.db.get_value("Item", i.item_code, "item_group"),
                "qty": qty,
                "rate": i.rate,
                "amount": qty * flt(i.rate),
                "uom": i.uom,
                "posa_notes": i.posa_notes,
                "posa_row_id": i.posa_row_id
            })

        kt.insert(ignore_permissions=True)
        kt.submit()

        refresh_kds(kt.name)

        if queue_name:
            add_kot_to_queue(queue_name, kt)

        publish_realtime(
            event="new_kitchen_ticket",
            message={
                "ticket": kt.name,
                "unit": kitchen_unit.name,
                "status": "New"
            },
            after_commit=True
        )

# ====================================================
# Queue Ticket Creation
# ====================================================

def create_queue_ticket(si):

    # Sales Invoice not yet inserted
    #if not frappe.db.exists("Sales Invoice", si.name):
    #    return None

    existing = frappe.db.get_value(
        "Queue Ticket",
        {"sales_invoice": si.name},
        "name"
    )

    if existing:
        return existing

    queue = frappe.get_doc({
        "doctype": "Queue Ticket",
        "sales_invoice": si.name,
        "service_zone": si.posa_service_zone,
        "company": si.company,
        "posting_date": si.posting_date,
        "pos_profile": si.pos_profile,
        "status": "New",
        "time_created": frappe.utils.nowtime()
    })

    queue.insert(ignore_permissions=True)

    refresh_los(queue.name)

    publish_realtime(
        event="new_queue_ticket",
        message={
            "queue": queue.name,
            "service_zone": si.posa_service_zone,
            "status": "New"
        },
        after_commit=True
    )

    publish_realtime(
        event="los_refresh",
        message={
            "queue": queue.name
        },
        after_commit=True
    )

    return queue.name


# ====================================================
# Attach KOT to Queue
# ====================================================

def add_kot_to_queue(queue_name, kot):

    queue = frappe.get_doc(
        "Queue Ticket",
        queue_name
    )

    exists = any(
        row.kitchen_ticket == kot.name
        for row in queue.items
    )

    if exists:
        return

    queue.append("items", {
        "kitchen_ticket": kot.name,
        "kitchen_production_unit": kot.kitchen_production_unit,
        "status": kot.status
    })

    queue.save(ignore_permissions=True)

    frappe.enqueue(
        method=refresh_los,
        queue_name=queue.name,
        enqueue_after_commit=True
    )


# ====================================================
# Update Queue Status
# ====================================================

def update_queue_status(kot, method=None):
    queue_name = frappe.db.get_value(
        "Queue Ticket",
        {"sales_invoice": kot.sales_invoice},
        "name"
    )

    if not queue_name:
        return

    queue = frappe.get_doc(
        "Queue Ticket",
        queue_name
    )

    statuses = []

    for row in queue.items:

        row.status = (
            frappe.db.get_value(
                "Kitchen Ticket",
                row.kitchen_ticket,
                "status"
            ) or "New"
        )

        statuses.append(row.status)

    if statuses and all(s == "Ready" for s in statuses):

        queue.status = "Ready"

        if not queue.time_ready:
            queue.time_ready = frappe.utils.nowtime()

    elif any(s in ["Preparing", "Ready"] for s in statuses):

        queue.status = "Preparing"

        if not queue.time_prepared:
            queue.time_prepared = frappe.utils.nowtime()

    else:
        queue.status = "New"

    queue.save(ignore_permissions=True)

    publish_realtime(
        event="queue_status_update",
        message={
            "queue": queue.name,
            "status": queue.status
        },
        after_commit=True
    )

# ====================================================
# Screan Refresh Helper Function
# ====================================================

def refresh_kds(ticket_name=None):
    publish_realtime(
        event="kds_refresh",
        message={"ticket": ticket_name},
        after_commit=True
    )


def refresh_los(queue_name=None):
    publish_realtime(
        event="los_refresh",
        message={"queue": queue_name},
        after_commit=True
    )

# ====================================================
# KDS APIs
# ====================================================

@frappe.whitelist()
def get_kitchen_tickets(status=None, unit=None):
    filters = {}
    if status:
        filters["status"] = status
    if unit:
        filters["kitchen_production_unit"] = unit

    tickets = frappe.get_all(
        "Kitchen Ticket",
        filters=filters,
        fields=["name", "sales_invoice", "kitchen_production_unit", "status", "time_created"]
    )
    return tickets


@frappe.whitelist()
def update_ticket_status(ticket_name, new_status):
    """Update Kitchen Ticket status and notify all KDS screens"""
    doc = frappe.get_doc("Kitchen Ticket", ticket_name)
    doc.status = new_status
    doc.save(ignore_permissions=True)
    update_queue_status(doc)
    refresh_kds(doc.name)
    queue_name = frappe.db.get_value(
        "Queue Ticket",
        {"sales_invoice": doc.sales_invoice},
        "name"
    )

    if queue_name:
        refresh_los(queue_name)


    frappe.db.commit()

    frappe.publish_realtime(
        event="kds_status_update",
        message={"ticket": ticket_name, "status": new_status},
        after_commit=True
    )

    return {"success": True, "ticket": ticket_name, "new_status": new_status}

@frappe.whitelist()
def get_filter_options():
    """Return dropdown filter values for KDS"""
    companies = frappe.get_all("Company", fields=["name"])
    kitchen_units = frappe.get_all("Kitchen Production Unit", fields=["name"])
    statuses = [{"name": s} for s in ["New", "Preparing", "Ready", "Served"]]

    return {
        "companies": companies,              # List of {name: "Company Name"}
        "kitchen_units": kitchen_units,      # List of {name: "Unit Name"}
        "statuses": statuses                 # List of {name: "New"}, etc.
    }
