import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CURRICULUM_ACTIVITIES,
  CURRICULUM_MODULES,
  MASTERY_CHALLENGE_TIERS,
  ConditionExpr,
  CurriculumActivity,
  CurriculumSwitchyardDefinition,
  createCurriculumGridState,
  getActivityVariants,
} from '../src/data/curriculum';
import {
  ENV_VERSION_GRID_V3,
  ENV_VERSION_DEPOT,
  ENV_VERSION_DEPOT_STATE,
  ENV_VERSION_DEPOT_QUEUE,
  ENV_VERSION_SWITCHYARD,
  ENV_ID_SWITCHYARD,
  MASK_ELSE_HAS_COND,
  OP_WHILE,
  OP_END_WHILE,
  OP_DEPOT_SEND_GATE,
  SERIALIZED_SENSOR_IDS,
  encodeVarOrSensorIndex,
  decodeVarOrSensorIndex,
} from '../src/engine/serialization/types';
import {
  getCurriculumTrackActivities,
  getNextCurriculumActivity,
  getPrevCurriculumActivity,
} from '../src/utils/curriculumStagePolicy';
import { SimulationTopLeftHud } from '../src/components/SimulationTopLeftHud';
import { VariableWatchOverlay } from '../src/components/VariableWatchOverlay';
import { MultiRunPipsBarView } from '../src/components/MultiRunPipsBar';
import { GridOverlayLayer, GRID_CELL_SIZE } from '../src/simulations/grid/components/GridOverlayLayer';
import { useAppStore } from '../src/store/useAppStore';

import '../src/simulations/grid/gridEnvironment';

function makeMinimalActivity(
  overrides: Partial<CurriculumActivity> & Pick<CurriculumActivity, 'id' | 'moduleId' | 'format'>
): CurriculumActivity {
  return {
    version: 1,
    simId: 'grid',
    icon: '🧪',
    title: overrides.id,
    concept: 'test',
    palette: { allowedSimBlocks: ['MOVE_FWD'] },
    grid: {
      width: 3,
      height: 1,
      robot: { x: 0, y: 0, dir: 'EAST' },
      barriers: [],
      flags: [{ id: 'goal', x: 2, y: 0, isGoal: true, order: 1, collected: false }],
    },
    ...overrides,
  };
}

describe('Commit 19: M4-M6 Foundations, Multi-Variant Runner, HUD Slots & Challenge Isolation', () => {
  beforeEach(() => {
    const s = useAppStore.getState();
    s.setAppMode('sandbox');
    s.setSimEnvironment('grid');
    s.setSpeed(400);
    s.setLevel(1);
    s.clearWorkspace();
  });

  describe('Serialization & Protocol Constants', () => {
    it('preserves existing Depot v1/v2 versions while adding M4-M6 wire constants & $tileDial sensor', () => {
      expect(ENV_VERSION_DEPOT).toBe(1);
      expect(ENV_VERSION_DEPOT_STATE).toBe(2);
      expect(ENV_VERSION_DEPOT_QUEUE).toBe(3);

      expect(ENV_VERSION_GRID_V3).toBe(3);
      expect(ENV_ID_SWITCHYARD).toBe(0x05);
      expect(ENV_VERSION_SWITCHYARD).toBe(1);

      expect(MASK_ELSE_HAS_COND).toBe(0x20);
      expect(OP_WHILE).toBe(0x0a);
      expect(OP_END_WHILE).toBe(0x0b);
      expect(OP_DEPOT_SEND_GATE).toBe(0x14);

      expect(SERIALIZED_SENSOR_IDS[3]).toBe('$tileDial');
      expect(encodeVarOrSensorIndex('$tileDial')).toBe(0x83);
      expect(decodeVarOrSensorIndex(0x83)).toBe('$tileDial');
    });
  });

  describe('Module 4-6 & 5-Tier Challenge Metadata', () => {
    it('supports Phase 3 (8 slug modules) and optional 5-tier mastery challenge metadata', () => {
      expect(CURRICULUM_MODULES).toHaveLength(8);
      expect(CURRICULUM_MODULES.map((m) => m.id)).toEqual([
        'seq',
        'param',
        'loop',
        'func',
        'branch',
        'while',
        'var',
        'cmp',
      ]);
      expect(CURRICULUM_MODULES.map((m) => m.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

      if (MASTERY_CHALLENGE_TIERS.length === 0) {
        expect(MASTERY_CHALLENGE_TIERS).toEqual([]);
        return;
      }

      expect(MASTERY_CHALLENGE_TIERS).toHaveLength(5);
      expect(MASTERY_CHALLENGE_TIERS[0]).toMatchObject({
        tier: 1,
        id: 'tier-1',
        badgeId: 'badge-challenge-tier-1',
        unlockAfterModuleId: 'module-6',
        challengeIds: ['C6.1', 'C6.2'],
      });
      expect(MASTERY_CHALLENGE_TIERS.slice(1).map((t) => t.unlockAfterModuleId)).toEqual([
        'module-8',
        'module-9',
        'module-10',
        'module-11',
      ]);
    });

    it('supports ConditionExpr AST shapes, Switchyard definitions, and getActivityVariants resolution', () => {
      const expr: ConditionExpr = {
        kind: 'and',
        left: { kind: 'sensor', sensor: 'pathAhead' },
        right: {
          kind: 'not',
          operand: { kind: 'sensor', sensor: 'tileColor', param: 'amber' },
        },
      };
      expect(expr.kind).toBe('and');

      const switchyardDef: CurriculumSwitchyardDefinition = {
        label: 'Track A',
        incomingStream: [
          { id: 'c1', color: 'sky', icon: 'crate' },
          { id: 'c2', color: 'amber', icon: 'gear', damaged: true },
        ],
        switches: [
          {
            id: 'sw1',
            initialDirection: 'left',
            leftTarget: 'dock-sky',
            rightTarget: 'scrap',
          },
        ],
        docks: [{ id: 'dock-sky', expectedColor: 'sky' }],
        scrapChute: { expectedDamagedOnly: true, expectedCount: 1 },
      };

      const switchyardVariants = getActivityVariants({ palette: {}, switchyard: switchyardDef }, 'switchyard');
      expect(switchyardVariants).toHaveLength(1);
      expect(switchyardVariants[0].switchyard?.switches[0].id).toBe('sw1');
    });
  });

  describe('Challenge Navigation Isolation', () => {
    it('isolates core lessons/capstones from format==="challenge" activities in next/prev lookups', () => {
      const catalog: CurriculumActivity[] = [
        makeMinimalActivity({ id: '1.1', moduleId: 'module-1', format: 'puzzle' }),
        makeMinimalActivity({ id: '6B', moduleId: 'module-6', format: 'capstone' }),
        makeMinimalActivity({ id: 'C6.1', moduleId: 'module-6', format: 'challenge' }),
        makeMinimalActivity({ id: 'C6.2', moduleId: 'module-6', format: 'challenge' }),
      ];

      expect(getCurriculumTrackActivities('6B', catalog).map((a) => a.id)).toEqual(['1.1', '6B']);
      expect(getCurriculumTrackActivities('C6.1', catalog).map((a) => a.id)).toEqual(['C6.1', 'C6.2']);

      // Core track must NEVER step into C6.1
      expect(getNextCurriculumActivity('6B', catalog)).toBeUndefined();
      expect(getNextCurriculumActivity('6B', catalog, true)?.id).toBe('1.1');
      expect(getPrevCurriculumActivity('1.1', catalog, true)?.id).toBe('6B');

      // Challenge track navigates strictly within challenges
      expect(getNextCurriculumActivity('C6.1', catalog)?.id).toBe('C6.2');
      expect(getNextCurriculumActivity('C6.2', catalog)).toBeUndefined();
      expect(getNextCurriculumActivity('C6.2', catalog, true)?.id).toBe('C6.1');
      expect(getPrevCurriculumActivity('C6.1', catalog, true)?.id).toBe('C6.2');
    });
  });

  describe('Shared Non-Overlapping HUD & Simulation Overlay Slots', () => {
    it('renders SimulationTopLeftHud with topSlot, VariableWatchOverlay, and reserved CallStack slot', () => {
      const markup = renderToStaticMarkup(
        React.createElement(SimulationTopLeftHud, {
          topSlot: React.createElement('div', { 'data-testid': 'mock-hud-top-slot' }, 'Key: 1'),
          variables: { a: 4, b: 9 },
          callStackSlot: React.createElement('div', { 'data-testid': 'mock-callstack' }, 'MAIN > F1'),
        })
      );

      expect(markup).toContain('data-testid="simulation-top-left-hud"');
      expect(markup).toContain('data-testid="mock-hud-top-slot"');
      expect(markup).toContain('data-testid="toolbar-variables"');
      expect(markup).toContain('data-testid="var-badge-a"');
      expect(markup).toContain('a=4');
      expect(markup).toContain('data-testid="var-badge-b"');
      expect(markup).toContain('b=9');
      expect(markup).toContain('data-testid="mock-callstack"');

      const emptyVarsMarkup = renderToStaticMarkup(
        React.createElement(VariableWatchOverlay, { variables: {} })
      );
      expect(emptyVarsMarkup).toBe('');
    });

    it('renders MultiRunPipsBarView only when >1 variants exist and preserves GridOverlayLayer slots', () => {
      const singleMarkup = renderToStaticMarkup(
        React.createElement(MultiRunPipsBarView, {
          variants: [{ index: 0, kind: 'grid', status: 'IDLE' }],
          focusedIndex: 0,
          onSelectVariant: vi.fn(),
        })
      );
      expect(singleMarkup).toBe('');

      const multiMarkup = renderToStaticMarkup(
        React.createElement(MultiRunPipsBarView, {
          variants: [
            { index: 0, label: 'Corridor A', kind: 'grid', status: 'SUCCESS' },
            { index: 1, label: 'Corridor B', kind: 'grid', status: 'COLLISION' },
            { index: 2, label: 'Corridor C', kind: 'grid', status: 'IDLE' },
          ],
          focusedIndex: 1,
          onSelectVariant: vi.fn(),
        })
      );
      expect(multiMarkup).toContain('data-testid="multi-run-pips-bar"');
      expect(multiMarkup).toContain('data-testid="variant-pip-0"');
      expect(multiMarkup).toContain('data-variant-status="SUCCESS"');
      expect(multiMarkup).toContain('data-testid="variant-pip-1"');
      expect(multiMarkup).toContain('data-variant-status="COLLISION"');
      expect(multiMarkup).toContain('data-variant-focused="true"');
      expect(multiMarkup).toContain('data-testid="variant-pip-2"');
      expect(multiMarkup).toContain('data-variant-status="IDLE"');

      const grid = createCurriculumGridState({
        width: 2,
        height: 2,
        robot: { x: 0, y: 0, dir: 'EAST' },
        barriers: [],
        flags: [{ id: 'goal', x: 1, y: 1, isGoal: true, order: 1, collected: false }],
      });
      const overlayMarkup = renderToStaticMarkup(
        React.createElement(
          'svg',
          null,
          React.createElement(GridOverlayLayer, {
            grid,
            cellSize: GRID_CELL_SIZE,
            isInstant: false,
            isReadOnly: true,
            beaconAndDialSlot: React.createElement('rect', { 'data-testid': 'beacon-tile' }),
          })
        )
      );
      expect(overlayMarkup).toContain('data-testid="grid-slot-beacon-dial"');
      expect(overlayMarkup).toContain('data-testid="beacon-tile"');
    });
  });

  describe('Synchronized Multi-Variant Runner & Victory Gating', () => {
    it('evaluates all gridVariants together, blocks victory on partial pass, and switches focus cleanly', () => {
      const multiActivity = makeMinimalActivity({
        id: '99.9',
        moduleId: 'module-5',
        format: 'puzzle',
        palette: { allowedSimBlocks: ['MOVE_FWD', 'PICK_UP'] },
        grid: undefined,
        gridVariants: [
          {
            width: 3,
            height: 1,
            robot: { x: 0, y: 0, dir: 'EAST' },
            barriers: [],
            flags: [{ id: 'goal', x: 1, y: 0, isGoal: true, order: 1, collected: false }],
            worldItems: [{ id: 'opt_crate', type: 'crate', x: 1, y: 0 }],
            requireAllItemsCollected: false,
            strictInteractionCollision: false,
          },
          {
            width: 3,
            height: 1,
            robot: { x: 0, y: 0, dir: 'EAST' },
            barriers: [],
            flags: [{ id: 'goal', x: 1, y: 0, isGoal: true, order: 1, collected: false }],
            worldItems: [{ id: 'req_crate', type: 'crate', x: 1, y: 0 }],
            requireAllItemsCollected: true,
          },
        ],
        antiBypassRules: [{ description: 'synthetic multi-variant test' }],
      });

      CURRICULUM_ACTIVITIES.push(multiActivity);
      try {
        const store = useAppStore.getState();
        store.setCurriculumActivity('99.9', 1);

        let state = useAppStore.getState();
        expect(state.variantRuns).toHaveLength(2);
        expect(state.focusedVariantIndex).toBe(0);
        expect(state.grid.requireAllItemsCollected).toBe(false);

        // Partial solution: MOVE_FWD alone solves Variant 0 (requireAllItemsCollected: false), leaves Variant 1 un-solved
        store.setSpeed('instant');
        store.addBlock('MAIN', 'MOVE_FWD');
        store.runInstantIfActive({ allowVictoryModal: true });

        state = useAppStore.getState();
        expect(state.variantRuns[0].status).toBe('SUCCESS');
        expect(state.variantRuns[1].status).not.toBe('SUCCESS');
        // Victory modal & completion must stay FALSE until ALL variants succeed!
        expect(state.isVictoryModalOpen).toBe(false);
        expect(state.completedActivities['99.9']).toBeFalsy();
        // Automatically focuses the non-passing variant when focused variant passed
        expect(state.focusedVariantIndex).toBe(1);
        expect(state.grid.requireAllItemsCollected).toBe(true);

        // Switching pip focus updates grid snapshot to Variant 0
        store.setFocusedVariantIndex(0);
        state = useAppStore.getState();
        expect(state.focusedVariantIndex).toBe(0);
        expect(state.grid.requireAllItemsCollected).toBe(false);
        expect(state.grid.status).toBe('SUCCESS');

        // Full solution [MOVE_FWD, PICK_UP] passes BOTH variants at program end!
        store.reset();
        expect(useAppStore.getState().variantRuns.every((v) => v.status === 'IDLE')).toBe(true);

        store.addBlock('MAIN', 'PICK_UP');
        store.runInstantIfActive({ allowVictoryModal: true });

        state = useAppStore.getState();
        expect(state.variantRuns.every((v) => v.status === 'SUCCESS')).toBe(true);
        expect(state.isVictoryModalOpen).toBe(true);
        expect(state.completedActivities['99.9']).toBe(true);
      } finally {
        const idx = CURRICULUM_ACTIVITIES.indexOf(multiActivity);
        if (idx >= 0) CURRICULUM_ACTIVITIES.splice(idx, 1);
      }
    });
  });
});
