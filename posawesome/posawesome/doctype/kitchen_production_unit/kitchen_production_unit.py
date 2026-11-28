# Copyright (c) 2025, Youssef Restom and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
#from frappe.desk.search import get_match_cond

class KitchenProductionUnit(Document):
	pass


@frappe.whitelist()
@frappe.validate_and_sanitize_search_inputs
def get_available_item_groups(doctype, txt, searchfield, start, page_len, filters):

    assigned = frappe.db.sql("""
        SELECT DISTINCT kig.item_group
        FROM `tabKitchen Item Groups` kig
        INNER JOIN `tabKitchen Production Unit` kpu
            ON kpu.name = kig.parent
        WHERE
            kpu.company = %(company)s
            AND kpu.pos_profile = %(pos_profile)s
            AND kpu.name != %(current_doc)s
    """, filters, as_dict=True)

    selected = filters.get("selected") or []
    if isinstance(selected, str):
        selected = frappe.parse_json(selected)

    exclude = {d.item_group for d in assigned}
    exclude.update(selected)

    conditions = [
        "is_group = 0",
        f"{searchfield} LIKE %(txt)s"
    ]

    values = {
        "txt": f"%{txt}%",
        "start": start,
        "page_len": page_len
    }

    if exclude:
        conditions.append("name NOT IN %(exclude)s")
        values["exclude"] = tuple(exclude)

    return frappe.db.sql(f"""
        SELECT name
        FROM `tabItem Group`
        WHERE {' AND '.join(conditions)}
        ORDER BY name
        LIMIT %(start)s, %(page_len)s
    """, values)


@frappe.whitelist()
@frappe.validate_and_sanitize_search_inputs
def get_available_items(doctype, txt, searchfield, start, page_len, filters):

    assigned = frappe.db.sql("""
        SELECT DISTINCT kid.item_code
        FROM `tabKitchen Item Detail` kid
        INNER JOIN `tabKitchen Production Unit` kpu
            ON kpu.name = kid.parent
        WHERE
            kpu.company = %(company)s
            AND kpu.pos_profile = %(pos_profile)s
            AND kpu.name != %(current_doc)s
    """, filters, as_dict=True)

    selected = filters.get("selected") or []
    if isinstance(selected, str):
        selected = frappe.parse_json(selected)

    exclude = {d.item_code for d in assigned}
    exclude.update(selected)

    conditions = ["item.disabled = 0"]

    values = {
        "txt": f"%{txt}%",
        "start": start,
        "page_len": page_len,
    }

    if exclude:
        conditions.append("item.name NOT IN %(exclude)s")
        values["exclude"] = tuple(exclude)

    return frappe.db.sql(f"""
        SELECT
            item.name,
            item.item_name,
            item.description,
            item.item_group
        FROM `tabItem` item
        WHERE
            {' AND '.join(conditions)}
            AND (
                item.name LIKE %(txt)s
                OR item.item_name LIKE %(txt)s
                OR IFNULL(item.description, '') LIKE %(txt)s
                OR item.item_group LIKE %(txt)s
                OR IFNULL(item.customer_code, '') LIKE %(txt)s
            )
        ORDER BY
            item.name
        LIMIT %(start)s, %(page_len)s
    """, values)