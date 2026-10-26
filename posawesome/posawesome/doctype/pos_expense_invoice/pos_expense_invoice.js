// Copyright (c) 2024, Youssef Restom and contributors
// For license information, please see license.txt

frappe.ui.form.on('POS Expense Invoice', {
    onload(frm) {
        apply_pos_shift_filter(frm);
    },

    refresh(frm) {
        apply_pos_shift_filter(frm);
    },

    company(frm) {
        // Clear shift if company changes
        frm.set_value('pos_opening_shift', null);
        apply_pos_shift_filter(frm);
    },
    child_table_name_add: function(frm, cdt, cdn) {
        calculateTotals(frm);
        calculateAmount(frm, cdt, cdn);
    },
    child_table_name_remove: function(frm, cdt, cdn) {
        calculateTotals(frm);
        calculateAmount(frm, cdt, cdn);
    },
});

frappe.ui.form.on('POS Expense Item', {
    qty: function(frm, cdt, cdn) {
        calculateTotals(frm);
        calculateAmount(frm, cdt, cdn);
    },
    rate: function(frm, cdt, cdn) {
        calculateAmount(frm, cdt, cdn);
        calculateTotals(frm);
    },
    amount: function(frm, cdt, cdn) {
        calculateTotals(frm);
        calculateAmount(frm, cdt, cdn);
    }
});

function calculateTotals(frm) {
    var totalQty = 0;
    var totalAmount = 0;
    
    // Iterate through each row in the child table
    var childTable = frm.doc.expense_detail || [];
    for (var i = 0; i < childTable.length; i++) {
        var row = childTable[i];
        
        // Add the quantity to the totalQty
        totalQty += flt(row.qty);
        
        // Add the amount to the totalAmount
        totalAmount += flt(row.amount);
    }
    
    // Set the calculated totals in the parent table fields
    frm.set_value('total_quantity', totalQty);
    frm.set_value('total_expense', totalAmount);
}

function calculateAmount(frm, cdt, cdn) {
    var d = locals[cdt][cdn];
    var amount = flt(d.qty) * flt(d.rate);
    frappe.model.set_value(cdt, cdn, 'amount', amount);
}
function apply_pos_shift_filter(frm) {
    frm.set_query('pos_opening_shift', function () {
        if (!frm.doc.company) {
            return {};
        }

        return {
            filters: {
                company: frm.doc.company,
                status: 'Open',
                docstatus: 1
            }
        };
    });
}
frappe.ui.form.on('POS Expense Invoice', {
    mode_of_payment: function(frm) {
        if (!frm.doc.mode_of_payment) {
            frm.set_value("paid_from", null);
            return;
        }

        get_payment_mode_account(frm, frm.doc.mode_of_payment, function(account){
//             var payment_account_field = frm.doc.payment_type == "Receive" ? "paid_to" : "paid_from";
            frm.set_value("paid_from", account);
        })
    }
})

var get_payment_mode_account = function(frm, mode_of_payment, callback) {
    if(!frm.doc.company) {
        frappe.throw({message:__("Please select a Company first."), title: __("Mandatory")});
    }

    if(!mode_of_payment) {
        return;
    }

    return  frappe.call({
        method: "erpnext.accounts.doctype.sales_invoice.sales_invoice.get_bank_cash_account",
        args: {
            "mode_of_payment": mode_of_payment,
            "company": frm.doc.company
        },
        callback: function(r, rt) {
            if(r.message) {
                callback(r.message.account)
            }
        }
    });
}


frappe.ui.form.on('POS Expense Invoice', {
    pos_opening_shift: function(frm) {
        // ?? If POS Opening Shift is cleared
        if (!frm.doc.pos_opening_shift) {

            // Clear Mode of Payment value
            frm.set_value("mode_of_payment", null);
            frm.set_value("paid_from", null);

            // Remove custom filter (reset to default)
            frm.set_query("mode_of_payment", function() {
                return {};
            });

            return;
        }

        // ?? If POS Opening Shift is selected
        frappe.call({
            method: "frappe.client.get",
            args: {
                doctype: "POS Opening Shift",
                name: frm.doc.pos_opening_shift
            },
            callback: function(r) {
                if (r.message && r.message.balance_details) {

                    let mop_list = r.message.balance_details.map(d => d.mode_of_payment);

                    if (mop_list.length) {

                        // Restrict Mode of Payment options
                        frm.set_query("mode_of_payment", function() {
                            return {
                                filters: {
                                    name: ["in", mop_list]
                                }
                            };
                        });

                        // Auto select first MOP
                        frm.set_value("mode_of_payment", mop_list[0]);
                    }
                }
            }
        });
    }
});
