<template>
  <v-main>
    <div class="links-container">
      <div
        v-for="(link, index) in links"
        :key="index"
        class="link-card"
        @click="navigateTo(link.url)"
      >
        <div class="link-card-content">
          <v-icon class="link-icon">{{ link.icon }}</v-icon>
          <h3 class="link-title">{{ link.title }}</h3>
        </div>
      </div>
    </div>
  </v-main>
</template>

<script>
export default {
  data() {
    return {
      links: [
        { title: 'Payment Entry', url: window.location.origin + '/app/payment-entry/new-payment', icon: 'mdi-cash-multiple' },
        { title: 'Sales Invoice', url: window.location.origin + '/app/sales-invoice/new-sales', icon: 'mdi-file-document-edit' },
        { title: 'Stock Summary', url: window.location.origin + '/app/stock-balance', icon: 'mdi-chart-areaspline' },
        { title: 'Customer Ledger Summary', url: window.location.origin + '/app/query-report/Customer Ledger Summary', icon: 'mdi-account-multiple-outline' },
        
      ]
    };
  },
  methods: {
    navigateTo(url) {
      // If the URL is a relative path, navigate using Vue Router
      if (url.startsWith('/')) {
        this.$router.push(url);
      } else {
        // Open external links in a new tab
        window.open(url, '_blank');
      }
    }
  }
};
</script>

<style scoped>
.links-container {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  align-items: flex-start;
  padding: 20px;
  
}

.link-card {
  width: 200px; /* Adjust as needed */
  height: 200px; /* Same as width for a square */
  margin: 10px; /* Adjust spacing between cards */
  border-radius: 10px; /* Rounded corners */
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
  cursor: pointer;
  border:1px gray solid
}

.link-card:hover {
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); /* Add shadow on hover */
}

.link-card-content {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.link-icon {
  font-size: 48px; /* Adjust icon size */
}

.link-title {
  margin: 10px 0 0; /* Add margin to separate icon and title */
}
</style>