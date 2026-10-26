<template>
  <div v-if="state.enabled" class="posa-offline-status">
    <v-chip
      :color="chipColor"
      variant="flat"
      size="small"
      class="mx-1"
      @click="dialog = true"
      :title="__('Offline mode status')"
    >
      <v-icon start size="small">{{ chipIcon }}</v-icon>
      {{ chipText }}
      <span v-if="pendingTotal" class="ml-1">· {{ pendingTotal }}</span>
      <v-progress-circular v-if="state.sync.running || state.queue.syncing" indeterminate size="12" width="2" class="ml-1" />
    </v-chip>

    <v-dialog v-model="dialog" max-width="980" scrollable>
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon :color="chipColor" class="mr-2">{{ chipIcon }}</v-icon>
          {{ __("Offline Mode") }}
          <v-spacer />
          <v-btn icon variant="text" size="small" @click="dialog = false"><v-icon>mdi-close</v-icon></v-btn>
        </v-card-title>
        <v-card-text>
          <v-row dense>
            <v-col cols="12" md="4">
              <v-card variant="outlined" class="pa-3 h-100">
                <div class="text-subtitle-2 mb-1">{{ __("Connection") }}</div>
                <div :class="online ? 'text-success' : 'text-error'" class="text-h6">
                  {{ online ? __("Online") : __("Offline") }}
                </div>
                <div class="text-caption" v-if="state.network.latencyMs && online">{{ state.network.latencyMs }} ms</div>
                <div class="text-caption" v-if="state.network.lastOnline">
                  {{ __("Last online") }}: {{ fmt(state.network.lastOnline) }}
                </div>
                <v-switch
                  :model-value="state.network.forcedOffline"
                  @update:model-value="forceOffline"
                  :label="__('Work offline')"
                  density="compact"
                  hide-details
                  color="warning"
                />
              </v-card>
            </v-col>
            <v-col cols="12" md="4">
              <v-card variant="outlined" class="pa-3 h-100">
                <div class="text-subtitle-2 mb-1">{{ __("Catalogue on this terminal") }}</div>
                <div>{{ __("Items") }}: <b>{{ counts.items }}</b></div>
                <div>{{ __("Prices") }}: <b>{{ counts.prices }}</b></div>
                <div>{{ __("Customers") }}: <b>{{ counts.customers }}</b></div>
                <div class="text-caption">{{ __("Last sync") }}: {{ fmt(lastSync) || __("never") }}</div>
                <div v-if="state.sync.running" class="mt-1">
                  <div class="text-caption">{{ stageLabel }} {{ state.sync.done }}<span v-if="state.sync.total"> / {{ state.sync.total }}</span></div>
                  <v-progress-linear :model-value="syncPercent" :indeterminate="!state.sync.total" height="6" color="primary" />
                </div>
                <div v-if="state.sync.error" class="text-caption text-error">{{ state.sync.error }}</div>
              </v-card>
            </v-col>
            <v-col cols="12" md="4">
              <v-card variant="outlined" class="pa-3 h-100">
                <div class="text-subtitle-2 mb-1">{{ __("Offline invoices") }}</div>
                <div>{{ __("Waiting to upload") }}: <b>{{ state.queue.pending }}</b></div>
                <div>{{ __("Processing on server") }}: <b>{{ state.queue.uploaded }}</b></div>
                <div :class="state.queue.failed ? 'text-error' : ''">{{ __("Failed") }}: <b>{{ state.queue.failed }}</b></div>
                <div>{{ __("Synced (kept 14 days)") }}: <b>{{ state.queue.synced }}</b></div>
                <div v-if="state.queue.lastError" class="text-caption text-error">{{ state.queue.lastError }}</div>
              </v-card>
            </v-col>
          </v-row>

          <div class="d-flex flex-wrap ga-2 my-3">
            <v-btn color="primary" size="small" :disabled="!online" :loading="state.sync.running || state.queue.syncing" @click="syncNow(false)">
              <v-icon start>mdi-sync</v-icon>{{ __("Sync now") }}
            </v-btn>
            <v-btn size="small" variant="outlined" :disabled="!online || state.sync.running" @click="syncNow(true)">
              <v-icon start>mdi-database-refresh</v-icon>{{ __("Re-download catalogue") }}
            </v-btn>
            <v-btn size="small" variant="outlined" color="warning" :disabled="!state.queue.failed" @click="retryAll">
              <v-icon start>mdi-refresh</v-icon>{{ __("Retry failed") }}
            </v-btn>
            <v-btn size="small" variant="outlined" @click="exportQueue">
              <v-icon start>mdi-download</v-icon>{{ __("Export queue (JSON)") }}
            </v-btn>
          </div>

          <v-btn-toggle v-model="filter" density="compact" variant="outlined" mandatory class="mb-2">
            <v-btn value="open" size="small">{{ __("Open") }}</v-btn>
            <v-btn value="failed" size="small">{{ __("Failed") }}</v-btn>
            <v-btn value="synced" size="small">{{ __("Synced") }}</v-btn>
            <v-btn value="all" size="small">{{ __("All") }}</v-btn>
          </v-btn-toggle>

          <v-table density="compact" class="posa-offline-table">
            <thead>
              <tr>
                <th>{{ __("Receipt") }}</th>
                <th>{{ __("Taken on") }}</th>
                <th>{{ __("Customer") }}</th>
                <th class="text-right">{{ __("Total") }}</th>
                <th>{{ __("Status") }}</th>
                <th>{{ __("Sales Invoice") }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.offline_id">
                <td class="text-caption">{{ row.offline_id }}</td>
                <td class="text-caption">{{ row.created_local }}</td>
                <td>{{ row.customer_name }}</td>
                <td class="text-right">{{ money(row.grand_total, row.currency) }}</td>
                <td>
                  <v-chip size="x-small" :color="statusColor(row.status)" variant="flat">{{ __(row.status) }}</v-chip>
                  <div v-if="row.error" class="text-caption text-error posa-error" :title="row.error">{{ firstLine(row.error) }}</div>
                </td>
                <td>
                  <a v-if="row.server_name" :href="`/app/sales-invoice/${row.server_name}`" target="_blank">{{ row.server_name }}</a>
                </td>
                <td class="text-no-wrap">
                  <v-btn icon size="x-small" variant="text" :title="__('Reprint')" @click="reprint(row)"><v-icon>mdi-printer</v-icon></v-btn>
                  <v-btn v-if="row.status === 'failed'" icon size="x-small" variant="text" :title="__('Retry')" @click="retry(row)">
                    <v-icon>mdi-refresh</v-icon>
                  </v-btn>
                  <v-btn v-if="row.status === 'failed'" icon size="x-small" variant="text" color="error" :title="__('Discard')" @click="discard(row)">
                    <v-icon>mdi-delete</v-icon>
                  </v-btn>
                </td>
              </tr>
              <tr v-if="!rows.length">
                <td colspan="7" class="text-center text-caption">{{ __("Nothing here") }}</td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
import offlinePos, { offlineState } from "../../offline";

export default {
  name: "OfflineStatus",
  data() {
    return { dialog: false, filter: "open", rows: [], counts: { items: 0, prices: 0, customers: 0 }, lastSync: null };
  },
  computed: {
    state() {
      return offlineState;
    },
    online() {
      return offlineState.network.isOnline;
    },
    pendingTotal() {
      return offlineState.queue.pending + offlineState.queue.uploaded + offlineState.queue.failed;
    },
    chipColor() {
      if (!this.online) return "error";
      if (offlineState.queue.failed) return "warning";
      if (offlineState.queue.pending || offlineState.queue.uploaded) return "info";
      return "success";
    },
    chipIcon() {
      if (!this.online) return "mdi-cloud-off-outline";
      if (offlineState.sync.running || offlineState.queue.syncing) return "mdi-cloud-sync-outline";
      return "mdi-cloud-check-outline";
    },
    chipText() {
      return this.online ? __("Online") : __("Offline");
    },
    syncPercent() {
      const s = offlineState.sync;
      return s.total ? Math.min(100, (s.done / s.total) * 100) : 0;
    },
    stageLabel() {
      const map = { items: __("Items"), prices: __("Prices"), stock: __("Stock"), customers: __("Customers"), settings: __("Settings") };
      return map[offlineState.sync.stage] || offlineState.sync.stage;
    },
  },
  watch: {
    dialog(v) {
      if (v) this.refresh();
    },
    filter() {
      this.refresh();
    },
    "state.queue.synced"() {
      if (this.dialog) this.refresh();
    },
    "state.queue.failed"() {
      if (this.dialog) this.refresh();
    },
  },
  methods: {
    async refresh() {
      const c = offlinePos.catalog;
      this.counts = { items: c.byCode.size, prices: c.priceByName.size, customers: c.customerByName.size };
      this.lastSync = c.getMeta("last_sync");
      let rows = await offlinePos.listInvoices({ limit: 1000 });
      if (this.filter === "open") rows = rows.filter((r) => ["pending", "uploaded", "failed"].includes(r.status));
      else if (this.filter !== "all") rows = rows.filter((r) => r.status === this.filter);
      this.rows = rows.slice(0, 300);
    },
    syncNow(full) {
      if (full && !window.confirm(__("Download the whole catalogue again? This can take a few minutes."))) return;
      offlinePos.syncNow(full).then(() => this.refresh());
    },
    forceOffline(v) {
      offlinePos.setForcedOffline(v);
    },
    async retry(row) {
      await offlinePos.retryInvoice(row.offline_id);
      this.refresh();
    },
    async retryAll() {
      await offlinePos.retryAllFailed();
      this.refresh();
    },
    async discard(row) {
      if (!window.confirm(__("Discard offline receipt {0}? Only do this if it was entered manually in ERPNext.", [row.offline_id]))) return;
      await offlinePos.discardInvoice(row.offline_id);
      this.refresh();
    },
    exportQueue() {
      offlinePos.exportQueue();
    },
    reprint(row) {
      offlinePos.print(row);
    },
    statusColor(s) {
      return { pending: "info", uploaded: "primary", synced: "success", failed: "error", discarded: "grey" }[s] || "grey";
    },
    firstLine(text) {
      return String(text || "").split("\n")[0].slice(0, 140);
    },
    fmt(iso) {
      if (!iso) return "";
      try {
        return new Date(iso).toLocaleString();
      } catch (e) {
        return iso;
      }
    },
    money(v, cur) {
      try {
        return window.format_currency ? window.format_currency(v, cur) : (Number(v) || 0).toFixed(2);
      } catch (e) {
        return v;
      }
    },
  },
};
</script>

<style scoped>
.posa-offline-table td {
  font-size: 12px;
}
.posa-error {
  max-width: 260px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
