import { MAX_HISTORY } from '../createStoreContext';
import { cloneWorkspace } from '../helpers/workspaceHelpers';
import type {
  HistorySliceActions,
  StoreContext,
  StoreGet,
  StoreSet,
} from '../types';

export function createHistorySlice(
  set: StoreSet,
  get: StoreGet,
  ctx: StoreContext
): HistorySliceActions {
  return {
    undo: () => {
      const { past, future, appMode, activeActivityId, curriculumWorkspaces } =
        get();
      if (past.length === 0) return;

      ctx.history.activeBatchSnapshot = null;
      get().pause();

      const previousSnapshot = past[past.length - 1];
      const newPast = past.slice(0, past.length - 1);

      const currentSnapshot = ctx.takeSnapshot(get(), 'Current state before undo');
      currentSnapshot.activeScope = previousSnapshot.activeScope;

      const newFuture = [...future, currentSnapshot];
      const restoredWs = cloneWorkspace(previousSnapshot.workspace);

      set({
        workspace: restoredWs,
        grid: JSON.parse(JSON.stringify(previousSnapshot.grid)),
        ...(previousSnapshot.turtleState
          ? {
              turtleState: {
                ...JSON.parse(JSON.stringify(previousSnapshot.turtleState)),
                pan: { ...get().turtleState.pan },
                zoom: get().turtleState.zoom,
                fitToView: get().turtleState.fitToView,
                showTurtle: get().turtleState.showTurtle,
              },
            }
          : {}),
        ...(previousSnapshot.beatState
          ? {
              beatState: {
                ...JSON.parse(JSON.stringify(previousSnapshot.beatState)),
                isMuted: get().beatState.isMuted,
              },
            }
          : {}),
        ...(previousSnapshot.depotState
          ? {
              depotState: JSON.parse(JSON.stringify(previousSnapshot.depotState)),
            }
          : {}),
        ...(previousSnapshot.switchyardState
          ? {
              switchyardState: JSON.parse(
                JSON.stringify(previousSnapshot.switchyardState)
              ),
            }
          : {}),
        activeScope: previousSnapshot.activeScope,
        selectedBlockId: previousSnapshot.selectedBlockId,
        activeSimId: previousSnapshot.activeSimId,
        ...(appMode === 'curriculum'
          ? {
              curriculumWorkspaces: {
                ...curriculumWorkspaces,
                [activeActivityId]: cloneWorkspace(restoredWs),
              },
            }
          : {
              savedWorkspaces: {
                ...get().savedWorkspaces,
                [previousSnapshot.activeSimId]: cloneWorkspace(restoredWs),
              },
            }),
        runtime: null,
        lastSlotCapRejectedAt: null,
        past: newPast,
        future: newFuture,
        canUndo: newPast.length > 0,
        canRedo: true,
      });

      ctx.persistActiveWorkspace(restoredWs, {
        appMode,
        simId: previousSnapshot.activeSimId,
      });

      get().reset();
      get().runInstantIfActive();
    },

    redo: () => {
      const { past, future, appMode, activeActivityId, curriculumWorkspaces } =
        get();
      if (future.length === 0) return;

      ctx.history.activeBatchSnapshot = null;
      get().pause();

      const nextSnapshot = future[future.length - 1];
      const newFuture = future.slice(0, future.length - 1);

      const currentSnapshot = ctx.takeSnapshot(get(), 'Current state before redo');
      currentSnapshot.activeScope = nextSnapshot.activeScope;

      const newPast = [
        ...past.slice(Math.max(0, past.length - (MAX_HISTORY - 1))),
        currentSnapshot,
      ];
      const restoredWs = cloneWorkspace(nextSnapshot.workspace);

      set({
        workspace: restoredWs,
        grid: JSON.parse(JSON.stringify(nextSnapshot.grid)),
        ...(nextSnapshot.turtleState
          ? {
              turtleState: {
                ...JSON.parse(JSON.stringify(nextSnapshot.turtleState)),
                pan: { ...get().turtleState.pan },
                zoom: get().turtleState.zoom,
                fitToView: get().turtleState.fitToView,
                showTurtle: get().turtleState.showTurtle,
              },
            }
          : {}),
        ...(nextSnapshot.beatState
          ? {
              beatState: {
                ...JSON.parse(JSON.stringify(nextSnapshot.beatState)),
                isMuted: get().beatState.isMuted,
              },
            }
          : {}),
        ...(nextSnapshot.depotState
          ? { depotState: JSON.parse(JSON.stringify(nextSnapshot.depotState)) }
          : {}),
        ...(nextSnapshot.switchyardState
          ? {
              switchyardState: JSON.parse(
                JSON.stringify(nextSnapshot.switchyardState)
              ),
            }
          : {}),
        activeScope: nextSnapshot.activeScope,
        selectedBlockId: nextSnapshot.selectedBlockId,
        activeSimId: nextSnapshot.activeSimId,
        ...(appMode === 'curriculum'
          ? {
              curriculumWorkspaces: {
                ...curriculumWorkspaces,
                [activeActivityId]: cloneWorkspace(restoredWs),
              },
            }
          : {
              savedWorkspaces: {
                ...get().savedWorkspaces,
                [nextSnapshot.activeSimId]: cloneWorkspace(restoredWs),
              },
            }),
        runtime: null,
        lastSlotCapRejectedAt: null,
        past: newPast,
        future: newFuture,
        canUndo: true,
        canRedo: newFuture.length > 0,
      });

      ctx.persistActiveWorkspace(restoredWs, {
        appMode,
        simId: nextSnapshot.activeSimId,
      });

      get().reset();
      get().runInstantIfActive();
    },

    startHistoryBatch: (description?: string) => {
      if (ctx.history.activeBatchSnapshot === null) {
        ctx.history.activeBatchSnapshot = ctx.takeSnapshot(get(), description);
      }
    },

    endHistoryBatch: () => {
      if (ctx.history.activeBatchSnapshot === null) return;
      const initial = ctx.history.activeBatchSnapshot;
      ctx.history.activeBatchSnapshot = null;

      const currentWorkspace = get().workspace;
      const currentGrid = get().grid;
      const currentTurtle = get().turtleState;
      const currentBeat = get().beatState;
      const currentDepot = get().depotState;
      const currentSwitchyard = get().switchyardState;

      const hasWorkspaceChanged =
        JSON.stringify(initial.workspace) !== JSON.stringify(currentWorkspace);
      const hasGridChanged =
        JSON.stringify(initial.grid) !== JSON.stringify(currentGrid);
      const hasTurtleChanged =
        initial.turtleState &&
        JSON.stringify(initial.turtleState) !== JSON.stringify(currentTurtle);
      const hasBeatChanged =
        initial.beatState &&
        JSON.stringify(initial.beatState) !== JSON.stringify(currentBeat);
      const hasDepotChanged =
        initial.depotState &&
        JSON.stringify(initial.depotState) !== JSON.stringify(currentDepot);
      const hasSwitchyardChanged =
        initial.switchyardState &&
        JSON.stringify(initial.switchyardState) !==
          JSON.stringify(currentSwitchyard);

      if (
        hasWorkspaceChanged ||
        hasGridChanged ||
        hasTurtleChanged ||
        hasBeatChanged ||
        hasDepotChanged ||
        hasSwitchyardChanged
      ) {
        const currentPast = get().past;
        const newPast = [
          ...currentPast.slice(Math.max(0, currentPast.length - (MAX_HISTORY - 1))),
          initial,
        ];
        set({
          past: newPast,
          future: [],
          canUndo: true,
          canRedo: false,
        });
      }
    },

    clearHistory: () => {
      ctx.history.activeBatchSnapshot = null;
      set({
        past: [],
        future: [],
        canUndo: false,
        canRedo: false,
      });
    },
  };
}
