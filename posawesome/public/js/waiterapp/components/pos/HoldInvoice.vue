<template>
  <div>
    <v-card
      class="selection mx-auto bg-grey-lighten-5"
      style="max-height:80vh;height:80vh"
    >
      <v-card-text>
      <v-row
          class="items pb-0 pr-0 pt-2 px-0"
          style="overflow-x:auto;white-space:nowrap;"
      >
          <v-col cols="auto">
              <v-chip
                  class="ma-1"
                  color="red"
                  variant="outlined"
                  @click="
                      selectedOrderType='';
                      selectedZone='';
                      invoice_name='';
                  "
              >
                  <v-icon start size="small">mdi-filter-remove</v-icon>
                  Clear
              </v-chip>
              <v-chip
                  class="ma-1"
                  :color="selectedOrderType=='' ? 'primary' : ''"
                  :variant="(selectedOrderType!='') ? 'outlined' : 'flat'"
                  @click="selectedOrderType=''"
              >
                  All
              </v-chip>
          </v-col>
      
          <v-col
              cols="auto"
              v-for="type in order_type"
              :key="type.name"
          >
              <v-chip
                  class="ma-1"
                  :color="selectedOrderType==type.name?'primary':''"
                  :variant="(selectedOrderType!=type.name) ? 'outlined' : 'flat'"
                  @click="selectedOrderType=type.name"
              >
                  {{ type.name }}
              </v-chip>
          </v-col>
      </v-row>

      <v-row
          class="items pb-0 pr-0 pt-2 px-0 mb-3"
          style="overflow-x:auto;white-space:nowrap;"
      >
          <v-col cols="auto">
              <v-chip
                  class="ma-1"
                  :color="selectedZone=='' ? 'primary' : ''"
                  :variant="(selectedZone!='') ? 'outlined' : 'flat'"
                  @click="selectedZone=''"
              >
                  All Zones
              </v-chip>
          </v-col>
      
          <v-col
              cols="auto"
              v-for="zone in service_zone"
              :key="zone.name"
          >
              <v-chip
                  class="ma-1"
                  :color="selectedZone==zone.name?'primary':''"
                  :variant="(selectedZone!=zone.name) ? 'outlined' : 'flat'"
                  @click="selectedZone=zone.name"
              >
                  {{ zone.name }}
              </v-chip>
          </v-col>
      </v-row>

      <v-divider class="mb-3"></v-divider>
        <!-- Search -->
        <v-text-field
          density="compact"
          variant="outlined"
          clearable
          ref="invoice_name"
          v-model="invoice_name"
          color="indigo"
          :label="frappe._('Search Invoice ID Or Mobile no. Or Customer Name')"
          bg-color="white"
          hide-details
        ></v-text-field>
        <v-divider class="my-4"></v-divider>
        <!-- Invoice Cards -->
        <v-row
          v-if="filteredData.length"
          class="overflow-y-auto"
          style="max-height:62vh"
        >
          <v-col
            cols="12"
            sm="6"
            md="4"
            lg="3"
            v-for="invoice in filteredData"
            :key="invoice.name"
          >
            <v-card
              class="invoice-card"
              elevation="2"
              @click="open_invoice(invoice)"
            >
              <v-card-text>
                <v-row
                  class="align-center my-2"
                  no-gutters
                >
                  <v-col
                    cols="6"
                    class="text-left"
                  >
                    <v-icon
                      color="primary"
                      size="large"
                    >
                      mdi-table-furniture
                    </v-icon>
                    <span class="text-h6 text-primary font-weight-bold">
                      {{ invoice.posa_service_table || "-" }}
                    </span>
                  </v-col>
                  <v-col
                    cols="6"
                    class="text-right"
                  >
                    <v-icon
                      size="large"
                      color="orange"
                    >
                      mdi-map-marker
                    </v-icon>
                    <span class="font-weight-medium">
                      {{ invoice.posa_service_zone || "-" }}
                    </span>
                  </v-col>
                </v-row>
                <v-divider class="my-2"></v-divider>
                <div>
                  <v-icon size="small">
                    mdi-food
                  </v-icon>
                  {{ invoice.posa_order_type || "-" }}
                </div>
                <div>
                  <v-icon size="small">
                    mdi-receipt
                  </v-icon>
                  {{ invoice.name }}
                </div>
                <div>
                  <v-icon size="small">
                    mdi-account-group
                  </v-icon>
                  {{ invoice.customer_name || invoice.customer }}
                </div>
                <div>
                  <v-icon size="small">
                    mdi-calendar
                  </v-icon>
                  {{ invoice.posting_date }}
                </div>
                <div>
                  <v-icon size="small">
                    mdi-clock
                  </v-icon>
                  {{ invoice.posting_time }}
                </div>
                <v-divider class="my-2"></v-divider>
                <v-chip
                  size="small"
                  color="primary"
                >
                  {{ formtCurrency(invoice.grand_total) }}
                </v-chip>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
<!-- no hold invoices -->
<v-row
    v-else
    justify="center"
    align="center"
    style="height:60vh"
>
    <v-col cols="12" class="text-center">
        <v-icon size="70" color="grey">
            mdi-receipt-remove-outline
        </v-icon>

        <div class="text-grey mt-3">
            No Hold Invoices Found
        </div>
    </v-col>
</v-row>
      </v-card-text>
    </v-card>
    <v-card
      flat
      class="cards mb-0 mt-3 py-0"
      style="height:11vh"
    >
      <v-row no-gutters>
        <v-col cols="12">
          <v-btn
            block
            size="large"
            color="warning"
            @click="back_to_invoice"
          >
            {{ __("Back") }}
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
    headers_rms: [
      {
        title: __('Customer'),
        key: 'customer_name',
        align: 'start',
        sortable: true,
      },
      {
        title: __('OrderType'),
        align: 'start',
        sortable: true,
        key: 'posa_order_type',
      },
      {
        title: __('Service'),
        align: 'start',
        sortable: true,
        key: 'posa_service_zone',
      },
      {
        title: __('Table'),
        align: 'start',
        sortable: true,
        key: 'posa_service_table',
      },
      {
        title: __('Date'),
        align: 'start',
        sortable: true,
        key: 'posting_date',
      },
      {
        title: __('Time'),
        align: 'start',
        sortable: true,
        key: 'posting_time',
      },
      {
        title: __('Invoice'),
        key: 'name',
        align: 'start',
        sortable: true,
      },
      {
        title: __('Amount'),
        key: 'grand_total',
        align: 'end',
        sortable: false,
      },
    ],
    order_type: [],
    service_zone: [],
    selectedOrderType: "",
    selectedZone: "",

  }),
  computed: {
filteredData() {
    let invoices = [...this.dialog_data];
    if (this.selectedOrderType) {
        invoices = invoices.filter(
            d => d.posa_order_type === this.selectedOrderType
        );
    }
    if (this.selectedZone) {
        invoices = invoices.filter(
            d => d.posa_service_zone === this.selectedZone
        );
    }
    if (this.invoice_name) {
        const search = this.invoice_name.toLowerCase();
        invoices = invoices.filter(item =>
            [
                item.customer,
                item.customer_name,
                item.mobile_no,
                item.name
            ]
                .filter(Boolean)
                .some(v =>
                    v.toLowerCase().includes(search)
                )
        );
    }
    return invoices;
},

    filteredDatas() {
      if (this.invoice_name) {
        const search = this.invoice_name.toLowerCase();
        console.log('Search term:', search);
        return this.dialog_data.filter(item => {
          const matchesCusCustomer = item.customer_name && item.customer_name.toLowerCase().includes(search);
          const matchesCustomer = (item.customer && item.customer.toLowerCase().includes(search)) || (item.customer_name && item.customer_name.toLowerCase().includes(search));
          const matchesMobile = item.mobile_no && item.mobile_no.toLowerCase().includes(search);
          const matchesInvoice = item.name && item.name.toLowerCase().includes(search);
          console.log(`Item: ${item.name}, Matches: Customer=${matchesCustomer}, Mobile=${matchesMobile}, Invoice=${matchesInvoice}`);
          return matchesCustomer || matchesMobile 
          // || matchesCusCustomer
          || matchesInvoice;
        });
      }
      return this.dialog_data;
    },
  },
  methods: {
    formtCurrency(value) {
      value = parseFloat(value);
      return value.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
    },
    focus_input() {
      this.invoice_name = null;
      this.$refs.invoice_name.focus();
      console.log('Hold Invoice Focus');
    },
    back_to_invoice() {
      evntBus.$emit('show_hold', 'false');
      const view = this.pos_profile.posa_default_card_view ? 'card' : 'list';
      evntBus.$emit('set_items_view', view);
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
    evntBus.$on('focusHoldInput', this.focus_input);
    this.$nextTick(function () {
      evntBus.$on('register_pos_profile', (data) => {
        this.pos_profile = data.pos_profile;
        this.pos_opening_shift = data.pos_opening_shift;
        this.get_draft_invoices();
      });
      evntBus.$on("open_hold", (data) => {
        console.log("Open Hold Data:", data);
        this.dialog_data = data;
        this.invoice_name = '';
    this.order_type = [
        ...new Set(
            data
                .map(d => d.posa_order_type)
                .filter(Boolean)
        )
    ].map(name => ({ name }));

    this.service_zone = [
        ...new Set(
            data
                .map(d => d.posa_service_zone)
                .filter(Boolean)
        )
    ].map(name => ({ name }));

      });
    });
    evntBus.$on('show_hold', (value) => {
      if (value === 'true') {
        // Fetch latest invoices when Hold view is opened
        this.get_draft_invoices();
      }
    });
    document.addEventListener('keydown', this.shortcuts.bind(this));
  },
  unmounted() {
    document.removeEventListener('keydown', this.shortcuts);
  },
};
</script>
<style scoped>
.invoice-card {
    cursor: pointer;
    transition: all .2s ease;
    border-radius: 12px;
    text-align: center;
}

.invoice-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 18px rgba(0,0,0,.18) !important;
}

.invoice-card:active {
    transform: scale(.98);
}
</style>
