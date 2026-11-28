


// ----------------------------------------------------------------- Help tab
// Purpose and usage of POS Shelf Label Queue, shown in the Help tab (HTML field pos_shelf_label_queue_help).
frappe.ui.form.on("POS Shelf Label Queue", {
    refresh: function (frm) {
        if (frm.fields_dict.pos_shelf_label_queue_help) {
            frm.set_df_property("pos_shelf_label_queue_help", "options", posa_pos_shelf_label_queue_help_content());
        }
    },
});

function posa_pos_shelf_label_queue_help_content() {
    var help_content = `<table class="table table-bordered" style="background-color: var(--scrollbar-track-color);">
            <tr>
                <td>
                    <h4><i class="fa fa-list"></i> {{__("POS Shelf Label Queue Overview")}}</h4>
                    <ul>
                        <li>{{__("Labels waiting to be printed. Made by the app: a new or changed price in the selling price list of a POS Profile with shelf labels on, an offer / deal starting today or ending yesterday (daily job), Print Shelf Label on Item / Item Price, or a scan on the Shelf Labels page.")}}</li>
                        <li>{{__("One pending label per item, UOM and price list: a second change updates it (the old price stays the price on the shelf).")}}</li>
                        <li><b>{{__("Pending / Printed / Skipped")}}</b> - {{__("print or skip them on the Shelf Labels page. The report Shelf Label Check lists items whose last printed label does not match the till price, or that were never printed.")}}</li>
                    </ul>
                </td>
            </tr>
        </table>`;
    return help_content;
}
