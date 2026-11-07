/**
 * Simple In-Memory Database to mimic persistent storage with ACID-like idempotency protection.
 */
class InMemoryDatabase {
  constructor() {
    this.orders = new Map();
    this.payments = new Map();
    this.idempotencyKeys = new Set();
    this.webhookLogs = [];
  }

  // --- Orders ---
  createOrder(order) {
    this.orders.set(order.orderId, {
      ...order,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return this.orders.get(order.orderId);
  }

  getOrder(orderId) {
    return this.orders.get(orderId);
  }

  updateOrderStatus(orderId, status, paymentDetails = {}) {
    const existing = this.orders.get(orderId);
    if (!existing) return null;
    const updated = {
      ...existing,
      status,
      paymentDetails: { ...existing.paymentDetails, ...paymentDetails },
      updatedAt: new Date().toISOString(),
    };
    this.orders.set(orderId, updated);
    return updated;
  }

  // --- Gateway Transactions ---
  createGatewayTx(tx) {
    this.payments.set(tx.transId, {
      ...tx,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return this.payments.get(tx.transId);
  }

  getGatewayTx(transId) {
    return this.payments.get(transId);
  }

  getGatewayTxByOrderId(appTransId) {
    for (const tx of this.payments.values()) {
      if (tx.appTransId === appTransId) return tx;
    }
    return null;
  }

  updateGatewayTx(transId, updates) {
    const existing = this.payments.get(transId);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.payments.set(transId, updated);
    return updated;
  }

  // --- Idempotency Check ---
  hasProcessedIdempotencyKey(key) {
    return this.idempotencyKeys.has(key);
  }

  markIdempotencyKey(key) {
    this.idempotencyKeys.add(key);
  }

  // --- Webhook / IPN audit logs ---
  logWebhook(entry) {
    this.webhookLogs.unshift({
      ...entry,
      timestamp: new Date().toISOString(),
    });
    if (this.webhookLogs.length > 50) this.webhookLogs.pop();
  }

  getWebhookLogs() {
    return this.webhookLogs;
  }
}

module.exports = new InMemoryDatabase();
