<template>
  <v-dialog v-model="open" fullscreen persistent>
    <v-card class="fd-floor">
      <v-toolbar density="compact" flat color="primary">
        <v-toolbar-title>{{ __("Floor") }}</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn v-if="data.reservations" variant="text" prepend-icon="mdi-calendar-clock" @click="toggleBookings">{{ __("Bookings") }}</v-btn>
        <v-btn variant="text" :loading="loading" prepend-icon="mdi-refresh" @click="reload">{{ __("Refresh") }}</v-btn>
        <v-btn variant="text" prepend-icon="mdi-close" @click="close(null)">{{ __("Close") }}</v-btn>
      </v-toolbar>

      <div class="d-flex flex-wrap align-center px-3 py-2">
        <v-chip
          v-for="z in zoneList"
          :key="z"
          class="mr-2 my-1"
          :color="zone === z ? 'primary' : undefined"
          :variant="zone === z ? 'flat' : 'outlined'"
          @click="zone = z"
          >{{ z || __("All") }}</v-chip
        >
        <v-spacer></v-spacer>
        <span v-for="s in legend" :key="s.state" class="fd-legend mr-3">
          <span class="fd-dot" :style="{ background: s.color }"></span>{{ s.label }}
        </span>
      </div>
      <v-alert v-if="error" type="error" density="compact" class="mx-3">{{ error }}</v-alert>
      <div v-if="pick" class="px-3 pb-2 text-subtitle-2 fd-pick">
        {{ pick.label }}
        <v-btn size="small" variant="text" @click="pick = null">{{ __("Cancel") }}</v-btn>
      </div>

      <div class="fd-floor-body d-flex">
        <!-- the room -->
        <div class="fd-room" :class="{ 'fd-room--grid': !positioned }" ref="room">
          <div
            v-for="t in shownTables"
            :key="t.name"
            class="fd-table"
            :class="['fd-' + (t.table_shape || 'Square').toLowerCase(), { 'fd-table--sel': selected && selected.name === t.name }]"
            :style="tableStyle(t)"
            :data-table="t.name"
            @click="tap(t)"
          >
            <div class="fd-table-name">{{ t.name }}</div>
            <div class="fd-table-state">{{ stateLabel(t.state) }}</div>
            <div v-if="t.orders.length" class="fd-table-info">
              <span v-if="guests(t)">{{ guests(t) }} <v-icon size="12">mdi-account</v-icon></span>
              <span>{{ minutes(t) }}'</span>
              <span v-if="t.orders.length > 1">{{ __("{0} checks", [t.orders.length]) }}</span>
            </div>
            <div v-else class="fd-table-info">{{ t.no_of_seats || "" }} <v-icon v-if="t.no_of_seats" size="12">mdi-seat</v-icon></div>
          </div>
        </div>

        <!-- bookings and waitlist (fine dining phase 4) -->
        <div v-if="showBookings" class="fd-side pa-3 fd-bookings">
          <div class="text-h6">{{ __("Today") }}</div>
          <div v-if="!bk.bookings.length" class="text-caption">{{ __("No bookings today") }}</div>
          <div v-for="b in bk.bookings" :key="b.name" class="fd-order mb-2 pa-2" :data-booking="b.name">
            <div class="d-flex"><b>{{ hhmm(b.reservation_start) }} &middot; {{ b.guest_name }}</b><v-spacer></v-spacer>{{ b.party_size }} <v-icon size="14">mdi-account</v-icon></div>
            <div class="text-caption">{{ b.service_table || __("No table") }} &middot; {{ __(b.status) }}<span v-if="b.occasion"> &middot; {{ __(b.occasion) }}</span><span v-if="b.allergies" class="text-error"> &middot; {{ b.allergies }}</span></div>
            <div v-if="b.status !== 'Seated'" class="d-flex flex-wrap mt-1">
              <v-btn size="small" color="primary" class="mr-1 mb-1" @click="seat(b)">{{ __("Seat") }}</v-btn>
              <v-btn v-if="b.status !== 'Arrived'" size="small" variant="outlined" class="mr-1 mb-1" @click="bookingStatus(b, 'Arrived')">{{ __("Arrived") }}</v-btn>
              <v-btn size="small" variant="outlined" class="mr-1 mb-1" @click="bookingStatus(b, 'No Show')">{{ __("No Show") }}</v-btn>
              <v-btn size="small" variant="text" color="error" class="mb-1" @click="bookingStatus(b, 'Cancelled')">{{ __("Cancel") }}</v-btn>
            </div>
          </div>
          <div class="text-h6 mt-3">{{ __("Waitlist") }}</div>
          <div v-if="!bk.waitlist.length" class="text-caption">{{ __("Nobody waiting") }}</div>
          <div v-for="w in bk.waitlist" :key="w.name" class="fd-order mb-2 pa-2" :data-waiting="w.name">
            <div class="d-flex"><b>{{ w.guest_name }}</b><v-spacer></v-spacer>{{ w.party_size }} <v-icon size="14">mdi-account</v-icon></div>
            <div class="text-caption">{{ __("Waiting {0} min", [waited(w)]) }}<span v-if="w.quoted_wait_minutes"> ({{ __("quoted {0}", [w.quoted_wait_minutes]) }})</span><span v-if="w.phone"> &middot; {{ w.phone }}</span></div>
            <div class="d-flex mt-1">
              <v-btn size="small" color="primary" class="mr-1" @click="seat(w)">{{ __("Seat") }}</v-btn>
              <v-btn size="small" variant="text" color="error" @click="bookingStatus(w, 'Cancelled')">{{ __("Remove") }}</v-btn>
            </div>
          </div>
          <div class="text-h6 mt-3">{{ __("Add") }}</div>
          <v-btn-toggle v-model="form.is_waitlist" mandatory density="compact" divided variant="outlined" color="primary" class="mb-2">
            <v-btn :value="0" size="small">{{ __("Booking") }}</v-btn>
            <v-btn :value="1" size="small">{{ __("Waitlist") }}</v-btn>
          </v-btn-toggle>
          <v-text-field v-model="form.guest_name" :label="__('Guest name')" variant="outlined" density="compact" hide-details class="mb-1"></v-text-field>
          <v-text-field v-model="form.phone" :label="__('Phone')" variant="outlined" density="compact" hide-details class="mb-1"></v-text-field>
          <v-text-field v-model.number="form.party_size" type="number" :label="__('Guests')" variant="outlined" density="compact" hide-details class="mb-1"></v-text-field>
          <v-text-field v-if="!form.is_waitlist" v-model="form.time" type="time" :label="__('Time (today)')" variant="outlined" density="compact" hide-details class="mb-1"></v-text-field>
          <v-text-field v-else v-model.number="form.quoted_wait_minutes" type="number" :label="__('Quoted wait (minutes)')" variant="outlined" density="compact" hide-details class="mb-1"></v-text-field>
          <v-select v-if="!form.is_waitlist" v-model="form.service_table" :items="tableNames" :label="__('Table')" variant="outlined" density="compact" hide-details clearable class="mb-1"></v-select>
          <v-text-field v-model="form.notes" :label="__('Notes')" variant="outlined" density="compact" hide-details class="mb-1"></v-text-field>
          <v-btn block color="primary" :disabled="!form.guest_name || !(form.party_size > 0) || (!form.is_waitlist && !form.time)" @click="addBooking">{{ __("Save") }}</v-btn>
        </div>

        <!-- the chosen table -->
        <div v-else-if="selected" class="fd-side pa-3">
          <div class="text-h6">{{ selected.name }}</div>
          <div class="text-caption mb-2">{{ stateLabel(selected.state) }} &middot; {{ selected.service_zone }}</div>
          <div v-if="selected.booking" class="fd-order mb-2 pa-2">
            <b>{{ __("Booked") }}: {{ selected.booking.guest_name }}</b>
            <div class="text-caption">{{ hhmm(selected.booking.start) }} &middot; {{ __("{0} guests", [selected.booking.party_size]) }}</div>
            <v-btn v-if="!selected.orders.length" size="small" color="primary" class="mt-1" @click="close({ action: 'seat', table: selected.name, booking: selected.booking.name })">{{ __("Seat Booking") }}</v-btn>
          </div>
          <template v-if="!selected.orders.length">
            <v-btn block color="primary" class="mb-2" prepend-icon="mdi-plus" :disabled="selected.state === 'Disabled'" @click="close({ action: 'new', table: selected.name })">
              {{ __("New Order Here") }}
            </v-btn>
            <v-btn v-if="selected.state === 'Cleaning' || selected.state === 'Reserved'" block variant="outlined" class="mb-2" @click="setStatus('Available')">
              {{ __("Mark Available") }}
            </v-btn>
            <v-btn v-if="selected.state === 'Available'" block variant="outlined" class="mb-2" @click="setStatus('Reserved')">{{ __("Mark Reserved") }}</v-btn>
          </template>
          <div v-for="o in selected.orders" :key="o.name" class="fd-order mb-3 pa-2">
            <div class="d-flex">
              <b>{{ o.name }}</b><v-spacer></v-spacer><span>{{ money(o.total, o.currency) }}</span>
            </div>
            <div class="text-caption">
              {{ stateLabel(o.state) }} &middot; {{ o.covers ? __("{0} guests", [o.covers]) : __("Guests?") }} &middot; {{ o.waiter_name }}
            </div>
            <div class="d-flex flex-wrap mt-1">
              <v-btn size="small" color="primary" class="mr-1 mb-1" @click="close({ action: 'open', invoice: o.name })">{{ __("Open") }}</v-btn>
              <v-btn size="small" variant="outlined" class="mr-1 mb-1" @click="startPick('move', o)">{{ __("Move Table") }}</v-btn>
              <v-btn size="small" variant="outlined" class="mr-1 mb-1" @click="startPick('merge', o)">{{ __("Merge Table") }}</v-btn>
              <v-btn size="small" variant="outlined" class="mr-1 mb-1" @click="handover.order = o">{{ __("Hand Over") }}</v-btn>
            </div>
            <div v-if="handover.order === o" class="mt-1">
              <v-select
                v-model="handover.user"
                :items="staff"
                item-title="full_name"
                item-value="user"
                :label="__('Waiter')"
                variant="outlined"
                density="compact"
                hide-details
              ></v-select>
              <v-btn size="small" color="primary" class="mt-1" :disabled="!handover.user" @click="doHandover(o)">{{ __("Hand Over") }}</v-btn>
            </div>
          </div>
        </div>
      </div>
    </v-card>
  </v-dialog>
</template>

<script>
import { errorText } from "./mixin.js";

const STATES = {
  Available: { color: "#43a047", label: "Free" },
  Seated: { color: "#1e88e5", label: "Seated" },
  Ordered: { color: "#8e24aa", label: "Ordered" },
  Waiting: { color: "#fb8c00", label: "Course waiting" },
  Bill: { color: "#e53935", label: "Bill requested" },
  Cleaning: { color: "#6d4c41", label: "Cleaning" },
  Reserved: { color: "#00897b", label: "Reserved" },
  Disabled: { color: "#9e9e9e", label: "Disabled" },
};

export default {
  name: "FloorPlanDialog",
  data() {
    return {
      open: false, loading: false, error: "", data: { tables: [], zones: [], staff: [], now: null },
      zone: null, selected: null, pick: null, handover: { order: null, user: null },
      api: null, resolve: null, timer: null,
      showBookings: false, bk: { bookings: [], waitlist: [], now: null },
      form: { is_waitlist: 0, guest_name: "", phone: "", party_size: 2, time: "", quoted_wait_minutes: null, service_table: null, notes: "" },
    };
  },
  computed: {
    zoneList() {
      return [null, ...(this.data.zones || [])];
    },
    shownTables() {
      return (this.data.tables || []).filter((t) => !this.zone || t.service_zone === this.zone);
    },
    positioned() {
      return this.shownTables.some((t) => Number(t.layout_width) > 0 && Number(t.layout_height) > 0);
    },
    tableNames() {
      return (this.data.tables || []).filter((t) => t.state !== "Disabled").map((t) => t.name);
    },
    staff() {
      return this.data.staff || [];
    },
    legend() {
      return Object.entries(STATES)
        .filter(([k]) => k !== "Disabled")
        .map(([state, s]) => ({ state, color: s.color, label: __(s.label) }));
    },
    scale() {
      // positions as % when every table fits in 0..100, else as pixels fitted to the room
      const ts = this.shownTables.filter((t) => Number(t.layout_width) > 0);
      const maxX = Math.max(1, ...ts.map((t) => Number(t.layout_x) + Number(t.layout_width)));
      const maxY = Math.max(1, ...ts.map((t) => Number(t.layout_y) + Number(t.layout_height)));
      return { percent: maxX <= 100 && maxY <= 100, maxX, maxY };
    },
  },
  methods: {
    // api: { load(), moveTable(inv, table), merge(into, from), handover(inv, user), setStatus(table, st) }
    show(api) {
      this.api = api;
      this.open = true;
      this.selected = null;
      this.pick = null;
      this.error = "";
      this.showBookings = false;
      this.reload();
      clearInterval(this.timer);
      this.timer = setInterval(() => this.open && !this.loading && this.reload(), 20000);
      return new Promise((resolve) => (this.resolve = resolve));
    },
    close(result) {
      this.open = false;
      clearInterval(this.timer);
      const r = this.resolve;
      this.resolve = null;
      if (r) r(result);
    },
    async reload() {
      this.loading = true;
      try {
        this.data = (await this.api.load()) || this.data;
        if (this.showBookings) await this.loadBookings();
        if (this.selected) this.selected = this.data.tables.find((t) => t.name === this.selected.name) || null;
      } catch (e) {
        this.error = errorText(e);
      } finally {
        this.loading = false;
      }
    },
    color(state) {
      return (STATES[state] || STATES.Available).color;
    },
    stateLabel(state) {
      return __((STATES[state] || { label: state }).label);
    },
    tableStyle(t) {
      const st = { background: this.color(t.state) };
      if (!this.positioned || !(Number(t.layout_width) > 0)) return st;
      const s = this.scale;
      const u = s.percent ? (v) => v + "%" : null;
      if (u) {
        return { ...st, position: "absolute", left: u(t.layout_x), top: u(t.layout_y), width: u(t.layout_width), height: u(t.layout_height) };
      }
      return {
        ...st, position: "absolute",
        left: (100 * t.layout_x) / s.maxX + "%", top: (100 * t.layout_y) / s.maxY + "%",
        width: (100 * t.layout_width) / s.maxX + "%", height: (100 * t.layout_height) / s.maxY + "%",
      };
    },
    guests(t) {
      return t.orders.reduce((a, o) => a + (Number(o.covers) || 0), 0);
    },
    minutes(t) {
      const since = t.orders.length ? t.orders[0].since : null;
      if (!since || !this.data.now) return 0;
      const ms = new Date(String(this.data.now).replace(" ", "T")) - new Date(String(since).replace(" ", "T"));
      return Math.max(0, Math.round(ms / 60000));
    },
    money(v, cur) {
      try {
        return format_currency(v, cur);
      } catch (e) {
        return v;
      }
    },
    startPick(kind, order) {
      this.pick = {
        kind,
        order,
        label: kind === "move" ? __("Tap the free table to move {0} to", [order.name]) : __("Tap the table to merge into {0}", [order.name]),
      };
    },
    // ------------------------------------------------------------ bookings
    async toggleBookings() {
      this.showBookings = !this.showBookings;
      if (this.showBookings) await this.loadBookings();
    },
    async loadBookings() {
      try {
        this.bk = (await this.api.bookings()) || this.bk;
      } catch (e) {
        this.error = errorText(e);
      }
    },
    hhmm(v) {
      return String(v || "").slice(11, 16);
    },
    waited(w) {
      const now = this.bk.now || this.data.now;
      if (!now || !w.creation) return 0;
      return Math.max(0, Math.round((new Date(String(now).replace(" ", "T")) - new Date(String(w.creation).replace(" ", "T"))) / 60000));
    },
    seat(b) {
      if (b.service_table && !b.is_waitlist) return this.close({ action: "seat", table: b.service_table, booking: b.name });
      this.showBookings = false;
      this.pick = { kind: "seat", booking: b, label: __("Tap the table for {0} ({1} guests)", [b.guest_name, b.party_size]) };
    },
    async bookingStatus(b, status) {
      this.error = "";
      try {
        await this.api.bookingStatus(b.name, status);
        await this.reload();
        await this.loadBookings();
      } catch (e) {
        this.error = errorText(e);
      }
    },
    async addBooking() {
      this.error = "";
      const f = this.form;
      const day = String(this.data.now || "").slice(0, 10);
      const data = {
        guest_name: f.guest_name, phone: f.phone, party_size: f.party_size, notes: f.notes, is_waitlist: f.is_waitlist ? 1 : 0,
      };
      if (f.is_waitlist) data.quoted_wait_minutes = f.quoted_wait_minutes || 0;
      else Object.assign(data, { reservation_start: day + " " + f.time + ":00", service_table: f.service_table || null });
      try {
        await this.api.saveBooking(data);
        this.form = { is_waitlist: f.is_waitlist, guest_name: "", phone: "", party_size: 2, time: "", quoted_wait_minutes: null, service_table: null, notes: "" };
        await this.reload();
        await this.loadBookings();
      } catch (e) {
        this.error = errorText(e);
      }
    },
    async tap(t) {
      if (this.pick && this.pick.kind === "seat") {
        const b = this.pick.booking;
        this.pick = null;
        if (t.orders.length || t.state === "Disabled") {
          this.error = __("Table {0} is not free", [t.name]);
          return;
        }
        return this.close({ action: "seat", table: t.name, booking: b.name });
      }
      if (!this.pick) {
        this.selected = t;
        this.handover = { order: null, user: null };
        return;
      }
      const { kind, order } = this.pick;
      this.pick = null;
      this.error = "";
      try {
        if (kind === "move") {
          await this.api.moveTable(order.name, t.name);
        } else {
          const from = t.orders[0];
          if (!from || from.name === order.name) throw new Error(__("Choose a table with another order"));
          await this.api.merge(order.name, from.name);
        }
        await this.reload();
      } catch (e) {
        this.error = errorText(e);
      }
    },
    async doHandover(o) {
      this.error = "";
      try {
        await this.api.handover(o.name, this.handover.user);
        this.handover = { order: null, user: null };
        await this.reload();
      } catch (e) {
        this.error = errorText(e);
      }
    },
    async setStatus(st) {
      this.error = "";
      try {
        await this.api.setStatus(this.selected.name, st);
        await this.reload();
      } catch (e) {
        this.error = errorText(e);
      }
    },
  },
  beforeUnmount() {
    clearInterval(this.timer);
  },
};
</script>

<style scoped>
.fd-floor-body {
  height: calc(100vh - 130px);
}
.fd-room {
  position: relative;
  flex: 1;
  margin: 8px;
  border: 1px dashed rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  background: #fafafa;
  overflow: auto;
}
.fd-room--grid {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 12px;
  padding: 12px;
}
.fd-room--grid .fd-table {
  width: 120px;
  height: 100px;
}
.fd-table {
  color: #fff;
  border-radius: 10px;
  padding: 6px;
  cursor: pointer;
  text-align: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  min-width: 70px;
  min-height: 60px;
}
.fd-circle {
  border-radius: 50%;
}
.fd-table--sel {
  outline: 4px solid #212121;
}
.fd-table-name {
  font-weight: 800;
  font-size: 16px;
}
.fd-table-state,
.fd-table-info {
  font-size: 11px;
}
.fd-table-info span {
  margin: 0 3px;
}
.fd-side {
  width: 320px;
  border-left: 1px solid rgba(0, 0, 0, 0.1);
  overflow: auto;
}
.fd-order {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 6px;
}
.fd-legend {
  font-size: 12px;
}
.fd-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 4px;
}
.fd-bookings {
  width: 360px;
}
.fd-pick {
  color: #e65100;
}
</style>
