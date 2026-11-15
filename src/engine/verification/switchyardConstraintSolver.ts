import {
  ALL_VARIABLE_NAMES,
  BinaryOp,
  CodeBlock,
  ScopeType,
  SimulationStatus,
  TypedValue,
  VariableName,
  WorkspaceState,
  isVariableName,
} from '../../types';
import {
  AntiBypassRule,
  ConditionCompareOp,
  ConditionExpr,
  ConditionOperand,
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
  computeSwitchyardScaleMetrics,
  createInitialSwitchyardState,
  evaluateSwitchyardCompletion,
  evaluateSwitchyardSensor,
  normalizeSwitchyardColor,
  normalizeSwitchyardIcon,
  readSwitchyardTypedSensor,
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

const ALL_CMP_OPS: readonly ConditionCompareOp[] = ['=', '!=', '<', '>', '<=', '>='];
const ALL_VAR_OPS: readonly BinaryOp[] = ['+', '-', '*', '/', '%'];

export function canonicalizeSwitchyardState(state: SwitchyardState): string {
  const q = state.queue
    .map(
      (i) =>
        `${i.color}:${i.icon}:${i.damaged ? 'D' : 'G'}${
          i.weight !== undefined ? `:${i.weight}` : ''
        }${i.seqNum !== undefined ? `#${i.seqNum}` : ''}`
    )
    .join(',');
  const sw = state.switches.map((s) => `${s.id}=${s.direction[0]}`).join(',');
  const d = state.docks
    .map((dk) => {
      const wSum = dk.items.reduce((acc, it) => acc + (it.weight ?? 0), 0);
      return wSum > 0 ? `${dk.id}=${dk.items.length}@${wSum}` : `${dk.id}=${dk.items.length}`;
    })
    .join(',');
  const scaleTag =
    state.mode === 'balance_scale'
      ? `|B${computeSwitchyardScaleMetrics(state.docks).leftWeightSum}:${
          computeSwitchyardScaleMetrics(state.docks).rightWeightSum
        }`
      : '';
  return `${sw}|Q[${q}]|D[${d}]|S${state.scrapped.length}${scaleTag}|${state.status}`;
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

function expandValueSensorAliases(sensorRef: string): string[] {
  const aliases = new Set<string>([sensorRef]);
  const base = sensorRef.replace(/\[[^\]]+\]$/, '');
  aliases.add(base);
  const m = sensorRef.match(/^(\$[A-Za-z]+)\[([^\]]+)\]$/);
  if (m) {
    const [, prefix, rawIdx] = m;
    const upper = rawIdx.trim().toUpperCase();
    const numAlias = upper === 'A' ? '0' : upper === 'B' ? '1' : upper === 'C' ? '2' : upper;
    const alphaAlias = upper === '0' ? 'A' : upper === '1' ? 'B' : upper === '2' ? 'C' : upper;
    aliases.add(`${prefix}[${numAlias}]`);
    aliases.add(`${prefix}[${alphaAlias}]`);
  }
  return Array.from(aliases);
}

function isValueSensorPermitted(
  sensorRef: string,
  allowedValueSensors?: readonly string[]
): boolean {
  if (!allowedValueSensors) return true;
  const aliases = expandValueSensorAliases(sensorRef);
  return aliases.some((a) => allowedValueSensors.includes(a));
}

function isValueSensorForbidden(
  sensorRef: string,
  forbidSensors: Set<string>,
  forbiddenSet: Set<string>
): boolean {
  const aliases = expandValueSensorAliases(sensorRef);
  return aliases.some((a) => forbidSensors.has(a) || forbiddenSet.has(a));
}

function validateCmpOperandAgainstPalette(
  operand: ConditionOperand,
  palette: PaletteConfig | undefined,
  violations: string[]
): void {
  if (!palette) return;
  if (typeof operand === 'string') {
    if (operand.startsWith('$')) {
      if (!isValueSensorPermitted(operand, palette.allowedValueSensors)) {
        violations.push(`Forbidden value sensor "${operand}" in condition`);
      }
    } else if (isVariableName(operand)) {
      if (palette.allowVariables === false) {
        violations.push(`Variable "${operand}" disallowed in condition while allowVariables is false`);
      } else if (
        palette.allowedVariableNames &&
        !palette.allowedVariableNames.includes(operand)
      ) {
        violations.push(`Variable "${operand}" in condition is not in allowedVariableNames`);
      }
    }
  }
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
    case 'cmp': {
      if (palette?.allowedCmpOps && !palette.allowedCmpOps.includes(cond.op)) {
        violations.push(`Forbidden comparison operator "${cond.op}" in condition`);
      }
      validateCmpOperandAgainstPalette(cond.left, palette, violations);
      validateCmpOperandAgainstPalette(cond.right, palette, violations);
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
  const registeredSim = new Set(
    switchyardSimulationEnvironment.paletteItems.map((p) => p.actionType)
  );
  const allowedSim =
    palette.allowedSimBlocks !== undefined ? new Set<string>(palette.allowedSimBlocks) : registeredSim;
  const allowRepeatBadges = palette.allowRepeatBadges === true;
  const allowVariables =
    palette.allowVariables !== undefined
      ? palette.allowVariables === true
      : allowedControl.has('VAR_ASSIGN') || allowedControl.has('VAR_OP');
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

      if (block.type === 'VAR_ASSIGN' || block.type === 'VAR_OP') {
        if (!allowVariables) {
          violations.push(`Variable block '${block.type}' disallowed while allowVariables is false`);
        }
        const targetVar = block.params?.a;
        if (
          typeof targetVar === 'string' &&
          palette.allowedVariableNames &&
          !palette.allowedVariableNames.includes(targetVar as VariableName)
        ) {
          violations.push(`Variable '${targetVar}' on '${block.type}' is not in allowedVariableNames`);
        }
        for (const operandKey of block.type === 'VAR_OP' ? ['b', 'c'] : ['b']) {
          const opVal = block.params?.[operandKey];
          if (typeof opVal === 'string') {
            if (opVal.startsWith('$')) {
              if (!isValueSensorPermitted(opVal, palette.allowedValueSensors)) {
                violations.push(
                  `Value sensor '${opVal}' on '${block.type}' is not in allowedValueSensors`
                );
              }
            } else if (
              isVariableName(opVal) &&
              palette.allowedVariableNames &&
              !palette.allowedVariableNames.includes(opVal)
            ) {
              violations.push(
                `Variable '${opVal}' on '${block.type}' is not in allowedVariableNames`
              );
            }
          }
        }
        if (block.type === 'VAR_OP') {
          const varOp = block.params?.op as BinaryOp | undefined;
          if (varOp && palette.allowedVarOps && !palette.allowedVarOps.includes(varOp)) {
            violations.push(`Operator '${varOp}' on 'VAR_OP' is not in allowedVarOps`);
          }
        }
      }

      if (block.repeatCount !== undefined) {
        if (typeof block.repeatCount === 'string') {
          if (!allowVariables) {
            violations.push(`Variable repeatCount '${block.repeatCount}' disallowed in ${sc}`);
          } else if (
            isVariableName(block.repeatCount) &&
            palette.allowedVariableNames &&
            !palette.allowedVariableNames.includes(block.repeatCount)
          ) {
            violations.push(
              `Variable repeatCount '${block.repeatCount}' is not in allowedVariableNames`
            );
          }
        } else if (block.type === 'LOOP_START') {
          if (block.repeatCount !== 2 && !allowRepeatBadges) {
            violations.push(
              `LOOP_START repeatCount ${block.repeatCount} requires allowRepeatBadges`
            );
          }
        } else if (block.repeatCount !== 1 && !allowRepeatBadges) {
          violations.push(
            `Block '${block.type}' repeatCount ${block.repeatCount} requires allowRepeatBadges`
          );
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

type SwitchyardInitialVars = Record<string, number | TypedValue | { type: string; value: any }>;

export function executeSwitchyardWorkspace(
  workspace: WorkspaceState,
  initialState: SwitchyardState,
  maxTicks: number = 600,
  skipValidation = false,
  initialVars?: SwitchyardInitialVars
): { status: SimulationStatus; finalState: SwitchyardState; ticks: number } {
  if (!skipValidation) {
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
  }

  let runtime = createInitialInterpreterState(undefined, initialVars);
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
  if (
    finalStatus !== 'COLLISION' &&
    finalStatus !== 'STEP_LIMIT' &&
    finalStatus !== 'STACK_OVERFLOW' &&
    finalStatus !== 'MATH_ERROR' &&
    finalStatus !== 'TYPE_ERROR' &&
    finalStatus !== 'DEADLOCK' &&
    finalStatus !== 'PAUSED'
  ) {
    finalStatus = evaluateSwitchyardCompletion(simState);
  }
  if (simState.status !== finalStatus) {
    simState = { ...simState, status: finalStatus };
  }

  return { status: finalStatus, finalState: simState, ticks };
}

interface ResolvedSwitchyardVariant {
  state: SwitchyardState;
  initialVars?: SwitchyardInitialVars;
}

function resolveActivitySwitchyardVariants(
  activity: CurriculumActivity
): ResolvedSwitchyardVariant[] {
  const rawVariants = getActivityVariants(activity, 'switchyard');
  if (rawVariants.length > 0) {
    return rawVariants.map((v) => {
      const rec = v as unknown as Record<string, any>;
      return {
        state: createInitialSwitchyardState((rec.switchyard ?? v) as any),
        initialVars: rec.initialVars ?? activity.initialVars,
      };
    });
  }
  if (activity.switchyard) {
    return [
      {
        state: createInitialSwitchyardState(activity.switchyard),
        initialVars: activity.initialVars,
      },
    ];
  }
  return [{ state: createInitialSwitchyardState(), initialVars: activity.initialVars }];
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
  const variantResults: VariantCheckResult[] = variants.map((variant, idx) => {
    const exec = executeSwitchyardWorkspace(
      workspace,
      variant.state,
      800,
      false,
      variant.initialVars
    );
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
// Anti-Bypass Bounded Structural Search (Phase 2 + Phase 3 CMP / Variables)
// ============================================================================

interface CandidateStep {
  id: string;
  cost: number;
  blocks: CodeBlock[];
  kind: 'ACTION' | 'SWITCH' | 'CONTROL' | 'CALL' | 'VAR';
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

function collectConstantsFromCond(cond: ConditionExpr | undefined, out: Set<number>): void {
  if (!cond || typeof cond !== 'object') return;
  if (cond.kind === 'cmp') {
    if (typeof cond.left === 'number' && Number.isFinite(cond.left)) out.add(cond.left);
    if (typeof cond.right === 'number' && Number.isFinite(cond.right)) out.add(cond.right);
  } else if (cond.kind === 'not') {
    collectConstantsFromCond(cond.operand, out);
  } else if (cond.kind === 'and' || cond.kind === 'or') {
    collectConstantsFromCond(cond.left, out);
    collectConstantsFromCond(cond.right, out);
  }
}

function buildConditionPool(
  activity: CurriculumActivity,
  variants: readonly SwitchyardState[],
  forbiddenSet: Set<string>,
  forbidCombinators: Set<string>,
  forbidSensors: Set<string>,
  allowVarsInRule: boolean,
  activeVars: readonly VariableName[]
): Array<{ label: string; expr: ConditionExpr; costTag: number }> {
  const palette = activity.palette;
  const sensors = (
    palette.allowedSensors ?? ['hasNextItem', 'itemDamaged', 'itemColor', 'itemIcon']
  ).filter((s) => !forbidSensors.has(s) && !forbiddenSet.has(s));
  const combinators = palette.allowedCombinators ?? [];
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

  // Phase 3 CMP atoms ($itemWeight, $dockCount[i], $dockQuota[i], variables)
  const cmpEnabled =
    (palette.allowedCmpOps !== undefined && palette.allowedCmpOps.length > 0) ||
    (palette.allowedValueSensors !== undefined && palette.allowedValueSensors.length > 0) ||
    activity.moduleId === 'cmp';
  const cmpOps: readonly ConditionCompareOp[] = cmpEnabled
    ? (palette.allowedCmpOps && palette.allowedCmpOps.length > 0
        ? palette.allowedCmpOps
        : ALL_CMP_OPS)
    : [];
  const allowedValueSensors = (palette.allowedValueSensors ?? []).filter(
    (vs) => !isValueSensorForbidden(vs, forbidSensors, forbiddenSet)
  );

  const refConds: ConditionExpr[] = [];
  const candidateNumbers = new Set<number>();
  for (const ws of [activity.referenceSolution, activity.starterWorkspace]) {
    if (!ws) continue;
    for (const sc of ALL_SCOPES) {
      for (const b of ws[sc] || []) {
        if (b.params?.condition) {
          const c = b.params.condition as ConditionExpr;
          if (ws === activity.referenceSolution) refConds.push(c);
          collectConstantsFromCond(c, candidateNumbers);
        }
      }
    }
  }

  for (const v of variants) {
    if (v.scrapMaxWeight !== undefined) candidateNumbers.add(v.scrapMaxWeight);
    for (const d of v.docks) {
      if (d.spec.maxWeight !== undefined) {
        candidateNumbers.add(d.spec.maxWeight);
        candidateNumbers.add(d.spec.maxWeight + 1);
      }
      if (d.spec.minWeight !== undefined) {
        candidateNumbers.add(d.spec.minWeight);
        if (d.spec.minWeight > 0) candidateNumbers.add(d.spec.minWeight - 1);
      }
      if (d.spec.quota !== undefined) {
        candidateNumbers.add(d.spec.quota);
      }
    }
  }

  const cmpAtoms: Array<{ label: string; expr: ConditionExpr; hasVar?: boolean }> = [];
  if (cmpOps.length > 0) {
    const preferredOps = cmpOps.filter((op) => op === '<' || op === '>' || op === '<=' || op === '=')
      .length
      ? cmpOps
      : cmpOps;

    if (allowedValueSensors.includes('$itemWeight')) {
      const weightThresholds = Array.from(candidateNumbers)
        .filter((n) => n >= 1 && n <= 99)
        .slice(0, 4);
      if (weightThresholds.length === 0) weightThresholds.push(10);
      for (const k of weightThresholds) {
        for (const op of preferredOps.slice(0, 4)) {
          cmpAtoms.push({
            label: `w${op}${k}`,
            expr: { kind: 'cmp', op, left: '$itemWeight', right: k },
          });
        }
      }
    }

    const rawCountSensor = allowedValueSensors.find((s) => s.startsWith('$dockCount'));
    const rawQuotaSensor = allowedValueSensors.find((s) => s.startsWith('$dockQuota'));
    const countSensor = rawCountSensor
      ? rawCountSensor.includes('[')
        ? rawCountSensor
        : '$dockCount[0]'
      : undefined;
    const quotaSensor = rawQuotaSensor
      ? rawQuotaSensor.includes('[')
        ? rawQuotaSensor
        : '$dockQuota[0]'
      : undefined;
    if (countSensor && quotaSensor) {
      for (const op of preferredOps.filter((o) => o === '<' || o === '<=' || o === '=' || o === '>=')) {
        cmpAtoms.push({
          label: `cnt${op}qta`,
          expr: { kind: 'cmp', op, left: countSensor, right: quotaSensor },
        });
      }
    } else if (countSensor) {
      const quotaGuesses = Array.from(
        new Set(
          variants
            .flatMap((v) => v.docks.map((d) => d.spec.quota))
            .filter((q): q is number => q !== undefined)
        )
      ).slice(0, 3);
      for (const q of quotaGuesses.length > 0 ? quotaGuesses : [1, 2, 3]) {
        for (const op of preferredOps.filter((o) => o === '<' || o === '<=')) {
          cmpAtoms.push({
            label: `cnt${op}${q}`,
            expr: { kind: 'cmp', op, left: countSensor, right: q },
          });
        }
      }
    }

    if (allowVarsInRule && activeVars.length > 0) {
      const v0 = activeVars[0];
      const v1 = activeVars[1];
      for (const op of preferredOps.filter((o) => o === '=' || o === '!=' || o === '<=' || o === '<')) {
        for (const k of [0, 1]) {
          cmpAtoms.push({
            label: `${v0}${op}${k}`,
            expr: { kind: 'cmp', op, left: v0, right: k },
            hasVar: true,
          });
        }
        if (v1) {
          cmpAtoms.push({
            label: `${v1}${op}1`,
            expr: { kind: 'cmp', op, left: v1, right: 1 },
            hasVar: true,
          });
          cmpAtoms.push({
            label: `${v0}${op}${v1}`,
            expr: { kind: 'cmp', op, left: v0, right: v1 },
            hasVar: true,
          });
        }
      }
    }
  }

  const evalOperandOnState = (op: ConditionOperand, st: SwitchyardState): number | string | undefined => {
    if (typeof op === 'number') return op;
    if (typeof op === 'object' && op !== null && op.type === 'color') return `color:${op.value}`;
    if (typeof op === 'string') {
      if (op.startsWith('$')) {
        const val = readSwitchyardTypedSensor(op, st);
        if (typeof val === 'number') return val;
        if (val && typeof val === 'object') {
          return val.type === 'number' ? val.value : `${val.type}:${val.value}`;
        }
        return undefined;
      }
      if (isVariableName(op)) {
        return 0;
      }
    }
    return undefined;
  };

  const evalCondExprOnState = (expr: ConditionExpr, st: SwitchyardState): boolean => {
    if (expr.kind === 'sensor') {
      return evaluateSwitchyardSensor(expr.sensor, st, expr.param);
    }
    if (expr.kind === 'not') {
      return !evalCondExprOnState(expr.operand, st);
    }
    if (expr.kind === 'and') {
      return evalCondExprOnState(expr.left, st) && evalCondExprOnState(expr.right, st);
    }
    if (expr.kind === 'or') {
      return evalCondExprOnState(expr.left, st) || evalCondExprOnState(expr.right, st);
    }
    if (expr.kind === 'cmp') {
      const l = evalOperandOnState(expr.left, st);
      const r = evalOperandOnState(expr.right, st);
      if (l === undefined || r === undefined) return false;
      if (typeof l === 'number' && typeof r === 'number') {
        switch (expr.op) {
          case '=':
            return l === r;
          case '!=':
            return l !== r;
          case '<':
            return l < r;
          case '>':
            return l > r;
          case '<=':
            return l <= r;
          case '>=':
            return l >= r;
        }
      }
      return expr.op === '=' ? l === r : expr.op === '!=' ? l !== r : false;
    }
    return false;
  };

  const exprUsesVariable = (expr: ConditionExpr): boolean => {
    if (expr.kind === 'cmp') {
      return (
        (typeof expr.left === 'string' && isVariableName(expr.left)) ||
        (typeof expr.right === 'string' && isVariableName(expr.right))
      );
    }
    if (expr.kind === 'not') return exprUsesVariable(expr.operand);
    if (expr.kind === 'and' || expr.kind === 'or') {
      return exprUsesVariable(expr.left) || exprUsesVariable(expr.right);
    }
    return false;
  };

  const isOperandAllowed = (op: ConditionOperand): boolean => {
    if (typeof op === 'number') return true;
    if (typeof op === 'object' && op !== null) return true;
    if (typeof op === 'string') {
      if (op.startsWith('$')) {
        if (isValueSensorForbidden(op, forbidSensors, forbiddenSet)) {
          return false;
        }
        return isValueSensorPermitted(op, palette.allowedValueSensors);
      }
      if (isVariableName(op)) {
        if (!allowVarsInRule) return false;
        return palette.allowedVariableNames ? palette.allowedVariableNames.includes(op) : true;
      }
    }
    return false;
  };

  const isCondExprAllowed = (expr: ConditionExpr): boolean => {
    if (expr.kind === 'sensor') {
      return (
        sensors.includes(expr.sensor) &&
        !forbidSensors.has(expr.sensor) &&
        !forbiddenSet.has(expr.sensor)
      );
    }
    if (expr.kind === 'not') {
      return (
        !forbidCombinators.has('NOT') &&
        !forbiddenSet.has('NOT') &&
        isCondExprAllowed(expr.operand)
      );
    }
    if (expr.kind === 'and') {
      return (
        !forbidCombinators.has('AND') &&
        !forbiddenSet.has('AND') &&
        isCondExprAllowed(expr.left) &&
        isCondExprAllowed(expr.right)
      );
    }
    if (expr.kind === 'or') {
      return (
        !forbidCombinators.has('OR') &&
        !forbiddenSet.has('OR') &&
        isCondExprAllowed(expr.left) &&
        isCondExprAllowed(expr.right)
      );
    }
    if (expr.kind === 'cmp') {
      return (
        cmpOps.includes(expr.op) &&
        !forbiddenSet.has(expr.op) &&
        isOperandAllowed(expr.left) &&
        isOperandAllowed(expr.right)
      );
    }
    return false;
  };

  const probeItems = new Map<string, SwitchyardState>();
  for (const v of variants) {
    for (const item of v.initialQueue) {
      const k = `${item.color}|${item.icon}|${item.damaged ? 1 : 0}|${item.weight ?? ''}`;
      if (!probeItems.has(k)) {
        probeItems.set(k, { ...v, queue: [item] });
      }
    }
    // Also add a partially-filled dock probe so $dockCount vs $dockQuota conditions don't collapse to static!
    if (v.docks[0]?.spec.quota !== undefined && v.initialQueue.length > 0) {
      const fullCount = v.docks[0].spec.quota;
      const filledDock0 = {
        ...v.docks[0],
        items: Array.from({ length: fullCount }, (_, idx) => v.initialQueue[0] ?? {
          id: `p_${idx}`,
          color: 'RED' as const,
          icon: 'CRATE' as const,
        }),
      };
      probeItems.set(`quotaFull_${fullCount}`, {
        ...v,
        queue: [v.initialQueue[0]],
        docks: [filledDock0, ...v.docks.slice(1)],
      });
    }
  }
  const itemProbes = Array.from(probeItems.values());
  const emptyProbe: SwitchyardState | null =
    variants.length > 0 ? { ...variants[0], queue: [] } : null;

  const result: Array<{ label: string; expr: ConditionExpr; costTag: number }> = [];
  const seenKey = new Set<string>();
  const seenFullSig = new Set<string>();
  const seenItemSig = new Set<string>();

  const pushCond = (label: string, expr: ConditionExpr, costTag: number, isAtom = false) => {
    if (result.length >= 16) return;
    if (!isCondExprAllowed(expr)) return;
    const key = JSON.stringify(expr);
    if (seenKey.has(key)) return;
    seenKey.add(key);

    // Variable expressions change dynamically across loop ticks, so bypass static probe dedup
    if (!exprUsesVariable(expr) && itemProbes.length > 0) {
      const itemSig = itemProbes.map((p) => (evalCondExprOnState(expr, p) ? '1' : '0')).join('');
      const emptyBit = emptyProbe ? (evalCondExprOnState(expr, emptyProbe) ? '1' : '0') : '0';
      const fullSig = `${itemSig}|${emptyBit}`;
      if (isAtom) {
        if (!/1/.test(fullSig) || seenFullSig.has(fullSig)) return;
      } else {
        if (!/1/.test(itemSig) || !/0/.test(itemSig) || seenItemSig.has(itemSig)) return;
      }
      seenFullSig.add(fullSig);
      if (/1/.test(itemSig) && /0/.test(itemSig)) {
        seenItemSig.add(itemSig);
      }
    }

    result.push({ label, expr, costTag });
  };

  // Prioritize reference conditions first if allowed under current rule so positive synthesis is instant
  refConds.forEach((rc, rcIdx) => {
    pushCond(`refCond_${rcIdx}`, rc, 2, rc.kind === 'sensor' || rc.kind === 'cmp');
  });

  for (const a of atoms) pushCond(a.label, a.expr, 1, true);
  for (const ca of cmpAtoms) pushCond(ca.label, ca.expr, 1, true);

  const combinableAtoms = [
    ...atoms.filter((a) => !(a.expr.kind === 'sensor' && a.expr.sensor === 'hasNextItem')),
    ...cmpAtoms.filter((c) => !c.hasVar).slice(0, 6),
  ];

  if (combinators.includes('NOT') && !forbidCombinators.has('NOT') && !forbiddenSet.has('NOT')) {
    for (const a of atoms) {
      pushCond(`NOT(${a.label})`, { kind: 'not', operand: a.expr }, 2);
    }
  }

  if (
    combinators.includes('AND') &&
    !forbidCombinators.has('AND') &&
    !forbiddenSet.has('AND') &&
    combinableAtoms.length <= 10
  ) {
    for (let i = 0; i < combinableAtoms.length; i++) {
      for (let j = i + 1; j < combinableAtoms.length; j++) {
        pushCond(
          `(${combinableAtoms[i].label} AND ${combinableAtoms[j].label})`,
          { kind: 'and', left: combinableAtoms[i].expr, right: combinableAtoms[j].expr },
          3
        );
      }
    }
  }

  if (
    combinators.includes('OR') &&
    !forbidCombinators.has('OR') &&
    !forbiddenSet.has('OR') &&
    combinableAtoms.length <= 10
  ) {
    for (let i = 0; i < combinableAtoms.length; i++) {
      for (let j = i + 1; j < combinableAtoms.length; j++) {
        pushCond(
          `(${combinableAtoms[i].label} OR ${combinableAtoms[j].label})`,
          { kind: 'or', left: combinableAtoms[i].expr, right: combinableAtoms[j].expr },
          3
        );
      }
    }
  }

  return result;
}

function buildAtomicStepPool(
  activity: CurriculumActivity,
  variants: readonly SwitchyardState[],
  forbiddenSet: Set<string>,
  forbidSensors: Set<string>,
  allowVarsInRule: boolean,
  activeVars: readonly VariableName[],
  ruleAllowRepeatBadges?: boolean
): CandidateStep[] {
  const palette = activity.palette;
  const allowedSim =
    palette.allowedSimBlocks !== undefined
      ? new Set(palette.allowedSimBlocks)
      : new Set(['SWITCH_LEFT', 'SWITCH_RIGHT', 'SEND_NEXT', 'SCRAP_ITEM']);
  const allowedControl = new Set(palette.allowedControlBlocks ?? []);
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

  if (
    allowVarsInRule &&
    allowedControl.has('VAR_OP') &&
    !forbiddenSet.has('VAR_OP') &&
    activeVars.length > 0
  ) {
    const allowedOps = palette.allowedVarOps ?? ALL_VAR_OPS;
    const v0 = activeVars[0];
    const v1 = activeVars[1] ?? v0;
    const canReadWeight =
      isValueSensorPermitted('$itemWeight', palette.allowedValueSensors) &&
      !isValueSensorForbidden('$itemWeight', forbidSensors, forbiddenSet);

    if (allowedOps.includes('+')) {
      steps.push({
        id: `inc_${v0}`,
        cost: 1,
        kind: 'VAR',
        actionType: 'VAR_OP',
        blocks: [makeBlock(`b_${seqId++}`, 'VAR_OP', { params: { a: v0, b: v0, op: '+', c: 1 } })],
      });
      if (canReadWeight) {
        steps.push({
          id: `addW_${v0}`,
          cost: 1,
          kind: 'VAR',
          actionType: 'VAR_OP',
          blocks: [
            makeBlock(`b_${seqId++}`, 'VAR_OP', {
              params: { a: v0, b: v0, op: '+', c: '$itemWeight' },
            }),
          ],
        });
        if (v1 !== v0) {
          steps.push({
            id: `addW_${v1}`,
            cost: 1,
            kind: 'VAR',
            actionType: 'VAR_OP',
            blocks: [
              makeBlock(`b_${seqId++}`, 'VAR_OP', {
                params: { a: v1, b: v1, op: '+', c: '$itemWeight' },
              }),
            ],
          });
        }
      }
    }
    if (allowedOps.includes('%') && !forbiddenSet.has('%')) {
      steps.push({
        id: `mod2_${v1}_${v0}`,
        cost: 1,
        kind: 'VAR',
        actionType: 'VAR_OP',
        blocks: [makeBlock(`b_${seqId++}`, 'VAR_OP', { params: { a: v1, b: v0, op: '%', c: 2 } })],
      });
    }
    if (allowedOps.includes('-')) {
      steps.push({
        id: `flip_${v0}`,
        cost: 1,
        kind: 'VAR',
        actionType: 'VAR_OP',
        blocks: [makeBlock(`b_${seqId++}`, 'VAR_OP', { params: { a: v0, b: 1, op: '-', c: v0 } })],
      });
    }
  }

  return steps;
}

function blockEditSignature(b: CodeBlock): string {
  return `${b.type}|${b.repeatCount ?? 1}|${b.params ? JSON.stringify(b.params) : ''}`;
}

function computeBlockSeqEditDistance(a: readonly CodeBlock[], b: readonly CodeBlock[]): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const sigA = a.map(blockEditSignature);
  const sigB = b.map(blockEditSignature);
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      const cost = sigA[i - 1] === sigB[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[n];
}

export function computeSwitchyardWorkspaceEditDistance(
  wsA: WorkspaceState,
  wsB: WorkspaceState
): number {
  let dist = 0;
  for (const sc of ALL_SCOPES) {
    dist += computeBlockSeqEditDistance(wsA[sc] || [], wsB[sc] || []);
  }
  return dist;
}

function workspaceUsesVariables(ws: WorkspaceState): boolean {
  for (const sc of ALL_SCOPES) {
    for (const b of ws[sc] || []) {
      if (b.type === 'VAR_ASSIGN' || b.type === 'VAR_OP') return true;
      if (typeof b.repeatCount === 'string' && isVariableName(b.repeatCount)) return true;
      if (b.params?.condition) {
        const stack: ConditionExpr[] = [b.params.condition as ConditionExpr];
        while (stack.length > 0) {
          const c = stack.pop()!;
          if (c.kind === 'cmp') {
            if (
              (typeof c.left === 'string' && isVariableName(c.left)) ||
              (typeof c.right === 'string' && isVariableName(c.right))
            ) {
              return true;
            }
          } else if (c.kind === 'not') {
            stack.push(c.operand);
          } else if (c.kind === 'and' || c.kind === 'or') {
            stack.push(c.left, c.right);
          }
        }
      }
    }
  }
  return false;
}

function checkRuleRequirementsOnWorkspace(
  workspace: WorkspaceState,
  rule: AntiBypassRule,
  activity: CurriculumActivity
): boolean {
  if (rule.pureSingleLoopOnly) {
    const main = workspace.MAIN || [];
    const loopCount = main.filter((b) => b.type === 'LOOP_START' || b.type === 'WHILE').length;
    if (loopCount !== 1) return false;
  }
  if (rule.allowVariables === false && workspaceUsesVariables(workspace)) {
    return false;
  }
  if (
    rule.minStarterEditDistance !== undefined &&
    rule.minStarterEditDistance > 0 &&
    activity.starterWorkspace
  ) {
    const dist = computeSwitchyardWorkspaceEditDistance(workspace, activity.starterWorkspace);
    if (dist >= rule.minStarterEditDistance) {
      return false;
    }
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
        if (b.type === 'VAR_OP') {
          return `VAR_OP(${b.params?.a}=${b.params?.b}${b.params?.op}${b.params?.c})`;
        }
        if (b.type === 'VAR_ASSIGN') {
          return `VAR_ASSIGN(${b.params?.a}=${b.params?.b})`;
        }
        return b.type;
      })
      .join(' -> ');
    parts.push(`${sc}: [${line}]`);
  }
  return parts.join(' | ');
}

function checkStarterEditDistanceRule(
  activity: CurriculumActivity,
  rule: AntiBypassRule,
  variants: readonly ResolvedSwitchyardVariant[],
  conditionPool: ReadonlyArray<{ label: string; expr: ConditionExpr }>,
  atomicSteps: readonly CandidateStep[],
  startMs: number,
  deadlineMs: number,
  ruleId: string
): RuleCheckResult | null {
  const starter = activity.starterWorkspace;
  if (!starter) return null;

  const passesAllVariants = (ws: WorkspaceState): boolean => {
    for (const v of variants) {
      const exec = executeSwitchyardWorkspace(ws, v.state, 400, false, v.initialVars);
      if (exec.status !== 'SUCCESS') return false;
    }
    return true;
  };

  let explored = variants.length;
  if (passesAllVariants(starter)) {
    const starterCount = countSwitchyardWorkspaceBlocks(starter);
    return {
      ruleId,
      description: rule.description,
      rule,
      passed: false,
      elapsedMs: nowMs() - startMs,
      exploredStates: explored,
      minWinningBlocks: starterCount,
      counterexampleWorkspace: starter,
      formattedCounterexample: formatWorkspaceSummary(starter),
      diagnostic: `Starter workspace passes all variants without edits (${starterCount} blocks)`,
    };
  }

  const reqDist = rule.minStarterEditDistance ?? 0;
  if (reqDist <= 1) return null;

  // Test 1-edit mutations (delete 1 block, replace 1 block, insert 1 block) on MAIN
  const main = starter.MAIN || [];
  const replacements: CodeBlock[] = [
    ...atomicSteps.map((s) => s.blocks[0]).filter(Boolean),
    ...conditionPool.map((c, idx) =>
      makeBlock(`mut_if_${idx}`, 'IF', { params: { condition: c.expr } })
    ),
    ...conditionPool.map((c, idx) =>
      makeBlock(`mut_elif_${idx}`, 'ELSE_IF', { params: { condition: c.expr } })
    ),
    makeBlock('mut_else', 'ELSE'),
  ];

  // 1. Delete 1 block
  for (let i = 0; i < main.length && nowMs() < deadlineMs; i++) {
    const cand: WorkspaceState = {
      ...starter,
      MAIN: [...main.slice(0, i), ...main.slice(i + 1)],
    };
    if (validateSwitchyardWorkspaceAgainstPalette(cand, activity.palette).length > 0) continue;
    explored++;
    if (passesAllVariants(cand)) {
      return {
        ruleId,
        description: rule.description,
        rule,
        passed: false,
        elapsedMs: nowMs() - startMs,
        exploredStates: explored,
        minWinningBlocks: countSwitchyardWorkspaceBlocks(cand),
        counterexampleWorkspace: cand,
        formattedCounterexample: formatWorkspaceSummary(cand),
        diagnostic: `Solved within 1 edit (< minStarterEditDistance ${reqDist})`,
      };
    }
  }

  // 2. Replace 1 block
  for (let i = 0; i < main.length && nowMs() < deadlineMs; i++) {
    for (const rep of replacements) {
      if (nowMs() >= deadlineMs) break;
      const cand: WorkspaceState = {
        ...starter,
        MAIN: [...main.slice(0, i), { ...rep, id: main[i].id }, ...main.slice(i + 1)],
      };
      if (validateSwitchyardWorkspaceAgainstPalette(cand, activity.palette).length > 0) continue;
      explored++;
      if (passesAllVariants(cand)) {
        return {
          ruleId,
          description: rule.description,
          rule,
          passed: false,
          elapsedMs: nowMs() - startMs,
          exploredStates: explored,
          minWinningBlocks: countSwitchyardWorkspaceBlocks(cand),
          counterexampleWorkspace: cand,
          formattedCounterexample: formatWorkspaceSummary(cand),
          diagnostic: `Solved within 1 edit (< minStarterEditDistance ${reqDist})`,
        };
      }
    }
  }

  return null;
}

export function verifySwitchyardActivityRule(
  activity: CurriculumActivity,
  rule: AntiBypassRule,
  ruleIndex: number,
  extraDepthBeyondCap = 20,
  budgetMs = 115
): RuleCheckResult {
  const startMs = nowMs();
  const deadlineMs = startMs + budgetMs;
  const ruleId = rule.id || `rule_${ruleIndex}`;
  const resolvedVariants = resolveActivitySwitchyardVariants(activity);
  const variants = resolvedVariants.map((rv) => rv.state);

  const forbiddenSet = new Set<string>(rule.forbidBlocks ?? []);
  const forbidCombinators = new Set<string>(rule.forbidCombinators ?? []);
  const forbidSensors = new Set<string>(rule.forbidSensors ?? []);
  const allowedSim = new Set<string>(
    activity.palette.allowedSimBlocks ??
      switchyardSimulationEnvironment.paletteItems.map((p) => p.actionType)
  );
  const allowedControl = new Set<string>(activity.palette.allowedControlBlocks ?? []);
  const allowedScopes = new Set<ScopeType>(
    activity.palette.allowedScopes && activity.palette.allowedScopes.length > 0
      ? activity.palette.allowedScopes
      : ['MAIN']
  );

  const paletteAllowsVars =
    activity.palette.allowVariables !== undefined
      ? activity.palette.allowVariables === true
      : allowedControl.has('VAR_ASSIGN') || allowedControl.has('VAR_OP');
  const allowVarsInRule = paletteAllowsVars && rule.allowVariables !== false;
  const refVars: VariableName[] = [];
  if (activity.referenceSolution) {
    for (const sc of ALL_SCOPES) {
      for (const b of activity.referenceSolution[sc] || []) {
        if ((b.type === 'VAR_ASSIGN' || b.type === 'VAR_OP') && isVariableName(b.params?.a)) {
          if (!refVars.includes(b.params.a)) refVars.push(b.params.a);
        }
      }
    }
  }
  const activeVars: VariableName[] = allowVarsInRule
    ? (activity.palette.allowedVariableNames && activity.palette.allowedVariableNames.length > 0
        ? activity.palette.allowedVariableNames.slice(0, 2)
        : refVars.length > 0
        ? refVars.slice(0, 2)
        : ALL_VARIABLE_NAMES.slice(0, 2))
    : [];

  const atomicSteps = buildAtomicStepPool(
    activity,
    variants,
    forbiddenSet,
    forbidSensors,
    allowVarsInRule,
    activeVars,
    rule.allowRepeatBadges
  );

  const allowIf =
    allowedControl.has('IF') &&
    allowedControl.has('END_IF') &&
    !forbiddenSet.has('IF') &&
    !forbiddenSet.has('END_IF');
  const allowWhile =
    rule.maxLoopNestingDepth !== 0 &&
    allowedControl.has('WHILE') &&
    allowedControl.has('END_WHILE') &&
    !forbiddenSet.has('WHILE') &&
    !forbiddenSet.has('END_WHILE') &&
    !forbiddenSet.has('WHILE_START');

  const conditionPool =
    allowIf || allowWhile
      ? buildConditionPool(
          activity,
          variants,
          forbiddenSet,
          forbidCombinators,
          forbidSensors,
          allowVarsInRule,
          activeVars
        )
      : [];

  if (
    (rule.unmodifiedStarterMustFail || (rule.minStarterEditDistance ?? 0) > 0) &&
    activity.starterWorkspace
  ) {
    const editFailure = checkStarterEditDistanceRule(
      activity,
      rule,
      resolvedVariants,
      conditionPool,
      atomicSteps,
      startMs,
      deadlineMs,
      ruleId
    );
    if (editFailure) return editFailure;

    const onlyStarterCheck =
      !rule.forbidBlocks?.length &&
      rule.maxLoopNestingDepth === undefined &&
      !rule.pureSingleLoopOnly &&
      !rule.forbidCombinators?.length &&
      !rule.forbidSensors?.length &&
      rule.allowRepeatBadges === undefined &&
      rule.allowVariables === undefined;
    if (onlyStarterCheck) {
      return {
        ruleId,
        description: rule.description,
        rule,
        passed: true,
        elapsedMs: nowMs() - startMs,
        exploredStates: variants.length,
        minWinningBlocks: null,
        diagnostic:
          (rule.minStarterEditDistance ?? 0) > 1
            ? `Starter workspace fails and requires >= ${rule.minStarterEditDistance} edits`
            : 'Unmodified starter workspace fails as expected',
      };
    }
  }

  const allowF1 =
    allowedScopes.has('F1') && allowedControl.has('CALL_F1') && !forbiddenSet.has('CALL_F1');
  const allowScrap = allowedSim.has('SCRAP_ITEM') && !forbiddenSet.has('SCRAP_ITEM');

  if (
    !allowScrap &&
    variants.some(
      (v) =>
        (v.initialQueue.some((it) => it.damaged) && v.docks.every((d) => d.spec.rejectDamaged)) ||
        (v.scrapRule === 'damaged_or_overweight' &&
          v.initialQueue.some((it) => (it.weight ?? 1) > (v.scrapMaxWeight ?? 20)))
    )
  ) {
    return {
      ruleId,
      description: rule.description,
      rule,
      passed: true,
      elapsedMs: nowMs() - startMs,
      exploredStates: 0,
      minWinningBlocks: null,
      diagnostic:
        'Damaged/overweight items exist with rejecting docks and SCRAP_ITEM unavailable',
    };
  }

  const rawSlotLimit = resolveEffectiveSlotLimit(activity.slotCap);
  const effectiveRawLimit =
    !allowF1 && activity.slotCap?.perScope?.MAIN !== undefined
      ? Math.min(rawSlotLimit, activity.slotCap.perScope.MAIN)
      : rawSlotLimit;
  const slotCapLimit = Number.isFinite(effectiveRawLimit) ? effectiveRawLimit : 24;
  const maxAllowedCost =
    rule.maxLoopNestingDepth === 0
      ? Math.max(slotCapLimit, slotCapLimit + extraDepthBeyondCap)
      : slotCapLimit;

  const allowLoops =
    rule.maxLoopNestingDepth !== 0 &&
    allowedControl.has('LOOP_START') &&
    allowedControl.has('LOOP_END') &&
    !forbiddenSet.has('LOOP_START') &&
    !forbiddenSet.has('LOOP_END');
  const allowElse = allowedControl.has('ELSE') && !forbiddenSet.has('ELSE');
  const allowElseIf = allowedControl.has('ELSE_IF') && !forbiddenSet.has('ELSE_IF');

  let exploredStates = 0;
  let winner: WorkspaceState | undefined;
  let winnerCost: number | null = null;

  const actionPrimitives = atomicSteps.filter(
    (s) => (s.kind === 'ACTION' || s.kind === 'SWITCH') && (s.blocks[0]?.repeatCount ?? 1) === 1
  );
  const smallBodies: Array<{ blocks: CodeBlock[]; cost: number }> = [];

  for (const s1 of actionPrimitives) {
    smallBodies.push({ blocks: s1.blocks, cost: 1 });
    if (s1.kind === 'ACTION') continue;
    for (const s2 of actionPrimitives) {
      if (s1.kind === 'SWITCH' && s2.kind === 'SWITCH' && s1.junction === s2.junction) continue;
      if (s1.kind === 'SWITCH' && s2.actionType === 'SCRAP_ITEM') continue;
      smallBodies.push({ blocks: [...s1.blocks, ...s2.blocks], cost: 2 });
    }
  }

  // Add targeted accumulator bodies `[SWITCH_L/R, v = v + $itemWeight, SEND_NEXT]` (weight read BEFORE SEND_NEXT!)
  const accumBodiesLeft: Array<{ blocks: CodeBlock[]; cost: number }> = [];
  const accumBodiesRight: Array<{ blocks: CodeBlock[]; cost: number }> = [];
  const accumSendSharedLeft: CodeBlock[] = [];
  const accumSendSharedRight: CodeBlock[] = [];
  const accumSendStep = actionPrimitives.find((s) => s.actionType === 'SEND_NEXT');
  const accumScrapStep = actionPrimitives.find((s) => s.actionType === 'SCRAP_ITEM');
  const varWeightSteps = atomicSteps.filter((s) => s.id.startsWith('addW_'));
  if (varWeightSteps.length >= 2) {
    const swL = actionPrimitives.find((s) => s.actionType === 'SWITCH_LEFT');
    const swR = actionPrimitives.find((s) => s.actionType === 'SWITCH_RIGHT');
    if (swL && swR && accumSendStep) {
      accumSendSharedLeft.push(...swL.blocks, ...varWeightSteps[0].blocks);
      accumSendSharedRight.push(...swR.blocks, ...varWeightSteps[1].blocks);
      accumBodiesLeft.push({
        blocks: [...swL.blocks, ...varWeightSteps[0].blocks, ...accumSendStep.blocks],
        cost: 3,
      });
      accumBodiesRight.push({
        blocks: [...swR.blocks, ...varWeightSteps[1].blocks, ...accumSendStep.blocks],
        cost: 3,
      });
    }
  }

  const blocksEqual = (a: readonly CodeBlock[], b: readonly CodeBlock[]): boolean =>
    a.length === b.length &&
    a.every(
      (blk, i) =>
        blk.type === b[i].type &&
        blk.params?.junction === b[i].params?.junction &&
        blk.params?.a === b[i].params?.a
    );
  const allDocksRejectDamaged = variants.every((v) => v.docks.every((d) => d.spec.rejectDamaged));
  const scrapDamagedOnlyAll = variants.every((v) => v.scrapRule === 'damaged_only');
  const isDirectDamagedSensor = (expr: ConditionExpr): boolean =>
    expr.kind === 'sensor' && expr.sensor === 'itemDamaged';
  const branchIncompatibleWithDamaged = (blocks: readonly CodeBlock[]): boolean =>
    allDocksRejectDamaged && blocks.some((b) => b.type === 'SEND_NEXT');
  const branchIncompatibleWithHealthy = (blocks: readonly CodeBlock[]): boolean =>
    scrapDamagedOnlyAll && blocks.some((b) => b.type === 'SCRAP_ITEM');

  const damagedSensorCond = conditionPool.find((c) => isDirectDamagedSensor(c.expr));

  const controlSteps: CandidateStep[] = [];
  if (allowIf && conditionPool.length > 0) {
    const singleChoices = smallBodies.filter((b) => b.cost === 1);
    const thenChoices = smallBodies.filter((b) => b.cost <= 2);
    const elseChoices = smallBodies.filter((b) => b.cost <= 2);
    const consumerPairChoices = smallBodies.filter(
      (b) => b.cost === 2 && b.blocks.some((blk) => blk.type === 'SEND_NEXT')
    );
    const elifCondPool = conditionPool.slice(0, 6);
    const elifCondLabels = new Set(elifCondPool.map((c) => c.label));

    for (const cond of conditionPool) {
      if (nowMs() >= deadlineMs) break;
      const condIsDamaged = isDirectDamagedSensor(cond.expr);

      // Synthesize accumulator IF/ELSE (and optional outer IF itemDamaged -> SCRAP_ITEM wrapper for cmp.M2)
      if (
        allowElse &&
        accumBodiesLeft.length > 0 &&
        accumBodiesRight.length > 0 &&
        cond.expr.kind === 'cmp' &&
        typeof cond.expr.left === 'string' &&
        isVariableName(cond.expr.left) &&
        typeof cond.expr.right === 'string' &&
        isVariableName(cond.expr.right)
      ) {
        if (accumSendStep && 8 <= maxAllowedCost) {
          controlSteps.push({
            id: `ifelse_acc_${cond.label}`,
            cost: 8,
            kind: 'CONTROL',
            blocks: [
              makeBlock('if', 'IF', { params: { condition: cond.expr } }),
              ...accumSendSharedLeft,
              makeBlock('else', 'ELSE'),
              ...accumSendSharedRight,
              makeBlock('endif', 'END_IF'),
              ...accumSendStep.blocks,
            ],
          });
        }
        if (damagedSensorCond && accumScrapStep && accumSendStep && 12 <= maxAllowedCost) {
          controlSteps.push({
            id: `ifdmg_acc_${cond.label}`,
            cost: 12,
            kind: 'CONTROL',
            blocks: [
              makeBlock('if_d', 'IF', { params: { condition: damagedSensorCond.expr } }),
              ...accumScrapStep.blocks,
              makeBlock('else_d', 'ELSE'),
              makeBlock('if_s', 'IF', { params: { condition: cond.expr } }),
              ...accumSendSharedLeft,
              makeBlock('else_s', 'ELSE'),
              ...accumSendSharedRight,
              makeBlock('endif_s', 'END_IF'),
              ...accumSendStep.blocks,
              makeBlock('endif_d', 'END_IF'),
            ],
          });
        }
      }

      for (const tb of thenChoices) {
        if (nowMs() >= deadlineMs) break;
        if (condIsDamaged && branchIncompatibleWithDamaged(tb.blocks)) continue;
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
            if (blocksEqual(tb.blocks, eb.blocks)) continue;
            if (condIsDamaged && branchIncompatibleWithHealthy(eb.blocks)) continue;
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
        if (
          allowElseIf &&
          elifCondLabels.has(cond.label) &&
          elifCondPool.length >= 2 &&
          tb.cost === 1 &&
          3 + tb.cost + 1 <= maxAllowedCost
        ) {
          const tbConsumes = tb.blocks.some(
            (blk) => blk.type === 'SEND_NEXT' || blk.type === 'SCRAP_ITEM'
          );
          for (const cond2 of elifCondPool) {
            if (nowMs() >= deadlineMs) break;
            if (cond2.label === cond.label) continue;
            const cond2IsDamaged = isDirectDamagedSensor(cond2.expr);
            const eibChoices = tbConsumes
              ? [...singleChoices, ...consumerPairChoices]
              : singleChoices;
            for (const eib of eibChoices) {
              if (blocksEqual(tb.blocks, eib.blocks)) continue;
              if (condIsDamaged && branchIncompatibleWithHealthy(eib.blocks)) continue;
              if (cond2IsDamaged && branchIncompatibleWithDamaged(eib.blocks)) continue;
              const elifCost = 3 + tb.cost + eib.cost;
              if (elifCost <= maxAllowedCost && eib.cost === 1) {
                controlSteps.push({
                  id: `ifelif_${cond.label}_${cond2.label}`,
                  cost: elifCost,
                  kind: 'CONTROL',
                  blocks: [
                    makeBlock('if', 'IF', { params: { condition: cond.expr } }),
                    ...tb.blocks,
                    makeBlock('elseif', 'ELSE_IF', { params: { condition: cond2.expr } }),
                    ...eib.blocks,
                    makeBlock('endif', 'END_IF'),
                  ],
                });
              }
              if (allowElse && 4 + tb.cost + eib.cost + 1 <= maxAllowedCost) {
                const ebChoices = tbConsumes
                  ? [...singleChoices, ...consumerPairChoices]
                  : singleChoices;
                for (const eb of ebChoices) {
                  if (blocksEqual(eib.blocks, eb.blocks) || blocksEqual(tb.blocks, eb.blocks)) {
                    continue;
                  }
                  if (
                    (condIsDamaged || cond2IsDamaged) &&
                    branchIncompatibleWithHealthy(eb.blocks)
                  ) {
                    continue;
                  }
                  const elifElseCost = 4 + tb.cost + eib.cost + eb.cost;
                  if (elifElseCost > maxAllowedCost) continue;
                  controlSteps.push({
                    id: `ifelifelse_${cond.label}_${cond2.label}_c${tb.cost}`,
                    cost: elifElseCost,
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

    for (const rv of resolvedVariants) {
      const exec = executeSwitchyardWorkspace(ws, rv.state, 400, true, rv.initialVars);
      if (exec.status !== 'SUCCESS') allSuccess = false;
      if (
        (exec.status === 'COLLISION' &&
          exec.finalState.lastFailureReason &&
          exec.finalState.lastFailureReason !== 'UNSORTED_ITEMS_REMAIN') ||
        exec.status === 'MATH_ERROR' ||
        exec.status === 'TYPE_ERROR'
      ) {
        anyActionCollision = true;
        break;
      }
      keys.push(canonicalizeSwitchyardState(exec.finalState));
    }

    if (allSuccess && checkRuleRequirementsOnWorkspace(ws, rule, activity)) {
      const totalCost = ws.MAIN.length + ws.F1.length;
      if (!winner || totalCost < (winnerCost ?? Infinity)) {
        winner = ws;
        winnerCost = totalCost;
      }
    }

    return { allSuccess, anyActionCollision, stateKey: keys.join('||') };
  };

  const hasQueueConsumer = (blocks: readonly CodeBlock[]): boolean =>
    blocks.some((b) => b.type === 'SEND_NEXT' || b.type === 'SCRAP_ITEM');
  const maxItemsConsumedPerPass = (blocks: readonly CodeBlock[]): number => {
    const walk = (start: number): [number, number] => {
      let total = 0;
      let i = start;
      while (i < blocks.length) {
        const t = blocks[i].type;
        if (
          t === 'ELSE_IF' ||
          t === 'ELSE' ||
          t === 'END_IF' ||
          t === 'LOOP_END' ||
          t === 'END_WHILE'
        ) {
          return [total, i];
        }
        if (t === 'SEND_NEXT' || t === 'SCRAP_ITEM') {
          const curRep = blocks[i].repeatCount;
          const rep = typeof curRep === 'number' ? curRep : 1;
          total += Math.max(0, rep);
          i++;
          continue;
        }
        if (t === 'IF') {
          let branchMax = 0;
          let cursor = i + 1;
          while (cursor < blocks.length) {
            const [branchCount, stoppedAt] = walk(cursor);
            if (branchCount > branchMax) branchMax = branchCount;
            const stopType = blocks[stoppedAt]?.type;
            if (stopType === 'ELSE_IF' || stopType === 'ELSE') {
              cursor = stoppedAt + 1;
            } else if (stopType === 'END_IF') {
              cursor = stoppedAt + 1;
              break;
            } else {
              cursor = stoppedAt;
              break;
            }
          }
          total += branchMax;
          i = cursor;
          continue;
        }
        i++;
      }
      return [total, i];
    };
    return walk(0)[0];
  };
  const minItemsConsumedPerPass = (blocks: readonly CodeBlock[]): number => {
    const walkMin = (start: number): [number, number] => {
      let total = 0;
      let i = start;
      while (i < blocks.length) {
        const t = blocks[i].type;
        if (
          t === 'ELSE_IF' ||
          t === 'ELSE' ||
          t === 'END_IF' ||
          t === 'LOOP_END' ||
          t === 'END_WHILE'
        ) {
          return [total, i];
        }
        if (t === 'SEND_NEXT' || t === 'SCRAP_ITEM') {
          const curRep = blocks[i].repeatCount;
          const rep = typeof curRep === 'number' ? curRep : 1;
          total += Math.max(0, rep);
          i++;
          continue;
        }
        if (t === 'IF') {
          let branchMin = Number.POSITIVE_INFINITY;
          let sawElse = false;
          let cursor = i + 1;
          while (cursor < blocks.length) {
            const [branchCount, stoppedAt] = walkMin(cursor);
            if (branchCount < branchMin) branchMin = branchCount;
            const stopType = blocks[stoppedAt]?.type;
            if (stopType === 'ELSE') {
              sawElse = true;
              cursor = stoppedAt + 1;
            } else if (stopType === 'ELSE_IF') {
              cursor = stoppedAt + 1;
            } else if (stopType === 'END_IF') {
              cursor = stoppedAt + 1;
              break;
            } else {
              cursor = stoppedAt;
              break;
            }
          }
          total += sawElse && Number.isFinite(branchMin) ? branchMin : 0;
          i = cursor;
          continue;
        }
        i++;
      }
      return [total, i];
    };
    return walkMin(0)[0];
  };
  const everyControlBranchConsumes = (blocks: readonly CodeBlock[]): boolean =>
    minItemsConsumedPerPass(blocks) >= 1;
  const initialStateKey = evaluateMainAndWin([]).stateKey;

  if (allowLoops || allowWhile) {
    const queueLens = Array.from(
      new Set(variants.map((v) => v.initialQueue.length).filter((n) => n > 0))
    );
    const maxVariantQueueLen = queueLens.length > 0 ? Math.max(...queueLens) : 0;
    const rawLoopCounts = Array.from(new Set([...queueLens, 2, 3, 4])).sort((a, b) => a - b);
    const loopCounts =
      activity.palette.allowRepeatBadges === true
        ? rawLoopCounts
        : rawLoopCounts.filter((n) => n <= 2);
    const maxLoopBodyCost = Math.max(0, maxAllowedCost - 2);
    const hasNextCond = conditionPool.find(
      (c) => c.expr.kind === 'sensor' && c.expr.sensor === 'hasNextItem'
    );
    const whileConds = allowWhile
      ? hasNextCond
        ? [
            hasNextCond,
            ...conditionPool
              .filter((c) => c.expr.kind === 'sensor' && c.expr.sensor === 'itemDamaged')
              .slice(0, 1),
          ]
        : conditionPool
            .filter(
              (c) =>
                (c.expr.kind === 'sensor' && c.expr.sensor === 'itemDamaged') ||
                (c.expr.kind === 'cmp' &&
                  typeof c.expr.left === 'string' &&
                  c.expr.left.startsWith('$dockCount'))
            )
            .slice(0, 2)
      : [];

    const tryWrapBody = (bodyBlocks: CodeBlock[], bodyCost: number) => {
      if (nowMs() >= deadlineMs) return;
      if (bodyCost <= 0 || bodyCost + 2 > maxAllowedCost) return;
      if (winnerCost !== null && bodyCost + 2 >= winnerCost) return;
      const maxConsumed = maxItemsConsumedPerPass(bodyBlocks);
      if (maxConsumed <= 0) return;

      if (allowLoops) {
        for (const n of loopCounts) {
          if (nowMs() >= deadlineMs) return;
          if (n * maxConsumed < maxVariantQueueLen) continue;
          const wrapped = [
            makeBlock('l_s', 'LOOP_START', { repeatCount: n }),
            ...bodyBlocks,
            makeBlock('l_e', 'LOOP_END'),
          ];
          const sim = evaluateMainAndWin(wrapped);
          if (winnerCost !== null && bodyCost + 2 >= winnerCost) return;
          if (sim.anyActionCollision) break;
        }
      }
      if (allowWhile && (winnerCost === null || bodyCost + 2 < winnerCost)) {
        for (const wc of whileConds) {
          if (nowMs() >= deadlineMs) return;
          const wrapped = [
            makeBlock('w_s', 'WHILE', { params: { condition: wc.expr } }),
            ...bodyBlocks,
            makeBlock('w_e', 'END_WHILE'),
          ];
          evaluateMainAndWin(wrapped);
          if (winnerCost !== null && bodyCost + 2 >= winnerCost) return;
        }
      }
    };

    // Single-step loop pre-pass: evaluate minimal single-step bodies (e.g. standalone IF/ELSE_IF/ELSE
    // inside LOOP/WHILE) before multi-step permutations so exact-cost control loops are never starved.
    for (const step of allStepItems) {
      if (nowMs() >= deadlineMs || winner) break;
      if (step.cost > maxLoopBodyCost) break;
      if (!hasQueueConsumer(step.blocks)) continue;
      if (step.kind === 'CONTROL' && !everyControlBranchConsumes(step.blocks)) continue;
      tryWrapBody(step.blocks, step.cost);
    }

    const compoundMaxCost =
      winnerCost !== null ? Math.min(maxLoopBodyCost, winnerCost - 3) : maxLoopBodyCost;
    if (compoundMaxCost >= 2 && nowMs() < deadlineMs) {
      const bestFlatBodyCostByState = new Map<string, number>([[initialStateKey, 0]]);
      const bodyBuckets: Array<
        Array<{
          blocks: CodeBlock[];
          cost: number;
          lastSwitchJunction?: string;
          hasControl: boolean;
          hasVar: boolean;
          stepCount: number;
        }>
      > = Array.from({ length: compoundMaxCost + 1 }, () => []);
      bodyBuckets[0].push({
        blocks: [],
        cost: 0,
        hasControl: false,
        hasVar: false,
        stepCount: 0,
      });

      for (let cost = 0; cost <= compoundMaxCost && nowMs() < deadlineMs; cost++) {
        if (winnerCost !== null && cost + 2 >= winnerCost) break;
        for (const cur of bodyBuckets[cost]) {
          if (nowMs() >= deadlineMs || (winnerCost !== null && cost + 2 >= winnerCost)) break;
          if (cur.stepCount >= 2 && hasQueueConsumer(cur.blocks)) {
            tryWrapBody(cur.blocks, cur.cost);
          }

          if (cur.cost >= compoundMaxCost || (winnerCost !== null && cur.cost + 3 >= winnerCost)) {
            continue;
          }

          for (const step of allStepItems) {
            if (nowMs() >= deadlineMs) break;
            if (winnerCost !== null && cur.cost + step.cost + 2 >= winnerCost) break;
            const nc = cur.cost + step.cost;
            if (nc > compoundMaxCost) break;
            if (cur.stepCount === 0 && nc >= compoundMaxCost) continue;
            if (step.kind === 'SWITCH' && cur.lastSwitchJunction === step.junction) continue;

            const nextBlocks = [...cur.blocks, ...step.blocks];
            if (nc === compoundMaxCost && !hasQueueConsumer(nextBlocks)) continue;
            const nextHasControl = cur.hasControl || step.kind === 'CONTROL';
            const nextHasVar = cur.hasVar || step.kind === 'VAR';
            const sim = evaluateMainAndWin(nextBlocks);
            if (sim.allSuccess && winnerCost !== null && nc < winnerCost) {
              if (winnerCost <= cur.cost + 2) break;
            }
            if (sim.anyActionCollision) continue;

            if (!nextHasControl && !nextHasVar) {
              const prevBest = bestFlatBodyCostByState.get(sim.stateKey);
              if (prevBest !== undefined && prevBest <= nc) continue;
              bestFlatBodyCostByState.set(sim.stateKey, nc);
            }

            bodyBuckets[nc].push({
              blocks: nextBlocks,
              cost: nc,
              lastSwitchJunction: step.kind === 'SWITCH' ? step.junction : undefined,
              hasControl: nextHasControl,
              hasVar: nextHasVar,
              stepCount: cur.stepCount + 1,
            });
          }
        }
      }
    }
  }

  if (nowMs() < deadlineMs) {
    const flatMaxCost =
      winnerCost !== null ? Math.min(maxAllowedCost, winnerCost - 1) : maxAllowedCost;
    interface BfsNode {
      blocks: CodeBlock[];
      cost: number;
      lastSwitchJunction?: string;
    }

    const bestCostByState = new Map<string, number>([[initialStateKey, 0]]);
    const buckets: BfsNode[][] = Array.from({ length: Math.max(0, flatMaxCost) + 1 }, () => []);
    buckets[0].push({ blocks: [], cost: 0 });

    for (let cost = 0; cost <= flatMaxCost && nowMs() < deadlineMs; cost++) {
      if (winnerCost !== null && cost >= winnerCost) break;
      for (const cur of buckets[cost]) {
        if (nowMs() >= deadlineMs || (winnerCost !== null && cost >= winnerCost)) break;

        for (const step of allStepItems) {
          if (nowMs() >= deadlineMs) break;
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
  const ruleResults: RuleCheckResult[] = rules.map((rule, idx) => {
    const remainingBudget = Math.min(
      115,
      Math.max(35, Math.floor((220 - (nowMs() - startMs)) / Math.max(1, rules.length - idx)))
    );
    return verifySwitchyardActivityRule(
      activity,
      rule,
      idx,
      extraDepthBeyondCap,
      remainingBudget
    );
  });

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
