# Copyright (c) 2026, Youssef Restom and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import add_to_date, cint, get_datetime, now_datetime


class POSReservation(Document):
	def validate(self):
		if cint(self.party_size) < 1:
			frappe.throw(_("Guests must be at least 1"))
		if self.is_waitlist:
			self.reservation_start = self.reservation_start or now_datetime()
			self.reservation_end = None
			return
		if not self.reservation_start:
			frappe.throw(_("Enter the date and time"))
		self.reservation_end = add_to_date(get_datetime(self.reservation_start), minutes=cint(self.duration_minutes) or 90)
		if self.service_table:
			zone, seats = frappe.db.get_value("Service Table", self.service_table, ["service_zone", "no_of_seats"]) or (None, 0)
			self.service_zone = self.service_zone or zone
			if cint(seats) and cint(self.party_size) > cint(seats):
				frappe.msgprint(_("Table {0} has {1} seats for {2} guests").format(self.service_table, seats, self.party_size),
					indicator="orange", alert=True)
			if self.status in ("Booked", "Confirmed", "Arrived"):
				from posawesome.posawesome.api.fine_dining_guests import overlapping

				clash = overlapping(self.service_table, self.reservation_start, self.reservation_end, self.name)
				if clash:
					frappe.throw(_("Table {0} is already booked then ({1}, {2})").format(
						self.service_table, clash[0].guest_name, clash[0].reservation_start))
