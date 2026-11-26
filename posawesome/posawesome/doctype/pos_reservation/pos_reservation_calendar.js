// Copyright (c) 2026, Youssef Restom and contributors
frappe.views.calendar["POS Reservation"] = {
	field_map: {
		start: "reservation_start",
		end: "reservation_end",
		id: "name",
		title: "guest_name",
		allDay: "all_day",
	},
	gantt: false,
	filters: [
		{ fieldtype: "Link", fieldname: "service_table", options: "Service Table", label: __("Table") },
		{ fieldtype: "Select", fieldname: "status", options: "\nBooked\nConfirmed\nArrived\nSeated\nCompleted\nCancelled\nNo Show", label: __("Status") },
	],
};
