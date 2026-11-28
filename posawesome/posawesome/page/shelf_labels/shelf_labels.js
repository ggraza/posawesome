// Supermarket shelf-edge labels: the queue of labels to print (price changes,
// offers / deals starting or ending, manual), filters, scan to add, preview and
// print: HTML templates through QZ Tray or the browser, ZPL / TSPL templates raw
// to the label printer through QZ Tray.
frappe.pages["shelf_labels"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({ parent: wrapper, title: __("Shelf Labels"), single_column: true });
	const esc = (v) => frappe.utils.escape_html(v == null ? "" : String(v));
	const API = "posawesome.posawesome.api.shelf_labels.";
	let data = { rows: [] };
	const picked = new Set();

	const f = {};
	f.status = page.add_field({ fieldname: "status", label: __("Status"), fieldtype: "Select", options: "Pending\nPrinted\nSkipped", default: "Pending", change: load });
	f.price_list = page.add_field({ fieldname: "price_list", label: __("Price List"), fieldtype: "Link", options: "Price List", change: load });
	f.reason = page.add_field({ fieldname: "reason", label: __("Reason"), fieldtype: "Select", options: "\nPrice Change\nNew Price\nOffer Start\nOffer End\nManual", change: load });
	f.item_group = page.add_field({ fieldname: "item_group", label: __("Item Group"), fieldtype: "Link", options: "Item Group", change: load });
	f.template = page.add_field({ fieldname: "template", label: __("Template"), fieldtype: "Link", options: "POS Shelf Label Template" });
	f.scan = page.add_field({ fieldname: "scan", label: __("Scan to add a label"), fieldtype: "Data" });
	$(f.scan.input).on("keydown", (e) => {
		if (e.key !== "Enter") return;
		const code = f.scan.get_value();
		if (!code) return;
		frappe
			.call({ method: API + "add_by_code", args: { code, price_list: f.price_list.get_value() || null } })
			.then((r) => {
				f.scan.set_value("");
				(r.message || []).forEach((n) => picked.add(n));
				frappe.show_alert({ message: __("Label added"), indicator: "green" });
				load();
			});
	});

	page.set_primary_action(__("Print"), () => print(), "printer");
	page.set_secondary_action(__("Refresh"), () => load());
	page.add_menu_item(__("Preview"), () => preview());
	page.add_menu_item(__("Mark Printed"), () => setStatus("Printed"));
	page.add_menu_item(__("Skip"), () => setStatus("Skipped"));
	page.add_menu_item(__("Back to Pending"), () => setStatus("Pending"));
	page.add_menu_item(__("Shelf Label Check (report)"), () => frappe.set_route("query-report", "Shelf Label Check"));
	page.add_menu_item(__("Label Templates"), () => frappe.set_route("List", "POS Shelf Label Template"));

	const $body = $(`<div class="sl-page">
		<div class="sl-msg text-muted p-3"></div>
		<div class="sl-bar p-2"><label><input type="checkbox" class="sl-all"> ${__("All")}</label> <span class="sl-count text-muted"></span></div>
		<table class="table table-sm sl-table"><thead><tr>
			<th></th><th>${__("Item")}</th><th>${__("UOM")}</th><th>${__("Price List")}</th><th>${__("Reason")}</th>
			<th class="text-right">${__("Old")}</th><th class="text-right">${__("New")}</th><th>${__("Offer")}</th><th>${__("Copies")}</th><th>${__("Queued")}</th>
		</tr></thead><tbody></tbody></table></div>`).appendTo(page.body);
	$(`<style>.sl-table td { vertical-align: middle; } .sl-table input.sl-copies { width: 56px; } .sl-up { color: #c62828; } .sl-down { color: #2e7d32; }</style>`).appendTo(page.body);

	$body.on("change", ".sl-all", (e) => {
		picked.clear();
		if (e.target.checked) data.rows.forEach((r) => picked.add(r.name));
		render();
	});
	$body.on("change", ".sl-pick", (e) => {
		const n = $(e.target).attr("data-name");
		if (e.target.checked) picked.add(n);
		else picked.delete(n);
		$body.find(".sl-count").text(__("{0} chosen", [picked.size]));
	});
	$body.on("change", ".sl-copies", (e) => {
		const n = $(e.target).attr("data-name");
		frappe.db.set_value("POS Shelf Label Queue", n, "copies", Math.max(1, parseInt(e.target.value, 10) || 1));
	});

	function money(v) {
		return v == null ? "" : format_currency(v);
	}

	function render() {
		const rows = data.rows || [];
		$body.find(".sl-msg").text(
			!data.enabled
				? __("Shelf-edge labels are not switched on for any POS Profile (POS Profile > Supermarket > Shelf-Edge Labels).")
				: rows.length
				? ""
				: __("No labels here.")
		);
		$body.find(".sl-count").text(__("{0} chosen", [picked.size]));
		$body.find("tbody").html(
			rows
				.map((r) => {
					const dir = r.old_price != null && r.new_price != null ? (r.new_price > r.old_price ? "sl-up" : r.new_price < r.old_price ? "sl-down" : "") : "";
					return `<tr>
					<td><input type="checkbox" class="sl-pick" data-name="${esc(r.name)}" ${picked.has(r.name) ? "checked" : ""}></td>
					<td><b>${esc(r.item_name)}</b><div class="text-muted small">${esc(r.item_code)} ${r.barcode ? "· " + esc(r.barcode) : ""}</div></td>
					<td>${esc(r.uom)}</td><td>${esc(r.price_list)}</td><td>${esc(__(r.reason))}</td>
					<td class="text-right">${r.old_price ? money(r.old_price) : ""}</td>
					<td class="text-right ${dir}"><b>${money(r.new_price)}</b></td>
					<td>${esc(r.offer_text || "")}${r.valid_until ? " · " + esc(r.valid_until) : ""}</td>
					<td><input type="number" min="1" class="form-control input-xs sl-copies" data-name="${esc(r.name)}" value="${esc(r.copies || 1)}"></td>
					<td class="small text-muted">${esc(frappe.datetime.str_to_user(r.creation))}</td></tr>`;
				})
				.join("")
		);
	}

	function load() {
		frappe
			.call({
				method: API + "get_queue",
				args: {
					status: f.status.get_value() || "Pending",
					price_list: f.price_list.get_value() || null,
					reason: f.reason.get_value() || null,
					item_group: f.item_group.get_value() || null,
				},
			})
			.then((r) => {
				data = r.message || { rows: [] };
				const names = new Set(data.rows.map((x) => x.name));
				[...picked].forEach((n) => names.has(n) || picked.delete(n));
				render();
			});
	}

	function chosen() {
		const names = [...picked];
		if (!names.length) frappe.msgprint(__("Tick the labels to print"));
		return names;
	}

	function rendered(names) {
		return frappe
			.call({ method: API + "render_labels", args: { names, template: f.template.get_value() || null }, freeze: true, freeze_message: __("Making the labels...") })
			.then((r) => r.message);
	}

	function preview() {
		const names = chosen();
		if (!names.length) return;
		rendered(names).then((out) => {
			const d = new frappe.ui.Dialog({ title: __("Preview: {0} labels ({1})", [out.count, out.template]), size: "extra-large" });
			if (out.output === "HTML") {
				const $f = $('<iframe style="width:100%;height:70vh;border:1px solid #ddd;background:#fff"></iframe>').appendTo(d.body);
				d.show();
				const doc = $f[0].contentWindow.document;
				doc.open();
				doc.write(out.html);
				doc.close();
			} else {
				$(`<pre style="max-height:70vh;overflow:auto">${esc(out.raw.join("\n"))}</pre>`).appendTo(d.body);
				d.show();
			}
		});
	}

	// ---- QZ Tray (same certificate / signature as the POS)
	let qzReady = null;
	function qz() {
		if (qzReady) return qzReady;
		qzReady = new Promise((resolve, reject) => {
			const go = () => {
				const q = window.qz;
				if (!q) return reject(new Error(__("QZ Tray library not loaded")));
				q.security.setCertificatePromise((res) => frappe.call("posawesome.posawesome.api.qz.get_certificate").then((r) => res(r.message || undefined), () => res(undefined)));
				q.security.setSignatureAlgorithm("SHA512");
				q.security.setSignaturePromise((toSign) => (res) =>
					frappe.call({ method: "posawesome.posawesome.api.qz.sign_message", args: { message: toSign } }).then((r) => res(r.message || undefined), () => res(undefined))
				);
				(q.websocket.isActive() ? Promise.resolve() : q.websocket.connect({ retries: 1, delay: 1 })).then(() => resolve(q), reject);
			};
			if (window.qz) go();
			else frappe.require("/assets/posawesome/js/lib/qz-tray.js", go);
		});
		qzReady.catch(() => (qzReady = null));
		return qzReady;
	}

	function browserPrint(html) {
		const w = window.open("", "_blank");
		if (!w) return frappe.msgprint(__("Allow pop-ups to print the labels"));
		w.document.open();
		w.document.write(html);
		w.document.close();
		setTimeout(() => {
			w.focus();
			w.print();
		}, 400);
	}

	function print() {
		const names = chosen();
		if (!names.length) return;
		rendered(names).then((out) => {
			const done = () =>
				frappe.call({ method: API + "set_status", args: { names, status: "Printed" } }).then(() => {
					frappe.show_alert({ message: __("{0} labels printed", [out.count]), indicator: "green" });
					picked.clear();
					load();
				});
			if (out.output === "HTML") {
				qz()
					.then((q) => (out.printer ? q.printers.find(out.printer) : q.printers.getDefault()).then((pr) => q.print(q.configs.create(pr), [{ type: "pixel", format: "html", flavor: "plain", data: out.html }])))
					.then(done)
					.catch(() => {
						browserPrint(out.html);
						frappe.confirm(__("Did the labels print?"), done);
					});
				return;
			}
			qz()
				.then((q) => (out.printer ? q.printers.find(out.printer) : q.printers.getDefault()).then((pr) => q.print(q.configs.create(pr), out.raw.map((r) => ({ type: "raw", format: "command", flavor: "plain", data: r })))))
				.then(done)
				.catch((e) => frappe.msgprint({ title: __("Label printer"), message: __("Could not print through QZ Tray: {0}", [esc((e && e.message) || e)]), indicator: "red" }));
		});
	}

	function setStatus(status) {
		const names = chosen();
		if (!names.length) return;
		frappe.call({ method: API + "set_status", args: { names, status } }).then(() => {
			picked.clear();
			load();
		});
	}

	load();
};
