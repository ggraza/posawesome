// Offline totals & taxes, modelled on erpnext/controllers/taxes_and_totals.py so
// the receipt printed offline matches what ERPNext computes when the invoice is
// synced (the server recomputes anyway and reconciles rounding differences).
//
// Supported: inclusive / exclusive taxes, charge types On Net Total, Actual,
// On Previous Row Amount, On Previous Row Total, On Item Quantity, item tax
// templates (per-account rate overrides), additional discount on Net Total or
// Grand Total, rounded total by smallest currency fraction.

function _flt(value, precision) {
	if (typeof window !== "undefined" && typeof window.flt === "function") return window.flt(value, precision);
	const n = parseFloat(value);
	if (!Number.isFinite(n)) return 0;
	if (precision === undefined || precision === null) return n;
	const m = Math.pow(10, precision);
	return Math.round((n + Number.EPSILON) * m) / m;
}

export function roundBasedOnSmallestFraction(value, smallest, precision) {
	if (smallest && smallest > 0) {
		let remainder = _flt(value % smallest, precision);
		if (remainder >= smallest / 2) value = value + (smallest - remainder);
		else value = value - remainder;
		return _flt(value, precision);
	}
	return Math.round(value);
}

/** Pick the item tax template of an item (no tax category on POS invoices). */
export function itemTaxTemplateFor(itemRow, catalogItem, date, taxCategory = "") {
	if (itemRow.item_tax_template) return itemRow.item_tax_template;
	const rows = (catalogItem && catalogItem.item_taxes) || itemRow.item_taxes || [];
	const d = date || new Date().toISOString().slice(0, 10);
	const valid = rows
		.filter((t) => (!t.valid_from || t.valid_from <= d) && (t.tax_category || "") === (taxCategory || ""))
		.sort((a, b) => String(b.valid_from || "").localeCompare(String(a.valid_from || "")));
	if (valid.length) return valid[0].item_tax_template;
	const any = rows.find((t) => !t.tax_category && (!t.valid_from || t.valid_from <= d));
	return any ? any.item_tax_template : null;
}

/**
 * Compute totals.
 *
 * @param {object} doc     { items, taxes, discount_amount, additional_discount_percentage,
 *                           apply_discount_on, conversion_rate }
 * @param {object} opts    { currencyPrecision, floatPrecision, smallestFraction,
 *                           disableRoundedTotal, itemTaxTemplates: {name: {account: rate}} }
 * @returns doc (mutated) with item net amounts, tax amounts and totals
 */
export function calculateTaxesAndTotals(doc, opts = {}) {
	const P = opts.currencyPrecision ?? 2;
	const itemTaxTemplates = opts.itemTaxTemplates || {};
	const items = doc.items || [];
	const taxes = doc.taxes || [];
	taxes.forEach((t, i) => {
		if (!t.idx) t.idx = i + 1;
	});

	// ---- item amounts
	for (const item of items) {
		item.qty = _flt(item.qty, opts.floatPrecision ?? 3);
		item.rate = _flt(item.rate, P);
		item.amount = _flt(item.rate * item.qty, P);
		item.net_rate = item.rate;
		item.net_amount = item.amount;
		const map = item.item_tax_template ? itemTaxTemplates[item.item_tax_template] || {} : {};
		item._tax_map = map;
		item.item_tax_rate = JSON.stringify(map);
	}

	const taxRate = (tax, item) => {
		const map = item._tax_map || {};
		return Object.prototype.hasOwnProperty.call(map, tax.account_head) ? _flt(map[tax.account_head]) : _flt(tax.rate);
	};

	// ---- inclusive taxes: back out the net amount from the inclusive rate
	if (taxes.some((t) => t.included_in_print_rate)) {
		for (const item of items) {
			let cumulated = 0;
			let inclusivePerQty = 0;
			taxes.forEach((tax, i) => {
				let fraction = 0;
				let perQty = 0;
				if (tax.included_in_print_rate) {
					const r = taxRate(tax, item);
					if (tax.charge_type === "On Net Total") fraction = r / 100;
					else if (tax.charge_type === "On Previous Row Amount")
						fraction = (r / 100) * (taxes[tax.row_id - 1]?._fraction || 0);
					else if (tax.charge_type === "On Previous Row Total")
						fraction = (r / 100) * (taxes[tax.row_id - 1]?._grand_fraction || 0);
					else if (tax.charge_type === "On Item Quantity") perQty = r;
				}
				tax._fraction = fraction;
				tax._grand_fraction = (i === 0 ? 1 : taxes[i - 1]._grand_fraction) + fraction;
				cumulated += fraction;
				inclusivePerQty += perQty * item.qty;
			});
			if ((cumulated || inclusivePerQty) && _flt(item.discount_percentage) !== 100) {
				const amount = _flt(item.amount) - inclusivePerQty;
				item.net_amount = _flt(amount / (1 + cumulated), P);
				item.net_rate = item.qty ? _flt(item.net_amount / item.qty, P) : 0;
			}
		}
	}

	const computeTaxes = () => {
		const netTotal = _flt(
			items.reduce((s, i) => s + _flt(i.net_amount), 0),
			P
		);
		doc.net_total = netTotal;
		for (const tax of taxes) {
			tax.tax_amount_computed = 0;
			tax._actual_left = _flt(tax.charge_type === "Actual" ? tax.tax_amount_input ?? tax.tax_amount : 0, P);
		}
		items.forEach((item, n) => {
			taxes.forEach((tax, i) => {
				const r = taxRate(tax, item);
				let current = 0;
				if (tax.charge_type === "Actual") {
					const actual = _flt(tax.tax_amount_input ?? tax.tax_amount, P);
					current = netTotal ? (item.net_amount * actual) / netTotal : 0;
					if (n === items.length - 1) current = tax._actual_left; // put rounding leftover on last item
					else tax._actual_left = _flt(tax._actual_left - _flt(current, P), P);
				} else if (tax.charge_type === "On Net Total") current = (r / 100) * item.net_amount;
				else if (tax.charge_type === "On Previous Row Amount")
					current = (r / 100) * (taxes[tax.row_id - 1]?._item_tax || 0);
				else if (tax.charge_type === "On Previous Row Total")
					current = (r / 100) * (taxes[tax.row_id - 1]?._item_grand || 0);
				else if (tax.charge_type === "On Item Quantity") current = r * item.qty;
				current = _flt(current, P);
				tax._item_tax = current;
				tax._item_grand = _flt((i === 0 ? item.net_amount : taxes[i - 1]._item_grand) + current, P);
				tax.tax_amount_computed = _flt(tax.tax_amount_computed + current, P);
			});
		});
		let running = netTotal;
		for (const tax of taxes) {
			if (tax.charge_type === "Actual" && tax.tax_amount_input === undefined) tax.tax_amount_input = tax.tax_amount;
			tax.tax_amount = tax.tax_amount_computed;
			tax.tax_amount_after_discount_amount = tax.tax_amount;
			tax.base_tax_amount = tax.tax_amount;
			running = _flt(running + tax.tax_amount, P);
			tax.total = running;
			tax.base_total = running;
		}
		doc.total_taxes_and_charges = _flt(
			taxes.reduce((s, t) => s + t.tax_amount, 0),
			P
		);
		return running;
	};

	doc.total = _flt(
		items.reduce((s, i) => s + i.amount, 0),
		P
	);
	let grand = computeTaxes();

	// ---- additional discount
	let discount = _flt(doc.discount_amount, P);
	if (!discount && _flt(doc.additional_discount_percentage)) {
		const base = doc.apply_discount_on === "Net Total" ? doc.net_total : grand;
		discount = _flt((base * _flt(doc.additional_discount_percentage)) / 100, P);
		doc.discount_amount = discount;
	}
	if (discount) {
		// erpnext apply_discount_amount() / get_total_for_discount_amount()
		let totalForDiscount;
		if (doc.apply_discount_on === "Net Total") {
			totalForDiscount = doc.net_total;
		} else {
			const actual = {};
			for (const tax of taxes) {
				if (tax.charge_type === "Actual" || tax.charge_type === "On Item Quantity") actual[tax.idx] = tax.tax_amount;
				else if (tax.row_id && tax.row_id in actual) actual[tax.idx] = (_flt(actual[tax.row_id]) * _flt(tax.rate)) / 100;
			}
			totalForDiscount = _flt(grand - Object.values(actual).reduce((a, b) => a + _flt(b), 0), P);
		}
		if (totalForDiscount) {
			const netBefore = doc.net_total;
			let netAfter = 0;
			items.forEach((item, idx) => {
				const share = (discount * item.net_amount) / totalForDiscount;
				item.net_amount = _flt(item.net_amount - share, P);
				netAfter += item.net_amount;
				if (
					idx === items.length - 1 &&
					(doc.apply_discount_on === "Net Total" || !taxes.length || totalForDiscount === netBefore)
				) {
					const loss = _flt(netBefore - netAfter - discount, P);
					item.net_amount = _flt(item.net_amount + loss, P);
				}
				item.net_rate = item.qty ? _flt(item.net_amount / item.qty, P) : 0;
			});
			grand = computeTaxes();
		}
	}

	doc.grand_total = _flt(grand, P);
	doc.base_grand_total = doc.grand_total;
	doc.base_net_total = doc.net_total;
	doc.base_total = doc.total;
	if (opts.disableRoundedTotal) {
		doc.rounded_total = 0;
		doc.rounding_adjustment = 0;
	} else {
		doc.rounded_total = roundBasedOnSmallestFraction(doc.grand_total, opts.smallestFraction || 0, P);
		doc.rounding_adjustment = _flt(doc.rounded_total - doc.grand_total, P);
	}
	doc.base_rounded_total = doc.rounded_total;
	doc.total_qty = _flt(
		items.reduce((s, i) => s + _flt(i.qty), 0),
		opts.floatPrecision ?? 3
	);
	for (const item of items) delete item._tax_map;
	for (const tax of taxes) {
		delete tax._fraction;
		delete tax._grand_fraction;
		delete tax._item_tax;
		delete tax._item_grand;
		delete tax._actual_left;
		delete tax.tax_amount_computed;
	}
	return doc;
}

/** Payment totals: paid, change and outstanding like Sales Invoice. */
export function calculatePayments(doc, opts = {}) {
	const P = opts.currencyPrecision ?? 2;
	const total = doc.rounded_total || doc.grand_total;
	const paid = _flt(
		(doc.payments || []).reduce((s, p) => s + _flt(p.amount), 0) + _flt(doc.loyalty_amount),
		P
	);
	doc.paid_amount = paid;
	doc.base_paid_amount = paid;
	const hasCash = (doc.payments || []).some((p) => p.type === "Cash" && _flt(p.amount));
	doc.change_amount = paid > total && hasCash ? _flt(paid - total, P) : 0;
	doc.base_change_amount = doc.change_amount;
	doc.outstanding_amount = _flt(total - paid + doc.change_amount - _flt(doc.write_off_amount), P);
	return doc;
}
