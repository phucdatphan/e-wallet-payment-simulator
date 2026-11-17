/**
 * Mock Payment Gateway Server (Simulates MoMo & ZaloPay Backend Core)
 * Runs on Port 4000 — Upgraded Fintech Design System v2.0
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
  db.createGatewayTx({
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

  let channel = 'MOMO';
  try {
    if (tx.extraData) {
      const parsed = JSON.parse(tx.extraData);
      if (parsed.channel === 'ZALOPAY') channel = 'ZALOPAY';
    }
  } catch (_) {
    if (String(tx.extraData).includes('ZALOPAY') || tx.appId === 'ZALOPAY') channel = 'ZALOPAY';
  }
  const isZalo = channel === 'ZALOPAY';

  // Generate real inline SVG QR code representing deep-link
  const qrPayload = `ewallet://pay?wallet=${channel}&id=${tx.transId}&amount=${tx.amount}&ref=${tx.appTransId}`;
  const qrSvg = QRCodeGenerator.generateSVG(qrPayload, 184);

  const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Cổng Thanh Toán ${isZalo ? 'ZaloPay' : 'MoMo'} — Hosted Checkout v2.0</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root {
      --brand: ${isZalo ? '#0068ff' : '#a50064'};
      --brand-light: ${isZalo ? '#eff6ff' : '#fdf2f8'};
      --brand-grad: ${isZalo ? 'linear-gradient(135deg, #0052cc, #008fe5)' : 'linear-gradient(135deg, #8b0054, #d82d8b)'};
    }
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif; }
    body { background: radial-gradient(circle at top, var(--brand-light) 0%, #f1f5f9 65%); margin: 0; padding: 28px 16px; display: flex; justify-content: center; align-items: center; min-height: 100vh; color: #0f172a; }
    .shell {
      background: #fff; width: 100%; max-width: 880px; border-radius: 24px;
      box-shadow: 0 24px 60px rgba(15,23,42,0.10); overflow: hidden; border: 1px solid #e2e8f0;
    }
    .header {
      background: var(--brand-grad); color: #fff; padding: 20px 28px;
      display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;
    }
    .header-left { display: flex; align-items: center; gap: 12px; }
    .brand-chip { background: rgba(255,255,255,0.22); padding: 6px 12px; border-radius: 10px; font-weight: 800; font-size: 14px; letter-spacing: 0.03em; }
    .header h2 { margin: 0; font-size: 18px; font-weight: 800; }
    .header small { opacity: 0.88; font-size: 12px; }
    .timer-pill {
      background: rgba(15,23,42,0.28); border: 1px solid rgba(255,255,255,0.25);
      padding: 8px 14px; border-radius: 12px; text-align: right;
    }
    .timer-lbl { font-size: 10.5px; text-transform: uppercase; opacity: 0.85; display: block; }
    .timer-val { font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: 0.04em; }

    .body-grid { display: grid; grid-template-columns: 320px 1fr; }
    @media (max-width: 760px) { .body-grid { grid-template-columns: 1fr; } }

    .left-pane { background: #f8fafc; padding: 26px; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column; justify-content: space-between; }
    .amount-lbl { font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; }
    .amount-val { font-size: 32px; font-weight: 800; color: var(--brand); margin: 4px 0 18px; }
    .info-row { padding: 10px 0; border-bottom: 1px dashed #cbd5e1; font-size: 13px; }
    .info-row:last-child { border-bottom: none; }
    .info-lbl { color: #64748b; display: block; font-size: 11.5px; margin-bottom: 3px; }
    .info-val { font-weight: 700; color: #0f172a; word-break: break-all; }
    .progress-wrap { margin-top: 20px; }
    .progress-bar { height: 6px; background: #e2e8f0; border-radius: 999px; overflow: hidden; margin-top: 6px; }
    .progress-fill { height: 100%; width: 100%; background: var(--brand); transition: width 1s linear; }
    .sec-badge { margin-top: 18px; font-size: 11.5px; color: #475569; background: #fff; border: 1px solid #e2e8f0; padding: 10px 12px; border-radius: 10px; line-height: 1.45; }

    .right-pane { padding: 26px 28px; }
    .qr-stage {
      text-align: center; padding: 18px; background: var(--brand-light);
      border: 1.5px dashed var(--brand); border-radius: 16px; margin-bottom: 18px;
    }
    .qr-frame {
      position: relative; display: inline-block; padding: 10px; background: #fff;
      border-radius: 14px; box-shadow: 0 8px 20px rgba(0,0,0,0.06); overflow: hidden;
    }
    .scan-line {
      position: absolute; left: 8px; right: 8px; height: 2px; background: var(--brand);
      box-shadow: 0 0 8px var(--brand); animation: scan 2.4s ease-in-out infinite;
    }
    @keyframes scan { 0%, 100% { top: 12px; } 50% { top: calc(100% - 14px); } }
    .qr-hint { margin: 10px 0 2px; font-size: 13px; font-weight: 700; color: #0f172a; }
    .qr-raw { font-size: 10.5px; color: #64748b; font-family: monospace; word-break: break-all; }

    .section-title { font-size: 11.5px; font-weight: 800; color: #475569; margin: 14px 0 8px; text-transform: uppercase; letter-spacing: 0.05em; }
    button {
      width: 100%; padding: 12px 16px; border: none; border-radius: 11px; font-size: 13.5px; font-weight: 700;
      cursor: pointer; transition: all 0.15s; display: flex; align-items: center; justify-content: space-between; text-align: left;
    }
    .btn-pay { background: linear-gradient(135deg, #10b981, #059669); color: #fff; box-shadow: 0 6px 16px rgba(16,185,129,0.25); }
    .btn-pay:hover { transform: translateY(-1px); }

    .chaos-box { background: #fff8f8; border: 1px solid #fecaca; border-radius: 14px; padding: 12px; margin-top: 8px; }
    .chaos-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    @media (max-width: 560px) { .chaos-grid { grid-template-columns: 1fr; } }
    .err-btn { background: #fff; border: 1px solid #fca5a5; color: #991b1b; font-size: 12px; padding: 9px 10px; border-radius: 9px; font-weight: 600; }
    .err-btn:hover { background: #fef2f2; border-color: #ef4444; }
    .err-btn.tamper { grid-column: 1 / -1; background: #fef2f2; border: 1.5px solid #dc2626; color: #7f1d1d; font-weight: 700; }
    .code { font-family: monospace; font-size: 10.5px; font-weight: 800; background: #fee2e2; padding: 2px 6px; border-radius: 5px; flex-shrink: 0; margin-left: 6px; }
  </style>
</head>
<body>
  <div class="shell">
    <div class="header">
      <div class="header-left">
        <span class="brand-chip">${isZalo ? 'ZaloPay' : 'MoMo'}</span>
        <div>
          <h2>Cổng Thanh Toán Ví Điện Tử</h2>
          <small>Hosted Payment Gateway • Server-to-Server IPN Simulator</small>
        </div>
      </div>
      <div class="timer-pill">
        <span class="timer-lbl">Đơn hết hạn sau</span>
        <span class="timer-val" id="countdown">15:00</span>
      </div>
    </div>

    <div class="body-grid">
      <div class="left-pane">
        <div>
          <div class="amount-lbl">Tổng số tiền thanh toán</div>
          <div class="amount-val">${tx.amount.toLocaleString('vi-VN')} đ</div>

          <div class="info-row">
            <span class="info-lbl">Nhà cung cấp (Merchant)</span>
            <span class="info-val">MERCHANT_DEMO_2026</span>
          </div>
          <div class="info-row">
            <span class="info-lbl">Mã đơn hàng (appTransId)</span>
            <span class="info-val" style="font-family:monospace; font-size:12px;">${tx.appTransId}</span>
          </div>
          <div class="info-row">
            <span class="info-lbl">Mã giao dịch ví (transId)</span>
            <span class="info-val" style="font-family:monospace; font-size:12px;">${tx.transId}</span>
          </div>
          <div class="info-row">
            <span class="info-lbl">Nội dung thanh toán</span>
            <span class="info-val">${tx.orderInfo}</span>
          </div>

          <div class="progress-wrap">
            <div style="display:flex; justify-content:space-between; font-size:11.5px; color:#64748b;">
              <span>Thời gian giữ tồn kho</span>
              <span id="pctText">100%</span>
            </div>
            <div class="progress-bar"><div class="progress-fill" id="progFill"></div></div>
          </div>
        </div>

        <div class="sec-badge">
          🛡️ <strong>Bảo mật 3 lớp:</strong> Giao dịch được bảo vệ bằng chữ ký số <code>HMAC-SHA256</code>, khóa chống trùng lặp <code>Idempotency</code> và đối soát số tiền tự động.
        </div>
      </div>

      <div class="right-pane">
        <div class="qr-stage">
          <div class="qr-frame">
            <div class="scan-line"></div>
            ${qrSvg}
          </div>
          <div class="qr-hint">📲 Mở ứng dụng ${isZalo ? 'ZaloPay' : 'MoMo'} để quét mã QR</div>
          <div class="qr-raw">${qrPayload}</div>
        </div>

        <form action="/v2/gateway/pay/confirm" method="POST">
          <input type="hidden" name="transId" value="${tx.transId}" />

          <div class="section-title">1. Giả lập Khách Quét QR Thành Công (Happy Case)</div>
          <button type="submit" name="action" value="SUCCESS" class="btn-pay">
            <span>✓ Xác nhận Thanh Toán Thành Công (Bắn IPN ngầm)</span>
            <span style="background:rgba(255,255,255,0.22); padding:2px 8px; border-radius:6px; font-size:11.5px;">Code 0</span>
          </button>

          <div class="section-title" style="margin-top:16px;">2. Phòng Thí Nghiệm Lỗi & Tấn Công Mạng (Edge / Security Cases)</div>
          <div class="chaos-box">
            <div class="chaos-grid">
              <button type="submit" name="action" value="USER_CANCELLED" class="err-btn">
                <span>✕ Khách hủy đơn</span><span class="code">4012</span>
              </button>
              <button type="submit" name="action" value="INSUFFICIENT_BALANCE" class="err-btn">
                <span>✕ Thiếu số dư ví</span><span class="code">4010</span>
              </button>
              <button type="submit" name="action" value="BANK_DECLINED" class="err-btn">
                <span>✕ Ngân hàng từ chối</span><span class="code">4018</span>
              </button>
              <button type="submit" name="action" value="TRANSACTION_EXPIRED" class="err-btn">
                <span>⏱ Hết hạn 15 phút</span><span class="code">4015</span>
              </button>
              <button type="submit" name="action" value="DAILY_LIMIT_EXCEEDED" class="err-btn" style="grid-column: 1 / -1;">
                <span>✕ Vượt hạn mức giao dịch trong ngày</span><span class="code">4020</span>
              </button>
              <button type="submit" name="action" value="TAMPERED_AMOUNT" class="err-btn tamper">
                <span>🚨 Giả lập Hacker sửa gói tin IPN thành 100đ (Amount Tampering)</span>
                <span class="code">ATTACK</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  </div>

  <script>
    let totalSec = 15 * 60;
    const maxSec = totalSec;
    const cdEl = document.getElementById('countdown');
    const fillEl = document.getElementById('progFill');
    const pctEl = document.getElementById('pctText');
    setInterval(() => {
      if (totalSec > 0) totalSec--;
      const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
      const s = String(totalSec % 60).padStart(2, '0');
      cdEl.textContent = m + ':' + s;
      const pct = Math.round((totalSec / maxSec) * 100);
      fillEl.style.width = pct + '%';
      pctEl.textContent = pct + '%';
    }, 1000);
  </script>
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
  server.listen(config.GATEWAY.PORT, '0.0.0.0', () => {
    console.log(`[GATEWAY] 🟢 Mock Payment Gateway Core listening on http://localhost:${config.GATEWAY.PORT}`);
  });
}

module.exports = { startGatewayServer, app };
