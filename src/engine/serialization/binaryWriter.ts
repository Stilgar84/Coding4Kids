const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * Encodes a Uint8Array to a Base64URL string (RFC 4648 §5, no padding).
 */
export function uint8ArrayToBase64URL(bytes: Uint8Array): string {
  let result = '';
  const len = bytes.length;
  let i = 0;

  for (; i + 2 < len; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    result += B64_CHARS[b0 >> 2];
    result += B64_CHARS[((b0 & 0x03) << 4) | (b1 >> 4)];
    result += B64_CHARS[((b1 & 0x0f) << 2) | (b2 >> 6)];
    result += B64_CHARS[b2 & 0x3f];
  }

  if (i < len) {
    const b0 = bytes[i];
    result += B64_CHARS[b0 >> 2];
    if (i + 1 < len) {
      const b1 = bytes[i + 1];
      result += B64_CHARS[((b0 & 0x03) << 4) | (b1 >> 4)];
      result += B64_CHARS[(b1 & 0x0f) << 2];
    } else {
      result += B64_CHARS[(b0 & 0x03) << 4];
    }
  }

  return result;
}

/**
 * Compact binary writer supporting uint8, VLE (LEB128 unsigned), and byte buffers.
 */
export class BinaryWriter {
  private buffer: Uint8Array;
  private offset: number;

  constructor(initialCapacity = 256) {
    this.buffer = new Uint8Array(initialCapacity);
    this.offset = 0;
  }

  private ensureCapacity(needed: number): void {
    if (this.offset + needed <= this.buffer.length) return;
    let newCap = this.buffer.length * 2;
    while (newCap < this.offset + needed) {
      newCap *= 2;
    }
    const next = new Uint8Array(newCap);
    next.set(this.buffer);
    this.buffer = next;
  }

  /**
   * Writes a single 8-bit unsigned integer (0..255).
   */
  writeUint8(byte: number): void {
    this.ensureCapacity(1);
    this.buffer[this.offset++] = byte & 0xff;
  }

  /**
   * Writes an unsigned integer using 7-bit continuation VLE (LEB128).
   * Values < 128 consume 1 byte.
   */
  writeVLE(value: number): void {
    let v = Math.floor(Math.max(0, value));
    while (v >= 0x80) {
      this.writeUint8((v & 0x7f) | 0x80);
      v = Math.floor(v / 128);
    }
    this.writeUint8(v & 0x7f);
  }

  /**
   * Writes a sequence of bytes.
   */
  writeBytes(bytes: Uint8Array | number[]): void {
    this.ensureCapacity(bytes.length);
    if (bytes instanceof Uint8Array) {
      this.buffer.set(bytes, this.offset);
    } else {
      for (let i = 0; i < bytes.length; i++) {
        this.buffer[this.offset + i] = bytes[i] & 0xff;
      }
    }
    this.offset += bytes.length;
  }

  /**
   * Returns the written bytes as a Uint8Array slice.
   */
  getBytes(): Uint8Array {
    return this.buffer.slice(0, this.offset);
  }

  /**
   * Encodes the accumulated binary payload into a Base64URL string.
   */
  toBase64URL(): string {
    return uint8ArrayToBase64URL(this.getBytes());
  }

  get length(): number {
    return this.offset;
  }
}
