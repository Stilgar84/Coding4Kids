import { describe, it, expect } from 'vitest';
import {
  splitIntoQrChunks,
  parseQrChunk,
  QrChunkCollector,
  MAX_QR_CHUNK_BYTES,
  MAX_CHUNK_PAYLOAD,
  QR_HEADER_SIZE,
} from '../src/engine/serialization/qrChunker';

describe('QR Chunker and Framing Protocol', () => {
  it('splits a small payload (<= 492 bytes) into a single chunk <= 500 bytes', () => {
    const payload = new Uint8Array([1, 2, 3, 4, 5, 42, 99]);
    const chunks = splitIntoQrChunks(payload, 0x1234);

    expect(chunks.length).toBe(1);
    const c0 = chunks[0];
    expect(c0.partIndex).toBe(1);
    expect(c0.totalParts).toBe(1);
    expect(c0.sessionId).toBe(0x1234);
    expect(c0.data.length).toBe(QR_HEADER_SIZE + payload.length);
    expect(c0.data.length).toBeLessThanOrEqual(MAX_QR_CHUNK_BYTES);
    expect(c0.payloadSlice).toEqual(payload);
  });

  it('splits exactly 492 bytes into a single 500-byte chunk', () => {
    const payload = new Uint8Array(492).fill(0xaa);
    const chunks = splitIntoQrChunks(payload);

    expect(chunks.length).toBe(1);
    expect(chunks[0].data.length).toBe(500);
    expect(chunks[0].partIndex).toBe(1);
    expect(chunks[0].totalParts).toBe(1);
  });

  it('splits 493 bytes into 2 chunks, each <= 500 bytes', () => {
    const payload = new Uint8Array(493).fill(0xbb);
    const chunks = splitIntoQrChunks(payload);

    expect(chunks.length).toBe(2);
    expect(chunks[0].data.length).toBe(500);
    expect(chunks[0].partIndex).toBe(1);
    expect(chunks[0].totalParts).toBe(2);

    expect(chunks[1].data.length).toBe(QR_HEADER_SIZE + 1); // 9 bytes
    expect(chunks[1].partIndex).toBe(2);
    expect(chunks[1].totalParts).toBe(2);
  });

  it('splits a large payload (1,200 bytes) into 3 chunks with identical session ID and <= 500 bytes each', () => {
    const payload = new Uint8Array(1200);
    for (let i = 0; i < payload.length; i++) {
      payload[i] = i % 256;
    }

    const chunks = splitIntoQrChunks(payload, 0xcafe);
    expect(chunks.length).toBe(3); // 492 + 492 + 216 = 1200

    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      expect(c.sessionId).toBe(0xcafe);
      expect(c.partIndex).toBe(i + 1);
      expect(c.totalParts).toBe(3);
      expect(c.data.length).toBeLessThanOrEqual(500);
    }

    expect(chunks[0].data.length).toBe(500);
    expect(chunks[1].data.length).toBe(500);
    expect(chunks[2].data.length).toBe(QR_HEADER_SIZE + 216); // 224 bytes
  });

  it('parses valid REQR chunk correctly', () => {
    const payload = new Uint8Array([10, 20, 30]);
    const chunks = splitIntoQrChunks(payload, 0x55aa);
    const parsed = parseQrChunk(chunks[0].data);

    expect(parsed.isValid).toBe(true);
    expect(parsed.isReqrChunk).toBe(true);
    expect(parsed.chunk).toBeDefined();
    expect(parsed.chunk!.sessionId).toBe(0x55aa);
    expect(parsed.chunk!.partIndex).toBe(1);
    expect(parsed.chunk!.totalParts).toBe(1);
    expect(parsed.chunk!.payloadSlice).toEqual(payload);
  });

  it('treats non-REQR data as raw payload', () => {
    const rawData = new Uint8Array([0x01, 0x01, 0x01, 0x55]); // FORMAT_VERSION = 1
    const parsed = parseQrChunk(rawData);

    expect(parsed.isValid).toBe(true);
    expect(parsed.isReqrChunk).toBe(false);
    expect(parsed.rawPayload).toEqual(rawData);
  });

  describe('QrChunkCollector', () => {
    it('immediately completes on raw binary payload', () => {
      const collector = new QrChunkCollector();
      const raw = new Uint8Array([1, 2, 3]);
      const res = collector.addScannedBytes(raw);

      expect(res.complete).toBe(true);
      expect(res.payload).toEqual(raw);
    });

    it('immediately completes on single-part REQR chunk', () => {
      const collector = new QrChunkCollector();
      const payload = new Uint8Array([100, 101, 102]);
      const chunks = splitIntoQrChunks(payload);
      const res = collector.addScannedBytes(chunks[0].data);

      expect(res.complete).toBe(true);
      expect(res.payload).toEqual(payload);
    });

    it('collects multi-part chunks in sequential order and reassembles', () => {
      const collector = new QrChunkCollector();
      const payload = new Uint8Array(1000);
      for (let i = 0; i < payload.length; i++) payload[i] = (i * 7) % 256;

      const chunks = splitIntoQrChunks(payload, 0x7777);
      expect(chunks.length).toBe(3);

      const res1 = collector.addScannedBytes(chunks[0].data);
      expect(res1.complete).toBe(false);
      expect(res1.progress.receivedCount).toBe(1);
      expect(res1.progress.totalParts).toBe(3);

      const res2 = collector.addScannedBytes(chunks[1].data);
      expect(res2.complete).toBe(false);
      expect(res2.progress.receivedCount).toBe(2);

      const res3 = collector.addScannedBytes(chunks[2].data);
      expect(res3.complete).toBe(true);
      expect(res3.payload).toEqual(payload);
    });

    it('collects multi-part chunks OUT OF ORDER (3, 1, 2) and reassembles properly', () => {
      const collector = new QrChunkCollector();
      const payload = new Uint8Array(1250);
      for (let i = 0; i < payload.length; i++) payload[i] = (i * 13) % 256;

      const chunks = splitIntoQrChunks(payload, 0x8888);
      expect(chunks.length).toBe(3);

      // Ingest part 3 first
      const res3 = collector.addScannedBytes(chunks[2].data);
      expect(res3.complete).toBe(false);
      expect(res3.progress.receivedParts).toEqual([3]);
      expect(res3.progress.missingParts).toEqual([1, 2]);

      // Ingest part 1 second
      const res1 = collector.addScannedBytes(chunks[0].data);
      expect(res1.complete).toBe(false);
      expect(res1.progress.receivedParts).toEqual([1, 3]);
      expect(res1.progress.missingParts).toEqual([2]);

      // Ingest part 2 last
      const res2 = collector.addScannedBytes(chunks[1].data);
      expect(res2.complete).toBe(true);
      expect(res2.progress.receivedCount).toBe(3);
      expect(res2.payload).toEqual(payload);
    });

    it('resets when encountering a chunk from a different session ID', () => {
      const collector = new QrChunkCollector();
      const payloadA = new Uint8Array(800);
      const payloadB = new Uint8Array(800);
      const chunksA = splitIntoQrChunks(payloadA, 0x1111);
      const chunksB = splitIntoQrChunks(payloadB, 0x2222);

      collector.addScannedBytes(chunksA[0].data);
      expect(collector.getProgress().sessionId).toBe(0x1111);

      collector.addScannedBytes(chunksB[0].data);
      expect(collector.getProgress().sessionId).toBe(0x2222);
      expect(collector.getProgress().receivedCount).toBe(1);
    });
  });
});
