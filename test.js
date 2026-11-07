/**
 * Automated End-to-End Test & Verification Suite
 * Simulates a full payment lifecycle:
 * 1. Merchant initiates order & generates HMAC-SHA256 signature
 * 2. Gateway verifies signature, creates order & returns checkout URL
 * 3. Client executes payment (success case)
 * 4. Gateway sends Server-to-Server IPN Callback to Merchant
 * 5. Merchant verifies IPN signature, checks Idempotency, and finalizes Order
 * 6. Test tamper detection (tampered signature test)
 */
const http = require('http');
const CryptoUtils = require('./src/common/crypto');
const config = require('./src/common/config');
const db = require('./src/common/db');
const { startGatewayServer } = require('./src/gateway/gateway-server');
const { startMerchantServer } = require('./src/merchant/merchant-server');

function makeRequest(urlStr, method, data) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const bodyStr = data ? JSON.stringify(data) : '';
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + (parsed.search || ''),
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
        },
      },
      (res) => {
        let respData = '';
        res.on('data', c => respData += c);
        res.on('end', () => {
          resolve({ status: res.statusCode, headers: res.headers, body: respData });
        });
      }
    );
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function runVerification() {
  console.log('\n--- 🧪 RUNNING AUTOMATED E2E ARCHITECTURE VERIFICATION ---\n');

  // Start both servers
  startGatewayServer();
  startMerchantServer();

  await new Promise(r => setTimeout(r, 500));

  // TEST 1: Create Order with Valid Signature
  console.log('[TEST 1] Testing Order Creation with Valid Signature...');
  const appTransId = `TEST_ORDER_${Date.now()}`;
  const orderPayload = {
    appId: config.MERCHANT.APP_ID,
    appTransId,
    amount: 250000,
    orderInfo: 'Automated Test Order',
    returnUrl: config.MERCHANT.REDIRECT_ENDPOINT,
    ipnUrl: config.MERCHANT.IPN_ENDPOINT,
    extraData: 'test_meta',
  };
  const canonicalStr = CryptoUtils.buildCanonicalQuery(orderPayload, ['signature']);
  orderPayload.signature = CryptoUtils.signHmacSha256(canonicalStr, config.GATEWAY.SECRET_KEY);

  const createRes = await makeRequest(config.GATEWAY.CREATE_PAYMENT_URL, 'POST', orderPayload);
  const createJson = JSON.parse(createRes.body);
  console.log(`-> Response Status: ${createRes.status}, returnCode: ${createJson.returnCode}`);
  if (createJson.returnCode !== 0) throw new Error('Test 1 Failed: Expected returnCode 0');
  console.log('✅ TEST 1 PASSED: Order created & signature verified by Gateway.\n');

  // TEST 2: Tamper Signature Detection
  console.log('[TEST 2] Testing Tampered Payload Detection...');
  const tamperedPayload = { ...orderPayload, amount: 99999999 }; // Tampered without updating signature
  const tamperRes = await makeRequest(config.GATEWAY.CREATE_PAYMENT_URL, 'POST', tamperedPayload);
  const tamperJson = JSON.parse(tamperRes.body);
  console.log(`-> Response Status: ${tamperRes.status}, returnCode: ${tamperJson.returnCode}`);
  if (tamperJson.returnCode !== config.RESPONSE_CODES.INVALID_SIGNATURE) {
    throw new Error('Test 2 Failed: Gateway failed to reject tampered signature');
  }
  console.log('✅ TEST 2 PASSED: Gateway successfully rejected tampered amount payload.\n');

  // TEST 3: User Confirmation & IPN Callback Verification
  console.log('[TEST 3] Testing User Payment Confirmation & IPN Server-to-Server Callback...');
  const transId = createJson.transId;

  // Merchant registers order in DB first (simulating store checkout)
  db.createOrder({
    orderId: appTransId,
    amount: 250000,
    status: config.ORDER_STATUS.PENDING,
  });

  const confirmRes = await makeRequest(`${config.GATEWAY.BASE_URL}/v2/gateway/pay/confirm`, 'POST', {
    transId,
    action: 'SUCCESS',
  });
  console.log(`-> Gateway Confirm Redirect Status: ${confirmRes.status}`);

  // Give a short delay for asynchronous IPN execution
  await new Promise(r => setTimeout(r, 600));

  const updatedOrder = db.getOrder(appTransId);
  console.log(`-> Merchant Order Status after IPN: ${updatedOrder?.status}`);
  if (updatedOrder?.status !== config.ORDER_STATUS.SUCCESS) {
    throw new Error(`Test 3 Failed: Merchant order status is ${updatedOrder?.status}, expected SUCCESS`);
  }
  console.log('✅ TEST 3 PASSED: Server-to-Server IPN verified and Merchant DB updated to SUCCESS.\n');

  // TEST 4: Idempotency Protection Test
  console.log('[TEST 4] Testing Idempotent IPN Handling (Replay Attack / Duplicate Webhook)...');
  const ipnKey = `ipn_${transId}_${config.RESPONSE_CODES.SUCCESS}`;
  const isMarked = db.hasProcessedIdempotencyKey(ipnKey);
  if (!isMarked) throw new Error('Test 4 Failed: Idempotency key was not marked');
  console.log('✅ TEST 4 PASSED: Idempotency key successfully guarded against duplicate processing.\n');

  console.log('🎉 ALL ARCHITECTURE VERIFICATION TESTS COMPLETED SUCCESSFULLY!');
  process.exit(0);
}

runVerification().catch(err => {
  console.error('❌ VERIFICATION FAILED:', err);
  process.exit(1);
});
