<template>
  <nav>
    <v-app-bar app height="40" class="elevation-2">
      <v-app-bar-nav-icon
        @click.stop="drawer = !drawer"
        class="grey--text"
      ></v-app-bar-nav-icon>
      <v-img
        src="/assets/posawesome/js/rmsapp/components/pos/pos.png"
        alt="POS Awesome"
        max-width="32"
        class="mr-2"
        color="primary"
      ></v-img>
      <v-toolbar-title
        @click="go_desk"
        style="cursor: pointer"
        class="text-uppercase primary--text"
      >
        <span class="font-weight-light">pos</span>
        <span>G2Virtu</span>
      </v-toolbar-title>

      <v-spacer></v-spacer>

      <!-- POS Expense Button with Tooltip -->
      <v-tooltip top>
        <template v-slot:activator="{ on, attrs }">
          <v-btn icon color="error" v-bind="attrs" v-on="on" @click="openExpense">
            <v-icon>mdi-cash-minus</v-icon>
          </v-btn>
        </template>
        <span>Create POS Expense</span>
      </v-tooltip>

      <!-- Calculator Button with Tooltip -->
      <v-tooltip top>
        <template v-slot:activator="{ on, attrs }">
          <v-btn icon color="warning" v-bind="attrs" v-on="on" @click="openCalculator">
            <v-icon>mdi-calculator</v-icon>
          </v-btn>
        </template>
        <span>Open Calculator</span>
      </v-tooltip>

      <!-- Full Calculator Dialog -->
      <v-dialog v-model="calculatorVisible" persistent max-width="350">
        <v-card>
          <v-card-title class="text-h5">Calculator</v-card-title>
          <v-card-text>
            <!-- Calculator Display -->
            <v-text-field
              v-model="calculatorDisplay"
              label="Result"
              outlined
              class="text-right"
              @input="handleInput"
              @keydown.enter="calculateResult"
              @keydown="handleKeyDown"
            ></v-text-field>

            <!-- Calculator Buttons with 4 per row -->
            <v-row>
              <v-col cols="3"><v-btn @click="clearAll" class="calc-btn" color="red">AC</v-btn></v-col>
              <v-col cols="3"><v-btn @click="clearEntry" class="calc-btn" color="orange">CE</v-btn></v-col>
              <v-col cols="3"><v-btn @click="appendOperator('%')" class="calc-btn">%</v-btn></v-col>
              <v-col cols="3"><v-btn @click="appendOperator('/')" class="calc-btn">/</v-btn></v-col>
              
              <v-col cols="3"><v-btn @click="appendValue('7')" class="calc-btn">7</v-btn></v-col>
              <v-col cols="3"><v-btn @click="appendValue('8')" class="calc-btn">8</v-btn></v-col>
              <v-col cols="3"><v-btn @click="appendValue('9')" class="calc-btn">9</v-btn></v-col>
              <v-col cols="3"><v-btn @click="appendOperator('*')" class="calc-btn">*</v-btn></v-col>

              <v-col cols="3"><v-btn @click="appendValue('4')" class="calc-btn">4</v-btn></v-col>
              <v-col cols="3"><v-btn @click="appendValue('5')" class="calc-btn">5</v-btn></v-col>
              <v-col cols="3"><v-btn @click="appendValue('6')" class="calc-btn">6</v-btn></v-col>
              <v-col cols="3"><v-btn @click="appendOperator('-')" class="calc-btn">-</v-btn></v-col>

              <v-col cols="3"><v-btn @click="appendValue('1')" class="calc-btn">1</v-btn></v-col>
              <v-col cols="3"><v-btn @click="appendValue('2')" class="calc-btn">2</v-btn></v-col>
              <v-col cols="3"><v-btn @click="appendValue('3')" class="calc-btn">3</v-btn></v-col>
              <v-col cols="3"><v-btn @click="appendOperator('+')" class="calc-btn">+</v-btn></v-col>

              <v-col cols="6"><v-btn @click="appendValue('0')" class="calc-btn calc-zero">0</v-btn></v-col>
              <v-col cols="3"><v-btn @click="appendValue('.')" class="calc-btn">.</v-btn></v-col>
              <v-col cols="3"><v-btn @click="calculateResult" class="calc-btn" color="green">=</v-btn></v-col>
            </v-row>
          </v-card-text>

          <v-card-actions>
            <v-btn color="error" @click="closeCalculator">Close</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
      <!-- Calculator Buttons -->
      <!-- Fullscreen Button with Tooltip -->
      <v-tooltip top>
        <template v-slot:activator="{ on, attrs }">
          <v-btn icon color="accent" v-bind="attrs" v-on="on" @click="toggleFullscreen">
            <v-icon v-if="!isFullscreen">mdi-fullscreen</v-icon>
            <v-icon v-else>mdi-fullscreen-exit</v-icon>
          </v-btn>
        </template>
        <span v-if="!isFullscreen">Enter Fullscreen</span>
        <span v-else>Exit Fullscreen</span>
      </v-tooltip>
      <!-- Added button for Shortcuts Info -->
      <v-btn color="error" text @click="openShortcutsDialog">
        Shortcuts
      </v-btn>

      <v-btn style="cursor: unset" text color="primary">
        <span right>{{ pos_profile.name }}</span>
      </v-btn>
      <div class="text-center">
        <v-menu offset-y>
          <template v-slot:activator="{ on, attrs }">
            <v-btn color="primary" dark text v-bind="attrs" v-on="on"
              >Menu</v-btn
            >
          </template>
          <v-card class="mx-auto" max-width="300" tile>
            <v-list dense>
              <v-list-item-group v-model="menu_item" color="primary">
                <v-list-item
                  @click="close_shift_dialog"
                  v-if="!pos_profile.posa_hide_closing_shift && item == 0"
                >
                  <v-list-item-icon>
                    <v-icon>mdi-content-save-move-outline</v-icon>
                  </v-list-item-icon>
                  <v-list-item-content>
                    <v-list-item-title>{{
                      __('Close Shift')
                    }}</v-list-item-title>
                  </v-list-item-content>
                </v-list-item>
                <v-list-item
                  @click="print_last_invoice"
                  v-if="
                    pos_profile.posa_allow_print_last_invoice &&
                    this.last_invoice
                  "
                >
                  <v-list-item-icon>
                    <v-icon>mdi-printer</v-icon>
                  </v-list-item-icon>
                  <v-list-item-content>
                    <v-list-item-title>{{
                      __('Print Last Invoice')
                    }}</v-list-item-title>
                  </v-list-item-content>
                </v-list-item>
                <v-divider class="my-0"></v-divider>
                <v-list-item @click="logOut">
                  <v-list-item-icon>
                    <v-icon>mdi-logout</v-icon>
                  </v-list-item-icon>
                  <v-list-item-content>
                    <v-list-item-title>{{ __('Logout') }}</v-list-item-title>
                  </v-list-item-content>
                </v-list-item>
                <v-list-item @click="go_about">
                  <v-list-item-icon>
                    <v-icon>mdi-information-outline</v-icon>
                  </v-list-item-icon>
                  <v-list-item-content>
                    <v-list-item-title>{{ __('About') }}</v-list-item-title>
                  </v-list-item-content>
                </v-list-item>
              </v-list-item-group>
            </v-list>
          </v-card>
        </v-menu>
      </div>
    </v-app-bar>

    <!-- Dialog to display shortcuts -->
<v-dialog v-model="shortcutsDialog" max-width="600">
  <v-card>
    <v-card-title class="text-h5">Keyboard Shortcuts</v-card-title>
    <v-card-text>
      <!-- Table for keyboard shortcuts -->
      <v-simple-table>
        <thead>
          <tr>
            <th class="text-left">Shortcut</th>
            <th class="text-left">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>ALT + F or ESC</strong></td>
            <td>Focus on search field</td>
          </tr>
          <tr>
            <td><strong>ALT + C</strong></td>
            <td>Focus on Customer Field</td>
          </tr>
          <tr>
            <td><strong>CTRL or CMD + S or F7</strong></td>
            <td>Open payments</td>
          </tr>
          <tr>
            <td><strong>F8</strong></td>
            <td>Submit & Print after open payments</td>
          </tr>
          <tr>
            <td><strong>CTRL or CMD + X</strong></td>
            <td>Submit payments</td>
          </tr>
          <tr>
            <td><strong>CTRL or CMD + D</strong></td>
            <td>Remove first item from the top</td>
          </tr>
          <tr>
            <td><strong>CTRL or CMD + Q or F6</strong></td>
            <td>Expand first item from the top</td>
          </tr>
          <tr>
            <td><strong>CTRL or CMD + +</strong></td>
            <td>Increase Qty</td>
          </tr>
          <tr>
            <td><strong>CTRL or CMD + -</strong></td>
            <td>Decrease Qty</td>
          </tr>
          <tr>
            <td><strong>CTRL or CMD + Z</strong></td>
            <td>Focus on discount field</td>
          </tr>
          <tr>
            <td><strong>CTRL or CMD + B or F9</strong></td>
            <td>Hold Invoice</td>
          </tr>
          <tr>
            <td><strong>ALT + B or F10</strong></td>
            <td>Retrieve Invoice</td>
          </tr>
          <tr>
            <td><strong>ALT + R or F11</strong></td>
            <td>Return Invoice</td>
          </tr>
          <tr>
            <td><strong>ALT + V</strong></td>
            <td>Cancel Current Invoice</td>
          </tr>
          <tr>
            <td><strong>CTRL or CMD + H</strong></td>
            <td>On hold invoice, focus on Search Field</td>
          </tr>
        </tbody>
      </v-simple-table>
    </v-card-text>
    <v-card-actions>
      <v-btn color="primary" @click="shortcutsDialog = false">Close</v-btn>
    </v-card-actions>
  </v-card>
</v-dialog>

    <v-navigation-drawer
      v-model="drawer"
      :mini-variant.sync="mini"
      app
      class="primary margen-top"
      width="170"
    >
      <v-list dark>
        <v-list-item class="px-2">
          <v-list-item-avatar>
            <v-img :src="company_img"></v-img>
          </v-list-item-avatar>

          <v-list-item-title>{{ company }}</v-list-item-title>

          <v-btn icon @click.stop="mini = !mini">
            <v-icon>mdi-chevron-left</v-icon>
          </v-btn>
        </v-list-item>

        <v-list-item-group v-model="item" color="white">
          <v-list-item
            v-for="item in items"
            :key="item.text"
            @click="changePage(item.text)"
          >
            <v-list-item-icon>
              <v-icon v-text="item.icon"></v-icon>
            </v-list-item-icon>
            <v-list-item-content>
              <v-list-item-title v-text="item.text"></v-list-item-title>
            </v-list-item-content>
          </v-list-item>
        </v-list-item-group>
      </v-list>
    </v-navigation-drawer>

    <v-snackbar v-model="snack" :timeout="5000" :color="snackColor" top right>
      {{ snackText }}
    </v-snackbar>


    <v-dialog v-model="freeze" persistent max-width="290">
      <v-card>
        <v-card-title class="text-h5">
          {{ freezeTitle }}
        </v-card-title>
        <v-card-text>{{ freezeMsg }}</v-card-text>
      </v-card>
    </v-dialog>
  </nav>
</template>

<script>
import { evntBus } from '../bus';

export default {
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
      company: 'POS Awesome',
      company_img: '/assets/erpnext/images/erpnext-logo.svg',
      pos_profile: '',
      freeze: false,
      freezeTitle: '',
      freezeMsg: '',
      last_invoice: '',
      shortcutsDialog: false, // Added for shortcuts dialog
      calculatorVisible: false, // Controls calculator dialog visibility
      calculatorDisplay: '', // Holds the current display value
      lastValue: '', // Stores the last entered value
      lastOperator: '', // Stores the last operator used
      isFullscreen: false
    };
  },
  methods: {
    toggleFullscreen() {
      if (!this.isFullscreen) {
        // Enter fullscreen
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen();
        } else if (document.documentElement.mozRequestFullScreen) { // Firefox
          document.documentElement.mozRequestFullScreen();
        } else if (document.documentElement.webkitRequestFullscreen) { // Chrome, Safari, Opera
          document.documentElement.webkitRequestFullscreen();
        } else if (document.documentElement.msRequestFullscreen) { // IE/Edge
          document.documentElement.msRequestFullscreen();
        }
      } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.mozCancelFullScreen) { // Firefox
          document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) { // Chrome, Safari, Opera
          document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) { // IE/Edge
          document.msExitFullscreen();
        }
      }
    },
    openExpense() {
      evntBus.$emit("open_expense", "true");
    },
    // Toggle calculator dialog
    openCalculator() {
      this.calculatorVisible = true;
    },
    closeCalculator() {
      this.calculatorVisible = false;
    },
    clearAll() {
      // Clears all calculator data
      this.calculatorDisplay = '';
    },
    clearEntry() {
      // Clears the last entered value (similar to backspace)
      this.calculatorDisplay = this.calculatorDisplay.slice(0, -1);
    },
    appendValue(value) {
      // Adds the pressed number to the display (appends to the expression)
      this.calculatorDisplay += value;
    },
    appendOperator(operator) {
      // Adds the pressed operator to the display (appends to the expression)
      const lastChar = this.calculatorDisplay.slice(-1);
      if (this.calculatorDisplay !== '' && !['+', '-', '*', '/', '%'].includes(lastChar)) {
        this.calculatorDisplay += operator;
      }
    },
//    calculateResult() {
//      // Calculate the result from the full expression
//      try {
//        this.calculatorDisplay = eval(this.calculatorDisplay).toString();
//      } catch (e) {
//        this.calculatorDisplay = 'Error';
//      }
//    },
    calculateResult() {
      try {
        this.calculatorDisplay = Function(`"use strict"; return (${this.calculatorDisplay})`)().toString();
      } catch (error) {
        this.calculatorDisplay = "Error";
      }
    },
    handleInput() {
      // Allow typing valid numbers, operators, and decimals
      const lastChar = this.calculatorDisplay.slice(-1);
      const validInput = /^[0-9+\-*/.%]*$/;
      
      // Prevent consecutive operators from being typed
      if (!validInput.test(this.calculatorDisplay)) {
        this.calculatorDisplay = this.calculatorDisplay.slice(0, -1);
      }

      // Prevent multiple consecutive operators
      if (['+', '-', '*', '/', '%'].includes(lastChar) && ['+', '-', '*', '/', '%'].includes(this.calculatorDisplay.slice(-2, -1))) {
        this.calculatorDisplay = this.calculatorDisplay.slice(0, -1);
      }
    },
    handleKeyDown(event) {
      // Handle keyboard input for the + operator
      if (event.key === '+') {
        this.appendOperator('+');
        event.preventDefault(); // Prevent default behavior for + key
      }
    },
  openShortcutsDialog() {
    this.shortcutsDialog = true;
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
    // Update the fullscreen state based on fullscreen change events
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
  created: function () {
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
        this.freezTitle = '';
        this.freezeMsg = '';
      });
    });
  },
};
</script>

<style scoped>
/* Style for calculator buttons */
.calc-btn {
  min-width: 64px;
  min-height: 64px;
  font-size: 20px;
}

.calc-zero {
  width: 100%; /* Make the 0 button fill two columns */
}

.v-card {
  padding: 20px;
}

.margen-top {
  margin-top: 0px;
}
</style>
