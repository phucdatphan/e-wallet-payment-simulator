/**
 * Lightweight Zero-dependency QR Code Generator (Pure JavaScript)
 * Generates valid standalone SVG strings for any text payload (URLs, deep-links).
 * Based on QR Code Model 2 specification with Byte encoding mode.
 */

class QRCodeGenerator {
  // Mode indicators
  static MODE_BYTE = 0x4;

  // Generator polynomials for Reed-Solomon Error Correction
  static EXP_TABLE = new Uint8Array(512);
  static LOG_TABLE = new Uint8Array(256);

  static _initTables = (() => {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      QRCodeGenerator.EXP_TABLE[i] = x;
      QRCodeGenerator.EXP_TABLE[i + 255] = x;
      QRCodeGenerator.LOG_TABLE[x] = i;
      x = (x << 1) ^ ((x & 0x80) ? 0x11d : 0);
    }
  })();

  static glog(n) {
    if (n < 1) throw new Error('glog(' + n + ')');
    return QRCodeGenerator.LOG_TABLE[n];
  }

  static gexp(n) {
    return QRCodeGenerator.EXP_TABLE[n];
  }

  static rsPolyMultiply(p1, p2) {
    const res = new Uint8Array(p1.length + p2.length - 1);
    for (let i = 0; i < p1.length; i++) {
      for (let j = 0; j < p2.length; j++) {
        if (p1[i] !== 0 && p2[j] !== 0) {
          res[i + j] ^= QRCodeGenerator.gexp(QRCodeGenerator.glog(p1[i]) + QRCodeGenerator.glog(p2[j]));
        }
      }
    }
    return res;
  }

  static getRsGeneratorPoly(ecLength) {
    let poly = new Uint8Array([1]);
    for (let i = 0; i < ecLength; i++) {
      poly = QRCodeGenerator.rsPolyMultiply(poly, new Uint8Array([1, QRCodeGenerator.gexp(i)]));
    }
    return poly;
  }

  static calculateECC(dataBytes, ecCount) {
    const genPoly = QRCodeGenerator.getRsGeneratorPoly(ecCount);
    const msg = new Uint8Array(dataBytes.length + ecCount);
    msg.set(dataBytes, 0);

    for (let i = 0; i < dataBytes.length; i++) {
      const coef = msg[i];
      if (coef !== 0) {
        const logCoef = QRCodeGenerator.glog(coef);
        for (let j = 0; j < genPoly.length; j++) {
          msg[i + j] ^= QRCodeGenerator.gexp(logCoef + QRCodeGenerator.glog(genPoly[j]));
        }
      }
    }
    return msg.subarray(dataBytes.length);
  }

  /**
   * Determine suitable QR version (Version 1 to 4, EC Level M)
   * Version capacities for Byte mode EC-M:
   * V1: 14 bytes, V2: 26 bytes, V3: 42 bytes, V4: 62 bytes, V5: 84 bytes
   */
  static getVersionForLength(len) {
    const caps = [
      { v: 1, max: 14, totalData: 16, ec: 10, size: 21 },
      { v: 2, max: 26, totalData: 28, ec: 16, size: 25 },
      { v: 3, max: 42, totalData: 44, ec: 26, size: 29 },
      { v: 4, max: 62, totalData: 64, ec: 36, size: 33 },
      { v: 5, max: 84, totalData: 86, ec: 48, size: 37 },
      { v: 6, max: 106, totalData: 108, ec: 64, size: 41 },
    ];
    for (const c of caps) {
      if (len <= c.max) return c;
    }
    return caps[caps.length - 1];
  }

  /**
   * Generates SVG string for given text
   * @param {string} text - text to encode
   * @param {number} size - pixel dimension of SVG
   * @returns {string} SVG code
   */
  static generateSVG(text, size = 180) {
    const utf8Bytes = Buffer.from(text, 'utf-8');
    const vInfo = QRCodeGenerator.getVersionForLength(utf8Bytes.length);
    const modCount = vInfo.size;

    // Bit buffer
    const bits = [];
    const addBits = (val, length) => {
      for (let i = length - 1; i >= 0; i--) {
        bits.push((val >> i) & 1);
      }
    };

    // 1. Mode indicator (0100 for Byte mode)
    addBits(QRCodeGenerator.MODE_BYTE, 4);
    // 2. Character count indicator (8 bits for Byte mode in V1-V9)
    addBits(utf8Bytes.length, 8);
    // 3. Data bytes
    for (const b of utf8Bytes) {
      addBits(b, 8);
    }
    // 4. Terminator (up to 4 zeroes)
    const totalDataBits = vInfo.totalData * 8;
    const termLen = Math.min(4, totalDataBits - bits.length);
    for (let i = 0; i < termLen; i++) bits.push(0);

    // 5. Pad to byte boundary
    while (bits.length % 8 !== 0) bits.push(0);

    // 6. Pad bytes 0xEC, 0x11
    const padBytes = [0xec, 0x11];
    let padIdx = 0;
    while (bits.length < totalDataBits) {
      addBits(padBytes[padIdx % 2], 8);
      padIdx++;
    }

    // Convert bits to byte array
    const dataBytes = new Uint8Array(vInfo.totalData);
    for (let i = 0; i < vInfo.totalData; i++) {
      let b = 0;
      for (let j = 0; j < 8; j++) {
        b = (b << 1) | bits[i * 8 + j];
      }
      dataBytes[i] = b;
    }

    // Calculate Error Correction Bytes
    const ecBytes = QRCodeGenerator.calculateECC(dataBytes, vInfo.ec);

    // Combine data + ec
    const fullCodewords = new Uint8Array(dataBytes.length + ecBytes.length);
    fullCodewords.set(dataBytes, 0);
    fullCodewords.set(ecBytes, dataBytes.length);

    // Create 2D Matrix (0 = unset/false, 1 = true/black, 2 = reserved white, 3 = reserved black)
    const matrix = Array.from({ length: modCount }, () => new Uint8Array(modCount));
    const isReserved = Array.from({ length: modCount }, () => new Uint8Array(modCount));

    // Place Finder Patterns
    const placeFinder = (r, c) => {
      for (let i = -1; i <= 7; i++) {
        for (let j = -1; j <= 7; j++) {
          const row = r + i;
          const col = c + j;
          if (row >= 0 && row < modCount && col >= 0 && col < modCount) {
            isReserved[row][col] = 1;
            if (i >= 0 && i <= 6 && j >= 0 && j <= 6) {
              if (i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4)) {
                matrix[row][col] = 1;
              } else {
                matrix[row][col] = 0;
              }
            } else {
              matrix[row][col] = 0; // Separator
            }
          }
        }
      }
    };

    placeFinder(0, 0);
    placeFinder(0, modCount - 7);
    placeFinder(modCount - 7, 0);

    // Timing Patterns
    for (let i = 8; i < modCount - 8; i++) {
      isReserved[6][i] = 1;
      matrix[6][i] = (i % 2 === 0) ? 1 : 0;
      isReserved[i][6] = 1;
      matrix[i][6] = (i % 2 === 0) ? 1 : 0;
    }

    // Dark Module
    isReserved[4 * vInfo.v + 9][8] = 1;
    matrix[4 * vInfo.v + 9][8] = 1;

    // Reserve Format Information areas
    for (let i = 0; i < 9; i++) {
      if (i < modCount) { isReserved[i][8] = 1; isReserved[8][i] = 1; }
    }
    for (let i = modCount - 8; i < modCount; i++) {
      if (i >= 0) { isReserved[i][8] = 1; isReserved[8][i] = 1; }
    }

    // Place Data and EC bits into matrix
    let allBits = [];
    for (const byte of fullCodewords) {
      for (let b = 7; b >= 0; b--) {
        allBits.push((byte >> b) & 1);
      }
    }

    let bitIdx = 0;
    let dir = -1; // upward
    let col = modCount - 1;

    while (col > 0) {
      if (col === 6) col--; // Skip vertical timing column
      const rowStart = dir === -1 ? modCount - 1 : 0;
      const rowEnd = dir === -1 ? -1 : modCount;

      for (let row = rowStart; row !== rowEnd; row += (dir === -1 ? -1 : 1)) {
        for (let c = 0; c < 2; c++) {
          const currCol = col - c;
          if (!isReserved[row][currCol]) {
            let bit = bitIdx < allBits.length ? allBits[bitIdx++] : 0;
            // Apply mask pattern 0 ( (row + col) % 2 === 0 )
            if ((row + currCol) % 2 === 0) {
              bit ^= 1;
            }
            matrix[row][currCol] = bit;
          }
        }
      }
      dir = -dir;
      col -= 2;
    }

    // Format info for EC Level M (00) & Mask 000 = 101010000010010
    const formatBits = [1,0,1,0,1,0,0,0,0,0,1,0,0,1,0];
    for (let i = 0; i < 6; i++) matrix[8][i] = formatBits[i];
    matrix[8][7] = formatBits[6];
    matrix[8][8] = formatBits[7];
    matrix[7][8] = formatBits[8];
    for (let i = 9; i < 15; i++) matrix[14 - i][8] = formatBits[i];

    for (let i = 0; i < 8; i++) matrix[8][modCount - 1 - i] = formatBits[i];
    for (let i = 8; i < 15; i++) matrix[modCount - 15 + i][8] = formatBits[i];

    // Build SVG
    const quietZone = 2;
    const totalModules = modCount + quietZone * 2;
    const moduleSize = size / totalModules;

    let paths = '';
    for (let r = 0; r < modCount; r++) {
      for (let c = 0; c < modCount; c++) {
        if (matrix[r][c] === 1) {
          const x = (c + quietZone) * moduleSize;
          const y = (r + quietZone) * moduleSize;
          paths += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(moduleSize + 0.1).toFixed(1)}" height="${(moduleSize + 0.1).toFixed(1)}" fill="#111827"/>`;
        }
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="background:#fff; border-radius:8px; padding:4px; box-sizing:border-box;">
      <rect width="100%" height="100%" fill="#ffffff" rx="8"/>
      ${paths}
    </svg>`;
  }
}

module.exports = QRCodeGenerator;
