<template>
  <div>
      <v-row
        align="center"
        class="items px-2 py-3 mt-0 pt-0"
      >
        <v-col class="pb-0 mb-2">
          <v-text-field
            dense
            clearable
            autofocus
            outlined
            color="primary"
            :label="frappe._('Search Items')"
            hint="Search by item code, serial number, batch no or barcode"
            background-color="white"
            hide-details
            v-model="debounce_search"
            @keydown.esc="esc_event"
            @keydown.enter="search_onchange"
            ref="debounce_search"
          ></v-text-field>
        </v-col>
      </v-row>
  </div>
</template>

<script>
import { evntBus } from '../../bus';
import format from '../../format';
import _ from 'lodash';
import Customer from "./Customer.vue";
export default {
  mixins: [format],
  data() {
    return {
      pos_profile: '',
      flags: {},
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
      customer: "",
      customer_info: "",
      selectedItem: null, // store the selected item
      selectedItemCode: '', // store the selected item's code
      invoiceTypes: ["Invoice", "Order"],
      invoiceType: "Invoice",
    };
  },

  watch: {
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

  destroyed() {
    // Remove the event listener when the component is destroyed
    document.removeEventListener("keydown", this.handleAltF);
  },

  methods: {
    clearSearchField() {
      this.debounce_search = '';
    },
    selectAllText(event) {
      // Select all text when the input gains focus
      event.target.select();
    },
    selectItem(item) {
      this.selectedItem = item;
      this.selectedItemCode = item; // Update the search field with the selected item's name
      this.input_blur();
      this.$nextTick(() => {
        this.$refs.qty_input.focus();
      });
    },
    addSelectedItem() {
      if (this.selectedItem) {
        this.add_item(this.selectedItem);
        this.selectedItem = null; // Reset the selected item after adding
        this.selectedItemCode = ''; // Reset the selected item's code after adding
        this.debounce_search = ''; // Clear the search input
      }
    },

    input_blur() {
      this.$refs.debounce_search.blur();
    },
    customFilter(item, queryText, itemText) {
      const lowercaseQuery = queryText.toLowerCase();

      // Check for barcode match
      const barcodeMatch = item.item_barcode.some(barcodeObj =>
        barcodeObj.barcode.toLowerCase().includes(lowercaseQuery)
      );

      // Check for serial number match
      const serialNumberMatch = item.serial_no_data && item.serial_no_data.some(serial =>
        serial.serial_no.toLowerCase().includes(lowercaseQuery)
      );

      // Check for batch number match
      const batchNumberMatch = item.batch_no_data && item.batch_no_data.some(batch =>
        batch.batch_no.toLowerCase().includes(lowercaseQuery)
      );

      // Check for item code match
      const codeMatch = item.item_code.toLowerCase().includes(lowercaseQuery);

      // Check for item name match
      const nameMatch = item.item_name.toLowerCase().includes(lowercaseQuery);

      // Check if the queryText matches any rearrangement of the words in the item's name
      const words = queryText.toLowerCase().split(' ');
      const rearrangedMatch = words.every(word => item.item_name.toLowerCase().includes(word));

      // Return true if any of the conditions are met
      return barcodeMatch || serialNumberMatch || batchNumberMatch || codeMatch || nameMatch || rearrangedMatch;
    },
    handleAltF(e) {
      // Check if the Alt key is pressed along with the F key
      if ((e.key === 'F2' || e.key === 'Escape' || ((e.key === 'f' || e.key === 'F') && e.altKey)) && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        if (this.$root) {
          this.$root.$emit('customerBlurTriggered');
          this.$root.$emit('discountBlurTriggered');
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
            evntBus.$emit('set_all_items', vm.items);
            vm.loading = false;
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
          text: __('Name'),
          align: 'start',
          sortable: true,
          value: 'item_name',
        },
        {
          text: __('Code'),
          align: 'start',
          sortable: true,
          value: 'item_code',
        },
        { text: __('Rate'), value: 'rate', align: 'start' },
        { text: __('Available QTY'), value: 'actual_qty', align: 'start' },
        { text: __('UOM'), value: 'stock_uom', align: 'start' },
      ];
      if (!this.pos_profile.posa_display_item_code) {
        items_headers.splice(1, 1);
      }

      return items_headers;
    },
    add_item(item) {
      // const debounce_search = event.target.value;
      item = { ...item };
      if (item.has_variants) {
        evntBus.$emit('open_variants_model', item, this.items);
      } else {
        if (!item.qty || item.qty === 1) {
          item.qty = Math.abs(this.qty);
        }
        evntBus.$emit('add_item', item);
        this.qty = 1;
        this.esc_event();
        this.first_search = '';
        this.$refs.debounce_search.model = null;
        this.$nextTick(() => {
          // Set focus to the autocomplete
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
      if (this.$root) {
        this.$root.$emit('customerBlurTriggered');
      }
    },
    update_items_details(items) {
      // set debugger
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

  components: {
    Customer,
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
        return this.first_search;
      },
      set: _.debounce(function (newValue) {
        this.first_search = newValue;
      }, 200),
    },
  },

  created: function () {
    this.$root.$on('inputBlurTriggered', this.input_blur);
    this.$root.$on('escEventTriggered', this.esc_event);
    document.addEventListener("keydown", this.handleAltF);
    this.$nextTick(function () {});
    evntBus.$on('register_pos_profile', (data) => {
      this.pos_profile = data.pos_profile;
      this.get_items();
      this.get_items_groups();
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
    this.clearInterval = setInterval(() => {
      this.clearSearchField();
    }, 2000);
  },
  beforeDestroy() {
    // Clear the interval when the component is destroyed
    if (this.clearInterval) {
      clearInterval(this.clearInterval);
    }
  },
};
</script>

<style scoped></style>
