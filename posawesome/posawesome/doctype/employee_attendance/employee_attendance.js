frappe.ui.form.on('Employee Attendance', {
    onload_post_render(frm) {
        frm.trigger("fetch_attendance");
        highlight_absent_rows(frm);
    },
    month: function(frm) {
        highlight_absent_rows(frm);
    },
    refresh(frm) {
        frm.page.sidebar.addClass('hidden');
        frm.page.add_inner_button(__('Toggle Sidebar'), function() {
            frm.page.sidebar.toggleClass('hidden');
        });
        frm.fields_dict.attendance.grid.wrapper.on('mouseup', () => {
            highlight_absent_rows(frm);
        });
    },
    employee(frm) {
        frm.trigger("fetch_attendance");
    },
    month(frm) {
        frm.trigger("fetch_attendance");
    },

    fetch_attendance(frm) {
        if (frm.doc.employee && frm.doc.month) {
            frappe.call({
                method: "posawesome.posawesome.doctype.employee_attendance.employee_attendance.fill_attendance_table",
                args: {
                    employee: frm.doc.employee,
                    month: frm.doc.month
                },
                callback(r) {
                    if (r.message && r.message.attendance_data) {
                        frm.clear_table("attendance");
                        r.message.attendance_data.forEach(row => {
                            let child = frm.add_child("attendance");
                            child.date = row.date;
                            child.checkin = row.checkin || "";
                            child.checkout = row.checkout || "";
                            child.total_hours = row.total_hours;
                            child.status = row.status;
                            child.attendance = row.attendance;
                            child.shift_start = row.shift_start;
                            child.shift_end = row.shift_end;
                            child.shift_actual_start = row.shift_actual_start;
                            child.shift_actual_end = row.shift_actual_end;
                            child.late = row.late;
                            child.early_going = row.early_going;
                        });

                        frm.set_value("total_working_days", r.message.total_working_days);
                        frm.set_value("absent_days", r.message.absent_days);
                        frm.set_value("payment_days", r.message.payment_days);
                        frm.refresh_fields();

                        //setTimeout(() => highlight_absent_rows(frm), 300);
                        setTimeout(() => highlight_absent_rows(frm), 100);
                    }
                }
            });
        }
    }
});

function highlight_absent_rows(frm) {
    frm.fields_dict.attendance.grid.grid_rows.forEach(row => {
        // Always reset background color
        row.wrapper.css("background-color", "");

        // Now apply highlight if status is Absent
        if (row.doc.status === 'Absent') {
            row.wrapper.css("background-color", "#ffe6e6"); // light red
        }
    });
}

function shighlight_absent_rows(frm) {
    frm.fields_dict.attendance.grid.grid_rows.forEach(row => {
        const status = row.doc.status;
        if (status === 'Absent') {
            row.wrapper.css("background-color", "#ffe6e6"); // light red row
        }
    });
}
