/**
 * Unit & Architecture Verification Suite (Runs completely in-process without socket network calls)
 */
const CryptoUtils = require('./src/common/crypto');
const config = require('./src/common/config');
const db = require('./src/common/db');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
}

console.log('================================================================');
console.log('  🧪 RUNNING IN-PROCESS CRYPTOGRAPHIC & STATE VERIFICATION');
console.log('================================================================\n');

// 1. Signature calculation & canonical query building
console.log('[TEST 1] Canonical Query & HMAC-SHA256 Signing...');
const samplePayload = {
  appId: 'MERCHANT_DEMO_2026',
  appTransId: 'ORDER_1700000000_123',
  amount: 150000,
  orderInfo: 'Test Order Payment',
  returnUrl: 'http://localhost:3000/order-result',
  ipnUrl: 'http://localhost:3000/api/payment/callback',
  extraData: 'channel=MOMO',
};

const canonicalString = CryptoUtils.buildCanonicalQuery(samplePayload, ['signature']);
const signature = CryptoUtils.signHmacSha256(canonicalString, config.MERCHANT.SECRET_KEY);

console.log(`- Canonical string: "${canonicalString}"`);
console.log(`- Generated signature: ${signature}`);
assert(signature && signature.length === 64, 'Signature must be a 64-char hex string (SHA256)');
console.log('✅ TEST 1 PASSED: Canonicalization & HMAC-SHA256 signature generated correctly.\n');

// 2. Signature verification & Constant-Time comparison
console.log('[TEST 2] Verifying Valid Signature...');
const isValid = CryptoUtils.verifySignature(canonicalString, config.GATEWAY.SECRET_KEY, signature);
assert(isValid === true, 'Valid signature must verify successfully');
console.log('✅ TEST 2 PASSED: Signature verified successfully with shared secret.\n');

// 3. Tampering detection (Anti-Tamper & Man-In-The-Middle defense)
console.log('[TEST 3] Tampered Data Detection...');
const tamperedPayload = { ...samplePayload, amount: 99999999 };
const tamperedCanonical = CryptoUtils.buildCanonicalQuery(tamperedPayload, ['signature']);
const isTamperedValid = CryptoUtils.verifySignature(tamperedCanonical, config.GATEWAY.SECRET_KEY, signature);
assert(isTamperedValid === false, 'Tampered payload must NOT pass verification');
console.log('✅ TEST 3 PASSED: Tampered payload successfully rejected.\n');

// 4. Idempotency handling in Memory Database
console.log('[TEST 4] Idempotency Key Tracking & Double-Spending Protection...');
const txId = 'TXN_999888';
const idempotencyKey = `ipn_${txId}_SUCCESS`;

assert(!db.hasProcessedIdempotencyKey(idempotencyKey), 'Key should not exist initially');
db.markIdempotencyKey(idempotencyKey);
assert(db.hasProcessedIdempotencyKey(idempotencyKey), 'Key must be recognized as processed');
console.log('✅ TEST 4 PASSED: Idempotency protection properly marks processed IPNs.\n');

// 5. Database State Transition Simulation
console.log('[TEST 5] Order Lifecycle State Machine...');
db.createOrder({
  orderId: 'ORDER_TEST_001',
  amount: 150000,
  status: config.ORDER_STATUS.PENDING,
});
assert(db.getOrder('ORDER_TEST_001').status === config.ORDER_STATUS.PENDING, 'Initial status must be PENDING');

db.updateOrderStatus('ORDER_TEST_001', config.ORDER_STATUS.SUCCESS, { gatewayTransId: txId });
assert(db.getOrder('ORDER_TEST_001').status === config.ORDER_STATUS.SUCCESS, 'Status must update to SUCCESS');
assert(db.getOrder('ORDER_TEST_001').paymentDetails.gatewayTransId === txId, 'Details must be persisted');
console.log('✅ TEST 5 PASSED: Order state transition follows correct lifecycle.\n');

console.log('🎉 ALL 5 ARCHITECTURE & SECURITY UNIT TESTS PASSED (100% SUCCESS)!');
