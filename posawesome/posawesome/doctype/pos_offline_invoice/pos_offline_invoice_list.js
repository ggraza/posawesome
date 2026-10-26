frappe.listview_settings["POS Offline Invoice"] = {
	add_fields: ["status", "sales_invoice"],
	get_indicator(doc) {
		const colors = { Queued: "blue", Processing: "orange", Synced: "green", Failed: "red", Duplicate: "gray" };
		return [__(doc.status), colors[doc.status] || "gray", "status,=," + doc.status];
	},
	onload(listview) {
		listview.page.add_inner_button(__("Retry Failed"), () => {
			frappe.call("posawesome.posawesome.api.offline.retry_offline_invoices").then((r) => {
				frappe.show_alert({ message: __("{0} invoice(s) queued", [r.message || 0]), indicator: "blue" });
				listview.refresh();
			});
		});
	},
};
