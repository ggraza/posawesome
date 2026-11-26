# Copyright (c) 2026, Youssef Restom and contributors
# For license information, please see license.txt
"""Fine dining per day: guests, average bill per guest, table time, kitchen
time, voids, comps, service charge, tips, bookings and guest ratings."""

import frappe
from frappe import _
from frappe.utils import cint, flt, get_datetime, getdate, time_diff_in_seconds


def _cols():
    c = lambda f, l, t="Float", w=110, **k: dict(fieldname=f, label=_(l), fieldtype=t, width=w, **k)
    return [
        c("date", "Date", "Date", 100), c("orders", "Orders", "Int", 80), c("covers", "Guests", "Int", 80),
        c("net_sales", "Net Sales", "Currency"), c("per_guest", "Per Guest", "Currency"),
        c("table_minutes", "Avg Table Minutes", "Float", 130, precision=0),
        c("kitchen_minutes", "Avg Kitchen Minutes", "Float", 140, precision=0),
        c("voids", "Voids", "Int", 70), c("void_amount", "Void Amount", "Currency"),
        c("comps", "Comps", "Int", 70), c("comp_amount", "Comp Amount", "Currency"),
        c("service_charge", "Service Charge", "Currency"), c("tips", "Tips", "Currency"),
        c("bookings", "Bookings", "Int", 90), c("no_shows", "No Shows", "Int", 90),
        c("rating", "Avg Rating (of 5)", "Float", 120, precision=1),
    ]


def execute(filters=None):
    f = frappe._dict(filters or {})
    days = {}

    def day(d):
        d = getdate(d)
        return days.setdefault(d, frappe._dict(date=d, orders=0, covers=0, net_sales=0, table_secs=[], kitchen_secs=[],
                                               voids=0, void_amount=0, comps=0, comp_amount=0, service_charge=0,
                                               tips=0, bookings=0, no_shows=0, ratings=[]))

    cond = {"docstatus": 1, "is_return": 0, "posa_service_table": ["!=", ""]}
    rng = ["between", [f.from_date, f.to_date]] if f.from_date and f.to_date else None
    if f.company:
        cond["company"] = f.company
    if f.pos_profile:
        cond["pos_profile"] = f.pos_profile
    if rng:
        cond["posting_date"] = rng
    inv = frappe.get_all("Sales Invoice", filters=cond,
                         fields=["name", "posting_date", "posa_covers", "net_total", "posa_tip_amount", "creation", "modified"])
    names = [i.name for i in inv]
    for i in inv:
        d = day(i.posting_date)
        d.orders += 1
        d.covers += cint(i.posa_covers)
        d.net_sales += flt(i.net_total)
        d.tips += flt(i.posa_tip_amount)
        secs = time_diff_in_seconds(i.modified, i.creation)
        if 0 < secs < 12 * 3600:
            d.table_secs.append(secs)
    by_inv = {i.name: i for i in inv}
    if names:
        for r in frappe.get_all("Sales Taxes and Charges",
                                filters={"parenttype": "Sales Invoice", "parent": ["in", names], "posa_fd_charge": "Service Charge"},
                                fields=["parent", "tax_amount"]):
            day(by_inv[r.parent].posting_date).service_charge += flt(r.tax_amount)
        for t in frappe.get_all("Kitchen Ticket", filters={"sales_invoice": ["in", names], "docstatus": 1},
                                fields=["sales_invoice", "posting_date", "time_created", "time_ready", "ticket_type"]):
            if (t.ticket_type or "Order") != "Order" or not t.time_created or not t.time_ready:
                continue
            secs = (get_datetime("2000-01-01 %s" % t.time_ready) - get_datetime("2000-01-01 %s" % t.time_created)).total_seconds()
            if 0 < secs < 4 * 3600:
                day(by_inv[t.sales_invoice].posting_date).kitchen_secs.append(secs)
    lc = {"status": ["in", ["Applied", "Offline"]]}
    if f.pos_profile:
        lc["pos_profile"] = f.pos_profile
    if rng:
        lc["creation"] = ["between", [f.from_date + " 00:00:00", f.to_date + " 23:59:59"]]
    for l in frappe.get_all("POS Void Log", filters=lc, fields=["void_type", "amount", "creation"]):
        d = day(l.creation)
        if l.void_type == "Comp":
            d.comps += 1
            d.comp_amount += flt(l.amount)
        else:
            d.voids += 1
            d.void_amount += flt(l.amount)
    rc = {}
    if f.company:
        rc["company"] = f.company
    if rng:
        rc["reservation_start"] = ["between", [f.from_date + " 00:00:00", f.to_date + " 23:59:59"]]
    for r in frappe.get_all("POS Reservation", filters=dict(rc, is_waitlist=0), fields=["reservation_start", "status"]):
        d = day(r.reservation_start)
        d.bookings += 1
        if r.status == "No Show":
            d.no_shows += 1
    fc = {}
    if f.pos_profile:
        fc["pos_profile"] = f.pos_profile
    if rng:
        fc["creation"] = ["between", [f.from_date + " 00:00:00", f.to_date + " 23:59:59"]]
    for fb in frappe.get_all("POS Guest Feedback", filters=fc,
                             fields=["creation", "food_rating", "service_rating", "ambience_rating"]):
        vals = [flt(v) * 5 for v in (fb.food_rating, fb.service_rating, fb.ambience_rating) if flt(v)]
        if vals:
            day(fb.creation).ratings.append(sum(vals) / len(vals))
    data = []
    for d in sorted(days.values(), key=lambda x: x.date):
        d.per_guest = d.net_sales / d.covers if d.covers else 0
        d.table_minutes = sum(d.table_secs) / len(d.table_secs) / 60 if d.table_secs else 0
        d.kitchen_minutes = sum(d.kitchen_secs) / len(d.kitchen_secs) / 60 if d.kitchen_secs else 0
        d.rating = sum(d.ratings) / len(d.ratings) if d.ratings else 0
        for k in ("table_secs", "kitchen_secs", "ratings"):
            d.pop(k)
        data.append(d)
    return _cols(), data
