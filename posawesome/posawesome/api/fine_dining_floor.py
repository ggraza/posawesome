# Copyright (c) 2026, Youssef Restom and contributors
# For license information, please see license.txt
"""Fine dining phase 2: floor plan, table moves, split bill, service charge and tips.

Switched on per POS Profile (Fine Dining section), each on its own:
* Floor Plan and Table Moves (`posa_fd_floor_plan`): the floor with live table
  status, open an order from it, move an order to another table, merge two
  tables, move items between orders, hand a table to another waiter
* Tables Need Cleaning After Payment (`posa_fd_table_cleaning`)
* Split Bill (`posa_fd_split_bill`): by seat or by item into separate orders of
  the same table; equal shares are printed on the guest check
* Service Charge (`posa_fd_service_charge`) and Tips (`posa_fd_tips`): charge
  rows on the invoice, posted to their own accounts

Items keep what the kitchen has when they move: a TRANSFER OUT ticket on the
old order and a TRANSFER IN ticket on the new one (both marked Served, never on
the kitchen display), so nothing is cooked twice and nothing needs a void.
"""

import json

import frappe
from frappe import _
from frappe.utils import cint, flt, now_datetime

from posawesome.posawesome.api.fine_dining import EPS, _check_profile_access, row_key, sent_map, settings

FLOOR_FIELDS = {
    "floor_plan": "posa_fd_floor_plan",
    "table_cleaning": "posa_fd_table_cleaning",
    "split_bill": "posa_fd_split_bill",
    "service_charge": "posa_fd_service_charge",
    "service_charge_rate": "posa_fd_service_charge_rate",
    "service_charge_account": "posa_fd_service_charge_account",
    "service_charge_min_covers": "posa_fd_service_charge_min_covers",
    "tips": "posa_fd_tips",
    "tips_account": "posa_fd_tips_account",
}
SC_LABEL = "Service Charge"
TIP_LABEL = "Tip"


def floor_settings(pos_profile):
    """Phase 2 switches; all off while fine dining is off."""
    out = frappe._dict({k: 0 for k in FLOOR_FIELDS})
    s = settings(pos_profile)
    if not s.enabled:
        return out
    meta = frappe.get_meta("POS Profile")
    fields = [f for f in FLOOR_FIELDS.values() if meta.has_field(f)]
    if not fields:
        return out
    row = frappe.db.get_value("POS Profile", pos_profile, fields, as_dict=True) or {}
    for key, field in FLOOR_FIELDS.items():
        v = row.get(field)
        out[key] = v if key.endswith("_account") else (flt(v) if key == "service_charge_rate" else cint(v))
    if not out.service_charge_account or out.service_charge_rate <= 0:
        out.service_charge = 0
    if not out.tips_account:
        out.tips = 0
    return out


# ------------------------------------------------------------------ charges (before_validate)
def apply_charges(doc, method=None):
    """Sales Invoice before_validate: the service charge and tip rows, the waiter."""
    if doc.get("is_return") or not doc.get("pos_profile") or doc.docstatus == 2:
        return
    s = settings(doc.pos_profile)
    if not s.enabled:
        return
    if doc.meta.has_field("posa_waiter") and not doc.get("posa_waiter"):
        doc.posa_waiter = doc.owner if doc.get("owner") and doc.owner != "Guest" else frappe.session.user
    if doc.docstatus == 1:
        return
    f = floor_settings(doc.pos_profile)
    # a sale made offline is uploaded as it was paid: no charge added afterwards
    if frappe.flags.get("posa_offline_sync"):
        return
    taxes = doc.get("taxes") or []
    keep = [t for t in taxes if not _is_ours(t, f)]
    changed = len(keep) != len(taxes)
    cost_center = frappe.db.get_value("POS Profile", doc.pos_profile, "cost_center")
    if f.service_charge and doc.get("posa_service_table") and cint(doc.get("posa_covers")) >= cint(f.service_charge_min_covers):
        keep.append(frappe._dict(charge_type="On Net Total", account_head=f.service_charge_account,
                                 description=_(SC_LABEL), rate=f.service_charge_rate, cost_center=cost_center,
                                 posa_fd_charge="Service Charge"))
        changed = True
    tip = flt(doc.get("posa_tip_amount")) if f.tips else 0
    if tip > 0:
        keep.append(frappe._dict(charge_type="Actual", account_head=f.tips_account, description=_(TIP_LABEL),
                                 tax_amount=tip, cost_center=cost_center, posa_fd_charge="Tip"))
        changed = True
    if changed:
        doc.set("taxes", [])
        for t in keep:
            doc.append("taxes", dict(t))


def _is_ours(t, f):
    if t.get("posa_fd_charge") in ("Service Charge", "Tip"):
        return True
    desc = (t.get("description") or "").strip()
    acc = t.get("account_head")
    return (acc and acc == f.service_charge_account and desc in (SC_LABEL, _(SC_LABEL))) or (
        acc and acc == f.tips_account and desc in (TIP_LABEL, _(TIP_LABEL)))


# ------------------------------------------------------------------ tables after payment
def other_open_orders(table, exclude=None):
    if not table:
        return []
    return frappe.get_all("Sales Invoice", filters={"posa_service_table": table, "docstatus": 0,
                                                    "name": ["!=", exclude or ""]}, pluck="name")


def table_status_after_close(doc):
    """Status of a table when one of its orders is paid or cancelled.
    Available as before, unless fine dining is on."""
    if not settings(doc.get("pos_profile")).enabled:
        return "Available"
    if other_open_orders(doc.get("posa_service_table"), doc.name):
        return "Occupied"
    f = floor_settings(doc.get("pos_profile"))
    return "Cleaning" if f.table_cleaning else "Available"


# ------------------------------------------------------------------ floor
def _profile(pos_profile):
    _check_profile_access(pos_profile)
    f = floor_settings(pos_profile)
    if not f.floor_plan:
        frappe.throw(_("Floor Plan is not enabled on POS Profile {0}").format(pos_profile))
    return f


@frappe.whitelist()
def get_floor(pos_profile):
    """Tables with their live status and open orders, the zones, and the staff."""
    _profile(pos_profile)
    company = frappe.db.get_value("POS Profile", pos_profile, "company")
    tables = frappe.get_all(
        "Service Table",
        filters={"company": company},
        fields=["name", "service_zone", "no_of_seats", "table_shape", "layout_x", "layout_y", "layout_width",
                "layout_height", "status", "is_take_away"],
        order_by="service_zone asc, name asc",
    )
    orders = frappe.get_all(
        "Sales Invoice",
        filters={"docstatus": 0, "company": company, "posa_service_table": ["!=", ""], "is_return": 0},
        fields=["name", "posa_service_table", "posa_covers", "posa_waiter", "owner", "grand_total", "rounded_total",
                "creation", "posa_prebill_count", "customer", "currency"],
        order_by="creation asc",
    )
    names = [o.name for o in orders] or [""]
    held = set(frappe.get_all("Sales Invoice Item", filters={"parent": ["in", names], "posa_course_status": "Hold"},
                              pluck="parent"))
    sent = set(frappe.get_all("Kitchen Ticket", filters={"sales_invoice": ["in", names]}, pluck="sales_invoice"))
    users = {}
    by_table = {}
    for o in orders:
        waiter = o.posa_waiter or o.owner
        if waiter not in users:
            users[waiter] = frappe.db.get_value("User", waiter, "full_name") or waiter
        if cint(o.posa_prebill_count):
            state = "Bill"
        elif o.name in held:
            state = "Waiting"
        elif o.name in sent:
            state = "Ordered"
        else:
            state = "Seated"
        by_table.setdefault(o.posa_service_table, []).append({
            "name": o.name, "covers": cint(o.posa_covers), "waiter": waiter, "waiter_name": users[waiter],
            "total": flt(o.rounded_total or o.grand_total), "currency": o.currency, "since": str(o.creation),
            "state": state, "customer": o.customer,
        })
    rank = {"Bill": 4, "Waiting": 3, "Ordered": 2, "Seated": 1}
    # fine dining phase 4: tables held for a booking that starts soon
    from posawesome.posawesome.api.fine_dining_guests import guest_settings, upcoming_by_table

    g = guest_settings(pos_profile)
    upcoming = upcoming_by_table(company, g.hold_minutes) if g.reservations else {}
    for t in tables:
        b = upcoming.get(t.name)
        t["booking"] = {"name": b.name, "guest_name": b.guest_name, "party_size": b.party_size,
                        "start": str(b.reservation_start), "status": b.status} if b else None
        t["orders"] = by_table.get(t.name, [])
        if t["orders"]:
            t["state"] = max((o["state"] for o in t["orders"]), key=lambda s: rank[s])
        elif t.status in ("Cleaning", "Disabled"):
            t["state"] = t.status
        elif t.status == "Reserved" or t["booking"]:
            t["state"] = "Reserved"
        else:
            t["state"] = "Available"
    zones = sorted({t.service_zone for t in tables if t.service_zone})
    staff = _staff(pos_profile)
    return {"tables": tables, "zones": zones, "staff": staff, "now": str(now_datetime()), "reservations": g.reservations}


def _staff(pos_profile):
    users = set(frappe.get_all("POS Profile User", filters={"parent": pos_profile}, pluck="user"))
    meta = frappe.get_meta("POS Profile")
    if meta.has_field("applicable_for_captain"):
        captain_dt = meta.get_field("applicable_for_captain").options
        if captain_dt:
            cmeta = frappe.get_meta(captain_dt)
            ufield = next((f.fieldname for f in cmeta.fields if f.fieldtype == "Link" and f.options == "User"), None)
            if ufield:
                users |= set(frappe.get_all(captain_dt, filters={"parent": pos_profile}, pluck=ufield))
    users.discard(None)
    out = []
    for u in sorted(users):
        row = frappe.db.get_value("User", u, ["full_name", "enabled"], as_dict=True)
        if row and row.enabled:
            out.append({"user": u, "full_name": row.full_name or u})
    return out


@frappe.whitelist()
def get_order(invoice):
    """An open order as the POS loads it (Resume)."""
    doc = frappe.get_doc("Sales Invoice", invoice)
    _check_profile_access(doc.pos_profile)
    if doc.docstatus != 0:
        frappe.throw(_("Order {0} is already completed").format(invoice))
    return doc.as_dict()


@frappe.whitelist()
def set_table_status(pos_profile, table, status):
    _profile(pos_profile)
    if status not in ("Available", "Cleaning", "Reserved"):
        frappe.throw(_("Unknown table status {0}").format(status))
    if other_open_orders(table) and status != "Occupied":
        frappe.throw(_("Table {0} has an open order").format(table))
    frappe.db.set_value("Service Table", table, {"status": status, "occupied": 0}, update_modified=False)
    _floor_changed(pos_profile)
    return status


def _floor_changed(pos_profile):
    frappe.publish_realtime("posa_floor_changed", {"pos_profile": pos_profile}, after_commit=True)


def _set_table(table, status):
    from posawesome.posawesome.doctype.service_table.service_table import update_service_table

    update_service_table(table, status)


def _open_draft(invoice, pos_profile=None):
    doc = frappe.get_doc("Sales Invoice", invoice)
    if doc.docstatus != 0:
        frappe.throw(_("Order {0} is already completed").format(invoice))
    if pos_profile and doc.pos_profile != pos_profile:
        frappe.throw(_("Order {0} is not for POS Profile {1}").format(invoice, pos_profile))
    doc.flags.ignore_permissions = True
    return doc


@frappe.whitelist()
def move_table(pos_profile, invoice, table):
    """Move an open order to another (free) table."""
    _profile(pos_profile)
    doc = _open_draft(invoice, pos_profile)
    old = doc.posa_service_table
    if table == old:
        return {"invoice": invoice}
    t = frappe.db.get_value("Service Table", table, ["name", "service_zone", "status", "is_take_away"], as_dict=True)
    if not t:
        frappe.throw(_("Table {0} not found").format(table))
    if t.status == "Disabled":
        frappe.throw(_("Table {0} is disabled").format(table))
    if other_open_orders(table) and not cint(t.is_take_away):
        frappe.throw(_("Table {0} already has an order: use Merge").format(table))
    doc.posa_service_table = table
    doc.posa_service_zone = t.service_zone or doc.posa_service_zone
    doc.save()
    for kt in frappe.get_all("Kitchen Ticket", filters={"sales_invoice": invoice}, pluck="name"):
        frappe.db.set_value("Kitchen Ticket", kt, "service_table", table, update_modified=False)
    _set_table(table, "Occupied")
    if old:
        # the save frees the old table; it stays occupied while it has another check
        _set_table(old, "Occupied" if other_open_orders(old) else "Available")
    _floor_changed(pos_profile)
    return {"invoice": invoice, "table": table}


@frappe.whitelist()
def set_waiter(pos_profile, invoice, user):
    """Hand a table (its open order) to another waiter: it moves to their open shift."""
    _profile(pos_profile)
    if not any(s["user"] == user for s in _staff(pos_profile)):
        frappe.throw(_("{0} is not a user of POS Profile {1}").format(user, pos_profile))
    doc = _open_draft(invoice, pos_profile)
    values = {"posa_waiter": user}
    shift = frappe.db.get_value("POS Opening Shift", {"user": user, "pos_profile": pos_profile, "status": "Open",
                                                      "docstatus": 1}, "name")
    if shift:
        values["posa_pos_opening_shift"] = shift
    frappe.db.set_value("Sales Invoice", doc.name, values)
    _floor_changed(pos_profile)
    return {"invoice": invoice, "waiter": user, "shift": shift}


# ------------------------------------------------------------------ moving items
def _new_order_like(src, table):
    """An empty open order on `table`, set up like `src`."""
    t = frappe.db.get_value("Service Table", table, ["service_zone"], as_dict=True) if table else None
    doc = frappe.new_doc("Sales Invoice")
    for f in ("company", "customer", "pos_profile", "is_pos", "currency", "selling_price_list", "price_list_currency",
              "plc_conversion_rate", "conversion_rate", "naming_series", "set_warehouse", "update_stock",
              "taxes_and_charges", "posa_pos_opening_shift", "posa_order_type", "posa_waiter", "posting_date",
              "cost_center", "ignore_pricing_rule", "posa_kot_on_each_save"):
        if doc.meta.has_field(f) and src.get(f) is not None:
            doc.set(f, src.get(f))
    doc.posa_service_table = table or src.posa_service_table
    doc.posa_service_zone = (t and t.service_zone) or src.posa_service_zone
    doc.posa_covers = 0
    if doc.meta.has_field("posa_split_from"):
        doc.posa_split_from = src.name
    doc.posa_offline_id = frappe.generate_hash(length=20)
    for p in src.get("payments") or []:
        doc.append("payments", {"mode_of_payment": p.mode_of_payment, "default": p.default, "amount": 0,
                                "account": p.account})
    doc.flags.ignore_permissions = True
    return doc


ROW_FIELDS = ("item_code", "item_name", "description", "uom", "stock_uom", "conversion_factor", "rate",
              "price_list_rate", "discount_percentage", "discount_amount", "warehouse", "batch_no", "serial_no",
              "income_account", "cost_center", "item_tax_template", "is_free_item", "posa_notes", "posa_offers",
              "posa_offer_applied", "posa_is_offer", "posa_is_replace", "posa_seat", "posa_course",
              "posa_course_status", "posa_modifiers", "posa_parent_row_id", "posa_comp", "posa_comp_reason",
              "posa_sales_person", "maximum_retail_price")


def _copy_row(row, qty, new_key):
    d = {f: row.get(f) for f in ROW_FIELDS if row.get(f) is not None}
    d["qty"] = qty
    d["stock_qty"] = qty * (flt(row.get("conversion_factor")) or 1)
    d["posa_row_id"] = new_key
    d["posa_kot_qty"] = 0
    return d


def _transfer(src, dst, lines):
    """Move rows (or part of their qty) from `src` to `dst` (both open orders).
    lines: [{row_id, qty}]. Add-ons follow their main item."""
    rows = {row_key(r): r for r in src.items}
    wanted = {}
    for l in lines:
        key, qty = l.get("row_id"), flt(l.get("qty"))
        if key not in rows:
            frappe.throw(_("Row {0} is not on order {1}").format(key, src.name))
        if qty <= EPS or qty > flt(rows[key].qty) + EPS:
            frappe.throw(_("{0}: move between 0 and {1}").format(rows[key].item_name, rows[key].qty))
        wanted[key] = qty
    for key, qty in list(wanted.items()):
        for r in src.items:
            if r.get("posa_parent_row_id") == key and row_key(r) not in wanted:
                wanted[row_key(r)] = min(flt(r.qty), qty) if qty < flt(rows[key].qty) else flt(r.qty)
    moves = []  # (src_key, dst_key, qty)
    keymap = {}
    for key, qty in wanted.items():
        r = rows[key]
        whole = abs(qty - flt(r.qty)) <= EPS
        if cint(r.get("posa_comp")) and not whole:
            frappe.throw(_("{0} is free (comp): move all of it").format(r.item_name))
        keymap[key] = key if whole else frappe.generate_hash(length=20)
    for key, qty in wanted.items():
        r = rows[key]
        d = _copy_row(r, qty, keymap[key])
        if d.get("posa_parent_row_id") in keymap:
            d["posa_parent_row_id"] = keymap[d["posa_parent_row_id"]]
        dst.append("items", d)
        moves.append((key, keymap[key], qty, r))
    keep = []
    for r in src.items:
        key = row_key(r)
        if key in wanted:
            left = flt(r.qty) - wanted[key]
            if left > EPS:
                r.qty = left
                r.stock_qty = left * (flt(r.conversion_factor) or 1)
                keep.append(r)
        else:
            keep.append(r)
    src.set("items", keep)
    return moves


def _comp_logs_follow(src, dst, moves):
    """Approved / applied comps of moved rows belong to the new order."""
    for src_key, dst_key, _qty, r in moves:
        if not cint(r.get("posa_comp")):
            continue
        for name in frappe.get_all("POS Void Log", filters={"void_type": "Comp", "row_id": src_key},
                                   or_filters=[["sales_invoice", "=", src.name], ["sale_id", "=", src.posa_offline_id]],
                                   pluck="name"):
            frappe.db.set_value("POS Void Log", name, {"sale_id": dst.posa_offline_id, "row_id": dst_key,
                                                       "sales_invoice": dst.name if dst.name and not dst.is_new() else None},
                                update_modified=False)


def _transfer_tickets(src, dst, moves):
    """TRANSFER OUT on the old order, TRANSFER IN on the new one, per kitchen unit."""
    sent = sent_map(src.name)
    per_unit = {}
    for src_key, dst_key, qty, r in moves:
        e = sent.get(src_key)
        if not e or e.qty <= EPS:
            continue
        left = min(qty, e.qty)
        for unit, uqty in reversed(list(e.units.items())):
            if left <= EPS:
                break
            take = min(left, uqty)
            if take <= EPS:
                continue
            per_unit.setdefault(unit, []).append((src_key, dst_key, take, e))
            left -= take
    for unit, rows in per_unit.items():
        for kind, doc, key_index in (("Transfer Out", src, 0), ("Transfer In", dst, 1)):
            kt = frappe.new_doc("Kitchen Ticket")
            kt.ticket_type = kind
            kt.status = "Served"
            kt.sales_invoice = doc.name
            kt.company = doc.company
            kt.posting_date = doc.posting_date
            kt.pos_profile = frappe.db.get_value("Kitchen Production Unit", unit, "pos_profile") or doc.pos_profile
            kt.kitchen_production_unit = unit
            kt.service_table = doc.get("posa_service_table")
            kt.time_created = frappe.utils.nowtime()
            for row in rows:
                e = row[3]
                kt.append("items", {
                    "item_code": e.item_code, "item_name": e.item_name, "item_group": e.item_group, "qty": row[2],
                    "uom": e.uom, "rate": e.rate, "amount": row[2] * flt(e.rate), "posa_row_id": row[key_index],
                    "posa_notes": _("Moved from {0}").format(src.name) if kind == "Transfer In" else _("Moved to {0}").format(dst.name),
                    "posa_seat": e.posa_seat, "posa_course": e.posa_course, "posa_modifiers": e.posa_modifiers,
                })
            kt.insert(ignore_permissions=True)
            kt.submit()


def _move(src, dst, lines):
    """Move lines from src to dst (dst may be new). Saves both; deletes src when empty."""
    moves = _transfer(src, dst, lines)
    is_new = dst.is_new()
    if is_new:
        dst.flags.posa_skip_kot = True
        _comp_logs_follow(src, dst, moves)
        dst.insert()
    _transfer_tickets(src, dst, moves)
    if not is_new:
        _comp_logs_follow(src, dst, moves)
        dst.save()
    if src.items:
        src.save()
        return None
    table = src.posa_service_table
    frappe.delete_doc("Sales Invoice", src.name, ignore_permissions=True, force=1)
    return table


@frappe.whitelist()
def transfer_items(pos_profile, invoice, lines, to_invoice=None, to_table=None):
    """Move items of an open order to another order, or to a new order on a table."""
    _profile(pos_profile)
    lines = json.loads(lines) if isinstance(lines, str) else (lines or [])
    src = _open_draft(invoice, pos_profile)
    if to_invoice:
        if to_invoice == invoice:
            frappe.throw(_("Choose another order"))
        dst = _open_draft(to_invoice, pos_profile)
    else:
        table = to_table or src.posa_service_table
        if not table:
            frappe.throw(_("Choose a table"))
        dst = _new_order_like(src, table)
    freed = _move(src, dst, lines)
    _set_table(dst.posa_service_table, "Occupied")
    if freed and freed != dst.posa_service_table and not other_open_orders(freed):
        _set_table(freed, "Available")
    _floor_changed(pos_profile)
    return {"invoice": invoice if not freed else None, "to_invoice": dst.name}


@frappe.whitelist()
def merge_orders(pos_profile, invoice, from_invoice):
    """Bring every item of `from_invoice` (another table) into `invoice`; guests add up."""
    _profile(pos_profile)
    dst = _open_draft(invoice, pos_profile)
    src = _open_draft(from_invoice, pos_profile)
    if src.name == dst.name:
        frappe.throw(_("Choose another table"))
    covers = cint(dst.get("posa_covers")) + cint(src.get("posa_covers"))
    lines = [{"row_id": row_key(r), "qty": r.qty} for r in src.items if not r.get("posa_parent_row_id")]
    lines += [{"row_id": row_key(r), "qty": r.qty} for r in src.items if r.get("posa_parent_row_id")]
    dst.posa_covers = covers
    freed = _move(src, dst, lines) if lines else None
    if not lines:
        freed = src.posa_service_table
        frappe.delete_doc("Sales Invoice", src.name, ignore_permissions=True, force=1)
    frappe.db.set_value("Sales Invoice", dst.name, "posa_covers", covers, update_modified=False)
    if freed and freed != dst.posa_service_table and not other_open_orders(freed):
        _set_table(freed, "Available")
    _floor_changed(pos_profile)
    return {"invoice": dst.name}


@frappe.whitelist()
def split_order(pos_profile, invoice, groups):
    """Split an order into checks on the same table. groups: [[{row_id, qty}, ...], ...];
    each group becomes a new order, what is left stays on this one."""
    _check_profile_access(pos_profile)
    f = floor_settings(pos_profile)
    if not f.split_bill:
        frappe.throw(_("Split Bill is not enabled on POS Profile {0}").format(pos_profile))
    groups = json.loads(groups) if isinstance(groups, str) else (groups or [])
    groups = [g for g in groups if g]
    if not groups:
        frappe.throw(_("Choose the items of each check"))
    created = []
    for g in groups:
        src = _open_draft(invoice, pos_profile)
        if not src.items:
            break
        dst = _new_order_like(src, src.posa_service_table)
        freed = _move(src, dst, g)
        created.append(dst.name)
        if freed:
            break
    _floor_changed(pos_profile)
    return {"invoice": invoice if frappe.db.exists("Sales Invoice", invoice) else None, "checks": created}


@frappe.whitelist()
def set_split_count(invoice, count):
    """Equal shares printed on the guest check (0 = none)."""
    pos_profile = frappe.db.get_value("Sales Invoice", invoice, "pos_profile")
    _check_profile_access(pos_profile)
    if not floor_settings(pos_profile).split_bill:
        frappe.throw(_("Split Bill is not enabled on POS Profile {0}").format(pos_profile))
    count = max(0, min(cint(count), 50))
    frappe.db.set_value("Sales Invoice", invoice, "posa_split_count", count, update_modified=False)
    return count
