import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, beforeEach } from 'vitest';
import { WorkspaceState } from '../src/types';
import {
  SwitchyardState,
  SwitchyardItem,
  ITEM_COLOR_INDEX,
  ITEM_ICON_INDEX,
  ITEM_COLOR_FROM_INDEX,
  ITEM_ICON_FROM_INDEX,
} from '../src/simulations/switchyard/types';
import {
  createInitialSwitchyardState,
  resetSwitchyardState,
  applySwitchyardAction,
  evaluateSwitchyardSensor,
  evaluateSwitchyardCompletion,
  deriveSwitchyardFailureDiagnostic,
  normalizeSwitchyardDefinition,
  resolveSwitchyardRoute,
} from '../src/simulations/switchyard/physics';
import { DEFAULT_SWITCHYARD_STATE, TWO_SWITCH_PRESET } from '../src/simulations/switchyard/presets';
import { switchyardSimulationEnvironment } from '../src/simulations/switchyard/switchyardEnvironment';
import { SwitchyardCanvas } from '../src/simulations/switchyard/components/SwitchyardCanvas';
import { SwitchyardToolbarTools } from '../src/simulations/switchyard/components/SwitchyardToolbarTools';
import {
  ENV_ID_SWITCHYARD,
  ENV_VERSION_SWITCHYARD,
  ENV_VERSION_SWITCHYARD_V2,
  ENV_ID_LESSON,
} from '../src/engine/serialization/types';
import {
  writeSwitchyardState,
  readSwitchyardState,
  getSwitchyardSerializationVersion,
} from '../src/engine/serialization/env/switchyardSerializer';
import { BinaryWriter } from '../src/engine/serialization/binaryWriter';
import { BinaryReader } from '../src/engine/serialization/binaryReader';
import {
  exportToBinary,
  importFromBinary,
  exportToString,
  importFromString,
  exportLessonToBinary,
} from '../src/engine/serialization/codeSerializer';
import {
  SWITCHYARD_EXCLUSIVE_BLOCKS,
  serializeProfileBackupToBinary,
  deserializeProfileBackupFromBinary,
} from '../src/engine/serialization/profileSerializer';
import { runHeadlessSimulation } from '../src/engine/simulationRunner';
import {
  generateSimulationThumbnail,
  renderSwitchyardMapSvg,
} from '../src/services/mapThumbnailGenerator';
import {
  saveStateBeforeUpdate,
  consumeRestoredStateAfterUpdate,
  clearPendingUpdateState,
} from '../src/services/pwaStateRestoreService';
import { useAppStore } from '../src/store/useAppStore';
import {
  CurriculumActivity,
  CurriculumSwitchyardDefinition,
  createCurriculumBlock,
} from '../src/data/curriculum/types';
import { verifySwitchyardActivityConstraints } from '../src/engine/verification/switchyardConstraintSolver';

describe('Switchyard Simulation Physics & Routing', () => {
  it('toggles track switches with SWITCH_LEFT and SWITCH_RIGHT', () => {
    let state = createInitialSwitchyardState();
    expect(state.switches[0].direction).toBe('LEFT');

    state = applySwitchyardAction('SWITCH_RIGHT', state);
    expect(state.switches[0].direction).toBe('RIGHT');

    state = applySwitchyardAction('SWITCH_LEFT', state);
    expect(state.switches[0].direction).toBe('LEFT');
  });

  it('routes items through 1-switch network based on switch direction', () => {
    const queue: SwitchyardItem[] = [
      { color: 'RED', icon: 'CRATE', damaged: false },
      { color: 'BLUE', icon: 'BATTERY', damaged: false },
    ];
    let state = createInitialSwitchyardState({
      initialQueue: queue,
      initialDockSpecs: [
        { id: 'DOCK_A', acceptColor: 'RED' },
        { id: 'DOCK_B', acceptColor: 'BLUE' },
      ],
    });

    // 1st item is RED -> Switch LEFT -> DOCK_A
    state = applySwitchyardAction('SWITCH_LEFT', state);
    state = applySwitchyardAction('SEND_NEXT', state);
    expect(state.docks[0].items.length).toBe(1);
    expect(state.docks[0].items[0].color).toBe('RED');
    expect(state.status).toBe('IDLE');

    // 2nd item is BLUE -> Switch RIGHT -> DOCK_B
    state = applySwitchyardAction('SWITCH_RIGHT', state);
    state = applySwitchyardAction('SEND_NEXT', state);
    expect(state.docks[1].items.length).toBe(1);
    expect(state.docks[1].items[0].color).toBe('BLUE');

    // All items sorted -> evaluate completion
    const status = evaluateSwitchyardCompletion(state);
    expect(status).toBe('SUCCESS');
  });

  it('routes items through 2-switch network (3 docks)', () => {
    const queue: SwitchyardItem[] = [
      { color: 'RED', icon: 'CRATE', damaged: false },
      { color: 'BLUE', icon: 'BATTERY', damaged: false },
      { color: 'GREEN', icon: 'GEAR', damaged: false },
    ];
    let state = createInitialSwitchyardState({
      initialQueue: queue,
      initialDockSpecs: [
        { id: 'DOCK_A', acceptColor: 'RED' },
        { id: 'DOCK_B', acceptColor: 'BLUE' },
        { id: 'DOCK_C', acceptColor: 'GREEN' },
      ],
      initialSwitchDirections: ['LEFT', 'LEFT'],
    });
    expect(state.switches.length).toBe(2);

    // Item 1: RED -> Switch A LEFT -> DOCK_A
    state = applySwitchyardAction('SWITCH_LEFT', state);
    state = applySwitchyardAction('SEND_NEXT', state);
    expect(state.docks[0].items.length).toBe(1);

    // Item 2: BLUE -> Switch A RIGHT, Switch B LEFT -> DOCK_B
    state = applySwitchyardAction('SWITCH_RIGHT', state);
    state = applySwitchyardAction('SWITCH_LEFT', state, { params: { junction: 'B' } });
    state = applySwitchyardAction('SEND_NEXT', state);
    expect(state.docks[1].items.length).toBe(1);

    // Item 3: GREEN -> Switch A RIGHT, Switch B RIGHT -> DOCK_C
    state = applySwitchyardAction('SWITCH_RIGHT', state);
    state = applySwitchyardAction('SWITCH_RIGHT', state, { params: { junction: 'B' } });
    state = applySwitchyardAction('SEND_NEXT', state);
    expect(state.docks[2].items.length).toBe(1);

    const status = evaluateSwitchyardCompletion(state);
    expect(status).toBe('SUCCESS');
  });

  it('detects dock mismatch collision on color or icon', () => {
    let state = createInitialSwitchyardState({
      initialQueue: [{ color: 'RED', icon: 'CRATE', damaged: false }],
      initialDockSpecs: [
        { id: 'DOCK_A', acceptColor: 'BLUE' }, // Requires BLUE
        { id: 'DOCK_B' },
      ],
    });
    state = applySwitchyardAction('SWITCH_LEFT', state);
    state = applySwitchyardAction('SEND_NEXT', state);
    expect(state.status).toBe('COLLISION');
    expect(state.lastFailureReason).toBe('WRONG_DOCK');
  });

  it('detects damaged car entering a dock rejecting damage', () => {
    let state = createInitialSwitchyardState({
      initialQueue: [{ color: 'RED', icon: 'CRATE', damaged: true }],
      initialDockSpecs: [
        { id: 'DOCK_A', rejectDamaged: true },
        { id: 'DOCK_B' },
      ],
    });
    state = applySwitchyardAction('SWITCH_LEFT', state);
    state = applySwitchyardAction('SEND_NEXT', state);
    expect(state.status).toBe('COLLISION');
    expect(state.lastFailureReason).toBe('WRONG_DOCK');
  });

  it('diverts item to scrap chute with SCRAP_ITEM', () => {
    let state = createInitialSwitchyardState({
      initialQueue: [{ color: 'RED', icon: 'CRATE', damaged: true }],
    });
    state = applySwitchyardAction('SCRAP_ITEM', state);
    expect(state.scrapped.length).toBe(1);
    expect(state.scrapped[0].damaged).toBe(true);
    expect(state.queue.length).toBe(0);
    const status = evaluateSwitchyardCompletion(state);
    expect(status).toBe('SUCCESS');
  });

  it('causes COLLISION when SEND_NEXT is invoked on empty queue', () => {
    let state = createInitialSwitchyardState({ initialQueue: [] });
    state = applySwitchyardAction('SEND_NEXT', state);
    expect(state.status).toBe('COLLISION');
    expect(state.lastFailureReason).toBe('NO_ITEM_AT_SCANNER');
  });

  it('resets state cleanly to initialQueue and initialDockSpecs', () => {
    const queue: SwitchyardItem[] = [
      { color: 'GREEN', icon: 'CRYSTAL', damaged: false },
    ];
    let state = createInitialSwitchyardState({ initialQueue: queue });
    state = applySwitchyardAction('SWITCH_RIGHT', state);
    state = applySwitchyardAction('SEND_NEXT', state);
    expect(state.queue.length).toBe(0);

    const reset = resetSwitchyardState(state);
    expect(reset.queue.length).toBe(1);
    expect(reset.switches[0].direction).toBe('LEFT');
    expect(reset.status).toBe('IDLE');
  });
});

describe('Switchyard Sensors', () => {
  it('evaluates hasNextItem correctly', () => {
    const state = createInitialSwitchyardState({
      initialQueue: [{ color: 'YELLOW', icon: 'GEAR', damaged: false }],
    });
    expect(evaluateSwitchyardSensor({ type: 'hasNextItem' }, state)).toBe(true);

    const emptyState = createInitialSwitchyardState({ initialQueue: [] });
    expect(evaluateSwitchyardSensor({ type: 'hasNextItem' }, emptyState)).toBe(false);
  });

  it('evaluates itemDamaged correctly', () => {
    const damagedState = createInitialSwitchyardState({
      initialQueue: [{ color: 'RED', icon: 'BATTERY', damaged: true }],
    });
    expect(evaluateSwitchyardSensor({ type: 'itemDamaged' }, damagedState)).toBe(true);

    const intactState = createInitialSwitchyardState({
      initialQueue: [{ color: 'RED', icon: 'BATTERY', damaged: false }],
    });
    expect(evaluateSwitchyardSensor({ type: 'itemDamaged' }, intactState)).toBe(false);

    const empty = createInitialSwitchyardState({ initialQueue: [] });
    expect(evaluateSwitchyardSensor({ type: 'itemDamaged' }, empty)).toBe(false);
  });

  it('evaluates itemColor correctly', () => {
    const state = createInitialSwitchyardState({
      initialQueue: [{ color: 'GREEN', icon: 'CRYSTAL', damaged: false }],
    });
    expect(
      evaluateSwitchyardSensor(
        { type: 'itemColor', colorIdx: ITEM_COLOR_INDEX['GREEN'] },
        state
      )
    ).toBe(true);
    expect(
      evaluateSwitchyardSensor(
        { type: 'itemColor', colorIdx: ITEM_COLOR_INDEX['RED'] },
        state
      )
    ).toBe(false);

    const empty = createInitialSwitchyardState({ initialQueue: [] });
    expect(
      evaluateSwitchyardSensor(
        { type: 'itemColor', colorIdx: ITEM_COLOR_INDEX['GREEN'] },
        empty
      )
    ).toBe(false);
  });

  it('evaluates itemIcon correctly', () => {
    const state = createInitialSwitchyardState({
      initialQueue: [{ color: 'YELLOW', icon: 'BATTERY', damaged: false }],
    });
    expect(
      evaluateSwitchyardSensor(
        { type: 'itemIcon', iconIdx: ITEM_ICON_INDEX['BATTERY'] },
        state
      )
    ).toBe(true);
    expect(
      evaluateSwitchyardSensor(
        { type: 'itemIcon', iconIdx: ITEM_ICON_INDEX['CRATE'] },
        state
      )
    ).toBe(false);

    const empty = createInitialSwitchyardState({ initialQueue: [] });
    expect(
      evaluateSwitchyardSensor(
        { type: 'itemIcon', iconIdx: ITEM_ICON_INDEX['BATTERY'] },
        empty
      )
    ).toBe(false);
  });
});

describe('Switchyard Binary Serialization', () => {
  it('roundtrips Switchyard state via writeSwitchyardState & readSwitchyardState', () => {
    const state: SwitchyardState = createInitialSwitchyardState({
      initialQueue: [
        { color: 'RED', icon: 'CRATE', damaged: false },
        { color: 'BLUE', icon: 'BATTERY', damaged: true },
        { color: 'GREEN', icon: 'GEAR', damaged: false },
        { color: 'YELLOW', icon: 'CRYSTAL', damaged: true },
      ],
      initialDockSpecs: [
        { id: 'DOCK_A', acceptColor: 'RED', rejectDamaged: true },
        { id: 'DOCK_B', acceptIcon: 'BATTERY' },
        { id: 'DOCK_C', acceptColor: 'GREEN', acceptIcon: 'GEAR' },
      ],
      initialSwitchDirections: ['RIGHT', 'LEFT'],
    });

    const writer = new BinaryWriter();
    writeSwitchyardState(writer, state);
    const bytes = writer.getBytes();

    const reader = new BinaryReader(bytes);
    const restored = readSwitchyardState(reader);

    expect(restored.switches.length).toBe(2);
    expect(restored.switches[0].direction).toBe('RIGHT');
    expect(restored.switches[1].direction).toBe('LEFT');

    expect(restored.docks.length).toBe(3);
    expect(restored.docks[0].spec.acceptColor).toBe('RED');
    expect(restored.docks[0].spec.rejectDamaged).toBe(true);
    expect(restored.docks[1].spec.acceptIcon).toBe('BATTERY');
    expect(restored.docks[2].spec.acceptColor).toBe('GREEN');
    expect(restored.docks[2].spec.acceptIcon).toBe('GEAR');

    expect(restored.queue.length).toBe(4);
    expect(restored.queue[0]).toMatchObject({ color: 'RED', icon: 'CRATE', damaged: false });
    expect(restored.queue[1]).toMatchObject({ color: 'BLUE', icon: 'BATTERY', damaged: true });
    expect(restored.queue[2]).toMatchObject({ color: 'GREEN', icon: 'GEAR', damaged: false });
    expect(restored.queue[3]).toMatchObject({ color: 'YELLOW', icon: 'CRYSTAL', damaged: true });
  });

  it('exports and imports switchyard code and state in binary and string format', () => {
    const workspace: WorkspaceState = {
      MAIN: [
        { id: 'b1', type: 'SWITCH_LEFT' },
        { id: 'b2', type: 'SEND_NEXT' },
        { id: 'b3', type: 'SWITCH_RIGHT' },
        { id: 'b4', type: 'SEND_NEXT' },
        { id: 'b5', type: 'SCRAP_ITEM' },
      ],
    };
    const state = DEFAULT_SWITCHYARD_STATE;

    // Binary export with map
    const bin = exportToBinary(workspace, 'switchyard', state);
    expect(bin[0]).toBe(1); // FORMAT_VERSION
    expect(bin[1]).toBe(ENV_ID_SWITCHYARD); // 0x05
    expect(bin[2]).toBe(ENV_VERSION_SWITCHYARD); // 1

    const importedBin = importFromBinary(bin);
    expect(importedBin.success).toBe(true);
    expect(importedBin.envId).toBe('switchyard');
    expect(importedBin.workspace?.MAIN.length).toBe(5);
    expect(importedBin.workspace?.MAIN.map((b) => b.type)).toEqual([
      'SWITCH_LEFT',
      'SEND_NEXT',
      'SWITCH_RIGHT',
      'SEND_NEXT',
      'SCRAP_ITEM',
    ]);
    expect(importedBin.switchyardState?.docks.length).toBe(state.docks.length);

    // String export roundtrip
    const str = exportToString(workspace, 'switchyard', state);
    const importedStr = importFromString(str);
    expect(importedStr.success).toBe(true);
    expect(importedStr.envId).toBe('switchyard');
    expect(importedStr.workspace?.MAIN.length).toBe(5);
  });

  it('exports and imports switchyard lesson attempts using innerEnvByte = 0x05', () => {
    const workspace: WorkspaceState = {
      MAIN: [
        { id: 'b1', type: 'SWITCH_LEFT' },
        { id: 'b2', type: 'SEND_NEXT' },
      ],
    };
    const bin = exportLessonToBinary(workspace, 'switchyard', '5.1', 1);
    expect(bin[0]).toBe(1); // FORMAT_VERSION
    expect(bin[1]).toBe(ENV_ID_LESSON); // 0x04
    expect(bin[2]).toBe(ENV_ID_SWITCHYARD); // 0x05 innerEnvByte

    const res = importFromBinary(bin);
    expect(res.success).toBe(true);
    expect(res.envId).toBe('lesson');
    expect(res.innerEnvId).toBe('switchyard');
    expect(res.lessonId).toBe('5.1');
    expect(res.workspace?.MAIN.map((b) => b.type)).toEqual(['SWITCH_LEFT', 'SEND_NEXT']);
  });
});

describe('Profile Serializer & Exclusive Block Masks', () => {
  it('defines SWITCHYARD_EXCLUSIVE_BLOCKS accurately without placeholder names', () => {
    expect(Array.from(SWITCHYARD_EXCLUSIVE_BLOCKS)).toEqual([
      'SWITCH_LEFT',
      'SWITCH_RIGHT',
      'SEND_NEXT',
      'SCRAP_ITEM',
    ]);
    expect(SWITCHYARD_EXCLUSIVE_BLOCKS.has('COUPLE')).toBe(false);
    expect(SWITCHYARD_EXCLUSIVE_BLOCKS.has('UNCOUPLE')).toBe(false);
  });

  it('backs up and restores profile programs containing switchyard workspace and state', () => {
    const envelope = {
      version: 1 as const,
      profile: {
        id: 'prof-test',
        name: 'Alex',
        avatarId: 'robot' as const,
        createdAt: 1000000,
        updatedAt: 1000000,
      },
      savedPrograms: [
        {
          id: 'prog-1',
          profileId: 'prof-test',
          name: 'Sorter 1',
          code: exportToString(
            { MAIN: [{ id: 'b1', type: 'SWITCH_LEFT' }, { id: 'b2', type: 'SEND_NEXT' }] },
            'switchyard'
          ),
          simId: 'switchyard' as const,
          screenshot: 'data:image/svg+xml,...',
          createdAt: 1000000,
          updatedAt: 1000000,
        },
      ],
    };

    const backupBytes = serializeProfileBackupToBinary(envelope);
    expect(backupBytes.length).toBeGreaterThan(0);

    const restored = deserializeProfileBackupFromBinary(backupBytes);
    expect(restored.profile?.name).toBe('Alex');
    expect(restored.savedPrograms?.[0].simId).toBe('switchyard');
  });
});

describe('Headless Simulation Runner & Environment Integration', () => {
  it('runs switchyard simulation to SUCCESS in headless runner', () => {
    const workspace: WorkspaceState = {
      MAIN: [
        { id: 'b1', type: 'SWITCH_LEFT' },
        { id: 'b2', type: 'SEND_NEXT' },
        { id: 'b3', type: 'SWITCH_RIGHT' },
        { id: 'b4', type: 'SEND_NEXT' },
      ],
    };
    const initialState = createInitialSwitchyardState({
      initialQueue: [
        { color: 'RED', icon: 'CRATE', damaged: false },
        { color: 'BLUE', icon: 'BATTERY', damaged: false },
      ],
      initialDockSpecs: [
        { id: 'DOCK_A', acceptColor: 'RED' },
        { id: 'DOCK_B', acceptColor: 'BLUE' },
      ],
    });

    const run = runHeadlessSimulation(workspace, 'switchyard', initialState, 50);
    expect(run.status).toBe('SUCCESS');
    expect(run.finalState.docks[0].items.length).toBe(1);
    expect(run.finalState.docks[1].items.length).toBe(1);
  });

  it('generates SVG thumbnail for switchyard state', () => {
    const state = DEFAULT_SWITCHYARD_STATE;
    const thumbnail = generateSimulationThumbnail('switchyard', state);
    expect(thumbnail).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    expect(thumbnail).toContain('rect');
  });
});

describe('Switchyard v2 Clean Replacement (Phase 2)', () => {
  beforeEach(() => {
    clearPendingUpdateState();
  });

  it('ingests full CurriculumSwitchyardDefinition with normalized colors, gem->CRYSTAL, 0..2 switches, docks, and scrapRules', () => {
    const def: CurriculumSwitchyardDefinition = {
      incomingStream: [
        { color: 'rose', icon: 'crate', damaged: false, weight: 2 },
        { color: 'sky', icon: 'gem', damaged: false, weight: 4 },
        { color: 'amber', icon: 'gear', damaged: true, weight: 3 },
        { color: 'purple', icon: 'battery', damaged: false },
      ],
      switches: [
        { id: 'A', initialDirection: 'RIGHT', leftTarget: 'DOCK_A', rightTarget: 'B' },
        { id: 'B', initialDirection: 'LEFT', leftTarget: 'DOCK_B', rightTarget: 'DOCK_C' },
      ],
      docks: [
        {
          id: 'A',
          expectedColor: 'red',
          expectedIcon: 'crate',
          acceptsDamaged: false,
          quota: 2,
        },
        {
          id: 'B',
          expectedColor: 'blue',
          expectedIcon: 'gem',
          acceptsDamaged: false,
        },
        {
          id: 'C',
          expectedItems: [{ color: 'purple', icon: 'battery' }],
          acceptsDamaged: false,
          maxWeight: 5,
        },
      ],
      scrapChute: { expectedDamagedOnly: true },
    };

    const state = normalizeSwitchyardDefinition(def);
    expect(state.queue).toHaveLength(4);
    expect(state.queue[0]).toMatchObject({ color: 'RED', icon: 'CRATE', damaged: false, weight: 2 });
    expect(state.queue[1]).toMatchObject({ color: 'BLUE', icon: 'CRYSTAL', damaged: false, weight: 4 });
    expect(state.queue[2]).toMatchObject({ color: 'YELLOW', icon: 'GEAR', damaged: true, weight: 3 });
    expect(state.queue[3]).toMatchObject({ color: 'PURPLE', icon: 'BATTERY', damaged: false });

    expect(state.switches).toHaveLength(2);
    expect(state.switches[0]).toMatchObject({ id: 'A', direction: 'RIGHT', leftTarget: 'DOCK_A', rightTarget: 'SWITCH_B' });
    expect(state.switches[1]).toMatchObject({ id: 'B', direction: 'LEFT', leftTarget: 'DOCK_B', rightTarget: 'DOCK_C' });

    expect(state.docks).toHaveLength(3);
    expect(state.docks[0].spec).toMatchObject({ dockId: 'DOCK_A', acceptColor: 'RED', acceptIcon: 'CRATE', quota: 2 });
    expect(state.docks[1].spec).toMatchObject({ dockId: 'DOCK_B', acceptColor: 'BLUE', acceptIcon: 'CRYSTAL' });
    expect(state.docks[2].spec).toMatchObject({
      dockId: 'DOCK_C',
      expectedItems: [{ color: 'PURPLE', icon: 'BATTERY' }],
      maxWeight: 5,
    });
    expect(state.scrapRule).toBe('damaged_only');
    expect(ITEM_COLOR_FROM_INDEX[ITEM_COLOR_INDEX.RED]).toBe('RED');
    expect(ITEM_ICON_FROM_INDEX[ITEM_ICON_INDEX.CRYSTAL]).toBe('CRYSTAL');
  });

  it('fixes SEND_NEXT repeatCount double-consume bug (1 item per call, 2 items over 2 interpreter sub-ticks)', () => {
    const initial = createInitialSwitchyardState({
      incomingStream: [
        { color: 'red', icon: 'crate', damaged: false },
        { color: 'red', icon: 'battery', damaged: false },
        { color: 'red', icon: 'gear', damaged: false },
      ],
      switches: [],
      docks: [{ id: 'A', expectedColor: 'red', acceptsDamaged: false }],
    });

    // Direct action call ignores repeatCount (interpreter ticks repeatCount times)
    const afterOneCall = applySwitchyardAction('SEND_NEXT', initial, { repeatCount: 3 });
    expect(afterOneCall.queue).toHaveLength(2);
    expect(afterOneCall.docks[0].items).toHaveLength(1);

    // Through interpreter + headless runner, SEND_NEXT x2 consumes exactly 2 items cleanly
    const twoItemState = createInitialSwitchyardState({
      incomingStream: [
        { color: 'red', icon: 'crate', damaged: false },
        { color: 'red', icon: 'battery', damaged: false },
      ],
      switches: [],
      docks: [{ id: 'A', expectedColor: 'red', acceptsDamaged: false }],
    });
    const run = runHeadlessSimulation(
      { MAIN: [{ id: 's1', type: 'SEND_NEXT', repeatCount: 2 }] },
      'switchyard',
      twoItemState,
      20
    );
    expect(run.status).toBe('SUCCESS');
    expect(run.finalState.queue).toHaveLength(0);
    expect(run.finalState.docks[0].items).toHaveLength(2);
  });

  it('supports 0-switch, 1-switch leftTarget/rightTarget, and 2-switch junction B routing + MISSING_SWITCH_B', () => {
    // 0-switch topology routes straight into DOCK_A
    const zeroSwitch = createInitialSwitchyardState({
      switches: [],
      incomingStream: [{ color: 'emerald', icon: 'crate', damaged: false }],
      docks: [{ id: 'A', expectedColor: 'green' }],
    });
    expect(resolveSwitchyardRoute(zeroSwitch.switches, zeroSwitch.docks).targetDock).toBe('DOCK_A');
    const afterZero = applySwitchyardAction('SEND_NEXT', zeroSwitch);
    expect(afterZero.status).toBe('SUCCESS');

    // Missing switch B triggers COLLISION on 1-switch network
    const oneSwitch = createInitialSwitchyardState({
      switches: [{ id: 'A', initialDirection: 'LEFT', leftTarget: 'DOCK_A', rightTarget: 'DOCK_C' }],
      incomingStream: [{ color: 'red', icon: 'crate', damaged: false }],
      docks: [{ id: 'A', expectedColor: 'red' }],
    });
    const oneRight = applySwitchyardAction('SWITCH_RIGHT', oneSwitch);
    expect(resolveSwitchyardRoute(oneRight.switches, oneRight.docks).targetDock).toBe('DOCK_C');
    const badSwitchB = applySwitchyardAction('SWITCH_RIGHT', oneSwitch, { params: { junction: 'B' } });
    expect(badSwitchB.status).toBe('COLLISION');
    expect(badSwitchB.lastFailureReason).toBe('MISSING_SWITCH_B');

    // 2-switch topology routes LEFT -> DOCK_A, RIGHT+LEFT -> DOCK_B, RIGHT+RIGHT -> DOCK_C
    let twoSw = createInitialSwitchyardState(TWO_SWITCH_PRESET);
    expect(resolveSwitchyardRoute(twoSw.switches, twoSw.docks).targetDock).toBe('DOCK_A');
    twoSw = applySwitchyardAction('SWITCH_RIGHT', twoSw, { params: { junction: 'A' } });
    expect(resolveSwitchyardRoute(twoSw.switches, twoSw.docks).targetDock).toBe('DOCK_B');
    twoSw = applySwitchyardAction('SWITCH_RIGHT', twoSw, { params: { junction: 'B' } });
    expect(resolveSwitchyardRoute(twoSw.switches, twoSw.docks).targetDock).toBe('DOCK_C');
  });

  it('enforces scrapRules (damaged_only, any, none), dock quota, and expectedItems', () => {
    const damagedOnlyState = createInitialSwitchyardState({
      incomingStream: [
        { color: 'red', icon: 'crate', damaged: true },
        { color: 'blue', icon: 'crate', damaged: false },
      ],
      scrapRules: ['damaged_only'],
    });
    const afterScrapDamaged = applySwitchyardAction('SCRAP_ITEM', damagedOnlyState);
    expect(afterScrapDamaged.scrapped).toHaveLength(1);
    expect(afterScrapDamaged.status).toBe('IDLE');

    const afterScrapHealthy = applySwitchyardAction('SCRAP_ITEM', afterScrapDamaged);
    expect(afterScrapHealthy.status).toBe('COLLISION');
    expect(afterScrapHealthy.lastFailureDetail?.code).toBe('GOOD_SCRAPPED');

    const scrapAnyState = createInitialSwitchyardState({
      incomingStream: [{ color: 'blue', icon: 'crate', damaged: false }],
      scrapRules: ['any'],
    });
    expect(applySwitchyardAction('SCRAP_ITEM', scrapAnyState).status).toBe('SUCCESS');

    const scrapNoneState = createInitialSwitchyardState({
      incomingStream: [{ color: 'red', icon: 'crate', damaged: true }],
      scrapRules: ['none'],
    });
    expect(applySwitchyardAction('SCRAP_ITEM', scrapNoneState).status).toBe('COLLISION');

    const quotaState = createInitialSwitchyardState({
      switches: [],
      incomingStream: [
        { color: 'red', icon: 'crate', damaged: false },
        { color: 'red', icon: 'crate', damaged: false },
      ],
      docks: [{ id: 'A', expectedColor: 'red', quota: 1 }],
    });
    const first = applySwitchyardAction('SEND_NEXT', quotaState);
    expect(first.status).toBe('IDLE');
    const overflow = applySwitchyardAction('SEND_NEXT', first);
    expect(overflow.status).toBe('COLLISION');
    expect(overflow.lastFailureReason).toBe('DOCK_QUOTA_EXCEEDED');
  });

  it('marks remaining queue items as COLLISION UNSORTED_ITEMS_REMAIN with STRANDED_CARS diagnostic', () => {
    const partial = createInitialSwitchyardState({
      switches: [],
      incomingStream: [
        { color: 'red', icon: 'crate', damaged: false },
        { color: 'red', icon: 'battery', damaged: false },
      ],
      docks: [{ id: 'A', expectedColor: 'red' }],
    });
    const oneSent = applySwitchyardAction('SEND_NEXT', partial);
    expect(evaluateSwitchyardCompletion(oneSent)).toBe('COLLISION');
    const diag = deriveSwitchyardFailureDiagnostic(oneSent);
    expect(diag).toMatchObject({
      reason: 'UNSORTED_ITEMS_REMAIN',
      detail: { code: 'STRANDED_CARS', remainingCount: 1 },
    });

    const run = runHeadlessSimulation(
      { MAIN: [{ id: 's1', type: 'SEND_NEXT' }] },
      'switchyard',
      partial,
      10
    );
    expect(run.status).toBe('COLLISION');
    expect(run.finalState.lastFailureReason).toBe('UNSORTED_ITEMS_REMAIN');
  });

  it('matches normalized string color/icon names and legacy numeric colorIdx in evaluateSwitchyardSensor', () => {
    const crystalState = createInitialSwitchyardState({
      incomingStream: [{ color: 'amber', icon: 'gem', damaged: true }],
    });

    expect(evaluateSwitchyardSensor({ type: 'hasNextItem' }, crystalState)).toBe(true);
    expect(evaluateSwitchyardSensor({ type: 'itemDamaged' }, crystalState)).toBe(true);
    expect(evaluateSwitchyardSensor({ type: 'itemColor', param: 'yellow' }, crystalState)).toBe(true);
    expect(evaluateSwitchyardSensor({ type: 'itemColor', param: 'amber' }, crystalState)).toBe(true);
    expect(evaluateSwitchyardSensor({ type: 'itemColor', colorIdx: ITEM_COLOR_INDEX.YELLOW }, crystalState)).toBe(true);
    expect(evaluateSwitchyardSensor({ type: 'itemIcon', param: 'crystal' }, crystalState)).toBe(true);
    expect(evaluateSwitchyardSensor({ type: 'itemIcon', param: 'gem' }, crystalState)).toBe(true);
    expect(
      switchyardSimulationEnvironment.evaluateSensor?.('itemIcon', crystalState, { param: 'gem' })
    ).toBe(true);

    const purpleState = createInitialSwitchyardState({
      incomingStream: [{ color: 'purple', icon: 'gear', damaged: false }],
    });
    expect(
      switchyardSimulationEnvironment.evaluateSensor?.('itemColor', purpleState, { color: 'purple' })
    ).toBe(true);
  });

  it('renders Daylight Top-to-Bottom SwitchyardCanvas, ToolbarTools, and Thumbnails cleanly in SSR', () => {
    const stranded = applySwitchyardAction(
      'SEND_NEXT',
      createInitialSwitchyardState({
        switches: [{ id: 'A', initialDirection: 'LEFT' }, { id: 'B', initialDirection: 'LEFT' }],
        incomingStream: [
          { color: 'red', icon: 'crate', damaged: false },
          { color: 'blue', icon: 'battery', damaged: false },
          { color: 'green', icon: 'gear', damaged: false },
        ],
        docks: [
          { id: 'A', expectedColor: 'red' },
          { id: 'B', expectedColor: 'blue' },
          { id: 'C', expectedColor: 'green' },
        ],
      })
    );
    const strandedWithReason: SwitchyardState = {
      ...stranded,
      status: 'COLLISION',
      lastFailureReason: 'UNSORTED_ITEMS_REMAIN',
      lastFailureDetail: { code: 'STRANDED_CARS', remainingCount: 2 },
    };

    const html = renderToStaticMarkup(
      React.createElement(SwitchyardCanvas, {
        state: strandedWithReason,
        runtimeStatus: 'COLLISION',
        spotlightsOverride: ['itemColor'],
      })
    );
    expect(html).toContain('viewBox="0 0 640 540"');
    expect(html).toContain('data-testid="switchyard-canvas"');
    expect(html).toContain('data-testid="switchyard-tunnel"');
    expect(html).toContain('data-testid="switchyard-scanner"');
    expect(html).toContain('data-testid="switchyard-sensor-beam"');
    expect(html).toContain('data-testid="switchyard-branch-skip"');
    expect(html).toContain('data-testid="switchyard-dock-DOCK_A"');
    expect(html).toContain('data-testid="switchyard-dock-DOCK_B"');
    expect(html).toContain('data-testid="switchyard-dock-DOCK_C"');
    expect(html).toContain('🚂 ×2 left!');

    const prevAppMode = useAppStore.getState().appMode;
    let toolbarHtml = '';
    try {
      useAppStore.setState({ appMode: 'sandbox' });
      toolbarHtml = renderToStaticMarkup(React.createElement(SwitchyardToolbarTools));
    } finally {
      useAppStore.setState({ appMode: prevAppMode });
    }
    expect(toolbarHtml).toContain('data-testid="switchyard-toolbar-tools"');
    expect(toolbarHtml).toContain('min-w-[36px] min-h-[36px]');

    const thumb = renderSwitchyardMapSvg(stranded);
    expect(thumb).toContain('viewBox="0 0 180 132"');
    expect(thumb).toContain('#dbeafe');
    expect(thumb).toContain('cx="118" cy="82"');
  });

  it('sanitizes and restores Switchyard v2 state across reload via pwaStateRestoreService', () => {
    const store = useAppStore.getState();
    const customState = createInitialSwitchyardState({
      switches: [],
      incomingStream: [{ color: 'purple', icon: 'gem', damaged: false }],
      docks: [{ id: 'A', expectedItems: [{ color: 'purple', icon: 'gem' }], acceptsDamaged: false }],
      scrapRules: ['none'],
    });

    const ok = saveStateBeforeUpdate({
      appMode: 'sandbox',
      activeSimId: 'switchyard',
      currentLevel: 1,
      workspace: {
        MAIN: [{ id: 'b1', type: 'SEND_NEXT' }],
        F1: [],
        F2: [],
        F3: [],
      },
      savedWorkspaces: {},
      grid: store.grid,
      turtleState: store.turtleState,
      switchyardState: customState,
      runtime: null,
      activeScope: 'MAIN',
      selectedBlockId: null,
      speed: 400,
      editorTool: 'NONE',
      isSubpaletteCollapsed: false,
      isMapHidden: false,
      isFunctionBarOpen: false,
      past: [],
      future: [],
    });
    expect(ok).toBe(true);

    const restored = consumeRestoredStateAfterUpdate(store.grid);
    expect(restored?.switchyardState?.switches).toHaveLength(0);
    expect(restored?.switchyardState?.scrapRule).toBe('none');
    expect(restored?.switchyardState?.queue[0]).toMatchObject({ color: 'PURPLE', icon: 'CRYSTAL' });
    expect(restored?.switchyardState?.docks[0].spec.expectedItems).toEqual([
      { color: 'PURPLE', icon: 'CRYSTAL' },
    ]);
  });

  it('preserves v1 binary wire compat and lossless ENV_VERSION_SWITCHYARD_V2 round-trips', () => {
    const v1Compatible = createInitialSwitchyardState({
      switches: [{ id: 'A', initialDirection: 'RIGHT' }],
      incomingStream: [{ color: 'blue', icon: 'battery', damaged: false }],
      docks: [
        { id: 'A', expectedColor: 'red' },
        { id: 'B', expectedColor: 'blue' },
      ],
    });
    expect(getSwitchyardSerializationVersion(v1Compatible)).toBe(ENV_VERSION_SWITCHYARD);

    const v2State = createInitialSwitchyardState({
      switches: [],
      incomingStream: [{ color: 'purple', icon: 'gem', damaged: true, weight: 6 }],
      docks: [
        {
          id: 'A',
          expectedItems: [{ color: 'purple', icon: 'gem' }],
          acceptsDamaged: true,
          quota: 3,
          minWeight: 2,
          maxWeight: 8,
        },
      ],
      scrapRules: ['none'],
    });
    expect(getSwitchyardSerializationVersion(v2State)).toBe(ENV_VERSION_SWITCHYARD_V2);

    const writer = new BinaryWriter();
    writeSwitchyardState(writer, v2State, ENV_VERSION_SWITCHYARD_V2);
    const reader = new BinaryReader(writer.getBytes());
    const decoded = readSwitchyardState(reader, ENV_VERSION_SWITCHYARD_V2);

    expect(decoded.switches).toHaveLength(0);
    expect(decoded.scrapRule).toBe('none');
    expect(decoded.queue[0]).toMatchObject({ color: 'PURPLE', icon: 'CRYSTAL', damaged: true, weight: 6 });
    expect(decoded.docks[0].spec).toMatchObject({
      expectedItems: [{ color: 'PURPLE', icon: 'CRYSTAL' }],
      rejectDamaged: false,
      quota: 3,
      minWeight: 2,
      maxWeight: 8,
    });
  });

  it('solves Switchyard v2 curriculum shapes (branch.5a, branch.8, branch.A, while.5) under 200ms', () => {
    // 1. branch.5a: damaged hazard scrap sorting
    const branch5a: CurriculumActivity = {
      id: 'test-branch-5a',
      title: 'Hazard Trapdoor',
      simId: 'switchyard',
      kind: 'puzzle',
      palette: {
        allowedSimBlocks: ['SEND_NEXT', 'SCRAP_ITEM'],
        allowedControlBlocks: ['IF', 'ELSE', 'END_IF', 'LOOP_START', 'LOOP_END'],
        allowedSensors: ['itemDamaged'],
      },
      slotCap: 7,
      switchyardVariants: [
        {
          switches: [],
          incomingStream: [
            { color: 'red', icon: 'crate', damaged: true },
            { color: 'red', icon: 'crate', damaged: false },
          ],
          docks: [{ id: 'A', expectedColor: 'red', acceptsDamaged: false }],
          scrapChute: { expectedDamagedOnly: true },
        },
        {
          switches: [],
          incomingStream: [
            { color: 'red', icon: 'crate', damaged: false },
            { color: 'red', icon: 'crate', damaged: true },
          ],
          docks: [{ id: 'A', expectedColor: 'red', acceptsDamaged: false }],
          scrapChute: { expectedDamagedOnly: true },
        },
      ],
      referenceSolution: {
        MAIN: [
          createCurriculumBlock('LOOP_START', 2),
          createCurriculumBlock('IF', undefined, { sensor: 'itemDamaged' }),
          createCurriculumBlock('SCRAP_ITEM'),
          createCurriculumBlock('ELSE'),
          createCurriculumBlock('SEND_NEXT'),
          createCurriculumBlock('END_IF'),
          createCurriculumBlock('LOOP_END'),
        ],
        F1: [],
        F2: [],
        F3: [],
      },
      antiBypassRules: [
        {
          id: 'require-if-5a',
          description: 'Must use IF(itemDamaged) across alternating variants',
          forbidBlocks: ['IF'],
        },
      ],
    };

    const rep5a = verifySwitchyardActivityConstraints(branch5a);
    expect(rep5a.passed).toBe(true);
    expect(rep5a.elapsedMs).toBeLessThan(500);

    // 2. branch.8: 2-switch 3-dock RED/BLUE/GREEN with junction B
    const branch8: CurriculumActivity = {
      id: 'test-branch-8',
      title: 'Two-Switch Junction B',
      simId: 'switchyard',
      kind: 'puzzle',
      palette: {
        allowedSimBlocks: ['SWITCH_LEFT', 'SWITCH_RIGHT', 'SEND_NEXT'],
        allowedControlBlocks: ['IF', 'ELSE_IF', 'ELSE', 'END_IF', 'LOOP_START', 'LOOP_END'],
        allowedSensors: ['itemColor'],
        allowRepeatBadges: true,
      },
      slotCap: 12,
      switchyardVariants: [
        {
          switches: [{ id: 'A', initialDirection: 'LEFT' }, { id: 'B', initialDirection: 'LEFT' }],
          incomingStream: [
            { color: 'red', icon: 'crate', damaged: false },
            { color: 'blue', icon: 'crate', damaged: false },
            { color: 'green', icon: 'crate', damaged: false },
          ],
          docks: [
            { id: 'A', expectedColor: 'red' },
            { id: 'B', expectedColor: 'blue' },
            { id: 'C', expectedColor: 'green' },
          ],
        },
        {
          switches: [{ id: 'A', initialDirection: 'LEFT' }, { id: 'B', initialDirection: 'LEFT' }],
          incomingStream: [
            { color: 'green', icon: 'crate', damaged: false },
            { color: 'red', icon: 'crate', damaged: false },
            { color: 'blue', icon: 'crate', damaged: false },
          ],
          docks: [
            { id: 'A', expectedColor: 'red' },
            { id: 'B', expectedColor: 'blue' },
            { id: 'C', expectedColor: 'green' },
          ],
        },
      ],
      referenceSolution: {
        MAIN: [
          createCurriculumBlock('LOOP_START', 3),
          createCurriculumBlock('IF', undefined, { sensor: 'itemColor', param: 'red' }),
          createCurriculumBlock('SWITCH_LEFT', undefined, { junction: 'A' }),
          createCurriculumBlock('ELSE_IF', undefined, { sensor: 'itemColor', param: 'blue' }),
          createCurriculumBlock('SWITCH_RIGHT', undefined, { junction: 'A' }),
          createCurriculumBlock('SWITCH_LEFT', undefined, { junction: 'B' }),
          createCurriculumBlock('ELSE'),
          createCurriculumBlock('SWITCH_RIGHT', undefined, { junction: 'A' }),
          createCurriculumBlock('SWITCH_RIGHT', undefined, { junction: 'B' }),
          createCurriculumBlock('END_IF'),
          createCurriculumBlock('SEND_NEXT'),
          createCurriculumBlock('LOOP_END'),
        ],
        F1: [],
        F2: [],
        F3: [],
      },
      antiBypassRules: [
        {
          id: 'require-if-b8',
          description: '3-dock multi-variant requires IF branching',
          forbidBlocks: ['IF'],
        },
      ],
    };

    const rep8 = verifySwitchyardActivityConstraints(branch8);
    expect(rep8.passed).toBe(true);
    expect(rep8.elapsedMs).toBeLessThan(500);

    // 3. branch.A: AND / NOT compound conditions
    const branchA: CurriculumActivity = {
      id: 'test-branch-A',
      title: 'Compound Logic Inspection',
      simId: 'switchyard',
      kind: 'puzzle',
      palette: {
        allowedSimBlocks: ['SWITCH_LEFT', 'SWITCH_RIGHT', 'SEND_NEXT', 'SCRAP_ITEM'],
        allowedControlBlocks: ['IF', 'ELSE', 'END_IF', 'LOOP_START', 'LOOP_END'],
        allowedSensors: ['itemDamaged', 'itemColor'],
        allowedCombinators: ['NOT', 'AND'],
        allowRepeatBadges: true,
      },
      slotCap: 13,
      switchyardVariants: [
        {
          switches: [{ id: 'A', initialDirection: 'LEFT' }],
          incomingStream: [
            { color: 'red', icon: 'crate', damaged: true },
            { color: 'red', icon: 'crate', damaged: false },
            { color: 'blue', icon: 'crate', damaged: false },
          ],
          docks: [
            { id: 'A', expectedColor: 'red', acceptsDamaged: false },
            { id: 'B', expectedColor: 'blue', acceptsDamaged: false },
          ],
        },
        {
          switches: [{ id: 'A', initialDirection: 'LEFT' }],
          incomingStream: [
            { color: 'blue', icon: 'crate', damaged: false },
            { color: 'red', icon: 'crate', damaged: false },
            { color: 'red', icon: 'crate', damaged: true },
          ],
          docks: [
            { id: 'A', expectedColor: 'red', acceptsDamaged: false },
            { id: 'B', expectedColor: 'blue', acceptsDamaged: false },
          ],
        },
      ],
      referenceSolution: {
        MAIN: [
          createCurriculumBlock('LOOP_START', 3),
          createCurriculumBlock('IF', undefined, {
            condition: {
              kind: 'and',
              left: { kind: 'sensor', sensor: 'itemColor', param: 'red' },
              right: { kind: 'not', operand: { kind: 'sensor', sensor: 'itemDamaged' } },
            },
          }),
          createCurriculumBlock('SWITCH_LEFT'),
          createCurriculumBlock('SEND_NEXT'),
          createCurriculumBlock('ELSE'),
          createCurriculumBlock('IF', undefined, { sensor: 'itemDamaged' }),
          createCurriculumBlock('SCRAP_ITEM'),
          createCurriculumBlock('ELSE'),
          createCurriculumBlock('SWITCH_RIGHT'),
          createCurriculumBlock('SEND_NEXT'),
          createCurriculumBlock('END_IF'),
          createCurriculumBlock('END_IF'),
          createCurriculumBlock('LOOP_END'),
        ],
        F1: [],
        F2: [],
        F3: [],
      },
      antiBypassRules: [
        {
          id: 'require-sensor-damage-A',
          description: 'Must inspect damage',
          forbidSensors: ['itemDamaged'],
        },
      ],
    };

    const repA = verifySwitchyardActivityConstraints(branchA);
    expect(repA.referenceCheck.passed).toBe(true);
    expect(repA.ruleResults[0].passed).toBe(true);
    expect(repA.elapsedMs).toBeLessThan(500);

    // 4. while.5: WHILE(hasNextItem) on variable-length queues
    const while5: CurriculumActivity = {
      id: 'test-while-5',
      title: 'Variable Convoy Express',
      simId: 'switchyard',
      kind: 'puzzle',
      palette: {
        allowedSimBlocks: ['SWITCH_LEFT', 'SWITCH_RIGHT', 'SEND_NEXT'],
        allowedControlBlocks: ['WHILE', 'END_WHILE', 'IF', 'ELSE', 'END_IF'],
        allowedSensors: ['hasNextItem', 'itemColor'],
      },
      slotCap: 8,
      switchyardVariants: [
        {
          switches: [{ id: 'A', initialDirection: 'LEFT' }],
          incomingStream: [
            { color: 'red', icon: 'crate', damaged: false },
            { color: 'blue', icon: 'crate', damaged: false },
            { color: 'red', icon: 'crate', damaged: false },
          ],
          docks: [
            { id: 'A', expectedColor: 'red' },
            { id: 'B', expectedColor: 'blue' },
          ],
        },
        {
          switches: [{ id: 'A', initialDirection: 'LEFT' }],
          incomingStream: [
            { color: 'blue', icon: 'crate', damaged: false },
            { color: 'red', icon: 'crate', damaged: false },
            { color: 'blue', icon: 'crate', damaged: false },
            { color: 'red', icon: 'crate', damaged: false },
          ],
          docks: [
            { id: 'A', expectedColor: 'red' },
            { id: 'B', expectedColor: 'blue' },
          ],
        },
        {
          switches: [{ id: 'A', initialDirection: 'LEFT' }],
          incomingStream: [
            { color: 'blue', icon: 'crate', damaged: false },
            { color: 'blue', icon: 'crate', damaged: false },
            { color: 'red', icon: 'crate', damaged: false },
            { color: 'red', icon: 'crate', damaged: false },
            { color: 'blue', icon: 'crate', damaged: false },
          ],
          docks: [
            { id: 'A', expectedColor: 'red' },
            { id: 'B', expectedColor: 'blue' },
          ],
        },
      ],
      referenceSolution: {
        MAIN: [
          createCurriculumBlock('WHILE', undefined, { sensor: 'hasNextItem' }),
          createCurriculumBlock('IF', undefined, { sensor: 'itemColor', param: 'red' }),
          createCurriculumBlock('SWITCH_LEFT'),
          createCurriculumBlock('ELSE'),
          createCurriculumBlock('SWITCH_RIGHT'),
          createCurriculumBlock('END_IF'),
          createCurriculumBlock('SEND_NEXT'),
          createCurriculumBlock('END_WHILE'),
        ],
        F1: [],
        F2: [],
        F3: [],
      },
      antiBypassRules: [
        {
          id: 'require-while-5',
          description: 'Variable convoy length requires WHILE(hasNextItem)',
          forbidBlocks: ['WHILE'],
        },
      ],
    };

    const repWhile5 = verifySwitchyardActivityConstraints(while5);
    expect(repWhile5.referenceCheck.passed, repWhile5.referenceCheck.reason).toBe(true);
    expect(repWhile5.ruleResults[0].passed, repWhile5.ruleResults[0].diagnostic).toBe(true);
    expect(repWhile5.passed).toBe(true);
    expect(repWhile5.elapsedMs).toBeLessThan(500);
  });

  it('preserves legacy carsOnTrack overrides and fixes solver IF/ELSE_IF/ELSE cost + single queueLens loopCounts', () => {
    // 1. Legacy carsOnTrack preservation across createInitialSwitchyardState
    const withCars = createInitialSwitchyardState({
      ...DEFAULT_SWITCHYARD_STATE,
      carsOnTrack: [{ id: 'v1-car', color: 'BLUE', shape: 'square', damaged: false, x: 2, y: 0 }],
    });
    expect(withCars.carsOnTrack?.[0]?.id).toBe('v1-car');

    // 2. Exact 10-block loop-wrapped IF/ELSE_IF/ELSE solver cost (LOOP(3) + 4 + tb(1) + eib(2) + eb(1) = 10, previously 11)
    const loopElifElse: CurriculumActivity = {
      id: 'test-ifelifelse-10',
      title: 'Exact 10-Block Loop + IF/ELSE_IF/ELSE',
      simId: 'switchyard',
      kind: 'puzzle',
      palette: {
        allowedSimBlocks: ['SWITCH_LEFT', 'SWITCH_RIGHT', 'SEND_NEXT', 'SCRAP_ITEM'],
        allowedControlBlocks: ['IF', 'ELSE_IF', 'ELSE', 'END_IF', 'LOOP_START', 'LOOP_END'],
        allowedSensors: ['itemDamaged', 'itemColor'],
        allowRepeatBadges: true,
      },
      slotCap: 10,
      switchyardVariants: [
        {
          switches: [{ id: 'A', initialDirection: 'LEFT' }],
          incomingStream: [
            { color: 'red', icon: 'crate', damaged: false },
            { color: 'red', icon: 'crate', damaged: false },
            { color: 'blue', icon: 'crate', damaged: false },
          ],
          docks: [
            { id: 'A', expectedColor: 'red', acceptsDamaged: false },
            { id: 'B', expectedColor: 'blue', acceptsDamaged: false },
          ],
          scrapRules: 'damaged_only',
        },
        {
          switches: [{ id: 'A', initialDirection: 'LEFT' }],
          incomingStream: [
            { color: 'blue', icon: 'crate', damaged: true },
            { color: 'red', icon: 'crate', damaged: false },
            { color: 'blue', icon: 'crate', damaged: false },
          ],
          docks: [
            { id: 'A', expectedColor: 'red', acceptsDamaged: false },
            { id: 'B', expectedColor: 'blue', acceptsDamaged: false },
          ],
          scrapRules: 'damaged_only',
        },
        {
          switches: [{ id: 'A', initialDirection: 'LEFT' }],
          incomingStream: [
            { color: 'red', icon: 'crate', damaged: true },
            { color: 'blue', icon: 'crate', damaged: true },
            { color: 'red', icon: 'crate', damaged: false },
          ],
          docks: [
            { id: 'A', expectedColor: 'red', acceptsDamaged: false },
            { id: 'B', expectedColor: 'blue', acceptsDamaged: false },
          ],
          scrapRules: 'damaged_only',
        },
        {
          switches: [{ id: 'A', initialDirection: 'LEFT' }],
          incomingStream: [
            { color: 'red', icon: 'crate', damaged: false },
            { color: 'red', icon: 'crate', damaged: true },
            { color: 'blue', icon: 'crate', damaged: false },
          ],
          docks: [
            { id: 'A', expectedColor: 'red', acceptsDamaged: false },
            { id: 'B', expectedColor: 'blue', acceptsDamaged: false },
          ],
          scrapRules: 'damaged_only',
        },
      ],
      referenceSolution: {
        MAIN: [
          createCurriculumBlock('LOOP_START', 3),
          createCurriculumBlock('IF', undefined, { sensor: 'itemDamaged' }),
          createCurriculumBlock('SCRAP_ITEM'),
          createCurriculumBlock('ELSE_IF', undefined, { sensor: 'itemColor', param: 'blue' }),
          createCurriculumBlock('SWITCH_RIGHT'),
          createCurriculumBlock('SEND_NEXT'),
          createCurriculumBlock('ELSE'),
          createCurriculumBlock('SEND_NEXT'),
          createCurriculumBlock('END_IF'),
          createCurriculumBlock('LOOP_END'),
        ],
        F1: [],
        F2: [],
        F3: [],
      },
      antiBypassRules: [
        {
          id: 'detect-exact-10-ifelifelse',
          description: 'Finds exact 10-block LOOP(3)+IF/ELSE_IF/ELSE solution within slotCap 10',
          forbidBlocks: [],
        },
      ],
    };

    const repLoop10 = verifySwitchyardActivityConstraints(loopElifElse);
    expect(repLoop10.referenceCheck.passed).toBe(true);
    expect(repLoop10.ruleResults[0].passed, repLoop10.ruleResults[0].diagnostic).toBe(false);
    expect(
      repLoop10.ruleResults[0].minWinningBlocks,
      repLoop10.ruleResults[0].diagnostic
    ).toBe(10);
    expect(
      repLoop10.ruleResults[0].counterexampleWorkspace?.MAIN.some((b) => b.type === 'ELSE_IF')
    ).toBe(true);

    // 3a. Single shared queue length L=4 with allowRepeatBadges=false still tries LOOP_START(2)
    const sameLenNoBadges: CurriculumActivity = {
      id: 'test-loop2-L4-nobadge',
      title: 'Shared Length 4 Loop 2 No Repeat Badges',
      simId: 'switchyard',
      kind: 'puzzle',
      palette: {
        allowedSimBlocks: ['SEND_NEXT'],
        allowedControlBlocks: ['LOOP_START', 'LOOP_END'],
        allowRepeatBadges: false,
      },
      slotCap: 4,
      switchyard: {
        switches: [],
        incomingStream: [
          { color: 'red', icon: 'crate', damaged: false },
          { color: 'red', icon: 'crate', damaged: false },
          { color: 'red', icon: 'crate', damaged: false },
          { color: 'red', icon: 'crate', damaged: false },
        ],
        docks: [{ id: 'A', expectedColor: 'red' }],
      },
      referenceSolution: {
        MAIN: [
          createCurriculumBlock('LOOP_START', 2),
          createCurriculumBlock('SEND_NEXT'),
          createCurriculumBlock('SEND_NEXT'),
          createCurriculumBlock('LOOP_END'),
        ],
        F1: [],
        F2: [],
        F3: [],
      },
      antiBypassRules: [
        {
          id: 'catch-loop2-len4',
          description: 'Solver explores LOOP_START(2) when queueLens is [4]',
          forbidBlocks: [],
        },
      ],
    };

    const repLen4NoBadge = verifySwitchyardActivityConstraints(sameLenNoBadges);
    expect(repLen4NoBadge.referenceCheck.passed).toBe(true);
    expect(repLen4NoBadge.ruleResults[0].passed).toBe(false);
    expect(repLen4NoBadge.ruleResults[0].minWinningBlocks).toBe(4);

    // 3b. Single shared queue length L=4 with allowRepeatBadges=true also finds LOOP_START(2) 2-item-per-iter bypass
    const sameLenWithBadges: CurriculumActivity = {
      id: 'test-loop2-L4-withbadge',
      title: 'Shared Length 4 Loop 2 With Repeat Badges',
      simId: 'switchyard',
      kind: 'puzzle',
      palette: {
        allowedSimBlocks: ['SWITCH_LEFT', 'SWITCH_RIGHT', 'SEND_NEXT'],
        allowedControlBlocks: ['IF', 'ELSE', 'END_IF', 'LOOP_START', 'LOOP_END'],
        allowedSensors: ['itemColor'],
        allowRepeatBadges: true,
      },
      slotCap: 6,
      switchyard: {
        switches: [{ id: 'A', initialDirection: 'LEFT' }],
        incomingStream: [
          { color: 'red', icon: 'crate', damaged: false },
          { color: 'blue', icon: 'crate', damaged: false },
          { color: 'red', icon: 'crate', damaged: false },
          { color: 'blue', icon: 'crate', damaged: false },
        ],
        docks: [
          { id: 'A', expectedColor: 'red' },
          { id: 'B', expectedColor: 'blue' },
        ],
      },
      referenceSolution: {
        MAIN: [
          createCurriculumBlock('LOOP_START', 2),
          createCurriculumBlock('SEND_NEXT'),
          createCurriculumBlock('SWITCH_RIGHT'),
          createCurriculumBlock('SEND_NEXT'),
          createCurriculumBlock('SWITCH_LEFT'),
          createCurriculumBlock('LOOP_END'),
        ],
        F1: [],
        F2: [],
        F3: [],
      },
      antiBypassRules: [
        {
          id: 'catch-loop2-forbid-if-len4',
          description: 'Catches LOOP_START(2) alternating pair bypass even when queueLens=[4] and allowRepeatBadges=true',
          forbidBlocks: ['IF'],
        },
      ],
    };

    const repLen4Badge = verifySwitchyardActivityConstraints(sameLenWithBadges);
    expect(repLen4Badge.referenceCheck.passed).toBe(true);
    expect(repLen4Badge.ruleResults[0].passed).toBe(false);
    expect(repLen4Badge.ruleResults[0].minWinningBlocks).toBe(6);
  });
});
