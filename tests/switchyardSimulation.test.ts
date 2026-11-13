import { describe, it, expect } from 'vitest';
import { WorkspaceState } from '../src/types';
import {
  SwitchyardState,
  SwitchyardItem,
  ITEM_COLOR_INDEX,
  ITEM_ICON_INDEX,
} from '../src/simulations/switchyard/types';
import {
  createInitialSwitchyardState,
  resetSwitchyardState,
  applySwitchyardAction,
  evaluateSwitchyardSensor,
  evaluateSwitchyardCompletion,
} from '../src/simulations/switchyard/physics';
import { DEFAULT_SWITCHYARD_STATE } from '../src/simulations/switchyard/presets';
import {
  ENV_ID_SWITCHYARD,
  ENV_VERSION_SWITCHYARD,
  ENV_ID_LESSON,
} from '../src/engine/serialization/types';
import {
  writeSwitchyardState,
  readSwitchyardState,
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
import { generateSimulationThumbnail } from '../src/services/mapThumbnailGenerator';

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
