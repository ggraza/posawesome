import frappe
from frappe.model.document import Document
import os
import json
import requests
import time
from requests.exceptions import RequestException
from pyqrcode import create as qrcreate  # shipped with Frappe (PyQRCode); PNG output uses pypng from ERPNext

@frappe.whitelist()
def set_invoice_number(doctype, name, inv):
    try:
        doc = frappe.get_doc(doctype, name)
        doc.db_set("fbr_invoice_no", inv)
        generate_fbr_barcode(inv, name)
        frappe.db.commit()
        return {"status": "success", "message": "FBR Invoice Number updated successfully"}
    except Exception as e:
        frappe.log_error(f"FBR Invoice Update Failed: {str(e)}", "FBR Integration")
        return {"status": "error", "message": str(e)}

@frappe.whitelist()
def set_invoice_number_e(doctype, name, inv):
    frappe.db.set_value(doctype, name, "fbr_invoice_no", inv)
    generate_fbr_barcode(inv, name)
    frappe.db.commit()

@frappe.whitelist()
def generate_fbr_barcode(code=None, docname=None):
    try:
        if not code or not docname:
            frappe.throw("Invalid QR Code data or document name.")

        name_tobe = f"{docname}.png"
        site_dir_path = frappe.utils.get_bench_path()
        current_site = frappe.local.site or frappe.get_site_path().split("/")[-1]
        site_path = os.path.join(site_dir_path, "sites", current_site)
        qrcode_dir = os.path.join(site_path, "public", "files", "qrcodes")
        os.makedirs(qrcode_dir, mode=0o775, exist_ok=True)
        qr_file_path = os.path.join(qrcode_dir, name_tobe)

        if not os.path.isfile(qr_file_path):
            # v16: the third-party `qrcode` package is not a Frappe/ERPNext dependency,
            # use PyQRCode (Frappe) + pypng (ERPNext) instead.
            qrcreate(str(code)).png(qr_file_path, scale=6, quiet_zone=2)

        return qr_file_path
    except Exception as ex:
        frappe.log_error(f"Error in generate_fbr_barcode: {frappe.get_traceback()}")
        frappe.throw("Failed to generate FBR barcode. Check error logs.")

@frappe.whitelist()
def _submit_to_fbr_legacy(doctype=None, name=None):
    if not doctype or not name:
        frappe.throw("doctype and name are required")

    # Get the document from database
    doc = frappe.get_doc(doctype, name)

    if not doc.get("custom_allow_fbr_on_submit"):
        frappe.log_error(f"Invoice {doc.name} skipped FBR submission: custom_allow_fbr_on_submit is not enabled", "FBR Integration Skip")
        return

    if not (doc.get("fbr_pos_token") and doc.get("pos_id") and doc.get("ntn_no")):
        frappe.log_error(f"Invoice {doc.name} skipped FBR submission: Missing fbr_pos_token, pos_id, or ntn_no", "FBR Integration Skip")
        return

    if doc.fbr_invoice_no:
        frappe.log_error(f"Invoice {doc.name} Already Submitted", "FBR Integration Skip")
        return

    item_list = []
    total_qty = 0
    tax_rate = doc.taxes[0].rate if doc.taxes and len(doc.taxes) > 0 else 0

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
        "BuyerCNIC": 9999999999999,
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

    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = requests.post(
                url="https://gw.fbr.gov.pk/imsp/v1/api/Live/PostData",
                headers=headers,
                data=json.dumps(data),
                timeout=30,
                verify=True
            )
            if response.status_code == 200:
                res_data = response.json()
                invoice_number = res_data.get('InvoiceNumber', '')
                frappe.db.set_value(doc.doctype, doc.name, 'fbr_invoice_no', invoice_number)
                generate_fbr_barcode(invoice_number, doc.name)
                frappe.db.commit()
                frappe.log_error(f"FBR Integration Success\nStatus: {response.status_code}\nResponse: {response.text}", "FBR Integration Success")
                return {"status": "success", "invoice_number": invoice_number}
            else:
                frappe.log_error(f"FBR Integration Failed\nStatus: {response.status_code}\nResponse: {response.text}", "FBR Integration Error")
        except RequestException as e:
            frappe.log_error(f"FBR Integration Exception (Attempt {attempt + 1}): {str(e)}", "FBR Integration Error")
            if attempt < max_retries - 1:
                time.sleep(2)
                continue
        frappe.msgprint(f"Failed to submit invoice {doc.name} to FBR after {max_retries} attempts. Check error logs.", alert=True)
        return {"status": "error"}

@frappe.whitelist()
def submit_to_fbr(doctype=None, name=None):
    # Works both as a whitelisted call (doctype, name) and as a doc_event hook
    # (doc, method) - the v14 hook passed the Document positionally.
    if isinstance(doctype, Document):
        doc = doctype
    else:
        if not doctype or not name:
            frappe.throw("doctype and name are required")
        doc = frappe.get_doc(doctype, name)

    if not doc.get("custom_allow_fbr_on_submit"):
        frappe.log_error(f"Invoice {doc.name} skipped FBR submission: custom_allow_fbr_on_submit is not enabled", "FBR Integration Skip")
        return

    if not (doc.get("fbr_pos_token") and doc.get("pos_id") and doc.get("ntn_no")):
        frappe.log_error(f"Invoice {doc.name} skipped FBR submission: Missing fbr_pos_token, pos_id, or ntn_no", "FBR Integration Skip")
        return

    item_list = []
    total_qty = 0
    tax_rate = doc.taxes[0].rate if doc.taxes and len(doc.taxes) > 0 else 0

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
        "BuyerCNIC": 9999999999999,
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

    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = requests.post(
                url="https://gw.fbr.gov.pk/imsp/v1/api/Live/PostData",
                headers=headers,
                data=json.dumps(data),
                timeout=30,
                verify=True
            )
            if response.status_code == 200:
                res_data = response.json()
                invoice_number = res_data.get('InvoiceNumber', '')
                frappe.db.set_value(doc.doctype, doc.name, 'fbr_invoice_no', invoice_number)
                generate_fbr_barcode(invoice_number, doc.name)
                frappe.db.commit()
                frappe.log_error(f"FBR Integration Success\nStatus: {response.status_code}\nResponse: {response.text}", "FBR Integration Success")
                return {"status": "success", "invoice_number": invoice_number}
            else:
                frappe.log_error(f"FBR Integration Failed\nStatus: {response.status_code}\nResponse: {response.text}", "FBR Integration Error")
        except RequestException as e:
            frappe.log_error(f"FBR Integration Exception (Attempt {attempt + 1}): {str(e)}", "FBR Integration Error")
            if attempt < max_retries - 1:
                time.sleep(2)
                continue
        frappe.msgprint(f"Failed to submit invoice {doc.name} to FBR after {max_retries} attempts. Check error logs.", alert=True)
        return {"status": "error"}

@frappe.whitelist()
def submit_to_fbr_hook(doc, method):
    if not doc.get("custom_allow_fbr_on_submit"):
        frappe.log_error(f"Invoice {doc.name} skipped FBR submission: custom_allow_fbr_on_submit is not enabled", "FBR Integration Skip")
        return
    if not (doc.get("fbr_pos_token") and doc.get("pos_id") and doc.get("ntn_no")):
        frappe.log_error(f"Invoice {doc.name} skipped FBR submission: Missing fbr_pos_token, pos_id, or ntn_no", "FBR Integration Skip")
        return

    item_list = []
    total_qty = 0
    tax_rate = doc.taxes[0].rate if doc.taxes and len(doc.taxes) > 0 else 0

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
        "BuyerCNIC": 9999999999999,
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

    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = requests.post(
                url="https://gw.fbr.gov.pk/imsp/v1/api/Live/PostData",
                headers=headers,
                data=json.dumps(data),
                timeout=30,
                verify=True
            )
            if response.status_code == 200:
                res_data = response.json()
                invoice_number = res_data.get('InvoiceNumber', '')
                frappe.db.set_value(doc.doctype, doc.name, 'fbr_invoice_no', invoice_number)
                generate_fbr_barcode(invoice_number, doc.name)
                frappe.db.commit()
                frappe.log_error(f"FBR Integration Success\nStatus: {response.status_code}\nResponse: {response.text}", "FBR Integration Success")
                return
            else:
                frappe.log_error(f"FBR Integration Failed\nStatus: {response.status_code}\nResponse: {response.text}", "FBR Integration Error")
        except RequestException as e:
            frappe.log_error(f"FBR Integration Exception (Attempt {attempt + 1}): {str(e)}", "FBR Integration Error")
            if attempt < max_retries - 1:
                time.sleep(2)
                continue
        frappe.msgprint(f"Failed to submit invoice {doc.name} to FBR after {max_retries} attempts. Check error logs.", alert=True)
