# Copyright (c) 2025, Youssef Restom and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document

class EmployeeAttendance(Document):
	pass

import frappe
from datetime import datetime, timedelta, time
import calendar

@frappe.whitelist()
def fill_attendance_table(employee, month):
    month = datetime.strptime(month, "%Y-%m-%d")
    year = month.year
    month_number = month.month
    total_days = calendar.monthrange(year, month_number)[1]

    # Get default shift timings (optional; fallback if not available per day)
    default_shift = frappe.db.get_value("Employee", employee, "default_shift")
    default_shift_doc = frappe.get_doc("Shift Type", default_shift) if default_shift else None

    attendance_data = []

    for day in range(1, total_days + 1):
        date = datetime(year, month_number, day).date()

        # Get Attendance record
        att = frappe.db.get_all("Attendance", filters={
            "employee": employee,
            "attendance_date": date
        }, fields=["status", "name", "shift"])

        shift_doc = None
        if att and att[0].shift:
            shift_doc = frappe.get_doc("Shift Type", att[0].shift)
        elif default_shift_doc:
            shift_doc = default_shift_doc

        shift_start = shift_doc.start_time if shift_doc else None
        shift_end = shift_doc.end_time if shift_doc else None

        checkins = frappe.get_all("Employee Checkin", filters={
            "employee": employee,
            "time": ["between", [f"{date} 00:00:00", f"{date} 23:59:59"]]
        }, fields=["time", "log_type"], order_by="time asc")

        # Get first IN and last OUT
        checkin_time = None
        checkout_time = None
        for c in checkins:
            if c.log_type == "IN" and not checkin_time:
                checkin_time = c.time
            elif c.log_type == "OUT":
                checkout_time = c.time

        # Calculate total hours
        total_hours = None
        if checkin_time and checkout_time:
            diff = checkout_time - checkin_time
            total_hours = (datetime.min + diff).time()

        # Calculate Late and Early Going
        late = False
        early_going = False
        #if shift_start and checkin_time:
        #    late = checkin_time.time() > shift_start
        #if shift_end and checkout_time:
        #    early_going = checkout_time.time() < shift_end
        shift_start_time = (datetime.min + shift_start).time() if shift_start else None
        shift_end_time = (datetime.min + shift_end).time() if shift_end else None

        late = checkin_time.time() > shift_start_time if checkin_time and shift_start_time else False
        early_going = checkout_time.time() < shift_end_time if checkout_time and shift_end_time else False

        attendance_data.append({
            "date": str(date),
            "checkin": checkin_time.time() if checkin_time else None,
            "checkout": checkout_time.time() if checkout_time else None,
            "total_hours": total_hours,
            "status": att[0].status if att else "Absent",
            "attendance": att[0].name if att else None,
            "shift_start": shift_start,
            "shift_end": shift_end,
            "shift_actual_start": checkin_time.time() if checkin_time else None,
            "shift_actual_end": checkout_time.time() if checkout_time else None,
            "late": late,
            "early_going": early_going
        })

    total_working_days = len(attendance_data)
    total_days_in_month = len(attendance_data)
    absent_days = sum(1 for row in attendance_data if row["status"] == "Absent")
    payment_days = total_working_days - absent_days

    return {
        "attendance_data": attendance_data,
        "total_working_days": total_days_in_month,
        "absent_days": absent_days,
        "payment_days": payment_days
    }
    #return attendance_data
