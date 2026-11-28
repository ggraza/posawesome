// Supermarket rules that do not need the server or Vue (tested on their own).
// The server has the same rules (api/supermarket.py); keep them in step.

const flt = (v) => {
	const n = parseFloat(v);
	return isNaN(n) ? 0 : n;
};

// client action -> setting that asks a manager for it
export const ACTION_FLAG = {
	price: "appr_price",
	discount: "appr_discount",
	line_void: "appr_line_void",
	cart_void: "appr_cart_void",
	no_sale: "appr_no_sale",
	reprint: "appr_reprint",
	return: "appr_return",
	cash_pickup: "appr_cash_out",
	cash_out: "appr_cash_out",
};

export const ACTION_LABEL = {
	price: "Price Override",
	discount: "Discount",
	line_void: "Line Void",
	cart_void: "Cart Void",
	no_sale: "No Sale",
	reprint: "Reprint",
	return: "Return",
	cash_pickup: "Cash Pickup",
	cash_out: "Cash Out",
};

export function isOfferRow(row) {
	return !!(
		Number(row.is_free_item) ||
		Number(row.posa_is_offer) ||
		Number(row.posa_offer_applied) ||
		Number(row.posa_comp) ||
		row.posa_is_replace
	);
}

// The largest manual discount % of a cart (same rule as the server):
// per item, the rate below the list price (without offers, the customer's own
// discount or an approved price override); on the whole sale, the additional
// discount when no offer or coupon is on the sale.
export function manualDiscount(items, doc = {}, customerDiscount = 0) {
	let worst = 0;
	for (const row of items || []) {
		const plr = flt(row.price_list_rate);
		if (plr <= 0 || flt(row.qty) < 0 || isOfferRow(row) || row.posa_sm_approval) continue;
		const pct = ((plr - flt(row.rate)) * 100) / plr;
		if (customerDiscount && pct <= flt(customerDiscount) + 0.01) continue;
		worst = Math.max(worst, pct);
	}
	const hasOffer = (doc.posa_offers && doc.posa_offers.length) || (doc.posa_coupons && doc.posa_coupons.length);
	if (!hasOffer) {
		let inv = flt(doc.additional_discount_percentage);
		const total = flt(doc.total);
		if (!inv && flt(doc.discount_amount) && total) inv = (flt(doc.discount_amount) * 100) / total;
		worst = Math.max(worst, inv);
	}
	return Math.round(worst * 10000) / 10000;
}

// "27,112,0,25,250" / "0x1B,0x70,0,25,250" -> [27, 112, 0, 25, 250]
export function parseDrawerCode(code) {
	const out = [];
	for (const raw of String(code == null ? "" : code).replace(/\s+/g, "").split(",")) {
		if (!raw) continue;
		const v = /^0x/i.test(raw) ? parseInt(raw, 16) : /^\d+$/.test(raw) ? parseInt(raw, 10) : NaN;
		if (isNaN(v) || v < 0 || v > 255) throw new Error("Drawer Pulse Code: each number must be 0 to 255");
		out.push(v);
	}
	if (!out.length) throw new Error("Drawer Pulse Code is empty");
	return out;
}

export function drawerCommand(code) {
	return parseDrawerCode(code || "27,112,0,25,250")
		.map((b) => String.fromCharCode(b))
		.join("");
}

// what POS Void Log keeps of a cart row
export function voidRow(item) {
	const qty = flt(item.qty);
	const rate = flt(item.rate);
	return {
		item_code: item.item_code,
		item_name: item.item_name,
		qty,
		rate,
		amount: Math.round(qty * rate * 100) / 100,
		posa_row_id: item.posa_row_id,
	};
}

// the approvals of a cart, as the invoice keeps them (comma separated, once each)
export function joinTokens(list) {
	const out = [];
	for (const t of list || []) {
		const s = String(t || "").trim();
		if (s && !out.includes(s)) out.push(s);
	}
	return out.join(",");
}

export function splitTokens(text) {
	return joinTokens(String(text || "").split(/[,\n]/)).split(",").filter(Boolean);
}

// A new id for a record made at the till (offline outbox, dedupe on the server)
export function clientId() {
	const rnd = () => Math.random().toString(36).slice(2, 10);
	return "SM-" + Date.now().toString(36) + "-" + rnd() + rnd();
}

// Round a typed amount (cash dialogs): positive, 2 decimals, 0 when not a number
export function money(v) {
	const n = flt(v);
	return n > 0 ? Math.round(n * 100) / 100 : 0;
}

// ------------------------------------------------------------------ phase 2: till speed

// "12*" / "12x" / "12X" -> { qty: 12, rest: "" }; "12*6291041500213" -> { qty: 12, rest: "6291041500213" };
// "1.5*" -> 1.5. null when the text is not a quantity prefix.
export function qtyTimes(text) {
	const m = /^\s*(\d{1,4}(?:[.,]\d{1,3})?)\s*[*xX×]\s*(.*)$/.exec(String(text == null ? "" : text));
	if (!m) return null;
	const qty = parseFloat(m[1].replace(",", "."));
	if (!(qty > 0)) return null;
	return { qty, rest: m[2].trim() };
}

// GS1 application identifiers we read: fixed length, or variable (up to max) ended by GS / the end
const GS1_FIXED = { "00": 18, "01": 14, "02": 14, "11": 6, "12": 6, "13": 6, "15": 6, "16": 6, "17": 6, "20": 2 };
const GS1_VAR = { "10": 20, "21": 20, "22": 20, "30": 8, "37": 8, "240": 30, "241": 30, "250": 30, "400": 30 };
const GS = "\x1d";

function gs1Date(v) {
	if (!/^\d{6}$/.test(v)) return null;
	const yy = parseInt(v.slice(0, 2), 10);
	let mm = v.slice(2, 4);
	let dd = v.slice(4, 6);
	const year = 2000 + yy; // GS1: 00-49 = 20xx (enough for products on the shelf)
	if (dd === "00") {
		// "00" = the last day of the month
		dd = String(new Date(year, parseInt(mm, 10), 0).getDate()).padStart(2, "0");
	}
	return `${year}-${mm}-${dd}`;
}

// Parse a GS1-128 / DataBar code, in the raw form (FNC1 as GS, optional "]C1",
// "]e0", "]d2" prefix) or the printed form with brackets "(01)...(3103)...".
// Returns { gtin, weight, weightUnit, price, count, batch, serial, expiry, ais } or null.
export function parseGS1(code) {
	let s = String(code == null ? "" : code).trim();
	if (!s) return null;
	s = s.replace(/^\][A-Za-z]\d/, "");
	const ais = {};
	if (s.startsWith("(")) {
		const re = /\((\d{2,4})\)([^(]*)/g;
		let m;
		let used = 0;
		while ((m = re.exec(s))) {
			ais[m[1]] = m[2].replace(GS, "");
			used += m[0].length;
		}
		if (used !== s.length) return null;
	} else {
		let i = 0;
		while (i < s.length) {
			if (s[i] === GS) {
				i++;
				continue;
			}
			let ai = null;
			let len = 0;
			let variable = false;
			const two = s.substr(i, 2);
			const three = s.substr(i, 3);
			const four = s.substr(i, 4);
			if (GS1_FIXED[two] !== undefined) {
				ai = two;
				len = GS1_FIXED[two];
			} else if (/^3[1-6]\d\d$/.test(four)) {
				ai = four;
				len = 6; // measures: 6 digits, 4th digit of the AI = decimals
			} else if (/^39[0-3]\d$/.test(four)) {
				ai = four;
				len = 15;
				variable = true;
			} else if (GS1_VAR[three] !== undefined) {
				ai = three;
				len = GS1_VAR[three];
				variable = true;
			} else if (GS1_VAR[two] !== undefined) {
				ai = two;
				len = GS1_VAR[two];
				variable = true;
			} else {
				return null;
			}
			i += ai.length;
			let value;
			if (variable) {
				const end = s.indexOf(GS, i);
				const stop = end === -1 ? s.length : Math.min(end, i + len);
				value = s.slice(i, stop);
				i = stop;
			} else {
				value = s.substr(i, len);
				if (value.length !== len) return null;
				i += len;
			}
			ais[ai] = value;
		}
	}
	const gtin = ais["01"] || ais["02"];
	if (!gtin || !/^\d{14}$/.test(gtin)) return null;
	const out = { gtin, ais, weight: null, weightUnit: null, price: null, count: null, batch: ais["10"] || null, serial: ais["21"] || null, expiry: null };
	for (const [ai, v] of Object.entries(ais)) {
		const dec = parseInt(ai[3], 10);
		if (/^310\d$/.test(ai)) {
			out.weight = parseInt(v, 10) / Math.pow(10, dec);
			out.weightUnit = "kg";
		} else if (/^320\d$/.test(ai) && out.weight == null) {
			out.weight = (parseInt(v, 10) / Math.pow(10, dec)) * 0.45359237;
			out.weightUnit = "kg";
		} else if (/^392\d$/.test(ai)) {
			out.price = parseInt(v, 10) / Math.pow(10, dec);
		} else if (/^393\d$/.test(ai)) {
			out.price = parseInt(v.slice(3), 10) / Math.pow(10, dec); // first 3 digits: ISO currency
		}
	}
	const cnt = ais["30"] || ais["37"];
	if (cnt && /^\d+$/.test(cnt)) out.count = parseInt(cnt, 10);
	const exp = ais["17"] || ais["15"] || ais["16"];
	if (exp) out.expiry = gs1Date(exp);
	if (out.weight != null) out.weight = Math.round(out.weight * 1000) / 1000;
	return out;
}

// GTIN-14 -> the barcodes it can be stored as: 14, 13 (EAN), 12 (UPC), 8 (EAN-8)
export function gtinCandidates(gtin) {
	const g = String(gtin || "");
	const out = [g];
	if (g.startsWith("0")) out.push(g.slice(1));
	if (g.startsWith("00")) out.push(g.slice(2));
	if (g.startsWith("000000")) out.push(g.slice(6));
	return [...new Set(out)];
}

// is this item sold by weight (its UOM is one of the weighed UOMs)
export function isWeighed(item, uoms) {
	const list = (uoms || []).map((u) => String(u).toLowerCase());
	if (!list.length || !item) return false;
	return [item.uom, item.stock_uom].some((u) => u && list.includes(String(u).toLowerCase()));
}

// One line from a scale. Returns { weight (kg), stable } or null.
//   Continuous / Request: the number in the line ("  1.250 kg", "W 1.250kg", "0.850", "850 g")
//   CAS: "ST,GS,+  1.250kg" (ST = stable, US = moving, OL = overload)
//   Toledo: STX, status bytes A B C, 6 weight digits, 6 tare digits (decimals in A, sign / motion in B)
export function parseScaleLine(line, protocol = "Continuous") {
	const s = String(line == null ? "" : line);
	if (protocol === "Toledo") {
		const i = s.indexOf("\x02");
		const t = i >= 0 ? s.slice(i + 1) : s;
		if (t.length < 9) return null;
		const a = t.charCodeAt(0);
		const b = t.charCodeAt(1);
		const digits = t.slice(3, 9);
		if (!/^[\d ]{6}$/.test(digits)) return null;
		const raw = parseInt(digits.replace(/ /g, "0"), 10);
		const code = a & 7; // 0: x100, 1: x10, 2: x1, 3..7: 1..5 decimals
		let w = code === 0 ? raw * 100 : code === 1 ? raw * 10 : raw / Math.pow(10, Math.max(0, code - 2));
		if (b & 2) w = -w;
		const kg = !!(b & 16);
		if (!kg) w *= 0.45359237;
		return { weight: Math.round(w * 1000) / 1000, stable: !(b & 8) };
	}
	if (protocol === "CAS") {
		const m = /^(ST|US|OL)\s*,\s*(GS|NT|TR)?\s*,?\s*([+-]?)\s*(\d+(?:[.,]\d+)?)\s*(kg|g|lb)?/i.exec(s.trim());
		if (!m || m[1].toUpperCase() === "OL") return null;
		let w = parseFloat(m[4].replace(",", "."));
		if (m[3] === "-") w = -w;
		w = toKg(w, m[5]);
		return { weight: Math.round(w * 1000) / 1000, stable: m[1].toUpperCase() === "ST" };
	}
	const m = /([+-]?)\s*(\d+(?:[.,]\d+)?)\s*(kg|g|lb)?\b/i.exec(s);
	if (!m) return null;
	let w = parseFloat(m[2].replace(",", "."));
	if (m[1] === "-") w = -w;
	w = toKg(w, m[3]);
	// "?", "M" or "US" in the line: the scale says it is still moving
	const moving = /\?|\bM\b|\bUS\b|motion/i.test(s);
	return { weight: Math.round(w * 1000) / 1000, stable: !moving };
}

function toKg(w, unit) {
	const u = String(unit || "kg").toLowerCase();
	if (u === "g") return w / 1000;
	if (u === "lb") return w * 0.45359237;
	return w;
}

// "ctrl + q" -> "Ctrl+Q"; null when it would clash with typing (same rule as the server)
export function normalizeHotkey(text) {
	const parts = String(text == null ? "" : text).replace(/\s+/g, "").split("+");
	let key = parts.pop();
	if (!key) return null;
	const mods = new Set(parts.map((p) => p.toLowerCase()));
	for (const m of mods) if (!["ctrl", "alt", "shift"].includes(m)) return null;
	if (key.length === 1) key = key.toUpperCase();
	else if (["esc", "escape", "enter", "tab", "backspace", "delete", "space"].includes(key.toLowerCase())) return null;
	else if (/^f([1-9]|1[0-2])$/i.test(key)) key = key.toUpperCase();
	else key = key[0].toUpperCase() + key.slice(1);
	if (/^F\d+$/i.test(key) && !/^F([1-9]|1[0-2])$/.test(key)) return null; // F13+ do not exist on a till keyboard
	const isF = /^F([1-9]|1[0-2])$/.test(key);
	if (!isF && !mods.has("ctrl") && !mods.has("alt")) return null;
	return ["Ctrl", "Alt", "Shift"].filter((m) => mods.has(m.toLowerCase())).concat(key).join("+");
}

// a keydown event as a hotkey name ("Ctrl+Q", "F4"), or null for plain typing
export function hotkeyOf(e) {
	if (!e || !e.key || ["Control", "Alt", "Shift", "Meta"].includes(e.key)) return null;
	let key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
	// Ctrl+Shift+1 gives "!": use the physical key for letters / digits
	if (e.code && /^Key[A-Z]$/.test(e.code)) key = e.code.slice(3);
	else if (e.code && /^Digit\d$/.test(e.code)) key = e.code.slice(5);
	const parts = [];
	if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
	if (e.altKey) parts.push("Alt");
	if (e.shiftKey) parts.push("Shift");
	return normalizeHotkey(parts.concat(key).join("+"));
}

// ------------------------------------------------------------------ phase 3: promotions
// (the server has the same rules: api/supermarket.py in_schedule / deal_discounts / savings)
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function minutesOf(t) {
	if (t == null || t === "") return null;
	const p = String(t).split(":");
	const h = parseInt(p[0], 10);
	const m = parseInt(p[1] || "0", 10);
	return isNaN(h) ? null : h * 60 + (isNaN(m) ? 0 : m);
}

function ymd(d) {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Is `at` (Date) inside the dates, daily hours and days? A window like
// 22:00-02:00 runs past midnight and belongs to the day it started.
export function inSchedule(at, validFrom, validUpto, dailyFrom, dailyTo, days) {
	const d = at instanceof Date ? at : new Date(at);
	const today = ymd(d);
	if (validFrom && today < String(validFrom).slice(0, 10)) return false;
	if (validUpto && today > String(validUpto).slice(0, 10)) return false;
	const start = minutesOf(dailyFrom);
	const end = minutesOf(dailyTo);
	const now = d.getHours() * 60 + d.getMinutes();
	let day = (d.getDay() + 6) % 7; // Mon = 0
	if (start != null && end != null && start !== end) {
		if (start < end) {
			if (!(now >= start && now < end)) return false;
		} else if (now >= start) {
			/* evening part */
		} else if (now < end) {
			day = (day + 6) % 7; // after midnight: yesterday's window
		} else {
			return false;
		}
	}
	if (days) {
		const allowed = String(days)
			.split(",")
			.map((x) => DAY_NAMES.indexOf(x.trim()))
			.filter((i) => i >= 0);
		if (allowed.length && !allowed.includes(day)) return false;
	}
	return true;
}

function num(v) {
	const n = parseFloat(v);
	return isNaN(n) ? 0 : n;
}

export function dealEligible(row) {
	if (num(row.qty) <= 0 || num(row.price_list_rate) <= 0) return false;
	if (Number(row.is_free_item) || Number(row.posa_is_offer) || row.posa_is_replace) return false;
	if (row.posa_sm_markdown || Number(row.posa_comp)) return false;
	if (!row.posa_sm_deal) {
		if (Number(row.posa_offer_applied)) return false;
		if (num(row.discount_amount) > 0.0001 || num(row.discount_percentage) > 0.0001) return false;
		if (num(row.rate) < num(row.price_list_rate) - 0.0001) return false;
	}
	return true;
}

function dealMatches(deal, row) {
	return (
		(deal.items || []).includes(row.item_code) ||
		(!!row.item_group && (deal.item_groups || []).includes(row.item_group)) ||
		(!!row.brand && (deal.brands || []).includes(row.brand))
	);
}

// { row index: [deal name, total discount of the row] }
export function dealDiscounts(rows, deals, at = null) {
	const order = (deals || [])
		.filter((d) => !at || inSchedule(at, d.valid_from, d.valid_upto, d.daily_from, d.daily_to, d.days))
		.slice()
		.sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0) || (String(a.name) < String(b.name) ? -1 : String(a.name) > String(b.name) ? 1 : 0));
	const taken = new Set();
	const out = {};
	for (const deal of order) {
		const n = parseInt(deal.quantity, 10) || 0;
		if (n < 2) continue;
		const pool = [];
		rows.forEach((r, i) => {
			if (!taken.has(i) && dealEligible(r) && dealMatches(deal, r)) pool.push(i);
		});
		if (!pool.length) continue;
		let groups = [pool];
		if (deal.deal_type === "Multi-Buy") {
			const byItem = new Map();
			for (const i of pool) {
				const k = rows[i].item_code;
				if (!byItem.has(k)) byItem.set(k, []);
				byItem.get(k).push(i);
			}
			groups = [...byItem.values()];
		}
		const repeat = !!Number(deal.repeat);
		const maxSets = repeat ? parseInt(deal.max_sets, 10) || 0 : 1;
		let usedSets = 0;
		for (const group of groups) {
			const units = [];
			for (const i of group) {
				const whole = Math.floor(num(rows[i].qty) + 1e-9);
				for (let k = 0; k < whole; k++) units.push([-num(rows[i].price_list_rate), i]);
			}
			units.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
			let sets = Math.floor(units.length / n);
			if (!repeat) sets = Math.min(sets, 1);
			if (maxSets) sets = Math.min(sets, maxSets - usedSets);
			if (sets <= 0) continue;
			const chosen = units.slice(0, sets * n);
			const normal = chosen.reduce((t, u) => t - u[0], 0);
			const saving = normal - sets * num(deal.deal_price);
			if (saving <= 0.0001) continue;
			usedSets += sets;
			const share = new Map();
			for (const [price, i] of chosen) share.set(i, (share.get(i) || 0) - price);
			for (const [i, amt] of share) {
				out[i] = [deal.name, Math.round(((saving * amt) / normal) * 10000) / 10000];
				taken.add(i);
			}
		}
	}
	return out;
}

// what the customer saved, by kind
export function savings(doc) {
	const out = { offers: 0, deals: 0, markdowns: 0, discounts: 0, mrp: 0, total: 0 };
	if (doc && Number(doc.is_return)) return out;
	for (const row of (doc && doc.items) || []) {
		const qty = num(row.qty);
		if (qty <= 0) continue;
		const plr = num(row.price_list_rate);
		const rate = num(row.rate);
		const mrp = num(row.maximum_retail_price);
		if (mrp > plr && plr > 0) out.mrp += (mrp - plr) * qty;
		if (plr > rate) {
			const off = (plr - rate) * qty;
			if (row.posa_sm_markdown) out.markdowns += off;
			else if (row.posa_sm_deal) out.deals += off;
			else if (Number(row.posa_offer_applied) || Number(row.posa_is_offer) || Number(row.is_free_item)) out.offers += off;
			else out.discounts += off;
		}
	}
	const inv = num(doc && doc.discount_amount);
	if (inv > 0) {
		if (doc.posa_offers && doc.posa_offers.length) out.offers += inv;
		else out.discounts += inv;
	}
	for (const k of ["offers", "deals", "markdowns", "discounts", "mrp"]) out[k] = Math.round(out[k] * 100) / 100;
	out.total = Math.round((out.offers + out.deals + out.markdowns + out.discounts + out.mrp) * 100) / 100;
	return out;
}

export function isMarkdownCode(code) {
	return /^MD\d{10}$/.test(String(code || "").trim());
}

// ------------------------------------------------------------------ phase 4: payments and customers
// 03001234567 / +92 300 1234567 -> 923001234567 (same rule as the server); "" when not a number
export function normalizePhone(phone) {
	let d = String(phone == null ? "" : phone).replace(/\D/g, "");
	if (d.startsWith("00")) d = d.slice(2);
	if (d.startsWith("03") && d.length === 11) d = "92" + d.slice(1);
	return d.length >= 10 && d.length <= 15 ? d : "";
}

// payments of a sale by mode (amounts that are not 0)
export function paidBy(doc, modes) {
	const list = Array.isArray(modes) ? modes : [modes];
	return ((doc && doc.payments) || []).filter((p) => list.includes(p.mode_of_payment) && Math.abs(num(p.amount)) > 0.005);
}

// What must happen before a sale is submitted (supermarket settings `s`):
// gift card scan, wallet QR, card approval code, e-receipt number.
export function paySteps(doc, s, walkInCustomer) {
	const steps = [];
	if (!doc || !s || !s.enabled) return steps;
	if (s.gift_cards && s.gift_card_mop && paidBy(doc, s.gift_card_mop).length && !doc.posa_sm_gift_card_no) steps.push({ kind: "gift" });
	if (s.wallet_qr) {
		for (const w of s.wallets || []) {
			const p = paidBy(doc, w.mode_of_payment).find((x) => num(x.amount) > 0);
			if (p && !doc.posa_sm_wallet_ref) steps.push({ kind: "wallet", wallet: w, amount: num(p.amount) });
		}
	}
	if (s.card_terminal && (s.card_mops || []).length) {
		const p = paidBy(doc, s.card_mops).find((x) => num(x.amount) > 0);
		if (p && !doc.posa_sm_card_ref) steps.push({ kind: "card", mode: p.mode_of_payment, amount: num(p.amount) });
	}
	if (s.e_receipt && s.e_receipt_ask && !doc.posa_sm_receipt_to && !doc.is_return && doc.customer && doc.customer === walkInCustomer) {
		steps.push({ kind: "phone" });
	}
	return steps;
}
