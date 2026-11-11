import {
  CodeBlock,
  Direction,
  GridState,
  ScopeType,
  SimulationStatus,
  WorkspaceState,
} from '../../types';
import {
  AntiBypassRule,
  CurriculumActivity,
  CurriculumGridDefinition,
  PaletteConfig,
  SlotCapConfig,
  createCurriculumGridState,
} from '../../data/curriculum/types';
import { SimulationEnvironment } from '../simulation/types';
import {
  MAX_TOTAL_STEPS,
  createInitialInterpreterState,
  tickInterpreter,
  validateLoopStructure,
} from '../interpreter';
import {
  doesBlockMatchHintCategory,
  getPlaceholderHintCategory,
} from '../placeholderHelpers';
import { ALL_SCOPES, computeSlotBudget } from '../../utils/curriculumStagePolicy';
import { gridSimulationEnvironment } from '../../simulations/grid/gridEnvironment';

export interface SolverOptions {
  /**
   * Optional SimulationEnvironment override (defaults to `gridSimulationEnvironment`).
   * Enables testing forward-compatible Module 2 interactive world-item physics cleanly.
   */
  simEnv?: SimulationEnvironment<GridState>;
  /**
   * Optional maximum depth past `slotCap` for loop-free BFS so `minWinningBlocks`
   * can still report exact unrolled block counts (e.g., `9` on a `5`-slot puzzle).
   */
  extraBfsDepthBeyondCap?: number;
}

export interface ReferenceSolutionCheckResult {
  passed: boolean;
  reason?: string;
  status?: SimulationStatus;
  blockCount: number;
  slotLimit?: number;
  paletteViolations: string[];
}

export interface ScaffoldCheckResult {
  applicable: boolean;
  passed: boolean;
  reason?: string;
  blockCount: number;
  placeholderCount: number;
  completedWorkspace?: WorkspaceState;
}

export interface RuleCheckResult {
  ruleId: string;
  description: string;
  rule: AntiBypassRule;
  passed: boolean;
  elapsedMs: number;
  exploredStates: number;
  minWinningBlocks: number | null;
  counterexampleWorkspace?: WorkspaceState;
  formattedCounterexample?: string;
  diagnostic?: string;
}

export interface ActivityConstraintReport {
  activityId: string;
  activityTitle: string;
  passed: boolean;
  elapsedMs: number;
  slotCap?: number;
  referenceCheck: ReferenceSolutionCheckResult;
  scaffoldCheck: ScaffoldCheckResult;
  ruleResults: RuleCheckResult[];
}

export type ConstraintCheckReport = ActivityConstraintReport;

interface CandidateActionSpec {
  idx: number;
  actionType: string;
  repeatCount: number;
  params?: Record<string, unknown>;
}

type AstNode =
  | {
      kind: 'action';
      spec: CandidateActionSpec;
      slotCost: 1;
    }
  | {
      kind: 'loop';
      count: number;
      body: AstNode[];
      slotCost: number;
    };

interface SingleStepTransition {
  status: 'RUNNING' | 'SUCCESS' | 'COLLISION';
  nextGrid: GridState;
  nextBaseKey: string;
}

interface ActionBlockTransition {
  status: 'RUNNING' | 'SUCCESS' | 'COLLISION';
  nextGrid: GridState;
  nextBaseKey: string;
  executedTicks: number;
}

interface EnvExecutionSummary {
  finalState: GridState;
  status: SimulationStatus;
  stepCount: number;
  actionExecutions: Record<string, number>;
}

const DIR_CODE: Record<Direction, string> = {
  NORTH: 'N',
  EAST: 'E',
  SOUTH: 'S',
  WEST: 'W',
};

const CORE_CONTROL_BLOCK_TYPES = new Set<string>([
  'LOOP_START',
  'LOOP_END',
  'CALL_F1',
  'CALL_F2',
  'CALL_F3',
  'VAR_ASSIGN',
  'VAR_OP',
]);

function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function deepCloneValue<T>(val: T): T {
  if (val === null || typeof val !== 'object') return val;
  if (Array.isArray(val)) {
    return val.map((item) => deepCloneValue(item)) as unknown as T;
  }
  const copy: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
    copy[k] = deepCloneValue(v);
  }
  return copy as T;
}

/**
 * Builds a clean, reset `GridState` from a `CurriculumGridDefinition`, preserving
 * both Module 1 fields and any Module 2 interactive world-item extensions
 * (`waterCells`, `lockedGates`, `floorSwitches`, `worldItems`, `items`, `carriedItem`).
 */
export function buildSolverInitialGridState(
  def: CurriculumGridDefinition,
  simEnv: SimulationEnvironment<GridState> = gridSimulationEnvironment
): GridState {
  const base = createCurriculumGridState(def, false);
  const rawDef = def as unknown as Record<string, unknown>;
  const rawBase = base as unknown as Record<string, unknown>;

  for (const extraKey of [
    'waterCells',
    'bridgedWaterCells',
    'lockedGates',
    'floorSwitches',
    'worldItems',
    'items',
    'bridgedWater',
  ]) {
    if (rawDef[extraKey] !== undefined && rawBase[extraKey] === undefined) {
      rawBase[extraKey] = deepCloneValue(rawDef[extraKey]);
    }
  }

  // If `def.worldItems` is present and `items` is also expected by M2 physics (or vice versa),
  // preserve `worldItems` as provided while letting `simEnv.resetState` normalize if needed.
  const rawDefRobot = def.robot as unknown as Record<string, unknown>;
  if (rawDefRobot.carriedItem !== undefined) {
    (base.robot as unknown as Record<string, unknown>).carriedItem = deepCloneValue(
      rawDefRobot.carriedItem
    );
  }

  return simEnv.resetState(base);
}

/**
 * Canonicalizes a `GridState` into a compact, deterministic state key covering:
 * `(x, y, dir, collectedFlagsBitmask, bridgedWaterBitmask, unlockedGatesBitmask,
 *   activeSwitchesBitmask, worldItemsState, carriedItemCode)`.
 *
 * Uses optional duck-typed inspection for Module 2 interactive world-item fields so
 * Module 1 puzzles pay near-zero overhead while Module 2 (`Commit 14`) water, gates,
 * switches, floor items, and carried backpack items are automatically distinguished.
 */
export function canonicalizeGridState(
  state: GridState,
  initialRef?: GridState
): string {
  const { robot, flags } = state;
  const dirCode = DIR_CODE[robot.dir] ?? robot.dir;

  // 1. Collected flags bitmask (supports >30 flags via bit-string fallback)
  let flagsPart: string;
  if (flags.length <= 30) {
    let mask = 0;
    for (let i = 0; i < flags.length; i++) {
      if (flags[i].collected) {
        mask |= 1 << i;
      }
    }
    flagsPart = mask.toString(36);
  } else {
    let bits = '';
    for (let i = 0; i < flags.length; i++) {
      bits += flags[i].collected ? '1' : '0';
    }
    flagsPart = bits;
  }

  let key = `${robot.x},${robot.y},${dirCode},${flagsPart}`;

  const raw = state as unknown as Record<string, unknown>;
  const rawInit = initialRef as unknown as Record<string, unknown> | undefined;
  const rawRobot = robot as unknown as Record<string, unknown>;

  // 2. Water cells / bridged water bitmask & state
  const waterCells = raw.waterCells as Array<Record<string, unknown>> | undefined;
  const initWaterCells = rawInit?.waterCells as Array<Record<string, unknown>> | undefined;
  const bridgedWater = (raw.bridgedWaterCells ?? raw.bridgedWater) as
    | Array<Record<string, unknown>>
    | undefined;
  if (waterCells !== undefined || initWaterCells !== undefined || bridgedWater !== undefined) {
    if (initWaterCells && initWaterCells.length > 0 && initWaterCells.length <= 30) {
      let bridgedMask = 0;
      for (let i = 0; i < initWaterCells.length; i++) {
        const iw = initWaterCells[i];
        const stillOpen = waterCells?.some(
          (w) =>
            w.x === iw.x &&
            w.y === iw.y &&
            w.bridged !== true &&
            w.isBridged !== true
        );
        const explicitlyBridged = bridgedWater?.some(
          (bw) => bw.x === iw.x && bw.y === iw.y
        );
        if (!stillOpen || explicitlyBridged) {
          bridgedMask |= 1 << i;
        }
      }
      key += `|w:${bridgedMask.toString(36)}`;
    } else if (waterCells && waterCells.length > 0) {
      const wSig = waterCells
        .map((w) => {
          const isBridged =
            Boolean(w.bridged || w.isBridged) ||
            Boolean(bridgedWater?.some((bw) => bw.x === w.x && bw.y === w.y));
          return `${w.x},${w.y}:${isBridged ? 1 : 0}`;
        })
        .join(';');
      key += `|w:${wSig}`;
    } else {
      key += '|w:0';
    }
  }

  // 3. Locked gates bitmask & dynamic barrier count check
  const lockedGates = raw.lockedGates as Array<Record<string, unknown>> | undefined;
  const initGates = rawInit?.lockedGates as Array<Record<string, unknown>> | undefined;
  if (lockedGates !== undefined || initGates !== undefined) {
    if (initGates && initGates.length > 0 && initGates.length <= 30) {
      let unlockedMask = 0;
      for (let i = 0; i < initGates.length; i++) {
        const ig = initGates[i];
        const matching = lockedGates?.find(
          (g) =>
            (ig.id !== undefined && g.id === ig.id) ||
            (g.x === ig.x && g.y === ig.y && g.orientation === ig.orientation)
        );
        const isUnlocked =
          !matching ||
          matching.unlocked === true ||
          matching.open === true ||
          matching.isOpen === true ||
          matching.locked === false;
        if (isUnlocked) {
          unlockedMask |= 1 << i;
        }
      }
      key += `|g:${unlockedMask.toString(36)}`;
    } else if (lockedGates && lockedGates.length > 0) {
      const gSig = lockedGates
        .map(
          (g, idx) =>
            `${g.id ?? idx}@${g.x ?? ''},${g.y ?? ''},${g.orientation ?? ''}:${
              g.unlocked || g.open || g.isOpen || g.locked === false ? 1 : 0
            }`
        )
        .join(';');
      key += `|g:${gSig}`;
    } else {
      key += '|g:0';
    }
  }

  if (initialRef && state.barriers.length !== initialRef.barriers.length) {
    const bSig = state.barriers
      .map((b) => `${b.orientation}${b.x},${b.y}`)
      .sort()
      .join(';');
    key += `|b:${bSig}`;
  }

  // 4. Floor switches bitmask
  const floorSwitches = raw.floorSwitches as Array<Record<string, unknown>> | undefined;
  if (floorSwitches && floorSwitches.length > 0) {
    if (floorSwitches.length <= 30) {
      let switchMask = 0;
      for (let i = 0; i < floorSwitches.length; i++) {
        const sw = floorSwitches[i];
        if (sw.active || sw.pressed || sw.isPressed || sw.triggered || sw.satisfied) {
          switchMask |= 1 << i;
        }
      }
      key += `|s:${switchMask.toString(36)}`;
    } else {
      const sSig = floorSwitches
        .map((sw) =>
          sw.active || sw.pressed || sw.isPressed || sw.triggered || sw.satisfied ? '1' : '0'
        )
        .join('');
      key += `|s:${sSig}`;
    }
  }

  // 5. World items on floor (`worldItems` or `items`)
  const floorItems = (raw.items ?? raw.worldItems) as
    | Array<Record<string, unknown>>
    | undefined;
  if (floorItems !== undefined) {
    const activeEntries: string[] = [];
    for (let i = 0; i < floorItems.length; i++) {
      const it = floorItems[i];
      if (it.pickedUp || it.collected || it.consumed || it.removed) {
        continue;
      }
      const kind = String(it.type ?? it.kind ?? 'item');
      const variant = String(
        it.keyId ??
          (it.color || it.shape ? `${it.color ?? ''}-${it.shape ?? ''}` : (it.colorId ?? it.size ?? ''))
      );
      activeEntries.push(`${kind}:${variant}@${it.x},${it.y}`);
    }
    activeEntries.sort();
    key += `|i:${activeEntries.join(';')}`;
  }

  // 6. Carried backpack item (`robot.carriedItem`, `state.carriedItem`, or `robot.backpack`)
  const carried =
    rawRobot.carriedItem ??
    raw.carriedItem ??
    rawRobot.backpack ??
    raw.backpack;
  if (carried !== undefined && carried !== null) {
    if (typeof carried === 'string' || typeof carried === 'number') {
      key += `|c:${carried}`;
    } else if (typeof carried === 'object') {
      const ci = carried as Record<string, unknown>;
      const kind = String(ci.type ?? ci.kind ?? 'item');
      const variant = String(
        ci.keyId ??
          (ci.color || ci.shape ? `${ci.color ?? ''}-${ci.shape ?? ''}` : (ci.colorId ?? ci.size ?? ''))
      );
      key += `|c:${kind}:${variant}`;
    }
  } else if (
    rawRobot.carriedItem !== undefined ||
    raw.carriedItem !== undefined ||
    floorItems !== undefined
  ) {
    key += '|c:-';
  }

  return key;
}

/**
 * Counts total placed blocks across all workspace scopes (`MAIN`, `F1`, `F2`, `F3`).
 */
export function countWorkspaceBlocks(workspace: WorkspaceState): number {
  let total = 0;
  for (const scope of ALL_SCOPES) {
    total += workspace[scope]?.length ?? 0;
  }
  return total;
}

/**
 * Formats a single `CodeBlock` into a concise human-readable token (e.g., `MOVE_FWD ×3`).
 */
export function formatBlockCompact(block: CodeBlock): string {
  if (block.type === 'LOOP_START') {
    const count = block.repeatCount ?? 2;
    return `LOOP_START ×${count}`;
  }
  if (block.type === 'LOOP_END') {
    return 'LOOP_END';
  }
  if (block.type === 'PLACEHOLDER') {
    const hint = getPlaceholderHintCategory(block);
    return hint === 'any' ? '?' : `?(${hint})`;
  }

  let token = block.type;
  if (block.params && Object.keys(block.params).length > 0) {
    const entries = Object.entries(block.params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${String(v)}`)
      .join(',');
    token += `(${entries})`;
  }
  if (block.repeatCount !== undefined && block.repeatCount !== 1) {
    token += ` ×${block.repeatCount}`;
  }
  return token;
}

/**
 * Formats a `WorkspaceState` into a concise human-readable block sequence
 * (e.g., `[MOVE_FWD ×3, TURN_RIGHT, MOVE_FWD ×2]`) for test failure messages and `?dev=1`.
 */
export function formatWorkspaceCompact(workspace: WorkspaceState): string {
  const nonEmptyScopes = ALL_SCOPES.filter((s) => (workspace[s]?.length ?? 0) > 0);
  if (nonEmptyScopes.length === 0) {
    return '[]';
  }
  if (nonEmptyScopes.length === 1 && nonEmptyScopes[0] === 'MAIN') {
    return `[${workspace.MAIN.map(formatBlockCompact).join(', ')}]`;
  }
  return nonEmptyScopes
    .map((s) => `${s}: [${(workspace[s] || []).map(formatBlockCompact).join(', ')}]`)
    .join(' | ');
}

function canonicalBlockSignature(block: CodeBlock): string {
  const defaultRep = block.type === 'LOOP_START' ? 2 : 1;
  const rep = block.repeatCount ?? defaultRep;
  let paramSig = '';
  if (block.params && Object.keys(block.params).length > 0) {
    paramSig = Object.entries(block.params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${JSON.stringify(v)}`)
      .join(',');
  }
  return `${block.type}|${rep}|${paramSig}`;
}

/**
 * Computes exact Levenshtein block edit distance between two workspaces across all scopes.
 * Each single-block insertion, deletion, or modification (type, repeatCount, or params) costs `1`.
 */
export function computeWorkspaceEditDistance(
  wsA: WorkspaceState,
  wsB: WorkspaceState
): number {
  let totalDistance = 0;

  for (const scope of ALL_SCOPES) {
    const seqA = (wsA[scope] || []).map(canonicalBlockSignature);
    const seqB = (wsB[scope] || []).map(canonicalBlockSignature);
    const m = seqA.length;
    const n = seqB.length;

    if (m === 0) {
      totalDistance += n;
      continue;
    }
    if (n === 0) {
      totalDistance += m;
      continue;
    }

    let prev = new Array<number>(n + 1);
    let curr = new Array<number>(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;

    for (let i = 1; i <= m; i++) {
      curr[0] = i;
      for (let j = 1; j <= n; j++) {
        const subCost = seqA[i - 1] === seqB[j - 1] ? 0 : 1;
        curr[j] = Math.min(
          prev[j] + 1,
          curr[j - 1] + 1,
          prev[j - 1] + subCost
        );
      }
      const tmp = prev;
      prev = curr;
      curr = tmp;
    }

    totalDistance += prev[n];
  }

  return totalDistance;
}

/**
 * Executes a `WorkspaceState` against `simEnv` using `tickInterpreter` and counts
 * exact per-action-type runtime executions.
 */
function executeWorkspaceOnEnv(
  workspace: WorkspaceState,
  initialGrid: GridState,
  simEnv: SimulationEnvironment<GridState>,
  maxSteps: number = MAX_TOTAL_STEPS
): EnvExecutionSummary {
  const actionExecutions: Record<string, number> = {};

  for (const sc of ALL_SCOPES) {
    if ((workspace[sc]?.length ?? 0) > 0) {
      const loopVal = validateLoopStructure(workspace[sc]);
      if (loopVal.hasError) {
        return {
          finalState: { ...initialGrid, status: 'IDLE' },
          status: 'IDLE',
          stepCount: 0,
          actionExecutions,
        };
      }
    }
  }

  if (countWorkspaceBlocks(workspace) === 0) {
    return {
      finalState: { ...initialGrid, status: 'IDLE' },
      status: 'IDLE',
      stepCount: 0,
      actionExecutions,
    };
  }

  let runtime = createInitialInterpreterState();
  let state = initialGrid;
  let steps = 0;

  while (steps < maxSteps) {
    // Identify whether this tick executes a domain action sub-tick
    let executedDomainAction: string | null = null;
    if (runtime.status !== 'SUCCESS' && runtime.status !== 'COLLISION') {
      // Find top non-exhausted frame
      for (let i = runtime.callStack.length - 1; i >= 0; i--) {
        const frame = runtime.callStack[i];
        const scopeBlocks = workspace[frame.scope] || [];
        if (frame.pc < scopeBlocks.length) {
          const blk = scopeBlocks[frame.pc];
          if (
            blk &&
            blk.type !== 'PLACEHOLDER' &&
            !CORE_CONTROL_BLOCK_TYPES.has(blk.type)
          ) {
            const rawRep =
              typeof blk.repeatCount === 'number'
                ? Math.round(blk.repeatCount)
                : blk.repeatCount === undefined
                ? 1
                : Math.round(runtime.variables[blk.repeatCount] ?? 1);
            if (rawRep > 0) {
              executedDomainAction = blk.type;
            }
          }
          break;
        }
      }
    }

    const res = tickInterpreter(runtime, workspace, state, simEnv);
    if (executedDomainAction !== null) {
      actionExecutions[executedDomainAction] =
        (actionExecutions[executedDomainAction] ?? 0) + 1;
    }

    runtime = res.nextRuntime;
    state = res.nextGrid;
    steps++;

    if (res.done) {
      break;
    }
  }

  const rawStatus = state.status || runtime.status;
  const status: SimulationStatus =
    rawStatus === 'SUCCESS' || rawStatus === 'COLLISION' || rawStatus === 'PAUSED'
      ? rawStatus
      : 'IDLE';

  return {
    finalState: { ...state, status },
    status,
    stepCount: steps,
    actionExecutions,
  };
}

function resolveEffectiveSlotLimit(slotCap?: SlotCapConfig): number | undefined {
  if (!slotCap) return undefined;
  const mainCap = slotCap.perScope?.MAIN;
  const totalCap = slotCap.maxTotal;
  if (mainCap !== undefined && totalCap !== undefined) {
    return Math.min(mainCap, totalCap);
  }
  return totalCap ?? mainCap;
}

function validateWorkspaceAgainstSlotCap(
  workspace: WorkspaceState,
  slotCap?: SlotCapConfig
): string | null {
  if (!slotCap) return null;
  const totalBlocks = countWorkspaceBlocks(workspace);
  if (slotCap.maxTotal !== undefined && totalBlocks > slotCap.maxTotal) {
    return `Workspace uses ${totalBlocks} blocks, exceeding maxTotal slotCap of ${slotCap.maxTotal}`;
  }
  if (slotCap.perScope) {
    for (const scope of ALL_SCOPES) {
      const limit = slotCap.perScope[scope];
      const used = workspace[scope]?.length ?? 0;
      if (limit !== undefined && used > limit) {
        return `Scope ${scope} uses ${used} blocks, exceeding perScope slotCap of ${limit}`;
      }
    }
  }
  // Cross-check with UI slot budget helper
  for (const scope of ALL_SCOPES) {
    const budget = computeSlotBudget(workspace, scope, 'curriculum', slotCap);
    if (budget.scopeLimit !== undefined && budget.scopeUsed > budget.scopeLimit) {
      return `Scope ${scope} exceeds slot budget (${budget.scopeUsed}/${budget.scopeLimit})`;
    }
  }
  return null;
}

function validateWorkspaceAgainstPalette(
  workspace: WorkspaceState,
  palette: PaletteConfig,
  simEnv: SimulationEnvironment<GridState>,
  allowPlaceholders = false
): string[] {
  const violations: string[] = [];
  const allowedScopes = new Set<ScopeType>(
    palette.allowedScopes && palette.allowedScopes.length > 0
      ? palette.allowedScopes
      : ['MAIN']
  );

  const registeredSimTypes = new Set(simEnv.paletteItems.map((p) => p.actionType));
  const allowedSimTypes =
    palette.allowedSimBlocks !== undefined
      ? new Set(palette.allowedSimBlocks)
      : registeredSimTypes;
  const allowedControlTypes = new Set(palette.allowedControlBlocks ?? []);
  const allowRepeatBadges = palette.allowRepeatBadges === true;
  const allowVariables = palette.allowVariables === true;
  const allowActionParams = palette.allowActionParams !== false;

  for (const scope of ALL_SCOPES) {
    const blocks = workspace[scope] || [];
    if (blocks.length === 0) continue;

    if (!allowedScopes.has(scope)) {
      violations.push(`Scope '${scope}' has ${blocks.length} block(s) but is not in allowedScopes`);
    }

    const loopValidation = validateLoopStructure(blocks);
    if (loopValidation.hasError) {
      violations.push(`Scope '${scope}' contains unmatched LOOP_START / LOOP_END blocks`);
    }

    for (const block of blocks) {
      if (block.type === 'PLACEHOLDER') {
        if (!allowPlaceholders) {
          violations.push(`Unexpected PLACEHOLDER ('?') block in scope '${scope}'`);
        }
        continue;
      }

      const isControl = CORE_CONTROL_BLOCK_TYPES.has(block.type);
      if (isControl) {
        if (!allowedControlTypes.has(block.type)) {
          violations.push(`Control block '${block.type}' is not permitted by palette.allowedControlBlocks`);
        }
      } else if (!allowedSimTypes.has(block.type)) {
        violations.push(`Action block '${block.type}' is not permitted by palette.allowedSimBlocks`);
      }

      if (block.repeatCount !== undefined) {
        if (typeof block.repeatCount === 'string') {
          if (!allowVariables) {
            violations.push(
              `Block '${block.type}' uses variable repeatCount '${block.repeatCount}' while allowVariables is false`
            );
          } else if (
            palette.allowedVariableNames &&
            !palette.allowedVariableNames.includes(block.repeatCount)
          ) {
            violations.push(
              `Variable '${block.repeatCount}' on '${block.type}' is not in allowedVariableNames`
            );
          }
        } else if (block.type === 'LOOP_START') {
          if (block.repeatCount < 2 || block.repeatCount > 9) {
            violations.push(
              `LOOP_START repeatCount ${block.repeatCount} is outside allowed badge range 2..9`
            );
          } else if (block.repeatCount > 2 && !allowRepeatBadges) {
            violations.push(
              `LOOP_START uses repeatCount ${block.repeatCount} (> 2) while palette.allowRepeatBadges is false`
            );
          }
        } else if (block.repeatCount !== 1) {
          if (!allowRepeatBadges) {
            violations.push(
              `Block '${block.type}' uses repeatCount ×${block.repeatCount} while palette.allowRepeatBadges is false`
            );
          } else if (block.repeatCount < 2 || block.repeatCount > 9) {
            violations.push(
              `Block '${block.type}' repeatCount ×${block.repeatCount} is outside badge range 2..9`
            );
          }
        }
      }

      if (
        !isControl &&
        block.params &&
        Object.keys(block.params).length > 0
      ) {
        if (!allowActionParams) {
          violations.push(
            `Block '${block.type}' specifies params while palette.allowActionParams is false`
          );
        } else if (palette.allowedBlockParams !== undefined) {
          const permittedKeys = new Set(palette.allowedBlockParams[block.type] ?? []);
          for (const paramKey of Object.keys(block.params)) {
            if (!permittedKeys.has(paramKey)) {
              violations.push(
                `Param '${paramKey}' on '${block.type}' is not in palette.allowedBlockParams`
              );
            }
          }
        }
      }
    }
  }

  return violations;
}

/**
 * Verifies positive invariants on `activity.referenceSolution`:
 * - Exists and fits within `slotCap`
 * - Uses only scopes, blocks, repeat badges, and parameters allowed by `activity.palette`
 * - Reaches `SUCCESS` when simulated on `activity.grid`
 */
export function checkReferenceSolution(
  activity: CurriculumActivity,
  simEnv: SimulationEnvironment<GridState> = gridSimulationEnvironment
): ReferenceSolutionCheckResult {
  const slotLimit = resolveEffectiveSlotLimit(activity.slotCap);

  if (!activity.grid) {
    return {
      passed: false,
      reason: 'Activity has no grid definition',
      blockCount: 0,
      slotLimit,
      paletteViolations: [],
    };
  }

  if (!activity.referenceSolution) {
    return {
      passed: false,
      reason: 'Activity has no referenceSolution',
      blockCount: 0,
      slotLimit,
      paletteViolations: [],
    };
  }

  const blockCount = countWorkspaceBlocks(activity.referenceSolution);
  const paletteViolations = validateWorkspaceAgainstPalette(
    activity.referenceSolution,
    activity.palette,
    simEnv,
    false
  );

  const slotError = validateWorkspaceAgainstSlotCap(
    activity.referenceSolution,
    activity.slotCap
  );
  if (slotError) {
    return {
      passed: false,
      reason: slotError,
      blockCount,
      slotLimit,
      paletteViolations,
    };
  }

  if (paletteViolations.length > 0) {
    return {
      passed: false,
      reason: paletteViolations[0],
      blockCount,
      slotLimit,
      paletteViolations,
    };
  }

  const initialGrid = buildSolverInitialGridState(activity.grid, simEnv);
  const exec = executeWorkspaceOnEnv(activity.referenceSolution, initialGrid, simEnv);
  if (exec.status !== 'SUCCESS') {
    return {
      passed: false,
      reason: `referenceSolution finished with status '${exec.status}' instead of 'SUCCESS'`,
      status: exec.status,
      blockCount,
      slotLimit,
      paletteViolations: [],
    };
  }

  return {
    passed: true,
    status: 'SUCCESS',
    blockCount,
    slotLimit,
    paletteViolations: [],
  };
}

/**
 * Builds the pruned list of single-slot candidate action blocks allowed under `(palette, rule)`.
 * Applies lossless repeat pruning (§4.1):
 * - `TURN_LEFT` / `TURN_RIGHT`: `×1, ×2` when opposite turn is also allowed (`×3 == opposite ×1`, `×4 == identity`),
 *   or `×1, ×2, ×3` when opposite turn is forbidden by `rule.forbidBlocks`.
 * - `MOVE_FWD` / `MOVE_BACK`: `×1 .. Math.min(9, Math.max(1, Math.max(width, height) - 1))`.
 * - `PICK_UP` / `USE_DROP`: `×1` (1-slot backpack).
 */
function buildCandidateActions(
  grid: CurriculumGridDefinition,
  palette: PaletteConfig,
  simEnv: SimulationEnvironment<GridState>,
  rule?: AntiBypassRule
): {
  actions: CandidateActionSpec[];
  canUseRepeatBadges: boolean;
  loopsAllowed: boolean;
  loopCounts: number[];
} {
  const forbidden = new Set(rule?.forbidBlocks ?? []);
  const baseSimTypes =
    palette.allowedSimBlocks !== undefined
      ? palette.allowedSimBlocks
      : simEnv.paletteItems.map((p) => p.actionType);

  const allowedSimTypes = baseSimTypes.filter((t) => !forbidden.has(t));
  const allowedSimSet = new Set(allowedSimTypes);

  const canUseRepeatBadges =
    palette.allowRepeatBadges === true && rule?.allowRepeatBadges !== false;

  const allowedControl = (palette.allowedControlBlocks ?? []).filter(
    (c) => !forbidden.has(c)
  );
  const hasLoopBlocks =
    allowedControl.includes('LOOP_START') && allowedControl.includes('LOOP_END');
  const loopsAllowed =
    hasLoopBlocks && (rule?.maxLoopNestingDepth === undefined || rule.maxLoopNestingDepth > 0);

  const loopCounts =
    palette.allowRepeatBadges === true ? [2, 3, 4, 5, 6, 7, 8, 9] : [2];

  const maxMoveRepeat = Math.min(
    9,
    Math.max(1, Math.max(grid.width, grid.height) - 1)
  );

  const actions: CandidateActionSpec[] = [];

  for (const actionType of allowedSimTypes) {
    let repeats: number[];
    if (!canUseRepeatBadges) {
      repeats = [1];
    } else if (actionType === 'TURN_LEFT') {
      repeats = allowedSimSet.has('TURN_RIGHT') ? [1, 2] : [1, 2, 3];
    } else if (actionType === 'TURN_RIGHT') {
      repeats = allowedSimSet.has('TURN_LEFT') ? [1, 2] : [1, 2, 3];
    } else if (actionType === 'MOVE_FWD' || actionType === 'MOVE_BACK') {
      repeats = [];
      for (let r = 1; r <= maxMoveRepeat; r++) {
        repeats.push(r);
      }
    } else if (actionType === 'PICK_UP' || actionType === 'USE_DROP') {
      repeats = [1];
    } else {
      const paletteItem = simEnv.paletteItems.find((p) => p.actionType === actionType);
      if (paletteItem && paletteItem.supportsRepeat === false) {
        repeats = [1];
      } else {
        repeats = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      }
    }

    for (const repeatCount of repeats) {
      actions.push({
        idx: actions.length,
        actionType,
        repeatCount,
      });
    }
  }

  return {
    actions,
    canUseRepeatBadges,
    loopsAllowed,
    loopCounts,
  };
}

/**
 * Verifies that if `partialHelp?.mode === 'scaffold'` and `scaffoldWorkspace` is defined,
 * `scaffoldWorkspace` fits within `slotCap` and can be completed to `SUCCESS` by replacing
 * `?` (`PLACEHOLDER`) blocks with allowed palette blocks matching each placeholder's hintCategory.
 */
export function checkScaffoldWorkspace(
  activity: CurriculumActivity,
  simEnv: SimulationEnvironment<GridState> = gridSimulationEnvironment
): ScaffoldCheckResult {
  const scaffold = activity.partialHelp?.scaffoldWorkspace;
  if (activity.partialHelp?.mode !== 'scaffold' || !scaffold) {
    return {
      applicable: false,
      passed: true,
      blockCount: 0,
      placeholderCount: 0,
    };
  }

  const blockCount = countWorkspaceBlocks(scaffold);
  const slotError = validateWorkspaceAgainstSlotCap(scaffold, activity.slotCap);
  if (slotError) {
    return {
      applicable: true,
      passed: false,
      reason: `scaffoldWorkspace violates slotCap: ${slotError}`,
      blockCount,
      placeholderCount: 0,
    };
  }

  if (!activity.grid) {
    return {
      applicable: true,
      passed: false,
      reason: 'Activity has no grid definition',
      blockCount,
      placeholderCount: 0,
    };
  }

  // Locate all PLACEHOLDER slots across scopes
  const placeholderSlots: Array<{
    scope: ScopeType;
    index: number;
    block: CodeBlock;
  }> = [];

  for (const scope of ALL_SCOPES) {
    const blocks = scaffold[scope] || [];
    blocks.forEach((blk, idx) => {
      if (blk.type === 'PLACEHOLDER') {
        placeholderSlots.push({ scope, index: idx, block: blk });
      }
    });
  }

  const placeholderCount = placeholderSlots.length;
  if (placeholderCount === 0) {
    return {
      applicable: true,
      passed: false,
      reason: 'scaffoldWorkspace has mode="scaffold" but contains 0 PLACEHOLDER blocks',
      blockCount,
      placeholderCount: 0,
    };
  }

  // Validate non-placeholder blocks in scaffoldWorkspace against palette (except loop balance if '?' is a loop block)
  const hasLoopPlaceholder = placeholderSlots.some((p) => {
    const h = getPlaceholderHintCategory(p.block);
    return h === 'loop' || h === 'any';
  });

  if (!hasLoopPlaceholder) {
    const fixedViolations = validateWorkspaceAgainstPalette(
      scaffold,
      activity.palette,
      simEnv,
      true
    );
    if (fixedViolations.length > 0) {
      return {
        applicable: true,
        passed: false,
        reason: `scaffoldWorkspace contains disallowed block: ${fixedViolations[0]}`,
        blockCount,
        placeholderCount,
      };
    }
  }

  const initialGrid = buildSolverInitialGridState(activity.grid, simEnv);
  const paletteCategoryByType = new Map<string, string | undefined>();
  for (const item of simEnv.paletteItems) {
    paletteCategoryByType.set(item.actionType, item.category);
  }

  // Fast-path 1: Check if aligning directly with `referenceSolution` completes the scaffold validly
  if (activity.referenceSolution) {
    let alignsWithRef = true;
    for (const scope of ALL_SCOPES) {
      const scBlocks = scaffold[scope] || [];
      const refBlocks = activity.referenceSolution[scope] || [];
      if (scBlocks.length !== refBlocks.length) {
        alignsWithRef = false;
        break;
      }
      for (let i = 0; i < scBlocks.length; i++) {
        if (scBlocks[i].type === 'PLACEHOLDER') {
          const hint = getPlaceholderHintCategory(scBlocks[i]);
          const refBlk = refBlocks[i];
          const itemCat = paletteCategoryByType.get(refBlk.type);
          if (!doesBlockMatchHintCategory(refBlk.type, itemCat, hint)) {
            alignsWithRef = false;
            break;
          }
        } else if (
          canonicalBlockSignature(scBlocks[i]) !== canonicalBlockSignature(refBlocks[i])
        ) {
          alignsWithRef = false;
          break;
        }
      }
      if (!alignsWithRef) break;
    }

    if (alignsWithRef) {
      const violations = validateWorkspaceAgainstPalette(
        activity.referenceSolution,
        activity.palette,
        simEnv,
        false
      );
      const exec = executeWorkspaceOnEnv(activity.referenceSolution, initialGrid, simEnv);
      if (violations.length === 0 && exec.status === 'SUCCESS') {
        return {
          applicable: true,
          passed: true,
          blockCount,
          placeholderCount,
          completedWorkspace: activity.referenceSolution,
        };
      }
    }
  }

  // General exact search over all valid replacements of each PLACEHOLDER block
  const { actions, loopsAllowed, loopCounts } = buildCandidateActions(
    activity.grid,
    activity.palette,
    simEnv
  );

  const candidateBlocksPerSlot: CodeBlock[][] = placeholderSlots.map((slot, slotIdx) => {
    const hint = getPlaceholderHintCategory(slot.block);
    const options: CodeBlock[] = [];

    for (const act of actions) {
      const cat = paletteCategoryByType.get(act.actionType);
      if (doesBlockMatchHintCategory(act.actionType, cat, hint)) {
        options.push({
          id: `scaf_fill_${slotIdx}_${act.actionType}_${act.repeatCount}`,
          type: act.actionType,
          ...(act.repeatCount > 1 ? { repeatCount: act.repeatCount } : {}),
        });
      }
    }

    if (loopsAllowed && doesBlockMatchHintCategory('LOOP_START', 'loop', hint)) {
      for (const lc of loopCounts) {
        options.push({
          id: `scaf_fill_${slotIdx}_LOOP_START_${lc}`,
          type: 'LOOP_START',
          repeatCount: lc,
        });
      }
      options.push({
        id: `scaf_fill_${slotIdx}_LOOP_END`,
        type: 'LOOP_END',
      });
    }

    return options;
  });

  if (candidateBlocksPerSlot.some((opts) => opts.length === 0)) {
    return {
      applicable: true,
      passed: false,
      reason: 'At least one PLACEHOLDER block in scaffoldWorkspace has 0 matching allowed palette blocks',
      blockCount,
      placeholderCount,
    };
  }

  const working: WorkspaceState = {
    MAIN: (scaffold.MAIN || []).map((b) => ({ ...b })),
    F1: (scaffold.F1 || []).map((b) => ({ ...b })),
    F2: (scaffold.F2 || []).map((b) => ({ ...b })),
    F3: (scaffold.F3 || []).map((b) => ({ ...b })),
  };

  let foundCompletion: WorkspaceState | undefined;

  const dfsFill = (idx: number): boolean => {
    if (idx === placeholderSlots.length) {
      const violations = validateWorkspaceAgainstPalette(
        working,
        activity.palette,
        simEnv,
        false
      );
      if (violations.length > 0) return false;
      const exec = executeWorkspaceOnEnv(working, initialGrid, simEnv);
      if (exec.status === 'SUCCESS') {
        foundCompletion = {
          MAIN: working.MAIN.map((b) => ({ ...b })),
          F1: working.F1.map((b) => ({ ...b })),
          F2: working.F2.map((b) => ({ ...b })),
          F3: working.F3.map((b) => ({ ...b })),
        };
        return true;
      }
      return false;
    }

    const target = placeholderSlots[idx];
    const prev = working[target.scope][target.index];
    for (const candidate of candidateBlocksPerSlot[idx]) {
      working[target.scope][target.index] = candidate;
      if (dfsFill(idx + 1)) {
        return true;
      }
    }
    working[target.scope][target.index] = prev;
    return false;
  };

  if (dfsFill(0) && foundCompletion) {
    return {
      applicable: true,
      passed: true,
      blockCount,
      placeholderCount,
      completedWorkspace: foundCompletion,
    };
  }

  return {
    applicable: true,
    passed: false,
    reason: 'No replacement of PLACEHOLDER blocks with allowed palette blocks reaches SUCCESS',
    blockCount,
    placeholderCount,
  };
}

/**
 * Memoized single-step & single-block physics transition engine delegating directly
 * to `simEnv.executeAction` so solver transitions match `tickInterpreter` 100%.
 */
class GridTransitionEvaluator {
  private readonly singleStepCache = new Map<string, SingleStepTransition>();
  private readonly blockCache = new Map<string, ActionBlockTransition>();

  constructor(
    public readonly initialGrid: GridState,
    public readonly initialBaseKey: string,
    private readonly simEnv: SimulationEnvironment<GridState>
  ) {}

  public stepOnce(
    state: GridState,
    baseKey: string,
    actionType: string,
    params?: Record<string, unknown>
  ): SingleStepTransition {
    const cacheKey = `${baseKey}|${actionType}`;
    const cached = this.singleStepCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const res = this.simEnv.executeAction(actionType, state, {
      repeatCount: 1,
      params: params ?? {},
    });

    let status: 'RUNNING' | 'SUCCESS' | 'COLLISION';
    if (res.isCollision || res.status === 'COLLISION') {
      status = 'COLLISION';
    } else if (res.isSuccess || res.status === 'SUCCESS') {
      status = 'SUCCESS';
    } else {
      status = 'RUNNING';
    }

    const nextBaseKey =
      status === 'COLLISION'
        ? baseKey
        : canonicalizeGridState(res.nextState, this.initialGrid);

    const entry: SingleStepTransition = {
      status,
      nextGrid: res.nextState,
      nextBaseKey,
    };
    this.singleStepCache.set(cacheKey, entry);
    return entry;
  }

  public executeBlock(
    state: GridState,
    baseKey: string,
    spec: CandidateActionSpec
  ): ActionBlockTransition {
    const cacheKey = `${baseKey}#${spec.idx}`;
    const cached = this.blockCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    let curGrid = state;
    let curKey = baseKey;
    let executedTicks = 0;

    for (let tick = 0; tick < spec.repeatCount; tick++) {
      const step = this.stepOnce(curGrid, curKey, spec.actionType, spec.params);
      executedTicks++;
      if (step.status === 'COLLISION') {
        const failRes: ActionBlockTransition = {
          status: 'COLLISION',
          nextGrid: step.nextGrid,
          nextBaseKey: curKey,
          executedTicks,
        };
        this.blockCache.set(cacheKey, failRes);
        return failRes;
      }
      curGrid = step.nextGrid;
      curKey = step.nextBaseKey;
      if (step.status === 'SUCCESS') {
        const winRes: ActionBlockTransition = {
          status: 'SUCCESS',
          nextGrid: curGrid,
          nextBaseKey: curKey,
          executedTicks,
        };
        this.blockCache.set(cacheKey, winRes);
        return winRes;
      }
    }

    const okRes: ActionBlockTransition = {
      status: 'RUNNING',
      nextGrid: curGrid,
      nextBaseKey: curKey,
      executedTicks,
    };
    this.blockCache.set(cacheKey, okRes);
    return okRes;
  }
}

function astToBlocks(nodes: readonly AstNode[], prefix = 'bypass'): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  let seq = 0;

  const emit = (list: readonly AstNode[]) => {
    for (const node of list) {
      if (node.kind === 'action') {
        seq++;
        blocks.push({
          id: `${prefix}_${seq}_${node.spec.actionType}`,
          type: node.spec.actionType,
          ...(node.spec.repeatCount > 1 ? { repeatCount: node.spec.repeatCount } : {}),
          ...(node.spec.params ? { params: { ...node.spec.params } } : {}),
        });
      } else {
        seq++;
        const loopId = seq;
        blocks.push({
          id: `${prefix}_${loopId}_LOOP_START`,
          type: 'LOOP_START',
          repeatCount: node.count,
        });
        emit(node.body);
        blocks.push({
          id: `${prefix}_${loopId}_LOOP_END`,
          type: 'LOOP_END',
        });
      }
    }
  };

  emit(nodes);
  return blocks;
}

function astToWorkspace(nodes: readonly AstNode[]): WorkspaceState {
  return {
    MAIN: astToBlocks(nodes),
    F1: [],
    F2: [],
    F3: [],
  };
}

function isTurnAction(actionType: string): boolean {
  return actionType === 'TURN_LEFT' || actionType === 'TURN_RIGHT';
}

/**
 * Prunes universal state-independent redundant adjacent action pairs `(prev, next)`:
 * - When `canUseRepeatBadges` is true:
 *   - Two adjacent turns can always be combined into 0 or 1 turn block.
 *   - Two adjacent `MOVE_FWD` (or two adjacent `MOVE_BACK`) on grids `<= 10×10` can always
 *     be combined into a single `MOVE_FWD ×(a+b)` block in 1 fewer slot.
 * - Regardless of repeat badges:
 *   - `TURN_LEFT` followed immediately by `TURN_RIGHT` (or vice versa) cancels out in every state.
 *   - `PICK_UP` followed immediately by `PICK_UP` or `USE_DROP` followed immediately by `USE_DROP`
 *     always collides on a 1-slot backpack.
 */
function isRedundantAdjacentActionPair(
  prev: CandidateActionSpec,
  next: CandidateActionSpec,
  canUseRepeatBadges: boolean,
  maxGridDim: number
): boolean {
  if (isTurnAction(prev.actionType) && isTurnAction(next.actionType)) {
    if (canUseRepeatBadges) {
      return true;
    }
    if (prev.actionType !== next.actionType) {
      return true;
    }
  }

  if (canUseRepeatBadges && maxGridDim <= 10) {
    if (prev.actionType === 'MOVE_FWD' && next.actionType === 'MOVE_FWD') {
      if (prev.repeatCount + next.repeatCount <= 9) return true;
    }
    if (prev.actionType === 'MOVE_BACK' && next.actionType === 'MOVE_BACK') {
      if (prev.repeatCount + next.repeatCount <= 9) return true;
    }
  }

  if (prev.actionType === 'PICK_UP' && next.actionType === 'PICK_UP') {
    return true;
  }
  if (prev.actionType === 'USE_DROP' && next.actionType === 'USE_DROP') {
    return true;
  }

  return false;
}

interface ExecCountTracker {
  keys: string[];
  caps: number[];
}

function buildExecCountTracker(
  maxActionExecutions?: Record<string, number>
): ExecCountTracker | null {
  if (!maxActionExecutions) return null;
  const keys = Object.keys(maxActionExecutions).sort();
  if (keys.length === 0) return null;
  const caps = keys.map((k) => maxActionExecutions[k]);
  return { keys, caps };
}

function encodeExecCounts(counts: readonly number[]): string {
  return counts.join(',');
}

function applyActionToExecCounts(
  tracker: ExecCountTracker | null,
  counts: readonly number[] | null,
  actionType: string,
  executedTicks: number
): number[] | null | 'EXCEEDED' {
  if (!tracker || !counts) return null;
  const idx = tracker.keys.indexOf(actionType);
  if (idx === -1) return counts as number[];
  const nextVal = counts[idx] + executedTicks;
  if (nextVal > tracker.caps[idx]) {
    return 'EXCEEDED';
  }
  const copy = counts.slice();
  copy[idx] = nextVal;
  return copy;
}

interface BfsSearchOutcome {
  exploredStates: number;
  minWinningBlocks: number | null;
  exhaustedStateSpace: boolean;
  winningAst?: AstNode[];
}

/**
 * Algorithm 1 (§4.1): Exact State-Space Shortest-Path BFS for loop-free / restricted-palette checks.
 * Explores 1 workspace block = 1 graph edge, finding the exact minimum block count to reach `SUCCESS`.
 */
function solveLoopFreeBfs(
  evaluator: GridTransitionEvaluator,
  actions: readonly CandidateActionSpec[],
  slotLimit: number | undefined,
  maxActionExecutions?: Record<string, number>,
  extraDepthBeyondCap = 20
): BfsSearchOutcome {
  const tracker = buildExecCountTracker(maxActionExecutions);
  const initCounts = tracker ? new Array<number>(tracker.keys.length).fill(0) : null;

  // Check if initial state is somehow already at SUCCESS
  if (evaluator.initialGrid.status === 'SUCCESS') {
    return {
      exploredStates: 1,
      minWinningBlocks: 0,
      exhaustedStateSpace: false,
      winningAst: [],
    };
  }

  const startFullKey = tracker
    ? `${evaluator.initialBaseKey}|e:${encodeExecCounts(initCounts!)}`
    : evaluator.initialBaseKey;

  interface BfsNode {
    grid: GridState;
    baseKey: string;
    execCounts: number[] | null;
    depth: number;
    parentIdx: number;
    viaSpec: CandidateActionSpec | null;
  }

  const visited = new Set<string>([startFullKey]);
  const queue: BfsNode[] = [
    {
      grid: evaluator.initialGrid,
      baseKey: evaluator.initialBaseKey,
      execCounts: initCounts,
      depth: 0,
      parentIdx: -1,
      viaSpec: null,
    },
  ];

  const hardMaxDepth =
    slotLimit !== undefined ? slotLimit + extraDepthBeyondCap : 200;
  const postCapStateLimit = 6000;
  const unboundedStateLimit = 50000;
  let truncatedByCap = false;

  let head = 0;
  while (head < queue.length) {
    const curIdx = head++;
    const cur = queue[curIdx];

    if (cur.depth >= hardMaxDepth) {
      truncatedByCap = true;
      continue;
    }
    if (
      slotLimit !== undefined &&
      cur.depth >= slotLimit &&
      visited.size >= postCapStateLimit
    ) {
      // Already exhaustively verified 0 solutions <= slotLimit; stop extra diagnostic search
      truncatedByCap = true;
      break;
    }
    if (slotLimit === undefined && visited.size >= unboundedStateLimit) {
      truncatedByCap = true;
      break;
    }

    for (let i = 0; i < actions.length; i++) {
      const spec = actions[i];
      const trans = evaluator.executeBlock(cur.grid, cur.baseKey, spec);
      if (trans.status === 'COLLISION') {
        continue;
      }

      const nextCounts = applyActionToExecCounts(
        tracker,
        cur.execCounts,
        spec.actionType,
        trans.executedTicks
      );
      if (nextCounts === 'EXCEEDED') {
        continue;
      }

      if (trans.status === 'SUCCESS') {
        // Reconstruct shortest winning path
        const specs: CandidateActionSpec[] = [spec];
        let walk = curIdx;
        while (walk > 0) {
          const node = queue[walk];
          if (node.viaSpec) specs.push(node.viaSpec);
          walk = node.parentIdx;
        }
        specs.reverse();
        const ast: AstNode[] = specs.map((s) => ({
          kind: 'action',
          spec: s,
          slotCost: 1,
        }));
        return {
          exploredStates: visited.size,
          minWinningBlocks: cur.depth + 1,
          exhaustedStateSpace: false,
          winningAst: ast,
        };
      }

      // Prune state no-ops immediately
      if (trans.nextBaseKey === cur.baseKey && nextCounts === cur.execCounts) {
        continue;
      }

      const nextFullKey = tracker
        ? `${trans.nextBaseKey}|e:${encodeExecCounts(nextCounts!)}`
        : trans.nextBaseKey;

      if (!visited.has(nextFullKey)) {
        visited.add(nextFullKey);
        queue.push({
          grid: trans.nextGrid,
          baseKey: trans.nextBaseKey,
          execCounts: nextCounts,
          depth: cur.depth + 1,
          parentIdx: curIdx,
          viaSpec: spec,
        });
      }
    }
  }

  return {
    exploredStates: visited.size,
    minWinningBlocks: null,
    exhaustedStateSpace: !truncatedByCap,
  };
}

interface AstExecResult {
  status: 'RUNNING' | 'SUCCESS' | 'COLLISION';
  nextGrid: GridState;
  nextBaseKey: string;
  nextCounts: number[] | null;
}

function executeAstSequence(
  nodes: readonly AstNode[],
  startGrid: GridState,
  startBaseKey: string,
  startCounts: number[] | null,
  evaluator: GridTransitionEvaluator,
  tracker: ExecCountTracker | null
): AstExecResult {
  let curGrid = startGrid;
  let curKey = startBaseKey;
  let curCounts = startCounts;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.kind === 'action') {
      const trans = evaluator.executeBlock(curGrid, curKey, node.spec);
      if (trans.status === 'COLLISION') {
        return {
          status: 'COLLISION',
          nextGrid: trans.nextGrid,
          nextBaseKey: curKey,
          nextCounts: curCounts,
        };
      }
      const updatedCounts = applyActionToExecCounts(
        tracker,
        curCounts,
        node.spec.actionType,
        trans.executedTicks
      );
      if (updatedCounts === 'EXCEEDED') {
        return {
          status: 'COLLISION',
          nextGrid: trans.nextGrid,
          nextBaseKey: curKey,
          nextCounts: curCounts,
        };
      }
      curGrid = trans.nextGrid;
      curKey = trans.nextBaseKey;
      curCounts = updatedCounts;
      if (trans.status === 'SUCCESS') {
        return {
          status: 'SUCCESS',
          nextGrid: curGrid,
          nextBaseKey: curKey,
          nextCounts: curCounts,
        };
      }
    } else {
      for (let iter = 0; iter < node.count; iter++) {
        const prevKey = curKey;
        const prevCounts = curCounts;
        const bodyRes = executeAstSequence(
          node.body,
          curGrid,
          curKey,
          curCounts,
          evaluator,
          tracker
        );
        if (bodyRes.status === 'COLLISION') {
          return bodyRes;
        }
        curGrid = bodyRes.nextGrid;
        curKey = bodyRes.nextBaseKey;
        curCounts = bodyRes.nextCounts;
        if (bodyRes.status === 'SUCCESS') {
          return bodyRes;
        }
        // Fixed-point optimization: if an iteration produced zero state & count change, remaining iterations are identical
        if (curKey === prevKey && curCounts === prevCounts) {
          break;
        }
      }
    }
  }

  return {
    status: 'RUNNING',
    nextGrid: curGrid,
    nextBaseKey: curKey,
    nextCounts: curCounts,
  };
}

/**
 * Algorithm 2 (§4.1): Bucketed Min-Slot Dijkstra + Pruned Structural Template DFS
 * for flat-loop (`maxLoopNestingDepth <= 1`), `pureSingleLoopOnly: true`, and bounded
 * nested-loop checks up to `slotLimit`.
 */
function solveStructuralLoopSearch(
  evaluator: GridTransitionEvaluator,
  gridDef: CurriculumGridDefinition,
  actions: readonly CandidateActionSpec[],
  canUseRepeatBadges: boolean,
  loopCounts: readonly number[],
  slotLimit: number,
  maxLoopNestingDepth: number,
  pureSingleLoopOnly: boolean,
  maxActionExecutions?: Record<string, number>
): BfsSearchOutcome {
  const tracker = buildExecCountTracker(maxActionExecutions);
  const initCounts = tracker ? new Array<number>(tracker.keys.length).fill(0) : null;
  const maxGridDim = Math.max(gridDef.width, gridDef.height);

  let exploredStates = 0;

  interface LoopCandidateTransition {
    loopNode: AstNode;
    slotCost: number;
    result: AstExecResult;
  }

  /**
   * Enumerates all pruned, Iteration-1-valid `LOOP(count)[Body]` AST nodes from
   * `(originGrid, originBaseKey, originCounts)` within `maxLoopSlots`.
   * Calls `onLoopTransition` for each valid iteration count (`2..9`); returning `true`
   * from `onLoopTransition` aborts enumeration early when a minimal counterexample is found.
   */
  const enumerateLoopsFromState = (
    originGrid: GridState,
    originBaseKey: string,
    originCounts: number[] | null,
    maxLoopSlots: number,
    currentDepth: number,
    isRootPureSingleLoop: boolean,
    onLoopTransition: (cand: LoopCandidateTransition) => boolean,
    getDynamicMaxLoopSlots?: () => number
  ): boolean => {
    const initialMaxBodySlots = maxLoopSlots - 2;
    if (initialMaxBodySlots < 1) return false;

    const minBodySlots =
      isRootPureSingleLoop || !canUseRepeatBadges || maxGridDim > 10 ? 1 : 2;
    if (initialMaxBodySlots < minBodySlots) return false;

    const bodyStack: AstNode[] = [];

    const buildBody = (
      iter1Grid: GridState,
      iter1Key: string,
      iter1Counts: number[] | null,
      usedSlots: number,
      lastActionSpec: CandidateActionSpec | null
    ): boolean => {
      const currentMaxLoopSlots = getDynamicMaxLoopSlots
        ? Math.min(maxLoopSlots, getDynamicMaxLoopSlots())
        : maxLoopSlots;
      const maxBodySlots = currentMaxLoopSlots - 2;
      if (usedSlots > maxBodySlots) {
        return false;
      }
      if (usedSlots >= minBodySlots) {
        // A body whose Iteration 1 returns to the exact origin state & counts is a complete no-op for all N
        const isStateNoOp =
          iter1Key === originBaseKey && iter1Counts === originCounts;
        if (!isStateNoOp) {
          // Evaluate Iterations 2..maxCount incrementally starting from Iteration 1's end state
          let curGrid = iter1Grid;
          let curKey = iter1Key;
          let curCounts = iter1Counts;

          // Note: loopCounts is sorted [2, 3, ..., 9] (or [2])
          let iterDone = 1;
          let hitFixedPoint = false;
          for (let ci = 0; ci < loopCounts.length; ci++) {
            const targetCount = loopCounts[ci];
            let collided = false;
            let succeeded = false;

            while (iterDone < targetCount) {
              if (hitFixedPoint) {
                iterDone = targetCount;
                break;
              }
              const prevKey = curKey;
              const prevCounts = curCounts;
              const stepRes = executeAstSequence(
                bodyStack,
                curGrid,
                curKey,
                curCounts,
                evaluator,
                tracker
              );
              exploredStates++;
              iterDone++;

              if (stepRes.status === 'COLLISION') {
                collided = true;
                break;
              }
              curGrid = stepRes.nextGrid;
              curKey = stepRes.nextBaseKey;
              curCounts = stepRes.nextCounts;
              if (stepRes.status === 'SUCCESS') {
                succeeded = true;
                break;
              }
              if (curKey === prevKey && curCounts === prevCounts) {
                hitFixedPoint = true;
              }
            }

            if (collided) {
              // Larger loop counts >= targetCount will also collide on the exact same iteration!
              break;
            }

            const loopNode: AstNode = {
              kind: 'loop',
              count: targetCount,
              body: bodyStack.slice(),
              slotCost: 2 + usedSlots,
            };

            const shouldStop = onLoopTransition({
              loopNode,
              slotCost: 2 + usedSlots,
              result: {
                status: succeeded ? 'SUCCESS' : 'RUNNING',
                nextGrid: curGrid,
                nextBaseKey: curKey,
                nextCounts: curCounts,
              },
            });
            if (shouldStop) return true;

            if (succeeded || hitFixedPoint) {
              // If Iteration k already hit SUCCESS (or stabilized), larger counts behave identically
              break;
            }
          }
        }
      }

      if (usedSlots >= maxBodySlots) {
        return false;
      }

      // Option 1: Append 1 allowed Action block to Body
      for (let i = 0; i < actions.length; i++) {
        const spec = actions[i];
        if (
          lastActionSpec &&
          isRedundantAdjacentActionPair(
            lastActionSpec,
            spec,
            canUseRepeatBadges,
            maxGridDim
          )
        ) {
          continue;
        }

        const trans = evaluator.executeBlock(iter1Grid, iter1Key, spec);
        exploredStates++;
        if (trans.status === 'COLLISION') {
          // Collides on Iteration 1 -> impossible for any completion of Body!
          continue;
        }

        const nextCounts = applyActionToExecCounts(
          tracker,
          iter1Counts,
          spec.actionType,
          trans.executedTicks
        );
        if (nextCounts === 'EXCEEDED') {
          continue;
        }

        // Prune action blocks that are pure state no-ops on Iteration 1
        if (trans.nextBaseKey === iter1Key && nextCounts === iter1Counts) {
          continue;
        }

        if (trans.status === 'SUCCESS') {
          // Hit SUCCESS during Iteration 1!
          // Only relevant if `isRootPureSingleLoop` requires an outer loop wrapper;
          // otherwise the bare body without `LOOP_START..LOOP_END` already wins in 2 fewer slots.
          if (isRootPureSingleLoop && usedSlots + 1 >= minBodySlots) {
            const winBody: AstNode[] = [
              ...bodyStack,
              { kind: 'action', spec, slotCost: 1 },
            ];
            const loopNode: AstNode = {
              kind: 'loop',
              count: loopCounts[0],
              body: winBody,
              slotCost: 2 + usedSlots + 1,
            };
            const shouldStop = onLoopTransition({
              loopNode,
              slotCost: 2 + usedSlots + 1,
              result: {
                status: 'SUCCESS',
                nextGrid: trans.nextGrid,
                nextBaseKey: trans.nextBaseKey,
                nextCounts,
              },
            });
            if (shouldStop) return true;
          }
          continue;
        }

        bodyStack.push({ kind: 'action', spec, slotCost: 1 });
        if (buildBody(trans.nextGrid, trans.nextBaseKey, nextCounts, usedSlots + 1, spec)) {
          return true;
        }
        bodyStack.pop();
      }

      // Option 2: Append a nested inner Loop node if nesting depth allows
      const remBodySlots = maxBodySlots - usedSlots;
      const innerMinSlots = !canUseRepeatBadges || maxGridDim > 10 ? 3 : 4;
      if (currentDepth + 1 < maxLoopNestingDepth && remBodySlots >= innerMinSlots) {
        const stopInner = enumerateLoopsFromState(
          iter1Grid,
          iter1Key,
          iter1Counts,
          remBodySlots,
          currentDepth + 1,
          false,
          (innerCand) => {
            if (innerCand.result.status === 'SUCCESS') {
              if (isRootPureSingleLoop) {
                const winBody: AstNode[] = [...bodyStack, innerCand.loopNode];
                const outerNode: AstNode = {
                  kind: 'loop',
                  count: loopCounts[0],
                  body: winBody,
                  slotCost: 2 + usedSlots + innerCand.slotCost,
                };
                return onLoopTransition({
                  loopNode: outerNode,
                  slotCost: outerNode.slotCost,
                  result: innerCand.result,
                });
              }
              return false;
            }

            bodyStack.push(innerCand.loopNode);
            const aborted = buildBody(
              innerCand.result.nextGrid,
              innerCand.result.nextBaseKey,
              innerCand.result.nextCounts,
              usedSlots + innerCand.slotCost,
              null
            );
            bodyStack.pop();
            return aborted;
          }
        );
        if (stopInner) return true;
      }

      return false;
    };

    return buildBody(originGrid, originBaseKey, originCounts, 0, null);
  };

  // Special case: `pureSingleLoopOnly: true` -> MAIN must be `[LOOP_START(n), ...Body, LOOP_END]`
  if (pureSingleLoopOnly) {
    let bestWinCost: number | null = null;
    let bestWinAst: AstNode[] | undefined;

    enumerateLoopsFromState(
      evaluator.initialGrid,
      evaluator.initialBaseKey,
      initCounts,
      slotLimit,
      0,
      true,
      (cand) => {
        if (cand.result.status === 'SUCCESS') {
          if (bestWinCost === null || cand.slotCost < bestWinCost) {
            bestWinCost = cand.slotCost;
            bestWinAst = [cand.loopNode];
          }
          return bestWinCost === 3;
        }
        return false;
      },
      () => (bestWinCost !== null ? bestWinCost - 1 : slotLimit)
    );

    return {
      exploredStates,
      minWinningBlocks: bestWinCost,
      exhaustedStateSpace: bestWinCost === null,
      winningAst: bestWinAst,
    };
  }

  // General Bucketed Min-Slot Dijkstra over top-level `MAIN` states (`0 .. slotLimit`)
  interface MainBucketState {
    fullKey: string;
    grid: GridState;
    baseKey: string;
    execCounts: number[] | null;
    cost: number;
    astPrefix: AstNode[];
    lastActionSpec: CandidateActionSpec | null;
  }

  const startFullKey = tracker
    ? `${evaluator.initialBaseKey}|e:${encodeExecCounts(initCounts!)}`
    : evaluator.initialBaseKey;

  const bestCostByKey = new Map<string, number>([[startFullKey, 0]]);
  const buckets: MainBucketState[][] = Array.from({ length: slotLimit + 1 }, () => []);
  buckets[0].push({
    fullKey: startFullKey,
    grid: evaluator.initialGrid,
    baseKey: evaluator.initialBaseKey,
    execCounts: initCounts,
    cost: 0,
    astPrefix: [],
    lastActionSpec: null,
  });

  let bestWinCost: number | null = null;
  let bestWinAst: AstNode[] | undefined;

  const recordWin = (cost: number, ast: AstNode[]) => {
    if (bestWinCost === null || cost < bestWinCost) {
      bestWinCost = cost;
      bestWinAst = ast;
    }
  };

  for (let cost = 0; cost <= slotLimit; cost++) {
    if (bestWinCost !== null && cost >= bestWinCost) {
      break;
    }

    const bucket = buckets[cost];
    for (let bi = 0; bi < bucket.length; bi++) {
      const cur = bucket[bi];
      if ((bestCostByKey.get(cur.fullKey) ?? Infinity) < cost) {
        continue;
      }
      if (bestWinCost !== null && cost >= bestWinCost) {
        break;
      }

      const remSlots =
        bestWinCost !== null ? Math.min(slotLimit, bestWinCost - 1) - cost : slotLimit - cost;
      if (remSlots <= 0) {
        continue;
      }

      // 1. Expand 1-slot top-level Action blocks
      for (let i = 0; i < actions.length; i++) {
        const spec = actions[i];
        if (
          cur.lastActionSpec &&
          isRedundantAdjacentActionPair(
            cur.lastActionSpec,
            spec,
            canUseRepeatBadges,
            maxGridDim
          )
        ) {
          continue;
        }
        // Final-slot pruning: a trailing TURN can never trigger SUCCESS in Grid
        if (remSlots === 1 && isTurnAction(spec.actionType)) {
          continue;
        }

        const trans = evaluator.executeBlock(cur.grid, cur.baseKey, spec);
        exploredStates++;
        if (trans.status === 'COLLISION') {
          continue;
        }

        const nextCounts = applyActionToExecCounts(
          tracker,
          cur.execCounts,
          spec.actionType,
          trans.executedTicks
        );
        if (nextCounts === 'EXCEEDED') {
          continue;
        }

        const nextCost = cost + 1;
        if (trans.status === 'SUCCESS') {
          recordWin(nextCost, [
            ...cur.astPrefix,
            { kind: 'action', spec, slotCost: 1 },
          ]);
          break;
        }

        if (trans.nextBaseKey === cur.baseKey && nextCounts === cur.execCounts) {
          continue;
        }

        const nextFullKey = tracker
          ? `${trans.nextBaseKey}|e:${encodeExecCounts(nextCounts!)}`
          : trans.nextBaseKey;

        if (nextCost < (bestCostByKey.get(nextFullKey) ?? Infinity)) {
          bestCostByKey.set(nextFullKey, nextCost);
          buckets[nextCost].push({
            fullKey: nextFullKey,
            grid: trans.nextGrid,
            baseKey: trans.nextBaseKey,
            execCounts: nextCounts,
            cost: nextCost,
            astPrefix: [...cur.astPrefix, { kind: 'action', spec, slotCost: 1 }],
            lastActionSpec: spec,
          });
        }
      }

      // 2. Expand top-level `LOOP(2..9)[Body]` nodes if loops fit in `remSlots`
      const effectiveRemSlots =
        bestWinCost !== null ? Math.min(slotLimit, bestWinCost - 1) - cost : slotLimit - cost;
      const minLoopCost = !canUseRepeatBadges || maxGridDim > 10 ? 3 : 4;

      if (maxLoopNestingDepth >= 1 && effectiveRemSlots >= minLoopCost) {
        enumerateLoopsFromState(
          cur.grid,
          cur.baseKey,
          cur.execCounts,
          effectiveRemSlots,
          0,
          false,
          (cand) => {
            const nextCost = cost + cand.slotCost;
            if (bestWinCost !== null && nextCost >= bestWinCost) {
              return false;
            }

            if (cand.result.status === 'SUCCESS') {
              recordWin(nextCost, [...cur.astPrefix, cand.loopNode]);
              return nextCost === cost + minLoopCost;
            }

            const nextFullKey = tracker
              ? `${cand.result.nextBaseKey}|e:${encodeExecCounts(
                  cand.result.nextCounts!
                )}`
              : cand.result.nextBaseKey;

            if (nextCost < (bestCostByKey.get(nextFullKey) ?? Infinity)) {
              bestCostByKey.set(nextFullKey, nextCost);
              buckets[nextCost].push({
                fullKey: nextFullKey,
                grid: cand.result.nextGrid,
                baseKey: cand.result.nextBaseKey,
                execCounts: cand.result.nextCounts,
                cost: nextCost,
                astPrefix: [...cur.astPrefix, cand.loopNode],
                lastActionSpec: null,
              });
            }
            return false;
          }
        );
      }
    }
  }

  return {
    exploredStates,
    minWinningBlocks: bestWinCost,
    exhaustedStateSpace: bestWinCost === null,
    winningAst: bestWinAst,
  };
}

/**
 * Checks `unmodifiedStarterMustFail` and `minStarterEditDistance` rules by enumerating
 * all palette-legal workspaces within Levenshtein edit distance `< requiredMinEdits`
 * of `activity.starterWorkspace`.
 */
function checkStarterEditDistanceRule(
  activity: CurriculumActivity,
  rule: AntiBypassRule,
  simEnv: SimulationEnvironment<GridState>,
  startMs: number,
  ruleId: string
): RuleCheckResult {
  const starter = activity.starterWorkspace;
  if (!starter) {
    return {
      ruleId,
      description: rule.description,
      rule,
      passed: false,
      elapsedMs: nowMs() - startMs,
      exploredStates: 0,
      minWinningBlocks: null,
      diagnostic: 'Rule requires activity.starterWorkspace to be defined, but it is undefined',
    };
  }

  const initialGrid = buildSolverInitialGridState(activity.grid!, simEnv);
  const requiredMinEdits = Math.max(
    rule.unmodifiedStarterMustFail ? 1 : 0,
    rule.minStarterEditDistance ?? 0
  );

  // Distance 0: check unmodified starterWorkspace directly
  const starterExec = executeWorkspaceOnEnv(starter, initialGrid, simEnv);
  let explored = 1;

  if (starterExec.status === 'SUCCESS') {
    return {
      ruleId,
      description: rule.description,
      rule,
      passed: false,
      elapsedMs: nowMs() - startMs,
      exploredStates: explored,
      minWinningBlocks: countWorkspaceBlocks(starter),
      counterexampleWorkspace: starter,
      formattedCounterexample: formatWorkspaceCompact(starter),
      diagnostic: 'Unmodified starterWorkspace reached SUCCESS (edit distance 0)',
    };
  }

  if (requiredMinEdits <= 1) {
    return {
      ruleId,
      description: rule.description,
      rule,
      passed: true,
      elapsedMs: nowMs() - startMs,
      exploredStates: explored,
      minWinningBlocks: null,
      diagnostic: `Unmodified starterWorkspace failed as required (status: ${starterExec.status})`,
    };
  }

  // Enumerate Levenshtein edit ball of radius `1 .. requiredMinEdits - 1`
  const maxAllowedEdits = requiredMinEdits - 1;
  const slotLimit = resolveEffectiveSlotLimit(activity.slotCap);
  const { actions, loopsAllowed, loopCounts } = buildCandidateActions(
    activity.grid!,
    activity.palette,
    simEnv,
    rule
  );

  const replacementBlocks: CodeBlock[] = actions.map((a, idx) => ({
    id: `edit_act_${idx}`,
    type: a.actionType,
    ...(a.repeatCount > 1 ? { repeatCount: a.repeatCount } : {}),
  }));
  if (loopsAllowed) {
    for (const lc of loopCounts) {
      replacementBlocks.push({
        id: `edit_loop_start_${lc}`,
        type: 'LOOP_START',
        repeatCount: lc,
      });
    }
    replacementBlocks.push({ id: 'edit_loop_end', type: 'LOOP_END' });
  }

  const workspaceSig = (ws: WorkspaceState): string =>
    ALL_SCOPES.map((s) => `${s}:${(ws[s] || []).map(canonicalBlockSignature).join(';')}`).join(
      '||'
    );

  const allowedScopes =
    activity.palette.allowedScopes && activity.palette.allowedScopes.length > 0
      ? activity.palette.allowedScopes
      : (['MAIN'] as ScopeType[]);

  const visited = new Set<string>([workspaceSig(starter)]);
  let frontier: WorkspaceState[] = [starter];

  for (let dist = 1; dist <= maxAllowedEdits; dist++) {
    const nextFrontier: WorkspaceState[] = [];

    for (const curWs of frontier) {
      const curTotal = countWorkspaceBlocks(curWs);

      for (const scope of allowedScopes) {
        const blocks = curWs[scope] || [];

        // 1. Delete 1 block
        for (let i = 0; i < blocks.length; i++) {
          const nextBlocks = [...blocks.slice(0, i), ...blocks.slice(i + 1)];
          const cand: WorkspaceState = { ...curWs, [scope]: nextBlocks };
          const sig = workspaceSig(cand);
          if (visited.has(sig)) continue;
          visited.add(sig);
          explored++;
          const exec = executeWorkspaceOnEnv(cand, initialGrid, simEnv);
          if (exec.status === 'SUCCESS') {
            return {
              ruleId,
              description: rule.description,
              rule,
              passed: false,
              elapsedMs: nowMs() - startMs,
              exploredStates: explored,
              minWinningBlocks: countWorkspaceBlocks(cand),
              counterexampleWorkspace: cand,
              formattedCounterexample: formatWorkspaceCompact(cand),
              diagnostic: `Solved within edit distance ${dist} (< required minStarterEditDistance ${requiredMinEdits})`,
            };
          }
          if (dist < maxAllowedEdits) nextFrontier.push(cand);
        }

        // 2. Replace 1 block
        for (let i = 0; i < blocks.length; i++) {
          for (const rep of replacementBlocks) {
            if (canonicalBlockSignature(blocks[i]) === canonicalBlockSignature(rep)) {
              continue;
            }
            const nextBlocks = [...blocks];
            nextBlocks[i] = { ...rep, id: `edit_r_${dist}_${i}_${rep.type}` };
            const cand: WorkspaceState = { ...curWs, [scope]: nextBlocks };
            const sig = workspaceSig(cand);
            if (visited.has(sig)) continue;
            visited.add(sig);
            explored++;
            const exec = executeWorkspaceOnEnv(cand, initialGrid, simEnv);
            if (exec.status === 'SUCCESS') {
              return {
                ruleId,
                description: rule.description,
                rule,
                passed: false,
                elapsedMs: nowMs() - startMs,
                exploredStates: explored,
                minWinningBlocks: countWorkspaceBlocks(cand),
                counterexampleWorkspace: cand,
                formattedCounterexample: formatWorkspaceCompact(cand),
                diagnostic: `Solved within edit distance ${dist} (< required minStarterEditDistance ${requiredMinEdits})`,
              };
            }
            if (dist < maxAllowedEdits) nextFrontier.push(cand);
          }
        }

        // 3. Insert 1 block (if within slotCap)
        if (slotLimit === undefined || curTotal + 1 <= slotLimit) {
          for (let i = 0; i <= blocks.length; i++) {
            for (const ins of replacementBlocks) {
              const nextBlocks = [
                ...blocks.slice(0, i),
                { ...ins, id: `edit_i_${dist}_${i}_${ins.type}` },
                ...blocks.slice(i),
              ];
              const cand: WorkspaceState = { ...curWs, [scope]: nextBlocks };
              if (validateWorkspaceAgainstSlotCap(cand, activity.slotCap) !== null) {
                continue;
              }
              const sig = workspaceSig(cand);
              if (visited.has(sig)) continue;
              visited.add(sig);
              explored++;
              const exec = executeWorkspaceOnEnv(cand, initialGrid, simEnv);
              if (exec.status === 'SUCCESS') {
                return {
                  ruleId,
                  description: rule.description,
                  rule,
                  passed: false,
                  elapsedMs: nowMs() - startMs,
                  exploredStates: explored,
                  minWinningBlocks: countWorkspaceBlocks(cand),
                  counterexampleWorkspace: cand,
                  formattedCounterexample: formatWorkspaceCompact(cand),
                  diagnostic: `Solved within edit distance ${dist} (< required minStarterEditDistance ${requiredMinEdits})`,
                };
              }
              if (dist < maxAllowedEdits) nextFrontier.push(cand);
            }
          }
        }
      }
    }

    frontier = nextFrontier;
  }

  return {
    ruleId,
    description: rule.description,
    rule,
    passed: true,
    elapsedMs: nowMs() - startMs,
    exploredStates: explored,
    minWinningBlocks: null,
    diagnostic: `No program within edit distance < ${requiredMinEdits} from starterWorkspace reaches SUCCESS`,
  };
}

/**
 * Checks `directToGoalMustFailLock: true`:
 * 1. Verifies the map defines both non-goal prerequisite flag(s) and goal flag(s).
 * 2. Computes the minimum blocks `minDirectBlocks` to step onto `(goal.x, goal.y)` when intermediate
 *    flags are ignored, and compares against `minFullSolveBlocks` for the full ordered puzzle.
 * 3. Proves `minDirectBlocks < minFullSolveBlocks` (and `minDirectBlocks <= slotCap`), AND that
 *    running the direct-to-goal program on the real map leaves `status !== 'SUCCESS'` because
 *    the Goal stays padlocked!
 */
function checkDirectToGoalLockRule(
  activity: CurriculumActivity,
  rule: AntiBypassRule,
  simEnv: SimulationEnvironment<GridState>,
  startMs: number,
  ruleId: string
): RuleCheckResult {
  const gridDef = activity.grid!;
  const goalFlags = gridDef.flags.filter((f) => f.isGoal);
  const nonGoalFlags = gridDef.flags.filter((f) => !f.isGoal);

  if (goalFlags.length === 0 || nonGoalFlags.length === 0) {
    return {
      ruleId,
      description: rule.description,
      rule,
      passed: false,
      elapsedMs: nowMs() - startMs,
      exploredStates: 0,
      minWinningBlocks: null,
      diagnostic:
        'directToGoalMustFailLock requires at least 1 non-goal waypoint flag and 1 goal flag',
    };
  }

  const slotLimit = resolveEffectiveSlotLimit(activity.slotCap);
  const { actions, canUseRepeatBadges, loopsAllowed, loopCounts } = buildCandidateActions(
    gridDef,
    activity.palette,
    simEnv
  );

  // 1. Shortest path to `(goal.x, goal.y)` ignoring intermediate flags
  const goalOnlyDef: CurriculumGridDefinition = {
    ...gridDef,
    flags: goalFlags.map((f, idx) => ({ ...f, order: idx + 1, collected: false })),
  };
  const goalOnlyGrid = buildSolverInitialGridState(goalOnlyDef, simEnv);
  const goalOnlyEval = new GridTransitionEvaluator(
    goalOnlyGrid,
    canonicalizeGridState(goalOnlyGrid, goalOnlyGrid),
    simEnv
  );

  const directSearch = loopsAllowed && slotLimit !== undefined
    ? solveStructuralLoopSearch(
        goalOnlyEval,
        goalOnlyDef,
        actions,
        canUseRepeatBadges,
        loopCounts,
        slotLimit,
        Infinity,
        false
      )
    : solveLoopFreeBfs(goalOnlyEval, actions, slotLimit);

  // 2. Shortest full solution on the real padlocked map
  const realGrid = buildSolverInitialGridState(gridDef, simEnv);
  const realEval = new GridTransitionEvaluator(
    realGrid,
    canonicalizeGridState(realGrid, realGrid),
    simEnv
  );

  const fullSearch = loopsAllowed && slotLimit !== undefined
    ? solveStructuralLoopSearch(
        realEval,
        gridDef,
        actions,
        canUseRepeatBadges,
        loopCounts,
        slotLimit,
        Infinity,
        false
      )
    : solveLoopFreeBfs(realEval, actions, slotLimit);

  const totalExplored = directSearch.exploredStates + fullSearch.exploredStates;

  if (directSearch.minWinningBlocks === null || !directSearch.winningAst) {
    return {
      ruleId,
      description: rule.description,
      rule,
      passed: false,
      elapsedMs: nowMs() - startMs,
      exploredStates: totalExplored,
      minWinningBlocks: null,
      diagnostic: 'Goal tile is unreachable directly within palette/slot constraints',
    };
  }

  if (slotLimit !== undefined && directSearch.minWinningBlocks > slotLimit) {
    return {
      ruleId,
      description: rule.description,
      rule,
      passed: false,
      elapsedMs: nowMs() - startMs,
      exploredStates: totalExplored,
      minWinningBlocks: directSearch.minWinningBlocks,
      diagnostic: `Direct path to Goal requires ${directSearch.minWinningBlocks} blocks, exceeding slotCap ${slotLimit}`,
    };
  }

  const directWorkspace = astToWorkspace(directSearch.winningAst);
  const realRun = executeWorkspaceOnEnv(directWorkspace, realGrid, simEnv);

  if (realRun.status === 'SUCCESS') {
    return {
      ruleId,
      description: rule.description,
      rule,
      passed: false,
      elapsedMs: nowMs() - startMs,
      exploredStates: totalExplored,
      minWinningBlocks: directSearch.minWinningBlocks,
      counterexampleWorkspace: directWorkspace,
      formattedCounterexample: formatWorkspaceCompact(directWorkspace),
      diagnostic:
        'Direct-to-Goal path unexpectedly achieved SUCCESS (did not leave Goal padlocked!)',
    };
  }

  if (
    fullSearch.minWinningBlocks !== null &&
    directSearch.minWinningBlocks >= fullSearch.minWinningBlocks
  ) {
    return {
      ruleId,
      description: rule.description,
      rule,
      passed: false,
      elapsedMs: nowMs() - startMs,
      exploredStates: totalExplored,
      minWinningBlocks: directSearch.minWinningBlocks,
      diagnostic: `Direct-to-Goal takes ${directSearch.minWinningBlocks} blocks, which is not shorter than full solve (${fullSearch.minWinningBlocks} blocks)`,
    };
  }

  return {
    ruleId,
    description: rule.description,
    rule,
    passed: true,
    elapsedMs: nowMs() - startMs,
    exploredStates: totalExplored,
    minWinningBlocks: directSearch.minWinningBlocks,
    diagnostic: `Direct-to-Goal reaches Goal in ${directSearch.minWinningBlocks} block(s) (< ${
      fullSearch.minWinningBlocks ?? '?'
    } full solve) and stays padlocked (status: ${realRun.status})`,
  };
}

/**
 * Verifies a single `AntiBypassRule` on `activity`.
 */
export function verifyActivityRule(
  activity: CurriculumActivity,
  rule: AntiBypassRule,
  ruleIndex = 0,
  options?: SolverOptions
): RuleCheckResult {
  const startMs = nowMs();
  const simEnv = options?.simEnv ?? gridSimulationEnvironment;
  const ruleId = rule.id ?? `${activity.id}-rule-${ruleIndex + 1}`;

  if (!activity.grid) {
    return {
      ruleId,
      description: rule.description,
      rule,
      passed: false,
      elapsedMs: nowMs() - startMs,
      exploredStates: 0,
      minWinningBlocks: null,
      diagnostic: 'Activity has no grid definition',
    };
  }

  const hasStarterRule =
    rule.unmodifiedStarterMustFail === true ||
    (rule.minStarterEditDistance !== undefined && rule.minStarterEditDistance > 0);
  const hasDirectLockRule = rule.directToGoalMustFailLock === true;
  const hasSearchRestriction =
    (rule.forbidBlocks !== undefined && rule.forbidBlocks.length > 0) ||
    rule.allowRepeatBadges === false ||
    rule.maxLoopNestingDepth !== undefined ||
    rule.pureSingleLoopOnly === true ||
    rule.maxActionExecutions !== undefined;

  let totalExplored = 0;

  if (hasStarterRule) {
    const starterRes = checkStarterEditDistanceRule(
      activity,
      rule,
      simEnv,
      startMs,
      ruleId
    );
    totalExplored += starterRes.exploredStates;
    if (!starterRes.passed || (!hasDirectLockRule && !hasSearchRestriction)) {
      return starterRes;
    }
  }

  if (hasDirectLockRule) {
    const lockRes = checkDirectToGoalLockRule(
      activity,
      rule,
      simEnv,
      startMs,
      ruleId
    );
    totalExplored += lockRes.exploredStates;
    if (!lockRes.passed || !hasSearchRestriction) {
      return {
        ...lockRes,
        exploredStates: totalExplored,
      };
    }
  }

  // Restricted-palette / loop-depth / pure-single-loop / max-executions search
  const slotLimit = resolveEffectiveSlotLimit(activity.slotCap);
  const initialGrid = buildSolverInitialGridState(activity.grid, simEnv);
  const evaluator = new GridTransitionEvaluator(
    initialGrid,
    canonicalizeGridState(initialGrid, initialGrid),
    simEnv
  );

  const { actions, canUseRepeatBadges, loopsAllowed, loopCounts } = buildCandidateActions(
    activity.grid,
    activity.palette,
    simEnv,
    rule
  );

  // Step 1: Always run exact State-Space Shortest-Path BFS first!
  // Why?
  // 1) When `!loopsAllowed` (including `maxLoopNestingDepth === 0`), BFS is 100% exact & complete.
  // 2) Even when `loopsAllowed` is true (e.g., `3.5`/`3A` `forbidBlocks: ['PICK_UP', 'USE_DROP']`),
  //    if unbounded finite-state BFS proves `SUCCESS` is completely unreachable in ANY number of
  //    steps (`bfsOutcome.minWinningBlocks === null`), then NO loop of any nesting depth can ever
  //    reach `SUCCESS` either — proving impossibility in < 1 ms!
  const bfsOutcome = solveLoopFreeBfs(
    evaluator,
    actions,
    loopsAllowed ? undefined : slotLimit,
    rule.maxActionExecutions,
    options?.extraBfsDepthBeyondCap ?? 20
  );
  totalExplored += bfsOutcome.exploredStates;

  if (!loopsAllowed && !rule.pureSingleLoopOnly) {
    const hasBypass =
      bfsOutcome.minWinningBlocks !== null &&
      (slotLimit === undefined || bfsOutcome.minWinningBlocks <= slotLimit);

    if (hasBypass && bfsOutcome.winningAst) {
      const counterexample = astToWorkspace(bfsOutcome.winningAst);
      // Sanity-verify counterexample on exact interpreter runtime
      const verifyExec = executeWorkspaceOnEnv(counterexample, initialGrid, simEnv);
      if (verifyExec.status === 'SUCCESS') {
        return {
          ruleId,
          description: rule.description,
          rule,
          passed: false,
          elapsedMs: nowMs() - startMs,
          exploredStates: totalExplored,
          minWinningBlocks: bfsOutcome.minWinningBlocks,
          counterexampleWorkspace: counterexample,
          formattedCounterexample: formatWorkspaceCompact(counterexample),
          diagnostic: `Found ${bfsOutcome.minWinningBlocks}-block bypass${
            slotLimit !== undefined ? ` within ${slotLimit}-slot cap` : ''
          }`,
        };
      }
    }

    return {
      ruleId,
      description: rule.description,
      rule,
      passed: true,
      elapsedMs: nowMs() - startMs,
      exploredStates: totalExplored,
      minWinningBlocks: bfsOutcome.minWinningBlocks,
      diagnostic:
        bfsOutcome.minWinningBlocks === null
          ? '0 solutions exist (unreachable in any number of blocks)'
          : `Shortest restricted program requires ${bfsOutcome.minWinningBlocks} blocks (> ${slotLimit}-slot cap)`,
    };
  }

  // If `pureSingleLoopOnly` is requested when loops aren't even in palette, 0 solutions exist
  if (rule.pureSingleLoopOnly && !loopsAllowed) {
    return {
      ruleId,
      description: rule.description,
      rule,
      passed: true,
      elapsedMs: nowMs() - startMs,
      exploredStates: totalExplored,
      minWinningBlocks: null,
      diagnostic: 'Loops are not enabled in palette; 0 single-loop solutions exist',
    };
  }

  // Unreachability Theorem: if unbounded state-space BFS exhausted all reachable states without
  // reaching SUCCESS, then no loop program of any depth can reach SUCCESS either!
  if (bfsOutcome.exhaustedStateSpace && bfsOutcome.minWinningBlocks === null) {
    return {
      ruleId,
      description: rule.description,
      rule,
      passed: true,
      elapsedMs: nowMs() - startMs,
      exploredStates: totalExplored,
      minWinningBlocks: null,
      diagnostic: '0 solutions exist even with arbitrary loops (goal unreachable under rule)',
    };
  }

  // If `!pureSingleLoopOnly` and loop-free BFS already found a bypass within `slotLimit`, report immediately!
  if (
    !rule.pureSingleLoopOnly &&
    bfsOutcome.minWinningBlocks !== null &&
    (slotLimit === undefined || bfsOutcome.minWinningBlocks <= slotLimit) &&
    bfsOutcome.winningAst
  ) {
    const counterexample = astToWorkspace(bfsOutcome.winningAst);
    const verifyExec = executeWorkspaceOnEnv(counterexample, initialGrid, simEnv);
    if (verifyExec.status === 'SUCCESS') {
      return {
        ruleId,
        description: rule.description,
        rule,
        passed: false,
        elapsedMs: nowMs() - startMs,
        exploredStates: totalExplored,
        minWinningBlocks: bfsOutcome.minWinningBlocks,
        counterexampleWorkspace: counterexample,
        formattedCounterexample: formatWorkspaceCompact(counterexample),
        diagnostic: `Found loop-free ${bfsOutcome.minWinningBlocks}-block bypass${
          slotLimit !== undefined ? ` within ${slotLimit}-slot cap` : ''
        }`,
      };
    }
  }

  // Step 2: Run Pruned Structural Loop Search up to `slotLimit`
  const effectiveCap = slotLimit ?? 10;
  const maxDepth =
    rule.maxLoopNestingDepth !== undefined ? rule.maxLoopNestingDepth : Infinity;

  const loopOutcome = solveStructuralLoopSearch(
    evaluator,
    activity.grid,
    actions,
    canUseRepeatBadges,
    loopCounts,
    effectiveCap,
    maxDepth,
    rule.pureSingleLoopOnly === true,
    rule.maxActionExecutions
  );
  totalExplored += loopOutcome.exploredStates;

  if (
    loopOutcome.minWinningBlocks !== null &&
    loopOutcome.minWinningBlocks <= effectiveCap &&
    loopOutcome.winningAst
  ) {
    const counterexample = astToWorkspace(loopOutcome.winningAst);
    const verifyExec = executeWorkspaceOnEnv(counterexample, initialGrid, simEnv);
    const withinExecCaps =
      !rule.maxActionExecutions ||
      Object.entries(rule.maxActionExecutions).every(
        ([actType, maxCap]) => (verifyExec.actionExecutions[actType] ?? 0) <= maxCap
      );

    if (verifyExec.status === 'SUCCESS' && withinExecCaps) {
      return {
        ruleId,
        description: rule.description,
        rule,
        passed: false,
        elapsedMs: nowMs() - startMs,
        exploredStates: totalExplored,
        minWinningBlocks: loopOutcome.minWinningBlocks,
        counterexampleWorkspace: counterexample,
        formattedCounterexample: formatWorkspaceCompact(counterexample),
        diagnostic: `Found ${loopOutcome.minWinningBlocks}-block loop bypass within ${effectiveCap}-slot cap`,
      };
    }
  }

  return {
    ruleId,
    description: rule.description,
    rule,
    passed: true,
    elapsedMs: nowMs() - startMs,
    exploredStates: totalExplored,
    minWinningBlocks: rule.pureSingleLoopOnly ? null : bfsOutcome.minWinningBlocks,
    diagnostic: rule.pureSingleLoopOnly
      ? `0 pure single-loop programs reach SUCCESS within ${effectiveCap} slots`
      : `0 programs with loop depth <= ${
          Number.isFinite(maxDepth) ? maxDepth : 'any'
        } reach SUCCESS within ${effectiveCap} slots`,
  };
}

/**
 * Runs the complete Anti-Bypass Constraint Verification suite on a validated puzzle activity:
 * 1. Positive `referenceSolution` check (palette legality, `slotCap`, reaches `SUCCESS`).
 * 2. Positive `?` `scaffoldWorkspace` completion check (when `partialHelp.mode === 'scaffold'`).
 * 3. Every `AntiBypassRule` in `activity.antiBypassRules` must yield **0 winning bypass programs**.
 */
export function verifyActivityConstraints(
  activity: CurriculumActivity,
  options?: SolverOptions
): ActivityConstraintReport {
  const startMs = nowMs();
  const simEnv = options?.simEnv ?? gridSimulationEnvironment;
  const slotCap = resolveEffectiveSlotLimit(activity.slotCap);

  const referenceCheck = checkReferenceSolution(activity, simEnv);
  const scaffoldCheck = checkScaffoldWorkspace(activity, simEnv);

  const rules = activity.antiBypassRules ?? [];
  const ruleResults: RuleCheckResult[] = rules.map((rule, idx) =>
    verifyActivityRule(activity, rule, idx, options)
  );

  const passed =
    referenceCheck.passed &&
    scaffoldCheck.passed &&
    ruleResults.every((r) => r.passed);

  return {
    activityId: activity.id,
    activityTitle: activity.title,
    passed,
    elapsedMs: nowMs() - startMs,
    slotCap,
    referenceCheck,
    scaffoldCheck,
    ruleResults,
  };
}
