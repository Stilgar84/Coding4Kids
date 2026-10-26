import { create } from 'zustand';
import {
  GridState,
  WorkspaceState,
  InterpreterRuntimeState,
  ScopeType,
  WallEdge,
  Direction,
  CodeBlock,
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
} from '../engine/interpreter';
import { LESSONS } from '../data/lessons';

export type EditorTool = 'NONE' | 'ROBOT' | 'WALL' | 'FLAG' | 'GOAL' | 'ERASE';

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
  activeScope: ScopeType;
  selectedBlockId: string | null;
  runtime: InterpreterRuntimeState | null;
  isPlaying: boolean;
  speed: number; // ms per tick: 400 (1x), 200 (2x), 100 (4x), 50 (8x)
  editorTool: EditorTool;
  isSolutionOpen: boolean;

  // Actions
  setSimEnvironment: (simId: 'grid' | 'turtle') => void;
  setLevel: (levelId: number) => void;
  setActiveScope: (scope: ScopeType) => void;
  setSelectedBlockId: (id: string | null) => void;
  setEditorTool: (tool: EditorTool) => void;
  setSpeed: (speed: number) => void;
  setSolutionOpen: (open: boolean) => void;
  loadSolution: (lessonId?: number) => void;

  // Workspace actions
  addBlock: (scope: ScopeType, type: string, repeatCount?: number, insertAtIndex?: number, params?: Record<string, any>) => void;
  removeBlock: (scope: ScopeType, blockId: string) => void;
  updateBlockRepeat: (scope: ScopeType, blockId: string, repeatCount?: number) => void;
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

export const useAppStore = create<AppState>((set, get) => {
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
    activeScope: 'MAIN',
    selectedBlockId: null,
    runtime: null,
    isPlaying: false,
    speed: 400,
    editorTool: 'NONE',
    isSolutionOpen: false,

    setSimEnvironment: (simId) => {
      get().reset();
      set({ activeSimId: simId });
    },

    setSolutionOpen: (open) => set({ isSolutionOpen: open }),

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

      set({
        workspace: {
          MAIN: cloneBlocks(lesson.solution.MAIN),
          F1: cloneBlocks(lesson.solution.F1 || []),
          F2: cloneBlocks(lesson.solution.F2 || []),
          F3: cloneBlocks(lesson.solution.F3 || []),
        },
        activeScope: 'MAIN',
        selectedBlockId: null,
      });
    },

    setLevel: (levelId) => {
      const prevFitToView = get().grid.fitToView ?? false;
      get().reset();
      const preset = PRESET_LEVELS.find((p) => p.id === levelId) || PRESET_LEVELS[0];
      set({
        currentLevel: levelId,
        grid: createGridFromPreset(preset, prevFitToView),
      });
    },

    setActiveScope: (scope) => set({ activeScope: scope, selectedBlockId: null }),
    setSelectedBlockId: (id) => set({ selectedBlockId: id }),
    setEditorTool: (tool) => set({ editorTool: tool }),
    setSpeed: (speed) => {
      set({ speed });
      // If currently playing, restart the interval with the updated speed
      if (get().isPlaying && timerId) {
        clearInterval(timerId);
        timerId = setInterval(() => {
          if (!get().isPlaying) {
            if (timerId) clearInterval(timerId);
            timerId = null;
            return;
          }
          get().step();
        }, speed);
      }
    },

    addBlock: (scope, type, repeatCount, insertAtIndex, params) => {
      const id = `${type}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newBlock: CodeBlock = { id, type, repeatCount, params };
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
    },

    removeBlock: (scope, blockId) => {
      set((state) => ({
        workspace: {
          ...state.workspace,
          [scope]: state.workspace[scope].filter((b) => b.id !== blockId),
        },
        selectedBlockId: state.selectedBlockId === blockId ? null : state.selectedBlockId,
      }));
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
    },

    clearWorkspace: (scope) => {
      if (scope) {
        set((state) => ({
          workspace: { ...state.workspace, [scope]: [] },
        }));
      } else {
        set({
          workspace: { MAIN: [], F1: [], F2: [], F3: [] },
        });
      }
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
    },

    step: () => {
      const { runtime, workspace, activeSimId, grid, turtleState } = get();

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
      const simEnv = getSimEnvironment(activeSimId);
      if (!simEnv) return;

      const activeState = activeSimId === 'grid' ? grid : turtleState;
      const res = tickInterpreter(currentRuntime, workspace, activeState, simEnv);

      // Auto switch active tab to current running scope if function called
      const activeScope = res.nextRuntime.callStack.length > 0
        ? res.nextRuntime.callStack[res.nextRuntime.callStack.length - 1].scope
        : get().activeScope;

      if (activeSimId === 'grid') {
        set({
          runtime: res.nextRuntime,
          grid: res.nextGrid as GridState,
          activeScope,
          isPlaying: !res.done && get().isPlaying,
        });
      } else {
        set({
          runtime: res.nextRuntime,
          turtleState: res.nextGrid as TurtleState,
          activeScope,
          isPlaying: !res.done && get().isPlaying,
        });
      }

      if (res.done && timerId) {
        clearInterval(timerId);
        timerId = null;
        set({ isPlaying: false });
      }
    },

    play: () => {
      if (get().isPlaying) return;

      const { activeSimId, grid, turtleState, runtime } = get();
      const currentSimState = activeSimId === 'grid' ? grid : turtleState;
      const hasEndedOrFail =
        currentSimState.status === 'SUCCESS' ||
        currentSimState.status === 'COLLISION' ||
        (runtime !== null && runtime.callStack.length === 0);

      if (hasEndedOrFail) {
        get().reset();
      }

      // Guard: do not execute if loops are unclosed in any used workspace scope
      const { workspace } = get();
      for (const sc of ['MAIN', 'F1', 'F2', 'F3'] as ScopeType[]) {
        if (workspace[sc]?.length > 0) {
          const val = validateLoopStructure(workspace[sc]);
          if (val.hasError) {
            return;
          }
        }
      }

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
      }, get().speed);
    },

    pause: () => {
      if (timerId) clearInterval(timerId);
      timerId = null;
      set({ isPlaying: false });
    },

    reset: () => {
      if (timerId) clearInterval(timerId);
      timerId = null;
      const { grid, turtleState, activeSimId } = get();

      if (activeSimId === 'grid') {
        set({
          isPlaying: false,
          runtime: null,
          grid: {
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
          },
        });
      } else {
        set({
          isPlaying: false,
          runtime: null,
          turtleState: {
            ...turtleState,
            robot: { x: 0, y: 0, heading: 0 },
            paths: [],
            status: 'IDLE',
          },
        });
      }
    },
  };
});

