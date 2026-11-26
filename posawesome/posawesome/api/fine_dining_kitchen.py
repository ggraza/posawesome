# Copyright (c) 2026, Youssef Restom and contributors
# For license information, please see license.txt
"""Fine dining phase 3: kitchen.

Switched on per POS Profile (Fine Dining: Kitchen), each on its own:
* Expo (Pass) Screen (`posa_fd_expo`): the page fd_expo shows each table's
  courses with what is cooking / ready; the pass marks a course served
* Kitchen: Finish Single Items and Recall (`posa_fd_kds_item_bump`): tap an
  item on the kitchen display when it is done; Recall brings a finished
  ticket back
* Kitchen Target Minutes (`posa_fd_prep_minutes`): tickets turn amber at 75%
  and red past the target (an item's own Prep Minutes win)
* 86 List (`posa_fd_86`): dishes marked unavailable cannot be ordered; every
  terminal is told at once
* Allergens (`posa_fd_allergens`): allergens on items (POS Allergen), the
  guests' allergies on the order; matching items are flagged on the ticket
"""

import frappe
from frappe import _
from frappe.utils import cint, flt, now_datetime

from posawesome.posawesome.api.fine_dining import _check_profile_access, settings

KITCHEN_FIELDS = {
    "expo": "posa_fd_expo",
    "item_bump": "posa_fd_kds_item_bump",
    "prep_minutes": "posa_fd_prep_minutes",
    "eighty_six": "posa_fd_86",
    "allergens": "posa_fd_allergens",
}


def kitchen_settings(pos_profile):
    out = frappe._dict({k: 0 for k in KITCHEN_FIELDS})
    if not pos_profile or not settings(pos_profile).enabled:
        return out
    meta = frappe.get_meta("POS Profile")
    fields = [f for f in KITCHEN_FIELDS.values() if meta.has_field(f)]
    if not fields:
        return out
    row = frappe.db.get_value("POS Profile", pos_profile, fields, as_dict=True) or {}
    for k, f in KITCHEN_FIELDS.items():
        out[k] = cint(row.get(f))
    return out


def _split(text):
    return [x.strip() for x in (text or "").replace("\n", ",").split(",") if x.strip()]


def item_allergens(item_codes):
    """{item_code: [allergen, ...]} from the items' Allergens."""
    if not item_codes or not frappe.db.table_exists("POS Item Allergen"):
        return {}
    out = {}
    for r in frappe.get_all("POS Item Allergen", filters={"parenttype": "Item", "parent": ["in", list(item_codes)]},
                            fields=["parent", "allergen"]):
        out.setdefault(r.parent, []).append(r.allergen)
    return out


# ------------------------------------------------------------------ kitchen tickets
def enrich_ticket(doc, kt, items):
    """Called by kds.create_kitchen_tickets before a ticket is inserted:
    target minutes and allergy flags."""
    k = kitchen_settings(doc.get("pos_profile"))
    if not (k.prep_minutes or k.allergens):
        return
    codes = {i.item_code for i in items}
    if k.prep_minutes and kt.meta.has_field("target_minutes"):
        own = [cint(v) for v in frappe.get_all("Item", filters={"name": ["in", list(codes)]}, pluck="posa_prep_minutes")
               if cint(v)] if frappe.get_meta("Item").has_field("posa_prep_minutes") else []
        kt.target_minutes = max(own) if own else cint(k.prep_minutes)
    if k.allergens and kt.meta.has_field("allergy_note"):
        guest = _split(doc.get("posa_allergies"))
        kt.allergy_note = ", ".join(guest) if guest else None
        if guest:
            found = item_allergens(codes)
            gl = {g.lower() for g in guest}
            for row in kt.get("items") or []:
                hit = [a for a in found.get(row.get("item_code"), []) if a.lower() in gl]
                if hit:
                    row["posa_allergen_alert"] = ", ".join(hit)


# ------------------------------------------------------------------ kitchen display
def _ticket_profile(ticket):
    return frappe.db.get_value("Kitchen Ticket", ticket, "pos_profile")


@frappe.whitelist()
def ticket_flags(pos_profiles):
    """{pos_profile: {item_bump, prep_minutes, eighty_six}} for the kitchen display."""
    import json

    names = json.loads(pos_profiles) if isinstance(pos_profiles, str) else (pos_profiles or [])
    return {p: kitchen_settings(p) for p in set(names) if p}


@frappe.whitelist()
def bump_item(ticket, row):
    """Tap an item on the kitchen display: done / not done. A ticket whose
    items are all done becomes Ready."""
    from posawesome.posawesome.api.kds import refresh_kds, update_queue_status

    if not kitchen_settings(_ticket_profile(ticket)).item_bump:
        frappe.throw(_("Finish Single Items is not enabled for this kitchen's POS Profile"))
    kt = frappe.get_doc("Kitchen Ticket", ticket)
    hit = next((i for i in kt.items if i.name == row), None)
    if not hit:
        frappe.throw(_("Item not on ticket {0}").format(ticket))
    done = hit.get("item_status") in ("Ready", "Served")
    frappe.db.set_value("Kitchen Ticket Items", hit.name, {"item_status": None if done else "Ready",
                                                           "ready_at": None if done else now_datetime()},
                        update_modified=False)
    hit.item_status = None if done else "Ready"
    if all(i.get("item_status") in ("Ready", "Served") for i in kt.items):
        if kt.status in ("New", "Preparing"):
            kt.status = "Ready"
            kt.time_ready = frappe.utils.nowtime()
            kt.save(ignore_permissions=True)
            update_queue_status(kt)
    elif kt.status == "New":
        kt.status = "Preparing"
        kt.time_prepared = frappe.utils.nowtime()
        kt.save(ignore_permissions=True)
    refresh_kds(ticket)
    frappe.publish_realtime("posa_expo_refresh", {"invoice": kt.sales_invoice}, after_commit=True)
    return {"item_status": hit.item_status, "status": kt.status}


@frappe.whitelist()
def recent_done(unit=None, limit=20):
    """Tickets finished lately (Ready / Served), newest first, for Recall."""
    filters = {"status": ["in", ["Ready", "Served"]], "docstatus": 1}
    if unit:
        filters["kitchen_production_unit"] = unit
    if frappe.get_meta("Kitchen Ticket").has_field("ticket_type"):
        filters["ticket_type"] = ["in", ["Order", "", None]]
    return frappe.get_all("Kitchen Ticket", filters=filters,
                          fields=["name", "sales_invoice", "kitchen_production_unit", "status", "service_table", "modified"],
                          order_by="modified desc", limit=cint(limit) or 20)


@frappe.whitelist()
def recall(ticket):
    """Bring a finished ticket back to the kitchen (Preparing)."""
    from posawesome.posawesome.api.kds import refresh_kds, update_queue_status

    if not kitchen_settings(_ticket_profile(ticket)).item_bump:
        frappe.throw(_("Recall is not enabled for this kitchen's POS Profile"))
    kt = frappe.get_doc("Kitchen Ticket", ticket)
    kt.status = "Preparing"
    kt.save(ignore_permissions=True)
    for i in kt.items:
        if i.get("item_status") == "Served":
            frappe.db.set_value("Kitchen Ticket Items", i.name, "item_status", "Ready", update_modified=False)
    update_queue_status(kt)
    refresh_kds(ticket)
    return kt.status


# ------------------------------------------------------------------ 86 list
def eighty_six_list():
    if not frappe.get_meta("Item").has_field("posa_86"):
        return []
    return frappe.get_all("Item", filters={"posa_86": 1}, fields=["name as item_code", "item_name", "posa_86_on"],
                          order_by="item_name asc")


@frappe.whitelist()
def get_86(pos_profile=None):
    return eighty_six_list()


@frappe.whitelist()
def set_86(item_code, unavailable=1, pos_profile=None):
    """Mark a dish unavailable (86) or back on; every POS and kitchen screen is told."""
    unavailable = cint(unavailable)
    if pos_profile:
        _check_profile_access(pos_profile)
        if not kitchen_settings(pos_profile).eighty_six:
            frappe.throw(_("86 List is not enabled on POS Profile {0}").format(pos_profile))
    if not frappe.db.exists("Item", item_code):
        frappe.throw(_("Item {0} not found").format(item_code))
    frappe.db.set_value("Item", item_code, {"posa_86": unavailable, "posa_86_on": now_datetime() if unavailable else None},
                        update_modified=False)
    lst = eighty_six_list()
    frappe.publish_realtime("posa_86_changed", {"items": lst}, after_commit=True)
    return lst


def validate_86(doc, method=None):
    """Sales Invoice validate: new quantities of an 86'd dish are refused (what the
    kitchen already has may stay)."""
    if doc.get("is_return") or not doc.get("pos_profile") or frappe.flags.get("posa_offline_sync"):
        return
    if not kitchen_settings(doc.pos_profile).eighty_six:
        return
    out = {r.item_code for r in eighty_six_list()}
    if not out:
        return
    from posawesome.posawesome.api.fine_dining import row_key, sent_map

    sent = sent_map(doc.name) if doc.name and not doc.is_new() else {}
    bad = []
    for row in doc.get("items") or []:
        if row.item_code in out and flt(row.qty) > flt(sent.get(row_key(row), frappe._dict(qty=0)).qty) + 1e-9:
            bad.append(row.item_name or row.item_code)
    if bad:
        frappe.throw(_("Not available today (86): {0}").format(", ".join(sorted(set(bad)))), title=_("86"))


# ------------------------------------------------------------------ expo
@frappe.whitelist()
def get_expo(pos_profile):
    """Open dine-in orders with their courses and what the kitchen has done."""
    _check_profile_access(pos_profile)
    if not kitchen_settings(pos_profile).expo:
        frappe.throw(_("Expo Screen is not enabled on POS Profile {0}").format(pos_profile))
    company = frappe.db.get_value("POS Profile", pos_profile, "company")
    orders = frappe.get_all("Sales Invoice",
                            filters={"docstatus": 0, "company": company, "posa_service_table": ["!=", ""], "is_return": 0},
                            fields=["name", "posa_service_table", "posa_covers", "posa_waiter", "owner", "creation",
                                    "posa_allergies"],
                            order_by="creation asc")
    if not orders:
        return {"orders": [], "now": str(now_datetime())}
    names = [o.name for o in orders]
    seq = dict(frappe.get_all("POS Course", fields=["name", "sequence"], as_list=True)) if frappe.db.table_exists("POS Course") else {}
    held = frappe.get_all("Sales Invoice Item", filters={"parent": ["in", names], "posa_course_status": "Hold"},
                          fields=["parent", "item_name", "qty", "posa_course", "posa_seat"])
    rows = frappe.db.sql(
        """select kt.name as ticket, kt.sales_invoice, kt.status, ifnull(kt.ticket_type, 'Order') as ticket_type,
            kt.kitchen_production_unit as unit, kt.creation,
            i.name as row, i.item_name, i.qty, i.posa_course, i.posa_seat, i.posa_modifiers, i.item_status
        from `tabKitchen Ticket` kt join `tabKitchen Ticket Items` i on i.parent = kt.name and i.parenttype = 'Kitchen Ticket'
        where kt.sales_invoice in %(names)s and kt.docstatus = 1
        order by kt.creation asc, i.idx asc""",
        {"names": names},
        as_dict=True,
    )
    out = []
    for o in orders:
        courses = {}

        def course(c):
            key = c or ""
            return courses.setdefault(key, {"course": key, "sequence": cint(seq.get(c, 9999)) if c else 9999,
                                            "items": [], "held": 0, "cooking": 0, "ready": 0, "served": 0})

        for r in rows:
            if r.sales_invoice != o.name or r.ticket_type != "Order":
                continue
            c = course(r.posa_course)
            if r.item_status == "Served" or r.status == "Served":
                state = "Served"
            elif r.item_status == "Ready" or r.status == "Ready":
                state = "Ready"
            else:
                state = "Cooking"
            c[state.lower()] += 1
            c["items"].append({"ticket": r.ticket, "row": r.row, "item_name": r.item_name, "qty": flt(r.qty),
                               "seat": cint(r.posa_seat), "modifiers": r.posa_modifiers, "state": state, "unit": r.unit})
        for h in held:
            if h.parent != o.name:
                continue
            c = course(h.posa_course)
            c["held"] += 1
            c["items"].append({"item_name": h.item_name, "qty": flt(h.qty), "seat": cint(h.posa_seat), "state": "Held"})
        lst = sorted(courses.values(), key=lambda c: (c["sequence"], c["course"]))
        for c in lst:
            live = c["cooking"] + c["ready"]
            c["state"] = ("Held" if c["held"] and not live and not c["served"] else
                          "Served" if not live and not c["held"] else
                          "Ready" if c["ready"] and not c["cooking"] else "Cooking")
        if not any(c["state"] != "Served" for c in lst):
            continue
        out.append({"name": o.name, "table": o.posa_service_table, "covers": cint(o.posa_covers),
                    "waiter": frappe.db.get_value("User", o.posa_waiter or o.owner, "full_name") or o.posa_waiter or o.owner,
                    "since": str(o.creation), "allergies": o.posa_allergies, "courses": lst})
    return {"orders": out, "now": str(now_datetime())}


@frappe.whitelist()
def serve_course(pos_profile, invoice, course=""):
    """The pass sends a course to the table: its items are Served; a ticket whose
    items are all served is Served."""
    from posawesome.posawesome.api.kds import refresh_kds, update_queue_status

    _check_profile_access(pos_profile)
    if not kitchen_settings(pos_profile).expo:
        frappe.throw(_("Expo Screen is not enabled on POS Profile {0}").format(pos_profile))
    tickets = frappe.get_all("Kitchen Ticket", filters={"sales_invoice": invoice, "docstatus": 1}, pluck="name")
    touched = 0
    for t in tickets:
        kt = frappe.get_doc("Kitchen Ticket", t)
        if (kt.get("ticket_type") or "Order") != "Order":
            continue
        changed = False
        for i in kt.items:
            if (i.get("posa_course") or "") == (course or "") and i.get("item_status") != "Served":
                frappe.db.set_value("Kitchen Ticket Items", i.name, "item_status", "Served", update_modified=False)
                i.item_status = "Served"
                changed = True
                touched += 1
        if changed and all(i.get("item_status") == "Served" for i in kt.items) and kt.status != "Served":
            kt.status = "Served"
            kt.save(ignore_permissions=True)
            update_queue_status(kt)
        if changed:
            refresh_kds(t)
    frappe.publish_realtime("posa_expo_refresh", {"invoice": invoice}, after_commit=True)
    return {"served": touched}
