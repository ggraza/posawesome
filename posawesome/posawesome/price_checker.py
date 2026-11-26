"""The "Price Checker" role: a user who may only open the customer price
checker screen (/app/price_kiosk) and read what it shows.

setup() runs after every migrate and is safe to run again. It creates the
role and gives it read access (no write, create, delete, submit, print,
export or report) on the doctypes the screen reads.
"""

import frappe

ROLE = "Price Checker"
PAGE = "price_kiosk"

# Read only. POS Profile and Company: the screen reads the profile (price
# lists, scale label prefixes) and the store name. The rest is the catalogue.
READ_DOCTYPES = ("POS Profile", "Company", "Item", "Item Group", "Item Price", "POS Offer")

# A user with any of these is a normal POS / desk user, not a kiosk.
FULL_ROLES = {
    "Administrator",
    "System Manager",
    "Sales User",
    "Sales Manager",
    "Accounts User",
    "Accounts Manager",
    "Stock User",
    "Stock Manager",
}


def is_price_checker(user=None):
    return ROLE in frappe.get_roles(user or frappe.session.user)


def is_price_checker_only(user=None):
    roles = set(frappe.get_roles(user or frappe.session.user))
    return ROLE in roles and not (roles & FULL_ROLES)


def setup():
    from frappe.permissions import add_permission

    if not frappe.db.exists("Role", ROLE):
        frappe.get_doc(
            {
                "doctype": "Role",
                "role_name": ROLE,
                "desk_access": 1,
                "home_page": "/app/" + PAGE,
            }
        ).insert(ignore_permissions=True)

    for doctype in READ_DOCTYPES:
        if not frappe.db.exists("DocType", doctype):
            continue
        if frappe.db.exists("Custom DocPerm", {"parent": doctype, "role": ROLE, "permlevel": 0}):
            continue
        add_permission(doctype, ROLE, 0)  # read only
        frappe.clear_cache(doctype=doctype)

    if frappe.db.exists("Page", PAGE) and not frappe.db.exists(
        "Has Role", {"parenttype": "Page", "parent": PAGE, "role": ROLE}
    ):
        page = frappe.get_doc("Page", PAGE)
        page.append("roles", {"role": ROLE})
        page.save(ignore_permissions=True)

    frappe.db.commit()


def after_migrate():
    try:
        setup()
    except Exception:
        frappe.log_error(title="POS Awesome: Price Checker role setup failed")
