import type { CodeBlock, WorkspaceState } from '../../types';
import { createInitialDepotState } from '../../simulations/depot/depotPhysics';
import type { CrateColor, DepotStacks, DepotState } from '../../simulations/depot/types';
import {
  CurriculumActivity,
  CurriculumGridDefinition,
  ExplanationDemoTab,
  PaletteConfig,
  createCurriculumBlock,
} from './types';

function block(
  type: string,
  repeatCount?: number,
  params?: Record<string, unknown>,
  idPrefix = 'func'
): CodeBlock {
  return createCurriculumBlock(type, repeatCount, params, idPrefix);
}

interface BlockSpec {
  type: string;
  repeatCount?: number;
  params?: Record<string, unknown>;
}

interface MultiScopeSpecs {
  MAIN: BlockSpec[];
  F1?: BlockSpec[];
  F2?: BlockSpec[];
  F3?: BlockSpec[];
}

function makeWorkspace(
  specs: MultiScopeSpecs,
  idPrefix: string
): WorkspaceState {
  const mapScope = (items: BlockSpec[] | undefined, scopeTag: string): CodeBlock[] =>
    (items ?? []).map((item, index) =>
      block(
        item.type,
        item.repeatCount,
        item.params ? { ...item.params } : undefined,
        `${idPrefix}_${scopeTag}_${index + 1}`
      )
    );

  return {
    MAIN: mapScope(specs.MAIN, 'm'),
    F1: mapScope(specs.F1, 'f1'),
    F2: mapScope(specs.F2, 'f2'),
    F3: mapScope(specs.F3, 'f3'),
  };
}

function makeDepot(
  stacks: DepotStacks,
  activeStationsMask: number,
  overrides?: {
    targetStacks?: DepotStacks;
    targetOutput?: CrateColor[];
  }
): DepotState {
  // activeStationsMask is added on DepotState in Phase 1 env-depot
  return Object.assign(
    createInitialDepotState({
      stacks,
      initialStacks: stacks,
      workerStation: 'STACK_1',
      initialWorkerStation: 'STACK_1',
      targetStacks: overrides?.targetStacks,
      targetOutput: overrides?.targetOutput,
    }),
    { activeStationsMask }
  );
}

const TURTLE_COLORS: Record<string, string> = {
  black: '#0f172a',
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#10b981',
  amber: '#f59e0b',
  purple: '#8b5cf6',
  pink: '#ec4899',
  cyan: '#06b6d4',
  orange: '#f97316',
  white: '#ffffff',
};

const BEAT_COLORS: Record<string, string> = {
  black: '#0f172a',
  red: '#f43f5e',
  blue: '#3b82f6',
  green: '#10b981',
  amber: '#fbbf24',
  purple: '#a855f7',
  pink: '#ec4899',
  cyan: '#06b6d4',
  orange: '#f97316',
  white: '#ffffff',
};

const BEAT_PRESET_NAMES = [
  'HEART',
  'STAR',
  'SMILE',
  'NOTE',
  'BOLT',
  'DIAMOND',
  'CHECK',
  'ROBOT',
] as const;

function beatPreset(index: number): string {
  return BEAT_PRESET_NAMES[index] ?? 'HEART';
}

export const FUNC_TURTLE_ALLOWED_BLOCKS: string[] = [
  'FORWARD',
  'BACKWARD',
  'TURN_LEFT',
  'TURN_RIGHT',
  'ARC_LEFT',
  'ARC_RIGHT',
  'PEN_UP',
  'PEN_DOWN',
  'SET_PEN_COLOR',
  'SET_PEN_WIDTH',
];

export const FUNC_CAPSTONE_TURTLE_ALLOWED_BLOCKS: string[] = [
  ...FUNC_TURTLE_ALLOWED_BLOCKS,
  'HIDE_TURTLE',
  'SHOW_TURTLE',
];

export const FUNC_BEAT_ALLOWED_BLOCKS: string[] = [
  'PLAY_NOTE',
  'DRUM_KICK',
  'DRUM_SNARE',
  'DRUM_CLAP',
  'PLAY_CHIME',
  'STAMP_PRESET',
  'SET_LED_COLOR',
  'SET_BEAT_DELAY',
  'LIGHT_ROW',
  'LIGHT_COL',
  'LIGHT_PIXEL',
  'WAIT_BEAT',
  'CLEAR_LEDS',
];

const FUNC_TURTLE_PARAMS: Record<string, string[]> = {
  FORWARD: ['length'],
  BACKWARD: ['length'],
  TURN_LEFT: ['angle'],
  TURN_RIGHT: ['angle'],
  ARC_LEFT: ['radius', 'angle'],
  ARC_RIGHT: ['radius', 'angle'],
  SET_PEN_COLOR: ['color'],
  SET_PEN_WIDTH: ['width'],
};

const FUNC_BEAT_PARAMS: Record<string, string[]> = {
  PLAY_NOTE: ['pitch', 'duration'],
  STAMP_PRESET: ['preset'],
  SET_LED_COLOR: ['color'],
  SET_BEAT_DELAY: ['delay'],
  LIGHT_ROW: ['y'],
  LIGHT_COL: ['x'],
  LIGHT_PIXEL: ['x', 'y'],
  WAIT_BEAT: ['duration'],
};

// ---------------------------------------------------------------------------
// Palettes (allowRecursion: false strictly enforced on ALL 11 activities)
// ---------------------------------------------------------------------------

const FUNC_0_PALETTE: PaletteConfig = {
  allowedSimBlocks: ['MOVE_FWD', 'TURN_LEFT', 'TURN_RIGHT'],
  allowedControlBlocks: ['CALL_F1'],
  allowedScopes: ['MAIN', 'F1'],
  allowRepeatBadges: false,
  allowActionParams: false,
  allowedBlockParams: {},
  allowVariables: false,
  allowRecursion: false,
};

const FUNC_1_PALETTE: PaletteConfig = {
  allowedSimBlocks: ['MOVE_FWD', 'TURN_LEFT', 'TURN_RIGHT'],
  allowedControlBlocks: ['CALL_F1'],
  allowedScopes: ['MAIN', 'F1'],
  allowRepeatBadges: false,
  allowActionParams: false,
  allowedBlockParams: {},
  allowVariables: false,
  allowRecursion: false,
};

const FUNC_2_PALETTE: PaletteConfig = {
  allowedSimBlocks: [...FUNC_TURTLE_ALLOWED_BLOCKS],
  allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'CALL_F1'],
  allowedScopes: ['MAIN', 'F1'],
  allowRepeatBadges: false,
  allowActionParams: true,
  allowedBlockParams: FUNC_TURTLE_PARAMS,
  allowVariables: false,
  allowRecursion: false,
};

const FUNC_3_PALETTE: PaletteConfig = {
  allowedSimBlocks: [...FUNC_BEAT_ALLOWED_BLOCKS],
  allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'CALL_F1', 'CALL_F2'],
  allowedScopes: ['MAIN', 'F1', 'F2'],
  allowRepeatBadges: false,
  allowActionParams: true,
  allowedBlockParams: FUNC_BEAT_PARAMS,
  allowVariables: false,
  allowRecursion: false,
};

const FUNC_4_PALETTE: PaletteConfig = {
  allowedSimBlocks: ['MOVE_FWD', 'TURN_LEFT', 'TURN_RIGHT'],
  allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'CALL_F1'],
  allowedScopes: ['MAIN', 'F1'],
  allowRepeatBadges: true,
  allowActionParams: false,
  allowedBlockParams: {},
  allowVariables: false,
  allowRecursion: false,
};

const FUNC_5_PALETTE: PaletteConfig = {
  allowedSimBlocks: [
    'MOVE_FWD',
    'MOVE_BACK',
    'TURN_LEFT',
    'TURN_RIGHT',
    'PICK_UP',
    'USE_DROP',
  ],
  allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'CALL_F1', 'CALL_F2'],
  allowedScopes: ['MAIN', 'F1', 'F2'],
  allowRepeatBadges: true,
  allowActionParams: false,
  allowedBlockParams: {},
  allowVariables: false,
  allowRecursion: false,
};

const FUNC_6_PALETTE: PaletteConfig = {
  allowedSimBlocks: ['DEPOT_MOVE_TO', 'DEPOT_GRAB', 'DEPOT_PLACE'],
  allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'CALL_F1', 'CALL_F2'],
  allowedScopes: ['MAIN', 'F1', 'F2'],
  allowRepeatBadges: true,
  allowActionParams: true,
  allowedBlockParams: {
    DEPOT_MOVE_TO: ['station'],
  },
  allowVariables: false,
  allowRecursion: false,
};

const FUNC_7_PALETTE: PaletteConfig = {
  allowedSimBlocks: ['MOVE_FWD', 'MOVE_BACK', 'TURN_LEFT', 'TURN_RIGHT'],
  allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'CALL_F1'],
  allowedScopes: ['MAIN', 'F1'],
  allowRepeatBadges: true,
  allowActionParams: false,
  allowedBlockParams: {},
  allowVariables: false,
  allowRecursion: false,
};

const FUNC_A_PALETTE: PaletteConfig = {
  allowedSimBlocks: [
    'MOVE_FWD',
    'MOVE_BACK',
    'TURN_LEFT',
    'TURN_RIGHT',
    'PICK_UP',
    'USE_DROP',
  ],
  allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'CALL_F1', 'CALL_F2'],
  allowedScopes: ['MAIN', 'F1', 'F2'],
  allowRepeatBadges: true,
  allowActionParams: false,
  allowedBlockParams: {},
  allowVariables: false,
  allowRecursion: false,
};

const FUNC_B_PALETTE: PaletteConfig = {
  allowedSimBlocks: [...FUNC_CAPSTONE_TURTLE_ALLOWED_BLOCKS],
  allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'CALL_F1', 'CALL_F2', 'CALL_F3'],
  allowedScopes: ['MAIN', 'F1', 'F2', 'F3'],
  allowRepeatBadges: false,
  allowActionParams: true,
  allowedBlockParams: FUNC_TURTLE_PARAMS,
  allowVariables: false,
  allowRecursion: false,
};

const FUNC_C_PALETTE: PaletteConfig = {
  allowedSimBlocks: [...FUNC_BEAT_ALLOWED_BLOCKS],
  allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'CALL_F1', 'CALL_F2', 'CALL_F3'],
  allowedScopes: ['MAIN', 'F1', 'F2', 'F3'],
  allowRepeatBadges: false,
  allowActionParams: true,
  allowedBlockParams: FUNC_BEAT_PARAMS,
  allowVariables: false,
  allowRecursion: false,
};

// ---------------------------------------------------------------------------
// Grids, Demo Tabs & Depots
// ---------------------------------------------------------------------------

export const FUNC_0_GRID_TAB1: CurriculumGridDefinition = {
  width: 5,
  height: 4,
  robot: { x: 1, y: 2, dir: 'EAST' },
  barriers: [
    { x: 3, y: 2, orientation: 'H' },
    { x: 3, y: 2, orientation: 'V' },
  ],
  flags: [{ id: 'G_func0_t1', x: 3, y: 1, isGoal: true, order: 0, collected: false }],
  strictInteractionCollision: true,
  requireAllItemsCollected: false,
  requireEmptyBackpackAtGoal: false,
};

export const FUNC_0_GRID_TAB2: CurriculumGridDefinition = {
  width: 6,
  height: 4,
  robot: { x: 0, y: 2, dir: 'EAST' },
  barriers: [
    { x: 0, y: 2, orientation: 'H' },
    { x: 2, y: 2, orientation: 'V' },
    { x: 2, y: 2, orientation: 'H' },
    { x: 4, y: 1, orientation: 'V' },
  ],
  flags: [{ id: 'G_func0_t2', x: 4, y: 0, isGoal: true, order: 0, collected: false }],
  strictInteractionCollision: true,
  requireAllItemsCollected: false,
  requireEmptyBackpackAtGoal: false,
};

export const FUNC_0_DEMO_TABS: ExplanationDemoTab[] = [
  {
    id: 'func.0-tab-1',
    label: '1',
    icon: '🪜',
    title: 'One Staircase Jump',
    simId: 'grid',
    gridState: FUNC_0_GRID_TAB1,
    workspace: makeWorkspace(
      {
        MAIN: [{ type: 'MOVE_FWD' }, { type: 'CALL_F1' }, { type: 'MOVE_FWD' }],
        F1: [{ type: 'TURN_LEFT' }, { type: 'MOVE_FWD' }, { type: 'TURN_RIGHT' }],
      },
      'func0_t1'
    ),
    spotlights: ['execution-order', 'call-stack-jump'],
  },
  {
    id: 'func.0-tab-2',
    label: '2',
    icon: '🔁',
    title: 'Double Staircase Reuse',
    simId: 'grid',
    gridState: FUNC_0_GRID_TAB2,
    workspace: makeWorkspace(
      {
        MAIN: [
          { type: 'CALL_F1' },
          { type: 'MOVE_FWD' },
          { type: 'CALL_F1' },
          { type: 'MOVE_FWD' },
        ],
        F1: [
          { type: 'MOVE_FWD' },
          { type: 'TURN_LEFT' },
          { type: 'MOVE_FWD' },
          { type: 'TURN_RIGHT' },
        ],
      },
      'func0_t2'
    ),
    spotlights: ['execution-order', 'call-stack-jump'],
  },
];

export const FUNC_1_GRID: CurriculumGridDefinition = {
  width: 6,
  height: 5,
  robot: { x: 0, y: 3, dir: 'EAST' },
  barriers: [
    { x: 1, y: 3, orientation: 'V' },
    { x: 1, y: 3, orientation: 'H' },
    { x: 0, y: 2, orientation: 'H' },
    { x: 2, y: 2, orientation: 'V' },
    { x: 1, y: 1, orientation: 'H' },
    { x: 2, y: 2, orientation: 'H' },
    { x: 4, y: 1, orientation: 'V' },
    { x: 3, y: 2, orientation: 'H' },
  ],
  flags: [{ id: 'G_func1', x: 3, y: 0, isGoal: true, order: 1, collected: false }],
  strictInteractionCollision: true,
  requireAllItemsCollected: false,
  requireEmptyBackpackAtGoal: false,
};

export const FUNC_4_GRID: CurriculumGridDefinition = {
  width: 6,
  height: 6,
  robot: { x: 1, y: 3, dir: 'EAST' },
  barriers: [
    { x: 1, y: 3, orientation: 'V' },
    { x: 2, y: 3, orientation: 'V' },
    { x: 1, y: 4, orientation: 'H' },
    { x: 2, y: 3, orientation: 'H' },
    { x: 3, y: 3, orientation: 'V' },
    { x: 3, y: 2, orientation: 'H' },
    { x: 4, y: 2, orientation: 'V' },
    { x: 4, y: 3, orientation: 'H' },
    { x: 4, y: 3, orientation: 'V' },
    { x: 5, y: 3, orientation: 'V' },
    { x: 4, y: 4, orientation: 'H' },
    { x: 3, y: 4, orientation: 'H' },
    { x: 4, y: 4, orientation: 'V' },
    { x: 3, y: 4, orientation: 'V' },
    { x: 3, y: 5, orientation: 'H' },
  ],
  flags: [
    { id: 'F1_func4', x: 2, y: 2, isGoal: false, order: 1, collected: false },
    { id: 'F2_func4', x: 3, y: 1, isGoal: false, order: 2, collected: false },
    { id: 'F3_func4', x: 4, y: 2, isGoal: false, order: 3, collected: false },
    { id: 'F4_func4', x: 5, y: 3, isGoal: false, order: 4, collected: false },
    { id: 'F5_func4', x: 4, y: 4, isGoal: false, order: 5, collected: false },
    { id: 'G_func4', x: 3, y: 5, isGoal: true, order: 6, collected: false },
  ],
  strictInteractionCollision: true,
  requireAllItemsCollected: true,
  requireEmptyBackpackAtGoal: false,
};

export const FUNC_5_GRID: CurriculumGridDefinition = {
  width: 7,
  height: 3,
  robot: { x: 0, y: 2, dir: 'EAST' },
  worldItems: [
    { id: 'key_func5_1', type: 'key', x: 0, y: 2, color: 'amber', shape: 'circle' },
    { id: 'key_func5_2', type: 'key', x: 2, y: 2, color: 'emerald', shape: 'triangle' },
    { id: 'key_func5_3', type: 'key', x: 4, y: 2, color: 'purple', shape: 'diamond' },
  ],
  lockedGates: [
    { id: 'gate_func5_1', x: 0, y: 1, color: 'amber', shape: 'circle', unlocked: false },
    { id: 'gate_func5_2', x: 2, y: 1, color: 'emerald', shape: 'triangle', unlocked: false },
    { id: 'gate_func5_3', x: 4, y: 1, color: 'purple', shape: 'diamond', unlocked: false },
  ],
  barriers: [
    { x: 1, y: 0, orientation: 'V' },
    { x: 1, y: 1, orientation: 'V' },
    { x: 2, y: 0, orientation: 'V' },
    { x: 2, y: 1, orientation: 'V' },
    { x: 3, y: 0, orientation: 'V' },
    { x: 3, y: 1, orientation: 'V' },
    { x: 4, y: 0, orientation: 'V' },
    { x: 4, y: 1, orientation: 'V' },
    { x: 5, y: 0, orientation: 'V' },
    { x: 5, y: 1, orientation: 'V' },
    { x: 1, y: 2, orientation: 'H' },
    { x: 3, y: 2, orientation: 'H' },
    { x: 5, y: 2, orientation: 'H' },
    { x: 6, y: 2, orientation: 'H' },
  ],
  flags: [
    { id: 'F1_func5', x: 0, y: 0, isGoal: false, order: 1, collected: false },
    { id: 'F2_func5', x: 2, y: 0, isGoal: false, order: 2, collected: false },
    { id: 'F3_func5', x: 4, y: 0, isGoal: false, order: 3, collected: false },
    { id: 'G_func5', x: 6, y: 2, isGoal: true, order: 4, collected: false },
  ],
  strictInteractionCollision: true,
  requireAllItemsCollected: true,
  requireEmptyBackpackAtGoal: true,
};

export const FUNC_6_DEPOT: DepotState = makeDepot(
  [['AMBER', 'GREEN', 'BLUE', 'RED'], [], []],
  0x07,
  {
    targetStacks: [[], [], ['AMBER', 'GREEN', 'BLUE', 'RED']],
  }
);

export const FUNC_7_GRID: CurriculumGridDefinition = {
  width: 7,
  height: 2,
  robot: { x: 0, y: 1, dir: 'EAST' },
  barriers: [
    { x: 1, y: 0, orientation: 'V' },
    { x: 2, y: 0, orientation: 'V' },
    { x: 3, y: 0, orientation: 'V' },
    { x: 4, y: 0, orientation: 'V' },
    { x: 5, y: 0, orientation: 'V' },
    { x: 6, y: 0, orientation: 'V' },
    { x: 0, y: 1, orientation: 'H' },
    { x: 1, y: 1, orientation: 'H' },
    { x: 3, y: 1, orientation: 'H' },
    { x: 5, y: 1, orientation: 'H' },
  ],
  flags: [
    { id: 'F1_func7', x: 2, y: 0, isGoal: false, order: 1, collected: false },
    { id: 'F2_func7', x: 4, y: 0, isGoal: false, order: 2, collected: false },
    { id: 'F3_func7', x: 6, y: 0, isGoal: false, order: 3, collected: false },
    { id: 'G_func7', x: 6, y: 1, isGoal: true, order: 4, collected: false },
  ],
  strictInteractionCollision: true,
  requireAllItemsCollected: true,
  requireEmptyBackpackAtGoal: false,
};

export const FUNC_A_GRID: CurriculumGridDefinition = {
  width: 6,
  height: 6,
  robot: { x: 2, y: 2, dir: 'NORTH' },
  worldItems: [
    { id: 'key_funcA_1', type: 'key', x: 2, y: 1, color: 'amber', shape: 'circle' },
    { id: 'key_funcA_2', type: 'key', x: 3, y: 2, color: 'emerald', shape: 'triangle' },
    { id: 'key_funcA_3', type: 'key', x: 2, y: 3, color: 'purple', shape: 'diamond' },
  ],
  lockedGates: [
    { id: 'gate_funcA_1', x: 2, y: 0, color: 'amber', shape: 'circle', unlocked: false },
    { id: 'gate_funcA_2', x: 4, y: 2, color: 'emerald', shape: 'triangle', unlocked: false },
    { id: 'gate_funcA_3', x: 2, y: 4, color: 'purple', shape: 'diamond', unlocked: false },
  ],
  barriers: [
    { x: 2, y: 0, orientation: 'V' },
    { x: 2, y: 1, orientation: 'V' },
    { x: 3, y: 0, orientation: 'V' },
    { x: 3, y: 1, orientation: 'V' },
    { x: 3, y: 2, orientation: 'H' },
    { x: 4, y: 2, orientation: 'H' },
    { x: 3, y: 3, orientation: 'H' },
    { x: 4, y: 3, orientation: 'H' },
    { x: 5, y: 2, orientation: 'V' },
    { x: 2, y: 3, orientation: 'V' },
    { x: 2, y: 4, orientation: 'V' },
    { x: 3, y: 3, orientation: 'V' },
    { x: 3, y: 4, orientation: 'V' },
    { x: 2, y: 5, orientation: 'H' },
    { x: 0, y: 2, orientation: 'H' },
    { x: 1, y: 2, orientation: 'H' },
    { x: 0, y: 3, orientation: 'H' },
    { x: 1, y: 3, orientation: 'H' },
  ],
  flags: [
    { id: 'F1_funcA', x: 2, y: 0, isGoal: false, order: 1, collected: false },
    { id: 'F2_funcA', x: 4, y: 2, isGoal: false, order: 2, collected: false },
    { id: 'F3_funcA', x: 2, y: 4, isGoal: false, order: 3, collected: false },
    { id: 'G_funcA', x: 0, y: 2, isGoal: true, order: 4, collected: false },
  ],
  strictInteractionCollision: true,
  requireAllItemsCollected: true,
  requireEmptyBackpackAtGoal: true,
};

// ---------------------------------------------------------------------------
// Module Activities: `func` (11 Activities)
// ---------------------------------------------------------------------------

export const FUNC_ACTIVITIES: CurriculumActivity[] = [
  // =========================================================================
  // func.0 — Jumping to F1 & Returning (Robot Grid Explanation Demo)
  // =========================================================================
  {
    id: 'func.0',
    moduleId: 'func',
    version: 1,
    format: 'explanation',
    simId: 'grid',
    icon: '📞',
    title: 'Jumping to F1 and Returning',
    concept: 'Subroutine Call & Clean Return to Next Card',
    description:
      'Watch the execution pointer pause Main on CALL F1, jump into F1 while tabs follow automatically, and return right after CALL F1.',
    hint: 'Calling F1 runs every block inside F1 and hops straight back to the next card in Main!',
    palette: FUNC_0_PALETTE,
    demoTabs: FUNC_0_DEMO_TABS,
  },

  // =========================================================================
  // func.1 — Defining & Calling Helper F1 (Robot Grid Puzzle)
  // =========================================================================
  {
    id: 'func.1',
    moduleId: 'func',
    version: 1,
    format: 'puzzle',
    simId: 'grid',
    icon: '🪜',
    title: 'Defining & Calling Helper F1',
    concept: 'Creating & Calling a Reusable Helper Function',
    description:
      'Build a 3-block step-up helper in F1 (Turn Left, Move Forward, Turn Right) and fill the three ? slots in Main with CALL F1.',
    hint: 'Open F1 to define Turn Left -> Forward -> Turn Right, then drop CALL F1 into every ? slot on Main.',
    palette: FUNC_1_PALETTE,
    slotCap: {
      perScope: { MAIN: 6, F1: 4 },
      maxTotal: 10,
    },
    grid: FUNC_1_GRID,
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          { type: 'PLACEHOLDER', params: { hintCategory: 'function' } },
          { type: 'MOVE_FWD' },
          { type: 'PLACEHOLDER', params: { hintCategory: 'function' } },
          { type: 'MOVE_FWD' },
          { type: 'MOVE_FWD' },
          { type: 'PLACEHOLDER', params: { hintCategory: 'function' } },
        ],
        F1: [],
      },
      'start_func1'
    ),
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeWorkspace(
        {
          MAIN: [
            { type: 'CALL_F1' },
            { type: 'MOVE_FWD' },
            { type: 'PLACEHOLDER', params: { hintCategory: 'function' } },
            { type: 'MOVE_FWD' },
            { type: 'MOVE_FWD' },
            { type: 'PLACEHOLDER', params: { hintCategory: 'function' } },
          ],
          F1: [
            { type: 'TURN_LEFT' },
            { type: 'PLACEHOLDER', params: { hintCategory: 'motion' } },
            { type: 'TURN_RIGHT' },
          ],
        },
        'scaf_func1'
      ),
    },
    referenceSolution: makeWorkspace(
      {
        MAIN: [
          { type: 'CALL_F1' },
          { type: 'MOVE_FWD' },
          { type: 'CALL_F1' },
          { type: 'MOVE_FWD' },
          { type: 'MOVE_FWD' },
          { type: 'CALL_F1' },
        ],
        F1: [
          { type: 'TURN_LEFT' },
          { type: 'MOVE_FWD' },
          { type: 'TURN_RIGHT' },
        ],
      },
      'ref_func1'
    ),
    antiBypassRules: [
      {
        id: 'func.1-starter-must-fail',
        description: 'Untouched starter collides on V(1,3) and requires edits',
        unmodifiedStarterMustFail: true,
        minStarterEditDistance: 1,
      },
      {
        id: 'func.1-require-call-f1',
        description: 'Cannot climb 3 stairs + 3 East steps inside MAIN: 6 without CALL_F1',
        forbidBlocks: ['CALL_F1'],
      },
    ],
  },

  // =========================================================================
  // func.2 — Shape Stamps & State Hygiene (Turtle LOGO Sandbox)
  // =========================================================================
  {
    id: 'func.2',
    moduleId: 'func',
    version: 1,
    format: 'sandbox',
    simId: 'turtle',
    icon: '🌟',
    title: 'Shape Stamps & State Hygiene',
    concept: 'Reusable Shape Helper Restoring Pen & Heading State',
    description:
      'Build a reusable shape stamp in F1 (stars, pine trees, petals, windows, Big Dipper) that lifts the pen and restores heading/color on return.',
    hint: 'Lift Pen Up and turn back to your starting heading at the end of F1 so Main draws crisp shapes everywhere!',
    palette: FUNC_2_PALETTE,
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          { type: 'SET_PEN_WIDTH', params: { width: 4 } },
          { type: 'PEN_UP' },
          { type: 'LOOP_START', repeatCount: 4 },
          { type: 'FORWARD', params: { length: 150 } },
          { type: 'CALL_F1' },
          { type: 'TURN_RIGHT', params: { angle: 90 } },
          { type: 'LOOP_END' },
        ],
        F1: [
          { type: 'TURN_RIGHT', params: { angle: 18 } },
          { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.amber } },
          { type: 'PEN_DOWN' },
          { type: 'LOOP_START', repeatCount: 5 },
          { type: 'FORWARD', params: { length: 75 } },
          { type: 'TURN_RIGHT', params: { angle: 144 } },
          { type: 'LOOP_END' },
          { type: 'PEN_UP' },
          { type: 'TURN_LEFT', params: { angle: 18 } },
        ],
      },
      'start_func2'
    ),
    variations: [
      {
        id: 'func.2-var1-forest',
        title: 'Pine Forest',
        icon: '🌲',
        workspace: makeWorkspace(
          {
            MAIN: [
              { type: 'PEN_UP' },
              { type: 'TURN_LEFT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 150 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'LOOP_START', repeatCount: 3 },
              { type: 'CALL_F1' },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 150 } },
              { type: 'TURN_LEFT', params: { angle: 90 } },
              { type: 'LOOP_END' },
            ],
            F1: [
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.orange } },
              { type: 'PEN_DOWN' },
              { type: 'FORWARD', params: { length: 50 } },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.green } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'BACKWARD', params: { length: 50 } },
              { type: 'LOOP_START', repeatCount: 3 },
              { type: 'FORWARD', params: { length: 100 } },
              { type: 'TURN_LEFT', params: { angle: 120 } },
              { type: 'LOOP_END' },
              { type: 'FORWARD', params: { length: 50 } },
              { type: 'TURN_LEFT', params: { angle: 90 } },
              { type: 'PEN_UP' },
              { type: 'BACKWARD', params: { length: 50 } },
            ],
          },
          'v1_func2'
        ),
      },
      {
        id: 'func.2-var2-petal-crown',
        title: 'Petal Crown Ring',
        icon: '🌸',
        workspace: makeWorkspace(
          {
            MAIN: [
              { type: 'SET_PEN_WIDTH', params: { width: 4 } },
              { type: 'PEN_UP' },
              { type: 'LOOP_START', repeatCount: 6 },
              { type: 'FORWARD', params: { length: 100 } },
              { type: 'CALL_F1' },
              { type: 'TURN_RIGHT', params: { angle: 60 } },
              { type: 'LOOP_END' },
            ],
            F1: [
              { type: 'TURN_RIGHT', params: { angle: 15 } },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.pink } },
              { type: 'PEN_DOWN' },
              { type: 'ARC_RIGHT', params: { radius: 50, angle: 90 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'ARC_RIGHT', params: { radius: 50, angle: 90 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'PEN_UP' },
              { type: 'TURN_LEFT', params: { angle: 15 } },
            ],
          },
          'v2_func2'
        ),
      },
      {
        id: 'func.2-var3a-cottage',
        title: 'Cozy Cottage',
        icon: '🏠',
        workspace: makeWorkspace(
          {
            MAIN: [
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.orange } },
              { type: 'LOOP_START', repeatCount: 4 },
              { type: 'FORWARD', params: { length: 200 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'LOOP_END' },
              { type: 'PEN_UP' },
              { type: 'FORWARD', params: { length: 200 } },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.red } },
              { type: 'PEN_DOWN' },
              { type: 'TURN_RIGHT', params: { angle: 30 } },
              { type: 'FORWARD', params: { length: 200 } },
              { type: 'TURN_RIGHT', params: { angle: 120 } },
              { type: 'FORWARD', params: { length: 200 } },
              { type: 'TURN_RIGHT', params: { angle: 210 } },
              { type: 'PEN_UP' },
              { type: 'BACKWARD', params: { length: 80 } },
              { type: 'TURN_LEFT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 76 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'CALL_F1' },
              { type: 'BACKWARD', params: { length: 80 } },
              { type: 'CALL_F1' },
              { type: 'TURN_LEFT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 88 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'CALL_F1' },
              { type: 'FORWARD', params: { length: 80 } },
              { type: 'CALL_F1' },
            ],
            F1: [
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.cyan } },
              { type: 'PEN_DOWN' },
              { type: 'LOOP_START', repeatCount: 4 },
              { type: 'FORWARD', params: { length: 40 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'LOOP_END' },
              { type: 'PEN_UP' },
            ],
          },
          'v3a_func2'
        ),
      },
      {
        id: 'func.2-var3b-dipper',
        title: 'Glowing Big Dipper',
        icon: '✨',
        workspace: makeWorkspace(
          {
            MAIN: [
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.cyan } },
              { type: 'CALL_F1' },
              { type: 'PEN_DOWN' },
              { type: 'TURN_RIGHT', params: { angle: 75 } },
              { type: 'FORWARD', params: { length: 110 } },
              { type: 'CALL_F1' },
              { type: 'PEN_DOWN' },
              { type: 'TURN_RIGHT', params: { angle: 15 } },
              { type: 'FORWARD', params: { length: 100 } },
              { type: 'CALL_F1' },
              { type: 'PEN_DOWN' },
              { type: 'TURN_RIGHT', params: { angle: 15 } },
              { type: 'FORWARD', params: { length: 100 } },
              { type: 'CALL_F1' },
              { type: 'PEN_DOWN' },
              { type: 'TURN_RIGHT', params: { angle: 75 } },
              { type: 'FORWARD', params: { length: 90 } },
              { type: 'CALL_F1' },
              { type: 'PEN_DOWN' },
              { type: 'TURN_LEFT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 120 } },
              { type: 'CALL_F1' },
              { type: 'PEN_DOWN' },
              { type: 'TURN_LEFT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 90 } },
              { type: 'CALL_F1' },
              { type: 'PEN_DOWN' },
              { type: 'TURN_LEFT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 120 } },
              { type: 'PEN_UP' },
            ],
            F1: [
              { type: 'TURN_RIGHT', params: { angle: 18 } },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.amber } },
              { type: 'PEN_DOWN' },
              { type: 'LOOP_START', repeatCount: 5 },
              { type: 'FORWARD', params: { length: 40 } },
              { type: 'TURN_RIGHT', params: { angle: 144 } },
              { type: 'LOOP_END' },
              { type: 'PEN_UP' },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.cyan } },
              { type: 'TURN_LEFT', params: { angle: 18 } },
            ],
          },
          'v3b_func2'
        ),
      },
    ],
  },

  // =========================================================================
  // func.3 — Chorus & Verse Composition (Beat & Light Pad Sandbox)
  // =========================================================================
  {
    id: 'func.3',
    moduleId: 'func',
    version: 1,
    format: 'sandbox',
    simId: 'beat',
    icon: '🎵',
    title: 'Chorus & Verse Composition',
    concept: 'Organizing Musical Sections in F1 & F2',
    description:
      'Separate a song and LED light performance into Verse (F1) and Chorus (F2), then arrange Main cleanly using CALL F1, CALL F2, and Loop.',
    hint: 'Place STAMP_PRESET before LIGHT_ROW/COL overlays inside 0-delay groups, then switch back to 1x delay for notes.',
    palette: FUNC_3_PALETTE,
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          { type: 'LOOP_START', repeatCount: 2 },
          { type: 'CALL_F1' },
          { type: 'CALL_F2' },
          { type: 'LOOP_END' },
        ],
        F1: [
          { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
          { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.amber } },
          { type: 'STAMP_PRESET', params: { preset: beatPreset(1) } },
          { type: 'SET_BEAT_DELAY', params: { delay: 1 } },
          { type: 'PLAY_NOTE', params: { pitch: 1, duration: 0.5 } },
          { type: 'PLAY_NOTE', params: { pitch: 3, duration: 0.5 } },
          { type: 'PLAY_NOTE', params: { pitch: 5, duration: 1 } },
        ],
        F2: [
          { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
          { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.pink } },
          { type: 'STAMP_PRESET', params: { preset: beatPreset(0) } },
          { type: 'SET_BEAT_DELAY', params: { delay: 1 } },
          { type: 'PLAY_NOTE', params: { pitch: 6, duration: 0.5 } },
          { type: 'PLAY_NOTE', params: { pitch: 8, duration: 1 } },
        ],
      },
      'start_func3'
    ),
    variations: [
      {
        id: 'func.3-var1-powerup',
        title: 'Arcade Power-Up Beat',
        icon: '🕹️',
        workspace: makeWorkspace(
          {
            MAIN: [{ type: 'CALL_F1' }, { type: 'CALL_F2' }, { type: 'CALL_F1' }],
            F1: [
              { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.cyan } },
              { type: 'STAMP_PRESET', params: { preset: beatPreset(1) } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.amber } },
              { type: 'LIGHT_ROW', params: { y: 1 } },
              { type: 'LIGHT_ROW', params: { y: 8 } },
              { type: 'SET_BEAT_DELAY', params: { delay: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 1, duration: 0.5 } },
              { type: 'PLAY_NOTE', params: { pitch: 5, duration: 0.5 } },
              { type: 'PLAY_NOTE', params: { pitch: 8, duration: 1 } },
            ],
            F2: [
              { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.purple } },
              { type: 'STAMP_PRESET', params: { preset: beatPreset(3) } },
              { type: 'SET_BEAT_DELAY', params: { delay: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 8, duration: 0.5 } },
              { type: 'PLAY_NOTE', params: { pitch: 6, duration: 0.5 } },
              { type: 'PLAY_NOTE', params: { pitch: 8, duration: 1 } },
            ],
          },
          'v1_func3'
        ),
      },
      {
        id: 'func.3-var2-pingpong',
        title: 'Stereo Ping-Pong Jam',
        icon: '🎧',
        workspace: makeWorkspace(
          {
            MAIN: [
              { type: 'LOOP_START', repeatCount: 2 },
              { type: 'CALL_F1' },
              { type: 'CALL_F2' },
              { type: 'LOOP_END' },
              { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.green } },
              { type: 'STAMP_PRESET', params: { preset: beatPreset(2) } },
              { type: 'PLAY_CHIME' },
            ],
            F1: [
              { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
              { type: 'CLEAR_LEDS' },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.cyan } },
              { type: 'LIGHT_COL', params: { x: 2 } },
              { type: 'LIGHT_COL', params: { x: 3 } },
              { type: 'SET_BEAT_DELAY', params: { delay: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 1, duration: 0.5 } },
              { type: 'PLAY_NOTE', params: { pitch: 3, duration: 0.5 } },
              { type: 'PLAY_NOTE', params: { pitch: 5, duration: 0.5 } },
              { type: 'PLAY_NOTE', params: { pitch: 8, duration: 0.5 } },
            ],
            F2: [
              { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
              { type: 'CLEAR_LEDS' },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.pink } },
              { type: 'LIGHT_COL', params: { x: 6 } },
              { type: 'LIGHT_COL', params: { x: 7 } },
              { type: 'SET_BEAT_DELAY', params: { delay: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 8, duration: 0.5 } },
              { type: 'PLAY_NOTE', params: { pitch: 6, duration: 0.5 } },
              { type: 'PLAY_NOTE', params: { pitch: 5, duration: 0.5 } },
              { type: 'PLAY_NOTE', params: { pitch: 3, duration: 0.5 } },
            ],
          },
          'v2_func3'
        ),
      },
      {
        id: 'func.3-var3-rocket',
        title: 'Rocket Countdown & Blastoff',
        icon: '🚀',
        workspace: makeWorkspace(
          {
            MAIN: [
              { type: 'CALL_F1' },
              { type: 'CALL_F2' },
              { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
              { type: 'CLEAR_LEDS' },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.amber } },
              { type: 'LIGHT_PIXEL', params: { x: 2, y: 2 } },
              { type: 'LIGHT_PIXEL', params: { x: 7, y: 3 } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.cyan } },
              { type: 'LIGHT_PIXEL', params: { x: 3, y: 6 } },
              { type: 'LIGHT_PIXEL', params: { x: 6, y: 5 } },
              { type: 'SET_BEAT_DELAY', params: { delay: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 1, duration: 0.5 } },
              { type: 'PLAY_NOTE', params: { pitch: 3, duration: 0.5 } },
              { type: 'PLAY_NOTE', params: { pitch: 5, duration: 0.5 } },
              { type: 'PLAY_NOTE', params: { pitch: 8, duration: 1 } },
              { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.amber } },
              { type: 'STAMP_PRESET', params: { preset: beatPreset(1) } },
              { type: 'PLAY_CHIME' },
            ],
            F1: [
              { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.blue } },
              { type: 'STAMP_PRESET', params: { preset: beatPreset(6) } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.red } },
              { type: 'LIGHT_ROW', params: { y: 8 } },
              { type: 'SET_BEAT_DELAY', params: { delay: 1 } },
              { type: 'DRUM_KICK' },
              { type: 'DRUM_KICK' },
              { type: 'DRUM_SNARE' },
            ],
            F2: [
              { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.cyan } },
              { type: 'STAMP_PRESET', params: { preset: beatPreset(6) } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.orange } },
              { type: 'LIGHT_ROW', params: { y: 7 } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.amber } },
              { type: 'LIGHT_ROW', params: { y: 8 } },
              { type: 'SET_BEAT_DELAY', params: { delay: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 5, duration: 0.5 } },
              { type: 'PLAY_NOTE', params: { pitch: 8, duration: 0.5 } },
            ],
          },
          'v3_func3'
        ),
      },
    ],
  },

  // =========================================================================
  // func.4 — Functions and Loops Together (Robot Grid Puzzle)
  // =========================================================================
  {
    id: 'func.4',
    moduleId: 'func',
    version: 1,
    format: 'puzzle',
    simId: 'grid',
    icon: '🌀',
    title: 'Functions and Loops Together',
    concept: 'Composing Loops Inside Helpers Called from Main Loops',
    description:
      'Put a x2 staircase loop inside F1 and call F1 inside Main x3 loop around the 3-turn spiral wings.',
    hint: 'Inside F1: Loop x2 [Turn Left, Forward, Turn Right, Forward]. Drop CALL F1 into the ? slot on Main!',
    palette: FUNC_4_PALETTE,
    slotCap: {
      perScope: { MAIN: 4, F1: 6 },
      maxTotal: 10,
    },
    grid: FUNC_4_GRID,
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          { type: 'LOOP_START', repeatCount: 3 },
          { type: 'PLACEHOLDER', params: { hintCategory: 'function' } },
          { type: 'TURN_RIGHT' },
          { type: 'LOOP_END' },
        ],
        F1: [],
      },
      'start_func4'
    ),
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeWorkspace(
        {
          MAIN: [
            { type: 'LOOP_START', repeatCount: 3 },
            { type: 'CALL_F1' },
            { type: 'TURN_RIGHT' },
            { type: 'LOOP_END' },
          ],
          F1: [
            { type: 'LOOP_START', repeatCount: 2 },
            { type: 'TURN_LEFT' },
            { type: 'PLACEHOLDER', params: { hintCategory: 'motion' } },
            { type: 'TURN_RIGHT' },
            { type: 'PLACEHOLDER', params: { hintCategory: 'motion' } },
            { type: 'LOOP_END' },
          ],
        },
        'scaf_func4'
      ),
    },
    referenceSolution: makeWorkspace(
      {
        MAIN: [
          { type: 'LOOP_START', repeatCount: 3 },
          { type: 'CALL_F1' },
          { type: 'TURN_RIGHT' },
          { type: 'LOOP_END' },
        ],
        F1: [
          { type: 'LOOP_START', repeatCount: 2 },
          { type: 'TURN_LEFT' },
          { type: 'MOVE_FWD' },
          { type: 'TURN_RIGHT' },
          { type: 'MOVE_FWD' },
          { type: 'LOOP_END' },
        ],
      },
      'ref_func4'
    ),
    antiBypassRules: [
      {
        id: 'func.4-starter-must-fail',
        description: 'Untouched starter spins in place on (1,3) and fails',
        unmodifiedStarterMustFail: true,
        minStarterEditDistance: 1,
      },
      {
        id: 'func.4-require-call-f1',
        description: 'Cannot complete 3 spiral wings inside MAIN: 4 without CALL_F1',
        forbidBlocks: ['CALL_F1'],
      },
      {
        id: 'func.4-require-loop-in-f1',
        description: 'Non-adjacent alternating F1 turns require Loop x2 inside F1: 6',
        maxLoopNestingDepthPerScope: { MAIN: 1, F1: 0 },
      },
      {
        id: 'func.4-require-loop-in-main',
        description: 'MAIN: 4 requires Loop x3 around CALL_F1 and TURN_RIGHT',
        maxLoopNestingDepthPerScope: { MAIN: 0, F1: 1 },
      },
    ],
  },

  // =========================================================================
  // func.5 — Layered Composition (Main -> F1 -> F2) (Robot Grid Puzzle)
  // =========================================================================
  {
    id: 'func.5',
    moduleId: 'func',
    version: 1,
    format: 'puzzle',
    simId: 'grid',
    icon: '🪜',
    title: 'Layered Composition (Main -> F1 -> F2)',
    concept: 'Multi-Level Helper Calls & State Hygiene',
    description:
      'Build F2 to grab the key, face North, unlock the gate, and step in; build F1 to call F2, grab the flag, back out twice, and face East again.',
    hint: 'F2: Pick Up -> Turn Left -> Use Key -> Forward. F1: CALL F2 -> Forward -> Back -> Back -> Turn Right.',
    palette: FUNC_5_PALETTE,
    slotCap: {
      perScope: { MAIN: 5, F1: 5, F2: 4 },
      maxTotal: 14,
    },
    grid: FUNC_5_GRID,
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          { type: 'LOOP_START', repeatCount: 3 },
          { type: 'PLACEHOLDER', params: { hintCategory: 'function' } },
          { type: 'MOVE_FWD' },
          { type: 'MOVE_FWD' },
          { type: 'LOOP_END' },
        ],
        F1: [],
        F2: [
          { type: 'PICK_UP' },
          { type: 'PLACEHOLDER', params: { hintCategory: 'turn' } },
          { type: 'PLACEHOLDER', params: { hintCategory: 'item' } },
          { type: 'MOVE_FWD' },
        ],
      },
      'start_func5'
    ),
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeWorkspace(
        {
          MAIN: [
            { type: 'LOOP_START', repeatCount: 3 },
            { type: 'CALL_F1' },
            { type: 'MOVE_FWD' },
            { type: 'MOVE_FWD' },
            { type: 'LOOP_END' },
          ],
          F1: [
            { type: 'CALL_F2' },
            { type: 'PLACEHOLDER', params: { hintCategory: 'motion' } },
            { type: 'MOVE_BACK' },
            { type: 'MOVE_BACK' },
            { type: 'PLACEHOLDER', params: { hintCategory: 'turn' } },
          ],
          F2: [
            { type: 'PICK_UP' },
            { type: 'TURN_LEFT' },
            { type: 'USE_DROP' },
            { type: 'MOVE_FWD' },
          ],
        },
        'scaf_func5'
      ),
    },
    referenceSolution: makeWorkspace(
      {
        MAIN: [
          { type: 'LOOP_START', repeatCount: 3 },
          { type: 'CALL_F1' },
          { type: 'MOVE_FWD' },
          { type: 'MOVE_FWD' },
          { type: 'LOOP_END' },
        ],
        F1: [
          { type: 'CALL_F2' },
          { type: 'MOVE_FWD' },
          { type: 'MOVE_BACK' },
          { type: 'MOVE_BACK' },
          { type: 'TURN_RIGHT' },
        ],
        F2: [
          { type: 'PICK_UP' },
          { type: 'TURN_LEFT' },
          { type: 'USE_DROP' },
          { type: 'MOVE_FWD' },
        ],
      },
      'ref_func5'
    ),
    antiBypassRules: [
      {
        id: 'func.5-starter-must-fail',
        description: 'Walking East directly onto shuttered Goal with 0 flags fails',
        unmodifiedStarterMustFail: true,
        minStarterEditDistance: 1,
      },
      {
        id: 'func.5-require-call-f1',
        description: 'Cannot inline chamber routine in MAIN: 5 without CALL_F1',
        forbidBlocks: ['CALL_F1'],
      },
      {
        id: 'func.5-require-call-f2',
        description: 'Cannot inline unlock routine in F1: 5 without CALL_F2',
        forbidBlocks: ['CALL_F2'],
      },
      {
        id: 'func.5-require-loop',
        description: 'Cannot clear 3 bays without LOOP_START',
        maxLoopNestingDepth: 0,
      },
    ],
  },

  // =========================================================================
  // func.6 — Double Stack Reversal (Automated Depot Puzzle)
  // =========================================================================
  {
    id: 'func.6',
    moduleId: 'func',
    version: 1,
    format: 'puzzle',
    simId: 'depot',
    icon: '🏗️',
    title: 'Double Stack Reversal',
    concept: 'Double LIFO Transfer Restores Original Order',
    description:
      'F1 already moves all 4 rings from Stack 1 to Stack 2 (reversing them). Build F2 to move Stack 2 to Stack 3 and call F2 from Main to restore order!',
    hint: 'In F2, loop x4: Move S2 -> Grab -> Move S3 -> Place. Then replace ? in Main with CALL F2.',
    palette: FUNC_6_PALETTE,
    slotCap: {
      perScope: { MAIN: 3, F1: 6, F2: 8 },
      maxTotal: 17,
    },
    depot: FUNC_6_DEPOT,
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          { type: 'CALL_F1' },
          { type: 'PLACEHOLDER', params: { hintCategory: 'function' } },
        ],
        F1: [
          { type: 'LOOP_START', repeatCount: 4 },
          { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_1' } },
          { type: 'DEPOT_GRAB' },
          { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_2' } },
          { type: 'DEPOT_PLACE' },
          { type: 'LOOP_END' },
        ],
        F2: [],
      },
      'start_func6'
    ),
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeWorkspace(
        {
          MAIN: [{ type: 'CALL_F1' }, { type: 'CALL_F2' }],
          F1: [
            { type: 'LOOP_START', repeatCount: 4 },
            { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_1' } },
            { type: 'DEPOT_GRAB' },
            { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_2' } },
            { type: 'DEPOT_PLACE' },
            { type: 'LOOP_END' },
          ],
          F2: [
            { type: 'LOOP_START', repeatCount: 4 },
            { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_2' } },
            { type: 'PLACEHOLDER', params: { hintCategory: 'item' } },
            { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_3' } },
            { type: 'PLACEHOLDER', params: { hintCategory: 'item' } },
            { type: 'LOOP_END' },
          ],
        },
        'scaf_func6'
      ),
    },
    referenceSolution: makeWorkspace(
      {
        MAIN: [{ type: 'CALL_F1' }, { type: 'CALL_F2' }],
        F1: [
          { type: 'LOOP_START', repeatCount: 4 },
          { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_1' } },
          { type: 'DEPOT_GRAB' },
          { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_2' } },
          { type: 'DEPOT_PLACE' },
          { type: 'LOOP_END' },
        ],
        F2: [
          { type: 'LOOP_START', repeatCount: 4 },
          { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_2' } },
          { type: 'DEPOT_GRAB' },
          { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_3' } },
          { type: 'DEPOT_PLACE' },
          { type: 'LOOP_END' },
        ],
      },
      'ref_func6'
    ),
    antiBypassRules: [
      {
        id: 'func.6-require-call-f2',
        description: 'Cannot solve double reversal in MAIN: 3 without calling F2',
        forbidBlocks: ['CALL_F2'],
      },
      {
        id: 'func.6-require-call-f1',
        description: 'Single F2: 8 tray cannot perform both 6-block loops without CALL_F1',
        forbidBlocks: ['CALL_F1'],
      },
      {
        id: 'func.6-require-loop',
        description: 'Moving 4 rings across 3 stacks requires loops',
        maxLoopNestingDepth: 0,
      },
    ],
  },

  // =========================================================================
  // func.7 — Fix State Hygiene Drift (Robot Grid Fix-It Puzzle)
  // =========================================================================
  {
    id: 'func.7',
    moduleId: 'func',
    version: 1,
    format: 'puzzle',
    simId: 'grid',
    icon: '🔧',
    title: 'Fix State Hygiene Drift',
    concept: 'Restoring Caller Heading Before Helper Return',
    description:
      'Helper F1 dips North into each alcove and backs out, leaving the robot facing North so Loop #2 crashes! Add one Turn Right at the end of F1.',
    hint: 'Open F1 and append Turn Right after Move Back so every helper call returns facing East.',
    palette: FUNC_7_PALETTE,
    slotCap: {
      perScope: { MAIN: 5, F1: 4 },
      maxTotal: 9,
    },
    grid: FUNC_7_GRID,
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          { type: 'LOOP_START', repeatCount: 3 },
          { type: 'MOVE_FWD' },
          { type: 'MOVE_FWD' },
          { type: 'CALL_F1' },
          { type: 'LOOP_END' },
        ],
        F1: [
          { type: 'TURN_LEFT' },
          { type: 'MOVE_FWD' },
          { type: 'MOVE_BACK' },
        ],
      },
      'start_func7'
    ),
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeWorkspace(
        {
          MAIN: [
            { type: 'LOOP_START', repeatCount: 3 },
            { type: 'MOVE_FWD' },
            { type: 'MOVE_FWD' },
            { type: 'CALL_F1' },
            { type: 'LOOP_END' },
          ],
          F1: [
            { type: 'TURN_LEFT' },
            { type: 'MOVE_FWD' },
            { type: 'MOVE_BACK' },
            { type: 'PLACEHOLDER', params: { hintCategory: 'turn' } },
          ],
        },
        'scaf_func7'
      ),
    },
    referenceSolution: makeWorkspace(
      {
        MAIN: [
          { type: 'LOOP_START', repeatCount: 3 },
          { type: 'MOVE_FWD' },
          { type: 'MOVE_FWD' },
          { type: 'CALL_F1' },
          { type: 'LOOP_END' },
        ],
        F1: [
          { type: 'TURN_LEFT' },
          { type: 'MOVE_FWD' },
          { type: 'MOVE_BACK' },
          { type: 'TURN_RIGHT' },
        ],
      },
      'ref_func7'
    ),
    antiBypassRules: [
      {
        id: 'func.7-starter-must-fail',
        description: 'Missing TURN_RIGHT in F1 crashes out of bounds North on iteration 2',
        unmodifiedStarterMustFail: true,
        minStarterEditDistance: 1,
      },
      {
        id: 'func.7-require-call-f1',
        description: 'Cannot visit all 3 alcoves within MAIN: 5 without CALL_F1',
        forbidBlocks: ['CALL_F1'],
      },
      {
        id: 'func.7-require-loop',
        description: 'Cannot reach all 3 alcoves without loops',
        maxLoopNestingDepth: 0,
      },
      {
        id: 'func.7-direct-goal-locked',
        description: 'Walking straight to (6,1) without ordered flags 1..3 fails lock',
        directToGoalMustFailLock: true,
      },
    ],
  },

  // =========================================================================
  // func.A — Modular Station Repair (Robot Grid Capstone)
  // =========================================================================
  {
    id: 'func.A',
    moduleId: 'func',
    version: 1,
    format: 'capstone',
    capstoneType: 'puzzle',
    simId: 'grid',
    icon: '🏆',
    title: 'Modular Station Repair',
    concept: 'Mastery of Main -> F1 -> F2 Layered Helper Architecture',
    description:
      'Put key pickup, gate unlock, and step onto the flag inside F2; teach F1 to enter, call F2, and back out x2; loop [CALL F1, Turn Right] x3 in Main then walk West to Goal!',
    hint: 'F2: Pick Up -> Use Key -> Forward. F1: Forward -> CALL F2 -> Back (x2). Main: Loop x3 [CALL F1, Turn Right], Forward (x2).',
    palette: FUNC_A_PALETTE,
    slotCap: {
      perScope: { MAIN: 5, F1: 4, F2: 4 },
      maxTotal: 13,
    },
    grid: FUNC_A_GRID,
    starterWorkspace: makeWorkspace(
      {
        MAIN: [],
        F1: [],
        F2: [],
      },
      'start_funcA'
    ),
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeWorkspace(
        {
          MAIN: [
            { type: 'LOOP_START', repeatCount: 3 },
            { type: 'CALL_F1' },
            { type: 'TURN_RIGHT' },
            { type: 'LOOP_END' },
            { type: 'MOVE_FWD', repeatCount: 2 },
          ],
          F1: [
            { type: 'MOVE_FWD' },
            { type: 'PLACEHOLDER', params: { hintCategory: 'function' } },
            { type: 'MOVE_BACK', repeatCount: 2 },
          ],
          F2: [
            { type: 'PICK_UP' },
            { type: 'USE_DROP' },
            { type: 'PLACEHOLDER', params: { hintCategory: 'motion' } },
          ],
        },
        'scaf_funcA'
      ),
    },
    referenceSolution: makeWorkspace(
      {
        MAIN: [
          { type: 'LOOP_START', repeatCount: 3 },
          { type: 'CALL_F1' },
          { type: 'TURN_RIGHT' },
          { type: 'LOOP_END' },
          { type: 'MOVE_FWD', repeatCount: 2 },
        ],
        F1: [
          { type: 'MOVE_FWD' },
          { type: 'CALL_F2' },
          { type: 'MOVE_BACK', repeatCount: 2 },
        ],
        F2: [
          { type: 'PICK_UP' },
          { type: 'USE_DROP' },
          { type: 'MOVE_FWD' },
        ],
      },
      'ref_funcA'
    ),
    antiBypassRules: [
      {
        id: 'func.A-require-call-f1',
        description: 'MAIN: 5 with loop leaves only 2 inner slots, requiring CALL_F1',
        forbidBlocks: ['CALL_F1'],
      },
      {
        id: 'func.A-require-call-f2',
        description: 'F1: 4 cannot inline non-adjacent F2 steps without CALL_F2',
        forbidBlocks: ['CALL_F2'],
      },
      {
        id: 'func.A-require-loop',
        description: 'Cannot service all 3 radial wings without LOOP_START',
        maxLoopNestingDepth: 0,
      },
    ],
  },

  // =========================================================================
  // func.B — Castle Architect (Turtle LOGO Creative Capstone)
  // =========================================================================
  {
    id: 'func.B',
    moduleId: 'func',
    version: 1,
    format: 'capstone',
    capstoneType: 'creative',
    simId: 'turtle',
    icon: '🏰',
    title: 'Castle Architect',
    concept: 'Multi-Tier Scene Architecture Across Main, F1, F2, and F3',
    description:
      'Put a micro-motif in F3, call F3 from structures in F1 and F2, and direct the full scene from Main without TELEPORT.',
    hint: 'Put small reusable stamps (flags, wheels, suns, petals) in F3 so both F1 and F2 can call F3!',
    palette: FUNC_B_PALETTE,
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          { type: 'PEN_UP' },
          { type: 'TURN_LEFT', params: { angle: 90 } },
          { type: 'FORWARD', params: { length: 110 } },
          { type: 'TURN_RIGHT', params: { angle: 90 } },
          { type: 'CALL_F1' },
          { type: 'CALL_F2' },
          { type: 'CALL_F1' },
        ],
        F1: [
          { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.blue } },
          { type: 'PEN_DOWN' },
          { type: 'FORWARD', params: { length: 150 } },
          { type: 'TURN_RIGHT', params: { angle: 30 } },
          { type: 'FORWARD', params: { length: 60 } },
          { type: 'TURN_LEFT', params: { angle: 30 } },
          { type: 'CALL_F3' },
          { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.blue } },
          { type: 'TURN_RIGHT', params: { angle: 150 } },
          { type: 'FORWARD', params: { length: 60 } },
          { type: 'TURN_RIGHT', params: { angle: 30 } },
          { type: 'FORWARD', params: { length: 150 } },
          { type: 'PEN_UP' },
          { type: 'TURN_RIGHT', params: { angle: 180 } },
        ],
        F2: [
          { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.amber } },
          { type: 'PEN_DOWN' },
          { type: 'FORWARD', params: { length: 90 } },
          { type: 'TURN_RIGHT', params: { angle: 90 } },
          { type: 'FORWARD', params: { length: 100 } },
          { type: 'TURN_RIGHT', params: { angle: 90 } },
          { type: 'FORWARD', params: { length: 90 } },
          { type: 'TURN_RIGHT', params: { angle: 180 } },
          { type: 'ARC_LEFT', params: { radius: 50, angle: 180 } },
          { type: 'PEN_UP' },
          { type: 'TURN_LEFT', params: { angle: 90 } },
          { type: 'FORWARD', params: { length: 100 } },
          { type: 'TURN_LEFT', params: { angle: 90 } },
        ],
        F3: [
          { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.red } },
          { type: 'PEN_DOWN' },
          { type: 'FORWARD', params: { length: 36 } },
          { type: 'TURN_RIGHT', params: { angle: 120 } },
          { type: 'FORWARD', params: { length: 28 } },
          { type: 'TURN_RIGHT', params: { angle: 120 } },
          { type: 'FORWARD', params: { length: 28 } },
          { type: 'TURN_RIGHT', params: { angle: 120 } },
          { type: 'BACKWARD', params: { length: 8 } },
        ],
      },
      'start_funcB'
    ),
    variations: [
      {
        id: 'func.B-var1-train',
        title: 'Choo-Choo Steam Train',
        icon: '🚂',
        workspace: makeWorkspace(
          {
            MAIN: [
              { type: 'PEN_UP' },
              { type: 'TURN_LEFT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 220 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'LOOP_START', repeatCount: 2 },
              { type: 'CALL_F1' },
              { type: 'LOOP_END' },
              { type: 'CALL_F2' },
            ],
            F1: [
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.blue } },
              { type: 'PEN_DOWN' },
              { type: 'LOOP_START', repeatCount: 2 },
              { type: 'FORWARD', params: { length: 72 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 128 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'LOOP_END' },
              { type: 'PEN_UP' },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 36 } },
              { type: 'CALL_F3' },
              { type: 'FORWARD', params: { length: 56 } },
              { type: 'CALL_F3' },
              { type: 'FORWARD', params: { length: 36 } },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.black } },
              { type: 'PEN_DOWN' },
              { type: 'FORWARD', params: { length: 16 } },
              { type: 'PEN_UP' },
              { type: 'TURN_LEFT', params: { angle: 90 } },
            ],
            F2: [
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.red } },
              { type: 'PEN_DOWN' },
              { type: 'FORWARD', params: { length: 104 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 52 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 44 } },
              { type: 'TURN_LEFT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 72 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 60 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 124 } },
              { type: 'TURN_RIGHT', params: { angle: 180 } },
              { type: 'PEN_UP' },
              { type: 'FORWARD', params: { length: 32 } },
              { type: 'CALL_F3' },
              { type: 'FORWARD', params: { length: 56 } },
              { type: 'CALL_F3' },
              { type: 'TURN_LEFT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 60 } },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.black } },
              { type: 'PEN_DOWN' },
              { type: 'FORWARD', params: { length: 32 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 20 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 32 } },
              { type: 'PEN_UP' },
              { type: 'TURN_RIGHT', params: { angle: 180 } },
              { type: 'FORWARD', params: { length: 52 } },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.cyan } },
              { type: 'PEN_DOWN' },
              { type: 'ARC_LEFT', params: { radius: 16, angle: 270 } },
              { type: 'PEN_UP' },
            ],
            F3: [
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.black } },
              { type: 'PEN_DOWN' },
              { type: 'ARC_RIGHT', params: { radius: 24, angle: 360 } },
              { type: 'PEN_UP' },
            ],
          },
          'v1_funcB'
        ),
      },
      {
        id: 'func.B-var2-harbor',
        title: 'Sunny Harbor',
        icon: '⛵',
        workspace: makeWorkspace(
          {
            MAIN: [
              { type: 'PEN_UP' },
              { type: 'TURN_LEFT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 180 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'BACKWARD', params: { length: 90 } },
              { type: 'CALL_F1' },
              { type: 'TURN_LEFT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 250 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 40 } },
              { type: 'CALL_F2' },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 200 } },
              { type: 'TURN_LEFT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 190 } },
              { type: 'CALL_F3' },
            ],
            F1: [
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.cyan } },
              { type: 'TURN_RIGHT', params: { angle: 45 } },
              { type: 'PEN_DOWN' },
              { type: 'LOOP_START', repeatCount: 6 },
              { type: 'ARC_RIGHT', params: { radius: 32, angle: 90 } },
              { type: 'TURN_LEFT', params: { angle: 90 } },
              { type: 'LOOP_END' },
              { type: 'PEN_UP' },
              { type: 'TURN_LEFT', params: { angle: 45 } },
            ],
            F2: [
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.red } },
              { type: 'PEN_DOWN' },
              { type: 'FORWARD', params: { length: 128 } },
              { type: 'TURN_RIGHT', params: { angle: 120 } },
              { type: 'FORWARD', params: { length: 48 } },
              { type: 'TURN_RIGHT', params: { angle: 60 } },
              { type: 'FORWARD', params: { length: 80 } },
              { type: 'TURN_RIGHT', params: { angle: 60 } },
              { type: 'FORWARD', params: { length: 48 } },
              { type: 'PEN_UP' },
              { type: 'TURN_RIGHT', params: { angle: 120 } },
              { type: 'FORWARD', params: { length: 56 } },
              { type: 'TURN_LEFT', params: { angle: 90 } },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.orange } },
              { type: 'PEN_DOWN' },
              { type: 'FORWARD', params: { length: 108 } },
              { type: 'TURN_RIGHT', params: { angle: 150 } },
              { type: 'FORWARD', params: { length: 96 } },
              { type: 'TURN_RIGHT', params: { angle: 120 } },
              { type: 'FORWARD', params: { length: 48 } },
              { type: 'PEN_UP' },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'BACKWARD', params: { length: 24 } },
            ],
            F3: [
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.orange } },
              { type: 'FORWARD', params: { length: 32 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'PEN_DOWN' },
              { type: 'ARC_RIGHT', params: { radius: 32, angle: 360 } },
              { type: 'PEN_UP' },
              { type: 'TURN_LEFT', params: { angle: 90 } },
              { type: 'BACKWARD', params: { length: 32 } },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.amber } },
              { type: 'LOOP_START', repeatCount: 6 },
              { type: 'FORWARD', params: { length: 44 } },
              { type: 'PEN_DOWN' },
              { type: 'FORWARD', params: { length: 20 } },
              { type: 'PEN_UP' },
              { type: 'BACKWARD', params: { length: 64 } },
              { type: 'TURN_RIGHT', params: { angle: 60 } },
              { type: 'LOOP_END' },
            ],
          },
          'v2_funcB'
        ),
      },
      {
        id: 'func.B-var3-meadow',
        title: 'Butterfly & Petal Meadow',
        icon: '🦋',
        workspace: makeWorkspace(
          {
            MAIN: [
              { type: 'PEN_UP' },
              { type: 'TURN_LEFT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 80 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'BACKWARD', params: { length: 75 } },
              { type: 'LOOP_START', repeatCount: 3 },
              { type: 'CALL_F1' },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 80 } },
              { type: 'TURN_LEFT', params: { angle: 90 } },
              { type: 'LOOP_END' },
              { type: 'FORWARD', params: { length: 140 } },
              { type: 'TURN_LEFT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 200 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'CALL_F2' },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 90 } },
              { type: 'TURN_LEFT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 20 } },
              { type: 'CALL_F2' },
            ],
            F1: [
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.green } },
              { type: 'PEN_DOWN' },
              { type: 'FORWARD', params: { length: 45 } },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.pink } },
              { type: 'LOOP_START', repeatCount: 5 },
              { type: 'CALL_F3' },
              { type: 'TURN_RIGHT', params: { angle: 72 } },
              { type: 'LOOP_END' },
              { type: 'PEN_UP' },
              { type: 'BACKWARD', params: { length: 45 } },
            ],
            F2: [
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.black } },
              { type: 'PEN_DOWN' },
              { type: 'BACKWARD', params: { length: 12 } },
              { type: 'FORWARD', params: { length: 24 } },
              { type: 'BACKWARD', params: { length: 12 } },
              { type: 'PEN_UP' },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.purple } },
              { type: 'CALL_F3' },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.orange } },
              { type: 'CALL_F3' },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'CALL_F3' },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.purple } },
              { type: 'CALL_F3' },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
            ],
            F3: [
              { type: 'PEN_DOWN' },
              { type: 'ARC_RIGHT', params: { radius: 24, angle: 90 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'ARC_RIGHT', params: { radius: 24, angle: 90 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'PEN_UP' },
            ],
          },
          'v3_funcB'
        ),
      },
    ],
  },

  // =========================================================================
  // func.C — Full Song Choreography (Beat & Light Pad Capstone)
  // =========================================================================
  {
    id: 'func.C',
    moduleId: 'func',
    version: 1,
    format: 'capstone',
    capstoneType: 'creative',
    simId: 'beat',
    icon: '🎹',
    title: 'Full Song Choreography',
    concept: 'Full Concert Song Structure Across F1, F2, and F3',
    description:
      'Compose Intro (F1), Verse/Groove (F2), and Chorus/Drop (F3), then conduct the full concert from Main using Loops and 0-delay composite frames.',
    hint: 'Stamp presets before LIGHT_ROW/COL/PIXEL overlays inside 0-delay batches so every frame lights cleanly together!',
    palette: FUNC_C_PALETTE,
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          { type: 'CALL_F1' },
          { type: 'LOOP_START', repeatCount: 2 },
          { type: 'CALL_F2' },
          { type: 'CALL_F3' },
          { type: 'LOOP_END' },
          { type: 'CALL_F1' },
          { type: 'PLAY_CHIME' },
        ],
        F1: [
          { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
          { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.amber } },
          { type: 'STAMP_PRESET', params: { preset: beatPreset(3) } },
          { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.cyan } },
          { type: 'LIGHT_ROW', params: { y: 1 } },
          { type: 'LIGHT_ROW', params: { y: 8 } },
          { type: 'SET_BEAT_DELAY', params: { delay: 1 } },
          { type: 'PLAY_NOTE', params: { pitch: 1, duration: 0.5 } },
          { type: 'PLAY_NOTE', params: { pitch: 5, duration: 1 } },
        ],
        F2: [
          { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
          { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.purple } },
          { type: 'STAMP_PRESET', params: { preset: beatPreset(4) } },
          { type: 'SET_BEAT_DELAY', params: { delay: 1 } },
          { type: 'DRUM_KICK' },
          { type: 'PLAY_NOTE', params: { pitch: 3, duration: 0.5 } },
          { type: 'DRUM_SNARE' },
          { type: 'PLAY_NOTE', params: { pitch: 4, duration: 0.5 } },
          { type: 'PLAY_NOTE', params: { pitch: 5, duration: 0.5 } },
          { type: 'DRUM_CLAP' },
        ],
        F3: [
          { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
          { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.pink } },
          { type: 'STAMP_PRESET', params: { preset: beatPreset(0) } },
          { type: 'SET_BEAT_DELAY', params: { delay: 1 } },
          { type: 'PLAY_NOTE', params: { pitch: 8, duration: 0.5 } },
          { type: 'PLAY_NOTE', params: { pitch: 6, duration: 0.5 } },
          { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
          { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.amber } },
          { type: 'STAMP_PRESET', params: { preset: beatPreset(1) } },
          { type: 'SET_BEAT_DELAY', params: { delay: 1 } },
          { type: 'PLAY_NOTE', params: { pitch: 8, duration: 1 } },
        ],
      },
      'start_funcC'
    ),
    variations: [
      {
        id: 'func.C-var1-boss',
        title: 'Arcade Boss Battle',
        icon: '👾',
        workspace: makeWorkspace(
          {
            MAIN: [
              { type: 'CALL_F1' },
              { type: 'LOOP_START', repeatCount: 2 },
              { type: 'CALL_F2' },
              { type: 'LOOP_END' },
              { type: 'CALL_F1' },
              { type: 'CALL_F3' },
              { type: 'PLAY_CHIME' },
            ],
            F1: [
              { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.red } },
              { type: 'STAMP_PRESET', params: { preset: beatPreset(5) } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.amber } },
              { type: 'LIGHT_ROW', params: { y: 1 } },
              { type: 'LIGHT_ROW', params: { y: 8 } },
              { type: 'SET_BEAT_DELAY', params: { delay: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 1, duration: 0.5 } },
              { type: 'PLAY_NOTE', params: { pitch: 2, duration: 0.5 } },
              { type: 'DRUM_CLAP' },
            ],
            F2: [
              { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
              { type: 'CLEAR_LEDS' },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.cyan } },
              { type: 'LIGHT_COL', params: { x: 2 } },
              { type: 'LIGHT_COL', params: { x: 7 } },
              { type: 'SET_BEAT_DELAY', params: { delay: 1 } },
              { type: 'DRUM_KICK' },
              { type: 'PLAY_NOTE', params: { pitch: 5, duration: 0.5 } },
              { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.orange } },
              { type: 'LIGHT_ROW', params: { y: 4 } },
              { type: 'SET_BEAT_DELAY', params: { delay: 1 } },
              { type: 'DRUM_SNARE' },
              { type: 'PLAY_NOTE', params: { pitch: 6, duration: 0.5 } },
            ],
            F3: [
              { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.amber } },
              { type: 'STAMP_PRESET', params: { preset: beatPreset(3) } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.green } },
              { type: 'LIGHT_ROW', params: { y: 8 } },
              { type: 'SET_BEAT_DELAY', params: { delay: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 1, duration: 0.5 } },
              { type: 'PLAY_NOTE', params: { pitch: 3, duration: 0.5 } },
              { type: 'PLAY_NOTE', params: { pitch: 5, duration: 0.5 } },
              { type: 'PLAY_NOTE', params: { pitch: 8, duration: 1 } },
            ],
          },
          'v1_funcC'
        ),
      },
      {
        id: 'func.C-var2-fireworks',
        title: 'Fireworks Finale',
        icon: '🎆',
        workspace: makeWorkspace(
          {
            MAIN: [
              { type: 'LOOP_START', repeatCount: 2 },
              { type: 'CALL_F1' },
              { type: 'CALL_F2' },
              { type: 'CALL_F3' },
              { type: 'LOOP_END' },
              { type: 'CALL_F3' },
              { type: 'PLAY_CHIME' },
            ],
            F1: [
              { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.orange } },
              { type: 'STAMP_PRESET', params: { preset: beatPreset(6) } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.red } },
              { type: 'LIGHT_PIXEL', params: { x: 4, y: 7 } },
              { type: 'LIGHT_PIXEL', params: { x: 5, y: 8 } },
              { type: 'SET_BEAT_DELAY', params: { delay: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 1, duration: 0.5 } },
              { type: 'PLAY_NOTE', params: { pitch: 3, duration: 0.5 } },
              { type: 'PLAY_NOTE', params: { pitch: 5, duration: 0.5 } },
              { type: 'DRUM_SNARE' },
              { type: 'WAIT_BEAT', params: { duration: 0.5 } },
            ],
            F2: [
              { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
              { type: 'CLEAR_LEDS' },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.cyan } },
              { type: 'LIGHT_ROW', params: { y: 4 } },
              { type: 'LIGHT_COL', params: { x: 4 } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.pink } },
              { type: 'LIGHT_PIXEL', params: { x: 2, y: 2 } },
              { type: 'LIGHT_PIXEL', params: { x: 7, y: 2 } },
              { type: 'LIGHT_PIXEL', params: { x: 2, y: 7 } },
              { type: 'LIGHT_PIXEL', params: { x: 7, y: 7 } },
              { type: 'SET_BEAT_DELAY', params: { delay: 1 } },
              { type: 'DRUM_CLAP' },
              { type: 'PLAY_NOTE', params: { pitch: 8, duration: 0.5 } },
              { type: 'PLAY_NOTE', params: { pitch: 6, duration: 0.5 } },
              { type: 'PLAY_NOTE', params: { pitch: 7, duration: 0.5 } },
              { type: 'PLAY_NOTE', params: { pitch: 8, duration: 0.5 } },
            ],
            F3: [
              { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.amber } },
              { type: 'STAMP_PRESET', params: { preset: beatPreset(1) } },
              { type: 'SET_BEAT_DELAY', params: { delay: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 5, duration: 0.5 } },
              { type: 'PLAY_NOTE', params: { pitch: 6, duration: 0.5 } },
              { type: 'PLAY_NOTE', params: { pitch: 8, duration: 1 } },
              { type: 'DRUM_KICK' },
              { type: 'PLAY_CHIME' },
            ],
          },
          'v2_funcC'
        ),
      },
      {
        id: 'func.C-var3-boogie',
        title: 'Robot Boogie',
        icon: '🤖',
        workspace: makeWorkspace(
          {
            MAIN: [
              { type: 'CALL_F3' },
              { type: 'LOOP_START', repeatCount: 2 },
              { type: 'CALL_F1' },
              { type: 'CALL_F2' },
              { type: 'LOOP_END' },
              { type: 'CALL_F3' },
              { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.green } },
              { type: 'STAMP_PRESET', params: { preset: beatPreset(2) } },
              { type: 'PLAY_CHIME' },
            ],
            F1: [
              { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.cyan } },
              { type: 'STAMP_PRESET', params: { preset: beatPreset(7) } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.amber } },
              { type: 'LIGHT_PIXEL', params: { x: 1, y: 1 } },
              { type: 'LIGHT_PIXEL', params: { x: 8, y: 1 } },
              { type: 'SET_BEAT_DELAY', params: { delay: 1 } },
              { type: 'DRUM_KICK' },
              { type: 'PLAY_NOTE', params: { pitch: 1, duration: 0.5 } },
              { type: 'DRUM_SNARE' },
              { type: 'PLAY_NOTE', params: { pitch: 3, duration: 0.5 } },
              { type: 'DRUM_CLAP' },
              { type: 'PLAY_NOTE', params: { pitch: 5, duration: 0.5 } },
            ],
            F2: [
              { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.pink } },
              { type: 'STAMP_PRESET', params: { preset: beatPreset(7) } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.amber } },
              { type: 'LIGHT_ROW', params: { y: 8 } },
              { type: 'SET_BEAT_DELAY', params: { delay: 1 } },
              { type: 'DRUM_KICK' },
              { type: 'PLAY_NOTE', params: { pitch: 5, duration: 0.5 } },
              { type: 'DRUM_SNARE' },
              { type: 'PLAY_NOTE', params: { pitch: 6, duration: 0.5 } },
              { type: 'DRUM_CLAP' },
              { type: 'PLAY_NOTE', params: { pitch: 8, duration: 0.5 } },
              { type: 'DRUM_KICK' },
            ],
            F3: [
              { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.purple } },
              { type: 'STAMP_PRESET', params: { preset: beatPreset(4) } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.cyan } },
              { type: 'LIGHT_COL', params: { x: 1 } },
              { type: 'LIGHT_COL', params: { x: 8 } },
              { type: 'SET_BEAT_DELAY', params: { delay: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 8, duration: 0.5 } },
              { type: 'PLAY_NOTE', params: { pitch: 6, duration: 0.5 } },
              { type: 'PLAY_NOTE', params: { pitch: 5, duration: 0.5 } },
              { type: 'PLAY_NOTE', params: { pitch: 3, duration: 0.5 } },
              { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.amber } },
              { type: 'STAMP_PRESET', params: { preset: beatPreset(1) } },
              { type: 'DRUM_CLAP' },
            ],
          },
          'v3_funcC'
        ),
      },
    ],
  },
];
