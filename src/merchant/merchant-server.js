/**
 * Merchant E-Commerce Store & Payment Backend Handler
 * Runs on Port 3000
 */
const http = require('http');
const MiniServer = require('../common/mini-server');
const CryptoUtils = require('../common/crypto');
const config = require('../common/config');
const db = require('../common/db');

const app = new MiniServer();

/**
 * 1. Storefront Home & Cart Page
 */
app.get('/', (req, res) => {
  const recentOrders = Array.from(db.orders.values()).slice(-6).reverse();
  const recentWebhooks = db.getWebhookLogs().slice(0, 8);

  const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Merchant Store - Demo Luồng Thanh Toán Ví Điện Tử</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, sans-serif; }
    body { background: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
    .container { max-width: 1100px; margin: 0 auto; }
    header { border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
    h1 { font-size: 22px; margin: 0; color: #0f172a; }
    .grid { display: grid; grid-template-columns: 380px 1fr; gap: 24px; align-items: start; }
    @media (max-width: 860px) { .grid { grid-template-columns: 1fr; } }
    .card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
    .product-img { width: 100%; height: 140px; background: #e0e7ff; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 44px; }
    .price { font-size: 22px; font-weight: bold; color: #2563eb; margin: 12px 0; }
    button.btn-primary { width: 100%; background: #2563eb; color: white; padding: 14px; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: 0.15s; }
    button.btn-primary:hover { background: #1d4ed8; }
    
    /* Responsive & Clean Log Viewer (Fix overflow issue) */
    .log-box { 
      background: #0f172a; 
      color: #38bdf8; 
      padding: 12px; 
      border-radius: 8px; 
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; 
      font-size: 11.5px; 
      line-height: 1.45;
      max-height: 320px; 
      overflow-y: auto; 
      overflow-x: auto; 
      word-break: break-all;
      white-space: pre-wrap;
    }
    .log-entry { margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #1e293b; }
    .log-entry:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
    .log-time { color: #94a3b8; font-weight: bold; }
    .log-tag-ok { color: #4ade80; font-weight: bold; }
    .log-tag-err { color: #f87171; font-weight: bold; }
    .log-tag-warn { color: #fbbf24; font-weight: bold; }

    .badge { padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
    .badge-PENDING { background: #fef3c7; color: #92400e; }
    .badge-SUCCESS { background: #dcfce7; color: #166534; }
    .badge-FAILED { background: #fee2e2; color: #991b1b; }
    
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #f1f5f9; }
    th { color: #64748b; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>🛒 Merchant E-Commerce Store</h1>
        <small style="color: #64748b;">Mô phỏng kiến trúc tích hợp Cổng thanh toán (MoMo & ZaloPay Pattern)</small>
      </div>
      <div style="font-size: 13px;">
        <span style="color:#16a34a; font-weight:bold;">● Merchant Active</span> (:3000) &nbsp;|&nbsp; 
        <span style="color:#2563eb; font-weight:bold;">● Gateway Active</span> (:4000)
      </div>
    </header>

    <div class="grid">
      <!-- Cột 1: Sản phẩm & Đặt hàng -->
      <div class="card">
        <h3 style="margin-top:0;">Giỏ hàng / Demo Checkout</h3>
        <div class="product-img">🎧</div>
        <h4 style="margin: 12px 0 4px;">Tai nghe không dây Premium Pro X</h4>
        <p style="color: #64748b; font-size: 13px; margin: 0;">Mã sản phẩm: SKU_AUDIO_99</p>
        <div class="price">150.000 đ</div>

        <form action="/api/payment/create" method="POST">
          <input type="hidden" name="amount" value="150000" />
          <input type="hidden" name="orderInfo" value="Thanh toan tai nghe Premium Pro X" />
          <label style="font-size: 13px; color: #475569; display: block; margin-bottom: 6px;">Chọn kênh ví thanh toán:</label>
          <select name="channel" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1; margin-bottom: 16px; font-size: 14px;">
            <option value="MOMO">Ví MoMo (Mã QR & Gateway App)</option>
            <option value="ZALOPAY">Ví ZaloPay (Mã QR & Gateway App)</option>
          </select>
          <button type="submit" class="btn-primary">⚡ Thanh toán ngay qua Ví</button>
        </form>

        <div style="margin-top: 18px; padding: 12px; background: #eff6ff; border-radius: 8px; font-size: 12px; color: #1e40af;">
          💡 <strong>Mẹo thử nghiệm:</strong> Sau khi bấm thanh toán, tại trang Cổng Ví bạn có thể chọn <em>Thành công</em> hoặc giả lập các ca lỗi như <em>Thiếu số dư</em>, <em>Hết hạn</em>, <em>Hacker sửa giá tiền</em> để xem phản ứng hệ thống.
        </div>
      </div>

      <!-- Cột 2: Audit Logs & Trạng thái Server -->
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0;">📊 Nhật ký Webhook / IPN Audit</h3>
          <span style="font-size:11px; background:#e2e8f0; padding:2px 8px; border-radius:4px; color:#475569;">Server-to-Server Monitor</span>
        </div>
        <p style="font-size: 12px; color: #64748b; margin: 6px 0 12px;">Lắng nghe sự kiện callback bảo mật, xác thực chữ ký HMAC-SHA256 & Idempotency:</p>
        
        <div class="log-box">
${recentWebhooks.length === 0 ? '// Chưa có sự kiện IPN nào. Hãy thực hiện 1 giao dịch.' : recentWebhooks.map(log => {
  const isOk = log.status === 'PROCESSED_OK' || log.httpStatus === 200;
  const isErr = log.status === 'SIGNATURE_INVALID' || log.status === 'AMOUNT_MISMATCH';
  const tagClass = isOk ? 'log-tag-ok' : (isErr ? 'log-tag-err' : 'log-tag-warn');
  const payloadStr = JSON.stringify(log.payload, null, 2);
  
  return `<div class="log-entry">
<span class="log-time">[${log.timestamp.slice(11, 19)}]</span> <span class="${tagClass}">${log.direction}</span> | Order: <strong>${log.payload?.appTransId || 'N/A'}</strong> | Result: <strong>${log.payload?.resultCode ?? 'N/A'}</strong>
Status: <span class="${tagClass}">${log.status || log.response || 'SENT'}</span>
<details style="margin-top:4px;"><summary style="cursor:pointer; color:#94a3b8;">Xem Raw JSON Payload</summary><span style="color:#e2e8f0;">${payloadStr}</span></details>
</div>`;
}).join('')}
        </div>

        <h4 style="margin: 20px 0 8px;">Đơn hàng gần đây trong Merchant DB</h4>
        <table>
          <thead>
            <tr>
              <th>Mã Đơn Hàng</th>
              <th>Số tiền</th>
              <th>Trạng thái</th>
              <th>Ghi chú / Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            ${recentOrders.length === 0 ? '<tr><td colspan="4" style="color: #94a3b8; text-align: center;">Chưa có đơn hàng</td></tr>' : recentOrders.map(o => `
              <tr>
                <td><strong>${o.orderId}</strong></td>
                <td>${Number(o.amount).toLocaleString('vi-VN')} đ</td>
                <td><span class="badge badge-${o.status}">${o.status}</span></td>
                <td style="font-size:12px; color:#64748b;">${o.paymentDetails?.message || (o.status === 'PENDING' ? 'Chờ thanh toán' : '')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</body>
</html>
  `;
  res.html(html);
});

/**
 * 2. Merchant Create Payment Order API
 */
app.post('/api/payment/create', async (req, res) => {
  const { amount, orderInfo, channel } = req.body;

  const timestamp = Date.now();
  const appTransId = `ORDER_${timestamp}_${Math.floor(Math.random() * 1000)}`;

  db.createOrder({
    orderId: appTransId,
    amount: Number(amount),
    orderInfo,
    channel,
    status: config.ORDER_STATUS.PENDING,
    paymentDetails: {},
  });

  console.log(`\n[MERCHANT] 📦 Initiating order creation: ${appTransId} (${amount} VND)`);

  const requestPayload = {
    appId: config.MERCHANT.APP_ID,
    appTransId,
    amount: Number(amount),
    orderInfo,
    returnUrl: config.MERCHANT.REDIRECT_ENDPOINT,
    ipnUrl: config.MERCHANT.IPN_ENDPOINT,
    extraData: JSON.stringify({ userId: 'CUST_888', channel }),
  };

  const canonicalString = CryptoUtils.buildCanonicalQuery(requestPayload, ['signature']);
  const signature = CryptoUtils.signHmacSha256(canonicalString, config.MERCHANT.SECRET_KEY);
  requestPayload.signature = signature;

  const gatewayUrl = new URL(config.GATEWAY.CREATE_PAYMENT_URL);
  const dataToSend = JSON.stringify(requestPayload);

  const postReq = http.request(
    {
      hostname: gatewayUrl.hostname,
      port: gatewayUrl.port,
      path: gatewayUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataToSend),
      },
    },
    (gatewayRes) => {
      let body = '';
      gatewayRes.on('data', chunk => body += chunk);
      gatewayRes.on('end', () => {
        try {
          const resp = JSON.parse(body);
          if (resp.returnCode === config.RESPONSE_CODES.SUCCESS) {
            console.log(`[MERCHANT] ➡️ Redirecting user to Gateway Hosted Page: ${resp.orderUrl}`);
            res.redirect(resp.orderUrl);
          } else {
            res.html(`<h3>Lỗi tạo đơn thanh toán từ Gateway</h3><pre>${JSON.stringify(resp, null, 2)}</pre>`);
          }
        } catch (e) {
          res.html(`<h3>Lỗi kết nối Cổng thanh toán</h3><p>${body}</p>`);
        }
      });
    }
  );

  postReq.on('error', (err) => {
    console.error('[MERCHANT] ❌ Gateway request failed:', err.message);
    res.html(`<h3>Không thể kết nối đến Mock Gateway</h3><p>${err.message}</p>`);
  });

  postReq.write(dataToSend);
  postReq.end();
});

/**
 * 3. IPN / Webhook Callback Listener (Server-to-Server)
 */
app.post('/api/payment/callback', async (req, res) => {
  const data = req.body;
  console.log('\n[MERCHANT] 🔔 Webhook/IPN received from Gateway:', data);

  const { appId, appTransId, transId, amount, resultCode, message, extraData, signature } = data;

  // Bước 1: Kiểm tra chữ ký số từ Gateway
  const verifyPayload = {
    appId,
    appTransId,
    transId,
    amount,
    resultCode,
    message,
    extraData: extraData || '',
    responseTime: data.responseTime,
  };

  const canonicalString = CryptoUtils.buildCanonicalQuery(verifyPayload, ['signature']);
  const isValid = CryptoUtils.verifySignature(canonicalString, config.MERCHANT.SECRET_KEY, signature);

  if (!isValid) {
    console.error(`[MERCHANT] ❌ IPN Signature verification FAILED!`);
    db.logWebhook({
      direction: 'MERCHANT_INBOUND',
      status: 'SIGNATURE_INVALID',
      payload: data,
    });
    return res.json({ returnCode: config.RESPONSE_CODES.INVALID_SIGNATURE, returnMessage: 'Invalid signature' }, 400);
  }

  // Bước 2: Kiểm tra tính Idempotent (Chống double callback / replay attack)
  const idempotencyKey = `ipn_${transId}_${resultCode}`;
  if (db.hasProcessedIdempotencyKey(idempotencyKey)) {
    console.log(`[MERCHANT] ⚠️ Idempotency Key hit: IPN ${idempotencyKey} already processed. Returning OK.`);
    return res.json({ returnCode: config.RESPONSE_CODES.SUCCESS, returnMessage: 'Already processed' });
  }

  // Bước 3: Tìm đơn hàng trong Database
  const order = db.getOrder(appTransId);
  if (!order) {
    console.error(`[MERCHANT] ❌ Order not found: ${appTransId}`);
    return res.json({ returnCode: config.RESPONSE_CODES.ORDER_NOT_FOUND, returnMessage: 'Order does not exist' }, 404);
  }

  // Bước 4: Kiểm tra số tiền khớp với đơn hàng gốc (Chống Hacker Tampering)
  if (Number(order.amount) !== Number(amount)) {
    console.error(`[MERCHANT] 🚨 SECURITY ALERT: Amount mismatch! Expected ${order.amount}, received ${amount}`);
    db.updateOrderStatus(appTransId, config.ORDER_STATUS.FAILED, {
      gatewayTransId: transId,
      resultCode: config.RESPONSE_CODES.AMOUNT_MISMATCH,
      message: `Phát hiện gian lận: Số tiền gốc ${order.amount}đ khác số tiền callback ${amount}đ`,
      paidAt: new Date().toISOString(),
    });
    db.logWebhook({
      direction: 'MERCHANT_INBOUND',
      status: 'AMOUNT_MISMATCH',
      payload: data,
    });
    return res.json({ returnCode: config.RESPONSE_CODES.AMOUNT_MISMATCH, returnMessage: 'Amount mismatch detected' }, 400);
  }

  // Bước 5: Cập nhật trạng thái đơn hàng & ghi log
  const isSuccess = resultCode === config.RESPONSE_CODES.SUCCESS;
  const newStatus = isSuccess ? config.ORDER_STATUS.SUCCESS : config.ORDER_STATUS.FAILED;

  db.updateOrderStatus(appTransId, newStatus, {
    gatewayTransId: transId,
    resultCode,
    message,
    paidAt: new Date().toISOString(),
  });

  db.markIdempotencyKey(idempotencyKey);
  db.logWebhook({
    direction: 'MERCHANT_INBOUND',
    status: 'PROCESSED_OK',
    payload: data,
  });

  console.log(`[MERCHANT] ✅ Order ${appTransId} updated to status: ${newStatus}`);

  // Bước 6: Phản hồi chuẩn cho Gateway xác nhận đã nhận IPN thành công
  res.json({
    returnCode: config.RESPONSE_CODES.SUCCESS,
    returnMessage: 'IPN processed successfully',
  });
});

/**
 * 4. Customer Redirect Return URL Handler (/order-result)
 */
app.get('/order-result', (req, res) => {
  const { appTransId, transId, amount, resultCode, message, signature } = req.query;

  // Xác thực chữ ký trên thanh URL (Return URL)
  const verifyData = { amount, appTransId, message, resultCode, transId };
  const canonicalString = CryptoUtils.buildCanonicalQuery(verifyData);
  const isValid = CryptoUtils.verifySignature(canonicalString, config.MERCHANT.SECRET_KEY, signature);

  const order = db.getOrder(appTransId);
  const isSuccess = Number(resultCode) === config.RESPONSE_CODES.SUCCESS && order?.status === config.ORDER_STATUS.SUCCESS;

  const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Kết Quả Thanh Toán - Merchant Store</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, sans-serif; }
    body { background: #f8fafc; padding: 40px 20px; display: flex; justify-content: center; }
    .card { background: white; border-radius: 14px; max-width: 520px; width: 100%; padding: 32px; box-shadow: 0 4px 16px rgba(0,0,0,0.06); text-align: center; }
    .icon { width: 64px; height: 64px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 32px; margin-bottom: 16px; }
    .icon.success { background: #dcfce7; color: #16a34a; }
    .icon.failed { background: #fee2e2; color: #dc2626; }
    .title { font-size: 20px; font-weight: 700; margin: 0 0 8px; }
    .details { background: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: left; font-size: 13px; border: 1px solid #e2e8f0; }
    .row { display: flex; justify-content: space-between; padding: 6px 0; }
    .btn { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 10px; }
    .security-note { font-size: 11.5px; color: #64748b; margin-top: 20px; text-align: left; background: #eff6ff; padding: 10px; border-radius: 6px; line-height: 1.5; }
    .err-badge { background: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 4px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon ${isSuccess ? 'success' : 'failed'}">
      ${isSuccess ? '✓' : '✕'}
    </div>
    <div class="title" style="color: ${isSuccess ? '#16a34a' : '#dc2626'}">
      ${isSuccess ? 'Thanh toán thành công!' : 'Thanh toán không thành công'}
    </div>
    <p style="color: #64748b; margin: 0 0 16px; font-size: 14px;">
      ${message || ''} ${!isSuccess ? `<br/><span class="err-badge">Mã lỗi: ${resultCode}</span>` : ''}
    </p>

    <div class="details">
      <div class="row"><strong>Mã đơn hàng:</strong> <span>${appTransId}</span></div>
      <div class="row"><strong>Mã giao dịch ví:</strong> <span>${transId}</span></div>
      <div class="row"><strong>Số tiền giao dịch:</strong> <span>${Number(amount).toLocaleString('vi-VN')} đ</span></div>
      <div class="row"><strong>Trạng thái Merchant DB:</strong> <span style="font-weight: 700; color: ${isSuccess ? '#16a34a' : '#dc2626'};">${order?.status || 'N/A'}</span></div>
      <div class="row"><strong>Chữ ký URL hợp lệ:</strong> <span style="color: ${isValid ? '#16a34a' : '#dc2626'}">${isValid ? '✓ Đã xác thực (Valid)' : '✕ Không hợp lệ'}</span></div>
    </div>

    <div class="security-note">
      🔒 <strong>Ghi chú kiến trúc Fintech:</strong><br/>
      ${isSuccess ? 
        'Trạng thái đơn hàng đã được chốt an toàn qua kênh Server-to-Server Webhook/IPN. Bạn có thể tiến hành giao hàng hoặc kích hoạt dịch vụ cho khách.' : 
        'Đơn hàng được ghi nhận thất bại. Tiền không bị trừ hoặc được cổng thanh toán hoàn lại tự động nếu lỗi từ phía ngân hàng.'}
    </div>

    <a href="/" class="btn">Quay lại cửa hàng</a>
  </div>
</body>
</html>
  `;
  res.html(html);
});

const server = http.createServer((req, res) => app.handle(req, res));

function startMerchantServer() {
  server.listen(config.MERCHANT.PORT, '0.0.0.0', () => {
    console.log(`[MERCHANT] 🟢 Merchant Web Store listening on http://localhost:${config.MERCHANT.PORT}`);
  });
}

module.exports = { startMerchantServer, app };
