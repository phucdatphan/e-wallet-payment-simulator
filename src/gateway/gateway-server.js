/**
 * Mock Payment Gateway Server (Simulates MoMo & ZaloPay Backend Core)
 * Runs on Port 4000
 */
const http = require('http');
const MiniServer = require('../common/mini-server');
const CryptoUtils = require('../common/crypto');
const QRCodeGenerator = require('../common/qr');
const config = require('../common/config');
const db = require('../common/db');

const app = new MiniServer();

/**
 * 1. Create Payment Order API (/v2/gateway/pay/create)
 */
app.post('/v2/gateway/pay/create', async (req, res) => {
  const {
    appId,
    appTransId,
    amount,
    orderInfo,
    returnUrl,
    ipnUrl,
    extraData,
    signature,
  } = req.body;

  console.log('\n[GATEWAY] 📥 Received Payment Creation Request:');
  console.log(`- Order: ${appTransId} | Amount: ${amount} VND | AppId: ${appId}`);

  // Step 1: Verify Merchant Authentication & Signature
  if (appId !== config.GATEWAY.GATEWAY_ID && appId !== config.MERCHANT.APP_ID) {
    return res.json({
      returnCode: config.RESPONSE_CODES.ORDER_NOT_FOUND,
      returnMessage: 'Unrecognized merchant appId',
    }, 401);
  }

  const verifyData = { appId, appTransId, amount, orderInfo, returnUrl, ipnUrl, extraData };
  const canonicalString = CryptoUtils.buildCanonicalQuery(verifyData);
  const isValid = CryptoUtils.verifySignature(canonicalString, config.GATEWAY.SECRET_KEY, signature);

  if (!isValid) {
    console.error(`[GATEWAY] ❌ Invalid Merchant Signature! Raw string: "${canonicalString}"`);
    return res.json({
      returnCode: config.RESPONSE_CODES.INVALID_SIGNATURE,
      returnMessage: 'HMAC-SHA256 signature mismatch. Request payload altered or bad secret key.',
    }, 400);
  }

  console.log('[GATEWAY] ✅ Merchant signature validated successfully.');

  // Step 2: Idempotency check on Gateway side
  const existingTx = db.getGatewayTxByOrderId(appTransId);
  if (existingTx) {
    console.log(`[GATEWAY] ⚠️ Idempotent hit: Order ${appTransId} already exists in gateway.`);
    return res.json({
      returnCode: config.RESPONSE_CODES.SUCCESS,
      returnMessage: 'Success (Existing Transaction)',
      transId: existingTx.transId,
      orderUrl: `${config.GATEWAY.BASE_URL}/checkout?transId=${existingTx.transId}`,
      deeplink: `ewallet://pay?transId=${existingTx.transId}`,
    });
  }

  // Step 3: Register transaction in Gateway Core
  const transId = 'TXN_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  const tx = db.createGatewayTx({
    transId,
    appId,
    appTransId,
    amount: Number(amount),
    orderInfo,
    returnUrl,
    ipnUrl,
    extraData: extraData || '',
    status: config.ORDER_STATUS.PENDING,
    method: null,
  });

  const checkoutUrl = `${config.GATEWAY.BASE_URL}/checkout?transId=${transId}`;
  const deeplink = `ewallet://pay?transId=${transId}`;

  return res.json({
    returnCode: config.RESPONSE_CODES.SUCCESS,
    returnMessage: 'Payment order created successfully',
    transId,
    orderUrl: checkoutUrl,
    deeplink,
    amount,
  });
});

/**
 * 2. Checkout Web View (Hosted Payment Page / Real QR Code / Error Simulator)
 */
app.get('/checkout', async (req, res) => {
  const { transId } = req.query;
  const tx = db.getGatewayTx(transId);

  if (!tx) {
    return res.html(`<h2>404 - Transaction Not Found</h2><p>ID: ${transId}</p>`, 404);
  }

  // Generate real inline SVG QR code representing deep-link
  const qrPayload = `ewallet://pay?id=${tx.transId}&amount=${tx.amount}&ref=${tx.appTransId}`;
  const qrSvg = QRCodeGenerator.generateSVG(qrPayload, 170);

  const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Cổng Thanh Toán Ví Điện Tử (MoMo / ZaloPay Simulator)</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, sans-serif; }
    body { background: #f0f2f5; margin: 0; padding: 20px; display: flex; justify-content: center; }
    .card { background: white; width: 100%; max-width: 520px; border-radius: 16px; box-shadow: 0 8px 30px rgba(0,0,0,0.08); overflow: hidden; border: 1px solid #e5e7eb; }
    .header { background: linear-gradient(135deg, #a50064, #d82d8b); color: white; padding: 20px; text-align: center; }
    .zalopay-theme .header { background: linear-gradient(135deg, #0068ff, #008fe5); }
    .header h2 { margin: 0 0 6px; font-size: 19px; }
    .badge { display: inline-block; background: rgba(255,255,255,0.25); padding: 3px 10px; border-radius: 20px; font-size: 11px; }
    .content { padding: 20px; }
    .amount-box { text-align: center; margin: 12px 0 18px; }
    .amount { font-size: 30px; font-weight: 700; color: #a50064; }
    .zalopay-theme .amount { color: #0068ff; }
    .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #eee; font-size: 13px; }
    .label { color: #64748b; }
    .val { font-weight: 600; color: #1e293b; word-break: break-all; }
    
    .qr-container { text-align: center; margin: 16px 0; padding: 16px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; }
    .qr-box { display: inline-block; padding: 8px; background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .qr-hint { margin: 10px 0 0; font-size: 12px; color: #64748b; }
    .qr-raw { font-size: 11px; color: #94a3b8; font-family: monospace; margin-top: 4px; word-break: break-all; }

    .section-title { font-size: 13px; font-weight: 700; color: #334155; margin: 18px 0 8px; text-transform: uppercase; letter-spacing: 0.5px; }
    .btn-grid { display: grid; grid-template-columns: 1fr; gap: 8px; }
    
    button { width: 100%; padding: 12px 14px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: 0.15s; display: flex; align-items: center; justify-content: space-between; text-align: left; }
    .btn-pay { background: #16a34a; color: white; }
    .btn-pay:hover { background: #15803d; }
    .btn-cancel { background: #f1f5f9; color: #475569; }
    .btn-cancel:hover { background: #e2e8f0; }

    .err-group { background: #fff5f5; border: 1px solid #fed7d7; border-radius: 10px; padding: 12px; margin-top: 12px; }
    .err-btn { background: white; border: 1px solid #feb2b2; color: #9b2c2c; font-size: 12px; padding: 9px 12px; margin-bottom: 6px; }
    .err-btn:hover { background: #fffaf0; border-color: #fbd38d; }
    .err-btn span.code { font-family: monospace; font-weight: bold; background: #fed7d7; padding: 2px 6px; border-radius: 4px; }
  </style>
</head>
<body class="${tx.appId === 'ZALOPAY' ? 'zalopay-theme' : ''}">
  <div class="card">
    <div class="header">
      <h2>Cổng Thanh Toán Ví Điện Tử</h2>
      <span class="badge">Architecture Sandbox / Interactive Gateway</span>
    </div>
    <div class="content">
      <div class="amount-box">
        <div style="color: #64748b; font-size: 12px;">Số tiền cần thanh toán</div>
        <div class="amount">${tx.amount.toLocaleString('vi-VN')} đ</div>
      </div>

      <div class="row">
        <span class="label">Mã giao dịch ví (TransID):</span>
        <span class="val">${tx.transId}</span>
      </div>
      <div class="row">
        <span class="label">Mã đơn Merchant:</span>
        <span class="val">${tx.appTransId}</span>
      </div>
      <div class="row">
        <span class="label">Mô tả:</span>
        <span class="val">${tx.orderInfo}</span>
      </div>

      <!-- Real QR Code Rendering -->
      <div class="qr-container">
        <div class="qr-box">
          ${qrSvg}
        </div>
        <div class="qr-hint">📲 <strong>Quét mã QR bằng App MoMo / ZaloPay</strong></div>
        <div class="qr-raw">${qrPayload}</div>
      </div>

      <form action="/v2/gateway/pay/confirm" method="POST">
        <input type="hidden" name="transId" value="${tx.transId}" />

        <div class="section-title">1. Giả lập Luồng Thành công (Happy Path)</div>
        <button type="submit" name="action" value="SUCCESS" class="btn-pay">
          <span>✓ Xác nhận Thanh Toán Thành Công</span>
          <span>(Code 0)</span>
        </button>

        <div class="section-title" style="margin-top: 14px;">2. Giả lập Các Ca Lỗi Thanh Toán Thực Tế (Failure Test Cases)</div>
        <div class="err-group">
          <div style="font-size: 11px; color: #742a2a; margin-bottom: 8px;">
            ⚠️ Chọn một ca lỗi dưới đây để kiểm tra phản ứng của Merchant Server (IPN xử lý lỗi & đối soát):
          </div>

          <button type="submit" name="action" value="USER_CANCELLED" class="err-btn">
            <span>✕ Người dùng chủ động Hủy</span>
            <span class="code">Code 4012</span>
          </button>

          <button type="submit" name="action" value="INSUFFICIENT_BALANCE" class="err-btn">
            <span>✕ Số dư ví không đủ (Insufficient Balance)</span>
            <span class="code">Code 4010</span>
          </button>

          <button type="submit" name="action" value="BANK_DECLINED" class="err-btn">
            <span>✕ Ngân hàng liên kết từ chối (Bank Declined)</span>
            <span class="code">Code 4018</span>
          </button>

          <button type="submit" name="action" value="TRANSACTION_EXPIRED" class="err-btn">
            <span>✕ Mã QR hết hạn (Expired Session)</span>
            <span class="code">Code 4015</span>
          </button>

          <button type="submit" name="action" value="DAILY_LIMIT_EXCEEDED" class="err-btn">
            <span>✕ Vượt hạn mức giao dịch ví trong ngày</span>
            <span class="code">Code 4020</span>
          </button>

          <button type="submit" name="action" value="TAMPERED_AMOUNT" class="err-btn" style="border-color:#e53e3e; background:#fff5f5;">
            <span>🚨 Tấn công can thiệp số tiền (Hacker Tampering)</span>
            <span class="code">Amount 100đ</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</body>
</html>
  `;
  res.html(html);
});

/**
 * 3. Payment Confirmation Handler & Asynchronous Webhook (IPN) Dispatcher
 */
app.post('/v2/gateway/pay/confirm', async (req, res) => {
  const { transId, action } = req.body;
  const tx = db.getGatewayTx(transId);

  if (!tx) {
    return res.html('Transaction not found', 404);
  }

  let isSuccess = false;
  let resultCode = config.RESPONSE_CODES.USER_CANCELLED;
  let message = 'Người dùng hủy thanh toán';
  let callbackAmount = tx.amount;

  const errDetail = config.ERROR_DETAILS[action];
  if (errDetail) {
    resultCode = errDetail.code;
    message = errDetail.title;
    isSuccess = action === 'SUCCESS';
  }

  // Giả lập case hacker cố tình sửa số tiền gửi trong IPN để chuộc lợi
  if (action === 'TAMPERED_AMOUNT') {
    isSuccess = true;
    resultCode = config.RESPONSE_CODES.SUCCESS;
    message = 'Giao dịch thành công (Nhưng số tiền bị can thiệp)';
    callbackAmount = 100; // Fake amount to test Merchant defense
  }

  const newStatus = isSuccess ? config.ORDER_STATUS.SUCCESS : config.ORDER_STATUS.FAILED;

  // Update Gateway State
  db.updateGatewayTx(transId, {
    status: newStatus,
    resultCode,
    message,
    paymentTime: Date.now(),
  });

  console.log(`\n[GATEWAY] ⚡ Payment confirmed with Action: ${action} | ResultCode: ${resultCode} | Status: ${newStatus}`);

  // Step 4: Dispatch Server-to-Server IPN (Webhook) with HMAC Signature
  dispatchWebhookToMerchant(tx, resultCode, message, callbackAmount, action);

  // Step 5: Redirect customer back to Merchant Return URL
  const redirectParams = new URLSearchParams({
    appTransId: tx.appTransId,
    transId: tx.transId,
    amount: String(callbackAmount),
    resultCode: String(resultCode),
    message,
  });

  // Calculate returnUrl signature so client cannot tamper with query params
  const signPayload = {
    amount: callbackAmount,
    appTransId: tx.appTransId,
    message,
    resultCode,
    transId: tx.transId,
  };
  const returnSignature = CryptoUtils.signHmacSha256(
    CryptoUtils.buildCanonicalQuery(signPayload),
    config.GATEWAY.SECRET_KEY
  );
  redirectParams.append('signature', returnSignature);

  res.redirect(`${tx.returnUrl}?${redirectParams.toString()}`);
});

/**
 * Helper function: Dispatches asynchronous IPN Callback to Merchant Server
 */
function dispatchWebhookToMerchant(tx, resultCode, message, amountToSend, actionName) {
  console.log(`[GATEWAY -> MERCHANT] 🚀 Initiating Server-to-Server IPN Callback to ${tx.ipnUrl}...`);

  const ipnPayload = {
    appId: tx.appId,
    appTransId: tx.appTransId,
    transId: tx.transId,
    amount: amountToSend,
    resultCode,
    message,
    extraData: tx.extraData || '',
    responseTime: Date.now(),
  };

  const canonicalString = CryptoUtils.buildCanonicalQuery(ipnPayload, ['signature']);
  const signature = CryptoUtils.signHmacSha256(canonicalString, config.GATEWAY.SECRET_KEY);
  ipnPayload.signature = signature;

  const dataToSend = JSON.stringify(ipnPayload);
  const ipnUrlObj = new URL(tx.ipnUrl);

  const req = http.request(
    {
      hostname: ipnUrlObj.hostname,
      port: ipnUrlObj.port,
      path: ipnUrlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataToSend),
        'X-EWallet-Signature': signature,
      },
    },
    (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        console.log(`[GATEWAY -> MERCHANT] 📬 IPN Response HTTP ${res.statusCode}: ${responseBody.trim()}`);
        db.logWebhook({
          direction: 'GATEWAY_OUTBOUND',
          url: tx.ipnUrl,
          payload: ipnPayload,
          actionName,
          httpStatus: res.statusCode,
          response: responseBody,
        });
      });
    }
  );

  req.on('error', (e) => {
    console.error(`[GATEWAY -> MERCHANT] 💥 IPN Delivery Error: ${e.message}`);
    db.logWebhook({
      direction: 'GATEWAY_OUTBOUND',
      url: tx.ipnUrl,
      payload: ipnPayload,
      actionName,
      error: e.message,
    });
  });

  req.write(dataToSend);
  req.end();
}

/**
 * Query Transaction Status API (/v2/gateway/pay/query)
 */
app.post('/v2/gateway/pay/query', (req, res) => {
  const { appId, appTransId, signature } = req.body;
  const canonicalString = CryptoUtils.buildCanonicalQuery({ appId, appTransId });

  if (!CryptoUtils.verifySignature(canonicalString, config.GATEWAY.SECRET_KEY, signature)) {
    return res.json({ returnCode: config.RESPONSE_CODES.INVALID_SIGNATURE, returnMessage: 'Signature mismatch' }, 400);
  }

  const tx = db.getGatewayTxByOrderId(appTransId);
  if (!tx) {
    return res.json({ returnCode: config.RESPONSE_CODES.ORDER_NOT_FOUND, returnMessage: 'Transaction not found' }, 404);
  }

  res.json({
    returnCode: config.RESPONSE_CODES.SUCCESS,
    appTransId: tx.appTransId,
    transId: tx.transId,
    amount: tx.amount,
    status: tx.status,
    resultCode: tx.resultCode ?? null,
  });
});

const server = http.createServer((req, res) => app.handle(req, res));

function startGatewayServer() {
  server.listen(config.GATEWAY.PORT, () => {
    console.log(`[GATEWAY] 🟢 Mock Payment Gateway Core listening on http://localhost:${config.GATEWAY.PORT}`);
  });
}

module.exports = { startGatewayServer, app };
