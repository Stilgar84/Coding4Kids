import { ActionParamDef, SimPaletteItem } from '../engine/simulation/types';
import {
  ALL_VARIABLE_NAMES,
  ScopeType,
  VariableName,
  WorkspaceState,
} from '../types';
import {
  AppMode,
  CurriculumActivity,
  PaletteConfig,
  SlotCapConfig,
  getActivityAtVersion,
  getActivityLatest,
} from '../data/curriculum';

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
 * Filters a block's ActionParamDef list according to the active mode and PaletteConfig.
 */
export function getAllowedParamDefs(
  blockType: string,
  paramDefs: ActionParamDef[] | undefined,
  appMode: AppMode,
  palette?: PaletteConfig
): ActionParamDef[] {
  if (!paramDefs || paramDefs.length === 0) return [];
  if (appMode !== 'curriculum' || !palette) return paramDefs;
  if (palette.allowActionParams === false) return [];

  if (palette.allowedBlockParams !== undefined) {
    const allowedIds = palette.allowedBlockParams[blockType] ?? [];
    return paramDefs.filter((def) => allowedIds.includes(def.id));
  }

  return paramDefs;
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
  paletteVariableBadges: readonly VariableName[];
  subpaletteVariableNames: readonly VariableName[];
  subpaletteOperandVarNames: readonly VariableName[];
  allowActionParams: boolean;
  canUseSubpaletteParams: boolean;
}

/**
 * Computes the complete staged palette visibility policy for the current mode & activity.
 * In 'sandbox' mode (or if no curriculum activity is resolved), everything is unrestricted.
 */
export function computeStagedPalettePolicy(
  appMode: AppMode,
  activity: CurriculumActivity | undefined,
  simPaletteItems: SimPaletteItem[]
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
      ]),
      allowedScopes: [...ALL_SCOPES],
      showScopeSelector: true,
      allowRepeatBadges: true,
      allowVariables: true,
      paletteVariableBadges: DEFAULT_PALETTE_VAR_BADGES,
      subpaletteVariableNames: ALL_VARIABLE_NAMES,
      subpaletteOperandVarNames: ALL_VARIABLE_NAMES.slice(0, 8),
      allowActionParams: true,
      canUseSubpaletteParams: true,
    };
  }

  const palette = activity.palette;

  const visibleSimItems =
    palette.allowedSimBlocks !== undefined
      ? simPaletteItems.filter((item) => palette.allowedSimBlocks!.includes(item.actionType))
      : simPaletteItems;

  const allowedControlTypes = new Set<string>(palette.allowedControlBlocks ?? []);

  const allowedScopes: ScopeType[] =
    palette.allowedScopes && palette.allowedScopes.length > 0
      ? palette.allowedScopes
      : ['MAIN'];

  const showScopeSelector =
    allowedScopes.length > 1 || allowedScopes.some((s) => s !== 'MAIN');

  const allowRepeatBadges = palette.allowRepeatBadges === true;
  const allowVariables = palette.allowVariables === true;

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
        getAllowedParamDefs(item.actionType, item.paramDefs, 'curriculum', palette).length > 0
    );

  const hasAllowedVarControlBlock =
    allowedControlTypes.has('VAR_ASSIGN') || allowedControlTypes.has('VAR_OP');

  const canUseSubpaletteParams = hasAnyAllowedSimParams || hasAllowedVarControlBlock;

  return {
    isCurriculum: true,
    palette,
    visibleSimItems,
    allowedControlTypes,
    allowedScopes,
    showScopeSelector,
    allowRepeatBadges,
    allowVariables,
    paletteVariableBadges,
    subpaletteVariableNames,
    subpaletteOperandVarNames,
    allowActionParams,
    canUseSubpaletteParams,
  };
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
  const totalUsed = ALL_SCOPES.reduce((sum, s) => sum + (workspace[s]?.length ?? 0), 0);

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
  allowedScopes: readonly ScopeType[]
): string {
  const isMultiScope = allowedScopes.length > 1 || allowedScopes.some((s) => s !== 'MAIN');
  const scopeLabel = scope === 'MAIN' ? 'Main' : scope;

  if (budget.isScopeFull && budget.scopeLimit !== undefined && isMultiScope) {
    return `Block tray full in ${scopeLabel} (${budget.scopeUsed} of ${budget.scopeLimit} slots used). Remove a block to add another.`;
  }

  if (budget.isTotalFull && budget.totalLimit !== undefined) {
    return `Block tray full (${budget.totalUsed} of ${budget.totalLimit} slots used). Remove a block to add another.`;
  }

  const max = budget.counterMax ?? budget.scopeUsed;
  return `Block tray full (${budget.counterUsed} of ${max} slots used). Remove a block to add another.`;
}
