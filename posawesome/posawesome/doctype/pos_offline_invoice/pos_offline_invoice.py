# Copyright (c) 2026, G2Virtu and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class POSOfflineInvoice(Document):
    """Server-side copy of an invoice a terminal took while offline.

    Created by posawesome.posawesome.api.offline.upload_offline_invoices and turned
    into a submitted Sales Invoice by process_offline_invoice (idempotent on
    offline_id)."""

    def before_insert(self):
        if not self.user:
            self.user = frappe.session.user


@frappe.whitelist()
def retry(name):
    from posawesome.posawesome.api.offline import retry_offline_invoices

    return retry_offline_invoices([name])
