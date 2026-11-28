// Copyright (c) 2025, Youssef Restom and contributors
// For license information, please see license.txt
/* eslint-disable */

// frappe.query_reports["BOM Cost vs Sale Report"] = {
// 	"filters": [
// 
// 	]
// };
// 
frappe.query_reports["BOM Cost vs Sale Report"] = {
    "filters": [
        {
            "fieldname": "date",
            "label": __("Date"),
            "fieldtype": "Date",
            "default": frappe.datetime.get_today()
        },
        {
            "fieldname": "price_list",
            "label": __("Price List"),
            "fieldtype": "Link",
            "options": "Price List",
            "default": "Standard Selling"
        },
        {
            "fieldname": "item_group",
            "label": __("Item Group"),
            "fieldtype": "MultiSelectList",
            "options": "Item Group",
            get_data: function(txt) {
                return frappe.db.get_link_options("Item Group", txt);
            }
        }
    ]
};
