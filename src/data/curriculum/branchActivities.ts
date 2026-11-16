import { CellCoord, CodeBlock, ScopeType, WallEdge, WorkspaceState } from '../../types';
import {
  ActivityFormat,
  AntiBypassRule,
  ConditionCompareOp,
  ConditionExpr,
  ConditionSensorType,
  CurriculumActivity,
  CurriculumBeaconTile,
  CurriculumGridDefinition,
  CurriculumSwitchyardDefinition,
  PaletteConfig,
  PartialHelpConfig,
  SceneInputConfig,
  SwitchyardColor,
  SwitchyardDockDef,
  SwitchyardIcon,
  SwitchyardItemDef,
  createCurriculumBlock,
} from './types';

// ---------------------------------------------------------------------------
// Local Authoring Helpers (deterministic, flat explicit closers)
// ---------------------------------------------------------------------------

interface BlockSpec {
  type: string;
  repeatCount?: number;
  params?: Record<string, unknown>;
}

const ALL_SCOPES: readonly ScopeType[] = ['MAIN', 'F1', 'F2', 'F3'];

function makeWorkspace(
  scopes: Partial<Record<ScopeType, BlockSpec[]>>,
  idPrefix: string
): WorkspaceState {
  const result: WorkspaceState = { MAIN: [], F1: [], F2: [], F3: [] };
  for (const scope of ALL_SCOPES) {
    const specs = scopes[scope];
    if (specs && specs.length > 0) {
      result[scope] = specs.map((spec, idx) =>
        createCurriculumBlock(
          spec.type,
          spec.repeatCount,
          spec.params,
          `${idPrefix}_${scope.toLowerCase()}${idx}`
        )
      );
    }
  }
  return result;
}

function condSensor(sensor: ConditionSensorType, param?: string): ConditionExpr {
  return param !== undefined ? { kind: 'sensor', sensor, param } : { kind: 'sensor', sensor };
}

function condNot(operand: ConditionExpr): ConditionExpr {
  return { kind: 'not', operand };
}

function condAnd(left: ConditionExpr, right: ConditionExpr): ConditionExpr {
  return { kind: 'and', left, right };
}

function condOr(left: ConditionExpr, right: ConditionExpr): ConditionExpr {
  return { kind: 'or', left, right };
}

function condCmp(op: ConditionCompareOp, left: string | number, right: string | number): ConditionExpr {
  return { kind: 'cmp', op, left, right };
}

function ifBlock(condition: ConditionExpr): BlockSpec {
  return { type: 'IF', params: { condition } };
}

function elseIfBlock(condition: ConditionExpr): BlockSpec {
  return { type: 'ELSE_IF', params: { condition } };
}

function placeholderBlock(hintCategory: string): BlockSpec {
  return { type: 'PLACEHOLDER', params: { hintCategory } };
}

function swLeft(junction?: 'A' | 'B'): BlockSpec {
  return junction ? { type: 'SWITCH_LEFT', params: { junction } } : { type: 'SWITCH_LEFT' };
}

function swRight(junction?: 'A' | 'B'): BlockSpec {
  return junction ? { type: 'SWITCH_RIGHT', params: { junction } } : { type: 'SWITCH_RIGHT' };
}

/**
 * Seals every interior cell boundary on a `width x height` grid except passages
 * between consecutive open corridor cells (or any pair of orthogonally adjacent open cells).
 */
function buildSealedGridBarriers(
  width: number,
  height: number,
  openCells: readonly CellCoord[]
): WallEdge[] {
  const openSet = new Set(openCells.map((c) => `${c.x},${c.y}`));
  const barriers: WallEdge[] = [];

  for (let y = 1; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!(openSet.has(`${x},${y - 1}`) && openSet.has(`${x},${y}`))) {
        barriers.push({ orientation: 'H', x, y });
      }
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 1; x < width; x++) {
      if (!(openSet.has(`${x - 1},${y}`) && openSet.has(`${x},${y}`))) {
        barriers.push({ orientation: 'V', x, y });
      }
    }
  }
  return barriers;
}

function makeSyItem(
  id: string,
  color: SwitchyardColor,
  icon: SwitchyardIcon,
  damaged = false
): SwitchyardItemDef {
  return damaged ? { id, color, icon, damaged: true } : { id, color, icon };
}

function makeSingleSwitchYard(
  label: string,
  incomingStream: SwitchyardItemDef[],
  dockA: Omit<SwitchyardDockDef, 'id'>,
  dockB: Omit<SwitchyardDockDef, 'id'>,
  extra?: Partial<CurriculumSwitchyardDefinition>
): CurriculumSwitchyardDefinition {
  return {
    label,
    incomingStream,
    switches: [
      {
        id: 'A',
        label: 'A',
        initialDirection: 'left',
        leftTarget: 'DOCK_A',
        rightTarget: 'DOCK_B',
      },
    ],
    docks: [
      { id: 'DOCK_A', label: '↙', ...dockA },
      { id: 'DOCK_B', label: '↘', ...dockB },
    ],
    mode: 'sort',
    ...extra,
  };
}

function makeTwoSwitchYard(
  label: string,
  incomingStream: SwitchyardItemDef[],
  docks: SwitchyardDockDef[],
  extra?: Partial<CurriculumSwitchyardDefinition>
): CurriculumSwitchyardDefinition {
  return {
    label,
    incomingStream,
    switches: [
      {
        id: 'A',
        label: 'A',
        initialDirection: 'left',
        leftTarget: 'DOCK_A',
        rightTarget: 'B',
      },
      {
        id: 'B',
        label: 'B',
        initialDirection: 'left',
        leftTarget: 'DOCK_B',
        rightTarget: 'DOCK_C',
      },
    ],
    docks,
    mode: 'priority',
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Palette Color & Preset Constants (aligned with environment serializers)
// ---------------------------------------------------------------------------

const TURTLE_COLORS = {
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
} as const;

const BEAT_COLORS = {
  cyan: '#06b6d4',
  red: '#f43f5e',
  amber: '#fbbf24',
  green: '#10b981',
  purple: '#a855f7',
  blue: '#3b82f6',
  orange: '#f97316',
  pink: '#ec4899',
  black: '#0f172a',
  white: '#ffffff',
} as const;

const BEAT_PRESETS = [
  'HEART',
  'STAR',
  'SMILE',
  'NOTE',
  'BOLT',
  'DIAMOND',
  'CHECK',
  'ROBOT',
] as const;

function beatPresetName(index: number): string {
  return BEAT_PRESETS[index] ?? 'HEART';
}

const BRANCH_TURTLE_PARAMS: Record<string, string[]> = {
  FORWARD: ['length'],
  BACKWARD: ['length'],
  TURN_LEFT: ['angle'],
  TURN_RIGHT: ['angle'],
  ARC_LEFT: ['radius', 'angle'],
  ARC_RIGHT: ['radius', 'angle'],
  SET_PEN_COLOR: ['color'],
  SET_PEN_WIDTH: ['width'],
};

const BRANCH_BEAT_PARAMS: Record<string, string[]> = {
  PLAY_NOTE: ['pitch', 'duration'],
  STAMP_PRESET: ['preset'],
  SET_LED_COLOR: ['color'],
  SET_BEAT_DELAY: ['delay'],
  LIGHT_PIXEL: ['x', 'y'],
  WAIT_BEAT: ['duration'],
};

const BRANCH_TURTLE_ALLOWED_BLOCKS: string[] = [
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

const BRANCH_BEAT_ALLOWED_BLOCKS: string[] = [
  'PLAY_NOTE',
  'WAIT_BEAT',
  'LIGHT_PIXEL',
  'SET_LED_COLOR',
  'STAMP_PRESET',
  'CLEAR_LEDS',
  'SET_BEAT_DELAY',
];

const SWITCHYARD_JUNCTION_PARAMS: Record<string, string[]> = {
  SWITCH_LEFT: ['junction'],
  SWITCH_RIGHT: ['junction'],
};

// ---------------------------------------------------------------------------
// Activity Grids, Switchyards & Demo Tabs
// ---------------------------------------------------------------------------

// branch.0 — Sensors & If Multi-Map Demo (6x1, itemHere)
const BRANCH_0_GRID_1: CurriculumGridDefinition = {
  label: '1',
  width: 6,
  height: 1,
  robot: { x: 0, y: 0, dir: 'EAST' },
  barriers: [],
  worldItems: [{ id: 'gem_b0_m1', type: 'crate', x: 3, y: 0 }],
  flags: [{ id: 'goal_b0_m1', x: 5, y: 0, isGoal: true, order: 1, collected: false }],
  requireAllItemsCollected: true,
  requireEmptyBackpackAtGoal: false,
  strictInteractionCollision: true,
};

const BRANCH_0_GRID_2: CurriculumGridDefinition = {
  label: '2',
  width: 6,
  height: 1,
  robot: { x: 0, y: 0, dir: 'EAST' },
  barriers: [],
  worldItems: [{ id: 'gem_b0_m2', type: 'crate', x: 1, y: 0 }],
  flags: [{ id: 'goal_b0_m2', x: 5, y: 0, isGoal: true, order: 1, collected: false }],
  requireAllItemsCollected: true,
  requireEmptyBackpackAtGoal: false,
  strictInteractionCollision: true,
};

const BRANCH_0_DEMO_WS = makeWorkspace(
  {
    MAIN: [
      { type: 'LOOP_START', repeatCount: 5 },
      { type: 'MOVE_FWD' },
      ifBlock(condSensor('itemHere')),
      { type: 'PICK_UP' },
      { type: 'END_IF' },
      { type: 'LOOP_END' },
    ],
  },
  'demo_b0'
);

// branch.1 — Sensing & Simple If (3 variants, 6x1)
const BRANCH_1_GRIDS: CurriculumGridDefinition[] = [2, 4, 1].map((starX, idx) => ({
  label: `${idx + 1}`,
  width: 6,
  height: 1,
  robot: { x: 0, y: 0, dir: 'EAST' },
  barriers: [],
  worldItems: [{ id: `star_b1_v${idx + 1}`, type: 'crate', x: starX, y: 0 }],
  flags: [{ id: `goal_b1_v${idx + 1}`, x: 5, y: 0, isGoal: true, order: 1, collected: false }],
  requireAllItemsCollected: true,
  requireEmptyBackpackAtGoal: false,
  strictInteractionCollision: true,
}));

// branch.2 — Meet the Switchyard (2 tabs, N=4)
const BRANCH_2_SY_1 = makeSingleSwitchYard(
  '1',
  [
    makeSyItem('b2_t1_1', 'red', 'crate'),
    makeSyItem('b2_t1_2', 'blue', 'crate'),
    makeSyItem('b2_t1_3', 'red', 'crate'),
    makeSyItem('b2_t1_4', 'blue', 'crate'),
  ],
  { expectedColor: 'blue', quota: 2, acceptsDamaged: false },
  { expectedColor: 'red', quota: 2, acceptsDamaged: false }
);

const BRANCH_2_SY_2 = makeSingleSwitchYard(
  '2',
  [
    makeSyItem('b2_t2_1', 'blue', 'crate'),
    makeSyItem('b2_t2_2', 'blue', 'crate'),
    makeSyItem('b2_t2_3', 'red', 'crate'),
    makeSyItem('b2_t2_4', 'blue', 'crate'),
  ],
  { expectedColor: 'blue', quota: 3, acceptsDamaged: false },
  { expectedColor: 'red', quota: 1, acceptsDamaged: false }
);

// branch.3 — Switchyard Warmup: Emblem Routing (3 variants, N=4)
const BRANCH_3_SY_VARIANTS: CurriculumSwitchyardDefinition[] = [
  makeSingleSwitchYard(
    '1',
    [
      makeSyItem('b3_v1_1', 'red', 'gear'),
      makeSyItem('b3_v1_2', 'blue', 'crate'),
      makeSyItem('b3_v1_3', 'amber', 'gear'),
      makeSyItem('b3_v1_4', 'red', 'crate'),
    ],
    { expectedIcon: 'gear', quota: 2, acceptsDamaged: false },
    { expectedIcon: 'crate', quota: 2, acceptsDamaged: false }
  ),
  makeSingleSwitchYard(
    '2',
    [
      makeSyItem('b3_v2_1', 'red', 'crate'),
      makeSyItem('b3_v2_2', 'blue', 'crate'),
      makeSyItem('b3_v2_3', 'blue', 'gear'),
      makeSyItem('b3_v2_4', 'green', 'gear'),
    ],
    { expectedIcon: 'gear', quota: 2, acceptsDamaged: false },
    { expectedIcon: 'crate', quota: 2, acceptsDamaged: false }
  ),
  makeSingleSwitchYard(
    '3',
    [
      makeSyItem('b3_v3_1', 'blue', 'gear'),
      makeSyItem('b3_v3_2', 'red', 'gear'),
      makeSyItem('b3_v3_3', 'amber', 'gear'),
      makeSyItem('b3_v3_4', 'blue', 'crate'),
    ],
    { expectedIcon: 'gear', quota: 3, acceptsDamaged: false },
    { expectedIcon: 'crate', quota: 1, acceptsDamaged: false }
  ),
];

// branch.4 — Meet Else & SCRAP_ITEM Debut (Grid 3x3 crossroad + Switchyard N=4)
const BRANCH_4_GRID_BLUE: CurriculumGridDefinition = {
  label: '1',
  width: 3,
  height: 3,
  robot: { x: 0, y: 1, dir: 'EAST' },
  barriers: buildSealedGridBarriers(3, 3, [
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: 0 },
  ]),
  beaconTiles: [{ x: 1, y: 1, color: 'blue', label: '🔵' }],
  flags: [{ id: 'goal_b4_v1', x: 1, y: 0, isGoal: true, order: 1, collected: false }],
  requireAllItemsCollected: false,
  requireEmptyBackpackAtGoal: false,
  strictInteractionCollision: true,
};

const BRANCH_4_GRID_RED: CurriculumGridDefinition = {
  label: '2',
  width: 3,
  height: 3,
  robot: { x: 0, y: 1, dir: 'EAST' },
  barriers: buildSealedGridBarriers(3, 3, [
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: 2 },
  ]),
  beaconTiles: [{ x: 1, y: 1, color: 'red', label: '🔴' }],
  flags: [{ id: 'goal_b4_v2', x: 1, y: 2, isGoal: true, order: 1, collected: false }],
  requireAllItemsCollected: false,
  requireEmptyBackpackAtGoal: false,
  strictInteractionCollision: true,
};

const BRANCH_4_GRID_WS = makeWorkspace(
  {
    MAIN: [
      { type: 'MOVE_FWD' },
      ifBlock(condSensor('tileColor', 'blue')),
      { type: 'TURN_LEFT' },
      { type: 'ELSE' },
      { type: 'TURN_RIGHT' },
      { type: 'END_IF' },
      { type: 'MOVE_FWD' },
    ],
  },
  'demo_b4_grid'
);

const BRANCH_4_SY = makeSingleSwitchYard(
  '3',
  [
    makeSyItem('b4_sy_1', 'blue', 'crate', false),
    makeSyItem('b4_sy_2', 'red', 'crate', true),
    makeSyItem('b4_sy_3', 'amber', 'battery', false),
    makeSyItem('b4_sy_4', 'green', 'gear', true),
  ],
  { quota: 2, acceptsDamaged: false },
  { quota: 0, acceptsDamaged: false },
  {
    scrapChute: { label: '💥', expectedDamagedOnly: true, expectedCount: 2 },
    scrapRules: 'damaged',
  }
);

// branch.5 — Binary If/Else Icon Sorting (3 variants, N=5)
const BRANCH_5_SY_VARIANTS: CurriculumSwitchyardDefinition[] = [
  makeSingleSwitchYard(
    '1',
    [
      makeSyItem('b5_v1_1', 'amber', 'battery'),
      makeSyItem('b5_v1_2', 'blue', 'crate'),
      makeSyItem('b5_v1_3', 'red', 'gear'),
      makeSyItem('b5_v1_4', 'green', 'battery'),
      makeSyItem('b5_v1_5', 'purple', 'crystal'),
    ],
    { expectedIcon: 'battery', quota: 2, acceptsDamaged: false },
    {
      expectedItems: [{ icon: 'crate' }, { icon: 'gear' }, { icon: 'crystal' }],
      quota: 3,
      acceptsDamaged: false,
    }
  ),
  makeSingleSwitchYard(
    '2',
    [
      makeSyItem('b5_v2_1', 'red', 'crate'),
      makeSyItem('b5_v2_2', 'blue', 'crystal'),
      makeSyItem('b5_v2_3', 'blue', 'battery'),
      makeSyItem('b5_v2_4', 'amber', 'gear'),
      makeSyItem('b5_v2_5', 'red', 'battery'),
    ],
    { expectedIcon: 'battery', quota: 2, acceptsDamaged: false },
    {
      expectedItems: [{ icon: 'crate' }, { icon: 'gear' }, { icon: 'crystal' }],
      quota: 3,
      acceptsDamaged: false,
    }
  ),
  makeSingleSwitchYard(
    '3',
    [
      makeSyItem('b5_v3_1', 'blue', 'battery'),
      makeSyItem('b5_v3_2', 'red', 'battery'),
      makeSyItem('b5_v3_3', 'green', 'crate'),
      makeSyItem('b5_v3_4', 'purple', 'battery'),
      makeSyItem('b5_v3_5', 'blue', 'gear'),
    ],
    { expectedIcon: 'battery', quota: 3, acceptsDamaged: false },
    {
      expectedItems: [{ icon: 'crate' }, { icon: 'gear' }, { icon: 'crystal' }],
      quota: 2,
      acceptsDamaged: false,
    }
  ),
];

// branch.5a — Hazard Filtering (itemDamaged + SCRAP_ITEM, 3 variants, N=5)
const BRANCH_5A_SY_VARIANTS: CurriculumSwitchyardDefinition[] = [
  makeSingleSwitchYard(
    '1',
    [
      makeSyItem('b5a_v1_1', 'blue', 'crystal', false),
      makeSyItem('b5a_v1_2', 'blue', 'crystal', true),
      makeSyItem('b5a_v1_3', 'amber', 'crate', false),
      makeSyItem('b5a_v1_4', 'amber', 'crate', true),
      makeSyItem('b5a_v1_5', 'green', 'crystal', false),
    ],
    { expectedIcon: 'crystal', quota: 2, acceptsDamaged: false },
    { expectedIcon: 'crate', quota: 1, acceptsDamaged: false },
    {
      scrapChute: { label: '💥', expectedDamagedOnly: true, expectedCount: 2 },
      scrapRules: 'damaged',
    }
  ),
  makeSingleSwitchYard(
    '2',
    [
      makeSyItem('b5a_v2_1', 'red', 'crate', true),
      makeSyItem('b5a_v2_2', 'blue', 'crystal', true),
      makeSyItem('b5a_v2_3', 'amber', 'crate', false),
      makeSyItem('b5a_v2_4', 'blue', 'crystal', false),
      makeSyItem('b5a_v2_5', 'green', 'crate', false),
    ],
    { expectedIcon: 'crystal', quota: 1, acceptsDamaged: false },
    { expectedIcon: 'crate', quota: 2, acceptsDamaged: false },
    {
      scrapChute: { label: '💥', expectedDamagedOnly: true, expectedCount: 2 },
      scrapRules: 'damaged',
    }
  ),
  makeSingleSwitchYard(
    '3',
    [
      makeSyItem('b5a_v3_1', 'red', 'crystal', true),
      makeSyItem('b5a_v3_2', 'blue', 'crate', false),
      makeSyItem('b5a_v3_3', 'green', 'crystal', false),
      makeSyItem('b5a_v3_4', 'amber', 'crate', true),
      makeSyItem('b5a_v3_5', 'blue', 'crystal', true),
    ],
    { expectedIcon: 'crystal', quota: 1, acceptsDamaged: false },
    { expectedIcon: 'crate', quota: 1, acceptsDamaged: false },
    {
      scrapChute: { label: '💥', expectedDamagedOnly: true, expectedCount: 3 },
      scrapRules: 'damaged',
    }
  ),
];

// branch.6 — Spatial Directional Sensors Demo (3x3 T-Junction)
const BRANCH_6_GRID_NORTH: CurriculumGridDefinition = {
  label: '1',
  width: 3,
  height: 3,
  robot: { x: 0, y: 1, dir: 'EAST' },
  barriers: buildSealedGridBarriers(3, 3, [
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: 0 },
  ]),
  flags: [{ id: 'goal_b6_m1', x: 1, y: 0, isGoal: true, order: 1, collected: false }],
  requireAllItemsCollected: false,
  requireEmptyBackpackAtGoal: false,
  strictInteractionCollision: true,
};

const BRANCH_6_GRID_SOUTH: CurriculumGridDefinition = {
  label: '2',
  width: 3,
  height: 3,
  robot: { x: 0, y: 1, dir: 'EAST' },
  barriers: buildSealedGridBarriers(3, 3, [
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: 2 },
  ]),
  flags: [{ id: 'goal_b6_m2', x: 1, y: 2, isGoal: true, order: 1, collected: false }],
  requireAllItemsCollected: false,
  requireEmptyBackpackAtGoal: false,
  strictInteractionCollision: true,
};

const BRANCH_6_PATH_LEFT_WS = makeWorkspace(
  {
    MAIN: [
      { type: 'MOVE_FWD' },
      ifBlock(condSensor('pathLeft')),
      { type: 'TURN_LEFT' },
      { type: 'ELSE' },
      { type: 'TURN_RIGHT' },
      { type: 'END_IF' },
      { type: 'MOVE_FWD' },
    ],
  },
  'demo_b6_left'
);

const BRANCH_6_PATH_RIGHT_WS = makeWorkspace(
  {
    MAIN: [
      { type: 'MOVE_FWD' },
      ifBlock(condSensor('pathRight')),
      { type: 'TURN_RIGHT' },
      { type: 'ELSE' },
      { type: 'TURN_LEFT' },
      { type: 'END_IF' },
      { type: 'MOVE_FWD' },
    ],
  },
  'demo_b6_right'
);

// branch.6a — Floor Beacon Forks (5x5, 3 variants)
function makeBranch6aGrid(
  label: string,
  corridor: CellCoord[],
  beacons: CurriculumBeaconTile[]
): CurriculumGridDefinition {
  const goal = corridor[corridor.length - 1];
  return {
    label,
    width: 5,
    height: 5,
    robot: { x: 2, y: 2, dir: 'NORTH' },
    barriers: buildSealedGridBarriers(5, 5, corridor),
    beaconTiles: beacons,
    flags: [{ id: `goal_b6a_${label}`, x: goal.x, y: goal.y, isGoal: true, order: 1, collected: false }],
    requireAllItemsCollected: false,
    requireEmptyBackpackAtGoal: false,
    strictInteractionCollision: true,
  };
}

const BRANCH_6A_GRIDS: CurriculumGridDefinition[] = [
  makeBranch6aGrid(
    '1',
    [
      { x: 2, y: 2 },
      { x: 2, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 0 },
    ],
    [
      { x: 2, y: 1, color: 'blue', label: '🔵' },
      { x: 1, y: 1, color: 'red', label: '🔴' },
    ]
  ),
  makeBranch6aGrid(
    '2',
    [
      { x: 2, y: 2 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 3, y: 0 },
    ],
    [
      { x: 2, y: 1, color: 'red', label: '🔴' },
      { x: 3, y: 1, color: 'blue', label: '🔵' },
    ]
  ),
  makeBranch6aGrid(
    '3',
    [
      { x: 2, y: 2 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 3, y: 2 },
    ],
    [
      { x: 2, y: 1, color: 'red', label: '🔴' },
      { x: 3, y: 1, color: 'red', label: '🔴' },
    ]
  ),
];

// branch.6b — Side Corridor Forks (5x5, 3 variants incl. SOUTH start)
const BRANCH_6B_GRIDS: CurriculumGridDefinition[] = [
  {
    label: '1',
    width: 5,
    height: 5,
    robot: { x: 2, y: 2, dir: 'NORTH' },
    barriers: buildSealedGridBarriers(5, 5, [
      { x: 2, y: 2 },
      { x: 2, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ]),
    flags: [{ id: 'goal_b6b_1', x: 1, y: 2, isGoal: true, order: 1, collected: false }],
    requireAllItemsCollected: false,
    requireEmptyBackpackAtGoal: false,
    strictInteractionCollision: true,
  },
  {
    label: '2',
    width: 5,
    height: 5,
    robot: { x: 2, y: 2, dir: 'NORTH' },
    barriers: buildSealedGridBarriers(5, 5, [
      { x: 2, y: 2 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 3, y: 0 },
    ]),
    flags: [{ id: 'goal_b6b_2', x: 3, y: 0, isGoal: true, order: 1, collected: false }],
    requireAllItemsCollected: false,
    requireEmptyBackpackAtGoal: false,
    strictInteractionCollision: true,
  },
  {
    label: '3',
    width: 5,
    height: 5,
    robot: { x: 2, y: 0, dir: 'SOUTH' },
    barriers: buildSealedGridBarriers(5, 5, [
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 3, y: 2 },
    ]),
    flags: [{ id: 'goal_b6b_3', x: 3, y: 2, isGoal: true, order: 1, collected: false }],
    requireAllItemsCollected: false,
    requireEmptyBackpackAtGoal: false,
    strictInteractionCollision: true,
  },
];

// branch.7 — Boolean Combinators Demo (Grid NOT, Grid AND, Switchyard OR)
const BRANCH_7_GRID_TAB1: CurriculumGridDefinition = {
  label: '1',
  width: 4,
  height: 3,
  robot: { x: 0, y: 0, dir: 'EAST' },
  barriers: buildSealedGridBarriers(4, 3, [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 1 },
  ]),
  flags: [{ id: 'goal_b7_t1', x: 2, y: 1, isGoal: true, order: 1, collected: false }],
  requireAllItemsCollected: false,
  requireEmptyBackpackAtGoal: false,
  strictInteractionCollision: true,
};

const BRANCH_7_GRID_TAB2: CurriculumGridDefinition = {
  label: '2',
  width: 5,
  height: 1,
  robot: { x: 0, y: 0, dir: 'EAST' },
  barriers: [],
  beaconTiles: [
    { x: 1, y: 0, color: 'red', label: '🔴' },
    { x: 2, y: 0, color: 'blue', label: '🔵' },
    { x: 3, y: 0, color: 'blue', label: '🔵' },
  ],
  worldItems: [
    { id: 'decoy_b7_t2', type: 'crate', x: 1, y: 0 },
    { id: 'target_b7_t2', type: 'crate', x: 3, y: 0 },
  ],
  flags: [{ id: 'goal_b7_t2', x: 4, y: 0, isGoal: true, order: 1, collected: false }],
  requireAllItemsCollected: false,
  requireEmptyBackpackAtGoal: false,
  strictInteractionCollision: true,
};

const BRANCH_7_SY_TAB3 = makeSingleSwitchYard(
  '3',
  [
    makeSyItem('b7_t3_1', 'amber', 'battery'),
    makeSyItem('b7_t3_2', 'blue', 'gear'),
    makeSyItem('b7_t3_3', 'red', 'crystal'),
    makeSyItem('b7_t3_4', 'green', 'crate'),
  ],
  { expectedItems: [{ icon: 'battery' }, { icon: 'crystal' }], quota: 2, acceptsDamaged: false },
  { expectedItems: [{ icon: 'crate' }, { icon: 'gear' }], quota: 2, acceptsDamaged: false }
);

// branch.9 — Fix-It: Sequential-If Bug Hunt (5x5, 3 variants)
const BRANCH_9_GRIDS: CurriculumGridDefinition[] = [
  {
    label: '1',
    width: 5,
    height: 5,
    robot: { x: 0, y: 0, dir: 'EAST' },
    barriers: buildSealedGridBarriers(5, 5, [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
    ]),
    flags: [{ id: 'goal_b9_v1', x: 2, y: 1, isGoal: true, order: 1, collected: false }],
    requireAllItemsCollected: false,
    requireEmptyBackpackAtGoal: false,
    strictInteractionCollision: true,
  },
  {
    label: '2',
    width: 5,
    height: 5,
    robot: { x: 0, y: 0, dir: 'EAST' },
    barriers: buildSealedGridBarriers(5, 5, [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
      { x: 0, y: 3 },
      { x: 0, y: 4 },
    ]),
    flags: [{ id: 'goal_b9_v2', x: 0, y: 3, isGoal: true, order: 1, collected: false }],
    requireAllItemsCollected: false,
    requireEmptyBackpackAtGoal: false,
    strictInteractionCollision: true,
  },
  {
    label: '3',
    width: 5,
    height: 5,
    robot: { x: 0, y: 0, dir: 'EAST' },
    barriers: buildSealedGridBarriers(5, 5, [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 0 },
    ]),
    flags: [{ id: 'goal_b9_v3', x: 4, y: 0, isGoal: true, order: 1, collected: false }],
    requireAllItemsCollected: false,
    requireEmptyBackpackAtGoal: false,
    strictInteractionCollision: true,
  },
];

// branch.7a — Compound Safety: AND + NOT (6x3 Amber Key Vault, 3 variants)
const BRANCH_7A_CORRIDOR: CellCoord[] = [
  { x: 0, y: 1 },
  { x: 1, y: 1 },
  { x: 2, y: 1 },
  { x: 3, y: 1 },
  { x: 4, y: 1 },
  { x: 5, y: 1 },
];

const BRANCH_7A_GRIDS: CurriculumGridDefinition[] = [
  [3],
  [1, 2],
  [1, 2, 3],
].map((keyXs, idx) => ({
  label: `${idx + 1}`,
  width: 6,
  height: 3,
  robot: { x: 0, y: 1, dir: 'EAST' },
  barriers: buildSealedGridBarriers(6, 3, BRANCH_7A_CORRIDOR),
  worldItems: keyXs.map((x, kIdx) => ({
    id: `key_b7a_v${idx + 1}_${kIdx + 1}`,
    type: 'key' as const,
    x,
    y: 1,
    color: 'amber' as const,
    shape: 'circle' as const,
  })),
  lockedGates: [
    {
      id: `gate_b7a_v${idx + 1}`,
      x: 4,
      y: 1,
      shape: 'circle',
      color: 'amber',
      unlocked: false,
    },
  ],
  flags: [{ id: `goal_b7a_v${idx + 1}`, x: 5, y: 1, isGoal: true, order: 1, collected: false }],
  requireAllItemsCollected: false,
  requireEmptyBackpackAtGoal: false,
  strictInteractionCollision: true,
}));

// branch.7b — Multi-Match OR Emblem Consolidation (3 variants, N=6)
const BRANCH_7B_SY_VARIANTS: CurriculumSwitchyardDefinition[] = [
  makeSingleSwitchYard(
    '1',
    [
      makeSyItem('b7b_v1_1', 'amber', 'battery'),
      makeSyItem('b7b_v1_2', 'blue', 'crate'),
      makeSyItem('b7b_v1_3', 'blue', 'crystal'),
      makeSyItem('b7b_v1_4', 'red', 'gear'),
      makeSyItem('b7b_v1_5', 'green', 'battery'),
      makeSyItem('b7b_v1_6', 'purple', 'crystal'),
    ],
    { expectedItems: [{ icon: 'battery' }, { icon: 'crystal' }], quota: 4, acceptsDamaged: false },
    { expectedItems: [{ icon: 'crate' }, { icon: 'gear' }], quota: 2, acceptsDamaged: false }
  ),
  makeSingleSwitchYard(
    '2',
    [
      makeSyItem('b7b_v2_1', 'red', 'gear'),
      makeSyItem('b7b_v2_2', 'blue', 'crystal'),
      makeSyItem('b7b_v2_3', 'amber', 'crate'),
      makeSyItem('b7b_v2_4', 'green', 'battery'),
      makeSyItem('b7b_v2_5', 'blue', 'gear'),
      makeSyItem('b7b_v2_6', 'red', 'crate'),
    ],
    { expectedItems: [{ icon: 'battery' }, { icon: 'crystal' }], quota: 2, acceptsDamaged: false },
    { expectedItems: [{ icon: 'crate' }, { icon: 'gear' }], quota: 4, acceptsDamaged: false }
  ),
  makeSingleSwitchYard(
    '3',
    [
      makeSyItem('b7b_v3_1', 'purple', 'crystal'),
      makeSyItem('b7b_v3_2', 'amber', 'battery'),
      makeSyItem('b7b_v3_3', 'blue', 'battery'),
      makeSyItem('b7b_v3_4', 'red', 'crate'),
      makeSyItem('b7b_v3_5', 'blue', 'crystal'),
      makeSyItem('b7b_v3_6', 'green', 'gear'),
    ],
    { expectedItems: [{ icon: 'battery' }, { icon: 'crystal' }], quota: 4, acceptsDamaged: false },
    { expectedItems: [{ icon: 'crate' }, { icon: 'gear' }], quota: 2, acceptsDamaged: false }
  ),
];

// branch.8a — Meet Else If & Two Switches Demo (2 tabs, N=6)
const BRANCH_8A_SY_TAB1 = makeTwoSwitchYard(
  '1',
  [
    makeSyItem('b8a_t1_1', 'red', 'crate'),
    makeSyItem('b8a_t1_2', 'blue', 'crate'),
    makeSyItem('b8a_t1_3', 'green', 'crate'),
    makeSyItem('b8a_t1_4', 'red', 'crate'),
    makeSyItem('b8a_t1_5', 'blue', 'crate'),
    makeSyItem('b8a_t1_6', 'green', 'crate'),
  ],
  [
    { id: 'DOCK_A', label: 'A', expectedColor: 'red', quota: 2, acceptsDamaged: false },
    { id: 'DOCK_B', label: 'B', expectedColor: 'blue', quota: 2, acceptsDamaged: false },
    { id: 'DOCK_C', label: 'C', expectedColor: 'green', quota: 2, acceptsDamaged: false },
  ]
);

const BRANCH_8A_SY_TAB2 = makeTwoSwitchYard(
  '2',
  [
    makeSyItem('b8a_t2_1', 'blue', 'crystal'),
    makeSyItem('b8a_t2_2', 'blue', 'crate'),
    makeSyItem('b8a_t2_3', 'red', 'gear'),
    makeSyItem('b8a_t2_4', 'red', 'crystal'),
    makeSyItem('b8a_t2_5', 'green', 'battery'),
    makeSyItem('b8a_t2_6', 'green', 'crate'),
  ],
  [
    { id: 'DOCK_A', label: 'A', expectedIcon: 'crystal', quota: 2, acceptsDamaged: false },
    { id: 'DOCK_B', label: 'B', expectedColor: 'blue', quota: 1, acceptsDamaged: false },
    {
      id: 'DOCK_C',
      label: 'C',
      expectedItems: [
        { color: 'red', icon: 'gear' },
        { color: 'green', icon: 'battery' },
        { color: 'green', icon: 'crate' },
      ],
      quota: 3,
      acceptsDamaged: false,
    },
  ]
);

// branch.8 — Chained Multi-Way Routing (3 variants, N=6, Crystal priority -> A, Blue -> B, Rest -> C)
const BRANCH_8_SY_VARIANTS: CurriculumSwitchyardDefinition[] = [
  makeTwoSwitchYard(
    '1',
    [
      makeSyItem('b8_v1_1', 'blue', 'crystal'),
      makeSyItem('b8_v1_2', 'blue', 'crate'),
      makeSyItem('b8_v1_3', 'red', 'gear'),
      makeSyItem('b8_v1_4', 'red', 'crystal'),
      makeSyItem('b8_v1_5', 'blue', 'battery'),
      makeSyItem('b8_v1_6', 'green', 'crate'),
    ],
    [
      { id: 'DOCK_A', label: 'A', expectedIcon: 'crystal', quota: 2, acceptsDamaged: false },
      { id: 'DOCK_B', label: 'B', expectedColor: 'blue', quota: 2, acceptsDamaged: false },
      {
        id: 'DOCK_C',
        label: 'C',
        expectedItems: [{ color: 'red', icon: 'gear' }, { color: 'green', icon: 'crate' }],
        quota: 2,
        acceptsDamaged: false,
      },
    ]
  ),
  makeTwoSwitchYard(
    '2',
    [
      makeSyItem('b8_v2_1', 'blue', 'gear'),
      makeSyItem('b8_v2_2', 'green', 'crystal'),
      makeSyItem('b8_v2_3', 'red', 'crate'),
      makeSyItem('b8_v2_4', 'blue', 'crystal'),
      makeSyItem('b8_v2_5', 'red', 'battery'),
      makeSyItem('b8_v2_6', 'blue', 'gear'),
    ],
    [
      { id: 'DOCK_A', label: 'A', expectedIcon: 'crystal', quota: 2, acceptsDamaged: false },
      { id: 'DOCK_B', label: 'B', expectedColor: 'blue', quota: 2, acceptsDamaged: false },
      {
        id: 'DOCK_C',
        label: 'C',
        expectedItems: [{ color: 'red', icon: 'crate' }, { color: 'red', icon: 'battery' }],
        quota: 2,
        acceptsDamaged: false,
      },
    ]
  ),
  makeTwoSwitchYard(
    '3',
    [
      makeSyItem('b8_v3_1', 'amber', 'crate'),
      makeSyItem('b8_v3_2', 'blue', 'battery'),
      makeSyItem('b8_v3_3', 'blue', 'crystal'),
      makeSyItem('b8_v3_4', 'amber', 'gear'),
      makeSyItem('b8_v3_5', 'blue', 'crate'),
      makeSyItem('b8_v3_6', 'purple', 'crystal'),
    ],
    [
      { id: 'DOCK_A', label: 'A', expectedIcon: 'crystal', quota: 2, acceptsDamaged: false },
      { id: 'DOCK_B', label: 'B', expectedColor: 'blue', quota: 2, acceptsDamaged: false },
      {
        id: 'DOCK_C',
        label: 'C',
        expectedItems: [{ color: 'amber', icon: 'crate' }, { color: 'amber', icon: 'gear' }],
        quota: 2,
        acceptsDamaged: false,
      },
    ]
  ),
];

// branch.A — Capstone: Hazard & Priority 3-Dock Router (3 variants, N=8, Red->A, Blue->B, Rest->C, Damaged->Scrap)
const BRANCH_A_SY_VARIANTS: CurriculumSwitchyardDefinition[] = [
  makeTwoSwitchYard(
    '1',
    [
      makeSyItem('bA_v1_1', 'red', 'crate', false),
      makeSyItem('bA_v1_2', 'blue', 'crate', true),
      makeSyItem('bA_v1_3', 'green', 'crate', false),
      makeSyItem('bA_v1_4', 'red', 'battery', true),
      makeSyItem('bA_v1_5', 'blue', 'gear', false),
      makeSyItem('bA_v1_6', 'amber', 'crystal', false),
      makeSyItem('bA_v1_7', 'green', 'crate', true),
      makeSyItem('bA_v1_8', 'red', 'gear', false),
    ],
    [
      { id: 'DOCK_A', label: 'A', expectedColor: 'red', quota: 2, acceptsDamaged: false },
      { id: 'DOCK_B', label: 'B', expectedColor: 'blue', quota: 1, acceptsDamaged: false },
      {
        id: 'DOCK_C',
        label: 'C',
        expectedItems: [{ color: 'green' }, { color: 'amber' }],
        quota: 2,
        acceptsDamaged: false,
      },
    ],
    {
      scrapChute: { label: '💥', expectedDamagedOnly: true, expectedCount: 3 },
      scrapRules: 'damaged',
    }
  ),
  makeTwoSwitchYard(
    '2',
    [
      makeSyItem('bA_v2_1', 'red', 'crystal', true),
      makeSyItem('bA_v2_2', 'blue', 'battery', true),
      makeSyItem('bA_v2_3', 'blue', 'crystal', false),
      makeSyItem('bA_v2_4', 'red', 'crate', false),
      makeSyItem('bA_v2_5', 'amber', 'gear', false),
      makeSyItem('bA_v2_6', 'green', 'crate', true),
      makeSyItem('bA_v2_7', 'red', 'battery', false),
      makeSyItem('bA_v2_8', 'blue', 'gear', false),
    ],
    [
      { id: 'DOCK_A', label: 'A', expectedColor: 'red', quota: 2, acceptsDamaged: false },
      { id: 'DOCK_B', label: 'B', expectedColor: 'blue', quota: 2, acceptsDamaged: false },
      {
        id: 'DOCK_C',
        label: 'C',
        expectedItems: [{ color: 'amber', icon: 'gear' }],
        quota: 1,
        acceptsDamaged: false,
      },
    ],
    {
      scrapChute: { label: '💥', expectedDamagedOnly: true, expectedCount: 3 },
      scrapRules: 'damaged',
    }
  ),
  makeTwoSwitchYard(
    '3',
    [
      makeSyItem('bA_v3_1', 'green', 'crate', false),
      makeSyItem('bA_v3_2', 'blue', 'battery', false),
      makeSyItem('bA_v3_3', 'blue', 'gear', true),
      makeSyItem('bA_v3_4', 'red', 'crystal', false),
      makeSyItem('bA_v3_5', 'purple', 'crate', false),
      makeSyItem('bA_v3_6', 'red', 'battery', true),
      makeSyItem('bA_v3_7', 'blue', 'crystal', false),
      makeSyItem('bA_v3_8', 'green', 'gear', false),
    ],
    [
      { id: 'DOCK_A', label: 'A', expectedColor: 'red', quota: 1, acceptsDamaged: false },
      { id: 'DOCK_B', label: 'B', expectedColor: 'blue', quota: 2, acceptsDamaged: false },
      {
        id: 'DOCK_C',
        label: 'C',
        expectedItems: [{ color: 'green' }, { color: 'purple' }],
        quota: 3,
        acceptsDamaged: false,
      },
    ],
    {
      scrapChute: { label: '💥', expectedDamagedOnly: true, expectedCount: 2 },
      scrapRules: 'damaged',
    }
  ),
];

// ---------------------------------------------------------------------------
// Shared Palettes
// ---------------------------------------------------------------------------

const BRANCH_TURTLE_PALETTE: PaletteConfig = {
  allowedSimBlocks: [...BRANCH_TURTLE_ALLOWED_BLOCKS],
  allowedControlBlocks: [
    'LOOP_START',
    'LOOP_END',
    'IF',
    'ELSE_IF',
    'ELSE',
    'END_IF',
    'CALL_F1',
    'CALL_F2',
    'CALL_F3',
  ],
  allowedScopes: ['MAIN', 'F1', 'F2', 'F3'],
  allowRepeatBadges: true,
  allowActionParams: true,
  allowedBlockParams: BRANCH_TURTLE_PARAMS,
  allowedSensors: ['$input'],
  allowedCombinators: ['OR', 'NOT'],
  allowVariables: false,
  allowRecursion: false,
};

const BRANCH_B_TURTLE_PALETTE: PaletteConfig = {
  ...BRANCH_TURTLE_PALETTE,
  allowedCombinators: ['AND', 'OR', 'NOT'],
};

const BRANCH_BEAT_PALETTE: PaletteConfig = {
  allowedSimBlocks: [...BRANCH_BEAT_ALLOWED_BLOCKS],
  allowedControlBlocks: [
    'LOOP_START',
    'LOOP_END',
    'IF',
    'ELSE_IF',
    'ELSE',
    'END_IF',
    'CALL_F1',
    'CALL_F2',
    'CALL_F3',
  ],
  allowedScopes: ['MAIN', 'F1', 'F2', 'F3'],
  allowRepeatBadges: true,
  allowActionParams: true,
  allowedBlockParams: BRANCH_BEAT_PARAMS,
  allowedSensors: ['$input'],
  allowedCombinators: ['OR', 'NOT'],
  allowVariables: false,
  allowRecursion: false,
};

// ---------------------------------------------------------------------------
// Module `branch` — 21 Activities in Exact overview.md §3 Order
// ---------------------------------------------------------------------------

export const BRANCH_ACTIVITIES: CurriculumActivity[] = [
  // =========================================================================
  // 1. branch.0 — Sensors & If Multi-Map Demo (`itemHere`)
  // =========================================================================
  {
    id: 'branch.0',
    moduleId: 'branch',
    version: 1,
    format: 'explanation',
    simId: 'grid',
    icon: '🔍',
    title: 'Sensors & If Multi-Map Demo',
    concept: 'Using IF (itemHere) Across Changing Maps',
    description:
      'Watch one 6-block conditional program collect a floor gem at different coordinates across two corridors.',
    hint: 'IF (itemHere) checks each step and triggers PICK_UP only where the gem actually sits.',
    palette: {
      allowedSimBlocks: ['MOVE_FWD', 'PICK_UP'],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'IF', 'END_IF'],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: false,
      allowedBlockParams: {},
      allowedSensors: ['itemHere'],
      allowVariables: false,
      allowRecursion: false,
    },
    grid: BRANCH_0_GRID_1,
    gridVariants: [BRANCH_0_GRID_1, BRANCH_0_GRID_2],
    demoTabs: [
      {
        id: 'branch.0-tab-1',
        label: '1',
        icon: '⭐',
        title: 'Map 1',
        simId: 'grid',
        gridState: BRANCH_0_GRID_1,
        workspace: BRANCH_0_DEMO_WS,
        spotlights: ['sensor-beam', 'branch-skip'],
      },
      {
        id: 'branch.0-tab-2',
        label: '2',
        icon: '⭐',
        title: 'Map 2',
        simId: 'grid',
        gridState: BRANCH_0_GRID_2,
        workspace: BRANCH_0_DEMO_WS,
        spotlights: ['sensor-beam', 'branch-skip'],
      },
    ],
  },

  // =========================================================================
  // 2. branch.1 — Sensing & Simple If (`itemHere`)
  // =========================================================================
  {
    id: 'branch.1',
    moduleId: 'branch',
    version: 1,
    format: 'puzzle',
    simId: 'grid',
    icon: '⭐',
    title: 'Sensing & Simple If',
    concept: 'Guarding PICK_UP with IF (itemHere) Across Multi-Map Variants',
    description:
      'Snap IF (itemHere) around PICK_UP inside the 5-step loop so one program collects the gem on all three corridors without blind empty grabs.',
    hint: 'Place IF (itemHere) inside LOOP (5) after MOVE_FWD and tuck PICK_UP inside it.',
    palette: {
      allowedSimBlocks: ['MOVE_FWD', 'PICK_UP'],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'IF', 'END_IF'],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: false,
      allowedBlockParams: {},
      allowedSensors: ['itemHere'],
      allowVariables: false,
      allowRecursion: false,
    },
    slotCap: { perScope: { MAIN: 7 }, maxTotal: 7 },
    grid: BRANCH_1_GRIDS[0],
    gridVariants: BRANCH_1_GRIDS,
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          { type: 'LOOP_START', repeatCount: 5 },
          { type: 'MOVE_FWD' },
          { type: 'LOOP_END' },
        ],
      },
      'start_b1'
    ),
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeWorkspace(
        {
          MAIN: [
            { type: 'LOOP_START', repeatCount: 5 },
            { type: 'MOVE_FWD' },
            ifBlock(condSensor('itemHere')),
            placeholderBlock('item'),
            { type: 'END_IF' },
            { type: 'LOOP_END' },
          ],
        },
        'scaf_b1'
      ),
    },
    referenceSolution: makeWorkspace(
      {
        MAIN: [
          { type: 'LOOP_START', repeatCount: 5 },
          { type: 'MOVE_FWD' },
          ifBlock(condSensor('itemHere')),
          { type: 'PICK_UP' },
          { type: 'END_IF' },
          { type: 'LOOP_END' },
        ],
      },
      'ref_b1'
    ),
    antiBypassRules: [
      {
        id: 'branch1-require-if',
        description: 'Blind PICK_UP or step-counted paths cannot solve all 3 variants cleanly.',
        forbidBlocks: ['IF'],
        unmodifiedStarterMustFail: true,
        minStarterEditDistance: 3,
      },
      {
        id: 'branch1-require-loop',
        description: 'Corridor length requires looping within the 7-slot budget.',
        maxLoopNestingDepth: 0,
      },
    ],
  },

  // =========================================================================
  // 3. branch.2 — Meet the Switchyard (Track Switching Demo)
  // =========================================================================
  {
    id: 'branch.2',
    moduleId: 'branch',
    version: 1,
    format: 'explanation',
    simId: 'switchyard',
    icon: '🔀',
    title: 'Meet the Switchyard',
    concept: '1-Switch Diverter Track Switching Before SEND_NEXT',
    description:
      'Aim the Y-fork switch before dispatching each parcel with SEND_NEXT using either Right or Left as the default lane.',
    hint: 'SWITCH_LEFT and SWITCH_RIGHT aim the track blade; SEND_NEXT dispatches the waiting parcel.',
    palette: {
      allowedSimBlocks: ['SWITCH_LEFT', 'SWITCH_RIGHT', 'SEND_NEXT'],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'IF', 'END_IF'],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: false,
      allowedBlockParams: {},
      allowedSensors: ['itemColor'],
      allowVariables: false,
      allowRecursion: false,
    },
    switchyard: BRANCH_2_SY_1,
    switchyardVariants: [BRANCH_2_SY_1, BRANCH_2_SY_2],
    demoTabs: [
      {
        id: 'branch.2-tab-1',
        label: '1',
        icon: '🔵',
        title: 'Right Default + IF Blue',
        simId: 'switchyard',
        switchyardState: BRANCH_2_SY_1,
        workspace: makeWorkspace(
          {
            MAIN: [
              { type: 'LOOP_START', repeatCount: 4 },
              swRight(),
              ifBlock(condSensor('itemColor', 'blue')),
              swLeft(),
              { type: 'END_IF' },
              { type: 'SEND_NEXT' },
              { type: 'LOOP_END' },
            ],
          },
          'demo_b2_t1'
        ),
        spotlights: ['sensor-beam', 'branch-skip'],
      },
      {
        id: 'branch.2-tab-2',
        label: '2',
        icon: '🔴',
        title: 'Left Default + IF Red',
        simId: 'switchyard',
        switchyardState: BRANCH_2_SY_2,
        workspace: makeWorkspace(
          {
            MAIN: [
              { type: 'LOOP_START', repeatCount: 4 },
              swLeft(),
              ifBlock(condSensor('itemColor', 'red')),
              swRight(),
              { type: 'END_IF' },
              { type: 'SEND_NEXT' },
              { type: 'LOOP_END' },
            ],
          },
          'demo_b2_t2'
        ),
        spotlights: ['sensor-beam', 'branch-skip'],
      },
    ],
  },

  // =========================================================================
  // 4. branch.3 — Switchyard Warmup: Emblem Routing (`itemIcon`)
  // =========================================================================
  {
    id: 'branch.3',
    moduleId: 'branch',
    version: 1,
    format: 'puzzle',
    simId: 'switchyard',
    icon: '⚙️',
    title: 'Emblem Routing Warmup',
    concept: 'Routing by itemIcon Across Mixed Colors',
    description:
      'Sort Gears to the Left dock and Crates to the Right dock across three mixed-color streams using IF (itemIcon == gear).',
    hint: 'Colors are mixed on purpose—check itemIcon == gear inside the loop and flip SWITCH_LEFT.',
    palette: {
      allowedSimBlocks: ['SWITCH_LEFT', 'SWITCH_RIGHT', 'SEND_NEXT'],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'IF', 'END_IF'],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: false,
      allowedBlockParams: {},
      allowedSensors: ['itemIcon'],
      allowVariables: false,
      allowRecursion: false,
    },
    slotCap: { perScope: { MAIN: 8 }, maxTotal: 8 },
    switchyard: BRANCH_3_SY_VARIANTS[0],
    switchyardVariants: BRANCH_3_SY_VARIANTS,
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          { type: 'LOOP_START', repeatCount: 4 },
          swRight(),
          { type: 'SEND_NEXT' },
          { type: 'LOOP_END' },
        ],
      },
      'start_b3'
    ),
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeWorkspace(
        {
          MAIN: [
            { type: 'LOOP_START', repeatCount: 4 },
            swRight(),
            ifBlock(condSensor('itemIcon', 'gear')),
            placeholderBlock('motion'),
            { type: 'END_IF' },
            { type: 'SEND_NEXT' },
            { type: 'LOOP_END' },
          ],
        },
        'scaf_b3'
      ),
    },
    referenceSolution: makeWorkspace(
      {
        MAIN: [
          { type: 'LOOP_START', repeatCount: 4 },
          swRight(),
          ifBlock(condSensor('itemIcon', 'gear')),
          swLeft(),
          { type: 'END_IF' },
          { type: 'SEND_NEXT' },
          { type: 'LOOP_END' },
        ],
      },
      'ref_b3'
    ),
    antiBypassRules: [
      {
        id: 'branch3-require-if',
        description: 'Unconditional routing cannot sort mixed Gear/Crate streams.',
        forbidBlocks: ['IF'],
        unmodifiedStarterMustFail: true,
        minStarterEditDistance: 3,
      },
    ],
  },

  // =========================================================================
  // 5. branch.4 — Meet Else & SCRAP_ITEM Debut (Dual-Env Demo)
  // =========================================================================
  {
    id: 'branch.4',
    moduleId: 'branch',
    version: 1,
    format: 'explanation',
    simId: 'grid',
    icon: '💥',
    title: 'Two-Way Else & Scrap Debut',
    concept: 'Mutually Exclusive IF / ELSE Branches & SCRAP_ITEM',
    description:
      'Explore IF / ELSE on a Blue-vs-Red crossroad and see SCRAP_ITEM shred damaged parcels in Switchyard.',
    hint: 'ELSE runs only when IF is false—never both in the same beat.',
    palette: {
      allowedSimBlocks: [
        'MOVE_FWD',
        'TURN_LEFT',
        'TURN_RIGHT',
        'SWITCH_LEFT',
        'SEND_NEXT',
        'SCRAP_ITEM',
      ],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'IF', 'ELSE', 'END_IF'],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: false,
      allowedBlockParams: {},
      allowedSensors: ['tileColor', 'itemDamaged'],
      allowVariables: false,
      allowRecursion: false,
    },
    grid: BRANCH_4_GRID_BLUE,
    gridVariants: [BRANCH_4_GRID_BLUE, BRANCH_4_GRID_RED],
    switchyard: BRANCH_4_SY,
    demoTabs: [
      {
        id: 'branch.4-tab-1',
        label: '1',
        icon: '🔵',
        title: 'Blue Beacon Turn Left',
        simId: 'grid',
        gridState: BRANCH_4_GRID_BLUE,
        workspace: BRANCH_4_GRID_WS,
        spotlights: ['sensor-beam', 'branch-skip'],
      },
      {
        id: 'branch.4-tab-2',
        label: '2',
        icon: '🔴',
        title: 'Red Beacon Turn Right',
        simId: 'grid',
        gridState: BRANCH_4_GRID_RED,
        workspace: BRANCH_4_GRID_WS,
        spotlights: ['sensor-beam', 'branch-skip'],
      },
      {
        id: 'branch.4-tab-3',
        label: '3',
        icon: '💥',
        title: 'Scrap Damaged Parcels',
        simId: 'switchyard',
        switchyardState: BRANCH_4_SY,
        workspace: makeWorkspace(
          {
            MAIN: [
              swLeft(),
              { type: 'LOOP_START', repeatCount: 4 },
              ifBlock(condSensor('itemDamaged')),
              { type: 'SCRAP_ITEM' },
              { type: 'ELSE' },
              { type: 'SEND_NEXT' },
              { type: 'END_IF' },
              { type: 'LOOP_END' },
            ],
          },
          'demo_b4_sy'
        ),
        spotlights: ['sensor-beam', 'branch-skip'],
      },
    ],
  },

  // =========================================================================
  // 6. branch.5 — Binary If / Else Sorting (`Battery` vs Others)
  // =========================================================================
  {
    id: 'branch.5',
    moduleId: 'branch',
    version: 1,
    format: 'puzzle',
    simId: 'switchyard',
    icon: '🔋',
    title: 'Binary If / Else Sorting',
    concept: 'Two-Way IF / ELSE Track Splitting',
    description:
      'Use IF (itemIcon == battery) / ELSE to send Batteries Left and all Crates, Gears, and Crystals Right across three 5-item streams.',
    hint: 'Flip SWITCH_LEFT inside IF (itemIcon == battery), flip SWITCH_RIGHT inside ELSE, then call SEND_NEXT.',
    palette: {
      allowedSimBlocks: ['SWITCH_LEFT', 'SWITCH_RIGHT', 'SEND_NEXT'],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'IF', 'ELSE', 'END_IF'],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: false,
      allowedBlockParams: {},
      allowedSensors: ['itemIcon'],
      allowVariables: false,
      allowRecursion: false,
    },
    slotCap: { perScope: { MAIN: 8 }, maxTotal: 8 },
    switchyard: BRANCH_5_SY_VARIANTS[0],
    switchyardVariants: BRANCH_5_SY_VARIANTS,
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          { type: 'LOOP_START', repeatCount: 5 },
          { type: 'SEND_NEXT' },
          { type: 'LOOP_END' },
        ],
      },
      'start_b5'
    ),
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeWorkspace(
        {
          MAIN: [
            { type: 'LOOP_START', repeatCount: 5 },
            ifBlock(condSensor('itemIcon', 'battery')),
            swLeft(),
            { type: 'ELSE' },
            placeholderBlock('motion'),
            { type: 'END_IF' },
            { type: 'SEND_NEXT' },
            { type: 'LOOP_END' },
          ],
        },
        'scaf_b5'
      ),
    },
    referenceSolution: makeWorkspace(
      {
        MAIN: [
          { type: 'LOOP_START', repeatCount: 5 },
          ifBlock(condSensor('itemIcon', 'battery')),
          swLeft(),
          { type: 'ELSE' },
          swRight(),
          { type: 'END_IF' },
          { type: 'SEND_NEXT' },
          { type: 'LOOP_END' },
        ],
      },
      'ref_b5'
    ),
    antiBypassRules: [
      {
        id: 'branch5-require-if',
        description: 'Cannot sort mixed Battery/other 5-item streams without conditional IF branching.',
        forbidBlocks: ['IF'],
        unmodifiedStarterMustFail: true,
        minStarterEditDistance: 4,
      },
    ],
  },

  // =========================================================================
  // 7. branch.5a — Hazard Filtering (`itemDamaged` + `SCRAP_ITEM`)
  // =========================================================================
  {
    id: 'branch.5a',
    moduleId: 'branch',
    version: 1,
    format: 'puzzle',
    simId: 'switchyard',
    icon: '🛡️',
    title: 'Hazard Filtering',
    concept: 'Guarding a Sorter with IF (itemDamaged) / ELSE',
    description:
      'Shred cracked parcels with SCRAP_ITEM before routing clean Crystals Left and clean Crates Right.',
    hint: 'Wrap the Crystal/Crate sorter inside ELSE under IF (itemDamaged) { SCRAP_ITEM }.',
    palette: {
      allowedSimBlocks: ['SWITCH_LEFT', 'SWITCH_RIGHT', 'SEND_NEXT', 'SCRAP_ITEM'],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'IF', 'ELSE', 'END_IF'],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: false,
      allowedBlockParams: {},
      allowedSensors: ['itemDamaged', 'itemIcon'],
      allowVariables: false,
      allowRecursion: false,
    },
    slotCap: { perScope: { MAIN: 12 }, maxTotal: 12 },
    switchyard: BRANCH_5A_SY_VARIANTS[0],
    switchyardVariants: BRANCH_5A_SY_VARIANTS,
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          { type: 'LOOP_START', repeatCount: 5 },
          swRight(),
          ifBlock(condSensor('itemIcon', 'crystal')),
          swLeft(),
          { type: 'END_IF' },
          { type: 'SEND_NEXT' },
          { type: 'LOOP_END' },
        ],
      },
      'start_b5a'
    ),
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeWorkspace(
        {
          MAIN: [
            { type: 'LOOP_START', repeatCount: 5 },
            ifBlock(condSensor('itemDamaged')),
            placeholderBlock('item'),
            { type: 'ELSE' },
            swRight(),
            ifBlock(condSensor('itemIcon', 'crystal')),
            swLeft(),
            { type: 'END_IF' },
            { type: 'SEND_NEXT' },
            { type: 'END_IF' },
            { type: 'LOOP_END' },
          ],
        },
        'scaf_b5a'
      ),
    },
    referenceSolution: makeWorkspace(
      {
        MAIN: [
          { type: 'LOOP_START', repeatCount: 5 },
          ifBlock(condSensor('itemDamaged')),
          { type: 'SCRAP_ITEM' },
          { type: 'ELSE' },
          swRight(),
          ifBlock(condSensor('itemIcon', 'crystal')),
          swLeft(),
          { type: 'END_IF' },
          { type: 'SEND_NEXT' },
          { type: 'END_IF' },
          { type: 'LOOP_END' },
        ],
      },
      'ref_b5a'
    ),
    antiBypassRules: [
      {
        id: 'branch5a-require-scrap',
        description: 'Damaged parcels contaminate docks unless SCRAP_ITEM is executed cleanly.',
        forbidBlocks: ['SCRAP_ITEM'],
        unmodifiedStarterMustFail: true,
        minStarterEditDistance: 4,
      },
    ],
  },

  // =========================================================================
  // 8. branch.6 — Spatial Directional Sensors Demo (`pathLeft` / `pathRight`)
  // =========================================================================
  {
    id: 'branch.6',
    moduleId: 'branch',
    version: 1,
    format: 'explanation',
    simId: 'grid',
    icon: '🐾',
    title: 'Spatial Directional Sensors',
    concept: 'Egocentric Whiskers: pathLeft and pathRight',
    description:
      'Observe how pathLeft and pathRight sense open side corridors relative to the robot nose without floor paint.',
    hint: 'pathLeft checks the robot own left flank; pathRight checks its right flank.',
    palette: {
      allowedSimBlocks: ['MOVE_FWD', 'TURN_LEFT', 'TURN_RIGHT'],
      allowedControlBlocks: ['IF', 'ELSE', 'END_IF'],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: false,
      allowedBlockParams: {},
      allowedSensors: ['pathLeft', 'pathRight'],
      allowVariables: false,
      allowRecursion: false,
    },
    grid: BRANCH_6_GRID_NORTH,
    gridVariants: [BRANCH_6_GRID_NORTH, BRANCH_6_GRID_SOUTH],
    demoTabs: [
      {
        id: 'branch.6-tab-1',
        label: '1',
        icon: '⬆️',
        title: 'pathLeft North Exit',
        simId: 'grid',
        gridState: BRANCH_6_GRID_NORTH,
        workspace: BRANCH_6_PATH_LEFT_WS,
        spotlights: ['sensor-beam', 'egocentric-pov'],
      },
      {
        id: 'branch.6-tab-2',
        label: '2',
        icon: '⬇️',
        title: 'pathLeft South Exit',
        simId: 'grid',
        gridState: BRANCH_6_GRID_SOUTH,
        workspace: BRANCH_6_PATH_LEFT_WS,
        spotlights: ['sensor-beam', 'egocentric-pov'],
      },
      {
        id: 'branch.6-tab-3',
        label: '3',
        icon: '⬇️',
        title: 'pathRight South Exit',
        simId: 'grid',
        gridState: BRANCH_6_GRID_SOUTH,
        workspace: BRANCH_6_PATH_RIGHT_WS,
        spotlights: ['sensor-beam', 'egocentric-pov'],
      },
    ],
  },

  // =========================================================================
  // 9. branch.6a — Floor Beacon Forks (`tileColor`)
  // =========================================================================
  {
    id: 'branch.6a',
    moduleId: 'branch',
    version: 1,
    format: 'puzzle',
    simId: 'grid',
    icon: '🚦',
    title: 'Floor Beacon Forks',
    concept: 'Multi-Step IF / ELSE Turning on tileColor Beacons',
    description:
      'Steer through three 5x5 beacon forks inside a 3-step loop: Blue turns Left, ELSE (Red) turns Right.',
    hint: 'Keep MOVE_FWD before IF (tileColor == blue) { TURN_LEFT } ELSE { TURN_RIGHT } inside LOOP (3).',
    palette: {
      allowedSimBlocks: ['MOVE_FWD', 'TURN_LEFT', 'TURN_RIGHT'],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'IF', 'ELSE', 'END_IF'],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: false,
      allowedBlockParams: {},
      allowedSensors: ['tileColor'],
      allowVariables: false,
      allowRecursion: false,
    },
    slotCap: { perScope: { MAIN: 9 }, maxTotal: 9 },
    grid: BRANCH_6A_GRIDS[0],
    gridVariants: BRANCH_6A_GRIDS,
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          { type: 'LOOP_START', repeatCount: 3 },
          { type: 'MOVE_FWD' },
          { type: 'LOOP_END' },
        ],
      },
      'start_b6a'
    ),
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeWorkspace(
        {
          MAIN: [
            { type: 'LOOP_START', repeatCount: 3 },
            { type: 'MOVE_FWD' },
            ifBlock(condSensor('tileColor', 'blue')),
            { type: 'TURN_LEFT' },
            { type: 'ELSE' },
            placeholderBlock('turn'),
            { type: 'END_IF' },
            { type: 'LOOP_END' },
          ],
        },
        'scaf_b6a'
      ),
    },
    referenceSolution: makeWorkspace(
      {
        MAIN: [
          { type: 'LOOP_START', repeatCount: 3 },
          { type: 'MOVE_FWD' },
          ifBlock(condSensor('tileColor', 'blue')),
          { type: 'TURN_LEFT' },
          { type: 'ELSE' },
          { type: 'TURN_RIGHT' },
          { type: 'END_IF' },
          { type: 'LOOP_END' },
        ],
      },
      'ref_b6a'
    ),
    antiBypassRules: [
      {
        id: 'branch6a-require-if',
        description: 'Three disjoint turn paths cannot share a fixed unconditional sequence.',
        forbidBlocks: ['IF'],
        unmodifiedStarterMustFail: true,
        minStarterEditDistance: 5,
      },
      {
        id: 'branch6a-require-else',
        description: 'Both Left and Right beacon turns are required.',
        forbidBlocks: ['ELSE'],
      },
    ],
  },

  // =========================================================================
  // 10. branch.6b — Side Corridor Forks (`pathLeft` / `pathRight`)
  // =========================================================================
  {
    id: 'branch.6b',
    moduleId: 'branch',
    version: 1,
    format: 'puzzle',
    simId: 'grid',
    icon: '🧭',
    title: 'Side Corridor Forks',
    concept: 'Relative pathLeft / pathRight Turns Across Orientations',
    description:
      'Navigate three blind 5x5 corridor mazes (including a South-facing start) using IF (pathLeft) / ELSE inside LOOP (3).',
    hint: 'On each forward step, check pathLeft to turn Left when open, or ELSE turn Right.',
    palette: {
      allowedSimBlocks: ['MOVE_FWD', 'TURN_LEFT', 'TURN_RIGHT'],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'IF', 'ELSE', 'END_IF'],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: false,
      allowedBlockParams: {},
      allowedSensors: ['pathLeft', 'pathRight'],
      allowVariables: false,
      allowRecursion: false,
    },
    slotCap: { perScope: { MAIN: 9 }, maxTotal: 9 },
    grid: BRANCH_6B_GRIDS[0],
    gridVariants: BRANCH_6B_GRIDS,
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          { type: 'LOOP_START', repeatCount: 3 },
          { type: 'MOVE_FWD' },
          { type: 'LOOP_END' },
        ],
      },
      'start_b6b'
    ),
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeWorkspace(
        {
          MAIN: [
            { type: 'LOOP_START', repeatCount: 3 },
            { type: 'MOVE_FWD' },
            ifBlock(condSensor('pathLeft')),
            { type: 'TURN_LEFT' },
            { type: 'ELSE' },
            placeholderBlock('turn'),
            { type: 'END_IF' },
            { type: 'LOOP_END' },
          ],
        },
        'scaf_b6b'
      ),
    },
    referenceSolution: makeWorkspace(
      {
        MAIN: [
          { type: 'LOOP_START', repeatCount: 3 },
          { type: 'MOVE_FWD' },
          ifBlock(condSensor('pathLeft')),
          { type: 'TURN_LEFT' },
          { type: 'ELSE' },
          { type: 'TURN_RIGHT' },
          { type: 'END_IF' },
          { type: 'LOOP_END' },
        ],
      },
      'ref_b6b'
    ),
    antiBypassRules: [
      {
        id: 'branch6b-require-if',
        description: 'North and South starting orientations require conditional side sensing.',
        forbidBlocks: ['IF'],
        unmodifiedStarterMustFail: true,
        minStarterEditDistance: 5,
      },
      {
        id: 'branch6b-require-else',
        description: 'Both Left and Right turns are required across the three maps.',
        forbidBlocks: ['ELSE'],
      },
    ],
  },

  // =========================================================================
  // 11. branch.7 — Boolean Combinators Demo (`NOT`, `AND`, `OR`)
  // =========================================================================
  {
    id: 'branch.7',
    moduleId: 'branch',
    version: 1,
    format: 'explanation',
    simId: 'grid',
    icon: '🧩',
    title: 'Boolean Combinators Demo',
    concept: 'Composing NOT, AND, and OR Conditions',
    description:
      'Watch NOT invert a wall sensor, AND demand both Blue tile + gem, and OR match Battery or Crystal.',
    hint: 'NOT flips true/false, AND needs both sides true, and OR passes when either side is true.',
    palette: {
      allowedSimBlocks: [
        'MOVE_FWD',
        'TURN_RIGHT',
        'PICK_UP',
        'SWITCH_LEFT',
        'SWITCH_RIGHT',
        'SEND_NEXT',
      ],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'IF', 'ELSE', 'END_IF'],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: false,
      allowedBlockParams: {},
      allowedSensors: ['pathAhead', 'tileColor', 'itemHere', 'itemIcon'],
      allowedCombinators: ['NOT', 'AND', 'OR'],
      allowVariables: false,
      allowRecursion: false,
    },
    grid: BRANCH_7_GRID_TAB1,
    switchyard: BRANCH_7_SY_TAB3,
    demoTabs: [
      {
        id: 'branch.7-tab-1',
        label: '1',
        icon: '⛔',
        title: 'NOT pathAhead Corner Turn',
        simId: 'grid',
        gridState: BRANCH_7_GRID_TAB1,
        workspace: makeWorkspace(
          {
            MAIN: [
              { type: 'LOOP_START', repeatCount: 4 },
              ifBlock(condNot(condSensor('pathAhead'))),
              { type: 'TURN_RIGHT' },
              { type: 'ELSE' },
              { type: 'MOVE_FWD' },
              { type: 'END_IF' },
              { type: 'LOOP_END' },
            ],
          },
          'demo_b7_t1'
        ),
        spotlights: ['sensor-beam', 'branch-skip'],
      },
      {
        id: 'branch.7-tab-2',
        label: '2',
        icon: '🤝',
        title: 'tileColor AND itemHere',
        simId: 'grid',
        gridState: BRANCH_7_GRID_TAB2,
        workspace: makeWorkspace(
          {
            MAIN: [
              { type: 'LOOP_START', repeatCount: 4 },
              { type: 'MOVE_FWD' },
              ifBlock(condAnd(condSensor('tileColor', 'blue'), condSensor('itemHere'))),
              { type: 'PICK_UP' },
              { type: 'END_IF' },
              { type: 'LOOP_END' },
            ],
          },
          'demo_b7_t2'
        ),
        spotlights: ['sensor-beam', 'branch-skip'],
      },
      {
        id: 'branch.7-tab-3',
        label: '3',
        icon: '🔀',
        title: 'Battery OR Crystal',
        simId: 'switchyard',
        switchyardState: BRANCH_7_SY_TAB3,
        workspace: makeWorkspace(
          {
            MAIN: [
              { type: 'LOOP_START', repeatCount: 4 },
              ifBlock(condOr(condSensor('itemIcon', 'battery'), condSensor('itemIcon', 'crystal'))),
              swLeft(),
              { type: 'ELSE' },
              swRight(),
              { type: 'END_IF' },
              { type: 'SEND_NEXT' },
              { type: 'LOOP_END' },
            ],
          },
          'demo_b7_t3'
        ),
        spotlights: ['sensor-beam', 'branch-skip'],
      },
    ],
  },

  // =========================================================================
  // 12. branch.9 — Fix-It: Sequential-If Bug Hunt (`NOT` + `IF/ELSE`)
  // =========================================================================
  {
    id: 'branch.9',
    moduleId: 'branch',
    version: 1,
    format: 'puzzle',
    simId: 'grid',
    icon: '🔧',
    title: 'Fix Sequential-If Bug Hunt',
    concept: 'Fixing Fall-Through Sequential IF Mutation into IF / ELSE',
    description:
      'Turning right at a wall makes pathAhead become true on the very same loop beat—merge the two back-to-back IF blocks into one IF / ELSE.',
    hint: 'Replace END_IF + IF (pathAhead) with a single ELSE so turning and stepping never happen in the same beat.',
    palette: {
      allowedSimBlocks: ['MOVE_FWD', 'TURN_RIGHT'],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'IF', 'ELSE', 'END_IF'],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: false,
      allowedBlockParams: {},
      allowedSensors: ['pathAhead'],
      allowedCombinators: ['NOT'],
      allowVariables: false,
      allowRecursion: false,
    },
    slotCap: { perScope: { MAIN: 9 }, maxTotal: 9 },
    grid: BRANCH_9_GRIDS[0],
    gridVariants: BRANCH_9_GRIDS,
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          { type: 'LOOP_START', repeatCount: 4 },
          ifBlock(condNot(condSensor('pathAhead'))),
          { type: 'TURN_RIGHT' },
          { type: 'END_IF' },
          ifBlock(condSensor('pathAhead')),
          { type: 'MOVE_FWD' },
          { type: 'END_IF' },
          { type: 'LOOP_END' },
        ],
      },
      'start_b9'
    ),
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeWorkspace(
        {
          MAIN: [
            { type: 'LOOP_START', repeatCount: 4 },
            ifBlock(condNot(condSensor('pathAhead'))),
            { type: 'TURN_RIGHT' },
            { type: 'ELSE' },
            placeholderBlock('motion'),
            { type: 'END_IF' },
            { type: 'LOOP_END' },
          ],
        },
        'scaf_b9'
      ),
    },
    referenceSolution: makeWorkspace(
      {
        MAIN: [
          { type: 'LOOP_START', repeatCount: 4 },
          ifBlock(condNot(condSensor('pathAhead'))),
          { type: 'TURN_RIGHT' },
          { type: 'ELSE' },
          { type: 'MOVE_FWD' },
          { type: 'END_IF' },
          { type: 'LOOP_END' },
        ],
      },
      'ref_b9'
    ),
    antiBypassRules: [
      {
        id: 'branch9-require-else',
        description: 'Without ELSE, turning makes pathAhead true immediately and overshoots traps.',
        forbidBlocks: ['ELSE'],
        unmodifiedStarterMustFail: true,
        minStarterEditDistance: 2,
      },
      {
        id: 'branch9-require-if',
        description: 'Straight and turning maps require conditional wall sensing.',
        forbidBlocks: ['IF'],
      },
    ],
  },

  // =========================================================================
  // 13. branch.7a — Compound Safety (`AND` + `NOT`, Amber Key Vault)
  // =========================================================================
  {
    id: 'branch.7a',
    moduleId: 'branch',
    version: 1,
    format: 'puzzle',
    simId: 'grid',
    icon: '🔑',
    title: 'Compound Safety: Key Vault',
    concept: 'Combining itemHere AND (NOT carryingItem)',
    description:
      'Take exactly one Amber Key when a key is underfoot AND your 1-slot shoulder gripper is empty, then unlock the Amber Gate.',
    hint: 'Guard PICK_UP with IF (itemHere AND (NOT carryingItem)) inside LOOP (3).',
    palette: {
      allowedSimBlocks: ['MOVE_FWD', 'PICK_UP', 'USE_DROP'],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'IF', 'END_IF'],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: false,
      allowedBlockParams: {},
      allowedSensors: ['itemHere', 'carryingItem'],
      allowedCombinators: ['AND', 'NOT'],
      allowVariables: false,
      allowRecursion: false,
    },
    slotCap: { perScope: { MAIN: 9 }, maxTotal: 9 },
    grid: BRANCH_7A_GRIDS[0],
    gridVariants: BRANCH_7A_GRIDS,
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          { type: 'LOOP_START', repeatCount: 3 },
          { type: 'MOVE_FWD' },
          { type: 'LOOP_END' },
          { type: 'USE_DROP' },
          { type: 'MOVE_FWD' },
          { type: 'MOVE_FWD' },
        ],
      },
      'start_b7a'
    ),
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeWorkspace(
        {
          MAIN: [
            { type: 'LOOP_START', repeatCount: 3 },
            { type: 'MOVE_FWD' },
            ifBlock(condAnd(condSensor('itemHere'), condNot(condSensor('carryingItem')))),
            placeholderBlock('item'),
            { type: 'END_IF' },
            { type: 'LOOP_END' },
            { type: 'USE_DROP' },
            { type: 'MOVE_FWD' },
            { type: 'MOVE_FWD' },
          ],
        },
        'scaf_b7a'
      ),
    },
    referenceSolution: makeWorkspace(
      {
        MAIN: [
          { type: 'LOOP_START', repeatCount: 3 },
          { type: 'MOVE_FWD' },
          ifBlock(condAnd(condSensor('itemHere'), condNot(condSensor('carryingItem')))),
          { type: 'PICK_UP' },
          { type: 'END_IF' },
          { type: 'LOOP_END' },
          { type: 'USE_DROP' },
          { type: 'MOVE_FWD' },
          { type: 'MOVE_FWD' },
        ],
      },
      'ref_b7a'
    ),
    antiBypassRules: [
      {
        id: 'branch7a-require-if',
        description: 'Spare keys and empty tiles collide unless guarded by itemHere AND NOT carryingItem.',
        forbidBlocks: ['IF'],
        unmodifiedStarterMustFail: true,
        minStarterEditDistance: 3,
      },
    ],
  },

  // =========================================================================
  // 14. branch.7b — Multi-Match `Or` Emblem Consolidation
  // =========================================================================
  {
    id: 'branch.7b',
    moduleId: 'branch',
    version: 1,
    format: 'puzzle',
    simId: 'switchyard',
    icon: '🔌',
    title: 'Multi-Match Or Consolidation',
    concept: 'Grouping Two Emblems into One Dock with OR',
    description:
      'Route both Batteries and Crystals to the Left dock using IF (itemIcon == battery OR itemIcon == crystal) / ELSE.',
    hint: 'Combine itemIcon == battery and itemIcon == crystal with OR inside IF.',
    palette: {
      allowedSimBlocks: ['SWITCH_LEFT', 'SWITCH_RIGHT', 'SEND_NEXT'],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'IF', 'ELSE', 'END_IF'],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: false,
      allowedBlockParams: {},
      allowedSensors: ['itemIcon'],
      allowedCombinators: ['OR'],
      allowVariables: false,
      allowRecursion: false,
    },
    slotCap: { perScope: { MAIN: 9 }, maxTotal: 9 },
    switchyard: BRANCH_7B_SY_VARIANTS[0],
    switchyardVariants: BRANCH_7B_SY_VARIANTS,
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          { type: 'LOOP_START', repeatCount: 6 },
          { type: 'SEND_NEXT' },
          { type: 'LOOP_END' },
        ],
      },
      'start_b7b'
    ),
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeWorkspace(
        {
          MAIN: [
            { type: 'LOOP_START', repeatCount: 6 },
            ifBlock(condOr(condSensor('itemIcon', 'battery'), condSensor('itemIcon', 'crystal'))),
            swLeft(),
            { type: 'ELSE' },
            placeholderBlock('motion'),
            { type: 'END_IF' },
            { type: 'SEND_NEXT' },
            { type: 'LOOP_END' },
          ],
        },
        'scaf_b7b'
      ),
    },
    referenceSolution: makeWorkspace(
      {
        MAIN: [
          { type: 'LOOP_START', repeatCount: 6 },
          ifBlock(condOr(condSensor('itemIcon', 'battery'), condSensor('itemIcon', 'crystal'))),
          swLeft(),
          { type: 'ELSE' },
          swRight(),
          { type: 'END_IF' },
          { type: 'SEND_NEXT' },
          { type: 'LOOP_END' },
        ],
      },
      'ref_b7b'
    ),
    antiBypassRules: [
      {
        id: 'branch7b-require-or',
        description: 'Both Battery and Crystal appear with Crate and Gear in every 6-item stream.',
        forbidCombinators: ['OR'],
        unmodifiedStarterMustFail: true,
        minStarterEditDistance: 5,
      },
    ],
  },

  // =========================================================================
  // 15. branch.8a — Meet Else If & Two Switches (`[A]` / `[B]`)
  // =========================================================================
  {
    id: 'branch.8a',
    moduleId: 'branch',
    version: 1,
    format: 'explanation',
    simId: 'switchyard',
    icon: '🪵',
    title: 'Meet Else If & Two Switches',
    concept: '3-Dock Priority Routing Across Switches [A] and [B]',
    description:
      'Step through a 2-switch 3-dock tree and see why ELSE IF stops at the very first matching condition.',
    hint: 'Switch [A] Left leads to Dock A; [A] Right goes to Switch [B], which splits to Dock B and Dock C.',
    palette: {
      allowedSimBlocks: ['SWITCH_LEFT', 'SWITCH_RIGHT', 'SEND_NEXT'],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'IF', 'ELSE_IF', 'ELSE', 'END_IF'],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: true,
      allowedBlockParams: SWITCHYARD_JUNCTION_PARAMS,
      allowedSensors: ['itemColor', 'itemIcon'],
      allowVariables: false,
      allowRecursion: false,
    },
    switchyard: BRANCH_8A_SY_TAB1,
    switchyardVariants: [BRANCH_8A_SY_TAB1, BRANCH_8A_SY_TAB2],
    demoTabs: [
      {
        id: 'branch.8a-tab-1',
        label: '1',
        icon: '🎨',
        title: '3-Color 3-Dock Tree',
        simId: 'switchyard',
        switchyardState: BRANCH_8A_SY_TAB1,
        workspace: makeWorkspace(
          {
            MAIN: [
              { type: 'LOOP_START', repeatCount: 6 },
              ifBlock(condSensor('itemColor', 'red')),
              swLeft('A'),
              elseIfBlock(condSensor('itemColor', 'blue')),
              swRight('A'),
              swLeft('B'),
              { type: 'ELSE' },
              swRight('A'),
              swRight('B'),
              { type: 'END_IF' },
              { type: 'SEND_NEXT' },
              { type: 'LOOP_END' },
            ],
          },
          'demo_b8a_t1'
        ),
        spotlights: ['sensor-beam', 'else-if-chain'],
      },
      {
        id: 'branch.8a-tab-2',
        label: '2',
        icon: '💎',
        title: 'Priority First-Match Order',
        simId: 'switchyard',
        switchyardState: BRANCH_8A_SY_TAB2,
        workspace: makeWorkspace(
          {
            MAIN: [
              { type: 'LOOP_START', repeatCount: 6 },
              ifBlock(condSensor('itemIcon', 'crystal')),
              swLeft('A'),
              elseIfBlock(condSensor('itemColor', 'blue')),
              swRight('A'),
              swLeft('B'),
              { type: 'ELSE' },
              swRight('A'),
              swRight('B'),
              { type: 'END_IF' },
              { type: 'SEND_NEXT' },
              { type: 'LOOP_END' },
            ],
          },
          'demo_b8a_t2'
        ),
        spotlights: ['sensor-beam', 'else-if-chain'],
      },
    ],
  },

  // =========================================================================
  // 16. branch.8 — Chained Multi-Way Routing (`IF / ELSE_IF / ELSE`)
  // =========================================================================
  {
    id: 'branch.8',
    moduleId: 'branch',
    version: 1,
    format: 'puzzle',
    simId: 'switchyard',
    icon: '🏗️',
    title: 'Chained Multi-Way Routing',
    concept: 'Priority Chain: Crystal -> A, ELSE IF Blue -> B, ELSE -> C',
    description:
      'Route any Crystal to Dock A first, remaining Blue parcels to Dock B via [A] Right + [B] Left, and all others to Dock C.',
    hint: 'Keep IF (itemIcon == crystal) first so Blue Crystals go to Dock A instead of Dock B.',
    palette: {
      allowedSimBlocks: ['SWITCH_LEFT', 'SWITCH_RIGHT', 'SEND_NEXT'],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'IF', 'ELSE_IF', 'ELSE', 'END_IF'],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: true,
      allowedBlockParams: SWITCHYARD_JUNCTION_PARAMS,
      allowedSensors: ['itemIcon', 'itemColor'],
      allowVariables: false,
      allowRecursion: false,
    },
    slotCap: { perScope: { MAIN: 13 }, maxTotal: 13 },
    switchyard: BRANCH_8_SY_VARIANTS[0],
    switchyardVariants: BRANCH_8_SY_VARIANTS,
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          { type: 'LOOP_START', repeatCount: 6 },
          ifBlock(condSensor('itemIcon', 'crystal')),
          swLeft('A'),
          { type: 'END_IF' },
          { type: 'SEND_NEXT' },
          { type: 'LOOP_END' },
        ],
      },
      'start_b8'
    ),
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeWorkspace(
        {
          MAIN: [
            { type: 'LOOP_START', repeatCount: 6 },
            ifBlock(condSensor('itemIcon', 'crystal')),
            swLeft('A'),
            elseIfBlock(condSensor('itemColor', 'blue')),
            swRight('A'),
            swLeft('B'),
            { type: 'ELSE' },
            swRight('A'),
            placeholderBlock('motion'),
            { type: 'END_IF' },
            { type: 'SEND_NEXT' },
            { type: 'LOOP_END' },
          ],
        },
        'scaf_b8'
      ),
    },
    referenceSolution: makeWorkspace(
      {
        MAIN: [
          { type: 'LOOP_START', repeatCount: 6 },
          ifBlock(condSensor('itemIcon', 'crystal')),
          swLeft('A'),
          elseIfBlock(condSensor('itemColor', 'blue')),
          swRight('A'),
          swLeft('B'),
          { type: 'ELSE' },
          swRight('A'),
          swRight('B'),
          { type: 'END_IF' },
          { type: 'SEND_NEXT' },
          { type: 'LOOP_END' },
        ],
      },
      'ref_b8'
    ),
    antiBypassRules: [
      {
        id: 'branch8-require-if',
        description: '3-dock mixed Crystal/Blue/Other priority routing requires conditional IF branching.',
        forbidBlocks: ['IF'],
        unmodifiedStarterMustFail: true,
        minStarterEditDistance: 6,
      },
    ],
  },

  // =========================================================================
  // 17. branch.10a — Meet Scene Selector (`$input` Turtle Demo)
  // =========================================================================
  {
    id: 'branch.10a',
    moduleId: 'branch',
    version: 1,
    format: 'explanation',
    simId: 'turtle',
    icon: '🎛️',
    title: 'Meet Scene Selector ($input)',
    concept: 'Reactive $input Pill Switching Colors and Shapes',
    description:
      'Tap [1], [2], [3] on the $input bar to watch IF / ELSE IF / ELSE switch pen colors and full-scale shapes immediately.',
    hint: '$input holds the active selector number so IF / ELSE IF / ELSE chooses which scene to draw.',
    palette: {
      allowedSimBlocks: ['FORWARD', 'TURN_RIGHT', 'SET_PEN_COLOR'],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'IF', 'ELSE_IF', 'ELSE', 'END_IF'],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: true,
      allowedBlockParams: {
        FORWARD: ['length'],
        TURN_RIGHT: ['angle'],
        SET_PEN_COLOR: ['color'],
      },
      allowedSensors: ['$input'],
      allowVariables: false,
      allowRecursion: false,
    },
    inputConfig: {
      mode: 'int',
      min: 1,
      max: 3,
      options: [1, 2, 3],
      previewInput: 1,
    },
    demoTabs: [
      {
        id: 'branch.10a-tab-1',
        label: '1',
        icon: '🟥',
        title: 'Red vs Blue Square',
        simId: 'turtle',
        inputConfig: { mode: 'int', min: 1, max: 2, options: [1, 2], previewInput: 1 },
        workspace: makeWorkspace(
          {
            MAIN: [
              ifBlock(condCmp('=', '$input', 1)),
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.red } },
              { type: 'ELSE' },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.blue } },
              { type: 'END_IF' },
              { type: 'LOOP_START', repeatCount: 4 },
              { type: 'FORWARD', params: { length: 180 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'LOOP_END' },
            ],
          },
          'demo_b10a_t1'
        ),
        spotlights: ['scene-input', 'branch-skip'],
      },
      {
        id: 'branch.10a-tab-2',
        label: '2',
        icon: '⭐',
        title: '3-Shape Selector',
        simId: 'turtle',
        inputConfig: { mode: 'int', min: 1, max: 3, options: [1, 2, 3], previewInput: 2 },
        workspace: makeWorkspace(
          {
            MAIN: [
              ifBlock(condCmp('=', '$input', 1)),
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.red } },
              { type: 'LOOP_START', repeatCount: 4 },
              { type: 'FORWARD', params: { length: 180 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'LOOP_END' },
              elseIfBlock(condCmp('=', '$input', 2)),
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.cyan } },
              { type: 'LOOP_START', repeatCount: 6 },
              { type: 'FORWARD', params: { length: 100 } },
              { type: 'TURN_RIGHT', params: { angle: 60 } },
              { type: 'LOOP_END' },
              { type: 'ELSE' },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.purple } },
              { type: 'LOOP_START', repeatCount: 5 },
              { type: 'FORWARD', params: { length: 190 } },
              { type: 'TURN_RIGHT', params: { angle: 144 } },
              { type: 'LOOP_END' },
              { type: 'END_IF' },
            ],
          },
          'demo_b10a_t2'
        ),
        spotlights: ['scene-input', 'else-if-chain'],
      },
    ],
  },

  // =========================================================================
  // 18. branch.10 — Mood Mandala (`$input` + Variation Cards)
  // =========================================================================
  {
    id: 'branch.10',
    moduleId: 'branch',
    version: 1,
    format: 'sandbox',
    simId: 'turtle',
    icon: '🎨',
    title: 'Mood Mandala ($input)',
    concept: 'Dispatching $input from MAIN to F1..F3 Drawing Scopes',
    description:
      'Use MAIN as a clean $input switchboard into F1, F2, and F3 drawings, then remix shapes or color swatches with the Variation Cards.',
    hint: 'Switch $input buttons [1..4] or load Variation 3 for live Red/Blue/Green/Yellow swatches.',
    palette: BRANCH_TURTLE_PALETTE,
    inputConfig: {
      mode: 'int',
      min: 1,
      max: 4,
      options: [1, 2, 3, 4],
      previewInput: 1,
    },
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          ifBlock(condCmp('=', '$input', 1)),
          { type: 'CALL_F1' },
          elseIfBlock(condCmp('=', '$input', 2)),
          { type: 'CALL_F2' },
          elseIfBlock(condCmp('=', '$input', 3)),
          { type: 'CALL_F3' },
          { type: 'ELSE' },
          { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.purple } },
          { type: 'LOOP_START', repeatCount: 6 },
          { type: 'ARC_LEFT', params: { radius: 60, angle: 360 } },
          { type: 'TURN_RIGHT', params: { angle: 60 } },
          { type: 'LOOP_END' },
          { type: 'END_IF' },
        ],
        F1: [
          { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.red } },
          { type: 'TURN_RIGHT', params: { angle: 18 } },
          { type: 'LOOP_START', repeatCount: 5 },
          { type: 'FORWARD', params: { length: 200 } },
          { type: 'TURN_RIGHT', params: { angle: 144 } },
          { type: 'LOOP_END' },
        ],
        F2: [
          { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.blue } },
          { type: 'LOOP_START', repeatCount: 6 },
          { type: 'ARC_RIGHT', params: { radius: 90, angle: 90 } },
          { type: 'TURN_RIGHT', params: { angle: 90 } },
          { type: 'ARC_RIGHT', params: { radius: 90, angle: 90 } },
          { type: 'TURN_RIGHT', params: { angle: 150 } },
          { type: 'LOOP_END' },
        ],
        F3: [
          { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.green } },
          { type: 'LOOP_START', repeatCount: 4 },
          { type: 'LOOP_START', repeatCount: 4 },
          { type: 'FORWARD', params: { length: 110 } },
          { type: 'TURN_RIGHT', params: { angle: 90 } },
          { type: 'LOOP_END' },
          { type: 'TURN_RIGHT', params: { angle: 90 } },
          { type: 'LOOP_END' },
        ],
      },
      'start_b10'
    ),
    variations: [
      {
        id: 'branch.10-var1-stickers',
        title: 'Toy Stickers',
        icon: '🏠',
        inputConfig: { mode: 'int', min: 1, max: 4, options: [1, 2, 3, 4], previewInput: 3 },
        workspace: makeWorkspace(
          {
            MAIN: [
              { type: 'SET_PEN_WIDTH', params: { width: 6 } },
              ifBlock(condCmp('=', '$input', 1)),
              { type: 'CALL_F1' },
              elseIfBlock(condCmp('=', '$input', 2)),
              { type: 'CALL_F2' },
              elseIfBlock(condCmp('=', '$input', 3)),
              { type: 'CALL_F3' },
              { type: 'ELSE' },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.green } },
              { type: 'LOOP_START', repeatCount: 3 },
              { type: 'FORWARD', params: { length: 180 } },
              { type: 'TURN_RIGHT', params: { angle: 120 } },
              { type: 'LOOP_END' },
              { type: 'END_IF' },
            ],
            F1: [
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.amber } },
              { type: 'LOOP_START', repeatCount: 12 },
              { type: 'FORWARD', params: { length: 135 } },
              { type: 'BACKWARD', params: { length: 135 } },
              { type: 'TURN_RIGHT', params: { angle: 30 } },
              { type: 'LOOP_END' },
            ],
            F2: [
              { type: 'PEN_UP' },
              { type: 'TURN_LEFT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 200 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'PEN_DOWN' },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.cyan } },
              { type: 'LOOP_START', repeatCount: 2 },
              { type: 'ARC_RIGHT', params: { radius: 50, angle: 180 } },
              { type: 'ARC_LEFT', params: { radius: 50, angle: 180 } },
              { type: 'LOOP_END' },
            ],
            F3: [
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.blue } },
              { type: 'LOOP_START', repeatCount: 2 },
              { type: 'FORWARD', params: { length: 160 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 100 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'LOOP_END' },
              { type: 'FORWARD', params: { length: 160 } },
              { type: 'TURN_RIGHT', params: { angle: 30 } },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.red } },
              { type: 'FORWARD', params: { length: 100 } },
              { type: 'TURN_RIGHT', params: { angle: 120 } },
              { type: 'FORWARD', params: { length: 100 } },
            ],
          },
          'v1_b10'
        ),
      },
      {
        id: 'branch.10-var2-shared-frame',
        title: 'Shared Halo Frame',
        icon: '⭕',
        inputConfig: { mode: 'int', min: 1, max: 4, options: [1, 2, 3, 4], previewInput: 2 },
        workspace: makeWorkspace(
          {
            MAIN: [
              ifBlock(condOr(condCmp('=', '$input', 1), condCmp('=', '$input', 2))),
              { type: 'CALL_F1' },
              { type: 'END_IF' },
              ifBlock(condNot(condCmp('=', '$input', 4))),
              { type: 'SET_PEN_WIDTH', params: { width: 7 } },
              { type: 'ELSE' },
              { type: 'SET_PEN_WIDTH', params: { width: 4 } },
              { type: 'END_IF' },
              ifBlock(condCmp('=', '$input', 1)),
              { type: 'CALL_F2' },
              elseIfBlock(condCmp('=', '$input', 2)),
              { type: 'CALL_F3' },
              { type: 'ELSE' },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.purple } },
              { type: 'LOOP_START', repeatCount: 8 },
              { type: 'FORWARD', params: { length: 135 } },
              { type: 'BACKWARD', params: { length: 135 } },
              { type: 'TURN_RIGHT', params: { angle: 45 } },
              { type: 'LOOP_END' },
              { type: 'END_IF' },
            ],
            F1: [
              { type: 'PEN_UP' },
              { type: 'TURN_LEFT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 150 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'PEN_DOWN' },
              { type: 'SET_PEN_WIDTH', params: { width: 6 } },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.cyan } },
              { type: 'ARC_RIGHT', params: { radius: 150, angle: 360 } },
              { type: 'PEN_UP' },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 150 } },
              { type: 'TURN_LEFT', params: { angle: 90 } },
              { type: 'PEN_DOWN' },
            ],
            F2: [
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.pink } },
              { type: 'LOOP_START', repeatCount: 6 },
              { type: 'FORWARD', params: { length: 140 } },
              { type: 'TURN_RIGHT', params: { angle: 60 } },
              { type: 'LOOP_END' },
            ],
            F3: [
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.amber } },
              { type: 'LOOP_START', repeatCount: 8 },
              { type: 'LOOP_START', repeatCount: 2 },
              { type: 'FORWARD', params: { length: 115 } },
              { type: 'TURN_RIGHT', params: { angle: 60 } },
              { type: 'FORWARD', params: { length: 115 } },
              { type: 'TURN_RIGHT', params: { angle: 120 } },
              { type: 'LOOP_END' },
              { type: 'TURN_RIGHT', params: { angle: 45 } },
              { type: 'LOOP_END' },
            ],
          },
          'v2_b10'
        ),
      },
      {
        id: 'branch.10-var3-swatch-kaleidoscope',
        title: 'Color Swatches',
        icon: '🌈',
        inputConfig: {
          mode: 'color',
          options: ['red', 'blue', 'green', 'yellow'],
          previewInput: 'red',
        },
        workspace: makeWorkspace(
          {
            MAIN: [
              ifBlock(condCmp('=', '$input', 'color:red')),
              { type: 'CALL_F1' },
              elseIfBlock(condCmp('=', '$input', 'color:blue')),
              { type: 'CALL_F2' },
              elseIfBlock(condCmp('=', '$input', 'color:green')),
              { type: 'CALL_F3' },
              { type: 'ELSE' },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.amber } },
              { type: 'LOOP_START', repeatCount: 12 },
              { type: 'ARC_RIGHT', params: { radius: 85, angle: 180 } },
              { type: 'TURN_RIGHT', params: { angle: 150 } },
              { type: 'LOOP_END' },
              { type: 'END_IF' },
            ],
            F1: [
              { type: 'SET_PEN_WIDTH', params: { width: 6 } },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.red } },
              { type: 'LOOP_START', repeatCount: 8 },
              { type: 'ARC_RIGHT', params: { radius: 85, angle: 360 } },
              { type: 'TURN_RIGHT', params: { angle: 45 } },
              { type: 'LOOP_END' },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.orange } },
              { type: 'LOOP_START', repeatCount: 8 },
              { type: 'FORWARD', params: { length: 150 } },
              { type: 'BACKWARD', params: { length: 150 } },
              { type: 'TURN_RIGHT', params: { angle: 45 } },
              { type: 'LOOP_END' },
            ],
            F2: [
              { type: 'SET_PEN_WIDTH', params: { width: 6 } },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.blue } },
              { type: 'LOOP_START', repeatCount: 6 },
              { type: 'ARC_RIGHT', params: { radius: 85, angle: 360 } },
              { type: 'TURN_RIGHT', params: { angle: 60 } },
              { type: 'LOOP_END' },
            ],
            F3: [
              { type: 'SET_PEN_WIDTH', params: { width: 6 } },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.green } },
              { type: 'LOOP_START', repeatCount: 12 },
              { type: 'LOOP_START', repeatCount: 4 },
              { type: 'FORWARD', params: { length: 120 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'LOOP_END' },
              { type: 'TURN_RIGHT', params: { angle: 30 } },
              { type: 'LOOP_END' },
            ],
          },
          'v3_b10'
        ),
      },
    ],
  },

  // =========================================================================
  // 19. branch.A — Capstone: Hazard & Priority 3-Dock Router
  // =========================================================================
  {
    id: 'branch.A',
    moduleId: 'branch',
    version: 1,
    format: 'capstone',
    capstoneType: 'puzzle',
    simId: 'switchyard',
    icon: '🏆',
    title: 'Hazard & Priority Router',
    concept: 'Multi-Scope Guard + 3-Dock Color Router ([MAIN, F1])',
    description:
      'Guard the entrance in MAIN with IF (itemDamaged) { SCRAP_ITEM } ELSE { CALL F1; SEND_NEXT }, and sort Red -> A, Blue -> B, and Others -> C inside F1.',
    hint: 'Use MAIN for the safety check + loop, and keep the 3-way IF / ELSE_IF / ELSE color chain inside F1.',
    palette: {
      allowedSimBlocks: ['SWITCH_LEFT', 'SWITCH_RIGHT', 'SEND_NEXT', 'SCRAP_ITEM'],
      allowedControlBlocks: [
        'LOOP_START',
        'LOOP_END',
        'IF',
        'ELSE_IF',
        'ELSE',
        'END_IF',
        'CALL_F1',
      ],
      allowedScopes: ['MAIN', 'F1'],
      allowRepeatBadges: true,
      allowActionParams: true,
      allowedBlockParams: SWITCHYARD_JUNCTION_PARAMS,
      allowedSensors: ['itemDamaged', 'itemColor'],
      allowVariables: false,
      allowRecursion: false,
    },
    slotCap: { perScope: { MAIN: 10, F1: 10 }, maxTotal: 20 },
    switchyard: BRANCH_A_SY_VARIANTS[0],
    switchyardVariants: BRANCH_A_SY_VARIANTS,
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          { type: 'LOOP_START', repeatCount: 8 },
          { type: 'CALL_F1' },
          { type: 'SEND_NEXT' },
          { type: 'LOOP_END' },
        ],
        F1: [
          ifBlock(condSensor('itemColor', 'red')),
          swLeft('A'),
          { type: 'END_IF' },
        ],
      },
      'start_bA'
    ),
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeWorkspace(
        {
          MAIN: [
            { type: 'LOOP_START', repeatCount: 8 },
            ifBlock(condSensor('itemDamaged')),
            { type: 'SCRAP_ITEM' },
            { type: 'ELSE' },
            { type: 'CALL_F1' },
            { type: 'SEND_NEXT' },
            { type: 'END_IF' },
            { type: 'LOOP_END' },
          ],
          F1: [
            ifBlock(condSensor('itemColor', 'red')),
            swLeft('A'),
            elseIfBlock(condSensor('itemColor', 'blue')),
            swRight('A'),
            swLeft('B'),
            { type: 'ELSE' },
            swRight('A'),
            placeholderBlock('motion'),
            { type: 'END_IF' },
          ],
        },
        'scaf_bA'
      ),
    },
    referenceSolution: makeWorkspace(
      {
        MAIN: [
          { type: 'LOOP_START', repeatCount: 8 },
          ifBlock(condSensor('itemDamaged')),
          { type: 'SCRAP_ITEM' },
          { type: 'ELSE' },
          { type: 'CALL_F1' },
          { type: 'SEND_NEXT' },
          { type: 'END_IF' },
          { type: 'LOOP_END' },
        ],
        F1: [
          ifBlock(condSensor('itemColor', 'red')),
          swLeft('A'),
          elseIfBlock(condSensor('itemColor', 'blue')),
          swRight('A'),
          swLeft('B'),
          { type: 'ELSE' },
          swRight('A'),
          swRight('B'),
          { type: 'END_IF' },
        ],
      },
      'ref_bA'
    ),
    antiBypassRules: [
      {
        id: 'branchA-require-scrap',
        description: 'Damaged items require SCRAP_ITEM in MAIN.',
        forbidBlocks: ['SCRAP_ITEM'],
        unmodifiedStarterMustFail: true,
        minStarterEditDistance: 10,
      },
      {
        id: 'branchA-require-helper-f1',
        description: 'Single-scope MAIN (10 slots) cannot fit both hazard guard and 3-dock router without CALL_F1.',
        forbidBlocks: ['CALL_F1'],
      },
    ],
  },

  // =========================================================================
  // 20. branch.B — Capstone: Interactive Scene Studio (`$input` Turtle)
  // =========================================================================
  {
    id: 'branch.B',
    moduleId: 'branch',
    version: 1,
    format: 'capstone',
    capstoneType: 'creative',
    simId: 'turtle',
    icon: '🏆',
    title: 'Interactive Scene Studio ($input)',
    concept: 'Composing AND / OR / NOT, Multi-Layer Moods & White Stencils',
    description:
      'Combine IF / ELSE IF / ELSE, combinators, and F1..F3 sub-drawings to direct multi-layer mandalas and white stencil cutouts.',
    hint: 'Layer shared outer frames with OR, toggle accents with NOT, and try all 3 Studio Remixes.',
    palette: BRANCH_B_TURTLE_PALETTE,
    inputConfig: {
      mode: 'int',
      min: 1,
      max: 4,
      options: [1, 2, 3, 4],
      previewInput: 1,
    },
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          ifBlock(condCmp('=', '$input', 1)),
          { type: 'CALL_F1' },
          elseIfBlock(condCmp('=', '$input', 2)),
          { type: 'CALL_F2' },
          elseIfBlock(condCmp('=', '$input', 3)),
          { type: 'CALL_F3' },
          { type: 'ELSE' },
          { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.pink } },
          { type: 'LOOP_START', repeatCount: 10 },
          { type: 'ARC_RIGHT', params: { radius: 75, angle: 360 } },
          { type: 'TURN_RIGHT', params: { angle: 36 } },
          { type: 'LOOP_END' },
          { type: 'END_IF' },
        ],
        F1: [
          { type: 'SET_PEN_WIDTH', params: { width: 6 } },
          { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.amber } },
          { type: 'LOOP_START', repeatCount: 12 },
          { type: 'FORWARD', params: { length: 150 } },
          { type: 'BACKWARD', params: { length: 150 } },
          { type: 'TURN_RIGHT', params: { angle: 30 } },
          { type: 'LOOP_END' },
          { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.orange } },
          { type: 'LOOP_START', repeatCount: 6 },
          { type: 'ARC_RIGHT', params: { radius: 60, angle: 360 } },
          { type: 'TURN_RIGHT', params: { angle: 60 } },
          { type: 'LOOP_END' },
        ],
        F2: [
          { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.cyan } },
          { type: 'LOOP_START', repeatCount: 8 },
          { type: 'ARC_RIGHT', params: { radius: 110, angle: 90 } },
          { type: 'TURN_RIGHT', params: { angle: 45 } },
          { type: 'LOOP_END' },
        ],
        F3: [
          { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.green } },
          { type: 'LOOP_START', repeatCount: 6 },
          { type: 'LOOP_START', repeatCount: 5 },
          { type: 'FORWARD', params: { length: 140 } },
          { type: 'TURN_RIGHT', params: { angle: 144 } },
          { type: 'LOOP_END' },
          { type: 'TURN_RIGHT', params: { angle: 60 } },
          { type: 'LOOP_END' },
        ],
      },
      'start_bB'
    ),
    variations: [
      {
        id: 'branch.B-var1-kaleidoscope',
        title: 'Double-Deck Kaleidoscope',
        icon: '🌀',
        inputConfig: { mode: 'int', min: 1, max: 4, options: [1, 2, 3, 4], previewInput: 2 },
        workspace: makeWorkspace(
          {
            MAIN: [
              ifBlock(condOr(condCmp('=', '$input', 1), condCmp('=', '$input', 2))),
              { type: 'CALL_F1' },
              { type: 'END_IF' },
              ifBlock(condCmp('=', '$input', 1)),
              { type: 'CALL_F2' },
              { type: 'ELSE' },
              { type: 'CALL_F3' },
              { type: 'END_IF' },
            ],
            F1: [
              { type: 'SET_PEN_WIDTH', params: { width: 5 } },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.purple } },
              { type: 'LOOP_START', repeatCount: 6 },
              { type: 'LOOP_START', repeatCount: 6 },
              { type: 'FORWARD', params: { length: 100 } },
              { type: 'TURN_RIGHT', params: { angle: 60 } },
              { type: 'LOOP_END' },
              { type: 'TURN_RIGHT', params: { angle: 60 } },
              { type: 'LOOP_END' },
            ],
            F2: [
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.pink } },
              { type: 'LOOP_START', repeatCount: 10 },
              { type: 'FORWARD', params: { length: 120 } },
              { type: 'TURN_RIGHT', params: { angle: 144 } },
              { type: 'FORWARD', params: { length: 120 } },
              { type: 'TURN_LEFT', params: { angle: 108 } },
              { type: 'LOOP_END' },
            ],
            F3: [
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.cyan } },
              { type: 'LOOP_START', repeatCount: 8 },
              { type: 'ARC_RIGHT', params: { radius: 95, angle: 90 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'ARC_RIGHT', params: { radius: 95, angle: 90 } },
              { type: 'TURN_RIGHT', params: { angle: 135 } },
              { type: 'LOOP_END' },
            ],
          },
          'v1_bB'
        ),
      },
      {
        id: 'branch.B-var2-mood-dial',
        title: '6-Mood Selector Dial',
        icon: '🎡',
        inputConfig: { mode: 'int', min: 1, max: 6, options: [1, 2, 3, 4, 5, 6], previewInput: 5 },
        workspace: makeWorkspace(
          {
            MAIN: [
              ifBlock(
                condAnd(
                  condNot(condCmp('=', '$input', 1)),
                  condOr(condCmp('=', '$input', 5), condCmp('=', '$input', 6))
                )
              ),
              { type: 'CALL_F1' },
              { type: 'END_IF' },
              ifBlock(condCmp('=', '$input', 1)),
              { type: 'CALL_F1' },
              elseIfBlock(condCmp('=', '$input', 2)),
              { type: 'CALL_F2' },
              elseIfBlock(condCmp('=', '$input', 3)),
              { type: 'CALL_F3' },
              elseIfBlock(condCmp('=', '$input', 4)),
              { type: 'CALL_F2' },
              elseIfBlock(condCmp('=', '$input', 5)),
              { type: 'CALL_F2' },
              { type: 'ELSE' },
              { type: 'CALL_F3' },
              { type: 'END_IF' },
            ],
            F1: [
              { type: 'PEN_UP' },
              { type: 'TURN_LEFT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 180 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'PEN_DOWN' },
              { type: 'SET_PEN_WIDTH', params: { width: 6 } },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.blue } },
              { type: 'ARC_RIGHT', params: { radius: 180, angle: 360 } },
              { type: 'PEN_UP' },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 180 } },
              { type: 'TURN_LEFT', params: { angle: 90 } },
              { type: 'PEN_DOWN' },
            ],
            F2: [
              { type: 'SET_PEN_WIDTH', params: { width: 5 } },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.amber } },
              { type: 'LOOP_START', repeatCount: 12 },
              { type: 'ARC_RIGHT', params: { radius: 80, angle: 360 } },
              { type: 'TURN_RIGHT', params: { angle: 30 } },
              { type: 'LOOP_END' },
            ],
            F3: [
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.red } },
              { type: 'LOOP_START', repeatCount: 8 },
              { type: 'FORWARD', params: { length: 160 } },
              { type: 'BACKWARD', params: { length: 160 } },
              { type: 'TURN_RIGHT', params: { angle: 45 } },
              { type: 'LOOP_END' },
            ],
          },
          'v2_bB'
        ),
      },
      {
        id: 'branch.B-var3-stencil-mandala',
        title: 'White-Eraser Stencil',
        icon: '✂️',
        inputConfig: { mode: 'int', min: 1, max: 6, options: [1, 2, 3, 4, 5, 6], previewInput: 3 },
        workspace: makeWorkspace(
          {
            MAIN: [
              ifBlock(condNot(condCmp('=', '$input', 6))),
              { type: 'CALL_F1' },
              { type: 'END_IF' },
              ifBlock(condOr(condCmp('=', '$input', 3), condCmp('=', '$input', 4))),
              { type: 'CALL_F2' },
              { type: 'END_IF' },
              { type: 'CALL_F3' },
            ],
            F1: [
              { type: 'PEN_UP' },
              { type: 'TURN_LEFT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 175 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'PEN_DOWN' },
              { type: 'SET_PEN_WIDTH', params: { width: 6 } },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.purple } },
              { type: 'ARC_RIGHT', params: { radius: 175, angle: 360 } },
              { type: 'PEN_UP' },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 175 } },
              { type: 'TURN_LEFT', params: { angle: 90 } },
              { type: 'PEN_DOWN' },
            ],
            F2: [
              { type: 'SET_PEN_WIDTH', params: { width: 6 } },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.cyan } },
              { type: 'LOOP_START', repeatCount: 12 },
              { type: 'FORWARD', params: { length: 160 } },
              { type: 'TURN_RIGHT', params: { angle: 150 } },
              { type: 'LOOP_END' },
              { type: 'SET_PEN_WIDTH', params: { width: 8 } },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.white } },
              { type: 'LOOP_START', repeatCount: 6 },
              { type: 'FORWARD', params: { length: 120 } },
              { type: 'BACKWARD', params: { length: 120 } },
              { type: 'TURN_RIGHT', params: { angle: 60 } },
              { type: 'LOOP_END' },
            ],
            F3: [
              { type: 'SET_PEN_WIDTH', params: { width: 5 } },
              { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.amber } },
              { type: 'LOOP_START', repeatCount: 6 },
              { type: 'ARC_RIGHT', params: { radius: 70, angle: 360 } },
              { type: 'TURN_RIGHT', params: { angle: 60 } },
              { type: 'LOOP_END' },
            ],
          },
          'v3_bB'
        ),
      },
    ],
  },

  // =========================================================================
  // 21. branch.C — Capstone: Interactive `$input` Jukebox (`beat`)
  // =========================================================================
  {
    id: 'branch.C',
    moduleId: 'branch',
    version: 1,
    format: 'capstone',
    capstoneType: 'creative',
    simId: 'beat',
    icon: '🎵',
    title: 'Interactive $input Jukebox',
    concept: 'Multi-Track Musical Light Jukebox with Loop (∞) & Clean Reset',
    description:
      'Switch $input live while Beat Loop playback runs: MAIN dispatches across four LED light-and-note tracks cleanly.',
    hint: 'Keep STAMP_PRESET before pixel overlays, use grid coordinates 1..8 and pitches 1..8, and try all 3 Jukebox Remixes.',
    palette: BRANCH_BEAT_PALETTE,
    inputConfig: {
      mode: 'int',
      min: 1,
      max: 4,
      options: [1, 2, 3, 4],
      previewInput: 1,
    },
    beatRules: {
      isLoopingDefault: true,
      cleanResetOnInputChange: true,
    },
    defaultLoopPlayback: true,
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          ifBlock(condCmp('=', '$input', 1)),
          { type: 'CALL_F1' },
          elseIfBlock(condCmp('=', '$input', 2)),
          { type: 'CALL_F2' },
          elseIfBlock(condCmp('=', '$input', 3)),
          { type: 'CALL_F3' },
          { type: 'ELSE' },
          { type: 'STAMP_PRESET', params: { preset: beatPresetName(6) } },
          { type: 'SET_BEAT_DELAY', params: { delay: 1 } },
          { type: 'PLAY_NOTE', params: { pitch: 1, duration: 1 } },
          { type: 'PLAY_NOTE', params: { pitch: 5, duration: 1 } },
          { type: 'CLEAR_LEDS' },
          { type: 'END_IF' },
        ],
        F1: [
          { type: 'STAMP_PRESET', params: { preset: beatPresetName(2) } },
          { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
          { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.amber } },
          { type: 'LIGHT_PIXEL', params: { x: 4, y: 4 } },
          { type: 'LIGHT_PIXEL', params: { x: 5, y: 4 } },
          { type: 'SET_BEAT_DELAY', params: { delay: 1 } },
          { type: 'PLAY_NOTE', params: { pitch: 1, duration: 1 } },
          { type: 'PLAY_NOTE', params: { pitch: 3, duration: 1 } },
          { type: 'PLAY_NOTE', params: { pitch: 5, duration: 1 } },
          { type: 'PLAY_NOTE', params: { pitch: 8, duration: 1 } },
        ],
        F2: [
          { type: 'STAMP_PRESET', params: { preset: beatPresetName(4) } },
          { type: 'SET_BEAT_DELAY', params: { delay: 1 } },
          { type: 'PLAY_NOTE', params: { pitch: 6, duration: 1 } },
          { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.cyan } },
          { type: 'LIGHT_PIXEL', params: { x: 2, y: 3 } },
          { type: 'PLAY_NOTE', params: { pitch: 4, duration: 1 } },
          { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.blue } },
          { type: 'LIGHT_PIXEL', params: { x: 6, y: 5 } },
          { type: 'PLAY_NOTE', params: { pitch: 1, duration: 1 } },
          { type: 'WAIT_BEAT' },
        ],
        F3: [
          { type: 'STAMP_PRESET', params: { preset: beatPresetName(1) } },
          { type: 'SET_BEAT_DELAY', params: { delay: 1 } },
          { type: 'LOOP_START', repeatCount: 2 },
          { type: 'PLAY_NOTE', params: { pitch: 1, duration: 1 } },
          { type: 'PLAY_NOTE', params: { pitch: 5, duration: 1 } },
          { type: 'PLAY_NOTE', params: { pitch: 8, duration: 1 } },
          { type: 'WAIT_BEAT' },
          { type: 'LOOP_END' },
          { type: 'CLEAR_LEDS' },
        ],
      },
      'start_bC'
    ),
    variations: [
      {
        id: 'branch.C-var1-remix-equalizer',
        title: 'Remix Equalizer',
        icon: '🎛️',
        inputConfig: { mode: 'int', min: 1, max: 4, options: [1, 2, 3, 4], previewInput: 1 },
        workspace: makeWorkspace(
          {
            MAIN: [
              ifBlock(condCmp('=', '$input', 1)),
              { type: 'CALL_F1' },
              elseIfBlock(condCmp('=', '$input', 4)),
              { type: 'CALL_F3' },
              { type: 'ELSE' },
              { type: 'CALL_F2' },
              { type: 'END_IF' },
              ifBlock(condOr(condCmp('=', '$input', 1), condCmp('=', '$input', 4))),
              { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.amber } },
              { type: 'LIGHT_PIXEL', params: { x: 1, y: 1 } },
              { type: 'LIGHT_PIXEL', params: { x: 8, y: 8 } },
              { type: 'END_IF' },
            ],
            F1: [
              { type: 'STAMP_PRESET', params: { preset: beatPresetName(1) } },
              { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.cyan } },
              { type: 'LIGHT_PIXEL', params: { x: 4, y: 5 } },
              { type: 'SET_BEAT_DELAY', params: { delay: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 1, duration: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 3, duration: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 5, duration: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 8, duration: 1 } },
            ],
            F2: [
              { type: 'STAMP_PRESET', params: { preset: beatPresetName(5) } },
              { type: 'SET_BEAT_DELAY', params: { delay: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 6, duration: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 5, duration: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 3, duration: 1 } },
              { type: 'WAIT_BEAT' },
            ],
            F3: [
              { type: 'STAMP_PRESET', params: { preset: beatPresetName(4) } },
              { type: 'SET_BEAT_DELAY', params: { delay: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 8, duration: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 5, duration: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 1, duration: 1 } },
              { type: 'CLEAR_LEDS' },
            ],
          },
          'v1_bC'
        ),
      },
      {
        id: 'branch.C-var2-day-night',
        title: 'Day / Night Visualizer',
        icon: '🌙',
        inputConfig: { mode: 'int', min: 1, max: 4, options: [1, 2, 3, 4], previewInput: 3 },
        workspace: makeWorkspace(
          {
            MAIN: [
              ifBlock(condNot(condCmp('=', '$input', 3))),
              { type: 'STAMP_PRESET', params: { preset: beatPresetName(3) } },
              { type: 'CALL_F1' },
              { type: 'ELSE' },
              { type: 'CALL_F2' },
              { type: 'END_IF' },
            ],
            F1: [
              { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.amber } },
              { type: 'LIGHT_PIXEL', params: { x: 4, y: 4 } },
              { type: 'LIGHT_PIXEL', params: { x: 5, y: 5 } },
              { type: 'SET_BEAT_DELAY', params: { delay: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 5, duration: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 6, duration: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 8, duration: 1 } },
            ],
            F2: [
              { type: 'STAMP_PRESET', params: { preset: beatPresetName(3) } },
              { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
              { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.black } },
              { type: 'LIGHT_PIXEL', params: { x: 4, y: 4 } },
              { type: 'LIGHT_PIXEL', params: { x: 5, y: 5 } },
              { type: 'SET_BEAT_DELAY', params: { delay: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 1, duration: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 2, duration: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 1, duration: 1 } },
            ],
            F3: [
              { type: 'CLEAR_LEDS' },
            ],
          },
          'v2_bC'
        ),
      },
      {
        id: 'branch.C-var3-swatch-jukebox',
        title: 'Color Swatch Jukebox',
        icon: '🎹',
        inputConfig: {
          mode: 'color',
          options: ['red', 'blue', 'green', 'yellow'],
          previewInput: 'red',
        },
        workspace: makeWorkspace(
          {
            MAIN: [
              ifBlock(condCmp('=', '$input', 'color:red')),
              { type: 'CALL_F1' },
              elseIfBlock(condCmp('=', '$input', 'color:blue')),
              { type: 'CALL_F2' },
              elseIfBlock(condCmp('=', '$input', 'color:green')),
              { type: 'CALL_F3' },
              { type: 'ELSE' },
              { type: 'STAMP_PRESET', params: { preset: beatPresetName(2) } },
              { type: 'SET_BEAT_DELAY', params: { delay: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 1, duration: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 5, duration: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 8, duration: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 8, duration: 1 } },
              { type: 'END_IF' },
            ],
            F1: [
              { type: 'STAMP_PRESET', params: { preset: beatPresetName(0) } },
              { type: 'SET_BEAT_DELAY', params: { delay: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 1, duration: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 1, duration: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 5, duration: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 1, duration: 1 } },
            ],
            F2: [
              { type: 'STAMP_PRESET', params: { preset: beatPresetName(5) } },
              { type: 'SET_BEAT_DELAY', params: { delay: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 8, duration: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 6, duration: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 4, duration: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 2, duration: 1 } },
            ],
            F3: [
              { type: 'STAMP_PRESET', params: { preset: beatPresetName(7) } },
              { type: 'SET_BEAT_DELAY', params: { delay: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 3, duration: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 5, duration: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 7, duration: 1 } },
              { type: 'PLAY_NOTE', params: { pitch: 8, duration: 1 } },
            ],
          },
          'v3_bC'
        ),
      },
    ],
  },
];

// Re-export unused helper types for downstream tests if imported cleanly
export type { ActivityFormat, AntiBypassRule, CodeBlock, PartialHelpConfig, SceneInputConfig };
