export type Direction = 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';

export type BlockType =
  | 'MOVE_FWD'
  | 'MOVE_BACK'
  | 'TURN_LEFT'
  | 'TURN_RIGHT'
  | 'LOOP_START'
  | 'LOOP_END'
  | 'CALL_F1'
  | 'CALL_F2'
  | 'CALL_F3';

export interface CodeBlock {
  id: string;
  type: string;
  /** Multiplier badge for movement or loop iteration count (2..9) */
  repeatCount?: number;
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

export interface RobotState {
  x: number;
  y: number;
  dir: Direction;
  initialX: number;
  initialY: number;
  initialDir: Direction;
}

export type SimulationStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'SUCCESS' | 'COLLISION';

export interface GridState {
  width: number;
  height: number;
  robot: RobotState;
  barriers: WallEdge[];
  flags: FlagObjective[];
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
}

