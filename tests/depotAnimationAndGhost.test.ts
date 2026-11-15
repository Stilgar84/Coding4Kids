import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyDepotAction,
  createInitialDepotState,
} from '../src/simulations/depot/depotPhysics';
import {
  DepotCanvas,
  computeDepotAnimDurationMs,
  computeDepotStationTravelPx,
} from '../src/simulations/depot/components/DepotCanvas';
import { DEPOT_PALETTE_ITEMS } from '../src/simulations/depot/depotEnvironment';
import {
  DEPOT_STATION_BITS,
  DepotState,
} from '../src/simulations/depot/types';
import { useAppStore } from '../src/store/useAppStore';

const ALL_STATIONS_MASK =
  DEPOT_STATION_BITS.INPUT |
  DEPOT_STATION_BITS.STACK_1 |
  DEPOT_STATION_BITS.STACK_2 |
  DEPOT_STATION_BITS.STACK_3 |
  DEPOT_STATION_BITS.QUEUE |
  DEPOT_STATION_BITS.OUT;

function renderDepot(state: DepotState): string {
  return renderToStaticMarkup(React.createElement(DepotCanvas, { state }));
}

describe('Depot Speed-Scaled Animations, Bidirectional Icon & High-Contrast Ghost Placeholders', () => {
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

  describe('1. Speed-Scaled Animation Duration & Station Travel Distances', () => {
    it('maps speed values cleanly: 1x (400 -> 1350ms), 4x (100 -> 585ms), 16x (25 -> 230ms), and disables for instant / <=0 / lowQuality / noAction', () => {
      expect(computeDepotAnimDurationMs(400, false, true)).toBe(1350);
      expect(computeDepotAnimDurationMs(100, false, true)).toBe(585);
      expect(computeDepotAnimDurationMs(25, false, true)).toBe(230);
      expect(computeDepotAnimDurationMs(10, false, true)).toBe(230);
      expect(computeDepotAnimDurationMs(1000, false, true)).toBe(3375);

      expect(computeDepotAnimDurationMs('instant', false, true)).toBe(0);
      expect(computeDepotAnimDurationMs(0, false, true)).toBe(0);
      expect(computeDepotAnimDurationMs(-50, false, true)).toBe(0);
      expect(computeDepotAnimDurationMs(400, true, true)).toBe(0);
      expect(computeDepotAnimDurationMs(400, false, false)).toBe(0);
    });

    it('computes deep pickup and placement travel distances across INPUT, STACK_1..3, and QUEUE', () => {
      expect(
        computeDepotStationTravelPx({
          type: 'GRAB',
          stepId: 1,
          fromStation: 'INPUT',
          inputIndex: 0,
          color: 'RED',
        }).grabDistPx
      ).toBe(178);

      expect(
        computeDepotStationTravelPx({
          type: 'GRAB',
          stepId: 2,
          fromStation: 'QUEUE',
          queueIndex: 0,
          color: 'BLUE',
        }).grabDistPx
      ).toBe(166);

      const bottomSlot = computeDepotStationTravelPx({
        type: 'GRAB',
        stepId: 3,
        fromStation: 'STACK_1',
        stackIndex: 0,
        stackSlotIndex: 0,
        color: 'GREEN',
      });
      const highSlot = computeDepotStationTravelPx({
        type: 'GRAB',
        stepId: 4,
        fromStation: 'STACK_1',
        stackIndex: 0,
        stackSlotIndex: 3,
        color: 'GREEN',
      });
      expect(bottomSlot.grabDistPx).toBe(182);
      expect(highSlot.grabDistPx).toBe(116);
      expect(bottomSlot.grabDistPx).toBeGreaterThan(highSlot.grabDistPx);

      const queuePlace = computeDepotStationTravelPx({
        type: 'PLACE',
        stepId: 5,
        toStation: 'QUEUE',
        queueIndex: 2,
        color: 'AMBER',
      });
      expect(queuePlace.placeDistPx).toBe(166);
      expect(queuePlace.placeDxPx).toBe(24);
    });
  });

  describe('2. Visible Block Movement To/From Gripper for ALL Stations (GRAB, PLACE, MOVE, SEND_OUT)', () => {
    it('animates deep gripper plunge and lift on GRAB from INPUT, STACK_1, and QUEUE at 1x (1350ms)', () => {
      const s0 = createInitialDepotState({
        input: [{ color: 'AMBER' }, { color: 'CYAN' }],
        stacks: [['RED', 'BLUE'], [], []],
        queue: [{ color: 'GREEN' }, { color: 'PURPLE' }],
        targetOutput: ['AMBER'],
        workerStation: 'INPUT',
        activeStationsMask: ALL_STATIONS_MASK,
      });

      // GRAB from INPUT
      const grabbedInput = applyDepotAction('DEPOT_GRAB', s0).nextState;
      const inputHtml = renderDepot(grabbedInput);
      expect(inputHtml).toContain('data-anim-action="GRAB"');
      expect(inputHtml).toContain('data-anim-duration="1350"');
      expect(inputHtml).toContain('--depot-grab-dist:178px');
      expect(inputHtml).toContain('depotSpringPlunge 1350ms linear both');
      expect(inputHtml).toContain('depotJawsPlunge 1350ms linear both');
      expect(inputHtml).toContain('depotJawLeftGrab 1350ms linear both');
      expect(inputHtml).toContain('data-testid="depot-claw-held-crate"');
      expect(inputHtml).toContain('depotHeldRingGrabLiftQueue 1350ms linear both');
      expect(inputHtml).toContain('depotInputSlideDown 1350ms cubic-bezier(0.22, 1, 0.36, 1) both');

      // GRAB from STACK_1 (slotIdx 1 -> 182 - 22 = 160px)
      const atStack1 = applyDepotAction('DEPOT_MOVE_TO', s0, { station: 'STACK_1' }).nextState;
      const grabbedStack = applyDepotAction('DEPOT_GRAB', atStack1).nextState;
      const stackHtml = renderDepot(grabbedStack);
      expect(stackHtml).toContain('--depot-grab-dist:160px');
      expect(stackHtml).toContain('depotHeldRingGrabLift 1350ms linear both');
      expect(stackHtml).toContain('depotSpringPlunge 1350ms linear both');

      // GRAB from QUEUE
      const atQueue = applyDepotAction('DEPOT_MOVE_TO', s0, { station: 'QUEUE' }).nextState;
      const grabbedQueue = applyDepotAction('DEPOT_GRAB', atQueue).nextState;
      const queueHtml = renderDepot(grabbedQueue);
      expect(queueHtml).toContain('--depot-grab-dist:166px');
      expect(queueHtml).toContain('depotHeldRingGrabLiftQueue 1350ms linear both');
      expect(queueHtml).toContain('depotQueueSlideLeft 1350ms cubic-bezier(0.22, 1, 0.36, 1) both');
      expect(queueHtml).toContain('depotRollerSpin 1350ms linear both');
    });

    it('renders in-flight ring traveling down from gripper on PLACE to STACK_2 and QUEUE while delaying destination reveal', () => {
      const s0 = createInitialDepotState({
        input: [{ color: 'RED' }],
        stacks: [['BLUE'], [], []],
        queue: [{ color: 'GREEN' }],
        targetStacks: [[], ['RED'], []],
        workerStation: 'INPUT',
        activeStationsMask: ALL_STATIONS_MASK,
      });

      const held = applyDepotAction('DEPOT_GRAB', s0).nextState;
      const atStack2 = applyDepotAction('DEPOT_MOVE_TO', held, { station: 'STACK_2' }).nextState;
      const placedStack2 = applyDepotAction('DEPOT_PLACE', atStack2).nextState;

      const placeStackHtml = renderDepot(placedStack2);
      expect(placeStackHtml).toContain('data-anim-action="PLACE"');
      expect(placeStackHtml).toContain('data-testid="depot-inflight-place-ring"');
      expect(placeStackHtml).not.toContain('data-testid="depot-claw-held-crate"');
      expect(placeStackHtml).toContain('--depot-place-dist:182px');
      expect(placeStackHtml).toContain('--depot-place-x:0px');
      expect(placeStackHtml).toContain('depotPlaceRingTravel 1350ms linear both');
      expect(placeStackHtml).toContain('depotSpringDip 1350ms linear both');
      expect(placeStackHtml).toContain('depotJawsDip 1350ms linear both');
      expect(placeStackHtml).toContain('depotStackRingDrop 1350ms ease-out both');
      expect(placeStackHtml).toContain('data-depot-slot="STACK_2-0"');
      expect(placeStackHtml).toContain('data-testid="depot-stack-2-crate-0"');

      // PLACE onto QUEUE (index 1 -> placeDxPx = 0, placeDistPx = 166)
      const heldStack1 = applyDepotAction('DEPOT_GRAB', { ...s0, workerStation: 'STACK_1' }).nextState;
      const atQueue = applyDepotAction('DEPOT_MOVE_TO', heldStack1, { station: 'QUEUE' }).nextState;
      const placedQueue = applyDepotAction('DEPOT_PLACE', atQueue).nextState;

      const placeQueueHtml = renderDepot(placedQueue);
      expect(placeQueueHtml).toContain('data-testid="depot-inflight-place-ring"');
      expect(placeQueueHtml).toContain('--depot-place-dist:166px');
      expect(placeQueueHtml).toContain('depotPlaceRingTravel 1350ms linear both');
      expect(placeQueueHtml).toContain('depotQueueRingDrop 1350ms ease-out both');
      expect(placeQueueHtml).toContain('depotFunnelPulse 1350ms ease-out both');
      expect(placeQueueHtml).toContain('data-depot-queue-belt="true"');
    });

    it('renders SEND_OUT flying ring, MOVE horizontal carriage carry across all stations, and scales at 4x / 16x', () => {
      const s0 = createInitialDepotState({
        input: [{ color: 'RED' }],
        stacks: [[], [], []],
        queue: [{ color: 'BLUE' }],
        targetOutput: ['RED'],
        workerStation: 'INPUT',
        activeStationsMask: ALL_STATIONS_MASK,
      });

      const held = applyDepotAction('DEPOT_GRAB', s0).nextState;
      const movedRight = applyDepotAction('DEPOT_MOVE_TO', held, { station: 'QUEUE' }).nextState;
      const moveRightHtml = renderDepot(movedRight);
      expect(moveRightHtml).toContain('data-anim-action="MOVE"');
      expect(moveRightHtml).toContain('transition-duration:1350ms');
      expect(moveRightHtml).toContain('cubic-bezier(0.22, 1, 0.36, 1)');
      expect(moveRightHtml).toContain('depotCableSwayRight 1350ms');
      expect(moveRightHtml).toContain('data-testid="depot-claw-held-crate"');

      const movedLeft = applyDepotAction('DEPOT_MOVE_TO', movedRight, { station: 'STACK_1' }).nextState;
      const moveLeftHtml = renderDepot(movedLeft);
      expect(moveLeftHtml).toContain('depotCableSwayLeft 1350ms');

      const sentOut = applyDepotAction('DEPOT_SEND_OUT', movedLeft).nextState;
      useAppStore.setState({ speed: 100 });
      const sendOut4xHtml = renderDepot(sentOut);
      expect(sendOut4xHtml).toContain('data-anim-duration="585"');
      expect(sendOut4xHtml).toContain('data-testid="depot-flying-ring"');
      expect(sendOut4xHtml).toContain('data-from-station="STACK_1"');
      expect(sendOut4xHtml).toContain('depotFlyRingX 585ms');
      expect(sendOut4xHtml).toContain('depotFlyRingY 585ms');
      expect(sendOut4xHtml).toContain('depotOutputSlotLand 585ms ease-out both');

      useAppStore.setState({ speed: 25 });
      const sendOut16xHtml = renderDepot(sentOut);
      expect(sendOut16xHtml).toContain('data-anim-duration="230"');
      expect(sendOut16xHtml).toContain('depotFlyRingX 230ms');
      expect(sendOut16xHtml).toContain('depotOutputSlotLand 230ms ease-out both');
    });

    it('omits in-flight PLACE and SEND_OUT animations when speed="instant" or performanceMode="low"', () => {
      const s0 = createInitialDepotState({
        stacks: [['RED'], [], []],
        workerStation: 'STACK_1',
        activeStationsMask: ALL_STATIONS_MASK,
      });
      const held = applyDepotAction('DEPOT_GRAB', s0).nextState;
      const atStack2 = applyDepotAction('DEPOT_MOVE_TO', held, { station: 'STACK_2' }).nextState;
      const placed = applyDepotAction('DEPOT_PLACE', atStack2).nextState;

      useAppStore.setState({ speed: 'instant', performanceMode: 'high' });
      const instantHtml = renderDepot(placed);
      expect(instantHtml).toContain('data-anim-duration="0"');
      expect(instantHtml).not.toContain('data-testid="depot-inflight-place-ring"');
      expect(instantHtml).toContain('data-testid="depot-stack-2-crate-0"');

      useAppStore.setState({ speed: 400, performanceMode: 'low' });
      const lowHtml = renderDepot(placed);
      expect(lowHtml).toContain('data-anim-duration="0"');
      expect(lowHtml).not.toContain('data-testid="depot-inflight-place-ring"');
      expect(lowHtml).toContain('data-testid="depot-stack-2-crate-0"');
    });
  });

  describe('3. Item 4 — Bidirectional Horizontal Arrow Icon for DEPOT_MOVE_TO', () => {
    it('renders gantry rail, vertical trolley, horizontal shaft, and both left/right arrowheads', () => {
      const moveItem = DEPOT_PALETTE_ITEMS.find((item) => item.actionType === 'DEPOT_MOVE_TO');
      expect(moveItem).toBeDefined();

      const svgInactive = renderToStaticMarkup(moveItem!.icon({ isActive: false }));
      const svgActive = renderToStaticMarkup(moveItem!.icon({ isActive: true }));

      for (const svg of [svgInactive, svgActive]) {
        expect(svg).toContain('d="M3 6 L21 6"');
        expect(svg).toContain('x1="12" y1="6" x2="12" y2="11"');
        expect(svg).toContain('d="M4 15 L20 15"');
        expect(svg).toContain('points="8 11 4 15 8 19"');
        expect(svg).toContain('points="16 11 20 15 16 19"');
      }
      expect(svgInactive).toContain('stroke-white');
      expect(svgActive).toContain('stroke-slate-950');
    });
  });

  describe('4. Item 5a — High-Contrast Target Block Ghost Placeholders', () => {
    it('renders target stack and output ghost placeholders with opacity-80 dashed styling (never opacity-25)', () => {
      const state = createInitialDepotState({
        stacks: [[], [], []],
        targetStacks: [['RED', 'WHITE'], ['CYAN', 'BLUE'], ['AMBER']],
        targetOutput: ['PURPLE', 'WHITE', 'GREEN'],
        activeStationsMask: ALL_STATIONS_MASK,
      });

      const html = renderDepot(state);

      // Stack ghosts rendered across slots
      expect(html).toContain('data-testid="depot-stack-1-ghost-0"');
      expect(html).toContain('data-testid="depot-stack-1-ghost-1"');
      expect(html).toContain('data-testid="depot-stack-2-ghost-0"');
      expect(html).toContain('data-testid="depot-stack-2-ghost-1"');
      expect(html).toContain('data-testid="depot-stack-3-ghost-0"');

      // Output slot ghosts rendered cleanly
      expect(html).toContain('data-testid="depot-output-slot-0"');
      expect(html).toContain('data-testid="depot-output-slot-1"');
      expect(html).toContain('data-testid="depot-output-slot-2"');

      // High-contrast dashed ghost styling + visible WHITE ghost tint
      expect(html).toContain('opacity-80');
      expect(html).toContain('border-dashed');
      expect(html).toContain('rgba(203, 213, 225, 0.55)');
      expect(html).not.toContain('opacity-25');
    });
  });
});
