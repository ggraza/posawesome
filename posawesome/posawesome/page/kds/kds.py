#page/kds/kds.py
import frappe
from datetime import datetime


@frappe.whitelist()
def get_kitchen_tickets(company=None, unit=None, status=None, from_date=None, to_date=None, search=None):
    """Fetch filtered Kitchen Tickets with items"""
    filters = {}

    if company:
        filters["company"] = company
    if unit:
        filters["kitchen_production_unit"] = unit
    if from_date and to_date:
        filters["creation"] = ["between", [from_date, to_date]]
    if status:
        filters["status"] = status
    else:
        filters["status"] = ["!=", "Served"]
    if search:
        filters["name"] = ["like", f"%{search}%"]

    fd = frappe.get_meta("Kitchen Ticket").has_field("ticket_type")
    ticket_fields = ["name", "sales_invoice", "status", "kitchen_production_unit", "creation", "company"]
    if fd:
        # fine dining: VOID tickets, table and guests
        ticket_fields += ["ticket_type", "service_table", "covers"]
    if frappe.get_meta("Kitchen Ticket").has_field("target_minutes"):
        ticket_fields += ["pos_profile", "target_minutes", "allergy_note"]
    tickets = frappe.get_all(
        "Kitchen Ticket",
        filters=filters,
        fields=ticket_fields,
        order_by="creation desc",
        limit_page_length=100
    )

    item_fields = ["item_name", "qty", "posa_notes"]
    if frappe.get_meta("Kitchen Ticket Items").has_field("posa_seat"):
        item_fields += ["posa_seat", "posa_course", "posa_modifiers"]
    if frappe.get_meta("Kitchen Ticket Items").has_field("item_status"):
        item_fields += ["name", "item_code", "item_status", "posa_allergen_alert"]
    # fine dining phase 3: what each ticket's POS Profile allows on this screen
    flags = {}
    if frappe.get_meta("Kitchen Ticket").has_field("target_minutes"):
        from posawesome.posawesome.api.fine_dining_kitchen import kitchen_settings

        for p in {t.get("pos_profile") for t in tickets if t.get("pos_profile")}:
            flags[p] = kitchen_settings(p)

    # Append items for each ticket
    for t in tickets:
        t["fd"] = flags.get(t.get("pos_profile")) or {}
        t["items"] = frappe.get_all(
            "Kitchen Ticket Items",
            filters={"parent": t.name},
            fields=item_fields,
            order_by="idx asc",
        )

    return tickets


@frappe.whitelist()
def update_ticket_status(ticket_name, new_status):
    try:
        doc = frappe.get_doc("Kitchen Ticket", ticket_name)

        doc.status = new_status

        # Update time fields based on status
        if new_status == "Preparing":
            doc.time_prepared = datetime.now().time()

        elif new_status == "Ready":
            doc.time_ready = datetime.now().time()

        doc.save(ignore_permissions=True)
        frappe.db.commit()

        # refresh KDS screen
        frappe.publish_realtime("kds_refresh")

        return {"success": True}

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "KDS Status Update Error")
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def notify_new_ticket(ticket_name):
    """Call this from hooks or after_insert in Kitchen Ticket"""
    if frappe.db.exists("Kitchen Ticket", ticket_name):
        ticket = frappe.get_doc("Kitchen Ticket", ticket_name)
        frappe.publish_realtime("kds_refresh", {"ticket": ticket.name, "unit": ticket.kitchen_production_unit})

        # Get sound file path (from POS Profile or fallback)
        sound_url = None
        if hasattr(ticket, "pos_profile") and ticket.pos_profile:
            sound_url = frappe.db.get_value("POS Profile", ticket.pos_profile, "custom_kot_sound")

        # Default to built-in alert if no file uploaded
        if not sound_url:
            sound_url = "/assets/posawesome/sounds/kot_alert.mp3"

