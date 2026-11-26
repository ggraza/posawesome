// Customer pole display (VFD, 2 lines x 20 characters) on a serial / USB-serial
// port, driven from the browser with the Web Serial API (Chrome / Edge on
// Windows, Linux, macOS; the page must be served over https or localhost).
//
// Enabled per POS Profile ("POS Offline & Scale" tab > Customer Pole Display),
// same fields as the v14 build:
//   posa_enable_vfd, posa_vfd_command_set (Epson ESC/POS | CD5220 | Plain text),
//   posa_vfd_baud_rate, posa_vfd_columns, posa_vfd_line_1, posa_vfd_line_2
//   (line 2 empty = company name)
//
// The cashier picks the port once (navbar "Display" chip or the menu); the
// browser remembers the permission, so later the display reconnects by itself.
// Everything here is best effort: a missing or unplugged display never stops a
// sale.

import { reactive } from "vue";

const ESC = "\x1B";
const PROTOCOLS = {
	// Epson ESC/POS customer display command set (DM-D110/D210, LD220, PD220 and
	// most "ESC/POS" pole displays): init, clear, home, then 40 chars in overwrite mode.
	escpos: {
		init: ESC + "@",
		frame: (l1, l2) => "\x0C\x0B" + l1 + l2,
	},
	// displays in plain / "AEDEX" style text mode: one line per CR LF
	plain: {
		init: "",
		frame: (l1, l2) => "\r\n" + l1 + "\r\n" + l2,
	},
	// CD5220 command set (many Chinese VFDs): ESC @, clear ESC Q A/B per line
	cd5220: {
		init: ESC + "@",
		frame: (l1, l2) => ESC + "QA" + l1 + "\r" + ESC + "QB" + l2 + "\r",
	},
};

export const vfdState = reactive({
	supported: typeof navigator !== "undefined" && "serial" in navigator,
	enabled: false,
	connected: false,
	error: null,
	lines: ["", ""],
});

let settings = {
	protocol: "escpos",
	baud: 9600,
	cols: 20,
	welcome1: "WELCOME",
	welcome2: "",
	thanks: "THANK YOU",
};
let currency = "";
let paidSoFar = null; // set while the payment screen drives the display
let lastCur = "";

/** Payment screen closed (back to the cart or sale submitted). */
export function endPayment() {
	paidSoFar = null;
}
const PORT_KEY = "posa_vfd_port";
let watching = false;
let port = null;
let writer = null;
let pending = null; // latest frame waiting to be written (older ones are dropped)
let writing = false;
let holdUntil = 0; // keep "change" on screen a little after the sale
let lastItems = new Map();

function protocolKey(label) {
	const l = String(label || "").toLowerCase();
	if (l.includes("epson") || l.includes("esc")) return "escpos";
	if (l.includes("cd5220")) return "cd5220";
	if (l.includes("plain") || l.includes("aedex")) return "plain";
	return "escpos";
}

/** ASCII only (most VFDs have no Urdu / Unicode font), fixed width. */
function fit(text, cols = settings.cols) {
	const ascii = String(text == null ? "" : text)
		.normalize("NFKD")
		.replace(/[^\x20-\x7E]/g, "")
		.replace(/\s+/g, " ")
		.trim();
	return ascii.length > cols ? ascii.slice(0, cols) : ascii.padEnd(cols, " ");
}

/** "left ........ right" on one line, the right part always visible. */
function spread(left, right, cols = settings.cols) {
	const r = fit(right, cols).trim();
	const room = Math.max(0, cols - r.length - 1);
	const l = fit(left, cols).trim().slice(0, room);
	return (l + " ".repeat(Math.max(1, cols - l.length - r.length)) + r).slice(0, cols);
}

function amount(v) {
	const n = Number(v) || 0;
	return Number.isInteger(Math.round(n * 100) / 100) ? String(Math.round(n)) : n.toFixed(2);
}

export function configure(profile) {
	vfdState.enabled = !!(profile && Number(profile.posa_enable_vfd)) && vfdState.supported;
	if (!profile) return;
	settings = {
		// older v16 test builds used posa_vfd_protocol / _welcome_line1/2
		protocol: protocolKey(profile.posa_vfd_command_set || profile.posa_vfd_protocol),
		baud: Number(profile.posa_vfd_baud_rate) || 9600,
		cols: Math.min(40, Math.max(8, Number(profile.posa_vfd_columns) || 20)),
		welcome1: profile.posa_vfd_line_1 || profile.posa_vfd_welcome_line1 || "WELCOME",
		welcome2: profile.posa_vfd_line_2 || profile.posa_vfd_welcome_line2 || profile.company || "",
		thanks: "THANK YOU",
	};
	if (vfdState.enabled && !watching) {
		// display plugged back in: reopen it without a click
		watching = true;
		try {
			navigator.serial.addEventListener("connect", () => autoConnect().then((ok) => ok && welcome()));
		} catch (e) {
			/* no plug events: reconnect on the next POS load */
		}
	}
	if (vfdState.enabled) autoConnect().then(() => welcome());
}

/** Reconnect to a port the user allowed before (no prompt). */
export async function autoConnect() {
	if (!vfdState.enabled || vfdState.connected) return vfdState.connected;
	try {
		const ports = await navigator.serial.getPorts();
		let saved = null;
		try {
			saved = JSON.parse(localStorage.getItem(PORT_KEY) || "null");
		} catch (e) {
			saved = null;
		}
		// the port picked last time (by USB id), else the only one allowed
		const match =
			(saved &&
				ports.find((p) => {
					const i = p.getInfo ? p.getInfo() : {};
					return i.usbVendorId === saved.usbVendorId && i.usbProductId === saved.usbProductId;
				})) ||
			(ports.length === 1 ? ports[0] : null) ||
			(saved ? null : ports[0]);
		if (match) await open(match);
	} catch (e) {
		vfdState.error = e.message || String(e);
	}
	return vfdState.connected;
}

/** Ask the user for the port (must run from a click). */
export async function connect() {
	if (!vfdState.supported) {
		vfdState.error = "This browser cannot use serial ports (use Chrome or Edge).";
		return false;
	}
	try {
		const p = await navigator.serial.requestPort();
		try {
			localStorage.setItem(PORT_KEY, JSON.stringify(p.getInfo ? p.getInfo() : {}));
		} catch (e) {
			/* not kept: picked again next time */
		}
		await open(p);
		welcome();
		return true;
	} catch (e) {
		// NotFoundError = the cashier closed the port picker: not an error
		vfdState.error = e && e.name === "NotFoundError" ? null : e.message || String(e);
		return false;
	}
}

async function open(p) {
	if (port === p && vfdState.connected) return;
	await close();
	try {
		await p.open({ baudRate: settings.baud, dataBits: 8, stopBits: 1, parity: "none" });
	} catch (e) {
		// already open in this tab (InvalidStateError) is fine
		if (!/already open/i.test(e.message || "")) throw e;
	}
	port = p;
	writer = p.writable.getWriter();
	vfdState.connected = true;
	vfdState.error = null;
	const init = PROTOCOLS[settings.protocol].init;
	if (init) await raw(init);
	p.addEventListener?.("disconnect", () => {
		vfdState.connected = false;
		writer = null;
		port = null;
	});
}

export async function close() {
	try {
		if (writer) {
			writer.releaseLock();
			writer = null;
		}
		if (port) await port.close();
	} catch (e) {
		/* ignore */
	}
	port = null;
	vfdState.connected = false;
}

async function raw(text) {
	if (!writer) return;
	const bytes = new Uint8Array([...text].map((c) => c.charCodeAt(0) & 0xff));
	await writer.write(bytes);
}

/** Show two lines (latest call wins; writes never overlap). */
function pad(text, cols = settings.cols) {
	// like fit() but keeps leading spaces (right-aligned amounts)
	const ascii = String(text == null ? "" : text)
		.normalize("NFKD")
		.replace(/[^\x20-\x7E]/g, "");
	return ascii.length > cols ? ascii.slice(0, cols) : ascii.padEnd(cols, " ");
}

export function show(line1, line2) {
	const l1 = pad(line1);
	const l2 = pad(line2);
	vfdState.lines = [l1, l2];
	if (!vfdState.enabled) return;
	pending = PROTOCOLS[settings.protocol].frame(l1, l2);
	flush();
}

async function flush() {
	if (writing || !pending) return;
	if (!vfdState.connected) return; // shown again on the next update
	writing = true;
	try {
		while (pending) {
			const frame = pending;
			pending = null;
			await raw(frame);
		}
	} catch (e) {
		vfdState.error = e.message || String(e);
		vfdState.connected = false;
	} finally {
		writing = false;
	}
}

export function welcome() {
	lastItems = new Map();
	show(fit(settings.welcome1), fit(settings.welcome2));
}

/**
 * Cart changed (Invoice customer display payload). Shows the row that changed
 * with its amount, and the total on line 2.
 */
export function showCart(payload) {
	if (!vfdState.enabled || !payload) return;
	const items = payload.items || [];
	const cur = payload.currency ? payload.currency + " " : "";
	if (!items.length) {
		lastItems = new Map();
		if (Date.now() < holdUntil) return; // keep "change" visible after the sale
		return welcome();
	}
	holdUntil = 0;
	// the payment screen owns the display until it closes (endPayment)
	if (paidSoFar != null) return showTotal(payload.grand_total || payload.total, paidSoFar, lastCur);
	if (payload.stage === "payment") {
		return show("TOTAL DUE", spread("", cur + amount(payload.grand_total || payload.total)));
	}
	// the row added or changed since the last update (else the first row)
	let changed = null;
	const seen = new Map();
	for (const it of items) {
		const key = it.id || it.name;
		seen.set(key, `${it.qty}|${it.rate}`);
		if (!changed && lastItems.get(key) !== `${it.qty}|${it.rate}`) changed = it;
	}
	lastItems = seen;
	const row = changed || items[0];
	const qty = Number(row.qty) || 0;
	const line1 = qty === 1 ? spread(row.name, amount(row.amount)) : spread(`${amount(qty)}x ${row.name}`, amount(row.amount));
	show(line1, spread("TOTAL", cur + amount(payload.total)));
}

/** Payment screen: total due and the amount paid so far (live while typing). */
export function showTotal(total, paid, cur = currency) {
	if (!vfdState.enabled) return;
	holdUntil = 0;
	paidSoFar = Number(paid) || 0;
	lastCur = cur || "";
	const c = cur ? cur + " " : "";
	show(spread("TOTAL", c + amount(total)), spread("PAID", c + amount(paid || 0)));
}

/** Navbar chip: prove the display works (clock for 3 seconds, then welcome). */
export function test() {
	const d = new Date();
	const p = (x) => String(x).padStart(2, "0");
	show(fit("DISPLAY OK"), fit(`${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`));
	holdUntil = Date.now() + 3000;
	setTimeout(() => {
		if (Date.now() >= holdUntil - 100) welcome();
	}, 3000);
}

export function setCurrency(c) {
	currency = c || "";
}

/** Sale completed: paid and change, kept for a few seconds, then thank you / welcome. */
export function showChange({ paid, change, currency }) {
	if (!vfdState.enabled) return;
	paidSoFar = null;
	const cur = currency ? currency + " " : "";
	show(spread("PAID", cur + amount(paid)), spread("CHANGE", cur + amount(change)));
	holdUntil = Date.now() + 8000;
	setTimeout(() => {
		if (Date.now() >= holdUntil - 100 && !lastItems.size) show(settings.thanks, settings.welcome1);
	}, 8000);
}

export const vfd = { configure, connect, autoConnect, close, show, welcome, showCart, showChange, showTotal, endPayment, test, setCurrency, state: vfdState };
export default vfd;
