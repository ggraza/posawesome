<template>
  <v-row justify="center">
    <v-dialog v-model="closingDialog" max-width="900px" persistent @click:outside="close_dialog" max-height="90vh">
      <v-card elevation="8" class="closing-dialog-card">
        <!-- Header Section - White Background with Blue Text -->
        <v-card-title class="closing-dialog-header">
          <div class="header-content">
            <div class="header-icon-wrapper">
              <v-icon class="header-icon">mdi-content-save-move-outline</v-icon>
            </div>
            <div class="header-text">
              <h5 class="header-title">{{ __('Closing POS Shift') }}</h5>
              <p class="header-subtitle">{{ __('Finalize your shift with closing balances') }}</p>
            </div>
          </div>
        </v-card-title>

        <!-- Content Section - Optimized for minimal scrolling -->
        <v-card-text class="closing-dialog-content">
          <v-container class="pa-0">
            <v-row>
              <!-- Payment Denomination Section - Compact -->
              <v-col cols="12">
                <div class="section-header-compact">
                  <h6 class="section-title-compact">
                    <v-icon class="section-icon">mdi-credit-card-multiple</v-icon>
                    {{ __('Closing Cash Denominations') }}
                  </h6>
                </div>
                <v-data-table
                  :headers="payments_denominations_headers"
                  :items="dialog_data.denomination_details"
                  item-value="mode_of_denomination"
                  class="enhanced-table-compact"
                  :items-per-page="itemsPerPage"
                  hide-default-footer
                  density="compact"
                  fixed-header
                  return-object
                >
                  <template v-slot:item.opening_qty="{ item }">
                    {{ formtFloat(item.opening_qty) }}
                  </template>
                  <template v-slot:item.opening_cash="{ item }">
                    <span class="currency-symbol">{{ currencySymbol(pos_profile.currency) }}</span>
                    <span class="amount-value">{{ formtCurrency(item.opening_cash) }}</span>
                  </template>
                  <template v-slot:item.closing_qty="props">
                    <v-text-field
                      v-model="props.item.closing_qty"
                      :rules="[v => v >= 0 || 'Quantity cannot be negative']"
                      :label="frappe._('Count')"
                      density="compact"
                      single-line
                      counter
                      hide-details
                      type="number"
                      class="amount-input"
                      @update:model-value="updateDenomination(props.item)"
                    ></v-text-field>
                  </template>
                  <template v-slot:item.closing_cash="{ item }">
                    <span class="currency-symbol">{{ currencySymbol(pos_profile.currency) }}</span>
                    <span class="amount-value">{{ (item.closing_cash = formtCurrency(item.mode_of_denomination * item.closing_qty)) }}</span>
                  </template>
                </v-data-table>
              </v-col>

              <!-- Payment Reconciliation Section - Compact -->
              <v-col cols="12">
                <div class="section-header-compact">
                  <h6 class="section-title-compact">
                    <v-icon class="section-icon">mdi-credit-card-multiple</v-icon>
                    {{ __('Payment Reconciliation') }}
                  </h6>
                </div>
                <v-data-table
                  :headers="headers"
                  :items="dialog_data.payment_reconciliation"
                  item-value="mode_of_payment"
                  class="enhanced-table-compact"
                  :items-per-page="itemsPerPage"
                  hide-default-footer
                  density="compact"
                  fixed-header
                  return-object
                >
                  <template v-slot:item.closing_amount="props">
                    <v-text-field
                        v-model="props.item.closing_amount"
                        :prefix="currencySymbol(pos_profile.currency)"
                        density="compact"
                        variant="underlined"
                        single-line
                        hide-details
                        type="number"
                        class="amount-input"
                      ></v-text-field>
                  </template>
                  <template v-slot:item.difference="{ item }">
                    <span class="currency-symbol">{{ currencySymbol(pos_profile.currency) }}</span>
                    <span class="amount-value">{{ (item.difference = formtCurrency(item.expected_amount - item.expense_amount - item.closing_amount)) }}</span>
                  </template>
                  <template v-slot:item.opening_amount="{ item }">
                    <span class="currency-symbol">{{ currencySymbol(pos_profile.currency) }}</span>
                    <span class="amount-value">{{ formtCurrency(item.opening_amount) }}</span>
                  </template>
                  <template v-slot:item.expected_amount="{ item }">
                    <span class="currency-symbol">{{ currencySymbol(pos_profile.currency) }}</span>
                    <span class="amount-value">{{ formtCurrency(item.expected_amount) }}</span>
                  </template>
                  <template v-slot:item.sale_amount="{ item }">
                    <span class="currency-symbol">{{ currencySymbol(pos_profile.currency) }}</span>
                    <span class="amount-value">{{ (item.sale = formtCurrency(item.expected_amount - item.opening_amount)) }}</span>
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
          >
            <v-icon start>mdi-check-circle-outline</v-icon>
            <span>{{ __('Submit') }}</span>
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
    closingDialog: false,
    itemsPerPage: 20,
    dialog_data: {},
    pos_profile: '',
    pos_opening_shift: "",
    total_expense: 0,
    expense_amount: 0,
    payments_denomination_data: [],
    payments_denominations: [],
    payments_denominations_headers: [
      {
        title: __('Mode of Denomination'),
        align: 'start',
        sortable: false,
        key: 'mode_of_denomination',
      },
      {
        title: __('Opening Count'),
        key: 'opening_qty',
        align: 'end',
        sortable: false,
      },
      {
        title: __('Opening Amount'),
        key: 'opening_cash',
        align: 'end',
        sortable: false,
      },
      {
        title: __('Closing Count'),
        key: 'closing_qty',
        align: 'end',
        sortable: false,
      },
      {
        title: __('Closing Amount'),
        key: 'closing_cash',
        align: 'end',
        sortable: false,
      },
    ],
    total_denomination: 0,
    headers: [
      {
        title: __('Mode of Payment'),
        key: 'mode_of_payment',
        align: 'start',
        sortable: true,
      },
      {
        title: __('Opening Amount'),
        align: 'end',
        sortable: true,
        key: 'opening_amount',
      },
      {
        title: __('Expense Amount'),
        key: 'expense_amount',
        align: 'end',
        sortable: true,
      },
      {
        title: __('Closing Amount'),
        key: 'closing_amount',
        align: 'end',
        sortable: true,
      },
    ],
    max25chars: (v) => v.length <= 20 || 'Input too long!',
    pagination: {},
  }),
  watch: {},
  methods: {
    calculateExpenseAmount() {
      frappe.call({
        method: "frappe.client.get_list",
        args: {
          doctype: "POS Expense Invoice",
          fields: ["mode_of_payment", "total_expense"],
          filters: {
            pos_opening_shift: this.pos_opening_shift.name || '',
            docstatus: 1
          },
          limit_page_length: 0
        },
        callback: (r) => {
          if (r.message) {

            // reset all expense amounts first
            this.dialog_data.payment_reconciliation.forEach(payment => {
              payment.expense_amount = 0;
            });

            // group expense by mode_of_payment
            const expenseMap = {};

            r.message.forEach(row => {
              const mode = row.mode_of_payment || "Cash";

              if (!expenseMap[mode]) {
                expenseMap[mode] = 0;
              }

              expenseMap[mode] += flt(row.total_expense);
            });

            // assign expense against matching payment mode
            this.dialog_data.payment_reconciliation.forEach(payment => {
              payment.expense_amount = expenseMap[payment.mode_of_payment] || 0;
            });

            // optional total expense
            this.total_expense = Object.values(expenseMap)
              .reduce((a, b) => a + b, 0);
          }
        },
      });
    },
    calculateExpenseAmount_cash() {
      frappe.call({
        method: "frappe.client.get_list",
        args: {
          doctype: "POS Expense Invoice",
          fields: ["total_expense"],
          filters: {
            pos_opening_shift: this.pos_opening_shift.name || '',
            docstatus: 1
          },
        },
        callback: (r) => {
          if (r.message) {
            this.total_expense = r.message.reduce((total, row) => total + row.total_expense, 0);
            const cashMode = this.pos_profile?.posa_cash_mode_of_payment || 'Cash';
            const cashPayment = this.dialog_data.payment_reconciliation.find(
//              (payment) => payment.mode_of_payment === 'Cash'
              (payment) => payment.mode_of_payment === cashMode
            );
            if (cashPayment) {
              cashPayment.expense_amount = this.total_expense;
            }
          }
        },
      });
    },
    updateDenomination(item) {
      const denominationValue = this.getDenominationValue(item.mode_of_denomination);
      item.closing_qty = Math.max(0, item.closing_qty);
      item.closing_cash = this.formtCurrency(denominationValue * item.closing_qty);
      this.calculateDenominationTotal();
    },
    getDenominationValue(mode_of_denomination) {
      const denomination = this.dialog_data.denomination_details.find(
        (denom) => denom.mode_of_denomination === mode_of_denomination
      );
      return denomination ? parseFloat(denomination.value) : 0;
    },
    calculateDenominationTotal() {
      let total = 0;
      this.dialog_data.denomination_details.forEach((denomination) => {
        total += denomination.mode_of_denomination * denomination.closing_qty;
      });
      this.total_denomination = total;
      const cashMode = this.pos_profile?.posa_cash_mode_of_payment || 'Cash';
      const cashPayment = this.dialog_data.payment_reconciliation.find(
        // (payment) => payment.mode_of_payment === 'Cash'
        (payment) => payment.mode_of_payment === cashMode
      );
      if (cashPayment) {
        cashPayment.closing_amount = this.total_denomination;
      }
    },
    close_dialog() {
      this.closingDialog = false;
      if (this.$root) {
        evntBus.$emit('escEventTriggered');
      }
    },
    submit_dialog() {
      evntBus.$emit('submit_closing_pos', this.dialog_data);
      this.closingDialog = false;
    },
    get_draft_invoices() {
      frappe.call({
        method: "posawesome.posawesome.api.posapp.get_draft_invoices",
        args: {
          pos_opening_shift: this.pos_opening_shift.name,
        },
        async: false,
        callback: function (r) {
          if (r.message) {
            evntBus.$emit("open_drafts", r.message);
          }
        },
      });
    },
    openClosingDialog(data) {
      this.closingDialog = true;
      this.dialog_data = data;
      // this.calculateExpenseAmount();
      this.$nextTick(() => {
        if (this.pos_profile) {
          this.calculateExpenseAmount();
        }
      });
    },
  },
  created: function () {
    evntBus.$on('open_ClosingDialog', this.openClosingDialog);
    evntBus.$on('open_ClosingDialoga', (data) => {
      this.closingDialog = true;
      this.dialog_data = data;
      this.calculateExpenseAmount();
    });
    evntBus.$on('register_pos_profile', (data) => {
      this.pos_profile = data.pos_profile;
      this.pos_opening_shift = data.pos_opening_shift;
      if (!this.pos_profile.hide_expected_amount) {
        this.headers.push({
          text: __('Expected Amount'),
          value: 'expected_amount',
          align: 'end',
          sortable: false,
        });
        this.headers.push({
          text: __('Difference'),
          value: 'difference',
          align: 'end',
          sortable: false,
        });
      }
      if (!this.pos_profile.hide_sale_amount) {
        this.headers.push({
          text: __('Sale Amount'),
          align: 'end',
          sortable: true,
          value: 'sale_amount',
        });
      }
    });
  },
};
</script>

<style scoped>
/* Main Dialog Card */
.closing-dialog-card {
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
.closing-dialog-header {
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
.closing-dialog-content {
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

/* Amount Editor - Compact */
.amount-display-compact {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  padding: 4px 8px;
  background: rgba(25, 118, 210, 0.05);
  border-radius: 6px;
  transition: all 0.3s ease;
  cursor: pointer;
  min-height: 32px;
}

.amount-display-compact:hover {
  background: rgba(25, 118, 210, 0.1);
  transform: scale(1.01);
}

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

.amount-input {
  margin-top: 4px;
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

/* Responsive Design */
@media (max-width: 768px) {
  .closing-dialog-header {
    padding: 12px 16px;
  }
  .header-content {
    gap: 8px;
  }
  .header-title {
    font-size: 1.2rem;
  }
  .closing-dialog-content {
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
  .closing-dialog-content {
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

.closing-dialog-card {
  animation: slideInFromTop 0.4s ease-out;
}

/* Focus and Interaction States */
.enhanced-table-compact :deep(.v-data-table-row--clickable:hover) {
  background: rgba(25, 118, 210, 0.04) !important;
}
</style>