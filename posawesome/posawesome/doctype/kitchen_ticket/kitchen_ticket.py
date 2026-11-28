# Copyright (c) 2025, Youssef Restom and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from posawesome.posawesome.page.kds.kds import notify_new_ticket

class KitchenTicket(Document):
    def after_insert(self):
        """Trigger realtime KDS update when a new Kitchen Ticket is created"""
        try:
            notify_new_ticket(self.name)
            frappe.logger().info(f"KDS notified for new ticket: {self.name}")
        except Exception as e:
            frappe.log_error(f"Error notifying KDS after insert for {self.name}: {str(e)}", "KDS Notify Error")

    def on_update(self):
        """Trigger realtime KDS update when ticket status or data changes"""
        try:
            notify_new_ticket(self.name)
            frappe.logger().info(f"KDS notified for updated ticket: {self.name}")
        except Exception as e:
            frappe.log_error(f"Error notifying KDS on update for {self.name}: {str(e)}", "KDS Notify Error")
