<template>
  <div>
    <v-card
      class="selection mx-auto bg-grey-lighten-5 pa-1"
      style="max-height: 76vh; height: 76vh"
    >
      <v-progress-linear
        :active="loading"
        :indeterminate="loading"
        absolute
        color="info" location="top"
      ></v-progress-linear>
      <div class="overflow-y-auto px-2 pt-2" style="max-height: 75vh">
        <v-row v-if="invoice_doc" class="px-1 py-0">
          <v-col cols="7" v-if="pos_profile.posa_allow_received_advance">
            <v-text-field
              variant="outlined"
              color="primary"
              :label="frappe._('Previous Balance')"
              :bg-color="frappe._(outstanding_color)"
              hide-details
              :model-value="formtCurrency(customer_outstanding)"
              disabled
              :prefix="currencySymbol(invoice_doc.currency)"
              density="compact"
            ></v-text-field>
          </v-col>
          <v-col cols="5" v-if="pos_profile.posa_allow_received_advance">
            <v-text-field
              variant="outlined"
              color="error"
              :label="frappe._('Outstanding Adjusted')"
              :bg-color="frappe._(outstanding_color)"
              hide-details
              :model-value="formtCurrency(Math.min(-diff_payment, customer_outstanding))"
              disabled
              :prefix="currencySymbol(invoice_doc.currency)"
              density="compact"
            ></v-text-field>
          </v-col>
          <v-col cols="7">
            <v-text-field
              variant="outlined"
              color="primary"
              :label="frappe._('Paid Amount')"
              bg-color="white"
              hide-details
              :model-value="formtCurrency(total_payments)"
              disabled
              :prefix="currencySymbol(invoice_doc.currency)"
              density="compact"
            ></v-text-field>
          </v-col>
          <v-col cols="5">
            <v-text-field
              variant="outlined"
              color="primary"
              :label="frappe._(diff_lable)"
              :bg-color="frappe._(diff_color)"
              hide-details
              :model-value="formtCurrency(diff_payment)"
              disabled
              :prefix="currencySymbol(invoice_doc.currency)"
              density="compact"
            ></v-text-field>
          </v-col>
          <v-col cols="7" v-if="diff_payment < 0 && !invoice_doc.is_return">
            <v-text-field
              variant="outlined"
              color="primary"
              :label="frappe._('Paid Change')"
              bg-color="yellow"
              v-model="paid_change"
              @update:model-value="set_paid_change()"
              :prefix="currencySymbol(invoice_doc.currency)"
              :rules="paid_change_rules"
              density="compact"
              disabled
              type="number"
            ></v-text-field>
          </v-col>

          <v-col cols="5" v-if="diff_payment < 0 && !invoice_doc.is_return">
            <v-text-field
              variant="outlined"
              color="primary"
              :label="frappe._('Credit Change')"
              bg-color="white"
              hide-details
              :model-value="formtCurrency(credit_change)"
              disabled
              :prefix="currencySymbol(invoice_doc.currency)"
              density="compact"
            ></v-text-field>
          </v-col>
        </v-row>
        <v-divider></v-divider>

        <div v-if="is_cashback">
          <v-row
            class="pyments px-1 py-0"
            v-for="(payment, payment_row) in invoice_doc.payments"
            :key="payment.name || payment.idx || payment.mode_of_payment"
          >
            <v-col cols="6" v-if="!is_mpesa_c2b_payment(payment)">
              <v-text-field
                density="compact"
                variant="outlined"
                color="primary"
                :label="frappe._(payment.mode_of_payment)"
                bg-color="white"
                hide-details
                :model-value="formtCurrency(payment.amount)"
                @change="
                  setFormatedCurrency(payment, 'amount', null, true, $event.target.value)
                "
                :rules="[isNumber]"
                :prefix="currencySymbol(invoice_doc.currency)"
                :data-payment-row="payment_row"
                @focus="on_payment_focus(payment.idx, $event)"
                @keydown.enter.prevent="open_print_confirmation($event, payment)"
                :readonly="invoice_doc.is_return ? true : false"
              ></v-text-field>
            </v-col>
            <v-col
              v-if="!is_mpesa_c2b_payment(payment)"
              :cols="
                6
                  ? (payment.type != 'Phone' ||
                      payment.amount == 0 ||
                      !request_payment_field) &&
                    !is_mpesa_c2b_payment(payment)
                  : 3
              "
            >
              <v-btn
                block
                class=""
                color="primary"
                @click="set_full_amount(payment.idx)"
                >{{ payment.mode_of_payment }}</v-btn>
            </v-col>
            <v-col v-if="is_mpesa_c2b_payment(payment)" :cols="12" class="pl-3">
              <v-btn
                block
                class=""
                color="success"
                @click="mpesa_c2b_dialg(payment)"
              >
                {{ __(`Get Payments ${payment.mode_of_payment}`) }}
              </v-btn>
            </v-col>
            <v-col
              v-if="
                payment.type == 'Phone' &&
                payment.amount > 0 &&
                request_payment_field
              "
              :cols="3"
              class="pl-1"
            >
              <v-btn
                block
                class=""
                color="success"
                :disabled="payment.amount == 0"
                @click="
                  (phone_dialog = true),
                    (payment.amount = flt(payment.amount, 0))
                "
              >
                {{ __("Request") }}
              </v-btn>
            </v-col>
          </v-row>
        </div>

        <v-row
          class="pyments px-1 py-0"
          v-if="
            invoice_doc &&
            available_pioints_amount > 0 &&
            !invoice_doc.is_return
          "
        >
          <v-col cols="7">
            <v-text-field
              density="compact"
              variant="outlined"
              color="primary"
              :label="frappe._('Redeem Loyalty Points')"
              bg-color="white"
              hide-details
              v-model="loyalty_amount"
              type="number"
              :prefix="currencySymbol(invoice_doc.currency)"
            ></v-text-field>
          </v-col>
          <v-col cols="5">
            <v-text-field
              density="compact"
              variant="outlined"
              color="primary"
              :label="frappe._('You can redeem upto')"
              bg-color="white"
              hide-details
              :model-value="formtFloat(available_pioints_amount)"
              :prefix="currencySymbol(invoice_doc.currency)"
              disabled
            ></v-text-field>
          </v-col>
        </v-row>

        <v-row
          class="pyments px-1 py-0"
          v-if="
            invoice_doc &&
            available_customer_credit > 0 &&
            !invoice_doc.is_return &&
            redeem_customer_credit
          "
        >
          <v-col cols="7">
            <v-text-field
              density="compact"
              variant="outlined"
              disabled
              color="primary"
              :label="frappe._('Redeemed Customer Credit')"
              bg-color="white"
              hide-details
              v-model="redeemed_customer_credit"
              type="number"
              :prefix="currencySymbol(invoice_doc.currency)"
            ></v-text-field>
          </v-col>
          <v-col cols="5">
            <v-text-field
              density="compact"
              variant="outlined"
              color="primary"
              :label="frappe._('You can redeem credit upto')"
              bg-color="white"
              hide-details
              :model-value="formtCurrency(available_customer_credit)"
              :prefix="currencySymbol(invoice_doc.currency)"
              disabled
            ></v-text-field>
          </v-col>
        </v-row>
        <v-divider></v-divider>

        <v-row class="px-1 py-0">
          <v-col cols="6">
            <v-text-field
              density="compact"
              variant="outlined"
              color="primary"
              :label="frappe._('Net Total')"
              bg-color="white"
              hide-details
              :model-value="formtCurrency(invoice_doc.net_total)"
              disabled
              :prefix="currencySymbol(invoice_doc.currency)"
            ></v-text-field>
          </v-col>
          <v-col cols="6">
            <v-text-field
              density="compact"
              variant="outlined"
              color="primary"
              :label="frappe._('Tax and Charges')"
              bg-color="white"
              hide-details
              :model-value="formtCurrency(invoice_doc.total_taxes_and_charges)"
              disabled
              :prefix="currencySymbol(invoice_doc.currency)"
            ></v-text-field>
          </v-col>
          <v-col cols="6">
            <v-text-field
              density="compact"
              variant="outlined"
              color="primary"
              :label="frappe._('Total Amount')"
              bg-color="white"
              hide-details
              :model-value="formtCurrency(invoice_doc.total)"
              disabled
              :prefix="currencySymbol(invoice_doc.currency)"
            ></v-text-field>
          </v-col>
          <v-col cols="6">
            <v-text-field
              density="compact"
              variant="outlined"
              color="primary"
              :label="frappe._('Discount Amount')"
              bg-color="white"
              hide-details
              :model-value="formtCurrency(invoice_doc.discount_amount)"
              disabled
              :prefix="currencySymbol(invoice_doc.currency)"
            ></v-text-field>
          </v-col>
          <v-col cols="6">
            <v-text-field
              density="compact"
              variant="outlined"
              color="primary"
              :label="frappe._('Grand Total')"
              bg-color="white"
              hide-details
              :model-value="formtCurrency(invoice_doc.grand_total)"
              disabled
              :prefix="currencySymbol(invoice_doc.currency)"
            ></v-text-field>
          </v-col>
          <v-col v-if="invoice_doc.rounded_total" cols="6">
            <v-text-field
              density="compact"
              variant="outlined"
              color="primary"
              :label="frappe._('Rounded Total')"
              bg-color="white"
              hide-details
              :model-value="formtCurrency(invoice_doc.rounded_total)"
              disabled
              :prefix="currencySymbol(invoice_doc.currency)"
            ></v-text-field>
          </v-col>
          <v-col
            cols="6"
            v-if="pos_profile.posa_allow_sales_order && invoiceType == 'Order'"
          >
            <v-menu
              ref="order_delivery_date"
              v-model="order_delivery_date"
              :close-on-content-click="false"
              transition="scale-transition"
            >
              <template v-slot:activator="{ props }">
                <v-text-field
                  v-model="invoice_doc.posa_delivery_date"
                  :label="frappe._('Delivery Date')"
                  readonly
                  variant="outlined"
                  density="compact"
                  bg-color="white"
                  clearable
                  color="primary"
                  hide-details
                  v-bind="props"
                ></v-text-field>
              </template>
              <pos-date-picker
                v-model="invoice_doc.posa_delivery_date"
                color="primary"
                :min="frappe.datetime.now_date()"
                @update:model-value="order_delivery_date = false"
              >
              </pos-date-picker>
            </v-menu>
          </v-col>
          <v-col cols="12" v-if="invoice_doc.posa_delivery_date">
            <v-autocomplete
              density="compact"
              clearable
              auto-select-first
              variant="outlined"
              color="primary"
              :label="frappe._('Address')"
              v-model="invoice_doc.shipping_address_name"
              :items="addresses"
              item-title="address_title"
              item-value="name"
              bg-color="white"
              no-data-text="Address not found"
              hide-details
              :custom-filter="(itemText, queryText, internal) => addressFilter(internal.raw, queryText, itemText)"
              append-inner-icon="mdi-plus"
              @click:append-inner="new_address"
            >
              <template v-slot:item="data">
<v-list-item v-bind="data.props" :title="null">
                    <v-list-item-title
                      class="text-primary text-subtitle-1"
                      v-html="data.item.raw.address_title"
                    ></v-list-item-title>
                    <v-list-item-title
                      v-html="data.item.raw.address_line1"
                    ></v-list-item-title>
                    <v-list-item-subtitle
                      v-if="data.item.raw.custoaddress_line2mer_name"
                      v-html="data.item.raw.address_line2"
                    ></v-list-item-subtitle>
                    <v-list-item-subtitle
                      v-if="data.item.raw.city"
                      v-html="data.item.raw.city"
                    ></v-list-item-subtitle>
                    <v-list-item-subtitle
                      v-if="data.item.raw.state"
                      v-html="data.item.raw.state"
                    ></v-list-item-subtitle>
                    <v-list-item-subtitle
                      v-if="data.item.raw.country"
                      v-html="data.item.raw.mobile_no"
                    ></v-list-item-subtitle>
                    <v-list-item-subtitle
                      v-if="data.item.raw.address_type"
                      v-html="data.item.raw.address_type"
                    ></v-list-item-subtitle>
                  </v-list-item>
                
              </template>
            </v-autocomplete>
          </v-col>
          <v-col cols="12" v-if="pos_profile.posa_display_additional_notes">
            <v-textarea
              class="pa-0"
              variant="outlined"
              density="compact"
              bg-color="white"
              clearable
              color="primary"
              auto-grow
              rows="2"
              :label="frappe._('Additional Notes')"
              v-model="invoice_doc.posa_notes"
            ></v-textarea>
          </v-col>
        </v-row>

        <div v-if="pos_profile.posa_allow_customer_purchase_order">
          <v-divider></v-divider>
          <v-row class="px-1 py-0" justify="center" align="start">
            <v-col cols="6">
              <v-text-field
                v-model="invoice_doc.po_no"
                :label="frappe._('Purchase Order')"
                variant="outlined"
                density="compact"
                bg-color="white"
                clearable
                color="primary"
                hide-details
              ></v-text-field>
            </v-col>
            <v-col cols="6">
              <v-menu
                ref="po_date_menu"
                v-model="po_date_menu"
                :close-on-content-click="false"
                transition="scale-transition"
              >
                <template v-slot:activator="{ props }">
                  <v-text-field
                    v-model="invoice_doc.po_date"
                    :label="frappe._('Purchase Order Date')"
                    readonly
                    variant="outlined"
                    density="compact"
                    hide-details
                    v-bind="props"
                    color="primary"
                  ></v-text-field>
                </template>
                <pos-date-picker
                  v-model="invoice_doc.po_date"
                  color="primary"
                  @update:model-value="po_date_menu = false"
                >
                </pos-date-picker>
              </v-menu>
            </v-col>
          </v-row>
        </div>
        <v-divider></v-divider>
        <v-row class="px-1 py-0" align="start" no-gutters>
          <v-col
            cols="6"
            v-if="
              pos_profile.posa_allow_write_off_change &&
              diff_payment > 0 &&
              !invoice_doc.is_return
            "
          >
            <v-switch
              class="my-0 py-0"
              v-model="is_write_off_change"
              flat
              :label="frappe._('Write Off Difference Amount')"
            ></v-switch>
          </v-col>
          <v-col
            cols="6"
            v-if="pos_profile.posa_allow_credit_sale && !invoice_doc.is_return"
          >
            <v-switch
              v-model="is_credit_sale"
              flat
              :label="frappe._('Is Credit Sale')"
              class="my-0 py-0"
            ></v-switch>
          </v-col>
          <v-col
            cols="6"
            v-if="invoice_doc.is_return && pos_profile.use_cashback"
          >
            <v-switch
              v-model="is_cashback"
              flat
              :label="frappe._('Is Cashback')"
              class="my-0 py-0"
            ></v-switch>
          </v-col>
          <v-col cols="6" v-if="is_credit_sale">
            <v-menu
              ref="date_menu"
              v-model="date_menu"
              :close-on-content-click="false"
              transition="scale-transition"
            >
              <template v-slot:activator="{ props }">
                <v-text-field
                  v-model="invoice_doc.due_date"
                  :label="frappe._('Due Date')"
                  readonly
                  variant="outlined"
                  density="compact"
                  hide-details
                  v-bind="props"
                  color="primary"
                ></v-text-field>
              </template>
              <pos-date-picker
                v-model="invoice_doc.due_date"
                color="primary"
                :min="frappe.datetime.now_date()"
                @update:model-value="date_menu = false"
              >
              </pos-date-picker>
            </v-menu>
          </v-col>
          <v-col
            cols="6"
            v-if="!invoice_doc.is_return && pos_profile.use_customer_credit"
          >
            <v-switch
              v-model="redeem_customer_credit"
              flat
              :label="frappe._('Use Customer Credit')"
              class="my-0 py-0"
              @update:model-value="get_available_credit($event)"
            ></v-switch>
          </v-col>
        </v-row>
        <div
          v-if="
            invoice_doc &&
            available_customer_credit > 0 &&
            !invoice_doc.is_return &&
            redeem_customer_credit
          "
        >
          <v-row v-for="(row, idx) in customer_credit_dict" :key="idx">
            <v-col cols="4">
              <div class="pa-2 py-3">{{ row.credit_origin }}</div>
            </v-col>
            <v-col cols="4">
              <v-text-field
                density="compact"
                variant="outlined"
                color="primary"
                :label="frappe._('Available Credit')"
                bg-color="white"
                hide-details
                :model-value="formtCurrency(row.total_credit)"
                disabled
                :prefix="currencySymbol(invoice_doc.currency)"
              ></v-text-field>
            </v-col>
            <v-col cols="4">
              <v-text-field
                density="compact"
                variant="outlined"
                color="primary"
                :label="frappe._('Redeem Credit')"
                bg-color="white"
                hide-details
                type="number"
                v-model="row.credit_to_redeem"
                :prefix="currencySymbol(invoice_doc.currency)"
              ></v-text-field>
            </v-col>
          </v-row>
        </div>
        <v-divider></v-divider>
        <v-row class="pb-0 mb-2" align="start">
          <v-col cols="12">
            <v-autocomplete
              density="compact"
              clearable
              auto-select-first
              variant="outlined"
              color="primary"
              :label="frappe._('Sales Person')"
              v-model="sales_person"
              :items="sales_persons"
              item-title="sales_person_name"
              item-value="name"
              bg-color="white"
              :no-data-text="__('Sales Person not found')"
              hide-details
              :custom-filter="(itemText, queryText, internal) => salesPersonFilter(internal.raw, queryText, itemText)"
              :disabled="readonly"
            >
              <template v-slot:item="data">
<v-list-item v-bind="data.props" :title="null">
                    <v-list-item-title
                      class="text-primary text-subtitle-1"
                      v-html="data.item.raw.sales_person_name"
                    ></v-list-item-title>
                    <v-list-item-subtitle
                      v-if="data.item.raw.sales_person_name != data.item.raw.name"
                      v-html="`ID: ${data.item.raw.name}`"
                    ></v-list-item-subtitle>
                  </v-list-item>
                
              </template>
            </v-autocomplete>
          </v-col>
        </v-row>
      </div>
    </v-card>

    <v-card flat class="cards mb-0 mt-3 py-0">
      <v-row align="start" no-gutters>
        <v-col cols="6">
          <v-btn
            block
            size="large"
            color="primary"
            @click="submit"
            :disabled="vaildatPayment"
            >{{ __("Submit") }}</v-btn>
        </v-col>
        <v-col cols="6" class="pl-1">
          <v-btn
            block
            size="large"
            color="success"
            @click="submit(undefined, false, true)"
            :disabled="vaildatPayment"
            >{{ __("Submit & Print") }}</v-btn>
        </v-col>
        <v-col cols="12">
          <v-btn
            block
            class="mt-2 pa-1"
            size="large"
            color="error"
            @click="back_to_invoice"
            @keydown.esc="back_to_invoice"
            >{{ __("Cancel Payment") }}</v-btn>
        </v-col>
      </v-row>
    </v-card>
    <div>
      <v-dialog v-model="phone_dialog" max-width="400px">
        <v-card>
          <v-card-title>
            <span class="text-h5 text-primary">{{
              __("Confirm Mobile Number")
            }}</span>
          </v-card-title>
          <v-card-text class="pa-0">
            <v-container>
              <v-text-field
                density="compact"
                variant="outlined"
                color="primary"
                :label="frappe._('Mobile Number')"
                bg-color="white"
                hide-details
                v-model="invoice_doc.contact_mobile"
                type="number"
              ></v-text-field>
            </v-container>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn color="error" @click="phone_dialog = false">{{
              __("Close")
            }}</v-btn>
            <v-btn color="primary" @click="request_payment">{{
              __("Request")
            }}</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <!-- Enter in a payment amount: confirm, then Submit or Submit & Print -->
      <v-dialog v-model="confirm_print_dialog" max-width="580" persistent>
        <div @keydown.enter="ignore_enter_repeat">
          <v-card v-if="invoice_doc" elevation="8" class="confirm-dialog-card">
            <v-card-title class="confirm-header pa-6">
              <div class="header-content">
                <div class="header-icon-wrapper">
                  <v-icon class="header-icon" size="40">mdi-printer-check</v-icon>
                </div>
                <div class="header-text">
                  <h3 class="header-title">{{ __("Confirm Payment") }}</h3>
                  <p class="header-subtitle">{{ __("Submit this invoice, or submit and print it?") }}</p>
                </div>
              </div>
            </v-card-title>

            <v-divider class="header-divider"></v-divider>

            <v-card-text class="pa-0 white-background">
              <div class="pa-6">
                <div class="total-box mb-4">
                  <span class="total-label">{{ __("Invoice Total") }}</span>
                  <span class="total-value">
                    {{ currencySymbol(invoice_doc.currency) }}
                    {{ formtCurrency(invoice_doc.rounded_total || invoice_doc.grand_total) }}
                  </span>
                </div>

                <div class="form-header mb-2">
                  <h4 class="text-h6 text-grey-darken-2 mb-0">{{ __("Mode of Payment") }}</h4>
                </div>
                <v-table class="white-table rounded-lg" density="compact">
                  <tbody>
                    <tr v-for="payment in confirm_payments" :key="payment.idx || payment.mode_of_payment">
                      <td>
                        <v-icon size="small" color="primary" class="mr-2">mdi-cash-multiple</v-icon>
                        {{ __(payment.mode_of_payment) }}
                      </td>
                      <td class="text-right font-weight-medium">
                        {{ currencySymbol(invoice_doc.currency) }} {{ formtCurrency(payment.amount) }}
                      </td>
                    </tr>
                    <tr v-if="flt(invoice_doc.loyalty_amount) > 0">
                      <td>
                        <v-icon size="small" color="primary" class="mr-2">mdi-star-circle</v-icon>
                        {{ __("Loyalty Points") }}
                      </td>
                      <td class="text-right font-weight-medium">
                        {{ currencySymbol(invoice_doc.currency) }} {{ formtCurrency(invoice_doc.loyalty_amount) }}
                      </td>
                    </tr>
                    <tr v-if="flt(redeemed_customer_credit) > 0">
                      <td>
                        <v-icon size="small" color="primary" class="mr-2">mdi-account-cash</v-icon>
                        {{ __("Customer Credit") }}
                      </td>
                      <td class="text-right font-weight-medium">
                        {{ currencySymbol(invoice_doc.currency) }} {{ formtCurrency(redeemed_customer_credit) }}
                      </td>
                    </tr>
                    <tr v-if="!confirm_payments.length && !flt(invoice_doc.loyalty_amount) && !flt(redeemed_customer_credit)">
                      <td colspan="2" class="text-grey">
                        {{ is_credit_sale ? __("Credit Sale (no payment)") : __("No payment entered") }}
                      </td>
                    </tr>
                    <tr class="paid-row">
                      <td>{{ __("Paid Amount") }}</td>
                      <td class="text-right">
                        {{ currencySymbol(invoice_doc.currency) }} {{ formtCurrency(total_payments) }}
                      </td>
                    </tr>
                  </tbody>
                </v-table>

                <!-- customer paid more: change -->
                <template v-if="diff_payment < 0 && !invoice_doc.is_return">
                  <div class="info-row mt-4">
                    <span>{{ __("Total Change") }}</span>
                    <b>{{ currencySymbol(invoice_doc.currency) }} {{ formtCurrency(-diff_payment) }}</b>
                  </div>
                  <div class="change-box mt-2">
                    <div>
                      <v-icon class="mr-2" color="#f57f17">mdi-hand-coin</v-icon>
                      <span>{{ __("Paid Change") }}</span>
                      <div class="box-hint">{{ __("Give to customer") }}</div>
                    </div>
                    <span class="box-value">
                      {{ currencySymbol(invoice_doc.currency) }} {{ formtCurrency(paid_change) }}
                    </span>
                  </div>
                  <div class="credit-box mt-2" v-if="flt(credit_change) != 0">
                    <div>
                      <v-icon class="mr-2" color="#1565c0">mdi-wallet-plus</v-icon>
                      <span>{{ __("Credit Change") }}</span>
                      <div class="box-hint">{{ __("Kept as customer credit") }}</div>
                    </div>
                    <span class="box-value">
                      {{ currencySymbol(invoice_doc.currency) }} {{ formtCurrency(Math.abs(credit_change)) }}
                    </span>
                  </div>
                </template>

                <!-- return: refund -->
                <div class="refund-box mt-4" v-if="invoice_doc.is_return">
                  <div>
                    <v-icon class="mr-2" color="#6a1b9a">mdi-cash-refund</v-icon>
                    <span>{{ is_cashback ? __("Refund to Customer") : __("No Refund") }}</span>
                    <div class="box-hint">
                      {{ is_cashback ? __("Pay back from the mode of payment above") : __("Kept as customer credit") }}
                    </div>
                  </div>
                  <span class="box-value">
                    {{ currencySymbol(invoice_doc.currency) }}
                    {{ formtCurrency(Math.abs(invoice_doc.rounded_total || invoice_doc.grand_total)) }}
                  </span>
                </div>

                <!-- customer paid less: outstanding / write-off -->
                <div class="due-box mt-4" v-if="diff_payment > 0 && !invoice_doc.is_return">
                  <div>
                    <v-icon class="mr-2" color="#e65100">mdi-alert-circle-outline</v-icon>
                    <span>{{ is_write_off_change ? __("Written Off") : __("To Be Paid") }}</span>
                    <div class="box-hint" v-if="!is_write_off_change">{{ __("Outstanding on this invoice") }}</div>
                  </div>
                  <span class="box-value">
                    {{ currencySymbol(invoice_doc.currency) }} {{ formtCurrency(diff_payment) }}
                  </span>
                </div>
              </div>
            </v-card-text>

            <v-divider></v-divider>
            <v-card-actions class="dialog-actions-container">
              <v-btn
                ref="confirm_submit_btn"
                color="primary"
                variant="flat"
                class="pos-action-btn submit-only-btn"
                size="large"
                @click="confirm_submit"
              >
                <v-icon start>mdi-check-circle-outline</v-icon>
                {{ __("Submit") }}
              </v-btn>
              <v-btn
                ref="confirm_print_btn"
                color="success"
                variant="flat"
                class="pos-action-btn submit-action-btn"
                size="large"
                @click="confirm_submit_print"
              >
                <v-icon start>mdi-printer-check</v-icon>
                {{ __("Submit & Print") }}
              </v-btn>
              <v-btn
                color="error"
                variant="flat"
                class="pos-action-btn cancel-action-btn"
                size="large"
                @click="cancel_confirm"
              >
                <v-icon start>mdi-close-circle-outline</v-icon>
                {{ __("Cancel") }}
              </v-btn>
            </v-card-actions>
          </v-card>
        </div>
      </v-dialog>
    </div>
  </div>
</template>

<script>
import { evntBus } from "../../bus";
import format from "../../format";
import offlinePos from "../../../offline";
import vfd from "../../../shared/vfd";
export default {
  mixins: [format],
  data: () => ({
    vfd_paying: false, // payment screen open: pole display shows TOTAL / PAID
    confirm_print_dialog: false, // Enter in a payment amount: Submit / Submit & Print
    confirm_source_input: null, // the amount field it was opened from (focus returns there)
    loading: false,
    readonly: false,
    pos_profile: "",
    invoice_doc: "",
    loyalty_amount: 0,
    is_credit_sale: 0,
    is_write_off_change: 0,
    date_menu: false,
    po_date_menu: false,
    addresses: [],
    sales_persons: [],
    sales_person: "",
    paid_change: 0,
    order_delivery_date: false,
    paid_change_rules: [],
    is_return: false,
    is_cashback: true,
    redeem_customer_credit: false,
    customer_credit_dict: [],
    phone_dialog: false,
    invoiceType: "Invoice",
    pos_settings: "",
    customer_info: "",
    mpesa_modes: [],
    customer_outstanding: 0, // Customer balance
  }),

  methods: {
    async fetchCustomerOutstanding(customer) {
      if (offlinePos.useOffline() || (this.invoice_doc && this.invoice_doc.__offline)) return;
      if (this.pos_profile.posa_allow_received_advance) {
        try {
          const response = await frappe.call({
            method: "posawesome.posawesome.api.posapp.get_customer_outstanding",
            args: {
              customer: this.invoice_doc.customer,
              company: this.pos_profile.company
            }
          });
          this.customer_outstanding = response.message.outstanding_amount || 0;
        } catch (err) {
          console.error("Unable to fetch customer outstanding", err);
          this.customer_outstanding = 0;
        }
      }
    },
    async fetchCustomerOutstandings(customer) {
      try {
        const response = await frappe.call({
          method: "posawesome.posawesome.api.posapp.get_customer_outstanding",
          args: {
//            customer: data.customer,
            customer: this.invoice_doc.customer,
            company: this.pos_profile.company
          }
        });
        this.customer_outstanding = response.message.outstanding_amount || 0;
      } catch (err) {
        console.error("Unable to fetch customer outstanding", err);
        this.customer_outstanding = 0;
      }
    },
    submit_fbr_invoice() {
      let data = {};
      data["total_change"] = !this.invoice_doc.is_return
        ? -this.diff_payment
        : 0;
      data["paid_change"] = !this.invoice_doc.is_return ? this.paid_change : 0;
      data["credit_change"] = -this.credit_change;
      data["redeemed_customer_credit"] = this.redeemed_customer_credit;
      data["customer_credit_dict"] = this.customer_credit_dict;
      data["is_cashback"] = this.is_cashback;
      const vm = this;
      // New: Prepare Data for FBR API
      let item_list = [];
      let total_qty = 0;
      let tax_rate = this.invoice_doc.taxes.length > 0 ? this.invoice_doc.taxes[0].rate : 0;
      this.invoice_doc.items.forEach((item) => {
        let salevalue = item.rate * item.qty;
        item_list.push({
          "ItemCode": item.item_code,
          "ItemName": item.item_name,
          "Quantity": item.qty,
          "PCTCode": "11001010",
          "TaxRate": tax_rate,
          "SaleValue": salevalue,
          "TotalAmount": salevalue * (1 + tax_rate / 100),
          "TaxCharged": (salevalue / 100) * tax_rate,
          "Discount": "0.0",
          "FurtherTax": 0,
          "InvoiceType": 1,
          "RefUSIN": null,
        });
        total_qty += item.qty;
      });

      let fbr_data = {
        "InvoiceNumber": "",
        "POSID": this.invoice_doc.pos_id,
        "USIN": this.invoice_doc.name,
        "DateTime": this.invoice_doc.posting_date,
        "BuyerNTN": null,
        "BuyerCNIC": 9999999999999,
        "BuyerName": this.invoice_doc.customer,
        "BuyerPhoneNumber": null,
        "TotalBillAmount": this.invoice_doc.rounded_total,
        "TotalQuantity": total_qty,
        "TotalSaleValue": this.invoice_doc.net_total,
        "TotalTaxCharged": this.invoice_doc.total_taxes_and_charges,
        "Discount": "0",
        "FurtherTax": "0",
        "PaymentMode": 1,
        "RefUSIN": null,
        "InvoiceType": 1,
        "Items": item_list,
      };

      // Call FBR API only if print is true
      $.ajax("https://gw.fbr.gov.pk/imsp/v1/api/Live/PostData", {
        type: "POST",
        data: JSON.stringify(fbr_data),
        contentType: "application/json",
        async: true,
        beforeSend: function (xhr) {
          xhr.setRequestHeader("Authorization", "Bearer " + vm.invoice_doc.fbr_pos_token);
        },
        success: function (response) {
          if (response.InvoiceNumber) {
            vm.invoice_doc.fbr_invoice_no = response.InvoiceNumber;

            // Store FBR invoice number in ERPNext
            frappe.call({
              method: "posawesome.posawesome.api.fbr_invoice.set_invoice_number",
              args: {
                doctype: vm.invoice_doc.doctype,
                name: vm.invoice_doc.name,
                inv: response.InvoiceNumber,
              },
              async: true,
              callback: function (e) {
                console.log("FBR Invoice Number Updated:", response.InvoiceNumber);
              },
            });
            // Proceed with printing after FBR API success
            vm.load_print_page();
            evntBus.$emit("set_last_invoice", vm.invoice_doc.name);
            frappe.utils.play_sound("submit");
            this.addresses = [];
          } else {
            evntBus.$emit("show_mesage", {
              text: "Failed to get FBR Invoice Number",
              color: "danger",
            });
          }
        },
        error: function (jqXhr, textStatus, errorMessage) {
          console.log("Error posting to FBR: " + errorMessage);
          evntBus.$emit("show_mesage", {
            text: "FBR API Error: " + errorMessage,
            color: "danger",
          });
        },
      });
    },
    back_to_invoice() {
      evntBus.$emit("show_payment", "false");
      evntBus.$emit("set_customer_readonly", false);
    },
    submit(event, payment_received = false, print = false) {
      if (!this.invoice_doc.is_return && this.total_payments < 0) {
        evntBus.$emit("show_mesage", {
          text: `Payments not correct`,
          color: "error",
        });
        frappe.utils.play_sound("error");
        return;
      }
      // validate phone payment
      let phone_payment_is_valid = true;
      if (!payment_received) {
        this.invoice_doc.payments.forEach((payment) => {
          if (
            payment.type == "Phone" &&
            ![0, "0", "", null, undefined].includes(payment.amount)
          ) {
            phone_payment_is_valid = false;
          }
        });
        if (!phone_payment_is_valid) {
          evntBus.$emit("show_mesage", {
            text: __(
              "Please request phone payment or use other payment method"
            ),
            color: "error",
          });
          frappe.utils.play_sound("error");
          console.error("phone payment not requested");
          return;
        }
      }

      if (
        !this.pos_profile.posa_allow_partial_payment &&
        this.total_payments <
          (this.invoice_doc.rounded_total || this.invoice_doc.grand_total)
      ) {
        evntBus.$emit("show_mesage", {
          text: `The amount paid is not complete`,
          color: "error",
        });
        frappe.utils.play_sound("error");
        return;
      }

      if (
        this.pos_profile.posa_allow_partial_payment &&
        !this.pos_profile.posa_allow_credit_sale &&
        this.total_payments == 0
      ) {
        evntBus.$emit("show_mesage", {
          text: `Please enter the amount paid`,
          color: "error",
        });
        frappe.utils.play_sound("error");
        return;
      }

      if (!this.paid_change) this.paid_change = 0;

      if (this.paid_change > -this.diff_payment) {
        evntBus.$emit("show_mesage", {
          text: `Paid change can not be greater than total change!`,
          color: "error",
        });
        frappe.utils.play_sound("error");
        return;
      }

      let total_change = this.flt(
        this.flt(this.paid_change) + this.flt(-this.credit_change)
      );

      if (this.is_cashback && total_change != -this.diff_payment) {
        evntBus.$emit("show_mesage", {
          text: `Error in change calculations!`,
          color: "error",
        });
        frappe.utils.play_sound("error");
        return;
      }

      let credit_calc_check = this.customer_credit_dict.filter((row) => {
        if (flt(row.credit_to_redeem))
          return flt(row.credit_to_redeem) > flt(row.total_credit);
        else return false;
      });

      if (credit_calc_check.length > 0) {
        evntBus.$emit("show_mesage", {
          text: `redeamed credit can not greater than its total.`,
          color: "error",
        });
        frappe.utils.play_sound("error");
        return;
      }

      if (
        !this.invoice_doc.is_return &&
        this.redeemed_customer_credit >
          (this.invoice_doc.rounded_total || this.invoice_doc.grand_total)
      ) {
        evntBus.$emit("show_mesage", {
          text: `can not redeam customer credit more than invoice total`,
          color: "error",
        });
        frappe.utils.play_sound("error");
        return;
      }

      this.submit_invoice(print);
      this.customer_credit_dict = [];
      this.redeem_customer_credit = false;
      this.is_cashback = true;
      this.sales_person = "";

      evntBus.$emit("new_invoice", "false");
      this.back_to_invoice();
    },
    submit_invoice(print) {
      let totalPayedAmount = 0;
      this.invoice_doc.payments.forEach((payment) => {
        payment.amount = flt(payment.amount);
        totalPayedAmount += payment.amount;
      });
      this.vfd_paying = false; // keep PAID / CHANGE up, not TOTAL / PAID
      if (this.pos_profile && this.pos_profile.posa_enable_vfd && !this.invoice_doc.is_return) {
        const due = flt(this.invoice_doc.rounded_total || this.invoice_doc.grand_total);
        vfd.showChange({
          paid: totalPayedAmount,
          change: Math.max(0, totalPayedAmount - due),
          currency: this.currencySymbol ? this.currencySymbol(this.pos_profile.currency) : '',
        });
      }
      if (this.invoice_doc.is_return && totalPayedAmount == 0) {
        this.invoice_doc.is_pos = 0;
      }
      if (this.customer_credit_dict.length) {
        this.customer_credit_dict.forEach((row) => {
          row.credit_to_redeem = flt(row.credit_to_redeem);
        });
      }
      let data = {};
      data["total_change"] = !this.invoice_doc.is_return
        ? -this.diff_payment
        : 0;
      data["paid_change"] = !this.invoice_doc.is_return ? this.paid_change : 0;
      data["credit_change"] = -this.credit_change;
      data["redeemed_customer_credit"] = this.redeemed_customer_credit;
      data["customer_credit_dict"] = this.customer_credit_dict;
      data["is_cashback"] = this.is_cashback;

      const vm = this;
      // The cart is cleared right after this call; the answer may come much
      // later. Keep this sale's document: never queue the next sale by mistake.
      const invoice_doc = this.invoice_doc;
      if (!invoice_doc.posa_offline_id) invoice_doc.posa_offline_id = offlinePos.newSaleId();
      if (offlinePos.enabled && (offlinePos.useOffline() || invoice_doc.__offline)) {
        return this.submit_invoice_offline(data, print, invoice_doc);
      }
      frappe.call({
        method: "posawesome.posawesome.api.posapp.submit_invoice",
        args: {
          data: data,
          invoice: invoice_doc,
        },
        async: true,
        error: function (xhr) {
          // Connection lost while submitting. The request may still have reached
          // the server: the queued copy carries the same sale id and draft name,
          // so the server posts the sale once whichever arrives first.
          if (offlinePos.enabled && (!xhr || !xhr.status || [502, 503, 504].includes(xhr.status))) {
            vm.submit_invoice_offline(data, print, invoice_doc);
          }
        },
        callback: function (r) {
          if (r.message && offlinePos.enabled) {
            offlinePos.forgetSale({ name: r.message.name, saleId: invoice_doc.posa_offline_id }).catch(() => {});
          }
          if (r.message) {
            if (print) {
            //   if (vm.pos_profile.allow_fbr_on_submit) {
            //     vm.submit_fbr_invoice();
            //     vm.load_print_page();
            //   }
            //   vm.load_print_page();
            // }
              if (vm.pos_profile.allow_fbr_on_submit) {
                // ? Call Python function before printing
                frappe.call({
                  method: "posawesome.events.sales_invoice.submit_to_fbr",
                  args: {
                    doctype: invoice_doc.doctype,  // Pass doctype
                    name: r.message.name         // Pass name
                    // doc: vm.invoice_doc, // Passing invoice_doc as arg
                  },
                  async: true,
                  callback: function (fbr_res) {
                    console.log("FBR submission result:", fbr_res);
                    // Proceed with printing after FBR submission
                    vm.load_print_page(r.message.name);
                  },
                  error: function (err) {
                    console.error("FBR submission failed:", err);
                    // Still allow printing but log error
                    vm.load_print_page(r.message.name);
                  }
                });
              } else {
                vm.load_print_page(r.message.name);
              }
            }
            evntBus.$emit("set_last_invoice", r.message.name);
            evntBus.$emit("show_mesage", {
              text: `Invoice ${r.message.name} is Submited`,
              color: "success",
            });
            frappe.utils.play_sound("submit");
            this.addresses = [];
          }
        },
      });
    },
    async submit_invoice_offline(data, print, invoice_doc = null) {
      // invoice_doc was computed locally (offline/taxes.js); queue it and print a receipt
      const vm = this;
      const source = invoice_doc || vm.invoice_doc;
      try {
        const invoice = { ...source };
        if (!invoice.__offline) {
          // came from the server as a draft: rebuild totals locally to be safe
          // (name + posa_offline_id stay: the server turns that draft into the sale)
          Object.assign(invoice, offlinePos.buildInvoice(invoice), { payments: source.payments, name: source.name });
        }
        invoice.is_pos = source.is_pos;
        invoice.due_date = source.due_date;
        const record = await offlinePos.submitInvoice(invoice, data, { print });
        evntBus.$emit("set_last_invoice", record.offline_id);
        evntBus.$emit("show_mesage", {
          text: __("Saved offline as {0}. It will be synced automatically.", [record.offline_id]),
          color: "warning",
        });
        frappe.utils.play_sound("submit");
        vm.addresses = [];
      } catch (e) {
        console.error(e);
        evntBus.$emit("show_mesage", {
          text: __("Could not save the invoice offline: {0}", [e.message || e]),
          color: "error",
        });
        frappe.utils.play_sound("error");
      }
    },
    set_full_amount(idx) {
      const invoice_total = this.invoice_doc.rounded_total || this.invoice_doc.grand_total;
      const loyalty_deduction = this.flt(this.invoice_doc.loyalty_amount) || 0;
      const customer_credit =this.flt(this.redeemed_customer_credit) || 0;

      const amount_to_pay = this.flt(invoice_total - loyalty_deduction - customer_credit, this.currency_precision);
        
      this.invoice_doc.payments.forEach((payment) => {
        payment.amount = payment.idx == idx ? amount_to_pay : 0;
      });
    },

    set_full_amount_old(idx) {
      this.invoice_doc.payments.forEach((payment) => {
        payment.amount =
          payment.idx == idx
            ? this.invoice_doc.rounded_total || this.invoice_doc.grand_total
            : 0;
      });
    },

    // Enter in a payment amount: take the typed amount, then ask Submit or
    // Submit & Print (the first button, Submit, has the focus).
    open_print_confirmation(e, payment) {
      if ((e && e.repeat) || this.vaildatPayment || this.confirm_print_dialog) return;
      const input = e && e.target;
      if (payment && input && input.value !== undefined && !this.invoice_doc.is_return) {
        this.setFormatedCurrency(payment, "amount", null, true, input.value);
      }
      this.confirm_source_input = input || null;
      this.confirm_print_dialog = true;
      this.focus_confirm_button();
    },
    focus_confirm_button(tries = 10) {
      const btn = this.$refs.confirm_submit_btn;
      const el = btn && (btn.$el || btn);
      if (!el || !el.offsetParent) {
        if (tries > 0) setTimeout(() => this.focus_confirm_button(tries - 1), 50);
        return;
      }
      el.focus();
    },
    ignore_enter_repeat(e) {
      // holding Enter down must not confirm by accident
      if (e.repeat) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    confirm_submit() {
      this.confirm_print_dialog = false;
      this.submit();
    },
    confirm_submit_print() {
      this.confirm_print_dialog = false;
      this.submit(undefined, false, true);
    },
    cancel_confirm() {
      this.confirm_print_dialog = false;
      const input = this.confirm_source_input;
      this.confirm_source_input = null;
      // back in the amount the cashier was typing, ready to change it
      setTimeout(() => {
        if (input && input.offsetParent) {
          input.focus();
          this.select_input(input);
        }
      }, 50);
    },
    // Focus a payment field: fill the rest of the amount (as before), then
    // select the whole amount so the cashier can type over it.
    on_payment_focus(idx, event) {
      this.set_rest_amount(idx);
      const input = event && event.target;
      this.$nextTick(() => setTimeout(() => this.select_input(input), 0));
    },
    select_input(input) {
      if (!input || document.activeElement !== input || typeof input.select !== "function") return;
      try {
        input.select();
      } catch (e) {
        /* not selectable: ignore */
      }
    },
    // Payment screen opened: focus the default mode of payment, amount selected.
    focus_default_payment(tries = 10) {
      const payments = (this.invoice_doc && this.invoice_doc.payments) || [];
      let row = payments.findIndex((p) => p.default == 1);
      if (row < 0) row = 0;
      if (!payments.length || !this.$el || !this.$el.querySelector) return;
      const input = this.$el.querySelector(`[data-payment-row="${row}"] input`);
      // the payment panel may still be appearing: try again a little later
      if (!input || !input.offsetParent) {
        if (tries > 0) setTimeout(() => this.focus_default_payment(tries - 1), 60);
        return;
      }
      if (input.readOnly) return;
      input.focus();
      this.$nextTick(() => setTimeout(() => this.select_input(input), 0));
    },
    set_rest_amount(idx) {
        const invoice_total = this.invoice_doc.rounded_total || this.invoice_doc.grand_total;
        const loyalty_deduction = this.flt(this.invoice_doc.loyalty_amount) || 0;
        const amount_to_pay = this.flt(invoice_total - loyalty_deduction, this.currency_precision);
        
        this.invoice_doc.payments.forEach((payment) => {
          if (
            payment.idx == idx &&
            payment.amount == 0 &&
            this.diff_payment > 0
          ) {
            payment.amount = amount_to_pay - this.total_payments;
          }
        });
      },  
    set_rest_amount_old(idx) {
      this.invoice_doc.payments.forEach((payment) => {
        if (
          payment.idx == idx &&
          payment.amount == 0 &&
          this.diff_payment > 0
        ) {
          payment.amount = this.diff_payment;
        }
      });
    },
    clear_all_amounts() {
      this.invoice_doc.payments.forEach((payment) => {
        payment.amount = 0;
      });
    },
    load_print_page(name = null) {
      const print_format =
        this.pos_profile.print_format_for_online ||
        this.pos_profile.print_format;
      const letter_head = this.pos_profile.letter_head || 0;
      const url =
        frappe.urllib.get_base_url() +
        "/printview?doctype=Sales%20Invoice&name=" +
        encodeURIComponent(name || this.invoice_doc.name) +
        "&trigger_print=1" +
        "&format=" +
        print_format +
        "&no_letterhead=" +
        letter_head;
      const printWindow = window.open(url, "Print");
      printWindow.addEventListener(
        "load",
        function () {
          printWindow.print();
          // printWindow.close();
          // NOTE : uncomoent this to auto closing printing window
        },
        true
      );
    },
    validate_due_date() {
      const today = frappe.datetime.now_date();
      const parse_today = Date.parse(today);
      const new_date = Date.parse(this.invoice_doc.due_date);
      if (new_date < parse_today) {
        setTimeout(() => {
          this.invoice_doc.due_date = today;
        }, 0);
      }
    },
    shortPay(e) {
      if (e.key === 'F6' || (e.key === "x" || e.key === "X") && (e.ctrlKey || e.metaKey)) {
        if (!this.vfd_paying || !this.invoice_doc) return; // payment screen only
        e.preventDefault();
        this.confirm_print_dialog = false;
        this.submit();
      }
    },
    shortCancel(e) {
      if (e.key === "Escape" || e.key === "Esc") {
        e.preventDefault();
        if (this.confirm_print_dialog) {
          this.cancel_confirm(); // Esc closes the confirmation, stays on payment
          return;
        }
        this.back_to_invoice();
      }
    },
    shortSubmit(e) {
      if (e.key === 'F8' || e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        if (!this.vfd_paying || !this.invoice_doc) return; // payment screen only
        e.preventDefault();
        this.confirm_print_dialog = false;
        this.submit(undefined, false, true);
      }
    },
    set_paid_change() {
      if (!this.paid_change) this.paid_change = 0;

      this.paid_change_rules = [];
      let change = -this.diff_payment;
      if (this.paid_change > change) {
        this.paid_change_rules = [
          "Paid change can not be greater than total change!",
        ];
        this.credit_change = 0;
      }
    },
    get_available_credit(e) {
      this.clear_all_amounts();
      if (e && offlinePos.useOffline()) {
        this.redeem_customer_credit = false;
        evntBus.$emit("show_mesage", { text: __("Customer credit needs the server"), color: "warning" });
        return;
      }
      if (e) {
        frappe
          .call("posawesome.posawesome.api.posapp.get_available_credit", {
            customer: this.invoice_doc.customer,
            company: this.pos_profile.company,
          })
          .then((r) => {
            const data = r.message;
            if (data.length) {
              const amount =
                this.invoice_doc.rounded_total || this.invoice_doc.grand_total;
              let remainAmount = amount;

              data.forEach((row) => {
                if (remainAmount > 0) {
                  if (remainAmount >= row.total_credit) {
                    row.credit_to_redeem = row.total_credit;
                    remainAmount = remainAmount - row.total_credit;
                  } else {
                    row.credit_to_redeem = remainAmount;
                    remainAmount = 0;
                  }
                } else {
                  row.credit_to_redeem = 0;
                }
              });

              this.customer_credit_dict = data;
            } else {
              this.customer_credit_dict = [];
            }
          });
      } else {
        this.customer_credit_dict = [];
      }
    },
    get_addresses() {
      const vm = this;
      if (!vm.invoice_doc || offlinePos.useOffline()) {
        return;
      }
      frappe.call({
        method: "posawesome.posawesome.api.posapp.get_customer_addresses",
        args: { customer: vm.invoice_doc.customer },
        async: true,
        callback: function (r) {
          if (!r.exc) {
            vm.addresses = r.message;
          } else {
            vm.addresses = [];
          }
        },
      });
    },
    addressFilter(item, queryText, itemText) {
      const textOne = item.address_title
        ? item.address_title.toLowerCase()
        : "";
      const textTwo = item.address_line1
        ? item.address_line1.toLowerCase()
        : "";
      const textThree = item.address_line2
        ? item.address_line2.toLowerCase()
        : "";
      const textFour = item.city ? item.city.toLowerCase() : "";
      const textFifth = item.name.toLowerCase();
      const searchText = queryText.toLowerCase();
      return (
        textOne.indexOf(searchText) > -1 ||
        textTwo.indexOf(searchText) > -1 ||
        textThree.indexOf(searchText) > -1 ||
        textFour.indexOf(searchText) > -1 ||
        textFifth.indexOf(searchText) > -1
      );
    },
    new_address() {
      evntBus.$emit("open_new_address", this.invoice_doc.customer);
    },
    get_sales_person_names() {
      const vm = this;
      if (
        vm.pos_profile.posa_local_storage &&
        localStorage.sales_persons_storage
      ) {
        vm.sales_persons = JSON.parse(
          localStorage.getItem("sales_persons_storage")
        );
      }
      if (offlinePos.useOffline()) {
        const boot = offlinePos.catalog.getMeta("bootstrap");
        if (boot && boot.sales_persons) vm.sales_persons = boot.sales_persons;
        return;
      }
      frappe.call({
        method: "posawesome.posawesome.api.posapp.get_sales_person_names",
        callback: function (r) {
          if (r.message) {
            vm.sales_persons = r.message;
            if (vm.pos_profile.posa_local_storage) {
              localStorage.setItem("sales_persons_storage", "");
              localStorage.setItem(
                "sales_persons_storage",
                JSON.stringify(r.message)
              );
            }
          }
        },
      });
    },
    salesPersonFilter(item, queryText, itemText) {
      const textOne = item.sales_person_name
        ? item.sales_person_name.toLowerCase()
        : "";
      const textTwo = item.name.toLowerCase();
      const searchText = queryText.toLowerCase();

      return (
        textOne.indexOf(searchText) > -1 || textTwo.indexOf(searchText) > -1
      );
    },
    request_payment() {
      this.phone_dialog = false;
      const vm = this;
      if (offlinePos.useOffline()) {
        evntBus.$emit("show_mesage", { text: __("Phone payments need the server"), color: "error" });
        return;
      }
      if (!this.invoice_doc.contact_mobile) {
        evntBus.$emit("show_mesage", {
          text: __(`Pleas Set Customer Mobile Number`),
          color: "error",
        });
        evntBus.$emit("open_edit_customer");
        this.back_to_invoice();
        return;
      }
      evntBus.$emit("freeze", {
        title: __(`Waiting for payment... `),
      });
      this.invoice_doc.payments.forEach((payment) => {
        payment.amount = flt(payment.amount);
      });
      let formData = { ...this.invoice_doc };
      formData["total_change"] = -this.diff_payment;
      formData["paid_change"] = this.paid_change;
      formData["credit_change"] = -this.credit_change;
      formData["redeemed_customer_credit"] = this.redeemed_customer_credit;
      formData["customer_credit_dict"] = this.customer_credit_dict;
      formData["is_cashback"] = this.is_cashback;

      frappe
        .call({
          method: "posawesome.posawesome.api.posapp.update_invoice",
          args: {
            data: formData,
          },
          async: false,
          callback: function (r) {
            if (r.message) {
              vm.invoice_doc = r.message;
            }
          },
        })
        .then(() => {
          frappe
            .call({
              method: "posawesome.posawesome.api.posapp.create_payment_request",
              args: {
                doc: vm.invoice_doc,
              },
            })
            .fail(() => {
              evntBus.$emit("unfreeze");
              evntBus.$emit("show_mesage", {
                text: __(`Payment request failed`),
                color: "error",
              });
            })
            .then(({ message }) => {
              const payment_request_name = message.name;
              setTimeout(() => {
                frappe.db
                  .get_value("Payment Request", payment_request_name, [
                    "status",
                    "grand_total",
                  ])
                  .then(({ message }) => {
                    if (message.status != "Paid") {
                      evntBus.$emit("unfreeze");
                      evntBus.$emit("show_mesage", {
                        text: __(
                          `Payment Request took too long to respond. Please try requesting for payment again`
                        ),
                        color: "error",
                      });
                    } else {
                      evntBus.$emit("unfreeze");
                      evntBus.$emit("show_mesage", {
                        text: __("Payment of {0} received successfully.", [
                          vm.formtCurrency(
                            message.grand_total,
                            vm.invoice_doc.currency,
                            0
                          ),
                        ]),
                        color: "success",
                      });
                      frappe.db
                        .get_doc("Sales Invoice", vm.invoice_doc.name)
                        .then((doc) => {
                          vm.invoice_doc = doc;
                          vm.submit(null, true);
                        });
                    }
                  });
              }, 30000);
            });
        });
    },
    get_mpesa_modes() {
      const vm = this;
      if (offlinePos.useOffline()) return;
      frappe.call({
        method: "posawesome.posawesome.api.m_pesa.get_mpesa_mode_of_payment",
        args: { company: vm.pos_profile.company },
        async: true,
        callback: function (r) {
          if (!r.exc) {
            vm.mpesa_modes = r.message;
          } else {
            vm.mpesa_modes = [];
          }
        },
      });
    },
    is_mpesa_c2b_payment(payment) {
      if (
        this.mpesa_modes.includes(payment.mode_of_payment) &&
        payment.type == "Bank"
      ) {
        payment.amount = 0;
        return true;
      } else {
        return false;
      }
    },
    mpesa_c2b_dialg(payment) {
      const data = {
        company: this.pos_profile.company,
        mode_of_payment: payment.mode_of_payment,
        customer: this.invoice_doc.customer,
      };
      evntBus.$emit("open_mpesa_payments", data);
    },
    set_mpesa_payment(payment) {
      this.pos_profile.use_customer_credit = 1;
      this.redeem_customer_credit = true;
      const invoiceAmount =
        this.invoice_doc.rounded_total || this.invoice_doc.grand_total;
      let amount =
        payment.unallocated_amount > invoiceAmount
          ? invoiceAmount
          : payment.unallocated_amount;
      if (amount < 0 || !amount) amount = 0;
      const advance = {
        type: "Advance",
        credit_origin: payment.name,
        total_credit: flt(payment.unallocated_amount),
        credit_to_redeem: flt(amount),
      };
      this.clear_all_amounts();
      this.customer_credit_dict.push(advance);
    },
  },

  computed: {
    // Payment lines shown in the confirmation (modes with an amount).
    confirm_payments() {
      if (!this.invoice_doc || !this.invoice_doc.payments) return [];
      return this.invoice_doc.payments.filter((payment) => this.flt(payment.amount) != 0);
    },
    // Pole display while paying: total due and the amount typed so far.
    vfd_payment() {
      if (!this.vfd_paying || !this.invoice_doc || !this.pos_profile || !this.pos_profile.posa_enable_vfd) return "";
      if (this.invoice_doc.is_return) return "";
      return `${this.invoice_doc.rounded_total || this.invoice_doc.grand_total}|${this.total_payments}`;
    },
    total_payments() {
      let total = this.flt(this.invoice_doc.loyalty_amount); // undefined on locally built invoices
      if (this.invoice_doc && this.invoice_doc.payments) {
        this.invoice_doc.payments.forEach((payment) => {
          total += this.flt(payment.amount);
        });
      }

      total += this.flt(this.redeemed_customer_credit);

      if (!this.is_cashback) total = 0;

      return this.flt(total, this.currency_precision);
    },
    outstanding_color() {
      return this.customer_outstanding > 0 ? "warning" : "white";
    },
    diff_payment() {
      let diff_payment = this.flt(
        (this.invoice_doc.rounded_total || this.invoice_doc.grand_total) -
          this.total_payments,
        this.currency_precision
      );
      this.paid_change = -diff_payment;
      return diff_payment;
    },
    credit_change() {
      let change = -this.diff_payment;
      if (this.paid_change > change) return 0;
      return this.flt(this.paid_change - change, this.currency_precision);
    },
    diff_lable() {
      let lable = this.diff_payment < 0 ? "Change" : "To Be Paid";
      return lable;
    },
    diff_color() {
      return this.diff_payment > 0 ? "warning" : "white";
    },
    available_pioints_amount() {
      let amount = 0;
      if (this.customer_info.loyalty_points) {
        amount =
          this.customer_info.loyalty_points *
          this.customer_info.conversion_factor;
      }
      return amount;
    },
    available_customer_credit() {
      let total = 0;
      this.customer_credit_dict.map((row) => {
        total += row.total_credit;
      });

      return total;
    },
    redeemed_customer_credit() {
      let total = 0;
      this.customer_credit_dict.map((row) => {
        if (flt(row.credit_to_redeem)) total += flt(row.credit_to_redeem);
        else row.credit_to_redeem = 0;
      });

      return total;
    },
    vaildatPayment() {
      if (this.pos_profile.posa_allow_sales_order) {
        if (
          this.invoiceType == "Order" &&
          !this.invoice_doc.posa_delivery_date
        ) {
          return true;
        } else {
          return false;
        }
      } else {
        return false;
      }
    },
    request_payment_field() {
      let res = false;
      if (!this.pos_settings || this.pos_settings.invoice_fields.length == 0) {
        res = false;
      } else {
        this.pos_settings.invoice_fields.forEach((el) => {
          if (
            el.fieldtype == "Button" &&
            el.fieldname == "request_for_payment"
          ) {
            res = true;
          }
        });
      }
      return res;
    },
  },

  mounted: function () {
    this.$nextTick(function () {
      evntBus.$on("show_payment", (data) => {
        this.vfd_paying = data === "true";
      });
      evntBus.$on("send_invoice_doc_payment", (invoice_doc) => {
        this.invoice_doc = invoice_doc;
        this.vfd_paying = true;
        const default_payment = this.invoice_doc.payments.find(
          (payment) => payment.default == 1
        );
        this.is_credit_sale = 0;
        this.is_write_off_change = 0;
        if (default_payment && !invoice_doc.is_return) {
          default_payment.amount = this.flt(
            invoice_doc.rounded_total || invoice_doc.grand_total,
            this.currency_precision
          );
        }
        if (invoice_doc.is_return) {
          this.is_return = true;
          invoice_doc.payments.forEach((payment) => {
            payment.amount = 0;
            payment.base_amount = 0;
          });
        }
        this.loyalty_amount = 0;
        this.get_addresses();
        this.get_sales_person_names();
        // cursor in the default mode of payment, its amount selected
        if (!invoice_doc.is_return) this.$nextTick(() => this.focus_default_payment());
      });
      evntBus.$on("register_pos_profile", (data) => {
        this.pos_profile = data.pos_profile;
        this.get_mpesa_modes();
      });
      evntBus.$on("add_the_new_address", (data) => {
        this.addresses.push(data);
        this.$forceUpdate();
      });
      evntBus.$on("update_invoice_type", (data) => {
        this.invoiceType = data;
        if (this.invoice_doc && data != "Order") {
          this.invoice_doc.posa_delivery_date = null;
          this.invoice_doc.posa_notes = null;
          this.invoice_doc.shipping_address_name = null;
        }
      });
    });
    evntBus.$on("update_customer", (customer) => {
      if (this.customer != customer) {
        this.customer_credit_dict = [];
        this.redeem_customer_credit = false;
        this.is_cashback = true;
      }
    });
    evntBus.$on("set_pos_settings", (data) => {
      this.pos_settings = data;
    });
    evntBus.$on("set_customer_info_to_edit", (data) => {
      this.customer_info = data;
    });
    evntBus.$on("set_mpesa_payment", (data) => {
      this.set_mpesa_payment(data);
    });
  },
  created() {
    document.addEventListener("keydown", this.shortPay.bind(this));
    document.addEventListener("keydown", this.shortCancel);
    document.addEventListener("keydown", this.shortSubmit);
  },
  beforeUnmount() {
    evntBus.$off("send_invoice_doc_payment");
    evntBus.$off("register_pos_profile");
    evntBus.$off("add_the_new_address");
    evntBus.$off("update_invoice_type");
    evntBus.$off("update_customer");
    evntBus.$off("set_pos_settings");
    evntBus.$off("set_customer_info_to_edit");
    evntBus.$off("update_invoice_coupons");
    evntBus.$off("set_mpesa_payment");
  },

  unmounted() {
    document.removeEventListener("keydown", this.shortPay);
    document.removeEventListener("keydown", this.shortCancel);
    document.removeEventListener("keydown", this.shortSubmit);
  },

  watch: {
  vfd_paying(v) {
    if (!v) vfd.endPayment();
  },
  vfd_payment(v) {
    if (!v) return;
    vfd.showTotal(
      this.invoice_doc.rounded_total || this.invoice_doc.grand_total,
      this.total_payments,
      this.currencySymbol ? this.currencySymbol(this.invoice_doc.currency || this.pos_profile.currency) : ""
    );
  },
  invoice_doc: {
    deep: true,
    handler(val) {
      if (val.customer) {
        this.fetchCustomerOutstanding(val.customer);
      }
    }
  },
    loyalty_amount(value) {
      if (value > this.available_pioints_amount) {
        this.invoice_doc.loyalty_amount = 0;
        this.invoice_doc.redeem_loyalty_points = 0;
        this.invoice_doc.loyalty_points = 0;
        evntBus.$emit("show_mesage", {
          text: `Loyalty Amount can not be more then ${this.available_pioints_amount}`,
          color: "error",
        });
      } else {
        this.invoice_doc.loyalty_amount = this.flt(this.loyalty_amount);
        this.invoice_doc.redeem_loyalty_points = 1;
        this.invoice_doc.loyalty_points =
          this.flt(this.loyalty_amount) / this.customer_info.conversion_factor;
      }
    },
    is_credit_sale(value) {
      if (value == true) {
        console.log("Credit sale enabled, setting payments to zero");
        this.invoice_doc.payments.forEach((payment) => {
          payment.amount = 0;
          payment.base_amount = 0;
        });
      }
    },
    is_write_off_change(value) {
      if (value == 1) {
        this.invoice_doc.write_off_amount = this.diff_payment;
        this.invoice_doc.write_off_outstanding_amount_automatically = 1;
      } else {
        this.invoice_doc.write_off_amount = 0;
        this.invoice_doc.write_off_outstanding_amount_automatically = 0;
      }
    },
    redeemed_customer_credit(value) {
      if (value > this.available_customer_credit) {
        evntBus.$emit("show_mesage", {
          text: `You can redeem customer credit upto ${this.available_customer_credit}`,
          color: "error",
        });
      }
    },
    sales_person() {
      if (this.sales_person) {
        this.invoice_doc.sales_team = [
          {
            sales_person: this.sales_person,
            allocated_percentage: 100,
          },
        ];
      } else {
        this.invoice_doc.sales_team = [];
      }
    },
  },
};
</script>
<style scoped>
/* Payment confirmation (Enter in a payment amount) */
.confirm-header {
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  border-bottom: 1px solid #e0e0e0;
  padding: 24px !important;
}
.header-content {
  display: flex;
  align-items: center;
  gap: 20px;
  width: 100%;
}
.header-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  background: linear-gradient(135deg, #388e3c 0%, #2e7d32 100%);
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(46, 125, 50, 0.3);
}
.header-icon {
  color: white !important;
}
.header-text {
  flex: 1;
  white-space: normal;
}
.header-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 4px 0;
  line-height: 1.2;
}
.header-subtitle {
  font-size: 0.95rem;
  color: #666;
  margin: 0;
  font-weight: 400;
  word-break: normal;
}
.header-divider {
  border-color: #e0e0e0;
}
.white-background {
  background-color: #ffffff;
}
.form-header {
  padding: 0 4px;
}
.total-box {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-radius: 12px;
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(25, 118, 210, 0.25);
}
.total-label {
  font-size: 1rem;
  font-weight: 500;
}
.total-value {
  font-size: 1.6rem;
  font-weight: 700;
}
.white-table {
  background-color: white;
  border: 1px solid #e0e0e0;
}
.white-table td {
  padding: 8px 12px !important;
  border-bottom: 1px solid #e0e0e0 !important;
  font-size: 0.95rem !important;
}
.paid-row td {
  background: #f5f5f5;
  font-weight: 700;
  color: #424242;
}
.info-row {
  display: flex;
  justify-content: space-between;
  padding: 0 4px;
  font-size: 1rem;
  color: #424242;
}
.change-box,
.credit-box,
.due-box,
.refund-box {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 1.05rem;
}
.change-box {
  background: #fff9c4;
  border: 2px solid #fbc02d;
  color: #5d4037;
}
.change-box .box-value {
  font-size: 1.6rem;
}
.credit-box {
  background: #e3f2fd;
  border: 1px solid #90caf9;
  color: #0d47a1;
}
.refund-box {
  background: #f3e5f5;
  border: 2px solid #ab47bc;
  color: #4a148c;
}
.due-box {
  background: #fff3e0;
  border: 2px solid #fb8c00;
  color: #bf360c;
}
.box-value {
  font-size: 1.3rem;
  font-weight: 700;
  white-space: nowrap;
}
.box-hint {
  font-size: 0.8rem;
  font-weight: 400;
  opacity: 0.8;
  margin-left: 32px;
}
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
  padding: 0 12px;
  flex: 1 1 0; /* three buttons share the row: none is cut off */
  min-width: 0;
  letter-spacing: normal;
  font-size: 0.95rem;
  transition: all 0.3s ease;
  color: white !important;
}
.pos-action-btn .v-icon,
.pos-action-btn span {
  color: white !important;
}
.submit-only-btn {
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%) !important;
}
.submit-action-btn {
  background: linear-gradient(135deg, #388e3c 0%, #2e7d32 100%) !important;
}
.cancel-action-btn {
  background: linear-gradient(135deg, #d32f2f 0%, #c62828 100%) !important;
}
/* the focused button (Enter presses it) stands out */
.pos-action-btn:focus-visible,
.pos-action-btn:focus {
  outline: 3px solid #ffb300;
  outline-offset: 2px;
  transform: translateY(-2px);
}
.submit-only-btn:hover {
  box-shadow: 0 6px 20px rgba(25, 118, 210, 0.4);
}
.submit-action-btn:hover {
  box-shadow: 0 6px 20px rgba(46, 125, 50, 0.4);
}
.cancel-action-btn:hover {
  box-shadow: 0 6px 20px rgba(211, 47, 47, 0.4);
}
@media (max-width: 768px) {
  .dialog-actions-container {
    flex-direction: column;
  }
  .pos-action-btn {
    width: 100%;
  }
  .confirm-header {
    padding: 16px !important;
  }
  .header-icon-wrapper {
    width: 48px;
    height: 48px;
  }
  .header-title {
    font-size: 1.25rem;
  }
  .total-value,
  .change-box .box-value {
    font-size: 1.3rem;
  }
}
/* dark theme (Vuetify 3 class; v14 used .theme--dark) */
.v-theme--dark .confirm-header,
.v-theme--dark .dialog-actions-container {
  background: linear-gradient(135deg, #1e1e1e 0%, #121212 100%) !important;
  border-color: #333 !important;
}
.v-theme--dark .white-background,
.v-theme--dark .white-table {
  background-color: #1e1e1e !important;
}
.v-theme--dark .white-table td {
  border-bottom: 1px solid #333 !important;
}
.v-theme--dark .paid-row td {
  background: #333;
  color: #e0e0e0;
}
.v-theme--dark .header-title,
.v-theme--dark .info-row {
  color: #e0e0e0 !important;
}
.v-theme--dark .header-subtitle {
  color: #aaa !important;
}
</style>