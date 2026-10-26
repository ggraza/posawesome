# Copyright (c) 2026, Youssef Restom and contributors
# For license information, please see license.txt

# import frappe
import frappe
import json
from frappe.utils import flt, getdate
from frappe.model.document import Document

class ItemPriceTool(Document):
    @frappe.whitelist()
    def update_item_prices(self):
        changed_count = 0

        for row in self.items:
            if not row.item_price:
                continue

            db_values = frappe.db.get_value(
                "Item Price",
                row.item_price,
                ["price_list_rate", "valid_from", "valid_upto", "currency"],
                as_dict=True
            )
            if not db_values:
                continue

            update_dict = {}
            if flt(db_values.price_list_rate) != flt(row.price_list_rate):
                update_dict["price_list_rate"] = flt(row.price_list_rate)
            if getdate(db_values.valid_from) != getdate(row.valid_from):
                update_dict["valid_from"] = getdate(row.valid_from)
            if getdate(db_values.valid_upto) != getdate(row.valid_upto):
                update_dict["valid_upto"] = getdate(row.valid_upto)
            if (db_values.currency or "") != (row.currency or ""):
                update_dict["currency"] = row.currency

            if update_dict:
                frappe.db.set_value("Item Price", row.item_price, update_dict, update_modified=True)
                changed_count += 1

        frappe.db.commit()
        return f"{changed_count} Item Price record(s) updated successfully."

@frappe.whitelist()
def get_item_prices(price_list=None, brand=None, item_code=None, supplier=None, customer=None):
    filters = {}

    if price_list:
        filters["price_list"] = price_list

    if item_code:
        filters["item_code"] = item_code

    if supplier:
        filters["supplier"] = supplier

    if customer:
        filters["customer"] = customer

    data = frappe.get_all(
        "Item Price",
        filters=filters,
        fields=[
            "name as item_price",
            "item_code",
            "uom",
            "item_name",
            "brand",
            "item_description",
            "price_list",
            "supplier",
            "buying",
            "selling",
            "currency",
            "price_list_rate",
            "valid_from",
            "valid_upto",
            "reference"
        ]
    )

    return data


@frappe.whitelist()
def bulk_create_or_update_item_price(items):
    """
    Bulk insert or update Item Price records.
    Updates only fields that actually changed.
    """
    items = frappe.parse_json(items)

    def is_different(val1, val2):
        """Treat None and empty string as equal"""
        if val1 in (None, "") and val2 in (None, ""):
            return False
        return val1 != val2

    for row in items:
        row = frappe._dict(row)

        if not row.item_code or not row.price_list_rate:
            continue

        existing_name = row.get("item_price")

        if existing_name:
            try:
                doc = frappe.get_doc("Item Price", existing_name)
            except frappe.DoesNotExistError:
                doc = None
        else:
            doc = None

        if doc:
            changed = False
            for field in ["price_list_rate", "valid_from", "valid_upto", "currency", "selling", "buying"]:
                if is_different(getattr(doc, field), row.get(field)):
                    setattr(doc, field, row.get(field))
                    changed = True

            if changed:
                doc.save()
        else:
            # Create new Item Price
            doc = frappe.new_doc("Item Price")
            doc.update({
                "item_code": row.item_code,
                "price_list": row.price_list,
                "uom": row.uom,
                "price_list_rate": row.price_list_rate,
                "currency": row.currency,
                "valid_from": row.valid_from,
                "valid_upto": row.valid_upto,
                "customer": row.get("customer"),
                "supplier": row.get("supplier"),
                "batch_no": row.get("batch_no"),
                "selling": row.selling or 1,
                "buying": row.buying or 0,
            })
            doc.insert()

    frappe.db.commit()
    return "Success"