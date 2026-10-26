{% include "posawesome/posawesome/page/waiterapp/onscan.js" %}
// Frappe / ERPNext v16: the POS bundle (Vue 3 + Vuetify 3) is loaded on demand.
frappe.pages["waiterapp"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: "POS Waiter",
		single_column: true,
	});
	wrapper.pos_page = page;

	posawesome_load_icon_font();
	frappe.dom.freeze(__("Loading POS..."));
	frappe
		.require("posawesome.bundle.js")
		.then(() => {
			wrapper.pos_app = new frappe.WaiterApp.waiterapp(page);
		})
		.catch((e) => {
			console.error(e);
			frappe.msgprint(__("Could not load the POS. Please run bench build and reload."));
		})
		.finally(() => frappe.dom.unfreeze());
};

frappe.pages["waiterapp"].on_page_show = function (wrapper) {
	if (wrapper.pos_app && wrapper.pos_app.show) wrapper.pos_app.show();
};

function posawesome_load_icon_font() {
	if (document.getElementById("posawesome-mdi-font")) return;
	const link = document.createElement("link");
	link.id = "posawesome-mdi-font";
	link.rel = "stylesheet";
	link.href = "/assets/posawesome/node_modules/@mdi/font/css/materialdesignicons.min.css";
	document.head.appendChild(link);
}
