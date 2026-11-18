import { isTypedValue, type SimulationStatus } from '../../types';
import { evaluateTypedValue, tickInterpreter } from '../../engine/interpreter';
import type { TurtleState } from '../../simulations/turtle/types';
import {
  createTurtleAnimation,
  interpolateAnimationPose,
  isTurtleAnimatedAction,
} from '../../simulations/turtle/physics';
import type { StoreContext, StoreGet, StoreSet } from '../types';
import {
  getPlaceholderPauseAnnouncement,
  isTerminalErrorStatus,
} from '../helpers/statusAndPerfHelpers';
import {
  hasWorkspaceLoopError,
  resolveActiveScopeFromRuntime,
} from '../helpers/workspaceHelpers';
import {
  cancelFrame,
  DEFAULT_RANDOM_SEED,
  getInitialTurtleState,
  getSimEnvironment,
  mergeLiveTurtleViewState,
  requestFrame,
} from '../helpers/simStateHelpers';
import {
  buildActiveTickOptions,
  createStoreInitialRuntime,
  getActiveCurriculumActivity,
  resolveActiveTabConfig,
} from '../helpers/curriculumHelpers';

export function stepTurtleAnimation(
  set: StoreSet,
  get: StoreGet,
  ctx: StoreContext,
  timestamp: number
): void {
  ctx.playback.turtleRafId = null;
  const { turtleState } = get();
  const anim = turtleState.activeAnimation;

  if (!anim || !ctx.playback.pendingTurtleCommit) {
    return;
  }

  const elapsed = timestamp - anim.startTime;
  const progress =
    anim.duration > 0
      ? elapsed >= anim.duration - 0.001
        ? 1
        : Math.min(1, Math.max(0, elapsed / anim.duration))
      : 1;

  if (progress < 1) {
    const { pose, currentSweep } = interpolateAnimationPose(anim, progress);
    set({
      turtleState: {
        ...turtleState,
        activeAnimation: {
          ...anim,
          currentPose: pose,
          progress,
          currentSweep,
        },
      },
    });
    ctx.playback.turtleRafId = requestFrame(
      (ts) => stepTurtleAnimation(set, get, ctx, ts),
      anim.duration,
      anim.startTime
    );
  } else {
    const commit = ctx.playback.pendingTurtleCommit;
    ctx.playback.pendingTurtleCommit = null;

    const completedTurtleState: TurtleState = mergeLiveTurtleViewState(
      commit.finalTurtleState,
      turtleState
    );

    if (commit.isDone || commit.isSingleStep) {
      if (
        commit.isDone &&
        !commit.isSingleStep &&
        get().isLoopPlayback &&
        completedTurtleState.status !== 'SUCCESS' &&
        commit.finalRuntime.status !== 'PAUSED' &&
        !isTerminalErrorStatus(completedTurtleState.status) &&
        !isTerminalErrorStatus(commit.finalRuntime.status)
      ) {
        ctx.recordCreativePlayCompletionIfApplicable(true);
        ctx.playback.turtlePassHadDelay = false;
        set({
          turtleState: getInitialTurtleState(completedTurtleState),
          runtime: null,
          isPlaying: true,
        });
        runTurtleExecutionLoop(set, get, ctx, false);
        return;
      }

      set({
        turtleState: completedTurtleState,
        runtime: commit.finalRuntime,
        isPlaying: false,
      });
      if (
        completedTurtleState.status === 'SUCCESS' ||
        commit.finalRuntime.status === 'SUCCESS'
      ) {
        const reward = ctx.recordCurriculumSuccessIfApplicable();
        if (!commit.wasSuccessBefore) {
          ctx.triggerVictoryModal(reward?.newlyEarnedBadges ?? [], true);
        }
      } else if (
        commit.isDone &&
        !commit.isSingleStep &&
        commit.finalRuntime.status !== 'PAUSED' &&
        !isTerminalErrorStatus(completedTurtleState.status) &&
        !isTerminalErrorStatus(commit.finalRuntime.status)
      ) {
        ctx.recordCreativePlayCompletionIfApplicable(true);
      }
    } else {
      set({
        turtleState: completedTurtleState,
        runtime: commit.finalRuntime,
      });
      if (
        completedTurtleState.status === 'SUCCESS' ||
        commit.finalRuntime.status === 'SUCCESS'
      ) {
        const reward = ctx.recordCurriculumSuccessIfApplicable();
        if (!commit.wasSuccessBefore) {
          ctx.triggerVictoryModal(reward?.newlyEarnedBadges ?? [], true);
        }
      }
      runTurtleExecutionLoop(set, get, ctx, false);
    }
  }
}

export function runTurtleExecutionLoop(
  set: StoreSet,
  get: StoreGet,
  ctx: StoreContext,
  isSingleStep: boolean
): void {
  const { speed, workspace } = get();
  if (speed === 'instant' || (speed as any) === 0) return;

  if (hasWorkspaceLoopError(workspace)) {
    set({ isPlaying: false });
    return;
  }

  const stateSnapshot = get();
  const activeAct = getActiveCurriculumActivity(stateSnapshot);
  const turtleCfg = resolveActiveTabConfig(
    stateSnapshot,
    activeAct,
    stateSnapshot.activeDemoTabIndex
  ).turtleDef;
  const isTurtleLiveMode = turtleCfg?.mode === 'live';
  const maxBatchStepsPerTick = isTurtleLiveMode ? 3000 : 2000;

  const currentTurtleState = get().turtleState;
  if (currentTurtleState.activeAnimation && ctx.playback.pendingTurtleCommit) {
    ctx.playback.pendingTurtleCommit.isSingleStep = isSingleStep;
    const anim = currentTurtleState.activeAnimation;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const resumedStartTime = now - anim.progress * anim.duration;

    set({
      isPlaying: !isSingleStep,
      turtleState: {
        ...currentTurtleState,
        activeAnimation: {
          ...anim,
          startTime: resumedStartTime,
        },
      },
    });

    if (ctx.playback.turtleRafId !== null) cancelFrame(ctx.playback.turtleRafId);
    ctx.playback.turtleRafId = requestFrame(
      (ts) => stepTurtleAnimation(set, get, ctx, ts),
      anim.duration,
      anim.startTime
    );
    return;
  }

  let runtime = get().runtime || createStoreInitialRuntime(get());
  let turtleState = get().turtleState;
  const simEnv = getSimEnvironment('turtle');
  if (!simEnv) return;

  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();

  while (true) {
    const hasPendingEvents = Boolean(
      runtime.eventQueue && runtime.eventQueue.length > 0
    );
    if (
      turtleState.status === 'SUCCESS' ||
      isTerminalErrorStatus(turtleState.status) ||
      isTerminalErrorStatus(runtime.status) ||
      (runtime.callStack.length === 0 && !hasPendingEvents)
    ) {
      set({ isPlaying: false });
      return;
    }

    // Fast-path pure-JS execution when Turtle instantMode or Turtle Live mode is active during play()
    if (!isSingleStep && (turtleState.instantMode || isTurtleLiveMode)) {
      let stepsInBatch = 0;
      let lastActiveScope = get().activeScope;

      while (true) {
        const pendingEv = Boolean(
          runtime.eventQueue && runtime.eventQueue.length > 0
        );
        if (
          (turtleState.status as string) === 'SUCCESS' ||
          isTerminalErrorStatus(turtleState.status) ||
          isTerminalErrorStatus(runtime.status) ||
          (runtime.callStack.length === 0 && !pendingEv)
        ) {
          set({
            runtime,
            turtleState,
            activeScope: lastActiveScope,
            isPlaying: false,
          });
          return;
        }

        const cf =
          runtime.callStack.length > 0
            ? runtime.callStack[runtime.callStack.length - 1]
            : undefined;
        const cb = cf ? (workspace[cf.scope] || [])[cf.pc] : undefined;
        if (cb && cb.type === 'WAIT') {
          // Commit batched instant state before handling timed WAIT animation
          set({ runtime, turtleState, activeScope: lastActiveScope });
          break;
        }

        const wasSuccessInstant =
          (turtleState.status as string) === 'SUCCESS' ||
          (runtime.status as string) === 'SUCCESS';
        const res = tickInterpreter(
          runtime,
          workspace,
          turtleState,
          simEnv,
          buildActiveTickOptions(get())
        );
        runtime = res.nextRuntime;
        turtleState = res.nextGrid as TurtleState;
        lastActiveScope = resolveActiveScopeFromRuntime(runtime, lastActiveScope);

        const isPausedOnPlaceholder = runtime.status === 'PAUSED';

        if (turtleState.status === 'SUCCESS' || runtime.status === 'SUCCESS') {
          set({
            runtime,
            turtleState,
            activeScope: lastActiveScope,
            isPlaying: false,
          });
          const reward = ctx.recordCurriculumSuccessIfApplicable();
          if (!wasSuccessInstant) {
            ctx.triggerVictoryModal(reward?.newlyEarnedBadges ?? [], true);
          }
          return;
        }

        if (isPausedOnPlaceholder) {
          set({
            runtime,
            turtleState,
            activeScope: lastActiveScope,
            isPlaying: false,
            selectedBlockId: runtime.activeBlockId,
            statusAnnouncement: getPlaceholderPauseAnnouncement(workspace, runtime),
          });
          return;
        }

        if (res.done) {
          const hasTermErr =
            isTerminalErrorStatus(turtleState.status) ||
            isTerminalErrorStatus(runtime.status);
          if (!hasTermErr) {
            ctx.recordCreativePlayCompletionIfApplicable(true);
          }
          if ((get().isLoopPlayback || isTurtleLiveMode) && !hasTermErr) {
            const hadDelay = ctx.playback.turtlePassHadDelay;
            ctx.playback.turtlePassHadDelay = false;
            const resetTurtle =
              turtleCfg?.clearBetweenFrames === false
                ? { ...turtleState, status: 'IDLE' as SimulationStatus }
                : getInitialTurtleState(turtleState);
            set({
              runtime: null,
              turtleState: resetTurtle,
              activeScope: 'MAIN',
              isPlaying: true,
            });
            if (!hadDelay) {
              ctx.playback.timerId = setTimeout(() => {
                ctx.playback.timerId = null;
                if (get().isPlaying) runTurtleExecutionLoop(set, get, ctx, false);
              }, 16);
              return;
            }
            runtime = createStoreInitialRuntime(get());
            turtleState = resetTurtle;
            break;
          }
          set({
            runtime,
            turtleState,
            activeScope: lastActiveScope,
            isPlaying: false,
          });
          return;
        }

        if (!turtleState.instantMode && !isTurtleLiveMode) {
          // Exited instant mode via SET_INSTANT('OFF')
          set({ runtime, turtleState, activeScope: lastActiveScope });
          break;
        }

        stepsInBatch += 1;
        if (stepsInBatch >= maxBatchStepsPerTick) {
          set({ runtime, turtleState, activeScope: lastActiveScope });
          ctx.playback.timerId = setTimeout(
            () => {
              ctx.playback.timerId = null;
              if (get().isPlaying) runTurtleExecutionLoop(set, get, ctx, false);
            },
            isTurtleLiveMode ? 16 : 0
          );
          return;
        }
      }
      if (
        runtime.callStack.length === 0 &&
        (!runtime.eventQueue || runtime.eventQueue.length === 0)
      ) {
        return;
      }
    }

    const currentFrame = runtime.callStack[runtime.callStack.length - 1];
    const scopeBlocks = workspace[currentFrame.scope] || [];
    const currentBlock = scopeBlocks[currentFrame.pc];

    const isAnimated = currentBlock && isTurtleAnimatedAction(currentBlock.type);
    const wasSuccess =
      (turtleState.status as string) === 'SUCCESS' ||
      (runtime.status as string) === 'SUCCESS';

    if (!isAnimated) {
      const res = tickInterpreter(
        runtime,
        workspace,
        turtleState,
        simEnv,
        buildActiveTickOptions(get())
      );
      runtime = res.nextRuntime;
      turtleState = res.nextGrid as TurtleState;

      const prevScope = get().activeScope;
      const activeScope = resolveActiveScopeFromRuntime(runtime, prevScope);

      const isPausedOnPlaceholder = runtime.status === 'PAUSED';
      set({
        runtime,
        turtleState,
        activeScope,
        ...(activeScope !== prevScope && activeScope !== 'MAIN'
          ? { isFunctionBarOpen: true }
          : {}),
        ...(isPausedOnPlaceholder
          ? {
              selectedBlockId: runtime.activeBlockId,
              statusAnnouncement: getPlaceholderPauseAnnouncement(
                workspace,
                runtime
              ),
            }
          : {}),
      });

      if (turtleState.status === 'SUCCESS' || runtime.status === 'SUCCESS') {
        const reward = ctx.recordCurriculumSuccessIfApplicable();
        if (!wasSuccess) {
          ctx.triggerVictoryModal(reward?.newlyEarnedBadges ?? [], true);
        }
      } else if (
        res.done &&
        !isSingleStep &&
        !isPausedOnPlaceholder &&
        !isTerminalErrorStatus(turtleState.status) &&
        !isTerminalErrorStatus(runtime.status)
      ) {
        ctx.recordCreativePlayCompletionIfApplicable(true);
      }

      if (res.done) {
        if (
          !isSingleStep &&
          get().isLoopPlayback &&
          !isPausedOnPlaceholder &&
          !isTerminalErrorStatus(turtleState.status) &&
          !isTerminalErrorStatus(runtime.status) &&
          turtleState.status !== 'SUCCESS'
        ) {
          const hadDelay = ctx.playback.turtlePassHadDelay;
          ctx.playback.turtlePassHadDelay = false;
          const resetTurtle = getInitialTurtleState(turtleState);
          set({
            runtime: null,
            turtleState: resetTurtle,
            activeScope: 'MAIN',
            isPlaying: true,
          });
          if (!hadDelay) {
            ctx.playback.timerId = setTimeout(() => {
              ctx.playback.timerId = null;
              if (get().isPlaying) runTurtleExecutionLoop(set, get, ctx, false);
            }, 16);
            return;
          }
          runtime = createStoreInitialRuntime(get());
          turtleState = resetTurtle;
          continue;
        }
        set({ isPlaying: false });
        return;
      }

      if (isSingleStep && currentBlock?.type === 'CLEAR_CANVAS') {
        set({ isPlaying: false });
        return;
      }

      continue;
    }

    const turtleTickOpts = buildActiveTickOptions(get());
    let previewSeed =
      runtime.randomSeed !== undefined
        ? runtime.randomSeed
        : (turtleTickOpts.seed ?? DEFAULT_RANDOM_SEED);
    const repPreview =
      currentBlock?.repeatCount !== undefined
        ? evaluateTypedValue(currentBlock.repeatCount, runtime.variables, 1, {
            simEnv,
            simState: turtleState,
            sceneInput: turtleTickOpts.sceneInput ?? runtime.sceneInput,
            pointer: turtleTickOpts.pointer,
            seed: previewSeed,
          })
        : { value: 1 };
    if (repPreview.nextSeed !== undefined) {
      previewSeed = repPreview.nextSeed;
    }
    const rawRepeats = isTypedValue(repPreview.value)
      ? typeof repPreview.value.value === 'number'
        ? repPreview.value.value
        : Number(repPreview.value.value)
      : typeof repPreview.value === 'number'
      ? repPreview.value
      : Number(repPreview.value);
    const totalRepeats = Math.round(Number.isFinite(rawRepeats) ? rawRepeats : 1);

    if (totalRepeats <= 0) {
      const res = tickInterpreter(
        runtime,
        workspace,
        turtleState,
        simEnv,
        turtleTickOpts
      );
      runtime = res.nextRuntime;
      turtleState = res.nextGrid as TurtleState;

      const prevScope = get().activeScope;
      const activeScope = resolveActiveScopeFromRuntime(runtime, prevScope);

      const isPausedOnPlaceholder = runtime.status === 'PAUSED';
      set({
        runtime,
        turtleState,
        activeScope,
        ...(activeScope !== prevScope && activeScope !== 'MAIN'
          ? { isFunctionBarOpen: true }
          : {}),
        ...(isPausedOnPlaceholder
          ? {
              selectedBlockId: runtime.activeBlockId,
              statusAnnouncement: getPlaceholderPauseAnnouncement(
                workspace,
                runtime
              ),
            }
          : {}),
      });

      if (turtleState.status === 'SUCCESS' || runtime.status === 'SUCCESS') {
        const reward = ctx.recordCurriculumSuccessIfApplicable();
        if (!wasSuccess) {
          ctx.triggerVictoryModal(reward?.newlyEarnedBadges ?? [], true);
        }
      } else if (
        res.done &&
        !isSingleStep &&
        !isPausedOnPlaceholder &&
        !isTerminalErrorStatus(turtleState.status) &&
        !isTerminalErrorStatus(runtime.status)
      ) {
        ctx.recordCreativePlayCompletionIfApplicable(true);
      }

      if (res.done) {
        if (
          !isSingleStep &&
          get().isLoopPlayback &&
          !isPausedOnPlaceholder &&
          !isTerminalErrorStatus(turtleState.status) &&
          !isTerminalErrorStatus(runtime.status) &&
          turtleState.status !== 'SUCCESS'
        ) {
          const hadDelay = ctx.playback.turtlePassHadDelay;
          ctx.playback.turtlePassHadDelay = false;
          const resetTurtle = getInitialTurtleState(turtleState);
          set({
            runtime: null,
            turtleState: resetTurtle,
            activeScope: 'MAIN',
            isPlaying: true,
          });
          if (!hadDelay) {
            ctx.playback.timerId = setTimeout(() => {
              ctx.playback.timerId = null;
              if (get().isPlaying) runTurtleExecutionLoop(set, get, ctx, false);
            }, 16);
            return;
          }
          runtime = createStoreInitialRuntime(get());
          turtleState = resetTurtle;
          continue;
        }
        set({ isPlaying: false });
        return;
      }

      if (isSingleStep && currentBlock?.type === 'CLEAR_CANVAS') {
        set({ isPlaying: false });
        return;
      }

      continue;
    }

    const fromPose = { ...turtleState.robot };
    const penDown = turtleState.penDown;
    const penColor = turtleState.penColor;
    const penWidth = turtleState.penWidth;

    const res = tickInterpreter(
      runtime,
      workspace,
      turtleState,
      simEnv,
      turtleTickOpts
    );
    const toPose = { ...(res.nextGrid as TurtleState).robot };

    const prevScope = get().activeScope;
    const activeScope = resolveActiveScopeFromRuntime(res.nextRuntime, prevScope);

    const resolvedParams: Record<string, any> = {};
    if (currentBlock?.params) {
      for (const [k, v] of Object.entries(currentBlock.params)) {
        if (
          typeof v === 'string' &&
          (/^[a-z]$/.test(v.trim()) || v.trim().startsWith('$'))
        ) {
          const paramRes = evaluateTypedValue(v, runtime.variables, 0, {
            simEnv,
            simState: turtleState,
            sceneInput: turtleTickOpts.sceneInput ?? runtime.sceneInput,
            pointer: turtleTickOpts.pointer,
            seed: previewSeed,
          });
          if (paramRes.nextSeed !== undefined) {
            previewSeed = paramRes.nextSeed;
          }
          resolvedParams[k] = isTypedValue(paramRes.value)
            ? paramRes.value.value
            : paramRes.value;
        } else {
          resolvedParams[k] = v;
        }
      }
    }

    const anim = createTurtleAnimation(
      currentBlock!.type,
      fromPose,
      toPose,
      penDown,
      penColor,
      penWidth,
      resolvedParams,
      speed,
      now
    );

    if (anim.duration === 0) {
      runtime = res.nextRuntime;
      turtleState = res.nextGrid as TurtleState;
      set({
        runtime,
        turtleState,
        activeScope,
        ...(activeScope !== prevScope && activeScope !== 'MAIN'
          ? { isFunctionBarOpen: true }
          : {}),
      });

      if (turtleState.status === 'SUCCESS' || runtime.status === 'SUCCESS') {
        const reward = ctx.recordCurriculumSuccessIfApplicable();
        if (!wasSuccess) {
          ctx.triggerVictoryModal(reward?.newlyEarnedBadges ?? [], true);
        }
      } else if (
        res.done &&
        !isSingleStep &&
        runtime.status !== 'PAUSED' &&
        !isTerminalErrorStatus(turtleState.status) &&
        !isTerminalErrorStatus(runtime.status)
      ) {
        ctx.recordCreativePlayCompletionIfApplicable(true);
      }

      if (res.done || isSingleStep) {
        if (
          res.done &&
          !isSingleStep &&
          get().isLoopPlayback &&
          runtime.status !== 'PAUSED' &&
          !isTerminalErrorStatus(turtleState.status) &&
          !isTerminalErrorStatus(runtime.status) &&
          turtleState.status !== 'SUCCESS'
        ) {
          const hadDelay = ctx.playback.turtlePassHadDelay;
          ctx.playback.turtlePassHadDelay = false;
          const resetTurtle = getInitialTurtleState(turtleState);
          set({
            runtime: null,
            turtleState: resetTurtle,
            activeScope: 'MAIN',
            isPlaying: true,
          });
          if (!hadDelay) {
            ctx.playback.timerId = setTimeout(() => {
              ctx.playback.timerId = null;
              if (get().isPlaying) runTurtleExecutionLoop(set, get, ctx, false);
            }, 16);
            return;
          }
          runtime = createStoreInitialRuntime(get());
          turtleState = resetTurtle;
          continue;
        }
        set({ isPlaying: false });
        return;
      }

      continue;
    }

    ctx.playback.turtlePassHadDelay = true;
    ctx.playback.pendingTurtleCommit = {
      finalTurtleState: res.nextGrid as TurtleState,
      finalRuntime: res.nextRuntime,
      isDone: res.done,
      isSingleStep,
      wasSuccessBefore: wasSuccess,
    };

    set({
      turtleState: {
        ...turtleState,
        activeAnimation: anim,
      },
      runtime: res.nextRuntime,
      activeScope,
      ...(activeScope !== prevScope && activeScope !== 'MAIN'
        ? { isFunctionBarOpen: true }
        : {}),
      isPlaying: !isSingleStep,
    });

    if (ctx.playback.turtleRafId !== null) cancelFrame(ctx.playback.turtleRafId);
    ctx.playback.turtleRafId = requestFrame(
      (ts) => stepTurtleAnimation(set, get, ctx, ts),
      anim.duration,
      anim.startTime
    );
    return;
  }
}
