import type { ScopeType, SimulationSpeed, WorkspaceState } from '../../types';
import { normalizeInitialVariables } from '../../engine/interpreter';
import { ensureSimEnvironmentsRegistered } from '../../engine/simulationRunner';
import { createInitialTurtleState } from '../../simulations/turtle/turtleEnvironment';
import {
  createCurriculumBeatState,
  createInitialBeatState,
  resetBeatState,
} from '../../simulations/beat/beatEnvironment';
import { beatSynth } from '../../simulations/beat/beatSynth';
import {
  createInitialDepotState,
  resetDepotState,
} from '../../simulations/depot/depotPhysics';
import {
  createInitialSwitchyardState,
  resetSwitchyardState,
} from '../../simulations/switchyard/physics';
import {
  CURRICULUM_ACTIVITIES,
  createCurriculumGridState,
  getActivityAtVersion,
  getActivityLatest,
} from '../../data/curriculum';
import {
  findNextUnviewedDemoTabIndex,
  getNextCurriculumActivity,
  normalizeColorLiteralParam,
} from '../../utils/curriculumStagePolicy';
import {
  markLessonCompleted,
  saveLessonAutosave,
  saveSandboxAutosave,
} from '../../services/profileService';
import {
  buildWorkspaceCachePatch,
  cloneWorkspace,
  cloneWorkspaceWithFreshIds,
  createEmptyWorkspace,
  hasWorkspaceAnyBlocks,
  hasWorkspaceLoopError,
  normalizeWorkspaceForCompare,
} from '../helpers/workspaceHelpers';
import {
  buildSandboxSnapshot,
  createCurriculumTurtleState,
  createGridFromPreset,
  getInitialBeatState,
  getInitialDepotState,
  getInitialGridState,
  getInitialSwitchyardState,
  getInitialTurtleState,
  PRESET_LEVELS,
} from '../helpers/simStateHelpers';
import {
  buildVariantRunsForActivity,
  getActiveCurriculumActivity,
  getEffectiveInputConfig,
  isCreativeCurriculumActivity,
  recordDemoTabViewedMap,
  resolveActiveTabConfig,
  resolveActivityInitialInputConfig,
  resolveDefaultSceneInput,
} from '../helpers/curriculumHelpers';
import type {
  CurriculumSliceActions,
  SimId,
  StoreContext,
  StoreGet,
  StoreSet,
} from '../types';

export function createCurriculumSlice(
  set: StoreSet,
  get: StoreGet,
  ctx: StoreContext
): CurriculumSliceActions {
  return {
    resetActivityToStarter: () => {
      const state = get();
      if (state.appMode !== 'curriculum') return;

      const activity =
        getActivityAtVersion(
          state.activeActivityId,
          state.activeActivityVersion
        ) ?? getActivityLatest(state.activeActivityId);
      if (!activity) return;

      get().pause();

      const activeTab =
        activity.format === 'explanation' &&
        activity.demoTabs &&
        state.activeDemoTabIndex > 0 &&
        activity.demoTabs[state.activeDemoTabIndex]
          ? activity.demoTabs[state.activeDemoTabIndex]
          : undefined;

      const referenceStarterWs =
        activeTab?.workspace ??
        activity.starterWorkspace ??
        activity.demoTabs?.[0]?.workspace;

      const hasChangedFromStarter =
        JSON.stringify(normalizeWorkspaceForCompare(state.workspace)) !==
        JSON.stringify(normalizeWorkspaceForCompare(referenceStarterWs));

      if (hasChangedFromStarter) {
        ctx.recordMutation('Reset to starter');
      }

      const starterWs = referenceStarterWs
        ? cloneWorkspaceWithFreshIds(referenceStarterWs)
        : createEmptyWorkspace();

      const hasMultiVariants = state.variantRuns.length > 1;
      const prevFitToView = state.grid.fitToView ?? false;
      const tabCfg = resolveActiveTabConfig(
        state,
        activity,
        state.activeDemoTabIndex
      );
      const nextGrid =
        !hasMultiVariants && tabCfg.gridDef
          ? createCurriculumGridState(tabCfg.gridDef, prevFitToView)
          : undefined;
      const nextDepot = hasMultiVariants
        ? undefined
        : tabCfg.depotDef
        ? createInitialDepotState(tabCfg.depotDef)
        : resetDepotState(state.depotState);
      const nextSwitchyard = hasMultiVariants
        ? undefined
        : tabCfg.switchyardDef
        ? createInitialSwitchyardState(tabCfg.switchyardDef as any)
        : resetSwitchyardState(state.switchyardState);
      const nextTurtle = createCurriculumTurtleState(tabCfg.turtleDef);

      set({
        workspace: starterWs,
        ...(nextGrid ? { grid: nextGrid } : {}),
        turtleState: nextTurtle,
        ...(!hasMultiVariants
          ? {
              beatState: resetBeatState(state.beatState),
              ...(nextDepot ? { depotState: nextDepot } : {}),
              ...(nextSwitchyard ? { switchyardState: nextSwitchyard } : {}),
            }
          : {}),
        curriculumWorkspaces: {
          ...state.curriculumWorkspaces,
          [activity.id]: cloneWorkspace(starterWs),
        },
        selectedBlockId: null,
        activeScope: 'MAIN',
        runtime: null,
        activeVariationInputConfig: null,
        sceneInput: resolveDefaultSceneInput(
          resolveActivityInitialInputConfig(activity, state.activeDemoTabIndex)
        ),
        statusAnnouncement: hasChangedFromStarter
          ? `Reset Activity ${activity.id} to starter blocks. Press Undo to restore your previous blocks.`
          : `Activity ${activity.id} reset to starter.`,
      });

      ctx.persistActiveWorkspace(starterWs, {
        appMode: 'curriculum',
        activityId: activity.id,
        activityVersion: activity.version,
      });

      get().reset();
      get().runInstantIfActive();
    },

    setAppMode: (mode) => {
      ensureSimEnvironmentsRegistered();
      const state = get();
      if (mode === state.appMode) return;

      get().pause();
      get().clearHistory();

      if (mode === 'curriculum') {
        const nextSandboxSnapshot = buildSandboxSnapshot(state);
        const activity =
          getActivityAtVersion(
            state.activeActivityId,
            state.activeActivityVersion
          ) ??
          getActivityLatest(state.activeActivityId) ??
          CURRICULUM_ACTIVITIES[0];

        if (!activity) return;

        const savedTabIdx =
          activity.format === 'explanation' && activity.demoTabs?.length
            ? Math.min(
                Math.max(0, state.demoTabIndexByActivity[activity.id] ?? 0),
                activity.demoTabs.length - 1
              )
            : 0;
        const tabCfg = resolveActiveTabConfig(state, activity, savedTabIdx);
        const activeTab = savedTabIdx > 0 ? tabCfg.tab : undefined;

        const targetSimId = tabCfg.simId;
        const prevFitToView = state.grid.fitToView ?? false;
        const resolvedGridDef = tabCfg.gridDef;
        const targetGrid = resolvedGridDef
          ? createCurriculumGridState(resolvedGridDef, prevFitToView)
          : state.grid;
        const resolvedDepotDef = tabCfg.depotDef;
        const targetDepot = resolvedDepotDef
          ? createInitialDepotState(resolvedDepotDef)
          : createInitialDepotState();
        const resolvedSwitchyardDef = tabCfg.switchyardDef;
        const targetSwitchyard = resolvedSwitchyardDef
          ? createInitialSwitchyardState(resolvedSwitchyardDef as any)
          : createInitialSwitchyardState();
        const targetTurtle = createCurriculumTurtleState(tabCfg.turtleDef);
        const targetBeat = tabCfg.beatDef
          ? createCurriculumBeatState(tabCfg.beatDef, state.beatState.isMuted)
          : createInitialBeatState(state.beatState.isMuted);
        const targetVariantRuns = buildVariantRunsForActivity(
          activity,
          prevFitToView
        );

        const targetWs = state.curriculumWorkspaces[activity.id]
          ? cloneWorkspace(state.curriculumWorkspaces[activity.id])
          : activeTab?.workspace
          ? cloneWorkspaceWithFreshIds(activeTab.workspace)
          : activity.starterWorkspace
          ? cloneWorkspaceWithFreshIds(activity.starterWorkspace)
          : activity.demoTabs?.[0]?.workspace
          ? cloneWorkspaceWithFreshIds(activity.demoTabs[0].workspace)
          : createEmptyWorkspace();

        const allowedScopes: ScopeType[] =
          activity.palette.allowedScopes &&
          activity.palette.allowedScopes.length > 0
            ? activity.palette.allowedScopes
            : ['MAIN'];
        const initialScope: ScopeType = allowedScopes.includes('MAIN')
          ? 'MAIN'
          : allowedScopes[0];
        const shouldResetInstant =
          activity.format === 'explanation' &&
          (state.speed === 'instant' || (state.speed as any) === 0);

        set({
          appMode: 'curriculum',
          activeActivityId: activity.id,
          activeActivityVersion: activity.version,
          activeDemoTabIndex: savedTabIdx,
          viewedDemoTabs: recordDemoTabViewedMap(
            state.viewedDemoTabs,
            activity,
            savedTabIdx
          ),
          activeSimId: targetSimId,
          ...(shouldResetInstant ? { speed: 400 as SimulationSpeed } : {}),
          grid: targetGrid,
          turtleState: targetTurtle,
          beatState: targetBeat,
          depotState: targetDepot,
          switchyardState: targetSwitchyard,
          isLoopPlayback: Boolean(
            activity.defaultLoopPlayback ?? tabCfg.beatRules?.isLoopingDefault
          ),
          workspace: targetWs,
          curriculumWorkspaces: {
            ...state.curriculumWorkspaces,
            [activity.id]: cloneWorkspace(targetWs),
          },
          sandboxSnapshot: nextSandboxSnapshot,
          editorTool: 'NONE',
          selectedBlockId: null,
          activeScope: initialScope,
          isFunctionBarOpen: allowedScopes.some((sc) => sc !== 'MAIN'),
          isVictoryModalOpen: false,
          victoryEarnedBadges: [],
          runtime: null,
          ghostPreview: null,
          slotCapRejectionCount: 0,
          lastSlotCapRejectedAt: null,
          variantRuns: targetVariantRuns,
          focusedVariantIndex: 0,
          activeVariationInputConfig: null,
          sceneInput: resolveDefaultSceneInput(
            resolveActivityInitialInputConfig(activity, savedTabIdx)
          ),
          statusAnnouncement: `Learn mode: Activity ${activity.id} ${activity.title}. Map is read-only.`,
        });

        get().reset();
        get().runInstantIfActive();
      } else {
        const nextCurriculumWorkspaces = {
          ...state.curriculumWorkspaces,
          [state.activeActivityId]: cloneWorkspace(state.workspace),
        };

        const snap = state.sandboxSnapshot;
        const restoredSimId: SimId = snap?.activeSimId ?? 'grid';
        const restoredLevel = snap?.currentLevel ?? state.currentLevel;
        const prevFitToView = state.grid.fitToView ?? false;
        const fallbackPreset =
          PRESET_LEVELS.find((p) => p.id === restoredLevel) ||
          PRESET_LEVELS[0];
        const restoredGrid = snap
          ? getInitialGridState({
              ...JSON.parse(JSON.stringify(snap.grid)),
              fitToView: prevFitToView,
            })
          : createGridFromPreset(fallbackPreset, prevFitToView);
        const restoredTurtle = snap
          ? getInitialTurtleState(JSON.parse(JSON.stringify(snap.turtleState)))
          : createInitialTurtleState();
        const restoredBeat = snap?.beatState
          ? getInitialBeatState({
              ...JSON.parse(JSON.stringify(snap.beatState)),
              isMuted: state.beatState.isMuted,
            })
          : resetBeatState(state.beatState);
        const restoredDepot = snap?.depotState
          ? getInitialDepotState(JSON.parse(JSON.stringify(snap.depotState)))
          : createInitialDepotState();
        const restoredSwitchyard = snap?.switchyardState
          ? getInitialSwitchyardState(
              JSON.parse(JSON.stringify(snap.switchyardState))
            )
          : createInitialSwitchyardState();
        const restoredWs = snap
          ? cloneWorkspace(snap.workspace)
          : state.savedWorkspaces[restoredSimId]
          ? cloneWorkspace(state.savedWorkspaces[restoredSimId])
          : createEmptyWorkspace();
        const restoredSaved: Record<string, WorkspaceState> = {};
        if (snap) {
          for (const [k, ws] of Object.entries(snap.savedWorkspaces)) {
            restoredSaved[k] = cloneWorkspace(ws);
          }
        } else {
          for (const [k, ws] of Object.entries(state.savedWorkspaces)) {
            restoredSaved[k] = cloneWorkspace(ws);
          }
        }

        set({
          appMode: 'sandbox',
          activeSimId: restoredSimId,
          currentLevel: restoredLevel,
          grid: restoredGrid,
          turtleState: restoredTurtle,
          beatState: restoredBeat,
          depotState: restoredDepot,
          switchyardState: restoredSwitchyard,
          isLoopPlayback: false,
          workspace: restoredWs,
          savedWorkspaces: restoredSaved,
          curriculumWorkspaces: nextCurriculumWorkspaces,
          editorTool: 'NONE',
          selectedBlockId: null,
          activeScope: 'MAIN',
          runtime: null,
          ghostPreview: null,
          slotCapRejectionCount: 0,
          lastSlotCapRejectedAt: null,
          variantRuns: [],
          focusedVariantIndex: 0,
          activeVariationInputConfig: null,
          sceneInput: undefined,
          statusAnnouncement: 'Sandbox mode: map and blocks are editable.',
        });

        get().reset();
        get().runInstantIfActive();
      }
    },

    setCurriculumActivity: (activityId, version) => {
      ensureSimEnvironmentsRegistered();
      const activity =
        version !== undefined
          ? getActivityAtVersion(activityId, version)
          : getActivityLatest(activityId);
      if (!activity) return;

      const state = get();
      get().pause();
      get().clearHistory();

      const nextSandboxSnapshot =
        state.appMode === 'sandbox'
          ? buildSandboxSnapshot(state)
          : state.sandboxSnapshot;

      const nextCurriculumWorkspaces =
        state.appMode === 'curriculum'
          ? {
              ...state.curriculumWorkspaces,
              [state.activeActivityId]: cloneWorkspace(state.workspace),
            }
          : { ...state.curriculumWorkspaces };

      const savedTabIdx =
        activity.format === 'explanation' && activity.demoTabs?.length
          ? Math.min(
              Math.max(0, state.demoTabIndexByActivity[activity.id] ?? 0),
              activity.demoTabs.length - 1
            )
          : 0;
      const tabCfg = resolveActiveTabConfig(state, activity, savedTabIdx);
      const activeTab = savedTabIdx > 0 ? tabCfg.tab : undefined;

      const targetSimId = tabCfg.simId;
      const prevFitToView = state.grid.fitToView ?? false;
      const targetGrid = tabCfg.gridDef
        ? createCurriculumGridState(tabCfg.gridDef, prevFitToView)
        : state.grid;
      const targetDepot = tabCfg.depotDef
        ? createInitialDepotState(tabCfg.depotDef)
        : createInitialDepotState();
      const targetSwitchyard = tabCfg.switchyardDef
        ? createInitialSwitchyardState(tabCfg.switchyardDef as any)
        : createInitialSwitchyardState();
      const targetTurtle = createCurriculumTurtleState(tabCfg.turtleDef);
      const targetBeat = tabCfg.beatDef
        ? createCurriculumBeatState(tabCfg.beatDef, state.beatState.isMuted)
        : createInitialBeatState(state.beatState.isMuted);
      const targetVariantRuns = buildVariantRunsForActivity(
        activity,
        prevFitToView
      );

      const targetWs = nextCurriculumWorkspaces[activity.id]
        ? cloneWorkspace(nextCurriculumWorkspaces[activity.id])
        : activeTab?.workspace
        ? cloneWorkspaceWithFreshIds(activeTab.workspace)
        : activity.starterWorkspace
        ? cloneWorkspaceWithFreshIds(activity.starterWorkspace)
        : activity.demoTabs?.[0]?.workspace
        ? cloneWorkspaceWithFreshIds(activity.demoTabs[0].workspace)
        : createEmptyWorkspace();

      nextCurriculumWorkspaces[activity.id] = cloneWorkspace(targetWs);
      const allowedScopes: ScopeType[] =
        activity.palette.allowedScopes &&
        activity.palette.allowedScopes.length > 0
          ? activity.palette.allowedScopes
          : ['MAIN'];
      const initialScope: ScopeType = allowedScopes.includes('MAIN')
        ? 'MAIN'
        : allowedScopes[0];
      const shouldResetInstant =
        activity.format === 'explanation' &&
        (state.speed === 'instant' || (state.speed as any) === 0);

      set({
        appMode: 'curriculum',
        activeActivityId: activity.id,
        activeActivityVersion: activity.version,
        activeDemoTabIndex: savedTabIdx,
        viewedDemoTabs: recordDemoTabViewedMap(
          state.viewedDemoTabs,
          activity,
          savedTabIdx
        ),
        activeSimId: targetSimId,
        ...(shouldResetInstant ? { speed: 400 as SimulationSpeed } : {}),
        activeVariables: tabCfg.initialVars
          ? normalizeInitialVariables(tabCfg.initialVars)
          : {},
        grid: targetGrid,
        turtleState: targetTurtle,
        beatState: targetBeat,
        depotState: targetDepot,
        switchyardState: targetSwitchyard,
        isLoopPlayback: Boolean(
          activity.defaultLoopPlayback ?? tabCfg.beatRules?.isLoopingDefault
        ),
        workspace: targetWs,
        curriculumWorkspaces: nextCurriculumWorkspaces,
        sandboxSnapshot: nextSandboxSnapshot,
        editorTool: 'NONE',
        selectedBlockId: null,
        activeScope: initialScope,
        isFunctionBarOpen: allowedScopes.some((sc) => sc !== 'MAIN'),
        isVictoryModalOpen: false,
        victoryEarnedBadges: [],
        runtime: null,
        ghostPreview: null,
        slotCapRejectionCount: 0,
        lastSlotCapRejectedAt: null,
        variantRuns: targetVariantRuns,
        focusedVariantIndex: 0,
        activeVariationInputConfig: null,
        sceneInput: resolveDefaultSceneInput(
          resolveActivityInitialInputConfig(activity, savedTabIdx)
        ),
        statusAnnouncement: `Activity ${activity.id}: ${activity.title}`,
      });

      get().reset();
      get().runInstantIfActive();
    },

    setFocusedVariantIndex: (index) => {
      const state = get();
      if (state.variantRuns.length <= 1) return;
      const target = state.variantRuns[index];
      if (!target) return;
      set({
        focusedVariantIndex: index,
        ...(target.gridState
          ? {
              grid: {
                ...target.gridState,
                showTrace: state.grid.showTrace,
                fitToView: state.grid.fitToView,
              },
            }
          : {}),
        ...(target.depotState ? { depotState: target.depotState } : {}),
        ...(target.switchyardState
          ? { switchyardState: target.switchyardState }
          : {}),
        ...(target.beatState
          ? {
              beatState: {
                ...target.beatState,
                isMuted: state.beatState.isMuted,
              },
            }
          : {}),
        ...(target.runtime !== undefined ? { runtime: target.runtime } : {}),
      });
    },

    setSceneInput: (value) => {
      const prevSpeed = get().speed;
      const prevWorkspace = get().workspace;
      const effectiveCfg = getEffectiveInputConfig(get());
      const normalizedValue =
        effectiveCfg?.mode === 'color'
          ? normalizeColorLiteralParam(value)
          : value;
      get().pause();
      get().reset();
      set({
        sceneInput: normalizedValue,
        runtime: null,
        statusAnnouncement: `Scene input set to ${normalizedValue}`,
      });
      if (!hasWorkspaceAnyBlocks(prevWorkspace)) return;
      if (hasWorkspaceLoopError(prevWorkspace)) return;
      if (prevSpeed === 'instant' || (prevSpeed as any) === 0) {
        get().runInstantIfActive({ allowVictoryModal: true });
      } else {
        get().play();
      }
    },

    selectExplanationDemoTab: (tabIndex) => {
      const state = get();
      if (state.appMode !== 'curriculum') return;

      const activity =
        getActivityAtVersion(
          state.activeActivityId,
          state.activeActivityVersion
        ) ?? getActivityLatest(state.activeActivityId);
      if (
        !activity ||
        activity.format !== 'explanation' ||
        !activity.demoTabs?.length
      ) {
        return;
      }

      const clampedIndex = Math.min(
        Math.max(0, tabIndex),
        activity.demoTabs.length - 1
      );
      const tab = activity.demoTabs[clampedIndex];
      if (!tab) return;

      get().pause();
      get().clearHistory();

      const prevFitToView = state.grid.fitToView ?? false;
      const tabCfg = resolveActiveTabConfig(state, activity, clampedIndex);
      const nextGrid = tabCfg.gridDef
        ? createCurriculumGridState(tabCfg.gridDef, prevFitToView)
        : state.grid;
      const nextDepot = tabCfg.depotDef
        ? createInitialDepotState(tabCfg.depotDef)
        : resetDepotState(state.depotState);
      const nextSwitchyard = tabCfg.switchyardDef
        ? createInitialSwitchyardState(tabCfg.switchyardDef as any)
        : resetSwitchyardState(state.switchyardState);
      const nextTurtle = createCurriculumTurtleState(tabCfg.turtleDef);
      const nextBeat = tabCfg.beatDef
        ? createCurriculumBeatState(tabCfg.beatDef, state.beatState.isMuted)
        : createInitialBeatState(state.beatState.isMuted);
      const nextWs = cloneWorkspaceWithFreshIds(tab.workspace);
      const nextSimId = tabCfg.simId;

      set({
        activeDemoTabIndex: clampedIndex,
        demoTabIndexByActivity: {
          ...state.demoTabIndexByActivity,
          [activity.id]: clampedIndex,
        },
        viewedDemoTabs: recordDemoTabViewedMap(
          state.viewedDemoTabs,
          activity,
          clampedIndex
        ),
        activeSimId: nextSimId,
        activeVariables: tabCfg.initialVars
          ? normalizeInitialVariables(tabCfg.initialVars)
          : {},
        grid: nextGrid,
        turtleState: nextTurtle,
        beatState: nextBeat,
        depotState: nextDepot,
        switchyardState: nextSwitchyard,
        isLoopPlayback: Boolean(
          activity.defaultLoopPlayback ?? tabCfg.beatRules?.isLoopingDefault
        ),
        workspace: nextWs,
        curriculumWorkspaces: {
          ...state.curriculumWorkspaces,
          [activity.id]: cloneWorkspace(nextWs),
        },
        selectedBlockId: null,
        activeScope: 'MAIN',
        runtime: null,
        ghostPreview: null,
        slotCapRejectionCount: 0,
        lastSlotCapRejectedAt: null,
        activeVariationInputConfig: null,
        sceneInput: resolveDefaultSceneInput(
          tab.inputConfig ?? activity.inputConfig ?? null
        ),
        statusAnnouncement: `Example ${clampedIndex + 1} of ${
          activity.demoTabs.length
        }${tab.title ? `: ${tab.title}` : ''}. Press Play or Step to watch.`,
      });

      get().reset();
      get().runInstantIfActive();
    },

    markActiveDemoTabExplored: () => {
      ctx.markDemoTabExploredInternal(true);
    },

    completeExplanationAndContinue: () => {
      const state = get();
      if (state.appMode !== 'curriculum') return null;

      const activity =
        getActivityAtVersion(
          state.activeActivityId,
          state.activeActivityVersion
        ) ?? getActivityLatest(state.activeActivityId);
      if (!activity || activity.format !== 'explanation') return null;

      get().pause();

      const updatedViewed = recordDemoTabViewedMap(
        state.viewedDemoTabs,
        activity,
        state.activeDemoTabIndex
      );
      if (updatedViewed !== state.viewedDemoTabs) {
        set({ viewedDemoTabs: updatedViewed });
      }

      if (activity.demoTabs && activity.demoTabs.length > 1) {
        const nextUnviewedIdx = findNextUnviewedDemoTabIndex(
          activity.demoTabs,
          state.activeDemoTabIndex,
          updatedViewed[activity.id] ?? []
        );
        if (nextUnviewedIdx !== null) {
          get().selectExplanationDemoTab(nextUnviewedIdx);
          return activity.id;
        }
      }

      markLessonCompleted(
        state.activeProfileId,
        activity.id,
        activity.version
      );
      const nextCompleted = {
        ...state.completedActivities,
        [activity.id]: true,
      };
      set({
        completedActivities: nextCompleted,
      });

      const nextActivity = getNextCurriculumActivity(activity.id);

      if (nextActivity) {
        get().setCurriculumActivity(nextActivity.id, nextActivity.version);
        set({
          completedActivities: {
            ...get().completedActivities,
            [activity.id]: true,
          },
          statusAnnouncement: `Completed Activity ${activity.id}: ${activity.title}. Advancing to Activity ${nextActivity.id}: ${nextActivity.title}.`,
        });
        return nextActivity.id;
      }

      set({
        statusAnnouncement: `Completed Activity ${activity.id}: ${activity.title}.`,
      });
      return null;
    },

    completeCreativeActivity: (advanceToNext = false) => {
      const state = get();
      if (state.appMode !== 'curriculum') return null;

      const activity = getActiveCurriculumActivity(state);
      if (!activity || !isCreativeCurriculumActivity(activity)) return null;

      get().pause();

      const wasAlreadyCompleted = Boolean(
        state.completedActivities[activity.id]
      );
      const res = markLessonCompleted(
        state.activeProfileId,
        activity.id,
        activity.version
      );
      const nextCompleted = {
        ...state.completedActivities,
        [activity.id]: true,
      };
      set({
        completedActivities: nextCompleted,
      });

      if (
        (activity.format === 'capstone' &&
          (!wasAlreadyCompleted || !advanceToNext)) ||
        res.newlyEarnedBadges.length > 0
      ) {
        if (
          !state.beatState.isMuted &&
          state.speed !== 'instant' &&
          (state.speed as any) !== 0
        ) {
          beatSynth.unlockFromGesture();
        }
        ctx.triggerVictoryModal(
          res.newlyEarnedBadges,
          state.speed !== 'instant' && (state.speed as any) !== 0
        );
        if (res.newlyEarnedBadges.length === 0) {
          set({
            statusAnnouncement: `Completed Activity ${activity.id}: ${activity.title}!`,
          });
        }
        return activity.id;
      }

      if (advanceToNext) {
        const nextActivity = getNextCurriculumActivity(activity.id);
        if (nextActivity) {
          get().setCurriculumActivity(nextActivity.id, nextActivity.version);
          set({
            completedActivities: {
              ...get().completedActivities,
              [activity.id]: true,
            },
            statusAnnouncement: `Completed Activity ${activity.id}: ${activity.title}. Advancing to Activity ${nextActivity.id}: ${nextActivity.title}.`,
          });
          return nextActivity.id;
        }
        set({
          isLessonPickerOpen: true,
          statusAnnouncement: `Completed Activity ${activity.id}: ${activity.title}.`,
        });
        return null;
      }

      set({
        statusAnnouncement: `Completed Activity ${activity.id}: ${activity.title}.`,
      });
      return null;
    },

    openCopyInSandbox: () => {
      const state = get();
      if (state.appMode !== 'curriculum') return;

      get().pause();
      get().clearHistory();

      const nextCurriculumWorkspaces = {
        ...state.curriculumWorkspaces,
        [state.activeActivityId]: cloneWorkspace(state.workspace),
      };

      saveLessonAutosave(
        state.activeProfileId,
        state.activeActivityId,
        state.workspace,
        state.activeActivityVersion
      );

      const clonedWs = cloneWorkspaceWithFreshIds(state.workspace);
      const clonedGrid = getInitialGridState(
        JSON.parse(JSON.stringify(state.grid))
      );
      const clonedTurtle = getInitialTurtleState(
        JSON.parse(JSON.stringify(state.turtleState))
      );
      const clonedBeat = getInitialBeatState(
        JSON.parse(JSON.stringify(state.beatState))
      );
      const clonedDepot = getInitialDepotState(
        JSON.parse(JSON.stringify(state.depotState))
      );
      const clonedSwitchyard = getInitialSwitchyardState(
        JSON.parse(JSON.stringify(state.switchyardState))
      );

      const baseSaved =
        state.sandboxSnapshot?.savedWorkspaces ?? state.savedWorkspaces;
      const nextSavedWorkspaces: Record<string, WorkspaceState> = {};
      for (const [k, ws] of Object.entries(baseSaved)) {
        nextSavedWorkspaces[k] = cloneWorkspace(ws);
      }
      nextSavedWorkspaces[state.activeSimId] = cloneWorkspace(clonedWs);
      saveSandboxAutosave(state.activeProfileId, state.activeSimId, clonedWs);

      set({
        appMode: 'sandbox',
        grid: clonedGrid,
        turtleState: clonedTurtle,
        beatState: clonedBeat,
        depotState: clonedDepot,
        switchyardState: clonedSwitchyard,
        workspace: clonedWs,
        savedWorkspaces: nextSavedWorkspaces,
        curriculumWorkspaces: nextCurriculumWorkspaces,
        sandboxSnapshot: {
          activeSimId: state.activeSimId,
          currentLevel: state.currentLevel,
          grid: JSON.parse(JSON.stringify(clonedGrid)),
          turtleState: JSON.parse(JSON.stringify(clonedTurtle)),
          beatState: JSON.parse(JSON.stringify(clonedBeat)),
          depotState: JSON.parse(JSON.stringify(clonedDepot)),
          switchyardState: JSON.parse(JSON.stringify(clonedSwitchyard)),
          workspace: cloneWorkspace(clonedWs),
          savedWorkspaces: nextSavedWorkspaces,
        },
        editorTool: 'NONE',
        selectedBlockId: null,
        activeScope: 'MAIN',
        runtime: null,
        ghostPreview: null,
        isMobileMenuOpen: false,
        slotCapRejectionCount: 0,
        lastSlotCapRejectedAt: null,
        variantRuns: [],
        focusedVariantIndex: 0,
        activeVariationInputConfig: null,
        sceneInput: undefined,
        statusAnnouncement: `Opened editable copy of Activity ${state.activeActivityId} in Sandbox mode.`,
      });

      get().reset();
      get().runInstantIfActive();
    },

    loadVariationWorkspace: (
      variationWorkspace,
      title,
      inputConfigOverride
    ) => {
      get().pause();
      ctx.recordMutation(
        title ? `Load variation: ${title}` : 'Load variation'
      );
      get().reset();

      const newWorkspace = cloneWorkspaceWithFreshIds(variationWorkspace);
      const act = getActiveCurriculumActivity(get());
      const nextInputCfg =
        inputConfigOverride !== undefined
          ? inputConfigOverride
          : act?.inputConfig ?? null;
      const nextSceneInput =
        nextInputCfg !== null
          ? resolveDefaultSceneInput(nextInputCfg)
          : undefined;
      const announcement = title
        ? `Loaded variation: ${title}. Press Undo to restore previous blocks.`
        : 'Loaded variation into workspace. Press Undo to restore previous blocks.';

      set((state) => ({
        workspace: newWorkspace,
        activeVariationInputConfig: inputConfigOverride ?? null,
        ...(nextInputCfg !== null || state.activeVariationInputConfig !== null
          ? { sceneInput: nextSceneInput }
          : {}),
        ...buildWorkspaceCachePatch(state, newWorkspace),
        activeScope: 'MAIN',
        selectedBlockId: null,
        runtime: null,
        statusAnnouncement: announcement,
      }));

      ctx.persistActiveWorkspace(get().workspace);
      get().runInstantIfActive();
    },
  };
}
