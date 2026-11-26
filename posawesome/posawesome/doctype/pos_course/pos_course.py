# Copyright (c) 2026, Youssef Restom and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class POSCourse(Document):
	def validate(self):
		seen = set()
		for row in self.item_groups:
			if row.item_group in seen:
				frappe.throw(_("Item Group {0} is listed twice").format(row.item_group))
			seen.add(row.item_group)
			other = frappe.db.sql(
				"""select c.name from `tabPOS Course Item Group` g join `tabPOS Course` c on c.name = g.parent
				where g.parenttype = 'POS Course' and g.item_group = %s and c.name != %s and c.disabled = 0 limit 1""",
				(row.item_group, self.name or ""),
			)
			if other and not self.disabled:
				frappe.throw(
					_("Item Group {0} is already the default of course {1}").format(row.item_group, other[0][0])
				)
