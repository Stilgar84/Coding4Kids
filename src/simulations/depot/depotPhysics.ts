import { SimulationStatus } from '../../types';
import {
  CrateColor,
  DEPOT_MAX_STACK_HEIGHT,
  DEPOT_STATIONS,
  DepotFailureReason,
  DepotStacks,
  DepotState,
  DepotStationId,
} from './types';

export function cloneStacks(stacks?: DepotStacks): DepotStacks {
  return [
    [...(stacks?.[0] ?? [])],
    [...(stacks?.[1] ?? [])],
    [...(stacks?.[2] ?? [])],
  ];
}

export function normalizeDepotStation(raw: unknown): DepotStationId {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const n = Math.round(raw);
    if (n === 2) return 'STACK_2';
    if (n === 3) return 'STACK_3';
    return 'STACK_1';
  }
  const str = String(raw ?? 'STACK_1').trim().toUpperCase();
  if (str === 'STACK_2' || str === '2') return 'STACK_2';
  if (str === 'STACK_3' || str === '3') return 'STACK_3';
  return 'STACK_1';
}

export function stationToIndex(station: DepotStationId | unknown): 0 | 1 | 2 {
  const norm = normalizeDepotStation(station);
  if (norm === 'STACK_2') return 1;
  if (norm === 'STACK_3') return 2;
  return 0;
}

export function indexToStation(idx: number): DepotStationId {
  if (idx === 1) return 'STACK_2';
  if (idx === 2) return 'STACK_3';
  return 'STACK_1';
}

export const DEFAULT_SANDBOX_DEPOT_STACKS: DepotStacks = [
  ['RED', 'BLUE'],
  ['GREEN'],
  [],
];

export function createInitialDepotState(
  overrides?: Partial<
    Pick<
      DepotState,
      'stacks' | 'initialStacks' | 'targetStacks' | 'targetOutput' | 'workerStation' | 'initialWorkerStation'
    >
  >
): DepotState {
  const startStacks = cloneStacks(
    overrides?.initialStacks ?? overrides?.stacks ?? DEFAULT_SANDBOX_DEPOT_STACKS
  );
  const startStation = normalizeDepotStation(
    overrides?.initialWorkerStation ?? overrides?.workerStation ?? 'STACK_1'
  );

  return {
    stacks: cloneStacks(overrides?.stacks ?? startStacks),
    initialStacks: startStacks,
    output: [],
    targetStacks: overrides?.targetStacks ? cloneStacks(overrides.targetStacks) : undefined,
    targetOutput: overrides?.targetOutput ? [...overrides.targetOutput] : undefined,
    workerStation: startStation,
    initialWorkerStation: startStation,
    heldCrate: null,
    lastFailureReason: null,
    status: 'IDLE',
    stepCount: 0,
  };
}

export function resetDepotState(state?: DepotState): DepotState {
  if (!state) return createInitialDepotState();
  const baseStacks = cloneStacks(state.initialStacks ?? DEFAULT_SANDBOX_DEPOT_STACKS);
  const baseStation = normalizeDepotStation(state.initialWorkerStation ?? 'STACK_1');
  return {
    stacks: cloneStacks(baseStacks),
    initialStacks: baseStacks,
    output: [],
    targetStacks: state.targetStacks ? cloneStacks(state.targetStacks) : undefined,
    targetOutput: state.targetOutput ? [...state.targetOutput] : undefined,
    workerStation: baseStation,
    initialWorkerStation: baseStation,
    heldCrate: null,
    lastFailureReason: null,
    status: 'IDLE',
    stepCount: 0,
  };
}

function stacksEqual(a: DepotStacks, b: DepotStacks): boolean {
  for (let i = 0; i < 3; i++) {
    if (a[i].length !== b[i].length) return false;
    for (let j = 0; j < a[i].length; j++) {
      if (a[i][j] !== b[i][j]) return false;
    }
  }
  return true;
}

function arraysEqual(a: readonly CrateColor[], b: readonly CrateColor[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function evaluateDepotCompletion(state: DepotState): SimulationStatus {
  if (state.status === 'COLLISION') return 'COLLISION';

  const hasStackGoal = state.targetStacks !== undefined;
  const hasOutputGoal = state.targetOutput !== undefined && state.targetOutput.length > 0;
  if (!hasStackGoal && !hasOutputGoal) {
    return 'IDLE';
  }

  const stacksOk = !hasStackGoal || stacksEqual(state.stacks, state.targetStacks!);
  const outputOk = !hasOutputGoal || arraysEqual(state.output, state.targetOutput!);
  // Must also not still be holding an unplaced required crate if goal matches
  return stacksOk && outputOk && state.heldCrate === null ? 'SUCCESS' : 'IDLE';
}

export interface DepotStepOutcome {
  nextState: DepotState;
  isCollision: boolean;
  isSuccess: boolean;
}

function failStep(
  state: DepotState,
  reason: DepotFailureReason
): DepotStepOutcome {
  return {
    nextState: {
      ...state,
      lastFailureReason: reason,
      status: 'COLLISION',
      stepCount: (state.stepCount || 0) + 1,
    },
    isCollision: true,
    isSuccess: false,
  };
}

export function applyDepotAction(
  actionType: string,
  state: DepotState,
  params?: Record<string, any>
): DepotStepOutcome {
  if (state.status === 'COLLISION') {
    return {
      nextState: state,
      isCollision: true,
      isSuccess: false,
    };
  }

  const nextStepCount = (state.stepCount || 0) + 1;

  switch (actionType) {
    case 'DEPOT_MOVE_TO': {
      const targetStation = normalizeDepotStation(
        params?.station ?? DEPOT_STATIONS[0]
      );
      const candidate: DepotState = {
        ...state,
        workerStation: targetStation,
        lastFailureReason: null,
        stepCount: nextStepCount,
        status: 'RUNNING',
      };
      const evalStatus = evaluateDepotCompletion(candidate);
      const isSuccess = evalStatus === 'SUCCESS';
      return {
        nextState: {
          ...candidate,
          status: isSuccess ? 'SUCCESS' : 'RUNNING',
        },
        isCollision: false,
        isSuccess,
      };
    }

    case 'DEPOT_GRAB': {
      if (state.heldCrate !== null) {
        return failStep(state, 'CLAW_FULL');
      }
      const stackIdx = stationToIndex(state.workerStation);
      const stack = state.stacks[stackIdx];
      if (stack.length === 0) {
        return failStep(state, 'EMPTY_STACK');
      }
      const nextStacks = cloneStacks(state.stacks);
      const grabbed = nextStacks[stackIdx].pop()!;
      const candidate: DepotState = {
        ...state,
        stacks: nextStacks,
        heldCrate: grabbed,
        lastFailureReason: null,
        stepCount: nextStepCount,
        status: 'RUNNING',
      };
      return {
        nextState: candidate,
        isCollision: false,
        isSuccess: false,
      };
    }

    case 'DEPOT_PLACE': {
      if (state.heldCrate === null) {
        return failStep(state, 'CLAW_EMPTY');
      }
      const stackIdx = stationToIndex(state.workerStation);
      if (state.stacks[stackIdx].length >= DEPOT_MAX_STACK_HEIGHT) {
        return failStep(state, 'STACK_FULL');
      }
      const nextStacks = cloneStacks(state.stacks);
      nextStacks[stackIdx].push(state.heldCrate);
      const candidate: DepotState = {
        ...state,
        stacks: nextStacks,
        heldCrate: null,
        lastFailureReason: null,
        stepCount: nextStepCount,
        status: 'RUNNING',
      };
      const evalStatus = evaluateDepotCompletion(candidate);
      const isSuccess = evalStatus === 'SUCCESS';
      return {
        nextState: {
          ...candidate,
          status: isSuccess ? 'SUCCESS' : 'RUNNING',
        },
        isCollision: false,
        isSuccess,
      };
    }

    case 'DEPOT_SEND_OUT': {
      if (state.heldCrate === null) {
        return failStep(state, 'CLAW_EMPTY');
      }
      const nextOutput = [...state.output, state.heldCrate];
      if (state.targetOutput && state.targetOutput.length > 0) {
        const idx = nextOutput.length - 1;
        if (idx >= state.targetOutput.length || nextOutput[idx] !== state.targetOutput[idx]) {
          return failStep(
            {
              ...state,
              output: nextOutput,
              heldCrate: null,
            },
            'WRONG_OUTPUT_ORDER'
          );
        }
      }
      const candidate: DepotState = {
        ...state,
        output: nextOutput,
        heldCrate: null,
        lastFailureReason: null,
        stepCount: nextStepCount,
        status: 'RUNNING',
      };
      const evalStatus = evaluateDepotCompletion(candidate);
      const isSuccess = evalStatus === 'SUCCESS';
      return {
        nextState: {
          ...candidate,
          status: isSuccess ? 'SUCCESS' : 'RUNNING',
        },
        isCollision: false,
        isSuccess,
      };
    }

    default: {
      return {
        nextState: {
          ...state,
          stepCount: nextStepCount,
          status: 'RUNNING',
        },
        isCollision: false,
        isSuccess: false,
      };
    }
  }
}
