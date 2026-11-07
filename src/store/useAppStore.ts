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
import { exportToString, importFromString } from '../engine/serialization/codeSerializer';

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

export const PRESET_LEVELS: LevelPreset[] = LESSONS.map((lesson) => ({
  id: lesson.id,
  width: lesson.grid.width,
  height: lesson.grid.height,
  robot: lesson.grid.robot,
  barriers: lesson.grid.barriers,
  flags: lesson.grid.flags,
}));

interface AppState {
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

  // Actions
  setSimEnvironment: (simId: 'grid' | 'turtle') => void;
  setLevel: (levelId: number) => void;
  setActiveScope: (scope: ScopeType) => void;
  setSelectedBlockId: (id: string | null) => void;
  toggleSubpalette: () => void;
  setSubpaletteCollapsed: (collapsed: boolean) => void;
  setEditorTool: (tool: EditorTool) => void;
  setSpeed: (speed: SimulationSpeed | number) => void;
  runInstantIfActive: () => void;
  setSolutionOpen: (open: boolean) => void;
  setExportImportOpen: (open: boolean) => void;
  setSaveModalOpen: (open: boolean) => void;
  setLoadModalOpen: (open: boolean) => void;
  loadSolution: (lessonId?: number) => void;
  exportCode: (includeMap?: boolean) => string;
  importCode: (data: string) => { success: boolean; error?: string };

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

        set({
          runtime,
          turtleState,
          activeScope,
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

        set({
          runtime,
          turtleState,
          activeScope,
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

  return {
    activeSimId: 'grid',
    currentLevel: 1,
    grid: createGridFromPreset(initialPreset),
    turtleState: createInitialTurtleState(),
    workspace: {
      MAIN: [],
      F1: [],
      F2: [],
      F3: [],
    },
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

    setSimEnvironment: (simId) => {
      const { activeSimId, workspace, savedWorkspaces } = get();
      if (simId === activeSimId) return;

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

    importCode: (data: string) => {
      const res = importFromString(data);
      if (!res.success) {
        return { success: false, error: res.error || 'Failed to import code' };
      }

      get().pause();

      const { activeSimId, workspace, savedWorkspaces } = get();
      const newWorkspace = res.workspace || createEmptyWorkspace();

      if (res.envId === 'turtle') {
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
      const id = lessonId ?? get().currentLevel;
      const lesson = LESSONS.find((l) => l.id === id);
      if (!lesson) return;

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
      });
      get().runInstantIfActive();
    },

    setLevel: (levelId) => {
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
    setEditorTool: (tool) => set({ editorTool: tool }),
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
      if (activeSimId === 'grid') {
        set({
          grid: result.finalState as GridState,
          runtime: {
            ...result.finalRuntime,
            activeBlockId: null,
            activeRepeatProgress: null,
          },
          isPlaying: false,
        });
      } else {
        set({
          turtleState: result.finalState as TurtleState,
          runtime: {
            ...result.finalRuntime,
            activeBlockId: null,
            activeRepeatProgress: null,
          },
          isPlaying: false,
        });
      }
    },

    addBlock: (scope, type, repeatCount, insertAtIndex, params) => {
      const id = `${type}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const simEnv = getSimEnvironment(get().activeSimId);
      const paletteItem = simEnv?.paletteItems.find((p) => p.actionType === type);
      const resolvedParams = params ?? (paletteItem?.params ? { ...paletteItem.params } : undefined);
      const newBlock: CodeBlock = { id, type, repeatCount, params: resolvedParams };
      set((state) => {
        const currentBlocks = [...state.workspace[scope]];
        if (typeof insertAtIndex === 'number' && insertAtIndex >= 0 && insertAtIndex <= currentBlocks.length) {
          currentBlocks.splice(insertAtIndex, 0, newBlock);
        } else {
          currentBlocks.push(newBlock);
        }
        return {
          workspace: {
            ...state.workspace,
            [scope]: currentBlocks,
          },
          selectedBlockId: id,
        };
      });
      get().runInstantIfActive();
    },

    updateBlockParams: (scope, blockId, newParams) => {
      set((state) => ({
        workspace: {
          ...state.workspace,
          [scope]: state.workspace[scope].map((b) =>
            b.id === blockId ? { ...b, params: { ...(b.params || {}), ...newParams } } : b
          ),
        },
      }));
      get().runInstantIfActive();
    },

    removeBlock: (scope, blockId) => {
      set((state) => ({
        workspace: {
          ...state.workspace,
          [scope]: state.workspace[scope].filter((b) => b.id !== blockId),
        },
        selectedBlockId: state.selectedBlockId === blockId ? null : state.selectedBlockId,
      }));
      get().runInstantIfActive();
    },

    updateBlockRepeat: (scope, blockId, repeatCount) => {
      set((state) => ({
        workspace: {
          ...state.workspace,
          [scope]: state.workspace[scope].map((b) =>
            b.id === blockId ? { ...b, repeatCount } : b
          ),
        },
      }));
      get().runInstantIfActive();
    },

    reorderBlocks: (scope, fromIndex, toIndex) => {
      set((state) => {
        const blocks = [...state.workspace[scope]];
        const [moved] = blocks.splice(fromIndex, 1);
        blocks.splice(toIndex, 0, moved);
        return {
          workspace: {
            ...state.workspace,
            [scope]: blocks,
          },
        };
      });
      get().runInstantIfActive();
    },

    clearWorkspace: (scope) => {
      if (scope) {
        set((state) => {
          const newWorkspace = { ...state.workspace, [scope]: [] };
          return {
            workspace: newWorkspace,
            savedWorkspaces: {
              ...state.savedWorkspaces,
              [state.activeSimId]: cloneWorkspace(newWorkspace),
            },
          };
        });
      } else {
        const emptyWorkspace = createEmptyWorkspace();
        set((state) => ({
          workspace: emptyWorkspace,
          savedWorkspaces: {
            ...state.savedWorkspaces,
            [state.activeSimId]: cloneWorkspace(emptyWorkspace),
          },
        }));
      }
      get().runInstantIfActive();
    },

    toggleWall: (edge) => {
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
      set((state) => {
        const exists = state.grid.barriers.some(
          (b) => b.orientation === edge.orientation && b.x === edge.x && b.y === edge.y
        );
        if (exists) return state;
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
      if (delta === 0) return;
      set((state) => {
        const { grid } = state;
        const minSize = 3;
        const maxSize = 16;
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
      const { editorTool, grid } = get();
      if (editorTool === 'ROBOT') {
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
      get().reset();
      set({
        turtleState: createInitialTurtleState(),
      });
      get().runInstantIfActive();
    },

    step: () => {
      const { speed, activeSimId } = get();
      if (speed === 'instant' || (speed as any) === 0) return;

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

        set({
          runtime: res.nextRuntime,
          grid: res.nextGrid as GridState,
          activeScope,
          isPlaying: !res.done && get().isPlaying,
        });

        if (res.done && timerId) {
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
          grid: getInitialGridState(grid),
        });
      } else {
        set({
          isPlaying: false,
          runtime: null,
          turtleState: getInitialTurtleState(turtleState),
        });
      }
    },
  };
});

