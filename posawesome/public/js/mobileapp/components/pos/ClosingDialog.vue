<template>
  <v-row justify="center">
    <v-dialog v-model="closingDialog" max-width="900px" persistent @click:outside="close_dialog">
      <v-card>
        <v-card-title>
          <span class="headline primary--text">{{
            __('Closing POS Shift')
          }}</span>
        </v-card-title>
        <v-card-text class="pa-0">
          <v-container>
            <v-row>

              <v-col cols="12">
                <template>
                  <v-data-table
                    :headers="payments_denominations_headers"
                    :items="dialog_data.denomination_details"
                    item-key="mode_of_denomination"
                    class="elevation-1"
                    :items-per-page="itemsPerPage"
                    hide-default-footer
                  >
                    <template v-slot:item.opening_qty="{ item }">
                      {{ formtFloat(item.opening_qty) }}
                    </template>
                    <template v-slot:item.opening_cash="{ item }">
                      {{ currencySymbol(pos_profile.currency) }}{{ formtCurrency(item.opening_cash) }}
                    </template>
                    <template v-slot:item.closing_qty="props">
                      <v-text-field
                        v-model="props.item.closing_qty"
                        :rules="[v => v >= 0 || 'Quantity cannot be negative']"
                        :label="frappe._('Count')"
                        dense
                        single-line
                        counter
                        hide-details
                        type="number"
                        @input="updateDenomination(props.item)"
                      ></v-text-field>	
                    </template>
                    <template v-slot:item.closing_cash="{ item }">
                      {{ currencySymbol(pos_profile.currency) }}
                      {{ (item.closing_cash = formtCurrency(item.mode_of_denomination * item.closing_qty)) }}
                    </template>
                  </v-data-table>
                </template>
              </v-col>

              <v-col cols="12" class="pa-1">
                <template>
                  <v-data-table
                    :headers="headers"
                    :items="dialog_data.payment_reconciliation"
                    item-key="mode_of_payment"
                    class="elevation-1"
                    :items-per-page="itemsPerPage"
                    hide-default-footer
                  >
                    <template v-slot:item.closing_amount="props">
                      <v-edit-dialog :return-value.sync="props.item.closing_amount">
                        {{ currencySymbol(pos_profile.currency) }}
                        {{ formtCurrency(props.item.closing_amount) }}
                        <template v-slot:input>
                          <v-text-field
                            v-model="props.item.closing_amount"
                            :rules="[max25chars]"
                            :label="frappe._('Edit')"
                            single-line
                            counter
                            type="number"
                          ></v-text-field>
                        </template>
                      </v-edit-dialog>
                    </template>
                    <template v-slot:item.difference="{ item }">
                      {{ currencySymbol(pos_profile.currency) }}
                      {{ (item.difference = formtCurrency(item.expected_amount - item.closing_amount)) }}
                    </template>
                    <template v-slot:item.opening_amount="{ item }">
                      {{ currencySymbol(pos_profile.currency) }}
                      {{ formtCurrency(item.opening_amount) }}
                    </template>
                    <template v-slot:item.expected_amount="{ item }">
                      {{ currencySymbol(pos_profile.currency) }}
                      {{ formtCurrency(item.expected_amount) }}
                    </template>
                    <template v-slot:item.sale_amount="{ item }">
                      {{ currencySymbol(pos_profile.currency) }}
                      {{ (item.sale = formtCurrency(item.expected_amount - item.opening_amount)) }}
                    </template>
                  </v-data-table>
                </template>
              </v-col>
            </v-row>
          </v-container>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="error" dark @click="close_dialog">{{ __('Close') }}</v-btn>
          <v-btn color="success" dark @click="submit_dialog">{{ __('Submit') }}</v-btn>
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
          value: 'opening_qty',
          align: 'end',
          sortable: false,
        },
        {
          text: __('Opening Amount'),
          value: 'opening_cash',
          align: 'end',
          sortable: false,
        },
        {
          text: __('Closing Count'),
          value: 'closing_qty',
          align: 'end',
          sortable: false,
        },
        {
          text: __('Closing Amount'),
          value: 'closing_cash',
          align: 'end',
          sortable: false,
        },
      ],
      total_denomination: 0,

    headers: [
      {
        text: __('Mode of Payment'),
        value: 'mode_of_payment',
        align: 'start',
        sortable: true,
      },
      {
        text: __('Opening Amount'),
        align: 'end',
        sortable: true,
        value: 'opening_amount',
      },
      {
        text: __('Closing Amount'),
        value: 'closing_amount',
        align: 'end',
        sortable: true,
      },
    ],
    max25chars: (v) => v.length <= 20 || 'Input too long!', // TODO : should validate as number
    pagination: {},
  }),
  watch: {},

  methods: {
    updateDenomination(item) {
      const denominationValue = this.getDenominationValue(item.mode_of_denomination);

      item.closing_qty = Math.max(0, item.closing_qty); // Ensure qty is non-negative
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

      // Update "Cash" payment method amount
      const cashPayment = this.dialog_data.payment_reconciliation.find(
        (payment) => payment.mode_of_payment === 'Cash'
      );
      console.log("cashPayment:", cashPayment);
      console.log("Total:", this.total_denomination);
      if (cashPayment) {
        cashPayment.closing_amount = this.total_denomination;
      }
    },

    close_dialog() {
      this.closingDialog = false;
      if (this.$root) {
        this.$root.$emit('escEventTriggered');
      }
    },
    submit_dialog() {
      evntBus.$emit('submit_closing_pos', this.dialog_data);
      this.closingDialog = false;
    },
//    async submit_dialog() {
//    console.log("pos_opening_shift value: ", item.pos_pos_opening_shift.name);
//        const response = await frappe.call({
//            method: 'posawesome.posawesome.doctype.pos_closing_shift.pos_closing_shift.check_open_invoices',
//            args: {
//                pos_opening_shift: this.dialog_data.pos_pos_opening_shift.name  // Ensure this is the right field
//            }
//        });
//    console.log("Backend response:", response);
//
//        if (response.message.status === "error") {
//            frappe.msgprint({
//                title: __('Open Invoices Found'),
//                message: response.message.message,
//                indicator: 'red'
//            });
//            return; // Prevent shift closure
//        }
//        // If no open invoices, proceed with closing the shift
//        evntBus.$emit('submit_closing_pos', this.dialog_data);
//        this.closingDialog = false;
//    },

    get_draft_invoices() {
      const vm = this;
      frappe.call({
        method: "posawesome.posawesome.api.posapp.get_draft_invoices",
        args: {
          pos_opening_shift: item.pos_opening_shift.name,
        },
        async: false,
        callback: function (r) {
          if (r.message) {
            evntBus.$emit("open_drafts", r.message);
          }
        },
      });
    },
  },

  created: function () {
    evntBus.$on('open_ClosingDialog', (data) => {
      this.closingDialog = true;
      this.dialog_data = data;
    });
    evntBus.$on('register_pos_profile', (data) => {
      this.pos_profile = data.pos_profile;
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