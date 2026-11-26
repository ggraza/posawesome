<template>
  <div class="fd-row">
    <div class="fd-name">
      <span v-if="row.posa_parent_row_id" class="fd-addon">+ </span>{{ row.item_name }}
      <span v-if="Number(row.posa_comp)" class="fd-comp">{{ __("COMP") }}</span>
    </div>
    <div v-if="row.posa_modifiers" class="fd-mods">{{ row.posa_modifiers }}</div>
    <div v-if="allergen" class="fd-allergen">{{ __("Allergy: {0}", [allergen]) }}</div>
    <div class="fd-chips" @click.stop>
      <!-- seat -->
      <v-menu v-if="settings.seats && !row.posa_parent_row_id" location="bottom">
        <template v-slot:activator="{ props }">
          <v-chip v-bind="props" size="x-small" variant="outlined" class="mr-1" prepend-icon="mdi-seat">
            {{ Number(row.posa_seat) ? row.posa_seat : __("All") }}
          </v-chip>
        </template>
        <v-list density="compact">
          <v-list-item :title="__('Shared (all)')" @click="$emit('seat', 0)"></v-list-item>
          <v-list-item v-for="n in seatCount" :key="n" :title="__('Seat {0}', [n])" @click="$emit('seat', n)"></v-list-item>
        </v-list>
      </v-menu>

      <!-- course + hold / fire -->
      <v-menu v-if="settings.courses && !row.posa_parent_row_id" location="bottom" :disabled="sent > 0">
        <template v-slot:activator="{ props }">
          <v-chip
            v-bind="props"
            size="x-small"
            class="mr-1"
            :color="row.posa_course ? courseColor : undefined"
            :variant="row.posa_course ? 'flat' : 'outlined'"
          >
            {{ row.posa_course || __("No course") }}
          </v-chip>
        </template>
        <v-list density="compact">
          <v-list-item :title="__('No course')" @click="$emit('course', null)"></v-list-item>
          <v-list-item v-for="c in courses" :key="c.name" :title="c.name" @click="$emit('course', c.name)"></v-list-item>
        </v-list>
      </v-menu>
      <v-chip
        v-if="settings.courses && row.posa_course && !row.posa_parent_row_id && sent <= 0"
        size="x-small"
        class="mr-1"
        :color="row.posa_course_status === 'Hold' ? 'grey' : 'deep-orange'"
        variant="flat"
        :prepend-icon="row.posa_course_status === 'Hold' ? 'mdi-pause' : 'mdi-fire'"
        :title="row.posa_course_status === 'Hold' ? __('Waits for Fire') : __('Goes with the next send')"
        @click="$emit('hold')"
      >
        {{ row.posa_course_status === "Hold" ? __("Hold") : __("Fire") }}
      </v-chip>

      <v-chip v-if="sent > 0" size="x-small" color="success" variant="flat" class="mr-1" prepend-icon="mdi-chef-hat">
        {{ sent >= Number(row.qty) ? __("Sent") : __("Sent {0}", [sent]) }}
      </v-chip>

      <v-chip
        v-if="settings.modifiers && hasModifiers && !row.posa_parent_row_id && sent <= 0"
        size="x-small"
        variant="outlined"
        class="mr-1"
        prepend-icon="mdi-tune-variant"
        @click="$emit('modifiers')"
        >{{ __("Options") }}</v-chip
      >

      <v-chip
        v-if="settings.void_control && !row.posa_is_offer && !row.posa_is_replace"
        size="x-small"
        :variant="Number(row.posa_comp) ? 'flat' : 'outlined'"
        :color="Number(row.posa_comp) ? 'warning' : undefined"
        class="mr-1"
        prepend-icon="mdi-gift-outline"
        :title="Number(row.posa_comp) ? __('Charge this item again') : __('Make this item free (comp)')"
        @click="$emit('comp')"
        >{{ Number(row.posa_comp) ? __("Comp") : __("Comp?") }}</v-chip
      >
    </div>
  </div>
</template>

<script>
export default {
  name: "FdRowChips",
  props: {
    row: { type: Object, required: true },
    settings: { type: Object, default: () => ({}) },
    courses: { type: Array, default: () => [] },
    seatCount: { type: Number, default: 2 },
    sent: { type: Number, default: 0 },
    hasModifiers: { type: Boolean, default: false },
    allergen: { type: String, default: "" },
  },
  emits: ["seat", "course", "hold", "modifiers", "comp"],
  computed: {
    courseColor() {
      const c = this.courses.find((x) => x.name === this.row.posa_course);
      return (c && c.color) || "blue-grey";
    },
  },
};
</script>

<style scoped>
.fd-row {
  line-height: 1.25;
  padding: 2px 0;
}
.fd-mods {
  font-size: 11px;
  opacity: 0.8;
  font-style: italic;
}
.fd-allergen {
  font-size: 11px;
  font-weight: 700;
  color: #c62828;
}
.fd-addon {
  opacity: 0.7;
}
.fd-comp {
  font-size: 10px;
  font-weight: 700;
  color: #e65100;
  margin-left: 4px;
}
.fd-chips {
  display: flex;
  flex-wrap: wrap;
  margin-top: 2px;
}
</style>
