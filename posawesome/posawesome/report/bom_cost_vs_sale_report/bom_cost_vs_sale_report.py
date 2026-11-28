# Copyright (c) 2025, Youssef Restom and contributors
# For license information, please see license.txt

import frappe

def execute(filters=None):
    columns = [
        {"label": "Item Group", "fieldname": "category", "fieldtype": "Link", "options": "Item Group", "width": 150},
        {"label": "BOM Name", "fieldname": "bom_name", "fieldtype": "Link", "options": "BOM", "width": 150},
        {"label": "Item Name", "fieldname": "item_name", "fieldtype": "Data", "width": 300},
        {"label": "Sale Price", "fieldname": "sale_price", "fieldtype": "Currency", "width": 150},
        {"label": "Cost Price", "fieldname": "cost_price", "fieldtype": "Currency", "width": 150},
        {"label": "%AGE", "fieldname": "percentage", "fieldtype": "Percent", "width": 110},
    ]

    data = []

    # Default filters
    report_date = filters.get("date") or frappe.utils.today()
    price_list = filters.get("price_list") or "Standard Selling"

    # Handle MultiSelect for Item Group
    item_groups = []
    if filters.get("item_group"):
        if isinstance(filters.get("item_group"), list):
            item_groups = filters.get("item_group")
        elif isinstance(filters.get("item_group"), str):
            # fallback: handle CSV string
            item_groups = [c.strip() for c in filters.get("item_group").split(",") if c.strip()]

    # Fetch all active + default BOMs with custom cost field
    boms = frappe.get_all(
        "BOM",
        filters={"is_active": 1, "is_default": 1},
        fields=["name", "item", "item_name", "custom_average_item_cost"]
    )

    for bom in boms:
        # Get Item Group (category)
        category = frappe.db.get_value("Item", bom.item, "item_group")

        # Apply multi-group filter
        if item_groups and category not in item_groups:
            continue

        # Get latest Sale Price till given date
        sale_price = frappe.db.sql("""
            SELECT price_list_rate 
            FROM `tabItem Price`
            WHERE item_code = %s
              AND price_list = %s
              AND (valid_from IS NULL OR valid_from <= %s)
            ORDER BY valid_from DESC, creation DESC
            LIMIT 1
        """, (bom.item, price_list, report_date))

        sale_price = sale_price[0][0] if sale_price else 0
        cost_price = bom.custom_average_item_cost or 0

        percentage = (cost_price / sale_price * 100) if sale_price else 0

        data.append({
            "category": category,
            "bom_name": bom.name,
            "item_name": bom.item_name,
            "sale_price": sale_price,
            "cost_price": cost_price,
            "percentage": round(percentage, 2)
        })

    # Totals Row
    if data:
        total_sale = sum(d["sale_price"] for d in data)
        total_cost = sum(d["cost_price"] for d in data)
        total_perc = (total_cost / total_sale * 100) if total_sale else 0

        data.append({
            "category": "Total",
            "bom_name": "",
            "item_name": "",
            "sale_price": total_sale,
            "cost_price": total_cost,
            "percentage": round(total_perc, 2)
        })

    return columns, data
