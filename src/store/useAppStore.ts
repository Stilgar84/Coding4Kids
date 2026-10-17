import { create } from 'zustand';
import {
  GridState,
  WorkspaceState,
  InterpreterRuntimeState,
  ScopeType,
  BlockType,
  WallEdge,
  Direction,
} from '../types';
import {
  createInitialInterpreterState,
  tickInterpreter,
  validateLoopStructure,
} from '../engine/interpreter';

export type EditorTool = 'NONE' | 'ROBOT' | 'WALL' | 'FLAG' | 'GOAL' | 'ERASE';

export interface LevelPreset {
  id: number;
  width: number;
  height: number;
  robot: { x: number; y: number; dir: Direction };
  barriers: WallEdge[];
  flags: { id: string; x: number; y: number; isGoal: boolean; order: number; collected: boolean }[];
}

export const PRESET_LEVELS: LevelPreset[] = [
  {
    id: 1,
    width: 5,
    height: 5,
    robot: { x: 0, y: 2, dir: 'EAST' },
    barriers: [],
    flags: [{ id: 'goal', x: 4, y: 2, isGoal: true, order: 1, collected: false }],
  },
  {
    id: 2,
    width: 5,
    height: 5,
    robot: { x: 0, y: 4, dir: 'NORTH' },
    barriers: [
      { orientation: 'H', x: 0, y: 2 },
      { orientation: 'H', x: 1, y: 2 },
      { orientation: 'V', x: 3, y: 2 },
      { orientation: 'V', x: 3, y: 3 },
    ],
    flags: [
      { id: 'f1', x: 2, y: 2, isGoal: false, order: 1, collected: false },
      { id: 'goal', x: 4, y: 0, isGoal: true, order: 2, collected: false },
    ],
  },
  {
    id: 3,
    width: 6,
    height: 6,
    robot: { x: 0, y: 0, dir: 'EAST' },
    barriers: [
      { orientation: 'H', x: 0, y: 1 },
      { orientation: 'H', x: 1, y: 1 },
      { orientation: 'H', x: 2, y: 1 },
      { orientation: 'H', x: 3, y: 1 },
      { orientation: 'V', x: 4, y: 2 },
      { orientation: 'V', x: 4, y: 3 },
      { orientation: 'H', x: 1, y: 4 },
      { orientation: 'H', x: 2, y: 4 },
    ],
    flags: [
      { id: 'f1', x: 4, y: 1, isGoal: false, order: 1, collected: false },
      { id: 'f2', x: 1, y: 3, isGoal: false, order: 2, collected: false },
      { id: 'goal', x: 5, y: 5, isGoal: true, order: 3, collected: false },
    ],
  },
];

interface AppState {
  currentLevel: number;
  grid: GridState;
  workspace: WorkspaceState;
  activeScope: ScopeType;
  selectedBlockId: string | null;
  runtime: InterpreterRuntimeState | null;
  isPlaying: boolean;
  speed: number; // ms per tick: 600, 300, 150
  editorTool: EditorTool;

  // Actions
  setLevel: (levelId: number) => void;
  setActiveScope: (scope: ScopeType) => void;
  setSelectedBlockId: (id: string | null) => void;
  setEditorTool: (tool: EditorTool) => void;
  setSpeed: (speed: number) => void;

  // Workspace actions
  addBlock: (scope: ScopeType, type: BlockType, repeatCount?: number, insertAtIndex?: number) => void;
  removeBlock: (scope: ScopeType, blockId: string) => void;
  updateBlockRepeat: (scope: ScopeType, blockId: string, repeatCount?: number) => void;
  reorderBlocks: (scope: ScopeType, fromIndex: number, toIndex: number) => void;
  clearWorkspace: (scope?: ScopeType) => void;

  // Grid editing actions
  toggleWall: (edge: WallEdge) => void;
  setCellContent: (x: number, y: number) => void;
  toggleTrace: () => void;
  clearGridUserCustoms: () => void;

  // Execution actions
  step: () => void;
  play: () => void;
  pause: () => void;
  reset: () => void;
}

let timerId: NodeJS.Timeout | null = null;

export const useAppStore = create<AppState>((set, get) => {
  const initialPreset = PRESET_LEVELS[0];

  const createGridFromPreset = (preset: LevelPreset): GridState => ({
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
  });

  return {
    currentLevel: 1,
    grid: createGridFromPreset(initialPreset),
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

    setLevel: (levelId) => {
      get().reset();
      const preset = PRESET_LEVELS.find((p) => p.id === levelId) || PRESET_LEVELS[0];
      set({
        currentLevel: levelId,
        grid: createGridFromPreset(preset),
      });
    },

    setActiveScope: (scope) => set({ activeScope: scope, selectedBlockId: null }),
    setSelectedBlockId: (id) => set({ selectedBlockId: id }),
    setEditorTool: (tool) => set({ editorTool: tool }),
    setSpeed: (speed) => set({ speed }),

    addBlock: (scope, type, repeatCount, insertAtIndex) => {
      const id = `${type}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newBlock = { id, type, repeatCount };
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

    clearGridUserCustoms: () => {
      const preset = PRESET_LEVELS.find((p) => p.id === get().currentLevel) || PRESET_LEVELS[0];
      set({ grid: createGridFromPreset(preset) });
    },

    step: () => {
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

      const res = tickInterpreter(currentRuntime, workspace, grid);

      // Auto switch active tab to current running scope if function called
      const activeScope = res.nextRuntime.callStack.length > 0
        ? res.nextRuntime.callStack[res.nextRuntime.callStack.length - 1].scope
        : get().activeScope;

      set({
        runtime: res.nextRuntime,
        grid: res.nextGrid,
        activeScope,
        isPlaying: !res.done && get().isPlaying,
      });

      if (res.done && timerId) {
        clearInterval(timerId);
        timerId = null;
        set({ isPlaying: false });
      }
    },

    play: () => {
      if (get().isPlaying) return;

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
      const { grid } = get();
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
    },
  };
});
