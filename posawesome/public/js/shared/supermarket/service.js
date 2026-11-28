// Supermarket features of the RMS POS: one shared state for the invoice, the
// payment screen, the menu and the dialogs (SmDialogs.vue).
//
// Everything is switched on per POS Profile (Supermarket tab). With "Enable
// Supermarket Features" off, sm.on is false and every gate below lets the
// action through at once, so the POS works exactly as before.
import { reactive } from "vue";
import { serverCall, NetworkError, network, onConnectivityChange } from "../../offline/network.js";
import * as qz from "../../offline/qz_print.js";
import * as L from "./logic.js";
import * as scale from "./scale_serial.js";
import vfd from "../vfd.js";
import { queueState } from "../../offline/queue.js";

const API = "posawesome.posawesome.api.supermarket.";
const _ = (t, a) => (typeof __ === "function" ? __(t, a) : t);

export const sm = reactive({
	setup: null,
	profile: null, // POS Profile doc
	shift: null, // POS Opening Shift doc
	manualTraining: false,
	outbox: 0,
	// open dialogs (SmDialogs.vue)
	ui: { pin: null, reason: null, cash: null, x: null, quick: null, weigh: null, gift: null, giftMenu: null, wallet: null, card: null, phone: null, age: null, request: null, low: null },
	get s() {
		return (this.setup && this.setup.settings) || {};
	},
	get on() {
		return !!this.s.enabled;
	},
	get training() {
		return this.on && !!this.s.training_mode && (!!this.s.trainee || this.manualTraining);
	},
});

let bus = null;
export function attachBus(b) {
	bus = b;
}

export function msg(text, color = "error") {
	if (bus && bus.$emit) bus.$emit("show_mesage", { text, color });
	else if (window.frappe && frappe.show_alert) frappe.show_alert({ message: text, indicator: color === "error" ? "red" : "orange" });
}

export function flag(name) {
	return sm.on && !!sm.s[name];
}

export function needs(action) {
	return flag(L.ACTION_FLAG[action]);
}

export function isOffline() {
	return !network.isOnline;
}

function storeKey(kind) {
	return "posa_sm_" + kind + "_" + ((sm.profile && sm.profile.name) || "");
}

function readStore(kind, fallback) {
	try {
		const v = localStorage.getItem(storeKey(kind));
		return v ? JSON.parse(v) : fallback;
	} catch (e) {
		return fallback;
	}
}

function writeStore(kind, value) {
	try {
		localStorage.setItem(storeKey(kind), JSON.stringify(value));
	} catch (e) {
		/* private mode / full: the feature still works for this session */
	}
}

// ------------------------------------------------------------------ setup
export async function load(profile, shift) {
	sm.profile = profile;
	sm.shift = shift;
	try {
		sm.manualTraining = sessionStorage.getItem(storeKey("training")) === "1";
	} catch (e) {
		sm.manualTraining = false;
	}
	if (!profile || !Number(profile.posa_enable_supermarket)) {
		sm.setup = null; // switched off: nothing to load, POS as before
		return;
	}
	try {
		sm.setup = await serverCall(API + "get_setup", { pos_profile: profile.name });
		writeStore("setup", sm.setup);
	} catch (e) {
		// offline start: the settings of the last online start
		sm.setup = e instanceof NetworkError ? readStore("setup", null) : null;
	}
	sm.outbox = readStore("outbox", []).length;
	flush();
	setupTill();
	startHeartbeat();
}

// ------------------------------------------------------------------ phase 6: till monitor
const HEARTBEAT_MS = 60000;
let heartbeatTimer = null;

export function tillDeviceId() {
	try {
		let id = localStorage.getItem("posa_till_device");
		if (!id || !/^[A-Za-z0-9_-]{6,40}$/.test(id)) {
			const bytes = new Uint8Array(12);
			(window.crypto || {}).getRandomValues ? window.crypto.getRandomValues(bytes) : bytes.forEach((b, i) => (bytes[i] = Math.random() * 256));
			id = Array.from(bytes, (b) => (b % 36).toString(36)).join("").toUpperCase();
			localStorage.setItem("posa_till_device", id);
		}
		return id;
	} catch (e) {
		return null; // private mode: no monitor for this till
	}
}

export async function heartbeat() {
	if (!sm.on || !flag("till_monitor") || !sm.profile) return false;
	const device_id = tillDeviceId();
	if (!device_id) return false;
	let terminal = null;
	try {
		terminal = localStorage.getItem("posa_terminal_id");
	} catch (e) {
		terminal = null;
	}
	try {
		await serverCall(API.replace("supermarket.", "sm_manage.") + "till_heartbeat", {
			pos_profile: sm.profile.name,
			device_id,
			terminal,
			pos_opening_shift: sm.shift && sm.shift.name,
			pending: queueState.pending || 0,
			failed: queueState.failed || 0,
			last_sync: queueState.lastSync,
			version: (window.frappe && frappe.boot && frappe.boot.versions && frappe.boot.versions.posawesome) || "",
		});
		return true;
	} catch (e) {
		return false; // offline: the monitor shows the till as not reporting
	}
}

function startHeartbeat() {
	if (heartbeatTimer) clearInterval(heartbeatTimer);
	heartbeatTimer = null;
	if (!sm.on || !flag("till_monitor")) return;
	heartbeat();
	heartbeatTimer = setInterval(heartbeat, HEARTBEAT_MS);
}

// ------------------------------------------------------------------ phase 2: till speed
function setupTill() {
	try {
		scale.configure(sm.on ? sm.s : null);
	} catch (e) {
		console.warn("[supermarket] scale", e); // never block the POS
	}
	installHotkeys();
}

export const scaleState = scale.scaleState;
export const connectScale = () => scale.connect();

// ---- quick keys
export function quickPages() {
	return (sm.on && flag("quick_keys") && sm.setup && sm.setup.quick_keys) || [];
}

export function openQuickKeys() {
	const pages = quickPages();
	if (!pages.length) {
		if (flag("quick_keys")) msg(_("No quick key pages for this POS Profile (POS Quick Key Page)."), "warning");
		return;
	}
	sm.ui.quick = { page: (sm.ui.quick && sm.ui.quick.page) || pages[0].name };
}

export async function refreshQuickKeys() {
	if (!flag("quick_keys") || !sm.profile) return;
	try {
		const st = await serverCall(API + "get_setup", { pos_profile: sm.profile.name });
		if (st && sm.setup) {
			sm.setup.quick_keys = st.quick_keys || [];
			writeStore("setup", sm.setup);
		}
	} catch (e) {
		/* keep the pages we have */
	}
}
onRealtime("posa_quick_keys_changed", () => refreshQuickKeys());
onRealtime("posa_deals_changed", () => refreshSetupParts(["deals"]));
onRealtime("posa_markdowns_changed", () => refreshSetupParts(["markdowns"]));

// fresh deals / reduced labels from the server (kept for offline use)
export async function refreshSetupParts(keys) {
	if (!sm.on || !sm.profile) return;
	try {
		const st = await serverCall(API + "get_setup", { pos_profile: sm.profile.name });
		if (st && sm.setup) {
			for (const k of keys) sm.setup[k] = st[k] || [];
			writeStore("setup", sm.setup);
		}
	} catch (e) {
		/* keep what we have */
	}
}

// ---- promotions (phase 3)
export function deals() {
	if (!sm.on || !(flag("mix_match") || flag("multibuy"))) return [];
	return (sm.setup && sm.setup.deals) || [];
}

// a POS Offer with Daily From / To or Days (Time and Day Offers)
export function offerInTime(offer, at = new Date()) {
	if (!flag("offer_schedule") || !offer) return true;
	return L.inSchedule(at, null, null, offer.posa_sm_daily_from, offer.posa_sm_daily_to, offer.posa_sm_days);
}

// a scanned reduced-price label: the item at its reduced price, or false
// (told the cashier), or null (not a label code / feature off)
export function markdownItem(code, scanFn) {
	if (!flag("markdown_labels") || !L.isMarkdownCode(code)) return null;
	const c = String(code).trim();
	const label = ((sm.setup && sm.setup.markdowns) || []).find((m) => m.code === c);
	if (!label) {
		msg(_("Reduced label {0} is not valid or was already sold.", [c]));
		return false;
	}
	const item = scanFn(label.item_code);
	if (!item) {
		msg(_("Item {0} of the reduced label is not in this POS catalogue", [label.item_code]));
		return false;
	}
	return {
		...item,
		qty: 1,
		rate: label.price,
		posa_sm_markdown: c,
		__sm_markdown_price: label.price,
		batch_no: label.batch_no || item.batch_no,
		to_set_batch_no: label.batch_no || undefined,
	};
}

export function markdownPrice(code) {
	const label = ((sm.setup && sm.setup.markdowns) || []).find((m) => m.code === code);
	return label ? Number(label.price) : null;
}

// the label was sold here: no other cart on this till takes it again
export function markdownSold(code) {
	if (sm.setup && sm.setup.markdowns) sm.setup.markdowns = sm.setup.markdowns.filter((m) => m.code !== code);
}

function onRealtime(event, fn) {
	try {
		if (window.frappe && frappe.realtime && frappe.realtime.on) frappe.realtime.on(event, fn);
	} catch (e) {
		/* no socket: the pages update at the next POS load */
	}
}

// a quick key pressed: weigh when needed, then the item goes to the cart
export async function pressQuickKey(key) {
	if (sm.ui.weigh) return; // a weight window is open (double tap)
	let qty = 1;
	const weighed = Number(key.ask_weight) || (flag("ask_weight") && L.isWeighed(key, sm.s.weighed_uoms));
	if (weighed) {
		qty = await weigh({ item_name: key.label, uom: key.stock_uom });
		if (!qty) return;
	}
	sm.ui.quick = null;
	if (bus) bus.$emit("sm_add_code", { code: key.item_code, qty, weighed: !!weighed });
}

// ---- weighing: resolves the weight (kg / the item's UOM) or null
export function weigh({ item_name, uom }) {
	return new Promise((resolve) => {
		sm.ui.weigh = { item_name, uom: uom || "Kg", value: "", resolve, reading: false };
		if (scale.scaleState.connected) readScaleInto();
	});
}

export async function readScaleInto() {
	const req = sm.ui.weigh;
	if (!req || req.reading) return;
	req.reading = true;
	const r = await scale.readWeight(3000);
	req.reading = false;
	if (sm.ui.weigh !== req) return; // closed meanwhile
	if (r && r.weight > 0) {
		req.value = String(r.weight);
		if (!r.stable) msg(_("The scale is still moving: check the weight."), "warning");
	} else if (!scale.scaleState.connected) {
		msg(_("No scale connected: Menu > Connect Scale."), "warning");
	} else {
		msg(_("No weight from the scale."), "warning");
	}
}

export function answerWeigh(value) {
	const req = sm.ui.weigh;
	sm.ui.weigh = null;
	const w = value == null ? null : parseFloat(String(value).replace(",", "."));
	if (req) req.resolve(w > 0 ? Math.round(w * 1000) / 1000 : null);
}

// an item added by search / scan that is sold by weight (Ask Weight for Weighed Items)
export function needsWeight(item) {
	if (!sm.on || !flag("ask_weight") || !item) return false;
	if (item.posa_scale_barcode || item.__sm_weighed || item.__sm_gs1) return false;
	if (Math.abs(Number(item.qty) || 1) !== 1) return false; // a typed quantity wins
	return L.isWeighed(item, sm.s.weighed_uoms);
}

// ---- GS1: the item of a GS1 code from the local catalogue, with qty / batch
// set. null when it is not a GS1 code (or GS1 is off, or the product is unknown).
export function gs1Item(code, scanFn) {
	if (!flag("gs1_barcodes")) return null;
	const g = L.parseGS1(code);
	if (!g) return null;
	let item = null;
	for (const c of L.gtinCandidates(g.gtin)) {
		item = scanFn(c);
		if (item) break;
	}
	if (!item) {
		msg(_("No item has the GS1 product code {0}", [g.gtin]));
		return false;
	}
	if (g.expiry && flag("gs1_block_expired") && g.expiry < todayStr()) {
		msg(_("{0} expired on {1}: not added.", [item.item_name || item.item_code, g.expiry]));
		try {
			frappe.utils.play_sound("error");
		} catch (e) {
			/* no sound */
		}
		return false;
	}
	item = { ...item, __sm_gs1: g };
	if (g.weight != null && g.weight > 0) item.qty = g.weight;
	else if (g.price != null && Number(item.rate) > 0) item.qty = Math.round((g.price / Number(item.rate)) * 1000) / 1000;
	else if (g.count) item.qty = g.count;
	if (g.weight != null || g.price != null || g.count) item.posa_scale_barcode = String(code);
	if (g.batch && Number(item.has_batch_no)) {
		item.batch_no = g.batch;
		item.to_set_batch_no = g.batch;
	}
	if (g.expiry && g.expiry < todayStr()) msg(_("{0} expired on {1}", [item.item_name || item.item_code, g.expiry]), "warning");
	return item;
}

function todayStr() {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---- hotkeys: keys chosen on the POS Profile win over the built-in ones
let hotkeysOn = false;
function hotkeyMap() {
	const out = {};
	if (!flag("hotkeys")) return out;
	for (const h of sm.s.hotkey_list || []) {
		const k = L.normalizeHotkey(h.key);
		if (k && !out[k]) out[k] = h.action;
	}
	return out;
}

const SERVICE_ACTIONS = {
	"Quick Keys": () => openQuickKeys(),
	"No Sale": () => noSale(),
	"Cash Pickup": () => openCash("Cash Pickup"),
	"Cash In": () => openCash("Cash In"),
	"Cash Out": () => openCash("Cash Out"),
	"X Report": () => xReport(),
	"Training Mode": () => setTraining(!sm.training),
};

export function onKeydown(e) {
	const map = hotkeyMap();
	const key = L.hotkeyOf(e);
	if (!key || !map[key]) return;
	// a dialog of ours is open: its own keys (Enter, digits) go on
	if (sm.ui.pin || sm.ui.reason || sm.ui.cash || sm.ui.weigh) return;
	e.preventDefault();
	e.stopImmediatePropagation();
	e.stopPropagation();
	const action = map[key];
	if (SERVICE_ACTIONS[action]) SERVICE_ACTIONS[action]();
	else if (bus) bus.$emit("sm_hotkey", { action, key });
}

function installHotkeys() {
	if (hotkeysOn || typeof window === "undefined") return;
	hotkeysOn = true;
	// capture on window: before the POS's own document listeners
	window.addEventListener("keydown", onKeydown, true);
}

// ------------------------------------------------------------------ outbox
// Records made while the till is offline (voids, No Sale, cash movements,
// offline approvals) are kept here and sent when the connection is back.
// Each carries a client_id: the server makes it once.
function queue(method, args) {
	const box = readStore("outbox", []);
	box.push({ method, args, tries: 0, at: new Date().toISOString() });
	writeStore("outbox", box);
	sm.outbox = box.length;
}

let flushing = false;
export async function flush() {
	if (flushing || !sm.profile) return;
	flushing = true;
	try {
		let box = readStore("outbox", []);
		while (box.length) {
			const job = box[0];
			try {
				await serverCall(API + job.method, job.args);
			} catch (e) {
				if (e instanceof NetworkError) break;
				job.tries = (job.tries || 0) + 1;
				if (job.tries < 5) {
					writeStore("outbox", box);
					break;
				}
				console.warn("[supermarket] dropped after 5 tries", job, e);
			}
			box = readStore("outbox", []).slice(1);
			writeStore("outbox", box);
		}
		sm.outbox = box.length;
	} finally {
		flushing = false;
	}
}
onConnectivityChange((online) => {
	if (online) flush();
});
setInterval(() => {
	if (sm.outbox && !isOffline()) flush();
}, 60000);

// A server call that is kept for later when the server cannot be reached.
// Resolves with the answer, or { queued: true }.
export async function send(method, args) {
	const client_id = args.client_id || L.clientId();
	const payload = { pos_profile: sm.profile.name, ...args, client_id };
	try {
		return await serverCall(API + method, payload);
	} catch (e) {
		if (!(e instanceof NetworkError)) throw e;
		queue(method, { ...payload, offline: 1 });
		return { queued: true };
	}
}

// ------------------------------------------------------------------ manager approval
// Resolves with { approval } (a POS Approval Log name, "OFFLINE:<id>", or
// null when no approval is needed) or with null when it was not approved.
export function approve(action, details = {}) {
	if (!needs(action)) return Promise.resolve({ approval: null });
	if (sm.training) return Promise.resolve({ approval: null }); // practice sales are not controlled
	const d = {
		sale_id: details.sale_id,
		pos_opening_shift: sm.shift && sm.shift.name,
		...details,
		time: frappe.datetime ? frappe.datetime.now_datetime() : undefined,
	};
	if (isOffline()) return offlineApproval(action, d);
	return new Promise((resolve) => {
		sm.ui.pin = { action, label: _(L.ACTION_LABEL[action]), details: d, resolve, error: "", busy: false };
	});
}

function offlineApproval(action, details) {
	if (sm.s.approval_offline !== "Allow and Log") {
		msg(_("{0} needs a manager's approval; the till is offline.", [_(L.ACTION_LABEL[action])]));
		return Promise.resolve(null);
	}
	const cid = L.clientId();
	queue("log_offline_approval", { pos_profile: sm.profile.name, action, details, client_id: cid });
	msg(_("Offline: {0} allowed and logged for the manager.", [_(L.ACTION_LABEL[action])]), "warning");
	return Promise.resolve({ approval: "OFFLINE:" + cid, offline: true });
}

// called by the PIN dialog
export async function submitPin({ pin, card }) {
	const req = sm.ui.pin;
	if (!req || req.busy) return;
	req.busy = true;
	req.error = "";
	try {
		const r = await serverCall(API + "approve", {
			pos_profile: sm.profile.name,
			action: req.action,
			pin: pin || undefined,
			card: card || undefined,
			details: req.details,
		});
		sm.ui.pin = null;
		if (r && r.approval) msg(_("Approved by {0}", [r.approver_name || r.approver]), "success");
		req.resolve(r || { approval: null });
	} catch (e) {
		req.busy = false;
		if (e instanceof NetworkError) {
			sm.ui.pin = null;
			req.resolve(await offlineApproval(req.action, req.details));
			return;
		}
		req.error = (e && e.message) || _("Not approved");
	}
}

export function cancelPin() {
	const req = sm.ui.pin;
	sm.ui.pin = null;
	if (req) req.resolve(null);
}

// ------------------------------------------------------------------ reasons
// Resolves with the reason text ("" when reasons are off) or null (cancelled).
export function askReason(title, { always = false, suggestions = null } = {}) {
	if (!always && !flag("void_reason")) return Promise.resolve("");
	return new Promise((resolve) => {
		sm.ui.reason = {
			title,
			reasons: suggestions || (sm.setup && sm.setup.void_reasons) || [],
			free: !!suggestions,
			resolve,
		};
	});
}

export function answerReason(value) {
	const req = sm.ui.reason;
	sm.ui.reason = null;
	if (req) req.resolve(value);
}

// ------------------------------------------------------------------ voids
// Ask the reason and the approval for removing rows. Resolves with
// { reason, approval } or null (cancelled / not approved).
export async function gateVoid(kind, rows, saleId) {
	if (!sm.on || sm.training) return { reason: "", approval: null };
	const cart = kind === "cart_void";
	if (!cart && !flag("void_reason") && !needs("line_void")) return { reason: "", approval: null };
	if (cart && !flag("void_reason") && !needs("cart_void")) return { reason: "", approval: null };
	const title = cart ? _("Cancel the whole cart") : _("Remove {0}", [(rows[0] && rows[0].item_name) || ""]);
	const reason = await askReason(title);
	if (reason === null) return null;
	const amount = rows.reduce((t, r) => t + L.voidRow(r).amount, 0);
	const a = await approve(kind, {
		sale_id: saleId,
		reason,
		item_code: !cart && rows[0] ? rows[0].item_code : undefined,
		item_name: !cart && rows[0] ? rows[0].item_name : _("{0} items", [rows.length]),
		qty: !cart && rows[0] ? rows[0].qty : rows.length,
		amount,
	});
	if (!a) return null;
	return { reason, approval: a.approval };
}

// keep the void (after the rows were removed)
export function logVoid(kind, rows, { reason, approval, saleId, invoice } = {}) {
	if (!sm.on || sm.training || !rows.length) return;
	if (!flag("void_reason") && !needs(kind)) return;
	send("log_void", {
		void_type: kind === "cart_void" ? "Cart Void" : "Line Void",
		reason: reason || undefined,
		items: rows.map(L.voidRow),
		approval: approval || undefined,
		sale_id: saleId || undefined,
		invoice: invoice || undefined,
	}).catch((e) => console.warn("[supermarket] void log", e));
}

// ------------------------------------------------------------------ cash drawer
export async function kickDrawer({ quiet = false } = {}) {
	if (!flag("cash_drawer")) return false;
	try {
		await qz.printRaw(L.drawerCommand(sm.s.drawer_code), sm.profile);
		return true;
	} catch (e) {
		if (!quiet) msg(_("The cash drawer did not open: {0}", [(e && e.message) || e]));
		else console.warn("[supermarket] drawer", e);
		return false;
	}
}

// after a sale: open the drawer when cash was taken
export function afterSale(doc) {
	if (!sm.on || sm.training || !doc || doc.is_return) return;
	for (const r of doc.items || []) if (r.posa_sm_markdown) markdownSold(r.posa_sm_markdown);
	const cashMode = sm.s.cash_mode_of_payment || "Cash";
	const cash = (doc.payments || []).some((p) => p.mode_of_payment === cashMode && Number(p.amount) > 0);
	if (cash && flag("drawer_on_cash")) kickDrawer({ quiet: true });
	if (cash) checkDrawerLimit();
}

const NO_SALE_REASONS = ["Change for a customer", "Check a note", "Put float in", "Wrong tender"];
export async function noSale() {
	if (!flag("cash_drawer")) return;
	const reason = await askReason(_("No Sale: why open the drawer?"), { always: true, suggestions: NO_SALE_REASONS.map((r) => _(r)) });
	if (reason === null) return;
	const a = await approve("no_sale", { reason });
	if (!a) return;
	try {
		await send("no_sale", { reason, approval: a.approval || undefined, time: frappe.datetime.now_datetime() });
	} catch (e) {
		msg(e.message || String(e));
		return;
	}
	if (await kickDrawer()) msg(_("Drawer opened (No Sale)"), "warning");
}

let lastLimitCheck = 0;
export async function checkDrawerLimit(force = false) {
	if (!flag("cash_pickup") || !Number(sm.s.drawer_limit) || isOffline()) return;
	if (!force && Date.now() - lastLimitCheck < 60000) return;
	lastLimitCheck = Date.now();
	try {
		const r = await serverCall(API + "drawer_cash", { pos_profile: sm.profile.name });
		if (r && r.over) msg(_("Cash in the drawer is over the limit: please make a Cash Pickup."), "warning");
	} catch (e) {
		/* a reminder only */
	}
}

// ------------------------------------------------------------------ cash movements
export function openCash(type) {
	if (!flag("cash_pickup")) return;
	sm.ui.cash = { type, amount: "", reason: "", busy: false, error: "" };
}

export async function submitCash() {
	const req = sm.ui.cash;
	if (!req || req.busy) return;
	const amount = L.money(req.amount);
	if (!amount) {
		req.error = _("Enter the amount");
		return;
	}
	const action = req.type === "Cash Pickup" ? "cash_pickup" : req.type === "Cash Out" ? "cash_out" : null;
	req.busy = true;
	let a = { approval: null };
	if (action) {
		sm.ui.cash = null; // the PIN dialog goes on top
		a = await approve(action, { amount, reason: req.reason });
		sm.ui.cash = req;
		if (!a) {
			req.busy = false;
			return;
		}
	}
	try {
		const r = await send("cash_movement", {
			movement_type: req.type,
			amount,
			reason: req.reason || undefined,
			approval: a.approval || undefined,
			pos_opening_shift: sm.shift && sm.shift.name,
		});
		sm.ui.cash = null;
		msg(
			r && r.queued
				? _("{0} of {1} kept offline; it is sent when the connection is back.", [_(req.type), amount])
				: _("{0} {1} saved", [_(req.type), r]),
			"success"
		);
		if (req.type !== "Cash In" || flag("cash_drawer")) kickDrawer({ quiet: true });
	} catch (e) {
		req.busy = false;
		req.error = e.message || String(e);
	}
}

// ------------------------------------------------------------------ X report
export async function xReport() {
	if (!flag("xz_report")) return;
	try {
		sm.ui.x = await serverCall(API + "x_report", { pos_opening_shift: sm.shift.name });
	} catch (e) {
		msg(e instanceof NetworkError ? _("The X report needs the connection") : e.message);
	}
}

export function printHtml(html) {
	if (qz.enabled(sm.profile)) {
		return qz.printHtml(html, sm.profile).catch(() => browserPrint(html));
	}
	return browserPrint(html);
}

function browserPrint(html) {
	const f = document.createElement("iframe");
	f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
	document.body.appendChild(f);
	const d = f.contentWindow.document;
	d.open();
	d.write(html);
	d.close();
	setTimeout(() => {
		f.contentWindow.focus();
		f.contentWindow.print();
		setTimeout(() => f.remove(), 2000);
	}, 250);
}

// ------------------------------------------------------------------ reprint, returns
export async function gateSimple(action, details = {}) {
	const a = await approve(action, details);
	return a ? a : null;
}

// ------------------------------------------------------------------ training
export function setTraining(on) {
	if (!flag("training_mode")) return;
	if (!on && sm.s.trainee) {
		msg(_("You are a trainee on this till: training mode stays on."));
		return;
	}
	sm.manualTraining = !!on;
	try {
		sessionStorage.setItem(storeKey("training"), on ? "1" : "0");
	} catch (e) {
		/* session only */
	}
	msg(on ? _("Training mode on: sales are not recorded") : _("Training mode off"), "warning");
}

// a finished practice sale: nothing is posted; its draft is removed
export async function finishTraining(doc) {
	const name = doc && doc.name;
	if (name && !String(name).startsWith("OFL-")) {
		try {
			await serverCall(API + "training_discard", { invoice: name });
		} catch (e) {
			console.warn("[supermarket] training draft", e); // removed at closing anyway
		}
	}
	msg(_("Training sale finished: nothing was recorded"), "warning");
}


// ================================================================== phase 4: payments and customers
function walkIn() {
	return (sm.profile && sm.profile.customer) || null;
}

// before a sale is submitted: true when nothing has to be asked
export function payNeedsSteps(doc) {
	if (!sm.on || sm.training) return false;
	return L.paySteps(doc, sm.s, walkIn()).length > 0;
}

// Ask what the sale needs, one step after the other (gift card, wallet QR,
// card approval, e-receipt number). Resolves false when the cashier cancels.
export async function beforeSubmit(doc) {
	for (const step of L.paySteps(doc, sm.s, walkIn())) {
		let ok = false;
		if (step.kind === "gift") ok = await askGiftCard(doc);
		else if (step.kind === "wallet") ok = await askWallet(doc, step);
		else if (step.kind === "card") ok = await askCard(doc, step);
		else if (step.kind === "phone") ok = await askPhone(doc);
		if (!ok) return false;
	}
	return true;
}

function open(kind, data) {
	return new Promise((resolve) => {
		sm.ui[kind] = { ...data, resolve, busy: false, error: "" };
	});
}

export function closeStep(kind, value) {
	const req = sm.ui[kind];
	sm.ui[kind] = null;
	if (req && req.resolve) req.resolve(value);
}

// ---- gift card as payment (or store credit for a refund)
function giftAmount(doc) {
	return L.paidBy(doc, sm.s.gift_card_mop).reduce((t, p) => t + Number(p.amount), 0);
}

export function askGiftCard(doc) {
	const amount = Math.round(giftAmount(doc) * 100) / 100;
	if (isOffline()) {
		msg(_("Gift card payments need the connection"));
		return Promise.resolve(false);
	}
	return open("gift", { amount, card_no: "", info: null, refund: amount < 0, doc });
}

export async function lookupGiftCard() {
	const req = sm.ui.gift;
	if (!req || !req.card_no) return;
	req.busy = true;
	req.error = "";
	try {
		req.info = await serverCall(API + "gift_card_balance", { pos_profile: sm.profile.name, card_no: req.card_no.trim() });
		if (!req.info.exists && !req.refund) req.error = _("Gift card {0} not found", [req.card_no]);
		else if (req.info.exists && req.info.problem) req.error = req.info.problem;
		else if (!req.refund && req.info.balance + 0.005 < req.amount) req.error = _("The card has {0}; the payment is {1}", [req.info.balance, req.amount]);
	} catch (e) {
		req.error = e.message || String(e);
	} finally {
		req.busy = false;
	}
}

export async function newStoreCreditNo() {
	const req = sm.ui.gift;
	if (!req) return;
	try {
		req.card_no = await serverCall(API + "new_store_credit_no", { pos_profile: sm.profile.name });
		req.info = { exists: false, balance: 0 };
		req.error = "";
	} catch (e) {
		req.error = e.message || String(e);
	}
}

export function confirmGiftCard() {
	const req = sm.ui.gift;
	if (!req || !req.info || req.error) return;
	req.doc.posa_sm_gift_card_no = req.card_no.trim();
	req.doc.posa_sm_gift_card_amount = req.amount;
	closeStep("gift", true);
}

// ---- gift card menu: sell / top up, balance
export function openGiftMenu() {
	if (!flag("gift_cards")) return;
	sm.ui.giftMenu = { tab: "sell", card_no: "", amount: "", info: null, busy: false, error: "" };
}

export async function giftMenuBalance() {
	const req = sm.ui.giftMenu;
	if (!req || !req.card_no) return;
	req.busy = true;
	req.error = "";
	try {
		req.info = await serverCall(API + "gift_card_balance", { pos_profile: sm.profile.name, card_no: req.card_no.trim() });
		if (!req.info.exists) req.error = _("Gift card {0} not found", [req.card_no]);
	} catch (e) {
		req.error = e instanceof NetworkError ? _("The balance needs the connection") : e.message;
	} finally {
		req.busy = false;
	}
}

export function giftMenuSell() {
	const req = sm.ui.giftMenu;
	if (!req) return;
	const card = String(req.card_no || "").trim();
	const amount = L.money(req.amount);
	if (!/^[A-Za-z0-9_-]{1,40}$/.test(card)) {
		req.error = _("Scan or type the card number");
		return;
	}
	if (!amount) {
		req.error = _("Enter the amount to load");
		return;
	}
	sm.ui.giftMenu = null;
	if (bus) {
		bus.$emit("sm_add_code", {
			code: sm.s.gift_card_item,
			qty: 1,
			extra: { rate: amount, price_list_rate: amount, posa_custom_rate: 1, posa_sm_gift_card: card, item_name: _("Gift Card {0}", [card]) },
		});
	}
}

// ---- wallet / Raast QR
export async function askWallet(doc, step) {
	const req = { wallet: step.wallet, amount: step.amount, html: "", ref: "", loading: true, doc };
	const p = open("wallet", req);
	try {
		const r = await serverCall(API + "wallet_qr", { pos_profile: sm.profile.name, mode_of_payment: step.wallet.mode_of_payment, amount: step.amount });
		if (sm.ui.wallet) sm.ui.wallet.html = (r && r.html) || "";
		if (sm.ui.wallet) sm.ui.wallet.dynamic = !!(r && r.dynamic);
	} catch (e) {
		// offline: the QR without the amount, kept from the last online start
		const st = (sm.setup && sm.setup.wallet_qr_static) || {};
		if (sm.ui.wallet) sm.ui.wallet.html = st[step.wallet.mode_of_payment] || "";
	} finally {
		if (sm.ui.wallet) sm.ui.wallet.loading = false;
	}
	return p;
}

export function confirmWallet() {
	const req = sm.ui.wallet;
	if (!req) return;
	const ref = String(req.ref || "").trim();
	if (req.wallet.reference_required && !ref) {
		req.error = _("Type the transaction ID from the customer's phone");
		return;
	}
	req.doc.posa_sm_wallet_ref = ref || "-";
	closeStep("wallet", true);
}

// ---- card machine: approval code, or the bridge on the till
export async function askCard(doc, step) {
	const p = open("card", { mode: step.mode, amount: step.amount, code: "", waiting: false, doc });
	if (sm.s.card_bridge_url) cardBridge();
	return p;
}

export async function cardBridge() {
	const req = sm.ui.card;
	if (!req || !sm.s.card_bridge_url) return;
	req.waiting = true;
	req.error = "";
	const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
	req.abort = ctrl;
	const timer = setTimeout(() => ctrl && ctrl.abort(), 120000);
	try {
		const r = await fetch(sm.s.card_bridge_url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ amount: req.amount, currency: (sm.profile && sm.profile.currency) || "", reference: (req.doc && (req.doc.name || req.doc.posa_offline_id)) || "" }),
			signal: ctrl ? ctrl.signal : undefined,
		});
		const data = await r.json();
		if (sm.ui.card !== req) return;
		if (data && data.approved) {
			req.doc.posa_sm_card_ref = String(data.auth_code || data.approval_code || "OK") + (data.card_last4 ? " *" + data.card_last4 : "");
			closeStep("card", true);
			return;
		}
		req.error = (data && (data.message || data.error)) || _("The card was declined");
	} catch (e) {
		if (sm.ui.card === req) req.error = e && e.name === "AbortError" ? _("No answer from the card machine") : _("Card machine not reachable: type the approval code");
	} finally {
		clearTimeout(timer);
		if (sm.ui.card === req) req.waiting = false;
	}
}

export function confirmCard() {
	const req = sm.ui.card;
	if (!req) return;
	const code = String(req.code || "").trim();
	if (!/^[A-Za-z0-9]{4,12}$/.test(code)) {
		req.error = _("Type the approval code from the card machine slip (4 to 12 letters / digits)");
		return;
	}
	if (req.abort) req.abort.abort();
	req.doc.posa_sm_card_ref = code;
	closeStep("card", true);
}

// ---- e-receipt number
export function askPhone(doc) {
	return open("phone", { phone: "", doc });
}

export function confirmPhone(send) {
	const req = sm.ui.phone;
	if (!req) return;
	if (send) {
		const p = L.normalizePhone(req.phone);
		if (!p) {
			req.error = _("Type a mobile number, e.g. 03001234567");
			return;
		}
		req.doc.posa_sm_receipt_to = p;
	} else {
		req.doc.posa_sm_receipt_to = "";
	}
	closeStep("phone", true);
}

// ---- age check: once per sale for the highest age asked
export function minAge(item) {
	if (!flag("age_check") || !item) return 0;
	return Number(((sm.setup && sm.setup.age_items) || {})[item.item_code]) || 0;
}

export function askAge(item, age) {
	return open("age", { item_name: item.item_name || item.item_code, age });
}

// ---- loyalty points on the customer display
let lastLoyalty = null;
export async function showLoyalty(customer) {
	if (!flag("loyalty_display") || !customer || isOffline()) return;
	if (!(sm.profile && Number(sm.profile.posa_enable_vfd))) return;
	if (customer === walkIn()) return;
	lastLoyalty = customer;
	try {
		const r = await serverCall(API + "loyalty_points", { pos_profile: sm.profile.name, customer });
		if (r && lastLoyalty === customer) vfd.show(String(customer).slice(0, 20), _("POINTS: {0}", [r.points]));
	} catch (e) {
		/* the display keeps what it shows */
	}
}


// ================================================================== phase 5: store (till side)
const STORE = "posawesome.posawesome.api.sm_store.";

export function openRequest() {
	if (!flag("transfer_request")) return;
	sm.ui.request = { rows: [], code: "", qty: 1, busy: false, error: "" };
}

export function requestAdd() {
	const req = sm.ui.request;
	if (!req) return;
	const code = String(req.code || "").trim();
	const qty = Number(req.qty) || 0;
	if (!code || qty <= 0) return;
	const row = req.rows.find((r) => r.code === code);
	if (row) row.qty += qty;
	else req.rows.push({ code, qty });
	req.code = "";
	req.qty = 1;
}

export async function requestSend() {
	const req = sm.ui.request;
	if (!req || !req.rows.length || req.busy) return;
	req.busy = true;
	req.error = "";
	try {
		const name = await serverCall(STORE + "make_transfer_request", { pos_profile: sm.profile.name, items: req.rows });
		sm.ui.request = null;
		msg(_("Stock requested: {0}", [name]), "success");
	} catch (e) {
		req.busy = false;
		req.error = e instanceof NetworkError ? _("A stock request needs the connection") : e.message;
	}
}

export async function openLowStock() {
	if (!flag("low_stock")) return;
	try {
		const rows = await serverCall(STORE + "low_stock", { pos_profile: sm.profile.name });
		sm.ui.low = { rows: rows || [] };
	} catch (e) {
		msg(e instanceof NetworkError ? _("The low-stock list needs the connection") : e.message);
	}
}
