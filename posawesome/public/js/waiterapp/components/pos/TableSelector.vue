<template>
  <div>
    <v-card
      class="selection mx-auto bg-grey-lighten-5"
      style="max-height:80vh;height:80vh"
    >
<v-row
    class="items pb-0 pr-0 pt-2 px-3 mb-1"
    style="overflow-x:auto;white-space:nowrap;"
>
    <v-col
        v-for="type in order_type"
        :key="type.name"
        cols="auto"
        class="px-0 py-1"
    >
        <v-chip
            class="ma-1 font-weight-bold"
            :color="selcted_order_type==type.name ? 'primary' : ''"
            :variant="(selcted_order_type!=type.name) ? 'outlined' : 'flat'"
            @click="selectOrderType(type)"
        >
            {{ type.name }}
        </v-chip>
    </v-col>
</v-row>

<v-divider class="mb-1"></v-divider>
        <v-card-title v-if="!showTableSelection">
          <span class="text-h6 text-primary">
            {{ __("Select Order Type First") }}
          </span>
        </v-card-title>
      <div class="pa-4 overflow-y-auto" style="max-height:72vh">
        <!-- Service Zones -->
        <div v-if="showTableSelection" class="mb-5">
          <h3 class="mb-2">{{ __("Service Zone") }}</h3>
          <v-chip
            v-for="zone in service_zone"
            :key="zone.name"
            class="ma-2"
            :color="selectedZone==zone.name?'primary':''"
            :variant="(selectedZone!=zone.name) ? 'outlined' : 'flat'"
            @click="selectedZone=zone.name"
          >
            {{ zone.name }}
          </v-chip>
        </div>
        <v-divider v-if="showTableSelection" class="mb-1"></v-divider>
        <!-- Tables -->
        <v-card-title v-if="showTableSelection">
          <span class="text-h6 text-primary">
            {{ __("Select Table") }}
          </span>
        </v-card-title>
        <v-row v-if="showTableSelection">
          <v-col
            cols="4"
            sm="3"
            md="2"
            v-for="table in filteredTables"
            :key="table.name"
          >
            <v-card
              class="table-card"
              :color="tableColor(table)"
              :class="{
                'table-selected':
                  selectedTable==table.name
              }"
              @click="!(table.status === 'occupied' && !is_take_away) && selectTable(table)"
            >
              <v-card-text class="text-center">
                <v-icon
                  size="large"
                  :color="statusColor(table.status)"
                >
                  {{ tableIcon(table) }}
                </v-icon>
                <div class="text-h6">
                  {{ table.name }}
                </div>
                <div>
                  {{ __("Seats") }}
                  {{ table.no_of_seats }}
                </div>
                <v-chip
                  size="small"
                  :color="statusColor(table.status)"
                >
                  {{ table.status }}
                </v-chip>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </div>
    </v-card>
    <v-card
      flat
      class="mt-3"
      style="height:11vh"
    >
      <v-row no-gutters>
        <v-col cols="6">
          <v-btn
            block
            size="large"
            color="warning"
            @click="back_to_invoice"
          >
            {{ __("Back") }}
          </v-btn>
        </v-col>
        <v-col cols="6">
          <v-btn
            block
            size="large"
            color="primary"
            :disabled="currentOrderType && currentOrderType.is_table_required && !selectedTable"
            @click="confirmTableSelection"
          >
            {{ __("Confirm") }}
          </v-btn>
        </v-col>
      </v-row>
    </v-card>
  </div>
</template>

<script>
import { evntBus } from "../../bus";
export default {
  data() {
    return {
      pos_profile: {},
      invoice_doc: {},

      order_type: [],
      selcted_order_type: null,

      service_zone: [],
      service_table: [],
      selectedZone: null,
      selectedTable: null,
      selcted_service_zone: null,
      selcted_service_table: "",
    };
  },
  computed: {
    //currentOrderType() {
    //    return this.order_type.find(
    //        d => d.name === this.selcted_order_type
    //    ) || null;
    //},
    currentOrderType() {
        return (
            this.order_type.find(
                d => d.name === this.selcted_order_type
            ) || null
        );
    },
    showTableSelection() {
        return (
            this.currentOrderType &&
            this.currentOrderType.is_table_required
        );
    },
    filteredTables() {
      if (!this.selectedZone) return [];
      const statusOrder = {
        Available:1,
        Reserved:2,
        Cleaning:3,
        Occupied:4,
        Disabled:5
      };
      return this.service_table
      .filter(i=>i.service_zone==this.selectedZone)
      .sort((a,b)=>{
        const s=
        (statusOrder[a.status]||99)
        -
        (statusOrder[b.status]||99);
        if(s!=0) return s;
        return a.name.localeCompare(
          b.name,
          undefined,
          {
            numeric:true,
            sensitivity:"base"
          }
        );
      });
    }
  },

  methods: {
    back_to_invoice() {
      evntBus.$emit("show_table",false);
    },
    loadOrderTypes() {
        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Order Type",
                fields: [
                   "name",
                    "is_table_required",
                    "is_delivery",
                    "is_take_away"
                ],
                order_by: "creation asc"
            },
            callback: (r) => {
                if (!r.message) return;
                this.order_type = r.message.map(d => ({
                    name: d.name,
                    value: d.name,
                    is_table_required: d.is_table_required,
                    is_delivery: d.is_delivery,
                    is_take_away: d.is_take_away
                }));
            }
        });
    },
    selectOrderType(type) {
        this.selcted_order_type = type.name;

        if (this.invoice_doc) {
            this.invoice_doc.posa_order_type = type.name;
        }

        // Dine In
        if (type.is_table_required) {
            if (!this.selectedZone && this.service_zone.length) {
                this.selectedZone = this.service_zone[0].name;
            }
        }

        // Take Away / Delivery
        this.selectedZone = null;
        this.selectedTable = null;
        this.selcted_service_zone = "";
        this.selcted_service_table = "";
        if (this.invoice_doc) {
            this.invoice_doc.posa_service_zone = "";
            this.invoice_doc.posa_service_table = "";
        }
    },
    loadServiceTables() {
      frappe.call({
        method:"frappe.client.get_list",
        args:{
          doctype:"Service Table",
          fields:[
            "name",
            "service_zone",
            "status",
            "no_of_seats",
            "table_shape",
            "occupied",
            "is_take_away"
          ],
          filters:{
            company:this.pos_profile.company
          },
          order_by:"service_zone asc,name asc"
        },
        callback:r=>{
          if(!r.message) return;
          this.service_table=r.message;
        }
      });
    },
    selectTable(table){
      // if(table.status=="Occupied"){
      if (table.status?.toLowerCase() === "occupied" && !table.is_take_away) {
        frappe.show_alert({
          message:__("Table already occupied"),
          indicator:"red"
        });
        return;
      }
      if(table.status=="Disabled"){
        frappe.show_alert({
          message:__("Table Disabled"),
          indicator:"red"
        });
        return;
      }
      this.selectedTable=table.name;
    },
    confirmTableSelection(){
      if (!this.currentOrderType || !this.currentOrderType.is_table_required) {
        evntBus.$emit("table_selected", {
          order_type: this.selcted_order_type,
          service_zone: "",
          service_table: ""
        });
        console.log("Selected OrderType", table);
        evntBus.$emit("show_table", false);
        return;
      }
      const table=this.service_table.find(
        d=>d.name==this.selectedTable
      );
      if(!table) return;
      console.log("Selected Table", table);
      // this.selcted_service_zone=table.service_zone;
      // this.selcted_service_table=table.name;
      // this.invoice_doc.posa_service_zone=table.service_zone;
      // this.invoice_doc.posa_service_table=table.name;
      evntBus.$emit("table_selected", {
          order_type: this.selcted_order_type,
          service_zone:table.service_zone,
          service_table:table.name
        }
      );
      evntBus.$emit("show_table",false);
    },
    tableColor(table){
      switch(table.status){
        case "Available":
          return "#E8F5E9";
        case "Occupied":
          return "#FFEBEE";
        case "Reserved":
          return "#FFF3E0";
        case "Cleaning":
          return "#E3F2FD";
        case "Disabled":
          return "#EEEEEE";
        default:
          return "white";
      }
    },
    statusColor(status){
      switch(status){
        case "Available":
          return "green";
        case "Occupied":
          return "red";
        case "Reserved":
          return "orange";
        case "Cleaning":
          return "blue";
        case "Disabled":
          return "grey";
        default:
          return "primary";
      }
    },
    tableIcon(table){
      switch(table.status){
        case "Available":
          return "mdi-check-circle";
        case "Occupied":
          return "mdi-account-group";
        case "Reserved":
          return "mdi-calendar-clock";
        case "Cleaning":
          return "mdi-broom";
        case "Disabled":
          return "mdi-lock";
        default:
          return "mdi-table-furniture";
      }
    }
  },
  watch: {
    pos_profile:{
      immediate:true,
      deep:true,
      handler(profile){
        if(profile?.pos_service_zone?.length){
          this.service_zone=
          profile.pos_service_zone.map(row=>({
            name:row.service_zone,
            value:row.service_zone
          }));
          if(!this.selectedZone){
            this.selectedZone=this.service_zone[0].name;
          }
        }
      }
    },
    selectedZone(){
      this.selectedTable=null;
    },
    selcted_service_zone(val) {
      if (this.invoice_doc) {
        this.invoice_doc.posa_service_zone = val;
      }
    },
    selcted_service_table(val) {
      if (this.invoice_doc) {
        this.invoice_doc.posa_service_table = val;
      }
    },
    selcted_order_type(val) {
      if (!this.invoice_doc) return;
      this.invoice_doc.posa_order_type = val;
    },
  },
  created(){
    evntBus.$on("register_pos_profile",(data)=>{
      this.pos_profile=data.pos_profile;
      this.invoice_doc=data.invoice_doc;
      this.loadOrderTypes();
      this.loadServiceTables();
    });
  }
};
</script>
<style scoped>
.table-card{
  cursor:pointer;
  transition:.25s;
}
.table-card:hover{
  transform:scale(1.04);
}
.table-selected{
  border:3px solid #1976d2;
}
</style>
