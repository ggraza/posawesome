frappe.pages['account_summary_dash'].on_page_load = function(wrapper) {
    let page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Account Summary Dashboard',
        single_column: true
    });

    page.set_primary_action('Refresh', () => {
        load_summary();
    });

    // Add filters
    page.add_field({
        fieldtype: 'Date',
        label: 'From Date',
        fieldname: 'from_date',
        default: frappe.datetime.add_days(frappe.datetime.get_today(), -1)
        // default: frappe.datetime.month_start()
    });

    page.add_field({
        fieldtype: 'Date',
        label: 'To Date',
        fieldname: 'to_date',
        default: frappe.datetime.get_today()
        // default: frappe.datetime.month_end()
    });

    page.add_field({
        fieldtype: 'Link',
        label: 'Company',
        fieldname: 'company',
        options: 'Company',
        default: frappe.defaults.get_default('Company')
    });

    // Render HTML body
    $(frappe.render_template("account_summary_dash", {})).appendTo(page.body);

    function load_summary() {
        let filters = {
            from_date: page.fields_dict.from_date.get_value(),
            to_date: page.fields_dict.to_date.get_value(),
            company: page.fields_dict.company.get_value()
        };

        frappe.call({
            method: "posawesome.posawesome.page.account_summary_dash.account_summary_dash.get_account_summary",
            args: filters,
            callback: function(r) {
                if (r.message) {
                    $("#customer_receivable").html(r.message.customer_receivable);
                    $("#supplier_payable").html(r.message.supplier_payable);
                    $("#customer_received").html(r.message.customer_received);
                    $("#supplier_paid").html(r.message.supplier_paid);
                }
            }
        });
    }

    // Load initial data
    load_summary();
};
