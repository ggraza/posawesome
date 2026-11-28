from frappe import _

def get_data():
    return {
        "fieldname": "rfid_number",
        "non_standard_fieldnames": {
            "Sales Invoice": "custom_rfid_card",
            "Sales Invoice Item": "custom_rfid_card",
        },
        "internal_and_external_links": {
            "Sales Invoice": ["items", "custom_rfid_card"],
        },
        "transactions": [
            {"label": _("Reference"), "items": ["Sales Invoice", "POS Profile"]},
        ],
    }
