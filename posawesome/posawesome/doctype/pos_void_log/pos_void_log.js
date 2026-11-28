


// ----------------------------------------------------------------- Help tab
// Purpose and usage of POS Void Log, shown in the Help tab (HTML field pos_void_log_help).
frappe.ui.form.on("POS Void Log", {
    refresh: function (frm) {
        if (frm.fields_dict.pos_void_log_help) {
            frm.set_df_property("pos_void_log_help", "options", posa_pos_void_log_help_content());
        }
    },
});

function posa_pos_void_log_help_content() {
    var help_content = `<table class="table table-bordered" style="background-color: var(--scrollbar-track-color);">
            <tr>
                <td>
                    <h4><i class="fa fa-history"></i> {{__("POS Void Log Overview")}}</h4>
                    <ul>
                        <li>{{__("One row for every item taken off an order after it was sent to the kitchen (Void) and every item made free (Comp).")}}</li>
                        <li>{{__("Shows the order, table, item, quantity, amount, reason, who asked, who approved and the VOID kitchen ticket.")}}</li>
                        <li><b>{{__("Approved")}}</b> - {{__("approved and waiting for the order to be saved.")}}</li>
                        <li><b>{{__("Applied")}}</b> - {{__("done: the order was saved and the kitchen got its VOID ticket.")}}</li>
                        <li><b>{{__("Offline")}}</b> - {{__("made on a terminal without connection and uploaded later; it was not approved. Review these.")}}</li>
                        <li><b>{{__("Line Void / Cart Void")}}</b> - {{__("supermarket: an item removed from the cart, or the whole cart cancelled, before payment (with the reason and the approval).")}}</li>
                        <li>{{__("Logs are written by the POS only; they cannot be edited.")}}</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-lightbulb-o"></i> {{__("Using The Log")}}</h4>
                    <ul>
                        <li>{{__("Filter by Approved By, Requested By or Reason to review voids and comps per shift or per waiter.")}}</li>
                        <li>{{__("Use the report view with Group By Reason to see where losses come from.")}}</li>
                    </ul>
                </td>
            </tr>
        </table>`;
    return help_content;
}
