# Copyright (c) 2026, Youssef Restom and contributors
# For license information, please see license.txt
"""Fine dining phase 4: guests.

Switched on per POS Profile (Fine Dining: Guests), each on its own:
* Reservations and Waitlist (`posa_fd_reservations`): POS Reservation; tables
  show Reserved on the floor before a booking; Seat opens the order with the
  party size, customer and allergies; walk-ins wait on the waitlist
* Guest Profiles (`posa_fd_guest_profiles`): preferences, allergies, special
  dates and VIP on the Customer, with visits, last visit, average spend and
  favourite dishes worked out from their invoices; shown when the guest is chosen
* Guest Feedback (`posa_fd_feedback`): the guest check prints a link / QR code
  to a short public form (/pos_feedback); answers are POS Guest Feedback
"""

import hashlib
import json

import frappe
from frappe import _
from frappe.utils import add_to_date, cint, flt, get_datetime, get_url, getdate, now_datetime, nowdate

from posawesome.posawesome.api.fine_dining import _check_profile_access, settings

GUEST_FIELDS = {
    "reservations": "posa_fd_reservations",
    "hold_minutes": "posa_fd_reservation_hold_minutes",
    "guest_profiles": "posa_fd_guest_profiles",
    "feedback": "posa_fd_feedback",
}
ACTIVE = ("Booked", "Confirmed", "Arrived")


def guest_settings(pos_profile):
    out = frappe._dict({k: 0 for k in GUEST_FIELDS})
    if not pos_profile or not settings(pos_profile).enabled:
        return out
    meta = frappe.get_meta("POS Profile")
    fields = [f for f in GUEST_FIELDS.values() if meta.has_field(f)]
    if not fields:
        return out
    row = frappe.db.get_value("POS Profile", pos_profile, fields, as_dict=True) or {}
    for k, f in GUEST_FIELDS.items():
        out[k] = cint(row.get(f))
    if out.reservations and not out.hold_minutes:
        out.hold_minutes = 30
    return out


def _need(pos_profile, key, label):
    _check_profile_access(pos_profile)
    g = guest_settings(pos_profile)
    if not g[key]:
        frappe.throw(_("{0} is not enabled on POS Profile {1}").format(_(label), pos_profile))
    return g


# ------------------------------------------------------------------ reservations
def overlapping(table, start, end, exclude=None):
    """Active bookings of `table` that overlap [start, end)."""
    if not table:
        return []
    rows = frappe.get_all("POS Reservation",
                          filters={"service_table": table, "status": ["in", list(ACTIVE)], "is_waitlist": 0,
                                   "name": ["!=", exclude or ""]},
                          fields=["name", "guest_name", "reservation_start", "reservation_end"])
    s, e = get_datetime(start), get_datetime(end)
    return [r for r in rows if get_datetime(r.reservation_start) < e and s < get_datetime(r.reservation_end)]


@frappe.whitelist()
def get_bookings(pos_profile, date=None):
    """Today's (or `date`'s) bookings and the waitlist."""
    g = _need(pos_profile, "reservations", "Reservations")
    company = frappe.db.get_value("POS Profile", pos_profile, "company")
    day = getdate(date or nowdate())
    fields = ["name", "guest_name", "customer", "phone", "party_size", "reservation_start", "reservation_end",
              "service_table", "status", "notes", "occasion", "allergies", "is_waitlist", "quoted_wait_minutes",
              "creation", "deposit_amount"]
    rows = frappe.get_all("POS Reservation",
                          filters={"company": company, "status": ["in", list(ACTIVE) + ["Seated"]]},
                          fields=fields, order_by="reservation_start asc, creation asc")
    out = {"bookings": [], "waitlist": [], "hold_minutes": g.hold_minutes, "now": str(now_datetime())}
    for r in rows:
        if r.is_waitlist:
            if r.status in ACTIVE:
                out["waitlist"].append(r)
        elif r.reservation_start and getdate(r.reservation_start) == day:
            out["bookings"].append(r)
    return out


@frappe.whitelist()
def save_booking(pos_profile, data):
    """Create or change a booking / waitlist entry from the POS."""
    _need(pos_profile, "reservations", "Reservations")
    data = frappe._dict(json.loads(data) if isinstance(data, str) else data)
    doc = frappe.get_doc("POS Reservation", data.name) if data.get("name") else frappe.new_doc("POS Reservation")
    for f in ("guest_name", "customer", "phone", "party_size", "reservation_start", "duration_minutes", "service_table",
              "notes", "occasion", "allergies", "is_waitlist", "quoted_wait_minutes", "status", "deposit_amount"):
        if f in data:
            doc.set(f, data.get(f))
    doc.pos_profile = pos_profile
    doc.company = frappe.db.get_value("POS Profile", pos_profile, "company")
    if doc.is_waitlist and not doc.reservation_start:
        doc.reservation_start = now_datetime()
    doc.flags.ignore_permissions = True
    doc.save()
    return doc.as_dict()


@frappe.whitelist()
def set_booking_status(pos_profile, reservation, status):
    _need(pos_profile, "reservations", "Reservations")
    if status not in ("Confirmed", "Arrived", "Cancelled", "No Show", "Completed"):
        frappe.throw(_("Unknown status {0}").format(status))
    frappe.db.set_value("POS Reservation", reservation, "status", status)
    if status == "Arrived":
        frappe.db.set_value("POS Reservation", reservation, "arrived_at", now_datetime())
    frappe.publish_realtime("posa_floor_changed", {"pos_profile": pos_profile}, after_commit=True)
    return status


@frappe.whitelist()
def seat_booking(pos_profile, reservation, invoice):
    """The booking's guests are at their table: link the order."""
    _need(pos_profile, "reservations", "Reservations")
    inv = frappe.db.get_value("Sales Invoice", invoice, ["posa_service_table", "docstatus"], as_dict=True)
    if not inv or inv.docstatus != 0:
        frappe.throw(_("Order {0} not found").format(invoice))
    frappe.db.set_value("POS Reservation", reservation, {"status": "Seated", "sales_invoice": invoice,
                                                         "seated_at": now_datetime(),
                                                         "service_table": inv.posa_service_table})
    frappe.publish_realtime("posa_floor_changed", {"pos_profile": pos_profile}, after_commit=True)
    return {"reservation": reservation, "invoice": invoice}


def upcoming_by_table(company, hold_minutes):
    """{table: booking} for bookings starting within `hold_minutes` (or already due)."""
    now = now_datetime()
    soon = add_to_date(now, minutes=cint(hold_minutes) or 30)
    rows = frappe.get_all("POS Reservation",
                          filters={"company": company, "status": ["in", list(ACTIVE)], "is_waitlist": 0,
                                   "service_table": ["!=", ""], "reservation_start": ["<=", soon],
                                   "reservation_end": [">=", now]},
                          fields=["name", "guest_name", "party_size", "reservation_start", "service_table", "status"],
                          order_by="reservation_start asc")
    out = {}
    for r in rows:
        out.setdefault(r.service_table, r)
    return out


def complete_booking(doc, method=None):
    """Sales Invoice on_submit: the booking of a paid order is Completed."""
    if not doc.get("pos_profile") or not frappe.db.table_exists("POS Reservation"):
        return
    for name in frappe.get_all("POS Reservation", filters={"sales_invoice": doc.name, "status": "Seated"}, pluck="name"):
        frappe.db.set_value("POS Reservation", name, "status", "Completed")


# ------------------------------------------------------------------ guest profiles
@frappe.whitelist()
def get_guest_profile(pos_profile, customer):
    """What the waiter should know about this guest."""
    _need(pos_profile, "guest_profiles", "Guest Profiles")
    if not customer or not frappe.db.exists("Customer", customer):
        return None
    if customer == frappe.db.get_value("POS Profile", pos_profile, "customer"):
        return None  # the walk-in customer has no profile
    fields = ["name", "customer_name", "posa_vip", "posa_guest_preferences", "posa_guest_allergies", "posa_birthday",
              "posa_anniversary", "posa_guest_notes"]
    meta = frappe.get_meta("Customer")
    c = frappe.db.get_value("Customer", customer, [f for f in fields if f in ("name", "customer_name") or meta.has_field(f)],
                            as_dict=True)
    stats = frappe.db.sql(
        """select count(*) as visits, avg(grand_total) as avg_spend, max(posting_date) as last_visit,
            sum(ifnull(posa_covers, 0)) as guests
        from `tabSales Invoice` where customer = %s and docstatus = 1 and is_return = 0""",
        customer, as_dict=True)[0]
    fav = frappe.db.sql(
        """select i.item_name, sum(i.qty) as qty from `tabSales Invoice Item` i
        join `tabSales Invoice` s on s.name = i.parent
        where s.customer = %s and s.docstatus = 1 and s.is_return = 0 and ifnull(i.posa_parent_row_id, '') = ''
        group by i.item_name order by qty desc limit 3""",
        customer, as_dict=True)
    today = getdate(nowdate())
    dates = []
    for f, label in (("posa_birthday", "Birthday"), ("posa_anniversary", "Anniversary")):
        d = c.get(f)
        if d:
            d = getdate(d)
            try:
                this_year = d.replace(year=today.year)
            except ValueError:  # 29 Feb
                this_year = d.replace(year=today.year, day=28)
            days = (this_year - today).days
            if -1 <= days <= 7:
                dates.append({"label": _(label), "days": days})
    return {
        "customer": customer, "name": c.customer_name, "vip": cint(c.get("posa_vip")),
        "preferences": c.get("posa_guest_preferences"), "allergies": c.get("posa_guest_allergies"),
        "notes": c.get("posa_guest_notes"), "visits": cint(stats.visits), "avg_spend": flt(stats.avg_spend, 2),
        "last_visit": str(stats.last_visit) if stats.last_visit else None, "favourites": [f.item_name for f in fav],
        "special_dates": dates,
    }


# ------------------------------------------------------------------ feedback
def feedback_token(invoice):
    secret = frappe.local.conf.get("encryption_key") or frappe.local.site or "posa"
    return hashlib.sha256(("posa-feedback:%s:%s" % (invoice, secret)).encode()).hexdigest()[:16]


def feedback_url(invoice):
    """Jinja method: the public feedback link of an invoice (empty when off)."""
    try:
        profile = frappe.db.get_value("Sales Invoice", invoice, "pos_profile")
        if not guest_settings(profile).feedback:
            return ""
        return get_url("/pos_feedback?i=%s&t=%s" % (invoice, feedback_token(invoice)))
    except Exception:
        return ""


def feedback_qr(invoice):
    """Jinja method: an <img> with the QR code of the feedback link (empty when off)."""
    url = feedback_url(invoice)
    if not url:
        return ""
    try:
        import base64
        import io

        from pyqrcode import create

        buf = io.BytesIO()
        create(url).png(buf, scale=3)
        return '<img src="data:image/png;base64,%s" style="width:110px;height:110px" alt="QR">' % base64.b64encode(
            buf.getvalue()).decode()
    except Exception:
        return ""


@frappe.whitelist(allow_guest=True)
def submit_feedback(invoice, token, food=0, service=0, ambience=0, comments=None, guest_name=None):
    """The public feedback form. Ratings are 1..5 stars."""
    if not invoice or token != feedback_token(invoice):
        frappe.throw(_("This feedback link is not valid"), frappe.PermissionError)
    inv = frappe.db.get_value("Sales Invoice", invoice,
                              ["pos_profile", "customer", "posa_service_table", "posa_waiter", "owner", "docstatus"],
                              as_dict=True)
    if not inv or not guest_settings(inv.pos_profile).feedback:
        frappe.throw(_("Feedback is not open for this bill"))
    if frappe.db.exists("POS Guest Feedback", {"sales_invoice": invoice}):
        frappe.throw(_("Thank you, we already have your feedback for this bill."))

    def stars(v):
        return max(0, min(5, cint(v))) / 5.0  # Rating fields store 0..1

    doc = frappe.get_doc({
        "doctype": "POS Guest Feedback", "sales_invoice": invoice, "customer": inv.customer,
        "pos_profile": inv.pos_profile, "service_table": inv.posa_service_table, "waiter": inv.posa_waiter or inv.owner,
        "food_rating": stars(food), "service_rating": stars(service), "ambience_rating": stars(ambience),
        "comments": (comments or "")[:2000], "guest_name": (guest_name or "")[:140], "source": "Guest Link",
    })
    doc.insert(ignore_permissions=True)
    return {"ok": 1}
