


// ----------------------------------------------------------------- Help tab
// Purpose and usage of POS Deal, shown in the Help tab (HTML field pos_deal_help).
frappe.ui.form.on("POS Deal", {
    refresh: function (frm) {
        if (frm.fields_dict.pos_deal_help) {
            frm.set_df_property("pos_deal_help", "options", posa_pos_deal_help_content());
        }
    },
});

function posa_pos_deal_help_content() {
    var help_content = `<table class="table table-bordered" style="background-color: var(--scrollbar-track-color);">
            <tr>
                <td>
                    <h4><i class="fa fa-tags"></i> {{__("POS Deal Overview")}}</h4>
                    <ul>
                        <li><b>{{__("Mix and Match")}}</b> - {{__("any items of the lists count together: any 3 juices for Rs 999. The most expensive ones are grouped first.")}}</li>
                        <li><b>{{__("Multi-Buy")}}</b> - {{__("the same item: 3 of one soap for Rs 500. With Repeat, 6 for 1000 and so on.")}}</li>
                        <li>{{__("Used when the POS Profile has Supermarket > Mix and Match Deals / Multi-Buy Deals. The till prices the lines by itself as the cart changes; the server checks the deal prices when the sale is submitted.")}}</li>
                        <li>{{__("A deal is used only when it is cheaper than the normal price. Lines with a POS Offer, a manual discount, a free item or a reduced-price label are left out: offers win over deals.")}}</li>
                        <li><b>{{__("When")}}</b> - {{__("dates, daily hours (a window like 22:00 to 02:00 runs past midnight) and days (Fri, Sat).")}}</li>
                        <li><b>{{__("Priority")}}</b> - {{__("when an item is in two deals, the higher priority wins.")}}</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-list-ol"></i> {{__("Setup Flow")}}</h4>
                    <ol>
                        <li>{{__("Title, Deal Type, Quantity and Deal Price.")}}</li>
                        <li>{{__("Items, Item Groups and / or Brands of the deal; POS Profiles (empty = all).")}}</li>
                        <li>{{__("Repeat and Most Deals Per Sale; dates and hours if needed.")}}</li>
                        <li>{{__("Open tills get the change at once.")}}</li>
                    </ol>
                </td>
            </tr>
        </table>`;
    return help_content;
}
