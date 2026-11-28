


// ----------------------------------------------------------------- Help tab
// Purpose and usage of POS Shelf Label Template, shown in the Help tab (HTML field pos_shelf_label_template_help).
frappe.ui.form.on("POS Shelf Label Template", {
    refresh: function (frm) {
        if (frm.fields_dict.pos_shelf_label_template_help) {
            frm.set_df_property("pos_shelf_label_template_help", "options", posa_pos_shelf_label_template_help_content());
        }
    },
});

function posa_pos_shelf_label_template_help_content() {
    var help_content = `<table class="table table-bordered" style="background-color: var(--scrollbar-track-color);">
            <tr>
                <td>
                    <h4><i class="fa fa-tag"></i> {{__("POS Shelf Label Template Overview")}}</h4>
                    <ul>
                        <li>{{__("How a shelf-edge label looks. Used by the Shelf Labels page when the POS Profile has Supermarket > Shelf-Edge Labels.")}}</li>
                        <li><b>{{__("HTML")}}</b> - {{__("for A4 sheets (Labels Across x Rows per Page) or one label per page on a label printer through the browser / QZ Tray.")}}</li>
                        <li><b>{{__("ZPL")}}</b> - {{__("Zebra label printers; TSPL: TSC, Xprinter and similar. Raw commands go straight to the label printer through QZ Tray.")}}</li>
                        <li>{{__("The template is Jinja. Fields: item_code, item_name, name2 (second name, e.g. Urdu), uom, price_text, mrp_text, saving_text, was_text, unit_price_text (per kg / litre from Item > Weight Per Unit), barcode, barcode_svg (HTML), offer_text, valid_until, company, print_date.")}}</li>
                        <li>{{__("Four templates are made the first time shelf labels are switched on: Shelf 58x38, A4 Sheet 3x8, Zebra ZPL 58x38, TSC TSPL 58x38. Copy one to make your own.")}}</li>
                    </ul>
                </td>
            </tr>
        </table>`;
    return help_content;
}
