// Connectivity tracking + a quiet server call helper for the offline layer.
// frappe.call() shows dialogs and freezes the UI on failures, which is wrong for
// background sync; serverCall() never touches the UI.
import { reactive } from "vue";

export const network = reactive({
	online: typeof navigator === "undefined" ? true : navigator.onLine,
	serverReachable: true,
	lastCheck: null,
	lastOnline: null,
	latencyMs: null,
	// when true the POS behaves as offline even if the server answers (testing / flaky links)
	forcedOffline: false,
	get isOnline() {
		return this.online && this.serverReachable && !this.forcedOffline;
	},
});

const listeners = new Set();
export function onConnectivityChange(fn) {
	listeners.add(fn);
	return () => listeners.delete(fn);
}

let lastState = null;
function notify() {
	const state = network.isOnline;
	if (state === lastState) return;
	lastState = state;
	if (state) network.lastOnline = new Date().toISOString();
	for (const fn of listeners) {
		try {
			fn(state);
		} catch (e) {
			console.error(e);
		}
	}
}

export class NetworkError extends Error {
	constructor(message) {
		super(message || "Server unreachable");
		this.name = "NetworkError";
	}
}

export class ServerError extends Error {
	constructor(message, payload, status) {
		super(message || "Server error");
		this.name = "ServerError";
		this.payload = payload;
		this.status = status;
	}
}

function serverMessage(data) {
	try {
		if (data && data._server_messages) {
			const msgs = JSON.parse(data._server_messages).map((m) => {
				try {
					return JSON.parse(m).message;
				} catch (e) {
					return m;
				}
			});
			return msgs
				.join("\n")
				.replace(/<[^>]+>/g, "")
				.trim();
		}
		if (data && data.exception) return String(data.exception).split(":").slice(1).join(":").trim();
		if (data && data.exc_type) return data.exc_type;
	} catch (e) {
		/* ignore */
	}
	return null;
}

/**
 * POST a whitelisted method. Resolves with `message`.
 * Throws NetworkError when the server cannot be reached (and marks us offline),
 * ServerError when the server answered with an error.
 */
export async function serverCall(method, args = {}, { timeout = 30000, method_type = "POST" } = {}) {
	const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
	const timer = controller ? setTimeout(() => controller.abort(), timeout) : null;
	const body = new URLSearchParams();
	for (const [k, v] of Object.entries(args || {})) {
		if (v === undefined) continue;
		body.append(k, typeof v === "string" ? v : JSON.stringify(v));
	}
	let response;
	const started = Date.now();
	try {
		response = await fetch(`/api/method/${method}`, {
			method: method_type,
			headers: {
				Accept: "application/json",
				"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
				"X-Frappe-CSRF-Token": (window.frappe && frappe.csrf_token) || "",
				"X-Requested-With": "XMLHttpRequest",
			},
			body: method_type === "GET" ? undefined : body,
			credentials: "same-origin",
			signal: controller ? controller.signal : undefined,
		});
	} catch (e) {
		markUnreachable();
		throw new NetworkError(e && e.name === "AbortError" ? "Request timed out" : e && e.message);
	} finally {
		if (timer) clearTimeout(timer);
	}
	// proxies / gateways answering while the app server is down
	if ([502, 503, 504].includes(response.status)) {
		markUnreachable();
		throw new NetworkError(`Server unavailable (${response.status})`);
	}
	markReachable(Date.now() - started);
	let data = null;
	try {
		data = await response.json();
	} catch (e) {
		data = null;
	}
	if (!response.ok || (data && (data.exc || data.exception))) {
		throw new ServerError(serverMessage(data) || `HTTP ${response.status}`, data, response.status);
	}
	return data ? data.message : null;
}

function markUnreachable() {
	network.serverReachable = false;
	network.lastCheck = new Date().toISOString();
	notify();
}

function markReachable(latency) {
	network.serverReachable = true;
	network.latencyMs = latency;
	network.lastCheck = new Date().toISOString();
	notify();
}

export async function ping() {
	try {
		await serverCall("frappe.ping", {}, { timeout: 6000, method_type: "GET" });
		return true;
	} catch (e) {
		return !(e instanceof NetworkError);
	}
}

let timer = null;
let started = false;

export function startConnectivityMonitor() {
	if (started || typeof window === "undefined") return;
	started = true;
	window.addEventListener("online", () => {
		network.online = true;
		ping();
		notify();
	});
	window.addEventListener("offline", () => {
		network.online = false;
		notify();
	});
	// frappe.call() failures tell us about a lost server faster than the poll
	const $doc = window.jQuery && window.jQuery(document);
	if ($doc && typeof $doc.ajaxError === "function") {
		$doc.ajaxError((event, xhr) => {
			if (xhr && (xhr.status === 0 || [502, 503, 504].includes(xhr.status)) && xhr.statusText !== "abort") {
				markUnreachable();
				clearTimeout(timer);
				timer = setTimeout(loop, 5000);
			}
		});
	}
	async function loop() {
		if (network.online) await ping();
		// poll faster while the server is unreachable
		timer = setTimeout(loop, network.serverReachable ? 60000 : 10000);
	}
	timer = setTimeout(loop, 2000);
	lastState = network.isOnline;
}

export function stopConnectivityMonitor() {
	clearTimeout(timer);
	started = false;
}

export function setForcedOffline(value) {
	network.forcedOffline = !!value;
	notify();
}
