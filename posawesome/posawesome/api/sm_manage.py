# Copyright (c) 2026, Youssef Restom and contributors
# For license information, please see license.txt
"""Supermarket phase 6: management (POS Profile > Supermarket > Management).

Till Monitor (tills report every minute), Manager Dashboard, and the reports
POS Loss Prevention, POS Offer Effectiveness and POS Fast and Slow Movers.
Each covers only the POS Profiles where its checkbox is ticked."""

import json
import re

import frappe
from frappe import _
from frappe.utils import add_days, cint, flt, get_datetime, getdate, now_datetime, nowdate

from posawesome.posawesome.api import supermarket as sm

MANAGERS = {"System Manager", "Sales Manager", "Accounts Manager"}
LIVE_SECONDS = 180  # a till that reported in the last 3 minutes is live
DEVICE_RE = re.compile(r"^[A-Za-z0-9_-]{6,40}$")


# ------------------------------------------------------------------ helpers
def profiles_with(flag, pos_profile=None, company=None):
	"""Enabled POS Profiles with the master switch and this feature on."""
	field = "posa_sm_" + flag
	if not frappe.db.has_column("POS Profile", field):
		return []
	filters = {"disabled": 0, "posa_enable_supermarket": 1, field: 1}
	if company:
		filters["company"] = company
	names = frappe.get_all("POS Profile", filters=filters, pluck="name", order_by="name asc")
	if pos_profile:
		names = [n for n in names if n == pos_profile]
	return names


def _check_manager():
	if not (set(frappe.get_roles()) & MANAGERS):
		frappe.throw(_("Only managers can see this"), frappe.PermissionError)


def _in(values):
	return ", ".join(["%s"] * len(values))


# ------------------------------------------------------------------ till monitor
@frappe.whitelist()
def till_heartbeat(pos_profile, device_id, terminal=None, pos_opening_shift=None, pending=0, failed=0,
	last_sync=None, version=None):
	"""Every minute from a till with Till Monitor on."""
	sm._check_profile_user(pos_profile)
	if not sm.settings(pos_profile).till_monitor:
		return {"ok": False}
	device_id = str(device_id or "")
	if not DEVICE_RE.match(device_id):
		frappe.throw(_("Bad till id"))
	values = {
		"pos_profile": pos_profile,
		"company": frappe.get_cached_value("POS Profile", pos_profile, "company"),
		"user": frappe.session.user,
		"pos_opening_shift": pos_opening_shift if pos_opening_shift and frappe.db.exists("POS Opening Shift", pos_opening_shift) else None,
		"last_seen": now_datetime(),
		"offline_pending": max(0, cint(pending)),
		"offline_failed": max(0, cint(failed)),
		"last_sync": _dt(last_sync),
		"app_version": str(version or "")[:40],
		"ip": (getattr(frappe.local, "request_ip", None) or "")[:60],
		"browser": (frappe.get_request_header("User-Agent") or "")[:140] if getattr(frappe.local, "request", None) else "",
	}
	name = frappe.db.get_value("POS Till Status", {"device_id": device_id}, "name")
	if name:
		frappe.db.set_value("POS Till Status", name, values, update_modified=False)
	else:
		doc = frappe.get_doc(dict(values, doctype="POS Till Status", device_id=device_id,
			till_name=("Till " + str(terminal))[:40] if terminal else "Till " + device_id[:6]))
		doc.insert(ignore_permissions=True)
		name = doc.name
	return {"ok": True, "name": name}


def _dt(v):
	if not v:
		return None
	try:
		d = get_datetime(str(v).replace("T", " ").replace("Z", "")[:19])
		return d
	except Exception:
		return None


def till_state(row, now=None):
	now = now or now_datetime()
	seen = get_datetime(row.get("last_seen")) if row.get("last_seen") else None
	if seen and (now - seen).total_seconds() <= LIVE_SECONDS:
		return "Live"
	if row.get("offline_pending"):
		return "Offline (invoices waiting)"
	return "Not Reporting"


def shift_sales(shifts):
	"""{shift: {sales, invoices, returns, last_sale}} of submitted POS sales."""
	shifts = [s for s in shifts if s]
	if not shifts:
		return {}
	rows = frappe.db.sql(
		"""select posa_pos_opening_shift as shift,
			sum(case when is_return = 0 then base_grand_total else 0 end) as sales,
			sum(case when is_return = 0 then 1 else 0 end) as invoices,
			sum(case when is_return = 1 then base_grand_total else 0 end) as returns,
			max(timestamp(posting_date, posting_time)) as last_sale
		from `tabSales Invoice`
		where docstatus = 1 and posa_pos_opening_shift in ({})
		group by posa_pos_opening_shift""".format(_in(shifts)),
		tuple(shifts),
		as_dict=True,
	)
	return {r.shift: r for r in rows}


@frappe.whitelist()
def till_monitor(company=None, pos_profile=None):
	_check_manager()
	profiles = profiles_with("till_monitor", pos_profile, company)
	if not profiles:
		return {"enabled": False, "rows": []}
	tills = frappe.get_all(
		"POS Till Status",
		filters={"pos_profile": ["in", profiles], "disabled": 0},
		fields=["name", "till_name", "device_id", "pos_profile", "user", "pos_opening_shift", "last_seen",
			"offline_pending", "offline_failed", "last_sync", "app_version", "ip"],
		order_by="till_name asc",
	)
	open_shifts = frappe.get_all(
		"POS Opening Shift",
		filters={"pos_profile": ["in", profiles], "status": "Open", "docstatus": 1},
		fields=["name", "pos_profile", "user", "period_start_date"],
	)
	shift_info = {s.name: s for s in open_shifts}
	now = now_datetime()
	rows = []
	seen_shifts = set()
	for t in tills:
		sh = t.pos_opening_shift if t.pos_opening_shift in shift_info else None
		if sh:
			seen_shifts.add(sh)
		rows.append(dict(t, state=till_state(t, now), shift_open=bool(sh),
			shift_start=shift_info[sh].period_start_date if sh else None))
	# open shifts whose till never reported (old version, monitor just switched on)
	for s in open_shifts:
		if s.name not in seen_shifts:
			rows.append({"name": None, "till_name": _("(no report)"), "pos_profile": s.pos_profile, "user": s.user,
				"pos_opening_shift": s.name, "shift_open": True, "shift_start": s.period_start_date,
				"state": "Not Reporting", "offline_pending": None, "offline_failed": None})
	sales = shift_sales([r.get("pos_opening_shift") for r in rows])
	for r in rows:
		s = sales.get(r.get("pos_opening_shift")) or {}
		r["sales"] = flt(s.get("sales")) if r.get("shift_open") else None
		r["invoices"] = cint(s.get("invoices")) if r.get("shift_open") else None
		r["last_sale"] = s.get("last_sale") if r.get("shift_open") else None
		r["user_name"] = frappe.utils.get_fullname(r["user"]) if r.get("user") else ""
	order = {"Offline (invoices waiting)": 0, "Not Reporting": 1, "Live": 2}
	rows.sort(key=lambda r: (order.get(r["state"], 3), r.get("till_name") or ""))
	return {"enabled": True, "rows": rows, "now": str(now), "live_seconds": LIVE_SECONDS}


# ------------------------------------------------------------------ dashboard
@frappe.whitelist()
def dashboard(date=None, pos_profile=None, company=None):
	_check_manager()
	profiles = profiles_with("dashboard", pos_profile, company)
	if not profiles:
		return {"enabled": False}
	date = str(getdate(date or nowdate()))
	args = tuple([date] + profiles)
	base = "from `tabSales Invoice` si where si.docstatus = 1 and si.posting_date = %s and si.pos_profile in ({})".format(_in(profiles))
	head = frappe.db.sql(
		"""select
			sum(case when si.is_return = 0 then si.base_net_total else 0 end) as net_sales,
			sum(case when si.is_return = 0 then si.base_grand_total else 0 end) as gross_sales,
			sum(case when si.is_return = 0 then 1 else 0 end) as invoices,
			sum(case when si.is_return = 1 then 1 else 0 end) as returns,
			sum(case when si.is_return = 1 then -si.base_grand_total else 0 end) as returns_amount,
			sum(case when si.is_return = 0 then si.base_discount_amount else 0 end) as bill_discounts
		""" + base,
		args,
		as_dict=True,
	)[0]
	items = frappe.db.sql(
		"""select sum(sii.qty) as qty,
			sum(case when sii.price_list_rate > sii.rate then (sii.price_list_rate - sii.rate) * sii.qty else 0 end) as item_discounts
		from `tabSales Invoice Item` sii join `tabSales Invoice` si on si.name = sii.parent
		where si.docstatus = 1 and si.is_return = 0 and si.posting_date = %s and si.pos_profile in ({})""".format(_in(profiles)),
		args,
		as_dict=True,
	)[0]
	invoices = cint(head.invoices)
	kpi = {
		"net_sales": flt(head.net_sales),
		"gross_sales": flt(head.gross_sales),
		"invoices": invoices,
		"basket": flt(head.gross_sales) / invoices if invoices else 0,
		"items_per_basket": flt(items.qty) / invoices if invoices else 0,
		"returns": cint(head.returns),
		"returns_amount": flt(head.returns_amount),
		"discounts": flt(head.bill_discounts) + flt(items.item_discounts),
	}
	voids = frappe.db.sql(
		"""select void_type, count(*) as n, sum(amount) as amount from `tabPOS Void Log`
		where date(creation) = %s and pos_profile in ({}) group by void_type""".format(_in(profiles)),
		args,
		as_dict=True,
	)
	kpi["voids"] = sum(cint(v.n) for v in voids)
	kpi["void_amount"] = sum(flt(v.amount) for v in voids)
	kpi["no_sales"] = cint(frappe.db.sql(
		"select count(*) from `tabPOS Drawer Log` where date(opened_on) = %s and pos_profile in ({})".format(_in(profiles)), args)[0][0])
	hourly = frappe.db.sql(
		"""select hour(si.posting_time) as hour, sum(si.base_grand_total) as sales, count(*) as invoices
		""" + base + " and si.is_return = 0 group by hour(si.posting_time) order by hour",
		args,
		as_dict=True,
	)
	by_hour = {cint(h.hour): h for h in hourly}
	first = min(list(by_hour) + [8])
	last = max(list(by_hour) + [min(23, now_datetime().hour if date == nowdate() else 22)])
	kpi_hours = [{"hour": h, "sales": flt((by_hour.get(h) or {}).get("sales")), "invoices": cint((by_hour.get(h) or {}).get("invoices"))}
		for h in range(first, last + 1)]
	cashiers = frappe.db.sql(
		"""select si.owner as user, si.pos_profile, count(*) as invoices, sum(si.base_grand_total) as sales
		""" + base + " and si.is_return = 0 group by si.owner, si.pos_profile order by sales desc",
		args,
		as_dict=True,
	)
	for c in cashiers:
		c["user_name"] = frappe.utils.get_fullname(c.user)
		c["basket"] = flt(c.sales) / cint(c.invoices) if cint(c.invoices) else 0
	tills = frappe.db.sql(
		"""select si.pos_profile, count(*) as invoices, sum(si.base_grand_total) as sales
		""" + base + " and si.is_return = 0 group by si.pos_profile order by sales desc",
		args,
		as_dict=True,
	)
	top = frappe.db.sql(
		"""select sii.item_code, max(sii.item_name) as item_name, sum(sii.stock_qty) as qty, sum(sii.base_net_amount) as amount
		from `tabSales Invoice Item` sii join `tabSales Invoice` si on si.name = sii.parent
		where si.docstatus = 1 and si.is_return = 0 and si.posting_date = %s and si.pos_profile in ({})
		group by sii.item_code order by amount desc limit 10""".format(_in(profiles)),
		args,
		as_dict=True,
	)
	return {"enabled": True, "date": date, "profiles": profiles, "kpi": kpi, "hours": kpi_hours, "cashiers": cashiers,
		"tills": tills, "top_items": top, "voids": voids,
		"currency": frappe.get_cached_value("Company", frappe.get_cached_value("POS Profile", profiles[0], "company"), "default_currency")}


# ------------------------------------------------------------------ report: loss prevention
LOSS_COLUMNS = [
	("key", "Cashier", "Data", 170),
	("pos_profile", "POS Profile", "Link:POS Profile", 120),
	("sales", "Sales", "Currency", 110),
	("invoices", "Invoices", "Int", 80),
	("line_voids", "Line Voids", "Int", 85),
	("cart_voids", "Cart Voids", "Int", 85),
	("other_voids", "Kitchen Voids / Comps", "Int", 110),
	("void_amount", "Void Amount", "Currency", 105),
	("void_rate", "Void %", "Percent", 75),
	("no_sales", "No Sales", "Int", 75),
	("price_overrides", "Price Overrides", "Int", 100),
	("discount_approvals", "Discount Approvals", "Int", 115),
	("refused", "Refused Approvals", "Int", 110),
	("offline_approvals", "Offline (Not Checked)", "Int", 120),
	("returns", "Returns", "Int", 75),
	("return_amount", "Return Amount", "Currency", 110),
	("return_rate", "Return %", "Percent", 80),
	("flags", "Look At", "Data", 220),
]


def _cols(spec):
	out = []
	for fieldname, label, ft, width in spec:
		col = {"fieldname": fieldname, "label": _(label), "width": width}
		if ":" in ft:
			col["fieldtype"], col["options"] = ft.split(":", 1)
		else:
			col["fieldtype"] = ft
		out.append(col)
	return out


def _dates(filters, default_days=7):
	to_date = str(getdate(filters.get("to_date") or nowdate()))
	from_date = str(getdate(filters.get("from_date") or add_days(to_date, -(default_days - 1))))
	if from_date > to_date:
		frappe.throw(_("From Date is after To Date"))
	return from_date, to_date


def loss_report(filters):
	filters = frappe._dict(filters or {})
	profiles = profiles_with("loss_reports", filters.get("pos_profile"), filters.get("company"))
	if not profiles:
		frappe.msgprint(_("Tick Loss-Prevention Report on a POS Profile (Supermarket > Management)."))
		return _cols(LOSS_COLUMNS), []
	from_date, to_date = _dates(filters)
	by_shift = filters.get("group_by") == "Shift"
	void_limit = flt(filters.get("void_limit") or 2)
	return_limit = flt(filters.get("return_limit") or 5)
	args = tuple([from_date, to_date] + profiles)
	pin = _in(profiles)
	rows = {}

	def row(user, shift, profile):
		key = (shift or _("(no shift)")) if by_shift else (user or "?")
		r = rows.get(key)
		if r is None:
			r = rows[key] = frappe._dict({c[0]: 0 for c in LOSS_COLUMNS})
			r.key = key
			r.pos_profile = profile
			r.user = user
		return r

	user_f = filters.get("user")
	for s in frappe.db.sql(
		"""select owner, posa_pos_opening_shift as shift, pos_profile, is_return, base_grand_total
		from `tabSales Invoice` where docstatus = 1 and posting_date between %s and %s and pos_profile in ({})""".format(pin),
		args,
		as_dict=True,
	):
		if user_f and s.owner != user_f:
			continue
		r = row(s.owner, s.shift, s.pos_profile)
		if cint(s.is_return):
			r.returns += 1
			r.return_amount += -flt(s.base_grand_total)
		else:
			r.invoices += 1
			r.sales += flt(s.base_grand_total)
	for v in frappe.db.sql(
		"""select void_type, coalesce(requested_by, owner) as user, pos_opening_shift as shift, pos_profile, amount
		from `tabPOS Void Log` where date(creation) between %s and %s and pos_profile in ({})""".format(pin),
		args,
		as_dict=True,
	):
		if user_f and v.user != user_f:
			continue
		r = row(v.user, v.shift, v.pos_profile)
		if v.void_type == "Line Void":
			r.line_voids += 1
		elif v.void_type == "Cart Void":
			r.cart_voids += 1
		else:
			r.other_voids += 1
		r.void_amount += flt(v.amount)
	for d in frappe.db.sql(
		"""select user, pos_opening_shift as shift, pos_profile from `tabPOS Drawer Log`
		where date(opened_on) between %s and %s and pos_profile in ({})""".format(pin),
		args,
		as_dict=True,
	):
		if user_f and d.user != user_f:
			continue
		row(d.user, d.shift, d.pos_profile).no_sales += 1
	for a in frappe.db.sql(
		"""select action, status, requested_by as user, pos_opening_shift as shift, pos_profile from `tabPOS Approval Log`
		where date(creation) between %s and %s and pos_profile in ({})""".format(pin),
		args,
		as_dict=True,
	):
		if user_f and a.user != user_f:
			continue
		r = row(a.user, a.shift, a.pos_profile)
		if a.status == "Refused":
			r.refused += 1
			continue
		if a.status == "Offline":
			r.offline_approvals += 1
		if a.action == "Price Override":
			r.price_overrides += 1
		elif a.action == "Discount":
			r.discount_approvals += 1
	data = []
	for r in rows.values():
		r.void_rate = round(100.0 * r.void_amount / r.sales, 2) if r.sales else (100.0 if r.void_amount else 0)
		r.return_rate = round(100.0 * r.return_amount / r.sales, 2) if r.sales else (100.0 if r.return_amount else 0)
		flags = []
		if r.void_rate > void_limit:
			flags.append(_("voids {0}%").format(r.void_rate))
		if r.return_rate > return_limit:
			flags.append(_("returns {0}%").format(r.return_rate))
		if r.refused >= 3:
			flags.append(_("{0} refused").format(r.refused))
		if r.no_sales >= 5:
			flags.append(_("{0} No Sales").format(r.no_sales))
		if r.offline_approvals:
			flags.append(_("{0} offline approvals").format(r.offline_approvals))
		r.flags = ", ".join(flags)
		if not by_shift and r.user:
			r.key = "%s (%s)" % (frappe.utils.get_fullname(r.user), r.user) if frappe.utils.get_fullname(r.user) != r.user else r.user
		data.append(r)
	data.sort(key=lambda r: (-len(r.flags), -r.void_amount, r.key))
	cols = _cols(LOSS_COLUMNS)
	if by_shift:
		cols[0] = {"fieldname": "key", "label": _("Shift"), "fieldtype": "Link", "options": "POS Opening Shift", "width": 170}
	return cols, data


# ------------------------------------------------------------------ report: offer effectiveness
OFFER_COLUMNS = [
	("kind", "Kind", "Data", 105),
	("promotion", "Promotion", "Dynamic Link:doctype", 170),
	("title", "Title", "Data", 190),
	("invoices", "Sales", "Int", 70),
	("qty", "Qty", "Float", 75),
	("sales", "Sales Amount", "Currency", 115),
	("discount", "Discount Given", "Currency", 115),
	("margin", "Margin", "Currency", 105),
	("margin_pct", "Margin %", "Percent", 80),
	("qty_per_day", "Items' Qty / Day", "Float", 105),
	("qty_per_day_before", "Same Items / Day Before", "Float", 140),
	("uplift", "Change %", "Percent", 85),
	("doctype", "Document Type", "Data", 0),
]


def _json_list(v):
	if not v:
		return []
	try:
		out = json.loads(v) if isinstance(v, str) else v
		return out if isinstance(out, list) else []
	except Exception:
		return []


def offer_report(filters):
	filters = frappe._dict(filters or {})
	profiles = profiles_with("offer_reports", filters.get("pos_profile"), filters.get("company"))
	if not profiles:
		frappe.msgprint(_("Tick Offer Effectiveness Report on a POS Profile (Supermarket > Management)."))
		return _cols(OFFER_COLUMNS), []
	from_date, to_date = _dates(filters, 14)
	days = (getdate(to_date) - getdate(from_date)).days + 1
	before_from, before_to = str(add_days(from_date, -days)), str(add_days(from_date, -1))
	pin = _in(profiles)
	args = tuple([from_date, to_date] + profiles)
	lines = frappe.db.sql(
		"""select sii.parent, sii.item_code, sii.qty, sii.stock_qty, sii.base_net_amount, sii.price_list_rate, sii.rate,
			sii.incoming_rate, sii.posa_offers, sii.posa_sm_deal, sii.posa_sm_markdown
		from `tabSales Invoice Item` sii join `tabSales Invoice` si on si.name = sii.parent
		where si.docstatus = 1 and si.is_return = 0 and si.posting_date between %s and %s and si.pos_profile in ({})""".format(pin),
		args,
		as_dict=True,
	)
	parents = sorted({l.parent for l in lines})
	offer_rows = {}
	if parents:
		for o in frappe.db.sql(
			"""select parent, row_id, offer_name from `tabPOS Offer Detail`
			where parenttype = 'Sales Invoice' and parent in ({}) and offer_applied = 1""".format(_in(parents)),
			tuple(parents),
			as_dict=True,
		):
			offer_rows[(o.parent, o.row_id)] = o.offer_name
	md_codes = sorted({l.posa_sm_markdown for l in lines if l.posa_sm_markdown})
	md_of = {}
	if md_codes and frappe.db.exists("DocType", "POS Markdown Label"):
		for m in frappe.db.sql(
			"select code, parent from `tabPOS Markdown Label` where code in ({})".format(_in(md_codes)), tuple(md_codes), as_dict=True
		):
			md_of[m.code] = m.parent
	promos = {}

	def add(key, doctype, name, line):
		p = promos.get(key)
		if p is None:
			p = promos[key] = frappe._dict(kind=key[0], doctype=doctype, promotion=name, invoices=set(), qty=0.0, sales=0.0,
				discount=0.0, cost=0.0, item_set=set())
		p.invoices.add(line.parent)
		p.qty += flt(line.qty)
		p.sales += flt(line.base_net_amount)
		if flt(line.price_list_rate) > flt(line.rate):
			p.discount += (flt(line.price_list_rate) - flt(line.rate)) * flt(line.qty)
		p.cost += flt(line.incoming_rate) * flt(line.stock_qty or line.qty)
		p.item_set.add(line.item_code)

	for l in lines:
		for rid in _json_list(l.posa_offers):
			name = offer_rows.get((l.parent, str(rid)))
			if name:
				add(("POS Offer", name), "POS Offer", name, l)
		if l.posa_sm_deal:
			add(("Deal", l.posa_sm_deal), "POS Deal", l.posa_sm_deal, l)
		if l.posa_sm_markdown:
			md = md_of.get(l.posa_sm_markdown)
			if md:
				add(("Reduced Label", md), "POS Markdown", md, l)

	def item_qty(items, start, end):
		if not items:
			return 0.0
		items = sorted(items)
		return flt(frappe.db.sql(
			"""select sum(sii.stock_qty) from `tabSales Invoice Item` sii join `tabSales Invoice` si on si.name = sii.parent
			where si.docstatus = 1 and si.is_return = 0 and si.posting_date between %s and %s and si.pos_profile in ({})
			and sii.item_code in ({})""".format(pin, _in(items)),
			tuple([start, end] + profiles + items),
		)[0][0])

	data = []
	for p in promos.values():
		title = None
		if p.doctype == "POS Offer":
			title = frappe.db.get_value("POS Offer", p.promotion, "title")
		elif p.doctype == "POS Deal":
			title = frappe.db.get_value("POS Deal", p.promotion, "title")
		elif p.doctype == "POS Markdown":
			title = frappe.db.get_value("POS Markdown", p.promotion, "item_name") or frappe.db.get_value("POS Markdown", p.promotion, "item_code")
		during = item_qty(p.item_set, from_date, to_date) / days
		before = item_qty(p.item_set, before_from, before_to) / days
		margin = p.sales - p.cost
		data.append({
			"kind": p.kind, "doctype": p.doctype, "promotion": p.promotion, "title": title or p.promotion,
			"invoices": len(p.invoices), "qty": round(p.qty, 3), "sales": round(p.sales, 2), "discount": round(p.discount, 2),
			"margin": round(margin, 2), "margin_pct": round(100.0 * margin / p.sales, 2) if p.sales else 0,
			"qty_per_day": round(during, 3), "qty_per_day_before": round(before, 3),
			"uplift": round(100.0 * (during - before) / before, 1) if before else None,
		})
	data.sort(key=lambda r: -r["sales"])
	return _cols(OFFER_COLUMNS), data


# ------------------------------------------------------------------ report: fast / slow movers
MOVER_COLUMNS = [
	("item_code", "Item", "Link:Item", 130),
	("item_name", "Item Name", "Data", 200),
	("item_group", "Item Group", "Link:Item Group", 120),
	("class", "Class", "Data", 70),
	("qty", "Sold Qty", "Float", 85),
	("sales", "Sales", "Currency", 105),
	("per_day", "Per Day", "Float", 75),
	("stock", "Stock", "Float", 80),
	("stock_value", "Stock Value", "Currency", 105),
	("days_of_stock", "Days of Stock", "Float", 95),
	("last_sold", "Last Sold", "Date", 95),
	("days_since", "Days Since Sold", "Int", 100),
]


def classify(rows, slow_days, fast_share=0.8):
	"""Fast: the best sellers that together make fast_share of the quantity;
	Dead: stock but no sale for slow_days (or never); Slow: the rest."""
	sold = sorted([r for r in rows if r["qty"] > 0], key=lambda r: -r["qty"])
	total = sum(r["qty"] for r in sold)
	run = 0.0
	fast = set()
	for r in sold:
		if total and run < fast_share * total:
			fast.add(r["item_code"])
		run += r["qty"]
	for r in rows:
		if r["item_code"] in fast:
			r["class"] = "Fast"
		elif r["stock"] > 0 and (r["days_since"] is None or r["days_since"] >= slow_days):
			r["class"] = "Dead"
		else:
			r["class"] = "Slow"
	return rows


def movers_report(filters):
	filters = frappe._dict(filters or {})
	profiles = profiles_with("movers", filters.get("pos_profile"), filters.get("company"))
	if not profiles:
		frappe.msgprint(_("Tick Fast / Slow Movers Report on a POS Profile (Supermarket > Management)."))
		return _cols(MOVER_COLUMNS), []
	days = max(1, cint(filters.get("days") or 30))
	to_date = str(getdate(filters.get("to_date") or nowdate()))
	from_date = str(add_days(to_date, -(days - 1)))
	warehouses = sorted({w for w in (frappe.get_cached_value("POS Profile", p, "warehouse") for p in profiles) if w})
	slow_days = max(cint(frappe.get_cached_value("POS Profile", profiles[0], "posa_sm_slow_days") or 60), 1)
	if filters.get("slow_days"):
		slow_days = max(1, cint(filters.slow_days))
	pin = _in(profiles)
	sold = {r.item_code: r for r in frappe.db.sql(
		"""select sii.item_code, sum(sii.stock_qty) as qty, sum(sii.base_net_amount) as sales
		from `tabSales Invoice Item` sii join `tabSales Invoice` si on si.name = sii.parent
		where si.docstatus = 1 and si.posting_date between %s and %s and si.pos_profile in ({})
		group by sii.item_code""".format(pin),
		tuple([from_date, to_date] + profiles),
		as_dict=True,
	)}
	stock = {}
	if warehouses:
		for b in frappe.db.sql(
			"""select item_code, sum(actual_qty) as qty, sum(stock_value) as value from `tabBin`
			where warehouse in ({}) group by item_code""".format(_in(warehouses)),
			tuple(warehouses),
			as_dict=True,
		):
			stock[b.item_code] = b
	codes = sorted(set(sold) | {c for c, b in stock.items() if flt(b.qty) > 0})
	if not codes:
		return _cols(MOVER_COLUMNS), []
	last = {}
	since = str(add_days(to_date, -max(slow_days, days) * 3))
	for chunk in range(0, len(codes), 1000):
		part = codes[chunk : chunk + 1000]
		for r in frappe.db.sql(
			"""select sii.item_code, max(si.posting_date) as last_sold
			from `tabSales Invoice Item` sii join `tabSales Invoice` si on si.name = sii.parent
			where si.docstatus = 1 and si.is_return = 0 and si.posting_date between %s and %s and si.pos_profile in ({})
			and sii.item_code in ({}) group by sii.item_code""".format(pin, _in(part)),
			tuple([since, to_date] + profiles + part),
			as_dict=True,
		):
			last[r.item_code] = r.last_sold
	info = {}
	for chunk in range(0, len(codes), 1000):
		part = codes[chunk : chunk + 1000]
		for i in frappe.get_all("Item", filters={"name": ["in", part]}, fields=["name", "item_name", "item_group", "disabled", "is_stock_item"]):
			info[i.name] = i
	group = filters.get("item_group")
	rows = []
	today = getdate(to_date)
	for c in codes:
		i = info.get(c)
		if not i or (group and i.item_group != group):
			continue
		q = flt((sold.get(c) or {}).get("qty"))
		st = flt((stock.get(c) or {}).get("qty"))
		per_day = q / days
		ls = last.get(c)
		rows.append({
			"item_code": c, "item_name": i.item_name, "item_group": i.item_group,
			"qty": round(q, 3), "sales": round(flt((sold.get(c) or {}).get("sales")), 2), "per_day": round(per_day, 3),
			"stock": round(st, 3), "stock_value": round(flt((stock.get(c) or {}).get("value")), 2),
			"days_of_stock": round(st / per_day, 1) if per_day > 0 and st > 0 else None,
			"last_sold": ls, "days_since": (today - getdate(ls)).days if ls else None,
		})
	classify(rows, slow_days)
	show = filters.get("show") or "All"
	if show != "All":
		rows = [r for r in rows if r["class"] == show]
	rank = {"Fast": 0, "Slow": 1, "Dead": 2}
	rows.sort(key=lambda r: (rank[r["class"]], -r["qty"], -r["stock_value"]))
	return _cols(MOVER_COLUMNS), rows
