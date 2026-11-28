# Copyright (c) 2026, Youssef Restom and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class POSQuickKeyPage(Document):
	def validate(self):
		seen = set()
		for row in self.keys:
			if row.item_code in seen:
				frappe.throw(_("Row {0}: {1} is on this page twice").format(row.idx, row.item_code))
			seen.add(row.item_code)
		if len(self.keys) > 60:
			frappe.throw(_("At most 60 buttons on one page; make another page"))

	def on_update(self):
		frappe.publish_realtime("posa_quick_keys_changed", {"page": self.name}, after_commit=True)

	def on_trash(self):
		frappe.publish_realtime("posa_quick_keys_changed", {"page": self.name}, after_commit=True)
