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

const DELTA_OVERLAP_SECONDS = 120;

/** "YYYY-MM-DD HH:MM:SS[.ffffff]" (server time, no zone) moved by `seconds`. */
export function shiftTimestamp(value, seconds) {
	const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(String(value));
	if (!m) return value;
	const t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) + seconds * 1000);
	const p = (n) => String(n).padStart(2, "0");
	return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())} ${p(t.getUTCHours())}:${p(t.getUTCMinutes())}:${p(t.getUTCSeconds())}`;
}

async function pull(resource, method, args, apply, progressTotal) {
	const cursorKey = args.cursorKey || `cursor_${resource}`;
	let cursor = catalog.getMeta(cursorKey);
	// Delta pulls re-read the last couple of minutes: a row saved in a
	// transaction that committed late carries an older `modified` than rows
	// already pulled, and a plain cursor would skip it. Re-applying is harmless.
	if (cursor && cursor.since) cursor = { since: shiftTimestamp(cursor.since, -DELTA_OVERLAP_SECONDS), after: "" };
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

			// the profile's item groups / template setting / customer groups changed:
			// download those tables again from the start, then drop rows that are no
			// longer in scope (no empty window: rows are replaced as pages arrive)
			const scope = bootstrap.scope || null;
			const prevScope = catalog.getMeta("scope");
			const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
			const refreshItems =
				!isFirst && scope && prevScope &&
				!same([prevScope.item_groups, prevScope.show_template_items], [scope.item_groups, scope.show_template_items]);
			const refreshCustomers = !isFirst && scope && prevScope && !same(prevScope.customer_groups, scope.customer_groups);
			if (refreshItems) await catalog.setMeta("cursor_items", null);
			if (refreshCustomers) await catalog.setMeta("cursor_customers", null);

			const seenItems = refreshItems ? new Set() : null;
			await pull(
				"items",
				"get_items_page",
				{},
				(rows) => {
					if (seenItems) for (const r of rows) if (!r.deleted) seenItems.add(r.item_code);
					return catalog.applyItems(rows);
				},
				counts.items
			);
			if (seenItems) await catalog.pruneItems(seenItems);

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
				const seenCustomers = refreshCustomers ? new Set() : null;
				await pull(
					"customers",
					"get_customers_page",
					{},
					(rows) => {
						if (seenCustomers) for (const r of rows) if (!r.deleted) seenCustomers.add(r.name);
						return catalog.applyCustomers(rows);
					},
					counts.customers
				);
				if (seenCustomers) await catalog.pruneCustomers(seenCustomers);
			}
			if (scope) await catalog.setMeta("scope", scope);

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
export function startPeriodicSync(profile, minutes = 10, options = {}, onDone = null) {
	stopPeriodicSync();
	const interval = Math.max(1, Number(minutes) || 10) * 60000;
	const tick = async () => {
		if (network.isOnline && !document.hidden) {
			const ok = await syncCatalog(profile, options);
			if (onDone) onDone(ok);
		}
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
