import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useAppStore } from '../src/store/useAppStore';
import {
  clearPendingUpdateState,
  consumeRestoredStateAfterUpdate,
  saveStateBeforeUpdate,
  UPDATE_SNAPSHOT_TTL_MS,
} from '../src/services/pwaStateRestoreService';
import {
  DEFAULT_UPDATE_CHECK_INTERVAL_MS,
  initPwaUpdateManager,
  checkForAppUpdate,
  applyAppUpdate,
  dismissUpdatePrompt,
  reopenUpdatePrompt,
  resetPwaUpdateManagerForTests,
  usePwaUpdateStore,
} from '../src/services/pwaUpdateManager';
import { createDefaultGridState } from '../src/simulations/grid/gridEnvironment';
import { toVariableName } from '../src/types';

function readPngDimensions(filePath: string): { width: number; height: number } {
  const buf = fs.readFileSync(filePath);
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < signature.length; i++) {
    expect(buf[i]).toBe(signature[i]);
  }
  const chunkType = buf.subarray(12, 16).toString('ascii');
  expect(chunkType).toBe('IHDR');
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

function resetStoreToFresh() {
  const store = useAppStore.getState();
  store.pause();
  store.setSimEnvironment('grid');
  store.setLevel(1);
  store.clearWorkspace();
  store.clearHistory();
  store.setSpeed(400);
  store.setEditorTool('NONE');
  store.setMapHidden(false);
  store.setSubpaletteCollapsed(false);
  store.setFunctionBarOpen(false);
  store.dismissRestoredNotice();
  useAppStore.setState({ savedWorkspaces: {} });
}

describe('PWA Installability Assets, Periodic Update Check & State Restoration', () => {
  beforeEach(() => {
    clearPendingUpdateState();
    resetPwaUpdateManagerForTests();
    resetStoreToFresh();
    vi.useFakeTimers();
  });

  afterEach(() => {
    resetPwaUpdateManagerForTests();
    clearPendingUpdateState();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('1. PWA Manifest Icon Assets', () => {
    const publicDir = path.resolve(__dirname, '../public');

    it('provides valid PNG icons with exact manifest dimensions', () => {
      expect(readPngDimensions(path.join(publicDir, 'pwa-192x192.png'))).toEqual({
        width: 192,
        height: 192,
      });
      expect(readPngDimensions(path.join(publicDir, 'pwa-512x512.png'))).toEqual({
        width: 512,
        height: 512,
      });
      expect(readPngDimensions(path.join(publicDir, 'pwa-maskable-512x512.png'))).toEqual({
        width: 512,
        height: 512,
      });
      expect(readPngDimensions(path.join(publicDir, 'apple-touch-icon.png'))).toEqual({
        width: 180,
        height: 180,
      });
    });
  });

  describe('2. Pre-Update State Capture & Post-Update Restoration', () => {
    it('captures and restores Grid workspace, custom map edits, saved Turtle code, UI flags, and undo history', () => {
      const store = useAppStore.getState();

      // Add code in Turtle mode first so savedWorkspaces['turtle'] is populated
      store.setSimEnvironment('turtle');
      useAppStore.getState().addBlock('MAIN', 'MOVE_FWD', 2, undefined, { distance: 50 });

      // Switch back to Grid mode, pick level 3, customize board & write code in MAIN and F1
      useAppStore.getState().setSimEnvironment('grid');
      useAppStore.getState().setLevel(3);
      useAppStore.getState().resizeBoard('RIGHT', 2);
      useAppStore.getState().toggleWall({ orientation: 'V', x: 2, y: 1 });
      useAppStore.getState().addBlock('MAIN', 'MOVE_FWD', 4);
      useAppStore.getState().addBlock('MAIN', 'CALL_F1');
      useAppStore.getState().setActiveScope('F1');
      useAppStore.getState().addBlock('F1', 'TURN_LEFT');
      useAppStore.getState().setMapHidden(true);
      useAppStore.getState().setFunctionBarOpen(true);
      useAppStore.getState().setSpeed(100);

      const snapshotBefore = useAppStore.getState();
      const expectedGridWidth = snapshotBefore.grid.width;
      const expectedMainLen = snapshotBefore.workspace.MAIN.length;
      const expectedF1Len = snapshotBefore.workspace.F1.length;
      const expectedSelectedBlock = snapshotBefore.selectedBlockId;

      // Capture state for update
      expect(useAppStore.getState().prepareStateForUpdate()).toBe(true);

      // Simulate page reload wiping in-memory store back to defaults
      resetStoreToFresh();
      expect(useAppStore.getState().currentLevel).toBe(1);
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(0);

      // Hydrate from update snapshot
      expect(useAppStore.getState().hydrateFromUpdateIfPresent()).toBe(true);

      const after = useAppStore.getState();
      expect(after.wasRestoredAfterUpdate).toBe(true);
      expect(after.activeSimId).toBe('grid');
      expect(after.currentLevel).toBe(3);
      expect(after.grid.width).toBe(expectedGridWidth);
      expect(after.grid.barriers).toContainEqual({ orientation: 'V', x: 2, y: 1 });
      expect(after.workspace.MAIN).toHaveLength(expectedMainLen);
      expect(after.workspace.MAIN[0].repeatCount).toBe(4);
      expect(after.workspace.F1).toHaveLength(expectedF1Len);
      expect(after.savedWorkspaces.turtle?.MAIN).toHaveLength(1);
      expect(after.activeScope).toBe('F1');
      expect(after.selectedBlockId).toBe(expectedSelectedBlock);
      expect(after.isMapHidden).toBe(true);
      expect(after.isFunctionBarOpen).toBe(true);
      expect(after.speed).toBe(100);
      expect(after.canUndo).toBe(true);

      // One-shot: subsequent normal reload must NOT re-hydrate consumed state
      resetStoreToFresh();
      expect(useAppStore.getState().hydrateFromUpdateIfPresent()).toBe(false);
      expect(useAppStore.getState().wasRestoredAfterUpdate).toBe(false);
    });

    it('restores Turtle drawing paths, viewport pan/zoom, and instant mode execution', () => {
      const store = useAppStore.getState();
      store.setSimEnvironment('turtle');
      useAppStore.getState().setSpeed('instant');
      useAppStore.getState().addBlock('MAIN', 'MOVE_FWD', 3, undefined, { distance: 40 });
      useAppStore.getState().addBlock('MAIN', 'TURN_RIGHT', 1, undefined, { angle: 90 });
      useAppStore.getState().addBlock('MAIN', 'MOVE_FWD', 2, undefined, { distance: 40 });
      useAppStore.getState().updateTurtleViewport({ pan: { x: 120, y: -45 }, zoom: 1.5, fitToView: false });

      const pathsBefore = useAppStore.getState().turtleState.paths.length;
      expect(pathsBefore).toBeGreaterThan(0);

      expect(useAppStore.getState().prepareStateForUpdate()).toBe(true);

      resetStoreToFresh();
      expect(useAppStore.getState().activeSimId).toBe('grid');

      expect(useAppStore.getState().hydrateFromUpdateIfPresent()).toBe(true);
      const after = useAppStore.getState();
      expect(after.activeSimId).toBe('turtle');
      expect(after.speed).toBe('instant');
      expect(after.turtleState.paths.length).toBe(pathsBefore);
      expect(after.turtleState.pan).toEqual({ x: 120, y: -45 });
      expect(after.turtleState.zoom).toBe(1.5);
    });

    it('preserves mid-execution stepped runtime variables across update', () => {
      useAppStore.getState().addBlock('MAIN', 'VAR_ASSIGN', undefined, undefined, {
        a: toVariableName('x'),
        b: 7,
      });
      useAppStore.getState().addBlock('MAIN', 'MOVE_FWD', 1);
      useAppStore.getState().step();

      expect(useAppStore.getState().runtime?.variables[toVariableName('x')]).toBe(7);

      expect(useAppStore.getState().prepareStateForUpdate()).toBe(true);
      resetStoreToFresh();
      expect(useAppStore.getState().hydrateFromUpdateIfPresent()).toBe(true);

      expect(useAppStore.getState().runtime?.variables[toVariableName('x')]).toBe(7);
    });

    it('ignores expired update snapshots beyond TTL', () => {
      const defaultGrid = createDefaultGridState();
      const s = useAppStore.getState();
      const t0 = 1_000_000;
      saveStateBeforeUpdate(
        {
          activeSimId: 'grid',
          currentLevel: 4,
          workspace: s.workspace,
          savedWorkspaces: s.savedWorkspaces,
          grid: s.grid,
          turtleState: s.turtleState,
          runtime: null,
          activeScope: 'MAIN',
          selectedBlockId: null,
          speed: 400,
          editorTool: 'NONE',
          isSubpaletteCollapsed: false,
          isMapHidden: false,
          isFunctionBarOpen: false,
          past: [],
          future: [],
        },
        t0
      );

      const expired = consumeRestoredStateAfterUpdate(
        defaultGrid,
        t0 + UPDATE_SNAPSHOT_TTL_MS + 1000
      );
      expect(expired).toBeNull();
    });
  });

  describe('3. Periodic PWA Update Manager', () => {
    it('uses a 3-hour default check interval', () => {
      expect(DEFAULT_UPDATE_CHECK_INTERVAL_MS).toBe(3 * 60 * 60 * 1000);
    });

    it('checks for updates every few hours with cache: no-store and proposes update when waiting', async () => {
      let currentNow = 1_000_000;
      let capturedOptions: any = null;
      const updateMock = vi.fn().mockResolvedValue(undefined);
      const mockRegistration: any = {
        installing: null,
        waiting: null,
        update: updateMock,
      };

      const updateSWMock = vi.fn().mockResolvedValue(undefined);
      const fetchMock = vi.fn().mockResolvedValue({ status: 200 });
      const reloadMock = vi.fn();

      await initPwaUpdateManager({
        checkIntervalMs: DEFAULT_UPDATE_CHECK_INTERVAL_MS,
        nowFn: () => currentNow,
        fetchFn: fetchMock as any,
        reloadFn: reloadMock,
        registerSWFn: (opts) => {
          capturedOptions = opts;
          opts?.onRegisteredSW?.('/Coding4Kids/sw.js', mockRegistration);
          return updateSWMock;
        },
      });

      expect(capturedOptions?.immediate).toBe(true);
      expect(usePwaUpdateStore.getState().needRefresh).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();

      // Advance 3 hours -> periodic check fires
      currentNow += DEFAULT_UPDATE_CHECK_INTERVAL_MS;
      await vi.advanceTimersByTimeAsync(DEFAULT_UPDATE_CHECK_INTERVAL_MS);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        '/Coding4Kids/sw.js',
        expect.objectContaining({ cache: 'no-store' })
      );
      expect(updateMock).toHaveBeenCalledTimes(1);

      // Simulate Workbox discovering a new SW and firing onNeedRefresh
      mockRegistration.waiting = { postMessage: vi.fn() };
      capturedOptions.onNeedRefresh?.();

      expect(usePwaUpdateStore.getState().needRefresh).toBe(true);
      expect(usePwaUpdateStore.getState().isPromptDismissed).toBe(false);

      // User clicks "Later" -> prompt dismissed, needRefresh stays true
      dismissUpdatePrompt();
      expect(usePwaUpdateStore.getState().isPromptDismissed).toBe(true);
      expect(usePwaUpdateStore.getState().needRefresh).toBe(true);

      // User can manually reopen prompt before next interval
      reopenUpdatePrompt();
      expect(usePwaUpdateStore.getState().isPromptDismissed).toBe(false);

      // Snooze again, then advance another 3 hours -> prompt automatically re-proposed!
      dismissUpdatePrompt();
      expect(usePwaUpdateStore.getState().isPromptDismissed).toBe(true);

      currentNow += DEFAULT_UPDATE_CHECK_INTERVAL_MS;
      await vi.advanceTimersByTimeAsync(DEFAULT_UPDATE_CHECK_INTERVAL_MS);

      expect(updateMock).toHaveBeenCalledTimes(2);
      expect(usePwaUpdateStore.getState().isPromptDismissed).toBe(false);
    });

    it('saves workspace state and triggers SW update + reload when applyAppUpdate is called', async () => {
      const updateSWMock = vi.fn().mockResolvedValue(undefined);
      const reloadMock = vi.fn();

      await initPwaUpdateManager({
        reloadFn: reloadMock,
        registerSWFn: (opts) => {
          opts?.onNeedRefresh?.();
          return updateSWMock;
        },
      });

      // Add user work before accepting update
      useAppStore.getState().setLevel(5);
      useAppStore.getState().addBlock('MAIN', 'MOVE_FWD', 3);

      await applyAppUpdate();
      await vi.advanceTimersByTimeAsync(1600);

      expect(updateSWMock).toHaveBeenCalledWith(true);
      expect(reloadMock).toHaveBeenCalledTimes(1);

      // Simulate reload into fresh app store and verify user state restores cleanly
      resetStoreToFresh();
      expect(useAppStore.getState().hydrateFromUpdateIfPresent()).toBe(true);
      expect(useAppStore.getState().currentLevel).toBe(5);
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(1);
      expect(useAppStore.getState().workspace.MAIN[0].repeatCount).toBe(3);
    });

    it('skips update check when sw.js returns non-200 or registration is currently installing', async () => {
      const updateMock = vi.fn().mockResolvedValue(undefined);
      const mockRegistration: any = {
        installing: { state: 'installing' },
        waiting: null,
        update: updateMock,
      };
      const fetchMock = vi.fn().mockResolvedValue({ status: 503 });

      await initPwaUpdateManager({
        fetchFn: fetchMock as any,
        registerSWFn: (opts) => {
          opts?.onRegisteredSW?.('/Coding4Kids/sw.js', mockRegistration);
          return vi.fn().mockResolvedValue(undefined);
        },
      });

      // While installing, checkForAppUpdate returns false without fetching
      expect(await checkForAppUpdate()).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();

      // When not installing, non-200 response skips registration.update()
      mockRegistration.installing = null;
      expect(await checkForAppUpdate()).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(updateMock).not.toHaveBeenCalled();
    });
  });
});
