// Fine dining for the POS invoice components (retail / RMS POS and waiter app).
//
// Every feature is switched on per POS Profile (Restaurant and KDS > Fine
// Dining). With "Enable Fine Dining" off, `fd_on` is false and none of this
// changes what the POS does: the hooks below return straight away.
//
// The host component provides: items, pos_profile, invoice_doc, allItems,
// get_new_item(), update_item_detail(), update_invoice(), get_invoice_doc(),
// selcted_service_table, and optionally service_table (the tables list),
// current_sale_id() and fd_is_offline().
import * as L from "./logic.js";

const API = "posawesome.posawesome.api.fine_dining.";

function call(method, args) {
	return new Promise((resolve, reject) => {
		frappe.call({
			method: API + method,
			args,
			callback: (r) => resolve(r.message),
			error: (e) => reject(e),
		});
	});
}

// the server's message of a failed call, as text
export function errorText(e) {
	try {
		const msgs = JSON.parse((e && e.responseJSON && e.responseJSON._server_messages) || "[]");
		const m = msgs.length ? JSON.parse(msgs[msgs.length - 1]) : null;
		if (m && m.message) return String(m.message).replace(/<[^>]+>/g, "");
	} catch (x) {
		/* fall through */
	}
	return (e && (e.message || e.exc_type)) || __("The request failed");
}

export default {
	data() {
		return {
			fd: {
				setup: null,
				covers: 0,
				seat: 1,
				sent: {},
				busy: false,
				tip: 0,
				allergies: "",
				guest: null,
				_seating: null,
				eighty_six: [],
				item_allergens: {},
				row_alerts: {},
			},
		};
	},
	computed: {
		fd_s() {
			return (this.fd.setup && this.fd.setup.settings) || {};
		},
		fd_on() {
			const ret = this.invoiceType === "Return" || (this.invoice_doc && this.invoice_doc.is_return);
			return !!Number(this.fd_s.enabled) && !ret;
		},
		// the switches as the components read them (all off when fine dining is off)
		// Guests, seats, courses and pre-bill are for an order at a table;
		// options, void and comp apply to every order.
		fd_dine() {
			return this.fd_on && !!this.selcted_service_table;
		},
		fd_floor() {
			return (this.fd_on && this.fd.setup && this.fd.setup.floor) || {};
		},
		fd_flags() {
			const out = {};
			for (const k of ["modifiers", "void_control", "void_approval"]) out[k] = this.fd_feature(k);
			for (const k of ["covers", "covers_required", "seats", "courses", "prebill"]) out[k] = this.fd_dine && this.fd_feature(k);
			// phase 3
			const k = (this.fd_on && this.fd.setup && this.fd.setup.kitchen) || {};
			out.allergens = !!Number(k.allergens);
			out.eighty_six = !!Number(k.eighty_six);
			// phase 2
			out.floor_plan = !!Number(this.fd_floor.floor_plan);
			out.tips = !!Number(this.fd_floor.tips);
			out.split_bill = this.fd_dine && !!Number(this.fd_floor.split_bill);
			out.service_charge =
				this.fd_dine &&
				!!Number(this.fd_floor.service_charge) &&
				(Number(this.fd.covers) || 0) >= (Number(this.fd_floor.service_charge_min_covers) || 0)
					? Number(this.fd_floor.service_charge_rate) || 0
					: 0;
			return out;
		},
		fd_bar_visible() {
			const f = this.fd_flags;
			return this.fd_on && !!(f.covers || f.seats || f.courses || f.prebill || f.floor_plan || f.tips || f.split_bill || f.allergens || f.eighty_six || this.fd.guest);
		},
		fd_courses() {
			return (this.fd.setup && this.fd.setup.courses) || [];
		},
		fd_groups() {
			return (this.fd.setup && this.fd.setup.modifier_groups) || [];
		},
		fd_course_summary() {
			return this.fd_flags.courses ? L.courseSummary(this.items, this.fd_courses) : [];
		},
		fd_table_seats() {
			const t = (this.service_table || []).find((x) => x.name === this.selcted_service_table);
			return (t && t.no_of_seats) || 0;
		},
		fd_seat_count() {
			return L.seatCount(this.fd.covers, this.items, this.fd_table_seats);
		},
	},
	watch: {
		"pos_profile.name": {
			handler(name) {
				if (name) this.fd_load();
			},
			immediate: true,
		},
		customer(c) {
			this.fd_load_guest(c);
		},
		invoice_doc(doc, old) {
			if (!doc) {
				this.fd.tip = 0;
				this.fd.allergies = "";
				this.fd.row_alerts = {};
				this.fd.covers = 0;
				this.fd.seat = 1;
				this.fd.sent = {};
				return;
			}
			if (doc.posa_covers != null) this.fd.covers = Number(doc.posa_covers) || 0;
			if (doc.posa_tip_amount != null) this.fd.tip = Number(doc.posa_tip_amount) || 0;
			if (doc.posa_allergies != null) this.fd.allergies = doc.posa_allergies || "";
			if (doc.name && (!old || old.name !== doc.name)) this.fd_refresh_sent();
		},
	},
	mounted() {
		this._fd_86 = (d) => this.fd_on_86_changed(d);
		if (window.frappe && frappe.realtime && frappe.realtime.on) frappe.realtime.on("posa_86_changed", this._fd_86);
	},
	beforeUnmount() {
		if (window.frappe && frappe.realtime && frappe.realtime.off && this._fd_86) frappe.realtime.off("posa_86_changed", this._fd_86);
	},
	methods: {
		fd_feature(name) {
			return this.fd_on && !!Number(this.fd_s[name]);
		},
		fd_msg(text, color = "error") {
			const bus = this.$evntBus;
			if (bus && bus.$emit) bus.$emit("show_mesage", { text, color });
			else frappe.show_alert({ message: text, indicator: color === "error" ? "red" : "green" });
		},
		fd_offline() {
			return typeof this.fd_is_offline === "function" ? !!this.fd_is_offline() : false;
		},
		async fd_load() {
			try {
				this.fd.setup = await call("get_setup", { pos_profile: this.pos_profile.name });
				this.fd.eighty_six = (this.fd.setup && this.fd.setup.eighty_six) || [];
			} catch (e) {
				this.fd.setup = null; // not migrated yet, or no access: POS as before
			}
		},
		async fd_refresh_sent() {
			const name = this.invoice_doc && this.invoice_doc.name;
			if (!this.fd_on || !name || String(name).startsWith("OFL-") || this.fd_offline()) return;
			if (!this.fd_feature("void_control") && !this.fd_feature("courses")) return;
			try {
				const sent = await call("get_sent", { invoice: name });
				if (this.invoice_doc && this.invoice_doc.name === name) this.fd.sent = sent || {};
			} catch (e) {
				/* keep what we had */
			}
		},
		fd_sent_qty(row) {
			const k = L.rowKey(row);
			if (this.fd.sent && k in this.fd.sent) return Number(this.fd.sent[k]) || 0;
			return Number(row.posa_kot_qty) || 0;
		},
		fd_sale_id() {
			if (typeof this.current_sale_id === "function") return this.current_sale_id();
			return (this.invoice_doc && this.invoice_doc.posa_offline_id) || null;
		},

		// ---------------------------------------------------------------- cart rows
		// Fields of a cart row that go to the server (get_invoice_items).
		fd_item_fields(item) {
			return {
				posa_seat: Number(item.posa_seat) || 0,
				posa_course: item.posa_course || null,
				posa_course_status: item.posa_course_status || null,
				posa_modifiers: item.posa_modifiers || null,
				posa_parent_row_id: item.posa_parent_row_id || null,
				posa_comp: Number(item.posa_comp) ? 1 : 0,
				posa_comp_reason: item.posa_comp_reason || null,
			};
		},
		// May scanning `item` again add to the row `el`?
		fd_can_merge(el, item) {
			return L.canMerge(el, item, {
				on: this.fd_on,
				seats: this.fd_flags.seats,
				seat: this.fd.seat,
				courses: this.fd_flags.courses,
				modifiers: this.fd_feature("modifiers"),
				groups: this.fd_groups,
				sent: this.fd.sent,
			});
		},
		// A new row was added to the cart: seat, course, then modifiers.
		fd_new_row(row) {
			if (!this.fd_on || !row || row.posa_parent_row_id) return;
			if (this.fd_flags.seats && !row.posa_seat) row.posa_seat = this.fd.seat || 0;
			if (this.fd_flags.courses && !row.posa_course) {
				const c = L.defaultCourse(row, this.fd_courses);
				if (c) {
					row.posa_course = c.name;
					row.posa_course_status = Number(c.hold_until_fired) ? "Hold" : "Fired";
				}
			}
			if (this.fd_flags.allergens && this.fd.allergies) this.fd_check_allergens(row);
			if (this.fd_feature("modifiers") && L.groupsFor(row, this.fd_groups).length) {
				this.$nextTick(() => this.fd_edit_modifiers(row, true));
			}
		},
		async fd_edit_modifiers(row, isNew = false) {
			const groups = L.groupsFor(row, this.fd_groups);
			if (!groups.length || !this.$refs.fdDialogs) return;
			if (!isNew && this.fd_sent_qty(row) > 0) {
				this.fd_msg(__("{0} is already with the kitchen; void it and add it again to change its options.", [row.item_name]), "warning");
				return;
			}
			const res = await this.$refs.fdDialogs.pickModifiers({
				item: row,
				groups,
				selection: isNew ? L.initialSelection(groups) : L.initialSelection(groups, row.posa_modifiers),
				addonName: (code) => this.fd_item_name(code),
			});
			if (!res) {
				// a required choice was not made: the item is not added
				if (isNew && groups.some((g) => Number(g.required) || Number(g.min_select) > 0)) this.fd_remove_row(row);
				return;
			}
			this.fd_apply_modifiers(row, groups, res.selection);
		},
		fd_has_modifiers(row) {
			return this.fd_feature("modifiers") && L.groupsFor(row, this.fd_groups).length > 0;
		},
		fd_item_name(code) {
			const it = (this.allItems || []).find((i) => i.item_code === code);
			return it ? it.item_name : code;
		},
		fd_remove_row(row) {
			const i = this.items.findIndex((x) => x.posa_row_id === row.posa_row_id);
			if (i >= 0) this.items.splice(i, 1);
			for (const orphan of L.syncAddons(this.items)) this.fd_remove_row(orphan);
		},
		fd_apply_modifiers(row, groups, selection) {
			const live = this.items.find((x) => x.posa_row_id === row.posa_row_id) || row;
			live.posa_modifiers = L.modifiersText(groups, selection) || null;
			// add-on rows of this item that the kitchen does not have yet are rebuilt
			for (const r of this.items.filter((x) => x.posa_parent_row_id === live.posa_row_id)) {
				if (this.fd_sent_qty(r) <= 0) this.fd_remove_row(r);
			}
			let at = this.items.findIndex((x) => x.posa_row_id === live.posa_row_id);
			for (const a of L.addonItems(groups, selection)) {
				const src = (this.allItems || []).find((i) => i.item_code === a.item_code);
				if (!src) {
					this.fd_msg(__("Add-on {0} is not in this POS Profile's items", [a.item_code]), "warning");
					continue;
				}
				const addon = this.get_new_item({ ...src, qty: live.qty, uom: src.uom || src.stock_uom });
				addon.qty = Number(live.qty) || 1;
				addon.stock_qty = addon.qty * (Number(addon.conversion_factor) || 1);
				addon.posa_parent_row_id = live.posa_row_id;
				addon.posa_seat = live.posa_seat || 0;
				addon.posa_course = live.posa_course || null;
				addon.posa_course_status = live.posa_course_status || null;
				addon.posa_notes = a.option;
				this.items.splice(at + 1, 0, addon);
				at += 1;
				const ref = this.items[at];
				if (typeof this.update_item_detail === "function") this.update_item_detail(ref);
			}
			// get_new_item opens rows that need a batch / serial; add-ons rarely do
			if (Array.isArray(this.expanded)) {
				this.expanded = this.expanded.filter((x) => !x.posa_parent_row_id);
			}
		},
		fd_set_seat(row, seat) {
			const live = this.items.find((x) => x.posa_row_id === row.posa_row_id) || row;
			live.posa_seat = Number(seat) || 0;
			L.syncAddons(this.items);
		},
		fd_set_course(row, courseName) {
			const live = this.items.find((x) => x.posa_row_id === row.posa_row_id) || row;
			if (this.fd_sent_qty(live) > 0) {
				this.fd_msg(__("{0} is already with the kitchen", [live.item_name]), "warning");
				return;
			}
			live.posa_course = courseName || null;
			live.posa_course_status = courseName ? L.statusFor(courseName, this.fd_courses) : null;
			L.syncAddons(this.items);
		},
		fd_toggle_hold(row) {
			const live = this.items.find((x) => x.posa_row_id === row.posa_row_id) || row;
			if (!live.posa_course || this.fd_sent_qty(live) > 0) return;
			live.posa_course_status = live.posa_course_status === "Hold" ? "Fired" : "Hold";
			L.syncAddons(this.items);
		},

		// ---------------------------------------------------------------- covers
		async fd_ask_covers(force = false) {
			if (!this.fd_flags.covers || !this.$refs.fdDialogs) return true;
			if (!force && this.fd.covers > 0) return true;
			const n = await this.$refs.fdDialogs.askCovers({
				current: this.fd.covers || null,
				table: this.selcted_service_table,
				seats: this.fd_table_seats,
			});
			if (n == null) return false;
			this.fd.covers = n;
			if (this.invoice_doc) this.invoice_doc.posa_covers = n;
			return true;
		},
		// called by the host after a table is chosen
		fd_table_chosen() {
			if (this.fd._seating) return; // a booking brings its guests
			this.$nextTick(() => {
				if (this.fd_flags.covers) this.fd_ask_covers(true);
			});
		},

		// ---------------------------------------------------------------- courses
		async fd_fire(course) {
			const rows = this.items.filter((r) => r.posa_course === course && r.posa_course_status === "Hold");
			if (!rows.length) return;
			rows.forEach((r) => (r.posa_course_status = "Fired"));
			L.syncAddons(this.items);
			const ok = await this.fd_save_now();
			if (ok) this.fd_msg(__("{0} fired to the kitchen", [course]), "success");
			else rows.forEach((r) => (r.posa_course_status = "Hold"));
		},
		// Save the order now (and so send what is fired), keeping the cart open.
		async fd_save_now() {
			if (this.fd.busy) return false;
			if (this.fd_offline()) {
				this.fd_msg(__("No connection to the server: the kitchen cannot be reached now."));
				return false;
			}
			if (!(await this.fd_gate())) return false;
			this.fd.busy = true;
			try {
				const res = this.update_invoice(this.get_invoice_doc());
				if (res && typeof res.then === "function") await res;
				await this.fd_refresh_sent();
				return !!(this.invoice_doc && this.invoice_doc.name);
			} finally {
				this.fd.busy = false;
			}
		},

		// ---------------------------------------------------------------- before a save
		// Runs before every action that saves the order (send / hold / pay /
		// print / cancel). Returns false to stop the action.
		async fd_gate({ cancelAll = false } = {}) {
			if (!this.fd_on) return true;
			for (const orphan of L.syncAddons(this.items)) this.fd_remove_row(orphan);
			if (
				!cancelAll &&
				this.fd_flags.covers_required &&
				this.items.length &&
				!(this.fd.covers > 0)
			) {
				if (!(await this.fd_ask_covers(true))) return false;
			}
			if (!this.fd_feature("void_control")) return true;
			const name = this.invoice_doc && this.invoice_doc.name;
			if (!name || String(name).startsWith("OFL-")) return true;
			if (this.fd_offline()) return true; // logged as "Offline" when the sale is uploaded
			let sent;
			try {
				sent = (await call("get_sent", { invoice: name })) || {};
			} catch (e) {
				this.fd_msg(errorText(e));
				return false;
			}
			this.fd.sent = sent;
			const voids = L.pendingVoids(sent, cancelAll ? [] : this.items);
			if (!voids.length) return true;
			return this.fd_ask_void(
				"Void",
				voids.map((v) => {
					const info = this.fd_sent_info(v.row_id);
					return { ...v, item_code: info.item_code, item_name: info.item_name, rate: info.rate };
				})
			);
		},
		fd_sent_info(rowId) {
			const row =
				this.items.find((r) => L.rowKey(r) === rowId) ||
				((this.invoice_doc && this.invoice_doc.items) || []).find((r) => L.rowKey(r) === rowId) ||
				{};
			return { item_code: row.item_code || rowId, item_name: row.item_name || row.item_code || rowId, rate: Number(row.rate) || 0 };
		},
		async fd_ask_void(type, lines, extra = {}) {
			if (!this.$refs.fdDialogs) return false;
			const reasons = ((this.fd.setup && this.fd.setup.void_reasons) || []).filter(
				(r) => r.reason_type === "Both" || r.reason_type === type
			);
			const res = await this.$refs.fdDialogs.askVoid({
				type,
				lines,
				reasons,
				approval: !!Number(this.fd_s.void_approval),
				role: this.fd_s.approver_role,
				confirm: (form) =>
					call("approve", {
						pos_profile: this.pos_profile.name,
						void_type: type,
						reason: form.reason,
						remarks: form.remarks || null,
						approver: form.approver || null,
						password: form.password || null,
						lines: lines.map((l) => ({
							row_id: l.row_id,
							qty: l.qty,
							item_code: l.item_code,
							item_name: l.item_name,
							rate: l.rate,
						})),
						invoice: (this.invoice_doc && this.invoice_doc.name) || null,
						sale_id: this.fd_sale_id(),
						service_table: this.selcted_service_table || null,
						...extra,
					}),
			});
			return !!res;
		},

		// ---------------------------------------------------------------- comp
		async fd_comp(row) {
			const live = this.items.find((x) => x.posa_row_id === row.posa_row_id) || row;
			if (Number(live.posa_comp)) {
				// charge it again, at its price before the comp (or the catalogue price)
				const src = (this.allItems || []).find((i) => i.item_code === live.item_code);
				const price = Number(live._fd_price) || (src ? Number(src.rate) : 0) || 0;
				live.posa_comp = 0;
				live.posa_comp_reason = null;
				live.is_free_item = 0;
				live.discount_percentage = 0;
				live.discount_amount = 0;
				live.price_list_rate = price;
				live.rate = price;
				live.amount = (Number(live.qty) || 0) * price;
				return;
			}
			if (!(this.invoice_doc && this.invoice_doc.name) && !this.fd_sale_id()) {
				// the approval belongs to the order: save it first
				if (!(await this.fd_save_now())) return;
			}
			const price = Number(live.price_list_rate) || Number(live.rate) || 0;
			const ok = await this.fd_ask_void("Comp", [
				{ row_id: live.posa_row_id, qty: Number(live.qty) || 0, item_code: live.item_code, item_name: live.item_name, rate: price },
			]);
			if (!ok) return;
			// a free line (price 0, no discount): ERPNext keeps it at 0 and the
			// item's Max Discount does not apply; the log keeps the real price
			live._fd_price = price;
			live.posa_comp = 1;
			live.posa_comp_reason = this.$refs.fdDialogs ? this.$refs.fdDialogs.lastReason : null;
			live.is_free_item = 1;
			live.price_list_rate = 0;
			live.discount_percentage = 0;
			live.discount_amount = 0;
			live.rate = 0;
			live.amount = 0;
		},

		// ---------------------------------------------------------------- pre-bill
		async fd_prebill() {
			if (!this.fd_flags.prebill) return;
			if (!this.items.length) {
				this.fd_msg(__("There are no items on this order"), "warning");
				return;
			}
			if (!(await this.fd_save_now())) return;
			const name = this.invoice_doc && this.invoice_doc.name;
			if (!name) return;
			let r;
			try {
				r = await call("prebill", { invoice: name });
			} catch (e) {
				this.fd_msg(errorText(e));
				return;
			}
			const format = (r && r.print_format) || this.pos_profile.print_format;
			const url =
				frappe.urllib.get_base_url() +
				"/printview?doctype=Sales%20Invoice&name=" +
				encodeURIComponent(name) +
				"&trigger_print=1&format=" +
				encodeURIComponent(format || "") +
				"&no_letterhead=1&posa_prebill=1";
			const w = window.open(url, "Print");
			if (w && w.addEventListener) w.addEventListener("load", () => w.print(), true);
		},

		// ---------------------------------------------------------------- floor (phase 2)
		fd_floor_call(method, args) {
			return new Promise((resolve, reject) => {
				frappe.call({
					method: "posawesome.posawesome.api.fine_dining_floor." + method,
					args: { pos_profile: this.pos_profile.name, ...args },
					callback: (r) => resolve(r.message),
					error: (e) => reject(e),
				});
			});
		},
		// Put an order from the server in the cart, without saving what is there
		// (the server has just changed it, or it was saved already).
		async fd_load_order(name) {
			this.items = [];
			this.invoice_doc = "";
			await this.$nextTick();
			if (!name) return;
			const doc = await this.fd_floor_call("get_order", { invoice: name });
			this.new_invoice(doc);
		},
		// Make sure the cart is saved as it is (the server works on the saved order).
		async fd_saved_name() {
			if (!this.items.length) return (this.invoice_doc && this.invoice_doc.name) || null;
			if (!(await this.fd_save_now())) return null;
			return this.invoice_doc && this.invoice_doc.name;
		},
		async fd_open_floor() {
			if (!this.fd_flags.floor_plan || !this.$refs.fdFloor) return;
			const current = () => (this.invoice_doc && this.invoice_doc.name) || null;
			const reloadIfCurrent = async (names) => {
				if (current() && names.includes(current())) await this.fd_load_order(await this.fd_still_open(current()));
			};
			const api = {
				load: () => this.fd_floor_call("get_floor", {}),
				moveTable: async (inv, table) => {
					if (inv === current() && !(await this.fd_saved_name())) return;
					await this.fd_floor_call("move_table", { invoice: inv, table });
					await reloadIfCurrent([inv]);
				},
				merge: async (into, from) => {
					if ([into, from].includes(current()) && !(await this.fd_saved_name())) return;
					const r = await this.fd_floor_call("merge_orders", { invoice: into, from_invoice: from });
					if (current() === from) await this.fd_load_order(r && r.invoice);
					else await reloadIfCurrent([into]);
				},
				handover: (inv, user) => this.fd_floor_call("set_waiter", { invoice: inv, user }),
				bookings: () => this.fd_guest_call("get_bookings", {}),
				saveBooking: (data) => this.fd_guest_call("save_booking", { data }),
				bookingStatus: (reservation, status) => this.fd_guest_call("set_booking_status", { reservation, status }),
				setStatus: (table, status) => this.fd_floor_call("set_table_status", { table, status }),
			};
			const res = await this.$refs.fdFloor.show(api);
			if (!res) return;
			if (res.action === "open") {
				if (res.invoice === current()) return;
				const doc = await this.fd_floor_call("get_order", { invoice: res.invoice });
				await this.fd_run("new_invoice", doc);
			} else if (res.action === "seat") {
				await this.fd_seat_booking(res.booking, res.table);
			} else if (res.action === "new") {
				if (this.items.length || current()) await this.fd_run("new_invoice");
				this.selectedTable = res.table;
				if (typeof this.confirmTableSelection === "function") this.confirmTableSelection();
			}
		},
		// ---------------------------------------------------------------- guests (phase 4)
		fd_guest_call(method, args) {
			return new Promise((resolve, reject) => {
				frappe.call({
					method: "posawesome.posawesome.api.fine_dining_guests." + method,
					args: { pos_profile: this.pos_profile.name, ...args },
					callback: (r) => resolve(r.message),
					error: (e) => reject(e),
				});
			});
		},
		// Seat a booking / waitlist party: a new order on the table with their
		// guests, customer and allergies, linked to the booking.
		async fd_seat_booking(name, table) {
			const list = await this.fd_guest_call("get_bookings", {});
			const b = [...(list.bookings || []), ...(list.waitlist || [])].find((x) => x.name === name);
			if (!b) return;
			if (this.items.length || (this.invoice_doc && this.invoice_doc.name)) await this.fd_run("new_invoice");
			this.fd._seating = b;
			this.selectedTable = table;
			if (typeof this.confirmTableSelection === "function") this.confirmTableSelection();
			if (b.customer) this.customer = b.customer;
			await this.$nextTick();
			this.fd._seating = null;
			this.fd.covers = Number(b.party_size) || this.fd.covers;
			if (b.allergies && this.fd_flags.allergens) this.fd.allergies = b.allergies;
			const saved = await this.fd_save_now();
			if (saved) {
				try {
					await this.fd_guest_call("seat_booking", { reservation: b.name, invoice: this.invoice_doc.name });
					this.fd_msg(__("{0} seated at {1}", [b.guest_name, table]), "success");
				} catch (e) {
					this.fd_msg(errorText(e));
				}
			}
		},
		async fd_load_guest(customer) {
			this.fd.guest = null;
			const g = (this.fd.setup && this.fd.setup.guests) || {};
			if (!this.fd_on || !Number(g.guest_profiles) || !customer) return;
			try {
				const prof = await this.fd_guest_call("get_guest_profile", { customer });
				if (this.customer !== customer) return;
				this.fd.guest = prof || null;
				if (prof && prof.allergies && this.fd_flags.allergens && !this.fd.allergies) {
					this.fd.allergies = prof.allergies;
					this.fd_msg(__("{0} has allergies: {1}", [prof.name, prof.allergies]), "warning");
				}
			} catch (e) {
				this.fd.guest = null;
			}
		},
		fd_show_guest() {
			if (this.fd.guest && this.$refs.fdDialogs) this.$refs.fdDialogs.showGuest(this.fd.guest, this.pos_profile.currency);
		},
		async fd_still_open(name) {
			try {
				await this.fd_floor_call("get_order", { invoice: name });
				return name;
			} catch (e) {
				return null;
			}
		},
		async fd_split() {
			if (!this.fd_flags.split_bill || !this.$refs.fdSplit) return;
			const name = await this.fd_saved_name();
			if (!name) {
				this.fd_msg(__("There are no items on this order"), "warning");
				return;
			}
			const res = await this.$refs.fdSplit.show({
				items: JSON.parse(JSON.stringify(this.items)),
				currency: this.pos_profile.currency,
				shares: this.invoice_doc && this.invoice_doc.posa_split_count,
			});
			if (!res) return;
			try {
				if (res.mode === "equal") {
					await this.fd_floor_call("set_split_count", { invoice: name, count: res.shares });
					if (this.invoice_doc) this.invoice_doc.posa_split_count = res.shares;
					if (this.fd_flags.prebill) await this.fd_prebill();
					return;
				}
				const r = await this.fd_floor_call("split_order", { invoice: name, groups: res.groups });
				await this.fd_load_order(r && r.invoice);
				this.fd_msg(__("Split into {0} more check(s): {1}", [(r.checks || []).length, (r.checks || []).join(", ")]), "success");
			} catch (e) {
				this.fd_msg(errorText(e));
			}
		},
		async fd_tip() {
			if (!this.fd_flags.tips || !this.$refs.fdDialogs) return;
			const base = this.items.reduce((a, r) => a + (Number(r.qty) || 0) * (Number(r.rate) || 0), 0);
			const v = await this.$refs.fdDialogs.askTip({ total: base, current: this.fd.tip, currency: this.pos_profile.currency });
			if (v == null) return;
			this.fd.tip = v;
			if (this.invoice_doc) this.invoice_doc.posa_tip_amount = v;
		},

		// ---------------------------------------------------------------- kitchen (phase 3)
		// May this item be added? Not when it is 86 (unavailable today).
		fd_allow_add(item) {
			if (!this.fd_flags.eighty_six || !item) return true;
			const out = (this.fd.eighty_six || []).find((x) => x.item_code === item.item_code);
			if (!out) return true;
			this.fd_msg(__("{0} is not available today (86)", [item.item_name || item.item_code]));
			return false;
		},
		async fd_check_allergens(row) {
			if (!this.fd_flags.allergens || !this.fd.allergies || !row) return;
			let list = this.fd.item_allergens[row.item_code];
			if (!list) {
				try {
					list = (await call("get_item_allergens", { item_code: row.item_code })) || [];
				} catch (e) {
					list = [];
				}
				this.fd.item_allergens = { ...this.fd.item_allergens, [row.item_code]: list };
			}
			const guest = this.fd.allergies.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
			const hit = list.filter((a) => guest.includes(String(a).toLowerCase()));
			if (hit.length) {
				this.fd.row_alerts = { ...this.fd.row_alerts, [row.posa_row_id]: hit.join(", ") };
				this.fd_msg(__("{0} contains {1}: a guest at this table is allergic", [row.item_name, hit.join(", ")]), "warning");
			}
		},
		fd_row_alert(row) {
			return (row && this.fd.row_alerts[row.posa_row_id]) || "";
		},
		async fd_edit_allergies() {
			if (!this.fd_flags.allergens || !this.$refs.fdDialogs) return;
			const v = await this.$refs.fdDialogs.askAllergies({
				list: (this.fd.setup && this.fd.setup.allergens) || [],
				current: this.fd.allergies,
			});
			if (v == null) return;
			this.fd.allergies = v;
			if (this.invoice_doc) this.invoice_doc.posa_allergies = v;
			this.fd.row_alerts = {};
			for (const row of this.items) await this.fd_check_allergens(row);
		},
		async fd_open_86() {
			if (!this.fd_flags.eighty_six || !this.$refs.fdDialogs) return;
			const list = await this.$refs.fdDialogs.show86({
				list: this.fd.eighty_six,
				items: (this.allItems || []).map((i) => ({ item_code: i.item_code, item_name: i.item_name })),
				setter: (code, value) =>
					new Promise((resolve, reject) =>
						frappe.call({
							method: "posawesome.posawesome.api.fine_dining_kitchen.set_86",
							args: { item_code: code, unavailable: value, pos_profile: this.pos_profile.name },
							callback: (r) => resolve(r.message),
							error: reject,
						})
					),
			});
			this.fd.eighty_six = list || [];
		},
		fd_on_86_changed(data) {
			if (data && Array.isArray(data.items)) this.fd.eighty_six = data.items;
		},

		// Run a host action after the fine dining checks, e.g. fd_run('new_invoice').
		async fd_run(method, ...args) {
			if (this.fd_on) {
				const cancelAll = method === "cancel_invoice";
				if (cancelAll && !(this.pos_profile.posa_allow_delete && this.invoice_doc && this.invoice_doc.name)) {
					// cancel only clears the screen; the saved order stays as it is
				} else if (!(await this.fd_gate({ cancelAll }))) {
					return;
				}
			}
			return this[method](...args);
		},
	},
};
