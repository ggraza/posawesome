frappe.ui.form.on('*', {
    refresh: function(frm) {
        if (frm.page && frm.page.sidebar) {
            frm.page.sidebar.addClass('hidden');

            if (!frm.page.custom_sidebar_toggle_added) {
                frm.page.add_inner_button(__('Toggle Sidebar'), function () {
                    frm.page.sidebar.toggleClass('hidden');
                });
                frm.page.custom_sidebar_toggle_added = true;
            }
        }
    }
});
