<template>
  <v-row justify="center">
    <v-dialog v-model="isOpen" persistent max-width="600px">
      <!-- <template v-slot:activator="{ on, attrs }">
        <v-btn color="primary" dark v-bind="attrs" v-on="on">Open Dialog</v-btn>
      </template>-->
      <v-card>
        <v-card-title>
          <span class="headline primary--text">{{
            __('Create POS Opening Shift')
          }}</span>
        </v-card-title>
        <v-card-text>
          <v-container>
            <v-row>
              <v-col cols="12">
                <v-autocomplete
                  :items="companies"
                  :label="frappe._('Company')"
                  v-model="company"
                  required
                ></v-autocomplete>
              </v-col>
              <v-col cols="12">
                <v-autocomplete
                  :items="pos_profiles"
                  :label="frappe._('POS Profile')"
                  v-model="pos_profile"
                  required
                ></v-autocomplete>
              </v-col>

              <v-col cols="12">
                <template>
                  <v-data-table
                    :headers="payments_denominations_headers"
                    :items="payments_denominations"
                    item-key="mode_of_denomination"
                    class="elevation-1"
                    :items-per-page="itemsPerPage"
                    hide-default-footer
                  >
                    <template v-slot:item.qty="props">
                      <!-- <v-edit-dialog :return-value.sync="props.item.qty"> -->
                        <!-- {{ formtFloat(props.item.qty) }} -->
                        <!-- <template v-slot:input> -->
                          <v-text-field
                            v-model="props.item.qty"
                            :rules="[v => v >= 0 || 'Quantity cannot be negative']"
                            :label="frappe._('Count')"
                            dense
                            single-line
                            counter
                            hide-details
                            type="number"
                            @input="updateDenomination(props.item)"
                          ></v-text-field>	
                        <!-- </template> -->
                      <!-- </v-edit-dialog> -->
                    </template>
                    <template v-slot:item.amount="{ item }">
                      {{ currencySymbol(pos_profile.currency) }}
                      {{ (item.amount = formtCurrency(item.mode_of_denomination * item.qty)) }}
                    </template>
                  </v-data-table>
                </template>
              </v-col>
              <v-col cols="12">
                <template>
                  <v-data-table
                    :headers="payments_methods_headers"
                    :items="payments_methods"
                    item-key="mode_of_payment"
                    class="elevation-1"
                    :items-per-page="itemsPerPage"
                    hide-default-footer
                  >
                    <template v-slot:item.amount="props">
                      <v-edit-dialog :return-value.sync="props.item.amount">
                        {{ currencySymbol(props.item.currency) }}
                        {{ formtCurrency(props.item.amount) }}
                        <template v-slot:input>
                          <v-text-field
                            v-model="props.item.amount"
                            :rules="[max25chars]"
                            :label="frappe._('Edit')"
                            single-line
                            counter
                            type="number"
                          ></v-text-field>
                        </template>
                      </v-edit-dialog>
                    </template>
                  </v-data-table>
                </template>
              </v-col>
            </v-row>
          </v-container>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="error" dark @click="go_desk">Cancel</v-btn>
          <v-btn
            color="success"
            :disabled="is_loading"
            dark
            @click="submit_dialog"
            >Submit</v-btn
          >
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
  props: ['dialog'],
  data() {
    return {
      isOpen: this.dialog ? this.dialog : false,
      dialog_data: {},
      is_loading: false,
      companies: [],
      company: '',
      pos_profiles_data: [],
      pos_profiles: [],
      pos_profile: '',
      payments_denomination_data: [],
      payments_denominations: [],
      payments_denominations_headers: [
        {
          text: __('Mode of Denomination'),
          align: 'start',
          sortable: false,
          value: 'mode_of_denomination',
        },
        {
          text: __('Opening Count'),
          value: 'qty',
          align: 'end',
          sortable: false,
        },
        {
          text: __('Opening Amount'),
          value: 'amount',
          align: 'end',
          sortable: false,
        },
      ],
      total_denomination: 0,
      payments_method_data: [],
      payments_methods: [],
      payments_methods_headers: [
        {
          text: __('Mode of Payment'),
          align: 'start',
          sortable: false,
          value: 'mode_of_payment',
        },
        {
          text: __('Opening Amount'),
          value: 'amount',
          align: 'center',
          sortable: false,
        },
      ],
      itemsPerPage: 100,
      max25chars: (v) => v.length <= 12 || 'Input too long!', // TODO : should validate as number
      pagination: {},
      snack: false, // TODO : need to remove
      snackColor: '', // TODO : need to remove
      snackText: '', // TODO : need to remove
    };
  },
  watch: {
    company(val) {
      this.pos_profiles = [];
      this.pos_profiles_data.forEach((element) => {
        if (element.company === val) {
          this.pos_profiles.push(element.name);
        }
        if (this.pos_profiles.length) {
          this.pos_profile = this.pos_profiles[0];
        } else {
          this.pos_profile = '';
        }
      });
    },
    pos_profile(val) {
      this.payments_methods = [];
      this.payments_method_data.forEach((element) => {
        if (element.parent === val) {
          this.payments_methods.push({
            mode_of_payment: element.mode_of_payment,
            amount: 0,
            currency: element.currency,
          });
        }
      });
      this.payments_denominations = [];
      this.payments_denominations_data.forEach((element) => {
        if (element.parent === val) {
          this.payments_denominations.push({
            mode_of_denomination: element.mode_of_denomination,
            qty: 0,
            amount: 0,
          });
        }
      });
      this.calculateDenominationTotal();
    },
  },
  methods: {
    updateDenomination(item) {
      // Ensure qty is non-negative
      //item.qty = Math.max(0, item.qty);
    
      // Update the amount
      //item.amount = this.formtCurrency(item.mode_of_denomination * item.qty);
      const denominationValue = this.getDenominationValue(item.mode_of_denomination);

      item.qty = Math.max(0, item.qty); // Ensure qty is non-negative
      item.amount = this.formtCurrency(denominationValue * item.qty);
      this.calculateDenominationTotal();
    },
    getDenominationValue(mode_of_denomination) {
      const denomination = this.payments_denominations_data.find(
        (denom) => denom.mode_of_denomination === mode_of_denomination
      );
      return denomination ? parseFloat(denomination.value) : 0;
    },
    calculateDenominationTotal() {
      let total = 0;
      // Calculate total denomination sum
      this.payments_denominations.forEach((denomination) => {
        total += denomination.mode_of_denomination * denomination.qty;
      });

      this.total_denomination = total;

      // Update "Cash" payment method amount
      const cashPayment = this.payments_methods.find(
        (payment) => payment.mode_of_payment === 'Cash'
      );
      if (cashPayment) {
        cashPayment.amount = this.total_denomination;
      }
    },
    close_opening_dialog() {
      evntBus.$emit('close_opening_dialog');
    },
    get_opening_dialog_data() {
      const vm = this;
      frappe.call({
        method: 'posawesome.posawesome.api.posapp.get_opening_dialog_data',
        args: {},
        callback: function (r) {
          if (r.message) {
            console.log("API Response:", r.message);  // Add this line to inspect the response
            r.message.companies.forEach((element) => {
              vm.companies.push(element.name);
            });
            vm.company = vm.companies[0];
            vm.pos_profiles_data = r.message.pos_profiles_data;
            vm.payments_method_data = r.message.payments_method;
            vm.payments_denominations_data = r.message.payments_denomination;
            vm.payments_denominations_data.sort((a, b) => {
              return b.mode_of_denomination - a.mode_of_denomination;
            });
            vm.payments_denominations = vm.payments_denominations_data.map(element => ({
              mode_of_denomination: element.mode_of_denomination,
              qty: 0,
              amount: 0,
            }));
            vm.calculateDenominationTotal();
            console.log("Payments Method Data", r.message.payments_method);
            console.log("Payments Denominations Data", r.message.payments_denomination);
          }
        },
      });
    },
    submit_dialog() {
      if (!this.payments_methods.length || !this.company || !this.pos_profile) {
        return;
      }
      // Ensure that amounts are correctly calculated
      this.payments_denominations.forEach(denomination => {
        denomination.amount = denomination.mode_of_denomination * denomination.qty;
      });
      this.is_loading = true;
      const vm = this;
      // Convert the data to JSON strings before submitting
      const balance_details = JSON.stringify(this.payments_methods);
      const denomination_details = JSON.stringify(this.payments_denominations);
      console.log("balance_details:", balance_details);
      console.log("denomination_details:", denomination_details);
      console.log("Denomination Details:", this.payments_denominations);
      return frappe
        .call('posawesome.posawesome.api.posapp.create_opening_voucher', {
          pos_profile: this.pos_profile,
          company: this.company,
          balance_details: balance_details,
          denomination_details: denomination_details,
        })
        .then((r) => {
          if (r.message) {
            evntBus.$emit('register_pos_data', r.message);
            evntBus.$emit('set_company', r.message.company);
            vm.close_opening_dialog();
            is_loading = false;
          }
        });
    },
    go_desk() {
      frappe.set_route('/');
      location.reload();
    },
  },
  created: function () {
    this.$nextTick(function () {
      this.get_opening_dialog_data();
    });
  },
};
</script>
