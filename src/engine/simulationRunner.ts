import {
  WorkspaceState,
  InterpreterRuntimeState,
  SimulationStatus,
  ScopeType,
} from '../types';
import { SimulationEnvironment } from './simulation/types';
import {
  createInitialInterpreterState,
  InterpreterTickOptions,
  tickInterpreter,
  validateLoopStructure,
} from './interpreter';
import { registerSimulation, getSimEnvironment } from './simulation/registry';
import { gridSimulationEnvironment } from '../simulations/grid/gridEnvironment';
import { turtleSimulationEnvironment } from '../simulations/turtle/turtleEnvironment';
import { beatSimulationEnvironment } from '../simulations/beat/beatEnvironment';
import { depotSimulationEnvironment } from '../simulations/depot/depotEnvironment';
import { switchyardSimulationEnvironment } from '../simulations/switchyard/switchyardEnvironment';

// Ensure environments are registered for headless simulation (idempotent; safe against ESM circular import TDZ)
export function ensureSimEnvironmentsRegistered(): void {
  if (!getSimEnvironment('grid') && typeof gridSimulationEnvironment !== 'undefined') {
    registerSimulation(gridSimulationEnvironment);
  }
  if (!getSimEnvironment('turtle') && typeof turtleSimulationEnvironment !== 'undefined') {
    registerSimulation(turtleSimulationEnvironment);
  }
  if (!getSimEnvironment('beat') && typeof beatSimulationEnvironment !== 'undefined') {
    registerSimulation(beatSimulationEnvironment);
  }
  if (!getSimEnvironment('depot') && typeof depotSimulationEnvironment !== 'undefined') {
    registerSimulation(depotSimulationEnvironment);
  }
  if (!getSimEnvironment('switchyard') && typeof switchyardSimulationEnvironment !== 'undefined') {
    registerSimulation(switchyardSimulationEnvironment);
  }
}

ensureSimEnvironmentsRegistered();

export const MAX_SAVE_SIMULATION_STEPS = 1000;
export const MAX_INSTANT_SIMULATION_STEPS = 1000;

export interface SimulationRunResult<TState = any> {
  finalState: TState;
  status: SimulationStatus;
  stepCount: number;
  finalRuntime: InterpreterRuntimeState;
}

export interface HeadlessSimulationOptions extends InterpreterTickOptions {
  /** Fallback `$input` value when `sceneInput` is omitted (e.g. `activity.inputConfig.previewInput`). */
  previewInput?: number | string;
}

/**
 * Runs a simulation headless from initial state to completion or up to maxSteps (default 200).
 * Does not mutate active reactive stores.
 */
export function runHeadlessSimulation<TState = any>(
  workspace: WorkspaceState,
  simId: 'grid' | 'turtle' | 'beat' | 'depot' | 'switchyard',
  simState: TState,
  maxSteps: number = MAX_SAVE_SIMULATION_STEPS,
  options?: HeadlessSimulationOptions
): SimulationRunResult<TState> {
  ensureSimEnvironmentsRegistered();
  const resolvedSceneInput =
    options?.sceneInput !== undefined ? options.sceneInput : options?.previewInput;
  const simEnv = getSimEnvironment(simId) as SimulationEnvironment<TState> | undefined;
  const initialRuntime: InterpreterRuntimeState = {
    ...createInitialInterpreterState(),
    ...(resolvedSceneInput !== undefined ? { sceneInput: resolvedSceneInput } : {}),
  };

  if (!simEnv) {
    const finalState =
      simState && typeof simState === 'object' ? { ...simState, status: 'IDLE' } : simState;
    return {
      finalState,
      status: 'IDLE',
      stepCount: 0,
      finalRuntime: { ...initialRuntime, status: 'IDLE' },
    };
  }

  // Guard: validate loop structure in all non-empty workspace scopes
  for (const sc of ['MAIN', 'F1', 'F2', 'F3'] as ScopeType[]) {
    if (workspace[sc]?.length > 0) {
      const val = validateLoopStructure(workspace[sc]);
      if (val.hasError) {
        const finalState =
          simState && typeof simState === 'object' ? { ...simState, status: 'IDLE' } : simState;
        return {
          finalState,
          status: 'IDLE',
          stepCount: 0,
          finalRuntime: { ...initialRuntime, status: 'IDLE' },
        };
      }
    }
  }

  // Guard: empty workspace
  const totalBlocks = (['MAIN', 'F1', 'F2', 'F3'] as ScopeType[]).reduce(
    (acc, sc) => acc + (workspace[sc]?.length || 0),
    0
  );
  if (totalBlocks === 0) {
    const finalState =
      simState && typeof simState === 'object' ? { ...simState, status: 'IDLE' } : simState;
    return {
      finalState,
      status: 'IDLE',
      stepCount: 0,
      finalRuntime: { ...initialRuntime, status: 'IDLE' },
    };
  }

  let runtime = initialRuntime;
  let state = simState;
  let steps = 0;
  const tickOptions: InterpreterTickOptions | undefined =
    options || resolvedSceneInput !== undefined
      ? {
          ...options,
          ...(resolvedSceneInput !== undefined ? { sceneInput: resolvedSceneInput } : {}),
        }
      : undefined;

  while (steps < maxSteps) {
    const res = tickInterpreter(runtime, workspace, state, simEnv, tickOptions);
    runtime = res.nextRuntime;
    state = res.nextGrid;
    steps++;
    if (res.done) {
      break;
    }
  }

  const rawStatus = (state as any)?.status || runtime.status;
  const status: SimulationStatus =
    rawStatus === 'SUCCESS' ||
    rawStatus === 'COLLISION' ||
    rawStatus === 'STEP_LIMIT' ||
    rawStatus === 'PAUSED'
      ? rawStatus
      : 'IDLE';

  const finalState =
    state && typeof state === 'object' ? { ...state, status } : state;
  const finalRuntime: InterpreterRuntimeState = { ...runtime, status };

  return {
    finalState,
    status,
    stepCount: steps,
    finalRuntime,
  };
}

export const runSimulationForSave = runHeadlessSimulation;
