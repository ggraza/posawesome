// Drafts and held carts while the server is unreachable.
//
// * drafts: every time the POS lists the shift's drafts (or saves one) online,
//   the complete documents (all item rows, with item_code, uom, rate, batch...)
//   are copied here, so Resume still shows them when the connection drops.
// * holds:  a cart put on hold while offline. When the server is back it is
//   saved as a server draft (update_invoice), into the same draft when it was
//   one, matched by the sale id: never a second draft.
//
// A sale is identified by its sale id (posa_offline_id) from the first save
// on; the server uses it to find the one invoice of the sale (see
// posapp.resolve_sale_draft and offline._sale_draft).

import { queueDatabase } from "./db";
import { network, serverCall, NetworkError, ServerError } from "./network";

const db = () => queueDatabase();
const clone = (o) => JSON.parse(JSON.stringify(o));
const UPDATE_INVOICE = "posawesome.posawesome.api.posapp.update_invoice";

export const isLocalName = (name) => !name || String(name).startsWith("OFL-");

function shiftOf(doc) {
	return doc && (doc.posa_pos_opening_shift || doc.pos_opening_shift);
}

/** The shift's drafts as the server listed them (full docs). Replaces the copy. */
export async function saveShiftDrafts(shift, docs) {
	if (!shift || !Array.isArray(docs)) return;
	const keep = [];
	for (const d of docs) {
		if (!d || !d.name || Number(d.docstatus) !== 0) continue;
		keep.push({ ...clone(d), shift, cached_at: Date.now() });
	}
	const current = await db().getAll("drafts");
	const names = new Set(keep.map((d) => d.name));
	// drafts of this shift no longer on the server, and drafts of older shifts
	const gone = current.filter((d) => d.shift !== shift || !names.has(d.name)).map((d) => d.name);
	await db().bulk("drafts", keep, gone);
}

/** A draft just saved online (hold, payment screen...): keep the copy current. */
export async function upsertDraft(doc) {
	if (!doc || isLocalName(doc.name) || Number(doc.docstatus) !== 0 || doc.__offline) return;
	if (Number(doc.posa_is_printed)) return; // being paid: not a draft for Resume
	const shift = shiftOf(doc);
	if (!shift) return;
	await db().put("drafts", { ...clone(doc), shift, cached_at: Date.now() });
}

/** The sale was completed (online or queued offline): drop its draft / hold copies. */
export async function forgetSale({ name = null, saleId = null } = {}) {
	const deletes = [];
	if (name && !isLocalName(name)) deletes.push(name);
	if (saleId) {
		for (const d of await db().getAll("drafts")) if (d.posa_offline_id === saleId) deletes.push(d.name);
		await db().delete("holds", saleId).catch(() => {});
	}
	if (deletes.length) await db().bulk("drafts", [], deletes);
}

/** Put a cart on hold on this terminal (server unreachable). */
export async function holdCart(doc) {
	const saleId = doc.posa_offline_id;
	if (!saleId) throw new Error("hold without sale id");
	const copy = clone(doc);
	for (const row of copy.items || []) {
		delete row.serial_no_data;
		delete row.batch_no_data;
		delete row.uom_prices;
	}
	await db().put("holds", {
		sale_id: saleId,
		shift: shiftOf(doc),
		held_on: new Date().toISOString(),
		doc: copy,
		error: null,
	});
}

/** The cashier resumed a hold: the cart is live again (holding again re-adds it). */
export async function releaseHold(saleId) {
	if (saleId) await db().delete("holds", saleId).catch(() => {});
}

export async function listHolds(shift = null) {
	const rows = await db().getAll("holds");
	return rows.filter((h) => !shift || h.shift === shift);
}

/** Sale ids and draft names that are no longer open drafts on this terminal. */
async function taken() {
	const ids = new Set();
	const names = new Set();
	for (const h of await db().getAll("holds")) {
		ids.add(h.sale_id);
		if (h.doc && !isLocalName(h.doc.name)) names.add(h.doc.name);
	}
	for (const r of await db().getAll("invoices")) {
		if (r.status === "discarded") continue;
		const inv = r.invoice || {};
		if (inv.posa_offline_id) ids.add(inv.posa_offline_id);
		if (inv.posa_draft_name) names.add(inv.posa_draft_name);
	}
	return { ids, names };
}

/**
 * Rows for the Resume (drafts) dialog.
 * serverRows given (online): store them, list them minus sales held / sold on
 * this terminal, plus this terminal's holds. serverRows null (offline): the copy.
 */
export async function draftList(shift, serverRows = null) {
	if (Array.isArray(serverRows)) await saveShiftDrafts(shift, serverRows).catch(() => {});
	const { ids, names } = await taken();
	const holds = (await listHolds(shift)).map((h) => ({
		...h.doc,
		__hold: 1,
		__held_on: h.held_on,
		__hold_error: h.error,
	}));
	const source = Array.isArray(serverRows) ? serverRows : await db().getAllFromIndex("drafts", "shift", shift);
	const drafts = source
		.filter((d) => !names.has(d.name) && !(d.posa_offline_id && ids.has(d.posa_offline_id)))
		.map((d) => {
			const { shift: _s, cached_at: _c, ...doc } = d;
			return doc;
		})
		.sort((a, b) => String(b.modified || "").localeCompare(String(a.modified || "")));
	return holds.concat(drafts);
}

export async function draftCount(shift) {
	return (await draftList(shift)).length;
}

let uploading = null;

/** Save the carts held offline as server drafts (called when back online). */
export function uploadHolds() {
	if (uploading) return uploading;
	uploading = (async () => {
		let saved = 0;
		for (const h of await db().getAll("holds")) {
			if (!network.isOnline) break;
			const doc = clone(h.doc);
			delete doc.__offline;
			delete doc.__hold;
			if (isLocalName(doc.name)) delete doc.name;
			try {
				const serverDoc = await serverCall(UPDATE_INVOICE, { data: doc });
				await db().delete("holds", h.sale_id);
				if (serverDoc) await upsertDraft(serverDoc);
				saved++;
			} catch (e) {
				if (e instanceof NetworkError) break;
				if (e instanceof ServerError && /already completed/i.test(e.message || "")) {
					// the sale was paid meanwhile (offline queue / another terminal): nothing to hold
					await db().delete("holds", h.sale_id);
					continue;
				}
				await db().put("holds", { ...h, error: (e && e.message) || String(e) });
			}
		}
		return saved;
	})().finally(() => {
		uploading = null;
	});
	return uploading;
}
