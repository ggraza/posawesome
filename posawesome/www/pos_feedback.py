# Copyright (c) 2026, Youssef Restom and contributors
# For license information, please see license.txt
"""Public guest feedback form (fine dining). Opened from the link / QR code on
the guest check: /pos_feedback?i=<bill>&t=<token>."""

import frappe
from frappe import _

no_cache = 1


def get_context(context):
    from posawesome.posawesome.api.fine_dining_guests import feedback_token, guest_settings

    invoice = frappe.form_dict.get("i") or ""
    token = frappe.form_dict.get("t") or ""
    context.no_cache = 1
    context.show_sidebar = False
    context.title = _("Your feedback")
    context.valid = False
    context.done = False
    if invoice and token == feedback_token(invoice):
        inv = frappe.db.get_value("Sales Invoice", invoice, ["company", "pos_profile"], as_dict=True)
        if inv and guest_settings(inv.pos_profile).feedback:
            context.valid = True
            context.company = inv.company
            context.invoice = invoice
            context.token = token
            context.done = bool(frappe.db.exists("POS Guest Feedback", {"sales_invoice": invoice}))
    return context
