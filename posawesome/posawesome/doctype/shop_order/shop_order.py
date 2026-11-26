
# Copyright (c) 2025, Youssef Restom and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import flt


class ShopOrder(Document):
    pass


@frappe.whitelist()
def get_sales_invoice_qty(item_code, company, posting_date):
    """
    Return total submitted Sales Invoice quantity
    for an item, company and posting date.
    """

    if not item_code or not company or not posting_date:
        return 0

    result = frappe.db.sql("""
        SELECT COALESCE(SUM(sii.qty), 0)
        FROM `tabSales Invoice Item` sii
        INNER JOIN `tabSales Invoice` si
            ON si.name = sii.parent
        WHERE
            sii.item_code = %s
            AND si.company = %s
            AND si.posting_date = %s
            AND si.docstatus = 1
            AND si.is_return = 0
    """, (item_code, company, posting_date))

    return flt(result[0][0]) if result else 0
