# Copyright (c) 2021, Youssef Restom and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.utils import today
from posawesome.posawesome.doctype.referral_code.referral_code import (
    create_referral_code,
)


def after_insert(doc, method):
    create_customer_referral_code(doc)
    create_gift_coupon(doc)


def validate(doc, method):
    validate_referral_code(doc)


def create_customer_referral_code(doc):
    if doc.posa_referral_company:
        company = frappe.get_cached_doc("Company", doc.posa_referral_company)
        if not company.posa_auto_referral:
            return
        create_referral_code(
            doc.posa_referral_company,
            doc.name,
            company.posa_customer_offer,
            company.posa_primary_offer,
            company.posa_referral_campaign,
        )


def create_gift_coupon(doc):
    if doc.posa_referral_code:
        coupon = frappe.new_doc("POS Coupon")
        coupon.customer = doc.name
        coupon.referral_code = doc.posa_referral_code
        coupon.create_coupon_from_referral()


def validate_referral_code(doc):
    referral_code = doc.posa_referral_code
    exist = None
    if referral_code:
        exist = frappe.db.exists("Referral Code", referral_code)
        if not exist:
            exist = frappe.db.exists("Referral Code", {"referral_code": referral_code})
        if not exist:
            frappe.throw(_("This Referral Code {0} not exists").format(referral_code))


@frappe.whitelist()
def get_today_customer_count():
    today_date = today()
    customer_count = frappe.db.sql("""
        SELECT COUNT(DISTINCT customer)
        FROM `tabSales Invoice`
        WHERE docstatus != 2
        AND posting_date = %s
    """, today_date)

    return customer_count[0][0] if customer_count else 0


# In posawesome/posawesome/api/customer.py

@frappe.whitelist()
def get_customers_with_non_canceled_invoices():
    """
    Fetch a list of customers who have at least one non-canceled sales invoice.
    """
    customers = frappe.db.sql("""
        SELECT DISTINCT customer
        FROM `tabSales Invoice`
        WHERE docstatus != 2
    """, as_dict=True)
    
    return [customer['customer'] for customer in customers]
