import type { GridState, InterpreterRuntimeState } from '../../types';
import { createInitialInterpreterState } from '../../engine/interpreter';
import type { TurtleState } from '../../simulations/turtle/types';
import type { BeatState } from '../../simulations/beat/types';
import type { DepotState } from '../../simulations/depot/types';
import type { SwitchyardState } from '../../simulations/switchyard/types';
import type {
  StoreContext,
  StoreGet,
  StoreSet,
  VariantRunSnapshot,
} from '../types';
import { getPlaceholderPauseAnnouncement } from '../helpers/statusAndPerfHelpers';
import { computeInstantSimulation } from '../helpers/simStateHelpers';
import {
  buildActiveTickOptions,
  isExplanationActivity,
  resetVariantRunsList,
} from '../helpers/curriculumHelpers';

export function runInstantSimulationIfActive(
  set: StoreSet,
  get: StoreGet,
  ctx: StoreContext,
  options?: { allowVictoryModal?: boolean }
): void {
  const state = get();
  const {
    appMode,
    speed,
    workspace,
    activeSimId,
    grid,
    turtleState,
    beatState,
    depotState,
    switchyardState,
    variantRuns,
    focusedVariantIndex,
  } = state;
  if (speed !== 'instant' && (speed as any) !== 0) return;
  if (appMode === 'curriculum' && isExplanationActivity(state)) return;

  const tickOpts = buildActiveTickOptions(state);

  if (
    variantRuns.length > 1 &&
    (activeSimId === 'grid' ||
      activeSimId === 'depot' ||
      activeSimId === 'switchyard' ||
      activeSimId === 'beat')
  ) {
    const freshRuns = resetVariantRunsList(variantRuns, state);
    const evaluatedRuns: VariantRunSnapshot[] = freshRuns.map((v) => {
      const vGrid = activeSimId === 'grid' && v.gridState ? v.gridState : grid;
      const vDepot =
        activeSimId === 'depot' && v.depotState ? v.depotState : depotState;
      const vSwitchyard =
        activeSimId === 'switchyard' && v.switchyardState
          ? v.switchyardState
          : switchyardState;
      const vBeat =
        activeSimId === 'beat' && v.beatState ? v.beatState : beatState;
      const res = computeInstantSimulation(
        workspace,
        activeSimId,
        vGrid,
        turtleState,
        vBeat,
        vDepot,
        vSwitchyard,
        tickOpts
      );
      const isPausedOnPlaceholder = res.status === 'PAUSED';
      const vRuntime: InterpreterRuntimeState = {
        ...res.finalRuntime,
        activeBlockId: isPausedOnPlaceholder
          ? res.finalRuntime.activeBlockId
          : null,
        activeRepeatProgress: null,
      };
      return {
        ...v,
        status: res.status,
        runtime: vRuntime,
        ...(activeSimId === 'grid'
          ? { gridState: res.finalState as GridState }
          : activeSimId === 'depot'
          ? { depotState: res.finalState as DepotState }
          : activeSimId === 'beat'
          ? { beatState: res.finalState as BeatState }
          : { switchyardState: res.finalState as SwitchyardState }),
      };
    });

    const allSucceeded = evaluatedRuns.every((v) => v.status === 'SUCCESS');
    const safeIdx = Math.min(
      Math.max(0, focusedVariantIndex),
      evaluatedRuns.length - 1
    );
    const firstFailIdx = evaluatedRuns.findIndex((v) => v.status !== 'SUCCESS');
    const focusedStatus = evaluatedRuns[safeIdx]?.status;
    const nextFocusIdx =
      !allSucceeded && focusedStatus === 'SUCCESS' && firstFailIdx >= 0
        ? firstFailIdx
        : safeIdx;
    const focused = evaluatedRuns[nextFocusIdx] ?? evaluatedRuns[0];
    const focusedRuntime = focused?.runtime ?? createInitialInterpreterState();
    const isPausedOnPlaceholder = focusedRuntime.status === 'PAUSED';

    set({
      variantRuns: evaluatedRuns,
      focusedVariantIndex: nextFocusIdx,
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
      runtime: focusedRuntime,
      isPlaying: false,
      ghostPreview: null,
      ...(isPausedOnPlaceholder
        ? {
            activeScope: focusedRuntime.activeScope,
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
      if (options?.allowVictoryModal) {
        ctx.triggerVictoryModal(reward?.newlyEarnedBadges ?? [], false);
      }
    }
    ctx.markDemoTabExploredInternal(true);
    return;
  }

  const result = computeInstantSimulation(
    workspace,
    activeSimId,
    grid,
    turtleState,
    beatState,
    depotState,
    switchyardState,
    tickOpts
  );
  const isPausedOnPlaceholder = result.status === 'PAUSED';
  const nextRuntime: InterpreterRuntimeState = {
    ...result.finalRuntime,
    activeBlockId: isPausedOnPlaceholder
      ? result.finalRuntime.activeBlockId
      : null,
    activeRepeatProgress: null,
  };
  const pauseUpdates = isPausedOnPlaceholder
    ? {
        activeScope: result.finalRuntime.activeScope,
        selectedBlockId: result.finalRuntime.activeBlockId,
        statusAnnouncement: getPlaceholderPauseAnnouncement(
          workspace,
          result.finalRuntime
        ),
      }
    : {};

  if (activeSimId === 'grid') {
    set({
      grid: result.finalState as GridState,
      runtime: nextRuntime,
      isPlaying: false,
      ghostPreview: null,
      ...pauseUpdates,
    });
  } else if (activeSimId === 'beat') {
    set({
      beatState: {
        ...(result.finalState as BeatState),
        isMuted: beatState.isMuted,
      },
      runtime: nextRuntime,
      isPlaying: false,
      ghostPreview: null,
      ...pauseUpdates,
    });
  } else if (activeSimId === 'depot') {
    set({
      depotState: result.finalState as DepotState,
      runtime: nextRuntime,
      isPlaying: false,
      ghostPreview: null,
      ...pauseUpdates,
    });
  } else if (activeSimId === 'switchyard') {
    set({
      switchyardState: result.finalState as SwitchyardState,
      runtime: nextRuntime,
      isPlaying: false,
      ghostPreview: null,
      ...pauseUpdates,
    });
  } else {
    set({
      turtleState: result.finalState as TurtleState,
      runtime: nextRuntime,
      isPlaying: false,
      ghostPreview: null,
      ...pauseUpdates,
    });
  }

  if (result.status === 'SUCCESS' || result.finalRuntime.status === 'SUCCESS') {
    const reward = ctx.recordCurriculumSuccessIfApplicable();
    if (options?.allowVictoryModal) {
      ctx.triggerVictoryModal(reward?.newlyEarnedBadges ?? [], false);
    }
  }
  ctx.markDemoTabExploredInternal(true);
}
