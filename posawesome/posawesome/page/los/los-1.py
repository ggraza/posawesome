#posawesome.posawesome.page.los.los
import frappe
from datetime import datetime


@frappe.whitelist()
def get_live_order_status(company=None, service_zone=None, status=None, from_date=None, to_date=None, search=None):

    filters = {}

    if company:
        filters["company"] = company
    if service_zone:
        filters["service_zone"] = service_zone
    if from_date and to_date:
        filters["creation"] = ["between", [from_date, to_date]]
    if status:
        filters["status"] = status

    if search:
        filters["sales_invoice"] = ["like", f"%{search}%"]

    tickets = frappe.get_all(
        "Queue Ticket",
        filters=filters,
        fields=[
            "name",
            "sales_invoice",
            "status",
            "service_zone",
            "posting_date",
            "time_created",
            "time_prepared",
            "time_ready",
            "creation"
        ],
        order_by="creation desc",
        limit_page_length=200
    )

    return tickets

@frappe.whitelist()
def update_ticket_status(ticket_name, new_status):
    try:
        doc = frappe.get_doc("Queue Ticket", ticket_name)

        doc.status = new_status

        # Update time fields based on status
        if new_status == "Preparing":
            doc.time_prepared = datetime.now().time()

        elif new_status == "Ready":
            doc.time_ready = datetime.now().time()

        doc.save(ignore_permissions=True)
        frappe.db.commit()

        # refresh los screen
        frappe.publish_realtime("los_refresh")

        return {"success": True}

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "LOS Status Update Error")
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def notify_new_ticket(ticket_name):
    """Call this from hooks or after_insert in Queue Ticket"""
    if frappe.db.exists("Queue Ticket", ticket_name):
        ticket = frappe.get_doc("Queue Ticket", ticket_name)
        frappe.publish_realtime("los_refresh", {"ticket": ticket.name, "unit": ticket.kitchen_production_unit})

        # Get sound file path (from POS Profile or fallback)
        sound_url = None
        if hasattr(ticket, "pos_profile") and ticket.pos_profile:
            sound_url = frappe.db.get_value("POS Profile", ticket.pos_profile, "custom_kot_sound")

        # Default to built-in alert if no file uploaded
        if not sound_url:
            sound_url = "/assets/posawesome/sounds/kot_alert.mp3"
