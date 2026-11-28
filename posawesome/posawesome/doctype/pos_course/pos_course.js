


// ----------------------------------------------------------------- Help tab
// Purpose and usage of POS Course, shown in the Help tab (HTML field pos_course_help).
frappe.ui.form.on("POS Course", {
    refresh: function (frm) {
        if (frm.fields_dict.pos_course_help) {
            frm.set_df_property("pos_course_help", "options", posa_pos_course_help_content());
        }
    },
});

function posa_pos_course_help_content() {
    var help_content = `<table class="table table-bordered" style="background-color: var(--scrollbar-track-color);">
            <tr>
                <td>
                    <h4><i class="fa fa-cutlery"></i> {{__("POS Course Overview")}}</h4>
                    <ul>
                        <li>{{__("A course is a stage of a meal: Drinks, Starters, Mains, Desserts. Used when the POS Profile has Fine Dining > Courses with Hold / Fire.")}}</li>
                        <li>{{__("Every item on an order gets a course; the kitchen ticket lists items course by course.")}}</li>
                        <li><b>{{__("Hold Until Fired")}}</b> - {{__("items of this course wait in the order and go to the kitchen only when the waiter presses Fire (e.g. Fire Mains when the starters are cleared).")}}</li>
                        <li>{{__("Courses without Hold Until Fired (drinks, starters) go to the kitchen with the next send, as before.")}}</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-list-ol"></i> {{__("Setup Flow")}}</h4>
                    <ol>
                        <li>{{__("Enter the Course name and a Sequence (Starters 10, Mains 20, Desserts 30).")}}</li>
                        <li>{{__("Tick Hold Until Fired for courses that should wait for the waiter.")}}</li>
                        <li>{{__("Default Course For: add the Item Groups whose items get this course when added to an order. An item group belongs to one course.")}}</li>
                        <li>{{__("Optional Colour for the course chip in the POS.")}}</li>
                        <li>{{__("Default courses (Drinks, Starters, Mains, Desserts) are created on the first migrate; change them as you like.")}}</li>
                    </ol>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-sitemap"></i> {{__("Usage Flow")}}</h4>
                    <ol>
                        <li>{{__("The waiter adds items; each gets its course from its item group (the waiter can change it on the item).")}}</li>
                        <li>{{__("Send (Make KOT / Hold Sale): fired courses go to the kitchen; held courses wait.")}}</li>
                        <li>{{__("The bar above the cart shows Fire Mains (n) while mains are waiting; pressing it sends them at once.")}}</li>
                        <li>{{__("A single item can be switched between Hold and Fire on its chip before it is sent.")}}</li>
                    </ol>
                </td>
            </tr>
        </table>`;
    return help_content;
}
