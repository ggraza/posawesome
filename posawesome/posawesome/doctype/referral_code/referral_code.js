// Copyright (c) 2021, Youssef Restom and contributors
// For license information, please see license.txt

frappe.ui.form.on('Referral Code', {
	setup: function (frm) {
		frm.set_query("party_type", function () {
			return {
				filters: {
					"name": ["in", ["Customer"]],
				}
			};
		});
		frm.set_query("customer_offer", function () {
			return {
				filters: {
					"company": frm.doc.company,
					"coupon_based": 1,
					"disable": 0,
				}
			};
		});
		frm.set_query("primary_offer", function () {
			return {
				filters: {
					"company": frm.doc.company,
					"coupon_based": 1,
					"disable": 0,
				}
			};
		});
	},
	referral_name: function (frm) {
		if (frm.doc.__islocal === 1) {
			frm.trigger("make_referral_code");
		}
	},
	make_referral_code: function (frm) {
		let referral_name = frm.doc.referral_name;
		let referral_code;
		if (!referral_name) {
			frm.doc.referral_name = frm.doc.party + Math.random().toString(5).substring(2, 5).toUpperCase();
			referral_code = Math.random().toString(12).substring(2, 12).toUpperCase();
		}
		else {
			referral_name = referral_name.replace(/\s/g, '');
			referral_code = referral_name.toUpperCase().slice(0, 8);
		}
		frm.doc.referral_code = referral_code;
		frm.refresh_field('referral_name');
		frm.refresh_field('referral_code');
	},

});


// ----------------------------------------------------------------- Help tab
// Purpose and usage of Referral Code, shown in the Help tab (HTML field referral_code_help).
frappe.ui.form.on("Referral Code", {
    refresh: function (frm) {
        if (frm.fields_dict.referral_code_help) {
            frm.set_df_property("referral_code_help", "options", posa_referral_code_help_content());
        }
    },
});

function posa_referral_code_help_content() {
    var help_content = `<table class="table table-bordered" style="background-color: var(--scrollbar-track-color);">
            <tr>
                <td>
                    <h4><i class="fa fa-users"></i> {{__("Referral Code Overview")}}</h4>
                    <ul>
                        <li>{{__("A Referral Code belongs to an existing customer (the referrer) who shares it with friends.")}}</li>
                        <li>{{__("When a new customer is registered with that code, both get a Gift Card coupon:")}}</li>
                        <li><b>{{__("Final Customer Offer")}}</b> - {{__("the offer for the new customer.")}}</li>
                        <li><b>{{__("Primary Customer Offer")}}</b> - {{__("the reward for the referrer.")}}</li>
                        <li>{{__("Both offers must be Coupon Code Based POS Offers of the same company.")}}</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-list-ol"></i> {{__("Setup Flow")}}</h4>
                    <ol>
                        <li>{{__("Create the two Coupon Code Based POS Offers (new customer reward and referrer reward).")}}</li>
                        <li>{{__("Manual: create a Referral Code with Company, Customer (referrer), the two offers and an optional Campaign. The code is generated (10 characters) if left empty.")}}</li>
                        <li>{{__("Automatic: in Company, tick Auto Create Referral For New Customers and set Final Customer Offer, Primary Customer Offer and Referral Campaign. Every new customer then gets their own referral code.")}}</li>
                    </ol>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-sitemap"></i> {{__("Referral Flow")}}</h4>
                    <ol>
                        <li>{{__("The referrer gives their code to a friend.")}}</li>
                        <li>{{__("The cashier creates the new customer in the POS and enters the Referral Code.")}}</li>
                        <li>{{__("The code is checked; a disabled or unknown code is refused.")}}</li>
                        <li>{{__("A Gift Card coupon with the Final Customer Offer is created for the new customer.")}}</li>
                        <li>{{__("A Gift Card coupon with the Primary Customer Offer is created for the referrer.")}}</li>
                        <li>{{__("Each gift card is used once at the till like any POS Coupon.")}}</li>
                    </ol>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-lightbulb-o"></i> {{__("Best Practices")}}</h4>
                    <ul>
                        <li>{{__("Tick Disabled to stop a code without deleting its history.")}}</li>
                        <li>{{__("Keep referral offers valid for a limited time and track them with a Campaign.")}}</li>
                    </ul>
                </td>
            </tr>
        </table>`;
    return help_content;
}
