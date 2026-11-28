// Supermarket Till Monitor: every till of the POS Profiles with Supermarket >
// Till Monitor ticked. Tills report every minute; the page refreshes every 30 s.
frappe.pages["sm_till_monitor"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({ parent: wrapper, title: __("Till Monitor"), single_column: true });
	const esc = (v) => frappe.utils.escape_html(v == null ? "" : String(v));
	const API = "posawesome.posawesome.api.sm_manage.";
	const f = {};
	f.company = page.add_field({ fieldname: "company", label: __("Company"), fieldtype: "Link", options: "Company", change: load });
	f.pos_profile = page.add_field({ fieldname: "pos_profile", label: __("POS Profile"), fieldtype: "Link", options: "POS Profile", change: load });
	page.set_secondary_action(__("Refresh"), () => load());
	page.add_menu_item(__("All Tills (POS Till Status)"), () => frappe.set_route("List", "POS Till Status"));

	const $b = $(`<div class="tm p-2">
		<div class="tm-sum mb-3"></div>
		<div class="tm-msg text-muted"></div>
		<table class="table table-sm tm-table"><thead><tr>
			<th>${__("State")}</th><th>${__("Till")}</th><th>${__("POS Profile")}</th><th>${__("Cashier")}</th><th>${__("Shift Since")}</th>
			<th class="text-right">${__("Sales Today")}</th><th class="text-right">${__("Invoices")}</th><th>${__("Last Sale")}</th>
			<th class="text-right">${__("Offline Waiting")}</th><th class="text-right">${__("Failed")}</th><th>${__("Last Report")}</th><th>${__("Last Upload")}</th>
		</tr></thead><tbody></tbody></table>
		<div class="tm-time text-muted small"></div></div>`).appendTo(page.body);
	$(`<style>.tm-table td{vertical-align:middle}.tm-sum .tm-card{display:inline-block;min-width:150px;margin:0 12px 8px 0;padding:10px 14px;border:1px solid var(--border-color);border-radius:10px}
	.tm-sum .tm-card b{display:block;font-size:22px}.tm-bad{color:var(--red-600);font-weight:600}</style>`).appendTo(page.body);

	const ago = (v) => (v ? frappe.datetime.comment_when(v) : "");
	const pill = (state) => {
		const color = state === "Live" ? "green" : state === "Not Reporting" ? "gray" : "orange";
		return `<span class="indicator-pill ${color}">${esc(__(state))}</span>`;
	};

	function render(data) {
		const rows = data.rows || [];
		$b.find(".tm-msg").text(
			!data.enabled ? __("Tick Supermarket > Management > Till Monitor on a POS Profile (the tills need the new version and a reload).") : rows.length ? "" : __("No tills have reported yet.")
		);
		const live = rows.filter((r) => r.state === "Live").length;
		const waiting = rows.reduce((t, r) => t + (r.offline_pending || 0), 0);
		const failed = rows.reduce((t, r) => t + (r.offline_failed || 0), 0);
		const sales = rows.reduce((t, r) => t + (r.sales || 0), 0);
		$b.find(".tm-sum").html(
			data.enabled
				? `<div class="tm-card">${__("Tills Live")}<b>${live} / ${rows.length}</b></div>
				<div class="tm-card">${__("Offline Invoices Waiting")}<b class="${waiting ? "tm-bad" : ""}">${waiting}</b></div>
				<div class="tm-card">${__("Failed Uploads")}<b class="${failed ? "tm-bad" : ""}">${failed}</b></div>
				<div class="tm-card">${__("Sales of Open Shifts")}<b>${format_currency(sales)}</b></div>`
				: ""
		);
		$b.find("tbody").html(
			rows
				.map((r) => {
					const till = r.name ? `<a href="/desk/pos-till-status/${encodeURIComponent(r.name)}">${esc(r.till_name)}</a>` : esc(r.till_name);
					return `<tr>
					<td>${pill(r.state)}</td><td>${till}</td><td>${esc(r.pos_profile)}</td><td>${esc(r.user_name || r.user)}</td>
					<td>${r.shift_open ? esc(frappe.datetime.str_to_user(r.shift_start)) : `<span class="text-muted">${__("no open shift")}</span>`}</td>
					<td class="text-right">${r.sales == null ? "" : format_currency(r.sales)}</td><td class="text-right">${r.invoices == null ? "" : esc(r.invoices)}</td>
					<td>${esc(ago(r.last_sale))}</td>
					<td class="text-right ${r.offline_pending ? "tm-bad" : ""}">${r.offline_pending == null ? "" : esc(r.offline_pending)}</td>
					<td class="text-right ${r.offline_failed ? "tm-bad" : ""}">${r.offline_failed == null ? "" : esc(r.offline_failed)}</td>
					<td>${esc(ago(r.last_seen))}</td><td>${esc(ago(r.last_sync))}</td></tr>`;
				})
				.join("")
		);
		$b.find(".tm-time").text(__("Updated {0}", [frappe.datetime.str_to_user(data.now || frappe.datetime.now_datetime())]));
	}

	function load() {
		frappe
			.call({ method: API + "till_monitor", args: { company: f.company.get_value() || null, pos_profile: f.pos_profile.get_value() || null } })
			.then((r) => render(r.message || {}));
	}
	load();
	const timer = setInterval(() => {
		if (frappe.get_route_str() === "sm_till_monitor" && !document.hidden) load();
	}, 30000);
	$(wrapper).on("remove", () => clearInterval(timer));
};
