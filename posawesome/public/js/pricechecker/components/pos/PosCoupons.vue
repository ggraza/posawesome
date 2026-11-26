<template>
  <v-row justify="center">
    <v-dialog v-model="poscouponsDialog" max-width="900px" persistent>
      <div>
        <v-card class="selection mx-auto grey lighten-5">
          <v-card-title>
            <v-row no-gutters align="center" justify="center">
              <v-col cols="6">
                <span class="text-h6 primary--text">{{ __('Coupons') }}</span>
              </v-col>
              <v-col cols="4">
                <v-text-field
                  dense
                  outlined
                  color="primary"
                  :label="__('Coupon')"
                  background-color="white"
                  hide-details
                  v-model="newCoupon"
                  class="mr-4"
                ></v-text-field>
              </v-col>
              <v-col cols="2">
                <v-btn
                  class="pa-1"
                  color="success"
                  dark
                  @click="addCoupon"
                >
                  {{ __('Add') }}
                </v-btn>
              </v-col>
            </v-row>
          </v-card-title>
          <div class="my-0 py-0 overflow-y-auto" style="max-height: 75vh">
            <v-data-table
              :headers="itemsHeaders"
              :items="posaCoupons"
              :single-expand="singleExpand"
              :expanded.sync="expanded"
              item-key="coupon"
              class="elevation-1"
              :items-per-page="itemsPerPage"
              hide-default-footer
            >
              <template v-slot:item.applied="{ item }">
                <v-simple-checkbox
                  v-model="item.applied"
                  disabled
                ></v-simple-checkbox>
              </template>
            </v-data-table>
          </div>
        </v-card>

        <v-card>
          <v-row align="start" no-gutters>
            <v-col cols="12">
              <v-btn
                block
                class="pa-1"
                large
                color="warning"
                dark
                @click="backToInvoice"
              >
                {{ __('Back') }}
              </v-btn>
            </v-col>
          </v-row>
        </v-card>
      </div>
    </v-dialog>
  </v-row>
</template>

<script>
import { evntBus } from '../../bus';

export default {
  data: () => ({
    poscouponsDialog: false,
    loading: false,
    posProfile: '',
    customer: '',
    posaCoupons: [],
    newCoupon: null,
    itemsPerPage: 1000,
    singleExpand: true,
    itemsHeaders: [
      { text: __('Coupon'), value: 'coupon_code', align: 'start' },
      { text: __('Type'), value: 'type', align: 'start' },
      { text: __('Offer'), value: 'pos_offer', align: 'start' },
      { text: __('Applied'), value: 'applied', align: 'start' },
    ],
  }),

  computed: {
    couponsCount() {
      return this.posaCoupons.length;
    },
    appliedCouponsCount() {
      return this.posaCoupons.filter((el) => !!el.applied).length;
    },
  },

  methods: {
    backToInvoice() {
      evntBus.$emit('show_coupons', false);
      this.$root.$emit('escEventTriggered');
      evntBus.$emit('escEventTriggered');
      this.poscouponsDialog = false;
    },
    addCoupon() {
      if (!this.customer || !this.newCoupon) return;
      const existingCoupon = this.posaCoupons.find(
        (el) => el.coupon_code === this.newCoupon
      );
      if (existingCoupon) {
        this.showMessage(__('This coupon is already used!'), 'error');
        return;
      }

      frappe.call({
        method: 'posawesome.posawesome.api.posapp.get_pos_coupon',
        args: {
          coupon: this.newCoupon,
          customer: this.customer,
          company: this.posProfile.company,
        },
        callback: (r) => {
          if (r.message) {
            const res = r.message;
            if (res.msg !== 'Apply' || !res.coupon) {
              this.showMessage(res.msg, 'error');
            } else {
              this.newCoupon = null;
              const coupon = res.coupon;
              this.posaCoupons.push({
                coupon: coupon.name,
                coupon_code: coupon.coupon_code,
                type: coupon.coupon_type,
                applied: false,
                pos_offer: coupon.pos_offer,
                customer: coupon.customer || this.customer,
              });
            }
          }
        },
      });
    },
    setActiveGiftCoupons() {
      if (!this.customer) return;

      frappe.call({
        method: 'posawesome.posawesome.api.posapp.get_active_gift_coupons',
        args: {
          customer: this.customer,
          company: this.posProfile.company,
        },
        callback: (r) => {
          if (r.message) {
            r.message.forEach((couponCode) => {
              this.addCouponByCode(couponCode);
            });
          }
        },
      });
    },
    addCouponByCode(couponCode) {
      if (!this.customer || !couponCode) return;

      const existingCoupon = this.posaCoupons.find(
        (el) => el.coupon_code === couponCode
      );
      if (existingCoupon) return;

      frappe.call({
        method: 'posawesome.posawesome.api.posapp.get_pos_coupon',
        args: {
          coupon: couponCode,
          customer: this.customer,
          company: this.posProfile.company,
        },
        callback: (r) => {
          if (r.message) {
            const res = r.message;
            if (res.msg === 'Apply' && res.coupon) {
              const coupon = res.coupon;
              this.posaCoupons.push({
                coupon: coupon.name,
                coupon_code: coupon.coupon_code,
                type: coupon.coupon_type,
                applied: false,
                pos_offer: coupon.pos_offer,
                customer: coupon.customer || this.customer,
              });
            }
          }
        },
      });
    },
    updatePosCoupons(offers) {
      this.posaCoupons.forEach((coupon) => {
        const offer = offers.find(
          (el) => el.offer_applied && el.coupon === coupon.coupon
        );
        coupon.applied = !!offer;
      });
    },
    removeCoupon(couponsToRemove) {
      this.posaCoupons = this.posaCoupons.filter(
        (coupon) => !couponsToRemove.includes(coupon.coupon)
      );
    },
    updateInvoice() {
      evntBus.$emit('update_invoice_coupons', this.posaCoupons);
    },
    updateCounters() {
      evntBus.$emit('update_coupons_counters', {
        couponsCount: this.couponsCount,
        appliedCouponsCount: this.appliedCouponsCount,
      });
    },
    showMessage(text, color) {
      evntBus.$emit('show_message', { text, color });
    },
  },

  watch: {
    posaCoupons: {
      deep: true,
      handler() {
        this.updateInvoice();
        this.updateCounters();
      },
    },
  },

  created() {
    evntBus.$on('show_coupons', () => {
      this.poscouponsDialog = true;
    });

    this.$nextTick(() => {
      evntBus.$on('register_pos_profile', (data) => {
        this.posProfile = data.pos_profile;
      });
    });

    evntBus.$on('update_customer', (customer) => {
      if (this.customer !== customer) {
        const toRemove = [];
        this.posaCoupons.forEach((coupon) => {
          if (coupon.type === 'Promotional') {
            coupon.customer = customer;
          } else {
            toRemove.push(coupon.coupon);
          }
        });
        this.customer = customer;
        if (toRemove.length) {
          this.removeCoupon(toRemove);
        }
      }
      this.setActiveGiftCoupons();
    });

    evntBus.$on('update_pos_coupons', (data) => {
      this.updatePosCoupons(data);
    });

    evntBus.$on('set_pos_coupons', (data) => {
      this.posaCoupons = data;
    });
  },
};
</script>
