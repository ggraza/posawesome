// Copyright (c) 2026, Youssef Restom and contributors
// For license information, please see license.txt

frappe.ui.form.on('Service Zone', {
	// refresh: function(frm) {

	// }
});


// ----------------------------------------------------------------- Help tab
// Purpose and usage of Service Zone, shown in the Help tab (HTML field service_zone_help).
frappe.ui.form.on("Service Zone", {
    refresh: function (frm) {
        if (frm.fields_dict.service_zone_help) {
            frm.set_df_property("service_zone_help", "options", posa_service_zone_help_content());
        }
    },
});

function posa_service_zone_help_content() {
    var help_content = `<table class="table table-bordered" style="background-color: var(--scrollbar-track-color);">
            <tr>
                <td>
                    <h4><i class="fa fa-th-large"></i> {{__("Service Zone Overview")}}</h4>
                    <ul>
                        <li>{{__("A Service Zone is an area of the restaurant: Ground Floor, Family Hall, Rooftop, Outdoor, VIP.")}}</li>
                        <li>{{__("Zones group the Service Tables, filter the table plan in the POS and the order status display (LOS).")}}</li>
                        <li>{{__("Zones form a tree: tick Is Group for an area that contains other zones; only leaf zones are used on orders.")}}</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-list-ol"></i> {{__("Setup Flow")}}</h4>
                    <ol>
                        <li>{{__("Create the zones (and parent groups if needed) with a short Abbr and an optional Image.")}}</li>
                        <li>{{__("Create the Service Tables and set their Service Zone.")}}</li>
                        <li>{{__("In the POS Profile, add the zones this terminal serves in the POS Service Zone table and choose the Default Service Zone.")}}</li>
                    </ol>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-sitemap"></i> {{__("Usage Flow")}}</h4>
                    <ol>
                        <li>{{__("The waiter or cashier chooses the order type, then the zone (the default zone is preselected).")}}</li>
                        <li>{{__("Only the tables of that zone are shown, with their status.")}}</li>
                        <li>{{__("The zone is saved on the invoice; dine-in orders with a zone also create a queue ticket on the LOS screen.")}}</li>
                    </ol>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-lightbulb-o"></i> {{__("Best Practices")}}</h4>
                    <ul>
                        <li>{{__("Limit each POS Profile to the zones its staff really serves.")}}</li>
                        <li>{{__("Use the same zone names as the floor plan staff knows.")}}</li>
                    </ul>
                </td>
            </tr>
        </table>`;
    return help_content;
}
