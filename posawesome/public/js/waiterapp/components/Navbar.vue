<template>
  <nav>
    <v-app-bar
      flat
      height="40"
      :color="appBarColor"
      class="navbar-enhanced elevation-2 px-2 pb-1"
    >
      <v-app-bar-nav-icon
        @click.stop="drawer = !drawer"
        class="text-secondary nav-icon"
      ></v-app-bar-nav-icon>
      <v-img
        src="/assets/posawesome/js/rmsapp/components/pos/pos.png"
        alt="POS Awesome"
        max-width="32"
        class="mx-2"
      ></v-img>
      <v-toolbar-title
        @click="go_desk"
        class="text-h6 font-weight-bold text-primary navbar-title"
        style="cursor: pointer; text-decoration: none;"
      >
        <span class="font-weight-light brand-pos">RMS</span>
        <span class="brand-awesome">G2Virtu</span>
      </v-toolbar-title>

      <v-spacer></v-spacer>

      <!-- Calculator Button with Tooltip -->
      <div class="profile-section mx-1" @click="openCalculator">
        <v-chip color="warning" variant="outlined" class="profile-chip">
          <v-icon color="warning" start @click="openCalculator">mdi-calculator</v-icon>
          Calculator
        </v-chip>
      </div>

      <!-- Full Calculator Dialog -->
      <v-dialog v-model="calculatorVisible" persistent max-width="350">
        <v-card class="calc-dialog-card" elevation="8">
          <v-card-title class="calc-header pa-4">
            <div class="header-content">
              <div class="header-icon-wrapper">
                <v-icon class="header-icon" size="32">mdi-calculator</v-icon>
              </div>
              <div class="header-text">
                <h3 class="header-title">{{ __('Calculator') }}</h3>
              </div>
            </div>
          </v-card-title>
          <v-divider class="header-divider"></v-divider>
          <v-card-text class="pa-4">
            <v-text-field
              v-model="calculatorDisplay"
              label="Result"
              variant="outlined"
              density="compact"
              class="text-right calc-input"
              @update:model-value="handleInput"
              @keydown.enter="calculateResult"
              @keydown="handleKeyDown"
            ></v-text-field>

            <v-row dense class="calc-row">
              <v-col cols="3"><v-btn @click="clearAll" class="calc-btn" color="error">AC</v-btn></v-col>
              <v-col cols="3"><v-btn @click="clearEntry" class="calc-btn" color="warning">CE</v-btn></v-col>
              <v-col cols="3"><v-btn @click="appendOperator('%')" class="calc-btn" color="secondary">%</v-btn></v-col>
              <v-col cols="3"><v-btn @click="appendOperator('/')" class="calc-btn" color="primary">/</v-btn></v-col>
            </v-row>
            <v-row dense class="calc-row">
              <v-col cols="3"><v-btn @click="appendValue('7')" class="calc-btn" color="grey">7</v-btn></v-col>
              <v-col cols="3"><v-btn @click="appendValue('8')" class="calc-btn" color="grey">8</v-btn></v-col>
              <v-col cols="3"><v-btn @click="appendValue('9')" class="calc-btn" color="grey">9</v-btn></v-col>
              <v-col cols="3"><v-btn @click="appendOperator('*')" class="calc-btn" color="primary">*</v-btn></v-col>
            </v-row>
            <v-row dense class="calc-row">
              <v-col cols="3"><v-btn @click="appendValue('4')" class="calc-btn" color="grey">4</v-btn></v-col>
              <v-col cols="3"><v-btn @click="appendValue('5')" class="calc-btn" color="grey">5</v-btn></v-col>
              <v-col cols="3"><v-btn @click="appendValue('6')" class="calc-btn" color="grey">6</v-btn></v-col>
              <v-col cols="3"><v-btn @click="appendOperator('-')" class="calc-btn" color="primary">-</v-btn></v-col>
            </v-row>
            <v-row dense class="calc-row">
              <v-col cols="3"><v-btn @click="appendValue('1')" class="calc-btn" color="grey">1</v-btn></v-col>
              <v-col cols="3"><v-btn @click="appendValue('2')" class="calc-btn" color="grey">2</v-btn></v-col>
              <v-col cols="3"><v-btn @click="appendValue('3')" class="calc-btn" color="grey">3</v-btn></v-col>
              <v-col cols="3"><v-btn @click="appendOperator('+')" class="calc-btn" color="primary">+</v-btn></v-col>
            </v-row>
            <v-row dense class="calc-row">
              <v-col cols="6" class="calc-zero-col"><v-btn @click="appendValue('0')" class="v-btn--block calc-btn calc-zero" color="grey">0</v-btn></v-col>
              <v-col cols="3"><v-btn @click="appendValue('.')" class="calc-btn" color="grey">.</v-btn></v-col>
              <v-col cols="3"><v-btn @click="calculateResult" class="calc-btn" color="success">=</v-btn></v-col>
            </v-row>
          </v-card-text>

          <v-divider></v-divider>
          <v-card-actions class="dialog-actions-container">
            <v-spacer></v-spacer>
            <v-btn color="error" @click="closeCalculator" class="pos-action-btn close-btn-action" prepend-icon="mdi-close">
              {{ __('Close') }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <!-- Fullscreen Button with Tooltip -->
      <v-tooltip location="top">
        <template v-slot:activator="{ props }">
          <v-btn icon color="primary" height="24" v-bind="props" @click="openFullscreen" class="compact-btn">
            <v-icon v-if="!isFullscreen">mdi-fullscreen</v-icon>
            <v-icon v-else>mdi-fullscreen-exit</v-icon>
          </v-btn>
        </template>
        <span v-if="!isFullscreen">Enter Fullscreen</span>
        <span v-else>Exit Fullscreen</span>
      </v-tooltip>

      <div class="profile-section mx-1">
        <v-chip color="primary" variant="outlined" class="profile-chip">
          <v-icon start>mdi-account-circle</v-icon>
          {{ pos_profile.name }}
        </v-chip>
      </div>

      <div class="text-center">
        <v-menu :min-width="240" :close-on-content-click="false" location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn color="primary" v-bind="props" class="menu-btn-compact">
              Menu
              <v-icon end size="16" class="ml-1">mdi-menu-down</v-icon>
            </v-btn>
          </template>
          <v-card class="menu-card-compact" elevation="12">
            <div class="menu-header-compact">
              <v-icon color="primary" size="20">mdi-menu</v-icon>
              <span class="menu-header-text-compact">{{ __('Actions') }}</span>
            </div>
            <v-list density="compact" class="menu-list-compact">
                <v-list-item
                  @click="print_last_invoice"
                  v-if="pos_profile.posa_allow_print_last_invoice"
                  class="menu-item-compact secondary-action"
                >
                  <template #prepend>
                    <div class="menu-icon-wrapper-compact secondary-icon">
                      <v-icon color="white" size="16">mdi-printer</v-icon>
                    </div>
                  </template>
                  <div class="menu-content-compact">
                    <v-list-item-title class="menu-item-title-compact">{{ __('Print Last Invoice') }}</v-list-item-title>
                    <v-list-item-subtitle class="menu-item-subtitle-compact">{{ __('Reprint previous transaction') }}</v-list-item-subtitle>
                  </div>
                </v-list-item>


                <v-divider class="menu-section-divider-compact"></v-divider>
                <v-divider class="menu-section-divider-compact"></v-divider>
                <v-list-item @click="logOut" class="menu-item-compact danger-action">
                  <template #prepend>
                    <div class="menu-icon-wrapper-compact danger-icon">
                      <v-icon color="white" size="16">mdi-logout</v-icon>
                    </div>
                  </template>
                  <div class="menu-content-compact">
                    <v-list-item-title class="menu-item-title-compact">{{ __('Logout') }}</v-list-item-title>
                    <v-list-item-subtitle class="menu-item-subtitle-compact">{{ __('Sign out of session') }}</v-list-item-subtitle>
                  </div>
                </v-list-item>
                <v-list-item @click="go_about" class="menu-item-compact neutral-action">
                  <template #prepend>
                    <div class="menu-icon-wrapper-compact neutral-icon">
                      <v-icon color="white" size="16">mdi-information-outline</v-icon>
                    </div>
                  </template>
                  <div class="menu-content-compact">
                    <v-list-item-title class="menu-item-title-compact">{{ __('About') }}</v-list-item-title>
                    <v-list-item-subtitle class="menu-item-subtitle-compact">{{ __('App information') }}</v-list-item-subtitle>
                  </div>
                </v-list-item>
            </v-list>
          </v-card>
        </v-menu>
      </div>
    </v-app-bar>

    <v-navigation-drawer
      v-model="drawer"
      v-model:rail="mini"
      class="drawer-custom margen-top"
      width="220"
      @mouseleave="handleMouseLeave"
    >
      <div v-if="!mini" class="drawer-header">
        <v-avatar size="40"><v-img :src="company_img" alt="Company logo"></v-img></v-avatar>
        <span class="drawer-company">{{ company }}</span>
        <v-btn icon @click.stop="mini = !mini">
          <v-icon>mdi-chevron-left</v-icon>
        </v-btn>
      </div>
      <div v-else class="drawer-header-mini">
        <v-avatar size="40"><v-img :src="company_img" alt="Company logo"></v-img></v-avatar>
      </div>

      <v-divider></v-divider>

      <v-list density="compact">
          <v-list-item
            v-for="item in items"
            :key="item.text"
            @click="changePage(item.text)"
            class="drawer-item"
          >
            <template #prepend>
              <v-icon class="drawer-icon">{{ item.icon }}</v-icon>
            </template>
            <div>
              <v-list-item-title class="drawer-item-title">{{ item.text }}</v-list-item-title>
            </div>
          </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-snackbar v-model="snack" :timeout="5000" :color="snackColor" location="top right">
      {{ snackText }}
    </v-snackbar>

    <v-dialog v-model="freeze" persistent max-width="290">
      <v-card class="freeze-dialog-card" elevation="8">
        <v-card-title class="freeze-header pa-4">
          <div class="header-content">
            <div class="header-icon-wrapper">
              <v-icon class="header-icon" size="32">mdi-lock</v-icon>
            </div>
            <div class="header-text">
              <h3 class="header-title">{{ freezeTitle }}</h3>
            </div>
          </div>
        </v-card-title>
        <v-divider class="header-divider"></v-divider>
        <v-card-text class="pa-4">{{ freezeMsg }}</v-card-text>
      </v-card>
    </v-dialog>
    <AdvancePaymentDialog ref="advancePaymentDialog" />
    <CreatePurchaseDialog ref="createPurchaseDialog" />
  </nav>
</template>

<script>
import { evntBus } from '../bus';
import AdvancePaymentDialog from './AdvancePaymentDialog.vue';
import CreatePurchaseDialog from './CreatePurchaseDialog.vue';

export default {
  components: {
    AdvancePaymentDialog,
    CreatePurchaseDialog,
  },
  data() {
    return {
      drawer: false,
      mini: true,
      item: 0,
      items: [{ text: 'POS', icon: 'mdi-network-pos' }],
      page: '',
      fav: true,
      menu: false,
      message: false,
      hints: true,
      menu_item: 0,
      snack: false,
      snackColor: '',
      snackText: '',
      company: 'POS G2Virtu',
      company_img: '/assets/erpnext/images/erpnext-logo.svg',
      pos_profile: { name: '', posa_hide_closing_shift: false, posa_allow_print_last_invoice: false, print_format_for_online: '', print_format: '', letter_head: 0, posa_use_pos_awesome_payments: false },
      freeze: false,
      freezeTitle: '',
      freezeMsg: '',
      last_invoice: '',
      shortcutsDialog: false,
      calculatorVisible: false,
      calculatorDisplay: '',
      lastValue: '',
      lastOperator: '',
      isFullscreen: false
    };
  },
  computed: {
    appBarColor() {
      return this.$vuetify?.theme?.global?.current?.dark ? '#1e1e1e' : 'white';
    }
  },
  methods: {
    openFullscreen() {
      if (!this.isFullscreen) {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen();
        } else if (document.documentElement.mozRequestFullScreen) {
          document.documentElement.mozRequestFullScreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
          document.documentElement.webkitRequestFullscreen();
        } else if (document.documentElement.msRequestFullscreen) {
          document.documentElement.msRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.mozCancelFullScreen) {
          document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen();
        }
      }
    },
    openExpense() {
      evntBus.$emit("open_expense", "true");
    },
    openCalculator() {
      this.calculatorVisible = true;
    },
    closeCalculator() {
      this.calculatorVisible = false;
      this.calculatorDisplay = '';
    },
    clearAll() {
      this.calculatorDisplay = '';
    },
    clearEntry() {
      this.calculatorDisplay = this.calculatorDisplay.slice(0, -1);
    },
    appendValue(value) {
      this.calculatorDisplay += value;
    },
    appendOperator(operator) {
      const lastChar = this.calculatorDisplay.slice(-1);
      if (this.calculatorDisplay !== '' && !['+', '-', '*', '/', '%'].includes(lastChar)) {
        this.calculatorDisplay += operator;
      }
    },
    calculateResult() {
      try {
        this.calculatorDisplay = Function(`"use strict"; return (${this.calculatorDisplay})`)().toString();
      } catch (error) {
        this.calculatorDisplay = "Error";
      }
    },
    handleInput() {
      const lastChar = this.calculatorDisplay.slice(-1);
      const validInput = /^[0-9+\-*/.%]*$/;
      if (!validInput.test(this.calculatorDisplay)) {
        this.calculatorDisplay = this.calculatorDisplay.slice(0, -1);
      }
      if (['+', '-', '*', '/', '%'].includes(lastChar) && ['+', '-', '*', '/', '%'].includes(this.calculatorDisplay.slice(-2, -1))) {
        this.calculatorDisplay = this.calculatorDisplay.slice(0, -1);
      }
    },
    handleKeyDown(event) {
      if (event.key === '+') {
        this.appendOperator('+');
        event.preventDefault();
      }
    },
    openShortcutsDialog() {
      this.shortcutsDialog = true;
    },
    handleMouseLeave() {
      if (!this.drawer) return;
      clearTimeout(this._closeTimeout);
      this._closeTimeout = setTimeout(() => {
        this.drawer = false;
        this.mini = true;
      }, 250);
    },
    changePage(key) {
      this.$emit('changePage', key);
    },
    go_desk() {
      frappe.set_route('/');
      location.reload();
    },
    go_about() {
      const win = window.open(
        'https://www.g2virtu.com/2024/02/g2-rms.html',
        '_blank'
      );
      win.focus();
    },
    close_shift_dialog() {
      evntBus.$emit('open_closing_dialog');
    },
    show_mesage(data) {
      this.snack = true;
      this.snackColor = data.color;
      this.snackText = data.text;
    },
    logOut() {
      var me = this;
      me.logged_out = true;
      return frappe.call({
        method: 'logout',
        callback: function (r) {
          if (r.exc) {
            return;
          }
          frappe.set_route('/login');
          location.reload();
        },
      });
    },

print_last_invoice() {
  frappe.call({
    method: "posawesome.posawesome.api.posapp.get_last_invoice",
    callback: (r) => {
      if (!r.message) {
        frappe.msgprint(__('No invoice found.'));
        return;
      }

      const invoice = r.message;

      // Call server-side function with correct args
      frappe.call({
        method: "posawesome.events.sales_invoice.submit_to_fbr",
        args: {
          doctype: "Sales Invoice", // Hardcode doctype here
          name: invoice // Use invoice instead of vm.invoice_doc
        },
        callback: (r) => {
          if (!r.exc) {
            console.log("FBR submission successful:", r.message);

            // Proceed to print only if FBR submission succeeded
            const print_format =
              this.pos_profile.print_format_for_online ||
              this.pos_profile.print_format;

            const letter_head = this.pos_profile.letter_head || 0;

            const url =
              frappe.urllib.get_base_url() +
              "/printview?doctype=Sales%20Invoice&name=" +
              invoice +
              "&trigger_print=1" +
              "&format=" +
              print_format +
              "&no_letterhead=" +
              letter_head;

            const printWindow = window.open(url, "Print");

            printWindow.addEventListener(
              "load",
              function () {
                printWindow.print();
              },
              true
            );
          } else {
            frappe.msgprint(__('Failed to submit invoice to FBR'));
          }
        }
      });
    }
  });
},
print_last_invoice_old() {
  if (!this.last_invoice) return;

  // ? Call server-side function with correct args
  frappe.call({
    method: "posawesome.events.sales_invoice.submit_to_fbr",
    args: {
      doctype: "Sales Invoice",   // Hardcode doctype here
      name: this.last_invoice     // Use last_invoice instead of vm.invoice_doc
    },
    callback: (r) => {
      if (!r.exc) {
        console.log("FBR submission successful:", r.message);

        // Proceed to print only if FBR submission succeeded
        const print_format =
          this.pos_profile.print_format_for_online ||
          this.pos_profile.print_format;
        const letter_head = this.pos_profile.letter_head || 0;
        const url =
          frappe.urllib.get_base_url() +
          '/printview?doctype=Sales%20Invoice&name=' +
          this.last_invoice +
          '&trigger_print=1' +
          '&format=' +
          print_format +
          '&no_letterhead=' +
          letter_head;
        const printWindow = window.open(url, 'Print');
        printWindow.addEventListener(
          'load',
          function () {
            printWindow.print();
          },
          true
        );
      } else {
        frappe.msgprint(__('Failed to submit invoice to FBR'));
      }
    }
  });
},

    print_last_invoice_without_fbr() {
      if (!this.last_invoice) return;
      const print_format =
        this.pos_profile.print_format_for_online ||
        this.pos_profile.print_format;
      const letter_head = this.pos_profile.letter_head || 0;
      const url =
        frappe.urllib.get_base_url() +
        '/printview?doctype=Sales%20Invoice&name=' +
        this.last_invoice +
        '&trigger_print=1' +
        '&format=' +
        print_format +
        '&no_letterhead=' +
        letter_head;
      const printWindow = window.open(url, 'Print');
      printWindow.addEventListener(
        'load',
        function () {
          printWindow.print();
        },
        true
      );
    },
  },
  mounted() {
    document.addEventListener("fullscreenchange", () => {
      this.isFullscreen = !!document.fullscreenElement;
    });
    document.addEventListener("webkitfullscreenchange", () => {
      this.isFullscreen = !!document.webkitFullscreenElement;
    });
    document.addEventListener("mozfullscreenchange", () => {
      this.isFullscreen = !!document.mozFullScreenElement;
    });
    document.addEventListener("msfullscreenchange", () => {
      this.isFullscreen = !!document.msFullscreenElement;
    });
  },
  created() {
    this.$nextTick(function () {
      evntBus.$on('show_mesage', (data) => {
        this.show_mesage(data);
      });
      evntBus.$on('set_company', (data) => {
        this.company = data.name;
        this.company_img = data.company_logo
          ? data.company_logo
          : this.company_img;
      });
      evntBus.$on('register_pos_profile', (data) => {
        this.pos_profile = data.pos_profile;
        const payments = { text: 'Payments', icon: 'mdi-cash-register' };
        if (
          this.pos_profile.posa_use_pos_awesome_payments &&
          this.items.length !== 2
        ) {
          this.items.push(payments);
        }
        const shortcuts={text:'Shortcuts',icon:"mdi-greater-than-or-equal"};
        this.items.push(shortcuts)
      });
      evntBus.$on('set_last_invoice', (data) => {
        this.last_invoice = data;
      });
      evntBus.$on('freeze', (data) => {
        this.freeze = true;
        this.freezeTitle = data.title;
        this.freezeMsg = data.msg;
      });
      evntBus.$on('unfreeze', () => {
        this.freeze = false;
        this.freezeTitle = '';
        this.freezeMsg = '';
      });
    });
  },
};
</script>

<style scoped>
/* Enhanced Navbar Styling */
.navbar-enhanced {
  background-image: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%) !important;
  background-color: #ffffff !important;
  border-bottom: 2px solid #e3f2fd !important;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
  padding-bottom: 4px !important;
}

.navbar-enhanced:hover {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1) !important;
}

/* Logo and Brand Styling */
.navbar-title {
  text-decoration: none !important;
  border-bottom: none !important;
}

.navbar-title:hover {
  text-decoration: none !important;
}

.brand-title {
  font-size: 1.5rem !important;
  font-weight: 700 !important;
  background: linear-gradient(135deg, #1976d2, #42a5f5);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  transition: all 0.3s ease;
  text-decoration: none !important;
}

.brand-title:hover {
  transform: scale(1.05);
}

.brand-pos {
  font-weight: 300;
}

.brand-awesome {
  font-weight: 800;
}

/* Navigation Icon */
.nav-icon {
  border-radius: 12px;
  padding: 6px;
  transition: all 0.3s ease;
}

.nav-icon:hover {
  background-color: rgba(25, 118, 210, 0.1);
  transform: scale(1.1);
}

/* Action Buttons */
.action-btn {
  background: rgba(25, 118, 210, 0.1) !important;
  border: 1px solid rgba(25, 118, 210, 0.3);
  transition: all 0.3s ease;
  padding: 4px;
}

.action-btn:hover {
  background: rgba(25, 118, 210, 0.2) !important;
  transform: scale(1.05);
}

.action-btn-text {
  text-transform: none;
  font-weight: 500;
  transition: all 0.3s ease;
}

.action-btn-text:hover {
  transform: translateY(-1px);
  color: #d32f2f !important;
}

/* Profile Section */
.profile-section {
  margin: 0 8px;
}

.profile-chip {
  font-weight: 500;
  padding: 6px 12px;
  border-radius: 20px;
  transition: all 0.3s ease;
}

.profile-chip:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(25, 118, 210, 0.3);
}

/* Compact Menu Button */
.menu-btn-compact {
  margin-left: 8px;
  margin-right: 4px;
  padding: 6px 16px;
  border-radius: 20px;
  font-weight: 600;
  text-transform: none;
  font-size: 13px;
  letter-spacing: 0.3px;
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.2);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  background: linear-gradient(135deg, #1976d2 0%, #42a5f5 100%);
  min-width: 90px;
  height: 36px;
}

.menu-btn-compact:hover {
  transform: translateY(-1px) scale(1.02);
  box-shadow: 0 4px 12px rgba(25, 118, 210, 0.3);
  background: linear-gradient(135deg, #1565c0 0%, #1976d2 100%);
}

/* Compact Menu Card */
.menu-card-compact {
  border-radius: 16px;
  overflow: hidden;
  background: #ffffff;
  border: none;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(8px);
  min-width: 260px;
  max-width: 280px;
  margin-top: 2px;
}

/* Compact Menu Header */
.menu-header-compact {
  padding: 12px 16px 10px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e3f2fd 100%);
  display: flex;
  align-items: left;
  gap: 10px;
  border-bottom: 1px solid rgba(25, 118, 210, 0.06);
}

.menu-header-text-compact {
  font-size: 14px;
  font-weight: 600;
  color: #1976d2;
  letter-spacing: 0.3px;
}

/* Compact Menu List */
.menu-list-compact {
  padding: 8px 6px 12px;
  background: #ffffff;
}

/* Compact Menu Items */
.menu-item-compact {
  border-radius: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  position: relative;
  overflow: hidden;
  min-height: 40px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.menu-item-compact::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: transparent;
  transition: all 0.3s ease;
  z-index: 0;
  border-radius: 12px;
}

.menu-item-compact:hover::before {
  background: linear-gradient(135deg, rgba(25, 118, 210, 0.05) 0%, rgba(66, 165, 245, 0.08) 100%);
}

.menu-item-compact:hover {
  transform: translateX(3px) scale(1.01);
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.08);
}

/* Compact Icon Wrapper */
.menu-icon-wrapper-compact {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  position: relative;
  z-index: 1;
  flex-shrink: 0;
}

/* Compact Content Wrapper */
.menu-content-compact {
  flex: 1;
  display: flex;
  flex-direction: row;
  gap: 2px;
  position: relative;
  z-index: 1;
}

/* Compact Icon Colors */
.primary-icon {
  background: linear-gradient(135deg, #1976d2 0%, #42a5f5 100%);
  box-shadow: 0 2px 6px rgba(25, 118, 210, 0.2);
}

.secondary-icon {
  background: linear-gradient(135deg, #7b1fa2 0%, #ba68c8 100%);
  box-shadow: 0 2px 6px rgba(123, 31, 162, 0.2);
}

.neutral-icon {
  background: linear-gradient(135deg, #616161 0%, #9e9e9e 100%);
  box-shadow: 0 2px 6px rgba(97, 97, 97, 0.2);
}

.warning-icon {
  background: linear-gradient(135deg, #f57c00 0%, #ffb74d 100%);
  box-shadow: 0 2px 6px rgba(245, 124, 0, 0.2);
}

.danger-icon {
  background: linear-gradient(135deg, #d32f2f 0%, #f44336 100%);
  box-shadow: 0 2px 6px rgba(211, 47, 47, 0.2);
}

.info-icon {
  background: linear-gradient(135deg, #00897b 0%, #26c6da 100%);
  box-shadow: 0 2px 6px rgba(0, 137, 123, 0.2);
}

.success-icon {
  background: linear-gradient(135deg, #2e7d32 0%, #66bb6a 100%);
  box-shadow: 0 2px 6px rgba(46, 125, 50, 0.2);
}

/* Compact Text Styling */
.menu-item-title-compact {
  font-weight: 600;
  font-size: 14px;
  color: #212121;
  line-height: 1.2;
  margin-bottom: 1px;
}

.menu-item-subtitle-compact {
  font-size: 11px;
  color: #666666;
  line-height: 1.3;
  font-weight: normal;
}

/* Compact Section Divider */
.menu-section-divider-compact {
  margin: 8px 10px;
  opacity: 0.12;
  border-color: #1976d2;
}

/* Compact Hover Effects */
.primary-action:hover .primary-icon {
  transform: scale(1.1) rotate(5deg);
  box-shadow: 0 3px 8px rgba(25, 118, 210, 0.25);
}

.secondary-action:hover .secondary-icon {
  transform: scale(1.1) rotate(-5deg);
  box-shadow: 0 3px 8px rgba(123, 31, 162, 0.25);
}

.neutral-action:hover .neutral-icon {
  transform: scale(1.1);
  box-shadow: 0 3px 8px rgba(97, 97, 97, 0.25);
}

.danger-action:hover .danger-icon {
  transform: scale(1.1) rotate(-5deg);
  box-shadow: 0 3px 8px rgba(211, 47, 47, 0.25);
}

.danger-action:hover::before {
  background: linear-gradient(135deg, rgba(211, 47, 47, 0.05) 0%, rgba(244, 67, 54, 0.08) 100%) !important;
}

/* Navigation Drawer */
.drawer-custom {
  background-color: #fafafa;
  transition: all 0.3s ease-out;
}

.drawer-header {
  display: flex;
  align-items: center;
  height: 64px;
  padding: 0 16px;
}

.drawer-header-mini {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 64px;
}

.drawer-company {
  margin-left: 12px;
  flex: 1;
  font-weight: 500;
  font-size: 1rem;
  color: #424242;
}

.drawer-icon {
  font-size: 24px;
  color: #1976d2;
}

.drawer-item-title {
  margin-left: 8px;
  font-weight: 500;
  color: #424242;
}

.v-list-item:hover {
  background-color: rgba(25, 118, 210, 0.1) !important;
}

.active-item {
  background-color: rgba(25, 118, 210, 0.2) !important;
}

/* Calculator Dialog */
.calc-dialog-card {
  border-radius: 16px !important;
  overflow: hidden;
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%) !important;
  border: 1px solid #e0e0e0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1) !important;
}

.calc-header {
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%) !important;
  border-bottom: 1px solid #e0e0e0;
  padding: 16px !important;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
}

.header-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(25, 118, 210, 0.3);
}

.header-icon {
  color: white !important;
}

.header-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
  line-height: 1.2;
}

.header-divider {
  border-color: #e0e0e0;
}

.calc-row {
  padding: 5px !important;
}

.calc-btn,
.calc-zero {
  padding: 5px !important;
  border-radius: 8px;
  text-transform: none;
  font-weight: 600;
  font-size: 16px;
  transition: all 0.3s ease;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  min-height: 40px;
}

.calc-btn:hover,
.calc-zero:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.v-btn[color="grey"] {
  background: linear-gradient(135deg, #e0e0e0 0%, #bdbdbd 100%) !important;
  color: #424242 !important;
}

.v-btn[color="error"] {
  background: linear-gradient(135deg, #d32f2f 0%, #c62828 100%) !important;
}

.v-btn[color="warning"] {
  background: linear-gradient(135deg, #f57c00 0%, #ef6c00 100%) !important;
}

.v-btn[color="secondary"] {
  background: linear-gradient(135deg, #7b1fa2 0%, #6a1b9a 100%) !important;
}

.v-btn[color="primary"] {
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%) !important;
}

.v-btn[color="success"] {
  background: linear-gradient(135deg, #388e3c 0%, #2e7d32 100%) !important;
}

.v-btn[color="error"] .v-icon,
.v-btn[color="error"] span,
.v-btn[color="warning"] .v-icon,
.v-btn[color="warning"] span,
.v-btn[color="secondary"] .v-icon,
.v-btn[color="secondary"] span,
.v-btn[color="primary"] .v-icon,
.v-btn[color="primary"] span,
.v-btn[color="success"] .v-icon,
.v-btn[color="success"] span {
  color: white !important;
}

.calc-input {
  font-size: 1.2rem;
  margin-bottom: 16px;
  border-radius: 8px;
}

.v-text-field--outlined fieldset {
  border: 1px solid #e0e0e0;
}

.v-text-field--outlined:hover fieldset {
  border-color: #1976d2;
}

.v-text-field--outlined.v-input--is-focused fieldset {
  border-color: #1976d2;
}

/* Dialog Actions */
.dialog-actions-container {
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  border-top: 1px solid #e0e0e0;
  padding: 12px 16px;
}

.pos-action-btn {
  border-radius: 12px;
  text-transform: none;
  font-weight: 600;
  padding: 8px 16px;
  transition: all 0.3s ease;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.close-btn-action {
  background: linear-gradient(135deg, #d32f2f 0%, #c62828 100%) !important;
}

.close-btn-action:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(211, 47, 47, 0.2);
}

.close-btn-action .v-icon,
.close-btn-action span {
  color: white !important;
}

/* Shortcuts Dialog */
.shortcuts-dialog-card {
  border-radius: 24px !important;
  overflow: hidden;
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%) !important;
  border: 1px solid #e0e0e0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1) !important;
}

.shortcuts-header {
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%) !important;
  border-bottom: 1px solid #e0e0e0;
}

/* Freeze Dialog */
.freeze-dialog-card {
  border-radius: 16px !important;
  overflow: hidden;
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%) !important;
  border: 1px solid #e0e0e0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1) !important;
}

.freeze-header {
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%) !important;
  border-bottom: 1px solid #e0e0e0;
}

/* Responsive Design */
@media (max-width: 768px) {
  .brand-title {
    font-size: 1.2rem !important;
  }

  .profile-section {
    margin: 0 4px;
  }

  .profile-chip {
    padding: 4px 8px;
    font-size: 0.85rem;
  }

  .menu-btn-compact {
    padding: 5px 12px;
    min-width: 85px;
    height: 32px;
    font-size: 12px;
  }

  .menu-card-compact {
    min-width: 240px;
    max-width: 260px;
    border-radius: 14px;
  }

  .menu-item-compact {
    min-height: 52px;
    gap: 10px;
  }

  .menu-icon-wrapper-compact {
    width: 30px;
    height: 30px;
  }

  .menu-header-compact {
    padding: 10px 14px 8px;
  }

  .calc-header {
    padding: 12px !important;
  }

  .header-icon-wrapper {
    width: 40px;
    height: 40px;
  }

  .header-title {
    font-size: 1.1rem;
  }

  .calc-btn,
  .calc-zero {
    min-height: 36px;
    font-size: 14px;
  }
}

@media (max-width: 480px) {
  .brand-title {
    font-size: 1rem !important;
  }

  .profile-section {
    margin: 0 2px !important;
  }

  .profile-chip {
    padding: 3px 6px;
    font-size: 10px;
  }

  .menu-btn-compact {
    min-width: 80px;
    height: 30px;
    font-size: 11px;
    padding: 4px 10px;
  }

  .menu-card-compact {
    min-width: 220px;
    max-width: 240px;
  }

  .menu-item-compact {
    min-height: 48px;
    gap: 8px;
  }

  .menu-header-compact {
    padding: 8px 12px 6px;
  }

  .v-dialog {
    max-width: 300px !important;
  }

  .calc-btn,
  .calc-zero {
    padding: 5px !important;
    font-size: 12px;
    min-height: 32px;
  }
}

/* Animation for Menu Appearance */
.v-menu__content {
  animation: menuSlideInCompact 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes menuSlideInCompact {
  from {
    opacity: 0;
    transform: translateY(-8px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Focus States */
.menu-item-compact:focus {
  outline: 1px solid #1976d2;
  outline-offset: 1px;
}

.menu-btn-compact:focus {
  outline: 1px solid #1976d2;
  outline-offset: 2px;
}

/* Dark Theme Adjustments */
.theme--dark .navbar-enhanced {
  background-color: #1e1e !important;
  background-image: none !important;
  border-bottom-color: #333 !important;
  color: #ffffff;
}

.theme--dark .drawer-custom {
  background-color: #121212 !important;
}

.theme--dark .drawer-item-title {
  color: #e0e0e0 !important;
}

.theme--dark .drawer-header {
  .drawer-color {
    color: #333 !important;
  }
}

.theme--dark .calc-card {
  background: linear-gradient(135deg, #1e1e1e 0%, #121212 100%) !important;
  border-color: #333 !important;
}

.theme--dark .shortcuts-card {
  background: linear-gradient(135deg, #1e1e1e 0%, #121212 100%) !important;
  border-color: #333 !important;
}

.theme--dark .freeze-card {
  background: linear-gradient(135deg, #1e1e1e 0%, #121212 100%) !important;
  border-color: #333 !important;
}

.theme--dark .calc-header,
.theme--dark .dialog-actions,
.theme--dark .shortcuts-header,
.theme--dark .freeze-header {
  background: linear-gradient(135deg, #1e1e1e 0%, #121212 100%) !important;
  border-color: #333 !important;
}

.theme--dark .v-text-field--outlined fieldset {
  border-color: #555 !important;
}

.theme--dark .v-text-field--outlined:hover fieldset {
  border-color: #42a5f5 !important;
}

.theme--dark .v-text-field--outlined.v-input--is-focused fieldset {
  border-color: #42a5f5 !important;
}

.theme--dark .v-text-field,
.theme--dark .v-text-field,
.v-text-field .v-label,
.v-text-field .v-input,
.v-text-field .v-icon {
  color: #e0e0 !important;
}

.theme--dark .header-title {
  color: #e0e0e0 !important;
}

.theme--dark .v-btn[color="grey"] {
  background: linear-gradient(135deg, #444  0%, #212121 100%) !important;
  color: #e0e0e0;
}
</style>
