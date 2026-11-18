import type { ScopeType, SimulationSpeed } from '../../types';
import { createInitialTurtleState } from '../../simulations/turtle/turtleEnvironment';
import { resetBeatState } from '../../simulations/beat/beatEnvironment';
import { createInitialDepotState } from '../../simulations/depot/depotPhysics';
import { createInitialSwitchyardState } from '../../simulations/switchyard/physics';
import { runHeadlessSimulation } from '../../engine/simulationRunner';
import {
  CURRICULUM_ACTIVITIES,
  createCurriculumGridState,
  getActivityAtVersion,
  getActivityLatest,
} from '../../data/curriculum';
import { importFromString } from '../../engine/serialization/codeSerializer';
import {
  DEFAULT_FALLBACK_THUMBNAIL,
  getSavedPrograms,
  saveProgram,
} from '../../services/localSaveService';
import { generateSimulationThumbnail } from '../../services/mapThumbnailGenerator';
import {
  createProfile,
  deleteProfile,
  ensureProfilesInitialized,
  getProfileDisplayName,
  getProfileLessonWorkspaces,
  getProfileProgress,
  getProfileSandboxWorkspaces,
  getProfiles,
  importProfileBackup,
  setActiveProfileId,
  setUnlockAllModules,
} from '../../services/profileService';
import {
  cloneWorkspace,
  cloneWorkspaceWithFreshIds,
  createEmptyWorkspace,
} from '../helpers/workspaceHelpers';
import {
  createCurriculumTurtleState,
  createGridFromPreset,
  getInitialDepotState,
  getInitialGridState,
  getInitialSwitchyardState,
  PRESET_LEVELS,
} from '../helpers/simStateHelpers';
import {
  buildCompletedMap,
  buildVariantRunsForActivity,
  recordDemoTabViewedMap,
  resolveActiveTabConfig,
  resolveActivityInitialInputConfig,
  resolveDefaultSceneInput,
} from '../helpers/curriculumHelpers';
import type { ProfileSliceActions, StoreGet, StoreSet } from '../types';

export function createProfileSlice(
  set: StoreSet,
  get: StoreGet
): ProfileSliceActions {
  return {
    setProfileModalOpen: (open) => set({ isProfileModalOpen: open }),

    reloadActiveProfileState: () => {
      const state = get();
      get().pause();
      get().clearHistory();

      const profilesState = ensureProfilesInitialized();
      const profileId = profilesState.activeProfileId;
      const nextCurriculumWorkspaces = getProfileLessonWorkspaces(profileId);
      const nextSavedWorkspaces = getProfileSandboxWorkspaces(profileId);
      const nextProgress = getProfileProgress(profileId);
      const nextCompleted = buildCompletedMap(profileId);
      const prevFitToView = state.grid.fitToView ?? false;

      if (state.appMode === 'curriculum') {
        const activity =
          getActivityAtVersion(
            state.activeActivityId,
            state.activeActivityVersion
          ) ??
          getActivityLatest(state.activeActivityId) ??
          CURRICULUM_ACTIVITIES[0];
        if (!activity) return;

        const tabCfg = resolveActiveTabConfig(state, activity, 0);
        const targetSimId = tabCfg.simId;
        const resolvedGridDef = tabCfg.gridDef;
        const targetGrid = resolvedGridDef
          ? createCurriculumGridState(resolvedGridDef, prevFitToView)
          : getInitialGridState(state.grid);
        const resolvedDepotDef = tabCfg.depotDef;
        const targetDepot = resolvedDepotDef
          ? createInitialDepotState(resolvedDepotDef)
          : createInitialDepotState();
        const resolvedSwitchyardDef = tabCfg.switchyardDef;
        const targetSwitchyard = resolvedSwitchyardDef
          ? createInitialSwitchyardState(resolvedSwitchyardDef as any)
          : createInitialSwitchyardState();
        const targetTurtle = createCurriculumTurtleState(tabCfg.turtleDef);
        const targetVariantRuns = buildVariantRunsForActivity(
          activity,
          prevFitToView
        );

        const targetWs = nextCurriculumWorkspaces[activity.id]
          ? cloneWorkspace(nextCurriculumWorkspaces[activity.id])
          : activity.starterWorkspace
          ? cloneWorkspaceWithFreshIds(activity.starterWorkspace)
          : createEmptyWorkspace();

        const allowedScopes: ScopeType[] =
          activity.palette.allowedScopes &&
          activity.palette.allowedScopes.length > 0
            ? activity.palette.allowedScopes
            : ['MAIN'];
        const shouldResetInstant =
          activity.format === 'explanation' &&
          (state.speed === 'instant' || (state.speed as any) === 0);

        set({
          profiles: profilesState.profiles,
          activeProfileId: profileId,
          unlockAllModules: Boolean(nextProgress.unlockAllModules),
          isBadgeModalOpen: false,
          completedActivities: nextCompleted,
          activeActivityId: activity.id,
          activeActivityVersion: activity.version,
          activeDemoTabIndex: 0,
          demoTabIndexByActivity: {},
          exploredDemoTabs: {},
          viewedDemoTabs: recordDemoTabViewedMap({}, activity, 0),
          activeSimId: targetSimId,
          ...(shouldResetInstant ? { speed: 400 as SimulationSpeed } : {}),
          grid: targetGrid,
          turtleState: targetTurtle,
          beatState: resetBeatState(state.beatState),
          depotState: targetDepot,
          switchyardState: targetSwitchyard,
          isLoopPlayback: Boolean(
            activity.defaultLoopPlayback ?? tabCfg.beatRules?.isLoopingDefault
          ),
          workspace: targetWs,
          curriculumWorkspaces: {
            ...nextCurriculumWorkspaces,
            [activity.id]: cloneWorkspace(targetWs),
          },
          savedWorkspaces: nextSavedWorkspaces,
          sandboxSnapshot: null,
          pendingVersionMismatch: null,
          selectedBlockId: null,
          activeScope: 'MAIN',
          isFunctionBarOpen: allowedScopes.some((sc) => sc !== 'MAIN'),
          isVictoryModalOpen: false,
          victoryEarnedBadges: [],
          editorTool: 'NONE',
          runtime: null,
          ghostPreview: null,
          slotCapRejectionCount: 0,
          lastSlotCapRejectedAt: null,
          variantRuns: targetVariantRuns,
          focusedVariantIndex: 0,
          activeVariationInputConfig: null,
          sceneInput: resolveDefaultSceneInput(
            resolveActivityInitialInputConfig(activity, 0)
          ),
        });
      } else {
        const fallbackPreset =
          PRESET_LEVELS.find((p) => p.id === state.currentLevel) ||
          PRESET_LEVELS[0];
        const targetWs = nextSavedWorkspaces[state.activeSimId]
          ? cloneWorkspace(nextSavedWorkspaces[state.activeSimId])
          : createEmptyWorkspace();

        set({
          profiles: profilesState.profiles,
          activeProfileId: profileId,
          unlockAllModules: Boolean(nextProgress.unlockAllModules),
          isBadgeModalOpen: false,
          completedActivities: nextCompleted,
          activeDemoTabIndex: 0,
          demoTabIndexByActivity: {},
          exploredDemoTabs: {},
          viewedDemoTabs: {},
          curriculumWorkspaces: nextCurriculumWorkspaces,
          savedWorkspaces: nextSavedWorkspaces,
          sandboxSnapshot: null,
          pendingVersionMismatch: null,
          variantRuns: [],
          focusedVariantIndex: 0,
          activeVariationInputConfig: null,
          sceneInput: undefined,
          grid: createGridFromPreset(fallbackPreset, prevFitToView),
          turtleState: createInitialTurtleState(),
          beatState: resetBeatState(state.beatState),
          depotState: createInitialDepotState(),
          switchyardState: createInitialSwitchyardState(),
          isLoopPlayback: false,
          workspace: targetWs,
          selectedBlockId: null,
          activeScope: 'MAIN',
          editorTool: 'NONE',
          runtime: null,
          ghostPreview: null,
          slotCapRejectionCount: 0,
          lastSlotCapRejectedAt: null,
        });
      }

      get().reset();
      get().runInstantIfActive();
    },

    importUserProfileBackup: (input, mode) => {
      const res = importProfileBackup(input, mode, get().activeProfileId);
      if (!res.success || !res.profile) {
        return {
          success: false,
          error: res.error || 'Failed to import profile backup.',
        };
      }

      // Regenerate SVG thumbnails for any QR-imported save slots that omitted bulky screenshot strings
      try {
        const entries = getSavedPrograms(res.profile.id);
        for (const entry of entries) {
          if (entry.screenshot !== DEFAULT_FALLBACK_THUMBNAIL) continue;
          const decoded = importFromString(entry.code);
          if (!decoded.success || !decoded.workspace) continue;

          if (entry.simId === 'grid') {
            const lessonAct = entry.lessonId
              ? getActivityAtVersion(entry.lessonId, entry.lessonVersion ?? 1) ??
                getActivityLatest(entry.lessonId)
              : undefined;
            const preset =
              entry.levelId !== undefined
                ? PRESET_LEVELS.find((p) => p.id === entry.levelId) ||
                  PRESET_LEVELS[0]
                : PRESET_LEVELS[0];
            const initialGridState = lessonAct?.grid
              ? createCurriculumGridState(lessonAct.grid, false)
              : decoded.gridState
              ? getInitialGridState(decoded.gridState)
              : createGridFromPreset(preset, false);
            const run = runHeadlessSimulation(
              decoded.workspace,
              'grid',
              initialGridState,
              250
            );
            const screenshot = generateSimulationThumbnail(
              'grid',
              run.finalState
            );
            saveProgram({ ...entry, screenshot });
          } else if (entry.simId === 'beat') {
            const run = runHeadlessSimulation(
              decoded.workspace,
              'beat',
              resetBeatState(),
              250
            );
            const screenshot = generateSimulationThumbnail(
              'beat',
              run.finalState
            );
            saveProgram({ ...entry, screenshot });
          } else if (entry.simId === 'depot') {
            const lessonAct = entry.lessonId
              ? getActivityAtVersion(entry.lessonId, entry.lessonVersion ?? 1) ??
                getActivityLatest(entry.lessonId)
              : undefined;
            const initialDepot = lessonAct?.depot
              ? createInitialDepotState(lessonAct.depot)
              : decoded.depotState
              ? getInitialDepotState(decoded.depotState)
              : createInitialDepotState();
            const run = runHeadlessSimulation(
              decoded.workspace,
              'depot',
              initialDepot,
              250
            );
            const screenshot = generateSimulationThumbnail(
              'depot',
              run.finalState
            );
            saveProgram({ ...entry, screenshot });
          } else if (entry.simId === 'switchyard') {
            const lessonAct = entry.lessonId
              ? getActivityAtVersion(entry.lessonId, entry.lessonVersion ?? 1) ??
                getActivityLatest(entry.lessonId)
              : undefined;
            const initialSwitchyard = lessonAct?.switchyard
              ? createInitialSwitchyardState(lessonAct.switchyard as any)
              : decoded.switchyardState
              ? getInitialSwitchyardState(decoded.switchyardState)
              : createInitialSwitchyardState();
            const run = runHeadlessSimulation(
              decoded.workspace,
              'switchyard',
              initialSwitchyard,
              250
            );
            const screenshot = generateSimulationThumbnail(
              'switchyard',
              run.finalState
            );
            saveProgram({ ...entry, screenshot });
          } else {
            const run = runHeadlessSimulation(
              decoded.workspace,
              'turtle',
              createInitialTurtleState(),
              250
            );
            const screenshot = generateSimulationThumbnail(
              'turtle',
              run.finalState
            );
            saveProgram({ ...entry, screenshot });
          }
        }
      } catch {
        // Non-fatal thumbnail regeneration fallback
      }

      get().reloadActiveProfileState();
      const displayName = getProfileDisplayName(res.profile);
      set({
        statusAnnouncement:
          mode === 'new'
            ? `Imported backup as new profile ${displayName}.`
            : `Replaced active profile with backup (${displayName}).`,
      });

      return {
        success: true,
        profile: res.profile,
        importedSlotCount: res.importedSlotCount,
        importedAutosaveCount: res.importedAutosaveCount,
      };
    },

    switchProfile: (profileId) => {
      const state = get();
      if (profileId === state.activeProfileId) {
        set({ isProfileModalOpen: false, profiles: getProfiles() });
        return;
      }

      const targetProfile = setActiveProfileId(profileId);
      if (!targetProfile) return;

      get().reloadActiveProfileState();
      set({
        isProfileModalOpen: false,
        statusAnnouncement: `Switched profile to ${getProfileDisplayName(
          targetProfile
        )}.`,
      });
    },

    createAndSwitchProfile: (input) => {
      const created = createProfile(input);
      get().switchProfile(created.id);
      set({
        isProfileModalOpen: false,
        statusAnnouncement: `Created and switched to profile ${getProfileDisplayName(
          created
        )}.`,
      });
      return created;
    },

    deleteUserProfile: (profileId) => {
      const wasActive = get().activeProfileId === profileId;
      const deleted = deleteProfile(profileId);
      if (!deleted) return false;

      if (wasActive) {
        get().reloadActiveProfileState();
        const fallbackProfile = getProfiles().find(
          (p) => p.id === get().activeProfileId
        );
        set({
          statusAnnouncement: fallbackProfile
            ? `Profile deleted. Switched to ${getProfileDisplayName(
                fallbackProfile
              )}.`
            : 'Profile deleted.',
        });
      } else {
        set({
          profiles: getProfiles(),
          statusAnnouncement: 'Profile deleted.',
        });
      }
      return true;
    },

    toggleUnlockAllModules: () => {
      const s = get();
      const currentProgress = getProfileProgress(s.activeProfileId);
      const nextUnlockAll = !currentProgress.unlockAllModules;
      const updated = setUnlockAllModules(s.activeProfileId, nextUnlockAll);
      set({
        unlockAllModules: Boolean(updated.unlockAllModules),
        statusAnnouncement: nextUnlockAll
          ? 'All curriculum modules unlocked.'
          : 'Sequential module unlock restored.',
      });
    },
  };
}
