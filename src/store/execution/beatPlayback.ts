import { evaluateValue, tickInterpreter } from '../../engine/interpreter';
import type { BeatState } from '../../simulations/beat/types';
import { beatSynth } from '../../simulations/beat/beatSynth';
import type {
  StoreContext,
  StoreGet,
  StoreSet,
  VariantRunSnapshot,
} from '../types';
import {
  getPlaceholderPauseAnnouncement,
  isTerminalErrorStatus,
} from '../helpers/statusAndPerfHelpers';
import {
  hasWorkspaceLoopError,
  resolveActiveScopeFromRuntime,
} from '../helpers/workspaceHelpers';
import {
  computeInstantSimulation,
  getInitialBeatState,
  getSimEnvironment,
} from '../helpers/simStateHelpers';
import {
  buildActiveTickOptions,
  createStoreInitialRuntime,
  resetVariantRunsList,
} from '../helpers/curriculumHelpers';

export const isBeatSoundBlock = (actionType: string): boolean =>
  actionType === 'DRUM_KICK' ||
  actionType === 'DRUM_SNARE' ||
  actionType === 'DRUM_CLAP' ||
  actionType === 'PLAY_CHIME' ||
  actionType === 'PLAY_NOTE';

export function runBeatExecutionLoop(
  set: StoreSet,
  get: StoreGet,
  ctx: StoreContext
): void {
  const simEnv = getSimEnvironment('beat');
  if (!simEnv) return;

  let stepsInSyncBatch = 0;

  while (get().isPlaying) {
    const { runtime, workspace, beatState, speed } = get();
    const globalSpeedMs = typeof speed === 'number' && speed > 0 ? speed : 400;

    if (hasWorkspaceLoopError(workspace)) {
      set({ isPlaying: false });
      return;
    }

    const currentRuntime = runtime || createStoreInitialRuntime(get());
    if (
      (beatState.status as string) === 'SUCCESS' ||
      isTerminalErrorStatus(beatState.status) ||
      currentRuntime.callStack.length === 0
    ) {
      set({ isPlaying: false });
      return;
    }

    const currentFrame =
      currentRuntime.callStack[currentRuntime.callStack.length - 1];
    const currentBlock = (workspace[currentFrame.scope] || [])[currentFrame.pc];
    const wasSuccess =
      (beatState.status as string) === 'SUCCESS' ||
      (currentRuntime.status as string) === 'SUCCESS';
    const prevScope = get().activeScope;
    const prevBeatIndex = beatState.beatIndex;
    const tickOpts = buildActiveTickOptions(get());

    const res = tickInterpreter(
      currentRuntime,
      workspace,
      beatState,
      simEnv,
      tickOpts
    );
    const nextBeat = res.nextGrid as BeatState;

    if (nextBeat.beatIndex !== prevBeatIndex && !nextBeat.isMuted) {
      beatSynth.playEvent(nextBeat.lastTriggeredEvent, globalSpeedMs);
    }

    const activeScope = resolveActiveScopeFromRuntime(res.nextRuntime, prevScope);

    const isPausedOnPlaceholder = res.nextRuntime.status === 'PAUSED';

    set({
      runtime: res.nextRuntime,
      beatState: nextBeat,
      activeScope,
      ...(activeScope !== prevScope && activeScope !== 'MAIN'
        ? { isFunctionBarOpen: true }
        : {}),
      ...(isPausedOnPlaceholder
        ? {
            isPlaying: false,
            selectedBlockId: res.nextRuntime.activeBlockId,
            statusAnnouncement: getPlaceholderPauseAnnouncement(
              workspace,
              res.nextRuntime
            ),
          }
        : {}),
    });

    if (nextBeat.status === 'SUCCESS' || res.nextRuntime.status === 'SUCCESS') {
      const currentVariantRuns = get().variantRuns;
      if (currentVariantRuns.length > 1) {
        const freshRuns = resetVariantRunsList(currentVariantRuns, get());
        const evaluatedRuns: VariantRunSnapshot[] = freshRuns.map((v) => {
          const vBeat = v.beatState ?? beatState;
          const vRes = computeInstantSimulation(
            workspace,
            'beat',
            get().grid,
            get().turtleState,
            vBeat,
            get().depotState,
            get().switchyardState,
            tickOpts
          );
          return {
            ...v,
            status: vRes.status,
            runtime: {
              ...vRes.finalRuntime,
              activeBlockId: null,
              activeRepeatProgress: null,
            },
            beatState: vRes.finalState as BeatState,
          };
        });
        const allSucceeded = evaluatedRuns.every((v) => v.status === 'SUCCESS');
        const safeIdx = Math.min(
          Math.max(0, get().focusedVariantIndex),
          evaluatedRuns.length - 1
        );
        const firstFailIdx = evaluatedRuns.findIndex(
          (v) => v.status !== 'SUCCESS'
        );
        const safeStatus = evaluatedRuns[safeIdx]?.status;
        const nextFocusIdx =
          !allSucceeded && safeStatus === 'SUCCESS' && firstFailIdx >= 0
            ? firstFailIdx
            : safeIdx;
        const focused = evaluatedRuns[nextFocusIdx] ?? evaluatedRuns[0];
        set({
          variantRuns: evaluatedRuns,
          focusedVariantIndex: nextFocusIdx,
          ...(focused?.beatState ? { beatState: focused.beatState } : {}),
          ...(focused?.runtime ? { runtime: focused.runtime } : {}),
          isPlaying: false,
        });
        if (allSucceeded) {
          const reward = ctx.recordCurriculumSuccessIfApplicable();
          if (!wasSuccess) {
            ctx.triggerVictoryModal(reward?.newlyEarnedBadges ?? [], true);
          }
        }
        return;
      }
      const reward = ctx.recordCurriculumSuccessIfApplicable();
      if (!wasSuccess) {
        ctx.triggerVictoryModal(reward?.newlyEarnedBadges ?? [], true);
      }
      set({ isPlaying: false });
      return;
    }

    if (isPausedOnPlaceholder || isTerminalErrorStatus(nextBeat.status)) {
      set({ isPlaying: false });
      return;
    }

    let delayMs = 0;
    if (currentBlock) {
      if (isBeatSoundBlock(currentBlock.type)) {
        delayMs = beatSynth.getEventDurationMs(
          nextBeat.lastTriggeredEvent,
          globalSpeedMs
        );
      } else if (currentBlock.type === 'WAIT_BEAT') {
        const rawDur = currentBlock.params?.duration;
        const durUnits =
          rawDur !== undefined
            ? evaluateValue(
                rawDur,
                currentRuntime.variables,
                1,
                simEnv,
                beatState,
                tickOpts.sceneInput ?? currentRuntime.sceneInput
              )
            : 1;
        delayMs = Math.max(0, durUnits * globalSpeedMs);
      } else {
        delayMs = Math.max(0, nextBeat.stepDelayMultiplier * globalSpeedMs);
      }
    }

    if (delayMs > 0) {
      ctx.playback.beatPassHadDelay = true;
    }

    if (res.done) {
      ctx.recordCreativePlayCompletionIfApplicable(true);
      if (get().isLoopPlayback) {
        const hadDelay = ctx.playback.beatPassHadDelay;
        ctx.playback.beatPassHadDelay = false;
        const resetBeat = getInitialBeatState(nextBeat);
        set({
          beatState: resetBeat,
          runtime: null,
          isPlaying: true,
        });
        if (delayMs > 0 || !hadDelay) {
          const waitBeforeRestart = delayMs > 0 ? delayMs : 16;
          ctx.playback.timerId = setTimeout(() => {
            ctx.playback.timerId = null;
            if (get().isPlaying) runBeatExecutionLoop(set, get, ctx);
          }, waitBeforeRestart);
          return;
        }
        continue;
      }
      set({ isPlaying: false });
      return;
    }

    if (delayMs > 0) {
      ctx.playback.timerId = setTimeout(() => {
        ctx.playback.timerId = null;
        if (get().isPlaying) {
          runBeatExecutionLoop(set, get, ctx);
        }
      }, delayMs);
      return;
    }

    stepsInSyncBatch += 1;
    if (stepsInSyncBatch >= 2000) {
      ctx.playback.timerId = setTimeout(() => {
        ctx.playback.timerId = null;
        if (get().isPlaying) {
          runBeatExecutionLoop(set, get, ctx);
        }
      }, 0);
      return;
    }
  }
}
