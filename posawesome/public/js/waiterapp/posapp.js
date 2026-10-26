import { createPosApp } from "../shared/create_pos_app";
import { getFullscreenRoot } from "../shared/fullscreen_mount";
import Home from "./Home.vue";
import { evntBus } from "./bus";

frappe.provide("frappe.WaiterApp");

frappe.WaiterApp.waiterapp = class {
	constructor({ parent } = {}) {
		this.parent = parent;
		this.make_body();
	}

	make_body() {
		this.el = getFullscreenRoot("waiterapp");
		if (this.el.__vue_app__) return; // already running (page re-opened)
		this.vue = createPosApp(Home, this.el, evntBus);
	}

	show() {
		getFullscreenRoot("waiterapp");
	}

	setup_header() {}
};
