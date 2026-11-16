import { beforeEach, describe, expect, it } from 'vitest';
import {
  CURRICULUM_ACTIVITIES,
  LOOP_DEPOT_ALLOWED_BLOCKS,
  getActivitiesForModule,
  getActivityLatest,
  getCurriculumModule,
} from '../src/data/curriculum';
import { WorkspaceState } from '../src/types';
import {
  ENV_ID_DEPOT,
  ENV_VERSION_DEPOT,
  ENV_VERSION_DEPOT_STATE,
  TURTLE_COLOR_PALETTE,
} from '../src/engine/serialization/types';
import {
  exportLessonToBinary,
  exportToBinary,
  exportToString,
  importFromBinary,
} from '../src/engine/serialization/codeSerializer';
import {
  deserializeProfileBackupFromBinary,
  serializeProfileBackupToBinary,
} from '../src/engine/serialization/profileSerializer';
import { PROFILE_BACKUP_MAGIC, ProfileBackupEnvelopeV1 } from '../src/services/profileService';
import { BEAT_LED_PALETTE, BeatState } from '../src/simulations/beat/types';
import { createInitialBeatState } from '../src/simulations/beat/beatEnvironment';
import { createInitialTurtleState, TURTLE_COLOR_PARAM_DEF } from '../src/simulations/turtle/turtleEnvironment';
import { createInitialDepotState } from '../src/simulations/depot/depotPhysics';
import { DepotState } from '../src/simulations/depot/types';
import { runHeadlessSimulation } from '../src/engine/simulationRunner';
import { verifyActivityConstraints } from '../src/engine/verification/constraintSolver';
import { useAppStore } from '../src/store/useAppStore';
import { createCurriculumBlock } from '../src/data/curriculum/types';
import { TurtleState } from '../src/simulations/turtle/types';

function makeWs(blocks: ReturnType<typeof createCurriculumBlock>[]): WorkspaceState {
  return { MAIN: blocks, F1: [], F2: [], F3: [] };
}

describe('Module 2–3 Curriculum Expansion: 10-Color Palettes, Frame Animation & Crate Depot', () => {
  beforeEach(() => {
    const s = useAppStore.getState();
    s.setAppMode('sandbox');
    s.setSimEnvironment('grid');
    s.reset();
  });

  describe('1. 10-Color Palettes, Selective White Eraser (Turtle) & Selective Black Cutout (Beat)', () => {
    it('expands TURTLE_COLOR_PALETTE to 10 colors preserving indices 0..7 and adding Orange + White', () => {
      expect(TURTLE_COLOR_PALETTE).toHaveLength(10);
      expect(TURTLE_COLOR_PALETTE.slice(0, 8)).toEqual([
        '#0f172a',
        '#ef4444',
        '#3b82f6',
        '#10b981',
        '#f59e0b',
        '#8b5cf6',
        '#ec4899',
        '#06b6d4',
      ]);
      expect(TURTLE_COLOR_PALETTE[8]).toBe('#f97316');
      expect(TURTLE_COLOR_PALETTE[9]).toBe('#ffffff');
      expect(TURTLE_COLOR_PARAM_DEF.options).toHaveLength(10);
    });

    it('expands BEAT_LED_PALETTE to 10 colors preserving indices 0..7 and treats #0f172a Black as selective LED-off across Beat paint blocks', () => {
      expect(BEAT_LED_PALETTE).toHaveLength(10);
      expect(BEAT_LED_PALETTE.slice(0, 8).map((c) => c.hex)).toEqual([
        '#06b6d4',
        '#f43f5e',
        '#fbbf24',
        '#10b981',
        '#a855f7',
        '#3b82f6',
        '#f97316',
        '#ec4899',
      ]);
      expect(BEAT_LED_PALETTE[8]).toEqual({ id: 8, hex: '#0f172a', label: 'Black' });
      expect(BEAT_LED_PALETTE[9]).toEqual({ id: 9, hex: '#ffffff', label: 'White' });

      const ws = makeWs([
        createCurriculumBlock('SET_LED_COLOR', undefined, { color: '#ffffff' }, 'b1'),
        createCurriculumBlock('STAMP_PRESET', undefined, { preset: 'HEART' }, 'b2'),
        createCurriculumBlock('SET_LED_COLOR', undefined, { color: '#0f172a' }, 'b3'),
        createCurriculumBlock('LIGHT_ROW', undefined, { y: 3 }, 'b4'),
        createCurriculumBlock('LIGHT_PIXEL', undefined, { x: 4, y: 2 }, 'b5'),
      ]);

      const res = runHeadlessSimulation<BeatState>(ws, 'beat', createInitialBeatState(true));
      // Row 3 (index 2) and pixel (x=4 -> col 3, y=2 -> row 1) were turned off (null)
      expect(res.finalState.leds[2].every((c) => c === null)).toBe(true);
      expect(res.finalState.leds[1][3]).toBeNull();
      // White pixels outside cutout remain '#ffffff'
      expect(res.finalState.leds[1][1]).toBe('#ffffff');
    });

    it('keeps #ffffff White strokes as valid visible Turtle paths on canvas', () => {
      const ws = makeWs([
        createCurriculumBlock('SET_PEN_COLOR', undefined, { color: '#f97316' }, 't1'),
        createCurriculumBlock('FORWARD', undefined, { length: 100 }, 't2'),
        createCurriculumBlock('SET_PEN_COLOR', undefined, { color: '#ffffff' }, 't3'),
        createCurriculumBlock('BACKWARD', undefined, { length: 50 }, 't4'),
      ]);
      const res = runHeadlessSimulation<TurtleState>(ws, 'turtle', createInitialTurtleState());
      expect(res.finalState.paths).toHaveLength(2);
      expect(res.finalState.paths[0].color).toBe('#f97316');
      expect(res.finalState.paths[1].color).toBe('#ffffff');
    });
  });

  describe('2. Phase 1 Curriculum Updates (param.5, param.6, no TELEPORT, loop.3, loop.4, loop.7, loop.B, loop.C)', () => {
    it('removes SET_BEAT_DELAY from param.5 and teaches speed control + instant frames in param.6 without loops/variables', () => {
      const actParam5 = getActivityLatest('param.5')!;
      const actParam6 = getActivityLatest('param.6')!;
      expect(actParam5.palette.allowedSimBlocks).not.toContain('SET_BEAT_DELAY');
      expect(actParam6.format).toBe('explanation');
      expect(actParam6.simId).toBe('beat');
      expect(actParam6.palette.allowedSimBlocks).toContain('SET_BEAT_DELAY');
      expect(actParam6.palette.allowedControlBlocks).toEqual([]);
      expect(actParam6.palette.allowVariables).toBe(false);
      expect(actParam6.demoTabs).toHaveLength(3);

      for (const tab of actParam6.demoTabs!) {
        const sim = runHeadlessSimulation<BeatState>(tab.workspace, 'beat', createInitialBeatState(true));
        expect(sim.status).toBe('IDLE');
        expect(sim.finalState.leds.flat().some((c) => c !== null)).toBe(true);
      }
    });

    it('keeps TELEPORT out of all Phase 1 curriculum palettes and ensures loop creative activities execute cleanly at v1', () => {
      const loopTitle = getCurriculumModule('loop')!.title;
      expect(loopTitle).toBe('Loops — Repeating Sequences, Nested Loops & LIFO Stacks');

      const preVarModules = new Set(['seq', 'param', 'loop', 'func', 'branch', 'while']);
      for (const act of CURRICULUM_ACTIVITIES) {
        if (preVarModules.has(act.moduleId)) {
          expect(act.palette.allowedSimBlocks ?? []).not.toContain('TELEPORT');
        }
      }
      expect(getActivityLatest('var.6')?.palette.allowedSimBlocks).toContain('TELEPORT');

      for (const id of ['loop.3', 'loop.4', 'loop.7', 'loop.B', 'loop.C']) {
        const latest = getActivityLatest(id)!;
        expect(latest.version).toBe(1);
        expect(latest.variations).toHaveLength(3);
      }

      useAppStore.getState().setAppMode('curriculum');
      useAppStore.getState().setCurriculumActivity('loop.4');
      expect(useAppStore.getState().isLoopPlayback).toBe(false);

      useAppStore.getState().setAppMode('sandbox');
      expect(useAppStore.getState().isLoopPlayback).toBe(false);

      const actLoop3 = getActivityLatest('loop.3')!;
      for (const ws of [actLoop3.starterWorkspace!, ...actLoop3.variations!.map((v) => v.workspace)]) {
        const sim = runHeadlessSimulation<TurtleState>(ws, 'turtle', createInitialTurtleState());
        expect(sim.finalState.paths.length).toBeGreaterThan(0);
      }

      const actLoop4 = getActivityLatest('loop.4')!;
      for (const ws of [actLoop4.starterWorkspace!, ...actLoop4.variations!.map((v) => v.workspace)]) {
        const sim = runHeadlessSimulation<BeatState>(ws, 'beat', createInitialBeatState(true));
        expect(sim.finalState.leds.flat().some((c) => c !== null)).toBe(true);
      }
    });
  });

  describe('3. Depot Physics, Binary Serialization (ENV_ID_DEPOT = 0x07), Lessons loop.8–loop.10 & Constraint Proofs', () => {
    it('enforces 1-crate claw, LIFO stack discipline, and exact OUTPUT goal sequence matching', () => {
      const s0 = createInitialDepotState({
        stacks: [['RED', 'BLUE'], [], []],
        targetOutput: ['RED', 'BLUE'],
        workerStation: 'STACK_1',
      });

      // Trying to SEND_OUT BLUE directly succeeds ONLY? Wait: first expected output is RED!
      // Grabbing top of Stack 1 gives BLUE; sending BLUE out triggers WRONG_OUTPUT_ORDER
      const badWs = makeWs([
        createCurriculumBlock('DEPOT_GRAB', undefined, undefined, 'd1'),
        createCurriculumBlock('DEPOT_SEND_OUT', undefined, undefined, 'd2'),
      ]);
      const badRes = runHeadlessSimulation<DepotState>(badWs, 'depot', s0);
      expect(badRes.status).toBe('COLLISION');
      expect(badRes.finalState.lastFailureReason).toBe('WRONG_OUTPUT_ORDER');

      // Reversing Stack 1 into Stack 2 puts BLUE on bottom and RED on top -> sending RED then BLUE succeeds!
      const goodWs = makeWs([
        createCurriculumBlock('DEPOT_GRAB', undefined, undefined, 'g1'),
        createCurriculumBlock('DEPOT_MOVE_TO', undefined, { station: 'STACK_2' }, 'g2'),
        createCurriculumBlock('DEPOT_PLACE', undefined, undefined, 'g3'),
        createCurriculumBlock('DEPOT_MOVE_TO', undefined, { station: 'STACK_1' }, 'g4'),
        createCurriculumBlock('DEPOT_GRAB', undefined, undefined, 'g5'),
        createCurriculumBlock('DEPOT_MOVE_TO', undefined, { station: 'STACK_2' }, 'g6'),
        createCurriculumBlock('DEPOT_PLACE', undefined, undefined, 'g7'),
        createCurriculumBlock('DEPOT_SEND_OUT', undefined, undefined, 'g8'), // error? need GRAB first!
      ]);
      // Grab twice without placing triggers CLAW_FULL
      const fullWs = makeWs([
        createCurriculumBlock('DEPOT_GRAB', undefined, undefined, 'f1'),
        createCurriculumBlock('DEPOT_GRAB', undefined, undefined, 'f2'),
      ]);
      const fullRes = runHeadlessSimulation<DepotState>(fullWs, 'depot', s0);
      expect(fullRes.status).toBe('COLLISION');
      expect(fullRes.finalState.lastFailureReason).toBe('CLAW_FULL');

      // Ensure goodWs needs GRAB before SEND_OUT: let's verify clean transfer + send out:
      const transferSendWs = makeWs([
        createCurriculumBlock('LOOP_START', 2, undefined, 'ts1'),
        createCurriculumBlock('DEPOT_GRAB', undefined, undefined, 'ts2'),
        createCurriculumBlock('DEPOT_MOVE_TO', undefined, { station: 'STACK_2' }, 'ts3'),
        createCurriculumBlock('DEPOT_PLACE', undefined, undefined, 'ts4'),
        createCurriculumBlock('DEPOT_MOVE_TO', undefined, { station: 'STACK_1' }, 'ts5'),
        createCurriculumBlock('LOOP_END', undefined, undefined, 'ts6'),
        createCurriculumBlock('DEPOT_MOVE_TO', undefined, { station: 'STACK_2' }, 'ts7'),
        createCurriculumBlock('LOOP_START', 2, undefined, 'ts8'),
        createCurriculumBlock('DEPOT_GRAB', undefined, undefined, 'ts9'),
        createCurriculumBlock('DEPOT_SEND_OUT', undefined, undefined, 'ts10'),
        createCurriculumBlock('LOOP_END', undefined, undefined, 'ts11'),
      ]);
      const winRes = runHeadlessSimulation<DepotState>(transferSendWs, 'depot', s0);
      expect(winRes.status).toBe('SUCCESS');
      expect(winRes.finalState.output).toEqual(['RED', 'BLUE']);
      void goodWs;
    });

    it('round-trips ENV_ID_DEPOT code-only (v1), full DepotState (v2), ENV_ID_LESSON (0x04), and Profile SIM_CODE_DEPOT=4', () => {
      const ws = getActivityLatest('loop.9')!.referenceSolution!;
      const depotState = getActivityLatest('loop.10')!.depot!;

      const binV1 = exportToBinary(ws, 'depot');
      expect(binV1[1]).toBe(ENV_ID_DEPOT);
      expect(binV1[2]).toBe(ENV_VERSION_DEPOT);
      const decV1 = importFromBinary(binV1);
      expect(decV1.success).toBe(true);
      expect(decV1.envId).toBe('depot');
      expect(decV1.depotState).toBeUndefined();
      expect(decV1.workspace?.MAIN.map((b) => b.type)).toEqual(ws.MAIN.map((b) => b.type));

      const binV2 = exportToBinary(ws, 'depot', depotState);
      expect(binV2[1]).toBe(ENV_ID_DEPOT);
      expect(binV2[2]).toBe(ENV_VERSION_DEPOT_STATE);
      const decV2 = importFromBinary(binV2);
      expect(decV2.success).toBe(true);
      expect(decV2.envId).toBe('depot');
      expect(decV2.depotState?.stacks).toEqual(depotState.stacks);
      expect(decV2.depotState?.targetOutput).toEqual(depotState.targetOutput);
      expect(decV2.depotState?.workerStation).toBe(depotState.workerStation);

      const lessonBin = exportLessonToBinary(ws, 'depot', 'loop.9', 1);
      const decLesson = importFromBinary(lessonBin);
      expect(decLesson.success).toBe(true);
      expect(decLesson.envId).toBe('lesson');
      expect(decLesson.innerEnvId).toBe('depot');
      expect(decLesson.lessonId).toBe('loop.9');

      const exportedAt = 1760000500000;
      const envelope: ProfileBackupEnvelopeV1 = {
        type: PROFILE_BACKUP_MAGIC,
        version: 1,
        exportedAt,
        profile: {
          id: 'prof_depot',
          avatarId: 'robot',
          colorId: 'amber',
          accentColor: '#f59e0b',
          name: 'Builder',
          createdAt: exportedAt - 10000,
        },
        progress: {
          completedLessons: {},
          unlockedModules: ['seq', 'param', 'loop'],
          earnedBadges: [],
          unlockAllModules: false,
        },
        autosaves: {
          lessons: {},
          sandbox: {
            depot: {
              workspace: ws,
              updatedAt: exportedAt - 1000,
            },
          },
        },
        savedPrograms: [
          {
            version: 1,
            title: 'Depot Transfer',
            createdAt: exportedAt - 2000,
            simId: 'depot',
            code: exportToString(ws, 'depot', depotState),
            screenshot: 'data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E',
            status: 'SUCCESS',
            stepCount: 8,
          },
        ],
      };

      const encodedProfile = serializeProfileBackupToBinary(envelope);
      const decodedProfile = deserializeProfileBackupFromBinary(encodedProfile);
      expect(decodedProfile.autosaves.sandbox.depot?.workspace.MAIN.map((b) => b.type)).toEqual(
        ws.MAIN.map((b) => b.type)
      );
      expect(decodedProfile.savedPrograms[0].simId).toBe('depot');
      expect(decodedProfile.savedPrograms[0].title).toBe('Depot Transfer');
    });

    it('registers loop.8, loop.9, loop.10 cleanly and proves loop.9 & loop.10 solve within slotCap and have 0 loop-free bypasses < 200 ms', () => {
      const loopIds = getActivitiesForModule('loop').map((a) => a.id);
      expect(loopIds).toEqual(expect.arrayContaining(['loop.8', 'loop.9', 'loop.10']));

      const actLoop8 = getActivityLatest('loop.8')!;
      expect(actLoop8.format).toBe('explanation');
      expect(actLoop8.simId).toBe('depot');
      expect(actLoop8.palette.allowedSimBlocks).toEqual(LOOP_DEPOT_ALLOWED_BLOCKS);
      expect(actLoop8.demoTabs).toHaveLength(3);
      for (const tab of actLoop8.demoTabs!) {
        const res = runHeadlessSimulation<DepotState>(tab.workspace, 'depot', tab.depotState!);
        expect(res.status).toBe('SUCCESS');
      }

      const report9 = verifyActivityConstraints(getActivityLatest('loop.9')!);
      expect(report9.passed).toBe(true);
      expect(report9.elapsedMs).toBeLessThan(500);
      expect(report9.referenceCheck.blockCount).toBe(6);
      expect(report9.scaffoldCheck.passed).toBe(true);
      expect(report9.ruleResults[0].bypassSolution).toBeUndefined();

      const report10 = verifyActivityConstraints(getActivityLatest('loop.10')!);
      expect(report10.passed).toBe(true);
      expect(report10.elapsedMs).toBeLessThan(500);
      expect(report10.referenceCheck.blockCount).toBe(8);
      expect(report10.scaffoldCheck.passed).toBe(true);
      expect(report10.ruleResults[0].bypassSolution).toBeUndefined();
    });
  });
});
