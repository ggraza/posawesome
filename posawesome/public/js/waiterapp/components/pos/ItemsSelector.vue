<template>
  <div>


<v-dialog v-model="itemDialog" max-width="450" persistent>
    <v-card>
        <v-toolbar density="compact" flat color="primary">
            <v-toolbar-title>{{ selectedItem ? selectedItem.item_name : '' }}</v-toolbar-title>
            <v-spacer></v-spacer>
            <v-btn icon @click="closeItemDialog" @keydown.enter="closeItemDialog" @keydown.esc="closeItemDialog">
                <v-icon>mdi-close</v-icon>
            </v-btn>
        </v-toolbar>

        <!-- <v-divider></v-divider> -->

        <v-card-text class="pa-4">
        </v-card-text>
            <div class="text-center mt-3">
                <h4>Quantity</h4>
                <v-row justify="center" align="center">
                  <v-col cols="auto">
                    <v-btn
                      icon
                      color="secondary"
                      @click="minusQty"
                    >
                      <v-icon>mdi-minus-circle-outline</v-icon>
                    </v-btn>
                  </v-col>
                  <v-col cols="auto">
                    <v-text-field
                        v-if="selectedItem"
                        v-model.number="selectedItem.qty"
                        density="compact"
                        variant="outlined"
                        hide-details
                        type="number"
                        step="0.001"
                        min="0"
                        class="mx-3"
                        style="max-width:120px"
                        @change="updateItemQty($event.target.value)"
                    ></v-text-field>
                  </v-col>
                  <v-col cols="auto">
                    <v-btn
                      icon
                      color="secondary"
                      @click="plusQty"
                    >
                      <v-icon>mdi-plus-circle-outline</v-icon>
                    </v-btn>
                  </v-col>

                </v-row>
            </div>

            <!-- Quick Notes -->
            <div v-if="selectedItem" class="mt-5" justify="center" align="center">
                <h4>Quick Notes</h4>
                <v-chip
                    v-for="note in quickNotes"
                    :key="note"
                    class="ma-1"
                    size="small"
                    color="primary"
                    variant="outlined"
                    @click="addQuickNote(note)"
                >
                    {{ note }}
                </v-chip>
            </div>

            <!-- Additional Notes -->
            <v-textarea
                v-if="selectedItem"
                v-model="selectedItem.posa_notes"
                class="mt-4"
                variant="outlined"
                density="compact"
                auto-grow
                rows="2"
                label="Additional Notes"
            ></v-textarea>
        <v-divider></v-divider>

        <v-card-actions>
            <v-btn color="error" variant="text" @click="closeItemDialog">
                <v-icon start>mdi-close</v-icon>
                Cancel
            </v-btn>
                  <v-col cols="auto">
                    <div class="qty-number">
                        {{ selectedItem ? formtFloat(selectedItem.qty) : "0" }}
                    </div>
                  </v-col>

            <v-spacer></v-spacer>
            <v-btn variant="text" @click="closeItemDialog" @keydown.enter="closeItemDialog">
                Cancel
            </v-btn>

            <v-btn color="primary" @click="saveItemChanges">
                Save
            </v-btn>
        </v-card-actions>
    </v-card>
</v-dialog>


    <v-card
      class="selection mx-auto mt-3"
      style="max-height: 75vh; height: 75vh"
      elevation="8"
    >
      <v-progress-linear
        :active="loading"
        :indeterminate="loading"
        absolute
        color="info" location="top"
      ></v-progress-linear>
      <v-row class="items px-2 py-1">
        <v-col class="pb-0 mb-2">
          <v-autocomplete
            density="compact"
            clearable
            autofocus
            variant="outlined"
            color="primary"
            v-model:search="debounce_search"
            item-title="item_name"
            item-value="item_code"
            :items="items"
            :label="frappe._('Search Items')"
            :custom-filter="(itemText, queryText, internal) => customFilter(internal.raw, queryText, itemText)"
            hint="Search by item code, serial number, batch no or barcode"
            bg-color="white"
            hide-details
            prepend-inner-icon="mdi-magnify"
            class="enhanced-field"
            :class="{ 'field-focused': debounce_search }"
            @keydown.esc="esc_event"
            @keydown.enter="search_onchange"
            ref="debounce_search"
          >
            <template v-slot:item="{ item, props }">
              <v-list-item v-bind="props" :title="null" @click="openItemDialog(item.raw)">
                <v-list-item-subtitle>
                  <span class="text-primary">{{ item.raw.item_name }}</span>
                  <br />
                  <span style="color: #486472">{{ __('#') }}: {{ item.raw.item_code }}</span> |
                  <span style="color: #ba0806"> {{ currencySymbol(item.raw.currency) }} {{ formtCurrency(item.raw.rate) }}</span> |
                  <span class="text-caption text-golden">{{ __('A-QTY') }}: {{ item.raw.actual_qty }}</span>
                  <br />
                  <!-- Display barcode information -->
                  <span v-for="barcode in item.raw.item_barcode" :key="barcode.barcode">
                    {{ __('UPC') }}: {{ barcode.barcode }} |
                    {{ __('UOM') }}: {{ item.raw.stock_uom }}
                  </span>
                </v-list-item-subtitle>
              </v-list-item>
            </template>
          </v-autocomplete>
        </v-col>
        <v-col cols="2" class="pb-0 mb-2" v-if="pos_profile.posa_new_line">
          <v-checkbox
            v-model="new_line"
            color="accent"
            value="true"
            label="NLine"
            density="compact"
            hide-details
            class="enhanced-checkbox"
          ></v-checkbox>
        </v-col>
        <v-col cols="12" class="pt-0 mt-0">
            <v-row no-gutters>
                <!-- LEFT CATEGORY PANEL -->
                <v-col
                    cols="2"
                    class="pa-0"
                    style="border-right:1px solid #e0e0e0;"
                >
          <v-btn-toggle
            v-model="items_view"
            density="compact"
            rounded
            class="enhanced-btn-toggle"
          >
            <v-btn size="small" value="list" class="toggle-btn">
              <v-icon start size="small">mdi-format-list-bulleted</v-icon>
              {{ __('List') }}
            </v-btn>
            <v-btn size="small" value="card" class="toggle-btn">
              <v-icon start size="small">mdi-view-grid</v-icon>
              {{ __('Card') }}
            </v-btn>
          </v-btn-toggle>
                    <div class="text-subtitle-2 font-weight-bold mb-2 text-center">
                        {{ __("Categories") }}
                    </div>
                    <div style="height:60vh;overflow-y:auto;">
                        <v-chip
                            v-for="group in items_group"
                            :key="group"
                            class="mb-2 justify-start"
                            :color="item_group==group ? 'primary' : ''"
                            :variant="(item_group!=group) ? 'outlined' : 'flat'"
                            @click="
                                item_group = group;
                                search_onchange();
                            "
                        >
                            {{ group }}
                        </v-chip>
                    </div>
                </v-col>
                <!-- ITEMS -->
                <v-col
                    :cols="10"
                    class="pl-2"
                >
                    <!-- CARD VIEW -->
                    <div fluid class="items" v-if="items_view == 'card'">
                        <v-row dense class="overflow-y-auto" style="max-height:67vh">
                            <v-col
                                v-for="(item, idx) in filtred_items"
                                :key="idx"
                                xl="2"
                                lg="2"
                                md="3"
                                sm="4"
                                cols="4"
                            >
                                <v-card
                                    hover
                                    class="item-card"
                                    @click="openItemDialog(item)"
                                >
                                    <v-img
                                        :src="
                                            item.image ||
                                            '/assets/posawesome/js/rmsapp/components/pos/placeholder-image.png'
                                        "
                                        class="text-white align-end"
                                        gradient="to bottom, rgba(0,0,0,0), rgba(0,0,0,0.4)"
                                        height="140px"
                                    >
                                        <v-card-text
                                            v-text="item.item_name"
                                            class="text-caption px-1 pb-0 item-card-text"
                                        ></v-card-text>
                                    </v-img>
                                    <v-card-text class="text-high-emphasis pa-1">
                                        <div class="text-caption text-primary">
                                            {{ currencySymbol(item.currency) }}
                                            {{ formtCurrency(item.rate) }}
                                        </div>
                                        <div class="text-caption text-golden">
                                            {{ formtFloat(item.actual_qty) }}
                                            {{ item.stock_uom }}
                                        </div>
                                    </v-card-text>
                                </v-card>
                            </v-col>
                        </v-row>
                    </div>
                    <!-- LIST VIEW -->
                    <div fluid class="items" v-if="items_view=='list'">
                        <div class="my-0 py-0 overflow-y-auto" style="max-height:65vh">
                            <v-data-table
                                ref="myDataTable"
                                :headers="getItmesHeaders()"
                                :items="filtred_items"
                                item-value="item_code"
                                class="enhanced-table-compact"
                                :items-per-page="itemsPerPage"
                                hide-default-footer
                                @click:row="(event, row) => openItemDialog(row.item)"
                                return-object
                            >
                                <template v-slot:item.rate="{ item }">
                                    {{ currencySymbol(item.currency) }}
                                    {{ formtCurrency(item.rate) }}
                                </template>
                                <template v-slot:item.actual_qty="{ item }">
                                    {{ formtFloat(item.actual_qty) }}
                                </template>
                            </v-data-table>
                        </div>
                    </div>
                </v-col>
            </v-row>
        </v-col>
    </v-row>
    </v-card>
    <v-card class="control-panel-card mb-0 mt-3 pa-2">
      <v-row no-gutters align="center" justify="start">
        <v-col cols="6" class="mb-2" v-if="pos_profile.posa_sales_person">
            <v-autocomplete
              density="compact"
              clearable
              auto-select-first
              variant="outlined"
              color="primary"
              :label="frappe._('Sales Person')"
              v-model="sales_person"
              :items="sales_persons"
              item-title="sales_person_name"
              item-value="name"
              bg-color="white"
              :no-data-text="__('Sales Person not found')"
              hide-details
              :custom-filter="(itemText, queryText, internal) => salesPersonFilter(internal.raw, queryText, itemText)"
              :disabled="readonly"
            >
              <template v-slot:item="data">
<v-list-item v-bind="data.props" :title="null">
                    <v-list-item-title
                      class="text-primary text-subtitle-1"
                      v-html="data.item.raw.sales_person_name"
                    ></v-list-item-title>
                    <v-list-item-subtitle
                      v-if="data.item.raw.sales_person_name != data.item.raw.name"
                      v-html="`ID: ${data.item.raw.name}`"
                    ></v-list-item-subtitle>
                  </v-list-item>
                
              </template>
            </v-autocomplete>
        </v-col>
      </v-row>
      <v-row dense class="mt-0">
        <v-col cols="4">
          <v-btn block color="teal" @click="show_table" height="45">
            <div class="d-flex flex-column align-center">
              <v-icon color="white">mdi-table-chair</v-icon>
              <span class="text-caption text-white">{{ __('Table') }}</span>
            </div>
          </v-btn>
        </v-col>
        <v-col cols="4">
          <v-btn block color="primary" variant="outlined" @click="items_view = 'card'" height="45">
            <div class="d-flex flex-column align-center">
              <v-icon>mdi-view-grid</v-icon>
              <span class="text-caption">{{ __('Card') }}</span>
            </div>
          </v-btn>
        </v-col>
        <v-col cols="4">
          <v-btn block color="success" @click="show_cart" height="45">
            <div class="d-flex flex-column align-center">
              <v-icon>mdi-room-service-outline</v-icon>
              <span class="text-caption">{{ __('Cart') }}</span>
            </div>
          </v-btn>
        </v-col>
        <v-col cols="4">
          <v-btn block color="warning" @click="show_hold" height="45">
            <div class="d-flex flex-column align-center">
              <v-icon>mdi-pause-circle-outline</v-icon>
              <span class="text-caption">{{ __('Hold') }}</span>
            </div>
          </v-btn>
        </v-col>
        <v-col cols="4">
          <v-btn block color="info" @click="show_coupons" height="45">
            <div class="d-flex flex-column align-center">
              <v-icon>mdi-ticket-percent-outline</v-icon>
              <span class="text-caption">{{ couponsCount }} {{ __('Coupons') }}</span>
            </div>
          </v-btn>
        </v-col>
        <v-col cols="4">
          <v-btn block color="deep-purple" @click="show_offers" height="45">
            <div class="d-flex flex-column align-center">
              <v-icon>mdi-sale</v-icon>
              <span class="text-caption">
                {{ offersCount }} {{ __('Offers') }} : {{ appliedOffersCount }} {{ __('Applied') }}
              </span>
            </div>
          </v-btn>
        </v-col>
      </v-row>
    </v-card>
  </div>
</template>

<script>
import { evntBus } from '../../bus';
import format from '../../format';
import _ from '../../../shared/debounce';
export default {
  mixins: [format],
  data() {
    return {
      pos_profile: '',
      flags: {},
      items_view: 'list',
      item_group: 'ALL',
      loading: false,
      items_group: ['ALL'],
      items: [],
      search: '',
      first_search: '',
      itemsPerPage: 1000,
      offersCount: 0,
      appliedOffersCount: 0,
      couponsCount: 0,
      appliedCouponsCount: 0,
      customer_price_list: null,
      new_line: false,
      qty: 1,
      sales_persons: [],
      sales_person: "",
      // selectedItem: null, // store the selected item
      selectedItemCode: '', // store the selected item's code
      selectedUOM: null,
      selectedUOMObj: null,
      rate: 0,

      itemDialog: false,
      // selectedItem: null,
      selectedItem: {
          qty: 1,
          posa_notes: ""
      },
      quickNotes: [
          "No Onion",
          "Less Sugar",
          "Extra Cheese",
          "Spicy",
          "No Ice"
      ]

    };
  },
  watch: {
    //sales_person() {
    //  if (this.sales_person) {
    //    this.invoice_doc.sales_team = [
    //      {
    //        sales_person: this.sales_person,
    //        allocated_percentage: 100,
    //      },
    //    ];
    //  } else {
    //    this.invoice_doc.sales_team = [];
    //  }
    //},
    filtred_items(new_value, old_value) {
      if (!this.pos_profile.pose_use_limit_search) {
        if (new_value.length != old_value.length) {
          this.update_items_details(new_value);
        }
      }
    },
    customer_price_list() {
      this.get_items();
    },
    new_line() {
      evntBus.$emit('set_new_line', this.new_line);
    },
  },
  unmounted() {
    document.removeEventListener("keydown", this.handleAltF);
  },
  methods: {
    openItemDialog(item) {
        this.selectedItem = {
            ...item,
            qty: 1,
            posa_notes: item.posa_notes || ""
        };
        this.itemDialog = true;
    },
    saveItemChanges() {
        this.add_item(this.selectedItem);
        this.itemDialog = false;
        this.selectedItem = null;
    },
    closeItemDialog() {
        this.itemDialog = false;
        this.selectedItem = null;
    },
    plusQty() {
        this.selectedItem.qty++;
    },
    minusQty() {
        if (this.selectedItem.qty > 1) {
            this.selectedItem.qty--;
        }
    },
    addQuickNote(note) {
        if (!this.selectedItem.posa_notes) {
            this.selectedItem.posa_notes = note;
        } else {
            this.selectedItem.posa_notes += ", " + note;
        }
    },
    selectAllText(event) {
      // Select all text when the input gains focus
      event.target.select();
    },
    focusQtyField() {
      this.$nextTick(() => {
        if (this.$refs.qty_input) {
          this.$refs.qty_input.focus();
        }
      });
    },
    selectItem(item) {
      this.selectedItem = {
        ...item,
        item_uoms: item.item_uoms || [
          {
            uom: item.stock_uom,
            conversion_factor: 1,
          },
        ],
      };

      this.selectedItemCode = item.item_code;

      // default uom
      this.selectedUOM = item.uom || item.stock_uom;

      // default rate
      this.rate = flt(item.rate || 0);

      // ensure selected uom exists
      const exists = this.selectedItem.item_uoms.find(
        d => d.uom === this.selectedUOM
      );

      if (!exists) {
        this.selectedItem.item_uoms.unshift({
          uom: this.selectedUOM,
          conversion_factor: 1,
        });
      }

      this.input_blur();

      this.$nextTick(() => {
        if (this.$refs.uom_input) {
          this.$refs.uom_input.focus();
        } else {
          this.$refs.rate_input.focus();
          // this.$refs.qty_input.focus();
        }
      });
    },
    onUOMChange(uom) {
      if (!this.selectedItem) return;

      const uomRow = (this.selectedItem.item_uoms || []).find(
        d => d.uom === uom
      );

      this.selectedUOMObj = uomRow || null;

      if (uomRow) {

        // conversion factor
        const conversion_factor = flt(
          uomRow.conversion_factor || 1
        );

        this.selectedItem.conversion_factor =
          conversion_factor;

        // FIRST priority:
        // Item Price for selected UOM

        const uomPrice =
          this.selectedItem.uom_prices?.[uom];

        if (uomPrice) {

          this.rate = flt(
            uomPrice.price_list_rate || 0
          );

        } else {

          // fallback conversion factor logic

          const base_rate = flt(
            this.selectedItem.price_list_rate ||
            this.selectedItem.rate ||
            0
          );

          this.rate =
            base_rate * conversion_factor;
        }
      }
    },
    onUOMEnterEvnt(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      this.onUOMChange(this.selectedUOM);

      if (this.$refs.uom_input) {
        this.$refs.uom_input.blur();

        // close menu
        this.$refs.uom_input.menu = false;

        // extra close protection
        if (false) { // Vuetify 3: menu state is the "menu" property above
          this.$refs.uom_input.$refs.menu.isActive = false;
        }
      }

      this.$nextTick(() => {
        setTimeout(() => {
          if (this.$refs.rate_input) {
            this.$refs.rate_input.focus();
          }
        }, 50);
      });
    },
    addSelectedItem() {
      if (!this.selectedItem) return;
      let item = { ...this.selectedItem };
      // qty
      item.qty = Math.abs(this.qty || 1);
      // editable rate
      item.rate = flt(this.rate || item.rate || 0);
      // IMPORTANT
      item.posa_custom_rate = 1;
      // selected uom
      if (this.selectedUOM) {
        item.uom = this.selectedUOM;
        const uomRow = (item.item_uoms || []).find(
          d => d.uom === this.selectedUOM
        );
        if (uomRow) {
          item.conversion_factor = uomRow.conversion_factor || 1;
          item.posa_custom_uom = 1;
        }
      }
      // sales person
      if (this.pos_profile.posa_sales_person && this.sales_person) {
        item.posa_sales_person = this.sales_person;
      }
      this.add_item(item);
      // reset
      this.selectedItem = null;
      this.selectedItemCode = '';
      this.selectedUOM = null;
      this.selectedUOMObj = null;
      this.debounce_search = '';
      this.qty = 1;
      this.rate = 0;
    },
    uom_input_blur() {
      if (this.$refs.uom_input) {
        this.$refs.uom_input.blur();
        this.$refs.uom_input.menu = false;
      }
    },

    selectItem_qty(item) {
      this.selectedItem = item;
      this.selectedItemCode = item; // Update the search field with the selected item's name
      this.input_blur();
      this.$nextTick(() => {
        this.$refs.qty_input.focus();
      });
    },
    addSelectedItem_qty() {
      if (this.selectedItem) {
        this.add_item(this.selectedItem);
        this.selectedItem = null; // Reset the selected item after adding
        this.selectedItemCode = ''; // Reset the selected item's code after adding
        this.debounce_search = ''; // Clear the search input
      }
    },

    get_sales_person_names() {
      const vm = this;
      if (
        vm.pos_profile.posa_local_storage &&
        localStorage.sales_persons_storage
      ) {
        vm.sales_persons = JSON.parse(
          localStorage.getItem("sales_persons_storage")
        );
      }
      frappe.call({
        method: "posawesome.posawesome.api.posapp.get_sales_person_names",
        callback: function (r) {
          if (r.message) {
            vm.sales_persons = r.message;
            if (vm.pos_profile.posa_local_storage) {
              localStorage.setItem("sales_persons_storage", "");
              localStorage.setItem(
                "sales_persons_storage",
                JSON.stringify(r.message)
              );
            }
          }
        },
      });
    },
    salesPersonFilter(item, queryText, itemText) {
      const textOne = item.sales_person_name
        ? item.sales_person_name.toLowerCase()
        : "";
      const textTwo = item.name.toLowerCase();
      const searchText = queryText.toLowerCase();

      return (
        textOne.indexOf(searchText) > -1 || textTwo.indexOf(searchText) > -1
      );
    },

    input_blur() {
      this.$refs.debounce_search.blur();
    },
    customFilter(item, queryText, itemText) {
      const lowercaseQuery = queryText.toLowerCase();
      const barcodeMatch = item.item_barcode.some(barcodeObj =>
        barcodeObj.barcode.toLowerCase().includes(lowercaseQuery)
      );
      const serialNumberMatch = item.serial_no_data && item.serial_no_data.some(serial =>
        serial.serial_no.toLowerCase().includes(lowercaseQuery)
      );
      const batchNumberMatch = item.batch_no_data && item.batch_no_data.some(batch =>
        batch.batch_no.toLowerCase().includes(lowercaseQuery)
      );
      const codeMatch = item.item_code.toLowerCase().includes(lowercaseQuery);
      const nameMatch = item.item_name.toLowerCase().includes(lowercaseQuery);
      const words = queryText.toLowerCase().split(' ');
      const rearrangedMatch = words.every(word => item.item_name.toLowerCase().includes(word));
      return barcodeMatch || serialNumberMatch || batchNumberMatch || codeMatch || nameMatch || rearrangedMatch;
    },
    handleAltF(e) {
      if ((e.key === 'F2' || e.key === 'Escape' || ((e.key === 'f' || e.key === 'F') && e.altKey)) && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        if (this.$root) {
          evntBus.$emit('customerBlurTriggered');
          evntBus.$emit('discountBlurTriggered');
        }
        this.$refs.debounce_search.focus();
      }
    },
    show_offers() {
      evntBus.$emit('show_offers', 'true');
    },
    show_coupons() {
      evntBus.$emit('show_coupons', 'true');
    },
    show_hold() {
      evntBus.$emit('show_hold', 'true');
    },
    show_cart() {
      evntBus.$emit('show_cart', 'true');
    },
    show_invoices() {
      evntBus.$emit('show_invoices', 'true');
    },
    show_table() {
      evntBus.$emit('show_table', 'true');
    },
    get_items() {
      if (!this.pos_profile) {
        console.error('No POS Profile');
        return;
      }
      const vm = this;
      this.loading = true;
      let search = this.get_search(this.first_search);
      let gr = '';
      let sr = '';
      if (search) {
        sr = search;
      }
      if (vm.item_group != 'ALL') {
        gr = vm.item_group.toLowerCase();
      }
      if (
        vm.pos_profile.posa_local_storage &&
        localStorage.items_storage &&
        !vm.pos_profile.pose_use_limit_search
      ) {
        vm.items = JSON.parse(localStorage.getItem('items_storage'));
        evntBus.$emit('set_all_items', vm.items);
        vm.loading = false;
      }
      frappe.call({
        method: 'posawesome.posawesome.api.posapp.get_items',
        args: {
          pos_profile: vm.pos_profile,
          price_list: vm.customer_price_list,
          item_group: gr,
          search_value: sr,
        },
        callback: function (r) {
          if (r.message) {
            vm.items = r.message;
    // IMPORTANT: fetch item details immediately
    if (!vm.pos_profile.pose_use_limit_search && vm.items.length) {
      vm.update_items_details(vm.items);
    }

            evntBus.$emit('set_all_items', vm.items);
            vm.loading = false;
            console.info('Items Loaded');
            if (
              vm.pos_profile.posa_local_storage &&
              !vm.pos_profile.pose_use_limit_search
            ) {
              localStorage.setItem('items_storage', '');
              try {
                localStorage.setItem(
                  'items_storage',
                  JSON.stringify(r.message)
                );
              } catch (e) {
                console.error(e);
              }
            }
            if (vm.pos_profile.pose_use_limit_search) {
              vm.enter_event();
            }
          }
        },
      });
    },
    get_items_groups() {
      if (!this.pos_profile) {
        console.log('No POS Profile');
        return;
      }
      if (this.pos_profile.item_groups.length > 0) {
        this.pos_profile.item_groups.forEach((element) => {
          if (element.item_group !== 'All Item Groups') {
            this.items_group.push(element.item_group);
          }
        });
      } else {
        const vm = this;
        frappe.call({
          method: 'posawesome.posawesome.api.posapp.get_items_groups',
          args: {},
          callback: function (r) {
            if (r.message) {
              r.message.forEach((element) => {
                vm.items_group.push(element.name);
              });
            }
          },
        });
      }
    },
    getItmesHeaders() {
      const items_headers = [
        {
          title: __('Name'),
          align: 'start',
          sortable: true,
          key: 'item_name',
        },
        {
          title: __('Code'),
          align: 'start',
          sortable: true,
          key: 'item_code',
        },
        { title: __('Rate'), key: 'rate', align: 'start' },
        { title: __('Available QTY'), key: 'actual_qty', align: 'start' },
        { title: __('UOM'), key: 'stock_uom', align: 'start' },
      ];
      if (!this.pos_profile.posa_display_item_code) {
        items_headers.splice(1, 1);
      }
      return items_headers;
    },
    add_item(item) {
      item = { ...item };

      // ?? Inject sales person into item
      if (this.pos_profile.posa_sales_person && !this.sales_person) {
        frappe.msgprint(__('Please select Sales Person first'));
        return;
      }
      if (this.pos_profile.posa_sales_person && this.sales_person) {
        item.posa_sales_person = this.sales_person;
      }
      if (item.has_variants) {
        evntBus.$emit('open_variants_model', item, this.items);
      } else {
        if (!item.qty || item.qty === 1) {
          item.qty = Math.abs(item.qty || this.qty || 1);
        }
        item.posa_notes = item.posa_notes || "";
        evntBus.$emit('add_item', item);
        this.qty = 1;
        this.esc_event();
        this.first_search = '';
        this.$refs.debounce_search.model = null;
        this.$nextTick(() => {
          this.$refs.debounce_search.focus();
        });
      }
    },
    enter_event() {
      let match = false;
      if (!this.filtred_items.length || !this.first_search) {
        return;
      }
      const qty = this.get_item_qty(this.first_search);
      const new_item = { ...this.filtred_items[0] };
      new_item.qty = flt(qty);
      new_item.item_barcode.forEach((element) => {
        if (this.search == element.barcode) {
          new_item.uom = element.posa_uom;
          match = true;
        }
      });
      if (
        !new_item.to_set_serial_no &&
        new_item.has_serial_no &&
        this.pos_profile.posa_search_serial_no
      ) {
        new_item.serial_no_data.forEach((element) => {
          if (this.search && element.serial_no == this.search) {
            new_item.to_set_serial_no = this.first_search;
            match = true;
          }
        });
      }
      if (this.flags.serial_no) {
        new_item.to_set_serial_no = this.flags.serial_no;
      }
      if (
        !new_item.to_set_batch_no &&
        new_item.has_batch_no &&
        this.pos_profile.posa_search_batch_no
      ) {
        new_item.batch_no_data.forEach((element) => {
          if (this.search && element.batch_no == this.search) {
            new_item.to_set_batch_no = this.first_search;
            new_item.batch_no = this.first_search;
            match = true;
          }
        });
      }
      if (this.flags.batch_no) {
        new_item.to_set_batch_no = this.flags.batch_no;
      }
      if (match) {
        // ?? Inject sales person into item
        if (this.pos_profile.posa_sales_person && this.sales_person) {
          new_item.posa_sales_person = this.sales_person;
        }
        this.add_item(new_item);
        this.search = null;
        this.first_search = null;
        this.debounce_search = null;
        this.flags.serial_no = null;
        this.flags.batch_no = null;
        this.qty = 1;
        this.$refs.debounce_search.focus();
      }
    },
    search_onchange() {
      console.log('Enter key pressed');
      const vm = this;
      if (vm.pos_profile.pose_use_limit_search) {
        vm.get_items();
      } else {
        vm.enter_event();
      }
    },
    get_item_qty(first_search) {
      let scal_qty = Math.abs(this.qty);
      if (first_search.startsWith(this.pos_profile.posa_scale_barcode_start)) {
        let pesokg1 = first_search.substr(7, 5);
        let pesokg;
        if (pesokg1.startsWith('0000')) {
          pesokg = '0.00' + pesokg1.substr(4);
        } else if (pesokg1.startsWith('000')) {
          pesokg = '0.0' + pesokg1.substr(3);
        } else if (pesokg1.startsWith('00')) {
          pesokg = '0.' + pesokg1.substr(2);
        } else if (pesokg1.startsWith('0')) {
          pesokg =
            pesokg1.substr(1, 1) + '.' + pesokg1.substr(2, pesokg1.length);
        } else if (!pesokg1.startsWith('0')) {
          pesokg =
            pesokg1.substr(0, 2) + '.' + pesokg1.substr(2, pesokg1.length);
        }
        scal_qty = pesokg;
      }
      return scal_qty;
    },
    get_search(first_search) {
      let search_term = '';
      if (
        first_search &&
        first_search.startsWith(this.pos_profile.posa_scale_barcode_start)
      ) {
        search_term = first_search.substr(0, 7);
      } else {
        search_term = first_search;
      }
      return search_term;
    },
    esc_event() {
      this.search = null;
      this.first_search = null;
      this.qty = 1;
      this.$refs.debounce_search.focus();
      console.log('Escape key pressed');
      if (this.pos_profile.posa_mandatory_select_uom) {
        this.selectedItem = null;
        this.selectedItemCode = '';
        this.selectedUOM = null;
        this.selectedUOMObj = null;
      }
      if (this.$root) {
        evntBus.$emit('customerBlurTriggered');
      }
      if (this.$root) {
        evntBus.$emit('expandedHandlerTriggered');
      }
    },
    update_items_details(items) {
      const vm = this;
      frappe.call({
        method: 'posawesome.posawesome.api.posapp.get_items_details',
        args: {
          pos_profile: vm.pos_profile,
          items_data: items,
        },
        callback: function (r) {
          if (r.message) {
            items.forEach((item) => {
              const updated_item = r.message.find(
                (element) => element.item_code == item.item_code
              );
              item.actual_qty = updated_item.actual_qty;
              item.serial_no_data = updated_item.serial_no_data;
              item.batch_no_data = updated_item.batch_no_data;
              item.item_uoms = updated_item.item_uoms;
            });
          }
        },
      });
    },
    update_cur_items_details() {
      this.update_items_details(this.filtred_items);
    },
    scan_barcoud() {
      const vm = this;
      onScan.attachTo(document, {
        suffixKeyCodes: [],
        keyCodeMapper: function (oEvent) {
          oEvent.stopImmediatePropagation();
          return onScan.decodeKeyEvent(oEvent);
        },
        onScan: function (sCode) {
          setTimeout(() => {
            vm.trigger_onscan(sCode);
          }, 300);
        },
      });
    },
    trigger_onscan(sCode) {
      if (this.filtred_items.length === 0) {
        evntBus.$emit('show_mesage', {
          text: `No Item has this barcode "${sCode}"`,
          color: 'error',
        });
        frappe.utils.play_sound('error');
      } else {
        const newItem = this.filtred_items.find(item =>
          item.item_barcode.some(barcode => barcode.barcode.includes(sCode))
        );
        if (newItem) {
          this.add_item(newItem);
          this.debounce_search = null;
          this.search = null;
        }
      }
    },
  },
  computed: {
    filtred_items() {
      this.search = this.get_search(this.first_search);
      if (!this.pos_profile.pose_use_limit_search) {
        let filtred_list = [];
        let filtred_group_list = [];
        if (this.item_group != 'ALL') {
          filtred_group_list = this.items.filter((item) =>
            item.item_group
              .toLowerCase()
              .includes(this.item_group.toLowerCase())
          );
        } else {
          filtred_group_list = this.items;
        }
        if (!this.search || this.search.length < 3) {
          if (
            this.pos_profile.posa_show_template_items &&
            this.pos_profile.posa_hide_variants_items
          ) {
            return (filtred_list = filtred_group_list
              .filter((item) => !item.variant_of)
              .slice(0, 50));
          } else {
            return (filtred_list = filtred_group_list.slice(0, 50));
          }
        } else if (this.search) {
          filtred_list = filtred_group_list.filter((item) => {
            let found = false;
            for (let element of item.item_barcode) {
              if (element.barcode.includes(this.search)) {
                found = true;
                break;
              }
            }
            return found;
          });
          if (filtred_list.length == 0) {
            filtred_list = filtred_group_list.filter((item) =>
              item.item_code.toLowerCase().includes(this.search.toLowerCase())
            );
            if (filtred_list.length == 0) {
              filtred_list = filtred_group_list.filter((item) =>
                item.item_name.toLowerCase().includes(this.search.toLowerCase())
              );
            }
            if (
              filtred_list.length == 0 &&
              this.pos_profile.posa_search_serial_no
            ) {
              filtred_list = filtred_group_list.filter((item) => {
                let found = false;
                for (let element of item.serial_no_data) {
                  if (element.serial_no == this.search) {
                    found = true;
                    this.flags.serial_no = null;
                    this.flags.serial_no = this.search;
                    break;
                  }
                }
                return found;
              });
            }
            if (
              filtred_list.length == 0 &&
              this.pos_profile.posa_search_batch_no
            ) {
              filtred_list = filtred_group_list.filter((item) => {
                let found = false;
                for (let element of item.batch_no_data) {
                  if (element.batch_no == this.search) {
                    found = true;
                    this.flags.batch_no = null;
                    this.flags.batch_no = this.search;
                    break;
                  }
                }
                return found;
              });
            }
          }
        }
        if (
          this.pos_profile.posa_show_template_items &&
          this.pos_profile.posa_hide_variants_items
        ) {
          return filtred_list.filter((item) => !item.variant_of).slice(0, 50);
        } else {
          return filtred_list.slice(0, 50);
        }
      } else {
        return this.items.slice(0, 50);
      }
    },
    debounce_search: {
      get() {
        console.log('debounce search working');
        return this.first_search;
      },
      set: _.debounce(function (newValue) {
        console.log('Debounced search value:', newValue);
        this.first_search = newValue;
      }, 200),
    },
  },
  created: function () {
    evntBus.$on('inputBlurTriggered', this.input_blur);
    evntBus.$on('UominputBlurTriggered', this.uom_input_blur);
    evntBus.$on('escEventTriggered', this.esc_event);
    document.addEventListener("keydown", this.handleAltF);
    this.$nextTick(function () {
      evntBus.$on('set_items_view', (view) => {
        this.items_view = view;
      });
    });
    evntBus.$on('register_pos_profile', (data) => {
      this.pos_profile = data.pos_profile;
      this.get_items();
      this.get_items_groups();
      this.items_view = this.pos_profile.posa_default_card_view
        ? 'card'
        : 'list';
    });
    evntBus.$on('update_cur_items_details', () => {
      this.update_cur_items_details();
    });
    evntBus.$on('update_offers_counters', (data) => {
      this.offersCount = data.offersCount;
      this.appliedOffersCount = data.appliedOffersCount;
    });
    evntBus.$on('update_coupons_counters', (data) => {
      this.couponsCount = data.couponsCount;
      this.appliedCouponsCount = data.appliedCouponsCount;
    });
    evntBus.$on('update_customer_price_list', (data) => {
      this.customer_price_list = data;
    });
  },
  mounted() {
    this.scan_barcoud();
    this.get_sales_person_names();
  },
};
</script>

<style scoped>
/* Main Selection Card */
.selection {
  border-radius: 12px;
  overflow: hidden;
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  border: 1px solid rgba(25, 118, 210, 0.1);
  transition: all 0.3s ease;
}

/* Control Panel Card */
.control-panel-card {
  border-radius: 12px;
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  border: 1px solid rgba(25, 118, 210, 0.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: all 0.3s ease;
}

/* Form Fields */
.enhanced-field {
  transition: all 0.3s ease;
}

.enhanced-field:hover {
  transform: translateY(-1px);
}

.field-focused {
  background: rgba(25, 118, 210, 0.02);
  border-radius: 8px;
}

.enhanced-field :deep(.v-field--focused) {
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.1);
}

.enhanced-field :deep(.v-field--focused .v-field__outline) {
  border-color: rgba(25, 118, 210, 0.3) !important;
  border-width: 1px !important;
}

.enhanced-field :deep(.v-field--focused .v-field__overlay) {
  background: rgba(25, 118, 210, 0.02);
}

/* Checkbox */
.enhanced-checkbox {
  margin: 0;
  padding: 0;
}

.enhanced-checkbox :deep(.v-label) {
  font-size: 0.9rem;
  color: #1976d2;
  font-weight: 500;
}

/* Item Card */
.item-card {
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(25, 118, 210, 0.1);
  transition: all 0.3s ease;
}

.item-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.1);
}

.item-card-text {
  font-weight: 500;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

/* Data Table */
.enhanced-table-compact {
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid rgba(25, 118, 210, 0.1);
}

.enhanced-table-compact :deep(.v-data-table__wrapper) {
  border-radius: 8px;
}

.enhanced-table-compact :deep(th) {
  background: linear-gradient(135deg, #f8f9fa 0%, #e3f2fd 100%);
  color: #1976d2;
  font-weight: 600;
  border-bottom: 1px solid rgba(25, 118, 210, 0.1);
  padding: 8px 12px;
}

.enhanced-table-compact :deep(td) {
  padding: 6px 12px;
}

.enhanced-table-compact :deep(tr:hover) {
  background: rgba(25, 118, 210, 0.04);
}

/* Currency and Amount Styling */
.currency-symbol {
  font-weight: 600;
  color: #1976d2;
  font-size: 0.9rem;
}

.amount-value {
  font-weight: 500;
  color: #333;
  font-size: 0.9rem;
}

/* Button Toggle */
.enhanced-btn-toggle {
  background: rgba(25, 118, 210, 0.05);
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.3s ease;
}

.enhanced-btn-toggle :deep(.v-btn) {
  background: transparent;
  color: #1976d2 !important;
  font-weight: 500;
  text-transform: none;
  padding: 8px 12px;
  min-width: 0;
  transition: all 0.3s ease;
}

.enhanced-btn-toggle :deep(.v-btn--active) {
  background: linear-gradient(135deg, #1976d2 0%, #42a5f5 100%) !important;
  color: white !important;
}

.enhanced-btn-toggle :deep(.v-btn:hover) {
  background: rgba(25, 118, 210, 0.1);
  transform: translateY(-1px);
}

.enhanced-btn-toggle :deep(.v-btn .v-icon) {
  color: inherit;
  font-size: 16px;
  margin-right: 4px;
}

/* Responsive Design */
@media (max-width: 768px) {
  .selection {
    border-radius: 8px;
  }
  .control-panel-card {
    padding: 8px;
  }
  .enhanced-btn-toggle :deep(.v-btn) {
    padding: 6px 8px;
    font-size: 0.85rem;
  }
  .enhanced-btn-toggle :deep(.v-btn .v-icon) {
    font-size: 14px;
  }
}

@media (max-width: 480px) {
  .control-panel-card {
    padding: 6px;
  }
  .enhanced-btn-toggle :deep(.v-btn) {
    padding: 4px 6px;
    font-size: 0.8rem;
  }
  .enhanced-btn-toggle :deep(.v-btn .v-icon) {
    font-size: 12px;
  }
}

/* Animation Effects */
@keyframes slideInFromTop {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.selection {
  animation: slideInFromTop 0.4s ease-out;
}

.control-panel-card {
  animation: slideInFromTop 0.4s ease-out;
}

.category-sidebar{
    border-right:1px solid #E0E0E0;
    background:#FAFAFA;
}

.category-sidebar .v-chip{
    width:100%;
    justify-content:flex-start;
    font-weight:600;
}

</style>