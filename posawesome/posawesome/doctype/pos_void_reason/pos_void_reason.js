


// ----------------------------------------------------------------- Help tab
// Purpose and usage of POS Void Reason, shown in the Help tab (HTML field pos_void_reason_help).
frappe.ui.form.on("POS Void Reason", {
    refresh: function (frm) {
        if (frm.fields_dict.pos_void_reason_help) {
            frm.set_df_property("pos_void_reason_help", "options", posa_pos_void_reason_help_content());
        }
    },
});

function posa_pos_void_reason_help_content() {
    var help_content = `<table class="table table-bordered" style="background-color: var(--scrollbar-track-color);">
            <tr>
                <td>
                    <h4><i class="fa fa-ban"></i> {{__("POS Void Reason Overview")}}</h4>
                    <ul>
                        <li>{{__("The reasons a waiter or cashier must give when taking off an item that was already sent to the kitchen (Void) or making an item free (Comp).")}}</li>
                        <li>{{__("Used when the POS Profile has Fine Dining > Void / Comp with Reason, or Supermarket > Void With Reason (removing an item or cancelling the cart).")}}</li>
                        <li><b>{{__("Used For")}}</b> - {{__("Void, Comp or Both: decides in which window the reason is offered.")}}</li>
                        <li>{{__("Every void and comp is recorded in POS Void Log with the reason, who asked and who approved.")}}</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-list-ol"></i> {{__("Setup Flow")}}</h4>
                    <ol>
                        <li>{{__("Add the reasons your restaurant accepts (defaults are created on the first migrate).")}}</li>
                        <li>{{__("Disable a reason instead of deleting it, so old logs keep it.")}}</li>
                        <li>{{__("In the POS Profile, tick Manager Approval for Void / Comp and choose the Approver Role when a manager must confirm.")}}</li>
                    </ol>
                </td>
            </tr>
        </table>`;
    return help_content;
}
