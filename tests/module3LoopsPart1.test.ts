import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  BlockItem,
  computeLoopNestingMetadata,
} from '../src/components/BlockItem';
import { WorkspaceCanvas } from '../src/components/WorkspaceCanvas';
import { renderTurtleVariationPreview } from '../src/components/VariationCardsPanel';
import {
  CURRICULUM_ACTIVITIES,
  MODULE_3_PART1_ACTIVITIES,
  createCurriculumBlock,
  createCurriculumGridState,
  getActivitiesForModule,
  getActivityLatest,
} from '../src/data/curriculum';
import {
  createInitialInterpreterState,
  tickInterpreter,
  validateLoopStructure,
} from '../src/engine/interpreter';
import {
  exportLessonToString,
  importFromString,
} from '../src/engine/serialization/codeSerializer';
import { verifyActivityConstraints } from '../src/engine/verification/constraintSolver';
import { DemoSpotlightOverlay } from '../src/simulations/grid/components/DemoSpotlightOverlay';
import { gridSimulationEnvironment } from '../src/simulations/grid/gridEnvironment';
import { useAppStore } from '../src/store/useAppStore';
import { CodeBlock, GridState, WorkspaceState } from '../src/types';

function emptyWorkspace(mainBlocks: CodeBlock[] = []): WorkspaceState {
  return {
    MAIN: mainBlocks,
    F1: [],
    F2: [],
    F3: [],
  };
}

function runGridWorkspaceToCompletion(
  workspace: WorkspaceState,
  initialGrid: GridState,
  maxTicks = 400
): {
  status: string;
  ticks: number;
  finalGrid: GridState;
  observedLoopIterations: string[];
  exitedPastLoopEnd: boolean;
} {
  let simGrid = gridSimulationEnvironment.resetState(initialGrid);
  let runtime = createInitialInterpreterState();
  const observedLoopIterations: string[] = [];
  let sawLoopEndExit = false;
  let ticks = 0;

  while (!runtime.done && ticks < maxTicks) {
    const prevLoopDepth = runtime.loopStack.length;
    const topFrame = runtime.callStack[runtime.callStack.length - 1];
    const pendingBlock = topFrame ? workspace[topFrame.scope]?.[topFrame.pc] : undefined;

    const step = tickInterpreter(
      runtime,
      workspace,
      simGrid,
      gridSimulationEnvironment
    );
    runtime = step.nextRuntime;
    simGrid = step.nextGrid;
    ticks++;

    if (runtime.status === 'PAUSED') {
      break;
    }

    if (runtime.loopStack.length > 0) {
      const inner = runtime.loopStack[runtime.loopStack.length - 1];
      const tag = `${inner.currentIteration}/${inner.totalIterations}`;
      if (observedLoopIterations[observedLoopIterations.length - 1] !== tag) {
        observedLoopIterations.push(tag);
      }
    }

    if (
      pendingBlock?.type === 'LOOP_END' &&
      prevLoopDepth > 0 &&
      runtime.loopStack.length < prevLoopDepth &&
      !runtime.done
    ) {
      sawLoopEndExit = true;
    }
  }

  return {
    status: runtime.status,
    ticks,
    finalGrid: simGrid,
    observedLoopIterations,
    exitedPastLoopEnd: sawLoopEndExit,
  };
}

describe('Commit 16 — Visual Loop Nesting Brackets & Module 3 Core Loop Lessons (3.0–3.3)', () => {
  beforeEach(() => {
    useAppStore.setState({
      appMode: 'curriculum',
      activeSimId: 'grid',
      activeScope: 'MAIN',
      activeActivityId: '3.1',
      activeActivityVersion: 1,
      activeDemoTabIndex: 0,
      selectedBlockId: null,
      workspace: emptyWorkspace(),
      runtime: createInitialInterpreterState(),
    });
  });

  describe('Visual Loop Nesting Brackets, Color-Blind Stroke Redundancy & ARIA Depth Labels', () => {
    it('renders flat loop (depth 1, solid purple) brackets and ARIA loop level 1 labels via SSR', () => {
      const blocks: CodeBlock[] = [
        createCurriculumBlock('LOOP_START', 3, undefined, 'flat_1'),
        createCurriculumBlock('MOVE_FWD', 2, undefined, 'flat_2'),
        createCurriculumBlock('TURN_RIGHT', undefined, undefined, 'flat_3'),
        createCurriculumBlock('LOOP_END', undefined, undefined, 'flat_4'),
      ];
      const analysis = computeLoopNestingMetadata(blocks);
      expect(analysis.maxDepth).toBe(1);
      expect(analysis.maxTier).toBe(0);
      expect(analysis.matchedSpans).toHaveLength(1);
      expect(analysis.matchedSpans[0]).toMatchObject({
        startIndex: 0,
        endIndex: 3,
        depth: 1,
        tier: 0,
        strokeStyle: 'solid',
        marker: 'circle',
      });

      useAppStore.setState({ workspace: emptyWorkspace(blocks) });
      const html = renderToStaticMarkup(React.createElement(WorkspaceCanvas));

      expect(html).toContain('data-loop-count="1"');
      expect(html).toContain('data-max-loop-depth="1"');
      expect(html).toContain('data-testid="loop-bracket-segment"');
      expect(html).toContain('data-loop-depth="1"');
      expect(html).toContain('data-loop-stroke="solid"');
      expect(html).toContain('data-loop-marker="circle"');

      // Screen-reader ARIA loop labels
      expect(html).toContain('Loop Start, slot 1, repeat 3, Loop level 1');
      expect(html).toContain('Move Forward, slot 2, repeat 2, Inside loop level 1');
      expect(html).toContain('Turn Right, slot 3, Inside loop level 1');
      expect(html).toContain('Loop End, slot 4, Loop level 1');
    });

    it('renders nested loops (depth 1 solid + depth 2 dashed + depth 3 double) with non-crossing tiers', () => {
      const nested2Blocks: CodeBlock[] = [
        createCurriculumBlock('LOOP_START', 4, undefined, 'nest_1'),
        createCurriculumBlock('MOVE_FWD', undefined, undefined, 'nest_2'),
        createCurriculumBlock('LOOP_START', 2, undefined, 'nest_3'),
        createCurriculumBlock('TURN_LEFT', undefined, undefined, 'nest_4'),
        createCurriculumBlock('LOOP_END', undefined, undefined, 'nest_5'),
        createCurriculumBlock('LOOP_END', undefined, undefined, 'nest_6'),
      ];

      const analysis2 = computeLoopNestingMetadata(nested2Blocks);
      expect(analysis2.maxDepth).toBe(2);
      expect(analysis2.maxTier).toBe(1);
      // Outer loop sits on tier 1 (cradling below), inner loop sits on tier 0 (closest to blocks)
      expect(analysis2.matchedSpans[0]).toMatchObject({
        startIndex: 0,
        endIndex: 5,
        depth: 1,
        tier: 1,
        strokeStyle: 'solid',
      });
      expect(analysis2.matchedSpans[1]).toMatchObject({
        startIndex: 2,
        endIndex: 4,
        depth: 2,
        tier: 0,
        strokeStyle: 'dashed',
      });

      useAppStore.setState({ workspace: emptyWorkspace(nested2Blocks) });
      const html2 = renderToStaticMarkup(React.createElement(WorkspaceCanvas));

      expect(html2).toContain('data-max-loop-depth="2"');
      expect(html2).toContain('data-loop-stroke="solid"');
      expect(html2).toContain('data-loop-stroke="dashed"');
      expect(html2).toContain('border-dashed');
      expect(html2).toContain('Loop Start, slot 3, repeat 2, Loop level 2 (nested)');
      expect(html2).toContain('Turn Left, slot 4, Inside loop level 2 (nested)');
      expect(html2).toContain('Loop End, slot 5, Loop level 2 (nested)');

      // Verify depth 3+ renders double-stroke emerald redundancy cleanly
      const nested3Blocks: CodeBlock[] = [
        createCurriculumBlock('LOOP_START', 2, undefined, 'd3_1'),
        createCurriculumBlock('LOOP_START', 2, undefined, 'd3_2'),
        createCurriculumBlock('LOOP_START', 2, undefined, 'd3_3'),
        createCurriculumBlock('MOVE_FWD', undefined, undefined, 'd3_4'),
        createCurriculumBlock('LOOP_END', undefined, undefined, 'd3_5'),
        createCurriculumBlock('LOOP_END', undefined, undefined, 'd3_6'),
        createCurriculumBlock('LOOP_END', undefined, undefined, 'd3_7'),
      ];
      useAppStore.setState({ workspace: emptyWorkspace(nested3Blocks) });
      const html3 = renderToStaticMarkup(React.createElement(WorkspaceCanvas));
      expect(html3).toContain('data-max-loop-depth="3"');
      expect(html3).toContain('data-loop-stroke="double"');
      expect(html3).toContain('border-double');
      expect(html3).toContain('Inside loop level 3 (nested)');
    });

    it('gracefully handles unclosed LOOP_START and orphan LOOP_END without crashing', () => {
      const brokenBlocks: CodeBlock[] = [
        createCurriculumBlock('LOOP_END', undefined, undefined, 'orphan_end'),
        createCurriculumBlock('LOOP_START', 3, undefined, 'matched_start'),
        createCurriculumBlock('MOVE_FWD', undefined, undefined, 'matched_body'),
        createCurriculumBlock('LOOP_END', undefined, undefined, 'matched_end'),
        createCurriculumBlock('LOOP_START', 2, undefined, 'unclosed_start'),
      ];

      const analysis = computeLoopNestingMetadata(brokenBlocks);
      expect(analysis.matchedSpans).toHaveLength(1);
      expect(analysis.matchedSpans[0]).toMatchObject({
        startIndex: 1,
        endIndex: 3,
        depth: 1,
      });

      useAppStore.setState({ workspace: emptyWorkspace(brokenBlocks) });
      const html = renderToStaticMarkup(React.createElement(WorkspaceCanvas));
      expect(html).toContain('data-testid="loop-error-banner"');
      expect(html).toContain('unmatched loop');
      expect(html).toContain('Inside loop level 1');
    });

    it('renders live 1/4..4/4 loop-iteration-badge on active LOOP_START in WorkspaceCanvas and BlockItem', () => {
      const blocks: CodeBlock[] = [
        createCurriculumBlock('LOOP_START', 4, undefined, 'iter_ls'),
        createCurriculumBlock('MOVE_FWD', undefined, undefined, 'iter_body'),
        createCurriculumBlock('LOOP_END', undefined, undefined, 'iter_le'),
      ];
      const runtime = {
        ...createInitialInterpreterState(),
        status: 'PAUSED' as const,
        activeBlockId: blocks[1].id,
        loopStack: [
          {
            scope: 'MAIN' as const,
            loopStartPc: 0,
            currentIteration: 1,
            totalIterations: 4,
          },
        ],
      };

      useAppStore.setState({
        activeActivityId: '3.0',
        activeDemoTabIndex: 1,
        workspace: emptyWorkspace(blocks),
        runtime,
      });

      const canvasHtml = renderToStaticMarkup(React.createElement(WorkspaceCanvas));
      expect(canvasHtml).toContain('data-testid="loop-iteration-badge"');
      expect(canvasHtml).toContain('iteration 1 of 4');
      expect(canvasHtml).toContain(
        '<span data-testid="iteration-current" class="text-amber-400 font-extrabold">1</span>'
      );
      expect(canvasHtml).toContain(
        '<span data-testid="iteration-total" class="text-slate-100 font-bold">4</span>'
      );

      // Standalone BlockItem SSR check for 4/4
      const itemHtml = renderToStaticMarkup(
        React.createElement(BlockItem, {
          block: blocks[0],
          index: 0,
          scope: 'MAIN',
          isActive: false,
          iterationProgress: { current: 4, total: 4 },
        })
      );
      expect(itemHtml).toContain('data-testid="loop-iteration-badge"');
      expect(itemHtml).toContain('iteration 4 of 4');
    });
  });

  describe('Lesson 3.0 — How Loop Start & Loop End Work (Interactive Comparison Demo)', () => {
    it('runs both 3.0 demo tabs on the shared 6×5 map and steps 1/4 -> 4/4 before exiting past LOOP_END', () => {
      const activity = getActivityLatest('3.0');
      expect(activity).toBeDefined();
      expect(activity?.moduleId).toBe('module-3');
      expect(activity?.format).toBe('explanation');
      expect(activity?.simId).toBe('grid');
      expect(activity?.icon).toBe('📖');
      expect(activity?.demoTabs).toHaveLength(2);

      const [tab1, tab2] = activity!.demoTabs!;
      expect(tab1.gridState?.width).toBe(6);
      expect(tab1.gridState?.height).toBe(5);
      expect(tab2.gridState?.width).toBe(6);
      expect(tab2.gridState?.height).toBe(5);
      expect(tab1.gridState).toEqual(tab2.gridState);
      expect(tab1.spotlights).toEqual(['execution-order', 'loop-counter']);
      expect(tab2.spotlights).toEqual(['execution-order', 'loop-counter']);

      // Tab [1]: 8 unrolled blocks reaching Goal
      expect(tab1.workspace.MAIN).toHaveLength(8);
      expect(
        tab1.workspace.MAIN.some(
          (b) => b.type === 'LOOP_START' || b.type === 'LOOP_END'
        )
      ).toBe(false);
      const run1 = runGridWorkspaceToCompletion(
        tab1.workspace,
        createCurriculumGridState(tab1.gridState!)
      );
      expect(run1.status).toBe('SUCCESS');

      // Tab [2]: Compact Loop ×4 pattern stepping 1/4 -> 2/4 -> 3/4 -> 4/4 and exiting past LOOP_END
      expect(tab2.workspace.MAIN.length).toBeGreaterThanOrEqual(4);
      expect(tab2.workspace.MAIN.length).toBeLessThanOrEqual(6);
      expect(tab2.workspace.MAIN[0].type).toBe('LOOP_START');
      expect(tab2.workspace.MAIN[0].repeatCount).toBe(4);

      const run2 = runGridWorkspaceToCompletion(
        tab2.workspace,
        createCurriculumGridState(tab2.gridState!)
      );
      expect(run2.status).toBe('SUCCESS');
      expect(run2.observedLoopIterations).toEqual(['1/4', '2/4', '3/4', '4/4']);
      expect(run2.exitedPastLoopEnd).toBe(true);

      // Verify DemoSpotlightOverlay renders loop-counter spotlight cleanly on Tab [2]
      const simGrid = createCurriculumGridState(tab2.gridState!);
      const firstTick = tickInterpreter(
        createInitialInterpreterState(),
        tab2.workspace,
        simGrid,
        gridSimulationEnvironment
      );
      const overlayHtml = renderToStaticMarkup(
        React.createElement(DemoSpotlightOverlay, {
          grid: firstTick.nextGrid,
          spotlightsOverride: tab2.spotlights,
          runtimeOverride: firstTick.nextRuntime,
          workspaceOverride: tab2.workspace,
        })
      );
      expect(overlayHtml).toContain('data-testid="spotlight-loop-counter"');
      expect(overlayHtml).toContain('↻1/4');
    });
  });

  describe('Lessons 3.1 & 3.2 — Validated Robot Loop Puzzles, Scaffolds & < 200 ms Anti-Bypass Proofs', () => {
    it('proves Lesson 3.1 (5×5, 5-slot tray) passes reference + scaffold and has 0 loop-free bypasses (< 200 ms)', () => {
      const activity = getActivityLatest('3.1');
      expect(activity).toBeDefined();
      expect(activity?.grid?.width).toBe(5);
      expect(activity?.grid?.height).toBe(5);
      expect(activity?.slotCap?.maxTotal).toBe(5);
      expect(activity?.palette.allowRepeatBadges).toBe(true);
      expect(activity?.palette.allowActionParams).toBe(false);
      expect(activity?.referenceSolution?.MAIN).toHaveLength(5);

      // Scaffold pauses cleanly on PLACEHOLDER
      const scaffold = activity!.partialHelp?.scaffoldWorkspace;
      expect(activity?.partialHelp?.mode).toBe('scaffold');
      expect(scaffold).toBeDefined();
      expect(scaffold!.MAIN.some((b) => b.type === 'PLACEHOLDER')).toBe(true);
      const scaffoldRun = runGridWorkspaceToCompletion(
        scaffold!,
        createCurriculumGridState(activity!.grid!)
      );
      expect(scaffoldRun.status).toBe('PAUSED');

      // Automated constraint solver proof (< 200 ms)
      const report = verifyActivityConstraints(activity!);
      expect(report.referenceCheck.passed, report.referenceCheck.reason).toBe(true);
      expect(report.scaffoldCheck.passed, report.scaffoldCheck.reason).toBe(true);
      expect(report.passed).toBe(true);
      expect(report.elapsedMs).toBeLessThan(200);
      expect(report.ruleResults).toHaveLength(1);
      expect(report.ruleResults[0].passed).toBe(true);
      expect(report.ruleResults[0].counterexampleWorkspace).toBeUndefined();
    });

    it('proves Lesson 3.2 (6×5, 7-slot tray) requires BOTH a loop AND steps outside the loop (< 200 ms)', () => {
      const activity = getActivityLatest('3.2');
      expect(activity).toBeDefined();
      expect(activity?.grid?.width).toBe(6);
      expect(activity?.grid?.height).toBe(5);
      expect(activity?.slotCap?.maxTotal).toBe(7);
      expect(activity?.palette.allowRepeatBadges).toBe(true);
      expect(activity?.palette.allowActionParams).toBe(false);
      expect(activity?.referenceSolution?.MAIN.length).toBeGreaterThanOrEqual(6);
      expect(activity?.referenceSolution?.MAIN.length).toBeLessThanOrEqual(7);

      // Scaffold pauses cleanly on PLACEHOLDER
      const scaffold = activity!.partialHelp?.scaffoldWorkspace;
      expect(activity?.partialHelp?.mode).toBe('scaffold');
      expect(scaffold).toBeDefined();
      expect(scaffold!.MAIN.some((b) => b.type === 'PLACEHOLDER')).toBe(true);
      const scaffoldRun = runGridWorkspaceToCompletion(
        scaffold!,
        createCurriculumGridState(activity!.grid!)
      );
      expect(scaffoldRun.status).toBe('PAUSED');

      // Automated constraint solver proofs (< 200 ms):
      // 1) maxLoopNestingDepth: 0 -> 0 solutions
      // 2) pureSingleLoopOnly: true -> 0 solutions
      const report = verifyActivityConstraints(activity!);
      expect(report.referenceCheck.passed, report.referenceCheck.reason).toBe(true);
      expect(report.scaffoldCheck.passed, report.scaffoldCheck.reason).toBe(true);
      expect(report.passed).toBe(true);
      expect(report.elapsedMs).toBeLessThan(200);
      expect(report.ruleResults).toHaveLength(2);

      const noLoopRule = report.ruleResults.find(
        (r) => r.ruleId === '3.2-require-loop'
      );
      const pureSingleLoopRule = report.ruleResults.find(
        (r) => r.ruleId === '3.2-require-outside-loop-steps'
      );
      expect(noLoopRule?.passed).toBe(true);
      expect(pureSingleLoopRule?.passed).toBe(true);
    });
  });

  describe('Lesson 3.3 — Closed Polygons & Star Loops (Turtle LOGO Sandbox & Variations)', () => {
    it('renders non-empty SVG paths for 3.3 5-star starter and all 3 star/sun variations and round-trips binary saves', () => {
      const activity = getActivityLatest('3.3');
      expect(activity).toBeDefined();
      expect(activity?.moduleId).toBe('module-3');
      expect(activity?.format).toBe('sandbox');
      expect(activity?.simId).toBe('turtle');
      expect(activity?.icon).toBe('🐢');
      expect(activity?.palette.allowRepeatBadges).toBe(true);
      expect(activity?.palette.allowActionParams).toBe(true);
      expect(activity?.palette.allowedControlBlocks).toEqual([
        'LOOP_START',
        'LOOP_END',
      ]);
      expect(activity?.variations).toHaveLength(3);

      const allowedSet = new Set([
        ...(activity!.palette.allowedSimBlocks ?? []),
        ...(activity!.palette.allowedControlBlocks ?? []),
      ]);

      const workspacesToVerify = [
        { label: 'starter (5-pointed star)', ws: activity!.starterWorkspace! },
        ...activity!.variations!.map((v) => ({ label: v.title, ws: v.workspace })),
      ];

      for (const item of workspacesToVerify) {
        expect(item.ws.MAIN.length).toBeGreaterThanOrEqual(4);
        expect(item.ws.MAIN.length).toBeLessThanOrEqual(8);
        expect(validateLoopStructure(item.ws.MAIN).hasError).toBe(false);

        for (const blk of item.ws.MAIN) {
          expect(allowedSet.has(blk.type), `${item.label}: ${blk.type}`).toBe(true);
          if (typeof blk.repeatCount === 'number') {
            expect(blk.repeatCount).toBeGreaterThanOrEqual(2);
            expect(blk.repeatCount).toBeLessThanOrEqual(9);
          }
        }

        const preview = renderTurtleVariationPreview(item.ws);
        expect(preview.finalState.paths.length, item.label).toBeGreaterThanOrEqual(5);
        expect(preview.svgMarkup).toContain('<line');
        expect(preview.thumbnailUrl.startsWith('data:image/svg+xml')).toBe(true);

        // Verify binary serialization round-trip (OP_LOOP_START / OP_LOOP_END + Turtle params)
        const encoded = exportLessonToString(item.ws, 'turtle', '3.3', 1);
        const decoded = importFromString(encoded);
        expect(decoded.success).toBe(true);
        if (decoded.success) {
          expect(decoded.envId).toBe('lesson');
          expect(decoded.lessonId).toBe('3.3');
          expect(decoded.lessonVersion).toBe(1);
          expect(decoded.workspace.MAIN.map((b) => b.type)).toEqual(
            item.ws.MAIN.map((b) => b.type)
          );
        }
      }

      // Catalog registration check
      expect(MODULE_3_PART1_ACTIVITIES.map((a) => a.id)).toEqual([
        '3.0',
        '3.1',
        '3.2',
        '3.3',
      ]);
      expect(getActivitiesForModule('module-3').map((a) => a.id)).toEqual([
        '3.0',
        '3.1',
        '3.2',
        '3.3',
      ]);
      expect(CURRICULUM_ACTIVITIES.some((a) => a.id === '3.3')).toBe(true);
    });
  });
});
