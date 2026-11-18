import type {
  GridState,
  InterpreterRuntimeState,
  SimulationStatus,
  WorkspaceState,
} from '../../types';
import type { BeatState } from '../../simulations/beat/types';
import type { DepotState } from '../../simulations/depot/types';
import type { SwitchyardState } from '../../simulations/switchyard/types';
import type { TurtleState } from '../../simulations/turtle/types';

export type PerformanceMode = 'auto' | 'low' | 'high';

const PERF_MODE_STORAGE_KEY = 'robotemu_perf_mode';

export function loadPersistedPerformanceMode(): PerformanceMode {
  if (typeof window === 'undefined') return 'auto';
  try {
    const raw = window.localStorage?.getItem(PERF_MODE_STORAGE_KEY);
    if (raw === 'low' || raw === 'high' || raw === 'auto') {
      return raw;
    }
  } catch {
    // Ignore storage errors (private mode, etc.)
  }
  return 'auto';
}

export function savePersistedPerformanceMode(mode: PerformanceMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage?.setItem(PERF_MODE_STORAGE_KEY, mode);
  } catch {
    // Ignore storage errors
  }
}

export function isLowQualityActive(state: {
  performanceMode: PerformanceMode;
  isAutoLowQuality: boolean;
}): boolean {
  return (
    state.performanceMode === 'low' ||
    (state.performanceMode === 'auto' && state.isAutoLowQuality)
  );
}

export const TERMINAL_ERROR_STATUSES: ReadonlySet<SimulationStatus> = new Set([
  'COLLISION',
  'TYPE_ERROR',
  'MATH_ERROR',
  'STACK_OVERFLOW',
  'STEP_LIMIT',
  'DEADLOCK',
]);

export const isTerminalErrorStatus = (
  status?: SimulationStatus | string | null
): boolean => Boolean(status && TERMINAL_ERROR_STATUSES.has(status as SimulationStatus));

export const resolveTerminalStatus = (
  simStatus?: SimulationStatus | string | null,
  runtimeStatus?: SimulationStatus | string | null
): SimulationStatus => {
  if (simStatus === 'SUCCESS' || runtimeStatus === 'SUCCESS') return 'SUCCESS';
  if (isTerminalErrorStatus(simStatus)) return simStatus as SimulationStatus;
  if (isTerminalErrorStatus(runtimeStatus)) return runtimeStatus as SimulationStatus;
  return 'IDLE';
};

export function isCurrentSimSuccess(state: {
  activeSimId: 'grid' | 'turtle' | 'beat' | 'depot' | 'switchyard';
  grid: GridState;
  beatState: BeatState;
  depotState: DepotState;
  switchyardState: SwitchyardState;
  turtleState: TurtleState;
  runtime: InterpreterRuntimeState | null;
}): boolean {
  const simStatus =
    state.activeSimId === 'grid'
      ? state.grid.status
      : state.activeSimId === 'beat'
      ? state.beatState.status
      : state.activeSimId === 'depot'
      ? state.depotState.status
      : state.activeSimId === 'switchyard'
      ? state.switchyardState.status
      : state.turtleState.status;
  return simStatus === 'SUCCESS' || state.runtime?.status === 'SUCCESS';
}

export function getPlaceholderPauseAnnouncement(
  _ws?: WorkspaceState,
  _rt?: InterpreterRuntimeState
): string {
  return 'Paused on ? block.';
}
