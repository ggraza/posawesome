// Supermarket shelf-edge labels: "Print Shelf Label" on Item and Item Price.
// Shown only when a POS Profile has Supermarket > Shelf-Edge Labels on.
(function () {
	let enabled = null;
	function check() {
		if (enabled !== null) return Promise.resolve(enabled);
		return frappe
			.call({ method: "posawesome.posawesome.api.shelf_labels.labels_enabled", freeze: false })
			.then((r) => (enabled = !!(r && r.message)))
			.catch(() => (enabled = false));
	}
	function add(frm, itemCode, priceList) {
		if (frm.is_new() || !itemCode) return;
		check().then((on) => {
			if (!on) return;
			frm.add_custom_button(__("Print Shelf Label"), () => {
				frappe
					.call({
						method: "posawesome.posawesome.api.shelf_labels.add_items",
						args: { item_codes: itemCode, price_list: priceList || null },
					})
					.then(() => frappe.set_route("shelf_labels"));
			});
		});
	}
	frappe.ui.form.on("Item", { refresh: (frm) => add(frm, frm.doc.name) });
	frappe.ui.form.on("Item Price", { refresh: (frm) => add(frm, frm.doc.item_code, frm.doc.price_list) });
})();
