import type { CodeBlock, WallEdge, WorkspaceState } from '../../types';
import { createInitialDepotState } from '../../simulations/depot/depotPhysics';
import type { CrateColor, DepotStacks } from '../../simulations/depot/types';
import {
  ConditionExpr,
  CurriculumActivity,
  CurriculumDepotDefinition,
  CurriculumGridDefinition,
  CurriculumSwitchyardDefinition,
  ExplanationDemoTab,
  PaletteConfig,
  SceneInputConfig,
  SwitchyardColor,
  SwitchyardIcon,
  SwitchyardItemDef,
  createCurriculumBlock,
} from './types';

// ---------------------------------------------------------------------------
// Shared Construction Helpers
// ---------------------------------------------------------------------------

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

function block(
  type: string,
  repeatCount?: number,
  params?: Record<string, unknown>,
  idPrefix = 'while'
): CodeBlock {
  return createCurriculumBlock(type, repeatCount, params, idPrefix);
}

function makeWorkspace(specs: MultiScopeSpecs, idPrefix: string): WorkspaceState {
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

function makeMainWorkspace(specs: BlockSpec[], idPrefix: string): WorkspaceState {
  return makeWorkspace({ MAIN: specs }, idPrefix);
}

function sensor(
  sensorName: Extract<ConditionExpr, { kind: 'sensor' }>['sensor'],
  param?: string
): ConditionExpr {
  return {
    kind: 'sensor',
    sensor: sensorName,
    ...(param !== undefined ? { param } : {}),
  };
}

function notCond(operand: ConditionExpr): ConditionExpr {
  return { kind: 'not', operand };
}

function inputEq(value: number | string): ConditionExpr {
  return { kind: 'cmp', op: '=', left: '$input', right: value };
}

function makeDepotDef(
  queueColors: readonly CrateColor[],
  activeStationsMask: number,
  overrides?: {
    stacks?: DepotStacks;
    targetStacks?: DepotStacks;
    targetOutput?: CrateColor[];
    workerStation?: 'STACK_1' | 'STACK_2' | 'STACK_3' | 'QUEUE';
  }
): CurriculumDepotDefinition {
  const initialStacks: DepotStacks = overrides?.stacks ?? [[], [], []];
  const queue = queueColors.map((color) => ({ color }));
  const station = overrides?.workerStation ?? 'QUEUE';
  const base = createInitialDepotState({
    stacks: initialStacks,
    initialStacks,
    queue,
    initialQueue: queue,
    workerStation: station,
    initialWorkerStation: station,
    targetStacks: overrides?.targetStacks,
    targetOutput: overrides?.targetOutput,
    activeStationsMask,
  });
  return {
    ...base,
    activeStationsMask,
  };
}

interface SwitchyardStreamItemInput {
  color: SwitchyardColor;
  icon?: SwitchyardIcon;
  damaged?: boolean;
}

function makeSwitchyardVariant(
  label: string,
  stream: readonly SwitchyardStreamItemInput[],
  options?: {
    idPrefix?: string;
    scrapDamagedOnly?: boolean;
    expectedScrapCount?: number;
  }
): CurriculumSwitchyardDefinition {
  const prefix = options?.idPrefix ?? 'sy';
  const incomingStream: SwitchyardItemDef[] = stream.map((car, index) => ({
    id: `${prefix}_car_${index + 1}`,
    color: car.color,
    icon: car.icon ?? 'crate',
    ...(car.damaged ? { damaged: true } : {}),
  }));

  return {
    label,
    incomingStream,
    switches: [
      {
        id: 'A',
        initialDirection: 'left',
        leftTarget: 'DOCK_A',
        rightTarget: 'DOCK_B',
      },
    ],
    docks: [
      { id: 'DOCK_A', expectedColor: 'red', acceptsDamaged: false },
      { id: 'DOCK_B', expectedColor: 'blue', acceptsDamaged: false },
    ],
    ...(options?.scrapDamagedOnly
      ? {
          scrapChute: {
            expectedDamagedOnly: true,
            ...(options.expectedScrapCount !== undefined
              ? { expectedCount: options.expectedScrapCount }
              : {}),
          },
          scrapRules: 'damagedOnly',
        }
      : {}),
  };
}

function edge(x: number, y: number, orientation: 'H' | 'V'): WallEdge {
  return { x, y, orientation };
}

function buildLTunnelGrid(
  idSuffix: string,
  label: string,
  width: number,
  height: number,
  l1: number,
  l2: number
): CurriculumGridDefinition {
  const barriers: WallEdge[] = [];
  for (let y = 1; y <= l2; y++) {
    barriers.push(edge(l1, y, 'V'));
  }
  for (let x = 0; x < l1; x++) {
    barriers.push(edge(x, 1, 'H'));
  }
  return {
    label,
    width,
    height,
    robot: { x: 0, y: 0, dir: 'EAST' },
    barriers,
    flags: [{ id: `G_${idSuffix}`, x: l1, y: l2, isGoal: true, order: 0, collected: false }],
    strictInteractionCollision: true,
    requireAllItemsCollected: false,
    requireEmptyBackpackAtGoal: false,
  };
}

// ---------------------------------------------------------------------------
// Canonical Palette Color Maps & Environment Action Tables
// ---------------------------------------------------------------------------

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

// Zero TELEPORT in while.6 and while.B
const WHILE_TURTLE_ALLOWED_BLOCKS: string[] = [
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

const WHILE_TURTLE_PARAMS: Record<string, string[]> = {
  FORWARD: ['length'],
  BACKWARD: ['length'],
  TURN_LEFT: ['angle'],
  TURN_RIGHT: ['angle'],
  ARC_LEFT: ['radius', 'angle'],
  ARC_RIGHT: ['radius', 'angle'],
  SET_PEN_COLOR: ['color'],
  SET_PEN_WIDTH: ['width'],
};

const WHILE_BEAT_ALLOWED_BLOCKS: string[] = [
  'LIGHT_PIXEL',
  'SET_LED_COLOR',
  'CURSOR_STEP',
  'CURSOR_TURN',
  'SET_BEAT_DELAY',
  'WAIT_BEAT',
  'PLAY_NOTE',
  'DRUM_KICK',
  'DRUM_SNARE',
  'DRUM_CLAP',
  'PLAY_CHIME',
];

const WHILE_BEAT_PARAMS: Record<string, string[]> = {
  LIGHT_PIXEL: ['x', 'y'],
  SET_LED_COLOR: ['color'],
  CURSOR_TURN: ['direction'],
  SET_BEAT_DELAY: ['delay'],
  WAIT_BEAT: ['duration'],
  PLAY_NOTE: ['pitch', 'duration'],
};

const INPUT_1_TO_3: SceneInputConfig = {
  mode: 'int',
  min: 1,
  max: 3,
  options: [1, 2, 3],
  previewInput: 1,
};

const INPUT_1_TO_4: SceneInputConfig = {
  mode: 'int',
  min: 1,
  max: 4,
  options: [1, 2, 3, 4],
  previewInput: 4,
};

// ---------------------------------------------------------------------------
// Palettes (allowVariables: false across ALL 12 activities)
// ---------------------------------------------------------------------------

const WHILE_0_PALETTE: PaletteConfig = {
  allowedSimBlocks: ['MOVE_FWD'],
  allowedControlBlocks: ['WHILE', 'END_WHILE'],
  allowedSensors: ['pathAhead', 'atGoal'],
  allowedCombinators: ['NOT'],
  allowedScopes: ['MAIN'],
  allowRepeatBadges: false,
  allowActionParams: false,
  allowedBlockParams: {},
  allowVariables: false,
  allowRecursion: false,
};

const WHILE_1_PALETTE: PaletteConfig = {
  allowedSimBlocks: ['MOVE_FWD', 'TURN_LEFT', 'TURN_RIGHT'],
  allowedControlBlocks: ['WHILE', 'END_WHILE'],
  allowedSensors: ['pathAhead', 'atGoal'],
  allowedCombinators: ['NOT'],
  allowedScopes: ['MAIN'],
  allowRepeatBadges: false,
  allowActionParams: false,
  allowedBlockParams: {},
  allowVariables: false,
  allowRecursion: false,
};

const WHILE_2_PALETTE: PaletteConfig = {
  allowedSimBlocks: ['DEPOT_MOVE_TO', 'DEPOT_GRAB', 'DEPOT_PLACE', 'DEPOT_SEND_OUT'],
  allowedControlBlocks: ['WHILE', 'END_WHILE', 'IF', 'ELSE', 'END_IF'],
  allowedSensors: ['stationEmpty', 'heldColor', 'topColor'],
  allowedCombinators: ['NOT'],
  allowedScopes: ['MAIN'],
  allowRepeatBadges: false,
  allowActionParams: true,
  allowedBlockParams: { DEPOT_MOVE_TO: ['station'] },
  allowVariables: false,
  allowRecursion: false,
};

const WHILE_3_PALETTE: PaletteConfig = {
  allowedSimBlocks: ['DEPOT_MOVE_TO', 'DEPOT_GRAB', 'DEPOT_PLACE'],
  allowedControlBlocks: ['WHILE', 'END_WHILE', 'IF', 'ELSE', 'END_IF'],
  allowedSensors: ['stationEmpty', 'heldColor', 'topColor'],
  allowedCombinators: ['NOT'],
  allowedScopes: ['MAIN'],
  allowRepeatBadges: false,
  allowActionParams: true,
  allowedBlockParams: { DEPOT_MOVE_TO: ['station'] },
  allowVariables: false,
  allowRecursion: false,
};

const WHILE_4_PALETTE: PaletteConfig = {
  allowedSimBlocks: ['DEPOT_MOVE_TO', 'DEPOT_GRAB', 'DEPOT_PLACE', 'DEPOT_SEND_OUT'],
  allowedControlBlocks: ['WHILE', 'END_WHILE', 'IF', 'ELSE_IF', 'ELSE', 'END_IF'],
  allowedSensors: ['stationEmpty', 'heldColor', 'topColor'],
  allowedCombinators: ['NOT'],
  allowedScopes: ['MAIN'],
  allowRepeatBadges: false,
  allowActionParams: true,
  allowedBlockParams: { DEPOT_MOVE_TO: ['station'] },
  allowVariables: false,
  allowRecursion: false,
};

const WHILE_5_PALETTE: PaletteConfig = {
  allowedSimBlocks: ['SWITCH_LEFT', 'SWITCH_RIGHT', 'SEND_NEXT', 'SCRAP_ITEM'],
  allowedControlBlocks: ['WHILE', 'END_WHILE', 'IF', 'ELSE_IF', 'ELSE', 'END_IF', 'CALL_F1'],
  allowedSensors: ['hasNextItem', 'itemDamaged', 'itemColor'],
  allowedCombinators: [],
  allowedScopes: ['MAIN', 'F1'],
  allowRepeatBadges: false,
  allowActionParams: false,
  allowedBlockParams: {},
  allowVariables: false,
  allowRecursion: false,
};

const WHILE_6_PALETTE: PaletteConfig = {
  allowedSimBlocks: [...WHILE_TURTLE_ALLOWED_BLOCKS],
  allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'WHILE', 'END_WHILE', 'CALL_F1', 'CALL_F2'],
  allowedSensors: ['insideCanvas'],
  allowedCombinators: ['NOT'],
  allowedScopes: ['MAIN', 'F1', 'F2'],
  allowRepeatBadges: true,
  allowActionParams: true,
  allowedBlockParams: WHILE_TURTLE_PARAMS,
  allowVariables: false,
  allowRecursion: false,
};

const WHILE_7_PALETTE: PaletteConfig = {
  allowedSimBlocks: [...WHILE_BEAT_ALLOWED_BLOCKS],
  allowedControlBlocks: [
    'LOOP_START',
    'LOOP_END',
    'WHILE',
    'END_WHILE',
    'IF',
    'ELSE_IF',
    'ELSE',
    'END_IF',
    'CALL_F1',
    'CALL_F2',
  ],
  allowedSensors: ['cursorAtEdge', '$input'],
  allowedCombinators: ['NOT'],
  allowedScopes: ['MAIN', 'F1', 'F2'],
  allowRepeatBadges: true,
  allowActionParams: true,
  allowedBlockParams: WHILE_BEAT_PARAMS,
  allowVariables: false,
  allowRecursion: false,
};

const WHILE_8_PALETTE: PaletteConfig = {
  allowedSimBlocks: ['SWITCH_LEFT', 'SWITCH_RIGHT', 'SEND_NEXT'],
  allowedControlBlocks: ['WHILE', 'END_WHILE', 'IF', 'ELSE', 'END_IF'],
  allowedSensors: ['hasNextItem', 'itemColor'],
  allowedCombinators: [],
  allowedScopes: ['MAIN'],
  allowRepeatBadges: false,
  allowActionParams: false,
  allowedBlockParams: {},
  allowVariables: false,
  allowRecursion: false,
};

const WHILE_A_PALETTE: PaletteConfig = {
  allowedSimBlocks: ['MOVE_FWD', 'TURN_LEFT', 'TURN_RIGHT'],
  allowedControlBlocks: ['WHILE', 'END_WHILE', 'IF', 'ELSE_IF', 'ELSE', 'END_IF'],
  allowedSensors: ['atGoal', 'pathAhead', 'pathLeft', 'pathRight'],
  allowedCombinators: ['NOT'],
  allowedScopes: ['MAIN'],
  allowRepeatBadges: false,
  allowActionParams: false,
  allowedBlockParams: {},
  allowVariables: false,
  allowRecursion: false,
};

const WHILE_B_PALETTE: PaletteConfig = {
  allowedSimBlocks: [...WHILE_TURTLE_ALLOWED_BLOCKS],
  allowedControlBlocks: [
    'LOOP_START',
    'LOOP_END',
    'WHILE',
    'END_WHILE',
    'IF',
    'ELSE_IF',
    'ELSE',
    'END_IF',
    'CALL_F1',
    'CALL_F2',
    'CALL_F3',
  ],
  allowedSensors: ['insideCanvas', '$input'],
  allowedCombinators: ['NOT'],
  allowedScopes: ['MAIN', 'F1', 'F2', 'F3'],
  allowRepeatBadges: true,
  allowActionParams: true,
  allowedBlockParams: WHILE_TURTLE_PARAMS,
  allowVariables: false,
  allowRecursion: false,
};

const WHILE_C_PALETTE: PaletteConfig = {
  allowedSimBlocks: [...WHILE_BEAT_ALLOWED_BLOCKS],
  allowedControlBlocks: [
    'LOOP_START',
    'LOOP_END',
    'WHILE',
    'END_WHILE',
    'IF',
    'ELSE_IF',
    'ELSE',
    'END_IF',
    'CALL_F1',
    'CALL_F2',
    'CALL_F3',
  ],
  allowedSensors: ['cursorAtEdge', '$input'],
  allowedCombinators: ['NOT'],
  allowedScopes: ['MAIN', 'F1', 'F2', 'F3'],
  allowRepeatBadges: true,
  allowActionParams: true,
  allowedBlockParams: WHILE_BEAT_PARAMS,
  allowVariables: false,
  allowRecursion: false,
};

// ---------------------------------------------------------------------------
// Activity Grids, Demo Tabs, Depots & Switchyard Streams
// ---------------------------------------------------------------------------

export const WHILE_0_GRID_SHORT: CurriculumGridDefinition = {
  label: '3x1',
  width: 3,
  height: 1,
  robot: { x: 0, y: 0, dir: 'EAST' },
  barriers: [],
  flags: [{ id: 'G_while0_short', x: 2, y: 0, isGoal: true, order: 0, collected: false }],
  strictInteractionCollision: true,
  requireAllItemsCollected: false,
  requireEmptyBackpackAtGoal: false,
};

export const WHILE_0_GRID_LONG: CurriculumGridDefinition = {
  label: '8x1',
  width: 8,
  height: 1,
  robot: { x: 0, y: 0, dir: 'EAST' },
  barriers: [],
  flags: [{ id: 'G_while0_long', x: 7, y: 0, isGoal: true, order: 0, collected: false }],
  strictInteractionCollision: true,
  requireAllItemsCollected: false,
  requireEmptyBackpackAtGoal: false,
};

export const WHILE_0_GRID_MID_GOAL: CurriculumGridDefinition = {
  label: '6x1',
  width: 6,
  height: 1,
  robot: { x: 0, y: 0, dir: 'EAST' },
  barriers: [],
  flags: [{ id: 'G_while0_mid', x: 3, y: 0, isGoal: true, order: 0, collected: false }],
  strictInteractionCollision: true,
  requireAllItemsCollected: false,
  requireEmptyBackpackAtGoal: false,
};

export const WHILE_0_DEMO_TABS: ExplanationDemoTab[] = [
  {
    id: 'while.0-tab-1',
    label: '1',
    icon: '🔁',
    title: 'While (pathAhead) Across Long & Short Halls',
    simId: 'grid',
    gridState: WHILE_0_GRID_LONG,
    workspace: makeMainWorkspace(
      [
        { type: 'WHILE', params: { condition: sensor('pathAhead') } },
        { type: 'MOVE_FWD' },
        { type: 'END_WHILE' },
      ],
      'while0_t1'
    ),
    spotlights: ['while-guard', 'sensor-beam', 'execution-order'],
  },
  {
    id: 'while.0-tab-2',
    label: '2',
    icon: '🏁',
    title: 'While (NOT atGoal) Stops Mid-Corridor',
    simId: 'grid',
    gridState: WHILE_0_GRID_MID_GOAL,
    workspace: makeMainWorkspace(
      [
        { type: 'WHILE', params: { condition: notCond(sensor('atGoal')) } },
        { type: 'MOVE_FWD' },
        { type: 'END_WHILE' },
      ],
      'while0_t2'
    ),
    spotlights: ['while-guard', 'sensor-beam'],
  },
];

export const WHILE_1_GRID_VARIANTS: CurriculumGridDefinition[] = [
  buildLTunnelGrid('while1_m1', '3x4', 3, 4, 2, 3),
  buildLTunnelGrid('while1_m2', '6x3', 6, 3, 5, 2),
  buildLTunnelGrid('while1_m3', '4x6', 4, 6, 3, 5),
  buildLTunnelGrid('while1_m4', '7x5', 7, 5, 6, 4),
];

export const WHILE_2_DEPOT_TAB1: CurriculumDepotDefinition = makeDepotDef(
  ['RED', 'BLUE', 'GREEN', 'AMBER'],
  0x4f,
  {
    targetStacks: [[], [], []],
    targetOutput: ['RED', 'BLUE', 'GREEN', 'AMBER'],
  }
);

export const WHILE_2_DEPOT_TAB2: CurriculumDepotDefinition = makeDepotDef(
  ['RED', 'BLUE', 'RED', 'BLUE'],
  0x0f,
  {
    targetStacks: [['RED', 'RED'], ['BLUE', 'BLUE'], []],
  }
);

export const WHILE_2_DEMO_TABS: ExplanationDemoTab[] = [
  {
    id: 'while.2-tab-1',
    label: '1',
    icon: '🚆',
    title: 'FIFO Queue -> OUT Preserves Arrival Order',
    simId: 'depot',
    depotState: WHILE_2_DEPOT_TAB1,
    workspace: makeMainWorkspace(
      [
        { type: 'WHILE', params: { condition: notCond(sensor('stationEmpty', 'QUEUE')) } },
        { type: 'DEPOT_MOVE_TO', params: { station: 'QUEUE' } },
        { type: 'DEPOT_GRAB' },
        { type: 'DEPOT_SEND_OUT' },
        { type: 'END_WHILE' },
      ],
      'while2_t1'
    ),
    spotlights: ['fifo-vs-lifo', 'depot-out-chute', 'while-guard'],
  },
  {
    id: 'while.2-tab-2',
    label: '2',
    icon: '🎨',
    title: 'Inspect Claw Color & Route to Stacks',
    simId: 'depot',
    depotState: WHILE_2_DEPOT_TAB2,
    workspace: makeMainWorkspace(
      [
        { type: 'WHILE', params: { condition: notCond(sensor('stationEmpty', 'QUEUE')) } },
        { type: 'DEPOT_MOVE_TO', params: { station: 'QUEUE' } },
        { type: 'DEPOT_GRAB' },
        { type: 'IF', params: { condition: sensor('heldColor', 'red') } },
        { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_1' } },
        { type: 'ELSE' },
        { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_2' } },
        { type: 'END_IF' },
        { type: 'DEPOT_PLACE' },
        { type: 'END_WHILE' },
      ],
      'while2_t2'
    ),
    spotlights: ['while-guard', 'depot-stack-top', 'sensor-beam'],
  },
];

export const WHILE_3_DEPOT_VARIANTS: CurriculumDepotDefinition[] = [
  makeDepotDef(['RED', 'BLUE', 'RED'], 0x0b, {
    targetStacks: [['RED', 'RED'], ['BLUE'], []],
  }),
  makeDepotDef(['BLUE', 'BLUE', 'RED', 'BLUE', 'RED'], 0x0b, {
    targetStacks: [['RED', 'RED'], ['BLUE', 'BLUE', 'BLUE'], []],
  }),
  makeDepotDef(['RED', 'RED', 'RED', 'RED'], 0x0b, {
    targetStacks: [['RED', 'RED', 'RED', 'RED'], [], []],
  }),
  makeDepotDef(['BLUE', 'RED', 'BLUE', 'BLUE', 'BLUE', 'RED'], 0x0b, {
    targetStacks: [['RED', 'RED'], ['BLUE', 'BLUE', 'BLUE', 'BLUE'], []],
  }),
];

export const WHILE_4_DEPOT_VARIANTS: CurriculumDepotDefinition[] = [
  makeDepotDef(['RED', 'GREEN', 'BLUE', 'AMBER'], 0x4b, {
    targetStacks: [['RED'], ['BLUE'], []],
    targetOutput: ['GREEN', 'AMBER'],
  }),
  makeDepotDef(['AMBER', 'RED', 'GREEN', 'RED', 'GREEN'], 0x4b, {
    targetStacks: [['RED', 'RED'], [], []],
    targetOutput: ['AMBER', 'GREEN', 'GREEN'],
  }),
  makeDepotDef(['BLUE', 'GREEN', 'RED', 'AMBER', 'BLUE', 'GREEN'], 0x4b, {
    targetStacks: [['RED'], ['BLUE', 'BLUE'], []],
    targetOutput: ['GREEN', 'AMBER', 'GREEN'],
  }),
  makeDepotDef(['GREEN', 'AMBER', 'RED', 'BLUE', 'GREEN', 'RED', 'AMBER'], 0x4b, {
    targetStacks: [['RED', 'RED'], ['BLUE'], []],
    targetOutput: ['GREEN', 'AMBER', 'GREEN', 'AMBER'],
  }),
];

export const WHILE_5_SWITCHYARD_VARIANTS: CurriculumSwitchyardDefinition[] = [
  makeSwitchyardVariant(
    '1',
    [
      { color: 'red', damaged: true },
      { color: 'blue' },
    ],
    { idPrefix: 'while5_s1', scrapDamagedOnly: true, expectedScrapCount: 1 }
  ),
  makeSwitchyardVariant(
    '2',
    [
      { color: 'blue', damaged: true },
      { color: 'red' },
      { color: 'red', damaged: true },
      { color: 'blue' },
    ],
    { idPrefix: 'while5_s2', scrapDamagedOnly: true, expectedScrapCount: 2 }
  ),
  makeSwitchyardVariant(
    '3',
    [
      { color: 'red' },
      { color: 'red', damaged: true },
      { color: 'blue', damaged: true },
      { color: 'blue' },
      { color: 'red' },
    ],
    { idPrefix: 'while5_s3', scrapDamagedOnly: true, expectedScrapCount: 2 }
  ),
  makeSwitchyardVariant(
    '4',
    [
      { color: 'blue' },
      { color: 'red' },
      { color: 'blue', damaged: true },
      { color: 'blue' },
      { color: 'red', damaged: true },
      { color: 'red' },
    ],
    { idPrefix: 'while5_s4', scrapDamagedOnly: true, expectedScrapCount: 2 }
  ),
];

export const WHILE_8_SWITCHYARD_VARIANTS: CurriculumSwitchyardDefinition[] = [
  makeSwitchyardVariant('1', [{ color: 'red' }, { color: 'red' }], { idPrefix: 'while8_s1' }),
  makeSwitchyardVariant(
    '2',
    [{ color: 'red' }, { color: 'blue' }, { color: 'red' }, { color: 'blue' }],
    { idPrefix: 'while8_s2' }
  ),
  makeSwitchyardVariant('3', [{ color: 'blue' }, { color: 'blue' }, { color: 'red' }], {
    idPrefix: 'while8_s3',
  }),
  makeSwitchyardVariant(
    '4',
    [{ color: 'red' }, { color: 'red' }, { color: 'blue' }, { color: 'red' }, { color: 'red' }],
    { idPrefix: 'while8_s4' }
  ),
];

export const WHILE_A_GRID_VARIANTS: CurriculumGridDefinition[] = [
  {
    label: 'S-Corridor 5x5',
    width: 5,
    height: 5,
    robot: { x: 0, y: 0, dir: 'EAST' },
    barriers: [
      edge(3, 0, 'V'),
      edge(3, 1, 'V'),
      edge(4, 1, 'V'),
      edge(1, 2, 'V'),
      edge(4, 2, 'V'),
      edge(2, 3, 'V'),
      edge(0, 1, 'H'),
      edge(1, 1, 'H'),
      edge(1, 2, 'H'),
      edge(2, 2, 'H'),
      edge(2, 3, 'H'),
      edge(3, 3, 'H'),
      edge(0, 4, 'H'),
      edge(1, 4, 'H'),
      edge(3, 4, 'H'),
      edge(4, 4, 'H'),
    ],
    flags: [{ id: 'G_whileA_m1', x: 4, y: 4, isGoal: true, order: 0, collected: false }],
    strictInteractionCollision: true,
    requireAllItemsCollected: false,
    requireEmptyBackpackAtGoal: false,
  },
  {
    label: 'T-Junction 5x5',
    width: 5,
    height: 5,
    robot: { x: 0, y: 2, dir: 'EAST' },
    barriers: [
      edge(3, 0, 'V'),
      edge(4, 0, 'V'),
      edge(2, 1, 'V'),
      edge(3, 1, 'V'),
      edge(3, 2, 'V'),
      edge(4, 2, 'V'),
      edge(3, 3, 'V'),
      edge(1, 1, 'H'),
      edge(0, 2, 'H'),
      edge(1, 2, 'H'),
      edge(0, 3, 'H'),
      edge(1, 3, 'H'),
      edge(4, 3, 'H'),
      edge(1, 4, 'H'),
      edge(2, 4, 'H'),
      edge(3, 4, 'H'),
    ],
    flags: [{ id: 'G_whileA_m2', x: 4, y: 0, isGoal: true, order: 0, collected: false }],
    strictInteractionCollision: true,
    requireAllItemsCollected: false,
    requireEmptyBackpackAtGoal: false,
  },
  {
    label: 'U-Turn Alcove 5x5',
    width: 5,
    height: 5,
    robot: { x: 2, y: 0, dir: 'SOUTH' },
    barriers: [
      edge(2, 0, 'V'),
      edge(3, 0, 'V'),
      edge(1, 1, 'V'),
      edge(2, 1, 'V'),
      edge(3, 1, 'V'),
      edge(4, 1, 'V'),
      edge(1, 2, 'V'),
      edge(4, 2, 'V'),
      edge(1, 3, 'V'),
      edge(4, 3, 'V'),
      edge(1, 4, 'V'),
      edge(1, 3, 'H'),
      edge(2, 3, 'H'),
      edge(4, 3, 'H'),
      edge(2, 4, 'H'),
      edge(3, 4, 'H'),
    ],
    flags: [{ id: 'G_whileA_m3', x: 4, y: 4, isGoal: true, order: 0, collected: false }],
    strictInteractionCollision: true,
    requireAllItemsCollected: false,
    requireEmptyBackpackAtGoal: false,
  },
  {
    label: 'Grand Spiral 6x6',
    width: 6,
    height: 6,
    robot: { x: 0, y: 0, dir: 'EAST' },
    barriers: [
      edge(5, 1, 'V'),
      edge(1, 2, 'V'),
      edge(4, 2, 'V'),
      edge(5, 2, 'V'),
      edge(1, 3, 'V'),
      edge(2, 3, 'V'),
      edge(4, 3, 'V'),
      edge(5, 3, 'V'),
      edge(1, 4, 'V'),
      edge(5, 4, 'V'),
      edge(0, 1, 'H'),
      edge(1, 1, 'H'),
      edge(2, 1, 'H'),
      edge(3, 1, 'H'),
      edge(4, 1, 'H'),
      edge(1, 2, 'H'),
      edge(2, 2, 'H'),
      edge(3, 2, 'H'),
      edge(2, 3, 'H'),
      edge(2, 4, 'H'),
      edge(3, 4, 'H'),
      edge(1, 5, 'H'),
      edge(2, 5, 'H'),
      edge(3, 5, 'H'),
      edge(4, 5, 'H'),
    ],
    flags: [{ id: 'G_whileA_m4', x: 3, y: 3, isGoal: true, order: 0, collected: false }],
    strictInteractionCollision: true,
    requireAllItemsCollected: false,
    requireEmptyBackpackAtGoal: false,
  },
];

// ---------------------------------------------------------------------------
// Module while Activities (Exact while/overview.md Order: while.0..while.C)
// ---------------------------------------------------------------------------

export const WHILE_ACTIVITIES: CurriculumActivity[] = [
  // =========================================================================
  // while.0 — While Loops vs. Fixed Repeat Counts (Explanation, Grid)
  // =========================================================================
  {
    id: 'while.0',
    moduleId: 'while',
    version: 1,
    format: 'explanation',
    simId: 'grid',
    icon: '🔭',
    title: 'While vs. Fixed Repeat',
    concept: 'Condition-Driven While (pathAhead) and While (NOT atGoal) Loops',
    description:
      'Watch how While (pathAhead) adapts cleanly to short and long halls without crashing, and how While (NOT atGoal) stops right on a mid-corridor Goal flag.',
    hint: 'Compare pathAhead for open halls versus NOT atGoal when Goal sits before the far wall.',
    palette: WHILE_0_PALETTE,
    grid: WHILE_0_GRID_SHORT,
    demoTabs: WHILE_0_DEMO_TABS,
  },

  // =========================================================================
  // while.1 — Conditional Loops (While) (Multi-Run Grid Puzzle)
  // =========================================================================
  {
    id: 'while.1',
    moduleId: 'while',
    version: 1,
    format: 'puzzle',
    simId: 'grid',
    icon: '🛰️',
    title: 'Adaptive L-Tunnels',
    concept: 'Chaining Sequential While Loops Across Varying Leg Lengths',
    description:
      'Keep the first While (pathAhead) loop to reach the corner across all 4 L-tunnels, turn Right, and add a second While loop to walk down to the Goal.',
    hint: 'After End While at the corner, TURN_RIGHT and add a second While (pathAhead) { MOVE_FWD }!',
    palette: WHILE_1_PALETTE,
    slotCap: {
      perScope: { MAIN: 7 },
      maxTotal: 7,
    },
    gridVariants: WHILE_1_GRID_VARIANTS,
    starterWorkspace: makeMainWorkspace(
      [
        { type: 'WHILE', params: { condition: sensor('pathAhead') } },
        { type: 'MOVE_FWD' },
        { type: 'END_WHILE' },
      ],
      'start_while1'
    ),
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeMainWorkspace(
        [
          { type: 'WHILE', params: { condition: sensor('pathAhead') } },
          { type: 'MOVE_FWD' },
          { type: 'END_WHILE' },
          { type: 'TURN_RIGHT' },
          { type: 'WHILE', params: { condition: sensor('pathAhead') } },
          { type: 'PLACEHOLDER', params: { hintCategory: 'motion' } },
          { type: 'END_WHILE' },
        ],
        'scaf_while1'
      ),
    },
    referenceSolution: makeMainWorkspace(
      [
        { type: 'WHILE', params: { condition: sensor('pathAhead') } },
        { type: 'MOVE_FWD' },
        { type: 'END_WHILE' },
        { type: 'TURN_RIGHT' },
        { type: 'WHILE', params: { condition: sensor('pathAhead') } },
        { type: 'MOVE_FWD' },
        { type: 'END_WHILE' },
      ],
      'ref_while1'
    ),
    antiBypassRules: [
      {
        id: 'while.1-starter-must-fail',
        description: 'Stopping at the top-right corner fails before reaching Goal',
        unmodifiedStarterMustFail: true,
        minStarterEditDistance: 1,
      },
      {
        id: 'while.1-require-while-across-variants',
        description:
          'No loop-free program solves all 4 unequal L-tunnels within 7 slots (single-map bypass fails on Map 2..4)',
        forbidBlocks: ['WHILE'],
        singleVariantBypassMustExist: true,
      },
    ],
  },

  // =========================================================================
  // while.2 — FIFO Conveyor Queue & heldColor == [Swatch] (Explanation, Depot v4)
  // =========================================================================
  {
    id: 'while.2',
    moduleId: 'while',
    version: 1,
    format: 'explanation',
    simId: 'depot',
    icon: '⚙️',
    title: 'FIFO Belt & Claw Color',
    concept: 'First-In First-Out Queue Processing With While + If (heldColor)',
    description:
      'Contrast FIFO Queue arrival order (Queue -> OUT) against LIFO Stack reversal, then drain the Queue using While (NOT stationEmpty [Queue]) and heldColor == [Red].',
    hint: 'Tab 1 sends rings straight from Queue to OUT; Tab 2 checks heldColor == [Red] inside the claw.',
    palette: WHILE_2_PALETTE,
    depot: WHILE_2_DEPOT_TAB1,
    demoTabs: WHILE_2_DEMO_TABS,
  },

  // =========================================================================
  // while.3 — Binary Queue Color Sort (Multi-Run Depot v4 Puzzle)
  // =========================================================================
  {
    id: 'while.3',
    moduleId: 'while',
    version: 1,
    format: 'puzzle',
    simId: 'depot',
    icon: '🔴',
    title: 'Binary Queue Color Sort',
    concept: 'Draining Variable-Length Queues Into Red & Blue Target Stacks',
    description:
      'Finish the Queue loop across all 4 streams (3 to 6 rings, including an all-Red queue) by routing heldColor == [Red] to Stack 1 and Blue rings to Stack 2.',
    hint: 'Inside While (NOT stationEmpty [Queue]): If (heldColor == Red) Move To [Stack 1] Else Move To [Stack 2]!',
    palette: WHILE_3_PALETTE,
    slotCap: {
      perScope: { MAIN: 10 },
      maxTotal: 10,
    },
    depotVariants: WHILE_3_DEPOT_VARIANTS,
    starterWorkspace: makeMainWorkspace(
      [
        { type: 'WHILE', params: { condition: notCond(sensor('stationEmpty', 'QUEUE')) } },
        { type: 'DEPOT_MOVE_TO', params: { station: 'QUEUE' } },
        { type: 'DEPOT_GRAB' },
        { type: 'PLACEHOLDER', params: { hintCategory: 'conditional' } },
        { type: 'DEPOT_PLACE' },
        { type: 'END_WHILE' },
      ],
      'start_while3'
    ),
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeMainWorkspace(
        [
          { type: 'WHILE', params: { condition: notCond(sensor('stationEmpty', 'QUEUE')) } },
          { type: 'DEPOT_MOVE_TO', params: { station: 'QUEUE' } },
          { type: 'DEPOT_GRAB' },
          { type: 'IF', params: { condition: sensor('heldColor', 'red') } },
          { type: 'PLACEHOLDER', params: { hintCategory: 'motion' } },
          { type: 'ELSE' },
          { type: 'PLACEHOLDER', params: { hintCategory: 'motion' } },
          { type: 'END_IF' },
          { type: 'DEPOT_PLACE' },
          { type: 'END_WHILE' },
        ],
        'scaf_while3'
      ),
    },
    referenceSolution: makeMainWorkspace(
      [
        { type: 'WHILE', params: { condition: notCond(sensor('stationEmpty', 'QUEUE')) } },
        { type: 'DEPOT_MOVE_TO', params: { station: 'QUEUE' } },
        { type: 'DEPOT_GRAB' },
        { type: 'IF', params: { condition: sensor('heldColor', 'red') } },
        { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_1' } },
        { type: 'ELSE' },
        { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_2' } },
        { type: 'END_IF' },
        { type: 'DEPOT_PLACE' },
        { type: 'END_WHILE' },
      ],
      'ref_while3'
    ),
    antiBypassRules: [
      {
        id: 'while.3-starter-must-fail',
        description: 'Unedited Queue loop drops rings straight onto Queue without sorting',
        unmodifiedStarterMustFail: true,
        minStarterEditDistance: 1,
      },
      {
        id: 'while.3-require-while-and-else',
        description: 'Unequal 3..6 queues plus all-Red Run 3 require While + If/Else sorting',
        forbidBlocks: ['ELSE'],
      },
    ],
  },

  // =========================================================================
  // while.4 — 3-Way Queue Sort & FIFO Express Lane (Multi-Run Depot v4 Puzzle)
  // =========================================================================
  {
    id: 'while.4',
    moduleId: 'while',
    version: 1,
    format: 'puzzle',
    simId: 'depot',
    icon: '⚡',
    title: '3-Way Express Sorter',
    concept: 'Stacking Red/Blue While Preserving FIFO Output Order via Else If / Else',
    description:
      'Extend the Queue sorter with Else If (heldColor == [Blue]) for Stack 2 and send Green & Yellow express rings straight to OUT in arrival order.',
    hint: 'Keep DEPOT_PLACE inside the Red and Blue branches; place DEPOT_SEND_OUT inside Else!',
    palette: WHILE_4_PALETTE,
    slotCap: {
      perScope: { MAIN: 13 },
      maxTotal: 13,
    },
    depotVariants: WHILE_4_DEPOT_VARIANTS,
    starterWorkspace: makeMainWorkspace(
      [
        { type: 'WHILE', params: { condition: notCond(sensor('stationEmpty', 'QUEUE')) } },
        { type: 'DEPOT_MOVE_TO', params: { station: 'QUEUE' } },
        { type: 'DEPOT_GRAB' },
        { type: 'IF', params: { condition: sensor('heldColor', 'red') } },
        { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_1' } },
        { type: 'DEPOT_PLACE' },
        { type: 'ELSE' },
        { type: 'PLACEHOLDER', params: { hintCategory: 'conditional' } },
        { type: 'END_IF' },
        { type: 'END_WHILE' },
      ],
      'start_while4'
    ),
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeMainWorkspace(
        [
          { type: 'WHILE', params: { condition: notCond(sensor('stationEmpty', 'QUEUE')) } },
          { type: 'DEPOT_MOVE_TO', params: { station: 'QUEUE' } },
          { type: 'DEPOT_GRAB' },
          { type: 'IF', params: { condition: sensor('heldColor', 'red') } },
          { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_1' } },
          { type: 'DEPOT_PLACE' },
          { type: 'ELSE_IF', params: { condition: sensor('heldColor', 'blue') } },
          { type: 'PLACEHOLDER', params: { hintCategory: 'motion' } },
          { type: 'DEPOT_PLACE' },
          { type: 'ELSE' },
          { type: 'PLACEHOLDER', params: { hintCategory: 'item' } },
          { type: 'END_IF' },
          { type: 'END_WHILE' },
        ],
        'scaf_while4'
      ),
    },
    referenceSolution: makeMainWorkspace(
      [
        { type: 'WHILE', params: { condition: notCond(sensor('stationEmpty', 'QUEUE')) } },
        { type: 'DEPOT_MOVE_TO', params: { station: 'QUEUE' } },
        { type: 'DEPOT_GRAB' },
        { type: 'IF', params: { condition: sensor('heldColor', 'red') } },
        { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_1' } },
        { type: 'DEPOT_PLACE' },
        { type: 'ELSE_IF', params: { condition: sensor('heldColor', 'blue') } },
        { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_2' } },
        { type: 'DEPOT_PLACE' },
        { type: 'ELSE' },
        { type: 'DEPOT_SEND_OUT' },
        { type: 'END_IF' },
        { type: 'END_WHILE' },
      ],
      'ref_while4'
    ),
    antiBypassRules: [
      {
        id: 'while.4-starter-must-fail',
        description: 'Unfinished starter ignores Blue and Express rings',
        unmodifiedStarterMustFail: true,
        minStarterEditDistance: 1,
      },
      {
        id: 'while.4-require-else-if',
        description: 'Three distinct destinations require Else If within 13 slots',
        forbidBlocks: ['ELSE_IF'],
      },
    ],
  },

  // =========================================================================
  // while.5 — Switchyard Stream Filter & Route (Main + F1, Switchyard v2)
  // =========================================================================
  {
    id: 'while.5',
    moduleId: 'while',
    version: 1,
    format: 'puzzle',
    simId: 'switchyard',
    icon: '🚂',
    title: 'Train Filter & Route',
    concept: 'Driving a Multi-Car Switchyard Helper Function Inside While (hasNextItem)',
    description:
      'Guard the top If branch in F1 for itemDamaged -> SCRAP_ITEM, then run While (hasNextItem) { CALL F1 } in MAIN to drain all 4 train streams safely.',
    hint: 'MAIN: While (hasNextItem) { CALL F1 } End While. F1 top branch: If (itemDamaged) SCRAP_ITEM.',
    palette: WHILE_5_PALETTE,
    slotCap: {
      perScope: { MAIN: 3, F1: 9 },
      maxTotal: 12,
    },
    switchyardVariants: WHILE_5_SWITCHYARD_VARIANTS,
    starterWorkspace: makeWorkspace(
      {
        MAIN: [],
        F1: [
          { type: 'IF', params: { condition: sensor('hasNextItem') } },
          { type: 'PLACEHOLDER', params: { hintCategory: 'item' } },
          { type: 'ELSE_IF', params: { condition: sensor('itemColor', 'red') } },
          { type: 'SWITCH_LEFT' },
          { type: 'SEND_NEXT' },
          { type: 'ELSE' },
          { type: 'SWITCH_RIGHT' },
          { type: 'SEND_NEXT' },
          { type: 'END_IF' },
        ],
      },
      'start_while5'
    ),
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeWorkspace(
        {
          MAIN: [
            { type: 'WHILE', params: { condition: sensor('hasNextItem') } },
            { type: 'CALL_F1' },
            { type: 'END_WHILE' },
          ],
          F1: [
            { type: 'IF', params: { condition: sensor('itemDamaged') } },
            { type: 'PLACEHOLDER', params: { hintCategory: 'item' } },
            { type: 'ELSE_IF', params: { condition: sensor('itemColor', 'red') } },
            { type: 'SWITCH_LEFT' },
            { type: 'SEND_NEXT' },
            { type: 'ELSE' },
            { type: 'SWITCH_RIGHT' },
            { type: 'SEND_NEXT' },
            { type: 'END_IF' },
          ],
        },
        'scaf_while5'
      ),
    },
    referenceSolution: makeWorkspace(
      {
        MAIN: [
          { type: 'WHILE', params: { condition: sensor('hasNextItem') } },
          { type: 'CALL_F1' },
          { type: 'END_WHILE' },
        ],
        F1: [
          { type: 'IF', params: { condition: sensor('itemDamaged') } },
          { type: 'SCRAP_ITEM' },
          { type: 'ELSE_IF', params: { condition: sensor('itemColor', 'red') } },
          { type: 'SWITCH_LEFT' },
          { type: 'SEND_NEXT' },
          { type: 'ELSE' },
          { type: 'SWITCH_RIGHT' },
          { type: 'SEND_NEXT' },
          { type: 'END_IF' },
        ],
      },
      'ref_while5'
    ),
    antiBypassRules: [
      {
        id: 'while.5-starter-must-fail',
        description: 'Empty MAIN strands all incoming freight cars in the tunnel',
        unmodifiedStarterMustFail: true,
        minStarterEditDistance: 1,
      },
      {
        id: 'while.5-require-scrap',
        description: 'Leading and consecutive damaged cars require SCRAP_ITEM',
        forbidBlocks: ['SCRAP_ITEM'],
      },
    ],
  },

  // =========================================================================
  // while.6 — Adaptive Canvas Bounds (While (insideCanvas)) (Sandbox, Turtle)
  // =========================================================================
  {
    id: 'while.6',
    moduleId: 'while',
    version: 1,
    format: 'sandbox',
    simId: 'turtle',
    icon: '🕸️',
    title: 'Laser Frame Rays',
    concept: 'Boundary-Driven Art With While (insideCanvas) Without Variables or Teleport',
    description:
      'Draw laser webs, lightning zig-zags, and waves that run straight to the dashed sketchbook frame, step 1 stride back inside, and bounce again.',
    hint: 'Right after While (insideCanvas) exits the border, BACKWARD [40] puts the turtle cleanly back inside!',
    palette: WHILE_6_PALETTE,
    turtle: {
      canvasBounds: { halfWidth: 300, halfHeight: 240 },
      showCanvasBounds: true,
    },
    slotCap: {
      perScope: { MAIN: 14, F1: 14, F2: 14 },
      maxTotal: 20,
    },
    starterWorkspace: makeMainWorkspace(
      [
        { type: 'SET_PEN_WIDTH', params: { width: 4 } },
        { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.cyan } },
        { type: 'LOOP_START', repeatCount: 18 },
        { type: 'WHILE', params: { condition: sensor('insideCanvas') } },
        { type: 'FORWARD', params: { length: 40 } },
        { type: 'END_WHILE' },
        { type: 'BACKWARD', params: { length: 40 } },
        { type: 'TURN_RIGHT', params: { angle: 145 } },
        { type: 'LOOP_END' },
      ],
      'start_while6'
    ),
    variations: [
      {
        id: 'while.6-var1-lightning',
        title: 'Electric Lightning Zig-Zag',
        icon: '⚡',
        workspace: makeMainWorkspace(
          [
            { type: 'SET_PEN_WIDTH', params: { width: 6 } },
            { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.amber } },
            { type: 'WHILE', params: { condition: sensor('insideCanvas') } },
            { type: 'FORWARD', params: { length: 55 } },
            { type: 'TURN_RIGHT', params: { angle: 75 } },
            { type: 'FORWARD', params: { length: 55 } },
            { type: 'TURN_LEFT', params: { angle: 75 } },
            { type: 'END_WHILE' },
          ],
          'v1_while6'
        ),
      },
      {
        id: 'while.6-var2-ocean-wave',
        title: 'Ocean Ribbon Wave',
        icon: '🌊',
        workspace: makeMainWorkspace(
          [
            { type: 'SET_PEN_WIDTH', params: { width: 6 } },
            { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.blue } },
            { type: 'TURN_RIGHT', params: { angle: 120 } },
            { type: 'WHILE', params: { condition: sensor('insideCanvas') } },
            { type: 'ARC_LEFT', params: { radius: 45, angle: 120 } },
            { type: 'ARC_RIGHT', params: { radius: 45, angle: 120 } },
            { type: 'END_WHILE' },
          ],
          'v2_while6'
        ),
      },
      {
        id: 'while.6-var3-pinwheel',
        title: 'Rainbow Spiderweb Pinwheel',
        icon: '🎡',
        workspace: makeWorkspace(
          {
            MAIN: [
              { type: 'SET_PEN_WIDTH', params: { width: 4 } },
              { type: 'LOOP_START', repeatCount: 3 },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.red } },
              { type: 'CALL_F1' },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.amber } },
              { type: 'CALL_F1' },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.green } },
              { type: 'CALL_F1' },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.cyan } },
              { type: 'CALL_F1' },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.purple } },
              { type: 'CALL_F1' },
              { type: 'LOOP_END' },
            ],
            F1: [
              { type: 'WHILE', params: { condition: sensor('insideCanvas') } },
              { type: 'FORWARD', params: { length: 40 } },
              { type: 'END_WHILE' },
              { type: 'BACKWARD', params: { length: 40 } },
              { type: 'TURN_RIGHT', params: { angle: 125 } },
            ],
          },
          'v3_while6'
        ),
      },
    ],
  },

  // =========================================================================
  // while.7 — Edge-Runner Light Trails (While (NOT cursorAtEdge)) (Sandbox, Beat)
  // =========================================================================
  {
    id: 'while.7',
    moduleId: 'while',
    version: 1,
    format: 'sandbox',
    simId: 'beat',
    icon: '🟩',
    title: 'Edge-Runner Light Trails',
    concept: 'Border Chasers & Matrix Sweeps With While (NOT cursorAtEdge)',
    description:
      'Drive the Beat cursor along matrix edges and full 64-LED snake sweeps using While (NOT cursorAtEdge), If guards, and the interactive Scene Input selector.',
    hint: 'Loop x4 around While (NOT cursorAtEdge) -> CURSOR_STEP -> TURN [Right] traces all 28 border LEDs with 0 edge bonks.',
    palette: WHILE_7_PALETTE,
    inputConfig: INPUT_1_TO_3,
    beatRules: { cleanResetOnInputChange: true },
    slotCap: {
      perScope: { MAIN: 28, F1: 16, F2: 18 },
    },
    starterWorkspace: makeMainWorkspace(
      [
        { type: 'SET_BEAT_DELAY', params: { delay: 0.25 } },
        { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.cyan } },
        { type: 'LOOP_START', repeatCount: 4 },
        { type: 'WHILE', params: { condition: notCond(sensor('cursorAtEdge')) } },
        { type: 'CURSOR_STEP' },
        { type: 'PLAY_NOTE', params: { pitch: 4, duration: 0.5 } },
        { type: 'END_WHILE' },
        { type: 'CURSOR_TURN', params: { direction: 'RIGHT' } },
        { type: 'LOOP_END' },
      ],
      'start_while7'
    ),
    variations: [
      {
        id: 'while.7-var1-corner-groove',
        title: '4-Color Corner Groove',
        icon: '🎆',
        workspace: makeWorkspace(
          {
            MAIN: [
              { type: 'SET_BEAT_DELAY', params: { delay: 0.25 } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.cyan } },
              { type: 'CALL_F1' },
              { type: 'DRUM_KICK' },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.pink } },
              { type: 'CALL_F1' },
              { type: 'DRUM_SNARE' },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.amber } },
              { type: 'CALL_F1' },
              { type: 'DRUM_CLAP' },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.green } },
              { type: 'CALL_F1' },
              { type: 'PLAY_CHIME' },
            ],
            F1: [
              { type: 'WHILE', params: { condition: notCond(sensor('cursorAtEdge')) } },
              { type: 'CURSOR_STEP' },
              { type: 'PLAY_NOTE', params: { pitch: 5, duration: 0.5 } },
              { type: 'END_WHILE' },
              { type: 'CURSOR_TURN', params: { direction: 'RIGHT' } },
            ],
          },
          'v1_while7'
        ),
      },
      {
        id: 'while.7-var2-snake-sweep',
        title: 'Full-Matrix Snake Sweep',
        icon: '🐍',
        workspace: makeWorkspace(
          {
            MAIN: [
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.purple } },
              { type: 'LIGHT_PIXEL', params: { x: 1, y: 1 } },
              { type: 'LOOP_START', repeatCount: 4 },
              { type: 'CALL_F1' },
              { type: 'CURSOR_TURN', params: { direction: 'RIGHT' } },
              { type: 'CURSOR_STEP' },
              { type: 'CURSOR_TURN', params: { direction: 'RIGHT' } },
              { type: 'CALL_F1' },
              { type: 'CURSOR_TURN', params: { direction: 'LEFT' } },
              { type: 'IF', params: { condition: notCond(sensor('cursorAtEdge')) } },
              { type: 'CURSOR_STEP' },
              { type: 'END_IF' },
              { type: 'CURSOR_TURN', params: { direction: 'LEFT' } },
              { type: 'LOOP_END' },
            ],
            F1: [
              { type: 'WHILE', params: { condition: notCond(sensor('cursorAtEdge')) } },
              { type: 'CURSOR_STEP' },
              { type: 'END_WHILE' },
            ],
          },
          'v2_while7'
        ),
      },
      {
        id: 'while.7-var3-input-studio',
        title: '$input Edge-Runner Studio',
        icon: '🎛️',
        inputConfig: INPUT_1_TO_3,
        workspace: makeWorkspace(
          {
            MAIN: [
              { type: 'SET_BEAT_DELAY', params: { delay: 0.25 } },
              { type: 'IF', params: { condition: inputEq(1) } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.cyan } },
              { type: 'CALL_F1' },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.amber } },
              { type: 'CALL_F1' },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.pink } },
              { type: 'CALL_F1' },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.green } },
              { type: 'CALL_F1' },
              { type: 'ELSE_IF', params: { condition: inputEq(2) } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.blue } },
              { type: 'CALL_F2' },
              { type: 'ELSE' },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.red } },
              { type: 'CALL_F1' },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.purple } },
              { type: 'CALL_F1' },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.black } },
              { type: 'LOOP_START', repeatCount: 2 },
              { type: 'WHILE', params: { condition: notCond(sensor('cursorAtEdge')) } },
              { type: 'CURSOR_STEP' },
              { type: 'DRUM_SNARE' },
              { type: 'END_WHILE' },
              { type: 'CURSOR_TURN', params: { direction: 'RIGHT' } },
              { type: 'LOOP_END' },
              { type: 'END_IF' },
            ],
            F1: [
              { type: 'WHILE', params: { condition: notCond(sensor('cursorAtEdge')) } },
              { type: 'CURSOR_STEP' },
              { type: 'PLAY_NOTE', params: { pitch: 5, duration: 0.5 } },
              { type: 'END_WHILE' },
              { type: 'CURSOR_TURN', params: { direction: 'RIGHT' } },
              { type: 'DRUM_KICK' },
            ],
            F2: [
              { type: 'LIGHT_PIXEL', params: { x: 1, y: 1 } },
              { type: 'LOOP_START', repeatCount: 4 },
              { type: 'WHILE', params: { condition: notCond(sensor('cursorAtEdge')) } },
              { type: 'CURSOR_STEP' },
              { type: 'END_WHILE' },
              { type: 'CURSOR_TURN', params: { direction: 'RIGHT' } },
              { type: 'CURSOR_STEP' },
              { type: 'CURSOR_TURN', params: { direction: 'RIGHT' } },
              { type: 'WHILE', params: { condition: notCond(sensor('cursorAtEdge')) } },
              { type: 'CURSOR_STEP' },
              { type: 'END_WHILE' },
              { type: 'CURSOR_TURN', params: { direction: 'LEFT' } },
              { type: 'IF', params: { condition: notCond(sensor('cursorAtEdge')) } },
              { type: 'CURSOR_STEP' },
              { type: 'END_IF' },
              { type: 'CURSOR_TURN', params: { direction: 'LEFT' } },
              { type: 'LOOP_END' },
            ],
          },
          'v3_while7'
        ),
      },
    ],
  },

  // =========================================================================
  // while.8 — Fix-It Bug Hunt: Premature While Exit (Switchyard v2)
  // =========================================================================
  {
    id: 'while.8',
    moduleId: 'while',
    version: 1,
    format: 'puzzle',
    simId: 'switchyard',
    icon: '🔧',
    title: 'Fix Early While Exit',
    concept: 'Repairing While (itemColor == Red) -> While (hasNextItem) Across 4 Streams',
    description:
      'Stream 1 looks fine only because every car is Red! Step through Stream 2 to spot why Blue stops the loop early, then fix the top While sensor.',
    hint: 'Change just the top While guard from itemColor == [Red] to hasNextItem!',
    palette: WHILE_8_PALETTE,
    slotCap: {
      perScope: { MAIN: 9 },
      maxTotal: 9,
    },
    switchyardVariants: WHILE_8_SWITCHYARD_VARIANTS,
    starterWorkspace: makeMainWorkspace(
      [
        { type: 'WHILE', params: { condition: sensor('itemColor', 'red') } },
        { type: 'IF', params: { condition: sensor('itemColor', 'red') } },
        { type: 'SWITCH_LEFT' },
        { type: 'ELSE' },
        { type: 'SWITCH_RIGHT' },
        { type: 'END_IF' },
        { type: 'SEND_NEXT' },
        { type: 'END_WHILE' },
      ],
      'start_while8'
    ),
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeMainWorkspace(
        [
          { type: 'WHILE', params: { condition: sensor('hasNextItem') } },
          { type: 'IF', params: { condition: sensor('itemColor', 'red') } },
          { type: 'SWITCH_LEFT' },
          { type: 'ELSE' },
          { type: 'PLACEHOLDER', params: { hintCategory: 'motion' } },
          { type: 'END_IF' },
          { type: 'SEND_NEXT' },
          { type: 'END_WHILE' },
        ],
        'scaf_while8'
      ),
    },
    referenceSolution: makeMainWorkspace(
      [
        { type: 'WHILE', params: { condition: sensor('hasNextItem') } },
        { type: 'IF', params: { condition: sensor('itemColor', 'red') } },
        { type: 'SWITCH_LEFT' },
        { type: 'ELSE' },
        { type: 'SWITCH_RIGHT' },
        { type: 'END_IF' },
        { type: 'SEND_NEXT' },
        { type: 'END_WHILE' },
      ],
      'ref_while8'
    ),
    antiBypassRules: [
      {
        id: 'while.8-starter-must-fail',
        description: 'Buggy starter passes Stream 1 (all Red) yet strands cars on Streams 2..4',
        unmodifiedStarterMustFail: true,
        minStarterEditDistance: 1,
      },
      {
        id: 'while.8-require-while',
        description: 'Four mixed-length streams require While conditional repetition within 9 slots',
        forbidBlocks: ['WHILE'],
      },
      {
        id: 'while.8-require-if',
        description: 'Mixed Red and Blue cars require If conditional routing within 9 slots',
        forbidBlocks: ['IF'],
      },
    ],
  },

  // =========================================================================
  // while.A — Capstone: The Autonomous Maze Rover (4 Spanning-Tree Mazes)
  // =========================================================================
  {
    id: 'while.A',
    moduleId: 'while',
    version: 1,
    format: 'capstone',
    capstoneType: 'puzzle',
    simId: 'grid',
    icon: '🧭',
    title: 'Autonomous Maze Rover',
    concept: 'Right-Hand / Left-Hand Wall-Follower Algorithm Across 4 Spanning Mazes',
    description:
      'Solve all 4 distinct 5x5 and 6x6 mazes simultaneously with one 10-block wall follower inside While (NOT atGoal).',
    hint: 'Inside While (NOT atGoal): If (pathRight) TURN_RIGHT, MOVE_FWD; Else If (pathAhead) MOVE_FWD; Else TURN_LEFT! (Mirrored Left-Hand works too.)',
    palette: WHILE_A_PALETTE,
    slotCap: {
      perScope: { MAIN: 12 },
      maxTotal: 12,
    },
    gridVariants: WHILE_A_GRID_VARIANTS,
    starterWorkspace: makeMainWorkspace(
      [
        { type: 'WHILE', params: { condition: notCond(sensor('atGoal')) } },
        { type: 'PLACEHOLDER', params: { hintCategory: 'conditional' } },
        { type: 'END_WHILE' },
      ],
      'start_whileA'
    ),
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeMainWorkspace(
        [
          { type: 'WHILE', params: { condition: notCond(sensor('atGoal')) } },
          { type: 'IF', params: { condition: sensor('pathRight') } },
          { type: 'TURN_RIGHT' },
          { type: 'PLACEHOLDER', params: { hintCategory: 'motion' } },
          { type: 'ELSE_IF', params: { condition: sensor('pathAhead') } },
          { type: 'PLACEHOLDER', params: { hintCategory: 'motion' } },
          { type: 'ELSE' },
          { type: 'PLACEHOLDER', params: { hintCategory: 'turn' } },
          { type: 'END_IF' },
          { type: 'END_WHILE' },
        ],
        'scaf_whileA'
      ),
    },
    referenceSolution: makeMainWorkspace(
      [
        { type: 'WHILE', params: { condition: notCond(sensor('atGoal')) } },
        { type: 'IF', params: { condition: sensor('pathRight') } },
        { type: 'TURN_RIGHT' },
        { type: 'MOVE_FWD' },
        { type: 'ELSE_IF', params: { condition: sensor('pathAhead') } },
        { type: 'MOVE_FWD' },
        { type: 'ELSE' },
        { type: 'TURN_LEFT' },
        { type: 'END_IF' },
        { type: 'END_WHILE' },
      ],
      'ref_whileA'
    ),
    antiBypassRules: [
      {
        id: 'while.A-starter-must-fail',
        description: 'Unfilled starter leaves the rover spinning on the start tile',
        unmodifiedStarterMustFail: true,
        minStarterEditDistance: 1,
      },
      {
        id: 'while.A-require-while-across-mazes',
        description: 'No loop-free program solves all 4 distinct mazes within 12 slots',
        forbidBlocks: ['WHILE'],
        maxLoopNestingDepth: 0,
      },
    ],
  },

  // =========================================================================
  // while.B — Creative Capstone: Laser Frame & Wave Gallery (Turtle)
  // =========================================================================
  {
    id: 'while.B',
    moduleId: 'while',
    version: 1,
    format: 'capstone',
    capstoneType: 'creative',
    simId: 'turtle',
    icon: '🎨',
    title: 'Laser & Wave Gallery',
    concept: 'Synthesizing While (insideCanvas), Return-Inside Loops, F1-F3 & $input',
    description:
      'Compose multi-ray starbursts and wave sunsets anchored to the dashed art frame, plus a 4-mode Scene Input laser gallery.',
    hint: 'Use While (NOT insideCanvas) { BACKWARD [45] } after wide curved waves so the turtle returns safely inside bounds!',
    palette: WHILE_B_PALETTE,
    turtle: {
      canvasBounds: { halfWidth: 300, halfHeight: 240 },
      showCanvasBounds: true,
    },
    inputConfig: INPUT_1_TO_4,
    slotCap: {
      perScope: { MAIN: 26, F1: 14, F2: 14, F3: 14 },
    },
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          { type: 'SET_PEN_WIDTH', params: { width: 4 } },
          { type: 'LOOP_START', repeatCount: 8 },
          { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.cyan } },
          { type: 'CALL_F1' },
          { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.pink } },
          { type: 'CALL_F1' },
          { type: 'LOOP_END' },
        ],
        F1: [
          { type: 'WHILE', params: { condition: sensor('insideCanvas') } },
          { type: 'FORWARD', params: { length: 45 } },
          { type: 'END_WHILE' },
          { type: 'BACKWARD', params: { length: 45 } },
          { type: 'TURN_RIGHT', params: { angle: 145 } },
        ],
      },
      'start_whileB'
    ),
    variations: [
      {
        id: 'while.B-var1-starburst',
        title: 'Neon Starburst Frame (155°)',
        icon: '✨',
        workspace: makeWorkspace(
          {
            MAIN: [
              { type: 'SET_PEN_WIDTH', params: { width: 3 } },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.amber } },
              { type: 'LOOP_START', repeatCount: 24 },
              { type: 'CALL_F1' },
              { type: 'LOOP_END' },
            ],
            F1: [
              { type: 'WHILE', params: { condition: sensor('insideCanvas') } },
              { type: 'FORWARD', params: { length: 45 } },
              { type: 'END_WHILE' },
              { type: 'BACKWARD', params: { length: 45 } },
              { type: 'TURN_RIGHT', params: { angle: 155 } },
            ],
          },
          'v1_whileB'
        ),
      },
      {
        id: 'while.B-var2-sunset-waves',
        title: 'Double-Wave Sunset',
        icon: '🌅',
        workspace: makeWorkspace(
          {
            MAIN: [
              { type: 'SET_PEN_WIDTH', params: { width: 5 } },
              { type: 'LOOP_START', repeatCount: 4 },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.amber } },
              { type: 'CALL_F1' },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.pink } },
              { type: 'CALL_F1' },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.purple } },
              { type: 'CALL_F1' },
              { type: 'LOOP_END' },
            ],
            F1: [
              { type: 'WHILE', params: { condition: sensor('insideCanvas') } },
              { type: 'ARC_LEFT', params: { radius: 40, angle: 110 } },
              { type: 'ARC_RIGHT', params: { radius: 40, angle: 110 } },
              { type: 'END_WHILE' },
              { type: 'TURN_LEFT', params: { angle: 55 } },
              { type: 'WHILE', params: { condition: notCond(sensor('insideCanvas')) } },
              { type: 'BACKWARD', params: { length: 45 } },
              { type: 'END_WHILE' },
              { type: 'TURN_RIGHT', params: { angle: 195 } },
            ],
          },
          'v2_whileB'
        ),
      },
      {
        id: 'while.B-var3-input-studio',
        title: '$input Frame Studio (1..4)',
        icon: '🎛️',
        inputConfig: INPUT_1_TO_4,
        workspace: makeWorkspace(
          {
            MAIN: [
              { type: 'SET_PEN_WIDTH', params: { width: 4 } },
              { type: 'IF', params: { condition: inputEq(1) } },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.cyan } },
              { type: 'LOOP_START', repeatCount: 16 },
              { type: 'CALL_F1' },
              { type: 'LOOP_END' },
              { type: 'ELSE_IF', params: { condition: inputEq(2) } },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.amber } },
              { type: 'LOOP_START', repeatCount: 10 },
              { type: 'CALL_F2' },
              { type: 'LOOP_END' },
              { type: 'ELSE_IF', params: { condition: inputEq(3) } },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.pink } },
              { type: 'LOOP_START', repeatCount: 10 },
              { type: 'CALL_F3' },
              { type: 'LOOP_END' },
              { type: 'ELSE' },
              { type: 'LOOP_START', repeatCount: 6 },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.cyan } },
              { type: 'CALL_F1' },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.pink } },
              { type: 'CALL_F3' },
              { type: 'LOOP_END' },
              { type: 'END_IF' },
            ],
            F1: [
              { type: 'WHILE', params: { condition: sensor('insideCanvas') } },
              { type: 'FORWARD', params: { length: 45 } },
              { type: 'END_WHILE' },
              { type: 'BACKWARD', params: { length: 45 } },
              { type: 'TURN_RIGHT', params: { angle: 145 } },
            ],
            F2: [
              { type: 'WHILE', params: { condition: sensor('insideCanvas') } },
              { type: 'FORWARD', params: { length: 45 } },
              { type: 'TURN_RIGHT', params: { angle: 60 } },
              { type: 'FORWARD', params: { length: 45 } },
              { type: 'TURN_LEFT', params: { angle: 60 } },
              { type: 'END_WHILE' },
              { type: 'TURN_RIGHT', params: { angle: 30 } },
              { type: 'WHILE', params: { condition: notCond(sensor('insideCanvas')) } },
              { type: 'BACKWARD', params: { length: 45 } },
              { type: 'END_WHILE' },
              { type: 'TURN_RIGHT', params: { angle: 115 } },
            ],
            F3: [
              { type: 'WHILE', params: { condition: sensor('insideCanvas') } },
              { type: 'ARC_LEFT', params: { radius: 40, angle: 110 } },
              { type: 'ARC_RIGHT', params: { radius: 40, angle: 110 } },
              { type: 'END_WHILE' },
              { type: 'TURN_LEFT', params: { angle: 55 } },
              { type: 'WHILE', params: { condition: notCond(sensor('insideCanvas')) } },
              { type: 'BACKWARD', params: { length: 45 } },
              { type: 'END_WHILE' },
              { type: 'TURN_RIGHT', params: { angle: 195 } },
            ],
          },
          'v3_whileB'
        ),
      },
    ],
  },

  // =========================================================================
  // while.C — Creative Capstone: Edge-Runner Light & Beat Show (Beat)
  // =========================================================================
  {
    id: 'while.C',
    moduleId: 'while',
    version: 1,
    format: 'capstone',
    capstoneType: 'creative',
    simId: 'beat',
    icon: '🎹',
    title: 'Edge-Runner Light Show',
    concept: 'Synthesizing Cursor Border Loops, Selective Black Erase & $input',
    description:
      'Combine edge-to-edge cursor loops, rainbow snake sweeps, Black (8) Erase wipes, and a 4-mode Scene Input light-and-drum showcase.',
    hint: 'Switch active LED color to Black (⊘) before calling a border sweep to carve clean glowing frames.',
    palette: WHILE_C_PALETTE,
    inputConfig: INPUT_1_TO_4,
    beatRules: { cleanResetOnInputChange: true },
    slotCap: {
      perScope: { MAIN: 28, F1: 16, F2: 18, F3: 16 },
    },
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          { type: 'SET_BEAT_DELAY', params: { delay: 0.25 } },
          { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.cyan } },
          { type: 'LOOP_START', repeatCount: 4 },
          { type: 'CALL_F1' },
          { type: 'LOOP_END' },
          { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.black } },
          { type: 'LOOP_START', repeatCount: 4 },
          { type: 'CALL_F2' },
          { type: 'LOOP_END' },
        ],
        F1: [
          { type: 'WHILE', params: { condition: notCond(sensor('cursorAtEdge')) } },
          { type: 'CURSOR_STEP' },
          { type: 'PLAY_NOTE', params: { pitch: 4, duration: 0.5 } },
          { type: 'END_WHILE' },
          { type: 'CURSOR_TURN', params: { direction: 'RIGHT' } },
          { type: 'PLAY_CHIME' },
        ],
        F2: [
          { type: 'WHILE', params: { condition: notCond(sensor('cursorAtEdge')) } },
          { type: 'CURSOR_STEP' },
          { type: 'END_WHILE' },
          { type: 'CURSOR_TURN', params: { direction: 'RIGHT' } },
        ],
      },
      'start_whileC'
    ),
    variations: [
      {
        id: 'while.C-var1-checker-chase',
        title: 'Dual-Color Checker Chase',
        icon: '💠',
        workspace: makeWorkspace(
          {
            MAIN: [
              { type: 'SET_BEAT_DELAY', params: { delay: 0.25 } },
              { type: 'LOOP_START', repeatCount: 4 },
              { type: 'CALL_F1' },
              { type: 'LOOP_END' },
            ],
            F1: [
              { type: 'WHILE', params: { condition: notCond(sensor('cursorAtEdge')) } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.pink } },
              { type: 'CURSOR_STEP' },
              { type: 'PLAY_NOTE', params: { pitch: 5, duration: 0.5 } },
              { type: 'IF', params: { condition: notCond(sensor('cursorAtEdge')) } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.cyan } },
              { type: 'CURSOR_STEP' },
              { type: 'PLAY_NOTE', params: { pitch: 7, duration: 0.5 } },
              { type: 'END_IF' },
              { type: 'END_WHILE' },
              { type: 'CURSOR_TURN', params: { direction: 'RIGHT' } },
              { type: 'DRUM_KICK' },
            ],
          },
          'v1_whileC'
        ),
      },
      {
        id: 'while.C-var2-rainbow-disco',
        title: 'Full-Pad Rainbow Snake Disco',
        icon: '🌈',
        workspace: makeWorkspace(
          {
            MAIN: [
              { type: 'SET_BEAT_DELAY', params: { delay: 0.25 } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.red } },
              { type: 'LIGHT_PIXEL', params: { x: 1, y: 1 } },
              { type: 'CALL_F1' },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.amber } },
              { type: 'CALL_F2' },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.green } },
              { type: 'CALL_F1' },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.cyan } },
              { type: 'CALL_F2' },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.blue } },
              { type: 'CALL_F1' },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.purple } },
              { type: 'CALL_F2' },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.pink } },
              { type: 'CALL_F1' },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.amber } },
              { type: 'CALL_F2' },
            ],
            F1: [
              { type: 'WHILE', params: { condition: notCond(sensor('cursorAtEdge')) } },
              { type: 'CURSOR_STEP' },
              { type: 'PLAY_NOTE', params: { pitch: 5, duration: 0.5 } },
              { type: 'END_WHILE' },
              { type: 'CURSOR_TURN', params: { direction: 'RIGHT' } },
              { type: 'CURSOR_STEP' },
              { type: 'DRUM_KICK' },
              { type: 'CURSOR_TURN', params: { direction: 'RIGHT' } },
            ],
            F2: [
              { type: 'WHILE', params: { condition: notCond(sensor('cursorAtEdge')) } },
              { type: 'CURSOR_STEP' },
              { type: 'PLAY_NOTE', params: { pitch: 6, duration: 0.5 } },
              { type: 'END_WHILE' },
              { type: 'CURSOR_TURN', params: { direction: 'LEFT' } },
              { type: 'IF', params: { condition: notCond(sensor('cursorAtEdge')) } },
              { type: 'CURSOR_STEP' },
              { type: 'DRUM_SNARE' },
              { type: 'END_IF' },
              { type: 'CURSOR_TURN', params: { direction: 'LEFT' } },
            ],
          },
          'v2_whileC'
        ),
      },
      {
        id: 'while.C-var3-groove-pad',
        title: '$input Adaptive Groove Pad (1..4)',
        icon: '🎛️',
        inputConfig: INPUT_1_TO_4,
        workspace: makeWorkspace(
          {
            MAIN: [
              { type: 'SET_BEAT_DELAY', params: { delay: 0.25 } },
              { type: 'IF', params: { condition: inputEq(1) } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.cyan } },
              { type: 'LOOP_START', repeatCount: 4 },
              { type: 'CALL_F1' },
              { type: 'LOOP_END' },
              { type: 'ELSE_IF', params: { condition: inputEq(2) } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.amber } },
              { type: 'LIGHT_PIXEL', params: { x: 1, y: 1 } },
              { type: 'CALL_F2' },
              { type: 'ELSE_IF', params: { condition: inputEq(3) } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.pink } },
              { type: 'CALL_F1' },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.cyan } },
              { type: 'CALL_F1' },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.amber } },
              { type: 'CALL_F1' },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.green } },
              { type: 'CALL_F1' },
              { type: 'ELSE' },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.purple } },
              { type: 'LIGHT_PIXEL', params: { x: 1, y: 1 } },
              { type: 'CALL_F2' },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.black } },
              { type: 'LOOP_START', repeatCount: 4 },
              { type: 'CALL_F3' },
              { type: 'LOOP_END' },
              { type: 'END_IF' },
            ],
            F1: [
              { type: 'WHILE', params: { condition: notCond(sensor('cursorAtEdge')) } },
              { type: 'CURSOR_STEP' },
              { type: 'PLAY_NOTE', params: { pitch: 5, duration: 0.5 } },
              { type: 'END_WHILE' },
              { type: 'CURSOR_TURN', params: { direction: 'RIGHT' } },
              { type: 'DRUM_KICK' },
            ],
            F2: [
              { type: 'LOOP_START', repeatCount: 4 },
              { type: 'WHILE', params: { condition: notCond(sensor('cursorAtEdge')) } },
              { type: 'CURSOR_STEP' },
              { type: 'END_WHILE' },
              { type: 'CURSOR_TURN', params: { direction: 'RIGHT' } },
              { type: 'CURSOR_STEP' },
              { type: 'CURSOR_TURN', params: { direction: 'RIGHT' } },
              { type: 'WHILE', params: { condition: notCond(sensor('cursorAtEdge')) } },
              { type: 'CURSOR_STEP' },
              { type: 'END_WHILE' },
              { type: 'CURSOR_TURN', params: { direction: 'LEFT' } },
              { type: 'IF', params: { condition: notCond(sensor('cursorAtEdge')) } },
              { type: 'CURSOR_STEP' },
              { type: 'END_IF' },
              { type: 'CURSOR_TURN', params: { direction: 'LEFT' } },
              { type: 'LOOP_END' },
            ],
            F3: [
              { type: 'WHILE', params: { condition: notCond(sensor('cursorAtEdge')) } },
              { type: 'CURSOR_STEP' },
              { type: 'DRUM_SNARE' },
              { type: 'END_WHILE' },
              { type: 'CURSOR_TURN', params: { direction: 'LEFT' } },
            ],
          },
          'v3_whileC'
        ),
      },
    ],
  },
];
