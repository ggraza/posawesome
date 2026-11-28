# Copyright (c) 2026, Youssef Restom and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class POSMarkdown(Document):
	def validate(self):
		from posawesome.posawesome.api import supermarket as sm

		sm.validate_markdown(self)

	def on_submit(self):
		from posawesome.posawesome.api import supermarket as sm

		sm.make_markdown_labels(self)

	def on_cancel(self):
		if any(l.used for l in self.labels):
			frappe.throw(_("Some labels are sold already; they stay valid on those sales"))
		frappe.publish_realtime("posa_markdowns_changed", {"markdown": self.name}, after_commit=True)
