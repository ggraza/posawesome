// Copyright (c) 2026, G2Virtu and contributors
// For license information, please see license.txt

frappe.ui.form.on('Order Type', {
	// refresh: function(frm) {

	// }
});


// ----------------------------------------------------------------- Help tab
// Purpose and usage of Order Type, shown in the Help tab (HTML field order_type_help).
frappe.ui.form.on("Order Type", {
    refresh: function (frm) {
        if (frm.fields_dict.order_type_help) {
            frm.set_df_property("order_type_help", "options", posa_order_type_help_content());
        }
    },
});

function posa_order_type_help_content() {
    var help_content = `<table class="table table-bordered" style="background-color: var(--scrollbar-track-color);">
            <tr>
                <td>
                    <h4><i class="fa fa-list-alt"></i> {{__("Order Type Overview")}}</h4>
                    <ul>
                        <li>{{__("Order Types describe how the customer is served: Dine In, Take Away, Delivery, Drive Thru, Online.")}}</li>
                        <li>{{__("The order type is chosen at the start of an order and saved on the invoice (Order Type).")}}</li>
                        <li>{{__("It decides what the POS asks next:")}}</li>
                        <li><b>{{__("Is Table Required")}}</b> - {{__("the cashier must choose a Service Table before saving.")}}</li>
                        <li><b>{{__("Is Take Away")}}</b> - {{__("no table; the order is packed.")}}</li>
                        <li><b>{{__("Is Delivery")}}</b> - {{__("for home delivery: customer address and Delivery Charges.")}}</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-list-ol"></i> {{__("Setup Flow")}}</h4>
                    <ol>
                        <li>{{__("Create the order types with an optional Image (shown on the selection buttons).")}}</li>
                        <li>{{__("Tick the matching options: Is Table Required, Is Take Away or Is Delivery.")}}</li>
                        <li>{{__("In the POS Profile, tick Allow Restaurant Order Type and add the allowed types in the POS Order Type table.")}}</li>
                        <li>{{__("Tick Disable to hide an order type everywhere.")}}</li>
                    </ol>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-sitemap"></i> {{__("Usage Flow")}}</h4>
                    <ol>
                        <li>{{__("The waiter or cashier selects the order type.")}}</li>
                        <li>{{__("Dine In: choose the zone and table; the table becomes Occupied.")}}</li>
                        <li>{{__("Take Away / Delivery: continue without a table; Delivery adds the delivery charge.")}}</li>
                        <li>{{__("The order type is printed on the KOT and receipt and can be used in sales reports.")}}</li>
                    </ol>
                </td>
            </tr>
        </table>`;
    return help_content;
}
