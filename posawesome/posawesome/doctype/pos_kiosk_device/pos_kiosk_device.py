# Copyright (c) 2026, Youssef Restom and contributors
# For license information, please see license.txt

"""One customer price checker screen. Created and kept up to date by the
screen itself (api/kiosk_display.heartbeat); managers may rename it."""

from frappe.model.document import Document
from frappe.utils import get_datetime, now_datetime

OFFLINE_AFTER_MINUTES = 15


class POSKioskDevice(Document):
    @property
    def is_alive(self):
        return bool(self.last_seen) and (now_datetime() - get_datetime(self.last_seen)).total_seconds() < OFFLINE_AFTER_MINUTES * 60
