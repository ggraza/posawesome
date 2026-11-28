# Copyright (c) 2026, Youssef Restom and contributors
# For license information, please see license.txt
"""Keep the POS G2Virtu workspace cards showing.

Frappe builds a workspace's cards in one pass and, if a single card link names
a DocType that is not on the site, it drops ALL cards (desk/desktop.py,
`handle_not_exist` around `get_links`). The shortcuts still show, so the page
looks half empty. This happens when a site lacks one of the linked doctypes,
reports or pages (another app not installed, a migrate that stopped part way,
a doctype deleted on the site).

  bench --site <site> execute posawesome.posawesome.workspace_links.check
      prints what is missing and how many cards each user would see (changes nothing)

  bench --site <site> execute posawesome.posawesome.workspace_links.repair
      removes the links whose target is missing (also runs after every migrate)
"""

import json

import frappe

WORKSPACES = ("POS G2Virtu",)
TARGET = {"DocType": "DocType", "Report": "Report", "Page": "Page", "Dashboard": "Dashboard", "Workspace": "Workspace"}


def _rows(workspace):
	return frappe.get_all(
		"Workspace Link",
		filters={"parent": workspace, "parenttype": "Workspace"},
		fields=["name", "idx", "type", "label", "link_type", "link_to", "link_count"],
		order_by="idx asc",
	)


def missing_links(workspace):
	"""Card links whose DocType / Report / Page is not on this site."""
	out = []
	for r in _rows(workspace):
		if r.type != "Link" or not r.link_to:
			continue
		target = TARGET.get(r.link_type)
		if target and not frappe.db.exists(target, r.link_to):
			out.append(r)
	return out


def _recount(workspace):
	"""Card Break link_count = the Link rows under it (used when the page is edited)."""
	rows = _rows(workspace)
	for i, r in enumerate(rows):
		if r.type != "Card Break":
			continue
		n = 0
		for nxt in rows[i + 1 :]:
			if nxt.type == "Card Break":
				break
			n += 1
		if (r.link_count or 0) != n:
			frappe.db.set_value("Workspace Link", r.name, "link_count", n, update_modified=False)


def repair(workspace=None):
	"""Remove card links whose target is missing; returns what was removed."""
	removed = []
	for ws in [workspace] if workspace else WORKSPACES:
		if not frappe.db.exists("Workspace", ws):
			continue
		gone = missing_links(ws)
		if not gone:
			continue
		frappe.db.delete("Workspace Link", {"name": ["in", [g.name for g in gone]]})
		_recount(ws)
		removed += ["%s: %s %s" % (ws, g.link_type, g.link_to) for g in gone]
	if removed:
		frappe.clear_cache()
		frappe.log_error(
			title="POS G2Virtu workspace: links removed",
			message="These card links pointed to nothing on this site and hid every card:\n" + "\n".join(removed),
		)
	return removed


def after_migrate():
	try:
		removed = repair()
		if removed:
			print("POS G2Virtu workspace: removed %d broken card link(s): %s" % (len(removed), "; ".join(removed)))
	except Exception:
		# never stop a migrate for this
		frappe.log_error(title="POS G2Virtu workspace check failed")


def check(workspace="POS G2Virtu", user=None):
	"""Print what the workspace would show. Changes nothing."""
	from frappe.desk.desktop import get_desktop_page

	if not frappe.db.exists("Workspace", workspace):
		print("Workspace %s is not on this site (run bench migrate)." % workspace)
		return
	rows = _rows(workspace)
	cards = [r.label for r in rows if r.type == "Card Break"]
	content = json.loads(frappe.db.get_value("Workspace", workspace, "content") or "[]")
	blocks = [b["data"].get("card_name") for b in content if b.get("type") == "card"]
	print("Card links in the database: %d rows, %d cards %s" % (len(rows), len(cards), cards))
	print("Card blocks on the page: %s" % blocks)
	not_in_links = [b for b in blocks if b not in cards]
	if not_in_links:
		print("Card blocks with no card of that name: %s" % not_in_links)
	gone = missing_links(workspace)
	for g in gone:
		print("MISSING on this site: %s %s (card link '%s') -> this alone hides every card" % (g.link_type, g.link_to, g.label))
	if not gone:
		print("No missing link targets.")
	users = [user] if user else ["Administrator"]
	for u in users:
		prev = frappe.session.user
		try:
			frappe.set_user(u)
			page = get_desktop_page(json.dumps({"name": workspace, "title": workspace, "public": 1}))
			items = (page.get("cards") or {}).get("items") or []
			print("%s would see %d card(s): %s" % (u, len(items), [c.get("label") for c in items]))
		finally:
			frappe.set_user(prev)
