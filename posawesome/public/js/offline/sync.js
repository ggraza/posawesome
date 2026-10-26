// Catalogue synchronisation (server -> IndexedDB -> memory).
//
// First run downloads everything page by page (keyset pagination on
// modified,name); later runs only ask for rows modified after the stored cursor,
// plus the Deleted Document log. A sync can be interrupted at any time (page
// reload, network loss) and resumes from the last stored cursor.
import { reactive } from "vue";
import { catalog } from "./catalog";
import { network, serverCall, NetworkError } from "./network";

export const syncState = reactive({
	running: false,
	stage: "",
	done: 0,
	total: 0,
	error: null,
	lastFullSync: null,
	lastDeltaSync: null,
	itemsCount: 0,
	pricesCount: 0,
	customersCount: 0,
});

const PAGE = { items: 1000, prices: 2000, stock: 5000, customers: 2000 };
const API = "posawesome.posawesome.api.offline";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let current = null;

function priceListKey(lists) {
	return "cursor_prices__" + [...lists].sort().join("|");
}

async function pull(resource, method, args, apply, progressTotal) {
	const cursorKey = args.cursorKey || `cursor_${resource}`;
	let cursor = catalog.getMeta(cursorKey);
	let pages = 0;
	syncState.stage = resource;
	syncState.done = 0;
	syncState.total = progressTotal || 0;
	for (;;) {
		const page = await serverCall(
			`${API}.${method}`,
			{
				pos_profile: catalog.profileName,
				since: cursor ? cursor.since : null,
				after: cursor ? cursor.after : null,
				limit: PAGE[resource],
				...(args.extra || {}),
			},
			{ timeout: 120000 }
		);
		if (page.rows && page.rows.length) await apply(page.rows);
		if (page.cursor) {
			cursor = page.cursor;
			await catalog.setMeta(cursorKey, cursor);
		}
		syncState.done += page.rows ? page.rows.length : 0;
		pages++;
		if (page.done || !page.rows || !page.rows.length) break;
		await sleep(30); // let the UI breathe between pages
	}
	return pages;
}

/**
 * Run a sync. `full` forgets cursors and downloads everything again.
 * Concurrent calls share the running promise.
 */
export function syncCatalog(profile, { full = false, includeStock = true, includeCustomers = true } = {}) {
	if (current) return current;
	current = (async () => {
		syncState.running = true;
		syncState.error = null;
		try {
			await catalog.open(profile.name);
			if (!catalog.loaded) await catalog.load(profile.name);
			catalog.setProfile(profile);
			if (full) {
				for (const key of Object.keys(catalog.meta)) {
					if (key.startsWith("cursor_")) await catalog.setMeta(key, null);
				}
			}
			const isFirst = !catalog.getMeta("cursor_items");
			let counts = {};
			if (isFirst) {
				try {
					counts = await serverCall(`${API}.get_catalog_counts`, { pos_profile: profile.name });
				} catch (e) {
					if (e instanceof NetworkError) throw e;
				}
			}

			syncState.stage = "settings";
			const bootstrap = await serverCall(`${API}.get_bootstrap`, { pos_profile: profile.name }, { timeout: 60000 });
			const startedAt = bootstrap.server_time;
			await catalog.setMeta("bootstrap", bootstrap);

			await pull("items", "get_items_page", {}, (rows) => catalog.applyItems(rows), counts.items);

			const lists = new Set([profile.selling_price_list]);
			if (profile.posa_mrp_price_list) lists.add(profile.posa_mrp_price_list);
			for (const c of catalog.customers) if (c.default_price_list) lists.add(c.default_price_list);
			lists.delete(undefined);
			lists.delete(null);
			await pull(
				"prices",
				"get_prices_page",
				{ cursorKey: priceListKey(lists), extra: { price_lists: [...lists] } },
				(rows) => catalog.applyPrices(rows),
				counts.prices
			);

			if (includeStock) {
				await pull("stock", "get_stock_page", {}, (rows) => catalog.applyStock(rows), counts.stock);
			}
			if (includeCustomers) {
				await pull("customers", "get_customers_page", {}, (rows) => catalog.applyCustomers(rows), counts.customers);
			}

			// deletions since the previous sync
			const deletedSince = catalog.getMeta("deleted_since");
			if (deletedSince && !isFirst) {
				syncState.stage = "deletions";
				const deleted = await serverCall(`${API}.get_deleted_documents`, { since: deletedSince });
				if (deleted && deleted.length) await catalog.applyDeleted(deleted);
			}
			await catalog.setMeta("deleted_since", startedAt);

			const now = new Date().toISOString();
			// also covers a first download that was interrupted and resumed later
			if (isFirst || full || !catalog.getMeta("last_full_sync")) {
				syncState.lastFullSync = now;
				await catalog.setMeta("last_full_sync", now);
			}
			syncState.lastDeltaSync = now;
			await catalog.setMeta("last_sync", now);
			syncState.itemsCount = catalog.byCode.size;
			syncState.pricesCount = catalog.priceByName.size;
			syncState.customersCount = catalog.customerByName.size;
			syncState.stage = "done";
			return true;
		} catch (e) {
			syncState.error = e.message || String(e);
			syncState.stage = "error";
			console.warn("[posawesome] catalogue sync stopped:", e);
			return false;
		} finally {
			syncState.running = false;
			current = null;
		}
	})();
	return current;
}

let timer = null;

/** Background delta sync every `minutes` while online. */
export function startPeriodicSync(profile, minutes = 10, options = {}) {
	stopPeriodicSync();
	const interval = Math.max(1, Number(minutes) || 10) * 60000;
	const tick = async () => {
		if (network.isOnline && !document.hidden) await syncCatalog(profile, options);
		timer = setTimeout(tick, interval);
	};
	timer = setTimeout(tick, interval);
}

export function stopPeriodicSync() {
	if (timer) clearTimeout(timer);
	timer = null;
}

export function catalogAgeDays() {
	const last = catalog.getMeta("last_sync");
	if (!last) return Infinity;
	return (Date.now() - new Date(last).getTime()) / 86400000;
}
