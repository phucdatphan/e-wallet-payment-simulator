/**
 * Global Constants & Configurations for the Simulation
 */
module.exports = {
  MERCHANT: {
    PORT: 3000,
    APP_ID: 'MERCHANT_DEMO_2026',
    SECRET_KEY: 'secret_merchant_momo_zalopay_2026_demo_key',
    BASE_URL: 'http://localhost:3000',
    IPN_ENDPOINT: 'http://localhost:3000/api/payment/callback',
    REDIRECT_ENDPOINT: 'http://localhost:3000/order-result',
  },
  GATEWAY: {
    PORT: 4000,
    GATEWAY_ID: 'VN_EWALLET_CORE_ENGINE',
    SECRET_KEY: 'secret_merchant_momo_zalopay_2026_demo_key', // Pre-shared symmetric key
    BASE_URL: 'http://localhost:4000',
    CREATE_PAYMENT_URL: 'http://localhost:4000/v2/gateway/pay/create',
  },
  ORDER_STATUS: {
    PENDING: 'PENDING',
    PROCESSING: 'PROCESSING',
    SUCCESS: 'SUCCESS',
    FAILED: 'FAILED',
    EXPIRED: 'EXPIRED',
  },
  RESPONSE_CODES: {
    SUCCESS: 0,
    INVALID_SIGNATURE: 4001,
    AMOUNT_MISMATCH: 4002,
    ORDER_NOT_FOUND: 4004,
    DUPLICATE_TRANSACTION: 4009,
    INSUFFICIENT_BALANCE: 4010,
    USER_CANCELLED: 4012,
    TRANSACTION_EXPIRED: 4015,
    BANK_DECLINED: 4018,
    DAILY_LIMIT_EXCEEDED: 4020,
  },
  ERROR_DETAILS: {
    SUCCESS: { code: 0, title: 'Giao dịch thành công', desc: 'Thanh toán hoàn tất, tiền đã trừ khỏi tài khoản ví.' },
    USER_CANCELLED: { code: 4012, title: 'Người dùng hủy giao dịch', desc: 'Khách hàng bấm hủy trên màn hình xác nhận thanh toán.' },
    INSUFFICIENT_BALANCE: { code: 4010, title: 'Số dư ví không đủ', desc: 'Số dư ví hoặc tài khoản ngân hàng liên kết không đủ để trừ tiền.' },
    TRANSACTION_EXPIRED: { code: 4015, title: 'Giao dịch hết hạn (Timeout)', desc: 'Phiên thanh toán / mã QR đã quá thời hạn (quá 15 phút).' },
    BANK_DECLINED: { code: 4018, title: 'Ngân hàng từ chối trừ tiền', desc: 'Ngân hàng phát hành thẻ từ chối hoặc hệ thống NAPAS bảo trì.' },
    DAILY_LIMIT_EXCEEDED: { code: 4020, title: 'Vượt hạn mức trong ngày', desc: 'Tài khoản ví của khách hàng đã vượt hạn mức giao dịch tối đa trong ngày.' },
    TAMPERED_AMOUNT: { code: 4002, title: 'Sai lệch số tiền (Amount Mismatch)', desc: 'Số tiền callback không khớp với số tiền đơn hàng gốc tại Merchant.' },
    INVALID_SIGNATURE: { code: 4001, title: 'Sai chữ ký số (Invalid Signature)', desc: 'Chữ ký HMAC-SHA256 không hợp lệ do payload bị sửa đổi trên đường truyền.' }
  }
};
