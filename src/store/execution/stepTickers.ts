import type {
  GridState,
  SimulationSpeed,
  SimulationStatus,
} from '../../types';
import { tickInterpreter } from '../../engine/interpreter';
import { detectWorldItemTransition } from '../../simulations/grid/components/WorldItemsLayer';
import type { BeatState } from '../../simulations/beat/types';
import { beatSynth } from '../../simulations/beat/beatSynth';
import type { DepotState } from '../../simulations/depot/types';
import type { SwitchyardState } from '../../simulations/switchyard/types';
import { loadSwitchyardScanner } from '../../simulations/switchyard/physics';
import type {
  StoreContext,
  StoreGet,
  StoreSet,
  VariantRunSnapshot,
} from '../types';
import {
  getPlaceholderPauseAnnouncement,
  isTerminalErrorStatus,
  resolveTerminalStatus,
} from '../helpers/statusAndPerfHelpers';
import {
  hasWorkspaceLoopError,
  resolveActiveScopeFromRuntime,
} from '../helpers/workspaceHelpers';
import {
  cancelFrame,
  getSimEnvironment,
  mergeLiveTurtleViewState,
} from '../helpers/simStateHelpers';
import {
  areAllVariantsSucceeded,
  buildActiveTickOptions,
  createStoreInitialRuntime,
} from '../helpers/curriculumHelpers';
import { runTurtleExecutionLoop } from './turtlePlayback';

export function stepMultiVariantRuns(
  set: StoreSet,
  get: StoreGet,
  ctx: StoreContext
): void {
  const {
    activeSimId,
    variantRuns: currentVariants,
    runtime: prevRuntime,
    workspace,
    focusedVariantIndex,
    isPlaying,
    activeScope: prevScope,
  } = get();

  if (hasWorkspaceLoopError(workspace)) {
    return;
  }
  const simEnv = getSimEnvironment(activeSimId);
  if (!simEnv) return;

  if (
    activeSimId === 'switchyard' &&
    workspace.MAIN.length > 0 &&
    currentVariants.some(
      (v) =>
        !v.runtime &&
        v.switchyardState &&
        !v.switchyardState.scannerLoaded &&
        v.switchyardState.queue.length > 0 &&
        v.status !== 'SUCCESS' &&
        !isTerminalErrorStatus(v.status)
    )
  ) {
    const loadedVariants: VariantRunSnapshot[] = currentVariants.map((v) => {
      if (
        !v.runtime &&
        v.switchyardState &&
        !v.switchyardState.scannerLoaded &&
        v.switchyardState.queue.length > 0 &&
        v.status !== 'SUCCESS' &&
        !isTerminalErrorStatus(v.status)
      ) {
        return {
          ...v,
          status: 'RUNNING' as SimulationStatus,
          switchyardState: loadSwitchyardScanner(v.switchyardState),
        };
      }
      return v;
    });
    const safeIdx = Math.min(
      Math.max(0, focusedVariantIndex),
      loadedVariants.length - 1
    );
    const focused = loadedVariants[safeIdx] ?? loadedVariants[0];
    set({
      variantRuns: loadedVariants,
      focusedVariantIndex: safeIdx,
      ...(focused?.switchyardState
        ? { switchyardState: focused.switchyardState }
        : {}),
    });
    ctx.markDemoTabExploredInternal(true);
    return;
  }

  const wasAllSuccess = areAllVariantsSucceeded(currentVariants);
  let anyPaused = false;
  let allDone = true;

  const tickOpts = buildActiveTickOptions(get());
  const nextVariants: VariantRunSnapshot[] = currentVariants.map((v) => {
    const vState =
      activeSimId === 'grid'
        ? v.gridState
        : activeSimId === 'depot'
        ? v.depotState
        : activeSimId === 'beat'
        ? v.beatState
        : v.switchyardState;
    if (
      !vState ||
      v.status === 'SUCCESS' ||
      isTerminalErrorStatus(v.status)
    ) {
      return v;
    }
    const vRuntime = v.runtime || createStoreInitialRuntime(get());
    const res = tickInterpreter(vRuntime, workspace, vState, simEnv, tickOpts);
    const nextState = res.nextGrid as GridState &
      DepotState &
      SwitchyardState &
      BeatState;
    const paused = res.nextRuntime.status === 'PAUSED';
    if (paused) anyPaused = true;
    const resolvedStatus = resolveTerminalStatus(
      nextState.status,
      res.nextRuntime.status
    );
    const vStatus: SimulationStatus =
      resolvedStatus !== 'IDLE'
        ? resolvedStatus
        : paused
        ? 'PAUSED'
        : res.done
        ? nextState.status
        : 'RUNNING';
    const vDone =
      res.done || vStatus === 'SUCCESS' || isTerminalErrorStatus(vStatus);
    if (!vDone) allDone = false;
    return {
      ...v,
      status: vStatus,
      runtime: res.nextRuntime,
      ...(activeSimId === 'grid'
        ? { gridState: res.nextGrid as GridState }
        : activeSimId === 'depot'
        ? { depotState: res.nextGrid as DepotState }
        : activeSimId === 'beat'
        ? { beatState: res.nextGrid as BeatState }
        : { switchyardState: res.nextGrid as SwitchyardState }),
    };
  });

  const allSucceeded = nextVariants.every((v) => v.status === 'SUCCESS');
  const safeIdx = Math.min(
    Math.max(0, focusedVariantIndex),
    nextVariants.length - 1
  );
  const firstFailIdx = nextVariants.findIndex((v) => v.status !== 'SUCCESS');
  const safeStatus = nextVariants[safeIdx]?.status;
  const nextFocusIdx =
    allDone &&
    !allSucceeded &&
    !anyPaused &&
    safeStatus === 'SUCCESS' &&
    firstFailIdx >= 0
      ? firstFailIdx
      : safeIdx;
  const focused = nextVariants[nextFocusIdx] ?? nextVariants[0];
  const focusedRuntime =
    focused?.runtime ?? prevRuntime ?? createStoreInitialRuntime(get());
  const activeScope = resolveActiveScopeFromRuntime(focusedRuntime, prevScope);

  set({
    variantRuns: nextVariants,
    focusedVariantIndex: nextFocusIdx,
    runtime: focusedRuntime,
    ...(activeSimId === 'grid' && focused?.gridState
      ? { grid: focused.gridState }
      : {}),
    ...(activeSimId === 'depot' && focused?.depotState
      ? { depotState: focused.depotState }
      : {}),
    ...(activeSimId === 'switchyard' && focused?.switchyardState
      ? { switchyardState: focused.switchyardState }
      : {}),
    ...(activeSimId === 'beat' && focused?.beatState
      ? { beatState: focused.beatState }
      : {}),
    activeScope,
    ...(activeScope !== prevScope && activeScope !== 'MAIN'
      ? { isFunctionBarOpen: true }
      : {}),
    isPlaying: !allDone && !anyPaused && isPlaying,
    ...(anyPaused
      ? {
          selectedBlockId: focusedRuntime.activeBlockId,
          statusAnnouncement: getPlaceholderPauseAnnouncement(
            workspace,
            focusedRuntime
          ),
        }
      : {}),
  });

  if (allSucceeded) {
    const reward = ctx.recordCurriculumSuccessIfApplicable();
    if (!wasAllSuccess) {
      ctx.triggerVictoryModal(reward?.newlyEarnedBadges ?? [], true);
    }
  } else if (
    isPlaying &&
    allDone &&
    !anyPaused &&
    nextVariants.every((v) => !isTerminalErrorStatus(v.status))
  ) {
    ctx.recordCreativePlayCompletionIfApplicable(true);
  }

  if ((allDone || anyPaused) && ctx.playback.timerId) {
    clearTimeout(ctx.playback.timerId);
    ctx.playback.timerId = null;
    set({ isPlaying: false });
  }
  ctx.markDemoTabExploredInternal(true);
}

export function stepGridOnce(
  set: StoreSet,
  get: StoreGet,
  ctx: StoreContext
): void {
  const { runtime, workspace, grid } = get();

  // Guard: do not execute if loops are unclosed in any used workspace scope
  if (hasWorkspaceLoopError(workspace)) {
    return;
  }

  const currentRuntime = runtime || createStoreInitialRuntime(get());
  const simEnv = getSimEnvironment('grid');
  if (!simEnv) return;

  const wasSuccess =
    grid.status === 'SUCCESS' || currentRuntime.status === 'SUCCESS';
  const wasPlaying = get().isPlaying;

  const res = tickInterpreter(
    currentRuntime,
    workspace,
    grid,
    simEnv,
    buildActiveTickOptions(get())
  );

  // Auto switch active tab to current running scope if function called
  const activeScope = resolveActiveScopeFromRuntime(
    res.nextRuntime,
    get().activeScope
  );

  const isPausedOnPlaceholder = res.nextRuntime.status === 'PAUSED';
  const nextGridState = res.nextGrid as GridState;
  const worldTransition = !isPausedOnPlaceholder
    ? detectWorldItemTransition(grid, nextGridState)
    : null;

  set((prev) => ({
    runtime: res.nextRuntime,
    grid: nextGridState,
    activeScope,
    ...(activeScope !== prev.activeScope && activeScope !== 'MAIN'
      ? { isFunctionBarOpen: true }
      : {}),
    isPlaying: !res.done && !isPausedOnPlaceholder && prev.isPlaying,
    ...(isPausedOnPlaceholder
      ? {
          selectedBlockId: res.nextRuntime.activeBlockId,
          statusAnnouncement: getPlaceholderPauseAnnouncement(
            workspace,
            res.nextRuntime
          ),
        }
      : worldTransition?.announcement
      ? {
          statusAnnouncement:
            prev.statusAnnouncement === worldTransition.announcement
              ? `${worldTransition.announcement}\u00A0`
              : worldTransition.announcement,
        }
      : {}),
  }));

  if (
    nextGridState.status === 'SUCCESS' ||
    res.nextRuntime.status === 'SUCCESS'
  ) {
    const reward = ctx.recordCurriculumSuccessIfApplicable();
    if (!wasSuccess) {
      ctx.triggerVictoryModal(reward?.newlyEarnedBadges ?? [], true);
    }
  } else if (
    wasPlaying &&
    res.done &&
    !isPausedOnPlaceholder &&
    !isTerminalErrorStatus(nextGridState.status) &&
    !isTerminalErrorStatus(res.nextRuntime.status)
  ) {
    ctx.recordCreativePlayCompletionIfApplicable(true);
  }

  if ((res.done || isPausedOnPlaceholder) && ctx.playback.timerId) {
    clearTimeout(ctx.playback.timerId);
    ctx.playback.timerId = null;
    set({ isPlaying: false });
  }
  ctx.markDemoTabExploredInternal(true);
}

export function stepBeatOnce(
  set: StoreSet,
  get: StoreGet,
  ctx: StoreContext,
  speed: SimulationSpeed
): void {
  beatSynth.stopSource('preview');
  if (!get().isPlaying && !get().beatState.isMuted) {
    beatSynth.unlockFromGesture();
  }
  const { runtime, workspace, beatState } = get();

  if (hasWorkspaceLoopError(workspace)) {
    return;
  }

  const currentRuntime = runtime || createStoreInitialRuntime(get());
  const simEnv = getSimEnvironment('beat');
  if (!simEnv) return;

  const wasSuccess =
    beatState.status === 'SUCCESS' || currentRuntime.status === 'SUCCESS';
  const wasPlaying = get().isPlaying;
  const prevScope = get().activeScope;
  const prevBeatIndex = beatState.beatIndex;
  const res = tickInterpreter(
    currentRuntime,
    workspace,
    beatState,
    simEnv,
    buildActiveTickOptions(get())
  );
  const nextBeat = res.nextGrid as BeatState;

  if (nextBeat.beatIndex !== prevBeatIndex && !nextBeat.isMuted) {
    beatSynth.playEvent(nextBeat.lastTriggeredEvent, speed);
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
    isPlaying: !res.done && !isPausedOnPlaceholder && get().isPlaying,
    ...(isPausedOnPlaceholder
      ? {
          selectedBlockId: res.nextRuntime.activeBlockId,
          statusAnnouncement: getPlaceholderPauseAnnouncement(
            workspace,
            res.nextRuntime
          ),
        }
      : {}),
  });

  if (nextBeat.status === 'SUCCESS' || res.nextRuntime.status === 'SUCCESS') {
    const reward = ctx.recordCurriculumSuccessIfApplicable();
    if (!wasSuccess) {
      ctx.triggerVictoryModal(reward?.newlyEarnedBadges ?? [], true);
    }
  } else if (
    wasPlaying &&
    res.done &&
    !isPausedOnPlaceholder &&
    !isTerminalErrorStatus(nextBeat.status) &&
    !isTerminalErrorStatus(res.nextRuntime.status)
  ) {
    ctx.recordCreativePlayCompletionIfApplicable(true);
  }

  if ((res.done || isPausedOnPlaceholder) && ctx.playback.timerId) {
    clearTimeout(ctx.playback.timerId);
    ctx.playback.timerId = null;
    set({ isPlaying: false });
  }
  ctx.markDemoTabExploredInternal(true);
}

export function stepDepotOnce(
  set: StoreSet,
  get: StoreGet,
  ctx: StoreContext
): void {
  const { runtime, workspace, depotState } = get();

  if (hasWorkspaceLoopError(workspace)) {
    return;
  }

  const currentRuntime = runtime || createStoreInitialRuntime(get());
  const simEnv = getSimEnvironment('depot');
  if (!simEnv) return;

  const wasSuccess =
    depotState.status === 'SUCCESS' || currentRuntime.status === 'SUCCESS';
  const wasPlaying = get().isPlaying;

  const res = tickInterpreter(
    currentRuntime,
    workspace,
    depotState,
    simEnv,
    buildActiveTickOptions(get())
  );
  const activeScope = resolveActiveScopeFromRuntime(
    res.nextRuntime,
    get().activeScope
  );

  const isPausedOnPlaceholder = res.nextRuntime.status === 'PAUSED';
  const nextDepotState = res.nextGrid as DepotState;

  set((prev) => ({
    runtime: res.nextRuntime,
    depotState: nextDepotState,
    activeScope,
    ...(activeScope !== prev.activeScope && activeScope !== 'MAIN'
      ? { isFunctionBarOpen: true }
      : {}),
    isPlaying: !res.done && !isPausedOnPlaceholder && prev.isPlaying,
    ...(isPausedOnPlaceholder
      ? {
          selectedBlockId: res.nextRuntime.activeBlockId,
          statusAnnouncement: getPlaceholderPauseAnnouncement(
            workspace,
            res.nextRuntime
          ),
        }
      : nextDepotState.lastFailureReason &&
        isTerminalErrorStatus(nextDepotState.status)
      ? {
          statusAnnouncement: nextDepotState.lastFailureReason,
        }
      : {}),
  }));

  if (
    nextDepotState.status === 'SUCCESS' ||
    res.nextRuntime.status === 'SUCCESS'
  ) {
    const reward = ctx.recordCurriculumSuccessIfApplicable();
    if (!wasSuccess) {
      ctx.triggerVictoryModal(reward?.newlyEarnedBadges ?? [], true);
    }
  } else if (
    wasPlaying &&
    res.done &&
    !isPausedOnPlaceholder &&
    !isTerminalErrorStatus(nextDepotState.status) &&
    !isTerminalErrorStatus(res.nextRuntime.status)
  ) {
    ctx.recordCreativePlayCompletionIfApplicable(true);
  }

  if ((res.done || isPausedOnPlaceholder) && ctx.playback.timerId) {
    clearTimeout(ctx.playback.timerId);
    ctx.playback.timerId = null;
    set({ isPlaying: false });
  }
  ctx.markDemoTabExploredInternal(true);
}

export function stepSwitchyardOnce(
  set: StoreSet,
  get: StoreGet,
  ctx: StoreContext
): void {
  const { runtime, workspace, switchyardState } = get();

  if (hasWorkspaceLoopError(workspace)) {
    return;
  }

  if (
    workspace.MAIN.length > 0 &&
    runtime === null &&
    !switchyardState.scannerLoaded &&
    switchyardState.queue.length > 0 &&
    switchyardState.status !== 'SUCCESS' &&
    !isTerminalErrorStatus(switchyardState.status)
  ) {
    set({ switchyardState: loadSwitchyardScanner(switchyardState) });
    ctx.markDemoTabExploredInternal(true);
    return;
  }

  const currentRuntime = runtime || createStoreInitialRuntime(get());
  const simEnv = getSimEnvironment('switchyard');
  if (!simEnv) return;

  const wasSuccess =
    switchyardState.status === 'SUCCESS' || currentRuntime.status === 'SUCCESS';
  const wasPlaying = get().isPlaying;

  const res = tickInterpreter(
    currentRuntime,
    workspace,
    switchyardState,
    simEnv,
    buildActiveTickOptions(get())
  );
  const activeScope = resolveActiveScopeFromRuntime(
    res.nextRuntime,
    get().activeScope
  );

  const isPausedOnPlaceholder = res.nextRuntime.status === 'PAUSED';
  const nextSwitchyardState = res.nextGrid as SwitchyardState;

  set((prev) => ({
    runtime: res.nextRuntime,
    switchyardState: nextSwitchyardState,
    activeScope,
    ...(activeScope !== prev.activeScope && activeScope !== 'MAIN'
      ? { isFunctionBarOpen: true }
      : {}),
    isPlaying: !res.done && !isPausedOnPlaceholder && prev.isPlaying,
    ...(isPausedOnPlaceholder
      ? {
          selectedBlockId: res.nextRuntime.activeBlockId,
          statusAnnouncement: getPlaceholderPauseAnnouncement(
            workspace,
            res.nextRuntime
          ),
        }
      : nextSwitchyardState.lastFailureReason &&
        isTerminalErrorStatus(nextSwitchyardState.status)
      ? {
          statusAnnouncement: nextSwitchyardState.lastFailureReason,
        }
      : {}),
  }));

  if (
    nextSwitchyardState.status === 'SUCCESS' ||
    res.nextRuntime.status === 'SUCCESS'
  ) {
    const reward = ctx.recordCurriculumSuccessIfApplicable();
    if (!wasSuccess) {
      ctx.triggerVictoryModal(reward?.newlyEarnedBadges ?? [], true);
    }
  } else if (
    wasPlaying &&
    res.done &&
    !isPausedOnPlaceholder &&
    !isTerminalErrorStatus(nextSwitchyardState.status) &&
    !isTerminalErrorStatus(res.nextRuntime.status)
  ) {
    ctx.recordCreativePlayCompletionIfApplicable(true);
  }

  if ((res.done || isPausedOnPlaceholder) && ctx.playback.timerId) {
    clearTimeout(ctx.playback.timerId);
    ctx.playback.timerId = null;
    set({ isPlaying: false });
  }
  ctx.markDemoTabExploredInternal(true);
}

export function stepTurtleOnce(
  set: StoreSet,
  get: StoreGet,
  ctx: StoreContext
): void {
  // If an animation is currently active, snap-commit it first
  if (get().turtleState.activeAnimation && ctx.playback.pendingTurtleCommit) {
    if (ctx.playback.turtleRafId !== null) {
      cancelFrame(ctx.playback.turtleRafId);
      ctx.playback.turtleRafId = null;
    }
    const commit = ctx.playback.pendingTurtleCommit;
    ctx.playback.pendingTurtleCommit = null;
    const liveTurtle = get().turtleState;
    set({
      turtleState: mergeLiveTurtleViewState(commit.finalTurtleState, liveTurtle),
      runtime: commit.finalRuntime,
    });
    if (
      commit.finalTurtleState.status === 'SUCCESS' ||
      commit.finalRuntime.status === 'SUCCESS'
    ) {
      const reward = ctx.recordCurriculumSuccessIfApplicable();
      if (!commit.wasSuccessBefore) {
        ctx.triggerVictoryModal(reward?.newlyEarnedBadges ?? [], true);
      }
    }
    if (commit.isDone) {
      set({ isPlaying: false });
      return;
    }
  }

  runTurtleExecutionLoop(set, get, ctx, true);
  ctx.markDemoTabExploredInternal(true);
}
