# Copyright (c) 2026, Youssef Restom and contributors
# For license information, please see license.txt

"""Kiosk display (signage) for the customer price checker screen.

get_kiosk_display(pos_profile)
    Every enabled POS Kiosk Display that applies to the POS Profile and has
    not expired, with its slides, ticker lines and media list. The kiosk keeps
    the answer and decides itself which display and which slides are valid at
    each moment (dates, daily hours, days, priority), so the schedule keeps
    working while the server or internet is down.

heartbeat(device_id, ...)
    The kiosk reports itself every few minutes; managers see each screen, what
    it shows and when it was last seen in POS Kiosk Device.

A saved / deleted / renamed display is announced to the open kiosks
(realtime event posa_kiosk_display_changed); they reload it within seconds.
"""

import hashlib
import json
import re

import frappe
from frappe import _
from frappe.utils import cint, flt, get_datetime, getdate, now_datetime, nowdate

EVENT = "posa_kiosk_display_changed"
IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "webp", "svg", "avif"}
VIDEO_EXTENSIONS = {"mp4", "webm", "ogg", "ogv", "m4v", "mov"}
WEEKDAYS = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
DEVICE_ID = re.compile(r"^[A-Za-z0-9_-]{8,64}$")
HEARTBEAT_MIN_SECONDS = 60

DISPLAY_FIELDS = (
    "name",
    "display_name",
    "priority",
    "company",
    "valid_from",
    "valid_upto",
    "orientation",
    "show_top_bar",
    "logo",
    "tagline",
    "show_clock",
    "show_ticker",
    "show_search_box",
    "show_centre_media",
    "show_scan_hint",
    "idle_title",
    "idle_subtitle",
    "idle_hint",
    "show_left_sidebar",
    "left_sidebar_content",
    "left_sidebar_width",
    "left_min_screen_width",
    "show_right_sidebar",
    "right_sidebar_content",
    "right_sidebar_width",
    "after_scan_sidebars",
    "slide_seconds",
    "result_seconds",
    "not_found_seconds",
    "offer_rotate_seconds",
    "ticker_speed",
    "refresh_minutes",
    "play_video_sound",
    "max_video_seconds",
    "background_color",
    "background_image",
    "text_color",
    "heading_color",
    "price_color",
    "accent_color",
    "offer_color",
    "ticker_background",
    "ticker_text_color",
    "font_scale",
    "ticker_separator",
    "cache_media",
    "max_cache_mb",
    "modified",
)
SLIDE_FIELDS = (
    "name",
    "idx",
    "zone",
    "slide_type",
    "title",
    "subtitle",
    "image",
    "video",
    "video_url",
    "item_code",
    "pos_offer",
    "fit",
    "duration",
    "show_on",
    "valid_from",
    "valid_upto",
    "from_time",
    "to_time",
    "weekdays",
)
TICKER_FIELDS = ("name", "idx", "text", "valid_from", "valid_upto", "from_time", "to_time", "weekdays")
OFFER_FIELDS = (
    "name",
    "title",
    "description",
    "offer",
    "apply_on",
    "item",
    "item_group",
    "brand",
    "discount_type",
    "discount_percentage",
    "discount_amount",
    "rate",
    "min_qty",
    "min_amt",
    "valid_from",
    "valid_upto",
    "disable",
)


# ----------------------------------------------------------------- helpers


def file_extension(url):
    path = (url or "").split("?", 1)[0].split("#", 1)[0]
    return path.rsplit(".", 1)[-1].lower() if "." in path.rsplit("/", 1)[-1] else ""


def normalise_weekdays(value):
    """'fri, Saturday ,sun' -> 'Fri,Sat,Sun' (week order). Raises ValueError
    with the first word that is not a day."""
    if not value or not str(value).strip():
        return ""
    found = set()
    for word in re.split(r"[\s,;/]+", str(value).strip()):
        if not word:
            continue
        key = word[:3].title()
        if key not in WEEKDAYS or (len(word) > 3 and not _full_day(word)):
            raise ValueError(word)
        found.add(key)
    return ",".join(d for d in WEEKDAYS if d in found)


def _full_day(word):
    names = ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")
    w = word.lower()
    return any(n.startswith(w) for n in names)


def _str(v):
    if v is None:
        return None
    return str(v)


def _time(v):
    """Time fields arrive as timedelta from the database: 'HH:MM:SS'."""
    if v in (None, ""):
        return None
    if hasattr(v, "total_seconds"):
        s = int(v.total_seconds()) % 86400
        return "%02d:%02d:%02d" % (s // 3600, (s % 3600) // 60, s % 60)
    text = str(v)
    return text if len(text) >= 8 else (text + ":00")[:8]


def _profiles_of(display_name):
    return frappe.get_all("POS Kiosk Display Profile", filters={"parent": display_name}, pluck="pos_profile")


def notify_change(doc, removed=False):
    """Tell the open kiosks that a display changed (after the commit)."""
    profiles = [] if cint(doc.get("apply_to_all_profiles")) else [r.pos_profile for r in (doc.get("pos_profiles") or [])]
    frappe.publish_realtime(
        EVENT,
        {"display": doc.name, "all": bool(cint(doc.get("apply_to_all_profiles"))), "profiles": profiles, "removed": bool(removed)},
        after_commit=True,
    )


# ----------------------------------------------------------------- display


@frappe.whitelist()
def get_kiosk_display(pos_profile):
    from posawesome.posawesome.api.offline import check_profile_access

    name = check_profile_access(pos_profile)
    company = frappe.db.get_value("POS Profile", name, "company")
    today = getdate(nowdate())

    linked = set(frappe.get_all("POS Kiosk Display Profile", filters={"pos_profile": name}, pluck="parent"))
    rows = frappe.get_all(
        "POS Kiosk Display",
        filters={"enabled": 1},
        fields=list(DISPLAY_FIELDS) + ["apply_to_all_profiles"],
        order_by="priority desc, modified desc",
        limit_page_length=50,
    )
    displays = []
    for row in rows:
        if not (cint(row.apply_to_all_profiles) or row.name in linked):
            continue
        if row.company and company and row.company != company:
            continue
        if row.valid_upto and getdate(row.valid_upto) < today:
            continue  # over: the kiosk never needs it again
        displays.append(_payload(row, today))
        if len(displays) >= 10:
            break

    body = json.dumps(displays, sort_keys=True, default=str)
    return {
        "pos_profile": name,
        "displays": displays,
        "version": hashlib.sha1(body.encode()).hexdigest()[:16],
        "server_time": str(now_datetime()),
    }


def _payload(row, today):
    out = {k: _str(row.get(k)) if k in ("valid_from", "valid_upto", "modified") else row.get(k) for k in DISPLAY_FIELDS}
    slides = frappe.get_all(
        "POS Kiosk Slide",
        filters={"parent": row.name, "parenttype": "POS Kiosk Display", "enabled": 1},
        fields=list(SLIDE_FIELDS),
        order_by="idx asc",
    )
    tickers = frappe.get_all(
        "POS Kiosk Ticker",
        filters={"parent": row.name, "parenttype": "POS Kiosk Display", "enabled": 1},
        fields=list(TICKER_FIELDS),
        order_by="idx asc",
    )
    keep = lambda r: not (r.valid_upto and getdate(r.valid_upto) < today)  # noqa: E731
    slides = [s for s in slides if keep(s)]
    tickers = [t for t in tickers if keep(t)]

    offer_names = {s.pos_offer for s in slides if s.slide_type == "POS Offer" and s.pos_offer}
    offers = {}
    if offer_names:
        for o in frappe.get_all("POS Offer", filters={"name": ["in", list(offer_names)]}, fields=list(OFFER_FIELDS)):
            o.valid_from, o.valid_upto = _str(o.valid_from), _str(o.valid_upto)
            offers[o.name] = o
    item_codes = {s.item_code for s in slides if s.slide_type == "Item" and s.item_code}
    items = {}
    if item_codes:
        for it in frappe.get_all(
            "Item",
            filters={"name": ["in", list(item_codes)]},
            fields=["name", "item_name", "image", "item_group", "stock_uom", "disabled", "is_sales_item"],
        ):
            items[it.name] = it

    clean_slides = []
    for s in slides:
        if s.slide_type == "POS Offer":
            o = offers.get(s.pos_offer)
            if not o or cint(o.disable) or (o.valid_upto and getdate(o.valid_upto) < today):
                continue
            s.offer = o
        if s.slide_type == "Item":
            it = items.get(s.item_code)
            if not it or cint(it.disabled) or not cint(it.is_sales_item):
                continue
            s.item = {"item_name": it.item_name, "image": it.image, "item_group": it.item_group, "stock_uom": it.stock_uom}
        for k in ("valid_from", "valid_upto"):
            s[k] = _str(s.get(k))
        for k in ("from_time", "to_time"):
            s[k] = _time(s.get(k))
        clean_slides.append(s)
    for t in tickers:
        for k in ("valid_from", "valid_upto"):
            t[k] = _str(t.get(k))
        for k in ("from_time", "to_time"):
            t[k] = _time(t.get(k))

    out["slides"] = clean_slides
    out["ticker"] = tickers
    out["media"] = _media(out, clean_slides)
    return out


def _media(display, slides):
    """Files the kiosk keeps for offline play, with their size when known."""
    urls = []
    for url in (display.get("logo"), display.get("background_image")):
        if url:
            urls.append(url)
    for s in slides:
        for url in (s.get("image"), s.get("video"), s.get("video_url")):
            if url:
                urls.append(url)
        if s.get("item") and s["item"].get("image"):
            urls.append(s["item"]["image"])
    seen, out = set(), []
    for url in urls:
        if url in seen or url.startswith("/private/"):
            continue
        seen.add(url)
        size = 0
        if url.startswith("/files/"):
            size = cint(frappe.db.get_value("File", {"file_url": url, "is_private": 0}, "file_size"))
        ext = file_extension(url)
        out.append({"url": url, "size": size, "kind": "video" if ext in VIDEO_EXTENSIONS else "image"})
    return out


# ----------------------------------------------------------------- devices


@frappe.whitelist(methods=["POST"])
def heartbeat(
    device_id,
    pos_profile,
    kiosk_display=None,
    display_version=None,
    screen=None,
    network=None,
    media_cached=0,
    media_bytes=0,
    device_name=None,
):
    """A kiosk reports itself. Returns the screen name (it can be set in the
    desk). At most one write a minute per screen."""
    from posawesome.posawesome.api.offline import check_profile_access

    device_id = (device_id or "").strip()
    if not DEVICE_ID.match(device_id):
        frappe.throw(_("Invalid device id"))
    profile = check_profile_access(pos_profile)
    if kiosk_display and not frappe.db.exists("POS Kiosk Display", kiosk_display):
        kiosk_display = None
    values = {
        "pos_profile": profile,
        "kiosk_display": kiosk_display,
        "display_version": (display_version or "")[:32],
        "screen": (screen or "")[:40],
        "network": network if network in ("Online", "Offline") else "Online",
        "media_cached": cint(media_cached),
        "media_mb": round(flt(media_bytes) / 1048576, 1),
        "user": frappe.session.user,
        "ip_address": (frappe.local.request_ip or "")[:45] if getattr(frappe.local, "request_ip", None) else "",
        "user_agent": (frappe.get_request_header("User-Agent") or "")[:500] if frappe.request else "",
        "last_seen": now_datetime(),
    }
    name = frappe.db.get_value("POS Kiosk Device", {"device_id": device_id}, ["name", "device_name", "last_seen"], as_dict=True)
    if not name:
        doc = frappe.get_doc(
            {
                "doctype": "POS Kiosk Device",
                "device_id": device_id,
                "device_name": (device_name or "").strip()[:140] or _("Price checker {0}").format(device_id[:6]),
                **values,
            }
        )
        doc.insert(ignore_permissions=True)
        return {"device_name": doc.device_name}

    recent = name.last_seen and (now_datetime() - get_datetime(name.last_seen)).total_seconds() < HEARTBEAT_MIN_SECONDS
    renamed = device_name and device_name.strip() and device_name.strip() != name.device_name
    if renamed:
        values["device_name"] = device_name.strip()[:140]
    if recent and not renamed:
        return {"device_name": name.device_name}
    frappe.db.set_value("POS Kiosk Device", name.name, values, update_modified=False)
    return {"device_name": values.get("device_name") or name.device_name}
