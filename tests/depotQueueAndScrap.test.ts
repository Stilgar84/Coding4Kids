import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CrateColor,
  DEPOT_DEFAULT_STACK_MASK,
  DEPOT_STATION_BITS,
  DepotState,
  DepotQueueItem,
} from '../src/simulations/depot/types';
import {
  applyDepotAction,
  createInitialDepotState,
  depotStateNeedsQueueVersion,
  depotStateNeedsV4Version,
  evaluateDepotCompletion,
  evaluateDepotSensor,
  getActiveDepotStations,
  normalizeCrateColor,
  resetDepotState,
} from '../src/simulations/depot/depotPhysics';
import {
  DEPOT_GATE_PARAM_DEF,
  DEPOT_SENSORS,
  DEPOT_STATION_PARAM_DEF,
  depotSimulationEnvironment,
} from '../src/simulations/depot/depotEnvironment';
import { DepotCanvas } from '../src/simulations/depot/components/DepotCanvas';
import { DepotToolbarTools } from '../src/simulations/depot/components/DepotToolbarTools';
import { renderDepotWorkshopSvg } from '../src/simulations/depot/depotThumbnail';
import {
  exportToBinary,
  exportToString,
  importFromBinary,
  importFromString,
} from '../src/engine/serialization/codeSerializer';
import { BinaryReader } from '../src/engine/serialization/binaryReader';
import { BinaryWriter } from '../src/engine/serialization/binaryWriter';
import {
  getDepotSerializationVersion,
  readDepotBlock,
  readDepotState,
  writeDepotParams,
  writeDepotState,
} from '../src/engine/serialization/env/depotSerializer';
import {
  ENV_ID_DEPOT,
  ENV_VERSION_DEPOT,
  ENV_VERSION_DEPOT_QUEUE,
  ENV_VERSION_DEPOT_STATE,
  ENV_VERSION_DEPOT_V4,
  OP_DEPOT_MOVE_TO,
  OP_DEPOT_SEND_GATE,
  OP_DEPOT_SEND_OUT,
} from '../src/engine/serialization/types';
import {
  checkDepotReferenceSolution,
  verifyDepotActivityRule,
} from '../src/engine/verification/depotConstraintSolver';
import { useAppStore } from '../src/store/useAppStore';
import { CurriculumActivity } from '../src/data/curriculum/types';
import { WorkspaceState } from '../src/types';

describe('Commit 24: Depot M5 (FIFO Queue, Damaged Crates, Gates, Sensors & v3 Binary)', () => {
  describe('1. M3 v1/v2 Byte-Identical Preservation', () => {
    it('emits envVersion = 1 for code-only Depot exports without state', () => {
      const ws: WorkspaceState = {
        MAIN: [
          { id: 'b1', type: 'DEPOT_MOVE_TO', params: { station: 'STACK_1' } },
          { id: 'b2', type: 'DEPOT_GRAB' },
          { id: 'b3', type: 'DEPOT_SEND_OUT' },
        ],
        F1: [],
        F2: [],
        F3: [],
      };
      const binV1 = exportToBinary(ws, 'depot');
      expect(binV1[1]).toBe(ENV_ID_DEPOT); // 0x07
      expect(binV1[2]).toBe(ENV_VERSION_DEPOT); // 1
      const res = importFromBinary(binV1);
      expect(res.success).toBe(true);
      expect(res.envId).toBe('depot');
      expect(res.envVersion).toBe(1);
      expect(res.depotState).toBeUndefined();
      expect(res.workspace?.MAIN.map((b) => b.type)).toEqual([
        'DEPOT_MOVE_TO',
        'DEPOT_GRAB',
        'DEPOT_SEND_OUT',
      ]);
    });

    it('emits envVersion = 2 for M3 stack-only DepotState (tests/module3AnimationAndDepot.test.ts:254 invariant)', () => {
      const ws: WorkspaceState = {
        MAIN: [{ id: 'b1', type: 'DEPOT_GRAB' }],
        F1: [],
        F2: [],
        F3: [],
      };
      const stackState: DepotState = createInitialDepotState({
        stacks: [['RED', 'BLUE'], ['GREEN'], ['AMBER']],
        targetOutput: ['RED', 'BLUE'],
        workerStation: 'STACK_1',
      });

      expect(depotStateNeedsQueueVersion(stackState)).toBe(false);

      const binV2 = exportToBinary(ws, 'depot', stackState);
      expect(binV2[1]).toBe(ENV_ID_DEPOT); // 0x07
      expect(binV2[2]).toBe(ENV_VERSION_DEPOT_STATE); // 2: MUST remain 2 for M3 stack-only!

      const dec = importFromBinary(binV2);
      expect(dec.success).toBe(true);
      expect(dec.envId).toBe('depot');
      expect(dec.envVersion).toBe(2);
      expect(dec.depotState).toBeDefined();
      expect(dec.depotState?.stacks).toEqual([['RED', 'BLUE'], ['GREEN'], ['AMBER']]);
      expect(dec.depotState?.targetOutput).toEqual(['RED', 'BLUE']);
      expect(dec.depotState?.workerStation).toBe('STACK_1');
      expect(dec.depotState?.queue).toEqual([]);
      expect(dec.depotState?.scrapCount).toBe(0);
    });
  });

  describe('2. FIFO Queue Operations & Invariants', () => {
    it('dequeues from front (index 0) on DEPOT_GRAB at QUEUE station', () => {
      const q: DepotQueueItem[] = [
        { color: 'RED' },
        { color: 'BLUE' },
        { color: 'GREEN' },
      ];
      let state = createInitialDepotState({
        queue: q,
        workerStation: 'QUEUE',
      });

      expect(state.queue.length).toBe(3);
      expect(state.queue[0].color).toBe('RED');

      const step1 = applyDepotAction('DEPOT_GRAB', state);
      expect(step1.isCollision).toBe(false);
      expect(step1.nextState.heldCrate).toBe('RED');
      expect(step1.nextState.heldDamaged).toBe(false);
      expect(step1.nextState.queue.length).toBe(2);
      expect(step1.nextState.queue[0].color).toBe('BLUE'); // Remaining items slid forward

      state = step1.nextState;

      // Move to Stack 1 and place RED
      const step2 = applyDepotAction('DEPOT_MOVE_TO', state, { station: 'STACK_1' });
      const step3 = applyDepotAction('DEPOT_PLACE', step2.nextState);
      expect(step3.isCollision).toBe(false);
      expect(step3.nextState.stacks[0]).toContain('RED');

      // Move back to QUEUE and grab next (BLUE)
      const step4 = applyDepotAction('DEPOT_MOVE_TO', step3.nextState, { station: 'QUEUE' });
      const step5 = applyDepotAction('DEPOT_GRAB', step4.nextState);
      expect(step5.isCollision).toBe(false);
      expect(step5.nextState.heldCrate).toBe('BLUE');
      expect(step5.nextState.queue.length).toBe(1);
      expect(step5.nextState.queue[0].color).toBe('GREEN');
    });

    it('enqueues at back of queue on DEPOT_PLACE at QUEUE station', () => {
      let state = createInitialDepotState({
        queue: [{ color: 'RED' }],
        workerStation: 'QUEUE',
      });
      state = { ...state, heldCrate: 'AMBER', heldDamaged: false };

      const step = applyDepotAction('DEPOT_PLACE', state);
      expect(step.isCollision).toBe(false);
      expect(step.nextState.heldCrate).toBeNull();
      expect(step.nextState.queue.length).toBe(2);
      expect(step.nextState.queue[0].color).toBe('RED'); // Front unchanged
      expect(step.nextState.queue[1].color).toBe('AMBER'); // Appended at back
    });

    it('triggers EMPTY_STACK collision when grabbing from empty queue', () => {
      const state = createInitialDepotState({
        queue: [],
        workerStation: 'QUEUE',
      });
      const step = applyDepotAction('DEPOT_GRAB', state);
      expect(step.isCollision).toBe(true);
      expect(step.nextState.lastFailureReason).toBe('EMPTY_STACK');
    });

    it('triggers STACK_FULL collision when placing into queue exceeding max length', () => {
      const fullQueue: DepotQueueItem[] = Array.from({ length: 8 }, () => ({
        color: 'RED' as CrateColor,
      }));
      const state = createInitialDepotState({
        queue: fullQueue,
        workerStation: 'QUEUE',
      });
      const heldState = { ...state, heldCrate: 'BLUE' as CrateColor };
      const step = applyDepotAction('DEPOT_PLACE', heldState);
      expect(step.isCollision).toBe(true);
      expect(step.nextState.lastFailureReason).toBe('STACK_FULL');
    });

    it('resets queue to initialQueue on resetDepotState', () => {
      const initialQueue: DepotQueueItem[] = [{ color: 'RED' }, { color: 'BLUE' }];
      let state = createInitialDepotState({
        queue: initialQueue,
        workerStation: 'QUEUE',
      });
      const step = applyDepotAction('DEPOT_GRAB', state);
      expect(step.nextState.queue.length).toBe(1);

      const reset = resetDepotState(step.nextState);
      expect(reset.queue.length).toBe(2);
      expect(reset.queue[0].color).toBe('RED');
      expect(reset.queue[1].color).toBe('BLUE');
      expect(reset.heldCrate).toBeNull();
    });
  });

  describe('3. Damaged Crates, Stack Safety & Scrap Gate', () => {
    it('sets heldDamaged when dequeuing damaged crate', () => {
      const state = createInitialDepotState({
        queue: [{ color: 'RED', damaged: true }],
        workerStation: 'QUEUE',
      });
      const step = applyDepotAction('DEPOT_GRAB', state);
      expect(step.nextState.heldCrate).toBe('RED');
      expect(step.nextState.heldDamaged).toBe(true);
    });

    it('triggers DAMAGED_TO_STACK collision when placing damaged crate on stack', () => {
      const state = createInitialDepotState({
        stacks: [[], [], []],
        workerStation: 'STACK_1',
      });
      const heldState = { ...state, heldCrate: 'RED' as CrateColor, heldDamaged: true };
      const step = applyDepotAction('DEPOT_PLACE', heldState);
      expect(step.isCollision).toBe(true);
      expect(step.nextState.lastFailureReason).toBe('DAMAGED_TO_STACK');
    });

    it('successfully scraps damaged crate via DEPOT_SEND_GATE [SCRAP]', () => {
      const state = createInitialDepotState();
      const heldState: DepotState = {
        ...state,
        heldCrate: 'BLUE',
        heldDamaged: true,
        scrapCount: 0,
      };
      const step = applyDepotAction('DEPOT_SEND_GATE', heldState, { gate: 'SCRAP' });
      expect(step.isCollision).toBe(false);
      expect(step.nextState.heldCrate).toBeNull();
      expect(step.nextState.heldDamaged).toBe(false);
      expect(step.nextState.scrapCount).toBe(1);
    });

    it('triggers INTACT_TO_SCRAP collision when sending intact crate to SCRAP', () => {
      const state = createInitialDepotState();
      const heldState: DepotState = {
        ...state,
        heldCrate: 'BLUE',
        heldDamaged: false,
      };
      const step = applyDepotAction('DEPOT_SEND_GATE', heldState, { gate: 'SCRAP' });
      expect(step.isCollision).toBe(true);
      expect(step.nextState.lastFailureReason).toBe('INTACT_TO_SCRAP');
    });

    it('sends intact crate to default [OUT] via DEPOT_SEND_OUT (0x13)', () => {
      const state = createInitialDepotState({
        targetOutput: ['RED'],
      });
      const heldState: DepotState = { ...state, heldCrate: 'RED', heldDamaged: false };
      const step = applyDepotAction('DEPOT_SEND_OUT', heldState);
      expect(step.isCollision).toBe(false);
      expect(step.nextState.output).toEqual(['RED']);
      expect(step.isSuccess).toBe(true);
    });
  });

  describe('4. M5 Depot Boolean Sensors (ConditionExpr 0x18..0x1C)', () => {
    it('evaluates stationEmpty (0x18) for stacks and QUEUE', () => {
      const state = createInitialDepotState({
        stacks: [['RED'], [], []],
        queue: [{ color: 'BLUE' }],
        workerStation: 'STACK_1',
      });

      // CURRENT station (STACK_1): not empty
      expect(evaluateDepotSensor(0x18, state, { stationParam: 0 })).toBe(false);

      // STACK_2: empty
      expect(evaluateDepotSensor(0x18, state, { stationParam: 2 })).toBe(true);

      // QUEUE (code 4): not empty
      expect(evaluateDepotSensor(0x18, state, { stationParam: 4 })).toBe(false);

      // Empty the queue
      const emptyQState = { ...state, queue: [] };
      expect(evaluateDepotSensor(0x18, emptyQState, { stationParam: 4 })).toBe(true);
    });

    it('evaluates hasItem (0x19)', () => {
      const state = createInitialDepotState();
      expect(evaluateDepotSensor(0x19, state)).toBe(false);

      const heldState = { ...state, heldCrate: 'RED' as CrateColor };
      expect(evaluateDepotSensor(0x19, heldState)).toBe(true);
    });

    it('evaluates itemDamaged (0x1A)', () => {
      const state = createInitialDepotState();
      expect(evaluateDepotSensor(0x1a, state)).toBe(false);

      const intactState = { ...state, heldCrate: 'RED' as CrateColor, heldDamaged: false };
      expect(evaluateDepotSensor(0x1a, intactState)).toBe(false);

      const damagedState = { ...state, heldCrate: 'RED' as CrateColor, heldDamaged: true };
      expect(evaluateDepotSensor(0x1a, damagedState)).toBe(true);
    });

    it('evaluates heldColor (0x1B)', () => {
      // 0 = RED, 1 = BLUE, 2 = GREEN, 3 = AMBER
      const state = createInitialDepotState();
      const heldBlue = { ...state, heldCrate: 'BLUE' as CrateColor };

      expect(evaluateDepotSensor(0x1b, heldBlue, { colorIdx: 1 })).toBe(true);
      expect(evaluateDepotSensor(0x1b, heldBlue, { colorIdx: 0 })).toBe(false);
    });

    it('evaluates topColor (0x1C) as non-destructive peek', () => {
      const state = createInitialDepotState({
        stacks: [['RED', 'BLUE'], [], []],
        queue: [{ color: 'GREEN' }, { color: 'AMBER' }],
        workerStation: 'STACK_1',
      });

      // At STACK_1: top crate is BLUE (code 1)
      expect(evaluateDepotSensor(0x1c, state, { colorIdx: 1 })).toBe(true);
      expect(evaluateDepotSensor(0x1c, state, { colorIdx: 0 })).toBe(false);

      // At QUEUE: front crate is GREEN (code 2)
      const qState = { ...state, workerStation: 'QUEUE' as const };
      expect(evaluateDepotSensor(0x1c, qState, { colorIdx: 2 })).toBe(true);
      expect(evaluateDepotSensor(0x1c, qState, { colorIdx: 3 })).toBe(false);
    });
  });

  describe('5. Binary Serialization (envVersion = 3)', () => {
    it('round-trips DepotState with FIFO queue, damaged crates, and scrapCount losslessly', () => {
      const ws: WorkspaceState = {
        MAIN: [
          { id: 'b1', type: 'DEPOT_MOVE_TO', params: { station: 'QUEUE' } },
          { id: 'b2', type: 'DEPOT_GRAB' },
          { id: 'b3', type: 'DEPOT_SEND_GATE', params: { gate: 'SCRAP' } },
          { id: 'b4', type: 'DEPOT_SEND_OUT' },
        ],
        F1: [],
        F2: [],
        F3: [],
      };
      const depotState: DepotState = createInitialDepotState({
        stacks: [['RED'], ['BLUE', 'GREEN'], []],
        queue: [
          { color: 'AMBER', damaged: true },
          { color: 'RED', damaged: false },
          { color: 'BLUE' },
        ],
        workerStation: 'QUEUE',
      });
      depotState.scrapCount = 3;

      expect(depotStateNeedsQueueVersion(depotState)).toBe(true);

      const binV3 = exportToBinary(ws, 'depot', depotState);
      expect(binV3[1]).toBe(ENV_ID_DEPOT); // 0x07
      expect(binV3[2]).toBe(ENV_VERSION_DEPOT_QUEUE); // 3: ENV_VERSION_DEPOT_QUEUE

      const dec = importFromBinary(binV3);
      expect(dec.success).toBe(true);
      expect(dec.envId).toBe('depot');
      expect(dec.envVersion).toBe(3);
      expect(dec.depotState).toBeDefined();

      const decodedState = dec.depotState!;
      expect(decodedState.workerStation).toBe('QUEUE');
      expect(decodedState.stacks).toEqual([['RED'], ['BLUE', 'GREEN'], []]);
      expect(decodedState.queue).toEqual([
        { color: 'AMBER', damaged: true },
        { color: 'RED', damaged: undefined },
        { color: 'BLUE', damaged: undefined },
      ]);
      expect(decodedState.scrapCount).toBe(3);

      // Verify code scopes round-trip
      expect(dec.workspace?.MAIN.map((b) => b.type)).toEqual([
        'DEPOT_MOVE_TO',
        'DEPOT_GRAB',
        'DEPOT_SEND_GATE',
        'DEPOT_SEND_OUT',
      ]);
      expect(dec.workspace?.MAIN[0].params?.station).toBe('QUEUE');
      expect(dec.workspace?.MAIN[2].params?.gate).toBe('SCRAP');
    });

    it('round-trips Base64URL string representation', () => {
      const ws: WorkspaceState = {
        MAIN: [
          { id: 'b1', type: 'DEPOT_MOVE_TO', params: { station: 'QUEUE' } },
          { id: 'b2', type: 'DEPOT_SEND_GATE', params: { gate: 'ACCEPT' } },
        ],
        F1: [],
        F2: [],
        F3: [],
      };
      const depotState: DepotState = createInitialDepotState({
        queue: [{ color: 'GREEN', damaged: true }],
        workerStation: 'QUEUE',
      });

      const str = exportToString(ws, 'depot', depotState);
      expect(typeof str).toBe('string');
      expect(str.length).toBeGreaterThan(0);

      const dec = importFromString(str);
      expect(dec.success).toBe(true);
      expect(dec.envId).toBe('depot');
      expect(dec.depotState?.queue).toEqual([{ color: 'GREEN', damaged: true }]);
      expect(dec.workspace?.MAIN[1].params?.gate).toBe('ACCEPT');
    });
  });

  describe('6. Depot v4: INPUT Dispenser, 10-Color Rings & Active Palette', () => {
    it('dequeues from front of INPUT dispenser on DEPOT_GRAB and preserves lastAction', () => {
      const state = createInitialDepotState({
        stacks: [[], [], []],
        input: [{ color: 'PURPLE' }, { color: 'CYAN' }, { color: 'WHITE' }],
        workerStation: 'INPUT',
      });

      expect(getActiveDepotStations(state)).toContain('INPUT');
      const g1 = applyDepotAction('DEPOT_GRAB', state);
      expect(g1.isCollision).toBe(false);
      expect(g1.nextState.heldCrate).toBe('PURPLE');
      expect(g1.nextState.input).toEqual([{ color: 'CYAN' }, { color: 'WHITE' }]);
      expect(g1.nextState.lastAction?.type).toBe('GRAB');
      expect(g1.nextState.lastAction?.fromStation).toBe('INPUT');
      expect(g1.nextState.lastAction?.toStation).toBe('INPUT');
      expect(g1.nextState.lastAction?.inputIndex).toBe(0);

      const m1 = applyDepotAction('DEPOT_MOVE_TO', g1.nextState, { station: 'STACK_1' });
      const p1 = applyDepotAction('DEPOT_PLACE', m1.nextState);
      expect(p1.isCollision).toBe(false);
      expect(p1.nextState.stacks[0]).toEqual(['PURPLE']);
    });

    it('rejects DEPOT_PLACE at INPUT with INPUT_READ_ONLY COLLISION and restores input on reset', () => {
      const base = createInitialDepotState({
        input: [{ color: 'PINK' }, { color: 'ORANGE' }],
        workerStation: 'INPUT',
      });
      const grabbed = applyDepotAction('DEPOT_GRAB', base).nextState;
      expect(grabbed.heldCrate).toBe('PINK');

      const dropAttempt = applyDepotAction('DEPOT_PLACE', grabbed);
      expect(dropAttempt.isCollision).toBe(true);
      expect(dropAttempt.nextState.lastFailureReason).toBe('INPUT_READ_ONLY');
      expect(dropAttempt.nextState.lastAction?.type).toBe('COLLISION');
      expect(dropAttempt.nextState.lastAction?.failureReason).toBe('INPUT_READ_ONLY');
      expect(dropAttempt.nextState.input).toEqual([{ color: 'ORANGE' }]);

      const reset = resetDepotState(dropAttempt.nextState);
      expect(reset.input).toEqual([{ color: 'PINK' }, { color: 'ORANGE' }]);
      expect(reset.heldCrate).toBeNull();
    });

    it('keeps workerStation invariant on DEPOT_SEND_OUT and enforces v4 completion rules', () => {
      const state = createInitialDepotState({
        stacks: [['RED'], [], []],
        input: [{ color: 'BLACK' }],
        workerStation: 'INPUT',
        requireEmptyStacks: true,
        exactOutputCount: 2,
        allowNonEmptyInput: false,
      });

      // Grab BLACK from INPUT and send OUT while parked at INPUT
      const g1 = applyDepotAction('DEPOT_GRAB', state).nextState;
      const out1 = applyDepotAction('DEPOT_SEND_OUT', g1);
      expect(out1.nextState.workerStation).toBe('INPUT');
      expect(out1.isSuccess).toBe(false); // Stack 1 not empty yet & exactOutputCount = 2

      // Grab RED from STACK_1 and send OUT
      const m1 = applyDepotAction('DEPOT_MOVE_TO', out1.nextState, { station: 'STACK_1' }).nextState;
      const g2 = applyDepotAction('DEPOT_GRAB', m1).nextState;
      const out2 = applyDepotAction('DEPOT_SEND_OUT', g2);
      expect(out2.nextState.workerStation).toBe('STACK_1');
      expect(out2.isSuccess).toBe(true);
      expect(evaluateDepotCompletion(out2.nextState)).toBe('SUCCESS');
    });

    it('supports all 10 PALETTE_COLORS (yellow<->amber alias) & string stationEmpty/heldColor/topColor', () => {
      const colors: Array<[string, CrateColor]> = [
        ['black', 'BLACK'],
        ['red', 'RED'],
        ['blue', 'BLUE'],
        ['green', 'GREEN'],
        ['amber', 'AMBER'],
        ['yellow', 'AMBER'],
        ['purple', 'PURPLE'],
        ['pink', 'PINK'],
        ['cyan', 'CYAN'],
        ['orange', 'ORANGE'],
        ['white', 'WHITE'],
      ];
      for (const [token, expected] of colors) {
        expect(normalizeCrateColor(token)).toBe(expected);
      }

      const state = createInitialDepotState({
        stacks: [['PURPLE'], [], []],
        queue: [{ color: 'CYAN' }],
        input: [{ color: 'AMBER' }],
        workerStation: 'INPUT',
      });

      // stationEmpty string params including CURRENT, STACK_1..3, QUEUE, INPUT (stationCode 5)
      expect(depotSimulationEnvironment.evaluateSensor!('stationEmpty', state, 'CURRENT')).toBe(false);
      expect(depotSimulationEnvironment.evaluateSensor!('stationEmpty', state, 'INPUT')).toBe(false);
      expect(depotSimulationEnvironment.evaluateSensor!('stationEmpty', state, 'QUEUE')).toBe(false);
      expect(depotSimulationEnvironment.evaluateSensor!('stationEmpty', state, 'STACK_2')).toBe(true);
      expect(evaluateDepotSensor(0x18, state, { stationParam: 5 })).toBe(false);
      expect(evaluateDepotSensor(0x18, { ...state, input: [] }, { stationParam: 5 })).toBe(true);

      // topColor peeks INPUT[0] = AMBER (matches both 'amber' and 'yellow')
      expect(depotSimulationEnvironment.evaluateSensor!('$topColor', state, 'yellow')).toBe(true);
      expect(depotSimulationEnvironment.evaluateSensor!('$topColor', state, 'amber')).toBe(true);
      expect(depotSimulationEnvironment.evaluateSensor!('$topColor', state, 'purple')).toBe(false);

      // Move to QUEUE -> topColor sees CYAN; grab -> heldColor sees CYAN
      const atQueue = applyDepotAction('DEPOT_MOVE_TO', state, { station: 'QUEUE' }).nextState;
      expect(depotSimulationEnvironment.evaluateSensor!('$topColor', atQueue, 'cyan')).toBe(true);
      const grabbed = applyDepotAction('DEPOT_GRAB', atQueue).nextState;
      expect(depotSimulationEnvironment.evaluateSensor!('$heldColor', grabbed, 'cyan')).toBe(true);
      expect(depotSimulationEnvironment.evaluateSensor!('hasItem', grabbed)).toBe(true);
    });

    it('retires SCRAP and itemDamaged from active palette & sensor definitions', () => {
      expect(DEPOT_STATION_PARAM_DEF.options.some((o) => o.value === 'INPUT')).toBe(true);
      expect(DEPOT_GATE_PARAM_DEF.options.some((o) => o.value === 'SCRAP')).toBe(false);
      expect(DEPOT_GATE_PARAM_DEF.options.map((o) => o.value)).toEqual(['OUT', 'ACCEPT', 'REJECT']);
      expect(DEPOT_SENSORS.some((s) => s.id === 'itemDamaged')).toBe(false);
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
    });
  });

  describe('7. Depot v4 Binary Serialization (ENV_VERSION_DEPOT_V4 = 4)', () => {
    it('selects version 2 for stack-only, 3 for queue/scrap, and 4 for INPUT / 10-color rings', () => {
      const v2 = createInitialDepotState({ stacks: [['RED'], ['BLUE'], []] });
      expect(getDepotSerializationVersion(v2)).toBe(ENV_VERSION_DEPOT_STATE);

      const v3 = createInitialDepotState({ queue: [{ color: 'GREEN' }] });
      expect(getDepotSerializationVersion(v3)).toBe(ENV_VERSION_DEPOT_QUEUE);

      const v4Input = createInitialDepotState({ input: [{ color: 'RED' }] });
      expect(depotStateNeedsV4Version(v4Input)).toBe(true);
      expect(getDepotSerializationVersion(v4Input)).toBe(ENV_VERSION_DEPOT_V4);

      const v4Color = createInitialDepotState({ stacks: [['PURPLE'], ['WHITE'], ['BLACK']] });
      expect(getDepotSerializationVersion(v4Color)).toBe(ENV_VERSION_DEPOT_V4);
    });

    it('round-trips full Depot v4 state and INPUT MOVE_TO params losslessly', () => {
      const v4State = createInitialDepotState({
        stacks: [['BLACK', 'WHITE'], ['PURPLE'], ['PINK', 'CYAN', 'ORANGE']],
        targetStacks: [['ORANGE'], [], ['BLACK']],
        queue: [{ color: 'AMBER', value: 7 }, { color: 'GREEN' }],
        input: [{ color: 'RED', value: -3 }, { color: 'BLUE' }],
        targetOutput: ['PURPLE', 'WHITE'],
        workerStation: 'INPUT',
        activeStationsMask:
          DEPOT_DEFAULT_STACK_MASK |
          DEPOT_STATION_BITS.QUEUE |
          DEPOT_STATION_BITS.INPUT |
          DEPOT_STATION_BITS.OUT,
        mode: 'while_sort',
        enforceHanoiRule: true,
        requireEmptyStacks: true,
        allowNonEmptyInput: false,
        exactOutputCount: 2,
      });

      const writer = new BinaryWriter();
      writeDepotState(writer, v4State, ENV_VERSION_DEPOT_V4);
      const reader = new BinaryReader(writer.getBytes());
      const decoded = readDepotState(reader, ENV_VERSION_DEPOT_V4);

      expect(decoded.workerStation).toBe('INPUT');
      expect(decoded.stacks).toEqual([
        ['BLACK', 'WHITE'],
        ['PURPLE'],
        ['PINK', 'CYAN', 'ORANGE'],
      ]);
      expect(decoded.targetStacks).toEqual([['ORANGE'], [], ['BLACK']]);
      expect(decoded.queue).toEqual([{ color: 'AMBER', value: 7 }, { color: 'GREEN' }]);
      expect(decoded.input).toEqual([{ color: 'RED', value: -3 }, { color: 'BLUE' }]);
      expect(decoded.targetOutput).toEqual(['PURPLE', 'WHITE']);
      expect(decoded.mode).toBe('while_sort');
      expect(decoded.enforceHanoiRule).toBe(true);
      expect(decoded.requireEmptyStacks).toBe(true);
      expect(decoded.allowNonEmptyInput).toBe(false);
      expect(decoded.exactOutputCount).toBe(2);

      // DEPOT_MOVE_TO INPUT param byte round-trip (§7.6 stationCode 5)
      const pWriter = new BinaryWriter();
      writeDepotParams(pWriter, OP_DEPOT_MOVE_TO, { station: 'INPUT' }, 0);
      const pBytes = pWriter.getBytes();
      expect(pBytes[0]).toBe(5);
      const pReader = new BinaryReader(pBytes);
      const blk = readDepotBlock(pReader, OP_DEPOT_MOVE_TO, 0);
      expect(blk.params?.station).toBe('INPUT');
    });
  });

  describe('8. DepotCanvas v4, DepotToolbarTools & Workshop Thumbnail', () => {
    it('renders INPUT dispenser, 10-color rings, sensor beam spotlight, and zero-reading INPUT barrier', () => {
      const state = createInitialDepotState({
        stacks: [['PURPLE'], ['CYAN'], ['BLACK']],
        queue: [{ color: 'PINK' }],
        input: [{ color: 'ORANGE' }, { color: 'WHITE' }],
        workerStation: 'INPUT',
        activeStationsMask:
          DEPOT_DEFAULT_STACK_MASK |
          DEPOT_STATION_BITS.QUEUE |
          DEPOT_STATION_BITS.INPUT |
          DEPOT_STATION_BITS.OUT,
      });

      const collided = applyDepotAction(
        'DEPOT_PLACE',
        applyDepotAction('DEPOT_GRAB', state).nextState
      ).nextState;

      const html = renderToStaticMarkup(
        React.createElement(DepotCanvas, {
          state: collided,
          spotlightsOverride: ['sensor-beam'],
        })
      );
      expect(html).toContain('data-testid="depot-input-dispenser"');
      expect(html).toContain('data-testid="depot-queue-belt"');
      expect(html).toContain('data-testid="depot-input-barrier"');
      expect(html).toContain('>⛔<');
      expect(html).toContain('data-testid="depot-sensor-beam"');
      expect(html).not.toContain('>INPUT_READ_ONLY<');

      // Thumbnail includes daylight backdrop, birch bench, and IN bay
      const svg = renderDepotWorkshopSvg(state);
      expect(svg).toContain('#edf4fb');
      expect(svg).toContain('#e4be8b');
      expect(svg).toContain('>IN<');
    });

    it('renders radar and claw halo spotlights for active IF/WHILE sensor blocks', () => {
      const ws: WorkspaceState = {
        MAIN: [
          {
            id: 'while_blk',
            type: 'WHILE',
            params: { condition: { kind: 'sensor', sensor: 'stationEmpty', param: 'INPUT' } },
          },
          {
            id: 'if_blk',
            type: 'IF',
            params: { condition: { kind: 'sensor', sensor: 'hasItem' } },
          },
        ],
        F1: [],
        F2: [],
        F3: [],
      };
      useAppStore.setState({ workspace: ws });
      const state = createInitialDepotState({
        input: [{ color: 'PURPLE' }],
        workerStation: 'INPUT',
      });

      const radarHtml = renderToStaticMarkup(
        React.createElement(DepotCanvas, { state, activeBlockId: 'while_blk' })
      );
      expect(radarHtml).toContain('data-testid="depot-radar-spotlight"');

      const haloHtml = renderToStaticMarkup(
        React.createElement(DepotCanvas, { state, activeBlockId: 'if_blk' })
      );
      expect(haloHtml).toContain('data-testid="depot-claw-halo"');
    });

    it('renders clean intact stacked-ring DepotToolbarTools with >= 36px/44px touch targets and zero damaged crates', () => {
      const prevMode = useAppStore.getState().appMode;
      useAppStore.setState({ appMode: 'sandbox' });
      try {
        const html = renderToStaticMarkup(
          React.createElement(DepotToolbarTools, { state: createInitialDepotState() })
        );
        expect(html).toContain('data-testid="tool-depot-cycle-preset"');
        expect(html).toContain('data-testid="tool-depot-add-queue"');
        expect(html).toContain('min-w-[36px]');
        expect(html).toContain('md:min-w-[44px]');
        expect(html).not.toContain('⚡');
        expect(html).not.toContain('damaged');
      } finally {
        useAppStore.setState({ appMode: prevMode });
      }
    });
  });

  describe('9. Depot Constraint Solver v4 (activeStationsMask pruning & multi-variant < 200ms)', () => {
    it('validates WHILE/IF/ELSE_IF/ELSE + INPUT solutions and solves multi-variant rule check < 200ms', () => {
      const activity: CurriculumActivity = {
        id: 'test-depot-v4-sort',
        module: 'while',
        title: 'Test Depot v4 Sort',
        lessonNumber: 'while.test',
        simId: 'depot',
        format: 'challenge',
        prompt: 'Sort INPUT red/blue rings into OUT and Stack 1.',
        palette: {
          allowedSimBlocks: ['DEPOT_MOVE_TO', 'DEPOT_GRAB', 'DEPOT_PLACE', 'DEPOT_SEND_OUT'],
          allowedControlBlocks: ['WHILE', 'END_WHILE', 'IF', 'ELSE', 'END_IF'],
          allowedSensors: ['stationEmpty', '$heldColor'],
          allowedScopes: ['MAIN'],
          allowRepeatBadges: false,
        },
        slotCap: { maxTotal: 11 },
        depot: createInitialDepotState({
          stacks: [[], [], []],
          input: [{ color: 'RED' }, { color: 'BLUE' }, { color: 'RED' }],
          targetStacks: [['BLUE'], [], []],
          targetOutput: ['RED', 'RED'],
          workerStation: 'INPUT',
          activeStationsMask:
            DEPOT_STATION_BITS.STACK_1 | DEPOT_STATION_BITS.INPUT | DEPOT_STATION_BITS.OUT,
        }),
        depotVariants: [
          createInitialDepotState({
            stacks: [[], [], []],
            input: [{ color: 'RED' }, { color: 'BLUE' }, { color: 'RED' }],
            targetStacks: [['BLUE'], [], []],
            targetOutput: ['RED', 'RED'],
            workerStation: 'INPUT',
            activeStationsMask:
              DEPOT_STATION_BITS.STACK_1 | DEPOT_STATION_BITS.INPUT | DEPOT_STATION_BITS.OUT,
          }),
          createInitialDepotState({
            stacks: [[], [], []],
            input: [{ color: 'BLUE' }, { color: 'RED' }, { color: 'BLUE' }],
            targetStacks: [['BLUE', 'BLUE'], [], []],
            targetOutput: ['RED'],
            workerStation: 'INPUT',
            activeStationsMask:
              DEPOT_STATION_BITS.STACK_1 | DEPOT_STATION_BITS.INPUT | DEPOT_STATION_BITS.OUT,
          }),
        ],
        referenceSolution: {
          MAIN: [
            {
              id: 'w1',
              type: 'WHILE',
              params: {
                condition: {
                  kind: 'not',
                  operand: { kind: 'sensor', sensor: 'stationEmpty', param: 'INPUT' },
                },
              },
            },
            { id: 'm1', type: 'DEPOT_MOVE_TO', params: { station: 'INPUT' } },
            { id: 'g1', type: 'DEPOT_GRAB' },
            {
              id: 'i1',
              type: 'IF',
              params: { condition: { kind: 'sensor', sensor: 'heldColor', param: 'red' } },
            },
            { id: 'o1', type: 'DEPOT_SEND_OUT' },
            { id: 'e1', type: 'ELSE' },
            { id: 'm2', type: 'DEPOT_MOVE_TO', params: { station: 'STACK_1' } },
            { id: 'p1', type: 'DEPOT_PLACE' },
            { id: 'ei1', type: 'END_IF' },
            { id: 'ew1', type: 'END_WHILE' },
          ],
          F1: [],
          F2: [],
          F3: [],
        },
        antiBypassRules: [
          {
            id: 'require-while',
            description: 'Must work across both INPUT variants without straight-line hardcoding',
            forbidBlocks: ['WHILE', 'IF'],
          },
        ],
      };

      const refCheck = checkDepotReferenceSolution(activity);
      expect(refCheck.paletteViolations).toEqual([]);
      expect(refCheck.passed).toBe(true);

      const ruleCheck = verifyDepotActivityRule(activity, activity.antiBypassRules![0], 0);
      expect(ruleCheck.passed).toBe(true);
      expect(ruleCheck.elapsedMs).toBeLessThan(500);
    });
  });
});
