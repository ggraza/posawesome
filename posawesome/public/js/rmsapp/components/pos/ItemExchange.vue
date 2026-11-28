<template>
  <v-dialog v-model="dialog" max-width="1280" persistent scrollable>
    <v-card class="exchange-card">
      <!-- header -->
      <v-card-title class="exchange-header d-flex align-center flex-wrap ga-3 pa-4">
        <v-icon color="primary" size="32">mdi-swap-horizontal-bold</v-icon>
        <span class="text-h5 text-primary">{{ __('Item Exchange / Replacement') }}</span>
        <v-spacer></v-spacer>
        <v-btn-toggle
          v-if="!result"
          v-model="exchange_type"
          mandatory
          density="comfortable"
          color="primary"
          variant="outlined"
          divided
          class="type-toggle"
        >
          <v-btn v-if="settings.exchange" value="Exchange">
            <v-icon start>mdi-swap-horizontal</v-icon>{{ __('Exchange') }}
          </v-btn>
          <v-btn v-if="settings.replacement" value="Replacement">
            <v-icon start>mdi-autorenew</v-icon>{{ __('Replacement') }}
          </v-btn>
        </v-btn-toggle>
      </v-card-title>
      <div v-if="!result" class="px-4 pb-2 text-caption text-grey-darken-1">
        {{ exchange_type === 'Replacement'
          ? __('Replacement: the same items are given again (e.g. defective), at the price paid.')
          : __('Exchange: return items and give other items; the difference is paid or refunded.') }}
      </div>
      <v-divider></v-divider>

      <!-- done -->
      <v-card-text v-if="result" class="pa-6">
        <v-alert type="success" variant="tonal" class="mb-4" :title="__('Exchange completed')">
          {{ __('Exchange {0}', [result.exchange]) }}
          <span v-if="result.already_done"> ({{ __('already completed earlier') }})</span>
        </v-alert>
        <v-table density="compact" class="result-table">
          <tbody>
            <tr><td>{{ __('Credit Note (return)') }}</td><td class="text-right font-weight-bold">{{ result.return_invoice }}</td></tr>
            <tr><td>{{ __('New Invoice') }}</td><td class="text-right font-weight-bold">{{ result.new_invoice }}</td></tr>
            <tr><td>{{ __('Returned value') }}</td><td class="text-right">{{ money(result.returned_total) }}</td></tr>
            <tr><td>{{ __('Replacement value') }}</td><td class="text-right">{{ money(result.replacement_total) }}</td></tr>
            <tr v-if="flt(result.additional_payment)"><td>{{ __('Customer paid') }}</td><td class="text-right text-success font-weight-bold">{{ money(result.additional_payment) }}</td></tr>
            <tr v-if="flt(result.refund_amount)"><td>{{ __('Refunded to customer') }}</td><td class="text-right text-deep-purple font-weight-bold">{{ money(result.refund_amount) }}</td></tr>
            <tr v-if="result.approved_by"><td>{{ __('Approved by') }}</td><td class="text-right">{{ result.approved_by }}</td></tr>
          </tbody>
        </v-table>
      </v-card-text>

      <v-card-text v-else class="pa-3">
        <v-row dense>
          <!-- A. original invoice / returned items -->
          <v-col cols="12" md="6">
            <v-card variant="outlined" class="section-card pa-3 h-100">
              <div class="section-title"><span class="section-badge bg-error">A</span>{{ __('Returned Items') }}</div>
              <template v-if="!invoice">
                <v-text-field
                  ref="invoice_search_field"
                  v-model="invoice_query"
                  density="compact"
                  variant="outlined"
                  hide-details
                  clearable
                  prepend-inner-icon="mdi-receipt-text-outline"
                  :label="__('Original invoice no., customer or mobile')"
                  @keydown.enter.prevent="search_invoices"
                >
                  <template #append>
                    <v-btn color="primary" variant="flat" :loading="loading.invoices" @click="search_invoices">{{ __('Search') }}</v-btn>
                  </template>
                </v-text-field>
                <v-table v-if="invoices.length" density="compact" class="mt-2 pick-table" fixed-header height="360">
                  <thead>
                    <tr><th>{{ __('Invoice') }}</th><th>{{ __('Customer') }}</th><th>{{ __('Date') }}</th><th class="text-right">{{ __('Total') }}</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="inv in invoices" :key="inv.name" class="pick-row" @click="load_invoice(inv.name)">
                      <td class="font-weight-medium">{{ inv.name }}</td>
                      <td>{{ inv.customer_name || inv.customer }}</td>
                      <td>{{ inv.posting_date }}</td>
                      <td class="text-right">{{ money(inv.rounded_total || inv.grand_total, inv.currency) }}</td>
                    </tr>
                  </tbody>
                </v-table>
                <div v-else-if="searched" class="text-caption text-grey text-center mt-4">{{ __('No invoice found') }}</div>
              </template>

              <template v-else>
                <div class="d-flex align-center flex-wrap ga-2 mb-2">
                  <v-chip color="primary" variant="tonal" label>{{ invoice.name }}</v-chip>
                  <span class="text-body-2">{{ invoice.customer_name || invoice.customer }} · {{ invoice.posting_date }}</span>
                  <v-spacer></v-spacer>
                  <v-btn size="small" variant="text" color="primary" prepend-icon="mdi-arrow-left" @click="change_invoice">{{ __('Change') }}</v-btn>
                </div>
                <v-table density="compact" class="return-table">
                  <thead>
                    <tr>
                      <th>{{ __('Item') }}</th>
                      <th>{{ __('UOM') }}</th>
                      <th class="text-right">{{ __('Sold') }}</th>
                      <th class="text-right">{{ __('Returned') }}</th>
                      <th class="text-right">{{ __('Rate') }}</th>
                      <th class="text-right">{{ __('Amount') }}</th>
                      <th class="qty-col">{{ __('Return Qty') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="r in invoice.items" :key="r.row" :class="{ 'row-done': r.returnable_qty <= 0, 'row-picked': flt(r.return_qty) > 0 }">
                      <td>
                        <div class="font-weight-medium">{{ r.item_name }}</div>
                        <div class="text-caption text-grey">{{ r.item_code }}</div>
                      </td>
                      <td>{{ r.uom }}</td>
                      <td class="text-right">{{ qty(r.qty) }}</td>
                      <td class="text-right">
                        <span :class="r.previously_returned > 0 ? 'text-warning font-weight-bold' : 'text-grey'">{{ qty(r.previously_returned) }}</span>
                      </td>
                      <td class="text-right">{{ money(r.rate) }}</td>
                      <td class="text-right">{{ money(r.amount) }}</td>
                      <td class="qty-col">
                        <span v-if="r.returnable_qty <= 0" class="text-caption text-grey">{{ __('All returned') }}</span>
                        <template v-else>
                          <v-select
                            v-if="r.has_serial_no && serials_of(r).length"
                            v-model="r.return_serials"
                            :items="serials_of(r)"
                            multiple
                            chips
                            closable-chips
                            density="compact"
                            variant="outlined"
                            hide-details
                            :label="__('Serial Nos')"
                            @update:model-value="r.return_qty = (r.return_serials || []).length; changed()"
                          ></v-select>
                          <v-text-field
                            v-else
                            v-model="r.return_qty"
                            type="number"
                            min="0"
                            :max="r.returnable_qty"
                            density="compact"
                            variant="outlined"
                            hide-details="auto"
                            :rules="[(v) => return_qty_ok(r, v)]"
                            :hint="__('max {0}', [qty(r.returnable_qty)])"
                            persistent-hint
                            @update:model-value="changed()"
                          ></v-text-field>
                        </template>
                      </td>
                    </tr>
                  </tbody>
                </v-table>
                <div class="d-flex mt-2">
                  <v-btn size="small" variant="text" @click="return_all">{{ __('Return all') }}</v-btn>
                  <v-btn size="small" variant="text" @click="return_none">{{ __('Clear') }}</v-btn>
                  <v-spacer></v-spacer>
                  <span class="text-body-2">{{ __('Selected value') }}: <b>{{ money(returned_estimate) }}</b></span>
                </div>
              </template>
            </v-card>
          </v-col>

          <!-- B. replacement / new items -->
          <v-col cols="12" md="6">
            <v-card variant="outlined" class="section-card pa-3 h-100">
              <div class="section-title"><span class="section-badge bg-success">B</span>{{ exchange_type === 'Replacement' ? __('Replacement Items') : __('New Items') }}</div>

              <template v-if="exchange_type === 'Replacement'">
                <div v-if="!picked_rows.length" class="text-caption text-grey text-center mt-6">
                  {{ __('Choose the items to return: the same items and quantities are given again.') }}
                </div>
                <v-table v-else density="compact">
                  <thead>
                    <tr><th>{{ __('Item') }}</th><th>{{ __('UOM') }}</th><th class="text-right">{{ __('Qty') }}</th><th class="text-right">{{ __('Rate') }}</th><th>{{ __('Batch / Serial') }}</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="r in picked_rows" :key="'rep-' + r.row">
                      <td><div class="font-weight-medium">{{ r.item_name }}</div><div class="text-caption text-grey">{{ r.item_code }}</div></td>
                      <td>{{ r.uom }}</td>
                      <td class="text-right">{{ qty(r.return_qty) }}</td>
                      <td class="text-right">{{ money(r.rate) }}</td>
                      <td style="min-width: 160px">
                        <v-select
                          v-if="r.has_batch_no"
                          v-model="r.new_batch_no"
                          :items="(stock_info[r.item_code] || {}).batches || []"
                          item-title="label"
                          item-value="batch_no"
                          density="compact"
                          variant="outlined"
                          hide-details
                          :label="__('Batch')"
                          @update:model-value="changed()"
                        ></v-select>
                        <v-select
                          v-if="r.has_serial_no"
                          v-model="r.new_serials"
                          :items="(stock_info[r.item_code] || {}).serial_nos || []"
                          multiple
                          chips
                          density="compact"
                          variant="outlined"
                          hide-details
                          :label="__('Serial Nos')"
                          @update:model-value="changed()"
                        ></v-select>
                        <span v-if="!r.has_batch_no && !r.has_serial_no" class="text-grey">-</span>
                      </td>
                    </tr>
                  </tbody>
                </v-table>
              </template>

              <template v-else>
                <v-text-field
                  ref="item_search_field"
                  v-model="item_query"
                  density="compact"
                  variant="outlined"
                  hide-details
                  clearable
                  prepend-inner-icon="mdi-barcode-scan"
                  :label="__('Scan barcode or search item')"
                  :loading="loading.items"
                  @keydown.enter.prevent="search_items"
                ></v-text-field>
                <v-list v-if="item_results.length" density="compact" class="result-list mt-1" max-height="220">
                  <v-list-item
                    v-for="it in item_results"
                    :key="it.item_code"
                    @click="add_new_item(it)"
                    :title="it.item_name"
                    :subtitle="it.item_code + ' · ' + money(it.uoms[0].rate) + ' · ' + __('Stock') + ' ' + qty(it.actual_qty)"
                  ></v-list-item>
                </v-list>
                <v-table v-if="new_items.length" density="compact" class="mt-2 new-table">
                  <thead>
                    <tr>
                      <th>{{ __('Item') }}</th>
                      <th>{{ __('UOM') }}</th>
                      <th class="qty-col">{{ __('Qty') }}</th>
                      <th class="text-right">{{ __('Price') }}</th>
                      <th class="disc-col">{{ __('Disc %') }}</th>
                      <th class="text-right">{{ __('Amount') }}</th>
                      <th class="text-right">{{ __('Stock') }}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    <template v-for="(n, i) in new_items" :key="n.key">
                      <tr>
                        <td><div class="font-weight-medium">{{ n.item_name }}</div><div class="text-caption text-grey">{{ n.item_code }}</div></td>
                        <td style="min-width: 90px">
                          <v-select
                            v-model="n.uom"
                            :items="n.uoms"
                            item-title="uom"
                            item-value="uom"
                            density="compact"
                            variant="plain"
                            hide-details
                            @update:model-value="changed()"
                          ></v-select>
                        </td>
                        <td class="qty-col">
                          <v-text-field
                            v-model="n.qty"
                            type="number"
                            min="0"
                            density="compact"
                            variant="outlined"
                            hide-details
                            @update:model-value="changed()"
                          ></v-text-field>
                        </td>
                        <td class="text-right">{{ money(uom_rate(n)) }}</td>
                        <td class="disc-col">
                          <v-text-field
                            v-if="n.max_discount > 0"
                            v-model="n.discount_percentage"
                            type="number"
                            min="0"
                            :max="n.max_discount"
                            density="compact"
                            variant="outlined"
                            hide-details="auto"
                            :rules="[(v) => flt(v) <= n.max_discount || __('max {0}%', [n.max_discount])]"
                            @update:model-value="changed()"
                          ></v-text-field>
                          <span v-else class="text-grey">-</span>
                        </td>
                        <td class="text-right font-weight-medium">{{ money(new_row_amount(n)) }}</td>
                        <td class="text-right" :class="stock_after(n) < 0 ? 'text-error font-weight-bold' : ''">{{ qty(n.actual_qty) }}</td>
                        <td><v-btn icon="mdi-delete-outline" size="x-small" variant="text" color="error" @click="remove_new_item(i)"></v-btn></td>
                      </tr>
                      <tr v-if="n.has_batch_no || n.has_serial_no" class="sub-row">
                        <td colspan="8">
                          <div class="d-flex ga-2">
                            <v-select
                              v-if="n.has_batch_no"
                              v-model="n.batch_no"
                              :items="(stock_info[n.item_code] || {}).batches || []"
                              item-title="label"
                              item-value="batch_no"
                              density="compact"
                              variant="outlined"
                              hide-details
                              :label="__('Batch')"
                              style="max-width: 260px"
                              @update:model-value="changed()"
                            ></v-select>
                            <v-select
                              v-if="n.has_serial_no"
                              v-model="n.serials"
                              :items="(stock_info[n.item_code] || {}).serial_nos || []"
                              multiple
                              chips
                              closable-chips
                              density="compact"
                              variant="outlined"
                              hide-details
                              :label="__('Serial Nos ({0})', [qty(n.qty)])"
                              @update:model-value="n.qty = (n.serials || []).length || n.qty; changed()"
                            ></v-select>
                          </div>
                        </td>
                      </tr>
                    </template>
                  </tbody>
                </v-table>
                <div v-else-if="!item_results.length" class="text-caption text-grey text-center mt-6">
                  {{ __('Scan or search the items the customer takes instead.') }}
                </div>
              </template>
            </v-card>
          </v-col>
        </v-row>

        <!-- settlement -->
        <v-card variant="outlined" class="settle-card mt-3 pa-3">
          <div class="section-title"><v-icon class="mr-1" color="primary">mdi-scale-balance</v-icon>{{ __('Settlement') }}
            <v-progress-circular v-if="loading.preview" indeterminate size="16" width="2" class="ml-2"></v-progress-circular>
          </div>
          <v-alert v-if="preview_error" type="error" variant="tonal" density="compact" class="mb-2">{{ preview_error }}</v-alert>
          <v-row dense align="stretch">
            <v-col cols="12" sm="4">
              <div class="sum-box sum-return">
                <div class="sum-label">{{ __('Returned items') }}</div>
                <div class="sum-value">{{ preview ? money(preview.returned_total) : '-' }}</div>
              </div>
            </v-col>
            <v-col cols="12" sm="4">
              <div class="sum-box sum-new">
                <div class="sum-label">{{ __('Replacement items') }}</div>
                <div class="sum-value">{{ preview ? money(preview.replacement_total) : '-' }}</div>
              </div>
            </v-col>
            <v-col cols="12" sm="4">
              <div class="sum-box" :class="settle_class">
                <div class="sum-label">{{ settle_label }}</div>
                <div class="sum-value">{{ preview ? money(Math.abs(preview.difference)) : '-' }}</div>
              </div>
            </v-col>
          </v-row>

          <!-- B: customer pays the difference -->
          <div v-if="preview && preview.settlement === 'Additional Payment'" class="mt-3">
            <div class="text-subtitle-2 mb-1">{{ __('Collect {0} from the customer', [money(preview.difference)]) }}</div>
            <v-row dense>
              <v-col v-for="p in payments" :key="p.mode_of_payment" cols="6" sm="3">
                <v-text-field
                  v-model="p.amount"
                  type="number"
                  min="0"
                  density="compact"
                  variant="outlined"
                  hide-details
                  :label="p.mode_of_payment"
                  :prefix="currencySymbol(currency)"
                  @focus="fill_payment(p)"
                ></v-text-field>
              </v-col>
            </v-row>
            <div class="d-flex mt-1 text-body-2">
              <span>{{ __('Paid') }}: <b>{{ money(paid_total) }}</b></span>
              <span v-if="change_due > 0" class="ml-4 text-success">{{ __('Change') }}: <b>{{ money(change_due) }}</b></span>
              <span v-if="paid_short > 0" class="ml-4 text-error">{{ __('Still to pay') }}: <b>{{ money(paid_short) }}</b></span>
            </div>
          </div>
          <!-- C: refund -->
          <div v-if="preview && preview.settlement === 'Refund'" class="mt-3 d-flex align-center ga-3 flex-wrap">
            <span class="text-subtitle-2">{{ __('Refund {0} to the customer from', [money(-preview.difference)]) }}</span>
            <v-select
              v-model="refund_mode"
              :items="profile_modes"
              density="compact"
              variant="outlined"
              hide-details
              style="max-width: 240px"
              @update:model-value="changed()"
            ></v-select>
          </div>
          <!-- A: equal -->
          <div v-if="preview && preview.settlement === 'Equal Value'" class="mt-2 text-body-2 text-success">
            <v-icon size="small" color="success">mdi-check-circle</v-icon> {{ __('Equal value: nothing to pay, nothing to refund.') }}
          </div>

          <!-- manager approval -->
          <div v-if="needs_approval" class="approval-box mt-3 pa-3">
            <div class="text-subtitle-2 mb-2"><v-icon size="small" color="warning">mdi-shield-account</v-icon> {{ __('Manager approval required ({0})', [settings.approver_role]) }}</div>
            <v-row dense>
              <v-col cols="12" sm="6"><v-text-field v-model="approver" density="compact" variant="outlined" hide-details autocomplete="off" :label="__('Manager user ID / email')"></v-text-field></v-col>
              <v-col cols="12" sm="6"><v-text-field v-model="approver_password" type="password" density="compact" variant="outlined" hide-details autocomplete="new-password" :label="__('Manager password')"></v-text-field></v-col>
            </v-row>
          </div>
        </v-card>
      </v-card-text>

      <v-divider></v-divider>
      <v-card-actions class="pa-3">
        <template v-if="result">
          <v-btn color="primary" variant="flat" prepend-icon="mdi-printer" @click="print(result.new_invoice)">{{ __('Print New Invoice') }}</v-btn>
          <v-btn color="deep-purple" variant="tonal" prepend-icon="mdi-printer-outline" @click="print(result.return_invoice)">{{ __('Print Credit Note') }}</v-btn>
          <v-spacer></v-spacer>
          <v-btn color="success" variant="flat" @click="close">{{ __('Done') }}</v-btn>
        </template>
        <template v-else>
          <v-btn color="error" variant="text" @click="close">{{ __('Cancel') }}</v-btn>
          <v-spacer></v-spacer>
          <span v-if="submit_block" class="text-caption text-grey mr-3">{{ submit_block }}</span>
          <v-btn
            color="success"
            variant="flat"
            size="large"
            prepend-icon="mdi-check-decagram"
            :disabled="!!submit_block"
            :loading="loading.submit"
            @click="submit"
          >{{ exchange_type === 'Replacement' ? __('Complete Replacement') : __('Complete Exchange') }}</v-btn>
        </template>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { evntBus } from '../../bus';
import format from '../../format';
import offlinePos from '../../../offline';

const API = 'posawesome.posawesome.api.exchange';

export default {
  name: 'ItemExchange',
  mixins: [format],
  data: () => ({
    dialog: false,
    pos_profile: null,
    pos_opening_shift: null,
    exchange_type: 'Exchange',
    client_ref: null,
    invoice_query: '',
    invoices: [],
    searched: false,
    invoice: null,
    item_query: '',
    item_results: [],
    new_items: [],
    stock_info: {},
    preview: null,
    preview_error: '',
    payments: [],
    refund_mode: null,
    approver: '',
    approver_password: '',
    result: null,
    loading: { invoices: false, items: false, preview: false, submit: false },
    preview_timer: null,
    preview_seq: 0,
    key_seq: 0,
  }),
  computed: {
    settings() {
      const p = this.pos_profile || {};
      return {
        exchange: !!Number(p.posa_enable_item_exchange),
        replacement: !!Number(p.posa_enable_item_replacement),
        additional_payment: !!Number(p.posa_allow_exchange_additional_payment),
        refund: !!Number(p.posa_allow_exchange_refund),
        approval: !!Number(p.posa_exchange_require_approval),
        approver_role: p.posa_exchange_approver_role || 'Sales Manager',
      };
    },
    currency() {
      return (this.invoice && this.invoice.currency) || (this.pos_profile && this.pos_profile.currency);
    },
    profile_modes() {
      return ((this.pos_profile && this.pos_profile.payments) || []).map((p) => p.mode_of_payment);
    },
    default_mode() {
      const rows = (this.pos_profile && this.pos_profile.payments) || [];
      const d = rows.find((p) => Number(p.default)) || rows[0];
      return d ? d.mode_of_payment : null;
    },
    picked_rows() {
      return this.invoice ? this.invoice.items.filter((r) => this.flt(r.return_qty) > 0) : [];
    },
    returned_estimate() {
      return this.picked_rows.reduce((s, r) => s + (this.flt(r.amount) / (this.flt(r.qty) || 1)) * this.flt(r.return_qty), 0);
    },
    paid_total() {
      return this.payments.reduce((s, p) => s + this.flt(p.amount), 0);
    },
    change_due() {
      if (!this.preview || this.preview.settlement !== 'Additional Payment') return 0;
      return Math.max(0, this.flt(this.paid_total - this.preview.difference, 2));
    },
    paid_short() {
      if (!this.preview || this.preview.settlement !== 'Additional Payment') return 0;
      return Math.max(0, this.flt(this.preview.difference - this.paid_total, 2));
    },
    needs_approval() {
      if (!this.settings.approval) return false;
      const roles = (window.frappe && frappe.user_roles) || [];
      return !roles.includes(this.settings.approver_role);
    },
    settle_label() {
      if (!this.preview) return __('Difference');
      if (this.preview.settlement === 'Additional Payment') return __('Customer pays');
      if (this.preview.settlement === 'Refund') return __('Refund to customer');
      return __('Equal value');
    },
    settle_class() {
      if (!this.preview) return 'sum-diff';
      return { 'Additional Payment': 'sum-pay', Refund: 'sum-refund', 'Equal Value': 'sum-equal' }[this.preview.settlement];
    },
    submit_block() {
      if (!this.invoice) return __('Choose the original invoice');
      if (!this.picked_rows.length) return __('Enter a return quantity');
      if (this.invoice.items.some((r) => this.return_qty_ok(r, r.return_qty) !== true)) return __('Check the return quantities');
      if (this.exchange_type === 'Exchange') {
        if (!this.new_items.some((n) => this.flt(n.qty) > 0)) return __('Add the new items');
        if (this.new_items.some((n) => n.max_discount >= 0 && this.flt(n.discount_percentage) > n.max_discount)) return __('Discount too high');
        if (this.new_items.some((n) => n.has_serial_no && (n.serials || []).length !== this.flt(n.qty))) return __('Choose the serial numbers');
      }
      if (this.loading.preview || !this.preview) return this.preview_error ? __('Fix the problem above') : __('Calculating...');
      if (this.preview_error) return __('Fix the problem above');
      if (this.paid_short > 0) return __('Payment not complete');
      if (this.needs_approval && !(this.approver && this.approver_password)) return __('Manager approval required');
      return '';
    },
  },
  methods: {
    money(v, cur) {
      return this.currencySymbol(cur || this.currency) + ' ' + this.formtCurrency(v);
    },
    qty(v) {
      const n = this.flt(v, 3);
      return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, '');
    },
    open(data) {
      if (offlinePos.useOffline()) {
        evntBus.$emit('show_mesage', { text: __('Item exchange needs the server. Try again when online.'), color: 'warning' });
        return;
      }
      if (data && data.pos_profile) this.pos_profile = data.pos_profile;
      if (data && data.pos_opening_shift) this.pos_opening_shift = data.pos_opening_shift;
      if (!this.settings.exchange && !this.settings.replacement) return;
      this.reset();
      this.exchange_type = this.settings.exchange ? 'Exchange' : 'Replacement';
      this.dialog = true;
      // scans go to this dialog while it is open
      evntBus.$emit('set_scan_handler', (code) => this.on_scan(code));
      this.$nextTick(() => setTimeout(() => this.$refs.invoice_search_field && this.$refs.invoice_search_field.focus(), 150));
    },
    reset() {
      this.client_ref = 'EXC-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
      this.invoice_query = '';
      this.invoices = [];
      this.searched = false;
      this.invoice = null;
      this.item_query = '';
      this.item_results = [];
      this.new_items = [];
      this.stock_info = {};
      this.preview = null;
      this.preview_error = '';
      this.payments = [];
      this.refund_mode = this.default_mode;
      this.approver = '';
      this.approver_password = '';
      this.result = null;
    },
    close() {
      this.dialog = false;
      evntBus.$emit('set_scan_handler', null);
      evntBus.$emit('escEventTriggered'); // cursor back in the item search box
    },
    // frappe.call gives a jQuery request (no .finally): wrap it in a Promise.
    // opts.silent: no message box (the error is shown in the dialog instead).
    call(method, args, opts = {}) {
      return new Promise((resolve, reject) => {
        frappe.call({
          method: `${API}.${method}`,
          args,
          ...opts,
          callback: (r) => resolve(r && r.message),
          error: (r) => reject(r || {}),
        });
      });
    },
    error_text(err) {
      try {
        // Frappe passes the parsed answer; a raw request (network layer) has it in responseJSON / responseText
        let r = err || {};
        if (!r._server_messages && r.responseJSON) r = r.responseJSON;
        if (!r._server_messages && typeof r.responseText === 'string') {
          try { r = JSON.parse(r.responseText); } catch (e) { /* not JSON */ }
        }
        err = r;
        const msgs = JSON.parse((err && err._server_messages) || '[]').map((m) => JSON.parse(m).message);
        if (msgs.length) return frappe.utils.html2text ? msgs.map((m) => frappe.utils.html2text(m)).join(' ') : msgs.join(' ');
      } catch (e) {
        /* fall through */
      }
      return (err && (err.message || err.exception)) || __('Something went wrong');
    },
    // ----- A. original invoice
    search_invoices() {
      this.loading.invoices = true;
      this.call('search_exchange_invoices', { pos_profile: this.pos_profile.name, text: this.invoice_query || '' })
        .then((rows) => {
          this.invoices = rows || [];
          this.searched = true;
          if (this.invoices.length === 1) this.load_invoice(this.invoices[0].name);
        })
        .catch(() => {}) // Frappe shows the error
        .finally(() => (this.loading.invoices = false));
    },
    load_invoice(name) {
      this.loading.invoices = true;
      this.call('get_exchange_invoice', { invoice: name, pos_profile: this.pos_profile.name })
        .then((inv) => {
          inv.items.forEach((r) => {
            r.return_qty = 0;
            r.return_serials = [];
            r.new_batch_no = null;
            r.new_serials = [];
          });
          this.invoice = inv;
          this.preview = null;
          this.preview_error = '';
        })
        .catch(() => {})
        .finally(() => (this.loading.invoices = false));
    },
    change_invoice() {
      this.invoice = null;
      this.preview = null;
      this.preview_error = '';
    },
    serials_of(r) {
      return String(r.serial_no || '')
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    },
    return_qty_ok(r, v) {
      const q = this.flt(v);
      if (q < 0) return __('Cannot be negative');
      if (q > this.flt(r.returnable_qty) + 1e-6) return __('Only {0} can be returned', [this.qty(r.returnable_qty)]);
      return true;
    },
    return_all() {
      this.invoice.items.forEach((r) => {
        if (r.returnable_qty > 0 && !(r.has_serial_no && this.serials_of(r).length)) r.return_qty = r.returnable_qty;
      });
      this.changed();
    },
    return_none() {
      this.invoice.items.forEach((r) => {
        r.return_qty = 0;
        r.return_serials = [];
      });
      this.changed();
    },
    // ----- B. new items
    on_scan(code) {
      if (!this.dialog || this.result) return;
      if (this.exchange_type !== 'Exchange') {
        evntBus.$emit('show_mesage', { text: __('Replacement gives the same items; switch to Exchange to add other items.'), color: 'warning' });
        return;
      }
      this.item_query = code;
      this.search_items();
    },
    search_items() {
      const text = (this.item_query || '').trim();
      if (!text) return;
      this.loading.items = true;
      this.call('search_exchange_items', { pos_profile: this.pos_profile.name, text })
        .then((rows) => {
          rows = rows || [];
          // a barcode or an exact code: add straight away
          const exact = rows.length === 1 || rows.find((r) => r.item_code === text);
          if (exact) {
            this.add_new_item(rows.length === 1 ? rows[0] : exact);
          } else if (!rows.length) {
            evntBus.$emit('show_mesage', { text: __('No item found for "{0}"', [text]), color: 'error' });
            frappe.utils.play_sound && frappe.utils.play_sound('error');
          }
          this.item_results = exact ? [] : rows;
        })
        .catch(() => {})
        .finally(() => (this.loading.items = false));
    },
    add_new_item(it) {
      this.item_results = [];
      this.item_query = '';
      const same = this.new_items.find((n) => n.item_code === it.item_code && n.uom === it.uom && !n.has_serial_no && !n.has_batch_no);
      if (same) {
        same.qty = this.flt(same.qty) + 1;
      } else {
        this.new_items.push({
          key: ++this.key_seq,
          item_code: it.item_code,
          item_name: it.item_name,
          uoms: it.uoms,
          uom: it.uom || it.stock_uom,
          stock_uom: it.stock_uom,
          qty: 1,
          discount_percentage: 0,
          max_discount: this.flt(it.max_discount),
          actual_qty: this.flt(it.actual_qty),
          has_batch_no: !!Number(it.has_batch_no),
          has_serial_no: !!Number(it.has_serial_no),
          batch_no: null,
          serials: [],
        });
        if (Number(it.has_batch_no) || Number(it.has_serial_no)) this.load_stock_info(it.item_code);
      }
      this.changed();
      this.$nextTick(() => this.$refs.item_search_field && this.$refs.item_search_field.focus());
    },
    remove_new_item(i) {
      this.new_items.splice(i, 1);
      this.changed();
    },
    load_stock_info(item_code) {
      if (this.stock_info[item_code]) return;
      this.call('get_exchange_batches', { item_code, pos_profile: this.pos_profile.name }).then((info) => {
        info.batches = (info.batches || []).map((b) => ({
          ...b,
          label: `${b.batch_no} (${this.qty(b.qty)}${b.expiry_date ? ', ' + __('exp') + ' ' + b.expiry_date : ''})`,
        }));
        this.stock_info = { ...this.stock_info, [item_code]: info };
      }).catch(() => {});
    },
    uom_rate(n) {
      const u = (n.uoms || []).find((x) => x.uom === n.uom) || (n.uoms || [])[0] || {};
      return this.flt(u.rate);
    },
    uom_factor(n) {
      const u = (n.uoms || []).find((x) => x.uom === n.uom) || {};
      return this.flt(u.conversion_factor) || 1;
    },
    new_row_amount(n) {
      return this.uom_rate(n) * this.flt(n.qty) * (1 - this.flt(n.discount_percentage) / 100);
    },
    stock_after(n) {
      return this.flt(n.actual_qty) - this.flt(n.qty) * this.uom_factor(n);
    },
    // ----- settlement
    payload() {
      const ret = this.picked_rows.map((r) => ({
        row: r.row,
        qty: this.flt(r.return_qty),
        serial_no: (r.return_serials || []).length ? r.return_serials.join('\n') : null,
      }));
      let news;
      if (this.exchange_type === 'Replacement') {
        news = this.picked_rows.map((r) => ({
          row: r.row,
          item_code: r.item_code,
          uom: r.uom,
          qty: this.flt(r.return_qty),
          batch_no: r.new_batch_no || null,
          serial_no: (r.new_serials || []).length ? r.new_serials.join('\n') : null,
        }));
      } else {
        news = this.new_items
          .filter((n) => this.flt(n.qty) > 0)
          .map((n) => ({
            item_code: n.item_code,
            uom: n.uom,
            qty: this.flt(n.qty),
            discount_percentage: this.flt(n.discount_percentage),
            batch_no: n.batch_no || null,
            serial_no: (n.serials || []).length ? n.serials.join('\n') : null,
          }));
      }
      return {
        exchange_type: this.exchange_type,
        original_invoice: this.invoice && this.invoice.name,
        pos_opening_shift: this.pos_opening_shift && (this.pos_opening_shift.name || this.pos_opening_shift),
        return_items: ret,
        new_items: news,
        refund_mode: this.refund_mode || this.default_mode,
        client_ref: this.client_ref,
      };
    },
    changed() {
      // the server works out the exact totals (prices, taxes, rounding)
      clearTimeout(this.preview_timer);
      const ready =
        this.invoice &&
        this.picked_rows.length &&
        this.invoice.items.every((r) => this.return_qty_ok(r, r.return_qty) === true) &&
        (this.exchange_type === 'Replacement' || this.new_items.some((n) => this.flt(n.qty) > 0));
      if (!ready) {
        this.preview = null;
        this.preview_error = '';
        return;
      }
      this.preview_timer = setTimeout(() => this.run_preview(), 350);
    },
    run_preview() {
      const seq = ++this.preview_seq;
      this.loading.preview = true;
      this.call('preview_exchange', { data: this.payload(), pos_profile: this.pos_profile.name }, { silent: true })
        .then((message) => {
          if (seq !== this.preview_seq) return; // an older answer
          this.preview = message;
          this.preview_error = '';
          this.setup_payments();
        })
        .catch((err) => {
          if (seq !== this.preview_seq) return;
          this.preview = null;
          this.preview_error = this.error_text(err);
        })
        .finally(() => {
          if (seq === this.preview_seq) this.loading.preview = false;
        });
    },
    setup_payments() {
      if (!this.preview || this.preview.settlement !== 'Additional Payment') {
        this.payments = [];
        return;
      }
      const old = Object.fromEntries(this.payments.map((p) => [p.mode_of_payment, p.amount]));
      this.payments = this.profile_modes.map((m) => ({ mode_of_payment: m, amount: old[m] !== undefined ? old[m] : 0 }));
      if (!this.paid_total) {
        const d = this.payments.find((p) => p.mode_of_payment === this.default_mode) || this.payments[0];
        if (d) d.amount = this.flt(this.preview.difference, 2);
      }
    },
    fill_payment(p) {
      if (!this.flt(p.amount) && this.paid_short > 0) p.amount = this.paid_short;
    },
    // ----- submit
    submit() {
      if (this.submit_block) return;
      const data = this.payload();
      data.payments = this.payments.filter((p) => this.flt(p.amount) > 0).map((p) => ({ mode_of_payment: p.mode_of_payment, amount: this.flt(p.amount) }));
      this.loading.submit = true;
      this.call(
        'create_exchange',
        {
          data,
          pos_profile: this.pos_profile.name,
          approver: this.needs_approval ? this.approver : null,
          approver_password: this.needs_approval ? this.approver_password : null,
        },
        { freeze: true, freeze_message: __('Completing the exchange...') }
      )
        .then((message) => {
          this.result = message;
          this.approver_password = '';
          frappe.utils.play_sound && frappe.utils.play_sound('submit');
          evntBus.$emit('show_mesage', { text: __('Exchange {0} completed', [message.exchange]), color: 'success' });
        })
        .catch(() => {
          this.approver_password = '';
          this.changed(); // quantities may have changed meanwhile
        })
        .finally(() => (this.loading.submit = false));
    },
    // FBR: an invoice goes to FBR when it is printed (POS Profile: Allow FBR on
    // Submit). The server skips one that already has its FBR number; a failed
    // FBR call never stops the print.
    print(name) {
      if (!name) return;
      const p = this.pos_profile || {};
      if (!Number(p.allow_fbr_on_submit)) return this.open_print(name);
      frappe.call({
        method: 'posawesome.events.sales_invoice.submit_to_fbr',
        args: { doctype: 'Sales Invoice', name },
        freeze: true,
        freeze_message: __('Sending to FBR...'),
        callback: () => this.open_print(name),
        error: () => this.open_print(name),
      });
    },
    open_print(name) {
      const p = this.pos_profile || {};
      const url =
        frappe.urllib.get_base_url() +
        '/printview?doctype=Sales%20Invoice&name=' +
        encodeURIComponent(name) +
        '&trigger_print=1' +
        (p.print_format ? '&format=' + encodeURIComponent(p.print_format) : '') +
        '&no_letterhead=' +
        (p.letter_head || 0);
      const w = window.open(url, 'Print');
      if (!w) {
        frappe.msgprint(__('Allow pop-ups for this site to print.'));
        return;
      }
      w.addEventListener('load', () => w.print(), true);
    },
  },
  watch: {
    exchange_type() {
      this.preview = null;
      this.preview_error = '';
      if (this.exchange_type === 'Replacement' && this.invoice) {
        this.picked_rows.forEach((r) => (r.has_batch_no || r.has_serial_no) && this.load_stock_info(r.item_code));
      }
      this.changed();
    },
    picked_rows(rows) {
      if (this.exchange_type === 'Replacement') rows.forEach((r) => (r.has_batch_no || r.has_serial_no) && this.load_stock_info(r.item_code));
    },
  },
  created() {
    evntBus.$on('register_pos_profile', (data) => {
      this.pos_profile = data.pos_profile;
      this.pos_opening_shift = data.pos_opening_shift;
    });
    evntBus.$on('open_item_exchange', (data) => this.open(data));
  },
};
</script>

<style scoped>
.exchange-header {
  background: linear-gradient(135deg, #ffffff 0%, #f3f7fb 100%);
}
.section-card {
  border-radius: 12px;
}
.section-title {
  display: flex;
  align-items: center;
  font-weight: 600;
  font-size: 1.05rem;
  margin-bottom: 8px;
}
.section-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  color: #fff;
  font-size: 0.8rem;
  margin-right: 8px;
}
.pick-row {
  cursor: pointer;
}
.pick-row:hover td {
  background: rgba(25, 118, 210, 0.08);
}
.qty-col {
  width: 120px;
  min-width: 110px;
}
.disc-col {
  width: 90px;
}
.row-done td {
  opacity: 0.5;
}
.row-picked td {
  background: rgba(244, 67, 54, 0.06);
}
.sub-row td {
  border-bottom: 1px dashed #ddd !important;
  padding-bottom: 8px !important;
}
.result-list {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow-y: auto;
}
.sum-box {
  border-radius: 12px;
  padding: 10px 14px;
  height: 100%;
}
.sum-label {
  font-size: 0.85rem;
  opacity: 0.85;
}
.sum-value {
  font-size: 1.5rem;
  font-weight: 700;
}
.sum-return {
  background: #ffebee;
  color: #b71c1c;
}
.sum-new {
  background: #e8f5e9;
  color: #1b5e20;
}
.sum-diff,
.sum-equal {
  background: #eceff1;
  color: #37474f;
}
.sum-pay {
  background: #fff3e0;
  color: #e65100;
  border: 2px solid #fb8c00;
}
.sum-refund {
  background: #f3e5f5;
  color: #4a148c;
  border: 2px solid #ab47bc;
}
.approval-box {
  border: 1px dashed #fb8c00;
  border-radius: 10px;
  background: rgba(251, 140, 0, 0.06);
}
.v-theme--dark .exchange-header {
  background: linear-gradient(135deg, #1e1e1e 0%, #121212 100%);
}
.v-theme--dark .sum-return { background: #3b1d1d; color: #ffcdd2; }
.v-theme--dark .sum-new { background: #1b3320; color: #c8e6c9; }
.v-theme--dark .sum-diff,
.v-theme--dark .sum-equal { background: #263238; color: #eceff1; }
.v-theme--dark .sum-pay { background: #3e2a12; color: #ffe0b2; }
.v-theme--dark .sum-refund { background: #2f1a35; color: #e1bee7; }
</style>
