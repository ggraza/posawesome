<template>
  <v-row justify="center">
    <v-dialog v-model="draftsDialog" max-width="900px">
      <!-- <template v-slot:activator="{ on, attrs }">
        <v-btn color="primary" dark v-bind="attrs" v-on="on">Open Dialog</v-btn>
      </template>-->
      <v-card>
        <v-card-title>
          <span class="headline primary--text">{{
            __('Select Hold Invoice')
          }}</span>
        </v-card-title>
        <v-card-text class="pa-0">
          <v-container>
            <v-row no-gutters>
              <v-col cols="12" class="pa-1">
                <template>
                  <v-data-table
                    ref="myDataTable1"
                    :headers="headers"
                    :items="dialog_data"
                    item-key="name"
                    class="elevation-1"
                    :single-select="singleSelect"
                    show-select
                    v-model="selected"
                    @click:row="onRowClick"
                  >
                    <template v-slot:item.posting_time="{ item }">
                      {{ item.posting_time.split('.')[0] }}
                    </template>
                    <template v-slot:item.grand_total="{ item }">
                      {{ currencySymbol(item.currency) }}
                      {{ formtCurrency(item.grand_total) }}
                    </template>
                  </v-data-table>
                </template>
              </v-col>
            </v-row>
          </v-container>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="error" dark @click="close_dialog">Close</v-btn>
          <v-btn color="success" dark @click="submit_dialog">Select</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-row>
</template>

<script>
import { evntBus } from '../../bus';
import format from '../../format';
export default {
  // props: ["draftsDialog"],
  mixins: [format],
  data: () => ({
    draftsDialog: false,
    singleSelect: true,
    selected: [],
    dialog_data: {},
    headers: [
      {
        text: __('Customer'),
        value: 'customer_name',
        align: 'start',
        sortable: true,
      },
      {
        text: __('Date'),
        align: 'start',
        sortable: true,
        value: 'posting_date',
      },
      {
        text: __('Time'),
        align: 'start',
        sortable: true,
        value: 'posting_time',
      },
      {
        text: __('Invoice'),
        value: 'name',
        align: 'start',
        sortable: true,
      },
      {
        text: __('Amount'),
        value: 'grand_total',
        align: 'end',
        sortable: false,
      },
    ],
  }),
  mounted() {
    this.$nextTick(() => {
      const table = this.$refs.myDataTable1?.$el;
      if (!table) {
        return;
      }
      const tableRows = table.querySelectorAll('tbody > tr');
      if (tableRows.length > 0) {
        console.log("Focusing on the first row:", tableRows[0]);
        tableRows[0].focus();
      } else {
        console.error("No rows found in the table.");
      }
    });
  },
  watch: {
    dialog_data: {
      deep: true,
      handler(newVal, oldVal) {
        this.$nextTick(() => {
          const table = this.$refs.myDataTable1.$el;
          if (!table) return;
          const tableRows = table.querySelectorAll('tbody > tr');
          tableRows.forEach((row, index) => {
            row.setAttribute('tabindex', '0');
            row.addEventListener('keyup', (event) => {
              if (event.key === 'ArrowDown') {
                this.handleRowNavigation(event, index, tableRows, 'down');
              } else if (event.key === 'ArrowUp') {
                this.handleRowNavigation(event, index, tableRows, 'up');
              } else if (event.key === 'Enter') {
                this.handleEnterKeyPress(event, index, newVal);
              }
            });
          });
        });
      },
    },
  },
  methods: {
    get_draft_invoices() {
      const vm = this;
      frappe.call({
        method: 'posawesome.posawesome.api.posapp.get_draft_invoices',
        args: {
          pos_opening_shift: this.pos_opening_shift.name,
        },
        async: false,
        callback: function (r) {
          if (r.message) {
            evntBus.$emit('open_hold', r.message);
          }
        },
      });
    },
    focusFirstRow() {
      this.$nextTick(() => {
        const table = this.$refs.myDataTable1?.$el;
        if (!table) {
          console.error("Table element not found.");
          return;
        }
        const tableRows = table.querySelectorAll('tbody > tr');
        if (tableRows.length > 0) {
          console.log("Focusing on the first row:", tableRows[0]);
          tableRows[0].focus();
        } else {
          console.error("No rows found in the table.");
        }
      });
    },
    handleRowNavigation(event, index, tableRows, direction) {
      if (direction === 'down' && index < tableRows.length - 1) {
        tableRows[index + 1].focus();
      } else if (direction === 'up' && index > 0) {
        tableRows[index - 1].focus();
      }
    },

    handleEnterKeyPress(event, index, new_value) {
      const item = new_value[index];
      this.selected = [item];
      this.submit_dialog();
      if (this.$root) {
        this.$root.$emit('escEventTriggered');
      }
    },

    close_dialog() {
      this.draftsDialog = false;
    },

    submit_dialog() {
      if (this.selected.length > 0) {
        evntBus.$emit('load_invoice', this.selected[0]);
        this.draftsDialog = false;
      }
    },
    onRowClick(item) {
      // Handle the click event on the row here
      this.selected = [item];
      this.submit_dialog(); // Call the submit_dialog method when the row is clicked
            if (this.$root) {
                this.$root.$emit('escEventTriggered');
            }
    },
  },
  created: function () {
    evntBus.$on('open_drafts', (data) => {
      this.draftsDialog = true;
      this.dialog_data = data;
      this.focusFirstRow();
      this.get_draft_invoices();
    });
  },
};
</script>