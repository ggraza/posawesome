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
                  v-model="customer"
                  :items="customers"
                  item-title="customer_name"
                  item-value="name"
                  :loading="loadingCustomers"
                  :label="__('Customer')"
                  variant="outlined"
                  density="compact"
                  clearable
                  color="primary"
                  prepend-inner-icon="mdi-account"
                  :rules="[rules.required]"
                />
              </v-col>

              <v-col cols="12">
                <v-autocomplete
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
                />
              </v-col>

              <v-col cols="12">
                <v-text-field
                  v-model="amount"
                  :label="__('Amount')"
                  type="number"
                  variant="outlined"
                  density="compact"
                  color="primary"
                  prepend-inner-icon="mdi-currency-usd"
                  :rules="[rules.required]"
                />
              </v-col>

            </v-row>

          </v-form>
        </v-card-text>

        <v-divider></v-divider>

        <v-card-actions class="dialog-actions-container">

          <v-btn
            color="success"
            class="pos-action-btn submit-action-btn"
            :loading="submitting"
            @click="submit"
            size="large"
          >
            <v-icon start>mdi-check-circle-outline</v-icon>
            {{ __("Submit") }}
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
      loadingCustomers: false,
      submitting: false,
      rules: {
        required: v => !!v || __("Required"),
      },
    };
  },
  methods: {
    open(pos_profile) {
      this.pos_profile = pos_profile;
      this.dialog = true;
      this.fetchCustomers();
      this.fetchPaymentMethods();
    },
    close() {
      this.dialog = false;
      this.reset();
    },
    reset() {
      this.customer = null;
      this.mode_of_payment = null;
      this.amount = 0;
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
    fetchPaymentMethods() {
      if (this.pos_profile && this.pos_profile.payments) {
        this.payment_methods = this.pos_profile.payments;
      }
    },
async submit() {
  if (!(await this.$refs.form.validate()).valid) {
    frappe.msgprint(__("Please fill all required fields"));
    return;
  }

  this.submitting = true;

  frappe.call({
    method: "posawesome.posawesome.api.posapp.create_advance_payment",
    args: {
      customer: this.customer,
      mode_of_payment: this.mode_of_payment,
      amount: this.amount,
      pos_profile: this.pos_profile.name,
    },
    callback: (r) => {
      this.submitting = false;

      if (!r.exc && r.message) {
        this.load_print_page(r.message);

        frappe.show_alert({
          message: __("Advance Payment Created"),
          indicator: "green",
        });

        frappe.utils.play_sound("submit");
        this.close();
      }
    },
    error: () => {
      this.submitting = false;
    },
  });
},
load_print_page(payment_name) {
  const print_format =
    this.pos_profile.custom_payment_entry_print_format || "Standard";

  const letter_head = this.pos_profile.letter_head || 0;

  const url =
    frappe.urllib.get_base_url() +
    "/printview?doctype=Payment Entry" +
    "&name=" + encodeURIComponent(payment_name) +
    "&trigger_print=1" +
    "&format=" + encodeURIComponent(print_format) +
    "&no_letterhead=" + letter_head;

  const printWindow = window.open(url, "Print");

  printWindow.addEventListener(
    "load",
    function () {
      printWindow.print();
    },
    true
  );
},
async submits() {
  if (!(await this.$refs.form.validate()).valid) {
    frappe.msgprint(__("Please fill all required fields"));
    return;
  }

  this.submitting = true;

  frappe.call({
    method: "posawesome.posawesome.api.posapp.create_advance_payment",
    args: {
      customer: this.customer,
      mode_of_payment: this.mode_of_payment,
      amount: this.amount,
      pos_profile: this.pos_profile.name,
    },
    callback: (r) => {
      this.submitting = false;

      if (!r.exc) {
        frappe.show_alert({
          message: __("Advance Payment Created"),
          indicator: "green",
        });
        frappe.utils.play_sound("submit");

        this.close();
      }
    },
    error: () => {
      this.submitting = false;
    },
  });
},
    submit_old() {
      if (!this.customer || !this.mode_of_payment || !this.amount) {
        frappe.msgprint(__('Please fill all fields'));
        return;
      }
      this.submitting = true;
      frappe.call({
        method: 'posawesome.posawesome.api.posapp.create_advance_payment',
        args: {
          customer: this.customer,
          mode_of_payment: this.mode_of_payment,
          amount: this.amount,
          pos_profile: this.pos_profile.name,
        },
        callback: (r) => {
          this.submitting = false;
          if (!r.exc) {
            frappe.show_alert({
              message: __('Advance Payment Created'),
              indicator: 'green',
            });
            this.close();
          }
        },
      });
    },
  },
};
</script>