


// ----------------------------------------------------------------- Help tab
// Purpose and usage of POS Quick Key Page, shown in the Help tab (HTML field pos_quick_key_page_help).
frappe.ui.form.on("POS Quick Key Page", {
    refresh: function (frm) {
        if (frm.fields_dict.pos_quick_key_page_help) {
            frm.set_df_property("pos_quick_key_page_help", "options", posa_pos_quick_key_page_help_content());
        }
    },
});

function posa_pos_quick_key_page_help_content() {
    var help_content = `<table class="table table-bordered" style="background-color: var(--scrollbar-track-color);">
            <tr>
                <td>
                    <h4><i class="fa fa-th"></i> {{__("POS Quick Key Page Overview")}}</h4>
                    <ul>
                        <li>{{__("A page of big buttons on the till for items without a barcode: fruit, vegetables, bread, eggs. Each page is a tab of the Quick Keys window.")}}</li>
                        <li>{{__("Used when the POS Profile has Supermarket > Quick Keys. Empty POS Profiles = every profile with Quick Keys on.")}}</li>
                        <li><b>{{__("Button Text")}}</b> - {{__("short text on the button (empty = the item name); the item picture shows when the item has one.")}}</li>
                        <li><b>{{__("Ask Weight")}}</b> - {{__("the till asks the weight (or reads it from the scale) when the button is pressed. Items with a weighed UOM ask it anyway when Ask Weight for Weighed Items is on.")}}</li>
                        <li>{{__("Up to 60 buttons per page. Disabled items are left out. Open tills get the change at once.")}}</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-list-ol"></i> {{__("Setup Flow")}}</h4>
                    <ol>
                        <li>{{__("Make one page per group (Fruit, Vegetables, Bakery) with a Sequence for the tab order.")}}</li>
                        <li>{{__("Add the items, a short Button Text and a colour if you like.")}}</li>
                        <li>{{__("On the till: Quick Keys (top bar) > tab > button.")}}</li>
                    </ol>
                </td>
            </tr>
        </table>`;
    return help_content;
}
