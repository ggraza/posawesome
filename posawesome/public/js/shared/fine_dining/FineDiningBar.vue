<template>
  <div class="fd-bar d-flex flex-wrap align-center px-2 py-1">
    <v-btn
      v-if="settings.floor_plan"
      size="small"
      color="primary"
      variant="elevated"
      class="mr-2 my-1 text-none"
      prepend-icon="mdi-floor-plan"
      @click="$emit('floor')"
      >{{ __("Floor") }}</v-btn
    >
    <v-chip
      v-if="settings.covers"
      class="mr-2 my-1"
      :color="covers > 0 ? 'primary' : 'error'"
      variant="flat"
      size="small"
      prepend-icon="mdi-account-group"
      @click="$emit('covers')"
    >
      {{ covers > 0 ? __("{0} guests", [covers]) : __("Guests?") }}
    </v-chip>

    <template v-if="settings.seats">
      <span class="text-caption mr-1">{{ __("Seat") }}</span>
      <v-btn-toggle
        :model-value="seat"
        @update:model-value="(v) => $emit('seat', v == null ? seat : v)"
        mandatory
        density="compact"
        divided
        variant="outlined"
        color="primary"
        class="mr-2 my-1 fd-seats"
      >
        <v-btn :value="0" size="small" :title="__('Shared by the table')">{{ __("All") }}</v-btn>
        <v-btn v-for="n in seatCount" :key="n" :value="n" size="small">{{ n }}</v-btn>
      </v-btn-toggle>
    </template>

    <v-chip
      v-if="guest"
      size="small"
      :color="guest.vip ? 'amber-darken-2' : 'blue-grey'"
      variant="flat"
      class="mr-2 my-1"
      :prepend-icon="guest.vip ? 'mdi-star' : 'mdi-account-heart-outline'"
      @click="$emit('guest')"
    >
      {{ guest.name }} &middot; {{ __("{0} visits", [guest.visits]) }}<span v-if="(guest.special_dates || []).length"> &middot; {{ guest.special_dates[0].label }}!</span>
    </v-chip>
    <v-btn
      v-if="settings.allergens"
      size="small"
      :color="allergies ? 'error' : undefined"
      :variant="allergies ? 'elevated' : 'outlined'"
      class="mr-2 my-1 text-none"
      prepend-icon="mdi-alert-octagon-outline"
      :title="allergies || __('Guest allergies')"
      @click="$emit('allergies')"
      >{{ allergies ? __("Allergy: {0}", [allergies]) : __("Allergies") }}</v-btn
    >
    <v-btn
      v-if="settings.eighty_six"
      size="small"
      :color="eightySix > 0 ? 'grey-darken-3' : undefined"
      :variant="eightySix > 0 ? 'elevated' : 'outlined'"
      class="mr-2 my-1 text-none"
      @click="$emit('eighty-six')"
      >86{{ eightySix > 0 ? " (" + eightySix + ")" : "" }}</v-btn
    >

    <v-spacer></v-spacer>

    <template v-if="settings.courses">
      <v-btn
        v-for="c in courses"
        :key="c.name"
        v-show="c.hold > 0"
        size="small"
        color="deep-orange"
        variant="elevated"
        class="ml-1 my-1 text-none"
        prepend-icon="mdi-fire"
        :loading="busy"
        @click="$emit('fire', c.name)"
      >
        {{ __("Fire {0}", [c.name]) }} ({{ c.hold }})
      </v-btn>
    </template>

    <v-chip v-if="settings.service_charge" size="small" variant="outlined" class="ml-1 my-1" prepend-icon="mdi-room-service-outline">
      {{ __("Service {0}%", [settings.service_charge]) }}
    </v-chip>
    <v-btn
      v-if="settings.tips"
      size="small"
      :color="tip > 0 ? 'success' : undefined"
      :variant="tip > 0 ? 'elevated' : 'outlined'"
      class="ml-1 my-1 text-none"
      prepend-icon="mdi-hand-coin-outline"
      @click="$emit('tip')"
      >{{ tip > 0 ? __("Tip {0}", [tip]) : __("Tip") }}</v-btn
    >
    <v-btn
      v-if="settings.split_bill"
      size="small"
      color="teal"
      variant="elevated"
      class="ml-1 my-1 text-none"
      prepend-icon="mdi-call-split"
      :loading="busy"
      @click="$emit('split')"
      >{{ __("Split") }}</v-btn
    >
    <v-btn
      v-if="settings.prebill"
      size="small"
      color="indigo"
      variant="elevated"
      class="ml-1 my-1 text-none"
      prepend-icon="mdi-receipt-text-outline"
      :loading="busy"
      @click="$emit('prebill')"
      >{{ __("Pre-Bill") }}</v-btn
    >
  </div>
</template>

<script>
export default {
  name: "FineDiningBar",
  props: {
    settings: { type: Object, default: () => ({}) },
    covers: { type: Number, default: 0 },
    seat: { type: Number, default: 1 },
    seatCount: { type: Number, default: 2 },
    courses: { type: Array, default: () => [] },
    busy: { type: Boolean, default: false },
    tip: { type: Number, default: 0 },
    allergies: { type: String, default: "" },
    eightySix: { type: Number, default: 0 },
    guest: { type: Object, default: null },
  },
  emits: ["covers", "seat", "fire", "prebill", "floor", "split", "tip", "allergies", "eighty-six", "guest"],
};
</script>

<style scoped>
.fd-bar {
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(0, 151, 167, 0.05);
  min-height: 40px;
}
.fd-seats .v-btn {
  min-width: 34px !important;
  padding: 0 6px !important;
}
</style>
