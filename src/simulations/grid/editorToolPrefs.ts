import { useSyncExternalStore } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { cloneWorldItems, resetGridInteractiveState } from '../../engine/physics';

export interface GridEditorPrefsState {
  editorDialValue: number; // 1..20
  dialBrushExplicit: boolean;
  editorStackCount: number; // 2..10
  stackBrushExplicit: boolean;
}

const DEFAULT_PREFS: GridEditorPrefsState = {
  editorDialValue: 1,
  dialBrushExplicit: false,
  editorStackCount: 3,
  stackBrushExplicit: false,
};

let prefsState: GridEditorPrefsState = { ...DEFAULT_PREFS };
const listeners = new Set<() => void>();

function emitChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function clampDialEditorValue(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(20, Math.trunc(value)));
}

export function clampStackEditorCount(count: number): number {
  if (!Number.isFinite(count)) return 3;
  return Math.max(2, Math.min(10, Math.trunc(count)));
}

export function getGridEditorPrefs(): GridEditorPrefsState {
  return prefsState;
}

export function setEditorDialValue(value: number, explicit = true): void {
  const next = clampDialEditorValue(value);
  if (prefsState.editorDialValue === next && prefsState.dialBrushExplicit === explicit) {
    return;
  }
  prefsState = {
    ...prefsState,
    editorDialValue: next,
    dialBrushExplicit: explicit,
  };
  emitChange();
}

export function setEditorStackCount(count: number, explicit = true): void {
  const next = clampStackEditorCount(count);
  if (prefsState.editorStackCount === next && prefsState.stackBrushExplicit === explicit) {
    return;
  }
  prefsState = {
    ...prefsState,
    editorStackCount: next,
    stackBrushExplicit: explicit,
  };
  emitChange();
}

export function resetGridEditorPrefs(): void {
  prefsState = { ...DEFAULT_PREFS };
  emitChange();
}

function subscribePrefs(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useGridEditorPrefs(): GridEditorPrefsState {
  return useSyncExternalStore(subscribePrefs, getGridEditorPrefs, getGridEditorPrefs);
}

/**
 * Applies a Sandbox Floor Dial placement/update/cycle at `(x, y)` supporting full `1..20` values
 * while preserving single-step Undo/Redo history in `useAppStore`.
 */
export function applySandboxDialCell(x: number, y: number): void {
  const store = useAppStore.getState();
  if (store.appMode === 'curriculum') return;
  const prevGrid = store.grid;
  if (x < 0 || x >= prevGrid.width || y < 0 || y >= prevGrid.height) return;

  const { editorDialValue, dialBrushExplicit } = prefsState;
  const nextDials = prevGrid.dialTiles ? prevGrid.dialTiles.map((d) => ({ ...d })) : [];
  const existingIdx = nextDials.findIndex((d) => d.x === x && d.y === y);

  if (existingIdx >= 0) {
    const curVal = nextDials[existingIdx].value;
    if (dialBrushExplicit) {
      if (curVal !== editorDialValue) {
        nextDials[existingIdx] = { x, y, value: editorDialValue };
      } else {
        nextDials.splice(existingIdx, 1);
      }
    } else if (curVal < 20) {
      nextDials[existingIdx] = { x, y, value: curVal + 1 };
    } else {
      nextDials.splice(existingIdx, 1);
    }
  } else {
    nextDials.push({ x, y, value: editorDialValue });
  }

  store.startHistoryBatch('Edit floor dial');
  store.setCellContent(x, y);
  useAppStore.setState({
    grid: resetGridInteractiveState({
      ...prevGrid,
      dialTiles: nextDials,
    }),
    isPlaying: false,
    runtime: null,
  });
  store.endHistoryBatch();
}

/**
 * Applies a Sandbox Stack Depot (`×N`, `2..10`) placement/update/cycle at `(x, y)`
 * while preserving single-step Undo/Redo history in `useAppStore`.
 */
export function applySandboxStackCell(x: number, y: number): void {
  const store = useAppStore.getState();
  if (store.appMode === 'curriculum') return;
  const prevGrid = store.grid;
  if (x < 0 || x >= prevGrid.width || y < 0 || y >= prevGrid.height) return;

  const { editorStackCount, stackBrushExplicit } = prefsState;
  const nextItems = cloneWorldItems(prevGrid.initialWorldItems ?? prevGrid.worldItems ?? []);
  const existingIdx = nextItems.findIndex((it) => it.x === x && it.y === y);

  if (existingIdx >= 0 && (nextItems[existingIdx].count ?? 1) > 1) {
    const curCount = nextItems[existingIdx].count ?? 2;
    if (stackBrushExplicit) {
      if (curCount !== editorStackCount) {
        nextItems[existingIdx] = { ...nextItems[existingIdx], count: editorStackCount };
      } else {
        nextItems.splice(existingIdx, 1);
      }
    } else if (curCount < 10) {
      nextItems[existingIdx] = { ...nextItems[existingIdx], count: curCount + 1 };
    } else {
      nextItems.splice(existingIdx, 1);
    }
  } else {
    if (existingIdx >= 0) {
      nextItems.splice(existingIdx, 1);
    }
    nextItems.push({
      id: `stack_depot_${Date.now()}_${x}_${y}`,
      type: 'crate',
      x,
      y,
      count: editorStackCount,
    });
  }

  store.startHistoryBatch('Edit stack depot');
  store.setCellContent(x, y);
  useAppStore.setState({
    grid: resetGridInteractiveState({
      ...prevGrid,
      worldItems: cloneWorldItems(nextItems),
      initialWorldItems: cloneWorldItems(nextItems),
    }),
    isPlaying: false,
    runtime: null,
  });
  store.endHistoryBatch();
}
