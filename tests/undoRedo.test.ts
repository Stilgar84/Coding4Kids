import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useAppStore } from '../src/store/useAppStore';

describe('Unified Undo/Redo System', () => {
  beforeEach(() => {
    const store = useAppStore.getState();
    store.setSimEnvironment('grid');
    store.setLevel(1);
    store.reset();
    store.clearWorkspace();
    store.setSpeed(400);
    store.clearHistory();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Code Edits Undo / Redo', () => {
    it('handles addBlock: adding a block pushes history, undo removes it, redo restores it', () => {
      const store = useAppStore.getState();
      expect(store.canUndo).toBe(false);
      expect(store.canRedo).toBe(false);

      store.addBlock('MAIN', 'MOVE_FWD');
      expect(useAppStore.getState().workspace.MAIN.length).toBe(1);
      expect(useAppStore.getState().canUndo).toBe(true);
      expect(useAppStore.getState().canRedo).toBe(false);

      useAppStore.getState().undo();
      expect(useAppStore.getState().workspace.MAIN.length).toBe(0);
      expect(useAppStore.getState().canUndo).toBe(false);
      expect(useAppStore.getState().canRedo).toBe(true);

      useAppStore.getState().redo();
      expect(useAppStore.getState().workspace.MAIN.length).toBe(1);
      expect(useAppStore.getState().workspace.MAIN[0].type).toBe('MOVE_FWD');
      expect(useAppStore.getState().canUndo).toBe(true);
      expect(useAppStore.getState().canRedo).toBe(false);
    });

    it('handles removeBlock: removing a block can be undone (restoring block and position) and redone', () => {
      const store = useAppStore.getState();
      store.addBlock('MAIN', 'MOVE_FWD');
      store.addBlock('MAIN', 'TURN_LEFT');
      store.addBlock('MAIN', 'MOVE_FWD');

      const blockToRemove = useAppStore.getState().workspace.MAIN[1];
      expect(blockToRemove.type).toBe('TURN_LEFT');

      useAppStore.getState().removeBlock('MAIN', blockToRemove.id);
      expect(useAppStore.getState().workspace.MAIN.length).toBe(2);
      expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual(['MOVE_FWD', 'MOVE_FWD']);

      // Undo removal
      useAppStore.getState().undo();
      expect(useAppStore.getState().workspace.MAIN.length).toBe(3);
      expect(useAppStore.getState().workspace.MAIN[1].id).toBe(blockToRemove.id);
      expect(useAppStore.getState().workspace.MAIN[1].type).toBe('TURN_LEFT');

      // Redo removal
      useAppStore.getState().redo();
      expect(useAppStore.getState().workspace.MAIN.length).toBe(2);
      expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual(['MOVE_FWD', 'MOVE_FWD']);
    });

    it('handles updateBlockRepeat: changing multiplier can be undone and redone', () => {
      const store = useAppStore.getState();
      store.addBlock('MAIN', 'MOVE_FWD', 1);
      const blockId = useAppStore.getState().workspace.MAIN[0].id;

      useAppStore.getState().updateBlockRepeat('MAIN', blockId, 4);
      expect(useAppStore.getState().workspace.MAIN[0].repeatCount).toBe(4);

      useAppStore.getState().undo();
      expect(useAppStore.getState().workspace.MAIN[0].repeatCount).toBe(1);

      useAppStore.getState().redo();
      expect(useAppStore.getState().workspace.MAIN[0].repeatCount).toBe(4);
    });

    it('handles updateBlockParams: changing action parameters can be undone and redone', () => {
      const store = useAppStore.getState();
      store.addBlock('MAIN', 'CUSTOM_ACTION', 1, undefined, { speed: 10, angle: 90 });
      const blockId = useAppStore.getState().workspace.MAIN[0].id;

      useAppStore.getState().updateBlockParams('MAIN', blockId, { speed: 50 });
      expect(useAppStore.getState().workspace.MAIN[0].params?.speed).toBe(50);
      expect(useAppStore.getState().workspace.MAIN[0].params?.angle).toBe(90);

      useAppStore.getState().undo();
      expect(useAppStore.getState().workspace.MAIN[0].params?.speed).toBe(10);

      useAppStore.getState().redo();
      expect(useAppStore.getState().workspace.MAIN[0].params?.speed).toBe(50);
    });

    it('handles reorderBlocks: moving block from index 0 to 2 can be undone and redone', () => {
      const store = useAppStore.getState();
      store.addBlock('MAIN', 'MOVE_FWD'); // 0
      store.addBlock('MAIN', 'TURN_LEFT'); // 1
      store.addBlock('MAIN', 'TURN_RIGHT'); // 2

      useAppStore.getState().reorderBlocks('MAIN', 0, 2);
      expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual([
        'TURN_LEFT',
        'TURN_RIGHT',
        'MOVE_FWD',
      ]);

      useAppStore.getState().undo();
      expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual([
        'MOVE_FWD',
        'TURN_LEFT',
        'TURN_RIGHT',
      ]);

      useAppStore.getState().redo();
      expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual([
        'TURN_LEFT',
        'TURN_RIGHT',
        'MOVE_FWD',
      ]);
    });

    it('handles clearWorkspace: clearing workspace can be undone, restoring all scopes', () => {
      const store = useAppStore.getState();
      store.addBlock('MAIN', 'MOVE_FWD');
      store.addBlock('F1', 'TURN_LEFT');
      store.addBlock('F2', 'TURN_RIGHT');

      useAppStore.getState().clearWorkspace();
      expect(useAppStore.getState().workspace.MAIN.length).toBe(0);
      expect(useAppStore.getState().workspace.F1.length).toBe(0);
      expect(useAppStore.getState().workspace.F2.length).toBe(0);

      useAppStore.getState().undo();
      expect(useAppStore.getState().workspace.MAIN.length).toBe(1);
      expect(useAppStore.getState().workspace.F1.length).toBe(1);
      expect(useAppStore.getState().workspace.F2.length).toBe(1);

      useAppStore.getState().redo();
      expect(useAppStore.getState().workspace.MAIN.length).toBe(0);
      expect(useAppStore.getState().workspace.F1.length).toBe(0);
      expect(useAppStore.getState().workspace.F2.length).toBe(0);
    });

    it('handles loadSolution: loading lesson solution can be undone, restoring previous code', () => {
      const store = useAppStore.getState();
      store.addBlock('MAIN', 'TURN_RIGHT');
      expect(useAppStore.getState().workspace.MAIN.length).toBe(1);
      expect(useAppStore.getState().workspace.MAIN[0].type).toBe('TURN_RIGHT');

      useAppStore.getState().loadSolution(1);
      expect(useAppStore.getState().workspace.MAIN.length).toBeGreaterThan(1);

      useAppStore.getState().undo();
      expect(useAppStore.getState().workspace.MAIN.length).toBe(1);
      expect(useAppStore.getState().workspace.MAIN[0].type).toBe('TURN_RIGHT');

      useAppStore.getState().redo();
      expect(useAppStore.getState().workspace.MAIN.length).toBeGreaterThan(1);
    });

    it('handles importCode: importing program can be undone and redone', () => {
      const store = useAppStore.getState();
      store.addBlock('MAIN', 'TURN_LEFT');
      const exported = store.exportCode(false);

      store.clearWorkspace();
      expect(useAppStore.getState().workspace.MAIN.length).toBe(0);

      const res = useAppStore.getState().importCode(exported);
      expect(res.success).toBe(true);
      expect(useAppStore.getState().workspace.MAIN.length).toBe(1);

      useAppStore.getState().undo();
      expect(useAppStore.getState().workspace.MAIN.length).toBe(0);

      useAppStore.getState().redo();
      expect(useAppStore.getState().workspace.MAIN.length).toBe(1);
    });
  });

  describe('2. Map Edits Undo / Redo', () => {
    it('handles toggleWall: toggling a wall on and off can be undone and redone', () => {
      const edge = { orientation: 'V' as const, x: 2, y: 1 };
      const initialBarriersCount = useAppStore.getState().grid.barriers.length;

      useAppStore.getState().toggleWall(edge);
      expect(useAppStore.getState().grid.barriers.length).toBe(initialBarriersCount + 1);

      useAppStore.getState().undo();
      expect(useAppStore.getState().grid.barriers.length).toBe(initialBarriersCount);

      useAppStore.getState().redo();
      expect(useAppStore.getState().grid.barriers.length).toBe(initialBarriersCount + 1);
    });

    it('batches wall drawing: startHistoryBatch with multiple addWall calls compresses into a single undo step', () => {
      const store = useAppStore.getState();
      const initialCount = store.grid.barriers.length;

      store.startHistoryBatch('Draw walls');
      store.addWall({ orientation: 'V', x: 1, y: 1 });
      store.addWall({ orientation: 'V', x: 2, y: 1 });
      store.addWall({ orientation: 'H', x: 1, y: 2 });
      store.addWall({ orientation: 'H', x: 2, y: 2 });
      store.endHistoryBatch();

      expect(useAppStore.getState().grid.barriers.length).toBe(initialCount + 4);
      expect(useAppStore.getState().canUndo).toBe(true);

      // A single undo removes all 4 walls at once
      useAppStore.getState().undo();
      expect(useAppStore.getState().grid.barriers.length).toBe(initialCount);

      // Redo restores all 4 walls
      useAppStore.getState().redo();
      expect(useAppStore.getState().grid.barriers.length).toBe(initialCount + 4);
    });

    it('discards history batch if no actual change occurred', () => {
      const store = useAppStore.getState();
      expect(store.canUndo).toBe(false);

      store.startHistoryBatch('Empty batch');
      store.endHistoryBatch();

      expect(useAppStore.getState().canUndo).toBe(false);
      expect(useAppStore.getState().past.length).toBe(0);
    });

    it('handles setCellContent: robot repositioning, flags, goals, and erase', () => {
      const store = useAppStore.getState();
      const initialRobot = { ...store.grid.robot };

      // Robot placement
      store.setEditorTool('ROBOT');
      store.setCellContent(3, 4);
      expect(useAppStore.getState().grid.robot.x).toBe(3);
      expect(useAppStore.getState().grid.robot.y).toBe(4);

      useAppStore.getState().undo();
      expect(useAppStore.getState().grid.robot.x).toBe(initialRobot.initialX);
      expect(useAppStore.getState().grid.robot.y).toBe(initialRobot.initialY);

      useAppStore.getState().redo();
      expect(useAppStore.getState().grid.robot.x).toBe(3);
      expect(useAppStore.getState().grid.robot.y).toBe(4);

      // Flag placement
      useAppStore.getState().setEditorTool('FLAG');
      useAppStore.getState().setCellContent(2, 2);
      expect(useAppStore.getState().grid.flags.some((f) => f.x === 2 && f.y === 2 && !f.isGoal)).toBe(true);

      useAppStore.getState().undo();
      expect(useAppStore.getState().grid.flags.some((f) => f.x === 2 && f.y === 2)).toBe(false);

      useAppStore.getState().redo();
      expect(useAppStore.getState().grid.flags.some((f) => f.x === 2 && f.y === 2 && !f.isGoal)).toBe(true);

      // Goal placement
      useAppStore.getState().setEditorTool('GOAL');
      useAppStore.getState().setCellContent(4, 4);
      expect(useAppStore.getState().grid.flags.some((f) => f.x === 4 && f.y === 4 && f.isGoal)).toBe(true);

      useAppStore.getState().undo();
      expect(useAppStore.getState().grid.flags.some((f) => f.x === 4 && f.y === 4 && f.isGoal)).toBe(false);

      useAppStore.getState().redo();
      expect(useAppStore.getState().grid.flags.some((f) => f.x === 4 && f.y === 4 && f.isGoal)).toBe(true);

      // Erase tool
      useAppStore.getState().setEditorTool('ERASE');
      useAppStore.getState().setCellContent(4, 4);
      expect(useAppStore.getState().grid.flags.some((f) => f.x === 4 && f.y === 4)).toBe(false);

      useAppStore.getState().undo();
      expect(useAppStore.getState().grid.flags.some((f) => f.x === 4 && f.y === 4 && f.isGoal)).toBe(true);
    });

    it('handles resizeBoard discrete and drag batches', () => {
      const store = useAppStore.getState();
      const initialWidth = store.grid.width;
      const initialHeight = store.grid.height;

      // Discrete resize
      store.resizeBoard('RIGHT', 1);
      expect(useAppStore.getState().grid.width).toBe(initialWidth + 1);

      useAppStore.getState().undo();
      expect(useAppStore.getState().grid.width).toBe(initialWidth);

      useAppStore.getState().redo();
      expect(useAppStore.getState().grid.width).toBe(initialWidth + 1);

      // Batch resize (simulate dragging resize handle)
      useAppStore.getState().startHistoryBatch('Resize board');
      useAppStore.getState().resizeBoard('BOTTOM', 1);
      useAppStore.getState().resizeBoard('BOTTOM', 1);
      useAppStore.getState().resizeBoard('BOTTOM', 1);
      useAppStore.getState().endHistoryBatch();

      expect(useAppStore.getState().grid.height).toBe(initialHeight + 3);

      // Single undo restores pre-drag height
      useAppStore.getState().undo();
      expect(useAppStore.getState().grid.height).toBe(initialHeight);

      // Redo restores full dragged height
      useAppStore.getState().redo();
      expect(useAppStore.getState().grid.height).toBe(initialHeight + 3);
    });

    it('handles clearGridUserCustoms undo and redo', () => {
      const store = useAppStore.getState();
      store.toggleWall({ orientation: 'V', x: 2, y: 1 });
      const customBarriersCount = useAppStore.getState().grid.barriers.length;

      useAppStore.getState().clearGridUserCustoms();
      expect(useAppStore.getState().grid.barriers.length).toBeLessThan(customBarriersCount);

      useAppStore.getState().undo();
      expect(useAppStore.getState().grid.barriers.length).toBe(customBarriersCount);

      useAppStore.getState().redo();
      expect(useAppStore.getState().grid.barriers.length).toBeLessThan(customBarriersCount);
    });
  });

  describe('3. History Stack Invariants and Edge Cases', () => {
    it('discards future redo stack when new mutations are performed', () => {
      const store = useAppStore.getState();
      store.addBlock('MAIN', 'MOVE_FWD');
      store.addBlock('MAIN', 'TURN_LEFT');

      store.undo(); // back to 1 block
      expect(useAppStore.getState().canRedo).toBe(true);

      // Perform a new mutation
      useAppStore.getState().addBlock('MAIN', 'TURN_RIGHT');
      expect(useAppStore.getState().canRedo).toBe(false);
      expect(useAppStore.getState().future.length).toBe(0);
      expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual([
        'MOVE_FWD',
        'TURN_RIGHT',
      ]);
    });

    it('caps past history at MAX_HISTORY = 100 entries', () => {
      const store = useAppStore.getState();
      for (let i = 0; i < 110; i++) {
        useAppStore.getState().addBlock('MAIN', 'MOVE_FWD');
      }

      expect(useAppStore.getState().past.length).toBe(100);
      expect(useAppStore.getState().workspace.MAIN.length).toBe(110);
    });

    it('properly restores activeScope when undoing an edit made in another scope', () => {
      const store = useAppStore.getState();

      // In F1, add a block
      store.setActiveScope('F1');
      store.addBlock('F1', 'TURN_LEFT');
      expect(useAppStore.getState().activeScope).toBe('F1');

      // Switch to MAIN
      useAppStore.getState().setActiveScope('MAIN');
      expect(useAppStore.getState().activeScope).toBe('MAIN');

      // Undo the F1 block
      useAppStore.getState().undo();
      // Should automatically focus back to F1 tab
      expect(useAppStore.getState().activeScope).toBe('F1');
      expect(useAppStore.getState().workspace.F1.length).toBe(0);

      // Redo the F1 block
      useAppStore.getState().redo();
      expect(useAppStore.getState().activeScope).toBe('F1');
      expect(useAppStore.getState().workspace.F1.length).toBe(1);
    });

    it('resets history on level change or environment switch', () => {
      const store = useAppStore.getState();
      store.addBlock('MAIN', 'MOVE_FWD');
      expect(useAppStore.getState().canUndo).toBe(true);

      useAppStore.getState().setLevel(2);
      expect(useAppStore.getState().canUndo).toBe(false);
      expect(useAppStore.getState().canRedo).toBe(false);

      useAppStore.getState().addBlock('MAIN', 'MOVE_FWD');
      expect(useAppStore.getState().canUndo).toBe(true);

      useAppStore.getState().setSimEnvironment('turtle');
      expect(useAppStore.getState().canUndo).toBe(false);
      expect(useAppStore.getState().canRedo).toBe(false);
    });

    it('synchronizes cleanly with Instant Simulation mode', () => {
      const store = useAppStore.getState();
      store.setSpeed('instant');

      store.addBlock('MAIN', 'MOVE_FWD');
      // In level 1, robot starts at (0, 2) facing EAST. MOVE_FWD moves robot to (1, 2) instantly.
      expect(useAppStore.getState().grid.robot.x).toBe(1);
      expect(useAppStore.getState().grid.robot.y).toBe(2);

      useAppStore.getState().undo();
      // Instant sim re-evaluates empty workspace: robot back at (0, 2)
      expect(useAppStore.getState().grid.robot.x).toBe(0);
      expect(useAppStore.getState().grid.robot.y).toBe(2);

      useAppStore.getState().redo();
      // Instant sim re-evaluates MOVE_FWD: robot back at (1, 2)
      expect(useAppStore.getState().grid.robot.x).toBe(1);
      expect(useAppStore.getState().grid.robot.y).toBe(2);
    });
  });
});
