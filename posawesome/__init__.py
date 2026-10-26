# -*- coding: utf-8 -*-
from __future__ import unicode_literals
#import frappe

__version__ = "16.0.0"


def console(*data):
    import frappe
    frappe.publish_realtime("toconsole", data, user=frappe.session.user)
