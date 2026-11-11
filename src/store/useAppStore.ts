import { create } from 'zustand';
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
} from '../types';
import { TurtleState } from '../simulations/turtle/types';
import { createInitialTurtleState, turtleSimulationEnvironment } from '../simulations/turtle/turtleEnvironment';
import { gridSimulationEnvironment } from '../simulations/grid/gridEnvironment';
import { getSimEnvironment, registerSimulation } from '../engine/simulation/registry';

// Register environments
registerSimulation(gridSimulationEnvironment);
registerSimulation(turtleSimulationEnvironment);
import {
  createInitialInterpreterState,
  tickInterpreter,
  validateLoopStructure,
  evaluateValue,
} from '../engine/interpreter';
import {
  isTurtleMotionAction,
  createTurtleAnimation,
  interpolateAnimationPose,
} from '../simulations/turtle/physics';
import { runHeadlessSimulation, MAX_INSTANT_SIMULATION_STEPS } from '../engine/simulationRunner';
import { LESSONS } from '../data/lessons';
import {
  AppMode,
  CURRICULUM_ACTIVITIES,
  createCurriculumGridState,
  getActivityAtVersion,
  getActivityLatest,
} from '../data/curriculum';
import {
  GhostPreviewState,
  computeGhostPreviewSteps,
  getPlaceholderHintCategory,
  getPlaceholderHintLabel,
  resolveActivityScaffoldWorkspace,
} from '../engine/placeholderHelpers';
import { exportToString, importFromString, exportToBinary, importFromBinary } from '../engine/serialization/codeSerializer';
import {
  saveStateBeforeUpdate,
  consumeRestoredStateAfterUpdate,
} from '../services/pwaStateRestoreService';

export type EditorTool = 'NONE' | 'ROBOT' | 'WALL' | 'FLAG' | 'GOAL' | 'ERASE';

export const getInitialGridState = (grid: GridState): GridState => ({
  ...grid,
  robot: {
    ...grid.robot,
    x: grid.robot.initialX,
    y: grid.robot.initialY,
    dir: grid.robot.initialDir,
  },
  flags: grid.flags.map((f) => ({ ...f, collected: false })),
  trace: [{ x: grid.robot.initialX, y: grid.robot.initialY }],
  status: 'IDLE',
});

export const getInitialTurtleState = (turtleState: TurtleState): TurtleState => ({
  ...turtleState,
  robot: { x: 0, y: 0, heading: 0 },
  penDown: true,
  penColor: '#0f172a',
  penWidth: 6,
  paths: [],
  status: 'IDLE',
  activeAnimation: null,
});

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
  activeSimId: 'grid' | 'turtle';
  currentLevel: number;
  grid: GridState;
  turtleState: TurtleState;
  workspace: WorkspaceState;
  savedWorkspaces: Record<string, WorkspaceState>;
}

export function computeInstantSimulation(
  workspace: WorkspaceState,
  simId: 'grid' | 'turtle',
  grid: GridState,
  turtleState: TurtleState
) {
  const initialState = simId === 'grid' ? getInitialGridState(grid) : getInitialTurtleState(turtleState);
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
  activeScope: ScopeType;
  selectedBlockId: string | null;
  activeSimId: 'grid' | 'turtle';
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

interface AppState {
  // Mode & Curriculum selection
  appMode: AppMode;
  activeActivityId: string;
  activeActivityVersion: number;
  curriculumWorkspaces: Record<string, WorkspaceState>;
  sandboxSnapshot: SandboxModeSnapshot | null;
  statusAnnouncement: string;
  ghostPreview: GhostPreviewState | null;

  // Environment selection
  activeSimId: 'grid' | 'turtle';
  currentLevel: number;
  grid: GridState;
  turtleState: TurtleState;
  workspace: WorkspaceState;
  savedWorkspaces: Record<string, WorkspaceState>;
  activeScope: ScopeType;
  selectedBlockId: string | null;
  runtime: InterpreterRuntimeState | null;
  isPlaying: boolean;
  speed: SimulationSpeed; // ms per tick: 400 (1x), 100 (4x), 25 (16x), or 'instant'
  editorTool: EditorTool;
  isSolutionOpen: boolean;
  isExportImportOpen: boolean;
  isSaveModalOpen: boolean;
  isLoadModalOpen: boolean;
  isSubpaletteCollapsed: boolean;
  isMapHidden: boolean;
  isFunctionBarOpen: boolean;
  isMobileMenuOpen: boolean;
  wasRestoredAfterUpdate: boolean;

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

  // Mode & Curriculum actions
  setAppMode: (mode: AppMode) => void;
  setCurriculumActivity: (activityId: string, version?: number) => void;
  openCopyInSandbox: () => void;
  loadVariationWorkspace: (workspace: WorkspaceState, title?: string) => void;

  // Actions
  setSimEnvironment: (simId: 'grid' | 'turtle') => void;
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
  setSpeed: (speed: SimulationSpeed | number) => void;
  runInstantIfActive: () => void;
  setSolutionOpen: (open: boolean) => void;
  setExportImportOpen: (open: boolean) => void;
  setSaveModalOpen: (open: boolean) => void;
  setLoadModalOpen: (open: boolean) => void;
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
  importCode: (data: string | Uint8Array) => { success: boolean; error?: string };
  importBinary: (data: Uint8Array) => { success: boolean; error?: string };

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

  // Execution actions
  step: () => void;
  play: () => void;
  pause: () => void;
  reset: () => void;

  // PWA update state persistence actions
  dismissRestoredNotice: () => void;
  prepareStateForUpdate: () => boolean;
  hydrateFromUpdateIfPresent: () => boolean;
}

let timerId: NodeJS.Timeout | null = null;
let turtleRafId: number | null = null;

interface TurtlePendingCommit {
  finalTurtleState: TurtleState;
  finalRuntime: InterpreterRuntimeState;
  isDone: boolean;
  isSingleStep: boolean;
}

let pendingTurtleCommit: TurtlePendingCommit | null = null;
const MAX_HISTORY = 100;
let activeBatchSnapshot: HistorySnapshot | null = null;

const takeSnapshot = (state: AppState, desc?: string): HistorySnapshot => ({
  workspace: cloneWorkspace(state.workspace),
  grid: JSON.parse(JSON.stringify(state.grid)),
  turtleState: JSON.parse(JSON.stringify(state.turtleState)),
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

      const completedTurtleState: TurtleState = {
        ...commit.finalTurtleState,
        activeAnimation: null,
      };

      if (commit.isDone || commit.isSingleStep) {
        set({
          turtleState: completedTurtleState,
          runtime: commit.finalRuntime,
          isPlaying: false,
        });
      } else {
        set({
          turtleState: completedTurtleState,
          runtime: commit.finalRuntime,
        });
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

      const currentFrame = runtime.callStack[runtime.callStack.length - 1];
      const scopeBlocks = workspace[currentFrame.scope] || [];
      const currentBlock = scopeBlocks[currentFrame.pc];

      const isMotion = currentBlock && isTurtleMotionAction(currentBlock.type);

      if (!isMotion) {
        const res = tickInterpreter(runtime, workspace, turtleState, simEnv);
        runtime = res.nextRuntime;
        turtleState = res.nextGrid as TurtleState;

        const activeScope = runtime.callStack.length > 0
          ? runtime.callStack[runtime.callStack.length - 1].scope
          : get().activeScope;

        const isPausedOnPlaceholder = runtime.status === 'PAUSED';
        set({
          runtime,
          turtleState,
          activeScope,
          ...(isPausedOnPlaceholder
            ? {
                selectedBlockId: runtime.activeBlockId,
                statusAnnouncement: getPlaceholderPauseAnnouncement(workspace, runtime),
              }
            : {}),
        });

        if (res.done) {
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

        const activeScope = runtime.callStack.length > 0
          ? runtime.callStack[runtime.callStack.length - 1].scope
          : get().activeScope;

        const isPausedOnPlaceholder = runtime.status === 'PAUSED';
        set({
          runtime,
          turtleState,
          activeScope,
          ...(isPausedOnPlaceholder
            ? {
                selectedBlockId: runtime.activeBlockId,
                statusAnnouncement: getPlaceholderPauseAnnouncement(workspace, runtime),
              }
            : {}),
        });

        if (res.done) {
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

      const activeScope = res.nextRuntime.callStack.length > 0
        ? res.nextRuntime.callStack[res.nextRuntime.callStack.length - 1].scope
        : get().activeScope;

      const resolvedParams: Record<string, any> = {};
      if (currentBlock.params) {
        for (const [k, v] of Object.entries(currentBlock.params)) {
          if (typeof v === 'string' && /^[a-z]$/.test(v.trim())) {
            resolvedParams[k] = evaluateValue(v, runtime.variables, 0);
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
        });

        if (res.done || isSingleStep) {
          set({ isPlaying: false });
          return;
        }

        continue;
      }

      pendingTurtleCommit = {
        finalTurtleState: res.nextGrid as TurtleState,
        finalRuntime: res.nextRuntime,
        isDone: res.done,
        isSingleStep,
      };

      set({
        turtleState: {
          ...turtleState,
          activeAnimation: anim,
        },
        runtime: res.nextRuntime,
        activeScope,
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

  const initialWorkspace =
    bootMode === 'curriculum' && bootActivity?.starterWorkspace
      ? cloneWorkspaceWithFreshIds(bootActivity.starterWorkspace)
      : createEmptyWorkspace();

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

  return {
    appMode: bootMode,
    activeActivityId: bootActivity?.id || '1.1',
    activeActivityVersion: bootActivity?.version || 1,
    curriculumWorkspaces:
      bootMode === 'curriculum' && bootActivity
        ? { [bootActivity.id]: cloneWorkspace(initialWorkspace) }
        : {},
    sandboxSnapshot: null,
    statusAnnouncement: '',
    ghostPreview: null,

    activeSimId: bootMode === 'curriculum' && bootActivity?.simId === 'turtle' ? 'turtle' : 'grid',
    currentLevel: 1,
    grid: initialGrid,
    turtleState: createInitialTurtleState(),
    workspace: initialWorkspace,
    savedWorkspaces: {},
    activeScope: 'MAIN',
    selectedBlockId: null,
    runtime: null,
    isPlaying: false,
    speed: 400,
    editorTool: 'NONE',
    isSolutionOpen: false,
    isExportImportOpen: false,
    isSaveModalOpen: false,
    isLoadModalOpen: false,
    isSubpaletteCollapsed: false,
    isMapHidden: false,
    isFunctionBarOpen: false,
    isMobileMenuOpen: false,
    wasRestoredAfterUpdate: false,

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
          ? { turtleState: JSON.parse(JSON.stringify(previousSnapshot.turtleState)) }
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
        past: newPast,
        future: newFuture,
        canUndo: newPast.length > 0,
        canRedo: true,
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
          ? { turtleState: JSON.parse(JSON.stringify(nextSnapshot.turtleState)) }
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
        past: newPast,
        future: newFuture,
        canUndo: true,
        canRedo: newFuture.length > 0,
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

      const hasWorkspaceChanged = JSON.stringify(initial.workspace) !== JSON.stringify(currentWorkspace);
      const hasGridChanged = JSON.stringify(initial.grid) !== JSON.stringify(currentGrid);
      const hasTurtleChanged =
        initial.turtleState && JSON.stringify(initial.turtleState) !== JSON.stringify(currentTurtle);

      if (hasWorkspaceChanged || hasGridChanged || hasTurtleChanged) {
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

        const targetSimId: 'grid' | 'turtle' = activity.simId === 'turtle' ? 'turtle' : 'grid';
        const prevFitToView = state.grid.fitToView ?? false;
        const targetGrid = activity.grid
          ? createCurriculumGridState(activity.grid, prevFitToView)
          : state.grid;

        const targetWs = state.curriculumWorkspaces[activity.id]
          ? cloneWorkspace(state.curriculumWorkspaces[activity.id])
          : activity.starterWorkspace
          ? cloneWorkspaceWithFreshIds(activity.starterWorkspace)
          : createEmptyWorkspace();

        set({
          appMode: 'curriculum',
          activeActivityId: activity.id,
          activeActivityVersion: activity.version,
          activeSimId: targetSimId,
          grid: targetGrid,
          turtleState: createInitialTurtleState(),
          workspace: targetWs,
          curriculumWorkspaces: {
            ...state.curriculumWorkspaces,
            [activity.id]: cloneWorkspace(targetWs),
          },
          sandboxSnapshot: nextSandboxSnapshot,
          editorTool: 'NONE',
          selectedBlockId: null,
          activeScope: 'MAIN',
          runtime: null,
          ghostPreview: null,
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
        const restoredSimId: 'grid' | 'turtle' = snap?.activeSimId ?? 'grid';
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
        const restoredWs = snap ? cloneWorkspace(snap.workspace) : createEmptyWorkspace();
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
          workspace: restoredWs,
          savedWorkspaces: restoredSaved,
          curriculumWorkspaces: nextCurriculumWorkspaces,
          editorTool: 'NONE',
          selectedBlockId: null,
          activeScope: 'MAIN',
          runtime: null,
          ghostPreview: null,
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

      const targetSimId: 'grid' | 'turtle' = activity.simId === 'turtle' ? 'turtle' : 'grid';
      const prevFitToView = state.grid.fitToView ?? false;
      const targetGrid = activity.grid
        ? createCurriculumGridState(activity.grid, prevFitToView)
        : state.grid;

      const targetWs = nextCurriculumWorkspaces[activity.id]
        ? cloneWorkspace(nextCurriculumWorkspaces[activity.id])
        : activity.starterWorkspace
        ? cloneWorkspaceWithFreshIds(activity.starterWorkspace)
        : createEmptyWorkspace();

      nextCurriculumWorkspaces[activity.id] = cloneWorkspace(targetWs);

      set({
        appMode: 'curriculum',
        activeActivityId: activity.id,
        activeActivityVersion: activity.version,
        activeSimId: targetSimId,
        grid: targetGrid,
        turtleState: createInitialTurtleState(),
        workspace: targetWs,
        curriculumWorkspaces: nextCurriculumWorkspaces,
        sandboxSnapshot: nextSandboxSnapshot,
        editorTool: 'NONE',
        selectedBlockId: null,
        activeScope: 'MAIN',
        runtime: null,
        ghostPreview: null,
        statusAnnouncement: `Activity ${activity.id}: ${activity.title}`,
      });

      get().reset();
      get().runInstantIfActive();
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

      const clonedWs = cloneWorkspaceWithFreshIds(state.workspace);
      const clonedGrid = getInitialGridState(JSON.parse(JSON.stringify(state.grid)));
      const clonedTurtle = getInitialTurtleState(JSON.parse(JSON.stringify(state.turtleState)));

      const baseSaved = state.sandboxSnapshot?.savedWorkspaces ?? state.savedWorkspaces;
      const nextSavedWorkspaces: Record<string, WorkspaceState> = {};
      for (const [k, ws] of Object.entries(baseSaved)) {
        nextSavedWorkspaces[k] = cloneWorkspace(ws);
      }
      nextSavedWorkspaces[state.activeSimId] = cloneWorkspace(clonedWs);

      set({
        appMode: 'sandbox',
        grid: clonedGrid,
        turtleState: clonedTurtle,
        workspace: clonedWs,
        savedWorkspaces: nextSavedWorkspaces,
        curriculumWorkspaces: nextCurriculumWorkspaces,
        sandboxSnapshot: {
          activeSimId: state.activeSimId,
          currentLevel: state.currentLevel,
          grid: JSON.parse(JSON.stringify(clonedGrid)),
          turtleState: JSON.parse(JSON.stringify(clonedTurtle)),
          workspace: cloneWorkspace(clonedWs),
          savedWorkspaces: nextSavedWorkspaces,
        },
        editorTool: 'NONE',
        selectedBlockId: null,
        activeScope: 'MAIN',
        runtime: null,
        ghostPreview: null,
        isMobileMenuOpen: false,
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

      // Restore any saved code for destination env or clear it
      const destinationWorkspace = updatedSavedWorkspaces[simId]
        ? cloneWorkspace(updatedSavedWorkspaces[simId])
        : createEmptyWorkspace();

      set({
        activeSimId: simId,
        savedWorkspaces: updatedSavedWorkspaces,
        workspace: destinationWorkspace,
        selectedBlockId: null,
        activeScope: 'MAIN',
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

    exportCode: (includeMap = true) => {
      const { activeSimId, workspace, grid, turtleState } = get();
      if (activeSimId === 'grid') {
        if (includeMap) {
          return exportToString(workspace, 'grid', grid);
        } else {
          return exportToString(workspace, 'generic');
        }
      } else {
        return exportToString(workspace, 'turtle', turtleState);
      }
    },

    exportBinary: (includeMap = true) => {
      const { activeSimId, workspace, grid, turtleState } = get();
      if (activeSimId === 'grid') {
        if (includeMap) {
          return exportToBinary(workspace, 'grid', grid);
        } else {
          return exportToBinary(workspace, 'generic');
        }
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

      // Importing a full environment snapshot (custom Grid map or Turtle drawing) while in
      // Curriculum mode switches cleanly to Sandbox so read-only lesson maps are never mutated.
      if (
        get().appMode === 'curriculum' &&
        (res.envId === 'turtle' || (res.envId === 'grid' && Boolean(res.gridState)))
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
      } else if (res.envId === 'turtle') {
        const updatedSavedWorkspaces: Record<string, WorkspaceState> = { ...savedWorkspaces };
        if (activeSimId !== 'turtle') {
          updatedSavedWorkspaces[activeSimId] = cloneWorkspace(workspace);
        }
        updatedSavedWorkspaces['turtle'] = cloneWorkspace(newWorkspace);

        set({
          activeSimId: 'turtle',
          turtleState: createInitialTurtleState(),
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
        }
        updatedSavedWorkspaces['grid'] = cloneWorkspace(newWorkspace);

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
      }

      get().reset();
      get().runInstantIfActive();
      return { success: true };
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
      get().runInstantIfActive();
      return true;
    },

    replacePlaceholderBlock: (scope, placeholderBlockId, newType, params) => {
      const currentBlocks = get().workspace[scope] || [];
      const targetIdx = currentBlocks.findIndex(
        (b) => b.id === placeholderBlockId && b.type === 'PLACEHOLDER'
      );
      if (targetIdx === -1) return false;

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

      get().runInstantIfActive();
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

    setActiveScope: (scope) => set({ activeScope: scope, selectedBlockId: null }),
    setSelectedBlockId: (id) => set({ selectedBlockId: id }),
    setEditorTool: (tool) => {
      if (get().appMode === 'curriculum' && tool !== 'NONE') return;
      set({ editorTool: tool });
    },
    setSpeed: (speed) => {
      const prevSpeed = get().speed;
      const wasInstant = prevSpeed === 'instant' || (prevSpeed as any) === 0;
      const normalizedSpeed: SimulationSpeed =
        speed === 0 || speed === 'instant' ? 'instant' : (speed as SimulationSpeed);

      if (normalizedSpeed === 'instant') {
        if (timerId) {
          clearInterval(timerId);
          timerId = null;
        }
        if (turtleRafId !== null) {
          cancelFrame(turtleRafId);
          turtleRafId = null;
        }
        if (pendingTurtleCommit) {
          set({
            turtleState: {
              ...pendingTurtleCommit.finalTurtleState,
              activeAnimation: null,
            },
            runtime: pendingTurtleCommit.finalRuntime,
          });
          pendingTurtleCommit = null;
        }
        set({ speed: 'instant', isPlaying: false });
        get().runInstantIfActive();
      } else {
        set({ speed: normalizedSpeed });
        if (wasInstant) {
          get().reset();
        } else if (get().activeSimId === 'grid') {
          if (get().isPlaying && timerId) {
            clearInterval(timerId);
            timerId = setInterval(() => {
              if (!get().isPlaying) {
                if (timerId) clearInterval(timerId);
                timerId = null;
                return;
              }
              get().step();
            }, normalizedSpeed);
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

    runInstantIfActive: () => {
      const { speed, workspace, activeSimId, grid, turtleState } = get();
      if (speed !== 'instant' && (speed as any) !== 0) return;

      const result = computeInstantSimulation(workspace, activeSimId, grid, turtleState);
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
      } else {
        set({
          turtleState: result.finalState as TurtleState,
          runtime: nextRuntime,
          isPlaying: false,
          ghostPreview: null,
          ...pauseUpdates,
        });
      }
    },

    addBlock: (scope, type, repeatCount, insertAtIndex, params) => {
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
      const isVariableBlock = normalizedType === 'VAR_ASSIGN' || normalizedType === 'VAR_OP';
      const resolvedParams =
        !allowActionParams && !isVariableBlock
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
          ...(state.appMode === 'curriculum'
            ? {
                curriculumWorkspaces: {
                  ...state.curriculumWorkspaces,
                  [state.activeActivityId]: cloneWorkspace(nextWorkspace),
                },
              }
            : {}),
          selectedBlockId: id,
        };
      });
      get().runInstantIfActive();
    },

    updateBlockParams: (scope, blockId, newParams) => {
      const currentState = get();
      const currentBlock = currentState.workspace[scope]?.find((b) => b.id === blockId);
      if (!currentBlock) return;
      const isVariableBlock = currentBlock.type === 'VAR_ASSIGN' || currentBlock.type === 'VAR_OP';
      if (currentState.appMode === 'curriculum' && !isVariableBlock) {
        const activeActivity =
          getActivityAtVersion(currentState.activeActivityId, currentState.activeActivityVersion) ??
          getActivityLatest(currentState.activeActivityId);
        if (activeActivity?.palette?.allowActionParams === false) {
          return;
        }
      }
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
            : {}),
        };
      });
      get().runInstantIfActive();
    },

    removeBlock: (scope, blockId) => {
      const currentBlock = get().workspace[scope]?.find((b) => b.id === blockId);
      if (!currentBlock) return;
      recordMutation('Remove block');
      set((state) => {
        const nextWorkspace: WorkspaceState = {
          ...state.workspace,
          [scope]: state.workspace[scope].filter((b) => b.id !== blockId),
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
            : {}),
          selectedBlockId: state.selectedBlockId === blockId ? null : state.selectedBlockId,
        };
      });
      get().runInstantIfActive();
    },

    updateBlockRepeat: (scope, blockId, repeatCount) => {
      const currentBlock = get().workspace[scope]?.find((b) => b.id === blockId);
      if (!currentBlock || currentBlock.repeatCount === repeatCount) return;
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
            : {}),
        };
      });
      get().runInstantIfActive();
    },

    reorderBlocks: (scope, fromIndex, toIndex) => {
      if (fromIndex === toIndex) return;
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
            : {}),
        };
      });
      get().runInstantIfActive();
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

      if (direction === 'RIGHT') {
        const newWidth = Math.max(minSize, Math.min(maxSize, width + delta));
        if (newWidth === width) return;
        if (delta < 0) {
          const hasBlocked =
            robot.x >= newWidth ||
            robot.initialX >= newWidth ||
            flags.some((f) => f.x >= newWidth) ||
            barriers.some((b) => b.x >= newWidth);
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
            barriers.some((b) => b.y >= newHeight);
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
            barriers.some((b) => (b.orientation === 'H' ? b.x === 0 : b.x <= 1));
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
            barriers.some((b) => (b.orientation === 'V' ? b.y === 0 : b.y <= 1));
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
          if (delta < 0) {
            const hasBlocked =
              robot.x >= newWidth ||
              robot.initialX >= newWidth ||
              flags.some((f) => f.x >= newWidth) ||
              barriers.some((b) => b.x >= newWidth);
            if (hasBlocked) return state;
          }
          return { grid: { ...grid, width: newWidth } };
        }

        if (direction === 'BOTTOM') {
          const newHeight = Math.max(minSize, Math.min(maxSize, height + delta));
          if (newHeight === height) return state;
          if (delta < 0) {
            const hasBlocked =
              robot.y >= newHeight ||
              robot.initialY >= newHeight ||
              flags.some((f) => f.y >= newHeight) ||
              barriers.some((b) => b.y >= newHeight);
            if (hasBlocked) return state;
          }
          return { grid: { ...grid, height: newHeight } };
        }

        if (direction === 'LEFT') {
          const newWidth = Math.max(minSize, Math.min(maxSize, width + delta));
          if (newWidth === width) return state;
          if (delta < 0) {
            const hasBlocked =
              robot.x === 0 ||
              robot.initialX === 0 ||
              flags.some((f) => f.x === 0) ||
              barriers.some((b) => (b.orientation === 'H' ? b.x === 0 : b.x <= 1));
            if (hasBlocked) return state;
          }

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
            },
          };
        }

        if (direction === 'TOP') {
          const newHeight = Math.max(minSize, Math.min(maxSize, height + delta));
          if (newHeight === height) return state;
          if (delta < 0) {
            const hasBlocked =
              robot.y === 0 ||
              robot.initialY === 0 ||
              flags.some((f) => f.y === 0) ||
              barriers.some((b) => (b.orientation === 'V' ? b.y === 0 : b.y <= 1));
            if (hasBlocked) return state;
          }

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
            },
          };
        }

        return state;
      });
      get().runInstantIfActive();
    },

    setCellContent: (x, y) => {
      if (get().appMode === 'curriculum') return;
      const { editorTool, grid } = get();
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
      } else if (editorTool === 'ERASE') {
        const hasFlag = grid.flags.some((f) => f.x === x && f.y === y);
        if (!hasFlag) return;
        recordMutation('Erase cell');
        const nextFlags = grid.flags.filter((f) => !(f.x === x && f.y === y));
        set({ grid: { ...grid, flags: nextFlags } });
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
      set((state) => ({
        turtleState: {
          ...state.turtleState,
          ...updates,
          pan: updates.pan ? { ...state.turtleState.pan, ...updates.pan } : state.turtleState.pan,
        },
      }));
    },

    clearTurtleCanvas: () => {
      recordMutation('Clear turtle canvas');
      get().reset();
      set({
        turtleState: createInitialTurtleState(),
      });
      get().runInstantIfActive();
    },

    step: () => {
      const { speed, activeSimId } = get();
      if (speed === 'instant' || (speed as any) === 0) return;

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

        const res = tickInterpreter(currentRuntime, workspace, grid, simEnv);

        // Auto switch active tab to current running scope if function called
        const activeScope = res.nextRuntime.callStack.length > 0
          ? res.nextRuntime.callStack[res.nextRuntime.callStack.length - 1].scope
          : get().activeScope;

        const isPausedOnPlaceholder = res.nextRuntime.status === 'PAUSED';

        set({
          runtime: res.nextRuntime,
          grid: res.nextGrid as GridState,
          activeScope,
          isPlaying: !res.done && !isPausedOnPlaceholder && get().isPlaying,
          ...(isPausedOnPlaceholder
            ? {
                selectedBlockId: res.nextRuntime.activeBlockId,
                statusAnnouncement: getPlaceholderPauseAnnouncement(workspace, res.nextRuntime),
              }
            : {}),
        });

        if ((res.done || isPausedOnPlaceholder) && timerId) {
          clearInterval(timerId);
          timerId = null;
          set({ isPlaying: false });
        }
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
          set({
            turtleState: {
              ...commit.finalTurtleState,
              activeAnimation: null,
            },
            runtime: commit.finalRuntime,
          });
          if (commit.isDone) {
            set({ isPlaying: false });
            return;
          }
        }

        runTurtleExecutionLoop(true);
      }
    },

    play: () => {
      const { speed, workspace, activeSimId } = get();
      if (get().ghostPreview) {
        set({ ghostPreview: null });
      }
      if (speed === 'instant' || (speed as any) === 0) {
        if (timerId) {
          clearInterval(timerId);
          timerId = null;
        }
        if (turtleRafId !== null) {
          cancelFrame(turtleRafId);
          turtleRafId = null;
        }
        for (const sc of ['MAIN', 'F1', 'F2', 'F3'] as ScopeType[]) {
          if (workspace[sc]?.length > 0) {
            const val = validateLoopStructure(workspace[sc]);
            if (val.hasError) {
              return;
            }
          }
        }
        get().runInstantIfActive();
        return;
      }

      if (get().isPlaying) return;

      const { grid, turtleState, runtime } = get();
      const currentSimState = activeSimId === 'grid' ? grid : turtleState;
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
        if (timerId) clearInterval(timerId);
        set({ isPlaying: true });

        // Run immediate first step
        get().step();
        if (!get().isPlaying) {
          return;
        }

        timerId = setInterval(() => {
          if (!get().isPlaying) {
            if (timerId) clearInterval(timerId);
            timerId = null;
            return;
          }
          get().step();
        }, get().speed as number);
      } else {
        // Turtle runner: RAF-driven constant speed loop
        set({ isPlaying: true });
        runTurtleExecutionLoop(false);
      }
    },

    pause: () => {
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
      if (turtleRafId !== null) {
        cancelFrame(turtleRafId);
        turtleRafId = null;
      }
      if (pendingTurtleCommit) {
        pendingTurtleCommit.isSingleStep = false;
      }
      set({ isPlaying: false });
    },

    reset: () => {
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
      if (turtleRafId !== null) {
        cancelFrame(turtleRafId);
        turtleRafId = null;
      }
      pendingTurtleCommit = null;

      const { grid, turtleState, activeSimId } = get();

      if (activeSimId === 'grid') {
        set({
          isPlaying: false,
          runtime: null,
          ghostPreview: null,
          grid: getInitialGridState(grid),
        });
      } else {
        set({
          isPlaying: false,
          runtime: null,
          ghostPreview: null,
          turtleState: getInitialTurtleState(turtleState),
        });
      }
    },

    dismissRestoredNotice: () => set({ wasRestoredAfterUpdate: false }),

    prepareStateForUpdate: () => {
      // Stop timers / RAF and commit any in-flight turtle animation before snapshot
      get().pause();
      if (pendingTurtleCommit) {
        const commit = pendingTurtleCommit;
        pendingTurtleCommit = null;
        set({
          turtleState: {
            ...commit.finalTurtleState,
            activeAnimation: null,
          },
          runtime: commit.finalRuntime,
        });
      }

      const s = get();
      return saveStateBeforeUpdate({
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
        runtime: s.runtime,
        activeScope: s.activeScope,
        selectedBlockId: s.selectedBlockId,
        speed: s.speed,
        editorTool: s.editorTool,
        isSubpaletteCollapsed: s.isSubpaletteCollapsed,
        isMapHidden: s.isMapHidden,
        isFunctionBarOpen: s.isFunctionBarOpen,
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

      set({
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
        runtime: restored.runtime,
        isPlaying: false,
        activeScope: restored.activeScope,
        selectedBlockId: restored.selectedBlockId,
        speed: restored.speed,
        editorTool: restored.editorTool,
        isSubpaletteCollapsed: restored.isSubpaletteCollapsed,
        isMapHidden: restored.isMapHidden,
        isFunctionBarOpen: restored.isFunctionBarOpen,
        past: restored.past,
        future: restored.future,
        canUndo: restored.past.length > 0,
        canRedo: restored.future.length > 0,
        wasRestoredAfterUpdate: true,
      });

      get().runInstantIfActive();
      return true;
    },
  };
});

// Automatically restore workspace state if reloading immediately after a PWA update
useAppStore.getState().hydrateFromUpdateIfPresent();

