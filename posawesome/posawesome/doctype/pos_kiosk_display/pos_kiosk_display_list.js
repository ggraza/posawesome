frappe.listview_settings["POS Kiosk Display"] = {
	add_fields: ["enabled", "valid_upto", "valid_from"],
	get_indicator(doc) {
		const today = frappe.datetime.get_today();
		if (!doc.enabled) return [__("Disabled"), "grey", "enabled,=,0"];
		if (doc.valid_upto && doc.valid_upto < today) return [__("Expired"), "red"];
		if (doc.valid_from && doc.valid_from > today) return [__("Scheduled"), "blue"];
		return [__("Running"), "green", "enabled,=,1"];
	},
};
