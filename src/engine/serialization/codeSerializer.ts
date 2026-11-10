import { WorkspaceState, GridState, CodeBlock, ScopeType, VariableName, isVariableName, BinaryOp } from '../../types';
import { TurtleState } from '../../simulations/turtle/types';
import { createInitialTurtleState } from '../../simulations/turtle/turtleEnvironment';
import { BinaryReader, base64URLToUint8Array } from './binaryReader';
import { BinaryWriter, uint8ArrayToBase64URL } from './binaryWriter';
import {
  FORMAT_VERSION,
  ENV_VERSION_GRID,
  ENV_VERSION_TURTLE,
  ENV_ID_GENERIC,
  ENV_ID_GRID,
  ENV_ID_TURTLE,
  SCOPE_ID_MAIN,
  SCOPE_ID_F1,
  SCOPE_ID_F2,
  SCOPE_ID_F3,
  OP_LOOP_START,
  OP_LOOP_END,
  OP_CALL_FN,
  OP_VAR_ASSIGN,
  OP_VAR_OP,
  MASK_HAS_VAR_PARAM,
  MASK_HAS_REP,
  OPERAND_TYPE_VAR,
  OPERAND_TYPE_POS_INT,
  OPERAND_TYPE_NEG_INT,
  OPERAND_TYPE_DOUBLE,
  opToByte,
  byteToOp,
  varNameToIndex,
  indexToVarName,
  OP_GRID_MOVE_FWD,
  OP_GRID_MOVE_BACK,
  OP_GRID_TURN_LEFT,
  OP_GRID_TURN_RIGHT,
  OP_TURTLE_FORWARD,
  OP_TURTLE_BACKWARD,
  OP_TURTLE_TURN_LEFT,
  OP_TURTLE_TURN_RIGHT,
  OP_TURTLE_ARC_LEFT,
  OP_TURTLE_ARC_RIGHT,
  OP_TURTLE_PEN_UP,
  OP_TURTLE_PEN_DOWN,
  OP_TURTLE_SET_PEN_COLOR,
  OP_TURTLE_SET_PEN_WIDTH,
  OP_TURTLE_FORWARD_LEN,
  OP_TURTLE_BACKWARD_LEN,
  ImportResult,
  EnvIdName,
} from './types';
import { writeGridState, readGridState } from './env/gridSerializer';
import { writeTurtleParams, readTurtleParams } from './env/turtleSerializer';

let blockIdCounter = 0;

function createUniqueBlockId(type: string): string {
  blockIdCounter = (blockIdCounter + 1) % 100000;
  const rand = Math.random().toString(36).substring(2, 6);
  return `${type}_${Date.now()}_${blockIdCounter}_${rand}`;
}

function getOperandType(val: any): number {
  if (val === undefined || val === null) return OPERAND_TYPE_POS_INT;
  if (isVariableName(val) || (typeof val === 'string' && /^[a-z]$/.test(val))) {
    return OPERAND_TYPE_VAR;
  }
  const num = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(num)) return OPERAND_TYPE_POS_INT;
  if (Number.isInteger(num)) {
    return num >= 0 ? OPERAND_TYPE_POS_INT : OPERAND_TYPE_NEG_INT;
  }
  return OPERAND_TYPE_DOUBLE;
}

function writeOperandData(writer: BinaryWriter, type: number, val: any): void {
  if (type === OPERAND_TYPE_VAR) {
    writer.writeUint8(varNameToIndex(val));
  } else if (type === OPERAND_TYPE_POS_INT) {
    const num = typeof val === 'number' ? val : Number(val);
    writer.writeVLE(Math.max(0, Math.round(num)));
  } else if (type === OPERAND_TYPE_NEG_INT) {
    const num = typeof val === 'number' ? val : Number(val);
    writer.writeVLE(Math.abs(Math.round(num)));
  } else {
    const num = typeof val === 'number' ? val : Number(val);
    writer.writeFloat64(num);
  }
}

function readOperandData(reader: BinaryReader, type: number): any {
  if (type === OPERAND_TYPE_VAR) {
    return indexToVarName(reader.readUint8());
  } else if (type === OPERAND_TYPE_POS_INT) {
    return reader.readVLE();
  } else if (type === OPERAND_TYPE_NEG_INT) {
    return -reader.readVLE();
  } else {
    return reader.readFloat64();
  }
}

/**
 * Exports a workspace and optional environment state to a raw Uint8Array.
 */
export function exportToBinary(
  workspace: WorkspaceState,
  envId: 'grid' | 'turtle' | 'generic',
  envState?: GridState | TurtleState
): Uint8Array {
  const writer = new BinaryWriter();

  // 1. File Header (3 Bytes)
  writer.writeUint8(FORMAT_VERSION);

  const envByte =
    envId === 'grid' ? ENV_ID_GRID : envId === 'turtle' ? ENV_ID_TURTLE : ENV_ID_GENERIC;
  writer.writeUint8(envByte);

  const envVersion = envId === 'grid' ? ENV_VERSION_GRID : ENV_VERSION_TURTLE;
  writer.writeUint8(envVersion);

  // 2. Environment State (if Grid)
  if (envByte === ENV_ID_GRID && envState && 'width' in envState) {
    writeGridState(writer, envState as GridState);
  }

  // 3. Code Payload
  const scopes: readonly ScopeType[] = ['MAIN', 'F1', 'F2', 'F3'];
  const nonEmptyScopes = scopes.filter((sc) => (workspace[sc]?.length ?? 0) > 0);

  writer.writeVLE(nonEmptyScopes.length);

  for (const scope of nonEmptyScopes) {
    let scopeId: number;
    switch (scope) {
      case 'MAIN':
        scopeId = SCOPE_ID_MAIN;
        break;
      case 'F1':
        scopeId = SCOPE_ID_F1;
        break;
      case 'F2':
        scopeId = SCOPE_ID_F2;
        break;
      case 'F3':
        scopeId = SCOPE_ID_F3;
        break;
    }
    writer.writeUint8(scopeId);

    const blocks = workspace[scope] || [];
    writer.writeVLE(blocks.length);

    for (const block of blocks) {
      if (block.type === 'VAR_ASSIGN') {
        const opcode = OP_VAR_ASSIGN;
        const a = (block.params?.a || 'a') as VariableName;
        const b = block.params?.b ?? 0;
        const typeB = getOperandType(b);
        const paramVarMask = typeB & 0x03;

        writer.writeUint8(opcode);
        writer.writeUint8(paramVarMask);
        writer.writeUint8(varNameToIndex(a));
        writeOperandData(writer, typeB, b);
        continue;
      }

      if (block.type === 'VAR_OP') {
        const opcode = OP_VAR_OP;
        const a = (block.params?.a || 'a') as VariableName;
        const b = block.params?.b ?? 0;
        const op = (block.params?.op || '+') as BinaryOp;
        const c = block.params?.c ?? 0;
        const typeB = getOperandType(b);
        const typeC = getOperandType(c);
        const paramVarMask = (typeB & 0x03) | ((typeC & 0x03) << 2);

        writer.writeUint8(opcode);
        writer.writeUint8(paramVarMask);
        writer.writeUint8(varNameToIndex(a));
        writer.writeUint8(opToByte(op));
        writeOperandData(writer, typeB, b);
        writeOperandData(writer, typeC, c);
        continue;
      }

      let opcode: number;
      let fnIndex = 0;

      // Determine opcode
      if (block.type === 'LOOP_START') {
        opcode = OP_LOOP_START;
      } else if (block.type === 'LOOP_END') {
        opcode = OP_LOOP_END;
      } else if (block.type === 'CALL_F1') {
        opcode = OP_CALL_FN;
        fnIndex = 1;
      } else if (block.type === 'CALL_F2') {
        opcode = OP_CALL_FN;
        fnIndex = 2;
      } else if (block.type === 'CALL_F3') {
        opcode = OP_CALL_FN;
        fnIndex = 3;
      } else if (envByte === ENV_ID_TURTLE) {
        switch (block.type) {
          case 'FORWARD':
            opcode = (block.params && (block.params.length !== undefined || block.params.distance !== undefined))
              ? OP_TURTLE_FORWARD_LEN
              : OP_TURTLE_FORWARD;
            break;
          case 'BACKWARD':
            opcode = (block.params && (block.params.length !== undefined || block.params.distance !== undefined))
              ? OP_TURTLE_BACKWARD_LEN
              : OP_TURTLE_BACKWARD;
            break;
          case 'TURN_LEFT':
            opcode = OP_TURTLE_TURN_LEFT;
            break;
          case 'TURN_RIGHT':
            opcode = OP_TURTLE_TURN_RIGHT;
            break;
          case 'ARC_LEFT':
            opcode = OP_TURTLE_ARC_LEFT;
            break;
          case 'ARC_RIGHT':
            opcode = OP_TURTLE_ARC_RIGHT;
            break;
          case 'PEN_UP':
            opcode = OP_TURTLE_PEN_UP;
            break;
          case 'PEN_DOWN':
            opcode = OP_TURTLE_PEN_DOWN;
            break;
          case 'SET_PEN_COLOR':
            opcode = OP_TURTLE_SET_PEN_COLOR;
            break;
          case 'SET_PEN_WIDTH':
            opcode = OP_TURTLE_SET_PEN_WIDTH;
            break;
          default:
            throw new Error(`Unsupported Turtle block type: ${block.type}`);
        }
      } else {
        // Grid or generic
        switch (block.type) {
          case 'MOVE_FWD':
            opcode = OP_GRID_MOVE_FWD;
            break;
          case 'MOVE_BACK':
            opcode = OP_GRID_MOVE_BACK;
            break;
          case 'TURN_LEFT':
            opcode = OP_GRID_TURN_LEFT;
            break;
          case 'TURN_RIGHT':
            opcode = OP_GRID_TURN_RIGHT;
            break;
          default:
            throw new Error(`Unsupported Grid block type: ${block.type}`);
        }
      }

      // Check if repeat count or any parameters are variables
      const repIsVar = isVariableName(block.repeatCount) || (typeof block.repeatCount === 'string' && /^[a-z]$/.test(block.repeatCount));
      const hasRep =
        block.type === 'LOOP_START'
          ? block.repeatCount !== undefined && (repIsVar || (block.repeatCount as number) > 0)
          : block.repeatCount !== undefined && (repIsVar || (block.repeatCount as number) > 1);

      let param0IsVar = false;
      let param1IsVar = false;
      if (block.params) {
        if (block.type === 'FORWARD' || block.type === 'BACKWARD') {
          const lenVal = block.params.length ?? block.params.distance;
          param0IsVar = isVariableName(lenVal) || (typeof lenVal === 'string' && /^[a-z]$/.test(lenVal));
        } else if (block.type === 'TURN_LEFT' || block.type === 'TURN_RIGHT') {
          param0IsVar = isVariableName(block.params.angle) || (typeof block.params.angle === 'string' && /^[a-z]$/.test(block.params.angle));
        } else if (block.type === 'ARC_LEFT' || block.type === 'ARC_RIGHT') {
          param0IsVar = isVariableName(block.params.radius) || (typeof block.params.radius === 'string' && /^[a-z]$/.test(block.params.radius));
          param1IsVar = isVariableName(block.params.angle) || (typeof block.params.angle === 'string' && /^[a-z]$/.test(block.params.angle));
        } else if (block.type === 'SET_PEN_WIDTH') {
          param0IsVar = isVariableName(block.params.width) || (typeof block.params.width === 'string' && /^[a-z]$/.test(block.params.width));
        }
      }

      const hasVar = (hasRep && repIsVar) || param0IsVar || param1IsVar;
      let paramVarMask = 0;
      if (hasVar) {
        if (hasRep && repIsVar) paramVarMask |= 0x01;
        if (param0IsVar) paramVarMask |= 0x02;
        if (param1IsVar) paramVarMask |= 0x04;
      }

      const headerByte = (hasVar ? MASK_HAS_VAR_PARAM : 0x00) | (hasRep ? MASK_HAS_REP : 0x00) | (opcode & 0x1f);
      writer.writeUint8(headerByte);

      if (hasVar) {
        writer.writeUint8(paramVarMask);
      }

      if (hasRep) {
        if (repIsVar) {
          writer.writeUint8(varNameToIndex(block.repeatCount as VariableName));
        } else {
          writer.writeVLE(block.repeatCount as number);
        }
      }

      // Write parameters
      if (opcode === OP_CALL_FN) {
        writer.writeUint8(fnIndex);
      } else if (envByte === ENV_ID_TURTLE) {
        writeTurtleParams(writer, opcode, block.params, paramVarMask);
      }
    }
  }

  return writer.getBytes();
}

/**
 * Exports a workspace and optional environment state to a Base64URL string.
 */
export function exportToString(
  workspace: WorkspaceState,
  envId: 'grid' | 'turtle' | 'generic',
  envState?: GridState | TurtleState
): string {
  return uint8ArrayToBase64URL(exportToBinary(workspace, envId, envState));
}

/**
 * Imports a raw Uint8Array into an ImportResult.
 */
export function importFromBinary(bytes: Uint8Array): ImportResult {
  if (!bytes || bytes.length === 0) {
    return { success: false, error: 'Empty binary input' };
  }

  try {
    const reader = new BinaryReader(bytes);
    if (reader.remaining < 3) {
      return { success: false, error: 'Input too short: missing header' };
    }

    // 1. File Header
    const formatVersion = reader.readUint8();
    if (formatVersion !== FORMAT_VERSION) {
      return { success: false, error: `Unsupported format version: ${formatVersion}` };
    }

    const envByte = reader.readUint8();
    const envVersion = reader.readUint8();

    let envId: EnvIdName = 'generic';
    if (envByte === ENV_ID_GRID) envId = 'grid';
    else if (envByte === ENV_ID_TURTLE) envId = 'turtle';

    // 2. Environment State
    let gridState: GridState | undefined;
    let turtleState: TurtleState | undefined;

    if (envByte === ENV_ID_GRID) {
      gridState = readGridState(reader);
    } else if (envByte === ENV_ID_TURTLE) {
      turtleState = createInitialTurtleState();
    }

    // 3. Code Payload
    const workspace: WorkspaceState = {
      MAIN: [],
      F1: [],
      F2: [],
      F3: [],
    };

    if (reader.hasMore) {
      const scopeCount = reader.readVLE();
      for (let s = 0; s < scopeCount; s++) {
        const scopeByte = reader.readUint8();
        let scope: ScopeType;
        if (scopeByte === SCOPE_ID_MAIN) scope = 'MAIN';
        else if (scopeByte === SCOPE_ID_F1) scope = 'F1';
        else if (scopeByte === SCOPE_ID_F2) scope = 'F2';
        else if (scopeByte === SCOPE_ID_F3) scope = 'F3';
        else {
          throw new Error(`Unknown scope ID: 0x${scopeByte.toString(16)}`);
        }

        const blockCount = reader.readVLE();
        const blocks: CodeBlock[] = [];

        for (let b = 0; b < blockCount; b++) {
          const blockHeader = reader.readUint8();
          const hasVar = (blockHeader & MASK_HAS_VAR_PARAM) !== 0;
          const hasRep = (blockHeader & MASK_HAS_REP) !== 0;
          const opcode = blockHeader & 0x1f;

          let paramVarMask = 0;
          if (opcode === OP_VAR_ASSIGN || opcode === OP_VAR_OP) {
            paramVarMask = reader.readUint8();
          } else if (hasVar) {
            paramVarMask = reader.readUint8();
          }

          let repeatCount: number | VariableName | undefined;
          if (hasRep) {
            if (hasVar && (paramVarMask & 0x01) !== 0) {
              repeatCount = indexToVarName(reader.readUint8());
            } else {
              repeatCount = reader.readVLE();
            }
          }

          let type = '';
          let params: Record<string, any> | undefined;

          if (opcode === OP_VAR_ASSIGN) {
            type = 'VAR_ASSIGN';
            const a = indexToVarName(reader.readUint8());
            const typeB = paramVarMask & 0x03;
            const bVal = readOperandData(reader, typeB);
            params = { a, b: bVal };
          } else if (opcode === OP_VAR_OP) {
            type = 'VAR_OP';
            const a = indexToVarName(reader.readUint8());
            const opByte = reader.readUint8();
            const op = byteToOp(opByte);
            const typeB = paramVarMask & 0x03;
            const typeC = (paramVarMask >> 2) & 0x03;
            const bVal = readOperandData(reader, typeB);
            const cVal = readOperandData(reader, typeC);
            params = { a, b: bVal, op, c: cVal };
          } else if (opcode === OP_LOOP_START) {
            type = 'LOOP_START';
          } else if (opcode === OP_LOOP_END) {
            type = 'LOOP_END';
          } else if (opcode === OP_CALL_FN) {
            const fnIndex = reader.readUint8();
            type = fnIndex === 1 ? 'CALL_F1' : fnIndex === 2 ? 'CALL_F2' : 'CALL_F3';
          } else if (envByte === ENV_ID_TURTLE) {
            switch (opcode) {
              case OP_TURTLE_FORWARD:
              case OP_TURTLE_FORWARD_LEN:
                type = 'FORWARD';
                break;
              case OP_TURTLE_BACKWARD:
              case OP_TURTLE_BACKWARD_LEN:
                type = 'BACKWARD';
                break;
              case OP_TURTLE_TURN_LEFT:
                type = 'TURN_LEFT';
                break;
              case OP_TURTLE_TURN_RIGHT:
                type = 'TURN_RIGHT';
                break;
              case OP_TURTLE_ARC_LEFT:
                type = 'ARC_LEFT';
                break;
              case OP_TURTLE_ARC_RIGHT:
                type = 'ARC_RIGHT';
                break;
              case OP_TURTLE_PEN_UP:
                type = 'PEN_UP';
                break;
              case OP_TURTLE_PEN_DOWN:
                type = 'PEN_DOWN';
                break;
              case OP_TURTLE_SET_PEN_COLOR:
                type = 'SET_PEN_COLOR';
                break;
              case OP_TURTLE_SET_PEN_WIDTH:
                type = 'SET_PEN_WIDTH';
                break;
              default:
                throw new Error(`Unknown Turtle opcode: 0x${opcode.toString(16)}`);
            }
            params = readTurtleParams(reader, opcode, paramVarMask);
          } else {
            // Grid or generic
            switch (opcode) {
              case OP_GRID_MOVE_FWD:
                type = 'MOVE_FWD';
                break;
              case OP_GRID_MOVE_BACK:
                type = 'MOVE_BACK';
                break;
              case OP_GRID_TURN_LEFT:
                type = 'TURN_LEFT';
                break;
              case OP_GRID_TURN_RIGHT:
                type = 'TURN_RIGHT';
                break;
              default:
                throw new Error(`Unknown Grid opcode: 0x${opcode.toString(16)}`);
            }
          }

          const id = createUniqueBlockId(type);
          blocks.push({
            id,
            type,
            repeatCount,
            params,
          });
        }

        workspace[scope] = blocks;
      }
    }

    return {
      success: true,
      formatVersion,
      envId,
      envVersion,
      workspace,
      gridState,
      turtleState,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to deserialize code',
    };
  }
}

/**
 * Imports a Base64URL string into an ImportResult.
 */
export function importFromString(serialized: string): ImportResult {
  if (!serialized || typeof serialized !== 'string' || !serialized.trim()) {
    return { success: false, error: 'Empty serialized input' };
  }

  try {
    const bytes = base64URLToUint8Array(serialized.trim());
    return importFromBinary(bytes);
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to decode Base64URL string',
    };
  }
}
