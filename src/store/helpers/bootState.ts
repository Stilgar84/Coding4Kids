import type { ScopeType } from '../../types';
import { normalizeInitialVariables } from '../../engine/interpreter';
import { createInitialTurtleState } from '../../simulations/turtle/turtleEnvironment';
import {
  createCurriculumBeatState,
  createInitialBeatState,
} from '../../simulations/beat/beatEnvironment';
import { beatSynth } from '../../simulations/beat/beatSynth';
import { createInitialDepotState } from '../../simulations/depot/depotPhysics';
import { createInitialSwitchyardState } from '../../simulations/switchyard/physics';
import {
  type AppMode,
  CURRICULUM_ACTIVITIES,
  CURRICULUM_MODULES,
  createCurriculumGridState,
  getActivityLatest,
} from '../../data/curriculum';
import {
  ensureProfilesInitialized,
  getModuleIdVariants,
  getProfileLessonWorkspaces,
  getProfileProgress,
  getProfileSandboxWorkspaces,
} from '../../services/profileService';
import type { AppStateData, SimId } from '../types';
import { loadPersistedPerformanceMode } from './statusAndPerfHelpers';
import {
  cloneWorkspace,
  cloneWorkspaceWithFreshIds,
  createEmptyWorkspace,
} from './workspaceHelpers';
import {
  createCurriculumTurtleState,
  createGridFromPreset,
  DEFAULT_RANDOM_SEED,
  initialPreset,
} from './simStateHelpers';
import {
  buildCompletedMap,
  buildVariantRunsForActivity,
  recordDemoTabViewedMap,
  resolveActivityInitialInputConfig,
  resolveCurriculumSimId,
  resolveDefaultSceneInput,
} from './curriculumHelpers';

export function computeInitialBootState(): AppStateData {
  const defaultActivity = CURRICULUM_ACTIVITIES[0];

  const bootProfilesState = ensureProfilesInitialized();
  const bootActiveProfileId = bootProfilesState.activeProfileId;
  const bootCurriculumAutosaves = getProfileLessonWorkspaces(bootActiveProfileId);
  const bootSandboxAutosaves = getProfileSandboxWorkspaces(bootActiveProfileId);

  const bootProgress = getProfileProgress(bootActiveProfileId);
  const bootCompletedMap = buildCompletedMap(bootActiveProfileId);

  let bootMode: AppMode = 'curriculum';
  let bootActivity =
    CURRICULUM_ACTIVITIES.find(
      (a) =>
        !bootCompletedMap[a.id] &&
        (Boolean(bootProgress.unlockAllModules) ||
          a.moduleId === 'seq' ||
          a.moduleId === 'module-1' ||
          a.moduleId === CURRICULUM_MODULES[0]?.id ||
          getModuleIdVariants(a.moduleId).some((id) =>
            bootProgress.unlockedModules.includes(id)
          ))
    ) ?? defaultActivity;

  if (typeof window !== 'undefined' && window.location?.search) {
    try {
      const params = new URLSearchParams(window.location.search);
      const modeParam = params.get('mode')?.toLowerCase();
      if (modeParam === 'sandbox' || modeParam === 'freeplay') {
        bootMode = 'sandbox';
      } else if (modeParam === 'curriculum' || modeParam === 'learn') {
        bootMode = 'curriculum';
      }
      const activityParam = params.get('activity');
      if (activityParam) {
        const found = getActivityLatest(activityParam);
        if (found) {
          bootActivity = found;
        }
      }
    } catch {
      // Ignore malformed query string
    }
  }

  const bootTab0 =
    bootActivity?.format === 'explanation' ? bootActivity?.demoTabs?.[0] : undefined;
  const bootGridDef =
    bootTab0?.grid ??
    bootTab0?.gridState ??
    bootActivity?.grid ??
    bootActivity?.gridVariants?.[0] ??
    bootActivity?.demoTabs?.[0]?.grid ??
    bootActivity?.demoTabs?.[0]?.gridState;
  const initialGrid =
    bootMode === 'curriculum' && bootGridDef
      ? createCurriculumGridState(bootGridDef)
      : createGridFromPreset(initialPreset);

  const bootSimId: SimId =
    bootMode === 'curriculum'
      ? resolveCurriculumSimId(bootTab0?.simId ?? bootActivity?.simId)
      : 'grid';

  const bootDepotDef =
    bootTab0?.depot ??
    bootTab0?.depotState ??
    bootActivity?.depot ??
    bootActivity?.depotVariants?.[0] ??
    bootActivity?.demoTabs?.[0]?.depot ??
    bootActivity?.demoTabs?.[0]?.depotState;
  const bootSwitchyardDef =
    bootTab0?.switchyard ??
    bootTab0?.switchyardState ??
    bootActivity?.switchyard ??
    bootActivity?.switchyardVariants?.[0] ??
    bootActivity?.demoTabs?.[0]?.switchyard ??
    bootActivity?.demoTabs?.[0]?.switchyardState;
  const bootTurtleDef = bootTab0?.turtle ?? bootActivity?.turtle;
  const bootBeatDef =
    bootTab0?.beat ??
    bootActivity?.beat ??
    bootActivity?.beatVariants?.[0] ??
    bootActivity?.demoTabs?.[0]?.beat;
  const bootBeatRules = bootTab0?.beatRules ?? bootActivity?.beatRules;
  const bootInitialVars = bootTab0?.initialVars ?? bootActivity?.initialVars;

  const initialWorkspace =
    bootMode === 'curriculum'
      ? bootActivity && bootCurriculumAutosaves[bootActivity.id]
        ? cloneWorkspace(bootCurriculumAutosaves[bootActivity.id])
        : bootActivity?.starterWorkspace
        ? cloneWorkspaceWithFreshIds(bootActivity.starterWorkspace)
        : bootActivity?.demoTabs?.[0]?.workspace
        ? cloneWorkspaceWithFreshIds(bootActivity.demoTabs[0].workspace)
        : createEmptyWorkspace()
      : bootSandboxAutosaves[bootSimId]
      ? cloneWorkspace(bootSandboxAutosaves[bootSimId])
      : createEmptyWorkspace();

  const bootAllowedScopes: ScopeType[] =
    bootMode === 'curriculum' &&
    bootActivity?.palette.allowedScopes &&
    bootActivity.palette.allowedScopes.length > 0
      ? bootActivity.palette.allowedScopes
      : ['MAIN'];
  const bootInitialScope: ScopeType = bootAllowedScopes.includes('MAIN')
    ? 'MAIN'
    : bootAllowedScopes[0];
  const bootOpenFuncBar =
    bootMode === 'curriculum' && bootAllowedScopes.some((sc) => sc !== 'MAIN');

  return {
    profiles: bootProfilesState.profiles,
    activeProfileId: bootActiveProfileId,
    isProfileModalOpen: false,
    isBadgeModalOpen: false,
    unlockAllModules: Boolean(getProfileProgress(bootActiveProfileId).unlockAllModules),
    completedActivities: bootCompletedMap,

    appMode: bootMode,
    activeActivityId: bootActivity?.id || 'seq.0',
    activeActivityVersion: bootActivity?.version || 1,
    activeDemoTabIndex: 0,
    demoTabIndexByActivity: {},
    exploredDemoTabs: {},
    viewedDemoTabs:
      bootMode === 'curriculum' ? recordDemoTabViewedMap({}, bootActivity, 0) : {},
    curriculumWorkspaces:
      bootMode === 'curriculum' && bootActivity
        ? { ...bootCurriculumAutosaves, [bootActivity.id]: cloneWorkspace(initialWorkspace) }
        : bootCurriculumAutosaves,
    sandboxSnapshot: null,
    pendingVersionMismatch: null,
    statusAnnouncement: '',
    ghostPreview: null,
    slotCapRejectionCount: 0,
    lastSlotCapRejectedAt: null,
    variantRuns:
      bootMode === 'curriculum' ? buildVariantRunsForActivity(bootActivity, false) : [],
    focusedVariantIndex: 0,
    activeVariationInputConfig: null,
    sceneInput:
      bootMode === 'curriculum'
        ? resolveDefaultSceneInput(resolveActivityInitialInputConfig(bootActivity, 0))
        : undefined,

    activeSimId: bootSimId,
    currentLevel: 1,
    grid: initialGrid,
    turtleState:
      bootMode === 'curriculum'
        ? createCurriculumTurtleState(bootTurtleDef)
        : createInitialTurtleState(),
    beatState:
      bootMode === 'curriculum' && bootBeatDef
        ? createCurriculumBeatState(bootBeatDef, beatSynth.isMuted())
        : createInitialBeatState(beatSynth.isMuted()),
    depotState:
      bootMode === 'curriculum' && bootDepotDef
        ? createInitialDepotState(bootDepotDef)
        : createInitialDepotState(),
    switchyardState:
      bootMode === 'curriculum' && bootSwitchyardDef
        ? createInitialSwitchyardState(bootSwitchyardDef as any)
        : createInitialSwitchyardState(),
    activeVariables:
      bootMode === 'curriculum' && bootInitialVars
        ? normalizeInitialVariables(bootInitialVars)
        : {},
    workspace: initialWorkspace,
    savedWorkspaces: bootSandboxAutosaves,
    activeScope: bootInitialScope,
    selectedBlockId: null,
    runtime: null,
    isPlaying: false,
    speed: 400,
    editorTool: 'NONE',
    editorKeyGateVariant: 'circle',
    isSolutionOpen: false,
    isExportImportOpen: false,
    isSaveModalOpen: false,
    isLoadModalOpen: false,
    isLessonPickerOpen: false,
    isVictoryModalOpen: false,
    victoryEarnedBadges: [],
    isSubpaletteCollapsed: false,
    isMapHidden: false,
    isFunctionBarOpen: bootOpenFuncBar,
    isMobileMenuOpen: false,
    isLoopPlayback:
      bootMode === 'curriculum'
        ? Boolean(bootActivity?.defaultLoopPlayback ?? bootBeatRules?.isLoopingDefault)
        : false,
    randomSeed: DEFAULT_RANDOM_SEED,
    heldKeys: [],
    pointerState: { x: 0, y: 0, isDown: false },
    wasRestoredAfterUpdate: false,
    performanceMode: loadPersistedPerformanceMode(),
    isAutoLowQuality: false,

    past: [],
    future: [],
    canUndo: false,
    canRedo: false,
  };
}
