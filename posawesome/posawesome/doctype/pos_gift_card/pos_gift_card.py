# Copyright (c) 2026, Youssef Restom and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt


class POSGiftCard(Document):
	def validate(self):
		self.card_no = (self.card_no or "").strip()
		if not self.card_no or len(self.card_no) > 40 or not all(c.isalnum() or c in "-_" for c in self.card_no):
			frappe.throw(_("Card No: letters, digits, - and _ only (up to 40)"))
		self.balance = round(sum(flt(e.amount) for e in self.entries), 2)
