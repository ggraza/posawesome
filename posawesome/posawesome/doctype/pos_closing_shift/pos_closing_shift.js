// Copyright (c) 2020, Youssef Restom and contributors
// For license information, please see license.txt

frappe.ui.form.on('POS Closing Shift', {
    child_table_name_add: function(frm, cdt, cdn) {
        calculateCashTotals(frm);
    },
    child_table_name_remove: function(frm, cdt, cdn) {
        calculateCashTotals(frm);
    },
	onload: function (frm) {
		frm.set_query("pos_profile", function (doc) {
			return {
				filters: { 'user': doc.user }
			};
		});

		frm.set_query("user", function (doc) {
			return {
				query: "posawesome.posawesome.doctype.pos_closing_shift.pos_closing_shift.get_cashiers",
				filters: { 'parent': doc.pos_profile }
			};
		});

		frm.set_query("pos_opening_shift", function (doc) {
			return { filters: { 'status': 'Open', 'docstatus': 1, 'company': doc.company } };
		});

		if (frm.doc.docstatus === 0) frm.set_value("period_end_date", frappe.datetime.now_datetime());
		if (frm.doc.docstatus === 1) set_html_data(frm);
	},

	pos_opening_shift (frm) {
		if (frm.doc.pos_opening_shift && frm.doc.user) {
			reset_values(frm);
			frappe.run_serially([
				() => frm.trigger("set_opening_amounts"),
				() => frm.trigger("set_opening_denomination"),
				() => frm.trigger("get_pos_expense_invoice"),
				() => frm.trigger("get_pos_invoices"),
				() => frm.trigger("get_pos_payments")
			]);
		}
	},

	set_opening_amounts (frm) {
		frappe.db.get_doc("POS Opening Shift", frm.doc.pos_opening_shift)
			.then(({ balance_details }) => {
				balance_details.forEach(detail => {
					frm.add_child("payment_reconciliation", {
						mode_of_payment: detail.mode_of_payment,
						opening_amount: detail.amount || 0,
						expected_amount: detail.amount || 0
					});
				});
			});
	},

	set_opening_denomination (frm) {
		frappe.db.get_doc("POS Opening Shift", frm.doc.pos_opening_shift)
			.then(({ denomination_details }) => {
				denomination_details.forEach(detail => {
					frm.add_child("denomination_details", {
						mode_of_denomination: detail.mode_of_denomination,
						opening_qty: detail.qty || 0,
						opening_cash: detail.amount || 0
					});
				});
			});
	},

	get_pos_invoices (frm) {
		frappe.call({
			method: 'posawesome.posawesome.doctype.pos_closing_shift.pos_closing_shift.get_pos_invoices',
			args: {
				pos_opening_shift: frm.doc.pos_opening_shift,
			},
			callback: (r) => {
				let pos_docs = r.message;
				set_form_data(pos_docs, frm);
				refresh_fields(frm);
				set_html_data(frm);
			}
		});
	},

	get_pos_expense_invoice (frm) {
		frappe.call({
			method: 'posawesome.posawesome.doctype.pos_closing_shift.pos_closing_shift.get_pos_expense_invoice',
			args: {
				pos_opening_shift: frm.doc.pos_opening_shift,
			},
			callback: (r) => {
				let pos_docs = r.message;
				set_expense_data(pos_docs, frm);
				refresh_fields(frm);

			}
		});
	},

	get_pos_payments (frm) {
		frappe.call({
			method: 'posawesome.posawesome.doctype.pos_closing_shift.pos_closing_shift.get_payments_entries',
			args: {
				pos_opening_shift: frm.doc.pos_opening_shift,
			},
			callback: (r) => {
				let pos_payments = r.message;
				set_form_payments_data(pos_payments, frm);
				refresh_fields(frm);
				set_html_data(frm);
			}
		});
	},
get_pos_invoices (frm) {
    frappe.call({
        method: 'posawesome.posawesome.doctype.pos_closing_shift.pos_closing_shift.get_pos_invoices',
        args: {
            pos_opening_shift: frm.doc.pos_opening_shift,
        },
        callback: (r) => {
            let pos_docs = r.message;
            set_form_data(pos_docs, frm);
            refresh_fields(frm);
            set_html_data(frm);
            
            // Calculate totals based on conditions
            calculate_totals_based_on_conditions(pos_docs, frm);
        }
    });
}

});

function calculate_totals_based_on_conditions(pos_docs, frm) {
    let total_return_not_paid = 0;
    let total_return = 0;
    let total_return_invoices = 0;

    pos_docs.forEach(d => {
        if (d.is_return === 1) {
            // Check if it is a return invoice
            total_return += flt(d.base_grand_total);

            // Check if it is a return invoice and not a POS transaction
            if (d.is_pos === 0) {
                total_return_not_paid += flt(d.base_grand_total);
            }

            total_return_invoices += 1; // Count the return invoices
        }
    });

    // Set the calculated values in the parent document
    frm.set_value("return_not_paid", total_return_not_paid);
    frm.set_value("total_return", total_return);
    frm.set_value("total_return_invoices", total_return_invoices);

    // Refresh fields to reflect the changes
    frm.refresh_field("return_not_paid");
    frm.refresh_field("total_return");
    frm.refresh_field("total_return_invoices");
}

frappe.ui.form.on('POS Closing Shift Detail', {
	closing_amount: (frm, cdt, cdn) => {
		const row = locals[cdt][cdn];
		frappe.model.set_value(cdt, cdn, "difference", flt(row.expected_amount - row.expense_amount - row.closing_amount));
	}
});

function set_form_data (data, frm) {
	data.forEach(d => {
		add_to_pos_transaction(d, frm);
		frm.doc.grand_total += flt(d.grand_total);
		frm.doc.net_total += flt(d.net_total);
		frm.doc.total_quantity += flt(d.total_qty);
		add_to_payments(d, frm);
		add_to_taxes(d, frm);
	});
}

function get_cash_mode_of_payment(frm) {
	let cash_mode = frm.doc.pos_profile
		? get_value("POS Profile", frm.doc.pos_profile, "posa_cash_mode_of_payment")
		: null;

	return (cash_mode || "Cash").trim();
}

function set_expense_data(data, frm) {
	frm.clear_table("pos_expenses");

	let net_expense = 0;

	data.forEach(d => {
		frm.add_child("pos_expenses", {
			pos_expense_invoice: d.name,
			date: d.date,
			total_expense: d.total_expense
		});
		net_expense += flt(d.total_expense);
	});

	frm.set_value("net_expense", net_expense);
	frm.refresh_field("pos_expenses");
	frm.refresh_field("net_expense");

	// ? Apply expense to CASH mode dynamically
	const cash_mode = get_cash_mode_of_payment(frm).toLowerCase();

	const payment_rows = frm.doc.payment_reconciliation || [];
	payment_rows.forEach(row => {
		if (row.mode_of_payment?.toLowerCase() === cash_mode) {
			// overwrite, don't accumulate
			frappe.model.set_value(
				row.doctype,
				row.name,
				"expense_amount",
				net_expense
			);
		}
	});

	frm.refresh_field("payment_reconciliation");
}

function set_expense_data_modcash (data, frm) {
	frm.clear_table("pos_expenses");
	let net_expense = 0;
	data.forEach(d => {
		frm.add_child("pos_expenses", {
			pos_expense_invoice: d.name,
			date: d.date,
			total_expense: d.total_expense
		});
		// Increment the net expense field with each expense
		net_expense += flt(d.total_expense);
	});
	frm.set_value("net_expense", net_expense);
	frm.refresh_field("pos_expenses");
	frm.refresh_field("net_expense");

	// Add net_expense to the payment_reconciliation where mode_of_payment is "Cash"
	let cash_mode_of_payment = "Cash"; // Adjust this to match the correct payment mode
	let payment_reconciliation = frm.doc.payment_reconciliation || [];

	payment_reconciliation.forEach(row => {
		if (row.mode_of_payment === cash_mode_of_payment) {
			// Ensure the expense_amount field is initialized to 0 if it's undefined
			row.expense_amount = row.expense_amount || 0;
			
			// Add net_expense to the expense_amount of this row
			row.expense_amount += net_expense;
		}
	});

	// Refresh the payment_reconciliation field to reflect the changes
	frm.refresh_field("payment_reconciliation");
}


function set_form_payments_data (data, frm) {
	data.forEach(d => {
		add_to_pos_payments(d, frm);
		add_pos_payment_to_payments(d, frm);
	});
}

function add_to_pos_transaction (d, frm) {
	frm.add_child("pos_transactions", {
		sales_invoice: d.name,
		posting_date: d.posting_date,
		grand_total: d.grand_total,
		customer: d.customer
	});
}

function add_to_pos_expenses (d, frm) {
	frm.add_child("pos_expenses", {
		pos_expense_invoice: d.name,
		date: d.date,
		total_expense: d.total_expense
	});
}

function add_to_pos_payments (d, frm) {
	frm.add_child("pos_payments", {
		payment_entry: d.name,
		posting_date: d.posting_date,
		paid_amount: d.paid_amount,
		customer: d.party,
		mode_of_payment: d.mode_of_payment
	});
}

function add_to_payments (d, frm) {
	d.payments.forEach(p => {
		const payment = frm.doc.payment_reconciliation.find(pay => pay.mode_of_payment === p.mode_of_payment);
		if (payment) {
			let amount = p.amount;
			let cash_mode_of_payment = get_value("POS Profile", frm.doc.pos_profile, 'posa_cash_mode_of_payment');
			if (!cash_mode_of_payment) {
				cash_mode_of_payment = 'Cash';
			}
			if (payment.mode_of_payment == cash_mode_of_payment) {
				amount = p.amount - d.change_amount;
			}
			payment.expected_amount += flt(amount);
		} else {
			frm.add_child("payment_reconciliation", {
				mode_of_payment: p.mode_of_payment,
				opening_amount: 0,
				expected_amount: p.amount || 0
			});
		}
	});
}

function add_pos_payment_to_payments (p, frm) {
	const payment = frm.doc.payment_reconciliation.find(pay => pay.mode_of_payment === p.mode_of_payment);
	if (payment) {
		let amount = p.paid_amount;
		payment.expected_amount += flt(amount);
	} else {
		frm.add_child("payment_reconciliation", {
			mode_of_payment: p.mode_of_payment,
			opening_amount: 0,
			expected_amount: p.amount || 0
		});
	}
};


function add_to_taxes (d, frm) {
	d.taxes.forEach(t => {
		const tax = frm.doc.taxes.find(tx => tx.account_head === t.account_head && tx.rate === t.rate);
		if (tax) {
			tax.amount += flt(t.tax_amount);
		} else {
			frm.add_child("taxes", {
				account_head: t.account_head,
				rate: t.rate,
				amount: t.tax_amount
			});
		}
	});
}

function reset_values (frm) {
	frm.set_value("pos_transactions", []);
	frm.set_value("pos_expenses", []);
	frm.set_value("payment_reconciliation", []);
	frm.set_value("denomination_details", []);
	frm.set_value("pos_payments", []);
	frm.set_value("taxes", []);
	frm.set_value("grand_total", 0);
	frm.set_value("net_total", 0);
	frm.set_value("total_quantity", 0);
}

function refresh_fields (frm) {
	frm.refresh_field("pos_transactions");
	frm.refresh_field("pos_expenses");
	frm.refresh_field("payment_reconciliation");
	frm.refresh_field("denomination_details");
	frm.refresh_field("pos_payments");
	frm.refresh_field("taxes");
	frm.refresh_field("grand_total");
	frm.refresh_field("net_total");
	frm.refresh_field("total_quantity");
}

function set_html_data (frm) {
	frappe.call({
		method: "get_payment_reconciliation_details",
		doc: frm.doc,
		callback: (r) => {
			frm.get_field("payment_reconciliation_details").$wrapper.html(r.message);
		}
	});
}

const get_value = (doctype, name, field) => {
	let value;
	frappe.call({
		method: 'frappe.client.get_value',
		args: {
			'doctype': doctype,
			'filters': { 'name': name },
			'fieldname': field
		},
		async: false,
		callback: function (r) {
			if (!r.exc) {
				value = r.message[field];
			}
		}
	});
	return value;
};

frappe.ui.form.on('POS Closing Shift Denomination', {
    mode_of_denomination: function(frm, cdt, cdn) {
        calculateCashAmount(frm, cdt, cdn);
        calculateCashTotals(frm);
    },
    closing_qty: function(frm, cdt, cdn) {
        calculateCashAmount(frm, cdt, cdn);
        calculateCashTotals(frm);
    },
});

function calculateCashAmount(frm, cdt, cdn) {
    var d = locals[cdt][cdn];
    
    // Ensure mode_of_denomination and qty are converted to float for calculation
    var denomination = parseFloat(d.mode_of_denomination) || 0;
    var quantity = flt(d.closing_qty) || 0;

    var amount = denomination * quantity;

    // Update the amount field
    frappe.model.set_value(cdt, cdn, 'closing_cash', amount);
}

function calculateCashTotals(frm) {
	let totalQty = 0;
	let totalAmount = 0;

	const rows = frm.doc.denomination_details || [];
	rows.forEach(row => {
		totalQty += flt(row.closing_qty);
		totalAmount += flt(row.closing_cash);
	});

	frm.set_value('total_qty', totalQty);
	frm.set_value('total_amount', totalAmount);

	// ? Dynamic cash mode
	const cash_mode = get_cash_mode_of_payment(frm).toLowerCase();

	const payments = frm.doc.payment_reconciliation || [];
	payments.forEach(row => {
		if (row.mode_of_payment?.toLowerCase() === cash_mode) {
			frappe.model.set_value(
				row.doctype,
				row.name,
				'closing_amount',
				totalAmount
			);
		}
	});

	frm.refresh_field('payment_reconciliation');
}

function calculateCashTotals_cash(frm) {
    var totalQty = 0;
    var totalAmount = 0;
    
    // Iterate through each row in the child table (denomination_details)
    var childTable = frm.doc.denomination_details || [];
    for (var i = 0; i < childTable.length; i++) {
        var row = childTable[i];
        
        // Add the quantity to the totalQty
        totalQty += flt(row.closing_qty);
        
        // Add the amount to the totalAmount
        totalAmount += flt(row.closing_cash);
    }
    
    // Set the calculated totals in the parent table fields
    frm.set_value('total_qty', totalQty);
    frm.set_value('total_amount', totalAmount);

    // Find the balance_details row with mode_of_payment "Cash"
    var balanceDetails = frm.doc.payment_reconciliation || [];
    for (var j = 0; j < balanceDetails.length; j++) {
        var balanceRow = balanceDetails[j];
        
        if (balanceRow.mode_of_payment === "Cash") {
            // Update the amount field with totalAmount
            frappe.model.set_value(balanceRow.doctype, balanceRow.name, 'closing_amount', totalAmount);
            frm.refresh_field('payment_reconciliation');
            break;
        }
    }
}