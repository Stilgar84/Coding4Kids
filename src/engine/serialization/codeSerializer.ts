import { WorkspaceState, GridState, CodeBlock, ScopeType } from '../../types';
import { TurtleState } from '../../simulations/turtle/types';
import { createInitialTurtleState } from '../../simulations/turtle/turtleEnvironment';
import { BinaryReader } from './binaryReader';
import { BinaryWriter } from './binaryWriter';
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

/**
 * Exports a workspace and optional environment state to a Base64URL string.
 */
export function exportToString(
  workspace: WorkspaceState,
  envId: 'grid' | 'turtle' | 'generic',
  envState?: GridState | TurtleState
): string {
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
            opcode = OP_TURTLE_FORWARD;
            break;
          case 'BACKWARD':
            opcode = OP_TURTLE_BACKWARD;
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

      // Determine HasRep flag
      const hasRep =
        block.type === 'LOOP_START'
          ? block.repeatCount !== undefined && block.repeatCount > 0
          : block.repeatCount !== undefined && block.repeatCount > 1;

      const headerByte = (hasRep ? 0x40 : 0x00) | (opcode & 0x1f);
      writer.writeUint8(headerByte);

      if (hasRep) {
        writer.writeVLE(block.repeatCount!);
      }

      // Write parameters
      if (opcode === OP_CALL_FN) {
        writer.writeUint8(fnIndex);
      } else if (envByte === ENV_ID_TURTLE) {
        writeTurtleParams(writer, opcode, block.params);
      }
    }
  }

  return writer.toBase64URL();
}

/**
 * Imports a Base64URL string into an ImportResult.
 */
export function importFromString(serialized: string): ImportResult {
  if (!serialized || typeof serialized !== 'string' || !serialized.trim()) {
    return { success: false, error: 'Empty serialized input' };
  }

  try {
    const reader = BinaryReader.fromBase64URL(serialized.trim());
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
          const hasRep = (blockHeader & 0x40) !== 0;
          const opcode = blockHeader & 0x1f;

          let repeatCount: number | undefined;
          if (hasRep) {
            repeatCount = reader.readVLE();
          }

          let type = '';
          let params: Record<string, any> | undefined;

          if (opcode === OP_LOOP_START) {
            type = 'LOOP_START';
          } else if (opcode === OP_LOOP_END) {
            type = 'LOOP_END';
          } else if (opcode === OP_CALL_FN) {
            const fnIndex = reader.readUint8();
            type = fnIndex === 1 ? 'CALL_F1' : fnIndex === 2 ? 'CALL_F2' : 'CALL_F3';
          } else if (envByte === ENV_ID_TURTLE) {
            switch (opcode) {
              case OP_TURTLE_FORWARD:
                type = 'FORWARD';
                break;
              case OP_TURTLE_BACKWARD:
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
              default:
                throw new Error(`Unknown Turtle opcode: 0x${opcode.toString(16)}`);
            }
            params = readTurtleParams(reader, opcode);
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
