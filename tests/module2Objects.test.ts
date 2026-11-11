import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CURRICULUM_ACTIVITIES,
  MODULE_2_OBJECTS_ACTIVITIES,
  createCurriculumGridState,
  getActivitiesForModule,
  getActivityLatest,
  getCurriculumModule,
} from '../src/data/curriculum';
import { LESSON_2_6_DEMO_TABS } from '../src/data/curriculum/module2Objects';
import { ExplanationDemoBar } from '../src/components/ExplanationDemoBar';
import { GridCanvas } from '../src/components/GridCanvas';
import { runHeadlessSimulation } from '../src/engine/simulationRunner';
import { verifyActivityConstraints } from '../src/engine/verification/constraintSolver';
import { base64URLToUint8Array } from '../src/engine/serialization/binaryReader';
import {
  exportLessonCodeOnly,
  exportLessonToBinary,
  exportLessonToString,
  importFromString,
} from '../src/engine/serialization/codeSerializer';
import {
  ENV_ID_GENERIC,
  ENV_ID_LESSON,
  FORMAT_VERSION,
  MASK_HAS_REP,
  OP_GRID_PICK_UP,
  OP_GRID_USE_DROP,
  OP_PLACEHOLDER,
} from '../src/engine/serialization/types';
import {
  clearAllSavedPrograms,
  getProgramById,
  saveProgram,
} from '../src/services/localSaveService';
import { useAppStore } from '../src/store/useAppStore';
import { WorkspaceState } from '../src/types';

function stripWorkspaceIds(ws?: WorkspaceState) {
  return {
    MAIN: (ws?.MAIN || []).map(({ id: _id, ...rest }) => rest),
    F1: (ws?.F1 || []).map(({ id: _id, ...rest }) => rest),
    F2: (ws?.F2 || []).map(({ id: _id, ...rest }) => rest),
    F3: (ws?.F3 || []).map(({ id: _id, ...rest }) => rest),
  };
}

describe('Commit 15 (Wave 4): Module 2 Interactive Object Lessons (2.6, 2.7) & Capstone 2A', () => {
  beforeEach(() => {
    clearAllSavedPrograms();
    const store = useAppStore.getState();
    store.pause();
    store.setSpeed(400);
    store.setAppMode('sandbox');
    store.setSimEnvironment('grid');
    store.setLevel(1);
    store.clearWorkspace();
    store.setActiveScope('MAIN');
    store.setSelectedBlockId(null);
    useAppStore.setState({
      curriculumWorkspaces: {},
      completedActivities: {},
      activeDemoTabIndex: 0,
      demoTabIndexByActivity: {},
      exploredDemoTabs: {},
      sandboxSnapshot: null,
      statusAnnouncement: '',
      isVictoryModalOpen: false,
    });
    store.clearHistory();
  });

  describe('1. Module 2 Catalog Registration & Schema Invariants', () => {
    it('registers 2.6, 2.7, and 2A in MODULE_2_OBJECTS_ACTIVITIES and CURRICULUM_ACTIVITIES', () => {
      expect(MODULE_2_OBJECTS_ACTIVITIES.map((a) => a.id)).toEqual(['2.6', '2.7', '2A']);

      const m2Ids = getActivitiesForModule('module-2').map((a) => a.id);
      expect(m2Ids).toContain('2.6');
      expect(m2Ids).toContain('2.7');
      expect(m2Ids).toContain('2A');

      for (const id of ['2.6', '2.7', '2A']) {
        const act = getActivityLatest(id);
        expect(act).toBeDefined();
        expect(act?.moduleId).toBe('module-2');
        expect(act?.version).toBe(1);
        expect(act?.simId).toBe('grid');
        expect(CURRICULUM_ACTIVITIES.some((c) => c.id === id)).toBe(true);
      }

      const mod2 = getCurriculumModule('module-2')!;
      expect(mod2.capstoneIds).toContain('2A');
    });
  });

  describe('2. Lesson 2.6 [📖 Explanation]: 3 Interactive World-Item Demo Tabs & Backpack Spotlights', () => {
    it('defines 3 compact demo tabs (4×3–5×3, 4–5 blocks each) with execution-order, world-item, and backpack spotlights', () => {
      const lesson26 = getActivityLatest('2.6')!;
      expect(lesson26.format).toBe('explanation');
      expect(lesson26.icon).toBe('📖');
      expect(lesson26.demoTabs).toHaveLength(3);
      expect(LESSON_2_6_DEMO_TABS).toHaveLength(3);

      for (const tab of lesson26.demoTabs!) {
        expect(tab.gridState).toBeDefined();
        expect(tab.gridState!.width).toBeGreaterThanOrEqual(4);
        expect(tab.gridState!.width).toBeLessThanOrEqual(5);
        expect(tab.gridState!.height).toBe(3);
        expect(tab.workspace.MAIN.length).toBeGreaterThanOrEqual(4);
        expect(tab.workspace.MAIN.length).toBeLessThanOrEqual(5);
        expect(tab.spotlights).toEqual(['execution-order', 'world-item', 'backpack']);

        // Headless run reaches SUCCESS cleanly
        const headless = runHeadlessSimulation(
          tab.workspace,
          'grid',
          createCurriculumGridState(tab.gridState!)
        );
        expect(headless.status).toBe('SUCCESS');
      }
    });

    it('steps through Tab [1] (Key & Gate), Tab [2] (Plank & Water), and Tab [3] (Crate & Switch) with live backpack & spotlight transitions', () => {
      const store = useAppStore.getState();
      store.setCurriculumActivity('2.6');

      // --- Tab [1]: Key (● amber circle) & Locked Gate ---
      expect(useAppStore.getState().activeDemoTabIndex).toBe(0);
      let canvasHtml = renderToStaticMarkup(React.createElement(GridCanvas));
      expect(canvasHtml).toContain('data-testid="spotlight-execution-order"');
      expect(canvasHtml).toContain('data-testid="spotlight-world-item"');
      expect(canvasHtml).toContain('data-testid="spotlight-backpack"');
      expect(canvasHtml).toContain('data-carried-item="empty"');

      store.step(); // 1. MOVE_FWD -> (1,1) onto amber circle key
      expect(useAppStore.getState().grid.robot).toMatchObject({ x: 1, y: 1, dir: 'EAST' });

      store.step(); // 2. PICK_UP -> backpack holds key (●)
      expect(useAppStore.getState().grid.robot.carriedItem).toMatchObject({
        type: 'key',
        shape: 'circle',
        color: 'amber',
      });
      canvasHtml = renderToStaticMarkup(React.createElement(GridCanvas));
      expect(canvasHtml).toContain('data-carried-item="key"');

      store.step(); // 3. USE_DROP -> gate at (2,1) unlocks, backpack empties
      expect(useAppStore.getState().grid.robot.carriedItem).toBeNull();
      expect(useAppStore.getState().grid.lockedGates?.[0].unlocked).toBe(true);
      expect(useAppStore.getState().grid.lockedGates?.[0].unlockedByKey).toBe(true);
      canvasHtml = renderToStaticMarkup(React.createElement(GridCanvas));
      expect(canvasHtml).toContain('data-carried-item="empty"');

      store.step(); // 4. MOVE_FWD -> (2,1)
      store.step(); // 5. MOVE_FWD -> (3,1) Goal
      expect(useAppStore.getState().grid.status).toBe('SUCCESS');
      // Explanation demos never spam VictoryCelebrationModal
      expect(useAppStore.getState().isVictoryModalOpen).toBe(false);

      // --- Tab [2]: Plank & Water Gap ---
      store.selectExplanationDemoTab(1);
      expect(useAppStore.getState().activeDemoTabIndex).toBe(1);
      expect(useAppStore.getState().grid.waterCells).toEqual([{ x: 2, y: 1 }]);
      expect(useAppStore.getState().grid.bridgedWaterCells).toEqual([]);

      store.step(); // 1. MOVE_FWD -> (1,1) onto plank
      store.step(); // 2. PICK_UP -> backpack holds plank
      expect(useAppStore.getState().grid.robot.carriedItem?.type).toBe('plank');
      canvasHtml = renderToStaticMarkup(React.createElement(GridCanvas));
      expect(canvasHtml).toContain('data-carried-item="plank"');

      store.step(); // 3. USE_DROP -> bridges water at (2,1), backpack empties
      expect(useAppStore.getState().grid.robot.carriedItem).toBeNull();
      expect(useAppStore.getState().grid.bridgedWaterCells).toEqual([{ x: 2, y: 1 }]);
      canvasHtml = renderToStaticMarkup(React.createElement(GridCanvas));
      expect(canvasHtml).toContain('data-carried-item="empty"');

      store.step(); // 4. MOVE_FWD -> (2,1) across bridge
      store.step(); // 5. MOVE_FWD -> (3,1) Goal
      expect(useAppStore.getState().grid.status).toBe('SUCCESS');

      // --- Tab [3]: Crate & Linked Floor Switch ---
      store.selectExplanationDemoTab(2);
      expect(useAppStore.getState().activeDemoTabIndex).toBe(2);
      expect(useAppStore.getState().grid.floorSwitches?.[0].active).toBe(false);
      expect(useAppStore.getState().grid.lockedGates?.[0].unlocked).toBe(false);

      store.step(); // 1. MOVE_FWD -> (1,1) onto crate
      store.step(); // 2. PICK_UP -> backpack holds crate
      expect(useAppStore.getState().grid.robot.carriedItem?.type).toBe('crate');
      canvasHtml = renderToStaticMarkup(React.createElement(GridCanvas));
      expect(canvasHtml).toContain('data-carried-item="crate"');

      store.step(); // 3. MOVE_FWD -> (2,1) onto recessed floor switch
      expect(useAppStore.getState().grid.robot).toMatchObject({ x: 2, y: 1 });

      store.step(); // 4. USE_DROP -> drops crate onto switch, opens linked gate at (3,1), empties backpack!
      expect(useAppStore.getState().grid.robot.carriedItem).toBeNull();
      expect(useAppStore.getState().grid.floorSwitches?.[0].active).toBe(true);
      expect(useAppStore.getState().grid.lockedGates?.[0].unlocked).toBe(true);
      canvasHtml = renderToStaticMarkup(React.createElement(GridCanvas));
      expect(canvasHtml).toContain('data-carried-item="empty"');

      store.step(); // 5a. MOVE_FWD ×2 (tick 1) -> (3,1) through open gate
      store.step(); // 5b. MOVE_FWD ×2 (tick 2) -> (4,1) Goal
      expect(useAppStore.getState().grid.status).toBe('SUCCESS');

      // Verify all 3 tabs explored in ExplanationDemoBar and Continue (→) advances to 2.7
      const demoBarHtml = renderToStaticMarkup(React.createElement(ExplanationDemoBar));
      expect(demoBarHtml).toContain('data-all-explored="true"');
      const nextId = store.completeExplanationAndContinue();
      expect(nextId).toBe('2.7');
      expect(useAppStore.getState().activeActivityId).toBe('2.7');
      expect(useAppStore.getState().completedActivities['2.6']).toBe(true);
    });
  });

  describe('3. Lesson 2.7 & Capstone 2A Puzzles: Reference Solutions, ? Scaffolds & Anti-Bypass Proofs', () => {
    it('verifies Lesson 2.7 (5×5, 8-slot tray) reference solution, ? scaffold pause/completion, and anti-bypass proofs < 200 ms', () => {
      const act27 = getActivityLatest('2.7')!;
      expect(act27.format).toBe('puzzle');
      expect(act27.icon).toBe('🤖');
      expect(act27.grid?.width).toBe(5);
      expect(act27.grid?.height).toBe(5);
      expect(act27.slotCap?.maxTotal).toBe(8);
      expect(act27.palette).toMatchObject({
        allowedSimBlocks: [
          'MOVE_FWD',
          'MOVE_BACK',
          'TURN_LEFT',
          'TURN_RIGHT',
          'PICK_UP',
          'USE_DROP',
        ],
        allowRepeatBadges: true,
        allowActionParams: false,
        allowVariables: false,
      });
      expect(act27.referenceSolution!.MAIN.length).toBeGreaterThanOrEqual(6);
      expect(act27.referenceSolution!.MAIN.length).toBeLessThanOrEqual(8);

      // Stepping the ? scaffold pauses cleanly on the first PLACEHOLDER (hintCategory: 'item')
      const scaffold = act27.partialHelp?.scaffoldWorkspace!;
      expect(act27.partialHelp?.mode).toBe('scaffold');
      expect(scaffold).toBeDefined();

      const store = useAppStore.getState();
      store.setCurriculumActivity('2.7');
      useAppStore.setState({ workspace: scaffold, runtime: null });
      for (let t = 0; t < 5; t++) {
        useAppStore.getState().step(); // 4 ticks of MOVE_FWD ×4 + 5th tick hits PLACEHOLDER
      }
      expect(useAppStore.getState().runtime?.status).toBe('PAUSED');
      expect(useAppStore.getState().grid.robot).toMatchObject({ x: 0, y: 0, dir: 'NORTH' });

      // Full automated solver verification (reference + scaffold + both antiBypassRules)
      const report = verifyActivityConstraints(act27);
      expect(report.passed).toBe(true);
      expect(report.elapsedMs).toBeLessThan(200);
      expect(report.referenceCheck.passed).toBe(true);
      expect(report.scaffoldCheck.applicable).toBe(true);
      expect(report.scaffoldCheck.passed).toBe(true);

      // Rule 1: forbidBlocks ['PICK_UP', 'USE_DROP'] -> 0 solutions (unbounded)
      expect(report.ruleResults[0].passed).toBe(true);
      expect(report.ruleResults[0].minWinningBlocks).toBeNull();
      // Rule 2: allowRepeatBadges: false -> 0 solutions within 8 slots (unrolled minimum = 16)
      expect(report.ruleResults[1].passed).toBe(true);
      expect(report.ruleResults[1].minWinningBlocks).toBe(16);
    });

    it('verifies Capstone 2A ("The Supply Courier", 6×5, 10-slot tray) sequential 1-slot inventory, ? scaffold, and all 3 anti-bypass proofs < 200 ms', () => {
      const act2A = getActivityLatest('2A')!;
      expect(act2A.format).toBe('capstone');
      expect(act2A.capstoneType).toBe('puzzle');
      expect(act2A.icon).toBe('🏆');
      expect(act2A.title).toBe('The Supply Courier');
      expect(act2A.grid?.width).toBe(6);
      expect(act2A.grid?.height).toBe(5);
      expect(act2A.slotCap?.maxTotal).toBe(10);
      expect(act2A.referenceSolution!.MAIN.length).toBeGreaterThanOrEqual(9);
      expect(act2A.referenceSolution!.MAIN.length).toBeLessThanOrEqual(10);

      // Step through referenceSolution on live store to verify 1-slot backpack transitions:
      // empty -> key (◆) -> empty -> plank -> empty -> SUCCESS
      const store = useAppStore.getState();
      store.setCurriculumActivity('2A');
      store.loadSolution();
      expect(useAppStore.getState().isVictoryModalOpen).toBe(false);

      const carriedHistory: Array<string | null> = [];
      for (let safety = 0; safety < 40; safety++) {
        useAppStore.getState().step();
        const g = useAppStore.getState().grid;
        const curType = g.robot.carriedItem?.type ?? null;
        if (carriedHistory[carriedHistory.length - 1] !== curType) {
          carriedHistory.push(curType);
        }
        if (g.status === 'SUCCESS' || g.status === 'COLLISION') {
          break;
        }
      }
      expect(useAppStore.getState().grid.status).toBe('SUCCESS');
      expect(carriedHistory).toEqual([null, 'key', null, 'plank', null]);

      // Automated solver verification (reference + scaffold + all 3 antiBypassRules)
      const report = verifyActivityConstraints(act2A);
      expect(report.passed).toBe(true);
      expect(report.elapsedMs).toBeLessThan(200);
      expect(report.referenceCheck.passed).toBe(true);
      expect(report.scaffoldCheck.applicable).toBe(true);
      expect(report.scaffoldCheck.passed).toBe(true);
      expect(report.ruleResults).toHaveLength(3);

      // Rule 1: forbidBlocks ['PICK_UP', 'USE_DROP'] -> 0 solutions
      expect(report.ruleResults[0].passed).toBe(true);
      expect(report.ruleResults[0].minWinningBlocks).toBeNull();
      // Rule 2: maxActionExecutions: { USE_DROP: 1 } -> 0 solutions (proves BOTH Key+Gate AND Plank+Water are mandatory!)
      expect(report.ruleResults[1].passed).toBe(true);
      expect(report.ruleResults[1].minWinningBlocks).toBeNull();
      // Rule 3: allowRepeatBadges: false -> 0 solutions inside 10-slot tray (unrolled minimum = 19)
      expect(report.ruleResults[2].passed).toBe(true);
      expect(report.ruleResults[2].minWinningBlocks).toBe(19);
    });
  });

  describe('4. Dual-Path Code-Only Serialization (OP_GRID_PICK_UP = 0x14 & OP_GRID_USE_DROP = 0x15)', () => {
    it('round-trips 2.7 and 2A solutions and ? scaffolds identically across SavedProgramEntry (Path A) and ENV_ID_LESSON = 0x04 (Path B)', () => {
      const act27 = getActivityLatest('2.7')!;
      const act2A = getActivityLatest('2A')!;

      for (const [act, ws, label] of [
        [act27, act27.referenceSolution!, '2.7-ref'],
        [act27, act27.partialHelp!.scaffoldWorkspace!, '2.7-scaffold'],
        [act2A, act2A.referenceSolution!, '2A-ref'],
        [act2A, act2A.partialHelp!.scaffoldWorkspace!, '2A-scaffold'],
      ] as const) {
        // Path A: Local Storage manual slot (`SavedProgramEntry` JSON + code-only payload)
        const pathACode = exportLessonCodeOnly(ws, 'grid');
        const pathABytes = base64URLToUint8Array(pathACode);
        expect(pathABytes[0]).toBe(FORMAT_VERSION);
        expect(pathABytes[1]).toBe(ENV_ID_GENERIC);

        const saved = saveProgram({
          title: `Test ${label}`,
          profileId: 'default',
          simId: 'grid',
          code: pathACode,
          screenshot: '',
          status: 'IDLE',
          stepCount: 0,
          lessonId: act.id,
          lessonVersion: act.version,
          slotIndex: 1,
        });
        const loaded = getProgramById(saved.id)!;
        const decodedA = importFromString(loaded.code);

        // Path B: Standalone Share String (`ENV_ID_LESSON = 0x04`)
        const pathBBinary = exportLessonToBinary(ws, 'grid', act.id, act.version);
        expect(pathBBinary[0]).toBe(FORMAT_VERSION);
        expect(pathBBinary[1]).toBe(ENV_ID_LESSON);
        expect(pathBBinary[2]).toBe(ENV_ID_GENERIC);

        const pathBString = exportLessonToString(ws, 'grid', act.id, act.version);
        const decodedB = importFromString(pathBString);

        expect(decodedA.success).toBe(true);
        expect(decodedB.success).toBe(true);
        // Read-only map geometry is NOT duplicated in either curriculum save path
        expect(decodedA.gridState).toBeUndefined();
        expect(decodedB.gridState).toBeUndefined();

        expect(loaded.lessonId).toBe(decodedB.lessonId);
        expect(loaded.lessonVersion).toBe(decodedB.lessonVersion);
        expect(decodedB.lessonId).toBe(act.id);
        expect(decodedB.lessonVersion).toBe(1);

        expect(stripWorkspaceIds(decodedA.workspace)).toEqual(stripWorkspaceIds(ws));
        expect(stripWorkspaceIds(decodedB.workspace)).toEqual(stripWorkspaceIds(ws));
      }

      // Explicitly verify opcode bytes for 2A referenceSolution in Path A stream:
      // [MOVE_FWD ×4, PICK_UP (0x14), TURN_RIGHT, USE_DROP (0x15), MOVE_FWD ×5, ...]
      const raw2A = base64URLToUint8Array(
        exportLessonCodeOnly(act2A.referenceSolution!, 'grid')
      );
      // Header (3B) + scopeCount(1B) + scopeId(1B) + blockCount(1B) = offset 6
      // Block 0: MOVE_FWD ×4 takes 2 bytes (header with MASK_HAS_REP + VLE(4)) -> offsets 6, 7
      // Block 1: PICK_UP -> offset 8
      // Block 2: TURN_RIGHT -> offset 9
      // Block 3: USE_DROP -> offset 10
      expect(raw2A[6] & MASK_HAS_REP).toBe(MASK_HAS_REP);
      expect(raw2A[8]).toBe(OP_GRID_PICK_UP);
      expect(raw2A[10]).toBe(OP_GRID_USE_DROP);

      // Verify OP_PLACEHOLDER (0x09) byte in 2A scaffold at Block 3 (offset 10)
      const raw2AScaffold = base64URLToUint8Array(
        exportLessonCodeOnly(act2A.partialHelp!.scaffoldWorkspace!, 'grid')
      );
      expect(raw2AScaffold[10]).toBe(OP_PLACEHOLDER);
    });
  });
});
