// Copyright (c) 2025, Youssef Restom and contributors
// For license information, please see license.txt

frappe.ui.form.on('Role Permissions Manager', {
    refresh: function(frm) {
        frm.page.sidebar.addClass('hidden');
        frm.page.add_inner_button(__('Sidebar'), function() {
            frm.page.sidebar.toggleClass('hidden');
        });
    },
    role(frm) {
        if (frm.doc.role) {
            frappe.call({
                method: "frappe.client.get_list",
                args: {
                    doctype: "DocType",
                    fields: ["name"]
                },
                callback: function (response) {
                    if (response.message) {
                        frm.clear_table("doctype_permissions");
                        response.message.forEach((doc) => {
                            let row = frm.add_child("doctype_permissions");
                            row.doctype_select = doc.name;
                        });
                        frm.refresh_field("doctype_permissions");
                    }
                }
            });
        }
    }
});
