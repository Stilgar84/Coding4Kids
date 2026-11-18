import type { SimulationSpeed } from '../../types';
import { createInitialBeatState } from '../../simulations/beat/beatEnvironment';
import { beatSynth } from '../../simulations/beat/beatSynth';
import { createInitialDepotState } from '../../simulations/depot/depotPhysics';
import { createInitialSwitchyardState } from '../../simulations/switchyard/physics';
import { getActivityAtVersion, getActivityLatest } from '../../data/curriculum';
import {
  consumeRestoredStateAfterUpdate,
  saveStateBeforeUpdate,
} from '../../services/pwaStateRestoreService';
import {
  ensureProfilesInitialized,
  getProfileProgress,
  setActiveProfileId,
} from '../../services/profileService';
import {
  type PerformanceMode,
  savePersistedPerformanceMode,
} from '../helpers/statusAndPerfHelpers';
import {
  createGridFromPreset,
  initialPreset,
  mergeLiveTurtleViewState,
} from '../helpers/simStateHelpers';
import {
  buildCompletedMap,
  recordDemoTabViewedMap,
} from '../helpers/curriculumHelpers';
import type {
  PwaAndPerfSliceActions,
  StoreContext,
  StoreGet,
  StoreSet,
} from '../types';

export function createPwaAndPerfSlice(
  set: StoreSet,
  get: StoreGet,
  ctx: StoreContext
): PwaAndPerfSliceActions {
  return {
    dismissRestoredNotice: () => set({ wasRestoredAfterUpdate: false }),

    prepareStateForUpdate: () => {
      // Stop timers / RAF and commit any in-flight turtle animation before snapshot
      get().pause();
      if (ctx.playback.pendingTurtleCommit) {
        const commit = ctx.playback.pendingTurtleCommit;
        ctx.playback.pendingTurtleCommit = null;
        const liveTurtle = get().turtleState;
        set({
          turtleState: mergeLiveTurtleViewState(
            commit.finalTurtleState,
            liveTurtle
          ),
          runtime: commit.finalRuntime,
        });
      }

      const s = get();
      return saveStateBeforeUpdate({
        activeProfileId: s.activeProfileId,
        appMode: s.appMode,
        activeActivityId: s.activeActivityId,
        activeActivityVersion: s.activeActivityVersion,
        curriculumWorkspaces: s.curriculumWorkspaces,
        sandboxSnapshot: s.sandboxSnapshot,
        activeSimId: s.activeSimId,
        currentLevel: s.currentLevel,
        workspace: s.workspace,
        savedWorkspaces: s.savedWorkspaces,
        grid: s.grid,
        turtleState: s.turtleState,
        beatState: s.beatState,
        depotState: s.depotState,
        switchyardState: s.switchyardState,
        runtime: s.runtime,
        activeScope: s.activeScope,
        selectedBlockId: s.selectedBlockId,
        speed: s.speed,
        editorTool: s.editorTool,
        isSubpaletteCollapsed: s.isSubpaletteCollapsed,
        isMapHidden: s.isMapHidden,
        isFunctionBarOpen: s.isFunctionBarOpen,
        isLoopPlayback: s.isLoopPlayback,
        randomSeed: s.randomSeed,
        past: s.past,
        future: s.future,
      });
    },

    hydrateFromUpdateIfPresent: () => {
      const defaultGrid = createGridFromPreset(initialPreset);
      const restored = consumeRestoredStateAfterUpdate(defaultGrid);
      if (!restored) return false;

      get().pause();
      ctx.playback.pendingTurtleCommit = null;
      ctx.history.activeBatchSnapshot = null;

      if (restored.activeProfileId) {
        setActiveProfileId(restored.activeProfileId);
      }
      const profilesState = ensureProfilesInitialized();
      const resolvedProfileId =
        restored.activeProfileId &&
        profilesState.profiles.some((p) => p.id === restored.activeProfileId)
          ? restored.activeProfileId
          : profilesState.activeProfileId;
      const restoredBeat = restored.beatState ?? createInitialBeatState(false);
      beatSynth.setMuted(Boolean(restoredBeat.isMuted));

      const restoredAppMode = restored.appMode ?? 'sandbox';
      const restoredActivityId = restored.activeActivityId ?? '1.1';
      const restoredActivityVersion = restored.activeActivityVersion ?? 1;
      const restoredActivity =
        restoredAppMode === 'curriculum'
          ? getActivityAtVersion(restoredActivityId, restoredActivityVersion) ??
            getActivityLatest(restoredActivityId)
          : undefined;
      const restoredSpeed: SimulationSpeed =
        restoredAppMode === 'curriculum' &&
        restoredActivity?.format === 'explanation' &&
        (restored.speed === 'instant' || (restored.speed as any) === 0)
          ? 400
          : restored.speed;

      set({
        profiles: profilesState.profiles,
        activeProfileId: resolvedProfileId,
        unlockAllModules: Boolean(
          getProfileProgress(resolvedProfileId).unlockAllModules
        ),
        isBadgeModalOpen: false,
        completedActivities: buildCompletedMap(resolvedProfileId),
        appMode: restoredAppMode,
        activeActivityId: restoredActivityId,
        activeActivityVersion: restoredActivityVersion,
        viewedDemoTabs:
          restoredAppMode === 'curriculum'
            ? recordDemoTabViewedMap({}, restoredActivity, 0)
            : {},
        curriculumWorkspaces: restored.curriculumWorkspaces ?? {},
        sandboxSnapshot: restored.sandboxSnapshot ?? null,
        activeSimId: restored.activeSimId,
        currentLevel: restored.currentLevel,
        workspace: restored.workspace,
        savedWorkspaces: restored.savedWorkspaces,
        grid: restored.grid,
        turtleState: restored.turtleState,
        beatState: restoredBeat,
        depotState: restored.depotState ?? createInitialDepotState(),
        switchyardState:
          (restored as any).switchyardState ?? createInitialSwitchyardState(),
        runtime: restored.runtime,
        isPlaying: false,
        activeScope: restored.activeScope,
        ...(typeof restored.isLoopPlayback === 'boolean'
          ? { isLoopPlayback: restored.isLoopPlayback }
          : {}),
        ...(typeof restored.randomSeed === 'number' &&
        Number.isFinite(restored.randomSeed)
          ? { randomSeed: Math.trunc(restored.randomSeed) }
          : {}),
        selectedBlockId: restored.selectedBlockId,
        speed: restoredSpeed,
        editorTool: restored.editorTool,
        isSubpaletteCollapsed: restored.isSubpaletteCollapsed,
        isMapHidden: restored.isMapHidden,
        isFunctionBarOpen: restored.isFunctionBarOpen,
        isVictoryModalOpen: false,
        victoryEarnedBadges: [],
        past: restored.past,
        future: restored.future,
        canUndo: restored.past.length > 0,
        canRedo: restored.future.length > 0,
        wasRestoredAfterUpdate: true,
      });

      get().runInstantIfActive();
      return true;
    },

    setPerformanceMode: (mode) => {
      savePersistedPerformanceMode(mode);
      const nextAuto = mode === 'auto' ? get().isAutoLowQuality : false;
      const isLow = mode === 'low' || (mode === 'auto' && nextAuto);
      beatSynth.setLowQualityMode(isLow);
      set({
        performanceMode: mode,
        ...(mode !== 'auto' ? { isAutoLowQuality: false } : {}),
      });
    },

    cyclePerformanceMode: () => {
      const { performanceMode, isAutoLowQuality } = get();
      let nextMode: PerformanceMode;
      if (performanceMode === 'auto') {
        nextMode = isAutoLowQuality ? 'high' : 'low';
      } else if (performanceMode === 'low') {
        nextMode = 'high';
      } else {
        nextMode = 'auto';
      }
      get().setPerformanceMode(nextMode);
    },

    triggerAutoLowQuality: () => {
      const { performanceMode, isAutoLowQuality } = get();
      if (performanceMode !== 'auto' || isAutoLowQuality) return;
      beatSynth.setLowQualityMode(true);
      set({
        isAutoLowQuality: true,
        statusAnnouncement: 'Lite visual mode enabled for smoother playback.',
      });
    },
  };
}
