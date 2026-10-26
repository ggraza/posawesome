<template>
  <v-date-picker
    v-bind="$attrs"
    :model-value="dateValue"
    :min="min || undefined"
    :max="max || undefined"
    :hide-header="hideHeader"
    :color="color"
    @update:model-value="onPick"
  >
    <template v-if="$slots.default" #actions>
      <slot />
    </template>
  </v-date-picker>
</template>

<script>
// Vuetify 3's v-date-picker works with Date objects; the POS code (and Frappe)
// work with "YYYY-MM-DD" strings. This keeps the Vuetify 2 string contract.
function toYMD(d) {
  if (!d) return null;
  if (typeof d === "string") return d.slice(0, 10);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fromYMD(s) {
  if (!s) return null;
  if (s instanceof Date) return s;
  const [y, m, d] = String(s).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export default {
  name: "PosDatePicker",
  inheritAttrs: false,
  props: {
    modelValue: { type: [String, Date], default: null },
    min: { type: String, default: null },
    max: { type: String, default: null },
    color: { type: String, default: "primary" },
    hideHeader: { type: Boolean, default: true },
  },
  emits: ["update:modelValue", "input", "change"],
  computed: {
    dateValue() {
      return fromYMD(this.modelValue);
    },
  },
  methods: {
    onPick(value) {
      const ymd = toYMD(Array.isArray(value) ? value[0] : value);
      this.$emit("update:modelValue", ymd);
      this.$emit("input", ymd);
      this.$emit("change", ymd);
    },
  },
};
</script>
