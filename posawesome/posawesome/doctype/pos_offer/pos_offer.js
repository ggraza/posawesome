// Copyright (c) 2021, Youssef Restom and contributors
// For license information, please see license.txt

frappe.ui.form.on('POS Offer', {
	setup: function (frm) {
		set_filters(frm);
		controllers(frm);
	},
	refresh: function (frm) {
		controllers(frm);
	},
	onload: function (frm) {
		set_filters(frm);
		fill_lists(frm);
		controllers(frm);
		if (frm.is_new()) default_price_lists(frm);
	},
	pos_profile: function (frm) {
		default_price_lists(frm);
	},
	show_item_details: function (frm) {
		show_item_details(frm);
	},
	buying_price_list: (frm) => refresh_item_rows(frm),
	mrp_price_list: (frm) => refresh_item_rows(frm),
	sale_price_list: (frm) => refresh_item_rows(frm),
	warehouse: (frm) => refresh_item_rows(frm),
	rate: (frm) => refresh_item_rows(frm),
	discount_amount: (frm) => refresh_item_rows(frm),
	discount_percentage: (frm) => refresh_item_rows(frm),
	validate: function (frm) {
		if (frm.doc.apply_on === 'Transaction') {
			if (!frm.doc.min_amt > 0) {
				frappe.throw("Min Amount most be more then zero");
			}
		}
		if (frm.doc.offer === 'Give Product') {
			if (!frm.doc.given_qty > 0) {
				frappe.throw("Given Quantity most be more then zero");
			}
		}
		if (frm.doc.offer === 'Loyalty Point') {
			if (!frm.doc.loyalty_points > 0) {
				frappe.throw("Loyalty Points most be more then zero");
			}
		}
		if (frm.doc.apply_type === 'Item Group' && frm.doc.offer === 'Give Product' && !frm.doc.replace_item && !frm.doc.replace_cheapest_item) {
			frm.set_value('auto', 0);
		}
	},
	apply_on: function (frm) {
		controllers(frm);
	},
	offer: function (frm) {
		controllers(frm);
		refresh_item_rows(frm);
	},
	apply_type: function (frm) {
		controllers(frm);
	},
	discount_type: function (frm) {
		controllers(frm);
		refresh_item_rows(frm);
	},
	replace_item: function (frm) {
		controllers(frm);
	},
	replace_cheapest_item: function (frm) {
		controllers(frm);
	},
});


const controllers = (frm) => {
	// Items, groups and brands are picked in the lists; the old single
	// fields are filled from the first row on save.
	const multi = !!frm.fields_dict.offer_items;
	frm.toggle_display('item', !multi && frm.doc.apply_on === 'Item Code');
	frm.toggle_reqd('item', !multi && frm.doc.apply_on === 'Item Code');
	frm.toggle_display('offer_items', multi && frm.doc.apply_on === 'Item Code');
	frm.toggle_reqd('offer_items', multi && frm.doc.apply_on === 'Item Code');

	frm.toggle_display('item_group', !multi && frm.doc.apply_on === 'Item Group');
	frm.toggle_reqd('item_group', !multi && frm.doc.apply_on === 'Item Group');
	frm.toggle_display('offer_item_groups', multi && frm.doc.apply_on === 'Item Group');
	frm.toggle_reqd('offer_item_groups', multi && frm.doc.apply_on === 'Item Group');

	frm.toggle_display('brand', !multi && frm.doc.apply_on === 'Brand');
	frm.toggle_reqd('brand', !multi && frm.doc.apply_on === 'Brand');
	frm.toggle_display('offer_brands', multi && frm.doc.apply_on === 'Brand');
	frm.toggle_reqd('offer_brands', multi && frm.doc.apply_on === 'Brand');

	frm.toggle_reqd('min_amt', frm.doc.apply_on === 'Transaction');
	frm.toggle_display('show_item_details', ['Item Code', 'Item Group', 'Brand'].includes(frm.doc.apply_on));

	frm.toggle_display('apply_for_section', frm.doc.offer === 'Give Product');
	frm.toggle_reqd('apply_type', frm.doc.offer === 'Give Product');

	frm.toggle_display('replace_item', frm.doc.apply_on === 'Item Code' && frm.doc.offer === 'Give Product' && frm.doc.apply_type === 'Item Code');
	frm.toggle_display('replace_cheapest_item', frm.doc.apply_on === 'Item Group' && frm.doc.offer === 'Give Product' && frm.doc.apply_type === 'Item Group');

	frm.toggle_display('apply_item_code', frm.doc.apply_type === 'Item Code' && !frm.doc.replace_item);
	frm.toggle_reqd('apply_item_code', frm.doc.apply_type === 'Item Code' && !frm.doc.replace_item);

	frm.toggle_display('apply_item_group', frm.doc.apply_type === 'Item Group' && !frm.doc.replace_cheapest_item);
	frm.toggle_reqd('apply_item_group', frm.doc.apply_type === 'Item Group' && !frm.doc.replace_cheapest_item);

	frm.toggle_display('less_then', frm.doc.apply_type === 'Item Group' && !frm.doc.replace_cheapest_item);

	frm.toggle_display('product_discount_scheme_section', frm.doc.offer === 'Give Product');
	frm.toggle_display('given_qty', frm.doc.offer === 'Give Product');
	frm.toggle_reqd('given_qty', frm.doc.offer === 'Give Product');

	frm.toggle_display('price_discount_scheme_section', frm.doc.offer !== 'Loyalty Point');
	frm.toggle_display('discount_type', frm.doc.offer !== 'Loyalty Point');
	frm.toggle_reqd('discount_type', frm.doc.offer !== 'Loyalty Point');

	frm.toggle_display('rate', frm.doc.discount_type === 'Rate');
	frm.toggle_reqd('rate', frm.doc.discount_type === 'Rate');

	frm.toggle_display('discount_amount', frm.doc.discount_type === 'Discount Amount');
	frm.toggle_reqd('discount_amount', frm.doc.discount_type === 'Discount Amount');

	frm.toggle_display('discount_percentage', frm.doc.discount_type === 'Discount Percentage');
	frm.toggle_reqd('discount_percentage', frm.doc.discount_type === 'Discount Percentage');

	frm.toggle_display('loyalty_point_scheme_section', frm.doc.offer === 'Loyalty Point');
	frm.toggle_display('loyalty_program', frm.doc.offer === 'Loyalty Point');
	frm.toggle_reqd('loyalty_program', frm.doc.offer === 'Loyalty Point');

	frm.toggle_display('loyalty_points', frm.doc.offer === 'Loyalty Point');
	frm.toggle_reqd('loyalty_points', frm.doc.offer === 'Loyalty Point');

	if (frm.doc.offer === 'Grand Total') {
		frm.set_df_property('discount_type', 'options', ['Discount Percentage', 'Discount Amount']);
	} else {
		frm.set_df_property('discount_type', 'options', ['', 'Rate', 'Discount Percentage', 'Discount Amount']);
	}

	if (frm.doc.apply_on === 'Transaction') {
		frm.set_df_property('offer', 'options', ['', 'Give Product', 'Grand Total', 'Loyalty Point']);
	} else {
		frm.set_df_property('offer', 'options', ['', 'Item Price', 'Give Product', 'Grand Total', 'Loyalty Point']);
	}

	if (frm.doc.apply_type === 'Item Group' && frm.doc.offer === 'Give Product' && !frm.doc.replace_item && !frm.doc.replace_cheapest_item) {
		frm.set_value('auto', 0);
	}
	if (frm.doc.apply_on !== 'Item Code' || frm.doc.offer !== 'Give Product' || frm.doc.apply_type !== 'Item Code') {
		frm.set_value('replace_item', 0);
	}
	if (frm.doc.apply_on !== 'Item Group' || frm.doc.offer !== 'Give Product' || frm.doc.apply_type !== 'Item Group') {
		frm.set_value('replace_cheapest_item', 0);
	}

};

const set_filters = (frm) => {
	frm.set_query('buying_price_list', () => ({ filters: { buying: 1 } }));
	frm.set_query('mrp_price_list', () => ({ filters: { selling: 1 } }));
	frm.set_query('sale_price_list', () => ({ filters: { selling: 1 } }));
	frm.set_query('pos_profile', function () {
		return {
			filters: {
				'company': frm.doc.company,
			}
		};
	});
	frm.set_query('warehouse', function () {
		return {
			filters: {
				'company': frm.doc.company,
				'is_group': 0,
			}
		};
	});
	frm.set_query('loyalty_program', function () {
		return {
			filters: {
				'company': frm.doc.company,
			}
		};
	});
	frm.set_query('item_group', function () {
		return {
			filters: {
				'is_group': 0,
			}
		};
	});
	frm.set_query('item_group', 'offer_item_groups', function () {
		return {
			filters: {
				'is_group': 0,
			}
		};
	});
	frm.set_query('apply_item_group', function () {
		return {
			filters: {
				'is_group': 0,
			}
		};
	});
};

// An offer saved before the lists existed: show its single value in the list.
const fill_lists = (frm) => {
	if (!frm.fields_dict.offer_items) return;
	[
		['item', 'offer_items', 'item_code'],
		['item_group', 'offer_item_groups', 'item_group'],
		['brand', 'offer_brands', 'brand'],
	].forEach(([single, table, link]) => {
		if (frm.doc[single] && !(frm.doc[table] || []).length) {
			frm.add_child(table, { [link]: frm.doc[single] });
			frm.refresh_field(table);
		}
	});
};


// ---------------------------------------------------------------------------
// Item details for the person making the offer: Current TP, MRP, sale rate
// and the margin before and after the offer. Information only.
// ---------------------------------------------------------------------------

frappe.ui.form.on('POS Offer Item', {
	item_code: (frm, cdt, cdn) => refresh_item_rows(frm, [locals[cdt][cdn]]),
	uom: (frm, cdt, cdn) => refresh_item_rows(frm, [locals[cdt][cdn]]),
});

const DETAIL_FIELDS = [
	'item_name', 'barcode', 'uom', 'conversion_factor', 'buying_rate', 'mrp', 'sale_rate', 'valuation_rate',
	'gp_rate', 'gp_percent', 'discount_value', 'discounted_price', 'after_disc_gp', 'after_disc_gp_percent',
];

const default_price_lists = (frm) => {
	if (!frm.fields_dict.sale_price_list) return;
	const fill = (field, value) => {
		if (value && !frm.doc[field]) frm.set_value(field, value);
	};
	if (frm.doc.pos_profile) {
		frappe.db.get_value('POS Profile', frm.doc.pos_profile, ['selling_price_list', 'posa_mrp_price_list']).then((r) => {
			const p = (r && r.message) || {};
			fill('sale_price_list', p.selling_price_list);
			fill('mrp_price_list', p.posa_mrp_price_list);
		});
	} else if (frm.is_new()) {
		frappe.db.get_single_value('Selling Settings', 'selling_price_list').then((v) => fill('sale_price_list', v));
	}
	if (frm.is_new() || !frm.doc.buying_price_list) {
		frappe.db.get_single_value('Buying Settings', 'buying_price_list').then((v) => fill('buying_price_list', v));
	}
};

let refresh_timer = null;
const refresh_item_rows = (frm, rows) => {
	if (!frm.fields_dict.offer_items || frm.doc.apply_on !== 'Item Code') return;
	clearTimeout(refresh_timer);
	refresh_timer = setTimeout(() => {
		rows = (rows || frm.doc.offer_items || []).filter((r) => r.item_code);
		if (!rows.length) return;
		frappe.call({
			method: 'posawesome.posawesome.doctype.pos_offer.pos_offer.get_item_details',
			args: { doc: frm.doc, rows: rows.map((r) => ({ item_code: r.item_code, uom: r.uom })) },
			callback: (r) => {
				(r.message || []).forEach((info, i) => {
					const row = rows[i];
					DETAIL_FIELDS.forEach((f) => {
						if (info[f] !== undefined) row[f] = info[f];
					});
				});
				frm.refresh_field('offer_items');
			},
		});
	}, 300);
};

const show_item_details = (frm) => {
	frappe.call({
		method: 'posawesome.posawesome.doctype.pos_offer.pos_offer.preview_items',
		args: { doc: frm.doc },
		freeze: true,
		callback: (r) => {
			const data = r.message || { rows: [], total: 0 };
			const d = new frappe.ui.Dialog({
				title: __('Items in this offer') + ` (${data.total})`,
				size: 'extra-large',
				fields: [
					{ fieldtype: 'Data', fieldname: 'search', label: __('Search barcode, code or name') },
					{ fieldtype: 'HTML', fieldname: 'table' },
				],
			});
			const draw = (q) => {
				q = (q || '').toLowerCase();
				const rows = data.rows.filter((x) => !q || [x.barcode, x.item_code, x.item_name].some((v) => (v || '').toLowerCase().includes(q)));
				d.fields_dict.table.$wrapper.html(item_table(rows, data));
			};
			d.fields_dict.search.$input.on('input', (e) => draw(e.target.value));
			draw('');
			d.show();
		},
	});
};

const num = (v, digits = 3) => {
	const n = Number(v) || 0;
	return n.toLocaleString(undefined, { maximumFractionDigits: digits });
};
const esc = (s) => frappe.utils.escape_html(String(s == null ? '' : s));

const item_table = (rows, data) => {
	const cols = [
		['Sr.', null], ['Barcode', 'barcode'], ['Product Name', 'item_name'], ['UOM', 'uom'], ['Packing', 'conversion_factor'],
		['Current TP', 'buying_rate'], ['MRP', 'mrp'], ['Sale Rate', 'sale_rate'], ['Valuation Rate', 'valuation_rate'],
		['GP Rate', 'gp_rate'], ['GP %', 'gp_percent'], ['Disc Amt', 'discount_value'], ['Disc Price', 'discounted_price'],
		['After Disc. GP Amount', 'after_disc_gp'], ['After Disc. GP %', 'after_disc_gp_percent'],
	];
	const text = ['barcode', 'item_name', 'uom'];
	const head = cols.map(([l]) => `<th>${esc(__(l))}</th>`).join('');
	const body = rows.map((x, i) => '<tr>' + cols.map(([, f]) => {
		if (!f) return `<td>${i + 1}</td>`;
		if (text.includes(f)) return `<td class="txt" title="${esc(f === 'item_name' ? x.item_code + ' ' + x.item_name : x[f])}">${esc(x[f])}</td>`;
		const neg = Number(x[f]) < 0 ? ' neg' : '';
		return `<td class="n${neg}">${num(x[f])}</td>`;
	}).join('') + '</tr>').join('');
	const more = data.total > data.rows.length ? `<div class="text-muted small mt-2">${__('Showing the first {0} of {1} items.', [data.rows.length, data.total])}</div>` : '';
	return `<style>
		.posa-offer-items{max-height:60vh;overflow:auto;border:1px solid var(--border-color)}
		.posa-offer-items table{width:100%;border-collapse:collapse;font-size:12px}
		.posa-offer-items th{position:sticky;top:0;background:var(--subtle-fg,#f3f3f3);font-weight:600;text-align:center;padding:6px;border:1px solid var(--border-color);white-space:normal}
		.posa-offer-items td{padding:4px 6px;border:1px solid var(--border-color);white-space:nowrap}
		.posa-offer-items td.txt{max-width:220px;overflow:hidden;text-overflow:ellipsis}
		.posa-offer-items td.n{text-align:right}
		.posa-offer-items td.neg{color:var(--red-600,#c0392b);font-weight:600}
		.posa-offer-items tr:nth-child(even) td{background:var(--subtle-accent,#fafafa)}
	</style>
	<div class="posa-offer-items"><table><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${cols.length}" class="text-center text-muted">${__('No items')}</td></tr>`}</tbody></table></div>${more}
	<div class="text-muted small mt-2">${__('GP % is on the Current TP. Disc Amt is what this offer takes off the sale rate.')}</div>`;
};


// ----------------------------------------------------------------- Help tab
// Purpose and usage of POS Offer, shown in the Help tab (HTML field pos_offer_help).
frappe.ui.form.on("POS Offer", {
    refresh: function (frm) {
        if (frm.fields_dict.pos_offer_help) {
            frm.set_df_property("pos_offer_help", "options", posa_pos_offer_help_content());
        }
    },
});

function posa_pos_offer_help_content() {
    var help_content = `<table class="table table-bordered" style="background-color: var(--scrollbar-track-color);">
            <tr>
                <td>
                    <h4><i class="fa fa-gift"></i> {{__("POS Offer Overview")}}</h4>
                    <ul>
                        <li>{{__("A POS Offer is a promotion the POS applies to the cart: a discount on items, a free product, a discount on the bill or loyalty points.")}}</li>
                        <li>{{__("Offers are checked every time an item is added or its quantity changes, in the retail POS, the waiter app and the customer price checker.")}}</li>
                        <li>{{__("Offers are part of each terminal's offline catalogue: they keep working when the server is down and new or changed offers reach open terminals within seconds.")}}</li>
                        <li>{{__("An offer is never applied twice on the same row; a held invoice that is resumed keeps its offer prices.")}}</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-list-ol"></i> {{__("Setup Flow")}}</h4>
                    <ol>
                        <li>{{__("Enter a Title (shown to the cashier and on the price checker) and the Company.")}}</li>
                        <li>{{__("Optional: choose a POS Profile to limit the offer to one terminal group, and a Warehouse. Empty = every POS Profile of the company.")}}</li>
                        <li>{{__("Choose the Qualifying Transaction / Item (Apply On): Item Code, Item Group, Brand or Transaction (whole bill).")}}</li>
                        <li>{{__("Fill the matching list: Apply Rule On Item Codes, Item Groups or Brands. One offer can cover many items, groups or brands.")}}</li>
                        <li>{{__("Set the conditions: Min / Max Quantity, Min / Max Amount, Valid From and Valid Upto.")}}</li>
                        <li>{{__("Choose the Promo Type and fill its scheme (see below).")}}</li>
                        <li>{{__("Tick Auto Apply to apply it by itself; untick it to let the cashier pick it in the Offers panel.")}}</li>
                        <li>{{__("Tick Coupon Code Based if the offer must only work with a POS Coupon code.")}}</li>
                        <li>{{__("Save. Open terminals receive the offer within a few seconds.")}}</li>
                    </ol>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-tags"></i> {{__("Promo Types")}}</h4>
                    <ul>
                        <li><b>{{__("Item Price")}}</b> - {{__("Discount on the qualifying items: Discount Type Rate (new price), Discount Percentage or Discount Amount per unit.")}}</li>
                        <li><b>{{__("Give Product")}}</b> - {{__("Adds a product when the condition is met: Apply Type Item Code or Item Group, the item, and Given Quantity. Discount Type Rate 0 makes it free. Replace Same Item gives the same item; Replace Cheapest Item discounts the cheapest qualifying row; Item Rate Should Less Then limits the value of the given item.")}}</li>
                        <li><b>{{__("Repeat For Every Min Quantity")}}</b> - {{__("One offer for buy 10 get 1, buy 20 get 2, buy 30 get 3 and so on: Min Quantity 10, Given Quantity 1, tick Repeat For Every Min Quantity. The free quantity follows the cart as the cashier adds or removes items. Max Free Quantity (optional) caps the free quantity per invoice. Not used with Replace Same Item / Replace Cheapest Item; leave Max Quantity empty.")}}</li>
                        <li><b>{{__("Grand Total")}}</b> - {{__("Discount on the whole bill when the bill meets Min / Max Amount (Apply On = Transaction).")}}</li>
                        <li><b>{{__("Loyalty Point")}}</b> - {{__("Gives Loyalty Points of the chosen Loyalty Program instead of a discount.")}}</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-table"></i> {{__("Offer Items Details")}}</h4>
                    <ul>
                        <li><b>{{__("Current TP / MRP / Sale Price Lists")}}</b> - {{__("Price lists used to show cost, MRP and sale price of each offer item.")}}</li>
                        <li><b>{{__("Offer Items table")}}</b> - {{__("Barcode, UOM, packing, TP, MRP, sale rate, valuation, GP and the price after the discount, so the buyer sees the margin before saving.")}}</li>
                        <li><b>{{__("Show Item Details")}}</b> - {{__("Popup with the same columns for every item of the chosen groups or brands (up to 1,000 rows).")}}</li>
                        <li><b>{{__("Discount Category")}}</b> - {{__("Seasonal, Quantity Base, Stock Clearance or Happy Hours, for reporting.")}}</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-shopping-cart"></i> {{__("What the Cashier Sees")}}</h4>
                    <ul>
                        <li>{{__("Auto offers are applied as soon as the cart qualifies; the row is marked in the Offer column.")}}</li>
                        <li>{{__("Free items added by a Give Product offer appear at the top of the cart and are removed when the condition is no longer met.")}}</li>
                        <li>{{__("Manual offers are listed in the Offers panel; the cashier ticks the one to apply.")}}</li>
                        <li>{{__("The customer price checker shows running offers for the scanned item.")}}</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-lightbulb-o"></i> {{__("Best Practices")}}</h4>
                    <ul>
                        <li>{{__("Always set Valid Upto; expired offers stop by themselves.")}}</li>
                        <li>{{__("Avoid two auto offers on the same item; the cashier and customer see only one result.")}}</li>
                        <li>{{__("Disable an offer instead of deleting it, so old invoices keep their reference.")}}</li>
                        <li>{{__("Test a new offer on one terminal (scan, change qty, hold and resume) before a busy day.")}}</li>
                    </ul>
                </td>
            </tr>
        </table>`;
    return help_content;
}
