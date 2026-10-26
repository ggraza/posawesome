<template>
  <div>
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
        <v-col class="pb-0 mb-2" v-if="pos_profile.posa_touch_screen">
          <v-text-field
            density="compact"
            clearable
            autofocus
            variant="outlined"
            color="primary"
            :label="frappe._('Search Items')"
            hint="Search by item code, serial number, batch no or barcode"
            bg-color="white"
            hide-details
            v-model="debounce_search"
            prepend-inner-icon="mdi-magnify"
            class="enhanced-field"
            :class="{ 'field-focused': debounce_search }"
            @keydown.esc="esc_event"
            @keydown.enter="enter_or_select"
            @keydown.down="move_selection('down', $event)"
            @keydown.up="move_selection('up', $event)"
            @keydown.left="move_selection('left', $event)"
            @keydown.right="move_selection('right', $event)"
            ref="debounce_search"
          ></v-text-field>
        </v-col>
        <v-col class="pb-0 mb-2" v-if="pos_profile.posa_input_qty && pos_profile.posa_mandatory_input_qty && !pos_profile.posa_mandatory_select_uom">
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
            :label="frappe._('Select Items')"
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
            v-model="selectedItemCode"
          >
            <template v-slot:item="{ item, props }">
              <v-list-item v-bind="props" :title="null" @click="selectItem_qty(item.raw)">
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
        <v-col class="pb-0 mb-2" v-if="pos_profile.posa_input_qty && pos_profile.posa_mandatory_input_qty && pos_profile.posa_mandatory_select_uom">
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
            :label="frappe._('Select Items')"
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
            v-model="selectedItemCode"
          >
            <template v-slot:item="{ item, props }">
              <v-list-item v-bind="props" :title="null" @click="selectItem(item.raw)">
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
        <v-col class="pb-0 mb-2" v-if="!pos_profile.posa_touch_screen && !pos_profile.posa_mandatory_input_qty">
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
              <v-list-item v-bind="props" :title="null" @click="add_item(item.raw)">
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
        <v-col cols="3" class="pb-0 mb-2" v-if="pos_profile.posa_input_qty && !pos_profile.posa_mandatory_input_qty">
          <v-text-field
            density="compact"
            variant="outlined"
            color="primary"
            :label="frappe._('QTY')"
            bg-color="white"
            hide-details
            v-model.number="qty"
            type="number"
            class="enhanced-field"
            :class="{ 'field-focused': qty }"
            @keydown.enter="enter_event"
            @keydown.esc="esc_event"
          ></v-text-field>
        </v-col>
<v-col
  cols="3"
  class="pb-0 mb-2"
  v-if="
    pos_profile.posa_input_qty &&
    pos_profile.posa_mandatory_input_qty &&
    pos_profile.posa_mandatory_select_uom &&
    selectedItem
  "
>
  <v-select
    density="compact"
    variant="outlined"
    color="primary"
    :label="frappe._('UOM')"
    bg-color="white"
    hide-details
    v-model="selectedUOM"
    :items="
      selectedItem && selectedItem.item_uoms
        ? selectedItem.item_uoms
        : []
    "
    item-title="uom"
    item-value="uom"
    class="enhanced-field"
    @update:model-value="onUOMChange"
    @keydown.enter.prevent.stop="onUOMEnterEvnt"
    ref="uom_input"
  >
  </v-select>
</v-col>
<v-col
  cols="3"
  class="pb-0 mb-2"
  v-if="
    pos_profile.posa_input_qty &&
    pos_profile.posa_mandatory_input_qty
  "
>
  <v-text-field
    density="compact"
    variant="outlined"
    color="primary"
    :label="frappe._('Rate')"
    bg-color="white"
    hide-details
    v-model.number="rate"
    type="number"
    class="enhanced-field"
    @keydown.enter.prevent="focusQtyField"
    @focus="selectAllText"
    ref="rate_input"
  ></v-text-field>
</v-col>

        <v-col cols="3" class="pb-0 mb-2" v-if="pos_profile.posa_input_qty && pos_profile.posa_mandatory_input_qty && !pos_profile.posa_mandatory_select_uom">
          <v-text-field
            density="compact"
            variant="outlined"
            color="primary"
            :label="frappe._('QTY.')"
            bg-color="white"
            hide-details
            v-model.number="qty"
            type="number"
            class="enhanced-field"
            :class="{ 'field-focused': qty }"
            @keydown.enter="addSelectedItem_qty"
            @keydown.esc="esc_event"
            @focus="selectAllText"
            ref="qty_input"
          ></v-text-field>
        </v-col>
        <v-col cols="3" class="pb-0 mb-2" v-if="pos_profile.posa_input_qty && pos_profile.posa_mandatory_input_qty && pos_profile.posa_mandatory_select_uom">
          <v-text-field
            density="compact"
            variant="outlined"
            color="primary"
            :label="frappe._('QTY.')"
            bg-color="white"
            hide-details
            v-model.number="qty"
            type="number"
            class="enhanced-field"
            :class="{ 'field-focused': qty }"
            @keydown.enter="addSelectedItem"
            @keydown.esc="esc_event"
            @focus="selectAllText"
            ref="qty_input"
          ></v-text-field>
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
        <v-col cols="12" class="pt-0 mt-0" v-if="!pos_profile.posa_items_group_filter_on_right_side">
          <div fluid class="items" v-if="items_view == 'card'">
            <v-row dense class="overflow-y-auto" style="max-height: 67vh">
              <v-col
                v-for="(item, idx) in filtred_items"
                :key="idx"
                xl="2"
                lg="3"
                md="6"
                sm="6"
                cols="6"
                min-height="50"
              >
                <v-card hover class="item-card" :class="{ 'posa-item-selected': idx === selected_index }" @click="add_item(item)">
                  <v-img
                    :src="
                      item.image ||
                      '/assets/posawesome/js/rmsapp/components/pos/placeholder-image.png'
                    "
                    class="text-white align-end"
                    gradient="to bottom, rgba(0,0,0,0), rgba(0,0,0,0.4)"
                    height="100px"
                  >
                    <v-card-text
                      v-text="item.item_name"
                      class="text-caption px-1 pb-0 item-card-text"
                    ></v-card-text>
                  </v-img>
                  <v-card-text class="text-high-emphasis pa-1">
                    <div class="text-caption text-primary">
                      {{ currencySymbol(item.currency) || '' }}
                      {{ formtCurrency(item.rate) || 0 }}
                    </div>
                    <div class="text-caption text-golden">
                      {{ formtFloat(item.actual_qty) || 0 }}
                      {{ item.stock_uom || '' }}
                    </div>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </div>
          <div fluid class="items" v-if="items_view == 'list'">
            <div class="my-0 py-0 overflow-y-auto" style="max-height: 65vh">
              
                <v-data-table
                  ref="myDataTable"
                  :headers="getItmesHeaders()"
                  :items="filtred_items"
                  item-value="item_code"
                  class="enhanced-table-compact"
                  :items-per-page="itemsPerPage"
                  hide-default-footer
                  :row-props="(data) => ({ class: row_class(data.item) })"
                  @update:current-items="table_items = $event.map((i) => i.raw || i)"
                  @click:row="(event, row) => add_item(row.item, row)"
                  return-object
                >
                  <template v-slot:item.rate="{ item }">
                    <span class="currency-symbol">{{ currencySymbol(item.currency) }}</span>
                    <span class="amount-value">{{ formtCurrency(item.rate) }}</span>
                  </template>
                  <template v-slot:item.actual_qty="{ item }">
                    <span class="text-golden">{{ formtFloat(item.actual_qty) }}</span>
                  </template>
                </v-data-table>
              
            </div>
          </div>
        </v-col>
<v-col cols="12" class="pt-0 mt-0" v-if="pos_profile.posa_items_group_filter_on_right_side">

    <v-row no-gutters>

        <!-- LEFT CATEGORY PANEL -->
        <v-col
            cols="2"
            class="pa-0"
            style="border-right:1px solid #e0e0e0;"
        >

            <div class="text-subtitle-2 font-weight-bold mb-2 text-center">
                {{ __("Categories") }}
            </div>

            <div style="height:64vh;overflow-y:auto;">

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
            :cols="!pos_profile.posa_sales_person ? 10 : 12"
            class="pl-2"
        >

            <!-- CARD VIEW -->

            <div fluid class="items" v-if="items_view == 'card'">

                <v-row dense class="overflow-y-auto" style="max-height:67vh">

                    <v-col
                        v-for="(item, idx) in filtred_items"
                        :key="idx"
                        xl="2"
                        lg="3"
                        md="6"
                        sm="6"
                        cols="6"
                    >

                        <v-card
                            hover
                            class="item-card"
                            :class="{ 'posa-item-selected': idx === selected_index }"
                            @click="add_item(item)"
                        >

                            <v-img
                                :src="
                                    item.image ||
                                    '/assets/posawesome/js/rmsapp/components/pos/placeholder-image.png'
                                "
                                class="text-white align-end"
                                gradient="to bottom, rgba(0,0,0,0), rgba(0,0,0,0.4)"
                                height="100px"
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
                        :row-props="(data) => ({ class: row_class(data.item) })"
                        @update:current-items="table_items = $event.map((i) => i.raw || i)"
                        @click:row="(event, row) => add_item(row.item, row)"
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
<v-col cols="12" class="mb-2" v-if="pos_profile.posa_items_group_chips_view && !pos_profile.posa_items_group_filter_on_right_side">
  <span class="pt-5 pl-6 section-title">{{ frappe._("Items Group") }}</span>

  <v-row
    class="px-4 ml-1 mt-1 category-row"
    style="
      overflow-x: auto;
      white-space: nowrap;
      scrollbar-width: thin;
      -webkit-overflow-scrolling: touch;
    "
  >
    <v-col
      v-for="group in items_group"
      :key="group"
      cols="auto"
      class="px-0 py-1"
      style="display: inline-block"
    >
      <v-chip
        size="small"
        class="ma-1 text-capitalize category-chip"
        :class="{
          'active-catgory': item_group === group,
          'unactive-catgory': item_group !== group,
        }"
        :variant="item_group === group ? 'flat' : 'outlined'"
        :color="item_group === group ? 'primary' : ''"
        @click="
          item_group = group;
          search_onchange();
        "
      >
        {{ group }}
      </v-chip>
    </v-col>
  </v-row>
</v-col>
        <v-col cols="12" class="mb-2" v-if="!pos_profile.posa_sales_person && !pos_profile.posa_items_group_chips_view">
          <v-select
            :items="items_group"
            :label="frappe._('Items Group')"
            density="compact"
            variant="outlined"
            hide-details
            v-model="item_group"
            prepend-inner-icon="mdi-filter-outline"
            class="enhanced-field"
            :class="{ 'field-focused': item_group }"
            @update:model-value="search_onchange" item-title="text"
          ></v-select>
        </v-col>
        <v-col cols="6" class="mb-2" v-if="pos_profile.posa_sales_person && !pos_profile.posa_items_group_chips_view">
          <v-select
            :items="items_group"
            :label="frappe._('Items Group')"
            density="compact"
            variant="outlined"
            hide-details
            v-model="item_group"
            prepend-inner-icon="mdi-filter-outline"
            class="enhanced-field"
            :class="{ 'field-focused': item_group }"
            @update:model-value="search_onchange" item-title="text"
          ></v-select>
        </v-col>
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

        <v-col cols="3" class="mt-1">
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
        </v-col>
        <v-col cols="3" class="mt-1">
          <v-btn-toggle
            v-model="items_view"
            density="compact"
            rounded
            class="enhanced-btn-toggle"
          >
            <v-btn size="small" @click="show_hold" class="toggle-btn">
              <v-icon start size="small">mdi-pause</v-icon>
              {{ __('Hold') }}
            </v-btn>
            <v-btn size="small" @click="show_invoices" class="toggle-btn">
              <v-icon start size="small">mdi-printer</v-icon>
              {{ __('Print') }}
            </v-btn>
          </v-btn-toggle>
        </v-col>
        <v-col cols="6" class="mt-1">
          <v-btn-toggle
            v-model="items_view"
            density="compact"
            rounded
            class="enhanced-btn-toggle"
          >
            <v-btn size="small" @click="show_coupons" class="toggle-btn">
              <v-icon start size="small">mdi-ticket</v-icon>
              {{ couponsCount }} {{ __('Coupons') }}
            </v-btn>
            <v-btn size="small" @click="show_offers" class="toggle-btn">
              <v-icon start size="small">mdi-offer</v-icon>
              {{ offersCount }} {{ __('Offers') }} : {{ appliedOffersCount }} {{ __('Applied') }}
            </v-btn>
          </v-btn-toggle>
        </v-col>
      </v-row>
    </v-card>

    <v-dialog
      v-model="price_check_dialog"
      max-width="460"
      @keydown.esc="close_price_check"
    >
      <v-card class="pa-3">
        <v-card-title class="text-primary pb-2">
          <v-icon start color="primary">mdi-barcode-scan</v-icon>
          {{ __('Price Check') }}
          <v-spacer></v-spacer>
          <v-btn icon size="small" @click="close_price_check">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>

        <v-card-text>
          <v-text-field
            density="compact"
            variant="outlined"
            clearable
            hide-details
            color="primary"
            :label="frappe._('Scan Barcode')"
            prepend-inner-icon="mdi-barcode"
            v-model="price_check_barcode"
            :loading="price_check_loading"
            @keydown.enter.prevent.stop="lookup_price_check"
            @keydown.esc.prevent.stop="close_price_check"
            ref="price_check_input"
          ></v-text-field>

          <div v-if="price_check_error" class="text-error text-center mt-4">
            {{ price_check_error }}
          </div>

          <div v-if="price_check_result" class="mt-4">
            <div class="text-h6 text-center">{{ price_check_result.item_name }}</div>
            <div class="text-caption text-center text-grey mb-3">
              {{ price_check_result.item_code }} | {{ price_check_result.uom }}
            </div>

            <v-table density="compact">
              <tbody>
                <tr>
                  <td>{{ __('M.R.P') }}</td>
                  <td class="text-right">
                    {{ currencySymbol(price_check_result.currency) }}
                    {{ formtCurrency(price_check_result.mrp_rate) }}
                  </td>
                </tr>
                <tr>
                  <td class="font-weight-bold">{{ __('Selling Price') }}</td>
                  <td class="text-right text-h6 text-primary">
                    {{ currencySymbol(price_check_result.currency) }}
                    {{ formtCurrency(price_check_result.selling_rate) }}
                  </td>
                </tr>
              </tbody>
            </v-table>

            <v-alert
              density="compact"
              variant="tonal"
              :type="price_check_result.saved > 0 ? 'success' : 'info'"
              class="mt-3 mb-0 text-center"
            >
              <span class="font-weight-bold">{{ __('You Saved') }}:</span>
              {{ currencySymbol(price_check_result.currency) }}
              {{ formtCurrency(price_check_result.saved) }}
              <span v-if="price_check_result.saved > 0">
                ({{ price_check_result.saved_percent.toFixed(1) }}%)
              </span>
            </v-alert>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

  </div>
</template>

<script>
import { evntBus } from '../../bus';
import format from '../../format';
import _ from '../../../shared/debounce';
import { markRaw } from 'vue';
import offlinePos, { offlineState } from '../../../offline';
import { parseScaleBarcode, scaleConfig } from '../../../offline/scale';
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
      selectedItem: null, // store the selected item
      selectedItemCode: '', // store the selected item's code
      selectedUOM: null,
      selectedUOMObj: null,
      rate: 0,
      selected_index: -1,
      table_items: [],
      price_check_dialog: false,
      price_check_barcode: '',
      price_check_result: null,
      price_check_error: '',
      price_check_loading: false,
    };
  },
  watch: {
    price_check_dialog(val) {
      if (val) {
        this.$nextTick(() => setTimeout(() => this.focus_price_check(), 100));
      } else {
        this.price_check_barcode = '';
        this.price_check_result = null;
        this.price_check_error = '';
        this.$nextTick(() => {
          if (this.$refs.debounce_search) this.$refs.debounce_search.focus();
        });
      }
    },
    items_view() {
      this.selected_index = -1;
    },
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
      this.selected_index = -1;
      if (!this.pos_profile.pose_use_limit_search) {
        if (new_value.length != old_value.length) {
          this.update_items_details(new_value);
        }
      }
    },

    filtred_items_old(new_value, old_value) {
      if (!this.pos_profile.pose_use_limit_search) {
        if (new_value.length != old_value.length) {
          this.update_items_details(new_value);
        }
      }
    },
    customer_price_list() {
      this.get_items();
    },
    // local catalogue finished a (first or delta) download: refresh the list
    'offline.catalogVersion'() {
      if (!this.pos_profile || this.pos_profile.pose_use_limit_search) return;
      if (offlinePos.useLocalCatalog()) {
        clearTimeout(this._catalogTimer);
        this._catalogTimer = setTimeout(() => this.load_local_items(), 300);
      }
    },
    new_line() {
      evntBus.$emit('set_new_line', this.new_line);
    },
  },
  unmounted() {
    document.removeEventListener("keydown", this.handleAltF);
  },
  methods: {
    open_price_check() {
      this.price_check_dialog = true;
      this.$nextTick(() => this.focus_price_check());
    },
    close_price_check() {
      this.price_check_dialog = false;
    },
    focus_price_check() {
      const el = this.$refs.price_check_input;
      if (el) {
        el.focus();
        const input = el.$el && el.$el.querySelector('input');
        if (input) input.select();
      }
    },
    lookup_price_check() {
      const code = (this.price_check_barcode || '').trim();
      if (!code) return;
      const vm = this;
      if (offlinePos.useLocalCatalog() && offlinePos.useOffline()) {
        const row = offlinePos.scan(code, { priceList: this.customer_price_list });
        if (!row) {
          vm.price_check_result = null;
          vm.price_check_error = __('No item found for barcode') + ' "' + code + '"';
          return;
        }
        const mrp = Number(row.maximum_retail_price) || 0;
        const selling = Number(row.rate) || 0;
        const saved = mrp && selling && mrp > selling ? mrp - selling : 0;
        vm.price_check_result = {
          item_code: row.item_code, item_name: row.item_name, uom: row.uom || row.stock_uom, image: row.image,
          currency: row.currency || vm.pos_profile.currency, mrp_rate: mrp, selling_rate: selling,
          saved, saved_percent: mrp && saved ? (saved / mrp) * 100 : 0,
        };
        vm.price_check_error = '';
        vm.$nextTick(() => vm.focus_price_check());
        return;
      }
      vm.price_check_loading = true;
      vm.price_check_error = '';
      frappe.call({
        method: 'posawesome.posawesome.api.posapp.get_item_price_check',
        args: { barcode: code, pos_profile: vm.pos_profile },
        callback: function (r) {
          vm.price_check_loading = false;
          if (r.message) {
            vm.price_check_result = r.message;
          } else {
            vm.price_check_result = null;
            vm.price_check_error = __('No item found for barcode') + ' "' + code + '"';
          }
          // ready for the next scan
          vm.$nextTick(() => vm.focus_price_check());
        },
        error: function () {
          vm.price_check_loading = false;
        },
      });
    },
move_selection(dir, event) {
  const list = this.nav_items;
  if (!list.length) return;

  const is_card = this.items_view === "card";
  const horizontal = dir === "left" || dir === "right";

  // Left/right only matter in the card grid once an item is selected;
  // otherwise let the caret move inside the text field.
  if (horizontal && (!is_card || this.selected_index < 0)) return;
  if (event) event.preventDefault();

  const cols = is_card ? this.get_card_columns() : 1;
  let idx = this.selected_index;

  if (dir === "down") {
    idx = idx < 0 ? 0 : Math.min(idx + cols, list.length - 1);
  } else if (dir === "up") {
    idx = idx - cols < 0 ? -1 : idx - cols; // back to the search box
  } else if (dir === "right") {
    idx = Math.min(idx + 1, list.length - 1);
  } else if (dir === "left") {
    idx = Math.max(idx - 1, 0);
  }

  this.selected_index = idx;
  this.$nextTick(() => this.scroll_selected_into_view());
},

get_card_columns() {
  const cards = this.$el.querySelectorAll(".item-card");
  // const cards = this.$el.querySelectorAll(".posa-item-card");
  if (cards.length < 2) return 1;
  const top = cards[0].getBoundingClientRect().top;
  let n = 0;
  for (const c of cards) {
    if (Math.abs(c.getBoundingClientRect().top - top) < 5) n++;
    else break;
  }
  return n || 1;
},

scroll_selected_into_view() {
  const el = this.$el.querySelector(
    this.items_view === "card" ? ".posa-item-selected" : ".posa-row-selected"
  );
  if (el) el.scrollIntoView({ block: "nearest" });
},

row_class(item) {
  const sel = this.nav_items[this.selected_index];
  return sel && sel.item_code === item.item_code ? "posa-row-selected" : "";
},

enter_or_select() {
  const item = this.nav_items[this.selected_index];
  if (this.selected_index >= 0 && item) {
    this.add_item(item);
    return;
  }
  this.search_onchange();
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
onUOMChange_conversion(uom) {
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

    // auto update rate according to UOM
    const base_rate = flt(
      this.selectedItem.price_list_rate ||
      this.selectedItem.rate ||
      0
    );

    this.rate = base_rate * conversion_factor;
  }
},
onUOMChange_old(uom) {
  if (!this.selectedItem) return;

  const uomRow = (this.selectedItem.item_uoms || []).find(
    d => d.uom === uom
  );

  this.selectedUOMObj = uomRow || null;
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

  }

  this.$nextTick(() => {
    setTimeout(() => {
      if (this.$refs.rate_input) {
        this.$refs.rate_input.focus();
      }
    }, 50);
  });
},
onUOMEnterEvnt_old() {
  this.onUOMChange(this.selectedUOM);
  this.uom_input_blur();
  // force menu close
  this.$refs.uom_input.menu = false;
  this.$nextTick(() => {
    this.$refs.qty_input.focus();
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
      if (offlinePos.useOffline()) {
        const boot = offlinePos.catalog.getMeta('bootstrap');
        if (boot && boot.sales_persons) vm.sales_persons = boot.sales_persons;
        return;
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
      if (e.key === 'F1' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        e.preventDefault(); // stop browser help
        this.open_price_check();
        return;
      }
      if (this.price_check_dialog) {
        if (e.key === 'Escape') {
          e.preventDefault();
          this.close_price_check();
        }
        return;
      }
      if ((e.key === 'F2' || e.key === 'Escape' || ((e.key === 'f' || e.key === 'F') && e.altKey)) && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        if (this.$root) {
          evntBus.$emit('customerBlurTriggered');
          evntBus.$emit('discountBlurTriggered');
        }
        this.$refs.debounce_search.focus();
      }
    },
    handleAltF_old(e) {
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
    show_invoices() {
      evntBus.$emit('show_invoices', 'true');
    },
    load_local_items() {
      // 30k+ items come from the local catalogue (IndexedDB) - no server round trip
      this.items = offlinePos.posItems({ priceList: this.customer_price_list });
      evntBus.$emit('set_all_items', this.items);
      this.loading = false;
    },
    get_items() {
      if (!this.pos_profile) {
        console.error('No POS Profile');
        return;
      }
      const vm = this;
      if (!vm.pos_profile.pose_use_limit_search && offlinePos.useLocalCatalog()) {
        vm.load_local_items();
        return;
      }
      if (offlinePos.useOffline()) {
        vm.loading = false;
        evntBus.$emit('show_mesage', {
          text: __('Offline: the item catalogue has not been downloaded to this terminal yet'),
          color: 'error',
        });
        return;
      }
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
            vm.items = markRaw(r.message);
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
          item.qty = Math.abs(this.qty);
        }
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
      if (!this.first_search) {
        return;
      }
      // barcode / scale barcode / item code straight from the local index
      if (offlinePos.useLocalCatalog() && !this.pos_profile.pose_use_limit_search) {
        const scanned = offlinePos.scan(this.first_search, { priceList: this.customer_price_list });
        if (scanned) {
          if (!scanned.posa_scale_barcode) scanned.qty = Math.abs(this.qty) || 1;
          if (this.pos_profile.posa_sales_person && this.sales_person) {
            scanned.posa_sales_person = this.sales_person;
          }
          this.add_item(scanned);
          this.search = null;
          this.first_search = null;
          this.debounce_search = null;
          this.qty = 1;
          this.$refs.debounce_search.focus();
          return;
        }
      }
      if (!this.filtred_items.length) {
        return;
      }
      const qty = this.get_item_qty(this.first_search);
      const new_item = { ...this.filtred_items[0] };
      new_item.qty = flt(qty);
      const scale = parseScaleBarcode(this.first_search, scaleConfig(this.pos_profile));
      if (scale && scale.valueType === 'Price') {
        // the scale printed the amount: qty = amount / rate
        new_item.qty = flt(new_item.rate) ? flt(scale.value / flt(new_item.rate), 3) : 1;
        match = true;
      } else if (scale) {
        match = true;
      }
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
    // weighing scale barcodes (see POS Profile > POS Offline & Scale)
    get_item_qty(first_search) {
      const scale = parseScaleBarcode(first_search, scaleConfig(this.pos_profile));
      if (scale && scale.valueType !== 'Price') {
        return scale.value;
      }
      return Math.abs(this.qty);
    },
    get_search(first_search) {
      const scale = parseScaleBarcode(first_search, scaleConfig(this.pos_profile));
      return scale ? scale.itemPart : first_search;
    },

    esc_event() {
      this.search = null;
      this.first_search = null;
      this.qty = 1;
      this.selected_index = -1;
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
      if (offlinePos.useLocalCatalog() || offlinePos.useOffline() || !items || !items.length) {
        return; // the local catalogue already carries stock, uoms and batches
      }
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
      if (this.price_check_dialog) return; // price check popup handles its own scans
      if (offlinePos.useLocalCatalog() && !this.pos_profile.pose_use_limit_search) {
        const scanned = offlinePos.scan(sCode, { priceList: this.customer_price_list });
        if (scanned) {
          if (!scanned.posa_scale_barcode) scanned.qty = Math.abs(this.qty) || 1;
          this.add_item(scanned);
          this.debounce_search = null;
          this.search = null;
        } else {
          evntBus.$emit('show_mesage', { text: `No Item has this barcode "${sCode}"`, color: 'error' });
          frappe.utils.play_sound('error');
        }
        return;
      }
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
    trigger_onscan_old(sCode) {
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
    nav_items() {
      return this.items_view === "list" ? this.table_items : this.filtred_items;
    },
    offline() {
      return offlineState;
    },
    filtred_items() {
      this.search = this.get_search(this.first_search);
      if (!this.pos_profile.pose_use_limit_search && offlinePos.useLocalCatalog()) {
        // indexed search over the local catalogue (barcodes, codes, names)
        void this.offline.catalogVersion; // recompute after a sync
        void this.items;
        return offlinePos.searchItems(this.search && this.search.length >= 2 ? this.search : '', {
          group: this.item_group,
          limit: 50,
          priceList: this.customer_price_list,
          hideVariants: this.pos_profile.posa_show_template_items && this.pos_profile.posa_hide_variants_items,
        });
      }
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

<style>
.item-card.posa-item-selected {
  outline: 2px solid #1976d2;
  box-shadow: 0 0 8px rgba(25, 118, 210, 0.5) !important;
}
.posa-row-selected {
  background-color: rgba(25, 118, 210, 0.18) !important;
}
</style>

<style scoped>
.enhanced-table-compact :deep(tr.posa-row-selected),
.enhanced-table-compact :deep(tr.posa-row-selected td) {
  background-color: rgba(25, 118, 210, 0.18) !important;
}
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