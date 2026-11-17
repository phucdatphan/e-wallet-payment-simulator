/**
 * Merchant E-Commerce Store & Payment Backend Handler
 * Runs on Port 3000 — Upgraded Fintech Design System v2.0
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
  const allOrders = Array.from(db.orders.values());
  const recentOrders = allOrders.slice(-6).reverse();
  const recentWebhooks = db.getWebhookLogs().slice(0, 8);

  const paidCount = allOrders.filter(o => o.status === 'SUCCESS').length;
  const pendingCount = allOrders.filter(o => o.status === 'PENDING').length;
  const failedCount = allOrders.filter(o => o.status === 'FAILED').length;

  const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Merchant Store — Cổng Thanh Toán Ví Điện Tử (Design v2.0)</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root {
      --bg: #f1f5f9;
      --surface: #ffffff;
      --text: #0f172a;
      --muted: #64748b;
      --border: #e2e8f0;
      --primary: #4f46e5;
      --primary-hover: #4338ca;
      --momo: #a50064;
      --zalopay: #0068ff;
    }
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif; }
    body { background: radial-gradient(circle at top left, #eef2ff 0%, #f8fafc 45%, #f1f5f9 100%); color: var(--text); margin: 0; padding: 0 16px 48px; min-height: 100vh; }
    .topbar {
      max-width: 1180px; margin: 16px auto 24px; background: rgba(255,255,255,0.9); backdrop-filter: blur(10px);
      border: 1px solid var(--border); border-radius: 16px; padding: 16px 24px;
      display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;
      box-shadow: 0 4px 20px rgba(15, 23, 42, 0.04);
    }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-icon {
      width: 42px; height: 42px; border-radius: 12px;
      background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #fff;
      display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 800;
      box-shadow: 0 6px 14px rgba(79, 70, 229, 0.25);
    }
    .brand h1 { font-size: 19px; margin: 0; font-weight: 800; letter-spacing: -0.02em; }
    .brand p { font-size: 12.5px; color: var(--muted); margin: 2px 0 0; }
    .status-pills { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .pill {
      display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600;
      padding: 6px 12px; border-radius: 999px; border: 1px solid var(--border); background: #fff;
    }
    .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    .dot-green { background: #10b981; box-shadow: 0 0 0 3px rgba(16,185,129,0.2); }
    .dot-blue { background: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.2); }

    .container { max-width: 1180px; margin: 0 auto; }
    .stepper {
      display: flex; align-items: center; justify-content: center; gap: 12px;
      margin-bottom: 24px; font-size: 13px; font-weight: 600; color: var(--muted);
    }
    .step { display: flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 999px; background: #fff; border: 1px solid var(--border); }
    .step.active { background: #eef2ff; border-color: #c7d2fe; color: var(--primary); }
    .step-num { width: 20px; height: 20px; border-radius: 50%; background: #e2e8f0; color: #475569; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; }
    .step.active .step-num { background: var(--primary); color: #fff; }
    .step-line { width: 28px; height: 2px; background: #cbd5e1; }

    .grid { display: grid; grid-template-columns: 420px 1fr; gap: 24px; align-items: start; }
    @media (max-width: 920px) { .grid { grid-template-columns: 1fr; } .stepper { display: none; } }

    .card {
      background: var(--surface); border-radius: 18px; padding: 24px;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.04); border: 1px solid var(--border);
    }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .card-title { font-size: 16px; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 8px; }
    .hold-badge { font-size: 11px; font-weight: 700; color: #b45309; background: #fef3c7; padding: 4px 10px; border-radius: 999px; }

    .product-hero {
      position: relative; width: 100%; height: 150px; border-radius: 14px;
      background: linear-gradient(135deg, #312e81 0%, #4f46e5 55%, #0ea5e9 100%);
      display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; color: #fff;
      margin-bottom: 16px; overflow: hidden;
    }
    .product-hero-info h4 { margin: 0 0 4px; font-size: 17px; font-weight: 800; }
    .product-hero-info p { margin: 0; font-size: 12px; opacity: 0.85; }
    .product-emoji { font-size: 52px; filter: drop-shadow(0 8px 16px rgba(0,0,0,0.25)); }

    .summary-box { background: #f8fafc; border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; margin-bottom: 18px; font-size: 13px; }
    .sum-row { display: flex; justify-content: space-between; padding: 4px 0; color: #475569; }
    .sum-row.total { border-top: 1px dashed #cbd5e1; margin-top: 6px; padding-top: 8px; font-size: 16px; font-weight: 800; color: var(--text); }
    .sum-row.total span:last-child { color: var(--primary); font-size: 19px; }

    .wallet-label { font-size: 12.5px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 10px; display: block; }
    .wallet-options { display: grid; gap: 10px; margin-bottom: 18px; }
    .wallet-card {
      display: flex; align-items: center; justify-content: space-between;
      border: 2px solid var(--border); border-radius: 12px; padding: 12px 14px; cursor: pointer; transition: all 0.16s ease;
    }
    .wallet-card:hover { border-color: #94a3b8; background: #f8fafc; }
    .wallet-card input { display: none; }
    .wallet-card.selected-momo { border-color: var(--momo); background: #fdf2f8; }
    .wallet-card.selected-zalopay { border-color: var(--zalopay); background: #eff6ff; }
    .wallet-left { display: flex; align-items: center; gap: 12px; }
    .wallet-logo {
      width: 38px; height: 38px; border-radius: 10px; color: #fff; font-weight: 800; font-size: 12px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .logo-momo { background: linear-gradient(135deg, #a50064, #d82d8b); }
    .logo-zalo { background: linear-gradient(135deg, #0068ff, #00a2ff); }
    .wallet-name { font-size: 14px; font-weight: 700; color: var(--text); }
    .wallet-desc { font-size: 11.5px; color: var(--muted); margin-top: 2px; }
    .radio-dot { width: 18px; height: 18px; border-radius: 50%; border: 2px solid #cbd5e1; display: flex; align-items: center; justify-content: center; }
    .radio-dot::after { content: ''; width: 8px; height: 8px; border-radius: 50%; background: transparent; }
    .selected-momo .radio-dot { border-color: var(--momo); }
    .selected-momo .radio-dot::after { background: var(--momo); }
    .selected-zalopay .radio-dot { border-color: var(--zalopay); }
    .selected-zalopay .radio-dot::after { background: var(--zalopay); }

    button.btn-primary {
      width: 100%; background: linear-gradient(135deg, #4f46e5, #4338ca); color: white; padding: 14px;
      border: none; border-radius: 12px; font-size: 15px; font-weight: 700; cursor: pointer;
      box-shadow: 0 8px 18px rgba(79, 70, 229, 0.25); transition: transform 0.12s ease, opacity 0.15s;
    }
    button.btn-primary:hover { transform: translateY(-1px); }
    button.btn-primary:disabled { opacity: 0.65; cursor: not-allowed; transform: none; }

    .tip-box { margin-top: 16px; padding: 12px 14px; background: #f8fafc; border-left: 3px solid var(--primary); border-radius: 8px; font-size: 12px; color: #475569; line-height: 1.5; }

    .kpi-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 18px; }
    @media (max-width: 600px) { .kpi-strip { grid-template-columns: repeat(2, 1fr); } }
    .kpi-mini { background: #f8fafc; border: 1px solid var(--border); border-radius: 12px; padding: 12px; }
    .kpi-mini-lbl { font-size: 11px; color: var(--muted); font-weight: 600; text-transform: uppercase; }
    .kpi-mini-val { font-size: 20px; font-weight: 800; margin-top: 4px; }

    .log-box {
      background: #0b1120; color: #38bdf8; padding: 14px; border-radius: 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11.5px; line-height: 1.5; max-height: 280px; overflow-y: auto; border: 1px solid #1e293b;
    }
    .log-entry { margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #1e293b; }
    .log-entry:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
    .log-time { color: #94a3b8; font-weight: bold; }
    .log-tag-ok { color: #4ade80; font-weight: bold; }
    .log-tag-err { color: #f87171; font-weight: bold; }
    .log-tag-warn { color: #fbbf24; font-weight: bold; }

    .badge { padding: 4px 9px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; display: inline-block; }
    .badge-PENDING { background: #fef3c7; color: #92400e; }
    .badge-SUCCESS { background: #dcfce7; color: #166534; }
    .badge-FAILED { background: #fee2e2; color: #991b1b; }
    .chan-badge { font-size: 10.5px; font-weight: 700; padding: 2px 7px; border-radius: 6px; }
    .chan-MOMO { background: #fce7f3; color: #9d174d; }
    .chan-ZALOPAY { background: #dbeafe; color: #1e40af; }

    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
    th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #f1f5f9; }
    th { color: #64748b; font-weight: 700; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.03em; }
    .refresh-link { font-size: 12px; color: var(--primary); text-decoration: none; font-weight: 600; }
    .refresh-link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="topbar">
    <div class="brand">
      <div class="brand-icon">⚡</div>
      <div>
        <h1>Merchant E-Commerce Store</h1>
        <p>Stage 1 Core Simulator • Chuẩn bảo mật HMAC-SHA256, IPN Webhook & Idempotency</p>
      </div>
    </div>
    <div class="status-pills">
      <span class="pill"><span class="dot dot-green"></span> Merchant :3000</span>
      <span class="pill"><span class="dot dot-blue"></span> Gateway :4000</span>
      <a href="/" class="pill" style="text-decoration:none; color:#4f46e5;">↻ Làm mới Log</a>
    </div>
  </div>

  <div class="container">
    <div class="stepper">
      <div class="step active"><span class="step-num">1</span> Chọn Ví & Giữ kho</div>
      <div class="step-line"></div>
      <div class="step"><span class="step-num">2</span> Quét Mã QR (15:00)</div>
      <div class="step-line"></div>
      <div class="step"><span class="step-num">3</span> Xác thực IPN & Hoàn tất</div>
    </div>

    <div class="grid">
      <!-- Cột 1: Checkout Card -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">🛍️ Thanh toán đơn hàng</h3>
          <span class="hold-badge">⏱ Giữ kho 15 phút</span>
        </div>

        <div class="product-hero">
          <div class="product-hero-info">
            <span style="font-size:10.5px; background:rgba(255,255,255,0.2); padding:3px 8px; border-radius:99px; font-weight:700;">SKU_AUDIO_99</span>
            <h4 style="margin-top:8px;">Tai nghe không dây Pro X</h4>
            <p>Chống ồn chủ động ANC • Bảo hành 12 tháng</p>
          </div>
          <div class="product-emoji">🎧</div>
        </div>

        <div class="summary-box">
          <div class="sum-row"><span>Tạm tính (1 sản phẩm)</span><span>150.000 đ</span></div>
          <div class="sum-row"><span>Phí cổng thanh toán (User)</span><span style="color:#16a34a; font-weight:600;">Miễn phí</span></div>
          <div class="sum-row total"><span>Tổng thanh toán</span><span>150.000 đ</span></div>
        </div>

        <form id="checkoutForm" action="/api/payment/create" method="POST">
          <input type="hidden" name="amount" value="150000" />
          <input type="hidden" name="orderInfo" value="Thanh toan tai nghe Premium Pro X" />

          <span class="wallet-label">Chọn phương thức Ví điện tử:</span>
          <div class="wallet-options">
            <label class="wallet-card selected-momo" id="card-momo" onclick="selectWallet('MOMO')">
              <input type="radio" name="channel" value="MOMO" checked />
              <div class="wallet-left">
                <div class="wallet-logo logo-momo">MoMo</div>
                <div>
                  <div class="wallet-name">Ví Điện Tử MoMo</div>
                  <div class="wallet-desc">Quét mã QR Vector SVG • Phổ biến nhất</div>
                </div>
              </div>
              <div class="radio-dot"></div>
            </label>

            <label class="wallet-card" id="card-zalopay" onclick="selectWallet('ZALOPAY')">
              <input type="radio" name="channel" value="ZALOPAY" />
              <div class="wallet-left">
                <div class="wallet-logo logo-zalo">Zalo</div>
                <div>
                  <div class="wallet-name">Ví Điện Tử ZaloPay</div>
                  <div class="wallet-desc">Mở nhanh App / QR • Xác nhận tức thì</div>
                </div>
              </div>
              <div class="radio-dot"></div>
            </label>
          </div>

          <button type="submit" id="submitBtn" class="btn-primary">🔐 Thanh toán an toàn 150.000 đ</button>
        </form>

        <div class="tip-box">
          <strong>Hướng dẫn kiểm thử BA/QA:</strong> Ở màn hình tiếp theo, bạn có thể bấm <em>Thanh toán thành công</em> hoặc thử nghiệm <strong>6 kịch bản lỗi & tấn công bảo mật</strong> (thiếu tiền, hết hạn QR, sửa giá tiền 100đ) để quan sát phản ứng ở bảng Audit bên phải.
        </div>
      </div>

      <!-- Cột 2: Telemetry & Audit Console -->
      <div class="card">
        <div class="kpi-strip">
          <div class="kpi-mini">
            <div class="kpi-mini-lbl">Tổng đơn tạo</div>
            <div class="kpi-mini-val">${allOrders.length}</div>
          </div>
          <div class="kpi-mini">
            <div class="kpi-mini-lbl">Thành công</div>
            <div class="kpi-mini-val" style="color:#16a34a;">${paidCount}</div>
          </div>
          <div class="kpi-mini">
            <div class="kpi-mini-lbl">Đang chờ</div>
            <div class="kpi-mini-val" style="color:#d97706;">${pendingCount}</div>
          </div>
          <div class="kpi-mini">
            <div class="kpi-mini-lbl">Thất bại / Chặn</div>
            <div class="kpi-mini-val" style="color:#dc2626;">${failedCount}</div>
          </div>
        </div>

        <div class="card-header" style="margin-bottom:8px;">
          <h3 class="card-title">🛡️ Nhật ký Webhook / IPN Bảo mật</h3>
          <span style="font-size:11px; background:#0f172a; color:#38bdf8; padding:4px 10px; border-radius:999px; font-weight:700;">HMAC-SHA256 Live Monitor</span>
        </div>
        <p style="font-size: 12.5px; color: var(--muted); margin: 0 0 12px;">Theo dõi luồng callback ngầm Server-to-Server, kiểm tra chữ ký số, Idempotency Key và đối soát số tiền:</p>

        <div class="log-box">
${recentWebhooks.length === 0 ? '// Chưa có sự kiện IPN nào. Hãy bấm "Thanh toán an toàn" ở cột trái để tạo giao dịch đầu tiên.' : recentWebhooks.map(log => {
  const isOk = log.status === 'PROCESSED_OK' || log.httpStatus === 200;
  const isErr = log.status === 'SIGNATURE_INVALID' || log.status === 'AMOUNT_MISMATCH';
  const tagClass = isOk ? 'log-tag-ok' : (isErr ? 'log-tag-err' : 'log-tag-warn');
  const payloadStr = JSON.stringify(log.payload, null, 2);

  return `<div class="log-entry">
<span class="log-time">[${log.timestamp.slice(11, 19)}]</span> <span class="${tagClass}">${log.direction}</span> | Đơn: <strong>${log.payload?.appTransId || 'N/A'}</strong> | Code: <strong>${log.payload?.resultCode ?? 'N/A'}</strong>
Trạng thái: <span class="${tagClass}">${log.status || log.response || 'SENT'}</span>
<details style="margin-top:4px;"><summary style="cursor:pointer; color:#94a3b8;">Xem gói tin JSON gốc</summary><span style="color:#e2e8f0;">${payloadStr}</span></details>
</div>`;
}).join('')}
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin: 22px 0 6px;">
          <h4 style="margin:0; font-size:15px;">📦 Đơn hàng gần đây trong Merchant DB</h4>
          <a href="/" class="refresh-link">Cập nhật trạng thái</a>
        </div>
        <table>
          <thead>
            <tr>
              <th>Mã Đơn Hàng</th>
              <th>Kênh Ví</th>
              <th>Số tiền</th>
              <th>Trạng thái</th>
              <th>Chi tiết xử lý</th>
            </tr>
          </thead>
          <tbody>
            ${recentOrders.length === 0 ? '<tr><td colspan="5" style="color: #94a3b8; text-align: center; padding: 20px;">Chưa có đơn hàng nào được khởi tạo</td></tr>' : recentOrders.map(o => `
              <tr>
                <td style="font-family:monospace; font-size:12px;"><strong>${o.orderId}</strong></td>
                <td><span class="chan-badge chan-${o.channel || 'MOMO'}">${o.channel || 'MOMO'}</span></td>
                <td><strong>${Number(o.amount).toLocaleString('vi-VN')} đ</strong></td>
                <td><span class="badge badge-${o.status}">${o.status}</span></td>
                <td style="font-size:12px; color:#64748b;">${o.paymentDetails?.message || (o.status === 'PENDING' ? 'Đang khóa kho chờ IPN' : '')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <script>
    function selectWallet(chan) {
      const momo = document.getElementById('card-momo');
      const zalo = document.getElementById('card-zalopay');
      momo.classList.toggle('selected-momo', chan === 'MOMO');
      zalo.classList.toggle('selected-zalopay', chan === 'ZALOPAY');
      momo.querySelector('input').checked = (chan === 'MOMO');
      zalo.querySelector('input').checked = (chan === 'ZALOPAY');
    }
    document.getElementById('checkoutForm').addEventListener('submit', function() {
      const btn = document.getElementById('submitBtn');
      btn.disabled = true;
      btn.textContent = '⏳ Đang ký HMAC-SHA256 & tạo phiên QR...';
    });
  </script>
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
  const selectedChannel = channel || 'MOMO';

  const timestamp = Date.now();
  const appTransId = `ORDER_${timestamp}_${Math.floor(Math.random() * 1000)}`;

  db.createOrder({
    orderId: appTransId,
    amount: Number(amount),
    orderInfo,
    channel: selectedChannel,
    status: config.ORDER_STATUS.PENDING,
    paymentDetails: {},
  });

  console.log(`\n[MERCHANT] 📦 Initiating order creation: ${appTransId} (${amount} VND | ${selectedChannel})`);

  const requestPayload = {
    appId: config.MERCHANT.APP_ID,
    appTransId,
    amount: Number(amount),
    orderInfo,
    returnUrl: config.MERCHANT.REDIRECT_ENDPOINT,
    ipnUrl: config.MERCHANT.IPN_ENDPOINT,
    extraData: JSON.stringify({ userId: 'CUST_888', channel: selectedChannel }),
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
  <title>Biên Lai Giao Dịch — Merchant Store</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif; }
    body { background: radial-gradient(circle at top, #eef2ff 0%, #f1f5f9 100%); padding: 40px 16px; display: flex; justify-content: center; margin: 0; min-height: 100vh; align-items: center; }
    .receipt {
      background: white; border-radius: 22px; max-width: 540px; width: 100%; padding: 34px 30px;
      box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08); text-align: center; border: 1px solid #e2e8f0;
      position: relative; overflow: hidden;
    }
    .top-bar { position: absolute; top: 0; left: 0; right: 0; height: 6px; background: ${isSuccess ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #ef4444, #dc2626)'}; }
    .icon {
      width: 72px; height: 72px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
      font-size: 34px; margin-bottom: 16px; font-weight: 800;
    }
    .icon.success { background: #dcfce7; color: #16a34a; box-shadow: 0 0 0 8px #f0fdf4; }
    .icon.failed { background: #fee2e2; color: #dc2626; box-shadow: 0 0 0 8px #fef2f2; }
    .title { font-size: 22px; font-weight: 800; margin: 0 0 6px; color: #0f172a; }
    .amount-hero { font-size: 30px; font-weight: 800; color: ${isSuccess ? '#059669' : '#dc2626'}; margin: 12px 0; }
    .err-badge { display: inline-block; background: #fee2e2; color: #991b1b; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; margin-top: 6px; }
    .details {
      background: #f8fafc; border-radius: 14px; padding: 16px 18px; margin: 20px 0;
      text-align: left; font-size: 13px; border: 1px dashed #cbd5e1;
    }
    .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; gap: 12px; }
    .row:last-child { border-bottom: none; }
    .row span:first-child { color: #64748b; }
    .row span:last-child { font-weight: 700; color: #0f172a; text-align: right; word-break: break-all; }
    .guard-pills { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; margin-bottom: 18px; }
    .g-pill { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 999px; background: #f1f5f9; color: #334155; }
    .security-note {
      font-size: 12px; color: #334155; margin-top: 16px; text-align: left;
      background: #eef2ff; border-left: 3px solid #4f46e5; padding: 12px 14px; border-radius: 8px; line-height: 1.55;
    }
    .btn {
      display: inline-block; width: 100%; background: linear-gradient(135deg, #4f46e5, #4338ca);
      color: white; padding: 14px 24px; border-radius: 12px; text-decoration: none; font-weight: 700;
      margin-top: 18px; box-shadow: 0 8px 18px rgba(79,70,229,0.22);
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="top-bar"></div>
    <div class="icon ${isSuccess ? 'success' : 'failed'}">${isSuccess ? '✓' : '✕'}</div>
    <div class="title">${isSuccess ? 'Thanh toán thành công!' : 'Giao dịch không thành công'}</div>
    <div style="color: #64748b; font-size: 13.5px;">
      ${message || ''}
      ${!isSuccess ? `<div><span class="err-badge">Mã phản hồi: ${resultCode}</span></div>` : ''}
    </div>

    <div class="amount-hero">${Number(amount).toLocaleString('vi-VN')} đ</div>

    <div class="guard-pills">
      <span class="g-pill">${isValid ? '✓ Chữ ký URL hợp lệ' : '✕ Chữ ký URL lỗi'}</span>
      <span class="g-pill">✓ Đối soát IPN ngầm</span>
      <span class="g-pill">✓ Chống Double-Charge</span>
    </div>

    <div class="details">
      <div class="row"><span>Mã đơn hàng (Merchant)</span><span style="font-family:monospace;">${appTransId}</span></div>
      <div class="row"><span>Mã giao dịch ví (Gateway)</span><span style="font-family:monospace;">${transId}</span></div>
      <div class="row"><span>Trạng thái trong DB</span><span style="color: ${isSuccess ? '#16a34a' : '#dc2626'};">${order?.status || 'N/A'}</span></div>
      <div class="row"><span>Xác thực HMAC-SHA256</span><span style="color: ${isValid ? '#16a34a' : '#dc2626'};">${isValid ? 'VALID' : 'INVALID'}</span></div>
    </div>

    <div class="security-note">
      🔒 <strong>Giải thích kiến trúc BA/Fintech:</strong><br/>
      ${isSuccess
        ? 'Đơn hàng KHÔNG chốt dựa trên thanh địa chỉ trình duyệt này mà đã được xác thực ngầm qua Server-to-Server IPN Webhook. Tồn kho đã được trừ chính thức.'
        : 'Đơn hàng đã chuyển sang trạng thái FAILED, tồn kho tạm giữ đã được giải phóng (Release Stock) để khách hàng khác có thể mua.'}
    </div>

    <a href="/" class="btn">← Quay về Cửa hàng & Xem Nhật ký IPN</a>
  </div>
</body>
</html>
  `;
  res.html(html);
});

const server = http.createServer((req, res) => app.handle(req, res));

function startMerchantServer() {
  server.listen(config.MERCHANT.PORT, '0.0.0.0', () => {
    console.log(`[MERCHANT] 🛍️  Merchant E-Commerce Server listening on http://localhost:${config.MERCHANT.PORT}`);
  });
}

module.exports = { startMerchantServer, app };
