// Copyright (c) 2020, Youssef Restom and contributors
// For license information, please see license.txt

frappe.ui.form.on('POS Opening Shift', {
    child_table_name_add: function(frm, cdt, cdn) {
        calculateTotals(frm);
    },
    child_table_name_remove: function(frm, cdt, cdn) {
        calculateTotals(frm);
    },
	setup(frm) {
		if (frm.doc.docstatus == 0) {
			frm.trigger('set_posting_date_read_only');
			frm.set_value('period_start_date', frappe.datetime.now_datetime());
			frm.set_value('user', frappe.session.user);
		}
		frm.set_query("user", function(doc) {
			return {
				query: "posawesome.posawesome.doctype.pos_closing_shift.pos_closing_shift.get_cashiers",
				filters: { 'parent': doc.pos_profile }
			};
		});
		frm.set_query("pos_profile", function(doc) {
			return {
				filters: { 'company': doc.company}
			};
		});
	},

	refresh(frm) {
		// set default posting date / time
		if(frm.doc.docstatus == 0) {
			if(!frm.doc.posting_date) {
				frm.set_value('posting_date', frappe.datetime.nowdate());
			}
			frm.trigger('set_posting_date_read_only');
		}
	},

	set_posting_date_read_only(frm) {
		if(frm.doc.docstatus == 0 && frm.doc.set_posting_date) {
			frm.set_df_property('posting_date', 'read_only', 0);
		} else {
			frm.set_df_property('posting_date', 'read_only', 1);
		}
	},

	set_posting_date(frm) {
		frm.trigger('set_posting_date_read_only');
	},

	pos_profile(frm) {
		if (frm.doc.pos_profile) {
			// Fetch POS Profile for both balance_details and denomination_details
			frappe.db.get_doc("POS Profile", frm.doc.pos_profile)
				.then(({ payments, custom_denominations }) => {
					// Update balance_details
					if (payments.length) {
						frm.doc.balance_details = [];
						payments.forEach(({ mode_of_payment }) => {
							frm.add_child("balance_details", { mode_of_payment });
						});
						frm.refresh_field("balance_details");
					}

					// Update denomination_details
					if (custom_denominations.length) {
						frm.doc.denomination_details = [];
						custom_denominations.forEach(({ mode_of_denomination }) => {
							frm.add_child("denomination_details", { mode_of_denomination });
						});
						frm.refresh_field("denomination_details");
					}
				});
		}
	}
});

frappe.ui.form.on('POS Opening Shift Denomination', {
    mode_of_denomination: function(frm, cdt, cdn) {
        calculateAmount(frm, cdt, cdn);
        calculateTotals(frm);
    },
    qty: function(frm, cdt, cdn) {
        calculateAmount(frm, cdt, cdn);
        calculateTotals(frm);
    },
});

function calculateAmount(frm, cdt, cdn) {
    var d = locals[cdt][cdn];
    
    // Ensure mode_of_denomination and qty are converted to float for calculation
    var denomination = parseFloat(d.mode_of_denomination) || 0;
    var quantity = flt(d.qty) || 0;

    var amount = denomination * quantity;

    // Update the amount field
    frappe.model.set_value(cdt, cdn, 'amount', amount);
}

function calculateTotals(frm) {
    var totalQty = 0;
    var totalAmount = 0;
    
    // Iterate through each row in the child table (denomination_details)
    var childTable = frm.doc.denomination_details || [];
    for (var i = 0; i < childTable.length; i++) {
        var row = childTable[i];
        
        // Add the quantity to the totalQty
        totalQty += flt(row.qty);
        
        // Add the amount to the totalAmount
        totalAmount += flt(row.amount);
    }
    
    // Set the calculated totals in the parent table fields
    frm.set_value('total_qty', totalQty);
    frm.set_value('total_amount', totalAmount);

    // Find the balance_details row with mode_of_payment "Cash"
    var balanceDetails = frm.doc.balance_details || [];
    for (var j = 0; j < balanceDetails.length; j++) {
        var balanceRow = balanceDetails[j];
        
        if (balanceRow.mode_of_payment === "Cash") {
            // Update the amount field with totalAmount
            frappe.model.set_value(balanceRow.doctype, balanceRow.name, 'amount', totalAmount);
            frm.refresh_field('balance_details');
            break;
        }
    }
}