import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  CURRICULUM_ACTIVITIES,
  CURRICULUM_MODULES,
  ConditionExpr,
  CurriculumActivity,
  resolveModuleIdAlias,
  resolveActivityIdAlias,
} from '../src/data/curriculum';
import {
  CURRICULUM_SIDE_TRACK_PREREQUISITES,
  getModulePrerequisites,
  isModuleDagUnlocked,
  computeStagedPalettePolicy,
} from '../src/utils/curriculumStagePolicy';
import { BinaryWriter } from '../src/engine/serialization/binaryWriter';
import { BinaryReader } from '../src/engine/serialization/binaryReader';
import {
  ENV_ID_TURTLE,
  COLOR_LITERAL_FLAG,
  SENSOR_REF_FLAG,
  encodeVarOrSensorIndex,
  decodeVarOrSensorIndex,
} from '../src/engine/serialization/types';
import {
  COND_TAG_CMP,
  COND_TAG_KEY_HELD,
  writeConditionExpr,
  readConditionExpr,
} from '../src/engine/serialization/conditionSerializer';
import {
  SCOPE_TO_ID_MAP,
  writeCodeScopes,
  readCodeScopes,
} from '../src/engine/serialization/codeScopes';
import {
  exportLessonCodeOnly,
} from '../src/engine/serialization/codeSerializer';
import {
  deserializeProfileBackupFromBinary,
} from '../src/engine/serialization/profileSerializer';
import {
  createInitialInterpreterState,
  enqueueInterpreterEvent,
  tickInterpreter,
} from '../src/engine/interpreter';
import { runHeadlessSimulation } from '../src/engine/simulationRunner';
import { createInitialDepotState } from '../src/simulations/depot/depotPhysics';
import { createInitialSwitchyardState } from '../src/simulations/switchyard/physics';
import { createInitialBeatState } from '../src/simulations/beat/beatEnvironment';
import { createInitialTurtleState } from '../src/simulations/turtle/turtleEnvironment';
import { createDefaultGridState } from '../src/simulations/grid/gridEnvironment';
import {
  useAppStore,
  isTerminalErrorStatus,
  TERMINAL_ERROR_STATUSES,
} from '../src/store/useAppStore';
import { SimulationTopLeftHud } from '../src/components/SimulationTopLeftHud';
import { MultiRunPipsBarView } from '../src/components/MultiRunPipsBar';
import { VariableWatchOverlay } from '../src/components/VariableWatchOverlay';
import { BlockSubpalette } from '../src/components/BlockSubpalette';
import { ConditionBadge } from '../src/components/ConditionBadge';
import { InteractiveControlsBar } from '../src/components/InteractiveControlsBar';
import { ExplanationDemoBar } from '../src/components/ExplanationDemoBar';
import { Toolbar } from '../src/components/Toolbar';
import {
  SensorVisual,
  SwitchyardJunctionVisual,
  TileDialGlyphSvg,
} from '../src/components/params/VisualParamBadges';
import { clearAllSavedPrograms, saveProgram } from '../src/services/localSaveService';
import {
  DEFAULT_PROFILE_ID,
  ensureProfilesInitialized,
  exportProfileBackupToBinary,
  resetAllProfileDataForTests,
} from '../src/services/profileService';
import { SimulationStatus, TypedValue, VariableName, WorkspaceState } from '../src/types';

function makeEmptyWorkspace(overrides: Partial<WorkspaceState> = {}): WorkspaceState {
  return {
    MAIN: [],
    F1: [],
    F2: [],
    F3: [],
    ...overrides,
  };
}

describe('Wave 3A: Phase 3 Platform (TypedValue, 0x30 CMP, Sensors, Interactive Events, DemoTab & DAG)', () => {
  beforeEach(() => {
    clearAllSavedPrograms();
    resetAllProfileDataForTests();
    ensureProfilesInitialized();
    const store = useAppStore.getState();
    store.pause();
    store.setAppMode('sandbox');
    store.setSimEnvironment('grid');
    useAppStore.setState({
      activeVariables: {},
      heldKeys: [],
      pointerState: { x: 0, y: 0, isDown: false },
      selectedBlockId: null,
    });
  });

  describe('1. TypedValue Runtime, /, %, Loop ×[0], TYPE_ERROR & MATH_ERROR', () => {
    it('evaluates +, -, *, float64 /, and integer % on TypedValue numbers', () => {
      const ws = makeEmptyWorkspace({
        MAIN: [
          { id: 'b1', type: 'VAR_OP', params: { a: 'a', b: 7, op: '/', c: 2 } },
          { id: 'b2', type: 'VAR_OP', params: { a: 'b', b: 17, op: '%', c: 5 } },
          { id: 'b3', type: 'VAR_OP', params: { a: 'c', b: 'a', op: '*', c: 4 } },
        ],
      });

      const res = runHeadlessSimulation(ws, 'turtle', createInitialTurtleState());
      expect(res.status).not.toBe('MATH_ERROR');
      expect(res.status).not.toBe('TYPE_ERROR');
      expect(res.finalRuntime.variables['a' as VariableName]).toBeCloseTo(3.5, 6);
      expect(res.finalRuntime.variables['b' as VariableName]).toBe(2);
      expect(res.finalRuntime.variables['c' as VariableName]).toBeCloseTo(14, 6);
    });

    it('terminates with MATH_ERROR on division by zero (/ 0) and modulo by zero (% 0)', () => {
      const divZeroWs = makeEmptyWorkspace({
        MAIN: [
          { id: 'd0', type: 'VAR_OP', params: { a: 'a', b: 10, op: '/', c: 0 } },
        ],
      });
      const modZeroWs = makeEmptyWorkspace({
        MAIN: [
          { id: 'm0', type: 'VAR_OP', params: { a: 'a', b: 10, op: '%', c: 0 } },
        ],
      });

      expect(runHeadlessSimulation(divZeroWs, 'turtle', createInitialTurtleState()).status).toBe('MATH_ERROR');
      expect(runHeadlessSimulation(modZeroWs, 'turtle', createInitialTurtleState()).status).toBe('MATH_ERROR');
    });

    it('stores TypedValue colors and terminates with TYPE_ERROR on cross-type arithmetic or color repeat counts', () => {
      const colorAssignWs = makeEmptyWorkspace({
        MAIN: [
          { id: 'c1', type: 'VAR_ASSIGN', params: { a: 'a', b: 'color:purple' } },
          { id: 'c2', type: 'SET_PEN_COLOR', params: { color: '$a' } },
          { id: 'c3', type: 'FORWARD', params: { length: 40 } },
        ],
      });
      const okRes = runHeadlessSimulation(colorAssignWs, 'turtle', createInitialTurtleState());
      expect(okRes.status).not.toBe('TYPE_ERROR');
      expect(okRes.finalRuntime.variables['a' as VariableName]).toEqual({ type: 'color', value: 'purple' });

      // Cross-type arithmetic: color + number -> TYPE_ERROR
      const badMathWs = makeEmptyWorkspace({
        MAIN: [
          { id: 'bm1', type: 'VAR_OP', params: { a: 'b', b: 'a', op: '+', c: 1 } },
        ],
      });
      const badMathRes = runHeadlessSimulation(badMathWs, 'turtle', createInitialTurtleState(), 500, {
        initialVars: { a: { type: 'color', value: 'red' } },
      });
      expect(badMathRes.status).toBe('TYPE_ERROR');

      // Loop ×[colorVar] -> TYPE_ERROR
      const badLoopWs = makeEmptyWorkspace({
        MAIN: [
          { id: 'bl1', type: 'LOOP_START', repeatCount: 'a' as VariableName },
          { id: 'bl2', type: 'FORWARD', params: { length: 20 } },
          { id: 'bl3', type: 'LOOP_END' },
        ],
      });
      const badLoopRes = runHeadlessSimulation(badLoopWs, 'turtle', createInitialTurtleState(), 500, {
        initialVars: { a: { type: 'color', value: 'blue' } },
      });
      expect(badLoopRes.status).toBe('TYPE_ERROR');
    });

    it('executes 0 iterations cleanly for Loop ×[0] (literal & variable) and round-trips repeatCount=0 in binary', () => {
      const zeroLoopWs = makeEmptyWorkspace({
        MAIN: [
          { id: 'l0', type: 'LOOP_START', repeatCount: 0 },
          { id: 'l1', type: 'VAR_ASSIGN', params: { a: 'a', b: 99 } },
          { id: 'l2', type: 'LOOP_END' },
          { id: 'l3', type: 'LOOP_START', repeatCount: 'n' as VariableName },
          { id: 'l4', type: 'VAR_ASSIGN', params: { a: 'a', b: 88 } },
          { id: 'l5', type: 'LOOP_END' },
        ],
      });

      const res = runHeadlessSimulation(zeroLoopWs, 'turtle', createInitialTurtleState(), 500, {
        initialVars: { a: 5, n: 0 },
      });
      expect(res.finalRuntime.variables['a' as VariableName]).toBe(5);
      expect(res.status).not.toBe('TYPE_ERROR');
      expect(res.status).not.toBe('COLLISION');

      const writer = new BinaryWriter();
      writeCodeScopes(writer, zeroLoopWs, ENV_ID_TURTLE);
      const decoded = readCodeScopes(new BinaryReader(writer.getBytes()), ENV_ID_TURTLE);
      expect(decoded.MAIN[0].repeatCount).toBe(0);
    });
  });

  describe('2. Distinct Terminal Failure Statuses Across Runner, HUD, MultiRunPipsBar & ProfileSerializer', () => {
    it('propagates STACK_OVERFLOW and STEP_LIMIT without collapsing to COLLISION', () => {
      const recursiveWs = makeEmptyWorkspace({
        MAIN: [{ id: 'm1', type: 'CALL_F1' }],
        F1: [{ id: 'f1', type: 'CALL_F1' }],
      });
      const stackRes = runHeadlessSimulation(recursiveWs, 'turtle', createInitialTurtleState(), 5000);
      expect(stackRes.status).toBe('STACK_OVERFLOW');

      const infWhileWs = makeEmptyWorkspace({
        MAIN: [
          { id: 'w1', type: 'WHILE', params: { condition: { kind: 'cmp', op: '=', left: 1, right: 1 } } },
          { id: 'w2', type: 'VAR_ASSIGN', params: { a: 'a', b: 1 } },
          { id: 'w3', type: 'END_WHILE' },
        ],
      });
      const stepRes = runHeadlessSimulation(infWhileWs, 'turtle', createInitialTurtleState(), 10005);
      expect(stepRes.status).toBe('STEP_LIMIT');
    });

    it('renders zero-reading HUD badges & MultiRunPipsBar failure pips for all 5 Phase 3 error statuses', () => {
      const expectedBadges: Array<{ status: SimulationStatus; testId: string; glyph: string }> = [
        { status: 'TYPE_ERROR', testId: 'hud-type-error-badge', glyph: '🎨≠#' },
        { status: 'MATH_ERROR', testId: 'hud-math-error-badge', glyph: '🧮÷0' },
        { status: 'STACK_OVERFLOW', testId: 'hud-stack-overflow-badge', glyph: '📚💥' },
        { status: 'STEP_LIMIT', testId: 'hud-step-limit-badge', glyph: '⏳🔁' },
        { status: 'DEADLOCK', testId: 'hud-deadlock-badge', glyph: '🔒💥' },
      ];

      for (const item of expectedBadges) {
        expect(isTerminalErrorStatus(item.status)).toBe(true);
        expect(TERMINAL_ERROR_STATUSES.has(item.status)).toBe(true);
        const hudHtml = renderToStaticMarkup(
          React.createElement(SimulationTopLeftHud, { status: item.status })
        );
        expect(hudHtml).toContain(`data-testid="${item.testId}"`);
        expect(hudHtml).toContain(item.glyph);
      }

      const pipsHtml = renderToStaticMarkup(
        React.createElement(MultiRunPipsBarView, {
          variants: [
            { index: 0, kind: 'grid', status: 'SUCCESS' },
            { index: 1, kind: 'grid', status: 'TYPE_ERROR' },
            { index: 2, kind: 'grid', status: 'MATH_ERROR' },
            { index: 3, kind: 'grid', status: 'STACK_OVERFLOW' },
            { index: 4, kind: 'grid', status: 'DEADLOCK' },
            { index: 5, kind: 'grid', status: 'STEP_LIMIT' },
          ],
          focusedIndex: 1,
          onSelectVariant: () => {},
        })
      );
      expect(pipsHtml).toContain('data-variant-status="TYPE_ERROR"');
      expect(pipsHtml).toContain('data-variant-status="MATH_ERROR"');
      expect(pipsHtml).toContain('data-variant-status="STACK_OVERFLOW"');
      expect(pipsHtml).toContain('data-variant-status="DEADLOCK"');
      expect(pipsHtml).toContain('data-variant-status="STEP_LIMIT"');
      expect((pipsHtml.match(/lucide-x/g) ?? []).length).toBe(4);
      expect(pipsHtml).toContain('⏳🔁');
    });

    it('maps all terminal error statuses to status code 2 in binary profileSerializer', () => {
      const simpleCode = exportLessonCodeOnly(
        makeEmptyWorkspace({ MAIN: [{ id: '1', type: 'FORWARD', params: { length: 50 } }] }),
        'turtle'
      );
      const terminalStatuses: SimulationStatus[] = [
        'TYPE_ERROR',
        'MATH_ERROR',
        'STACK_OVERFLOW',
        'STEP_LIMIT',
        'DEADLOCK',
      ];
      terminalStatuses.forEach((st, idx) => {
        saveProgram({
          title: `Err ${st}`,
          profileId: DEFAULT_PROFILE_ID,
          simId: 'turtle',
          code: simpleCode,
          screenshot: '',
          status: st,
          stepCount: idx + 1,
          lessonId: '1.2',
          lessonVersion: 1,
          slotIndex: idx + 1,
          createdAt: 1700002000000 + idx,
        });
      });

      const bytes = exportProfileBackupToBinary(DEFAULT_PROFILE_ID);
      const decoded = deserializeProfileBackupFromBinary(bytes);
      expect(decoded.savedPrograms.length).toBe(terminalStatuses.length);
      for (const prog of decoded.savedPrograms) {
        expect(prog.status).toBe('COLLISION');
      }
    });
  });

  describe('3. 0x30 COND_TAG_CMP, 0x2E keyHeld & Short-Circuit AND/OR', () => {
    it('round-trips 0x30 COND_TAG_CMP across all 6 ops, int16, float32, color literals, and indexed sensors', () => {
      const cases: ConditionExpr[] = [
        { kind: 'cmp', op: '=', left: 'a', right: -12 },
        { kind: 'cmp', op: '!=', left: 'color:blue', right: '$heldColor' },
        { kind: 'cmp', op: '<', left: '$itemWeight', right: 8 },
        { kind: 'cmp', op: '<=', left: '$dockCount[1]', right: '$dockQuota[1]' },
        { kind: 'cmp', op: '>', left: '$heldValue', right: '$topValue[STACK_2]' },
        { kind: 'cmp', op: '>=', left: 'a', right: 2.5 },
        { kind: 'keyHeld', key: 'UP' },
        { kind: 'keyHeld', key: 'B' },
      ];

      for (const expr of cases) {
        const w = new BinaryWriter();
        writeConditionExpr(w, expr);
        const bytes = w.getBytes();
        expect(bytes[0]).toBe(expr.kind === 'cmp' ? COND_TAG_CMP : COND_TAG_KEY_HELD);
        const r = new BinaryReader(bytes);
        const out = readConditionExpr(r);
        if (expr.kind === 'cmp' && typeof expr.right === 'number' && !Number.isInteger(expr.right)) {
          expect(out.kind).toBe('cmp');
          if (out.kind === 'cmp') {
            expect(out.op).toBe(expr.op);
            expect(out.left).toBe(expr.left);
            expect(Number(out.right)).toBeCloseTo(expr.right, 5);
          }
        } else {
          expect(out).toEqual(expr);
        }
      }

      // Also accepts '$a' and '$topValue[2]' shorthand and normalizes cleanly on decode
      const wShorthand = new BinaryWriter();
      writeConditionExpr(wShorthand, { kind: 'cmp', op: '<', left: '$a', right: '$topValue[2]' });
      expect(readConditionExpr(new BinaryReader(wShorthand.getBytes()))).toEqual({
        kind: 'cmp',
        op: '<',
        left: 'a',
        right: '$topValue[STACK_2]',
      });

      expect(COLOR_LITERAL_FLAG).toBe(0x40);
      expect(SENSOR_REF_FLAG).toBe(0x80);
    });

    it('short-circuits OR and AND so empty-stack $topValue is guarded cleanly without TYPE_ERROR', () => {
      // Depot: crate with value 5 on IN; Stack 1 is empty
      const depotInit = createInitialDepotState({
        workerStation: 'IN',
        input: [{ id: 'c1', color: 'BLUE', icon: 'GEAR', value: 5 } as any],
        stacks: [[], [], []],
      });

      // Grab crate from IN, then check: stationEmpty(STACK_1) OR $heldValue > $topValue[1]
      const safeHanoiWs = makeEmptyWorkspace({
        MAIN: [
          { id: 'g1', type: 'DEPOT_GRAB' },
          {
            id: 'if1',
            type: 'IF',
            params: {
              condition: {
                kind: 'or',
                left: { kind: 'sensor', sensor: 'stationEmpty', param: 'STACK_1' },
                right: { kind: 'cmp', op: '>', left: '$heldValue', right: '$topValue[1]' },
              },
            },
          },
          { id: 'v1', type: 'VAR_ASSIGN', params: { a: 'a', b: 1 } },
          { id: 'ei1', type: 'END_IF' },
        ],
      });

      const safeRes = runHeadlessSimulation(safeHanoiWs, 'depot', depotInit);
      expect(safeRes.status).not.toBe('TYPE_ERROR');
      expect(safeRes.finalRuntime.variables['a' as VariableName]).toBe(1);

      // Without short-circuit guard, $heldValue > $topValue[1] on empty Stack 1 yields TYPE_ERROR
      const unguardedWs = makeEmptyWorkspace({
        MAIN: [
          { id: 'g1', type: 'DEPOT_GRAB' },
          {
            id: 'if1',
            type: 'IF',
            params: {
              condition: { kind: 'cmp', op: '>', left: '$heldValue', right: '$topValue[1]' },
            },
          },
          { id: 'ei1', type: 'END_IF' },
        ],
      });
      expect(runHeadlessSimulation(unguardedWs, 'depot', depotInit).status).toBe('TYPE_ERROR');

      // Short-circuit AND: hasItem AND $heldValue = 5 when claw is empty -> false (no TYPE_ERROR)
      const safeAndWs = makeEmptyWorkspace({
        MAIN: [
          {
            id: 'if_and',
            type: 'IF',
            params: {
              condition: {
                kind: 'and',
                left: { kind: 'sensor', sensor: 'hasItem' },
                right: { kind: 'cmp', op: '=', left: '$heldValue', right: 5 },
              },
            },
          },
          { id: 'v_never', type: 'VAR_ASSIGN', params: { a: 'a', b: 99 } },
          { id: 'ei_and', type: 'END_IF' },
          { id: 'v_ok', type: 'VAR_ASSIGN', params: { a: 'b', b: 7 } },
        ],
      });
      const safeAndRes = runHeadlessSimulation(safeAndWs, 'depot', depotInit);
      expect(safeAndRes.status).not.toBe('TYPE_ERROR');
      expect(safeAndRes.finalRuntime.variables['a' as VariableName]).toBeUndefined();
      expect(safeAndRes.finalRuntime.variables['b' as VariableName]).toBe(7);
    });
  });

  describe('4. Full SENSOR_REF_FLAG Table (0x84..0xB2) & Deterministic Seeded 🎲 PRNG', () => {
    it('encodes and decodes all Phase 3 sensor bytes (0x84..0xB2) and evaluates env sensors', () => {
      const expectedBytes: Array<[string, number]> = [
        ['$input', 0x84],
        ['$randCoin', 0x85],
        ['$randD4', 0x86],
        ['$randD6', 0x87],
        ['$randD8', 0x88],
        ['$randD20', 0x89],
        ['$rand01', 0x8a],
        ['$randomColor', 0x8b],
        ['$pointerX', 0x93],
        ['$pointerY', 0x94],
        ['$pointerDown', 0x95],
        ['$heldValue', 0xa0],
        ['$topValue', 0xa1],
        ['$heldColor', 0xa2],
        ['$topColor', 0xa3],
        ['$stationLen', 0xa4],
        ['$itemWeight', 0xa8],
        ['$itemColor', 0xa9],
        ['$dockQuota', 0xaa],
        ['$dockCount', 0xab],
        ['$cursorX', 0xb0],
        ['$cursorY', 0xb1],
        ['$beatIndex', 0xb2],
      ];

      for (const [name, code] of expectedBytes) {
        expect(encodeVarOrSensorIndex(name)).toBe(code);
        expect(decodeVarOrSensorIndex(code)).toBe(name);
      }

      // Switchyard sensors: $itemWeight, $itemColor, $dockQuota[0], $dockCount[0]
      const syState = createInitialSwitchyardState({
        initialQueue: [
          { id: 'car1', color: 'GREEN', icon: 'CRATE', weight: 9 },
          { id: 'car2', color: 'GREEN', icon: 'CRATE', weight: 4 },
        ],
        initialDockSpecs: [{ id: 'DOCK_A', quota: 2 }, { id: 'DOCK_B', quota: 0 }],
        initialSwitchDirections: ['LEFT'],
      });
      const syWs = makeEmptyWorkspace({
        MAIN: [
          { id: 's1', type: 'VAR_ASSIGN', params: { a: 'a', b: '$itemWeight' } },
          { id: 's2', type: 'VAR_ASSIGN', params: { a: 'b', b: '$itemColor' } },
          { id: 's3', type: 'VAR_ASSIGN', params: { a: 'c', b: '$dockQuota[0]' } },
          { id: 's4', type: 'SEND_NEXT' },
          { id: 's5', type: 'VAR_ASSIGN', params: { a: 's', b: '$dockCount[0]' } },
        ],
      });
      const syRes = runHeadlessSimulation(syWs, 'switchyard', syState);
      expect(syRes.finalRuntime.variables['a' as VariableName]).toBe(9);
      expect(syRes.finalRuntime.variables['b' as VariableName]).toEqual({ type: 'color', value: 'green' });
      expect(syRes.finalRuntime.variables['c' as VariableName]).toBe(2);
      expect(syRes.finalRuntime.variables['s' as VariableName]).toBe(1);

      // Beat & Pointer sensors
      const beatWs = makeEmptyWorkspace({
        MAIN: [
          { id: 'p1', type: 'VAR_ASSIGN', params: { a: 'x', b: '$pointerX' } },
          { id: 'p2', type: 'VAR_ASSIGN', params: { a: 'y', b: '$pointerDown' } },
          { id: 'p3', type: 'VAR_ASSIGN', params: { a: 'a', b: '$cursorX' } },
          { id: 'p4', type: 'VAR_ASSIGN', params: { a: 'b', b: '$beatIndex' } },
        ],
      });
      const beatRes = runHeadlessSimulation(beatWs, 'beat', createInitialBeatState(), 200, {
        pointer: { x: 120, y: 240, isDown: true },
      });
      expect(beatRes.finalRuntime.variables['x' as VariableName]).toBe(120);
      expect(beatRes.finalRuntime.variables['y' as VariableName]).toBe(1);
      expect(typeof beatRes.finalRuntime.variables['a' as VariableName]).toBe('number');
      expect(typeof beatRes.finalRuntime.variables['b' as VariableName]).toBe('number');
    });

    it('produces deterministic seeded Mulberry32 outputs for 0x85..0x8B 🎲 sensors', () => {
      const diceWs = makeEmptyWorkspace({
        MAIN: [
          { id: 'r1', type: 'VAR_ASSIGN', params: { a: 'a', b: '$randCoin' } },
          { id: 'r2', type: 'VAR_ASSIGN', params: { a: 'b', b: '$randD6' } },
          { id: 'r3', type: 'VAR_ASSIGN', params: { a: 'c', b: '$randD20' } },
          { id: 'r4', type: 'VAR_ASSIGN', params: { a: 's', b: '$rand01' } },
          { id: 'r5', type: 'VAR_ASSIGN', params: { a: 'p', b: '$randomColor' } },
        ],
      });

      const runA = runHeadlessSimulation(diceWs, 'turtle', createInitialTurtleState(), 200, { seed: 424242 });
      const runB = runHeadlessSimulation(diceWs, 'turtle', createInitialTurtleState(), 200, { seed: 424242 });
      const runC = runHeadlessSimulation(diceWs, 'turtle', createInitialTurtleState(), 200, { seed: 987654 });

      expect(runA.finalRuntime.variables).toEqual(runB.finalRuntime.variables);
      expect(runA.finalRuntime.variables).not.toEqual(runC.finalRuntime.variables);
      expect([0, 1]).toContain(runA.finalRuntime.variables['a' as VariableName]);
      expect(Number(runA.finalRuntime.variables['b' as VariableName])).toBeGreaterThanOrEqual(1);
      expect(Number(runA.finalRuntime.variables['b' as VariableName])).toBeLessThanOrEqual(6);
      expect(Number(runA.finalRuntime.variables['c' as VariableName])).toBeGreaterThanOrEqual(1);
      expect(Number(runA.finalRuntime.variables['c' as VariableName])).toBeLessThanOrEqual(20);
      expect(Number(runA.finalRuntime.variables['s' as VariableName])).toBeGreaterThanOrEqual(0);
      expect(Number(runA.finalRuntime.variables['s' as VariableName])).toBeLessThan(1);
      expect((runA.finalRuntime.variables['p' as VariableName] as TypedValue).type).toBe('color');
    });
  });

  describe('5. Event Scopes (0x40..0x46), Queued Dispatch & InteractiveControlsBar', () => {
    it('serializes 0x40..0x46 event scopes and drains queued interactive handlers single-threaded', () => {
      expect(SCOPE_TO_ID_MAP.ON_TAP).toBe(0x40);
      expect(SCOPE_TO_ID_MAP.ON_KEY_UP).toBe(0x41);
      expect(SCOPE_TO_ID_MAP.ON_KEY_DOWN).toBe(0x42);
      expect(SCOPE_TO_ID_MAP.ON_KEY_LEFT).toBe(0x43);
      expect(SCOPE_TO_ID_MAP.ON_KEY_RIGHT).toBe(0x44);
      expect(SCOPE_TO_ID_MAP.ON_KEY_A).toBe(0x45);
      expect(SCOPE_TO_ID_MAP.ON_KEY_B).toBe(0x46);

      const interactiveWs = makeEmptyWorkspace({
        MAIN: [{ id: 'm1', type: 'VAR_ASSIGN', params: { a: 'a', b: 10 } }],
        ON_TAP: [{ id: 't1', type: 'VAR_OP', params: { a: 'a', b: 'a', op: '+', c: 5 } }],
        ON_KEY_A: [{ id: 'k1', type: 'VAR_OP', params: { a: 'a', b: 'a', op: '*', c: 2 } }],
      });

      const writer = new BinaryWriter();
      writeCodeScopes(writer, interactiveWs, ENV_ID_TURTLE);
      const roundTripped = readCodeScopes(new BinaryReader(writer.getBytes()), ENV_ID_TURTLE);
      expect(roundTripped.ON_TAP).toHaveLength(1);
      expect(roundTripped.ON_KEY_A).toHaveLength(1);

      let sim = createInitialTurtleState();
      const turtleEnv = {
        executeAction: (_b: any, st: any) => ({ nextState: st }),
      };
      let rt = createInitialInterpreterState();
      rt = enqueueInterpreterEvent(rt, 'ON_TAP');
      rt = enqueueInterpreterEvent(rt, 'ON_KEY_A');

      let guard = 0;
      while (guard < 30) {
        const step = tickInterpreter(rt, interactiveWs, sim, turtleEnv as any);
        rt = step.nextRuntime;
        sim = step.nextGrid;
        guard++;
        if (step.done) break;
      }

      // MAIN sets a=10 -> ON_TAP adds 5 (15) -> ON_KEY_A multiplies by 2 (30)
      expect(rt.variables['a' as VariableName]).toBe(30);
      expect(rt.eventQueue).toEqual([]);
    });

    it('renders InteractiveControlsBar only when interactive scopes or keyHeld are active and keeps Toolbar single-row', () => {
      // Inactive in plain grid workspace
      expect(renderToStaticMarkup(React.createElement(InteractiveControlsBar))).toBe('');

      // Active when ON_TAP has blocks
      useAppStore.setState({
        workspace: makeEmptyWorkspace({
          ON_TAP: [{ id: 'tap1', type: 'FORWARD', params: { length: 20 } }],
        }),
      });
      const activeHtml = renderToStaticMarkup(React.createElement(InteractiveControlsBar));
      expect(activeHtml).toContain('data-testid="interactive-controls-bar"');
      expect(activeHtml).toContain('data-testid="btn-interactive-tap"');
      expect(activeHtml).toContain('data-testid="btn-interactive-key-a"');
      expect(activeHtml).toContain('data-testid="btn-interactive-key-b"');

      // Toolbar header never embeds interactive D-pad controls
      const toolbarHtml = renderToStaticMarkup(React.createElement(Toolbar));
      expect(toolbarHtml).not.toContain('data-testid="interactive-controls-bar"');
      expect(toolbarHtml).not.toContain('data-testid="btn-interactive-key-a"');

      // Store setKeyHeld updates heldKeys and evaluates keyHeld condition
      useAppStore.getState().setKeyHeld('RIGHT', true);
      expect(useAppStore.getState().heldKeys).toContain('RIGHT');
      const keyRes = runHeadlessSimulation(
        makeEmptyWorkspace({
          MAIN: [
            { id: 'kh1', type: 'IF', params: { condition: { kind: 'keyHeld', key: 'RIGHT' } } },
            { id: 'kh2', type: 'VAR_ASSIGN', params: { a: 'a', b: 1 } },
            { id: 'kh3', type: 'END_IF' },
          ],
        }),
        'turtle',
        createInitialTurtleState(),
        100,
        { heldKeys: useAppStore.getState().heldKeys }
      );
      expect(keyRes.finalRuntime.variables['a' as VariableName]).toBe(1);
    });
  });

  describe('6. Multi-Env DemoTab, coPilotCard, UI Rulings (#300/#301), Aliases & cmp ==> inter DAG', () => {
    it('switches simulation environments, initialVars, and coPilotCard cleanly across multi-env DemoTabs', () => {
      const multiEnvDemo: CurriculumActivity = {
        id: 'var.demo.multi',
        version: 1,
        moduleId: 'loop',
        format: 'explanation',
        simId: 'turtle',
        icon: '📦',
        title: 'Multi-Env Demo',
        concept: 'variables',
        coPilotCard: 'Activity fallback tip.',
        palette: { allowedSimBlocks: ['FORWARD'], allowedControlBlocks: ['VAR_ASSIGN'] },
        demoTabs: [
          {
            id: 'tab-turtle',
            icon: '🐢',
            simId: 'turtle',
            coPilotCard: 'Turtle variable box.',
            initialVars: { a: 50 },
            turtle: { mode: 'live', clearBetweenFrames: true },
            workspace: makeEmptyWorkspace({
              MAIN: [{ id: 't1', type: 'FORWARD', params: { length: 'a' } }],
            }),
          },
          {
            id: 'tab-grid',
            icon: '🤖',
            simId: 'grid',
            coPilotCard: 'Grid dial box.',
            initialVars: { a: { type: 'color', value: 'green' } },
            grid: {
              ...createDefaultGridState(),
              width: 4,
              height: 4,
              robot: { x: 0, y: 0, dir: 'EAST', initialX: 0, initialY: 0, initialDir: 'EAST' },
            },
            workspace: makeEmptyWorkspace({
              MAIN: [{ id: 'g1', type: 'MOVE_FWD' }],
            }),
          },
          {
            id: 'tab-sy',
            icon: '🚂',
            simId: 'switchyard',
            coPilotCard: 'Switchyard weight scale.',
            switchyard: {
              mode: 'balance_scale',
              scaleTolerance: 1,
              initialQueue: [{ color: 'RED', icon: 'CRATE', weight: 5 }],
              initialDockSpecs: [{ id: 'DOCK_A' }, { id: 'DOCK_B' }],
              initialSwitchDirections: ['LEFT'],
            },
            workspace: makeEmptyWorkspace({
              MAIN: [{ id: 's1', type: 'SEND_NEXT' }],
            }),
          },
        ],
      };

      CURRICULUM_ACTIVITIES.push(multiEnvDemo);
      try {
        const store = useAppStore.getState();
        store.setCurriculumActivity('var.demo.multi');

        let st = useAppStore.getState();
        expect(st.activeSimId).toBe('turtle');
        expect(st.activeVariables?.a).toBe(50);

        const barTab0 = renderToStaticMarkup(React.createElement(ExplanationDemoBar));
        expect(barTab0).toContain('data-testid="copilot-card-banner"');
        expect(barTab0).toContain('Turtle variable box.');

        store.selectExplanationDemoTab(1);
        st = useAppStore.getState();
        expect(st.activeSimId).toBe('grid');
        expect(st.activeVariables?.a).toEqual({ type: 'color', value: 'green' });
        expect(renderToStaticMarkup(React.createElement(ExplanationDemoBar))).toContain('Grid dial box.');
        store.step();
        expect(useAppStore.getState().runtime?.variables['a' as VariableName]).toEqual({
          type: 'color',
          value: 'green',
        });

        store.selectExplanationDemoTab(2);
        st = useAppStore.getState();
        expect(st.activeSimId).toBe('switchyard');
        expect(renderToStaticMarkup(React.createElement(ExplanationDemoBar))).toContain('Switchyard weight scale.');
      } finally {
        const idx = CURRICULUM_ACTIVITIES.indexOf(multiEnvDemo);
        if (idx >= 0) CURRICULUM_ACTIVITIES.splice(idx, 1);
      }
    });

    it('caps Turtle Live (mode="live") synchronous batch ticks at 3000 steps per frame without locking the UI', () => {
      const liveTurtleAct: CurriculumActivity = {
        id: 'inter.turtle.live',
        version: 1,
        moduleId: 'while',
        format: 'creative',
        simId: 'turtle',
        icon: '♾️',
        title: 'Live Turtle Ticker',
        concept: 'inter',
        turtle: { mode: 'live', clearBetweenFrames: false },
        palette: { allowedSimBlocks: ['SET_INSTANT', 'FORWARD'], allowedControlBlocks: ['WHILE', 'VAR_OP'] },
        starterWorkspace: makeEmptyWorkspace({
          MAIN: [
            { id: 'inst', type: 'SET_INSTANT', params: { mode: 'on' } },
            { id: 'w_live', type: 'WHILE', params: { condition: { kind: 'cmp', op: '=', left: 1, right: 1 } } },
            { id: 'op_live', type: 'VAR_OP', params: { a: 'a', b: 'a', op: '+', c: 1 } },
            { id: 'ew_live', type: 'END_WHILE' },
          ],
        }),
      };

      CURRICULUM_ACTIVITIES.push(liveTurtleAct);
      try {
        const store = useAppStore.getState();
        store.setCurriculumActivity('inter.turtle.live');
        store.play();
        const afterBatch = useAppStore.getState();
        store.pause();
        expect(afterBatch.runtime?.stepCount).toBe(3000);
        expect(afterBatch.runtime?.status).toBe('RUNNING');
      } finally {
        useAppStore.getState().pause();
        const idx = CURRICULUM_ACTIVITIES.indexOf(liveTurtleAct);
        if (idx >= 0) CURRICULUM_ACTIVITIES.splice(idx, 1);
      }
    });

    it('verifies #301 rotary $tileDial, #300 Switchyard [C]/sensor chips, VariableWatchOverlay swatches & dynamic BlockSubpalette', () => {
      // VariableWatchOverlay color swatch + TYPE_ERROR bounce cue
      useAppStore.setState({
        activeVariables: { a: { type: 'color', value: 'purple' }, b: 42 },
        runtime: { ...createInitialInterpreterState(undefined, { a: { type: 'color', value: 'purple' }, b: 42 }), status: 'TYPE_ERROR' },
      });
      const watchHtml = renderToStaticMarkup(React.createElement(VariableWatchOverlay));
      expect(watchHtml).toContain('data-testid="var-color-swatch-a"');
      expect(watchHtml).toContain('animate-bounce');

      // #301 rotary $tileDial & preserved 🎛️ $input
      expect(renderToStaticMarkup(React.createElement(TileDialGlyphSvg))).toContain('data-testid="tile-dial-glyph"');
      expect(renderToStaticMarkup(React.createElement(SensorVisual, { sensorId: '$tileDial' }))).toContain(
        'data-testid="tile-dial-glyph"'
      );
      expect(
        renderToStaticMarkup(
          React.createElement(ConditionBadge, {
            condition: { kind: 'cmp', op: '=', left: '$input', right: 1 },
          })
        )
      ).toContain('🎛️');

      // #300 Switchyard [C] junction & weight/quota/count badges
      expect(
        renderToStaticMarkup(React.createElement(SwitchyardJunctionVisual, { junction: 'C' }))
      ).toContain('[C]');
      expect(renderToStaticMarkup(React.createElement(SensorVisual, { sensorId: '$itemWeight' }))).toContain('⚖️');
      expect(renderToStaticMarkup(React.createElement(SensorVisual, { sensorId: '$dockQuota[1]' }))).toContain('🎯[B]');
      expect(renderToStaticMarkup(React.createElement(SensorVisual, { sensorId: '$dockCount[2]' }))).toContain('📊[C]');

      // Dynamic BlockSubpalette merges currentSimEnv.sensors + 🎲 presets on VAR_ASSIGN
      const s = useAppStore.getState();
      s.setAppMode('sandbox');
      s.setSimEnvironment('depot');
      useAppStore.setState({
        workspace: makeEmptyWorkspace({
          MAIN: [{ id: 'sv1', type: 'VAR_ASSIGN', params: { a: 'a', b: 0 } }],
        }),
        selectedBlockId: 'sv1',
      });
      const subHtml = renderToStaticMarkup(React.createElement(BlockSubpalette));
      expect(subHtml).toContain('data-testid="subpalette-assign-b-sensor-$randD6"');
    });

    it('enforces cmp ==> inter Side-Track DAG readiness and preserves Phase 2 6-module / 89-activity catalog + legacy aliases', () => {
      expect(CURRICULUM_MODULES).toHaveLength(6);
      expect(CURRICULUM_ACTIVITIES).toHaveLength(89);

      expect(resolveModuleIdAlias('module-6')).toBe('var');
      expect(resolveModuleIdAlias('module-7')).toBe('cmp');
      expect(resolveModuleIdAlias('module-8')).toBe('inter');
      expect(resolveActivityIdAlias('6.0')).toBe('var.0');
      expect(resolveActivityIdAlias('6.8')).toBe('var.8');
      expect(resolveActivityIdAlias('7.3')).toBe('cmp.3');

      expect(CURRICULUM_SIDE_TRACK_PREREQUISITES.inter).toEqual(['cmp']);
      expect(getModulePrerequisites('inter')).toEqual(['cmp']);
      expect(isModuleDagUnlocked('inter', new Set(['seq', 'param', 'loop', 'func', 'branch', 'while', 'var']))).toBe(
        false
      );
      expect(
        isModuleDagUnlocked('inter', new Set(['seq', 'param', 'loop', 'func', 'branch', 'while', 'var', 'cmp']))
      ).toBe(true);

      const policy = computeStagedPalettePolicy(
        'curriculum',
        {
          id: 'cmp.policy.test',
          version: 1,
          moduleId: 'cmp',
          format: 'puzzle',
          simId: 'turtle',
          icon: '⚖️',
          title: 'Policy Test',
          concept: 'cmp',
          palette: {
            allowedSimBlocks: ['FORWARD'],
            allowedControlBlocks: ['IF', 'VAR_OP'],
            allowedVarOps: ['+', '-', '*', '/', '%'],
            allowedCmpOps: ['=', '!=', '<', '<=', '>', '>='],
            allowInteractiveEvents: true,
          },
        },
        []
      );
      expect(policy.allowedCmpOps).toEqual(['=', '!=', '<', '<=', '>', '>=']);
      expect(policy.allowInteractiveEvents).toBe(true);
    });
  });
});
