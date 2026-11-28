frappe.query_reports["POS Fast and Slow Movers"] = {
	filters: [
		{ fieldname: "pos_profile", label: __("POS Profile"), fieldtype: "Link", options: "POS Profile" },
		{ fieldname: "days", label: __("Sales Of The Last (Days)"), fieldtype: "Int", default: 30, reqd: 1 },
		{ fieldname: "to_date", label: __("Up To"), fieldtype: "Date", default: frappe.datetime.get_today() },
		{ fieldname: "item_group", label: __("Item Group"), fieldtype: "Link", options: "Item Group" },
		{ fieldname: "show", label: __("Show"), fieldtype: "Select", options: "All\nFast\nSlow\nDead", default: "All" },
		{ fieldname: "slow_days", label: __("Dead After (Days)"), fieldtype: "Int" },
	],
	formatter(value, row, column, data, default_formatter) {
		value = default_formatter(value, row, column, data);
		if (column.fieldname === "class" && data) {
			const color = { Fast: "green", Slow: "orange", Dead: "red" }[data.class];
			if (color) value = `<span class="indicator-pill ${color}">${value}</span>`;
		}
		return value;
	},
};
