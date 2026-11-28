# /apps/posawesome/posawesome/events/item_price_sync.py

import frappe
from frappe.utils import flt, nowdate


SELLING_PRICE_LIST = "Standard Selling"
BUYING_PRICE_LIST = "Standard Buying"


# =========================================================
# ITEM -> ITEM PRICE
# =========================================================

def sync_item_prices(doc, method=None):

    if getattr(doc.flags, "ignore_item_price_sync", False):
        return

    existing_prices = frappe.get_all(
        "Item Price",
        filters={
            "item_code": doc.item_code
        },
        fields=[
            "name",
            "price_list",
            "uom"
        ]
    )

    existing_map = {
        (d.price_list, d.uom): d.name
        for d in existing_prices
    }

    valid_keys = set()

    for row in doc.uoms:

        # =========================================
        # SELLING
        # =========================================

        selling_rate = flt(
            getattr(row, "standard_selling", 0)
        )

        selling_key = (
            SELLING_PRICE_LIST,
            row.uom
        )

        if selling_rate > 0:

            valid_keys.add(selling_key)

            create_or_update_price(
                item_code=doc.item_code,
                item_name=doc.item_name,
                price_list=SELLING_PRICE_LIST,
                uom=row.uom,
                rate=selling_rate,
                existing_name=existing_map.get(
                    selling_key
                )
            )

        # =========================================
        # BUYING
        # =========================================

        buying_rate = flt(
            getattr(row, "standard_buying", 0)
        )

        buying_key = (
            BUYING_PRICE_LIST,
            row.uom
        )

        if buying_rate > 0:

            valid_keys.add(buying_key)

            create_or_update_price(
                item_code=doc.item_code,
                item_name=doc.item_name,
                price_list=BUYING_PRICE_LIST,
                uom=row.uom,
                rate=buying_rate,
                existing_name=existing_map.get(
                    buying_key
                )
            )

    # =========================================
    # DELETE REMOVED PRICES
    # =========================================

    for key, price_name in existing_map.items():

        if key not in valid_keys:

            if key[0] in [
                SELLING_PRICE_LIST,
                BUYING_PRICE_LIST
            ]:

                frappe.delete_doc(
                    "Item Price",
                    price_name,
                    force=1,
                    ignore_permissions=True
                )


# =========================================================
# CREATE / UPDATE ITEM PRICE
# =========================================================

def create_or_update_price(
    item_code,
    item_name,
    price_list,
    uom,
    rate,
    existing_name=None
):

    if existing_name:

        doc = frappe.get_doc(
            "Item Price",
            existing_name
        )

        changed = False

        if flt(doc.price_list_rate) != flt(rate):
            doc.price_list_rate = rate
            changed = True

        if doc.uom != uom:
            doc.uom = uom
            changed = True

        if changed:

            doc.flags.ignore_item_price_reverse_sync = True
            doc.flags.ignore_permissions = True

            doc.save()

    else:

        doc = frappe.new_doc("Item Price")

        doc.item_code = item_code
        doc.item_name = item_name
        doc.price_list = price_list
        doc.uom = uom
        doc.price_list_rate = rate
        doc.currency = frappe.db.get_single_value(
            "Global Defaults",
            "default_currency"
        )

        if price_list == SELLING_PRICE_LIST:
            doc.selling = 1

        if price_list == BUYING_PRICE_LIST:
            doc.buying = 1

        doc.valid_from = nowdate()

        doc.flags.ignore_item_price_reverse_sync = True
        doc.flags.ignore_permissions = True

        doc.insert()


# =========================================================
# ITEM DELETE
# =========================================================

def delete_item_prices(doc, method=None):

    prices = frappe.get_all(
        "Item Price",
        filters={
            "item_code": doc.item_code
        },
        pluck="name"
    )

    for d in prices:

        frappe.delete_doc(
            "Item Price",
            d,
            force=1,
            ignore_permissions=True
        )