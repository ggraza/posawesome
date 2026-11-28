


// ----------------------------------------------------------------- Help tab
// Purpose and usage of POS Cash Movement, shown in the Help tab (HTML field pos_cash_movement_help).
frappe.ui.form.on("POS Cash Movement", {
    refresh: function (frm) {
        if (frm.fields_dict.pos_cash_movement_help) {
            frm.set_df_property("pos_cash_movement_help", "options", posa_pos_cash_movement_help_content());
        }
    },
});

function posa_pos_cash_movement_help_content() {
    var help_content = `<table class="table table-bordered" style="background-color: var(--scrollbar-track-color);">
            <tr>
                <td>
                    <h4><i class="fa fa-money"></i> {{__("POS Cash Movement Overview")}}</h4>
                    <ul>
                        <li><b>{{__("Cash Pickup")}}</b> - {{__("cash taken out of the drawer to the safe during the shift.")}}</li>
                        <li><b>{{__("Cash In")}}</b> - {{__("cash put into the drawer, e.g. more float or change.")}}</li>
                        <li><b>{{__("Cash Out")}}</b> - {{__("cash paid out of the drawer.")}}</li>
                        <li>{{__("Made from the POS menu when the POS Profile has Supermarket > Cash Pickup and Cash In / Out. Pickups and cash out can need a manager.")}}</li>
                        <li>{{__("They change the expected cash of the shift: Cash In adds, Cash Out and Pickups take off. The closing shows the totals.")}}</li>
                        <li>{{__("With a Safe Account (pickups) or Cash In / Out Account on the POS Profile, each one posts a Journal Entry; cancelling the movement cancels it.")}}</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-list-ol"></i> {{__("Usage Flow")}}</h4>
                    <ol>
                        <li>{{__("On the till: Menu > Cash Pickup (or Cash In / Cash Out), enter the amount and a note, Save. The drawer opens.")}}</li>
                        <li>{{__("Put the pickup in the safe with the slip or note.")}}</li>
                        <li>{{__("At closing the expected cash already takes the movements into account.")}}</li>
                    </ol>
                </td>
            </tr>
        </table>`;
    return help_content;
}
