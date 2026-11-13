import { describe, expect, it } from 'vitest';
import {
  CrateColor,
  DepotState,
  DepotQueueItem,
} from '../src/simulations/depot/types';
import {
  applyDepotAction,
  createInitialDepotState,
  depotStateNeedsQueueVersion,
  evaluateDepotSensor,
  resetDepotState,
} from '../src/simulations/depot/depotPhysics';
import {
  exportToBinary,
  exportToString,
  importFromBinary,
  importFromString,
} from '../src/engine/serialization/codeSerializer';
import {
  ENV_ID_DEPOT,
  ENV_VERSION_DEPOT,
  ENV_VERSION_DEPOT_QUEUE,
  ENV_VERSION_DEPOT_STATE,
  OP_DEPOT_MOVE_TO,
  OP_DEPOT_SEND_GATE,
  OP_DEPOT_SEND_OUT,
} from '../src/engine/serialization/types';
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
});
