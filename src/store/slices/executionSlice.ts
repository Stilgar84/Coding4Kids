import type { InterpreterRuntimeState, SimulationSpeed } from '../../types';
import { enqueueInterpreterEvent } from '../../engine/interpreter';
import { beatSynth } from '../../simulations/beat/beatSynth';
import { isInstantSpeedDisabled } from '../../utils/curriculumStagePolicy';
import {
  isCurrentSimSuccess,
  isTerminalErrorStatus,
} from '../helpers/statusAndPerfHelpers';
import {
  hasWorkspaceAnyBlocks,
  hasWorkspaceLoopError,
} from '../helpers/workspaceHelpers';
import {
  getInitialBeatState,
  getInitialDepotState,
  getInitialGridState,
  getInitialSwitchyardState,
  getInitialTurtleState,
  getSimStepIntervalMs,
  mergeLiveTurtleViewState,
} from '../helpers/simStateHelpers';
import {
  createStoreInitialRuntime,
  getActiveCurriculumActivity,
  resetVariantRunsList,
} from '../helpers/curriculumHelpers';
import { runBeatExecutionLoop } from '../execution/beatPlayback';
import { runTurtleExecutionLoop } from '../execution/turtlePlayback';
import { runInstantSimulationIfActive } from '../execution/instantRunner';
import {
  stepBeatOnce,
  stepDepotOnce,
  stepGridOnce,
  stepMultiVariantRuns,
  stepSwitchyardOnce,
  stepTurtleOnce,
} from '../execution/stepTickers';
import type {
  ExecutionSliceActions,
  StoreContext,
  StoreGet,
  StoreSet,
} from '../types';

export function createExecutionSlice(
  set: StoreSet,
  get: StoreGet,
  ctx: StoreContext
): ExecutionSliceActions {
  return {
    setSpeed: (speed) => {
      const prevSpeed = get().speed;
      const wasInstant = prevSpeed === 'instant' || (prevSpeed as any) === 0;
      let normalizedSpeed: SimulationSpeed =
        speed === 0 || speed === 'instant'
          ? 'instant'
          : (speed as SimulationSpeed);
      if (
        isInstantSpeedDisabled(
          get().appMode,
          get().activeSimId,
          getActiveCurriculumActivity(get())
        ) &&
        normalizedSpeed === 'instant'
      ) {
        normalizedSpeed = 400;
      }

      if (normalizedSpeed === 'instant') {
        ctx.cancelPlaybackTimers();
        if (ctx.playback.pendingTurtleCommit) {
          const liveTurtle = get().turtleState;
          set({
            turtleState: mergeLiveTurtleViewState(
              ctx.playback.pendingTurtleCommit.finalTurtleState,
              liveTurtle
            ),
            runtime: ctx.playback.pendingTurtleCommit.finalRuntime,
          });
          ctx.playback.pendingTurtleCommit = null;
        }
        beatSynth.stopAll();
        set({ speed: 'instant', isPlaying: false });
        get().runInstantIfActive();
      } else {
        set({ speed: normalizedSpeed });
        if (wasInstant) {
          get().reset();
        } else if (
          get().activeSimId === 'grid' ||
          get().activeSimId === 'beat' ||
          get().activeSimId === 'depot' ||
          get().activeSimId === 'switchyard'
        ) {
          if (get().isPlaying && ctx.playback.timerId) {
            clearTimeout(ctx.playback.timerId);
            ctx.playback.timerId = null;
            const scheduleTick = (delay: number) => {
              ctx.playback.timerId = setTimeout(() => {
                ctx.playback.timerId = null;
                if (!get().isPlaying) return;
                get().step();
                if (get().isPlaying) {
                  const nextDelay = getSimStepIntervalMs(
                    get().activeSimId,
                    get().speed
                  );
                  if (nextDelay > 0) {
                    scheduleTick(nextDelay);
                  }
                }
              }, delay);
            };
            const initialDelay = getSimStepIntervalMs(
              get().activeSimId,
              normalizedSpeed
            );
            if (initialDelay > 0) {
              scheduleTick(initialDelay);
            }
          }
        } else {
          // Turtle mode: dynamically scale remaining duration of active animation
          const { turtleState } = get();
          if (turtleState.activeAnimation && typeof prevSpeed === 'number') {
            const anim = turtleState.activeAnimation;
            const ratio = (normalizedSpeed as number) / prevSpeed;
            const newDuration = anim.duration * ratio;
            const now =
              typeof performance !== 'undefined' ? performance.now() : Date.now();
            const newStartTime = now - anim.progress * newDuration;
            set({
              turtleState: {
                ...turtleState,
                activeAnimation: {
                  ...anim,
                  duration: newDuration,
                  startTime: newStartTime,
                },
              },
            });
          }
        }
      }
    },

    runInstantIfActive: (options) => {
      runInstantSimulationIfActive(set, get, ctx, options);
    },

    step: () => {
      let { speed } = get();
      const { appMode, activeSimId } = get();
      if (speed === 'instant' || (speed as any) === 0) {
        if (
          isInstantSpeedDisabled(
            appMode,
            activeSimId,
            getActiveCurriculumActivity(get())
          )
        ) {
          set({ speed: 400 });
          speed = 400;
        } else {
          return;
        }
      }

      if (!get().isPlaying && !get().beatState.isMuted) {
        beatSynth.unlockFromGesture();
      }

      if (get().ghostPreview) {
        set({ ghostPreview: null });
      }

      if (
        (activeSimId === 'grid' ||
          activeSimId === 'depot' ||
          activeSimId === 'switchyard' ||
          activeSimId === 'beat') &&
        get().variantRuns.length > 1
      ) {
        stepMultiVariantRuns(set, get, ctx);
        return;
      }

      if (activeSimId === 'grid') {
        stepGridOnce(set, get, ctx);
      } else if (activeSimId === 'beat') {
        stepBeatOnce(set, get, ctx, speed);
      } else if (activeSimId === 'depot') {
        stepDepotOnce(set, get, ctx);
      } else if (activeSimId === 'switchyard') {
        stepSwitchyardOnce(set, get, ctx);
      } else {
        stepTurtleOnce(set, get, ctx);
      }
    },

    play: () => {
      const { appMode, speed, workspace, activeSimId } = get();
      if (get().ghostPreview) {
        set({ ghostPreview: null });
      }
      if (
        isInstantSpeedDisabled(
          appMode,
          activeSimId,
          getActiveCurriculumActivity(get())
        ) &&
        (speed === 'instant' || (speed as any) === 0)
      ) {
        set({ speed: 400 });
      }
      const effectiveSpeed = get().speed;
      if (effectiveSpeed === 'instant' || (effectiveSpeed as any) === 0) {
        ctx.cancelPlaybackTimers();
        beatSynth.stopAll();
        if (hasWorkspaceLoopError(workspace)) {
          return;
        }
        const wasSuccess = isCurrentSimSuccess(get());
        set({ isVictoryModalOpen: false, victoryEarnedBadges: [] });
        get().runInstantIfActive({ allowVictoryModal: !wasSuccess });
        if (
          !isCurrentSimSuccess(get()) &&
          get().runtime?.status !== 'PAUSED' &&
          (activeSimId === 'grid'
            ? !isTerminalErrorStatus(get().grid.status)
            : activeSimId === 'beat'
            ? !isTerminalErrorStatus(get().beatState.status)
            : activeSimId === 'depot'
            ? !isTerminalErrorStatus(get().depotState.status)
            : activeSimId === 'switchyard'
            ? !isTerminalErrorStatus(get().switchyardState.status)
            : !isTerminalErrorStatus(get().turtleState.status))
        ) {
          ctx.recordCreativePlayCompletionIfApplicable(false);
        }
        return;
      }

      beatSynth.stopSource('preview');
      if (!get().beatState.isMuted) {
        beatSynth.unlockFromGesture();
      }

      if (get().isPlaying) return;

      set({ isVictoryModalOpen: false, victoryEarnedBadges: [] });

      const {
        grid,
        turtleState,
        beatState,
        depotState,
        switchyardState,
        runtime,
      } = get();
      const currentSimState =
        activeSimId === 'grid'
          ? grid
          : activeSimId === 'beat'
          ? beatState
          : activeSimId === 'depot'
          ? depotState
          : activeSimId === 'switchyard'
          ? switchyardState
          : turtleState;
      const hasQueuedEvents = Boolean(
        runtime?.eventQueue && runtime.eventQueue.length > 0
      );
      const hasEndedOrFail =
        !hasQueuedEvents &&
        (currentSimState.status === 'SUCCESS' ||
          isTerminalErrorStatus(currentSimState.status) ||
          (runtime !== null && runtime.callStack.length === 0) ||
          (get().variantRuns.length > 1 &&
            get().variantRuns.every(
              (v) => v.status === 'SUCCESS' || isTerminalErrorStatus(v.status)
            )));

      if (hasEndedOrFail) {
        get().reset();
      }

      // Guard: do not execute if loops are unclosed in any used workspace scope
      if (hasWorkspaceLoopError(workspace)) {
        return;
      }

      if (
        activeSimId === 'grid' ||
        activeSimId === 'depot' ||
        activeSimId === 'switchyard'
      ) {
        if (ctx.playback.timerId) {
          clearTimeout(ctx.playback.timerId);
          ctx.playback.timerId = null;
        }
        set({ isPlaying: true });

        // Run immediate first step
        get().step();
        if (!get().isPlaying) {
          return;
        }

        const scheduleNextTick = (delayMs: number) => {
          ctx.playback.timerId = setTimeout(() => {
            ctx.playback.timerId = null;
            if (!get().isPlaying) {
              return;
            }
            get().step();
            if (get().isPlaying) {
              const nextDelay = getSimStepIntervalMs(
                get().activeSimId,
                get().speed
              );
              if (nextDelay > 0) {
                scheduleNextTick(nextDelay);
              }
            }
          }, delayMs);
        };

        const initialDelay = getSimStepIntervalMs(activeSimId, get().speed);
        if (initialDelay > 0) {
          scheduleNextTick(initialDelay);
        }
      } else if (activeSimId === 'beat') {
        if (ctx.playback.timerId) {
          clearTimeout(ctx.playback.timerId);
          ctx.playback.timerId = null;
        }
        ctx.playback.beatPassHadDelay = false;
        set({ isPlaying: true });
        runBeatExecutionLoop(set, get, ctx);
        ctx.markDemoTabExploredInternal(true);
      } else {
        // Turtle runner: RAF-driven constant speed loop
        ctx.playback.turtlePassHadDelay = false;
        set({ isPlaying: true });
        runTurtleExecutionLoop(set, get, ctx, false);
        ctx.markDemoTabExploredInternal(true);
      }
    },

    pause: () => {
      ctx.cancelPlaybackTimers();
      if (ctx.playback.pendingTurtleCommit) {
        ctx.playback.pendingTurtleCommit.isSingleStep = false;
      }
      beatSynth.stopAll();
      set({ isPlaying: false });
    },

    reset: () => {
      ctx.cancelPlaybackTimers();
      ctx.playback.pendingTurtleCommit = null;
      ctx.playback.turtlePassHadDelay = false;
      ctx.playback.beatPassHadDelay = false;
      beatSynth.stopAll();

      const liveState = get();
      const {
        grid,
        turtleState,
        beatState,
        depotState,
        switchyardState,
        activeSimId,
        variantRuns,
        focusedVariantIndex,
      } = liveState;
      const resetVariants =
        variantRuns.length > 1
          ? resetVariantRunsList(variantRuns, liveState)
          : variantRuns;
      const nextFocusedVariantIndex =
        resetVariants.length > 1
          ? Math.min(Math.max(0, focusedVariantIndex), resetVariants.length - 1)
          : 0;
      const activeVariant =
        resetVariants.length > 1
          ? resetVariants[nextFocusedVariantIndex]
          : undefined;

      if (activeSimId === 'grid') {
        set({
          isPlaying: false,
          runtime: null,
          ghostPreview: null,
          isVictoryModalOpen: false,
          victoryEarnedBadges: [],
          variantRuns: resetVariants,
          focusedVariantIndex: nextFocusedVariantIndex,
          grid: activeVariant?.gridState ?? getInitialGridState(grid),
        });
      } else if (activeSimId === 'beat') {
        set({
          isPlaying: false,
          runtime: null,
          isVictoryModalOpen: false,
          victoryEarnedBadges: [],
          variantRuns: resetVariants,
          focusedVariantIndex: nextFocusedVariantIndex,
          beatState: activeVariant?.beatState ?? getInitialBeatState(beatState),
        });
      } else if (activeSimId === 'depot') {
        set({
          isPlaying: false,
          runtime: null,
          ghostPreview: null,
          isVictoryModalOpen: false,
          victoryEarnedBadges: [],
          variantRuns: resetVariants,
          focusedVariantIndex: nextFocusedVariantIndex,
          depotState:
            activeVariant?.depotState ?? getInitialDepotState(depotState),
        });
      } else if (activeSimId === 'switchyard') {
        set({
          isPlaying: false,
          runtime: null,
          ghostPreview: null,
          isVictoryModalOpen: false,
          victoryEarnedBadges: [],
          variantRuns: resetVariants,
          focusedVariantIndex: nextFocusedVariantIndex,
          switchyardState:
            activeVariant?.switchyardState ??
            getInitialSwitchyardState(switchyardState),
        });
      } else {
        set({
          isPlaying: false,
          runtime: null,
          ghostPreview: null,
          isVictoryModalOpen: false,
          victoryEarnedBadges: [],
          variantRuns: resetVariants,
          focusedVariantIndex: nextFocusedVariantIndex,
          turtleState: getInitialTurtleState(turtleState),
        });
      }
    },

    setLoopPlayback: (loop) => set({ isLoopPlayback: loop }),

    toggleLoopPlayback: () =>
      set((state) => ({ isLoopPlayback: !state.isLoopPlayback })),

    setRandomSeed: (seed) => set({ randomSeed: Math.trunc(seed) }),

    rerollRandomSeed: () => {
      const prevSeed = get().randomSeed;
      const prevWorkspace = get().workspace;
      let nextSeed = Math.floor(Math.random() * 999_999) + 1;
      if (nextSeed === prevSeed) {
        nextSeed = (Math.abs(Math.trunc(prevSeed)) % 999_999) + 1;
      }

      get().pause();
      if (
        get().activeSimId === 'turtle' &&
        get().turtleState.status === 'RUNNING'
      ) {
        set({
          turtleState: {
            ...get().turtleState,
            status: 'IDLE',
          },
        });
      }
      get().reset();
      set({
        randomSeed: nextSeed,
        runtime: null,
        statusAnnouncement: 'New random seed',
      });
      if (
        hasWorkspaceAnyBlocks(prevWorkspace) &&
        !hasWorkspaceLoopError(prevWorkspace)
      ) {
        get().play();
      }
      return nextSeed;
    },

    setKeyHeld: (key, held) =>
      set((state) => {
        const norm = String(key).toUpperCase();
        const exists = state.heldKeys.includes(norm);
        if (held && !exists) {
          return { heldKeys: [...state.heldKeys, norm] };
        }
        if (!held && exists) {
          return { heldKeys: state.heldKeys.filter((k) => k !== norm) };
        }
        return state;
      }),

    setPointerState: (updates) =>
      set((state) => ({
        pointerState: { ...state.pointerState, ...updates },
      })),

    enqueueInteractiveEvent: (eventScope) => {
      const state = get();
      const handlerBlocks = state.workspace[eventScope];
      if (!handlerBlocks || handlerBlocks.length === 0) return;

      const curRuntime = state.runtime;
      if (curRuntime && isTerminalErrorStatus(curRuntime.status)) {
        return;
      }

      const baseRuntime = curRuntime ?? createStoreInitialRuntime(state);
      const queuedRuntime = enqueueInterpreterEvent(
        curRuntime
          ? baseRuntime
          : { ...baseRuntime, callStack: [], status: 'IDLE' },
        eventScope
      );
      const awakenedRuntime: InterpreterRuntimeState =
        queuedRuntime.callStack.length === 0
          ? { ...queuedRuntime, status: 'RUNNING' }
          : queuedRuntime;

      set({ runtime: awakenedRuntime });
      if (!get().isPlaying) {
        get().play();
      }
    },
  };
}
