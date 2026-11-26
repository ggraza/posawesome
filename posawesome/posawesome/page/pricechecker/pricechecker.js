// v16: this page's Vue 2 source was never part of the repository (it only existed
// in a prebuilt v14 bundle that cannot run on Frappe v16). Old links and
// workspace shortcuts are forwarded to the new price checker (price_kiosk).
frappe.pages["pricechecker"].on_page_load = function (wrapper) {
	frappe.ui.make_app_page({ parent: wrapper, title: __("Price Checker"), single_column: true });
	frappe.show_alert({ message: __("This page was replaced by the new Price Checker. Redirecting..."), indicator: "blue" });
	frappe.set_route("price_kiosk");
};
