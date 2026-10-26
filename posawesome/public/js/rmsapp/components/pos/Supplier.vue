<template>
  <div>
    <v-autocomplete
      ref="supplierField"
      density="compact"
      clearable
      auto-select-first
      variant="outlined"
      color="primary"
      :label="frappe._('Supplier')"
      v-model="supplier"
      :items="suppliers"
      item-title="supplier_name"
      item-value="name"
      bg-color="white"
      :no-data-text="__('Supplier not found')"
      hide-details
      :custom-filter="(itemText, queryText, internal) => customFilter(internal.raw, queryText, itemText)"
      :disabled="readonly"
    >
      <template v-slot:item="data">
<v-list-item v-bind="data.props" :title="null">
            <v-list-item-title
              class="text-primary text-subtitle-1"
              v-html="data.item.raw.supplier_name"
            ></v-list-item-title>
            <v-list-item-subtitle
              v-if="data.item.raw.supplier_name != data.item.raw.name"
              v-html="`ID: ${data.item.raw.name}`"
            ></v-list-item-subtitle>
            <v-list-item-subtitle
              v-if="data.item.raw.tax_id"
              v-html="`TAX ID: ${data.item.raw.tax_id}`"
            ></v-list-item-subtitle>
            <v-list-item-subtitle
              v-if="data.item.raw.email_id"
              v-html="`Email: ${data.item.raw.email_id}`"
            ></v-list-item-subtitle>
            <v-list-item-subtitle
              v-if="data.item.raw.mobile_no"
              v-html="`Mobile No: ${data.item.raw.mobile_no}`"
            ></v-list-item-subtitle>
            <v-list-item-subtitle
              v-if="data.item.raw.primary_address"
              v-html="`Primary Address: ${data.item.raw.primary_address}`"
            ></v-list-item-subtitle>
          </v-list-item>
        
      </template>
    </v-autocomplete>
  </div>
</template>

<script>
import { evntBus } from '../../bus';

export default {
  data: () => ({
    pos_profile: '',
    suppliers: [],
    selectedSupplier: null,
    supplier: '',
    readonly: false,
    supplier_info: {},
  }),

  methods: {
    supplier_blur() {
      this.$refs.supplierField.blur();
    },
    shortSupplier(e) {
      if (e.key === "s" || e.key === "S" && e.altKey) {
        e.preventDefault();
        if (this.$root) {
          evntBus.$emit('inputBlurTriggered');
        }
        this.$refs.supplierField.focus();
      }
    },
    get_supplier_names() {
      const vm = this;
      if (this.suppliers.length > 0) {
        return;
      }
      if (vm.pos_profile.posa_local_storage && localStorage.supplier_storage) {
        vm.suppliers = JSON.parse(localStorage.getItem('supplier_storage'));
      }
      frappe.call({
        method: 'posawesome.posawesome.api.posapp.get_supplier_names',
        args: {
          pos_profile: this.pos_profile.pos_profile,
        },
        callback: function (r) {
          if (r.message) {
            vm.suppliers = r.message;
            console.info('loadSuppliers');
            if (vm.pos_profile.posa_local_storage) {
              localStorage.setItem('supplier_storage', '');
              localStorage.setItem(
                'supplier_storage',
                JSON.stringify(r.message)
              );
            }
          }
        },
      });
    },
    new_supplier() {
      evntBus.$emit('open_update_supplier', null);
    },
    edit_supplier() {
      evntBus.$emit('open_update_supplier', this.supplier_info);
    },
    customFilter(item, queryText, itemText) {
      const textOne = item.supplier_name
        ? item.supplier_name.toLowerCase()
        : '';
      const textTwo = item.tax_id ? item.tax_id.toLowerCase() : '';
      const textThree = item.email_id ? item.email_id.toLowerCase() : '';
      const textFour = item.mobile_no ? item.mobile_no.toLowerCase() : '';
      const textFifth = item.name.toLowerCase();
      const searchText = queryText.toLowerCase();

      return (
        textOne.indexOf(searchText) > -1 ||
        textTwo.indexOf(searchText) > -1 ||
        textThree.indexOf(searchText) > -1 ||
        textFour.indexOf(searchText) > -1 ||
        textFifth.indexOf(searchText) > -1
      );
    },
  },

  computed: {},

  created: function () {
    evntBus.$on('supplierBlurTriggered', this.supplier_blur);
    document.addEventListener("keydown", this.shortSupplier.bind(this));
    this.$nextTick(function () {
      evntBus.$on('register_pos_profile', (pos_profile) => {
        this.pos_profile = pos_profile;
        this.get_supplier_names();
      });
      evntBus.$on('payments_register_pos_profile', (pos_profile) => {
        this.pos_profile = pos_profile;
        this.get_supplier_names();
      });
      evntBus.$on('set_supplier', (supplier) => {
        this.supplier = supplier;
      });
      evntBus.$on('add_supplier_to_list', (supplier) => {
        this.suppliers.push(supplier);
      });
      evntBus.$on('set_supplier_readonly', (value) => {
        this.readonly = value;
      });
      evntBus.$on('set_supplier_info_to_edit', (data) => {
        this.supplier_info = data;
      });
      evntBus.$on('fetch_supplier_details', () => {
        this.get_supplier_names();
      });
    });
  },
  unmounted() {
    document.removeEventListener("keydown", this.shortSupplier);
  },

  watch: {
    supplier(newValue) {
      if (newValue) {
        // The v-autocomplete field is filled
        if (this.$root) {
          evntBus.$emit('escEventTriggered');
        }
        this.$refs.supplierField.blur();
      }
      evntBus.$emit('update_supplier', this.supplier);
    },
  },
};
</script>
