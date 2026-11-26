# Copyright (c) 2026, Youssef Restom and contributors
# For license information, please see license.txt

"""What the customer price checker screens (/app/price_kiosk) show around the
price: top bar, ticker, centre slideshow / video, left and right sidebars,
colours and timings. Each display applies to some POS Profiles (or all) and
can run between dates; every slide and ticker line has its own dates, daily
hours and days. When several displays match a screen, the highest priority
one that is valid at that moment runs (decided on the kiosk, so the schedule
also works offline). See posawesome/posawesome/api/kiosk_display.py."""

import re

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint, getdate

from posawesome.posawesome.api.kiosk_display import (
    IMAGE_EXTENSIONS,
    VIDEO_EXTENSIONS,
    file_extension,
    normalise_weekdays,
    notify_change,
)

HEX_COLOUR = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")
COLOUR_FIELDS = (
    "background_color",
    "text_color",
    "heading_color",
    "price_color",
    "accent_color",
    "offer_color",
    "ticker_background",
    "ticker_text_color",
)
# (field, label, lowest, highest); 0 / empty takes the default where allowed
RANGES = (
    ("slide_seconds", "Seconds Per Slide", 2, 600),
    ("result_seconds", "Show Price For (Seconds)", 3, 300),
    ("not_found_seconds", "Show Not Found For (Seconds)", 2, 120),
    ("offer_rotate_seconds", "Offers Scroll Every (Seconds)", 2, 120),
    ("ticker_speed", "Ticker Speed", 20, 400),
    ("refresh_minutes", "Check For Changes Every (Minutes)", 1, 1440),
    ("font_scale", "Text Size (%)", 60, 200),
    ("max_cache_mb", "Media Storage Limit (MB)", 50, 20000),
    ("left_sidebar_width", "Left Width (%)", 10, 35),
    ("right_sidebar_width", "Right Width (%)", 15, 40),
    ("left_min_screen_width", "Hide Left Below Screen Width", 0, 10000),
    ("max_video_seconds", "Cut Videos After (Seconds)", 0, 7200),
)


class POSKioskDisplay(Document):
    def validate(self):
        self.validate_dates(self, _("Display"))
        self.validate_profiles()
        self.validate_numbers()
        self.validate_colours()
        self.validate_public_file(self.logo, _("Logo"), IMAGE_EXTENSIONS)
        self.validate_public_file(self.background_image, _("Background Image"), IMAGE_EXTENSIONS)
        self.validate_slides()
        self.validate_ticker()
        self.warn_overlaps()

    # ----- checks ----------------------------------------------------------

    @staticmethod
    def validate_dates(row, where):
        if row.valid_from and row.valid_upto and getdate(row.valid_from) > getdate(row.valid_upto):
            frappe.throw(_("{0}: Valid From must be on or before Valid Upto").format(where))

    def validate_profiles(self):
        if cint(self.apply_to_all_profiles):
            self.pos_profiles = []
            return
        if not self.pos_profiles:
            frappe.throw(_("Add at least one POS Profile, or tick All POS Profiles"))
        seen = set()
        for row in self.pos_profiles:
            if row.pos_profile in seen:
                frappe.throw(_("Row {0}: POS Profile {1} is listed twice").format(row.idx, row.pos_profile))
            seen.add(row.pos_profile)
            if self.company:
                company = frappe.db.get_value("POS Profile", row.pos_profile, "company")
                if company and company != self.company:
                    frappe.throw(
                        _("Row {0}: POS Profile {1} belongs to {2}, not {3}").format(
                            row.idx, row.pos_profile, company, self.company
                        )
                    )

    def validate_numbers(self):
        for field, label, low, high in RANGES:
            value = cint(self.get(field))
            if field in ("max_video_seconds", "left_min_screen_width") and value == 0:
                continue
            if value < low or value > high:
                frappe.throw(_("{0} must be between {1} and {2}").format(_(label), low, high))
        widths = (cint(self.left_sidebar_width) if cint(self.show_left_sidebar) else 0) + (
            cint(self.right_sidebar_width) if cint(self.show_right_sidebar) else 0
        )
        if widths > 60:
            frappe.throw(_("The two sidebars together may take at most 60% of the width (now {0}%)").format(widths))

    def validate_colours(self):
        for field in COLOUR_FIELDS:
            value = (self.get(field) or "").strip()
            self.set(field, value)
            if value and not HEX_COLOUR.match(value):
                frappe.throw(_("{0}: {1} is not a colour such as #ffffff").format(self.meta.get_label(field), value))

    @staticmethod
    def validate_public_file(url, label, extensions):
        if not url:
            return
        if url.startswith("/private/"):
            frappe.throw(
                _("{0}: {1} is a private file. Kiosk screens cannot open private files; upload it again with Is Private unticked.").format(
                    label, url
                )
            )
        ext = file_extension(url)
        if ext and ext not in extensions:
            frappe.throw(_("{0}: {1} files are not supported here (use {2})").format(label, ext, ", ".join(sorted(extensions))))

    def validate_slides(self):
        for row in self.slides:
            where = _("Slide row {0}").format(row.idx)
            self.validate_dates(row, where)
            row.weekdays = self.clean_weekdays(row.weekdays, where)
            kind = row.slide_type
            if kind == "Image":
                if not row.image:
                    frappe.throw(_("{0}: attach an image").format(where))
                self.validate_public_file(row.image, where, IMAGE_EXTENSIONS)
            elif kind == "Text":
                if not (row.title or "").strip():
                    frappe.throw(_("{0}: a Text slide needs a title").format(where))
                self.validate_public_file(row.image, where, IMAGE_EXTENSIONS)
            elif kind == "Video":
                if not row.video and not row.video_url:
                    frappe.throw(_("{0}: attach a video file or enter a video link").format(where))
                if row.video:
                    self.validate_public_file(row.video, where, VIDEO_EXTENSIONS)
                if row.video_url:
                    url = row.video_url.strip()
                    if not re.match(r"^https?://", url, re.I):
                        frappe.throw(_("{0}: the video link must start with https://").format(where))
                    if re.search(r"(youtube\.com|youtu\.be|vimeo\.com|facebook\.com)/", url, re.I):
                        frappe.throw(
                            _("{0}: {1} is a web page, not a video file. Upload the MP4 file instead.").format(where, url)
                        )
                    row.video_url = url
            elif kind == "Item":
                if not row.item_code:
                    frappe.throw(_("{0}: choose an item").format(where))
                disabled, is_sales = frappe.db.get_value("Item", row.item_code, ["disabled", "is_sales_item"]) or (0, 1)
                if cint(disabled) or not cint(is_sales):
                    frappe.msgprint(
                        _("{0}: item {1} is disabled or not a sales item; the kiosk will skip it").format(where, row.item_code),
                        indicator="orange",
                        alert=True,
                    )
            elif kind == "POS Offer":
                if not row.pos_offer:
                    frappe.throw(_("{0}: choose a POS Offer").format(where))
                if cint(frappe.db.get_value("POS Offer", row.pos_offer, "disable")):
                    frappe.msgprint(
                        _("{0}: POS Offer {1} is disabled; the kiosk will skip it").format(where, row.pos_offer),
                        indicator="orange",
                        alert=True,
                    )
            if cint(row.duration) < 0:
                frappe.throw(_("{0}: Seconds On Screen cannot be negative").format(where))
            if row.zone == "Left Sidebar" and not cint(self.show_left_sidebar) and cint(row.enabled):
                frappe.msgprint(
                    _("{0} is for the left sidebar, which is switched off").format(where), indicator="orange", alert=True
                )

    def validate_ticker(self):
        for row in self.ticker_items:
            where = _("Ticker row {0}").format(row.idx)
            row.text = (row.text or "").strip()
            if not row.text:
                frappe.throw(_("{0}: enter the text").format(where))
            self.validate_dates(row, where)
            row.weekdays = self.clean_weekdays(row.weekdays, where)

    @staticmethod
    def clean_weekdays(value, where):
        try:
            return normalise_weekdays(value)
        except ValueError as e:
            frappe.throw(_("{0}: {1} is not a day. Use Mon, Tue, Wed, Thu, Fri, Sat, Sun.").format(where, str(e)))

    def warn_overlaps(self):
        """Two enabled displays with the same priority on the same POS Profile
        and overlapping dates: the kiosk would pick by last change, which is
        rarely what was meant."""
        if not cint(self.enabled):
            return
        others = frappe.get_all(
            "POS Kiosk Display",
            filters={"enabled": 1, "priority": cint(self.priority), "name": ["!=", self.name or ""]},
            fields=["name", "apply_to_all_profiles", "valid_from", "valid_upto", "company"],
        )
        mine = {r.pos_profile for r in self.pos_profiles}
        for other in others:
            if not _dates_overlap(self.valid_from, self.valid_upto, other.valid_from, other.valid_upto):
                continue
            if self.company and other.company and self.company != other.company:
                continue
            theirs = set(
                frappe.get_all("POS Kiosk Display Profile", filters={"parent": other.name}, pluck="pos_profile")
            )
            shared = (
                cint(self.apply_to_all_profiles) or cint(other.apply_to_all_profiles) or bool(mine & theirs)
            )
            if shared:
                frappe.msgprint(
                    _(
                        "Display {0} also runs on some of these POS Profiles with the same priority ({1}) and overlapping dates. Give one of them a higher priority."
                    ).format(frappe.bold(other.name), cint(self.priority)),
                    indicator="orange",
                    title=_("Same priority"),
                )
                break

    # ----- live update -----------------------------------------------------

    def on_update(self):
        notify_change(self)

    def on_trash(self):
        notify_change(self, removed=True)

    def after_rename(self, old, new, merge=False):
        notify_change(self)


def _dates_overlap(a_from, a_upto, b_from, b_upto):
    lo = max(getdate(a_from) if a_from else getdate("1900-01-01"), getdate(b_from) if b_from else getdate("1900-01-01"))
    hi = min(getdate(a_upto) if a_upto else getdate("2999-12-31"), getdate(b_upto) if b_upto else getdate("2999-12-31"))
    return lo <= hi
