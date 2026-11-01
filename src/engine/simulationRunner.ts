import {
  WorkspaceState,
  InterpreterRuntimeState,
  SimulationStatus,
  ScopeType,
} from '../types';
import { SimulationEnvironment } from './simulation/types';
import {
  createInitialInterpreterState,
  tickInterpreter,
  validateLoopStructure,
} from './interpreter';
import { registerSimulation, getSimEnvironment } from './simulation/registry';
import { gridSimulationEnvironment } from '../simulations/grid/gridEnvironment';
import { turtleSimulationEnvironment } from '../simulations/turtle/turtleEnvironment';

// Ensure environments are registered for headless simulation
registerSimulation(gridSimulationEnvironment);
registerSimulation(turtleSimulationEnvironment);

export const MAX_SAVE_SIMULATION_STEPS = 200;

export interface SimulationRunResult<TState = any> {
  finalState: TState;
  status: SimulationStatus;
  stepCount: number;
  finalRuntime: InterpreterRuntimeState;
}

/**
 * Runs a simulation headless from initial state to completion or up to MAX_SAVE_SIMULATION_STEPS (200).
 * Does not mutate active reactive stores.
 */
export function runHeadlessSimulation<TState = any>(
  workspace: WorkspaceState,
  simId: 'grid' | 'turtle',
  simState: TState,
  maxSteps: number = MAX_SAVE_SIMULATION_STEPS
): SimulationRunResult<TState> {
  const simEnv = getSimEnvironment(simId) as SimulationEnvironment<TState> | undefined;
  const initialRuntime = createInitialInterpreterState();

  if (!simEnv) {
    return {
      finalState: simState,
      status: 'IDLE',
      stepCount: 0,
      finalRuntime: initialRuntime,
    };
  }

  // Guard: validate loop structure in all non-empty workspace scopes
  for (const sc of ['MAIN', 'F1', 'F2', 'F3'] as ScopeType[]) {
    if (workspace[sc]?.length > 0) {
      const val = validateLoopStructure(workspace[sc]);
      if (val.hasError) {
        return {
          finalState: simState,
          status: 'IDLE',
          stepCount: 0,
          finalRuntime: initialRuntime,
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
    return {
      finalState: simState,
      status: 'IDLE',
      stepCount: 0,
      finalRuntime: initialRuntime,
    };
  }

  let runtime = initialRuntime;
  let state = simState;
  let steps = 0;

  while (steps < maxSteps) {
    const res = tickInterpreter(runtime, workspace, state, simEnv);
    runtime = res.nextRuntime;
    state = res.nextGrid;
    steps++;
    if (res.done) {
      break;
    }
  }

  const rawStatus = (state as any)?.status || runtime.status;
  const status: SimulationStatus =
    rawStatus === 'SUCCESS' || rawStatus === 'COLLISION' ? rawStatus : 'IDLE';

  return {
    finalState: state,
    status,
    stepCount: steps,
    finalRuntime: runtime,
  };
}

export const runSimulationForSave = runHeadlessSimulation;
