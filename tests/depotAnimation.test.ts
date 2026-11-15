import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyDepotAction,
  createInitialDepotState,
  depotStateNeedsQueueVersion,
  resetDepotState,
} from '../src/simulations/depot/depotPhysics';
import { DepotCanvas, computeDepotAnimDurationMs } from '../src/simulations/depot/components/DepotCanvas';
import {
  CrateColor,
  DEPOT_DEFAULT_STACK_MASK,
  DEPOT_MAX_QUEUE_LENGTH,
  DEPOT_MAX_STACK_HEIGHT,
  DepotQueueItem,
  DepotState,
} from '../src/simulations/depot/types';
import { exportToBinary, importFromBinary } from '../src/engine/serialization/codeSerializer';
import { ENV_ID_DEPOT, ENV_VERSION_DEPOT_STATE } from '../src/engine/serialization/types';
import { useAppStore } from '../src/store/useAppStore';
import { WorkspaceState } from '../src/types';

function renderDepot(state: DepotState): string {
  return renderToStaticMarkup(React.createElement(DepotCanvas, { state }));
}

describe('Depot Choreography, lastAction Metadata & Speed-Aware Canvas SSR', () => {
  const baselineSpeed = useAppStore.getState().speed;
  const baselinePerfMode = useAppStore.getState().performanceMode;
  const baselineAutoLow = useAppStore.getState().isAutoLowQuality;
  const baselineAppMode = useAppStore.getState().appMode;

  beforeEach(() => {
    useAppStore.setState({
      appMode: 'sandbox',
      speed: 400,
      performanceMode: 'high',
      isAutoLowQuality: false,
    });
  });

  afterEach(() => {
    useAppStore.setState({
      appMode: baselineAppMode,
      speed: baselineSpeed,
      performanceMode: baselinePerfMode,
      isAutoLowQuality: baselineAutoLow,
    });
  });

  describe('1. lastAction Transition Metadata & Lifecycle (depotPhysics)', () => {
    it('omits lastAction in createInitialDepotState and clears it to undefined in resetDepotState', () => {
      const init = createInitialDepotState({
        stacks: [['RED', 'BLUE'], [], []],
        targetOutput: ['RED', 'BLUE'],
        workerStation: 'STACK_1',
      });
      expect(init.lastAction).toBeUndefined();
      expect('lastAction' in init).toBe(false);

      const moved = applyDepotAction('DEPOT_MOVE_TO', init, { station: 'STACK_2' }).nextState;
      expect(moved.lastAction).toEqual({
        stepId: 1,
        type: 'MOVE',
        fromStation: 'STACK_1',
        toStation: 'STACK_2',
      });

      const reset = resetDepotState(moved);
      expect(reset.lastAction).toBeUndefined();
      expect(reset.stepCount).toBe(0);
      expect(reset.workerStation).toBe('STACK_1');
    });

    it('populates lastAction on MOVE, GRAB (stack & queue), PLACE (stack & queue), and SEND_OUT/SEND_GATE', () => {
      let state = createInitialDepotState({
        stacks: [['RED', 'BLUE'], [], []],
        queue: [{ color: 'GREEN' }, { color: 'AMBER', damaged: true }],
        workerStation: 'STACK_1',
      });

      // Step 1: GRAB from STACK_1 (index 0, slot 1)
      const s1 = applyDepotAction('DEPOT_GRAB', state);
      expect(s1.isCollision).toBe(false);
      expect(s1.nextState.lastAction).toEqual({
        stepId: 1,
        type: 'GRAB',
        fromStation: 'STACK_1',
        toStation: 'STACK_1',
        color: 'BLUE',
        damaged: false,
        stackIndex: 0,
        stackSlotIndex: 1,
      });

      // Step 2: MOVE to STACK_2
      const s2 = applyDepotAction('DEPOT_MOVE_TO', s1.nextState, { station: 'STACK_2' });
      expect(s2.nextState.lastAction).toEqual({
        stepId: 2,
        type: 'MOVE',
        fromStation: 'STACK_1',
        toStation: 'STACK_2',
      });

      // Step 3: PLACE onto STACK_2 (index 1, slot 0)
      const s3 = applyDepotAction('DEPOT_PLACE', s2.nextState);
      expect(s3.nextState.lastAction).toEqual({
        stepId: 3,
        type: 'PLACE',
        fromStation: 'STACK_2',
        toStation: 'STACK_2',
        color: 'BLUE',
        damaged: false,
        stackIndex: 1,
        stackSlotIndex: 0,
      });

      // Step 4: MOVE to QUEUE
      const s4 = applyDepotAction('DEPOT_MOVE_TO', s3.nextState, { station: 'QUEUE' });
      expect(s4.nextState.lastAction).toEqual({
        stepId: 4,
        type: 'MOVE',
        fromStation: 'STACK_2',
        toStation: 'QUEUE',
      });

      // Step 5: GRAB intact item from QUEUE front
      const s5 = applyDepotAction('DEPOT_GRAB', s4.nextState);
      expect(s5.nextState.lastAction).toEqual({
        stepId: 5,
        type: 'GRAB',
        fromStation: 'QUEUE',
        toStation: 'QUEUE',
        color: 'GREEN',
        damaged: false,
        queueIndex: 0,
      });

      // Step 6: SEND_OUT keeps workerStation invariant at QUEUE and records outputSlotIndex: 0
      const s6 = applyDepotAction('DEPOT_SEND_OUT', s5.nextState);
      expect(s6.nextState.workerStation).toBe('QUEUE');
      expect(s6.nextState.lastAction).toEqual({
        stepId: 6,
        type: 'SEND_OUT',
        fromStation: 'QUEUE',
        toStation: 'QUEUE',
        gate: 'OUT',
        color: 'GREEN',
        damaged: false,
        outputSlotIndex: 0,
      });

      // Step 7: GRAB damaged item from QUEUE front
      const s7 = applyDepotAction('DEPOT_GRAB', s6.nextState);
      expect(s7.nextState.lastAction).toEqual({
        stepId: 7,
        type: 'GRAB',
        fromStation: 'QUEUE',
        toStation: 'QUEUE',
        color: 'AMBER',
        damaged: true,
        queueIndex: 0,
      });

      // Step 8: PLACE damaged item back onto QUEUE back (queueIndex: 0)
      const s8 = applyDepotAction('DEPOT_PLACE', s7.nextState);
      expect(s8.nextState.lastAction).toEqual({
        stepId: 8,
        type: 'PLACE',
        fromStation: 'QUEUE',
        toStation: 'QUEUE',
        color: 'AMBER',
        damaged: true,
        queueIndex: 0,
      });

      // Step 9: Grab damaged item again and SEND_GATE [SCRAP]
      const s9 = applyDepotAction('DEPOT_GRAB', s8.nextState);
      const s10 = applyDepotAction('DEPOT_SEND_GATE', s9.nextState, { gate: 'SCRAP' });
      expect(s10.nextState.workerStation).toBe('QUEUE');
      expect(s10.nextState.scrapCount).toBe(1);
      expect(s10.nextState.lastAction).toEqual({
        stepId: 10,
        type: 'SEND_OUT',
        fromStation: 'QUEUE',
        toStation: 'QUEUE',
        gate: 'SCRAP',
        color: 'AMBER',
        damaged: true,
      });

      // Step 11-12: Grab from STACK_2 and SEND_GATE [ACCEPT] keeps STACK_2 invariant
      const s11 = applyDepotAction('DEPOT_MOVE_TO', s10.nextState, { station: 'STACK_2' });
      const s12 = applyDepotAction('DEPOT_GRAB', s11.nextState);
      const s13 = applyDepotAction('DEPOT_SEND_GATE', s12.nextState, { gate: 'ACCEPT' });
      expect(s13.nextState.workerStation).toBe('STACK_2');
      expect(s13.nextState.output).toEqual(['GREEN', 'BLUE']);
      expect(s13.nextState.lastAction).toEqual({
        stepId: 13,
        type: 'SEND_OUT',
        fromStation: 'STACK_2',
        toStation: 'STACK_2',
        gate: 'ACCEPT',
        color: 'BLUE',
        damaged: false,
        outputSlotIndex: 1,
      });
    });

    it('populates lastAction across every COLLISION branch and freezes after COLLISION', () => {
      // 1. CLAW_FULL
      const s0 = createInitialDepotState({ stacks: [['RED', 'BLUE'], [], []] });
      const held = applyDepotAction('DEPOT_GRAB', s0).nextState;
      const fullRes = applyDepotAction('DEPOT_GRAB', held);
      expect(fullRes.isCollision).toBe(true);
      expect(fullRes.nextState.lastAction).toMatchObject({
        stepId: 2,
        type: 'COLLISION',
        fromStation: 'STACK_1',
        toStation: 'STACK_1',
        failureReason: 'CLAW_FULL',
      });
      // Subsequent action after COLLISION does not mutate state
      const afterCrash = applyDepotAction('DEPOT_MOVE_TO', fullRes.nextState, { station: 'STACK_2' });
      expect(afterCrash.isCollision).toBe(true);
      expect(afterCrash.nextState).toBe(fullRes.nextState);

      // 2. EMPTY_STACK (stack & queue)
      const emptyStack = createInitialDepotState({ stacks: [[], [], []], workerStation: 'STACK_2' });
      const emptyStackRes = applyDepotAction('DEPOT_GRAB', emptyStack);
      expect(emptyStackRes.nextState.lastAction).toMatchObject({
        stepId: 1,
        type: 'COLLISION',
        fromStation: 'STACK_2',
        toStation: 'STACK_2',
        failureReason: 'EMPTY_STACK',
        stackIndex: 1,
      });

      const emptyQueue = createInitialDepotState({ queue: [], workerStation: 'QUEUE' });
      const emptyQueueRes = applyDepotAction('DEPOT_GRAB', emptyQueue);
      expect(emptyQueueRes.nextState.lastAction).toMatchObject({
        stepId: 1,
        type: 'COLLISION',
        fromStation: 'QUEUE',
        toStation: 'QUEUE',
        failureReason: 'EMPTY_STACK',
      });

      // 3. CLAW_EMPTY (PLACE & SEND_OUT)
      const emptyPlace = applyDepotAction('DEPOT_PLACE', emptyStack);
      expect(emptyPlace.nextState.lastAction).toMatchObject({
        stepId: 1,
        type: 'COLLISION',
        failureReason: 'CLAW_EMPTY',
      });
      const emptySend = applyDepotAction('DEPOT_SEND_OUT', emptyStack);
      expect(emptySend.nextState.lastAction).toMatchObject({
        stepId: 1,
        type: 'COLLISION',
        gate: 'OUT',
        failureReason: 'CLAW_EMPTY',
      });

      // 4. DAMAGED_TO_STACK
      const dmgHeld = applyDepotAction(
        'DEPOT_GRAB',
        createInitialDepotState({ queue: [{ color: 'RED', damaged: true }], workerStation: 'QUEUE' })
      ).nextState;
      const dmgAtStack = applyDepotAction('DEPOT_MOVE_TO', dmgHeld, { station: 'STACK_1' }).nextState;
      const dmgPlace = applyDepotAction('DEPOT_PLACE', dmgAtStack);
      expect(dmgPlace.nextState.lastAction).toMatchObject({
        stepId: 3,
        type: 'COLLISION',
        fromStation: 'STACK_1',
        toStation: 'STACK_1',
        failureReason: 'DAMAGED_TO_STACK',
        stackIndex: 0,
      });

      // 5. STACK_FULL (stack & queue)
      const fullStackState: DepotState = {
        ...createInitialDepotState({
          stacks: [Array<CrateColor>(DEPOT_MAX_STACK_HEIGHT).fill('RED'), [], []],
          workerStation: 'STACK_1',
        }),
        heldCrate: 'BLUE',
      };
      const stackFullRes = applyDepotAction('DEPOT_PLACE', fullStackState);
      expect(stackFullRes.nextState.lastAction).toMatchObject({
        stepId: 1,
        type: 'COLLISION',
        failureReason: 'STACK_FULL',
        stackIndex: 0,
      });

      const fullQueueState: DepotState = {
        ...createInitialDepotState({
          queue: Array<DepotQueueItem>(DEPOT_MAX_QUEUE_LENGTH).fill({ color: 'RED' }),
          workerStation: 'QUEUE',
        }),
        heldCrate: 'BLUE',
      };
      const queueFullRes = applyDepotAction('DEPOT_PLACE', fullQueueState);
      expect(queueFullRes.nextState.lastAction).toMatchObject({
        stepId: 1,
        type: 'COLLISION',
        failureReason: 'STACK_FULL',
      });

      // 6. INTACT_TO_SCRAP
      const intactHeld: DepotState = { ...createInitialDepotState(), heldCrate: 'GREEN', heldDamaged: false };
      const scrapRes = applyDepotAction('DEPOT_SEND_GATE', intactHeld, { gate: 'SCRAP' });
      expect(scrapRes.nextState.lastAction).toMatchObject({
        stepId: 1,
        type: 'COLLISION',
        gate: 'SCRAP',
        color: 'GREEN',
        failureReason: 'INTACT_TO_SCRAP',
      });

      // 7. WRONG_OUTPUT_ORDER
      const wrongOutBase = createInitialDepotState({
        stacks: [['RED', 'BLUE'], [], []],
        targetOutput: ['RED', 'BLUE'],
        workerStation: 'STACK_1',
      });
      const grabbedBlue = applyDepotAction('DEPOT_GRAB', wrongOutBase).nextState;
      const wrongOut = applyDepotAction('DEPOT_SEND_OUT', grabbedBlue);
      expect(wrongOut.nextState.lastAction).toEqual({
        stepId: 2,
        type: 'COLLISION',
        fromStation: 'STACK_1',
        toStation: 'STACK_1',
        gate: 'OUT',
        color: 'BLUE',
        damaged: false,
        outputSlotIndex: 0,
        failureReason: 'WRONG_OUTPUT_ORDER',
      });
    });

    it('never serializes lastAction to binary URLs and preserves v2 stack-only byte parity', () => {
      const ws: WorkspaceState = {
        MAIN: [{ id: 'b1', type: 'DEPOT_GRAB' }],
        F1: [],
        F2: [],
        F3: [],
      };
      const base = createInitialDepotState({
        stacks: [['RED', 'BLUE'], ['GREEN'], []],
        targetOutput: ['RED', 'BLUE'],
        workerStation: 'STACK_1',
        activeStationsMask: DEPOT_DEFAULT_STACK_MASK | 0x40,
      });
      const stepped = applyDepotAction('DEPOT_MOVE_TO', base, { station: 'STACK_2' }).nextState;
      expect(stepped.lastAction).toBeDefined();
      expect(depotStateNeedsQueueVersion(stepped)).toBe(false);

      const bin = exportToBinary(ws, 'depot', stepped);
      expect(bin[1]).toBe(ENV_ID_DEPOT);
      expect(bin[2]).toBe(ENV_VERSION_DEPOT_STATE);

      const dec = importFromBinary(bin);
      expect(dec.success).toBe(true);
      expect(dec.depotState?.lastAction).toBeUndefined();
    });
  });

  describe('2. Speed Scaling & DepotCanvas SSR Choreography', () => {
    it('scales animation duration cleanly from speed and disables when instant, 0, Lite, or no lastAction', () => {
      expect(computeDepotAnimDurationMs(400, false, true)).toBe(1350);
      expect(computeDepotAnimDurationMs(100, false, true)).toBe(585);
      expect(computeDepotAnimDurationMs(25, false, true)).toBe(230);
      expect(computeDepotAnimDurationMs(1000, false, true)).toBe(3375);
      expect(computeDepotAnimDurationMs(10, false, true)).toBe(230);

      expect(computeDepotAnimDurationMs('instant', false, true)).toBe(0);
      expect(computeDepotAnimDurationMs(0, false, true)).toBe(0);
      expect(computeDepotAnimDurationMs(400, true, true)).toBe(0);
      expect(computeDepotAnimDurationMs(400, false, false)).toBe(0);
    });

    it('renders MOVE, GRAB (stack & queue), PLACE (stack & queue), SEND_OUT, and COLLISION keyframes at speed=400', () => {
      // MOVE right
      const s0 = createInitialDepotState({
        stacks: [['RED', 'BLUE'], [], []],
        queue: [{ color: 'GREEN' }, { color: 'AMBER' }],
        targetStacks: [[], ['BLUE', 'RED'], []],
        workerStation: 'STACK_1',
      });
      const moved = applyDepotAction('DEPOT_MOVE_TO', s0, { station: 'STACK_2' }).nextState;
      const moveHtml = renderDepot(moved);
      expect(moveHtml).toContain('data-anim-duration="1350"');
      expect(moveHtml).toContain('data-anim-action="MOVE"');
      expect(moveHtml).toContain('transition-duration:1350ms');
      expect(moveHtml).toContain('cubic-bezier(0.22, 1, 0.36, 1)');
      expect(moveHtml).toContain('depotWheelSpinRight 1350ms');
      expect(moveHtml).toContain('depotCableSwayRight 1350ms');
      expect(moveHtml).toContain('depotStationArrivePulse 1350ms');
      expect(moveHtml).not.toContain('data-testid="depot-flying-ring"');

      // GRAB from stack
      const stackGrabbed = applyDepotAction('DEPOT_GRAB', s0).nextState;
      const stackGrabHtml = renderDepot(stackGrabbed);
      expect(stackGrabHtml).toContain('data-anim-action="GRAB"');
      expect(stackGrabHtml).toContain('depotSpringPlunge 1350ms');
      expect(stackGrabHtml).toContain('depotJawsPlunge 1350ms');
      expect(stackGrabHtml).toContain('depotJawLeftGrab 1350ms');
      expect(stackGrabHtml).toContain('data-testid="depot-claw-held-crate"');
      expect(stackGrabHtml).toContain('depotHeldRingGrabLift 1350ms');

      // GRAB from QUEUE (remaining tokens slide left + rollers spin)
      const atQueue = applyDepotAction('DEPOT_MOVE_TO', s0, { station: 'QUEUE' }).nextState;
      const queueGrabbed = applyDepotAction('DEPOT_GRAB', atQueue).nextState;
      const queueGrabHtml = renderDepot(queueGrabbed);
      expect(queueGrabHtml).toContain('depotHeldRingGrabLiftQueue 1350ms');
      expect(queueGrabHtml).toContain('depotQueueSlideLeft 1350ms');
      expect(queueGrabHtml).toContain('depotRollerSpin 1350ms');
      expect(queueGrabHtml).toContain('data-testid="depot-queue-crate-0"');

      // PLACE onto stack
      const atStack2 = applyDepotAction('DEPOT_MOVE_TO', stackGrabbed, { station: 'STACK_2' }).nextState;
      const stackPlaced = applyDepotAction('DEPOT_PLACE', atStack2).nextState;
      const stackPlaceHtml = renderDepot(stackPlaced);
      expect(stackPlaceHtml).toContain('data-anim-action="PLACE"');
      expect(stackPlaceHtml).toContain('depotSpringDip 1350ms');
      expect(stackPlaceHtml).toContain('depotJawsDip 1350ms');
      expect(stackPlaceHtml).toContain('depotJawLeftRelease 1350ms');
      expect(stackPlaceHtml).toContain('depotStackRingDrop 1350ms');
      expect(stackPlaceHtml).toContain('data-testid="depot-stack-2-crate-0"');

      // PLACE onto QUEUE
      const queuePlaced = applyDepotAction('DEPOT_PLACE', queueGrabbed).nextState;
      const queuePlaceHtml = renderDepot(queuePlaced);
      expect(queuePlaceHtml).toContain('depotQueueRingDrop 1350ms');
      expect(queuePlaceHtml).toContain('depotFunnelPulse 1350ms');

      // SEND_OUT (invariant workerStation, sky-chute glow, flying ring + synchronized output slot)
      const sentOut = applyDepotAction('DEPOT_SEND_OUT', atStack2).nextState;
      expect(sentOut.workerStation).toBe('STACK_2');
      const sendHtml = renderDepot(sentOut);
      expect(sendHtml).toContain('data-anim-action="SEND_OUT"');
      expect(sendHtml).toContain('depotJawsRecoil 1350ms');
      expect(sendHtml).toContain('depotJawLeftFlick 1350ms');
      expect(sendHtml).toContain('depotSkyChutePulse 1350ms');
      expect(sendHtml).toContain('depotSkyChuteStream 1350ms');
      expect(sendHtml).toContain('data-testid="depot-flying-ring"');
      expect(sendHtml).toContain('data-from-station="STACK_2"');
      expect(sendHtml).toContain('data-output-slot="0"');
      expect(sendHtml).toContain('depotFlyRingX 1350ms');
      expect(sendHtml).toContain('depotFlyRingY 1350ms');
      expect(sendHtml).toContain('depotOutputSlotLand 1350ms ease-out both');
      expect(sendHtml).toContain('data-testid="depot-output-slot-0"');

      // COLLISION
      const collided = applyDepotAction('DEPOT_GRAB', createInitialDepotState({ stacks: [[], [], []] })).nextState;
      const collHtml = renderDepot(collided);
      expect(collHtml).toContain('data-anim-action="COLLISION"');
      expect(collHtml).toContain('depotClawBonkRattle 1350ms');
      expect(collHtml).toContain('depotBadgePop 1350ms');
      expect(collHtml).toContain('data-testid="depot-failure-badge"');
      expect(collHtml).toContain('data-testid="status-collision"');
    });

    it('scales inline durations for speed=100 (585ms) and speed=25 (230ms)', () => {
      const s0 = createInitialDepotState({
        stacks: [['RED'], [], []],
        targetOutput: ['RED'],
      });
      const held = applyDepotAction('DEPOT_GRAB', s0).nextState;
      const sent = applyDepotAction('DEPOT_SEND_OUT', held).nextState;

      useAppStore.setState({ speed: 100 });
      const html100 = renderDepot(sent);
      expect(html100).toContain('data-anim-duration="585"');
      expect(html100).toContain('depotFlyRingX 585ms');
      expect(html100).toContain('depotOutputSlotLand 585ms');

      useAppStore.setState({ speed: 25 });
      const html25 = renderDepot(sent);
      expect(html25).toContain('data-anim-duration="230"');
      expect(html25).toContain('depotFlyRingX 230ms');
      expect(html25).toContain('depotOutputSlotLand 230ms');
    });

    it('omits depot-flying-ring and disables motion at speed="instant" and in Lite (isLowQuality) mode while keeping DOM testids', () => {
      const s0 = createInitialDepotState({
        stacks: [['RED'], ['BLUE'], []],
        targetOutput: ['RED'],
        workerStation: 'STACK_1',
      });
      const held = applyDepotAction('DEPOT_GRAB', s0).nextState;
      const sent = applyDepotAction('DEPOT_SEND_OUT', held).nextState;
      expect(sent.status).toBe('SUCCESS');

      for (const mode of ['instant', 'lowQuality'] as const) {
        if (mode === 'instant') {
          useAppStore.setState({ speed: 'instant', performanceMode: 'high' });
        } else {
          useAppStore.setState({ speed: 400, performanceMode: 'low' });
        }
        const html = renderDepot(sent);
        expect(html).toContain('data-anim-duration="0"');
        expect(html).toContain('data-anim-action="NONE"');
        expect(html).toContain('transition-duration:0ms');
        expect(html).not.toContain('data-testid="depot-flying-ring"');
        expect(html).not.toContain('depotFlyRingX');
        expect(html).not.toContain('depotOutputSlotLand');
        // Core DOM nodes remain synchronously present
        expect(html).toContain('data-testid="depot-worker-crane"');
        expect(html).toContain('data-testid="depot-stack-2-crate-0"');
        expect(html).toContain('data-testid="depot-output-slot-0"');
        expect(html).toContain('data-testid="status-success"');
      }
    });

    it('passes Phase 1 Toy-Crane Workshop audit invariants (clearance, birch bench, pegs, no padlocks, 80% ghosts, activeStationsMask)', () => {
      const stackOnly = createInitialDepotState({
        stacks: [['RED', 'BLUE'], [], []],
        targetStacks: [[], ['BLUE', 'RED'], []],
        activeStationsMask: DEPOT_DEFAULT_STACK_MASK,
      });
      const html = renderDepot(stackOnly);

      // >= 48px top HUD sky clearance & birch workbench
      expect(html).toContain('min-h-[48px]');
      expect(html).toContain('#eed1a7');
      // No padlocks on stack items, no legacy scrap bay / hud claw
      expect(html).not.toContain('🔒');
      expect(html).not.toContain('depot-scrap-bay');
      expect(html).not.toContain('depot-hud-claw');
      // High-contrast 80% dashed ghost blueprints present
      expect(html).toContain('data-testid="depot-stack-2-ghost-0"');
      expect(html).toContain('opacity-80');
      expect(html).not.toContain('opacity-25');
      // Unused QUEUE and OUT bays hidden by activeStationsMask
      expect(html).not.toContain('data-testid="depot-queue-belt"');
      expect(html).not.toContain('data-testid="depot-output-bay"');
    });
  });
});
