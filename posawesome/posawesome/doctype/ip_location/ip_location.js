// Copyright (c) 2025, Youssef Restom and contributors
// For license information, please see license.txt

frappe.ui.form.on('IP Location', {
  refresh: function(frm) {
    if (frm.doc.__islocal) {
      // Make company field editable if the document is local (new)
      frm.set_df_property('company', 'read_only', 0);
      frm.set_df_property('posting_date', 'read_only', 0);
      // Add button to open company selection popup
      let selectCompanyBtn = frm.add_custom_button(__('Select Company'), function() {
        // Create a dialog to select company
        let d = new frappe.ui.Dialog({
          title: __('Select Company'),
          fields: [
            {
              label: __('Company'),
              fieldname: 'company',
              fieldtype: 'Link',
              options: 'Company',
              reqd: 1
            }
          ],
          primary_action_label: __('Select'),
          primary_action(values) {
            frm.set_value('company', values.company);
              d.hide();
          }
        });
        d.show();
      });
      // Store the reference to the selectCompanyBtn for later use
      frm.custom_selectCompanyBtn = selectCompanyBtn;
      // Change button color to orange
      selectCompanyBtn.css({
        'background-color': 'orange',
          'color': 'white'
        });
    } else {
      // Make company field read-only if the document is not local (existing)
      frm.set_df_property('company', 'read_only', 1);
      frm.set_df_property('posting_date', 'read_only', 1);
    }
    // Hide the sidebar
    frm.page.sidebar.addClass('hidden');
    // Add button to toggle sidebar
    frm.page.add_inner_button(__('Toggle Sidebar'), function() {
      frm.page.sidebar.toggleClass('hidden');
    });
  },

  party_type: function(frm) {
    frm.set_value("party_name", "");
    frm.set_value("party", "");
  },

  party: function(frm) {
    if (frm.doc.party_type && frm.doc.party) {
      frm.set_party_details = true;

      return frappe.call({
        method: "erpnext.accounts.doctype.payment_entry.payment_entry.get_party_details",
        args: {
          company: frm.doc.company,
          party_type: frm.doc.party_type,
          date: frm.doc.posting_date,
          party: frm.doc.party
        },
        callback: function(r, rt) {
          if (r.message) {
            frappe.run_serially([
              () => frm.set_value("party_name", r.message.party_name),
            ]);
          }
          frm.set_party_details = false;
        }
      });
    }
  }
});
