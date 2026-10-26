// Facade used by the POS components.
//
//   offlinePos.enabled          POS Profile has "Enable Offline Mode"
//   offlinePos.useOffline()     enabled and the server is not reachable now
//   offlinePos.init(data)       on register_pos_profile: load cache, start sync
//
// Item lookups always come from the local catalogue when offline mode is enabled
// (fast with 30k+ items); invoices only go to the local queue when the server
// cannot be reached, so online behaviour (drafts, kitchen tickets, FBR...) is
// unchanged.
import { markRaw, reactive } from "vue";
import { catalog } from "./catalog";
import { network, startConnectivityMonitor, onConnectivityChange, setForcedOffline, ping } from "./network";
import { syncCatalog, startPeriodicSync, syncState, catalogAgeDays } from "./sync";
import {
	enqueueInvoice,
	startQueue,
	queueState,
	syncQueue,
	pendingStockQty,
	onQueueSynced,
	listInvoices,
	retryInvoice,
	retryAllFailed,
	discardInvoice,
	exportQueue,
	shiftHasPending,
	getInvoice,
} from "./queue";
import { calculateTaxesAndTotals, calculatePayments, itemTaxTemplateFor } from "./taxes";
import { requestPersistentStorage } from "./idb";
import { printOfflineReceipt } from "./receipt";

const LAST_OPENING_KEY = () => `posa_last_opening__${(frappe.boot && frappe.boot.sitename) || location.host}__${frappe.session.user}`;

export const offlineState = reactive({
	enabled: false,
	ready: false,
	loading: false,
	profile: null,
	network,
	sync: syncState,
	queue: queueState,
	catalogVersion: 0,
});

let posItemsCache = { key: null, list: null, byCode: null };

function bootstrap() {
	return catalog.getMeta("bootstrap") || {};
}

export const offlinePos = {
	state: offlineState,
	network,
	catalog,

	get enabled() {
		return offlineState.enabled;
	},

	/** true when the POS must work from the local cache right now */
	useOffline() {
		return offlineState.enabled && !network.isOnline;
	},

	/** true when items should come from the local catalogue: offline enabled and one
	 *  complete download finished (until then the online endpoints are used, so a
	 *  half-downloaded catalogue never shows items without prices or stock). */
	useLocalCatalog() {
		return offlineState.enabled && catalog.loaded && !!catalog.getMeta("last_full_sync");
	},

	/** Called with the payload of register_pos_profile. */
	async init(data) {
		const profile = data && data.pos_profile;
		if (!profile) return;
		offlineState.profile = profile;
		offlineState.enabled = !!Number(profile.posa_enable_offline);
		if (!offlineState.enabled) return;
		startConnectivityMonitor();
		requestPersistentStorage();
		try {
			localStorage.setItem(
				LAST_OPENING_KEY(),
				JSON.stringify({
					pos_profile: profile,
					pos_opening_shift: data.pos_opening_shift,
					company: data.company,
					stock_settings: data.stock_settings,
					saved_on: new Date().toISOString(),
				})
			);
		} catch (e) {
			console.warn("[posawesome] could not cache opening data", e);
		}
		offlineState.loading = true;
		try {
			await catalog.open(profile.name);
			catalog.setProfile(profile);
			await catalog.load(profile.name);
			await this.refreshPendingStock();
			offlineState.ready = catalog.loaded;
			offlineState.catalogVersion = catalog.version;
		} finally {
			offlineState.loading = false;
		}
		const options = {
			includeStock: profile.posa_offline_sync_stock === undefined ? true : !!Number(profile.posa_offline_sync_stock),
			includeCustomers:
				profile.posa_offline_sync_customers === undefined ? true : !!Number(profile.posa_offline_sync_customers),
		};
		startQueue({ batchSize: Number(profile.posa_offline_invoice_batch) || 20 });
		onQueueSynced(() => this.refreshPendingStock());
		if (network.isOnline) {
			// never block the POS start: until the first download finishes the
			// item list keeps coming from the server (online mode)
			syncCatalog(profile, options).then(() => {
				offlineState.ready = catalog.loaded;
				posItemsCache.key = null;
				offlineState.catalogVersion = catalog.version;
			});
		}
		startPeriodicSync(profile, Number(profile.posa_offline_sync_interval) || 10, options);
		onConnectivityChange((online) => {
			if (online) syncCatalog(profile, options).then(() => (offlineState.catalogVersion = catalog.version));
		});
	},

	/** Opening data saved by the last online start (for starting while offline). */
	lastOpeningData() {
		try {
			const raw = localStorage.getItem(LAST_OPENING_KEY());
			return raw ? JSON.parse(raw) : null;
		} catch (e) {
			return null;
		}
	},

	async refreshPendingStock() {
		catalog.setPendingQty(await pendingStockQty());
		posItemsCache.key = null;
		offlineState.catalogVersion = catalog.version;
	},

	syncNow(full = false) {
		const profile = offlineState.profile;
		if (!profile) return Promise.resolve(false);
		posItemsCache.key = null;
		// manual sync: re-check the server first instead of waiting for the next poll
		return ping().then(() => Promise.all([syncCatalog(profile, { full }), syncQueue()])).then(() => {
			offlineState.catalogVersion = catalog.version;
		});
	},

	catalogAgeDays,
	setForcedOffline,

	// ------------------------------------------------------------------ items
	/** Full item list in the shape get_items() returned (cached per price list). */
	posItems({ priceList, customer } = {}) {
		const profile = offlineState.profile || {};
		const pl = priceList || profile.selling_price_list;
		const key = `${pl}|${customer || ""}|${catalog.version}`;
		if (posItemsCache.key === key) return posItemsCache.list;
		const opts = {
			priceList: pl,
			customer,
			mrpPriceList: profile.posa_allow_display_mrp ? profile.posa_mrp_price_list : null,
			currency: profile.currency,
		};
		const hideNoStock = !!Number(profile.posa_display_items_in_stock);
		const list = [];
		const byCode = new Map();
		for (const it of catalog.items) {
			const row = catalog.toPosItem(it, opts);
			if (hideNoStock && row.is_stock_item && row.actual_qty <= 0) continue;
			markRaw(row);
			list.push(row);
			byCode.set(row.item_code, row);
		}
		posItemsCache = { key, list: markRaw(list), byCode };
		return posItemsCache.list;
	},

	/** Ranked search over the catalogue, returning POS item rows. */
	searchItems(text, { group, limit = 50, priceList, customer, hideVariants } = {}) {
		const profile = offlineState.profile || {};
		this.posItems({ priceList, customer });
		const byCode = posItemsCache.byCode;
		const hits = catalog.search(text, {
			group,
			limit: limit * 2,
			hideVariants,
			inStockOnly: !!Number(profile.posa_display_items_in_stock),
		});
		const out = [];
		for (const it of hits) {
			const row = byCode.get(it.item_code);
			if (row) out.push(row);
			if (out.length >= limit) break;
		}
		return out;
	},

	/**
	 * Resolve a scan: barcode, scale barcode or item code.
	 * Returns a POS item row ready for add_item (qty / uom / rate applied) or null.
	 */
	scan(code, { priceList, customer } = {}) {
		const hit = catalog.lookupCode(code);
		if (!hit) return null;
		this.posItems({ priceList, customer });
		const base = posItemsCache.byCode.get(hit.item.item_code);
		if (!base) return null;
		const row = { ...base };
		if (hit.uom && hit.uom !== row.stock_uom) {
			row.uom = hit.uom;
			const price = catalog.getPrice(row.item_code, {
				priceList: priceList || (offlineState.profile || {}).selling_price_list,
				uom: hit.uom,
				customer,
			});
			if (price) row.rate = row.price_list_rate = price.price_list_rate;
		}
		if (hit.match === "scale") {
			row.posa_scale_barcode = hit.barcode;
			if (hit.qty !== undefined) row.qty = hit.qty;
			if (hit.amount !== undefined) {
				const rate = Number(row.rate) || 0;
				if (rate > 0) row.qty = Math.round((hit.amount / rate) * 1000) / 1000;
				else {
					row.qty = 1;
					row.rate = row.price_list_rate = hit.amount;
					row.posa_custom_rate = 1;
				}
			}
		}
		row.posa_scanned_barcode = hit.barcode || null;
		row.posa_scan_match = hit.match;
		return row;
	},

	/** Same fields get_item_detail() returns, computed locally. */
	itemDetail(args) {
		const item = catalog.getItem(args.item_code);
		if (!item) return null;
		const uom = args.uom || item.stock_uom;
		const cf = catalog.conversionFactor(item, uom);
		const price = catalog.getPrice(item.item_code, {
			priceList: args.price_list || args.selling_price_list,
			uom,
			customer: args.customer,
			batchNo: args.batch_no,
		});
		const stock = catalog.stockRow(item.item_code) || {};
		const qty = Number(args.qty) || 1;
		return {
			item_code: item.item_code,
			item_name: item.item_name,
			price_list_rate: price ? price.price_list_rate : Number(args.price_list_rate) || 0,
			conversion_factor: cf,
			stock_qty: qty * cf,
			actual_qty: catalog.availableQty(item.item_code),
			projected_qty: Number(stock.projected_qty) || 0,
			reserved_qty: Number(stock.reserved_qty) || 0,
			last_purchase_rate: 0,
			stock_uom: item.stock_uom,
			has_batch_no: item.has_batch_no,
			has_serial_no: item.has_serial_no,
			max_discount: item.max_discount,
			batch_no_data: item.batch_no_data || [],
			item_tax_template: itemTaxTemplateFor({}, item, args.posting_date),
			has_pricing_rule: 0,
			_offline: 1,
		};
	},

	/** What get_items_details() returns for the given cart rows. */
	itemsDetails(items) {
		return items.map((row) => {
			const item = catalog.getItem(row.item_code) || {};
			return {
				...row,
				item_uoms: item.item_uoms || [{ uom: row.stock_uom, conversion_factor: 1 }],
				serial_no_data: row.serial_no_data || [],
				batch_no_data: item.batch_no_data || row.batch_no_data || [],
				actual_qty: catalog.availableQty(row.item_code),
				has_batch_no: item.has_batch_no ?? row.has_batch_no,
				has_serial_no: item.has_serial_no ?? row.has_serial_no,
			};
		});
	},

	customers() {
		return catalog.customers;
	},

	customerInfo(name) {
		const c = catalog.customerByName.get(name);
		if (!c) return null;
		return {
			name: c.name,
			customer_name: c.customer_name,
			email_id: c.email_id,
			mobile_no: c.mobile_no,
			tax_id: c.tax_id,
			customer_group: c.customer_group,
			territory: c.territory,
			customer_price_list: c.default_price_list,
			customer_group_price_list: null,
			loyalty_program: c.loyalty_program,
			loyalty_points: null,
			conversion_factor: null,
			posa_discount: c.posa_discount,
			_offline: 1,
		};
	},

	/** A customer created while offline; synced together with its invoices. */
	async addOfflineCustomer(data) {
		const name = data.customer_name;
		const row = {
			name,
			customer_name: data.customer_name,
			mobile_no: data.mobile_no,
			email_id: data.email_id,
			tax_id: data.tax_id,
			customer_group: data.customer_group,
			territory: data.territory,
			__offline: 1,
			modified: new Date().toISOString(),
		};
		await catalog.applyCustomers([row]);
		return row;
	},

	// --------------------------------------------------------------- invoices
	/**
	 * Local replacement for update_invoice(): returns the invoice doc with totals,
	 * taxes and payment rows the Payments component expects.
	 */
	buildInvoice(doc, { conditionalTax = null } = {}) {
		const b = bootstrap();
		const profile = offlineState.profile || b.pos_profile || {};
		const precision = b.precision || {};
		const out = JSON.parse(JSON.stringify(doc));
		out.doctype = "Sales Invoice";
		out.name = out.name || out.posa_offline_id || null;
		out.__offline = 1;
		out.docstatus = 0;
		out.company = out.company || profile.company;
		out.currency = out.currency || profile.currency;
		out.conversion_rate = 1;
		out.plc_conversion_rate = 1;
		out.selling_price_list = out.selling_price_list || profile.selling_price_list;
		out.set_warehouse = profile.warehouse;
		out.update_stock = out.posa_delivery_date ? 0 : profile.update_stock === undefined ? 1 : Number(profile.update_stock);
		out.apply_discount_on = profile.apply_discount_on || "Grand Total";
		out.posting_date = out.posting_date || frappe.datetime.nowdate();
		out.posting_time = frappe.datetime.now_time();
		out.customer_name =
			(catalog.customerByName.get(out.customer) || {}).customer_name || out.customer_name || out.customer;

		// items
		for (const row of out.items || []) {
			const item = catalog.getItem(row.item_code) || {};
			row.item_name = row.item_name || item.item_name;
			row.stock_uom = row.stock_uom || item.stock_uom;
			row.uom = row.uom || item.stock_uom;
			row.conversion_factor = Number(row.conversion_factor) || catalog.conversionFactor(item, row.uom);
			row.stock_qty = (Number(row.qty) || 0) * row.conversion_factor;
			row.warehouse = profile.warehouse;
			row.cost_center = profile.cost_center;
			row.item_tax_template = itemTaxTemplateFor(row, item, out.posting_date);
			row.is_stock_item = item.is_stock_item;
		}

		// taxes: same rules as invoice.apply_conditional_tax() + delivery charges
		const useCard = conditionalTax === "card" || out.posa_conditional_tax_applied;
		const template = useCard && profile.posa_card_taxes_and_charges ? profile.posa_card_taxes_and_charges : profile.taxes_and_charges;
		const rows = ((b.tax_templates || {})[template] || []).map((t) => ({ ...t }));
		if (Number(profile.posa_tax_inclusive)) rows.forEach((t) => (t.included_in_print_rate = 1));
		if (b.accounts_settings && Number(b.accounts_settings.add_taxes_from_item_tax_template)) {
			for (const row of out.items || []) {
				const map = (b.item_tax_templates || {})[row.item_tax_template] || {};
				for (const account of Object.keys(map)) {
					if (!rows.some((t) => t.account_head === account)) {
						rows.push({ charge_type: "On Net Total", account_head: account, description: account.split(" - ")[0], rate: 0 });
					}
				}
			}
		}
		if (out.posa_delivery_charges && Number(out.posa_delivery_charges_rate)) {
			const dc = (b.delivery_charges || []).find((d) => d.name === out.posa_delivery_charges) || {};
			rows.push({
				charge_type: "Actual",
				description: out.posa_delivery_charges,
				tax_amount: Number(out.posa_delivery_charges_rate),
				account_head: dc.shipping_account,
				cost_center: dc.cost_center,
			});
		}
		out.taxes_and_charges = template || null;
		out.taxes = rows;

		calculateTaxesAndTotals(out, {
			currencyPrecision: precision.currency ?? 2,
			floatPrecision: precision.float ?? 3,
			smallestFraction: (b.currency || {}).smallest_currency_fraction_value || 0,
			disableRoundedTotal: !!b.disable_rounded_total,
			itemTaxTemplates: b.item_tax_templates || {},
		});

		// payment rows like set_missing_values(): mode, type, account, idx
		const methods = b.payments && b.payments.length ? b.payments : (profile.payments || []).map((p) => ({ ...p }));
		const existing = out.payments || [];
		out.payments = methods.map((m, i) => {
			const prev = existing.find((p) => p.mode_of_payment === m.mode_of_payment) || {};
			return {
				idx: i + 1,
				mode_of_payment: m.mode_of_payment,
				type: m.type || prev.type || "Cash",
				account: m.account || prev.account || "",
				default: m.default,
				amount: Number(prev.amount) || 0,
				base_amount: Number(prev.amount) || 0,
			};
		});
		out.loyalty_amount = Number(out.loyalty_amount) || 0;
		calculatePayments(out, { currencyPrecision: precision.currency ?? 2 });
		return out;
	},

	/** Queue the invoice (offline submit). Returns the queued record. */
	async submitInvoice(invoiceDoc, data, { print = false } = {}) {
		const doc = JSON.parse(JSON.stringify(invoiceDoc));
		calculatePayments(doc, { currencyPrecision: (bootstrap().precision || {}).currency ?? 2 });
		const customer = catalog.customerByName.get(doc.customer);
		const offlineCustomer = customer && customer.__offline ? { ...customer } : null;
		// strip UI-only fields
		delete doc.__offline;
		delete doc.name;
		for (const row of doc.items || []) {
			for (const k of Object.keys(row)) if (k.startsWith("_")) delete row[k];
			delete row.serial_no_data;
			delete row.batch_no_data;
			delete row.item_uoms;
			delete row.uom_prices;
			delete row.item_barcode;
		}
		const record = await enqueueInvoice({ invoice: doc, data, offlineCustomer });
		// incremental: a full rescan of the queue + catalogue rebuild per sale got slow
		// with 1000+ queued invoices (refreshPendingStock still runs after every sync)
		if (doc.update_stock) {
			const deltas = new Map();
			for (const it of doc.items || []) {
				const qty = (Number(it.qty) || 0) * (Number(it.conversion_factor) || 1);
				deltas.set(it.item_code, (deltas.get(it.item_code) || 0) + qty);
			}
			catalog.addPendingQty(deltas);
			if (posItemsCache.byCode) {
				for (const code of deltas.keys()) {
					const row = posItemsCache.byCode.get(code);
					if (row) row.actual_qty = catalog.availableQty(code);
				}
			}
		}
		if (print) this.print(record);
		return record;
	},

	print(record) {
		const b = bootstrap();
		return printOfflineReceipt(record, { company: b.company, profile: offlineState.profile || b.pos_profile });
	},

	// queue management (OfflineStatus panel)
	listInvoices,
	getInvoice,
	retryInvoice,
	retryAllFailed,
	discardInvoice,
	exportQueue,
	syncQueue,
	shiftHasPending,
};

if (typeof window !== "undefined") window.posa_offline = offlinePos; // console access for support
export default offlinePos;
