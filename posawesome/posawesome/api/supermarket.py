# Copyright (c) 2026, Youssef Restom and contributors
# For license information, please see license.txt
"""Supermarket features of the RMS POS (POS Profile > Supermarket tab).

Every feature has its own checkbox under "Enable Supermarket Features". With
that switch off, settings() is all off and none of the hooks here change a
document: the POS works as before.

Phase 1, cash control: manager approval (PIN / card), line and cart voids with
a reason, cash drawer and No Sale, cash pickup and cash in / out, X / Z report
with blind close, training mode."""

import hashlib
import hmac
import json
import secrets

import frappe
from frappe import _
from frappe.utils import cint, flt, now_datetime, nowdate, nowtime

FLAGS = (
	# phase 1
	"manager_approval",
	"appr_price",
	"appr_discount",
	"appr_line_void",
	"appr_cart_void",
	"appr_no_sale",
	"appr_reprint",
	"appr_return",
	"appr_cash_out",
	"void_reason",
	"training_mode",
	"cash_drawer",
	"drawer_on_cash",
	"cash_pickup",
	"xz_report",
	"blind_close",
	# phase 2
	"quick_keys",
	"ask_weight",
	"scale_reading",
	"qty_times",
	"gs1_barcodes",
	"gs1_block_expired",
	"hotkeys",
	# phase 3
	"mix_match",
	"multibuy",
	"offer_schedule",
	"markdown_labels",
	"savings_receipt",
	# phase 4
	"gift_cards",
	"store_credit",
	"wallet_qr",
	"card_terminal",
	"e_receipt",
	"e_receipt_ask",
	"loyalty_display",
	"age_check",
	# phase 5
	"shelf_labels",
	"stock_count",
	"blind_count",
	"store_receiving",
	"transfer_request",
	"low_stock",
	# phase 6
	"till_monitor",
	"dashboard",
	"loss_reports",
	"offer_reports",
	"movers",
)
HOTKEY_ACTIONS = (
	"Pay", "Hold", "Resume Draft", "Cancel Cart", "Returns", "Void Last Item", "Search Box", "Quick Keys",
	"No Sale", "Cash Pickup", "Cash In", "Cash Out", "X Report", "Reprint Last Receipt", "Training Mode",
)

# client action name -> (approval flag, POS Approval Log action)
ACTIONS = {
	"price": ("appr_price", "Price Override"),
	"discount": ("appr_discount", "Discount"),
	"line_void": ("appr_line_void", "Line Void"),
	"cart_void": ("appr_cart_void", "Cart Void"),
	"no_sale": ("appr_no_sale", "No Sale"),
	"reprint": ("appr_reprint", "Reprint"),
	"return": ("appr_return", "Return"),
	"cash_pickup": ("appr_cash_out", "Cash Pickup"),
	"cash_out": ("appr_cash_out", "Cash Out"),
}
MOVEMENT_ACTION = {"Cash Pickup": "cash_pickup", "Cash Out": "cash_out"}
MAX_PIN_FAILURES = 5
PIN_LOCK_SECONDS = 300


# ------------------------------------------------------------------ settings
def settings(pos_profile):
	"""The supermarket switches of a POS Profile, all off when the master
	switch is off (or the profile does not exist)."""
	out = frappe._dict({k: False for k in FLAGS})
	out.enabled = False
	out.profile = pos_profile
	if not pos_profile:
		return out
	# per request (frappe.local has no __dict__ on v16: use getattr / setattr only)
	cache = getattr(frappe.local, "posa_sm_settings", None)
	if cache is None:
		cache = {}
		frappe.local.posa_sm_settings = cache
	if pos_profile in cache:
		return cache[pos_profile]
	try:
		p = frappe.get_cached_doc("POS Profile", pos_profile)
	except frappe.DoesNotExistError:
		return out
	if not cint(p.get("posa_enable_supermarket")):
		cache[pos_profile] = out
		return out
	out.enabled = True
	for k in FLAGS:
		out[k] = bool(cint(p.get("posa_sm_" + k)))
	# approvals only count while manager approval is on
	if not out.manager_approval:
		for k in FLAGS:
			if k.startswith("appr_"):
				out[k] = False
	if not out.cash_drawer:
		out.drawer_on_cash = False
	out.approval_offline = p.get("posa_sm_approval_offline") or "Not Allowed"
	out.discount_limit = flt(p.get("posa_sm_discount_limit"))
	out.drawer_code = p.get("posa_sm_drawer_code") or "27,112,0,25,250"
	out.drawer_limit = flt(p.get("posa_sm_drawer_limit")) if out.cash_pickup else 0
	out.safe_account = p.get("posa_sm_safe_account") if out.cash_pickup else None
	out.cash_in_out_account = p.get("posa_sm_cash_in_out_account") if out.cash_pickup else None
	out.trainees = [r.user for r in (p.get("posa_sm_trainees") or []) if r.user] if out.training_mode else []
	out.cash_mode_of_payment = p.get("posa_cash_mode_of_payment") or "Cash"
	out.company = p.company
	# phase 2
	out.weighed_uoms = [u.strip() for u in (p.get("posa_sm_weighed_uoms") or "Kg").split(",") if u.strip()] if out.ask_weight else []
	out.scale_protocol = p.get("posa_sm_scale_protocol") or "Continuous"
	out.scale_baud = cint(p.get("posa_sm_scale_baud")) or 9600
	out.scale_request = p.get("posa_sm_scale_request") or "W"
	if not out.gs1_barcodes:
		out.gs1_block_expired = False
	# phase 4
	if not out.gift_cards:
		out.store_credit = False
	out.gift_card_item = p.get("posa_sm_gift_card_item") if out.gift_cards else None
	out.gift_card_mop = p.get("posa_sm_gift_card_mop") if out.gift_cards else None
	out.gift_card_expiry_days = cint(p.get("posa_sm_gift_card_expiry_days")) if out.gift_cards else 0
	out.card_mops = [m.strip() for m in (p.get("posa_sm_card_mops") or "").split(",") if m.strip()] if out.card_terminal else []
	out.card_bridge_url = (p.get("posa_sm_card_bridge_url") or "").strip() if out.card_terminal else ""
	out.wallets = (
		[
			{"mode_of_payment": r.mode_of_payment, "title": r.title or r.mode_of_payment, "payload": r.payload,
				"reference_required": cint(r.reference_required)}
			for r in (p.get("posa_sm_wallet_list") or [])
			if r.mode_of_payment and r.payload
		]
		if out.wallet_qr
		else []
	)
	out.e_receipt_channel = p.get("posa_sm_e_receipt_channel") or "WhatsApp"
	out.e_receipt_format = p.get("posa_sm_e_receipt_format") or "Text"
	out.e_receipt_print_format = p.get("posa_sm_e_receipt_print_format") or None
	if not out.e_receipt:
		out.e_receipt_ask = False
	out.hotkey_list = (
		[{"key": r.key, "action": r.action} for r in (p.get("posa_sm_hotkey_list") or []) if r.key and r.action]
		if out.hotkeys
		else []
	)
	cache[pos_profile] = out
	return out


def _clear_cache():
	if getattr(frappe.local, "posa_sm_settings", None) is not None:
		frappe.local.posa_sm_settings = None


def _check_profile_user(pos_profile):
	"""The current user works on this POS Profile (or is a manager)."""
	user = frappe.session.user
	if user == "Administrator" or "System Manager" in frappe.get_roles(user):
		return
	if frappe.db.exists("POS Profile User", {"parent": pos_profile, "user": user}):
		return
	if frappe.db.exists("POS Opening Shift", {"pos_profile": pos_profile, "user": user, "status": "Open", "docstatus": 1}):
		return
	frappe.throw(_("You are not a user of POS Profile {0}").format(pos_profile), frappe.PermissionError)


def _open_shift(pos_profile, user=None):
	return frappe.db.get_value(
		"POS Opening Shift",
		{"pos_profile": pos_profile, "user": user or frappe.session.user, "status": "Open", "docstatus": 1},
		"name",
		order_by="creation desc",
	)


def _loads(value):
	if isinstance(value, str):
		try:
			return json.loads(value or "{}")
		except ValueError:
			return {}
	return value or {}


@frappe.whitelist()
def get_setup(pos_profile):
	"""What the POS needs to know (no PINs, no card numbers)."""
	_check_profile_user(pos_profile)
	s = settings(pos_profile)
	out = {"settings": {"enabled": s.enabled}}
	if not s.enabled:
		return out
	keys = list(FLAGS) + [
		"approval_offline", "discount_limit", "drawer_code", "drawer_limit", "cash_mode_of_payment",
		"weighed_uoms", "scale_protocol", "scale_baud", "scale_request", "hotkey_list",
		"gift_card_item", "gift_card_mop", "card_mops", "card_bridge_url",
	]
	out["settings"].update({k: s.get(k) for k in keys})
	out["settings"]["trainee"] = frappe.session.user in (s.trainees or [])
	if s.manager_approval:
		p = frappe.get_cached_doc("POS Profile", pos_profile)
		out["settings"]["managers"] = len([r for r in (p.get("posa_sm_managers") or []) if r.user])
	if s.void_reason:
		out["void_reasons"] = frappe.get_all(
			"POS Void Reason",
			filters={"disabled": 0, "reason_type": ["in", ["Void", "Both"]]},
			pluck="name",
			order_by="name asc",
		)
	if s.quick_keys:
		out["quick_keys"] = quick_key_pages(pos_profile)
	if s.mix_match or s.multibuy:
		out["deals"] = active_deals(pos_profile, s)
	if s.markdown_labels:
		out["markdowns"] = open_markdowns(s.company)
	if s.wallet_qr:
		# no QR text to the till: only titles; the QR picture comes from wallet_qr()
		out["settings"]["wallets"] = [
			{"mode_of_payment": w["mode_of_payment"], "title": w["title"], "reference_required": w["reference_required"]}
			for w in s.wallets
		]
		out["wallet_qr_static"] = {w["mode_of_payment"]: qr_svg(w["payload"]) for w in s.wallets}
	if s.age_check:
		out["age_items"] = {
			r.name: cint(r.posa_sm_min_age)
			for r in frappe.get_all("Item", filters={"posa_sm_min_age": [">", 0], "disabled": 0}, fields=["name", "posa_sm_min_age"])
		}
	return out


def quick_key_pages(pos_profile):
	"""The quick key pages of a POS Profile with their buttons (enabled sales items only)."""
	pages = []
	for name in frappe.get_all("POS Quick Key Page", filters={"disabled": 0}, order_by="sequence asc, name asc", pluck="name"):
		page = frappe.get_cached_doc("POS Quick Key Page", name)
		profiles = [r.pos_profile for r in page.get("pos_profiles") or []]
		if profiles and pos_profile not in profiles:
			continue
		codes = [k.item_code for k in page.get("keys") or [] if k.item_code]
		if not codes:
			continue
		info = {
			r.name: r
			for r in frappe.get_all(
				"Item",
				filters={"name": ["in", codes], "disabled": 0, "is_sales_item": 1},
				fields=["name", "item_name", "stock_uom", "image"],
			)
		}
		keys = []
		for k in page.keys:
			it = info.get(k.item_code)
			if not it:
				continue
			keys.append(
				{
					"item_code": k.item_code,
					"label": k.label or it.item_name or k.item_code,
					"color": k.color or page.color or None,
					"ask_weight": cint(k.ask_weight),
					"stock_uom": it.stock_uom,
					"image": it.image or None,
				}
			)
		if keys:
			pages.append({"name": page.name, "label": page.page_name, "color": page.color or None, "keys": keys})
	return pages


# ------------------------------------------------------------------ approvals
def _fail_key():
	return "posa_sm_pin_fail|" + frappe.session.user


HASH_PREFIX = "pbkdf2$"
HASH_ROUNDS = 60000


def hash_secret(value, salt=None):
	"""PIN / card number as stored on the POS Profile (never the plain text)."""
	salt = salt or secrets.token_hex(8)
	digest = hashlib.pbkdf2_hmac("sha256", str(value).strip().encode(), salt.encode(), HASH_ROUNDS).hex()
	return "%s%d$%s$%s" % (HASH_PREFIX, HASH_ROUNDS, salt, digest)


def check_secret(value, stored):
	stored = str(stored or "")
	if not value or not stored.startswith(HASH_PREFIX):
		return False
	try:
		_, rounds, salt, digest = stored.split("$")
	except ValueError:
		return False
	got = hashlib.pbkdf2_hmac("sha256", str(value).strip().encode(), salt.encode(), int(rounds)).hex()
	return hmac.compare_digest(got, digest)


def _match_manager(pos_profile, pin=None, card=None):
	"""The manager (of this POS Profile) whose PIN / card this is."""
	p = frappe.get_cached_doc("POS Profile", pos_profile)
	given = str(pin or card or "").strip()
	if not given:
		return None
	field = "pin" if pin else "card_no"
	for row in p.get("posa_sm_managers") or []:
		if not row.user:
			continue
		rec = frappe.db.get_value("POS Manager PIN", row.user, ["pin", "card_no", "disabled"], as_dict=True)
		if not rec or cint(rec.disabled) or not check_secret(given, rec.get(field)):
			continue
		if not cint(frappe.db.get_value("User", row.user, "enabled")):
			continue
		return row.user
	return None


def validate_manager_pin(doc):
	"""POS Manager PIN: the PIN / card are kept only as salted hashes."""
	pin = str(doc.get("pin") or "").strip()
	if pin and not pin.startswith(HASH_PREFIX):
		if not (pin.isdigit() and 4 <= len(pin) <= 8):
			frappe.throw(_("The PIN must be 4 to 8 digits"))
		for other in frappe.get_all(
			"POS Manager PIN", filters={"name": ["!=", doc.name or ""], "disabled": 0}, fields=["name", "pin"]
		):
			if check_secret(pin, other.pin):
				frappe.throw(_("Another manager has this PIN; choose a different one"))
		doc.pin = hash_secret(pin)
	card = str(doc.get("card_no") or "").strip()
	if card and not card.startswith(HASH_PREFIX):
		doc.card_no = hash_secret(card)
	if not doc.get("pin") and not doc.get("card_no"):
		frappe.throw(_("Set a PIN or a card number"))


def _new_log(pos_profile, action, status, details, approved_by=None, client_id=None):
	d = _loads(details)
	log = frappe.get_doc(
		{
			"doctype": "POS Approval Log",
			"action": action,
			"status": status,
			"pos_profile": pos_profile,
			"pos_opening_shift": d.get("pos_opening_shift") or _open_shift(pos_profile),
			"requested_by": frappe.session.user,
			"approved_by": approved_by,
			"approved_on": d.get("time") or now_datetime(),
			"sale_id": d.get("sale_id"),
			"item_code": d.get("item_code") or None,
			"item_name": d.get("item_name"),
			"qty": flt(d.get("qty")),
			"old_value": flt(d.get("old_value")),
			"new_value": flt(d.get("new_value")),
			"amount": flt(d.get("amount")),
			"reason": (d.get("reason") or "")[:140],
			"remarks": d.get("remarks"),
			"client_id": client_id,
		}
	)
	if log.item_code and not frappe.db.exists("Item", log.item_code):
		log.item_code = None
	log.flags.ignore_permissions = True
	log.insert()
	return log


@frappe.whitelist()
def approve(pos_profile, action, pin=None, card=None, details=None):
	"""A manager approves `action` with a PIN or a card. Returns the approval
	(POS Approval Log name) that the POS keeps with the sale."""
	_check_profile_user(pos_profile)
	s = settings(pos_profile)
	if action not in ACTIONS:
		frappe.throw(_("Unknown action {0}").format(action))
	flag, label = ACTIONS[action]
	if not s.get(flag):
		return {"approval": None, "needed": False}
	cache = frappe.cache()
	fails = cint(cache.get_value(_fail_key()))
	if fails >= MAX_PIN_FAILURES:
		frappe.throw(_("Too many wrong PINs. Wait 5 minutes and try again."), title=_("Locked"))
	manager = _match_manager(pos_profile, pin=pin, card=card)
	if not manager and pin and not card:
		# one box on the till: a scanned card arrives as the "PIN"
		manager = _match_manager(pos_profile, card=pin)
	if not manager:
		cache.set_value(_fail_key(), fails + 1, expires_in_sec=PIN_LOCK_SECONDS)
		_new_log(pos_profile, label, "Refused", details)
		frappe.db.commit()  # the refusal is kept although the call fails
		frappe.throw(_("Wrong PIN or card"), title=_("Not Approved"))
	cache.delete_value(_fail_key())
	log = _new_log(pos_profile, label, "Approved", details, approved_by=manager)
	return {
		"approval": log.name,
		"approver": manager,
		"approver_name": frappe.utils.get_fullname(manager),
	}


@frappe.whitelist()
def log_offline_approval(pos_profile, action, details=None, client_id=None):
	"""An action allowed without a PIN while the till was offline ("Allow and
	Log"); sent when the connection is back. Once per client_id."""
	_check_profile_user(pos_profile)
	if action not in ACTIONS:
		frappe.throw(_("Unknown action {0}").format(action))
	if client_id:
		found = frappe.db.get_value("POS Approval Log", {"client_id": client_id}, "name")
		if found:
			return {"approval": found}
	log = _new_log(pos_profile, ACTIONS[action][1], "Offline", details, client_id=client_id)
	return {"approval": log.name}


def _approval(name):
	return frappe.db.get_value(
		"POS Approval Log", name, ["name", "action", "status", "pos_profile", "sales_invoice", "item_code", "new_value"],
		as_dict=True,
	)


def _valid_approval(name, pos_profile, actions, invoice=None):
	"""An approval that can be used by this sale."""
	if not name:
		return None
	a = _approval(name)
	if not a or a.pos_profile != pos_profile or a.action not in actions:
		return None
	if a.status == "Approved" and (not a.sales_invoice or a.sales_invoice == invoice):
		return a
	if a.status == "Used" and invoice and a.sales_invoice == invoice:
		return a
	if a.status == "Offline":
		return a
	return None


def check_approval_for(s, movement_type, approval, offline=False):
	"""Cash pickup / cash out need an approval when the profile says so."""
	action = MOVEMENT_ACTION.get(movement_type)
	if not action or not s.get(ACTIONS[action][0]):
		return
	if offline and s.approval_offline == "Allow and Log":
		return
	if not _valid_approval(approval, s.profile, (ACTIONS[action][1],)):
		frappe.throw(_("{0} needs a manager's approval").format(_(movement_type)))


def mark_approval_used(name, invoice):
	if name and frappe.db.get_value("POS Approval Log", name, "status") in ("Approved", "Used"):
		frappe.db.set_value("POS Approval Log", name, {"status": "Used", "sales_invoice": invoice}, update_modified=False)


# ------------------------------------------------------------------ invoice hooks
def _tokens(doc):
	out = []
	for t in (doc.get("posa_sm_approvals") or "").replace("\n", ",").split(","):
		t = t.strip()
		if t and t not in out:
			out.append(t)
	return out


def _is_offer_row(row):
	return bool(
		cint(row.get("is_free_item"))
		or cint(row.get("posa_is_offer"))
		or cint(row.get("posa_offer_applied"))
		or cint(row.get("posa_comp"))
		or row.get("posa_is_replace")
	)


def manual_discount(doc, customer_discount=0, s=None):
	"""The largest manual discount % of a sale: per item (rate below the list
	price, without offers / the customer's own discount / an approved price
	override) and on the whole sale (when no offer or coupon gave it)."""
	worst = 0.0
	for row in doc.get("items") or []:
		plr = flt(row.get("price_list_rate"))
		if plr <= 0 or flt(row.get("qty")) < 0 or _is_offer_row(row) or row.get("posa_sm_approval"):
			continue
		# deal / reduced-label lines are checked by check_promotions (only while those features are on)
		if row.get("posa_sm_deal") and s is not None and (s.mix_match or s.multibuy):
			continue
		if row.get("posa_sm_markdown") and s is not None and s.markdown_labels:
			continue
		pct = (plr - flt(row.get("rate"))) * 100.0 / plr
		if customer_discount and pct <= flt(customer_discount) + 0.01:
			continue
		worst = max(worst, pct)
	has_offer = bool(doc.get("posa_offers")) or bool(doc.get("posa_coupons"))
	if not has_offer:
		inv = flt(doc.get("additional_discount_percentage"))
		total = flt(doc.get("total")) or flt(doc.get("net_total"))
		if not inv and flt(doc.get("discount_amount")) and total:
			inv = flt(doc.get("discount_amount")) * 100.0 / total
		worst = max(worst, inv)
	return round(worst, 4)


def validate_invoice(doc, method=None):
	"""Sales Invoice validate. Training sales are never submitted; the manager
	approvals of the sale are checked. Offline uploads are never refused."""
	s = settings(doc.get("pos_profile"))
	if not s.enabled:
		return
	if cint(doc.get("posa_training")):
		if not s.training_mode:
			frappe.throw(_("Training mode is off on POS Profile {0}").format(doc.pos_profile))
		if doc.docstatus == 1:
			frappe.throw(_("A training sale cannot be submitted"), title=_("Training Mode"))
		doc.flags.posa_skip_kot = True
		return
	offline = bool(frappe.flags.get("posa_offline_sync") or doc.flags.get("posa_offline_sync"))
	tokens = _tokens(doc)
	for row in doc.get("items") or []:
		if row.get("posa_sm_approval"):
			tokens.append(row.posa_sm_approval)
	check_promotions(doc, s, offline)
	check_payments(doc, s, offline)
	if offline:
		return  # recorded at the till; offline approvals are in POS Approval Log as Offline
	if not s.manager_approval:
		return
	name = doc.name if not doc.is_new() else None
	valid = {}
	for t in tokens:
		if t.startswith("OFFLINE:"):
			if s.approval_offline != "Allow and Log":
				frappe.throw(_("Approvals made offline are not allowed on this POS Profile"))
			continue
		a = _valid_approval(t, doc.pos_profile, [v[1] for v in ACTIONS.values()], invoice=name)
		if not a:
			frappe.throw(_("Approval {0} is not valid for this sale").format(t), title=_("Manager Approval"))
		valid[t] = a
	for row in doc.get("items") or []:
		t = row.get("posa_sm_approval")
		if t and t in valid and (valid[t].action != "Price Override" or (valid[t].item_code and valid[t].item_code != row.item_code)):
			frappe.throw(_("Row {0}: approval {1} is not a price override of this item").format(row.idx, t))
	has_offline = any(t.startswith("OFFLINE:") for t in tokens)
	# what needs a manager is checked when the sale is submitted from the POS
	# (a held cart / draft can be saved first; item exchanges have their own flow)
	if doc.docstatus != 1 or not doc.get("posa_pos_opening_shift") or doc.get("posa_item_exchange"):
		return
	if s.appr_discount and not cint(doc.get("is_return")) and not has_offline:
		cust_disc = flt(frappe.db.get_value("Customer", doc.customer, "posa_discount")) if doc.customer else 0
		worst = manual_discount(doc, cust_disc, s)
		if worst > flt(s.discount_limit) + 0.01:
			ok = any(a.action == "Discount" and flt(a.new_value) + 0.01 >= worst for a in valid.values())
			if not ok:
				frappe.throw(
					_("A discount of {0}% needs a manager's approval (allowed: {1}%)").format(
						round(worst, 2), flt(s.discount_limit)
					),
					title=_("Manager Approval"),
				)
	if s.appr_return and cint(doc.get("is_return")) and not has_offline:
		if not any(a.action == "Return" for a in valid.values()):
			frappe.throw(_("A return needs a manager's approval"), title=_("Manager Approval"))


def on_submit_invoice(doc, method=None):
	s = settings(doc.get("pos_profile"))
	if not s.enabled:
		return
	if any(r.get("posa_sm_markdown") for r in doc.get("items") or []):
		mark_markdowns(doc, used=True)
	gift_card_entries(doc, s)
	queue_e_receipt(doc, s)
	tokens = _tokens(doc) + [r.posa_sm_approval for r in doc.get("items") or [] if r.get("posa_sm_approval")]
	for t in tokens:
		if t.startswith("OFFLINE:"):
			name = frappe.db.get_value("POS Approval Log", {"client_id": t[8:]}, "name")
			if name:
				frappe.db.set_value("POS Approval Log", name, "sales_invoice", doc.name, update_modified=False)
			continue
		mark_approval_used(t, doc.name)


@frappe.whitelist()
def training_discard(invoice):
	"""Remove the draft of a finished training sale."""
	doc = frappe.get_doc("Sales Invoice", invoice)
	if doc.docstatus != 0 or not cint(doc.get("posa_training")):
		frappe.throw(_("{0} is not a training sale").format(invoice))
	if doc.owner != frappe.session.user and "System Manager" not in frappe.get_roles():
		frappe.throw(_("Not your training sale"), frappe.PermissionError)
	frappe.delete_doc("Sales Invoice", invoice, force=1, ignore_permissions=True)
	return True


# ------------------------------------------------------------------ voids, No Sale
def _dedupe(doctype, client_id):
	return client_id and frappe.db.get_value(doctype, {"client_id": client_id}, "name")


@frappe.whitelist()
def log_void(pos_profile, void_type, reason=None, items=None, approval=None, sale_id=None, client_id=None,
	offline=0, remarks=None, invoice=None):
	"""Line Void (one item removed) or Cart Void (the cart cancelled), one
	POS Void Log row per item."""
	_check_profile_user(pos_profile)
	if void_type not in ("Line Void", "Cart Void"):
		frappe.throw(_("Unknown void type {0}").format(void_type))
	s = settings(pos_profile)
	if not s.enabled:
		return []
	rows = _loads(items) or []
	if isinstance(rows, dict):
		rows = [rows]
	if reason and not frappe.db.exists("POS Void Reason", reason):
		remarks = ((remarks or "") + " " + reason).strip()
		reason = None
	if invoice and (str(invoice).startswith("OFL-") or not frappe.db.exists("Sales Invoice", invoice)):
		invoice = None
	shift = _open_shift(pos_profile)
	out = []
	for i, r in enumerate(rows or [{}]):
		cid = "%s:%d" % (client_id, i) if client_id else None
		found = _dedupe("POS Void Log", cid)
		if found:
			out.append(found)
			continue
		qty = flt(r.get("qty"))
		rate = flt(r.get("rate"))
		log = frappe.get_doc(
			{
				"doctype": "POS Void Log",
				"void_type": void_type,
				"status": "Offline" if cint(offline) else "Applied",
				"sales_invoice": invoice,
				"sale_id": sale_id,
				"pos_profile": pos_profile,
				"pos_opening_shift": shift,
				"reason": reason,
				"remarks": remarks,
				"requested_by": frappe.session.user,
				"approved_by": frappe.db.get_value("POS Approval Log", approval, "approved_by") if approval and not str(approval).startswith("OFFLINE:") else None,
				"approved_on": now_datetime(),
				"approval": approval if approval and frappe.db.exists("POS Approval Log", approval) else None,
				"item_code": r.get("item_code") if r.get("item_code") and frappe.db.exists("Item", r.get("item_code")) else None,
				"item_name": r.get("item_name"),
				"row_id": r.get("posa_row_id"),
				"qty": qty,
				"rate": rate,
				"amount": flt(r.get("amount")) or qty * rate,
				"client_id": cid,
			}
		)
		log.flags.ignore_permissions = True
		log.insert()
		out.append(log.name)
	if approval and not str(approval).startswith("OFFLINE:"):
		mark_approval_used(approval, invoice)
	return out


@frappe.whitelist()
def no_sale(pos_profile, reason=None, approval=None, client_id=None, offline=0, time=None):
	"""The drawer was opened without a sale."""
	_check_profile_user(pos_profile)
	s = settings(pos_profile)
	if not s.cash_drawer:
		frappe.throw(_("The cash drawer is not switched on for POS Profile {0}").format(pos_profile))
	found = _dedupe("POS Drawer Log", client_id)
	if found:
		return found
	if s.appr_no_sale and not (cint(offline) and s.approval_offline == "Allow and Log"):
		if not _valid_approval(approval, pos_profile, ("No Sale",)):
			frappe.throw(_("No Sale needs a manager's approval"))
	log = frappe.get_doc(
		{
			"doctype": "POS Drawer Log",
			"opened_on": time or now_datetime(),
			"user": frappe.session.user,
			"pos_profile": pos_profile,
			"pos_opening_shift": _open_shift(pos_profile),
			"reason": (reason or "")[:140],
			"approval": approval if approval and frappe.db.exists("POS Approval Log", approval) else None,
			"offline": cint(offline),
			"client_id": client_id,
		}
	)
	log.flags.ignore_permissions = True
	log.insert()
	if log.approval:
		mark_approval_used(log.approval, None)
	return log.name


# ------------------------------------------------------------------ cash movements
@frappe.whitelist()
def cash_movement(pos_profile, movement_type, amount, reason=None, approval=None, pos_opening_shift=None,
	client_id=None, offline=0):
	"""Cash pickup, cash in or cash out of the drawer (submitted at once)."""
	_check_profile_user(pos_profile)
	s = settings(pos_profile)
	if not s.cash_pickup:
		frappe.throw(_("Cash pickup and cash in / out are not switched on for POS Profile {0}").format(pos_profile))
	found = _dedupe("POS Cash Movement", client_id)
	if found:
		return found
	shift = pos_opening_shift or _open_shift(pos_profile)
	if not shift:
		frappe.throw(_("Open a shift first"))
	doc = frappe.get_doc(
		{
			"doctype": "POS Cash Movement",
			"movement_type": movement_type,
			"amount": flt(amount),
			"reason": reason,
			"mode_of_payment": s.cash_mode_of_payment,
			"posting_date": nowdate(),
			"posting_time": nowtime(),
			"pos_profile": pos_profile,
			"pos_opening_shift": shift,
			"user": frappe.session.user,
			"approval": approval if approval and frappe.db.exists("POS Approval Log", approval) else None,
			"offline": cint(offline),
			"client_id": client_id,
		}
	)
	doc.flags.ignore_permissions = True
	doc.insert()
	doc.submit()
	return doc.name


def _cash_account(mode_of_payment, company):
	return frappe.db.get_value(
		"Mode of Payment Account", {"parent": mode_of_payment, "company": company}, "default_account"
	)


def make_cash_journal(doc):
	"""Journal Entry of a cash movement, when the POS Profile has the account."""
	s = settings(doc.pos_profile)
	other = s.safe_account if doc.movement_type == "Cash Pickup" else s.cash_in_out_account
	if not other:
		return
	cash = _cash_account(doc.mode_of_payment, doc.company)
	if not cash:
		frappe.throw(_("Set the {0} account of Mode of Payment {1}").format(doc.company, doc.mode_of_payment))
	amount = flt(doc.amount)
	if doc.movement_type == "Cash In":
		debit, credit = cash, other
	else:
		debit, credit = other, cash
	cost_center = frappe.get_cached_value("POS Profile", doc.pos_profile, "cost_center") or frappe.get_cached_value(
		"Company", doc.company, "cost_center"
	)
	je = frappe.get_doc(
		{
			"doctype": "Journal Entry",
			"voucher_type": "Cash Entry",
			"company": doc.company,
			"posting_date": doc.posting_date,
			"user_remark": "%s %s (%s) %s" % (doc.movement_type, doc.name, doc.pos_opening_shift, doc.reason or ""),
			"accounts": [
				{"account": debit, "debit_in_account_currency": amount, "cost_center": cost_center},
				{"account": credit, "credit_in_account_currency": amount, "cost_center": cost_center},
			],
		}
	)
	je.flags.ignore_permissions = True
	je.insert()
	je.submit()
	doc.db_set("journal_entry", je.name)


def movements_of_shift(pos_opening_shift):
	rows = frappe.get_all(
		"POS Cash Movement",
		filters={"pos_opening_shift": pos_opening_shift, "docstatus": 1},
		fields=["name", "movement_type", "amount", "mode_of_payment", "reason", "posting_time", "user"],
		order_by="creation asc",
	)
	tot = {"Cash In": 0.0, "Cash Out": 0.0, "Cash Pickup": 0.0}
	for r in rows:
		tot[r.movement_type] = tot.get(r.movement_type, 0.0) + flt(r.amount)
	return rows, tot


# ------------------------------------------------------------------ drawer cash, X / Z report
def _shift_numbers(pos_opening_shift):
	shift = frappe.get_doc("POS Opening Shift", pos_opening_shift)
	s = settings(shift.pos_profile)
	cash_mop = s.cash_mode_of_payment if s.enabled else (
		frappe.get_cached_value("POS Profile", shift.pos_profile, "posa_cash_mode_of_payment") or "Cash"
	)
	invoices = frappe.get_all(
		"Sales Invoice",
		filters={"posa_pos_opening_shift": pos_opening_shift, "docstatus": 1},
		fields=[
			"name", "is_return", "grand_total", "net_total", "total_qty", "discount_amount", "change_amount",
			"total_taxes_and_charges", "rounded_total",
		],
	)
	names = [i.name for i in invoices]
	payments = {}
	if names:
		for p in frappe.get_all(
			"Sales Invoice Payment",
			filters={"parent": ["in", names], "parenttype": "Sales Invoice"},
			fields=["parent", "mode_of_payment", "amount"],
		):
			payments[p.mode_of_payment] = payments.get(p.mode_of_payment, 0.0) + flt(p.amount)
	change = sum(flt(i.change_amount) for i in invoices)
	if change:
		payments[cash_mop] = payments.get(cash_mop, 0.0) - change
	item_disc = 0.0
	if names:
		item_disc = flt(
			frappe.db.sql(
				"select sum(discount_amount * qty) from `tabSales Invoice Item` where parent in %s and parenttype='Sales Invoice'",
				(names,),
			)[0][0]
		)
	opening = {d.mode_of_payment: flt(d.amount) for d in shift.get("balance_details") or []}
	expenses = {}
	for e in frappe.get_all(
		"POS Expense Invoice",
		filters={"pos_opening_shift": pos_opening_shift, "docstatus": 1},
		fields=["mode_of_payment", "total_expense"],
	):
		m = e.mode_of_payment or cash_mop
		expenses[m] = expenses.get(m, 0.0) + flt(e.total_expense)
	from posawesome.posawesome.doctype.pos_closing_shift.pos_closing_shift import get_payments_entries

	received = {}
	for py in get_payments_entries(pos_opening_shift):
		received[py.mode_of_payment] = received.get(py.mode_of_payment, 0.0) + flt(py.paid_amount)
	moves, mtot = movements_of_shift(pos_opening_shift)
	modes = sorted(set(opening) | set(payments) | set(expenses) | set(received) | {cash_mop})
	rows = []
	for m in modes:
		exp = opening.get(m, 0.0) + payments.get(m, 0.0) + received.get(m, 0.0) - expenses.get(m, 0.0)
		if m == cash_mop:
			exp += mtot["Cash In"] - mtot["Cash Out"] - mtot["Cash Pickup"]
		rows.append(
			{
				"mode_of_payment": m,
				"opening": opening.get(m, 0.0),
				"sales": payments.get(m, 0.0),
				"received": received.get(m, 0.0),
				"expenses": expenses.get(m, 0.0),
				"expected": exp,
			}
		)
	sales = [i for i in invoices if not cint(i.is_return)]
	returns = [i for i in invoices if cint(i.is_return)]
	voids = frappe.get_all(
		"POS Void Log",
		filters={"pos_opening_shift": pos_opening_shift, "void_type": ["in", ["Line Void", "Cart Void"]]},
		fields=["void_type", "amount", "sale_id"],
	)
	approvals = frappe.db.sql(
		"""select action, count(*) as n from `tabPOS Approval Log`
		where pos_opening_shift = %s and status in ('Approved', 'Used', 'Offline') group by action""",
		(pos_opening_shift,),
		as_dict=True,
	)
	return frappe._dict(
		shift=shift,
		cash_mop=cash_mop,
		invoices=len(invoices),
		sales_count=len(sales),
		returns_count=len(returns),
		gross=sum(flt(i.grand_total) for i in sales),
		returns=sum(flt(i.grand_total) for i in returns),
		net=sum(flt(i.grand_total) for i in invoices),
		net_total=sum(flt(i.net_total) for i in invoices),
		taxes=sum(flt(i.total_taxes_and_charges) for i in invoices),
		qty=sum(flt(i.total_qty) for i in sales),
		discount=sum(flt(i.discount_amount) for i in invoices) + item_disc,
		modes=rows,
		moves=moves,
		cash_in=mtot["Cash In"],
		cash_out=mtot["Cash Out"],
		pickups=mtot["Cash Pickup"],
		no_sales=frappe.db.count("POS Drawer Log", {"pos_opening_shift": pos_opening_shift}),
		line_voids=len([v for v in voids if v.void_type == "Line Void"]),
		cart_voids=len({v.sale_id or i for i, v in enumerate(voids) if v.void_type == "Cart Void"}),
		void_amount=sum(flt(v.amount) for v in voids),
		approvals={a.action: a.n for a in approvals},
		expected_cash=next((r["expected"] for r in rows if r["mode_of_payment"] == cash_mop), 0.0),
	)


@frappe.whitelist()
def x_report(pos_opening_shift):
	"""The shift so far (X report): sales, payments, cash movements, voids."""
	shift = frappe.db.get_value("POS Opening Shift", pos_opening_shift, ["pos_profile", "user"], as_dict=True)
	if not shift:
		frappe.throw(_("POS Opening Shift {0} not found").format(pos_opening_shift))
	_check_profile_user(shift.pos_profile)
	s = settings(shift.pos_profile)
	if not s.xz_report:
		frappe.throw(_("X / Z reports are not switched on for POS Profile {0}").format(shift.pos_profile))
	n = _shift_numbers(pos_opening_shift)
	out = dict(n)
	out.pop("shift")
	out.update(
		{
			"name": pos_opening_shift,
			"pos_profile": shift.pos_profile,
			"user": shift.user,
			"user_name": frappe.utils.get_fullname(shift.user),
			"period_start": n.shift.period_start_date,
			"printed_on": now_datetime(),
			"printed_by": frappe.session.user,
			"blind": bool(s.blind_close),
		}
	)
	if s.blind_close and "Sales Manager" not in frappe.get_roles() and "System Manager" not in frappe.get_roles():
		# a blind close: the cashier does not see the expected cash before counting
		for r in out["modes"]:
			r["expected"] = None
		out["expected_cash"] = None
	return out


def shift_report(pos_opening_shift):
	"""Jinja: the numbers of a shift for the X / Z Report print formats."""
	if not pos_opening_shift or not frappe.db.exists("POS Opening Shift", pos_opening_shift):
		return frappe._dict()
	n = _shift_numbers(pos_opening_shift)
	n.pop("shift")
	return n


@frappe.whitelist()
def drawer_cash(pos_profile):
	"""Cash now in the drawer of the current shift, against the profile's limit."""
	_check_profile_user(pos_profile)
	s = settings(pos_profile)
	if not s.cash_pickup or not s.drawer_limit:
		return {"over": False}
	shift = _open_shift(pos_profile)
	if not shift:
		return {"over": False}
	cash = _shift_numbers(shift).expected_cash
	return {"over": flt(cash) > flt(s.drawer_limit), "limit": s.drawer_limit, "cash": None if s.blind_close else cash}


# ------------------------------------------------------------------ closing
def add_to_closing(closing_shift):
	"""make_closing_shift_from_opening: the cash movements of the shift change
	the expected cash; the closing gets the supermarket summary."""
	s = settings(closing_shift.pos_profile)
	if not s.enabled:
		return closing_shift
	closing_shift.posa_sm_enabled = 1
	closing_shift.posa_sm_blind_close = 1 if s.blind_close else 0
	if s.cash_pickup:
		_, tot = movements_of_shift(closing_shift.pos_opening_shift)
		delta = tot["Cash In"] - tot["Cash Out"] - tot["Cash Pickup"]
		if delta:
			row = next((r for r in closing_shift.payment_reconciliation if r.mode_of_payment == s.cash_mode_of_payment), None)
			if row is None:
				row = closing_shift.append(
					"payment_reconciliation",
					{"mode_of_payment": s.cash_mode_of_payment, "opening_amount": 0, "expected_amount": 0},
				)
			row.expected_amount = flt(row.expected_amount) + delta
	return closing_shift


def validate_closing(doc, method=None):
	s = settings(doc.pos_profile)
	if not s.enabled:
		return
	n = _shift_numbers(doc.pos_opening_shift)
	doc.posa_sm_enabled = 1
	doc.posa_sm_cash_in = n.cash_in
	doc.posa_sm_cash_out = n.cash_out
	doc.posa_sm_pickups = n.pickups
	doc.posa_sm_no_sales = n.no_sales
	doc.posa_sm_line_voids = n.line_voids
	doc.posa_sm_cart_voids = n.cart_voids
	doc.posa_sm_void_amount = n.void_amount
	doc.posa_sm_approvals = sum(cint(v) for v in n.approvals.values())
	doc.posa_sm_blind_close = 1 if s.blind_close else 0
	cash = next((r for r in doc.get("payment_reconciliation") or [] if r.mode_of_payment == s.cash_mode_of_payment), None)
	doc.posa_sm_over_short = flt(cash.difference) if cash else 0


def on_submit_closing(doc, method=None):
	"""Training sales of the shift are removed when it closes."""
	s = settings(doc.pos_profile)
	if not s.enabled:
		return
	for name in frappe.get_all(
		"Sales Invoice",
		filters={"posa_pos_opening_shift": doc.pos_opening_shift, "docstatus": 0, "posa_training": 1},
		pluck="name",
	):
		frappe.delete_doc("Sales Invoice", name, force=1, ignore_permissions=True)


# ------------------------------------------------------------------ POS Profile
def validate_profile(doc, method=None):
	_clear_cache()
	if not cint(doc.get("posa_enable_supermarket")):
		return
	if cint(doc.get("posa_sm_manager_approval")):
		seen = set()
		for row in doc.get("posa_sm_managers") or []:
			if row.user in seen:
				frappe.throw(_("Managers row {0}: {1} is listed twice").format(row.idx, row.user))
			seen.add(row.user)
		if not seen:
			frappe.msgprint(_("Manager Approval is on but no manager is listed: approvals cannot be given."),
				indicator="orange", alert=True)
		missing = [u for u in seen if not frappe.db.exists("POS Manager PIN", {"name": u, "disabled": 0})]
		if missing:
			frappe.msgprint(_("These managers have no PIN yet (set it in POS Manager PIN): {0}").format(", ".join(missing)),
				indicator="orange", alert=True)
	if cint(doc.get("posa_sm_hotkeys")):
		seen = {}
		for row in doc.get("posa_sm_hotkey_list") or []:
			key = normalize_hotkey(row.key)
			if not key:
				frappe.throw(
					_("Hotkeys row {0}: use F1 to F12, or a key with Ctrl / Alt (e.g. Ctrl+Q, Alt+P)").format(row.idx)
				)
			if row.action not in HOTKEY_ACTIONS:
				frappe.throw(_("Hotkeys row {0}: unknown action {1}").format(row.idx, row.action))
			if key in seen:
				frappe.throw(_("Hotkeys row {0}: {1} is already used in row {2}").format(row.idx, key, seen[key]))
			seen[key] = row.idx
			row.key = key
	if cint(doc.get("posa_sm_scale_reading")) and cint(doc.get("posa_sm_scale_baud")) not in (
		1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200
	):
		frappe.throw(_("Scale Baud Rate: use 1200, 2400, 4800, 9600, 19200, 38400, 57600 or 115200"))
	if cint(doc.get("posa_sm_void_reason")):
		ensure_void_reasons()
	if cint(doc.get("posa_sm_shelf_labels")):
		from posawesome.posawesome.api.shelf_labels import _clear, ensure_templates

		ensure_templates()
		_clear()
		if not doc.get("posa_sm_label_template"):
			doc.posa_sm_label_template = "Shelf 58x38"
	if cint(doc.get("posa_sm_cash_drawer")):
		try:
			parse_drawer_code(doc.get("posa_sm_drawer_code") or "27,112,0,25,250")
		except ValueError as e:
			frappe.throw(_("Drawer Pulse Code: {0}").format(str(e)))


def normalize_hotkey(text):
	"""'ctrl + q' -> 'Ctrl+Q', 'f4' -> 'F4'. None when it would clash with typing
	(a plain letter, digit or symbol without Ctrl / Alt)."""
	parts = [p.strip() for p in str(text or "").replace(" ", "").split("+")]
	if not parts or not parts[-1]:
		return None
	mods = {p.lower() for p in parts[:-1]}
	if mods - {"ctrl", "alt", "shift"}:
		return None
	key = parts[-1]
	if len(key) == 1:
		key = key.upper()
	elif key.lower() in ("esc", "escape", "enter", "tab", "backspace", "delete", "space"):
		return None
	elif key.upper().startswith("F") and key[1:].isdigit() and 1 <= int(key[1:]) <= 12:
		key = key.upper()
	elif key.upper().startswith("F") and key[1:].isdigit():
		return None  # F13+ do not exist on a till keyboard
	else:
		key = key[:1].upper() + key[1:]
	is_f = key.startswith("F") and key[1:].isdigit()
	if not is_f and not ({"ctrl", "alt"} & mods):
		return None
	order = [m for m in ("Ctrl", "Alt", "Shift") if m.lower() in mods]
	return "+".join(order + [key])


def parse_drawer_code(code):
	out = []
	for part in str(code).replace(" ", "").split(","):
		if not part:
			continue
		v = int(part, 16) if part.lower().startswith("0x") else int(part)
		if not 0 <= v <= 255:
			raise ValueError(_("each number must be 0 to 255"))
		out.append(v)
	if not out:
		raise ValueError(_("empty"))
	return out


# ------------------------------------------------------------------ defaults
DEFAULT_REASONS = ("Customer Changed Mind", "Wrong Item Scanned", "Price Query", "Damaged Item")


def ensure_void_reasons():
	"""A few void reasons the first time Void With Reason is switched on."""
	if frappe.db.count("POS Void Reason", {"reason_type": ["in", ["Void", "Both"]]}):
		return
	for r in DEFAULT_REASONS:
		if not frappe.db.exists("POS Void Reason", r):
			frappe.get_doc({"doctype": "POS Void Reason", "reason": r, "reason_type": "Void"}).insert(
				ignore_permissions=True
			)


# ================================================================== phase 3: promotions
DAY_NAMES = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")


def clean_days(text):
	"""'fri,SATURDAY' -> 'Fri, Sat'. Throws on a word that is not a day."""
	full = ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")
	out = []
	for part in str(text or "").replace(";", ",").replace(" ", ",").split(","):
		low = part.strip().lower()
		if not low:
			continue
		idx = next((k for k, f in enumerate(full) if len(low) >= 3 and f.startswith(low)), None)
		if idx is None:
			frappe.throw(_("Days: {0} is not a day (use Mon, Tue, Wed, Thu, Fri, Sat, Sun)").format(part.strip()))
		if DAY_NAMES[idx] not in out:
			out.append(DAY_NAMES[idx])
	out.sort(key=DAY_NAMES.index)
	return ", ".join(out)


def _minutes(t):
	if t in (None, ""):
		return None
	if hasattr(t, "total_seconds"):
		return int(t.total_seconds() // 60) % (24 * 60)
	parts = str(t).split(":")
	try:
		return int(parts[0]) * 60 + int(parts[1] if len(parts) > 1 else 0)
	except ValueError:
		return None


def in_schedule(at, valid_from=None, valid_upto=None, daily_from=None, daily_to=None, days=None):
	"""Is `at` (datetime) inside the dates, daily hours and days? A daily window
	that runs past midnight (22:00-02:00) belongs to the day it started."""
	from frappe.utils import get_datetime, getdate

	at = get_datetime(at)
	d = at.date()
	if valid_from and d < getdate(valid_from):
		return False
	if valid_upto and d > getdate(valid_upto):
		return False
	start, end = _minutes(daily_from), _minutes(daily_to)
	now_m = at.hour * 60 + at.minute
	day_idx = at.weekday()
	if start is not None and end is not None and start != end:
		if start < end:
			if not (start <= now_m < end):
				return False
		else:
			if now_m >= start:
				pass  # evening part: today's window
			elif now_m < end:
				day_idx = (day_idx - 1) % 7  # after midnight: yesterday's window
			else:
				return False
	if days:
		allowed = {DAY_NAMES.index(x.strip()) for x in str(days).split(",") if x.strip() in DAY_NAMES}
		if allowed and day_idx not in allowed:
			return False
	return True


def active_deals(pos_profile, s=None, at=None):
	"""Deals of this POS Profile within their dates (the till checks the hours / days)."""
	s = s or settings(pos_profile)
	types = [t for t, on in (("Mix and Match", s.mix_match), ("Multi-Buy", s.multibuy)) if on]
	if not types:
		return []
	from frappe.utils import getdate

	today = getdate(at) if at else getdate()
	out = []
	for name in frappe.get_all("POS Deal", filters={"disabled": 0, "deal_type": ["in", types]}, pluck="name"):
		d = frappe.get_cached_doc("POS Deal", name)
		if d.company and s.company and d.company != s.company:
			continue
		profiles = [r.pos_profile for r in d.get("pos_profiles") or []]
		if profiles and pos_profile not in profiles:
			continue
		if d.valid_upto and getdate(d.valid_upto) < today:
			continue
		out.append(
			{
				"name": d.name,
				"title": d.title,
				"deal_type": d.deal_type,
				"quantity": cint(d.quantity),
				"deal_price": flt(d.deal_price),
				"repeat": cint(d.repeat),
				"max_sets": cint(d.max_sets),
				"priority": cint(d.priority),
				"valid_from": str(d.valid_from) if d.valid_from else None,
				"valid_upto": str(d.valid_upto) if d.valid_upto else None,
				"daily_from": str(d.daily_from) if d.daily_from else None,
				"daily_to": str(d.daily_to) if d.daily_to else None,
				"days": d.days or None,
				"items": [r.item_code for r in d.get("items") or []],
				"item_groups": [r.item_group for r in d.get("item_groups") or []],
				"brands": [r.brand for r in d.get("brands") or []],
			}
		)
	return out


def _deal_matches(deal, row):
	return (
		row.get("item_code") in (deal.get("items") or [])
		or (row.get("item_group") and row.get("item_group") in (deal.get("item_groups") or []))
		or (row.get("brand") and row.get("brand") in (deal.get("brands") or []))
	)


def deal_eligible(row):
	"""A cart row a deal may price: a normal sold line at its list price (no
	offer, free item, markdown, comp or manual discount on it)."""
	if flt(row.get("qty")) <= 0 or flt(row.get("price_list_rate")) <= 0:
		return False
	if cint(row.get("is_free_item")) or cint(row.get("posa_is_offer")) or row.get("posa_is_replace"):
		return False
	if row.get("posa_sm_markdown") or cint(row.get("posa_comp")):
		return False
	if not row.get("posa_sm_deal"):
		if cint(row.get("posa_offer_applied")):
			return False
		if flt(row.get("discount_amount")) > 0.0001 or flt(row.get("discount_percentage")) > 0.0001:
			return False
		if flt(row.get("rate")) < flt(row.get("price_list_rate")) - 0.0001:
			return False
	return True


def deal_discounts(rows, deals, at=None):
	"""{row index: (deal name, total discount of the row)} for the cart rows.
	Deals in priority order; each row belongs to one deal at most. Units are
	whole items; the most expensive ones are grouped first. A deal is used only
	when it is cheaper than the normal price. The till has the same rule
	(shared/supermarket/logic.js dealDiscounts)."""
	order = sorted(
		[d for d in deals if at is None or in_schedule(at, d.get("valid_from"), d.get("valid_upto"), d.get("daily_from"), d.get("daily_to"), d.get("days"))],
		key=lambda d: (-cint(d.get("priority")), str(d.get("name"))),
	)
	taken = set()
	out = {}
	for deal in order:
		n = cint(deal.get("quantity"))
		if n < 2:
			continue
		pool = [i for i, r in enumerate(rows) if i not in taken and deal_eligible(r) and _deal_matches(deal, r)]
		if not pool:
			continue
		groups = [pool]
		if deal.get("deal_type") == "Multi-Buy":
			by_item = {}
			for i in pool:
				by_item.setdefault(rows[i].get("item_code"), []).append(i)
			groups = list(by_item.values())
		max_sets = cint(deal.get("max_sets")) if cint(deal.get("repeat")) else 1
		used_sets = 0
		for group in groups:
			units = []
			for i in group:
				for _k in range(int(flt(rows[i].get("qty")) + 1e-9)):
					units.append((-flt(rows[i].get("price_list_rate")), i))
			units.sort(key=lambda u: (u[0], u[1]))
			sets = len(units) // n
			if not cint(deal.get("repeat")):
				sets = min(sets, 1)
			if max_sets:
				sets = min(sets, max_sets - used_sets)
			if sets <= 0:
				continue
			chosen = units[: sets * n]
			normal = sum(-u[0] for u in chosen)
			saving = normal - sets * flt(deal.get("deal_price"))
			if saving <= 0.0001:
				continue
			used_sets += sets
			share = {}
			for price, i in chosen:
				share[i] = share.get(i, 0.0) + (-price)
			for i, amt in share.items():
				out[i] = (deal.get("name"), round(saving * amt / normal, 4))
				taken.add(i)
	return out


def open_markdowns(company=None):
	"""Unsold reduced-price labels the tills can scan."""
	from frappe.utils import getdate

	today = getdate()
	filters = {"docstatus": 1}
	if company:
		filters["company"] = company
	out = []
	for m in frappe.get_all(
		"POS Markdown",
		filters=filters,
		fields=["name", "item_code", "item_name", "batch_no", "markdown_price", "original_price", "valid_upto", "expiry_date"],
	):
		until = m.valid_upto or m.expiry_date
		if until and getdate(until) < today:
			continue
		for code in frappe.get_all(
			"POS Markdown Label", filters={"parent": m.name, "parenttype": "POS Markdown", "used": 0}, pluck="code"
		):
			out.append(
				{
					"code": code,
					"markdown": m.name,
					"item_code": m.item_code,
					"item_name": m.item_name,
					"batch_no": m.batch_no,
					"price": flt(m.markdown_price),
					"original_price": flt(m.original_price),
				}
			)
	return out


def validate_markdown(doc):
	if cint(doc.qty) < 1 or cint(doc.qty) > 500:
		frappe.throw(_("Labels: 1 to 500"))
	price = frappe.db.get_value(
		"Item Price", {"item_code": doc.item_code, "price_list": doc.price_list, "selling": 1}, "price_list_rate"
	)
	if price is None:
		frappe.throw(_("{0} has no price in {1}").format(doc.item_code, doc.price_list))
	doc.original_price = flt(price)
	if flt(doc.markdown_price) <= 0 or flt(doc.markdown_price) >= flt(doc.original_price):
		frappe.throw(_("The reduced price must be above 0 and below the normal price ({0})").format(flt(doc.original_price)))
	doc.discount_pct = round((flt(doc.original_price) - flt(doc.markdown_price)) * 100.0 / flt(doc.original_price), 2)
	if doc.valid_upto and doc.expiry_date and str(doc.valid_upto) > str(doc.expiry_date):
		frappe.msgprint(_("Sell Until is after the expiry date"), indicator="orange", alert=True)
	doc.sold = len([l for l in doc.get("labels") or [] if l.used])


def _label_code(markdown_name, i):
	"""MD + 10 digits: 7 from the document number, 2 for the label, 1 check digit."""
	import zlib

	base = "%07d%02d" % (zlib.crc32(markdown_name.encode()) % 10000000, i % 100)
	check = sum(int(c) * (3 if k % 2 else 1) for k, c in enumerate(base)) % 10
	return "MD" + base + str(check)


def make_markdown_labels(doc):
	doc.set("labels", [])
	seen = set()
	salt = 0
	for i in range(cint(doc.qty)):
		code = _label_code(doc.name + ("" if not salt else "#%d" % salt), i)
		while code in seen or frappe.db.exists("POS Markdown Label", {"code": code}):
			salt += 1
			code = _label_code(doc.name + "#%d" % salt, i)
		seen.add(code)
		doc.append("labels", {"code": code, "used": 0})
	for row in doc.labels:
		row.db_insert()
	frappe.publish_realtime("posa_markdowns_changed", {"markdown": doc.name}, after_commit=True)


def _markdown_label(code):
	rows = frappe.db.sql(
		"""select l.name, l.used, l.sales_invoice, m.name as markdown, m.item_code, m.markdown_price, m.docstatus,
			m.valid_upto, m.expiry_date, m.company
		from `tabPOS Markdown Label` l join `tabPOS Markdown` m on m.name = l.parent
		where l.code = %s and l.parenttype = 'POS Markdown' limit 1""",
		(code,),
		as_dict=True,
	)
	return rows[0] if rows else None


def check_promotions(doc, s, offline):
	"""Deal and markdown lines of a sale (validate)."""
	rows = doc.get("items") or []
	if not (s.mix_match or s.multibuy or s.markdown_labels) and not any(r.get("posa_sm_markdown") for r in rows):
		return
	name = doc.name if not doc.is_new() else None
	seen_codes = set()
	for row in rows:
		code = row.get("posa_sm_markdown")
		if not code:
			continue
		if offline:
			continue
		if not s.markdown_labels:
			frappe.throw(_("Row {0}: reduced-price labels are not switched on").format(row.idx))
		if code in seen_codes:
			frappe.throw(_("Row {0}: label {1} is twice in this sale").format(row.idx, code))
		seen_codes.add(code)
		lab = _markdown_label(code)
		if not lab or lab.docstatus != 1:
			frappe.throw(_("Row {0}: {1} is not a valid reduced-price label").format(row.idx, code))
		if lab.used and lab.sales_invoice and lab.sales_invoice != name:
			frappe.throw(_("Row {0}: label {1} was already sold ({2})").format(row.idx, code, lab.sales_invoice))
		if lab.item_code != row.item_code:
			frappe.throw(_("Row {0}: label {1} is for {2}").format(row.idx, code, lab.item_code))
		if flt(row.qty) > 1:
			frappe.throw(_("Row {0}: one reduced-price label is for one item").format(row.idx))
		if flt(row.rate) < flt(lab.markdown_price) - 0.01:
			frappe.throw(_("Row {0}: the price is below the label's reduced price").format(row.idx))
	if offline or doc.docstatus != 1:
		return
	deal_rows = [r for r in rows if r.get("posa_sm_deal")]
	if not deal_rows:
		return
	deals = active_deals(doc.pos_profile, s)
	from frappe.utils import now_datetime

	times = [now_datetime()]
	if doc.get("creation"):
		times.append(doc.creation)
	allowed = {}
	for at in times:
		for i, (dname, disc) in deal_discounts(rows, deals, at).items():
			if disc > allowed.get(i, (None, 0))[1]:
				allowed[i] = (dname, disc)
	for i, row in enumerate(rows):
		if not row.get("posa_sm_deal"):
			continue
		got = (flt(row.price_list_rate) - flt(row.rate)) * flt(row.qty)
		ok = allowed.get(i)
		if not ok or ok[0] != row.posa_sm_deal or got > ok[1] + 0.05:
			frappe.throw(
				_("Row {0}: the price of deal {1} does not match ({2} off, the deal gives {3})").format(
					row.idx, row.posa_sm_deal, round(got, 2), round(ok[1], 2) if ok else 0
				),
				title=_("Deal"),
			)


def mark_markdowns(doc, used):
	for row in doc.get("items") or []:
		code = row.get("posa_sm_markdown")
		if not code:
			continue
		lab = _markdown_label(code)
		if not lab:
			continue
		if used:
			if lab.used and lab.sales_invoice and lab.sales_invoice != doc.name:
				frappe.log_error("Reduced label %s sold twice: %s and %s" % (code, lab.sales_invoice, doc.name), "POS Markdown")
				continue
			frappe.db.set_value("POS Markdown Label", lab.name, {"used": 1, "sales_invoice": doc.name, "used_on": now_datetime()},
				update_modified=False)
		elif lab.sales_invoice == doc.name:
			frappe.db.set_value("POS Markdown Label", lab.name, {"used": 0, "sales_invoice": None, "used_on": None},
				update_modified=False)
		sold = frappe.db.count("POS Markdown Label", {"parent": lab.markdown, "used": 1})
		frappe.db.set_value("POS Markdown", lab.markdown, "sold", sold, update_modified=False)
	frappe.publish_realtime("posa_markdowns_changed", {"invoice": doc.name}, after_commit=True)


def on_cancel_invoice(doc, method=None):
	if not any(r.get("posa_sm_markdown") for r in doc.get("items") or []):
		return
	mark_markdowns(doc, used=False)


# ------------------------------------------------------------------ savings ("You saved")
def savings(doc):
	"""What the customer saved on a sale, by kind."""
	out = frappe._dict(offers=0.0, deals=0.0, markdowns=0.0, discounts=0.0, mrp=0.0, total=0.0)
	if cint(doc.get("is_return")):
		return out
	for row in doc.get("items") or []:
		qty = flt(row.get("qty"))
		if qty <= 0:
			continue
		plr = flt(row.get("price_list_rate"))
		rate = flt(row.get("rate"))
		mrp = flt(row.get("maximum_retail_price"))
		if mrp > plr > 0:
			out.mrp += (mrp - plr) * qty
		if plr > rate:
			off = (plr - rate) * qty
			if row.get("posa_sm_markdown"):
				out.markdowns += off
			elif row.get("posa_sm_deal"):
				out.deals += off
			elif cint(row.get("posa_offer_applied")) or cint(row.get("posa_is_offer")) or cint(row.get("is_free_item")):
				out.offers += off
			else:
				out.discounts += off
	inv = flt(doc.get("discount_amount"))
	if inv > 0:
		if doc.get("posa_offers"):
			out.offers += inv
		else:
			out.discounts += inv
	for k in ("offers", "deals", "markdowns", "discounts", "mrp"):
		out[k] = round(out[k], 2)
	out.total = round(out.offers + out.deals + out.markdowns + out.discounts + out.mrp, 2)
	return out


def posa_savings(doc):
	"""Jinja: {% set sv = posa_savings(doc) %} ... sv.total, sv.offers, sv.deals, sv.markdowns, sv.mrp"""
	return savings(doc)


# ------------------------------------------------------------------ Code 128 barcode (SVG) for labels
CODE128 = (
	"212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 "
	"123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 "
	"232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 "
	"313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 "
	"111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 "
	"111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 "
	"114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112"
).split()


def code128_values(text):
	"""Code 128 values (start, data, check, stop): set C for long digit runs, else set B."""
	text = str(text)
	if not text or any(ord(c) < 32 or ord(c) > 126 for c in text):
		raise ValueError("Code 128 B/C: printable ASCII only")
	vals = []
	digits = text.isdigit() and len(text) % 2 == 0 and len(text) >= 4
	if digits:
		vals.append(105)
		for k in range(0, len(text), 2):
			vals.append(int(text[k : k + 2]))
	else:
		vals.append(104)
		for c in text:
			vals.append(ord(c) - 32)
	check = (vals[0] + sum(v * (k + 1) for k, v in enumerate(vals[1:]))) % 103
	return vals + [check, 106]


def posa_barcode_svg(text, height=40, module=1.4, show_text=True):
	"""Jinja: an inline SVG Code 128 barcode (prints in PDF and on any printer)."""
	try:
		vals = code128_values(text)
	except ValueError:
		return ""
	x = 10 * module  # quiet zone
	bars = []
	for v in vals:
		pattern = CODE128[v]
		for k, w in enumerate(pattern):
			width = int(w) * module
			if k % 2 == 0:
				bars.append('<rect x="%.2f" y="0" width="%.2f" height="%d"/>' % (x, width, height))
			x += width
	total = x + 10 * module
	label = (
		'<text x="%.2f" y="%d" font-size="10" text-anchor="middle" font-family="monospace">%s</text>'
		% (total / 2, height + 11, frappe.utils.escape_html(str(text)))
		if show_text
		else ""
	)
	h = height + (13 if show_text else 0)
	return (
		'<svg xmlns="http://www.w3.org/2000/svg" width="%.0f" height="%d" viewBox="0 0 %.2f %d"><g fill="#000">%s</g>%s</svg>'
		% (total, h, total, h, "".join(bars), label)
	)


# ================================================================== phase 4: payments and customers
def _gift_rows(doc, s):
	return [r for r in doc.get("items") or [] if s.gift_card_item and r.item_code == s.gift_card_item]


def _gift_payment(doc, s):
	return sum(flt(p.amount) for p in doc.get("payments") or [] if s.gift_card_mop and p.mode_of_payment == s.gift_card_mop)


def _card(card_no, for_update=False):
	if not card_no:
		return None
	if for_update:
		frappe.db.sql("select name from `tabPOS Gift Card` where name = %s for update", (card_no,))
	return frappe.db.get_value("POS Gift Card", card_no, ["name", "status", "balance", "expiry_date", "company", "customer"], as_dict=True)


def _card_usable(card, company):
	from frappe.utils import getdate

	if not card:
		return _("Gift card not found")
	if card.status != "Active":
		return _("Gift card {0} is blocked").format(card.name)
	if card.company and company and card.company != company:
		return _("Gift card {0} belongs to {1}").format(card.name, card.company)
	if card.expiry_date and getdate(card.expiry_date) < getdate():
		return _("Gift card {0} expired on {1}").format(card.name, card.expiry_date)
	return None


@frappe.whitelist()
def gift_card_balance(pos_profile, card_no):
	"""Balance of a card on the till (menu Gift Card > Balance, payment)."""
	_check_profile_user(pos_profile)
	s = settings(pos_profile)
	if not s.gift_cards:
		frappe.throw(_("Gift cards are not switched on for POS Profile {0}").format(pos_profile))
	card = _card(str(card_no or "").strip())
	if not card:
		return {"exists": False}
	return {
		"exists": True,
		"card_no": card.name,
		"balance": flt(card.balance),
		"status": card.status,
		"expiry_date": str(card.expiry_date) if card.expiry_date else None,
		"customer": card.customer,
		"problem": _card_usable(card, s.company),
	}


@frappe.whitelist()
def new_store_credit_no(pos_profile):
	"""A free card number for a new store credit card: SC + 10 digits."""
	_check_profile_user(pos_profile)
	import secrets as _secrets

	for _i in range(20):
		code = "SC" + "".join(str(_secrets.randbelow(10)) for _k in range(10))
		if not frappe.db.exists("POS Gift Card", code):
			return code
	frappe.throw(_("Could not make a card number, try again"))


def check_payments(doc, s, offline):
	"""Gift card lines / payments, wallet and card references, age check (validate)."""
	if not (s.gift_cards or s.age_check):
		return
	is_return = cint(doc.get("is_return"))
	if s.gift_cards:
		for row in _gift_rows(doc, s):
			card_no = (row.get("posa_sm_gift_card") or "").strip()
			if not card_no:
				frappe.throw(_("Row {0}: the gift card number of this line is missing").format(row.idx))
			if is_return or flt(row.qty) <= 0:
				frappe.throw(_("Row {0}: a gift card sale cannot be returned; block the card instead").format(row.idx))
			if flt(row.qty) != 1 or flt(row.rate) <= 0:
				frappe.throw(_("Row {0}: a gift card line is one card with an amount").format(row.idx))
			if not offline:
				card = _card(card_no)
				if card and (card.status != "Active" or (card.company and card.company != s.company)):
					frappe.throw(_("Row {0}: {1}").format(row.idx, _card_usable(card, s.company)))
		paid = _gift_payment(doc, s)
		card_no = (doc.get("posa_sm_gift_card_no") or "").strip()
		if abs(paid) > 0.005:
			if not card_no:
				frappe.throw(_("Scan the gift card of the {0} payment").format(s.gift_card_mop))
			doc.posa_sm_gift_card_amount = paid
			if paid < 0 and not s.store_credit:
				frappe.throw(_("Refunds to a gift card (store credit) are not switched on"))
			if paid > 0 and not offline:
				card = _card(card_no, for_update=doc.docstatus == 1)
				problem = _card_usable(card, s.company)
				if problem:
					frappe.throw(problem, title=_("Gift Card"))
				if flt(card.balance) + 0.005 < paid:
					frappe.throw(
						_("Gift card {0} has {1}; the payment is {2}").format(card.name, flt(card.balance), paid),
						title=_("Gift Card"),
					)
		elif card_no:
			doc.posa_sm_gift_card_no = None
			doc.posa_sm_gift_card_amount = 0
	if s.age_check and cint(doc.get("posa_sm_age_checked")) and not doc.get("posa_sm_age_checked_by"):
		doc.posa_sm_age_checked_by = doc.get("owner") or frappe.session.user
	if s.age_check and not is_return and not offline and doc.docstatus == 1 and doc.get("posa_pos_opening_shift"):
		codes = list({r.item_code for r in doc.get("items") or [] if flt(r.qty) > 0})
		need = 0
		if codes:
			for v in frappe.get_all("Item", filters={"name": ["in", codes], "posa_sm_min_age": [">", 0]}, pluck="posa_sm_min_age"):
				need = max(need, cint(v))
		if need and cint(doc.get("posa_sm_age_checked")) < need:
			frappe.throw(_("This sale has items for {0}+ only: check the customer's age on the till").format(need),
				title=_("Age Check"))


def _add_entry(card_no, entry_type, amount, voucher_no, company, customer=None, expiry_days=0, store_credit=False):
	from frappe.utils import add_days, nowdate

	if frappe.db.exists("POS Gift Card", card_no):
		card = frappe.get_doc("POS Gift Card", card_no)
	else:
		card = frappe.get_doc(
			{
				"doctype": "POS Gift Card",
				"card_no": card_no,
				"company": company,
				"customer": customer,
				"status": "Active",
				"is_store_credit": 1 if store_credit else 0,
				"expiry_date": add_days(nowdate(), expiry_days) if expiry_days else None,
			}
		)
	balance = round(sum(flt(e.amount) for e in card.get("entries") or []) + flt(amount), 2)
	card.append(
		"entries",
		{
			"posting": now_datetime(),
			"entry_type": entry_type,
			"voucher_no": voucher_no,
			"amount": flt(amount),
			"balance": balance,
			"user": frappe.session.user,
		},
	)
	if customer and not card.customer:
		card.customer = customer
	card.flags.ignore_permissions = True
	card.save() if not card.is_new() else card.insert()
	return card


def gift_card_entries(doc, s):
	"""on_submit: load sold / topped-up cards, take payments, add store credit."""
	if not s.gift_cards:
		return
	for row in _gift_rows(doc, s):
		card_no = (row.get("posa_sm_gift_card") or "").strip()
		if not card_no:
			continue
		existed = frappe.db.exists("POS Gift Card", card_no)
		_add_entry(card_no, "Top Up" if existed else "Sold", flt(row.amount) or flt(row.rate) * flt(row.qty), doc.name, s.company,
			customer=doc.customer if doc.customer != frappe.db.get_value("POS Profile", doc.pos_profile, "customer") else None,
			expiry_days=s.gift_card_expiry_days)
	paid = _gift_payment(doc, s)
	card_no = (doc.get("posa_sm_gift_card_no") or "").strip()
	if card_no and abs(paid) > 0.005:
		if paid > 0:
			_add_entry(card_no, "Paid With", -paid, doc.name, s.company)
		else:
			_add_entry(card_no, "Store Credit", -paid, doc.name, s.company, customer=doc.customer,
				expiry_days=s.gift_card_expiry_days, store_credit=True)


def on_cancel_gift_cards(doc, method=None):
	"""A cancelled sale gives back what it took from / put on gift cards."""
	for card_no in frappe.get_all("POS Gift Card Entry", filters={"voucher_no": doc.name, "parenttype": "POS Gift Card"},
		pluck="parent", distinct=True) if frappe.db.table_exists("POS Gift Card Entry") else []:
		card = frappe.get_doc("POS Gift Card", card_no)
		# what this sale still changes on the card (a reversal already made counts against it)
		net = sum(flt(e.amount) for e in card.entries if e.voucher_no == doc.name)
		if abs(net) > 0.005:
			_add_entry(card_no, "Reversed", -net, doc.name, card.company)


# ------------------------------------------------------------------ wallet QR
def _crc16(data):
	crc = 0xFFFF
	for ch in data.encode("utf-8"):
		crc ^= ch << 8
		for _k in range(8):
			crc = ((crc << 1) ^ 0x1021) if crc & 0x8000 else (crc << 1)
			crc &= 0xFFFF
	return "%04X" % crc


def _tlv(text):
	out = []
	i = 0
	while i + 4 <= len(text):
		tag, ln = text[i : i + 2], text[i + 2 : i + 4]
		if not ln.isdigit():
			return None
		n = int(ln)
		val = text[i + 4 : i + 4 + n]
		if len(val) != n:
			return None
		out.append((tag, val))
		i += 4 + n
	return out if i == len(text) else None


def emv_with_amount(payload, amount):
	"""An EMVCo merchant QR (Raast / wallets: '000201...') with the amount put
	in (tag 54), dynamic (01 = 12) and a new CRC. Other text is returned as is."""
	text = str(payload or "").strip()
	if not text.startswith("000201"):
		return text
	tags = _tlv(text)
	if not tags:
		return text
	d = [(t, v) for t, v in tags if t not in ("54", "63")]
	d = [(t, "12") if t == "01" else (t, v) for t, v in d]
	if not any(t == "01" for t, _v in d):
		d.insert(1, ("01", "12"))
	if flt(amount) > 0:
		amt = ("%.2f" % flt(amount)).rstrip("0").rstrip(".")
		d.append(("54", amt))
	d.sort(key=lambda tv: (tv[0] != "00", tv[0]))
	body = "".join("%s%02d%s" % (t, len(v), v) for t, v in d) + "6304"
	return body + _crc16(body)


def qr_svg(text):
	"""A QR code of the text as an <img> with an SVG data URI ('' when it cannot be made)."""
	if not text:
		return ""
	try:
		import base64
		import io

		from pyqrcode import create

		buf = io.BytesIO()
		create(text, error="M").svg(buf, scale=4, xmldecl=False, svgns=True)
		return '<img src="data:image/svg+xml;base64,%s" style="width:220px;height:220px" alt="QR">' % base64.b64encode(
			buf.getvalue()
		).decode()
	except Exception:
		frappe.log_error(frappe.get_traceback(), "POS wallet QR")
		return ""


@frappe.whitelist()
def wallet_qr(pos_profile, mode_of_payment, amount=0):
	"""The QR code of a wallet / Raast payment with the amount (the till shows it)."""
	_check_profile_user(pos_profile)
	s = settings(pos_profile)
	w = next((x for x in s.wallets if x["mode_of_payment"] == mode_of_payment), None)
	if not w:
		frappe.throw(_("No QR code for {0} on POS Profile {1}").format(mode_of_payment, pos_profile))
	text = emv_with_amount(w["payload"], amount)
	return {"html": qr_svg(text), "dynamic": text != str(w["payload"]).strip(), "title": w["title"]}


# ------------------------------------------------------------------ e-receipts
def _receipt_phone(doc):
	phone = (doc.get("posa_sm_receipt_to") or "").strip()
	if phone:
		return phone
	if doc.customer and cint(frappe.db.get_value("Customer", doc.customer, "posa_sm_e_receipt")):
		return (frappe.db.get_value("Customer", doc.customer, "mobile_no") or "").strip()
	return ""


def normalize_phone(phone):
	"""03001234567 / +92 300 1234567 / 923001234567 -> 923001234567 (Pakistan numbers; others as typed, digits only)."""
	digits = "".join(c for c in str(phone or "") if c.isdigit())
	if digits.startswith("00"):
		digits = digits[2:]
	if digits.startswith("03") and len(digits) == 11:
		digits = "92" + digits[1:]
	return digits if 10 <= len(digits) <= 15 else ""


def receipt_text(doc):
	cur = doc.get("currency") or ""
	lines = ["%s" % (doc.company or ""), _("Receipt {0}").format(doc.name), str(doc.posting_date or "")]
	for r in (doc.get("items") or [])[:25]:
		lines.append("%s x%s %s" % (r.item_name, ("%g" % flt(r.qty)), frappe.utils.fmt_money(flt(r.amount), currency=cur)))
	if len(doc.get("items") or []) > 25:
		lines.append(_("... and {0} more").format(len(doc.items) - 25))
	lines.append(_("Total: {0}").format(frappe.utils.fmt_money(flt(doc.get("rounded_total") or doc.grand_total), currency=cur)))
	sv = savings(doc)
	if sv.total > 0:
		lines.append(_("You saved: {0}").format(frappe.utils.fmt_money(sv.total, currency=cur)))
	if doc.get("fbr_invoice_no"):
		lines.append(_("FBR Invoice: {0}").format(doc.fbr_invoice_no))
	lines.append(_("Thank you for shopping with us"))
	return "\n".join(lines)


def queue_e_receipt(doc, s):
	if not s.e_receipt or cint(doc.get("posa_training")):
		return
	phone = normalize_phone(_receipt_phone(doc))
	if not phone:
		return
	frappe.enqueue(
		"posawesome.posawesome.api.supermarket.send_e_receipt",
		queue="short",
		enqueue_after_commit=True,
		invoice=doc.name,
		phone=phone,
	)


def send_e_receipt(invoice, phone):
	"""Background job: the receipt by WhatsApp (WhatsBridge) and / or SMS."""
	doc = frappe.get_doc("Sales Invoice", invoice)
	s = settings(doc.pos_profile)
	channel = s.e_receipt_channel
	sent = False
	if channel in ("WhatsApp", "WhatsApp, else SMS"):
		sent = _send_whatsapp(doc, phone, s)
	if not sent and channel in ("SMS", "WhatsApp, else SMS"):
		sent = _send_sms(phone, receipt_text(doc))
	return sent


def _send_whatsapp(doc, phone, s):
	if not frappe.db.exists("DocType", "WhatsBridge Settings"):
		return False
	try:
		import requests

		ws = frappe.get_single("WhatsBridge Settings")
		if not ws.get("message_url") or not ws.get("token"):
			return False
		payload = {"secret": ws.token, "account": ws.account, "recipient": phone}
		if s.e_receipt_format == "PDF":
			url = _receipt_pdf_url(doc, s.e_receipt_print_format)
			payload.update({"type": "document", "document_url": url, "document_type": "pdf", "message": receipt_text(doc)})
		else:
			payload.update({"type": "text", "message": receipt_text(doc)})
		r = requests.post(ws.message_url.rstrip("/") + "/api/send/whatsapp", data=payload, timeout=30)
		ok = r.status_code == 200 and (r.json() or {}).get("status") == 200
		if frappe.db.exists("DocType", "WhatsBridge Message Log"):
			frappe.get_doc({
				"doctype": "WhatsBridge Message Log", "account": ws.account, "recipient": phone,
				"reference_doctype": "Sales Invoice", "reference_name": doc.name, "status": "Sent" if ok else "Failed",
				"message_type": payload["type"], "sent_on": now_datetime(), "message": payload.get("message"),
				"document_url": payload.get("document_url"), "document_type": payload.get("document_type"),
				"response": r.text[:1000],
			}).insert(ignore_permissions=True)
		return ok
	except Exception:
		frappe.log_error(frappe.get_traceback(), "POS e-receipt (WhatsApp)")
		return False


def _receipt_pdf_url(doc, print_format):
	pdf = frappe.get_print("Sales Invoice", doc.name, print_format or None, as_pdf=True)
	f = frappe.get_doc({
		"doctype": "File", "file_name": "%s_receipt.pdf" % doc.name, "content": pdf, "is_private": 0,
		"attached_to_doctype": "Sales Invoice", "attached_to_name": doc.name,
	})
	f.insert(ignore_permissions=True)
	return frappe.utils.get_url(f.file_url)


def _send_sms(phone, text):
	try:
		from frappe.core.doctype.sms_settings.sms_settings import send_sms

		send_sms([phone], text, success_msg=False)
		return True
	except Exception:
		frappe.log_error(frappe.get_traceback(), "POS e-receipt (SMS)")
		return False


# ------------------------------------------------------------------ loyalty on the customer display
@frappe.whitelist()
def loyalty_points(pos_profile, customer):
	_check_profile_user(pos_profile)
	s = settings(pos_profile)
	if not s.loyalty_display or not customer:
		return None
	program = frappe.db.get_value("Customer", customer, "loyalty_program")
	if not program:
		return None
	try:
		from erpnext.accounts.doctype.loyalty_program.loyalty_program import get_loyalty_program_details_with_points

		d = get_loyalty_program_details_with_points(customer, program, company=s.company, silent=True)
		return {"points": cint(d.get("loyalty_points")), "program": program}
	except Exception:
		return None
