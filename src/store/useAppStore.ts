import { useRef, useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { shallow } from 'zustand/shallow';
import {
  loadPersistedPerformanceMode,
  savePersistedPerformanceMode,
  type PerformanceMode,
} from '../utils/performanceMonitor';
import {
  GridState,
  WorkspaceState,
  InterpreterRuntimeState,
  ScopeType,
  WallEdge,
  Direction,
  CodeBlock,
  SimulationSpeed,
  VariableName,
  KeyGateShape,
  LockedGate,
  FloorSwitch,
  WorldItem,
} from '../types';
import {
  DEFAULT_COLOR_FOR_SHAPE,
  cloneLockedGates,
  cloneWorldItems,
  resetGridInteractiveState,
  syncWorldSwitchesAndGates,
} from '../engine/physics';
import { detectWorldItemTransition } from '../simulations/grid/components/WorldItemsLayer';
import { TurtleState } from '../simulations/turtle/types';
import { createInitialTurtleState, turtleSimulationEnvironment } from '../simulations/turtle/turtleEnvironment';
import { BeatState } from '../simulations/beat/types';
import {
  beatSimulationEnvironment,
  createInitialBeatState,
  resetBeatState,
} from '../simulations/beat/beatEnvironment';
import { beatSynth } from '../simulations/beat/beatSynth';
import { gridSimulationEnvironment } from '../simulations/grid/gridEnvironment';
import { getSimEnvironment, registerSimulation } from '../engine/simulation/registry';

// Register environments
registerSimulation(gridSimulationEnvironment);
registerSimulation(turtleSimulationEnvironment);
registerSimulation(beatSimulationEnvironment);
import {
  createInitialInterpreterState,
  tickInterpreter,
  validateLoopStructure,
  evaluateValue,
} from '../engine/interpreter';
import {
  isTurtleAnimatedAction,
  createTurtleAnimation,
  interpolateAnimationPose,
} from '../simulations/turtle/physics';
import { runHeadlessSimulation, MAX_INSTANT_SIMULATION_STEPS } from '../engine/simulationRunner';
import { LESSONS } from '../data/lessons';
import {
  AppMode,
  CurriculumActivity,
  CURRICULUM_ACTIVITIES,
  CURRICULUM_MODULES,
  createCurriculumGridState,
  getActivityAtVersion,
  getActivityLatest,
  isValidatedPuzzleActivity,
} from '../data/curriculum';
import {
  GhostPreviewState,
  computeGhostPreviewSteps,
  getPlaceholderHintCategory,
  getPlaceholderHintLabel,
  resolveActivityScaffoldWorkspace,
} from '../engine/placeholderHelpers';
import {
  computeSlotBudget,
  formatSlotCapFullAnnouncement,
  resolveActiveCurriculumActivity,
} from '../utils/curriculumStagePolicy';
import {
  exportToString,
  importFromString,
  exportToBinary,
  importFromBinary,
  exportLessonToString,
  exportLessonToBinary,
} from '../engine/serialization/codeSerializer';
import {
  saveStateBeforeUpdate,
  consumeRestoredStateAfterUpdate,
} from '../services/pwaStateRestoreService';
import {
  DEFAULT_FALLBACK_THUMBNAIL,
  SavedProgramEntry,
  getSavedPrograms,
  saveProgram,
} from '../services/localSaveService';
import { generateSimulationThumbnail } from '../services/mapThumbnailGenerator';
import {
  CreateProfileInput,
  ProfileBackupEnvelopeV1,
  ProfileBackupImportMode,
  UserProfile,
  createProfile,
  deleteProfile,
  ensureProfilesInitialized,
  getProfileDisplayName,
  getProfileLessonWorkspaces,
  getProfileProgress,
  getProfileSandboxWorkspaces,
  getProfiles,
  importProfileBackup,
  markLessonCompleted,
  saveLessonAutosave,
  saveSandboxAutosave,
  setActiveProfileId,
  setUnlockAllModules,
} from '../services/profileService';
import { playCelebrationAudio } from '../services/celebrationAudio';

export type EditorTool =
  | 'NONE'
  | 'ROBOT'
  | 'WALL'
  | 'FLAG'
  | 'GOAL'
  | 'WATER'
  | 'PLANK'
  | 'KEY'
  | 'GATE'
  | 'CRATE'
  | 'SWITCH'
  | 'ERASE';

export const getInitialGridState = (grid: GridState): GridState =>
  resetGridInteractiveState(grid);

export const getInitialTurtleState = (turtleState: TurtleState): TurtleState =>
  turtleSimulationEnvironment.resetState(turtleState);

export const getInitialBeatState = (beatState?: BeatState): BeatState =>
  resetBeatState(beatState);

export const createEmptyWorkspace = (): WorkspaceState => ({
  MAIN: [],
  F1: [],
  F2: [],
  F3: [],
});

export const cloneWorkspace = (ws: WorkspaceState): WorkspaceState => ({
  MAIN: (ws?.MAIN || []).map((b) => ({
    ...b,
    ...(b.params ? { params: JSON.parse(JSON.stringify(b.params)) } : {}),
  })),
  F1: (ws?.F1 || []).map((b) => ({
    ...b,
    ...(b.params ? { params: JSON.parse(JSON.stringify(b.params)) } : {}),
  })),
  F2: (ws?.F2 || []).map((b) => ({
    ...b,
    ...(b.params ? { params: JSON.parse(JSON.stringify(b.params)) } : {}),
  })),
  F3: (ws?.F3 || []).map((b) => ({
    ...b,
    ...(b.params ? { params: JSON.parse(JSON.stringify(b.params)) } : {}),
  })),
});

export const cloneWorkspaceWithFreshIds = (ws: WorkspaceState): WorkspaceState => {
  const cloneList = (blocks: CodeBlock[] = []) =>
    blocks.map((b) => ({
      ...b,
      id: `${b.type}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...(b.params ? { params: JSON.parse(JSON.stringify(b.params)) } : {}),
    }));
  return {
    MAIN: cloneList(ws?.MAIN),
    F1: cloneList(ws?.F1),
    F2: cloneList(ws?.F2),
    F3: cloneList(ws?.F3),
  };
};

export interface SandboxModeSnapshot {
  activeSimId: 'grid' | 'turtle' | 'beat';
  currentLevel: number;
  grid: GridState;
  turtleState: TurtleState;
  beatState?: BeatState;
  workspace: WorkspaceState;
  savedWorkspaces: Record<string, WorkspaceState>;
}

export function computeInstantSimulation(
  workspace: WorkspaceState,
  simId: 'grid' | 'turtle' | 'beat',
  grid: GridState,
  turtleState: TurtleState,
  beatState?: BeatState
) {
  const initialState =
    simId === 'grid'
      ? getInitialGridState(grid)
      : simId === 'beat'
      ? getInitialBeatState(beatState)
      : getInitialTurtleState(turtleState);
  return runHeadlessSimulation(workspace, simId, initialState, MAX_INSTANT_SIMULATION_STEPS);
}

export interface LevelPreset {
  id: number;
  width: number;
  height: number;
  robot: { x: number; y: number; dir: Direction };
  barriers: WallEdge[];
  flags: { id: string; x: number; y: number; isGoal: boolean; order: number; collected: boolean }[];
}

export interface HistorySnapshot {
  workspace: WorkspaceState;
  grid: GridState;
  turtleState?: TurtleState;
  beatState?: BeatState;
  activeScope: ScopeType;
  selectedBlockId: string | null;
  activeSimId: 'grid' | 'turtle' | 'beat';
  description?: string;
}

export const PRESET_LEVELS: LevelPreset[] = LESSONS.map((lesson) => ({
  id: lesson.id,
  width: lesson.grid.width,
  height: lesson.grid.height,
  robot: lesson.grid.robot,
  barriers: lesson.grid.barriers,
  flags: lesson.grid.flags,
}));

export interface PendingLessonVersionMismatch {
  source: 'slot' | 'share';
  lessonId: string;
  savedVersion: number;
  latestVersion: number;
  workspace: WorkspaceState;
  hasHistoricalVersion: boolean;
  title?: string;
  slotIndex?: number;
}

interface AppState {
  // Multi-profile state
  profiles: UserProfile[];
  activeProfileId: string;
  isProfileModalOpen: boolean;
  isBadgeModalOpen: boolean;
  unlockAllModules: boolean;
  completedActivities: Record<string, boolean>;

  // Mode & Curriculum selection
  appMode: AppMode;
  activeActivityId: string;
  activeActivityVersion: number;
  activeDemoTabIndex: number;
  demoTabIndexByActivity: Record<string, number>;
  exploredDemoTabs: Record<string, string[]>;
  curriculumWorkspaces: Record<string, WorkspaceState>;
  sandboxSnapshot: SandboxModeSnapshot | null;
  pendingVersionMismatch: PendingLessonVersionMismatch | null;
  statusAnnouncement: string;
  ghostPreview: GhostPreviewState | null;
  slotCapRejectionCount: number;
  lastSlotCapRejectedAt: number | null;

  // Environment selection
  activeSimId: 'grid' | 'turtle' | 'beat';
  currentLevel: number;
  grid: GridState;
  turtleState: TurtleState;
  beatState: BeatState;
  workspace: WorkspaceState;
  savedWorkspaces: Record<string, WorkspaceState>;
  activeScope: ScopeType;
  selectedBlockId: string | null;
  runtime: InterpreterRuntimeState | null;
  isPlaying: boolean;
  speed: SimulationSpeed; // ms per tick: 400 (1x), 100 (4x), 25 (16x), or 'instant'
  editorTool: EditorTool;
  editorKeyGateVariant: KeyGateShape;
  isSolutionOpen: boolean;
  isExportImportOpen: boolean;
  isSaveModalOpen: boolean;
  isLoadModalOpen: boolean;
  isLessonPickerOpen: boolean;
  isVictoryModalOpen: boolean;
  victoryEarnedBadges: string[];
  isSubpaletteCollapsed: boolean;
  isMapHidden: boolean;
  isFunctionBarOpen: boolean;
  isMobileMenuOpen: boolean;
  isLoopPlayback: boolean;
  wasRestoredAfterUpdate: boolean;
  performanceMode: PerformanceMode;
  isAutoLowQuality: boolean;

  // History state & actions
  past: HistorySnapshot[];
  future: HistorySnapshot[];
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  startHistoryBatch: (description?: string) => void;
  endHistoryBatch: () => void;
  clearHistory: () => void;

  // Profile actions
  setProfileModalOpen: (open: boolean) => void;
  switchProfile: (profileId: string) => void;
  createAndSwitchProfile: (input: CreateProfileInput) => UserProfile;
  deleteUserProfile: (profileId: string) => boolean;
  reloadActiveProfileState: () => void;
  importUserProfileBackup: (
    input: ProfileBackupEnvelopeV1 | string | Uint8Array,
    mode: ProfileBackupImportMode
  ) => {
    success: boolean;
    profile?: UserProfile;
    importedSlotCount?: number;
    importedAutosaveCount?: number;
    error?: string;
  };

  // Mode & Curriculum actions
  setAppMode: (mode: AppMode) => void;
  setCurriculumActivity: (activityId: string, version?: number) => void;
  selectExplanationDemoTab: (tabIndex: number) => void;
  markActiveDemoTabExplored: () => void;
  completeExplanationAndContinue: () => string | null;
  completeCreativeActivity: (advanceToNext?: boolean) => string | null;
  openCopyInSandbox: () => void;
  loadVariationWorkspace: (workspace: WorkspaceState, title?: string) => void;
  resetActivityToStarter: () => void;

  // Actions
  setSimEnvironment: (simId: 'grid' | 'turtle' | 'beat') => void;
  setLevel: (levelId: number) => void;
  setActiveScope: (scope: ScopeType) => void;
  setSelectedBlockId: (id: string | null) => void;
  toggleSubpalette: () => void;
  setSubpaletteCollapsed: (collapsed: boolean) => void;
  toggleMapHidden: () => void;
  setMapHidden: (hidden: boolean) => void;
  toggleFunctionBar: () => void;
  setFunctionBarOpen: (open: boolean) => void;
  toggleMobileMenu: () => void;
  setMobileMenuOpen: (open: boolean) => void;
  setEditorTool: (tool: EditorTool) => void;
  setEditorKeyGateVariant: (variant: KeyGateShape) => void;
  setSpeed: (speed: SimulationSpeed | number) => void;
  runInstantIfActive: (options?: { allowVictoryModal?: boolean }) => void;
  setSolutionOpen: (open: boolean) => void;
  setExportImportOpen: (open: boolean) => void;
  setSaveModalOpen: (open: boolean) => void;
  setLoadModalOpen: (open: boolean) => void;
  setLessonPickerOpen: (open: boolean) => void;
  setBadgeModalOpen: (open: boolean) => void;
  toggleUnlockAllModules: () => void;
  dismissVictoryModal: () => void;
  loadSolution: (lessonId?: number) => void;
  triggerGhostPreview: () => boolean;
  stopGhostPreview: () => void;
  advanceGhostPreviewStep: () => void;
  loadPartialScaffold: () => boolean;
  replacePlaceholderBlock: (
    scope: ScopeType,
    placeholderBlockId: string,
    newType: string,
    params?: Record<string, any>
  ) => boolean;
  exportCode: (includeMap?: boolean) => string;
  exportBinary: (includeMap?: boolean) => Uint8Array;
  importCode: (
    data: string | Uint8Array
  ) => { success: boolean; error?: string; versionMismatchPending?: boolean };
  importBinary: (
    data: Uint8Array
  ) => { success: boolean; error?: string; versionMismatchPending?: boolean };
  loadSavedProgram: (
    entry: SavedProgramEntry
  ) => { success: boolean; error?: string; versionMismatchPending?: boolean };
  resolveVersionMismatch: (choice: 'latest' | 'original') => boolean;
  dismissVersionMismatch: () => void;

  // Workspace actions
  addBlock: (scope: ScopeType, type: string, repeatCount?: number | VariableName, insertAtIndex?: number, params?: Record<string, any>) => void;
  removeBlock: (scope: ScopeType, blockId: string) => void;
  updateBlockRepeat: (scope: ScopeType, blockId: string, repeatCount?: number | VariableName) => void;
  updateBlockParams: (scope: ScopeType, blockId: string, params: Record<string, any>) => void;
  reorderBlocks: (scope: ScopeType, fromIndex: number, toIndex: number) => void;
  clearWorkspace: (scope?: ScopeType) => void;

  // Grid editing actions
  toggleWall: (edge: WallEdge) => void;
  addWall: (edge: WallEdge) => void;
  resizeBoard: (direction: 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT', delta: number) => void;
  setCellContent: (x: number, y: number) => void;
  toggleTrace: () => void;
  toggleFitToView: () => void;
  clearGridUserCustoms: () => void;

  // Turtle environment actions
  updateTurtleViewport: (updates: Partial<{ pan: { x: number; y: number }; zoom: number; fitToView: boolean }>) => void;
  clearTurtleCanvas: () => void;
  toggleTurtleVisible: () => void;

  // Beat & Light Matrix environment actions
  setBeatMuted: (muted: boolean) => void;
  toggleBeatMuted: () => void;
  unlockBeatAudio: () => void;
  clearBeatMatrix: () => void;

  // Execution actions
  step: () => void;
  play: () => void;
  pause: () => void;
  reset: () => void;
  setLoopPlayback: (loop: boolean) => void;
  toggleLoopPlayback: () => void;

  // PWA update state persistence actions
  dismissRestoredNotice: () => void;
  prepareStateForUpdate: () => boolean;
  hydrateFromUpdateIfPresent: () => boolean;

  // Performance / Lite mode actions
  setPerformanceMode: (mode: PerformanceMode) => void;
  cyclePerformanceMode: () => void;
  triggerAutoLowQuality: () => void;
}

let timerId: NodeJS.Timeout | null = null;
let turtleRafId: number | null = null;

interface TurtlePendingCommit {
  finalTurtleState: TurtleState;
  finalRuntime: InterpreterRuntimeState;
  isDone: boolean;
  isSingleStep: boolean;
  wasSuccessBefore: boolean;
}

let pendingTurtleCommit: TurtlePendingCommit | null = null;
const mergeLiveTurtleViewState = (
  targetState: TurtleState,
  liveState: TurtleState
): TurtleState => ({
  ...targetState,
  pan: { ...liveState.pan },
  zoom: liveState.zoom,
  fitToView: liveState.fitToView,
  showTurtle: liveState.showTurtle,
  activeAnimation: null,
});
const MAX_HISTORY = 100;
let activeBatchSnapshot: HistorySnapshot | null = null;

const takeSnapshot = (state: AppState, desc?: string): HistorySnapshot => ({
  workspace: cloneWorkspace(state.workspace),
  grid: JSON.parse(JSON.stringify(state.grid)),
  turtleState: JSON.parse(JSON.stringify(state.turtleState)),
  beatState: JSON.parse(JSON.stringify(state.beatState)),
  activeScope: state.activeScope,
  selectedBlockId: state.selectedBlockId,
  activeSimId: state.activeSimId,
  description: desc,
});

const requestFrame = (cb: (time: number) => void, duration?: number, startTime?: number) => {
  if (typeof requestAnimationFrame !== 'undefined') {
    return requestAnimationFrame(cb);
  }
  const time = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const finishTime = startTime !== undefined && duration !== undefined ? startTime + duration + 1 : time;
  cb(finishTime);
  return 0;
};

const cancelFrame = (id: number) => {
  if (typeof cancelAnimationFrame !== 'undefined') {
    cancelAnimationFrame(id);
  }
};

export const useAppStore = create<AppState>((set, get) => {
  let turtlePassHadDelay = false;
  let beatPassHadDelay = false;

  const isBeatSoundBlock = (actionType: string): boolean =>
    actionType === 'DRUM_KICK' ||
    actionType === 'DRUM_SNARE' ||
    actionType === 'DRUM_CLAP' ||
    actionType === 'PLAY_CHIME' ||
    actionType === 'PLAY_NOTE';

  function runBeatExecutionLoop() {
    const simEnv = getSimEnvironment('beat');
    if (!simEnv) return;

    let stepsInSyncBatch = 0;

    while (get().isPlaying) {
      const { runtime, workspace, beatState, speed } = get();
      const globalSpeedMs = typeof speed === 'number' && speed > 0 ? speed : 400;

      for (const sc of ['MAIN', 'F1', 'F2', 'F3'] as ScopeType[]) {
        if (workspace[sc]?.length > 0) {
          const val = validateLoopStructure(workspace[sc]);
          if (val.hasError) {
            set({ isPlaying: false });
            return;
          }
        }
      }

      const currentRuntime = runtime || createInitialInterpreterState();
      if (
        (beatState.status as string) === 'SUCCESS' ||
        (beatState.status as string) === 'COLLISION' ||
        currentRuntime.callStack.length === 0
      ) {
        set({ isPlaying: false });
        return;
      }

      const currentFrame = currentRuntime.callStack[currentRuntime.callStack.length - 1];
      const currentBlock = (workspace[currentFrame.scope] || [])[currentFrame.pc];
      const wasSuccess =
        (beatState.status as string) === 'SUCCESS' ||
        (currentRuntime.status as string) === 'SUCCESS';
      const prevScope = get().activeScope;
      const prevBeatIndex = beatState.beatIndex;

      const res = tickInterpreter(currentRuntime, workspace, beatState, simEnv);
      const nextBeat = res.nextGrid as BeatState;

      if (nextBeat.beatIndex !== prevBeatIndex && !nextBeat.isMuted) {
        beatSynth.playEvent(nextBeat.lastTriggeredEvent, globalSpeedMs);
      }

      const activeScope =
        res.nextRuntime.callStack.length > 0
          ? res.nextRuntime.callStack[res.nextRuntime.callStack.length - 1].scope
          : prevScope;

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
              statusAnnouncement: getPlaceholderPauseAnnouncement(workspace, res.nextRuntime),
            }
          : {}),
      });

      if (nextBeat.status === 'SUCCESS' || res.nextRuntime.status === 'SUCCESS') {
        const reward = recordCurriculumSuccessIfApplicable();
        if (!wasSuccess) {
          triggerVictoryModal(reward?.newlyEarnedBadges ?? [], true);
        }
        set({ isPlaying: false });
        return;
      }

      if (isPausedOnPlaceholder || nextBeat.status === 'COLLISION') {
        set({ isPlaying: false });
        return;
      }

      let delayMs = 0;
      if (currentBlock) {
        if (isBeatSoundBlock(currentBlock.type)) {
          delayMs = beatSynth.getEventDurationMs(nextBeat.lastTriggeredEvent, globalSpeedMs);
        } else if (currentBlock.type === 'WAIT_BEAT') {
          const rawDur = currentBlock.params?.duration;
          const durUnits =
            rawDur !== undefined
              ? evaluateValue(rawDur, currentRuntime.variables, 1, simEnv, beatState)
              : 1;
          delayMs = Math.max(0, durUnits * globalSpeedMs);
        } else {
          delayMs = Math.max(0, nextBeat.stepDelayMultiplier * globalSpeedMs);
        }
      }

      if (delayMs > 0) {
        beatPassHadDelay = true;
      }

      if (res.done) {
        recordCreativePlayCompletionIfApplicable(true);
        if (get().isLoopPlayback) {
          const hadDelay = beatPassHadDelay;
          beatPassHadDelay = false;
          const resetBeat = getInitialBeatState(nextBeat);
          set({
            beatState: resetBeat,
            runtime: null,
            isPlaying: true,
          });
          if (delayMs > 0 || !hadDelay) {
            const waitBeforeRestart = delayMs > 0 ? delayMs : 16;
            timerId = setTimeout(() => {
              timerId = null;
              if (get().isPlaying) runBeatExecutionLoop();
            }, waitBeforeRestart);
            return;
          }
          continue;
        }
        set({ isPlaying: false });
        return;
      }

      if (delayMs > 0) {
        timerId = setTimeout(() => {
          timerId = null;
          if (get().isPlaying) {
            runBeatExecutionLoop();
          }
        }, delayMs);
        return;
      }

      stepsInSyncBatch += 1;
      if (stepsInSyncBatch >= 2000) {
        timerId = setTimeout(() => {
          timerId = null;
          if (get().isPlaying) {
            runBeatExecutionLoop();
          }
        }, 0);
        return;
      }
    }
  }

  function stepTurtleAnimation(timestamp: number) {
    turtleRafId = null;
    const { turtleState } = get();
    const anim = turtleState.activeAnimation;

    if (!anim || !pendingTurtleCommit) {
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
      turtleRafId = requestFrame(stepTurtleAnimation, anim.duration, anim.startTime);
    } else {
      const commit = pendingTurtleCommit;
      pendingTurtleCommit = null;

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
          completedTurtleState.status !== 'COLLISION'
        ) {
          recordCreativePlayCompletionIfApplicable(true);
          turtlePassHadDelay = false;
          set({
            turtleState: getInitialTurtleState(completedTurtleState),
            runtime: null,
            isPlaying: true,
          });
          runTurtleExecutionLoop(false);
          return;
        }

        set({
          turtleState: completedTurtleState,
          runtime: commit.finalRuntime,
          isPlaying: false,
        });
        if (completedTurtleState.status === 'SUCCESS' || commit.finalRuntime.status === 'SUCCESS') {
          const reward = recordCurriculumSuccessIfApplicable();
          if (!commit.wasSuccessBefore) {
            triggerVictoryModal(reward?.newlyEarnedBadges ?? [], true);
          }
        } else if (
          commit.isDone &&
          !commit.isSingleStep &&
          commit.finalRuntime.status !== 'PAUSED' &&
          completedTurtleState.status !== 'COLLISION'
        ) {
          recordCreativePlayCompletionIfApplicable(true);
        }
      } else {
        set({
          turtleState: completedTurtleState,
          runtime: commit.finalRuntime,
        });
        if (completedTurtleState.status === 'SUCCESS' || commit.finalRuntime.status === 'SUCCESS') {
          const reward = recordCurriculumSuccessIfApplicable();
          if (!commit.wasSuccessBefore) {
            triggerVictoryModal(reward?.newlyEarnedBadges ?? [], true);
          }
        }
        runTurtleExecutionLoop(false);
      }
    }
  }

  function runTurtleExecutionLoop(isSingleStep: boolean) {
    const { speed, workspace } = get();
    if (speed === 'instant' || (speed as any) === 0) return;

    for (const sc of ['MAIN', 'F1', 'F2', 'F3'] as ScopeType[]) {
      if (workspace[sc]?.length > 0) {
        const val = validateLoopStructure(workspace[sc]);
        if (val.hasError) {
          set({ isPlaying: false });
          return;
        }
      }
    }

    const currentTurtleState = get().turtleState;
    if (currentTurtleState.activeAnimation && pendingTurtleCommit) {
      pendingTurtleCommit.isSingleStep = isSingleStep;
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

      if (turtleRafId !== null) cancelFrame(turtleRafId);
      turtleRafId = requestFrame(stepTurtleAnimation, anim.duration, anim.startTime);
      return;
    }

    let runtime = get().runtime || createInitialInterpreterState();
    let turtleState = get().turtleState;
    const simEnv = getSimEnvironment('turtle');
    if (!simEnv) return;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();

    while (true) {
      if (
        turtleState.status === 'SUCCESS' ||
        turtleState.status === 'COLLISION' ||
        runtime.callStack.length === 0
      ) {
        set({ isPlaying: false });
        return;
      }

      // Fast-path pure-JS execution when Turtle instantMode is ON during play()
      if (!isSingleStep && turtleState.instantMode) {
        let stepsInBatch = 0;
        let lastActiveScope = get().activeScope;

        while (true) {
          if (
            (turtleState.status as string) === 'SUCCESS' ||
            (turtleState.status as string) === 'COLLISION' ||
            runtime.callStack.length === 0
          ) {
            set({ runtime, turtleState, activeScope: lastActiveScope, isPlaying: false });
            return;
          }

          const cf = runtime.callStack[runtime.callStack.length - 1];
          const cb = (workspace[cf.scope] || [])[cf.pc];
          if (cb && cb.type === 'WAIT') {
            // Commit batched instant state before handling timed WAIT animation
            set({ runtime, turtleState, activeScope: lastActiveScope });
            break;
          }

          const wasSuccessInstant =
            (turtleState.status as string) === 'SUCCESS' ||
            (runtime.status as string) === 'SUCCESS';
          const res = tickInterpreter(runtime, workspace, turtleState, simEnv);
          runtime = res.nextRuntime;
          turtleState = res.nextGrid as TurtleState;
          lastActiveScope =
            runtime.callStack.length > 0
              ? runtime.callStack[runtime.callStack.length - 1].scope
              : lastActiveScope;

          const isPausedOnPlaceholder = runtime.status === 'PAUSED';

          if (turtleState.status === 'SUCCESS' || runtime.status === 'SUCCESS') {
            set({ runtime, turtleState, activeScope: lastActiveScope, isPlaying: false });
            const reward = recordCurriculumSuccessIfApplicable();
            if (!wasSuccessInstant) {
              triggerVictoryModal(reward?.newlyEarnedBadges ?? [], true);
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
            if (turtleState.status !== 'COLLISION') {
              recordCreativePlayCompletionIfApplicable(true);
            }
            if (get().isLoopPlayback && turtleState.status !== 'COLLISION') {
              const hadDelay = turtlePassHadDelay;
              turtlePassHadDelay = false;
              const resetTurtle = getInitialTurtleState(turtleState);
              set({
                runtime: null,
                turtleState: resetTurtle,
                activeScope: 'MAIN',
                isPlaying: true,
              });
              if (!hadDelay) {
                timerId = setTimeout(() => {
                  timerId = null;
                  if (get().isPlaying) runTurtleExecutionLoop(false);
                }, 16);
                return;
              }
              runtime = createInitialInterpreterState();
              turtleState = resetTurtle;
              break;
            }
            set({ runtime, turtleState, activeScope: lastActiveScope, isPlaying: false });
            return;
          }

          if (!turtleState.instantMode) {
            // Exited instant mode via SET_INSTANT('OFF')
            set({ runtime, turtleState, activeScope: lastActiveScope });
            break;
          }

          stepsInBatch += 1;
          if (stepsInBatch >= 2000) {
            set({ runtime, turtleState, activeScope: lastActiveScope });
            timerId = setTimeout(() => {
              timerId = null;
              if (get().isPlaying) runTurtleExecutionLoop(false);
            }, 0);
            return;
          }
        }
        if (runtime.callStack.length === 0) return;
      }

      const currentFrame = runtime.callStack[runtime.callStack.length - 1];
      const scopeBlocks = workspace[currentFrame.scope] || [];
      const currentBlock = scopeBlocks[currentFrame.pc];

      const isAnimated = currentBlock && isTurtleAnimatedAction(currentBlock.type);
      const wasSuccess =
        (turtleState.status as string) === 'SUCCESS' ||
        (runtime.status as string) === 'SUCCESS';

      if (!isAnimated) {
        const res = tickInterpreter(runtime, workspace, turtleState, simEnv);
        runtime = res.nextRuntime;
        turtleState = res.nextGrid as TurtleState;

        const prevScope = get().activeScope;
        const activeScope = runtime.callStack.length > 0
          ? runtime.callStack[runtime.callStack.length - 1].scope
          : prevScope;

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
                statusAnnouncement: getPlaceholderPauseAnnouncement(workspace, runtime),
              }
            : {}),
        });

        if (turtleState.status === 'SUCCESS' || runtime.status === 'SUCCESS') {
          const reward = recordCurriculumSuccessIfApplicable();
          if (!wasSuccess) {
            triggerVictoryModal(reward?.newlyEarnedBadges ?? [], true);
          }
        } else if (
          res.done &&
          !isSingleStep &&
          !isPausedOnPlaceholder &&
          turtleState.status !== 'COLLISION'
        ) {
          recordCreativePlayCompletionIfApplicable(true);
        }

        if (res.done) {
          if (
            !isSingleStep &&
            get().isLoopPlayback &&
            !isPausedOnPlaceholder &&
            turtleState.status !== 'COLLISION' &&
            turtleState.status !== 'SUCCESS'
          ) {
            const hadDelay = turtlePassHadDelay;
            turtlePassHadDelay = false;
            const resetTurtle = getInitialTurtleState(turtleState);
            set({
              runtime: null,
              turtleState: resetTurtle,
              activeScope: 'MAIN',
              isPlaying: true,
            });
            if (!hadDelay) {
              timerId = setTimeout(() => {
                timerId = null;
                if (get().isPlaying) runTurtleExecutionLoop(false);
              }, 16);
              return;
            }
            runtime = createInitialInterpreterState();
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

      const rawRepeats = currentBlock.repeatCount !== undefined
        ? evaluateValue(currentBlock.repeatCount, runtime.variables, 1)
        : 1;
      const totalRepeats = Math.round(rawRepeats);

      if (totalRepeats <= 0) {
        const res = tickInterpreter(runtime, workspace, turtleState, simEnv);
        runtime = res.nextRuntime;
        turtleState = res.nextGrid as TurtleState;

        const prevScope = get().activeScope;
        const activeScope = runtime.callStack.length > 0
          ? runtime.callStack[runtime.callStack.length - 1].scope
          : prevScope;

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
                statusAnnouncement: getPlaceholderPauseAnnouncement(workspace, runtime),
              }
            : {}),
        });

        if (turtleState.status === 'SUCCESS' || runtime.status === 'SUCCESS') {
          const reward = recordCurriculumSuccessIfApplicable();
          if (!wasSuccess) {
            triggerVictoryModal(reward?.newlyEarnedBadges ?? [], true);
          }
        } else if (
          res.done &&
          !isSingleStep &&
          !isPausedOnPlaceholder &&
          turtleState.status !== 'COLLISION'
        ) {
          recordCreativePlayCompletionIfApplicable(true);
        }

        if (res.done) {
          if (
            !isSingleStep &&
            get().isLoopPlayback &&
            !isPausedOnPlaceholder &&
            turtleState.status !== 'COLLISION' &&
            turtleState.status !== 'SUCCESS'
          ) {
            const hadDelay = turtlePassHadDelay;
            turtlePassHadDelay = false;
            const resetTurtle = getInitialTurtleState(turtleState);
            set({
              runtime: null,
              turtleState: resetTurtle,
              activeScope: 'MAIN',
              isPlaying: true,
            });
            if (!hadDelay) {
              timerId = setTimeout(() => {
                timerId = null;
                if (get().isPlaying) runTurtleExecutionLoop(false);
              }, 16);
              return;
            }
            runtime = createInitialInterpreterState();
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

      const res = tickInterpreter(runtime, workspace, turtleState, simEnv);
      const toPose = { ...(res.nextGrid as TurtleState).robot };

      const prevScope = get().activeScope;
      const activeScope = res.nextRuntime.callStack.length > 0
        ? res.nextRuntime.callStack[res.nextRuntime.callStack.length - 1].scope
        : prevScope;

      const resolvedParams: Record<string, any> = {};
      if (currentBlock.params) {
        for (const [k, v] of Object.entries(currentBlock.params)) {
          if (
            typeof v === 'string' &&
            (/^[a-z]$/.test(v.trim()) || v.trim().startsWith('$'))
          ) {
            resolvedParams[k] = evaluateValue(v, runtime.variables, 0, simEnv, turtleState);
          } else {
            resolvedParams[k] = v;
          }
        }
      }

      const anim = createTurtleAnimation(
        currentBlock.type,
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
          const reward = recordCurriculumSuccessIfApplicable();
          if (!wasSuccess) {
            triggerVictoryModal(reward?.newlyEarnedBadges ?? [], true);
          }
        } else if (
          res.done &&
          !isSingleStep &&
          runtime.status !== 'PAUSED' &&
          turtleState.status !== 'COLLISION'
        ) {
          recordCreativePlayCompletionIfApplicable(true);
        }

        if (res.done || isSingleStep) {
          if (
            res.done &&
            !isSingleStep &&
            get().isLoopPlayback &&
            runtime.status !== 'PAUSED' &&
            turtleState.status !== 'COLLISION' &&
            turtleState.status !== 'SUCCESS'
          ) {
            const hadDelay = turtlePassHadDelay;
            turtlePassHadDelay = false;
            const resetTurtle = getInitialTurtleState(turtleState);
            set({
              runtime: null,
              turtleState: resetTurtle,
              activeScope: 'MAIN',
              isPlaying: true,
            });
            if (!hadDelay) {
              timerId = setTimeout(() => {
                timerId = null;
                if (get().isPlaying) runTurtleExecutionLoop(false);
              }, 16);
              return;
            }
            runtime = createInitialInterpreterState();
            turtleState = resetTurtle;
            continue;
          }
          set({ isPlaying: false });
          return;
        }

        continue;
      }

      turtlePassHadDelay = true;
      pendingTurtleCommit = {
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

      if (turtleRafId !== null) cancelFrame(turtleRafId);
      turtleRafId = requestFrame(stepTurtleAnimation, anim.duration, anim.startTime);
      return;
    }
  }
  const initialPreset = PRESET_LEVELS[0];
  const defaultActivity = CURRICULUM_ACTIVITIES[0];

  const createGridFromPreset = (preset: LevelPreset, prevFitToView: boolean = false): GridState => ({
    width: preset.width,
    height: preset.height,
    robot: {
      ...preset.robot,
      initialX: preset.robot.x,
      initialY: preset.robot.y,
      initialDir: preset.robot.dir,
    },
    barriers: [...preset.barriers],
    flags: preset.flags.map((f) => ({ ...f, collected: false })),
    trace: [{ x: preset.robot.x, y: preset.robot.y }],
    status: 'IDLE',
    showTrace: true,
    fitToView: prevFitToView,
  });

  const resolveCurriculumSimId = (simId?: string): 'grid' | 'turtle' | 'beat' =>
    simId === 'turtle' ? 'turtle' : simId === 'beat' ? 'beat' : 'grid';

  const buildSandboxSnapshot = (state: AppState): SandboxModeSnapshot => {
    const snapSaved: Record<string, WorkspaceState> = {};
    for (const [k, ws] of Object.entries(state.savedWorkspaces)) {
      snapSaved[k] = cloneWorkspace(ws);
    }
    snapSaved[state.activeSimId] = cloneWorkspace(state.workspace);
    return {
      activeSimId: state.activeSimId,
      currentLevel: state.currentLevel,
      grid: JSON.parse(JSON.stringify(getInitialGridState(state.grid))),
      turtleState: JSON.parse(JSON.stringify(getInitialTurtleState(state.turtleState))),
      beatState: JSON.parse(JSON.stringify(getInitialBeatState(state.beatState))),
      workspace: cloneWorkspace(state.workspace),
      savedWorkspaces: snapSaved,
    };
  };

  let bootMode: AppMode = 'sandbox';
  let bootActivity = defaultActivity;
  if (typeof window !== 'undefined' && window.location?.search) {
    try {
      const params = new URLSearchParams(window.location.search);
      const modeParam = params.get('mode')?.toLowerCase();
      if (modeParam === 'curriculum' || modeParam === 'learn') {
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

  const initialGrid =
    bootMode === 'curriculum' && bootActivity?.grid
      ? createCurriculumGridState(bootActivity.grid)
      : createGridFromPreset(initialPreset);

  const bootProfilesState = ensureProfilesInitialized();
  const bootActiveProfileId = bootProfilesState.activeProfileId;
  const bootCurriculumAutosaves = getProfileLessonWorkspaces(bootActiveProfileId);
  const bootSandboxAutosaves = getProfileSandboxWorkspaces(bootActiveProfileId);
  const bootSimId: 'grid' | 'turtle' | 'beat' =
    bootMode === 'curriculum' ? resolveCurriculumSimId(bootActivity?.simId) : 'grid';

  const buildCompletedMap = (profileId: string): Record<string, boolean> => {
    const prog = getProfileProgress(profileId);
    const map: Record<string, boolean> = {};
    for (const k of Object.keys(prog.completedLessons)) {
      map[k] = true;
    }
    return map;
  };

  const initialWorkspace =
    bootMode === 'curriculum'
      ? bootActivity && bootCurriculumAutosaves[bootActivity.id]
        ? cloneWorkspace(bootCurriculumAutosaves[bootActivity.id])
        : bootActivity?.starterWorkspace
        ? cloneWorkspaceWithFreshIds(bootActivity.starterWorkspace)
        : createEmptyWorkspace()
      : bootSandboxAutosaves[bootSimId]
      ? cloneWorkspace(bootSandboxAutosaves[bootSimId])
      : createEmptyWorkspace();

  const persistActiveWorkspace = (
    ws: WorkspaceState,
    override?: {
      appMode?: AppMode;
      profileId?: string;
      activityId?: string;
      activityVersion?: number;
      simId?: 'grid' | 'turtle' | 'beat';
    }
  ) => {
    const s = get();
    const mode = override?.appMode ?? s.appMode;
    const profileId = override?.profileId ?? s.activeProfileId;
    if (mode === 'curriculum') {
      const actId = override?.activityId ?? s.activeActivityId;
      const actVer = override?.activityVersion ?? s.activeActivityVersion;
      const act = getActivityAtVersion(actId, actVer) ?? getActivityLatest(actId);
      // Do not overwrite primary lesson autosave when viewing secondary explanation demo tabs
      if (
        act?.format === 'explanation' &&
        (act.demoTabs?.length ?? 0) > 1 &&
        s.activeDemoTabIndex > 0
      ) {
        return;
      }
      saveLessonAutosave(profileId, actId, ws, actVer);
    } else {
      const simId = override?.simId ?? s.activeSimId;
      saveSandboxAutosave(profileId, simId, ws);
    }
  };

  const markDemoTabExploredInternal = (announceOnAllExplored = true) => {
    const s = get();
    if (s.appMode !== 'curriculum') return;
    const activity =
      getActivityAtVersion(s.activeActivityId, s.activeActivityVersion) ??
      getActivityLatest(s.activeActivityId);
    if (!activity || activity.format !== 'explanation' || !activity.demoTabs?.length) {
      return;
    }
    const clampedIdx = Math.min(
      Math.max(0, s.activeDemoTabIndex),
      activity.demoTabs.length - 1
    );
    const activeTab = activity.demoTabs[clampedIdx];
    if (!activeTab) return;

    const prevExplored = s.exploredDemoTabs[activity.id] ?? [];
    if (prevExplored.includes(activeTab.id)) {
      return;
    }
    const nextExploredForActivity = [...prevExplored, activeTab.id];
    const allExploredNow = activity.demoTabs.every((t) =>
      nextExploredForActivity.includes(t.id)
    );
    const nextIdxInCatalog = CURRICULUM_ACTIVITIES.findIndex((a) => a.id === activity.id);
    const nextActivity =
      nextIdxInCatalog >= 0 && nextIdxInCatalog < CURRICULUM_ACTIVITIES.length - 1
        ? CURRICULUM_ACTIVITIES[nextIdxInCatalog + 1]
        : undefined;

    set((curr) => ({
      exploredDemoTabs: {
        ...curr.exploredDemoTabs,
        [activity.id]: nextExploredForActivity,
      },
      ...(announceOnAllExplored && allExploredNow && curr.runtime?.status !== 'PAUSED'
        ? {
            statusAnnouncement: nextActivity
              ? `All ${activity.demoTabs!.length} examples explored in Activity ${activity.id}! Press Continue to advance to Activity ${nextActivity.id}: ${nextActivity.title}.`
              : `All ${activity.demoTabs!.length} examples explored in Activity ${activity.id}! Press Continue when ready.`,
          }
        : {}),
    }));
  };

  const getActiveCurriculumActivityObj = (): CurriculumActivity | undefined => {
    const s = get();
    if (s.appMode !== 'curriculum') return undefined;
    return (
      getActivityAtVersion(s.activeActivityId, s.activeActivityVersion) ??
      getActivityLatest(s.activeActivityId)
    );
  };

  const isExplanationActivity = (): boolean => {
    const act = getActiveCurriculumActivityObj();
    return Boolean(act && act.format === 'explanation');
  };

  const isCreativeCurriculumActivity = (
    act: CurriculumActivity | undefined = getActiveCurriculumActivityObj()
  ): boolean =>
    Boolean(act) &&
    !isValidatedPuzzleActivity(act!) &&
    (act!.format === 'sandbox' ||
      (act!.format === 'capstone' &&
        (act!.capstoneType === 'creative' || (act!.capstoneType as string) === 'sandbox')));

  const isCurrentSimSuccess = (): boolean => {
    const s = get();
    const simStatus =
      s.activeSimId === 'grid'
        ? s.grid.status
        : s.activeSimId === 'beat'
        ? s.beatState.status
        : s.turtleState.status;
    return simStatus === 'SUCCESS' || s.runtime?.status === 'SUCCESS';
  };

  const formatEarnedBadgesAnnouncement = (
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

  const triggerVictoryModal = (earnedBadges: string[] = [], playAudio = true) => {
    if (isExplanationActivity()) return;
    const s = get();
    const act = getActiveCurriculumActivityObj();
    const isGrand = earnedBadges.length > 0 || Boolean(act && act.format === 'capstone');
    const badgeAnnouncement = formatEarnedBadgesAnnouncement(earnedBadges, act);
    set({
      isVictoryModalOpen: true,
      victoryEarnedBadges: earnedBadges,
      ...(badgeAnnouncement ? { statusAnnouncement: badgeAnnouncement } : {}),
    });
    if (playAudio) {
      playCelebrationAudio(isGrand, {
        speed: s.speed,
        isMuted: s.beatState.isMuted,
      });
    }
  };

  const recordCurriculumSuccessIfApplicable = (): {
    newlyEarnedBadges: string[];
    isCapstone: boolean;
  } | null => {
    const s = get();
    if (s.appMode !== 'curriculum') return null;
    const activity = getActiveCurriculumActivityObj();
    if (!activity || !isValidatedPuzzleActivity(activity)) return null;
    const res = markLessonCompleted(s.activeProfileId, s.activeActivityId, s.activeActivityVersion);
    if (!s.completedActivities[s.activeActivityId]) {
      set((curr) => ({
        completedActivities: {
          ...curr.completedActivities,
          [curr.activeActivityId]: true,
        },
      }));
    }
    return {
      newlyEarnedBadges: res.newlyEarnedBadges,
      isCapstone: activity.format === 'capstone',
    };
  };

  const recordCreativePlayCompletionIfApplicable = (playAudio = true) => {
    const s = get();
    if (s.appMode !== 'curriculum') return;
    const activity = getActiveCurriculumActivityObj();
    if (!activity || !isCreativeCurriculumActivity(activity)) return;
    const totalBlocks =
      s.workspace.MAIN.length +
      s.workspace.F1.length +
      s.workspace.F2.length +
      s.workspace.F3.length;
    if (totalBlocks === 0) return;

    const res = markLessonCompleted(s.activeProfileId, activity.id, activity.version);
    if (!s.completedActivities[activity.id]) {
      set((curr) => ({
        completedActivities: {
          ...curr.completedActivities,
          [activity.id]: true,
        },
      }));
    }
    if (activity.format === 'capstone' || res.newlyEarnedBadges.length > 0) {
      triggerVictoryModal(res.newlyEarnedBadges, playAudio);
    }
  };

  const normalizeWorkspaceForCompare = (ws?: WorkspaceState) =>
    (['MAIN', 'F1', 'F2', 'F3'] as ScopeType[]).map((sc) =>
      (ws?.[sc] || []).map((b) => ({
        type: b.type,
        repeatCount: b.repeatCount ?? 1,
        params: b.params ?? null,
      }))
    );

  const recordMutation = (desc?: string) => {
    if (activeBatchSnapshot !== null) {
      return;
    }
    const snapshot = takeSnapshot(get(), desc);
    const currentPast = get().past;
    const newPast = [...currentPast.slice(Math.max(0, currentPast.length - (MAX_HISTORY - 1))), snapshot];
    set({
      past: newPast,
      future: [],
      canUndo: true,
      canRedo: false,
    });
  };

  const getPlaceholderPauseAnnouncement = (
    ws: WorkspaceState,
    rt: InterpreterRuntimeState
  ): string => {
    const pausedBlock = rt.activeBlockId
      ? ws[rt.activeScope]?.find((b) => b.id === rt.activeBlockId)
      : undefined;
    const hintLabel = getPlaceholderHintLabel(getPlaceholderHintCategory(pausedBlock));
    return `Execution paused on ? placeholder block (${hintLabel} hint). Choose a highlighted block from the palette to replace it.`;
  };

  const applyLessonWorkspaceLoad = (
    lessonId: string,
    targetVersion: number,
    loadedWorkspace: WorkspaceState,
    announcement?: string
  ): { success: boolean; error?: string } => {
    const activity = getActivityAtVersion(lessonId, targetVersion);
    if (!activity) {
      return {
        success: false,
        error: `Curriculum lesson ${lessonId} (v${targetVersion}) is unavailable.`,
      };
    }

    const state = get();
    get().pause();

    if (
      state.appMode === 'curriculum' &&
      state.activeActivityId === activity.id &&
      state.activeActivityVersion === activity.version
    ) {
      recordMutation('Load lesson workspace');
    } else {
      get().clearHistory();
    }

    const nextSandboxSnapshot =
      state.appMode === 'sandbox' ? buildSandboxSnapshot(state) : state.sandboxSnapshot;

    const nextCurriculumWorkspaces =
      state.appMode === 'curriculum'
        ? {
            ...state.curriculumWorkspaces,
            [state.activeActivityId]: cloneWorkspace(state.workspace),
          }
        : { ...state.curriculumWorkspaces };

    const freshWorkspace = cloneWorkspaceWithFreshIds(loadedWorkspace);
    nextCurriculumWorkspaces[activity.id] = cloneWorkspace(freshWorkspace);

    const targetSimId: 'grid' | 'turtle' | 'beat' = resolveCurriculumSimId(activity.simId);
    const prevFitToView = state.grid.fitToView ?? false;
    const targetGrid = activity.grid
      ? createCurriculumGridState(activity.grid, prevFitToView)
      : state.grid;

    const allowedScopes: ScopeType[] =
      activity.palette.allowedScopes && activity.palette.allowedScopes.length > 0
        ? activity.palette.allowedScopes
        : ['MAIN'];
    const initialScope: ScopeType = allowedScopes.includes('MAIN') ? 'MAIN' : allowedScopes[0];
    const shouldOpenFuncBar = allowedScopes.some((sc) => sc !== 'MAIN');

    set({
      appMode: 'curriculum',
      activeActivityId: activity.id,
      activeActivityVersion: activity.version,
      activeSimId: targetSimId,
      grid: targetGrid,
      turtleState: createInitialTurtleState(),
      beatState: resetBeatState(state.beatState),
      workspace: freshWorkspace,
      curriculumWorkspaces: nextCurriculumWorkspaces,
      sandboxSnapshot: nextSandboxSnapshot,
      editorTool: 'NONE',
      selectedBlockId: null,
      activeScope: initialScope,
      isFunctionBarOpen: shouldOpenFuncBar,
      isVictoryModalOpen: false,
      victoryEarnedBadges: [],
      runtime: null,
      ghostPreview: null,
      slotCapRejectionCount: 0,
      lastSlotCapRejectedAt: null,
      pendingVersionMismatch: null,
      statusAnnouncement:
        announcement ||
        `Loaded saved blocks into Activity ${activity.id} (v${activity.version}): ${activity.title}.`,
    });

    saveLessonAutosave(get().activeProfileId, activity.id, freshWorkspace, activity.version);
    get().reset();
    get().runInstantIfActive();
    return { success: true };
  };

  return {
    profiles: bootProfilesState.profiles,
    activeProfileId: bootActiveProfileId,
    isProfileModalOpen: false,
    isBadgeModalOpen: false,
    unlockAllModules: Boolean(getProfileProgress(bootActiveProfileId).unlockAllModules),
    completedActivities: buildCompletedMap(bootActiveProfileId),

    appMode: bootMode,
    activeActivityId: bootActivity?.id || '1.1',
    activeActivityVersion: bootActivity?.version || 1,
    activeDemoTabIndex: 0,
    demoTabIndexByActivity: {},
    exploredDemoTabs: {},
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

    activeSimId: bootSimId,
    currentLevel: 1,
    grid: initialGrid,
    turtleState: createInitialTurtleState(),
    beatState: createInitialBeatState(beatSynth.isMuted()),
    workspace: initialWorkspace,
    savedWorkspaces: bootSandboxAutosaves,
    activeScope: 'MAIN',
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
    isFunctionBarOpen: false,
    isMobileMenuOpen: false,
    isLoopPlayback: false,
    wasRestoredAfterUpdate: false,
    performanceMode: loadPersistedPerformanceMode(),
    isAutoLowQuality: false,

    past: [],
    future: [],
    canUndo: false,
    canRedo: false,

    undo: () => {
      const { past, future, appMode, activeActivityId, curriculumWorkspaces } = get();
      if (past.length === 0) return;

      activeBatchSnapshot = null;
      get().pause();

      const previousSnapshot = past[past.length - 1];
      const newPast = past.slice(0, past.length - 1);

      const currentSnapshot = takeSnapshot(get(), 'Current state before undo');
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

      persistActiveWorkspace(restoredWs, {
        appMode,
        simId: previousSnapshot.activeSimId,
      });

      get().reset();
      get().runInstantIfActive();
    },

    redo: () => {
      const { past, future, appMode, activeActivityId, curriculumWorkspaces } = get();
      if (future.length === 0) return;

      activeBatchSnapshot = null;
      get().pause();

      const nextSnapshot = future[future.length - 1];
      const newFuture = future.slice(0, future.length - 1);

      const currentSnapshot = takeSnapshot(get(), 'Current state before redo');
      currentSnapshot.activeScope = nextSnapshot.activeScope;

      const newPast = [...past.slice(Math.max(0, past.length - (MAX_HISTORY - 1))), currentSnapshot];
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

      persistActiveWorkspace(restoredWs, {
        appMode,
        simId: nextSnapshot.activeSimId,
      });

      get().reset();
      get().runInstantIfActive();
    },

    startHistoryBatch: (description?: string) => {
      if (activeBatchSnapshot === null) {
        activeBatchSnapshot = takeSnapshot(get(), description);
      }
    },

    endHistoryBatch: () => {
      if (activeBatchSnapshot === null) return;
      const initial = activeBatchSnapshot;
      activeBatchSnapshot = null;

      const currentWorkspace = get().workspace;
      const currentGrid = get().grid;
      const currentTurtle = get().turtleState;
      const currentBeat = get().beatState;

      const hasWorkspaceChanged = JSON.stringify(initial.workspace) !== JSON.stringify(currentWorkspace);
      const hasGridChanged = JSON.stringify(initial.grid) !== JSON.stringify(currentGrid);
      const hasTurtleChanged =
        initial.turtleState && JSON.stringify(initial.turtleState) !== JSON.stringify(currentTurtle);
      const hasBeatChanged =
        initial.beatState && JSON.stringify(initial.beatState) !== JSON.stringify(currentBeat);

      if (hasWorkspaceChanged || hasGridChanged || hasTurtleChanged || hasBeatChanged) {
        const currentPast = get().past;
        const newPast = [...currentPast.slice(Math.max(0, currentPast.length - (MAX_HISTORY - 1))), initial];
        set({
          past: newPast,
          future: [],
          canUndo: true,
          canRedo: false,
        });
      }
    },

    clearHistory: () => {
      activeBatchSnapshot = null;
      set({
        past: [],
        future: [],
        canUndo: false,
        canRedo: false,
      });
    },

    setProfileModalOpen: (open) => set({ isProfileModalOpen: open }),

    reloadActiveProfileState: () => {
      const state = get();
      get().pause();
      get().clearHistory();

      const profilesState = ensureProfilesInitialized();
      const profileId = profilesState.activeProfileId;
      const nextCurriculumWorkspaces = getProfileLessonWorkspaces(profileId);
      const nextSavedWorkspaces = getProfileSandboxWorkspaces(profileId);
      const nextProgress = getProfileProgress(profileId);
      const nextCompleted = buildCompletedMap(profileId);
      const prevFitToView = state.grid.fitToView ?? false;

      if (state.appMode === 'curriculum') {
        const activity =
          getActivityAtVersion(state.activeActivityId, state.activeActivityVersion) ??
          getActivityLatest(state.activeActivityId) ??
          CURRICULUM_ACTIVITIES[0];
        if (!activity) return;

        const targetSimId: 'grid' | 'turtle' | 'beat' = resolveCurriculumSimId(activity.simId);
        const targetGrid = activity.grid
          ? createCurriculumGridState(activity.grid, prevFitToView)
          : getInitialGridState(state.grid);

        const targetWs = nextCurriculumWorkspaces[activity.id]
          ? cloneWorkspace(nextCurriculumWorkspaces[activity.id])
          : activity.starterWorkspace
          ? cloneWorkspaceWithFreshIds(activity.starterWorkspace)
          : createEmptyWorkspace();

        const allowedScopes: ScopeType[] =
          activity.palette.allowedScopes && activity.palette.allowedScopes.length > 0
            ? activity.palette.allowedScopes
            : ['MAIN'];

        set({
          profiles: profilesState.profiles,
          activeProfileId: profileId,
          unlockAllModules: Boolean(nextProgress.unlockAllModules),
          isBadgeModalOpen: false,
          completedActivities: nextCompleted,
          activeActivityId: activity.id,
          activeActivityVersion: activity.version,
          activeDemoTabIndex: 0,
          demoTabIndexByActivity: {},
          exploredDemoTabs: {},
          activeSimId: targetSimId,
          grid: targetGrid,
          turtleState: createInitialTurtleState(),
          beatState: resetBeatState(state.beatState),
          workspace: targetWs,
          curriculumWorkspaces: {
            ...nextCurriculumWorkspaces,
            [activity.id]: cloneWorkspace(targetWs),
          },
          savedWorkspaces: nextSavedWorkspaces,
          sandboxSnapshot: null,
          pendingVersionMismatch: null,
          selectedBlockId: null,
          activeScope: 'MAIN',
          isFunctionBarOpen: allowedScopes.some((sc) => sc !== 'MAIN'),
          isVictoryModalOpen: false,
          victoryEarnedBadges: [],
          editorTool: 'NONE',
          runtime: null,
          ghostPreview: null,
          slotCapRejectionCount: 0,
          lastSlotCapRejectedAt: null,
        });
      } else {
        const fallbackPreset =
          PRESET_LEVELS.find((p) => p.id === state.currentLevel) || PRESET_LEVELS[0];
        const targetWs = nextSavedWorkspaces[state.activeSimId]
          ? cloneWorkspace(nextSavedWorkspaces[state.activeSimId])
          : createEmptyWorkspace();

        set({
          profiles: profilesState.profiles,
          activeProfileId: profileId,
          unlockAllModules: Boolean(nextProgress.unlockAllModules),
          isBadgeModalOpen: false,
          completedActivities: nextCompleted,
          activeDemoTabIndex: 0,
          demoTabIndexByActivity: {},
          exploredDemoTabs: {},
          curriculumWorkspaces: nextCurriculumWorkspaces,
          savedWorkspaces: nextSavedWorkspaces,
          sandboxSnapshot: null,
          pendingVersionMismatch: null,
          grid: createGridFromPreset(fallbackPreset, prevFitToView),
          turtleState: createInitialTurtleState(),
          beatState: resetBeatState(state.beatState),
          workspace: targetWs,
          selectedBlockId: null,
          activeScope: 'MAIN',
          editorTool: 'NONE',
          runtime: null,
          ghostPreview: null,
          slotCapRejectionCount: 0,
          lastSlotCapRejectedAt: null,
        });
      }

      get().reset();
      get().runInstantIfActive();
    },

    importUserProfileBackup: (input, mode) => {
      const res = importProfileBackup(input, mode, get().activeProfileId);
      if (!res.success || !res.profile) {
        return { success: false, error: res.error || 'Failed to import profile backup.' };
      }

      // Regenerate SVG thumbnails for any QR-imported save slots that omitted bulky screenshot strings
      try {
        const entries = getSavedPrograms(res.profile.id);
        for (const entry of entries) {
          if (entry.screenshot !== DEFAULT_FALLBACK_THUMBNAIL) continue;
          const decoded = importFromString(entry.code);
          if (!decoded.success || !decoded.workspace) continue;

          if (entry.simId === 'grid') {
            const lessonAct = entry.lessonId
              ? getActivityAtVersion(entry.lessonId, entry.lessonVersion ?? 1) ??
                getActivityLatest(entry.lessonId)
              : undefined;
            const preset =
              entry.levelId !== undefined
                ? PRESET_LEVELS.find((p) => p.id === entry.levelId) || PRESET_LEVELS[0]
                : PRESET_LEVELS[0];
            const initialGridState = lessonAct?.grid
              ? createCurriculumGridState(lessonAct.grid, false)
              : decoded.gridState
              ? getInitialGridState(decoded.gridState)
              : createGridFromPreset(preset, false);
            const run = runHeadlessSimulation(decoded.workspace, 'grid', initialGridState, 250);
            const screenshot = generateSimulationThumbnail('grid', run.finalState);
            saveProgram({ ...entry, screenshot });
          } else if (entry.simId === 'beat') {
            const run = runHeadlessSimulation(decoded.workspace, 'beat', resetBeatState(), 250);
            const screenshot = generateSimulationThumbnail('beat', run.finalState);
            saveProgram({ ...entry, screenshot });
          } else {
            const run = runHeadlessSimulation(
              decoded.workspace,
              'turtle',
              createInitialTurtleState(),
              250
            );
            const screenshot = generateSimulationThumbnail('turtle', run.finalState);
            saveProgram({ ...entry, screenshot });
          }
        }
      } catch {
        // Non-fatal thumbnail regeneration fallback
      }

      get().reloadActiveProfileState();
      const displayName = getProfileDisplayName(res.profile);
      set({
        statusAnnouncement:
          mode === 'new'
            ? `Imported backup as new profile ${displayName}.`
            : `Replaced active profile with backup (${displayName}).`,
      });

      return {
        success: true,
        profile: res.profile,
        importedSlotCount: res.importedSlotCount,
        importedAutosaveCount: res.importedAutosaveCount,
      };
    },

    switchProfile: (profileId) => {
      const state = get();
      if (profileId === state.activeProfileId) {
        set({ isProfileModalOpen: false, profiles: getProfiles() });
        return;
      }

      const targetProfile = setActiveProfileId(profileId);
      if (!targetProfile) return;

      get().reloadActiveProfileState();
      set({
        isProfileModalOpen: false,
        statusAnnouncement: `Switched profile to ${getProfileDisplayName(targetProfile)}.`,
      });
    },

    createAndSwitchProfile: (input) => {
      const created = createProfile(input);
      get().switchProfile(created.id);
      set({
        isProfileModalOpen: false,
        statusAnnouncement: `Created and switched to profile ${getProfileDisplayName(created)}.`,
      });
      return created;
    },

    deleteUserProfile: (profileId) => {
      const wasActive = get().activeProfileId === profileId;
      const deleted = deleteProfile(profileId);
      if (!deleted) return false;

      if (wasActive) {
        get().reloadActiveProfileState();
        const fallbackProfile = getProfiles().find((p) => p.id === get().activeProfileId);
        set({
          statusAnnouncement: fallbackProfile
            ? `Profile deleted. Switched to ${getProfileDisplayName(fallbackProfile)}.`
            : 'Profile deleted.',
        });
      } else {
        set({
          profiles: getProfiles(),
          statusAnnouncement: 'Profile deleted.',
        });
      }
      return true;
    },

    resetActivityToStarter: () => {
      const state = get();
      if (state.appMode !== 'curriculum') return;

      const activity =
        getActivityAtVersion(state.activeActivityId, state.activeActivityVersion) ??
        getActivityLatest(state.activeActivityId);
      if (!activity) return;

      get().pause();

      const activeTab =
        activity.format === 'explanation' &&
        activity.demoTabs &&
        state.activeDemoTabIndex > 0 &&
        activity.demoTabs[state.activeDemoTabIndex]
          ? activity.demoTabs[state.activeDemoTabIndex]
          : undefined;

      const referenceStarterWs =
        activeTab?.workspace ?? activity.starterWorkspace ?? activity.demoTabs?.[0]?.workspace;

      const hasChangedFromStarter =
        JSON.stringify(normalizeWorkspaceForCompare(state.workspace)) !==
        JSON.stringify(normalizeWorkspaceForCompare(referenceStarterWs));

      if (hasChangedFromStarter) {
        recordMutation('Reset to starter');
      }

      const starterWs = referenceStarterWs
        ? cloneWorkspaceWithFreshIds(referenceStarterWs)
        : createEmptyWorkspace();

      const prevFitToView = state.grid.fitToView ?? false;
      const nextGrid =
        activeTab?.gridState
          ? createCurriculumGridState(activeTab.gridState, prevFitToView)
          : undefined;

      set({
        workspace: starterWs,
        ...(nextGrid ? { grid: nextGrid } : {}),
        curriculumWorkspaces: {
          ...state.curriculumWorkspaces,
          [activity.id]: cloneWorkspace(starterWs),
        },
        selectedBlockId: null,
        activeScope: 'MAIN',
        runtime: null,
        statusAnnouncement: hasChangedFromStarter
          ? `Reset Activity ${activity.id} to starter blocks. Press Undo to restore your previous blocks.`
          : `Activity ${activity.id} reset to starter.`,
      });

      persistActiveWorkspace(starterWs, {
        appMode: 'curriculum',
        activityId: activity.id,
        activityVersion: activity.version,
      });

      get().reset();
      get().runInstantIfActive();
    },

    setAppMode: (mode) => {
      const state = get();
      if (mode === state.appMode) return;

      get().pause();
      get().clearHistory();

      if (mode === 'curriculum') {
        const nextSandboxSnapshot = buildSandboxSnapshot(state);
        const activity =
          getActivityAtVersion(state.activeActivityId, state.activeActivityVersion) ??
          getActivityLatest(state.activeActivityId) ??
          CURRICULUM_ACTIVITIES[0];

        if (!activity) return;

        const savedTabIdx =
          activity.format === 'explanation' && activity.demoTabs?.length
            ? Math.min(
                Math.max(0, state.demoTabIndexByActivity[activity.id] ?? 0),
                activity.demoTabs.length - 1
              )
            : 0;
        const activeTab =
          savedTabIdx > 0 ? activity.demoTabs?.[savedTabIdx] : undefined;

        const targetSimId: 'grid' | 'turtle' | 'beat' = resolveCurriculumSimId(activity.simId);
        const prevFitToView = state.grid.fitToView ?? false;
        const resolvedGridDef =
          activeTab?.gridState ?? activity.grid ?? activity.demoTabs?.[0]?.gridState;
        const targetGrid = resolvedGridDef
          ? createCurriculumGridState(resolvedGridDef, prevFitToView)
          : state.grid;

        const targetWs = state.curriculumWorkspaces[activity.id]
          ? cloneWorkspace(state.curriculumWorkspaces[activity.id])
          : activeTab?.workspace
          ? cloneWorkspaceWithFreshIds(activeTab.workspace)
          : activity.starterWorkspace
          ? cloneWorkspaceWithFreshIds(activity.starterWorkspace)
          : activity.demoTabs?.[0]?.workspace
          ? cloneWorkspaceWithFreshIds(activity.demoTabs[0].workspace)
          : createEmptyWorkspace();

        const allowedScopes: ScopeType[] =
          activity.palette.allowedScopes && activity.palette.allowedScopes.length > 0
            ? activity.palette.allowedScopes
            : ['MAIN'];
        const initialScope: ScopeType = allowedScopes.includes('MAIN') ? 'MAIN' : allowedScopes[0];

        set({
          appMode: 'curriculum',
          activeActivityId: activity.id,
          activeActivityVersion: activity.version,
          activeDemoTabIndex: savedTabIdx,
          activeSimId: targetSimId,
          grid: targetGrid,
          turtleState: createInitialTurtleState(),
          beatState: resetBeatState(state.beatState),
          workspace: targetWs,
          curriculumWorkspaces: {
            ...state.curriculumWorkspaces,
            [activity.id]: cloneWorkspace(targetWs),
          },
          sandboxSnapshot: nextSandboxSnapshot,
          editorTool: 'NONE',
          selectedBlockId: null,
          activeScope: initialScope,
          isFunctionBarOpen: allowedScopes.some((sc) => sc !== 'MAIN'),
          isVictoryModalOpen: false,
          victoryEarnedBadges: [],
          runtime: null,
          ghostPreview: null,
          slotCapRejectionCount: 0,
          lastSlotCapRejectedAt: null,
          statusAnnouncement: `Learn mode: Activity ${activity.id} ${activity.title}. Map is read-only.`,
        });

        get().reset();
        get().runInstantIfActive();
      } else {
        const nextCurriculumWorkspaces = {
          ...state.curriculumWorkspaces,
          [state.activeActivityId]: cloneWorkspace(state.workspace),
        };

        const snap = state.sandboxSnapshot;
        const restoredSimId: 'grid' | 'turtle' | 'beat' = snap?.activeSimId ?? 'grid';
        const restoredLevel = snap?.currentLevel ?? state.currentLevel;
        const prevFitToView = state.grid.fitToView ?? false;
        const fallbackPreset =
          PRESET_LEVELS.find((p) => p.id === restoredLevel) || PRESET_LEVELS[0];
        const restoredGrid = snap
          ? getInitialGridState({
              ...JSON.parse(JSON.stringify(snap.grid)),
              fitToView: prevFitToView,
            })
          : createGridFromPreset(fallbackPreset, prevFitToView);
        const restoredTurtle = snap
          ? getInitialTurtleState(JSON.parse(JSON.stringify(snap.turtleState)))
          : createInitialTurtleState();
        const restoredBeat = snap?.beatState
          ? getInitialBeatState({
              ...JSON.parse(JSON.stringify(snap.beatState)),
              isMuted: state.beatState.isMuted,
            })
          : resetBeatState(state.beatState);
        const restoredWs = snap
          ? cloneWorkspace(snap.workspace)
          : state.savedWorkspaces[restoredSimId]
          ? cloneWorkspace(state.savedWorkspaces[restoredSimId])
          : createEmptyWorkspace();
        const restoredSaved: Record<string, WorkspaceState> = {};
        if (snap) {
          for (const [k, ws] of Object.entries(snap.savedWorkspaces)) {
            restoredSaved[k] = cloneWorkspace(ws);
          }
        } else {
          for (const [k, ws] of Object.entries(state.savedWorkspaces)) {
            restoredSaved[k] = cloneWorkspace(ws);
          }
        }

        set({
          appMode: 'sandbox',
          activeSimId: restoredSimId,
          currentLevel: restoredLevel,
          grid: restoredGrid,
          turtleState: restoredTurtle,
          beatState: restoredBeat,
          workspace: restoredWs,
          savedWorkspaces: restoredSaved,
          curriculumWorkspaces: nextCurriculumWorkspaces,
          editorTool: 'NONE',
          selectedBlockId: null,
          activeScope: 'MAIN',
          runtime: null,
          ghostPreview: null,
          slotCapRejectionCount: 0,
          lastSlotCapRejectedAt: null,
          statusAnnouncement: 'Sandbox mode: map and blocks are editable.',
        });

        get().reset();
        get().runInstantIfActive();
      }
    },

    setCurriculumActivity: (activityId, version) => {
      const activity =
        version !== undefined
          ? getActivityAtVersion(activityId, version)
          : getActivityLatest(activityId);
      if (!activity) return;

      const state = get();
      get().pause();
      get().clearHistory();

      const nextSandboxSnapshot =
        state.appMode === 'sandbox' ? buildSandboxSnapshot(state) : state.sandboxSnapshot;

      const nextCurriculumWorkspaces =
        state.appMode === 'curriculum'
          ? {
              ...state.curriculumWorkspaces,
              [state.activeActivityId]: cloneWorkspace(state.workspace),
            }
          : { ...state.curriculumWorkspaces };

      const savedTabIdx =
        activity.format === 'explanation' && activity.demoTabs?.length
          ? Math.min(
              Math.max(0, state.demoTabIndexByActivity[activity.id] ?? 0),
              activity.demoTabs.length - 1
            )
          : 0;
      const activeTab =
        savedTabIdx > 0 ? activity.demoTabs?.[savedTabIdx] : undefined;

      const targetSimId: 'grid' | 'turtle' | 'beat' = resolveCurriculumSimId(activity.simId);
      const prevFitToView = state.grid.fitToView ?? false;
      const resolvedGridDef =
        activeTab?.gridState ?? activity.grid ?? activity.demoTabs?.[0]?.gridState;
      const targetGrid = resolvedGridDef
        ? createCurriculumGridState(resolvedGridDef, prevFitToView)
        : state.grid;

      const targetWs = nextCurriculumWorkspaces[activity.id]
        ? cloneWorkspace(nextCurriculumWorkspaces[activity.id])
        : activeTab?.workspace
        ? cloneWorkspaceWithFreshIds(activeTab.workspace)
        : activity.starterWorkspace
        ? cloneWorkspaceWithFreshIds(activity.starterWorkspace)
        : activity.demoTabs?.[0]?.workspace
        ? cloneWorkspaceWithFreshIds(activity.demoTabs[0].workspace)
        : createEmptyWorkspace();

      nextCurriculumWorkspaces[activity.id] = cloneWorkspace(targetWs);
      const allowedScopes: ScopeType[] =
        activity.palette.allowedScopes && activity.palette.allowedScopes.length > 0
          ? activity.palette.allowedScopes
          : ['MAIN'];
      const initialScope: ScopeType = allowedScopes.includes('MAIN') ? 'MAIN' : allowedScopes[0];

      set({
        appMode: 'curriculum',
        activeActivityId: activity.id,
        activeActivityVersion: activity.version,
        activeDemoTabIndex: savedTabIdx,
        activeSimId: targetSimId,
        grid: targetGrid,
        turtleState: createInitialTurtleState(),
        beatState: resetBeatState(state.beatState),
        workspace: targetWs,
        curriculumWorkspaces: nextCurriculumWorkspaces,
        sandboxSnapshot: nextSandboxSnapshot,
        editorTool: 'NONE',
        selectedBlockId: null,
        activeScope: initialScope,
        isFunctionBarOpen: allowedScopes.some((sc) => sc !== 'MAIN'),
        isVictoryModalOpen: false,
        victoryEarnedBadges: [],
        runtime: null,
        ghostPreview: null,
        slotCapRejectionCount: 0,
        lastSlotCapRejectedAt: null,
        statusAnnouncement: `Activity ${activity.id}: ${activity.title}`,
      });

      get().reset();
      get().runInstantIfActive();
    },

    selectExplanationDemoTab: (tabIndex) => {
      const state = get();
      if (state.appMode !== 'curriculum') return;

      const activity =
        getActivityAtVersion(state.activeActivityId, state.activeActivityVersion) ??
        getActivityLatest(state.activeActivityId);
      if (!activity || activity.format !== 'explanation' || !activity.demoTabs?.length) {
        return;
      }

      const clampedIndex = Math.min(
        Math.max(0, tabIndex),
        activity.demoTabs.length - 1
      );
      const tab = activity.demoTabs[clampedIndex];
      if (!tab) return;

      get().pause();
      get().clearHistory();

      const prevFitToView = state.grid.fitToView ?? false;
      const resolvedGridDef = tab.gridState ?? activity.grid;
      const nextGrid = resolvedGridDef
        ? createCurriculumGridState(resolvedGridDef, prevFitToView)
        : state.grid;
      const nextWs = cloneWorkspaceWithFreshIds(tab.workspace);

      set({
        activeDemoTabIndex: clampedIndex,
        demoTabIndexByActivity: {
          ...state.demoTabIndexByActivity,
          [activity.id]: clampedIndex,
        },
        grid: nextGrid,
        turtleState: createInitialTurtleState(),
        beatState: resetBeatState(state.beatState),
        workspace: nextWs,
        curriculumWorkspaces: {
          ...state.curriculumWorkspaces,
          [activity.id]: cloneWorkspace(nextWs),
        },
        selectedBlockId: null,
        activeScope: 'MAIN',
        runtime: null,
        ghostPreview: null,
        slotCapRejectionCount: 0,
        lastSlotCapRejectedAt: null,
        statusAnnouncement: `Example ${clampedIndex + 1} of ${activity.demoTabs.length}${
          tab.title ? `: ${tab.title}` : ''
        }. Press Play or Step to watch.`,
      });

      get().reset();
      get().runInstantIfActive();
    },

    markActiveDemoTabExplored: () => {
      markDemoTabExploredInternal(true);
    },

    completeExplanationAndContinue: () => {
      const state = get();
      if (state.appMode !== 'curriculum') return null;

      const activity =
        getActivityAtVersion(state.activeActivityId, state.activeActivityVersion) ??
        getActivityLatest(state.activeActivityId);
      if (!activity || activity.format !== 'explanation') return null;

      get().pause();

      markLessonCompleted(state.activeProfileId, activity.id, activity.version);
      const nextCompleted = {
        ...state.completedActivities,
        [activity.id]: true,
      };
      set({
        completedActivities: nextCompleted,
      });

      const currentIdx = CURRICULUM_ACTIVITIES.findIndex((a) => a.id === activity.id);
      const nextActivity =
        currentIdx >= 0 && currentIdx < CURRICULUM_ACTIVITIES.length - 1
          ? CURRICULUM_ACTIVITIES[currentIdx + 1]
          : undefined;

      if (nextActivity) {
        get().setCurriculumActivity(nextActivity.id, nextActivity.version);
        set({
          completedActivities: {
            ...get().completedActivities,
            [activity.id]: true,
          },
          statusAnnouncement: `Completed Activity ${activity.id}: ${activity.title}. Advancing to Activity ${nextActivity.id}: ${nextActivity.title}.`,
        });
        return nextActivity.id;
      }

      set({
        statusAnnouncement: `Completed Activity ${activity.id}: ${activity.title}.`,
      });
      return null;
    },

    completeCreativeActivity: (advanceToNext = false) => {
      const state = get();
      if (state.appMode !== 'curriculum') return null;

      const activity = getActiveCurriculumActivityObj();
      if (!activity || !isCreativeCurriculumActivity(activity)) return null;

      get().pause();

      const res = markLessonCompleted(state.activeProfileId, activity.id, activity.version);
      const nextCompleted = {
        ...state.completedActivities,
        [activity.id]: true,
      };
      set({
        completedActivities: nextCompleted,
      });

      if (activity.format === 'capstone' || res.newlyEarnedBadges.length > 0) {
        if (!state.beatState.isMuted && state.speed !== 'instant' && (state.speed as any) !== 0) {
          beatSynth.unlockFromGesture();
        }
        triggerVictoryModal(
          res.newlyEarnedBadges,
          state.speed !== 'instant' && (state.speed as any) !== 0
        );
        if (res.newlyEarnedBadges.length === 0) {
          set({
            statusAnnouncement: `Completed Activity ${activity.id}: ${activity.title}!`,
          });
        }
        return activity.id;
      }

      if (advanceToNext) {
        const currentIdx = CURRICULUM_ACTIVITIES.findIndex((a) => a.id === activity.id);
        const nextActivity =
          currentIdx >= 0 && currentIdx < CURRICULUM_ACTIVITIES.length - 1
            ? CURRICULUM_ACTIVITIES[currentIdx + 1]
            : undefined;
        if (nextActivity) {
          get().setCurriculumActivity(nextActivity.id, nextActivity.version);
          set({
            completedActivities: {
              ...get().completedActivities,
              [activity.id]: true,
            },
            statusAnnouncement: `Completed Activity ${activity.id}: ${activity.title}. Advancing to Activity ${nextActivity.id}: ${nextActivity.title}.`,
          });
          return nextActivity.id;
        }
      }

      set({
        statusAnnouncement: `Completed Activity ${activity.id}: ${activity.title}.`,
      });
      return null;
    },

    openCopyInSandbox: () => {
      const state = get();
      if (state.appMode !== 'curriculum') return;

      get().pause();
      get().clearHistory();

      const nextCurriculumWorkspaces = {
        ...state.curriculumWorkspaces,
        [state.activeActivityId]: cloneWorkspace(state.workspace),
      };

      saveLessonAutosave(
        state.activeProfileId,
        state.activeActivityId,
        state.workspace,
        state.activeActivityVersion
      );

      const clonedWs = cloneWorkspaceWithFreshIds(state.workspace);
      const clonedGrid = getInitialGridState(JSON.parse(JSON.stringify(state.grid)));
      const clonedTurtle = getInitialTurtleState(JSON.parse(JSON.stringify(state.turtleState)));
      const clonedBeat = getInitialBeatState(JSON.parse(JSON.stringify(state.beatState)));

      const baseSaved = state.sandboxSnapshot?.savedWorkspaces ?? state.savedWorkspaces;
      const nextSavedWorkspaces: Record<string, WorkspaceState> = {};
      for (const [k, ws] of Object.entries(baseSaved)) {
        nextSavedWorkspaces[k] = cloneWorkspace(ws);
      }
      nextSavedWorkspaces[state.activeSimId] = cloneWorkspace(clonedWs);
      saveSandboxAutosave(state.activeProfileId, state.activeSimId, clonedWs);

      set({
        appMode: 'sandbox',
        grid: clonedGrid,
        turtleState: clonedTurtle,
        beatState: clonedBeat,
        workspace: clonedWs,
        savedWorkspaces: nextSavedWorkspaces,
        curriculumWorkspaces: nextCurriculumWorkspaces,
        sandboxSnapshot: {
          activeSimId: state.activeSimId,
          currentLevel: state.currentLevel,
          grid: JSON.parse(JSON.stringify(clonedGrid)),
          turtleState: JSON.parse(JSON.stringify(clonedTurtle)),
          beatState: JSON.parse(JSON.stringify(clonedBeat)),
          workspace: cloneWorkspace(clonedWs),
          savedWorkspaces: nextSavedWorkspaces,
        },
        editorTool: 'NONE',
        selectedBlockId: null,
        activeScope: 'MAIN',
        runtime: null,
        ghostPreview: null,
        isMobileMenuOpen: false,
        slotCapRejectionCount: 0,
        lastSlotCapRejectedAt: null,
        statusAnnouncement: `Opened editable copy of Activity ${state.activeActivityId} in Sandbox mode.`,
      });

      get().reset();
      get().runInstantIfActive();
    },

    loadVariationWorkspace: (variationWorkspace, title) => {
      get().pause();
      recordMutation(title ? `Load variation: ${title}` : 'Load variation');
      get().reset();

      const newWorkspace = cloneWorkspaceWithFreshIds(variationWorkspace);
      const announcement = title
        ? `Loaded variation: ${title}. Press Undo to restore previous blocks.`
        : 'Loaded variation into workspace. Press Undo to restore previous blocks.';

      set((state) => ({
        workspace: newWorkspace,
        ...(state.appMode === 'curriculum'
          ? {
              curriculumWorkspaces: {
                ...state.curriculumWorkspaces,
                [state.activeActivityId]: cloneWorkspace(newWorkspace),
              },
            }
          : {
              savedWorkspaces: {
                ...state.savedWorkspaces,
                [state.activeSimId]: cloneWorkspace(newWorkspace),
              },
            }),
        activeScope: 'MAIN',
        selectedBlockId: null,
        runtime: null,
        statusAnnouncement: announcement,
      }));

      persistActiveWorkspace(get().workspace);
      get().runInstantIfActive();
    },

    setSimEnvironment: (simId) => {
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
        ...(simId === 'beat' && (curSpeed === 'instant' || (curSpeed as any) === 0)
          ? { speed: 400 as SimulationSpeed }
          : {}),
      });

      get().reset();
      get().runInstantIfActive();
    },

    toggleSubpalette: () => set((state) => ({ isSubpaletteCollapsed: !state.isSubpaletteCollapsed })),

    setSubpaletteCollapsed: (collapsed) => set({ isSubpaletteCollapsed: collapsed }),

    toggleMapHidden: () => set((state) => ({ isMapHidden: !state.isMapHidden })),

    setMapHidden: (hidden) => set({ isMapHidden: hidden }),

    toggleFunctionBar: () => set((state) => ({ isFunctionBarOpen: !state.isFunctionBarOpen })),

    setFunctionBarOpen: (open) => set({ isFunctionBarOpen: open }),

    toggleMobileMenu: () => set((state) => ({ isMobileMenuOpen: !state.isMobileMenuOpen })),

    setMobileMenuOpen: (open) => set({ isMobileMenuOpen: open }),

    setSolutionOpen: (open) => set({ isSolutionOpen: open }),

    setExportImportOpen: (open) => set({ isExportImportOpen: open }),

    setSaveModalOpen: (open) => set({ isSaveModalOpen: open }),

    setLoadModalOpen: (open) => set({ isLoadModalOpen: open }),

    setLessonPickerOpen: (open) => set({ isLessonPickerOpen: open }),

    setBadgeModalOpen: (open) => set({ isBadgeModalOpen: open }),

    toggleUnlockAllModules: () => {
      const s = get();
      const currentProgress = getProfileProgress(s.activeProfileId);
      const nextUnlockAll = !currentProgress.unlockAllModules;
      const updated = setUnlockAllModules(s.activeProfileId, nextUnlockAll);
      set({
        unlockAllModules: Boolean(updated.unlockAllModules),
        statusAnnouncement: nextUnlockAll
          ? 'All curriculum modules unlocked.'
          : 'Sequential module unlock restored.',
      });
    },

    dismissVictoryModal: () => set({ isVictoryModalOpen: false, victoryEarnedBadges: [] }),

    exportCode: (includeMap = true) => {
      const {
        appMode,
        activeActivityId,
        activeActivityVersion,
        activeSimId,
        workspace,
        grid,
        turtleState,
        beatState,
      } = get();

      if (appMode === 'curriculum') {
        if (includeMap) {
          return exportLessonToString(
            workspace,
            activeSimId,
            activeActivityId,
            activeActivityVersion
          );
        }
        if (activeSimId === 'grid') {
          return exportToString(workspace, 'generic');
        }
        if (activeSimId === 'beat') {
          return exportToString(workspace, 'beat', beatState);
        }
        return exportToString(workspace, 'turtle', turtleState);
      }

      if (activeSimId === 'grid') {
        if (includeMap) {
          return exportToString(workspace, 'grid', grid);
        } else {
          return exportToString(workspace, 'generic');
        }
      } else if (activeSimId === 'beat') {
        return exportToString(workspace, 'beat', beatState);
      } else {
        return exportToString(workspace, 'turtle', turtleState);
      }
    },

    exportBinary: (includeMap = true) => {
      const {
        appMode,
        activeActivityId,
        activeActivityVersion,
        activeSimId,
        workspace,
        grid,
        turtleState,
        beatState,
      } = get();

      if (appMode === 'curriculum') {
        if (includeMap) {
          return exportLessonToBinary(
            workspace,
            activeSimId,
            activeActivityId,
            activeActivityVersion
          );
        }
        if (activeSimId === 'grid') {
          return exportToBinary(workspace, 'generic');
        }
        if (activeSimId === 'beat') {
          return exportToBinary(workspace, 'beat', beatState);
        }
        return exportToBinary(workspace, 'turtle', turtleState);
      }

      if (activeSimId === 'grid') {
        if (includeMap) {
          return exportToBinary(workspace, 'grid', grid);
        } else {
          return exportToBinary(workspace, 'generic');
        }
      } else if (activeSimId === 'beat') {
        return exportToBinary(workspace, 'beat', beatState);
      } else {
        return exportToBinary(workspace, 'turtle', turtleState);
      }
    },

    importBinary: (data: Uint8Array) => {
      return get().importCode(data);
    },

    importCode: (data: string | Uint8Array) => {
      const res = typeof data === 'string' ? importFromString(data) : importFromBinary(data);
      if (!res.success) {
        return { success: false, error: res.error || 'Failed to import code' };
      }

      // Path B: Standalone Curriculum Lesson Envelope (`ENV_ID_LESSON = 0x04`)
      if (res.envId === 'lesson') {
        const lessonId = res.lessonId || '';
        const latest = getActivityLatest(lessonId);
        if (!latest) {
          return { success: false, error: `Unknown curriculum lesson: ${lessonId}` };
        }

        const savedVersion = res.lessonVersion ?? 1;
        const loadedWorkspace = res.workspace || createEmptyWorkspace();

        if (savedVersion !== latest.version) {
          const hasHistorical = Boolean(getActivityAtVersion(lessonId, savedVersion));
          get().pause();
          set({
            pendingVersionMismatch: {
              source: 'share',
              lessonId,
              savedVersion,
              latestVersion: latest.version,
              workspace: cloneWorkspace(loadedWorkspace),
              hasHistoricalVersion: hasHistorical,
            },
            isExportImportOpen: false,
            isLoadModalOpen: false,
            statusAnnouncement: `Lesson version mismatch for Activity ${lessonId}: saved at v${savedVersion}, latest is v${latest.version}. Choose how to open it.`,
          });
          return { success: true, versionMismatchPending: true };
        }

        return applyLessonWorkspaceLoad(lessonId, latest.version, loadedWorkspace);
      }

      // Importing a full environment snapshot (custom Grid map, Turtle drawing, or Beat program)
      // while in Curriculum mode switches cleanly to Sandbox so read-only lesson maps are never mutated.
      if (
        get().appMode === 'curriculum' &&
        (res.envId === 'turtle' ||
          res.envId === 'beat' ||
          (res.envId === 'grid' && Boolean(res.gridState)))
      ) {
        get().setAppMode('sandbox');
      }

      recordMutation('Import code');

      get().pause();

      const { appMode, activeActivityId, curriculumWorkspaces, activeSimId, workspace, savedWorkspaces } = get();
      const newWorkspace = res.workspace || createEmptyWorkspace();

      if (appMode === 'curriculum') {
        set({
          workspace: newWorkspace,
          curriculumWorkspaces: {
            ...curriculumWorkspaces,
            [activeActivityId]: cloneWorkspace(newWorkspace),
          },
          runtime: null,
          selectedBlockId: null,
          activeScope: 'MAIN',
        });
        persistActiveWorkspace(newWorkspace, { appMode: 'curriculum' });
      } else if (res.envId === 'turtle') {
        const updatedSavedWorkspaces: Record<string, WorkspaceState> = { ...savedWorkspaces };
        if (activeSimId !== 'turtle') {
          updatedSavedWorkspaces[activeSimId] = cloneWorkspace(workspace);
          saveSandboxAutosave(get().activeProfileId, activeSimId, workspace);
        }
        updatedSavedWorkspaces['turtle'] = cloneWorkspace(newWorkspace);
        saveSandboxAutosave(get().activeProfileId, 'turtle', newWorkspace);

        set({
          activeSimId: 'turtle',
          turtleState: createInitialTurtleState(),
          workspace: newWorkspace,
          savedWorkspaces: updatedSavedWorkspaces,
          runtime: null,
          selectedBlockId: null,
          activeScope: 'MAIN',
        });
      } else if (res.envId === 'beat') {
        const updatedSavedWorkspaces: Record<string, WorkspaceState> = { ...savedWorkspaces };
        if (activeSimId !== 'beat') {
          updatedSavedWorkspaces[activeSimId] = cloneWorkspace(workspace);
          saveSandboxAutosave(get().activeProfileId, activeSimId, workspace);
        }
        updatedSavedWorkspaces['beat'] = cloneWorkspace(newWorkspace);
        saveSandboxAutosave(get().activeProfileId, 'beat', newWorkspace);

        set({
          activeSimId: 'beat',
          beatState: resetBeatState(get().beatState),
          workspace: newWorkspace,
          savedWorkspaces: updatedSavedWorkspaces,
          runtime: null,
          selectedBlockId: null,
          activeScope: 'MAIN',
        });
      } else if (res.envId === 'grid') {
        const updatedSavedWorkspaces: Record<string, WorkspaceState> = { ...savedWorkspaces };
        if (activeSimId !== 'grid') {
          updatedSavedWorkspaces[activeSimId] = cloneWorkspace(workspace);
          saveSandboxAutosave(get().activeProfileId, activeSimId, workspace);
        }
        updatedSavedWorkspaces['grid'] = cloneWorkspace(newWorkspace);
        saveSandboxAutosave(get().activeProfileId, 'grid', newWorkspace);

        set({
          activeSimId: 'grid',
          workspace: newWorkspace,
          savedWorkspaces: updatedSavedWorkspaces,
          ...(res.gridState ? { grid: res.gridState } : {}),
          runtime: null,
          selectedBlockId: null,
          activeScope: 'MAIN',
        });
      } else {
        set({
          workspace: newWorkspace,
          savedWorkspaces: {
            ...savedWorkspaces,
            [activeSimId]: cloneWorkspace(newWorkspace),
          },
          runtime: null,
          selectedBlockId: null,
          activeScope: 'MAIN',
        });
        saveSandboxAutosave(get().activeProfileId, activeSimId, newWorkspace);
      }

      get().reset();
      get().runInstantIfActive();
      return { success: true };
    },

    loadSavedProgram: (entry) => {
      if (entry.lessonId) {
        const res = importFromString(entry.code);
        if (!res.success) {
          return { success: false, error: res.error || 'Failed to decode saved lesson program' };
        }

        const latest = getActivityLatest(entry.lessonId);
        if (!latest) {
          return { success: false, error: `Unknown curriculum lesson: ${entry.lessonId}` };
        }

        const savedVersion = entry.lessonVersion ?? 1;
        const loadedWorkspace = res.workspace || createEmptyWorkspace();

        if (savedVersion !== latest.version) {
          const hasHistorical = Boolean(getActivityAtVersion(entry.lessonId, savedVersion));
          get().pause();
          set({
            pendingVersionMismatch: {
              source: 'slot',
              lessonId: entry.lessonId,
              savedVersion,
              latestVersion: latest.version,
              workspace: cloneWorkspace(loadedWorkspace),
              hasHistoricalVersion: hasHistorical,
              title: entry.title,
              slotIndex: entry.slotIndex,
            },
            isLoadModalOpen: false,
            statusAnnouncement: `Lesson version mismatch for ${entry.title}: saved at v${savedVersion}, latest is v${latest.version}. Choose how to open it.`,
          });
          return { success: true, versionMismatchPending: true };
        }

        return applyLessonWorkspaceLoad(
          entry.lessonId,
          latest.version,
          loadedWorkspace,
          `Loaded "${entry.title}" into Activity ${latest.id} (v${latest.version}): ${latest.title}.`
        );
      }

      // Legacy v1 save or Free-Play Sandbox save (no `lessonId`):
      // Always open in Free-Play Sandbox with embedded state intact.
      const decoded = importFromString(entry.code);
      if (!decoded.success) {
        return { success: false, error: decoded.error || 'Failed to decode saved program' };
      }

      if (get().appMode === 'curriculum') {
        get().setAppMode('sandbox');
      }

      if (entry.simId === 'grid' && entry.levelId !== undefined && !decoded.gridState) {
        get().setLevel(entry.levelId);
      } else if (decoded.envId === 'generic' && entry.simId !== get().activeSimId) {
        get().setSimEnvironment(entry.simId);
      }

      const importRes = get().importCode(entry.code);
      if (importRes.success && entry.simId === 'grid' && entry.levelId !== undefined) {
        set({ currentLevel: entry.levelId });
      }
      return importRes;
    },

    resolveVersionMismatch: (choice) => {
      const pending = get().pendingVersionMismatch;
      if (!pending) return false;

      if (choice === 'original') {
        if (!pending.hasHistoricalVersion) return false;
        const res = applyLessonWorkspaceLoad(
          pending.lessonId,
          pending.savedVersion,
          pending.workspace,
          `Opened Activity ${pending.lessonId} in original version v${pending.savedVersion}.`
        );
        return res.success;
      }

      const res = applyLessonWorkspaceLoad(
        pending.lessonId,
        pending.latestVersion,
        pending.workspace,
        `Loaded saved v${pending.savedVersion} blocks into latest Activity ${pending.lessonId} (v${pending.latestVersion}).`
      );
      return res.success;
    },

    dismissVersionMismatch: () => {
      if (!get().pendingVersionMismatch) return;
      set({
        pendingVersionMismatch: null,
        statusAnnouncement: 'Cancelled loading mismatched lesson version.',
      });
    },

    loadSolution: (lessonId) => {
      if (get().appMode === 'curriculum' && lessonId === undefined) {
        const { activeActivityId, activeActivityVersion } = get();
        const activity =
          getActivityAtVersion(activeActivityId, activeActivityVersion) ??
          getActivityLatest(activeActivityId);
        if (!activity?.referenceSolution) return;

        recordMutation('Load solution');
        get().reset();

        const newWorkspace = cloneWorkspaceWithFreshIds(activity.referenceSolution);
        set((state) => ({
          workspace: newWorkspace,
          curriculumWorkspaces: {
            ...state.curriculumWorkspaces,
            [state.activeActivityId]: cloneWorkspace(newWorkspace),
          },
          activeScope: 'MAIN',
          selectedBlockId: null,
          ghostPreview: null,
          statusAnnouncement: `Loaded full reference solution for ${activity.title}. Press Undo to restore your previous blocks.`,
        }));
        persistActiveWorkspace(newWorkspace, { appMode: 'curriculum' });
        get().runInstantIfActive();
        return;
      }

      if (get().appMode === 'curriculum') {
        get().setAppMode('sandbox');
      }

      const id = lessonId ?? get().currentLevel;
      const lesson = LESSONS.find((l) => l.id === id);
      if (!lesson) return;

      recordMutation('Load solution');

      get().reset();

      const cloneBlocks = (blocks: CodeBlock[]) =>
        blocks.map((b) => ({
          ...b,
          id: `${b.type}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        }));

      const newWorkspace = {
        MAIN: cloneBlocks(lesson.solution.MAIN),
        F1: cloneBlocks(lesson.solution.F1 || []),
        F2: cloneBlocks(lesson.solution.F2 || []),
        F3: cloneBlocks(lesson.solution.F3 || []),
      };

      set({
        workspace: newWorkspace,
        savedWorkspaces: {
          ...get().savedWorkspaces,
          [get().activeSimId]: cloneWorkspace(newWorkspace),
        },
        activeScope: 'MAIN',
        selectedBlockId: null,
        ghostPreview: null,
      });
      persistActiveWorkspace(newWorkspace, { appMode: 'sandbox' });
      get().runInstantIfActive();
    },

    triggerGhostPreview: () => {
      const { appMode, activeActivityId, activeActivityVersion, grid, ghostPreview } = get();
      if (appMode !== 'curriculum') return false;

      const activity =
        getActivityAtVersion(activeActivityId, activeActivityVersion) ??
        getActivityLatest(activeActivityId);
      if (!activity?.partialHelp?.ghostPreview) return false;

      get().pause();
      const poses = computeGhostPreviewSteps(grid, activity.partialHelp.ghostPreview);
      const stepTotal = Math.max(0, poses.length - 1);

      set({
        isSolutionOpen: false,
        ghostPreview: {
          active: true,
          activityId: activity.id,
          poses,
          currentStepIndex: 0,
          runId: (ghostPreview?.runId ?? 0) + 1,
        },
        statusAnnouncement: `Ghost-step preview started (${stepTotal} ${
          stepTotal === 1 ? 'step' : 'steps'
        }) for ${activity.title}. Your workspace blocks are unchanged.`,
      });
      return true;
    },

    stopGhostPreview: () => {
      if (get().ghostPreview) {
        set({ ghostPreview: null });
      }
    },

    advanceGhostPreviewStep: () => {
      const gp = get().ghostPreview;
      if (!gp || !gp.active || gp.poses.length === 0) return;
      set({
        ghostPreview: {
          ...gp,
          currentStepIndex: (gp.currentStepIndex + 1) % gp.poses.length,
        },
      });
    },

    loadPartialScaffold: () => {
      if (get().appMode !== 'curriculum') return false;
      const { activeActivityId, activeActivityVersion } = get();
      const activity =
        getActivityAtVersion(activeActivityId, activeActivityVersion) ??
        getActivityLatest(activeActivityId);
      const scaffoldTemplate = resolveActivityScaffoldWorkspace(activity);
      if (!scaffoldTemplate) return false;

      recordMutation('Load starter scaffold');
      get().reset();

      const newWorkspace = cloneWorkspaceWithFreshIds(scaffoldTemplate);
      let firstPlaceholderId: string | null = null;
      let targetScope: ScopeType = 'MAIN';
      for (const sc of ['MAIN', 'F1', 'F2', 'F3'] as ScopeType[]) {
        const found = newWorkspace[sc].find((b) => b.type === 'PLACEHOLDER');
        if (found) {
          firstPlaceholderId = found.id;
          targetScope = sc;
          break;
        }
      }

      set((state) => ({
        workspace: newWorkspace,
        curriculumWorkspaces: {
          ...state.curriculumWorkspaces,
          [state.activeActivityId]: cloneWorkspace(newWorkspace),
        },
        activeScope: targetScope,
        selectedBlockId: firstPlaceholderId,
        isSolutionOpen: false,
        ghostPreview: null,
        statusAnnouncement: `Loaded starter ? scaffold${
          activity?.title ? ` for ${activity.title}` : ''
        }. Select a highlighted block in the palette to fill ?, or press Undo to restore your previous blocks.`,
      }));
      persistActiveWorkspace(get().workspace);
      get().runInstantIfActive();
      return true;
    },

    replacePlaceholderBlock: (scope, placeholderBlockId, newType, params) => {
      const currentBlocks = get().workspace[scope] || [];
      const targetIdx = currentBlocks.findIndex(
        (b) => b.id === placeholderBlockId && b.type === 'PLACEHOLDER'
      );
      if (targetIdx === -1) return false;

      const wasSuccess = isCurrentSimSuccess();
      recordMutation('Replace placeholder block');

      const id = `${newType}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const simEnv = getSimEnvironment(get().activeSimId);
      const paletteItem = simEnv?.paletteItems.find((p) => p.actionType === newType);
      const resolvedParams =
        params ?? (paletteItem?.params ? { ...paletteItem.params } : undefined);
      const newBlock: CodeBlock = { id, type: newType, params: resolvedParams };

      const nextBlocks = [...currentBlocks];
      if (newType === 'LOOP_START') {
        const candidateSingle = [...currentBlocks];
        candidateSingle.splice(targetIdx, 1, newBlock);
        const loopCheck = validateLoopStructure(candidateSingle);
        if (loopCheck.unclosedLoopStartIds.includes(newBlock.id)) {
          const endBlock: CodeBlock = {
            id: `LOOP_END_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            type: 'LOOP_END',
          };
          nextBlocks.splice(targetIdx, 1, newBlock, endBlock);
        } else {
          nextBlocks.splice(targetIdx, 1, newBlock);
        }
      } else {
        nextBlocks.splice(targetIdx, 1, newBlock);
      }

      set((state) => {
        const nextWorkspace: WorkspaceState = {
          ...state.workspace,
          [scope]: nextBlocks,
        };
        const updatedRuntime =
          state.runtime && state.runtime.activeBlockId === placeholderBlockId
            ? { ...state.runtime, activeBlockId: newBlock.id }
            : state.runtime;

        return {
          workspace: nextWorkspace,
          ...(state.appMode === 'curriculum'
            ? {
                curriculumWorkspaces: {
                  ...state.curriculumWorkspaces,
                  [state.activeActivityId]: cloneWorkspace(nextWorkspace),
                },
              }
            : {
                savedWorkspaces: {
                  ...state.savedWorkspaces,
                  [state.activeSimId]: cloneWorkspace(nextWorkspace),
                },
              }),
          activeScope: scope,
          selectedBlockId: newBlock.id,
          runtime: updatedRuntime,
          ghostPreview: null,
          statusAnnouncement: 'Replaced ? placeholder block. Press Undo to restore ?.',
        };
      });

      persistActiveWorkspace(get().workspace);
      get().runInstantIfActive({ allowVictoryModal: !wasSuccess });
      return true;
    },

    setLevel: (levelId) => {
      if (get().appMode === 'curriculum') {
        get().setAppMode('sandbox');
      }
      get().clearHistory();
      const prevFitToView = get().grid.fitToView ?? false;
      get().reset();
      const preset = PRESET_LEVELS.find((p) => p.id === levelId) || PRESET_LEVELS[0];
      set({
        currentLevel: levelId,
        grid: createGridFromPreset(preset, prevFitToView),
      });
      get().runInstantIfActive();
    },

    setActiveScope: (scope) => {
      const s = get();
      if (s.appMode === 'curriculum') {
        const activity = resolveActiveCurriculumActivity(
          s.appMode,
          s.activeActivityId,
          s.activeActivityVersion
        );
        if (activity) {
          const allowedScopes: ScopeType[] =
            activity.palette.allowedScopes && activity.palette.allowedScopes.length > 0
              ? activity.palette.allowedScopes
              : ['MAIN'];
          if (!allowedScopes.includes(scope)) {
            return;
          }
        }
      }
      set({ activeScope: scope, selectedBlockId: null, lastSlotCapRejectedAt: null });
    },
    setSelectedBlockId: (id) => set({ selectedBlockId: id }),
    setEditorTool: (tool) => {
      if (get().appMode === 'curriculum' && tool !== 'NONE') return;
      set({ editorTool: tool });
    },
    setEditorKeyGateVariant: (variant) => {
      if (get().appMode === 'curriculum') return;
      set({ editorKeyGateVariant: variant });
    },
    setSpeed: (speed) => {
      const prevSpeed = get().speed;
      const wasInstant = prevSpeed === 'instant' || (prevSpeed as any) === 0;
      let normalizedSpeed: SimulationSpeed =
        speed === 0 || speed === 'instant' ? 'instant' : (speed as SimulationSpeed);
      if (get().activeSimId === 'beat' && normalizedSpeed === 'instant') {
        normalizedSpeed = 400;
      }

      if (normalizedSpeed === 'instant') {
        if (timerId) {
          clearTimeout(timerId);
          timerId = null;
        }
        if (turtleRafId !== null) {
          cancelFrame(turtleRafId);
          turtleRafId = null;
        }
        if (pendingTurtleCommit) {
          const liveTurtle = get().turtleState;
          set({
            turtleState: mergeLiveTurtleViewState(
              pendingTurtleCommit.finalTurtleState,
              liveTurtle
            ),
            runtime: pendingTurtleCommit.finalRuntime,
          });
          pendingTurtleCommit = null;
        }
        beatSynth.stopAll();
        set({ speed: 'instant', isPlaying: false });
        get().runInstantIfActive();
      } else {
        set({ speed: normalizedSpeed });
        if (wasInstant) {
          get().reset();
        } else if (get().activeSimId === 'grid' || get().activeSimId === 'beat') {
          if (get().isPlaying && timerId) {
            clearTimeout(timerId);
            timerId = null;
            const scheduleTick = (delay: number) => {
              timerId = setTimeout(() => {
                timerId = null;
                if (!get().isPlaying) return;
                get().step();
                if (get().isPlaying) {
                  const sp = get().speed;
                  if (typeof sp === 'number' && sp > 0) {
                    scheduleTick(sp);
                  }
                }
              }, delay);
            };
            scheduleTick(normalizedSpeed as number);
          }
        } else {
          // Turtle mode: dynamically scale remaining duration of active animation
          const { turtleState } = get();
          if (turtleState.activeAnimation && typeof prevSpeed === 'number') {
            const anim = turtleState.activeAnimation;
            const ratio = (normalizedSpeed as number) / prevSpeed;
            const newDuration = anim.duration * ratio;
            const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
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
      const { speed, workspace, activeSimId, grid, turtleState, beatState } = get();
      if (speed !== 'instant' && (speed as any) !== 0) return;

      const result = computeInstantSimulation(
        workspace,
        activeSimId,
        grid,
        turtleState,
        beatState
      );
      const isPausedOnPlaceholder = result.status === 'PAUSED';
      const nextRuntime: InterpreterRuntimeState = {
        ...result.finalRuntime,
        activeBlockId: isPausedOnPlaceholder ? result.finalRuntime.activeBlockId : null,
        activeRepeatProgress: null,
      };
      const pauseUpdates = isPausedOnPlaceholder
        ? {
            activeScope: result.finalRuntime.activeScope,
            selectedBlockId: result.finalRuntime.activeBlockId,
            statusAnnouncement: getPlaceholderPauseAnnouncement(workspace, result.finalRuntime),
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
        const reward = recordCurriculumSuccessIfApplicable();
        if (options?.allowVictoryModal) {
          triggerVictoryModal(reward?.newlyEarnedBadges ?? [], false);
        }
      }
      markDemoTabExploredInternal(true);
    },

    addBlock: (scope, type, repeatCount, insertAtIndex, params) => {
      const stateBefore = get();
      if (stateBefore.appMode === 'curriculum') {
        const activity = resolveActiveCurriculumActivity(
          stateBefore.appMode,
          stateBefore.activeActivityId,
          stateBefore.activeActivityVersion
        );
        if (activity) {
          const allowedScopes: ScopeType[] =
            activity.palette.allowedScopes && activity.palette.allowedScopes.length > 0
              ? activity.palette.allowedScopes
              : ['MAIN'];
          if (!allowedScopes.includes(scope)) {
            return;
          }
          const budget = computeSlotBudget(
            stateBefore.workspace,
            scope,
            stateBefore.appMode,
            activity.slotCap
          );
          if (budget.isCapped && budget.isFull) {
            const nextCount = stateBefore.slotCapRejectionCount + 1;
            const baseMsg = formatSlotCapFullAnnouncement(budget, scope, allowedScopes);
            const nextAnnouncement =
              stateBefore.statusAnnouncement === baseMsg ? `${baseMsg} ` : baseMsg;
            set({
              slotCapRejectionCount: nextCount,
              lastSlotCapRejectedAt: Date.now(),
              statusAnnouncement: nextAnnouncement,
            });
            return;
          }
        }
      }

      const wasSuccess = isCurrentSimSuccess();
      recordMutation('Add block');
      const currentState = get();
      const activeActivity =
        currentState.appMode === 'curriculum'
          ? getActivityAtVersion(currentState.activeActivityId, currentState.activeActivityVersion) ??
            getActivityLatest(currentState.activeActivityId)
          : undefined;
      const allowActionParams =
        currentState.appMode !== 'curriculum' ||
        activeActivity?.palette?.allowActionParams !== false;

      const normalizedType =
        currentState.appMode === 'curriculum' &&
        !allowActionParams &&
        currentState.activeSimId === 'turtle'
          ? type === 'MOVE_FWD'
            ? 'FORWARD'
            : type === 'MOVE_BACK'
            ? 'BACKWARD'
            : type
          : type;

      const id = `${normalizedType}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const simEnv = getSimEnvironment(currentState.activeSimId);
      const paletteItem = simEnv?.paletteItems.find((p) => p.actionType === normalizedType);
      const isVariableOrPlaceholderBlock =
        normalizedType === 'VAR_ASSIGN' ||
        normalizedType === 'VAR_OP' ||
        normalizedType === 'PLACEHOLDER';
      const resolvedParams =
        !allowActionParams && !isVariableOrPlaceholderBlock
          ? undefined
          : params ?? (paletteItem?.params ? { ...paletteItem.params } : undefined);
      const newBlock: CodeBlock = { id, type: normalizedType, repeatCount, params: resolvedParams };
      set((state) => {
        const currentBlocks = [...state.workspace[scope]];
        if (typeof insertAtIndex === 'number' && insertAtIndex >= 0 && insertAtIndex <= currentBlocks.length) {
          currentBlocks.splice(insertAtIndex, 0, newBlock);
        } else {
          currentBlocks.push(newBlock);
        }
        const nextWorkspace: WorkspaceState = {
          ...state.workspace,
          [scope]: currentBlocks,
        };
        return {
          workspace: nextWorkspace,
          lastSlotCapRejectedAt: null,
          ...(state.appMode === 'curriculum'
            ? {
                curriculumWorkspaces: {
                  ...state.curriculumWorkspaces,
                  [state.activeActivityId]: cloneWorkspace(nextWorkspace),
                },
              }
            : {
                savedWorkspaces: {
                  ...state.savedWorkspaces,
                  [state.activeSimId]: cloneWorkspace(nextWorkspace),
                },
              }),
          selectedBlockId: id,
        };
      });
      persistActiveWorkspace(get().workspace);
      get().runInstantIfActive({ allowVictoryModal: !wasSuccess });
    },

    updateBlockParams: (scope, blockId, newParams) => {
      const currentState = get();
      const currentBlock = currentState.workspace[scope]?.find((b) => b.id === blockId);
      if (!currentBlock) return;
      const isVariableOrPlaceholderBlock =
        currentBlock.type === 'VAR_ASSIGN' ||
        currentBlock.type === 'VAR_OP' ||
        currentBlock.type === 'PLACEHOLDER';
      if (currentState.appMode === 'curriculum' && !isVariableOrPlaceholderBlock) {
        const activeActivity =
          getActivityAtVersion(currentState.activeActivityId, currentState.activeActivityVersion) ??
          getActivityLatest(currentState.activeActivityId);
        if (activeActivity?.palette?.allowActionParams === false) {
          return;
        }
      }
      const wasSuccess = isCurrentSimSuccess();
      recordMutation('Update block params');
      set((state) => {
        const nextWorkspace: WorkspaceState = {
          ...state.workspace,
          [scope]: state.workspace[scope].map((b) =>
            b.id === blockId ? { ...b, params: { ...(b.params || {}), ...newParams } } : b
          ),
        };
        return {
          workspace: nextWorkspace,
          ...(state.appMode === 'curriculum'
            ? {
                curriculumWorkspaces: {
                  ...state.curriculumWorkspaces,
                  [state.activeActivityId]: cloneWorkspace(nextWorkspace),
                },
              }
            : {
                savedWorkspaces: {
                  ...state.savedWorkspaces,
                  [state.activeSimId]: cloneWorkspace(nextWorkspace),
                },
              }),
        };
      });
      persistActiveWorkspace(get().workspace);
      get().runInstantIfActive({ allowVictoryModal: !wasSuccess });
    },

    removeBlock: (scope, blockId) => {
      const currentBlock = get().workspace[scope]?.find((b) => b.id === blockId);
      if (!currentBlock) return;
      const wasSuccess = isCurrentSimSuccess();
      recordMutation('Remove block');
      set((state) => {
        const nextWorkspace: WorkspaceState = {
          ...state.workspace,
          [scope]: state.workspace[scope].filter((b) => b.id !== blockId),
        };
        return {
          workspace: nextWorkspace,
          lastSlotCapRejectedAt: null,
          ...(state.appMode === 'curriculum'
            ? {
                curriculumWorkspaces: {
                  ...state.curriculumWorkspaces,
                  [state.activeActivityId]: cloneWorkspace(nextWorkspace),
                },
              }
            : {
                savedWorkspaces: {
                  ...state.savedWorkspaces,
                  [state.activeSimId]: cloneWorkspace(nextWorkspace),
                },
              }),
          selectedBlockId: state.selectedBlockId === blockId ? null : state.selectedBlockId,
        };
      });
      persistActiveWorkspace(get().workspace);
      get().runInstantIfActive({ allowVictoryModal: !wasSuccess });
    },

    updateBlockRepeat: (scope, blockId, repeatCount) => {
      const currentBlock = get().workspace[scope]?.find((b) => b.id === blockId);
      if (!currentBlock || currentBlock.repeatCount === repeatCount) return;
      const wasSuccess = isCurrentSimSuccess();
      recordMutation('Update block repeat');
      set((state) => {
        const nextWorkspace: WorkspaceState = {
          ...state.workspace,
          [scope]: state.workspace[scope].map((b) =>
            b.id === blockId ? { ...b, repeatCount } : b
          ),
        };
        return {
          workspace: nextWorkspace,
          ...(state.appMode === 'curriculum'
            ? {
                curriculumWorkspaces: {
                  ...state.curriculumWorkspaces,
                  [state.activeActivityId]: cloneWorkspace(nextWorkspace),
                },
              }
            : {
                savedWorkspaces: {
                  ...state.savedWorkspaces,
                  [state.activeSimId]: cloneWorkspace(nextWorkspace),
                },
              }),
        };
      });
      persistActiveWorkspace(get().workspace);
      get().runInstantIfActive({ allowVictoryModal: !wasSuccess });
    },

    reorderBlocks: (scope, fromIndex, toIndex) => {
      if (fromIndex === toIndex) return;
      const wasSuccess = isCurrentSimSuccess();
      recordMutation('Reorder blocks');
      set((state) => {
        const blocks = [...state.workspace[scope]];
        const [moved] = blocks.splice(fromIndex, 1);
        blocks.splice(toIndex, 0, moved);
        const nextWorkspace: WorkspaceState = {
          ...state.workspace,
          [scope]: blocks,
        };
        return {
          workspace: nextWorkspace,
          ...(state.appMode === 'curriculum'
            ? {
                curriculumWorkspaces: {
                  ...state.curriculumWorkspaces,
                  [state.activeActivityId]: cloneWorkspace(nextWorkspace),
                },
              }
            : {
                savedWorkspaces: {
                  ...state.savedWorkspaces,
                  [state.activeSimId]: cloneWorkspace(nextWorkspace),
                },
              }),
        };
      });
      persistActiveWorkspace(get().workspace);
      get().runInstantIfActive({ allowVictoryModal: !wasSuccess });
    },

    clearWorkspace: (scope) => {
      const ws = get().workspace;
      const hasBlocks = scope
        ? (ws[scope]?.length ?? 0) > 0
        : (['MAIN', 'F1', 'F2', 'F3'] as ScopeType[]).some((s) => (ws[s]?.length ?? 0) > 0);
      if (!hasBlocks) return;
      recordMutation(scope ? 'Clear scope' : 'Clear workspace');
      if (scope) {
        set((state) => {
          const newWorkspace = { ...state.workspace, [scope]: [] };
          return {
            workspace: newWorkspace,
            lastSlotCapRejectedAt: null,
            ...(state.appMode === 'curriculum'
              ? {
                  curriculumWorkspaces: {
                    ...state.curriculumWorkspaces,
                    [state.activeActivityId]: cloneWorkspace(newWorkspace),
                  },
                }
              : {
                  savedWorkspaces: {
                    ...state.savedWorkspaces,
                    [state.activeSimId]: cloneWorkspace(newWorkspace),
                  },
                }),
          };
        });
      } else {
        const emptyWorkspace = createEmptyWorkspace();
        set((state) => ({
          workspace: emptyWorkspace,
          lastSlotCapRejectedAt: null,
          ...(state.appMode === 'curriculum'
            ? {
                curriculumWorkspaces: {
                  ...state.curriculumWorkspaces,
                  [state.activeActivityId]: cloneWorkspace(emptyWorkspace),
                },
              }
            : {
                savedWorkspaces: {
                  ...state.savedWorkspaces,
                  [state.activeSimId]: cloneWorkspace(emptyWorkspace),
                },
              }),
        }));
      }
      persistActiveWorkspace(get().workspace);
      get().runInstantIfActive();
    },

    toggleWall: (edge) => {
      if (get().appMode === 'curriculum') return;
      recordMutation('Toggle wall');
      set((state) => {
        const exists = state.grid.barriers.some(
          (b) => b.orientation === edge.orientation && b.x === edge.x && b.y === edge.y
        );
        const newBarriers = exists
          ? state.grid.barriers.filter(
              (b) => !(b.orientation === edge.orientation && b.x === edge.x && b.y === edge.y)
            )
          : [...state.grid.barriers, edge];
        return {
          grid: { ...state.grid, barriers: newBarriers },
        };
      });
      get().runInstantIfActive();
    },

    addWall: (edge) => {
      if (get().appMode === 'curriculum') return;
      const exists = get().grid.barriers.some(
        (b) => b.orientation === edge.orientation && b.x === edge.x && b.y === edge.y
      );
      if (exists) return;
      recordMutation('Add wall');
      set((state) => {
        return {
          grid: {
            ...state.grid,
            barriers: [...state.grid.barriers, edge],
          },
        };
      });
      get().runInstantIfActive();
    },

    resizeBoard: (direction, delta) => {
      if (get().appMode === 'curriculum') return;
      if (delta === 0) return;
      const { grid } = get();
      const minSize = 3;
      const maxSize = 16;
      const { width, height, robot, flags, barriers } = grid;
      const water = grid.waterCells ?? [];
      const gates = grid.initialLockedGates ?? grid.lockedGates ?? [];
      const switches = grid.floorSwitches ?? [];
      const items = grid.initialWorldItems ?? grid.worldItems ?? [];

      const hasEntityAtOrBeyondX = (limitX: number) =>
        water.some((w) => w.x >= limitX) ||
        gates.some((g) => g.x >= limitX) ||
        switches.some((s) => s.x >= limitX) ||
        items.some((it) => it.x >= limitX) ||
        (grid.worldItems ?? []).some((it) => it.x >= limitX);

      const hasEntityAtOrBeyondY = (limitY: number) =>
        water.some((w) => w.y >= limitY) ||
        gates.some((g) => g.y >= limitY) ||
        switches.some((s) => s.y >= limitY) ||
        items.some((it) => it.y >= limitY) ||
        (grid.worldItems ?? []).some((it) => it.y >= limitY);

      const hasEntityAtXZero = () =>
        water.some((w) => w.x === 0) ||
        gates.some((g) => g.x === 0) ||
        switches.some((s) => s.x === 0) ||
        items.some((it) => it.x === 0) ||
        (grid.worldItems ?? []).some((it) => it.x === 0);

      const hasEntityAtYZero = () =>
        water.some((w) => w.y === 0) ||
        gates.some((g) => g.y === 0) ||
        switches.some((s) => s.y === 0) ||
        items.some((it) => it.y === 0) ||
        (grid.worldItems ?? []).some((it) => it.y === 0);

      if (direction === 'RIGHT') {
        const newWidth = Math.max(minSize, Math.min(maxSize, width + delta));
        if (newWidth === width) return;
        if (delta < 0) {
          const hasBlocked =
            robot.x >= newWidth ||
            robot.initialX >= newWidth ||
            flags.some((f) => f.x >= newWidth) ||
            barriers.some((b) => b.x >= newWidth) ||
            hasEntityAtOrBeyondX(newWidth);
          if (hasBlocked) return;
        }
      } else if (direction === 'BOTTOM') {
        const newHeight = Math.max(minSize, Math.min(maxSize, height + delta));
        if (newHeight === height) return;
        if (delta < 0) {
          const hasBlocked =
            robot.y >= newHeight ||
            robot.initialY >= newHeight ||
            flags.some((f) => f.y >= newHeight) ||
            barriers.some((b) => b.y >= newHeight) ||
            hasEntityAtOrBeyondY(newHeight);
          if (hasBlocked) return;
        }
      } else if (direction === 'LEFT') {
        const newWidth = Math.max(minSize, Math.min(maxSize, width + delta));
        if (newWidth === width) return;
        if (delta < 0) {
          const hasBlocked =
            robot.x === 0 ||
            robot.initialX === 0 ||
            flags.some((f) => f.x === 0) ||
            barriers.some((b) => (b.orientation === 'H' ? b.x === 0 : b.x <= 1)) ||
            hasEntityAtXZero();
          if (hasBlocked) return;
        }
      } else if (direction === 'TOP') {
        const newHeight = Math.max(minSize, Math.min(maxSize, height + delta));
        if (newHeight === height) return;
        if (delta < 0) {
          const hasBlocked =
            robot.y === 0 ||
            robot.initialY === 0 ||
            flags.some((f) => f.y === 0) ||
            barriers.some((b) => (b.orientation === 'V' ? b.y === 0 : b.y <= 1)) ||
            hasEntityAtYZero();
          if (hasBlocked) return;
        }
      }

      recordMutation('Resize board');

      set((state) => {
        const { grid } = state;
        const { width, height, robot, flags, barriers, trace } = grid;

        if (direction === 'RIGHT') {
          const newWidth = Math.max(minSize, Math.min(maxSize, width + delta));
          if (newWidth === width) return state;
          return { grid: { ...grid, width: newWidth } };
        }

        if (direction === 'BOTTOM') {
          const newHeight = Math.max(minSize, Math.min(maxSize, height + delta));
          if (newHeight === height) return state;
          return { grid: { ...grid, height: newHeight } };
        }

        if (direction === 'LEFT') {
          const newWidth = Math.max(minSize, Math.min(maxSize, width + delta));
          if (newWidth === width) return state;

          const shiftX = delta;
          const nextRobot = {
            ...robot,
            x: robot.x + shiftX,
            initialX: robot.initialX + shiftX,
          };
          const nextFlags = flags.map((f) => ({ ...f, x: f.x + shiftX }));
          const nextBarriers = barriers.map((b) => ({ ...b, x: b.x + shiftX }));
          const nextTrace = trace.map((t) => ({ ...t, x: t.x + shiftX }));

          return {
            grid: {
              ...grid,
              width: newWidth,
              robot: nextRobot,
              flags: nextFlags,
              barriers: nextBarriers,
              trace: nextTrace,
              ...(grid.waterCells
                ? { waterCells: grid.waterCells.map((w) => ({ ...w, x: w.x + shiftX })) }
                : {}),
              ...(grid.bridgedWaterCells
                ? { bridgedWaterCells: grid.bridgedWaterCells.map((w) => ({ ...w, x: w.x + shiftX })) }
                : {}),
              ...(grid.lockedGates
                ? { lockedGates: grid.lockedGates.map((g) => ({ ...g, x: g.x + shiftX })) }
                : {}),
              ...(grid.initialLockedGates
                ? {
                    initialLockedGates: grid.initialLockedGates.map((g) => ({
                      ...g,
                      x: g.x + shiftX,
                    })),
                  }
                : {}),
              ...(grid.floorSwitches
                ? { floorSwitches: grid.floorSwitches.map((s) => ({ ...s, x: s.x + shiftX })) }
                : {}),
              ...(grid.worldItems
                ? { worldItems: grid.worldItems.map((it) => ({ ...it, x: it.x + shiftX })) }
                : {}),
              ...(grid.initialWorldItems
                ? {
                    initialWorldItems: grid.initialWorldItems.map((it) => ({
                      ...it,
                      x: it.x + shiftX,
                    })),
                  }
                : {}),
            },
          };
        }

        if (direction === 'TOP') {
          const newHeight = Math.max(minSize, Math.min(maxSize, height + delta));
          if (newHeight === height) return state;

          const shiftY = delta;
          const nextRobot = {
            ...robot,
            y: robot.y + shiftY,
            initialY: robot.initialY + shiftY,
          };
          const nextFlags = flags.map((f) => ({ ...f, y: f.y + shiftY }));
          const nextBarriers = barriers.map((b) => ({ ...b, y: b.y + shiftY }));
          const nextTrace = trace.map((t) => ({ ...t, y: t.y + shiftY }));

          return {
            grid: {
              ...grid,
              height: newHeight,
              robot: nextRobot,
              flags: nextFlags,
              barriers: nextBarriers,
              trace: nextTrace,
              ...(grid.waterCells
                ? { waterCells: grid.waterCells.map((w) => ({ ...w, y: w.y + shiftY })) }
                : {}),
              ...(grid.bridgedWaterCells
                ? { bridgedWaterCells: grid.bridgedWaterCells.map((w) => ({ ...w, y: w.y + shiftY })) }
                : {}),
              ...(grid.lockedGates
                ? { lockedGates: grid.lockedGates.map((g) => ({ ...g, y: g.y + shiftY })) }
                : {}),
              ...(grid.initialLockedGates
                ? {
                    initialLockedGates: grid.initialLockedGates.map((g) => ({
                      ...g,
                      y: g.y + shiftY,
                    })),
                  }
                : {}),
              ...(grid.floorSwitches
                ? { floorSwitches: grid.floorSwitches.map((s) => ({ ...s, y: s.y + shiftY })) }
                : {}),
              ...(grid.worldItems
                ? { worldItems: grid.worldItems.map((it) => ({ ...it, y: it.y + shiftY })) }
                : {}),
              ...(grid.initialWorldItems
                ? {
                    initialWorldItems: grid.initialWorldItems.map((it) => ({
                      ...it,
                      y: it.y + shiftY,
                    })),
                  }
                : {}),
            },
          };
        }

        return state;
      });
      get().runInstantIfActive();
    },

    setCellContent: (x, y) => {
      if (get().appMode === 'curriculum') return;
      const { editorTool, editorKeyGateVariant, grid } = get();
      if (editorTool === 'ROBOT') {
        recordMutation('Place/rotate robot');
        const nextDir: Direction =
          grid.robot.x === x && grid.robot.y === y
            ? grid.robot.dir === 'NORTH'
              ? 'EAST'
              : grid.robot.dir === 'EAST'
              ? 'SOUTH'
              : grid.robot.dir === 'SOUTH'
              ? 'WEST'
              : 'NORTH'
            : grid.robot.dir;
        const nextWater = grid.waterCells?.filter((w) => !(w.x === x && w.y === y));
        const nextGates = (grid.initialLockedGates ?? grid.lockedGates)?.filter(
          (g) => !(g.x === x && g.y === y)
        );
        set({
          grid: {
            ...grid,
            robot: {
              ...grid.robot,
              x,
              y,
              dir: nextDir,
              initialX: x,
              initialY: y,
              initialDir: nextDir,
            },
            ...(nextWater !== undefined ? { waterCells: nextWater } : {}),
            ...(nextGates !== undefined
              ? {
                  lockedGates: cloneLockedGates(nextGates, true),
                  initialLockedGates: cloneLockedGates(nextGates, true),
                }
              : {}),
            trace: [{ x, y }],
          },
        });
      } else if (editorTool === 'FLAG') {
        recordMutation('Place flag');
        const nextFlags = grid.flags.filter((f) => !(f.x === x && f.y === y));
        const order = nextFlags.filter((f) => !f.isGoal).length + 1;
        nextFlags.push({
          id: `flag_${Date.now()}`,
          x,
          y,
          isGoal: false,
          order,
          collected: false,
        });
        set({ grid: { ...grid, flags: nextFlags } });
      } else if (editorTool === 'GOAL') {
        recordMutation('Place goal');
        const nextFlags = grid.flags.filter((f) => !f.isGoal && !(f.x === x && f.y === y));
        nextFlags.push({
          id: `goal_${Date.now()}`,
          x,
          y,
          isGoal: true,
          order: 99,
          collected: false,
        });
        set({ grid: { ...grid, flags: nextFlags } });
      } else if (editorTool === 'WATER') {
        const currentWater = grid.waterCells ?? [];
        const exists = currentWater.some((w) => w.x === x && w.y === y);
        if (!exists && grid.robot.initialX === x && grid.robot.initialY === y) {
          return;
        }
        recordMutation(exists ? 'Remove water' : 'Place water');
        const nextWater = exists
          ? currentWater.filter((w) => !(w.x === x && w.y === y))
          : [...currentWater, { x, y }];
        const baseGates = (grid.initialLockedGates ?? grid.lockedGates ?? []).filter(
          (g) => exists || !(g.x === x && g.y === y)
        );
        const baseSwitches = (grid.floorSwitches ?? []).filter(
          (s) => exists || !(s.x === x && s.y === y)
        );
        const baseItems = (grid.initialWorldItems ?? grid.worldItems ?? []).filter(
          (it) => exists || !(it.x === x && it.y === y)
        );
        const synced = syncWorldSwitchesAndGates(baseSwitches, baseGates, baseItems);
        set({
          grid: resetGridInteractiveState({
            ...grid,
            waterCells: nextWater,
            bridgedWaterCells: [],
            ...(grid.lockedGates !== undefined || baseGates.length > 0
              ? {
                  lockedGates: synced.lockedGates ?? [],
                  initialLockedGates: cloneLockedGates(baseGates, true),
                }
              : {}),
            ...(grid.floorSwitches !== undefined || baseSwitches.length > 0
              ? { floorSwitches: synced.floorSwitches ?? [] }
              : {}),
            ...(grid.worldItems !== undefined || baseItems.length > 0
              ? {
                  worldItems: cloneWorldItems(baseItems),
                  initialWorldItems: cloneWorldItems(baseItems),
                }
              : {}),
          }),
        });
      } else if (editorTool === 'GATE') {
        if (grid.robot.initialX === x && grid.robot.initialY === y) {
          return;
        }
        const shape = editorKeyGateVariant;
        const color = DEFAULT_COLOR_FOR_SHAPE[shape];
        const currentGates = cloneLockedGates(grid.initialLockedGates ?? grid.lockedGates ?? [], true);
        const existingAtCell = currentGates.find((g) => g.x === x && g.y === y);
        const isSameVariant =
          existingAtCell && existingAtCell.shape === shape && existingAtCell.color === color;

        recordMutation(isSameVariant ? 'Remove gate' : 'Place gate');
        const nextGates: LockedGate[] = currentGates.filter((g) => !(g.x === x && g.y === y));
        if (!isSameVariant) {
          nextGates.push({
            id: existingAtCell?.id ?? `gate_${Date.now()}_${x}_${y}`,
            x,
            y,
            shape,
            color,
            unlocked: false,
            unlockedByKey: false,
          });
        }
        const nextWater = (grid.waterCells ?? []).filter((w) => !(w.x === x && w.y === y));
        const nextSwitches = (grid.floorSwitches ?? []).filter((s) => !(s.x === x && s.y === y));
        const nextItems = (grid.initialWorldItems ?? grid.worldItems ?? []).filter(
          (it) => !(it.x === x && it.y === y)
        );
        const synced = syncWorldSwitchesAndGates(nextSwitches, nextGates, nextItems);

        set({
          grid: resetGridInteractiveState({
            ...grid,
            ...(grid.waterCells !== undefined ? { waterCells: nextWater } : {}),
            lockedGates: synced.lockedGates ?? [],
            initialLockedGates: cloneLockedGates(nextGates, true),
            ...(grid.floorSwitches !== undefined ? { floorSwitches: synced.floorSwitches ?? [] } : {}),
            ...(grid.worldItems !== undefined || grid.initialWorldItems !== undefined
              ? {
                  worldItems: cloneWorldItems(nextItems),
                  initialWorldItems: cloneWorldItems(nextItems),
                }
              : {}),
          }),
        });
      } else if (editorTool === 'SWITCH') {
        const currentSwitches = grid.floorSwitches ?? [];
        const existingSwitch = currentSwitches.find((s) => s.x === x && s.y === y);
        recordMutation(existingSwitch ? 'Remove floor switch' : 'Place floor switch');

        const nextSwitches: FloorSwitch[] = existingSwitch
          ? currentSwitches.filter((s) => !(s.x === x && s.y === y))
          : [
              ...currentSwitches,
              {
                id: `switch_${Date.now()}_${x}_${y}`,
                x,
                y,
                requiredForGoal: true,
                active: false,
              },
            ];
        const nextWater = (grid.waterCells ?? []).filter((w) => !(w.x === x && w.y === y));
        const nextGates = cloneLockedGates(
          (grid.initialLockedGates ?? grid.lockedGates ?? []).filter((g) => !(g.x === x && g.y === y)),
          true
        );
        const baseItems = cloneWorldItems(grid.initialWorldItems ?? grid.worldItems ?? []);
        const synced = syncWorldSwitchesAndGates(nextSwitches, nextGates, baseItems);

        set({
          grid: resetGridInteractiveState({
            ...grid,
            ...(grid.waterCells !== undefined ? { waterCells: nextWater } : {}),
            ...(grid.lockedGates !== undefined
              ? {
                  lockedGates: synced.lockedGates ?? [],
                  initialLockedGates: cloneLockedGates(nextGates, true),
                }
              : {}),
            floorSwitches: synced.floorSwitches ?? [],
          }),
        });
      } else if (editorTool === 'KEY' || editorTool === 'PLANK' || editorTool === 'CRATE') {
        const targetType =
          editorTool === 'KEY' ? 'key' : editorTool === 'PLANK' ? 'plank' : 'crate';
        const shape = editorKeyGateVariant;
        const color = DEFAULT_COLOR_FOR_SHAPE[shape];
        const currentItems = cloneWorldItems(grid.initialWorldItems ?? grid.worldItems ?? []);
        const existingItem = currentItems.find((it) => it.x === x && it.y === y);
        const isSameItem =
          existingItem &&
          existingItem.type === targetType &&
          (targetType !== 'key' ||
            (existingItem.shape === shape && existingItem.color === color));

        recordMutation(isSameItem ? `Remove ${targetType}` : `Place ${targetType}`);
        const nextItems: WorldItem[] = currentItems.filter((it) => !(it.x === x && it.y === y));
        if (!isSameItem) {
          nextItems.push({
            id: existingItem?.id ?? `${targetType}_${Date.now()}_${x}_${y}`,
            type: targetType,
            x,
            y,
            ...(targetType === 'key' ? { shape, color } : {}),
          });
        }
        const nextWater = (grid.waterCells ?? []).filter((w) => !(w.x === x && w.y === y));
        const nextGates = cloneLockedGates(
          (grid.initialLockedGates ?? grid.lockedGates ?? []).filter((g) => !(g.x === x && g.y === y)),
          true
        );
        const synced = syncWorldSwitchesAndGates(grid.floorSwitches, nextGates, nextItems);

        set({
          grid: resetGridInteractiveState({
            ...grid,
            ...(grid.waterCells !== undefined ? { waterCells: nextWater } : {}),
            ...(grid.lockedGates !== undefined
              ? {
                  lockedGates: synced.lockedGates ?? [],
                  initialLockedGates: cloneLockedGates(nextGates, true),
                }
              : {}),
            ...(grid.floorSwitches !== undefined ? { floorSwitches: synced.floorSwitches ?? [] } : {}),
            worldItems: cloneWorldItems(nextItems),
            initialWorldItems: cloneWorldItems(nextItems),
          }),
        });
      } else if (editorTool === 'ERASE') {
        const hasFlag = grid.flags.some((f) => f.x === x && f.y === y);
        const hasWater = Boolean(grid.waterCells?.some((w) => w.x === x && w.y === y));
        const baseGates = grid.initialLockedGates ?? grid.lockedGates ?? [];
        const hasGate = baseGates.some((g) => g.x === x && g.y === y);
        const hasSwitch = Boolean(grid.floorSwitches?.some((s) => s.x === x && s.y === y));
        const baseItems = grid.initialWorldItems ?? grid.worldItems ?? [];
        const hasItem =
          baseItems.some((it) => it.x === x && it.y === y) ||
          Boolean(grid.worldItems?.some((it) => it.x === x && it.y === y));

        if (!hasFlag && !hasWater && !hasGate && !hasSwitch && !hasItem) return;

        recordMutation('Erase cell');
        const nextFlags = grid.flags.filter((f) => !(f.x === x && f.y === y));
        const nextWater = grid.waterCells?.filter((w) => !(w.x === x && w.y === y));
        const nextGates = cloneLockedGates(
          baseGates.filter((g) => !(g.x === x && g.y === y)),
          true
        );
        const nextSwitches = grid.floorSwitches?.filter((s) => !(s.x === x && s.y === y));
        const nextItems = cloneWorldItems(baseItems.filter((it) => !(it.x === x && it.y === y)));
        const synced = syncWorldSwitchesAndGates(nextSwitches, nextGates, nextItems);

        set({
          grid: resetGridInteractiveState({
            ...grid,
            flags: nextFlags,
            ...(nextWater !== undefined ? { waterCells: nextWater, bridgedWaterCells: [] } : {}),
            ...(grid.lockedGates !== undefined || grid.initialLockedGates !== undefined
              ? {
                  lockedGates: synced.lockedGates ?? [],
                  initialLockedGates: cloneLockedGates(nextGates, true),
                }
              : {}),
            ...(nextSwitches !== undefined ? { floorSwitches: synced.floorSwitches ?? [] } : {}),
            ...(grid.worldItems !== undefined || grid.initialWorldItems !== undefined
              ? {
                  worldItems: cloneWorldItems(nextItems),
                  initialWorldItems: cloneWorldItems(nextItems),
                }
              : {}),
          }),
        });
      }
      get().runInstantIfActive();
    },

    toggleTrace: () => {
      set((state) => ({
        grid: { ...state.grid, showTrace: !state.grid.showTrace },
      }));
    },

    toggleFitToView: () => {
      set((state) => ({
        grid: { ...state.grid, fitToView: !state.grid.fitToView },
      }));
    },

    clearGridUserCustoms: () => {
      if (get().appMode === 'curriculum') return;
      recordMutation('Clear grid customs');
      const prevFitToView = get().grid.fitToView ?? false;
      const preset = PRESET_LEVELS.find((p) => p.id === get().currentLevel) || PRESET_LEVELS[0];
      set({ grid: createGridFromPreset(preset, prevFitToView) });
      get().runInstantIfActive();
    },

    updateTurtleViewport: (updates) => {
      set((state) => {
        const nextPan = updates.pan
          ? { ...state.turtleState.pan, ...updates.pan }
          : state.turtleState.pan;
        const nextZoom = updates.zoom !== undefined ? updates.zoom : state.turtleState.zoom;
        const nextFitToView =
          updates.fitToView !== undefined ? updates.fitToView : state.turtleState.fitToView;

        if (pendingTurtleCommit) {
          pendingTurtleCommit.finalTurtleState = {
            ...pendingTurtleCommit.finalTurtleState,
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
      recordMutation('Clear turtle canvas');
      get().reset();
      set({
        turtleState: createInitialTurtleState(),
      });
      get().runInstantIfActive();
    },

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
      recordMutation('Clear Beat LED matrix');
      get().reset();
      set((state) => ({
        beatState: resetBeatState(state.beatState),
      }));
      get().runInstantIfActive();
    },

    step: () => {
      const { speed, activeSimId } = get();
      if (speed === 'instant' || (speed as any) === 0) return;

      if (!get().isPlaying && !get().beatState.isMuted) {
        beatSynth.unlockFromGesture();
      }

      if (get().ghostPreview) {
        set({ ghostPreview: null });
      }

      if (activeSimId === 'grid') {
        const { runtime, workspace, grid } = get();

        // Guard: do not execute if loops are unclosed in any used workspace scope
        for (const sc of ['MAIN', 'F1', 'F2', 'F3'] as ScopeType[]) {
          if (workspace[sc]?.length > 0) {
            const val = validateLoopStructure(workspace[sc]);
            if (val.hasError) {
              return;
            }
          }
        }

        const currentRuntime = runtime || createInitialInterpreterState();
        const simEnv = getSimEnvironment('grid');
        if (!simEnv) return;

        const wasSuccess = grid.status === 'SUCCESS' || currentRuntime.status === 'SUCCESS';
        const wasPlaying = get().isPlaying;

        const res = tickInterpreter(currentRuntime, workspace, grid, simEnv);

        // Auto switch active tab to current running scope if function called
        const activeScope = res.nextRuntime.callStack.length > 0
          ? res.nextRuntime.callStack[res.nextRuntime.callStack.length - 1].scope
          : get().activeScope;

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
                statusAnnouncement: getPlaceholderPauseAnnouncement(workspace, res.nextRuntime),
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
          const reward = recordCurriculumSuccessIfApplicable();
          if (!wasSuccess) {
            triggerVictoryModal(reward?.newlyEarnedBadges ?? [], true);
          }
        } else if (
          wasPlaying &&
          res.done &&
          !isPausedOnPlaceholder &&
          nextGridState.status !== 'COLLISION'
        ) {
          recordCreativePlayCompletionIfApplicable(true);
        }

        if ((res.done || isPausedOnPlaceholder) && timerId) {
          clearTimeout(timerId);
          timerId = null;
          set({ isPlaying: false });
        }
        markDemoTabExploredInternal(true);
      } else if (activeSimId === 'beat') {
        beatSynth.stopSource('preview');
        if (!get().isPlaying && !get().beatState.isMuted) {
          beatSynth.unlockFromGesture();
        }
        const { runtime, workspace, beatState } = get();

        for (const sc of ['MAIN', 'F1', 'F2', 'F3'] as ScopeType[]) {
          if (workspace[sc]?.length > 0) {
            const val = validateLoopStructure(workspace[sc]);
            if (val.hasError) {
              return;
            }
          }
        }

        const currentRuntime = runtime || createInitialInterpreterState();
        const simEnv = getSimEnvironment('beat');
        if (!simEnv) return;

        const wasSuccess = beatState.status === 'SUCCESS' || currentRuntime.status === 'SUCCESS';
        const wasPlaying = get().isPlaying;
        const prevScope = get().activeScope;
        const prevBeatIndex = beatState.beatIndex;
        const res = tickInterpreter(currentRuntime, workspace, beatState, simEnv);
        const nextBeat = res.nextGrid as BeatState;

        if (nextBeat.beatIndex !== prevBeatIndex && !nextBeat.isMuted) {
          beatSynth.playEvent(nextBeat.lastTriggeredEvent, speed);
        }

        const activeScope =
          res.nextRuntime.callStack.length > 0
            ? res.nextRuntime.callStack[res.nextRuntime.callStack.length - 1].scope
            : prevScope;

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
                statusAnnouncement: getPlaceholderPauseAnnouncement(workspace, res.nextRuntime),
              }
            : {}),
        });

        if (nextBeat.status === 'SUCCESS' || res.nextRuntime.status === 'SUCCESS') {
          const reward = recordCurriculumSuccessIfApplicable();
          if (!wasSuccess) {
            triggerVictoryModal(reward?.newlyEarnedBadges ?? [], true);
          }
        } else if (
          wasPlaying &&
          res.done &&
          !isPausedOnPlaceholder &&
          nextBeat.status !== 'COLLISION'
        ) {
          recordCreativePlayCompletionIfApplicable(true);
        }

        if ((res.done || isPausedOnPlaceholder) && timerId) {
          clearTimeout(timerId);
          timerId = null;
          set({ isPlaying: false });
        }
        markDemoTabExploredInternal(true);
      } else {
        // Turtle mode
        // If an animation is currently active, snap-commit it first
        if (get().turtleState.activeAnimation && pendingTurtleCommit) {
          if (turtleRafId !== null) {
            cancelFrame(turtleRafId);
            turtleRafId = null;
          }
          const commit = pendingTurtleCommit;
          pendingTurtleCommit = null;
          const liveTurtle = get().turtleState;
          set({
            turtleState: mergeLiveTurtleViewState(commit.finalTurtleState, liveTurtle),
            runtime: commit.finalRuntime,
          });
          if (
            commit.finalTurtleState.status === 'SUCCESS' ||
            commit.finalRuntime.status === 'SUCCESS'
          ) {
            const reward = recordCurriculumSuccessIfApplicable();
            if (!commit.wasSuccessBefore) {
              triggerVictoryModal(reward?.newlyEarnedBadges ?? [], true);
            }
          }
          if (commit.isDone) {
            set({ isPlaying: false });
            return;
          }
        }

        runTurtleExecutionLoop(true);
        markDemoTabExploredInternal(true);
      }
    },

    play: () => {
      const { speed, workspace, activeSimId } = get();
      if (get().ghostPreview) {
        set({ ghostPreview: null });
      }
      if (activeSimId === 'beat' && (speed === 'instant' || (speed as any) === 0)) {
        set({ speed: 400 });
      }
      const effectiveSpeed = get().speed;
      if (effectiveSpeed === 'instant' || (effectiveSpeed as any) === 0) {
        if (timerId) {
          clearTimeout(timerId);
          timerId = null;
        }
        if (turtleRafId !== null) {
          cancelFrame(turtleRafId);
          turtleRafId = null;
        }
        beatSynth.stopAll();
        for (const sc of ['MAIN', 'F1', 'F2', 'F3'] as ScopeType[]) {
          if (workspace[sc]?.length > 0) {
            const val = validateLoopStructure(workspace[sc]);
            if (val.hasError) {
              return;
            }
          }
        }
        const wasSuccess = isCurrentSimSuccess();
        set({ isVictoryModalOpen: false, victoryEarnedBadges: [] });
        get().runInstantIfActive({ allowVictoryModal: !wasSuccess });
        if (
          !isCurrentSimSuccess() &&
          get().runtime?.status !== 'PAUSED' &&
          (activeSimId === 'grid'
            ? get().grid.status !== 'COLLISION'
            : activeSimId === 'beat'
            ? get().beatState.status !== 'COLLISION'
            : get().turtleState.status !== 'COLLISION')
        ) {
          recordCreativePlayCompletionIfApplicable(false);
        }
        return;
      }

      beatSynth.stopSource('preview');
      if (!get().beatState.isMuted) {
        beatSynth.unlockFromGesture();
      }

      if (get().isPlaying) return;

      set({ isVictoryModalOpen: false, victoryEarnedBadges: [] });

      const { grid, turtleState, beatState, runtime } = get();
      const currentSimState =
        activeSimId === 'grid' ? grid : activeSimId === 'beat' ? beatState : turtleState;
      const hasEndedOrFail =
        currentSimState.status === 'SUCCESS' ||
        currentSimState.status === 'COLLISION' ||
        (runtime !== null && runtime.callStack.length === 0);

      if (hasEndedOrFail) {
        get().reset();
      }

      // Guard: do not execute if loops are unclosed in any used workspace scope
      for (const sc of ['MAIN', 'F1', 'F2', 'F3'] as ScopeType[]) {
        if (workspace[sc]?.length > 0) {
          const val = validateLoopStructure(workspace[sc]);
          if (val.hasError) {
            return;
          }
        }
      }

      if (activeSimId === 'grid') {
        if (timerId) {
          clearTimeout(timerId);
          timerId = null;
        }
        set({ isPlaying: true });

        // Run immediate first step
        get().step();
        if (!get().isPlaying) {
          return;
        }

        const scheduleNextTick = (delayMs: number) => {
          timerId = setTimeout(() => {
            timerId = null;
            if (!get().isPlaying) {
              return;
            }
            get().step();
            if (get().isPlaying) {
              const currentSpeed = get().speed;
              if (typeof currentSpeed === 'number' && currentSpeed > 0) {
                scheduleNextTick(currentSpeed);
              }
            }
          }, delayMs);
        };

        const initialSpeed = get().speed;
        if (typeof initialSpeed === 'number' && initialSpeed > 0) {
          scheduleNextTick(initialSpeed);
        }
      } else if (activeSimId === 'beat') {
        if (timerId) {
          clearTimeout(timerId);
          timerId = null;
        }
        beatPassHadDelay = false;
        set({ isPlaying: true });
        runBeatExecutionLoop();
        markDemoTabExploredInternal(true);
      } else {
        // Turtle runner: RAF-driven constant speed loop
        turtlePassHadDelay = false;
        set({ isPlaying: true });
        runTurtleExecutionLoop(false);
        markDemoTabExploredInternal(true);
      }
    },

    pause: () => {
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
      if (turtleRafId !== null) {
        cancelFrame(turtleRafId);
        turtleRafId = null;
      }
      if (pendingTurtleCommit) {
        pendingTurtleCommit.isSingleStep = false;
      }
      beatSynth.stopAll();
      set({ isPlaying: false });
    },

    reset: () => {
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
      if (turtleRafId !== null) {
        cancelFrame(turtleRafId);
        turtleRafId = null;
      }
      pendingTurtleCommit = null;
      turtlePassHadDelay = false;
      beatPassHadDelay = false;
      beatSynth.stopAll();

      const { grid, turtleState, beatState, activeSimId } = get();

      if (activeSimId === 'grid') {
        set({
          isPlaying: false,
          runtime: null,
          ghostPreview: null,
          isVictoryModalOpen: false,
          victoryEarnedBadges: [],
          grid: getInitialGridState(grid),
        });
      } else if (activeSimId === 'beat') {
        set({
          isPlaying: false,
          runtime: null,
          isVictoryModalOpen: false,
          victoryEarnedBadges: [],
          beatState: getInitialBeatState(beatState),
        });
      } else {
        set({
          isPlaying: false,
          runtime: null,
          ghostPreview: null,
          isVictoryModalOpen: false,
          victoryEarnedBadges: [],
          turtleState: getInitialTurtleState(turtleState),
        });
      }
    },

    setLoopPlayback: (loop) => set({ isLoopPlayback: loop }),

    toggleLoopPlayback: () => set((state) => ({ isLoopPlayback: !state.isLoopPlayback })),

    toggleTurtleVisible: () =>
      set((state) => {
        const nextShowTurtle = !state.turtleState.showTurtle;
        if (pendingTurtleCommit) {
          pendingTurtleCommit.finalTurtleState = {
            ...pendingTurtleCommit.finalTurtleState,
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

    dismissRestoredNotice: () => set({ wasRestoredAfterUpdate: false }),

    prepareStateForUpdate: () => {
      // Stop timers / RAF and commit any in-flight turtle animation before snapshot
      get().pause();
      if (pendingTurtleCommit) {
        const commit = pendingTurtleCommit;
        pendingTurtleCommit = null;
        const liveTurtle = get().turtleState;
        set({
          turtleState: mergeLiveTurtleViewState(commit.finalTurtleState, liveTurtle),
          runtime: commit.finalRuntime,
        });
      }

      const s = get();
      return saveStateBeforeUpdate({
        activeProfileId: s.activeProfileId,
        appMode: s.appMode,
        activeActivityId: s.activeActivityId,
        activeActivityVersion: s.activeActivityVersion,
        curriculumWorkspaces: s.curriculumWorkspaces,
        sandboxSnapshot: s.sandboxSnapshot,
        activeSimId: s.activeSimId,
        currentLevel: s.currentLevel,
        workspace: s.workspace,
        savedWorkspaces: s.savedWorkspaces,
        grid: s.grid,
        turtleState: s.turtleState,
        beatState: s.beatState,
        runtime: s.runtime,
        activeScope: s.activeScope,
        selectedBlockId: s.selectedBlockId,
        speed: s.speed,
        editorTool: s.editorTool,
        isSubpaletteCollapsed: s.isSubpaletteCollapsed,
        isMapHidden: s.isMapHidden,
        isFunctionBarOpen: s.isFunctionBarOpen,
        isLoopPlayback: s.isLoopPlayback,
        past: s.past,
        future: s.future,
      });
    },

    hydrateFromUpdateIfPresent: () => {
      const defaultGrid = createGridFromPreset(initialPreset);
      const restored = consumeRestoredStateAfterUpdate(defaultGrid);
      if (!restored) return false;

      get().pause();
      pendingTurtleCommit = null;
      activeBatchSnapshot = null;

      if (restored.activeProfileId) {
        setActiveProfileId(restored.activeProfileId);
      }
      const profilesState = ensureProfilesInitialized();
      const resolvedProfileId =
        restored.activeProfileId && profilesState.profiles.some((p) => p.id === restored.activeProfileId)
          ? restored.activeProfileId
          : profilesState.activeProfileId;
      const restoredBeat = restored.beatState ?? createInitialBeatState(false);
      beatSynth.setMuted(Boolean(restoredBeat.isMuted));

      set({
        profiles: profilesState.profiles,
        activeProfileId: resolvedProfileId,
        unlockAllModules: Boolean(getProfileProgress(resolvedProfileId).unlockAllModules),
        isBadgeModalOpen: false,
        completedActivities: buildCompletedMap(resolvedProfileId),
        appMode: restored.appMode ?? 'sandbox',
        activeActivityId: restored.activeActivityId ?? '1.1',
        activeActivityVersion: restored.activeActivityVersion ?? 1,
        curriculumWorkspaces: restored.curriculumWorkspaces ?? {},
        sandboxSnapshot: restored.sandboxSnapshot ?? null,
        activeSimId: restored.activeSimId,
        currentLevel: restored.currentLevel,
        workspace: restored.workspace,
        savedWorkspaces: restored.savedWorkspaces,
        grid: restored.grid,
        turtleState: restored.turtleState,
        beatState: restoredBeat,
        runtime: restored.runtime,
        isPlaying: false,
        activeScope: restored.activeScope,
        ...(typeof restored.isLoopPlayback === 'boolean'
          ? { isLoopPlayback: restored.isLoopPlayback }
          : {}),
        selectedBlockId: restored.selectedBlockId,
        speed: restored.speed,
        editorTool: restored.editorTool,
        isSubpaletteCollapsed: restored.isSubpaletteCollapsed,
        isMapHidden: restored.isMapHidden,
        isFunctionBarOpen: restored.isFunctionBarOpen,
        isVictoryModalOpen: false,
        victoryEarnedBadges: [],
        past: restored.past,
        future: restored.future,
        canUndo: restored.past.length > 0,
        canRedo: restored.future.length > 0,
        wasRestoredAfterUpdate: true,
      });

      get().runInstantIfActive();
      return true;
    },

    setPerformanceMode: (mode) => {
      savePersistedPerformanceMode(mode);
      const nextAuto = mode === 'auto' ? get().isAutoLowQuality : false;
      const isLow = mode === 'low' || (mode === 'auto' && nextAuto);
      beatSynth.setLowQualityMode(isLow);
      set({
        performanceMode: mode,
        ...(mode !== 'auto' ? { isAutoLowQuality: false } : {}),
      });
    },

    cyclePerformanceMode: () => {
      const { performanceMode, isAutoLowQuality } = get();
      let nextMode: PerformanceMode;
      if (performanceMode === 'auto') {
        nextMode = isAutoLowQuality ? 'high' : 'low';
      } else if (performanceMode === 'low') {
        nextMode = 'high';
      } else {
        nextMode = 'auto';
      }
      get().setPerformanceMode(nextMode);
    },

    triggerAutoLowQuality: () => {
      const { performanceMode, isAutoLowQuality } = get();
      if (performanceMode !== 'auto' || isAutoLowQuality) return;
      beatSynth.setLowQualityMode(true);
      set({
        isAutoLowQuality: true,
        statusAnnouncement: 'Lite visual mode enabled for smoother playback.',
      });
    },
  };
});

export function isLowQualityActive(
  state: Pick<AppState, 'performanceMode' | 'isAutoLowQuality'>
): boolean {
  return state.performanceMode === 'low' || (state.performanceMode === 'auto' && state.isAutoLowQuality);
}

/**
 * Zustand v5 SSR-safe selective subscription hook.
 * Uses `useSyncExternalStore` with live `useAppStore.getState()` as both client and server snapshot
 * and shallow equality caching so `renderToStaticMarkup` tests remain deterministic while client
 * components only re-render when their selected slice actually changes.
 */
export function useAppStoreSelector<T>(selector: (state: AppState) => T): T {
  const prevRef = useRef<{ hasValue: boolean; value: T }>({
    hasValue: false,
    value: undefined as T,
  });

  const getSnapshot = () => {
    const next = selector(useAppStore.getState());
    if (prevRef.current.hasValue && shallow(prevRef.current.value, next)) {
      return prevRef.current.value;
    }
    prevRef.current.hasValue = true;
    prevRef.current.value = next;
    return next;
  };

  return useSyncExternalStore(useAppStore.subscribe, getSnapshot, getSnapshot);
}

// Sync initial persisted quality mode with beatSynth & restore PWA update state if present
beatSynth.setLowQualityMode(isLowQualityActive(useAppStore.getState()));
useAppStore.getState().hydrateFromUpdateIfPresent();

