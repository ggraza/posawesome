# Copyright (c) 2026, Youssef Restom and contributors
# For license information, please see license.txt
"""Supermarket shelf-edge labels (POS Profile > Supermarket > Shelf-Edge Labels).

A label is queued (POS Shelf Label Queue) when the price of an item changes in
the selling price list of a POS Profile with shelf labels on, or when an offer /
deal of such a profile starts or ends, or by hand. The Shelf Labels page prints
the queue with a POS Shelf Label Template: HTML (sheets, browser, QZ Tray) or
ZPL / TSPL (label printers through QZ Tray raw printing).

With the feature off on every profile nothing is queued: the hooks return at
once and Multi Barcode Labels works as before."""

import frappe
from frappe import _
from frappe.utils import add_days, cint, flt, getdate, now_datetime, nowdate

from posawesome.posawesome.api import supermarket as sm


# ------------------------------------------------------------------ which price lists are watched
def label_profiles():
	"""{price list: settings dict} of the POS Profiles with shelf labels on."""
	cache = getattr(frappe.local, "posa_label_profiles", None)  # v16: no frappe.local.__dict__
	if cache is not None:
		return cache
	out = {}
	if frappe.db.has_column("POS Profile", "posa_sm_shelf_labels"):
		for p in frappe.get_all(
			"POS Profile",
			filters={"disabled": 0, "posa_enable_supermarket": 1, "posa_sm_shelf_labels": 1},
			fields=[
				"name", "company", "selling_price_list", "posa_sm_label_template", "posa_sm_label_on_price",
				"posa_sm_label_on_offer", "posa_sm_label_min_change", "posa_sm_label_printer", "posa_sm_label_name2_field",
			],
			order_by="name asc",
		):
			if p.selling_price_list and p.selling_price_list not in out:
				out[p.selling_price_list] = p
	frappe.local.posa_label_profiles = out
	return out


def _clear():
	if getattr(frappe.local, "posa_label_profiles", None) is not None:
		frappe.local.posa_label_profiles = None


def _barcode(item_code, uom=None):
	rows = frappe.get_all(
		"Item Barcode", filters={"parent": item_code, "parenttype": "Item"}, fields=["barcode", "uom"], order_by="idx asc"
	)
	for r in rows:
		if uom and r.uom == uom:
			return r.barcode
	for r in rows:
		if not r.uom:
			return r.barcode
	return rows[0].barcode if rows else None


def queue(item_code, price_list=None, reason="Manual", old_price=None, new_price=None, uom=None, offer_text=None,
	valid_until=None, source=None, template=None, company=None):
	"""Add (or update) the pending label of an item / UOM / price list."""
	if not item_code:
		return None
	item = frappe.db.get_value("Item", item_code, ["item_name", "stock_uom", "disabled", "is_sales_item"], as_dict=True)
	if not item or cint(item.disabled) or not cint(item.is_sales_item):
		return None
	uom = uom or item.stock_uom
	if new_price is None and price_list:
		new_price = frappe.db.get_value(
			"Item Price", {"item_code": item_code, "price_list": price_list, "uom": ["in", [uom, "", None]]}, "price_list_rate"
		)
	prof = label_profiles().get(price_list) if price_list else None
	pending = frappe.db.get_value(
		"POS Shelf Label Queue",
		{"item_code": item_code, "uom": uom, "price_list": price_list, "status": "Pending"},
		"name",
	)
	values = {
		"item_name": item.item_name,
		"barcode": _barcode(item_code, uom),
		"reason": reason,
		"new_price": flt(new_price),
		"offer_text": offer_text,
		"valid_until": valid_until,
		"source": source,
		"template": template or (prof and prof.posa_sm_label_template) or None,
		"company": company or (prof and prof.company) or None,
	}
	if pending:
		doc = frappe.get_doc("POS Shelf Label Queue", pending)
		# keep the first old price (the price on the shelf now) and the first reason of a price change
		if doc.reason in ("Price Change", "New Price") and reason == "Manual":
			values["reason"] = doc.reason
		if doc.reason == "New Price" and reason == "Price Change":
			values["reason"] = "New Price"  # never printed: still a new price, no "was" price
		if doc.offer_text and not offer_text:
			values["offer_text"], values["valid_until"] = doc.offer_text, doc.valid_until
		doc.update(values)
	else:
		doc = frappe.get_doc(
			dict(values, doctype="POS Shelf Label Queue", item_code=item_code, uom=uom, price_list=price_list,
				old_price=flt(old_price) if old_price is not None else None, status="Pending", copies=1)
		)
	doc.flags.ignore_permissions = True
	doc.save()
	return doc.name


# ------------------------------------------------------------------ hooks
def on_item_price(doc, method=None):
	"""Item Price after_insert / on_update: a new or changed price queues a label."""
	if not cint(doc.get("selling")):
		return
	prof = label_profiles().get(doc.price_list)
	if not prof or not cint(prof.posa_sm_label_on_price):
		return
	before = doc.get_doc_before_save() if method == "on_update" else None
	if method == "on_update" and before is None:
		return  # the insert already queued it
	old = flt(before.price_list_rate) if before else None
	new = flt(doc.price_list_rate)
	if old is not None and abs(new - old) < max(flt(prof.posa_sm_label_min_change), 0.005):
		return
	queue(
		doc.item_code,
		price_list=doc.price_list,
		reason="Price Change" if old is not None else "New Price",
		old_price=old,
		new_price=new,
		uom=doc.uom or None,
		source="Item Price %s" % doc.name,
	)


def _offer_items(doc, limit=500):
	codes = []
	for fld, child_fld in (("items", "item_code"), ("offer_items", "item_code")):
		for r in doc.get(fld) or []:
			if r.get(child_fld):
				codes.append(r.get(child_fld))
	if doc.get("item"):
		codes.append(doc.item)
	groups = [r.get("item_group") for r in (doc.get("item_groups") or doc.get("offer_item_groups") or []) if r.get("item_group")]
	if doc.get("item_group"):
		groups.append(doc.item_group)
	brands = [r.get("brand") for r in (doc.get("brands") or doc.get("offer_brands") or []) if r.get("brand")]
	if doc.get("brand"):
		brands.append(doc.brand)
	if groups:
		codes += frappe.get_all("Item", filters={"item_group": ["in", groups], "disabled": 0, "is_sales_item": 1}, pluck="name",
			limit=limit)
	if brands:
		codes += frappe.get_all("Item", filters={"brand": ["in", brands], "disabled": 0, "is_sales_item": 1}, pluck="name",
			limit=limit)
	out = []
	for c in codes:
		if c not in out:
			out.append(c)
	return out[:limit]


def queue_offer_labels(today=None):
	"""Daily: offers / deals that start today or ended yesterday queue labels for
	their items in every watched price list of their profiles."""
	profiles = label_profiles()
	watched = {pl: p for pl, p in profiles.items() if cint(p.posa_sm_label_on_offer)}
	if not watched:
		return 0
	today = getdate(today or nowdate())
	yesterday = add_days(today, -1)
	n = 0
	jobs = []
	if frappe.db.exists("DocType", "POS Offer"):
		for o in frappe.get_all("POS Offer", filters={"disable": 0}, fields=["name", "title", "description", "valid_from", "valid_upto", "pos_profile", "company"]):
			if o.valid_from and getdate(o.valid_from) == today:
				jobs.append(("POS Offer", o.name, "Offer Start", o.title or o.description or o.name, o.valid_upto, o.pos_profile, o.company))
			elif o.valid_upto and getdate(o.valid_upto) == getdate(yesterday):
				jobs.append(("POS Offer", o.name, "Offer End", None, None, o.pos_profile, o.company))
	if frappe.db.exists("DocType", "POS Deal"):
		for d in frappe.get_all("POS Deal", filters={"disabled": 0}, fields=["name", "title", "valid_from", "valid_upto", "company"]):
			if d.valid_from and getdate(d.valid_from) == today:
				jobs.append(("POS Deal", d.name, "Offer Start", d.title, d.valid_upto, None, d.company))
			elif d.valid_upto and getdate(d.valid_upto) == getdate(yesterday):
				jobs.append(("POS Deal", d.name, "Offer End", None, None, None, d.company))
	for doctype, name, reason, text, until, only_profile, company in jobs:
		doc = frappe.get_doc(doctype, name)
		items = _offer_items(doc)
		for pl, p in watched.items():
			if only_profile and only_profile != p.name:
				continue
			if company and p.company and company != p.company:
				continue
			for code in items:
				if queue(code, price_list=pl, reason=reason, offer_text=text, valid_until=until, source="%s %s" % (doctype, name)):
					n += 1
	return n


@frappe.whitelist()
def labels_enabled():
	"""Item / Item Price forms show Print Shelf Label only when some POS Profile uses labels."""
	return bool(label_profiles())


# ------------------------------------------------------------------ the Shelf Labels page
def _check_access():
	if not (set(frappe.get_roles()) & {"Stock User", "Stock Manager", "Sales User", "Sales Manager", "System Manager"}):
		frappe.throw(_("Not permitted"), frappe.PermissionError)


@frappe.whitelist()
def get_queue(status="Pending", price_list=None, reason=None, item_group=None, limit=500):
	_check_access()
	if not label_profiles():
		return {"enabled": False, "rows": []}
	filters = {"status": status or "Pending"}
	if price_list:
		filters["price_list"] = price_list
	if reason:
		filters["reason"] = reason
	rows = frappe.get_all(
		"POS Shelf Label Queue",
		filters=filters,
		fields=["name", "item_code", "item_name", "uom", "barcode", "price_list", "reason", "old_price", "new_price",
			"offer_text", "valid_until", "template", "copies", "status", "printed_on", "creation"],
		order_by="creation desc",
		limit=cint(limit) or 500,
	)
	if item_group:
		in_group = set(frappe.get_all("Item", filters={"item_group": item_group, "name": ["in", [r.item_code for r in rows] or [""]]}, pluck="name"))
		rows = [r for r in rows if r.item_code in in_group]
	return {
		"enabled": True,
		"rows": rows,
		"price_lists": sorted(label_profiles().keys()),
		"templates": frappe.get_all("POS Shelf Label Template", filters={"disabled": 0}, fields=["name", "output", "label_kind"], order_by="name asc"),
		"printers": {pl: p.posa_sm_label_printer for pl, p in label_profiles().items()},
	}


@frappe.whitelist()
def add_by_code(code, price_list=None, copies=1):
	"""Scan on the page (or a handheld): the item of a barcode / item code gets a label."""
	_check_access()
	code = str(code or "").strip()
	item_code = frappe.db.get_value("Item Barcode", {"barcode": code}, "parent") or (code if frappe.db.exists("Item", code) else None)
	uom = frappe.db.get_value("Item Barcode", {"barcode": code}, "uom") if item_code and item_code != code else None
	if not item_code:
		frappe.throw(_("No item has the barcode or code {0}").format(code))
	pls = [price_list] if price_list else list(label_profiles().keys())
	if not pls:
		frappe.throw(_("Shelf-edge labels are not switched on for any POS Profile"))
	names = []
	for pl in pls:
		n = queue(item_code, price_list=pl, reason="Manual", uom=uom or None)
		if n:
			frappe.db.set_value("POS Shelf Label Queue", n, "copies", max(1, cint(copies)))
			names.append(n)
	if not names:
		frappe.throw(_("{0} is disabled or not a sales item").format(item_code))
	return names


@frappe.whitelist()
def add_items(item_codes, price_list=None):
	"""Print Shelf Label button on Item / Item Price."""
	_check_access()
	codes = frappe.parse_json(item_codes) if isinstance(item_codes, str) and item_codes.startswith("[") else [item_codes]
	pls = [price_list] if price_list and price_list in label_profiles() else list(label_profiles().keys())
	if not pls:
		frappe.throw(_("Shelf-edge labels are not switched on for any POS Profile"))
	return [n for c in codes for pl in pls for n in [queue(c, price_list=pl, reason="Manual")] if n]


@frappe.whitelist()
def set_status(names, status):
	_check_access()
	if status not in ("Pending", "Printed", "Skipped"):
		frappe.throw(_("Unknown status"))
	for n in frappe.parse_json(names) if isinstance(names, str) else names:
		values = {"status": status}
		if status == "Printed":
			values.update({"printed_on": now_datetime(), "printed_by": frappe.session.user})
		frappe.db.set_value("POS Shelf Label Queue", n, values)
	return True


def _money(v, currency):
	return frappe.utils.fmt_money(flt(v), currency=currency)


def _unit_price(item, price):
	"""Price per kg / per litre for packs with a weight (Item > Weight Per Unit)."""
	w = flt(item.get("weight_per_unit"))
	u = (item.get("weight_uom") or "").lower()
	if not w or not price:
		return None
	per = {"kg": (1, "kg"), "kilogram": (1, "kg"), "gram": (0.001, "kg"), "g": (0.001, "kg"), "litre": (1, "L"), "liter": (1, "L"),
		"l": (1, "L"), "ml": (0.001, "L"), "millilitre": (0.001, "L")}.get(u)
	if not per:
		return None
	qty = w * per[0]
	return (flt(price) / qty, per[1]) if qty else None


def label_context(row, currency, name2_field=None):
	item = frappe.db.get_value(
		"Item", row.item_code, ["item_name", "item_group", "brand", "weight_per_unit", "weight_uom", "stock_uom"], as_dict=True
	) or frappe._dict()
	mrp = None
	mrp_list = frappe.db.get_value("POS Profile", {"selling_price_list": row.price_list, "posa_sm_shelf_labels": 1}, "posa_mrp_price_list") if row.price_list else None
	if mrp_list:
		mrp = frappe.db.get_value("Item Price", {"item_code": row.item_code, "price_list": mrp_list}, "price_list_rate")
	price = flt(row.new_price)
	unit = _unit_price(item, price)
	name2 = None
	if name2_field and frappe.db.has_column("Item", name2_field):
		name2 = frappe.db.get_value("Item", row.item_code, name2_field)
	was = flt(row.old_price) if row.old_price and flt(row.old_price) > price else None
	barcode = row.barcode or row.item_code
	return frappe._dict(
		item_code=row.item_code,
		item_name=row.item_name or item.item_name or row.item_code,
		name2=name2 or "",
		uom=row.uom or item.stock_uom,
		price=price,
		price_text=_money(price, currency),
		mrp=flt(mrp) or None,
		mrp_text=_money(mrp, currency) if mrp and flt(mrp) > price else "",
		saving_text=_money(flt(mrp) - price, currency) if mrp and flt(mrp) > price else "",
		was=was,
		was_text=_money(was, currency) if was else "",
		unit_price_text=("%s / %s" % (_money(unit[0], currency), unit[1])) if unit else "",
		barcode=barcode,
		barcode_svg=sm.posa_barcode_svg(barcode, 32, 1.1),
		offer_text=row.offer_text or "",
		valid_until=frappe.utils.formatdate(row.valid_until) if row.valid_until else "",
		reason=row.reason,
		company=row.company or "",
		print_date=frappe.utils.formatdate(nowdate()),
		currency=currency,
	)


def render(names, template=None):
	"""The labels of the queue rows: {output, html | raw, printer, count}."""
	rows = [frappe.get_doc("POS Shelf Label Queue", n) for n in names]
	if not rows:
		frappe.throw(_("Choose the labels to print"))
	tname = template or rows[0].template or next(
		(p.posa_sm_label_template for p in label_profiles().values() if p.posa_sm_label_template), None
	)
	if not tname:
		frappe.throw(_("Choose a label template"))
	t = frappe.get_cached_doc("POS Shelf Label Template", tname)
	labels = []
	printer = None
	for r in rows:
		prof = label_profiles().get(r.price_list) or frappe._dict()
		printer = printer or prof.get("posa_sm_label_printer")
		currency = frappe.db.get_value("Price List", r.price_list, "currency") if r.price_list else None
		ctx = label_context(r, currency or frappe.db.get_default("currency"), prof.get("posa_sm_label_name2_field"))
		if t.output != "HTML":
			ctx = raw_safe(ctx)
		body = frappe.render_template(t.body, {"doc": ctx, **ctx})
		labels += [body] * max(1, cint(r.copies))
	out = {"output": t.output, "template": t.name, "printer": printer, "count": len(labels)}
	if t.output == "HTML":
		out["html"] = sheet_html(t, labels)
	else:
		out["raw"] = labels
	return out


@frappe.whitelist()
def render_labels(names, template=None):
	_check_access()
	return render(frappe.parse_json(names) if isinstance(names, str) else names, template)


def raw_safe(ctx):
	"""Text for ZPL / TSPL: no command characters (^ ~ in ZPL, quotes in TSPL), no SVG."""
	out = frappe._dict(ctx)
	for k, v in ctx.items():
		if isinstance(v, str):
			out[k] = v.replace("^", " ").replace("~", " ").replace('"', "'").replace("\n", " ").replace("\r", " ")
	out.barcode_svg = ""
	return out


def sheet_html(t, labels):
	w, h = flt(t.width_mm) or 58, flt(t.height_mm) or 38
	cols = max(1, cint(t.columns) or 1)
	rows = cint(t.rows)
	page = {"A4": "A4", "Letter": "letter"}.get(t.page_size)
	per_page = cols * rows if rows else 1
	pages = []
	for k in range(0, len(labels), per_page):
		cells = "".join('<div class="lbl">%s</div>' % b for b in labels[k : k + per_page])
		pages.append('<div class="sheet">%s</div>' % cells)
	size = page or "%smm %smm" % (w, h)
	css = (
		"@page { size: %s; margin: %s; }\n"
		"body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #000; }\n"
		".sheet { display: grid; grid-template-columns: repeat(%d, %smm); grid-auto-rows: %smm; gap: 0; page-break-after: always; }\n"
		".sheet:last-child { page-break-after: auto; }\n"
		".lbl { width: %smm; height: %smm; overflow: hidden; box-sizing: border-box; position: relative; }\n"
		% (size, "6mm 4mm" if page else "0", cols, w, h, w, h)
	)
	return '<!DOCTYPE html><html><head><meta charset="utf-8"><style>%s\n%s</style></head><body>%s</body></html>' % (
		css, t.css or "", "".join(pages)
	)


# ------------------------------------------------------------------ standard templates
STD_HTML_CSS = """.sl { height: 100%; padding: 1.5mm 2mm; box-sizing: border-box; border: 0.2mm solid #999; display: flex; flex-direction: column; }
.sl-name { font-size: 11px; font-weight: bold; line-height: 1.15; max-height: 26px; overflow: hidden; }
.sl-name2 { font-size: 11px; direction: rtl; text-align: right; line-height: 1.1; }
.sl-mid { display: flex; justify-content: space-between; align-items: flex-end; margin-top: auto; }
.sl-price { font-size: 22px; font-weight: 800; line-height: 1; }
.sl-small { font-size: 8px; line-height: 1.2; }
.sl-was { text-decoration: line-through; }
.sl-bc svg { height: 24px; width: auto; max-width: 100%; }
.sl-offer { background: #ffeb3b; }
.sl-offer .sl-tag { background: #d50000; color: #fff; font-weight: bold; font-size: 10px; text-align: center; margin: -1.5mm -2mm 1mm; padding: 0.4mm 0; }"""

STD_HTML = """<div class="sl{% if offer_text %} sl-offer{% endif %}">
  {% if offer_text %}<div class="sl-tag">{{ offer_text }}{% if valid_until %} · {{ _("until") }} {{ valid_until }}{% endif %}</div>{% endif %}
  <div class="sl-name">{{ item_name }}</div>
  {% if name2 %}<div class="sl-name2">{{ name2 }}</div>{% endif %}
  <div class="sl-mid">
    <div>
      {% if was_text %}<div class="sl-small sl-was">{{ _("Was") }} {{ was_text }}</div>{% endif %}
      {% if mrp_text %}<div class="sl-small">{{ _("MRP") }} {{ mrp_text }} · {{ _("Save") }} {{ saving_text }}</div>{% endif %}
      {% if unit_price_text %}<div class="sl-small">{{ unit_price_text }}</div>{% endif %}
      <div class="sl-bc">{{ barcode_svg }}</div>
    </div>
    <div class="sl-price">{{ price_text }}</div>
  </div>
  <div class="sl-small">{{ item_code }} · {{ uom }} · {{ print_date }}</div>
</div>"""

STD_ZPL = """^XA
^CI28
^PW464
^LL304
^FO16,12^A0N,28,26^FB432,2,0,L^FD{{ item_name[:60] }}^FS
{% if offer_text %}^FO16,76^GB432,30,30^FS^FO20,80^A0N,24,22^FR^FD{{ offer_text[:34] }}^FS{% endif %}
^FO16,{{ 112 if offer_text else 84 }}^A0N,70,60^FD{{ price_text }}^FS
{% if was_text %}^FO300,{{ 120 if offer_text else 92 }}^A0N,22,20^FD{{ _("Was") }} {{ was_text }}^FS{% endif %}
{% if unit_price_text %}^FO300,{{ 146 if offer_text else 118 }}^A0N,20,18^FD{{ unit_price_text }}^FS{% endif %}
^FO16,196^BY2^BCN,60,Y,N,N^FD{{ barcode }}^FS
^FO330,270^A0N,18,16^FD{{ print_date }}^FS
^XZ
"""

STD_TSPL = """SIZE 58 mm, 38 mm
GAP 2 mm, 0 mm
DIRECTION 1
CLS
TEXT 16,12,"3",0,1,1,"{{ item_name[:30] }}"
{% if offer_text %}BAR 16,44,432,28
REVERSE 16,44,432,28
TEXT 20,48,"2",0,1,1,"{{ offer_text[:34] }}"{% endif %}
TEXT 16,{{ 80 if offer_text else 52 }},"5",0,1,1,"{{ price_text }}"
{% if was_text %}TEXT 300,{{ 88 if offer_text else 60 }},"2",0,1,1,"{{ _("Was") }} {{ was_text }}"{% endif %}
BARCODE 16,180,"128",56,1,0,2,2,"{{ barcode }}"
TEXT 330,270,"1",0,1,1,"{{ print_date }}"
PRINT 1,1
"""

STANDARD_TEMPLATES = [
	{"template_name": "Shelf 58x38", "output": "HTML", "label_kind": "Standard", "width_mm": 58, "height_mm": 38, "columns": 1, "rows": 0,
		"page_size": "Label", "body": STD_HTML, "css": STD_HTML_CSS},
	{"template_name": "A4 Sheet 3x8", "output": "HTML", "label_kind": "Sheet", "width_mm": 66, "height_mm": 34, "columns": 3, "rows": 8,
		"page_size": "A4", "body": STD_HTML, "css": STD_HTML_CSS},
	{"template_name": "Zebra ZPL 58x38", "output": "ZPL", "label_kind": "Standard", "width_mm": 58, "height_mm": 38, "columns": 1,
		"rows": 0, "page_size": "Label", "body": STD_ZPL},
	{"template_name": "TSC TSPL 58x38", "output": "TSPL", "label_kind": "Standard", "width_mm": 58, "height_mm": 38, "columns": 1,
		"rows": 0, "page_size": "Label", "body": STD_TSPL},
]


def ensure_templates():
	"""The standard templates, the first time shelf labels are switched on."""
	for t in STANDARD_TEMPLATES:
		if not frappe.db.exists("POS Shelf Label Template", t["template_name"]):
			frappe.get_doc(dict(t, doctype="POS Shelf Label Template")).insert(ignore_permissions=True)


# ------------------------------------------------------------------ report: labels vs till price
def label_check_report(filters):
	columns = [
		{"fieldname": "item_code", "label": _("Item"), "fieldtype": "Link", "options": "Item", "width": 140},
		{"fieldname": "item_name", "label": _("Item Name"), "fieldtype": "Data", "width": 220},
		{"fieldname": "price_list", "label": _("Price List"), "fieldtype": "Link", "options": "Price List", "width": 130},
		{"fieldname": "till_price", "label": _("Till Price"), "fieldtype": "Currency", "width": 100},
		{"fieldname": "label_price", "label": _("Label Price"), "fieldtype": "Currency", "width": 100},
		{"fieldname": "printed_on", "label": _("Label Printed"), "fieldtype": "Datetime", "width": 150},
		{"fieldname": "state", "label": _("State"), "fieldtype": "Data", "width": 130},
	]
	pls = [filters.get("price_list")] if filters.get("price_list") else list(label_profiles().keys())
	data = []
	show = filters.get("show") or "Wrong or Missing"
	for pl in pls:
		f = {"price_list": pl, "selling": 1}
		prices = frappe.get_all("Item Price", filters=f, fields=["item_code", "uom", "price_list_rate"])
		if filters.get("item_group"):
			keep = set(frappe.get_all("Item", filters={"item_group": filters["item_group"]}, pluck="name"))
			prices = [p for p in prices if p.item_code in keep]
		printed = {}
		for q in frappe.get_all(
			"POS Shelf Label Queue",
			filters={"price_list": pl, "status": "Printed"},
			fields=["item_code", "new_price", "printed_on"],
			order_by="printed_on asc",
		):
			printed[q.item_code] = q
		names = {r.name: r.item_name for r in frappe.get_all("Item", filters={"name": ["in", [p.item_code for p in prices] or [""]]}, fields=["name", "item_name"])}
		for p in prices:
			last = printed.get(p.item_code)
			if not last:
				state = _("Never Printed")
			elif abs(flt(last.new_price) - flt(p.price_list_rate)) > 0.005:
				state = _("Wrong Price")
			else:
				state = _("OK")
			if show == "Wrong or Missing" and state == _("OK"):
				continue
			if show == "Wrong Price" and state != _("Wrong Price"):
				continue
			if show == "Never Printed" and state != _("Never Printed"):
				continue
			data.append({
				"item_code": p.item_code, "item_name": names.get(p.item_code), "price_list": pl, "till_price": p.price_list_rate,
				"label_price": last.new_price if last else None, "printed_on": last.printed_on if last else None, "state": state,
			})
	return columns, data
