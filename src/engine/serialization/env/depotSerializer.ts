import { CodeBlock, isVariableName } from '../../../types';
import {
  CrateColor,
  DEPOT_CRATE_COLORS,
  DEPOT_CRATE_PALETTE,
  DEPOT_RING_PALETTE,
  DEPOT_STATION_BITS,
  DepotQueueItem,
  DepotSendGate,
  DepotStacks,
  DepotState,
} from '../../../simulations/depot/types';
import {
  cloneQueue,
  cloneStacks,
  codeToStation,
  createInitialDepotState,
  depotStateNeedsQueueVersion,
  depotStateNeedsV4Version,
  getEffectiveActiveStationsMask,
  indexToStation,
  normalizeCrateColor,
  normalizeDepotStation,
  stationToCode,
  stationToIndex,
} from '../../../simulations/depot/depotPhysics';
import { BinaryReader } from '../binaryReader';
import { BinaryWriter } from '../binaryWriter';
import {
  ENV_VERSION_DEPOT,
  ENV_VERSION_DEPOT_QUEUE,
  ENV_VERSION_DEPOT_STATE,
  ENV_VERSION_DEPOT_V4,
  OP_DEPOT_GRAB,
  OP_DEPOT_MOVE_TO,
  OP_DEPOT_PLACE,
  OP_DEPOT_SEND_GATE,
  OP_DEPOT_SEND_OUT,
  indexToVarName,
  varNameToIndex,
} from '../types';

function isVarVal(val: unknown): boolean {
  return isVariableName(val) || (typeof val === 'string' && /^[a-z]$/.test(val.trim()));
}

export function crateColorToByte(color: CrateColor): number {
  return DEPOT_CRATE_COLORS[normalizeCrateColor(color)]?.code ?? 0;
}

export function byteToCrateColor(byte: number): CrateColor {
  return DEPOT_CRATE_PALETTE[byte & 0x0f]?.id ?? 'RED';
}

export function ringColorToCanonicalByte(color: CrateColor): number {
  return DEPOT_CRATE_COLORS[normalizeCrateColor(color)]?.paletteIndex ?? 1;
}

export function canonicalByteToRingColor(byte: number): CrateColor {
  return DEPOT_RING_PALETTE[byte & 0x0f]?.id ?? 'RED';
}

export function getDepotSerializationVersion(state?: DepotState): number {
  if (!state) return ENV_VERSION_DEPOT;
  if (depotStateNeedsV4Version(state)) return ENV_VERSION_DEPOT_V4;
  if (depotStateNeedsQueueVersion(state)) return ENV_VERSION_DEPOT_QUEUE;
  return ENV_VERSION_DEPOT_STATE;
}

export function gateToCode(gate: unknown): number {
  const g = String(gate ?? 'OUT').trim().toUpperCase();
  if (g === 'SCRAP') return 1;
  if (g === 'ACCEPT') return 2;
  if (g === 'REJECT') return 3;
  return 0; // 'OUT'
}

export function codeToGate(code: number): DepotSendGate {
  switch (code) {
    case 1:
      return 'SCRAP';
    case 2:
      return 'ACCEPT';
    case 3:
      return 'REJECT';
    default:
      return 'OUT';
  }
}

function writeCrateList(writer: BinaryWriter, list: readonly CrateColor[]): void {
  writer.writeVLE(list.length);
  for (const crate of list) {
    writer.writeUint8(crateColorToByte(crate));
  }
}

function readCrateList(reader: BinaryReader): CrateColor[] {
  const len = reader.readVLE();
  const out: CrateColor[] = [];
  for (let i = 0; i < len; i++) {
    out.push(byteToCrateColor(reader.readUint8()));
  }
  return out;
}

function writeCanonicalColorList(writer: BinaryWriter, list: readonly CrateColor[]): void {
  writer.writeVLE(list.length);
  for (const ring of list) {
    writer.writeUint8(ringColorToCanonicalByte(ring));
  }
}

function readCanonicalColorList(reader: BinaryReader): CrateColor[] {
  const len = reader.readVLE();
  const out: CrateColor[] = [];
  for (let i = 0; i < len; i++) {
    out.push(canonicalByteToRingColor(reader.readUint8()));
  }
  return out;
}

function writeV4Item(writer: BinaryWriter, item: DepotQueueItem): void {
  writer.writeUint8(ringColorToCanonicalByte(item.color));
  if (item.value !== undefined) {
    writer.writeUint8(0x01);
    writer.writeSignedVLE(item.value);
  } else {
    writer.writeUint8(0x00);
  }
}

function readV4Item(reader: BinaryReader): DepotQueueItem {
  const color = canonicalByteToRingColor(reader.readUint8());
  const valueFlags = reader.readUint8();
  if ((valueFlags & 0x01) !== 0) {
    const value = reader.readSignedVLE();
    return { color, value };
  }
  return { color };
}

function writeV4ItemList(writer: BinaryWriter, list: readonly DepotQueueItem[]): void {
  writer.writeVLE(list.length);
  for (const item of list) {
    writeV4Item(writer, item);
  }
}

function readV4ItemList(reader: BinaryReader): DepotQueueItem[] {
  const len = reader.readVLE();
  const out: DepotQueueItem[] = [];
  for (let i = 0; i < len; i++) {
    out.push(readV4Item(reader));
  }
  return out;
}

function writeUtf8String(writer: BinaryWriter, text: string): void {
  const bytes = new TextEncoder().encode(text);
  writer.writeVLE(bytes.length);
  writer.writeBytes(bytes);
}

function readUtf8String(reader: BinaryReader): string {
  const len = reader.readVLE();
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = reader.readUint8();
  }
  return new TextDecoder().decode(bytes);
}

function writeQueueItemList(writer: BinaryWriter, list: readonly DepotQueueItem[]): void {
  writer.writeVLE(list.length);
  for (const item of list) {
    const colorByte = crateColorToByte(item.color);
    const damagedBit = item.damaged ? 0x80 : 0x00;
    writer.writeUint8(colorByte | damagedBit);
  }
}

function readQueueItemList(reader: BinaryReader): DepotQueueItem[] {
  const len = reader.readVLE();
  const out: DepotQueueItem[] = [];
  for (let i = 0; i < len; i++) {
    const raw = reader.readUint8();
    const color = byteToCrateColor(raw & 0x0f);
    const damaged = (raw & 0x80) !== 0;
    out.push({ color, damaged: damaged || undefined });
  }
  return out;
}

function writeDepotStateV4(writer: BinaryWriter, state: DepotState): void {
  const activeMask = getEffectiveActiveStationsMask(state);
  const initStacks = cloneStacks(state.initialStacks ?? state.stacks);
  const initQueue = cloneQueue(state.initialQueue ?? state.queue);
  const initInput = cloneQueue(state.initialInput ?? state.input ?? []);
  const hasExtendedRules =
    state.mode !== undefined ||
    state.requireEmptyStacks !== undefined ||
    state.allowNonEmptyInput !== undefined ||
    state.exactOutputCount !== undefined;

  let v4Flags = 0;
  if (state.targetStacks) v4Flags |= 0x01;
  if (state.targetOutput && state.targetOutput.length > 0) v4Flags |= 0x02;
  if (initQueue.length > 0) v4Flags |= 0x04;
  if (initInput.length > 0) v4Flags |= 0x08;
  if (state.enforceHanoiRule) v4Flags |= 0x20;
  if (hasExtendedRules) v4Flags |= 0x80;

  writer.writeUint8(v4Flags);
  writer.writeUint8(activeMask & 0x7f);

  // Claw descriptor(s) (1 claw in Phase 2)
  writer.writeUint8(1);
  writer.writeUint8(stationToCode(state.initialWorkerStation ?? state.workerStation));
  if (state.heldCrate !== null) {
    writer.writeUint8(1);
    writeV4Item(writer, {
      color: state.heldCrate,
      ...(state.heldValue !== undefined ? { value: state.heldValue } : {}),
    });
  } else {
    writer.writeUint8(0);
  }

  // Station payloads keyed by activeStationsMask bits (STACK_1..3, QUEUE, INPUT)
  if ((activeMask & DEPOT_STATION_BITS.STACK_1) !== 0) {
    writeCanonicalColorList(writer, initStacks[0]);
  }
  if ((activeMask & DEPOT_STATION_BITS.STACK_2) !== 0) {
    writeCanonicalColorList(writer, initStacks[1]);
  }
  if ((activeMask & DEPOT_STATION_BITS.STACK_3) !== 0) {
    writeCanonicalColorList(writer, initStacks[2]);
  }
  if ((activeMask & DEPOT_STATION_BITS.QUEUE) !== 0) {
    writeV4ItemList(writer, initQueue);
  }
  if ((activeMask & DEPOT_STATION_BITS.INPUT) !== 0) {
    writeV4ItemList(writer, initInput);
  }

  // Target configurations
  if ((v4Flags & 0x01) !== 0 && state.targetStacks) {
    for (let i = 0; i < 3; i++) {
      writeCanonicalColorList(writer, state.targetStacks[i]);
    }
  }
  if ((v4Flags & 0x02) !== 0 && state.targetOutput) {
    writeCanonicalColorList(writer, state.targetOutput);
  }

  // Extended curriculum rule metadata
  if ((v4Flags & 0x80) !== 0) {
    let ruleBits = 0;
    if (state.mode !== undefined) ruleBits |= 0x01;
    if (state.exactOutputCount !== undefined) ruleBits |= 0x02;
    if (state.requireEmptyStacks !== undefined) {
      ruleBits |= 0x04;
      if (state.requireEmptyStacks) ruleBits |= 0x08;
    }
    if (state.allowNonEmptyInput !== undefined) {
      ruleBits |= 0x10;
      if (state.allowNonEmptyInput) ruleBits |= 0x20;
    }
    writer.writeUint8(ruleBits);
    if ((ruleBits & 0x01) !== 0 && state.mode !== undefined) {
      writeUtf8String(writer, state.mode);
    }
    if ((ruleBits & 0x02) !== 0 && state.exactOutputCount !== undefined) {
      writer.writeVLE(state.exactOutputCount);
    }
  }
}

function readDepotStateV4(reader: BinaryReader): DepotState {
  const v4Flags = reader.readUint8();
  const activeStationsMask = reader.readUint8();
  const enforceHanoiRule = (v4Flags & 0x20) !== 0 ? true : undefined;

  const clawCount = Math.max(1, reader.readUint8());
  let startStation = normalizeDepotStation('STACK_1');
  let heldItem: DepotQueueItem | null = null;
  for (let c = 0; c < clawCount; c++) {
    const st = codeToStation(reader.readUint8());
    const hasHeld = reader.readUint8() !== 0;
    const item = hasHeld ? readV4Item(reader) : null;
    if (c === 0) {
      startStation = st;
      heldItem = item;
    }
  }

  const stack0 =
    (activeStationsMask & DEPOT_STATION_BITS.STACK_1) !== 0
      ? readCanonicalColorList(reader)
      : [];
  const stack1 =
    (activeStationsMask & DEPOT_STATION_BITS.STACK_2) !== 0
      ? readCanonicalColorList(reader)
      : [];
  const stack2 =
    (activeStationsMask & DEPOT_STATION_BITS.STACK_3) !== 0
      ? readCanonicalColorList(reader)
      : [];
  const initialStacks: DepotStacks = [stack0, stack1, stack2];

  const queue =
    (activeStationsMask & DEPOT_STATION_BITS.QUEUE) !== 0 ? readV4ItemList(reader) : [];
  const input =
    (activeStationsMask & DEPOT_STATION_BITS.INPUT) !== 0 ? readV4ItemList(reader) : [];
  if ((activeStationsMask & DEPOT_STATION_BITS.PHYSICAL_TAPE) !== 0) {
    readV4ItemList(reader);
  }

  let targetStacks: DepotStacks | undefined;
  if ((v4Flags & 0x01) !== 0) {
    targetStacks = [
      readCanonicalColorList(reader),
      readCanonicalColorList(reader),
      readCanonicalColorList(reader),
    ];
  }
  let targetOutput: CrateColor[] | undefined;
  if ((v4Flags & 0x02) !== 0) {
    targetOutput = readCanonicalColorList(reader);
  }

  let mode: string | undefined;
  let exactOutputCount: number | undefined;
  let requireEmptyStacks: boolean | undefined;
  let allowNonEmptyInput: boolean | undefined;
  if ((v4Flags & 0x80) !== 0) {
    const ruleBits = reader.readUint8();
    if ((ruleBits & 0x01) !== 0) {
      mode = readUtf8String(reader);
    }
    if ((ruleBits & 0x02) !== 0) {
      exactOutputCount = reader.readVLE();
    }
    if ((ruleBits & 0x04) !== 0) {
      requireEmptyStacks = (ruleBits & 0x08) !== 0;
    }
    if ((ruleBits & 0x10) !== 0) {
      allowNonEmptyInput = (ruleBits & 0x20) !== 0;
    }
  }

  const base = createInitialDepotState({
    initialStacks,
    stacks: initialStacks,
    initialWorkerStation: startStation,
    workerStation: startStation,
    targetStacks,
    targetOutput,
    queue,
    initialQueue: queue,
    ...(input.length > 0 || (activeStationsMask & DEPOT_STATION_BITS.INPUT) !== 0
      ? { input, initialInput: input }
      : {}),
    activeStationsMask,
    ...(mode !== undefined ? { mode } : {}),
    ...(enforceHanoiRule !== undefined ? { enforceHanoiRule } : {}),
    ...(requireEmptyStacks !== undefined ? { requireEmptyStacks } : {}),
    ...(allowNonEmptyInput !== undefined ? { allowNonEmptyInput } : {}),
    ...(exactOutputCount !== undefined ? { exactOutputCount } : {}),
  });

  if (heldItem) {
    return {
      ...base,
      heldCrate: heldItem.color,
      ...(heldItem.value !== undefined ? { heldValue: heldItem.value } : {}),
    };
  }
  return base;
}

export function writeDepotState(
  writer: BinaryWriter,
  state?: DepotState,
  envVersion?: number
): void {
  if (!state) {
    writer.writeUint8(0x00);
    return;
  }
  const version = envVersion ?? getDepotSerializationVersion(state);
  if (version >= ENV_VERSION_DEPOT_V4) {
    writeDepotStateV4(writer, state);
    return;
  }

  let flags = 0x01; // has state
  if (state.targetStacks) flags |= 0x02;
  if (state.targetOutput && state.targetOutput.length > 0) flags |= 0x04;
  if (version >= ENV_VERSION_DEPOT_QUEUE) {
    if (state.queue.length > 0 || state.initialQueue.length > 0) flags |= 0x08;
  }
  writer.writeUint8(flags);

  if (version >= ENV_VERSION_DEPOT_QUEUE) {
    writer.writeUint8(stationToCode(state.initialWorkerStation ?? state.workerStation));
  } else {
    writer.writeUint8(stationToIndex(state.initialWorkerStation ?? state.workerStation));
  }

  const initStacks = cloneStacks(state.initialStacks ?? state.stacks);
  for (let i = 0; i < 3; i++) {
    writeCrateList(writer, initStacks[i]);
  }
  if (state.targetStacks) {
    for (let i = 0; i < 3; i++) {
      writeCrateList(writer, state.targetStacks[i]);
    }
  }
  if (state.targetOutput && state.targetOutput.length > 0) {
    writeCrateList(writer, state.targetOutput);
  }

  // Version 3 (M5 FIFO Queue & legacy SCRAP compat)
  if (version >= ENV_VERSION_DEPOT_QUEUE) {
    const initQueue = cloneQueue(state.initialQueue ?? state.queue);
    writeQueueItemList(writer, initQueue);
    writer.writeVLE(state.scrapCount ?? 0);
  }
}

export function readDepotState(
  reader: BinaryReader,
  envVersion: number = ENV_VERSION_DEPOT_STATE
): DepotState {
  if (envVersion >= ENV_VERSION_DEPOT_V4) {
    return readDepotStateV4(reader);
  }

  const flags = reader.readUint8();
  if ((flags & 0x01) === 0) {
    return createInitialDepotState();
  }

  const stationByte = reader.readUint8();
  const startStation =
    envVersion >= ENV_VERSION_DEPOT_QUEUE
      ? codeToStation(stationByte)
      : indexToStation(stationByte);

  const initialStacks: DepotStacks = [
    readCrateList(reader),
    readCrateList(reader),
    readCrateList(reader),
  ];
  let targetStacks: DepotStacks | undefined;
  if ((flags & 0x02) !== 0) {
    targetStacks = [
      readCrateList(reader),
      readCrateList(reader),
      readCrateList(reader),
    ];
  }
  let targetOutput: CrateColor[] | undefined;
  if ((flags & 0x04) !== 0) {
    targetOutput = readCrateList(reader);
  }

  let queue: DepotQueueItem[] = [];
  let scrapCount = 0;
  if (envVersion >= ENV_VERSION_DEPOT_QUEUE) {
    queue = readQueueItemList(reader);
    scrapCount = reader.readVLE();
  }

  return createInitialDepotState({
    initialStacks,
    stacks: initialStacks,
    initialWorkerStation: startStation,
    workerStation: startStation,
    targetStacks,
    targetOutput,
    queue,
    initialQueue: queue,
    scrapCount,
  });
}

export function getDepotOpcodeForBlock(block: CodeBlock): number {
  switch (block.type) {
    case 'DEPOT_MOVE_TO':
      return OP_DEPOT_MOVE_TO;
    case 'DEPOT_GRAB':
      return OP_DEPOT_GRAB;
    case 'DEPOT_PLACE':
      return OP_DEPOT_PLACE;
    case 'DEPOT_SEND_OUT':
      return OP_DEPOT_SEND_OUT;
    case 'DEPOT_SEND_GATE':
      return OP_DEPOT_SEND_GATE;
    default:
      throw new Error(`Unsupported Depot action block type: ${block.type}`);
  }
}

export function getDepotParamVarFlags(
  opcode: number,
  params?: Record<string, any>
): { param0IsVar: boolean; param1IsVar: boolean } {
  if (!params) return { param0IsVar: false, param1IsVar: false };
  if (opcode === OP_DEPOT_MOVE_TO) {
    return { param0IsVar: isVarVal(params.station), param1IsVar: false };
  }
  if (opcode === OP_DEPOT_SEND_GATE) {
    return { param0IsVar: isVarVal(params.gate), param1IsVar: false };
  }
  return { param0IsVar: false, param1IsVar: false };
}

export function writeDepotParams(
  writer: BinaryWriter,
  opcode: number,
  params?: Record<string, any>,
  paramVarMask: number = 0
): void {
  if (opcode === OP_DEPOT_MOVE_TO) {
    if ((paramVarMask & 0x02) !== 0) {
      writer.writeUint8(varNameToIndex(String(params?.station ?? 'a')));
    } else {
      writer.writeUint8(stationToCode(normalizeDepotStation(params?.station)));
    }
  } else if (opcode === OP_DEPOT_SEND_GATE) {
    if ((paramVarMask & 0x02) !== 0) {
      writer.writeUint8(varNameToIndex(String(params?.gate ?? 'a')));
    } else {
      writer.writeUint8(gateToCode(params?.gate));
    }
  }
}

export function readDepotBlock(
  reader: BinaryReader,
  opcode: number,
  paramVarMask: number = 0
): Omit<CodeBlock, 'id' | 'repeatCount'> {
  switch (opcode) {
    case OP_DEPOT_MOVE_TO: {
      const station =
        (paramVarMask & 0x02) !== 0
          ? indexToVarName(reader.readUint8())
          : codeToStation(reader.readUint8());
      return { type: 'DEPOT_MOVE_TO', params: { station } };
    }
    case OP_DEPOT_GRAB:
      return { type: 'DEPOT_GRAB' };
    case OP_DEPOT_PLACE:
      return { type: 'DEPOT_PLACE' };
    case OP_DEPOT_SEND_OUT:
      return { type: 'DEPOT_SEND_OUT' };
    case OP_DEPOT_SEND_GATE: {
      const gate =
        (paramVarMask & 0x02) !== 0
          ? indexToVarName(reader.readUint8())
          : codeToGate(reader.readUint8());
      return { type: 'DEPOT_SEND_GATE', params: { gate } };
    }
    default:
      throw new Error(`Unknown Depot opcode: 0x${opcode.toString(16)}`);
  }
}
