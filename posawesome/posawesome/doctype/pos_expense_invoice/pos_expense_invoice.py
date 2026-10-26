# Copyright (c) 2024, Youssef Restom and contributors
# For license information, please see license.txt

import frappe
from frappe import _                   # ? Add this line
from frappe.model.document import Document
from frappe.utils import nowdate

class POSExpenseInvoice(Document):
    pass

    def before_insert(self):
        self.set_paid_from_account()

    def before_submit(self):
        self.set_paid_from_account()

    def set_paid_from_account(self):
        """
        Auto fetch default account from Mode of Payment
        and set paid_from if not already set.
        """

        if self.paid_from:
            return

        if not self.mode_of_payment or not self.company:
            return

        account = frappe.db.get_value(
            "Mode of Payment Account",
            {
                "parent": self.mode_of_payment,
                "company": self.company
            },
            "default_account"
        )

        if account:
            self.paid_from = account
        else:
            frappe.throw(
                f"No default account found for Mode of Payment "
                f"{self.mode_of_payment} in company {self.company}"
            )


def create_journal_entry(doc, method):
    """
    Create Journal Entry on submit of POS Expense Invoice
    Uses cash mode from the selected POS Profile (via POS Opening Shift)
    """
    # ?? CONDITION: Only create JE if enabled
    if not getattr(doc, "posa_create_journal_entry", 0):
        return

    # Prevent duplicate Journal Entry
    if frappe.db.exists(
        "Journal Entry",
        {
            "reference_doctype": doc.doctype,
            "reference_name": doc.name,
            "docstatus": 1
        }
    ):
        return

    # Basic validations
    if not doc.paid_from:
        frappe.throw(_("Paid from is required for auto journal entry"))

    if not doc.expense_detail:
        frappe.throw(_("No expense lines found"))

    company = doc.company
    cash_account= doc.paid_from

    posting_date = doc.date or nowdate()

    # Get Company Default Cost Center
    company_cost_center = frappe.db.get_value(
        "Company", company, "cost_center"
    )
    if not company_cost_center:
        frappe.throw(
            _("Default Cost Center not set for company {0}").format(company)
        )

    # ------------------------------------------------
    # Get the POS Profile from the selected Opening Shift
    # ------------------------------------------------
#    pos_profile = frappe.db.get_value(
#        "POS Opening Shift",
#        doc.pos_opening_shift,
#        "pos_profile"
#    )
#    if not pos_profile:
#        frappe.throw(
#            _("POS Profile not found in POS Opening Shift {0}").format(doc.pos_opening_shift)
#        )

    # Get the Cash Mode of Payment configured in that POS Profile
#    cash_mop = frappe.db.get_value(
#        "POS Profile",
#        pos_profile,
#        "posa_cash_mode_of_payment"
#    )
#    if not cash_mop:
#        frappe.throw(
#            _("Cash Mode of Payment (posa_cash_mode_of_payment) is not set in POS Profile '{0}'").format(pos_profile)
#        )

    # ------------------------------------------------
    # Now fetch the Default Account linked to this MOP + Company
    # ------------------------------------------------
#    cash_account = frappe.db.get_value(
#        "Mode of Payment Account",
#        filters={
#            "parent": cash_mop,
#            "company": company
#        },
#        fieldname="default_account"
#    )

#    if not cash_account:
#        frappe.throw(
#            _(
#                "No default cash account configured for Mode of Payment '{0}' "
#                "in company '{1}'.<br><br>"
#                "<b>How to fix:</b><br>"
#                "1. Go to Mode of Payment ? '{0}'<br>"
#                "2. In 'Accounts' table, add row for Company '{1}'<br>"
#                "3. Set a valid Cash/Bank account (e.g. 'Cash - G' or 'Petty Cash')"
#            ).format(cash_mop, company)
#        )

    # ------------------------------------------------
    # Create Journal Entry
    # ------------------------------------------------
    je = frappe.new_doc("Journal Entry")
    je.voucher_type = "Journal Entry"
    je.company = company
    je.posting_date = posting_date
    je.user_remark = f"POS Expense Invoice {doc.name}"
    je.reference_doctype = doc.doctype
    je.reference_name = doc.name

    total_amount = 0

    # Debit Expense Accounts
    for row in doc.expense_detail:
        expense_account, cost_center = frappe.db.get_value(
            "POS Expense Default",
            filters={
                "parent": row.pos_expenses,
                "company": company
            },
            fieldname=["expense_account", "cost_center"]
        )

        if not expense_account:
            frappe.throw(
                _("Expense account not set for expense head '{0}' in company '{1}'").format(
                    row.pos_expenses, company
                )
            )

        # Fallback to company cost center if not set per expense
        cost_center = cost_center or company_cost_center

        je.append("accounts", {
            "account": expense_account,
            "debit_in_account_currency": row.amount,
            "cost_center": cost_center
        })
        total_amount += row.amount

    # Credit Cash Account (from the POS Profile's cash MOP)
    je.append("accounts", {
        "account": cash_account,
        "credit_in_account_currency": total_amount,
        "cost_center": company_cost_center
    })

    # Save & Submit
    je.insert(ignore_permissions=True)
    je.submit()

    frappe.msgprint(
        _("Journal Entry <b>{0}</b> created successfully").format(je.name)
    )


def cancel_journal_entry(doc, method):
    """
    Cancel linked Journal Entry on cancel of POS Expense Invoice
    """

    je_name = frappe.db.get_value(
        "Journal Entry",
        {
            "reference_doctype": doc.doctype,
            "reference_name": doc.name,
            "docstatus": 1
        },
        "name"
    )

    if je_name:
        je = frappe.get_doc("Journal Entry", je_name)
        je.cancel()

def delete_journal_entry(doc, method):
    """
    Delete linked Journal Entry when POS Expense Invoice is deleted
    """

    je_name = frappe.db.get_value(
        "Journal Entry",
        {
            "reference_doctype": doc.doctype,
            "reference_name": doc.name
        },
        "name"
    )

    if je_name:
        je = frappe.get_doc("Journal Entry", je_name)

        # Safety: JE must be cancelled before delete
        if je.docstatus == 1:
            frappe.throw(
                f"Journal Entry {je.name} must be cancelled before deleting."
            )

        je.delete(ignore_permissions=True)
