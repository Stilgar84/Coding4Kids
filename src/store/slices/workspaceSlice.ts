import type { CodeBlock, ScopeType, WorkspaceState } from '../../types';
import {
  getActivityAtVersion,
  getActivityLatest,
} from '../../data/curriculum';
import {
  computeAllowedDepotStationsAndGates,
  computeSlotBudget,
  formatSlotCapFullAnnouncement,
  getControlPairCloserType,
  getRequiredSlotCostForBlockType,
  resolveActiveCurriculumActivity,
  resolveDefaultConditionForContext,
  resolveEffectiveSlotCap,
} from '../../utils/curriculumStagePolicy';
import { isCurrentSimSuccess } from '../helpers/statusAndPerfHelpers';
import {
  buildWorkspaceCachePatch,
  createEmptyWorkspace,
  hasWorkspaceAnyBlocks,
  resolveStagedDefaultSimParams,
} from '../helpers/workspaceHelpers';
import { getSimEnvironment } from '../helpers/simStateHelpers';
import { getEffectiveInputConfig } from '../helpers/curriculumHelpers';
import type {
  StoreContext,
  StoreGet,
  StoreSet,
  WorkspaceSliceActions,
} from '../types';

export function createWorkspaceSlice(
  set: StoreSet,
  get: StoreGet,
  ctx: StoreContext
): WorkspaceSliceActions {
  return {
    addBlock: (scope, type, repeatCount, insertAtIndex, params) => {
      const stateBefore = get();
      const activeActForPolicy =
        stateBefore.appMode === 'curriculum'
          ? resolveActiveCurriculumActivity(
              stateBefore.appMode,
              stateBefore.activeActivityId,
              stateBefore.activeActivityVersion
            )
          : undefined;
      const allowActionParamsBefore =
        stateBefore.appMode !== 'curriculum' ||
        activeActForPolicy?.palette?.allowActionParams !== false;
      const normalizedType =
        stateBefore.appMode === 'curriculum' &&
        !allowActionParamsBefore &&
        stateBefore.activeSimId === 'turtle'
          ? type === 'MOVE_FWD'
            ? 'FORWARD'
            : type === 'MOVE_BACK'
            ? 'BACKWARD'
            : type
          : type;

      const pairCloserType = getControlPairCloserType(normalizedType);
      const requiredSlots = getRequiredSlotCostForBlockType(normalizedType);

      if (stateBefore.appMode === 'curriculum' && activeActForPolicy) {
        const allowedScopes: ScopeType[] =
          activeActForPolicy.palette.allowedScopes &&
          activeActForPolicy.palette.allowedScopes.length > 0
            ? activeActForPolicy.palette.allowedScopes
            : ['MAIN'];
        if (!allowedScopes.includes(scope)) {
          return;
        }
        const budget = computeSlotBudget(
          stateBefore.workspace,
          scope,
          stateBefore.appMode,
          resolveEffectiveSlotCap(activeActForPolicy)
        );
        if (
          budget.isCapped &&
          (budget.isFull ||
            (budget.remainingForScope !== null &&
              budget.remainingForScope < requiredSlots))
        ) {
          const nextCount = stateBefore.slotCapRejectionCount + 1;
          const baseMsg = formatSlotCapFullAnnouncement(
            budget,
            scope,
            allowedScopes,
            requiredSlots
          );
          const nextAnnouncement =
            stateBefore.statusAnnouncement === baseMsg
              ? `${baseMsg} `
              : baseMsg;
          set({
            slotCapRejectionCount: nextCount,
            lastSlotCapRejectedAt: Date.now(),
            statusAnnouncement: nextAnnouncement,
          });
          return;
        }
      }

      const wasSuccess = isCurrentSimSuccess(get());
      ctx.recordMutation('Add block');
      const currentState = get();
      const activeActivity =
        currentState.appMode === 'curriculum'
          ? getActivityAtVersion(
              currentState.activeActivityId,
              currentState.activeActivityVersion
            ) ?? getActivityLatest(currentState.activeActivityId)
          : undefined;
      const allowActionParams =
        currentState.appMode !== 'curriculum' ||
        activeActivity?.palette?.allowActionParams !== false;

      const id = `${normalizedType}_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 6)}`;
      const simEnv = getSimEnvironment(currentState.activeSimId);
      const paletteItem = simEnv?.paletteItems.find(
        (p) => p.actionType === normalizedType
      );
      const isConditionBlock =
        normalizedType === 'IF' ||
        normalizedType === 'ELSE_IF' ||
        normalizedType === 'WHILE';
      const isVariableOrPlaceholderOrCondBlock =
        normalizedType === 'VAR_ASSIGN' ||
        normalizedType === 'VAR_OP' ||
        normalizedType === 'PLACEHOLDER' ||
        isConditionBlock;
      const effectiveInputConfig = getEffectiveInputConfig(
        currentState,
        activeActivity
      );
      const { stations: allowedDepotStations } =
        computeAllowedDepotStationsAndGates(
          activeActivity,
          currentState.activeDemoTabIndex
        );
      const defaultParams = isConditionBlock
        ? {
            condition: resolveDefaultConditionForContext(
              currentState.activeSimId,
              activeActivity?.palette,
              effectiveInputConfig,
              allowedDepotStations
            ),
          }
        : resolveStagedDefaultSimParams(
            normalizedType,
            paletteItem?.params,
            currentState.appMode,
            activeActivity,
            currentState.activeDemoTabIndex
          );
      const resolvedParams =
        !allowActionParams && !isVariableOrPlaceholderOrCondBlock
          ? undefined
          : params ?? defaultParams;
      const resolvedRepeatCount =
        normalizedType === 'LOOP_START' && repeatCount === undefined
          ? 2
          : repeatCount;
      const newBlock: CodeBlock = {
        id,
        type: normalizedType,
        repeatCount: resolvedRepeatCount,
        params: resolvedParams,
      };
      const closerBlock: CodeBlock | null = pairCloserType
        ? {
            id: `${pairCloserType}_${Date.now()}_${Math.random()
              .toString(36)
              .substring(2, 6)}`,
            type: pairCloserType,
          }
        : null;

      set((state) => {
        const currentBlocks = [...(state.workspace[scope] ?? [])];
        const blocksToInsert = closerBlock
          ? [newBlock, closerBlock]
          : [newBlock];
        if (
          typeof insertAtIndex === 'number' &&
          insertAtIndex >= 0 &&
          insertAtIndex <= currentBlocks.length
        ) {
          currentBlocks.splice(insertAtIndex, 0, ...blocksToInsert);
        } else {
          currentBlocks.push(...blocksToInsert);
        }
        const nextWorkspace: WorkspaceState = {
          ...state.workspace,
          [scope]: currentBlocks,
        };
        return {
          workspace: nextWorkspace,
          lastSlotCapRejectedAt: null,
          ...buildWorkspaceCachePatch(state, nextWorkspace),
          selectedBlockId: id,
        };
      });
      ctx.persistActiveWorkspace(get().workspace);
      get().runInstantIfActive({ allowVictoryModal: !wasSuccess });
    },

    updateBlockParams: (scope, blockId, newParams) => {
      const currentState = get();
      const currentBlock = currentState.workspace[scope]?.find(
        (b) => b.id === blockId
      );
      if (!currentBlock) return;
      const isConditionBlock =
        currentBlock.type === 'IF' ||
        currentBlock.type === 'ELSE_IF' ||
        currentBlock.type === 'WHILE';
      const isVariableOrPlaceholderOrCondBlock =
        currentBlock.type === 'VAR_ASSIGN' ||
        currentBlock.type === 'VAR_OP' ||
        currentBlock.type === 'PLACEHOLDER' ||
        isConditionBlock;
      if (
        currentState.appMode === 'curriculum' &&
        !isVariableOrPlaceholderOrCondBlock
      ) {
        const activeActivity =
          getActivityAtVersion(
            currentState.activeActivityId,
            currentState.activeActivityVersion
          ) ?? getActivityLatest(currentState.activeActivityId);
        if (activeActivity?.palette?.allowActionParams === false) {
          return;
        }
      }
      const wasSuccess = isCurrentSimSuccess(get());
      ctx.recordMutation('Update block params');
      set((state) => {
        const nextWorkspace: WorkspaceState = {
          ...state.workspace,
          [scope]: (state.workspace[scope] ?? []).map((b) =>
            b.id === blockId
              ? { ...b, params: { ...(b.params || {}), ...newParams } }
              : b
          ),
        };
        return {
          workspace: nextWorkspace,
          ...buildWorkspaceCachePatch(state, nextWorkspace),
        };
      });
      ctx.persistActiveWorkspace(get().workspace);
      get().runInstantIfActive({ allowVictoryModal: !wasSuccess });
    },

    removeBlock: (scope, blockId) => {
      const currentBlock = get().workspace[scope]?.find(
        (b) => b.id === blockId
      );
      if (!currentBlock) return;
      const wasSuccess = isCurrentSimSuccess(get());
      ctx.recordMutation('Remove block');
      set((state) => {
        const nextWorkspace: WorkspaceState = {
          ...state.workspace,
          [scope]: (state.workspace[scope] ?? []).filter(
            (b) => b.id !== blockId
          ),
        };
        return {
          workspace: nextWorkspace,
          lastSlotCapRejectedAt: null,
          ...buildWorkspaceCachePatch(state, nextWorkspace),
          selectedBlockId:
            state.selectedBlockId === blockId ? null : state.selectedBlockId,
        };
      });
      ctx.persistActiveWorkspace(get().workspace);
      get().runInstantIfActive({ allowVictoryModal: !wasSuccess });
    },

    updateBlockRepeat: (scope, blockId, repeatCount) => {
      const currentBlock = get().workspace[scope]?.find(
        (b) => b.id === blockId
      );
      if (!currentBlock || currentBlock.repeatCount === repeatCount) return;
      const wasSuccess = isCurrentSimSuccess(get());
      ctx.recordMutation('Update block repeat');
      set((state) => {
        const nextWorkspace: WorkspaceState = {
          ...state.workspace,
          [scope]: (state.workspace[scope] ?? []).map((b) =>
            b.id === blockId ? { ...b, repeatCount } : b
          ),
        };
        return {
          workspace: nextWorkspace,
          ...buildWorkspaceCachePatch(state, nextWorkspace),
        };
      });
      ctx.persistActiveWorkspace(get().workspace);
      get().runInstantIfActive({ allowVictoryModal: !wasSuccess });
    },

    reorderBlocks: (scope, fromIndex, toIndex) => {
      if (fromIndex === toIndex) return;
      const wasSuccess = isCurrentSimSuccess(get());
      ctx.recordMutation('Reorder blocks');
      set((state) => {
        const blocks = [...(state.workspace[scope] ?? [])];
        const [moved] = blocks.splice(fromIndex, 1);
        blocks.splice(toIndex, 0, moved);
        const nextWorkspace: WorkspaceState = {
          ...state.workspace,
          [scope]: blocks,
        };
        return {
          workspace: nextWorkspace,
          ...buildWorkspaceCachePatch(state, nextWorkspace),
        };
      });
      ctx.persistActiveWorkspace(get().workspace);
      get().runInstantIfActive({ allowVictoryModal: !wasSuccess });
    },

    clearWorkspace: (scope) => {
      const ws = get().workspace;
      const hasBlocks = scope
        ? (ws[scope]?.length ?? 0) > 0
        : hasWorkspaceAnyBlocks(ws);
      if (!hasBlocks) return;
      ctx.recordMutation(scope ? 'Clear scope' : 'Clear workspace');
      if (scope) {
        set((state) => {
          const newWorkspace = { ...state.workspace, [scope]: [] };
          return {
            workspace: newWorkspace,
            lastSlotCapRejectedAt: null,
            ...buildWorkspaceCachePatch(state, newWorkspace),
          };
        });
      } else {
        const emptyWorkspace = createEmptyWorkspace();
        set((state) => ({
          workspace: emptyWorkspace,
          lastSlotCapRejectedAt: null,
          ...buildWorkspaceCachePatch(state, emptyWorkspace),
        }));
      }
      ctx.persistActiveWorkspace(get().workspace);
      get().runInstantIfActive();
    },
  };
}
