import { WorkspaceState, GridState } from '../../types';
import { TurtleState } from '../../simulations/turtle/types';

// Format versions
export const FORMAT_VERSION = 1;
export const ENV_VERSION_GRID = 1;
export const ENV_VERSION_TURTLE = 1;

// Environment IDs
export const ENV_ID_GENERIC = 0x00;
export const ENV_ID_GRID = 0x01;
export const ENV_ID_TURTLE = 0x02;

export type EnvIdName = 'generic' | 'grid' | 'turtle';

// Scope IDs
export const SCOPE_ID_MAIN = 0x00;
export const SCOPE_ID_SUBFUNCTION_BASE = 0x80;
export const SCOPE_ID_F1 = 0x81;
export const SCOPE_ID_F2 = 0x82;
export const SCOPE_ID_F3 = 0x83;

// Universal Control Flow Opcodes (0x00..0x0F)
export const OP_LOOP_START = 0x01;
export const OP_LOOP_END = 0x02;
export const OP_CALL_FN = 0x03;
export const OP_IF = 0x04;
export const OP_ELSE = 0x05;
export const OP_END_IF = 0x06;

// Grid World Opcodes (envId = 0x01, envVersion = 1)
export const OP_GRID_MOVE_FWD = 0x10;
export const OP_GRID_MOVE_BACK = 0x11;
export const OP_GRID_TURN_LEFT = 0x12;
export const OP_GRID_TURN_RIGHT = 0x13;

// Turtle World Opcodes (envId = 0x02, envVersion = 1)
export const OP_TURTLE_FORWARD = 0x10;
export const OP_TURTLE_BACKWARD = 0x11;
export const OP_TURTLE_TURN_LEFT = 0x12;
export const OP_TURTLE_TURN_RIGHT = 0x13;
export const OP_TURTLE_ARC_LEFT = 0x14;
export const OP_TURTLE_ARC_RIGHT = 0x15;
export const OP_TURTLE_PEN_UP = 0x16;
export const OP_TURTLE_PEN_DOWN = 0x17;
export const OP_TURTLE_SET_PEN_COLOR = 0x18;

// Turtle Color Palette
export const TURTLE_COLOR_PALETTE: readonly string[] = [
  '#0f172a', // 0: Black
  '#ef4444', // 1: Red
  '#3b82f6', // 2: Blue
  '#10b981', // 3: Green
  '#f59e0b', // 4: Amber
  '#8b5cf6', // 5: Purple
];

export interface ImportResult {
  success: boolean;
  formatVersion?: number;
  envId?: EnvIdName;
  envVersion?: number;
  workspace?: WorkspaceState;
  gridState?: GridState;
  turtleState?: TurtleState;
  error?: string;
}
