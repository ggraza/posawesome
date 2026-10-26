// Offline invoice queue.
//
// Invoices taken while offline are written to IndexedDB *before* the receipt is
// printed, so a crash or reload never loses a sale. The uploader sends them in
// batches to posawesome.posawesome.api.offline.upload_offline_invoices; the
// server is idempotent on offline_id, so a batch that timed out can simply be
// sent again. Designed for thousands of queued invoices.
//
// status: pending  -> not on the server yet
//         uploaded -> stored on the server, being processed there
//         synced   -> Sales Invoice created (server_name)
//         failed   -> server rejected it (error); fix & retry or export
import { reactive } from "vue";
import { queueDatabase } from "./db";
import { network, serverCall, NetworkError, onConnectivityChange } from "./network";

const API = "posawesome.posawesome.api.offline";

export const queueState = reactive({
	pending: 0,
	uploaded: 0,
	failed: 0,
	synced: 0,
	syncing: false,
	lastSync: null,
	lastError: null,
});

function terminalId() {
	let id = null;
	try {
		id = localStorage.getItem("posa_terminal_id");
		if (!id) {
			id = Math.random().toString(36).slice(2, 6).toUpperCase();
			localStorage.setItem("posa_terminal_id", id);
		}
	} catch (e) {
		id = "T" + Math.random().toString(36).slice(2, 5).toUpperCase();
	}
	return id;
}

export function newOfflineId() {
	const rnd =
		typeof crypto !== "undefined" && crypto.getRandomValues
			? Array.from(crypto.getRandomValues(new Uint8Array(4)))
					.map((b) => b.toString(16).padStart(2, "0"))
					.join("")
			: Math.random().toString(16).slice(2, 10);
	return `OFL-${terminalId()}-${Date.now().toString(36).toUpperCase()}-${rnd}`;
}

const db = () => queueDatabase();

async function log(event, detail) {
	try {
		await db().put("log", { at: new Date().toISOString(), event, detail });
	} catch (e) {
		/* ignore */
	}
}

export async function refreshCounts() {
	const d = db();
	const [pending, uploaded, failed, synced] = await Promise.all([
		d.countFromIndex("invoices", "status", "pending"),
		d.countFromIndex("invoices", "status", "uploaded"),
		d.countFromIndex("invoices", "status", "failed"),
		d.countFromIndex("invoices", "status", "synced"),
	]);
	Object.assign(queueState, { pending, uploaded, failed, synced });
	return queueState;
}

/**
 * Queue an invoice. `invoice` is the Sales Invoice payload (same shape the online
 * flow sends to update_invoice), `data` the payment data of submit_invoice.
 */
export async function enqueueInvoice({ invoice, data, offlineCustomer = null, offlineId = null }) {
	const offline_id = offlineId || newOfflineId();
	const now = new Date();
	const record = {
		offline_id,
		status: "pending",
		created_on: now.toISOString(),
		created_local: frappe.datetime ? frappe.datetime.now_datetime() : now.toISOString(),
		pos_profile: invoice.pos_profile,
		pos_opening_shift: invoice.posa_pos_opening_shift,
		customer: invoice.customer,
		customer_name: invoice.customer_name || invoice.customer,
		grand_total: invoice.rounded_total || invoice.grand_total,
		currency: invoice.currency,
		is_return: invoice.is_return ? 1 : 0,
		user: frappe.session && frappe.session.user,
		invoice: JSON.parse(JSON.stringify(invoice)),
		data: JSON.parse(JSON.stringify(data || {})),
		offline_customer: offlineCustomer,
		attempts: 0,
		error: null,
		server_name: null,
	};
	record.invoice.posa_offline_id = offline_id;
	await db().put("invoices", record);
	await log("queued", offline_id);
	await refreshCounts();
	scheduleSync(1500);
	return record;
}

export async function getInvoice(offlineId) {
	return db().get("invoices", offlineId);
}

export async function listInvoices({ status = null, limit = 500 } = {}) {
	const rows = status ? await db().getAllFromIndex("invoices", "status", status) : await db().getAll("invoices");
	rows.sort((a, b) => (a.created_on < b.created_on ? 1 : -1));
	return rows.slice(0, limit);
}

/** item_code -> stock qty sold offline and not yet on the server */
export async function pendingStockQty() {
	const map = new Map();
	for (const status of ["pending", "uploaded", "failed"]) {
		const rows = await db().getAllFromIndex("invoices", "status", status);
		for (const r of rows) {
			if (!r.invoice || !r.invoice.update_stock) continue;
			for (const it of r.invoice.items || []) {
				const qty = (Number(it.qty) || 0) * (Number(it.conversion_factor) || 1);
				map.set(it.item_code, (map.get(it.item_code) || 0) + qty);
			}
		}
	}
	return map;
}

async function update(offlineId, patch) {
	const row = await db().get("invoices", offlineId);
	if (!row) return null;
	Object.assign(row, patch);
	await db().put("invoices", row);
	return row;
}

function applyResult(row, result) {
	const status = result.status;
	if (status === "Synced" || status === "Duplicate") {
		return { status: "synced", server_name: result.sales_invoice, error: null, synced_on: new Date().toISOString() };
	}
	if (status === "Failed") return { status: "failed", error: result.error || "Failed on server" };
	return { status: "uploaded", error: null };
}

let syncing = null;
let syncTimer = null;
const listeners = new Set();

export function onQueueSynced(fn) {
	listeners.add(fn);
	return () => listeners.delete(fn);
}

/** Upload pending invoices and poll the ones the server is still processing. */
export function syncQueue({ batchSize = 20 } = {}) {
	if (syncing) return syncing;
	syncing = (async () => {
		queueState.syncing = true;
		const changed = [];
		try {
			// 1) upload pending, oldest first, in batches
			for (;;) {
				if (!network.isOnline) break;
				const pending = (await db().getAllFromIndex("invoices", "status", "pending")).sort((a, b) =>
					a.created_on < b.created_on ? -1 : 1
				);
				if (!pending.length) break;
				const batch = pending.slice(0, Math.max(1, batchSize));
				const payload = batch.map((r) => ({
					offline_id: r.offline_id,
					invoice: r.invoice,
					data: r.data,
					created_on: r.created_local,
					pos_profile: r.pos_profile,
					pos_opening_shift: r.pos_opening_shift,
					grand_total: r.grand_total,
					offline_customer: r.offline_customer,
				}));
				let results;
				try {
					results = await serverCall(`${API}.upload_offline_invoices`, { invoices: payload }, { timeout: 180000 });
				} catch (e) {
					if (e instanceof NetworkError) throw e;
					// whole request rejected (permission, payload): mark batch failed
					for (const r of batch) {
						await update(r.offline_id, { status: "failed", error: e.message, attempts: (r.attempts || 0) + 1 });
					}
					queueState.lastError = e.message;
					break;
				}
				const byId = new Map((results || []).map((x) => [x.offline_id, x]));
				for (const r of batch) {
					const res = byId.get(r.offline_id);
					if (!res) continue;
					const patch = applyResult(r, res);
					patch.attempts = (r.attempts || 0) + 1;
					await update(r.offline_id, patch);
					changed.push({ ...r, ...patch });
				}
				await refreshCounts();
				if (batch.length < batchSize) break;
			}
			// 2) poll invoices the server queued for background processing
			if (network.isOnline) {
				const uploaded = await db().getAllFromIndex("invoices", "status", "uploaded");
				for (let i = 0; i < uploaded.length; i += 100) {
					const ids = uploaded.slice(i, i + 100).map((r) => r.offline_id);
					const res = await serverCall(`${API}.get_offline_invoice_status`, { offline_ids: ids });
					const byId = new Map((res || []).map((x) => [x.offline_id, x]));
					for (const r of uploaded.slice(i, i + 100)) {
						const x = byId.get(r.offline_id);
						if (!x) {
							// server lost it (should not happen): upload again
							await update(r.offline_id, { status: "pending" });
							continue;
						}
						const patch = applyResult(r, x);
						if (patch.status !== "uploaded") {
							await update(r.offline_id, patch);
							changed.push({ ...r, ...patch });
						}
					}
				}
			}
			queueState.lastSync = new Date().toISOString();
			queueState.lastError = null;
			await log("sync", { changed: changed.length });
		} catch (e) {
			queueState.lastError = e.message || String(e);
			await log("sync-error", queueState.lastError);
		} finally {
			await refreshCounts();
			queueState.syncing = false;
			syncing = null;
			if (changed.length) for (const fn of listeners) fn(changed);
			if (queueState.pending || queueState.uploaded) scheduleSync(network.isOnline ? 15000 : 30000);
		}
		return changed;
	})();
	return syncing;
}

export function scheduleSync(delay = 5000) {
	if (syncTimer) clearTimeout(syncTimer);
	syncTimer = setTimeout(() => {
		syncTimer = null;
		if (network.isOnline) syncQueue(syncOptions);
		else scheduleSync(30000);
	}, delay);
}

let syncOptions = {};
let started = false;
export function startQueue(options = {}) {
	syncOptions = options;
	if (started) return;
	started = true;
	onConnectivityChange((online) => {
		if (online) scheduleSync(1000);
	});
	refreshCounts().then(() => {
		if (queueState.pending || queueState.uploaded) scheduleSync(3000);
	});
	purgeSynced(14).catch(() => {});
}

export async function retryInvoice(offlineId) {
	await update(offlineId, { status: "pending", error: null });
	await refreshCounts();
	scheduleSync(500);
}

export async function retryAllFailed() {
	const failed = await db().getAllFromIndex("invoices", "status", "failed");
	for (const r of failed) await update(r.offline_id, { status: "pending", error: null });
	await refreshCounts();
	scheduleSync(500);
	return failed.length;
}

/** Remove a failed invoice from the queue (after it was entered manually). */
export async function discardInvoice(offlineId) {
	const row = await db().get("invoices", offlineId);
	if (!row || row.status === "synced" || row.status === "uploaded") return false;
	await update(offlineId, { status: "discarded", discarded_on: new Date().toISOString() });
	await log("discarded", offlineId);
	await refreshCounts();
	return true;
}

/** Keep synced invoices `days` for reprints, then drop them. */
export async function purgeSynced(days = 14) {
	const limit = new Date(Date.now() - days * 86400000).toISOString();
	const synced = await db().getAllFromIndex("invoices", "status", "synced");
	const old = synced.filter((r) => (r.synced_on || r.created_on) < limit).map((r) => r.offline_id);
	if (old.length) await db().bulk("invoices", [], old);
	return old.length;
}

/** Download the queue as JSON (support / manual recovery). */
export async function exportQueue(statuses = ["pending", "uploaded", "failed"]) {
	const rows = [];
	for (const s of statuses) rows.push(...(await db().getAllFromIndex("invoices", "status", s)));
	const blob = new Blob([JSON.stringify({ exported_on: new Date().toISOString(), site: location.host, invoices: rows }, null, 1)], {
		type: "application/json",
	});
	const a = document.createElement("a");
	a.href = URL.createObjectURL(blob);
	a.download = `posawesome-offline-invoices-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
	document.body.appendChild(a);
	a.click();
	setTimeout(() => {
		URL.revokeObjectURL(a.href);
		a.remove();
	}, 1000);
	return rows.length;
}

export async function shiftHasPending(openingShift) {
	const rows = await db().getAllFromIndex("invoices", "pos_opening_shift", openingShift);
	return rows.filter((r) => ["pending", "uploaded", "failed"].includes(r.status));
}
