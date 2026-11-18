import type {
  CodeBlock,
  EventScopeType,
  InterpreterRuntimeState,
  ScopeType,
  WorkspaceState,
} from '../../types';
import { validateLoopStructure } from '../../engine/interpreter';
import type { AppMode, CurriculumActivity } from '../../data/curriculum';
import { computeAllowedDepotStationsAndGates } from '../../utils/curriculumStagePolicy';
import type { AppStateData } from '../types';

export const EVENT_SCOPE_KEYS: readonly EventScopeType[] = [
  'ON_TAP',
  'ON_KEY_UP',
  'ON_KEY_DOWN',
  'ON_KEY_LEFT',
  'ON_KEY_RIGHT',
  'ON_KEY_A',
  'ON_KEY_B',
];

export const ALL_CODE_SCOPES: readonly ScopeType[] = [
  'MAIN',
  'F1',
  'F2',
  'F3',
  ...EVENT_SCOPE_KEYS,
];

export const hasWorkspaceLoopError = (ws: WorkspaceState): boolean => {
  for (const sc of ALL_CODE_SCOPES) {
    const blocks = ws[sc];
    if (blocks && blocks.length > 0 && validateLoopStructure(blocks).hasError) {
      return true;
    }
  }
  return false;
};

export const hasWorkspaceAnyBlocks = (ws: WorkspaceState): boolean =>
  ALL_CODE_SCOPES.some((sc) => (ws[sc]?.length ?? 0) > 0);

export const createEmptyWorkspace = (): WorkspaceState => ({
  MAIN: [],
  F1: [],
  F2: [],
  F3: [],
});

const cloneScopeBlocks = (blocks?: CodeBlock[]): CodeBlock[] =>
  (blocks || []).map((b) => ({
    ...b,
    ...(b.params ? { params: JSON.parse(JSON.stringify(b.params)) } : {}),
  }));

const cloneScopeBlocksFresh = (blocks?: CodeBlock[]): CodeBlock[] =>
  (blocks || []).map((b) => ({
    ...b,
    id: `${b.type}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    ...(b.params ? { params: JSON.parse(JSON.stringify(b.params)) } : {}),
  }));

export const cloneWorkspace = (ws: WorkspaceState): WorkspaceState => {
  const out: WorkspaceState = {
    MAIN: cloneScopeBlocks(ws?.MAIN),
    F1: cloneScopeBlocks(ws?.F1),
    F2: cloneScopeBlocks(ws?.F2),
    F3: cloneScopeBlocks(ws?.F3),
  };
  for (const sc of EVENT_SCOPE_KEYS) {
    if (ws?.[sc]) {
      out[sc] = cloneScopeBlocks(ws[sc]);
    }
  }
  return out;
};

export const cloneWorkspaceWithFreshIds = (ws: WorkspaceState): WorkspaceState => {
  const out: WorkspaceState = {
    MAIN: cloneScopeBlocksFresh(ws?.MAIN),
    F1: cloneScopeBlocksFresh(ws?.F1),
    F2: cloneScopeBlocksFresh(ws?.F2),
    F3: cloneScopeBlocksFresh(ws?.F3),
  };
  for (const sc of EVENT_SCOPE_KEYS) {
    if (ws?.[sc]) {
      out[sc] = cloneScopeBlocksFresh(ws[sc]);
    }
  }
  return out;
};

/**
 * Resolves the active scope after a single interpreter tick, falling back to the
 * runtime's last executed block scope when the final tick empties `callStack`.
 */
export function resolveActiveScopeFromRuntime(
  runtime: InterpreterRuntimeState,
  fallbackScope: ScopeType
): ScopeType {
  if (runtime.callStack.length > 0) {
    return runtime.callStack[runtime.callStack.length - 1].scope;
  }
  return runtime.activeBlockId ? runtime.activeScope : fallbackScope;
}

export function resolveStagedDefaultSimParams(
  blockType: string,
  baseParams: Record<string, any> | undefined,
  appMode: AppMode,
  activeActivity: CurriculumActivity | undefined,
  activeDemoTabIndex: number
): Record<string, any> | undefined {
  if (!baseParams) return undefined;
  const next = { ...baseParams };
  if (appMode === 'curriculum' && activeActivity) {
    const { stations, gates } = computeAllowedDepotStationsAndGates(
      activeActivity,
      activeDemoTabIndex
    );
    if (blockType === 'DEPOT_MOVE_TO' && stations && stations.size > 0) {
      const currentStation = String(next.station ?? 'STACK_1');
      if (!stations.has(currentStation)) {
        next.station = Array.from(stations)[0];
      }
    }
    if (blockType === 'DEPOT_SEND_GATE' && gates && gates.size > 0) {
      const currentGate = String(next.gate ?? 'OUT');
      if (!gates.has(currentGate)) {
        next.gate = Array.from(gates)[0];
      }
    }
  }
  return next;
}

export const normalizeWorkspaceForCompare = (ws?: WorkspaceState) =>
  (['MAIN', 'F1', 'F2', 'F3'] as ScopeType[]).map((sc) =>
    (ws?.[sc] || []).map((b) => ({
      type: b.type,
      repeatCount: b.repeatCount ?? 1,
      params: b.params ?? null,
    }))
  );

export function buildWorkspaceCachePatch(
  state: Pick<
    AppStateData,
    'appMode' | 'curriculumWorkspaces' | 'activeActivityId' | 'savedWorkspaces' | 'activeSimId'
  >,
  nextWorkspace: WorkspaceState
):
  | { curriculumWorkspaces: Record<string, WorkspaceState> }
  | { savedWorkspaces: Record<string, WorkspaceState> } {
  if (state.appMode === 'curriculum') {
    return {
      curriculumWorkspaces: {
        ...state.curriculumWorkspaces,
        [state.activeActivityId]: cloneWorkspace(nextWorkspace),
      },
    };
  }
  return {
    savedWorkspaces: {
      ...state.savedWorkspaces,
      [state.activeSimId]: cloneWorkspace(nextWorkspace),
    },
  };
}
