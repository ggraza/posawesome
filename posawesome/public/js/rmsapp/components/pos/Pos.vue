<template>
  <div fluid class="mt-2">
    <ClosingDialog></ClosingDialog>
    <Drafts></Drafts>
    <ExpenseInvoice></ExpenseInvoice>
    <SalesOrders></SalesOrders>
    <Returns></Returns>
    <NewAddress></NewAddress>
    <MpesaPayments></MpesaPayments>
    <Variants></Variants>
    <OpeningDialog v-if="dialog" :dialog="dialog"></OpeningDialog>
    <v-row v-show="!dialog" v-if="!pos_profile.posa_items_group_filter_on_right_side">
      <v-col
        v-show="!payment && !offers && !coupons && !holdinvoice && !submitedinvoice"
        xl="5"
        lg="5"
        md="5"
        sm="5"
        cols="12"
        class="pos pr-0"
      >
        <ItemsSelector></ItemsSelector>
      </v-col>
      <v-col
        v-show="offers"
        xl="5"
        lg="5"
        md="5"
        sm="5"
        cols="12"
        class="pos pr-0"
      >
        <PosOffers></PosOffers>
      </v-col>
      <v-col
        v-show="coupons"
        xl="5"
        lg="5"
        md="5"
        sm="5"
        cols="12"
        class="pos pr-0"
      >
        <PosCoupons></PosCoupons>
      </v-col>
      <v-col
        v-show="payment"
        xl="5"
        lg="5"
        md="5"
        sm="5"
        cols="12"
        class="pos pr-0"
      >
        <Payments></Payments>
      </v-col>
      <v-col
        v-show="holdinvoice"
        xl="5"
        lg="5"
        md="5"
        sm="5"
        cols="12"
        class="pos pr-0"
      >
        <HoldInvoice></HoldInvoice>
      </v-col>
      <v-col
        v-show="submitedinvoice"
        xl="5"
        lg="5"
        md="5"
        sm="5"
        cols="12"
        class="pos pr-0"
      >
        <SubmitedInvoice></SubmitedInvoice>
      </v-col>
      <v-col xl="7" lg="7" md="7" sm="7" cols="12" class="pos">
        <Invoice></Invoice>
      </v-col>
    </v-row>
    <v-row v-show="!dialog" v-if="pos_profile.posa_items_group_filter_on_right_side">
      <v-col
        v-show="!payment && !offers && !coupons && !holdinvoice && !submitedinvoice"
        xl="6"
        lg="6"
        md="6"
        sm="6"
        cols="12"
        class="pos pr-0"
      >
        <ItemsSelector></ItemsSelector>
      </v-col>
      <v-col
        v-show="offers"
        xl="6"
        lg="6"
        md="6"
        sm="6"
        cols="12"
        class="pos pr-0"
      >
        <PosOffers></PosOffers>
      </v-col>
      <v-col
        v-show="coupons"
        xl="6"
        lg="6"
        md="6"
        sm="6"
        cols="12"
        class="pos pr-0"
      >
        <PosCoupons></PosCoupons>
      </v-col>
      <v-col
        v-show="payment"
        xl="6"
        lg="6"
        md="6"
        sm="6"
        cols="12"
        class="pos pr-0"
      >
        <Payments></Payments>
      </v-col>
      <v-col
        v-show="holdinvoice"
        xl="6"
        lg="6"
        md="6"
        sm="6"
        cols="12"
        class="pos pr-0"
      >
        <HoldInvoice></HoldInvoice>
      </v-col>
      <v-col
        v-show="submitedinvoice"
        xl="6"
        lg="6"
        md="6"
        sm="6"
        cols="12"
        class="pos pr-0"
      >
        <SubmitedInvoice></SubmitedInvoice>
      </v-col>
      <v-col xl="6" lg="6" md="6" sm="6" cols="12" class="pos">
        <Invoice></Invoice>
      </v-col>
    </v-row>
  </div>
</template>

<script>
import { evntBus } from '../../bus';
import ItemsSelector from './ItemsSelector.vue';
import Invoice from './Invoice.vue';
import OpeningDialog from './OpeningDialog.vue';
import Payments from './Payments.vue';
import PosOffers from './PosOffers.vue';
import PosCoupons from './PosCoupons.vue';
import Drafts from './Drafts.vue';
import ExpenseInvoice from './ExpenseInvoice.vue';
import SalesOrders from './SalesOrders.vue';
import ClosingDialog from './ClosingDialog.vue';
import NewAddress from './NewAddress.vue';
import Variants from './Variants.vue';
import Returns from './Returns.vue';
import MpesaPayments from './Mpesa-Payments.vue';
import HoldInvoice from './HoldInvoice.vue';
import SubmitedInvoice from './SubmitedInvoice.vue';
import offlinePos from '../../../offline';
import { serverCall, NetworkError } from '../../../offline/network';

export default {
  // keep-alive in Home.vue matches on the component name (Vue 3 no longer uses the tag)
  name: 'POS',
  data: function () {
    return {
      dialog: false,
      pos_profile: '',
      pos_opening_shift: '',
      payment: false,
      offers: false,
      coupons: false,
      holdinvoice: false,
      submitedinvoice: false,
    };
  },

  components: {
    ItemsSelector,
    Invoice,
    OpeningDialog,
    Payments,
    Drafts,
    ExpenseInvoice,
    ClosingDialog,

    Returns,
    PosOffers,
    PosCoupons,
    NewAddress,
    Variants,
    MpesaPayments,
    SalesOrders,
    HoldInvoice,
    SubmitedInvoice,
  },

  methods: {
    register(data) {
      this.pos_profile = data.pos_profile;
      this.pos_opening_shift = data.pos_opening_shift;
      // offline cache first so components can use it when they react to the event
      return offlinePos
        .init(data)
        .catch((e) => console.error('[posawesome] offline init failed', e))
        .then(() => {
          this.get_offers(this.pos_profile.name);
          evntBus.$emit('register_pos_profile', data);
          evntBus.$emit('set_company', data.company);
          console.info('LoadPosProfile');
        });
    },
    check_opening_entry() {
      return serverCall('posawesome.posawesome.api.posapp.check_opening_shift', {
        user: frappe.session.user,
      })
        .then((message) => {
          if (message) {
            return this.register(message);
          }
          this.create_opening_voucher();
        })
        .catch((e) => {
          if (e instanceof NetworkError) {
            // server unreachable: continue with the shift saved by the last online start
            const cached = offlinePos.lastOpeningData();
            if (cached && cached.pos_profile && Number(cached.pos_profile.posa_enable_offline)) {
              evntBus.$emit('show_mesage', {
                text: __('Server unreachable - working offline with shift {0}', [cached.pos_opening_shift.name]),
                color: 'warning',
              });
              return this.register(cached);
            }
            frappe.msgprint(__('The server cannot be reached and this POS has no offline data yet.'));
            return;
          }
          frappe.msgprint(e.message);
        });
    },
    create_opening_voucher() {
      this.dialog = true;
    },
    get_closing_data() {
      return frappe
        .call(
          'posawesome.posawesome.doctype.pos_closing_shift.pos_closing_shift.make_closing_shift_from_opening',
          {
            opening_shift: this.pos_opening_shift,
          }
        )
        .then((r) => {
          if (r.message) {
            evntBus.$emit('open_ClosingDialog', r.message);
          } else {
            // console.log(r);
          }
        });
    },
    submit_closing_pos(data) {
      frappe
        .call(
          'posawesome.posawesome.doctype.pos_closing_shift.pos_closing_shift.submit_closing_shift',
          {
            closing_shift: data,
          }
        )
        .then((r) => {
          if (r.message) {
            //vm.load_print_page();
            this.load_print_page(r.message);
            evntBus.$emit('show_mesage', {
              text: `POS Shift Closed  ${r.message} .`,
              color: 'success',
            });
            this.check_opening_entry();
            frappe.utils.play_sound("submit");
          } else {
            console.log(r);
          }
        });
    },
    load_print_page(closing_shift_name) {
      const print_format = this.pos_profile.custom_closing_shift_print_format;
      const letter_head = this.pos_profile.letter_head || 0;
      // Construct the URL for printing the closing shift
      const url =
        frappe.urllib.get_base_url() +
        "/printview?doctype=POS Closing Shift&name=" +
        closing_shift_name +
        "&trigger_print=1" +
        "&format=" +
        print_format +
        "&no_letterhead=" +
        letter_head;
    
      // Open a new window for printing
      const printWindow = window.open(url, "Print");
      printWindow.addEventListener(
        "load",
        function () {
          printWindow.print();
          // Uncomment the following line to close the print window automatically after printing
          // printWindow.close();
        },
        true
      );
    },
    get_offers(pos_profile) {
      if (offlinePos.enabled) {
        const boot = offlinePos.catalog.getMeta('bootstrap');
        if (boot && boot.offers && (offlinePos.useOffline() || !this.$_offersLoaded)) {
          evntBus.$emit('set_offers', boot.offers);
        }
        if (offlinePos.useOffline()) return Promise.resolve();
      }
      this.$_offersLoaded = true;
      return frappe
        .call('posawesome.posawesome.api.posapp.get_offers', {
          profile: pos_profile,
        })
        .then((r) => {
          if (r.message) {
            console.info('LoadOffers');
            evntBus.$emit('set_offers', r.message);
          }
        });
    },
    get_pos_setting() {
      serverCall('frappe.client.get', { doctype: 'POS Settings', name: 'POS Settings' })
        .then((doc) => {
          try {
            localStorage.setItem('posa_pos_settings', JSON.stringify(doc));
          } catch (e) {}
          evntBus.$emit('set_pos_settings', doc);
        })
        .catch(() => {
          try {
            const doc = JSON.parse(localStorage.getItem('posa_pos_settings') || 'null');
            if (doc) evntBus.$emit('set_pos_settings', doc);
          } catch (e) {}
        });
    },
  },

  mounted: function () {
    this.$nextTick(function () {
      this.check_opening_entry();
      this.get_pos_setting();
      evntBus.$on('close_opening_dialog', () => {
        this.dialog = false;
      });
      evntBus.$on('register_pos_data', (data) => {
        this.register(data);
      });
      evntBus.$on('show_payment', (data) => {
        this.payment = true ? data === 'true' : false;
        this.offers = false ? data === 'true' : false;
        this.coupons = false ? data === 'true' : false;
        this.holdinvoice = false ? data === 'true' : false;
        this.submitedinvoice = false ? data === 'true' : false;
      });
      evntBus.$on('show_offers', (data) => {
        this.offers = true ? data === 'true' : false;
        this.payment = false ? data === 'true' : false;
        this.coupons = false ? data === 'true' : false;
        this.holdinvoice = false ? data === 'true' : false;
        this.submitedinvoice = false ? data === 'true' : false;
      });
      evntBus.$on('show_coupons', (data) => {
        this.coupons = true ? data === 'true' : false;
        this.offers = false ? data === 'true' : false;
        this.payment = false ? data === 'true' : false;
        this.holdinvoice = false ? data === 'true' : false;
        this.submitedinvoice = false ? data === 'true' : false;
      });
      evntBus.$on('show_hold', (data) => {
        this.holdinvoice = true ? data === 'true': false;
        this.coupons = false ? data === 'true' : false;
        this.offers = false ? data === 'true' : false;
        this.payment = false ? data === 'true' : false;
        this.submitedinvoice = false ? data === 'true' : false;
        console.info('LoadHoldInvoice', data);
      });
      evntBus.$on('show_invoices', (data) => {
        this.submitedinvoice = true ? data === 'true': false;
        this.coupons = false ? data === 'true' : false;
        this.offers = false ? data === 'true' : false;
        this.payment = false ? data === 'true' : false;
        this.holdinvoice = false ? data === 'true' : false;
        console.info('LoadSubmitedInvoice', data);
      });
      evntBus.$on('open_closing_dialog', () => {
        this.get_closing_data();
      });
      evntBus.$on('submit_closing_pos', (data) => {
        this.submit_closing_pos(data);
      });
    });
  },
  beforeUnmount() {
    evntBus.$off('close_opening_dialog');
    evntBus.$off('register_pos_data');
    evntBus.$off('LoadPosProfile');
    evntBus.$off('show_offers');
    evntBus.$off('show_coupons');
    evntBus.$off('show_hold');
    evntBus.$off('show_invoices');
    evntBus.$off('open_closing_dialog');
    evntBus.$off('submit_closing_pos');
  },
};
</script>

<style scoped></style>
