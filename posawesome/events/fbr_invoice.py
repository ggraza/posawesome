import frappe
import os
from pyqrcode import create as _qrcreate  # v16: PyQRCode ships with Frappe
from pathlib import Path
from frappe import _
import json
import requests
from pyqrcode import create as qrcreate

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

