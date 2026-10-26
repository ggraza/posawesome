<template>
  <v-row justify="center">
    <v-dialog
      v-model="customerDialog"
      max-width="600px"
      @click:outside="clear_customer"
    >
      <v-card>
        <v-card-title>
          <span v-if="customer_id" class="text-h5 text-primary">{{
            __('Update Customer')
          }}</span>
          <span v-else class="text-h5 text-primary">{{
            __('Create Customer')
          }}</span>
        </v-card-title>
        <v-card-text class="pa-0">
          <v-container>
            <v-row>
              <v-col cols="12">
                <v-text-field
                  density="compact"
                  color="primary"
                  :label="frappe._('Customer Name') + ' *'"
                  bg-color="white"
                  hide-details
                  v-model="customer_name"
                ></v-text-field>
              </v-col>
              <v-col cols="6">
                <v-text-field
                  density="compact"
                  color="primary"
                  :label="frappe._('Tax ID')"
                  bg-color="white"
                  hide-details
                  v-model="tax_id"
                ></v-text-field>
              </v-col>
              <v-col cols="6">
                <v-text-field
                  density="compact"
                  color="primary"
                  :label="frappe._('Mobile No')"
                  bg-color="white"
                  hide-details
                  v-model="mobile_no"
                ></v-text-field>
              </v-col>
              <v-col cols="6">
                <v-text-field
                  density="compact"
                  color="primary"
                  :label="frappe._('Email Id')"
                  bg-color="white"
                  hide-details
                  v-model="email_id"
                ></v-text-field>
              </v-col>
              <v-col cols="6">
                <v-select
                  density="compact"
                  label="Gender"
                  :items="genders"
                  v-model="gender" item-title="text"
                ></v-select>
              </v-col>
              <v-col cols="6">
                <v-text-field
                  density="compact"
                  color="primary"
                  :label="frappe._('Referral Code')"
                  bg-color="white"
                  hide-details
                  v-model="referral_code"
                ></v-text-field>
              </v-col>
              <v-col cols="6">
                <v-menu
                  ref="birthday_menu"
                  v-model="birthday_menu"
                  :close-on-content-click="false"
                  transition="scale-transition"
                >
                  <template v-slot:activator="{ props }">
                    <v-text-field
                      v-model="birthday"
                      :label="frappe._('Birthday')"
                      readonly
                      density="compact"
                      clearable
                      hide-details
                      v-bind="props"
                      color="primary"
                    ></v-text-field>
                  </template>
                  <pos-date-picker
                    v-model="birthday"
                    color="primary"
                    :max="frappe.datetime.now_date()"
                    @update:model-value="birthday_menu = false"
                  >
                  </pos-date-picker>
                </v-menu>
              </v-col>
              <v-col cols="6">
                <v-autocomplete
                  clearable
                  density="compact"
                  auto-select-first
                  color="primary"
                  :label="frappe._('Customer Group') + ' *'"
                  v-model="group"
                  :items="groups"
                  bg-color="white"
                  :no-data-text="__('Group not found')"
                  hide-details
                  required item-title="text"
                >
                </v-autocomplete>
              </v-col>
              <v-col cols="6">
                <v-autocomplete
                  clearable
                  density="compact"
                  auto-select-first
                  color="primary"
                  :label="frappe._('Territory') + ' *'"
                  v-model="territory"
                  :items="territorys"
                  bg-color="white"
                  :no-data-text="__('Territory not found')"
                  hide-details
                  required item-title="text"
                >
                </v-autocomplete>
              </v-col>
              <v-col cols="6" v-if="loyalty_program">
                <v-text-field
                  v-model="loyalty_program"
                  :label="frappe._('Loyalty Program')"
                  density="compact"
                  readonly
                  hide-details
                ></v-text-field>
              </v-col>
              <v-col cols="6" v-if="loyalty_points">
                <v-text-field
                  v-model="loyalty_points"
                  :label="frappe._('Loyalty Points')"
                  density="compact"
                  readonly
                  hide-details
                ></v-text-field>
              </v-col>
            </v-row>
          </v-container>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="error" @click="close_dialog">{{
            __('Close')
          }}</v-btn>
          <v-btn color="success" @click="submit_dialog">{{
            __('Submit')
          }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-row>
</template>

<script>
import { evntBus } from '../../bus';
import offlinePos from '../../../offline';
export default {
  data: () => ({
    customerDialog: false,
    pos_profile: '',
    customer_id: '',
    customer_name: '',
    tax_id: '',
    mobile_no: '',
    email_id: '',
    referral_code: '',
    birthday: null,
    birthday_menu: false,
    group: '',
    groups: [],
    territory: '',
    territorys: [],
    genders: [],
    customer_type: 'Individual',
    gender: '',
    loyalty_points: null,
    loyalty_program: null,
  }),
  watch: {},
  methods: {
    close_dialog() {
      this.customerDialog = false;
      this.clear_customer();
    },
    clear_customer() {
      this.customer_name = '';
      this.tax_id = '';
      this.mobile_no = '';
      this.email_id = '';
      this.referral_code = '';
      this.birthday = '';
      this.group = frappe.defaults.get_user_default('Customer Group');
      this.territory = frappe.defaults.get_user_default('Territory');
      this.customer_id = '';
      this.customer_type = 'Individual';
      this.gender = '';
      this.loyalty_points = null;
      this.loyalty_program = null;
    },
    getCustomerGroups() {
      if (this.groups.length > 0) return;
      const vm = this;
      const boot = offlinePos.catalog.getMeta('bootstrap');
      if (offlinePos.useOffline() || (boot && boot.customer_groups)) {
        if (boot && boot.customer_groups) vm.groups = boot.customer_groups.slice();
        if (offlinePos.useOffline()) return;
      }
      frappe.db
        .get_list('Customer Group', {
          fields: ['name'],
          filters: { is_group: 0 },
          limit: 1000,
          order_by: 'name',
        })
        .then((data) => {
          if (data.length > 0) {
            data.forEach((el) => {
              vm.groups.push(el.name);
            });
          }
        });
    },
    getCustomerTerritorys() {
      if (this.territorys.length > 0) return;
      const vm = this;
      const boot = offlinePos.catalog.getMeta('bootstrap');
      if (offlinePos.useOffline()) {
        if (boot && boot.territories) vm.territorys = boot.territories.slice();
        return;
      }
      frappe.db
        .get_list('Territory', {
          fields: ['name'],
          filters: { is_group: 0 },
          limit: 5000,
          order_by: 'name',
        })
        .then((data) => {
          if (data.length > 0) {
            data.forEach((el) => {
              vm.territorys.push(el.name);
            });
          }
        });
    },
    getGenders() {
      const vm = this;
      if (offlinePos.useOffline()) return;
      frappe.db
        .get_list('Gender', {
          fields: ['name'],
          page_length: 10,
        })
        .then((data) => {
          if (data.length > 0) {
            data.forEach((el) => {
              vm.genders.push(el.name);
            });
          }
        });
    },
    submit_dialog() {
      // validate if all required fields are filled
      if (!this.customer_name) {
        evntBus.$emit('show_mesage', {
          text: __('Customer name is required.'),
          color: 'error',
        });
        return;
      }
      if (!this.group) {
        evntBus.$emit('show_mesage', {
          text: __('Customer group is required.'),
          color: 'error',
        });
        return;
      }
      if (!this.territory) {
        evntBus.$emit('show_mesage', {
          text: __('Customer territory is required.'),
          color: 'error',
        });
        return;
      }
      if (this.customer_name) {
        const vm = this;
        const args = {
          customer_id: this.customer_id,
          customer_name: this.customer_name,
          company: this.pos_profile.company,
          tax_id: this.tax_id,
          mobile_no: this.mobile_no,
          email_id: this.email_id,
          referral_code: this.referral_code,
          birthday: this.birthday,
          customer_group: this.group,
          territory: this.territory,
          customer_type: this.customer_type,
          gender: this.gender,
          method: this.customer_id ? 'update' : 'create',
          pos_profile_doc: this.pos_profile,
        };
        if (offlinePos.useOffline()) {
          // created on the server together with the first invoice that uses it
          if (vm.customer_id || !Number(this.pos_profile.posa_offline_allow_new_customer ?? 1)) {
            evntBus.$emit('show_mesage', { text: __('Customers can only be edited online'), color: 'error' });
            return;
          }
          offlinePos.addOfflineCustomer(args).then((row) => {
            evntBus.$emit('show_mesage', { text: __('Customer saved offline'), color: 'warning' });
            evntBus.$emit('add_customer_to_list', row);
            evntBus.$emit('set_customer', row.name);
            evntBus.$emit('fetch_customer_details');
            this.close_dialog();
          });
          return;
        }
        frappe.call({
          method: 'posawesome.posawesome.api.posapp.create_customer',
          args: args,
          callback: (r) => {
            if (!r.exc && r.message.name) {
              let text = __('Customer created successfully.');
              if (vm.customer_id) {
                text = __('Customer updated successfully.');
              }
              evntBus.$emit('show_mesage', {
                text: text,
                color: 'success',
              });
              args.name = r.message.name;
              frappe.utils.play_sound('submit');
              evntBus.$emit('add_customer_to_list', args);
              evntBus.$emit('set_customer', r.message.name);
              evntBus.$emit('fetch_customer_details');
              this.close_dialog();
            } else {
              frappe.utils.play_sound('error');
              evntBus.$emit('show_mesage', {
                text: __('Customer creation failed.'),
                color: 'error',
              });
            }
          },
        });
        this.customerDialog = false;
      }
    },
  },
  created: function () {
    evntBus.$on('open_update_customer', (data) => {
      this.customerDialog = true;
      if (data) {
        this.customer_name = data.customer_name;
        this.customer_id = data.name;
        this.tax_id = data.tax_id;
        this.mobile_no = data.mobile_no;
        this.email_id = data.email_id;
        this.referral_code = data.referral_code;
        this.birthday = data.birthday;
        this.group = data.customer_group;
        this.territory = data.territory;
        this.loyalty_points = data.loyalty_points;
        this.loyalty_program = data.loyalty_program;
        this.gender = data.gender;
      }
    });
    evntBus.$on('register_pos_profile', (data) => {
      this.pos_profile = data.pos_profile;
    });
    evntBus.$on('payments_register_pos_profile', (data) => {
      this.pos_profile = data.pos_profile;
    });
    this.getCustomerGroups();
    this.getCustomerTerritorys();
    this.getGenders();
    // set default values for customer group and territory from user defaults
    this.group = frappe.defaults.get_user_default('Customer Group');
    this.territory = frappe.defaults.get_user_default('Territory');
  },
};
</script>
