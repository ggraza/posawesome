// Copyright (c) 2021, Youssef Restom and contributors
// For license information, please see license.txt

frappe.ui.form.on('POS Coupon', {
	setup: function (frm) {
		frm.set_query("pos_offer", function () {
			return {
				filters: {
					"company": frm.doc.company,
					"coupon_based": 1,
					"disable": 0,
				}
			};
		});
	},
	coupon_name: function (frm) {
		if (frm.doc.__islocal === 1) {
			frm.trigger("make_coupon_code");
		}
	},
	coupon_type: function (frm) {
		if (frm.doc.__islocal === 1) {
			frm.trigger("make_coupon_code");
		}
	},
	make_coupon_code: function (frm) {
		var coupon_name = frm.doc.coupon_name;
		var coupon_code;
		if (frm.doc.coupon_type == 'Gift Card') {
			coupon_code = Math.random().toString(12).substring(2, 12).toUpperCase();
		}
		else if (frm.doc.coupon_type == 'Promotional') {
			coupon_name = coupon_name.replace(/\s/g, '');
			coupon_code = coupon_name.toUpperCase().slice(0, 8);
		}
		frm.doc.coupon_code = coupon_code;
		frm.refresh_field('coupon_code');
	},
	refresh: function (frm) {
		if (frm.doc.pricing_rule) {
			frm.add_custom_button(__("Add/Edit Coupon Conditions"), function () {
				frappe.set_route("Form", "POS Offer", frm.doc.pos_offer);
			});
		}
	}
});


// ----------------------------------------------------------------- Help tab
// Purpose and usage of POS Coupon, shown in the Help tab (HTML field pos_coupon_help).
frappe.ui.form.on("POS Coupon", {
    refresh: function (frm) {
        if (frm.fields_dict.pos_coupon_help) {
            frm.set_df_property("pos_coupon_help", "options", posa_pos_coupon_help_content());
        }
    },
});

function posa_pos_coupon_help_content() {
    var help_content = `<table class="table table-bordered" style="background-color: var(--scrollbar-track-color);">
            <tr>
                <td>
                    <h4><i class="fa fa-ticket"></i> {{__("POS Coupon Overview")}}</h4>
                    <ul>
                        <li>{{__("A POS Coupon is a code that unlocks a Coupon Code Based POS Offer at the till.")}}</li>
                        <li><b>{{__("Promotional")}}</b> - {{__("One shared code for many customers, e.g. SAVE20 in a campaign.")}}</li>
                        <li><b>{{__("Gift Card")}}</b> - {{__("A personal code for one customer, used once. Gift cards are also created automatically by Referral Codes.")}}</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-list-ol"></i> {{__("Setup Flow")}}</h4>
                    <ol>
                        <li>{{__("Create the POS Offer first and tick Coupon Code Based on it.")}}</li>
                        <li>{{__("Enter the Coupon Name and choose the Coupon Type.")}}</li>
                        <li>{{__("Coupon Code: leave empty to generate it (Promotional: first letters of the name; Gift Card: random 10 characters), or type your own unique code.")}}</li>
                        <li>{{__("Select the POS Offer and the Company (must be the offer's company; the offer must be enabled).")}}</li>
                        <li>{{__("Gift Card: select the Customer; Maximum Use is set to 1.")}}</li>
                        <li>{{__("Set Valid From / Valid Upto (kept inside the offer's own dates), Maximum Use and Only One Use Per Customer.")}}</li>
                        <li>{{__("Save and share the code with the customer.")}}</li>
                    </ol>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-shopping-cart"></i> {{__("Usage at the POS")}}</h4>
                    <ol>
                        <li>{{__("Select the customer, then enter the code in the Coupons panel.")}}</li>
                        <li>{{__("The POS checks the code: dates, company, customer (gift card), uses left and one use per customer.")}}</li>
                        <li>{{__("The linked offer is applied to the cart like any other offer.")}}</li>
                        <li>{{__("When the invoice is submitted, Used goes up by one; cancelling the invoice gives the use back.")}}</li>
                        <li>{{__("With Auto Fetch Coupon Gifts on the POS Profile, the customer's open gift cards are offered automatically.")}}</li>
                    </ol>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-lightbulb-o"></i> {{__("Best Practices")}}</h4>
                    <ul>
                        <li>{{__("Use short, easy codes for promotional campaigns and set a Maximum Use.")}}</li>
                        <li>{{__("Link a Campaign to measure the result of each promotion.")}}</li>
                        <li>{{__("Do not reuse the same code for different offers.")}}</li>
                    </ul>
                </td>
            </tr>
        </table>`;
    return help_content;
}
