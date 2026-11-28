


// ----------------------------------------------------------------- Help tab
// Purpose and usage of POS Markdown, shown in the Help tab (HTML field pos_markdown_help).
frappe.ui.form.on("POS Markdown", {
    refresh: function (frm) {
        if (frm.fields_dict.pos_markdown_help) {
            frm.set_df_property("pos_markdown_help", "options", posa_pos_markdown_help_content());
        }
    },
});

function posa_pos_markdown_help_content() {
    var help_content = `<table class="table table-bordered" style="background-color: var(--scrollbar-track-color);">
            <tr>
                <td>
                    <h4><i class="fa fa-tag"></i> {{__("POS Markdown Overview")}}</h4>
                    <ul>
                        <li>{{__("Reduced-price labels for items near expiry, with a damaged pack or on clearance. Used when the POS Profile has Supermarket > Reduced-Price Labels.")}}</li>
                        <li>{{__("Choose the item, the store's price list (the normal price is read from it), the reduced price, the number of labels and Sell Until. Submit makes one label code per item (MD + 10 digits).")}}</li>
                        <li>{{__("Print the labels with the print format Markdown Labels and stick one on each item.")}}</li>
                        <li>{{__("On the till, scanning a label sells that item at the reduced price; each label sells once (the server refuses a label sold before). Cancelling the sale frees the label again.")}}</li>
                        <li><b>{{__("Sold")}}</b> - {{__("how many labels were sold; the Labels table shows which sale took each one.")}}</li>
                    </ul>
                </td>
            </tr>
        </table>`;
    return help_content;
}
