frappe.query_reports["Shelf Label Check"] = {
	filters: [
		{ fieldname: "price_list", label: __("Price List"), fieldtype: "Link", options: "Price List" },
		{ fieldname: "item_group", label: __("Item Group"), fieldtype: "Link", options: "Item Group" },
		{ fieldname: "show", label: __("Show"), fieldtype: "Select", options: "Wrong or Missing\nWrong Price\nNever Printed\nAll", default: "Wrong or Missing" },
	],
};
