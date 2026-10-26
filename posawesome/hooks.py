from . import __version__ as app_version

app_name = "posawesome"
app_title = "POS G2Virtu"
app_publisher = "G2Virtu"
app_description = "POS G2Virtu"
app_icon = "octicon octicon-file-directory"
app_color = "grey"
app_email = "youssef@totrox.com"
app_license = "GPLv3"

# Frappe / ERPNext v16+
required_apps = ["erpnext"]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/posawesome/css/posawesome.css"
# app_include_js = "/assets/posawesome/js/posawesome.js"
# app_include_js = "/assets/posawesome/js/qrcode.js"
# doctype_js = {"POS Profile" : "public/js/pos_profile.js"}
# doctype_js = {"Sales Invoice" : "public/js/sales_invoice.js"}

#/posawesome/posawesome/public/js
# app_include_js = "/assets/posawesome/js/global_toggle_sidebar.js"

app_include_css = [
    "/assets/posawesome/css/kds.css",
]

# Only a tiny desk helper is loaded on every page. The POS apps (Vue 3 + Vuetify 3)
# live in posawesome.bundle.js and are loaded lazily by the POS pages with
# frappe.require(), so Vuetify's CSS never touches the rest of the desk.
app_include_js = [
    "posawesome_desk.bundle.js",
]

# include js in doctype views
doctype_js = {
    "POS Profile": "posawesome/api/pos_profile.js",
    "Sales Invoice": "posawesome/api/invoice.js",
    "Company": "posawesome/api/company.js",
}

doc_events = {
    "Item Price": {
        "after_insert": "posawesome.events.item_price_reverse_sync.sync_item_uom_rates",
        "on_update": "posawesome.events.item_price_reverse_sync.sync_item_uom_rates",
        "on_trash": "posawesome.events.item_price_reverse_sync.sync_item_uom_rates",
    },

    "Item": {
        "on_update": "posawesome.events.item_price_sync.sync_item_prices",
        "on_trash": "posawesome.events.item_price_sync.delete_item_prices"
    },

    "Sales Invoice": {
        "validate": [
            "posawesome.posawesome.api.invoice.validate",
        ],
        "before_save": [
            "posawesome.overrides.sales_invoice.calculate_salesperson_commission",
            "posawesome.posawesome.doctype.service_table.service_table.before_save_service_table",
            "posawesome.posawesome.api.kds.create_kitchen_tickets",
        ],
        "before_submit": [
            "posawesome.posawesome.api.invoice.before_submit",
            "posawesome.overrides.sales_invoice.before_submit",
        ],
        "on_submit": [
            "posawesome.events.sales_invoice.submit_to_fbr",
            "posawesome.posawesome.doctype.service_table.service_table.on_submit_service_table",
            "posawesome.posawesome.api.stock_entry.create_manufacture_stock_entry",
        ],
        "before_cancel": [
            "posawesome.posawesome.api.invoice.before_cancel",
        ],
        "on_cancel": [
            "posawesome.posawesome.doctype.service_table.service_table.on_cancel_service_table",
        ],
        "on_update": [
            "posawesome.posawesome.doctype.service_table.service_table.on_update_service_table",
        ],
    },

#    "Sales Invoice": {
##        "before_validate": "posawesome.overrides.sales_invoice.apply_conditional_tax",
#        "validate": "posawesome.posawesome.api.invoice.validate",
#        "before_submit": "posawesome.posawesome.api.invoice.before_submit",
#        "before_cancel": "posawesome.posawesome.api.invoice.before_cancel",
#        "before_save": "posawesome.overrides.sales_invoice.calculate_salesperson_commission",
#        "before_submit": "posawesome.overrides.sales_invoice.before_submit",
#        "on_submit": "posawesome.events.sales_invoice.submit_to_fbr",
#        "on_submit": "posawesome.posawesome.api.kds.create_kitchen_tickets",
#        "before_save": "posawesome.posawesome.doctype.service_table.service_table.before_save_service_table",
#        "on_update": "posawesome.posawesome.doctype.service_table.service_table.on_update_service_table",
#        "on_submit": "posawesome.posawesome.doctype.service_table.service_table.on_submit_service_table",
#        "on_cancel": "posawesome.posawesome.doctype.service_table.service_table.on_cancel_service_table"
#    },
    "Customer": {
        "validate": "posawesome.posawesome.api.customer.validate",
        "after_insert": "posawesome.posawesome.api.customer.after_insert",
    },
    "POS Expense Invoice": {
        "on_submit": "posawesome.posawesome.doctype.pos_expense_invoice.pos_expense_invoice.create_journal_entry",
        "on_cancel": "posawesome.posawesome.doctype.pos_expense_invoice.pos_expense_invoice.cancel_journal_entry",
        "on_trash": "posawesome.posawesome.doctype.pos_expense_invoice.pos_expense_invoice.delete_journal_entry"
    },
    "Stock Entry": {
        # quick_production is optional (not shipped in this app); the wrapper is a no-op when it is absent
        "on_cancel": "posawesome.posawesome.api.stock_entry.update_quick_production_on_se_cancel",
        "on_trash": "posawesome.posawesome.api.stock_entry.update_quick_production_on_se_cancel"
    },
    "Kitchen Ticket": {
        "on_update_after_submit": "posawesome.posawesome.api.kds.update_queue_status"
    }
}

override_doctype_class = {
    "Sales Invoice": "posawesome.overrides.sales_invoice.SalesInvoice",
    "Custom Field": "posawesome.overrides.custom_field.CustomCustomField"
}

#override_whitelisted_methods = {
#    "posawesome.posawesome.api.posapp.update_invoice":
#        "custom_app.api.posapp_override.update_invoice"
#}

scheduler_events = {
    # picks up offline invoices left Queued (e.g. the worker was restarted)
    "hourly": [
        "posawesome.posawesome.api.offline.process_offline_invoices",
    ],
}

# include js, css files in header of web template
# web_include_css = "/assets/posawesome/css/posawesome.css"
# web_include_js = "/assets/posawesome/js/posawesome.js"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Website user home page (by function)
# get_website_user_home_page = "posawesome.utils.get_home_page"

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Installation
# ------------

# before_install = "posawesome.install.before_install"
# after_install = "posawesome.install.after_install"
# posawesome/posawesome/hooks.py

# Node dependencies (vue, vuetify, @mdi/font, dexie) are installed by
# `bench setup requirements --node` / `bench build`; nothing to do on migrate.
after_migrate = "posawesome.posawesome.api.offline.after_migrate"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "posawesome.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# Document Events
# ---------------
# Hook on document methods and events

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"posawesome.tasks.all"
# 	],
# 	"daily": [
# 		"posawesome.tasks.daily"
# 	],
# 	"hourly": [
# 		"posawesome.tasks.hourly"
# 	],
# 	"weekly": [
# 		"posawesome.tasks.weekly"
# 	]
# 	"monthly": [
# 		"posawesome.tasks.monthly"
# 	]
# }

# Testing
# -------

# before_tests = "posawesome.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "posawesome.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "posawesome.task.get_dashboard_data"
# }

# override_doctype_class = {
# "doctype": "method",
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

fixtures = [
    {
        "doctype": "Custom Field",
        "filters": [
            [
                "name",
                "in",
                (
                    "Sales Invoice-posa_pos_opening_shift",
                    "POS Profile-posa_allow_conditional_tax",  # created on the v14 site, not yet exported
                    "POS Profile-posa_allow_customer_screen",  # created on the v14 site, not yet exported
                    "POS Profile-posa_allow_display_mrp",  # created on the v14 site, not yet exported
                    "POS Profile-posa_allow_order_type",  # created on the v14 site, not yet exported
                    "POS Profile-posa_allow_received_advance",  # created on the v14 site, not yet exported
                    "POS Profile-posa_allow_sale_below_valuation_rate",  # created on the v14 site, not yet exported
                    "POS Profile-posa_allow_zero_rate_for_buffet_production",  # created on the v14 site, not yet exported
                    "POS Profile-posa_block_sale_beyond_available_qty",  # created on the v14 site, not yet exported
                    "POS Profile-posa_buffet_production_rate",  # created on the v14 site, not yet exported
                    "POS Profile-posa_card_taxes_and_charges",  # created on the v14 site, not yet exported
                    "POS Profile-posa_display_customer_loyalty_points",  # created on the v14 site, not yet exported
                    "POS Profile-posa_item_popup_instead_expand",  # created on the v14 site, not yet exported
                    "POS Profile-posa_items_group_chips_view",  # created on the v14 site, not yet exported
                    "POS Profile-posa_items_group_filter_on_right_side",  # created on the v14 site, not yet exported
                    "POS Profile-posa_mandatory_input_qty",  # created on the v14 site, not yet exported
                    "POS Profile-posa_mandatory_select_uom",  # created on the v14 site, not yet exported
                    "POS Profile-posa_sales_person",  # created on the v14 site, not yet exported
                    "POS Profile-posa_service_table_to_allow_zero_rate",  # created on the v14 site, not yet exported
                    "Item Barcode-posa_uom",
                    "POS Profile-posa_pos_awesome_settings",
                    "POS Profile-posa_allow_delete",
                    "POS Profile-posa_allow_user_to_edit_rate",
                    "POS Profile-posa_allow_user_to_edit_additional_discount",
                    "POS Profile-posa_allow_user_to_edit_item_discount",
                    "POS Profile-posa_display_items_in_stock",
                    "POS Profile-posa_allow_submissions_in_background_job",
                    "POS Profile-posa_allow_partial_payment",
                    "POS Profile-posa_allow_credit_sale",
                    "POS Profile-posa_pos_awesome_advance_settings",
                    "Batch-posa_batch_price",
                    "POS Profile-posa_max_discount_allowed",
                    "POS Profile-posa_allow_return",
                    "POS Profile-posa_col_1",
                    "POS Profile-posa_scale_barcode_start",
                    "Sales Invoice-posa_is_printed",
                    "POS Profile-posa_local_storage",
                    "POS Profile-posa_cash_mode_of_payment",
                    "POS Profile-use_customer_credit",
                    "POS Profile-use_cashback",
                    "POS Profile-posa_hide_closing_shift",
                    "Customer-posa_discount",
                    "POS Profile-posa_apply_customer_discount",
                    "Sales Invoice-posa_offers",
                    "Sales Invoice-posa_coupons",
                    "Sales Invoice Item-posa_offers",
                    "Sales Invoice Item-posa_row_id",
                    "Sales Invoice Item-posa_offer_applied",
                    "Sales Invoice Item-posa_is_offer",
                    "Sales Invoice Item-posa_is_replace",
                    "POS Profile-posa_auto_set_batch",
                    "POS Profile-posa_search_serial_no",
                    "Sales Invoice-posa_additional_notes_section",
                    "Sales Invoice-posa_notes",
                    "Sales Invoice-posa_column_break_111",
                    "Sales Invoice-posa_delivery_date",
                    "Sales Invoice Item-posa_notes",
                    "Sales Invoice Item-posa_delivery_date",
                    "Sales Order-posa_additional_notes_section",
                    "Sales Order-posa_notes",
                    "Sales Order Item-posa_notes",
                    "POS Profile-posa_allow_sales_order",
                    "POS Profile-custom_allow_select_sales_order",
                    "POS Profile-posa_column_break_112",
                    "POS Profile-posa_show_template_items",
                    "POS Profile-posa_hide_variants_items",
                    "Customer-posa_referral_code",
                    "POS Profile-posa_fetch_coupon",
                    "Company-posa_referral_section",
                    "Company-posa_auto_referral",
                    "Company-posa_column_break_22",
                    "Company-posa_customer_offer",
                    "Company-posa_primary_offer",
                    "Company-posa_referral_campaign",
                    "Customer-posa_referral_company",
                    "Customer-posa_referral_section",
                    "Customer-posa_birthday",
                    "Sales Order-posa_offers",
                    "Sales Order-posa_coupons",
                    "Sales Order Item-posa_row_id",
                    "POS Profile-posa_tax_inclusive",
                    "POS Profile-posa_use_percentage_discount",
                    "POS Profile-posa_allow_customer_purchase_order",
                    "POS Profile-posa_allow_print_last_invoice",
                    "POS Profile-posa_display_additional_notes",
                    "POS Profile-posa_allow_write_off_change",
                    "POS Profile-posa_new_line",
                    "POS Profile-posa_input_qty",
                    "POS Profile-posa_display_item_code",
                    "POS Profile-posa_allow_zero_rated_items",
                    "POS Profile-posa_allow_print_draft_invoices",
                    "Address-posa_delivery_charges",
                    "Sales Invoice-posa_delivery_charges",
                    "Sales Invoice-posa_delivery_charges_rate",
                    "POS Profile-posa_auto_set_delivery_charges",
                    "POS Profile-posa_use_delivery_charges",
                    "POS Profile-hide_expected_amount",
                    "POS Profile-posa_allow_change_posting_date",
                    "POS Profile-posa_default_card_view",
                    "POS Profile-posa_default_sales_order",
                    "POS Profile-column_break_dqsba",
                    "POS Profile-posa_use_server_cache",
                    "POS Profile-posa_server_cache_duration",
                    "POS Profile-posa_allow_duplicate_customer_names",
                    "POS Profile-column_break_anyol",
                    "POS Profile-pose_use_limit_search",
                    "POS Profile-posa_search_limit",
                    "POS Profile-posa_search_batch_no",
                    "POS Profile-pos_awesome_payments",
                    "POS Profile-posa_use_pos_awesome_payments",
                    "POS Profile-posa_allow_make_new_payments",
                    "POS Profile-posa_allow_reconcile_payments",
                    "POS Profile-column_break_uolvm",
                    "POS Profile-posa_allow_mpesa_reconcile_payments",
                    "POS Profile-hide_sale_amount",
                    "POS Profile-posa_sales_partner",
                    "POS Profile-posa_touch_screen",
                    "POS Profile-sales_partner",
                    "POS Profile-system_controls",
                    "POS Profile-advance_settings",
                    "POS Profile-ntn_no",
                    "POS Profile-pos_id",
                    "POS Profile-fbr_pos_token",
                    "POS Profile-allow_fbr_on_submit",
                    "Sales Invoice-pos_id",
                    "Sales Invoice-ntn_no",
                    "Sales Invoice-fbr_invoice_no",
                    "Sales Invoice-fbr_pos_token",
                    "POS Profile-posa_offline_tab",
                    "POS Profile-posa_offline_section",
                    "POS Profile-posa_enable_offline",
                    "POS Profile-posa_offline_sync_interval",
                    "POS Profile-posa_offline_invoice_batch",
                    "POS Profile-posa_offline_col",
                    "POS Profile-posa_offline_sync_stock",
                    "POS Profile-posa_offline_sync_customers",
                    "POS Profile-posa_offline_allow_new_customer",
                    "POS Profile-posa_offline_max_age_days",
                    "POS Profile-posa_scale_section",
                    "POS Profile-posa_scale_barcode_length",
                    "POS Profile-posa_scale_item_start",
                    "POS Profile-posa_scale_item_length",
                    "POS Profile-posa_scale_item_lookup",
                    "POS Profile-posa_scale_col",
                    "POS Profile-posa_scale_value_type",
                    "POS Profile-posa_scale_value_start",
                    "POS Profile-posa_scale_value_length",
                    "POS Profile-posa_scale_value_decimals",
                    "POS Profile-posa_scale_validate_check_digit",
                    "Sales Invoice-posa_offline_id",
                    "Sales Invoice-posa_offline_created_on",
                ),
            ]
        ],
    },
    {
        "doctype": "Property Setter",
        "filters": [["name", "in", ("Sales Invoice-posa_pos_opening_shift-no_copy")]],
    },
]
