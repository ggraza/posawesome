# Copyright (c) 2026, Youssef Restom and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint, flt, getdate


class POSDeal(Document):
	def validate(self):
		from posawesome.posawesome.api import supermarket as sm

		if cint(self.quantity) < 2:
			frappe.throw(_("Quantity must be 2 or more (for one item use a price instead)"))
		if flt(self.deal_price) <= 0:
			frappe.throw(_("Enter the Deal Price"))
		if not (self.items or self.item_groups or self.brands):
			frappe.throw(_("Add the items, item groups or brands of the deal"))
		if self.valid_from and self.valid_upto and getdate(self.valid_from) > getdate(self.valid_upto):
			frappe.throw(_("Valid From is after Valid Upto"))
		if bool(self.daily_from) != bool(self.daily_to):
			frappe.throw(_("Set both Daily From and Daily To, or neither"))
		self.days = sm.clean_days(self.days)
		if not cint(self.repeat):
			self.max_sets = 0

	def on_update(self):
		frappe.publish_realtime("posa_deals_changed", {"deal": self.name}, after_commit=True)

	def on_trash(self):
		frappe.publish_realtime("posa_deals_changed", {"deal": self.name}, after_commit=True)
