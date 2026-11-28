// A weighing scale on a serial / USB port of the till (Web Serial: Chrome or
// Edge, https). POS Profile > Supermarket > Read Weight From Scale.
//
// The port is remembered by its USB id under its own key, so the customer pole
// display (shared/vfd.js) keeps its own port. Nothing here runs unless the
// feature is switched on.
import { reactive } from "vue";
import { parseScaleLine } from "./logic.js";

const PORT_KEY = "posa_sm_scale_port";

export const scaleState = reactive({
	supported: typeof navigator !== "undefined" && !!navigator.serial,
	enabled: false,
	connected: false,
	weight: null, // kg, last reading
	stable: false,
	at: 0, // time of the last reading
	error: null,
});

let settings = { protocol: "Continuous", baud: 9600, request: "W" };
let port = null;
let reader = null;
let writer = null;
let buffer = "";
let reading = false;

export function configure(s) {
	scaleState.enabled = !!(s && s.scale_reading) && scaleState.supported;
	settings = {
		protocol: (s && s.scale_protocol) || "Continuous",
		baud: Number(s && s.scale_baud) || 9600,
		request: (s && s.scale_request) || "W",
	};
	if (scaleState.enabled) autoConnect();
}

function savedInfo() {
	try {
		return JSON.parse(localStorage.getItem(PORT_KEY) || "null");
	} catch (e) {
		return null;
	}
}

// Reopen the scale port allowed before (only the one saved for the scale).
export async function autoConnect() {
	if (!scaleState.enabled || scaleState.connected) return scaleState.connected;
	const saved = savedInfo();
	if (!saved) return false;
	try {
		const ports = await navigator.serial.getPorts();
		const match = ports.find((p) => {
			const i = p.getInfo ? p.getInfo() : {};
			return i.usbVendorId === saved.usbVendorId && i.usbProductId === saved.usbProductId;
		});
		if (match) await open(match);
	} catch (e) {
		scaleState.error = e.message || String(e);
	}
	return scaleState.connected;
}

// Ask the cashier for the port (from a click).
export async function connect() {
	if (!scaleState.supported) {
		scaleState.error = "This browser cannot use serial ports (use Chrome or Edge).";
		return false;
	}
	try {
		const p = await navigator.serial.requestPort();
		try {
			localStorage.setItem(PORT_KEY, JSON.stringify(p.getInfo ? p.getInfo() : {}));
		} catch (e) {
			/* picked again next time */
		}
		await open(p);
		return true;
	} catch (e) {
		scaleState.error = e && e.name === "NotFoundError" ? null : e.message || String(e);
		return false;
	}
}

async function open(p) {
	if (port === p && scaleState.connected) return;
	await close();
	try {
		await p.open({ baudRate: settings.baud, dataBits: 8, stopBits: 1, parity: "none" });
	} catch (e) {
		if (!/already open/i.test(e.message || "")) throw e;
	}
	port = p;
	scaleState.connected = true;
	scaleState.error = null;
	p.addEventListener?.("disconnect", () => {
		scaleState.connected = false;
		port = null;
		reader = null;
		writer = null;
	});
	readLoop();
}

export async function close() {
	reading = false;
	try {
		if (reader) await reader.cancel();
	} catch (e) {
		/* ignore */
	}
	try {
		if (writer) writer.releaseLock();
		if (port) await port.close();
	} catch (e) {
		/* ignore */
	}
	reader = null;
	writer = null;
	port = null;
	scaleState.connected = false;
}

async function readLoop() {
	if (reading || !port || !port.readable) return;
	reading = true;
	const decoder = new TextDecoder();
	try {
		reader = port.readable.getReader();
		while (reading) {
			const { value, done } = await reader.read();
			if (done) break;
			feed(decoder.decode(value, { stream: true }));
		}
	} catch (e) {
		scaleState.error = e.message || String(e);
	} finally {
		try {
			reader && reader.releaseLock();
		} catch (e) {
			/* ignore */
		}
		reader = null;
		reading = false;
	}
}

// bytes from the scale: one reading per line (CR / LF, or ETX for Toledo)
export function feed(text) {
	buffer += text;
	const parts = buffer.split(/[\r\n\x03]+/);
	buffer = parts.pop();
	if (buffer.length > 200) buffer = buffer.slice(-200);
	for (const line of parts) {
		const r = parseScaleLine(line, settings.protocol);
		if (r) {
			scaleState.weight = r.weight;
			scaleState.stable = r.stable;
			scaleState.at = Date.now();
		}
	}
}

let lastAsk = 0;
async function request() {
	if (settings.protocol !== "Request" || !port || !port.writable) return;
	lastAsk = Date.now();
	try {
		writer = writer || port.writable.getWriter();
		const cmd = String(settings.request).replace(/\\r/g, "\r").replace(/\\n/g, "\n");
		await writer.write(new TextEncoder().encode(cmd.endsWith("\r") ? cmd : cmd + "\r"));
	} catch (e) {
		scaleState.error = e.message || String(e);
	}
}

// The weight now: the first stable reading within `timeout` ms (asks the
// scale first in Request mode). Resolves { weight, stable } or null.
export async function readWeight(timeout = 2500) {
	if (!scaleState.connected) return null;
	const since = Date.now();
	await request();
	return new Promise((resolve) => {
		const tick = () => {
			if (scaleState.at >= since && scaleState.stable && scaleState.weight > 0) {
				return resolve({ weight: scaleState.weight, stable: true });
			}
			if (Date.now() - since > timeout) {
				return resolve(scaleState.at >= since ? { weight: scaleState.weight, stable: scaleState.stable } : null);
			}
			if (settings.protocol === "Request" && Date.now() - lastAsk > 600) request();
			setTimeout(tick, 120);
		};
		tick();
	});
}

export const _test = {
	reset() {
		buffer = "";
		scaleState.weight = null;
		scaleState.stable = false;
		scaleState.at = 0;
	},
	setProtocol(p) {
		settings.protocol = p;
	},
};
