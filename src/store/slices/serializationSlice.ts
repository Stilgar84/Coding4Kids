import type {
  ScopeType,
  SimulationSpeed,
  WorkspaceState,
} from '../../types';
import { createInitialTurtleState } from '../../simulations/turtle/turtleEnvironment';
import {
  createCurriculumBeatState,
  createInitialBeatState,
  resetBeatState,
} from '../../simulations/beat/beatEnvironment';
import {
  createInitialDepotState,
  resetDepotState,
} from '../../simulations/depot/depotPhysics';
import {
  createInitialSwitchyardState,
  resetSwitchyardState,
} from '../../simulations/switchyard/physics';
import {
  createCurriculumGridState,
  getActivityAtVersion,
  getActivityLatest,
} from '../../data/curriculum';
import {
  exportLessonToBinary,
  exportLessonToString,
  exportToBinary,
  exportToString,
  importFromBinary,
  importFromString,
} from '../../engine/serialization/codeSerializer';
import {
  saveLessonAutosave,
  saveSandboxAutosave,
} from '../../services/profileService';
import {
  cloneWorkspace,
  cloneWorkspaceWithFreshIds,
  createEmptyWorkspace,
} from '../helpers/workspaceHelpers';
import {
  buildSandboxSnapshot,
  getInitialDepotState,
  getInitialSwitchyardState,
} from '../helpers/simStateHelpers';
import {
  buildVariantRunsForActivity,
  recordDemoTabViewedMap,
  resolveActivityInitialInputConfig,
  resolveCurriculumSimId,
  resolveDefaultSceneInput,
} from '../helpers/curriculumHelpers';
import type {
  SerializationSliceActions,
  SimId,
  StoreContext,
  StoreGet,
  StoreSet,
} from '../types';

export function createSerializationSlice(
  set: StoreSet,
  get: StoreGet,
  ctx: StoreContext
): SerializationSliceActions {
  const applyLessonWorkspaceLoad = (
    lessonId: string,
    targetVersion: number,
    loadedWorkspace: WorkspaceState,
    announcement?: string
  ): { success: boolean; error?: string } => {
    const activity = getActivityAtVersion(lessonId, targetVersion);
    if (!activity) {
      return {
        success: false,
        error: `Curriculum lesson ${lessonId} (v${targetVersion}) is unavailable.`,
      };
    }

    const state = get();
    get().pause();

    if (
      state.appMode === 'curriculum' &&
      state.activeActivityId === activity.id &&
      state.activeActivityVersion === activity.version
    ) {
      ctx.recordMutation('Load lesson workspace');
    } else {
      get().clearHistory();
    }

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

    const freshWorkspace = cloneWorkspaceWithFreshIds(loadedWorkspace);
    nextCurriculumWorkspaces[activity.id] = cloneWorkspace(freshWorkspace);

    const targetSimId: SimId = resolveCurriculumSimId(
      activity.format === 'explanation' && activity.demoTabs?.[0]?.simId
        ? activity.demoTabs[0].simId
        : activity.simId
    );
    const prevFitToView = state.grid.fitToView ?? false;
    const resolvedGridDef = activity.grid ?? activity.gridVariants?.[0];
    const targetGrid = resolvedGridDef
      ? createCurriculumGridState(resolvedGridDef, prevFitToView)
      : state.grid;
    const resolvedDepotDef = activity.depot ?? activity.depotVariants?.[0];
    const targetDepot = resolvedDepotDef
      ? createInitialDepotState(resolvedDepotDef)
      : createInitialDepotState();
    const resolvedSwitchyardDef =
      activity.switchyard ?? activity.switchyardVariants?.[0];
    const targetSwitchyard = resolvedSwitchyardDef
      ? createInitialSwitchyardState(resolvedSwitchyardDef as any)
      : createInitialSwitchyardState();
    const resolvedBeatDef = activity.beat ?? activity.beatVariants?.[0];
    const targetBeat = resolvedBeatDef
      ? createCurriculumBeatState(resolvedBeatDef, state.beatState.isMuted)
      : createInitialBeatState(state.beatState.isMuted);
    const targetVariantRuns = buildVariantRunsForActivity(
      activity,
      prevFitToView
    );

    const allowedScopes: ScopeType[] =
      activity.palette.allowedScopes &&
      activity.palette.allowedScopes.length > 0
        ? activity.palette.allowedScopes
        : ['MAIN'];
    const initialScope: ScopeType = allowedScopes.includes('MAIN')
      ? 'MAIN'
      : allowedScopes[0];
    const shouldOpenFuncBar = allowedScopes.some((sc) => sc !== 'MAIN');
    const instantBlocked = activity.format === 'explanation';
    const shouldResetInstant =
      instantBlocked &&
      (state.speed === 'instant' || (state.speed as any) === 0);

    set({
      appMode: 'curriculum',
      activeActivityId: activity.id,
      activeActivityVersion: activity.version,
      activeDemoTabIndex: 0,
      viewedDemoTabs: recordDemoTabViewedMap(state.viewedDemoTabs, activity, 0),
      activeSimId: targetSimId,
      ...(shouldResetInstant ? { speed: 400 as SimulationSpeed } : {}),
      grid: targetGrid,
      turtleState: createInitialTurtleState(),
      beatState: targetBeat,
      depotState: targetDepot,
      switchyardState: targetSwitchyard,
      isLoopPlayback: Boolean(
        activity.defaultLoopPlayback ?? activity.beatRules?.isLoopingDefault
      ),
      workspace: freshWorkspace,
      curriculumWorkspaces: nextCurriculumWorkspaces,
      sandboxSnapshot: nextSandboxSnapshot,
      editorTool: 'NONE',
      selectedBlockId: null,
      activeScope: initialScope,
      isFunctionBarOpen: shouldOpenFuncBar,
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
        resolveActivityInitialInputConfig(activity, 0)
      ),
      pendingVersionMismatch: null,
      statusAnnouncement:
        announcement ||
        `Loaded saved blocks into Activity ${activity.id} (v${activity.version}): ${activity.title}.`,
    });

    saveLessonAutosave(
      get().activeProfileId,
      activity.id,
      freshWorkspace,
      activity.version
    );
    get().reset();
    get().runInstantIfActive();
    return { success: true };
  };

  return {
    exportCode: (includeMap = true) => {
      const {
        appMode,
        activeActivityId,
        activeActivityVersion,
        activeSimId,
        workspace,
        grid,
        turtleState,
        beatState,
        depotState,
        switchyardState,
      } = get();

      if (appMode === 'curriculum') {
        if (includeMap) {
          return exportLessonToString(
            workspace,
            activeSimId,
            activeActivityId,
            activeActivityVersion
          );
        }
        if (activeSimId === 'grid') {
          return exportToString(workspace, 'generic');
        }
        if (activeSimId === 'beat') {
          return exportToString(workspace, 'beat', beatState);
        }
        if (activeSimId === 'depot') {
          return exportToString(workspace, 'depot');
        }
        if (activeSimId === 'switchyard') {
          return exportToString(workspace, 'switchyard');
        }
        return exportToString(workspace, 'turtle', turtleState);
      }

      if (activeSimId === 'grid') {
        if (includeMap) {
          return exportToString(workspace, 'grid', grid);
        } else {
          return exportToString(workspace, 'generic');
        }
      } else if (activeSimId === 'beat') {
        return exportToString(workspace, 'beat', beatState);
      } else if (activeSimId === 'depot') {
        return exportToString(
          workspace,
          'depot',
          includeMap ? depotState : undefined
        );
      } else if (activeSimId === 'switchyard') {
        return exportToString(
          workspace,
          'switchyard',
          includeMap ? switchyardState : undefined
        );
      } else {
        return exportToString(workspace, 'turtle', turtleState);
      }
    },

    exportBinary: (includeMap = true) => {
      const {
        appMode,
        activeActivityId,
        activeActivityVersion,
        activeSimId,
        workspace,
        grid,
        turtleState,
        beatState,
        depotState,
        switchyardState,
      } = get();

      if (appMode === 'curriculum') {
        if (includeMap) {
          return exportLessonToBinary(
            workspace,
            activeSimId,
            activeActivityId,
            activeActivityVersion
          );
        }
        if (activeSimId === 'grid') {
          return exportToBinary(workspace, 'generic');
        }
        if (activeSimId === 'beat') {
          return exportToBinary(workspace, 'beat', beatState);
        }
        if (activeSimId === 'depot') {
          return exportToBinary(workspace, 'depot');
        }
        if (activeSimId === 'switchyard') {
          return exportToBinary(workspace, 'switchyard');
        }
        return exportToBinary(workspace, 'turtle', turtleState);
      }

      if (activeSimId === 'grid') {
        if (includeMap) {
          return exportToBinary(workspace, 'grid', grid);
        } else {
          return exportToBinary(workspace, 'generic');
        }
      } else if (activeSimId === 'beat') {
        return exportToBinary(workspace, 'beat', beatState);
      } else if (activeSimId === 'depot') {
        return exportToBinary(
          workspace,
          'depot',
          includeMap ? depotState : undefined
        );
      } else if (activeSimId === 'switchyard') {
        return exportToBinary(
          workspace,
          'switchyard',
          includeMap ? switchyardState : undefined
        );
      } else {
        return exportToBinary(workspace, 'turtle', turtleState);
      }
    },

    importBinary: (data: Uint8Array) => {
      return get().importCode(data);
    },

    importCode: (data: string | Uint8Array) => {
      const res =
        typeof data === 'string'
          ? importFromString(data)
          : importFromBinary(data);
      if (!res.success) {
        return { success: false, error: res.error || 'Failed to import code' };
      }

      // Path B: Standalone Curriculum Lesson Envelope (`ENV_ID_LESSON = 0x04`)
      if (res.envId === 'lesson') {
        const lessonId = res.lessonId || '';
        const latest = getActivityLatest(lessonId);
        if (!latest) {
          return {
            success: false,
            error: `Unknown curriculum lesson: ${lessonId}`,
          };
        }

        const savedVersion = res.lessonVersion ?? 1;
        const loadedWorkspace = res.workspace || createEmptyWorkspace();

        if (savedVersion !== latest.version) {
          const hasHistorical = Boolean(
            getActivityAtVersion(lessonId, savedVersion)
          );
          get().pause();
          set({
            pendingVersionMismatch: {
              source: 'share',
              lessonId,
              savedVersion,
              latestVersion: latest.version,
              workspace: cloneWorkspace(loadedWorkspace),
              hasHistoricalVersion: hasHistorical,
            },
            isExportImportOpen: false,
            isLoadModalOpen: false,
            statusAnnouncement: `Lesson version mismatch for Activity ${lessonId}: saved at v${savedVersion}, latest is v${latest.version}. Choose how to open it.`,
          });
          return { success: true, versionMismatchPending: true };
        }

        return applyLessonWorkspaceLoad(
          lessonId,
          latest.version,
          loadedWorkspace
        );
      }

      // Importing a full environment snapshot (custom Grid map, Turtle drawing, Beat program, or Depot station)
      // while in Curriculum mode switches cleanly to Sandbox so read-only lesson maps are never mutated.
      if (
        get().appMode === 'curriculum' &&
        (res.envId === 'turtle' ||
          res.envId === 'beat' ||
          res.envId === 'depot' ||
          (res.envId === 'grid' && Boolean(res.gridState)))
      ) {
        get().setAppMode('sandbox');
      }

      ctx.recordMutation('Import code');

      get().pause();

      const {
        appMode,
        activeActivityId,
        curriculumWorkspaces,
        activeSimId,
        workspace,
        savedWorkspaces,
      } = get();
      const newWorkspace = res.workspace || createEmptyWorkspace();

      if (appMode === 'curriculum') {
        set({
          workspace: newWorkspace,
          curriculumWorkspaces: {
            ...curriculumWorkspaces,
            [activeActivityId]: cloneWorkspace(newWorkspace),
          },
          runtime: null,
          selectedBlockId: null,
          activeScope: 'MAIN',
        });
        ctx.persistActiveWorkspace(newWorkspace, { appMode: 'curriculum' });
      } else if (res.envId === 'turtle') {
        const updatedSavedWorkspaces: Record<string, WorkspaceState> = {
          ...savedWorkspaces,
        };
        if (activeSimId !== 'turtle') {
          updatedSavedWorkspaces[activeSimId] = cloneWorkspace(workspace);
          saveSandboxAutosave(get().activeProfileId, activeSimId, workspace);
        }
        updatedSavedWorkspaces['turtle'] = cloneWorkspace(newWorkspace);
        saveSandboxAutosave(get().activeProfileId, 'turtle', newWorkspace);

        set({
          activeSimId: 'turtle',
          turtleState: createInitialTurtleState(),
          workspace: newWorkspace,
          savedWorkspaces: updatedSavedWorkspaces,
          runtime: null,
          selectedBlockId: null,
          activeScope: 'MAIN',
        });
      } else if (res.envId === 'beat') {
        const updatedSavedWorkspaces: Record<string, WorkspaceState> = {
          ...savedWorkspaces,
        };
        if (activeSimId !== 'beat') {
          updatedSavedWorkspaces[activeSimId] = cloneWorkspace(workspace);
          saveSandboxAutosave(get().activeProfileId, activeSimId, workspace);
        }
        updatedSavedWorkspaces['beat'] = cloneWorkspace(newWorkspace);
        saveSandboxAutosave(get().activeProfileId, 'beat', newWorkspace);

        set({
          activeSimId: 'beat',
          beatState: resetBeatState(get().beatState),
          workspace: newWorkspace,
          savedWorkspaces: updatedSavedWorkspaces,
          runtime: null,
          selectedBlockId: null,
          activeScope: 'MAIN',
        });
      } else if (res.envId === 'depot') {
        const updatedSavedWorkspaces: Record<string, WorkspaceState> = {
          ...savedWorkspaces,
        };
        if (activeSimId !== 'depot') {
          updatedSavedWorkspaces[activeSimId] = cloneWorkspace(workspace);
          saveSandboxAutosave(get().activeProfileId, activeSimId, workspace);
        }
        updatedSavedWorkspaces['depot'] = cloneWorkspace(newWorkspace);
        saveSandboxAutosave(get().activeProfileId, 'depot', newWorkspace);

        set({
          activeSimId: 'depot',
          depotState: res.depotState
            ? getInitialDepotState(res.depotState)
            : resetDepotState(get().depotState),
          workspace: newWorkspace,
          savedWorkspaces: updatedSavedWorkspaces,
          runtime: null,
          selectedBlockId: null,
          activeScope: 'MAIN',
        });
      } else if (res.envId === 'switchyard') {
        const updatedSavedWorkspaces: Record<string, WorkspaceState> = {
          ...savedWorkspaces,
        };
        if (activeSimId !== 'switchyard') {
          updatedSavedWorkspaces[activeSimId] = cloneWorkspace(workspace);
          saveSandboxAutosave(get().activeProfileId, activeSimId, workspace);
        }
        updatedSavedWorkspaces['switchyard'] = cloneWorkspace(newWorkspace);
        saveSandboxAutosave(get().activeProfileId, 'switchyard', newWorkspace);

        set({
          activeSimId: 'switchyard',
          switchyardState: res.switchyardState
            ? getInitialSwitchyardState(res.switchyardState)
            : resetSwitchyardState(get().switchyardState),
          workspace: newWorkspace,
          savedWorkspaces: updatedSavedWorkspaces,
          runtime: null,
          selectedBlockId: null,
          activeScope: 'MAIN',
        });
      } else if (res.envId === 'grid') {
        const updatedSavedWorkspaces: Record<string, WorkspaceState> = {
          ...savedWorkspaces,
        };
        if (activeSimId !== 'grid') {
          updatedSavedWorkspaces[activeSimId] = cloneWorkspace(workspace);
          saveSandboxAutosave(get().activeProfileId, activeSimId, workspace);
        }
        updatedSavedWorkspaces['grid'] = cloneWorkspace(newWorkspace);
        saveSandboxAutosave(get().activeProfileId, 'grid', newWorkspace);

        set({
          activeSimId: 'grid',
          workspace: newWorkspace,
          savedWorkspaces: updatedSavedWorkspaces,
          ...(res.gridState ? { grid: res.gridState } : {}),
          runtime: null,
          selectedBlockId: null,
          activeScope: 'MAIN',
        });
      } else {
        set({
          workspace: newWorkspace,
          savedWorkspaces: {
            ...savedWorkspaces,
            [activeSimId]: cloneWorkspace(newWorkspace),
          },
          runtime: null,
          selectedBlockId: null,
          activeScope: 'MAIN',
        });
        saveSandboxAutosave(get().activeProfileId, activeSimId, newWorkspace);
      }

      get().reset();
      get().runInstantIfActive();
      return { success: true };
    },

    loadSavedProgram: (entry) => {
      if (entry.lessonId) {
        const res = importFromString(entry.code);
        if (!res.success) {
          return {
            success: false,
            error: res.error || 'Failed to decode saved lesson program',
          };
        }

        const latest = getActivityLatest(entry.lessonId);
        if (!latest) {
          return {
            success: false,
            error: `Unknown curriculum lesson: ${entry.lessonId}`,
          };
        }

        const savedVersion = entry.lessonVersion ?? 1;
        const loadedWorkspace = res.workspace || createEmptyWorkspace();

        if (savedVersion !== latest.version) {
          const hasHistorical = Boolean(
            getActivityAtVersion(entry.lessonId, savedVersion)
          );
          get().pause();
          set({
            pendingVersionMismatch: {
              source: 'slot',
              lessonId: entry.lessonId,
              savedVersion,
              latestVersion: latest.version,
              workspace: cloneWorkspace(loadedWorkspace),
              hasHistoricalVersion: hasHistorical,
              title: entry.title,
              slotIndex: entry.slotIndex,
            },
            isLoadModalOpen: false,
            statusAnnouncement: `Lesson version mismatch for ${entry.title}: saved at v${savedVersion}, latest is v${latest.version}. Choose how to open it.`,
          });
          return { success: true, versionMismatchPending: true };
        }

        return applyLessonWorkspaceLoad(
          entry.lessonId,
          latest.version,
          loadedWorkspace,
          `Loaded "${entry.title}" into Activity ${latest.id} (v${latest.version}): ${latest.title}.`
        );
      }

      // Legacy v1 save or Free-Play Sandbox save (no `lessonId`):
      // Always open in Free-Play Sandbox with embedded state intact.
      const decoded = importFromString(entry.code);
      if (!decoded.success) {
        return {
          success: false,
          error: decoded.error || 'Failed to decode saved program',
        };
      }

      if (get().appMode === 'curriculum') {
        get().setAppMode('sandbox');
      }

      if (
        entry.simId === 'grid' &&
        entry.levelId !== undefined &&
        !decoded.gridState
      ) {
        get().setLevel(entry.levelId);
      } else if (
        decoded.envId === 'generic' &&
        entry.simId !== get().activeSimId
      ) {
        get().setSimEnvironment(entry.simId);
      }

      const importRes = get().importCode(entry.code);
      if (
        importRes.success &&
        entry.simId === 'grid' &&
        entry.levelId !== undefined
      ) {
        set({ currentLevel: entry.levelId });
      }
      return importRes;
    },

    resolveVersionMismatch: (choice) => {
      const pending = get().pendingVersionMismatch;
      if (!pending) return false;

      if (choice === 'original') {
        if (!pending.hasHistoricalVersion) return false;
        const res = applyLessonWorkspaceLoad(
          pending.lessonId,
          pending.savedVersion,
          pending.workspace,
          `Opened Activity ${pending.lessonId} in original version v${pending.savedVersion}.`
        );
        return res.success;
      }

      const res = applyLessonWorkspaceLoad(
        pending.lessonId,
        pending.latestVersion,
        pending.workspace,
        `Loaded saved v${pending.savedVersion} blocks into latest Activity ${pending.lessonId} (v${pending.latestVersion}).`
      );
      return res.success;
    },

    dismissVersionMismatch: () => {
      if (!get().pendingVersionMismatch) return;
      set({
        pendingVersionMismatch: null,
        statusAnnouncement: 'Cancelled loading mismatched lesson version.',
      });
    },
  };
}
