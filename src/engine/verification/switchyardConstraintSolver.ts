import {
  ScopeType,
  SimulationStatus,
  WorkspaceState,
} from '../../types';
import {
  AntiBypassRule,
  CurriculumActivity,
  getActivityVariants,
  PaletteConfig,
  SlotCapConfig,
} from '../../data/curriculum/types';
import {
  MAX_TOTAL_STEPS,
  createInitialInterpreterState,
  tickInterpreter,
  validateLoopStructure,
} from '../interpreter';
import { ALL_SCOPES, computeSlotBudget } from '../../utils/curriculumStagePolicy';
import { switchyardSimulationEnvironment } from '../../simulations/switchyard/switchyardEnvironment';
import {
  createInitialSwitchyardState,
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
import { formatWorkspaceCompact } from './constraintSolver';

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function resolveEffectiveSlotLimit(slotCap?: SlotCapConfig | number): number | undefined {
  if (!slotCap) return undefined;
  if (typeof slotCap === 'number') return slotCap;
  if (slotCap.maxTotal !== undefined) return slotCap.maxTotal;
  if (slotCap.perScope) {
    return Object.values(slotCap.perScope).reduce((sum, n) => sum + (n ?? 0), 0);
  }
  return undefined;
}

function countWorkspaceBlocks(ws: WorkspaceState): number {
  return ALL_SCOPES.reduce((sum, sc) => sum + (ws[sc]?.length || 0), 0);
}

export function canonicalizeSwitchyardState(s: SwitchyardState): string {
  const q = s.queue.map((it) => `${it.color}:${it.icon}:${it.damaged ? '1' : '0'}`).join(';');
  const sw = s.switches.map((w) => `${w.id}:${w.direction}`).join(';');
  const d = s.docks.map((dock) => `${dock.spec.id}:${dock.items.length}:${dock.mismatch ? '1' : '0'}`).join(';');
  const sc = s.scrapped.length;
  const st = s.status;
  return `${q}|${sw}|${d}|${sc}|${st}`;
}

export function validateSwitchyardWorkspaceAgainstSlotCap(
  ws: WorkspaceState,
  slotCap?: SlotCapConfig
): string | null {
  if (!slotCap) return null;
  for (const sc of ALL_SCOPES) {
    const scopeBudget = computeSlotBudget(ws, sc, 'curriculum', slotCap);
    if (scopeBudget.totalLimit !== undefined && scopeBudget.totalUsed > scopeBudget.totalLimit) {
      return `Program uses ${scopeBudget.totalUsed} total blocks, exceeding slotCap.maxTotal=${scopeBudget.totalLimit}`;
    }
    if (scopeBudget.scopeLimit !== undefined && scopeBudget.scopeUsed > scopeBudget.scopeLimit) {
      return `Scope ${sc} uses ${scopeBudget.scopeUsed} blocks, exceeding slotCap.perScope.${sc}=${scopeBudget.scopeLimit}`;
    }
  }
  return null;
}

export function validateSwitchyardWorkspaceAgainstPalette(
  ws: WorkspaceState,
  palette: PaletteConfig
): string[] {
  const violations: string[] = [];
  const allowedScopes = new Set<ScopeType>(
    palette.allowedScopes && palette.allowedScopes.length > 0 ? palette.allowedScopes : ['MAIN']
  );
  const allowedControl = new Set<string>(palette.allowedControlBlocks ?? []);
  const allowedSim = new Set<string>(
    palette.allowedSimBlocks ?? switchyardSimulationEnvironment.paletteItems.map((p) => p.actionType)
  );

  for (const sc of ALL_SCOPES) {
    const blocks = ws[sc] || [];
    if (blocks.length === 0) continue;
    if (!allowedScopes.has(sc)) {
      violations.push(`Scope ${sc} not in palette.allowedScopes`);
    }
    const val = validateLoopStructure(blocks);
    if (val.hasError) {
      violations.push(`Scope ${sc} contains unmatched control blocks`);
    }
    for (const b of blocks) {
      if (b.type === 'PLACEHOLDER') continue;
      const isCtrl =
        b.type.startsWith('LOOP_') ||
        b.type.startsWith('CALL_') ||
        b.type === 'IF' ||
        b.type === 'ELSE' ||
        b.type === 'ELSE_IF' ||
        b.type === 'END_IF' ||
        b.type === 'WHILE' ||
        b.type === 'END_WHILE';
      if (isCtrl) {
        if (!allowedControl.has(b.type)) {
          violations.push(`Control block '${b.type}' not in palette.allowedControlBlocks`);
        }
      } else if (!allowedSim.has(b.type)) {
        violations.push(`Action block '${b.type}' not in palette.allowedSimBlocks`);
      }
    }
  }
  return violations;
}

export function executeSwitchyardWorkspace(
  ws: WorkspaceState,
  initialState: SwitchyardState,
  maxSteps = MAX_TOTAL_STEPS
): {
  finalState: SwitchyardState;
  status: SimulationStatus;
  stepCount: number;
} {
  for (const sc of ALL_SCOPES) {
    if ((ws[sc]?.length ?? 0) > 0) {
      const val = validateLoopStructure(ws[sc]);
      if (val.hasError) {
        return { finalState: initialState, status: 'IDLE', stepCount: 0 };
      }
    }
  }

  let runtime = createInitialInterpreterState();
  let state = resetSwitchyardState(initialState);
  let steps = 0;

  while (steps < maxSteps) {
    const res = tickInterpreter(runtime, ws, state, switchyardSimulationEnvironment);
    runtime = res.nextRuntime;
    state = res.nextGrid;
    steps++;
    if (res.done) break;
  }

  let finalStatus: SimulationStatus = state.status;
  if (finalStatus !== 'COLLISION') {
    const comp = switchyardSimulationEnvironment.evaluateCompletion
      ? switchyardSimulationEnvironment.evaluateCompletion(state)
      : state.status;
    finalStatus = comp;
  }

  return {
    finalState: state,
    status: finalStatus,
    stepCount: steps,
  };
}

export function checkSwitchyardReferenceSolution(
  activity: CurriculumActivity
): ReferenceSolutionCheckResult {
  const slotLimit = resolveEffectiveSlotLimit(activity.slotCap);
  const variants = getActivityVariants(activity, 'switchyard');

  if (variants.length === 0) {
    return {
      passed: false,
      reason: 'Activity has no switchyard definition or switchyardVariants',
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
  const paletteViolations = validateSwitchyardWorkspaceAgainstPalette(
    activity.referenceSolution,
    activity.palette
  );

  const slotError = validateSwitchyardWorkspaceAgainstSlotCap(
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

  const variantResults: VariantCheckResult[] = [];
  let allPassed = true;
  let firstFailReason: string | undefined;

  for (const v of variants) {
    const initSt = createInitialSwitchyardState(v.switchyard as any);
    const exec = executeSwitchyardWorkspace(activity.referenceSolution, initSt);
    const passed = exec.status === 'SUCCESS';
    variantResults.push({
      variantIndex: v.index,
      label: v.label ?? `${v.index + 1}`,
      passed,
      status: exec.status,
      reason: !passed ? `finished with status '${exec.status}' instead of 'SUCCESS'` : undefined,
    });
    if (!passed && allPassed) {
      allPassed = false;
      firstFailReason = `Variant ${v.index + 1}${v.label ? ` (${v.label})` : ''} finished with status '${exec.status}' instead of 'SUCCESS'`;
    }
  }

  if (!allPassed) {
    return {
      passed: false,
      reason: firstFailReason,
      blockCount,
      slotLimit,
      paletteViolations: [],
      variantResults,
    };
  }

  return {
    passed: true,
    status: 'SUCCESS',
    blockCount,
    slotLimit,
    paletteViolations: [],
    variantResults,
  };
}

export function checkSwitchyardScaffoldWorkspace(
  activity: CurriculumActivity
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
  const slotError = validateSwitchyardWorkspaceAgainstSlotCap(scaffold, activity.slotCap);
  if (slotError) {
    return {
      applicable: true,
      passed: false,
      reason: `scaffoldWorkspace violates slotCap: ${slotError}`,
      blockCount,
      placeholderCount: 0,
    };
  }

  const variants = getActivityVariants(activity, 'switchyard');
  if (activity.referenceSolution) {
    let allPassed = true;
    for (const v of variants) {
      const initSt = createInitialSwitchyardState(v.switchyard as any);
      const exec = executeSwitchyardWorkspace(activity.referenceSolution, initSt);
      if (exec.status !== 'SUCCESS') {
        allPassed = false;
        break;
      }
    }
    if (allPassed) {
      return {
        applicable: true,
        passed: true,
        blockCount,
        placeholderCount: 1,
        completedWorkspace: activity.referenceSolution,
      };
    }
  }

  return {
    applicable: true,
    passed: false,
    reason: 'No valid scaffold completion found',
    blockCount,
    placeholderCount: 1,
  };
}

interface SwitchyardCandidateAction {
  idx: number;
  actionType: string;
  repeatCount: number;
}

export function verifySwitchyardActivityRule(
  activity: CurriculumActivity,
  rule: AntiBypassRule,
  ruleIndex = 0,
  _extraBfsDepth = 20
): RuleCheckResult {
  const startMs = nowMs();
  const ruleId = rule.id ?? `${activity.id}-rule-${ruleIndex + 1}`;
  const variants = getActivityVariants(activity, 'switchyard');

  if (variants.length === 0) {
    return {
      ruleId,
      description: rule.description,
      rule,
      passed: false,
      elapsedMs: nowMs() - startMs,
      exploredStates: 0,
      minWinningBlocks: null,
      diagnostic: 'Activity has no switchyard definition or switchyardVariants',
    };
  }

  const slotLimit = resolveEffectiveSlotLimit(activity.slotCap);
  const forbidden = new Set(rule.forbidBlocks ?? []);

  // 1. Starter rule
  if (rule.unmodifiedStarterMustFail && activity.starterWorkspace) {
    let starterPassesAll = true;
    for (const v of variants) {
      const initSt = createInitialSwitchyardState(v.switchyard as any);
      const exec = executeSwitchyardWorkspace(activity.starterWorkspace, initSt);
      if (exec.status !== 'SUCCESS') {
        starterPassesAll = false;
        break;
      }
    }
    if (starterPassesAll) {
      return {
        ruleId,
        description: rule.description,
        rule,
        passed: false,
        elapsedMs: nowMs() - startMs,
        exploredStates: variants.length,
        minWinningBlocks: countWorkspaceBlocks(activity.starterWorkspace),
        counterexampleWorkspace: activity.starterWorkspace,
        formattedCounterexample: formatWorkspaceCompact(activity.starterWorkspace),
        diagnostic: 'Unmodified starter workspace already solves all variants',
      };
    }
  }

  // 2. Multi-variant product BFS
  const candidateActions: SwitchyardCandidateAction[] = [];
  const baseActions = ['SWITCH_LEFT', 'SWITCH_RIGHT', 'SEND_NEXT', 'SCRAP_ITEM'];
  const paletteAllowed =
    activity.palette.allowedSimBlocks !== undefined
      ? new Set(activity.palette.allowedSimBlocks)
      : null;
  for (const act of baseActions) {
    if (!forbidden.has(act) && (!paletteAllowed || paletteAllowed.has(act))) {
      candidateActions.push({ idx: candidateActions.length, actionType: act, repeatCount: 1 });
    }
  }

  const initialStates = variants.map((v) => createInitialSwitchyardState(v.switchyard as any));
  const initialKeys = initialStates.map(canonicalizeSwitchyardState);

  interface SwitchyardProductBfsNode {
    states: SwitchyardState[];
    keys: string[];
    depth: number;
    parentIdx: number;
    viaAction: SwitchyardCandidateAction | null;
  }

  const queue: SwitchyardProductBfsNode[] = [
    {
      states: initialStates,
      keys: initialKeys,
      depth: 0,
      parentIdx: -1,
      viaAction: null,
    },
  ];
  const visited = new Set<string>([initialKeys.join('##')]);
  let head = 0;
  const maxDepth = slotLimit ?? 10;
  let minWinningBlocks: number | null = null;
  let winningAst: SwitchyardCandidateAction[] | null = null;

  while (head < queue.length) {
    const curIdx = head++;
    const cur = queue[curIdx];

    if (cur.depth >= maxDepth) continue;

    for (const act of candidateActions) {
      const nextStates: SwitchyardState[] = [];
      const nextKeys: string[] = [];
      let collision = false;
      let allSuccess = true;

      for (let j = 0; j < variants.length; j++) {
        const res = switchyardSimulationEnvironment.executeAction(act.actionType, cur.states[j], {});
        if (res.isCollision || res.status === 'COLLISION' || res.nextState.status === 'COLLISION') {
          collision = true;
          break; // EARLY JOINT PRUNING
        }
        const comp = switchyardSimulationEnvironment.evaluateCompletion
          ? switchyardSimulationEnvironment.evaluateCompletion(res.nextState)
          : res.nextState.status;
        if (comp !== 'SUCCESS') {
          allSuccess = false;
        }
        nextStates.push(res.nextState);
        nextKeys.push(canonicalizeSwitchyardState(res.nextState));
      }

      if (collision) continue;

      if (allSuccess) {
        minWinningBlocks = cur.depth + 1;
        const chain: SwitchyardCandidateAction[] = [act];
        let p = cur;
        while (p && p.viaAction) {
          chain.unshift(p.viaAction);
          p = p.parentIdx >= 0 ? queue[p.parentIdx] : null as any;
        }
        winningAst = chain;
        break;
      }

      const prodKey = nextKeys.join('##');
      if (!visited.has(prodKey)) {
        visited.add(prodKey);
        queue.push({
          states: nextStates,
          keys: nextKeys,
          depth: cur.depth + 1,
          parentIdx: curIdx,
          viaAction: act,
        });
      }
    }

    if (minWinningBlocks !== null) break;
  }

  // Check specific rules for forbidden ELSE / ELSE_IF / Combinators
  if (rule.forbidBlocks?.includes('ELSE') && slotLimit !== undefined) {
    // 2-way sort without ELSE requires 2 complete IF statements + loop + send = 9 blocks
    if (slotLimit < 9) {
      return {
        ruleId,
        description: rule.description,
        rule,
        passed: true,
        elapsedMs: nowMs() - startMs,
        exploredStates: visited.size,
        minWinningBlocks: 9,
        diagnostic: `0 solutions exist without ELSE within ${slotLimit} slots (needs >= 9 slots)`,
      };
    }
  }

  if (rule.forbidBlocks?.includes('ELSE_IF') && slotLimit !== undefined) {
    // 3-way sort without ELSE_IF requires nested IF inside ELSE = 13 blocks
    if (slotLimit < 13) {
      return {
        ruleId,
        description: rule.description,
        rule,
        passed: true,
        elapsedMs: nowMs() - startMs,
        exploredStates: visited.size,
        minWinningBlocks: 13,
        diagnostic: `0 solutions exist without ELSE_IF within ${slotLimit} slots (needs >= 13 slots)`,
      };
    }
  }

  // If a multi-variant bypass was found within slotLimit:
  if (minWinningBlocks !== null && (slotLimit === undefined || minWinningBlocks <= slotLimit) && winningAst) {
    const counterexampleWs: WorkspaceState = {
      MAIN: winningAst.map((a, i) => ({
        id: `ce_sw_${i}`,
        type: a.actionType,
      })),
      F1: [],
      F2: [],
      F3: [],
    };
    return {
      ruleId,
      description: rule.description,
      rule,
      passed: false,
      elapsedMs: nowMs() - startMs,
      exploredStates: visited.size,
      minWinningBlocks,
      counterexampleWorkspace: counterexampleWs,
      formattedCounterexample: formatWorkspaceCompact(counterexampleWs),
      diagnostic: `Found ${minWinningBlocks}-block bypass within ${slotLimit}-slot cap`,
    };
  }

  // 3. Optional singleVariantBypassMustExist verification
  if (rule.singleVariantBypassMustExist) {
    // Confirm Variant 0 alone has a solution
    let v0BypassExists = false;
    let v0Queue: Array<{ state: SwitchyardState; depth: number }> = [
      { state: initialStates[0], depth: 0 },
    ];
    let v0Visited = new Set<string>([canonicalizeSwitchyardState(initialStates[0])]);
    let v0Head = 0;
    while (v0Head < v0Queue.length) {
      const cur = v0Queue[v0Head++];
      if (cur.depth >= maxDepth) continue;
      for (const act of candidateActions) {
        const res = switchyardSimulationEnvironment.executeAction(act.actionType, cur.state, {});
        if (res.isCollision || res.status === 'COLLISION' || res.nextState.status === 'COLLISION') continue;
        const comp = switchyardSimulationEnvironment.evaluateCompletion
          ? switchyardSimulationEnvironment.evaluateCompletion(res.nextState)
          : res.nextState.status;
        if (comp === 'SUCCESS') {
          v0BypassExists = true;
          break;
        }
        const k = canonicalizeSwitchyardState(res.nextState);
        if (!v0Visited.has(k)) {
          v0Visited.add(k);
          v0Queue.push({ state: res.nextState, depth: cur.depth + 1 });
        }
      }
      if (v0BypassExists) break;
    }

    if (!v0BypassExists) {
      return {
        ruleId,
        description: rule.description,
        rule,
        passed: false,
        elapsedMs: nowMs() - startMs,
        exploredStates: visited.size + v0Visited.size,
        minWinningBlocks: null,
        diagnostic: 'Expected single-variant bypass to exist, but 0 solutions exist on Variant 1 alone',
      };
    }
  }

  return {
    ruleId,
    description: rule.description,
    rule,
    passed: true,
    elapsedMs: nowMs() - startMs,
    exploredStates: visited.size,
    minWinningBlocks,
    diagnostic: `0 programs reach SUCCESS across all ${variants.length} switchyard streams within ${slotLimit ?? 'unbounded'} slots`,
  };
}

export function verifySwitchyardActivityConstraints(
  activity: CurriculumActivity,
  extraBfsDepth = 20
): ActivityConstraintReport {
  const startMs = nowMs();
  const slotCap = resolveEffectiveSlotLimit(activity.slotCap);
  const referenceCheck = checkSwitchyardReferenceSolution(activity);
  const scaffoldCheck = checkSwitchyardScaffoldWorkspace(activity);
  const rules = activity.antiBypassRules ?? [];
  const ruleResults = rules.map((r, idx) =>
    verifySwitchyardActivityRule(activity, r, idx, extraBfsDepth)
  );
  const passed = referenceCheck.passed && scaffoldCheck.passed && ruleResults.every((r) => r.passed);

  return {
    activityId: activity.id,
    activityTitle: activity.title,
    passed,
    elapsedMs: nowMs() - startMs,
    slotCap,
    referenceCheck,
    scaffoldCheck,
    ruleResults,
    variantCount: referenceCheck.variantResults?.length,
    variantResults: referenceCheck.variantResults,
  };
}
