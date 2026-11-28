#/home/frappe/frappe-bench/apps/posawesome/posawesome/posawesome/api/stock_entry.py

import frappe
import json
from frappe import _
from frappe.utils import nowdate, flt, cstr, getdate, add_days
import requests
from frappe import publish_realtime


@frappe.whitelist()
def create_manufacture_stock_entry(doc, method=None):
    """
    Auto Create Manufacture Stock Entry on Sales Invoice Submit.

    Creates one Manufacture Stock Entry for each Sales Invoice item
    that belongs to a Kitchen Production Unit.
    """

    # ------------------------------------------------------------
    # Load Kitchen Production Unit Mapping
    # ------------------------------------------------------------

    production_units = frappe.get_all(
        "Kitchen Production Unit",
        filters={
            "allow_quick_production": 1
        },
        fields=[
            "name",
            "apply_on",
            "from_warehouse",
            "to_warehouse"
        ]
    )

    item_code_map = {}
    item_group_map = {}

    for unit in production_units:

        # Item Codes
        item_details = frappe.get_all(
            "Kitchen Item Detail",
            filters={"parent": unit.name},
            fields=["item_code"]
        )

        for d in item_details:
            if d.item_code:
                item_code_map[d.item_code] = unit

        # Item Groups
        item_groups = frappe.get_all(
            "Kitchen Item Groups",
            filters={"parent": unit.name},
            fields=["item_group"]
        )

        for d in item_groups:
            if d.item_group:
                item_group_map[d.item_group] = unit

    # ------------------------------------------------------------
    # Create Stock Entry for each Sales Invoice Item
    # ------------------------------------------------------------

    for row in doc.items:

        # Skip if already created for this row
        if frappe.db.exists(
            "Stock Entry",
            {
                "custom_sales_invoice": doc.name,
                "custom_posa_row_id": row.posa_row_id,
                "docstatus": ["!=", 2]
            }
        ):
            continue

        item_group = frappe.db.get_value(
            "Item",
            row.item_code,
            "item_group"
        )

        # Kitchen Unit
        unit = (
            item_code_map.get(row.item_code)
            or item_group_map.get(item_group)
        )

        if not unit:
            continue

        # --------------------------------------------------------
        # Default Active BOM
        # --------------------------------------------------------

        bom = frappe.db.get_value(
            "BOM",
            {
                "item": row.item_code,
                "is_active": 1,
                "is_default": 1,
                "docstatus": 1
            },
            "name"
        )

        if not bom:
            frappe.throw(
                _("No Active Default BOM found for Item <b>{0}</b>").format(
                    row.item_code
                )
            )

        # --------------------------------------------------------
        # Create Stock Entry
        # --------------------------------------------------------

        se = frappe.new_doc("Stock Entry")

        se.stock_entry_type = "Manufacture"
        se.purpose = "Manufacture"

        se.company = doc.company
        se.posting_date = doc.posting_date
        se.set_posting_time = 1

        if hasattr(doc, "posting_time"):
            se.posting_time = doc.posting_time

        se.from_bom = 1
        se.bom_no = bom
        se.fg_completed_qty = flt(row.qty)

        se.from_warehouse = unit["from_warehouse"]
        se.to_warehouse = unit["to_warehouse"]

        # Custom Fields
        se.custom_sales_invoice = doc.name

        # Generate Items From BOM
        se.get_items()

        # --------------------------------------------------------
        # Update Warehouses
        # --------------------------------------------------------

        for d in se.items:

            if d.is_finished_item:

                d.t_warehouse = unit["to_warehouse"]

                # Your custom field on Stock Entry Detail
                d.posa_row_id = row.posa_row_id

            else:

                d.s_warehouse = unit["from_warehouse"]

        se.insert(ignore_permissions=True)
        se.submit()

def update_quick_production_on_se_cancel(doc, method=None):
    """Forward to the optional quick_production module when it is installed.

    The v14 hook pointed straight at posawesome.quick_production..., which is not
    part of this app; on v16 that raised ModuleNotFoundError on every Stock Entry
    cancel/delete. Keep the behaviour when the module exists, otherwise do nothing.
    """
    try:
        from posawesome.quick_production.doctype.quick_production.quick_production import (
            update_quick_production_on_se_cancel as _update,
        )
    except ImportError:
        return
    return _update(doc, method)
