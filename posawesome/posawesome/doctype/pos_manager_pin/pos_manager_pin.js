


// ----------------------------------------------------------------- Help tab
// Purpose and usage of POS Manager PIN, shown in the Help tab (HTML field pos_manager_pin_help).
frappe.ui.form.on("POS Manager PIN", {
    refresh: function (frm) {
        if (frm.fields_dict.pos_manager_pin_help) {
            frm.set_df_property("pos_manager_pin_help", "options", posa_pos_manager_pin_help_content());
        }
    },
});

function posa_pos_manager_pin_help_content() {
    var help_content = `<table class="table table-bordered" style="background-color: var(--scrollbar-track-color);">
            <tr>
                <td>
                    <h4><i class="fa fa-lock"></i> {{__("POS Manager PIN Overview")}}</h4>
                    <ul>
                        <li>{{__("The PIN (and optionally the card) a manager uses to approve actions on the tills, when the POS Profile has Supermarket > Manager Approval.")}}</li>
                        <li>{{__("One record per manager. The manager must also be listed on the POS Profile (Supermarket tab > Managers) of the tills they approve on.")}}</li>
                        <li>{{__("The PIN is stored scrambled (hashed) when saved and is never sent to the tills, so it cannot be read back. To change it, type a new one and save.")}}</li>
                        <li>{{__("Each manager needs a different PIN. Tick Disabled to stop a manager approving without deleting the record.")}}</li>
                    </ul>
                </td>
            </tr>
        </table>`;
    return help_content;
}
