// Copyright (c) 2024, Youssef Restom and contributors
// For license information, please see license.txt

frappe.ui.form.on('POS Expense Head', {
    onload(frm) {
        set_expense_account_filter(frm);
    },

    refresh(frm) {
        set_expense_account_filter(frm);
    }
});

function set_expense_account_filter(frm) {
    frm.set_query(
        'expense_account',
        'pos_expense_head_default',
        function (doc, cdt, cdn) {
            let row = locals[cdt][cdn];

            return {
                filters: {
                    company: row.company,
                    root_type: 'Expense',
                    is_group: 0
                }
            };
        }
    );
}
