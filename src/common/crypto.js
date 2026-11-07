/**
 * Cryptographic Utility for HMAC-SHA256 Signature generation & verification.
 * Follows the standard canonical payload pattern used by MoMo & ZaloPay.
 */
const crypto = require('crypto');

class CryptoUtils {
  /**
   * Sort keys alphabetically and build query string format: key1=val1&key2=val2...
   * @param {Object} data - Key-value map of parameters
   * @param {Array<string>} [keysToExclude=[]] - Keys to omit (like 'signature')
   * @returns {string} canonical string
   */
  static buildCanonicalQuery(data, keysToExclude = ['signature']) {
    return Object.keys(data)
      .filter((k) => !keysToExclude.includes(k) && data[k] !== undefined && data[k] !== null)
      .sort()
      .map((k) => `${k}=${encodeURIComponent(data[k])}`)
      .join('&');
  }

  /**
   * Calculate HMAC-SHA256 signature
   * @param {string} rawData - Canonical raw string
   * @param {string} secretKey - Shared secret key
   * @returns {string} hex-encoded hash
   */
  static signHmacSha256(rawData, secretKey) {
    return crypto.createHmac('sha256', secretKey).update(rawData).digest('hex');
  }

  /**
   * Verify signature using constant-time comparison to prevent timing attacks
   * @param {string} rawData
   * @param {string} secretKey
   * @param {string} expectedSignature
   * @returns {boolean}
   */
  static verifySignature(rawData, secretKey, expectedSignature) {
    if (!expectedSignature) return false;
    const computedSignature = this.signHmacSha256(rawData, secretKey);
    const expectedBuf = Buffer.from(expectedSignature, 'utf-8');
    const computedBuf = Buffer.from(computedSignature, 'utf-8');
    if (expectedBuf.length !== computedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, computedBuf);
  }
}

module.exports = CryptoUtils;
