import type { CodeBlock, ScopeType, WorkspaceState } from '../../types';
import { validateLoopStructure } from '../../engine/interpreter';
import { LESSONS } from '../../data/lessons';
import {
  getActivityAtVersion,
  getActivityLatest,
} from '../../data/curriculum';
import {
  computeGhostPreviewSteps,
  resolveActivityScaffoldWorkspace,
} from '../../engine/placeholderHelpers';
import {
  computeAllowedDepotStationsAndGates,
  computeSlotBudget,
  formatSlotCapFullAnnouncement,
  getControlPairCloserType,
  resolveDefaultConditionForContext,
  resolveEffectiveSlotCap,
} from '../../utils/curriculumStagePolicy';
import { isCurrentSimSuccess } from '../helpers/statusAndPerfHelpers';
import {
  buildWorkspaceCachePatch,
  cloneWorkspace,
  cloneWorkspaceWithFreshIds,
  resolveStagedDefaultSimParams,
} from '../helpers/workspaceHelpers';
import { getSimEnvironment } from '../helpers/simStateHelpers';
import {
  getActiveCurriculumActivity,
  getEffectiveInputConfig,
} from '../helpers/curriculumHelpers';
import type {
  ScaffoldsAndHintsSliceActions,
  StoreContext,
  StoreGet,
  StoreSet,
} from '../types';

export function createScaffoldsAndHintsSlice(
  set: StoreSet,
  get: StoreGet,
  ctx: StoreContext
): ScaffoldsAndHintsSliceActions {
  return {
    loadSolution: (lessonId) => {
      if (get().appMode === 'curriculum' && lessonId === undefined) {
        const { activeActivityId, activeActivityVersion } = get();
        const activity =
          getActivityAtVersion(activeActivityId, activeActivityVersion) ??
          getActivityLatest(activeActivityId);
        if (!activity?.referenceSolution) return;

        ctx.recordMutation('Load solution');
        get().reset();

        const newWorkspace = cloneWorkspaceWithFreshIds(
          activity.referenceSolution
        );
        set((state) => ({
          workspace: newWorkspace,
          curriculumWorkspaces: {
            ...state.curriculumWorkspaces,
            [state.activeActivityId]: cloneWorkspace(newWorkspace),
          },
          activeScope: 'MAIN',
          selectedBlockId: null,
          ghostPreview: null,
          statusAnnouncement: `Loaded full reference solution for ${activity.title}. Press Undo to restore your previous blocks.`,
        }));
        ctx.persistActiveWorkspace(newWorkspace, { appMode: 'curriculum' });
        get().runInstantIfActive();
        return;
      }

      if (get().appMode === 'curriculum') {
        get().setAppMode('sandbox');
      }

      const id = lessonId ?? get().currentLevel;
      const lesson = LESSONS.find((l) => l.id === id);
      if (!lesson) return;

      ctx.recordMutation('Load solution');

      get().reset();

      const cloneBlocks = (blocks: CodeBlock[]) =>
        blocks.map((b) => ({
          ...b,
          id: `${b.type}_${Date.now()}_${Math.random()
            .toString(36)
            .substring(2, 6)}`,
        }));

      const newWorkspace = {
        MAIN: cloneBlocks(lesson.solution.MAIN),
        F1: cloneBlocks(lesson.solution.F1 || []),
        F2: cloneBlocks(lesson.solution.F2 || []),
        F3: cloneBlocks(lesson.solution.F3 || []),
      };

      set({
        workspace: newWorkspace,
        savedWorkspaces: {
          ...get().savedWorkspaces,
          [get().activeSimId]: cloneWorkspace(newWorkspace),
        },
        activeScope: 'MAIN',
        selectedBlockId: null,
        ghostPreview: null,
      });
      ctx.persistActiveWorkspace(newWorkspace, { appMode: 'sandbox' });
      get().runInstantIfActive();
    },

    triggerGhostPreview: () => {
      const {
        appMode,
        activeActivityId,
        activeActivityVersion,
        grid,
        ghostPreview,
      } = get();
      if (appMode !== 'curriculum') return false;

      const activity =
        getActivityAtVersion(activeActivityId, activeActivityVersion) ??
        getActivityLatest(activeActivityId);
      if (!activity?.partialHelp?.ghostPreview) return false;

      get().pause();
      const poses = computeGhostPreviewSteps(
        grid,
        activity.partialHelp.ghostPreview
      );
      const stepTotal = Math.max(0, poses.length - 1);

      set({
        isSolutionOpen: false,
        ghostPreview: {
          active: true,
          activityId: activity.id,
          poses,
          currentStepIndex: 0,
          runId: (ghostPreview?.runId ?? 0) + 1,
        },
        statusAnnouncement: `Ghost-step preview started (${stepTotal} ${
          stepTotal === 1 ? 'step' : 'steps'
        }) for ${activity.title}. Your workspace blocks are unchanged.`,
      });
      return true;
    },

    stopGhostPreview: () => {
      if (get().ghostPreview) {
        set({ ghostPreview: null });
      }
    },

    advanceGhostPreviewStep: () => {
      const gp = get().ghostPreview;
      if (!gp || !gp.active || gp.poses.length === 0) return;
      set({
        ghostPreview: {
          ...gp,
          currentStepIndex: (gp.currentStepIndex + 1) % gp.poses.length,
        },
      });
    },

    loadPartialScaffold: () => {
      if (get().appMode !== 'curriculum') return false;
      const { activeActivityId, activeActivityVersion } = get();
      const activity =
        getActivityAtVersion(activeActivityId, activeActivityVersion) ??
        getActivityLatest(activeActivityId);
      const scaffoldTemplate = resolveActivityScaffoldWorkspace(activity);
      if (!scaffoldTemplate) return false;

      ctx.recordMutation('Load starter scaffold');
      get().reset();

      const newWorkspace = cloneWorkspaceWithFreshIds(scaffoldTemplate);
      let firstPlaceholderId: string | null = null;
      let targetScope: ScopeType = 'MAIN';
      for (const sc of ['MAIN', 'F1', 'F2', 'F3'] as ScopeType[]) {
        const found = (newWorkspace[sc] ?? []).find(
          (b) => b.type === 'PLACEHOLDER'
        );
        if (found) {
          firstPlaceholderId = found.id;
          targetScope = sc;
          break;
        }
      }

      set((state) => ({
        workspace: newWorkspace,
        curriculumWorkspaces: {
          ...state.curriculumWorkspaces,
          [state.activeActivityId]: cloneWorkspace(newWorkspace),
        },
        activeScope: targetScope,
        selectedBlockId: firstPlaceholderId,
        isSolutionOpen: false,
        ghostPreview: null,
        statusAnnouncement: `Loaded starter ? scaffold${
          activity?.title ? ` for ${activity.title}` : ''
        }. Select a highlighted block in the palette to fill ?, or press Undo to restore your previous blocks.`,
      }));
      ctx.persistActiveWorkspace(get().workspace);
      get().runInstantIfActive();
      return true;
    },

    replacePlaceholderBlock: (scope, placeholderBlockId, newType, params) => {
      const currentBlocks = get().workspace[scope] || [];
      const targetIdx = currentBlocks.findIndex(
        (b) => b.id === placeholderBlockId && b.type === 'PLACEHOLDER'
      );
      if (targetIdx === -1) return false;

      const wasSuccess = isCurrentSimSuccess(get());
      ctx.recordMutation('Replace placeholder block');

      const id = `${newType}_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 6)}`;
      const stateSnapshot = get();
      const simEnv = getSimEnvironment(stateSnapshot.activeSimId);
      const paletteItem = simEnv?.paletteItems.find(
        (p) => p.actionType === newType
      );
      const activeActivityForDefaults =
        getActiveCurriculumActivity(stateSnapshot);
      const effectiveInputForDefaults = getEffectiveInputConfig(
        stateSnapshot,
        activeActivityForDefaults
      );
      const { stations: allowedDepotStations } =
        computeAllowedDepotStationsAndGates(
          activeActivityForDefaults,
          stateSnapshot.activeDemoTabIndex
        );
      const isConditionBlock =
        newType === 'IF' || newType === 'ELSE_IF' || newType === 'WHILE';
      const resolvedParams = params
        ? params
        : isConditionBlock
        ? {
            condition: resolveDefaultConditionForContext(
              stateSnapshot.activeSimId,
              activeActivityForDefaults?.palette,
              effectiveInputForDefaults,
              allowedDepotStations
            ),
          }
        : resolveStagedDefaultSimParams(
            newType,
            paletteItem?.params,
            stateSnapshot.appMode,
            activeActivityForDefaults,
            stateSnapshot.activeDemoTabIndex
          );
      const newBlock: CodeBlock = {
        id,
        type: newType,
        ...(newType === 'LOOP_START' ? { repeatCount: 2 } : {}),
        params: resolvedParams,
      };

      const nextBlocks = [...currentBlocks];
      const closerType = getControlPairCloserType(newType);
      if (closerType) {
        const candidateSingle = [...currentBlocks];
        candidateSingle.splice(targetIdx, 1, newBlock);
        const structCheck = validateLoopStructure(candidateSingle);
        const isUnclosed =
          structCheck.unclosedLoopStartIds.includes(newBlock.id) ||
          structCheck.unclosedIfIds.includes(newBlock.id) ||
          structCheck.unclosedWhileIds.includes(newBlock.id);
        if (isUnclosed) {
          const stateBeforeReplace = get();
          if (
            stateBeforeReplace.appMode === 'curriculum' &&
            activeActivityForDefaults
          ) {
            const budget = computeSlotBudget(
              stateBeforeReplace.workspace,
              scope,
              stateBeforeReplace.appMode,
              resolveEffectiveSlotCap(activeActivityForDefaults)
            );
            if (
              budget.isCapped &&
              budget.remainingForScope !== null &&
              budget.remainingForScope < 1
            ) {
              const allowedScopes: ScopeType[] =
                activeActivityForDefaults.palette.allowedScopes &&
                activeActivityForDefaults.palette.allowedScopes.length > 0
                  ? activeActivityForDefaults.palette.allowedScopes
                  : ['MAIN'];
              const nextCount = stateBeforeReplace.slotCapRejectionCount + 1;
              const baseMsg = formatSlotCapFullAnnouncement(
                budget,
                scope,
                allowedScopes,
                2
              );
              const nextAnnouncement =
                stateBeforeReplace.statusAnnouncement === baseMsg
                  ? `${baseMsg} `
                  : baseMsg;
              set({
                slotCapRejectionCount: nextCount,
                lastSlotCapRejectedAt: Date.now(),
                statusAnnouncement: nextAnnouncement,
              });
              return false;
            }
          }
          const endBlock: CodeBlock = {
            id: `${closerType}_${Date.now()}_${Math.random()
              .toString(36)
              .substring(2, 6)}`,
            type: closerType,
          };
          nextBlocks.splice(targetIdx, 1, newBlock, endBlock);
        } else {
          nextBlocks.splice(targetIdx, 1, newBlock);
        }
      } else {
        nextBlocks.splice(targetIdx, 1, newBlock);
      }

      set((state) => {
        const nextWorkspace: WorkspaceState = {
          ...state.workspace,
          [scope]: nextBlocks,
        };
        const updatedRuntime =
          state.runtime && state.runtime.activeBlockId === placeholderBlockId
            ? { ...state.runtime, activeBlockId: newBlock.id }
            : state.runtime;

        return {
          workspace: nextWorkspace,
          ...buildWorkspaceCachePatch(state, nextWorkspace),
          activeScope: scope,
          selectedBlockId: newBlock.id,
          runtime: updatedRuntime,
          ghostPreview: null,
          statusAnnouncement:
            'Replaced ? placeholder block. Press Undo to restore ?.',
        };
      });

      ctx.persistActiveWorkspace(get().workspace);
      get().runInstantIfActive({ allowVictoryModal: !wasSuccess });
      return true;
    },
  };
}
