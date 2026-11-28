


// ----------------------------------------------------------------- Help tab
// Purpose and usage of POS Drawer Log, shown in the Help tab (HTML field pos_drawer_log_help).
frappe.ui.form.on("POS Drawer Log", {
    refresh: function (frm) {
        if (frm.fields_dict.pos_drawer_log_help) {
            frm.set_df_property("pos_drawer_log_help", "options", posa_pos_drawer_log_help_content());
        }
    },
});

function posa_pos_drawer_log_help_content() {
    var help_content = `<table class="table table-bordered" style="background-color: var(--scrollbar-track-color);">
            <tr>
                <td>
                    <h4><i class="fa fa-inbox"></i> {{__("POS Drawer Log Overview")}}</h4>
                    <ul>
                        <li>{{__("One row each time a cashier opened the cash drawer without a sale (No Sale), with the reason and the approval.")}}</li>
                        <li>{{__("Used when the POS Profile has Supermarket > Cash Drawer (QZ Tray).")}}</li>
                        <li>{{__("The X / Z reports and the closing show how many times the drawer was opened without a sale.")}}</li>
                    </ul>
                </td>
            </tr>
        </table>`;
    return help_content;
}
