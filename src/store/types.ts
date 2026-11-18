import type { StoreApi } from 'zustand';
import type {
  Direction,
  EventScopeType,
  GridState,
  InterpreterRuntimeState,
  KeyGateShape,
  ScopeType,
  SimulationSpeed,
  SimulationStatus,
  VariableName,
  VariableRuntimeValue,
  WallEdge,
  WorkspaceState,
} from '../types';
import type { TurtleState } from '../simulations/turtle/types';
import type { BeatState } from '../simulations/beat/types';
import type { DepotState } from '../simulations/depot/types';
import type { SwitchyardState } from '../simulations/switchyard/types';
import type { AppMode, SceneInputConfig } from '../data/curriculum';
import type { GhostPreviewState } from '../engine/placeholderHelpers';
import type { SavedProgramEntry } from '../services/localSaveService';
import type {
  CreateProfileInput,
  ProfileBackupEnvelopeV1,
  ProfileBackupImportMode,
  UserProfile,
} from '../services/profileService';
import type { PerformanceMode } from './helpers/statusAndPerfHelpers';

export type SimId = 'grid' | 'turtle' | 'beat' | 'depot' | 'switchyard';

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
  | 'BEACON'
  | 'DIAL'
  | 'STACK_DEPOT'
  | 'ERASE';

export interface SandboxModeSnapshot {
  activeSimId: SimId;
  currentLevel: number;
  grid: GridState;
  turtleState: TurtleState;
  beatState?: BeatState;
  depotState?: DepotState;
  switchyardState?: SwitchyardState;
  workspace: WorkspaceState;
  savedWorkspaces: Record<string, WorkspaceState>;
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
  depotState?: DepotState;
  switchyardState?: SwitchyardState;
  activeScope: ScopeType;
  selectedBlockId: string | null;
  activeSimId: SimId;
  description?: string;
}

export interface VariantRunSnapshot {
  index: number;
  label?: string;
  kind: 'grid' | 'depot' | 'switchyard' | 'beat';
  status: SimulationStatus;
  gridState?: GridState;
  depotState?: DepotState;
  switchyardState?: SwitchyardState;
  beatState?: BeatState;
  runtime?: InterpreterRuntimeState | null;
}

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

export interface TurtlePendingCommit {
  finalTurtleState: TurtleState;
  finalRuntime: InterpreterRuntimeState;
  isDone: boolean;
  isSingleStep: boolean;
  wasSuccessBefore: boolean;
}

export interface AppStateData {
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
  viewedDemoTabs: Record<string, string[]>;
  curriculumWorkspaces: Record<string, WorkspaceState>;
  sandboxSnapshot: SandboxModeSnapshot | null;
  pendingVersionMismatch: PendingLessonVersionMismatch | null;
  statusAnnouncement: string;
  ghostPreview: GhostPreviewState | null;
  slotCapRejectionCount: number;
  lastSlotCapRejectedAt: number | null;
  variantRuns: VariantRunSnapshot[];
  focusedVariantIndex: number;
  activeVariationInputConfig: SceneInputConfig | null;
  sceneInput: number | string | undefined;

  // Environment selection
  activeSimId: SimId;
  currentLevel: number;
  grid: GridState;
  turtleState: TurtleState;
  beatState: BeatState;
  depotState: DepotState;
  switchyardState: SwitchyardState;
  workspace: WorkspaceState;
  savedWorkspaces: Record<string, WorkspaceState>;
  activeScope: ScopeType;
  selectedBlockId: string | null;
  runtime: InterpreterRuntimeState | null;
  activeVariables?: Record<string, VariableRuntimeValue>;
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
  randomSeed: number;
  wasRestoredAfterUpdate: boolean;
  performanceMode: PerformanceMode;
  isAutoLowQuality: boolean;

  // Interactive runtime inputs
  heldKeys: string[];
  pointerState: { x: number; y: number; isDown: boolean };

  // History state
  past: HistorySnapshot[];
  future: HistorySnapshot[];
  canUndo: boolean;
  canRedo: boolean;
}

export interface HistorySliceActions {
  undo: () => void;
  redo: () => void;
  startHistoryBatch: (description?: string) => void;
  endHistoryBatch: () => void;
  clearHistory: () => void;
}

export interface ProfileSliceActions {
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
  toggleUnlockAllModules: () => void;
}

export interface CurriculumSliceActions {
  setAppMode: (mode: AppMode) => void;
  setCurriculumActivity: (activityId: string, version?: number) => void;
  setFocusedVariantIndex: (index: number) => void;
  setSceneInput: (value: number | string) => void;
  selectExplanationDemoTab: (tabIndex: number) => void;
  markActiveDemoTabExplored: () => void;
  completeExplanationAndContinue: () => string | null;
  completeCreativeActivity: (advanceToNext?: boolean) => string | null;
  openCopyInSandbox: () => void;
  loadVariationWorkspace: (
    workspace: WorkspaceState,
    title?: string,
    inputConfigOverride?: SceneInputConfig | null
  ) => void;
  resetActivityToStarter: () => void;
}

export interface WorkspaceSliceActions {
  addBlock: (
    scope: ScopeType,
    type: string,
    repeatCount?: number | VariableName,
    insertAtIndex?: number,
    params?: Record<string, any>
  ) => void;
  removeBlock: (scope: ScopeType, blockId: string) => void;
  updateBlockRepeat: (
    scope: ScopeType,
    blockId: string,
    repeatCount?: number | VariableName
  ) => void;
  updateBlockParams: (
    scope: ScopeType,
    blockId: string,
    params: Record<string, any>
  ) => void;
  reorderBlocks: (scope: ScopeType, fromIndex: number, toIndex: number) => void;
  clearWorkspace: (scope?: ScopeType) => void;
}

export interface ScaffoldsAndHintsSliceActions {
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
}

export interface SerializationSliceActions {
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
}

export interface GridEditorSliceActions {
  setLevel: (levelId: number) => void;
  toggleWall: (edge: WallEdge) => void;
  addWall: (edge: WallEdge) => void;
  resizeBoard: (direction: 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT', delta: number) => void;
  setCellContent: (x: number, y: number) => void;
  toggleTrace: () => void;
  toggleFitToView: () => void;
  clearGridUserCustoms: () => void;
}

export interface SimControlsSliceActions {
  setSimEnvironment: (simId: SimId) => void;
  setDepotState: (next: DepotState) => void;
  setSwitchyardState: (next: SwitchyardState) => void;
  updateTurtleViewport: (
    updates: Partial<{ pan: { x: number; y: number }; zoom: number; fitToView: boolean }>
  ) => void;
  clearTurtleCanvas: () => void;
  toggleTurtleVisible: () => void;
  setBeatMuted: (muted: boolean) => void;
  toggleBeatMuted: () => void;
  unlockBeatAudio: () => void;
  clearBeatMatrix: () => void;
}

export interface ExecutionSliceActions {
  setSpeed: (speed: SimulationSpeed | number) => void;
  runInstantIfActive: (options?: { allowVictoryModal?: boolean }) => void;
  step: () => void;
  play: () => void;
  pause: () => void;
  reset: () => void;
  setLoopPlayback: (loop: boolean) => void;
  toggleLoopPlayback: () => void;
  setRandomSeed: (seed: number) => void;
  rerollRandomSeed: () => number;
  setKeyHeld: (key: string, held: boolean) => void;
  setPointerState: (updates: Partial<{ x: number; y: number; isDown: boolean }>) => void;
  enqueueInteractiveEvent: (eventScope: EventScopeType) => void;
}

export interface UiChromeSliceActions {
  setActiveScope: (scope: ScopeType) => void;
  setSelectedBlockId: (id: string | null) => void;
  setEditorTool: (tool: EditorTool) => void;
  setEditorKeyGateVariant: (variant: KeyGateShape) => void;
  toggleSubpalette: () => void;
  setSubpaletteCollapsed: (collapsed: boolean) => void;
  toggleMapHidden: () => void;
  setMapHidden: (hidden: boolean) => void;
  toggleFunctionBar: () => void;
  setFunctionBarOpen: (open: boolean) => void;
  toggleMobileMenu: () => void;
  setMobileMenuOpen: (open: boolean) => void;
  setSolutionOpen: (open: boolean) => void;
  setExportImportOpen: (open: boolean) => void;
  setSaveModalOpen: (open: boolean) => void;
  setLoadModalOpen: (open: boolean) => void;
  setLessonPickerOpen: (open: boolean) => void;
  setBadgeModalOpen: (open: boolean) => void;
  dismissVictoryModal: () => void;
}

export interface PwaAndPerfSliceActions {
  dismissRestoredNotice: () => void;
  prepareStateForUpdate: () => boolean;
  hydrateFromUpdateIfPresent: () => boolean;
  setPerformanceMode: (mode: PerformanceMode) => void;
  cyclePerformanceMode: () => void;
  triggerAutoLowQuality: () => void;
}

export interface AppState
  extends AppStateData,
    HistorySliceActions,
    ProfileSliceActions,
    CurriculumSliceActions,
    WorkspaceSliceActions,
    ScaffoldsAndHintsSliceActions,
    SerializationSliceActions,
    GridEditorSliceActions,
    SimControlsSliceActions,
    ExecutionSliceActions,
    UiChromeSliceActions,
    PwaAndPerfSliceActions {}

export type StoreSet = StoreApi<AppState>['setState'];
export type StoreGet = StoreApi<AppState>['getState'];

export interface PlaybackHandles {
  timerId: ReturnType<typeof setTimeout> | null;
  turtleRafId: number | null;
  pendingTurtleCommit: TurtlePendingCommit | null;
  turtlePassHadDelay: boolean;
  beatPassHadDelay: boolean;
}

export interface HistoryHandles {
  activeBatchSnapshot: HistorySnapshot | null;
}

export interface StoreContext {
  playback: PlaybackHandles;
  history: HistoryHandles;
  cancelPlaybackTimers: () => void;
  takeSnapshot: (state: AppState, desc?: string) => HistorySnapshot;
  recordMutation: (desc?: string) => void;
  persistActiveWorkspace: (
    ws: WorkspaceState,
    override?: {
      appMode?: AppMode;
      profileId?: string;
      activityId?: string;
      activityVersion?: number;
      simId?: SimId;
    }
  ) => void;
  markDemoTabExploredInternal: (announceOnAllExplored?: boolean) => void;
  triggerVictoryModal: (earnedBadges?: string[], playAudio?: boolean) => void;
  recordCurriculumSuccessIfApplicable: () => {
    newlyEarnedBadges: string[];
    isCapstone: boolean;
  } | null;
  recordCreativePlayCompletionIfApplicable: (playAudio?: boolean) => void;
}
