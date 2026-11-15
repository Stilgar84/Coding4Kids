import {
  CodeBlock,
  ScopeType,
  SimulationStatus,
  WorkspaceState,
} from '../../types';
import {
  AntiBypassRule,
  ConditionExpr,
  CurriculumActivity,
  PaletteConfig,
  SlotCapConfig,
  getActivityVariants,
} from '../../data/curriculum/types';
import {
  createInitialInterpreterState,
  tickInterpreter,
  validateLoopStructure,
} from '../interpreter';
import { ALL_SCOPES, computeSlotBudget } from '../../utils/curriculumStagePolicy';
import { switchyardSimulationEnvironment } from '../../simulations/switchyard/switchyardEnvironment';
import {
  createInitialSwitchyardState,
  evaluateSwitchyardCompletion,
  normalizeSwitchyardColor,
  normalizeSwitchyardIcon,
  resetSwitchyardState,
} from '../../simulations/switchyard/physics';
import { SwitchyardState } from '../../simulations/switchyard/types';
import type {
  ActivityConstraintReport,
  ReferenceSolutionCheckResult,
  RuleCheckResult,
  ScaffoldCheckResult,
  VariantCheckResult,
} from './constraintSolver';

function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

const CONTROL_BLOCK_TYPES = new Set<string>([
  'LOOP_START',
  'LOOP_END',
  'CALL_F1',
  'CALL_F2',
  'CALL_F3',
  'IF',
  'ELSE_IF',
  'ELSE',
  'END_IF',
  'WHILE',
  'END_WHILE',
  'VAR_ASSIGN',
  'VAR_OP',
]);

export function canonicalizeSwitchyardState(state: SwitchyardState): string {
  const q = state.queue
    .map(
      (i) =>
        `${i.color}:${i.icon}:${i.damaged ? 'D' : 'G'}${i.weight !== undefined ? `:${i.weight}` : ''}`
    )
    .join(',');
  const sw = state.switches.map((s) => `${s.id}=${s.direction[0]}`).join(',');
  const d = state.docks.map((dk) => `${dk.id}=${dk.items.length}`).join(',');
  return `${sw}|Q[${q}]|D[${d}]|S${state.scrapped.length}|${state.status}`;
}

export function resolveEffectiveSlotLimit(slotCap?: number | SlotCapConfig): number {
  if (slotCap === undefined) return Number.POSITIVE_INFINITY;
  if (typeof slotCap === 'number') return slotCap;
  if (slotCap.maxTotal !== undefined) return slotCap.maxTotal;
  if (slotCap.perScope) {
    return Object.values(slotCap.perScope).reduce((sum, n) => sum + (n ?? 0), 0);
  }
  return Number.POSITIVE_INFINITY;
}

export function countSwitchyardWorkspaceBlocks(workspace: WorkspaceState): number {
  let count = 0;
  for (const sc of ALL_SCOPES) {
    count += workspace[sc]?.length ?? 0;
  }
  return count;
}

function collectConditionErrors(
  cond: ConditionExpr | undefined,
  palette: PaletteConfig | undefined,
  violations: string[]
): void {
  if (!cond || typeof cond !== 'object') return;
  const allowedSensors = palette?.allowedSensors;
  const allowedCombinators = palette?.allowedCombinators ?? [];

  switch (cond.kind) {
    case 'sensor': {
      if (allowedSensors && !allowedSensors.includes(cond.sensor)) {
        violations.push(`Forbidden sensor "${cond.sensor}" in condition`);
      }
      break;
    }
    case 'not': {
      if (palette && !allowedCombinators.includes('NOT')) {
        violations.push('Forbidden combinator "NOT"');
      }
      collectConditionErrors(cond.operand, palette, violations);
      break;
    }
    case 'and': {
      if (palette && !allowedCombinators.includes('AND')) {
        violations.push('Forbidden combinator "AND"');
      }
      collectConditionErrors(cond.left, palette, violations);
      collectConditionErrors(cond.right, palette, violations);
      break;
    }
    case 'or': {
      if (palette && !allowedCombinators.includes('OR')) {
        violations.push('Forbidden combinator "OR"');
      }
      collectConditionErrors(cond.left, palette, violations);
      collectConditionErrors(cond.right, palette, violations);
      break;
    }
  }
}

export function validateSwitchyardWorkspaceAgainstSlotCap(
  workspace: WorkspaceState,
  slotCap?: number | SlotCapConfig
): string | null {
  if (slotCap === undefined) return null;
  if (typeof slotCap === 'number') {
    const used = countSwitchyardWorkspaceBlocks(workspace);
    return used > slotCap ? `Workspace uses ${used} blocks, exceeding slotCap ${slotCap}` : null;
  }
  for (const sc of ALL_SCOPES) {
    const budget = computeSlotBudget(workspace, sc, 'curriculum', slotCap);
    if (budget.totalLimit !== undefined && budget.totalUsed > budget.totalLimit) {
      return `Workspace uses ${budget.totalUsed} blocks, exceeding slotCap.maxTotal=${budget.totalLimit}`;
    }
    if (budget.scopeLimit !== undefined && budget.scopeUsed > budget.scopeLimit) {
      return `Scope ${sc} uses ${budget.scopeUsed} blocks, exceeding slotCap.perScope.${sc}=${budget.scopeLimit}`;
    }
  }
  return null;
}

export function validateSwitchyardWorkspaceAgainstPalette(
  workspace: WorkspaceState,
  palette?: PaletteConfig
): string[] {
  const violations: string[] = [];
  if (!palette) return violations;

  const allowedScopes = new Set<ScopeType>(
    palette.allowedScopes && palette.allowedScopes.length > 0 ? palette.allowedScopes : ['MAIN']
  );
  const allowedControl = new Set<string>(palette.allowedControlBlocks ?? []);
  const registeredSim = new Set(switchyardSimulationEnvironment.paletteItems.map((p) => p.actionType));
  const allowedSim =
    palette.allowedSimBlocks !== undefined ? new Set<string>(palette.allowedSimBlocks) : registeredSim;
  const allowRepeatBadges = palette.allowRepeatBadges === true;
  const allowVariables = palette.allowVariables === true;
  const allowActionParams = palette.allowActionParams !== false;

  for (const sc of ALL_SCOPES) {
    const blocks = workspace[sc] || [];
    if (blocks.length > 0 && !allowedScopes.has(sc)) {
      violations.push(`Scope '${sc}' has ${blocks.length} block(s) but is not in allowedScopes`);
    }

    for (const block of blocks) {
      if (block.type === 'PLACEHOLDER') {
        violations.push(`Unexpected PLACEHOLDER block in '${sc}'`);
        continue;
      }

      const isControl = CONTROL_BLOCK_TYPES.has(block.type);
      if (isControl) {
        if (!allowedControl.has(block.type)) {
          violations.push(`Disallowed control block "${block.type}" in ${sc}`);
        }
      } else if (!allowedSim.has(block.type)) {
        violations.push(`Disallowed action block "${block.type}" in ${sc}`);
      }

      if (block.repeatCount !== undefined) {
        if (typeof block.repeatCount === 'string') {
          if (!allowVariables) {
            violations.push(`Variable repeatCount '${block.repeatCount}' disallowed in ${sc}`);
          }
        } else if (block.type === 'LOOP_START') {
          if (block.repeatCount > 2 && !allowRepeatBadges) {
            violations.push(`LOOP_START repeatCount ${block.repeatCount} requires allowRepeatBadges`);
          }
        } else if (block.repeatCount !== 1 && !allowRepeatBadges) {
          violations.push(`Block '${block.type}' repeatCount ${block.repeatCount} requires allowRepeatBadges`);
        }
      }

      if (!isControl && block.params && Object.keys(block.params).length > 0) {
        if (!allowActionParams) {
          violations.push(`Block '${block.type}' params disallowed while allowActionParams is false`);
        } else if (palette.allowedBlockParams !== undefined) {
          const permitted = new Set(palette.allowedBlockParams[block.type] ?? []);
          for (const k of Object.keys(block.params)) {
            if (!permitted.has(k)) {
              violations.push(`Param '${k}' on '${block.type}' is not in allowedBlockParams`);
            }
          }
        }
      }

      if (block.params?.condition) {
        collectConditionErrors(block.params.condition as ConditionExpr, palette, violations);
      } else if (
        typeof block.params?.sensor === 'string' &&
        palette.allowedSensors &&
        !palette.allowedSensors.includes(block.params.sensor)
      ) {
        violations.push(`Forbidden legacy sensor "${block.params.sensor}" in ${sc}`);
      }
    }
  }

  return Array.from(new Set(violations));
}

export function executeSwitchyardWorkspace(
  workspace: WorkspaceState,
  initialState: SwitchyardState,
  maxTicks: number = 600
): { status: SimulationStatus; finalState: SwitchyardState; ticks: number } {
  for (const sc of ALL_SCOPES) {
    const blocks = workspace[sc] || [];
    if (blocks.length > 0) {
      const val = validateLoopStructure(blocks);
      if (val.hasError) {
        return {
          status: 'COLLISION',
          finalState: { ...initialState, status: 'COLLISION' },
          ticks: 0,
        };
      }
    }
  }

  let runtime = createInitialInterpreterState();
  let simState = resetSwitchyardState(initialState);
  let ticks = 0;

  while (ticks < maxTicks) {
    const res = tickInterpreter(runtime, workspace, simState, switchyardSimulationEnvironment);
    runtime = res.nextRuntime;
    simState = res.nextGrid as SwitchyardState;
    ticks++;
    if (res.done) break;
  }

  let finalStatus = runtime.status;
  if (ticks >= maxTicks && finalStatus === 'RUNNING') {
    finalStatus = 'STEP_LIMIT';
  }
  if (finalStatus !== 'COLLISION' && finalStatus !== 'STEP_LIMIT' && finalStatus !== 'PAUSED') {
    finalStatus = evaluateSwitchyardCompletion(simState);
  }
  if (simState.status !== finalStatus) {
    simState = { ...simState, status: finalStatus };
  }

  return { status: finalStatus, finalState: simState, ticks };
}

function resolveActivitySwitchyardVariants(activity: CurriculumActivity): SwitchyardState[] {
  const rawVariants = getActivityVariants(activity, 'switchyard');
  if (rawVariants.length > 0) {
    return rawVariants.map((v) =>
      createInitialSwitchyardState(((v as unknown as Record<string, any>).switchyard ?? v) as any)
    );
  }
  if (activity.switchyard) {
    return [createInitialSwitchyardState(activity.switchyard)];
  }
  return [createInitialSwitchyardState()];
}

export function checkSwitchyardReferenceSolution(
  activity: CurriculumActivity
): ReferenceSolutionCheckResult {
  const slotLimit = resolveEffectiveSlotLimit(activity.slotCap);
  const workspace = activity.referenceSolution;
  if (!workspace) {
    return {
      passed: false,
      reason: 'Missing referenceSolution on activity',
      status: 'COLLISION',
      blockCount: 0,
      slotLimit: Number.isFinite(slotLimit) ? slotLimit : undefined,
      paletteViolations: [],
    };
  }

  const blockCount = countSwitchyardWorkspaceBlocks(workspace);
  const paletteViolations = validateSwitchyardWorkspaceAgainstPalette(workspace, activity.palette);
  const slotErr = validateSwitchyardWorkspaceAgainstSlotCap(workspace, activity.slotCap);

  if (paletteViolations.length > 0 || slotErr) {
    return {
      passed: false,
      reason: slotErr || paletteViolations.join('; '),
      status: 'COLLISION',
      blockCount,
      slotLimit: Number.isFinite(slotLimit) ? slotLimit : undefined,
      paletteViolations,
    };
  }

  const variants = resolveActivitySwitchyardVariants(activity);
  const variantResults: VariantCheckResult[] = variants.map((variantState, idx) => {
    const exec = executeSwitchyardWorkspace(workspace, variantState);
    return {
      variantIndex: idx,
      passed: exec.status === 'SUCCESS',
      status: exec.status,
      reason:
        exec.status === 'SUCCESS'
          ? undefined
          : exec.finalState.lastFailureReason || `Ended with status ${exec.status}`,
    };
  });

  const failed = variantResults.find((v) => !v.passed);
  return {
    passed: !failed,
    reason: failed?.reason,
    status: failed ? failed.status : 'SUCCESS',
    blockCount,
    slotLimit: Number.isFinite(slotLimit) ? slotLimit : undefined,
    paletteViolations,
    ...(variantResults.length > 1 ? { variantResults } : {}),
  };
}

export function checkSwitchyardScaffoldWorkspace(activity: CurriculumActivity): ScaffoldCheckResult {
  const scaffold = activity.partialHelp?.scaffoldWorkspace;
  if (activity.partialHelp?.mode !== 'scaffold' || !scaffold) {
    return {
      applicable: false,
      passed: true,
      blockCount: 0,
      placeholderCount: 0,
    };
  }

  let placeholderCount = 0;
  for (const sc of ALL_SCOPES) {
    for (const blk of scaffold[sc] || []) {
      if (blk.type === 'PLACEHOLDER') placeholderCount++;
    }
  }

  const blockCount = countSwitchyardWorkspaceBlocks(scaffold);
  if (placeholderCount === 0) {
    return {
      applicable: true,
      passed: false,
      reason: 'Scaffold mode has 0 PLACEHOLDER blocks',
      blockCount,
      placeholderCount,
    };
  }

  const slotErr = validateSwitchyardWorkspaceAgainstSlotCap(scaffold, activity.slotCap);
  if (slotErr) {
    return {
      applicable: true,
      passed: false,
      reason: slotErr,
      blockCount,
      placeholderCount,
    };
  }

  return {
    applicable: true,
    passed: true,
    blockCount,
    placeholderCount,
  };
}

// ============================================================================
// Anti-Bypass Bounded Structural Search (v2 Physics: 0..2 Switches, IF/ELSE_IF/ELSE/WHILE/F1)
// ============================================================================

interface CandidateStep {
  id: string;
  cost: number;
  blocks: CodeBlock[];
  kind: 'ACTION' | 'SWITCH' | 'CONTROL' | 'CALL';
  actionType?: string;
  junction?: 'A' | 'B';
}

function makeBlock(
  id: string,
  type: CodeBlock['type'],
  extras?: { repeatCount?: number; params?: Record<string, any> }
): CodeBlock {
  return {
    id,
    type,
    ...(extras?.repeatCount !== undefined ? { repeatCount: extras.repeatCount } : {}),
    ...(extras?.params ? { params: extras.params } : {}),
  };
}

function buildConditionPool(
  activity: CurriculumActivity,
  variants: readonly SwitchyardState[],
  forbiddenSet: Set<string>,
  forbidCombinators: Set<string>,
  forbidSensors: Set<string>
): Array<{ label: string; expr: ConditionExpr; costTag: number }> {
  const sensors = (
    activity.palette.allowedSensors ?? ['hasNextItem', 'itemDamaged', 'itemColor', 'itemIcon']
  ).filter((s) => !forbidSensors.has(s));
  const combinators = activity.palette.allowedCombinators ?? [];
  const atoms: Array<{ label: string; expr: ConditionExpr }> = [];

  if (sensors.includes('hasNextItem')) {
    atoms.push({ label: 'hasNextItem', expr: { kind: 'sensor', sensor: 'hasNextItem' } });
  }
  if (sensors.includes('itemDamaged')) {
    atoms.push({ label: 'itemDamaged', expr: { kind: 'sensor', sensor: 'itemDamaged' } });
  }

  const seenColors = new Set<string>();
  const seenIcons = new Set<string>();

  for (const v of variants) {
    for (const item of v.initialQueue) {
      seenColors.add(item.color);
      seenIcons.add(item.icon);
    }
    for (const d of v.docks) {
      if (d.spec.acceptColor) seenColors.add(d.spec.acceptColor);
      if (d.spec.acceptIcon) seenIcons.add(d.spec.acceptIcon);
    }
  }

  if (sensors.includes('itemColor')) {
    const orderedColors = ['RED', 'BLUE', 'GREEN', 'YELLOW', ...Array.from(seenColors)];
    const added = new Set<string>();
    for (const rawC of orderedColors) {
      if (!seenColors.has(rawC)) continue;
      const norm = normalizeSwitchyardColor(rawC);
      if (!norm || added.has(norm)) continue;
      added.add(norm);
      const token = norm === 'YELLOW' ? 'amber' : norm.toLowerCase();
      atoms.push({
        label: `color=${token}`,
        expr: { kind: 'sensor', sensor: 'itemColor', param: token },
      });
    }
  }

  if (sensors.includes('itemIcon')) {
    const orderedIcons = ['CRATE', 'BATTERY', 'GEAR', 'CRYSTAL', ...Array.from(seenIcons)];
    const added = new Set<string>();
    for (const rawI of orderedIcons) {
      if (!seenIcons.has(rawI)) continue;
      const norm = normalizeSwitchyardIcon(rawI);
      if (!norm || added.has(norm)) continue;
      added.add(norm);
      const token = norm.toLowerCase();
      atoms.push({
        label: `icon=${token}`,
        expr: { kind: 'sensor', sensor: 'itemIcon', param: token },
      });
    }
  }

  const refConds: ConditionExpr[] = [];
  if (activity.referenceSolution) {
    for (const sc of ALL_SCOPES) {
      for (const b of activity.referenceSolution[sc] || []) {
        if (b.params?.condition) refConds.push(b.params.condition as ConditionExpr);
      }
    }
  }

  const result: Array<{ label: string; expr: ConditionExpr; costTag: number }> = [];
  const seenKey = new Set<string>();
  const pushCond = (label: string, expr: ConditionExpr, costTag: number) => {
    const key = JSON.stringify(expr);
    if (seenKey.has(key)) return;
    seenKey.add(key);
    result.push({ label, expr, costTag });
  };

  for (const a of atoms) pushCond(a.label, a.expr, 1);

  if (combinators.includes('NOT') && !forbidCombinators.has('NOT') && !forbiddenSet.has('NOT')) {
    for (const a of atoms) {
      pushCond(`NOT(${a.label})`, { kind: 'not', operand: a.expr }, 2);
    }
  }

  if (
    combinators.includes('AND') &&
    !forbidCombinators.has('AND') &&
    !forbiddenSet.has('AND') &&
    atoms.length <= 6
  ) {
    for (let i = 0; i < atoms.length; i++) {
      for (let j = i + 1; j < atoms.length; j++) {
        pushCond(
          `(${atoms[i].label} AND ${atoms[j].label})`,
          { kind: 'and', left: atoms[i].expr, right: atoms[j].expr },
          3
        );
      }
    }
  }

  if (
    combinators.includes('OR') &&
    !forbidCombinators.has('OR') &&
    !forbiddenSet.has('OR') &&
    atoms.length <= 6
  ) {
    for (let i = 0; i < atoms.length; i++) {
      for (let j = i + 1; j < atoms.length; j++) {
        pushCond(
          `(${atoms[i].label} OR ${atoms[j].label})`,
          { kind: 'or', left: atoms[i].expr, right: atoms[j].expr },
          3
        );
      }
    }
  }

  for (const rc of refConds) {
    pushCond('refCond', rc, 2);
  }

  return result;
}

function buildAtomicStepPool(
  activity: CurriculumActivity,
  variants: readonly SwitchyardState[],
  forbiddenSet: Set<string>,
  ruleAllowRepeatBadges?: boolean
): CandidateStep[] {
  const palette = activity.palette;
  const allowedSim =
    palette.allowedSimBlocks !== undefined
      ? new Set(palette.allowedSimBlocks)
      : new Set(['SWITCH_LEFT', 'SWITCH_RIGHT', 'SEND_NEXT', 'SCRAP_ITEM']);
  const allowRepeat = palette.allowRepeatBadges === true && ruleAllowRepeatBadges !== false;
  const maxSwitches = Math.max(...variants.map((v) => v.switches.length), 0);
  const steps: CandidateStep[] = [];
  let seqId = 1;

  const junctions: Array<'A' | 'B'> = maxSwitches >= 2 ? ['A', 'B'] : maxSwitches === 1 ? ['A'] : [];

  if (allowedSim.has('SWITCH_LEFT') && !forbiddenSet.has('SWITCH_LEFT')) {
    for (const j of junctions) {
      steps.push({
        id: `swL_${j}`,
        cost: 1,
        kind: 'SWITCH',
        actionType: 'SWITCH_LEFT',
        junction: j,
        blocks: [makeBlock(`b_${seqId++}`, 'SWITCH_LEFT', { params: { junction: j } })],
      });
    }
  }

  if (allowedSim.has('SWITCH_RIGHT') && !forbiddenSet.has('SWITCH_RIGHT')) {
    for (const j of junctions) {
      steps.push({
        id: `swR_${j}`,
        cost: 1,
        kind: 'SWITCH',
        actionType: 'SWITCH_RIGHT',
        junction: j,
        blocks: [makeBlock(`b_${seqId++}`, 'SWITCH_RIGHT', { params: { junction: j } })],
      });
    }
  }

  if (allowedSim.has('SEND_NEXT') && !forbiddenSet.has('SEND_NEXT')) {
    steps.push({
      id: 'send1',
      cost: 1,
      kind: 'ACTION',
      actionType: 'SEND_NEXT',
      blocks: [makeBlock(`b_${seqId++}`, 'SEND_NEXT')],
    });
    if (allowRepeat) {
      const maxLen = Math.min(9, Math.max(...variants.map((v) => v.initialQueue.length), 1));
      for (let r = 2; r <= maxLen; r++) {
        steps.push({
          id: `send${r}`,
          cost: 1,
          kind: 'ACTION',
          actionType: 'SEND_NEXT',
          blocks: [makeBlock(`b_${seqId++}`, 'SEND_NEXT', { repeatCount: r })],
        });
      }
    }
  }

  if (allowedSim.has('SCRAP_ITEM') && !forbiddenSet.has('SCRAP_ITEM')) {
    steps.push({
      id: 'scrap1',
      cost: 1,
      kind: 'ACTION',
      actionType: 'SCRAP_ITEM',
      blocks: [makeBlock(`b_${seqId++}`, 'SCRAP_ITEM')],
    });
  }

  return steps;
}

function checkRuleRequirementsOnWorkspace(
  workspace: WorkspaceState,
  rule: AntiBypassRule
): boolean {
  if (rule.pureSingleLoopOnly) {
    const main = workspace.MAIN || [];
    const loopCount = main.filter((b) => b.type === 'LOOP_START' || b.type === 'WHILE').length;
    if (loopCount !== 1) return false;
  }

  return true;
}

function renumberBlocks(blocks: CodeBlock[], prefix = 's'): CodeBlock[] {
  return blocks.map((b, idx) => ({
    ...b,
    id: `${prefix}_${idx + 1}`,
    ...(b.params ? { params: { ...b.params } } : {}),
  }));
}

function formatWorkspaceSummary(ws: WorkspaceState): string {
  const parts: string[] = [];
  for (const sc of ALL_SCOPES) {
    const blks = ws[sc] || [];
    if (blks.length === 0) continue;
    const line = blks
      .map((b) => {
        if (b.repeatCount !== undefined && b.repeatCount !== 1) {
          return `${b.type}(${b.repeatCount})`;
        }
        if (b.params?.junction) return `${b.type}[${b.params.junction}]`;
        if (b.params?.condition) return `${b.type}(cond)`;
        if (b.params?.sensor) return `${b.type}(${b.params.sensor}=${b.params.param ?? ''})`;
        return b.type;
      })
      .join(' -> ');
    parts.push(`${sc}: [${line}]`);
  }
  return parts.join(' | ');
}

export function verifySwitchyardActivityRule(
  activity: CurriculumActivity,
  rule: AntiBypassRule,
  ruleIndex: number,
  extraDepthBeyondCap = 20
): RuleCheckResult {
  const startMs = nowMs();
  const ruleId = rule.id || `rule_${ruleIndex}`;
  const rawSlotLimit = resolveEffectiveSlotLimit(activity.slotCap);
  const slotCapLimit = Number.isFinite(rawSlotLimit) ? rawSlotLimit : 24;
  const maxAllowedCost =
    rule.maxLoopNestingDepth === 0
      ? Math.max(slotCapLimit, slotCapLimit + extraDepthBeyondCap)
      : slotCapLimit;

  const variants = resolveActivitySwitchyardVariants(activity);

  if (rule.unmodifiedStarterMustFail && activity.starterWorkspace) {
    let starterPassesAll = true;
    for (const v of variants) {
      const exec = executeSwitchyardWorkspace(activity.starterWorkspace, v, 350);
      if (exec.status !== 'SUCCESS') {
        starterPassesAll = false;
        break;
      }
    }
    if (starterPassesAll) {
      const starterCount = countSwitchyardWorkspaceBlocks(activity.starterWorkspace);
      return {
        ruleId,
        description: rule.description,
        rule,
        passed: false,
        elapsedMs: nowMs() - startMs,
        exploredStates: variants.length,
        minWinningBlocks: starterCount,
        counterexampleWorkspace: activity.starterWorkspace,
        formattedCounterexample: formatWorkspaceSummary(activity.starterWorkspace),
        diagnostic: `Starter workspace passes all variants without edits (${starterCount} blocks)`,
      };
    }
    const onlyStarterCheck =
      !rule.forbidBlocks?.length &&
      rule.maxLoopNestingDepth === undefined &&
      !rule.pureSingleLoopOnly &&
      !rule.forbidCombinators?.length &&
      !rule.forbidSensors?.length &&
      rule.allowRepeatBadges === undefined;
    if (onlyStarterCheck) {
      return {
        ruleId,
        description: rule.description,
        rule,
        passed: true,
        elapsedMs: nowMs() - startMs,
        exploredStates: variants.length,
        minWinningBlocks: null,
        diagnostic: 'Unmodified starter workspace fails as expected',
      };
    }
  }

  const forbiddenSet = new Set<string>(rule.forbidBlocks ?? []);
  const forbidCombinators = new Set<string>(rule.forbidCombinators ?? []);
  const forbidSensors = new Set<string>(rule.forbidSensors ?? []);
  const allowedControl = new Set<string>(activity.palette.allowedControlBlocks ?? []);
  const allowedScopes = new Set<ScopeType>(
    activity.palette.allowedScopes && activity.palette.allowedScopes.length > 0
      ? activity.palette.allowedScopes
      : ['MAIN']
  );

  const allowLoops =
    rule.maxLoopNestingDepth !== 0 &&
    allowedControl.has('LOOP_START') &&
    allowedControl.has('LOOP_END') &&
    !forbiddenSet.has('LOOP_START') &&
    !forbiddenSet.has('LOOP_END');
  const allowWhile =
    rule.maxLoopNestingDepth !== 0 &&
    allowedControl.has('WHILE') &&
    allowedControl.has('END_WHILE') &&
    !forbiddenSet.has('WHILE') &&
    !forbiddenSet.has('END_WHILE') &&
    !forbiddenSet.has('WHILE_START');
  const allowIf =
    allowedControl.has('IF') &&
    allowedControl.has('END_IF') &&
    !forbiddenSet.has('IF') &&
    !forbiddenSet.has('END_IF');
  const allowElse = allowedControl.has('ELSE') && !forbiddenSet.has('ELSE');
  const allowElseIf = allowedControl.has('ELSE_IF') && !forbiddenSet.has('ELSE_IF');
  const allowF1 =
    allowedScopes.has('F1') && allowedControl.has('CALL_F1') && !forbiddenSet.has('CALL_F1');

  const atomicSteps = buildAtomicStepPool(activity, variants, forbiddenSet, rule.allowRepeatBadges);
  const conditionPool =
    allowIf || allowWhile
      ? buildConditionPool(activity, variants, forbiddenSet, forbidCombinators, forbidSensors)
      : [];

  const deadlineMs = startMs + 160;
  let exploredStates = 0;
  let winner: WorkspaceState | undefined;
  let winnerCost: number | null = null;

  const actionPrimitives = atomicSteps.filter((s) => s.kind === 'ACTION' || s.kind === 'SWITCH');
  const smallBodies: Array<{ blocks: CodeBlock[]; cost: number }> = [];

  for (const s1 of actionPrimitives) {
    smallBodies.push({ blocks: s1.blocks, cost: 1 });
    for (const s2 of actionPrimitives) {
      if (s1.kind === 'SWITCH' && s2.kind === 'SWITCH' && s1.junction === s2.junction) continue;
      smallBodies.push({ blocks: [...s1.blocks, ...s2.blocks], cost: 2 });
    }
  }

  const controlSteps: CandidateStep[] = [];
  if (allowIf && conditionPool.length > 0) {
    const thenChoices = smallBodies.filter((b) => b.cost <= 2);
    const elseChoices = smallBodies.filter((b) => b.cost <= 2);
    for (const cond of conditionPool) {
      for (const tb of thenChoices) {
        controlSteps.push({
          id: `if_${cond.label}_c${tb.cost}`,
          cost: 2 + tb.cost,
          kind: 'CONTROL',
          blocks: [
            makeBlock('if', 'IF', { params: { condition: cond.expr } }),
            ...tb.blocks,
            makeBlock('endif', 'END_IF'),
          ],
        });
        if (allowElse) {
          for (const eb of elseChoices) {
            if (
              tb.cost === 1 &&
              eb.cost === 1 &&
              eb.blocks[0].type === tb.blocks[0].type &&
              eb.blocks[0].params?.junction === tb.blocks[0].params?.junction
            ) {
              continue;
            }
            controlSteps.push({
              id: `ifelse_${cond.label}_${tb.cost}_${eb.cost}`,
              cost: 3 + tb.cost + eb.cost,
              kind: 'CONTROL',
              blocks: [
                makeBlock('if', 'IF', { params: { condition: cond.expr } }),
                ...tb.blocks,
                makeBlock('else', 'ELSE'),
                ...eb.blocks,
                makeBlock('endif', 'END_IF'),
              ],
            });
          }
        }
        if (allowElseIf && tb.cost === 1 && conditionPool.length >= 2) {
          for (const cond2 of conditionPool) {
            if (cond2.label === cond.label) continue;
            for (const eib of smallBodies.filter((b) => b.cost === 1)) {
              controlSteps.push({
                id: `ifelif_${cond.label}_${cond2.label}`,
                cost: 3 + tb.cost + eib.cost,
                kind: 'CONTROL',
                blocks: [
                  makeBlock('if', 'IF', { params: { condition: cond.expr } }),
                  ...tb.blocks,
                  makeBlock('elseif', 'ELSE_IF', { params: { condition: cond2.expr } }),
                  ...eib.blocks,
                  makeBlock('endif', 'END_IF'),
                ],
              });
              if (allowElse) {
                for (const eb of smallBodies.filter((b) => b.cost === 1)) {
                  controlSteps.push({
                    id: `ifelifelse_${cond.label}_${cond2.label}`,
                    cost: 5 + tb.cost + eib.cost + eb.cost,
                    kind: 'CONTROL',
                    blocks: [
                      makeBlock('if', 'IF', { params: { condition: cond.expr } }),
                      ...tb.blocks,
                      makeBlock('elseif', 'ELSE_IF', { params: { condition: cond2.expr } }),
                      ...eib.blocks,
                      makeBlock('else', 'ELSE'),
                      ...eb.blocks,
                      makeBlock('endif', 'END_IF'),
                    ],
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  controlSteps.sort((a, b) => a.cost - b.cost);
  const allStepItems: CandidateStep[] = [...atomicSteps, ...controlSteps].sort(
    (a, b) => a.cost - b.cost
  );

  const evaluateMainAndWin = (
    mainBlocks: CodeBlock[],
    f1Blocks: CodeBlock[] = []
  ): { allSuccess: boolean; anyActionCollision: boolean; stateKey: string } => {
    exploredStates++;
    const ws: WorkspaceState = {
      MAIN: renumberBlocks(mainBlocks, 'm'),
      F1: renumberBlocks(f1Blocks, 'f1'),
      F2: [],
      F3: [],
    };

    const keys: string[] = [];
    let allSuccess = true;
    let anyActionCollision = false;

    for (const v of variants) {
      const exec = executeSwitchyardWorkspace(ws, v, 350);
      keys.push(canonicalizeSwitchyardState(exec.finalState));
      if (exec.status !== 'SUCCESS') allSuccess = false;
      if (
        exec.status === 'COLLISION' &&
        exec.finalState.lastFailureReason &&
        exec.finalState.lastFailureReason !== 'UNSORTED_ITEMS_REMAIN' &&
        exec.finalState.lastFailureReason !== 'DOCK_QUOTA_EXCEEDED'
      ) {
        anyActionCollision = true;
      }
    }

    if (allSuccess && checkRuleRequirementsOnWorkspace(ws, rule)) {
      const totalCost = ws.MAIN.length + ws.F1.length;
      if (!winner || totalCost < (winnerCost ?? Infinity)) {
        winner = ws;
        winnerCost = totalCost;
      }
    }

    return { allSuccess, anyActionCollision, stateKey: keys.join('||') };
  };

  if (allowLoops || allowWhile) {
    const queueLens = Array.from(
      new Set(variants.map((v) => v.initialQueue.length).filter((n) => n > 0))
    );
    const rawLoopCounts =
      queueLens.length === 1 ? [queueLens[0]] : [Math.max(...queueLens, 2), 2, 3, 4];
    const loopCounts =
      activity.palette.allowRepeatBadges === true
        ? rawLoopCounts
        : rawLoopCounts.filter((n) => n <= 2);
    const maxLoopBodyCost = Math.max(0, maxAllowedCost - 2);

    const bodyBuckets: Array<
      Array<{ blocks: CodeBlock[]; cost: number; lastSwitchJunction?: string }>
    > = Array.from({ length: maxLoopBodyCost + 1 }, () => []);
    bodyBuckets[0].push({ blocks: [], cost: 0 });

    for (let cost = 0; cost <= maxLoopBodyCost && nowMs() < deadlineMs && !winner; cost++) {
      for (const cur of bodyBuckets[cost]) {
        if (nowMs() >= deadlineMs || winner) break;
        if (cur.cost > 0) {
          if (allowLoops) {
            for (const n of loopCounts) {
              if (cur.cost + 2 > maxAllowedCost) continue;
              const wrapped = [
                makeBlock('l_s', 'LOOP_START', { repeatCount: n }),
                ...cur.blocks,
                makeBlock('l_e', 'LOOP_END'),
              ];
              evaluateMainAndWin(wrapped);
              if (winner) break;
            }
          }
          if (!winner && allowWhile && cur.cost + 2 <= maxAllowedCost) {
            const whileConds = conditionPool.filter(
              (c) =>
                c.expr.kind === 'sensor' &&
                (c.expr.sensor === 'hasNextItem' || c.expr.sensor === 'itemDamaged')
            );
            for (const wc of whileConds) {
              const wrapped = [
                makeBlock('w_s', 'WHILE', { params: { condition: wc.expr } }),
                ...cur.blocks,
                makeBlock('w_e', 'END_WHILE'),
              ];
              evaluateMainAndWin(wrapped);
              if (winner) break;
            }
          }
        }

        if (winner || cur.cost >= maxLoopBodyCost) continue;

        for (const step of allStepItems) {
          const nc = cur.cost + step.cost;
          if (nc > maxLoopBodyCost) break;
          if (step.kind === 'SWITCH' && cur.lastSwitchJunction === step.junction) continue;
          bodyBuckets[nc].push({
            blocks: [...cur.blocks, ...step.blocks],
            cost: nc,
            lastSwitchJunction: step.kind === 'SWITCH' ? step.junction : undefined,
          });
        }
      }
    }
  }

  if (nowMs() < deadlineMs) {
    const flatMaxCost = winnerCost !== null ? Math.min(maxAllowedCost, winnerCost - 1) : maxAllowedCost;
    interface BfsNode {
      blocks: CodeBlock[];
      cost: number;
      lastSwitchJunction?: string;
    }

    const bestCostByState = new Map<string, number>();
    const buckets: BfsNode[][] = Array.from({ length: Math.max(0, flatMaxCost) + 1 }, () => []);
    buckets[0].push({ blocks: [], cost: 0 });

    for (let cost = 0; cost <= flatMaxCost && nowMs() < deadlineMs; cost++) {
      if (winnerCost !== null && cost >= winnerCost) break;
      for (const cur of buckets[cost]) {
        if (nowMs() >= deadlineMs || (winnerCost !== null && cost >= winnerCost)) break;

        for (const step of allStepItems) {
          const nextCost = cur.cost + step.cost;
          if (nextCost > flatMaxCost) break;
          if (winnerCost !== null && nextCost >= winnerCost) break;
          if (step.kind === 'SWITCH' && cur.lastSwitchJunction === step.junction) continue;

          const nextBlocks = [...cur.blocks, ...step.blocks];
          const sim = evaluateMainAndWin(nextBlocks);
          if (sim.allSuccess) break;
          if (sim.anyActionCollision) continue;

          const prevBest = bestCostByState.get(sim.stateKey);
          if (prevBest !== undefined && prevBest <= nextCost) {
            continue;
          }
          bestCostByState.set(sim.stateKey, nextCost);
          buckets[nextCost].push({
            blocks: nextBlocks,
            cost: nextCost,
            lastSwitchJunction: step.kind === 'SWITCH' ? step.junction : undefined,
          });
        }

        if (!winner && allowF1 && cur.cost === 0 && atomicSteps.length > 0 && flatMaxCost >= 4) {
          for (const step of allStepItems) {
            if (step.cost + 1 > flatMaxCost) break;
            const callMain = [
              makeBlock('c1', 'CALL_F1', {
                repeatCount: Math.max(...variants.map((v) => v.initialQueue.length), 1),
              }),
            ];
            evaluateMainAndWin(callMain, step.blocks);
            if (winner) break;
          }
        }
      }
    }
  }

  const elapsedMs = nowMs() - startMs;

  if (winner) {
    return {
      ruleId,
      description: rule.description,
      rule,
      passed: false,
      elapsedMs,
      exploredStates,
      minWinningBlocks: winnerCost,
      counterexampleWorkspace: winner,
      formattedCounterexample: formatWorkspaceSummary(winner),
      diagnostic: `Found bypass in ${winnerCost} blocks: ${formatWorkspaceSummary(winner)}`,
    };
  }

  return {
    ruleId,
    description: rule.description,
    rule,
    passed: true,
    elapsedMs,
    exploredStates,
    minWinningBlocks: null,
    diagnostic: `0 bypass programs found within ${maxAllowedCost} blocks (${exploredStates} explored)`,
  };
}

export function verifySwitchyardActivityConstraints(
  activity: CurriculumActivity,
  extraDepthBeyondCap = 20
): ActivityConstraintReport {
  const startMs = nowMs();
  const rawLimit = resolveEffectiveSlotLimit(activity.slotCap);
  const slotCap = Number.isFinite(rawLimit) ? rawLimit : undefined;
  const referenceCheck = checkSwitchyardReferenceSolution(activity);
  const scaffoldCheck = checkSwitchyardScaffoldWorkspace(activity);

  const rules = activity.antiBypassRules ?? [];
  const ruleResults: RuleCheckResult[] = rules.map((rule, idx) =>
    verifySwitchyardActivityRule(activity, rule, idx, extraDepthBeyondCap)
  );

  const variants = resolveActivitySwitchyardVariants(activity);
  const passed =
    referenceCheck.passed && scaffoldCheck.passed && ruleResults.every((r) => r.passed);

  return {
    activityId: activity.id,
    activityTitle: activity.title,
    passed,
    elapsedMs: nowMs() - startMs,
    slotCap,
    referenceCheck,
    scaffoldCheck,
    ruleResults,
    variantCount: variants.length > 1 ? variants.length : undefined,
    variantResults: referenceCheck.variantResults,
  };
}
