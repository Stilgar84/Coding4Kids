import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CURRICULUM_ACTIVITIES,
  ConditionExpr,
  CurriculumActivity,
  SceneInputConfig,
  compareCurriculumActivityIds,
  getActivityAtVersion,
  LEGACY_MODULE_ID_ALIASES,
  LEGACY_ACTIVITY_ID_ALIASES,
  resolveModuleIdAlias,
  resolveActivityIdAlias,
} from '../src/data/curriculum';
import {
  computeSlotBudget,
  computeStagedPalettePolicy,
  getControlPairCloserType,
  getRequiredSlotCostForBlockType,
  canInsertBlockIntoBudget,
  normalizeColorLiteralParam,
  resolveDefaultConditionForContext,
} from '../src/utils/curriculumStagePolicy';
import { BinaryWriter } from '../src/engine/serialization/binaryWriter';
import { BinaryReader } from '../src/engine/serialization/binaryReader';
import {
  ENV_ID_GRID,
  ENV_ID_TURTLE,
  ENV_ID_BEAT,
  ENV_ID_DEPOT,
  ENV_ID_SWITCHYARD,
  ENV_VERSION_DEPOT_V4,
  ENV_VERSION_SWITCHYARD_V2,
  COLOR_LITERAL_FLAG,
  COLOR_LITERAL_PALETTE as TYPE_COLOR_PALETTE,
  colorLiteralNameToIdx,
  isColorLiteralString,
  encodeVarOrSensorIndex,
  decodeVarOrSensorIndex,
} from '../src/engine/serialization/types';
import {
  COND_TAG_INSIDE_CANVAS,
  COND_TAG_CURSOR_AT_EDGE,
  COND_TAG_CMP,
  COND_TAG_ITEM_DAMAGED_SY,
  COND_TAG_ITEM_DAMAGED_D,
  STATION_CODES,
  STATION_CODE_NAMES,
  writeConditionExpr,
  readConditionExpr,
  evaluateConditionExpr,
} from '../src/engine/serialization/conditionSerializer';
import { writeCodeScopes, readCodeScopes } from '../src/engine/serialization/codeScopes';
import { evaluateBlockCondition } from '../src/engine/interpreter';
import { runHeadlessSimulation } from '../src/engine/simulationRunner';
import {
  inferHintCategoryForBlockType,
  doesBlockMatchHintCategory,
} from '../src/engine/placeholderHelpers';
import { useAppStore } from '../src/store/useAppStore';
import { ConditionSubpalette } from '../src/components/ConditionSubpalette';
import { SceneInputBarView } from '../src/components/SceneInputBar';
import { ConditionBadge } from '../src/components/ConditionBadge';
import { MultiRunPipsBarView } from '../src/components/MultiRunPipsBar';
import { SimulationTopLeftHud } from '../src/components/SimulationTopLeftHud';
import {
  DepotGateVisual,
  SwitchyardJunctionVisual,
  ParamVisual,
} from '../src/components/params/VisualParamBadges';
import { SolutionModal } from '../src/components/SolutionModal';
import { gridSimulationEnvironment } from '../src/simulations/grid/gridEnvironment';
import { beatSimulationEnvironment } from '../src/simulations/beat/beatEnvironment';
import { switchyardSimulationEnvironment } from '../src/simulations/switchyard/switchyardEnvironment';
import { WorkspaceState } from '../src/types';

function makeSyntheticGridActivity(
  overrides: Partial<CurriculumActivity> & Pick<CurriculumActivity, 'id' | 'moduleId' | 'format'>
): CurriculumActivity {
  return {
    version: 1,
    simId: 'grid',
    icon: '🧪',
    title: overrides.id,
    concept: 'branch test',
    palette: { allowedSimBlocks: ['MOVE_FWD'] },
    grid: {
      width: 3,
      height: 1,
      robot: { x: 0, y: 0, dir: 'EAST' },
      barriers: [],
      flags: [{ id: 'goal', x: 2, y: 0, isGoal: true, order: 1, collected: false }],
    },
    ...overrides,
  };
}

describe('Wave 2A: Phase 2 Shared Platform Foundation', () => {
  beforeEach(() => {
    const store = useAppStore.getState();
    store.setAppMode('sandbox');
    store.setSimEnvironment('grid');
    store.setSolutionOpen(false);
    store.clearWorkspace('MAIN');
    store.clearWorkspace('F1');
    store.clearWorkspace('F2');
    store.clearWorkspace('F3');
    store.setSpeed('instant');
  });

  describe('1. Curriculum Types, Pedagogical Sort & Module-5 Legacy Aliases', () => {
    it('maps module-5 -> branch and 5.x -> branch.x legacy aliases', () => {
      expect(LEGACY_MODULE_ID_ALIASES['module-5']).toBe('branch');
      expect(resolveModuleIdAlias('module-5')).toBe('branch');
      expect(LEGACY_ACTIVITY_ID_ALIASES['5.0']).toBe('branch.0');
      expect(LEGACY_ACTIVITY_ID_ALIASES['5.9']).toBe('branch.9');
      expect(LEGACY_ACTIVITY_ID_ALIASES['5A']).toBe('branch.A');
      expect(LEGACY_ACTIVITY_ID_ALIASES['5C']).toBe('branch.C');
      expect(resolveActivityIdAlias('5.4')).toBe('branch.4');
      expect(resolveActivityIdAlias('5C')).toBe('branch.C');
    });

    it('sorts branch curriculum activities in exact overview pedagogical order', () => {
      const sampleIds = [
        'branch.C',
        'branch.10',
        'branch.7a',
        'branch.10a',
        'branch.9',
        'branch.7',
        'branch.8a',
        'branch.7b',
        'branch.8',
        'branch.A',
      ];
      const sorted = [...sampleIds].sort(compareCurriculumActivityIds);
      expect(sorted).toEqual([
        'branch.7',
        'branch.9',
        'branch.7a',
        'branch.7b',
        'branch.8a',
        'branch.8',
        'branch.10a',
        'branch.10',
        'branch.A',
        'branch.C',
      ]);

      expect(compareCurriculumActivityIds('param.6', 'param.C')).toBeLessThan(0);
      expect(compareCurriculumActivityIds('param.C', 'param.7')).toBeLessThan(0);
    });

    it('propagates inputConfig, turtle.showCanvasBounds, and beatRules in getActivityAtVersion', () => {
      const synthetic: CurriculumActivity = {
        id: 'branch.synthetic.10',
        version: 1,
        moduleId: 'branch',
        format: 'creative',
        simId: 'beat',
        icon: '🎛️',
        title: 'Scene Selector Test',
        concept: '$input',
        palette: {
          allowedSimBlocks: ['BEAT_STEP'],
          allowedControlBlocks: ['IF', 'ELSE'],
          allowedSensors: ['$input'],
        },
        inputConfig: {
          mode: 'int',
          min: 1,
          max: 3,
          options: [1, 2, 3],
          previewInput: 2,
        },
        turtle: {
          showCanvasBounds: true,
        },
        beatRules: {
          isLoopingDefault: false,
          cleanResetOnInputChange: true,
        },
      };
      CURRICULUM_ACTIVITIES.push(synthetic);
      try {
        const resolved = getActivityAtVersion('branch.synthetic.10', 1);
        expect(resolved?.inputConfig?.previewInput).toBe(2);
        expect(resolved?.inputConfig?.options).toEqual([1, 2, 3]);
        expect(resolved?.turtle?.showCanvasBounds).toBe(true);
        expect(resolved?.beatRules?.isLoopingDefault).toBe(false);
        expect(resolved?.beatRules?.cleanResetOnInputChange).toBe(true);
      } finally {
        const idx = CURRICULUM_ACTIVITIES.indexOf(synthetic);
        if (idx >= 0) CURRICULUM_ACTIVITIES.splice(idx, 1);
      }
    });
  });

  describe('2. Binary Condition, $input & Color Literal Codec', () => {
    it('exports Phase 2 env versions and encodes explicit sensor bytes & 0x40..0x49 color tokens', () => {
      expect(ENV_VERSION_DEPOT_V4).toBe(4);
      expect(ENV_VERSION_SWITCHYARD_V2).toBe(2);

      expect(encodeVarOrSensorIndex('$x')).toBe(0x80);
      expect(encodeVarOrSensorIndex('$y')).toBe(0x81);
      expect(encodeVarOrSensorIndex('$heading')).toBe(0x82);
      expect(encodeVarOrSensorIndex('$tileDial')).toBe(0x83);
      expect(encodeVarOrSensorIndex('$input')).toBe(0x84);

      expect(decodeVarOrSensorIndex(0x84)).toBe('$input');
      expect(decodeVarOrSensorIndex(0x80)).toBe('$x');

      expect(TYPE_COLOR_PALETTE[4]).toBe('amber');
      expect(colorLiteralNameToIdx('yellow')).toBe(4);
      expect(colorLiteralNameToIdx('color:yellow')).toBe(4);
      expect(colorLiteralNameToIdx('amber')).toBe(4);
      expect(isColorLiteralString('color:red')).toBe(true);
      expect(isColorLiteralString('yellow')).toBe(true);
      expect(isColorLiteralString(1)).toBe(false);

      expect(encodeVarOrSensorIndex('color:red')).toBe(COLOR_LITERAL_FLAG | 1);
      expect(encodeVarOrSensorIndex('color:yellow')).toBe(COLOR_LITERAL_FLAG | 4);
      expect(decodeVarOrSensorIndex(COLOR_LITERAL_FLAG | 4)).toBe('color:amber');
      expect(decodeVarOrSensorIndex(COLOR_LITERAL_FLAG | 1)).toBe('color:red');
    });

    it('round-trips 0x28 insideCanvas, 0x2A cursorAtEdge, PHYSICAL_TAPE (6), and yellow -> amber index 4', () => {
      expect(COND_TAG_INSIDE_CANVAS).toBe(0x28);
      expect(COND_TAG_CURSOR_AT_EDGE).toBe(0x2a);
      expect(STATION_CODES.PHYSICAL_TAPE).toBe(6);
      expect(STATION_CODES.TAPE).toBe(6);
      expect(STATION_CODE_NAMES[6]).toBe('PHYSICAL_TAPE');

      const expressions: ConditionExpr[] = [
        { kind: 'sensor', sensor: 'insideCanvas' },
        { kind: 'sensor', sensor: 'cursorAtEdge' },
        { kind: 'sensor', sensor: 'stationEmpty', param: 'PHYSICAL_TAPE' },
        { kind: 'sensor', sensor: 'stationEmpty', param: 'TAPE' },
        { kind: 'sensor', sensor: 'tileColor', param: 'yellow' },
        { kind: 'sensor', sensor: 'itemColor', param: 'yellow' },
        { kind: 'sensor', sensor: 'heldColor', param: 'amber' },
        { kind: 'sensor', sensor: 'topColor', param: 'yellow' },
      ];

      const writer = new BinaryWriter();
      for (const expr of expressions) {
        writeConditionExpr(writer, expr);
      }
      const reader = new BinaryReader(writer.getBytes());
      const decoded = expressions.map(() => readConditionExpr(reader));

      expect(decoded[0]).toEqual({ kind: 'sensor', sensor: 'insideCanvas' });
      expect(decoded[1]).toEqual({ kind: 'sensor', sensor: 'cursorAtEdge' });
      expect(decoded[2]).toEqual({ kind: 'sensor', sensor: 'stationEmpty', param: 'PHYSICAL_TAPE' });
      expect(decoded[3]).toEqual({ kind: 'sensor', sensor: 'stationEmpty', param: 'PHYSICAL_TAPE' });
      expect(decoded[4]).toEqual({ kind: 'sensor', sensor: 'tileColor', param: 'amber' });
      expect(decoded[5]).toEqual({ kind: 'sensor', sensor: 'itemColor', param: 'amber' });
      expect(decoded[6]).toEqual({ kind: 'sensor', sensor: 'heldColor', param: 'amber' });
      expect(decoded[7]).toEqual({ kind: 'sensor', sensor: 'topColor', param: 'amber' });
    });

    it('preserves 0x11 Switchyard itemDamaged and 0x1A Depot v1-v3 legacy decode compatibility', () => {
      const dmg: ConditionExpr = { kind: 'sensor', sensor: 'itemDamaged' };

      // Switchyard encodes itemDamaged as 0x11
      const syWriter = new BinaryWriter();
      writeConditionExpr(syWriter, dmg, { envByte: ENV_ID_SWITCHYARD });
      const syBytes = syWriter.getBytes();
      expect(syBytes[0]).toBe(COND_TAG_ITEM_DAMAGED_SY);
      expect(readConditionExpr(new BinaryReader(syBytes), { envByte: ENV_ID_SWITCHYARD })).toEqual(dmg);

      // Legacy Depot v3 wrote itemDamaged as 0x1a; decoding in Depot <= v3 context succeeds
      const d3Writer = new BinaryWriter();
      writeConditionExpr(d3Writer, dmg, { envByte: ENV_ID_DEPOT, envVersion: 3 });
      const d3Bytes = d3Writer.getBytes();
      expect(d3Bytes[0]).toBe(COND_TAG_ITEM_DAMAGED_D);
      expect(
        readConditionExpr(new BinaryReader(d3Bytes), { envByte: ENV_ID_DEPOT, envVersion: 3 })
      ).toEqual(dmg);

      // Full code scope round-trip passes envVersion safely through readCodeScopes
      const ws: WorkspaceState = {
        MAIN: [
          { id: 'if_1', type: 'IF', params: { condition: dmg } },
          { id: 'end_1', type: 'END_IF' },
        ],
        F1: [],
        F2: [],
        F3: [],
      };
      const scWriter = new BinaryWriter();
      writeCodeScopes(scWriter, ws, ENV_ID_SWITCHYARD);
      const scDecoded = readCodeScopes(
        new BinaryReader(scWriter.getBytes()),
        ENV_ID_SWITCHYARD,
        ENV_VERSION_SWITCHYARD_V2
      );
      expect(scDecoded.MAIN[0].params?.condition).toEqual(dmg);
    });

    it('round-trips COND_TAG_CMP (0x30) for numeric, negative, float64, $input, and color literals', () => {
      expect(COND_TAG_CMP).toBe(0x30);

      const cmpCases: ConditionExpr[] = [
        { kind: 'cmp', op: '=', left: '$input', right: 1 },
        { kind: 'cmp', op: '!=', left: '$input', right: 3 },
        { kind: 'cmp', op: '=', left: '$input', right: 'color:red' },
        { kind: 'cmp', op: '!=', left: '$input', right: 'color:yellow' },
        { kind: 'cmp', op: '>=', left: '$x', right: 10 },
        { kind: 'cmp', op: '<', left: '$y', right: -5 },
        { kind: 'cmp', op: '<=', left: 'a', right: 3.5 },
      ];

      const writer = new BinaryWriter();
      for (const expr of cmpCases) {
        writeConditionExpr(writer, expr);
      }
      const bytes = writer.getBytes();
      expect(bytes[0]).toBe(COND_TAG_CMP);

      const reader = new BinaryReader(bytes);
      const decoded = cmpCases.map(() => readConditionExpr(reader));

      expect(decoded[0]).toEqual({ kind: 'cmp', op: '=', left: '$input', right: 1 });
      expect(decoded[1]).toEqual({ kind: 'cmp', op: '!=', left: '$input', right: 3 });
      expect(decoded[2]).toEqual({ kind: 'cmp', op: '=', left: '$input', right: 'color:red' });
      expect(decoded[3]).toEqual({ kind: 'cmp', op: '!=', left: '$input', right: 'color:amber' });
      expect(decoded[4]).toEqual({ kind: 'cmp', op: '>=', left: '$x', right: 10 });
      expect(decoded[5]).toEqual({ kind: 'cmp', op: '<', left: '$y', right: -5 });
      expect(decoded[6]).toEqual({ kind: 'cmp', op: '<=', left: 'a', right: 3.5 });
    });
  });

  describe('3. Interpreter & Headless Runner $input + Stage Sensors', () => {
    it('evaluates numeric and color $input comparisons accurately without false cross-type matches', () => {
      const dummySensor = () => false;

      // Numeric $input
      expect(
        evaluateConditionExpr(
          { kind: 'cmp', op: '=', left: '$input', right: 2 },
          {},
          dummySensor,
          { sceneInput: 2 }
        )
      ).toBe(true);
      expect(
        evaluateConditionExpr(
          { kind: 'cmp', op: '!=', left: '$input', right: 2 },
          {},
          dummySensor,
          { sceneInput: 1 }
        )
      ).toBe(true);

      // Color $input ('yellow' aliases to 'amber')
      expect(
        evaluateConditionExpr(
          { kind: 'cmp', op: '=', left: '$input', right: 'color:red' },
          {},
          dummySensor,
          { sceneInput: 'red' }
        )
      ).toBe(true);
      expect(
        evaluateConditionExpr(
          { kind: 'cmp', op: '=', left: '$input', right: 'color:amber' },
          {},
          dummySensor,
          { sceneInput: 'color:yellow' }
        )
      ).toBe(true);

      // CRITICAL: numeric 1 or 0 must NEVER match 'color:red' or 'color:black'
      expect(
        evaluateConditionExpr(
          { kind: 'cmp', op: '=', left: '$input', right: 'color:red' },
          {},
          dummySensor,
          { sceneInput: 1 }
        )
      ).toBe(false);
      expect(
        evaluateConditionExpr(
          { kind: 'cmp', op: '!=', left: '$input', right: 'color:red' },
          {},
          dummySensor,
          { sceneInput: 1 }
        )
      ).toBe(true);
    });

    it('evaluates cursorAtEdge for Beat 1..gridSize coordinates via evaluateBlockCondition', () => {
      const beatEdgeState = { ...beatSimulationEnvironment.initialState, cursor: { x: 1, y: 4 } };
      const beatCenterState = { ...beatSimulationEnvironment.initialState, cursor: { x: 4, y: 4 } };
      const edgeBlock = {
        id: 'if_edge',
        type: 'IF',
        params: { condition: { kind: 'sensor' as const, sensor: 'cursorAtEdge' as const } },
      };

      expect(
        evaluateBlockCondition(edgeBlock, beatEdgeState, beatSimulationEnvironment)
      ).toBe(true);
      expect(
        evaluateBlockCondition(edgeBlock, beatCenterState, beatSimulationEnvironment)
      ).toBe(false);
    });

    it('runs headless simulation with sceneInput / previewInput routing $input branches', () => {
      const initialGrid = {
        ...gridSimulationEnvironment.createInitialState!(),
        width: 3,
        height: 1,
        robot: {
          x: 0,
          y: 0,
          dir: 'EAST' as const,
          initialX: 0,
          initialY: 0,
          initialDir: 'EAST' as const,
        },
        barriers: [],
        flags: [{ id: 'g', x: 2, y: 0, isGoal: true, order: 1, collected: false }],
        trace: [{ x: 0, y: 0 }],
      };

      const workspace: WorkspaceState = {
        MAIN: [
          {
            id: 'if_1',
            type: 'IF',
            params: { condition: { kind: 'cmp', op: '=', left: '$input', right: 2 } },
          },
          { id: 'mv_1', type: 'MOVE_FWD', repeatCount: 2 },
          { id: 'else_1', type: 'ELSE' },
          { id: 'mv_2', type: 'MOVE_FWD', repeatCount: 1 },
          { id: 'end_1', type: 'END_IF' },
        ],
        F1: [],
        F2: [],
        F3: [],
      };

      const passRun = runHeadlessSimulation(workspace, 'grid', initialGrid, undefined, {
        previewInput: 2,
      });
      expect(passRun.status).toBe('SUCCESS');
      expect(passRun.finalState.robot.x).toBe(2);

      const branchRun = runHeadlessSimulation(workspace, 'grid', initialGrid, undefined, {
        sceneInput: 1,
        previewInput: 2,
      });
      expect(branchRun.finalState.robot.x).toBe(1);
    });
  });

  describe('4. Curriculum Stage Policy & Atomic Control Pairs ($remaining >= 2)', () => {
    it('auto-includes END_IF / END_WHILE, propagates allowedSensors/allowedCombinators, and computes pair slot costs', () => {
      const activity = makeSyntheticGridActivity({
        id: 'branch.stage.test',
        moduleId: 'branch',
        format: 'puzzle',
        slotCap: { perScope: { MAIN: 3 } },
        palette: {
          allowedSimBlocks: ['MOVE_FWD'],
          allowedControlBlocks: ['IF', 'ELSE', 'WHILE', 'LOOP_START'],
          allowedSensors: ['pathAhead', '$input'],
          allowedCombinators: ['NOT'],
        },
        inputConfig: { mode: 'color', options: ['red', 'blue'], previewInput: 'red' },
      });

      const policy = computeStagedPalettePolicy('curriculum', activity, gridSimulationEnvironment.paletteItems);
      expect(policy.allowedControlTypes.has('END_IF')).toBe(true);
      expect(policy.allowedControlTypes.has('END_WHILE')).toBe(true);
      expect(policy.canUseSubpaletteParams).toBe(true);
      expect(policy.palette.allowedSensors).toEqual(['pathAhead', '$input']);
      expect(policy.palette.allowedCombinators).toEqual(['NOT']);

      expect(getControlPairCloserType('LOOP_START')).toBe('LOOP_END');
      expect(getControlPairCloserType('IF')).toBe('END_IF');
      expect(getControlPairCloserType('WHILE')).toBe('END_WHILE');
      expect(getControlPairCloserType('ELSE')).toBeNull();
      expect(getControlPairCloserType('ELSE_IF')).toBeNull();

      expect(getRequiredSlotCostForBlockType('LOOP_START')).toBe(2);
      expect(getRequiredSlotCostForBlockType('IF')).toBe(2);
      expect(getRequiredSlotCostForBlockType('WHILE')).toBe(2);
      expect(getRequiredSlotCostForBlockType('ELSE')).toBe(1);
      expect(getRequiredSlotCostForBlockType('ELSE_IF')).toBe(1);

      expect(normalizeColorLiteralParam('yellow')).toBe('color:amber');
      expect(
        resolveDefaultConditionForContext('grid', policy.palette, activity.inputConfig)
      ).toEqual({ kind: 'sensor', sensor: 'pathAhead' });
      expect(
        resolveDefaultConditionForContext(
          'beat',
          { allowedSimBlocks: [], allowedSensors: ['$input'] },
          activity.inputConfig
        )
      ).toEqual({ kind: 'cmp', op: '=', left: '$input', right: 'color:red' });

      const twoUsedBudget = computeSlotBudget(
        {
          MAIN: [
            { id: '1', type: 'MOVE_FWD' },
            { id: '2', type: 'MOVE_FWD' },
          ],
          F1: [],
          F2: [],
          F3: [],
        },
        'MAIN',
        'curriculum',
        { perScope: { MAIN: 3 } }
      );
      expect(twoUsedBudget.remainingForScope).toBe(1);
      expect(canInsertBlockIntoBudget(twoUsedBudget, 'IF')).toBe(false);
      expect(canInsertBlockIntoBudget(twoUsedBudget, 'WHILE')).toBe(false);
      expect(canInsertBlockIntoBudget(twoUsedBudget, 'LOOP_START')).toBe(false);
      expect(canInsertBlockIntoBudget(twoUsedBudget, 'ELSE')).toBe(true);
      expect(canInsertBlockIntoBudget(twoUsedBudget, 'ELSE_IF')).toBe(true);
    });

    it('inserts atomic pairs when remaining >= 2, shakes tray with 0 orphans when remaining < 2, and inserts ELSE singly', () => {
      const cappedActivity = makeSyntheticGridActivity({
        id: 'branch.cap.test',
        moduleId: 'branch',
        format: 'puzzle',
        slotCap: { perScope: { MAIN: 3 } },
        palette: {
          allowedSimBlocks: ['MOVE_FWD'],
          allowedControlBlocks: ['LOOP_START', 'IF', 'ELSE', 'ELSE_IF', 'WHILE'],
          allowedSensors: ['pathAhead'],
        },
      });
      CURRICULUM_ACTIVITIES.push(cappedActivity);
      try {
        const store = useAppStore.getState();
        store.setCurriculumActivity('branch.cap.test', 1);

        // With 3 remaining slots, adding IF inserts [IF, END_IF] atomically (2 slots) with valid condition
        store.addBlock('MAIN', 'IF');
        let main = useAppStore.getState().workspace.MAIN;
        expect(main.map((b) => b.type)).toEqual(['IF', 'END_IF']);
        expect(main[0].params?.condition).toEqual({ kind: 'sensor', sensor: 'pathAhead' });

        // Now only 1 slot remains (3 - 2 = 1): adding WHILE or LOOP_START must reject cleanly with 0 orphans!
        const beforeRejectCount = useAppStore.getState().slotCapRejectionCount;
        store.addBlock('MAIN', 'WHILE');
        expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual(['IF', 'END_IF']);
        expect(useAppStore.getState().slotCapRejectionCount).toBe(beforeRejectCount + 1);

        store.addBlock('MAIN', 'LOOP_START');
        expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual(['IF', 'END_IF']);
        expect(useAppStore.getState().slotCapRejectionCount).toBe(beforeRejectCount + 2);

        // Plain ELSE (1 slot) inserts cleanly inside [IF, ..., END_IF] in that final slot
        store.addBlock('MAIN', 'ELSE', undefined, 1);
        main = useAppStore.getState().workspace.MAIN;
        expect(main.map((b) => b.type)).toEqual(['IF', 'ELSE', 'END_IF']);
      } finally {
        const idx = CURRICULUM_ACTIVITIES.indexOf(cappedActivity);
        if (idx >= 0) CURRICULUM_ACTIVITIES.splice(idx, 1);
      }
    });

    it('replaces PLACEHOLDER blocks with IF/WHILE attaching a valid default condition', () => {
      const store = useAppStore.getState();
      useAppStore.setState({
        workspace: {
          MAIN: [{ id: 'ph_1', type: 'PLACEHOLDER' }],
          F1: [],
          F2: [],
          F3: [],
        },
      });
      store.replacePlaceholderBlock('MAIN', 'ph_1', 'WHILE');
      const blk = useAppStore.getState().workspace.MAIN[0];
      expect(blk.type).toBe('WHILE');
      expect(blk.params?.condition).toBeDefined();
    });
  });

  describe('5. <ConditionSubpalette> & <SceneInputBar> UI & Reset Behavior', () => {
    it('renders staged sensors, combinators, color/icon/station pickers, and $input options in ConditionSubpalette', () => {
      const policy = computeStagedPalettePolicy(
        'curriculum',
        makeSyntheticGridActivity({
          id: 'branch.ui.1',
          moduleId: 'branch',
          format: 'puzzle',
          palette: {
            allowedSimBlocks: ['MOVE_FWD'],
            allowedControlBlocks: ['IF'],
            allowedSensors: ['itemColor', 'itemIcon', 'stationEmpty', '$input'],
            allowedCombinators: ['NOT', 'AND'],
          },
        }),
        switchyardSimulationEnvironment.paletteItems
      );

      const inputConfig: SceneInputConfig = {
        mode: 'color',
        options: ['red', 'blue', 'yellow'],
        previewInput: 'red',
      };

      const colorMarkup = renderToStaticMarkup(
        React.createElement(ConditionSubpalette, {
          block: {
            id: 'if_col',
            type: 'IF',
            params: { condition: { kind: 'sensor', sensor: 'itemColor', param: 'red' } },
          },
          activeScope: 'MAIN',
          activeSimId: 'switchyard',
          policy,
          inputConfig,
          updateBlockParams: () => {},
        })
      );
      expect(colorMarkup).toContain('data-testid="condition-subpalette"');
      expect(colorMarkup).toContain('data-testid="cond-toggle-not"');
      expect(colorMarkup).toContain('data-testid="cond-join-and"');
      expect(colorMarkup).not.toContain('data-testid="cond-join-or"');
      expect(colorMarkup).toContain('data-testid="cond-sensor-itemColor"');
      expect(colorMarkup).toContain('data-testid="cond-sensor-$input"');
      expect(colorMarkup).toContain('data-testid="cond-color-picker"');
      expect(colorMarkup).toContain('data-testid="cond-color-amber"');

      const stationMarkup = renderToStaticMarkup(
        React.createElement(ConditionSubpalette, {
          block: {
            id: 'if_st',
            type: 'IF',
            params: { condition: { kind: 'sensor', sensor: 'stationEmpty', param: 'PHYSICAL_TAPE' } },
          },
          activeScope: 'MAIN',
          activeSimId: 'depot',
          policy,
          inputConfig: null,
          updateBlockParams: () => {},
        })
      );
      expect(stationMarkup).toContain('data-testid="cond-station-picker"');
      expect(stationMarkup).toContain('data-testid="cond-station-PHYSICAL_TAPE"');

      const inputMarkup = renderToStaticMarkup(
        React.createElement(ConditionSubpalette, {
          block: {
            id: 'if_in',
            type: 'IF',
            params: { condition: { kind: 'cmp', op: '=', left: '$input', right: 'color:red' } },
          },
          activeScope: 'MAIN',
          activeSimId: 'beat',
          policy,
          inputConfig,
          updateBlockParams: () => {},
        })
      );
      expect(inputMarkup).toContain('data-testid="cond-input-picker"');
      expect(inputMarkup).toContain('data-testid="cond-input-op-eq"');
      expect(inputMarkup).toContain('data-testid="cond-input-op-neq"');
      expect(inputMarkup).toContain('data-testid="cond-input-opt-amber"');
      // UI Guidelines touch targets (>= 36x36px mobile, >= 44x44px tablet/desktop)
      expect(colorMarkup).toContain('min-w-[36px] min-h-[36px] md:min-w-[44px] md:min-h-[44px]');
      expect(colorMarkup).toContain('w-9 h-9 md:w-11 md:h-11');
      expect(inputMarkup).toContain('min-w-[36px] min-h-[36px] md:min-w-[44px] md:min-h-[44px]');
      expect(inputMarkup).toContain('w-9 h-9 md:w-11 md:h-11');
    });

    it('renders <SceneInputBarView> in numeric & color modes, and setSceneInput resets cleanly + reruns', () => {
      const intMarkup = renderToStaticMarkup(
        React.createElement(SceneInputBarView, {
          inputConfig: { mode: 'int', options: [1, 2, 3], previewInput: 1 },
          value: 2,
          onChange: () => {},
        })
      );
      expect(intMarkup).toContain('data-testid="scene-input-bar"');
      expect(intMarkup).toContain('🎛️');
      expect(intMarkup).toContain('data-testid="scene-input-opt-1"');
      expect(intMarkup).toContain('data-testid="scene-input-opt-2"');
      expect(intMarkup).toContain('data-selected="true"');
      expect(intMarkup).toContain('min-w-[36px] min-h-[36px] h-9 md:min-w-[44px] md:min-h-[44px] md:h-11');

      const colorMarkup = renderToStaticMarkup(
        React.createElement(SceneInputBarView, {
          inputConfig: { mode: 'color', options: ['red', 'green', 'yellow'], previewInput: 'red' },
          value: 'color:yellow',
          onChange: () => {},
        })
      );
      expect(colorMarkup).toContain('data-testid="scene-input-opt-amber"');
      expect(colorMarkup).toContain('w-9 h-9 md:w-11 md:h-11');

      const inputAct = makeSyntheticGridActivity({
        id: 'branch.scene.1',
        moduleId: 'branch',
        format: 'creative',
        inputConfig: { mode: 'int', options: [1, 2], previewInput: 1 },
        palette: { allowedSimBlocks: ['MOVE_FWD'], allowedControlBlocks: ['IF', 'ELSE'] },
        grid: {
          width: 3,
          height: 1,
          robot: { x: 0, y: 0, dir: 'EAST' },
          barriers: [],
          flags: [],
        },
      });
      CURRICULUM_ACTIVITIES.push(inputAct);
      try {
        const store = useAppStore.getState();
        store.setCurriculumActivity('branch.scene.1', 1);
        store.setSpeed('instant');
        useAppStore.setState({
          workspace: {
            MAIN: [
              {
                id: 'if_1',
                type: 'IF',
                params: { condition: { kind: 'cmp', op: '=', left: '$input', right: 2 } },
              },
              { id: 'mv_2', type: 'MOVE_FWD', repeatCount: 2 },
              { id: 'else_1', type: 'ELSE' },
              { id: 'mv_1', type: 'MOVE_FWD', repeatCount: 1 },
              { id: 'end_1', type: 'END_IF' },
            ],
            F1: [],
            F2: [],
            F3: [],
          },
        });
        store.runInstantIfActive();
        expect(useAppStore.getState().sceneInput).toBe(1);
        expect(useAppStore.getState().grid.robot.x).toBe(1);

        store.setSceneInput(2);
        expect(useAppStore.getState().sceneInput).toBe(2);
        expect(useAppStore.getState().grid.robot.x).toBe(2);

        // Variation Card inputConfig override (branch.C Variation 3 color mode)
        store.loadVariationWorkspace(
          { MAIN: [{ id: 'v_mv', type: 'MOVE_FWD' }], F1: [], F2: [], F3: [] },
          'Color Jukebox',
          { mode: 'color', options: ['red', 'blue', 'amber'], previewInput: 'blue' }
        );
        expect(useAppStore.getState().activeVariationInputConfig?.mode).toBe('color');
        expect(useAppStore.getState().sceneInput).toBe('color:blue');

        // Loading the default starter card from the dock (inputConfigOverride = null) clears override & restores activity previewInput
        store.loadVariationWorkspace(
          { MAIN: [{ id: 's_mv', type: 'MOVE_FWD' }], F1: [], F2: [], F3: [] },
          'Default Starter',
          null
        );
        expect(useAppStore.getState().activeVariationInputConfig).toBeNull();
        expect(useAppStore.getState().sceneInput).toBe(1);
      } finally {
        const idx = CURRICULUM_ACTIVITIES.indexOf(inputAct);
        if (idx >= 0) CURRICULUM_ACTIVITIES.splice(idx, 1);
      }
    });

    it('forwards active sceneInput to evaluateValue during non-instant Beat WAIT_BEAT & Turtle FORWARD playback', () => {
      const beatInputAct: CurriculumActivity = {
        id: 'branch.beat.playback',
        version: 1,
        moduleId: 'branch',
        format: 'creative',
        simId: 'beat',
        icon: '🎹',
        title: 'Beat Playback $input',
        subtitle: 'WAIT_BEAT $input delay',
        goalText: '',
        initialSpeed: 400,
        inputConfig: { mode: 'int', options: [1, 2], previewInput: 2 },
        palette: { allowedSimBlocks: ['WAIT_BEAT', 'LIGHT_PIXEL'], allowedControlBlocks: [] },
        beat: { width: 4, height: 4 },
      };
      const turtleInputAct: CurriculumActivity = {
        id: 'branch.turtle.playback',
        version: 1,
        moduleId: 'branch',
        format: 'creative',
        simId: 'turtle',
        icon: '🐢',
        title: 'Turtle Playback $input',
        subtitle: 'FORWARD $input animation + repeatCount',
        goalText: '',
        initialSpeed: 400,
        inputConfig: { mode: 'int', options: [0, 3], previewInput: 3 },
        palette: { allowedSimBlocks: ['FORWARD'], allowedControlBlocks: [] },
        turtle: { x: 0, y: 0, heading: 0, penDown: true, penColor: 'red', penWidth: 2 },
      };

      CURRICULUM_ACTIVITIES.push(beatInputAct, turtleInputAct);
      vi.useFakeTimers();
      try {
        const store = useAppStore.getState();

        // 1. Beat WAIT_BEAT with duration: '$input' (sceneInput = 2 -> 800ms at 400ms 1x)
        store.setCurriculumActivity('branch.beat.playback', 1);
        store.setSpeed(400);
        useAppStore.setState({
          workspace: {
            MAIN: [
              { id: 'wb_1', type: 'WAIT_BEAT', params: { duration: '$input' } },
              { id: 'lp_1', type: 'LIGHT_PIXEL', params: { x: 1, y: 1 } },
            ],
            F1: [],
            F2: [],
            F3: [],
          },
        });
        store.play();
        expect(useAppStore.getState().sceneInput).toBe(2);
        expect(useAppStore.getState().beatState.leds[0][0]).toBeNull();

        // At 400ms (1x fallback duration) LED must still be unlit; at 800ms ($input = 2) it lights up
        vi.advanceTimersByTime(400);
        expect(useAppStore.getState().beatState.leds[0][0]).toBeNull();
        vi.advanceTimersByTime(400);
        expect(useAppStore.getState().beatState.leds[0][0]).not.toBeNull();
        store.pause();

        // 2. Turtle FORWARD with repeatCount: '$input' and length: '$input' (sceneInput = 3)
        const rafCallbacks: FrameRequestCallback[] = [];
        vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
          rafCallbacks.push(cb);
          return rafCallbacks.length;
        });
        vi.stubGlobal('cancelAnimationFrame', vi.fn());

        store.setCurriculumActivity('branch.turtle.playback', 1);
        store.setSpeed(400);
        useAppStore.setState({
          workspace: {
            MAIN: [
              {
                id: 'fw_1',
                type: 'FORWARD',
                repeatCount: '$input',
                params: { length: '$input' },
              },
            ],
            F1: [],
            F2: [],
            F3: [],
          },
        });
        store.play();
        const tState = useAppStore.getState().turtleState;
        const rt = useAppStore.getState().runtime;
        expect(useAppStore.getState().sceneInput).toBe(3);
        expect(rt?.callStack[0]?.subTickLeft).toBe(2);
        expect(rt?.activeRepeatProgress?.total).toBe(3);
        expect(tState.activeAnimation).not.toBeNull();
        expect(tState.activeAnimation?.duration).toBeGreaterThan(0);
        const animDist = Math.hypot(
          (tState.activeAnimation?.toPose.x ?? 0) - (tState.activeAnimation?.fromPose.x ?? 0),
          (tState.activeAnimation?.toPose.y ?? 0) - (tState.activeAnimation?.fromPose.y ?? 0)
        );
        expect(animDist).toBeCloseTo(3);
        expect(rafCallbacks.length).toBeGreaterThanOrEqual(1);
        store.pause();

        // Also verify repeatCount: '$input' uses sceneInput = 0 (skipping block instead of fallback 1)
        const prevRafs = rafCallbacks.length;
        store.setSceneInput(0);
        store.pause();
        useAppStore.setState({
          workspace: {
            MAIN: [
              {
                id: 'fw_zero',
                type: 'FORWARD',
                repeatCount: '$input',
                params: { length: 50 },
              },
            ],
            F1: [],
            F2: [],
            F3: [],
          },
        });
        store.play();
        expect(useAppStore.getState().sceneInput).toBe(0);
        expect(useAppStore.getState().turtleState.activeAnimation).toBeNull();
        expect(useAppStore.getState().turtleState.paths).toHaveLength(0);
        expect(rafCallbacks.length).toBe(prevRafs);
        store.pause();
      } finally {
        useAppStore.getState().pause();
        vi.unstubAllGlobals();
        vi.useRealTimers();
        const bIdx = CURRICULUM_ACTIVITIES.indexOf(beatInputAct);
        if (bIdx >= 0) CURRICULUM_ACTIVITIES.splice(bIdx, 1);
        const tIdx = CURRICULUM_ACTIVITIES.indexOf(turtleInputAct);
        if (tIdx >= 0) CURRICULUM_ACTIVITIES.splice(tIdx, 1);
      }
    });
  });

  describe('6. Multi-Variant Switchyard Sync, STEP_LIMIT UI, Hint Categories & Approved Phase 2 Icons', () => {
    it('syncs switchyardState across IDLE & failure auto-focus in setFocusedVariantIndex', () => {
      const syMultiActivity: CurriculumActivity = {
        id: 'branch.sy.multi',
        version: 1,
        moduleId: 'branch',
        format: 'puzzle',
        simId: 'switchyard',
        icon: '🚂',
        title: 'Multi-Switchyard',
        concept: 'multi-run',
        palette: { allowedSimBlocks: ['SEND_NEXT'] },
        switchyardVariants: [
          {
            label: 'Green Car',
            initialQueue: [{ color: 'GREEN', icon: 'CRATE', damaged: false }],
            initialDockSpecs: [{ id: 'DOCK_A', acceptColor: 'GREEN' }, { id: 'DOCK_B' }],
            initialSwitchDirections: ['LEFT'],
          } as any,
          {
            label: 'Red Car',
            initialQueue: [{ color: 'RED', icon: 'GEAR', damaged: false }],
            initialDockSpecs: [{ id: 'DOCK_A', acceptColor: 'BLUE' }, { id: 'DOCK_B' }],
            initialSwitchDirections: ['LEFT'],
          } as any,
        ],
      };
      CURRICULUM_ACTIVITIES.push(syMultiActivity);
      try {
        const store = useAppStore.getState();
        store.setCurriculumActivity('branch.sy.multi', 1);
        let state = useAppStore.getState();
        expect(state.variantRuns).toHaveLength(2);
        expect(state.switchyardState.queue[0].color).toBe('GREEN');

        // Clicking [2 ·] while IDLE previews variant 1's Switchyard queue
        store.setFocusedVariantIndex(1);
        state = useAppStore.getState();
        expect(state.focusedVariantIndex).toBe(1);
        expect(state.switchyardState.queue[0].color).toBe('RED');

        // Focus variant 0 and run SEND_NEXT -> variant 0 passes, variant 1 collides -> auto-focuses first failing pip (1)
        store.setFocusedVariantIndex(0);
        store.setSpeed('instant');
        store.addBlock('MAIN', 'SEND_NEXT');
        state = useAppStore.getState();
        expect(state.variantRuns[0].status).toBe('SUCCESS');
        expect(state.variantRuns[1].status).toBe('COLLISION');
        expect(state.focusedVariantIndex).toBe(1);
        expect(state.switchyardState.docks[0].spec.acceptColor).toBe('BLUE');
      } finally {
        const idx = CURRICULUM_ACTIVITIES.indexOf(syMultiActivity);
        if (idx >= 0) CURRICULUM_ACTIVITIES.splice(idx, 1);
      }
    });

    it('renders STEP_LIMIT (⏳🔁) in MultiRunPipsBarView & SimulationTopLeftHud and classifies Phase 2 placeholder hints', () => {
      const pipsMarkup = renderToStaticMarkup(
        React.createElement(MultiRunPipsBarView, {
          variants: [
            { index: 0, kind: 'grid', status: 'SUCCESS' },
            { index: 1, kind: 'grid', status: 'STEP_LIMIT' },
          ],
          focusedIndex: 1,
          onSelectVariant: () => {},
        })
      );
      expect(pipsMarkup).toContain('data-variant-status="STEP_LIMIT"');
      expect(pipsMarkup).toContain('⏳🔁');

      const hudMarkup = renderToStaticMarkup(
        React.createElement(SimulationTopLeftHud, { status: 'STEP_LIMIT' })
      );
      expect(hudMarkup).toContain('data-testid="hud-step-limit-badge"');
      expect(hudMarkup).toContain('⏳🔁');

      expect(inferHintCategoryForBlockType('DEPOT_SEND_GATE')).toBe('item');
      expect(inferHintCategoryForBlockType('SWITCH_LEFT')).toBe('turn');
      expect(inferHintCategoryForBlockType('IF')).toBe('conditional');
      expect(inferHintCategoryForBlockType('WHILE')).toBe('conditional');
      expect(doesBlockMatchHintCategory('VAR_ASSIGN', undefined, 'variable')).toBe(true);
      expect(doesBlockMatchHintCategory('IF', undefined, 'sensor')).toBe(false);
      expect(doesBlockMatchHintCategory('$input', undefined, 'sensor')).toBe(true);
      expect(doesBlockMatchHintCategory('IF', undefined, 'conditional')).toBe(true);
      expect(doesBlockMatchHintCategory('DEPOT_SEND_GATE', undefined, 'item')).toBe(true);
    });

    it('renders user-approved Phase 2 icons (zero 🔒, zero 🎒) and keeps SolutionModal adult-math-gate intact', () => {
      const badgeSensors: ConditionExpr[] = [
        { kind: 'sensor', sensor: 'itemHere' },
        { kind: 'sensor', sensor: 'unvisitedAhead' },
        { kind: 'sensor', sensor: 'insideCanvas' },
        { kind: 'sensor', sensor: 'cursorAtEdge' },
        { kind: 'sensor', sensor: 'hasNextItem' },
        { kind: 'sensor', sensor: 'itemDamaged' },
        { kind: 'sensor', sensor: 'itemColor', param: 'blue' },
        { kind: 'sensor', sensor: 'itemIcon', param: 'gear' },
        { kind: 'sensor', sensor: 'hasItem' },
        { kind: 'sensor', sensor: 'heldColor', param: 'yellow' },
        { kind: 'sensor', sensor: 'topColor', param: 'green' },
        { kind: 'cmp', op: '=', left: '$input', right: 2 },
        { kind: 'cmp', op: '!=', left: '$input', right: 'color:red' },
      ];
      const allBadgeHtml = badgeSensors
        .map((c) => renderToStaticMarkup(React.createElement(ConditionBadge, { condition: c })))
        .join('\n');

      expect(allBadgeHtml).not.toContain('🔒');
      expect(allBadgeHtml).not.toContain('🎒');
      // itemHere no longer uses 💎, hasItem no longer uses 📦, heldColor no longer uses ✊, topColor no longer uses 🔝
      expect(allBadgeHtml).not.toContain('title="Item Here">💎');
      expect(allBadgeHtml).not.toContain('title="Has Item">📦');
      expect(allBadgeHtml).not.toContain('✊');
      expect(allBadgeHtml).not.toContain('🔝');
      expect(allBadgeHtml).toContain('data-sensor="itemHere"');
      expect(allBadgeHtml).toContain('data-sensor="unvisitedAhead"');
      expect(allBadgeHtml).toContain('data-sensor="insideCanvas"');
      expect(allBadgeHtml).toContain('data-sensor="cursorAtEdge"');
      expect(allBadgeHtml).toContain('data-sensor="hasNextItem"');
      expect(allBadgeHtml).toContain('data-sensor="itemDamaged"');
      expect(allBadgeHtml).toContain('⚡');
      expect(allBadgeHtml).toContain('data-sensor="itemColor"');
      expect(allBadgeHtml).toContain('data-sensor="itemIcon"');
      expect(allBadgeHtml).toContain('data-sensor="hasItem"');
      expect(allBadgeHtml).toContain('data-sensor="heldColor"');
      expect(allBadgeHtml).toContain('data-sensor="topColor"');
      expect(allBadgeHtml).toContain('🎛️');

      // VisualParamBadges: Switchyard [A]/[B] junction chip & DepotGateVisual without SCRAP
      const junctionA = renderToStaticMarkup(
        React.createElement(ParamVisual, {
          paramDef: {
            id: 'junction',
            label: 'Junction',
            type: 'turnDir',
            defaultValue: 'A',
            options: [{ value: 'A' }, { value: 'B' }],
          },
          value: 'B',
          actionType: 'SWITCH_LEFT',
        })
      );
      expect(junctionA).toContain('data-testid="switchyard-junction-visual"');
      expect(junctionA).toContain('[B]');
      expect(
        renderToStaticMarkup(React.createElement(SwitchyardJunctionVisual, { junction: 'A' }))
      ).toContain('[A]');

      const gateScrapFallback = renderToStaticMarkup(
        React.createElement(DepotGateVisual, { gate: 'SCRAP' })
      );
      expect(gateScrapFallback).not.toContain('SCRAP');
      expect(gateScrapFallback).toContain('OUT');
      expect(
        renderToStaticMarkup(React.createElement(DepotGateVisual, { gate: 'ACCEPT' }))
      ).toContain('ACCEPT');

      // SolutionModal: SCRAP_ITEM trapdoor+♻️, ConditionBadge on IF/WHILE clues, and adult-math-gate intact
      const solActivity: CurriculumActivity = {
        id: 'branch.sol.test',
        version: 1,
        moduleId: 'branch',
        format: 'puzzle',
        simId: 'switchyard',
        icon: '🚂',
        title: 'Solution Check',
        concept: 'branch',
        palette: { allowedSimBlocks: ['SCRAP_ITEM', 'SEND_NEXT'], allowedControlBlocks: ['IF'] },
        referenceSolution: {
          MAIN: [
            {
              id: 's_if',
              type: 'IF',
              params: { condition: { kind: 'sensor', sensor: 'itemDamaged' } },
            },
            { id: 's_scrap', type: 'SCRAP_ITEM' },
            { id: 's_end', type: 'END_IF' },
          ],
          F1: [],
          F2: [],
          F3: [],
        },
        switchyard: {
          initialQueue: [{ color: 'RED', icon: 'CRATE', damaged: true }],
          initialDockSpecs: [{ id: 'DOCK_A' }, { id: 'DOCK_B' }],
          initialSwitchDirections: ['LEFT'],
        } as any,
      };

      useAppStore.setState({ appMode: 'curriculum', isSolutionOpen: true });
      const gatedModalHtml = renderToStaticMarkup(
        React.createElement(SolutionModal, {
          activityOverride: solActivity,
          defaultTier2Revealed: true,
        })
      );
      expect(gatedModalHtml).toContain('data-testid="adult-math-gate"');

      const unlockedModalHtml = renderToStaticMarkup(
        React.createElement(SolutionModal, {
          activityOverride: solActivity,
          defaultTier2Revealed: true,
          defaultAdultUnlocked: true,
        })
      );
      expect(unlockedModalHtml).toContain('data-testid="solution-scrap-item-icon"');
      expect(unlockedModalHtml).toContain('♻️');
      expect(unlockedModalHtml).toContain('data-testid="condition-badge"');
      expect(unlockedModalHtml).toContain('data-sensor="itemDamaged"');
    });
  });
});
