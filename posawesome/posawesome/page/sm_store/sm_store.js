// Supermarket store work on a handheld: stock count (works offline; the count
// is kept on the device until it is sent) and goods receiving of a Purchase
// Order by scanning. POS Profile > Supermarket > Store.
frappe.pages["sm_store"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({ parent: wrapper, title: __("Stock Count and Receiving"), single_column: true });
	const esc = (v) => frappe.utils.escape_html(v == null ? "" : String(v));
	const API = "posawesome.posawesome.api.sm_store.";
	const PKEY = "posa_sm_store_profile";
	let profile = localStorage.getItem(PKEY) || "";
	let cfg = {};
	let tab = "count";
	let po = null;
	let poLines = [];
	const counted = {}; // receiving: item_code -> stock qty

	const store = (k, v) => {
		try {
			if (v === undefined) return JSON.parse(localStorage.getItem(k) || "null");
			localStorage.setItem(k, JSON.stringify(v));
		} catch (e) {
			return null;
		}
	};
	const countKey = () => "posa_sm_count_" + profile;
	let count = store(countKey()) || [];

	const fProfile = page.add_field({
		fieldname: "pos_profile", label: __("POS Profile"), fieldtype: "Link", options: "POS Profile", default: profile,
		change() {
			profile = fProfile.get_value() || "";
			localStorage.setItem(PKEY, profile);
			count = store(countKey()) || [];
			init();
		},
	});

	const $b = $(`<div class="sms p-2">
		<div class="sms-tabs mb-2"></div>
		<div class="sms-msg text-muted mb-2"></div>
		<div class="sms-scan d-flex mb-2" style="gap:8px">
			<input class="form-control sms-code" placeholder="${__("Scan or type a barcode / item code")}" autocomplete="off">
			<input class="form-control sms-qty" type="number" step="any" value="1" style="max-width:90px">
			<button class="btn btn-primary sms-add">${__("Add")}</button>
		</div>
		<div class="sms-po mb-2"></div>
		<table class="table table-sm sms-table"><thead></thead><tbody></tbody></table>
		<div class="sms-actions"></div>
	</div>`).appendTo(page.body);
	$(`<style>.sms-table td{vertical-align:middle}.sms-short{color:#c62828}.sms-extra{color:#ef6c00}.sms-ok{color:#2e7d32}</style>`).appendTo(page.body);

	function tabs() {
		const btn = (k, label, on) =>
			on ? `<button class="btn btn-sm ${tab === k ? "btn-primary" : "btn-default"} sms-tab mr-2" data-tab="${k}">${label}</button>` : "";
		$b.find(".sms-tabs").html(btn("count", __("Stock Count"), cfg.stock_count) + btn("receive", __("Goods Receiving"), cfg.receiving));
	}
	$b.on("click", ".sms-tab", (e) => {
		tab = $(e.currentTarget).attr("data-tab");
		render();
	});

	function init() {
		if (!profile) {
			$b.find(".sms-msg").text(__("Choose the POS Profile of this store."));
			return;
		}
		frappe
			.call({ method: API + "setup", args: { pos_profile: profile } })
			.then((r) => {
				cfg = r.message || {};
				store("posa_sm_store_cfg_" + profile, cfg);
				if (!cfg.stock_count && cfg.receiving) tab = "receive";
				render();
			})
			.catch(() => {
				cfg = store("posa_sm_store_cfg_" + profile) || {};
				render();
			});
	}

	function addCount(code, qty) {
		const done = (info) => {
			const row = count.find((x) => (info ? x.item_code === info.item_code : x.code === code));
			if (row) row.qty = Math.round((Number(row.qty) + qty) * 1000) / 1000;
			else count.unshift(info ? { item_code: info.item_code, item_name: info.item_name, uom: info.stock_uom, qty: qty * (info.conversion_factor || 1), actual_qty: info.actual_qty } : { code, item_name: __("(offline: {0})", [code]), qty });
			store(countKey(), count);
			render();
		};
		frappe
			.call({ method: API + "lookup", args: { pos_profile: profile, code }, freeze: false })
			.then((r) => done(r.message))
			.catch((e) => {
				// no connection: keep the code, it is resolved when the count is sent
				if (!navigator.onLine || (e && (e.status === 0 || e.status >= 500))) done(null);
			});
	}

	function addReceive(code, qty) {
		frappe.call({ method: API + "lookup", args: { pos_profile: profile, code } }).then((r) => {
			const info = r.message;
			counted[info.item_code] = (counted[info.item_code] || 0) + qty * (info.conversion_factor || 1);
			if (!poLines.some((l) => l.item_code === info.item_code)) frappe.show_alert({ message: __("{0} is not on this order", [info.item_name]), indicator: "orange" });
			render();
		});
	}

	function scan() {
		const $c = $b.find(".sms-code");
		const code = String($c.val() || "").trim();
		const qty = parseFloat($b.find(".sms-qty").val()) || 1;
		if (!code || !profile) return;
		$c.val("").focus();
		$b.find(".sms-qty").val(1);
		if (tab === "count") addCount(code, qty);
		else if (po) addReceive(code, qty);
		else frappe.msgprint(__("Choose the Purchase Order first"));
	}
	$b.on("keydown", ".sms-code", (e) => e.key === "Enter" && scan());
	$b.on("click", ".sms-add", scan);
	$b.on("change", ".sms-edit", (e) => {
		const i = parseInt($(e.target).attr("data-i"), 10);
		count[i].qty = Math.max(0, parseFloat(e.target.value) || 0);
		store(countKey(), count);
	});
	$b.on("click", ".sms-del", (e) => {
		count.splice(parseInt($(e.currentTarget).attr("data-i"), 10), 1);
		store(countKey(), count);
		render();
	});

	function render() {
		tabs();
		const $po = $b.find(".sms-po").empty();
		const $a = $b.find(".sms-actions").empty();
		if (!cfg.stock_count && !cfg.receiving) {
			$b.find(".sms-msg").text(profile ? __("Stock count and receiving are not switched on for this POS Profile.") : "");
			$b.find(".sms-scan, .sms-table").hide();
			return;
		}
		$b.find(".sms-scan, .sms-table").show();
		if (tab === "count") {
			$b.find(".sms-msg").text(__("Warehouse {0}. The count is kept on this device until you send it.", [cfg.warehouse || ""]));
			$b.find("thead").html(`<tr><th>${__("Item")}</th><th>${__("Counted")}</th>${cfg.blind ? "" : `<th>${__("System")}</th>`}<th></th></tr>`);
			$b.find("tbody").html(
				count
					.map((r, i) => `<tr><td>${esc(r.item_name || r.item_code || r.code)}<div class="small text-muted">${esc(r.item_code || r.code)} ${esc(r.uom || "")}</div></td>
					<td><input type="number" step="any" class="form-control input-xs sms-edit" data-i="${i}" value="${esc(r.qty)}" style="max-width:100px"></td>
					${cfg.blind ? "" : `<td>${r.actual_qty == null ? "" : esc(r.actual_qty)}</td>`}
					<td><button class="btn btn-xs btn-default sms-del" data-i="${i}">✕</button></td></tr>`)
					.join("")
			);
			$(`<button class="btn btn-primary">${__("Make Stock Reconciliation ({0} items)", [count.length])}</button>`)
				.appendTo($a)
				.on("click", () => {
					if (!count.length) return;
					frappe
						.call({ method: API + "make_stock_count", args: { pos_profile: profile, rows: count }, freeze: true })
						.then((r) => {
							count = [];
							store(countKey(), count);
							render();
							frappe.msgprint(__("Stock Reconciliation {0} made as a draft for checking.", [`<a href="/app/stock-reconciliation/${esc(r.message)}">${esc(r.message)}</a>`]));
						});
				});
			$(`<button class="btn btn-default ml-2">${__("Clear")}</button>`)
				.appendTo($a)
				.on("click", () => frappe.confirm(__("Clear this count?"), () => {
					count = [];
					store(countKey(), count);
					render();
				}));
			return;
		}
		// receiving
		$b.find(".sms-msg").text(po ? __("Scan what came in for {0}.", [po]) : __("Choose the Purchase Order."));
		const $sel = $(`<button class="btn btn-default btn-sm">${po ? esc(po) : __("Choose Purchase Order")}</button>`).appendTo($po);
		$sel.on("click", () =>
			frappe.call({ method: API + "open_purchase_orders", args: { pos_profile: profile } }).then((r) => {
				const d = new frappe.ui.Dialog({
					title: __("Purchase Orders to receive"),
					fields: [{ fieldname: "po", fieldtype: "Select", label: __("Purchase Order"), options: (r.message || []).map((x) => ({ value: x.name, label: `${x.name} · ${x.supplier} · ${x.transaction_date}` })) }],
					primary_action_label: __("Open"),
					primary_action(v) {
						d.hide();
						po = v.po;
						Object.keys(counted).forEach((k) => delete counted[k]);
						frappe.call({ method: API + "purchase_order_lines", args: { pos_profile: profile, purchase_order: po } }).then((x) => {
							poLines = x.message || [];
							render();
						});
					},
				});
				d.show();
			})
		);
		$b.find("thead").html(`<tr><th>${__("Item")}</th><th>${__("To Receive")}</th><th>${__("Scanned")}</th><th></th></tr>`);
		const rows = poLines.map((l) => {
			const got = (counted[l.item_code] || 0) / (l.conversion_factor || 1);
			const cls = got + 1e-9 < l.to_receive ? "sms-short" : got > l.to_receive + 1e-9 ? "sms-extra" : "sms-ok";
			const tag = cls === "sms-short" ? __("short {0}", [Math.round((l.to_receive - got) * 1000) / 1000]) : cls === "sms-extra" ? __("extra") : "✓";
			return `<tr><td>${esc(l.item_name)}<div class="small text-muted">${esc(l.item_code)} ${esc(l.uom)}</div></td><td>${esc(l.to_receive)}</td><td>${esc(Math.round(got * 1000) / 1000)}</td><td class="${cls}">${esc(tag)}</td></tr>`;
		});
		Object.keys(counted)
			.filter((k) => !poLines.some((l) => l.item_code === k))
			.forEach((k) => rows.push(`<tr><td>${esc(k)}</td><td>0</td><td>${esc(counted[k])}</td><td class="sms-extra">${__("not on the order")}</td></tr>`));
		$b.find("tbody").html(rows.join(""));
		if (po) {
			$(`<button class="btn btn-primary">${__("Make Purchase Receipt")}</button>`)
				.appendTo($a)
				.on("click", () =>
					frappe.call({ method: API + "make_purchase_receipt", args: { pos_profile: profile, purchase_order: po, counted }, freeze: true }).then((r) => {
						const m = r.message || {};
						frappe.msgprint(
							__("Purchase Receipt {0} made as a draft.", [`<a href="/app/purchase-receipt/${esc(m.purchase_receipt)}">${esc(m.purchase_receipt)}</a>`]) +
								(m.short && m.short.length ? "<br>" + __("Short: {0}", [m.short.map((s) => esc(s.item_name) + " " + s.short).join(", ")]) : "") +
								(m.extras && Object.keys(m.extras).length ? "<br>" + __("Not on the order: {0}", [Object.keys(m.extras).map(esc).join(", ")]) : "")
						);
						po = null;
						poLines = [];
						Object.keys(counted).forEach((k) => delete counted[k]);
						render();
					})
				);
		}
	}

	init();
	setTimeout(() => $b.find(".sms-code").focus(), 300);
};
