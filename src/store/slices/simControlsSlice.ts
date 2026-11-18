import type { SimulationSpeed, WorkspaceState } from '../../types';
import { createInitialTurtleState } from '../../simulations/turtle/turtleEnvironment';
import { resetBeatState } from '../../simulations/beat/beatEnvironment';
import { beatSynth } from '../../simulations/beat/beatSynth';
import { ensureSimEnvironmentsRegistered } from '../../engine/simulationRunner';
import { saveSandboxAutosave } from '../../services/profileService';
import {
  cloneWorkspace,
  createEmptyWorkspace,
} from '../helpers/workspaceHelpers';
import type {
  SimControlsSliceActions,
  StoreContext,
  StoreGet,
  StoreSet,
} from '../types';

export function createSimControlsSlice(
  set: StoreSet,
  get: StoreGet,
  ctx: StoreContext
): SimControlsSliceActions {
  return {
    setSimEnvironment: (simId) => {
      ensureSimEnvironmentsRegistered();
      if (get().appMode === 'curriculum') {
        get().setAppMode('sandbox');
      }
      const { activeSimId, workspace, savedWorkspaces } = get();
      if (simId === activeSimId) return;

      get().clearHistory();
      get().reset();

      // Keep the code saved in memory associated with the source env
      const updatedSavedWorkspaces: Record<string, WorkspaceState> = {
        ...savedWorkspaces,
        [activeSimId]: cloneWorkspace(workspace),
      };
      saveSandboxAutosave(get().activeProfileId, activeSimId, workspace);

      // Restore any saved code for destination env or clear it
      const destinationWorkspace = updatedSavedWorkspaces[simId]
        ? cloneWorkspace(updatedSavedWorkspaces[simId])
        : createEmptyWorkspace();

      const curSpeed = get().speed;
      set({
        activeSimId: simId,
        savedWorkspaces: updatedSavedWorkspaces,
        workspace: destinationWorkspace,
        selectedBlockId: null,
        activeScope: 'MAIN',
        activeVariationInputConfig: null,
        sceneInput: undefined,
        ...(simId === 'beat' &&
        (curSpeed === 'instant' || (curSpeed as any) === 0)
          ? { speed: 400 as SimulationSpeed }
          : {}),
      });

      get().reset();
      get().runInstantIfActive();
    },

    updateTurtleViewport: (updates) => {
      set((state) => {
        const nextPan = updates.pan
          ? { ...state.turtleState.pan, ...updates.pan }
          : state.turtleState.pan;
        const nextZoom =
          updates.zoom !== undefined ? updates.zoom : state.turtleState.zoom;
        const nextFitToView =
          updates.fitToView !== undefined
            ? updates.fitToView
            : state.turtleState.fitToView;

        if (ctx.playback.pendingTurtleCommit) {
          ctx.playback.pendingTurtleCommit.finalTurtleState = {
            ...ctx.playback.pendingTurtleCommit.finalTurtleState,
            pan: { ...nextPan },
            zoom: nextZoom,
            fitToView: nextFitToView,
          };
        }

        return {
          turtleState: {
            ...state.turtleState,
            ...updates,
            pan: nextPan,
            zoom: nextZoom,
            fitToView: nextFitToView,
          },
        };
      });
    },

    clearTurtleCanvas: () => {
      ctx.recordMutation('Clear turtle canvas');
      get().reset();
      set({
        turtleState: createInitialTurtleState(),
      });
      get().runInstantIfActive();
    },

    toggleTurtleVisible: () =>
      set((state) => {
        const nextShowTurtle = !state.turtleState.showTurtle;
        if (ctx.playback.pendingTurtleCommit) {
          ctx.playback.pendingTurtleCommit.finalTurtleState = {
            ...ctx.playback.pendingTurtleCommit.finalTurtleState,
            showTurtle: nextShowTurtle,
          };
        }
        return {
          turtleState: {
            ...state.turtleState,
            showTurtle: nextShowTurtle,
          },
        };
      }),

    setBeatMuted: (muted) => {
      beatSynth.setMuted(muted);
      if (!muted) {
        beatSynth.unlockFromGesture();
      }
      set((state) => ({
        beatState: {
          ...state.beatState,
          isMuted: muted,
        },
      }));
    },

    toggleBeatMuted: () => {
      const nextMuted = !get().beatState.isMuted;
      get().setBeatMuted(nextMuted);
    },

    unlockBeatAudio: () => {
      beatSynth.unlockFromGesture();
    },

    clearBeatMatrix: () => {
      ctx.recordMutation('Clear Beat LED matrix');
      get().reset();
      set((state) => ({
        beatState: resetBeatState(state.beatState),
      }));
      get().runInstantIfActive();
    },

    setDepotState: (next) => {
      ctx.recordMutation('Update Depot state');
      set({ depotState: next, runtime: null, isPlaying: false });
      get().runInstantIfActive();
    },

    setSwitchyardState: (next) => {
      ctx.recordMutation('Update Switchyard state');
      set({ switchyardState: next, runtime: null, isPlaying: false });
      get().runInstantIfActive();
    },
  };
}
