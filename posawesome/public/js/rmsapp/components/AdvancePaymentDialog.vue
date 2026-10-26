<template>
  <v-row justify="center">
    <v-dialog v-model="dialog" persistent max-width="650">
      <v-card elevation="8" class="advance-dialog-card">

        <!-- Header -->
        <v-card-title class="expense-header pa-6">
          <div class="header-content">
            <div class="header-icon-wrapper">
              <v-icon class="header-icon" size="40">
                mdi-credit-card-plus
              </v-icon>
            </div>

            <div class="header-text">
              <h3 class="header-title">
                {{ __("Create Advance Payment") }}
              </h3>
              <p class="header-subtitle">
                {{ __("Create an advance payment against customer account") }}
              </p>
            </div>
          </div>
        </v-card-title>

        <v-divider></v-divider>

        <v-card-text class="pa-6 white-background">
          <v-form ref="form" v-model="valid">

            <v-row dense>

              <v-col cols="12">
                <v-autocomplete
                  ref="customerField"
                  v-model="customer"
                  :items="customers"
                  item-title="customer_name"
                  item-value="name"
                  :loading="loadingCustomers"
                  :label="__('Customer')"
                  variant="outlined"
                  autofocus
                  density="compact"
                  clearable
                  color="primary"
                  prepend-inner-icon="mdi-account"
                  :rules="[rules.required]"
                  @update:model-value="onCustomerChange"
                />
              </v-col>
              <v-col cols="12">
                <v-autocomplete
                  ref="modeOfPaymentField"
                  v-model="mode_of_payment"
                  :items="payment_methods"
                  item-title="mode_of_payment"
                  item-value="mode_of_payment"
                  :label="__('Mode of Payment')"
                  variant="outlined"
                  density="compact"
                  clearable
                  color="primary"
                  prepend-inner-icon="mdi-cash"
                  :rules="[rules.required]"
                  @update:model-value="onModeOfPaymentChange"
                />
              </v-col>
              <v-col cols="12">
                <v-text-field
                  ref="amountField"
                  @focus="selectAllText"
                  v-model="amount"
                  :label="__('Amount')"
                  type="number"
                  variant="outlined"
                  density="compact"
                  color="primary"
                  prepend-inner-icon="mdi-cash-minus"
                  :rules="[rules.required]"
                />
              </v-col>
              <!-- Previous Customer Balance -->
              <v-col cols="12" v-if="customer">
                <v-text-field
                  :model-value="formtCurrency(customer_outstanding)"
                  :label="__('Previous Balance')"
                  variant="outlined"
                  density="compact"
                  readonly
                  hide-details
                  color="accent"
                  prepend-inner-icon="mdi-cash-sync"
                  :loading="loadingOutstanding"
                />
              </v-col>
              <!-- Difference -->
              <v-col cols="12" v-if="customer">
                <v-text-field
                  :model-value="formtCurrency(balance_difference)"
                  :label="__('Difference')"
                  variant="outlined"
                  density="compact"
                  readonly
                  hide-details
                  :class="balance_difference < 0 ? 'difference-negative' : 'difference-positive'"
                  prepend-inner-icon="mdi-calculator"
                />
              </v-col>
            </v-row>

          </v-form>
        </v-card-text>

        <v-divider></v-divider>

        <v-card-actions class="dialog-actions-container">
          <!-- Submit Only -->
          <v-btn
            color="success"
            class="pos-action-btn submit-action-btn"
            :loading="submitting"
            :disabled="submitting"
            @click="submit(false)"
            size="large"
          >
            <v-icon start>mdi-check-circle-outline</v-icon>
            {{ __("Submit") }}
          </v-btn>
          <!-- Submit & Print -->
          <v-btn
            color="primary"
            class="pos-action-btn"
            :loading="submittingPrint"
            :disabled="submitting || submittingPrint"
            @click="submit(true)"
            size="large"
          >
            <v-icon start>mdi-printer</v-icon>
            {{ __("Submit & Print") }}
          </v-btn>
          <v-spacer></v-spacer>

          <v-btn
            color="error"
            class="pos-action-btn cancel-action-btn"
            @click="close"
            size="large"
          >
            <v-icon start>mdi-close-circle-outline</v-icon>
            {{ __("Cancel") }}
          </v-btn>

        </v-card-actions>

      </v-card>
    </v-dialog>
  </v-row>
</template>

<script>
export default {
  data() {
    return {
      dialog: false,

      customer: null,
      customers: [],

      mode_of_payment: null,
      payment_methods: [],

      amount: 0,

      pos_profile: null,
      pos_opening_shift: "",

      loadingCustomers: false,
      loadingOutstanding: false,

      submitting: false,
      submittingPrint: false,

      customer_outstanding: 0, // Customer balance

      rules: {
        required: v => !!v || __("Required"),
      },
    };
  },
  computed: {
    balance_difference() {
      const amount = parseFloat(this.amount) || 0;
      const outstanding = parseFloat(this.customer_outstanding) || 0;
      return amount - outstanding;
    },
  },
  methods: {
    selectAllText() {
      if (this.$refs.amountField) {
        this.$nextTick(() => {
          this.$refs.amountField.$el.querySelector('input').select();
        });
      }
    },
    open(pos_profile) {
      this.pos_profile = pos_profile;
      this.dialog = true;
      this.fetchCustomers();
      this.fetchPaymentMethods();
      this.fetchOpeningShift();
    },
    fetchOpeningShift() {
      frappe.call({
        method: 'posawesome.posawesome.api.posapp.check_opening_shift',
        args: {
          user: frappe.session.user,
        },
        callback: (r) => {
          this.pos_opening_shift = r.message.pos_opening_shift;
        },
      });
    },
    handleEscKey(event) {
      if (event.key !== "Escape") {
        return;
      }
      if (!this.dialog) {
        return;
      }
      // Don't close while submitting
      if (this.submitting || this.submittingPrint) {
        return;
      }
      // Stop other POS/Frappe keyboard handlers
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.close();
    },
    close() {
      document.removeEventListener("keydown", this.handleEscKey);
      this.dialog = false;
      this.reset();
    },
    reset() {
      this.customer = null;
      this.mode_of_payment = null;
      this.amount = 0;
      this.customer_outstanding = 0;
      this.customers = [];
      this.payment_methods = [];
    },
    fetchCustomers() {
      this.loadingCustomers = true;
      frappe.call({
        method: 'posawesome.posawesome.api.posapp.get_customer_names',
        args: {
          pos_profile: JSON.stringify(this.pos_profile),
        },
        callback: (r) => {
          this.customers = r.message || [];
          this.loadingCustomers = false;
        },
      });
    },
    onCustomerChange(customer) {
      this.customer_outstanding = 0;
      if (!customer) {
        return;
      }
      this.fetchCustomerOutstanding(customer);
      // Move focus to Mode of Payment
      this.$nextTick(() => {
        setTimeout(() => {
          if (this.$refs.modeOfPaymentField) {
            this.$refs.modeOfPaymentField.focus();
          }
        }, 100);
      });
    },
    async fetchCustomerOutstanding(customer) {
      if (!customer || !this.pos_profile) {
        this.customer_outstanding = 0;
        return;
      }
      this.loadingOutstanding = true;
      console.log("Fetching outstanding for:", customer);
      console.log("Company:", this.pos_profile.company);
      try {
        const response = await frappe.call({
          method: "posawesome.posawesome.api.posapp.get_customer_outstanding",
          args: {
            customer: customer,
            company: this.pos_profile.company
          }
        });
        console.log("Outstanding API Response:", response);
        if (response && response.message !== undefined) {
          if (
            typeof response.message === "object" &&
            response.message !== null
          ) {
            this.customer_outstanding =
              parseFloat(response.message.outstanding_amount) || 0;
          } else {
            this.customer_outstanding =
              parseFloat(response.message) || 0;
          }
        } else {
          this.customer_outstanding = 0;
        }
      } catch (err) {
        console.error(
          "Unable to fetch customer outstanding:",
          err
        );
        this.customer_outstanding = 0;
      } finally {
        this.loadingOutstanding = false;
      }
    },
    fetchPaymentMethods() {
      if (this.pos_profile && this.pos_profile.payments) {
        this.payment_methods = this.pos_profile.payments;
      }
    },
    onModeOfPaymentChange(mode) {
      if (!mode) {
        return;
      }
      // Move focus to Amount
      this.$nextTick(() => {
        setTimeout(() => {
      if (this.$refs.amountField) {
            this.$refs.amountField.focus();
          }
        }, 100);
      });
    },
    async submit(print_after_submit = false) {
      if (!(await this.$refs.form.validate()).valid) { // Vuetify 3: validate() is async
        frappe.msgprint(__("Please fill all required fields"));
        return;
      }
      if (print_after_submit) {
        this.submittingPrint = true;
      } else {
        this.submitting = true;
      }
      frappe.call({
        method: "posawesome.posawesome.api.posapp.create_advance_payment",
        args: {
          customer: this.customer,
          mode_of_payment: this.mode_of_payment,
          amount: this.amount,
          currency: this.pos_profile.currency,
          pos_profile: this.pos_profile.name,
          pos_opening_shift: this.pos_opening_shift.name,
        },
        callback: (r) => {
          this.submitting = false;
          this.submittingPrint = false;
          if (!r.exc && r.message) {
            frappe.show_alert({
              message: __("Advance Payment Created"),
              indicator: "green",
            });
            frappe.utils.play_sound("submit");
            // Print only when Submit & Print was clicked
            if (print_after_submit) {
              this.load_print_page(r.message);
            }
            this.close();
          }
        },
        error: () => {
          this.submitting = false;
          this.submittingPrint = false;
        },
      });
    },
    formtCurrency(value) {
      if (value === null || value === undefined) {
        value = 0;
      }
      return new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    },
  },
  created() {
    // document.addEventListener("keydown", this.handleEscKey);
    window.addEventListener(
      "keydown",
      this.handleEscKey,
      true
    );
  },
  beforeUnmount() {
    // document.removeEventListener("keydown", this.handleEscKey);
    window.removeEventListener(
      "keydown",
      this.handleEscKey,
      true
    );
  },
};
</script>
<style>
.difference-negative input {
  color: #f44336 !important;
  font-weight: bold !important;
}

.difference-positive input {
  color: #4caf50 !important;
  font-weight: bold !important;
}

.difference-negative .v-input__prepend-inner .v-icon {
  color: #f44336 !important;
}

.difference-positive .v-input__prepend-inner .v-icon {
  color: #4caf50 !important;
}
</style>