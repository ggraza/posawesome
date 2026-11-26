# Copyright (c) 2026, Youssef Restom and contributors
# For license information, please see license.txt
"""Fine dining (phase 1).

Every feature is switched on per POS Profile (Restaurant and KDS tab > Fine Dining)
under the master switch `posa_enable_fine_dining`. With the switch off nothing
here changes how the POS, the kitchen tickets or the invoices behave.

* covers and seat numbers: plain fields on the invoice and its rows
* modifiers: `POS Modifier Group`; the chosen text is kept on the row
  (`posa_modifiers`), paid add-ons are their own rows (`posa_parent_row_id`)
* courses: `POS Course`; rows of a course that is held wait in the order and
  are left out of the kitchen ticket until the waiter fires them
* void / comp: what was sent to the kitchen is read from the Kitchen Tickets,
  never from the terminal. Taking sent items off an order, or making an item
  free, needs an approved `POS Void Log` (reason, and a manager when required);
  the save then sends a VOID ticket to the kitchen
* pre-bill: a guest check printed before payment; never an FBR invoice
"""

import json

import frappe
from frappe import _
from frappe.utils import cint, flt, now_datetime

SETTINGS = {
    "enabled": "posa_enable_fine_dining",
    "covers": "posa_fd_covers",
    "covers_required": "posa_fd_covers_required",
    "seats": "posa_fd_seats",
    "modifiers": "posa_fd_modifiers",
    "courses": "posa_fd_courses",
    "void_control": "posa_fd_void_control",
    "void_approval": "posa_fd_void_approval",
    "approver_role": "posa_fd_approver_role",
    "prebill": "posa_fd_prebill",
    "prebill_format": "posa_fd_prebill_format",
}
FLAGS = [k for k in SETTINGS if k not in ("enabled", "approver_role", "prebill_format")]
EPS = 1e-9


def settings(pos_profile):
    """The fine dining switches of a POS Profile. Every feature reads False
    while the master switch is off (or the fields are not migrated yet)."""
    out = frappe._dict({k: 0 for k in SETTINGS})
    out.approver_role = "Sales Manager"
    out.prebill_format = "Guest Check"
    if not pos_profile:
        return out
    meta = frappe.get_meta("POS Profile")
    fields = [f for f in SETTINGS.values() if meta.has_field(f)]
    if "posa_enable_fine_dining" not in fields:
        return out
    row = frappe.db.get_value("POS Profile", pos_profile, fields, as_dict=True) or {}
    if not cint(row.get("posa_enable_fine_dining")):
        return out
    out.enabled = 1
    for key in FLAGS:
        out[key] = cint(row.get(SETTINGS[key]))
    if not out.covers:
        out.covers_required = 0
    if not out.void_control:
        out.void_approval = 0
    out.approver_role = row.get("posa_fd_approver_role") or "Sales Manager"
    out.prebill_format = row.get("posa_fd_prebill_format") or "Guest Check"
    return out


def _check_profile_access(pos_profile):
    if not pos_profile or not frappe.db.exists("POS Profile", pos_profile):
        frappe.throw(_("POS Profile {0} not found").format(pos_profile or "-"))
    if frappe.session.user == "Administrator":
        return
    allowed = frappe.db.exists("POS Profile User", {"parent": pos_profile, "user": frappe.session.user})
    if not allowed and not frappe.has_permission("POS Profile", "read", pos_profile):
        frappe.throw(_("You are not allowed to use POS Profile {0}").format(pos_profile), frappe.PermissionError)


# ------------------------------------------------------------------ setup for the POS
@frappe.whitelist()
def get_setup(pos_profile):
    """Switches, courses, modifier groups and void reasons for the POS."""
    _check_profile_access(pos_profile)
    s = settings(pos_profile)
    out = {"settings": s, "courses": [], "modifier_groups": [], "void_reasons": [], "floor": {}, "kitchen": {},
           "eighty_six": [], "allergens": [], "guests": {}}
    if not s.enabled:
        return out
    from posawesome.posawesome.api.fine_dining_floor import floor_settings

    out["floor"] = floor_settings(pos_profile)
    from posawesome.posawesome.api.fine_dining_kitchen import eighty_six_list, kitchen_settings

    from posawesome.posawesome.api.fine_dining_guests import guest_settings

    out["guests"] = guest_settings(pos_profile)
    k = kitchen_settings(pos_profile)
    out["kitchen"] = k
    out["eighty_six"] = eighty_six_list() if k.eighty_six else []
    out["allergens"] = (frappe.get_all("POS Allergen", filters={"disabled": 0}, fields=["name", "short_code"],
                                       order_by="name asc") if k.allergens else [])
    if s.courses:
        courses = frappe.get_all(
            "POS Course",
            filters={"disabled": 0},
            fields=["name", "course_name", "sequence", "hold_until_fired", "color"],
            order_by="sequence asc, name asc",
        )
        groups = frappe.get_all(
            "POS Course Item Group", filters={"parenttype": "POS Course"}, fields=["parent", "item_group"]
        )
        for c in courses:
            c["item_groups"] = [g.item_group for g in groups if g.parent == c.name]
        out["courses"] = courses
    if s.modifiers:
        mgroups = frappe.get_all(
            "POS Modifier Group",
            filters={"disabled": 0},
            fields=["name", "group_name", "sequence", "required", "min_select", "max_select"],
            order_by="sequence asc, name asc",
        )
        names = [g.name for g in mgroups]
        options = frappe.get_all(
            "POS Modifier Option",
            filters={"parenttype": "POS Modifier Group", "parent": ["in", names or [""]]},
            fields=["parent", "option", "item", "is_default", "idx"],
            order_by="idx asc",
        )
        targets = frappe.get_all(
            "POS Modifier Group Target",
            filters={"parenttype": "POS Modifier Group", "parent": ["in", names or [""]]},
            fields=["parent", "item_code", "item_group"],
        )
        item_names = {}
        addon_items = list({o.item for o in options if o.item})
        if addon_items:
            item_names = dict(
                frappe.get_all("Item", filters={"name": ["in", addon_items]}, fields=["name", "item_name"], as_list=True)
            )
        for g in mgroups:
            g["options"] = [
                {"option": o.option, "item": o.item, "item_name": item_names.get(o.item) if o.item else None,
                 "is_default": cint(o.is_default)}
                for o in options
                if o.parent == g.name
            ]
            g["item_codes"] = [t.item_code for t in targets if t.parent == g.name and t.item_code]
            g["item_groups"] = [t.item_group for t in targets if t.parent == g.name and t.item_group]
        out["modifier_groups"] = mgroups
    if s.void_control:
        out["void_reasons"] = frappe.get_all(
            "POS Void Reason",
            filters={"disabled": 0},
            fields=["name", "reason", "reason_type"],
            order_by="reason asc",
        )
    return out


# ------------------------------------------------------------------ what the kitchen has
def row_key(row):
    return row.get("posa_row_id") or row.get("item_code")


def sent_map(invoice):
    """Per order row: the qty the kitchen has (order tickets minus void
    tickets), with what is needed to write a void ticket for it."""
    if not invoice:
        return {}
    has_type = frappe.get_meta("Kitchen Ticket").has_field("ticket_type")
    rows = frappe.db.sql(
        """
        select kt.name, kt.kitchen_production_unit as unit, kt.pos_profile,
            {ticket_type} as ticket_type,
            i.posa_row_id, i.item_code, i.item_name, i.item_group, i.qty, i.uom, i.rate,
            {extra}
        from `tabKitchen Ticket` kt
        join `tabKitchen Ticket Items` i on i.parent = kt.name and i.parenttype = 'Kitchen Ticket'
        where kt.sales_invoice = %s
        order by kt.creation asc, i.idx asc
        """.format(
            ticket_type="ifnull(kt.ticket_type, 'Order')" if has_type else "'Order'",
            extra="i.posa_seat, i.posa_course, i.posa_modifiers"
            if frappe.get_meta("Kitchen Ticket Items").has_field("posa_seat")
            else "0 as posa_seat, null as posa_course, null as posa_modifiers",
        ),
        invoice,
        as_dict=True,
    )
    out = {}
    for r in rows:
        key = r.posa_row_id or r.item_code
        e = out.setdefault(
            key,
            frappe._dict(qty=0.0, units={}, item_code=r.item_code, item_name=r.item_name, item_group=r.item_group,
                         uom=r.uom, rate=flt(r.rate), posa_seat=r.posa_seat, posa_course=r.posa_course,
                         posa_modifiers=r.posa_modifiers, pos_profile=r.pos_profile, row_id=key),
        )
        # VOID and TRANSFER OUT take off what the kitchen has; TRANSFER IN brings
        # in what another order had already sent
        sign = -1 if r.ticket_type in ("Void", "Transfer Out") else 1
        e.qty += sign * flt(r.qty)
        if r.unit:
            e.units[r.unit] = e.units.get(r.unit, 0) + sign * flt(r.qty)
    return out


def _cart_qty(doc):
    qty = {}
    for row in doc.get("items") or []:
        key = row_key(row)
        qty[key] = qty.get(key, 0) + flt(row.get("qty"))
    return qty


def _sale_filters(doc_or_invoice, sale_id=None):
    """Logs belong to the sale: by invoice name, or by sale id before it has one."""
    if isinstance(doc_or_invoice, str):
        invoice = doc_or_invoice
    else:
        invoice = doc_or_invoice.name
        sale_id = sale_id or doc_or_invoice.get("posa_offline_id")
    ors = []
    if invoice:
        ors.append(["sales_invoice", "=", invoice])
    if sale_id:
        ors.append(["sale_id", "=", sale_id])
    return ors


def _approved_logs(doc, void_type, row_id):
    ors = _sale_filters(doc)
    if not ors:
        return []
    return frappe.get_all(
        "POS Void Log",
        filters={"void_type": void_type, "status": "Approved", "row_id": row_id},
        or_filters=ors,
        fields=["name", "qty", "reason", "approved_by"],
        order_by="creation asc",
    )


@frappe.whitelist()
def get_item_allergens(item_code):
    """The allergens of one item (the POS warns when a guest at the table has one)."""
    from posawesome.posawesome.api.fine_dining_kitchen import item_allergens

    return item_allergens([item_code]).get(item_code, [])


@frappe.whitelist()
def get_sent(invoice):
    """{row_id: qty the kitchen has} for an order: what a void is needed for."""
    if not invoice or not frappe.db.exists("Sales Invoice", invoice):
        return {}
    _check_profile_access(frappe.db.get_value("Sales Invoice", invoice, "pos_profile"))
    return {k: flt(e.qty) for k, e in sent_map(invoice).items() if e.qty > EPS}


# ------------------------------------------------------------------ approval
def _approve(role, approver=None, password=None):
    """The approving user, or raise. A user with the approver role approves
    by themselves; anyone else needs that user's user id and password."""
    from frappe.utils.password import check_password

    me = frappe.session.user
    if not approver or approver == me:
        if me == "Administrator" or role in frappe.get_roles(me):
            return me
        frappe.throw(
            _("Manager approval is required: enter the user and password of a {0}.").format(role),
            title=_("Approval required"),
        )
    if not frappe.db.get_value("User", approver, "enabled"):
        frappe.throw(_("Approval failed: user {0} not found or disabled").format(approver), title=_("Approval failed"))
    if role not in frappe.get_roles(approver):
        frappe.throw(_("Approval failed: {0} does not have the role {1}").format(approver, role), title=_("Approval failed"))
    try:
        check_password(approver, password or "")
    except frappe.AuthenticationError:
        frappe.throw(_("Approval failed: wrong password for {0}").format(approver), title=_("Approval failed"))
    return approver


@frappe.whitelist()
def approve(pos_profile, void_type, reason, lines, invoice=None, sale_id=None, service_table=None,
            remarks=None, approver=None, password=None):
    """Approve taking items off an order (Void) or making them free (Comp).

    lines: [{row_id, qty, item_code, item_name, rate}]. For a void the qty is
    checked against what the kitchen has. Returns the approved logs; the next
    save of the order applies them."""
    _check_profile_access(pos_profile)
    s = settings(pos_profile)
    if not s.void_control:
        frappe.throw(_("Void / Comp with Reason is not enabled on POS Profile {0}").format(pos_profile))
    if void_type not in ("Void", "Comp"):
        frappe.throw(_("Unknown type {0}").format(void_type))
    lines = json.loads(lines) if isinstance(lines, str) else (lines or [])
    lines = [frappe._dict(l) for l in lines if l and flt(l.get("qty")) > 0 and l.get("row_id")]
    if not lines:
        frappe.throw(_("Nothing to approve"))

    r = frappe.db.get_value("POS Void Reason", reason, ["reason_type", "disabled"], as_dict=True) if reason else None
    if not r or r.disabled:
        frappe.throw(_("Choose a reason"), title=_("Reason required"))
    if r.reason_type not in ("Both", void_type):
        frappe.throw(_("Reason {0} is not for {1}").format(reason, _(void_type)))

    if invoice and not frappe.db.exists("Sales Invoice", invoice):
        invoice = None
    if invoice:
        inv = frappe.db.get_value("Sales Invoice", invoice, ["docstatus", "pos_profile", "posa_offline_id"], as_dict=True)
        if inv.docstatus != 0:
            frappe.throw(_("Order {0} is already completed").format(invoice))
        if inv.pos_profile != pos_profile:
            frappe.throw(_("Order {0} is not for POS Profile {1}").format(invoice, pos_profile))
        sale_id = sale_id or inv.posa_offline_id
    if not invoice and not sale_id:
        frappe.throw(_("Save the order first"))

    sent = sent_map(invoice) if invoice else {}
    if void_type == "Void":
        for l in lines:
            e = sent.get(l.row_id)
            if not e or e.qty <= EPS:
                frappe.throw(_("{0} was not sent to the kitchen: it can be removed without a void").format(
                    l.item_name or l.item_code or l.row_id))
            pending = sum(flt(x.qty) for x in _approved_logs(frappe._dict(name=invoice, posa_offline_id=sale_id),
                                                               "Void", l.row_id))
            if flt(l.qty) > e.qty - pending + EPS:
                frappe.throw(_("{0}: the kitchen has {1}, {2} already approved; cannot void {3}").format(
                    e.item_name, e.qty, pending, l.qty))
            l.item_code, l.item_name = e.item_code, e.item_name
            l.rate = flt(l.rate) or e.rate

    user = _approve(s.approver_role, approver, password) if s.void_approval else frappe.session.user
    names = []
    for l in lines:
        log = frappe.get_doc({
            "doctype": "POS Void Log",
            "void_type": void_type,
            "status": "Approved",
            "sales_invoice": invoice,
            "sale_id": sale_id,
            "pos_profile": pos_profile,
            "service_table": service_table or (frappe.db.get_value("Sales Invoice", invoice, "posa_service_table")
                                               if invoice else None),
            "reason": reason,
            "remarks": remarks,
            "requested_by": frappe.session.user,
            "approved_by": user,
            "approved_on": now_datetime(),
            "item_code": l.item_code,
            "item_name": l.item_name,
            "row_id": l.row_id,
            "qty": flt(l.qty),
            "rate": flt(l.rate),
            "amount": flt(l.qty) * flt(l.rate),
            "sent_to_kitchen": 1 if l.row_id in sent else 0,
        })
        log.insert(ignore_permissions=True)
        names.append(log.name)
    return {"logs": names, "approved_by": user, "reason": reason}


# ------------------------------------------------------------------ invoice hooks
def _offline_upload():
    return bool(frappe.flags.get("posa_offline_sync"))


def _apply_voids(doc, s, removed, manager_ok=False):
    """removed: {row_id: qty taken off}. Consume approvals, write the VOID
    tickets. Raises when an approval is missing (not for offline uploads; a
    manager deleting the order from the desk approves it by doing so)."""
    if not removed:
        return
    sent = sent_map(doc.name)
    missing = []
    used_logs = {}
    for key, qty in removed.items():
        need = qty
        for log in _approved_logs(doc, "Void", key):
            if need <= EPS:
                break
            take = min(need, flt(log.qty))
            used_logs[log.name] = (key, take)
            need -= take
        if need > EPS:
            if manager_ok:
                e = sent[key]
                log = frappe.get_doc({
                    "doctype": "POS Void Log", "void_type": "Void", "status": "Approved",
                    "sales_invoice": doc.name, "sale_id": doc.get("posa_offline_id"), "pos_profile": doc.pos_profile,
                    "service_table": doc.get("posa_service_table"), "requested_by": frappe.session.user,
                    "approved_by": frappe.session.user, "approved_on": now_datetime(),
                    "remarks": _("Order deleted by {0}").format(frappe.session.user),
                    "item_code": e.item_code, "item_name": e.item_name, "row_id": key, "qty": need,
                    "rate": e.rate, "amount": need * flt(e.rate), "sent_to_kitchen": 1,
                })
                log.insert(ignore_permissions=True)
                used_logs[log.name] = (key, need)
            elif _offline_upload():
                e = sent[key]
                off = frappe.get_doc({
                    "doctype": "POS Void Log", "void_type": "Void", "status": "Offline",
                    "sales_invoice": doc.name, "sale_id": doc.get("posa_offline_id"), "pos_profile": doc.pos_profile,
                    "service_table": doc.get("posa_service_table"), "requested_by": doc.owner,
                    "remarks": _("Taken off on a terminal without connection; not approved."),
                    "item_code": e.item_code, "item_name": e.item_name, "row_id": key, "qty": need,
                    "rate": e.rate, "amount": need * flt(e.rate), "sent_to_kitchen": 1,
                })
                off.insert(ignore_permissions=True)
                used_logs[off.name] = (key, need)
            else:
                missing.append("{0} x {1}".format(frappe.bold(sent[key].item_name), need))
    if missing:
        frappe.throw(
            _("These items were already sent to the kitchen. Taking them off needs a void with a reason{0}: {1}").format(
                _(" and manager approval") if s.void_approval else "", ", ".join(missing)),
            title=_("Void required"),
        )

    tickets = _void_tickets(doc, {k: removed[k] for k in removed}, sent)
    for name, (key, take) in used_logs.items():
        frappe.db.set_value("POS Void Log", name, {
            "status": "Applied" if frappe.db.get_value("POS Void Log", name, "status") == "Approved" else "Offline",
            "qty": take,
            "amount": take * flt(sent[key].rate),
            "sales_invoice": doc.name,
            "kitchen_ticket": tickets.get(key),
        }, update_modified=False)


def _void_tickets(doc, removed, sent):
    """One VOID Kitchen Ticket per production unit. Returns {row_id: ticket}."""
    from posawesome.posawesome.api.kds import refresh_kds

    by_unit = {}
    for key, qty in removed.items():
        e = sent[key]
        left = qty
        # take it off the units that have it, the last one first
        for unit, uqty in reversed(list(e.units.items())):
            if left <= EPS:
                break
            take = min(left, uqty)
            if take <= EPS:
                continue
            by_unit.setdefault(unit, []).append((key, take))
            left -= take
    out = {}
    for unit, rows in by_unit.items():
        kt = frappe.new_doc("Kitchen Ticket")
        kt.ticket_type = "Void"
        kt.sales_invoice = doc.name
        kt.company = doc.company
        kt.posting_date = doc.posting_date
        kt.pos_profile = frappe.db.get_value("Kitchen Production Unit", unit, "pos_profile") or doc.pos_profile
        kt.kitchen_production_unit = unit
        kt.service_table = doc.get("posa_service_table")
        kt.covers = cint(doc.get("posa_covers"))
        kt.time_created = frappe.utils.nowtime()
        for key, take in rows:
            e = sent[key]
            kt.append("items", {
                "item_code": e.item_code, "item_name": e.item_name, "item_group": e.item_group,
                "qty": take, "uom": e.uom, "rate": e.rate, "amount": take * flt(e.rate),
                "posa_notes": _("VOID"), "posa_row_id": key, "posa_seat": e.posa_seat,
                "posa_course": e.posa_course, "posa_modifiers": e.posa_modifiers,
            })
        kt.insert(ignore_permissions=True)
        kt.submit()
        refresh_kds(kt.name)
        frappe.publish_realtime(
            "new_kitchen_ticket",
            {"ticket": kt.name, "unit": unit, "status": "New", "ticket_type": "Void"},
            after_commit=True,
        )
        for key, _take in rows:
            out[key] = kt.name
    return out


def validate_invoice(doc, method=None):
    """Sales Invoice validate: voids and comps need an approved POS Void Log."""
    if doc.get("is_return") or not doc.get("pos_profile"):
        return
    s = settings(doc.pos_profile)
    if not s.void_control:
        return

    # comps: every free row needs its approval
    for row in doc.get("items") or []:
        if not cint(row.get("posa_comp")):
            continue
        key = row_key(row)
        logs = _approved_logs(doc, "Comp", key)
        if logs:
            values = {"status": "Applied"}
            if doc.name and not doc.is_new():
                values["sales_invoice"] = doc.name
            frappe.db.set_value("POS Void Log", logs[0].name, values, update_modified=False)
            row.posa_comp_reason = logs[0].reason
            continue
        ors = _sale_filters(doc)
        done = frappe.get_all("POS Void Log", filters={"void_type": "Comp", "status": ["in", ["Applied", "Offline"]],
                                                       "row_id": key}, or_filters=ors, limit=1) if ors else []
        if done:
            continue
        if _offline_upload():
            frappe.get_doc({
                "doctype": "POS Void Log", "void_type": "Comp", "status": "Offline", "sale_id": doc.get("posa_offline_id"),
                "pos_profile": doc.pos_profile, "service_table": doc.get("posa_service_table"),
                "requested_by": doc.owner, "item_code": row.item_code, "item_name": row.item_name, "row_id": key,
                "qty": flt(row.qty), "rate": flt(row.price_list_rate), "amount": flt(row.qty) * flt(row.price_list_rate),
                "remarks": _("Made free on a terminal without connection; not approved."),
            }).insert(ignore_permissions=True)
            continue
        frappe.throw(_("{0} is marked free (comp) without an approved reason").format(frappe.bold(row.item_name)),
                     title=_("Comp required"))

    # voids: sent to the kitchen, now less (or gone)
    if doc.is_new() or not doc.name or not frappe.db.exists("Sales Invoice", doc.name):
        return
    sent = sent_map(doc.name)
    if not sent:
        return
    cart = _cart_qty(doc)
    removed = {}
    for key, e in sent.items():
        gone = e.qty - cart.get(key, 0)
        if gone > EPS:
            removed[key] = gone
    _apply_voids(doc, s, removed)


def _has_approved(doc, removed):
    return any(_approved_logs(doc, "Void", key) for key in removed)


def on_trash_invoice(doc, method=None):
    """Deleting an order the kitchen is working on is a void of everything sent."""
    if doc.get("is_return") or doc.docstatus != 0 or not doc.get("pos_profile"):
        return
    s = settings(doc.pos_profile)
    if not s.void_control:
        return
    sent = sent_map(doc.name)
    removed = {k: e.qty for k, e in sent.items() if e.qty > EPS}
    roles = frappe.get_roles(frappe.session.user)
    manager_ok = frappe.session.user == "Administrator" or s.approver_role in roles or "System Manager" in roles
    # from the POS the waiter approves first (POS Void Log); a manager deleting
    # the order at the desk approves it by deleting
    _apply_voids(doc, s, removed, manager_ok=manager_ok and not _has_approved(doc, removed))


# ------------------------------------------------------------------ pre-bill
@frappe.whitelist()
def prebill(invoice):
    """Count a guest check printed for this order. Returns the print format."""
    pos_profile, docstatus = frappe.db.get_value("Sales Invoice", invoice, ["pos_profile", "docstatus"]) or (None, None)
    if not pos_profile:
        frappe.throw(_("Order {0} not found").format(invoice))
    _check_profile_access(pos_profile)
    s = settings(pos_profile)
    if not s.prebill:
        frappe.throw(_("Pre-Bill is not enabled on POS Profile {0}").format(pos_profile))
    if docstatus != 0:
        frappe.throw(_("Order {0} is already completed").format(invoice))
    count = cint(frappe.db.get_value("Sales Invoice", invoice, "posa_prebill_count")) + 1
    frappe.db.set_value("Sales Invoice", invoice, "posa_prebill_count", count, update_modified=False)
    fmt = s.prebill_format if frappe.db.exists("Print Format", s.prebill_format) else None
    return {"print_format": fmt, "count": count}


# ------------------------------------------------------------------ install
DEFAULT_COURSES = [
    # name, sequence, hold until fired
    ("Drinks", 0, 0),
    ("Starters", 10, 0),
    ("Mains", 20, 1),
    ("Desserts", 30, 1),
]
DEFAULT_REASONS = [
    ("Guest Changed Mind", "Void"),
    ("Wrong Item Entered", "Void"),
    ("Out of Stock", "Void"),
    ("Kitchen Error", "Both"),
    ("Long Wait", "Comp"),
    ("Quality Complaint", "Both"),
    ("Manager Courtesy", "Comp"),
]


def after_migrate():
    """Default courses and void reasons on a site that has none."""
    try:
        if frappe.db.table_exists("POS Course") and not frappe.db.count("POS Course"):
            for name, seq, hold in DEFAULT_COURSES:
                frappe.get_doc({"doctype": "POS Course", "course_name": name, "sequence": seq,
                                "hold_until_fired": hold}).insert(ignore_permissions=True)
        if frappe.db.table_exists("POS Void Reason") and not frappe.db.count("POS Void Reason"):
            for reason, rtype in DEFAULT_REASONS:
                frappe.get_doc({"doctype": "POS Void Reason", "reason": reason, "reason_type": rtype}).insert(
                    ignore_permissions=True)
        frappe.db.commit()
    except Exception:
        frappe.log_error(frappe.get_traceback(), "POS fine dining defaults")
