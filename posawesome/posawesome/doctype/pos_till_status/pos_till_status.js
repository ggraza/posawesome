


// ----------------------------------------------------------------- Help tab
// Purpose and usage of POS Till Status, shown in the Help tab (HTML field pos_till_status_help).
frappe.ui.form.on("POS Till Status", {
    refresh: function (frm) {
        if (frm.fields_dict.pos_till_status_help) {
            frm.set_df_property("pos_till_status_help", "options", posa_pos_till_status_help_content());
        }
    },
});

function posa_pos_till_status_help_content() {
    var help_content = `<table class="table table-bordered" style="background-color: var(--scrollbar-track-color);">
            <tr>
                <td>
                    <h4><i class="fa fa-desktop"></i> {{__("POS Till Status Overview")}}</h4>
                    <ul>
                        <li>{{__("One row per till (browser on a PC or tablet). Made by the till itself when the POS Profile has Supermarket > Till Monitor ticked; the till reports every minute.")}}</li>
                        <li><b>{{__("Till")}}</b> - {{__("rename it to the number on the counter; the till keeps reporting under that name.")}}</li>
                        <li><b>{{__("Last Report / Offline Invoices Waiting / Failed / Last Upload")}}</b> - {{__("what the till said last. The page Till Monitor shows Live (reported in the last 3 minutes), Offline (invoices waiting) or Not Reporting.")}}</li>
                        <li><b>{{__("Hide From the Monitor")}}</b> - {{__("for a till that is no longer used. A new browser or a cleared browser reports as a new till.")}}</li>
                    </ul>
                </td>
            </tr>
        </table>`;
    return help_content;
}
