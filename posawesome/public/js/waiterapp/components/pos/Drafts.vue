<template>
  <v-row justify="center">
    <v-dialog v-model="draftsDialog" max-width="960px" max-height="90vh">
      <v-card elevation="8" class="drafts-dialog-card">
        <!-- Header Section - White Background with Blue Text -->
        <v-card-title class="drafts-dialog-header">
          <div class="header-content">
            <div class="header-icon-wrapper">
              <v-icon class="header-icon">mdi-file-document-outline</v-icon>
            </div>
            <div class="header-text">
              <h5 class="header-title">{{ __('Select Hold Invoice') }}</h5>
              <p class="header-subtitle">{{ __('Choose a draft invoice to load') }}</p>
            </div>
          </div>
        </v-card-title>

        <!-- Content Section - Optimized for minimal scrolling -->
        <v-card-text class="drafts-dialog-content">
          <v-container class="pa-0">
            <v-row no-gutters>
              <v-col cols="12">
                <div class="section-header-compact">
                  <h6 class="section-title-compact">
                    <v-icon class="section-icon">mdi-file-table</v-icon>
                    {{ __('Draft Invoices') }}
                  </h6>
                </div>
                <v-data-table
                  ref="myDataTable1"
                  :headers="headers_rms"
                  :items="dialog_data"
                  item-value="name"
                  class="enhanced-table-compact"
                  :select-strategy="(singleSelect) ? 'single' : 'page'"
                  show-select
                  v-model="selected"
                  @click:row="(event, row) => onRowClick(row.item, row)"
                  density="compact"
                  fixed-header
                  return-object
                >
                  <template v-slot:item.posting_time="{ item }">
                    {{ item.posting_time.split('.')[0] }}
                  </template>
                  <template v-slot:item.grand_total="{ item }">
                    <span class="currency-symbol">{{ currencySymbol(item.currency) }}</span>
                    <span class="amount-value">{{ formtCurrency(item.grand_total) }}</span>
                  </template>
                </v-data-table>
              </v-col>
            </v-row>
          </v-container>
        </v-card-text>

        <!-- Actions Section -->
        <v-card-actions class="dialog-actions-container">
          <v-btn
            theme="dark"
            @click="close_dialog"
            class="pos-action-btn cancel-action-btn"
            size="large"
            elevation="2"
          >
            <v-icon start>mdi-close-circle-outline</v-icon>
            <span>{{ __('Close') }}</span>
          </v-btn>
          <v-spacer />
          <v-btn
            theme="dark"
            @click="submit_dialog"
            class="pos-action-btn submit-action-btn"
            size="large"
            elevation="2"
            :disabled="selected.length === 0"
          >
            <v-icon start>mdi-check-circle-outline</v-icon>
            <span>{{ __('Select') }}</span>
          </v-btn>
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
    draftsDialog: false,
    singleSelect: true,
    selected: [],
    dialog_data: [], // v-data-table needs an array (Vuetify 3)
    headers: [
      {
        title: __('Customer'),
        key: 'customer_name',
        align: 'start',
        sortable: true,
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
  }),
  mounted() {
    this.$nextTick(() => {
      const table = this.$refs.myDataTable1?.$el;
      if (!table) {
        return;
      }
      const tableRows = table.querySelectorAll('tbody > tr');
      if (tableRows.length > 0) {
        tableRows[0].focus();
      }
    });
  },
  watch: {
    dialog_data: {
      deep: true,
      handler(newVal) {
        this.$nextTick(() => {
          const table = this.$refs.myDataTable1?.$el;
          if (!table) return;
          const tableRows = table.querySelectorAll('tbody > tr');
          tableRows.forEach((row, index) => {
            row.setAttribute('tabindex', '0');
            row.addEventListener('keyup', (event) => {
              if (event.key === 'ArrowDown') {
                this.handleRowNavigation(event, index, tableRows, 'down');
              } else if (event.key === 'ArrowUp') {
                this.handleRowNavigation(event, index, tableRows, 'up');
              } else if (event.key === 'Enter') {
                this.handleEnterKeyPress(event, index, newVal);
              }
            });
          });
        });
      },
    },
  },
  methods: {
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
    focusFirstRow() {
      this.$nextTick(() => {
        const table = this.$refs.myDataTable1?.$el;
        if (!table) {
          console.error("Table element not found.");
          return;
        }
        const tableRows = table.querySelectorAll('tbody > tr');
        if (tableRows.length > 0) {
          tableRows[0].focus();
        }
      });
    },
    handleRowNavigation(event, index, tableRows, direction) {
      if (direction === 'down' && index < tableRows.length - 1) {
        tableRows[index + 1].focus();
      } else if (direction === 'up' && index > 0) {
        tableRows[index - 1].focus();
      }
    },
    handleEnterKeyPress(event, index, new_value) {
      const item = new_value[index];
      this.selected = [item];
      this.submit_dialog();
      if (this.$root) {
        evntBus.$emit('escEventTriggered');
      }
    },
    close_dialog() {
      this.selected = [];
      this.draftsDialog = false;
    },
    submit_dialog() {
      if (this.selected.length > 0) {
        evntBus.$emit('load_invoice', this.selected[0]);
        this.selected = [];
        this.draftsDialog = false;
      }
    },
    onRowClick(item) {
      this.selected = [item];
      this.submit_dialog();
      if (this.$root) {
        evntBus.$emit('escEventTriggered');
      }
    },
  },
  created: function () {
    evntBus.$on('open_drafts', (data) => {
      if (data && Array.isArray(data)) {
        this.selected = [];
        this.draftsDialog = true;
        this.dialog_data = data;
        this.focusFirstRow();
      } else {
        console.error("Drafts data is undefined or not an array");
      }
    });
    evntBus.$on('open_drafts_old', (data) => {
      this.selected = [];
      this.draftsDialog = true;
      this.dialog_data = data;
      this.focusFirstRow();
      this.get_draft_invoices();
    });
  },
};
</script>

<style scoped>
/* Main Dialog Card */
.drafts-dialog-card {
  border-radius: 16px;
  overflow: hidden;
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  border: 1px solid rgba(25, 118, 210, 0.1);
  transition: all 0.3s ease;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

/* Header Section - White Background with Blue Text */
.drafts-dialog-header {
  background: white;
  color: #1976d2;
  padding: 16px 24px;
  border-bottom: 2px solid rgba(25, 118, 210, 0.1);
  flex-shrink: 0;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon-wrapper {
  background: rgba(25, 118, 210, 0.1);
  border-radius: 50%;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.header-icon {
  font-size: 20px;
  color: #1976d2;
}

.header-text {
  flex: 1;
}

.header-title {
  font-size: 1.3rem;
  font-weight: 600;
  margin: 0;
  line-height: 1.2;
  color: #1976d2;
}

.header-subtitle {
  font-size: 0.85rem;
  opacity: 0.8;
  margin: 2px 0 0 0;
  line-height: 1.3;
  color: #1976d2;
}

/* Content Section - Optimized for minimal scrolling */
.drafts-dialog-content {
  padding: 20px 24px;
  background: white;
  flex: 1;
  overflow-y: auto;
}

.section-header-compact {
  margin-bottom: 12px;
}

.section-title-compact {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 1rem;
  font-weight: 600;
  color: #1976d2;
  margin-bottom: 0;
}

.section-icon {
  color: #1976d2;
  font-size: 18px;
}

/* Enhanced Table - Compact */
.enhanced-table-compact {
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid rgba(25, 118, 210, 0.1);
}

.enhanced-table-compact :deep(.v-data-table__wrapper) {
  border-radius: 8px;
}

.enhanced-table-compact :deep(th) {
  background: linear-gradient(135deg, #f8f9fa 0%, #e3f2fd 100%);
  color: #1976d2;
  font-weight: 600;
  border-bottom: 1px solid rgba(25, 118, 210, 0.1);
  padding: 8px 12px;
}

.enhanced-table-compact :deep(td) {
  padding: 6px 12px;
}

.enhanced-table-compact :deep(tr:hover) {
  background: rgba(25, 118, 210, 0.04);
}

/* Currency and Amount Styling */
.currency-symbol {
  font-weight: 600;
  color: #1976d2;
  font-size: 0.9rem;
}

.amount-value {
  font-weight: 500;
  color: #333;
  font-size: 0.9rem;
}

/* Actions Section */
.dialog-actions-container {
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  border-top: 1px solid #e0e0e0;
  padding: 16px 24px;
  gap: 12px;
}

.pos-action-btn {
  border-radius: 12px;
  text-transform: none;
  font-weight: 600;
  padding: 12px 32px;
  min-width: 120px;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.pos-action-btn,
.pos-action-btn .v-icon,
.pos-action-btn span,
.pos-action-btn :deep(.v-btn__content) {
  color: white !important;
}

.cancel-action-btn {
  background: linear-gradient(135deg, #d32f2f 0%, #c62828 100%) !important;
}

.cancel-action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(211, 47, 47, 0.4);
}

.submit-action-btn {
  background: linear-gradient(135deg, #388e3c 0%, #2e7d32 100%) !important;
}

.submit-action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(46, 125, 50, 0.4);
}

.submit-action-btn:disabled {
  opacity: 0.6;
  transform: none;
}

/* Responsive Design */
@media (max-width: 768px) {
  .drafts-dialog-header {
    padding: 12px 16px;
  }
  .header-content {
    gap: 8px;
  }
  .header-title {
    font-size: 1.2rem;
  }
  .drafts-dialog-content {
    padding: 16px;
  }
  .dialog-actions-container {
    padding: 12px 16px;
  }
  .pos-action-btn {
    padding: 10px 24px;
    min-width: 100px;
  }
}

@media (max-width: 480px) {
  .header-content {
    flex-direction: column;
    text-align: center;
    gap: 8px;
  }
  .drafts-dialog-content {
    padding: 12px;
  }
  .pos-action-btn {
    padding: 8px 16px;
    min-width: 90px;
  }
}

/* Animation Effects */
@keyframes slideInFromTop {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.drafts-dialog-card {
  animation: slideInFromTop 0.4s ease-out;
}

/* Focus and Interaction States */
.enhanced-table-compact :deep(.v-data-table-row--clickable:hover) {
  background: rgba(25, 118, 210, 0.04) !important;
}

.enhanced-table-compact :deep(tr:focus) {
  outline: 1px solid #1976d2;
  outline-offset: -1px;
}
</style>