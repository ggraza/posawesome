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
    print_invoice(invoice) {
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
