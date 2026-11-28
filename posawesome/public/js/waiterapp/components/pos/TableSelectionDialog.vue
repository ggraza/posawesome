<template>
  <v-dialog
    v-model="dialog"
    persistent
    fullscreen
    transition="dialog-bottom-transition"
  >
    <v-card class="bg-grey-lighten-4 fill-height">
      <!-- Toolbar -->
      <v-toolbar color="primary" flat>
        <v-toolbar-title>Select Table</v-toolbar-title>
        <v-spacer></v-spacer>
        <div
          v-if="selectedTableObject"
          class="mr-4 text-subtitle-1 font-weight-bold"
        >
          {{ selectedTableObject.name }}
        </div>
        <v-btn icon @click="closeDialog">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-toolbar>
      <!-- Content -->
      <v-card-text class="pa-6">
        <!-- Zone Selection -->
        <div class="text-h6 font-weight-bold mb-4">
          Service Zone
        </div>
        <v-row dense>
          <v-col
            cols="6"
            sm="4"
            md="3"
            lg="2"
            v-for="zone in serviceZones"
            :key="zone.name"
          >
            <v-btn
              block
              size="large"
              height="70"
              :color="selectedZone == zone.name ? 'primary' : ''"
              :variant="(selectedZone != zone.name) ? 'outlined' : 'elevated'"
              @click="selectZone(zone)"
            >
              {{ zone.name }}
            </v-btn>
          </v-col>
        </v-row>
        <v-divider class="my-6"></v-divider>
        <!-- Tables -->
        <div class="text-h6 font-weight-bold mb-4">
          Tables
        </div>
        <v-row dense>
          <v-col
            v-for="table in filteredTables"
            :key="table.name"
            cols="6"
            sm="4"
            md="3"
            lg="2"
          >
            <v-card
              class="table-card"
              :class="{
                selected: selectedTable == table.name
              }"
              variant="outlined"
              elevation="3"
              @click="selectTable(table)"
            >
              <v-card-text class="text-center">
                <v-icon
                  size="42"
                  :color="statusColor(table.status)"
                >
                  {{ tableIcon(table.status) }}
                </v-icon>
                <div class="title font-weight-bold mt-2">
                  {{ table.name }}
                </div>
                <div class="text-caption text-grey">
                  Seats {{ table.no_of_seats }}
                </div>
                <v-chip
                  size="small"
                  class="mt-2"
                  :color="statusColor(table.status)"
                >
                  {{ table.status }}
                </v-chip>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-card-text>
      <!-- Footer -->
      <v-divider></v-divider>
      <v-card-actions class="pa-4">
        <v-btn
          size="large"
          variant="text"
          @click="closeDialog"
        >
          Cancel
        </v-btn>
        <v-spacer></v-spacer>
        <v-btn
          color="primary"
          size="large"
          :disabled="!selectedTable"
          @click="confirmSelection"
        >
          Confirm Table
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
export default {
  name: "TableSelectionDialog",
  emits: ["update:modelValue"],
  props: {
    modelValue: {
      type: Boolean,
      default: false
    },
    serviceZones: {
      type: Array,
      default: () => []
    },
    tables: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      dialog: false,
      selectedZone: null,
      selectedTable: null
    };
  },

  watch: {
    modelValue: {
      immediate: true,
      handler(val) {
        this.dialog = val;
      }
    },
    dialog(val) {
      this.$emit("update:modelValue", val);
    }
  },

  computed: {
    filteredTables() {
      if (!this.selectedZone)
        return [];
      return this.tables.filter(table =>
        table.service_zone == this.selectedZone
      );
    },
    selectedTableObject() {
      return this.tables.find(
        t => t.name == this.selectedTable
      );
    }
  },

  methods: {
    back_to_invoice() {
      evntBus.$emit('show_table', 'false');
      const view = this.pos_profile.posa_default_card_view ? 'card' : 'list';
      evntBus.$emit('set_items_view', view);
    },
    selectZone(zone) {
      this.selectedZone = zone.name;
      this.selectedTable = null;
    },

    selectTable(table) {
      this.selectedTable = table.name;
    },

    confirmSelection() {
      this.$emit("selected", {
        zone: this.selectedZone,
        table: this.selectedTable,
        tableDoc: this.selectedTableObject
      });
      this.dialog = false;
    },

    closeDialog() {
      this.dialog = false;
    },

    statusColor(status) {
      switch (status) {
        case "Occupied":
          return "red";
        case "Reserved":
          return "orange";
        case "Cleaning":
          return "deep-orange";
        default:
          return "green";
      }
    },

    tableIcon(status) {
      switch (status) {
        case "Occupied":
          return "mdi-table-chair";
        case "Reserved":
          return "mdi-clock-outline";
        case "Cleaning":
          return "mdi-broom";
        default:
          return "mdi-silverware-fork-knife";
      }
    }
  }
};
</script>

<style scoped>
.table-card{
    cursor:pointer;
    border-radius:16px;
    min-height:170px;
    transition:.25s;
}
.table-card:hover{
    transform:translateY(-4px);
}
.selected{
    border:3px solid #1976D2 !important;
    background:#E3F2FD;
}
</style>
