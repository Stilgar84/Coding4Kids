import { CodeBlock, isVariableName } from '../../../types';
import {
  CrateColor,
  DEPOT_CRATE_COLORS,
  DEPOT_CRATE_PALETTE,
  DepotStacks,
  DepotState,
} from '../../../simulations/depot/types';
import {
  cloneStacks,
  createInitialDepotState,
  indexToStation,
  normalizeDepotStation,
  stationToIndex,
} from '../../../simulations/depot/depotPhysics';
import { BinaryReader } from '../binaryReader';
import { BinaryWriter } from '../binaryWriter';
import {
  OP_DEPOT_GRAB,
  OP_DEPOT_MOVE_TO,
  OP_DEPOT_PLACE,
  OP_DEPOT_SEND_OUT,
  indexToVarName,
  varNameToIndex,
} from '../types';

function isVarVal(val: unknown): boolean {
  return isVariableName(val) || (typeof val === 'string' && /^[a-z]$/.test(val.trim()));
}

function crateColorToByte(color: CrateColor): number {
  return DEPOT_CRATE_COLORS[color]?.code ?? 0;
}

function byteToCrateColor(byte: number): CrateColor {
  return DEPOT_CRATE_PALETTE[byte]?.id ?? 'RED';
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

export function writeDepotState(writer: BinaryWriter, state?: DepotState): void {
  if (!state) {
    writer.writeUint8(0x00);
    return;
  }
  let flags = 0x01; // has state
  if (state.targetStacks) flags |= 0x02;
  if (state.targetOutput && state.targetOutput.length > 0) flags |= 0x04;
  writer.writeUint8(flags);

  writer.writeUint8(stationToIndex(state.initialWorkerStation ?? state.workerStation));
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
}

export function readDepotState(reader: BinaryReader): DepotState {
  const flags = reader.readUint8();
  if ((flags & 0x01) === 0) {
    return createInitialDepotState();
  }
  const startStation = indexToStation(reader.readUint8());
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
  return createInitialDepotState({
    initialStacks,
    stacks: initialStacks,
    initialWorkerStation: startStation,
    workerStation: startStation,
    targetStacks,
    targetOutput,
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
      writer.writeUint8(stationToIndex(normalizeDepotStation(params?.station)));
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
          : indexToStation(reader.readUint8());
      return { type: 'DEPOT_MOVE_TO', params: { station } };
    }
    case OP_DEPOT_GRAB:
      return { type: 'DEPOT_GRAB' };
    case OP_DEPOT_PLACE:
      return { type: 'DEPOT_PLACE' };
    case OP_DEPOT_SEND_OUT:
      return { type: 'DEPOT_SEND_OUT' };
    default:
      throw new Error(`Unknown Depot opcode: 0x${opcode.toString(16)}`);
  }
}
