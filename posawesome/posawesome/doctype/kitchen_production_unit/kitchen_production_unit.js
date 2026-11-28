// Copyright (c) 2025, Youssef Restom and contributors
// For license information, please see license.txt

frappe.ui.form.on('Kitchen Production Unit', {
	// refresh: function(frm) {

	// }
});


// ----------------------------------------------------------------- Help tab
// Purpose and usage of Kitchen Production Unit, shown in the Help tab (HTML field kitchen_production_unit_help).
frappe.ui.form.on("Kitchen Production Unit", {
    refresh: function (frm) {
        if (frm.fields_dict.kitchen_production_unit_help) {
            frm.set_df_property("kitchen_production_unit_help", "options", posa_kitchen_production_unit_help_content());
        }
    },
});

function posa_kitchen_production_unit_help_content() {
    var help_content = `<table class="table table-bordered" style="background-color: var(--scrollbar-track-color);">
            <tr>
                <td>
                    <h4><i class="fa fa-cutlery"></i> {{__("Kitchen Production Unit Overview")}}</h4>
                    <ul>
                        <li>{{__("A Kitchen Production Unit is a preparation section such as Grill, Tandoor, Bar or Bakery.")}}</li>
                        <li>{{__("It decides which items go to which kitchen: orders are split into Kitchen Tickets (KOT) per unit and shown on the Kitchen Display (KDS) of that unit.")}}</li>
                        <li>{{__("With Allow Quick Production, sold items are produced automatically from their BOM when the invoice is submitted.")}}</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-list-ol"></i> {{__("Setup Flow")}}</h4>
                    <ol>
                        <li>{{__("Enter the Production Unit Name, the Company and the POS Profile it serves (required).")}}</li>
                        <li>{{__("Choose Apply On: Item Code, Item Group or Both.")}}</li>
                        <li>{{__("Add the items in Kitchen Item Detail and / or the groups in Kitchen Item Groups.")}}</li>
                        <li>{{__("For quick production: set Default Source Warehouse (raw materials) and Default Target Warehouse (finished items), tick Allow Quick Production, and make sure each item has an active default BOM.")}}</li>
                        <li>{{__("In the POS Profile, KDS Settings tab: turn on KOT (POSA KOT on Each Save) so tickets are sent when the order is saved.")}}</li>
                    </ol>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-sitemap"></i> {{__("Order to Kitchen Flow")}}</h4>
                    <ol>
                        <li>{{__("The waiter or cashier saves the order (Hold / Save) in the POS.")}}</li>
                        <li>{{__("New or added quantities are split by unit: one Kitchen Ticket per Kitchen Production Unit.")}}</li>
                        <li>{{__("Each ticket appears at once on the KDS page of its unit (/app/kds) with item notes.")}}</li>
                        <li>{{__("Dine-in orders with a Service Zone also get a queue ticket on the order status display (LOS).")}}</li>
                        <li>{{__("The kitchen moves the ticket through its statuses; the POS and LOS follow live.")}}</li>
                        <li>{{__("On payment (submit), Quick Production creates a Manufacture Stock Entry per item from its BOM.")}}</li>
                    </ol>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-lightbulb-o"></i> {{__("Best Practices")}}</h4>
                    <ul>
                        <li>{{__("Each item should belong to only one unit, otherwise the first match wins.")}}</li>
                        <li>{{__("Prefer Item Groups for large menus and Item Code for exceptions.")}}</li>
                        <li>{{__("Check BOMs before enabling Allow Quick Production; an item without an active default BOM stops the invoice.")}}</li>
                    </ul>
                </td>
            </tr>
        </table>`;
    return help_content;
}
