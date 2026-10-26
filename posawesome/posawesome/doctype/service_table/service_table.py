# Copyright (c) 2026, G2Virtu and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class ServiceTable(Document):
	pass


def update_service_table(table_name, status):

    if not table_name:
        return

    if not frappe.db.exists("Service Table", table_name):
        return

    frappe.db.set_value(
        "Service Table",
        table_name,
        {
            "status": status,
            "occupied": 1 if status == "Occupied" else 0
        },
        update_modified=False
    )


def before_save_service_table(doc, method):
    """
    If Service Table is changed,
    release the previous table.
    """

    if doc.is_new():
        return

    old_table = frappe.db.get_value(
        "Sales Invoice",
        doc.name,
        "posa_service_table"
    )

    if old_table and old_table != doc.posa_service_table:
        update_service_table(old_table, "Available")


def on_update_service_table(doc, method):
    """
    Occupy current table while invoice is Draft.
    """

    if doc.docstatus != 0:
        return

    if doc.posa_service_table:
        update_service_table(doc.posa_service_table, "Occupied")


def on_submit_service_table(doc, method):
    """
    Release table after invoice submission.
    """

    if doc.posa_service_table:
        update_service_table(doc.posa_service_table, "Available")


def on_cancel_service_table(doc, method):
    """
    Release table on cancellation.
    """

    if doc.posa_service_table:
        update_service_table(doc.posa_service_table, "Available")