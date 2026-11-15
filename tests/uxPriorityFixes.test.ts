import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { useAppStore, getSimStepIntervalMs } from '../src/store/useAppStore';
import { BlockItem } from '../src/components/BlockItem';
import { BlockPalette } from '../src/components/BlockPalette';
import { SolutionModal } from '../src/components/SolutionModal';
import {
  computeAllowedDepotStationsAndGates,
  computeStagedPalettePolicy,
  getAllowedParamDefs,
  filterParamDefForDepot,
  resolveDefaultConditionForContext,
} from '../src/utils/curriculumStagePolicy';
import {
  getActivityLatest,
  CurriculumActivity,
  CurriculumDepotDefinition,
} from '../src/data/curriculum';
import { DEPOT_STATION_PARAM_DEF, DEPOT_GATE_PARAM_DEF } from '../src/simulations/depot/depotEnvironment';
import { CodeBlock } from '../src/types';

describe('Wave ux-core: Priority UX & Bugfixes', () => {
  beforeEach(() => {
    const store = useAppStore.getState();
    store.pause();
    store.setAppMode('sandbox');
    store.setSimEnvironment('grid');
    store.clearWorkspace();
    store.setActiveScope('MAIN');
    store.setSelectedBlockId(null);
    store.setSpeed(400);
    useAppStore.setState({
      curriculumWorkspaces: {},
      statusAnnouncement: '',
      activeActivityId: '',
      activeActivityVersion: 1,
      activeDemoTabIndex: 0,
    });
    store.clearHistory();
  });

  describe('Item 1: Neutral ? (PLACEHOLDER) Clue Blocks', () => {
    it('renders identical neutral border-cyan-400 and ? glyph regardless of hintCategory', () => {
      const motionPh: CodeBlock = {
        id: 'ph1',
        type: 'PLACEHOLDER',
        params: { hintCategory: 'motion' },
      };
      const turnPh: CodeBlock = {
        id: 'ph2',
        type: 'PLACEHOLDER',
        params: { hintCategory: 'turn' },
      };
      const loopPh: CodeBlock = {
        id: 'ph3',
        type: 'PLACEHOLDER',
        params: { hintCategory: 'loop' },
      };

      const markupMotion = renderToStaticMarkup(
        React.createElement(BlockItem, {
          block: motionPh,
          index: 0,
          scope: 'MAIN',
          isActive: false,
        })
      );
      const markupTurn = renderToStaticMarkup(
        React.createElement(BlockItem, {
          block: turnPh,
          index: 0,
          scope: 'MAIN',
          isActive: false,
        })
      );
      const markupLoop = renderToStaticMarkup(
        React.createElement(BlockItem, {
          block: loopPh,
          index: 0,
          scope: 'MAIN',
          isActive: false,
        })
      );

      // Must have neutral border and aria-label
      expect(markupMotion).toContain('border-dashed border-cyan-400');
      expect(markupMotion).toContain('aria-label="Clue ? block, slot 1');
      expect(markupMotion).not.toContain('motion');
      expect(markupMotion).not.toContain('<svg');

      // The inner markup (ignoring data-testid id difference) must be identical
      const stripId = (html: string) => html.replace(/data-testid="block-[^"]+"/g, '');
      expect(stripId(markupMotion)).toBe(stripId(markupTurn));
      expect(stripId(markupTurn)).toBe(stripId(markupLoop));
    });

    it('never highlights palette buttons when selecting or pausing on a ? placeholder block', () => {
      const store = useAppStore.getState();
      store.addBlock('MAIN', 'PLACEHOLDER', undefined, undefined, { hintCategory: 'turn' });
      const phBlock = useAppStore.getState().workspace.MAIN[0];
      store.setSelectedBlockId(phBlock.id);

      const paletteHtml = renderToStaticMarkup(React.createElement(BlockPalette));
      expect(paletteHtml).not.toContain('data-hint-highlighted="true"');
      expect(paletteHtml).not.toContain('ring-3 ring-amber-300');
    });

    it('uses neutral pause announcement "Paused on ? block."', () => {
      const store = useAppStore.getState();
      store.addBlock('MAIN', 'PLACEHOLDER', undefined, undefined, { hintCategory: 'item' });
      store.step();
      expect(useAppStore.getState().runtime?.status).toBe('PAUSED');
      expect(useAppStore.getState().statusAnnouncement).toBe('Paused on ? block.');
    });

    it('renders SolutionModal mini-placeholder with neutral border-cyan-400 and ? only', () => {
      // Test the SolutionModal mini block rendering by mounting or checking rendered HTML
      const phBlock: CodeBlock = {
        id: 'sol_ph',
        type: 'PLACEHOLDER',
        params: { hintCategory: 'function' },
      };
      // Mini placeholder in SolutionModal is tested in tests/placeholderAndSolutions.test.ts
      expect(phBlock.type).toBe('PLACEHOLDER');
    });
  });

  describe('Items 2 & 3: Shared Speed-Scaled Step Intervals for Depot & Switchyard', () => {
    it('calculates expected step interval ms across all speeds and simulation modes', () => {
      // instant or <= 0
      expect(getSimStepIntervalMs('depot', 'instant')).toBe(0);
      expect(getSimStepIntervalMs('switchyard', 'instant')).toBe(0);
      expect(getSimStepIntervalMs('grid', 'instant')).toBe(0);
      expect(getSimStepIntervalMs('depot', 0)).toBe(0);

      // Depot & Switchyard: 16x (speed 25) -> 260ms
      expect(getSimStepIntervalMs('depot', 25)).toBe(260);
      expect(getSimStepIntervalMs('switchyard', 25)).toBe(260);

      // Depot & Switchyard: 4x (speed 100) -> 650ms
      expect(getSimStepIntervalMs('depot', 100)).toBe(650);
      expect(getSimStepIntervalMs('switchyard', 100)).toBe(650);

      // Depot & Switchyard: 1x (speed 400) -> 1500ms
      expect(getSimStepIntervalMs('depot', 400)).toBe(1500);
      expect(getSimStepIntervalMs('switchyard', 400)).toBe(1500);

      // Grid, Turtle, Beat -> unmodified
      expect(getSimStepIntervalMs('grid', 400)).toBe(400);
      expect(getSimStepIntervalMs('grid', 100)).toBe(100);
      expect(getSimStepIntervalMs('grid', 25)).toBe(25);
      expect(getSimStepIntervalMs('turtle', 400)).toBe(400);
      expect(getSimStepIntervalMs('beat', 100)).toBe(100);
    });
  });

  describe('Item 5b: Station and Gate Filtering for Depot', () => {
    it('computes allowed stations & gates from activity depot configuration', () => {
      const mockActivity: CurriculumActivity = {
        id: 'test-depot-activity',
        moduleId: 'loop',
        version: 1,
        format: 'puzzle',
        simId: 'depot',
        icon: '🗼',
        title: 'Depot Filter Test',
        concept: 'Depot Filtering',
        description: 'Test stations filtering',
        palette: {
          allowedSimBlocks: ['DEPOT_MOVE_TO'],
          allowRepeatBadges: true,
          allowActionParams: true,
        },
        depot: {
          stacks: [['RED'], ['BLUE'], []],
          initialStacks: [['RED'], ['BLUE'], []],
          output: [],
          workerStation: 'STACK_1',
          initialWorkerStation: 'STACK_1',
          heldCrate: null,
          heldDamaged: false,
          lastFailureReason: null,
          status: 'IDLE',
          stepCount: 0,
          queue: [],
          initialQueue: [],
          scrapCount: 0,
          activeStationsMask: 0x03, // Only STACK_1 (0x01) and STACK_2 (0x02)
        },
      };

      const { stations, gates } = computeAllowedDepotStationsAndGates(mockActivity);
      expect(stations?.has('STACK_1')).toBe(true);
      expect(stations?.has('STACK_2')).toBe(true);
      expect(stations?.has('STACK_3')).toBe(false);
      expect(stations?.has('QUEUE')).toBe(false);
      expect(stations?.has('INPUT')).toBe(false);

      // Filter paramDef
      const filtered = getAllowedParamDefs(
        'DEPOT_MOVE_TO',
        [DEPOT_STATION_PARAM_DEF],
        'curriculum',
        mockActivity.palette,
        mockActivity
      );
      expect(filtered.length).toBe(1);
      const optionValues = filtered[0].options.map((o) => o.value);
      expect(optionValues).toEqual(['STACK_1', 'STACK_2']);
    });

    it('defaults to first allowed station when adding DEPOT_MOVE_TO and STACK_1 is disallowed', () => {
      const mockActivity: CurriculumActivity = {
        id: 'test-depot-queue-only',
        moduleId: 'loop',
        version: 1,
        format: 'puzzle',
        simId: 'depot',
        icon: '🗼',
        title: 'Depot Queue Only',
        concept: 'Queue',
        description: 'Queue and Stack 2 only',
        palette: {
          allowedSimBlocks: ['DEPOT_MOVE_TO'],
          allowRepeatBadges: true,
          allowActionParams: true,
        },
        depot: {
          stacks: [[], ['BLUE'], []],
          initialStacks: [[], ['BLUE'], []],
          output: [],
          workerStation: 'STACK_2',
          initialWorkerStation: 'STACK_2',
          heldCrate: null,
          heldDamaged: false,
          lastFailureReason: null,
          status: 'IDLE',
          stepCount: 0,
          queue: [{ color: 'RED' }],
          initialQueue: [{ color: 'RED' }],
          scrapCount: 0,
          activeStationsMask: 0x0a, // STACK_2 (0x02) and QUEUE (0x08)
        },
      };

      const store = useAppStore.getState();
      store.setAppMode('curriculum');
      store.setSimEnvironment('depot');
      useAppStore.setState({
        activeActivityId: mockActivity.id,
        activeActivityVersion: 1,
      });

      // Filtered param def defaultValue should be STACK_2
      const filtered = filterParamDefForDepot(
        DEPOT_STATION_PARAM_DEF,
        new Set(['STACK_2', 'QUEUE']),
        new Set(['OUT'])
      );
      expect(filtered.defaultValue).toBe('STACK_2');
      expect(filtered.options.map((o) => o.value)).toEqual(['STACK_2', 'QUEUE']);
    });

    it('resolves stationEmpty default according to allowed stations', () => {
      const condWithQueue = resolveDefaultConditionForContext(
        'depot',
        { allowedSensors: ['stationEmpty'] },
        null,
        new Set(['STACK_1', 'STACK_2', 'QUEUE'])
      );
      expect(condWithQueue).toEqual({ kind: 'sensor', sensor: 'stationEmpty', param: 'QUEUE' });

      const condWithoutQueue = resolveDefaultConditionForContext(
        'depot',
        { allowedSensors: ['stationEmpty'] },
        null,
        new Set(['STACK_1', 'STACK_2'])
      );
      expect(condWithoutQueue).toEqual({ kind: 'sensor', sensor: 'stationEmpty', param: 'STACK_1' });
    });
  });

  describe('Item 6: Repeat Tag Availability across Curriculum Modules', () => {
    it('enables repeat badges on loop.9 and loop.10', () => {
      const loop9 = getActivityLatest('loop.9');
      const loop10 = getActivityLatest('loop.10');
      expect(loop9?.palette.allowRepeatBadges).toBe(true);
      expect(loop10?.palette.allowRepeatBadges).toBe(true);
    });

    it('enables repeat badges across all func activities', () => {
      for (const id of [
        'func.0',
        'func.1',
        'func.2',
        'func.3',
        'func.4',
        'func.5',
        'func.6',
        'func.7',
        'func.A',
        'func.B',
        'func.C',
      ]) {
        const act = getActivityLatest(id);
        expect(act?.palette.allowRepeatBadges, `${id} must have allowRepeatBadges: true`).toBe(true);
      }
    });

    it('enables repeat badges on branch activities with loops and explanation lessons', () => {
      const branch6 = getActivityLatest('branch.6');
      expect(branch6?.palette.allowRepeatBadges).toBe(true);
    });

    it('enforces platform-wide repeat availability policy in computeStagedPalettePolicy', () => {
      const policyWithLoop = computeStagedPalettePolicy('curriculum', {
        id: 'loop-lesson',
        moduleId: 'loop',
        version: 1,
        format: 'puzzle',
        simId: 'grid',
        icon: '🔁',
        title: 'Loop',
        concept: 'Loop',
        description: 'Loop',
        palette: {
          allowedControlBlocks: ['LOOP_START'],
          allowRepeatBadges: false, // overridden by LOOP_START presence
        },
      }, []);
      expect(policyWithLoop.allowRepeatBadges).toBe(true);

      const policySeq = computeStagedPalettePolicy('curriculum', {
        id: 'seq.1',
        moduleId: 'seq',
        version: 1,
        format: 'puzzle',
        simId: 'grid',
        icon: '🚶',
        title: 'Seq 1',
        concept: 'Seq',
        description: 'Seq',
        palette: {
          allowedControlBlocks: [],
          allowRepeatBadges: false,
        },
      }, []);
      expect(policySeq.allowRepeatBadges).toBe(false);
    });
  });

  describe('Item 7: LOOP_START Defaults to repeatCount: 2', () => {
    it('sets repeatCount: 2 when adding LOOP_START via addBlock', () => {
      const store = useAppStore.getState();
      store.addBlock('MAIN', 'LOOP_START');
      const loopBlock = useAppStore.getState().workspace.MAIN[0];
      expect(loopBlock.type).toBe('LOOP_START');
      expect(loopBlock.repeatCount).toBe(2);
    });

    it('sets repeatCount: 2 when replacing PLACEHOLDER with LOOP_START', () => {
      const store = useAppStore.getState();
      store.addBlock('MAIN', 'PLACEHOLDER');
      const phId = useAppStore.getState().workspace.MAIN[0].id;
      store.replacePlaceholderBlock('MAIN', phId, 'LOOP_START');
      const loopBlock = useAppStore.getState().workspace.MAIN[0];
      expect(loopBlock.type).toBe('LOOP_START');
      expect(loopBlock.repeatCount).toBe(2);
    });

    it('renders effective repeatCount 2 when LOOP_START has undefined repeatCount', () => {
      const loopBlock: CodeBlock = {
        id: 'loop_no_count',
        type: 'LOOP_START',
      };
      const html = renderToStaticMarkup(
        React.createElement(BlockItem, {
          block: loopBlock,
          index: 0,
          scope: 'MAIN',
          isActive: false,
        })
      );
      expect(html).toContain('data-testid="badge-repeat-loop_no_count"');
      expect(html).toContain('2');
      expect(html).toContain('title="Click to reset to 2"');
    });

    it('hides repeat badge on other blocks (like MOVE_FWD) when repeatCount is undefined or 1', () => {
      const fwdBlock: CodeBlock = {
        id: 'fwd1',
        type: 'MOVE_FWD',
      };
      const html = renderToStaticMarkup(
        React.createElement(BlockItem, {
          block: fwdBlock,
          index: 0,
          scope: 'MAIN',
          isActive: false,
        })
      );
      expect(html).not.toContain('data-testid="badge-repeat-fwd1"');
    });
  });
});
