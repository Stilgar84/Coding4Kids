import {
  CurriculumActivity,
  CurriculumGridDefinition,
  ExplanationDemoTab,
  PaletteConfig,
  ConditionExpr,
  ConditionSensorType,
} from './types';
import { CodeBlock, VariableName, WallEdge, WorkspaceState, toVariableName } from '../../types';

// ---------------------------------------------------------------------------
// Shared Workspace & Geometry Builders (Matches branchActivities / whileActivities)
// ---------------------------------------------------------------------------

type PartialBlock = Omit<CodeBlock, 'id'> & { id?: string };

let _uidSeq = 1;
function mkId(prefix: string): string {
  _uidSeq += 1;
  return `${prefix}_${_uidSeq}`;
}

function block(type: string, overrides: Partial<PartialBlock> = {}): PartialBlock {
  return { type, ...overrides };
}

function loopStart(repeatCount: number | string): PartialBlock {
  return { type: 'LOOP_START', repeatCount };
}

function varAssign(a: string, b: number | string): PartialBlock {
  return { type: 'VAR_ASSIGN', params: { a, b } };
}

function varOp(
  a: string,
  b: number | string,
  op: '+' | '-' | '*',
  c: number | string
): PartialBlock {
  return { type: 'VAR_OP', params: { a, b, op, c } };
}

function ifBlock(condition: ConditionExpr): PartialBlock {
  return { type: 'IF', params: { condition } };
}

function whileBlock(condition: ConditionExpr): PartialBlock {
  return { type: 'WHILE', params: { condition } };
}

function varList(...names: string[]): VariableName[] {
  return names.map(toVariableName);
}

function condSensor(sensor: ConditionSensorType, param?: string): ConditionExpr {
  return param !== undefined
    ? { kind: 'sensor', sensor, param }
    : { kind: 'sensor', sensor };
}

function placeholder(): PartialBlock {
  return { type: 'PLACEHOLDER', params: { hintCategory: 'any' } };
}

function materialize(blocks: PartialBlock[], prefix: string): CodeBlock[] {
  return blocks.map((b, idx) => ({
    ...b,
    id: b.id ?? `${prefix}_${idx}_${mkId(b.type)}`,
    ...(b.params ? { params: JSON.parse(JSON.stringify(b.params)) } : {}),
  }));
}

function makeWorkspace(
  scopes: {
    MAIN?: PartialBlock[];
    F1?: PartialBlock[];
    F2?: PartialBlock[];
    F3?: PartialBlock[];
  },
  prefix: string
): WorkspaceState {
  return {
    MAIN: materialize(scopes.MAIN ?? [], `${prefix}_main`),
    F1: materialize(scopes.F1 ?? [], `${prefix}_f1`),
    F2: materialize(scopes.F2 ?? [], `${prefix}_f2`),
    F3: materialize(scopes.F3 ?? [], `${prefix}_f3`),
  };
}

function buildSealedGridBarriers(
  width: number,
  height: number,
  openCells: Array<[number, number]>
): WallEdge[] {
  const openSet = new Set(openCells.map(([x, y]) => `${x},${y}`));
  const barriers: WallEdge[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!openSet.has(`${x},${y}`)) continue;
      if (x + 1 < width && !openSet.has(`${x + 1},${y}`)) {
        barriers.push({ x: x + 1, y, orientation: 'V' });
      }
      if (x - 1 >= 0 && !openSet.has(`${x - 1},${y}`)) {
        barriers.push({ x, y, orientation: 'V' });
      }
      if (y + 1 < height && !openSet.has(`${x},${y + 1}`)) {
        barriers.push({ x, y: y + 1, orientation: 'H' });
      }
      if (y - 1 >= 0 && !openSet.has(`${x},${y - 1}`)) {
        barriers.push({ x, y, orientation: 'H' });
      }
    }
  }
  const seen = new Set<string>();
  return barriers.filter((b) => {
    const k = `${b.x},${b.y},${b.orientation}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
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

const VAR_TURTLE_BASE_BLOCKS: string[] = [
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

const VAR_TURTLE_TELEPORT_BLOCKS: string[] = [...VAR_TURTLE_BASE_BLOCKS, 'TELEPORT'];

const VAR_TURTLE_PARAMS: Record<string, string[]> = {
  FORWARD: ['length'],
  BACKWARD: ['length'],
  TURN_LEFT: ['angle'],
  TURN_RIGHT: ['angle'],
  ARC_LEFT: ['radius', 'angle'],
  ARC_RIGHT: ['radius', 'angle'],
  SET_PEN_COLOR: ['color'],
  SET_PEN_WIDTH: ['width'],
  TELEPORT: ['x', 'y', 'heading'],
};

const VAR_BEAT_ALLOWED_BLOCKS: string[] = [
  'LIGHT_PIXEL',
  'LIGHT_ROW',
  'LIGHT_COL',
  'SET_LED_COLOR',
  'CLEAR_LEDS',
  'PLAY_NOTE',
  'SET_BEAT_DELAY',
  'WAIT_BEAT',
];

const VAR_BEAT_PARAMS: Record<string, string[]> = {
  PLAY_NOTE: ['pitch', 'duration'],
  SET_LED_COLOR: ['color'],
  LIGHT_ROW: ['y'],
  LIGHT_COL: ['x'],
  LIGHT_PIXEL: ['x', 'y'],
  SET_BEAT_DELAY: ['delay'],
  WAIT_BEAT: ['duration'],
};

const VAR_GRID_MOTION_ONLY: string[] = ['MOVE_FWD', 'TURN_LEFT', 'TURN_RIGHT'];

const VAR_GRID_INTERACTIVE: string[] = [
  'MOVE_FWD',
  'TURN_LEFT',
  'TURN_RIGHT',
  'PICK_UP',
  'USE_DROP',
];

// ---------------------------------------------------------------------------
// Activity Grids & Demo Tabs (Matching docs/curriculum/var/*.md verbatim)
// ---------------------------------------------------------------------------

// var.0 Tab 2/3 — Dial Corridor Variants (8x3, Start (1,1) E, Dial at (2,1) = 4 or 2)
const VAR_0_CORRIDOR_V1: CurriculumGridDefinition = {
  label: '1',
  width: 8,
  height: 3,
  robot: { x: 1, y: 1, dir: 'EAST' },
  barriers: buildSealedGridBarriers(8, 3, [
    [1, 1],
    [2, 1],
    [3, 1],
    [4, 1],
    [5, 1],
    [6, 1],
  ]),
  dialTiles: [{ x: 2, y: 1, value: 4 }],
  flags: [{ id: 'goal_var0_v1', x: 6, y: 1, isGoal: true, order: 1, collected: false }],
  requireAllItemsCollected: false,
  requireEmptyBackpackAtGoal: false,
  strictInteractionCollision: true,
};

const VAR_0_CORRIDOR_V2: CurriculumGridDefinition = {
  label: '2',
  width: 8,
  height: 3,
  robot: { x: 1, y: 1, dir: 'EAST' },
  barriers: buildSealedGridBarriers(8, 3, [
    [1, 1],
    [2, 1],
    [3, 1],
    [4, 1],
  ]),
  dialTiles: [{ x: 2, y: 1, value: 2 }],
  flags: [{ id: 'goal_var0_v2', x: 4, y: 1, isGoal: true, order: 1, collected: false }],
  requireAllItemsCollected: false,
  requireEmptyBackpackAtGoal: false,
  strictInteractionCollision: true,
};

const VAR_0_TABS: ExplanationDemoTab[] = [
  {
    id: 'var.0-tab1-turtle-house',
    label: '1',
    simId: 'turtle',
    coPilotCard:
      'Put a number inside a named box like s = 100, and every block wearing [s] uses that number! Change [s] once, and the walls and roof resize together.',
    turtle: {
      mode: 'static',
      showCanvasBounds: true,
    },
    workspace: makeWorkspace(
      {
        MAIN: [
          varAssign('s', 100),
          block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.blue } }),
          loopStart(4),
          block('FORWARD', { params: { length: 's' } }),
          block('TURN_RIGHT', { params: { angle: 90 } }),
          block('LOOP_END'),
          block('FORWARD', { params: { length: 's' } }),
          block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.orange } }),
          block('TURN_RIGHT', { params: { angle: 30 } }),
          block('FORWARD', { params: { length: 's' } }),
          block('TURN_RIGHT', { params: { angle: 120 } }),
          block('FORWARD', { params: { length: 's' } }),
        ],
      },
      'demo_var0_t1'
    ),
  },
  {
    id: 'var.0-tab2-dial-corridor-4',
    label: '2',
    simId: 'grid',
    coPilotCard:
      'Step onto a spinning dial and save d = $tileDial to lock its number into box [d]. Then MOVE_FWD [×d] walks the exact dial count to the goal!',
    grid: VAR_0_CORRIDOR_V1,
    workspace: makeWorkspace(
      {
        MAIN: [
          block('MOVE_FWD'),
          varAssign('d', '$tileDial'),
          block('MOVE_FWD', { repeatCount: 'd' }),
        ],
      },
      'demo_var0_t2'
    ),
  },
  {
    id: 'var.0-tab3-dial-corridor-2',
    label: '3',
    simId: 'grid',
    coPilotCard:
      'Step onto a spinning dial and save d = $tileDial to lock its number into box [d]. Then MOVE_FWD [×d] walks the exact dial count to the goal!',
    grid: VAR_0_CORRIDOR_V2,
    workspace: makeWorkspace(
      {
        MAIN: [
          block('MOVE_FWD'),
          varAssign('d', '$tileDial'),
          block('MOVE_FWD', { repeatCount: 'd' }),
        ],
      },
      'demo_var0_t3'
    ),
  },
];

// var.2 — Reading & Recalling a Dial Value (9x7, Start (1,5) E, Dial (2,5) = 2,3,4, TURN_LEFT North)
const VAR_2_GRIDS: CurriculumGridDefinition[] = [
  {
    d: 2,
    goal: [4, 3] as [number, number],
    openCells: [[1, 5], [2, 5], [3, 5], [4, 5], [4, 4], [4, 3]] as Array<[number, number]>,
  },
  {
    d: 3,
    goal: [5, 2] as [number, number],
    openCells: [[1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [5, 4], [5, 3], [5, 2]] as Array<
      [number, number]
    >,
  },
  {
    d: 4,
    goal: [6, 1] as [number, number],
    openCells: [
      [1, 5],
      [2, 5],
      [3, 5],
      [4, 5],
      [5, 5],
      [6, 5],
      [6, 4],
      [6, 3],
      [6, 2],
      [6, 1],
    ] as Array<[number, number]>,
  },
].map(({ d, goal, openCells }, idx) => ({
  label: `${idx + 1}`,
  width: 9,
  height: 7,
  robot: { x: 1, y: 5, dir: 'EAST' },
  barriers: buildSealedGridBarriers(9, 7, openCells),
  dialTiles: [{ x: 2, y: 5, value: d }],
  flags: [
    {
      id: `goal_var2_v${idx + 1}`,
      x: goal[0],
      y: goal[1],
      isGoal: true,
      order: 1,
      collected: false,
    },
  ],
  requireAllItemsCollected: false,
  requireEmptyBackpackAtGoal: false,
  strictInteractionCollision: true,
}));

// var.3 — Updating & Combining Variables (3 Demo Tabs)
const VAR_3_TAB1_GRID: CurriculumGridDefinition = {
  label: '1',
  width: 9,
  height: 6,
  robot: { x: 1, y: 4, dir: 'EAST' },
  barriers: buildSealedGridBarriers(9, 6, [
    [1, 4],
    [2, 4],
    [2, 3],
    [3, 3],
    [4, 3],
    [4, 2],
    [5, 2],
    [6, 2],
    [7, 2],
    [7, 1],
  ]),
  flags: [{ id: 'goal_var3_t1', x: 7, y: 1, isGoal: true, order: 1, collected: false }],
  requireAllItemsCollected: false,
  requireEmptyBackpackAtGoal: false,
  strictInteractionCollision: true,
};

const VAR_3_TAB2_GRID: CurriculumGridDefinition = {
  label: '2',
  width: 7,
  height: 7,
  robot: { x: 1, y: 5, dir: 'EAST' },
  barriers: buildSealedGridBarriers(7, 7, [
    [1, 5],
    [2, 5],
    [3, 5],
    [4, 5],
    [5, 5],
    [5, 4],
    [5, 3],
    [5, 2],
    [4, 2],
    [3, 2],
    [3, 3],
  ]),
  flags: [{ id: 'goal_var3_t2', x: 3, y: 3, isGoal: true, order: 1, collected: false }],
  requireAllItemsCollected: false,
  requireEmptyBackpackAtGoal: false,
  strictInteractionCollision: true,
};

const VAR_3_TAB3_GRID: CurriculumGridDefinition = {
  label: '3',
  width: 10,
  height: 9,
  robot: { x: 1, y: 7, dir: 'EAST' },
  barriers: buildSealedGridBarriers(10, 9, [
    [1, 7],
    [2, 7],
    [3, 7],
    [4, 7],
    [5, 7],
    [6, 7],
    [7, 7],
    [8, 7],
    [8, 6],
    [8, 5],
    [8, 4],
    [8, 3],
    [8, 2],
    [8, 1],
  ]),
  dialTiles: [
    { x: 2, y: 7, value: 2 },
    { x: 3, y: 7, value: 3 },
  ],
  flags: [{ id: 'goal_var3_t3', x: 8, y: 1, isGoal: true, order: 1, collected: false }],
  requireAllItemsCollected: false,
  requireEmptyBackpackAtGoal: false,
  strictInteractionCollision: true,
};

const VAR_3_TABS: ExplanationDemoTab[] = [
  {
    id: 'var.3-tab1-add',
    label: '1',
    simId: 'grid',
    coPilotCard:
      'a = a + 1 adds 1 to the old number inside [a] and saves the bigger number right back in [a]. Each loop turn, the robot steps 1 tile farther!',
    grid: VAR_3_TAB1_GRID,
    workspace: makeWorkspace(
      {
        MAIN: [
          varAssign('a', 1),
          loopStart(3),
          block('MOVE_FWD', { repeatCount: 'a' }),
          block('TURN_LEFT'),
          block('MOVE_FWD'),
          block('TURN_RIGHT'),
          varOp('a', 'a', '+', 1),
          block('LOOP_END'),
        ],
      },
      'demo_var3_t1'
    ),
  },
  {
    id: 'var.3-tab2-sub',
    label: '2',
    simId: 'grid',
    coPilotCard:
      'a = a - 1 takes 1 away from [a] each turn so the coil shrinks smoothly toward the center. Watch the Memory Tray count down 4, 3, 2, 1!',
    grid: VAR_3_TAB2_GRID,
    workspace: makeWorkspace(
      {
        MAIN: [
          varAssign('a', 4),
          loopStart(4),
          block('MOVE_FWD', { repeatCount: 'a' }),
          block('TURN_LEFT'),
          varOp('a', 'a', '-', 1),
          block('LOOP_END'),
        ],
      },
      'demo_var3_t2'
    ),
  },
  {
    id: 'var.3-tab3-mul',
    label: '3',
    simId: 'grid',
    coPilotCard:
      'Save two dials into [a] and [b], then compute [c = a + b] and [d = b * 2] before you walk. Math blocks calculate first, and action slots use the finished box!',
    grid: VAR_3_TAB3_GRID,
    workspace: makeWorkspace(
      {
        MAIN: [
          block('MOVE_FWD'),
          varAssign('a', '$tileDial'),
          block('MOVE_FWD'),
          varAssign('b', '$tileDial'),
          varOp('c', 'a', '+', 'b'),
          varOp('d', 'b', '*', 2),
          block('MOVE_FWD', { repeatCount: 'c' }),
          block('TURN_LEFT'),
          block('MOVE_FWD', { repeatCount: 'd' }),
        ],
      },
      'demo_var3_t3'
    ),
  },
];

// var.4 — Stepping Counters & Arithmetic Spirals (10x8, 3 variants: dial = 1, 2, 3 at (5,2))
const VAR_4_GRIDS: CurriculumGridDefinition[] = [
  {
    d: 1,
    goal: [3, 4] as [number, number],
    openCells: [[5, 2], [6, 2], [6, 3], [6, 4], [5, 4], [4, 4], [3, 4]] as Array<
      [number, number]
    >,
  },
  {
    d: 2,
    goal: [3, 5] as [number, number],
    openCells: [
      [5, 2],
      [6, 2],
      [7, 2],
      [7, 3],
      [7, 4],
      [7, 5],
      [6, 5],
      [5, 5],
      [4, 5],
      [3, 5],
    ] as Array<[number, number]>,
  },
  {
    d: 3,
    goal: [3, 6] as [number, number],
    openCells: [
      [5, 2],
      [6, 2],
      [7, 2],
      [8, 2],
      [8, 3],
      [8, 4],
      [8, 5],
      [8, 6],
      [7, 6],
      [6, 6],
      [5, 6],
      [4, 6],
      [3, 6],
    ] as Array<[number, number]>,
  },
].map(({ d, goal, openCells }, idx) => ({
  label: `${idx + 1}`,
  width: 10,
  height: 8,
  robot: { x: 5, y: 2, dir: 'EAST' },
  barriers: buildSealedGridBarriers(10, 8, openCells),
  dialTiles: [{ x: 5, y: 2, value: d }],
  flags: [
    {
      id: `goal_var4_v${idx + 1}`,
      x: goal[0],
      y: goal[1],
      isGoal: true,
      order: 1,
      collected: false,
    },
  ],
  requireAllItemsCollected: false,
  requireEmptyBackpackAtGoal: false,
  strictInteractionCollision: true,
}));

// var.4a — Corridor Beacon Counters (9x8, 4 variants: [3,6], [2,4,6], [2,3,5,7], [2,3,4,5,7])
const VAR_4A_BEACON_XS: number[][] = [
  [3, 6],
  [2, 4, 6],
  [2, 3, 5, 7],
  [2, 3, 4, 5, 7],
];

const VAR_4A_SHARED_WALKABLE: Array<[number, number]> = [
  [1, 1],
  [2, 1],
  [3, 1],
  [4, 1],
  [5, 1],
  [6, 1],
  [7, 1],
  [7, 2],
  [7, 3],
  [7, 4],
  [7, 5],
  [7, 6],
];

const VAR_4A_GRIDS: CurriculumGridDefinition[] = VAR_4A_BEACON_XS.map((xs, idx) => ({
  label: `${idx + 1}`,
  width: 9,
  height: 8,
  robot: { x: 1, y: 1, dir: 'EAST' },
  barriers: buildSealedGridBarriers(9, 8, VAR_4A_SHARED_WALKABLE),
  beaconTiles: xs.map((bx) => ({ x: bx, y: 1, color: 'red' as const })),
  flags: [
    {
      id: `goal_var4a_v${idx + 1}`,
      x: 7,
      y: 1 + xs.length,
      isGoal: true,
      order: 1,
      collected: false,
    },
  ],
  requireAllItemsCollected: false,
  requireEmptyBackpackAtGoal: false,
  strictInteractionCollision: true,
}));

// var.A — Inventory Quartermaster (9x8, 4 variants: [4], [3,5], [2,4,6], [2,3,5,6])
const VAR_A_BEACON_XS: number[][] = [
  [4],
  [3, 5],
  [2, 4, 6],
  [2, 3, 5, 6],
];

const VAR_A_GRIDS: CurriculumGridDefinition[] = VAR_A_BEACON_XS.map((xs, idx) => {
  const c = xs.length;
  return {
    label: `${idx + 1}`,
    width: 9,
    height: 8,
    robot: { x: 1, y: 1, dir: 'EAST' },
    barriers: buildSealedGridBarriers(9, 8, VAR_4A_SHARED_WALKABLE),
    beaconTiles: xs.map((bx) => ({ x: bx, y: 1, color: 'red' as const })),
    worldItems: [{ id: `cell_varA_v${idx + 1}`, type: 'crate', x: 7, y: 1 }],
    floorSwitches: [{ id: `sw_varA_v${idx + 1}`, x: 7, y: 1 + c, requiredForGoal: true }],
    flags: [
      {
        id: `goal_varA_v${idx + 1}`,
        x: 7,
        y: 2 + c,
        isGoal: true,
        order: 1,
        collected: false,
      },
    ],
    requireAllItemsCollected: false,
    requireEmptyBackpackAtGoal: true,
    strictInteractionCollision: true,
  };
});

// var.M1 — Multi-Dial Vault Combination (11x11, Start (1,9) E, Dials (2,9),(3,9),(4,9))
const VAR_M1_TRIPLES: Array<[number, number, number]> = [
  [1, 2, 1],
  [3, 1, 2],
  [2, 3, 1],
  [1, 3, 2],
];

const VAR_M1_SHARED_WALKABLE: Array<[number, number]> = [
  [1, 9],
  [2, 9],
  [3, 9],
  [4, 9],
  [5, 9],
  [6, 9],
  [7, 9],
  [8, 9],
  [9, 9],
  [7, 8],
  [8, 8],
  [9, 8],
  [7, 7],
  [8, 7],
  [9, 7],
  [7, 6],
  [8, 6],
  [9, 6],
  [7, 5],
  [8, 5],
  [9, 5],
  [7, 4],
  [8, 4],
  [9, 4],
  [7, 3],
  [8, 3],
  [9, 3],
  [7, 2],
  [8, 2],
  [9, 2],
  [7, 1],
  [8, 1],
  [9, 1],
];

const VAR_M1_GRIDS: CurriculumGridDefinition[] = VAR_M1_TRIPLES.map(([a, b, c], idx) => {
  const d = a + b;
  const e = b * 2;
  return {
    label: `${idx + 1}`,
    width: 11,
    height: 11,
    robot: { x: 1, y: 9, dir: 'EAST' },
    barriers: buildSealedGridBarriers(11, 11, VAR_M1_SHARED_WALKABLE),
    dialTiles: [
      { x: 2, y: 9, value: a },
      { x: 3, y: 9, value: b },
      { x: 4, y: 9, value: c },
    ],
    worldItems: [{ id: `core_varM1_v${idx + 1}`, type: 'crate', x: 4 + d, y: 9 }],
    floorSwitches: [
      { id: `sw_varM1_v${idx + 1}`, x: 4 + d, y: 9 - e, requiredForGoal: true },
    ],
    flags: [
      {
        id: `goal_varM1_v${idx + 1}`,
        x: 4 + d,
        y: 9 - e - c,
        isGoal: true,
        order: 1,
        collected: false,
      },
    ],
    requireAllItemsCollected: false,
    requireEmptyBackpackAtGoal: true,
    strictInteractionCollision: true,
  };
});

// ---------------------------------------------------------------------------
// Palette Configurations (Matching docs/curriculum/var/*.md verbatim)
// ---------------------------------------------------------------------------

const VAR_0_PALETTE: PaletteConfig = {
  allowedScopes: ['MAIN'],
  allowedSimBlocks: ['FORWARD', 'TURN_RIGHT', 'SET_PEN_COLOR', 'MOVE_FWD'],
  allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'VAR_ASSIGN'],
  allowVariables: true,
  allowedVariableNames: varList('s', 'd'),
  allowedValueSensors: ['$tileDial'],
  allowActionParams: true,
  allowRepeatBadges: true,
  allowedBlockParams: {
    FORWARD: ['length'],
    TURN_RIGHT: ['angle'],
    SET_PEN_COLOR: ['color'],
  },
};

const VAR_1_PALETTE: PaletteConfig = {
  allowedScopes: ['MAIN', 'F1'],
  allowedSimBlocks: VAR_TURTLE_BASE_BLOCKS,
  allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'CALL_F1', 'VAR_ASSIGN'],
  allowVariables: true,
  allowedVariableNames: varList('a', 'b', 'e', 's'),
  allowActionParams: true,
  allowRepeatBadges: true,
  allowedBlockParams: VAR_TURTLE_PARAMS,
};

const VAR_2_PALETTE: PaletteConfig = {
  allowedScopes: ['MAIN'],
  allowedSimBlocks: VAR_GRID_MOTION_ONLY,
  allowedControlBlocks: ['VAR_ASSIGN'],
  allowVariables: true,
  allowedVariableNames: varList('d'),
  allowedValueSensors: ['$tileDial'],
  allowActionParams: false,
  allowRepeatBadges: true,
};

const VAR_3_PALETTE: PaletteConfig = {
  allowedScopes: ['MAIN'],
  allowedSimBlocks: VAR_GRID_MOTION_ONLY,
  allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'VAR_ASSIGN', 'VAR_OP'],
  allowVariables: true,
  allowedVarOps: ['+', '-', '*'],
  allowedVariableNames: varList('a', 'b', 'c', 'd'),
  allowedValueSensors: ['$tileDial'],
  allowActionParams: false,
  allowRepeatBadges: true,
};

const VAR_4_PALETTE: PaletteConfig = {
  allowedScopes: ['MAIN'],
  allowedSimBlocks: VAR_GRID_MOTION_ONLY,
  allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'VAR_ASSIGN', 'VAR_OP'],
  allowVariables: true,
  allowedVarOps: ['+', '-', '*'],
  allowedVariableNames: varList('s'),
  allowedValueSensors: ['$tileDial'],
  allowActionParams: false,
  allowRepeatBadges: true,
};

const VAR_4A_PALETTE: PaletteConfig = {
  allowedScopes: ['MAIN'],
  allowedSimBlocks: VAR_GRID_MOTION_ONLY,
  allowedControlBlocks: ['WHILE', 'END_WHILE', 'IF', 'END_IF', 'VAR_ASSIGN', 'VAR_OP'],
  allowVariables: true,
  allowedVarOps: ['+', '-', '*'],
  allowedVariableNames: varList('c'),
  allowedSensors: ['pathAhead', 'tileColor'],
  allowActionParams: false,
  allowRepeatBadges: true,
};

const VAR_5_PALETTE: PaletteConfig = {
  allowedScopes: ['MAIN', 'F1'],
  allowedSimBlocks: VAR_TURTLE_BASE_BLOCKS,
  allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'CALL_F1', 'VAR_ASSIGN', 'VAR_OP'],
  allowVariables: true,
  allowedVarOps: ['+', '-', '*'],
  allowedVariableNames: varList('a'),
  allowActionParams: true,
  allowRepeatBadges: false,
  allowedBlockParams: VAR_TURTLE_PARAMS,
};

const VAR_6_PALETTE: PaletteConfig = {
  allowedScopes: ['MAIN', 'F1'],
  allowedSimBlocks: VAR_TURTLE_TELEPORT_BLOCKS,
  allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'CALL_F1', 'VAR_ASSIGN', 'VAR_OP'],
  allowVariables: true,
  allowedVarOps: ['+', '-', '*'],
  allowedVariableNames: varList('a', 'b', 'c'),
  allowedValueSensors: ['$x', '$y', '$heading'],
  allowActionParams: true,
  allowRepeatBadges: false,
  allowedBlockParams: VAR_TURTLE_PARAMS,
};

const VAR_7_PALETTE: PaletteConfig = {
  allowedScopes: ['MAIN', 'F1', 'F2'],
  allowedSimBlocks: VAR_BEAT_ALLOWED_BLOCKS,
  allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'CALL_F1', 'CALL_F2', 'VAR_ASSIGN', 'VAR_OP'],
  allowVariables: true,
  allowedVarOps: ['+', '-', '*'],
  allowedVariableNames: varList('c', 'p', 'r', 'x', 'y'),
  allowActionParams: true,
  allowRepeatBadges: true,
  allowedBlockParams: VAR_BEAT_PARAMS,
};

const VAR_8_PALETTE: PaletteConfig = {
  allowedScopes: ['MAIN', 'F1'],
  allowedSimBlocks: [
    'LIGHT_PIXEL',
    'SET_LED_COLOR',
    'PLAY_NOTE',
    'SET_BEAT_DELAY',
    'FORWARD',
    'TURN_RIGHT',
    'PEN_UP',
    'PEN_DOWN',
    'SET_PEN_COLOR',
    'SET_PEN_WIDTH',
    'TELEPORT',
  ],
  allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'CALL_F1', 'VAR_ASSIGN', 'VAR_OP'],
  allowVariables: true,
  allowedVarOps: ['+', '-', '*'],
  allowedVariableNames: varList('c', 'p', 'r', 'x', 'y'),
  allowedValueSensors: [
    '$randCoin',
    '$randD4',
    '$randD6',
    '$randD8',
    '$randD20',
    '$rand01',
    '$randomColor',
  ],
  allowActionParams: true,
  allowRepeatBadges: true,
  allowedBlockParams: {
    ...VAR_BEAT_PARAMS,
    ...VAR_TURTLE_PARAMS,
  },
};

const VAR_9_PALETTE: PaletteConfig = {
  allowedScopes: ['MAIN', 'F1', 'F2'],
  allowedSimBlocks: VAR_BEAT_ALLOWED_BLOCKS,
  allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'CALL_F1', 'CALL_F2', 'VAR_ASSIGN', 'VAR_OP'],
  allowVariables: true,
  allowedVarOps: ['+', '-', '*'],
  allowedVariableNames: varList('c', 'm', 'p', 'r'),
  allowedValueSensors: [
    '$randCoin',
    '$randD4',
    '$randD6',
    '$randD8',
    '$randD20',
    '$rand01',
    '$randomColor',
  ],
  allowActionParams: true,
  allowRepeatBadges: true,
  allowedBlockParams: VAR_BEAT_PARAMS,
};

const VAR_10_PALETTE: PaletteConfig = {
  allowedScopes: ['MAIN', 'F1', 'F2'],
  allowedSimBlocks: VAR_TURTLE_TELEPORT_BLOCKS,
  allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'CALL_F1', 'CALL_F2', 'VAR_ASSIGN', 'VAR_OP'],
  allowVariables: true,
  allowedVarOps: ['+', '-', '*'],
  allowedVariableNames: varList('a', 'd', 'r', 's', 'u', 'v', 'x', 'y'),
  allowedValueSensors: [
    '$x',
    '$y',
    '$heading',
    '$randCoin',
    '$randD4',
    '$randD6',
    '$randD8',
    '$randD20',
    '$rand01',
    '$randomColor',
  ],
  allowActionParams: true,
  allowRepeatBadges: false,
  allowedBlockParams: VAR_TURTLE_PARAMS,
};

const VAR_A_PALETTE: PaletteConfig = {
  allowedScopes: ['MAIN'],
  allowedSimBlocks: VAR_GRID_INTERACTIVE,
  allowedControlBlocks: ['WHILE', 'END_WHILE', 'IF', 'END_IF', 'VAR_ASSIGN', 'VAR_OP'],
  allowVariables: true,
  allowedVarOps: ['+', '-', '*'],
  allowedVariableNames: varList('c'),
  allowedSensors: ['pathAhead', 'tileColor'],
  allowActionParams: false,
  allowRepeatBadges: true,
};

const VAR_B_PALETTE: PaletteConfig = {
  allowedScopes: ['MAIN', 'F1', 'F2', 'F3'],
  allowedSimBlocks: VAR_TURTLE_TELEPORT_BLOCKS,
  allowedControlBlocks: [
    'LOOP_START',
    'LOOP_END',
    'CALL_F1',
    'CALL_F2',
    'CALL_F3',
    'VAR_ASSIGN',
    'VAR_OP',
  ],
  allowVariables: true,
  allowedVarOps: ['+', '-', '*'],
  allowedVariableNames: varList('a', 'x', 'y'),
  allowedValueSensors: [
    '$x',
    '$y',
    '$heading',
    '$randCoin',
    '$randD4',
    '$randD6',
    '$randD8',
    '$randD20',
    '$rand01',
    '$randomColor',
  ],
  allowActionParams: true,
  allowRepeatBadges: false,
  allowedBlockParams: VAR_TURTLE_PARAMS,
};

const VAR_M1_PALETTE: PaletteConfig = {
  allowedScopes: ['MAIN'],
  allowedSimBlocks: VAR_GRID_INTERACTIVE,
  allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'VAR_ASSIGN', 'VAR_OP'],
  allowVariables: true,
  allowedVarOps: ['+', '-', '*'],
  allowedVariableNames: varList('a', 'b', 'c', 'd', 'e'),
  allowedValueSensors: ['$tileDial'],
  allowActionParams: false,
  allowRepeatBadges: true,
};

const VAR_M2_PALETTE: PaletteConfig = {
  allowedScopes: ['MAIN', 'F1', 'F2'],
  allowedSimBlocks: VAR_TURTLE_TELEPORT_BLOCKS,
  allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'CALL_F1', 'CALL_F2', 'VAR_ASSIGN', 'VAR_OP'],
  allowVariables: true,
  allowedVarOps: ['+', '-', '*'],
  allowedVariableNames: varList('a', 'b', 'h', 'u', 'v', 'w', 'x', 'y'),
  allowedValueSensors: ['$x', '$y', '$heading'],
  allowActionParams: true,
  allowRepeatBadges: false,
  allowedBlockParams: VAR_TURTLE_PARAMS,
};

// ---------------------------------------------------------------------------
// Module var Activities (Exact var/overview.md Order: var.0..var.M2)
// ---------------------------------------------------------------------------

export const VAR_ACTIVITIES: CurriculumActivity[] = [
  // =========================================================================
  // var.0 — Variable Memory Boxes (Explanation, Turtle + Grid)
  // =========================================================================
  {
    id: 'var.0',
    moduleId: 'var',
    version: 1,
    format: 'explanation',
    simId: 'turtle',
    icon: '📦',
    title: 'Variable Memory Boxes',
    concept: 'Store a number in a named box (s = 100 or d = Dial) and reuse it across blocks',
    description:
      'Watch how a single memory box controls an entire LOGO house or reads floor dials of different lengths.',
    hint: 'Switch between Tab 1, Tab 2, and Tab 3 and press Run to watch [s] and [d] update.',
    coPilotCard:
      'Put a number inside a named box like s = 100, and every block wearing [s] uses that number! Change [s] once, and the walls and roof resize together.',
    palette: VAR_0_PALETTE,
    starterWorkspace: VAR_0_TABS[0].workspace,
    demoTabs: VAR_0_TABS,
  },

  // =========================================================================
  // var.1 — Variables as Single-Point Constants (Creative, Turtle)
  // =========================================================================
  {
    id: 'var.1',
    moduleId: 'var',
    version: 1,
    format: 'sandbox',
    simId: 'turtle',
    icon: '🏠',
    title: 'Variables as Single-Point Constants',
    concept: 'Configure size and feature constants in Main and pass them cleanly across shapes and F1',
    description:
      'Define constants once in Main (s, a, b, e) so changing a single value resizes houses, pixel bot faces, and scaled blueprints.',
    hint: 'Change s = 100 at the top of Main, or pick a Variation Card to explore F1 scaling.',
    palette: VAR_1_PALETTE,
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          varAssign('s', 100),
          block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.blue } }),
          loopStart(4),
          block('FORWARD', { params: { length: 's' } }),
          block('TURN_RIGHT', { params: { angle: 90 } }),
          block('LOOP_END'),
          block('FORWARD', { params: { length: 's' } }),
          block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.orange } }),
          block('TURN_RIGHT', { params: { angle: 30 } }),
          block('FORWARD', { params: { length: 's' } }),
          block('TURN_RIGHT', { params: { angle: 120 } }),
          block('FORWARD', { params: { length: 's' } }),
        ],
      },
      'start_var1'
    ),
    variations: [
      {
        id: 'var.1-var1-neon-mansion',
        title: 'Giant Neon Mansion',
        icon: '🏰',
        workspace: makeWorkspace(
          {
            MAIN: [
              varAssign('s', 150),
              block('SET_PEN_WIDTH', { params: { width: 8 } }),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.purple } }),
              loopStart(4),
              block('FORWARD', { params: { length: 's' } }),
              block('TURN_RIGHT', { params: { angle: 90 } }),
              block('LOOP_END'),
              block('FORWARD', { params: { length: 's' } }),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.amber } }),
              block('TURN_RIGHT', { params: { angle: 30 } }),
              block('FORWARD', { params: { length: 's' } }),
              block('TURN_RIGHT', { params: { angle: 120 } }),
              block('FORWARD', { params: { length: 's' } }),
            ],
          },
          'v1_var1'
        ),
      },
      {
        id: 'var.1-var2-pixel-bot',
        title: 'Variable Pixel Bot Face',
        icon: '🤖',
        workspace: makeWorkspace(
          {
            MAIN: [
              varAssign('s', 200),
              varAssign('e', 40),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.blue } }),
              loopStart(4),
              block('FORWARD', { params: { length: 's' } }),
              block('TURN_RIGHT', { params: { angle: 90 } }),
              block('LOOP_END'),
              block('PEN_UP'),
              block('FORWARD', { params: { length: 'e' }, repeatCount: 3 }),
              block('TURN_RIGHT', { params: { angle: 90 } }),
              block('FORWARD', { params: { length: 'e' } }),
              block('TURN_LEFT', { params: { angle: 90 } }),
              block('CALL_F1'),
              block('CALL_F1'),
              block('BACKWARD', { params: { length: 'e' }, repeatCount: 2 }),
              block('TURN_LEFT', { params: { angle: 90 } }),
              block('FORWARD', { params: { length: 'e' } }),
              block('PEN_DOWN'),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.orange } }),
              block('FORWARD', { params: { length: 'e' }, repeatCount: 3 }),
            ],
            F1: [
              block('PEN_DOWN'),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.cyan } }),
              loopStart(4),
              block('FORWARD', { params: { length: 'e' } }),
              block('TURN_RIGHT', { params: { angle: 90 } }),
              block('LOOP_END'),
              block('PEN_UP'),
              block('TURN_RIGHT', { params: { angle: 90 } }),
              block('FORWARD', { params: { length: 'e' }, repeatCount: 2 }),
              block('TURN_LEFT', { params: { angle: 90 } }),
            ],
          },
          'v2_var1'
        ),
      },
      {
        id: 'var.1-var3-twin-blueprints',
        title: 'Twin Scaled Blueprints',
        icon: '🏘️',
        workspace: makeWorkspace(
          {
            MAIN: [
              varAssign('s', 150),
              varAssign('b', 75),
              varAssign('a', 's'),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.blue } }),
              block('CALL_F1'),
              block('FORWARD', { params: { length: 50 } }),
              block('TURN_LEFT', { params: { angle: 90 } }),
              varAssign('a', 'b'),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.orange } }),
              block('CALL_F1'),
            ],
            F1: [
              block('PEN_DOWN'),
              loopStart(4),
              block('FORWARD', { params: { length: 'a' } }),
              block('TURN_RIGHT', { params: { angle: 90 } }),
              block('LOOP_END'),
              block('FORWARD', { params: { length: 'a' } }),
              block('TURN_RIGHT', { params: { angle: 30 } }),
              block('FORWARD', { params: { length: 'a' } }),
              block('TURN_RIGHT', { params: { angle: 120 } }),
              block('FORWARD', { params: { length: 'a' } }),
              block('PEN_UP'),
              block('TURN_RIGHT', { params: { angle: 30 } }),
              block('FORWARD', { params: { length: 'a' } }),
              block('TURN_LEFT', { params: { angle: 90 } }),
            ],
          },
          'v3_var1'
        ),
      },
    ],
  },

  // =========================================================================
  // var.2 — Reading & Recalling a Dial Value (Puzzle, Grid)
  // =========================================================================
  {
    id: 'var.2',
    moduleId: 'var',
    version: 1,
    format: 'puzzle',
    simId: 'grid',
    icon: '🎛️',
    title: 'Reading & Recalling a Dial Value',
    concept: 'Read $tileDial once into box d and recall [d] on both separated L-corridor strides',
    description:
      'Step onto the floor dial, save its number in box d, and walk d steps East then turn left North d steps to reach Goal across all 3 variants.',
    hint: 'Read d = $tileDial first, then use MOVE_FWD [×d], TURN_LEFT, MOVE_FWD [×d].',
    palette: VAR_2_PALETTE,
    slotCap: {
      maxTotal: 8,
      perScope: { MAIN: 8 },
    },
    grid: VAR_2_GRIDS[0],
    gridVariants: VAR_2_GRIDS,
    starterWorkspace: makeWorkspace(
      {
        MAIN: [block('MOVE_FWD'), varAssign('d', '$tileDial')],
      },
      'start_var2'
    ),
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeWorkspace(
        {
          MAIN: [
            block('MOVE_FWD'),
            varAssign('d', '$tileDial'),
            placeholder(),
            block('TURN_LEFT'),
            placeholder(),
          ],
        },
        'scaf_var2'
      ),
    },
    referenceSolution: makeWorkspace(
      {
        MAIN: [
          block('MOVE_FWD'),
          varAssign('d', '$tileDial'),
          block('MOVE_FWD', { repeatCount: 'd' }),
          block('TURN_LEFT'),
          block('MOVE_FWD', { repeatCount: 'd' }),
        ],
      },
      'ref_var2'
    ),
    antiBypassRules: [
      {
        id: 'var.2-starter-must-fail',
        description: 'Unedited starter only reads the dial without walking down the corridor',
        unmodifiedStarterMustFail: true,
        minStarterEditDistance: 1,
      },
      {
        id: 'var.2-require-dial-variable',
        description: 'Three unequal L-corridors (d=2,3,4) require reading dial d into a variable',
        allowVariables: false,
        singleVariantBypassMustExist: true,
      },
    ],
  },

  // =========================================================================
  // var.3 — Updating & Combining Variables (Explanation, Grid)
  // =========================================================================
  {
    id: 'var.3',
    moduleId: 'var',
    version: 1,
    format: 'explanation',
    simId: 'grid',
    icon: '➕',
    title: 'Updating & Combining Variables',
    concept: 'Update variables with +, -, and * (a = a + 1, a = a - 1, c = a + b, d = b * 2)',
    description:
      'Watch how the 3-address math block updates an existing variable box or combines two dial readings.',
    hint: 'Switch between Tab 1, Tab 2, and Tab 3 and press Run to inspect each variable update.',
    coPilotCard:
      'a = a + 1 adds 1 to the old number inside [a] and saves the bigger number right back in [a]. Each loop turn, the robot steps 1 tile farther!',
    palette: VAR_3_PALETTE,
    starterWorkspace: VAR_3_TABS[0].workspace,
    grid: VAR_3_TAB1_GRID,
    demoTabs: VAR_3_TABS,
  },

  // =========================================================================
  // var.4 — Stepping Counters & Arithmetic Spirals (Puzzle, Grid)
  // =========================================================================
  {
    id: 'var.4',
    moduleId: 'var',
    version: 1,
    format: 'puzzle',
    simId: 'grid',
    icon: '📐',
    title: 'Stepping Counters & Arithmetic Spirals',
    concept: 'Increment starting dial s inside a Loop x3 spiral (s = s + 1)',
    description:
      'Read the start dial into s, then inside Loop x3 step [×s], turn right, and update s = s + 1.',
    hint: 'Keep TURN_RIGHT and add s = s + 1 inside Loop x3.',
    palette: VAR_4_PALETTE,
    slotCap: {
      maxTotal: 9,
      perScope: { MAIN: 9 },
    },
    grid: VAR_4_GRIDS[0],
    gridVariants: VAR_4_GRIDS,
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          varAssign('s', '$tileDial'),
          loopStart(3),
          block('MOVE_FWD', { repeatCount: 's' }),
          block('LOOP_END'),
        ],
      },
      'start_var4'
    ),
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeWorkspace(
        {
          MAIN: [
            varAssign('s', '$tileDial'),
            loopStart(3),
            block('MOVE_FWD', { repeatCount: 's' }),
            block('TURN_RIGHT'),
            placeholder(),
            block('LOOP_END'),
          ],
        },
        'scaf_var4'
      ),
    },
    referenceSolution: makeWorkspace(
      {
        MAIN: [
          varAssign('s', '$tileDial'),
          loopStart(3),
          block('MOVE_FWD', { repeatCount: 's' }),
          block('TURN_RIGHT'),
          varOp('s', 's', '+', 1),
          block('LOOP_END'),
        ],
      },
      'ref_var4'
    ),
    antiBypassRules: [
      {
        id: 'var.4-starter-must-fail',
        description: 'Unedited starter walks straight into the eastern wall on iteration 2',
        unmodifiedStarterMustFail: true,
        minStarterEditDistance: 1,
      },
      {
        id: 'var.4-require-variable-stepping',
        description: 'Three coil sizes (dial=1,2,3) cannot all be solved without variables',
        allowVariables: false,
        singleVariantBypassMustExist: true,
      },
    ],
  },

  // =========================================================================
  // var.4a — Corridor Beacon Counters (Puzzle, Grid)
  // =========================================================================
  {
    id: 'var.4a',
    moduleId: 'var',
    version: 1,
    format: 'puzzle',
    simId: 'grid',
    icon: '🚨',
    title: 'Corridor Beacon Counters',
    concept: 'Count red beacons while walking with While + If, then recall tally c on the open shaft',
    description:
      'Zero box c, walk down the corridor counting red beacons with c = c + 1, then turn right and walk MOVE_FWD [×c] to Goal.',
    hint: 'Inside While pathAhead after MOVE_FWD: If Red Beacon -> c = c + 1, then MOVE_FWD [×c].',
    palette: VAR_4A_PALETTE,
    slotCap: {
      maxTotal: 12,
      perScope: { MAIN: 12 },
    },
    grid: VAR_4A_GRIDS[0],
    gridVariants: VAR_4A_GRIDS,
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          varAssign('c', 0),
          whileBlock(condSensor('pathAhead')),
          block('MOVE_FWD'),
          block('END_WHILE'),
          block('TURN_RIGHT'),
          block('MOVE_FWD'),
        ],
      },
      'start_var4a'
    ),
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeWorkspace(
        {
          MAIN: [
            varAssign('c', 0),
            whileBlock(condSensor('pathAhead')),
            block('MOVE_FWD'),
            ifBlock(condSensor('tileColor', 'red')),
            placeholder(),
            block('END_IF'),
            block('END_WHILE'),
            block('TURN_RIGHT'),
            placeholder(),
          ],
        },
        'scaf_var4a'
      ),
    },
    referenceSolution: makeWorkspace(
      {
        MAIN: [
          varAssign('c', 0),
          whileBlock(condSensor('pathAhead')),
          block('MOVE_FWD'),
          ifBlock(condSensor('tileColor', 'red')),
          varOp('c', 'c', '+', 1),
          block('END_IF'),
          block('END_WHILE'),
          block('TURN_RIGHT'),
          block('MOVE_FWD', { repeatCount: 'c' }),
        ],
      },
      'ref_var4a'
    ),
    antiBypassRules: [
      {
        id: 'var.4a-starter-must-fail',
        description: 'Unedited starter steps only once down the shaft with c = 0',
        unmodifiedStarterMustFail: true,
        minStarterEditDistance: 1,
      },
      {
        id: 'var.4a-require-beacon-counting',
        description: 'Open vertical shaft with 2..5 beacon variants blocks fixed-repeat and blind-While bypasses',
        forbidBlocks: ['WHILE'],
        allowVariables: false,
      },
    ],
  },

  // =========================================================================
  // var.5 — Growing & Shrinking Loops — Spirals (Creative, Turtle)
  // =========================================================================
  {
    id: 'var.5',
    moduleId: 'var',
    version: 1,
    format: 'sandbox',
    simId: 'turtle',
    icon: '🐚',
    title: 'Growing & Shrinking Loops — Spirals',
    concept: 'Update length variable a inside Loop to spin squares, vortices, shells, wormholes, and galaxies',
    description:
      'Put a self-updating variable (a = a + 12 or a = a - 15) inside a Loop to draw classic spirals, 122° vortices, Nautilus shells, and two-tone galaxy arms.',
    hint: 'Try editing + 12 or turning angle 90°, or switch Variation Cards to see ARC_RIGHT and shrinking spirals.',
    palette: VAR_5_PALETTE,
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          varAssign('a', 20),
          block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.blue } }),
          block('SET_PEN_WIDTH', { params: { width: 5 } }),
          loopStart(24),
          block('FORWARD', { params: { length: 'a' } }),
          block('TURN_RIGHT', { params: { angle: 90 } }),
          varOp('a', 'a', '+', 12),
          block('LOOP_END'),
        ],
      },
      'start_var5'
    ),
    variations: [
      {
        id: 'var.5-var1-skewed-vortex',
        title: 'Hypnotic Skewed Vortex',
        icon: '🔺',
        workspace: makeWorkspace(
          {
            MAIN: [
              varAssign('a', 20),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.purple } }),
              block('SET_PEN_WIDTH', { params: { width: 4 } }),
              loopStart(30),
              block('FORWARD', { params: { length: 'a' } }),
              block('TURN_RIGHT', { params: { angle: 122 } }),
              varOp('a', 'a', '+', 10),
              block('LOOP_END'),
            ],
          },
          'v1_var5'
        ),
      },
      {
        id: 'var.5-var2-nautilus-shell',
        title: 'Nautilus Curved Shell',
        icon: '🐌',
        workspace: makeWorkspace(
          {
            MAIN: [
              varAssign('a', 15),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.cyan } }),
              block('SET_PEN_WIDTH', { params: { width: 5 } }),
              loopStart(18),
              block('ARC_RIGHT', { params: { radius: 'a', angle: 90 } }),
              varOp('a', 'a', '+', 10),
              block('LOOP_END'),
            ],
          },
          'v2_var5'
        ),
      },
      {
        id: 'var.5-var3-gravity-wormhole',
        title: 'Shrinking Gravity Wormhole',
        icon: '🌀',
        workspace: makeWorkspace(
          {
            MAIN: [
              varAssign('a', 220),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.orange } }),
              block('SET_PEN_WIDTH', { params: { width: 5 } }),
              loopStart(14),
              block('FORWARD', { params: { length: 'a' } }),
              block('TURN_RIGHT', { params: { angle: 88 } }),
              varOp('a', 'a', '-', 15),
              block('LOOP_END'),
            ],
          },
          'v3_var5'
        ),
      },
      {
        id: 'var.5-var4-galaxy-arm',
        title: 'Two-Tone Rainbow Galaxy Arm',
        icon: '🌌',
        workspace: makeWorkspace(
          {
            MAIN: [
              varAssign('a', 20),
              block('SET_PEN_WIDTH', { params: { width: 5 } }),
              loopStart(14),
              block('CALL_F1'),
              block('LOOP_END'),
            ],
            F1: [
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.cyan } }),
              block('FORWARD', { params: { length: 'a' } }),
              block('TURN_RIGHT', { params: { angle: 89 } }),
              varOp('a', 'a', '+', 12),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.pink } }),
              block('FORWARD', { params: { length: 'a' } }),
              block('TURN_RIGHT', { params: { angle: 89 } }),
              varOp('a', 'a', '+', 12),
            ],
          },
          'v4_var5'
        ),
      },
    ],
  },

  // =========================================================================
  // var.6 — TELEPORT & Pose Sensors ($x, $y, $heading) (Explanation, Turtle)
  // =========================================================================
  {
    id: 'var.6',
    moduleId: 'var',
    version: 1,
    format: 'explanation',
    simId: 'turtle',
    icon: '🧭',
    title: 'TELEPORT & Pose Sensors',
    concept: 'Jump directly with TELEPORT(x, y, heading) and bookmark pose sensors $x, $y, $heading',
    description:
      'Use TELEPORT with PEN_UP / PEN_DOWN to draw separated shapes, and save $x, $y, $heading into a, b, c to warp back cleanly.',
    hint: 'Compare Tab 1 (Remote Twin Stars) and Tab 2 (Pose Bookmark & Heading Restore).',
    coPilotCard:
      'TELEPORT [x, y, heading] warps the turtle instantly to any spot and direction you type! Wrap jumps with PEN_UP and PEN_DOWN so no travel streaks connect separate shapes.',
    palette: VAR_6_PALETTE,
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          block('TELEPORT', { params: { x: -145, y: 45, heading: 18 } }),
          block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.blue } }),
          block('CALL_F1'),
          block('TELEPORT', { params: { x: 75, y: 45, heading: 18 } }),
          block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.orange } }),
          block('CALL_F1'),
        ],
        F1: [
          block('PEN_DOWN'),
          loopStart(5),
          block('FORWARD', { params: { length: 110 } }),
          block('TURN_RIGHT', { params: { angle: 144 } }),
          block('LOOP_END'),
          block('PEN_UP'),
        ],
      },
      'demo_var6_start'
    ),
    demoTabs: [
      {
        id: 'var.6-tab1-twin-stars',
        label: '1',
        simId: 'turtle',
        coPilotCard:
          'TELEPORT [x, y, heading] warps the turtle instantly to any spot and direction you type! Wrap jumps with PEN_UP and PEN_DOWN so no travel streaks connect separate shapes.',
        workspace: makeWorkspace(
          {
            MAIN: [
              block('TELEPORT', { params: { x: -145, y: 45, heading: 18 } }),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.blue } }),
              block('CALL_F1'),
              block('TELEPORT', { params: { x: 75, y: 45, heading: 18 } }),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.orange } }),
              block('CALL_F1'),
            ],
            F1: [
              block('PEN_DOWN'),
              loopStart(5),
              block('FORWARD', { params: { length: 110 } }),
              block('TURN_RIGHT', { params: { angle: 144 } }),
              block('LOOP_END'),
              block('PEN_UP'),
            ],
          },
          'demo_var6_t1'
        ),
      },
      {
        id: 'var.6-tab2-pose-bookmark',
        label: '2',
        simId: 'turtle',
        coPilotCard:
          'Save a = $x, b = $y, and c = $heading before wandering away. Later, TELEPORT [a, b, c] beams the turtle straight back to its exact spot and angle!',
        workspace: makeWorkspace(
          {
            MAIN: [
              block('TELEPORT', { params: { x: -90, y: -40, heading: 45 } }),
              varAssign('a', '$x'),
              varAssign('b', '$y'),
              varAssign('c', '$heading'),
              block('PEN_DOWN'),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.purple } }),
              loopStart(6),
              block('FORWARD', { params: { length: 130 } }),
              block('TURN_RIGHT', { params: { angle: 75 } }),
              block('LOOP_END'),
              block('PEN_UP'),
              block('TELEPORT', { params: { x: 'a', y: 'b', heading: 'c' } }),
              block('PEN_DOWN'),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.green } }),
              block('FORWARD', { params: { length: 130 } }),
            ],
          },
          'demo_var6_t2'
        ),
      },
    ],
  },

  // =========================================================================
  // var.7 — Sweeping Coordinates & Scales (Creative, Beat)
  // =========================================================================
  {
    id: 'var.7',
    moduleId: 'var',
    version: 1,
    format: 'sandbox',
    simId: 'beat',
    icon: '🎹',
    title: 'Sweeping Coordinates & Scales',
    concept: 'Step LED rows, columns, and C Major pitches synchronously using variable arithmetic',
    description:
      'Use r, c, x, y, and p inside Loops and F1/F2 helpers to sweep rainbow scales, X-crosshairs, equalizer bars, sirens, and 1..12 overdrive columns.',
    hint: 'Pair r, c, and p updates inside Loop, or split rising F1 and falling F2 sweeps.',
    palette: VAR_7_PALETTE,
    beatRules: { cleanResetOnInputChange: true },
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          block('SET_BEAT_DELAY', { params: { delay: 0.5 } }),
          varAssign('p', 1),
          varAssign('r', 8),
          varAssign('c', 1),
          loopStart(8),
          block('SET_LED_COLOR', { params: { color: BEAT_COLORS.cyan } }),
          block('LIGHT_PIXEL', { params: { x: 'c', y: 'r' } }),
          block('PLAY_NOTE', { params: { pitch: 'p', duration: 0.5 } }),
          varOp('p', 'p', '+', 1),
          varOp('r', 'r', '-', 1),
          varOp('c', 'c', '+', 1),
          block('LOOP_END'),
        ],
      },
      'start_var7'
    ),
    variations: [
      {
        id: 'var.7-var1-x-crosshair',
        title: 'Diagonal X-Crosshair Sweep',
        icon: '❌',
        workspace: makeWorkspace(
          {
            MAIN: [
              block('SET_BEAT_DELAY', { params: { delay: 0.25 } }),
              varAssign('x', 1),
              varAssign('y', 8),
              varAssign('p', 1),
              loopStart(8),
              block('SET_LED_COLOR', { params: { color: BEAT_COLORS.purple } }),
              block('LIGHT_PIXEL', { params: { x: 'x', y: 'x' } }),
              block('SET_LED_COLOR', { params: { color: BEAT_COLORS.amber } }),
              block('LIGHT_PIXEL', { params: { x: 'x', y: 'y' } }),
              block('PLAY_NOTE', { params: { pitch: 'p', duration: 0.5 } }),
              varOp('x', 'x', '+', 1),
              varOp('y', 'y', '-', 1),
              varOp('p', 'p', '+', 1),
              block('LOOP_END'),
            ],
          },
          'v1_var7'
        ),
      },
      {
        id: 'var.7-var2-equalizer',
        title: 'Nested Variable Equalizer Bars',
        icon: '📶',
        workspace: makeWorkspace(
          {
            MAIN: [
              block('SET_BEAT_DELAY', { params: { delay: 0.25 } }),
              varAssign('c', 1),
              varAssign('p', 1),
              loopStart(8),
              varAssign('r', 8),
              block('SET_LED_COLOR', { params: { color: BEAT_COLORS.green } }),
              loopStart('c'),
              block('LIGHT_PIXEL', { params: { x: 'c', y: 'r' } }),
              varOp('r', 'r', '-', 1),
              block('LOOP_END'),
              block('PLAY_NOTE', { params: { pitch: 'p', duration: 0.5 } }),
              varOp('c', 'c', '+', 1),
              varOp('p', 'p', '+', 1),
              block('LOOP_END'),
            ],
          },
          'v2_var7'
        ),
      },
      {
        id: 'var.7-var3-siren',
        title: 'F1/F2 Up-and-Down Police Siren',
        icon: '🚓',
        workspace: makeWorkspace(
          {
            MAIN: [
              block('SET_BEAT_DELAY', { params: { delay: 0.25 } }),
              varAssign('r', 1),
              varAssign('p', 1),
              loopStart(3),
              block('CALL_F1'),
              block('CALL_F2'),
              block('LOOP_END'),
            ],
            F1: [
              loopStart(7),
              block('SET_LED_COLOR', { params: { color: BEAT_COLORS.red } }),
              block('LIGHT_ROW', { params: { y: 'r' } }),
              block('PLAY_NOTE', { params: { pitch: 'p', duration: 0.5 } }),
              block('SET_LED_COLOR', { params: { color: BEAT_COLORS.black } }),
              block('LIGHT_ROW', { params: { y: 'r' } }),
              varOp('r', 'r', '+', 1),
              varOp('p', 'p', '+', 1),
              block('LOOP_END'),
            ],
            F2: [
              loopStart(7),
              block('SET_LED_COLOR', { params: { color: BEAT_COLORS.blue } }),
              block('LIGHT_ROW', { params: { y: 'r' } }),
              block('PLAY_NOTE', { params: { pitch: 'p', duration: 0.5 } }),
              block('SET_LED_COLOR', { params: { color: BEAT_COLORS.black } }),
              block('LIGHT_ROW', { params: { y: 'r' } }),
              varOp('r', 'r', '-', 1),
              varOp('p', 'p', '-', 1),
              block('LOOP_END'),
            ],
          },
          'v3_var7'
        ),
      },
      {
        id: 'var.7-var4-overdrive',
        title: 'Two-Octave Overdrive Column Sweep',
        icon: '🚀',
        workspace: makeWorkspace(
          {
            MAIN: [
              block('SET_BEAT_DELAY', { params: { delay: 0.25 } }),
              varAssign('c', 1),
              varAssign('p', 1),
              loopStart(12),
              block('SET_LED_COLOR', { params: { color: BEAT_COLORS.amber } }),
              block('LIGHT_COL', { params: { x: 'c' } }),
              block('PLAY_NOTE', { params: { pitch: 'p', duration: 0.5 } }),
              varOp('c', 'c', '+', 1),
              varOp('p', 'p', '+', 1),
              block('LOOP_END'),
            ],
          },
          'v4_var7'
        ),
      },
    ],
  },

  // =========================================================================
  // var.8 — Random Dice & $randomColor (Explanation, Beat + Turtle)
  // =========================================================================
  {
    id: 'var.8',
    moduleId: 'var',
    version: 1,
    format: 'explanation',
    simId: 'beat',
    icon: '🎲',
    title: 'Random Dice & $randomColor',
    concept: 'Roll dice sensors ($randCoin, $randD4..$randD20, $rand01) and $randomColor for generative music and art',
    description:
      'Discover how dice boxes pick fresh notes, LED pads, and TELEPORT star locations every run.',
    hint: 'Compare Tab 1 (Beat Matrix D8) and Tab 2 (LOGO D20 Star Sky), then run twice.',
    coPilotCard:
      'Pick a die like D8 (1..8) to roll a random C Major note and a random pad row/column! Plug [$randomColor] right into the paint block for instant confetti lights.',
    palette: VAR_8_PALETTE,
    beatRules: { cleanResetOnInputChange: true },
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          block('SET_BEAT_DELAY', { params: { delay: 0.5 } }),
          loopStart(8),
          varAssign('p', '$randD8'),
          varAssign('r', '$randD8'),
          varAssign('c', '$randD8'),
          block('SET_LED_COLOR', { params: { color: '$randomColor' } }),
          block('LIGHT_PIXEL', { params: { x: 'c', y: 'r' } }),
          block('PLAY_NOTE', { params: { pitch: 'p', duration: 0.5 } }),
          block('LOOP_END'),
        ],
      },
      'demo_var8_start'
    ),
    demoTabs: [
      {
        id: 'var.8-tab1-beat-dice',
        label: '1',
        simId: 'beat',
        coPilotCard:
          'Pick a die like D8 (1..8) to roll a random C Major note and a random pad row/column! Plug [$randomColor] right into the paint block for instant confetti lights.',
        beatRules: { cleanResetOnInputChange: true },
        workspace: makeWorkspace(
          {
            MAIN: [
              block('SET_BEAT_DELAY', { params: { delay: 0.5 } }),
              loopStart(8),
              varAssign('p', '$randD8'),
              varAssign('r', '$randD8'),
              varAssign('c', '$randD8'),
              block('SET_LED_COLOR', { params: { color: '$randomColor' } }),
              block('LIGHT_PIXEL', { params: { x: 'c', y: 'r' } }),
              block('PLAY_NOTE', { params: { pitch: 'p', duration: 0.5 } }),
              block('LOOP_END'),
            ],
          },
          'demo_var8_t1'
        ),
      },
      {
        id: 'var.8-tab2-turtle-dice',
        label: '2',
        simId: 'turtle',
        coPilotCard:
          'Roll D20 dice and multiply to scatter stars anywhere across the sky! Re-run to deal a fresh sky, or lock a seed number to replay the exact same art.',
        workspace: makeWorkspace(
          {
            MAIN: [
              block('SET_PEN_WIDTH', { params: { width: 5 } }),
              loopStart(8),
              varAssign('x', '$randD20'),
              varOp('x', 'x', '*', 18),
              varOp('x', 'x', '-', 190),
              varAssign('y', '$randD20'),
              varOp('y', 'y', '*', 14),
              varOp('y', 'y', '-', 140),
              block('TELEPORT', { params: { x: 'x', y: 'y', heading: 18 } }),
              block('SET_PEN_COLOR', { params: { color: '$randomColor' } }),
              block('CALL_F1'),
              block('LOOP_END'),
            ],
            F1: [
              block('PEN_DOWN'),
              loopStart(5),
              block('FORWARD', { params: { length: 65 } }),
              block('TURN_RIGHT', { params: { angle: 144 } }),
              block('LOOP_END'),
              block('PEN_UP'),
            ],
          },
          'demo_var8_t2'
        ),
      },
    ],
  },

  // =========================================================================
  // var.9 — Dice Beat & Light DJ (Creative, Beat)
  // =========================================================================
  {
    id: 'var.9',
    moduleId: 'var',
    version: 1,
    format: 'sandbox',
    simId: 'beat',
    icon: '🎧',
    title: 'Dice Beat & Light DJ',
    concept: 'Improvise C Major melodies (1..16), Loop x[c] coin-flip drops, and strobe F1/F2 jams',
    description:
      'Use random dice and $randomColor to jam across 8x8 LEDs with two-octave arpeggios, Loop x[c] coin-flip drops, and F1/F2 strobes.',
    hint: 'Store $randCoin in c for Loop x[c] (0 skips safely, 1 plays F1!), or double $randD8 via m = p * 2.',
    palette: VAR_9_PALETTE,
    beatRules: { cleanResetOnInputChange: true },
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          block('CLEAR_LEDS'),
          block('SET_BEAT_DELAY', { params: { delay: 0.5 } }),
          loopStart(16),
          varAssign('p', '$randD8'),
          varAssign('r', '$randD8'),
          varAssign('c', '$randD8'),
          block('SET_LED_COLOR', { params: { color: '$randomColor' } }),
          block('LIGHT_PIXEL', { params: { x: 'c', y: 'r' } }),
          block('PLAY_NOTE', { params: { pitch: 'p', duration: 0.5 } }),
          block('LOOP_END'),
        ],
      },
      'start_var9'
    ),
    variations: [
      {
        id: 'var.9-var1-starlight-arpeggio',
        title: 'Two-Octave Starlight Arpeggio',
        icon: '✨',
        workspace: makeWorkspace(
          {
            MAIN: [
              block('SET_BEAT_DELAY', { params: { delay: 0.25 } }),
              loopStart(16),
              varAssign('p', '$randD8'),
              varOp('m', 'p', '*', 2),
              varAssign('r', '$randD8'),
              block('SET_LED_COLOR', { params: { color: '$randomColor' } }),
              block('LIGHT_ROW', { params: { y: 'r' } }),
              block('PLAY_NOTE', { params: { pitch: 'm', duration: 0.5 } }),
              block('LOOP_END'),
            ],
          },
          'v1_var9'
        ),
      },
      {
        id: 'var.9-var2-coin-flip-stutter',
        title: 'Coin-Flip Stutter Drop',
        icon: '🪙',
        workspace: makeWorkspace(
          {
            MAIN: [
              block('SET_BEAT_DELAY', { params: { delay: 0.25 } }),
              loopStart(16),
              block('SET_LED_COLOR', { params: { color: BEAT_COLORS.cyan } }),
              block('LIGHT_COL', { params: { x: 1 } }),
              block('PLAY_NOTE', { params: { pitch: 1, duration: 0.5 } }),
              varAssign('c', '$randCoin'),
              loopStart('c'),
              block('CALL_F1'),
              block('LOOP_END'),
              block('SET_LED_COLOR', { params: { color: BEAT_COLORS.black } }),
              block('LIGHT_COL', { params: { x: 1 } }),
              block('LOOP_END'),
            ],
            F1: [
              block('SET_LED_COLOR', { params: { color: '$randomColor' } }),
              varAssign('r', '$randD8'),
              block('LIGHT_ROW', { params: { y: 'r' } }),
              varAssign('p', '$randD4'),
              block('PLAY_NOTE', { params: { pitch: 'p', duration: 0.5 } }),
              block('SET_LED_COLOR', { params: { color: BEAT_COLORS.black } }),
              block('LIGHT_ROW', { params: { y: 'r' } }),
            ],
          },
          'v2_var9'
        ),
      },
      {
        id: 'var.9-var3-twin-strobe',
        title: 'Twin Strobe Crosshair Jam',
        icon: '🎛️',
        workspace: makeWorkspace(
          {
            MAIN: [
              block('CLEAR_LEDS'),
              block('SET_BEAT_DELAY', { params: { delay: 0.25 } }),
              loopStart(8),
              block('CALL_F1'),
              block('CALL_F2'),
              block('LOOP_END'),
            ],
            F1: [
              varAssign('r', '$randD8'),
              varAssign('p', '$randD4'),
              block('SET_LED_COLOR', { params: { color: '$randomColor' } }),
              block('LIGHT_ROW', { params: { y: 'r' } }),
              block('PLAY_NOTE', { params: { pitch: 'p', duration: 0.5 } }),
              block('SET_LED_COLOR', { params: { color: BEAT_COLORS.black } }),
              block('LIGHT_ROW', { params: { y: 'r' } }),
              block('WAIT_BEAT', { params: { duration: 0.25 } }),
              block('PLAY_NOTE', { params: { pitch: 1, duration: 0.5 } }),
            ],
            F2: [
              varAssign('c', '$randD8'),
              varAssign('m', '$randD8'),
              varOp('m', 'm', '+', 8),
              block('SET_LED_COLOR', { params: { color: '$randomColor' } }),
              block('LIGHT_COL', { params: { x: 'c' } }),
              block('PLAY_NOTE', { params: { pitch: 'm', duration: 0.5 } }),
              block('SET_LED_COLOR', { params: { color: BEAT_COLORS.black } }),
              block('LIGHT_COL', { params: { x: 'c' } }),
              block('WAIT_BEAT', { params: { duration: 0.25 } }),
            ],
          },
          'v3_var9'
        ),
      },
    ],
  },

  // =========================================================================
  // var.10 — Confetti, TELEPORT Fireworks & Random Walkers (Creative, Turtle)
  // =========================================================================
  {
    id: 'var.10',
    moduleId: 'var',
    version: 1,
    format: 'sandbox',
    simId: 'turtle',
    icon: '🎆',
    title: 'Confetti, TELEPORT Fireworks & Random Walkers',
    concept: 'Combine TELEPORT, 3-address dice math, $randomColor, and F1 helpers for generative art',
    description:
      'Build confetti starfields, cosmic random walkers with $rand01 * 360, neon starburst fireworks, and 4-way mirrored kaleidoscope quilts.',
    hint: 'Compute negative coordinates with u = 0 - x before passing [u, y, 90] into TELEPORT.',
    palette: VAR_10_PALETTE,
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          block('SET_PEN_WIDTH', { params: { width: 5 } }),
          loopStart(14),
          varAssign('x', '$randD20'),
          varOp('x', 'x', '*', 20),
          varOp('x', 'x', '-', 210),
          varAssign('y', '$randD20'),
          varOp('y', 'y', '*', 15),
          varOp('y', 'y', '-', 155),
          block('TELEPORT', { params: { x: 'x', y: 'y', heading: 18 } }),
          block('SET_PEN_COLOR', { params: { color: '$randomColor' } }),
          block('CALL_F1'),
          block('LOOP_END'),
        ],
        F1: [
          block('PEN_DOWN'),
          loopStart(5),
          block('FORWARD', { params: { length: 60 } }),
          block('TURN_RIGHT', { params: { angle: 144 } }),
          block('LOOP_END'),
          block('PEN_UP'),
        ],
      },
      'start_var10'
    ),
    variations: [
      {
        id: 'var.10-var1-cosmic-walker',
        title: 'Cosmic Random Walker',
        icon: '🚶',
        workspace: makeWorkspace(
          {
            MAIN: [
              block('SET_PEN_WIDTH', { params: { width: 6 } }),
              loopStart(45),
              varAssign('a', '$rand01'),
              varOp('a', 'a', '*', 360),
              block('TURN_RIGHT', { params: { angle: 'a' } }),
              varAssign('d', '$randD6'),
              varOp('d', 'd', '*', 18),
              block('SET_PEN_COLOR', { params: { color: '$randomColor' } }),
              block('FORWARD', { params: { length: 'd' } }),
              block('LOOP_END'),
            ],
          },
          'v1_var10'
        ),
      },
      {
        id: 'var.10-var2-neon-fireworks',
        title: 'Neon Fireworks Night',
        icon: '🎇',
        workspace: makeWorkspace(
          {
            MAIN: [
              block('SET_PEN_WIDTH', { params: { width: 5 } }),
              loopStart(6),
              varAssign('x', '$randD8'),
              varOp('x', 'x', '*', 55),
              varOp('x', 'x', '-', 245),
              varAssign('y', '$randD6'),
              varOp('y', 'y', '*', 50),
              varOp('y', 'y', '-', 175),
              block('TELEPORT', { params: { x: 'x', y: 'y', heading: 0 } }),
              block('CALL_F1'),
              block('LOOP_END'),
            ],
            F1: [
              loopStart(12),
              varAssign('r', '$randD6'),
              varOp('r', 'r', '*', 14),
              block('SET_PEN_COLOR', { params: { color: '$randomColor' } }),
              block('PEN_DOWN'),
              block('FORWARD', { params: { length: 'r' } }),
              block('PEN_UP'),
              block('BACKWARD', { params: { length: 'r' } }),
              block('TURN_RIGHT', { params: { angle: 30 } }),
              block('LOOP_END'),
            ],
          },
          'v2_var10'
        ),
      },
      {
        id: 'var.10-var3-kaleidoscope-quilt',
        title: 'Confetti Kaleidoscope Quilt',
        icon: '💠',
        workspace: makeWorkspace(
          {
            MAIN: [
              block('SET_PEN_WIDTH', { params: { width: 5 } }),
              loopStart(8),
              varAssign('x', '$randD8'),
              varOp('x', 'x', '*', 22),
              varAssign('y', '$randD8'),
              varOp('y', 'y', '*', 22),
              varOp('u', 0, '-', 'x'),
              varOp('v', 0, '-', 'y'),
              varAssign('s', '$randD6'),
              varOp('s', 's', '*', 10),
              block('SET_PEN_COLOR', { params: { color: '$randomColor' } }),
              block('TELEPORT', { params: { x: 'x', y: 'y', heading: 0 } }),
              block('CALL_F1'),
              block('TELEPORT', { params: { x: 'u', y: 'y', heading: 90 } }),
              block('CALL_F1'),
              block('TELEPORT', { params: { x: 'u', y: 'v', heading: 180 } }),
              block('CALL_F1'),
              block('TELEPORT', { params: { x: 'x', y: 'v', heading: 270 } }),
              block('CALL_F1'),
              block('LOOP_END'),
            ],
            F1: [
              block('PEN_DOWN'),
              loopStart(4),
              block('FORWARD', { params: { length: 's' } }),
              block('TURN_RIGHT', { params: { angle: 90 } }),
              block('LOOP_END'),
              block('PEN_UP'),
            ],
          },
          'v3_var10'
        ),
      },
    ],
  },

  // =========================================================================
  // var.A — Inventory Quartermaster (Puzzle Capstone, Grid)
  // =========================================================================
  {
    id: 'var.A',
    moduleId: 'var',
    version: 1,
    format: 'puzzle',
    capstoneType: 'puzzle',
    simId: 'grid',
    icon: '🏆',
    title: 'Inventory Quartermaster',
    concept: 'Count beacons into c, haul the Energy Cell [×c] onto the Floor Switch, then reach Goal',
    description:
      'Scan the corridor counting red beacons in box c, pick up the Energy Cell at (7, 1), march [×c] south, drop it onto the switch, and step forward onto Goal.',
    hint: 'After counting c beacons: PICK_UP, TURN_RIGHT, MOVE_FWD [×c], USE_DROP, MOVE_FWD.',
    palette: VAR_A_PALETTE,
    slotCap: {
      maxTotal: 15,
      perScope: { MAIN: 15 },
    },
    grid: VAR_A_GRIDS[0],
    gridVariants: VAR_A_GRIDS,
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          varAssign('c', 0),
          whileBlock(condSensor('pathAhead')),
          block('MOVE_FWD'),
          block('END_WHILE'),
        ],
      },
      'start_varA'
    ),
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeWorkspace(
        {
          MAIN: [
            varAssign('c', 0),
            whileBlock(condSensor('pathAhead')),
            block('MOVE_FWD'),
            ifBlock(condSensor('tileColor', 'red')),
            placeholder(),
            block('END_IF'),
            block('END_WHILE'),
            block('PICK_UP'),
            block('TURN_RIGHT'),
            placeholder(),
            block('USE_DROP'),
            block('MOVE_FWD'),
          ],
        },
        'scaf_varA'
      ),
    },
    referenceSolution: makeWorkspace(
      {
        MAIN: [
          varAssign('c', 0),
          whileBlock(condSensor('pathAhead')),
          block('MOVE_FWD'),
          ifBlock(condSensor('tileColor', 'red')),
          varOp('c', 'c', '+', 1),
          block('END_IF'),
          block('END_WHILE'),
          block('PICK_UP'),
          block('TURN_RIGHT'),
          block('MOVE_FWD', { repeatCount: 'c' }),
          block('USE_DROP'),
          block('MOVE_FWD'),
        ],
      },
      'ref_varA'
    ),
    antiBypassRules: [
      {
        id: 'var.A-starter-must-fail',
        description: 'Unedited starter leaves the Energy Cell untouched at (7, 1)',
        unmodifiedStarterMustFail: true,
        minStarterEditDistance: 1,
      },
      {
        id: 'var.A-require-drop-on-switch',
        description: 'Shuttered Goal requires picking up and dropping the Energy Cell onto the switch',
        forbidBlocks: ['USE_DROP'],
      },
      {
        id: 'var.A-require-beacon-counter',
        description: 'Variable switch depths (c=1..4) require counting beacons into c',
        forbidBlocks: ['WHILE'],
        allowVariables: false,
      },
    ],
  },

  // =========================================================================
  // var.B — Spiral, Wave & Telemetry Studio (Creative Capstone, Turtle)
  // =========================================================================
  {
    id: 'var.B',
    moduleId: 'var',
    version: 1,
    format: 'sandbox',
    capstoneType: 'creative',
    simId: 'turtle',
    icon: '🎨',
    title: 'Spiral, Wave & Telemetry Studio',
    concept: 'Synthesize TELEPORT, F1..F3 helpers, growing/shrinking math, and $x/$y pose bookmarks',
    description:
      'Compose bold mathematical tapestries combining mirror galaxies, Nautilus scrolls, pyramid waves with $x/$y crest stars, and 4-corner spiro-gardens.',
    hint: 'Save x = $x and y = $y at mid-wave before flying F3 back to crown the peak.',
    palette: VAR_B_PALETTE,
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          block('SET_PEN_WIDTH', { params: { width: 4 } }),
          block('TELEPORT', { params: { x: -135, y: 0, heading: 0 } }),
          block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.cyan } }),
          block('CALL_F1'),
          block('TELEPORT', { params: { x: 135, y: 0, heading: 180 } }),
          block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.purple } }),
          block('CALL_F1'),
        ],
        F1: [
          varAssign('a', 16),
          block('PEN_DOWN'),
          loopStart(18),
          block('FORWARD', { params: { length: 'a' } }),
          block('TURN_RIGHT', { params: { angle: 89 } }),
          varOp('a', 'a', '+', 8),
          block('LOOP_END'),
          block('PEN_UP'),
        ],
      },
      'start_varB'
    ),
    variations: [
      {
        id: 'var.B-var1-dragon-nautilus',
        title: 'Twin Dragon Nautilus Scroll',
        icon: '🐉',
        workspace: makeWorkspace(
          {
            MAIN: [
              block('SET_PEN_WIDTH', { params: { width: 5 } }),
              block('TELEPORT', { params: { x: 0, y: 0, heading: 0 } }),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.cyan } }),
              block('CALL_F1'),
              block('TELEPORT', { params: { x: 0, y: 0, heading: 180 } }),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.orange } }),
              block('CALL_F1'),
            ],
            F1: [
              varAssign('a', 15),
              block('PEN_DOWN'),
              loopStart(14),
              block('ARC_RIGHT', { params: { radius: 'a', angle: 90 } }),
              varOp('a', 'a', '+', 12),
              block('LOOP_END'),
              block('PEN_UP'),
            ],
          },
          'v1_varB'
        ),
      },
      {
        id: 'var.B-var2-pyramid-wave',
        title: 'Rainbow Pyramid Wave + $x/$y Star Crest',
        icon: '⛰️',
        workspace: makeWorkspace(
          {
            MAIN: [
              varAssign('a', 40),
              block('TELEPORT', { params: { x: -320, y: 80, heading: 0 } }),
              block('PEN_DOWN'),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.cyan } }),
              loopStart(4),
              block('CALL_F1'),
              block('LOOP_END'),
              varAssign('x', '$x'),
              varAssign('y', '$y'),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.pink } }),
              loopStart(4),
              block('CALL_F2'),
              block('LOOP_END'),
              block('PEN_UP'),
              varOp('y', 'y', '-', 135),
              varOp('x', 'x', '-', 22),
              block('TELEPORT', { params: { x: 'x', y: 'y', heading: 18 } }),
              block('CALL_F3'),
            ],
            F1: [
              block('TURN_RIGHT', { params: { angle: 30 } }),
              block('FORWARD', { params: { length: 'a' } }),
              block('TURN_RIGHT', { params: { angle: 120 } }),
              block('FORWARD', { params: { length: 'a' } }),
              block('TURN_LEFT', { params: { angle: 150 } }),
              varOp('a', 'a', '+', 24),
            ],
            F2: [
              varOp('a', 'a', '-', 24),
              block('TURN_RIGHT', { params: { angle: 30 } }),
              block('FORWARD', { params: { length: 'a' } }),
              block('TURN_RIGHT', { params: { angle: 120 } }),
              block('FORWARD', { params: { length: 'a' } }),
              block('TURN_LEFT', { params: { angle: 150 } }),
            ],
            F3: [
              block('PEN_DOWN'),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.amber } }),
              loopStart(5),
              block('FORWARD', { params: { length: 65 } }),
              block('TURN_RIGHT', { params: { angle: 144 } }),
              block('LOOP_END'),
              block('PEN_UP'),
            ],
          },
          'v2_varB'
        ),
      },
      {
        id: 'var.B-var3-spiro-garden',
        title: 'Four-Corner Spiro-Garden',
        icon: '🌺',
        workspace: makeWorkspace(
          {
            MAIN: [
              block('SET_PEN_WIDTH', { params: { width: 4 } }),
              block('TELEPORT', { params: { x: -145, y: -115, heading: 0 } }),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.blue } }),
              block('CALL_F1'),
              block('TELEPORT', { params: { x: 145, y: -115, heading: 90 } }),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.pink } }),
              block('CALL_F1'),
              block('TELEPORT', { params: { x: 145, y: 115, heading: 180 } }),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.green } }),
              block('CALL_F1'),
              block('TELEPORT', { params: { x: -145, y: 115, heading: 270 } }),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.amber } }),
              block('CALL_F1'),
            ],
            F1: [
              varAssign('a', 12),
              block('PEN_DOWN'),
              loopStart(16),
              block('FORWARD', { params: { length: 'a' } }),
              block('TURN_RIGHT', { params: { angle: 115 } }),
              varOp('a', 'a', '+', 8),
              block('LOOP_END'),
              block('PEN_UP'),
            ],
          },
          'v3_varB'
        ),
      },
    ],
  },

  // =========================================================================
  // var.M1 — Multi-Dial Vault Combination (Mastery Challenge, Grid, 0-starter)
  // =========================================================================
  {
    id: 'var.M1',
    moduleId: 'var',
    version: 1,
    format: 'challenge',
    simId: 'grid',
    icon: '🔐',
    title: 'Multi-Dial Vault Combination',
    concept: 'Read dials a, b, c, compute d = a + b and e = b * 2, drop Core on Switch (4+d, 9-e), then walk [×c] to Goal',
    description:
      'No starter blocks! Read dials a, b, and c at (2..4, 9), compute d = a + b and e = b * 2, walk [×d] to pick up the Vault Core, turn North [×e] to drop it on sw_0, then walk [×c] to Goal.',
    hint: 'Read a, b, c with MOVE_FWD steps, compute d = a + b and e = b * 2, then [×d], PICK_UP, TURN_LEFT, [×e], USE_DROP, [×c].',
    palette: VAR_M1_PALETTE,
    slotCap: {
      maxTotal: 20,
      perScope: { MAIN: 20 },
    },
    grid: VAR_M1_GRIDS[0],
    gridVariants: VAR_M1_GRIDS,
    starterWorkspace: makeWorkspace({ MAIN: [] }, 'start_varM1'),
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeWorkspace(
        {
          MAIN: [
            block('MOVE_FWD'),
            varAssign('a', '$tileDial'),
            block('MOVE_FWD'),
            varAssign('b', '$tileDial'),
            block('MOVE_FWD'),
            varAssign('c', '$tileDial'),
            placeholder(),
            placeholder(),
            placeholder(),
            block('PICK_UP'),
            block('TURN_LEFT'),
            placeholder(),
            block('USE_DROP'),
            placeholder(),
          ],
        },
        'scaf_varM1'
      ),
    },
    referenceSolution: makeWorkspace(
      {
        MAIN: [
          block('MOVE_FWD'),
          varAssign('a', '$tileDial'),
          block('MOVE_FWD'),
          varAssign('b', '$tileDial'),
          block('MOVE_FWD'),
          varAssign('c', '$tileDial'),
          varOp('d', 'a', '+', 'b'),
          varOp('e', 'b', '*', 2),
          block('MOVE_FWD', { repeatCount: 'd' }),
          block('PICK_UP'),
          block('TURN_LEFT'),
          block('MOVE_FWD', { repeatCount: 'e' }),
          block('USE_DROP'),
          block('MOVE_FWD', { repeatCount: 'c' }),
        ],
      },
      'ref_varM1'
    ),
    antiBypassRules: [
      {
        id: 'var.M1-starter-must-fail',
        description: 'Empty 0-block mastery starter fails immediately',
        unmodifiedStarterMustFail: true,
        minStarterEditDistance: 1,
      },
      {
        id: 'var.M1-require-variables',
        description: 'Four (a,b,c) vault combinations require variables and dial math',
        allowVariables: false,
      },
    ],
  },

  // =========================================================================
  // var.M2 — Counter-Rotating Opposing Spirals (Mastery Challenge, Turtle)
  // =========================================================================
  {
    id: 'var.M2',
    moduleId: 'var',
    version: 1,
    format: 'challenge',
    simId: 'turtle',
    icon: '☯️',
    title: 'Counter-Rotating Opposing Spirals',
    concept: 'Complete CW spiral with counter-rotating CCW spiral and dual $x/$y/$heading bookmark braids',
    description:
      'Build from the 10-block CW cyan spiral starter to complete sequential double helices, simultaneous braided pinwheels, and twin arc tapestries.',
    hint: 'Assign b = 186 and TELEPORT [0, 0, 180] after the cyan spiral, or interleave F1 (x,y,h) and F2 (u,v,w).',
    palette: VAR_M2_PALETTE,
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          varAssign('a', 16),
          block('SET_PEN_WIDTH', { params: { width: 4 } }),
          block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.cyan } }),
          loopStart(18),
          block('FORWARD', { params: { length: 'a' } }),
          block('TURN_RIGHT', { params: { angle: 89 } }),
          varOp('a', 'a', '+', 10),
          block('LOOP_END'),
          block('PEN_UP'),
          block('TELEPORT', { params: { x: 0, y: 0, heading: 0 } }),
        ],
      },
      'start_varM2'
    ),
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeWorkspace(
        {
          MAIN: [
            varAssign('a', 16),
            placeholder(),
            block('SET_PEN_WIDTH', { params: { width: 4 } }),
            block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.cyan } }),
            loopStart(18),
            block('FORWARD', { params: { length: 'a' } }),
            block('TURN_RIGHT', { params: { angle: 89 } }),
            varOp('a', 'a', '+', 10),
            block('LOOP_END'),
            block('PEN_UP'),
            placeholder(),
            block('PEN_DOWN'),
            block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.orange } }),
            loopStart(18),
            placeholder(),
            placeholder(),
            placeholder(),
            block('LOOP_END'),
          ],
        },
        'scaf_varM2'
      ),
    },
    referenceSolution: makeWorkspace(
      {
        MAIN: [
          varAssign('a', 16),
          varAssign('b', 186),
          block('SET_PEN_WIDTH', { params: { width: 4 } }),
          block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.cyan } }),
          loopStart(18),
          block('FORWARD', { params: { length: 'a' } }),
          block('TURN_RIGHT', { params: { angle: 89 } }),
          varOp('a', 'a', '+', 10),
          block('LOOP_END'),
          block('PEN_UP'),
          block('TELEPORT', { params: { x: 0, y: 0, heading: 180 } }),
          block('PEN_DOWN'),
          block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.orange } }),
          loopStart(18),
          block('FORWARD', { params: { length: 'b' } }),
          block('TURN_LEFT', { params: { angle: 89 } }),
          varOp('b', 'b', '-', 10),
          block('LOOP_END'),
        ],
      },
      'ref_varM2'
    ),
    variations: [
      {
        id: 'var.M2-target1-sequential-helix',
        title: 'Target 1: Sequential Double Helix',
        icon: '🌀',
        workspace: makeWorkspace(
          {
            MAIN: [
              varAssign('a', 16),
              varAssign('b', 186),
              block('SET_PEN_WIDTH', { params: { width: 4 } }),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.cyan } }),
              loopStart(18),
              block('FORWARD', { params: { length: 'a' } }),
              block('TURN_RIGHT', { params: { angle: 89 } }),
              varOp('a', 'a', '+', 10),
              block('LOOP_END'),
              block('PEN_UP'),
              block('TELEPORT', { params: { x: 0, y: 0, heading: 180 } }),
              block('PEN_DOWN'),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.orange } }),
              loopStart(18),
              block('FORWARD', { params: { length: 'b' } }),
              block('TURN_LEFT', { params: { angle: 89 } }),
              varOp('b', 'b', '-', 10),
              block('LOOP_END'),
            ],
          },
          't1_varM2'
        ),
      },
      {
        id: 'var.M2-target2-braided-pinwheel',
        title: 'Target 2: Simultaneous Braided Pinwheel',
        icon: '🧬',
        workspace: makeWorkspace(
          {
            MAIN: [
              varAssign('a', 16),
              varAssign('b', 186),
              varAssign('x', 0),
              varAssign('y', 0),
              varAssign('h', 0),
              varAssign('u', 0),
              varAssign('v', 0),
              varAssign('w', 180),
              block('SET_PEN_WIDTH', { params: { width: 4 } }),
              loopStart(18),
              block('CALL_F1'),
              block('CALL_F2'),
              block('LOOP_END'),
            ],
            F1: [
              block('PEN_UP'),
              block('TELEPORT', { params: { x: 'x', y: 'y', heading: 'h' } }),
              block('PEN_DOWN'),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.cyan } }),
              block('FORWARD', { params: { length: 'a' } }),
              block('TURN_RIGHT', { params: { angle: 89 } }),
              varOp('a', 'a', '+', 10),
              varAssign('x', '$x'),
              varAssign('y', '$y'),
              varAssign('h', '$heading'),
            ],
            F2: [
              block('PEN_UP'),
              block('TELEPORT', { params: { x: 'u', y: 'v', heading: 'w' } }),
              block('PEN_DOWN'),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.purple } }),
              block('FORWARD', { params: { length: 'b' } }),
              block('TURN_LEFT', { params: { angle: 89 } }),
              varOp('b', 'b', '-', 10),
              varAssign('u', '$x'),
              varAssign('v', '$y'),
              varAssign('w', '$heading'),
            ],
          },
          't2_varM2'
        ),
      },
      {
        id: 'var.M2-target3-arc-tapestry',
        title: 'Target 3: Twin Bookmark Arc Tapestry',
        icon: '🪡',
        workspace: makeWorkspace(
          {
            MAIN: [
              varAssign('a', 18),
              varAssign('b', 168),
              varAssign('x', -110),
              varAssign('y', 0),
              varAssign('h', 0),
              varAssign('u', 110),
              varAssign('v', 0),
              varAssign('w', 0),
              block('SET_PEN_WIDTH', { params: { width: 4 } }),
              loopStart(16),
              block('CALL_F1'),
              block('CALL_F2'),
              block('LOOP_END'),
            ],
            F1: [
              block('PEN_UP'),
              block('TELEPORT', { params: { x: 'x', y: 'y', heading: 'h' } }),
              block('PEN_DOWN'),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.cyan } }),
              block('ARC_RIGHT', { params: { radius: 'a', angle: 90 } }),
              varOp('a', 'a', '+', 10),
              varAssign('x', '$x'),
              varAssign('y', '$y'),
              varAssign('h', '$heading'),
            ],
            F2: [
              block('PEN_UP'),
              block('TELEPORT', { params: { x: 'u', y: 'v', heading: 'w' } }),
              block('PEN_DOWN'),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.amber } }),
              block('ARC_LEFT', { params: { radius: 'b', angle: 90 } }),
              varOp('b', 'b', '-', 10),
              varAssign('u', '$x'),
              varAssign('v', '$y'),
              varAssign('w', '$heading'),
            ],
          },
          't3_varM2'
        ),
      },
    ],
  },
];
