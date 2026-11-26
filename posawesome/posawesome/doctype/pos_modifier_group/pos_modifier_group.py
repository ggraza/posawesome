# Copyright (c) 2026, Youssef Restom and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint


class POSModifierGroup(Document):
	def validate(self):
		if not self.options:
			frappe.throw(_("Add at least one option"))
		names = [(o.option or "").strip().lower() for o in self.options]
		if len(names) != len(set(names)):
			frappe.throw(_("Each option must have a different name"))
		for row in self.applies_to:
			if bool(row.item_code) == bool(row.item_group):
				frappe.throw(_("Row {0} of Applies To: choose an Item or an Item Group (one of them)").format(row.idx))
		mn, mx = cint(self.min_select), cint(self.max_select)
		if self.required and mn < 1:
			self.min_select = mn = 1
		if mx and mn > mx:
			frappe.throw(_("Minimum Choices cannot be more than Maximum Choices"))
		if mx and mn > len(self.options):
			frappe.throw(_("Minimum Choices is more than the number of options"))
		defaults = [o for o in self.options if o.is_default]
		if mx and len(defaults) > mx:
			frappe.throw(_("More options are selected by default than Maximum Choices allows"))
