


// ----------------------------------------------------------------- Help tab
// Purpose and usage of POS Gift Card, shown in the Help tab (HTML field pos_gift_card_help).
frappe.ui.form.on("POS Gift Card", {
    refresh: function (frm) {
        if (frm.fields_dict.pos_gift_card_help) {
            frm.set_df_property("pos_gift_card_help", "options", posa_pos_gift_card_help_content());
        }
    },
});

function posa_pos_gift_card_help_content() {
    var help_content = `<table class="table table-bordered" style="background-color: var(--scrollbar-track-color);">
            <tr>
                <td>
                    <h4><i class="fa fa-credit-card"></i> {{__("POS Gift Card Overview")}}</h4>
                    <ul>
                        <li>{{__("A stored-value card: sold and topped up on the till, taken as payment, and used for store credit when a return is refunded on it.")}}</li>
                        <li>{{__("Used when the POS Profile has Supermarket > Gift Cards. Set the Gift Card Item (a non-stock item) and the Gift Card Mode of Payment there, and add that mode to the profile's payment methods.")}}</li>
                        <li>{{__("Accounts: give the Gift Card Item's income account and the mode of payment's account the same liability account (e.g. Gift Cards Payable). Selling a card then credits the liability and paying with it debits it.")}}</li>
                        <li><b>{{__("Balance")}}</b> - {{__("the sum of the History. Each sale, payment, store credit and cancellation adds a row; nothing is edited by hand.")}}</li>
                        <li><b>{{__("Status")}}</b> - {{__("Blocked stops a card being paid with or topped up (e.g. a lost card).")}}</li>
                        <li>{{__("Paying with a card needs the connection: the server checks the balance when the sale is submitted, so a card cannot be spent twice on two tills.")}}</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-list-ol"></i> {{__("Usage Flow")}}</h4>
                    <ol>
                        <li>{{__("Sell / top up: Menu > Gift Card > Sell / Top Up, scan the card, type the amount, Add to Cart, take the payment.")}}</li>
                        <li>{{__("Pay with it: on the payment screen put the amount in the gift card mode; at Submit the till asks to scan the card and shows its balance.")}}</li>
                        <li>{{__("Store credit: on a return put the refund in the gift card mode; scan the customer's card or press New Card.")}}</li>
                        <li>{{__("Balance: Menu > Gift Card > Balance.")}}</li>
                    </ol>
                </td>
            </tr>
        </table>`;
    return help_content;
}
