import {
  CodeBlock,
  Direction,
  GridState,
  InterpreterRuntimeState,
  ScopeType,
  SimulationSpeed,
  SimulationStatus,
  WorkspaceState,
} from '../types';
import { TurtleState } from '../simulations/turtle/types';
import { createInitialTurtleState } from '../simulations/turtle/turtleEnvironment';
import type { EditorTool, HistorySnapshot } from '../store/useAppStore';

export const PENDING_UPDATE_STORAGE_KEY = 'robotemu_pending_update_state';
export const UPDATE_SNAPSHOT_VERSION = 1;
export const UPDATE_SNAPSHOT_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_PERSISTED_HISTORY = 20;

export interface AppUpdateStateInput {
  activeSimId: 'grid' | 'turtle';
  currentLevel: number;
  workspace: WorkspaceState;
  savedWorkspaces: Record<string, WorkspaceState>;
  grid: GridState;
  turtleState: TurtleState;
  runtime: InterpreterRuntimeState | null;
  activeScope: ScopeType;
  selectedBlockId: string | null;
  speed: SimulationSpeed;
  editorTool: EditorTool;
  isSubpaletteCollapsed: boolean;
  isMapHidden: boolean;
  isFunctionBarOpen: boolean;
  past: HistorySnapshot[];
  future: HistorySnapshot[];
}

export interface PersistedUpdatePayload extends AppUpdateStateInput {
  version: number;
  savedAt: number;
  expiresAt: number;
}

// In-memory fallback for non-browser test environments
let memorySessionStorage: Record<string, string> = {};
let memoryLocalStorage: Record<string, string> = {};

function readSession(key: string): string | null {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      // Fallback
    }
  }
  return memorySessionStorage[key] ?? null;
}

function writeSession(key: string, value: string): boolean {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }
  memorySessionStorage[key] = value;
  return true;
}

function removeSession(key: string): void {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // Ignore
    }
  }
  delete memorySessionStorage[key];
}

function readLocal(key: string): string | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      // Fallback
    }
  }
  return memoryLocalStorage[key] ?? null;
}

function writeLocal(key: string, value: string): boolean {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }
  memoryLocalStorage[key] = value;
  return true;
}

function removeLocal(key: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore
    }
  }
  delete memoryLocalStorage[key];
}

export function clearPendingUpdateState(): void {
  removeSession(PENDING_UPDATE_STORAGE_KEY);
  removeLocal(PENDING_UPDATE_STORAGE_KEY);
}

const VALID_SCOPES: readonly ScopeType[] = ['MAIN', 'F1', 'F2', 'F3'];
const VALID_DIRECTIONS: readonly Direction[] = ['NORTH', 'EAST', 'SOUTH', 'WEST'];
const VALID_TOOLS: readonly EditorTool[] = ['NONE', 'ROBOT', 'WALL', 'FLAG', 'GOAL', 'ERASE'];
const VALID_STATUSES: readonly SimulationStatus[] = ['IDLE', 'RUNNING', 'PAUSED', 'SUCCESS', 'COLLISION'];

function sanitizeBlockList(raw: unknown): CodeBlock[] {
  if (!Array.isArray(raw)) return [];
  const blocks: CodeBlock[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    if (typeof obj.id !== 'string' || !obj.id || typeof obj.type !== 'string' || !obj.type) continue;
    const block: CodeBlock = {
      id: obj.id,
      type: obj.type,
    };
    if (typeof obj.repeatCount === 'number' || typeof obj.repeatCount === 'string') {
      block.repeatCount = obj.repeatCount as CodeBlock['repeatCount'];
    }
    if (obj.params && typeof obj.params === 'object' && !Array.isArray(obj.params)) {
      block.params = JSON.parse(JSON.stringify(obj.params));
    }
    blocks.push(block);
  }
  return blocks;
}

function sanitizeWorkspace(raw: unknown): WorkspaceState {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    MAIN: sanitizeBlockList(src.MAIN),
    F1: sanitizeBlockList(src.F1),
    F2: sanitizeBlockList(src.F2),
    F3: sanitizeBlockList(src.F3),
  };
}

function sanitizeGridState(raw: unknown, fallbackGrid: GridState): GridState {
  if (!raw || typeof raw !== 'object') {
    return JSON.parse(JSON.stringify(fallbackGrid));
  }
  const g = raw as Record<string, any>;
  const width = typeof g.width === 'number' && g.width >= 3 && g.width <= 16 ? g.width : fallbackGrid.width;
  const height = typeof g.height === 'number' && g.height >= 3 && g.height <= 16 ? g.height : fallbackGrid.height;

  const rawRobot = g.robot && typeof g.robot === 'object' ? g.robot : fallbackGrid.robot;
  const dir: Direction = VALID_DIRECTIONS.includes(rawRobot.dir) ? rawRobot.dir : fallbackGrid.robot.dir;
  const initialDir: Direction = VALID_DIRECTIONS.includes(rawRobot.initialDir)
    ? rawRobot.initialDir
    : dir;
  const x = typeof rawRobot.x === 'number' ? rawRobot.x : fallbackGrid.robot.x;
  const y = typeof rawRobot.y === 'number' ? rawRobot.y : fallbackGrid.robot.y;
  const initialX = typeof rawRobot.initialX === 'number' ? rawRobot.initialX : x;
  const initialY = typeof rawRobot.initialY === 'number' ? rawRobot.initialY : y;

  const barriers = Array.isArray(g.barriers)
    ? g.barriers.filter(
        (b: any) =>
          b &&
          (b.orientation === 'H' || b.orientation === 'V') &&
          typeof b.x === 'number' &&
          typeof b.y === 'number'
      )
    : [...fallbackGrid.barriers];

  const flags = Array.isArray(g.flags)
    ? g.flags
        .filter((f: any) => f && typeof f.x === 'number' && typeof f.y === 'number')
        .map((f: any, idx: number) => ({
          id: typeof f.id === 'string' && f.id ? f.id : `flag_${idx}`,
          x: f.x,
          y: f.y,
          isGoal: Boolean(f.isGoal),
          order: typeof f.order === 'number' ? f.order : idx + 1,
          collected: Boolean(f.collected),
        }))
    : fallbackGrid.flags.map((f) => ({ ...f }));

  const trace =
    Array.isArray(g.trace) && g.trace.length > 0
      ? g.trace.filter((t: any) => t && typeof t.x === 'number' && typeof t.y === 'number')
      : [{ x: initialX, y: initialY }];

  const status: SimulationStatus = VALID_STATUSES.includes(g.status) ? g.status : 'IDLE';

  return {
    width,
    height,
    robot: { x, y, dir, initialX, initialY, initialDir },
    barriers,
    flags,
    trace,
    status: status === 'RUNNING' ? 'PAUSED' : status,
    showTrace: typeof g.showTrace === 'boolean' ? g.showTrace : fallbackGrid.showTrace,
    fitToView: typeof g.fitToView === 'boolean' ? g.fitToView : Boolean(fallbackGrid.fitToView),
  };
}

function sanitizeTurtleState(raw: unknown): TurtleState {
  const defaults = createInitialTurtleState();
  if (!raw || typeof raw !== 'object') {
    return defaults;
  }
  const t = raw as Record<string, any>;
  const rawRobot = t.robot && typeof t.robot === 'object' ? t.robot : defaults.robot;
  const robot = {
    x: typeof rawRobot.x === 'number' && Number.isFinite(rawRobot.x) ? rawRobot.x : defaults.robot.x,
    y: typeof rawRobot.y === 'number' && Number.isFinite(rawRobot.y) ? rawRobot.y : defaults.robot.y,
    heading:
      typeof rawRobot.heading === 'number' && Number.isFinite(rawRobot.heading)
        ? rawRobot.heading
        : defaults.robot.heading,
  };

  const paths = Array.isArray(t.paths)
    ? t.paths.filter((p: any) => p && (p.type === 'LINE' || p.type === 'ARC'))
    : [];

  const status: SimulationStatus = VALID_STATUSES.includes(t.status) ? t.status : 'IDLE';
  const rawPan = t.pan && typeof t.pan === 'object' ? t.pan : defaults.pan;

  return {
    ...defaults,
    robot,
    penDown: typeof t.penDown === 'boolean' ? t.penDown : defaults.penDown,
    penColor: typeof t.penColor === 'string' && t.penColor ? t.penColor : defaults.penColor,
    penWidth: typeof t.penWidth === 'number' && t.penWidth > 0 ? t.penWidth : defaults.penWidth,
    paths: JSON.parse(JSON.stringify(paths)),
    status: status === 'RUNNING' ? 'PAUSED' : status,
    pan: {
      x: typeof rawPan.x === 'number' && Number.isFinite(rawPan.x) ? rawPan.x : defaults.pan.x,
      y: typeof rawPan.y === 'number' && Number.isFinite(rawPan.y) ? rawPan.y : defaults.pan.y,
    },
    zoom: typeof t.zoom === 'number' && t.zoom > 0 ? t.zoom : defaults.zoom,
    fitToView: typeof t.fitToView === 'boolean' ? t.fitToView : defaults.fitToView,
    computedBounds:
      t.computedBounds && typeof t.computedBounds === 'object'
        ? {
            minX: typeof t.computedBounds.minX === 'number' ? t.computedBounds.minX : defaults.computedBounds.minX,
            minY: typeof t.computedBounds.minY === 'number' ? t.computedBounds.minY : defaults.computedBounds.minY,
            maxX: typeof t.computedBounds.maxX === 'number' ? t.computedBounds.maxX : defaults.computedBounds.maxX,
            maxY: typeof t.computedBounds.maxY === 'number' ? t.computedBounds.maxY : defaults.computedBounds.maxY,
          }
        : defaults.computedBounds,
    activeAnimation: null,
  };
}

function sanitizeSpeed(raw: unknown): SimulationSpeed {
  if (raw === 'instant' || raw === 0) return 'instant';
  if (raw === 400 || raw === 100 || raw === 25) return raw;
  return 400;
}

function sanitizeHistoryList(raw: unknown, fallbackGrid: GridState): HistorySnapshot[] {
  if (!Array.isArray(raw)) return [];
  const list: HistorySnapshot[] = [];
  for (const snap of raw.slice(-MAX_PERSISTED_HISTORY)) {
    if (!snap || typeof snap !== 'object') continue;
    const s = snap as Record<string, any>;
    list.push({
      workspace: sanitizeWorkspace(s.workspace),
      grid: sanitizeGridState(s.grid, fallbackGrid),
      turtleState: s.turtleState ? sanitizeTurtleState(s.turtleState) : undefined,
      activeScope: VALID_SCOPES.includes(s.activeScope) ? s.activeScope : 'MAIN',
      selectedBlockId: typeof s.selectedBlockId === 'string' ? s.selectedBlockId : null,
      activeSimId: s.activeSimId === 'turtle' ? 'turtle' : 'grid',
      description: typeof s.description === 'string' ? s.description : undefined,
    });
  }
  return list;
}

function sanitizeRuntime(raw: unknown): InterpreterRuntimeState | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, any>;
  if (!Array.isArray(r.callStack) || !Array.isArray(r.loopStack)) return null;
  const activeScope: ScopeType = VALID_SCOPES.includes(r.activeScope) ? r.activeScope : 'MAIN';
  const status: SimulationStatus = VALID_STATUSES.includes(r.status) ? r.status : 'IDLE';
  return {
    callStack: JSON.parse(JSON.stringify(r.callStack)),
    loopStack: JSON.parse(JSON.stringify(r.loopStack)),
    activeBlockId: typeof r.activeBlockId === 'string' ? r.activeBlockId : null,
    activeScope,
    status: status === 'RUNNING' ? 'PAUSED' : status,
    stepCount: typeof r.stepCount === 'number' ? r.stepCount : 0,
    activeRepeatProgress:
      r.activeRepeatProgress && typeof r.activeRepeatProgress === 'object'
        ? JSON.parse(JSON.stringify(r.activeRepeatProgress))
        : null,
    variables:
      r.variables && typeof r.variables === 'object' ? JSON.parse(JSON.stringify(r.variables)) : ({} as any),
  };
}

/**
 * Saves the full current application state before triggering a PWA Service Worker update reload.
 */
export function saveStateBeforeUpdate(state: AppUpdateStateInput, now: number = Date.now()): boolean {
  const cleanTurtle: TurtleState = {
    ...JSON.parse(JSON.stringify(state.turtleState)),
    activeAnimation: null,
  };

  const payload: PersistedUpdatePayload = {
    version: UPDATE_SNAPSHOT_VERSION,
    savedAt: now,
    expiresAt: now + UPDATE_SNAPSHOT_TTL_MS,
    activeSimId: state.activeSimId,
    currentLevel: state.currentLevel,
    workspace: JSON.parse(JSON.stringify(state.workspace)),
    savedWorkspaces: JSON.parse(JSON.stringify(state.savedWorkspaces || {})),
    grid: JSON.parse(JSON.stringify(state.grid)),
    turtleState: cleanTurtle,
    runtime: state.runtime ? JSON.parse(JSON.stringify(state.runtime)) : null,
    activeScope: state.activeScope,
    selectedBlockId: state.selectedBlockId,
    speed: state.speed,
    editorTool: state.editorTool,
    isSubpaletteCollapsed: state.isSubpaletteCollapsed,
    isMapHidden: state.isMapHidden,
    isFunctionBarOpen: state.isFunctionBarOpen,
    past: (state.past || []).slice(-MAX_PERSISTED_HISTORY),
    future: (state.future || []).slice(-MAX_PERSISTED_HISTORY),
  };

  try {
    const serialized = JSON.stringify(payload);
    const sOk = writeSession(PENDING_UPDATE_STORAGE_KEY, serialized);
    const lOk = writeLocal(PENDING_UPDATE_STORAGE_KEY, serialized);
    if (sOk || lOk) return true;
  } catch {
    // Fall through to compact retry without undo/redo history
  }

  try {
    const compactPayload: PersistedUpdatePayload = {
      ...payload,
      past: [],
      future: [],
    };
    const serialized = JSON.stringify(compactPayload);
    const sOk = writeSession(PENDING_UPDATE_STORAGE_KEY, serialized);
    const lOk = writeLocal(PENDING_UPDATE_STORAGE_KEY, serialized);
    return sOk || lOk;
  } catch {
    return false;
  }
}

/**
 * Consumes (reads and immediately clears) a pending post-update snapshot if valid and unexpired.
 */
export function consumeRestoredStateAfterUpdate(
  fallbackGrid: GridState,
  now: number = Date.now()
): AppUpdateStateInput | null {
  const raw = readSession(PENDING_UPDATE_STORAGE_KEY) ?? readLocal(PENDING_UPDATE_STORAGE_KEY);
  clearPendingUpdateState();

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    if (typeof parsed.expiresAt === 'number' && parsed.expiresAt < now) {
      return null;
    }

    const activeSimId: 'grid' | 'turtle' = parsed.activeSimId === 'turtle' ? 'turtle' : 'grid';
    const currentLevel =
      typeof parsed.currentLevel === 'number' && Number.isInteger(parsed.currentLevel) && parsed.currentLevel >= 1
        ? parsed.currentLevel
        : 1;

    const workspace = sanitizeWorkspace(parsed.workspace);
    const savedWorkspaces: Record<string, WorkspaceState> = {};
    if (parsed.savedWorkspaces && typeof parsed.savedWorkspaces === 'object') {
      for (const [key, ws] of Object.entries(parsed.savedWorkspaces)) {
        savedWorkspaces[key] = sanitizeWorkspace(ws);
      }
    }

    const grid = sanitizeGridState(parsed.grid, fallbackGrid);
    const turtleState = sanitizeTurtleState(parsed.turtleState);
    const runtime = sanitizeRuntime(parsed.runtime);
    const activeScope: ScopeType = VALID_SCOPES.includes(parsed.activeScope) ? parsed.activeScope : 'MAIN';
    const selectedBlockId = typeof parsed.selectedBlockId === 'string' ? parsed.selectedBlockId : null;
    const speed = sanitizeSpeed(parsed.speed);
    const editorTool: EditorTool = VALID_TOOLS.includes(parsed.editorTool) ? parsed.editorTool : 'NONE';

    return {
      activeSimId,
      currentLevel,
      workspace,
      savedWorkspaces,
      grid,
      turtleState,
      runtime,
      activeScope,
      selectedBlockId,
      speed,
      editorTool,
      isSubpaletteCollapsed: Boolean(parsed.isSubpaletteCollapsed),
      isMapHidden: Boolean(parsed.isMapHidden),
      isFunctionBarOpen: Boolean(parsed.isFunctionBarOpen),
      past: sanitizeHistoryList(parsed.past, fallbackGrid),
      future: sanitizeHistoryList(parsed.future, fallbackGrid),
    };
  } catch {
    return null;
  }
}
