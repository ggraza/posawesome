// Screens not heard from for 15 minutes are shown as Not Reporting.
frappe.listview_settings["POS Kiosk Device"] = {
	add_fields: ["last_seen", "network"],
	get_indicator(doc) {
		const age = doc.last_seen ? (Date.now() - frappe.datetime.str_to_obj(doc.last_seen).getTime()) / 60000 : Infinity;
		if (age > 15) return [__("Not Reporting"), "red"];
		if (doc.network === "Offline") return [__("Running Offline"), "orange", "network,=,Offline"];
		return [__("Live"), "green", "network,=,Online"];
	},
};
