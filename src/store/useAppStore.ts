import { useRef, useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { shallow } from 'zustand/shallow';
import { registerSimulation } from '../engine/simulation/registry';
import { gridSimulationEnvironment } from '../simulations/grid/gridEnvironment';
import { turtleSimulationEnvironment } from '../simulations/turtle/turtleEnvironment';
import { beatSimulationEnvironment } from '../simulations/beat/beatEnvironment';
import { depotSimulationEnvironment } from '../simulations/depot/depotEnvironment';
import { switchyardSimulationEnvironment } from '../simulations/switchyard/switchyardEnvironment';
import { beatSynth } from '../simulations/beat/beatSynth';
import { createStoreContext } from './createStoreContext';
import { computeInitialBootState } from './helpers/bootState';
import { isLowQualityActive } from './helpers/statusAndPerfHelpers';
import { createHistorySlice } from './slices/historySlice';
import { createProfileSlice } from './slices/profileSlice';
import { createCurriculumSlice } from './slices/curriculumSlice';
import { createUiChromeSlice } from './slices/uiChromeSlice';
import { createSerializationSlice } from './slices/serializationSlice';
import { createScaffoldsAndHintsSlice } from './slices/scaffoldsAndHintsSlice';
import { createWorkspaceSlice } from './slices/workspaceSlice';
import { createGridEditorSlice } from './slices/gridEditorSlice';
import { createSimControlsSlice } from './slices/simControlsSlice';
import { createExecutionSlice } from './slices/executionSlice';
import { createPwaAndPerfSlice } from './slices/pwaAndPerfSlice';
import type { AppState } from './types';

// Register environments (guarded against ESM circular-import evaluation order; runtime actions also ensure registration)
if (typeof gridSimulationEnvironment !== 'undefined') registerSimulation(gridSimulationEnvironment);
if (typeof turtleSimulationEnvironment !== 'undefined') registerSimulation(turtleSimulationEnvironment);
if (typeof beatSimulationEnvironment !== 'undefined') registerSimulation(beatSimulationEnvironment);
if (typeof depotSimulationEnvironment !== 'undefined') registerSimulation(depotSimulationEnvironment);
if (typeof switchyardSimulationEnvironment !== 'undefined') registerSimulation(switchyardSimulationEnvironment);

export type {
  AppState,
  EditorTool,
  HistorySnapshot,
  LevelPreset,
  PendingLessonVersionMismatch,
  SandboxModeSnapshot,
  SimId,
  VariantRunSnapshot,
} from './types';

export {
  isLowQualityActive,
  isTerminalErrorStatus,
  resolveTerminalStatus,
  TERMINAL_ERROR_STATUSES,
  type PerformanceMode,
} from './helpers/statusAndPerfHelpers';

export {
  ALL_CODE_SCOPES,
  cloneWorkspace,
  cloneWorkspaceWithFreshIds,
  createEmptyWorkspace,
  EVENT_SCOPE_KEYS,
  hasWorkspaceAnyBlocks,
  hasWorkspaceLoopError,
} from './helpers/workspaceHelpers';

export {
  computeInstantSimulation,
  createCurriculumTurtleState,
  DEFAULT_RANDOM_SEED,
  getInitialBeatState,
  getInitialDepotState,
  getInitialGridState,
  getInitialSwitchyardState,
  getInitialTurtleState,
  getSimStepIntervalMs,
  PRESET_LEVELS,
} from './helpers/simStateHelpers';

export const useAppStore = create<AppState>((set, get) => {
  const ctx = createStoreContext(set, get);
  return {
    ...computeInitialBootState(),
    ...createHistorySlice(set, get, ctx),
    ...createProfileSlice(set, get),
    ...createCurriculumSlice(set, get, ctx),
    ...createUiChromeSlice(set, get),
    ...createSerializationSlice(set, get, ctx),
    ...createScaffoldsAndHintsSlice(set, get, ctx),
    ...createWorkspaceSlice(set, get, ctx),
    ...createGridEditorSlice(set, get, ctx),
    ...createSimControlsSlice(set, get, ctx),
    ...createExecutionSlice(set, get, ctx),
    ...createPwaAndPerfSlice(set, get, ctx),
  };
});

/**
 * Zustand v5 SSR-safe selective subscription hook.
 * Uses `useSyncExternalStore` with live `useAppStore.getState()` as both client and server snapshot
 * and shallow equality caching so `renderToStaticMarkup` tests remain deterministic while client
 * components only re-render when their selected slice actually changes.
 */
export function useAppStoreSelector<T>(selector: (state: AppState) => T): T {
  const prevRef = useRef<{ hasValue: boolean; value: T }>({
    hasValue: false,
    value: undefined as T,
  });

  const getSnapshot = () => {
    const next = selector(useAppStore.getState());
    if (prevRef.current.hasValue && shallow(prevRef.current.value, next)) {
      return prevRef.current.value;
    }
    prevRef.current.hasValue = true;
    prevRef.current.value = next;
    return next;
  };

  return useSyncExternalStore(useAppStore.subscribe, getSnapshot, getSnapshot);
}

// Sync initial persisted quality mode with beatSynth & restore PWA update state if present
beatSynth.setLowQualityMode(isLowQualityActive(useAppStore.getState()));
useAppStore.getState().hydrateFromUpdateIfPresent();
