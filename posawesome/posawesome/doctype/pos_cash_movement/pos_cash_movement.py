# Copyright (c) 2026, Youssef Restom and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt


class POSCashMovement(Document):
	def validate(self):
		from posawesome.posawesome.api import supermarket as sm

		if flt(self.amount) <= 0:
			frappe.throw(_("Enter the amount"))
		shift = frappe.db.get_value(
			"POS Opening Shift", self.pos_opening_shift, ["status", "pos_profile", "user", "company"], as_dict=True
		)
		if not shift:
			frappe.throw(_("POS Opening Shift {0} not found").format(self.pos_opening_shift))
		if shift.pos_profile != self.pos_profile:
			frappe.throw(_("The shift belongs to POS Profile {0}").format(shift.pos_profile))
		if self.docstatus == 0 and shift.status != "Open" and not self.offline:
			frappe.throw(_("The shift {0} is closed").format(self.pos_opening_shift))
		self.user = self.user or shift.user
		self.company = self.company or shift.company
		s = sm.settings(self.pos_profile)
		if not self.mode_of_payment:
			self.mode_of_payment = s.cash_mode_of_payment
		sm.check_approval_for(s, self.movement_type, self.approval, offline=self.offline)

	def on_submit(self):
		from posawesome.posawesome.api import supermarket as sm

		sm.make_cash_journal(self)
		if self.approval:
			sm.mark_approval_used(self.approval, None)

	def on_cancel(self):
		if self.journal_entry:
			je = frappe.get_doc("Journal Entry", self.journal_entry)
			if je.docstatus == 1:
				je.flags.ignore_permissions = True
				je.cancel()
