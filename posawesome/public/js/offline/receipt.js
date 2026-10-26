// Receipt printed for invoices taken offline (the server print formats are not
// reachable). 80 mm thermal layout; prints through a hidden iframe so popup
// blockers do not interfere.

function esc(v) {
	return String(v ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function money(v, currency) {
	try {
		if (window.format_currency) return window.format_currency(v, currency);
	} catch (e) {
		/* ignore */
	}
	return (Number(v) || 0).toFixed(2);
}

function qtyFmt(v) {
	const n = Number(v) || 0;
	return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

export function receiptHtml(record, { company = {}, profile = {} } = {}) {
	const inv = record.invoice || {};
	const cur = inv.currency;
	const rows = (inv.items || [])
		.map(
			(it) => `
		<tr><td colspan="3" class="name">${esc(it.item_name || it.item_code)}</td></tr>
		<tr class="sub"><td>${qtyFmt(it.qty)} ${esc(it.uom || "")} x ${money(it.rate, cur)}</td><td></td>
			<td class="r">${money((Number(it.qty) || 0) * (Number(it.rate) || 0), cur)}</td></tr>`
		)
		.join("");
	const taxes = (inv.taxes || [])
		.filter((t) => Number(t.tax_amount))
		.map((t) => `<tr><td colspan="2">${esc(t.description || t.account_head)}</td><td class="r">${money(t.tax_amount, cur)}</td></tr>`)
		.join("");
	const pays = (inv.payments || [])
		.filter((p) => Number(p.amount))
		.map((p) => `<tr><td colspan="2">${esc(p.mode_of_payment)}</td><td class="r">${money(p.amount, cur)}</td></tr>`)
		.join("");
	const total = inv.rounded_total || inv.grand_total;
	return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(record.offline_id)}</title>
<style>
	@page { size: 80mm auto; margin: 3mm; }
	body { font-family: monospace, sans-serif; font-size: 12px; width: 74mm; margin: 0 auto; color: #000; }
	h2 { font-size: 15px; text-align: center; margin: 4px 0; }
	.c { text-align: center; } .r { text-align: right; white-space: nowrap; }
	table { width: 100%; border-collapse: collapse; }
	td { padding: 1px 0; vertical-align: top; }
	.name { font-weight: bold; padding-top: 3px; }
	.sub td { font-size: 11px; }
	.tot td { font-weight: bold; font-size: 14px; border-top: 1px dashed #000; padding-top: 3px; }
	hr { border: 0; border-top: 1px dashed #000; margin: 4px 0; }
	.badge { border: 1px solid #000; padding: 2px; text-align: center; margin: 4px 0; font-weight: bold; }
</style></head><body>
	<h2>${esc(company.company_name || company.name || inv.company)}</h2>
	<div class="c">${esc(profile.name || inv.pos_profile || "")}</div>
	${company.tax_id ? `<div class="c">${esc(__("Tax ID"))}: ${esc(company.tax_id)}</div>` : ""}
	<div class="badge">${esc(inv.is_return ? __("RETURN") : __("OFFLINE RECEIPT"))}</div>
	<div>${esc(__("Receipt"))}: ${esc(record.offline_id)}</div>
	<div>${esc(__("Date"))}: ${esc(record.created_local || record.created_on)}</div>
	<div>${esc(__("Customer"))}: ${esc(inv.customer_name || inv.customer)}</div>
	<div>${esc(__("Cashier"))}: ${esc(record.user || "")}</div>
	<hr>
	<table>${rows}</table>
	<hr>
	<table>
		<tr><td colspan="2">${esc(__("Net Total"))}</td><td class="r">${money(inv.net_total, cur)}</td></tr>
		${Number(inv.discount_amount) ? `<tr><td colspan="2">${esc(__("Discount"))}</td><td class="r">-${money(inv.discount_amount, cur)}</td></tr>` : ""}
		${taxes}
		${Number(inv.rounding_adjustment) ? `<tr><td colspan="2">${esc(__("Rounding"))}</td><td class="r">${money(inv.rounding_adjustment, cur)}</td></tr>` : ""}
		<tr class="tot"><td colspan="2">${esc(__("Total"))}</td><td class="r">${money(total, cur)}</td></tr>
		${pays}
		${Number(inv.change_amount) ? `<tr><td colspan="2">${esc(__("Change"))}</td><td class="r">${money(inv.change_amount, cur)}</td></tr>` : ""}
	</table>
	<hr>
	<div class="c">${esc(__("Total Qty"))}: ${qtyFmt(inv.total_qty)}</div>
	<div class="c" style="font-size:10px;margin-top:6px">${esc(
		__("Issued offline. The tax invoice number is assigned when the terminal reconnects.")
	)}</div>
</body></html>`;
}

export function printOfflineReceipt(record, ctx) {
	const html = receiptHtml(record, ctx);
	const iframe = document.createElement("iframe");
	iframe.style.position = "fixed";
	iframe.style.width = "0";
	iframe.style.height = "0";
	iframe.style.border = "0";
	iframe.setAttribute("aria-hidden", "true");
	document.body.appendChild(iframe);
	const doc = iframe.contentWindow.document;
	doc.open();
	doc.write(html);
	doc.close();
	const go = () => {
		try {
			iframe.contentWindow.focus();
			iframe.contentWindow.print();
		} finally {
			setTimeout(() => iframe.remove(), 60000);
		}
	};
	if (doc.readyState === "complete") setTimeout(go, 50);
	else iframe.onload = go;
	return html;
}
