<template>
  <v-row justify="center">
    <v-dialog v-model="returnItemsDialog" max-width="800px" min-width="800px" @keydown.esc="close_dialog">
      <v-card>
        <v-card-title>
          <span class="text-h5 text-primary">{{ __('Enter Return Quantities') }}</span>
        </v-card-title>
        <v-container>
          <v-row>
            <v-col cols="12" class="pa-1">
              <v-data-table
                v-if="returnItems.length > 0"
                :headers="headers"
                :items="returnItems"
                item-value="name"
                class="elevation-1"
                hide-default-footer
                return-object
              >
                <template v-slot:item.qty="{ item }">
                  {{ formtFloat(item.qty) || 'N/A' }}
                </template>
                <template v-slot:item.return_qty="{ item }">
                  <v-text-field
                    v-model.number="item.return_qty"
                    type="number"
                    density="compact"
                    variant="outlined"
                    color="primary"
                    bg-color="white"
                    hide-details
                    @update:model-value="validateReturnQty(item)"
                  ></v-text-field>
                </template>
                <template v-slot:item.amount="{ item }">
                  {{ currencySymbol(item.currency) || '' }}
                  {{ formtCurrency(item.amount) || 'N/A' }}
                </template>
              </v-data-table>
              <v-alert v-else type="warning" class="mt-4">
                {{ __('No items available for return.') }}
              </v-alert>
            </v-col>
          </v-row>
        </v-container>
        <v-card-actions class="mt-4">
          <v-spacer></v-spacer>
          <v-btn color="error mx-2" @click="close_dialog">{{ __('Close') }}</v-btn>
          <v-btn
            color="success"
            @click="submit_return_items"
            :disabled="!hasValidReturnItems"
          >{{ __('Submit Return') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-row>
</template>

<script>
import { evntBus } from '../../bus';
import format from '../../format';

export default {
  mixins: [format],
  data: () => ({
    returnItemsDialog: false,
    returnItems: [],
    returnDoc: null,
    invoiceDoc: null,
    headers: [
      {
        title: __('Item Name'),
        key: 'item_name',
        align: 'start',
        sortable: true,
      },
      {
        title: __('Original Qty'),
        key: 'qty',
        align: 'center',
        sortable: true,
      },
      {
        title: __('Return Qty'),
        key: 'return_qty',
        align: 'center',
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
  computed: {
    hasValidReturnItems() {
      return this.returnItems.some(item => item.return_qty > 0);
    },
  },
  methods: {
    validateReturnQty(item) {
      if (item.return_qty < 0) {
        item.return_qty = 0;
      } else if (item.return_qty > (item.qty || 0)) {
        item.return_qty = item.qty || 0;
      }
    },
    close_dialog() {
      this.returnItemsDialog = false;
      this.returnItems = [];
      this.returnDoc = null;
      this.invoiceDoc = null;
      if (this.$root) {
        evntBus.$emit('escEventTriggered');
      }
    },
    submit_return_items() {
      if (!this.hasValidReturnItems) return;

      const items = this.returnItems
        .filter(item => item.return_qty > 0)
        .map(item => ({
          ...item,
          qty: item.return_qty * -1,
          stock_qty: item.stock_qty * -1,
          amount: item.amount * -1,
        }));

      this.invoiceDoc.items = items;
      this.invoiceDoc.is_return = 1;
      this.invoiceDoc.return_against = this.returnDoc.name;
      this.invoiceDoc.customer = this.returnDoc.customer;

      const data = { invoice_doc: this.invoiceDoc, return_doc: this.returnDoc };
      evntBus.$emit('load_return_invoice', data);
      this.close_dialog();
    },
  },
  created() {
    evntBus.$on('open_return_items_popup', ({ return_doc, invoice_doc }) => {
      console.log('?? Received popup event', { return_doc, invoice_doc });
      if (!return_doc || !return_doc.items || return_doc.items.length === 0) {
        console.warn('No items found in return_doc:', return_doc);
        this.returnItemsDialog = true;
        return;
      }
      this.returnDoc = return_doc;
      this.invoiceDoc = invoice_doc;
      this.returnItems = return_doc.items.map(item => ({
        ...item,
        return_qty: 0,
        currency: return_doc.currency || 'USD', // Default currency if missing
      }));
      this.returnItemsDialog = true;
    });
  },
  beforeUnmount() {
    evntBus.$off('open_return_items_popup');
  },
};
</script>

<style scoped>
.v-data-table th {
  background: #f5f5f5 !important;
  color: #424242 !important;
  font-weight: 600 !important;
  padding: 12px !important;
}

.v-data-table td {
  padding: 8px !important;
  border-bottom: 1px solid #e0e0e0 !important;
}

.v-text-field--outlined fieldset {
  border-color: #e0e0e0;
}

.v-text-field--outlined:hover fieldset {
  border-color: #1976d2;
}

.v-text-field--outlined.v-input--is-focused fieldset {
  border-color: #1976d2;
}
</style>