// @ts-expect-error Untyped ESM curriculum tooling modules under scripts/curriculum/
import { countFlatBlocks, countScopesFlatBlocks, formatPseudocode, parsePseudocode } from '../scripts/curriculum/lib/sim_core.mjs';
// @ts-expect-error Untyped ESM curriculum tooling module
import { renderLogoSvg, simulateLogo } from '../scripts/curriculum/render_logo_svg.mjs';
// @ts-expect-error Untyped ESM curriculum tooling module
import { renderGridAscii, verifyPuzzleSpec } from '../scripts/curriculum/verify_puzzle_trace.mjs';
// @ts-expect-error Untyped ESM curriculum tooling module
import { auditCurriculumDocs, inspectSvgMetrics } from '../scripts/curriculum/audit_curriculum_docs.mjs';
import { describe, expect, it } from 'vitest';

describe('curriculum tooling: sim_core pseudocode & block counting', () => {
  it('computes closer-inclusive flat block counts across containers and scopes', () => {
    const ast = {
      MAIN: [
        {
          op: 'LOOP_START',
          count: 4,
          body: [
            { op: 'CALL_FN', fn: 'F1', args: [100] },
            {
              op: 'IF',
              cond: { op: 'SENSOR', sensor: 'pathAhead' },
              then: [{ op: 'MOVE_FWD' }],
              elseIfs: [
                { cond: { op: 'SENSOR', sensor: 'pathRight' }, body: [{ op: 'TURN_RIGHT' }] },
              ],
              else: [{ op: 'TURN_LEFT' }],
            },
          ],
        },
      ],
      F1: [{ op: 'FORWARD', length: '$p0' }],
    };

    // IF = 2 + 1 (then) + (1 + 1 elseIf) + (1 + 1 else) = 7
    // LOOP = 2 + (1 CALL_FN + 7 IF) = 10
    expect(countFlatBlocks(ast.MAIN)).toBe(10);
    expect(countScopesFlatBlocks(ast)).toEqual({
      byScope: { MAIN: 10, F1: 1 },
      total: 11,
    });
  });

  it('round-trips canonical pseudocode to JSON AST and back cleanly', () => {
    const source = [
      '// MAIN',
      'a = 100',
      'On Tap -> F1',
      'Loop [×4]',
      '  Call F1(a, blue)',
      '  TURN_RIGHT [90]',
      'End Loop',
      'If (NOT stationEmpty [STACK_1] AND $topValue > 5)',
      '  Send [red, a]',
      'Else If (pathLeft)',
      '  Barrier',
      'ELSE',
      '  Fork F2(50)',
      'End If',
      'Join',
      '',
      '// F1(●, ▲)',
      'SET_PEN_COLOR [▲]',
      'FORWARD [●]',
    ].join('\n');

    const parsed = parsePseudocode(source);
    expect(parsed.signatures.F1).toEqual(['$p0', '$p1']);
    expect(parsed.scopes.MAIN[1]).toEqual({ op: 'ON_EVENT', event: 'TAP', fn: 'F1' });
    expect(parsed.scopes.F1).toEqual([
      { op: 'SET_PEN_COLOR', color: '$p1' },
      { op: 'FORWARD', length: '$p0' },
    ]);

    // Ensure format -> parse preserves exact structural AST
    const reformatted = formatPseudocode(parsed.scopes, parsed.signatures);
    const reparsed = parsePseudocode(reformatted);
    expect(reparsed).toEqual(parsed);
  });
});

describe('curriculum tooling: render_logo_svg', () => {
  it('uses 100px default step length, expands canvas bounds dynamically, and emits static Frame-1 SVGs', () => {
    const simSquare = simulateLogo({
      MAIN: [
        {
          op: 'LOOP_START',
          count: 4,
          body: [
            { op: 'FORWARD' },
            { op: 'TURN_RIGHT', angle: 90 },
          ],
        },
      ],
    });
    expect(simSquare.status).toBe('OK');
    expect(simSquare.pathCount).toBe(4);
    expect(simSquare.inkBounds.inkWidth).toBe(100);
    expect(simSquare.inkBounds.inkHeight).toBe(100);
    expect(simSquare.scaleWarning).toBe(true); // 100px < 160px visibility floor

    const { svg, metrics } = renderLogoSvg({
      MAIN: [
        {
          op: 'LOOP_START',
          count: 4,
          body: [
            { op: 'FORWARD', length: 200 },
            { op: 'TURN_RIGHT', angle: 90 },
          ],
        },
      ],
    });
    expect(metrics.status).toBe('OK');
    expect(metrics.inkBounds.inkMaxSpan).toBe(200);
    expect(metrics.scaleWarning).toBe(false);
    expect(svg).not.toMatch(/<animate/i);
  });

  it('supports curved arcs, sparse tape skylines, and multi-worker FORK pose cloning', () => {
    const arcRender = renderLogoSvg({
      MAIN: [{ op: 'ARC_RIGHT', radius: 120, angle: 180 }],
    });
    expect(arcRender.metrics.status).toBe('OK');
    expect(arcRender.metrics.inkBounds.inkMaxSpan).toBe(240);
    expect(arcRender.metrics.scaleWarning).toBe(false);

    const skylineRender = renderLogoSvg({
      tape: [120, 180, 140],
      MAIN: [
        { op: 'TAPE_SEEK', index: 1 },
        {
          op: 'WHILE',
          cond: { op: 'NOT', expr: { op: 'SENSOR', sensor: '$cellEmpty' } },
          body: [
            { op: 'FORWARD', length: '$cellValue' },
            { op: 'BACKWARD', length: '$cellValue' },
            { op: 'PEN_UP' },
            { op: 'TURN_RIGHT', angle: 90 },
            { op: 'FORWARD', length: 80 },
            { op: 'TURN_LEFT', angle: 90 },
            { op: 'PEN_DOWN' },
            { op: 'TAPE_STEP', direction: 'RIGHT' },
          ],
        },
      ],
    });
    expect(skylineRender.metrics.status).toBe('OK');
    expect(skylineRender.metrics.inkBounds.inkWidth).toBeGreaterThanOrEqual(160);
    expect(skylineRender.metrics.inkBounds.inkHeight).toBe(180);

    const explicitTapeSim = simulateLogo({
      tape: { length: 6, cells: { 1: 120, 2: 180, 3: 140 } },
      MAIN: [
        { op: 'TAPE_SEEK', index: 2 },
        { op: 'FORWARD', length: '$cellValue' },
      ],
    });
    expect(explicitTapeSim.status).toBe('OK');
    expect(explicitTapeSim.inkBounds.inkHeight).toBe(180);

    const multiWorker = renderLogoSvg(`
// MAIN_1
FORWARD [200]
Fork F1(160)

// MAIN_2
TURN_LEFT [90]
FORWARD [180]

// F1(●)
TURN_RIGHT [45]
FORWARD [●]
    `);
    expect(multiWorker.metrics.status).toBe('OK');
    expect(multiWorker.metrics.pathCount).toBe(3);
    // Proves FORK cloned MAIN_1's (0, -200) pose before turning +45 deg and drawing 160px
    expect(multiWorker.metrics.inkBounds.inkHeight).toBeGreaterThan(250);
    const polygonMatches = multiWorker.svg.match(/<polygon\b/g) || [];
    expect(polygonMatches.length).toBe(2);
  });
});

describe('curriculum tooling: verify_puzzle_trace', () => {
  it('verifies multi-variant Robot Grid puzzles, partialHelp failure, and ASCII diagrams', () => {
    const gridSpec = {
      id: 'test.grid.branch',
      env: 'grid',
      slotCap: 8,
      width: 3,
      height: 2,
      barriers: ['V(1,1)'],
      variants: [
        {
          id: 'open-east',
          startPose: { x: 0, y: 0, facing: 'E' },
          goal: { x: 1, y: 0 },
        },
        {
          id: 'turn-south',
          startPose: { x: 0, y: 0, facing: 'E' },
          barriers: ['V(1,0)'],
          goal: { x: 0, y: 1 },
        },
      ],
      partialHelp: {
        MAIN: [{ op: 'MOVE_FWD' }],
      },
      referenceSolution: {
        MAIN: [
          {
            op: 'IF',
            cond: { op: 'SENSOR', sensor: 'pathAhead' },
            then: [{ op: 'MOVE_FWD' }],
            else: [{ op: 'TURN_RIGHT' }, { op: 'MOVE_FWD' }],
          },
        ],
      },
    };

    const report = verifyPuzzleSpec(gridSpec);
    expect(report.allPassed).toBe(true);
    expect(report.slotCapOk).toBe(true);
    expect(report.variants.map((v: { status: string }) => v.status)).toEqual(['SUCCESS', 'SUCCESS']);
    expect(report.partialHelpStatus).toBe('SUCCESS'); // passes variant 0 only, proving why variant 1 is required

    const ascii = renderGridAscii({ ...gridSpec, ...gridSpec.variants[0] });
    expect(ascii).toContain('RE ');
    expect(ascii).toContain(' G ');
  });

  it('verifies multi-variant Depot puzzles and enforces empty-station TYPE_ERROR guards', () => {
    const depotSpec = {
      id: 'test.depot.filter',
      env: 'depot',
      slotCap: 10,
      variants: [
        {
          id: 'v1',
          stacks: [[2, 8], [], []],
          targetStacks: [[], [], []],
          targetOutput: [8, 2],
        },
        {
          id: 'v2-empty',
          stacks: [[], [], []],
          targetStacks: [[], [], []],
          targetOutput: [],
        },
      ],
      partialHelp: `
// MAIN
While ($topValue > 0)
  DEPOT_GRAB [STACK_1]
  DEPOT_SEND_OUT [OUT]
End While
      `,
      referenceSolution: `
// MAIN
While (NOT stationEmpty [STACK_1] AND $topValue > 0)
  DEPOT_GRAB [STACK_1]
  DEPOT_SEND_OUT [OUT]
End While
      `,
    };

    const report = verifyPuzzleSpec(depotSpec);
    expect(report.allPassed).toBe(true);
    expect(report.variants[1].output).toEqual([]);

    // Unguarded $topValue on empty STACK_1 triggers TYPE_ERROR in variant 1
    const unguarded = verifyPuzzleSpec({
      ...depotSpec,
      variants: [depotSpec.variants[1]],
      referenceSolution: depotSpec.partialHelp,
    });
    expect(unguarded.variants[0].status).toBe('TYPE_ERROR');
  });

  it('verifies multi-variant Rail Switchyard streams and scrap rules', () => {
    const switchyardSpec = {
      id: 'test.switchyard.sort',
      env: 'switchyard',
      switchCount: 1,
      dockRules: [
        { acceptColors: ['red'] },
        { acceptColors: ['blue'] },
      ],
      variants: [
        {
          id: 'stream-1',
          stream: [
            { color: 'red', damaged: false },
            { color: 'blue', damaged: true },
            { color: 'blue', damaged: false },
          ],
        },
        {
          id: 'stream-2',
          stream: [
            { color: 'blue', damaged: false },
            { color: 'red', damaged: false },
          ],
        },
      ],
      referenceSolution: `
// MAIN
While (hasNextItem)
  If (itemDamaged)
    SCRAP_ITEM
  Else If (itemColor == #ef4444)
    SWITCH_LEFT [A]
    SEND_NEXT
  ELSE
    SWITCH_RIGHT [A]
    SEND_NEXT
  End If
End While
      `,
    };

    const report = verifyPuzzleSpec(switchyardSpec);
    expect(report.allPassed).toBe(true);
    expect(report.variants.map((v: { status: string }) => v.status)).toEqual(['SUCCESS', 'SUCCESS']);
  });
});

describe('curriculum tooling: audit_curriculum_docs', () => {
  it('inspects SVG animation and ink span bounds accurately', () => {
    const goodArcSvg =
      '<svg viewBox="0 0 300 300"><rect width="300" height="300" fill="#ffffff" stroke="#e2e8f0" /><g transform="translate(150, 150)"><path d="M 0 -100 A 100 100 0 1 1 -100 0" fill="none" stroke="#3b82f6" /></g></svg>';
    expect(inspectSvgMetrics(goodArcSvg)).toMatchObject({
      hasAnimation: false,
      inkWidth: 200,
      inkHeight: 200,
      inkMaxSpan: 200,
    });

    const tinyAnimatedSvg =
      '<svg viewBox="0 0 100 100"><animate attributeName="opacity" from="0" to="1" /><line x1="0" y1="0" x2="60" y2="0" stroke="#0f172a" /></svg>';
    expect(inspectSvgMetrics(tinyAnimatedSvg)).toMatchObject({
      hasAnimation: true,
      inkMaxSpan: 60,
    });
  });

  it('passes strict-stage2 audit across all finished Stage 2 modules (seq through cmp)', () => {
    const report = auditCurriculumDocs({
      modules: ['seq', 'param', 'loop', 'func', 'branch', 'while', 'var', 'cmp'],
      strictStage2: true,
    });
    expect(report.passed).toBe(true);
    expect(report.totals.brokenLinks).toBe(0);
    expect(report.totals.orphanSvgs).toBe(0);
    expect(report.totals.animatedSvgs).toBe(0);
    expect(report.totals.tinySvgs).toBe(0);
    expect(report.totals.stage1Placeholders).toBe(0);
    expect(report.totals.jsonErrors).toBe(0);
    expect(report.totals.slotCapMismatches).toBe(0);
  });
});
