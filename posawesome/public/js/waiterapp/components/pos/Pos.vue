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
    <v-row v-show="!dialog">
      <v-col
        v-show="!payment && !offers && !coupons && !holdinvoice && !submitedinvoice && !invoice && !tableselector"
        xl="12"
        lg="12"
        md="12"
        sm="12"
        cols="12"
        class="pos pr-0"
      >
        <ItemsSelector></ItemsSelector>
      </v-col>
      <v-col
        v-show="tableselector"
        xl="12"
        lg="12"
        md="12"
        sm="12"
        cols="12"
        class="pos pr-0"
      >
        <TableSelector></TableSelector>
      </v-col>
      <v-col
        v-show="offers"
        xl="12"
        lg="12"
        md="12"
        sm="12"
        cols="12"
        class="pos pr-0"
      >
        <PosOffers></PosOffers>
      </v-col>
      <v-col
        v-show="coupons"
        xl="12"
        lg="12"
        md="12"
        sm="12"
        cols="12"
        class="pos pr-0"
      >
        <PosCoupons></PosCoupons>
      </v-col>
      <v-col
        v-show="payment"
        xl="12"
        lg="12"
        md="12"
        sm="12"
        cols="12"
        class="pos pr-0"
      >
        <Payments></Payments>
      </v-col>
      <v-col
        v-show="holdinvoice"
        xl="12"
        lg="12"
        md="12"
        sm="12"
        cols="12"
        class="pos pr-0"
      >
        <HoldInvoice></HoldInvoice>
      </v-col>
      <v-col
        v-show="submitedinvoice"
        xl="12"
        lg="12"
        md="12"
        sm="12"
        cols="12"
        class="pos pr-0"
      >
        <SubmitedInvoice></SubmitedInvoice>
      </v-col>
      <v-col
        v-show="invoice"
        xl="12"
        lg="12"
        md="12"
        sm="12"
        cols="12"
        class="pos pr-0"
      >
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
import TableSelector from './TableSelector.vue';

export default {
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
      invoice: false,
      tableselector: false,
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
    TableSelector,
  },

  methods: {
check_opening_entry() {
    return frappe.call(
        "posawesome.posawesome.api.posapp.check_opening_shift_captain",
        {
            user: frappe.session.user,
        }
    ).then((r) => {

        if (!r.message) {
            return;
        }

        const data = r.message;

        if (data.status === "no_pos_profile") {
            frappe.msgprint({
                title: __("No Branch Assignment"),
                indicator: "red",
                message: __(
                    "You are not assigned to any restaurant or branch. Please contact your administrator."
                ),
            });

            return;
        }

        if (data.status === "no_opening_shift") {
            frappe.msgprint({
                title: __("Opening Shift Required"),
                indicator: "orange",
                message: __(
                    "There is no open shift for your assigned POS Profile. Please create an opening shift first."
                ),
            });

            return;
        }

        // Success
        this.pos_profile = data.pos_profile;
        this.pos_opening_shift = data.pos_opening_shift;

        this.get_offers(this.pos_profile.name);

        evntBus.$emit("register_pos_profile", data);
        evntBus.$emit("set_company", data.pos_profile.company);
    });
},
    check_opening_entry_cashier() {
      return frappe
        .call('posawesome.posawesome.api.posapp.check_opening_shift', {
          user: frappe.session.user,
        })
        .then((r) => {
          if (r.message) {
            this.pos_profile = r.message.pos_profile;
            this.pos_opening_shift = r.message.pos_opening_shift;
            this.get_offers(this.pos_profile.name);
            evntBus.$emit('register_pos_profile', r.message);
            evntBus.$emit('set_company', r.message.company);
            console.info('LoadPosProfile');
          } else {
            this.create_opening_voucher();
          }
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
      frappe.db.get_doc('POS Settings', undefined).then((doc) => {
        evntBus.$emit('set_pos_settings', doc);
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
        this.pos_profile = data.pos_profile;
        this.get_offers(this.pos_profile.name);
        this.pos_opening_shift = data.pos_opening_shift;
        evntBus.$emit('register_pos_profile', data);
        console.info('LoadPosProfile');
      });
      evntBus.$on('show_payment', (data) => {
        this.payment = true ? data === 'true' : false;
        this.offers = false ? data === 'true' : false;
        this.coupons = false ? data === 'true' : false;
        this.holdinvoice = false ? data === 'true' : false;
        this.submitedinvoice = false ? data === 'true' : false;
        this.invoice = false ? data === 'true': false;
        this.tableselector = false ? data === 'true': false;
      });
      evntBus.$on('show_offers', (data) => {
        this.offers = true ? data === 'true' : false;
        this.payment = false ? data === 'true' : false;
        this.coupons = false ? data === 'true' : false;
        this.holdinvoice = false ? data === 'true' : false;
        this.submitedinvoice = false ? data === 'true' : false;
        this.invoice = false ? data === 'true': false;
        this.tableselector = false ? data === 'true': false;
      });
      evntBus.$on('show_coupons', (data) => {
        this.coupons = true ? data === 'true' : false;
        this.offers = false ? data === 'true' : false;
        this.payment = false ? data === 'true' : false;
        this.holdinvoice = false ? data === 'true' : false;
        this.submitedinvoice = false ? data === 'true' : false;
        this.invoice = false ? data === 'true': false;
        this.tableselector = false ? data === 'true': false;
      });
      evntBus.$on('show_hold', (data) => {
        this.holdinvoice = true ? data === 'true': false;
        this.coupons = false ? data === 'true' : false;
        this.offers = false ? data === 'true' : false;
        this.payment = false ? data === 'true' : false;
        this.submitedinvoice = false ? data === 'true' : false;
        console.info('LoadHoldInvoice', data);
        this.invoice = false ? data === 'true': false;
        this.tableselector = false ? data === 'true': false;
      });
      evntBus.$on('show_invoices', (data) => {
        this.submitedinvoice = true ? data === 'true': false;
        this.coupons = false ? data === 'true' : false;
        this.offers = false ? data === 'true' : false;
        this.payment = false ? data === 'true' : false;
        this.holdinvoice = false ? data === 'true' : false;
        this.invoice = false ? data === 'true': false;
        this.tableselector = false ? data === 'true': false;
        console.info('LoadSubmitedInvoice', data);
      });
      evntBus.$on('open_closing_dialog', () => {
        this.get_closing_data();
      });
      evntBus.$on('submit_closing_pos', (data) => {
        this.submit_closing_pos(data);
      });
      evntBus.$on('show_cart', (data) => {
        this.invoice = true ? data === 'true': false;
        this.holdinvoice = false ? data === 'true': false;
        this.coupons = false ? data === 'true' : false;
        this.offers = false ? data === 'true' : false;
        this.payment = false ? data === 'true' : false;
        this.submitedinvoice = false ? data === 'true' : false;
        this.tableselector = false ? data === 'true': false;
        console.info('LoadInvoice', data);
      });
      evntBus.$on('show_table', (data) => {
        this.tableselector = data === 'true';
        this.invoice = false ? data === 'true': false;
        this.holdinvoice = false ? data === 'true': false;
        this.coupons = false ? data === 'true' : false;
        this.offers = false ? data === 'true' : false;
        this.payment = false ? data === 'true' : false;
        this.submitedinvoice = false ? data === 'true' : false;
        console.info('LoadTables', data);
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
    evntBus.$off('show_cart');
    evntBus.$off('open_closing_dialog');
    evntBus.$off('submit_closing_pos');
    evntBus.$off('show_table');
  },
};
</script>

<style scoped></style>
