import { WorkspaceState, CodeBlock, ScopeType, VariableName, isVariableName, BinaryOp } from '../../types';
import { BinaryReader } from './binaryReader';
import { BinaryWriter } from './binaryWriter';
import {
  ENV_ID_TURTLE,
  ENV_ID_BEAT,
  ENV_ID_DEPOT,
  ENV_ID_SWITCHYARD,
  SCOPE_ID_MAIN,
  SCOPE_ID_F1,
  SCOPE_ID_F2,
  SCOPE_ID_F3,
  SCOPE_ID_ON_TAP,
  SCOPE_ID_ON_KEY_UP,
  SCOPE_ID_ON_KEY_DOWN,
  SCOPE_ID_ON_KEY_LEFT,
  SCOPE_ID_ON_KEY_RIGHT,
  SCOPE_ID_ON_KEY_A,
  SCOPE_ID_ON_KEY_B,
  OP_LOOP_START,
  OP_LOOP_END,
  OP_CALL_FN,
  OP_IF,
  OP_ELSE,
  OP_END_IF,
  OP_WHILE,
  OP_END_WHILE,
  OP_VAR_ASSIGN,
  OP_VAR_OP,
  OP_PLACEHOLDER,
  placeholderHintCategoryToCode,
  codeToPlaceholderHintCategory,
  MASK_HAS_VAR_PARAM,
  MASK_HAS_REP,
  MASK_ELSE_HAS_COND,
  opToByte,
  byteToOp,
  varNameToIndex,
  indexToVarName,
  encodeVarOrSensorIndex,
  decodeVarOrSensorIndex,
  isSensorRefString,
  OP_GRID_MOVE_FWD,
  OP_GRID_MOVE_BACK,
  OP_GRID_TURN_LEFT,
  OP_GRID_TURN_RIGHT,
  OP_GRID_PICK_UP,
  OP_GRID_USE_DROP,
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
  OP_TURTLE_WAIT,
  OP_TURTLE_SET_INSTANT,
  OP_TURTLE_CLEAR_CANVAS,
  OP_TURTLE_TELEPORT,
} from './types';
import {
  writeConditionExpr,
  readConditionExpr,
  getOperandType,
  writeOperandData,
  readOperandData,
} from './conditionSerializer';
import { writeTurtleParams, readTurtleParams } from './env/turtleSerializer';
import {
  getBeatOpcodeForBlock,
  getBeatParamVarFlags,
  writeBeatParams,
  readBeatBlock,
} from './env/beatSerializer';
import {
  getDepotOpcodeForBlock,
  getDepotParamVarFlags,
  writeDepotParams,
  readDepotBlock,
  readDepotState,
} from './env/depotSerializer';
import {
  getSwitchyardOpcodeForBlock,
  getSwitchyardParamVarFlags,
  writeSwitchyardParams,
  readSwitchyardBlock,
} from './env/switchyardSerializer';

let blockIdCounter = 0;

function isVarOrSensorVal(v: unknown): boolean {
  return typeof v === 'string' && (isVariableName(v) || isSensorRefString(v));
}

function createUniqueBlockId(type: string): string {
  blockIdCounter = (blockIdCounter + 1) % 100000;
  const rand = Math.random().toString(36).substring(2, 6);
  return `${type}_${Date.now()}_${blockIdCounter}_${rand}`;
}

export const ALL_SERIALIZABLE_SCOPES: readonly ScopeType[] = [
  'MAIN',
  'F1',
  'F2',
  'F3',
  'ON_TAP',
  'ON_KEY_UP',
  'ON_KEY_DOWN',
  'ON_KEY_LEFT',
  'ON_KEY_RIGHT',
  'ON_KEY_A',
  'ON_KEY_B',
];

export const SCOPE_TO_ID_MAP: Record<ScopeType, number> = {
  MAIN: SCOPE_ID_MAIN,
  F1: SCOPE_ID_F1,
  F2: SCOPE_ID_F2,
  F3: SCOPE_ID_F3,
  ON_TAP: SCOPE_ID_ON_TAP,
  ON_KEY_UP: SCOPE_ID_ON_KEY_UP,
  ON_KEY_DOWN: SCOPE_ID_ON_KEY_DOWN,
  ON_KEY_LEFT: SCOPE_ID_ON_KEY_LEFT,
  ON_KEY_RIGHT: SCOPE_ID_ON_KEY_RIGHT,
  ON_KEY_A: SCOPE_ID_ON_KEY_A,
  ON_KEY_B: SCOPE_ID_ON_KEY_B,
};

export const ID_TO_SCOPE_MAP: Record<number, ScopeType> = {
  [SCOPE_ID_MAIN]: 'MAIN',
  [SCOPE_ID_F1]: 'F1',
  [SCOPE_ID_F2]: 'F2',
  [SCOPE_ID_F3]: 'F3',
  [SCOPE_ID_ON_TAP]: 'ON_TAP',
  [SCOPE_ID_ON_KEY_UP]: 'ON_KEY_UP',
  [SCOPE_ID_ON_KEY_DOWN]: 'ON_KEY_DOWN',
  [SCOPE_ID_ON_KEY_LEFT]: 'ON_KEY_LEFT',
  [SCOPE_ID_ON_KEY_RIGHT]: 'ON_KEY_RIGHT',
  [SCOPE_ID_ON_KEY_A]: 'ON_KEY_A',
  [SCOPE_ID_ON_KEY_B]: 'ON_KEY_B',
};

/**
 * Encodes all non-empty workspace scopes (`MAIN`, `F1`, `F2`, `F3`, `ON_*`) into `writer`
 * using the opcode table governed by `envByte` (`0x00`/`0x01` Grid, `0x02` Turtle, `0x03` Beat).
 * Shared identically by Path A (`SavedProgramEntry` code-only saves), Path B (`ENV_ID_LESSON = 0x04`),
 * and Whole-Profile Backup autosaves (`ENV_ID_PROFILE = 0x06`).
 */
export function writeCodeScopes(
  writer: BinaryWriter,
  workspace: WorkspaceState,
  envByte: number
): void {
  const nonEmptyScopes = ALL_SERIALIZABLE_SCOPES.filter((sc) => (workspace[sc]?.length ?? 0) > 0);

  writer.writeVLE(nonEmptyScopes.length);

  for (const scope of nonEmptyScopes) {
    const scopeId = SCOPE_TO_ID_MAP[scope] ?? SCOPE_ID_MAIN;
    writer.writeUint8(scopeId);

    const blocks = workspace[scope] || [];
    writer.writeVLE(blocks.length);

    for (const block of blocks) {
      if (block.type === 'VAR_ASSIGN') {
        const opcode = OP_VAR_ASSIGN;
        const a = (block.params?.a ?? block.params?.varName ?? 'a') as VariableName;
        const b = block.params?.b ?? block.params?.value ?? 0;
        const typeB = getOperandType(b);
        // operandDescMask (Byte 1) for VAR_ASSIGN: bits 1..0 = typeB (§6.2)
        // Byte 0 = raw 0x07 — HasVarParam=0, HasRep=0 (never set for VAR_ASSIGN/VAR_OP)
        const operandDescMask = typeB & 0x03;

        writer.writeUint8(opcode);
        writer.writeUint8(operandDescMask);
        writer.writeUint8(varNameToIndex(a));
        writeOperandData(writer, typeB, b);
        continue;
      }

      if (block.type === 'VAR_OP') {
        const opcode = OP_VAR_OP;
        const a = (block.params?.a ?? block.params?.varName ?? 'a') as VariableName;
        const b = block.params?.b ?? block.params?.left ?? block.params?.value ?? 0;
        const op = (block.params?.op || '+') as BinaryOp;
        const c = block.params?.c ?? block.params?.right ?? 0;
        const typeB = getOperandType(b);
        const typeC = getOperandType(c);
        // operandDescMask (Byte 1) for VAR_OP: bits 1..0 = typeB, bits 3..2 = typeC (§6.2)
        // Byte 0 = raw 0x08 — HasVarParam=0, HasRep=0 (never set for VAR_ASSIGN/VAR_OP)
        const operandDescMask = (typeB & 0x03) | ((typeC & 0x03) << 2);

        writer.writeUint8(opcode);
        writer.writeUint8(operandDescMask);
        writer.writeUint8(varNameToIndex(a));
        writer.writeUint8(opToByte(op));
        writeOperandData(writer, typeB, b);
        writeOperandData(writer, typeC, c);
        continue;
      }

      if (block.type === 'PLACEHOLDER') {
        const hintCode = placeholderHintCategoryToCode(
          block.params?.hintCategory,
          block.params?.rawHintCategoryCode
        );
        writer.writeUint8(OP_PLACEHOLDER);
        writer.writeVLE(hintCode);
        continue;
      }

      // --- Conditional & While Control Flow (OP_IF 0x04, OP_ELSE/ELSE_IF 0x05/0x25, OP_END_IF 0x06,
      //                                       OP_WHILE 0x0A, OP_END_WHILE 0x0B) ---
      if (block.type === 'IF') {
        // OP_IF = 0x04 (raw, bits 7..5 = 0, no HasVarParam/HasRep), followed by ConditionExpr
        writer.writeUint8(OP_IF);
        const condition = block.params?.condition;
        if (condition && typeof condition === 'object') {
          writeConditionExpr(writer, condition as any, { envByte });
        } else {
          // Fallback: write pathAhead sensor tag 0x01
          writer.writeUint8(0x01);
        }
        continue;
      }

      if (block.type === 'ELSE_IF') {
        // ELSE_IF = 0x25 (OP_ELSE=0x05 | MASK_ELSE_HAS_COND=0x20), followed by ConditionExpr
        writer.writeUint8(OP_ELSE | MASK_ELSE_HAS_COND);
        const condition = block.params?.condition;
        if (condition && typeof condition === 'object') {
          writeConditionExpr(writer, condition as any, { envByte });
        } else {
          writer.writeUint8(0x01);
        }
        continue;
      }

      if (block.type === 'ELSE') {
        // Plain ELSE = 0x05, 0 parameter bytes (1 byte total)
        writer.writeUint8(OP_ELSE);
        continue;
      }

      if (block.type === 'END_IF') {
        // OP_END_IF = 0x06, 0 parameter bytes (1 byte total)
        writer.writeUint8(OP_END_IF);
        continue;
      }

      if (block.type === 'WHILE') {
        // OP_WHILE = 0x0A (raw), followed by ConditionExpr
        writer.writeUint8(OP_WHILE);
        const condition = block.params?.condition;
        if (condition && typeof condition === 'object') {
          writeConditionExpr(writer, condition as any, { envByte });
        } else {
          writer.writeUint8(0x01);
        }
        continue;
      }

      if (block.type === 'END_WHILE') {
        // OP_END_WHILE = 0x0B, 0 parameter bytes (1 byte total)
        writer.writeUint8(OP_END_WHILE);
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
            opcode =
              block.params &&
              (block.params.length !== undefined || block.params.distance !== undefined)
                ? OP_TURTLE_FORWARD_LEN
                : OP_TURTLE_FORWARD;
            break;
          case 'BACKWARD':
            opcode =
              block.params &&
              (block.params.length !== undefined || block.params.distance !== undefined)
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
          case 'WAIT':
            opcode = OP_TURTLE_WAIT;
            break;
          case 'SET_INSTANT':
            opcode = OP_TURTLE_SET_INSTANT;
            break;
          case 'CLEAR_CANVAS':
            opcode = OP_TURTLE_CLEAR_CANVAS;
            break;
          case 'TELEPORT':
            opcode = OP_TURTLE_TELEPORT;
            break;
          default:
            throw new Error(`Unsupported Turtle block type: ${block.type}`);
        }
      } else if (envByte === ENV_ID_BEAT) {
        opcode = getBeatOpcodeForBlock(block);
      } else if (envByte === ENV_ID_DEPOT) {
        opcode = getDepotOpcodeForBlock(block);
      } else if (envByte === ENV_ID_SWITCHYARD) {
        opcode = getSwitchyardOpcodeForBlock(block);
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
          case 'PICK_UP':
            opcode = OP_GRID_PICK_UP;
            break;
          case 'USE_DROP':
            opcode = OP_GRID_USE_DROP;
            break;
          default:
            throw new Error(`Unsupported Grid block type: ${block.type}`);
        }
      }

      // Check if repeat count or any parameters are variables
      const repIsVar = isVarOrSensorVal(block.repeatCount);
      const hasRep =
        block.type === 'LOOP_START'
          ? block.repeatCount !== undefined && (repIsVar || (block.repeatCount as number) >= 0)
          : block.repeatCount !== undefined && (repIsVar || (block.repeatCount as number) > 1);

      let param0IsVar = false;
      let param1IsVar = false;
      if (block.params) {
        if (envByte === ENV_ID_BEAT) {
          const flags = getBeatParamVarFlags(opcode, block.params);
          param0IsVar = flags.param0IsVar;
          param1IsVar = flags.param1IsVar;
        } else if (envByte === ENV_ID_DEPOT) {
          const flags = getDepotParamVarFlags(opcode, block.params);
          param0IsVar = flags.param0IsVar;
          param1IsVar = flags.param1IsVar;
        } else if (envByte === ENV_ID_SWITCHYARD) {
          const flags = getSwitchyardParamVarFlags(opcode, block.params);
          param0IsVar = flags.param0IsVar;
          param1IsVar = flags.param1IsVar;
        } else if (block.type === 'FORWARD' || block.type === 'BACKWARD') {
          const lenVal = block.params.length ?? block.params.distance;
          param0IsVar = isVarOrSensorVal(lenVal);
        } else if (block.type === 'TURN_LEFT' || block.type === 'TURN_RIGHT') {
          param0IsVar = isVarOrSensorVal(block.params.angle);
        } else if (block.type === 'ARC_LEFT' || block.type === 'ARC_RIGHT') {
          param0IsVar = isVarOrSensorVal(block.params.radius);
          param1IsVar = isVarOrSensorVal(block.params.angle);
        } else if (block.type === 'SET_PEN_COLOR') {
          param0IsVar = isVarOrSensorVal(block.params.color);
        } else if (block.type === 'SET_PEN_WIDTH') {
          param0IsVar = isVarOrSensorVal(block.params.width);
        } else if (block.type === 'WAIT') {
          param0IsVar = isVarOrSensorVal(block.params.duration);
        }
      }

      const hasVar = (hasRep && repIsVar) || param0IsVar || param1IsVar;
      let paramVarMask = 0;
      if (hasVar) {
        if (hasRep && repIsVar) paramVarMask |= 0x01;
        if (param0IsVar) paramVarMask |= 0x02;
        if (param1IsVar) paramVarMask |= 0x04;
      }

      const headerByte =
        (hasVar ? MASK_HAS_VAR_PARAM : 0x00) | (hasRep ? MASK_HAS_REP : 0x00) | (opcode & 0x1f);
      writer.writeUint8(headerByte);

      if (hasVar) {
        writer.writeUint8(paramVarMask);
      }

      if (hasRep) {
        if (repIsVar) {
          writer.writeUint8(encodeVarOrSensorIndex(String(block.repeatCount)));
        } else {
          writer.writeVLE(block.repeatCount as number);
        }
      }

      // Write parameters
      if (opcode === OP_CALL_FN) {
        writer.writeUint8(fnIndex);
      } else if (envByte === ENV_ID_TURTLE) {
        writeTurtleParams(writer, opcode, block.params, paramVarMask);
      } else if (envByte === ENV_ID_BEAT) {
        writeBeatParams(writer, opcode, block.type, block.params, paramVarMask);
      } else if (envByte === ENV_ID_DEPOT) {
        writeDepotParams(writer, opcode, block.params, paramVarMask);
      } else if (envByte === ENV_ID_SWITCHYARD) {
        writeSwitchyardParams(writer, opcode, block.params, paramVarMask);
      }
    }
  }
}

/**
 * Decodes workspace scopes (`MAIN`, `F1`, `F2`, `F3`) from `reader`
 * using the opcode table governed by `envByte` (`0x00`/`0x01` Grid, `0x02` Turtle, `0x03` Beat).
 * Shared identically by Path A (`SavedProgramEntry` code-only saves), Path B (`ENV_ID_LESSON = 0x04`),
 * and Whole-Profile Backup autosaves (`ENV_ID_PROFILE = 0x06`).
 */
export function readCodeScopes(
  reader: BinaryReader,
  envByte: number,
  envVersion?: number
): WorkspaceState {
  const workspace: WorkspaceState = {
    MAIN: [],
    F1: [],
    F2: [],
    F3: [],
  };

  if (!reader.hasMore) {
    return workspace;
  }

  const scopeCount = reader.readVLE();
  for (let s = 0; s < scopeCount; s++) {
    const scopeByte = reader.readUint8();
    const scope = ID_TO_SCOPE_MAP[scopeByte];
    if (!scope) {
      throw new Error(`Unknown scope ID: 0x${scopeByte.toString(16)}`);
    }

    const blockCount = reader.readVLE();
    const blocks: CodeBlock[] = [];

    for (let b = 0; b < blockCount; b++) {
      const blockHeader = reader.readUint8();
      const hasVar = (blockHeader & MASK_HAS_VAR_PARAM) !== 0;
      const hasRep = (blockHeader & MASK_HAS_REP) !== 0;
      const elseHasCond = (blockHeader & MASK_ELSE_HAS_COND) !== 0; // bit 5 → ELSE_IF
      const opcode = blockHeader & 0x1f;

      // --- Decode IF / ELSE / ELSE_IF / END_IF / WHILE / END_WHILE ---
      // These opcodes use raw header bytes with bits 7..5 = 0 (except ELSE_IF: bit5=1).
      // Handle before the generic hasVar/hasRep/paramVarMask decode path.
      if (opcode === OP_IF) {
        const condition = readConditionExpr(reader, { envByte, envVersion });
        const id = createUniqueBlockId('IF');
        blocks.push({ id, type: 'IF', params: { condition } });
        continue;
      }
      if (opcode === OP_ELSE) {
        if (elseHasCond) {
          // ELSE_IF: blockHeader = 0x25 (OP_ELSE | MASK_ELSE_HAS_COND)
          const condition = readConditionExpr(reader, { envByte, envVersion });
          const id = createUniqueBlockId('ELSE_IF');
          blocks.push({ id, type: 'ELSE_IF', params: { condition } });
        } else {
          // Plain ELSE: blockHeader = 0x05
          const id = createUniqueBlockId('ELSE');
          blocks.push({ id, type: 'ELSE' });
        }
        continue;
      }
      if (opcode === OP_END_IF) {
        const id = createUniqueBlockId('END_IF');
        blocks.push({ id, type: 'END_IF' });
        continue;
      }
      if (opcode === OP_WHILE) {
        const condition = readConditionExpr(reader, { envByte, envVersion });
        const id = createUniqueBlockId('WHILE');
        blocks.push({ id, type: 'WHILE', params: { condition } });
        continue;
      }
      if (opcode === OP_END_WHILE) {
        const id = createUniqueBlockId('END_WHILE');
        blocks.push({ id, type: 'END_WHILE' });
        continue;
      }

      // operandDescMask is used for VAR_ASSIGN/VAR_OP (§6.2 Byte 1, unconditionally present).
      // paramVarMask is used for standard block envelopes (§6.1, present iff hasVar).
      let operandDescMask = 0;
      let paramVarMask = 0;
      if (opcode === OP_VAR_ASSIGN || opcode === OP_VAR_OP) {
        // §6.2: Byte 1 is always present for VAR_ASSIGN/VAR_OP (never HasVarParam-gated)
        operandDescMask = reader.readUint8();
      } else if (hasVar) {
        paramVarMask = reader.readUint8();
      }

      let repeatCount: number | string | undefined;
      if (hasRep) {
        if (hasVar && (paramVarMask & 0x01) !== 0) {
          repeatCount = decodeVarOrSensorIndex(reader.readUint8());
        } else {
          repeatCount = reader.readVLE();
        }
      }

      let type = '';
      let params: Record<string, any> | undefined;

      if (opcode === OP_VAR_ASSIGN) {
        type = 'VAR_ASSIGN';
        const a = indexToVarName(reader.readUint8());
        // operandDescMask bits 1..0 = typeB (variable/int/neg-int/double)
        const typeB = operandDescMask & 0x03;
        const bVal = readOperandData(reader, typeB);
        params = { a, b: bVal };
      } else if (opcode === OP_VAR_OP) {
        type = 'VAR_OP';
        const a = indexToVarName(reader.readUint8());
        const opByte = reader.readUint8();
        const op = byteToOp(opByte);
        // operandDescMask bits 1..0 = typeB, bits 3..2 = typeC
        const typeB = operandDescMask & 0x03;
        const typeC = (operandDescMask >> 2) & 0x03;
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
      } else if (opcode === OP_PLACEHOLDER) {
        type = 'PLACEHOLDER';
        const hintCode = reader.readVLE();
        const decodedHint = codeToPlaceholderHintCategory(hintCode);
        params =
          decodedHint.rawHintCategoryCode !== undefined
            ? {
                hintCategory: decodedHint.hintCategory,
                rawHintCategoryCode: decodedHint.rawHintCategoryCode,
              }
            : { hintCategory: decodedHint.hintCategory };
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
          case OP_TURTLE_WAIT:
            type = 'WAIT';
            break;
          case OP_TURTLE_SET_INSTANT:
            type = 'SET_INSTANT';
            break;
          case OP_TURTLE_CLEAR_CANVAS:
            type = 'CLEAR_CANVAS';
            break;
          case OP_TURTLE_TELEPORT:
            type = 'TELEPORT';
            break;
          default:
            throw new Error(`Unknown Turtle opcode: 0x${opcode.toString(16)}`);
        }
        params = readTurtleParams(reader, opcode, paramVarMask);
      } else if (envByte === ENV_ID_BEAT) {
        const decodedBeat = readBeatBlock(reader, opcode, paramVarMask);
        type = decodedBeat.type;
        params = decodedBeat.params;
      } else if (envByte === ENV_ID_DEPOT) {
        const decodedDepot = readDepotBlock(reader, opcode, paramVarMask);
        type = decodedDepot.type;
        params = decodedDepot.params;
      } else if (envByte === ENV_ID_SWITCHYARD) {
        const decodedSwitchyard = readSwitchyardBlock(reader, opcode, paramVarMask);
        type = decodedSwitchyard.type;
        params = decodedSwitchyard.params;
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
          case OP_GRID_PICK_UP:
            type = 'PICK_UP';
            break;
          case OP_GRID_USE_DROP:
            type = 'USE_DROP';
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

  return workspace;
}

/**
 * Encodes a code-only binary stream (`[FORMAT_VERSION, envByte, envVersion, ...codeScopes]`)
 * without importing React simulation environment bundles.
 */
export function exportCodeOnlyToBinary(
  workspace: WorkspaceState,
  envId: 'generic' | 'turtle' | 'beat' | 'depot' | 'switchyard'
): Uint8Array {
  const writer = new BinaryWriter();
  writer.writeUint8(1); // FORMAT_VERSION = 1
  const envByte =
    envId === 'turtle'
      ? ENV_ID_TURTLE
      : envId === 'beat'
      ? ENV_ID_BEAT
      : envId === 'depot'
      ? ENV_ID_DEPOT
      : envId === 'switchyard'
      ? ENV_ID_SWITCHYARD
      : 0x00; // ENV_ID_GENERIC
  writer.writeUint8(envByte);
  writer.writeUint8(1); // envVersion = 1 (code-only)
  writeCodeScopes(writer, workspace, envByte);
  return writer.getBytes();
}

/**
 * Decodes a code-only binary stream (`[FORMAT_VERSION, envByte, envVersion, ...codeScopes]`)
 * without importing React simulation environment bundles.
 */
export function importCodeOnlyFromBinary(bytes: Uint8Array): WorkspaceState {
  if (!bytes || bytes.length < 3) {
    throw new Error('Code-only payload too short: missing header');
  }
  const reader = new BinaryReader(bytes);
  const formatVersion = reader.readUint8();
  if (formatVersion !== 1) {
    throw new Error(`Unsupported format version: ${formatVersion}`);
  }
  const envByte = reader.readUint8();
  const envVersion = reader.readUint8();
  if (
    envByte !== 0x00 &&
    envByte !== 0x01 &&
    envByte !== ENV_ID_TURTLE &&
    envByte !== ENV_ID_BEAT &&
    envByte !== ENV_ID_DEPOT &&
    envByte !== ENV_ID_SWITCHYARD
  ) {
    throw new Error(`Unsupported autosave environment ID: 0x${envByte.toString(16)}`);
  }
  if (envByte === ENV_ID_DEPOT && envVersion >= 2) {
    readDepotState(reader, envVersion);
  }
  return readCodeScopes(reader, envByte, envVersion);
}
