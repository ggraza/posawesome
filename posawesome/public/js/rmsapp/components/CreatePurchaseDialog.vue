<template>
  <v-dialog v-model="dialog" persistent max-width="900px">
    <v-card class="rounded-lg">
      <v-card-title class="primary text-white text-h5" style="font-size: 1.25rem;">
        <v-icon start color="white">mdi-cart-plus</v-icon>
        <span class="font-weight-bold">{{ __('Create Purchase') }}</span>
        <v-spacer></v-spacer>
        <v-btn icon @click="close">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>
      
      <v-card-text class="pt-6">
        <v-container>
          <v-row dense>
            <v-col cols="12">
              <v-autocomplete
                v-model="supplier"
                :items="suppliers"
                :label="__('Supplier')"
                required
                variant="outlined"
                density="compact"
                prepend-inner-icon="mdi-account"
                :loading="loadingSuppliers"
                bg-color="grey lighten-5" item-title="text"
              ></v-autocomplete>
            </v-col>
          </v-row>

          <v-divider class="my-4"></v-divider>
          <div class="text-subtitle-1 font-weight-bold mb-2">{{ __('Items') }}</div>

          <v-row dense v-for="(item, index) in items" :key="index" align="center">
            <v-col cols="5">
              <v-autocomplete
                v-model="item.item_code"
                :items="available_items"
                item-title="item_code"
                item-value="item_code"
                :label="__('Item')"
                density="compact"
                variant="outlined"
                hide-details
                @update:model-value="onItemChange(item)"
              ></v-autocomplete>
            </v-col>
            <v-col cols="2">
              <v-text-field
                v-model.number="item.qty"
                :label="__('Qty')"
                type="number"
                density="compact"
                variant="outlined"
                hide-details
              ></v-text-field>
            </v-col>
            <v-col cols="3">
              <v-text-field
                v-model.number="item.rate"
                :label="__('Rate')"
                type="number"
                density="compact"
                variant="outlined"
                hide-details
              ></v-text-field>
            </v-col>
            <v-col cols="2" class="d-flex justify-center">
               <v-btn icon color="red" size="small" @click="removeItem(index)">
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </v-col>
          </v-row>

          <v-row dense class="mt-2">
            <v-col cols="12">
              <v-btn size="small" color="primary" variant="text" @click="addItem">
                <v-icon start>mdi-plus</v-icon> {{ __('Add Item') }}
              </v-btn>
            </v-col>
          </v-row>

        </v-container>
      </v-card-text>
      
      <v-divider></v-divider>

      <v-card-actions class="pa-4">
        <v-spacer></v-spacer>
        <v-btn 
          color="grey darken-1" 
          variant="text" 
          class="text-capitalize"
          @click="close"
        >
          {{ __('Cancel') }}
        </v-btn>
        <v-btn
          color="primary"
          class="px-6 text-capitalize font-weight-bold"
          elevation="2"
          @click="submit"
          :loading="submitting"
        >
          {{ __('Submit') }}
          <v-icon end size="small">mdi-check</v-icon>
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
export default {
  data() {
    return {
      dialog: false,
      supplier: null,
      suppliers: [],
      items: [],
      available_items: [],
      pos_profile: null,
      loadingSuppliers: false,
      submitting: false,
    };
  },
  methods: {
    open(pos_profile) {
      this.pos_profile = pos_profile;
      this.dialog = true;
      this.fetchSuppliers();
      this.fetchItems(); // Identify if we need to fetch items or reuse from pos profile
      this.items = [{ item_code: '', qty: 1, rate: 0 }];
    },
    close() {
      this.dialog = false;
      this.reset();
    },
    reset() {
      this.supplier = null;
      this.items = [];
      this.suppliers = [];
    },
    fetchSuppliers() {
      this.loadingSuppliers = true;
      frappe.call({
        method: 'frappe.client.get_list',
        args: {
          doctype: 'Supplier',
          // filters: { custom_is_consignment_supplier: 1 },
          fields: ['name'],
          limit_page_length: 1000
        },
        callback: (r) => {
          if (r.exc) {
             console.error('Error fetching suppliers:', r.exc);
             frappe.msgprint(__('Error fetching suppliers. Check console.'));
          }
          this.suppliers = (r.message || []).map(d => d.name);
          this.loadingSuppliers = false;
        },
      });
    },
    fetchItems() {
       // We can iterate over existing items in the indexedDB or fetch simple list
       // For now, let's try to fetch from backend or just use an autocomplete search if the list is huge.
       // But to keep it simple as requested, let's assume we can search items.
       // Actually, POS Awesome loads items. detailed items might be in indexedDB.
       // Let's use a simple search or standard get_list for now.
       // Optimally we should use the same source as the main POS.
       
       // check if we have items in pos_profile (not likely full list)
       // Let's just fetch a list of items for the dropdown.
       frappe.call({
           method: 'frappe.client.get_list',
           args: {
               doctype: 'Item',
               // filters: { custom_is_consignment_item: 1 },
               fields: ['name', 'item_code', 'item_name', 'standard_rate'],
               limit_page_length: 50000 // Limit for performance
           },
           callback: (r) => {
               this.available_items = r.message || [];
           }
       })
    },
    onItemChange(row) {
        const item = this.available_items.find(i => i.item_code === row.item_code);
        if (item) {
            row.rate = item.standard_rate || 0;
        }
    },
    addItem() {
      this.items.push({ item_code: '', qty: 1, rate: 0 });
    },
    removeItem(index) {
      this.items.splice(index, 1);
    },
submit() {
  if (!this.supplier || this.items.length === 0) {
    frappe.msgprint(__('Please select supplier and add at least one item'));
    return;
  }

  const validItems = this.items.filter(i => i.item_code && i.qty > 0);

  if (validItems.length === 0) {
    frappe.msgprint(__('Please add valid items'));
    return;
  }

  this.submitting = true;

  frappe.call({
    method: 'posawesome.posawesome.api.posapp.create_purchase_receipt',
    args: {
      supplier: this.supplier,
      items: validItems,
      pos_profile: this.pos_profile.name,
    },

    callback: (r) => {
      this.submitting = false;

      if (!r.exc && r.message) {

        // Auto open print page
        this.load_print_page(r.message);

        frappe.show_alert({
          message: __('Purchase Receipt Created'),
          indicator: 'green',
        });

        frappe.utils.play_sound("submit");

        this.close();
      }
    },

    error: (error) => {
      this.submitting = false;
      console.error(error);
      frappe.msgprint(__('An error occurred while creating Purchase Receipt'));
    },
  });
},
load_print_page(pr_name) {

  const print_format =
    this.pos_profile.custom_purchase_receipt_print_format || "Standard";

  const letter_head = this.pos_profile.letter_head || 0;

  const encoded_name = encodeURIComponent(pr_name);

  const url =
    frappe.urllib.get_base_url() +
    "/printview?doctype=Purchase Receipt" +
    "&name=" + encoded_name +
    "&trigger_print=1" +
    "&format=" + encodeURIComponent(print_format) +
    "&no_letterhead=" + letter_head;


  const printWindow = window.open(url, "Print");

  if (printWindow) {
    printWindow.addEventListener(
      "load",
      function () {
        printWindow.print();
      },
      true
    );
  }
},
    submit_old() {
      if (!this.supplier || this.items.length === 0) {
        frappe.msgprint(__('Please select supplier and add at least one item'));
        return;
      }
      
      const validItems = this.items.filter(i => i.item_code && i.qty > 0);
      if (validItems.length === 0) {
           frappe.msgprint(__('Please add valid items'));
           return;
      }

      this.submitting = true;
      frappe.call({
        method: 'posawesome.posawesome.api.posapp.create_purchase_receipt',
        args: {
          supplier: this.supplier,
          items: validItems,
          pos_profile: this.pos_profile.name,
        },
        callback: (r) => {
          this.submitting = false;
          if (!r.exc) {
            frappe.show_alert({
              message: __('Purchase Receipt Created'),
              indicator: 'green',
            });
            this.close();
          }
        },
      });
    },
  },
};
</script>