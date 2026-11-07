/**
 * Main Entrypoint: Launches both Merchant and Payment Gateway servers
 */
const { startGatewayServer } = require('./src/gateway/gateway-server');
const { startMerchantServer } = require('./src/merchant/merchant-server');

console.log('================================================================');
console.log('  🚀 E-WALLET END-TO-END PAYMENT FLOW SIMULATOR (MOMO / ZALOPAY)');
console.log('================================================================');

startGatewayServer();
startMerchantServer();

console.log('\nReady! Truy cập các địa chỉ sau trên trình duyệt:');
console.log('👉 Merchant E-Commerce Store : http://localhost:3000');
console.log('👉 Mock E-Wallet Gateway Core : http://localhost:4000/checkout?transId=SAMPLE');
console.log('================================================================\n');
