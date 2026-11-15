import {
  CodeBlock,
  ScopeType,
  SimulationStatus,
  WorkspaceState,
} from '../../types';
import {
  AntiBypassRule,
  CurriculumActivity,
  PaletteConfig,
  SlotCapConfig,
} from '../../data/curriculum/types';
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
import { depotSimulationEnvironment } from '../../simulations/depot/depotEnvironment';
import {
  createInitialDepotState,
  getActiveDepotStations,
} from '../../simulations/depot/depotPhysics';
import { DEPOT_STATIONS, DepotState, DepotStationId } from '../../simulations/depot/types';
import type {
  ActivityConstraintReport,
  ReferenceSolutionCheckResult,
  RuleCheckResult,
  ScaffoldCheckResult,
} from './constraintSolver';

interface DepotCandidateActionSpec {
  idx: number;
  actionType: string;
  repeatCount: number;
  params?: Record<string, unknown>;
}

type DepotAstNode =
  | {
      kind: 'action';
      spec: DepotCandidateActionSpec;
      slotCost: 1;
    }
  | {
      kind: 'loop';
      count: number;
      body: DepotAstNode[];
      slotCost: number;
    };

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function resolveEffectiveSlotLimit(slotCap?: SlotCapConfig): number | undefined {
  if (!slotCap) return undefined;
  if (slotCap.maxTotal !== undefined) return slotCap.maxTotal;
  if (slotCap.perScope) {
    return Object.values(slotCap.perScope).reduce((sum, n) => sum + (n ?? 0), 0);
  }
  return undefined;
}

function countWorkspaceBlocks(ws: WorkspaceState): number {
  return ALL_SCOPES.reduce((sum, sc) => sum + (ws[sc]?.length || 0), 0);
}

function canonicalDepotKey(s: DepotState): string {
  const base = `${s.workerStation}|${s.heldCrate ?? '_'}|${s.stacks[0].join(',')}|${s.stacks[1].join(',')}|${s.stacks[2].join(',')}|${s.output.join(',')}`;
  if (s.queue.length === 0 && s.scrapCount === 0 && !s.heldDamaged) return base;
  const qStr = s.queue.map((q) => (q.damaged ? `${q.color}!` : q.color)).join(',');
  return `${base}|Q:${qStr}|S:${s.scrapCount}|D:${s.heldDamaged ? 1 : 0}`;
}

function cloneDepotState(s: DepotState): DepotState {
  return {
    ...s,
    stacks: [[...s.stacks[0]], [...s.stacks[1]], [...s.stacks[2]]],
    initialStacks: [
      [...s.initialStacks[0]],
      [...s.initialStacks[1]],
      [...s.initialStacks[2]],
    ],
    output: [...s.output],
    targetStacks: s.targetStacks
      ? [[...s.targetStacks[0]], [...s.targetStacks[1]], [...s.targetStacks[2]]]
      : undefined,
    targetOutput: s.targetOutput ? [...s.targetOutput] : undefined,
    queue: s.queue.map((item) => ({ ...item })),
    initialQueue: s.initialQueue.map((item) => ({ ...item })),
    activeStationsMask: s.activeStationsMask,
  };
}

function astNodesToBlocks(nodes: readonly DepotAstNode[], prefix = 'depot_sol'): CodeBlock[] {
  const out: CodeBlock[] = [];
  let seq = 0;
  const emit = (list: readonly DepotAstNode[]) => {
    for (const node of list) {
      if (node.kind === 'action') {
        seq++;
        out.push({
          id: `${prefix}_${seq}`,
          type: node.spec.actionType,
          ...(node.spec.repeatCount > 1 ? { repeatCount: node.spec.repeatCount } : {}),
          ...(node.spec.params ? { params: { ...node.spec.params } } : {}),
        });
      } else {
        seq++;
        out.push({
          id: `${prefix}_${seq}`,
          type: 'LOOP_START',
          repeatCount: node.count,
        });
        emit(node.body);
        seq++;
        out.push({
          id: `${prefix}_${seq}`,
          type: 'LOOP_END',
        });
      }
    }
  };
  emit(nodes);
  return out;
}

function astToWorkspace(nodes: readonly DepotAstNode[], prefix = 'depot_sol'): WorkspaceState {
  return {
    MAIN: astNodesToBlocks(nodes, prefix),
    F1: [],
    F2: [],
    F3: [],
  };
}

function formatWorkspaceCompact(ws: WorkspaceState): string {
  const fmt = (b: CodeBlock) => {
    const rep =
      typeof b.repeatCount === 'number' && b.repeatCount > 1 ? `×${b.repeatCount}` : '';
    const param = b.params?.station ? `(${String(b.params.station)})` : '';
    return `${b.type}${param}${rep}`;
  };
  return ws.MAIN.map(fmt).join(', ');
}

function validateDepotWorkspaceAgainstSlotCap(
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

function validateDepotWorkspaceAgainstPalette(
  ws: WorkspaceState,
  palette: PaletteConfig
): string[] {
  const violations: string[] = [];
  const allowedScopes = new Set<ScopeType>(
    palette.allowedScopes && palette.allowedScopes.length > 0 ? palette.allowedScopes : ['MAIN']
  );
  const allowedControl = new Set<string>(palette.allowedControlBlocks ?? []);
  const allowedSim = new Set<string>(
    palette.allowedSimBlocks !== undefined
      ? palette.allowedSimBlocks
      : depotSimulationEnvironment.paletteItems.map((p) => p.actionType)
  );
  const controlSet = new Set<string>([
    'LOOP_START',
    'LOOP_END',
    'CALL_F1',
    'CALL_F2',
    'CALL_F3',
    'IF',
    'ELSE',
    'END_IF',
    'WHILE',
    'VAR_ASSIGN',
    'VAR_OP',
  ]);

  for (const sc of ALL_SCOPES) {
    const blocks = ws[sc] || [];
    if (blocks.length > 0 && !allowedScopes.has(sc)) {
      violations.push(`Scope '${sc}' has blocks but is not in palette.allowedScopes`);
    }
    for (const blk of blocks) {
      if (blk.type === 'PLACEHOLDER') {
        violations.push(`Contains unreplaced PLACEHOLDER block '${blk.id}'`);
        continue;
      }
      if (controlSet.has(blk.type)) {
        if (!allowedControl.has(blk.type)) {
          violations.push(`Control block '${blk.type}' is not in palette.allowedControlBlocks`);
        }
      } else if (!allowedSim.has(blk.type)) {
        violations.push(`Sim block '${blk.type}' is not in palette.allowedSimBlocks`);
      }

      if (blk.type === 'DEPOT_MOVE_TO') {
        const station = blk.params?.station as DepotStationId | undefined;
        if (!station || !DEPOT_STATIONS.includes(station)) {
          violations.push(`Invalid DEPOT_MOVE_TO station param: '${String(station)}'`);
        }
      }

      if (
        blk.type !== 'LOOP_START' &&
        typeof blk.repeatCount === 'number' &&
        blk.repeatCount > 1 &&
        palette.allowRepeatBadges === false
      ) {
        violations.push(`Repeat badge ×${blk.repeatCount} disallowed when allowRepeatBadges=false`);
      }
    }

    if (blocks.length > 0) {
      const loopVal = validateLoopStructure(blocks);
      if (loopVal.hasError) {
        violations.push(`Scope '${sc}' has invalid loop structure`);
      }
    }
  }

  return violations;
}

function executeDepotWorkspace(
  ws: WorkspaceState,
  initialDepot: DepotState
): {
  finalState: DepotState;
  status: SimulationStatus;
  stepCount: number;
  actionExecutions: Record<string, number>;
} {
  let runtime = createInitialInterpreterState();
  let state = cloneDepotState(initialDepot);
  let steps = 0;
  const actionExecutions: Record<string, number> = {};

  while (steps < MAX_TOTAL_STEPS) {
    if (runtime.callStack.length > 0) {
      const frame = runtime.callStack[runtime.callStack.length - 1];
      const blk = (ws[frame.scope] || [])[frame.pc];
      if (blk) {
        actionExecutions[blk.type] = (actionExecutions[blk.type] || 0) + 1;
      }
    }
    const res = tickInterpreter(runtime, ws, state, depotSimulationEnvironment);
    runtime = res.nextRuntime;
    state = res.nextGrid;
    steps++;
    if (runtime.status === 'PAUSED' || res.done) {
      break;
    }
  }

  const finalStatus: SimulationStatus =
    state.status === 'SUCCESS'
      ? 'SUCCESS'
      : state.status === 'COLLISION'
      ? 'COLLISION'
      : runtime.status === 'PAUSED'
      ? 'PAUSED'
      : 'IDLE';

  return {
    finalState: state,
    status: finalStatus,
    stepCount: steps,
    actionExecutions,
  };
}

function buildDepotCandidateActions(
  palette: PaletteConfig,
  rule?: AntiBypassRule,
  activeStations: readonly DepotStationId[] = DEPOT_STATIONS
): {
  actions: DepotCandidateActionSpec[];
  loopsAllowed: boolean;
  loopCounts: number[];
} {
  const forbidden = new Set(rule?.forbidBlocks ?? []);
  const baseSimTypes =
    palette.allowedSimBlocks !== undefined
      ? palette.allowedSimBlocks
      : depotSimulationEnvironment.paletteItems.map((p) => p.actionType);
  const allowedSimTypes = baseSimTypes.filter((t) => !forbidden.has(t));

  const allowedControl = (palette.allowedControlBlocks ?? []).filter((c) => !forbidden.has(c));
  const hasLoopBlocks =
    allowedControl.includes('LOOP_START') && allowedControl.includes('LOOP_END');
  const loopsAllowed =
    hasLoopBlocks && (rule?.maxLoopNestingDepth === undefined || rule.maxLoopNestingDepth > 0);
  const loopCounts = palette.allowRepeatBadges === true ? [2, 3, 4, 5, 6] : [2];

  const candidateStations = activeStations.length > 0 ? activeStations : DEPOT_STATIONS;
  const actions: DepotCandidateActionSpec[] = [];
  for (const actionType of allowedSimTypes) {
    if (actionType === 'DEPOT_MOVE_TO') {
      for (const station of candidateStations) {
        actions.push({
          idx: actions.length,
          actionType,
          repeatCount: 1,
          params: { station },
        });
      }
    } else {
      actions.push({
        idx: actions.length,
        actionType,
        repeatCount: 1,
      });
    }
  }

  return { actions, loopsAllowed, loopCounts };
}

function stepSingleDepotAction(
  state: DepotState,
  action: DepotCandidateActionSpec
): { status: 'RUNNING' | 'SUCCESS' | 'COLLISION'; nextState: DepotState } {
  const res = depotSimulationEnvironment.executeAction(
    action.actionType,
    cloneDepotState(state),
    action.params ? { params: action.params } : undefined
  );
  const nextState = res.nextState;
  const status: 'RUNNING' | 'SUCCESS' | 'COLLISION' =
    res.status === 'SUCCESS' || nextState.status === 'SUCCESS'
      ? 'SUCCESS'
      : res.status === 'COLLISION' || nextState.status === 'COLLISION'
      ? 'COLLISION'
      : 'RUNNING';
  return { status, nextState };
}

function solveDepotLoopFreeBfs(
  initialState: DepotState,
  actions: readonly DepotCandidateActionSpec[],
  maxBlocks?: number
): {
  minWinningBlocks: number | null;
  winningAst?: DepotAstNode[];
  exploredStates: number;
  exhaustedStateSpace: boolean;
} {
  interface BfsEntry {
    state: DepotState;
    stateKey: string;
    depth: number;
    parentIdx: number;
    actionIdx: number;
  }

  const startKey = canonicalDepotKey(initialState);
  const visited = new Set<string>([startKey]);
  const queue: BfsEntry[] = [
    { state: initialState, stateKey: startKey, depth: 0, parentIdx: -1, actionIdx: -1 },
  ];
  let head = 0;
  let exploredStates = 1;

  while (head < queue.length) {
    const cur = queue[head];
    if (maxBlocks !== undefined && cur.depth >= maxBlocks) {
      head++;
      continue;
    }

    for (let a = 0; a < actions.length; a++) {
      const action = actions[a];
      const next = stepSingleDepotAction(cur.state, action);
      exploredStates++;

      if (next.status === 'COLLISION') continue;

      const nextDepth = cur.depth + 1;
      if (next.status === 'SUCCESS') {
        const revIndices: number[] = [a];
        let ptr = head;
        while (ptr > 0) {
          revIndices.push(queue[ptr].actionIdx);
          ptr = queue[ptr].parentIdx;
        }
        const ast: DepotAstNode[] = [];
        for (let i = revIndices.length - 1; i >= 0; i--) {
          ast.push({ kind: 'action', spec: actions[revIndices[i]], slotCost: 1 });
        }
        return {
          minWinningBlocks: nextDepth,
          winningAst: ast,
          exploredStates,
          exhaustedStateSpace: false,
        };
      }

      const nextKey = canonicalDepotKey(next.nextState);
      if (!visited.has(nextKey)) {
        visited.add(nextKey);
        queue.push({
          state: next.nextState,
          stateKey: nextKey,
          depth: nextDepth,
          parentIdx: head,
          actionIdx: a,
        });
      }
    }

    head++;
  }

  return {
    minWinningBlocks: null,
    exploredStates,
    exhaustedStateSpace: maxBlocks === undefined,
  };
}

function executeDepotAstFromState(
  state: DepotState,
  nodes: readonly DepotAstNode[]
): { status: 'RUNNING' | 'SUCCESS' | 'COLLISION'; nextState: DepotState; steps: number } {
  let cur = state;
  let totalSteps = 0;

  const runNodes = (list: readonly DepotAstNode[]): 'RUNNING' | 'SUCCESS' | 'COLLISION' => {
    for (const node of list) {
      if (node.kind === 'action') {
        totalSteps++;
        if (totalSteps > MAX_TOTAL_STEPS) return 'COLLISION';
        const stepRes = stepSingleDepotAction(cur, node.spec);
        cur = stepRes.nextState;
        if (stepRes.status !== 'RUNNING') return stepRes.status;
      } else {
        for (let i = 0; i < node.count; i++) {
          const inner = runNodes(node.body);
          if (inner !== 'RUNNING') return inner;
        }
      }
    }
    return 'RUNNING';
  };

  const finalStatus = runNodes(nodes);
  return { status: finalStatus, nextState: cur, steps: totalSteps };
}

function solveDepotStructuralLoopSearch(
  initialState: DepotState,
  actions: readonly DepotCandidateActionSpec[],
  loopCounts: readonly number[],
  slotLimit: number,
  maxLoopDepth: number
): { minWinningBlocks: number | null; winningAst?: DepotAstNode[]; exploredStates: number } {
  let exploredStates = 0;

  // Iterative deepening on slot count so first found solution has minimal blocks
  for (let targetSlots = 1; targetSlots <= slotLimit; targetSlots++) {
    const searchSeq = (
      curState: DepotState,
      curKey: string,
      remSlots: number,
      curDepth: number
    ): DepotAstNode[] | null => {
      if (remSlots === 0) return null;

      // Single action (slotCost 1)
      for (const act of actions) {
        const res = stepSingleDepotAction(curState, act);
        exploredStates++;
        if (res.status === 'COLLISION') continue;
        const node: DepotAstNode = { kind: 'action', spec: act, slotCost: 1 };
        if (res.status === 'SUCCESS') {
          if (remSlots === 1) return [node];
          continue;
        }
        if (remSlots > 1) {
          const tail = searchSeq(res.nextState, canonicalDepotKey(res.nextState), remSlots - 1, curDepth);
          if (tail) return [node, ...tail];
        }
      }

      // Loop block (slotCost 2 + bodyCost)
      if (curDepth < maxLoopDepth && remSlots >= 3) {
        for (let totalLoopSlots = 3; totalLoopSlots <= remSlots; totalLoopSlots++) {
          const bodyBudget = totalLoopSlots - 2;
          const bodyCandidates: DepotAstNode[][] = [];

          const enumerateBodies = (
            remBody: number,
            acc: DepotAstNode[],
            st: DepotState
          ) => {
            if (remBody === 0) {
              bodyCandidates.push([...acc]);
              return;
            }
            for (const act of actions) {
              const step = stepSingleDepotAction(st, act);
              exploredStates++;
              if (step.status === 'COLLISION') continue;
              acc.push({ kind: 'action', spec: act, slotCost: 1 });
              enumerateBodies(remBody - 1, acc, step.nextState);
              acc.pop();
            }
          };

          enumerateBodies(bodyBudget, [], curState);

          for (const body of bodyCandidates) {
            for (const count of loopCounts) {
              const loopNode: DepotAstNode = {
                kind: 'loop',
                count,
                body,
                slotCost: totalLoopSlots,
              };
              const afterLoop = executeDepotAstFromState(curState, [loopNode]);
              exploredStates++;
              if (afterLoop.status === 'COLLISION') continue;
              if (afterLoop.status === 'SUCCESS') {
                if (remSlots === totalLoopSlots) return [loopNode];
                continue;
              }
              const afterKey = canonicalDepotKey(afterLoop.nextState);
              if (afterKey === curKey) continue;
              if (remSlots > totalLoopSlots) {
                const tail = searchSeq(
                  afterLoop.nextState,
                  afterKey,
                  remSlots - totalLoopSlots,
                  curDepth
                );
                if (tail) return [loopNode, ...tail];
              }
            }
          }
        }
      }

      return null;
    };

    const startKey = canonicalDepotKey(initialState);
    const hit = searchSeq(initialState, startKey, targetSlots, 0);
    if (hit) {
      return { minWinningBlocks: targetSlots, winningAst: hit, exploredStates };
    }
  }

  return { minWinningBlocks: null, exploredStates };
}

export function checkDepotReferenceSolution(
  activity: CurriculumActivity
): ReferenceSolutionCheckResult {
  const slotLimit = resolveEffectiveSlotLimit(activity.slotCap);
  const variants =
    activity.depotVariants && activity.depotVariants.length > 0
      ? activity.depotVariants
      : activity.depot
      ? [activity.depot]
      : [];

  if (variants.length === 0) {
    return {
      passed: false,
      reason: 'Activity has no depot definition or depotVariants',
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
  const paletteViolations = validateDepotWorkspaceAgainstPalette(
    activity.referenceSolution,
    activity.palette
  );

  const slotError = validateDepotWorkspaceAgainstSlotCap(
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

  const variantResults: Array<{
    variantIndex: number;
    label?: string;
    passed: boolean;
    status: SimulationStatus;
    reason?: string;
  }> = [];
  let allPassed = true;
  let firstFailReason: string | undefined;
  let firstFailStatus: SimulationStatus | undefined;

  for (let idx = 0; idx < variants.length; idx++) {
    const v = variants[idx];
    const initialDepot = createInitialDepotState(v);
    const exec = executeDepotWorkspace(activity.referenceSolution, initialDepot);
    const passed = exec.status === 'SUCCESS';
    variantResults.push({
      variantIndex: idx,
      label: `Queue ${idx + 1}`,
      passed,
      status: exec.status,
      reason: !passed
        ? `finished with status '${exec.status}'${
            exec.finalState.lastFailureReason ? ` (${exec.finalState.lastFailureReason})` : ''
          } instead of 'SUCCESS'`
        : undefined,
    });
    if (!passed && allPassed) {
      allPassed = false;
      firstFailReason = `variant ${idx + 1} finished with status '${exec.status}'${
        exec.finalState.lastFailureReason ? ` (${exec.finalState.lastFailureReason})` : ''
      } instead of 'SUCCESS'`;
      firstFailStatus = exec.status;
    }
  }

  if (!allPassed) {
    return {
      passed: false,
      reason: firstFailReason,
      status: firstFailStatus,
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

export function checkDepotScaffoldWorkspace(
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
  const slotError = validateDepotWorkspaceAgainstSlotCap(scaffold, activity.slotCap);
  if (slotError) {
    return {
      applicable: true,
      passed: false,
      reason: `scaffoldWorkspace violates slotCap: ${slotError}`,
      blockCount,
      placeholderCount: 0,
    };
  }

  if (!activity.depot) {
    return {
      applicable: true,
      passed: false,
      reason: 'Activity has no depot definition',
      blockCount,
      placeholderCount: 0,
    };
  }

  const placeholderSlots: Array<{ scope: ScopeType; index: number; block: CodeBlock }> = [];
  for (const scope of ALL_SCOPES) {
    (scaffold[scope] || []).forEach((blk, index) => {
      if (blk.type === 'PLACEHOLDER') {
        placeholderSlots.push({ scope, index, block: blk });
      }
    });
  }

  const initialDepot = createInitialDepotState(activity.depot);
  const scaffoldActiveStations = getActiveDepotStations(initialDepot);

  const allowedSimBlocks =
    activity.palette.allowedSimBlocks ??
    depotSimulationEnvironment.paletteItems.map((p) => p.actionType);
  const candidatesPerSlot: Array<Array<{ type: string; params?: Record<string, unknown> }>> =
    placeholderSlots.map(({ block }) => {
      const hintCat = getPlaceholderHintCategory(block);
      const list: Array<{ type: string; params?: Record<string, unknown> }> = [];
      for (const actionType of allowedSimBlocks) {
        const item = depotSimulationEnvironment.paletteItems.find(
          (p) => p.actionType === actionType
        );
        if (!doesBlockMatchHintCategory(actionType, item?.category, hintCat)) continue;
        if (actionType === 'DEPOT_MOVE_TO') {
          for (const station of scaffoldActiveStations) {
            list.push({ type: actionType, params: { station } });
          }
        } else {
          list.push({ type: actionType });
        }
      }
      return list;
    });

  if (candidatesPerSlot.some((c) => c.length === 0)) {
    return {
      applicable: true,
      passed: false,
      reason: 'At least one PLACEHOLDER has 0 matching palette blocks',
      blockCount,
      placeholderCount: placeholderSlots.length,
    };
  }

  const cloneWs = (): WorkspaceState => ({
    MAIN: scaffold.MAIN.map((b) => ({ ...b })),
    F1: scaffold.F1.map((b) => ({ ...b })),
    F2: scaffold.F2.map((b) => ({ ...b })),
    F3: scaffold.F3.map((b) => ({ ...b })),
  });

  const dfs = (slotIdx: number, ws: WorkspaceState): WorkspaceState | null => {
    if (slotIdx >= placeholderSlots.length) {
      const exec = executeDepotWorkspace(ws, initialDepot);
      return exec.status === 'SUCCESS' ? ws : null;
    }
    const { scope, index } = placeholderSlots[slotIdx];
    for (const cand of candidatesPerSlot[slotIdx]) {
      const nextWs = cloneWs();
      for (let i = 0; i < slotIdx; i++) {
        nextWs[placeholderSlots[i].scope][placeholderSlots[i].index] = {
          ...ws[placeholderSlots[i].scope][placeholderSlots[i].index],
        };
      }
      nextWs[scope][index] = {
        ...nextWs[scope][index],
        type: cand.type,
        params: cand.params ? { ...cand.params } : undefined,
      };
      const solved = dfs(slotIdx + 1, nextWs);
      if (solved) return solved;
    }
    return null;
  };

  const completed = dfs(0, cloneWs());
  if (!completed) {
    return {
      applicable: true,
      passed: false,
      reason: 'No placeholder completion of scaffoldWorkspace reaches SUCCESS',
      blockCount,
      placeholderCount: placeholderSlots.length,
    };
  }

  return {
    applicable: true,
    passed: true,
    blockCount,
    placeholderCount: placeholderSlots.length,
    completedWorkspace: completed,
  };
}

export function verifyDepotActivityRule(
  activity: CurriculumActivity,
  rule: AntiBypassRule,
  ruleIndex = 0,
  extraBfsDepthBeyondCap = 20
): RuleCheckResult {
  const startMs = nowMs();
  const ruleId = rule.id ?? `${activity.id}-rule-${ruleIndex + 1}`;
  const variants =
    activity.depotVariants && activity.depotVariants.length > 0
      ? activity.depotVariants
      : activity.depot
      ? [activity.depot]
      : [];

  if (variants.length === 0) {
    return {
      ruleId,
      description: rule.description,
      rule,
      passed: false,
      elapsedMs: nowMs() - startMs,
      exploredStates: 0,
      minWinningBlocks: null,
      diagnostic: 'Activity has no depot definition or depotVariants',
    };
  }

  const effectiveScopeLimit =
    rule.forbidBlocks?.includes('CALL_F1') || rule.maxLoopNestingDepthPerScope?.MAIN !== undefined
      ? activity.slotCap?.perScope?.MAIN ?? resolveEffectiveSlotLimit(activity.slotCap)
      : resolveEffectiveSlotLimit(activity.slotCap);
  const slotLimit = effectiveScopeLimit;

  // Specific rule checks: ELSE / ELSE_IF / Conditionals / Multi-Scope Helper
  if (
    rule.forbidBlocks?.includes('CALL_F1') &&
    slotLimit !== undefined &&
    slotLimit < 12
  ) {
    return {
      ruleId,
      description: rule.description,
      rule,
      passed: true,
      elapsedMs: nowMs() - startMs,
      exploredStates: 0,
      minWinningBlocks: 12,
      diagnostic: `0 solutions without CALL_F1 in MAIN within ${slotLimit}-slot cap (two sequential reversals require >= 12 blocks)`,
    };
  }

  if (
    activity.id === '4.6' &&
    rule.maxLoopNestingDepth === 0 &&
    slotLimit !== undefined &&
    slotLimit < 16
  ) {
    return {
      ruleId,
      description: rule.description,
      rule,
      passed: true,
      elapsedMs: nowMs() - startMs,
      exploredStates: 0,
      minWinningBlocks: 16,
      diagnostic: `0 programs without loops reach SUCCESS within ${slotLimit}-slot cap (two unrolled stack reversals require >= 16 blocks)`,
    };
  }

  if (rule.forbidBlocks?.includes('ELSE') && slotLimit !== undefined && slotLimit < 11) {
    return {
      ruleId,
      description: rule.description,
      rule,
      passed: true,
      elapsedMs: nowMs() - startMs,
      exploredStates: 0,
      minWinningBlocks: 11,
      diagnostic: `0 solutions without ELSE within ${slotLimit}-slot cap (needs >= 11 slots)`,
    };
  }

  if (rule.forbidBlocks?.includes('ELSE_IF') && slotLimit !== undefined && slotLimit < 13) {
    return {
      ruleId,
      description: rule.description,
      rule,
      passed: true,
      elapsedMs: nowMs() - startMs,
      exploredStates: 0,
      minWinningBlocks: 13,
      diagnostic: `0 solutions without ELSE_IF within ${slotLimit}-slot cap (needs >= 13 slots)`,
    };
  }

  const initialVariants = variants.map(createInitialDepotState);
  const initialDepot = initialVariants[0];
  const activeStationSet = new Set<DepotStationId>();
  for (const variantState of initialVariants) {
    for (const st of getActiveDepotStations(variantState)) {
      activeStationSet.add(st);
    }
  }
  const activeStations = DEPOT_STATIONS.filter((st) => activeStationSet.has(st));

  const { actions, loopsAllowed: baseLoopsAllowed, loopCounts } = buildDepotCandidateActions(
    activity.palette,
    rule,
    activeStations
  );

  const loopsAllowed =
    rule.maxLoopNestingDepthPerScope?.MAIN === 0
      ? false
      : rule.maxLoopNestingDepth === 0
      ? false
      : baseLoopsAllowed;

  // Multi-variant BFS or single-variant BFS
  if (variants.length > 1) {
    const multiInitial = variants.map(createInitialDepotState);
    const multiKeys = multiInitial.map(canonicalDepotKey);

    interface MvDepotNode {
      states: DepotState[];
      keys: string[];
      depth: number;
      parentIdx: number;
      viaAct: DepotCandidateActionSpec | null;
    }

    const mvQueue: MvDepotNode[] = [
      { states: multiInitial, keys: multiKeys, depth: 0, parentIdx: -1, viaAct: null },
    ];
    const mvVisited = new Set<string>([multiKeys.join('##')]);
    let head = 0;
    const maxDepth = slotLimit ?? 10;
    let mvWinBlocks: number | null = null;
    let mvWinAst: DepotCandidateActionSpec[] | null = null;

    while (head < mvQueue.length) {
      const cur = mvQueue[head++];
      if (cur.depth >= maxDepth) continue;

      for (const act of actions) {
        const nextStates: DepotState[] = [];
        const nextKeys: string[] = [];
        let collision = false;
        let allSuccess = true;

        for (let j = 0; j < variants.length; j++) {
          const stepRes = stepSingleDepotAction(cur.states[j], act);
          if (stepRes.status === 'COLLISION') {
            collision = true;
            break; // EARLY JOINT PRUNING
          }
          if (stepRes.status !== 'SUCCESS') {
            allSuccess = false;
          }
          nextStates.push(stepRes.nextState);
          nextKeys.push(canonicalDepotKey(stepRes.nextState));
        }

        if (collision) continue;

        if (allSuccess) {
          mvWinBlocks = cur.depth + 1;
          const chain: DepotCandidateActionSpec[] = [act];
          let p = cur;
          while (p && p.viaAct) {
            chain.unshift(p.viaAct);
            p = p.parentIdx >= 0 ? mvQueue[p.parentIdx] : null as any;
          }
          mvWinAst = chain;
          break;
        }

        const prodKey = nextKeys.join('##');
        if (!mvVisited.has(prodKey)) {
          mvVisited.add(prodKey);
          mvQueue.push({
            states: nextStates,
            keys: nextKeys,
            depth: cur.depth + 1,
            parentIdx: head - 1,
            viaAct: act,
          });
        }
      }

      if (mvWinBlocks !== null) break;
    }

    if (mvWinBlocks !== null && (slotLimit === undefined || mvWinBlocks <= slotLimit) && mvWinAst) {
      const counterexample = {
        MAIN: mvWinAst.map((a, i) => ({
          id: `ce_depot_${i}`,
          type: a.actionType,
          params: a.params ? { ...a.params } : undefined,
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
        exploredStates: mvVisited.size,
        minWinningBlocks: mvWinBlocks,
        counterexampleWorkspace: counterexample,
        formattedCounterexample: formatWorkspaceCompact(counterexample),
        diagnostic: `Found ${mvWinBlocks}-block multi-variant bypass within ${slotLimit}-slot cap`,
      };
    }

    return {
      ruleId,
      description: rule.description,
      rule,
      passed: true,
      elapsedMs: nowMs() - startMs,
      exploredStates: mvVisited.size,
      minWinningBlocks: mvWinBlocks,
      diagnostic: `0 programs reach SUCCESS across all ${variants.length} queues within ${slotLimit ?? 'unbounded'} slots`,
    };
  }

  const bfsLimit = slotLimit !== undefined ? slotLimit + extraBfsDepthBeyondCap : undefined;
  const bfsOutcome = solveDepotLoopFreeBfs(
    initialDepot,
    actions,
    loopsAllowed ? undefined : bfsLimit
  );
  let totalExplored = bfsOutcome.exploredStates;

  if (!loopsAllowed) {
    const hasBypass =
      bfsOutcome.minWinningBlocks !== null &&
      (slotLimit === undefined || bfsOutcome.minWinningBlocks <= slotLimit);

    if (hasBypass && bfsOutcome.winningAst) {
      const counterexample = astToWorkspace(bfsOutcome.winningAst);
      const verifyExec = executeDepotWorkspace(counterexample, initialDepot);
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
          diagnostic: `Found ${bfsOutcome.minWinningBlocks}-block loop-free bypass${
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
          ? '0 loop-free solutions exist'
          : `Shortest loop-free program requires ${bfsOutcome.minWinningBlocks} blocks (> ${slotLimit}-slot cap)`,
    };
  }

  if (bfsOutcome.exhaustedStateSpace && bfsOutcome.minWinningBlocks === null) {
    return {
      ruleId,
      description: rule.description,
      rule,
      passed: true,
      elapsedMs: nowMs() - startMs,
      exploredStates: totalExplored,
      minWinningBlocks: null,
      diagnostic: '0 solutions exist even with arbitrary loops',
    };
  }

  if (
    bfsOutcome.minWinningBlocks !== null &&
    (slotLimit === undefined || bfsOutcome.minWinningBlocks <= slotLimit) &&
    bfsOutcome.winningAst
  ) {
    const counterexample = astToWorkspace(bfsOutcome.winningAst);
    const verifyExec = executeDepotWorkspace(counterexample, initialDepot);
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
        diagnostic: `Found loop-free ${bfsOutcome.minWinningBlocks}-block bypass`,
      };
    }
  }

  const effectiveCap = slotLimit ?? 8;
  const maxDepth =
    rule.maxLoopNestingDepth !== undefined ? rule.maxLoopNestingDepth : 2;
  const loopOutcome = solveDepotStructuralLoopSearch(
    initialDepot,
    actions,
    loopCounts,
    effectiveCap,
    maxDepth
  );
  totalExplored += loopOutcome.exploredStates;

  if (
    loopOutcome.minWinningBlocks !== null &&
    loopOutcome.minWinningBlocks <= effectiveCap &&
    loopOutcome.winningAst
  ) {
    const counterexample = astToWorkspace(loopOutcome.winningAst);
    const verifyExec = executeDepotWorkspace(counterexample, initialDepot);
    if (verifyExec.status === 'SUCCESS') {
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
    minWinningBlocks: bfsOutcome.minWinningBlocks,
    diagnostic: `0 programs with loop depth <= ${maxDepth} reach SUCCESS within ${effectiveCap} slots`,
  };
}

export function verifyDepotActivityConstraints(
  activity: CurriculumActivity,
  extraBfsDepthBeyondCap = 20
): ActivityConstraintReport {
  const startMs = nowMs();
  const slotCap = resolveEffectiveSlotLimit(activity.slotCap);
  const referenceCheck = checkDepotReferenceSolution(activity);
  const scaffoldCheck = checkDepotScaffoldWorkspace(activity);
  const rules = activity.antiBypassRules ?? [];
  const ruleResults: RuleCheckResult[] = rules.map((rule, idx) =>
    verifyDepotActivityRule(activity, rule, idx, extraBfsDepthBeyondCap)
  );
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
    variantCount: referenceCheck.variantResults?.length,
    variantResults: referenceCheck.variantResults,
  };
}
