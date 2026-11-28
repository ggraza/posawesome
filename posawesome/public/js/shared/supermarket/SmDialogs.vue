<template>
  <div class="sm-dialogs">
    <!-- training mode banner -->
    <div v-if="sm.training" class="sm-training-banner">
      <v-icon size="18" class="mr-1">mdi-school</v-icon>{{ __("TRAINING MODE: sales are not recorded") }}
    </div>

    <!-- manager approval -->
    <v-dialog :model-value="!!sm.ui.pin" max-width="380" persistent @keydown.esc="cancelPin">
      <v-card v-if="sm.ui.pin" class="sm-pin">
        <v-toolbar density="compact" flat color="warning">
          <v-toolbar-title>{{ __("Manager Approval") }}: {{ sm.ui.pin.label }}</v-toolbar-title>
        </v-toolbar>
        <v-card-text class="pt-3">
          <div v-if="pinSummary" class="text-body-2 mb-2">{{ pinSummary }}</div>
          <v-text-field
            ref="pinField"
            v-model="pin"
            type="password"
            autocomplete="off"
            variant="outlined"
            density="comfortable"
            :label="__('Manager PIN or scan the manager card')"
            :error-messages="sm.ui.pin.error ? [sm.ui.pin.error] : []"
            :disabled="sm.ui.pin.busy"
            autofocus
            @keydown.enter.prevent="sendPin"
          ></v-text-field>
          <div class="sm-keypad">
            <v-btn v-for="k in keys" :key="k" variant="outlined" size="large" @click="press(k)">{{ k }}</v-btn>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-btn variant="text" @click="cancelPin">{{ __("Cancel") }}</v-btn>
          <v-spacer></v-spacer>
          <v-btn color="warning" variant="elevated" :loading="sm.ui.pin.busy" :disabled="!pin" @click="sendPin">{{
            __("Approve")
          }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- reason -->
    <v-dialog :model-value="!!sm.ui.reason" max-width="440" persistent @keydown.esc="answer(null)">
      <v-card v-if="sm.ui.reason">
        <v-toolbar density="compact" flat color="primary">
          <v-toolbar-title>{{ sm.ui.reason.title }}</v-toolbar-title>
        </v-toolbar>
        <v-card-text class="pt-3">
          <div class="text-caption mb-1">{{ __("Reason") }}</div>
          <div class="d-flex flex-wrap">
            <v-btn
              v-for="r in sm.ui.reason.reasons"
              :key="r"
              class="ma-1"
              :color="reason === r ? 'primary' : undefined"
              :variant="reason === r ? 'elevated' : 'outlined'"
              @click="reason = r"
              >{{ r }}</v-btn
            >
          </div>
          <v-text-field
            v-if="sm.ui.reason.free || !sm.ui.reason.reasons.length"
            v-model="reason"
            class="mt-2"
            variant="outlined"
            density="compact"
            hide-details
            :label="__('Reason')"
            @keydown.enter.prevent="reason && answer(reason)"
          ></v-text-field>
        </v-card-text>
        <v-card-actions>
          <v-btn variant="text" @click="answer(null)">{{ __("Back") }}</v-btn>
          <v-spacer></v-spacer>
          <v-btn color="primary" variant="elevated" :disabled="!reason" @click="answer(reason)">{{ __("OK") }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- cash pickup / cash in / cash out -->
    <v-dialog :model-value="!!sm.ui.cash" max-width="400" persistent @keydown.esc="closeCash">
      <v-card v-if="sm.ui.cash">
        <v-toolbar density="compact" flat color="primary">
          <v-toolbar-title>{{ __(sm.ui.cash.type) }}</v-toolbar-title>
        </v-toolbar>
        <v-card-text class="pt-3">
          <div class="text-caption mb-2">{{ cashHelp }}</div>
          <v-text-field
            v-model="sm.ui.cash.amount"
            type="number"
            min="0"
            variant="outlined"
            density="comfortable"
            :label="__('Amount')"
            autofocus
            :prefix="currency"
            @keydown.enter.prevent="submitCash"
          ></v-text-field>
          <v-text-field
            v-model="sm.ui.cash.reason"
            variant="outlined"
            density="compact"
            :label="__('Reason / note')"
            hide-details
          ></v-text-field>
          <div v-if="sm.ui.cash.error" class="text-error text-body-2 mt-2">{{ sm.ui.cash.error }}</div>
        </v-card-text>
        <v-card-actions>
          <v-btn variant="text" @click="closeCash">{{ __("Cancel") }}</v-btn>
          <v-spacer></v-spacer>
          <v-btn color="primary" variant="elevated" :loading="sm.ui.cash.busy" @click="submitCash">{{ __("Save") }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- quick keys -->
    <v-dialog :model-value="!!sm.ui.quick" max-width="980" @update:model-value="(v) => !v && (sm.ui.quick = null)">
      <v-card v-if="sm.ui.quick" class="sm-quick">
        <v-toolbar density="compact" flat color="primary">
          <v-toolbar-title>{{ __("Quick Keys") }}</v-toolbar-title>
          <v-btn variant="text" class="sm-quick-close" @click="sm.ui.quick = null">{{ __("Close") }}</v-btn>
        </v-toolbar>
        <div class="sm-quick-tabs">
          <v-btn
            v-for="pg in pages"
            :key="pg.name"
            class="ma-1"
            :variant="sm.ui.quick.page === pg.name ? 'elevated' : 'outlined'"
            :color="sm.ui.quick.page === pg.name ? 'primary' : undefined"
            @click="sm.ui.quick.page = pg.name"
            >{{ pg.label }}</v-btn
          >
        </div>
        <v-card-text>
          <div class="sm-quick-grid">
            <button
              v-for="k in currentKeys"
              :key="k.item_code"
              type="button"
              class="sm-qk"
              :style="k.color ? { background: k.color, color: textOn(k.color) } : null"
              :data-code="k.item_code"
              @click="pressKey(k)"
            >
              <img v-if="k.image && online" :src="k.image" alt="" loading="lazy" @error="(e) => (e.target.style.display = 'none')" />
              <span class="sm-qk-label">{{ k.label }}</span>
              <span v-if="k.ask_weight || weighed(k)" class="sm-qk-kg">{{ k.stock_uom || "Kg" }}</span>
            </button>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- weight -->
    <v-dialog :model-value="!!sm.ui.weigh" max-width="380" persistent @keydown.esc="weighDone(null)">
      <v-card v-if="sm.ui.weigh" class="sm-weigh">
        <v-toolbar density="compact" flat color="primary">
          <v-toolbar-title>{{ __("Weight") }}: {{ sm.ui.weigh.item_name }}</v-toolbar-title>
        </v-toolbar>
        <v-card-text class="pt-3">
          <v-text-field
            v-model="sm.ui.weigh.value"
            variant="outlined"
            density="comfortable"
            :label="sm.ui.weigh.uom"
            autofocus
            inputmode="decimal"
            @keydown.enter.prevent="weighDone(sm.ui.weigh.value)"
          ></v-text-field>
          <div v-if="scale.enabled" class="text-caption mb-2">
            {{ scale.connected ? __("Scale: {0}", [scale.weight == null ? "-" : scale.weight + " kg" + (scale.stable ? "" : " ~")]) : __("Scale not connected") }}
          </div>
          <div class="sm-keypad">
            <v-btn v-for="k in wkeys" :key="k" variant="outlined" size="large" @click="wpress(k)">{{ k }}</v-btn>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-btn variant="text" @click="weighDone(null)">{{ __("Cancel") }}</v-btn>
          <v-btn v-if="scale.enabled" variant="outlined" :loading="sm.ui.weigh.reading" prepend-icon="mdi-scale" @click="readScale">{{
            __("Read Scale")
          }}</v-btn>
          <v-spacer></v-spacer>
          <v-btn color="primary" variant="elevated" :disabled="!(parseFloat(sm.ui.weigh.value) > 0)" @click="weighDone(sm.ui.weigh.value)">{{
            __("OK")
          }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- gift card as payment / store credit -->
    <v-dialog :model-value="!!sm.ui.gift" max-width="420" persistent @keydown.esc="stepClose('gift', false)">
      <v-card v-if="sm.ui.gift">
        <v-toolbar density="compact" flat color="primary">
          <v-toolbar-title>{{ sm.ui.gift.refund ? __("Refund to Store Credit") : __("Pay With Gift Card") }}: {{ money(Math.abs(sm.ui.gift.amount)) }}</v-toolbar-title>
        </v-toolbar>
        <v-card-text class="pt-3">
          <v-text-field v-model="sm.ui.gift.card_no" variant="outlined" density="comfortable" autofocus
            :label="__('Scan or type the card number')" @keydown.enter.prevent="giftLookup" @update:model-value="sm.ui.gift.info = null"></v-text-field>
          <div v-if="sm.ui.gift.info && sm.ui.gift.info.exists" class="text-body-2">
            {{ __("Balance") }}: <b>{{ money(sm.ui.gift.info.balance) }}</b>
            <span v-if="sm.ui.gift.info.expiry_date"> · {{ __("valid until") }} {{ sm.ui.gift.info.expiry_date }}</span>
          </div>
          <div v-if="sm.ui.gift.info && !sm.ui.gift.info.exists && sm.ui.gift.refund" class="text-body-2">{{ __("A new store credit card") }}</div>
          <div v-if="sm.ui.gift.error" class="text-error text-body-2 mt-2">{{ sm.ui.gift.error }}</div>
        </v-card-text>
        <v-card-actions>
          <v-btn variant="text" @click="stepClose('gift', false)">{{ __("Cancel") }}</v-btn>
          <v-btn v-if="sm.ui.gift.refund" variant="outlined" @click="giftNew">{{ __("New Card") }}</v-btn>
          <v-spacer></v-spacer>
          <v-btn variant="outlined" :loading="sm.ui.gift.busy" @click="giftLookup">{{ __("Check") }}</v-btn>
          <v-btn color="primary" variant="elevated" :disabled="!sm.ui.gift.info || !!sm.ui.gift.error" @click="giftOk">{{ __("OK") }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- gift card menu: sell / top up, balance -->
    <v-dialog :model-value="!!sm.ui.giftMenu" max-width="420" @update:model-value="(v) => !v && (sm.ui.giftMenu = null)">
      <v-card v-if="sm.ui.giftMenu">
        <v-toolbar density="compact" flat color="primary">
          <v-toolbar-title>{{ __("Gift Card") }}</v-toolbar-title>
        </v-toolbar>
        <div class="d-flex pa-2">
          <v-btn class="mr-2" :variant="sm.ui.giftMenu.tab === 'sell' ? 'elevated' : 'outlined'" color="primary" @click="sm.ui.giftMenu.tab = 'sell'">{{ __("Sell / Top Up") }}</v-btn>
          <v-btn :variant="sm.ui.giftMenu.tab === 'balance' ? 'elevated' : 'outlined'" color="primary" @click="sm.ui.giftMenu.tab = 'balance'">{{ __("Balance") }}</v-btn>
        </div>
        <v-card-text>
          <v-text-field v-model="sm.ui.giftMenu.card_no" variant="outlined" density="comfortable" autofocus :label="__('Scan or type the card number')"
            @keydown.enter.prevent="sm.ui.giftMenu.tab === 'balance' ? giftBalance() : null"></v-text-field>
          <v-text-field v-if="sm.ui.giftMenu.tab === 'sell'" v-model="sm.ui.giftMenu.amount" type="number" min="0" variant="outlined" density="comfortable"
            :label="__('Amount to load')" :prefix="currency" @keydown.enter.prevent="giftSell"></v-text-field>
          <div v-if="sm.ui.giftMenu.tab === 'balance' && sm.ui.giftMenu.info && sm.ui.giftMenu.info.exists" class="text-h6">
            {{ money(sm.ui.giftMenu.info.balance) }}
            <div class="text-caption">{{ sm.ui.giftMenu.info.status }}<span v-if="sm.ui.giftMenu.info.expiry_date"> · {{ __("valid until") }} {{ sm.ui.giftMenu.info.expiry_date }}</span></div>
          </div>
          <div v-if="sm.ui.giftMenu.error" class="text-error text-body-2">{{ sm.ui.giftMenu.error }}</div>
        </v-card-text>
        <v-card-actions>
          <v-btn variant="text" @click="sm.ui.giftMenu = null">{{ __("Close") }}</v-btn>
          <v-spacer></v-spacer>
          <v-btn v-if="sm.ui.giftMenu.tab === 'sell'" color="primary" variant="elevated" @click="giftSell">{{ __("Add to Cart") }}</v-btn>
          <v-btn v-else color="primary" variant="elevated" :loading="sm.ui.giftMenu.busy" @click="giftBalance">{{ __("Check") }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- wallet / Raast QR -->
    <v-dialog :model-value="!!sm.ui.wallet" max-width="380" persistent @keydown.esc="stepClose('wallet', false)">
      <v-card v-if="sm.ui.wallet" class="sm-wallet">
        <v-toolbar density="compact" flat color="primary">
          <v-toolbar-title>{{ sm.ui.wallet.wallet.title }}: {{ money(sm.ui.wallet.amount) }}</v-toolbar-title>
        </v-toolbar>
        <v-card-text class="pt-3 text-center">
          <div v-if="sm.ui.wallet.loading" class="text-caption">{{ __("Making the QR code...") }}</div>
          <div v-else-if="sm.ui.wallet.html" class="sm-qr" v-html="sm.ui.wallet.html"></div>
          <div v-else class="text-caption">{{ __("No QR code (offline): ask the customer to pay the amount to your account") }}</div>
          <div v-if="!sm.ui.wallet.loading && sm.ui.wallet.html && !sm.ui.wallet.dynamic" class="text-caption">{{ __("The customer types the amount") }}: <b>{{ money(sm.ui.wallet.amount) }}</b></div>
          <v-text-field v-model="sm.ui.wallet.ref" class="mt-2" variant="outlined" density="compact" hide-details
            :label="sm.ui.wallet.wallet.reference_required ? __('Transaction ID (required)') : __('Transaction ID')" @keydown.enter.prevent="walletOk"></v-text-field>
          <div v-if="sm.ui.wallet.error" class="text-error text-body-2 mt-2">{{ sm.ui.wallet.error }}</div>
        </v-card-text>
        <v-card-actions>
          <v-btn variant="text" @click="stepClose('wallet', false)">{{ __("Cancel") }}</v-btn>
          <v-spacer></v-spacer>
          <v-btn color="success" variant="elevated" @click="walletOk">{{ __("Paid") }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- card machine -->
    <v-dialog :model-value="!!sm.ui.card" max-width="380" persistent @keydown.esc="stepClose('card', false)">
      <v-card v-if="sm.ui.card">
        <v-toolbar density="compact" flat color="primary">
          <v-toolbar-title>{{ sm.ui.card.mode }}: {{ money(sm.ui.card.amount) }}</v-toolbar-title>
        </v-toolbar>
        <v-card-text class="pt-3">
          <div v-if="sm.ui.card.waiting" class="text-body-2 mb-2">{{ __("Waiting for the card machine...") }}</div>
          <v-text-field v-model="sm.ui.card.code" variant="outlined" density="comfortable" autofocus
            :label="__('Approval code from the card slip')" @keydown.enter.prevent="cardOk"></v-text-field>
          <div v-if="sm.ui.card.error" class="text-error text-body-2">{{ sm.ui.card.error }}</div>
        </v-card-text>
        <v-card-actions>
          <v-btn variant="text" @click="stepClose('card', false)">{{ __("Cancel") }}</v-btn>
          <v-btn v-if="bridge && !sm.ui.card.waiting" variant="outlined" @click="cardRetry">{{ __("Send to Machine") }}</v-btn>
          <v-spacer></v-spacer>
          <v-btn color="primary" variant="elevated" @click="cardOk">{{ __("OK") }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- e-receipt number -->
    <v-dialog :model-value="!!sm.ui.phone" max-width="380" persistent @keydown.esc="phoneOk(false)">
      <v-card v-if="sm.ui.phone">
        <v-toolbar density="compact" flat color="primary">
          <v-toolbar-title>{{ __("Receipt on WhatsApp / SMS?") }}</v-toolbar-title>
        </v-toolbar>
        <v-card-text class="pt-3">
          <v-text-field v-model="sm.ui.phone.phone" variant="outlined" density="comfortable" autofocus inputmode="tel"
            :label="__('Mobile number')" @keydown.enter.prevent="phoneOk(true)"></v-text-field>
          <div v-if="sm.ui.phone.error" class="text-error text-body-2">{{ sm.ui.phone.error }}</div>
        </v-card-text>
        <v-card-actions>
          <v-btn variant="text" @click="phoneOk(false)">{{ __("No Receipt") }}</v-btn>
          <v-spacer></v-spacer>
          <v-btn color="primary" variant="elevated" @click="phoneOk(true)">{{ __("Send") }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- age check -->
    <v-dialog :model-value="!!sm.ui.age" max-width="380" persistent @keydown.esc="stepClose('age', false)">
      <v-card v-if="sm.ui.age">
        <v-toolbar density="compact" flat color="warning">
          <v-toolbar-title>{{ __("Check the customer's age") }}</v-toolbar-title>
        </v-toolbar>
        <v-card-text class="pt-3 text-body-1">
          {{ __("{0} is for customers aged {1} or over.", [sm.ui.age.item_name, sm.ui.age.age]) }}
        </v-card-text>
        <v-card-actions>
          <v-btn variant="text" color="error" @click="stepClose('age', false)">{{ __("No: Do Not Sell") }}</v-btn>
          <v-spacer></v-spacer>
          <v-btn color="success" variant="elevated" @click="stepClose('age', true)">{{ __("Yes, {0}+", [sm.ui.age.age]) }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- request stock -->
    <v-dialog :model-value="!!sm.ui.request" max-width="460" @update:model-value="(v) => !v && (sm.ui.request = null)">
      <v-card v-if="sm.ui.request">
        <v-toolbar density="compact" flat color="primary">
          <v-toolbar-title>{{ __("Request Stock") }}</v-toolbar-title>
        </v-toolbar>
        <v-card-text class="pt-3">
          <div class="d-flex" style="gap: 8px">
            <v-text-field v-model="sm.ui.request.code" variant="outlined" density="compact" hide-details autofocus
              :label="__('Scan or type a barcode / item code')" @keydown.enter.prevent="reqAdd"></v-text-field>
            <v-text-field v-model="sm.ui.request.qty" type="number" min="1" variant="outlined" density="compact" hide-details
              :label="__('Qty')" style="max-width: 90px" @keydown.enter.prevent="reqAdd"></v-text-field>
          </div>
          <table class="sm-x mt-2">
            <tbody>
              <tr v-for="(r, i) in sm.ui.request.rows" :key="r.code"><td>{{ r.code }}</td><td>{{ r.qty }}</td>
                <td><v-btn size="x-small" variant="text" @click="sm.ui.request.rows.splice(i, 1)">✕</v-btn></td></tr>
            </tbody>
          </table>
          <div v-if="sm.ui.request.error" class="text-error text-body-2 mt-2">{{ sm.ui.request.error }}</div>
        </v-card-text>
        <v-card-actions>
          <v-btn variant="text" @click="sm.ui.request = null">{{ __("Close") }}</v-btn>
          <v-spacer></v-spacer>
          <v-btn color="primary" variant="elevated" :disabled="!sm.ui.request.rows.length" :loading="sm.ui.request.busy" @click="reqSend">{{ __("Send Request") }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- low stock -->
    <v-dialog :model-value="!!sm.ui.low" max-width="560" @update:model-value="(v) => !v && (sm.ui.low = null)">
      <v-card v-if="sm.ui.low">
        <v-toolbar density="compact" flat color="primary">
          <v-toolbar-title>{{ __("Low Stock") }} ({{ sm.ui.low.rows.length }})</v-toolbar-title>
        </v-toolbar>
        <v-card-text class="pt-3">
          <div v-if="!sm.ui.low.rows.length" class="text-body-2">{{ __("Nothing is below its re-order level.") }}</div>
          <table v-else class="sm-x">
            <tbody>
              <tr><td><b>{{ __("Item") }}</b></td><td><b>{{ __("In Stock") }}</b></td><td><b>{{ __("Re-order Level") }}</b></td></tr>
              <tr v-for="r in sm.ui.low.rows" :key="r.item_code"><td>{{ r.item_name }}</td><td>{{ r.actual_qty }} {{ r.stock_uom }}</td><td>{{ r.level }}</td></tr>
            </tbody>
          </table>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="sm.ui.low = null">{{ __("Close") }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- X report -->
    <v-dialog :model-value="!!sm.ui.x" max-width="520" @update:model-value="(v) => !v && (sm.ui.x = null)">
      <v-card v-if="sm.ui.x">
        <v-toolbar density="compact" flat color="primary">
          <v-toolbar-title>{{ __("X Report") }} · {{ sm.ui.x.name }}</v-toolbar-title>
        </v-toolbar>
        <v-card-text class="pt-3">
          <div class="text-caption mb-2">
            {{ sm.ui.x.user_name }} · {{ __("since") }} {{ dt(sm.ui.x.period_start) }}
          </div>
          <table class="sm-x">
            <tbody>
              <tr><td>{{ __("Sales") }} ({{ sm.ui.x.sales_count }})</td><td>{{ money(sm.ui.x.gross) }}</td></tr>
              <tr><td>{{ __("Returns") }} ({{ sm.ui.x.returns_count }})</td><td>{{ money(sm.ui.x.returns) }}</td></tr>
              <tr class="b"><td>{{ __("Net Sales") }}</td><td>{{ money(sm.ui.x.net) }}</td></tr>
              <tr><td>{{ __("Discounts") }}</td><td>{{ money(sm.ui.x.discount) }}</td></tr>
              <tr><td>{{ __("Taxes") }}</td><td>{{ money(sm.ui.x.taxes) }}</td></tr>
            </tbody>
          </table>
          <div class="text-subtitle-2 mt-3">{{ __("Payments") }}</div>
          <table class="sm-x">
            <tbody>
              <tr v-for="m in sm.ui.x.modes" :key="m.mode_of_payment">
                <td>{{ m.mode_of_payment }}</td>
                <td>{{ money(m.sales) }}</td>
                <td v-if="!sm.ui.x.blind">{{ __("expected") }} {{ money(m.expected) }}</td>
              </tr>
            </tbody>
          </table>
          <div class="text-subtitle-2 mt-3">{{ __("Cash Control") }}</div>
          <table class="sm-x">
            <tbody>
              <tr><td>{{ __("Cash In") }}</td><td>{{ money(sm.ui.x.cash_in) }}</td></tr>
              <tr><td>{{ __("Cash Out") }}</td><td>{{ money(sm.ui.x.cash_out) }}</td></tr>
              <tr><td>{{ __("Cash Pickups") }}</td><td>{{ money(sm.ui.x.pickups) }}</td></tr>
              <tr><td>{{ __("No Sales") }}</td><td>{{ sm.ui.x.no_sales }}</td></tr>
              <tr><td>{{ __("Line Voids / Cart Voids") }}</td><td>{{ sm.ui.x.line_voids }} / {{ sm.ui.x.cart_voids }}</td></tr>
              <tr><td>{{ __("Voided Amount") }}</td><td>{{ money(sm.ui.x.void_amount) }}</td></tr>
              <tr v-if="!sm.ui.x.blind" class="b"><td>{{ __("Expected Cash") }}</td><td>{{ money(sm.ui.x.expected_cash) }}</td></tr>
            </tbody>
          </table>
        </v-card-text>
        <v-card-actions>
          <v-btn variant="text" @click="sm.ui.x = null">{{ __("Close") }}</v-btn>
          <v-spacer></v-spacer>
          <v-btn color="primary" variant="elevated" prepend-icon="mdi-printer" @click="printX">{{ __("Print") }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
import {
  sm,
  attachBus,
  submitPin,
  cancelPin,
  answerReason,
  submitCash,
  printHtml,
  quickPages,
  pressQuickKey,
  answerWeigh,
  readScaleInto,
  scaleState,
  closeStep,
  lookupGiftCard,
  newStoreCreditNo,
  confirmGiftCard,
  giftMenuBalance,
  giftMenuSell,
  confirmWallet,
  confirmCard,
  cardBridge,
  confirmPhone,
  requestAdd,
  requestSend,
} from "./service.js";
import { isWeighed } from "./logic.js";
import { network } from "../../offline/network.js";

function esc(v) {
  return String(v == null ? "" : v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

export default {
  name: "SmDialogs",
  data() {
    return {
      sm,
      scale: scaleState,
      pin: "",
      reason: "",
      keys: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"],
      wkeys: ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"],
    };
  },
  computed: {
    pages() {
      return quickPages();
    },
    currentKeys() {
      const q = this.sm.ui.quick;
      const pg = q && this.pages.find((p) => p.name === q.page);
      return (pg && pg.keys) || [];
    },
    online() {
      return network.isOnline;
    },
    bridge() {
      return !!this.sm.s.card_bridge_url;
    },
    pinSummary() {
      const d = (this.sm.ui.pin && this.sm.ui.pin.details) || {};
      const parts = [];
      if (d.item_name) parts.push(d.item_name);
      if (d.old_value || d.new_value) {
        if (this.sm.ui.pin.action === "discount") parts.push(__("discount {0}%", [Math.round(d.new_value * 100) / 100]));
        else parts.push(this.money(d.old_value) + " → " + this.money(d.new_value));
      }
      if (d.amount) parts.push(this.money(d.amount));
      if (d.reason) parts.push(d.reason);
      return parts.join(" · ");
    },
    currency() {
      return (this.sm.profile && this.sm.profile.currency) || "";
    },
    cashHelp() {
      const t = this.sm.ui.cash && this.sm.ui.cash.type;
      if (t === "Cash Pickup") return __("Cash taken out of the drawer to the safe.");
      if (t === "Cash In") return __("Cash put into the drawer (float, change).");
      return __("Cash paid out of the drawer.");
    },
  },
  watch: {
    "sm.ui.pin"(v) {
      this.pin = "";
      if (v) this.$nextTick(() => this.$refs.pinField && this.$refs.pinField.focus && this.$refs.pinField.focus());
    },
    "sm.ui.reason"() {
      this.reason = "";
    },
  },
  mounted() {
    attachBus(this.$evntBus);
  },
  methods: {
    cancelPin,
    submitCash,
    pressKey(k) {
      pressQuickKey(k);
    },
    stepClose(kind, v) {
      closeStep(kind, v);
    },
    giftLookup() {
      lookupGiftCard();
    },
    giftNew() {
      newStoreCreditNo();
    },
    giftOk() {
      confirmGiftCard();
    },
    giftBalance() {
      giftMenuBalance();
    },
    giftSell() {
      giftMenuSell();
    },
    walletOk() {
      confirmWallet();
    },
    cardOk() {
      confirmCard();
    },
    cardRetry() {
      cardBridge();
    },
    phoneOk(send) {
      confirmPhone(send);
    },
    reqAdd() {
      requestAdd();
    },
    reqSend() {
      requestSend();
    },
    weighed(k) {
      return !!(this.sm.s.ask_weight && isWeighed(k, this.sm.s.weighed_uoms));
    },
    textOn(color) {
      // black or white text, whichever reads better on the button colour
      const m = /^#?([0-9a-f]{6})$/i.exec(String(color || ""));
      if (!m) return undefined;
      const n = parseInt(m[1], 16);
      const lum = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
      return lum > 150 ? "#000" : "#fff";
    },
    wpress(k) {
      const w = this.sm.ui.weigh;
      if (!w) return;
      const v = String(w.value || "");
      if (k === "⌫") w.value = v.slice(0, -1);
      else if (k === ".") w.value = v.includes(".") ? v : (v || "0") + ".";
      else w.value = v + k;
    },
    weighDone(v) {
      answerWeigh(v);
    },
    readScale() {
      readScaleInto();
    },
    press(k) {
      if (k === "C") this.pin = "";
      else if (k === "⌫") this.pin = this.pin.slice(0, -1);
      else this.pin += k;
    },
    sendPin() {
      if (this.pin) submitPin({ pin: this.pin });
    },
    answer(v) {
      answerReason(v);
    },
    closeCash() {
      this.sm.ui.cash = null;
    },
    money(v) {
      if (v == null) return "";
      try {
        if (typeof window.format_currency === "function") return window.format_currency(v, this.currency);
      } catch (e) {
        /* plain number below */
      }
      return (Math.round(Number(v || 0) * 100) / 100).toFixed(2);
    },
    dt(v) {
      try {
        return frappe.datetime.str_to_user(v);
      } catch (e) {
        return v || "";
      }
    },
    printX() {
      const x = this.sm.ui.x;
      const row = (a, b) => `<tr><td>${esc(a)}</td><td style="text-align:right">${esc(b)}</td></tr>`;
      const modes = x.modes
        .map((m) => row(m.mode_of_payment, this.money(m.sales) + (x.blind ? "" : " / " + this.money(m.expected))))
        .join("");
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
        body{font-family:monospace,sans-serif;font-size:12px;width:72mm;margin:0 auto;color:#000}
        table{width:100%;border-collapse:collapse} .c{text-align:center} .b{font-weight:bold} hr{border:0;border-top:1px dashed #000}
        @page{size:80mm auto;margin:2mm}</style></head><body>
        <div class="c b">${esc(this.sm.profile && this.sm.profile.company)}</div>
        <div class="c b">${esc(__("X REPORT"))}</div><div class="c">${esc(__("Shift so far, not a closing"))}</div><hr>
        <table>${row(__("Shift"), x.name)}${row(__("Cashier"), x.user_name)}${row(__("Since"), this.dt(x.period_start))}${row(
        __("Printed"),
        this.dt(x.printed_on)
      )}</table><hr>
        <table>${row(__("Sales") + " (" + x.sales_count + ")", this.money(x.gross))}${row(
        __("Returns") + " (" + x.returns_count + ")",
        this.money(x.returns)
      )}${row(__("Net Sales"), this.money(x.net))}${row(__("Discounts"), this.money(x.discount))}${row(
        __("Taxes"),
        this.money(x.taxes)
      )}</table><hr>
        <div class="b">${esc(__("Payments"))}${x.blind ? "" : " (" + esc(__("sales / expected")) + ")"}</div><table>${modes}</table><hr>
        <table>${row(__("Cash In"), this.money(x.cash_in))}${row(__("Cash Out"), this.money(x.cash_out))}${row(
        __("Cash Pickups"),
        this.money(x.pickups)
      )}${row(__("No Sales"), x.no_sales)}${row(__("Line Voids"), x.line_voids)}${row(__("Cart Voids"), x.cart_voids)}${row(
        __("Voided Amount"),
        this.money(x.void_amount)
      )}${x.blind ? "" : row(__("Expected Cash"), this.money(x.expected_cash))}</table>
        </body></html>`;
      printHtml(html);
    },
  },
};
</script>

<style scoped>
.sm-training-banner {
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3000;
  background: #c62828;
  color: #fff;
  font-weight: bold;
  padding: 2px 14px;
  border-radius: 0 0 8px 8px;
  font-size: 13px;
  pointer-events: none;
}
.sm-keypad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}
.sm-qr :deep(img) {
  width: 220px;
  height: 220px;
  image-rendering: pixelated;
}
.sm-quick-tabs {
  display: flex;
  flex-wrap: wrap;
  padding: 6px 8px 0;
}
.sm-quick-close {
  margin-left: auto;
  color: inherit;
}
.sm-quick-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
}
.sm-qk {
  position: relative;
  min-height: 96px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 10px;
  background: #f5f7f8;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 6px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  overflow: hidden;
}
.sm-qk:active {
  transform: scale(0.97);
}
.sm-qk img {
  max-height: 52px;
  max-width: 100%;
  object-fit: contain;
  margin-bottom: 4px;
}
.sm-qk-label {
  text-align: center;
  line-height: 1.15;
}
.sm-qk-kg {
  position: absolute;
  top: 4px;
  right: 6px;
  font-size: 10px;
  opacity: 0.75;
}
.sm-x {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.sm-x td {
  padding: 2px 0;
}
.sm-x td + td {
  text-align: right;
}
.sm-x tr.b td {
  font-weight: bold;
}
</style>
