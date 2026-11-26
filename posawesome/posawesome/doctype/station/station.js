// Copyright (c) 2025, Youssef Restom and contributors
// For license information, please see license.txt

frappe.ui.form.on('Station', {
	// refresh: function(frm) {

	// }
});


// ----------------------------------------------------------------- Help tab
// Purpose and usage of Station, shown in the Help tab (HTML field station_help).
frappe.ui.form.on("Station", {
    refresh: function (frm) {
        if (frm.fields_dict.station_help) {
            frm.set_df_property("station_help", "options", posa_station_help_content());
        }
    },
});

function posa_station_help_content() {
    var help_content = `<table class="table table-bordered" style="background-color: var(--scrollbar-track-color);">
            <tr>
                <td>
                    <h4><i class="fa fa-map-marker"></i> {{__("Station Overview")}}</h4>
                    <ul>
                        <li>{{__("Station is a tree of work stations of the outlet, for example Main Kitchen, Grill, Bar, Packing Counter or Cashier Desk.")}}</li>
                        <li>{{__("Use it to name and group the places where orders are prepared or handed over.")}}</li>
                        <li>{{__("Kitchen routing (KOT / KDS) uses Kitchen Production Units; Station is the master list for organising and reporting.")}}</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-list-ol"></i> {{__("Setup Flow")}}</h4>
                    <ol>
                        <li>{{__("Create the top-level stations and tick Is Group for stations that contain others (e.g. Main Kitchen).")}}</li>
                        <li>{{__("Create the working stations under them by choosing the Parent Station.")}}</li>
                        <li>{{__("Give each station a short Abbr and an optional Image.")}}</li>
                        <li>{{__("Only leaf stations (Is Group off) are chosen in transactions.")}}</li>
                    </ol>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-lightbulb-o"></i> {{__("Best Practices")}}</h4>
                    <ul>
                        <li>{{__("Keep names short and the same as the signs in the outlet.")}}</li>
                        <li>{{__("Use the tree view to move stations between groups instead of renaming.")}}</li>
                    </ul>
                </td>
            </tr>
        </table>`;
    return help_content;
}
