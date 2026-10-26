# -*- coding: utf-8 -*-
# Copyright (c) 2020, Youssef Restom and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
import json
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint, flt


class POSClosingShift(Document):
    def validate(self):
        user = frappe.get_all(
            "POS Closing Shift",
            filters={
                "user": self.user,
                "docstatus": 1,
                "pos_opening_shift": self.pos_opening_shift,
                "name": ["!=", self.name],
            },
        )

        if user:
            frappe.throw(
                _(
                    "POS Closing Shift {} against {} between selected period".format(
                        frappe.bold("already exists"), frappe.bold(self.user)
                    )
                ),
                title=_("Invalid Period"),
            )

        if (
            frappe.db.get_value("POS Opening Shift", self.pos_opening_shift, "status")
            != "Open"
        ):
            frappe.throw(
                _("Selected POS Opening Shift should be open."),
                title=_("Invalid Opening Entry"),
            )
        self.validate_offline_invoices()
        self.update_payment_reconciliation()

    def validate_offline_invoices(self):
        """Invoices taken offline during this shift must reach the server before
        the shift is closed, otherwise the cash count would not match."""
        from posawesome.posawesome.api.offline import check_pending_before_closing

        pending = check_pending_before_closing(self.pos_opening_shift)
        if not pending:
            return
        waiting = [p.name for p in pending if p.status in ("Queued", "Processing")]
        failed = [p.name for p in pending if p.status == "Failed"]
        if waiting:
            frappe.throw(
                _("{0} offline invoice(s) of this shift are still being synced. Please wait and try again.").format(
                    len(waiting)
                ),
                title=_("Offline Invoices Pending"),
            )
        if failed and self.docstatus == 1:
            frappe.throw(
                _("{0} offline invoice(s) of this shift failed to sync: {1}. Fix them in POS Offline Invoice first.").format(
                    len(failed), ", ".join(failed[:10])
                ),
                title=_("Offline Invoices Failed"),
            )

    def update_payment_reconciliation(self):
        precision = (
            cint(frappe.db.get_single_value("System Settings", "currency_precision")) or 3
        )
        total_expense = flt(sum(frappe.get_all("POS Expense Invoice", filters={"pos_opening_shift": self.pos_opening_shift, "docstatus": 1}, pluck="total_expense"))) or 0  # v16 rejects "sum(...)" string fields

        for d in self.payment_reconciliation:
            d.difference = +flt(d.closing_amount, precision) + flt(total_expense, precision) - flt(
                d.expected_amount, precision
            )

    def on_submit(self):
        opening_entry = frappe.get_doc("POS Opening Shift", self.pos_opening_shift)
        opening_entry.pos_closing_shift = self.name
        opening_entry.set_status()
        self.delete_draft_invoices()
        opening_entry.save()

    def delete_draft_invoices(self):
        if frappe.get_value("POS Profile", self.pos_profile, "posa_allow_delete"):
            data = frappe.db.sql(
                """
                select
                    name
                from
                    `tabSales Invoice`
                where
                    docstatus = 0 and posa_is_printed = 0 and posa_pos_opening_shift = %s
                """,
                (self.pos_opening_shift),
                as_dict=1,
            )

            for invoice in data:
                frappe.delete_doc("Sales Invoice", invoice.name, force=1)

    @frappe.whitelist()
    def get_payment_reconciliation_details(self):
        currency = frappe.get_cached_value("Company", self.company, "default_currency")
        return frappe.render_template(
            "posawesome/posawesome/doctype/pos_closing_shift/closing_shift_details.html",
            {"data": self, "currency": currency},
        )


@frappe.whitelist()
def get_cashiers(doctype, txt, searchfield, start, page_len, filters):
    cashiers_list = frappe.get_all("POS Profile User", filters=filters, fields=["user"])
    return [c["user"] for c in cashiers_list]


@frappe.whitelist()
def get_pos_invoices(pos_opening_shift):
    submit_printed_invoices(pos_opening_shift)
    data = frappe.db.sql(
        """
	select
		name
	from
		`tabSales Invoice`
	where
		docstatus = 1 and posa_pos_opening_shift = %s
	""",
        (pos_opening_shift),
        as_dict=1,
    )

    data = [frappe.get_doc("Sales Invoice", d.name).as_dict() for d in data]

    return data


@frappe.whitelist()
def get_pos_expense_invoice(pos_opening_shift):
    data = frappe.db.sql(
        """
	select
		name, date, total_expense
	from
		`tabPOS Expense Invoice`
	where
		docstatus = 1 and pos_opening_shift = %s
	""",
        (pos_opening_shift),
        as_dict=1,
    )

    return data


@frappe.whitelist()
def get_payments_entries(pos_opening_shift):
    return frappe.get_all(
        "Payment Entry",
        filters={
            "docstatus": 1,
            "reference_no": pos_opening_shift,
            "payment_type": "Receive",
        },
        fields=[
            "name",
            "mode_of_payment",
            "paid_amount",
            "reference_no",
            "posting_date",
            "party",
        ],
    )


@frappe.whitelist()
def make_closing_shift_from_opening(opening_shift):
    opening_shift = json.loads(opening_shift)
    submit_printed_invoices(opening_shift.get("name"))
    closing_shift = frappe.new_doc("POS Closing Shift")
    closing_shift.pos_opening_shift = opening_shift.get("name")
    closing_shift.period_start_date = opening_shift.get("period_start_date")
    closing_shift.period_end_date = frappe.utils.get_datetime()
    closing_shift.pos_profile = opening_shift.get("pos_profile")
    closing_shift.user = opening_shift.get("user")
    closing_shift.company = opening_shift.get("company")
    closing_shift.grand_total = 0
    closing_shift.net_total = 0
    closing_shift.total_quantity = 0
    closing_shift.total_return = 0
    closing_shift.return_not_paid = 0
    closing_shift.total_return_invoices = 0
    closing_shift.discount_on_items = 0
    closing_shift.discount_on_invoice = 0
    closing_shift.total_discount = 0

    invoices = get_pos_invoices(opening_shift.get("name"))

    pos_transactions = []
    taxes = []
    payments = []
    pos_payments_table = []
    for detail in opening_shift.get("balance_details"):
        payments.append(
            frappe._dict(
                {
                    "mode_of_payment": detail.get("mode_of_payment"),
                    "opening_amount": detail.get("amount") or 0,
                    "expected_amount": detail.get("amount") or 0,
                }
            )
        )

    for denomination in opening_shift.get("denomination_details", []):
        closing_shift.append("denomination_details", {
            "currency": denomination.get("currency"),
            "mode_of_denomination": denomination.get("mode_of_denomination"),
            "opening_qty": denomination.get("qty"),
            "opening_cash": denomination.get("amount")
        })

    for d in invoices:
        items_discount = 0

        items = d.get('items')
        #if items:
        for item in items:
            items_discount += flt(item.get('discount_amount', 0))

        pos_transactions.append(
            frappe._dict(
                {
                    "sales_invoice": d.name,
                    "posting_date": d.posting_date,
                    "grand_total": d.grand_total,
                    "customer": d.customer,
                    "discount_amount": d.discount_amount,
                    "items_discount": items_discount,
                }
            )
        )
        closing_shift.grand_total += flt(d.grand_total)
        closing_shift.net_total += flt(d.net_total)
        closing_shift.total_quantity += flt(d.total_qty)

        discount_on_items = 0
        discount_on_invoice = flt(d.discount_amount)

        items = d.get('items')
        if items:
            for item in items:
                discount_on_items += flt(item.get('discount_amount', 0))

        closing_shift.discount_on_items += discount_on_items
        closing_shift.discount_on_invoice += discount_on_invoice
        closing_shift.total_discount += (discount_on_items + discount_on_invoice)

        if d.is_return == 1:
            closing_shift.total_return += flt(d.grand_total)
            closing_shift.total_return_invoices += 1
        if d.is_return == 1 and d.is_pos == 0:
            closing_shift.return_not_paid += flt(d.grand_total)

        for t in d.taxes:
            existing_tax = [
                tx
                for tx in taxes
                if tx.account_head == t.account_head and tx.rate == t.rate
            ]
            if existing_tax:
                existing_tax[0].amount += flt(t.tax_amount)
            else:
                taxes.append(
                    frappe._dict(
                        {
                            "account_head": t.account_head,
                            "rate": t.rate,
                            "amount": t.tax_amount,
                        }
                    )
                )

        for p in d.payments:
            existing_pay = [
                pay for pay in payments if pay.mode_of_payment == p.mode_of_payment
            ]
            if existing_pay:
                cash_mode_of_payment = frappe.get_value(
                    "POS Profile",
                    opening_shift.get("pos_profile"),
                    "posa_cash_mode_of_payment",
                )
                if not cash_mode_of_payment:
                    cash_mode_of_payment = "Cash"
                #if existing_pay[0].mode_of_payment == cash_mode_of_payment:
                #    amount = p.amount - d.change_amount
                posa_allow_received_advance = d.get("posa_allow_received_advance")

                if existing_pay[0].mode_of_payment == cash_mode_of_payment:
                    if posa_allow_received_advance:
                        # Advance kept, no cash returned
                        amount = p.amount
                    else:
                        # Normal change returned
                        amount = p.amount - d.change_amount
                else:
                    amount = p.amount
                existing_pay[0].expected_amount += flt(amount)
            else:
                payments.append(
                    frappe._dict(
                        {
                            "mode_of_payment": p.mode_of_payment,
                            "opening_amount": 0,
                            "expected_amount": p.amount,
                        }
                    )
                )

    pos_payments = get_payments_entries(opening_shift.get("name"))

    for py in pos_payments:
        pos_payments_table.append(
            frappe._dict(
                {
                    "payment_entry": py.name,
                    "mode_of_payment": py.mode_of_payment,
                    "paid_amount": py.paid_amount,
                    "posting_date": py.posting_date,
                    "customer": py.party,
                }
            )
        )
        existing_pay = [
            pay for pay in payments if pay.mode_of_payment == py.mode_of_payment
        ]
        if existing_pay:
            existing_pay[0].expected_amount += flt(py.paid_amount)
        else:
            payments.append(
                frappe._dict(
                    {
                        "mode_of_payment": py.mode_of_payment,
                        "opening_amount": 0,
                        "expected_amount": py.paid_amount,
                    }
                )
            )

    closing_shift.set("pos_transactions", pos_transactions)
    closing_shift.set("payment_reconciliation", payments)
    closing_shift.set("taxes", taxes)
    closing_shift.set("pos_payments", pos_payments_table)

    return closing_shift

@frappe.whitelist()
def submit_closing_shift(closing_shift):
    closing_shift = json.loads(closing_shift)
    closing_shift_doc = frappe.get_doc(closing_shift)
    closing_shift_doc.flags.ignore_permissions = True
    closing_shift_doc.save()
    closing_shift_doc.submit()
    return closing_shift_doc.name


def submit_printed_invoices(pos_opening_shift):
    invoices_list = frappe.get_all(
        "Sales Invoice",
        filters={
            "posa_pos_opening_shift": pos_opening_shift,
            "docstatus": 0,
            "posa_is_printed": 1,
        },
    )
    for invoice in invoices_list:
        invoice_doc = frappe.get_doc("Sales Invoice", invoice.name)
        invoice_doc.submit()


@frappe.whitelist()
def check_open_invoices(pos_opening_shift):
    open_invoices = frappe.get_list('Sales Invoice', filters={
        'posa_pos_opening_shift': pos_opening_shift,
        'docstatus': 0
    })

    if open_invoices:
        return {
            "status": "error",
            "message": _("Please close all open invoices before closing the shift."),
            "open_invoices": open_invoices
        }
    else:
        return {
            "status": "success"
        }

