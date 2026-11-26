<template>
  <v-row justify="center">
    <v-dialog v-model="posoffersDialog" max-width="900px" persistent>
      <!-- <template v-slot:activator="{ on, attrs }">
        <v-btn color="primary" dark v-bind="attrs" v-on="on">Open Dialog</v-btn>
      </template>-->
      <div>
        <v-card
          class="selection mx-auto grey lighten-5"
        >
          <v-card-title>
            <span class="text-h6 primary--text">{{ __('Offers') }}</span>
          </v-card-title>
          <div class="my-0 py-0 overflow-y-auto" style="max-height: 75vh">
            <template @mouseover="style = 'cursor: pointer'">
              <v-data-table
                :headers="items_headers"
                :items="pos_offers"
                :single-expand="singleExpand"
                :expanded.sync="expanded"
                show-expand
                item-key="row_id"
                class="elevation-1"
                :items-per-page="itemsPerPage"
                hide-default-footer
              >
                <template v-slot:item.offer_applied="{ item }">
                  <v-simple-checkbox
                    @click="forceUpdateItem"
                    v-model="item.offer_applied"
                    :disabled="
                      (item.offer == 'Give Product' &&
                        !item.give_item &&
                        (!offer.replace_cheapest_item || !offer.replace_item)) ||
                      (item.offer == 'Grand Total' &&
                        discount_percentage_offer_name &&
                        discount_percentage_offer_name != item.name)
                    "
                  ></v-simple-checkbox>
                </template>
                <template v-slot:expanded-item="{ headers, item }">
                  <td :colspan="headers.length">
                    <v-row class="mt-2">
                      <v-col v-if="item.description">
                        <div
                          class="primary--text"
                          v-html="handleNewLine(item.description)"
                        ></div>
                      </v-col>
                      <v-col v-if="item.offer == 'Give Product'">
                        <v-autocomplete
                          v-model="item.give_item"
                          :items="get_give_items(item)"
                          item-text="item_name"
                          item-value="item_code"
                          outlined
                          dense
                          color="primary"
                          :label="frappe._('Give Item')"
                          :disabled="
                            item.apply_type != 'Item Group' ||
                            item.replace_item ||
                            item.replace_cheapest_item
                          "
           >
             <template v-slot:item="{ item }">
                   <v-list-item-subtitle>
                   <span class="primary--text">{{ item.item_name }}</span>
                     <br/>
                     <span style="color: #486472">{{ __('#') }}: {{ item.item_code }}</span> |
                     <span style="color: #ba0806"> {{ currencySymbol(item.currency) }} {{ formtCurrency(item.rate) }}</span> |
                     <span class="text-caption golden--text">{{ __('A-QTY') }}: {{ item.actual_qty }}</span>
                     <br/>
                     <!-- Display barcode information -->
                     <span v-for="barcode in item.item_barcode" :key="barcode.barcode">
                       {{ __('UPC') }}: {{ barcode.barcode }} |
                       {{ __('UOM') }}: {{ item.stock_uom }}
                     </span>
                   </v-list-item-subtitle>
             </template>
                        ></v-autocomplete>
                      </v-col>
                    </v-row>
                  </td>
                </template>
              </v-data-table>
            </template>
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
                @click="back_to_invoice"
                >{{ __('Back') }}</v-btn
              >
            </v-col>
          </v-row>
        </v-card>
      </div>
    </v-dialog>
  </v-row>
</template>

<script>
import { evntBus } from '../../bus';
import format from '../../format';
export default {
  mixins: [format],
  data: () => ({
    posoffersDialog: false,
    loading: false,
    pos_profile: '',
    pos_offers: [],
    allItems: [],
    discount_percentage_offer_name: null,
    itemsPerPage: 1000,
    expanded: [],
    singleExpand: true,
    items_headers: [
      { text: __('Name'), value: 'name', align: 'start' },
      { text: __('Apply On'), value: 'apply_on', align: 'start' },
      { text: __('Offer'), value: 'offer', align: 'start' },
      { text: __('Applied'), value: 'offer_applied', align: 'start' },
    ],
  }),

  computed: {
    offersCount() {
      return this.pos_offers.length;
    },
    appliedOffersCount() {
      return this.pos_offers.filter((el) => !!el.offer_applied).length;
    },
  },

  methods: {
    close_dialog() {
      this.posoffersDialog = false;
    },
    back_to_invoice() {
      evntBus.$emit('show_offers', 'false');
      this.$root.$emit('escEventTriggered');
      evntBus.$emit('escEventTriggered');
      this.posoffersDialog = false;
    },
    forceUpdateItem() {
      let list_offers = [];
      list_offers = [...this.pos_offers];
      this.pos_offers = list_offers;
    },
    makeid(length) {
      let result = '';
      const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
      const charactersLength = characters.length;
      for (var i = 0; i < length; i++) {
        result += characters.charAt(
          Math.floor(Math.random() * charactersLength)
        );
      }
      return result;
    },
    updatePosOffers(offers) {
      const toRemove = [];
      this.pos_offers.forEach((pos_offer) => {
        const offer = offers.find((offer) => offer.name === pos_offer.name);
        if (!offer) {
          toRemove.push(pos_offer.row_id);
        }
      });
      this.removeOffers(toRemove);
      offers.forEach((offer) => {
        const pos_offer = this.pos_offers.find(
          (pos_offer) => offer.name === pos_offer.name
        );
        if (pos_offer) {
          pos_offer.items = offer.items;
          if (
            pos_offer.offer === 'Grand Total' &&
            !this.discount_percentage_offer_name
          ) {
            pos_offer.offer_applied = !!pos_offer.auto;
          }
          if (
            offer.apply_on == 'Item Group' &&
            offer.apply_type == 'Item Group' &&
            offer.replace_cheapest_item
          ) {
            pos_offer.give_item = offer.give_item;
            pos_offer.apply_item_code = offer.apply_item_code;
          }
        } else {
          const newOffer = { ...offer };
          if (!offer.row_id) {
            newOffer.row_id = this.makeid(20);
          }
          if (offer.apply_type == 'Item Code') {
            newOffer.give_item = offer.apply_item_code || 'Nothing';
          }
          if (offer.offer_applied) {
            newOffer.offer_applied == !!offer.offer_applied;
          } else {
            if (
              offer.apply_type == 'Item Group' &&
              offer.offer == 'Give Product' &&
              !offer.replace_cheapest_item &&
              !offer.replace_item
            ) {
              newOffer.offer_applied = false;
            } else if (
              offer.offer === 'Grand Total' &&
              this.discount_percentage_offer_name
            ) {
              newOffer.offer_applied = false;
            } else {
              newOffer.offer_applied = !!offer.auto;
            }
          }
          if (newOffer.offer == 'Give Product' && !newOffer.give_item) {
            newOffer.give_item = this.get_give_items(newOffer)[0].item_code;
          }
          this.pos_offers.push(newOffer);
          evntBus.$emit('show_mesage', {
            text: __('New Offer Available'),
            color: 'warning',
          });
        }
      });
    },
    removeOffers(offers_id_list) {
      this.pos_offers = this.pos_offers.filter(
        (offer) => !offers_id_list.includes(offer.row_id)
      );
    },
    handelOffers() {
      const applyedOffers = this.pos_offers.filter(
        (offer) => offer.offer_applied
      );
      evntBus.$emit('update_invoice_offers', applyedOffers);
    },
    handleNewLine(str) {
      if (str) {
        return str.replace(/(?:\r\n|\r|\n)/g, '<br />');
      } else {
        return '';
      }
    },
    get_give_items(offer) {
      if (offer.apply_type == 'Item Code') {
        return [offer.apply_item_code];
      } else if (offer.apply_type == 'Item Group') {
        const items = this.allItems;
        let filterd_items = [];
        const filterd_items_1 = items.filter(
          (item) => item.item_group == offer.apply_item_group
        );
        if (offer.less_then > 0) {
          filterd_items = filterd_items_1.filter(
            (item) => item.rate < offer.less_then
          );
        } else {
          filterd_items = filterd_items_1;
        }
        return filterd_items;
      } else {
        return [];
      }
    },
    updateCounters() {
      evntBus.$emit('update_offers_counters', {
        offersCount: this.offersCount,
        appliedOffersCount: this.appliedOffersCount,
      });
    },
    updatePosCoupuns() {
      const applyedOffers = this.pos_offers.filter(
        (offer) => offer.offer_applied && offer.coupon_based
      );
      evntBus.$emit('update_pos_coupons', applyedOffers);
    },
  },

  watch: {
    pos_offers: {
      deep: true,
      handler(pos_offers) {
        this.handelOffers();
        this.updateCounters();
        this.updatePosCoupuns();
      },
    },
  },

  created: function () {
    evntBus.$on('show_offers', (data) => {
      this.posoffersDialog = true;
    });
    this.$nextTick(function () {
      evntBus.$on('register_pos_profile', (data) => {
        this.pos_profile = data.pos_profile;
      });
    });
    evntBus.$on('update_customer', (customer) => {
      if (this.customer != customer) {
        this.offers = [];
      }
    });
    evntBus.$on('update_pos_offers', (data) => {
      this.updatePosOffers(data);
    });
    evntBus.$on('update_discount_percentage_offer_name', (data) => {
      this.discount_percentage_offer_name = data.value;
    });
    evntBus.$on('set_all_items', (data) => {
      this.allItems = data;
    });
  },
};
</script>
