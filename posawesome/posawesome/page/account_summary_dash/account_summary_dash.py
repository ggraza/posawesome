import frappe
from frappe.utils import fmt_money, cint, flt, nowdate, add_days
from erpnext.accounts.party import get_partywise_advanced_payment_amount
from erpnext.accounts.utils import get_currency_precision
from erpnext.accounts.report.accounts_receivable.accounts_receivable import ReceivablePayableReport

@frappe.whitelist()
def get_account_summary(from_date=None, to_date=None, company=None):
    # Set default dates
    if not to_date:
        to_date = nowdate()
    if not from_date:
        from_date = add_days(to_date, -1)

    # Get default currency and precision
    currency = frappe.db.get_single_value("Global Defaults", "default_currency")
    currency_precision = get_currency_precision() or 2

    # Filters for Receivables and Payables
    base_filters = {
        "report_date": to_date,
        "company": company,
        "show_future_payments": False,
        "show_gl_balance": False
    }

    # --- Receivables ---
    filters_receivable = base_filters.copy()
    filters_receivable["account_type"] = "Receivable"
    receivables = ReceivablePayableReport(filters_receivable).run()[1]

    # --- Payables ---
    filters_payable = base_filters.copy()
    filters_payable["account_type"] = "Payable"
    payables = ReceivablePayableReport(filters_payable).run()[1]

    # --- Advance Payments ---
    customer_advance = get_partywise_advanced_payment_amount(["Customer"], to_date, False, company) or {}
    supplier_advance = get_partywise_advanced_payment_amount(["Supplier"], to_date, False, company) or {}

    # --- Payment Entries ---
    customer_received = frappe.db.sql("""
        SELECT party, SUM(paid_amount) AS received
        FROM `tabPayment Entry`
        WHERE docstatus = 1 AND payment_type = 'Receive'
        AND posting_date BETWEEN %s AND %s
        AND company = %s
        GROUP BY party
    """, (from_date, to_date, company), as_dict=True)

    supplier_paid = frappe.db.sql("""
        SELECT party, SUM(paid_amount) AS paid
        FROM `tabPayment Entry`
        WHERE docstatus = 1 AND payment_type = 'Pay'
        AND posting_date BETWEEN %s AND %s
        AND company = %s
        GROUP BY party
    """, (from_date, to_date, company), as_dict=True)

    # --- Process Receivables ---
    customer_receivable_data = []
    for d in receivables:
        if flt(d.outstanding, currency_precision) == 0:
            continue
        row = {
            "customer": d.party,
            "customer_name": frappe.get_cached_value("Customer", d.party, "customer_name") if d.party else "",
            "receivable": flt(d.outstanding, currency_precision),
            "advance": flt(customer_advance.get(d.party, 0), currency_precision),
            "credit_note": flt(d.credit_note, currency_precision),
        }
        customer_receivable_data.append(row)

    # --- Process Payables ---
    supplier_payable_data = []
    for d in payables:
        if flt(d.outstanding, currency_precision) == 0:
            continue
        row = {
            "supplier": d.party,
            "supplier_name": frappe.get_cached_value("Supplier", d.party, "supplier_name") if d.party else "",
            "payable": flt(d.outstanding, currency_precision),
            "advance": flt(supplier_advance.get(d.party, 0), currency_precision),
            "debit_note": flt(d.credit_note, currency_precision),
        }
        supplier_payable_data.append(row)

    # --- Format Data into HTML Tables ---
    def to_table(rows, currency):
        if not rows:
            return "<p>No Data</p>"

        html = "<table class='table table-bordered table-sm table-hover'><thead><tr>"
        html += "".join(f"<th>{key.replace('_', ' ').title()}</th>" for key in rows[0].keys())
        html += "</tr></thead><tbody>"

        for row in rows:
            html += "<tr>"
            for key, val in row.items():
                if isinstance(val, (int, float)):
                    val = fmt_money(val, currency=currency, precision=currency_precision)
                    html += f"<td style='text-align:right'>{val}</td>"
                else:
                    html += f"<td>{val}</td>"
            html += "</tr>"

        html += "</tbody></table>"
        return html

    return {
        "customer_receivable": to_table(customer_receivable_data, currency),
        "supplier_payable": to_table(supplier_payable_data, currency),
        "customer_received": to_table(customer_received, currency),
        "supplier_paid": to_table(supplier_paid, currency),
    }
