<template>
  <v-row justify="center">
    <v-dialog v-model="invoicesDialog" max-width="800px" min-width="800px">
      <v-card>
        <v-card-title>
          <span class="text-h5 text-primary">{{
            __('Select Return Invoice')
          }}</span>
        </v-card-title>
        <v-container>
          <v-row class="mb-4">
            <v-text-field
              color="primary"
              :label="frappe._('Invoice ID, Customer ID Or Mobile No')"
              bg-color="white"
              hide-details
              v-model="invoice_name"
              density="compact"
              clearable
              class="mx-4"
              @keydown.enter="search_invoices"
            ></v-text-field>
            <v-btn
              variant="text"
              class="ml-2"
              color="primary"
              @click="search_invoices"
              >{{ __('Search') }}</v-btn>
          </v-row>
          <v-row>
            <v-col cols="12" class="pa-1" v-if="dialog_data && !showItemSelection">
              
                <v-data-table
                  :headers="headers"
                  :items="dialog_data"
                  item-value="name"
                  class="elevation-1"
                  :select-strategy="(singleSelect) ? 'single' : 'page'"
                  show-select
                  v-model="selected"
                  @click:row="(event, row) => onRowClick(row.item, row)"
                  return-object
                >
                  <template v-slot:item.grand_total="{ item }">
                    {{ currencySymbol(item.currency) }}
                    {{ formtCurrency(item.grand_total) }}</template>
                </v-data-table>
              
            </v-col>
            
            <!-- Item Selection Table -->
            <v-col cols="12" class="pa-1" v-if="showItemSelection">
              <v-card-subtitle class="pb-0">
                <v-btn icon size="small" @click="backToInvoiceList">
                  <v-icon>mdi-arrow-left</v-icon>
                </v-btn>
                <span class="ml-2">{{ __('Select Items from Invoice:') }} {{ selectedInvoice.name }}</span>
              </v-card-subtitle>
              <v-data-table
                :headers="itemHeaders"
                :items="invoiceItems"
                item-value="idx"
                class="elevation-1"
                show-select
                v-model="selectedItems"
                @click:row="(event, row) => onRowClicks(row.item, row)"
                return-object
              >
                <template v-slot:item.rate="{ item }">
                  {{ currencySymbol(selectedInvoice.currency) }}
                  {{ formtCurrency(item.rate) }}
                </template>
                <template v-slot:item.amount="{ item }">
                  {{ currencySymbol(selectedInvoice.currency) }}
                  {{ formtCurrency(item.amount) }}
                </template>
              </v-data-table>
            </v-col>
          </v-row>
        </v-container>
        <v-card-actions class="mt-4">
          <v-btn color="warning" @click="return_without_invoice">
            <v-icon start>mdi-backup-restore</v-icon>
            {{ __('Return Without Invoice') }}
          </v-btn>
          <v-spacer></v-spacer>
          <v-btn color="error mx-2" @click="close_dialog">Close</v-btn>
          <v-btn
            v-if="selected.length && !showItemSelection"
            color="primary"
            @click="showItems"
            >{{ __('Next') }}</v-btn>
          <v-btn
            v-if="showItemSelection && selectedItems.length"
            color="success"
            @click="submit_dialog"
            >{{ __('Select') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-row>
</template>

<script>
import { evntBus } from '../../bus';
import format from '../../format';
import offlinePos from '../../../offline';
export default {
  mixins: [format],
  data: () => ({
    invoicesDialog: false,
    singleSelect: true,
    selected: [],
    selectedItems: [],
    dialog_data: [], // v-data-table needs an array (Vuetify 3)
    company: '',
    invoice_name: '',
    showItemSelection: false,
    selectedInvoice: null,
    invoiceItems: [],
    headers: [
      {
        title: __('Customer'),
        key: 'customer',
        align: 'start',
        sortable: true,
      },
      {
        title: __('Name'),
        key: 'customer_name',
        sortable: true,
      },
      {
        title: __('Date'),
        align: 'start',
        sortable: true,
        key: 'posting_date',
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
    itemHeaders: [
      {
        title: __('Item Code'),
        key: 'item_code',
        align: 'start',
        sortable: true,
      },
      {
        title: __('Item Name'),
        key: 'item_name',
        sortable: true,
      },
      {
        title: __('Qty'),
        key: 'qty',
        align: 'center',
        sortable: false,
      },
      {
        title: __('Rate'),
        key: 'rate',
        align: 'end',
        sortable: false,
      },
      {
        title: __('Amount'),
        key: 'amount',
        align: 'end',
        sortable: false,
      },
    ],
  }),
  watch: {},
  methods: {
return_without_invoice() {
  // Blank return doc, no original invoice. Invoice.vue fills in the customer.
  const invoice_doc = {
    items: [],
    is_return: 1,
    return_against: null,
    customer: null,
    discount_amount: 0,
    additional_discount_percentage: 0,
  };
  evntBus.$emit('load_return_invoice', { invoice_doc, return_doc: null });
  this.close_dialog();
  if (this.$root) {
    evntBus.$emit('escEventTriggered');
  }
},
    close_dialog() {
      this.invoicesDialog = false;
      this.showItemSelection = false;
      this.selectedItems = [];
      this.selectedInvoice = null;
      this.invoiceItems = [];
    },
    search_invoices_by_enter(e) {
      if (e.keyCode === 13) {
        this.search_invoices();
      }
    },
    search_invoices() {
      const vm = this;
      if (offlinePos.useOffline()) {
        evntBus.$emit('show_mesage', {
          text: __('Searching invoices needs the server. Use Return Without Invoice while offline.'),
          color: 'warning',
        });
        return;
      }
      frappe.call({
        method: 'posawesome.posawesome.api.posapp.search_invoices_for_return',
        args: {
          invoice_name: vm.invoice_name,
          company: vm.company,
        },
        async: false,
        callback: function (r) {
          if (r.message) {
            vm.dialog_data = r.message;
          }
        },
      });
    },
    onRowClick(item) {
      // Handle the click event on the row here
      this.selected = [item];
      this.showItems(); // Next screen to select Items
      // this.submit_dialog_all_item(); // Call the submit_dialog method when the row is clicked
      // if (this.$root) {
      //     evntBus.$emit('escEventTriggered');
      // }
    },
onRowClicks(item) {
  const exists = this.selectedItems.some(
    selected => selected.idx === item.idx
  );

  if (exists) {
    this.selectedItems = this.selectedItems.filter(
      selected => selected.idx !== item.idx
    );
  } else {
    this.selectedItems = [...this.selectedItems, item];
  }
},
    onRowClickss(item) {
      // Handle the click event on the row here
      this.selectedItems = [item];
    },
    showItems() {
      if (this.selected.length > 0) {
        this.selectedInvoice = this.selected[0];
        this.invoiceItems = [...this.selectedInvoice.items];
        this.showItemSelection = true;
        this.selectedItems = [];
      }
    },
    backToInvoiceList() {
      this.showItemSelection = false;
      this.selectedItems = [];
      this.invoiceItems = [];
    },
    submit_dialog_all_item() {
      if (this.selected.length > 0) {
        const return_doc = this.selected[0];
        const invoice_doc = {};
        const items = [];
        return_doc.items.forEach((item) => {
          const new_item = { ...item };
          new_item.qty = item.qty * -1;
          new_item.stock_qty = item.stock_qty * -1;
          new_item.amount = item.amount * -1;
          items.push(new_item);
        });
        invoice_doc.items = items;
        invoice_doc.is_return = 1;
        invoice_doc.return_against = return_doc.name;
        invoice_doc.customer = return_doc.customer;

        // Make sure grand_total is negative for returns
        if (return_doc.grand_total > 0) {
          invoice_doc.grand_total = return_doc.grand_total * -1;
        } else {
          invoice_doc.grand_total = return_doc.grand_total;
        }

        const data = { invoice_doc, return_doc };
        evntBus.$emit('load_return_invoice', data);
        this.invoicesDialog = false;
      }
    },
    submit_dialog() {
      if (this.selectedItems.length > 0) {
        const return_doc = this.selectedInvoice;
        const invoice_doc = {};
        const items = [];
        
        // Only process selected items
        this.selectedItems.forEach((item) => {
          const new_item = { ...item };
          new_item.qty = item.qty * -1;
          new_item.stock_qty = item.stock_qty * -1;
          new_item.amount = item.amount * -1;
          items.push(new_item);
        });
        
        invoice_doc.items = items;
        invoice_doc.is_return = 1;
        invoice_doc.return_against = return_doc.name;
        invoice_doc.customer = return_doc.customer;
        const data = { invoice_doc, return_doc };
        evntBus.$emit('load_return_invoice', data);
        this.invoicesDialog = false;
        this.showItemSelection = false;
        this.selectedItems = [];
        this.selectedInvoice = null;
        if (this.$root) {
             evntBus.$emit('escEventTriggered');
        }
      }
    },
  },
  created: function () {
    evntBus.$on('open_returns', (data) => {
      this.invoicesDialog = true;
      this.company = data;
      this.invoice_name = '';
      this.dialog_data = [];
      this.selected = [];
      this.showItemSelection = false;
      this.selectedItems = [];
      this.selectedInvoice = null;
      this.invoiceItems = [];
    });
  },
};
</script>