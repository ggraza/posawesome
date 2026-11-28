# /apps/posawesome/posawesome/events/item_price_reverse_sync.py

import frappe
from frappe.utils import flt


SELLING_PRICE_LIST = "Standard Selling"
BUYING_PRICE_LIST = "Standard Buying"


# =========================================================
# ITEM PRICE -> ITEM
# =========================================================

def sync_item_uom_rates(doc, method=None):

    if getattr(
        doc.flags,
        "ignore_item_price_reverse_sync",
        False
    ):
        return

    if doc.price_list not in [
        SELLING_PRICE_LIST,
        BUYING_PRICE_LIST
    ]:
        return

    if not doc.item_code:
        return

    item = frappe.get_doc(
        "Item",
        doc.item_code
    )

    changed = False

    for row in item.uoms:

        if row.uom != doc.uom:
            continue

        selling_rate = get_latest_price(
            item_code=doc.item_code,
            uom=doc.uom,
            price_list=SELLING_PRICE_LIST
        )

        buying_rate = get_latest_price(
            item_code=doc.item_code,
            uom=doc.uom,
            price_list=BUYING_PRICE_LIST
        )

        # =====================================
        # UPDATE ITEM UOM ROW
        # =====================================

        if flt(row.standard_selling) != flt(
            selling_rate
        ):

            row.standard_selling = selling_rate
            changed = True

        if flt(row.standard_buying) != flt(
            buying_rate
        ):

            row.standard_buying = buying_rate
            changed = True

    if changed:

        item.flags.ignore_item_price_sync = True
        item.flags.ignore_permissions = True
        item.flags.ignore_validate_update_after_submit = True

        item.save()


# =========================================================
# GET LATEST VALID PRICE
# =========================================================

def get_latest_price(
    item_code,
    uom,
    price_list
):

    price = frappe.get_all(
        "Item Price",
        filters={
            "item_code": item_code,
            "uom": uom,
            "price_list": price_list
        },
        fields=[
            "price_list_rate"
        ],
        order_by="valid_from desc",
        #limit=1
        limit_page_length=1
    )

    if price:
        return flt(
            price[0].price_list_rate
        )

    return 0