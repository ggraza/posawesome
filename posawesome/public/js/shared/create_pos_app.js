// Shared Vue 3 + Vuetify 3 bootstrap for the POS apps (Frappe / ERPNext v16).
import { createApp } from "vue";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import { aliases, mdi } from "vuetify/iconsets/mdi";
import "vuetify/styles";
import "./pos_compat.css";
import PosDatePicker from "./components/PosDatePicker.vue";
import OfflineStatus from "./components/OfflineStatus.vue";

export const POS_THEME = {
	dark: false,
	colors: {
		background: "#FFFFFF",
		primary: "#0097A7",
		secondary: "#00BCD4",
		accent: "#9575CD",
		success: "#66BB6A",
		info: "#2196F3",
		warning: "#FF9800",
		error: "#E86674",
		orange: "#E65100",
		golden: "#A68C59",
		badge: "#F5528C",
		customPrimary: "#085294",
	},
};

let vuetify;

export function getVuetify() {
	if (vuetify) return vuetify;
	const lang = (window.frappe && frappe.boot && frappe.boot.lang) || "en";
	const rtl = !!(window.frappe && frappe.utils && frappe.utils.is_rtl && frappe.utils.is_rtl());
	vuetify = createVuetify({
		components,
		directives,
		icons: { defaultSet: "mdi", aliases, sets: { mdi } },
		locale: { locale: lang, fallback: "en", rtl: { [lang]: rtl } },
		theme: { defaultTheme: "light", themes: { light: POS_THEME } },
		// Vuetify 2 look & feel defaults so the existing layouts keep their density
		defaults: {
			VTextField: { variant: "underlined", color: "primary" },
			VTextarea: { variant: "underlined", color: "primary" },
			VSelect: { variant: "underlined", color: "primary" },
			VAutocomplete: { variant: "underlined", color: "primary" },
			VCombobox: { variant: "underlined", color: "primary" },
			VCheckbox: { color: "primary" },
			VSwitch: { color: "primary", inset: false },
			VDataTable: { hover: true },
		},
	});
	return vuetify;
}

// Globals that Vue 2 templates reached through `with(this)` but Vue 3 templates
// cannot (Vue 3 only exposes a small whitelist of globals to template expressions).
function installTemplateGlobals(app) {
	const gp = app.config.globalProperties;
	const passthrough = [
		"frappe", "__", "flt", "cint", "cstr", "format_currency", "format_number", "get_currency_symbol",
		"get_number_format", "moment", "$", "jQuery", "localStorage", "sessionStorage", "navigator",
		"location", "window", "document", "console", "setTimeout", "clearTimeout", "onScan",
	];
	for (const key of passthrough) {
		if (key in gp) continue;
		Object.defineProperty(gp, key, {
			get: () => window[key],
			configurable: true,
			enumerable: false,
		});
	}
	// Vue 2 reactivity helpers still used by the components
	gp.$set = (target, key, value) => {
		if (Array.isArray(target) && typeof key === "number") target.splice(key, 1, value);
		else target[key] = value;
		return value;
	};
	gp.$delete = (target, key) => {
		if (Array.isArray(target) && typeof key === "number") target.splice(key, 1);
		else delete target[key];
	};
}

export function createPosApp(RootComponent, el, bus) {
	const app = createApp(RootComponent);
	app.use(getVuetify());
	installTemplateGlobals(app);
	app.component("PosDatePicker", PosDatePicker);
	app.component("OfflineStatus", OfflineStatus);
	// templates used `$root.$emit(...)` as an event bus; Vue 3 dropped instance events
	app.config.globalProperties.$evntBus = bus;
	app.config.errorHandler = (err, instance, info) => {
		console.error(`[posawesome] ${info}:`, err);
	};
	app.mount(el);
	return app;
}
