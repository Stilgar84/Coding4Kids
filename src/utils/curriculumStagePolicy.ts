import { ActionParamDef, SimPaletteItem } from '../engine/simulation/types';
import {
  ALL_VARIABLE_NAMES,
  BinaryOp,
  ScopeType,
  VariableName,
  WorkspaceState,
} from '../types';
import {
  AppMode,
  CURRICULUM_ACTIVITIES,
  ConditionExpr,
  ConditionSensorType,
  CurriculumActivity,
  CurriculumDepotDefinition,
  PaletteConfig,
  SceneInputConfig,
  SlotCapConfig,
  getActivityAtVersion,
  getActivityLatest,
} from '../data/curriculum';
import {
  createInitialDepotState,
  getEffectiveActiveStationsMask,
} from '../simulations/depot/depotPhysics';
import type { DepotState } from '../simulations/depot/types';

export const DEFAULT_PALETTE_VAR_BADGES: readonly VariableName[] = [
  'a',
  'b',
  'c',
  'n',
].map((v) => v as VariableName);

export const ALL_SCOPES: readonly ScopeType[] = ['MAIN', 'F1', 'F2', 'F3'];

/**
 * Resolves the active curriculum activity when in Curriculum ('curriculum') mode,
 * preferring the exact active version and falling back to the latest definition.
 */
export function resolveActiveCurriculumActivity(
  appMode: AppMode,
  activeActivityId: string,
  activeActivityVersion: number
): CurriculumActivity | undefined {
  if (appMode !== 'curriculum') return undefined;
  return (
    getActivityAtVersion(activeActivityId, activeActivityVersion) ??
    getActivityLatest(activeActivityId)
  );
}

/**
 * Computes the permitted Depot stations and gates for a curriculum activity
 * from its active `depot`, `depotVariants`, or `demoTabs` configurations.
 */
export function computeAllowedDepotStationsAndGates(
  activity?: CurriculumActivity,
  activeDemoTabIndex = 0
): { stations?: ReadonlySet<string>; gates?: ReadonlySet<string> } {
  if (!activity) return {};

  const depotConfigs: Array<CurriculumDepotDefinition | DepotState> = [];
  if (activity.depot) {
    depotConfigs.push(activity.depot);
  }
  if (activity.depotVariants && activity.depotVariants.length > 0) {
    depotConfigs.push(...activity.depotVariants);
  }
  if (activity.demoTabs && activity.demoTabs.length > 0) {
    const clampedIdx = Math.min(Math.max(0, activeDemoTabIndex), activity.demoTabs.length - 1);
    const activeTabDepot = activity.demoTabs[clampedIdx]?.depotState;
    if (activeTabDepot) {
      depotConfigs.push(activeTabDepot);
    } else {
      for (const tab of activity.demoTabs) {
        if (tab.depotState) depotConfigs.push(tab.depotState);
      }
    }
  }

  if (depotConfigs.length === 0) return {};

  let unionMask = 0;
  for (const cfg of depotConfigs) {
    const initial = createInitialDepotState(cfg as any);
    unionMask |= getEffectiveActiveStationsMask(initial);
    if (typeof cfg.activeStationsMask === 'number' && Number.isFinite(cfg.activeStationsMask)) {
      unionMask |= Math.trunc(cfg.activeStationsMask) & 0xff;
    }
  }

  const stations = new Set<string>();
  if ((unionMask & 0x01) !== 0) stations.add('STACK_1');
  if ((unionMask & 0x02) !== 0) stations.add('STACK_2');
  if ((unionMask & 0x04) !== 0) stations.add('STACK_3');
  if ((unionMask & 0x08) !== 0) stations.add('QUEUE');
  if ((unionMask & 0x10) !== 0) stations.add('INPUT');

  const gates = new Set<string>();
  if ((unionMask & 0x40) !== 0) gates.add('OUT');
  if ((unionMask & 0x20) !== 0) gates.add('ACCEPT');
  if ((unionMask & 0x80) !== 0) gates.add('REJECT');

  return { stations, gates };
}

/**
 * Filters a single ActionParamDef's Depot station/gate options against active stage masks.
 */
export function filterParamDefForDepot(
  def: ActionParamDef,
  allowedDepotStations?: ReadonlySet<string>,
  allowedDepotGates?: ReadonlySet<string>
): ActionParamDef {
  if (def.type === 'depot-station' && allowedDepotStations && allowedDepotStations.size > 0) {
    const nextOptions = def.options.filter((opt) =>
      allowedDepotStations.has(String(opt.value))
    );
    if (nextOptions.length > 0) {
      const nextDefault = allowedDepotStations.has(String(def.defaultValue))
        ? def.defaultValue
        : nextOptions[0].value;
      return {
        ...def,
        options: nextOptions,
        defaultValue: nextDefault,
      };
    }
  }
  if (def.type === 'depot-gate' && allowedDepotGates && allowedDepotGates.size > 0) {
    const nextOptions = def.options.filter((opt) =>
      allowedDepotGates.has(String(opt.value))
    );
    if (nextOptions.length > 0) {
      const nextDefault = allowedDepotGates.has(String(def.defaultValue))
        ? def.defaultValue
        : nextOptions[0].value;
      return {
        ...def,
        options: nextOptions,
        defaultValue: nextDefault,
      };
    }
  }
  return def;
}

/**
 * Filters a block's ActionParamDef list according to the active mode and PaletteConfig,
 * and filters Depot station/gate options to the stations/gates present on the active stage.
 */
export function getAllowedParamDefs(
  blockType: string,
  paramDefs: ActionParamDef[] | undefined,
  appMode: AppMode,
  palette?: PaletteConfig,
  activity?: CurriculumActivity,
  activeDemoTabIndex = 0
): ActionParamDef[] {
  if (!paramDefs || paramDefs.length === 0) return [];
  if (appMode !== 'curriculum' || !palette) return paramDefs;
  if (palette.allowActionParams === false) return [];

  let filtered = paramDefs;
  if (palette.allowedBlockParams !== undefined) {
    const allowedIds = palette.allowedBlockParams[blockType] ?? [];
    filtered = filtered.filter((def) => allowedIds.includes(def.id));
  }

  if (activity) {
    const { stations: allowedDepotStations, gates: allowedDepotGates } =
      computeAllowedDepotStationsAndGates(activity, activeDemoTabIndex);

    filtered = filtered.map((def) =>
      filterParamDefForDepot(def, allowedDepotStations, allowedDepotGates)
    );
  }

  return filtered;
}

export interface StagedPalettePolicy {
  isCurriculum: boolean;
  palette?: PaletteConfig;
  visibleSimItems: SimPaletteItem[];
  allowedControlTypes: Set<string>;
  allowedScopes: ScopeType[];
  showScopeSelector: boolean;
  allowRepeatBadges: boolean;
  allowVariables: boolean;
  allowRecursion: boolean;
  paletteVariableBadges: readonly VariableName[];
  subpaletteVariableNames: readonly VariableName[];
  subpaletteOperandVarNames: readonly VariableName[];
  allowActionParams: boolean;
  canUseSubpaletteParams: boolean;
  allowedSensors?: string[];
  allowedCombinators?: ('NOT' | 'AND' | 'OR')[];
  allowedValueSensors?: string[];
  allowedVarOps?: BinaryOp[];
  allowedCmpOps?: import('../data/curriculum/types').ConditionCompareOp[];
  allowInteractiveEvents?: boolean;
  allowedDepotStations?: ReadonlySet<string>;
  allowedDepotGates?: ReadonlySet<string>;
}

export const CURRICULUM_SIDE_TRACK_PREREQUISITES: Readonly<Record<string, readonly string[]>> = {
  inter: ['cmp'],
  anim: ['inter'],
};

export function getModulePrerequisites(moduleId: string): readonly string[] {
  return CURRICULUM_SIDE_TRACK_PREREQUISITES[moduleId] ?? [];
}

export function isModuleDagUnlocked(
  moduleId: string,
  completedModules: ReadonlySet<string> | readonly string[],
  unlockedModules: readonly string[] = [],
  unlockAllModules?: boolean
): boolean {
  if (unlockAllModules) return true;
  if (unlockedModules.includes(moduleId)) return true;
  const prereqs = getModulePrerequisites(moduleId);
  if (prereqs.length === 0) return false;
  return prereqs.every((req) =>
    Array.isArray(completedModules)
      ? completedModules.includes(req)
      : (completedModules as ReadonlySet<string>).has(req)
  );
}

/**
 * Returns true when BeatCanvas's active-color indicator/picker should be displayed:
 * always enabled in Sandbox mode, and enabled in Curriculum mode iff `SET_LED_COLOR`
 * is present in the activity's `allowedSimBlocks` (or omitted in open palettes).
 */
export function isBeatActiveColorToolEnabled(
  appMode: AppMode,
  activity?: CurriculumActivity
): boolean {
  if (appMode !== 'curriculum' || !activity) return true;
  const allowedSimBlocks = activity.palette?.allowedSimBlocks;
  if (allowedSimBlocks === undefined) return true;
  return allowedSimBlocks.includes('SET_LED_COLOR');
}

/**
 * Computes the complete staged palette visibility policy for the current mode & activity.
 * In 'sandbox' mode (or if no curriculum activity is resolved), everything is unrestricted.
 */
export function computeStagedPalettePolicy(
  appMode: AppMode,
  activity: CurriculumActivity | undefined,
  simPaletteItems: SimPaletteItem[],
  activeDemoTabIndex = 0
): StagedPalettePolicy {
  if (appMode !== 'curriculum' || !activity) {
    return {
      isCurriculum: false,
      palette: undefined,
      visibleSimItems: simPaletteItems,
      allowedControlTypes: new Set([
        'LOOP_START',
        'LOOP_END',
        'VAR_ASSIGN',
        'VAR_OP',
        'CALL_F1',
        'CALL_F2',
        'CALL_F3',
        'IF',
        'ELSE_IF',
        'ELSE',
        'END_IF',
        'WHILE',
        'END_WHILE',
      ]),
      allowedScopes: [...ALL_SCOPES],
      showScopeSelector: true,
      allowRepeatBadges: true,
      allowVariables: true,
      allowRecursion: true,
      paletteVariableBadges: DEFAULT_PALETTE_VAR_BADGES,
      subpaletteVariableNames: ALL_VARIABLE_NAMES,
      subpaletteOperandVarNames: ALL_VARIABLE_NAMES.slice(0, 8),
      allowActionParams: true,
      canUseSubpaletteParams: true,
      allowedSensors: undefined,
      allowedCombinators: undefined,
      allowedValueSensors: undefined,
      allowedVarOps: undefined,
      allowedCmpOps: undefined,
      allowInteractiveEvents: true,
      allowedDepotStations: undefined,
      allowedDepotGates: undefined,
    };
  }

  const palette = activity.palette;
  const { stations: allowedDepotStations, gates: allowedDepotGates } =
    computeAllowedDepotStationsAndGates(activity, activeDemoTabIndex);

  const visibleSimItems =
    palette.allowedSimBlocks !== undefined
      ? simPaletteItems.filter((item) => palette.allowedSimBlocks!.includes(item.actionType))
      : simPaletteItems;

  const allowedControlTypes = new Set<string>(palette.allowedControlBlocks ?? []);
  if (allowedControlTypes.has('LOOP_START')) {
    allowedControlTypes.add('LOOP_END');
  }
  if (allowedControlTypes.has('IF')) {
    allowedControlTypes.add('END_IF');
  }
  if (allowedControlTypes.has('WHILE')) {
    allowedControlTypes.add('END_WHILE');
  }

  const allowedScopes: ScopeType[] =
    palette.allowedScopes && palette.allowedScopes.length > 0
      ? palette.allowedScopes
      : ['MAIN'];

  const showScopeSelector =
    allowedScopes.length > 1 || allowedScopes.some((s) => s !== 'MAIN');

  const isPreRepeatModule = activity.moduleId === 'seq' || activity.id.startsWith('seq.');
  const allowRepeatBadges =
    allowedControlTypes.has('LOOP_START') ||
    (!isPreRepeatModule && palette.allowRepeatBadges !== false);
  const allowVariables = palette.allowVariables === true;
  const allowRecursion = palette.allowRecursion !== false;

  const paletteVariableBadges: readonly VariableName[] = !allowVariables
    ? []
    : palette.allowedVariableNames !== undefined
    ? palette.allowedVariableNames
    : DEFAULT_PALETTE_VAR_BADGES;

  const subpaletteVariableNames: readonly VariableName[] =
    palette.allowedVariableNames !== undefined
      ? palette.allowedVariableNames
      : ALL_VARIABLE_NAMES;

  const subpaletteOperandVarNames: readonly VariableName[] =
    palette.allowedVariableNames !== undefined
      ? palette.allowedVariableNames
      : ALL_VARIABLE_NAMES.slice(0, 8);

  const allowActionParams = palette.allowActionParams !== false;

  const hasAnyAllowedSimParams =
    allowActionParams &&
    visibleSimItems.some(
      (item) =>
        getAllowedParamDefs(
          item.actionType,
          item.paramDefs,
          'curriculum',
          palette,
          activity,
          activeDemoTabIndex
        ).length > 0
    );

  const hasAllowedVarControlBlock =
    allowedControlTypes.has('VAR_ASSIGN') || allowedControlTypes.has('VAR_OP');

  const hasAllowedConditionControlBlock =
    allowedControlTypes.has('IF') ||
    allowedControlTypes.has('ELSE_IF') ||
    allowedControlTypes.has('WHILE');

  const canUseSubpaletteParams =
    hasAnyAllowedSimParams || hasAllowedVarControlBlock || hasAllowedConditionControlBlock;

  return {
    isCurriculum: true,
    palette,
    visibleSimItems,
    allowedControlTypes,
    allowedScopes,
    showScopeSelector,
    allowRepeatBadges,
    allowVariables,
    allowRecursion,
    paletteVariableBadges,
    subpaletteVariableNames,
    subpaletteOperandVarNames,
    allowActionParams,
    canUseSubpaletteParams,
    allowedSensors: palette.allowedSensors,
    allowedCombinators: palette.allowedCombinators,
    allowedValueSensors: palette.allowedValueSensors,
    allowedVarOps: (palette.allowedVarOps as BinaryOp[]) ?? ['+', '-'],
    allowedCmpOps: palette.allowedCmpOps,
    allowInteractiveEvents:
      Boolean(palette.allowInteractiveEvents) ||
      allowedScopes.some((s) => s.startsWith('ON_')),
    allowedDepotStations,
    allowedDepotGates,
  };
}

export const CONTROL_PAIR_CLOSER: Readonly<Record<string, string>> = {
  LOOP_START: 'LOOP_END',
  IF: 'END_IF',
  WHILE: 'END_WHILE',
};

/**
 * Returns the closing structural block type for a pair-opener (`LOOP_START` -> `LOOP_END`,
 * `IF` -> `END_IF`, `WHILE` -> `END_WHILE`), or `null` for single-slot blocks.
 */
export function getControlPairCloserType(blockType: string): string | null {
  return CONTROL_PAIR_CLOSER[blockType] ?? null;
}

/**
 * Number of workspace slots consumed when inserting `blockType` (2 for atomic control pairs).
 */
export function getRequiredSlotCostForBlockType(blockType: string): number {
  return blockType in CONTROL_PAIR_CLOSER ? 2 : 1;
}

/**
 * True when `budget` has enough free slots in the active scope to insert `blockType` atomically.
 */
export function canInsertBlockIntoBudget(
  budget: SlotBudgetStatus,
  blockType: string
): boolean {
  if (!budget.isCapped || budget.remainingForScope === null) {
    return true;
  }
  return budget.remainingForScope >= getRequiredSlotCostForBlockType(blockType);
}

export function normalizeColorLiteralParam(color: string | number): string {
  const raw = String(color).trim().toLowerCase();
  const stripped = raw.startsWith('color:') ? raw.slice(6) : raw;
  const mapped = stripped === 'yellow' ? 'amber' : stripped;
  return `color:${mapped}`;
}

/**
 * Resolves a valid initial ConditionExpr for newly inserted `IF` / `ELSE_IF` / `WHILE` blocks
 * honoring staged `allowedSensors`, active `$input` config, and simulation environment defaults.
 */
export function resolveDefaultConditionForContext(
  simId: string,
  palette?: PaletteConfig,
  inputConfig?: SceneInputConfig | null,
  allowedDepotStations?: ReadonlySet<string>
): ConditionExpr {
  const allowed = palette?.allowedSensors;
  const allowsInput =
    Boolean(inputConfig && inputConfig.options.length > 0) &&
    (allowed === undefined || allowed.length === 0 || allowed.includes('$input'));

  if (allowed && allowed.length > 0) {
    const first = allowed[0];
    if (first === '$input' && inputConfig && inputConfig.options.length > 0) {
      const opt = inputConfig.previewInput ?? inputConfig.options[0];
      return {
        kind: 'cmp',
        op: '=',
        left: '$input',
        right:
          inputConfig.mode === 'color' ? normalizeColorLiteralParam(opt) : Number(opt),
      };
    }
    if (
      first === 'tileColor' ||
      first === 'itemColor' ||
      first === 'heldColor' ||
      first === 'topColor'
    ) {
      return { kind: 'sensor', sensor: first, param: 'red' };
    }
    if (first === 'itemIcon') {
      return { kind: 'sensor', sensor: first, param: 'crate' };
    }
    if (first === 'stationEmpty') {
      const defaultStation =
        allowedDepotStations && allowedDepotStations.size > 0
          ? allowedDepotStations.has('QUEUE')
            ? 'QUEUE'
            : Array.from(allowedDepotStations)[0] ?? 'CURRENT'
          : 'QUEUE';
      return { kind: 'sensor', sensor: first, param: defaultStation };
    }
    if (first !== '$input') {
      return { kind: 'sensor', sensor: first as ConditionSensorType };
    }
  }

  if (allowsInput && inputConfig) {
    const opt = inputConfig.previewInput ?? inputConfig.options[0];
    return {
      kind: 'cmp',
      op: '=',
      left: '$input',
      right:
        inputConfig.mode === 'color' ? normalizeColorLiteralParam(opt) : Number(opt),
    };
  }

  switch (simId) {
    case 'switchyard':
      return { kind: 'sensor', sensor: 'hasNextItem' };
    case 'depot':
      return { kind: 'sensor', sensor: 'hasItem' };
    case 'turtle':
      return { kind: 'sensor', sensor: 'insideCanvas' };
    case 'beat':
      return { kind: 'sensor', sensor: 'cursorAtEdge' };
    case 'grid':
    default:
      return { kind: 'sensor', sensor: 'pathAhead' };
  }
}

export interface SlotBudgetStatus {
  /** Whether a physical slot cap applies to the active scope (either via perScope or maxTotal) */
  isCapped: boolean;
  /** Blocks currently placed in `scope` */
  scopeUsed: number;
  /** Blocks currently placed across all scopes (`MAIN`, `F1`, `F2`, `F3`) */
  totalUsed: number;
  /** Explicit per-scope cap for `scope`, if configured */
  scopeLimit?: number;
  /** Explicit global total cap across all scopes, if configured */
  totalLimit?: number;
  /** How many additional blocks can be inserted into `scope` right now (`null` if uncapped) */
  remainingForScope: number | null;
  /** Total physical slots (`[■] + [□]`) to display in `scope`'s workspace tray (`null` if uncapped) */
  effectiveScopeSlots: number | null;
  /** Whether `perScope[scope]` is at or above capacity */
  isScopeFull: boolean;
  /** Whether `maxTotal` is at or above capacity */
  isTotalFull: boolean;
  /** Whether inserting 1 more block into `scope` must be rejected */
  isFull: boolean;
  /** Numerator for the visual slot counter */
  counterUsed: number;
  /** Denominator for the visual slot counter (`null` if uncapped) */
  counterMax: number | null;
}

/**
 * Computes physical slot-tray capacity and remaining empty slots for `scope`.
 */
export function computeSlotBudget(
  workspace: WorkspaceState,
  scope: ScopeType,
  appMode: AppMode,
  slotCap?: SlotCapConfig
): SlotBudgetStatus {
  const scopeUsed = workspace[scope]?.length ?? 0;
  const totalUsed = (
    [
      ...ALL_SCOPES,
      'ON_TAP',
      'ON_KEY_UP',
      'ON_KEY_DOWN',
      'ON_KEY_LEFT',
      'ON_KEY_RIGHT',
      'ON_KEY_A',
      'ON_KEY_B',
    ] as ScopeType[]
  ).reduce((sum, s) => sum + (workspace[s]?.length ?? 0), 0);

  if (appMode !== 'curriculum' || !slotCap) {
    return {
      isCapped: false,
      scopeUsed,
      totalUsed,
      remainingForScope: null,
      effectiveScopeSlots: null,
      isScopeFull: false,
      isTotalFull: false,
      isFull: false,
      counterUsed: scopeUsed,
      counterMax: null,
    };
  }

  const scopeLimit = slotCap.perScope?.[scope];
  const totalLimit = slotCap.maxTotal;

  if (scopeLimit === undefined && totalLimit === undefined) {
    return {
      isCapped: false,
      scopeUsed,
      totalUsed,
      remainingForScope: null,
      effectiveScopeSlots: null,
      isScopeFull: false,
      isTotalFull: false,
      isFull: false,
      counterUsed: scopeUsed,
      counterMax: null,
    };
  }

  const remByScope =
    scopeLimit !== undefined ? Math.max(0, scopeLimit - scopeUsed) : Number.POSITIVE_INFINITY;
  const remByTotal =
    totalLimit !== undefined ? Math.max(0, totalLimit - totalUsed) : Number.POSITIVE_INFINITY;

  const remainingForScope = Math.min(remByScope, remByTotal);
  const effectiveScopeSlots = scopeUsed + remainingForScope;

  const isScopeFull = scopeLimit !== undefined && scopeUsed >= scopeLimit;
  const isTotalFull = totalLimit !== undefined && totalUsed >= totalLimit;
  const isFull = remainingForScope <= 0;

  // Prefer perScope counter when perScope[scope] is explicitly configured (unless constrained tighter by maxTotal),
  // otherwise show global totalUsed / totalLimit.
  let counterUsed: number;
  let counterMax: number;
  if (scopeLimit !== undefined) {
    counterUsed = scopeUsed;
    counterMax = effectiveScopeSlots;
  } else {
    counterUsed = totalUsed;
    counterMax = totalLimit!;
  }

  return {
    isCapped: true,
    scopeUsed,
    totalUsed,
    scopeLimit,
    totalLimit,
    remainingForScope,
    effectiveScopeSlots,
    isScopeFull,
    isTotalFull,
    isFull,
    counterUsed,
    counterMax,
  };
}

/**
 * Formats a concise, screen-reader-friendly (`aria-live="polite"`) announcement when the slot tray is full.
 */
export function formatSlotCapFullAnnouncement(
  budget: SlotBudgetStatus,
  scope: ScopeType,
  allowedScopes: readonly ScopeType[],
  requiredSlots: number = 1
): string {
  const isMultiScope = allowedScopes.length > 1 || allowedScopes.some((s) => s !== 'MAIN');
  const scopeLabel = scope === 'MAIN' ? 'Main' : scope;

  if (
    requiredSlots > 1 &&
    budget.remainingForScope !== null &&
    budget.remainingForScope > 0 &&
    budget.remainingForScope < requiredSlots
  ) {
    return `Need ${requiredSlots} open block slots for this control pair (${budget.remainingForScope} left). Remove a block to add it.`;
  }

  if (budget.isScopeFull && budget.scopeLimit !== undefined && isMultiScope) {
    return `Block tray full in ${scopeLabel} (${budget.scopeUsed} of ${budget.scopeLimit} slots used). Remove a block to add another.`;
  }

  if (budget.isTotalFull && budget.totalLimit !== undefined) {
    return `Block tray full (${budget.totalUsed} of ${budget.totalLimit} slots used). Remove a block to add another.`;
  }

  const max = budget.counterMax ?? budget.scopeUsed;
  return `Block tray full (${budget.counterUsed} of ${max} slots used). Remove a block to add another.`;
}

/**
 * Returns true when Instant execution speed must be disabled (Beat & Light world, or
 * pure showing / explanation curriculum lessons so kids watch step-by-step demonstrations).
 */
export function isInstantSpeedDisabled(
  appMode: AppMode,
  activeSimId: string,
  activity?: CurriculumActivity
): boolean {
  if (activeSimId === 'beat') return true;
  if (appMode === 'curriculum' && activity?.format === 'explanation') return true;
  return false;
}

/**
 * Returns true when a curriculum activity is a validated puzzle exercise (or puzzle capstone).
 */
export function isPuzzleExerciseActivity(activity?: CurriculumActivity): boolean {
  if (!activity) return false;
  return (
    activity.format === 'puzzle' ||
    (activity.format === 'capstone' &&
      (activity.capstoneType === 'puzzle' || Boolean(activity.referenceSolution)))
  );
}

/**
 * Returns true when a curriculum activity is an open / creative lesson (or creative capstone).
 */
export function isCreativeOpenLessonActivity(activity?: CurriculumActivity): boolean {
  if (!activity) return false;
  if (isPuzzleExerciseActivity(activity)) return false;
  return (
    activity.format === 'sandbox' ||
    (activity.format === 'capstone' &&
      (activity.capstoneType === 'creative' ||
        (activity.capstoneType as string) === 'sandbox'))
  );
}

/**
 * Finds the next demo tab index after `activeIndex` that has not yet been viewed, wrapping
 * around once from the end. Returns `null` when every demo tab has been viewed at least once.
 */
export function findNextUnviewedDemoTabIndex(
  demoTabs: readonly { id: string }[],
  activeIndex: number,
  viewedTabIds: readonly string[]
): number | null {
  if (demoTabs.length <= 1) return null;
  const clampedActiveIndex = Math.min(Math.max(0, activeIndex), demoTabs.length - 1);
  const viewedSet = new Set<string>([...viewedTabIds, demoTabs[clampedActiveIndex].id]);
  for (let offset = 1; offset < demoTabs.length; offset++) {
    const candidateIdx = (clampedActiveIndex + offset) % demoTabs.length;
    if (!viewedSet.has(demoTabs[candidateIdx].id)) {
      return candidateIdx;
    }
  }
  return null;
}

/**
 * Returns the ordered track of activities isolated to the same track as `activityId`:
 * - When `current.format === 'challenge'`, returns only challenge activities.
 * - Otherwise returns only core curriculum activities (`format !== 'challenge'`).
 */
export function getCurriculumTrackActivities(
  activityId: string,
  catalog: readonly CurriculumActivity[] = CURRICULUM_ACTIVITIES
): CurriculumActivity[] {
  const current = catalog.find((a) => a.id === activityId);
  if (!current) {
    return catalog.filter((a) => a.format !== 'challenge');
  }
  const isChallenge = current.format === 'challenge';
  return catalog.filter((a) =>
    isChallenge ? a.format === 'challenge' : a.format !== 'challenge'
  );
}

/**
 * Returns the next curriculum activity in the same isolated track (core vs challenge),
 * or undefined if at the end (unless `wrap` is true).
 */
export function getNextCurriculumActivity(
  activityId: string,
  catalog: readonly CurriculumActivity[] = CURRICULUM_ACTIVITIES,
  wrap = false
): CurriculumActivity | undefined {
  const track = getCurriculumTrackActivities(activityId, catalog);
  if (track.length === 0) return undefined;
  const idx = track.findIndex((a) => a.id === activityId);
  if (idx < 0) {
    return wrap ? track[0] : undefined;
  }
  if (idx < track.length - 1) {
    return track[idx + 1];
  }
  return wrap ? track[0] : undefined;
}

/**
 * Returns the previous curriculum activity in the same isolated track (core vs challenge),
 * or undefined if at the start (unless `wrap` is true).
 */
export function getPrevCurriculumActivity(
  activityId: string,
  catalog: readonly CurriculumActivity[] = CURRICULUM_ACTIVITIES,
  wrap = false
): CurriculumActivity | undefined {
  const track = getCurriculumTrackActivities(activityId, catalog);
  if (track.length === 0) return undefined;
  const idx = track.findIndex((a) => a.id === activityId);
  if (idx < 0) {
    return wrap ? track[track.length - 1] : undefined;
  }
  if (idx > 0) {
    return track[idx - 1];
  }
  return wrap ? track[track.length - 1] : undefined;
}
