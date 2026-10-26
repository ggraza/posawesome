<template>
  <v-row justify="center">
    <v-dialog v-model="dialog" persistent max-width="650">
      <v-card elevation="8" class="advance-dialog-card">

        <!-- Header -->
        <v-card-title class="expense-header pa-6">
          <div class="header-content">
            <div class="header-icon-wrapper">
              <v-icon class="header-icon" size="40">
                mdi-cash-minus
              </v-icon>
            </div>

            <div class="header-text">
              <h3 class="header-title">
                {{ __("Pay Supplier") }}
              </h3>

              <p class="header-subtitle">
                {{ __("Create a payment against supplier account") }}
              </p>
            </div>
          </div>
        </v-card-title>

        <v-divider></v-divider>

        <v-card-text class="pa-6 white-background">
          <v-form ref="form" v-model="valid">

            <v-row dense>

              <!-- Supplier -->
              <v-col cols="12">
                <v-autocomplete
                  ref="supplierField"
                  v-model="supplier"
                  :items="suppliers"
                  item-title="supplier_name"
                  item-value="name"
                  :loading="loadingSuppliers"
                  :label="__('Supplier')"
                  variant="outlined"
                  autofocus
                  density="compact"
                  clearable
                  color="primary"
                  prepend-inner-icon="mdi-account-hard-hat"
                  :rules="[rules.required]"
                  @update:model-value="onSupplierChange"
                />
              </v-col>

              <!-- Mode of Payment -->
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

              <!-- Amount -->
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

              <!-- Previous Supplier Payable -->
              <v-col cols="12" v-if="supplier">
                <v-text-field
                  :model-value="formtCurrency(supplier_outstanding)"
                  :label="__('Previous Payable')"
                  variant="outlined"
                  density="compact"
                  readonly
                  hide-details
                  color="accent"
                  prepend-inner-icon="mdi-cash-sync"
                  :loading="loadingOutstanding"
                />
              </v-col>

              <!-- Remaining Payable -->
              <v-col cols="12" v-if="supplier">
                <v-text-field
                  :model-value="formtCurrency(remaining_payable)"
                  :label="__('Remaining Payable')"
                  variant="outlined"
                  density="compact"
                  readonly
                  hide-details
                  :class="
                    remaining_payable < 0
                      ? 'difference-negative'
                      : 'difference-positive'
                  "
                  prepend-inner-icon="mdi-calculator"
                />
              </v-col>

            </v-row>

          </v-form>
        </v-card-text>

        <v-divider></v-divider>

        <v-card-actions class="dialog-actions-container">

          <!-- Submit -->
          <v-btn
            color="success"
            class="pos-action-btn submit-action-btn"
            :loading="submitting"
            :disabled="submitting || submittingPrint"
            @click="submit(false)"
            size="large"
          >
            <v-icon start>
              mdi-check-circle-outline
            </v-icon>

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
            <v-icon start>
              mdi-printer
            </v-icon>

            {{ __("Submit & Print") }}
          </v-btn>

          <v-spacer></v-spacer>

          <!-- Cancel -->
          <v-btn
            color="error"
            class="pos-action-btn cancel-action-btn"
            @click="close"
            size="large"
          >
            <v-icon start>
              mdi-close-circle-outline
            </v-icon>

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
      valid: false,

      supplier: null,
      suppliers: [],

      mode_of_payment: null,
      payment_methods: [],

      amount: 0,

      pos_profile: null,
      pos_opening_shift: "",

      loadingSuppliers: false,
      loadingOutstanding: false,

      submitting: false,
      submittingPrint: false,

      supplier_outstanding: 0,

      rules: {
        required: v => !!v || __("Required"),
      },
    };
  },

  computed: {
    remaining_payable() {
      const amount = parseFloat(this.amount) || 0;
      const outstanding =
        parseFloat(this.supplier_outstanding) || 0;

      return amount + outstanding;
    },
  },

  methods: {

    selectAllText() {
      if (this.$refs.amountField) {
        this.$nextTick(() => {
          const input =
            this.$refs.amountField.$el.querySelector("input");

          if (input) {
            input.select();
          }
        });
      }
    },

    open(pos_profile) {
      this.pos_profile = pos_profile;
      this.dialog = true;

      this.fetchSuppliers();
      this.fetchPaymentMethods();
      this.fetchOpeningShift();
    },

    fetchOpeningShift() {
      frappe.call({
        method:
          "posawesome.posawesome.api.posapp.check_opening_shift",

        args: {
          user: frappe.session.user,
        },

        callback: (r) => {
          if (r.message) {
            this.pos_opening_shift =
              r.message.pos_opening_shift;
          }
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

      if (this.submitting || this.submittingPrint) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      this.close();
    },

    close() {
      document.removeEventListener(
        "keydown",
        this.handleEscKey
      );

      this.dialog = false;
      this.reset();
    },

    reset() {
      this.supplier = null;
      this.mode_of_payment = null;
      this.amount = 0;
      this.supplier_outstanding = 0;

      this.suppliers = [];
      this.payment_methods = [];
    },

    fetchSuppliers() {
      this.loadingSuppliers = true;

      frappe.call({
        method:
          "posawesome.posawesome.api.posapp.get_supplier_names",

        args: {
          pos_profile: JSON.stringify(
            this.pos_profile
          ),
        },

        callback: (r) => {
          this.suppliers = r.message || [];
          this.loadingSuppliers = false;
        },

        error: () => {
          this.loadingSuppliers = false;
        },
      });
    },

    onSupplierChange(supplier) {
      this.supplier_outstanding = 0;

      if (!supplier) {
        return;
      }

      this.fetchSupplierOutstanding(supplier);

      this.$nextTick(() => {
        setTimeout(() => {
          if (this.$refs.modeOfPaymentField) {
            this.$refs.modeOfPaymentField.focus();
          }
        }, 100);
      });
    },

    async fetchSupplierOutstanding(supplier) {
      if (!supplier || !this.pos_profile) {
        this.supplier_outstanding = 0;
        return;
      }

      this.loadingOutstanding = true;

      try {
        const response = await frappe.call({
          method:
            "posawesome.posawesome.api.posapp.get_supplier_outstanding",

          args: {
            supplier: supplier,
            company: this.pos_profile.company,
          },
        });

        if (
          response &&
          response.message !== undefined
        ) {
          if (
            typeof response.message === "object" &&
            response.message !== null
          ) {
            this.supplier_outstanding =
              parseFloat(
                response.message.outstanding_amount
              ) || 0;
          } else {
            this.supplier_outstanding =
              parseFloat(response.message) || 0;
          }
        } else {
          this.supplier_outstanding = 0;
        }

      } catch (err) {
        console.error(
          "Unable to fetch supplier outstanding:",
          err
        );

        this.supplier_outstanding = 0;

      } finally {
        this.loadingOutstanding = false;
      }
    },

    fetchPaymentMethods() {
      if (
        this.pos_profile &&
        this.pos_profile.payments
      ) {
        this.payment_methods =
          this.pos_profile.payments;
      }
    },

    onModeOfPaymentChange(mode) {
      if (!mode) {
        return;
      }

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
        frappe.msgprint(
          __("Please fill all required fields")
        );

        return;
      }

      const amount =
        parseFloat(this.amount) || 0;

      if (amount <= 0) {
        frappe.msgprint(
          __("Amount must be greater than zero")
        );

        return;
      }

       if (
        this.supplier_outstanding > 0 &&
        amount > this.supplier_outstanding
      ) {
        frappe.msgprint(
          __("Payment cannot be greater than supplier payable")
        );
        return;
      }

      if (print_after_submit) {
        this.submittingPrint = true;
      } else {
        this.submitting = true;
      }

      frappe.call({

        method:
          "posawesome.posawesome.api.posapp.create_supplier_payment",

        args: {
          supplier: this.supplier,
          mode_of_payment: this.mode_of_payment,
          amount: amount,
          currency: this.pos_profile.currency,
          pos_profile: this.pos_profile.name,
          pos_opening_shift: this.pos_opening_shift.name,
        },

        callback: (r) => {

          this.submitting = false;
          this.submittingPrint = false;

          if (!r.exc && r.message) {

            frappe.show_alert({
              message: __(
                "Supplier Payment Created"
              ),

              indicator: "green",
            });

            frappe.utils.play_sound(
              "submit"
            );

            if (print_after_submit) {
              this.load_print_page(
                r.message
              );
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
      if (
        value === null ||
        value === undefined
      ) {
        value = 0;
      }

      return new Intl.NumberFormat(
        undefined,
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }
      ).format(value);
    },
  },

  created() {
    window.addEventListener(
      "keydown",
      this.handleEscKey,
      true
    );
  },

  beforeUnmount() {
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

.difference-negative
.v-input__prepend-inner
.v-icon {
  color: #f44336 !important;
}

.difference-positive
.v-input__prepend-inner
.v-icon {
  color: #4caf50 !important;
}

.white-background {
  background: #ffffff;
}
</style>
