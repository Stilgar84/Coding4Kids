import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyDepotAction,
  createInitialDepotState,
  evaluateDepotCompletion,
  readDepotNumericSensor,
  readDepotTypedSensor,
  resetDepotState,
} from '../src/simulations/depot/depotPhysics';
import {
  DEPOT_PALETTE_ITEMS,
  DEPOT_SENSORS,
  depotSimulationEnvironment,
} from '../src/simulations/depot/depotEnvironment';
import {
  DepotCanvas,
  computeDepotAnimDurationMs,
  computeDepotStationTravelPx,
} from '../src/simulations/depot/components/DepotCanvas';
import { renderDepotWorkshopSvg } from '../src/simulations/depot/depotThumbnail';
import { renderDepotMapSvg } from '../src/services/mapThumbnailGenerator';
import { DEPOT_STATION_BITS, DepotState } from '../src/simulations/depot/types';
import {
  exportToBinary,
  exportToString,
  importFromBinary,
  importFromString,
} from '../src/engine/serialization/codeSerializer';
import { ENV_ID_DEPOT, ENV_VERSION_DEPOT_V4 } from '../src/engine/serialization/types';
import { runHeadlessSimulation } from '../src/engine/simulationRunner';
import {
  checkDepotReferenceSolution,
  verifyDepotActivityRule,
} from '../src/engine/verification/depotConstraintSolver';
import { CurriculumActivity } from '../src/data/curriculum/types';
import { useAppStore } from '../src/store/useAppStore';
import { WorkspaceState } from '../src/types';

function makeEmptyWorkspace(overrides?: Partial<WorkspaceState>): WorkspaceState {
  return {
    MAIN: [],
    F1: [],
    F2: [],
    F3: [],
    ...overrides,
  };
}

describe('Wave 3B Depot Phase 3 (Numbered Toy Blocks, Typed Sensors, Dynamic Indexing & Solver)', () => {
  beforeEach(() => {
    const s = useAppStore.getState();
    s.setAppMode('sandbox');
    useAppStore.setState({
      activeSimId: 'depot',
      workspace: makeEmptyWorkspace(),
      speed: 400,
    });
  });

  describe('1. Numbered Toy Blocks & enforceHanoiRule Flag', () => {
    it('preserves numeric value across INPUT/QUEUE -> Claw -> STACK -> OUT and resetDepotState', () => {
      const init = createInitialDepotState({
        workerStation: 'INPUT',
        input: [
          { color: 'BLUE', value: 7 },
          { color: 'AMBER', value: 3 },
        ],
        stacks: [['RED'], [], []],
        stackValues: [[12], [], []],
        targetStacks: [['RED'], ['BLUE', 'AMBER'], []],
        targetStackValues: [[12], [7, 3], []],
        enforceHanoiRule: false,
        requireEmptyStacks: false,
        activeStationsMask:
          DEPOT_STATION_BITS.STACK_1 |
          DEPOT_STATION_BITS.STACK_2 |
          DEPOT_STATION_BITS.INPUT |
          DEPOT_STATION_BITS.OUT,
      });

      const g1 = applyDepotAction('DEPOT_GRAB', init);
      expect(g1.isCollision).toBe(false);
      expect(g1.nextState.heldCrate).toBe('BLUE');
      expect(g1.nextState.heldValue).toBe(7);

      const m1 = applyDepotAction('DEPOT_MOVE_TO', g1.nextState, { station: 'STACK_2' }).nextState;
      const p1 = applyDepotAction('DEPOT_PLACE', m1);
      expect(p1.isCollision).toBe(false);
      expect(p1.nextState.stackValues?.[1]).toEqual([7]);

      const mIn = applyDepotAction('DEPOT_MOVE_TO', p1.nextState, { station: 'INPUT' }).nextState;
      const g2 = applyDepotAction('DEPOT_GRAB', mIn).nextState;
      expect(g2.heldValue).toBe(3);

      const m2 = applyDepotAction('DEPOT_MOVE_TO', g2, { station: 'STACK_2' }).nextState;
      const p2 = applyDepotAction('DEPOT_PLACE', m2);
      expect(p2.isSuccess).toBe(true);
      expect(evaluateDepotCompletion(p2.nextState)).toBe('SUCCESS');
      expect(p2.nextState.stackValues).toEqual([[12], [7, 3], []]);

      // Grabbing back from STACK_2 restores heldValue = 3 (LIFO top)
      const regrab = applyDepotAction('DEPOT_GRAB', p2.nextState);
      expect(regrab.nextState.heldValue).toBe(3);
      expect(regrab.nextState.stackValues?.[1]).toEqual([7]);

      // Reset restores initialStackValues cleanly
      const reset = resetDepotState(regrab.nextState);
      expect(reset.stacks).toEqual([['RED'], [], []]);
      expect(reset.stackValues).toEqual([[12], [], []]);
      expect(reset.heldValue).toBeUndefined();
    });

    it('allows stacking larger blocks on smaller when enforceHanoiRule=false, and rejects when enforceHanoiRule=true', () => {
      const relaxed = createInitialDepotState({
        workerStation: 'INPUT',
        input: [{ color: 'RED', value: 9 }],
        stacks: [['BLUE'], [], []],
        stackValues: [[4], [], []],
        enforceHanoiRule: false,
      });
      const rGrab = applyDepotAction('DEPOT_GRAB', relaxed).nextState;
      const rMove = applyDepotAction('DEPOT_MOVE_TO', rGrab, { station: 'STACK_1' }).nextState;
      const rPlace = applyDepotAction('DEPOT_PLACE', rMove);
      expect(rPlace.isCollision).toBe(false);
      expect(rPlace.nextState.stackValues?.[0]).toEqual([4, 9]);

      const strict = createInitialDepotState({
        workerStation: 'INPUT',
        input: [{ color: 'RED', value: 9 }],
        stacks: [['BLUE'], [], []],
        stackValues: [[4], [], []],
        enforceHanoiRule: true,
      });
      const sGrab = applyDepotAction('DEPOT_GRAB', strict).nextState;
      const sMove = applyDepotAction('DEPOT_MOVE_TO', sGrab, { station: 'STACK_1' }).nextState;
      const sPlace = applyDepotAction('DEPOT_PLACE', sMove);
      expect(sPlace.isCollision).toBe(true);
      expect(sPlace.nextState.lastFailureReason).toBe('HANOI_VIOLATION');
    });

    it('enforces targetOutputValues ordering when configured', () => {
      const state = createInitialDepotState({
        workerStation: 'INPUT',
        input: [{ color: 'BLUE', value: 5 }],
        targetOutput: ['BLUE'],
        targetOutputValues: [8],
      });
      const grabbed = applyDepotAction('DEPOT_GRAB', state).nextState;
      const badOut = applyDepotAction('DEPOT_SEND_OUT', grabbed);
      expect(badOut.isCollision).toBe(true);
      expect(badOut.nextState.lastFailureReason).toBe('WRONG_OUTPUT_ORDER');
    });
  });

  describe('2. Phase 3 Typed Sensors ($heldValue, $topValue, $heldColor, $topColor, $stationLen)', () => {
    it('keeps DEPOT_SENSORS compatibility while registering Phase 3 value sensors on depotSimulationEnvironment', () => {
      expect(DEPOT_SENSORS.map((s) => s.id)).toEqual([
        '$stack1',
        '$stack2',
        '$stack3',
        '$out',
        'stationEmpty',
        'hasItem',
        '$heldColor',
        '$topColor',
      ]);
      const envSensorIds = depotSimulationEnvironment.sensors?.map((s) => s.id) ?? [];
      expect(envSensorIds).toContain('$heldValue');
      expect(envSensorIds).toContain('$topValue');
      expect(envSensorIds).toContain('$stationLen');
    });

    it('reads $heldValue, $topValue, $heldColor, $topColor, and $stationLen with strict undefined on missing payload/empty bay', () => {
      const state: DepotState = {
        ...createInitialDepotState({
          workerStation: 'STACK_1',
          stacks: [['RED', 'BLUE'], ['GREEN'], []],
          stackValues: [[4, 9], [undefined], []],
          input: [{ color: 'AMBER', value: 12 }],
          queue: [{ color: 'WHITE', value: 7, colorless: true }],
        }),
        heldCrate: 'PURPLE',
        heldValue: 15,
      };

      expect(readDepotTypedSensor('$heldValue', state)).toBe(15);
      expect(readDepotTypedSensor('$topValue', state)).toBe(9);
      expect(readDepotTypedSensor('$topValue[STACK_1]', state)).toBe(9);
      expect(readDepotTypedSensor('$topValue[1]', state)).toBe(9);
      expect(readDepotTypedSensor('$topValue[INPUT]', state)).toBe(12);
      expect(readDepotTypedSensor('$topValue[QUEUE]', state)).toBe(7);

      // Color-only item (value undefined) or empty stack -> undefined (not 0) -> triggers TYPE_ERROR
      expect(readDepotTypedSensor('$topValue[STACK_2]', state)).toBeUndefined();
      expect(readDepotTypedSensor('$topValue[STACK_3]', state)).toBeUndefined();
      expect(Number.isNaN(readDepotNumericSensor('$topValue[STACK_2]', state))).toBe(true);
      expect(Number.isNaN(readDepotNumericSensor('$topValue[STACK_3]', state))).toBe(true);

      // Colorless token -> $topColor[QUEUE] is undefined -> triggers TYPE_ERROR
      expect(readDepotTypedSensor('$topColor[QUEUE]', state)).toBeUndefined();
      expect(readDepotTypedSensor('$heldColor', state)).toEqual({ type: 'color', value: 'purple' });
      expect(readDepotTypedSensor('$topColor[STACK_1]', state)).toEqual({ type: 'color', value: 'blue' });
      expect(readDepotTypedSensor('$topColor[INPUT]', state)).toEqual({ type: 'color', value: 'amber' });

      // $stationLen with CURRENT & explicit station args
      expect(readDepotTypedSensor('$stationLen', state)).toBe(2);
      expect(readDepotTypedSensor('$stationLen[STACK_2]', state)).toBe(1);
      expect(readDepotTypedSensor('$stationLen[3]', state)).toBe(0);
      expect(readDepotTypedSensor('$stationLen[INPUT]', state)).toBe(1);
      expect(readDepotTypedSensor('$stationLen[QUEUE]', state)).toBe(1);
    });

    it('fires TYPE_ERROR via interpreter when reading $heldValue on empty claw or color-only ring, and succeeds with short-circuit OR', () => {
      const colorOnlyState = createInitialDepotState({
        workerStation: 'INPUT',
        input: [{ color: 'RED' }],
        stacks: [[], [], []],
      });

      const peekColorOnlyValueWs = makeEmptyWorkspace({
        MAIN: [
          { id: 'g1', type: 'DEPOT_GRAB' },
          {
            id: 'if1',
            type: 'IF',
            params: { condition: { kind: 'cmp', op: '>', left: '$heldValue', right: 3 } },
          },
          { id: 'ei1', type: 'END_IF' },
        ],
      });
      expect(runHeadlessSimulation(peekColorOnlyValueWs, 'depot', colorOnlyState).status).toBe(
        'TYPE_ERROR'
      );

      // Numberless/empty claw reading $heldColor -> TYPE_ERROR
      const emptyClawColorWs = makeEmptyWorkspace({
        MAIN: [
          {
            id: 'if1',
            type: 'IF',
            params: { condition: { kind: 'cmp', op: '=', left: '$heldColor', right: 'color:red' } },
          },
          { id: 'ei1', type: 'END_IF' },
        ],
      });
      expect(runHeadlessSimulation(emptyClawColorWs, 'depot', colorOnlyState).status).toBe(
        'TYPE_ERROR'
      );

      // Short-circuit OR safely compares $heldValue > $topValue[STACK_1] when STACK_1 is empty or populated
      const numberedInit = createInitialDepotState({
        workerStation: 'INPUT',
        input: [
          { color: 'BLUE', value: 9 },
          { color: 'RED', value: 4 },
        ],
        stacks: [[], [], []],
        enforceHanoiRule: false,
        requireEmptyStacks: false,
        targetOutput: ['RED'],
        targetOutputValues: [4],
      });
      const ws = makeEmptyWorkspace({
        MAIN: [
          {
            id: 'w1',
            type: 'WHILE',
            params: { condition: { kind: 'not', operand: { kind: 'sensor', sensor: 'stationEmpty', param: 'INPUT' } } },
          },
          { id: 'm0', type: 'DEPOT_MOVE_TO', params: { station: 'INPUT' } },
          { id: 'g1', type: 'DEPOT_GRAB' },
          {
            id: 'i1',
            type: 'IF',
            params: {
              condition: {
                kind: 'or',
                left: { kind: 'sensor', sensor: 'stationEmpty', param: 'STACK_1' },
                right: { kind: 'cmp', op: '>', left: '$heldValue', right: '$topValue[STACK_1]' },
              },
            },
          },
          { id: 'm1', type: 'DEPOT_MOVE_TO', params: { station: 'STACK_1' } },
          { id: 'p1', type: 'DEPOT_PLACE' },
          { id: 'e1', type: 'ELSE' },
          { id: 'o1', type: 'DEPOT_SEND_OUT' },
          { id: 'ei1', type: 'END_IF' },
          { id: 'ew1', type: 'END_WHILE' },
        ],
      });
      const res = runHeadlessSimulation(ws, 'depot', numberedInit);
      expect(res.status).toBe('SUCCESS');
      expect((res.finalState as DepotState).stackValues?.[0]).toEqual([9]);
      expect((res.finalState as DepotState).outputValues).toEqual([4]);
    });
  });

  describe('3. Dynamic DEPOT_MOVE_TO [a] Bounds (1..3) & OOB COLLISION', () => {
    it('routes 1..3 variable station targets cleanly and triggers COLLISION for < 1 or > 3', () => {
      const init = createInitialDepotState({
        stacks: [['RED'], ['BLUE'], ['GREEN']],
        stackValues: [[1], [2], [3]],
      });

      const move2Ws = makeEmptyWorkspace({
        MAIN: [
          { id: 'va', type: 'VAR_ASSIGN', params: { a: 'a', b: 2 } },
          { id: 'mv', type: 'DEPOT_MOVE_TO', params: { station: 'a' } },
          { id: 'gr', type: 'DEPOT_GRAB' },
        ],
      });
      const move2Res = runHeadlessSimulation(move2Ws, 'depot', init);
      expect(move2Res.status).not.toBe('COLLISION');
      expect((move2Res.finalState as DepotState).workerStation).toBe('STACK_2');
      expect((move2Res.finalState as DepotState).heldValue).toBe(2);
      expect((move2Res.finalState as DepotState).lastAction?.type).toBe('GRAB');

      for (const badIndex of [0, -1, 4, 99]) {
        const oobWs = makeEmptyWorkspace({
          MAIN: [
            { id: 'va', type: 'VAR_ASSIGN', params: { a: 'a', b: badIndex } },
            { id: 'mv', type: 'DEPOT_MOVE_TO', params: { station: 'a' } },
          ],
        });
        const oobRes = runHeadlessSimulation(oobWs, 'depot', init);
        expect(oobRes.status).toBe('COLLISION');
        const depotRes = oobRes.finalState as DepotState;
        expect(depotRes.lastFailureReason).toBe('INVALID_STATION');
        expect(depotRes.lastAction?.attemptedStationIndex).toBe(badIndex);
      }
    });
  });

  describe('4. DepotCanvas Phase 3 Rendering, Thumbnails & Stage A UX Preservation', () => {
    it('renders uniform-width numbered blocks vs Hanoi discs, Comparison Bridge, [2] pill, and TYPE_ERROR cue', () => {
      const numberedState = createInitialDepotState({
        workerStation: 'STACK_2',
        stacks: [['RED'], ['BLUE'], []],
        stackValues: [[4], [6], []],
        targetStacks: [['RED'], ['BLUE'], ['AMBER']],
        targetStackValues: [[4], [6], [9]],
        enforceHanoiRule: false,
      });
      const heldState: DepotState = {
        ...numberedState,
        heldCrate: 'AMBER',
        heldValue: 9,
        lastAction: {
          stepId: 1,
          type: 'MOVE',
          fromStation: 'STACK_1',
          toStation: 'STACK_2',
          attemptedStationIndex: 2,
        },
      };

      const cmpWs = makeEmptyWorkspace({
        MAIN: [
          {
            id: 'cmp_blk',
            type: 'IF',
            params: { condition: { kind: 'cmp', op: '>', left: '$heldValue', right: '$topValue[STACK_1]' } },
          },
          { id: 'ei', type: 'END_IF' },
        ],
      });
      useAppStore.setState({ workspace: cmpWs });

      const html = renderToStaticMarkup(
        React.createElement(DepotCanvas, {
          state: heldState,
          activeBlockId: 'cmp_blk',
          runtimeVariables: { a: 2 },
        })
      );
      expect(html).toContain('data-testid="depot-numbered-block"');
      expect(html).toContain('data-value="9"');
      expect(html).toContain('data-value="4"');
      expect(html).toContain('data-testid="depot-comparison-bridge"');
      expect(html).toContain('&gt;');
      expect(html).toContain('✓');
      expect(html).toContain('data-testid="depot-trolley-index-pill"');
      expect(html).toContain('[2]');
      // High-contrast opacity-80 dashed ghost block preserved
      expect(html).toContain('opacity-80');

      // Hanoi mode renders proportional discs
      const hanoiHtml = renderToStaticMarkup(
        React.createElement(DepotCanvas, {
          state: { ...heldState, enforceHanoiRule: true },
        })
      );
      expect(hanoiHtml).toContain('data-testid="depot-hanoi-disc"');

      // TYPE_ERROR renders bounce cue 🎨 ↔ # ∅
      const typeErrHtml = renderToStaticMarkup(
        React.createElement(DepotCanvas, {
          state: heldState,
          runtimeStatus: 'TYPE_ERROR',
        })
      );
      expect(typeErrHtml).toContain('data-testid="depot-type-error-cue"');
      expect(typeErrHtml).toContain('🎨 ↔ #');

      // INVALID_STATION renders bumper collision cue
      const oobState = applyDepotAction('DEPOT_MOVE_TO', numberedState, { station: 4 }).nextState;
      const oobHtml = renderToStaticMarkup(React.createElement(DepotCanvas, { state: oobState }));
      expect(oobHtml).toContain('data-testid="depot-bumper-collision"');
      expect(oobHtml).toContain('data-testid="status-collision"');
    });

    it('preserves Stage A UX fixes and crisp SVG thumbnails', () => {
      // Bidirectional arrow SVG on DEPOT_MOVE_TO palette item
      const moveItem = DEPOT_PALETTE_ITEMS.find((p) => p.actionType === 'DEPOT_MOVE_TO');
      const iconHtml = renderToStaticMarkup(
        React.createElement(moveItem!.icon as React.ComponentType<{ isActive?: boolean }>, {
          isActive: false,
        })
      );
      expect(iconHtml).toContain('<svg');
      expect(iconHtml).toContain('M4 15 L20 15');

      // Speed-scaled durations
      expect(computeDepotAnimDurationMs(400, false, true)).toBe(1350);
      expect(computeDepotAnimDurationMs(100, false, true)).toBe(585);
      expect(computeDepotAnimDurationMs(25, false, true)).toBe(230);
      expect(computeDepotAnimDurationMs('instant', false, true)).toBe(0);

      // Travel physics & in-flight place ring
      const travel = computeDepotStationTravelPx({
        stepId: 1,
        type: 'PLACE',
        fromStation: 'STACK_1',
        toStation: 'STACK_1',
        stackIndex: 0,
        stackSlotIndex: 0,
      });
      expect(travel.placeDistPx).toBeGreaterThan(0);

      const placedState = applyDepotAction('DEPOT_PLACE', {
        ...createInitialDepotState({ stacks: [[], [], []] }),
        heldCrate: 'RED',
        heldValue: 5,
      }).nextState;
      const animHtml = renderToStaticMarkup(React.createElement(DepotCanvas, { state: placedState }));
      expect(animHtml).toContain('data-testid="depot-inflight-place-ring"');

      // Workshop & map thumbnails preserve bright Toy-Crane design + numbered blocks
      const svg = renderDepotWorkshopSvg(placedState);
      expect(svg).toContain('#edf4fb');
      expect(svg).toContain('>5<');
      const mapSvg = renderDepotMapSvg(placedState);
      expect(mapSvg).toContain('<svg');
    });
  });

  describe('5. v4 Binary Serialization Round-Trip (values, enforceHanoiRule, dynamic station)', () => {
    it('round-trips stackValues, targetStackValues, targetOutputValues, explicit enforceHanoiRule=false, and DEPOT_MOVE_TO [a]', () => {
      const ws = makeEmptyWorkspace({
        MAIN: [
          { id: 'va', type: 'VAR_ASSIGN', params: { a: 'a', b: 2 } },
          { id: 'mv', type: 'DEPOT_MOVE_TO', params: { station: 'a' } },
          {
            id: 'if1',
            type: 'IF',
            params: {
              condition: {
                kind: 'or',
                left: { kind: 'sensor', sensor: 'stationEmpty', param: 'STACK_1' },
                right: { kind: 'cmp', op: '>', left: '$heldValue', right: '$topValue[STACK_1]' },
              },
            },
          },
          { id: 'ei1', type: 'END_IF' },
        ],
      });
      const state = createInitialDepotState({
        workerStation: 'INPUT',
        stacks: [['RED'], ['BLUE', 'GREEN'], []],
        stackValues: [[5], [2, 8], []],
        targetStacks: [['RED'], ['BLUE', 'GREEN'], ['AMBER']],
        targetStackValues: [[5], [2, 8], [11]],
        targetOutput: ['PURPLE'],
        targetOutputValues: [15],
        input: [{ color: 'AMBER', value: 11 }],
        enforceHanoiRule: false,
        requireEmptyStacks: false,
      });

      const bin = exportToBinary(ws, 'depot', state);
      expect(bin[1]).toBe(ENV_ID_DEPOT);
      expect(bin[2]).toBe(ENV_VERSION_DEPOT_V4);

      const dec = importFromBinary(bin);
      expect(dec.success).toBe(true);
      expect(dec.depotState?.stackValues).toEqual([[5], [2, 8], []]);
      expect(dec.depotState?.targetStackValues).toEqual([[5], [2, 8], [11]]);
      expect(dec.depotState?.targetOutputValues).toEqual([15]);
      expect(dec.depotState?.enforceHanoiRule).toBe(false);
      expect(dec.depotState?.requireEmptyStacks).toBe(false);
      expect(dec.workspace?.MAIN[1].params?.station).toBe('a');

      const strRound = importFromString(exportToString(ws, 'depot', state));
      expect(strRound.success).toBe(true);
      expect(strRound.depotState?.stackValues).toEqual([[5], [2, 8], []]);
      expect(strRound.depotState?.enforceHanoiRule).toBe(false);
    });
  });

  describe('6. Depot Constraint Solver Phase 3 Support (cmp.6–8 < 500ms)', () => {
    it('verifies multi-variant cmp.8 champion-swap puzzle with F1, OR, CMP, enforceHanoiRule=false, requireEmptyStacks=false under 500ms', () => {
      const makeVariant = (vals: number[], expectedMax: number, discards: number[]): DepotState =>
        createInitialDepotState({
          workerStation: 'INPUT',
          input: vals.map((v) => ({ color: 'BLUE', value: v })),
          stacks: [[], [], []],
          targetStacks: [[], discards.map(() => 'BLUE'), []],
          targetStackValues: [[], discards, []],
          targetOutput: ['BLUE'],
          targetOutputValues: [expectedMax],
          enforceHanoiRule: false,
          requireEmptyStacks: false,
          activeStationsMask:
            DEPOT_STATION_BITS.STACK_1 |
            DEPOT_STATION_BITS.STACK_2 |
            DEPOT_STATION_BITS.STACK_3 |
            DEPOT_STATION_BITS.INPUT |
            DEPOT_STATION_BITS.OUT,
        });

      const activity: CurriculumActivity = {
        id: 'cmp.8.test',
        module: 'cmp',
        title: 'Maximum Crate Hunter',
        lessonNumber: 'cmp.8',
        simId: 'depot',
        format: 'challenge',
        prompt: 'Find max numbered block.',
        palette: {
          allowedSimBlocks: ['DEPOT_MOVE_TO', 'DEPOT_GRAB', 'DEPOT_PLACE', 'DEPOT_SEND_OUT'],
          allowedControlBlocks: ['WHILE', 'END_WHILE', 'IF', 'ELSE', 'END_IF', 'CALL_F1'],
          allowedSensors: ['stationEmpty', '$heldValue', '$topValue'],
          allowedScopes: ['MAIN', 'F1'],
          allowRepeatBadges: false,
        },
        slotCap: { perScope: { MAIN: 13, F1: 11 }, maxTotal: 24 },
        depot: makeVariant([4, 9, 2, 7], 9, [4, 2, 7]),
        depotVariants: [
          makeVariant([4, 9, 2, 7], 9, [4, 2, 7]),
          makeVariant([12, 5, 8, 11], 12, [5, 8, 11]),
          makeVariant([3, 6, 6, 15, 10], 15, [3, 6, 6, 10]),
          makeVariant([1, 8, 4], 8, [1, 4]),
        ],
        referenceSolution: {
          MAIN: [
            {
              id: 'w1',
              type: 'WHILE',
              params: {
                condition: { kind: 'not', operand: { kind: 'sensor', sensor: 'stationEmpty', param: 'INPUT' } },
              },
            },
            { id: 'mi', type: 'DEPOT_MOVE_TO', params: { station: 'INPUT' } },
            { id: 'gi', type: 'DEPOT_GRAB' },
            {
              id: 'if_max',
              type: 'IF',
              params: {
                condition: {
                  kind: 'or',
                  left: { kind: 'sensor', sensor: 'stationEmpty', param: 'STACK_1' },
                  right: { kind: 'cmp', op: '>', left: '$heldValue', right: '$topValue[STACK_1]' },
                },
              },
            },
            { id: 'cf1', type: 'CALL_F1' },
            { id: 'el', type: 'ELSE' },
            { id: 'm2', type: 'DEPOT_MOVE_TO', params: { station: 'STACK_2' } },
            { id: 'p2', type: 'DEPOT_PLACE' },
            { id: 'eif', type: 'END_IF' },
            { id: 'ew', type: 'END_WHILE' },
            { id: 'ms1', type: 'DEPOT_MOVE_TO', params: { station: 'STACK_1' } },
            { id: 'gs1', type: 'DEPOT_GRAB' },
            { id: 'out', type: 'DEPOT_SEND_OUT' },
          ],
          F1: [
            { id: 'f_m3', type: 'DEPOT_MOVE_TO', params: { station: 'STACK_3' } },
            { id: 'f_p3', type: 'DEPOT_PLACE' },
            {
              id: 'f_if',
              type: 'IF',
              params: {
                condition: { kind: 'not', operand: { kind: 'sensor', sensor: 'stationEmpty', param: 'STACK_1' } },
              },
            },
            { id: 'f_m1a', type: 'DEPOT_MOVE_TO', params: { station: 'STACK_1' } },
            { id: 'f_g1', type: 'DEPOT_GRAB' },
            { id: 'f_m2', type: 'DEPOT_MOVE_TO', params: { station: 'STACK_2' } },
            { id: 'f_p2', type: 'DEPOT_PLACE' },
            { id: 'f_eif', type: 'END_IF' },
            { id: 'f_m3b', type: 'DEPOT_MOVE_TO', params: { station: 'STACK_3' } },
            { id: 'f_g3', type: 'DEPOT_GRAB' },
            { id: 'f_m1b', type: 'DEPOT_MOVE_TO', params: { station: 'STACK_1' } },
          ],
          F2: [],
          F3: [],
        },
        antiBypassRules: [
          {
            id: 'no-hardcoded-sequence',
            description: 'Must use WHILE and IF across differing input variants',
            forbidBlocks: ['WHILE', 'IF'],
          },
        ],
      };

      // Note F1 above leaves champion in claw before placing on STACK_1: add final PLACE on STACK_1
      activity.referenceSolution.F1.push({ id: 'f_p1', type: 'DEPOT_PLACE' });
      activity.slotCap = { perScope: { MAIN: 13, F1: 12 }, maxTotal: 25 };

      const refRes = checkDepotReferenceSolution(activity);
      expect(refRes.paletteViolations).toEqual([]);
      expect(refRes.passed).toBe(true);
      expect(refRes.variantResults?.every((v) => v.passed)).toBe(true);

      const ruleRes = verifyDepotActivityRule(activity, activity.antiBypassRules![0], 0);
      expect(ruleRes.passed).toBe(true);
      expect(ruleRes.elapsedMs).toBeLessThan(500);
    });

    it('accepts variable station targeting in validateDepotWorkspaceAgainstPalette', () => {
      const activity: CurriculumActivity = {
        id: 'cmp.var.station.test',
        module: 'cmp',
        title: 'Variable Station Targeting',
        lessonNumber: 'cmp.var',
        simId: 'depot',
        format: 'challenge',
        prompt: 'Move crate to stack [a].',
        palette: {
          allowedSimBlocks: ['DEPOT_MOVE_TO', 'DEPOT_GRAB', 'DEPOT_PLACE'],
          allowedControlBlocks: ['VAR_ASSIGN'],
          allowedScopes: ['MAIN'],
          allowVariables: true,
        },
        depot: createInitialDepotState({
          workerStation: 'INPUT',
          input: [{ color: 'RED', value: 5 }],
          stacks: [[], [], []],
          targetStacks: [[], ['RED'], []],
          targetStackValues: [[], [5], []],
        }),
        referenceSolution: makeEmptyWorkspace({
          MAIN: [
            { id: 'v1', type: 'VAR_ASSIGN', params: { a: 'a', b: 2 } },
            { id: 'g1', type: 'DEPOT_GRAB' },
            { id: 'm1', type: 'DEPOT_MOVE_TO', params: { station: 'a' } },
            { id: 'p1', type: 'DEPOT_PLACE' },
          ],
        }),
      };

      const res = checkDepotReferenceSolution(activity);
      expect(res.paletteViolations).toEqual([]);
      expect(res.passed).toBe(true);
    });
  });
});
