// Supermarket hooks of the RMS POS invoice (Invoice.vue).
//
// With "Enable Supermarket Features" off (POS Profile > Supermarket), sm_on is
// false: the invoice calls these hooks only behind `if (this.sm_on ...)` or
// gets an empty object from them, so it works as before.
import { sm, flag, needs, approve, gateVoid, logVoid, needsWeight, weigh, deals, offerInTime, markdownPrice, msg, minAge, askAge, showLoyalty } from "./service.js";
import * as L from "./logic.js";

const __t = (t, a) => (typeof __ === "function" ? __(t, a) : t);
const flt = (v) => {
	const n = parseFloat(v);
	return isNaN(n) ? 0 : n;
};

export default {
	data() {
		return {
			sm_state: sm,
			sm_cart: { tokens: [], discount_ok: 0, return_token: null, age_ok: 0 },
		};
	},
	computed: {
		sm_on() {
			return this.sm_state.on;
		},
	},
	watch: {
		// an empty cart (cancelled, paid, all rows removed): its approvals end
		// with it, so the next sale cannot use them
		"items.length"(n) {
			if (!this.sm_on || n) return;
			this.sm_cart.tokens = [];
			this.sm_cart.discount_ok = 0;
			this.sm_cart.age_ok = 0;
		},
		// loyalty points on the customer display (Supermarket > Loyalty Points on the Customer Display)
		customer(c) {
			if (this.sm_on && c) showLoyalty(c);
		},
		invoice_doc(doc) {
			if (!this.sm_on) return;
			if (!doc) {
				// a new cart
				this.sm_cart.tokens = [];
				this.sm_cart.discount_ok = 0;
				return;
			}
			if (doc.posa_sm_approvals) {
				for (const t of L.splitTokens(doc.posa_sm_approvals)) if (!this.sm_cart.tokens.includes(t)) this.sm_cart.tokens.push(t);
			}
			if (!doc.is_return && this.invoiceType !== "Return") this.sm_cart.return_token = null;
		},
	},
	mounted() {
		if (this.$evntBus && this.$evntBus.$on) this.$evntBus.$on("sm_hotkey", this.sm_on_hotkey);
		// deals and offers with daily hours: check again every minute while a cart is open
		this._sm_timer = setInterval(() => {
			if (!this.sm_on || !this.items || !this.items.length) return;
			if (flag("offer_schedule") && typeof this.handelOffers === "function") this.handelOffers();
			this.sm_apply_promos();
		}, 60000);
	},
	beforeUnmount() {
		if (this.$evntBus && this.$evntBus.$off) this.$evntBus.$off("sm_hotkey", this.sm_on_hotkey);
		clearInterval(this._sm_timer);
	},
	methods: {
		// ---------------------------------------------------------------- promotions (phase 3)
		// an offer the engine may use now (Time and Day Offers)
		sm_offer_allowed(offer) {
			return !this.sm_on || offerInTime(offer);
		},
		// After every cart change: reduced-price lines keep their price, deals
		// price their lines (and stop when the cart no longer makes a deal).
		// Only rows a deal may price are touched; offers win over deals.
		sm_apply_promos() {
			if (!this.sm_on || !this.items) return;
			const rows = this.items;
			for (const r of rows) {
				if (!r.posa_sm_markdown) continue;
				if (Math.abs(flt(r.qty)) !== 1) {
					r.qty = flt(r.qty) < 0 ? -1 : 1; // one label = one item
					if (typeof this.calc_stock_qty === "function") this.calc_stock_qty(r, r.qty);
					msg(__t("A reduced label is for one item; scan another label for more."), "warning");
				}
				const price = r.__sm_markdown_price != null ? Number(r.__sm_markdown_price) : markdownPrice(r.posa_sm_markdown);
				if (price == null) continue;
				const plr = flt(r.price_list_rate);
				const disc = Math.max(0, Math.round((plr - price) * 100) / 100);
				if (flt(r.rate) !== price) r.rate = price;
				if (flt(r.discount_amount) !== disc) r.discount_amount = disc;
				if (flt(r.discount_percentage)) r.discount_percentage = 0;
				if (!Number(r.posa_offer_applied)) r.posa_offer_applied = 1;
			}
			const list = deals();
			const want = list.length ? L.dealDiscounts(rows, list, new Date()) : {};
			rows.forEach((r, i) => {
				const w = want[i];
				if (w) {
					const qty = flt(r.qty) || 1;
					const per = Math.round((w[1] / qty) * 100) / 100;
					const rate = Math.round((flt(r.price_list_rate) - per) * 100) / 100;
					if (r.posa_sm_deal !== w[0]) r.posa_sm_deal = w[0];
					if (flt(r.discount_amount) !== per) r.discount_amount = per;
					if (flt(r.discount_percentage)) r.discount_percentage = 0;
					if (flt(r.rate) !== rate) r.rate = rate;
					if (!Number(r.posa_offer_applied)) r.posa_offer_applied = 1;
				} else if (r.posa_sm_deal) {
					// the cart no longer makes this deal: back to the normal price
					r.posa_sm_deal = null;
					r.discount_amount = 0;
					r.discount_percentage = 0;
					r.rate = flt(r.price_list_rate);
					r.posa_offer_applied = 0;
				}
			});
		},

		// ---------------------------------------------------------------- till speed (phase 2)
		// Before an item goes to the cart: a reduced-price label already in the
		// cart is refused; an item sold by weight asks its weight first.
		// true = taken over (refused, or added after weighing).
		sm_weigh_first(item) {
			if (!this.sm_on) return false;
			if (item && item.posa_sm_markdown) {
				if ((this.items || []).some((r) => r.posa_sm_markdown === item.posa_sm_markdown)) {
					msg(__t("This reduced label is already in the cart"));
					return true;
				}
				item.qty = 1; // one label = one item (also after "12*")
				return false;
			}
			// age-restricted item: the cashier checks the age once per sale
			const age = minAge(item);
			if (age && !item.__sm_age_ok && (this.sm_cart.age_ok || 0) < age && !this.sm_state.training) {
				askAge(item, age).then((yes) => {
					if (!yes) return;
					this.sm_cart.age_ok = Math.max(this.sm_cart.age_ok || 0, age);
					this.add_item({ ...item, __sm_age_ok: true });
				});
				return true;
			}
			if (!needsWeight(item)) return false;
			weigh({ item_name: item.item_name || item.item_code, uom: item.uom || item.stock_uom }).then((qty) => {
				if (qty) this.add_item({ ...item, qty, __sm_weighed: true });
			});
			return true;
		},
		// a hotkey of the POS Profile for an invoice action
		sm_on_hotkey(ev) {
			if (!this.sm_on || !ev) return;
			const a = ev.action;
			if (a === "Pay") {
				if (this.items && this.items.length) this.fd_run("show_payment");
			} else if (a === "Hold") {
				this.fd_run("new_invoice");
			} else if (a === "Resume Draft") {
				if (typeof this.get_draft_invoices === "function") this.get_draft_invoices();
			} else if (a === "Cancel Cart") {
				if (this.items && this.items.length) this.cancel_dialog = true;
			} else if (a === "Returns") {
				if (this.pos_profile && this.pos_profile.posa_allow_return) this.open_returns();
			} else if (a === "Void Last Item") {
				const rows = (this.items || []).filter((r) => !Number(r.posa_is_offer) && !r.posa_is_replace);
				const last = rows[rows.length - 1];
				if (last) this.handleRemoveItem(last);
			}
		},
		sm_sale_id() {
			return typeof this.current_sale_id === "function" ? this.current_sale_id() : null;
		},
		sm_add_token(t) {
			if (t && !this.sm_cart.tokens.includes(t)) this.sm_cart.tokens.push(t);
		},
		// fields of the invoice that go to the server
		sm_doc_fields(doc) {
			if (!this.sm_on) return {};
			const tokens = [...this.sm_cart.tokens];
			const ret = (doc && doc.is_return) || (this.invoice_doc && this.invoice_doc.is_return);
			if (ret && this.sm_cart.return_token) tokens.push(this.sm_cart.return_token);
			const out = { posa_training: this.sm_state.training ? 1 : 0, posa_sm_approvals: L.joinTokens(tokens) };
			if (flag("age_check")) out.posa_sm_age_checked = this.sm_cart.age_ok || 0;
			return out;
		},
		sm_item_fields(item) {
			if (!this.sm_on) return {};
			const out = {};
			if (item.posa_sm_approval) out.posa_sm_approval = item.posa_sm_approval;
			if (item.posa_sm_deal) out.posa_sm_deal = item.posa_sm_deal;
			if (item.posa_sm_markdown) out.posa_sm_markdown = item.posa_sm_markdown;
			if (item.posa_sm_gift_card) out.posa_sm_gift_card = item.posa_sm_gift_card;
			return out;
		},

		// ---------------------------------------------------------------- price override
		sm_before_rate(item) {
			if (!this.sm_on) return;
			item.__sm_before = { rate: flt(item.rate), discount_amount: item.discount_amount, discount_percentage: item.discount_percentage };
		},
		async sm_check_rate(item) {
			if (!this.sm_on) return;
			const before = item.__sm_before;
			item.__sm_before = null;
			if (!this.sm_on || !before || !needs("price") || this.sm_state.training) return;
			const now = flt(item.rate);
			if (now >= before.rate - 0.0001) return; // only a lower price needs a manager
			const a = await approve("price", {
				sale_id: this.sm_sale_id(),
				item_code: item.item_code,
				item_name: item.item_name,
				qty: item.qty,
				old_value: before.rate,
				new_value: now,
				amount: (before.rate - now) * flt(item.qty),
			});
			if (a) {
				if (a.approval) item.posa_sm_approval = a.approval;
				return;
			}
			// not approved: back to the price before
			item.rate = before.rate;
			item.discount_amount = before.discount_amount;
			item.discount_percentage = before.discount_percentage;
			if (typeof this.$forceUpdate === "function") this.$forceUpdate();
		},

		// ---------------------------------------------------------------- voids
		// true = go on removing the row
		async sm_line_void(item) {
			if (!this.sm_on) return true;
			const g = await gateVoid("line_void", [item], this.sm_sale_id());
			if (!g) return false;
			item.__sm_void = g;
			return true;
		},
		// a row was taken off the cart
		sm_removed(item) {
			const g = item.__sm_void;
			if (!g) return;
			item.__sm_void = null;
			logVoid("line_void", [item], {
				...g,
				saleId: this.sm_sale_id(),
				invoice: this.invoice_doc && this.invoice_doc.name,
			});
		},
		// the minus button on the last one: handled as a line void
		sm_minus(item) {
			if (this.sm_state.training) return false;
			if (!flag("void_reason") && !needs("line_void")) return false;
			const ret = !!this.isReturnWithoutInvoice;
			const last = ret ? flt(item.qty) === -1 : flt(item.qty) === 1;
			if (!last) return false;
			this.handleRemoveItem(item);
			return true;
		},
		// Cancel (the whole cart), after the reason / approval
		async sm_run(method, ...args) {
			const run = () => (typeof this.fd_run === "function" ? this.fd_run(method, ...args) : this[method](...args));
			if (!this.sm_on || method !== "cancel_invoice" || !this.items.length) {
				this.sm_cart.return_token = null;
				return run();
			}
			const rows = this.items.map((r) => ({ ...r }));
			const g = await gateVoid("cart_void", rows, this.sm_sale_id());
			if (!g) return;
			const saleId = this.sm_sale_id();
			const invoice = this.invoice_doc && this.invoice_doc.name;
			const out = await run();
			if (!this.items.length) {
				logVoid("cart_void", rows, { ...g, saleId, invoice });
				this.sm_cart.return_token = null;
			}
			return out;
		},

		// ---------------------------------------------------------------- discount, returns
		async sm_before_payment() {
			if (!this.sm_on || !needs("discount") || this.sm_state.training) return true;
			const doc = {
				additional_discount_percentage: this.additional_discount_percentage,
				discount_amount: this.discount_amount,
				total: this.Total,
				posa_offers: this.posa_offers,
				posa_coupons: this.posa_coupons,
			};
			if ((this.invoice_doc && this.invoice_doc.is_return) || this.invoiceType === "Return") return true;
			const custDisc = (this.customer_info && this.customer_info.posa_discount) || 0;
			const pct = L.manualDiscount(this.items, doc, custDisc);
			const limit = flt(this.sm_state.s.discount_limit);
			if (pct <= limit + 0.01 || pct <= this.sm_cart.discount_ok + 0.01) return true;
			const a = await approve("discount", {
				sale_id: this.sm_sale_id(),
				new_value: pct,
				old_value: limit,
				amount: flt(this.discount_amount) + (this.items || []).reduce((t, r) => t + flt(r.discount_amount) * flt(r.qty), 0),
			});
			if (!a) return false;
			this.sm_add_token(a.approval);
			this.sm_cart.discount_ok = pct;
			return true;
		},
		async sm_gate_return() {
			if (!this.sm_on || !needs("return")) return true;
			const a = await approve("return", { sale_id: this.sm_sale_id() });
			if (!a) return false;
			this.sm_cart.return_token = a.approval || null;
			return true;
		},
	},
};
