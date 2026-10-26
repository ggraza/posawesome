<template>
  <div>
    <v-card class="selection mx-auto bg-grey-lighten-5" style="max-height: 80vh; height: 80vh">
      <v-row class="my-0 px-2 py-1 overflow-y-auto">
        <v-col class="pb-0 mb-2">
          <v-text-field
            density="compact"
            :clearable="true"
            variant="outlined"
            ref="invoice_name"
            v-model="invoice_name"
            color="indigo"
            :label="frappe._('Search Invoice ID Or Mobile no. Or Customer Name')"
            bg-color="white"
            hide-details
          ></v-text-field>
        </v-col>
        <v-col cols="12" class="pt-0 mt-0">
          <div fluid class="items">
            <div class="my-0 py-0 overflow-y-auto" style="max-height: 70vh; height: 70vh">
              
                <v-data-table
                  :headers="headers"
                  :items="filteredData"
                  item-value="name"
                  class="elevation-1"
                  :items-per-page="itemsPerPage"
                  @click:row="(event, row) => print_invoice(row.item, row)"
                  return-object
                ></v-data-table>
              
            </div>
          </div>
        </v-col>
      </v-row>
    </v-card>

    <v-card flat style="max-height: 11vh; height: 11vh" class="cards mb-0 mt-3 py-0">
      <v-row align="start" no-gutters>
        <v-col cols="12">
          <v-btn block class="pa-1" size="large" color="warning" @click="back_to_invoice">
            {{ __('Back') }}
          </v-btn>
        </v-col>
      </v-row>
    </v-card>
  </div>
</template>

<script>
import { evntBus } from "../../bus";
export default {
  data: () => ({
    singleSelect: true,
    selected: [],
    dialog_data: [],
    pos_profile: '',
    pos_opening_shift: '',
    itemsPerPage: 50,
    invoice_name: "",
    headers: [
      { title: __("Customer"), key: "customer", align: "start", sortable: true },
      { title: __("Mobile No"), key: "mobile_no", align: "start", sortable: false },
      { title: __("Invoice"), key: "name", align: "start", sortable: true },
      { title: __("Date"), align: "start", sortable: true, key: "posting_date" },
      { title: __("Amount"), key: "grand_total", align: "start", sortable: false },
    ],
  }),
  computed: {
    filteredData() {
      if (this.invoice_name) {
        const search = this.invoice_name.toLowerCase();
        console.log('Search term:', search);
        return this.dialog_data.filter(item => {
          const matchesCustomer = item.customer && item.customer.toLowerCase().includes(search);
          const matchesMobile = item.mobile_no && item.mobile_no.toLowerCase().includes(search);
          const matchesInvoice = item.name && item.name.toLowerCase().includes(search);
          console.log(`Item: ${item.name}, Matches: Customer=${matchesCustomer}, Mobile=${matchesMobile}, Invoice=${matchesInvoice}`);
          return matchesCustomer || matchesMobile || matchesInvoice;
        });
      }
      return this.dialog_data;
    },
  },
  methods: {
    focus_input() {
      this.invoice_name = null;
      this.$refs.invoice_name.focus();
      console.log('Submited Invoice Focus');
    },
    back_to_invoice() {
      evntBus.$emit('show_invoices', 'false');
      const view = this.pos_profile.posa_default_card_view ? 'card' : 'list';
      evntBus.$emit('set_items_view', view);
    },
    print_invoice_old(invoice) {
      this.selected_invoice = invoice;
      if (!this.selected_invoice) {
        frappe.msgprint(__('Please select an invoice first.'));
        return;
      }
      
      const print_format =
        this.pos_profile.print_format_for_online || this.pos_profile.print_format;
      const letter_head = this.pos_profile.letter_head || 0;
      const url =
        frappe.urllib.get_base_url() +
        "/printview?doctype=Sales%20Invoice&name=" +
        this.selected_invoice.name +
        "&trigger_print=1" +
        "&format=" +
        print_format +
        "&no_letterhead=" +
        letter_head;
        
      const printWindow = window.open(url, "Print");
      printWindow.addEventListener(
        "load",
        function () {
          printWindow.print();
          // Uncomment below to auto-close
          // printWindow.close();
        },
        true
      );
      this.invoice_name = null;
      this.$refs.invoice_name.focus();
    },

print_invoice(invoice) {
  const vm = this;

  if (!invoice || !invoice.name) {
    frappe.msgprint(__('Please select an invoice first.'));
    return;
  }

  // Get complete Sales Invoice document
  frappe.call({
    method: "frappe.client.get",
    args: {
      doctype: "Sales Invoice",
      name: invoice.name
    },
    callback: function (r) {
      if (!r.message) {
        frappe.msgprint(__("Unable to load invoice."));
        return;
      }

      const doc = r.message;

      // If already submitted to FBR, directly print
      if (doc.fbr_invoice_no) {
        vm.open_invoice_print(doc);
        return;
      }

      // Otherwise submit to FBR first
      vm.submit_invoice_to_fbr(doc);
    }
  });
},
submit_invoice_to_fbr(doc) {
  const vm = this;

  frappe.show_alert({
    message: __("Submitting invoice to FBR..."),
    indicator: "blue"
  });

  let item_list = [];
  let total_qty = 0;

  // Same tax logic as your Sales Invoice button
  const tax_rate =
    doc.taxes && doc.taxes.length > 0
      ? doc.taxes[0].rate
      : 0;

  $.each(doc.items, function (k, item) {
    const salevalue = item.rate * item.qty;

    item_list.push({
      "ItemCode": item.item_code,
      "ItemName": item.item_name,
      "Quantity": item.qty,
      "PCTCode": "11001010",
      "TaxRate": tax_rate,
      "SaleValue": salevalue,
      "TotalAmount": salevalue * (1 + (tax_rate / 100)),
      "TaxCharged": (salevalue / 100) * tax_rate,
      "Discount": "0.0",
      "FurtherTax": 0,
      "InvoiceType": 1,
      "RefUSIN": null
    });

    total_qty += item.qty;
  });

  const data = {
    "InvoiceNumber": "",
    "POSID": doc.pos_id,
    "USIN": doc.name,
    "DateTime": doc.posting_date,
    "BuyerNTN": "",
    "BuyerCNIC": null,
    "BuyerName": doc.customer,
    "BuyerPhoneNumber": null,
    "TotalBillAmount": doc.rounded_total,
    "TotalQuantity": total_qty,
    "TotalSaleValue": doc.net_total,
    "TotalTaxCharged": doc.total_taxes_and_charges,
    "Discount": "0",
    "FurtherTax": "0",
    "PaymentMode": 1,
    "RefUSIN": null,
    "InvoiceType": 1,
    "Items": item_list
  };

  $.ajax({
    url: "https://gw.fbr.gov.pk/imsp/v1/api/Live/PostData",
    type: "POST",
    data: data,
    async: false,

    beforeSend: function (xhr) {
      xhr.setRequestHeader(
        "Authorization",
        "Bearer " + doc.fbr_pos_token
      );
    },

    success: function (response) {

      console.log(
        "FBR Response:",
        JSON.stringify(response)
      );

      const invoiceNumber = response.InvoiceNumber;

      if (!invoiceNumber) {
        frappe.msgprint({
          title: __("FBR Error"),
          message: __("FBR did not return an Invoice Number."),
          indicator: "red"
        });
        return;
      }

      // Save FBR Invoice Number in Sales Invoice
      frappe.call({
        method: "posawesome.events.sales_invoice.set_invoice_number",
        args: {
          doctype: "Sales Invoice",
          name: doc.name,
          inv: invoiceNumber
        },
        async: false,

        callback: function (e) {

          if (e.exc) {
            frappe.msgprint({
              title: __("Error"),
              message: __("Unable to save FBR Invoice Number."),
              indicator: "red"
            });
            return;
          }

          frappe.show_alert({
            message: __("FBR Invoice No: ") + invoiceNumber,
            indicator: "green"
          });

          // Print ONLY after FBR submission and saving succeeds
          vm.open_invoice_print({
            ...doc,
            fbr_invoice_no: invoiceNumber
          });
        }
      });
    },

    error: function (jqXhr, textStatus, errorMessage) {

      console.error(
        "FBR Error:",
        textStatus,
        errorMessage,
        jqXhr.responseText
      );

      frappe.msgprint({
        title: __("FBR Submission Failed"),
        message:
          __("Invoice was not printed because FBR submission failed.") +
          "<br><br>" +
          (jqXhr.responseText || errorMessage || ""),
        indicator: "red"
      });
    }
  });
},

open_invoice_print(doc) {

  const print_format =
    this.pos_profile.print_format_for_online ||
    this.pos_profile.print_format;

  const letter_head =
    this.pos_profile.letter_head || 0;

  const url =
    frappe.urllib.get_base_url() +
    "/printview?doctype=Sales%20Invoice" +
    "&name=" +
    encodeURIComponent(doc.name) +
    "&trigger_print=1" +
    "&format=" +
    encodeURIComponent(print_format) +
    "&no_letterhead=" +
    letter_head;

  const printWindow = window.open(url, "Print");

  if (!printWindow) {
    frappe.msgprint(
      __("Please allow popups in your browser to print the invoice.")
    );
    return;
  }

  printWindow.addEventListener(
    "load",
    function () {
      printWindow.print();

      // Uncomment if you want the print window to close automatically
      // printWindow.close();
    },
    true
  );

  this.invoice_name = null;

  this.$nextTick(() => {
    if (this.$refs.invoice_name) {
      this.$refs.invoice_name.focus();
    }
  });
},

    get_submited_invoices() {
      const vm = this;
      frappe.call({
        method: 'posawesome.posawesome.api.posapp.get_submited_invoices',
        args: {
          pos_opening_shift: this.pos_opening_shift.name,
        },
        async: false,
        callback: function (r) {
          if (r.message) {
            evntBus.$emit('open_invoices', r.message);
          }
        },
      });
    },
    shortcuts(e) {
      if ((e.key === 'h' || e.key === 'H') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.$refs.invoice_name.focus();
      }
    },
  },
  created: function () {
    evntBus.$on('focusInvoicesInput', this.focus_input);
    this.$nextTick(function () {
      evntBus.$on('register_pos_profile', (data) => {
        this.pos_profile = data.pos_profile;
        this.pos_opening_shift = data.pos_opening_shift;
        this.get_submited_invoices();
      });
      evntBus.$on("open_invoices", (data) => {
        this.dialog_data = data;
        this.invoice_name = '';
      });
    });
    evntBus.$on('show_invoices', (value) => {
      if (value === 'true') {
        // Fetch latest invoices when Invoices view is opened
        this.get_submited_invoices();
      }
    });
    document.addEventListener('keydown', this.shortcuts.bind(this));
  },
  unmounted() {
    document.removeEventListener('keydown', this.shortcuts);
  },
};
</script>
