


// ----------------------------------------------------------------- Help tab
// Purpose and usage of POS Reservation, shown in the Help tab (HTML field pos_reservation_help).
frappe.ui.form.on("POS Reservation", {
    refresh: function (frm) {
        if (frm.fields_dict.pos_reservation_help) {
            frm.set_df_property("pos_reservation_help", "options", posa_pos_reservation_help_content());
        }
    },
});

function posa_pos_reservation_help_content() {
    var help_content = `<table class="table table-bordered" style="background-color: var(--scrollbar-track-color);">
            <tr>
                <td>
                    <h4><i class="fa fa-calendar"></i> {{__("POS Reservation Overview")}}</h4>
                    <ul>
                        <li>{{__("A booking for a table at a time, or a walk-in waiting for a table (Waitlist). Used when the POS Profile has Fine Dining > Reservations and Waitlist.")}}</li>
                        <li>{{__("A table booked within Hold Table Before Booking minutes shows Reserved on the floor.")}}</li>
                        <li>{{__("A table cannot be booked twice for overlapping times; more guests than seats only warns.")}}</li>
                    </ul>
                </td>
            </tr>
            <tr>
                <td>
                    <h4><i class="fa fa-list-ol"></i> {{__("Usage Flow")}}</h4>
                    <ol>
                        <li>{{__("Take the booking here, in the Calendar view, or on the POS: Floor > Bookings > Add.")}}</li>
                        <li>{{__("When the guests come: Arrived, then Seat (or tap the table and Seat Booking). The POS opens a new order on the table with the guests, customer and allergies.")}}</li>
                        <li>{{__("Walk-ins: add them to the Waitlist with the quoted wait; Seat them when a table frees up.")}}</li>
                        <li>{{__("Paying the order completes the booking. Mark No Show or Cancel otherwise; POS Fine Dining Analytics counts bookings and no-shows.")}}</li>
                    </ol>
                </td>
            </tr>
        </table>`;
    return help_content;
}
