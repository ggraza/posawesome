"""Push "catalogue changed" notifications to open POS terminals.

When a record the offline catalogue depends on is created, updated, renamed or
deleted, every open POS gets a realtime event and runs a delta sync (only rows
modified since its last sync are downloaded). The periodic sync stays as the
fallback for terminals whose socket was disconnected.

Bulk changes (Data Import, Item Price tool, background jobs) produce at most a
few events: the notification is a deduplicated background job, so while one is
queued further changes are folded into it, and terminals coalesce events too.
"""

import json

import frappe
from frappe.utils import get_datetime, now_datetime

RENAMES_KEY = "posa_catalog_renames"
EVENT = "posa_catalog_changed"
JOB_ID = "posa_catalog_changed_notify"

# doctype -> what the terminal refreshes (informational; a terminal always runs one delta sync)
WATCHED = {
    "Item": "items",  # incl. barcodes, UOMs, item taxes, max_discount (child rows bump Item.modified)
    "Item Group": "items",
    "Item Price": "prices",
    "Price List": "prices",
    "Customer": "customers",
    "POS Offer": "settings",
    "POS Coupon": "settings",
    "Referral Code": "settings",
    "RFID Card": "settings",
    "Delivery Charges": "settings",
    "POS Profile": "settings",
    "Sales Taxes and Charges Template": "settings",
    "Item Tax Template": "settings",
}

DOC_EVENTS = ("on_update", "after_rename", "on_trash")


def notify_catalog_change(doc, method=None, *args, **kwargs):
    """doc_events handler for every doctype in WATCHED (after_rename passes old, new, merge)."""
    if method == "after_rename" and args:
        _record_rename(doc.doctype, args[0])
    flags = frappe.flags
    if flags.in_migrate or flags.in_install or flags.in_patch or flags.in_setup_wizard or flags.in_test:
        return
    kind = WATCHED.get(doc.doctype)
    if not kind:
        return
    # one notification per request / job
    seen = flags.posa_catalog_notified
    if seen is None:
        seen = flags.posa_catalog_notified = set()
    if kind in seen:
        return
    seen.add(kind)
    try:
        frappe.enqueue(
            "posawesome.posawesome.api.offline_events.publish",
            queue="short",
            job_id=JOB_ID,
            deduplicate=True,
            enqueue_after_commit=True,
            kinds=[kind],
        )
    except Exception:
        # never block saving a record because the notification could not be queued
        frappe.log_error(title="POS catalogue notification failed")


def _record_rename(doctype, old_name):
    """Terminals drop the old name on their next sync (renames leave no Deleted Document).
    Best effort: kept in redis, last 5000 renames; "Re-download catalogue" covers the rest."""
    try:
        entry = json.dumps({"doctype": doctype, "name": old_name, "at": str(now_datetime())})
        frappe.cache.lpush(RENAMES_KEY, entry)
        frappe.cache.ltrim(RENAMES_KEY, 0, 4999)
    except Exception:
        pass


def renamed_since(since):
    """[(doctype, old_name, at)] renamed after `since` (datetime)."""
    out = []
    try:
        for raw in frappe.cache.lrange(RENAMES_KEY, 0, -1) or []:
            entry = json.loads(raw)
            at = get_datetime(entry["at"])
            if at > since:
                out.append((entry["doctype"], entry["name"], entry["at"]))
    except Exception:
        pass
    return out


def publish(kinds=None):
    frappe.publish_realtime(
        EVENT,
        {"kinds": kinds or [], "server_time": str(now_datetime())},
    )
