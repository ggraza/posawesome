from erpnext.accounts.doctype.sales_invoice.sales_invoice import SalesInvoice as BaseSalesInvoice
from frappe.utils import flt
from frappe import _
import frappe
from erpnext.accounts.utils import get_balance_on

class SalesInvoice(BaseSalesInvoice):
#    def validate(self):
#        self.validate_pos()  # existing POS validation
#        self.validate_return_amount()  # our new validation


    def validate_pos(self):
        if self.is_return:
            invoice_total = self.rounded_total or self.grand_total
            if flt(self.paid_amount) + flt(self.write_off_amount) - abs(flt(invoice_total)) > 1.0 / (
                10.0 ** (self.precision("grand_total") + 1.0)
            ):
                frappe.throw(_("Paid amount + Write Off Amount can not be greater than Grand Total"))

#    def validate_return_amount(self):
#        if self.is_return and self.return_against:
#            original = frappe.get_doc("Sales Invoice", self.return_against)
#            if abs(self.grand_total) > original.outstanding_amount:
#                frappe.throw(
#                    "Return amount cannot exceed unpaid amount. "
#                    "Please refund excess separately."
#                )

import frappe
from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry
from erpnext.accounts.utils import get_balance_on

def before_submit(doc, method=None):
    if not doc.is_pos or not doc.customer or not doc.posa_allow_received_advance:
        return

    paid = doc.paid_amount or 0
    total = doc.grand_total or 0

    if paid <= total:
        return

    extra = paid - total

    outstanding = get_balance_on(
        party_type="Customer",
        party=doc.customer,
        company=doc.company
    ) or 0

    if outstanding <= 0:
        return

    recover = min(extra, outstanding)
    doc.total_advance = recover
    doc.outstanding_amount = 0
    #doc.base_outstanding_amount = 0

    # Prefer first payment row (ERPNext POS behavior)
    if doc.change_amount > 0 and doc.payments:
        valid = [p for p in doc.payments if p.amount > 0 and p.account]
        if valid:
            payment = max(valid, key=lambda x: x.amount)
            doc.account_for_change_amount = payment.account

    # Get correct accounts
    payment_row = None
    if doc.payments:
        valid = [p for p in doc.payments if p.amount > 0 and p.account]
        if valid:
            payment_row = max(valid, key=lambda x: x.amount)

    if not payment_row:
        return
    debtors_account = doc.debit_to  # ?? ALWAYS use invoice receivable
#    cash_account = doc.payments[0].account
    cash_account = payment_row.account       # REAL payment account
    mode_of_payment = payment_row.mode_of_payment       # REAL payment account

    pe = frappe.new_doc("Payment Entry")
    pe.payment_type = "Receive"
    pe.mode_of_payment = mode_of_payment

    pe.company = doc.company

    pe.party_type = "Customer"
    pe.party = doc.customer
    pe.party_account = debtors_account

    pe.paid_from = debtors_account
    pe.paid_to = cash_account

    pe.paid_amount = recover
    pe.received_amount = recover

    pe.posting_date = doc.posting_date
    pe.reference_no = doc.name
    pe.reference_date = doc.posting_date
    pe.reference_doctype = "Sales Invoice"
    pe.reference_name = doc.name

    # Allocate against old invoices
    #pe.append("references", {
    #    "reference_doctype": "Sales Invoice",
    #    "reference_name": doc.name,
    #    "allocated_amount": 0
    #})

    pe.allocate_payment_amount = 1

    pe.insert(ignore_permissions=True)
    pe.submit()

    frappe.msgprint(
        f"PKR {recover} adjusted against previous outstanding invoices."
    )


# received as advance instead of provide change
def before_submit_unalocated(doc, method=None):
    # Only POS invoices
    if not doc.is_pos or not doc.customer or not doc.posa_allow_received_advance:
        return

    paid = doc.paid_amount or 0
    total = doc.grand_total or 0

    # Extra payment exists
    if paid <= total:
        return

    extra = paid - total

    # Get actual outstanding from GL
    outstanding = get_balance_on(
        party_type="Customer",
        party=doc.customer,
        company=doc.company
    ) or 0

    if outstanding <= 0:
        return

    recover = min(extra, outstanding)

    # Reduce change (no cashback)
    #doc.change_amount = max(
    #    0, (doc.change_amount or 0) - recover
    #)
    #doc.base_change_amount = max(
    #    0, (doc.base_change_amount or 0) - recover
    #)

    # Treat recovered amount as advance settlement
    doc.total_advance = recover
    doc.outstanding_amount = 0

    frappe.msgprint(
        f"PKR {recover} recovered from customer outstanding balance."
    )


# item wise sales person commission,
def calculate_salesperson_commission(doc, method):
    """
    Calculate item-wise incentives and rebuild Sales Team table
    doc: Sales Invoice document
    method: 'before_save'
    """
    # Reset header totals
    doc.total_commission = 0
    doc.amount_eligible_for_commission = 0

    sales_person_map = {}

    # 1?? Calculate incentives per item
    for item in doc.items:
        item.posa_incentives = 0

        if not item.grant_commission:
            continue

        if not item.posa_sales_person:
            continue

        commission_rate = float(item.posa_commission_rate or 0)
        net_amount = float(item.net_amount or 0)

        incentive = (net_amount * commission_rate) / 100
        item.posa_incentives = incentive

        # Header totals
        doc.total_commission += incentive
        doc.amount_eligible_for_commission += net_amount

        sp = item.posa_sales_person
        if sp not in sales_person_map:
            sales_person_map[sp] = {"sales_amount": 0, "commission_amount": 0}

        sales_person_map[sp]["sales_amount"] += net_amount
        sales_person_map[sp]["commission_amount"] += incentive

    # 2?? Rebuild Sales Team table
    doc.sales_team = []

    total_sales_amount = sum([v["sales_amount"] for v in sales_person_map.values()]) or 1

    for sp, data in sales_person_map.items():
        allocated_percentage = (data["sales_amount"] / total_sales_amount) * 100

        row = doc.append("sales_team", {})
        row.sales_person = sp
        row.allocated_percentage = round(allocated_percentage, 2)
        row.allocated_amount = round(data["sales_amount"], 2)
        row.commission_rate = 0
        row.incentives = round(data["commission_amount"], 2)

    # 3?? Header commission rate
    doc.commission_rate = 0


