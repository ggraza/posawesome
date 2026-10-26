<template>
  <v-row justify="center">
    <v-dialog v-model="expenseDialog" max-width="900" persistent>
      <v-card elevation="8" class="expense-dialog-card">
        <!-- Enhanced White Header -->
        <v-card-title class="expense-header pa-6">
          <div class="header-content">
            <div class="header-icon-wrapper">
              <v-icon class="header-icon" size="40">mdi-cash-minus</v-icon>
            </div>
            <div class="header-text">
              <h3 class="header-title">{{ __('Create POS Expense Invoice') }}</h3>
              <p class="header-subtitle">{{ __('Record and submit expense details') }}</p>
            </div>
          </div>
        </v-card-title>

        <v-divider class="header-divider"></v-divider>

        <v-card-text class="pa-0 white-background">
          <v-container class="pa-6">
            <v-row>
              <v-col cols="12" class="pa-1">
                <v-form ref="form" v-model="valid">
                  <!-- Company, POS Opening Shift, and Date in a Single Row -->
                  <v-row dense>
                    <v-col cols="4">
                      <v-text-field
                        label="POS Opening Shift"
                        v-model="expenseInvoice.pos_opening_shift"
                        :rules="[rules.required]"
                        readonly
                        required
                        variant="outlined"
                        density="compact"
                        color="primary"
                      ></v-text-field>
                    </v-col>
                    <v-col cols="4">
                      <v-menu
                        ref="dateMenu"
                        v-model="dateMenu"
                        :close-on-content-click="false"
                        transition="scale-transition"
                        min-width="auto" location="bottom"
                      >
                        <template v-slot:activator="{ props }">
                          <v-text-field
                            v-model="expenseInvoice.date"
                            label="Date"
                            prepend-icon="mdi-calendar"
                            readonly
                            v-bind="props"
                            required
                            variant="outlined"
                            density="compact"
                            color="primary"
                          ></v-text-field>
                        </template>
                        <pos-date-picker
                          v-model="expenseInvoice.date"
                          color="primary"
                          :min="frappe.datetime.add_days(frappe.datetime.now_date(true), -1)"
                          :max="frappe.datetime.add_days(frappe.datetime.now_date(true), 7)"
                          @update:model-value="dateMenu = false"
                        ></pos-date-picker>
                      </v-menu>
                    </v-col>
                    <v-col cols="4">
                      <v-autocomplete
                        density="compact"
                        clearable
                        auto-select-first
                        variant="outlined"
                        color="primary"
                        :label="frappe._('Mode of Payment')"
                        v-model="mode_of_payment"
                        :items="payments_methods"
                        item-title="mode_of_payment"
                        :rules="[rules.required]"
                        bg-color="white"
                        :no-data-text="__('Mode of payment not found')"
                        hide-details
                      >
                        <template v-slot:item="data">
<v-list-item v-bind="data.props" :title="null">
                              <v-list-item-title
                                class="text-primary text-subtitle-1"
                                v-html="data.item.raw.mode_of_payment"
                              ></v-list-item-title>
                            </v-list-item>
                          
                        </template>
                      </v-autocomplete>
                    </v-col>
                  </v-row>
                <div class="form-header mb-4">
                  <h4 class="text-h6 text-grey-darken-2 mb-1">{{ __('Expense Details') }}</h4>
                  <p class="text-body-2 text-grey">{{ __('Enter expense information and quantities') }}</p>
                </div>


                  <!-- Expense Detail Table -->
                  <v-table class="white-table rounded-lg mt-4">
                    <thead>
                      <tr>
                        <th>POS Expenses</th>
                        <th>Description</th>
                        <th>Qty</th>
                        <th>Rate</th>
                        <th>Amount</th>
                        <th>Invoice No</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(item, index) in expenseInvoice.expense_detail" :key="index">
                        <td>
                          <v-autocomplete
                            v-model="item.pos_expenses"
                            :items="posExpenseHeads"
                            label="POS Expense Head"
                            clearable
                            density="compact"
                            hide-details
                            color="primary"
                            :custom-filter="(itemText, queryText, internal) => customExpenseFilter(internal.raw, queryText, itemText)"
                            :no-data-text="__('No Expense Head Found')" item-title="text"
                          ></v-autocomplete>
                        </td>
                        <td>
                          <v-text-field
                            v-model="item.expense_description"
                            label="Description"
                            color="primary"
                          ></v-text-field>
                        </td>
                        <td>
                          <v-text-field
                            v-model="item.qty"
                            label="Qty"
                            type="number"
                            @update:model-value="updateAmount(item)"
                            color="primary"
                          ></v-text-field>
                        </td>
                        <td>
                          <v-text-field
                            v-model="item.rate"
                            label="Rate"
                            type="number"
                            @update:model-value="updateAmount(item)"
                            color="primary"
                          ></v-text-field>
                        </td>
                        <td>
                          <v-text-field
                            v-model="item.amount"
                            label="Amount"
                            type="number"
                            readonly
                            color="primary"
                          ></v-text-field>
                        </td>
                        <td>
                          <v-text-field
                            v-model="item.invoice_no"
                            label="Invoice No"
                            color="primary"
                          ></v-text-field>
                        </td>
                        <td>
                          <v-btn icon @click="removeExpenseRow(index)" class="action-btn">
                            <v-icon color="red">mdi-delete</v-icon>
                          </v-btn>
                        </td>
                      </tr>
                    </tbody>
                  </v-table>

                  <!-- Add new row button -->
                  <v-btn color="warning" @click="addExpenseRow" class="add-row-btn mt-4">
                    <v-icon start>mdi-plus</v-icon>
                    Add Row
                  </v-btn>

                  <v-row class="mt-4" dense>
                    <v-col cols="6">
                      <v-text-field
                        label="Total QTY"
                        v-model="expenseInvoice.total_quantity"
                        readonly
                        variant="outlined"
                        density="compact"
                        color="primary"
                      ></v-text-field>
                    </v-col>
                    <v-col cols="6">
                      <v-text-field
                        label="Grand Total"
                        v-model="expenseInvoice.total_expense"
                        readonly
                        variant="outlined"
                        density="compact"
                        color="primary"
                      ></v-text-field>
                    </v-col>
                  </v-row>
                </v-form>
              </v-col>
            </v-row>
          </v-container>
        </v-card-text>

        <v-divider></v-divider>
        <v-card-actions class="dialog-actions-container">
          <v-btn color="success" :disabled="isSubmitting" :loading="isSubmitting" @click="submit" class="pos-action-btn submit-action-btn" size="large">
            <v-icon start>mdi-check-circle-outline</v-icon>
            Submit
          </v-btn>
          <v-spacer></v-spacer>
          <v-btn color="error" @click="expenseDialog = false" class="pos-action-btn cancel-action-btn" size="large">
            <v-icon start>mdi-close-circle-outline</v-icon>
            Cancel
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-row>
</template>

<script>
import { evntBus } from '../../bus';
import format from '../../format';

export default {
  data() {
    return {
      expenseDialog: false,
      valid: true,
      dateMenu: false,
      mode_of_payment: null,
      payments_method_data: [],
      payments_methods: [],
      isSubmitting: false,
      expenseInvoice: {
        company: '',
        date: '',
        pos_opening_shift: '',
        expense_detail: [
          { pos_expenses: '', expense_description: '', qty: 1, amount: 0, invoice_no: '' },
        ],
      },
      posExpenseHeads: [], // Empty initially, will be populated from the server
      rules: {
        required: (value) => !!value || 'Required.',
      },
    };
  },
  methods: {
    addExpenseRow() {
      this.expenseInvoice.expense_detail.push({
        pos_expenses: '',
        expense_description: '',
        qty: 1,
        rate: 0,
        amount: 0,
        invoice_no: '',
      });
    },
    removeExpenseRow(index) {
      this.expenseInvoice.expense_detail.splice(index, 1);
    },
    async submit() {
      if (!(await this.$refs.form.validate()).valid) { // Vuetify 3: validate() is async
        frappe.msgprint(__('Please fill required fields'));
        return;
      }
      { // form already validated above
        // Prepare the data to be sent
        this.isSubmitting = true; // ?? LOCK
        const invoiceData = {
          doctype: "POS Expense Invoice",
          company: this.expenseInvoice.company,
          posa_create_journal_entry: this.expenseInvoice.posa_create_journal_entry,
          date: this.expenseInvoice.date,
          pos_opening_shift: this.expenseInvoice.pos_opening_shift,
          mode_of_payment: this.mode_of_payment, // ? ADD THIS
          expense_detail: this.expenseInvoice.expense_detail.map(item => ({
            pos_expenses: item.pos_expenses,
            expense_description: item.expense_description,
            qty: item.qty,
            rate: item.rate,
            amount: item.amount,
            invoice_no: item.invoice_no,
          })),
          total_quantity: this.expenseInvoice.total_quantity,
          total_expense: this.expenseInvoice.total_expense,
        };
        // Call the Frappe API to create the new doctype
        frappe.call({
          method: "frappe.client.submit",
          args: { doc: invoiceData },
          callback: (response) => {
            if (response.message) {
              this.isSubmitting = false;
              this.expenseDialog = false; // Close the dialog
              this.resetForm(); // Reset the form
              const invoice_name = response.message.name;
              this.load_print_page(invoice_name);
              // Optionally, show a success message or redirect
              evntBus.$emit("show_mesage", {
                text: `POS Expense Invoice  ${response.message.name} is created successfully!`,
                color: "success",
              });
            frappe.utils.play_sound("submit");
            } else {
              frappe.msgprint("Failed to create POS Expense Invoice.");
            }
          },
          error: (error) => {
            this.isSubmitting = false; // ?? UNLOCK ON ERROR
            console.error("Error creating invoice:", error);
            frappe.msgprint("An error occurred while creating the invoice. Please try again.");
          }
        });
      }
    },
    load_print_page(invoice_name) {
      const print_format = this.pos_profile.custom_expense_invoice_print_format;
      const letter_head = this.pos_profile.letter_head || 0; // Use letter head setting if available
      const encoded_invoice_name = encodeURIComponent(invoice_name);
      // Construct the URL for printing the expense invoice
      const url =
        frappe.urllib.get_base_url() +
        "/printview?doctype=POS Expense Invoice&name=" +
        encoded_invoice_name +
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
        },
        true
      );
    },
    resetForm() {
      this.expenseInvoice.expense_detail = [
        { pos_expenses: '', expense_description: '', qty: 1, rate: 0, amount: 0, invoice_no: '' },
      ];
      this.expenseInvoice.total_quantity = 0;
      this.expenseInvoice.total_expense = 0;
    },
customExpenseFilter(item, queryText, itemText) {
  if (!queryText) return true;

  const text = (itemText || "").toLowerCase();
  const query = queryText.toLowerCase();

  // exact match shortcut
  if (text.includes(query)) return true;

  // fuzzy match (abbreviation / partial order)
  const queryParts = query.split(/\s+/).filter(Boolean);

  // every part must exist somewhere in order (loose match)
  return queryParts.every(q => {
    // allow partial character sequence matching
    let i = 0;
    for (let char of q) {
      i = text.indexOf(char, i);
      if (i === -1) return false;
      i++;
    }
    return true;
  });
},
    customExpenseFilter_old(item, queryText, itemText) {
      const text = (itemText || "").toLowerCase();
      const query = (queryText || "").toLowerCase();

      // Match anywhere in the name
      return text.includes(query);
    },
    fetchPOSExpenseHeads() {
      frappe.call({
        method: 'frappe.client.get_list',
        args: {
          doctype: 'POS Expense Head',
          fields: ['name'],
          filters: {
            disable: 0
          },
          order_by: "name asc",
          limit_page_length: 1000
        },
        callback: (response) => {
          this.posExpenseHeads = (response.message || [])
            .map(d => d.name)
            .sort((a, b) => a.localeCompare(b));
          //this.posExpenseHeads = response.message.map(item => item.name);
        },
      });
    },
    getTodayDate() {
      return frappe.datetime.now_date();
    },
    updateAmount(item) {
      item.amount = (item.qty || 0) * (item.rate || 0);
      this.calculateExpenseTotal();
    },
    calculateExpenseTotal() {
      let totalAmount = 0;
      let totalQty = 0;
      this.expenseInvoice.expense_detail.forEach((item) => {
        totalAmount += item.amount;
        totalQty += item.qty ? parseFloat(item.qty) : 0;
      });
      this.expenseInvoice.total_expense = totalAmount;
      this.expenseInvoice.total_quantity = totalQty;
    },
  },
  created() {
    evntBus.$on('open_expense', (data) => {
      this.expenseDialog = true;
    });
    this.fetchPOSExpenseHeads();
    this.expenseInvoice.date = this.getTodayDate();
    evntBus.$on("register_pos_profile", (data) => {
      this.pos_profile = data.pos_profile;
      this.pos_opening_shift = data.pos_opening_shift;

      if (this.pos_profile) {
        this.expenseInvoice.company = this.pos_profile.company || '';
        this.expenseInvoice.posa_create_journal_entry = this.pos_profile.posa_create_journal_entry || 0;
        this.payments_method_data = this.pos_profile.payments || [];
        this.payments_methods = this.payments_method_data;
        // ? AUTO SELECT DEFAULT MODE OF PAYMENT
        const default_mop = this.payments_method_data.find(p => p.default);
        if (default_mop) {
          this.mode_of_payment = default_mop.mode_of_payment;
        }
      }
      if (this.pos_opening_shift) {
        this.expenseInvoice.pos_opening_shift = this.pos_opening_shift.name || '';
      }
      this.expenseInvoice.date = this.getTodayDate();
    });
  },
};
</script>

<style scoped>
/* Enhanced Header Styles */
.expense-header {
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  border-bottom: 1px solid #e0e0e0;
  padding: 24px !important;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 20px;
  width: 100%;
}

.header-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(25, 118, 210, 0.3);
}

.header-icon {
  color: white !important;
}

.header-text {
  flex: 1;
}

.header-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 4px 0;
  line-height: 1.2;
}

.header-subtitle {
  font-size: 0.95rem;
  color: #666;
  margin: 0;
  font-weight: 400;
}

.header-divider {
  border-color: #e0e0e0;
}

.white-background {
  background-color: #ffffff;
}

.form-header {
  padding: 0 4px;
}

.white-table {
  background-color: white;
  border: 1px solid #e0e0e0;
}

/* Form Fields */
.v-text-field, .v-select {
  border-radius: 8px;
}

.v-text-field--outlined fieldset, .v-select--outlined fieldset {
  border-color: #e0e0e0;
}

.v-text-field--outlined:hover fieldset, .v-select--outlined:hover fieldset {
  border-color: #1976d2;
}

/* Table Styling */
.v-simple-table th {
  background: #f5f5f5 !important;
  color: #424242 !important;
  font-weight: 600 !important;
  padding: 12px !important;
}

.v-simple-table td {
  padding: 8px !important;
  border-bottom: 1px solid #e0e0e0 !important;
}

/* Action Buttons */
.dialog-actions-container {
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  border-top: 1px solid #e0e0e0;
  padding: 16px 24px;
  gap: 12px;
}

.pos-action-btn {
  border-radius: 12px;
  text-transform: none;
  font-weight: 600;
  padding: 12px 32px;
  min-width: 120px;
  transition: all 0.3s ease;
  color: white !important;
}

.pos-action-btn .v-icon, .pos-action-btn span {
  color: white !important;
}

.pos-action-btn:disabled .v-icon, .pos-action-btn:disabled span {
  color: white !important;
}

.submit-action-btn {
  background: linear-gradient(135deg, #388e3c 0%, #2e7d32 100%) !important;
}

.cancel-action-btn {
  background: linear-gradient(135deg, #d32f2f 0%, #c62828 100%) !important;
}

.submit-action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(46, 125, 50, 0.4);
}

.cancel-action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(211, 47, 47, 0.4);
}

.submit-action-btn:disabled {
  opacity: 0.6;
  transform: none;
}

/* Add Row Button */
.add-row-btn {
  border-radius: 12px;
  text-transform: none;
  font-weight: 600;
  padding: 8px 24px;
  transition: all 0.3s ease;
  background: linear-gradient(135deg, #f57c00 0%, #ef6c00 100%) !important;
  color: white !important;
}

.add-row-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(245, 124, 0, 0.4);
}

.add-row-btn .v-icon {
  color: white !important;
}

/* Delete Action Button */
.action-btn {
  transition: all 0.3s ease;
}

.action-btn:hover {
  transform: scale(1.1);
}

/* Responsive Design */
@media (max-width: 768px) {
  .dialog-actions-container {
    flex-direction: column;
    gap: 12px;
  }

  .pos-action-btn {
    width: 100%;
  }

  .expense-header {
    padding: 16px !important;
  }

  .header-icon-wrapper {
    width: 48px;
    height: 48px;
  }

  .header-icon {
    size: 32px;
  }

  .header-title {
    font-size: 1.25rem;
  }

  .header-subtitle {
    font-size: 0.85rem;
  }

  .v-simple-table th, .v-simple-table td {
    padding: 6px !important;
  }
}

@media (max-width: 480px) {
  .v-row.dense .v-col {
    flex: 1 1 100% !important;
    max-width: 100% !important;
  }
}

/* Dark Theme Adjustments */
.theme--dark .expense-header, .theme--dark .dialog-actions-container {
  background: linear-gradient(135deg, #1e1e1e 0%, #121212 100%) !important;
  border-color: #333 !important;
}

.theme--dark .white-background, .theme--dark .white-table {
  background-color: #1e1e1e !important;
}

.theme--dark .v-simple-table th {
  background: #333 !important;
  color: #e0e0e0 !important;
}

.theme--dark .v-simple-table td {
  border-bottom: 1px solid #333 !important;
}

.theme--dark .header-title {
  color: #e0e0e0 !important;
}

.theme--dark .header-subtitle, .theme--dark .form-header p {
  color: #aaa !important;
}

.theme--dark .form-header h4 {
  color: #e0e0e0 !important;
}

.theme--dark .v-text-field--outlined fieldset, .theme--dark .v-select--outlined fieldset {
  border-color: #555 !important;
}

.theme--dark .v-text-field--outlined:hover fieldset, .theme--dark .v-select--outlined:hover fieldset {
  border-color: #42a5f5 !important;
}
</style>
