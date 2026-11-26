import frappe
import os
import qrcode
import json
import requests
import time
import ssl
from requests.adapters import HTTPAdapter
from requests.exceptions import RequestException, SSLError, ConnectionError
from urllib3.poolmanager import PoolManager
from pyqrcode import create as qrcreate


# --- Custom HTTPS Adapter to force TLS 1.2+ ---
class TLSAdapter(HTTPAdapter):
    def init_poolmanager(self, *args, **kwargs):
        ctx = ssl.create_default_context()
        ctx.minimum_version = ssl.TLSVersion.TLSv1_2
        kwargs["ssl_context"] = ctx
        return super().init_poolmanager(*args, **kwargs)


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
            img = qrcode.make(code)
            img.save(qr_file_path)

        return qr_file_path
    except Exception:
        frappe.log_error(f"Error in generate_fbr_barcode: {frappe.get_traceback()}")
        frappe.throw("Failed to generate FBR barcode. Check error logs.")


def submit_to_fbr(doc, method):
    if not doc.custom_allow_fbr_on_submit:
        frappe.log_error(
            f"Invoice {doc.name} skipped FBR submission: custom_allow_fbr_on_submit is not enabled",
            "FBR Integration Skip"
        )
        return

    if not (doc.fbr_pos_token and doc.pos_id and doc.ntn_no):
        frappe.log_error(
            f"Invoice {doc.name} skipped FBR submission: Missing fbr_pos_token, pos_id, or ntn_no",
            "FBR Integration Skip"
        )
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

    session = requests.Session()
    session.mount("https://", TLSAdapter())

    url = "https://gw.fbr.gov.pk/imsp/v1/api/Live/PostData"
    max_retries = 3

    for attempt in range(max_retries):
        try:
            response = session.post(
                url=url,
                headers=headers,
                data=json.dumps(data),
                timeout=30,
                verify=True
            )

            if response.status_code == 200:
                res_data = response.json()
                invoice_number = res_data.get("InvoiceNumber", "")
                frappe.db.set_value(doc.doctype, doc.name, "fbr_invoice_no", invoice_number)
                generate_fbr_barcode(invoice_number, doc.name)
                frappe.db.commit()
                frappe.log_error(
                    f"FBR Integration Success\nStatus: {response.status_code}\nResponse: {response.text}",
                    "FBR Integration Success"
                )
                return
            else:
                frappe.log_error(
                    f"FBR Integration Failed\nStatus: {response.status_code}\nResponse: {response.text}",
                    "FBR Integration Error"
                )

        except (SSLError, ConnectionError) as ssl_err:
            frappe.log_error(
                #f"FBR SSL/Connection Error (Attempt {attempt+1}): {str(ssl_err)}",
                #"FBR SSL Error"
                title="FBR SSL/Connection Error",
                message=f"Invoice: {doc.name}\nAttempt: {attempt+1}\nError: {str(ssl_err)}"

            )
        except RequestException as req_err:
            frappe.log_error(
                f"FBR Integration Exception (Attempt {attempt+1}): {str(req_err)}",
                "FBR Integration Error"
            )

        if attempt < max_retries - 1:
            time.sleep(2)

    frappe.msgprint(
        f"Failed to submit invoice {doc.name} to FBR after {max_retries} attempts. Check error logs.",
        alert=True
    )
