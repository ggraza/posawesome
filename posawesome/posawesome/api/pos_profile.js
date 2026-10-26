// Copyright (c) 20201 Youssef Restom and contributors
// For license information, please see license.txt

frappe.ui.form.on('POS Profile', {
    setup: function (frm) {
        frm.set_query("posa_cash_mode_of_payment", function (doc) {
            return {
                filters: { 'type': 'Cash' }
            };
        });
    },
    refresh: function(frm) {
        frm.page.sidebar.addClass('hidden');

        frm.page.add_inner_button(__('Toggle Sidebar'), function() {
            frm.page.sidebar.toggleClass('hidden');
        });

        frm.fields_dict['posa_sales_partner'].$input.on('change', function() {
            if (!frm.doc.posa_sales_partner) {
                frm.set_value('sales_partner', '');
            }
        });

        frm.set_query("custom_closing_shift_print_format", function() {
            return {
                filters: [
                    ['Print Format', 'doc_type', '=', 'POS Closing Shift']
                ]
            };
        });

        frm.set_query("custom_expense_invoice_print_format", function() {
            return {
                filters: [
                    ['Print Format', 'doc_type', '=', 'POS Expense Invoice']
                ]
            };
        });

        set_custom_rfid_number_filter(frm);
    }
});

function set_custom_rfid_number_filter(frm) {
    frappe.db.get_list('POS Profile', {
        fields: ['custom_rfid_number'],
        filters: {
            custom_rfid_number: ["!=", '']
        },
        as_list: 1
    }).then(records => {
        let custom_rfid_number_list = [];
        for (let i = 0; i < records.length; i++) {
            custom_rfid_number_list.push(records[i][0]); // Access the first element of the record
        }
        frm.set_query('custom_rfid_number', () => {
            return {
                filters: {
                    rfid_number: ['not in', custom_rfid_number_list]
                }
            };
        });
    });
}