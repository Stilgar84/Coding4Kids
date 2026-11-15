import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { WorkspaceState } from '../src/types';
import { CurriculumActivity } from '../src/data/curriculum/types';
import { runHeadlessSimulation } from '../src/engine/simulationRunner';
import { BinaryWriter } from '../src/engine/serialization/binaryWriter';
import { BinaryReader } from '../src/engine/serialization/binaryReader';
import { exportToBinary, importFromBinary } from '../src/engine/serialization/codeSerializer';
import { toVariableName } from '../src/types';
import {
  ENV_ID_SWITCHYARD,
  ENV_VERSION_SWITCHYARD,
  ENV_VERSION_SWITCHYARD_V2,
  getSwitchyardSerializationVersion,
  readSwitchyardBlock,
  readSwitchyardState,
  writeSwitchyardParams,
  writeSwitchyardState,
  OP_SWITCHYARD_SWITCH_LEFT,
} from '../src/engine/serialization/env/switchyardSerializer';
import {
  applySwitchyardAction,
  computeSwitchyardScaleMetrics,
  createInitialSwitchyardState,
  evaluateSwitchyardCompletion,
  readSwitchyardNumericSensor,
  readSwitchyardTypedSensor,
  resetSwitchyardState,
} from '../src/simulations/switchyard/physics';
import {
  SWITCHYARD_SENSORS,
  switchyardSimulationEnvironment,
} from '../src/simulations/switchyard/switchyardEnvironment';
import {
  SwitchyardCanvas,
  computeSwitchyardAnimDurationMs,
} from '../src/simulations/switchyard/components/SwitchyardCanvas';
import {
  verifySwitchyardActivityConstraints,
  verifySwitchyardActivityRule,
} from '../src/engine/verification/switchyardConstraintSolver';
import { BlockSubpalette } from '../src/components/BlockSubpalette';
import { useAppStore } from '../src/store/useAppStore';

function makeWs(
  main: WorkspaceState['MAIN'],
  f1: WorkspaceState['F1'] = []
): WorkspaceState {
  return { MAIN: main, F1: f1, F2: [], F3: [] };
}

describe('Switchyard Phase 3 (cmp): Weights, Quotas, Parity, Overweight Scrap & Balance Scale', () => {
  const initialAppMode = useAppStore.getState().appMode;
  const initialActiveSimId = useAppStore.getState().activeSimId;
  const initialActiveActivityId = useAppStore.getState().activeActivityId;

  beforeEach(() => {
    useAppStore.setState({
      appMode: initialAppMode,
      activeSimId: initialActiveSimId,
      activeActivityId: initialActiveActivityId,
    });
  });

  it('enforces railcar weight bounds, paritySlot (#seq), ✓ FULL over-quota collision, and cmp.9 partial-eligible quota', () => {
    // 1. Weight thresholds (minWeight / maxWeight)
    const weightState = createInitialSwitchyardState({
      incomingStream: [
        { color: 'blue', icon: 'crate', weight: 8, seqTag: '#1' },
        { color: 'red', icon: 'crate', weight: 14, seqNum: 2 },
      ],
      switches: [{ id: 'A', initialDirection: 'LEFT' }],
      docks: [
        { id: 'A', maxWeight: 10 },
        { id: 'B', minWeight: 11 },
      ],
    });
    expect(weightState.queue[0].seqNum).toBe(1);
    expect(weightState.queue[1].seqNum).toBe(2);

    // Sending 8kg Left -> Dock A succeeds; sending 14kg Left -> Dock A collides with WEIGHT_MISMATCH
    const after8 = applySwitchyardAction('SEND_NEXT', weightState);
    expect(after8.status).toBe('IDLE');
    const bad14Left = applySwitchyardAction('SEND_NEXT', after8);
    expect(bad14Left.status).toBe('COLLISION');
    expect(bad14Left.lastFailureReason).toBe('WEIGHT_LIMIT_VIOLATED');
    expect(bad14Left.lastFailureDetail?.code).toBe('WEIGHT_MISMATCH');

    // Switching Right routes 14kg -> Dock B cleanly -> SUCCESS
    const swRight = applySwitchyardAction('SWITCH_RIGHT', after8);
    const ok14Right = applySwitchyardAction('SEND_NEXT', swRight);
    expect(ok14Right.status).toBe('SUCCESS');

    // 2. Parity slot ('odd' vs 'even')
    const parityState = createInitialSwitchyardState({
      incomingStream: [
        { color: 'blue', icon: 'crate', seqNum: 1 },
        { color: 'amber', icon: 'crate', seqNum: 2 },
        { color: 'green', icon: 'crate', seqNum: 3 },
      ],
      switches: [{ id: 'A', initialDirection: 'LEFT' }],
      docks: [
        { id: 'A', paritySlot: 'odd' },
        { id: 'B', paritySlot: 'even' },
      ],
    });
    const p1 = applySwitchyardAction('SEND_NEXT', parityState);
    expect(p1.status).toBe('IDLE');
    // Sending #2 to odd Dock A fails with PARITY_MISMATCH
    const badP2 = applySwitchyardAction('SEND_NEXT', p1);
    expect(badP2.status).toBe('COLLISION');
    expect(badP2.lastFailureReason).toBe('PARITY_SLOT_VIOLATED');
    expect(badP2.lastFailureDetail).toMatchObject({
      code: 'PARITY_MISMATCH',
      dockId: 'DOCK_A',
      expectedParity: 'odd',
      actualSeqNum: 2,
    });

    // 3. cmp.9 Variant #3: stream [10, 10, 4, 8] with Dock A maxWeight=9, quota=3 (only 2 eligible!)
    const cmp9Var3 = createInitialSwitchyardState({
      incomingStream: [
        { color: 'red', icon: 'crate', weight: 10 },
        { color: 'red', icon: 'crate', weight: 10 },
        { color: 'blue', icon: 'crate', weight: 4 },
        { color: 'blue', icon: 'crate', weight: 8 },
      ],
      switches: [{ id: 'A', initialDirection: 'RIGHT' }],
      docks: [
        { id: 'A', maxWeight: 9, quota: 3 },
        { id: 'B' },
      ],
    });
    // Bypass sending all 4 to Dock B leaves Dock A at 0 < min(3, 2)=2 -> COLLISION!
    const allToBRun = runHeadlessSimulation(
      makeWs([{ id: 's1', type: 'SEND_NEXT', repeatCount: 4 }]),
      'switchyard',
      cmp9Var3,
      50
    );
    expect(allToBRun.status).toBe('COLLISION');
    expect(allToBRun.finalState.lastFailureReason).toBe('DOCK_QUOTA_EXCEEDED');

    // Sending [10, 10] to Dock B and [4, 8] to Dock A (2 === min(3, 2)) -> SUCCESS!
    const validCmp9Var3Run = runHeadlessSimulation(
      makeWs([
        { id: 'b1', type: 'SEND_NEXT', repeatCount: 2 },
        { id: 'b2', type: 'SWITCH_LEFT', params: { junction: 'A' } },
        { id: 'b3', type: 'SEND_NEXT', repeatCount: 2 },
      ]),
      'switchyard',
      cmp9Var3,
      50
    );
    expect(validCmp9Var3Run.status).toBe('SUCCESS');
    expect(validCmp9Var3Run.finalState.docks[0].items).toHaveLength(2);
    expect(validCmp9Var3Run.finalState.docks[1].items).toHaveLength(2);
  });

  it('enforces scrapRule: damaged_or_overweight (cmp.A boundary 20kg vs >20kg) on both SCRAP_ITEM and SEND_NEXT', () => {
    const cmpAState = createInitialSwitchyardState({
      incomingStream: [
        { color: 'red', icon: 'crate', damaged: true, weight: 8 },
        { color: 'orange', icon: 'crate', damaged: false, weight: 25 },
        { color: 'green', icon: 'crate', damaged: false, weight: 20 },
      ],
      switches: [{ id: 'A', initialDirection: 'LEFT' }],
      docks: [
        { id: 'A', quota: 1, acceptsDamaged: false },
        { id: 'B', acceptsDamaged: false },
      ],
      scrapRules: { kind: 'damaged_or_overweight', maxWeight: 20 } as any,
    });

    expect(cmpAState.scrapRule).toBe('damaged_or_overweight');
    expect(cmpAState.scrapMaxWeight).toBe(20);

    // 1. Damaged 8kg crate -> valid scrap
    const s1 = applySwitchyardAction('SCRAP_ITEM', cmpAState);
    expect(s1.status).toBe('IDLE');
    expect(s1.scrapped).toHaveLength(1);

    // 2. Intact 25kg (>20) overweight crate -> rejected by Dock A if sent, valid if scrapped!
    const badSendOverweight = applySwitchyardAction('SEND_NEXT', s1);
    expect(badSendOverweight.status).toBe('COLLISION');
    expect(badSendOverweight.lastFailureReason).toBe('WEIGHT_LIMIT_VIOLATED');
    expect(badSendOverweight.lastFailureDetail?.code).toBe('WEIGHT_MISMATCH');

    const s2 = applySwitchyardAction('SCRAP_ITEM', s1);
    expect(s2.status).toBe('IDLE');
    expect(s2.scrapped).toHaveLength(2);

    // 3. Intact 20kg (<=20 boundary) crate -> scrapping collides with GOOD_SCRAPPED; sending succeeds!
    const badScrapBoundary = applySwitchyardAction('SCRAP_ITEM', s2);
    expect(badScrapBoundary.status).toBe('COLLISION');
    expect(badScrapBoundary.lastFailureReason).toBe('GOOD_ITEM_SCRAPPED');
    expect(badScrapBoundary.lastFailureDetail?.code).toBe('GOOD_SCRAPPED');

    const okSendBoundary = applySwitchyardAction('SEND_NEXT', s2);
    expect(okSendBoundary.status).toBe('SUCCESS');
    expect(okSendBoundary.docks[0].items).toHaveLength(1);
  });

  it('evaluates mode: balance_scale (cmp.M2) live pan weights, tilt degrees, tolerance, and 4 adversarial streams', () => {
    const scaleState = createInitialSwitchyardState({
      mode: 'balance_scale',
      balanceTolerance: 0,
      incomingStream: [
        { color: 'blue', icon: 'crate', weight: 6 },
        { color: 'blue', icon: 'crate', weight: 6 },
        { color: 'red', icon: 'crate', weight: 12 },
      ],
      switches: [{ id: 'A', initialDirection: 'LEFT' }],
      docks: [{ id: 'A' }, { id: 'B' }],
    });

    expect(scaleState.mode).toBe('balance_scale');
    expect(scaleState.leftWeightSum).toBe(0);
    expect(scaleState.rightWeightSum).toBe(0);
    expect(scaleState.beamTiltDeg).toBe(0);

    // Send 6 Left -> ΣLeft=6, ΣRight=0, negative tilt
    const step1 = applySwitchyardAction('SEND_NEXT', scaleState);
    expect(step1.leftWeightSum).toBe(6);
    expect(step1.rightWeightSum).toBe(0);
    expect(step1.beamTiltDeg).toBeLessThan(0);

    // Imbalanced finish (all 3 Left -> 24 vs 0) fails with SCALE_IMBALANCED / BALANCE_MISMATCH
    const step2Bad = applySwitchyardAction('SEND_NEXT', step1);
    const step3Bad = applySwitchyardAction('SEND_NEXT', step2Bad);
    expect(step3Bad.status).toBe('COLLISION');
    expect(step3Bad.lastFailureReason).toBe('SCALE_IMBALANCED');
    expect(step3Bad.lastFailureDetail).toEqual({
      code: 'BALANCE_MISMATCH',
      leftWeightSum: 24,
      rightWeightSum: 0,
      balanceTolerance: 0,
    });
    expect(evaluateSwitchyardCompletion(step3Bad)).toBe('COLLISION');

    // Reset clears live scale sums
    const reset = resetSwitchyardState(step3Bad);
    expect(reset.leftWeightSum).toBe(0);
    expect(reset.rightWeightSum).toBe(0);
    expect(reset.beamTiltDeg).toBe(0);

    // Tolerance test: |10 - 8| = 2 passes when balanceTolerance = 2
    const tolState = createInitialSwitchyardState({
      mode: 'balance_scale',
      balanceTolerance: 2,
      incomingStream: [
        { color: 'blue', icon: 'crate', weight: 10 },
        { color: 'amber', icon: 'crate', weight: 8 },
      ],
      switches: [{ id: 'A', initialDirection: 'LEFT' }],
      docks: [{ id: 'A' }, { id: 'B' }],
    });
    const tolRun = runHeadlessSimulation(
      makeWs([
        { id: 't1', type: 'SEND_NEXT' },
        { id: 't2', type: 'SWITCH_RIGHT', params: { junction: 'A' } },
        { id: 't3', type: 'SEND_NEXT' },
      ]),
      'switchyard',
      tolState,
      30
    );
    expect(tolRun.status).toBe('SUCCESS');
    expect(computeSwitchyardScaleMetrics(tolRun.finalState.docks)).toMatchObject({
      leftWeightSum: 10,
      rightWeightSum: 8,
    });
  });

  it('evaluates $itemWeight (0xA8), $itemColor (0xA9), $dockQuota[i] (0xAA), $dockCount[i] (0xAB car-count purity), TYPE_ERROR on empty queue, and binary roundtrip', () => {
    const sensorState = createInitialSwitchyardState({
      incomingStream: [
        { color: 'amber', icon: 'crate', weight: 14 },
        { color: 'purple', icon: 'gear', weight: 18 },
        { color: 'blue', icon: 'gem', weight: 9 },
      ],
      switches: [{ id: 'A', initialDirection: 'LEFT' }],
      docks: [
        { id: 'A', quota: 2 },
        { id: 'B', quota: 1 },
      ],
    });
    const threeDockProbe = createInitialSwitchyardState({
      docks: [{ id: 'A', quota: 2 }, { id: 'B', quota: 1 }, { id: 'C', quota: 3 }],
    });

    expect(SWITCHYARD_SENSORS.map((s) => s.id)).toEqual(
      expect.arrayContaining(['$itemWeight', '$itemColor', '$dockQuota[0]', '$dockCount[0]'])
    );

    // Check typed & numeric sensors before dispatch
    expect(readSwitchyardTypedSensor('$itemWeight', sensorState)).toBe(14);
    expect(readSwitchyardTypedSensor('$itemColor', sensorState)).toEqual({
      type: 'color',
      value: 'amber',
    });
    expect(readSwitchyardTypedSensor('$dockQuota', sensorState)).toBe(2);
    expect(readSwitchyardTypedSensor('$dockQuota[0]', sensorState)).toBe(2);
    expect(readSwitchyardTypedSensor('$dockQuota[1]', sensorState)).toBe(1);
    expect(readSwitchyardTypedSensor('$dockQuota[C]', threeDockProbe)).toBe(3);

    // Park all 3 cars and verify $dockCount[0] is car count (NOT weight sum!)
    const afterOne = applySwitchyardAction('SEND_NEXT', sensorState);
    const afterTwo = applySwitchyardAction('SEND_NEXT', afterOne);
    expect(readSwitchyardTypedSensor('$dockCount[0]', afterTwo)).toBe(2);
    expect(readSwitchyardNumericSensor('$dockCount[A]', afterTwo)).toBe(2);
    const afterThree = applySwitchyardAction(
      'SEND_NEXT',
      applySwitchyardAction('SWITCH_RIGHT', afterTwo)
    );

    // Empty queue returns undefined in readTypedSensor -> triggers TYPE_ERROR in interpreter!
    expect(readSwitchyardTypedSensor('$itemWeight', afterThree)).toBeUndefined();
    expect(readSwitchyardTypedSensor('$itemColor', afterThree)).toBeUndefined();
    const unguardedEmptyRun = runHeadlessSimulation(
      makeWs([{ id: 'u1', type: 'VAR_ASSIGN', params: { a: 'a', b: '$itemWeight' } }]),
      'switchyard',
      afterThree,
      10
    );
    expect(unguardedEmptyRun.status).toBe('TYPE_ERROR');

    // Full serializeProgram / deserializeProgram binary roundtrip with 0x30 CMP & 0xA8..0xAB
    const cmpWs = makeWs([
      {
        id: 'w1',
        type: 'WHILE',
        params: { condition: { kind: 'sensor', sensor: 'hasNextItem' } },
      },
      {
        id: 'i1',
        type: 'IF',
        params: {
          condition: {
            kind: 'and',
            left: { kind: 'cmp', op: '<=', left: '$itemWeight', right: 20 },
            right: { kind: 'cmp', op: '<', left: '$dockCount[0]', right: '$dockQuota[0]' },
          },
        },
      },
      { id: 'swL', type: 'SWITCH_LEFT', params: { junction: 'A' } },
      { id: 'el1', type: 'ELSE' },
      { id: 'swR', type: 'SWITCH_RIGHT', params: { junction: 'A' } },
      { id: 'ei1', type: 'END_IF' },
      { id: 'sn1', type: 'SEND_NEXT' },
      { id: 'ew1', type: 'END_WHILE' },
    ]);

    const encoded = exportToBinary(cmpWs, 'switchyard', sensorState);
    expect(encoded[1]).toBe(ENV_ID_SWITCHYARD);
    expect(encoded[2]).toBe(ENV_VERSION_SWITCHYARD_V2);
    const decoded = importFromBinary(encoded);
    expect(decoded.success).toBe(true);
    expect(decoded.envId).toBe('switchyard');
    expect(decoded.envVersion).toBe(ENV_VERSION_SWITCHYARD_V2);

    const execDecoded = runHeadlessSimulation(
      decoded.workspace!,
      'switchyard',
      decoded.switchyardState,
      100
    );
    expect(execDecoded.status).toBe('SUCCESS');
    expect(execDecoded.finalState.docks[0].items).toHaveLength(2);

    // Sandbox BlockSubpalette exposes Switchyard Phase 3 sensors on VAR_ASSIGN
    useAppStore.getState().setAppMode('sandbox');
    useAppStore.getState().setSimEnvironment('switchyard');
    useAppStore.setState({
      workspace: makeWs([{ id: 'va1', type: 'VAR_ASSIGN', params: { a: 'a', b: 0 } }]),
      selectedBlockId: 'va1',
    });
    const subpaletteHtml = renderToStaticMarkup(React.createElement(BlockSubpalette));
    expect(subpaletteHtml).toContain('subpalette-assign-b-sensor-$itemWeight');
    expect(subpaletteHtml).toContain('subpalette-assign-b-sensor-$dockQuota[0]');
    expect(subpaletteHtml).toContain('subpalette-assign-b-sensor-$dockCount[0]');
  });

  it('round-trips ENV_VERSION_SWITCHYARD_V2 = 2 Phase 3 state fields losslessly while preserving v1 wire compat', () => {
    const v1State = createInitialSwitchyardState({
      switches: [{ id: 'A', initialDirection: 'LEFT' }],
      incomingStream: [{ color: 'red', icon: 'crate', damaged: false }],
      docks: [
        { id: 'A', expectedColor: 'red' },
        { id: 'B', expectedColor: 'blue' },
      ],
    });
    expect(getSwitchyardSerializationVersion(v1State)).toBe(ENV_VERSION_SWITCHYARD);

    const v2Phase3State = createInitialSwitchyardState({
      mode: 'balance_scale',
      balanceTolerance: 3,
      scrapRules: { kind: 'damaged_or_overweight', maxWeight: 20 } as any,
      switches: [
        { id: 'A', initialDirection: 'RIGHT', leftTarget: 'DOCK_A', rightTarget: 'SWITCH_B' },
        { id: 'B', initialDirection: 'LEFT', leftTarget: 'DOCK_B', rightTarget: 'SWITCH_C' },
        { id: 'C', initialDirection: 'RIGHT', leftTarget: 'DOCK_B', rightTarget: 'DOCK_C' },
      ],
      incomingStream: [
        { color: 'cyan', icon: 'gem', damaged: false, weight: 14, seqNum: 1 },
        { color: 'orange', icon: 'battery', damaged: true, weight: 25, seqNum: 2 },
      ],
      docks: [
        {
          id: 'A',
          quota: 2,
          minWeight: 5,
          maxWeight: 20,
          paritySlot: 'odd',
          expectedItems: [{ color: 'cyan', icon: 'gem', weight: 14, seqNum: 1 }],
        },
        {
          id: 'B',
          paritySlot: 'even',
          isReturnBay: true,
        },
        {
          id: 'C',
          maxWeight: 30,
        },
      ],
      tape: { '0': 14, '-2': -7 },
    });
    expect(getSwitchyardSerializationVersion(v2Phase3State)).toBe(ENV_VERSION_SWITCHYARD_V2);

    const writer = new BinaryWriter();
    writeSwitchyardState(writer, v2Phase3State, ENV_VERSION_SWITCHYARD_V2);
    const reader = new BinaryReader(writer.getBytes());
    const decoded = readSwitchyardState(reader, ENV_VERSION_SWITCHYARD_V2);

    expect(decoded.mode).toBe('balance_scale');
    expect(decoded.balanceTolerance).toBe(3);
    expect(decoded.scrapRule).toBe('damaged_or_overweight');
    expect(decoded.scrapMaxWeight).toBe(20);
    expect(decoded.switches).toHaveLength(3);
    expect(decoded.switches[2]).toMatchObject({
      id: 'C',
      initialDirection: 'RIGHT',
      leftTarget: 'DOCK_B',
      rightTarget: 'DOCK_C',
    });
    expect(decoded.queue[0]).toMatchObject({
      color: 'CYAN',
      icon: 'CRYSTAL',
      damaged: false,
      weight: 14,
      seqNum: 1,
    });
    expect(decoded.queue[1]).toMatchObject({
      color: 'ORANGE',
      icon: 'BATTERY',
      damaged: true,
      weight: 25,
      seqNum: 2,
    });
    expect(decoded.docks[0].spec).toMatchObject({
      dockId: 'DOCK_A',
      quota: 2,
      minWeight: 5,
      maxWeight: 20,
      paritySlot: 'odd',
      expectedItems: [{ color: 'CYAN', icon: 'CRYSTAL', weight: 14, seqNum: 1 }],
    });
    expect(decoded.docks[1].spec).toMatchObject({
      dockId: 'DOCK_B',
      paritySlot: 'even',
      isReturnBay: true,
    });
    expect(decoded.tape).toEqual({ '0': 14, '-2': -7 });

    // Optional junction C opcode roundtrip
    const opW = new BinaryWriter();
    writeSwitchyardParams(opW, OP_SWITCHYARD_SWITCH_LEFT, { junction: 'C' });
    const opR = new BinaryReader(opW.getBytes());
    expect(readSwitchyardBlock(opR, OP_SWITCHYARD_SWITCH_LEFT)).toEqual({
      type: 'SWITCH_LEFT',
      params: { junction: 'C' },
    });
  });

  it('preserves Stage A UX invariants (anim speed schedule, sy-tunnel-arch-clip, outer <g transform> + inner <g style>) and renders Phase 3 visuals cleanly', () => {
    // 1. Stage A speed-scaled animation duration contract (1350 / 585 / 230 / 0)
    expect(computeSwitchyardAnimDurationMs(400, false, true)).toBe(1350);
    expect(computeSwitchyardAnimDurationMs(Number.NaN, false, true)).toBe(1350);
    expect(computeSwitchyardAnimDurationMs(100, false, true)).toBe(585);
    expect(computeSwitchyardAnimDurationMs(25, false, true)).toBe(230);
    expect(computeSwitchyardAnimDurationMs('instant', false, true)).toBe(0);
    expect(computeSwitchyardAnimDurationMs(400, true, true)).toBe(0);
    expect(computeSwitchyardAnimDurationMs(400, false, false)).toBe(0);

    // 2. Render full Dock A + overweight scrap + inflight wagon in Sandbox
    useAppStore.getState().setAppMode('sandbox');
    useAppStore.setState({ speed: 400 });

    const preFull = createInitialSwitchyardState({
      scrapRules: { kind: 'damaged_or_overweight', maxWeight: 20 } as any,
      incomingStream: [
        { id: 'c1', color: 'blue', icon: 'crate', weight: 14, seqNum: 1 },
        { id: 'c2', color: 'red', icon: 'gear', weight: 8, seqNum: 2 },
        { id: 'c3', color: 'green', icon: 'battery', weight: 6, seqNum: 3 },
      ],
      switches: [{ id: 'A', initialDirection: 'LEFT' }],
      docks: [
        { id: 'A', quota: 1, maxWeight: 20, paritySlot: 'odd' },
        { id: 'B', paritySlot: 'even' },
      ],
    });
    const fullAfterSend = applySwitchyardAction('SEND_NEXT', preFull);

    const html = renderToStaticMarkup(
      React.createElement(SwitchyardCanvas, { state: fullAfterSend })
    );
    expect(html).toContain('id="sy-tunnel-arch-clip"');
    expect(html).toContain('clip-path="url(#sy-tunnel-arch-clip)"');
    expect(html).toContain('data-testid="switchyard-weight-plate"');
    expect(html).toContain('data-testid="switchyard-scanner-weight"');
    expect(html).toContain('data-testid="switchyard-seq-tag"');
    expect(html).toContain('data-testid="switchyard-dock-full-gate-DOCK_A"');
    expect(html).toContain('✓ FULL');
    expect(html).toContain('data-testid="switchyard-scrap-overweight-badge"');
    expect(html).toContain('data-testid="switchyard-inflight-wagon"');

    // Outer <g data-testid="switchyard-inflight-wagon" transform="translate(320, 199)"> must NOT carry CSS style
    const inflightMatch = /<g[^>]*data-testid="switchyard-inflight-wagon"[^>]*>/.exec(html);
    expect(inflightMatch).not.toBeNull();
    expect(inflightMatch![0]).toContain('transform="translate(320, 199)"');
    expect(inflightMatch![0]).not.toContain('style=');

    const scannerWagonMatch = /<g[^>]*data-testid="switchyard-scanner-wagon"[^>]*>/.exec(html);
    expect(scannerWagonMatch).not.toBeNull();
    expect(scannerWagonMatch![0]).toContain('transform="translate(320, 199)');
    expect(scannerWagonMatch![0]).not.toContain('style=');

    // 3. Balance Scale SVG & Live Delta Meter
    const balanceState = applySwitchyardAction(
      'SEND_NEXT',
      createInitialSwitchyardState({
        mode: 'balance_scale',
        incomingStream: [
          { color: 'blue', icon: 'crate', weight: 12 },
          { color: 'amber', icon: 'crate', weight: 12 },
        ],
        switches: [{ id: 'A', initialDirection: 'LEFT' }],
        docks: [{ id: 'A' }, { id: 'B' }],
      })
    );
    const balanceHtml = renderToStaticMarkup(
      React.createElement(SwitchyardCanvas, { state: balanceState })
    );
    expect(balanceHtml).toContain('data-testid="switchyard-balance-scale"');
    expect(balanceHtml).toContain('data-testid="switchyard-scale-left"');
    expect(balanceHtml).toContain('data-testid="switchyard-scale-right"');
    expect(balanceHtml).toContain('data-testid="switchyard-scale-delta"');
    expect(balanceHtml).toContain('Δ12');

    // 4. Weight plates are hidden during branch/while Switchyard curriculum lessons
    useAppStore.setState({
      appMode: 'curriculum',
      activeActivityId: 'branch.2',
      activeActivityVersion: 1,
    });
    const branchHtml = renderToStaticMarkup(
      React.createElement(SwitchyardCanvas, {
        state: createInitialSwitchyardState({
          incomingStream: [{ color: 'red', icon: 'crate', weight: 12 }],
        }),
      })
    );
    expect(branchHtml).not.toContain('data-testid="switchyard-weight-plate"');
    expect(branchHtml).not.toContain('data-testid="switchyard-scanner-weight"');
  });

  it('verifies all Phase 3 Switchyard curriculum shapes (cmp.0, cmp.1, cmp.1a, cmp.3, cmp.4, cmp.9, cmp.A, cmp.M2) well under < 500ms each', () => {
    // cmp.0 & cmp.3 explanation demo workspace smoke checks
    const cmp0DemoState = createInitialSwitchyardState({
      incomingStream: [
        { color: 'blue', icon: 'crate', weight: 6 },
        { color: 'red', icon: 'crate', weight: 14 },
        { color: 'amber', icon: 'crate', weight: 10 },
      ],
      switches: [{ id: 'A', initialDirection: 'LEFT' }],
      docks: [
        { id: 'A', maxWeight: 10 },
        { id: 'B', minWeight: 11 },
      ],
    });
    const cmp0Run = runHeadlessSimulation(
      makeWs([
        { id: 'd1', type: 'WHILE', params: { condition: { kind: 'sensor', sensor: 'hasNextItem' } } },
        {
          id: 'd2',
          type: 'IF',
          params: { condition: { kind: 'cmp', op: '>', left: '$itemWeight', right: 10 } },
        },
        { id: 'd3', type: 'SWITCH_RIGHT', params: { junction: 'A' } },
        { id: 'd4', type: 'ELSE' },
        { id: 'd5', type: 'SWITCH_LEFT', params: { junction: 'A' } },
        { id: 'd6', type: 'END_IF' },
        { id: 'd7', type: 'SEND_NEXT' },
        { id: 'd8', type: 'END_WHILE' },
      ]),
      'switchyard',
      cmp0DemoState,
      80
    );
    expect(cmp0Run.status).toBe('SUCCESS');

    // cmp.3 division (float64) & remainder (integer %) demo smoke check
    const cmp3Run = runHeadlessSimulation(
      makeWs([
        { id: 'm1', type: 'VAR_ASSIGN', params: { a: 'a', b: 14 } },
        { id: 'm2', type: 'VAR_OP', params: { a: 'b', b: 12, op: '/', c: 3 } },
        { id: 'm3', type: 'VAR_OP', params: { a: 'c', b: 'a', op: '%', c: 3 } },
        { id: 'm4', type: 'SEND_NEXT' },
      ]),
      'switchyard',
      createInitialSwitchyardState({
        switches: [],
        incomingStream: [{ color: 'blue', icon: 'crate', weight: 14 }],
        docks: [{ id: 'A' }],
      }),
      40
    );
    expect(cmp3Run.status).toBe('SUCCESS');
    expect(cmp3Run.finalRuntime.variables[toVariableName('b')]).toBe(4);
    expect(cmp3Run.finalRuntime.variables[toVariableName('c')]).toBe(2);

    // 1. cmp.1: Weight Thresholds & Quotas (10 blocks across 4 streams)
    const cmp1: CurriculumActivity = {
      id: 'test-cmp-1',
      version: 1,
      moduleId: 'cmp',
      format: 'puzzle',
      icon: '🚂',
      title: 'Weight Thresholds',
      concept: 'Strict > weight threshold gate',
      simId: 'switchyard',
      slotCap: { maxTotal: 10, perScope: { MAIN: 10 } },
      palette: {
        allowedScopes: ['MAIN'],
        allowedSimBlocks: ['SWITCH_LEFT', 'SWITCH_RIGHT', 'SEND_NEXT'],
        allowedControlBlocks: ['WHILE', 'END_WHILE', 'IF', 'ELSE', 'END_IF'],
        allowedSensors: ['hasNextItem'],
        allowedCmpOps: ['=', '!=', '<', '>', '<=', '>='],
        allowedValueSensors: ['$itemWeight'],
        allowVariables: false,
      },
      switchyardVariants: [
        [6, 14, 10, 12],
        [15, 4, 18, 9, 10],
        [11, 13, 20],
        [3, 7, 10, 5],
      ].map((weights, i) => ({
        label: `v${i + 1}`,
        incomingStream: weights.map((w, k) => ({
          id: `c_${i}_${k}`,
          color: 'sky',
          icon: 'crate',
          weight: w,
        })),
        switches: [
          { id: 'A', initialDirection: 'left', leftTarget: 'DOCK_A', rightTarget: 'DOCK_B' },
        ],
        docks: [
          { id: 'DOCK_A', maxWeight: 10 },
          { id: 'DOCK_B', minWeight: 11 },
        ],
      })),
      referenceSolution: makeWs([
        { id: '1', type: 'WHILE', params: { condition: { kind: 'sensor', sensor: 'hasNextItem' } } },
        {
          id: '2',
          type: 'IF',
          params: { condition: { kind: 'cmp', op: '>', left: '$itemWeight', right: 10 } },
        },
        { id: '3', type: 'SWITCH_RIGHT', params: { junction: 'A' } },
        { id: '4', type: 'ELSE' },
        { id: '5', type: 'SWITCH_LEFT', params: { junction: 'A' } },
        { id: '6', type: 'END_IF' },
        { id: '7', type: 'SEND_NEXT' },
        { id: '8', type: 'END_WHILE' },
      ]),
      antiBypassRules: [
        { id: 'no-if', description: 'Requires conditional weight gate', forbidBlocks: ['IF'] },
        { id: 'no-loop', description: 'Requires loop within 10 slots', forbidBlocks: ['WHILE'] },
      ],
    };
    const rCmp1 = verifySwitchyardActivityConstraints(cmp1);
    expect(rCmp1.passed).toBe(true);
    expect(rCmp1.elapsedMs).toBeLessThan(500);

    // 2. cmp.1a: Exact Dock Quota ($dockCount[0] < $dockQuota[0])
    const cmp1a: CurriculumActivity = {
      id: 'test-cmp-1a',
      version: 1,
      moduleId: 'cmp',
      format: 'puzzle',
      icon: '🚂',
      title: 'Exact Dock Quota',
      concept: 'Dynamic dock quota comparison',
      simId: 'switchyard',
      slotCap: { maxTotal: 10, perScope: { MAIN: 10 } },
      palette: {
        allowedScopes: ['MAIN'],
        allowedSimBlocks: ['SWITCH_LEFT', 'SWITCH_RIGHT', 'SEND_NEXT'],
        allowedControlBlocks: ['WHILE', 'END_WHILE', 'IF', 'ELSE', 'END_IF'],
        allowedSensors: ['hasNextItem'],
        allowedCmpOps: ['=', '!=', '<', '>', '<=', '>='],
        allowedValueSensors: ['$dockCount', '$dockQuota'],
        allowVariables: false,
      },
      switchyardVariants: [
        { weights: [5, 6, 4, 7], quota: 2 },
        { weights: [8, 3, 5, 6, 4], quota: 3 },
        { weights: [9, 4, 6], quota: 1 },
        { weights: [7, 5], quota: 2 },
      ].map((cfg, i) => ({
        label: `v${i + 1}`,
        incomingStream: cfg.weights.map((w, k) => ({
          id: `c_${i}_${k}`,
          color: 'emerald',
          icon: 'crate',
          weight: w,
        })),
        switches: [
          { id: 'A', initialDirection: 'right', leftTarget: 'DOCK_A', rightTarget: 'DOCK_B' },
        ],
        docks: [{ id: 'DOCK_A', quota: cfg.quota }, { id: 'DOCK_B' }],
      })),
      referenceSolution: makeWs([
        { id: '1', type: 'WHILE', params: { condition: { kind: 'sensor', sensor: 'hasNextItem' } } },
        {
          id: '2',
          type: 'IF',
          params: {
            condition: { kind: 'cmp', op: '<', left: '$dockCount[A]', right: '$dockQuota[A]' },
          },
        },
        { id: '3', type: 'SWITCH_LEFT', params: { junction: 'A' } },
        { id: '4', type: 'ELSE' },
        { id: '5', type: 'SWITCH_RIGHT', params: { junction: 'A' } },
        { id: '6', type: 'END_IF' },
        { id: '7', type: 'SEND_NEXT' },
        { id: '8', type: 'END_WHILE' },
      ]),
      antiBypassRules: [
        {
          id: 'must-read-quota',
          description: 'Hardcoding quota constant fails across streams',
          forbidSensors: ['$dockQuota'],
        },
      ],
    };
    const rCmp1a = verifySwitchyardActivityConstraints(cmp1a);
    expect(rCmp1a.passed).toBe(true);
    expect(rCmp1a.elapsedMs).toBeLessThan(500);

    // 3. cmp.4: Modulo & Alternating Cycles (c = c + 1; r = c % 2; IF r == 1)
    const cmp4: CurriculumActivity = {
      id: 'test-cmp-4',
      version: 1,
      moduleId: 'cmp',
      format: 'puzzle',
      icon: '🚂',
      title: 'Modulo Alternation',
      concept: 'Modulo 2 parity routing',
      simId: 'switchyard',
      slotCap: { maxTotal: 13, perScope: { MAIN: 13 } },
      palette: {
        allowedScopes: ['MAIN'],
        allowedSimBlocks: ['SWITCH_LEFT', 'SWITCH_RIGHT', 'SEND_NEXT'],
        allowedControlBlocks: ['VAR_ASSIGN', 'VAR_OP', 'WHILE', 'END_WHILE', 'IF', 'ELSE', 'END_IF'],
        allowedSensors: ['hasNextItem'],
        allowedCmpOps: ['=', '==', '!='],
        allowedVarOps: ['+', '%'],
        allowVariables: true,
        allowedVariableNames: [toVariableName('c'), toVariableName('r')],
      },
      starterWorkspace: makeWs([
        { id: 's1', type: 'WHILE', params: { condition: { kind: 'sensor', sensor: 'hasNextItem' } } },
        { id: 's2', type: 'VAR_OP', params: { a: 'c', b: 'c', op: '+', c: 1 } },
        { id: 's3', type: 'SWITCH_LEFT', params: { junction: 'A' } },
        { id: 's4', type: 'SEND_NEXT' },
        { id: 's5', type: 'END_WHILE' },
      ]),
      switchyardVariants: [6, 4, 5, 8].map((len, i) => ({
        label: `v${i + 1}`,
        incomingStream: Array.from({ length: len }, (_, k) => ({
          id: `c_${i}_${k}`,
          color: 'sky',
          icon: 'crate',
          seqNum: k + 1,
        })),
        switches: [
          { id: 'A', initialDirection: 'left', leftTarget: 'DOCK_A', rightTarget: 'DOCK_B' },
        ],
        docks: [
          { id: 'DOCK_A', paritySlot: 'odd' },
          { id: 'DOCK_B', paritySlot: 'even' },
        ],
      })),
      referenceSolution: makeWs([
        { id: '1', type: 'VAR_ASSIGN', params: { a: 'c', b: 0 } },
        { id: '2', type: 'WHILE', params: { condition: { kind: 'sensor', sensor: 'hasNextItem' } } },
        { id: '3', type: 'VAR_OP', params: { a: 'c', b: 'c', op: '+', c: 1 } },
        { id: '4', type: 'VAR_OP', params: { a: 'r', b: 'c', op: '%', c: 2 } },
        {
          id: '5',
          type: 'IF',
          params: { condition: { kind: 'cmp', op: '==', left: 'r', right: 1 } },
        },
        { id: '6', type: 'SWITCH_LEFT', params: { junction: 'A' } },
        { id: '7', type: 'ELSE' },
        { id: '8', type: 'SWITCH_RIGHT', params: { junction: 'A' } },
        { id: '9', type: 'END_IF' },
        { id: '10', type: 'SEND_NEXT' },
        { id: '11', type: 'END_WHILE' },
      ]),
      antiBypassRules: [
        {
          id: 'starter-must-fail',
          description: 'Starter sends all crates Left and fails parity split',
          unmodifiedStarterMustFail: true,
        },
        {
          id: 'requires-if',
          description: 'Cannot alternate Left/Right without IF when SWITCH_TOGGLE is omitted',
          forbidBlocks: ['IF'],
        },
        {
          id: 'requires-while',
          description: 'Flat unrolling cannot dispatch 8-crate stream within 13 blocks',
          forbidBlocks: ['WHILE'],
        },
      ],
    };
    const rCmp4 = verifySwitchyardActivityConstraints(cmp4);
    expect(rCmp4.referenceCheck.passed, rCmp4.referenceCheck.reason).toBe(true);
    for (const rr of rCmp4.ruleResults) {
      expect(rr.passed, `${rr.ruleId}: ${rr.diagnostic}`).toBe(true);
    }
    expect(rCmp4.passed).toBe(true);
    expect(rCmp4.elapsedMs).toBeLessThan(500);

    // 4. cmp.9: Fix the Boundary Weight Gate (<= vs <)
    const cmp9: CurriculumActivity = {
      id: 'test-cmp-9',
      version: 1,
      moduleId: 'cmp',
      format: 'puzzle',
      icon: '🔧',
      title: 'Fix Boundary Gate',
      concept: 'Off-by-one boundary debugging',
      simId: 'switchyard',
      slotCap: { maxTotal: 10, perScope: { MAIN: 10 } },
      palette: {
        allowedScopes: ['MAIN'],
        allowedSimBlocks: ['SWITCH_LEFT', 'SWITCH_RIGHT', 'SEND_NEXT'],
        allowedControlBlocks: ['WHILE', 'END_WHILE', 'IF', 'ELSE', 'END_IF'],
        allowedSensors: ['hasNextItem'],
        allowedCombinators: ['AND'],
        allowedCmpOps: ['=', '==', '!=', '<', '>', '<=', '>='],
        allowedValueSensors: ['$itemWeight', '$dockCount[0]', '$dockQuota[0]'],
        allowVariables: false,
      },
      starterWorkspace: makeWs([
        { id: '1', type: 'WHILE', params: { condition: { kind: 'sensor', sensor: 'hasNextItem' } } },
        {
          id: '2',
          type: 'IF',
          params: {
            condition: {
              kind: 'and',
              left: { kind: 'cmp', op: '<=', left: '$itemWeight', right: 10 },
              right: { kind: 'cmp', op: '<=', left: '$dockCount[0]', right: '$dockQuota[0]' },
            },
          },
        },
        { id: '3', type: 'SWITCH_LEFT', params: { junction: 'A' } },
        { id: '4', type: 'ELSE' },
        { id: '5', type: 'SWITCH_RIGHT', params: { junction: 'A' } },
        { id: '6', type: 'END_IF' },
        { id: '7', type: 'SEND_NEXT' },
        { id: '8', type: 'END_WHILE' },
      ]),
      switchyardVariants: [
        { weights: [6, 10, 8, 4, 15], quota: 2 },
        { weights: [10, 5, 9, 3], quota: 1 },
        { weights: [10, 10, 4, 8], quota: 3 },
        { weights: [3, 7, 9, 2, 6], quota: 3 },
      ].map((cfg, i) => ({
        label: `v${i + 1}`,
        incomingStream: cfg.weights.map((w, k) => ({
          id: `c_${i}_${k}`,
          color: 'amber',
          icon: 'crate',
          weight: w,
        })),
        switches: [
          { id: 'A', initialDirection: 'right', leftTarget: 'DOCK_A', rightTarget: 'DOCK_B' },
        ],
        docks: [{ id: 'DOCK_A', maxWeight: 9, quota: cfg.quota }, { id: 'DOCK_B' }],
      })),
      referenceSolution: makeWs([
        { id: '1', type: 'WHILE', params: { condition: { kind: 'sensor', sensor: 'hasNextItem' } } },
        {
          id: '2',
          type: 'IF',
          params: {
            condition: {
              kind: 'and',
              left: { kind: 'cmp', op: '<', left: '$itemWeight', right: 10 },
              right: { kind: 'cmp', op: '<', left: '$dockCount[0]', right: '$dockQuota[0]' },
            },
          },
        },
        { id: '3', type: 'SWITCH_LEFT', params: { junction: 'A' } },
        { id: '4', type: 'ELSE' },
        { id: '5', type: 'SWITCH_RIGHT', params: { junction: 'A' } },
        { id: '6', type: 'END_IF' },
        { id: '7', type: 'SEND_NEXT' },
        { id: '8', type: 'END_WHILE' },
      ]),
      antiBypassRules: [
        {
          id: 'starter-must-fail',
          description: 'Buggy <= starter fails',
          unmodifiedStarterMustFail: true,
        },
        {
          id: 'requires-quota',
          description: 'Cannot solve without $dockQuota[0]',
          forbidSensors: ['$dockQuota[0]'],
        },
      ],
    };
    const rCmp9 = verifySwitchyardActivityConstraints(cmp9);
    expect(rCmp9.passed).toBe(true);
    expect(rCmp9.elapsedMs).toBeLessThan(500);

    // 5. cmp.A: Capstone Batch Quota Dispatcher (12 blocks, damaged_or_overweight > 20)
    const cmpA: CurriculumActivity = {
      id: 'test-cmp-a',
      version: 1,
      moduleId: 'cmp',
      format: 'capstone',
      capstoneType: 'puzzle',
      icon: '🏆',
      title: 'Batch Quota Dispatcher',
      concept: 'Combined hazard/overweight scrap + quota overflow',
      simId: 'switchyard',
      slotCap: { maxTotal: 12, perScope: { MAIN: 12 } },
      palette: {
        allowedScopes: ['MAIN'],
        allowedSimBlocks: ['SWITCH_LEFT', 'SWITCH_RIGHT', 'SEND_NEXT', 'SCRAP_ITEM'],
        allowedControlBlocks: ['WHILE', 'END_WHILE', 'IF', 'ELSE_IF', 'ELSE', 'END_IF'],
        allowedSensors: ['hasNextItem', 'itemDamaged'],
        allowedCombinators: ['OR', 'AND', 'NOT'],
        allowedCmpOps: ['=', '==', '!=', '<', '>', '<=', '>='],
        allowedValueSensors: ['$itemWeight', '$dockCount[0]', '$dockQuota[0]'],
        allowVariables: false,
      },
      starterWorkspace: makeWs([
        { id: '1', type: 'WHILE', params: { condition: { kind: 'sensor', sensor: 'hasNextItem' } } },
        { id: '2', type: 'IF', params: { condition: { kind: 'sensor', sensor: 'itemDamaged' } } },
        { id: '3', type: 'SCRAP_ITEM' },
        { id: '4', type: 'ELSE' },
        { id: '5', type: 'SWITCH_RIGHT', params: { junction: 'A' } },
        { id: '6', type: 'SEND_NEXT' },
        { id: '7', type: 'END_IF' },
        { id: '8', type: 'END_WHILE' },
      ]),
      switchyardVariants: [
        {
          quota: 2,
          items: [
            { w: 12, d: false },
            { w: 8, d: true },
            { w: 25, d: false },
            { w: 15, d: false },
            { w: 18, d: false },
            { w: 10, d: false },
          ],
        },
        {
          quota: 3,
          items: [
            { w: 22, d: false },
            { w: 6, d: false },
            { w: 9, d: false },
            { w: 14, d: true },
            { w: 20, d: false },
            { w: 11, d: false },
            { w: 7, d: false },
          ],
        },
        {
          quota: 1,
          items: [
            { w: 5, d: true },
            { w: 28, d: false },
            { w: 16, d: false },
            { w: 19, d: false },
          ],
        },
        {
          quota: 4,
          items: [
            { w: 10, d: false },
            { w: 12, d: false },
            { w: 21, d: false },
            { w: 8, d: false },
            { w: 20, d: false },
          ],
        },
      ].map((cfg, i) => ({
        label: `v${i + 1}`,
        scrapRules: { kind: 'damaged_or_overweight', maxWeight: 20 } as any,
        incomingStream: cfg.items.map((it, k) => ({
          id: `c_${i}_${k}`,
          color: 'sky',
          icon: 'crate',
          weight: it.w,
          damaged: it.d,
        })),
        switches: [
          { id: 'A', initialDirection: 'right', leftTarget: 'DOCK_A', rightTarget: 'DOCK_B' },
        ],
        docks: [
          { id: 'DOCK_A', quota: cfg.quota, acceptsDamaged: false },
          { id: 'DOCK_B', acceptsDamaged: false },
        ],
      })),
      referenceSolution: makeWs([
        { id: '1', type: 'WHILE', params: { condition: { kind: 'sensor', sensor: 'hasNextItem' } } },
        {
          id: '2',
          type: 'IF',
          params: {
            condition: {
              kind: 'or',
              left: { kind: 'sensor', sensor: 'itemDamaged' },
              right: { kind: 'cmp', op: '>', left: '$itemWeight', right: 20 },
            },
          },
        },
        { id: '3', type: 'SCRAP_ITEM' },
        {
          id: '4',
          type: 'ELSE_IF',
          params: {
            condition: { kind: 'cmp', op: '<', left: '$dockCount[0]', right: '$dockQuota[0]' },
          },
        },
        { id: '5', type: 'SWITCH_LEFT', params: { junction: 'A' } },
        { id: '6', type: 'SEND_NEXT' },
        { id: '7', type: 'ELSE' },
        { id: '8', type: 'SWITCH_RIGHT', params: { junction: 'A' } },
        { id: '9', type: 'SEND_NEXT' },
        { id: '10', type: 'END_IF' },
        { id: '11', type: 'END_WHILE' },
      ]),
      antiBypassRules: [
        {
          id: 'starter-fails-2edits',
          description: 'Starter fails and requires >= 2 block edits',
          unmodifiedStarterMustFail: true,
          minStarterEditDistance: 2,
        },
        {
          id: 'requires-scrap',
          description: 'Requires SCRAP_ITEM for hazards and overweight crates',
          forbidBlocks: ['SCRAP_ITEM'],
        },
        {
          id: 'requires-quota-sensor',
          description: 'Requires $dockQuota[0] across quotas 2, 3, 1, 4',
          forbidSensors: ['$dockQuota[0]'],
        },
      ],
    };
    const rCmpA = verifySwitchyardActivityConstraints(cmpA);
    expect(rCmpA.passed).toBe(true);
    expect(rCmpA.elapsedMs).toBeLessThan(500);

    // Positive synthesis check on cmp.A when nothing is forbidden
    const posCmpA = verifySwitchyardActivityRule(
      cmpA,
      { id: 'pos', description: 'Positive synthesis test' },
      0,
      0,
      120
    );
    expect(posCmpA.passed, posCmpA.diagnostic).toBe(false);
    expect(posCmpA.minWinningBlocks).toBeLessThanOrEqual(12);

    // 6. cmp.M2: Balanced Twin-Scale Loader (exact 16-block spec with damaged + greedy l <= r)
    const cmpM2: CurriculumActivity = {
      id: 'test-cmp-m2',
      version: 1,
      moduleId: 'cmp',
      format: 'challenge',
      icon: '🔥',
      title: 'Balanced Twin-Scale Loader',
      concept: 'Running scale accumulators l <= r defeating % 2',
      simId: 'switchyard',
      slotCap: { maxTotal: 50, perScope: { MAIN: 20 } },
      palette: {
        allowedScopes: ['MAIN'],
        allowedSimBlocks: ['SCRAP_ITEM', 'SWITCH_LEFT', 'SWITCH_RIGHT', 'SEND_NEXT'],
        allowedControlBlocks: ['VAR_ASSIGN', 'VAR_OP', 'WHILE', 'END_WHILE', 'IF', 'ELSE', 'END_IF'],
        allowedSensors: ['hasNextItem', 'itemDamaged'],
        allowedCmpOps: ['<=', '<', '>'],
        allowedValueSensors: ['$itemWeight'],
        allowedVarOps: ['+', '%'],
        allowVariables: true,
        allowedVariableNames: [toVariableName('l'), toVariableName('r')],
      },
      switchyardVariants: [
        [
          { w: 10, d: false },
          { w: 2, d: true },
          { w: 4, d: false },
          { w: 3, d: false },
          { w: 3, d: false },
        ],
        [
          { w: 12, d: false },
          { w: 5, d: false },
          { w: 4, d: false },
          { w: 3, d: false },
          { w: 1, d: true },
          { w: 8, d: false },
          { w: 8, d: false },
        ],
        [
          { w: 15, d: false },
          { w: 5, d: false },
          { w: 5, d: false },
          { w: 5, d: false },
          { w: 6, d: true },
        ],
        [
          { w: 20, d: false },
          { w: 6, d: false },
          { w: 7, d: false },
          { w: 7, d: false },
          { w: 4, d: true },
          { w: 8, d: false },
          { w: 8, d: false },
        ],
      ].map((items, i) => ({
        label: `v${i + 1}`,
        mode: 'balance_scale',
        balanceTolerance: 0,
        incomingStream: items.map((it, k) => ({
          id: `c_${i}_${k}`,
          color: 'sky',
          icon: 'crate',
          weight: it.w,
          damaged: it.d,
        })),
        switches: [
          { id: 'A', initialDirection: 'left', leftTarget: 'DOCK_A', rightTarget: 'DOCK_B' },
        ],
        docks: [
          { id: 'DOCK_A', acceptsDamaged: false },
          { id: 'DOCK_B', acceptsDamaged: false },
        ],
      })),
      referenceSolution: makeWs([
        { id: '1', type: 'VAR_ASSIGN', params: { a: 'l', b: 0 } },
        { id: '2', type: 'VAR_ASSIGN', params: { a: 'r', b: 0 } },
        { id: '3', type: 'WHILE', params: { condition: { kind: 'sensor', sensor: 'hasNextItem' } } },
        { id: '4', type: 'IF', params: { condition: { kind: 'sensor', sensor: 'itemDamaged' } } },
        { id: '5', type: 'SCRAP_ITEM' },
        { id: '6', type: 'ELSE' },
        {
          id: '7',
          type: 'IF',
          params: { condition: { kind: 'cmp', op: '<=', left: 'l', right: 'r' } },
        },
        { id: '8', type: 'SWITCH_LEFT', params: { junction: 'A' } },
        { id: '9', type: 'VAR_OP', params: { a: 'l', b: 'l', op: '+', c: '$itemWeight' } },
        { id: '10', type: 'ELSE' },
        { id: '11', type: 'SWITCH_RIGHT', params: { junction: 'A' } },
        { id: '12', type: 'VAR_OP', params: { a: 'r', b: 'r', op: '+', c: '$itemWeight' } },
        { id: '13', type: 'END_IF' },
        { id: '14', type: 'SEND_NEXT' },
        { id: '15', type: 'END_IF' },
        { id: '16', type: 'END_WHILE' },
      ]),
      antiBypassRules: [
        {
          id: 'requires-variables',
          description: 'Cannot balance all 4 streams without variable accumulators',
          allowVariables: false,
        },
        {
          id: 'requires-weight-sensor',
          description: 'Count-based % 2 alternation fails without $itemWeight',
          forbidSensors: ['$itemWeight'],
        },
      ],
    };
    const rCmpM2 = verifySwitchyardActivityConstraints(cmpM2);
    expect(rCmpM2.passed).toBe(true);
    expect(rCmpM2.elapsedMs).toBeLessThan(500);

    // Positive synthesis check on cmp.M2 when variables & $itemWeight ARE allowed
    const posCmpM2 = verifySwitchyardActivityRule(
      cmpM2,
      { id: 'pos', description: 'Synthesizes greedy scale accumulator' },
      0,
      0,
      120
    );
    expect(posCmpM2.passed).toBe(false);
    expect(posCmpM2.minWinningBlocks).toBeLessThanOrEqual(16);
  });
});
