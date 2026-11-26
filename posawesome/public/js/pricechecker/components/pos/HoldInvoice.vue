<template>
  <div>
    <v-card class="selection mx-auto grey lighten-5" style="max-height: 80vh; height: 80vh">
      <v-row class="my-0 px-2 py-1 overflow-y-auto">
        <v-col class="pb-0 mb-2">
          <v-text-field
            dense
            :clearable="true"
            outlined
            ref="invoice_name"
            v-model="invoice_name"
            color="indigo"
            :label="frappe._('Search Invoice ID Or Mobile no. Or Customer Name')"
            background-color="white"
            hide-details
          ></v-text-field>
        </v-col>
        <v-col cols="12" class="pt-0 mt-0">
          <div fluid class="items">
            <div class="my-0 py-0 overflow-y-auto" style="max-height: 75vh; height: 75vh">
              <template>
                <v-data-table
                  :headers="headers"
                  :items="filteredData"
                  item-key="name"
                  class="elevation-1"
                  :items-per-page="itemsPerPage"
                  hide-default-footer
                  @click:row="open_invoice"
                ></v-data-table>
              </template>
            </div>
          </div>
        </v-col>
      </v-row>
    </v-card>

    <v-card flat style="max-height: 11vh; height: 11vh" class="cards mb-0 mt-3 py-0">
      <v-row align="start" no-gutters>
        <v-col cols="12">
          <v-btn block class="pa-1" large color="warning" dark @click="back_to_invoice">
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
      { text: __("Customer"), value: "customer", align: "start", sortable: true },
      { text: __("Mobile No"), value: "mobile_no", align: "start", sortable: false },
      { text: __("Invoice"), value: "name", align: "start", sortable: true },
      { text: __("Date"), align: "start", sortable: true, value: "posting_date" },
      { text: __("Amount"), value: "grand_total", align: "start", sortable: false },
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
      console.log('Hold Invoice Focus');
    },
    back_to_invoice() {
      evntBus.$emit('show_hold', 'false');
    },
    open_invoice(invoice) {
      evntBus.$emit("load_invoice", invoice);
      this.invoice_name = null;
      this.$refs.invoice_name.focus();
    },
    submit_dialog() {
      if (this.selected.length > 0) {
        evntBus.$emit("load_invoice", this.selected[0]);
      }
    },
    get_draft_invoices() {
      const vm = this;
      frappe.call({
        method: 'posawesome.posawesome.api.posapp.get_draft_invoices',
        args: {
          pos_opening_shift: this.pos_opening_shift.name,
        },
        async: false,
        callback: function (r) {
          if (r.message) {
            evntBus.$emit('open_hold', r.message);
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
    this.$root.$on('focusHoldInput', this.focus_input);
    this.$nextTick(function () {
      evntBus.$on('register_pos_profile', (data) => {
        this.pos_profile = data.pos_profile;
        this.pos_opening_shift = data.pos_opening_shift;
        this.get_draft_invoices();
      });
      evntBus.$on("open_hold", (data) => {
        this.dialog_data = data;
        this.invoice_name = '';
      });
    });
    document.addEventListener('keydown', this.shortcuts.bind(this));
  },
  destroyed() {
    document.removeEventListener('keydown', this.shortcuts);
  },
};
</script>

<style scoped>
/deep/ .v-data-table__wrapper .v-data-table__mobile-row {
  height: auto;
  min-height: 21px !important;
}
/deep/ .v-data-table>.v-data-table__wrapper .v-data-table__mobile-row {
    height: auto;
    min-height: 21px !important;
}
</style>