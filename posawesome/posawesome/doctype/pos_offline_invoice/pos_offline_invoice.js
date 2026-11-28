// Copyright (c) 2026, G2Virtu and contributors
frappe.ui.form.on("POS Offline Invoice", {
	refresh(frm) {
		if (frm.doc.status === "Failed" || frm.doc.status === "Queued") {
			frm.add_custom_button(__("Retry"), () => {
				frappe
					.call("posawesome.posawesome.doctype.pos_offline_invoice.pos_offline_invoice.retry", {
						name: frm.doc.name,
					})
					.then(() => {
						frappe.show_alert({ message: __("Queued for processing"), indicator: "blue" });
						setTimeout(() => frm.reload_doc(), 3000);
					});
			});
		}
		if (frm.doc.sales_invoice) {
			frm.add_custom_button(__("Open Sales Invoice"), () =>
				frappe.set_route("Form", "Sales Invoice", frm.doc.sales_invoice)
			);
		}
	},
});
