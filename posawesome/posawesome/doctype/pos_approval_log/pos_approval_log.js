


// ----------------------------------------------------------------- Help tab
// Purpose and usage of POS Approval Log, shown in the Help tab (HTML field pos_approval_log_help).
frappe.ui.form.on("POS Approval Log", {
    refresh: function (frm) {
        if (frm.fields_dict.pos_approval_log_help) {
            frm.set_df_property("pos_approval_log_help", "options", posa_pos_approval_log_help_content());
        }
    },
});

function posa_pos_approval_log_help_content() {
    var help_content = `<table class="table table-bordered" style="background-color: var(--scrollbar-track-color);">
            <tr>
                <td>
                    <h4><i class="fa fa-key"></i> {{__("POS Approval Log Overview")}}</h4>
                    <ul>
                        <li>{{__("One row for every manager approval on a till: price override, discount above the limit, line void, cart void, No Sale, reprint, return, cash pickup / cash out.")}}</li>
                        <li>{{__("Used when the POS Profile has Supermarket > Manager Approval (PIN / Card) and the action is ticked there.")}}</li>
                        <li><b>{{__("Approved")}}</b> - {{__("the manager's PIN or card was accepted.")}}</li>
                        <li><b>{{__("Used")}}</b> - {{__("the sale (or cash movement) was saved with this approval.")}}</li>
                        <li><b>{{__("Refused")}}</b> - {{__("a wrong PIN or card was tried. After 5 wrong tries the cashier waits 5 minutes.")}}</li>
                        <li><b>{{__("Offline")}}</b> - {{__("allowed without a PIN while the till was offline (When the Till Is Offline = Allow and Log). Review these.")}}</li>
                        <li>{{__("Logs are written by the POS only; they cannot be edited.")}}</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-lightbulb-o"></i> {{__("Using The Log")}}</h4>
                    <ul>
                        <li>{{__("Filter by Cashier, Approved By or Action to review a shift or a cashier.")}}</li>
                        <li>{{__("Many Refused rows from one cashier: someone is guessing PINs; change the managers' PINs.")}}</li>
                        <li>{{__("The managers of a till are listed on the POS Profile (Supermarket tab > Managers); their PINs are in POS Manager PIN.")}}</li>
                    </ul>
                </td>
            </tr>
        </table>`;
    return help_content;
}
