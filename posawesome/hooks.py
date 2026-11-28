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

# ------------------------------------------------------------------ v16 desk navigation
# Apps screen tile, app logo and landing page. The rail (dock/posawesome/posawesome.json),
# the module sidebar (posawesome/sidebar/pos_g2virtu/) and the Desktop Icon
# (desktop_icon/pos_g2virtu.json) are shipped as files and imported by `bench migrate`.
app_logo_url = "/assets/posawesome/images/pos-g2virtu-logo.svg"
app_home = "/desk/pos-g2virtu"

add_to_apps_screen = [
    {
        "name": app_name,
        "logo": app_logo_url,
        "title": app_title,
        "route": app_home,
        "has_permission": "posawesome.check_app_permission",
        "sequence_id": 2,
    }
]

# Dock / sidebar-header symbols (icon-posa-*) used by the rail and the sidebar.
app_include_icons = [
    "/assets/posawesome/icons/posa-icons.svg",
]

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

# PWA: frappe.boot.posa_pwa tells the desk to register (or remove) the POS service worker
boot_session = "posawesome.posawesome.api.pwa.boot_session"

# include js in doctype views
doctype_js = {
    "POS Profile": "posawesome/api/pos_profile.js",
    "Sales Invoice": "posawesome/api/invoice.js",
    "Company": "posawesome/api/company.js",
    # supermarket: Print Shelf Label buttons (shown only when shelf labels are on)
    "Item": "posawesome/api/shelf_label_buttons.js",
    "Item Price": "posawesome/api/shelf_label_buttons.js",
}

doc_events = {
    "Item Price": {
        "after_insert": [
            "posawesome.events.item_price_reverse_sync.sync_item_uom_rates",
            # supermarket shelf-edge labels: a price change queues a label
            "posawesome.posawesome.api.shelf_labels.on_item_price",
        ],
        "on_update": [
            "posawesome.events.item_price_reverse_sync.sync_item_uom_rates",
            # supermarket shelf-edge labels: a price change queues a label
            "posawesome.posawesome.api.shelf_labels.on_item_price",
        ],
        "on_trash": "posawesome.events.item_price_reverse_sync.sync_item_uom_rates",
    },

    "Item": {
        "on_update": "posawesome.events.item_price_sync.sync_item_prices",
        "on_trash": "posawesome.events.item_price_sync.delete_item_prices"
    },

    # supermarket: cash movements, voids, blind close and over / short on the closing
    "POS Closing Shift": {
        "validate": "posawesome.posawesome.api.supermarket.validate_closing",
        "on_submit": "posawesome.posawesome.api.supermarket.on_submit_closing",
    },
    # supermarket: manager PINs
    "POS Profile": {
        "validate": "posawesome.posawesome.api.supermarket.validate_profile",
    },

    "Sales Invoice": {
        "on_trash": "posawesome.posawesome.api.fine_dining.on_trash_invoice",
        # fine dining: service charge and tip rows, the waiter
        "before_validate": "posawesome.posawesome.api.fine_dining_floor.apply_charges",
        "validate": [
            "posawesome.posawesome.api.invoice.validate",
            # fine dining: void / comp of items already sent to the kitchen
            "posawesome.posawesome.api.fine_dining.validate_invoice",
            # fine dining: dishes marked unavailable (86)
            "posawesome.posawesome.api.fine_dining_kitchen.validate_86",
            # supermarket: manager approvals, training sales
            "posawesome.posawesome.api.supermarket.validate_invoice",
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
            # FBR: no longer sent on submit, only when the invoice is printed
            # (events/sales_invoice.submit_to_fbr is called by the POS print).
            "posawesome.posawesome.doctype.service_table.service_table.on_submit_service_table",
            # fine dining: the booking of a paid order is completed
            "posawesome.posawesome.api.fine_dining_guests.complete_booking",
            # supermarket: approvals of the sale are marked used
            "posawesome.posawesome.api.supermarket.on_submit_invoice",
            "posawesome.posawesome.api.stock_entry.create_manufacture_stock_entry",
        ],
        "before_cancel": [
            "posawesome.posawesome.api.invoice.before_cancel",
            "posawesome.posawesome.doctype.pos_item_exchange.pos_item_exchange.block_direct_cancel",
        ],
        "on_cancel": [
            "posawesome.posawesome.doctype.service_table.service_table.on_cancel_service_table",
            # supermarket: reduced-price labels of a cancelled sale can be sold again
            "posawesome.posawesome.api.supermarket.on_cancel_invoice",
            # supermarket: gift card / store credit entries of a cancelled sale are reversed
            "posawesome.posawesome.api.supermarket.on_cancel_gift_cards",
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

# Offline POS: push "catalogue changed" to open terminals when the records they
# cache are created / updated / renamed / deleted (see api/offline_events.py).
_POSA_CATALOG_HANDLER = "posawesome.posawesome.api.offline_events.notify_catalog_change"
for _dt in (
    "Item",
    "Item Group",
    "Item Price",
    "Price List",
    "Customer",
    "POS Offer",
    "POS Coupon",
    "Referral Code",
    "RFID Card",
    "Delivery Charges",
    "POS Profile",
    "Sales Taxes and Charges Template",
    "Item Tax Template",
):
    _events = doc_events.setdefault(_dt, {})
    for _event in ("on_update", "after_rename", "on_trash"):
        _current = _events.get(_event)
        _handlers = list(_current) if isinstance(_current, list | tuple) else ([_current] if _current else [])
        _handlers.append(_POSA_CATALOG_HANDLER)
        _events[_event] = _handlers

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
    # supermarket shelf-edge labels: offers / deals that start today or ended yesterday
    "daily": [
        "posawesome.posawesome.api.shelf_labels.queue_offer_labels",
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
after_migrate = [
    "posawesome.posawesome.api.offline.after_migrate",
    "posawesome.posawesome.price_checker.after_migrate",
    # fine dining: default courses and void reasons, Guest Check print format
    "posawesome.posawesome.api.fine_dining.after_migrate",
    # POS Offer: fill the item / group / brand lists of offers made before them
    "posawesome.posawesome.doctype.pos_offer.pos_offer.copy_single_targets",
    # workspace: a card link to a doctype / report / page missing on the site hides every card
    "posawesome.posawesome.workspace_links.after_migrate",
]

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
        # every Custom Field shipped in fixtures/custom_field.json (POS Profile / Sales
        # Invoice fields taken from the live v14 site's Customize Form, plus the v16
        # offline & scale fields). Re-export with: bench --site <site> export-fixtures --app posawesome
        "doctype": "Custom Field",
        "filters": [
            [
                "name",
                "in",
                (
                    "Address-posa_delivery_charges",
                    "Batch-posa_batch_price",
                    "Company-posa_auto_referral",
                    "Company-posa_column_break_22",
                    "Company-posa_customer_offer",
                    "Company-posa_primary_offer",
                    "Company-posa_referral_campaign",
                    "Company-posa_referral_section",
                    "Customer-custom_customer_id",
                    "Customer-custom_erp_code",
                    "Customer-posa_birthday",
                    "Customer-posa_discount",
                    "Customer-posa_referral_code",
                    "Customer-posa_referral_company",
                    "Customer-posa_referral_section",
                    "Customer-short_name",
                    "Item Barcode-posa_uom",
                    "POS Closing Shift-custom_cell_number",
                    "POS Profile-advance_settings",
                    "POS Profile-allow_fbr_on_submit",
                    "POS Profile-allow_service_zone",
                    "POS Profile-applicable_for_captain",
                    "POS Profile-column_break_82ltx",
                    "POS Profile-column_break_anyol",
                    "POS Profile-column_break_dhugs",
                    "POS Profile-column_break_dqsba",
                    "POS Profile-column_break_jt4t2",
                    "POS Profile-column_break_uolvm",
                    "POS Profile-custom_allow_kot",
                    "POS Profile-custom_allow_select_sales_order",
                    "POS Profile-custom_closing_shift_print_format",
                    "POS Profile-custom_column_break_x6jpb",
                    "POS Profile-custom_denominations",
                    "POS Profile-custom_expense_invoice_print_format",
                    "POS Profile-custom_kds_settings",
                    "POS Profile-custom_kot_settings",
                    "POS Profile-custom_kot_sound",
                    "POS Profile-custom_posa_allow_remove_item",
                    "POS Profile-custom_rfid_number",
                    "POS Profile-custom_role_permissions",
                    "POS Profile-custom_section_break_nhgdx",
                    "POS Profile-custom_strn",
                    "POS Profile-default_service_zone",
                    "POS Profile-fbr_pos_token",
                    "POS Profile-hide_expected_amount",
                    "POS Profile-hide_sale_amount",
                    "POS Profile-ntn_no",
                    "POS Profile-payment_denomination",
                    "POS Profile-pos_awesome_payments",
                    "POS Profile-pos_id",
                    "POS Profile-pos_order_type",
                    "POS Profile-pos_service_zone",
                    "POS Profile-posa_allow_change_posting_date",
                    "POS Profile-posa_allow_conditional_tax",
                    "POS Profile-posa_allow_credit_sale",
                    "POS Profile-posa_allow_customer_purchase_order",
                    "POS Profile-posa_allow_customer_screen",
                    "POS Profile-posa_allow_delete",
                    "POS Profile-posa_allow_delete_offline_invoice",
                    "POS Profile-posa_allow_display_mrp",
                    "POS Profile-posa_allow_duplicate_customer_names",
                    "POS Profile-posa_allow_make_new_payments",
                    "POS Profile-posa_allow_mpesa_reconcile_payments",
                    "POS Profile-posa_allow_multi_currency",
                    "POS Profile-posa_allow_order_type",
                    "POS Profile-posa_allow_partial_payment",
                    "POS Profile-posa_allow_print_draft_invoices",
                    "POS Profile-posa_allow_print_last_invoice",
                    "POS Profile-posa_allow_received_advance",
                    "POS Profile-posa_allow_reconcile_payments",
                    "POS Profile-posa_allow_return",
                    "POS Profile-posa_allow_return_without_invoice",
                    "POS Profile-posa_exchange_tab",
                    "POS Profile-posa_exchange_section",
                    "POS Profile-posa_enable_item_exchange",
                    "POS Profile-posa_enable_item_replacement",
                    "POS Profile-posa_exchange_column",
                    "POS Profile-posa_allow_exchange_additional_payment",
                    "POS Profile-posa_allow_exchange_refund",
                    "POS Profile-posa_exchange_require_approval",
                    "POS Profile-posa_exchange_approver_role",
                    "POS Profile-posa_allow_sale_below_valuation_rate",
                    "POS Profile-posa_allow_sales_order",
                    "POS Profile-posa_allow_submissions_in_background_job",
                    "POS Profile-posa_allow_user_to_edit_additional_discount",
                    "POS Profile-posa_allow_user_to_edit_item_discount",
                    "POS Profile-posa_allow_user_to_edit_rate",
                    "POS Profile-posa_allow_write_off_change",
                    "POS Profile-posa_allow_zero_rate_for_buffet_production",
                    "POS Profile-posa_allow_zero_rated_items",
                    "POS Profile-posa_apply_customer_discount",
                    "POS Profile-posa_auto_set_batch",
                    "POS Profile-posa_auto_set_delivery_charges",
                    "POS Profile-posa_block_sale_beyond_available_qty",
                    "POS Profile-posa_buffet_production_rate",
                    "POS Profile-posa_camera_scan_type",
                    "POS Profile-posa_card_taxes_and_charges",
                    "POS Profile-posa_cash_mode_of_payment",
                    "POS Profile-posa_col_1",
                    "POS Profile-posa_column_break_112",
                    "POS Profile-posa_create_journal_entry",
                    "POS Profile-posa_decimal_precision",
                    "POS Profile-posa_default_card_view",
                    "POS Profile-posa_default_sales_order",
                    "POS Profile-posa_display_additional_notes",
                    "POS Profile-posa_display_customer_loyalty_points",
                    "POS Profile-posa_display_discount_amount",
                    "POS Profile-posa_display_discount_percentage",
                    "POS Profile-posa_display_item_code",
                    "POS Profile-posa_display_items_in_stock",
                    "POS Profile-posa_edit_rate_on_itemselect",
                    "POS Profile-posa_enable_camera_scanning",
                    "POS Profile-posa_enable_offline",
                    "POS Profile-posa_fetch_coupon",
                    "POS Profile-posa_force_reload_items",
                    "POS Profile-posa_hide_closing_shift",
                    "POS Profile-posa_hide_variants_items",
                    "POS Profile-posa_input_qty",
                    "POS Profile-posa_item_popup_instead_expand",
                    "POS Profile-posa_items_group_chips_view",
                    "POS Profile-posa_items_group_filter_on_right_side",
                    "POS Profile-posa_kot_on_each_save",
                    "POS Profile-posa_left_screen",
                    "POS Profile-posa_local_storage",
                    "POS Profile-posa_mandatory_input_qty",
                    "POS Profile-posa_mandatory_select_uom",
                    "POS Profile-posa_max_discount_allowed",
                    "POS Profile-posa_mrp_price_list",
                    "POS Profile-posa_new_line",
                    "POS Profile-posa_offline_allow_new_customer",
                    "POS Profile-posa_offline_col",
                    "POS Profile-posa_offline_invoice_batch",
                    "POS Profile-posa_offline_max_age_days",
                    "POS Profile-posa_offline_section",
                    "POS Profile-posa_offline_sync_customers",
                    "POS Profile-posa_offline_sync_interval",
                    "POS Profile-posa_offline_sync_stock",
                    "POS Profile-posa_offline_tab",
                    "POS Profile-posa_pos_awesome_advance_settings",
                    "POS Profile-posa_pos_awesome_settings",
                    "POS Profile-posa_sales_partner",
                    "POS Profile-posa_sales_person",
                    "POS Profile-posa_scale_barcode_length",
                    "POS Profile-posa_scale_barcode_start",
                    "POS Profile-posa_scale_col",
                    "POS Profile-posa_scale_item_length",
                    "POS Profile-posa_scale_item_lookup",
                    "POS Profile-posa_scale_item_start",
                    "POS Profile-posa_scale_section",
                    "POS Profile-posa_scale_validate_check_digit",
                    "POS Profile-posa_vfd_section",
                    "POS Profile-posa_help_tab",
                    "POS Profile-posa_sm6_section",
                    "POS Profile-posa_sm_till_monitor",
                    "POS Profile-posa_sm_dashboard",
                    "POS Profile-posa_sm_loss_reports",
                    "POS Profile-posa_sm_col12",
                    "POS Profile-posa_sm_offer_reports",
                    "POS Profile-posa_sm_movers",
                    "POS Profile-posa_sm_slow_days",
                    "POS Profile-posa_pwa",
                    "POS Profile-posa_sm5_section",
                    "POS Profile-posa_sm_shelf_labels",
                    "POS Profile-posa_sm_label_template",
                    "POS Profile-posa_sm_label_printer",
                    "POS Profile-posa_sm_col10",
                    "POS Profile-posa_sm_label_on_price",
                    "POS Profile-posa_sm_label_on_offer",
                    "POS Profile-posa_sm_label_min_change",
                    "POS Profile-posa_sm_label_name2_field",
                    "POS Profile-posa_sm5b_section",
                    "POS Profile-posa_sm_stock_count",
                    "POS Profile-posa_sm_blind_count",
                    "POS Profile-posa_sm_store_receiving",
                    "POS Profile-posa_sm_col11",
                    "POS Profile-posa_sm_transfer_request",
                    "POS Profile-posa_sm_transfer_from",
                    "POS Profile-posa_sm_low_stock",
                    "Sales Invoice-posa_sm_gift_card_no",
                    "Sales Invoice-posa_sm_gift_card_amount",
                    "Sales Invoice-posa_sm_wallet_ref",
                    "Sales Invoice-posa_sm_card_ref",
                    "Sales Invoice-posa_sm_receipt_to",
                    "Sales Invoice-posa_sm_age_checked",
                    "Sales Invoice-posa_sm_age_checked_by",
                    "Sales Invoice Item-posa_sm_gift_card",
                    "Customer-posa_sm_e_receipt",
                    "Item-posa_sm_item_section",
                    "Item-posa_sm_min_age",
                    "POS Profile-posa_sm4_section",
                    "POS Profile-posa_sm_gift_cards",
                    "POS Profile-posa_sm_gift_card_item",
                    "POS Profile-posa_sm_gift_card_mop",
                    "POS Profile-posa_sm_gift_card_expiry_days",
                    "POS Profile-posa_sm_store_credit",
                    "POS Profile-posa_sm_col8",
                    "POS Profile-posa_sm_wallet_qr",
                    "POS Profile-posa_sm_card_terminal",
                    "POS Profile-posa_sm_card_mops",
                    "POS Profile-posa_sm_card_bridge_url",
                    "POS Profile-posa_sm_col9",
                    "POS Profile-posa_sm_e_receipt",
                    "POS Profile-posa_sm_e_receipt_channel",
                    "POS Profile-posa_sm_e_receipt_format",
                    "POS Profile-posa_sm_e_receipt_print_format",
                    "POS Profile-posa_sm_e_receipt_ask",
                    "POS Profile-posa_sm_loyalty_display",
                    "POS Profile-posa_sm_age_check",
                    "POS Profile-posa_sm4b_section",
                    "POS Profile-posa_sm_wallet_list",
                    "Sales Invoice Item-posa_sm_deal",
                    "Sales Invoice Item-posa_sm_markdown",
                    "POS Profile-posa_sm3_section",
                    "POS Profile-posa_sm_mix_match",
                    "POS Profile-posa_sm_multibuy",
                    "POS Profile-posa_sm_offer_schedule",
                    "POS Profile-posa_sm_col7",
                    "POS Profile-posa_sm_markdown_labels",
                    "POS Profile-posa_sm_savings_receipt",
                    "POS Profile-posa_sm2_section",
                    "POS Profile-posa_sm_quick_keys",
                    "POS Profile-posa_sm_ask_weight",
                    "POS Profile-posa_sm_weighed_uoms",
                    "POS Profile-posa_sm_col5",
                    "POS Profile-posa_sm_scale_reading",
                    "POS Profile-posa_sm_scale_protocol",
                    "POS Profile-posa_sm_scale_baud",
                    "POS Profile-posa_sm_scale_request",
                    "POS Profile-posa_sm_col6",
                    "POS Profile-posa_sm_qty_times",
                    "POS Profile-posa_sm_gs1_barcodes",
                    "POS Profile-posa_sm_gs1_block_expired",
                    "POS Profile-posa_sm_hotkeys",
                    "POS Profile-posa_sm2b_section",
                    "POS Profile-posa_sm_hotkey_list",
                    "POS Profile-posa_sm_tab",
                    "POS Profile-posa_sm_section",
                    "POS Profile-posa_enable_supermarket",
                    "POS Profile-posa_sm1_section",
                    "POS Profile-posa_sm_manager_approval",
                    "POS Profile-posa_sm_approval_offline",
                    "POS Profile-posa_sm_discount_limit",
                    "POS Profile-posa_sm_col1",
                    "POS Profile-posa_sm_appr_price",
                    "POS Profile-posa_sm_appr_discount",
                    "POS Profile-posa_sm_appr_line_void",
                    "POS Profile-posa_sm_appr_cart_void",
                    "POS Profile-posa_sm_col2",
                    "POS Profile-posa_sm_appr_no_sale",
                    "POS Profile-posa_sm_appr_reprint",
                    "POS Profile-posa_sm_appr_return",
                    "POS Profile-posa_sm_appr_cash_out",
                    "POS Profile-posa_sm1b_section",
                    "POS Profile-posa_sm_managers",
                    "POS Profile-posa_sm1c_section",
                    "POS Profile-posa_sm_void_reason",
                    "POS Profile-posa_sm_training_mode",
                    "POS Profile-posa_sm_trainees",
                    "POS Profile-posa_sm_col3",
                    "POS Profile-posa_sm_cash_drawer",
                    "POS Profile-posa_sm_drawer_on_cash",
                    "POS Profile-posa_sm_drawer_code",
                    "POS Profile-posa_sm_col4",
                    "POS Profile-posa_sm_cash_pickup",
                    "POS Profile-posa_sm_drawer_limit",
                    "POS Profile-posa_sm_safe_account",
                    "POS Profile-posa_sm_cash_in_out_account",
                    "POS Profile-posa_sm_xz_report",
                    "POS Profile-posa_sm_blind_close",
                    "Sales Invoice-posa_training",
                    "Sales Invoice-posa_sm_approvals",
                    "Sales Invoice Item-posa_sm_approval",
                    "POS Profile-posa_fd5_section",
                    "POS Profile-posa_fd_waiter_offline",
                    "Customer-posa_guest_section",
                    "Customer-posa_vip",
                    "Customer-posa_anniversary",
                    "Customer-posa_guest_col",
                    "Customer-posa_guest_preferences",
                    "Customer-posa_guest_allergies",
                    "Customer-posa_guest_notes",
                    "POS Profile-posa_fd4_section",
                    "POS Profile-posa_fd_reservations",
                    "POS Profile-posa_fd_reservation_hold_minutes",
                    "POS Profile-posa_fd_col6",
                    "POS Profile-posa_fd_guest_profiles",
                    "POS Profile-posa_fd_feedback",
                    "Sales Invoice-posa_allergies",
                    "Item-posa_fine_dining_section",
                    "Item-posa_prep_minutes",
                    "Item-posa_allergens",
                    "Item-posa_fd_col",
                    "Item-posa_86",
                    "Item-posa_86_on",
                    "POS Profile-posa_fd3_section",
                    "POS Profile-posa_fd_expo",
                    "POS Profile-posa_fd_kds_item_bump",
                    "POS Profile-posa_fd_prep_minutes",
                    "POS Profile-posa_fd_col5",
                    "POS Profile-posa_fd_86",
                    "POS Profile-posa_fd_allergens",
                    "Sales Invoice-posa_waiter",
                    "Sales Invoice-posa_tip_amount",
                    "Sales Invoice-posa_split_count",
                    "Sales Invoice-posa_split_from",
                    "Sales Taxes and Charges-posa_fd_charge",
                    "POS Profile-posa_fd2_section",
                    "POS Profile-posa_fd_floor_plan",
                    "POS Profile-posa_fd_table_cleaning",
                    "POS Profile-posa_fd_split_bill",
                    "POS Profile-posa_fd_col3",
                    "POS Profile-posa_fd_service_charge",
                    "POS Profile-posa_fd_service_charge_rate",
                    "POS Profile-posa_fd_service_charge_account",
                    "POS Profile-posa_fd_service_charge_min_covers",
                    "POS Profile-posa_fd_col4",
                    "POS Profile-posa_fd_tips",
                    "POS Profile-posa_fd_tips_account",
                    "Sales Invoice-posa_covers",
                    "Sales Invoice-posa_prebill_count",
                    "Sales Invoice Item-posa_seat",
                    "Sales Invoice Item-posa_course",
                    "Sales Invoice Item-posa_course_status",
                    "Sales Invoice Item-posa_modifiers",
                    "Sales Invoice Item-posa_parent_row_id",
                    "Sales Invoice Item-posa_kot_qty",
                    "Sales Invoice Item-posa_comp",
                    "Sales Invoice Item-posa_comp_reason",
                    "POS Profile-posa_fd_section",
                    "POS Profile-posa_enable_fine_dining",
                    "POS Profile-posa_fd_covers",
                    "POS Profile-posa_fd_covers_required",
                    "POS Profile-posa_fd_seats",
                    "POS Profile-posa_fd_col1",
                    "POS Profile-posa_fd_modifiers",
                    "POS Profile-posa_fd_courses",
                    "POS Profile-posa_fd_col2",
                    "POS Profile-posa_fd_void_control",
                    "POS Profile-posa_fd_void_approval",
                    "POS Profile-posa_fd_approver_role",
                    "POS Profile-posa_fd_prebill",
                    "POS Profile-posa_fd_prebill_format",
                    "POS Profile-posa_rates_section",
                    "POS Profile-posa_rates_col",
                    "POS Profile-posa_payments_section",
                    "POS Profile-posa_payments_col",
                    "POS Profile-posa_returns_section",
                    "POS Profile-posa_returns_col",
                    "POS Profile-posa_customers_tab",
                    "POS Profile-posa_customers_section",
                    "POS Profile-posa_customers_col",
                    "POS Profile-posa_orders_section",
                    "POS Profile-posa_orders_col",
                    "POS Profile-posa_delivery_section",
                    "POS Profile-posa_delivery_col",
                    "POS Profile-posa_performance_section",
                    "POS Profile-posa_shift_tab",
                    "POS Profile-posa_shift_section",
                    "POS Profile-posa_shift_col",
                    "POS Profile-posa_cash_section",
                    "POS Profile-posa_cash_col",
                    "POS Profile-posa_printing_tab",
                    "POS Profile-posa_print_section",
                    "POS Profile-posa_print_col",
                    "POS Profile-posa_qz_section",
                    "POS Profile-posa_qz_col",
                    "POS Profile-posa_fbr_section",
                    "POS Profile-posa_fbr_col",
                    "POS Profile-posa_zones_col",
                    "POS Profile-posa_buffet_section",
                    "POS Profile-posa_buffet_col",
                    "POS Profile-posa_enable_offline_invoices",
                    "POS Profile-posa_pos_profile_help",
                    "POS Profile-posa_silent_print",
                    "POS Profile-posa_qz_printer_name",
                    "POS Profile-posa_raw_printing",
                    "POS Profile-posa_raw_print_width",
                    "POS Profile-posa_enable_vfd",
                    "POS Profile-posa_vfd_command_set",
                    "POS Profile-posa_vfd_baud_rate",
                    "POS Profile-posa_vfd_columns",
                    "POS Profile-posa_vfd_col",
                    "POS Profile-posa_vfd_line_1",
                    "POS Profile-posa_vfd_line_2",
                    "POS Profile-posa_scale_value_decimals",
                    "POS Profile-posa_scale_value_length",
                    "POS Profile-posa_scale_value_start",
                    "POS Profile-posa_scale_value_type",
                    "POS Profile-posa_search_batch_no",
                    "POS Profile-posa_search_limit",
                    "POS Profile-posa_search_serial_no",
                    "POS Profile-posa_server_cache_duration",
                    "POS Profile-posa_service_table_to_allow_zero_rate",
                    "POS Profile-posa_show_customer_balance",
                    "POS Profile-posa_show_template_items",
                    "POS Profile-posa_tax_inclusive",
                    "POS Profile-posa_touch_screen",
                    "POS Profile-posa_use_delivery_charges",
                    "POS Profile-posa_use_percentage_discount",
                    "POS Profile-posa_use_pos_awesome_payments",
                    "POS Profile-posa_use_server_cache",
                    "POS Profile-pose_use_limit_search",
                    "POS Profile-sales_partner",
                    "POS Profile-section_break_038ut",
                    "POS Profile-section_break_151",
                    "POS Profile-section_break_dqpve",
                    "POS Profile-tab_break_13",
                    "POS Profile-use_cashback",
                    "POS Profile-use_customer_credit",
                    "Sales Invoice Item-custom_rfid_card",
                    "Sales Invoice Item-custom_rfid_no",
                    "Sales Invoice Item-issue",
                    "Sales Invoice Item-issue_2",
                    "Sales Invoice Item-maximum_retail_price",
                    "Sales Invoice Item-posa_allocated_percentage",
                    "Sales Invoice Item-posa_commission_rate",
                    "Sales Invoice Item-posa_delivery_date",
                    "Sales Invoice Item-posa_incentives",
                    "Sales Invoice Item-posa_is_offer",
                    "Sales Invoice Item-posa_is_replace",
                    "Sales Invoice Item-posa_notes",
                    "Sales Invoice Item-posa_offer_applied",
                    "Sales Invoice Item-posa_offers",
                    "Sales Invoice Item-posa_row_id",
                    "Sales Invoice Item-posa_sales_person",
                    "Sales Invoice Item-reduce_value",
                    "Sales Invoice Item-return",
                    "Sales Invoice-abbr",
                    "Sales Invoice-change_log",
                    "Sales Invoice-custom_allow_fbr_on_submit",
                    "Sales Invoice-custom_allow_kot",
                    "Sales Invoice-custom_cell_number",
                    "Sales Invoice-custom_driver",
                    "Sales Invoice-custom_erp_code",
                    "Sales Invoice-custom_freight",
                    "Sales Invoice-custom_inter_company_reference",
                    "Sales Invoice-custom_rfid_card",
                    "Sales Invoice-custom_stock_entry",
                    "Sales Invoice-custom_strn",
                    "Sales Invoice-custom_vehicle",
                    "Sales Invoice-desire_item_group",
                    "Sales Invoice-fbr_invoice_no",
                    "Sales Invoice-fbr_pos_token",
                    "Sales Invoice-ntn_no",
                    "Sales Invoice-pos_id",
                    "Sales Invoice-posa_additional_notes_section",
                    "Sales Invoice-posa_allow_received_advance",
                    "Sales Invoice-posa_column_break_111",
                    "Sales Invoice-posa_conditional_tax_applied",
                    "Sales Invoice-posa_coupons",
                    "Sales Invoice-posa_delivery_charges",
                    "Sales Invoice-posa_delivery_charges_rate",
                    "Sales Invoice-posa_delivery_date",
                    "Sales Invoice-posa_is_card",
                    "Sales Invoice-posa_is_printed",
                    "Sales Invoice-posa_kot_on_each_save",
                    "Sales Invoice-posa_notes",
                    "Sales Invoice-posa_offers",
                    "Sales Invoice-posa_offline_created_on",
                    "Sales Invoice-posa_offline_id",
                    "Sales Invoice-posa_item_exchange",
                    "Sales Invoice-posa_order_type",
                    "Sales Invoice-posa_pos_opening_shift",
                    "Sales Invoice-posa_sales_person",
                    "Sales Invoice-posa_service_table",
                    "Sales Invoice-posa_service_zone",
                    "Sales Invoice-section_break_92",
                    "Sales Invoice-short_name",
                    "Sales Order Item-posa_notes",
                    "Sales Order Item-posa_row_id",
                    "Sales Order-posa_additional_notes_section",
                    "Sales Order-posa_coupons",
                    "Sales Order-posa_notes",
                    "Sales Order-posa_offers",
                    "Sales Order-short_name",
                    "UOM Conversion Detail-default_buying",
                    "UOM Conversion Detail-default_selling",
                    "UOM Conversion Detail-standard_buying",
                    "UOM Conversion Detail-standard_selling",
                    "Work Order-item_group",
                ),
            ]
        ],
    },
    {
        "doctype": "Property Setter",
        "filters": [["name", "in", ("Sales Invoice-posa_pos_opening_shift-no_copy", "POS Profile-main-field_order")]],
    },
]

# Jinja methods for print formats (fine dining guest feedback link / QR code)
jinja = {
    "methods": [
        "posawesome.posawesome.api.fine_dining_guests.feedback_url",
        "posawesome.posawesome.api.fine_dining_guests.feedback_qr",
        # supermarket: X / Z report
        "posawesome.posawesome.api.supermarket.shift_report",
        # supermarket: "You saved" on receipts, label barcodes
        "posawesome.posawesome.api.supermarket.posa_savings",
        "posawesome.posawesome.api.supermarket.posa_barcode_svg",
    ]
}
