// Copyright (c) 2026, Youssef Restom and contributors
// For license information, please see license.txt

frappe.ui.form.on("POS Item Exchange", {
	refresh(frm) {
		const open = (name) => name && frappe.set_route("Form", "Sales Invoice", name);
		["original_invoice", "return_invoice", "new_invoice"].forEach((f) => {
			if (frm.doc[f]) {
				frm.add_custom_button(__(frappe.meta.get_label(frm.doctype, f)), () => open(frm.doc[f]), __("Invoices"));
			}
		});
		if (frm.doc.docstatus === 1 && frm.doc.status !== "Cancelled" && frappe.model.can_cancel(frm.doctype)) {
			// the standard Cancel asks for nothing; an exchange needs a reason
			frm.page.clear_secondary_action();
			frm.add_custom_button(__("Cancel Exchange"), () => {
				frappe.prompt(
					[
						{
							fieldname: "reason",
							fieldtype: "Small Text",
							label: __("Cancellation Reason"),
							reqd: 1,
						},
					],
					(v) =>
						frappe.confirm(
							__("Cancel {0}? This cancels {1} and {2}; stock and payments are reversed.", [
								frm.doc.name,
								frm.doc.new_invoice,
								frm.doc.return_invoice,
							]),
							() =>
								frappe
									.call({
										method: "posawesome.posawesome.doctype.pos_item_exchange.pos_item_exchange.cancel_exchange",
										args: { name: frm.doc.name, reason: v.reason },
										freeze: true,
										freeze_message: __("Cancelling the exchange..."),
									})
									.then(() => frm.reload_doc())
						),
					__("Cancel Exchange"),
					__("Continue")
				);
			}).addClass("btn-danger");
		}
		frm.set_intro(
			frm.doc.status === "Cancelled"
				? __("Cancelled by {0} on {1}.", [frm.doc.cancelled_by, frappe.datetime.str_to_user(frm.doc.cancelled_on)])
				: ""
		);
	},
});
