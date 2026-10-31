const B64_MAP: Record<string, number> = {};
const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
for (let i = 0; i < B64_CHARS.length; i++) {
  B64_MAP[B64_CHARS[i]] = i;
}
// Support standard Base64 variants (+ and /)
B64_MAP['+'] = 62;
B64_MAP['/'] = 63;

/**
 * Decodes a Base64URL (or standard Base64) string to a Uint8Array.
 */
export function base64URLToUint8Array(str: string): Uint8Array {
  // Strip whitespace and padding
  const clean = str.replace(/[\s=]/g, '');
  const len = clean.length;
  if (len === 0) {
    return new Uint8Array(0);
  }

  // Calculate output byte length
  // 4 chars -> 3 bytes
  // 3 chars -> 2 bytes
  // 2 chars -> 1 byte
  const rem = len % 4;
  if (rem === 1) {
    throw new Error('Invalid Base64URL string: length % 4 cannot be 1');
  }

  const byteLen = Math.floor(len / 4) * 3 + (rem === 2 ? 1 : rem === 3 ? 2 : 0);
  const bytes = new Uint8Array(byteLen);

  let inIdx = 0;
  let outIdx = 0;

  while (inIdx < len) {
    const c0 = clean[inIdx++];
    const c1 = clean[inIdx++];
    const c2 = inIdx < len ? clean[inIdx++] : null;
    const c3 = inIdx < len ? clean[inIdx++] : null;

    const v0 = B64_MAP[c0];
    const v1 = B64_MAP[c1];
    if (v0 === undefined || v1 === undefined) {
      throw new Error(`Invalid Base64URL character '${v0 === undefined ? c0 : c1}'`);
    }

    bytes[outIdx++] = (v0 << 2) | (v1 >> 4);

    if (c2 !== null) {
      const v2 = B64_MAP[c2];
      if (v2 === undefined) {
        throw new Error(`Invalid Base64URL character '${c2}'`);
      }
      bytes[outIdx++] = ((v1 & 0x0f) << 4) | (v2 >> 2);

      if (c3 !== null) {
        const v3 = B64_MAP[c3];
        if (v3 === undefined) {
          throw new Error(`Invalid Base64URL character '${c3}'`);
        }
        bytes[outIdx++] = ((v2 & 0x03) << 6) | v3;
      }
    }
  }

  return bytes;
}

/**
 * Compact binary reader supporting uint8, VLE (LEB128 unsigned), and byte buffers.
 */
export class BinaryReader {
  private buffer: Uint8Array;
  private offset: number;

  constructor(data: Uint8Array) {
    this.buffer = data;
    this.offset = 0;
  }

  static fromBase64URL(str: string): BinaryReader {
    return new BinaryReader(base64URLToUint8Array(str));
  }

  get remaining(): number {
    return this.buffer.length - this.offset;
  }

  get hasMore(): boolean {
    return this.offset < this.buffer.length;
  }

  get currentOffset(): number {
    return this.offset;
  }

  /**
   * Reads a single 8-bit unsigned integer (0..255).
   */
  readUint8(): number {
    if (this.offset >= this.buffer.length) {
      throw new Error(`Unexpected end of data at offset ${this.offset}`);
    }
    return this.buffer[this.offset++];
  }

  /**
   * Reads an unsigned integer encoded with 7-bit continuation VLE (LEB128).
   */
  readVLE(): number {
    let result = 0;
    let shift = 0;
    while (true) {
      if (this.offset >= this.buffer.length) {
        throw new Error(`Unexpected end of data reading VLE at offset ${this.offset}`);
      }
      const byte = this.readUint8();
      result |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) {
        return result >>> 0;
      }
      shift += 7;
      if (shift > 35) {
        throw new Error(`VLE integer overflow at offset ${this.offset}`);
      }
    }
  }

  /**
   * Reads a slice of N bytes.
   */
  readBytes(length: number): Uint8Array {
    if (this.offset + length > this.buffer.length) {
      throw new Error(`Cannot read ${length} bytes: only ${this.remaining} bytes remaining`);
    }
    const slice = this.buffer.subarray(this.offset, this.offset + length);
    this.offset += length;
    return slice;
  }
}
