import { describe, it, expect } from 'vitest';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {
  exportToBinary,
  importFromBinary,
  exportToString,
  importFromString,
} from '../src/engine/serialization/codeSerializer';
import { splitIntoQrChunks, QrChunkCollector } from '../src/engine/serialization/qrChunker';
import { WorkspaceState, GridState } from '../src/types';

function renderQrToImageData(data: Uint8Array, scale = 4, margin = 4) {
  const qr = QRCode.create([{ data, mode: 'byte' }], { errorCorrectionLevel: 'M' });
  const modSize = qr.modules.size;
  const totalSize = (modSize + margin * 2) * scale;
  const imgData = new Uint8ClampedArray(totalSize * totalSize * 4);
  imgData.fill(255); // white

  for (let y = 0; y < modSize; y++) {
    for (let x = 0; x < modSize; x++) {
      if (qr.modules.get(x, y)) {
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const px = (x + margin) * scale + dx;
            const py = (y + margin) * scale + dy;
            const idx = (py * totalSize + px) * 4;
            imgData[idx] = 0;
            imgData[idx + 1] = 0;
            imgData[idx + 2] = 0;
            imgData[idx + 3] = 255;
          }
        }
      }
    }
  }

  return { data: imgData, width: totalSize, height: totalSize };
}

describe('QR Code Generation and Scanning (Level M, Binary Mode)', () => {
  it('encodes raw binary byte array with Level M and decodes it identically via jsQR', () => {
    const originalBytes = new Uint8Array([
      0x52, 0x45, 0x51, 0x52, // REQR
      0x12, 0x34,             // sessionId
      0x01, 0x01,             // part 1 of 1
      0x01, 0x01, 0x01,       // header (v1, grid, v1)
      0x10, 0x12, 0x13,       // opcodes
      0x00, 0xff, 0x7f, 0x80, // arbitrary binary edge cases
    ]);

    const { data, width, height } = renderQrToImageData(originalBytes);
    const code = jsQR(data, width, height);

    expect(code).not.toBeNull();
    expect(code!.binaryData).toBeDefined();

    const decodedBytes = new Uint8Array(code!.binaryData);
    expect(decodedBytes).toEqual(originalBytes);
  });

  it('performs full round-trip: Workspace -> Binary -> Multi-Chunk QR -> jsQR -> Reassemble -> Import', () => {
    // 1. Create a substantial workspace & grid state
    const workspace: WorkspaceState = {
      MAIN: [
        { id: 'b1', type: 'MOVE_FWD', repeatCount: 3 },
        { id: 'b2', type: 'TURN_LEFT' },
        { id: 'b3', type: 'CALL_F1' },
      ],
      F1: [
        { id: 'f1', type: 'MOVE_FWD', repeatCount: 2 },
        { id: 'f2', type: 'TURN_RIGHT' },
      ],
      F2: [],
      F3: [],
    };

    const grid: GridState = {
      width: 10,
      height: 10,
      robot: {
        x: 2,
        y: 3,
        dir: 'EAST',
        initialX: 2,
        initialY: 3,
        initialDir: 'EAST',
      },
      barriers: [
        { x: 3, y: 3 },
        { x: 4, y: 5 },
      ],
      flags: [
        { id: 'flag_1', x: 5, y: 5, order: 1, collected: false, isGoal: false },
        { id: 'flag_goal', x: 8, y: 8, order: 99, collected: false, isGoal: true },
      ],
      trace: [{ x: 2, y: 3 }],
      walls: [
        { x: 1, y: 1, edge: 'NORTH' },
        { x: 2, y: 2, edge: 'WEST' },
      ],
    };

    // 2. Export to binary
    const binary = exportToBinary(workspace, 'grid', grid);
    expect(binary.length).toBeGreaterThan(0);

    // 3. Split into QR chunks
    const chunks = splitIntoQrChunks(binary, 0x9876);
    expect(chunks.length).toBeGreaterThanOrEqual(1);

    // 4. Simulate QR scanning and collector reassembly
    const collector = new QrChunkCollector();
    let reassembledPayload: Uint8Array | undefined;

    for (const chunk of chunks) {
      expect(chunk.data.length).toBeLessThanOrEqual(500);

      // Render to image
      const { data, width, height } = renderQrToImageData(chunk.data);
      // Scan with jsQR
      const scanned = jsQR(data, width, height);
      expect(scanned).not.toBeNull();

      const scannedBytes = new Uint8Array(scanned!.binaryData);
      const res = collector.addScannedBytes(scannedBytes);
      if (res.complete) {
        reassembledPayload = res.payload;
      }
    }

    expect(reassembledPayload).toBeDefined();
    expect(reassembledPayload).toEqual(binary);

    // 5. Import from reassembled binary
    const importRes = importFromBinary(reassembledPayload!);
    expect(importRes.success).toBe(true);
    expect(importRes.envId).toBe('grid');
    expect(importRes.gridState?.width).toBe(10);
    expect(importRes.gridState?.height).toBe(10);
    expect(importRes.gridState?.robot.x).toBe(2);
    expect(importRes.gridState?.robot.y).toBe(3);
    expect(importRes.workspace?.MAIN.length).toBe(3);
    expect(importRes.workspace?.F1.length).toBe(2);
  });
});
