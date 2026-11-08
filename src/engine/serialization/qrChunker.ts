/**
 * QR Code Chunking and Framing Protocol
 *
 * Ensures each QR code stays strictly <= 500 bytes, using binary 8-bit byte mode.
 * Payloads larger than 492 bytes are split across multiple sequenced QR codes with an 8-byte header:
 * - Bytes 0..3: Magic header "REQR" (0x52, 0x45, 0x51, 0x52)
 * - Bytes 4..5: Session ID (16-bit uint) to prevent mixing chunks from different exports
 * - Byte 6:     Part index (1-based: 1..totalParts)
 * - Byte 7:     Total parts count (1..255)
 * - Bytes 8..:  Chunk data slice (max 492 bytes)
 */

export const QR_MAGIC_0 = 0x52; // 'R'
export const QR_MAGIC_1 = 0x45; // 'E'
export const QR_MAGIC_2 = 0x51; // 'Q'
export const QR_MAGIC_3 = 0x52; // 'R'

export const QR_HEADER_SIZE = 8;
export const MAX_QR_CHUNK_BYTES = 500;
export const MAX_CHUNK_PAYLOAD = MAX_QR_CHUNK_BYTES - QR_HEADER_SIZE; // 492 bytes

export interface QrChunk {
  sessionId: number;
  partIndex: number;
  totalParts: number;
  /** Full binary packet including the 8-byte header (<= 500 bytes) */
  data: Uint8Array;
  /** Payload slice alone (without header) */
  payloadSlice: Uint8Array;
}

export interface ChunkProgress {
  sessionId: number;
  totalParts: number;
  receivedCount: number;
  receivedParts: number[];
  missingParts: number[];
}

export interface AddChunkResult {
  complete: boolean;
  progress: ChunkProgress;
  payload?: Uint8Array;
  error?: string;
  isNewChunk?: boolean;
}

/**
 * Splits a raw binary payload into one or more <= 500-byte QR chunks.
 */
export function splitIntoQrChunks(payload: Uint8Array, customSessionId?: number): QrChunk[] {
  if (payload.length === 0) {
    throw new Error('Cannot split empty payload');
  }

  const totalParts = Math.ceil(payload.length / MAX_CHUNK_PAYLOAD) || 1;
  const sessionId = customSessionId !== undefined
    ? (customSessionId & 0xffff)
    : Math.floor(Math.random() * 0xffff);

  const chunks: QrChunk[] = [];

  for (let part = 1; part <= totalParts; part++) {
    const start = (part - 1) * MAX_CHUNK_PAYLOAD;
    const end = Math.min(start + MAX_CHUNK_PAYLOAD, payload.length);
    const slice = payload.slice(start, end);

    const chunkData = new Uint8Array(QR_HEADER_SIZE + slice.length);
    // Header
    chunkData[0] = QR_MAGIC_0;
    chunkData[1] = QR_MAGIC_1;
    chunkData[2] = QR_MAGIC_2;
    chunkData[3] = QR_MAGIC_3;
    chunkData[4] = (sessionId >> 8) & 0xff;
    chunkData[5] = sessionId & 0xff;
    chunkData[6] = part & 0xff;
    chunkData[7] = totalParts & 0xff;

    // Slice
    chunkData.set(slice, QR_HEADER_SIZE);

    chunks.push({
      sessionId,
      partIndex: part,
      totalParts,
      data: chunkData,
      payloadSlice: slice,
    });
  }

  return chunks;
}

/**
 * Inspects a binary byte array to determine if it is a formatted REQR chunk or raw binary payload.
 */
export function parseQrChunk(bytes: Uint8Array): {
  isValid: boolean;
  isReqrChunk: boolean;
  chunk?: QrChunk;
  rawPayload?: Uint8Array;
  error?: string;
} {
  if (!bytes || bytes.length === 0) {
    return { isValid: false, isReqrChunk: false, error: 'Empty byte array' };
  }

  // Check for REQR magic bytes
  if (
    bytes.length >= QR_HEADER_SIZE &&
    bytes[0] === QR_MAGIC_0 &&
    bytes[1] === QR_MAGIC_1 &&
    bytes[2] === QR_MAGIC_2 &&
    bytes[3] === QR_MAGIC_3
  ) {
    const sessionId = (bytes[4] << 8) | bytes[5];
    const partIndex = bytes[6];
    const totalParts = bytes[7];

    if (totalParts === 0 || partIndex === 0 || partIndex > totalParts) {
      return {
        isValid: false,
        isReqrChunk: true,
        error: `Invalid chunk numbering: part ${partIndex} of ${totalParts}`,
      };
    }

    const payloadSlice = bytes.slice(QR_HEADER_SIZE);
    return {
      isValid: true,
      isReqrChunk: true,
      chunk: {
        sessionId,
        partIndex,
        totalParts,
        data: bytes,
        payloadSlice,
      },
    };
  }

  // Otherwise, treat as raw binary payload (e.g. FORMAT_VERSION = 1 at byte 0)
  return {
    isValid: true,
    isReqrChunk: false,
    rawPayload: bytes,
  };
}

/**
 * Helper class that collects and reassembles incoming QR chunks from a scanner.
 */
export class QrChunkCollector {
  private currentSessionId: number | null = null;
  private totalParts: number = 0;
  private chunks: Map<number, Uint8Array> = new Map();

  reset(): void {
    this.currentSessionId = null;
    this.totalParts = 0;
    this.chunks.clear();
  }

  getProgress(): ChunkProgress {
    const receivedParts = Array.from(this.chunks.keys()).sort((a, b) => a - b);
    const missingParts: number[] = [];
    for (let i = 1; i <= this.totalParts; i++) {
      if (!this.chunks.has(i)) {
        missingParts.push(i);
      }
    }
    return {
      sessionId: this.currentSessionId ?? 0,
      totalParts: this.totalParts,
      receivedCount: this.chunks.size,
      receivedParts,
      missingParts,
    };
  }

  /**
   * Ingests a scanned byte array.
   */
  addScannedBytes(bytes: Uint8Array): AddChunkResult {
    const parsed = parseQrChunk(bytes);
    if (!parsed.isValid) {
      return {
        complete: false,
        progress: this.getProgress(),
        error: parsed.error || 'Invalid QR chunk format',
      };
    }

    // Direct raw payload (not multi-part framed)
    if (!parsed.isReqrChunk && parsed.rawPayload) {
      return {
        complete: true,
        progress: {
          sessionId: 0,
          totalParts: 1,
          receivedCount: 1,
          receivedParts: [1],
          missingParts: [],
        },
        payload: parsed.rawPayload,
        isNewChunk: true,
      };
    }

    const chunk = parsed.chunk!;

    // Single-part REQR chunk
    if (chunk.totalParts === 1) {
      return {
        complete: true,
        progress: {
          sessionId: chunk.sessionId,
          totalParts: 1,
          receivedCount: 1,
          receivedParts: [1],
          missingParts: [],
        },
        payload: chunk.payloadSlice,
        isNewChunk: true,
      };
    }

    // Multi-part chunk:
    // If from a different session, reset to new session
    if (this.currentSessionId !== null && this.currentSessionId !== chunk.sessionId) {
      this.reset();
    }

    const isNew = !this.chunks.has(chunk.partIndex);
    this.currentSessionId = chunk.sessionId;
    this.totalParts = chunk.totalParts;
    this.chunks.set(chunk.partIndex, chunk.payloadSlice);

    const progress = this.getProgress();

    if (this.chunks.size === this.totalParts) {
      // Reassemble all parts in order
      let totalLength = 0;
      for (let i = 1; i <= this.totalParts; i++) {
        totalLength += this.chunks.get(i)!.length;
      }

      const fullPayload = new Uint8Array(totalLength);
      let offset = 0;
      for (let i = 1; i <= this.totalParts; i++) {
        const slice = this.chunks.get(i)!;
        fullPayload.set(slice, offset);
        offset += slice.length;
      }

      return {
        complete: true,
        progress,
        payload: fullPayload,
        isNewChunk: isNew,
      };
    }

    return {
      complete: false,
      progress,
      isNewChunk: isNew,
    };
  }
}
