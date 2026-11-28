import frappe
from datetime import datetime

# in kds.py
#@frappe.whitelist()
#def get_context(context):
#    context.js = ["page/kds/kds.vue"]  # or appropriate path
#    context.css = ["page/kds/kds.css"]

@frappe.whitelist()
def get_kitchen_tickets(company=None, unit=None, status=None, from_date=None, to_date=None):
    """Fetch filtered Kitchen Tickets"""
    filters = {}

    if company:
        filters["company"] = company
    if unit:
        filters["kitchen_production_unit"] = unit
    if from_date and to_date:
        filters["creation"] = ["between", [from_date, to_date]]
    if status:
        filters["status"] = status
    else:
        filters["status"] = ["!=", "Served"]

    tickets = frappe.get_all(
        "Kitchen Ticket",
        filters=filters,
        fields=["name", "sales_invoice", "status", "kitchen_production_unit", "creation", "company"],
        order_by="creation desc"
    )

    return tickets


@frappe.whitelist()
def update_ticket_status(ticket_name, new_status):
    """Update the status of a ticket and notify in realtime"""
    if not frappe.db.exists("Kitchen Ticket", ticket_name):
        return {"success": False, "error": "Ticket not found"}

    ticket = frappe.get_doc("Kitchen Ticket", ticket_name)
    ticket.status = new_status
    ticket.save(ignore_permissions=True)

    frappe.publish_realtime("kds_refresh", {"ticket": ticket.name, "status": new_status})

    return {"success": True}


@frappe.whitelist()
def notify_new_ticket(ticket_name):
    """Call this from hooks or after_insert in Kitchen Ticket"""
    if frappe.db.exists("Kitchen Ticket", ticket_name):
        ticket = frappe.get_doc("Kitchen Ticket", ticket_name)
        frappe.publish_realtime("kds_refresh", {"ticket": ticket.name, "unit": ticket.kitchen_production_unit})

        # Get sound file path (from POS Profile or fallback)
        sound_url = None
        if hasattr(ticket, "pos_profile") and ticket.pos_profile:
            sound_url = frappe.db.get_value("POS Profile", ticket.pos_profile, "custom_kot_sound")

        # Default to built-in alert if no file uploaded
        if not sound_url:
            sound_url = "/assets/posawesome/sounds/kot_alert.mp3"

