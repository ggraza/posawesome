frappe.query_reports["POS Loss Prevention"] = {
	filters: [
		{ fieldname: "from_date", label: __("From Date"), fieldtype: "Date", default: frappe.datetime.add_days(frappe.datetime.get_today(), -6), reqd: 1 },
		{ fieldname: "to_date", label: __("To Date"), fieldtype: "Date", default: frappe.datetime.get_today(), reqd: 1 },
		{ fieldname: "pos_profile", label: __("POS Profile"), fieldtype: "Link", options: "POS Profile" },
		{ fieldname: "user", label: __("Cashier"), fieldtype: "Link", options: "User" },
		{ fieldname: "group_by", label: __("Per"), fieldtype: "Select", options: "Cashier\nShift", default: "Cashier" },
		{ fieldname: "void_limit", label: __("Look At Voids Above %"), fieldtype: "Float", default: 2 },
		{ fieldname: "return_limit", label: __("Look At Returns Above %"), fieldtype: "Float", default: 5 },
	],
	formatter(value, row, column, data, default_formatter) {
		value = default_formatter(value, row, column, data);
		if (column.fieldname === "flags" && data && data.flags) value = `<span style="color: var(--red-600); font-weight: 600">${value}</span>`;
		return value;
	},
};
