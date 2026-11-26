// Copyright (c) 2026, G2Virtu and contributors
// For license information, please see license.txt

frappe.ui.form.on('Service Table', {
	// refresh: function(frm) {

	// }
});


// ----------------------------------------------------------------- Help tab
// Purpose and usage of Service Table, shown in the Help tab (HTML field service_table_help).
frappe.ui.form.on("Service Table", {
    refresh: function (frm) {
        if (frm.fields_dict.service_table_help) {
            frm.set_df_property("service_table_help", "options", posa_service_table_help_content());
        }
    },
});

function posa_service_table_help_content() {
    var help_content = `<table class="table table-bordered" style="background-color: var(--scrollbar-track-color);">
            <tr>
                <td>
                    <h4><i class="fa fa-th"></i> {{__("Service Table Overview")}}</h4>
                    <ul>
                        <li>{{__("A Service Table is a dining table (or take-away counter) in a Service Zone.")}}</li>
                        <li>{{__("The POS shows the tables of the chosen zone with their status, so waiters see at a glance which tables are free.")}}</li>
                        <li>{{__("Status follows the orders: a table becomes Occupied while its order is open and Available again when the order is paid.")}}</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-list-ol"></i> {{__("Setup Flow")}}</h4>
                    <ol>
                        <li>{{__("Create the table with its name or number (asked when you create it).")}}</li>
                        <li>{{__("Table Info: No of Seats, Minimum Seating, Table Shape, Restaurant (Company), Service Zone and Branch.")}}</li>
                        <li>{{__("Layout Position: X, Y, Width and Height place the table on the floor plan.")}}</li>
                        <li>{{__("Tick Is Take Away for a counter that can hold several orders at the same time.")}}</li>
                        <li>{{__("Active Info shows Status, Occupied and the time of the latest order; you can set Reserved, Cleaning or Disabled by hand.")}}</li>
                    </ol>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-sitemap"></i> {{__("Usage Flow")}}</h4>
                    <ol>
                        <li>{{__("Choose an order type that requires a table, then the zone.")}}</li>
                        <li>{{__("Pick a free table; occupied tables cannot be picked (except take-away tables).")}}</li>
                        <li>{{__("Saving the order marks the table Occupied; moving the order to another table frees the old one.")}}</li>
                        <li>{{__("Submitting (paying) the invoice frees the table.")}}</li>
                    </ol>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-lightbulb-o"></i> {{__("Best Practices")}}</h4>
                    <ul>
                        <li>{{__("Name tables the way staff call them (T1, T2, VIP-1).")}}</li>
                        <li>{{__("Set the Service Table to Allow Zero Rate in the POS Profile only for staff or buffet tables.")}}</li>
                    </ul>
                </td>
            </tr>
        </table>`;
    return help_content;
}
