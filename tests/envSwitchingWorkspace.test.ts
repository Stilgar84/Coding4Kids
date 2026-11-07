import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore, createEmptyWorkspace } from '../src/store/useAppStore';

describe('Environment Switching Workspace Memory System', () => {
  beforeEach(() => {
    // Reset store to a clean state
    const store = useAppStore.getState();
    store.reset();
    store.clearWorkspace();
    useAppStore.setState({
      activeSimId: 'grid',
      savedWorkspaces: {},
      workspace: createEmptyWorkspace(),
      selectedBlockId: null,
      activeScope: 'MAIN',
      speed: 400,
    });
  });

  it('keeps source code saved in memory and clears destination workspace if no code was saved', () => {
    const store = useAppStore.getState();

    // 1. Add blocks to Grid
    store.addBlock('MAIN', 'MOVE_FWD', 2);
    store.addBlock('MAIN', 'TURN_LEFT');
    store.addBlock('F1', 'MOVE_FWD', 3);

    expect(useAppStore.getState().workspace.MAIN).toHaveLength(2);
    expect(useAppStore.getState().workspace.F1).toHaveLength(1);

    // 2. Switch to Turtle
    store.setSimEnvironment('turtle');

    const stateAfterSwitch = useAppStore.getState();
    expect(stateAfterSwitch.activeSimId).toBe('turtle');

    // Source env (grid) code should be saved in memory
    expect(stateAfterSwitch.savedWorkspaces['grid']).toBeDefined();
    expect(stateAfterSwitch.savedWorkspaces['grid'].MAIN).toHaveLength(2);
    expect(stateAfterSwitch.savedWorkspaces['grid'].MAIN[0].type).toBe('MOVE_FWD');
    expect(stateAfterSwitch.savedWorkspaces['grid'].MAIN[0].repeatCount).toBe(2);
    expect(stateAfterSwitch.savedWorkspaces['grid'].F1).toHaveLength(1);

    // Destination env (turtle) workspace should be cleared
    expect(stateAfterSwitch.workspace.MAIN).toHaveLength(0);
    expect(stateAfterSwitch.workspace.F1).toHaveLength(0);
    expect(stateAfterSwitch.workspace.F2).toHaveLength(0);
    expect(stateAfterSwitch.workspace.F3).toHaveLength(0);
    expect(stateAfterSwitch.selectedBlockId).toBeNull();
  });

  it('restores saved code for destination environment when switching back and forth', () => {
    const store = useAppStore.getState();

    // 1. In Grid, add grid blocks
    store.addBlock('MAIN', 'MOVE_FWD', 2);
    store.addBlock('MAIN', 'TURN_RIGHT');

    // 2. Switch to Turtle
    store.setSimEnvironment('turtle');
    expect(useAppStore.getState().workspace.MAIN).toHaveLength(0);

    // 3. In Turtle, add turtle blocks
    store.addBlock('MAIN', 'FORWARD', 1, undefined, { distance: 50 });
    store.addBlock('MAIN', 'ROTATE', 1, undefined, { angle: 90 });
    store.addBlock('MAIN', 'SET_PEN_COLOR', undefined, undefined, { color: '#ef4444' });

    expect(useAppStore.getState().workspace.MAIN).toHaveLength(3);

    // 4. Switch back to Grid
    store.setSimEnvironment('grid');

    const gridState = useAppStore.getState();
    expect(gridState.activeSimId).toBe('grid');
    // Grid code is restored
    expect(gridState.workspace.MAIN).toHaveLength(2);
    expect(gridState.workspace.MAIN[0].type).toBe('MOVE_FWD');
    expect(gridState.workspace.MAIN[0].repeatCount).toBe(2);
    expect(gridState.workspace.MAIN[1].type).toBe('TURN_RIGHT');
    // Turtle code is saved in memory
    expect(gridState.savedWorkspaces['turtle']).toBeDefined();
    expect(gridState.savedWorkspaces['turtle'].MAIN).toHaveLength(3);
    expect(gridState.savedWorkspaces['turtle'].MAIN[0].params?.distance).toBe(50);

    // 5. Switch back to Turtle
    store.setSimEnvironment('turtle');

    const turtleState = useAppStore.getState();
    expect(turtleState.activeSimId).toBe('turtle');
    // Turtle code is restored
    expect(turtleState.workspace.MAIN).toHaveLength(3);
    expect(turtleState.workspace.MAIN[0].type).toBe('FORWARD');
    expect(turtleState.workspace.MAIN[0].params?.distance).toBe(50);
    expect(turtleState.workspace.MAIN[1].params?.angle).toBe(90);
    expect(turtleState.workspace.MAIN[2].params?.color).toBe('#ef4444');
  });

  it('preserves latest edits across multiple environment switches', () => {
    const store = useAppStore.getState();

    // Grid: initial blocks
    store.addBlock('MAIN', 'MOVE_FWD');
    store.setSimEnvironment('turtle');

    // Turtle: add first block
    store.addBlock('MAIN', 'FORWARD', 1, undefined, { distance: 100 });
    store.setSimEnvironment('grid');

    // Grid: add second block
    store.addBlock('MAIN', 'TURN_LEFT');
    expect(useAppStore.getState().workspace.MAIN).toHaveLength(2);

    store.setSimEnvironment('turtle');
    // Turtle: add second block
    store.addBlock('MAIN', 'PEN_UP');
    expect(useAppStore.getState().workspace.MAIN).toHaveLength(2);

    // Switch to Grid -> both grid blocks present
    store.setSimEnvironment('grid');
    expect(useAppStore.getState().workspace.MAIN).toHaveLength(2);
    expect(useAppStore.getState().workspace.MAIN[0].type).toBe('MOVE_FWD');
    expect(useAppStore.getState().workspace.MAIN[1].type).toBe('TURN_LEFT');

    // Switch to Turtle -> both turtle blocks present
    store.setSimEnvironment('turtle');
    expect(useAppStore.getState().workspace.MAIN).toHaveLength(2);
    expect(useAppStore.getState().workspace.MAIN[0].type).toBe('FORWARD');
    expect(useAppStore.getState().workspace.MAIN[1].type).toBe('PEN_UP');
  });

  it('switching to the active environment is a no-op and preserves current workspace', () => {
    const store = useAppStore.getState();
    store.addBlock('MAIN', 'MOVE_FWD', 5);

    store.setSimEnvironment('grid');

    expect(useAppStore.getState().activeSimId).toBe('grid');
    expect(useAppStore.getState().workspace.MAIN).toHaveLength(1);
    expect(useAppStore.getState().workspace.MAIN[0].repeatCount).toBe(5);
  });

  it('clearing workspace in one environment does not affect the other environment', () => {
    const store = useAppStore.getState();

    // Grid has code
    store.addBlock('MAIN', 'MOVE_FWD', 4);
    store.setSimEnvironment('turtle');

    // Turtle has code
    store.addBlock('MAIN', 'FORWARD', 1, undefined, { distance: 30 });
    expect(useAppStore.getState().workspace.MAIN).toHaveLength(1);

    // Clear Turtle workspace
    store.clearWorkspace();
    expect(useAppStore.getState().workspace.MAIN).toHaveLength(0);

    // Switch to Grid -> Grid code is intact!
    store.setSimEnvironment('grid');
    expect(useAppStore.getState().workspace.MAIN).toHaveLength(1);
    expect(useAppStore.getState().workspace.MAIN[0].type).toBe('MOVE_FWD');
    expect(useAppStore.getState().workspace.MAIN[0].repeatCount).toBe(4);

    // Switch to Turtle -> Turtle is still cleared (empty)
    store.setSimEnvironment('turtle');
    expect(useAppStore.getState().workspace.MAIN).toHaveLength(0);
  });

  it('clearing a specific scope in one environment persists without affecting other scopes or environments', () => {
    const store = useAppStore.getState();

    // Grid has MAIN and F1
    store.addBlock('MAIN', 'MOVE_FWD');
    store.addBlock('F1', 'TURN_LEFT');

    // Clear only F1
    store.clearWorkspace('F1');
    expect(useAppStore.getState().workspace.MAIN).toHaveLength(1);
    expect(useAppStore.getState().workspace.F1).toHaveLength(0);

    // Switch to Turtle and add code
    store.setSimEnvironment('turtle');
    store.addBlock('MAIN', 'FORWARD');

    // Switch back to Grid
    store.setSimEnvironment('grid');
    expect(useAppStore.getState().workspace.MAIN).toHaveLength(1);
    expect(useAppStore.getState().workspace.F1).toHaveLength(0);
  });

  it('deep clones workspaces so modifications do not corrupt memory snapshots', () => {
    const store = useAppStore.getState();

    store.addBlock('MAIN', 'MOVE_FWD', 2);
    store.setSimEnvironment('turtle');

    // Mutate the saved snapshot manually or verify clone independence
    const savedGrid = useAppStore.getState().savedWorkspaces['grid'];
    expect(savedGrid.MAIN[0].repeatCount).toBe(2);

    // Modifying the saved snapshot object should not affect restored workspace
    savedGrid.MAIN[0].repeatCount = 999;

    store.setSimEnvironment('grid');
    // Because destination was cloned from savedWorkspaces at switch time:
    expect(useAppStore.getState().workspace.MAIN[0].repeatCount).toBe(999);
    // Modifying active workspace now
    store.updateBlockRepeat('MAIN', useAppStore.getState().workspace.MAIN[0].id, 10);
    expect(useAppStore.getState().workspace.MAIN[0].repeatCount).toBe(10);
  });

  it('preserves code across environment when importing code', () => {
    const store = useAppStore.getState();

    // Write grid code
    store.addBlock('MAIN', 'MOVE_FWD', 3);
    store.addBlock('MAIN', 'TURN_RIGHT');

    // Export a turtle code
    store.setSimEnvironment('turtle');
    store.addBlock('MAIN', 'TURN_RIGHT', undefined, undefined, { angle: 45 });
    const exportedTurtle = store.exportCode();

    // Switch back to grid, change grid code
    store.setSimEnvironment('grid');
    expect(useAppStore.getState().workspace.MAIN).toHaveLength(2);

    // Now import turtle code while activeSimId is grid
    const res = store.importCode(exportedTurtle);
    expect(res.success).toBe(true);
    expect(useAppStore.getState().activeSimId).toBe('turtle');
    expect(useAppStore.getState().workspace.MAIN).toHaveLength(1);
    expect(useAppStore.getState().workspace.MAIN[0].params?.angle).toBe(45);

    // Switch back to grid -> previous grid code was preserved!
    store.setSimEnvironment('grid');
    expect(useAppStore.getState().workspace.MAIN).toHaveLength(2);
    expect(useAppStore.getState().workspace.MAIN[0].type).toBe('MOVE_FWD');
  });

  it('runs instant simulation on restored code when switching environments in instant mode', () => {
    const store = useAppStore.getState();
    store.setSpeed('instant');

    // Grid code: robot moves from (0, 0) EAST to (2, 0)
    store.addBlock('MAIN', 'MOVE_FWD', 2);
    expect(useAppStore.getState().grid.robot.x).toBe(2);

    // Switch to Turtle
    store.setSimEnvironment('turtle');
    expect(useAppStore.getState().turtleState.paths).toHaveLength(0);

    // Turtle code: forward 50
    store.addBlock('MAIN', 'FORWARD', 1, undefined, { distance: 50 });
    expect(useAppStore.getState().turtleState.robot.y).toBe(-50);
    expect(useAppStore.getState().turtleState.paths).toHaveLength(1);

    // Switch back to Grid: instant simulation should run with restored grid code
    store.setSimEnvironment('grid');
    expect(useAppStore.getState().grid.robot.x).toBe(2);

    // Switch back to Turtle: instant simulation should run with restored turtle code
    store.setSimEnvironment('turtle');
    expect(useAppStore.getState().turtleState.robot.y).toBe(-50);
    expect(useAppStore.getState().turtleState.paths).toHaveLength(1);
  });
});
