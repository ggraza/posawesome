# -*- coding: utf-8 -*-
from __future__ import unicode_literals
#import frappe

__version__ = "16.0.0"


def console(*data):
    import frappe
    frappe.publish_realtime("toconsole", data, user=frappe.session.user)


def check_app_permission():
    """Show the POS G2Virtu tile on the v16 apps screen only to people who can use it."""
    import frappe

    if frappe.session.user == "Administrator":
        return True

    if frappe.get_cached_value("User", frappe.session.user, "user_type") == "Website User":
        return False

    return any(
        frappe.has_permission(doctype, "read")
        for doctype in ("POS Profile", "Sales Invoice", "POS Opening Shift")
    )
