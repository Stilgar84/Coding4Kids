import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { createCurriculumGridState } from '../src/data/curriculum';
import {
  isFlagPadlocked,
  resetGridInteractiveState,
} from '../src/engine/physics';
import { runHeadlessSimulation } from '../src/engine/simulationRunner';
import { renderGridMapSvg } from '../src/services/mapThumbnailGenerator';
import { GridOverlayLayer } from '../src/simulations/grid/components/GridOverlayLayer';
import { GridToolbarTools } from '../src/simulations/grid/components/GridToolbarTools';
import {
  BackpackHud,
  WorldItemsLayer,
  detectWorldItemTransition,
} from '../src/simulations/grid/components/WorldItemsLayer';
import { FlagPadlockOverlay } from '../src/simulations/grid/components/FlagPadlockOverlay';
import { gridSimulationEnvironment } from '../src/simulations/grid/gridEnvironment';
import { getInitialGridState, useAppStore } from '../src/store/useAppStore';
import { GridState, WorkspaceState } from '../src/types';

function makeWorkspace(types: string[]): WorkspaceState {
  return {
    MAIN: types.map((type, idx) => ({ id: `b_${idx}_${type}`, type })),
    F1: [],
    F2: [],
    F3: [],
  };
}

describe('Commit 14: Interactive World Items, Contextual Physics, Visuals & Sandbox Tools', () => {
  beforeEach(() => {
    const store = useAppStore.getState();
    store.pause();
    store.setSpeed(400);
    store.setAppMode('sandbox');
    store.setSimEnvironment('grid');
    store.setLevel(1);
    store.setEditorTool('NONE');
    store.setEditorKeyGateVariant('circle');
    store.clearWorkspace();
    store.clearHistory();
  });

  describe('Water Channels & Wooden Plank Bridges', () => {
    const baseWaterMap = () =>
      createCurriculumGridState({
        width: 5,
        height: 3,
        robot: { x: 0, y: 1, dir: 'EAST' },
        barriers: [],
        flags: [{ id: 'goal', x: 3, y: 1, isGoal: true, order: 1 }],
        waterCells: [{ x: 2, y: 1 }],
        worldItems: [{ id: 'plank_1', type: 'plank', x: 1, y: 1 }],
      });

    it('collides when stepping onto unbridged water', () => {
      const ws = makeWorkspace(['MOVE_FWD', 'MOVE_FWD']);
      const res = runHeadlessSimulation(ws, 'grid', baseWaterMap());
      expect(res.finalState.status).toBe('COLLISION');
      expect(res.finalState.robot.x).toBe(1);
      expect(res.finalState.robot.y).toBe(1);
    });

    it('picks up a plank, places a bridge over water ahead, consumes the plank, and crosses safely', () => {
      const ws = makeWorkspace([
        'MOVE_FWD', // onto (1,1) where plank sits
        'PICK_UP',  // carry plank
        'USE_DROP', // lay bridge onto (2,1) ahead
        'MOVE_FWD', // step onto bridged water (2,1)
        'MOVE_FWD', // step onto Goal (3,1)
      ]);
      const res = runHeadlessSimulation(ws, 'grid', baseWaterMap());
      expect(res.finalState.status).toBe('SUCCESS');
      expect(res.finalState.robot.x).toBe(3);
      expect(res.finalState.robot.y).toBe(1);
      expect(res.finalState.robot.carriedItem).toBeNull();
      expect(res.finalState.worldItems).toHaveLength(0);
      expect(res.finalState.bridgedWaterCells).toEqual([{ x: 2, y: 1 }]);
    });

    it('treats USE_DROP with a plank facing dry floor as a safe non-fatal no-op keeping the plank', () => {
      const grid = baseWaterMap();
      // Move to (1,1), pick up plank, turn NORTH (facing dry floor (1,0)), try USE_DROP
      const ws = makeWorkspace(['MOVE_FWD', 'PICK_UP', 'TURN_LEFT', 'USE_DROP']);
      const res = runHeadlessSimulation(ws, 'grid', grid);
      expect(res.finalState.status).not.toBe('COLLISION');
      expect(res.finalState.robot.carriedItem?.type).toBe('plank');
      expect(res.finalState.bridgedWaterCells).toEqual([]);
      expect(res.finalState.lastInteractionFeedback?.kind).toBe('invalid-use');
    });
  });

  describe('Shape + Color Keys & Locked Gates (● / ▲ / ◆)', () => {
    const baseKeyGateMap = () =>
      createCurriculumGridState({
        width: 5,
        height: 3,
        robot: { x: 0, y: 1, dir: 'EAST' },
        barriers: [],
        flags: [{ id: 'goal', x: 4, y: 1, isGoal: true, order: 1 }],
        lockedGates: [
          { id: 'gate_tri', x: 3, y: 1, shape: 'triangle', color: 'emerald' },
        ],
        worldItems: [
          { id: 'key_wrong', type: 'key', x: 1, y: 1, shape: 'circle', color: 'amber' },
          { id: 'key_match', type: 'key', x: 2, y: 1, shape: 'triangle', color: 'emerald' },
        ],
      });

    it('collides when stepping into a locked gate without unlocking it', () => {
      const ws = makeWorkspace(['MOVE_FWD', 'MOVE_FWD', 'MOVE_FWD']);
      const res = runHeadlessSimulation(ws, 'grid', baseKeyGateMap());
      expect(res.finalState.status).toBe('COLLISION');
      expect(res.finalState.robot.x).toBe(2);
    });

    it('unlocks a gate with a matching shape+color key, consumes key, and crosses to Goal', () => {
      const ws = makeWorkspace([
        'MOVE_FWD',
        'MOVE_FWD', // at (2,1) with triangle emerald key
        'PICK_UP',
        'USE_DROP', // unlock gate at (3,1)
        'MOVE_FWD', // cross unlocked gate (3,1)
        'MOVE_FWD', // reach goal (4,1)
      ]);
      const res = runHeadlessSimulation(ws, 'grid', baseKeyGateMap());
      expect(res.finalState.status).toBe('SUCCESS');
      expect(res.finalState.robot.carriedItem).toBeNull();
      expect(res.finalState.lockedGates?.[0].unlocked).toBe(true);
      expect(res.finalState.lockedGates?.[0].unlockedByKey).toBe(true);
    });

    it('rejects a wrong-shape/color key without consuming it, leaving the gate locked (collision on entry)', () => {
      const ws = makeWorkspace([
        'MOVE_FWD', // at (1,1) circle amber key
        'PICK_UP',
        'MOVE_FWD', // at (2,1) facing triangle gate at (3,1)
        'USE_DROP', // wrong key!
      ]);
      const afterWrongUse = runHeadlessSimulation(ws, 'grid', baseKeyGateMap());
      expect(afterWrongUse.finalState.status).not.toBe('COLLISION');
      expect(afterWrongUse.finalState.lockedGates?.[0].unlocked).toBe(false);
      expect(afterWrongUse.finalState.robot.carriedItem?.shape).toBe('circle');
      expect(afterWrongUse.finalState.lastInteractionFeedback?.kind).toBe('wrong-key');

      // Moving forward into the still-locked gate collides
      const stepIntoLocked = gridSimulationEnvironment.executeAction(
        'MOVE_FWD',
        afterWrongUse.finalState
      );
      expect(stepIntoLocked.isCollision).toBe(true);
      expect(stepIntoLocked.status).toBe('COLLISION');
    });
  });

  describe('Crates & Floor Switches (Goal Unlock + Linked Gate Dynamics)', () => {
    it('padlocks Goal while required FloorSwitch is inactive, unlocks when crate dropped, and re-locks if crate picked back up', () => {
      const map = createCurriculumGridState({
        width: 5,
        height: 3,
        robot: { x: 0, y: 1, dir: 'EAST' },
        barriers: [],
        flags: [{ id: 'goal', x: 3, y: 1, isGoal: true, order: 1 }],
        floorSwitches: [{ id: 'sw_1', x: 2, y: 1 }], // unlinked -> requiredForGoal defaults to true
        worldItems: [{ id: 'crate_1', type: 'crate', x: 1, y: 1 }],
      });

      // Initially Goal is padlocked because sw_1 is inactive
      expect(isFlagPadlocked(map.flags[0], map.flags, map.floorSwitches, map.lockedGates)).toBe(
        true
      );

      // Walking past switch onto Goal without placing crate does NOT win
      const prematureRes = runHeadlessSimulation(
        makeWorkspace(['MOVE_FWD', 'MOVE_FWD', 'MOVE_FWD']),
        'grid',
        map
      );
      expect(prematureRes.finalState.status).not.toBe('SUCCESS');
      expect(prematureRes.finalState.flags[0].collected).toBe(false);

      // Pick up crate at (1,1), drop onto switch at (2,1), then step onto Goal at (3,1) -> SUCCESS!
      const solveRes = runHeadlessSimulation(
        makeWorkspace(['MOVE_FWD', 'PICK_UP', 'MOVE_FWD', 'USE_DROP', 'MOVE_FWD']),
        'grid',
        map
      );
      expect(solveRes.finalState.status).toBe('SUCCESS');
      expect(solveRes.finalState.floorSwitches?.[0].active).toBe(true);

      // Verify picking crate back up from switch deactivates switch and re-padlocks Goal
      const dropThenPickup = runHeadlessSimulation(
        makeWorkspace(['MOVE_FWD', 'PICK_UP', 'MOVE_FWD', 'USE_DROP']),
        'grid',
        map
      );
      expect(dropThenPickup.finalState.floorSwitches?.[0].active).toBe(true);
      expect(
        isFlagPadlocked(
          dropThenPickup.finalState.flags[0],
          dropThenPickup.finalState.flags,
          dropThenPickup.finalState.floorSwitches,
          dropThenPickup.finalState.lockedGates
        )
      ).toBe(false);

      const afterPickupAgain = gridSimulationEnvironment.executeAction(
        'PICK_UP',
        dropThenPickup.finalState
      ).nextState;
      expect(afterPickupAgain.floorSwitches?.[0].active).toBe(false);
      expect(afterPickupAgain.robot.carriedItem?.type).toBe('crate');
      expect(
        isFlagPadlocked(
          afterPickupAgain.flags[0],
          afterPickupAgain.flags,
          afterPickupAgain.floorSwitches,
          afterPickupAgain.lockedGates
        )
      ).toBe(true);
    });

    it('opens a switch-linked gate when crate rests on switch and closes it when crate is picked back up', () => {
      const linkedMap = createCurriculumGridState({
        width: 6,
        height: 3,
        robot: { x: 0, y: 1, dir: 'EAST' },
        barriers: [],
        flags: [{ id: 'goal', x: 5, y: 1, isGoal: true, order: 1 }],
        floorSwitches: [{ id: 'sw_gate', x: 2, y: 1, linkedGateId: 'gate_1' }],
        lockedGates: [
          {
            id: 'gate_1',
            x: 4,
            y: 1,
            shape: 'diamond',
            color: 'purple',
            linkedSwitchId: 'sw_gate',
          },
        ],
        worldItems: [{ id: 'crate_1', type: 'crate', x: 1, y: 1 }],
      });

      expect(linkedMap.lockedGates?.[0].unlocked).toBe(false);

      // Pick up crate, move to switch (2,1), drop crate -> gate_1 opens -> cross (4,1) to (5,1) Goal!
      const solveRes = runHeadlessSimulation(
        makeWorkspace([
          'MOVE_FWD',
          'PICK_UP',
          'MOVE_FWD',
          'USE_DROP',
          'MOVE_FWD',
          'MOVE_FWD',
          'MOVE_FWD',
        ]),
        'grid',
        linkedMap
      );
      expect(solveRes.finalState.lockedGates?.[0].unlocked).toBe(true);
      expect(solveRes.finalState.status).toBe('SUCCESS');

      // Verify picking crate back up closes the linked gate
      const droppedState = runHeadlessSimulation(
        makeWorkspace(['MOVE_FWD', 'PICK_UP', 'MOVE_FWD', 'USE_DROP']),
        'grid',
        linkedMap
      ).finalState;
      expect(droppedState.lockedGates?.[0].unlocked).toBe(true);

      const pickedBackUp = gridSimulationEnvironment.executeAction('PICK_UP', droppedState).nextState;
      expect(pickedBackUp.lockedGates?.[0].unlocked).toBe(false);
    });
  });

  describe('1-Slot Backpack Enforcement & Clean Reset Restoration', () => {
    it('enforces 1-slot backpack limit and restores all consumed items, bridges, gates, and switches on Reset', () => {
      const map = createCurriculumGridState({
        width: 6,
        height: 3,
        robot: { x: 0, y: 1, dir: 'EAST' },
        barriers: [],
        flags: [{ id: 'goal', x: 5, y: 1, isGoal: true, order: 1 }],
        waterCells: [{ x: 3, y: 1 }],
        lockedGates: [{ id: 'g1', x: 4, y: 1, shape: 'circle', color: 'amber' }],
        worldItems: [
          { id: 'p1', type: 'plank', x: 1, y: 1 },
          { id: 'k1', type: 'key', x: 2, y: 1, shape: 'circle', color: 'amber' },
        ],
      });

      // Empty cell pickup is safe no-op
      const emptyPickup = gridSimulationEnvironment.executeAction('PICK_UP', map).nextState;
      expect(emptyPickup.robot.carriedItem).toBeNull();
      expect(emptyPickup.lastInteractionFeedback?.kind).toBe('noop-empty');

      // Pick up plank at (1,1), move to (2,1) where key sits, try second PICK_UP -> blocked by 1-slot cap!
      const secondPickupRes = runHeadlessSimulation(
        makeWorkspace(['MOVE_FWD', 'PICK_UP', 'MOVE_FWD', 'PICK_UP']),
        'grid',
        map
      );
      expect(secondPickupRes.finalState.robot.carriedItem?.id).toBe('p1');
      expect(secondPickupRes.finalState.worldItems?.some((it) => it.id === 'k1')).toBe(true);
      expect(secondPickupRes.finalState.lastInteractionFeedback?.kind).toBe('noop-full');

      // Full puzzle solve consuming both plank and key:
      // Move(1,1) -> Pick plank -> Move(2,1) -> Use plank on water(3,1) -> Pick key at(2,1) -> Move(3,1) -> Use key on gate(4,1) -> Move(4,1) -> Move(5,1)
      const fullSolve = runHeadlessSimulation(
        makeWorkspace([
          'MOVE_FWD',
          'PICK_UP',
          'MOVE_FWD',
          'USE_DROP',
          'PICK_UP',
          'MOVE_FWD',
          'USE_DROP',
          'MOVE_FWD',
          'MOVE_FWD',
        ]),
        'grid',
        map
      );
      expect(fullSolve.finalState.status).toBe('SUCCESS');
      expect(fullSolve.finalState.worldItems).toHaveLength(0);
      expect(fullSolve.finalState.bridgedWaterCells).toEqual([{ x: 3, y: 1 }]);
      expect(fullSolve.finalState.lockedGates?.[0].unlocked).toBe(true);

      // Reset restores everything back to initial authored state!
      const resetA = resetGridInteractiveState(fullSolve.finalState);
      const resetB = getInitialGridState(fullSolve.finalState);
      for (const restored of [resetA, resetB]) {
        expect(restored.status).toBe('IDLE');
        expect(restored.robot.x).toBe(0);
        expect(restored.robot.y).toBe(1);
        expect(restored.robot.carriedItem).toBeNull();
        expect(restored.bridgedWaterCells).toEqual([]);
        expect(restored.lockedGates?.[0].unlocked).toBe(false);
        expect(restored.lockedGates?.[0].unlockedByKey).toBe(false);
        expect(restored.worldItems).toHaveLength(2);
        expect(restored.lastInteractionFeedback).toBeNull();
      }
    });
  });

  describe('Visual Rendering (SSR), Color-Blind Shape Redundancy & Screen-Reader Announcements', () => {
    it('renders WorldItemsLayer inside GridOverlayLayer, BackpackHud, FlagPadlockOverlay, and SVG thumbnails with shape+color attributes', () => {
      const grid: GridState = createCurriculumGridState({
        width: 5,
        height: 4,
        robot: { x: 0, y: 0, dir: 'EAST' },
        barriers: [],
        flags: [{ id: 'goal', x: 4, y: 3, isGoal: true, order: 1 }],
        waterCells: [
          { x: 1, y: 0 },
          { x: 1, y: 1 },
        ],
        lockedGates: [
          { id: 'g_circle', x: 2, y: 0, shape: 'circle', color: 'amber' },
          { id: 'g_tri', x: 2, y: 1, shape: 'triangle', color: 'emerald' },
          { id: 'g_dia', x: 2, y: 2, shape: 'diamond', color: 'purple' },
        ],
        floorSwitches: [{ id: 'sw_goal', x: 3, y: 2 }],
        worldItems: [
          { id: 'k_tri', type: 'key', x: 0, y: 1, shape: 'triangle', color: 'emerald' },
          { id: 'p_1', type: 'plank', x: 0, y: 2 },
          { id: 'c_1', type: 'crate', x: 0, y: 3 },
        ],
      });
      grid.bridgedWaterCells = [{ x: 1, y: 1 }];
      grid.robot.carriedItem = {
        id: 'carried_k',
        type: 'key',
        x: 0,
        y: 0,
        shape: 'diamond',
        color: 'purple',
      };

      const svgMarkup = renderToStaticMarkup(
        React.createElement(
          'svg',
          null,
          React.createElement(GridOverlayLayer, {
            grid,
            cellSize: 72,
            isInstant: false,
            isReadOnly: true,
            layer: 'under-robot',
            worldItemsSlot: React.createElement(WorldItemsLayer, { grid, cellSize: 72 }),
          }),
          React.createElement(GridOverlayLayer, {
            grid,
            cellSize: 72,
            isInstant: false,
            isReadOnly: true,
            layer: 'over-robot',
            flagPadlockSlot: React.createElement(FlagPadlockOverlay, { grid, cellSize: 72 }),
          })
        )
      );

      expect(svgMarkup).toContain('data-testid="grid-slot-world-items"');
      expect(svgMarkup).toContain('data-testid="water-cell-1-0"');
      expect(svgMarkup).toContain('data-testid="water-cell-1-1"');
      expect(svgMarkup).toContain('data-testid="plank-bridge-1-1"');
      expect(svgMarkup).toContain('data-testid="locked-gate-2-0"');
      expect(svgMarkup).toContain('data-shape="circle"');
      expect(svgMarkup).toContain('data-shape="triangle"');
      expect(svgMarkup).toContain('data-shape="diamond"');
      expect(svgMarkup).toContain('data-testid="floor-switch-3-2"');
      expect(svgMarkup).toContain('data-testid="world-item-key-0-1"');
      expect(svgMarkup).toContain('data-testid="world-item-plank-0-2"');
      expect(svgMarkup).toContain('data-testid="world-item-crate-0-3"');
      // Goal is padlocked because sw_goal is inactive!
      expect(svgMarkup).toContain('data-testid="padlock-goal-4-3"');

      const hudMarkup = renderToStaticMarkup(React.createElement(BackpackHud, { grid }));
      expect(hudMarkup).toContain('data-testid="grid-backpack-hud"');
      expect(hudMarkup).toContain('data-carrying="key"');
      expect(hudMarkup).toContain('data-carrying-shape="diamond"');
      expect(hudMarkup).toContain('◆');

      const thumbSvg = renderGridMapSvg(grid);
      expect(thumbSvg).toContain('data-thumb-water="1-0"');
      expect(thumbSvg).toContain('data-thumb-bridge="1-1"');
      expect(thumbSvg).toContain('data-thumb-gate="2-1"');
      expect(thumbSvg).toContain('data-thumb-switch="3-2"');
      expect(thumbSvg).toContain('data-thumb-item="key-0-1"');
      expect(thumbSvg).toContain('data-thumb-item="plank-0-2"');
      expect(thumbSvg).toContain('data-thumb-item="crate-0-3"');
      expect(thumbSvg).toContain('data-padlock-target="goal-4-3"');
    });

    it('emits polite status announcements on pickup, bridge, gate unlock, and switch activation while ignoring resets', () => {
      const store = useAppStore.getState();
      const map = createCurriculumGridState({
        width: 5,
        height: 3,
        robot: { x: 0, y: 1, dir: 'EAST' },
        barriers: [],
        flags: [{ id: 'goal', x: 3, y: 1, isGoal: true, order: 1 }],
        lockedGates: [{ id: 'g1', x: 2, y: 1, shape: 'triangle', color: 'emerald' }],
        worldItems: [{ id: 'k1', type: 'key', x: 1, y: 1, shape: 'triangle', color: 'emerald' }],
      });

      useAppStore.setState({
        grid: map,
        workspace: makeWorkspace(['MOVE_FWD', 'PICK_UP', 'USE_DROP']),
        runtime: null,
        statusAnnouncement: '',
      });

      store.step(); // MOVE_FWD to (1,1)
      store.step(); // PICK_UP key
      expect(useAppStore.getState().statusAnnouncement).toContain('Picked up emerald triangle (▲) key.');

      const beforeUnlock = useAppStore.getState().grid;
      store.step(); // USE_DROP unlocks gate
      const afterUnlock = useAppStore.getState().grid;
      expect(useAppStore.getState().statusAnnouncement).toContain(
        'Unlocked emerald triangle (▲) gate.'
      );

      // Reset transition produces null announcement (no spurious speech)
      const resetState = getInitialGridState(afterUnlock);
      expect(detectWorldItemTransition(beforeUnlock, afterUnlock).announcement).toContain(
        'Unlocked emerald triangle (▲) gate.'
      );
      expect(detectWorldItemTransition(afterUnlock, resetState).announcement).toBeNull();
    });
  });

  describe('Sandbox Map Editor Tools, Learn Mode Protection & Keyboard Accessibility', () => {
    it('places, switches variants, resizes, undoes, and erases interactive world elements in Sandbox while keeping Learn mode read-only', () => {
      const store = useAppStore.getState();
      store.setAppMode('sandbox');

      // Place Water at (2, 2)
      store.setEditorTool('WATER');
      store.setCellContent(2, 2);
      expect(useAppStore.getState().grid.waterCells).toEqual([{ x: 2, y: 2 }]);

      // Place Emerald Triangle Key at (1, 2) and matching Gate at (3, 2)
      store.setEditorKeyGateVariant('triangle');
      store.setEditorTool('KEY');
      store.setCellContent(1, 2);
      store.setEditorTool('GATE');
      store.setCellContent(3, 2);

      // Place Crate at (1, 3) and FloorSwitch at (2, 3)
      store.setEditorTool('CRATE');
      store.setCellContent(1, 3);
      store.setEditorTool('SWITCH');
      store.setCellContent(2, 3);

      let g = useAppStore.getState().grid;
      expect(g.lockedGates).toHaveLength(1);
      expect(g.lockedGates?.[0]).toMatchObject({ x: 3, y: 2, shape: 'triangle', color: 'emerald' });
      expect(g.floorSwitches).toHaveLength(1);
      expect(g.floorSwitches?.[0]).toMatchObject({ x: 2, y: 3, requiredForGoal: true });
      expect(g.worldItems).toHaveLength(2);

      // Resize board LEFT (+1) shifts all world items, water, switches, and gates cleanly
      store.resizeBoard('LEFT', 1);
      g = useAppStore.getState().grid;
      expect(g.waterCells).toEqual([{ x: 3, y: 2 }]);
      expect(g.lockedGates?.[0].x).toBe(4);
      expect(g.floorSwitches?.[0].x).toBe(3);

      // Erase cell (3, 2) removes water
      store.setEditorTool('ERASE');
      store.setCellContent(3, 2);
      expect(useAppStore.getState().grid.waterCells).toEqual([]);

      // Undo restores water at (3, 2)
      store.undo();
      expect(useAppStore.getState().grid.waterCells).toEqual([{ x: 3, y: 2 }]);

      // Accessible markup in Sandbox mode (with popover open)
      store.setEditorTool('KEY');
      const sandboxToolbarHtml = renderToStaticMarkup(
        React.createElement(GridToolbarTools, { defaultWorldMenuOpen: true })
      );
      expect(sandboxToolbarHtml).toContain('data-testid="tool-world-items-menu"');
      expect(sandboxToolbarHtml).toContain('aria-haspopup="dialog"');
      expect(sandboxToolbarHtml).toContain('aria-expanded="true"');
      expect(sandboxToolbarHtml).toContain('data-testid="world-items-popover"');
      expect(sandboxToolbarHtml).toContain('data-testid="tool-water"');
      expect(sandboxToolbarHtml).toContain('data-testid="tool-plank"');
      expect(sandboxToolbarHtml).toContain('data-testid="tool-key"');
      expect(sandboxToolbarHtml).toContain('data-testid="tool-gate"');
      expect(sandboxToolbarHtml).toContain('data-testid="tool-crate"');
      expect(sandboxToolbarHtml).toContain('data-testid="tool-switch"');
      expect(sandboxToolbarHtml).toContain('data-testid="variant-circle"');
      expect(sandboxToolbarHtml).toContain('data-testid="variant-triangle"');
      expect(sandboxToolbarHtml).toContain('data-testid="variant-diamond"');

      // Switch to Curriculum (Learn) mode -> strictly read-only!
      store.setAppMode('curriculum');
      expect(useAppStore.getState().editorTool).toBe('NONE');
      store.setEditorTool('WATER');
      expect(useAppStore.getState().editorTool).toBe('NONE');

      const learnBefore = JSON.stringify(useAppStore.getState().grid);
      store.setCellContent(1, 1);
      expect(JSON.stringify(useAppStore.getState().grid)).toBe(learnBefore);

      const learnToolbarHtml = renderToStaticMarkup(
        React.createElement(GridToolbarTools, { defaultWorldMenuOpen: true })
      );
      expect(learnToolbarHtml).toBe('');
    });
  });
});
