import type { InterpreterRuntimeState } from '../../types';
import {
  createInitialInterpreterState,
  type InterpreterTickOptions,
} from '../../engine/interpreter';
import { createInitialDepotState } from '../../simulations/depot/depotPhysics';
import { createInitialSwitchyardState } from '../../simulations/switchyard/physics';
import { createCurriculumBeatState } from '../../simulations/beat/beatEnvironment';
import { beatSynth } from '../../simulations/beat/beatSynth';
import {
  type CurriculumActivity,
  CURRICULUM_MODULES,
  type SceneInputConfig,
  createCurriculumGridState,
  getActivityAtVersion,
  getActivityLatest,
  getActivityVariants,
  isValidatedPuzzleActivity,
} from '../../data/curriculum';
import { normalizeColorLiteralParam } from '../../utils/curriculumStagePolicy';
import { getProfileProgress } from '../../services/profileService';
import type { AppStateData, SimId, VariantRunSnapshot } from '../types';
import {
  getInitialBeatState,
  getInitialDepotState,
  getInitialGridState,
  getInitialSwitchyardState,
} from './simStateHelpers';

export const resolveCurriculumSimId = (simId?: string): SimId =>
  simId === 'turtle'
    ? 'turtle'
    : simId === 'beat'
    ? 'beat'
    : simId === 'depot'
    ? 'depot'
    : simId === 'switchyard'
    ? 'switchyard'
    : 'grid';

export const buildCompletedMap = (profileId: string): Record<string, boolean> => {
  const prog = getProfileProgress(profileId);
  const map: Record<string, boolean> = {};
  for (const k of Object.keys(prog.completedLessons)) {
    map[k] = true;
  }
  return map;
};

export const buildVariantRunsForActivity = (
  activity?: CurriculumActivity,
  fitToView = false
): VariantRunSnapshot[] => {
  if (!activity) return [];
  const variants = getActivityVariants(activity, activity.simId);
  if (variants.length <= 1) return [];
  return variants.map((v) => ({
    index: v.index,
    label: v.label,
    kind: v.kind,
    status: 'IDLE',
    ...(v.kind === 'grid' && v.grid
      ? { gridState: createCurriculumGridState(v.grid, fitToView) }
      : {}),
    ...(v.kind === 'depot' && v.depot
      ? { depotState: createInitialDepotState(v.depot) }
      : {}),
    ...(v.kind === 'switchyard' && v.switchyard
      ? { switchyardState: createInitialSwitchyardState(v.switchyard as any) }
      : {}),
    ...(v.kind === 'beat' && v.beat
      ? { beatState: createCurriculumBeatState(v.beat, beatSynth.isMuted()) }
      : {}),
    runtime: null,
  }));
};

export const resetVariantRunsList = (
  runs: VariantRunSnapshot[],
  liveState: Pick<AppStateData, 'grid' | 'beatState'>
): VariantRunSnapshot[] => {
  const liveShowTrace = liveState.grid.showTrace;
  const liveFitToView = liveState.grid.fitToView;
  const liveMuted = liveState.beatState.isMuted;
  return runs.map((v) => ({
    ...v,
    status: 'IDLE',
    runtime: null,
    ...(v.gridState
      ? {
          gridState: {
            ...getInitialGridState(v.gridState),
            showTrace: liveShowTrace,
            fitToView: liveFitToView,
          },
        }
      : {}),
    ...(v.depotState ? { depotState: getInitialDepotState(v.depotState) } : {}),
    ...(v.switchyardState
      ? { switchyardState: getInitialSwitchyardState(v.switchyardState) }
      : {}),
    ...(v.beatState
      ? {
          beatState: {
            ...getInitialBeatState(v.beatState),
            isMuted: liveMuted,
          },
        }
      : {}),
  }));
};

export const areAllVariantsSucceeded = (runs: VariantRunSnapshot[]): boolean =>
  runs.length <= 1 || runs.every((v) => v.status === 'SUCCESS');

export const resolveDefaultSceneInput = (
  cfg?: SceneInputConfig | null
): number | string | undefined => {
  if (!cfg || !cfg.options || cfg.options.length === 0) return undefined;
  const raw = cfg.previewInput !== undefined ? cfg.previewInput : cfg.options[0];
  if (cfg.mode === 'color') {
    return normalizeColorLiteralParam(raw);
  }
  return raw;
};

export const resolveActivityInitialInputConfig = (
  act?: CurriculumActivity,
  tabIndex: number = 0
): SceneInputConfig | null => {
  if (!act) return null;
  if (act.format === 'explanation' && act.demoTabs?.length) {
    const clampedIdx = Math.min(Math.max(0, tabIndex), act.demoTabs.length - 1);
    const tabCfg = act.demoTabs[clampedIdx]?.inputConfig;
    if (tabCfg) return tabCfg;
  }
  return act.inputConfig ?? null;
};

export const getActiveCurriculumActivity = (
  state: Pick<
    AppStateData,
    'appMode' | 'activeActivityId' | 'activeActivityVersion'
  >
): CurriculumActivity | undefined => {
  if (state.appMode !== 'curriculum') return undefined;
  return (
    getActivityAtVersion(state.activeActivityId, state.activeActivityVersion) ??
    getActivityLatest(state.activeActivityId)
  );
};

export const getEffectiveInputConfig = (
  state: Pick<
    AppStateData,
    | 'appMode'
    | 'activeActivityId'
    | 'activeActivityVersion'
    | 'activeVariationInputConfig'
    | 'activeDemoTabIndex'
  >,
  act: CurriculumActivity | undefined = getActiveCurriculumActivity(state)
): SceneInputConfig | null => {
  if (state.appMode !== 'curriculum' || !act) return null;
  if (state.activeVariationInputConfig) return state.activeVariationInputConfig;
  return resolveActivityInitialInputConfig(act, state.activeDemoTabIndex);
};

export const resolveActiveTabConfig = (
  state: Pick<AppStateData, 'activeDemoTabIndex' | 'activeSimId'>,
  activity?: CurriculumActivity,
  tabIndex = state.activeDemoTabIndex
) => {
  if (!activity) {
    return {
      tab: undefined,
      simId: state.activeSimId,
      gridDef: undefined,
      depotDef: undefined,
      switchyardDef: undefined,
      turtleDef: undefined,
      beatDef: undefined,
      beatRules: undefined,
      initialVars: undefined,
    };
  }
  const clampedIdx =
    activity.format === 'explanation' && activity.demoTabs?.length
      ? Math.min(Math.max(0, tabIndex), activity.demoTabs.length - 1)
      : 0;
  const tab =
    activity.format === 'explanation' ? activity.demoTabs?.[clampedIdx] : undefined;
  return {
    tab,
    simId: resolveCurriculumSimId(tab?.simId ?? activity.simId),
    gridDef:
      tab?.grid ??
      tab?.gridState ??
      activity.grid ??
      activity.gridVariants?.[0] ??
      activity.demoTabs?.[0]?.grid ??
      activity.demoTabs?.[0]?.gridState,
    depotDef:
      tab?.depot ??
      tab?.depotState ??
      activity.depot ??
      activity.depotVariants?.[0] ??
      activity.demoTabs?.[0]?.depot ??
      activity.demoTabs?.[0]?.depotState,
    switchyardDef:
      tab?.switchyard ??
      tab?.switchyardState ??
      activity.switchyard ??
      activity.switchyardVariants?.[0] ??
      activity.demoTabs?.[0]?.switchyard ??
      activity.demoTabs?.[0]?.switchyardState,
    turtleDef: tab?.turtle ?? activity.turtle,
    beatDef:
      tab?.beat ??
      activity.beat ??
      activity.beatVariants?.[0] ??
      activity.demoTabs?.[0]?.beat,
    beatRules: tab?.beatRules ?? activity.beatRules,
    initialVars: tab?.initialVars ?? activity.initialVars,
  };
};

export const buildActiveTickOptions = (
  state: Pick<
    AppStateData,
    | 'appMode'
    | 'activeActivityId'
    | 'activeActivityVersion'
    | 'activeDemoTabIndex'
    | 'activeSimId'
    | 'activeVariationInputConfig'
    | 'sceneInput'
    | 'randomSeed'
    | 'pointerState'
    | 'heldKeys'
  >
): InterpreterTickOptions => {
  const act = getActiveCurriculumActivity(state);
  const tabCfg = resolveActiveTabConfig(state, act, state.activeDemoTabIndex);
  const effectiveInputConfig = getEffectiveInputConfig(state, act);
  const effectiveSceneInput =
    state.sceneInput !== undefined
      ? state.sceneInput
      : resolveDefaultSceneInput(effectiveInputConfig);
  return {
    allowRecursion: act?.palette.allowRecursion !== false,
    seed: state.randomSeed,
    ...(effectiveSceneInput !== undefined ? { sceneInput: effectiveSceneInput } : {}),
    ...(tabCfg.initialVars ? { initialVars: tabCfg.initialVars } : {}),
    pointer: state.pointerState,
    heldKeys: new Set(state.heldKeys),
    isKeyHeld: (key) => {
      const norm = String(key).toUpperCase();
      return state.heldKeys.some((k) => String(k).toUpperCase() === norm);
    },
  };
};

export const createStoreInitialRuntime = (
  state: Pick<
    AppStateData,
    | 'appMode'
    | 'activeActivityId'
    | 'activeActivityVersion'
    | 'activeDemoTabIndex'
    | 'activeSimId'
    | 'randomSeed'
  >,
  seedOverride?: number
): InterpreterRuntimeState => {
  const act = getActiveCurriculumActivity(state);
  const tabCfg = resolveActiveTabConfig(state, act, state.activeDemoTabIndex);
  return createInitialInterpreterState(
    seedOverride ?? state.randomSeed,
    tabCfg.initialVars
  );
};

export const isExplanationActivity = (
  state: Pick<
    AppStateData,
    'appMode' | 'activeActivityId' | 'activeActivityVersion'
  >
): boolean => {
  const act = getActiveCurriculumActivity(state);
  return Boolean(act && act.format === 'explanation');
};

export const recordDemoTabViewedMap = (
  prev: Record<string, string[]>,
  activity: CurriculumActivity | undefined,
  tabIndex: number
): Record<string, string[]> => {
  if (!activity || activity.format !== 'explanation' || !activity.demoTabs?.length) {
    return prev;
  }
  const clampedIdx = Math.min(Math.max(0, tabIndex), activity.demoTabs.length - 1);
  const tab = activity.demoTabs[clampedIdx];
  if (!tab) return prev;
  const existing = prev[activity.id] ?? [];
  if (existing.includes(tab.id)) {
    return prev;
  }
  return {
    ...prev,
    [activity.id]: [...existing, tab.id],
  };
};

export const isCreativeCurriculumActivity = (
  act?: CurriculumActivity
): boolean =>
  Boolean(act) &&
  !isValidatedPuzzleActivity(act!) &&
  (act!.format === 'sandbox' ||
    act!.format === 'challenge' ||
    (act!.format === 'capstone' &&
      (act!.capstoneType === 'creative' ||
        (act!.capstoneType as string) === 'sandbox')));

export const formatEarnedBadgesAnnouncement = (
  earnedBadges: string[],
  act?: CurriculumActivity
): string | undefined => {
  if (earnedBadges.length === 0) return undefined;
  const badgeTitles = earnedBadges.map((badgeId) => {
    const mod = CURRICULUM_MODULES.find((m) => m.badgeId === badgeId);
    return mod ? `${mod.badgeTitle} (${mod.shortTitle})` : badgeId;
  });
  const actPrefix = act ? `Completed Activity ${act.id}: ${act.title}! ` : '';
  return `${actPrefix}Module Mastery Badge unlocked: ${badgeTitles.join(', ')}!`;
};
