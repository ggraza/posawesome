# Copyright (c) 2026, Youssef Restom and contributors
# For license information, please see license.txt
"""POS G2Virtu as an installable app (PWA) that also starts offline.

POS Profile > Offline and Devices > "Install as App and Start Offline (PWA)".
With no profile ticked nothing is registered, and a service worker registered
earlier is removed by the desk the next time it loads.

  /api/method/posawesome.posawesome.api.pwa.service_worker   the service worker (scope /)
  /api/method/posawesome.posawesome.api.pwa.manifest?start=rmsapp   the app manifest
"""

import hashlib
import json
import os
import re

import frappe
from werkzeug.wrappers import Response

PAGES = {
	"rmsapp": "POS G2Virtu",
	"waiterapp": "POS G2Virtu Waiter",
	"price_kiosk": "Price Checker",
}
SW_FILE = ("public", "js", "pwa", "posa_sw.js")


def _sw_source():
	path = frappe.get_app_path("posawesome", *SW_FILE)
	with open(path, encoding="utf-8") as f:
		src = f.read()
	version = hashlib.sha1((src + str(frappe.get_attr("posawesome.__version__"))).encode()).hexdigest()[:12]
	return src.replace("__VERSION__", version), version


@frappe.whitelist(allow_guest=True, methods=["GET"])
def service_worker():
	"""The service worker script. Its scope is the whole site, but it only acts on
	the POS pages, build files and two read-only desk calls (see the script)."""
	src, version = _sw_source()
	return Response(
		src,
		mimetype="application/javascript",
		headers={
			"Service-Worker-Allowed": "/",
			"Cache-Control": "no-cache, max-age=0",
			"X-POSA-PWA-Version": version,
		},
	)


def _company_name():
	try:
		return frappe.db.get_single_value("Website Settings", "app_name") or None
	except Exception:
		return None


PATH_RE = re.compile(r"^/desk/(?:[a-z0-9][a-z0-9_-]{0,60}/)?(rmsapp|waiterapp|price_kiosk)$")


@frappe.whitelist(allow_guest=True, methods=["GET"])
def manifest(start="rmsapp", path=None):
	start = start if start in PAGES else "rmsapp"
	name = PAGES[start]
	# v16 opens pages under their workspace (/desk/pos-g2virtu/rmsapp): start where it was installed
	m = PATH_RE.match(str(path or ""))
	start_url = path if m and m.group(1) == start else "/desk/" + start
	shop = _company_name()
	icons = "/assets/posawesome/images/pwa/"
	data = {
		"name": "%s - %s" % (name, shop) if shop else name,
		"short_name": "Price Check" if start == "price_kiosk" else ("Waiter" if start == "waiterapp" else "POS"),
		"id": "/desk/" + start,
		"start_url": start_url,
		"scope": "/",
		"display": "standalone",
		"display_override": ["window-controls-overlay", "standalone"],
		"orientation": "any",
		"background_color": "#ffffff",
		"theme_color": "#0F766E",
		"icons": [
			{"src": icons + "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
			{"src": icons + "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
			{"src": icons + "icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
		],
	}
	return Response(
		json.dumps(data),
		mimetype="application/manifest+json",
		headers={"Cache-Control": "no-cache, max-age=0"},
	)


def _pwa_profiles():
	if not frappe.db.has_column("POS Profile", "posa_pwa"):
		return []
	return frappe.get_all("POS Profile", filters={"disabled": 0, "posa_pwa": 1}, pluck="name")


def user_uses_pwa(user=None):
	"""True when the user sells / takes orders / runs the price checker with a profile
	that has the PWA ticked. Other desk users never get the service worker."""
	user = user or frappe.session.user
	if not user or user == "Guest":
		return False
	profiles = _pwa_profiles()
	if not profiles:
		return False
	roles = set(frappe.get_roles(user))
	if "Price Checker" in roles:
		return True
	if frappe.db.exists("POS Profile User", {"parent": ["in", profiles], "parenttype": "POS Profile", "user": user}):
		return True
	# a profile with no users listed is open to every POS user
	open_profiles = [p for p in profiles if not frappe.db.exists("POS Profile User", {"parent": p, "parenttype": "POS Profile"})]
	if open_profiles and roles & {"Sales User", "Sales Manager", "System Manager", "Accounts User", "Accounts Manager"}:
		return True
	if frappe.db.exists("DocType", "POS Profile Captain") and frappe.db.exists(
		"POS Profile Captain", {"parent": ["in", profiles], "parenttype": "POS Profile", "user": user}
	):
		return True
	return False


def boot_session(bootinfo):
	"""frappe.boot.posa_pwa: 1 = register the service worker on this device, 0 = remove it."""
	try:
		bootinfo.posa_pwa = 1 if user_uses_pwa() else 0
	except Exception:
		bootinfo.posa_pwa = 0
