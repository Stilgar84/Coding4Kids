/**
 * Binary serializer for the Switchyard environment.
 *
 * ENV_ID_SWITCHYARD = 0x05, envVersion = 1
 *
 * Wire layout (env state payload, immediately after the 3-byte header):
 *   hasLayout: uint8 (0 = empty sandbox, 1 = has layout)
 *   If hasLayout:
 *     layoutFlags: uint8
 *       bit 0 (0x01): has 2 switches (vs 1)
 *       bit 1 (0x02): has dock specs (vs all open docks)
 *     switchCount: uint8 (1 or 2)
 *     initialSwitchDirs: switchCount × uint8  (0=LEFT, 1=RIGHT)
 *     dockCount: uint8
 *     For each dock:
 *       dockFlags: uint8
 *         bit 0 (0x01): hasAcceptColor
 *         bit 1 (0x02): hasAcceptIcon
 *         bit 2 (0x04): rejectDamaged
 *       [acceptColorIdx: uint8]  (if bit 0)
 *       [acceptIconIdx:  uint8]  (if bit 1)
 *     queueLength: VLE
 *     For each item:
 *       itemByte: uint8 = [damaged(1b) | iconIdx(2b) | colorIdx(2b)]  (bits 7..5 unused/0)
 */

import { CodeBlock } from '../../../types';
import {
  DockSpec,
  SwitchDirection,
  SwitchyardItem,
  SwitchyardState,
  ITEM_COLOR_FROM_INDEX,
  ITEM_ICON_FROM_INDEX,
  ITEM_COLOR_INDEX,
  ITEM_ICON_INDEX,
} from '../../../simulations/switchyard/types';
import { createInitialSwitchyardState } from '../../../simulations/switchyard/physics';
import { BinaryReader } from '../binaryReader';
import { BinaryWriter } from '../binaryWriter';

// ─── Opcode constants ─────────────────────────────────────────────────────
export const ENV_ID_SWITCHYARD = 0x05;
export const ENV_VERSION_SWITCHYARD = 1;

export const OP_SWITCHYARD_SWITCH_LEFT  = 0x10;
export const OP_SWITCHYARD_SWITCH_RIGHT = 0x11;
export const OP_SWITCHYARD_SEND_NEXT    = 0x12;
export const OP_SWITCHYARD_SCRAP_ITEM   = 0x13;

// ─── Item helpers ──────────────────────────────────────────────────────────

function itemToByte(item: SwitchyardItem): number {
  const colorIdx = ITEM_COLOR_INDEX[item.color] ?? 0;
  const iconIdx  = ITEM_ICON_INDEX[item.icon]   ?? 0;
  const damagedBit = item.damaged ? 0x10 : 0x00;
  // Packing: [0000(b7..5) | damaged(b4) | iconIdx(b3..b2) | colorIdx(b1..b0)]
  return damagedBit | ((iconIdx & 0x03) << 2) | (colorIdx & 0x03);
}

function byteToItem(byte: number): SwitchyardItem {
  const colorIdx  = byte & 0x03;
  const iconIdx   = (byte >> 2) & 0x03;
  const damaged   = (byte & 0x10) !== 0;
  return {
    color:   ITEM_COLOR_FROM_INDEX[colorIdx]  ?? 'RED',
    icon:    ITEM_ICON_FROM_INDEX[iconIdx]    ?? 'CRATE',
    damaged,
    weight: 1,
  };
}

// ─── Write ─────────────────────────────────────────────────────────────────

export function writeSwitchyardState(writer: BinaryWriter, state?: SwitchyardState): void {
  if (!state) {
    writer.writeUint8(0x00); // hasLayout = false
    return;
  }

  writer.writeUint8(0x01); // hasLayout = true

  const switchCount = state.initialSwitchDirections.length > 1 ? 2 : 1;
  const hasTwoSwitches = switchCount === 2;
  let layoutFlags = 0;
  if (hasTwoSwitches) layoutFlags |= 0x01;
  // Always emit dock specs
  layoutFlags |= 0x02;
  writer.writeUint8(layoutFlags);

  // Switches
  writer.writeUint8(switchCount);
  const dirs = state.initialSwitchDirections;
  for (let i = 0; i < switchCount; i++) {
    writer.writeUint8((dirs[i] ?? 'LEFT') === 'LEFT' ? 0 : 1);
  }

  // Docks
  const specs = state.initialDockSpecs;
  writer.writeUint8(specs.length);
  for (const spec of specs) {
    let dockFlags = 0;
    if (spec.acceptColor !== undefined) dockFlags |= 0x01;
    if (spec.acceptIcon  !== undefined) dockFlags |= 0x02;
    if (spec.rejectDamaged)             dockFlags |= 0x04;
    writer.writeUint8(dockFlags);
    if (spec.acceptColor !== undefined) {
      writer.writeUint8(ITEM_COLOR_INDEX[spec.acceptColor] ?? 0);
    }
    if (spec.acceptIcon !== undefined) {
      writer.writeUint8(ITEM_ICON_INDEX[spec.acceptIcon] ?? 0);
    }
  }

  // Queue items (initial)
  const queue = state.initialQueue;
  writer.writeVLE(queue.length);
  for (const item of queue) {
    writer.writeUint8(itemToByte(item));
  }
}

// ─── Read ──────────────────────────────────────────────────────────────────

export function readSwitchyardState(reader: BinaryReader): SwitchyardState {
  const hasLayout = reader.readUint8();
  if (!hasLayout) {
    return createInitialSwitchyardState();
  }

  reader.readUint8(); // layoutFlags reserved for future extensions
  const switchCount = reader.readUint8();
  const dirs: SwitchDirection[] = [];
  for (let i = 0; i < switchCount; i++) {
    dirs.push(reader.readUint8() === 0 ? 'LEFT' : 'RIGHT');
  }

  const dockCount = reader.readUint8();
  const dockSpecs: DockSpec[] = [];
  const DOCK_IDS = ['DOCK_A', 'DOCK_B', 'DOCK_C'] as const;
  for (let i = 0; i < dockCount; i++) {
    const dockFlags = reader.readUint8();
    const spec: DockSpec = { id: DOCK_IDS[i] ?? 'DOCK_A' };
    if (dockFlags & 0x01) {
      const ci = reader.readUint8();
      spec.acceptColor = ITEM_COLOR_FROM_INDEX[ci] ?? 'RED';
    }
    if (dockFlags & 0x02) {
      const ii = reader.readUint8();
      spec.acceptIcon = ITEM_ICON_FROM_INDEX[ii] ?? 'CRATE';
    }
    if (dockFlags & 0x04) {
      spec.rejectDamaged = true;
    }
    dockSpecs.push(spec);
  }

  const queueLen = reader.readVLE();
  const queue: SwitchyardItem[] = [];
  for (let i = 0; i < queueLen; i++) {
    queue.push(byteToItem(reader.readUint8()));
  }

  return createInitialSwitchyardState({
    initialQueue: queue,
    initialDockSpecs: dockSpecs,
    initialSwitchDirections: dirs,
  } as Partial<SwitchyardState>);
}

// ─── Code block helpers (called from codeScopes.ts) ───────────────────────

export function getSwitchyardOpcodeForBlock(block: CodeBlock): number {
  switch (block.type) {
    case 'SWITCH_LEFT':  return OP_SWITCHYARD_SWITCH_LEFT;
    case 'SWITCH_RIGHT': return OP_SWITCHYARD_SWITCH_RIGHT;
    case 'SEND_NEXT':    return OP_SWITCHYARD_SEND_NEXT;
    case 'SCRAP_ITEM':   return OP_SWITCHYARD_SCRAP_ITEM;
    default:
      throw new Error(`Unsupported Switchyard block type: ${block.type}`);
  }
}

export function getSwitchyardParamVarFlags(
  _opcode: number,
  _params?: Record<string, any>
): { param0IsVar: boolean; param1IsVar: boolean } {
  // Currently no Switchyard action has variable params (junction is always a string literal)
  return { param0IsVar: false, param1IsVar: false };
}

export function writeSwitchyardParams(
  writer: BinaryWriter,
  opcode: number,
  params?: Record<string, any>,
  _paramVarMask: number = 0
): void {
  if (opcode === OP_SWITCHYARD_SWITCH_LEFT || opcode === OP_SWITCHYARD_SWITCH_RIGHT) {
    // Junction byte: 0 = 'A', 1 = 'B'
    const junction = params?.junction ?? 'A';
    writer.writeUint8(junction === 'B' ? 1 : 0);
  }
  // SEND_NEXT and SCRAP_ITEM have no params (repeatCount is handled by standard HasRep)
}

export function readSwitchyardBlock(
  reader: BinaryReader,
  opcode: number,
  _paramVarMask: number = 0
): Omit<CodeBlock, 'id' | 'repeatCount'> {
  switch (opcode) {
    case OP_SWITCHYARD_SWITCH_LEFT: {
      const junctionIdx = reader.readUint8();
      return { type: 'SWITCH_LEFT', params: { junction: junctionIdx === 1 ? 'B' : 'A' } };
    }
    case OP_SWITCHYARD_SWITCH_RIGHT: {
      const junctionIdx = reader.readUint8();
      return { type: 'SWITCH_RIGHT', params: { junction: junctionIdx === 1 ? 'B' : 'A' } };
    }
    case OP_SWITCHYARD_SEND_NEXT:
      return { type: 'SEND_NEXT' };
    case OP_SWITCHYARD_SCRAP_ITEM:
      return { type: 'SCRAP_ITEM' };
    default:
      throw new Error(`Unknown Switchyard opcode: 0x${opcode.toString(16)}`);
  }
}
