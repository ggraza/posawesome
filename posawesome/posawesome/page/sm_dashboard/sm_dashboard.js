// Supermarket Manager Dashboard: the day's sales of the POS Profiles with
// Supermarket > Manager Dashboard ticked. Refreshes every minute.
frappe.pages["sm_dashboard"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({ parent: wrapper, title: __("Manager Dashboard"), single_column: true });
	const esc = (v) => frappe.utils.escape_html(v == null ? "" : String(v));
	const API = "posawesome.posawesome.api.sm_manage.";
	const f = {};
	f.date = page.add_field({ fieldname: "date", label: __("Date"), fieldtype: "Date", default: frappe.datetime.get_today(), change: load });
	f.company = page.add_field({ fieldname: "company", label: __("Company"), fieldtype: "Link", options: "Company", change: load });
	f.pos_profile = page.add_field({ fieldname: "pos_profile", label: __("POS Profile"), fieldtype: "Link", options: "POS Profile", change: load });
	page.set_secondary_action(__("Refresh"), () => load());
	page.add_menu_item(__("Till Monitor"), () => frappe.set_route("sm_till_monitor"));
	page.add_menu_item(__("POS Loss Prevention"), () => frappe.set_route("query-report", "POS Loss Prevention"));
	page.add_menu_item(__("POS Offer Effectiveness"), () => frappe.set_route("query-report", "POS Offer Effectiveness"));
	page.add_menu_item(__("POS Fast and Slow Movers"), () => frappe.set_route("query-report", "POS Fast and Slow Movers"));

	const $b = $(`<div class="smd p-2">
		<div class="smd-msg text-muted"></div>
		<div class="smd-kpi"></div>
		<div class="smd-box"><div class="smd-h">${__("Sales per Hour")}</div><div class="smd-chart"></div></div>
		<div class="smd-cols">
			<div class="smd-box"><div class="smd-h">${__("Cashiers")}</div><table class="table table-sm smd-cashiers"></table></div>
			<div class="smd-box"><div class="smd-h">${__("Top Items")}</div><table class="table table-sm smd-top"></table></div>
		</div>
		<div class="smd-box"><div class="smd-h">${__("POS Profiles")}</div><table class="table table-sm smd-tills"></table></div>
		<div class="smd-time text-muted small"></div></div>`).appendTo(page.body);
	$(`<style>
	.smd-kpi{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px;margin-bottom:16px}
	.smd-kpi .k{border:1px solid var(--border-color);border-radius:10px;padding:12px 14px}
	.smd-kpi .k span{display:block;color:var(--text-muted);font-size:12px}.smd-kpi .k b{display:block;font-size:20px;margin-top:2px}
	.smd-box{border:1px solid var(--border-color);border-radius:10px;padding:12px 14px;margin-bottom:16px}
	.smd-h{font-weight:600;margin-bottom:8px}.smd-cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}
	@media (max-width:900px){.smd-cols{grid-template-columns:1fr}}
	</style>`).appendTo(page.body);

	let chart = null;
	let currency = null;
	const money = (v) => format_currency(v || 0, currency);
	const num = (v, d = 0) => format_number(v || 0, null, d);

	function table($t, head, rows) {
		$t.html(
			`<thead><tr>${head.map((h) => `<th class="${h[1] || ""}">${esc(h[0])}</th>`).join("")}</tr></thead><tbody>${
				rows.length ? rows.join("") : `<tr><td colspan="${head.length}" class="text-muted">${__("No sales yet")}</td></tr>`
			}</tbody>`
		);
	}

	function render(d) {
		$b.find(".smd-msg").text(d.enabled ? "" : __("Tick Supermarket > Management > Manager Dashboard on a POS Profile."));
		$b.find(".smd-kpi, .smd-box").toggle(!!d.enabled);
		if (!d.enabled) return;
		currency = d.currency;
		const k = d.kpi;
		const cards = [
			[__("Sales (incl. tax)"), money(k.gross_sales)],
			[__("Net Sales"), money(k.net_sales)],
			[__("Invoices"), num(k.invoices)],
			[__("Average Basket"), money(k.basket)],
			[__("Items per Basket"), num(k.items_per_basket, 1)],
			[__("Returns"), `${num(k.returns)} · ${money(k.returns_amount)}`],
			[__("Discounts"), money(k.discounts)],
			[__("Voids"), `${num(k.voids)} · ${money(k.void_amount)}`],
			[__("No Sales"), num(k.no_sales)],
		];
		$b.find(".smd-kpi").html(cards.map((c) => `<div class="k"><span>${esc(c[0])}</span><b>${c[1]}</b></div>`).join(""));
		const labels = d.hours.map((h) => (h.hour < 10 ? "0" : "") + h.hour + ":00");
		const data = { labels, datasets: [{ name: __("Sales"), values: d.hours.map((h) => h.sales) }] };
		if (chart) chart.update(data);
		else chart = new frappe.Chart($b.find(".smd-chart")[0], { type: "bar", height: 220, data, colors: ["#0F766E"], axisOptions: { xIsSeries: true } });
		table(
			$b.find(".smd-cashiers"),
			[[__("Cashier")], [__("POS Profile")], [__("Invoices"), "text-right"], [__("Sales"), "text-right"], [__("Basket"), "text-right"]],
			d.cashiers.map((c) => `<tr><td>${esc(c.user_name)}</td><td>${esc(c.pos_profile)}</td><td class="text-right">${num(c.invoices)}</td>
				<td class="text-right">${money(c.sales)}</td><td class="text-right">${money(c.basket)}</td></tr>`)
		);
		table(
			$b.find(".smd-top"),
			[[__("Item")], [__("Qty"), "text-right"], [__("Amount"), "text-right"]],
			d.top_items.map((i) => `<tr><td>${esc(i.item_name)}<div class="small text-muted">${esc(i.item_code)}</div></td>
				<td class="text-right">${num(i.qty, 2)}</td><td class="text-right">${money(i.amount)}</td></tr>`)
		);
		table(
			$b.find(".smd-tills"),
			[[__("POS Profile")], [__("Invoices"), "text-right"], [__("Sales"), "text-right"]],
			d.tills.map((t) => `<tr><td>${esc(t.pos_profile)}</td><td class="text-right">${num(t.invoices)}</td><td class="text-right">${money(t.sales)}</td></tr>`)
		);
		$b.find(".smd-time").text(__("Updated {0}", [frappe.datetime.str_to_user(frappe.datetime.now_datetime())]));
	}

	function load() {
		frappe
			.call({
				method: API + "dashboard",
				args: { date: f.date.get_value() || null, company: f.company.get_value() || null, pos_profile: f.pos_profile.get_value() || null },
			})
			.then((r) => render(r.message || {}));
	}
	load();
	const timer = setInterval(() => {
		if (frappe.get_route_str() === "sm_dashboard" && !document.hidden) load();
	}, 60000);
	$(wrapper).on("remove", () => clearInterval(timer));
};
