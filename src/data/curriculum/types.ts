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
import type { DepotState } from '../../simulations/depot/types';

export type AppMode = 'curriculum' | 'sandbox';

export type CurriculumSimId = 'grid' | 'turtle' | 'beat' | 'depot' | 'switchyard';

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
  /**
   * Allowed boolean sensor names in conditional / while blocks (Module 5+).
   */
  allowedSensors?: string[];
  /**
   * Allowed boolean combinators (NOT / AND / OR) in conditional / while blocks (Module 5+).
   */
  allowedCombinators?: ('NOT' | 'AND' | 'OR')[];
  /**
   * Allowed numeric value sensors (e.g., ['$x', '$y', '$heading', '$tileDial']) (Module 6+).
   */
  allowedValueSensors?: string[];
  /**
   * Allowed variable operation symbols (e.g., ['+', '-']) (Module 6+).
   */
  allowedVarOps?: string[];
  /**
   * Whether recursive function calls (direct self-calls or transitive call-graph cycles)
   * are permitted in function scopes. Defaults to true when omitted.
   */
  allowRecursion?: boolean;
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
  /** When false, disables/forbids variable assignments & variable badges during bypass search */
  allowVariables?: boolean;
  /** Forbids boolean combinators (NOT, AND, OR) during bypass search */
  forbidCombinators?: ('NOT' | 'AND' | 'OR')[];
  /** Forbids specific sensor types during bypass search */
  forbidSensors?: string[];
  /** Per-scope loop nesting caps (e.g., { MAIN: 1, F1: 0 }) */
  maxLoopNestingDepthPerScope?: Partial<Record<ScopeType, number>>;
  /** Requires that a single-variant bypass solution exists while failing multi-variant */
  singleVariantBypassMustExist?: boolean;
}

export type GridConditionSensor =
  | 'pathAhead'
  | 'pathLeft'
  | 'pathRight'
  | 'itemHere'
  | 'carryingItem'
  | 'atGoal'
  | 'tileColor'
  | 'unvisitedAhead';

export type SwitchyardConditionSensor =
  | 'hasNextItem'
  | 'itemDamaged'
  | 'itemColor'
  | 'itemIcon';

export type TurtleConditionSensor = 'insideCanvas';

export type BeatConditionSensor = 'cursorAtEdge';

export type DepotConditionSensor =
  | 'stationEmpty'
  | 'hasItem'
  | 'itemDamaged'
  | 'heldColor'
  | 'topColor';

export type ConditionSensorType =
  | GridConditionSensor
  | SwitchyardConditionSensor
  | DepotConditionSensor
  | TurtleConditionSensor
  | BeatConditionSensor;

export type ConditionCombinatorOp = 'NOT' | 'AND' | 'OR';
export type ConditionCompareOp = '=' | '!=' | '<' | '<=' | '>' | '>=';

export type ConditionExpr =
  | {
      kind: 'sensor';
      sensor: ConditionSensorType;
      /** Optional color/icon filter (e.g., for tileColor, itemColor, itemIcon, heldColor, topColor) */
      param?: string;
    }
  | {
      kind: 'not';
      operand: ConditionExpr;
    }
  | {
      kind: 'and';
      left: ConditionExpr;
      right: ConditionExpr;
    }
  | {
      kind: 'or';
      left: ConditionExpr;
      right: ConditionExpr;
    }
  | {
      /** Reserved for Module 7-8 typed numeric comparisons */
      kind: 'cmp';
      op: ConditionCompareOp;
      left: string | number;
      right: string | number;
    };

export interface CurriculumBeaconTile {
  x: number;
  y: number;
  color: 'amber' | 'sky' | 'emerald' | 'rose' | string;
  label?: string;
}

export interface CurriculumDialTile {
  x: number;
  y: number;
  value: number;
  label?: string;
}

export interface CurriculumGridDefinition {
  width: number;
  height: number;
  robot: { x: number; y: number; dir: Direction };
  barriers: WallEdge[];
  flags: FlagObjective[];
  /** Optional display label when rendered as a multi-variant map */
  label?: string;
  // Module 2+ interactive world items (Commit 14)
  waterCells?: CellCoord[];
  lockedGates?: LockedGate[];
  floorSwitches?: FloorSwitch[];
  worldItems?: WorldItem[];
  // Module 5-6 interactive beacon/dial tiles & validation guards
  beaconTiles?: CurriculumBeaconTile[];
  dialTiles?: CurriculumDialTile[];
  requireAllItemsCollected?: boolean;
  requireEmptyBackpackAtGoal?: boolean;
  strictInteractionCollision?: boolean;
}

export type SwitchyardColor = 'amber' | 'sky' | 'emerald' | 'rose' | 'slate' | string;
export type SwitchyardIcon = 'crate' | 'gear' | 'gem' | 'battery' | 'bolt' | string;

export interface SwitchyardItemDef {
  id: string;
  color: SwitchyardColor;
  icon: SwitchyardIcon;
  damaged?: boolean;
  weight?: number;
}

export interface SwitchyardSwitchDef {
  id: string;
  label?: string;
  initialDirection: 'left' | 'right';
  /** Target dock ID or downstream switch ID when toggled left */
  leftTarget: string;
  /** Target dock ID or downstream switch ID when toggled right */
  rightTarget: string;
}

export interface SwitchyardDockDef {
  id: string;
  label?: string;
  expectedColor?: SwitchyardColor;
  expectedIcon?: SwitchyardIcon;
  expectedItems?: Array<{
    color?: SwitchyardColor;
    icon?: SwitchyardIcon;
  }>;
  acceptsDamaged?: boolean;
  quota?: number;
  maxWeight?: number;
  minWeight?: number;
}

export interface CurriculumSwitchyardDefinition {
  label?: string;
  incomingStream: SwitchyardItemDef[];
  switches: SwitchyardSwitchDef[];
  docks: SwitchyardDockDef[];
  scrapChute?: {
    label?: string;
    expectedDamagedOnly?: boolean;
    expectedCount?: number;
  };
  scrapRules?:
    | string
    | {
        kind?: string;
        maxWeight?: number;
        allowDamaged?: boolean;
        forbidIntact?: boolean;
        maxScraps?: number;
      };
  mode?: 'sort' | 'priority' | 'balance_scale' | string;
  balanceTolerance?: number;
}

export interface CurriculumVariant {
  index: number;
  label?: string;
  kind: 'grid' | 'depot' | 'switchyard';
  grid?: CurriculumGridDefinition;
  depot?: CurriculumDepotDefinition;
  switchyard?: CurriculumSwitchyardDefinition;
}

export interface SceneInputConfig {
  mode: 'int' | 'color';
  min?: number;
  max?: number;
  options: (number | string)[];
  previewInput?: number | string;
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
  inputConfig?: SceneInputConfig;
}

export type DemoSpotlightType =
  | 'execution-order'
  | 'egocentric-pov'
  | 'rotation-in-place'
  | 'south-pov-turn'
  | 'world-item'
  | 'shoulder-gripper'
  | 'backpack'
  | 'beat-ring'
  | 'beat-cursor-reticle'
  | 'depot-stack-top'
  | 'depot-out-chute'
  | 'loop-counter'
  | 'call-stack-jump'
  | 'sensor-beam'
  | 'branch-skip'
  | 'else-if-chain'
  | 'scene-input'
  | 'while-guard'
  | 'branch'
  | 'while'
  | 'fifo-vs-lifo'
  | 'dial-read'
  | 'pose-bookmark'
  | 'variable-watch';

export interface CurriculumDepotDefinition extends DepotState {
  /** Bitmask indicating active Depot workshop stations (e.g. stacks 1..3 = 0x07, +OUT = 0x0F). */
  activeStationsMask?: number;
  mode?: string;
  balanceTolerance?: number;
  enforceHanoiRule?: boolean;
  requireEmptyStacks?: boolean;
  allowNonEmptyInput?: boolean;
  exactOutputCount?: number;
  scrapRules?: string | Record<string, any>;
}

export interface CurriculumTurtleDefinition {
  canvasBounds?: { halfWidth: number; halfHeight: number };
  showCanvasBounds?: boolean;
}

export interface CurriculumBeatRules {
  isLoopingDefault?: boolean;
  cleanResetOnInputChange?: boolean;
}

export interface ExplanationDemoTab {
  id: string;
  label: string;
  icon?: string;
  title?: string;
  simId?: CurriculumSimId;
  gridState?: CurriculumGridDefinition;
  depotState?: CurriculumDepotDefinition;
  switchyardState?: CurriculumSwitchyardDefinition;
  inputConfig?: SceneInputConfig;
  workspace: WorkspaceState;
  spotlights?: DemoSpotlightType[];
}

export interface ActivityVersionPayload {
  /** Read-only Grid map definition when simId === 'grid' */
  grid?: CurriculumGridDefinition;
  /** Ordered multi-map variants evaluated simultaneously on the same student program (M5–M6+) */
  gridVariants?: CurriculumGridDefinition[];
  /** Read-only Depot initial & target stack definition when simId === 'depot' */
  depot?: CurriculumDepotDefinition;
  /** Ordered multi-run Depot test cases evaluated simultaneously (M5–M6+) */
  depotVariants?: CurriculumDepotDefinition[];
  /** Read-only Switchyard train sorting definition when simId === 'switchyard' */
  switchyard?: CurriculumSwitchyardDefinition;
  /** Ordered multi-stream Switchyard variants evaluated simultaneously */
  switchyardVariants?: CurriculumSwitchyardDefinition[];
  /** Optional Turtle canvas configuration (e.g., showCanvasBounds for insideCanvas) */
  turtle?: CurriculumTurtleDefinition;
  /** Optional Beat playback/reset rules for reactive scenes */
  beatRules?: CurriculumBeatRules;
  /** Optional reactive $input scene selector configuration (branch.10a, branch.10, branch.B, branch.C) */
  inputConfig?: SceneInputConfig;
  /** Whether continuous loop playback is enabled automatically on load (e.g., frame animation lessons) */
  defaultLoopPlayback?: boolean;
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

export interface MasteryChallengeTier {
  /** 1-based Challenge Tier number (Tier 1..5) */
  tier: number;
  /** Canonical tier identifier (e.g., 'tier-1') */
  id: string;
  /** Tier display title */
  title: string;
  /** Collectible tier mastery badge ID */
  badgeId: string;
  /** Module ID whose completion unlocks this challenge tier */
  unlockAfterModuleId: string;
  /** Ordered challenge activity IDs belonging to this tier */
  challengeIds: string[];
}

export function getActivityVariants(
  payload: ActivityVersionPayload,
  simId: CurriculumSimId
): CurriculumVariant[] {
  if (simId === 'grid') {
    if (payload.gridVariants && payload.gridVariants.length > 0) {
      return payload.gridVariants.map((grid, index) => ({
        index,
        label: grid.label,
        kind: 'grid',
        grid,
      }));
    }
    if (payload.grid) {
      return [{ index: 0, label: payload.grid.label, kind: 'grid', grid: payload.grid }];
    }
    return [];
  }
  if (simId === 'depot') {
    if (payload.depotVariants && payload.depotVariants.length > 0) {
      return payload.depotVariants.map((depot, index) => ({
        index,
        kind: 'depot',
        depot,
      }));
    }
    if (payload.depot) {
      return [{ index: 0, kind: 'depot', depot: payload.depot }];
    }
    return [];
  }
  if (simId === 'switchyard') {
    if (payload.switchyardVariants && payload.switchyardVariants.length > 0) {
      return payload.switchyardVariants.map((switchyard, index) => ({
        index,
        label: switchyard.label,
        kind: 'switchyard',
        switchyard,
      }));
    }
    if (payload.switchyard) {
      return [
        {
          index: 0,
          label: payload.switchyard.label,
          kind: 'switchyard',
          switchyard: payload.switchyard,
        },
      ];
    }
    return [];
  }
  return [];
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
      beaconTiles: def.beaconTiles
        ? def.beaconTiles.map((b) => ({
            x: b.x,
            y: b.y,
            color: b.color as any,
            shape: (b as any).shape ?? (b.color === 'amber' ? 'triangle' : b.color === 'sky' ? 'circle' : 'square'),
          }))
        : undefined,
      dialTiles: def.dialTiles ? def.dialTiles.map((d) => ({ x: d.x, y: d.y, value: d.value })) : undefined,
      trace: [{ x: def.robot.x, y: def.robot.y }],
      status: 'IDLE',
      showTrace: true,
      fitToView,
    };
  }

  const baseItems = cloneWorldItems(def.worldItems);
  const baseGates = cloneLockedGates(def.lockedGates, true);
  const synced = syncWorldSwitchesAndGates(def.floorSwitches, baseGates, baseItems, {
    x: def.robot.x,
    y: def.robot.y,
  });

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
    beaconTiles: def.beaconTiles
      ? def.beaconTiles.map((b) => ({
          x: b.x,
          y: b.y,
          color: b.color as any,
          shape: (b as any).shape ?? (b.color === 'amber' ? 'triangle' : b.color === 'sky' ? 'circle' : 'square'),
        }))
      : undefined,
    dialTiles: def.dialTiles ? def.dialTiles.map((d) => ({ x: d.x, y: d.y, value: d.value })) : undefined,
    lastInteractionFeedback: null,
    trace: [{ x: def.robot.x, y: def.robot.y }],
    status: 'IDLE',
    showTrace: true,
    fitToView,
    requireAllItemsCollected: def.requireAllItemsCollected,
    requireEmptyBackpackAtGoal: def.requireEmptyBackpackAtGoal,
  };
}

export function isValidatedPuzzleActivity(activity: CurriculumActivity): boolean {
  if (activity.format === 'puzzle' || activity.format === 'challenge') return true;
  if (activity.format === 'capstone' && activity.capstoneType === 'puzzle') return true;
  return Boolean(activity.referenceSolution);
}
