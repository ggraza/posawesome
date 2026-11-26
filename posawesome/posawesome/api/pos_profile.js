// Copyright (c) 20201 Youssef Restom and contributors
// For license information, please see license.txt

frappe.ui.form.on('POS Profile', {
    setup: function (frm) {
        frm.set_query("posa_cash_mode_of_payment", function (doc) {
            return {
                filters: { 'type': 'Cash' }
            };
        });
    },
    refresh: function(frm) {
        frm.page.sidebar.addClass('hidden');

        frm.page.add_inner_button(__('Toggle Sidebar'), function() {
            frm.page.sidebar.toggleClass('hidden');
        });

        frm.fields_dict['posa_sales_partner'].$input.on('change', function() {
            if (!frm.doc.posa_sales_partner) {
                frm.set_value('sales_partner', '');
            }
        });

        frm.set_query("custom_closing_shift_print_format", function() {
            return {
                filters: [
                    ['Print Format', 'doc_type', '=', 'POS Closing Shift']
                ]
            };
        });

        frm.set_query("custom_expense_invoice_print_format", function() {
            return {
                filters: [
                    ['Print Format', 'doc_type', '=', 'POS Expense Invoice']
                ]
            };
        });

        set_custom_rfid_number_filter(frm);
    }
});

function set_custom_rfid_number_filter(frm) {
    frappe.db.get_list('POS Profile', {
        fields: ['custom_rfid_number'],
        filters: {
            custom_rfid_number: ["!=", '']
        },
        as_list: 1
    }).then(records => {
        let custom_rfid_number_list = [];
        for (let i = 0; i < records.length; i++) {
            custom_rfid_number_list.push(records[i][0]); // Access the first element of the record
        }
        frm.set_query('custom_rfid_number', () => {
            return {
                filters: {
                    rfid_number: ['not in', custom_rfid_number_list]
                }
            };
        });
    });
}


// ----------------------------------------------------------------- Help tab
// Purpose and usage of POS Profile, shown in the Help tab (HTML field posa_pos_profile_help).
frappe.ui.form.on("POS Profile", {
    refresh: function (frm) {
        if (frm.fields_dict.posa_pos_profile_help) {
            frm.set_df_property("posa_pos_profile_help", "options", posa_pos_profile_help_content());
        }
    },
});

function posa_pos_profile_help_content() {
    var help_content = `<table class="table table-bordered" style="background-color: var(--scrollbar-track-color);">
            <tr>
                <td>
                    <h4><i class="fa fa-cogs"></i> {{__("POS Profile Overview")}}</h4>
                    <ul>
                        <li>{{__("The POS Profile is the setup of a group of tills: company, warehouse, price lists, payment methods, users and every POS Awesome option.")}}</li>
                        <li>{{__("Each cashier works on one POS Profile per shift. Terminals download their catalogue (items, prices, offers, customers) for this profile and keep working offline.")}}</li>
                        <li>{{__("Changes saved here reach open terminals within seconds.")}}</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-list-ol"></i> {{__("Setup Flow")}}</h4>
                    <ol>
                        <li>{{__("Details: Company, Customer (walk-in default), Warehouse and the sales team options.")}}</li>
                        <li>{{__("Accounting: Payment Methods (tick the Default one), Currency and Price List (plus MRP Price List), write off, taxes (extra tax on card payments).")}}</li>
                        <li>{{__("POS Configurations: Applicable for Users (the cashiers of this profile) and Item / Customer Group filters (empty = all).")}}</li>
                        <li>{{__("More Info: Print Format and Letter Head of the receipt.")}}</li>
                        <li>{{__("POS Selling: cart and item options, rate and discount permissions, partial payment, credit sale and customer credit.")}}</li>
                        <li>{{__("Returns and Exchange: returns, item exchange / replacement, refund and manager approval.")}}</li>
                        <li>{{__("Customers and Orders: customer options, gift coupons, sales orders and delivery charges.")}}</li>
                        <li>{{__("Screen and Search: screen layout, search and camera scanning, cache and background submit.")}}</li>
                        <li>{{__("Shift and Cash: closing options, closing denominations, cash mode of payment for expenses, POS payments.")}}</li>
                        <li>{{__("Printing and FBR: closing and expense print formats, QZ Tray silent printing, FBR integration (only printed invoices are sent).")}}</li>
                        <li>{{__("Restaurant and KDS: KOT on each save, order types, service zones, captains and buffet.")}}</li>
                        <li>{{__("Offline and Devices: offline mode, weighing-scale barcodes and the customer pole display (VFD).")}}</li>
                        <li>{{__("Save, then open the POS (/app/rmsapp or /app/waiterapp) to check.")}}</li>
                    </ol>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-sitemap"></i> {{__("Daily POS Flow")}}</h4>
                    <ol>
                        <li>{{__("Open Shift: the cashier opens the POS, selects this profile and enters the opening cash (POS Opening Shift).")}}</li>
                        <li>{{__("Customer: walk-in by default; search or create a customer (referral code, loyalty points).")}}</li>
                        <li>{{__("Items: scan barcodes or weighing-scale labels, search by name or code, choose UOM and batch. Prices come from the profile's price list.")}}</li>
                        <li>{{__("Offers and Coupons: auto offers apply by themselves; manual offers and coupon codes from their panels.")}}</li>
                        <li>{{__("Hold / Resume: park the cart as a draft and continue later (also offline).")}}</li>
                        <li>{{__("Payment: enter amounts per payment method (default method is pre-filled), change is calculated, credit sale if allowed.")}}</li>
                        <li>{{__("Submit or Submit and Print: the invoice is posted. With Allow FBR on Submit, only printed invoices are sent to FBR, before printing.")}}</li>
                        <li>{{__("Returns and Exchange: return against an invoice, or Exchange / Replace Items with settlement and approval.")}}</li>
                        <li>{{__("Payments and Expenses: receive customer payments, pay suppliers and record expenses from the menu.")}}</li>
                        <li>{{__("Close Shift: count cash (denominations), compare with expected amounts and submit the POS Closing Shift. A shift cannot close while offline invoices are still waiting to upload.")}}</li>
                    </ol>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-cutlery"></i> {{__("Restaurant Flow")}}</h4>
                    <ol>
                        <li>{{__("Choose the Order Type (Dine In, Take Away, Delivery).")}}</li>
                        <li>{{__("Dine In: choose the Service Zone and a free Service Table.")}}</li>
                        <li>{{__("Add items with notes; saving the order sends Kitchen Tickets to each Kitchen Production Unit (KDS).")}}</li>
                        <li>{{__("More items later: only the new quantities go to the kitchen.")}}</li>
                        <li>{{__("Payment submits the invoice, frees the table and, with Quick Production, consumes ingredients by BOM.")}}</li>
                    </ol>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-wifi"></i> {{__("Offline Flow")}}</h4>
                    <ol>
                        <li>{{__("With Enable Offline Mode, the terminal keeps its catalogue in the browser and checks for changes regularly.")}}</li>
                        <li>{{__("When the server cannot be reached, sales are saved on the terminal with an offline id and a receipt is printed.")}}</li>
                        <li>{{__("When the connection returns, offline invoices upload by themselves, once each (no duplicates).")}}</li>
                        <li>{{__("Failed uploads stay in the queue with the error; the cashier can retry, and back office can review them in POS Offline Invoice.")}}</li>
                    </ol>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-link"></i> {{__("Related Masters")}}</h4>
                    <ul>
                        <li><b>{{__("POS Offer / POS Coupon / Referral Code")}}</b> - {{__("promotions, coupon codes and referral rewards.")}}</li>
                        <li><b>{{__("Delivery Charges")}}</b> - {{__("delivery fees per area and per profile.")}}</li>
                        <li><b>{{__("Order Type / Service Zone / Service Table")}}</b> - {{__("restaurant ordering and table plan.")}}</li>
                        <li><b>{{__("Kitchen Production Unit")}}</b> - {{__("kitchen routing (KOT / KDS) and quick production.")}}</li>
                        <li><b>{{__("POS Kiosk Display")}}</b> - {{__("what the customer price checker screens of this profile show.")}}</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-lightbulb-o"></i> {{__("Best Practices")}}</h4>
                    <ul>
                        <li>{{__("One POS Profile per branch or till group with its own warehouse.")}}</li>
                        <li>{{__("Give cashiers only the permissions they need (discounts, rate edit, returns, credit).")}}</li>
                        <li>{{__("Test changes on one terminal before a busy day; open terminals pick up changes within seconds.")}}</li>
                        <li>{{__("Keep Enable Offline Mode on for shops with unstable internet, and close each shift daily.")}}</li>
                    </ul>
                </td>
            </tr>
        </table>`;
    return help_content;
}
