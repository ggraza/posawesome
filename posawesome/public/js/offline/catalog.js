// In-memory catalogue for fast lookups over 30,000+ items.
//
// Rows live in IndexedDB; on start they are loaded once into plain (non reactive,
// markRaw'd) arrays/maps. Barcode and item code lookups are O(1); text search is a
// single pass over pre-lowercased haystacks with ranking, which takes a few ms for
// 30k items. Only the (≤ limit) results ever reach Vue's reactivity.
import { markRaw } from "vue";
import { catalogDb } from "./db";
import { parseScaleBarcode, scaleConfig, stripPrefix } from "./scale";

const today = () => (window.frappe && frappe.datetime ? frappe.datetime.nowdate() : new Date().toISOString().slice(0, 10));

function lower(s) {
	return (s || "").toString().toLowerCase();
}

export class Catalog {
	constructor() {
		this.profileName = null;
		this.profile = null;
		this.db = null;
		this.reset();
	}

	reset() {
		this._items = markRaw([]);
		this._itemsDirty = false;
		this.byCode = new Map();
		this.byBarcode = new Map(); // barcode -> { item_code, uom }
		this.prices = new Map(); // item_code -> [price rows]
		this.priceByName = new Map(); // Item Price name -> row (for deletes)
		this.stock = new Map(); // item_code -> { actual_qty, valuation_rate, ... }
		this.pendingQty = new Map(); // item_code -> stock qty sold offline but not synced
		this._customers = markRaw([]);
		this._customersDirty = false;
		this.customerByName = new Map();
		this.meta = {};
		this.loaded = false;
		this.version = 0; // bumps on every change so UIs can refresh cheaply
	}

	/** Items sorted by name. Rebuilt lazily after changes (O(n log n), ~30 ms for 30k). */
	get items() {
		if (this._itemsDirty) {
			const list = Array.from(this.byCode.values());
			list.sort((a, b) => (a._name < b._name ? -1 : a._name > b._name ? 1 : 0));
			this._items = markRaw(list);
			this._itemsDirty = false;
		}
		return this._items;
	}

	get customers() {
		if (this._customersDirty) {
			const list = Array.from(this.customerByName.values());
			list.sort((a, b) => String(a.customer_name || a.name).localeCompare(String(b.customer_name || b.name)));
			this._customers = markRaw(list);
			this._customersDirty = false;
		}
		return this._customers;
	}

	async open(profileName) {
		if (this.profileName !== profileName) {
			this.reset();
			this.profileName = profileName;
			this.db = catalogDb(profileName);
		}
		return this.db;
	}

	setProfile(profile) {
		this.profile = profile;
		this.scale = scaleConfig(profile || {});
	}

	/** Load everything from IndexedDB into memory. */
	async load(profileName) {
		await this.open(profileName);
		const t0 = performance.now();
		const [items, prices, stock, customers] = await Promise.all([
			this.db.getAll("items"),
			this.db.getAll("prices"),
			this.db.getAll("stock"),
			this.db.getAll("customers"),
		]);
		const metaRows = {};
		await this.db.each("meta", (value, key) => {
			metaRows[key] = value;
		});
		this.meta = metaRows;
		this.byCode.clear();
		this.byBarcode.clear();
		for (const it of items) this._indexItem(it);
		this.prices.clear();
		this.priceByName.clear();
		for (const p of prices) this._indexPrice(p);
		this.stock.clear();
		for (const s of stock) this.stock.set(s.item_code, s);
		this.customerByName.clear();
		for (const c of customers) this._indexCustomer(c);
		this.loaded = items.length > 0;
		this.version++;
		console.info(
			`[posawesome] offline catalogue loaded: ${items.length} items, ${prices.length} prices, ` +
				`${stock.length} stock rows, ${customers.length} customers in ${Math.round(performance.now() - t0)} ms`
		);
		return this.loaded;
	}

	// ------------------------------------------------------------------ indexing
	_prepare(it) {
		const codes = (it.item_barcode || []).map((b) => lower(b.barcode));
		it._hay = `${lower(it.item_code)} ${lower(it.item_name)} ${codes.join(" ")}`;
		it._name = lower(it.item_name);
		it._code = lower(it.item_code);
		it._group = lower(it.item_group);
		markRaw(it);
		return it;
	}

	_indexItem(it) {
		this._prepare(it);
		const existing = this.byCode.get(it.item_code);
		if (existing) {
			for (const b of existing.item_barcode || []) {
				const hit = this.byBarcode.get(b.barcode);
				if (hit && hit.item_code === it.item_code) this.byBarcode.delete(b.barcode);
			}
		}
		this.byCode.set(it.item_code, it);
		this._itemsDirty = true;
		for (const b of it.item_barcode || []) {
			if (b.barcode) this.byBarcode.set(String(b.barcode), { item_code: it.item_code, uom: b.posa_uom || b.uom });
		}
	}

	_removeItem(code) {
		const existing = this.byCode.get(code);
		if (!existing) return;
		this.byCode.delete(code);
		this._itemsDirty = true;
		for (const b of existing.item_barcode || []) {
			const hit = this.byBarcode.get(b.barcode);
			if (hit && hit.item_code === code) this.byBarcode.delete(b.barcode);
		}
	}

	_indexPrice(p) {
		const old = this.priceByName.get(p.name);
		if (old) this._removePrice(p.name);
		this.priceByName.set(p.name, p);
		if (!this.prices.has(p.item_code)) this.prices.set(p.item_code, []);
		this.prices.get(p.item_code).push(p);
	}

	_removePrice(name) {
		const old = this.priceByName.get(name);
		if (!old) return;
		this.priceByName.delete(name);
		const list = this.prices.get(old.item_code);
		if (list) {
			const i = list.indexOf(old);
			if (i >= 0) list.splice(i, 1);
		}
	}

	_indexCustomer(c) {
		this.customerByName.set(c.name, markRaw(c));
		this._customersDirty = true;
	}

	// ------------------------------------------------------------- write helpers
	async applyItems(rows) {
		const puts = [];
		const deletes = [];
		for (const r of rows) {
			if (r.deleted) {
				deletes.push(r.item_code);
				this._removeItem(r.item_code);
			} else {
				const clean = { ...r };
				puts.push(clean);
				this._indexItem({ ...clean });
			}
		}
		await this.db.bulk("items", puts, deletes);
		this.loaded = this.byCode.size > 0;
		this.version++;
	}

	async applyPrices(rows) {
		const puts = [];
		const deletes = [];
		for (const r of rows) {
			if (r.deleted) {
				deletes.push(r.name);
				this._removePrice(r.name);
			} else {
				puts.push(r);
				this._indexPrice(r);
			}
		}
		await this.db.bulk("prices", puts, deletes);
		this.version++;
	}

	async applyStock(rows) {
		for (const r of rows) this.stock.set(r.item_code, r);
		await this.db.bulk("stock", rows, []);
		this.version++;
	}

	async applyCustomers(rows) {
		const puts = [];
		const deletes = [];
		for (const r of rows) {
			if (r.deleted) {
				deletes.push(r.name);
				if (this.customerByName.delete(r.name)) this._customersDirty = true;
			} else {
				puts.push(r);
				this._indexCustomer(r);
			}
		}
		await this.db.bulk("customers", puts, deletes);
		this.version++;
	}

	async applyDeleted(rows) {
		const byType = {};
		for (const r of rows) (byType[r.doctype] = byType[r.doctype] || []).push(r.name);
		if (byType.Item) await this.applyItems(byType.Item.map((item_code) => ({ item_code, deleted: 1 })));
		if (byType["Item Price"]) await this.applyPrices(byType["Item Price"].map((name) => ({ name, deleted: 1 })));
		if (byType.Customer) await this.applyCustomers(byType.Customer.map((name) => ({ name, deleted: 1 })));
	}

	async setMeta(key, value) {
		this.meta[key] = value;
		await this.db.put("meta", value, key);
	}

	getMeta(key, fallback = null) {
		return key in this.meta ? this.meta[key] : fallback;
	}

	async clearAll() {
		for (const s of ["items", "prices", "stock", "customers", "meta"]) await this.db.clear(s);
		const name = this.profileName;
		this.reset();
		this.profileName = name;
	}

	// ------------------------------------------------------------------- lookups
	getItem(code) {
		return this.byCode.get(code) || null;
	}

	/**
	 * Resolve a scanned / typed code.
	 * Returns { item, uom, qty, amount, scale, match } or null.
	 *   match: "barcode" | "item_code" | "scale"
	 */
	lookupCode(code) {
		if (!code) return null;
		const raw = String(code).trim();
		const hit = this.byBarcode.get(raw);
		if (hit) {
			const item = this.byCode.get(hit.item_code);
			if (item) return { item, uom: hit.uom || item.stock_uom, match: "barcode", barcode: raw };
		}
		const scale = parseScaleBarcode(raw, this.scale);
		if (scale) {
			const item = this._scaleItem(scale.itemPart);
			if (item) {
				const out = { item, uom: item.stock_uom, match: "scale", scale, barcode: raw };
				if (scale.valueType === "Price") out.amount = scale.value;
				else out.qty = scale.value;
				return out;
			}
		}
		const byCode = this.byCode.get(raw);
		if (byCode) return { item: byCode, uom: byCode.stock_uom, match: "item_code" };
		return null;
	}

	_scaleItem(itemPart) {
		const lookup = (this.scale && this.scale.lookup) || "Item Barcode or Item Code";
		const candidates = [itemPart, stripPrefix(itemPart, this.scale), String(parseInt(stripPrefix(itemPart, this.scale), 10))];
		if (lookup.includes("Barcode")) {
			for (const c of candidates) {
				const hit = this.byBarcode.get(c);
				if (hit && this.byCode.get(hit.item_code)) return this.byCode.get(hit.item_code);
			}
		}
		if (lookup.includes("Item Code")) {
			for (const c of candidates) {
				if (this.byCode.get(c)) return this.byCode.get(c);
			}
		}
		return null;
	}

	/**
	 * Ranked text search.
	 * options: { group, limit, hideVariants, showTemplates, inStockOnly }
	 */
	search(text, { group = null, limit = 50, hideVariants = false, inStockOnly = false } = {}) {
		const q = lower(text).trim();
		const g = group && group !== "ALL" ? lower(group) : null;
		const accept = (it) => {
			if (g && !it._group.includes(g)) return false;
			if (hideVariants && it.variant_of) return false;
			if (inStockOnly && it.is_stock_item && this.availableQty(it.item_code) <= 0) return false;
			return true;
		};
		if (!q) {
			const out = [];
			for (const it of this.items) {
				if (accept(it)) out.push(it);
				if (out.length >= limit) break;
			}
			return out;
		}
		// exact hits first
		const exact = [];
		const direct = this.lookupCode(q) || this.lookupCode(text);
		if (direct && accept(direct.item)) exact.push(direct.item);
		const words = q.split(/\s+/).filter(Boolean);
		const prefix = [];
		const contains = [];
		const maxScan = limit * 4;
		for (const it of this.items) {
			if (exact[0] === it || !accept(it)) continue;
			if (it._code.startsWith(q) || it._name.startsWith(q)) {
				prefix.push(it);
			} else if (words.length > 1 ? words.every((w) => it._hay.includes(w)) : it._hay.includes(q)) {
				contains.push(it);
			}
			if (prefix.length >= limit) break;
			if (prefix.length + contains.length >= maxScan) break;
		}
		return exact.concat(prefix, contains).slice(0, limit);
	}

	searchCustomers(text, limit = 30) {
		const q = lower(text).trim();
		if (!q) return this.customers.slice(0, limit);
		const out = [];
		for (const c of this.customers) {
			if (
				lower(c.customer_name).includes(q) ||
				lower(c.name).includes(q) ||
				lower(c.mobile_no).includes(q) ||
				lower(c.tax_id).includes(q) ||
				lower(c.email_id).includes(q)
			) {
				out.push(c);
				if (out.length >= limit) break;
			}
		}
		return out;
	}

	conversionFactor(item, uom) {
		if (!item || !uom || uom === item.stock_uom) return 1;
		const row = (item.item_uoms || []).find((u) => u.uom === uom);
		return row ? Number(row.conversion_factor) || 1 : 1;
	}

	/**
	 * Price resolution modelled on ERPNext get_price_list_rate_for():
	 *  price list + item, customer specific first, valid on `date`, uom specific
	 *  first else stock-uom price x conversion factor, batch specific first.
	 */
	getPrice(itemCode, { priceList, uom, customer, date, batchNo, currency } = {}) {
		const item = this.byCode.get(itemCode);
		const rows = this.prices.get(itemCode) || [];
		const d = date || today();
		const valid = rows.filter(
			(p) =>
				p.price_list === priceList &&
				(!p.valid_from || p.valid_from <= d) &&
				(!p.valid_upto || p.valid_upto >= d) &&
				(!p.customer || p.customer === customer) &&
				(!p.batch_no || p.batch_no === batchNo) &&
				(!currency || !p.currency || p.currency === currency)
		);
		if (!valid.length) return null;
		const score = (p) =>
			(p.customer ? 8 : 0) + (p.batch_no ? 4 : 0) + (p.uom === uom ? 2 : 0) + (!p.uom || p.uom === (item && item.stock_uom) ? 1 : 0);
		valid.sort((a, b) => score(b) - score(a) || String(b.valid_from || "").localeCompare(String(a.valid_from || "")));
		const best = valid[0];
		let rate = Number(best.price_list_rate) || 0;
		const cf = this.conversionFactor(item, uom);
		// price defined for the stock uom (or no uom) but selling another uom
		if (uom && best.uom !== uom && (!best.uom || best.uom === (item && item.stock_uom))) rate = rate * cf;
		else if (uom && best.uom && best.uom !== uom) {
			const priceCf = this.conversionFactor(item, best.uom);
			rate = (rate / (priceCf || 1)) * cf;
		}
		return { price_list_rate: rate, currency: best.currency, uom: best.uom, price_row: best.name };
	}

	/** All uom prices for an item in a price list, as get_items() returned them. */
	uomPrices(itemCode, priceList, customer) {
		const out = {};
		const d = today();
		for (const p of this.prices.get(itemCode) || []) {
			if (p.price_list !== priceList) continue;
			if ((p.valid_from && p.valid_from > d) || (p.valid_upto && p.valid_upto < d)) continue;
			if (p.customer && p.customer !== customer) continue;
			const key = p.uom || "None";
			if (!out[key] || p.customer) out[key] = { uom: key, price_list_rate: Number(p.price_list_rate) || 0, currency: p.currency };
		}
		return out;
	}

	stockRow(itemCode) {
		return this.stock.get(itemCode) || null;
	}

	/** Bin qty minus what was sold offline and is not on the server yet. */
	availableQty(itemCode) {
		const s = this.stock.get(itemCode);
		return (s ? Number(s.actual_qty) || 0 : 0) - (this.pendingQty.get(itemCode) || 0);
	}

	setPendingQty(map) {
		this.pendingQty = map;
		this.version++;
	}

	/** Add stock sold offline (item_code -> stock qty) without invalidating UI caches. */
	addPendingQty(deltas) {
		for (const [code, qty] of deltas) this.pendingQty.set(code, (this.pendingQty.get(code) || 0) + qty);
	}

	/** Item row in the shape ItemsSelector / Invoice expect (as get_items() returned). */
	toPosItem(item, { priceList, customer, mrpPriceList, currency } = {}) {
		const price = this.getPrice(item.item_code, { priceList, uom: item.stock_uom, customer, currency });
		const mrp = mrpPriceList ? this.getPrice(item.item_code, { priceList: mrpPriceList, uom: item.stock_uom, customer }) : null;
		const stock = this.stock.get(item.item_code);
		return {
			item_code: item.item_code,
			item_name: item.item_name,
			description: item.description || item.item_name,
			stock_uom: item.stock_uom,
			image: item.image,
			is_stock_item: item.is_stock_item,
			has_variants: item.has_variants,
			variant_of: item.variant_of,
			item_group: item.item_group,
			has_batch_no: item.has_batch_no,
			has_serial_no: item.has_serial_no,
			max_discount: item.max_discount,
			brand: item.brand,
			rate: price ? price.price_list_rate : 0,
			price_list_rate: price ? price.price_list_rate : 0,
			currency: (price && price.currency) || currency,
			maximum_retail_price: mrp ? mrp.price_list_rate : 0,
			uom_prices: this.uomPrices(item.item_code, priceList, customer),
			item_barcode: item.item_barcode || [],
			item_uoms: item.item_uoms || [{ uom: item.stock_uom, conversion_factor: 1 }],
			actual_qty: this.availableQty(item.item_code),
			valuation_rate: stock ? stock.valuation_rate : 0,
			serial_no_data: [],
			batch_no_data: item.batch_no_data || [],
			attributes: "",
			item_attributes: item.item_attributes || "",
			item_taxes: item.item_taxes || [],
			_offline: 1,
		};
	}
}

export const catalog = new Catalog();
