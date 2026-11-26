<template>
  <v-dialog v-model="open" max-width="720" persistent scrollable>
    <v-card>
      <v-toolbar density="compact" flat color="primary">
        <v-toolbar-title>{{ __("Split Bill") }}</v-toolbar-title>
      </v-toolbar>
      <v-card-text style="max-height: 70vh">
        <v-btn-toggle v-model="mode" mandatory divided variant="outlined" color="primary" class="mb-3">
          <v-btn value="seat" :disabled="!seats.length">{{ __("By Seat") }}</v-btn>
          <v-btn value="item">{{ __("By Item") }}</v-btn>
          <v-btn value="equal">{{ __("Equal Shares") }}</v-btn>
        </v-btn-toggle>

        <template v-if="mode === 'seat'">
          <div class="text-caption mb-2">{{ __("Each seat becomes its own check. Shared items stay on this check.") }}</div>
          <div v-for="s in seats" :key="s.seat" class="fd-split-group mb-2 pa-2">
            <b>{{ __("Seat {0}", [s.seat]) }}</b> &middot; {{ money(s.total) }}
            <div class="text-caption">{{ s.rows.map((r) => r.item_name).join(", ") }}</div>
          </div>
        </template>

        <template v-if="mode === 'item'">
          <div class="text-caption mb-2">{{ __("Choose what goes on the new check (and how many).") }}</div>
          <div v-for="r in mainRows" :key="r.posa_row_id" class="d-flex align-center fd-split-row">
            <v-btn
              size="small"
              :color="pickQty[r.posa_row_id] ? 'primary' : undefined"
              :variant="pickQty[r.posa_row_id] ? 'elevated' : 'outlined'"
              class="mr-2"
              @click="togglePick(r)"
              >{{ pickQty[r.posa_row_id] ? "✓" : "+" }}</v-btn
            >
            <span class="flex-grow-1">{{ r.item_name }} <span class="text-caption">x{{ r.qty }}</span></span>
            <v-text-field
              v-if="pickQty[r.posa_row_id] && Number(r.qty) > 1 && !Number(r.posa_comp)"
              v-model.number="pickQty[r.posa_row_id]"
              type="number"
              min="1"
              :max="r.qty"
              density="compact"
              variant="outlined"
              hide-details
              style="max-width: 90px"
              :label="__('Qty')"
            ></v-text-field>
          </div>
          <div class="mt-2"><b>{{ __("New check") }}:</b> {{ money(pickedTotal) }}</div>
        </template>

        <template v-if="mode === 'equal'">
          <div class="text-caption mb-2">{{ __("One bill; the guest check shows each guest's share.") }}</div>
          <div class="d-flex flex-wrap">
            <v-btn
              v-for="n in [2, 3, 4, 5, 6, 8, 10]"
              :key="n"
              class="ma-1"
              :color="shares === n ? 'primary' : undefined"
              :variant="shares === n ? 'elevated' : 'outlined'"
              @click="shares = n"
              >{{ n }}</v-btn
            >
          </div>
          <div v-if="shares" class="mt-2">{{ __("{0} shares of {1}", [shares, money(total / shares)]) }}</div>
        </template>
        <v-alert v-if="error" type="error" density="compact" class="mt-2">{{ error }}</v-alert>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn variant="text" @click="close(null)">{{ __("Back") }}</v-btn>
        <v-btn color="primary" variant="elevated" :disabled="!canSplit" @click="confirm">{{
          mode === "equal" ? __("Print Shares") : __("Split")
        }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
export default {
  name: "SplitBillDialog",
  data() {
    return { open: false, mode: "item", items: [], pickQty: {}, shares: 0, error: "", currency: null, resolve: null };
  },
  computed: {
    mainRows() {
      return this.items.filter((r) => !r.posa_parent_row_id);
    },
    seats() {
      const by = {};
      for (const r of this.items) {
        const s = Number(r.posa_seat) || 0;
        if (!s) continue;
        (by[s] = by[s] || { seat: s, rows: [], total: 0 }).rows.push(r);
        by[s].total += Number(r.qty) * Number(r.rate);
      }
      return Object.values(by).sort((a, b) => a.seat - b.seat);
    },
    total() {
      return this.items.reduce((a, r) => a + Number(r.qty) * Number(r.rate), 0);
    },
    pickedTotal() {
      let t = 0;
      for (const r of this.items) {
        const q = Number(this.pickQty[r.posa_row_id]) || Number(this.pickQty[r.posa_parent_row_id] ? this.pickQty[r.posa_parent_row_id] : 0);
        t += q * Number(r.rate);
      }
      return t;
    },
    canSplit() {
      if (this.mode === "equal") return this.shares > 1;
      if (this.mode === "seat") return this.seats.length > 0 && (this.seats.length > 1 || this.items.some((r) => !Number(r.posa_seat)));
      const picked = Object.entries(this.pickQty).filter(([, q]) => Number(q) > 0);
      return picked.length > 0 && picked.length + 0 <= this.mainRows.length && !this.allPicked;
    },
    allPicked() {
      return this.mainRows.every((r) => Number(this.pickQty[r.posa_row_id]) >= Number(r.qty));
    },
  },
  methods: {
    show({ items, currency, shares }) {
      this.items = items || [];
      this.currency = currency;
      this.pickQty = {};
      this.shares = Number(shares) || 0;
      this.error = "";
      this.mode = this.seats.length ? "seat" : "item";
      this.open = true;
      return new Promise((resolve) => (this.resolve = resolve));
    },
    togglePick(r) {
      const cur = this.pickQty[r.posa_row_id];
      this.pickQty = { ...this.pickQty, [r.posa_row_id]: cur ? 0 : Number(r.qty) };
    },
    money(v) {
      try {
        return format_currency(v, this.currency);
      } catch (e) {
        return v;
      }
    },
    confirm() {
      if (this.mode === "equal") return this.close({ mode: "equal", shares: this.shares });
      if (this.mode === "seat") {
        // the first seat stays here when nothing is shared, so this check is not left empty
        const shared = this.items.some((r) => !Number(r.posa_seat));
        const seats = shared ? this.seats : this.seats.slice(1);
        return this.close({
          mode: "seat",
          groups: seats.map((s) => s.rows.filter((r) => !r.posa_parent_row_id).map((r) => ({ row_id: r.posa_row_id, qty: Number(r.qty) }))),
        });
      }
      const group = Object.entries(this.pickQty)
        .filter(([, q]) => Number(q) > 0)
        .map(([row_id, qty]) => ({ row_id, qty: Number(qty) }));
      return this.close({ mode: "item", groups: [group] });
    },
    close(result) {
      this.open = false;
      const r = this.resolve;
      this.resolve = null;
      if (r) r(result);
    },
  },
};
</script>

<style scoped>
.fd-split-group {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 6px;
}
.fd-split-row {
  min-height: 44px;
}
</style>
