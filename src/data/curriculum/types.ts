import {
  CellCoord,
  CodeBlock,
  Direction,
  FlagObjective,
  FloorSwitch,
  GridState,
  LockedGate,
  ScopeType,
  VariableName,
  WallEdge,
  WorldItem,
  WorkspaceState,
} from '../../types';
import {
  cloneLockedGates,
  cloneWorldItems,
  syncWorldSwitchesAndGates,
} from '../../engine/physics';

export type AppMode = 'curriculum' | 'sandbox';

export type CurriculumSimId = 'grid' | 'turtle' | 'beat' | 'switchyard';

export type ActivityFormat =
  | 'explanation'
  | 'puzzle'
  | 'sandbox'
  | 'capstone'
  | 'challenge';

/**
 * Hint category codes for '?' Placeholder blocks (OP_PLACEHOLDER = 0x09).
 * Categories 0..4 are active in Modules 1–3; 5..10 are reserved for Modules 4–9.
 */
export type PlaceholderHintCategory =
  | 'any'         // 0
  | 'motion'      // 1
  | 'turn'        // 2
  | 'item'        // 3
  | 'loop'        // 4
  | 'function'    // 5 (reserved M4+)
  | 'conditional' // 6 (reserved M5+)
  | 'sensor'      // 7 (reserved M5+)
  | 'variable'    // 8 (reserved M6+)
  | 'operator'    // 9 (reserved M7+)
  | 'socket';     // 10 (reserved M8+)

export interface PaletteConfig {
  /**
   * Allowed simulation-specific action block types (e.g., ['MOVE_FWD', 'TURN_LEFT', 'TURN_RIGHT']).
   * When omitted, all blocks registered by the activity's simulation environment are shown.
   */
  allowedSimBlocks?: string[];
  /**
   * Allowed universal control/variable block types
   * (e.g., ['LOOP_START', 'LOOP_END', 'CALL_F1', 'VAR_ASSIGN', 'VAR_OP']).
   * Defaults to [] in Curriculum mode when omitted.
   */
  allowedControlBlocks?: string[];
  /**
   * Allowed workspace scopes/tabs (e.g., ['MAIN'] in M1–M3, ['MAIN', 'F1'] in M4).
   * Defaults to ['MAIN'] in Curriculum mode when omitted.
   */
  allowedScopes?: ScopeType[];
  /**
   * Whether numeric repeat badges (×2..×9) can be attached to action blocks.
   */
  allowRepeatBadges?: boolean;
  /**
   * Whether action parameter badges & parameter subpalettes/popovers are shown and editable
   * (e.g., false in Module 1 LOGO so blocks execute fixed 50px steps and 90° turns).
   */
  allowActionParams?: boolean;
  /**
   * Optional fine-grained allowed parameter keys per block type.
   */
  allowedBlockParams?: Record<string, string[]>;
  /**
   * Whether variable badges (a..z) and variable watch/assignment controls are enabled (Module 6+).
   */
  allowVariables?: boolean;
  /**
   * Optional subset of variable names exposed in the palette when allowVariables is true.
   */
  allowedVariableNames?: VariableName[];
}

export interface SlotCapConfig {
  /**
   * Global physical block-slot limit across allowed scopes (or MAIN when single-scope).
   */
  maxTotal?: number;
  /**
   * Optional per-scope physical block-slot limits (e.g., { MAIN: 5, F1: 5 } in Module 4).
   */
  perScope?: Partial<Record<ScopeType, number>>;
}

export interface AntiBypassRule {
  /** Optional rule identifier for diagnostics */
  id?: string;
  /** Concise description of what unintended shortcut this rule proves impossible */
  description: string;
  /** Block types forbidden during the bypass search (e.g., ['MOVE_BACK']) */
  forbidBlocks?: string[];
  /** When false, forces repeatCount = 1 on all action blocks to prove ×N badges are required */
  allowRepeatBadges?: boolean;
  /** Restricts loop nesting depth (0 forbids loops; 1 allows flat sequential loops only) */
  maxLoopNestingDepth?: number;
  /** Restricts candidate programs to a single outer LOOP_START..LOOP_END with zero pre/post blocks */
  pureSingleLoopOnly?: boolean;
  /** Caps how many times specific action types may execute (e.g., { USE_DROP: 1 }) */
  maxActionExecutions?: Record<string, number>;
  /** Asserts that running starterWorkspace unmodified does not reach SUCCESS */
  unmodifiedStarterMustFail?: boolean;
  /** Minimum block edit distance from starterWorkspace required to reach SUCCESS */
  minStarterEditDistance?: number;
  /** Asserts that reaching the goal coordinate directly without prior ordered flags leaves Goal padlocked */
  directToGoalMustFailLock?: boolean;
}

export interface CurriculumGridDefinition {
  width: number;
  height: number;
  robot: { x: number; y: number; dir: Direction };
  barriers: WallEdge[];
  flags: FlagObjective[];
  // Module 2+ interactive world items (Commit 14)
  waterCells?: CellCoord[];
  lockedGates?: LockedGate[];
  floorSwitches?: FloorSwitch[];
  worldItems?: WorldItem[];
}

export interface GhostStepPreview {
  /** Short 1–3 block workspace animated by the translucent ghost agent without modifying user blocks */
  previewWorkspace: WorkspaceState;
  /** Optional tick limit for the ghost preview animation */
  maxSteps?: number;
}

export interface PartialHelpConfig {
  mode: 'ghost' | 'scaffold';
  ghostPreview?: GhostStepPreview;
  scaffoldWorkspace?: WorkspaceState;
}

export interface CreativeVariationCard {
  id: string;
  title: string;
  icon?: string;
  workspace: WorkspaceState;
}

export type DemoSpotlightType =
  | 'execution-order'
  | 'egocentric-pov'
  | 'world-item'
  | 'backpack'
  | 'loop-counter';

export interface ExplanationDemoTab {
  id: string;
  label: string;
  icon?: string;
  title?: string;
  gridState?: CurriculumGridDefinition;
  workspace: WorkspaceState;
  spotlights?: DemoSpotlightType[];
}

export interface ActivityVersionPayload {
  /** Read-only Grid map definition when simId === 'grid' */
  grid?: CurriculumGridDefinition;
  /** Optional pre-populated starter blocks loaded on first visit or Reset to Starter */
  starterWorkspace?: WorkspaceState;
  /** Staged block & badge availability for this activity */
  palette: PaletteConfig;
  /** Optional physical block-budget slot tray constraints */
  slotCap?: SlotCapConfig;
  /** Tier 1 non-spoiling help configuration (Ghost-Step Preview or '?' Scaffold) */
  partialHelp?: PartialHelpConfig;
  /** Verified reference solution for validated puzzles (Tier 2 Full Solution & Anti-Bypass Gate) */
  referenceSolution?: WorkspaceState;
  /** 2–3 creative variation cards for LOGO and Beat & Light sandbox lessons/capstones */
  variations?: CreativeVariationCard[];
  /** Runnable example tabs for 'explanation' interactive demo lessons */
  demoTabs?: ExplanationDemoTab[];
  /** Automated anti-bypass proof rules enforced in CI for validated puzzles */
  antiBypassRules?: AntiBypassRule[];
}

export interface HistoricalActivityDefinition extends ActivityVersionPayload {
  /** Historical integer version number */
  version: number;
  /** Optional note or ISO date when this version was superseded */
  archivedNote?: string;
}

export interface CurriculumActivity extends ActivityVersionPayload {
  /** Canonical activity identifier (e.g., '1.0', '1.1', '1A', '2.1', '3C') */
  id: string;
  /** Parent module identifier (e.g., 'module-1') */
  moduleId: string;
  /** Monotonically increasing activity definition version (starts at 1) */
  version: number;
  /** Pedagogical format of the activity */
  format: ActivityFormat;
  /** Distinguishes validated puzzle capstones ('1A', '2A', '3A') from creative capstones ('1B', '1C', '2B', '3B', '3C') */
  capstoneType?: 'puzzle' | 'creative';
  /** Target simulation environment */
  simId: CurriculumSimId;
  /** Visual icon/emoji for zero-reading identification */
  icon: string;
  /** Short educator/accessibility label */
  title: string;
  /** Core single mental model taught in this activity */
  concept: string;
  /** Optional concise educator/accessibility description of the activity goal */
  description?: string;
  /** Optional zero-reading / educator hint summary */
  hint?: string;
  /** Retained older versions keyed by version number so existing student saves never break */
  historicalVersions?: Record<number, HistoricalActivityDefinition>;
}

export interface CurriculumModule {
  /** Canonical module identifier (e.g., 'module-1', 'module-2', 'module-3') */
  id: string;
  /** 1-based module index */
  number: number;
  /** Full module title */
  title: string;
  /** Compact display title */
  shortTitle: string;
  /** Visual module icon */
  icon: string;
  /** Static collectible Module Mastery Badge ID unlocked when all capstoneIds complete */
  badgeId: string;
  /** Collectible badge title */
  badgeTitle: string;
  /** Visual badge icon */
  badgeIcon: string;
  /** Static list of capstone activity IDs that award this module's Mastery Badge */
  capstoneIds: string[];
}

export function createCurriculumBlock(
  type: string,
  repeatCount?: number | VariableName,
  params?: Record<string, unknown>,
  idPrefix = 'curr'
): CodeBlock {
  const rand = Math.random().toString(36).substring(2, 6);
  return {
    id: `${idPrefix}_${type}_${rand}`,
    type,
    ...(repeatCount !== undefined ? { repeatCount } : {}),
    ...(params !== undefined ? { params: { ...params } } : {}),
  };
}

export function createCurriculumGridState(
  def: CurriculumGridDefinition,
  fitToView = false
): GridState {
  const hasWorld =
    (def.waterCells?.length ?? 0) > 0 ||
    (def.lockedGates?.length ?? 0) > 0 ||
    (def.floorSwitches?.length ?? 0) > 0 ||
    (def.worldItems?.length ?? 0) > 0;

  if (!hasWorld) {
    return {
      width: def.width,
      height: def.height,
      robot: {
        x: def.robot.x,
        y: def.robot.y,
        dir: def.robot.dir,
        initialX: def.robot.x,
        initialY: def.robot.y,
        initialDir: def.robot.dir,
      },
      barriers: def.barriers.map((b) => ({ ...b })),
      flags: def.flags.map((f) => ({ ...f, collected: false })),
      trace: [{ x: def.robot.x, y: def.robot.y }],
      status: 'IDLE',
      showTrace: true,
      fitToView,
    };
  }

  const baseItems = cloneWorldItems(def.worldItems);
  const baseGates = cloneLockedGates(def.lockedGates, true);
  const synced = syncWorldSwitchesAndGates(def.floorSwitches, baseGates, baseItems);

  return {
    width: def.width,
    height: def.height,
    robot: {
      x: def.robot.x,
      y: def.robot.y,
      dir: def.robot.dir,
      initialX: def.robot.x,
      initialY: def.robot.y,
      initialDir: def.robot.dir,
      carriedItem: null,
    },
    barriers: def.barriers.map((b) => ({ ...b })),
    flags: def.flags.map((f) => ({ ...f, collected: false })),
    waterCells: (def.waterCells ?? []).map((w) => ({ ...w })),
    bridgedWaterCells: [],
    lockedGates: synced.lockedGates ?? [],
    initialLockedGates: cloneLockedGates(baseGates, true),
    floorSwitches: synced.floorSwitches ?? [],
    worldItems: baseItems,
    initialWorldItems: cloneWorldItems(baseItems),
    lastInteractionFeedback: null,
    trace: [{ x: def.robot.x, y: def.robot.y }],
    status: 'IDLE',
    showTrace: true,
    fitToView,
  };
}

export function isValidatedPuzzleActivity(activity: CurriculumActivity): boolean {
  if (activity.format === 'puzzle') return true;
  if (activity.format === 'capstone' && activity.capstoneType === 'puzzle') return true;
  return Boolean(activity.referenceSolution);
}
