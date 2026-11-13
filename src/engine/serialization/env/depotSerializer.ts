import { CodeBlock, isVariableName } from '../../../types';
import {
  CrateColor,
  DEPOT_CRATE_COLORS,
  DEPOT_CRATE_PALETTE,
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
  indexToStation,
  normalizeDepotStation,
  stationToCode,
  stationToIndex,
} from '../../../simulations/depot/depotPhysics';
import { BinaryReader } from '../binaryReader';
import { BinaryWriter } from '../binaryWriter';
import {
  ENV_VERSION_DEPOT_QUEUE,
  ENV_VERSION_DEPOT_STATE,
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
  return DEPOT_CRATE_COLORS[color]?.code ?? 0;
}

export function byteToCrateColor(byte: number): CrateColor {
  return DEPOT_CRATE_PALETTE[byte & 0x0f]?.id ?? 'RED';
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

export function writeDepotState(
  writer: BinaryWriter,
  state?: DepotState,
  envVersion?: number
): void {
  if (!state) {
    writer.writeUint8(0x00);
    return;
  }
  const version =
    envVersion ??
    (depotStateNeedsQueueVersion(state) ? ENV_VERSION_DEPOT_QUEUE : ENV_VERSION_DEPOT_STATE);

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

  // Version 3 (M5 FIFO Queue & Gate state)
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
