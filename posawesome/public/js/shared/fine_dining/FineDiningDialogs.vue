<template>
  <div class="fd-dialogs">
    <!-- number of guests -->
    <v-dialog v-model="covers.open" max-width="420" persistent>
      <v-card>
        <v-toolbar density="compact" flat color="primary">
          <v-toolbar-title>
            {{ covers.table ? __("Guests at table {0}", [covers.table]) : __("Number of guests") }}
          </v-toolbar-title>
        </v-toolbar>
        <v-card-text class="pt-4">
          <div class="fd-num-grid">
            <v-btn
              v-for="n in 12"
              :key="n"
              :color="covers.value === n ? 'primary' : undefined"
              :variant="covers.value === n ? 'elevated' : 'outlined'"
              size="large"
              @click="covers.value = n"
              >{{ n }}</v-btn
            >
          </div>
          <v-text-field
            class="mt-3"
            v-model.number="covers.value"
            type="number"
            min="1"
            variant="outlined"
            density="compact"
            hide-details
            :label="__('Guests')"
            @keydown.enter.prevent="closeCovers(true)"
          ></v-text-field>
          <div v-if="covers.seats" class="text-caption mt-2">{{ __("This table has {0} seats", [covers.seats]) }}</div>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="closeCovers(false)">{{ __("Skip") }}</v-btn>
          <v-btn color="primary" variant="elevated" :disabled="!(covers.value > 0)" @click="closeCovers(true)">{{
            __("OK")
          }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- tip -->
    <v-dialog v-model="tip.open" max-width="420" persistent>
      <v-card>
        <v-toolbar density="compact" flat color="primary">
          <v-toolbar-title>{{ __("Tip") }}</v-toolbar-title>
        </v-toolbar>
        <v-card-text class="pt-4">
          <div class="text-caption mb-2">{{ __("Bill before the tip: {0}", [tipMoney(tip.total)]) }}</div>
          <div class="d-flex flex-wrap mb-2">
            <v-btn v-for="p in [5, 10, 12.5, 15]" :key="p" class="ma-1" variant="outlined" @click="tip.value = round2((tip.total * p) / 100)">{{ p }}%</v-btn>
            <v-btn class="ma-1" variant="outlined" @click="tip.value = 0">{{ __("No tip") }}</v-btn>
          </div>
          <v-text-field
            v-model.number="tip.value"
            type="number"
            min="0"
            variant="outlined"
            density="compact"
            hide-details
            :label="__('Tip amount')"
            @keydown.enter.prevent="closeTip(true)"
          ></v-text-field>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="closeTip(false)">{{ __("Back") }}</v-btn>
          <v-btn color="primary" variant="elevated" :disabled="!(Number(tip.value) >= 0)" @click="closeTip(true)">{{ __("OK") }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- guest allergies -->
    <v-dialog v-model="alg.open" max-width="520" persistent>
      <v-card>
        <v-toolbar density="compact" flat color="error">
          <v-toolbar-title>{{ __("Guest allergies") }}</v-toolbar-title>
        </v-toolbar>
        <v-card-text class="pt-3">
          <div class="d-flex flex-wrap">
            <v-btn
              v-for="a in alg.list"
              :key="a.name"
              class="ma-1 text-none"
              :color="alg.chosen.includes(a.name) ? 'error' : undefined"
              :variant="alg.chosen.includes(a.name) ? 'elevated' : 'outlined'"
              @click="toggleAllergen(a.name)"
              >{{ a.name }}</v-btn
            >
          </div>
          <v-text-field v-model="alg.other" class="mt-2" :label="__('Other (comma separated)')" variant="outlined" density="compact" hide-details></v-text-field>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="closeAllergies(false)">{{ __("Back") }}</v-btn>
          <v-btn color="error" variant="elevated" @click="closeAllergies(true)">{{ __("OK") }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- guest profile -->
    <v-dialog v-model="gp.open" max-width="480">
      <v-card v-if="gp.p">
        <v-toolbar density="compact" flat :color="gp.p.vip ? 'amber-darken-2' : 'primary'">
          <v-toolbar-title>{{ gp.p.vip ? "★ " : "" }}{{ gp.p.name }}</v-toolbar-title>
        </v-toolbar>
        <v-card-text class="pt-3">
          <div v-for="d in gp.p.special_dates || []" :key="d.label" class="text-warning font-weight-bold mb-1">
            {{ d.days === 0 ? __("{0} today!", [d.label]) : d.days < 0 ? __("{0} was yesterday", [d.label]) : __("{0} in {1} days", [d.label, d.days]) }}
          </div>
          <div class="mb-1">{{ __("{0} visits", [gp.p.visits]) }}<span v-if="gp.p.last_visit"> &middot; {{ __("last {0}", [gp.p.last_visit]) }}</span></div>
          <div class="mb-1">{{ __("Average bill") }}: {{ gpMoney(gp.p.avg_spend) }}</div>
          <div v-if="(gp.p.favourites || []).length" class="mb-1">{{ __("Favourites") }}: {{ gp.p.favourites.join(", ") }}</div>
          <div v-if="gp.p.preferences" class="mb-1">{{ __("Preferences") }}: {{ gp.p.preferences }}</div>
          <div v-if="gp.p.allergies" class="mb-1 text-error font-weight-bold">{{ __("Allergies") }}: {{ gp.p.allergies }}</div>
          <div v-if="gp.p.notes" class="text-caption">{{ gp.p.notes }}</div>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="gp.open = false">{{ __("Close") }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 86 list -->
    <v-dialog v-model="e86.open" max-width="560" persistent scrollable>
      <v-card>
        <v-toolbar density="compact" flat color="grey-darken-3">
          <v-toolbar-title>{{ __("86 - not available today") }}</v-toolbar-title>
        </v-toolbar>
        <v-card-text style="max-height: 60vh">
          <div v-if="!e86.list.length" class="text-caption mb-2">{{ __("Everything is available.") }}</div>
          <div v-for="i in e86.list" :key="i.item_code" class="d-flex align-center fd-86-row">
            <span class="flex-grow-1">{{ i.item_name || i.item_code }}</span>
            <v-btn size="small" color="success" variant="outlined" :loading="e86.busy === i.item_code" @click="set86(i.item_code, 0)">{{ __("Back On") }}</v-btn>
          </div>
          <v-text-field v-model="e86.search" class="mt-3" :label="__('Mark a dish 86: search')" variant="outlined" density="compact" hide-details></v-text-field>
          <div v-for="i in e86Matches" :key="i.item_code" class="d-flex align-center fd-86-row">
            <span class="flex-grow-1">{{ i.item_name }}</span>
            <v-btn size="small" color="error" variant="outlined" :loading="e86.busy === i.item_code" @click="set86(i.item_code, 1)">86</v-btn>
          </div>
          <v-alert v-if="e86.error" type="error" density="compact" class="mt-2">{{ e86.error }}</v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="close86">{{ __("Close") }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- modifiers -->
    <v-dialog v-model="mods.open" max-width="640" persistent scrollable>
      <v-card>
        <v-toolbar density="compact" flat color="primary">
          <v-toolbar-title>{{ mods.item ? mods.item.item_name : "" }}</v-toolbar-title>
        </v-toolbar>
        <v-card-text style="max-height: 65vh">
          <div v-for="g in mods.groups" :key="g.name" class="mb-4">
            <div class="d-flex align-center mb-1">
              <span class="text-subtitle-1 font-weight-bold">{{ g.group_name || g.name }}</span>
              <v-chip v-if="isRequired(g)" size="x-small" color="error" class="ml-2">{{ __("Required") }}</v-chip>
              <span class="text-caption ml-2">{{ ruleText(g) }}</span>
            </div>
            <div class="fd-opt-wrap">
              <v-btn
                v-for="o in g.options"
                :key="o.option"
                class="ma-1 text-none"
                :color="isChosen(g, o) ? 'primary' : undefined"
                :variant="isChosen(g, o) ? 'elevated' : 'outlined'"
                @click="toggle(g, o)"
              >
                <v-icon v-if="isChosen(g, o)" start>mdi-check</v-icon>
                {{ o.option }}
                <span v-if="o.item" class="ml-1 text-caption">(+ {{ mods.addonName ? mods.addonName(o.item) : o.item }})</span>
              </v-btn>
            </div>
            <div v-if="errorFor(g)" class="text-error text-caption">{{ errorFor(g) }}</div>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="closeMods(false)">{{ __("Cancel") }}</v-btn>
          <v-btn color="primary" variant="elevated" @click="closeMods(true)">{{ __("OK") }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- void / comp -->
    <v-dialog v-model="vd.open" max-width="560" persistent>
      <v-card>
        <v-toolbar density="compact" flat :color="vd.type === 'Comp' ? 'warning' : 'error'">
          <v-toolbar-title>
            {{ vd.type === "Comp" ? __("Make free (comp)") : __("Void items sent to the kitchen") }}
          </v-toolbar-title>
        </v-toolbar>
        <v-card-text class="pt-3">
          <v-table density="compact" class="mb-3">
            <thead>
              <tr>
                <th>{{ __("Item") }}</th>
                <th class="text-right">{{ __("Qty") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="l in vd.lines" :key="l.row_id">
                <td>{{ l.item_name }}</td>
                <td class="text-right">{{ l.qty }}</td>
              </tr>
            </tbody>
          </v-table>
          <div v-if="vd.type === 'Void'" class="text-caption mb-2">
            {{ __("The kitchen gets a VOID ticket for these items.") }}
          </div>
          <v-select
            v-model="vd.reason"
            :items="vd.reasons"
            item-title="reason"
            item-value="name"
            :label="__('Reason')"
            variant="outlined"
            density="compact"
            :no-data-text="__('Add reasons in POS Void Reason')"
          ></v-select>
          <v-text-field v-model="vd.remarks" :label="__('Remarks (optional)')" variant="outlined" density="compact"></v-text-field>
          <template v-if="vd.approval">
            <div class="text-caption mb-1">
              {{ __("Manager approval ({0}). Leave empty if you have this role.", [vd.role || ""]) }}
            </div>
            <v-row dense>
              <v-col cols="6">
                <v-text-field v-model="vd.approver" :label="__('Manager user')" variant="outlined" density="compact" autocomplete="off"></v-text-field>
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model="vd.password"
                  :label="__('Password')"
                  type="password"
                  variant="outlined"
                  density="compact"
                  autocomplete="new-password"
                  @keydown.enter.prevent="confirmVoid"
                ></v-text-field>
              </v-col>
            </v-row>
          </template>
          <v-alert v-if="vd.error" type="error" density="compact" class="mt-1">{{ vd.error }}</v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" :disabled="vd.busy" @click="closeVoid(null)">{{ __("Back") }}</v-btn>
          <v-btn
            :color="vd.type === 'Comp' ? 'warning' : 'error'"
            variant="elevated"
            :loading="vd.busy"
            :disabled="!vd.reason"
            @click="confirmVoid"
            >{{ vd.type === "Comp" ? __("Make Free") : __("Void") }}</v-btn
          >
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
import { checkSelection } from "./logic.js";
import { errorText } from "./mixin.js";

export default {
  name: "FineDiningDialogs",
  data() {
    return {
      covers: { open: false, value: null, table: null, seats: 0, resolve: null },
      mods: { open: false, item: null, groups: [], selection: {}, addonName: null, tried: false, resolve: null },
      vd: {
        open: false, type: "Void", lines: [], reasons: [], approval: false, role: "",
        reason: null, remarks: "", approver: "", password: "", error: "", busy: false, confirm: null, resolve: null,
      },
      lastReason: null,
      tip: { open: false, value: 0, total: 0, currency: null, resolve: null },
      alg: { open: false, list: [], chosen: [], other: "", resolve: null },
      gp: { open: false, p: null, currency: null },
      e86: { open: false, list: [], items: [], search: "", busy: null, error: "", setter: null, resolve: null },
    };
  },
  computed: {
    e86Matches() {
      const q = (this.e86.search || "").trim().toLowerCase();
      if (q.length < 2) return [];
      const out = new Set(this.e86.list.map((i) => i.item_code));
      return this.e86.items
        .filter((i) => !out.has(i.item_code) && ((i.item_name || "").toLowerCase().includes(q) || (i.item_code || "").toLowerCase().includes(q)))
        .slice(0, 12);
    },
  },
  methods: {
    // ------------------------------------------------------------ covers
    askCovers({ current, table, seats }) {
      return new Promise((resolve) => {
        Object.assign(this.covers, { open: true, value: current || null, table, seats: seats || 0, resolve });
      });
    },
    closeCovers(ok) {
      const n = parseInt(this.covers.value, 10);
      if (ok && !(n > 0)) return;
      this.covers.open = false;
      const r = this.covers.resolve;
      this.covers.resolve = null;
      if (r) r(ok ? n : null);
    },
    // ------------------------------------------------------------ tip
    askTip({ total, current, currency }) {
      return new Promise((resolve) => {
        Object.assign(this.tip, { open: true, value: Number(current) || 0, total: Number(total) || 0, currency, resolve });
      });
    },
    round2(v) {
      return Math.round(v * 100) / 100;
    },
    tipMoney(v) {
      try {
        return format_currency(v, this.tip.currency);
      } catch (e) {
        return v;
      }
    },
    closeTip(ok) {
      const v = Number(this.tip.value);
      if (ok && !(v >= 0)) return;
      this.tip.open = false;
      const r = this.tip.resolve;
      this.tip.resolve = null;
      if (r) r(ok ? this.round2(v) : null);
    },
    // ------------------------------------------------------------ guest profile
    showGuest(p, currency) {
      Object.assign(this.gp, { open: true, p, currency });
    },
    gpMoney(v) {
      try {
        return format_currency(v, this.gp.currency);
      } catch (e) {
        return v;
      }
    },
    // ------------------------------------------------------------ allergies
    askAllergies({ list, current }) {
      const cur = String(current || "").split(",").map((x) => x.trim()).filter(Boolean);
      const known = (list || []).map((a) => a.name);
      return new Promise((resolve) => {
        Object.assign(this.alg, {
          open: true, list: list || [], chosen: cur.filter((c) => known.includes(c)),
          other: cur.filter((c) => !known.includes(c)).join(", "), resolve,
        });
      });
    },
    toggleAllergen(name) {
      this.alg.chosen = this.alg.chosen.includes(name) ? this.alg.chosen.filter((x) => x !== name) : [...this.alg.chosen, name];
    },
    closeAllergies(ok) {
      this.alg.open = false;
      const all = [...this.alg.chosen, ...String(this.alg.other || "").split(",").map((x) => x.trim()).filter(Boolean)];
      const r = this.alg.resolve;
      this.alg.resolve = null;
      if (r) r(ok ? all.join(", ") : null);
    },
    // ------------------------------------------------------------ 86
    show86({ list, items, setter }) {
      return new Promise((resolve) => {
        Object.assign(this.e86, { open: true, list: list || [], items: items || [], search: "", busy: null, error: "", setter, resolve });
      });
    },
    async set86(code, value) {
      this.e86.busy = code;
      this.e86.error = "";
      try {
        this.e86.list = (await this.e86.setter(code, value)) || [];
        this.e86.search = "";
      } catch (e) {
        this.e86.error = errorText(e);
      } finally {
        this.e86.busy = null;
      }
    },
    close86() {
      this.e86.open = false;
      const r = this.e86.resolve;
      this.e86.resolve = null;
      if (r) r(this.e86.list);
    },
    // ------------------------------------------------------------ modifiers
    pickModifiers({ item, groups, selection, addonName }) {
      return new Promise((resolve) => {
        const sel = {};
        for (const g of groups) sel[g.name] = [...((selection && selection[g.name]) || [])];
        Object.assign(this.mods, { open: true, item, groups, selection: sel, addonName, tried: false, resolve });
      });
    },
    isRequired(g) {
      return Number(g.required) || Number(g.min_select) > 0;
    },
    ruleText(g) {
      const max = Number(g.max_select) || 0;
      if (max === 1) return __("choose one");
      if (max > 1) return __("up to {0}", [max]);
      return __("any");
    },
    isChosen(g, o) {
      return (this.mods.selection[g.name] || []).includes(o.option);
    },
    toggle(g, o) {
      const cur = this.mods.selection[g.name] || [];
      const max = Number(g.max_select) || 0;
      let next;
      if (cur.includes(o.option)) next = cur.filter((x) => x !== o.option);
      else if (max === 1) next = [o.option];
      else if (max && cur.length >= max) next = cur; // full
      else next = [...cur, o.option];
      this.mods.selection = { ...this.mods.selection, [g.name]: next };
    },
    errorFor(g) {
      if (!this.mods.tried) return "";
      const e = checkSelection([g], this.mods.selection)[0];
      if (!e) return "";
      return e.kind === "min" ? __("Choose at least {0}", [e.min]) : __("Choose at most {0}", [e.max]);
    },
    closeMods(ok) {
      if (ok) {
        this.mods.tried = true;
        if (checkSelection(this.mods.groups, this.mods.selection).length) return;
      }
      this.mods.open = false;
      const r = this.mods.resolve;
      this.mods.resolve = null;
      if (r) r(ok ? { selection: this.mods.selection } : null);
    },
    // ------------------------------------------------------------ void / comp
    askVoid({ type, lines, reasons, approval, role, confirm }) {
      return new Promise((resolve) => {
        Object.assign(this.vd, {
          open: true, type, lines, reasons: reasons || [], approval, role, confirm, resolve,
          reason: reasons && reasons.length === 1 ? reasons[0].name : null,
          remarks: "", approver: "", password: "", error: "", busy: false,
        });
      });
    },
    async confirmVoid() {
      if (!this.vd.reason || this.vd.busy) return;
      this.vd.busy = true;
      this.vd.error = "";
      try {
        const res = await this.vd.confirm({
          reason: this.vd.reason,
          remarks: this.vd.remarks,
          approver: (this.vd.approver || "").trim(),
          password: this.vd.password,
        });
        this.lastReason = this.vd.reason;
        this.closeVoid(res || true);
      } catch (e) {
        this.vd.error = errorText(e);
        this.vd.password = "";
      } finally {
        this.vd.busy = false;
      }
    },
    closeVoid(result) {
      this.vd.open = false;
      this.vd.password = "";
      const r = this.vd.resolve;
      this.vd.resolve = null;
      if (r) r(result);
    },
  },
};
</script>

<style scoped>
.fd-num-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
}
.fd-86-row {
  min-height: 40px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}
.fd-opt-wrap {
  display: flex;
  flex-wrap: wrap;
}
</style>
