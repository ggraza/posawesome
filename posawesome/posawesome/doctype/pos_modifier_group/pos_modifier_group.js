


// ----------------------------------------------------------------- Help tab
// Purpose and usage of POS Modifier Group, shown in the Help tab (HTML field pos_modifier_group_help).
frappe.ui.form.on("POS Modifier Group", {
    refresh: function (frm) {
        if (frm.fields_dict.pos_modifier_group_help) {
            frm.set_df_property("pos_modifier_group_help", "options", posa_pos_modifier_group_help_content());
        }
    },
});

function posa_pos_modifier_group_help_content() {
    var help_content = `<table class="table table-bordered" style="background-color: var(--scrollbar-track-color);">
            <tr>
                <td>
                    <h4><i class="fa fa-sliders"></i> {{__("POS Modifier Group Overview")}}</h4>
                    <ul>
                        <li>{{__("A modifier group is a choice the waiter makes when adding an item: Steak Doneness, Choose a Side, Extras.")}}</li>
                        <li>{{__("Used when the POS Profile has Fine Dining > Item Modifiers.")}}</li>
                        <li>{{__("The choices are printed on the kitchen ticket under the item and on the guest check.")}}</li>
                        <li><b>{{__("Paid add-on")}}</b> - {{__("an option with a Paid Add-on Item adds that item to the bill at its own price, right under the main item (e.g. + Extra Cheese).")}}</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-list-ol"></i> {{__("Setup Flow")}}</h4>
                    <ol>
                        <li>{{__("Enter the Group Name (what the waiter sees) and a Sequence for the order of groups.")}}</li>
                        <li>{{__("Required: the item cannot be added without a choice. Minimum / Maximum Choices: 1 / 1 = choose one; 0 / 0 = any number.")}}</li>
                        <li>{{__("Options: one row per choice. Optional Paid Add-on Item; Selected By Default pre-ticks the option.")}}</li>
                        <li>{{__("Applies To: the Items or Item Groups that ask this group.")}}</li>
                    </ol>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-sitemap"></i> {{__("Usage Flow")}}</h4>
                    <ol>
                        <li>{{__("Adding an item with modifier groups opens the options window.")}}</li>
                        <li>{{__("Choose and press OK; cancelling a required choice does not add the item.")}}</li>
                        <li>{{__("Before the item is sent, Options on its chip changes the choices.")}}</li>
                        <li>{{__("Each item with options is its own line, so two steaks can be cooked differently.")}}</li>
                    </ol>
                </td>
            </tr>
        </table>`;
    return help_content;
}
