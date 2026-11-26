// Customer price checker screen. Code: public/js/offline/price_kiosk.js
// (bundle price_kiosk.bundle.js), loaded on demand.
frappe.pages["price_kiosk"].on_page_load = function (wrapper) {
	frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Price Checker"),
		single_column: true,
		hide_sidebar: true,
		hide_dock: true,
	});
	frappe.require("price_kiosk.bundle.js").then(() => {
		wrapper.price_kiosk = new frappe.PosaPriceKiosk(wrapper);
	});
};

frappe.pages["price_kiosk"].on_page_show = function (wrapper) {
	if (wrapper.price_kiosk && wrapper.price_kiosk.show) wrapper.price_kiosk.show();
};
