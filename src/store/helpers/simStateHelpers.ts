import type { GridState, WorkspaceState } from '../../types';
import { resetGridInteractiveState } from '../../engine/physics';
import type { TurtleState } from '../../simulations/turtle/types';
import {
  createInitialTurtleState,
  turtleSimulationEnvironment,
} from '../../simulations/turtle/turtleEnvironment';
import type { BeatState } from '../../simulations/beat/types';
import { resetBeatState } from '../../simulations/beat/beatEnvironment';
import type { DepotState } from '../../simulations/depot/types';
import { resetDepotState } from '../../simulations/depot/depotPhysics';
import type { SwitchyardState } from '../../simulations/switchyard/types';
import {
  createInitialSwitchyardState,
  resetSwitchyardState,
} from '../../simulations/switchyard/physics';
import { getSimEnvironment as rawGetSimEnvironment } from '../../engine/simulation/registry';
import type { InterpreterTickOptions } from '../../engine/interpreter';
import {
  ensureSimEnvironmentsRegistered,
  MAX_INSTANT_SIMULATION_STEPS,
  runHeadlessSimulation,
} from '../../engine/simulationRunner';
import { LESSONS } from '../../data/lessons';
import type { CurriculumTurtleDefinition } from '../../data/curriculum/types';
import type {
  AppStateData,
  LevelPreset,
  SandboxModeSnapshot,
  SimId,
} from '../types';
import { cloneWorkspace } from './workspaceHelpers';

export const DEFAULT_RANDOM_SEED = 12345;

export const getSimEnvironment = <TState = any>(id: string) => {
  const existing = rawGetSimEnvironment<TState>(id);
  if (existing) return existing;
  ensureSimEnvironmentsRegistered();
  return rawGetSimEnvironment<TState>(id);
};

export const getInitialGridState = (grid: GridState): GridState =>
  resetGridInteractiveState(grid);

export const getInitialTurtleState = (turtleState: TurtleState): TurtleState =>
  turtleSimulationEnvironment.resetState(turtleState);

export const getInitialBeatState = (beatState?: BeatState): BeatState =>
  resetBeatState(beatState);

export const getInitialDepotState = (depotState?: DepotState): DepotState =>
  resetDepotState(depotState);

export const getInitialSwitchyardState = (
  switchyardState?: SwitchyardState
): SwitchyardState =>
  resetSwitchyardState(switchyardState ?? createInitialSwitchyardState());

export const createCurriculumTurtleState = (
  turtleDef?: CurriculumTurtleDefinition
): TurtleState => {
  const base = createInitialTurtleState();
  if (!turtleDef) return base;
  return {
    ...base,
    ...(turtleDef.canvasBounds ? { canvasBounds: turtleDef.canvasBounds } : {}),
    ...(turtleDef.showCanvasBounds !== undefined
      ? { showCanvasBounds: turtleDef.showCanvasBounds }
      : {}),
  };
};

export const mergeLiveTurtleViewState = (
  targetState: TurtleState,
  liveState: TurtleState
): TurtleState => ({
  ...targetState,
  pan: { ...liveState.pan },
  zoom: liveState.zoom,
  fitToView: liveState.fitToView,
  showTurtle: liveState.showTurtle,
  activeAnimation: null,
});

/**
 * Returns the timer interval (ms) per step for step-interval playback simulations.
 * Scales Depot and Switchyard steps slower so kids can track crane/train movement clearly.
 */
export function getSimStepIntervalMs(
  activeSimId: string,
  speed: number | 'instant'
): number {
  if (speed === 'instant' || speed <= 0) return 0;
  if (activeSimId === 'switchyard') {
    if (speed <= 25) return 130;
    if (speed <= 100) return 325;
    return Math.round(speed * 1.875);
  }
  if (activeSimId === 'depot') {
    if (speed <= 25) return 260;
    if (speed <= 100) return 650;
    return Math.round(speed * 3.75);
  }
  return speed;
}

export function computeInstantSimulation(
  workspace: WorkspaceState,
  simId: SimId,
  grid: GridState,
  turtleState: TurtleState,
  beatState?: BeatState,
  depotState?: DepotState,
  switchyardState?: SwitchyardState,
  options?: InterpreterTickOptions
) {
  const initialState =
    simId === 'grid'
      ? getInitialGridState(grid)
      : simId === 'beat'
      ? getInitialBeatState(beatState)
      : simId === 'depot'
      ? getInitialDepotState(depotState)
      : simId === 'switchyard'
      ? getInitialSwitchyardState(switchyardState)
      : getInitialTurtleState(turtleState);
  return runHeadlessSimulation(
    workspace,
    simId,
    initialState,
    MAX_INSTANT_SIMULATION_STEPS,
    options
  );
}

export const PRESET_LEVELS: LevelPreset[] = LESSONS.map((lesson) => ({
  id: lesson.id,
  width: lesson.grid.width,
  height: lesson.grid.height,
  robot: lesson.grid.robot,
  barriers: lesson.grid.barriers,
  flags: lesson.grid.flags,
}));

export const initialPreset = PRESET_LEVELS[0];

export const createGridFromPreset = (
  preset: LevelPreset,
  prevFitToView: boolean = false
): GridState => ({
  width: preset.width,
  height: preset.height,
  robot: {
    ...preset.robot,
    initialX: preset.robot.x,
    initialY: preset.robot.y,
    initialDir: preset.robot.dir,
  },
  barriers: [...preset.barriers],
  flags: preset.flags.map((f) => ({ ...f, collected: false })),
  trace: [{ x: preset.robot.x, y: preset.robot.y }],
  status: 'IDLE',
  showTrace: true,
  fitToView: prevFitToView,
});

export const buildSandboxSnapshot = (
  state: Pick<
    AppStateData,
    | 'activeSimId'
    | 'currentLevel'
    | 'grid'
    | 'turtleState'
    | 'beatState'
    | 'depotState'
    | 'switchyardState'
    | 'workspace'
    | 'savedWorkspaces'
  >
): SandboxModeSnapshot => {
  const snapSaved: Record<string, WorkspaceState> = {};
  for (const [k, ws] of Object.entries(state.savedWorkspaces)) {
    snapSaved[k] = cloneWorkspace(ws);
  }
  snapSaved[state.activeSimId] = cloneWorkspace(state.workspace);
  return {
    activeSimId: state.activeSimId,
    currentLevel: state.currentLevel,
    grid: JSON.parse(JSON.stringify(getInitialGridState(state.grid))),
    turtleState: JSON.parse(JSON.stringify(getInitialTurtleState(state.turtleState))),
    beatState: JSON.parse(JSON.stringify(getInitialBeatState(state.beatState))),
    depotState: JSON.parse(JSON.stringify(getInitialDepotState(state.depotState))),
    switchyardState: JSON.parse(
      JSON.stringify(getInitialSwitchyardState(state.switchyardState))
    ),
    workspace: cloneWorkspace(state.workspace),
    savedWorkspaces: snapSaved,
  };
};

export const requestFrame = (
  cb: (time: number) => void,
  duration?: number,
  startTime?: number
): number => {
  if (typeof requestAnimationFrame !== 'undefined') {
    return requestAnimationFrame(cb);
  }
  const time = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const finishTime =
    startTime !== undefined && duration !== undefined
      ? startTime + duration + 1
      : time;
  cb(finishTime);
  return 0;
};

export const cancelFrame = (id: number): void => {
  if (typeof cancelAnimationFrame !== 'undefined') {
    cancelAnimationFrame(id);
  }
};
