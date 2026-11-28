# -*- coding: utf-8 -*-
# Copyright (c) 2021, Youssef Restom and contributors
# For license information, please see license.txt


import json

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt, getdate, now, nowdate

# apply_on -> (single Link field, Table MultiSelect field, link field in the row)
TARGETS = {
	"Item Code": ("item", "offer_items", "item_code"),
	"Item Group": ("item_group", "offer_item_groups", "item_group"),
	"Brand": ("brand", "offer_brands", "brand"),
}


class POSOffer(Document):
	def validate(self):
		self.sync_targets()
		self.validate_recursive()
		self.fill_item_details()

	def validate_recursive(self):
		"""Repeat For Every Min Quantity: buy 10 get 1, buy 20 get 2, ..."""
		if not self.meta.has_field("is_recursive"):
			return
		if not self.is_recursive:
			self.max_given_qty = 0
			return
		if self.offer != "Give Product":
			self.is_recursive = 0
			self.max_given_qty = 0
			return
		if self.replace_item or self.replace_cheapest_item:
			frappe.throw(
				_("Repeat For Every Min Quantity cannot be used with Replace Same Item or Replace Cheapest Item.")
			)
		if flt(self.min_qty) <= 0:
			frappe.throw(_("Set Min Quantity: the free quantity repeats for every Min Quantity."))
		if flt(self.max_given_qty) < 0:
			self.max_given_qty = 0

	def default_price_lists(self):
		if not self.meta.has_field("sale_price_list"):
			return
		profile = {}
		if self.pos_profile:
			profile = frappe.db.get_value(
				"POS Profile", self.pos_profile, ["selling_price_list", "posa_mrp_price_list"], as_dict=True
			) if frappe.get_meta("POS Profile").has_field("posa_mrp_price_list") else frappe.db.get_value(
				"POS Profile", self.pos_profile, ["selling_price_list"], as_dict=True
			)
			profile = profile or {}
		if not self.sale_price_list:
			self.sale_price_list = profile.get("selling_price_list") or frappe.db.get_single_value(
				"Selling Settings", "selling_price_list"
			)
		if not self.mrp_price_list and profile.get("posa_mrp_price_list"):
			self.mrp_price_list = profile.get("posa_mrp_price_list")
		if not self.buying_price_list:
			self.buying_price_list = frappe.db.get_single_value("Buying Settings", "buying_price_list")

	def fill_item_details(self):
		"""Rates and margins on the item rows, for the person making the offer."""
		self.default_price_lists()
		if not self.meta.has_field("offer_items") or not self.get("offer_items"):
			return
		details = item_details(self.as_dict(), [{"item_code": r.item_code, "uom": r.uom} for r in self.offer_items])
		for row, info in zip(self.offer_items, details):
			row.update(info)

	def sync_targets(self):
		"""The lists are what the cashier edits. The old single field keeps
		the first value of its list, so older code that reads `item`,
		`item_group` or `brand` still works."""
		for apply_on, (single, table, link) in TARGETS.items():
			if not self.meta.has_field(table):
				continue
			rows = self.get(table) or []
			# An offer made before the lists existed, or by an import that
			# only fills the single field.
			if not rows and self.get(single):
				self.append(table, {link: self.get(single)})
				rows = self.get(table)
			seen, keep = set(), []
			for row in rows:
				value = row.get(link)
				if value and value not in seen:
					seen.add(value)
					keep.append(row)
			for i, row in enumerate(keep, 1):
				row.idx = i
			self.set(table, keep)
			self.set(single, keep[0].get(link) if keep else None)
			if self.apply_on == apply_on and not keep:
				frappe.throw(
					_("Add at least one {0} to apply this offer on.").format(_(apply_on))
				)


def targets(offer):
	"""Values the offer applies to, for its apply_on."""
	single, table, link = TARGETS.get(offer.get("apply_on"), (None, None, None))
	if not single:
		return []
	values = [r.get(link) for r in (offer.get(table) or []) if r.get(link)]
	if not values and offer.get(single):
		values = [offer.get(single)]
	return values


def attach_targets(rows):
	"""Add offer_items / offer_item_groups / offer_brands to offer rows read
	with frappe.get_all or SQL (they carry no child rows)."""
	if not rows:
		return rows
	names = [r["name"] for r in rows]
	children = {}
	for apply_on, (single, table, link) in TARGETS.items():
		if not frappe.get_meta("POS Offer").has_field(table):
			continue
		child = frappe.get_meta("POS Offer").get_field(table).options
		for c in frappe.get_all(
			child,
			filters={"parent": ["in", names], "parenttype": "POS Offer", "parentfield": table},
			fields=["parent", link],
			order_by="idx asc",
			ignore_permissions=True,
		):
			children.setdefault((c.parent, table), []).append({link: c.get(link)})
	for r in rows:
		for apply_on, (single, table, link) in TARGETS.items():
			r[table] = children.get((r["name"], table), [])
			if not r[table] and r.get(single):
				r[table] = [{link: r.get(single)}]
	return rows


def _move_group_rows():
	"""The item group list first used the shared "Item Group MultiSelect"
	child; it now has its own table, like Pricing Rule. Move rows saved
	with the first version across."""
	if not (frappe.db.table_exists("POS Offer Item Group") and frappe.db.table_exists("Item Group MultiSelect")):
		return
	rows = frappe.get_all(
		"Item Group MultiSelect",
		filters={"parenttype": "POS Offer", "parentfield": "offer_item_groups"},
		fields=["name", "parent", "idx", "item_group"],
		order_by="parent asc, idx asc",
		ignore_permissions=True,
	)
	if not rows:
		return
	have = {
		(r.parent, r.item_group)
		for r in frappe.get_all(
			"POS Offer Item Group",
			filters={"parent": ["in", list({r.parent for r in rows})]},
			fields=["parent", "item_group"],
			ignore_permissions=True,
		)
	}
	for r in rows:
		if (r.parent, r.item_group) in have:
			continue
		row = frappe.new_doc("POS Offer Item Group")
		row.update({
			"name": r.name,
			"parent": r.parent,
			"parenttype": "POS Offer",
			"parentfield": "offer_item_groups",
			"idx": r.idx,
			"item_group": r.item_group,
		})
		row.db_insert()
	frappe.db.delete("Item Group MultiSelect", {"parenttype": "POS Offer", "parentfield": "offer_item_groups"})
	# Changed offers reach the offline tills on their next sync.
	for parent in {r.parent for r in rows}:
		frappe.db.set_value("POS Offer", parent, "modified", now(), update_modified=False)


def copy_single_targets():
	"""after_migrate: fill the lists of offers made before they existed."""
	if not frappe.get_meta("POS Offer").has_field("offer_items"):
		return
	_move_group_rows()
	for name in frappe.get_all("POS Offer", pluck="name"):
		doc = frappe.get_doc("POS Offer", name)
		single, table, link = TARGETS.get(doc.apply_on, (None, None, None))
		if not single or doc.get(table) or not doc.get(single):
			continue
		try:
			doc.append(table, {link: doc.get(single)})
			doc.flags.ignore_mandatory = True
			doc.flags.ignore_permissions = True
			doc.save()
		except Exception:
			frappe.log_error(frappe.get_traceback(), "POS Offer: copy {0}".format(name))
	frappe.db.commit()


# ---------------------------------------------------------------------------
# Item details: Current TP, MRP, sale rate, margins before and after the offer
# ---------------------------------------------------------------------------

DETAIL_FIELDS = (
	"item_name", "barcode", "uom", "conversion_factor", "buying_rate", "mrp", "sale_rate",
	"valuation_rate", "gp_rate", "gp_percent", "discount_value", "discounted_price",
	"after_disc_gp", "after_disc_gp_percent",
)
PREVIEW_LIMIT = 1000


def _price_map(price_list, codes):
	"""{item_code: [Item Price rows valid today]} for one price list."""
	if not price_list or not codes:
		return {}
	today = getdate(nowdate())
	out = {}
	for p in frappe.get_all(
		"Item Price",
		filters={"price_list": price_list, "item_code": ["in", codes]},
		fields=["item_code", "uom", "price_list_rate", "valid_from", "valid_upto", "customer", "batch_no"],
		order_by="valid_from asc",
		ignore_permissions=True,
	):
		if p.get("customer") or p.get("batch_no"):
			continue
		if p.valid_from and getdate(p.valid_from) > today:
			continue
		if p.valid_upto and getdate(p.valid_upto) < today:
			continue
		out.setdefault(p.item_code, []).append(p)
	return out


def _rate(rows, uom, stock_uom, factor):
	"""Rate for `uom`: a price kept for that UOM, else the stock UOM price
	times the packing. The latest valid_from wins."""
	rows = rows or []
	exact = [r for r in rows if (r.uom or stock_uom) == uom]
	if exact:
		return flt(exact[-1].price_list_rate)
	stock = [r for r in rows if (r.uom or stock_uom) == stock_uom]
	if stock:
		return flt(stock[-1].price_list_rate) * flt(factor or 1)
	return 0.0


def _offer_discount(offer, sale_rate):
	"""Discount per unit that the offer gives on the item itself."""
	if offer.get("offer") not in ("Item Price", "Grand Total"):
		return 0.0
	kind = offer.get("discount_type")
	if kind == "Discount Percentage":
		return sale_rate * flt(offer.get("discount_percentage")) / 100.0
	if kind == "Discount Amount" and offer.get("offer") == "Item Price":
		return min(flt(offer.get("discount_amount")), sale_rate)
	if kind == "Rate" and offer.get("offer") == "Item Price" and sale_rate:
		return max(0.0, sale_rate - flt(offer.get("rate")))
	return 0.0


def _pct(part, base):
	return flt(part / base * 100.0, 3) if base else 0.0


def item_details(offer, rows):
	"""Details for rows [{item_code, uom}] of an offer (a dict). GP % is on
	the Current TP (cost)."""
	offer = frappe._dict(offer or {})
	codes = list({r.get("item_code") for r in rows if r.get("item_code")})
	if not codes:
		return [{} for _ in rows]
	items = {
		i.name: i
		for i in frappe.get_all(
			"Item",
			filters={"name": ["in", codes]},
			fields=["name", "item_name", "stock_uom", "valuation_rate"],
			ignore_permissions=True,
		)
	}
	factors = {}
	for u in frappe.get_all(
		"UOM Conversion Detail",
		filters={"parent": ["in", codes], "parenttype": "Item"},
		fields=["parent", "uom", "conversion_factor"],
		ignore_permissions=True,
	):
		factors[(u.parent, u.uom)] = flt(u.conversion_factor)
	barcode_fields = ["parent", "barcode"]
	if frappe.get_meta("Item Barcode").has_field("posa_uom"):
		barcode_fields.append("posa_uom")
	barcodes = {}
	for b in frappe.get_all(
		"Item Barcode",
		filters={"parent": ["in", codes], "parenttype": "Item"},
		fields=barcode_fields,
		order_by="idx asc",
		ignore_permissions=True,
	):
		barcodes.setdefault(b.parent, []).append(b)
	bins = {}
	bin_filters = {"item_code": ["in", codes]}
	if offer.get("warehouse"):
		bin_filters["warehouse"] = offer.get("warehouse")
	for b in frappe.get_all(
		"Bin", filters=bin_filters, fields=["item_code", "valuation_rate"], ignore_permissions=True
	):
		if flt(b.valuation_rate):
			bins.setdefault(b.item_code, []).append(flt(b.valuation_rate))
	buying = _price_map(offer.get("buying_price_list"), codes)
	mrp = _price_map(offer.get("mrp_price_list"), codes)
	sale = _price_map(offer.get("sale_price_list"), codes)

	out = []
	for r in rows:
		item = items.get(r.get("item_code"))
		if not item:
			out.append({})
			continue
		uom = r.get("uom") or item.stock_uom
		factor = 1.0 if uom == item.stock_uom else factors.get((item.name, uom)) or 1.0
		codes_for_item = barcodes.get(item.name, [])
		barcode = next((b.barcode for b in codes_for_item if b.get("posa_uom") == uom), None) or next(
			(b.barcode for b in codes_for_item if not b.get("posa_uom")), None
		) or (codes_for_item[0].barcode if codes_for_item else "")
		vals = bins.get(item.name)
		valuation = (sum(vals) / len(vals) if vals else flt(item.valuation_rate)) * factor
		tp = _rate(buying.get(item.name), uom, item.stock_uom, factor)
		sale_rate = _rate(sale.get(item.name), uom, item.stock_uom, factor)
		disc = _offer_discount(offer, sale_rate)
		price = sale_rate - disc
		out.append({
			"item_name": item.item_name,
			"barcode": barcode,
			"uom": uom,
			"conversion_factor": factor,
			"buying_rate": tp,
			"mrp": _rate(mrp.get(item.name), uom, item.stock_uom, factor),
			"sale_rate": sale_rate,
			"valuation_rate": flt(valuation, 3),
			"gp_rate": flt(sale_rate - tp, 3) if tp else 0.0,
			"gp_percent": _pct(sale_rate - tp, tp),
			"discount_value": flt(disc, 3),
			"discounted_price": flt(price, 3),
			"after_disc_gp": flt(price - tp, 3) if tp else 0.0,
			"after_disc_gp_percent": _pct(price - tp, tp),
		})
	return out


def _load(doc):
	return frappe._dict(json.loads(doc) if isinstance(doc, str) else (doc or {}))


@frappe.whitelist()
def get_item_details(doc, rows):
	"""Form: details for item rows [{item_code, uom}] as the offer stands."""
	frappe.has_permission("POS Offer", "read", throw=True)
	rows = json.loads(rows) if isinstance(rows, str) else rows
	return item_details(_load(doc), rows or [])


@frappe.whitelist()
def preview_items(doc):
	"""Form popup: every item the offer applies to, with its details."""
	frappe.has_permission("POS Offer", "read", throw=True)
	offer = _load(doc)
	values = targets(offer)
	if not values:
		return {"rows": [], "total": 0}
	if offer.apply_on == "Item Code":
		rows = [{"item_code": r.get("item_code"), "uom": r.get("uom")} for r in (offer.get("offer_items") or []) if r.get("item_code")]
		if not rows:
			rows = [{"item_code": v} for v in values]
		total = len(rows)
	else:
		field = "item_group" if offer.apply_on == "Item Group" else "brand"
		filters = {field: ["in", values], "disabled": 0, "is_sales_item": 1, "has_variants": 0}
		total = frappe.db.count("Item", filters)
		rows = [
			{"item_code": n}
			for n in frappe.get_all("Item", filters=filters, pluck="name", order_by="item_name asc", limit=PREVIEW_LIMIT)
		]
	details = item_details(offer, rows)
	for row, info in zip(rows, details):
		row.update(info)
	return {"rows": [r for r in rows if r.get("item_name")], "total": total}
