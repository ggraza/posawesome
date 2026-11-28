# Copyright (c) 2026, Youssef Restom and contributors
# For license information, please see license.txt

from frappe.model.document import Document


class POSManagerPIN(Document):
	def validate(self):
		from posawesome.posawesome.api import supermarket as sm

		sm.validate_manager_pin(self)
