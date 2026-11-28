# Copyright (c) 2026, Youssef Restom and contributors
# For license information, please see license.txt
"""Supermarket store work (POS Profile > Supermarket > Store): stock count from a
handheld, goods receiving of a Purchase Order, stock requests and the low-stock
list. Each is checked against its own checkbox of the POS Profile."""

import frappe
from frappe import _
from frappe.utils import cint, flt, nowdate

from posawesome.posawesome.api import supermarket as sm


def _profile(pos_profile, flag):
	s = sm.settings(pos_profile)
	if not s.get(flag):
		frappe.throw(_("This is not switched on for POS Profile {0}").format(pos_profile))
	p = frappe.get_cached_doc("POS Profile", pos_profile)
	if not p.warehouse:
		frappe.throw(_("POS Profile {0} has no warehouse").format(pos_profile))
	return s, p


def _roles(*need):
	if not (set(frappe.get_roles()) & set(need + ("System Manager",))):
		frappe.throw(_("Not permitted"), frappe.PermissionError)


def resolve_code(code):
	"""Barcode / item code -> (item_code, uom, conversion factor)."""
	code = str(code or "").strip()
	if not code:
		return None
	bc = frappe.db.get_value("Item Barcode", {"barcode": code}, ["parent", "uom"], as_dict=True)
	if bc:
		item_code, uom = bc.parent, bc.uom
	elif frappe.db.exists("Item", code):
		item_code, uom = code, None
	else:
		return None
	item = frappe.db.get_value("Item", item_code, ["item_name", "stock_uom", "is_stock_item", "disabled"], as_dict=True)
	if not item or cint(item.disabled):
		return None
	cf = 1.0
	if uom and uom != item.stock_uom:
		cf = flt(frappe.db.get_value("UOM Conversion Detail", {"parent": item_code, "uom": uom}, "conversion_factor")) or 1.0
	return frappe._dict(item_code=item_code, item_name=item.item_name, uom=uom or item.stock_uom, stock_uom=item.stock_uom,
		conversion_factor=cf, is_stock_item=cint(item.is_stock_item))


@frappe.whitelist()
def setup(pos_profile):
	"""What the Stock Count and Receiving page may do for this profile."""
	if not (set(frappe.get_roles()) & {"Stock User", "Stock Manager", "System Manager"}):
		sm._check_profile_user(pos_profile)
	s = sm.settings(pos_profile)
	p = frappe.get_cached_doc("POS Profile", pos_profile)
	return {"stock_count": bool(s.stock_count), "blind": bool(s.blind_count), "receiving": bool(s.store_receiving),
		"warehouse": p.warehouse, "company": p.company}


@frappe.whitelist()
def lookup(pos_profile, code):
	"""A scanned code on the page: item, UOM and (when not blind) the stock."""
	_roles("Stock User", "Stock Manager", "Sales Manager")
	s = sm.settings(pos_profile)
	r = resolve_code(code)
	if not r:
		frappe.throw(_("No item has the barcode or code {0}").format(code))
	p = frappe.get_cached_doc("POS Profile", pos_profile)
	if not s.blind_count:
		r.actual_qty = flt(frappe.db.get_value("Bin", {"item_code": r.item_code, "warehouse": p.warehouse}, "actual_qty"))
	return r


@frappe.whitelist()
def make_stock_count(pos_profile, rows, remarks=None):
	"""Counted rows [{item_code, qty (in stock UOM)}] -> a draft Stock Reconciliation
	of the profile's warehouse (a manager checks and submits it)."""
	_roles("Stock User", "Stock Manager")
	s, p = _profile(pos_profile, "stock_count")
	rows = frappe.parse_json(rows) if isinstance(rows, str) else rows
	totals = {}
	unknown = []
	for r in rows or []:
		code = r.get("item_code")
		cf = 1.0
		if not code and r.get("code"):
			# scanned while offline: resolved now
			found = resolve_code(r.get("code"))
			if not found:
				unknown.append(r.get("code"))
				continue
			code, cf = found.item_code, flt(found.conversion_factor) or 1.0
		if not code:
			continue
		totals[code] = totals.get(code, 0.0) + flt(r.get("qty")) * cf
	if unknown:
		frappe.throw(_("Unknown codes (remove or fix them): {0}").format(", ".join(unknown)))
	if not totals:
		frappe.throw(_("Nothing counted"))
	items = []
	for code, qty in totals.items():
		if qty < 0:
			frappe.throw(_("{0}: the count cannot be below 0").format(code))
		if not cint(frappe.db.get_value("Item", code, "is_stock_item")):
			continue
		items.append({"item_code": code, "warehouse": p.warehouse, "qty": qty})
	if not items:
		frappe.throw(_("No stock items in the count"))
	doc = frappe.get_doc(
		{
			"doctype": "Stock Reconciliation",
			"company": p.company,
			"purpose": "Stock Reconciliation",
			"posting_date": nowdate(),
			"set_posting_time": 0,
			"items": items,
			"remarks": (remarks or "") + "\n" + _("Counted on the handheld by {0} ({1})").format(frappe.session.user, pos_profile),
		}
	)
	doc.flags.ignore_permissions = True
	doc.insert()
	return doc.name


@frappe.whitelist()
def open_purchase_orders(pos_profile, supplier=None):
	_roles("Stock User", "Stock Manager")
	s, p = _profile(pos_profile, "store_receiving")
	filters = {"docstatus": 1, "company": p.company, "status": ["in", ["To Receive and Bill", "To Receive"]]}
	if supplier:
		filters["supplier"] = supplier
	return frappe.get_all("Purchase Order", filters=filters, fields=["name", "supplier", "transaction_date", "per_received", "set_warehouse"],
		order_by="transaction_date desc", limit=100)


@frappe.whitelist()
def purchase_order_lines(pos_profile, purchase_order):
	_roles("Stock User", "Stock Manager")
	_profile(pos_profile, "store_receiving")
	po = frappe.get_doc("Purchase Order", purchase_order)
	if po.docstatus != 1:
		frappe.throw(_("{0} is not submitted").format(purchase_order))
	return [
		{"name": r.name, "item_code": r.item_code, "item_name": r.item_name, "uom": r.uom, "stock_uom": r.stock_uom,
			"conversion_factor": flt(r.conversion_factor) or 1, "ordered": flt(r.qty), "received": flt(r.received_qty),
			"to_receive": max(0.0, flt(r.qty) - flt(r.received_qty))}
		for r in po.items
	]


def receiving_lines(po_lines, counted):
	"""Match counted stock qty per item to the PO lines. Returns (lines with
	qty in the line's UOM, extras {item_code: stock qty not on the order}, short)."""
	left = {k: flt(v) for k, v in counted.items()}
	out = []
	for line in po_lines:
		have = left.get(line["item_code"], 0.0)
		cf = flt(line.get("conversion_factor")) or 1.0
		want_stock = flt(line["to_receive"]) * cf
		take = min(have, want_stock)
		left[line["item_code"]] = have - take
		out.append(dict(line, receive=round(take / cf, 6), short=round(max(0.0, want_stock - take) / cf, 6)))
	extras = {k: round(v, 6) for k, v in left.items() if v > 1e-9}
	return out, extras


@frappe.whitelist()
def make_purchase_receipt(pos_profile, purchase_order, counted):
	"""Counted stock qty per item -> a draft Purchase Receipt of the order
	(only what came; shortages stay open on the order)."""
	_roles("Stock User", "Stock Manager")
	s, p = _profile(pos_profile, "store_receiving")
	counted = frappe.parse_json(counted) if isinstance(counted, str) else counted
	lines = purchase_order_lines(pos_profile, purchase_order)
	matched, extras = receiving_lines(lines, counted or {})
	if not any(m["receive"] > 0 for m in matched):
		frappe.throw(_("Nothing scanned belongs to {0}").format(purchase_order))
	from erpnext.buying.doctype.purchase_order.purchase_order import make_purchase_receipt as _make_pr

	pr = _make_pr(purchase_order)
	by_line = {m["name"]: m for m in matched}
	keep = []
	for row in pr.items:
		m = by_line.get(row.purchase_order_item)
		if not m or m["receive"] <= 0:
			continue
		cf = flt(row.conversion_factor) or 1.0
		row.qty = m["receive"]
		row.received_qty = m["receive"]
		row.rejected_qty = 0
		row.stock_qty = flt(m["receive"]) * cf
		if row.meta.has_field("received_stock_qty"):
			row.received_stock_qty = flt(m["receive"]) * cf
		row.warehouse = row.warehouse or p.warehouse
		keep.append(row)
	pr.set("items", keep)
	pr.remarks = _("Received on the handheld by {0}").format(frappe.session.user)
	pr.flags.ignore_permissions = True
	pr.insert()
	return {"purchase_receipt": pr.name, "short": [m for m in matched if m["short"] > 0], "extras": extras}


@frappe.whitelist()
def make_transfer_request(pos_profile, items, remarks=None):
	"""Menu > Request Stock on the till: a Material Request (transfer) to this
	profile's warehouse, from the warehouse set on the profile."""
	sm._check_profile_user(pos_profile)
	s, p = _profile(pos_profile, "transfer_request")
	items = frappe.parse_json(items) if isinstance(items, str) else items
	src = frappe.db.get_value("POS Profile", pos_profile, "posa_sm_transfer_from")
	rows = []
	for it in items or []:
		r = resolve_code(it.get("code") or it.get("item_code"))
		if not r:
			frappe.throw(_("No item has the barcode or code {0}").format(it.get("code") or it.get("item_code")))
		if flt(it.get("qty")) <= 0:
			frappe.throw(_("{0}: enter the quantity").format(r.item_name))
		rows.append({"item_code": r.item_code, "qty": flt(it.get("qty")), "uom": r.uom, "conversion_factor": r.conversion_factor,
			"warehouse": p.warehouse, "from_warehouse": src, "schedule_date": nowdate()})
	if not rows:
		frappe.throw(_("Add the items to request"))
	mr = frappe.get_doc({
		"doctype": "Material Request", "material_request_type": "Material Transfer", "company": p.company,
		"transaction_date": nowdate(), "schedule_date": nowdate(), "set_warehouse": p.warehouse, "set_from_warehouse": src,
		"items": rows, "remarks": remarks or _("Requested from the till {0}").format(pos_profile),
	})
	mr.flags.ignore_permissions = True
	mr.insert()
	return mr.name


@frappe.whitelist()
def low_stock(pos_profile, limit=200):
	"""Items of the profile's warehouse at or below their re-order level."""
	sm._check_profile_user(pos_profile)
	s, p = _profile(pos_profile, "low_stock")
	rows = frappe.db.sql(
		"""select r.parent as item_code, i.item_name, i.stock_uom, r.warehouse_reorder_level as level,
			r.warehouse_reorder_qty as reorder_qty, coalesce(b.actual_qty, 0) as actual_qty
		from `tabItem Reorder` r
		join `tabItem` i on i.name = r.parent and i.disabled = 0
		left join `tabBin` b on b.item_code = r.parent and b.warehouse = r.warehouse
		where r.parenttype = 'Item' and r.warehouse = %s and coalesce(b.actual_qty, 0) <= r.warehouse_reorder_level
		order by (coalesce(b.actual_qty, 0) - r.warehouse_reorder_level) asc
		limit %s""",
		(p.warehouse, cint(limit) or 200),
		as_dict=True,
	)
	return rows
