<template>
  <div>

<v-dialog v-model="itemDialog" max-width="450" persistent>
    <v-card>
        <v-toolbar density="compact" flat color="primary">
            <v-toolbar-title>{{ selectedItem ? selectedItem.item_name : '' }}</v-toolbar-title>
            <v-spacer></v-spacer>
            <v-btn icon @click="closeItemDialog" @keydown.enter="closeItemDialog" @keydown.esc="closeItemDialog">
                <v-icon>mdi-close</v-icon>
            </v-btn>
        </v-toolbar>

        <!-- <v-divider></v-divider> -->

        <v-card-text class="pa-4">
        </v-card-text>
            <div class="text-center mt-3">
                <h4>Quantity</h4>
                <v-row justify="center" align="center">
                  <v-col cols="auto">
                    <v-btn
                      icon
                      color="secondary"
                      @click="minusQty"
                    >
                      <v-icon>mdi-minus-circle-outline</v-icon>
                    </v-btn>
                  </v-col>
                  <v-col cols="auto">
                    <v-text-field
                        v-if="selectedItem"
                        v-model.number="selectedItem.qty"
                        density="compact"
                        variant="outlined"
                        hide-details
                        type="number"
                        step="0.001"
                        min="0"
                        class="mx-3"
                        style="max-width:120px"
                        ref="qtyField"
                        @focus="selectAllText"
                        @change="updateItemQty($event.target.value)"
                    ></v-text-field>
                  </v-col>
                  <v-col cols="auto">
                    <v-btn
                      icon
                      color="secondary"
                      @click="plusQty"
                    >
                      <v-icon>mdi-plus-circle-outline</v-icon>
                    </v-btn>
                  </v-col>

                </v-row>
            </div>

            <!-- Quick Notes -->
            <div v-if="selectedItem" class="mt-5" justify="center" align="center">
                <h4>Quick Notes</h4>
                <v-chip
                    v-for="note in quickNotes"
                    :key="note"
                    class="ma-1"
                    size="small"
                    color="primary"
                    variant="outlined"
                    @click="addQuickNote(note)"
                >
                    {{ note }}
                </v-chip>
            </div>

            <!-- Additional Notes -->
            <v-textarea
                v-if="selectedItem"
                v-model="selectedItem.posa_notes"
                class="mt-4"
                variant="outlined"
                density="compact"
                auto-grow
                rows="2"
                label="Additional Notes"
            ></v-textarea>
        <v-divider></v-divider>

        <v-card-actions>
            <v-btn color="error" variant="text" @click="deleteSelectedItem">
                <v-icon start>mdi-delete</v-icon>
                Delete
            </v-btn>
                  <v-col cols="auto">
                    <div class="qty-number">
                        {{ selectedItem ? formtFloat(selectedItem.qty) : "0" }}
                    </div>
                  </v-col>

            <v-spacer></v-spacer>
            <v-btn variant="text" @click="closeItemDialog" @keydown.enter="closeItemDialog">
                Cancel
            </v-btn>

            <v-btn color="primary" @click="saveItemChanges">
                Save
            </v-btn>
        </v-card-actions>
    </v-card>
</v-dialog>

<v-dialog v-model="tableDialog" max-width="900" persistent>
    <v-card>
        <v-toolbar density="compact" flat color="primary">
            <v-toolbar-title>
                Select Table
            </v-toolbar-title>

            <v-spacer></v-spacer>

            <v-btn icon @click="tableDialog = false">
                <v-icon>mdi-close</v-icon>
            </v-btn>
        </v-toolbar>

        <v-card-text class="pa-4">
            <!-- Service Zones -->
            <div class="mb-4">
                <h3 class="mb-2">Service Zone</h3>
                <v-chip
                    v-for="zone in service_zone"
                    :key="zone.name"
                    class="ma-2"
                    :color="selectedZone === zone.name ? 'primary' : ''"
                    :variant="(selectedZone !== zone.name) ? 'outlined' : 'flat'"
                    @click="selectedZone = zone.name"
                >
                    {{ zone.name }}
                </v-chip>
            </div>

            <v-divider class="mb-4"></v-divider>

            <!-- Tables -->
            <v-row>
                <v-col
                    v-for="table in filteredTables"
                    :key="table.name"
                    cols="4"
                    sm="3"
                    md="2"
                >
                    <v-card
                        class="table-card"
                        :class="{
                            'table-selected': selectedTable === table.name,
                            'table-disabled': table.status === 'occupied' && !is_take_away
                        }"
                        :color="tableColor(table)"
                        :disabled="table.status === 'occupied' && !is_take_away"
                        @click="!(table.status === 'occupied' && !is_take_away) && selectTable(table)"
                    >
                        <v-card-text class="text-center">
                            <v-icon size="large" :color="statusColor(table.status)">
                                {{ tableIcon(table) }}
                            </v-icon>

                            <div class="text-h6">
                                {{ table.name }}
                            </div>

                            <div>
                                Seats {{ table.no_of_seats }}
                            </div>
                            <v-chip size="small" :color="statusColor(table.status)">
                                {{table.status}}
                            </v-chip>
                        </v-card-text>
                    </v-card>
                </v-col>
            </v-row>
        </v-card-text>

        <v-divider></v-divider>

        <v-card-actions>
            <v-spacer></v-spacer>

            <v-btn variant="text" @click="tableDialog = false">
                Cancel
            </v-btn>

            <v-btn
                color="primary"
                :disabled="!selectedTable"
                @click="confirmTableSelection"
            >
                Confirm
            </v-btn>
        </v-card-actions>
    </v-card>
</v-dialog>

    <v-dialog v-model="cancel_dialog" max-width="330" @keydown.enter="cancel_invoice">
      <v-card elevation="8" class="cancel-dialog-card">
        <v-card-title class="cancel-header pa-4">
          <div class="header-content">
            <div class="header-icon-wrapper">
              <v-icon class="header-icon" size="32">mdi-alert</v-icon>
            </div>
            <div class="header-text">
              <h3 class="header-title">{{ __('Cancel Current Invoice?') }}</h3>
            </div>
          </div>
        </v-card-title>
        <span>
          {{ __('Are you sure you want to cancel the current invoice?') }}
          <br />
          <h3 class="text-medium-emphasis">
            {{ __('All unsaved data will be permanently lost.') }}
          </h3>
        </span>
        <v-divider class="header-divider"></v-divider>
        <v-card-actions class="dialog-actions-container">
          <v-spacer></v-spacer>
          <v-btn
            color="error"
            @click="cancel_invoice"
            ref="cancelBtn"
            class="pos-action-btn cancel-action-btn"
            prepend-icon="mdi-close-circle"
          >
            {{ __('Cancel') }}
          </v-btn>
          <v-btn
            color="warning"
            @click="cancel_dialog = false"
            class="pos-action-btn back-action-btn"
            prepend-icon="mdi-arrow-left"
          >
            {{ __('Back') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
<v-dialog
  v-model="tax_dialog"
  max-width="420"
  persistent
  @keydown="handleTaxDialogKey"
>
  <v-card elevation="8" class="tax-selection-card" tabindex="0">
    <v-card-title class="tax-header pa-4">
      <div class="header-content">
        <v-icon size="32" color="primary">mdi-cash-register</v-icon>
        <div class="ml-3">
          <h3 class="header-title">
            {{ __('Select Payment Method for Tax Calculation') }}
          </h3>
          <p class="header-subtitle">
            {{ __('Cash: 16% Tax | Card: 5% Tax') }}
          </p>
        </div>
      </div>
    </v-card-title>

    <v-divider />

    <v-card-actions class="pa-4">
      <v-spacer />

      <v-btn
        ref="cashBtn"
        color="primary"
        class="pos-action-btn tax-btn mr-2"
        prepend-icon="mdi-cash"
        :variant="(selected_tax !== 'cash') ? 'outlined' : 'elevated'"
        @click="selectTax('cash')"
      >
        {{ __('Cash') }}
      </v-btn>

      <v-btn
        ref="cardBtn"
        color="secondary"
        class="pos-action-btn tax-btn mr-2"
        prepend-icon="mdi-credit-card"
        :variant="(selected_tax !== 'card') ? 'outlined' : 'elevated'"
        @click="selectTax('card')"
      >
        {{ __('Card') }}
      </v-btn>

      <v-btn
        color="error"
        class="pos-action-btn"
        prepend-icon="mdi-arrow-left"
        @click="closeTaxDialog"
      >
        {{ __('Back') }}
      </v-btn>
    </v-card-actions>
  </v-card>
</v-dialog>
    <v-card
      style="max-height: 70vh; height: 70vh"
      class="cards my-0 py-0 mt-3 bg-grey-lighten-5"
      :class="{ 'return-mode': isReturnMode }"
    >

      <v-row class="items px-2 py-1">
        <!-- ================= ORDER TYPE ================= -->
        <v-col v-if="pos_profile.posa_allow_order_type" cols="6" class="pb-1">
            <v-row class="items pb-0 pr-0 pt-2 px-0 mb-0" style="overflow-x:auto; white-space:nowrap;">
                <v-col
                    v-for="type in order_type"
                    :key="type.name"
                    cols="auto"
                    class="px-0 py-1"
                >
                    <v-chip
                        size="small"
                        class="ma-1 font-weight-bold"
                        :color="selcted_order_type==type.name ? 'primary' : ''"
                        :variant="(selcted_order_type!=type.name) ? 'outlined' : 'flat'"
                        @click="selectOrderType(type)"
                    >
                        {{type.name}}
                    </v-chip>
                </v-col>
            </v-row>
        </v-col>
      </v-row>
      <v-row class="items px-2 py-1 mt-0">
        <v-col
          v-if="pos_profile.posa_allow_sales_order || pos_profile.allow_service_zone || pos_profile.posa_allow_order_type"
          class="pb-2 pr-0"
        >
          <Customer></Customer>
          <RFIDPopup ref="rfidPopup" />
        </v-col>
        <v-col
          v-if="!pos_profile.posa_allow_sales_order && !pos_profile.allow_service_zone && !pos_profile.posa_allow_order_type"
          cols="12"
          class="pb-2"
        >
          <Customer></Customer>
          <RFIDPopup ref="rfidPopup" />
        </v-col>
        <v-col v-if="pos_profile.posa_allow_sales_order" cols="3" class="pb-2">
          <v-select
            density="compact"
            hide-details
            variant="outlined"
            color="primary"
            bg-color="white"
            :items="invoiceTypes"
            :label="frappe._('Type')"
            v-model="invoiceType"
            :disabled="invoiceType == 'Return'" item-title="text"
          ></v-select>
        </v-col>
        <v-col v-if="pos_profile.allow_service_zone" cols="2" class="pb-2">
          <v-select
            density="compact"
            hide-details
            variant="outlined"
            color="primary"
            bg-color="white"
            :items="service_zone"
            item-title="name"
            item-value="value"
            :label="frappe._('Zone')"
            v-model="selcted_service_zone"
            :disabled="invoiceType == 'Return'"
          ></v-select>
        </v-col>
<v-col v-if="pos_profile.posa_allow_order_type" cols="2" class="pb-2 d-flex align-center">
  <v-chip
    color="primary"
    label
    class="font-weight-bold"
    v-if="selcted_service_zone"
  >
    <v-icon start size="small">mdi-table-furniture</v-icon>
    {{ selcted_service_zone }}
  </v-chip>

  <v-chip
    variant="outlined"
    color="grey"
    v-else
  >
    <v-icon start size="small">mdi-table-furniture</v-icon>
    {{ __("Zone") }}
  </v-chip>
</v-col>

<v-col v-if="pos_profile.posa_allow_order_type" cols="2" class="pb-2 d-flex align-center">
  <v-chip
    color="primary"
    label
    class="font-weight-bold"
    v-if="selcted_service_table"
  >
    <v-icon start size="small">mdi-table-furniture</v-icon>
    {{ selcted_service_table }}
  </v-chip>

  <v-chip
    variant="outlined"
    color="grey"
    v-else
  >
    <v-icon start size="small">mdi-table-furniture</v-icon>
    {{ __("No Table") }}
  </v-chip>
</v-col>
        <!-- <v-col v-if="pos_profile.posa_allow_order_type" cols="2" class="pb-2"> -->
        <!--   <v-select -->
        <!--     dense -->
        <!--     hide-details -->
        <!--     outlined -->
        <!--     color="primary" -->
        <!--     background-color="white" -->
        <!--     :items="service_table" -->
        <!--     item-text="name" -->
        <!--     item-value="value" -->
        <!--     :label="frappe._('Table')" -->
        <!--     v-model="selcted_service_table" -->
        <!--     :disabled="invoiceType == 'Return'" -->
        <!--   ></v-select> -->
        <!-- </v-col> -->
      </v-row>
      <v-row
        align="center"
        class="items px-2 py-1 mt-0 pt-0"
        v-if="pos_profile.posa_use_delivery_charges"
      >
        <v-col cols="8" class="pb-0 mb-0 pr-0 pt-0">
          <v-autocomplete
            density="compact"
            clearable
            auto-select-first
            variant="outlined"
            color="primary"
            :label="frappe._('Delivery Charges')"
            v-model="selcted_delivery_charges"
            :items="delivery_charges"
            item-title="name"
            return-object
            bg-color="white"
            :no-data-text="__('Charges not found')"
            hide-details
            :custom-filter="(itemText, queryText, internal) => deliveryChargesFilter(internal.raw, queryText, itemText)"
            :disabled="readonly"
            @update:model-value="update_delivery_charges()"
          >
            <template v-slot:item="data">
<v-list-item v-bind="data.props" :title="null">
                  <v-list-item-title
                    class="text-primary text-subtitle-1"
                    v-html="data.item.raw.name"
                  ></v-list-item-title>
                  <v-list-item-subtitle
                    v-html="`Rate: ${data.item.raw.rate}`"
                  ></v-list-item-subtitle>
                </v-list-item>
              
            </template>
          </v-autocomplete>
        </v-col>
        <v-col cols="4" class="pb-0 mb-0 pt-0">
          <v-text-field
            density="compact"
            variant="outlined"
            color="primary"
            :label="frappe._('Delivery Charges Rate')"
            bg-color="white"
            hide-details
            :model-value="formtCurrency(delivery_charges_rate)"
            :prefix="currencySymbol(pos_profile.currency)"
            disabled
          ></v-text-field>
        </v-col>
      </v-row>
      <v-row
        align="center"
        class="items px-2 py-1 mt-0 pt-0"
        v-if="pos_profile.posa_allow_change_posting_date"
      >
        <v-col
          v-if="pos_profile.posa_allow_change_posting_date"
          cols="4"
          class="pb-2"
        >
          <v-menu
            ref="invoice_posting_date"
            v-model="invoice_posting_date"
            :close-on-content-click="false"
            transition="scale-transition"
          >
            <template v-slot:activator="{ props }">
              <v-text-field
                v-model="posting_date"
                :label="frappe._('Posting Date')"
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
              v-model="posting_date"
              color="primary"
              :min="
                frappe.datetime.add_days(frappe.datetime.now_date(true), -7)
              "
              :max="frappe.datetime.add_days(frappe.datetime.now_date(true), 7)"
              @update:model-value="invoice_posting_date = false"
            >
            </pos-date-picker>
          </v-menu>
        </v-col>
      </v-row>

      <v-row align="center" class="items px-2 py-1 mt-0 pt-0">
        <v-col cols="6" class="pb-2" v-if="pos_profile.posa_display_customer_loyalty_points">
          <v-text-field
              density="compact"
              variant="outlined"
              color="primary"
              :label="frappe._('Loyalty Points')"
              bg-color="white"
              hide-details
              :model-value="formtFloat(available_pioints_amount)"
              :prefix="currencySymbol(invoice_doc.currency)"
              disabled
            ></v-text-field>
        </v-col>
      </v-row>

      <div class="my-0 py-0 overflow-y-auto" style="max-height: 60vh">
        <div @mouseover="style = 'cursor: pointer'">
<v-data-table
    v-if="pos_profile.posa_item_popup_instead_expand"
    :headers="items_headers_rms"
    :items="items"
    item-value="posa_row_id"
    class="elevation-1"
    :items-per-page="itemsPerPage"
    hide-default-footer
    @click:row="(event, row) => openItemDialog(row.item, row)"
    return-object
>
    <template v-slot:item.qty="{ item }">
        {{ formtFloat(item.qty) }}
    </template>

    <template v-slot:item.rate="{ item }">
        {{ currencySymbol(pos_profile.currency) }}
        {{ formtCurrency(item.rate) }}
    </template>

    <template v-slot:item.amount="{ item }">
        {{ currencySymbol(pos_profile.currency) }}
        {{
            formtCurrency(
                flt(item.qty, float_precision) *
                flt(item.rate, currency_precision)
            )
        }}
    </template>

    <template v-slot:item.posa_is_offer="{ item }">
        <v-checkbox-btn
            :model-value="!!item.posa_is_offer || !!item.posa_is_replace"
            disabled
        ></v-checkbox-btn>
    </template>
</v-data-table>

          <v-data-table
            v-if="!pos_profile.posa_item_popup_instead_expand"
            :headers="items_headers"
            :items="items"
            v-model:expanded="expanded"
            show-expand
            item-value="posa_row_id"
            class="elevation-1"
            :items-per-page="itemsPerPage"
            hide-default-footer
            @click:row="(event, row) => onRowClick(row.item, row)"
            return-object
          >
            <template v-slot:item.qty="{ item }">{{
              formtFloat(item.qty)
            }}</template>
            <template v-slot:item.rate="{ item }"
              >{{ currencySymbol(pos_profile.currency) }}
              {{ formtCurrency(item.rate) }}</template>
            <template v-slot:item.amount="{ item }"
              >{{ currencySymbol(pos_profile.currency) }}
              {{
                formtCurrency(
                  flt(item.qty, float_precision) *
                    flt(item.rate, currency_precision)
                )
              }}</template>
            <template v-slot:item.posa_is_offer="{ item }">
              <v-checkbox-btn
                :model-value="!!item.posa_is_offer || !!item.posa_is_replace"
                disabled
              ></v-checkbox-btn>
            </template>

            <template v-slot:expanded-row="{ columns, item }"><tr class="v-data-table__tr">
              <td :colspan="columns.length" class="ma-0 pa-0">
                <v-row class="ma-0 pa-0">
                  <v-col cols="1">
                    <v-btn
                      :disabled="!!item.posa_is_offer || !!item.posa_is_replace"
                      icon
                      color="error"
                      @click.stop="handleRemoveItem(item)"
                    >
                      <v-icon>mdi-delete</v-icon>
                    </v-btn>
                  </v-col>
                  <v-spacer></v-spacer>
                  <v-col cols="1">
                    <v-btn
                      :disabled="!!item.posa_is_offer || !!item.posa_is_replace"
                      icon
                      color="secondary"
                      @click.stop="subtract_one(item)"
                    >
                      <v-icon>mdi-minus-circle-outline</v-icon>
                    </v-btn>
                  </v-col>
                  <v-col cols="1">
                    <v-btn
                      :disabled="!!item.posa_is_offer || !!item.posa_is_replace"
                      icon
                      color="secondary"
                      @click.stop="add_one(item)"
                    >
                      <v-icon>mdi-plus-circle-outline</v-icon>
                    </v-btn>
                  </v-col>
                </v-row>
                <v-row class="ma-0 pa-0">
                  <v-col cols="4">
                    <v-text-field
                      density="compact"
                      variant="outlined"
                      color="primary"
                      :label="frappe._('Item Code')"
                      bg-color="white"
                      hide-details
                      v-model="item.item_code"
                      disabled
                    ></v-text-field>
                  </v-col>
                  <v-col cols="4">
                    <v-text-field
                      ref="qtyField"
                      density="compact"
                      autofocus
                      variant="outlined"
                      color="primary"
                      :label="frappe._('QTY')"
                      bg-color="white"
                      hide-details
                      type="number"
                      :model-value="item.qty"
                      @update:model-value="onQtyInput(item, $event)"
                      @change="
                        [
                          setFormatedFloat(item, 'qty', null, false, $event.target.value),
                          calc_stock_qty(item, $event.target.value),
                          $evntBus.$emit('escEventTriggered'),
                          expandedHandler(),
                        ]
                      "
                      :rules="[isNumber]"
                      :disabled="!!item.posa_is_offer || !!item.posa_is_replace"
                      @focus="selectAllText"
                    ></v-text-field>
                  </v-col>
                  <v-col cols="4">
                    <v-select
                      density="compact"
                      bg-color="white"
                      :label="frappe._('UOM')"
                      v-model="item.uom"
                      :items="item.item_uoms"
                      variant="outlined"
                      item-title="uom"
                      item-value="uom"
                      hide-details
                      @update:model-value="calc_uom(item, $event)"
                      :disabled="
                        !!invoice_doc.is_return ||
                        !!item.posa_is_offer ||
                        !!item.posa_is_replace
                      "
                    >
                    </v-select>
                  </v-col>
                  <v-col cols="4">
                    <v-text-field
                      density="compact"
                      variant="outlined"
                      color="primary"
                      :label="frappe._('Rate')"
                      bg-color="white"
                      hide-details
                      :prefix="currencySymbol(pos_profile.currency)"
                      :model-value="formtCurrency(item.rate)"
                      @change="
                        [
                          setFormatedCurrency(
                            item,
                            'rate',
                            null,
                            false,
                            $event.target.value
                          ),
                          calc_prices(item, $event.target.value),
                          $evntBus.$emit('escEventTriggered'),
                          expandedHandler(),
                        ]
                      "
                      :rules="[isNumber]"
                      id="rate"
                      :disabled="
                        !!item.posa_is_offer ||
                        !!item.posa_is_replace ||
                        !!item.posa_offer_applied ||
                        !pos_profile.posa_allow_user_to_edit_rate ||
                        !!invoice_doc.is_return
                          ? true
                          : false
                      "
                    ></v-text-field>
                  </v-col>
                  <v-col cols="4">
                    <v-text-field
                      density="compact"
                      variant="outlined"
                      color="primary"
                      :label="frappe._('Discount Percentage')"
                      bg-color="white"
                      hide-details
                      :model-value="formtFloat(item.discount_percentage)"
                      @change="
                        [
                          setFormatedCurrency(
                            item,
                            'discount_percentage',
                            null,
                            true,
                            $event.target.value
                          ),
                          calc_prices(item, $event.target.value),
                          checkDiscountPercentage(item, $event.target.value),
                          $evntBus.$emit('escEventTriggered'),
                          expandedHandler(),
                        ]
                      "
                      :rules="[isNumber]"
                      id="discount_percentage"
                      :disabled="
                        !!item.posa_is_offer ||
                        !!item.posa_is_replace ||
                        item.posa_offer_applied ||
                        !pos_profile.posa_allow_user_to_edit_item_discount ||
                        !!invoice_doc.is_return
                          ? true
                          : false
                      "
                      suffix="%"
                    ></v-text-field>
                  </v-col>
                  <v-col cols="4">
                    <v-text-field
                      density="compact"
                      variant="outlined"
                      color="primary"
                      :label="frappe._('Discount Amount')"
                      bg-color="white"
                      hide-details
                      :model-value="formtCurrency(item.discount_amount)"
                      :rules="[isNumber]"
                      @change="
                        [
                          setFormatedCurrency(
                            item,
                            'discount_amount',
                            null,
                            true,
                            $event.target.value
                          ),
                          ,
                          calc_prices(item, $event.target.value),
                          $evntBus.$emit('escEventTriggered'),
                          expandedHandler(),
                        ]
                      "
                      :prefix="currencySymbol(pos_profile.currency)"
                      id="discount_amount"
                      :disabled="
                        !!item.posa_is_offer ||
                        !!item.posa_is_replace ||
                        !!item.posa_offer_applied ||
                        !pos_profile.posa_allow_user_to_edit_item_discount ||
                        !!invoice_doc.is_return
                          ? true
                          : false
                      "
                    ></v-text-field>
                  </v-col>
                  <v-col cols="4">
                    <v-text-field
                      density="compact"
                      variant="outlined"
                      color="primary"
                      :label="frappe._('Price list Rate')"
                      bg-color="white"
                      hide-details
                      :model-value="formtCurrency(item.price_list_rate)"
                      disabled
                      :prefix="currencySymbol(pos_profile.currency)"
                    ></v-text-field>
                  </v-col>
                  <v-col cols="4">
                    <v-text-field
                      density="compact"
                      variant="outlined"
                      color="primary"
                      :label="frappe._('Available QTY')"
                      bg-color="white"
                      hide-details
                      :model-value="formtFloat(item.actual_qty)"
                      disabled
                    ></v-text-field>
                  </v-col>
                  <v-col cols="4" v-if="pos_profile.posa_allow_display_mrp">
                    <v-text-field
                      density="compact"
                      variant="outlined"
                      color="primary"
                      :label="frappe._('MRP')"
                      bg-color="white"
                      hide-details
                      :model-value="formtCurrency(item.maximum_retail_price)"
                      disabled
                    ></v-text-field>
                  </v-col>
                  <v-col cols="4">
                    <v-text-field
                      density="compact"
                      variant="outlined"
                      color="primary"
                      :label="frappe._('Group')"
                      bg-color="white"
                      hide-details
                      v-model="item.item_group"
                      disabled
                    ></v-text-field>
                  </v-col>
                  <v-col cols="4">
                    <v-text-field
                      density="compact"
                      variant="outlined"
                      color="primary"
                      :label="frappe._('Valuation Rate')"
                      bg-color="white"
                      hide-details
                      :model-value="formtCurrency(item.valuation_rate)"
                      disabled
                    ></v-text-field>
                  </v-col>
                  <v-col cols="4">
                    <v-text-field
                      density="compact"
                      variant="outlined"
                      color="primary"
                      :label="frappe._('Stock QTY')"
                      bg-color="white"
                      hide-details
                      :model-value="formtFloat(item.stock_qty)"
                      disabled
                    ></v-text-field>
                  </v-col>
                  <v-col cols="4">
                    <v-text-field
                      density="compact"
                      variant="outlined"
                      color="primary"
                      :label="frappe._('Stock UOM')"
                      bg-color="white"
                      hide-details
                      v-model="item.stock_uom"
                      disabled
                    ></v-text-field>
                  </v-col>
                  <v-col cols="4">
                    <v-text-field
                      density="compact"
                      variant="outlined"
                      color="primary"
                      :label="frappe._('RFID Card')"
                      bg-color="white"
                      hide-details
                      v-model="item.custom_rfid_card"
                      :rules="[isNumber]"
                      id="custom_rfid_card"
                      :disabled="true"
                    ></v-text-field>
                  </v-col>
                  <v-col cols="4">
                    <v-text-field
                      density="compact"
                      variant="outlined"
                      color="primary"
                      :label="frappe._('Sales Person')"
                      bg-color="white"
                      hide-details
                      v-model="item.posa_sales_person"
                      disabled
                    ></v-text-field>
                  </v-col>
                  <v-col align="center" cols="4" v-if="item.posa_offer_applied">
                    <v-checkbox
                      density="compact"
                      :label="frappe._('Offer Applied')"
                      v-model="item.posa_offer_applied"
                      readonly
                      hide-details
                      class="shrink mr-2 mt-0"
                    ></v-checkbox>
                  </v-col>
                  <v-col
                    cols="4"
                    v-if="item.has_serial_no == 1 || item.serial_no"
                  >
                    <v-text-field
                      density="compact"
                      variant="outlined"
                      color="primary"
                      :label="frappe._('Serial No QTY')"
                      bg-color="white"
                      hide-details
                      v-model="item.serial_no_selected_count"
                      type="number"
                      disabled
                    ></v-text-field>
                  </v-col>
                  <v-col
                    cols="12"
                    v-if="item.has_serial_no == 1 || item.serial_no"
                  >
                    <v-autocomplete
                      v-model="item.serial_no_selected"
                      :items="item.serial_no_data"
                      item-title="serial_no"
                      variant="outlined"
                      density="compact"
                      chips
                      color="primary"
                      :label="frappe._('Serial No')"
                      multiple
                      @update:model-value="set_serial_no(item)"
                    ></v-autocomplete>
                  </v-col>
                  <v-col
                    cols="4"
                    v-if="item.has_batch_no == 1 || item.batch_no"
                  >
                    <v-text-field
                      density="compact"
                      variant="outlined"
                      color="primary"
                      :label="frappe._('Batch No. Available QTY')"
                      bg-color="white"
                      hide-details
                      :model-value="formtFloat(item.actual_batch_qty)"
                      disabled
                    ></v-text-field>
                  </v-col>
                  <v-col
                    cols="4"
                    v-if="item.has_batch_no == 1 || item.batch_no"
                  >
                    <v-text-field
                      density="compact"
                      variant="outlined"
                      color="primary"
                      :label="frappe._('Batch No Expiry Date')"
                      bg-color="white"
                      hide-details
                      v-model="item.batch_no_expiry_date"
                      disabled
                    ></v-text-field>
                  </v-col>
                  <v-col
                    cols="8"
                    v-if="item.has_batch_no == 1 || item.batch_no"
                  >
                    <v-autocomplete
                      v-model="item.batch_no"
                      :items="item.batch_no_data"
                      item-title="batch_no"
                      variant="outlined"
                      density="compact"
                      color="primary"
                      :label="frappe._('Batch No')"
                      @update:model-value="set_batch_qty(item, $event)"
                    >
                      <template v-slot:item="data">
<v-list-item v-bind="data.props" :title="null">
                            <v-list-item-title
                              v-html="data.item.raw.batch_no"
                            ></v-list-item-title>
                            <v-list-item-subtitle
                              v-html="
                                `Available QTY  '${data.item.raw.batch_qty}' - Expiry Date ${data.item.raw.expiry_date}`
                              "
                            ></v-list-item-subtitle>
                          </v-list-item>
                        
                      </template>
                    </v-autocomplete>
                  </v-col>
                  <v-col
                    cols="4"
                    v-if="
                      pos_profile.posa_allow_sales_order &&
                      invoiceType == 'Order'
                    "
                  >
                    <v-menu
                      ref="item_delivery_date"
                      v-model="item.item_delivery_date"
                      :close-on-content-click="false"
                      transition="scale-transition"
                    >
                      <template v-slot:activator="{ props }">
                        <v-text-field
                          v-model="item.posa_delivery_date"
                          :label="frappe._('Delivery Date')"
                          readonly
                          variant="outlined"
                          density="compact"
                          clearable
                          color="primary"
                          hide-details
                          v-bind="props"
                        ></v-text-field>
                      </template>
                      <pos-date-picker
                        v-model="item.posa_delivery_date"
                        color="primary"
                        :min="frappe.datetime.now_date()"
                      >
                        <v-spacer></v-spacer>
                        <v-btn
                          variant="text"
                          color="primary"
                          @click="item.item_delivery_date = false"
                        >
                          Cancel
                        </v-btn>
                        <v-btn
                          variant="text"
                          color="primary"
                          @click="
                            [
                              (item.item_delivery_date = false),
                              validate_due_date(item),
                            ]
                          "
                        >
                          OK
                        </v-btn>
                      </pos-date-picker>
                    </v-menu>
                  </v-col>
                  <v-col
                    cols="8"
                    v-if="pos_profile.posa_display_additional_notes"
                  >
                    <v-textarea
                      class="pa-0"
                      variant="outlined"
                      density="compact"
                      clearable
                      color="primary"
                      auto-grow
                      rows="1"
                      :label="frappe._('Additional Notes')"
                      v-model="item.posa_notes"
                    ></v-textarea>
                  </v-col>
                </v-row>
              </td>
            </tr></template>
          </v-data-table>
        </div>
      </div>
    </v-card>
    <v-card class="cards mb-0 mt-3 py-0 bg-grey-lighten-5" :class="{ 'return-mode': isReturnMode }">
      <v-row no-gutters>
        <v-col cols="7">
          <!-- <v-row no-gutters class="pa-1 pt-9 pr-1"> -->
          <v-row no-gutters class="pr-1">
            <v-col cols="6" class="pa-1" v-if="pos_profile.posa_allow_received_advance">
              <v-text-field
                :model-value="formtCurrency(customer_outstanding)"
                :label="frappe._('Previous Balance')"
                variant="outlined"
                density="compact"
                readonly
                hide-details
                color="accent"
                prepend-inner-icon="mdi-cash-sync"
              ></v-text-field>
            </v-col>
            <v-col cols="6" class="pa-1">
              <v-text-field
                :model-value="formtCurrency(subtotal)"
                :prefix="currencySymbol(pos_profile.currency)"
                :label="frappe._('Total')"
                variant="outlined"
                density="compact"
                bg-color="yellow"
                readonly
                hide-details
                color="success"
                prepend-inner-icon="mdi-cash"
              ></v-text-field>
            </v-col>
            <v-col
              v-if="!pos_profile.posa_use_percentage_discount"
              cols="6"
              class="pa-1"
            >
              <v-text-field
                :model-value="formtCurrency(discount_amount)"
                @change="
                  [
                  setFormatedCurrency(
                    discount_amount,
                    'discount_amount',
                    null,
                    false,
                    $event.target.value
                  ),
                  handleTotalAdditionalDiscount(),
                  ]
                "
                :rules="[isNumber]"
                :label="frappe._('Additional Discount')"
                ref="discount"
                variant="outlined"
                density="compact"
                hide-details
                color="warning"
                :prefix="currencySymbol(pos_profile.currency)"
                :disabled="
                  !pos_profile.posa_allow_user_to_edit_additional_discount ||
                  discount_percentage_offer_name
                    ? true
                    : false
                "
                prepend-inner-icon="mdi-cash-minus"
              ></v-text-field>
            </v-col>
            <v-col
              v-if="pos_profile.posa_use_percentage_discount"
              cols="6"
              class="pa-1"
            >
              <v-text-field
                :model-value="formtFloat(additional_discount_percentage)"
                @change="
                  [
                    setFormatedFloat(
                      additional_discount_percentage,
                      'additional_discount_percentage',
                      null,
                      false,
                      $event.target.value
                    ),
                    update_discount_umount(),
                    handleAdditionalDiscountChange(),
                  ]
                "
                :rules="[isNumber]"
                :label="frappe._('Additional Discount %')"
                suffix="%"
                ref="percentage_discount"
                variant="outlined"
                density="compact"
                color="warning"
                hide-details
                :disabled="
                  !pos_profile.posa_allow_user_to_edit_additional_discount ||
                  discount_percentage_offer_name
                    ? true
                    : false
                "
                prepend-inner-icon="mdi-percent"
              ></v-text-field>
            </v-col>
            <v-col cols="6" class="pa-1">
              <v-text-field
                :model-value="formtCurrency(total_items_discount_amount)"
                :prefix="currencySymbol(pos_profile.currency)"
                :label="frappe._('Items Discounts')"
                variant="outlined"
                density="compact"
                color="warning"
                bg-color="warning"
                readonly
                hide-details
                prepend-inner-icon="mdi-tag-minus"
              ></v-text-field>
            </v-col>

            <v-col cols="6" class="pa-1">
              <v-text-field
                :model-value="formtFloat(total_qty)"
                :label="frappe._('Total Qty')"
                variant="outlined"
                density="compact"
                readonly
                hide-details
                color="accent"
                prepend-inner-icon="mdi-counter"
              ></v-text-field>
            </v-col>
            <v-col cols="6" class="pa-1">
              <v-text-field
                density="compact"
                variant="outlined"
                color="primary"
                :label="frappe._('RFID Card')"
                bg-color="white"
                hide-details
                v-model="custom_rfid_card"
                :rules="[isNumber]"
                id="custom_rfid_card"
                readonly
                prepend-inner-icon="mdi-card-bulleted"
              ></v-text-field>
            </v-col>
          </v-row>
        </v-col>
        <v-col cols="5">
          <!-- <v-row no-gutters class="pa-1 pt-2 pl-0"> -->
          <v-row no-gutters class="pa-1 pl-0">
            <v-col
              v-if="pos_profile.custom_allow_select_sales_order === 1"
              cols="6"
              class="pa-1"
            >
              <v-btn
                block
                class="pa-0"
                color="info"
                @click="get_draft_orders"
                ><v-icon>mdi-book-search</v-icon>{{ __("Select S.O") }}</v-btn>
            </v-col>
            <v-col cols="6" class="pa-1 resume-col">
              <v-btn
                block
                class="pa-0"
                color="warning"
                @click="get_draft_invoices"
                >
                <!-- Badge positioned absolutely over the icon -->
                <v-badge
                  v-if="draftInvoicesCount > 0"
                  color="error"
                  :content="draftInvoicesCount"
                  bordered
                  class="notification-badge"
                >
                </v-badge>
                <v-icon>mdi-file-document</v-icon>{{ __("Resume") }}
              </v-btn>
            </v-col>
            <v-col
              v-if="pos_profile.posa_allow_return === 1"
              cols="6"
              class="pa-1"
            >
              <v-btn
                block
                class="pa-0"
                :class="{ 'disable-events': !pos_profile.posa_allow_return }"
                color="secondary"
                @click="open_returns"
                ><v-icon start>mdi-backup-restore</v-icon>{{ __("Return") }}</v-btn>
            </v-col>
            <v-col cols="6" class="pa-1">
              <v-btn
                block
                class="pa-0"
                color="error"
                @click="cancel_dialog = true"
                ><v-icon start>mdi-close-circle</v-icon>{{ __("Cancel") }}</v-btn>
            </v-col>
            <v-col cols="6" class="pa-1" v-if="pos_profile.posa_allow_customer_screen">
              <v-btn block class="pa-0" color="info" @click="openCustomerDisplay">
                <v-icon start>mdi-monitor</v-icon>{{ __("King Screen") }}
              </v-btn>
            </v-col>
            <v-col cols="6" class="pa-1">
              <v-btn
                block
                class="pa-0"
                color="accent"
                @click="new_invoice"
                ><v-icon start>mdi-content-save</v-icon>{{ __("Hold Sale") }}</v-btn>
            </v-col>
            <v-col
              v-if="pos_profile.posa_allow_print_draft_invoices"
              cols="6"
              class="pa-1"
            >
              <v-btn
                block
                class="pa-0"
                color="primary"
                @click="print_draft_invoice"
                ><v-icon start>mdi-printer</v-icon>{{ __("Print Draft") }}</v-btn>
            </v-col>
            <v-col class="pa-1">
              <v-btn
                block
                class="pa-0"
                color="success"
                @click="show_payment"
                ><v-icon start>mdi-credit-card</v-icon>{{ __("CHECK OUT/PAY") }}</v-btn>
            </v-col>
          </v-row>
        </v-col>
      </v-row>
    </v-card>
  </div>
</template>

<script>
import { evntBus } from "../../bus";
import format from "../../format";
import Customer from "./Customer.vue";
import RFIDPopup from './RFIDPopup.vue';
import offlinePos from "../../../offline";

export default {
  mixins: [format],
  data() {
    return {
      pos_profile: "",
      pos_opening_shift: "",
      taxes_and_charges: "",
      stock_settings: "",
      invoice_doc: "",
      return_doc: "",
      customer: "",
      customer_info: "",
      discount_amount: 0,
      additional_discount_percentage: 0,
      custom_rfid_card: "",
      total_tax: 0,
      items: [],
      posOffers: [],
      posa_offers: [],
      posa_coupons: [],
      allItems: [],
      discount_percentage_offer_name: null,
      invoiceTypes: ["Invoice", "Order"],
      invoiceType: "Invoice",
      itemsPerPage: 1000,
      expanded: [],
      singleExpand: true,
      cancel_dialog: false,
      tax_dialog: false,
      selected_tax: "cash", // default selection
      float_precision: 2,
      currency_precision: 2,
      new_line: false,

      tableDialog:false,
      selectedZone:null,
      selectedTable:null,

      service_zone: [],
      selcted_service_zone: null,
      service_table: [],
      selcted_service_table: null,
      order_type: [],
      selcted_order_type: null,

      itemDialog: false,
      selectedItem: null,
      quickNotes: [
        "No Onion",
        "Extra Cheese",
        "Extra Spicy",
        "Less Salt",
        "Well Done",
        "Without Sauce"
      ],

      delivery_charges: [],
      delivery_charges_rate: 0,
      selcted_delivery_charges: {},
      invoice_posting_date: false,
      posting_date: frappe.datetime.nowdate(),
      readonly: false,
      draftInvoicesCount: 0, // Initialize the count
      customer_outstanding: 0, // Customer balance
      items_headers: [
        {
          title: __("Name"),
          align: "start",
          sortable: true,
          key: "item_name",
        },
        { title: __("QTY"), key: "qty", align: "center" },
        { title: __("UOM"), key: "uom", align: "center" },
        { title: __("Rate"), key: "rate", align: "center" },
        { title: __("Amount"), key: "amount", align: "center" },
        { title: __("is Offer"), key: "posa_is_offer", align: "center" },
      ],
      items_headers_rms: [
        {
          title: __("Name"),
          align: "start",
          sortable: true,
          key: "item_name",
        },
        { title: __("QTY"), key: "qty", align: "center" },
        { title: __("Rate"), key: "rate", align: "center" },
        { title: __("Amount"), key: "amount", align: "center" },
        { title: __("Offer"), key: "posa_is_offer", align: "center" },
      ],
      selectedInvoiceIndex: 0,

      displayStage: "order",      // order | tax | payment
      displayChannel: null,
    };
  },

  components: {
    Customer,
    RFIDPopup,
  },

  computed: {
isReturnMode() {
  return !!(
    (this.invoice_doc && this.invoice_doc.is_return) ||
    this.invoiceType === "Return"
  );
},
//return without invoice
isReturnWithoutInvoice() {
  return !!(
    this.invoice_doc &&
    this.invoice_doc.is_return &&
    !this.invoice_doc.return_against
  );
},
customerDisplayPayload() {
  const cur = this.pos_profile ? this.currencySymbol(this.pos_profile.currency) : "";
  return {
    stage: this.tax_dialog ? "tax" : this.displayStage,
    payment_method: this.selected_tax,
    currency: cur,
    customer_name: this.customer_info && this.customer_info.customer_name
      ? this.customer_info.customer_name
      : this.customer,
    order_type: this.selcted_order_type || "",
    service_zone: this.selcted_service_zone || "",
    service_table: this.selcted_service_table || "",
    loyalty_points: this.pos_profile && this.pos_profile.posa_display_customer_loyalty_points
      ? flt(this.available_pioints_amount) : 0,
    customer_outstanding: this.pos_profile && this.pos_profile.posa_allow_received_advance
      ? flt(this.customer_outstanding) : 0,
    items: this.items.map((i) => ({
      id: i.posa_row_id,
      name: i.item_name,
      qty: flt(i.qty),
      uom: i.uom,
      rate: flt(i.rate),
      amount: flt(i.qty) * flt(i.rate),
      discount_amount: flt(i.discount_amount),
      notes: i.posa_notes || "",
      is_offer: !!(i.posa_is_offer || i.posa_is_replace),
    })),
    total_qty: this.total_qty,
    gross: this.Total,
    items_discount: this.total_items_discount_amount,
    discount_amount: flt(this.discount_amount),
    delivery_charges: flt(this.delivery_charges_rate),
    total: this.subtotal,
  };
},
    filteredTables() {
      if (!this.selectedZone) return [];

      const statusOrder = {
        "Available": 1,
        "Reserved": 2,
        "Cleaning": 3,
        "Occupied": 4,
        "Disabled": 5,
      };

      return this.service_table
        .filter(table => table.service_zone === this.selectedZone)
        .sort((a, b) => {
          // Sort by status first
          const statusDiff =
            (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);

          if (statusDiff !== 0) {
            return statusDiff;
          }

          // Then sort by table name (T1, T2, T3...)
          return a.name.localeCompare(b.name, undefined, {
            numeric: true,
            sensitivity: "base",
          });
        });
    },

    total_qty() {
      this.close_payments();
      let qty = 0;
      this.items.forEach((item) => {
        qty += flt(item.qty);
      });
      return this.flt(qty, this.float_precision);
    },
    Total() {
      let sum = 0;
      this.items.forEach((item) => {
        sum += flt(item.qty) * flt(item.rate);
      });
      return this.flt(sum, this.currency_precision);
    },
    subtotal() {
      this.close_payments();
      let sum = 0;
      this.items.forEach((item) => {
        sum += flt(item.qty) * flt(item.rate);
      });
      sum -= this.flt(this.discount_amount);
      sum += this.flt(this.delivery_charges_rate);
      return this.flt(sum, this.currency_precision);
    },
    total_items_discount_amount() {
      let sum = 0;
      this.items.forEach((item) => {
        sum += flt(item.qty) * flt(item.discount_amount);
      });
      return this.flt(sum, this.float_precision);
    },
    available_pioints_amount() {
      let amount = 0;
      if (this.customer_info.loyalty_points) {
        amount =
          this.customer_info.loyalty_points;
      }
      return amount;
    },
    itemUOMs() {
      return this.items.map(item => {
        return {
          uom: item.sales_uom || item.stock_uom,
          conversion_factor: item.conversion_factor
        };
      });
    },
  },

  methods: {
openCustomerDisplay() {
  window.open(
    "/assets/posawesome/customer-display.html",
    "posa_customer_display",
    "width=1280,height=800"
  );
  setTimeout(() => this.broadcastDisplay(), 800);
},
broadcastDisplay() {
  if (!this.displayChannel) return;
  try {
    // JSON round-trip strips Vue reactivity so structured clone works
    this.displayChannel.postMessage({
      type: "state",
      payload: JSON.parse(JSON.stringify(this.customerDisplayPayload)),
    });
  } catch (e) {
    console.warn("Customer display broadcast failed", e);
  }
},
initCustomerDisplay() {
  if (!("BroadcastChannel" in window)) return;
  this.displayChannel = new BroadcastChannel("posa-customer-display");
  // display page says "hello" when it opens/reloads -> resend current state
  this.displayChannel.onmessage = (e) => {
    if (e.data && e.data.type === "hello") this.broadcastDisplay();
  };
  evntBus.$on("show_payment", (flag) => {
    // deferred: close_payments() is called from inside computed properties
    setTimeout(() => {
      this.displayStage = flag === "true" || flag === true ? "payment" : "order";
    }, 0);
  });
},
    onQtyInput(item, value) {
      this.$set(item, "qty", value);
      this.$set(item, "amount", flt(value || 0) * flt(item.rate || 0));
    },
    closeItemDialog() {
        this.itemDialog = false;
        if (this.$root) {
          evntBus.$emit('escEventTriggered');
          //evntBus.$emit('escEventTriggered');
        }
    },
    openItemDialog(item) {
        if (
            item.posa_is_offer ||
            item.posa_is_replace
        ) {
            return;
        }

        this.selectedItem = item;
        this.itemDialog = true;
        // this.tableDialog = true;
    },
plusQty() {
  if (!this.selectedItem) return;
  this.selectedItem.qty += this.isReturnWithoutInvoice ? -1 : 1;
  this.updateItemQty();
},
minusQty() {
  if (!this.selectedItem) return;
  if (this.isReturnWithoutInvoice) {
    if (this.selectedItem.qty >= -1) return;
    this.selectedItem.qty++;
  } else {
    if (this.selectedItem.qty <= 1) return;
    this.selectedItem.qty--;
  }
  this.updateItemQty();
},
    plusQty_old() {
        if (!this.selectedItem) {
            return;
        }
        this.selectedItem.qty++;
        this.updateItemQty();
    },
    minusQty_old() {
        if (!this.selectedItem) {
            return;
        }
        if (this.selectedItem.qty <= 1) {
            return;
        }
        this.selectedItem.qty--;
        this.updateItemQty();
    },
    updateItemQty() {
        this.calc_prices(
            this.selectedItem,
            this.selectedItem.qty
        );
        this.$forceUpdate();
    },
    addQuickNote(note) {
        if (!this.selectedItem.posa_notes) {
            this.selectedItem.posa_notes = note;
        } else {
            let notes = this.selectedItem.posa_notes.split(",");
            if (!notes.includes(note)) {
                notes.push(note);
            }
            this.selectedItem.posa_notes = notes.join(",");
        }
    },
    deleteSelectedItem() {
        if (!this.selectedItem) {
            return;
        }
        this.handleRemoveItem(this.selectedItem);
        this.itemDialog = false;
    },
    saveItemChanges() {
        if (!this.selectedItem) {
            return;
        }
        this.calc_prices(
            this.selectedItem,
            this.selectedItem.qty
        );
        this.itemDialog = false;
        this.$forceUpdate();
    },
    loadOrderTypes() {
        // Get allowed Order Types from POS Profile child table
        const allowedOrderTypes = (this.pos_profile.pos_order_type || [])
            .map(row => row.order_type)
            .filter(Boolean);
        if (!allowedOrderTypes.length) {
            this.order_type = [];
            return;
        }
        if (offlinePos.useOffline()) {
            try {
                this.order_type = JSON.parse(localStorage.getItem("posa_order_types") || "[]");
            } catch (e) {}
            return;
        }
        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Order Type",
                fields: [
                    "name",
                    "is_table_required",
                    "is_delivery",
                    "is_take_away",
                    "disable"
                ],
                filters: {
                    disable: 0,
                    name: ["in", allowedOrderTypes]
                },
                order_by: "creation asc"
            },
            callback: (r) => {
                if (!r.message) return;
                this.order_type = r.message.map(d => ({
                    name: d.name,
                    value: d.name,
                    is_table_required: d.is_table_required,
                    is_delivery: d.is_delivery,
                    is_take_away: d.is_take_away
                }));
                try {
                    localStorage.setItem("posa_order_types", JSON.stringify(this.order_type));
                } catch (e) {}
            }
        });
    },
    loadOrderTypes_directly() {
        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Order Type",
                fields: [
                   "name",
                    "is_table_required",
                    "is_delivery",
                    "is_take_away",
                    "disable"
                ],
                filters: {
                    disable: 0
                },
                order_by: "creation asc"
            },
            callback: (r) => {
                if (!r.message) return;
                this.order_type = r.message.map(d => ({
                    name: d.name,
                    value: d.name,
                    is_table_required: d.is_table_required,
                    is_delivery: d.is_delivery,
                    is_take_away: d.is_take_away
                }));
            }
        });
    },
    selectOrderType(type) {
        this.selcted_order_type = type.name;
        this.invoice_doc.posa_order_type = type.name;

        // Dine In
        if (type.is_table_required) {
            this.tableDialog = true;
            if (!this.selectedZone && this.service_zone.length) {
                this.selectedZone = this.service_zone[0].name;
            }
            return;
        }

        // Take Away / Delivery
        this.selectedZone = null;
        this.selectedTable = null;
        this.selcted_service_zone = "";
        this.selcted_service_table = "";
        this.invoice_doc.posa_service_zone = "";
        this.invoice_doc.posa_service_table = "";
    },
    loadServiceTables() {
        if (offlinePos.useOffline() || !this.pos_profile) return;
        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Service Table",
                fields: [
                    "name",
                    "service_zone",
                    "status",
                    "no_of_seats",
                    "table_shape",
                    "occupied",
                    "is_take_away"
                ],
                filters: {
                    company: this.pos_profile.company
                },
                order_by: "service_zone asc,name asc"
            },
            callback: (r) => {
                if (!r.message) return;
                this.service_table = r.message;
            }
        });
    },
    selectTable(table) {
        // if (table.status == "Occupied") {
        // if (table.status === "Occupied" && !this.is_take_away) {
        if (table.status?.toLowerCase() === "occupied" && !table.is_take_away) {
            frappe.show_alert({
                message: __("Table already occupied"),
                indicator: "red"
            });
            return;
        }

        if (table.status == "Disabled") {
            frappe.show_alert({
                message: __("Table disabled"),
                indicator: "red"
            });
            return;
        }
        this.selectedTable = table.name;
    },
    isTableDisabled(table) {
        // return table.status === 'occupied' && !this.is_take_away;
        return table.status?.toLowerCase() === "occupied" && !table.is_take_away;
    },
    confirmTableSelection() {
        this.loadServiceTables();
        const table = this.service_table.find(d => d.name == this.selectedTable);
        if (!table) return;
        this.selcted_service_zone = table.service_zone;
        this.selcted_service_table = table.name;
        this.invoice_doc.posa_service_zone = table.service_zone;
        this.invoice_doc.posa_service_table = table.name;
        this.tableDialog = false;
    },
    tableColor(table) {
    if (table.status === "Occupied" && table.is_take_away) {
        return "#E1F5FE"; // Light cyan for takeaway occupied
    }
        switch (table.status) {
            case "Available":
                return "#E8F5E9";
            case "Occupied":
                return "#FFEBEE";
            case "Reserved":
                return "#FFF3E0";
            case "Cleaning":
                return "#E3F2FD";
            case "Disabled":
                return "#EEEEEE";
            default:
                return "white";
        }
    },
    statusColor(status){
    //statusColor(table){
    //if (table.status === "Occupied" && table.is_take_away) {
    //    return "cyan";
    //}
      //switch(table.status){
      switch(status){
        case "Available":
          return "green";
        case "Occupied":
          return "red";
        case "Reserved":
          return "orange";
        case "Cleaning":
          return "blue";
        case "Disabled":
          return "grey";
        default:
          return "primary";
      }
    },
    tableIcon(table) {
    if (table.status === "Occupied" && table.is_take_away) {
        return "mdi-food-takeout-box";
        // or mdi-shopping
        // or mdi-bag-suitcase
    }
        switch (table.status) {
            case "Available":
                return "mdi-check-circle";
            case "Occupied":
                return "mdi-account-group";
            case "Reserved":
                return "mdi-calendar-clock";
            case "Cleaning":
                return "mdi-broom";
            case "Disabled":
                return "mdi-lock";
            default:
                return "mdi-table-furniture";
        }
    },
    async fetchCustomerOutstanding(customer) {
      if (offlinePos.useOffline()) return;
      if (this.pos_profile.posa_allow_received_advance) {
        try {
          const response = await frappe.call({
            method: "posawesome.posawesome.api.posapp.get_customer_outstanding",
            args: {
              customer: this.customer,
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
    handleRemoveItem(item) {
        if (this.pos_profile.custom_posa_allow_remove_item) {
          this.remove_item(item);
        } else {
        this.showRFIDsPopup(
          { item_name: this.item_name }, // Placeholder item
          item
        ).then((isVerified) => {
          if (isVerified) {
            this.remove_item(item);
            evntBus.$emit('show_mesage', {
              text: __('RFID verification successful.'),
              color: 'warning',
            });
          } else {
            evntBus.$emit("show_mesage", {
              text: __(`RFID verification failed.`),
              color: "error",
            });
            frappe.utils.play_sound("error");
          }
        });
      }
    },
    showRFIDsPopup(item, discount_percentage) {
      return new Promise((resolve) => {
        evntBus.$emit("open_rfid_popup", {
          title: "RFID Verification Required to Delete Item",
          message: `This item is not allowed to Delete. Please scan your RFID to proceed.`,
          onScan: (scannedRFID) => {
            console.log(`Scanned RFID: ${scannedRFID}`); // Debugging
            console.log(`Expected RFID: ${this.pos_profile.custom_rfid_number}`); // Debugging
            resolve(scannedRFID === this.pos_profile.custom_rfid_number);
          },
        });
      });
    },
    handleTotalAdditionalDiscount() {
      const discountPercentage = (this.discount_amount / this.Total) * 100;
      if (discountPercentage > this.pos_profile.posa_max_discount_allowed) {
        this.showRFIDPopup(
          { item_name: "Additional Discount" }, // Placeholder item
          discountPercentage
        ).then((isVerified) => {
          if (isVerified) {
            this.additional_discount_percentage = discountPercentage;
            this.custom_rfid_card = this.pos_profile.custom_rfid_number;
            evntBus.$emit('show_mesage', {
              text: __('RFID verification successful.'),
              color: 'warning',
            });
          } else {
            this.discount_amount = 0;
            evntBus.$emit("show_mesage", {
              text: __(`RFID verification failed.`),
              color: "error",
            });
            frappe.utils.play_sound("error");
          }
        });
      }
    },
    handleAdditionalDiscountChange() {
      const discountPercentage = (this.discount_amount / this.Total) * 100;
      if (discountPercentage > this.pos_profile.posa_max_discount_allowed) {
        this.showRFIDPopup(
          { item_name: "Additional Discount" }, // Placeholder item
          discountPercentage
        ).then((isVerified) => {
          if (isVerified) {
            this.additional_discount_percentage = discountPercentage;
            this.custom_rfid_card = this.pos_profile.custom_rfid_number;
            evntBus.$emit('show_mesage', {
              text: __('RFID verification successful.'),
              color: 'warning',
            });
          } else {
            this.additional_discount_percentage = 0;
            evntBus.$emit("show_mesage", {
              text: __(`RFID verification failed.`),
              color: "error",
            });
            frappe.utils.play_sound("error");
          }
        });
      }
    },
    checkDiscountPercentage(item, discountPercentage) {
      if (discountPercentage > this.pos_profile.posa_max_discount_allowed) {
        this.showRFIDPopup(item, discountPercentage).then((isVerified) => {
          if (isVerified) {
            this.$set(item, "custom_rfid_card", this.pos_profile.custom_rfid_number);
            evntBus.$emit('show_mesage', {
              text: __('RFID verification successful.'),
              color: 'warning',
            });
            evntBus.$emit('escEventTriggered'),
            expandedHandler()
          } else {
            this.$set(item, "discount_percentage", 0); // Reset discount percentage
            evntBus.$emit("show_mesage", {
              text: __(`RFID verification failed.`),
              color: "error",
            });
            frappe.utils.play_sound("error");
          }
        });
      }
    },
    showRFIDPopup(item, discount_percentage) {
      return new Promise((resolve) => {
        evntBus.$emit("open_rfid_popup", {
          title: "RFID Verification Required",
          message: `Discount percentage for item '${item.item_name}' is ${discount_percentage}%, which exceeds the allowed ${this.pos_profile.posa_max_discount_allowed}%. Please scan your RFID to proceed.`,
          onScan: (scannedRFID) => {
            console.log(`Scanned RFID: ${scannedRFID}`); // Debugging
            console.log(`Expected RFID: ${this.pos_profile.custom_rfid_number}`); // Debugging
            resolve(scannedRFID === this.pos_profile.custom_rfid_number);
          },
        });
      });
    },
    showRFIDPopups(data) {
      this.$refs.rfidPopup.openPopup(data);
    },
    showPopup({ title, message, onScan }) {
      this.popupTitle = title;
      this.popupMessage = message;
      this.onScanCallback = onScan;
      this.isPopupVisible = true;
    },
    handleScan() {
      const scannedRFID = this.scannedRFID; // Value from input
      this.onScanCallback(scannedRFID);
      this.isPopupVisible = false;
    },
    createExpense() {
      evntBus.$emit("open_expense", "true");
    },
    discount_blur() {
      this.$refs.discount.blur();
    },
    selectAllText() {
      if (this.$refs.qtyField) {
        this.$nextTick(() => {
          this.$refs.qtyField.$el.querySelector('input').select();
        });
      }
    },
    onRowClick(item) {
        // Handle the click event on the row here
        if (this.expanded.length > 0) {
            this.expanded = [];
            if (this.$root) {
                evntBus.$emit('escEventTriggered');
            }
        } else {
            this.expanded.push(item);
        }
    },
    expandedHandler() {
      this.expanded = []; // Function to handle the 'expanded' array
    },
    remove_item(item) {
      const index = this.items.findIndex(
        (el) => el.posa_row_id == item.posa_row_id
      );
      if (index >= 0) {
        this.items.splice(index, 1);
      }
      const idx = this.expanded.findIndex(
        (el) => el.posa_row_id == item.posa_row_id
      );
      if (idx >= 0) {
        this.expanded.splice(idx, 1);
      }
      evntBus.$emit('escEventTriggered');
    },
add_one(item) {
  item.qty += this.isReturnWithoutInvoice ? -1 : 1;
  if (item.qty == 0) {
    this.remove_item(item);
  }
  this.calc_stock_qty(item, item.qty);
  this.$forceUpdate();
},
subtract_one(item) {
  item.qty -= this.isReturnWithoutInvoice ? -1 : 1;
  if (item.qty == 0) {
    this.remove_item(item);
  }
  this.calc_stock_qty(item, item.qty);
  this.$forceUpdate();
},
    add_one_old(item) {
      item.qty++;
      if (item.qty == 0) {
        this.remove_item(item);
      }
      this.calc_stock_qty(item, item.qty);
      this.$forceUpdate();
    },
    subtract_one_old(item) {
      item.qty--;
      if (item.qty == 0) {
        this.remove_item(item);
      }
      this.calc_stock_qty(item, item.qty);
      this.$forceUpdate();
    },
    apply_buffet_production_rate(item) {
      const service_table =
        this.selcted_service_table ||
        this.invoice_doc.posa_service_table ||
        "";
      if (
        this.pos_profile.posa_allow_zero_rate_for_buffet_production &&
        service_table === this.pos_profile.posa_service_table_to_allow_zero_rate
      ) {
        const buffet_rate = flt(this.pos_profile.posa_buffet_production_rate || 0.01);
        item.rate = buffet_rate;
        item.price_list_rate = buffet_rate;
        item.base_rate = buffet_rate;
        item.amount = flt(item.qty || 1) * buffet_rate;
        item.base_amount = item.amount;
        evntBus.$emit('show_mesage', {
          text: __('Buffet Rate Applied'),
          color: 'warning',
        });
        return true;
      }
      return false;
    },
    add_item(item) {
      // ?? Force Sales Person mandatory
      if (
        this.pos_profile.posa_sales_person &&
        !item.posa_sales_person
      ) {
        evntBus.$emit("show_mesage", {
          text: __("Please select Sales Person"),
          color: "warning",
        });
        return;
      }
      const returnMode = this.isReturnWithoutInvoice;
      const qtyToAdd = returnMode
        ? -Math.abs(item.qty || 1)
        : (item.qty || 1);

      if (!item.uom) {
        item.uom = item.stock_uom;
      }
      let index = -1;
      if (!this.new_line) {
        index = this.items.findIndex(
          (el) =>
            el.item_code === item.item_code &&
            el.uom === item.uom &&
            !el.posa_is_offer &&
            !el.posa_is_replace &&
            el.batch_no === item.batch_no
        );
      }
      if (index === -1 || this.new_line) {
        const new_item = this.get_new_item(item);
      if (returnMode) {
        new_item.qty = -Math.abs(new_item.qty || 1);
        new_item.stock_qty = new_item.qty;
      }
        if (item.has_serial_no && item.to_set_serial_no) {
          new_item.serial_no_selected = [];
          new_item.serial_no_selected.push(item.to_set_serial_no);
          item.to_set_serial_no = null;
        }
        if (item.has_batch_no && item.to_set_batch_no) {
          new_item.batch_no = item.to_set_batch_no;
          item.to_set_batch_no = null;
          item.batch_no = null;
          this.set_batch_qty(new_item, new_item.batch_no, false);
        }
        this.items.unshift(new_item);
        this.update_item_detail(new_item);
        // restore custom rate AFTER update
        if (item.posa_custom_rate) {
          new_item.rate = flt(item.rate || 0);
          new_item.price_list_rate = flt(item.rate || 0);
          new_item.base_rate = flt(item.rate || 0);
          new_item.amount = flt(new_item.qty) * flt(new_item.rate);
          new_item.base_amount = new_item.amount;
        }
      } else {
        const cur_item = this.items[index];
if (this.pos_profile.posa_allow_display_mrp) {
    cur_item.maximum_retail_price =
        item.maximum_retail_price ||
        cur_item.maximum_retail_price ||
        0;
}
        // cur_item.maximum_retail_price = item.maximum_retail_price || cur_item.maximum_retail_price || 0;
        // ?? overwrite sales person if provided
        if (item.posa_sales_person) {
          cur_item.posa_sales_person = item.posa_sales_person;
        }
        this.update_items_details([cur_item]);
        if (item.has_serial_no && item.to_set_serial_no) {
          if (cur_item.serial_no_selected.includes(item.to_set_serial_no)) {
            evntBus.$emit("show_mesage", {
              text: __(`This Serial Number {0} has already been added!`, [
                item.to_set_serial_no,
              ]),
              color: "warning",
            });
            item.to_set_serial_no = null;
            return;
          }
          cur_item.serial_no_selected.push(item.to_set_serial_no);
          item.to_set_serial_no = null;
        }
        if (!cur_item.has_batch_no) {
          // cur_item.qty += item.qty || 1;
          cur_item.qty += qtyToAdd;
          if (item.rate) {
            cur_item.rate = flt(item.rate);
            cur_item.price_list_rate = flt(item.rate);
          }
          cur_item.amount = flt(cur_item.qty) * flt(cur_item.rate);
          cur_item.base_amount = cur_item.amount;
          this.calc_stock_qty(cur_item, cur_item.qty);
        } else {
          if (
            (cur_item.stock_qty < cur_item.actual_batch_qty &&
              cur_item.batch_no == item.batch_no) ||
            !cur_item.batch_no
          ) {
            // cur_item.qty += item.qty || 1;
            cur_item.qty += qtyToAdd;
            if (item.rate) {
              cur_item.rate = flt(item.rate);
              cur_item.price_list_rate = flt(item.rate);
            }
            cur_item.amount = flt(cur_item.qty) * flt(cur_item.rate);
            cur_item.base_amount = cur_item.amount;
            this.calc_stock_qty(cur_item, cur_item.qty);
          } else {
            const new_item = this.get_new_item(cur_item);
            new_item.batch_no = item.batch_no || item.to_set_batch_no;
            new_item.batch_no_expiry_date = "";
            new_item.actual_batch_qty = "";
            // new_item.qty = item.qty || 1;
            new_item.qty = qtyToAdd;
            if (new_item.batch_no) {
              this.set_batch_qty(new_item, new_item.batch_no, false);
              item.to_set_batch_no = null;
              item.batch_no = null;
            }
            this.items.unshift(new_item);
          }
        }
        this.set_serial_no(cur_item);
      }
      this.$forceUpdate();
    },
    get_new_item(item) {
      const new_item = { ...item };
      if (!item.qty) {
        item.qty = 1;
      }
      if (!item.posa_is_offer) {
        item.posa_is_offer = 0;
      }
      if (!item.posa_is_replace) {
        item.posa_is_replace = "";
      }
      // ?? IMPORTANT: carry sales person into cart row
      new_item.posa_sales_person = item.posa_sales_person || null;
      new_item.stock_qty = item.qty;
      new_item.discount_amount = 0;
      new_item.discount_percentage = 0;
      new_item.discount_amount_per_item = 0;
      // new_item.price_list_rate = item.rate;
      // preserve custom/manual rate
      if (item.posa_custom_rate) {
        new_item.posa_custom_rate = item.posa_custom_rate || 0;
        new_item.price_list_rate = flt(item.rate || 0);
        new_item.rate = flt(item.rate || 0);
        new_item.base_rate = flt(item.rate || 0);
        new_item.qty = flt(item.qty || 1);
        new_item.amount = flt(new_item.qty) * flt(new_item.rate);
        new_item.base_amount = new_item.amount;
      }
      new_item.qty = item.qty;
      new_item.uom = item.uom ? item.uom : item.stock_uom;
      new_item.actual_batch_qty = "";
      new_item.conversion_factor = 1;
      new_item.maximum_retail_price = this.pos_profile.posa_allow_display_mrp
        ? flt(item.maximum_retail_price || 0)
        : 0;
      // new_item.maximum_retail_price = item.maximum_retail_price || 0;
      new_item.posa_offers = JSON.stringify([]);
      new_item.posa_offer_applied = 0;
      new_item.posa_is_offer = item.posa_is_offer;
      new_item.posa_is_replace = item.posa_is_replace || null;
      new_item.is_free_item = 0;
      new_item.posa_notes = "";
      new_item.posa_delivery_date = "";
      new_item.posa_row_id = this.makeid(20);
      if (
        (!this.pos_profile.posa_auto_set_batch && new_item.has_batch_no) ||
        new_item.has_serial_no
      ) {
        this.expanded.push(new_item);
      }
      return new_item;
    },
    cancel_invoice() {
      const doc = this.get_invoice_doc();
      this.invoiceType = "Invoice";
      this.invoiceTypes = ["Invoice", "Order"];
      this.posting_date = frappe.datetime.nowdate();
      if (doc.name && !String(doc.name).startsWith("OFL-") && this.pos_profile.posa_allow_delete && !offlinePos.useOffline()) {
        frappe.call({
          method: "posawesome.posawesome.api.posapp.delete_invoice",
          args: { invoice: doc.name },
          async: true,
          callback: function (r) {
            if (r.message) {
              evntBus.$emit("show_mesage", {
                text: r.message,
                color: "warning",
              });
            }
          },
        });
      }
      this.items = [];
      this.custom_rfid_card = "";
      this.posa_offers = [];
      evntBus.$emit("set_pos_coupons", []);
      this.posa_coupons = [];
      this.customer = this.pos_profile.customer;
      this.invoice_doc = "";
      this.return_doc = "";
      this.discount_amount = 0;
      this.additional_discount_percentage = 0;
      this.delivery_charges_rate = 0;
      this.selcted_delivery_charges = {};
      this.selectedZone = null;
      this.selectedTable = null;
      this.selcted_service_zone = "";
      this.selcted_service_table = "";
      this.selcted_order_type = "";
      evntBus.$emit("set_customer_readonly", false);
      evntBus.$emit('escEventTriggered');
      this.cancel_dialog = false;
    },
    new_invoice(data = {}) {
      console.log("Loading new_invoice", data);
      let old_invoice = null;
      evntBus.$emit("set_customer_readonly", false);
      evntBus.$emit('escEventTriggered');
      this.expanded = [];
      // Save the current invoice before resetting
      const doc = this.get_invoice_doc();
      if ((doc.name || doc.items.length) && offlinePos.useOffline()) {
        // held invoices live on the server; they cannot be saved while offline
        if (doc.items.length && !data.name && !data.is_return) {
          evntBus.$emit("show_mesage", {
            text: __("Offline: the current sale was not held (holding needs the server)"),
            color: "warning",
          });
        }
      } else if (doc.name || doc.items.length) {
        old_invoice = this.update_invoice(doc);
      }
      // Reset state only if not loading a specific invoice or return
      if (!data.name && !data.is_return) {
        this.items = [];
        this.customer = this.pos_profile.customer;
        this.invoice_doc = "";
        this.discount_amount = 0;
        this.additional_discount_percentage = 0;
        this.invoiceType = "Invoice";
        this.invoiceTypes = ["Invoice", "Order"];
        this.posa_offers = []; // Reset posa_offers only for new invoices
        evntBus.$emit("set_pos_coupons", []);
        this.posa_coupons = [];
        this.return_doc = "";
      } else {
        // Load existing draft or return
        if (data.is_return) {
          evntBus.$emit("set_customer_readonly", true);
          this.invoiceType = "Return";
          this.invoiceTypes = ["Return"];
        }
        this.invoice_doc = data;
        this.items = data.items;
        this.update_items_details(this.items);
        this.posa_offers = data.posa_offers || []; // Load posa_offers from data
        this.posa_coupons = data.posa_coupons || [];
        this.items.forEach((item) => {
          if (!item.posa_row_id) {
            item.posa_row_id = this.makeid(20);
          }
          if (item.batch_no) {
            this.set_batch_qty(item, item.batch_no);
          }
        });
        this.customer = data.customer;
        this.posting_date = data.posting_date || frappe.datetime.nowdate();
        this.discount_amount = data.discount_amount;
        this.additional_discount_percentage = data.additional_discount_percentage;
        this.items.forEach((item) => {
          if (item.serial_no) {
            item.serial_no_selected = [];
            const serial_list = item.serial_no.split("\n");
            serial_list.forEach((element) => {
              if (element.length) {
                item.serial_no_selected.push(element);
              }
            });
            item.serial_no_selected_count = item.serial_no_selected.length;
          }
        });
      }
      this.get_draft_invoices_count();
      return old_invoice;
    },

    async new_order(data = {}) {
      let old_invoice = null;
      evntBus.$emit("set_customer_readonly", false);
      this.expanded = [];
      this.posa_offers = [];
      evntBus.$emit("set_pos_coupons", []);
      this.posa_coupons = [];
      this.return_doc = "";
      if (!data.name && !data.is_return) {
        this.items = [];
        this.custom_rfid_card = "";
        this.customer = this.pos_profile.customer;
        this.invoice_doc = "";
        this.discount_amount = 0;
        this.additional_discount_percentage = 0;
        this.invoiceType = "Invoice";
        this.invoiceTypes = ["Invoice", "Order"];
      } else {
        if (data.is_return) {
          evntBus.$emit("set_customer_readonly", true);
          this.invoiceType = "Return";
          this.invoiceTypes = ["Return"];
        }
        this.invoice_doc = data;
        this.items = data.items;
        this.update_items_details(this.items);
        this.posa_offers = data.posa_offers || [];
        this.items.forEach((item) => {
          if (!item.posa_row_id) {
            item.posa_row_id = this.makeid(20);
          }
          if (item.batch_no) {
            this.set_batch_qty(item, item.batch_no);
          }
        });
        this.customer = data.customer;
        this.posting_date = data.posting_date || frappe.datetime.nowdate();
        this.discount_amount = data.discount_amount;
        this.additional_discount_percentage =
          data.additional_discount_percentage;
        this.items.forEach((item) => {
          if (item.serial_no) {
            item.serial_no_selected = [];
            const serial_list = item.serial_no.split("\n");
            serial_list.forEach((element) => {
              if (element.length) {
                item.serial_no_selected.push(element);
              }
            });
            item.serial_no_selected_count = item.serial_no_selected.length;
          }
        });
      }
      return old_invoice;
    },

    get_invoice_doc() {
      let doc = {};
      if (this.invoice_doc.name) {
        doc = { ...this.invoice_doc };
      }
      doc.doctype = "Sales Invoice";
      doc.is_pos = 1;
      doc.ignore_pricing_rule = 1;
      doc.company = doc.company || this.pos_profile.company;
      doc.pos_profile = doc.pos_profile || this.pos_profile.name;
      doc.campaign = doc.campaign || this.pos_profile.campaign;
      doc.currency = doc.currency || this.pos_profile.currency;
      doc.naming_series = doc.naming_series || this.pos_profile.naming_series;
      doc.customer = this.customer;
      doc.items = this.get_invoice_items();
    posa_offers: this.posa_offers, // Ensure posa_offers is included
    doc.taxes_and_charges = this.invoice_doc.taxes_and_charges; // Ensure tax and charges from pos_profile
      doc.total = this.subtotal;
      doc.discount_amount = flt(this.discount_amount);
      doc.additional_discount_percentage = flt(
        this.additional_discount_percentage
      );
      doc.posa_pos_opening_shift = this.pos_opening_shift.name;
      doc.payments = this.get_payments();
      doc.taxes = [];
      doc.is_return = this.invoice_doc.is_return;
      doc.return_against = this.invoice_doc.return_against;
      doc.posa_offers = this.posa_offers;
      doc.posa_coupons = this.posa_coupons;
      doc.posa_service_zone = this.selcted_service_zone || "";
      doc.posa_service_table = this.selcted_service_table || "";
      doc.posa_order_type = this.selcted_order_type || "";
      doc.posa_delivery_charges = this.selcted_delivery_charges.name;
      doc.posa_delivery_charges_rate = this.delivery_charges_rate || 0;
      doc.posting_date = this.posting_date;
      doc.custom_rfid_card = this.custom_rfid_card;
      if (this.pos_profile.posa_allow_conditional_tax) {
        const card = this.selected_tax === "card";
        doc.posa_conditional_tax_applied = card ? 1 : 0;
        doc.posa_is_card = card ? 1 : 0;
        doc.taxes_and_charges = card
          ? this.pos_profile.posa_card_taxes_and_charges
          : this.pos_profile.taxes_and_charges;
      }
      return doc;
    },

    async get_invoice_from_order_doc() {
      let doc = {};
      if (this.invoice_doc.doctype == "Sales Order") {
        await frappe.call({
          method:
            "posawesome.posawesome.api.posapp.create_sales_invoice_from_order",
          args: {
            sales_order: this.invoice_doc.name,
          },
          // async: false,
          callback: function (r) {
            if (r.message) {
              doc = r.message;
            }
          },
        });
      } else {
        doc = this.invoice_doc;
      }
      const Items = [];
      const updatedItemsData = this.get_invoice_items();
      doc.items.forEach((item) => {
        const updatedData = updatedItemsData.find(
          (updatedItem) => updatedItem.item_code === item.item_code
        );
        if (updatedData) {
          item.item_code = updatedData.item_code;
          item.posa_row_id = updatedData.posa_row_id;
          item.posa_offers = updatedData.posa_offers;
          item.posa_offer_applied = updatedData.posa_offer_applied;
          item.posa_is_offer = updatedData.posa_is_offer;
          item.posa_is_replace = updatedData.posa_is_replace;
          item.is_free_item = updatedData.is_free_item;
          item.qty = flt(updatedData.qty);
          item.rate = flt(updatedData.rate);
          item.uom = updatedData.uom;
          item.amount = flt(updatedData.qty) * flt(updatedData.rate);
          item.conversion_factor = updatedData.conversion_factor;
          item.serial_no = updatedData.serial_no;
          item.discount_percentage = flt(updatedData.discount_percentage);
          item.discount_amount = flt(updatedData.discount_amount);
          item.batch_no = updatedData.batch_no;
          item.posa_notes = updatedData.posa_notes;
          item.posa_delivery_date = updatedData.posa_delivery_date;
          item.price_list_rate = updatedData.price_list_rate;
          Items.push(item);
        }
      });
      doc.items = Items;
      const newItems = [...doc.items];
      const existingItemCodes = new Set(newItems.map((item) => item.item_code));
      updatedItemsData.forEach((updatedItem) => {
        if (!existingItemCodes.has(updatedItem.item_code)) {
          newItems.push(updatedItem);
        }
      });
      doc.items = newItems;
      doc.update_stock = 1;
      doc.is_pos = 1;
      doc.payments = this.get_payments();
      return doc;
    },

    get_invoice_items() {
      const items_list = [];
      this.items.forEach((item) => {
        const new_item = {
          item_code: item.item_code,
          posa_row_id: item.posa_row_id,
          posa_offers: item.posa_offers,
          posa_offer_applied: item.posa_offer_applied,
          posa_is_offer: item.posa_is_offer,
          posa_is_replace: item.posa_is_replace,
          is_free_item: item.is_free_item,
          qty: flt(item.qty),
          rate: flt(item.rate),
          uom: item.uom,
          amount: flt(item.qty) * flt(item.rate),
          conversion_factor: item.conversion_factor,
          serial_no: item.serial_no,
          discount_percentage: flt(item.discount_percentage),
          discount_amount: flt(item.discount_amount),
          batch_no: item.batch_no,
          posa_notes: item.posa_notes,
          posa_delivery_date: item.posa_delivery_date,
          price_list_rate: item.price_list_rate,
          custom_rfid_card: item.custom_rfid_card,
          maximum_retail_price: item.maximum_retail_price,
          // ?? preserve sales person
          posa_sales_person: item.posa_sales_person || null,
        };
        items_list.push(new_item);
      });

      return items_list;
    },

    get_order_items() {
      const items_list = [];
      this.items.forEach((item) => {
        const new_item = {
          item_code: item.item_code,
          posa_row_id: item.posa_row_id,
          posa_offers: item.posa_offers,
          posa_offer_applied: item.posa_offer_applied,
          posa_is_offer: item.posa_is_offer,
          posa_is_replace: item.posa_is_replace,
          is_free_item: item.is_free_item,
          qty: flt(item.qty),
          rate: flt(item.rate),
          uom: item.uom,
          amount: flt(item.qty) * flt(item.rate),
          conversion_factor: item.conversion_factor,
          serial_no: item.serial_no,
          discount_percentage: flt(item.discount_percentage),
          discount_amount: flt(item.discount_amount),
          batch_no: item.batch_no,
          posa_notes: item.posa_notes,
          posa_delivery_date: item.posa_delivery_date,
          price_list_rate: item.price_list_rate,
        };
        items_list.push(new_item);
      });
      return items_list;
    },

    get_payments() {
      const payments = [];
      this.pos_profile.payments.forEach((payment) => {
        payments.push({
          amount: 0,
          mode_of_payment: payment.mode_of_payment,
          default: payment.default,
          account: "",
        });
      });
      return payments;
    },

    update_invoice(doc) {
      const vm = this;
      if (offlinePos.useOffline()) {
        // totals, taxes and payment rows computed locally (see offline/taxes.js)
        vm.invoice_doc = offlinePos.buildInvoice(doc);
        return vm.invoice_doc;
      }
      let updated = false;
      frappe.call({
        method: "posawesome.posawesome.api.posapp.update_invoice",
        args: {
          data: doc,
        },
        async: false,
        callback: function (r) {
          if (r.message) {
            vm.invoice_doc = r.message;
            updated = true;
          }
        },
      });
      if (!updated && offlinePos.useOffline()) {
        // the server dropped while we were talking to it
        vm.invoice_doc = offlinePos.buildInvoice(doc);
      }
      return this.invoice_doc;
    },

    update_invoice_from_order(doc) {
      const vm = this;
      frappe.call({
        method: "posawesome.posawesome.api.posapp.update_invoice_from_order",
        args: {
          data: doc,
        },
        async: false,
        callback: function (r) {
          if (r.message) {
            vm.invoice_doc = r.message;
          }
        },
      });
      return this.invoice_doc;
    },

    process_invoice() {
      const doc = this.get_invoice_doc();
      if (doc.name) {
        return this.update_invoice(doc);
      } else {
        return this.update_invoice(doc);
      }
    },

    async process_invoice_from_order() {
      const doc = await this.get_invoice_from_order_doc();
      var up_invoice;
      if (doc.name) {
        up_invoice = await this.update_invoice_from_order(doc);
        return up_invoice;
      } else {
        return this.update_invoice_from_order(doc);
      }
    },

  open_conditional_tax_dialog() {
    this.selected_tax = "cash";
    this.tax_dialog = true;

    this.$nextTick(() => {
      this.$refs.cashBtn?.$el?.focus();
    });
  },
  closeTaxDialog() {
    this.tax_dialog = false;
  },
  handleTaxDialogKey(e) {
    if (!this.tax_dialog) return;

    switch (e.key) {
      case "Enter":
        e.preventDefault();
        this.selectTax(this.selected_tax);
        break;

      case "ArrowRight":
      case "ArrowLeft":
        this.toggleTaxSelection();
        break;

      case "Escape":
        this.closeTaxDialog();
        break;
    }
  },
  toggleTaxSelection() {
    this.selected_tax =
      this.selected_tax === "cash" ? "card" : "cash";

    this.$nextTick(() => {
      if (this.selected_tax === "cash") {
        this.$refs.cashBtn?.$el?.focus();
      } else {
        this.$refs.cardBtn?.$el?.focus();
      }
    });
  },

  selectTax(type) {
    this.selected_tax = type;
    this.tax_dialog = false;
    this.apply_conditional_tax(type);
  },

  apply_conditional_tax(type) {
    let tax_template = null;

    if (type === "cash") {
      tax_template = this.pos_profile.taxes_and_charges;
      this.invoice_doc.taxes_and_charges =
        this.pos_profile.taxes_and_charges;
      this.invoice_doc.posa_is_card = 0;
      this.invoice_doc.posa_conditional_tax_applied = 0;
    }

    if (type === "card") {
      tax_template = this.pos_profile.posa_card_taxes_and_charges;
      this.invoice_doc.taxes_and_charges =
        this.pos_profile.posa_card_taxes_and_charges;
      this.invoice_doc.posa_is_card = 1;
      this.invoice_doc.posa_conditional_tax_applied = 1;
    }

    if (!tax_template) {
      evntBus.$emit("show_mesage", {
        text: __("Tax template not configured"),
        color: "error",
      });
      return;
    }

    this._show_payment_internal();
  },


open_conditional_tax_dialogs() {
  const me = this;

  if (me.conditional_tax_dialog) {
    me.conditional_tax_dialog.show();
    return;
  }

  me.conditional_tax_dialog = new frappe.ui.Dialog({
    title: __("Select Payment Type"),
    fields: [
      {
        fieldtype: "Button",
        label: __("Cash (16%)"),
        click() {
          me.apply_conditional_tax("cash");
          me.conditional_tax_dialog.hide();
        },
      },
      {
        fieldtype: "Button",
        label: __("Card (5%)"),
        click() {
          me.apply_conditional_tax("card");
          me.conditional_tax_dialog.hide();
        },
      },
    ],
  });

  me.conditional_tax_dialog.show();
},


apply_conditional_taxs(type) {
  let tax_template = null;

  if (type === "cash") {
    tax_template = this.pos_profile.taxes_and_charges;
    this.invoice_doc.posa_is_card = 0;
    // this.invoice_doc.taxes_and_charges = this.pos_profile.taxes_and_charges;
    this.invoice_doc.posa_conditional_tax_applied = 0;
  } else if (type === "card") {
    tax_template = this.pos_profile.posa_card_taxes_and_charges;
    this.invoice_doc.posa_is_card = 1;
    // this.invoice_doc.taxes_and_charges = this.pos_profile.posa_card_taxes_and_charges;
    this.invoice_doc.posa_conditional_tax_applied = 1;
  }

  if (!tax_template) {
    evntBus.$emit("show_mesage", {
      text: __("Tax template not configured"),
      color: "error",
    });
    return;
  }

  // ? ONLY update local invoice state
  // this.invoice_doc.taxes_and_charges = tax_template;
  // this.invoice_doc.posa_conditional_tax_applied = 1;

  // ?? DO NOT CALL update_invoice HERE

  // Continue normal POS flow
  this._show_payment_internal();
},


async _show_payment_internal() {
  let invoice_doc;

  if (this.invoice_doc.is_return && !this.invoice_doc.return_against) {
    const invoice_doc = this.process_invoice();
    evntBus.$emit("send_invoice_doc_payment", invoice_doc);
  }

  if (this.invoice_doc.doctype == "Sales Order") {
    evntBus.$emit("show_payment", "true");
    const invoice_doc = await this.process_invoice_from_order();
    evntBus.$emit("send_invoice_doc_payment", invoice_doc);

  } else if (
    this.invoice_doc.doctype == "Sales Invoice" &&
    !this.invoice_doc.return_against &&
    this.invoice_doc.name &&
    !this.invoice_doc.__offline &&
    !offlinePos.useOffline()
  ) {
    const sales_invoice_item = this.invoice_doc.items[0];
    let sales_invoice_item_doc = {};

    frappe.call({
      method:
        "posawesome.posawesome.api.posapp.get_sales_invoice_child_table",
      args: {
        sales_invoice: this.invoice_doc.name,
        sales_invoice_item: sales_invoice_item.name,
      },
      async: false,
      callback: function (r) {
        if (r.message) {
          sales_invoice_item_doc = r.message;
        }
      },
    });

    if (sales_invoice_item_doc.sales_order) {
      evntBus.$emit("show_payment", "true");
      const invoice_doc = await this.process_invoice_from_order();
      evntBus.$emit("send_invoice_doc_payment", invoice_doc);
    } else {
      evntBus.$emit("show_payment", "true");
      const invoice_doc = this.process_invoice();
      evntBus.$emit("send_invoice_doc_payment", invoice_doc);
    }
  } else {
    evntBus.$emit("show_payment", "true");
    const invoice_doc = this.process_invoice();
    evntBus.$emit("send_invoice_doc_payment", invoice_doc);
  }
},

async show_payment() {
  if (this.pos_profile.posa_allow_order_type && !this.selcted_order_type) {
    evntBus.$emit("show_mesage", {
      text: __("Select Order Type First!"),
      color: "error",
    });
    return;
  }

  const orderType = this.order_type.find(
    d => d.name === this.selcted_order_type
  );
  if (
    orderType?.is_table_required &&
    !this.selcted_service_table
  ) {
    evntBus.$emit("show_mesage", {
      text: __("Please select the Service Table."),
      color: "error",
    });
    // Optional: reopen the table selection dialog
    this.tableDialog = true;
    return;
  }

  if (!this.customer) {
    evntBus.$emit("show_mesage", {
      text: __("There is no Customer !"),
      color: "error",
    });
    return;
  }

  if (!this.items.length) {
    evntBus.$emit("show_mesage", {
      text: __("There is no Items !"),
      color: "error",
    });
    return;
  }

  if (!this.validate()) {
    return;
  }

  // ?? CONDITIONAL TAX ENTRY
  if (
    this.pos_profile.posa_allow_conditional_tax
    // this.pos_profile.posa_allow_conditional_tax &&
    // !this.invoice_doc.posa_conditional_tax_applied
  ) {
    this.open_conditional_tax_dialog();
    return;
  }

  // Normal flow
  this._show_payment_internal();
},


    async show_payment_before_dual_tax() {
      if (!this.customer) {
        evntBus.$emit("show_mesage", {
          text: __(`There is no Customer !`),
          color: "error",
        });
        return;
      }
      if (!this.items.length) {
        evntBus.$emit("show_mesage", {
          text: __(`There is no Items !`),
          color: "error",
        });
        return;
      }
      if (!this.validate()) {
        return;
      }
      if (this.invoice_doc.doctype == "Sales Order") {
        evntBus.$emit("show_payment", "true");
        const invoice_doc = this.process_invoice_from_order();
        evntBus.$emit("send_invoice_doc_payment", invoice_doc);
      } else if (this.invoice_doc.doctype == "Sales Invoice") {
        const sales_invoice_item = this.invoice_doc.items[0];
        var sales_invoice_item_doc = {};
        frappe.call({
          method:
            "posawesome.posawesome.api.posapp.get_sales_invoice_child_table",
          args: {
            sales_invoice: this.invoice_doc.name,
            sales_invoice_item: sales_invoice_item.name,
          },
          async: false,
          callback: function (r) {
            if (r.message) {
              sales_invoice_item_doc = r.message;
            }
          },
        });
        if (sales_invoice_item_doc.sales_order) {
          evntBus.$emit("show_payment", "true");
          const invoice_doc = this.process_invoice_from_order();
          evntBus.$emit("send_invoice_doc_payment", invoice_doc);
        } else {
          evntBus.$emit("show_payment", "true");
          const invoice_doc = this.process_invoice();
          evntBus.$emit("send_invoice_doc_payment", invoice_doc);
        }
      } else {
        evntBus.$emit("show_payment", "true");
        const invoice_doc = this.process_invoice();
        evntBus.$emit("send_invoice_doc_payment", invoice_doc);
      }
    },

    async show_payment_old() {
      if (!this.customer) {
        evntBus.$emit("show_mesage", {
          text: __(`There is no Customer !`),
          color: "error",
        });
        return;
      }
      if (!this.items.length) {
        evntBus.$emit("show_mesage", {
          text: __(`There is no Items !`),
          color: "error",
        });
        return;
      }
      if (!this.validate()) {
        return;
      }
      if (this.invoice_doc.doctype == "Sales Order") {
        evntBus.$emit("show_payment", "true");
        const invoice_doc = await this.process_invoice_from_order();
        evntBus.$emit("send_invoice_doc_payment", invoice_doc);
      } else if (this.invoice_doc.doctype == "Sales Invoice") {
        const sales_invoice_item = this.invoice_doc.items[0];
        var sales_invoice_item_doc = {};
        frappe.call({
          method:
            "posawesome.posawesome.api.posapp.get_sales_invoice_child_table",
          args: {
            sales_invoice: this.invoice_doc.name,
            sales_invoice_item: sales_invoice_item.name,
          },
          async: false,
          callback: function (r) {
            if (r.message) {
              sales_invoice_item_doc = r.message;
            }
          },
        });
        if (sales_invoice_item_doc.sales_order) {
          evntBus.$emit("show_payment", "true");
          const invoice_doc = await this.process_invoice_from_order();
          evntBus.$emit("send_invoice_doc_payment", invoice_doc);
        } else {
          evntBus.$emit("show_payment", "true");
          const invoice_doc = this.process_invoice();
          evntBus.$emit("send_invoice_doc_payment", invoice_doc);
        }
      } else {
        evntBus.$emit("show_payment", "true");
        const invoice_doc = this.process_invoice();
        evntBus.$emit("send_invoice_doc_payment", invoice_doc);
      }
    },
    validate() {
      let value = true;
      this.items.forEach((item) => {
        // ?? NEW CONDITION: Prevent selling below valuation rate
        if (!this.pos_profile.posa_allow_sale_below_valuation_rate && item.rate && item.valuation_rate && this.flt(item.rate) < this.flt(item.valuation_rate)) {
          evntBus.$emit("show_mesage", {
            text: __(
              `Sale not allowed for item '{0}' — Rate ({1}) is less than Valuation Rate ({2})`,
              [item.item_name, this.flt(item.rate), this.flt(item.valuation_rate)]
            ),
            color: "error",
          });
          value = false;
          return; // skip further validation for this item
        }

        if (
          this.pos_profile.posa_max_discount_allowed &&
          !item.posa_offer_applied
        ) {
          if (item.discount_amount && this.flt(item.discount_amount) > 0) {
            // calc discount percentage
            const discount_percentage =
              (this.flt(item.discount_amount) * 100) /
              this.flt(item.price_list_rate);
            if (
              discount_percentage > this.pos_profile.posa_max_discount_allowed &&
              !item.custom_rfid_card
            ) {
              evntBus.$emit("show_mesage", {
                text: __(
                  `Discount percentage for item '{0}' cannot be greater than {1}%`,
                  [item.item_name, this.pos_profile.posa_max_discount_allowed]
                ),
                color: "error",
              });
              value = false;
            }
          }
        }
        //if (this.stock_settings.allow_negative_stock != 1) {
        if (
          this.stock_settings.allow_negative_stock != 1 ||
          this.pos_profile.posa_block_sale_beyond_available_qty == 1
        ) {
          if (
            this.invoiceType == "Invoice" &&
            ((item.is_stock_item && item.stock_qty && !item.actual_qty) ||
              (item.is_stock_item && item.stock_qty > item.actual_qty))
          ) {
            evntBus.$emit("show_mesage", {
              text: __(
                `The existing quantity '{0}' for item '{1}' is not enough`,
                [item.actual_qty, item.item_name]
              ),
              color: "error",
            });
            value = false;
          }
        }
        if (item.qty == 0) {
          evntBus.$emit("show_mesage", {
            text: __(`Quantity for item '{0}' cannot be Zero (0)`, [
              item.item_name,
            ]),
            color: "error",
          });
          value = false;
        }
        if (
          item.max_discount > 0 &&
          item.discount_percentage > item.max_discount
        ) {
          evntBus.$emit("show_mesage", {
            text: __(`Maximum discount for Item {0} is {1}%`, [
              item.item_name,
              item.max_discount,
            ]),
            color: "error",
          });
          value = false;
        }
        if (item.has_serial_no) {
          if (
            !this.invoice_doc.is_return &&
            (!item.serial_no_selected ||
              item.stock_qty != item.serial_no_selected.length)
          ) {
            evntBus.$emit("show_mesage", {
              text: __(`Selected serial numbers of item {0} is incorrect`, [
                item.item_name,
              ]),
              color: "error",
            });
            value = false;
          }
        }
        if (item.has_batch_no) {
          if (item.stock_qty > item.actual_batch_qty) {
            evntBus.$emit("show_mesage", {
              text: __(
                `The existing batch quantity of item {0} is not enough`,
                [item.item_name]
              ),
              color: "error",
            });
            value = false;
          }
        }
        if (this.pos_profile.posa_allow_user_to_edit_additional_discount) {
          const clac_percentage = (this.discount_amount / this.Total) * 100;
          if (clac_percentage > this.pos_profile.posa_max_discount_allowed && !this.custom_rfid_card && !this.discount_percentage_offer_name) {
            evntBus.$emit("show_mesage", {
              text: __(`The discount should not be higher than {0}%`, [
                this.pos_profile.posa_max_discount_allowed,
              ]),
              color: "error",
            });
            value = false;
          }
        }
if (this.invoice_doc.is_return) {
  if (this.subtotal >= 0) {
    evntBus.$emit("show_mesage", {
      text: __(`Return Invoice Total Not Correct`),
      color: "error",
    });
    value = false;
    return value;
  }

  if (this.invoice_doc.return_against && this.return_doc) {
    // Return against an invoice: existing checks
    if (Math.abs(this.subtotal) > Math.abs(this.return_doc.total)) {
      evntBus.$emit("show_mesage", {
        text: __(`Return Invoice Total should not be higher than {0}`, [
          this.return_doc.total,
        ]),
        color: "error",
      });
      value = false;
      return value;
    }
    this.items.forEach((item) => {
      const return_item = this.return_doc.items.find(
        (element) => element.item_code == item.item_code
      );
      if (!return_item) {
        evntBus.$emit("show_mesage", {
          text: __(
            `The item {0} cannot be returned because it is not in the invoice {1}`,
            [item.item_name, this.return_doc.name]
          ),
          color: "error",
        });
        value = false;
      } else if (
        Math.abs(item.qty) > Math.abs(return_item.qty) ||
        Math.abs(item.qty) == 0
      ) {
        evntBus.$emit("show_mesage", {
          text: __(`The QTY of the item {0} cannot be greater than {1}`, [
            item.item_name,
            return_item.qty,
          ]),
          color: "error",
        });
        value = false;
      }
    });
  } else {
    // Return without invoice: every row must be negative
    this.items.forEach((item) => {
      if (item.qty > 0) {
        evntBus.$emit("show_mesage", {
          text: __(`Quantity of item {0} must be negative in a return`, [
            item.item_name,
          ]),
          color: "error",
        });
        value = false;
      }
    });
  }
}
      });
      return value;
    },
    get_draft_invoices() {
      const vm = this;
      if (offlinePos.useOffline()) {
        evntBus.$emit("show_mesage", { text: __("Held invoices are not available offline"), color: "warning" });
        return;
      }
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
      this.get_draft_invoices_count();
    },
    get_draft_invoices_count() {
      if (offlinePos.useOffline()) return;
      if (!this.pos_opening_shift || !this.pos_opening_shift.name) {
          console.warn("Cannot load drafts: POS opening shift missing");
          return;
      }
      const vm = this;
      frappe.call({
        method: "posawesome.posawesome.api.posapp.get_draft_invoices",
        args: {
          pos_opening_shift: this.pos_opening_shift.name,
        },
        async: false,
        callback: function (r) {
          if (r.message) {
            vm.draftInvoicesCount = r.message.length;
          }
        },
      });
    },

    get_draft_orders() {
      const vm = this;
      if (offlinePos.useOffline()) {
        evntBus.$emit("show_mesage", { text: __("Sales Orders are not available offline"), color: "warning" });
        return;
      }
      frappe.call({
        method: "posawesome.posawesome.api.posapp.search_orders",
        args: {
          company: this.pos_profile.company,
          currency: this.pos_profile.currency,
        },
        async: false,
        callback: function (r) {
          if (r.message) {
            evntBus.$emit("open_orders", r.message);
          }
        },
      });
    },

    open_returns() {
      evntBus.$emit("open_returns", this.pos_profile.company);
    },

    close_payments() {
      evntBus.$emit("show_payment", "false");
    },

    update_items_details(items) {
      if (!items.length > 0) {
        return;
      }
      const vm = this;
      if (!vm.pos_profile) return;
      if (offlinePos.useOffline() || (offlinePos.useLocalCatalog() && items.every((i) => offlinePos.catalog.getItem(i.item_code)))) {
        offlinePos.itemsDetails(items).forEach((updated_item, idx) => {
          const item = items[idx];
          item.actual_qty = updated_item.actual_qty;
          item.serial_no_data = updated_item.serial_no_data;
          item.batch_no_data = updated_item.batch_no_data;
          item.item_uoms = updated_item.item_uoms;
          item.has_batch_no = updated_item.has_batch_no;
          item.has_serial_no = updated_item.has_serial_no;
        });
        if (!offlinePos.useOffline() && items.some((i) => i.has_batch_no || i.has_serial_no)) {
          // batches / serials need live warehouse data: fall through to the server
        } else {
          return;
        }
      }
      frappe.call({
        method: "posawesome.posawesome.api.posapp.get_items_details",
        async: false,
        args: {
          pos_profile: vm.pos_profile,
          items_data: items,
        },
        callback: function (r) {
          if (r.message) {
            items.forEach((item) => {
              const updated_item = r.message.find(
                (element) => element.posa_row_id == item.posa_row_id
              );
              item.actual_qty = updated_item.actual_qty;
              item.serial_no_data = updated_item.serial_no_data;
              item.batch_no_data = updated_item.batch_no_data;
              item.item_uoms = updated_item.item_uoms;
              item.has_batch_no = updated_item.has_batch_no;
              item.has_serial_no = updated_item.has_serial_no;
            });
          }
        },
      });
    },

    update_item_detail(item) {
      const vm = this;
      if (offlinePos.useOffline()) {
        const data = offlinePos.itemDetail({
          item_code: item.item_code,
          customer: this.customer,
          qty: item.qty,
          uom: item.uom,
          price_list: this.get_price_list(),
          price_list_rate: item.price_list_rate,
          batch_no: item.batch_no,
          posting_date: this.posting_date,
        });
        if (data) this.apply_item_detail(item, data);
        return;
      }
      frappe.call({
        method: "posawesome.posawesome.api.posapp.get_item_detail",
        args: {
          warehouse: this.pos_profile.warehouse,
          doc: this.get_invoice_doc(),
          price_list: this.pos_profile.price_list,
          item: {
            item_code: item.item_code,
            customer: this.customer,
            doctype: "Sales Invoice",
            name: "New Sales Invoice 1",
            company: this.pos_profile.company,
            conversion_rate: 1,
            qty: item.qty,
            price_list_rate: item.price_list_rate,
            child_docname: "New Sales Invoice Item 1",
            cost_center: this.pos_profile.cost_center,
            currency: this.pos_profile.currency,
            // plc_conversion_rate: 1,
            pos_profile: this.pos_profile.name,
            uom: item.uom,
            tax_category: "",
            transaction_type: "selling",
            update_stock: this.pos_profile.update_stock,
            price_list: this.get_price_list(),
            has_batch_no: item.has_batch_no,
            serial_no: item.serial_no,
            batch_no: item.batch_no,
            is_stock_item: item.is_stock_item,
          },
        },
        callback: function (r) {
          if (r.message) {
            vm.apply_item_detail(item, r.message);
          }
        },
      });
    },

    apply_item_detail(item, data) {
      const vm = this;
      {
        {
          {
            // item.stock_uom = data.stock_uom; // Ensure stock_uom is set
            // item.sales_uom = data.sales_uom; // Ensure sales_uom is set
            if (data.batch_no_data) {
              item.batch_no_data = data.batch_no_data;
            }
            if (
              item.has_batch_no &&
              vm.pos_profile.posa_auto_set_batch &&
              !item.batch_no &&
              data.batch_no_data
            ) {
              item.batch_no_data = data.batch_no_data;
              vm.set_batch_qty(item, item.batch_no, false);
            }
            if (data.has_pricing_rule) {
            } else if (
              vm.pos_profile.posa_apply_customer_discount &&
              vm.customer_info.posa_discount > 0 &&
              vm.customer_info.posa_discount <= 100
            ) {
              if (
                item.posa_is_offer == 0 &&
                !item.posa_is_replace &&
                item.posa_offer_applied == 0
              ) {
                if (item.max_discount > 0) {
                  item.discount_percentage =
                    item.max_discount < vm.customer_info.posa_discount
                      ? item.max_discount
                      : vm.customer_info.posa_discount;
                } else {
                  item.discount_percentage = vm.customer_info.posa_discount;
                }
              }
            }
            if (!item.batch_price) {
              if (
                !item.is_free_item &&
                !item.posa_is_offer &&
                !item.posa_is_replace
              ) {
                // item.price_list_rate = data.price_list_rate;
    // ONLY overwrite if NOT manual/custom rate
    if (!item.posa_custom_rate) {
      item.price_list_rate = data.price_list_rate;
      item.rate = data.price_list_rate;
    }
              }
            }
            item.last_purchase_rate = data.last_purchase_rate;
            item.projected_qty = data.projected_qty;
            item.reserved_qty = data.reserved_qty;
            item.conversion_factor = data.conversion_factor;
            item.stock_qty = data.stock_qty;
            item.actual_qty = data.actual_qty;
            item.stock_uom = data.stock_uom;
            (item.has_serial_no = data.has_serial_no),
              (item.has_batch_no = data.has_batch_no),
              vm.calc_item_price(item);
// Apply buffet production rate after all price calculations
const buffet_rate_applied = vm.apply_buffet_production_rate(item);

// RESTORE manual rate after all calculations
// if (item.posa_custom_rate) {
if (item.posa_custom_rate && !buffet_rate_applied) {

  item.rate = flt(item.rate || item.price_list_rate || 0);

  item.price_list_rate = flt(item.rate);
  // item.price_list_rate = data.price_list_rate;
  // item.discount_amount = item.price_list_rate - item.rate;

  item.amount =
    flt(item.qty || 1) * flt(item.rate);

  item.base_amount = item.amount;

  // important
  vm.$forceUpdate();
}
  vm.$forceUpdate();
          }
        }
      }
    },

    fetch_customer_details() {
      const vm = this;
      if (this.customer && offlinePos.useOffline()) {
        const info = offlinePos.customerInfo(this.customer);
        if (info) vm.customer_info = info;
        vm.update_price_list();
        return;
      }
      if (this.customer) {
        frappe.call({
          method: "posawesome.posawesome.api.posapp.get_customer_info",
          args: {
            customer: vm.customer,
          },
          async: false,
          callback: (r) => {
            const message = r.message;
            if (!r.exc) {
              vm.customer_info = {
                ...message,
              };
            }
            vm.update_price_list();
          },
        });
      }
    },

    get_price_list() {
      let price_list = this.pos_profile.selling_price_list;
      if (this.customer_info && this.pos_profile) {
        const { customer_price_list, customer_group_price_list } =
          this.customer_info;
        const pos_price_list = this.pos_profile.selling_price_list;
        if (customer_price_list && customer_price_list != pos_price_list) {
          price_list = customer_price_list;
        } else if (
          customer_group_price_list &&
          customer_group_price_list != pos_price_list
        ) {
          price_list = customer_group_price_list;
        }
      }
      return price_list;
    },

    update_price_list() {
      let price_list = this.get_price_list();
      if (price_list == this.pos_profile.selling_price_list) {
        price_list = null;
      }
      evntBus.$emit("update_customer_price_list", price_list);
    },
    update_discount_umount() {
      const value = flt(this.additional_discount_percentage);
      if (value >= -100 && value <= 100) {
        this.discount_amount = (this.Total * value) / 100;
      } else {
        this.additional_discount_percentage = 0;
        this.discount_amount = 0;
      }
    },

    calc_prices(item, value, $event) {
      if (event.target.id === "rate") {
        item.discount_percentage = 0;
        if (value < item.price_list_rate) {
          item.discount_amount = this.flt(
            this.flt(item.price_list_rate) - flt(value),
            this.currency_precision
          );
        } else if (value < 0) {
          item.rate = item.price_list_rate;
          item.discount_amount = 0;
        } else if (value > item.price_list_rate) {
          item.discount_amount = 0;
        }
      } else if (event.target.id === "discount_amount") {
        if (value < 0) {
          item.discount_amount = 0;
          item.discount_percentage = 0;
        } else {
          item.rate = flt(item.price_list_rate) - flt(value);
          item.discount_percentage = 0;
        }
      } else if (event.target.id === "discount_percentage") {
        if (value < 0) {
          item.discount_amount = 0;
          item.discount_percentage = 0;
        } else {
          item.rate = this.flt(
            flt(item.price_list_rate) -
              (flt(item.price_list_rate) * flt(value)) / 100,
            this.currency_precision
          );
          item.discount_amount = this.flt(
            flt(item.price_list_rate) - flt(+item.rate),
            this.currency_precision
          );
        }
      }
    },

    calc_item_price(item) {
      if (!item.posa_offer_applied) {
        if (item.price_list_rate) {
          item.rate = item.price_list_rate;
        }
      }
      if (item.discount_percentage) {
        item.rate =
          flt(item.price_list_rate) -
          (flt(item.price_list_rate) * flt(item.discount_percentage)) / 100;
        item.discount_amount = this.flt(
          flt(item.price_list_rate) - flt(item.rate),
          this.currency_precision
        );
      } else if (item.discount_amount) {
        item.rate = this.flt(
          flt(item.price_list_rate) - flt(item.discount_amount),
          this.currency_precision
        );
      }
    },

    calc_uom(item, value) {
      const new_uom = item.item_uoms.find((element) => element.uom == value);
      item.conversion_factor = new_uom.conversion_factor;
      if (!item.posa_offer_applied) {
        item.discount_amount = 0;
        item.discount_percentage = 0;
      }
      if (item.batch_price) {
        item.price_list_rate = item.batch_price * new_uom.conversion_factor;
      }
      this.update_item_detail(item);
    },

    calc_stock_qty(item, value) {
      item.stock_qty = item.conversion_factor * value;
    },

    set_serial_no(item) {
      if (!item.has_serial_no) return;
      item.serial_no = "";
      item.serial_no_selected.forEach((element) => {
        item.serial_no += element + "\n";
      });
      item.serial_no_selected_count = item.serial_no_selected.length;
      if (item.serial_no_selected_count != item.stock_qty) {
        item.qty = item.serial_no_selected_count;
        this.calc_stock_qty(item, item.qty);
        this.$forceUpdate();
      }
    },

    set_batch_qty(item, value, update = true) {
      const existing_items = this.items.filter(
        (element) =>
          element.item_code == item.item_code &&
          element.posa_row_id != item.posa_row_id
      );
      const used_batches = {};
      item.batch_no_data.forEach((batch) => {
        used_batches[batch.batch_no] = {
          ...batch,
          used_qty: 0,
          remaining_qty: batch.batch_qty,
        };
        existing_items.forEach((element) => {
          if (element.batch_no && element.batch_no == batch.batch_no) {
            used_batches[batch.batch_no].used_qty += element.qty;
            used_batches[batch.batch_no].remaining_qty -= element.qty;
            used_batches[batch.batch_no].batch_qty -= element.qty;
          }
        });
      });

      // set item batch_no based on:
      // 1. if batch has expiry_date we should use the batch with the nearest expiry_date
      // 2. if batch has no expiry_date we should use the batch with the earliest manufacturing_date
      // 3. we should not use batch with remaining_qty = 0
      // 4. we should the highest remaining_qty
      const batch_no_data = Object.values(used_batches)
        .filter((batch) => batch.remaining_qty > 0)
        .sort((a, b) => {
          if (a.expiry_date && b.expiry_date) {
            return a.expiry_date - b.expiry_date;
          } else if (a.expiry_date) {
            return -1;
          } else if (b.expiry_date) {
            return 1;
          } else if (a.manufacturing_date && b.manufacturing_date) {
            return a.manufacturing_date - b.manufacturing_date;
          } else if (a.manufacturing_date) {
            return -1;
          } else if (b.manufacturing_date) {
            return 1;
          } else {
            return b.remaining_qty - a.remaining_qty;
          }
        });
      if (batch_no_data.length > 0) {
        let batch_to_use = null;
        if (value) {
          batch_to_use = batch_no_data.find((batch) => batch.batch_no == value);
        }
        if (!batch_to_use) {
          batch_to_use = batch_no_data[0];
        }
        item.batch_no = batch_to_use.batch_no;
        item.actual_batch_qty = batch_to_use.batch_qty;
        item.batch_no_expiry_date = batch_to_use.expiry_date;
        if (batch_to_use.batch_price) {
          item.batch_price = batch_to_use.batch_price;
          item.price_list_rate = batch_to_use.batch_price;
          item.rate = batch_to_use.batch_price;
        } else if (update) {
          item.batch_price = null;
          this.update_item_detail(item);
        }
      } else {
        item.batch_no = null;
        item.actual_batch_qty = null;
        item.batch_no_expiry_date = null;
        item.batch_price = null;
      }
      // update item batch_no_data from batch_no_data
      item.batch_no_data = batch_no_data;
    },

    shortCancelDialog(e) {
      if ((e.key === 'V' || e.key === "v") && e.altKey) {
        e.preventDefault();
        this.cancel_dialog = true;
      }
    },

    shortHoldInvoice(e) {
      if (e.key === 'F9' || (e.key === "b" || e.key === "B") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.new_invoice();
      }
    },

    shortRetriveInvoice(e) {
      if (e.key === 'F10' || (e.key === "b" || e.key === "B") && e.altKey) {
        e.preventDefault();
        this.get_draft_invoices ();
      }
    },

    shortReturnInvoice(e) {
      if (this.pos_profile.posa_allow_return && (e.key === 'F11' || ((e.key === 'r' || e.key === 'R') && e.altKey))) {
        e.preventDefault();
        this.open_returns ();
      }
    },

    shortEditQty(e) {
      if (e.key === 'F2') {
        e.preventDefault();
        this.$refs.qtyField.focus();
      }
    },

    shortPlussQty(e) {
      if (e.key === '-' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.subtract_one(this.items[0]);
      }
    },

    shortMinusQty(e) {
      if (e.key === '+' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.add_one(this.items[0]);
      }
    },

    shortOpenPayment(e) {
      if (((e.key === "s" || e.key === "S") && (e.ctrlKey || e.metaKey)) || e.key === "F7") {
        e.preventDefault();
        if (this.$root) {
          evntBus.$emit('inputBlurTriggered');
        }
        this.show_payment();
      }
    },

    shortDeleteFirstItem(e) {
      if ((e.key === "d" || e.key === "D") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.handleRemoveItem(this.items[0]);
        //this.remove_item(this.items[0]);
        evntBus.$emit('escEventTriggered');
      }
    },

    shortOpenFirstItem(e) {
      if (((e.key === "q" || e.key === "Q") && (e.ctrlKey || e.metaKey)) || e.key === "F6" || e.key === "+") {
        e.preventDefault();
        if (!this.items.length) return;

        if (this.$root) {
          evntBus.$emit('inputBlurTriggered');
        }

        // Restaurant Item Popup
        if (this.pos_profile.posa_item_popup_instead_expand) {
          this.openItemDialog(this.items[0]);
          return;
        }


        if (this.expanded.length > 0) {
          this.expanded = [];
          if (this.$root) {
            evntBus.$emit('escEventTriggered');
            //evntBus.$emit('escEventTriggered');
          }
        } else {
          if (this.$root) {
            evntBus.$emit('inputBlurTriggered');
          }
          this.expanded.push(this.items[0]);
        }
      }
    },

    shortSelectDiscount(e) {
      if ((e.key === "z" || e.key === "Z") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.$refs.discount.focus();
      }
    },

    makeid(length) {
      let result = "";
      const characters = "abcdefghijklmnopqrstuvwxyz0123456789";
      const charactersLength = characters.length;
      for (var i = 0; i < length; i++) {
        result += characters.charAt(
          Math.floor(Math.random() * charactersLength)
        );
      }
      return result;
    },

    checkOfferIsAppley(item, offer) {
      let applied = false;
      const item_offers = JSON.parse(item.posa_offers);
      for (const row_id of item_offers) {
        const exist_offer = this.posa_offers.find((el) => row_id == el.row_id);
        if (exist_offer && exist_offer.offer_name == offer.name) {
          applied = true;
          break;
        }
      }
      return applied;
    },

    handelOffers() {
      const offers = [];
      this.posOffers.forEach((offer) => {
        if (offer.apply_on === "Item Code") {
          const itemOffer = this.getItemOffer(offer);
          if (itemOffer) {
            offers.push(itemOffer);
          }
        } else if (offer.apply_on === "Item Group") {
          const groupOffer = this.getGroupOffer(offer);
          if (groupOffer) {
            offers.push(groupOffer);
          }
        } else if (offer.apply_on === "Brand") {
          const brandOffer = this.getBrandOffer(offer);
          if (brandOffer) {
            offers.push(brandOffer);
          }
        } else if (offer.apply_on === "Transaction") {
          const transactionOffer = this.getTransactionOffer(offer);
          if (transactionOffer) {
            offers.push(transactionOffer);
          }
        }
      });

      this.setItemGiveOffer(offers);
      this.updatePosOffers(offers);
    },

    setItemGiveOffer(offers) {
      // Set item give offer for replace
      offers.forEach((offer) => {
        if (
          offer.apply_on == "Item Code" &&
          offer.apply_type == "Item Code" &&
          offer.replace_item
        ) {
          offer.give_item = offer.item;
          offer.apply_item_code = offer.item;
        } else if (
          offer.apply_on == "Item Group" &&
          offer.apply_type == "Item Group" &&
          offer.replace_cheapest_item
        ) {
          const offerItemCode = this.getCheapestItem(offer).item_code;
          offer.give_item = offerItemCode;
          offer.apply_item_code = offerItemCode;
        }
      });
    },

    getCheapestItem(offer) {
      let itemsRowID;
      if (typeof offer.items === "string") {
        itemsRowID = JSON.parse(offer.items);
      } else {
        itemsRowID = offer.items;
      }
      const itemsList = [];
      itemsRowID.forEach((row_id) => {
        itemsList.push(this.getItemFromRowID(row_id));
      });
      const result = itemsList.reduce(function (res, obj) {
        return !obj.posa_is_replace &&
          !obj.posa_is_offer &&
          obj.price_list_rate < res.price_list_rate
          ? obj
          : res;
      });
      return result;
    },

    getItemFromRowID(row_id) {
      const item = this.items.find((el) => el.posa_row_id == row_id);
      return item;
    },

    checkQtyAnountOffer(offer, qty, amount) {
      let min_qty = false;
      let max_qty = false;
      let min_amt = false;
      let max_amt = false;
      const applys = [];

      if (offer.min_qty || offer.min_qty == 0) {
        if (qty >= offer.min_qty) {
          min_qty = true;
        }
        applys.push(min_qty);
      }

      if (offer.max_qty > 0) {
        if (qty <= offer.max_qty) {
          max_qty = true;
        }
        applys.push(max_qty);
      }

      if (offer.min_amt > 0) {
        if (amount >= offer.min_amt) {
          min_amt = true;
        }
        applys.push(min_amt);
      }

      if (offer.max_amt > 0) {
        if (amount <= offer.max_amt) {
          max_amt = true;
        }
        applys.push(max_amt);
      }
      let apply = false;
      if (!applys.includes(false)) {
        apply = true;
      }
      const res = {
        apply: apply,
        conditions: { min_qty, max_qty, min_amt, max_amt },
      };
      return res;
    },

    checkOfferCoupon(offer) {
      if (offer.coupon_based) {
        const coupon = this.posa_coupons.find(
          (el) => offer.name == el.pos_offer
        );
        if (coupon) {
          offer.coupon = coupon.coupon;
          return true;
        } else {
          return false;
        }
      } else {
        offer.coupon = null;
        return true;
      }
    },

    getItemOffer(offer) {
      let apply_offer = null;
      if (offer.apply_on === "Item Code") {
        if (this.checkOfferCoupon(offer)) {
          this.items.forEach((item) => {
            if (!item.posa_is_offer && item.item_code === offer.item) {
              const items = [];
              if (
                offer.offer === "Item Price" &&
                item.posa_offer_applied &&
                !this.checkOfferIsAppley(item, offer)
              ) {
              } else {
                const res = this.checkQtyAnountOffer(
                  offer,
                  item.stock_qty,
                  item.stock_qty * item.price_list_rate
                );
                if (res.apply) {
                  items.push(item.posa_row_id);
                  offer.items = items;
                  apply_offer = offer;
                }
              }
            }
          });
        }
      }
      return apply_offer;
    },

    getGroupOffer(offer) {
      let apply_offer = null;
      if (offer.apply_on === "Item Group") {
        if (this.checkOfferCoupon(offer)) {
          const items = [];
          let total_count = 0;
          let total_amount = 0;
          this.items.forEach((item) => {
            if (!item.posa_is_offer && item.item_group === offer.item_group) {
              if (
                offer.offer === "Item Price" &&
                item.posa_offer_applied &&
                !this.checkOfferIsAppley(item, offer)
              ) {
              } else {
                total_count += item.stock_qty;
                total_amount += item.stock_qty * item.price_list_rate;
                items.push(item.posa_row_id);
              }
            }
          });
          if (total_count || total_amount) {
            const res = this.checkQtyAnountOffer(
              offer,
              total_count,
              total_amount
            );
            if (res.apply) {
              offer.items = items;
              apply_offer = offer;
            }
          }
        }
      }
      return apply_offer;
    },

    getBrandOffer(offer) {
      let apply_offer = null;
      if (offer.apply_on === "Brand") {
        if (this.checkOfferCoupon(offer)) {
          const items = [];
          let total_count = 0;
          let total_amount = 0;
          this.items.forEach((item) => {
            if (!item.posa_is_offer && item.brand === offer.brand) {
              if (
                offer.offer === "Item Price" &&
                item.posa_offer_applied &&
                !this.checkOfferIsAppley(item, offer)
              ) {
              } else {
                total_count += item.stock_qty;
                total_amount += item.stock_qty * item.price_list_rate;
                items.push(item.posa_row_id);
              }
            }
          });
          if (total_count || total_amount) {
            const res = this.checkQtyAnountOffer(
              offer,
              total_count,
              total_amount
            );
            if (res.apply) {
              offer.items = items;
              apply_offer = offer;
            }
          }
        }
      }
      return apply_offer;
    },
    getTransactionOffer(offer) {
      let apply_offer = null;
      if (offer.apply_on === "Transaction") {
        if (this.checkOfferCoupon(offer)) {
          let total_qty = 0;
          this.items.forEach((item) => {
            if (!item.posa_is_offer && !item.posa_is_replace) {
              total_qty += item.stock_qty;
            }
          });
          const items = [];
          const total_count = total_qty;
          const total_amount = this.Total;
          if (total_count || total_amount) {
            const res = this.checkQtyAnountOffer(
              offer,
              total_count,
              total_amount
            );
            if (res.apply) {
              this.items.forEach((item) => {
                items.push(item.posa_row_id);
              });
              offer.items = items;
              apply_offer = offer;
            }
          }
        }
      }
      return apply_offer;
    },

    updatePosOffers(offers) {
      evntBus.$emit("update_pos_offers", offers);
    },

    updateInvoiceOffers(offers) {
      this.posa_offers.forEach((invoiceOffer) => {
        const existOffer = offers.find(
          (offer) => invoiceOffer.row_id == offer.row_id
        );
        if (!existOffer) {
          this.removeApplyOffer(invoiceOffer);
        }
      });
      offers.forEach((offer) => {
        const existOffer = this.posa_offers.find(
          (invoiceOffer) => invoiceOffer.row_id == offer.row_id
        );
        if (existOffer) {
          existOffer.items = JSON.stringify(offer.items);
          if (
            existOffer.offer === "Give Product" &&
            existOffer.give_item &&
            existOffer.give_item != offer.give_item
          ) {
            const item_to_remove = this.items.find(
              (item) => item.posa_row_id == existOffer.give_item_row_id
            );
            if (item_to_remove) {
              const updated_item_offers = offer.items.filter(
                (row_id) => row_id != item_to_remove.posa_row_id
              );
              offer.items = updated_item_offers;
              this.remove_item(item_to_remove);
              existOffer.give_item_row_id = null;
              existOffer.give_item = null;
            }
            const newItemOffer = this.ApplyOnGiveProduct(offer);
            if (offer.replace_cheapest_item) {
              const cheapestItem = this.getCheapestItem(offer);
              const oldBaseItem = this.items.find(
                (el) => el.posa_row_id == item_to_remove.posa_is_replace
              );
              newItemOffer.qty = item_to_remove.qty;
              if (oldBaseItem && !oldBaseItem.posa_is_replace) {
                oldBaseItem.qty += item_to_remove.qty;
              } else {
                const restoredItem = this.ApplyOnGiveProduct(
                  {
                    given_qty: item_to_remove.qty,
                  },
                  item_to_remove.item_code
                );
                restoredItem.posa_is_offer = 0;
                this.items.unshift(restoredItem);
              }
              newItemOffer.posa_is_offer = 0;
              newItemOffer.posa_is_replace = cheapestItem.posa_row_id;
              const diffQty = cheapestItem.qty - newItemOffer.qty;
              if (diffQty <= 0) {
                newItemOffer.qty += diffQty;
                this.remove_item(cheapestItem);
                newItemOffer.posa_row_id = cheapestItem.posa_row_id;
                newItemOffer.posa_is_replace = newItemOffer.posa_row_id;
              } else {
                cheapestItem.qty = diffQty;
              }
            }
            this.items.unshift(newItemOffer);
            existOffer.give_item_row_id = newItemOffer.posa_row_id;
            existOffer.give_item = newItemOffer.item_code;
          } else if (
            existOffer.offer === "Give Product" &&
            existOffer.give_item &&
            existOffer.give_item == offer.give_item &&
            (offer.replace_item || offer.replace_cheapest_item)
          ) {
            this.$nextTick(function () {
              const offerItem = this.getItemFromRowID(
                existOffer.give_item_row_id
              );
              const diff = offer.given_qty - offerItem.qty;
              if (diff > 0) {
                const itemsRowID = JSON.parse(existOffer.items);
                const itemsList = [];
                itemsRowID.forEach((row_id) => {
                  itemsList.push(this.getItemFromRowID(row_id));
                });
                const existItem = itemsList.find(
                  (el) =>
                    el.item_code == offerItem.item_code &&
                    el.posa_is_replace != offerItem.posa_row_id
                );
                if (existItem) {
                  const diffExistQty = existItem.qty - diff;
                  if (diffExistQty > 0) {
                    offerItem.qty += diff;
                    existItem.qty -= diff;
                  } else {
                    offerItem.qty += existItem.qty;
                    this.remove_item(existItem);
                  }
                }
              }
            });
          } else if (existOffer.offer === "Item Price") {
            this.ApplyOnPrice(offer);
          } else if (existOffer.offer === "Grand Total") {
            this.ApplyOnTotal(offer);
          }
          this.addOfferToItems(existOffer);
        } else {
          this.applyNewOffer(offer);
        }
      });
    },

    removeApplyOffer(invoiceOffer) {
      if (invoiceOffer.offer === "Item Price") {
        this.RemoveOnPrice(invoiceOffer);
        const index = this.posa_offers.findIndex(
          (el) => el.row_id === invoiceOffer.row_id
        );
        this.posa_offers.splice(index, 1);
      }
      if (invoiceOffer.offer === "Give Product") {
        const item_to_remove = this.items.find(
          (item) => item.posa_row_id == invoiceOffer.give_item_row_id
        );
        const index = this.posa_offers.findIndex(
          (el) => el.row_id === invoiceOffer.row_id
        );
        this.posa_offers.splice(index, 1);
        this.remove_item(item_to_remove);
      }
      if (invoiceOffer.offer === "Grand Total") {
        this.RemoveOnTotal(invoiceOffer);
        const index = this.posa_offers.findIndex(
          (el) => el.row_id === invoiceOffer.row_id
        );
        this.posa_offers.splice(index, 1);
      }
      if (invoiceOffer.offer === "Loyalty Point") {
        const index = this.posa_offers.findIndex(
          (el) => el.row_id === invoiceOffer.row_id
        );
        this.posa_offers.splice(index, 1);
      }
      this.deleteOfferFromItems(invoiceOffer);
    },

    applyNewOffer(offer) {
      if (offer.offer === "Item Price") {
        this.ApplyOnPrice(offer);
      }
      if (offer.offer === "Give Product") {
        let itemsRowID;
        if (typeof offer.items === "string") {
          itemsRowID = JSON.parse(offer.items);
        } else {
          itemsRowID = offer.items;
        }
        if (
          offer.apply_on == "Item Code" &&
          offer.apply_type == "Item Code" &&
          offer.replace_item
        ) {
          const item = this.ApplyOnGiveProduct(offer, offer.item);
          item.posa_is_replace = itemsRowID[0];
          const baseItem = this.items.find(
            (el) => el.posa_row_id == item.posa_is_replace
          );
          const diffQty = baseItem.qty - offer.given_qty;
          item.posa_is_offer = 0;
          if (diffQty <= 0) {
            item.qty = baseItem.qty;
            this.remove_item(baseItem);
            item.posa_row_id = item.posa_is_replace;
          } else {
            baseItem.qty = diffQty;
          }
          this.items.unshift(item);
          offer.give_item_row_id = item.posa_row_id;
        } else if (
          offer.apply_on == "Item Group" &&
          offer.apply_type == "Item Group" &&
          offer.replace_cheapest_item
        ) {
          const itemsList = [];
          itemsRowID.forEach((row_id) => {
            itemsList.push(this.getItemFromRowID(row_id));
          });
          const baseItem = itemsList.find(
            (el) => el.item_code == offer.give_item
          );
          const item = this.ApplyOnGiveProduct(offer, offer.give_item);
          item.posa_is_offer = 0;
          item.posa_is_replace = baseItem.posa_row_id;
          const diffQty = baseItem.qty - offer.given_qty;
          if (diffQty <= 0) {
            item.qty = baseItem.qty;
            this.remove_item(baseItem);
            item.posa_row_id = item.posa_is_replace;
          } else {
            baseItem.qty = diffQty;
          }
          this.items.unshift(item);
          offer.give_item_row_id = item.posa_row_id;
        } else {
          const item = this.ApplyOnGiveProduct(offer);
          this.items.unshift(item);
          if (item) {
            offer.give_item_row_id = item.posa_row_id;
          }
        }
      }
      if (offer.offer === "Grand Total") {
        this.ApplyOnTotal(offer);
      }
      if (offer.offer === "Loyalty Point") {
        evntBus.$emit("show_mesage", {
          text: __("Loyalty Point Offer Applied"),
          color: "success",
        });
      }

      const newOffer = {
        offer_name: offer.name,
        row_id: offer.row_id,
        apply_on: offer.apply_on,
        offer: offer.offer,
        items: JSON.stringify(offer.items),
        give_item: offer.give_item,
        give_item_row_id: offer.give_item_row_id,
        offer_applied: offer.offer_applied,
        coupon_based: offer.coupon_based,
        coupon: offer.coupon,
      };
      this.posa_offers.push(newOffer);
      this.addOfferToItems(newOffer);
    },

    ApplyOnGiveProduct(offer, item_code) {
      if (!item_code) {
        item_code = offer.give_item;
      }
      const items = this.allItems;
      const item = items.find((item) => item.item_code == item_code);
      if (!item) {
        return;
      }
      const new_item = { ...item };
      new_item.qty = offer.given_qty;
      new_item.stock_qty = offer.given_qty;
      new_item.rate = offer.discount_type === "Rate" ? offer.rate : item.rate;
      new_item.discount_amount =
        offer.discount_type === "Discount Amount" ? offer.discount_amount : 0;
      new_item.discount_percentage =
        offer.discount_type === "Discount Percentage"
          ? offer.discount_percentage
          : 0;
      new_item.discount_amount_per_item = 0;
      new_item.uom = item.uom ? item.uom : item.stock_uom;
      new_item.actual_batch_qty = "";
      new_item.conversion_factor = 1;
      new_item.posa_offers = JSON.stringify([]);
      new_item.posa_offer_applied = 0;
      new_item.posa_is_offer = 1;
      new_item.posa_is_replace = null;
      new_item.posa_notes = "";
      new_item.posa_delivery_date = "";
      new_item.is_free_item =
        (offer.discount_type === "Rate" && !offer.rate) ||
        (offer.discount_type === "Discount Percentage" &&
          offer.discount_percentage == 0)
          ? 1
          : 0;
      new_item.posa_row_id = this.makeid(20);
      new_item.price_list_rate =
        (offer.discount_type === "Rate" && !offer.rate) ||
        (offer.discount_type === "Discount Percentage" &&
          offer.discount_percentage == 0)
          ? 0
          : item.rate;
      if (
        (!this.pos_profile.posa_auto_set_batch && new_item.has_batch_no) ||
        new_item.has_serial_no
      ) {
        this.expanded.push(new_item);
      }
      this.update_item_detail(new_item);
      return new_item;
    },

    ApplyOnPrice(offer) {
      this.items.forEach((item) => {
        if (offer.items.includes(item.posa_row_id)) {
          const item_offers = JSON.parse(item.posa_offers);
          if (!item_offers.includes(offer.row_id)) {
            if (offer.discount_type === "Rate") {
              item.rate = offer.rate;
            } else if (offer.discount_type === "Discount Percentage") {
              item.discount_percentage += offer.discount_percentage;
            } else if (offer.discount_type === "Discount Amount") {
              item.discount_amount += offer.discount_amount;
            }
            item.posa_offer_applied = 1;
            this.calc_item_price(item);
          }
        }
      });
    },

    RemoveOnPrice(offer) {
      this.items.forEach((item) => {
        const item_offers = JSON.parse(item.posa_offers);
        if (item_offers.includes(offer.row_id)) {
          const originalOffer = this.posOffers.find(
            (el) => el.name == offer.offer_name
          );
          if (originalOffer) {
            if (originalOffer.discount_type === "Rate") {
              item.rate = item.price_list_rate;
            } else if (originalOffer.discount_type === "Discount Percentage") {
              item.discount_percentage -= offer.discount_percentage;
              if (!item.discount_percentage) {
                item.discount_percentage = 0;
                item.discount_amount = 0;
                item.rate = item.price_list_rate;
              }
            } else if (originalOffer.discount_type === "Discount Amount") {
              item.discount_amount -= offer.discount_amount;
            }
            this.calc_item_price(item);
          }
        }
      });
    },

//    ApplyOnTotal(offer) {
//      if (!offer.name) {
//        offer = this.posOffers.find((el) => el.name == offer.offer_name);
//      }
//      if (
//        (!this.discount_percentage_offer_name ||
//          this.discount_percentage_offer_name == offer.name) &&
//        offer.discount_percentage > 0 &&
//        offer.discount_percentage <= 100
//      ) {
//        this.discount_amount = this.flt(
//          (flt(this.Total) * flt(offer.discount_percentage)) / 100,
//          this.currency_precision
//        );
//        this.discount_percentage_offer_name = offer.name;
//      }
//    },
    ApplyOnTotal(offer) {
      if (!offer.name) {
        offer = this.posOffers.find((el) => el.name == offer.offer_name);
      }
      if (
        offer.discount_type === "Discount Percentage" &&
        (!this.discount_percentage_offer_name ||
          this.discount_percentage_offer_name == offer.name) &&
        offer.discount_percentage > 0 &&
        offer.discount_percentage <= 100
      ) {
        this.discount_amount = this.flt(
          (flt(this.Total) * flt(offer.discount_percentage)) / 100,
          this.currency_precision
        );
        this.discount_percentage_offer_name = offer.name;
      } else if (
        offer.discount_type === "Discount Amount" &&
        (!this.discount_percentage_offer_name ||
          this.discount_percentage_offer_name == offer.name) &&
        offer.discount_amount > 0
      ) {
        this.discount_amount = this.flt(
          flt(offer.discount_amount),
          this.currency_precision
        );
        this.discount_percentage_offer_name = offer.name;
      }
    },

    RemoveOnTotal(offer) {
      if (
        this.discount_percentage_offer_name &&
        this.discount_percentage_offer_name == offer.offer_name
      ) {
        this.discount_amount = 0;
        this.discount_percentage_offer_name = null;
      }
    },

    addOfferToItems(offer) {
      const offer_items = JSON.parse(offer.items);
      offer_items.forEach((el) => {
        this.items.forEach((exist_item) => {
          if (exist_item.posa_row_id == el) {
            const item_offers = JSON.parse(exist_item.posa_offers);
            if (!item_offers.includes(offer.row_id)) {
              item_offers.push(offer.row_id);
              if (offer.offer === "Item Price") {
                exist_item.posa_offer_applied = 1;
              }
            }
            exist_item.posa_offers = JSON.stringify(item_offers);
          }
        });
      });
    },

    deleteOfferFromItems(offer) {
      const offer_items = JSON.parse(offer.items);
      offer_items.forEach((el) => {
        this.items.forEach((exist_item) => {
          if (exist_item.posa_row_id == el) {
            const item_offers = JSON.parse(exist_item.posa_offers);
            const updated_item_offers = item_offers.filter(
              (row_id) => row_id != offer.row_id
            );
            if (offer.offer === "Item Price") {
              exist_item.posa_offer_applied = 0;
            }
            exist_item.posa_offers = JSON.stringify(updated_item_offers);
          }
        });
      });
    },

    validate_due_date(item) {
      const today = frappe.datetime.now_date();
      const parse_today = Date.parse(today);
      const new_date = Date.parse(item.posa_delivery_date);
      if (new_date < parse_today) {
        setTimeout(() => {
          item.posa_delivery_date = today;
        }, 0);
      }
    },
    load_print_page(invoice_name) {
      const print_format =
        this.pos_profile.print_format_for_online ||
        this.pos_profile.print_format;
      const letter_head = this.pos_profile.letter_head || 0;
      const url =
        frappe.urllib.get_base_url() +
        "/printview?doctype=Sales%20Invoice&name=" +
        invoice_name +
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

    print_draft_invoice() {
      if (!this.pos_profile.posa_allow_print_draft_invoices) {
        evntBus.$emit("show_mesage", {
          text: __(`You are not allowed to print draft invoices`),
          color: "error",
        });
        return;
      }
      let invoice_name = this.invoice_doc.name;
      frappe.run_serially([
        () => {
          const invoice_doc = this.new_invoice();
          invoice_name = invoice_doc.name ? invoice_doc.name : invoice_name;
        },
        () => {
          this.load_print_page(invoice_name);
        },
      ]);
    },
    set_delivery_charges() {
      const vm = this;
      if (
        !this.pos_profile ||
        !this.customer ||
        !this.pos_profile.posa_use_delivery_charges
      ) {
        this.delivery_charges = [];
        this.delivery_charges_rate = 0;
        this.selcted_delivery_charges = {};
        return;
      }
      this.delivery_charges_rate = 0;
      this.selcted_delivery_charges = {};
      if (offlinePos.useOffline()) {
        const boot = offlinePos.catalog.getMeta("bootstrap") || {};
        this.delivery_charges = boot.delivery_charges || [];
        return;
      }
      frappe.call({
        method:
          "posawesome.posawesome.api.posapp.get_applicable_delivery_charges",
        args: {
          company: this.pos_profile.company,
          pos_profile: this.pos_profile.name,
          customer: this.customer,
        },
        async: true,
        callback: function (r) {
          if (r.message) {
            vm.delivery_charges = r.message;
          }
        },
      });
    },
    deliveryChargesFilter(item, queryText, itemText) {
      const textOne = item.name.toLowerCase();
      const searchText = queryText.toLowerCase();
      return textOne.indexOf(searchText) > -1;
    },
    update_delivery_charges() {
      if (this.selcted_delivery_charges) {
        this.delivery_charges_rate = this.selcted_delivery_charges.rate;
      } else {
        this.delivery_charges_rate = 0;
      }
    },
  },

  mounted() {
    this.tableRefresh = setInterval(() => {
        this.loadServiceTables();
    },30000);

    this.draftCountInterval = setInterval(() => {
      if (this.pos_opening_shift && this.pos_opening_shift.name) {
        this.get_draft_invoices_count();
      } else {
        console.warn("pos_opening_shift is not yet loaded");
      }
    }, 30000); // Refresh every 30 seconds
    // this.get_draft_invoices_count();
    //  this.draftCountInterval = setInterval(() => {
    //   this.get_draft_invoices_count();
    // }, 30000); // Refresh every 30 seconds
    evntBus.$on("open_rfid_popup", this.showRFIDPopups);
    this.$nextTick(() => {
      if (this.$refs.cancelBtn) {
        this.$refs.cancelBtn.focus();
      }
    });
    evntBus.$on("register_pos_profile", (data) => {
      this.pos_profile = data.pos_profile;
      this.customer = data.pos_profile.customer;
      this.pos_opening_shift = data.pos_opening_shift;
      this.stock_settings = data.stock_settings;
      this.float_precision =
        frappe.defaults.get_default("float_precision") || 2;
      this.currency_precision =
        frappe.defaults.get_default("currency_precision") || 2;
      this.invoiceType = this.pos_profile.posa_default_sales_order
        ? "Order"
        : "Invoice";
      this.loadOrderTypes();
      this.loadServiceTables();
    });
    evntBus.$on("add_item", (item) => {
      this.add_item(item);
    });
    evntBus.$on("update_customer", (customer) => {
      this.customer = customer;
    });
    evntBus.$on("fetch_customer_details", () => {
      this.fetch_customer_details();
    });
    evntBus.$on("new_invoice", () => {
      this.invoice_doc = "";
      this.cancel_invoice();
    });
    evntBus.$on("load_invoice", (data) => {
      this.new_invoice(data);
      evntBus.$emit("set_pos_coupons", data.posa_coupons);
    });
    evntBus.$on("load_order", (data) => {
      this.new_order(data);
      // evntBus.$emit("set_pos_coupons", data.posa_coupons);
    });
    evntBus.$on("set_offers", (data) => {
      this.posOffers = data;
    });
    evntBus.$on("update_invoice_offers", (data) => {
      this.updateInvoiceOffers(data);
    });
    evntBus.$on("update_invoice_coupons", (data) => {
      this.posa_coupons = data;
      this.handelOffers();
    });
    evntBus.$on("set_all_items", (data) => {
      this.allItems = data;
      this.items.forEach((item) => {
        this.update_item_detail(item);
      });
    });
evntBus.$on("load_return_invoice", (data) => {
  // ---- Return WITHOUT invoice ----
  if (!data.return_doc) {
    const doc = data.invoice_doc;
    doc.customer = doc.customer || this.customer || this.pos_profile.customer;
    this.new_invoice(doc);
    this.return_doc = "";
    this.discount_amount = 0;
    this.additional_discount_percentage = 0;
    // customer can be changed since there is no original invoice
    evntBus.$emit("set_customer_readonly", false);
    return;
  }

  // ---- Return AGAINST an invoice (existing behaviour) ----
  this.new_invoice(data.invoice_doc);
  this.discount_amount =
    data.return_doc.discount_amount > 0
      ? -Math.abs(data.return_doc.discount_amount)
      : data.return_doc.discount_amount;
  this.additional_discount_percentage =
    data.return_doc.additional_discount_percentage > 0
      ? -Math.abs(data.return_doc.additional_discount_percentage)
      : data.return_doc.additional_discount_percentage;
  this.return_doc = data.return_doc;
  this.invoice_doc.return_against = data.return_doc.name;
});
    evntBus.$on("load_return_invoices", (data) => {
      this.new_invoice(data.invoice_doc);
      this.discount_amount = -data.return_doc.discount_amount;
      this.additional_discount_percentage =
        -data.return_doc.additional_discount_percentage;
      // this.return_doc = data.return_doc;
      if (data.return_doc) {
        console.log("Return against existing invoice:", data.return_doc.name);
        // Ensure negative discount amounts
        this.discount_amount = data.return_doc.discount_amount > 0 ? 
          -Math.abs(data.return_doc.discount_amount) : 
          data.return_doc.discount_amount;
        this.additional_discount_percentage = data.return_doc.additional_discount_percentage > 0 ?
          -Math.abs(data.return_doc.additional_discount_percentage) :
          data.return_doc.additional_discount_percentage;
        this.return_doc = data.return_doc;
        // Set return_against reference
        this.invoice_doc.return_against = data.return_doc.name;
      } else {
        console.log("Return without invoice reference");
        // For return without invoice, reset discount values
        this.discount_amount = 0;
        this.additional_discount_percentage = 0;
      }

    });
    evntBus.$on("set_new_line", (data) => {
      this.new_line = data;
    });
  },
  beforeUnmount() {
if (this.displayChannel) {
  this.displayChannel.close();
}
    if (this.tableRefresh) {
      clearInterval(this.tableRefresh);
    }

    if (this.draftCountInterval) {
      clearInterval(this.draftCountInterval);
    }
    evntBus.$off("register_pos_profile");
    evntBus.$off("add_item");
    evntBus.$off("update_customer");
    evntBus.$off("fetch_customer_details");
    evntBus.$off("new_invoice");
    evntBus.$off("set_offers");
    evntBus.$off("update_invoice_offers");
    evntBus.$off("update_invoice_coupons");
    evntBus.$off("set_all_items");
  },
  created() {
this.initCustomerDisplay();
    evntBus.$on('generateFBR', (invoiceDoc) => {
      console.log("Received generateFBR event with invoiceDoc:", invoiceDoc);
      this.generateFBR(invoiceDoc);
    });
    //evntBus.$on('generateFBR', this.generateFBR);
    //EventBus.$on('generateFBR', this.generateFBR);
    //evntBus.$on('generateFBR', this.generateFBR);
    evntBus.$on('discountBlurTriggered', this.discount_blur);
    evntBus.$on('expandedHandlerTriggered', this.expandedHandler);
    document.addEventListener("keydown", this.shortCancelDialog.bind(this));
    document.addEventListener("keydown", this.shortHoldInvoice.bind(this));
    document.addEventListener("keydown", this.shortRetriveInvoice.bind(this));
    document.addEventListener("keydown", this.shortReturnInvoice.bind(this));
    document.addEventListener("keydown", this.shortEditQty);
    document.addEventListener("keydown", this.shortPlussQty);
    document.addEventListener("keydown", this.shortMinusQty);
    document.addEventListener("keydown", this.shortOpenPayment.bind(this));
    document.addEventListener("keydown", this.shortDeleteFirstItem.bind(this));
    document.addEventListener("keydown", this.shortOpenFirstItem.bind(this));
    document.addEventListener("keydown", this.shortSelectDiscount.bind(this));
  },
  unmounted() {
    document.removeEventListener("keydown", this.shortCancelDialog);
    document.removeEventListener("keydown", this.shortHoldInvoice);
    document.removeEventListener("keydown", this.shortRetriveInvoice);
    document.removeEventListener("keydown", this.shortReturnInvoice);
    document.removeEventListener("keydown", this.shortEditQty);
    document.removeEventListener("keydown", this.shortPlussQty);
    document.removeEventListener("keydown", this.shortMinusQty);
    document.removeEventListener("keydown", this.shortOpenPayment);
    document.removeEventListener("keydown", this.shortDeleteFirstItem);
    document.removeEventListener("keydown", this.shortOpenFirstItem);
    document.removeEventListener("keydown", this.shortSelectDiscount);
  },
  watch: {
customerDisplayPayload: {
  deep: true,
  handler() {
    this.broadcastDisplay();
  },
},
  pos_profile: {
    handler(profile) {
      if (!profile?.pos_service_zone?.length) return;

      this.service_zone = profile.pos_service_zone.map(row => ({
        name: row.service_zone,
        value: row.service_zone
      }));

      // Don't override existing selection (draft invoice, etc.)
      if (this.selcted_service_zone) return;

      // Select POS Profile default service zone
      if (
        profile.default_service_zone &&
        this.service_zone.some(
          z => z.value === profile.default_service_zone
        )
      ) {
        this.selcted_service_zone = profile.default_service_zone;
        this.selectedZone = profile.default_service_zone;
      }
    },
    immediate: true,
    deep: true
  },

    pos_opening_shift(val) {
        if (val && val.name) {
            console.log("POS Opening Shift loaded:", val.name);
            this.get_draft_invoices_count();
        }
    },

    selectedZone() {
      this.selectedTable = null;
    },
    selcted_service_zone(val) {
      if (this.invoice_doc) {
        this.invoice_doc.posa_service_zone = val;
      }
    },
    selcted_service_table(val) {
      if (this.invoice_doc) {
        this.invoice_doc.posa_service_table = val;
      }
    },
    selcted_order_type(val) {
      if (!this.invoice_doc) return;
      this.invoice_doc.posa_order_type = val;
    },
    invoice_doc: {
      handler(doc) {
        if (!doc) return;
        this.selcted_order_type = doc.posa_order_type;
        this.selcted_service_zone = doc.posa_service_zone;
        this.selcted_service_table = doc.posa_service_table;
        this.selectedZone = doc.posa_service_zone;
        this.selectedTable = doc.posa_service_table;
      },
      deep:true
    },

    customer() {
      this.close_payments();
      evntBus.$emit("set_customer", this.customer);
      this.fetch_customer_details();
      this.set_delivery_charges();
      this.fetchCustomerOutstanding();
    },
    customer_info() {
      evntBus.$emit("set_customer_info_to_edit", this.customer_info);
    },
    expanded: {
      // Vue 3 only reports array mutations (push/splice) to watchers with deep
      deep: 1,
      handler(data_value) {
        if (data_value.length > 0) {
          this.update_item_detail(data_value[0]);
        }
      },
    },
    discount_percentage_offer_name() {
      evntBus.$emit("update_discount_percentage_offer_name", {
        value: this.discount_percentage_offer_name,
      });
    },
    items: {
      deep: true,
      handler(items) {
        this.handelOffers();
        this.$forceUpdate();
      },
    },
    invoiceType() {
      evntBus.$emit("update_invoice_type", this.invoiceType);
    },
    discount_amount() {
      if (!this.discount_amount || this.discount_amount == 0) {
        this.additional_discount_percentage = 0;
      } else if (this.pos_profile.posa_use_percentage_discount) {
        this.additional_discount_percentage =
          (this.discount_amount / this.Total) * 100;
      } else {
        this.additional_discount_percentage = 0;
      }
    },
  },
};
</script>

<style scoped>
/* Return mode: red border */
.cards.return-mode {
  border: 2px solid #d32f2f !important;
  box-shadow: 0 0 8px rgba(255, 0, 0, 1) !important;
}

.cards.return-mode:hover {
  box-shadow: 0 0 12px rgba(255, 0, 0, 1) !important;
}

/* Dark theme keeps the red border too */
.theme--dark .cards.return-mode {
  border-color: #ef5350 !important;
}
.border_line_bottom {
  border-bottom: 1px solid lightgray;
}
.disable-events {
  pointer-events: none;
}
/* Card Styling */
.cards {
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%) !important;
  border: 1px solid #e0e0e0;
  transition: all 0.3s ease;
}

.cards:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.bg-dark {
  background: linear-gradient(135deg, #1e1e1e 0%, #121212 100%) !important;
  border: 1px solid #333 !important;
}

/* Dialog Styling */
.cancel-dialog-card {
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%) !important;
  border: 1px solid #e0e0e0;
}

.cancel-header {
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  border-bottom: 1px solid #e0e0e0;
  padding: 16px !important;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
}

.header-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #d32f2f 0%, #c62828 100%);
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(211, 47, 47, 0.3);
}

.header-icon {
  color: white !important;
}

.header-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
  line-height: 1.2;
}

.header-divider {
  border-color: #e0e0e0;
}

/* Input Fields */
.input-field {
  border-radius: 8px;
}

.v-text-field--outlined fieldset,
.v-select--outlined fieldset,
.v-autocomplete--outlined fieldset {
  border-color: #e0e0e0;
}

.v-text-field--outlined:hover fieldset,
.v-select--outlined:hover fieldset,
.v-autocomplete--outlined:hover fieldset {
  border-color: #1976d2;
}

.v-text-field--outlined.v-input--is-focused fieldset,
.v-select--outlined.v-input--is-focused fieldset,
.v-autocomplete--outlined.v-input--is-focused fieldset {
  border-color: #1976d2;
}

/* Table Styling */
.white-table {
  background-color: white;
  border: 1px solid #e0e0e0;
}

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

/* Action Buttons */
.dialog-actions-container {
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  border-top: 1px solid #e0e0e0;
  padding: 12px 16px;
  gap: 12px;
}

.action-btn {
  border-radius: 12px;
  text-transform: none;
  font-weight: 600;
  padding: 8px 16px;
  transition: all 0.3s ease;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.pay-btn {
  padding: 12px 24px !important;
}

.pay-btn:hover {
  box-shadow: 0 6px 20px rgba(46, 125, 50, 0.4);
}

.v-btn[color="warning"] {
  background: linear-gradient(135deg, #f57c00 0%, #ef6c00 100%) !important;
}

.v-btn[color="info"] {
  background: linear-gradient(135deg, #0288d1 0%, #0277bd 100%) !important;
}

.v-btn[color="secondary"] {
  background: linear-gradient(135deg, #7b1fa2 0%, #6a1b9a 100%) !important;
}

.v-btn[color="error"] {
  background: linear-gradient(135deg, #d32f2f 0%, #c62828 100%) !important;
}

.v-btn[color="accent"] {
  background: linear-gradient(135deg, #ffca28 0%, #ffb300 100%) !important;
}

.v-btn[color="success"] {
  background: linear-gradient(135deg, #388e3c 0%, #2e7d32 100%) !important;
}

.v-btn[color="primary"] {
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%) !important;
}

.v-btn .v-icon,
.v-btn span {
  /* color: white !important; */
}

.v-btn--disabled .v-icon,
.v-btn--disabled span,
.v-btn.disable-events .v-icon,
.v-btn.disable-events span {
  color: white !important;
}

.v-btn--disabled,
.v-btn.disable-events {
  opacity: 0.6 !important;
}

/* Responsive Design */
@media (max-width: 768px) {
  .dialog-actions-container {
    flex-direction: column;
    gap: 12px;
  }

  .action-btn,
  .pay-btn {
    width: 100%;
  }

  .cancel-header {
    padding: 12px !important;
  }

  .header-icon-wrapper {
    width: 40px;
    height: 40px;
  }

  .header-title {
    font-size: 1.1rem;
  }

  .v-data-table th,
  .v-data-table td {
    padding: 6px !important;
  }

  .input-field {
    margin-bottom: 8px;
  }
}

@media (max-width: 480px) {
  .v-row.no-gutters .v-col {
    flex: 0 0 100%;
    max-width: 100%;
  }

  .action-btn {
    font-size: 0.85rem;
    padding: 6px 12px;
  }

  .pay-btn {
    padding: 10px 20px !important;
  }
}

/* Dark Theme Adjustments */
.theme--dark .cards,
.theme--dark .cancel-dialog-card,
.theme--dark .dialog-actions-container,
.theme--dark .cancel-header {
  background: linear-gradient(135deg, #1e1e1e 0%, #121212 100%) !important;
  border-color: #333 !important;
}

.theme--dark .white-table {
  background-color: #1e1e1e !important;
}

.theme--dark .v-data-table th {
  background: #333 !important;
  color: #e0e0e0 !important;
}

.theme--dark .v-data-table td {
  border-bottom: 1px solid #333 !important;
}

.theme--dark .header-title {
  color: #e0e0e0 !important;
}

.theme--dark .v-text-field--outlined fieldset,
.theme--dark .v-select--outlined fieldset,
.theme--dark .v-autocomplete--outlined fieldset {
  border-color: #555 !important;
}

.theme--dark .v-text-field--outlined:hover fieldset,
.theme--dark .v-select--outlined:hover fieldset,
.theme--dark .v-autocomplete--outlined:hover fieldset {
  border-color: #42a5f5 !important;
}

.theme--dark .v-text-field--outlined.v-input--is-focused fieldset,
.theme--dark .v-select--outlined.v-input--is-focused fieldset,
.theme--dark .v-autocomplete--outlined.v-input--is-focused fieldset {
  border-color: #42a5f5 !important;
}

.theme--dark .v-text-field label,
.theme--dark .v-text-field input,
.theme--dark .v-text-field .v-icon,
.theme--dark .v-select .v-icon,
.theme--dark .v-autocomplete .v-icon {
  color: #e0e0e0 !important;
}

/* Lift the whole Resume column above the neighbouring buttons */
.resume-col {
  position: relative;
  z-index: 5;
}

.notification-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  z-index: 10;
}

/* Scoped styles don't reach Vuetify's inner badge element, so use ::v-deep */
.notification-badge ::v-deep .v-badge__badge {
  font-size: 14px;
  height: 20px;
  min-width: 20px;
  /* padding: 0 4px; */
  z-index: 10;
}
.notification-badge_old {
  position: absolute;
  top: -5px;
  right: -5px;
}

.v-badge__badge_old {
  font-size: 10px;
  height: 18px;
  min-width: 18px;
  padding: 0 4px;
}
/* ... existing styles ... */

/* Tax Selection Dialog Styling */
.tax-selection-card {
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%) !important;
  border: 1px solid #e0e0e0;
}
.tax-header {
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  border-bottom: 1px solid #e0e0e0;
  padding: 16px !important;
}
.tax-btn {
  border-radius: 12px;
  text-transform: none;
  font-weight: 600;
  padding: 8px 16px;
  transition: all 0.3s ease;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}
.tax-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}
.header-subtitle {
  font-size: 0.9rem;
  color: #666;
  margin: 4px 0 0 0;
}

/* Dark Theme Adjustments */
.theme--dark .tax-selection-card,
.theme--dark .tax-header {
  background: linear-gradient(135deg, #1e1e1e 0%, #121212 100%) !important;
  border-color: #333 !important;
}
.theme--dark .header-subtitle {
  color: #ccc !important;
}

.table-card{
  cursor:pointer;
  border-radius:12px;
  transition:.25s;
}

.table-card:hover{
  transform:scale(1.05);
}

.table-selected{
  border:3px solid #1976d2;
}
.qty-number{
  font-size:28px;
  font-weight:bold;
  min-width:70px;
  text-align:center;
}

.v-chip{
  cursor:pointer;
}
.table-disabled {
    opacity: 0.5;
    pointer-events: none;
    cursor: not-allowed;
}
</style>

