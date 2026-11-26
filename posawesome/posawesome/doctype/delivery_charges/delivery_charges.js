// Copyright (c) 2022, Youssef Restom and contributors
// For license information, please see license.txt

frappe.ui.form.on('Delivery Charges', {
	setup: function (frm) {
		frm.set_query("shipping_account", function (doc) {
			return {
				filters: { 'company': doc.company }
			};
		});
		frm.set_query("cost_center", function (doc) {
			return {
				filters: { 'company': doc.company }
			};
		});
		frm.set_query("pos_profile", "profiles", function (doc) {
			return {
				filters: { 'company': doc.company }
			};
		});
	},
});


// ----------------------------------------------------------------- Help tab
// Purpose and usage of Delivery Charges, shown in the Help tab (HTML field delivery_charges_help).
frappe.ui.form.on("Delivery Charges", {
    refresh: function (frm) {
        if (frm.fields_dict.delivery_charges_help) {
            frm.set_df_property("delivery_charges_help", "options", posa_delivery_charges_help_content());
        }
    },
});

function posa_delivery_charges_help_content() {
    var help_content = `<table class="table table-bordered" style="background-color: var(--scrollbar-track-color);">
            <tr>
                <td>
                    <h4><i class="fa fa-truck"></i> {{__("Delivery Charges Overview")}}</h4>
                    <ul>
                        <li>{{__("Delivery Charges are fixed charges added to a POS invoice for home delivery.")}}</li>
                        <li>{{__("The charge is added as an Actual tax row (description = the label) posted to the Shipping Account and Cost Center.")}}</li>
                        <li>{{__("The rate can differ per POS Profile (branch).")}}</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-list-ol"></i> {{__("Setup Flow")}}</h4>
                    <ol>
                        <li>{{__("Enter the Label (e.g. City Area, Outer Area), the Company and the Default Rate.")}}</li>
                        <li>{{__("Select the Shipping Account (income account for delivery) and the Cost Center.")}}</li>
                        <li>{{__("Optional: in POS Profiles, add the profiles and a rate for each. Charges without any profile are available on every POS Profile at the default rate.")}}</li>
                        <li>{{__("Optional: set Delivery Charges on a customer Address so it is suggested for that customer.")}}</li>
                        <li>{{__("In the POS Profile, tick Use Delivery Charges, and Auto Set Delivery Charges to pick the customer's charge automatically.")}}</li>
                    </ol>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-shopping-cart"></i> {{__("Usage at the POS")}}</h4>
                    <ol>
                        <li>{{__("The cashier chooses the delivery charge in the invoice (or it is set from the customer's address).")}}</li>
                        <li>{{__("The rate of the terminal's POS Profile is used, otherwise the default rate.")}}</li>
                        <li>{{__("Changing or clearing the charge replaces or removes the tax row; totals update at once.")}}</li>
                    </ol>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-lightbulb-o"></i> {{__("Best Practices")}}</h4>
                    <ul>
                        <li>{{__("Use one label per delivery area so reports show income per area.")}}</li>
                        <li>{{__("Tick Disabled for charges you no longer use.")}}</li>
                    </ul>
                </td>
            </tr>
        </table>`;
    return help_content;
}
