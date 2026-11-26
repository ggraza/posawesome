# Copyright (c) 2026, Youssef Restom and contributors
# For license information, please see license.txt

"""POS Item Exchange: audit record of an exchange / replacement made at the POS.

It links the original Sales Invoice, the credit note (return) for the items
brought back and the new Sales Invoice for the replacement items. It is created
and submitted by posawesome.posawesome.api.exchange.create_exchange in the same
transaction as the two invoices.

Cancelling it is the only way to reverse an exchange: the new invoice and then
the credit note are cancelled through ERPNext (stock, ledger and payments are
reversed by ERPNext itself). Nothing is deleted.
"""

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import now_datetime


class POSItemExchange(Document):
    # the two invoices link back to this record; they are cancelled in on_cancel,
    # so their link must not block cancelling the exchange itself
    ignore_linked_doctypes = ("Sales Invoice", "GL Entry", "Payment Ledger Entry", "Stock Ledger Entry")

    def validate(self):
        # only the POS exchange (api.exchange.create_exchange) makes these
        # records, together with their invoices: no hand-made / amended copies
        if not frappe.flags.get("posa_exchange_creating"):
            frappe.throw(
                _("Item exchanges are made from the POS (Return > Exchange / Replace Items)."),
                title=_("Not allowed"),
            )
        if self.docstatus == 0:
            self.status = "Draft"

    def on_submit(self):
        if not (self.return_invoice and self.new_invoice):
            frappe.throw(_("An exchange needs its credit note and its new invoice."))
        self.db_set("status", "Completed", update_modified=False)

    def before_cancel(self):
        if self.status == "Cancelled":
            frappe.throw(_("Exchange {0} is already cancelled.").format(self.name))
        if not (self.cancellation_reason or "").strip():
            frappe.throw(
                _("Enter a Cancellation Reason (Cancellation section), save, then cancel."),
                title=_("Reason required"),
            )

    def on_cancel(self):
        # new invoice first (its stock comes back), then the credit note (the
        # returned stock goes out again); ERPNext refuses if either has been
        # used since (e.g. returned again), and then nothing is cancelled.
        frappe.flags.posa_exchange_cancel = self.name
        try:
            for name in (self.new_invoice, self.return_invoice):
                if not name:
                    continue
                invoice = frappe.get_doc("Sales Invoice", name)
                if invoice.docstatus == 1:
                    invoice.flags.ignore_permissions = True
                    invoice.cancel()
        finally:
            frappe.flags.posa_exchange_cancel = None
        self.db_set(
            {"status": "Cancelled", "cancelled_by": frappe.session.user, "cancelled_on": now_datetime()},
            update_modified=False,
        )
        self.add_comment(
            "Cancelled",
            _("Exchange cancelled: {0} and {1} cancelled. Reason: {2}").format(
                self.new_invoice, self.return_invoice, self.cancellation_reason
            ),
        )


def block_direct_cancel(doc, method=None):
    """Sales Invoice before_cancel: an exchange's invoices are reversed together
    by cancelling the POS Item Exchange, never one by one."""
    exchange = doc.get("posa_item_exchange")
    if not exchange or frappe.flags.get("posa_exchange_cancel") == exchange:
        return
    if frappe.db.get_value("POS Item Exchange", exchange, "docstatus") == 1:
        frappe.throw(
            _("{0} belongs to item exchange {1}. Cancel the exchange to reverse both of its invoices.").format(
                doc.name, frappe.utils.get_link_to_form("POS Item Exchange", exchange)
            ),
            title=_("Part of an exchange"),
        )


@frappe.whitelist()
def cancel_exchange(name, reason):
    """Cancel an exchange with its reason (Cancel Exchange button)."""
    doc = frappe.get_doc("POS Item Exchange", name)
    doc.check_permission("cancel")
    if doc.docstatus != 1:
        frappe.throw(_("Only a completed exchange can be cancelled ({0} is {1}).").format(name, doc.status))
    doc.cancellation_reason = (reason or "").strip()
    doc.cancel()
    return {"name": doc.name, "status": "Cancelled"}
