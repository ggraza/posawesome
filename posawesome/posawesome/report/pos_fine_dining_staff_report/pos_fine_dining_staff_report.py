# Copyright (c) 2026, Youssef Restom and contributors
# For license information, please see license.txt
"""Paid dine-in orders per waiter: guests, sales, service charge, tips, and each
waiter's equal share of the tip pool."""

import frappe
from frappe import _
from frappe.utils import cint, flt


def execute(filters=None):
    filters = frappe._dict(filters or {})
    columns = [
        {"fieldname": "waiter", "label": _("Waiter"), "fieldtype": "Link", "options": "User", "width": 200},
        {"fieldname": "waiter_name", "label": _("Name"), "fieldtype": "Data", "width": 160},
        {"fieldname": "orders", "label": _("Orders"), "fieldtype": "Int", "width": 80},
        {"fieldname": "covers", "label": _("Guests"), "fieldtype": "Int", "width": 80},
        {"fieldname": "net_sales", "label": _("Net Sales"), "fieldtype": "Currency", "width": 120},
        {"fieldname": "per_guest", "label": _("Per Guest"), "fieldtype": "Currency", "width": 110},
        {"fieldname": "service_charge", "label": _("Service Charge"), "fieldtype": "Currency", "width": 120},
        {"fieldname": "tips", "label": _("Tips"), "fieldtype": "Currency", "width": 110},
        {"fieldname": "tip_pool_share", "label": _("Tip Pool Share"), "fieldtype": "Currency", "width": 120},
    ]
    cond = {"docstatus": 1, "is_return": 0, "posa_service_table": ["!=", ""]}
    if filters.company:
        cond["company"] = filters.company
    if filters.pos_profile:
        cond["pos_profile"] = filters.pos_profile
    if filters.from_date and filters.to_date:
        cond["posting_date"] = ["between", [filters.from_date, filters.to_date]]
    invoices = frappe.get_all("Sales Invoice", filters=cond,
                              fields=["name", "posa_waiter", "owner", "posa_covers", "net_total", "posa_tip_amount"])
    sc = {}
    if invoices:
        for r in frappe.get_all("Sales Taxes and Charges",
                                filters={"parenttype": "Sales Invoice", "parent": ["in", [i.name for i in invoices]],
                                         "posa_fd_charge": "Service Charge"},
                                fields=["parent", "tax_amount"]):
            sc[r.parent] = sc.get(r.parent, 0) + flt(r.tax_amount)
    rows = {}
    for i in invoices:
        w = i.posa_waiter or i.owner
        r = rows.setdefault(w, frappe._dict(waiter=w, orders=0, covers=0, net_sales=0, service_charge=0, tips=0))
        r.orders += 1
        r.covers += cint(i.posa_covers)
        r.net_sales += flt(i.net_total)
        r.service_charge += sc.get(i.name, 0)
        r.tips += flt(i.posa_tip_amount)
    pool = sum(r.tips for r in rows.values())
    share = pool / len(rows) if rows else 0
    data = []
    for w, r in sorted(rows.items()):
        r.waiter_name = frappe.db.get_value("User", w, "full_name") or w
        r.per_guest = r.net_sales / r.covers if r.covers else 0
        r.tip_pool_share = share
        data.append(r)
    return columns, data
