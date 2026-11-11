export type Direction = 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';

// 1. Generic Brand tracking type
declare const brand: unique symbol;

export type Brand<T, TBrand extends string> = T & {
  readonly [brand]: TBrand;
};

// 2. Branded Newtype for VariableName
export type VariableName = Brand<string, 'VarName'>;

// 3. Helper validators & constructors
export function toVariableName(name: string): VariableName {
  const lower = name.toLowerCase().trim();
  if (!/^[a-z]$/.test(lower)) {
    throw new Error(`Invalid variable name '${name}'. Must be a single lowercase letter 'a'-'z'.`);
  }
  return lower as VariableName;
}

export function isVariableName(val: unknown): val is VariableName {
  return typeof val === 'string' && /^[a-z]$/.test(val);
}

export const ALL_VARIABLE_NAMES: readonly VariableName[] = [
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
  'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'
].map((ch) => ch as VariableName);

export type BinaryOp =
  | '+'
  | '-'
  | '*'
  | '/'
  | '%'
  | '=='
  | '!='
  | '<'
  | '<='
  | '>'
  | '>='
  | '&&'
  | '||';

export type OperandValue = number | VariableName;

export interface VarAssignParams {
  a: VariableName;
  b: OperandValue;
}

export interface VarOpParams {
  a: VariableName;
  b: OperandValue;
  op: BinaryOp;
  c: OperandValue;
}

export type BlockType =
  | 'MOVE_FWD'
  | 'MOVE_BACK'
  | 'TURN_LEFT'
  | 'TURN_RIGHT'
  | 'PICK_UP'
  | 'USE_DROP'
  | 'LOOP_START'
  | 'LOOP_END'
  | 'CALL_F1'
  | 'CALL_F2'
  | 'CALL_F3'
  | 'VAR_ASSIGN'
  | 'VAR_OP'
  | 'PLACEHOLDER';

export interface CodeBlock {
  id: string;
  type: string;
  /** Multiplier badge for movement or loop iteration count (2..9 or VariableName) */
  repeatCount?: number | VariableName;
  /** Block configuration parameters (e.g. angle: 30, color: '#ef4444') */
  params?: Record<string, any>;
}

export type ScopeType = 'MAIN' | 'F1' | 'F2' | 'F3';

export type WorkspaceState = Record<ScopeType, CodeBlock[]>;

export interface CellCoord {
  x: number;
  y: number;
}

export interface WallEdge {
  /**
   * 'H' means horizontal wall along the top edge of cell (x, y),
   * i.e., between (x, y-1) and (x, y) where y > 0.
   * 'V' means vertical wall along the left edge of cell (x, y),
   * i.e., between (x-1, y) and (x, y) where x > 0.
   */
  orientation: 'H' | 'V';
  x: number;
  y: number;
}

export interface FlagObjective {
  id: string;
  x: number;
  y: number;
  isGoal: boolean; // true for final checkered goal, false for numbered flag
  order: number;   // 1, 2, 3...
  collected: boolean;
}

export type KeyGateShape = 'circle' | 'triangle' | 'diamond';

export type KeyGateColor = 'amber' | 'emerald' | 'purple';

export type WorldItemType = 'key' | 'plank' | 'crate';

export interface WorldItem {
  id: string;
  type: WorldItemType;
  x: number;
  y: number;
  /** Distinct emblem/bow shape for color-blind safe matching ('circle' ● | 'triangle' ▲ | 'diamond' ◆) */
  shape?: KeyGateShape;
  /** Color paired with shape for keys ('amber' | 'emerald' | 'purple') */
  color?: KeyGateColor;
}

export interface LockedGate {
  id: string;
  x: number;
  y: number;
  shape: KeyGateShape;
  color: KeyGateColor;
  /** True when currently open/passable (unlocked by key or held open by a linked FloorSwitch) */
  unlocked?: boolean;
  /** True when permanently unlocked by a matching key */
  unlockedByKey?: boolean;
  /** Optional ID of a FloorSwitch that opens this gate while active */
  linkedSwitchId?: string;
}

export interface FloorSwitch {
  id: string;
  x: number;
  y: number;
  /** Optional ID of a LockedGate opened while a crate rests on this switch */
  linkedGateId?: string;
  /**
   * Whether this switch must be active (depressed by a crate) for the Goal to unlock/succeed.
   * Defaults to true when unlinked, or false when linked to a gate.
   */
  requiredForGoal?: boolean;
  /** Runtime active state: true while a crate sits on (x, y) */
  active?: boolean;
}

export interface WorldInteractionFeedback {
  kind: 'noop-empty' | 'noop-full' | 'wrong-key' | 'invalid-use' | 'occupied';
  message: string;
  seq: number;
}

export interface RobotState {
  x: number;
  y: number;
  dir: Direction;
  initialX: number;
  initialY: number;
  initialDir: Direction;
  /** 1-slot backpack carried item (null/undefined when empty) */
  carriedItem?: WorldItem | null;
}

export type SimulationStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'SUCCESS' | 'COLLISION';

export type SimulationSpeed = 400 | 100 | 25 | 'instant';

export interface GridState {
  width: number;
  height: number;
  robot: RobotState;
  barriers: WallEdge[];
  flags: FlagObjective[];
  /** Impassable water channel tiles (walkable only once bridged by a plank) */
  waterCells?: CellCoord[];
  /** Runtime subset of waterCells that currently have a wooden plank bridge placed */
  bridgedWaterCells?: CellCoord[];
  /** Shape+color coded locked gate tiles (impassable until unlocked) */
  lockedGates?: LockedGate[];
  /** Initial authored gate definitions for clean Reset & Serialization */
  initialLockedGates?: LockedGate[];
  /** Recessed floor switches depressed when a crate sits on them */
  floorSwitches?: FloorSwitch[];
  /** Active pickup items currently sitting on the grid floor */
  worldItems?: WorldItem[];
  /** Initial authored pickup items for clean Reset & Serialization */
  initialWorldItems?: WorldItem[];
  /** Non-fatal contextual feedback (e.g. backpack full, empty cell, wrong key) for visual shake + aria-live */
  lastInteractionFeedback?: WorldInteractionFeedback | null;
  trace: CellCoord[];
  status: SimulationStatus;
  showTrace: boolean;
  fitToView?: boolean;
}

export interface StackFrame {
  scope: ScopeType;
  pc: number;
  /** Sub-tick counter when a block has repeatCount > 1 */
  subTickLeft: number;
}

export interface LoopFrame {
  scope: ScopeType;
  loopStartPc: number;
  loopEndPc: number;
  currentIteration: number;
  totalIterations: number;
}

export interface InterpreterRuntimeState {
  callStack: StackFrame[];
  loopStack: LoopFrame[];
  activeBlockId: string | null;
  activeScope: ScopeType;
  status: SimulationStatus;
  stepCount: number;
  activeRepeatProgress?: { blockId: string; current: number; total: number } | null;
  variables: Record<VariableName, number>;
}

