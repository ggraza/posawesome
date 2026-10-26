import datetime
import frappe
import os
from pyqrcode import create as _qrcreate  # v16: PyQRCode ships with Frappe
from pathlib import Path
from frappe import _
import json
import requests
from pyqrcode import create as qrcreate

@frappe.whitelist()
def generate_invoice_number(doc):
    item_list = []
    total_qty = 0
    tax_rate = doc.taxes[0].rate if doc.taxes else 0

    for item in doc.items:
        salevalue = item.rate * item.qty
        item_list.append({
            "ItemCode": item.item_code,
            "ItemName": item.item_name,
            "Quantity": item.qty,
            "PCTCode": "11001010",
            "TaxRate": tax_rate,
            "SaleValue": salevalue,
            "TotalAmount": salevalue * (1 + (tax_rate / 100)),
            "TaxCharged": (salevalue / 100) * tax_rate,
            "Discount": "0.0",
            "FurtherTax": 0,
            "InvoiceType": 1,
            "RefUSIN": None
        })
        total_qty += item.qty

    data = {
        "InvoiceNumber": "",
        "POSID": doc.pos_id,
        "USIN": doc.name,
        "DateTime": str(doc.posting_date),
        "BuyerNTN": None,
        "BuyerCNIC": None,
        "BuyerName": doc.customer,
        "BuyerPhoneNumber": None,
        "TotalBillAmount": doc.rounded_total,
        "TotalQuantity": total_qty,
        "TotalSaleValue": doc.net_total,
        "TotalTaxCharged": doc.total_taxes_and_charges,
        "Discount": "0",
        "FurtherTax": "0",
        "PaymentMode": 1,
        "RefUSIN": None,
        "InvoiceType": 1,
        "Items": item_list
    }

    headers = {
        "Authorization": f"Bearer {doc.fbr_pos_token}",
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(
            url="https://gw.fbr.gov.pk/imsp/v1/api/Live/PostData",
            headers=headers,
            data=json.dumps(data),
            timeout=30
        )

        if response.status_code == 200:
            res_data = response.json()
            invoice_number = res_data.get('InvoiceNumber', '')
            frappe.db.set_value(doc.doctype, doc.name, 'fbr_invoice_no', invoice_number)
            generate_fbr_barcode(invoice_number, doc.name)
            frappe.db.commit()
            frappe.log_error(f"FBR Integration Success\nStatus: {response.status_code}\nResponse: {response.text}", "FBR Integration Sucsess")
        else:
            frappe.log_error(f"FBR Integration Failed\nStatus: {response.status_code}\nResponse: {response.text}", "FBR Integration Error")

    except Exception as e:
        frappe.log_error(f"FBR Integration Exception: {str(e)}", "FBR Integration Error")


@frappe.whitelist()
def generate_fbr_barcode(code=None, docname=None):
    try:
        if not code or not docname:
            frappe.throw("Invalid QR Code data or document name.")

        name_tobe = f"{docname}.png"

        # ? Dynamically get the site directory path
        site_dir_path = frappe.utils.get_bench_path()
        current_site = frappe.local.site or frappe.get_site_path().split("/")[-1]
        site_path = os.path.join(site_dir_path, "sites", current_site)

        qrcode_dir = os.path.join(site_path, "public", "files", "qrcodes")

        # ? Ensure directory exists
        os.makedirs(qrcode_dir, mode=0o775, exist_ok=True)

        # ? Define the QR code file path
        qr_file_path = os.path.join(qrcode_dir, name_tobe)

        # ? Generate QR code only if the file doesn't exist
        if not os.path.isfile(qr_file_path):
            _qrcreate(str(code)).png(qr_file_path, scale=6, quiet_zone=2)

        return qr_file_path  # Return the file path if needed

    except Exception as ex:
        frappe.log_error(f"Error in generate_fbr_barcode: {frappe.get_traceback()}")
        frappe.throw("Failed to generate FBR barcode. Check error logs.")


@frappe.whitelist()
def update_fbr_invoice_data():
    today = datetime.date.today()
    first_day_of_month = today.replace(day=1)
    invoices = frappe.get_all("Sales Invoice",
        filters={
            "fbr_invoice_no": ["is", "=", None],
            "fbr_pos_token": ["!=", ""],
            "pos_id": ["!=", ""],
            "ntn_no": ["!=", ""],
            "posting_date": [">=", first_day_of_month],
            "pos_profile": ["!=", ""],
            "custom_allow_fbr_on_submit": "0",
            "company": "Satellite Town"
        },
        fields=["name"]
    )

    for inv in invoices:
        try:
            doc = frappe.get_doc("Sales Invoice", inv.name)

            generate_invoice_number(doc)
            # invoice_number = generate_invoice_number(doc)
            # barcode = generate_fbr_barcode(invoice_number, doc.name)

            # doc.fbr_invoice_no = invoice_number
            # doc.fbr_barcode = barcode

            # doc.save(ignore_permissions=True)
            # frappe.db.commit()
        except Exception as e:
            frappe.log_error(frappe.get_traceback(), f"[FBR Job] Failed for {inv.name}")
