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
  'DRUM_KICK',
  'DRUM_SNARE',
  'DRUM_CLAP',
  'PLAY_CHIME',
  'WAIT_BEAT',
  'CLEAR_LEDS',
  'PLAY_NOTE',
  'SET_LED_COLOR',
  'LIGHT_ROW',
  'LIGHT_COL',
  'LIGHT_PIXEL',
  'SET_BEAT_DELAY',
  'STAMP_PRESET',
];

const VAR_BEAT_PARAMS: Record<string, string[]> = {
  PLAY_NOTE: ['pitch', 'duration'],
  SET_LED_COLOR: ['color'],
  LIGHT_ROW: ['y'],
  LIGHT_COL: ['x'],
  LIGHT_PIXEL: ['x', 'y'],
  SET_BEAT_DELAY: ['delay'],
  WAIT_BEAT: ['duration'],
  STAMP_PRESET: ['preset'],
};

const VAR_GRID_ALLOWED_BLOCKS: string[] = [
  'MOVE_FWD',
  'MOVE_BACK',
  'TURN_LEFT',
  'TURN_RIGHT',
  'PICK_UP',
  'USE_DROP',
];

const VAR_GRID_MOTION_ONLY: string[] = ['MOVE_FWD', 'MOVE_BACK', 'TURN_LEFT', 'TURN_RIGHT'];

// ---------------------------------------------------------------------------
// Activity Grids & Demo Tabs
// ---------------------------------------------------------------------------

// var.0 Tab 2 â€” Dial Corridor Variants (8x3, dial at (1,1) = 4 or 2)
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
  dialTiles: [{ x: 1, y: 1, value: 4 }],
  flags: [{ id: 'goal_var0_v1', x: 5, y: 1, isGoal: true, order: 1, collected: false }],
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
  dialTiles: [{ x: 1, y: 1, value: 2 }],
  flags: [{ id: 'goal_var0_v2', x: 3, y: 1, isGoal: true, order: 1, collected: false }],
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
      'Put 100 in box s to size the whole house at once. Try changing 100 to 60 and tap Run!',
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
          block('TURN_RIGHT', { params: { angle: 30 } }),
          block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.red } }),
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
      'Box d reads Dial = 4 off the floor so one move badge walks all 4 steps down the hall!',
    grid: VAR_0_CORRIDOR_V1,
    workspace: makeWorkspace(
      {
        MAIN: [
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
      'Same program, shorter hall! Box d reads Dial = 2 automatically without changing any code.',
    grid: VAR_0_CORRIDOR_V2,
    workspace: makeWorkspace(
      {
        MAIN: [
          varAssign('d', '$tileDial'),
          block('MOVE_FWD', { repeatCount: 'd' }),
        ],
      },
      'demo_var0_t3'
    ),
  },
];

// var.2 â€” Reading & Recalling a Dial Value (9x7, dial at (2,1) = 2, 3, 4)
const VAR_2_GRIDS: CurriculumGridDefinition[] = [2, 3, 4].map((d, idx) => {
  const openCells: Array<[number, number]> = [[1, 1], [2, 1]];
  for (let x = 3; x <= 2 + d; x++) openCells.push([x, 1]);
  for (let y = 2; y <= 1 + d; y++) openCells.push([2 + d, y]);
  return {
    label: `${idx + 1}`,
    width: 9,
    height: 7,
    robot: { x: 1, y: 1, dir: 'EAST' },
    barriers: buildSealedGridBarriers(9, 7, openCells),
    dialTiles: [{ x: 2, y: 1, value: d }],
    flags: [{ id: `goal_var2_v${idx + 1}`, x: 2 + d, y: 1 + d, isGoal: true, order: 1, collected: false }],
    requireAllItemsCollected: false,
    requireEmptyBackpackAtGoal: false,
    strictInteractionCollision: true,
  };
});

// var.3 â€” Updating a Variable (3 Demo Tabs)
const VAR_3_TAB1_GRID: CurriculumGridDefinition = {
  label: '1',
  width: 9,
  height: 6,
  robot: { x: 1, y: 2, dir: 'EAST' },
  barriers: buildSealedGridBarriers(9, 6, [
    [1, 2],
    [2, 2],
    [3, 2],
    [4, 2],
    [5, 2],
    [6, 2],
  ]),
  dialTiles: [{ x: 1, y: 2, value: 2 }],
  flags: [{ id: 'goal_var3_t1', x: 6, y: 2, isGoal: true, order: 1, collected: false }],
  requireAllItemsCollected: false,
  requireEmptyBackpackAtGoal: false,
  strictInteractionCollision: true,
};

const VAR_3_TAB2_GRID: CurriculumGridDefinition = {
  label: '2',
  width: 7,
  height: 7,
  robot: { x: 1, y: 1, dir: 'EAST' },
  barriers: buildSealedGridBarriers(7, 7, [
    [1, 1],
    [2, 1],
    [3, 1],
    [4, 1],
    [4, 2],
    [4, 3],
    [3, 3],
  ]),
  dialTiles: [{ x: 1, y: 1, value: 3 }],
  flags: [{ id: 'goal_var3_t2', x: 3, y: 3, isGoal: true, order: 1, collected: false }],
  requireAllItemsCollected: false,
  requireEmptyBackpackAtGoal: false,
  strictInteractionCollision: true,
};

const VAR_3_TAB3_GRID: CurriculumGridDefinition = {
  label: '3',
  width: 10,
  height: 9,
  robot: { x: 1, y: 2, dir: 'EAST' },
  barriers: buildSealedGridBarriers(10, 9, [
    [1, 2],
    [2, 2],
    [3, 2],
    [4, 2],
    [5, 2],
    [6, 2],
    [7, 2],
    [7, 3],
    [7, 4],
    [7, 5],
    [7, 6],
    [7, 7],
    [7, 8],
  ]),
  dialTiles: [
    { x: 1, y: 2, value: 2 },
    { x: 2, y: 2, value: 3 },
  ],
  flags: [{ id: 'goal_var3_t3', x: 7, y: 8, isGoal: true, order: 1, collected: false }],
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
      'a = a + 1 adds 1 to whatever number is already in box a, turning 2 steps into 3!',
    grid: VAR_3_TAB1_GRID,
    workspace: makeWorkspace(
      {
        MAIN: [
          varAssign('a', '$tileDial'),
          block('MOVE_FWD', { repeatCount: 'a' }),
          varOp('a', 'a', '+', 1),
          block('MOVE_FWD', { repeatCount: 'a' }),
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
      'a = a - 1 shrinks your step count by 1 after each turn to walk an inward spiral (3, 2, 1)!',
    grid: VAR_3_TAB2_GRID,
    workspace: makeWorkspace(
      {
        MAIN: [
          varAssign('a', '$tileDial'),
          block('MOVE_FWD', { repeatCount: 'a' }),
          block('TURN_RIGHT'),
          varOp('a', 'a', '-', 1),
          block('MOVE_FWD', { repeatCount: 'a' }),
          block('TURN_RIGHT'),
          varOp('a', 'a', '-', 1),
          block('MOVE_FWD', { repeatCount: 'a' }),
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
      'Combine two dial boxes with c = a + b, then double it with d = b * 2!',
    grid: VAR_3_TAB3_GRID,
    workspace: makeWorkspace(
      {
        MAIN: [
          varAssign('a', '$tileDial'),
          block('MOVE_FWD'),
          varAssign('b', '$tileDial'),
          varOp('c', 'a', '+', 'b'),
          varOp('d', 'b', '*', 2),
          block('MOVE_FWD', { repeatCount: 'c' }),
          block('TURN_RIGHT'),
          block('MOVE_FWD', { repeatCount: 'd' }),
        ],
      },
      'demo_var3_t3'
    ),
  },
];

// var.4 â€” Stepping Counters & Staircases (10x8, 3 variants: dial = 1, 2, 3 at (3,1))
const VAR_4_GRIDS: CurriculumGridDefinition[] = [1, 2, 3].map((d, idx) => {
  const openCells: Array<[number, number]> = [];
  for (let x = 3; x <= 3 + d; x++) openCells.push([x, 1]);
  for (let y = 2; y <= 2 + d; y++) openCells.push([3 + d, y]);
  for (let x = 1; x <= 2 + d; x++) openCells.push([x, 2 + d]);
  return {
    label: `${idx + 1}`,
    width: 10,
    height: 8,
    robot: { x: 3, y: 1, dir: 'EAST' },
    barriers: buildSealedGridBarriers(10, 8, openCells),
    dialTiles: [{ x: 3, y: 1, value: d }],
    flags: [{ id: `goal_var4_v${idx + 1}`, x: 1, y: 2 + d, isGoal: true, order: 1, collected: false }],
    requireAllItemsCollected: false,
    requireEmptyBackpackAtGoal: false,
    strictInteractionCollision: true,
  };
});

// var.4a â€” Corridor Beacon Counters (9x8, 4 variants: 2, 3, 4, 5 red beacons)
const VAR_4A_BEACON_XS: number[][] = [
  [2, 5],
  [2, 4, 6],
  [2, 3, 5, 7],
  [2, 3, 4, 6, 7],
];

const VAR_4A_GRIDS: CurriculumGridDefinition[] = VAR_4A_BEACON_XS.map((xs, idx) => {
  const openCells: Array<[number, number]> = [];
  for (let x = 1; x <= 7; x++) openCells.push([x, 1]);
  for (let y = 2; y <= 6; y++) openCells.push([7, y]);
  return {
    label: `${idx + 1}`,
    width: 9,
    height: 8,
    robot: { x: 1, y: 1, dir: 'EAST' },
    barriers: buildSealedGridBarriers(9, 8, openCells),
    beaconTiles: xs.map((bx) => ({ x: bx, y: 1, color: 'red' as const })),
    flags: [{ id: `goal_var4a_v${idx + 1}`, x: 7, y: 1 + xs.length, isGoal: true, order: 1, collected: false }],
    requireAllItemsCollected: false,
    requireEmptyBackpackAtGoal: false,
    strictInteractionCollision: true,
  };
});

// var.A â€” Inventory Quartermaster (9x9, 4 variants: c = 1, 2, 3, 4 red beacons)
const VAR_A_BEACON_XS: number[][] = [
  [3],
  [2, 5],
  [2, 4, 6],
  [2, 3, 5, 6],
];

const VAR_A_GRIDS: CurriculumGridDefinition[] = VAR_A_BEACON_XS.map((xs, idx) => {
  const c = xs.length;
  const openCells: Array<[number, number]> = [];
  for (let x = 1; x <= 7; x++) openCells.push([x, 1]);
  for (let y = 2; y <= 7; y++) openCells.push([7, y]);
  return {
    label: `${idx + 1}`,
    width: 9,
    height: 9,
    robot: { x: 1, y: 1, dir: 'EAST' },
    barriers: buildSealedGridBarriers(9, 9, openCells),
    beaconTiles: xs.map((bx) => ({ x: bx, y: 1, color: 'red' as const })),
    worldItems: [{ id: `cell_varA_v${idx + 1}`, type: 'crate', x: 7, y: 1 }],
    floorSwitches: [{ id: `sw_varA_v${idx + 1}`, x: 7, y: 1 + c, requiredForGoal: true }],
    flags: [{ id: `goal_varA_v${idx + 1}`, x: 7, y: 2 + c, isGoal: true, order: 1, collected: false }],
    requireAllItemsCollected: false,
    requireEmptyBackpackAtGoal: true,
    strictInteractionCollision: true,
  };
});

// var.M1 â€” Multi-Dial Vault (11x11, 4 variants: (1,2,1), (3,1,2), (2,3,1), (1,3,2))
const VAR_M1_TRIPLES: Array<[number, number, number]> = [
  [1, 2, 1],
  [3, 1, 2],
  [2, 3, 1],
  [1, 3, 2],
];

const VAR_M1_GRIDS: CurriculumGridDefinition[] = VAR_M1_TRIPLES.map(([a, b, c], idx) => {
  const d = a + b;
  const openCells: Array<[number, number]> = [];
  for (let x = 1; x <= 9; x++) openCells.push([x, 1]);
  for (let x = 7; x <= 9; x++) {
    for (let y = 2; y <= 8; y++) {
      openCells.push([x, y]);
    }
  }
  for (let x = 7; x <= 10; x++) openCells.push([x, 9]);
  return {
    label: `${idx + 1}`,
    width: 11,
    height: 11,
    robot: { x: 1, y: 1, dir: 'EAST' },
    barriers: buildSealedGridBarriers(11, 11, openCells),
    dialTiles: [
      { x: 1, y: 1, value: a },
      { x: 2, y: 1, value: b },
      { x: 3, y: 1, value: c },
    ],
    worldItems: [{ id: `core_varM1_v${idx + 1}`, type: 'crate', x: 4 + d, y: 9 }],
    floorSwitches: [{ id: `sw_varM1_v${idx + 1}`, x: 4 + d + c, y: 9, requiredForGoal: true }],
    flags: [{ id: `goal_varM1_v${idx + 1}`, x: 4 + d + c, y: 9, isGoal: true, order: 1, collected: false }],
    requireAllItemsCollected: false,
    requireEmptyBackpackAtGoal: true,
    strictInteractionCollision: true,
  };
});

// ---------------------------------------------------------------------------
// Palette Configurations
// ---------------------------------------------------------------------------

const VAR_0_PALETTE: PaletteConfig = {
  allowedScopes: ['MAIN'],
  allowedSimBlocks: ['FORWARD', 'TURN_RIGHT', 'SET_PEN_COLOR', 'MOVE_FWD'],
  allowedControlBlocks: ['VAR_ASSIGN', 'LOOP_START', 'LOOP_END'],
  allowVariables: true,
  allowedVariableNames: varList('s', 'd'),
  allowedValueSensors: ['$tileDial'],
  allowActionParams: true,
  allowRepeatBadges: false,
  allowedBlockParams: {
    FORWARD: ['length'],
    TURN_RIGHT: ['angle'],
    SET_PEN_COLOR: ['color'],
  },
};

const VAR_1_PALETTE: PaletteConfig = {
  allowedScopes: ['MAIN', 'F1'],
  allowedSimBlocks: VAR_TURTLE_BASE_BLOCKS,
  allowedControlBlocks: ['VAR_ASSIGN', 'LOOP_START', 'LOOP_END', 'CALL_F1'],
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
  allowedControlBlocks: ['VAR_ASSIGN', 'VAR_OP'],
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
  allowedControlBlocks: ['VAR_ASSIGN', 'VAR_OP', 'LOOP_START', 'LOOP_END'],
  allowVariables: true,
  allowedVarOps: ['+', '-', '*'],
  allowedVariableNames: varList('a'),
  allowedValueSensors: ['$tileDial'],
  allowActionParams: false,
  allowRepeatBadges: true,
};

const VAR_4A_PALETTE: PaletteConfig = {
  allowedScopes: ['MAIN'],
  allowedSimBlocks: VAR_GRID_MOTION_ONLY,
  allowedControlBlocks: ['VAR_ASSIGN', 'VAR_OP', 'WHILE', 'END_WHILE', 'IF', 'END_IF'],
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
  allowedControlBlocks: ['VAR_ASSIGN', 'VAR_OP', 'LOOP_START', 'LOOP_END', 'CALL_F1'],
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
  allowedControlBlocks: ['VAR_ASSIGN', 'VAR_OP', 'LOOP_START', 'LOOP_END', 'CALL_F1'],
  allowVariables: true,
  allowedVarOps: ['+', '-', '*'],
  allowedVariableNames: varList('a', 'b', 'c'),
  allowedValueSensors: ['$x', '$y', '$heading'],
  allowActionParams: true,
  allowRepeatBadges: true,
  allowedBlockParams: VAR_TURTLE_PARAMS,
};

const VAR_7_PALETTE: PaletteConfig = {
  allowedScopes: ['MAIN', 'F1', 'F2'],
  allowedSimBlocks: VAR_BEAT_ALLOWED_BLOCKS,
  allowedControlBlocks: ['VAR_ASSIGN', 'VAR_OP', 'LOOP_START', 'LOOP_END', 'CALL_F1', 'CALL_F2'],
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
    'PLAY_NOTE',
    'SET_LED_COLOR',
    'FORWARD',
    'TURN_RIGHT',
    'SET_PEN_COLOR',
    'SET_PEN_WIDTH',
  ],
  allowedControlBlocks: ['VAR_ASSIGN', 'VAR_OP', 'LOOP_START', 'LOOP_END', 'CALL_F1'],
  allowVariables: true,
  allowedVarOps: ['+', '-', '*'],
  allowedVariableNames: varList('a', 'd', 'p', 'r', 's', 'x', 'y'),
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
  allowedControlBlocks: ['VAR_ASSIGN', 'VAR_OP', 'LOOP_START', 'LOOP_END', 'CALL_F1', 'CALL_F2'],
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
  allowedControlBlocks: ['VAR_ASSIGN', 'VAR_OP', 'LOOP_START', 'LOOP_END', 'CALL_F1', 'CALL_F2'],
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
  allowRepeatBadges: true,
  allowedBlockParams: VAR_TURTLE_PARAMS,
};

const VAR_A_PALETTE: PaletteConfig = {
  allowedScopes: ['MAIN'],
  allowedSimBlocks: VAR_GRID_ALLOWED_BLOCKS,
  allowedControlBlocks: ['VAR_ASSIGN', 'VAR_OP', 'WHILE', 'END_WHILE', 'IF', 'END_IF'],
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
    'VAR_ASSIGN',
    'VAR_OP',
    'LOOP_START',
    'LOOP_END',
    'CALL_F1',
    'CALL_F2',
    'CALL_F3',
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
  allowRepeatBadges: true,
  allowedBlockParams: VAR_TURTLE_PARAMS,
};

const VAR_M1_PALETTE: PaletteConfig = {
  allowedScopes: ['MAIN'],
  allowedSimBlocks: VAR_GRID_ALLOWED_BLOCKS,
  allowedControlBlocks: ['VAR_ASSIGN', 'VAR_OP'],
  allowVariables: true,
  allowedVarOps: ['+', '-', '*'],
  allowedVariableNames: varList('a', 'b', 'c', 'd'),
  allowedValueSensors: ['$tileDial'],
  allowActionParams: false,
  allowRepeatBadges: true,
};

const VAR_M2_PALETTE: PaletteConfig = {
  allowedScopes: ['MAIN', 'F1', 'F2'],
  allowedSimBlocks: VAR_TURTLE_TELEPORT_BLOCKS,
  allowedControlBlocks: ['VAR_ASSIGN', 'VAR_OP', 'LOOP_START', 'LOOP_END', 'CALL_F1', 'CALL_F2'],
  allowVariables: true,
  allowedVarOps: ['+', '-', '*'],
  allowedVariableNames: varList('a', 'b', 'h', 'u', 'v', 'w', 'x', 'y'),
  allowedValueSensors: ['$x', '$y', '$heading'],
  allowActionParams: true,
  allowRepeatBadges: true,
  allowedBlockParams: VAR_TURTLE_PARAMS,
};

// ---------------------------------------------------------------------------
// Module var Activities (Exact var/overview.md Order: var.0..var.M2)
// ---------------------------------------------------------------------------

export const VAR_ACTIVITIES: CurriculumActivity[] = [
  // =========================================================================
  // var.0 â€” Variable Memory Boxes (Explanation, Turtle + Grid)
  // =========================================================================
  {
    id: 'var.0',
    moduleId: 'var',
    version: 1,
    format: 'explanation',
    simId: 'turtle',
    icon: 'ðŸ“¦',
    title: 'Variable Memory Boxes',
    concept: 'Store a number in a named box (s = 100 or d = Dial) and reuse it across blocks',
    description:
      'Watch how a single memory box controls an entire LOGO house or reads floor dials of different lengths.',
    hint: 'Switch between Tab 1 and Tab 2, change s or tap Variant 1 and 2, then press Run.',
    coPilotCard:
      'Put a number or dial reading inside box s or d, then reuse that box everywhere you need it!',
    palette: VAR_0_PALETTE,
    starterWorkspace: VAR_0_TABS[0].workspace!,
    demoTabs: VAR_0_TABS,
  },

  // =========================================================================
  // var.1 â€” Variables as Single-Point Constants (Creative, Turtle)
  // =========================================================================
  {
    id: 'var.1',
    moduleId: 'var',
    version: 1,
    format: 'sandbox',
    simId: 'turtle',
    icon: 'â­',
    title: 'Single-Point Constants',
    concept: 'Configure size and turn angle constants in Main and pass them to Function 1',
    description:
      'Store side lengths and turn angles in s, a, b, and e so changing one box transforms stars, snowflakes, pinwheels, and daisies.',
    hint: 'Set s, a, b, or e at the top of Main, then reuse them inside Function 1 loops.',
    palette: VAR_1_PALETTE,
    slotCap: {
      perScope: { MAIN: 16, F1: 12 },
    },
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          varAssign('s', 145),
          varAssign('a', 144),
          block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.red } }),
          block('CALL_F1'),
          block('TURN_RIGHT', { params: { angle: 36 } }),
          block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.blue } }),
          block('CALL_F1'),
        ],
        F1: [
          loopStart(5),
          block('FORWARD', { params: { length: 's' } }),
          block('TURN_RIGHT', { params: { angle: 'a' } }),
          block('LOOP_END'),
        ],
      },
      'start_var1'
    ),
    variations: [
      {
        id: 'var.1-var1-snowflake',
        title: '6-Point Snowflake',
        icon: 'â„ï¸',
        workspace: makeWorkspace(
          {
            MAIN: [
              varAssign('e', 90),
              varAssign('s', 55),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.cyan } }),
              loopStart(6),
              block('FORWARD', { params: { length: 'e' } }),
              block('CALL_F1'),
              block('BACKWARD', { params: { length: 'e' } }),
              block('TURN_RIGHT', { params: { angle: 60 } }),
              block('LOOP_END'),
            ],
            F1: [
              loopStart(6),
              block('FORWARD', { params: { length: 's' } }),
              block('TURN_RIGHT', { params: { angle: 60 } }),
              block('LOOP_END'),
            ],
          },
          'v1_var1'
        ),
      },
      {
        id: 'var.1-var2-pinwheel',
        title: '3-Color Square Pinwheel',
        icon: 'ðŸŒ€',
        workspace: makeWorkspace(
          {
            MAIN: [
              varAssign('s', 100),
              varAssign('a', 90),
              varAssign('b', 120),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.purple } }),
              block('CALL_F1'),
              block('TURN_RIGHT', { params: { angle: 'b' } }),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.amber } }),
              block('CALL_F1'),
              block('TURN_RIGHT', { params: { angle: 'b' } }),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.cyan } }),
              block('CALL_F1'),
            ],
            F1: [
              loopStart(4),
              block('FORWARD', { params: { length: 's' } }),
              block('TURN_RIGHT', { params: { angle: 'a' } }),
              block('LOOP_END'),
            ],
          },
          'v2_var1'
        ),
      },
      {
        id: 'var.1-var3-daisy',
        title: '24-Petal Daisy',
        icon: 'ðŸŒ¼',
        workspace: makeWorkspace(
          {
            MAIN: [
              varAssign('s', 95),
              varAssign('a', 15),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.pink } }),
              loopStart(6),
              loopStart(4),
              block('CALL_F1'),
              block('TURN_RIGHT', { params: { angle: 'a' } }),
              block('LOOP_END'),
              block('LOOP_END'),
            ],
            F1: [
              block('ARC_RIGHT', { params: { radius: 's', angle: 60 } }),
              block('TURN_RIGHT', { params: { angle: 120 } }),
              block('ARC_RIGHT', { params: { radius: 's', angle: 60 } }),
              block('TURN_RIGHT', { params: { angle: 120 } }),
            ],
          },
          'v3_var1'
        ),
      },
    ],
  },

  // =========================================================================
  // var.2 â€” Reading & Recalling a Dial Value (Puzzle, Grid)
  // =========================================================================
  {
    id: 'var.2',
    moduleId: 'var',
    version: 1,
    format: 'puzzle',
    simId: 'grid',
    icon: 'ðŸŽ›ï¸',
    title: 'Reading & Recalling a Dial Value',
    concept: 'Read a live floor dial once into box d and recall it on both legs of an L-hallway',
    description:
      'Step onto the floor dial, save its number in box d, and walk d steps East then d steps South to reach the Goal across all 3 map lengths.',
    hint: 'Read d = Dial first, then tag both Forward blocks with [xd].',
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
            placeholder(),
            block('MOVE_FWD', { repeatCount: 'd' }),
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
          block('TURN_RIGHT'),
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
  // var.3 â€” Updating a Variable: a = a + 1 (Explanation, Grid)
  // =========================================================================
  {
    id: 'var.3',
    moduleId: 'var',
    version: 1,
    format: 'explanation',
    simId: 'grid',
    icon: 'âž•',
    title: 'Updating a Variable',
    concept: 'Update variables with +, -, and * (a = a + 1, a = a - 1, c = a + b)',
    description:
      'Watch how the 3-slot math block updates an existing variable box or combines two dial readings.',
    hint: 'Tap Tabs 1, 2, and 3 and press Step or Run to inspect each variable update.',
    coPilotCard:
      'Use +, -, and * math blocks to grow, shrink, or combine numbers already sitting in your boxes!',
    palette: VAR_3_PALETTE,
    starterWorkspace: VAR_3_TABS[0].workspace!,
    grid: VAR_3_TAB1_GRID,
    demoTabs: VAR_3_TABS,
  },

  // =========================================================================
  // var.4 â€” Stepping Counters & Staircases (Puzzle, Grid)
  // =========================================================================
  {
    id: 'var.4',
    moduleId: 'var',
    version: 1,
    format: 'puzzle',
    simId: 'grid',
    icon: 'ðŸ“',
    title: 'Stepping Counters & Staircases',
    concept: 'Increment a step variable inside a 3-turn coil loop (a, a+1, a+2)',
    description:
      'Read the start dial into a, then use a 3x Loop that steps [xa], turns right, and grows a = a + 1 on every arm.',
    hint: 'Inside Loop x3: Forward [xa], Turn Right, then a = a + 1.',
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
          varAssign('a', '$tileDial'),
          loopStart(3),
          block('MOVE_FWD', { repeatCount: 'a' }),
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
            varAssign('a', '$tileDial'),
            loopStart(3),
            block('MOVE_FWD', { repeatCount: 'a' }),
            placeholder(),
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
          varAssign('a', '$tileDial'),
          loopStart(3),
          block('MOVE_FWD', { repeatCount: 'a' }),
          block('TURN_RIGHT'),
          varOp('a', 'a', '+', 1),
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
        description: 'Three coil sizes (d=1,2,3) cannot all be solved without variables',
        allowVariables: false,
        singleVariantBypassMustExist: true,
      },
    ],
  },

  // =========================================================================
  // var.4a â€” Corridor Beacon Counters (Puzzle, Grid)
  // =========================================================================
  {
    id: 'var.4a',
    moduleId: 'var',
    version: 1,
    format: 'puzzle',
    simId: 'grid',
    icon: 'ðŸš¨',
    title: 'Corridor Beacon Counters',
    concept: 'Count red beacons while walking with While + If, then recall count c on the drop shaft',
    description:
      'Zero box c, walk down the hall counting each red beacon with c = c + 1, then turn right and step [xc] down the open shaft.',
    hint: 'Inside While Path Ahead: Move Forward, then If Red Beacon -> c = c + 1.',
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
          block('MOVE_FWD', { repeatCount: 'c' }),
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
        description: 'Unedited starter leaves c = 0 at the top-right corner',
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
  // var.5 â€” Growing & Shrinking Loops: Spirals (Creative, Turtle)
  // =========================================================================
  {
    id: 'var.5',
    moduleId: 'var',
    version: 1,
    format: 'sandbox',
    simId: 'turtle',
    icon: 'ðŸš',
    title: 'Growing & Shrinking Spirals',
    concept: 'Update length variable a inside Loop xN to spin squares, hexagons, triangles, and shrinking spirals',
    description:
      'Grow or shrink step variable a inside a big loop to draw square spirals, honeycombs, triangular vortices, and whirlpools.',
    hint: 'Start a small and add 8 each turn, or start a = 180 and subtract 6 inside Loop.',
    palette: VAR_5_PALETTE,
    slotCap: {
      perScope: { MAIN: 16, F1: 12 },
    },
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          varAssign('a', 15),
          block('SET_PEN_WIDTH', { params: { width: 3 } }),
          block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.blue } }),
          loopStart(24),
          block('FORWARD', { params: { length: 'a' } }),
          block('TURN_RIGHT', { params: { angle: 90 } }),
          varOp('a', 'a', '+', 8),
          block('LOOP_END'),
        ],
      },
      'start_var5'
    ),
    variations: [
      {
        id: 'var.5-var1-honeycomb',
        title: '6-Sided Honeycomb Web',
        icon: 'ðŸ¯',
        workspace: makeWorkspace(
          {
            MAIN: [
              varAssign('a', 12),
              block('SET_PEN_WIDTH', { params: { width: 3 } }),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.amber } }),
              loopStart(24),
              block('FORWARD', { params: { length: 'a' } }),
              block('TURN_RIGHT', { params: { angle: 60 } }),
              varOp('a', 'a', '+', 8),
              block('LOOP_END'),
            ],
          },
          'v1_var5'
        ),
      },
      {
        id: 'var.5-var2-vortex',
        title: 'Triangular Vortex',
        icon: 'ðŸ”º',
        workspace: makeWorkspace(
          {
            MAIN: [
              varAssign('a', 15),
              block('SET_PEN_WIDTH', { params: { width: 3 } }),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.green } }),
              loopStart(18),
              block('FORWARD', { params: { length: 'a' } }),
              block('TURN_RIGHT', { params: { angle: 122 } }),
              varOp('a', 'a', '+', 12),
              block('LOOP_END'),
            ],
          },
          'v2_var5'
        ),
      },
      {
        id: 'var.5-var3-whirlpool',
        title: 'Shrinking Whirlpool (F1)',
        icon: 'ðŸŒŠ',
        workspace: makeWorkspace(
          {
            MAIN: [
              varAssign('a', 180),
              block('SET_PEN_WIDTH', { params: { width: 3 } }),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.purple } }),
              loopStart(24),
              block('CALL_F1'),
              block('LOOP_END'),
            ],
            F1: [
              block('FORWARD', { params: { length: 'a' } }),
              block('TURN_RIGHT', { params: { angle: 91 } }),
              varOp('a', 'a', '-', 6),
            ],
          },
          'v3_var5'
        ),
      },
      {
        id: 'var.5-var4-starburst',
        title: '45-Step Starburst Spiral',
        icon: 'ðŸ’¥',
        workspace: makeWorkspace(
          {
            MAIN: [
              varAssign('a', 10),
              block('SET_PEN_WIDTH', { params: { width: 3 } }),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.pink } }),
              loopStart(45),
              block('FORWARD', { params: { length: 'a' } }),
              block('TURN_RIGHT', { params: { angle: 144 } }),
              varOp('a', 'a', '+', 5),
              block('LOOP_END'),
            ],
          },
          'v4_var5'
        ),
      },
    ],
  },

  // =========================================================================
  // var.6 â€” Teleport & Pose Sensors (Explanation, Turtle)
  // =========================================================================
  {
    id: 'var.6',
    moduleId: 'var',
    version: 1,
    format: 'explanation',
    simId: 'turtle',
    icon: 'ðŸ§­',
    title: 'Teleport & Pose Sensors',
    concept: 'Jump directly with Teleport(x, y, heading) and save pose sensors $x, $y, $heading',
    description:
      'Lift the pen, jump cleanly between islands with Teleport, and bookmark your spot with $x, $y, and $heading.',
    hint: 'Compare Tab 1 (Twin Stars) and Tab 2 (Pose Bookmark) to see both Teleport and pose sensors in action.',
    coPilotCard:
      'Teleport jumps straight to x, y, and heading! Save $x, $y, and $heading into boxes to jump back later.',
    palette: VAR_6_PALETTE,
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          block('PEN_UP'),
          block('TELEPORT', { params: { x: -140, y: 40, heading: 18 } }),
          block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.amber } }),
          block('PEN_DOWN'),
          block('CALL_F1'),
          block('PEN_UP'),
          block('TELEPORT', { params: { x: 80, y: -30, heading: 18 } }),
          block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.cyan } }),
          block('PEN_DOWN'),
          block('CALL_F1'),
        ],
        F1: [
          loopStart(5),
          block('FORWARD', { params: { length: 80 } }),
          block('TURN_RIGHT', { params: { angle: 144 } }),
          block('LOOP_END'),
        ],
      },
      'demo_var6_t1_start'
    ),
    demoTabs: [
      {
        id: 'var.6-tab1-twin-stars',
        label: '1',
        simId: 'turtle',
        coPilotCard:
          'Pen Up, Teleport to (-140, 40) and (80, -30), then Pen Down to draw twin stars cleanly!',
        workspace: makeWorkspace(
          {
            MAIN: [
              block('PEN_UP'),
              block('TELEPORT', { params: { x: -140, y: 40, heading: 18 } }),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.amber } }),
              block('PEN_DOWN'),
              block('CALL_F1'),
              block('PEN_UP'),
              block('TELEPORT', { params: { x: 80, y: -30, heading: 18 } }),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.cyan } }),
              block('PEN_DOWN'),
              block('CALL_F1'),
            ],
            F1: [
              loopStart(5),
              block('FORWARD', { params: { length: 80 } }),
              block('TURN_RIGHT', { params: { angle: 144 } }),
              block('LOOP_END'),
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
          'Save $x, $y, and $heading into boxes a, b, c. Draw a red branch, then Teleport straight back!',
        workspace: makeWorkspace(
          {
            MAIN: [
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.blue } }),
              loopStart(4),
              block('FORWARD', { params: { length: 110 } }),
              block('TURN_RIGHT', { params: { angle: 90 } }),
              block('LOOP_END'),
              block('FORWARD', { params: { length: 110 } }),
              block('TURN_RIGHT', { params: { angle: 45 } }),
              varAssign('a', '$x'),
              varAssign('b', '$y'),
              varAssign('c', '$heading'),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.red } }),
              block('FORWARD', { params: { length: 110 } }),
              block('PEN_UP'),
              block('TELEPORT', { params: { x: 'a', y: 'b', heading: 'c' } }),
              block('PEN_DOWN'),
              block('TURN_RIGHT', { params: { angle: 90 } }),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.green } }),
              block('FORWARD', { params: { length: 110 } }),
            ],
          },
          'demo_var6_t2'
        ),
      },
    ],
  },

  // =========================================================================
  // var.7 â€” Sweeping Coordinates & Musical Scales (Creative, Beat)
  // =========================================================================
  {
    id: 'var.7',
    moduleId: 'var',
    version: 1,
    format: 'sandbox',
    simId: 'beat',
    icon: 'ðŸŽ¹',
    title: 'Sweeping Coordinates & Scales',
    concept: 'Step LED rows, columns, and 1..16 C Major pitches synchronously using variable math',
    description:
      'Drive column c, row r, and pitch p together to sweep diagonals, columns, octave jumps, sirens, and 2-octave overdrive scales.',
    hint: 'Update c, r, and p inside Loop, or split Up and Down sweeps into Function 1 and Function 2.',
    palette: VAR_7_PALETTE,
    beatRules: { cleanResetOnInputChange: true },
    slotCap: {
      perScope: { MAIN: 24, F1: 12, F2: 12 },
    },
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          varAssign('c', 1),
          varAssign('r', 1),
          varAssign('p', 1),
          block('SET_LED_COLOR', { params: { color: BEAT_COLORS.cyan } }),
          loopStart(8),
          block('LIGHT_PIXEL', { params: { x: 'c', y: 'r' } }),
          block('PLAY_NOTE', { params: { pitch: 'p', duration: 0.5 } }),
          varOp('c', 'c', '+', 1),
          varOp('r', 'r', '+', 1),
          varOp('p', 'p', '+', 1),
          block('LOOP_END'),
        ],
      },
      'start_var7'
    ),
    variations: [
      {
        id: 'var.7-var1-rainbow-cols',
        title: 'Rainbow Sweeping Columns',
        icon: 'ðŸŒˆ',
        workspace: makeWorkspace(
          {
            MAIN: [
              varAssign('c', 1),
              varAssign('p', 1),
              block('SET_LED_COLOR', { params: { color: BEAT_COLORS.cyan } }),
              loopStart(8),
              block('LIGHT_COL', { params: { x: 'c' } }),
              block('PLAY_NOTE', { params: { pitch: 'p', duration: 0.5 } }),
              varOp('c', 'c', '+', 1),
              varOp('p', 'p', '+', 1),
              block('LOOP_END'),
              block('SET_LED_COLOR', { params: { color: BEAT_COLORS.purple } }),
              block('CALL_F1'),
            ],
            F1: [
              loopStart(8),
              varOp('c', 'c', '-', 1),
              varOp('p', 'p', '-', 1),
              block('LIGHT_COL', { params: { x: 'c' } }),
              block('PLAY_NOTE', { params: { pitch: 'p', duration: 0.5 } }),
              block('LOOP_END'),
            ],
          },
          'v1_var7'
        ),
      },
      {
        id: 'var.7-var2-octave-jump',
        title: 'Multiplying Grid & Octave Jump',
        icon: 'âš¡',
        workspace: makeWorkspace(
          {
            MAIN: [
              varAssign('c', 1),
              varAssign('p', 1),
              block('SET_LED_COLOR', { params: { color: BEAT_COLORS.amber } }),
              loopStart(4),
              varOp('x', 'c', '*', 2),
              block('LIGHT_PIXEL', { params: { x: 'x', y: 'x' } }),
              block('PLAY_NOTE', { params: { pitch: 'p', duration: 0.5 } }),
              varOp('c', 'c', '+', 1),
              varOp('p', 'p', '*', 2),
              block('LOOP_END'),
            ],
          },
          'v2_var7'
        ),
      },
      {
        id: 'var.7-var3-siren',
        title: 'Up-and-Down Siren (F1/F2)',
        icon: 'ðŸš“',
        workspace: makeWorkspace(
          {
            MAIN: [
              varAssign('p', 1),
              varAssign('r', 1),
              loopStart(2),
              block('SET_LED_COLOR', { params: { color: BEAT_COLORS.red } }),
              block('CALL_F1'),
              block('SET_LED_COLOR', { params: { color: BEAT_COLORS.blue } }),
              block('CALL_F2'),
              block('LOOP_END'),
            ],
            F1: [
              loopStart(8),
              block('LIGHT_ROW', { params: { y: 'r' } }),
              block('PLAY_NOTE', { params: { pitch: 'p', duration: 0.5 } }),
              varOp('p', 'p', '+', 1),
              varOp('r', 'r', '+', 1),
              block('LOOP_END'),
            ],
            F2: [
              loopStart(8),
              varOp('p', 'p', '-', 1),
              varOp('r', 'r', '-', 1),
              block('LIGHT_ROW', { params: { y: 'r' } }),
              block('PLAY_NOTE', { params: { pitch: 'p', duration: 0.5 } }),
              block('LOOP_END'),
            ],
          },
          'v3_var7'
        ),
      },
      {
        id: 'var.7-var4-overdrive',
        title: '1..12 Overdrive Scale',
        icon: 'ðŸš€',
        workspace: makeWorkspace(
          {
            MAIN: [
              varAssign('p', 1),
              varAssign('c', 1),
              block('SET_LED_COLOR', { params: { color: BEAT_COLORS.green } }),
              loopStart(8),
              block('LIGHT_PIXEL', { params: { x: 'c', y: 4 } }),
              block('PLAY_NOTE', { params: { pitch: 'p', duration: 0.5 } }),
              varOp('c', 'c', '+', 1),
              varOp('p', 'p', '+', 1),
              block('LOOP_END'),
              varAssign('c', 1),
              block('SET_LED_COLOR', { params: { color: BEAT_COLORS.amber } }),
              loopStart(4),
              block('LIGHT_PIXEL', { params: { x: 'c', y: 6 } }),
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
  // var.8 â€” Random Dice & Color (Explanation, Beat + Turtle)
  // =========================================================================
  {
    id: 'var.8',
    moduleId: 'var',
    version: 1,
    format: 'explanation',
    simId: 'beat',
    icon: 'ðŸŽ²',
    title: 'Random Dice & Color',
    concept: 'Roll dice sensors ($randCoin, $randD4..$randD20) and $randomColor for generative music and art',
    description:
      'Discover how dice boxes pick fresh pitches, LED spots, step sizes, turn angles, and colors on every run.',
    hint: 'Press Run twice on Tab 1 and Tab 2 to watch new patterns roll each time.',
    coPilotCard:
      'Dice blocks and $randomColor roll a brand-new surprise every Run! Try two runs in a row.',
    palette: VAR_8_PALETTE,
    beatRules: { cleanResetOnInputChange: true },
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          loopStart(8),
          varAssign('x', '$randD8'),
          varAssign('y', '$randD8'),
          varAssign('p', '$randD8'),
          block('SET_LED_COLOR', { params: { color: '$randomColor' } }),
          block('LIGHT_PIXEL', { params: { x: 'x', y: 'y' } }),
          block('PLAY_NOTE', { params: { pitch: 'p', duration: 0.5 } }),
          block('LOOP_END'),
        ],
      },
      'demo_var8_t1_start'
    ),
    demoTabs: [
      {
        id: 'var.8-tab1-beat-dice',
        label: '1',
        simId: 'beat',
        coPilotCard:
          'Roll $randD8 into x, y, and p and pick $randomColor to paint and chime random sparkles!',
        beatRules: { cleanResetOnInputChange: true },
        workspace: makeWorkspace(
          {
            MAIN: [
              loopStart(8),
              varAssign('x', '$randD8'),
              varAssign('y', '$randD8'),
              varAssign('p', '$randD8'),
              block('SET_LED_COLOR', { params: { color: '$randomColor' } }),
              block('LIGHT_PIXEL', { params: { x: 'x', y: 'y' } }),
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
          'Multiply a dice roll by 15 or 45 and splash $randomColor for a new confetti trail every Run!',
        workspace: makeWorkspace(
          {
            MAIN: [
              loopStart(10),
              block('CALL_F1'),
              block('LOOP_END'),
            ],
            F1: [
              varAssign('r', '$randD8'),
              varOp('s', 'r', '*', 15),
              varAssign('d', '$randD4'),
              varOp('a', 'd', '*', 45),
              block('SET_PEN_COLOR', { params: { color: '$randomColor' } }),
              block('SET_PEN_WIDTH', { params: { width: 4 } }),
              block('FORWARD', { params: { length: 's' } }),
              block('TURN_RIGHT', { params: { angle: 'a' } }),
            ],
          },
          'demo_var8_t2'
        ),
      },
    ],
  },

  // =========================================================================
  // var.9 â€” Dice Beat & Light DJ (Creative, Beat)
  // =========================================================================
  {
    id: 'var.9',
    moduleId: 'var',
    version: 1,
    format: 'sandbox',
    simId: 'beat',
    icon: 'ðŸŽ§',
    title: 'Dice Beat & Light DJ',
    concept: 'Compose procedural Beat & Light shows with $randD8, $randD20, $randCoin (Loop x[0]), and $randomColor',
    description:
      'Mix random colors, dice melodies, 50/50 coin-flip drum fills, and dual-deck F1/F2 jams.',
    hint: 'Store $randCoin in c for Loop x[c] (0 skips safely, 1 claps!), or split bass and lead across F1 and F2.',
    palette: VAR_9_PALETTE,
    beatRules: { cleanResetOnInputChange: true },
    slotCap: {
      perScope: { MAIN: 16, F1: 12, F2: 12 },
    },
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          loopStart(8),
          varAssign('r', '$randD8'),
          varAssign('c', '$randD8'),
          varAssign('p', '$randD8'),
          block('SET_LED_COLOR', { params: { color: '$randomColor' } }),
          block('LIGHT_PIXEL', { params: { x: 'c', y: 'r' } }),
          block('PLAY_NOTE', { params: { pitch: 'p', duration: 0.5 } }),
          block('DRUM_KICK'),
          block('LOOP_END'),
        ],
      },
      'start_var9'
    ),
    variations: [
      {
        id: 'var.9-var1-d20-fountain',
        title: 'D20 Super-Melody Fountain',
        icon: 'â›²',
        workspace: makeWorkspace(
          {
            MAIN: [
              loopStart(8),
              varAssign('c', '$randD8'),
              varAssign('p', '$randD20'),
              varAssign('m', '$randD8'),
              block('SET_LED_COLOR', { params: { color: '$randomColor' } }),
              block('LIGHT_COL', { params: { x: 'c' } }),
              block('PLAY_NOTE', { params: { pitch: 'm', duration: 0.5 } }),
              varOp('m', 'm', '+', 8),
              block('PLAY_NOTE', { params: { pitch: 'm', duration: 0.5 } }),
              block('LOOP_END'),
            ],
          },
          'v1_var9'
        ),
      },
      {
        id: 'var.9-var2-coin-flip-fill',
        title: '50/50 Coin-Flip Drum Fill',
        icon: 'ðŸª™',
        workspace: makeWorkspace(
          {
            MAIN: [
              loopStart(8),
              block('DRUM_KICK'),
              varAssign('c', '$randCoin'),
              loopStart('c'),
              block('DRUM_CLAP'),
              block('SET_LED_COLOR', { params: { color: BEAT_COLORS.amber } }),
              block('LIGHT_ROW', { params: { y: 4 } }),
              block('LOOP_END'),
              block('WAIT_BEAT', { params: { duration: 0.5 } }),
              block('LOOP_END'),
            ],
          },
          'v2_var9'
        ),
      },
      {
        id: 'var.9-var3-remix-stage',
        title: '2-Instrument Remix Stage',
        icon: 'ðŸŽ›ï¸',
        workspace: makeWorkspace(
          {
            MAIN: [
              loopStart(4),
              block('CALL_F1'),
              block('CALL_F2'),
              block('LOOP_END'),
            ],
            F1: [
              varAssign('r', '$randD8'),
              varAssign('p', '$randD8'),
              block('SET_LED_COLOR', { params: { color: '$randomColor' } }),
              block('LIGHT_ROW', { params: { y: 'r' } }),
              block('PLAY_NOTE', { params: { pitch: 'p', duration: 0.5 } }),
              block('DRUM_KICK'),
            ],
            F2: [
              varAssign('c', '$randD8'),
              varAssign('p', '$randD8'),
              varOp('p', 'p', '+', 8),
              block('SET_LED_COLOR', { params: { color: '$randomColor' } }),
              block('LIGHT_COL', { params: { x: 'c' } }),
              block('PLAY_NOTE', { params: { pitch: 'p', duration: 0.5 } }),
              block('DRUM_SNARE'),
            ],
          },
          'v3_var9'
        ),
      },
    ],
  },

  // =========================================================================
  // var.10 â€” Confetti Fireworks & Walkers (Creative, Turtle)
  // =========================================================================
  {
    id: 'var.10',
    moduleId: 'var',
    version: 1,
    format: 'sandbox',
    simId: 'turtle',
    icon: 'ðŸŽ†',
    title: 'Confetti Fireworks & Walkers',
    concept: 'Combine Teleport, random dice math, $randomColor, and Function helpers for fireworks and walkers',
    description:
      'Jump across the canvas with centered random coordinates, launch fireworks bursts, and build random lattice walkers.',
    hint: 'Compute x = u * 10 then x = x - 110 to scatter shapes across the whole screen.',
    palette: VAR_10_PALETTE,
    slotCap: {
      perScope: { MAIN: 20, F1: 16, F2: 16 },
    },
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          loopStart(12),
          varAssign('u', '$randD20'),
          varAssign('v', '$randD20'),
          varOp('x', 'u', '*', 10),
          varOp('y', 'v', '*', 10),
          varOp('x', 'x', '-', 110),
          varOp('y', 'y', '-', 110),
          block('PEN_UP'),
          block('TELEPORT', { params: { x: 'x', y: 'y', heading: 0 } }),
          block('PEN_DOWN'),
          block('SET_PEN_COLOR', { params: { color: '$randomColor' } }),
          varAssign('s', '$randD8'),
          varOp('s', 's', '*', 5),
          block('CALL_F1'),
          block('LOOP_END'),
        ],
        F1: [
          loopStart(5),
          block('FORWARD', { params: { length: 's' } }),
          block('TURN_RIGHT', { params: { angle: 144 } }),
          block('LOOP_END'),
        ],
      },
      'start_var10'
    ),
    variations: [
      {
        id: 'var.10-var1-lattice-walker',
        title: 'Random Lattice Walker',
        icon: 'ðŸš¶',
        workspace: makeWorkspace(
          {
            MAIN: [
              block('SET_PEN_WIDTH', { params: { width: 4 } }),
              loopStart(30),
              varAssign('d', '$randD4'),
              varOp('a', 'd', '*', 90),
              block('SET_PEN_COLOR', { params: { color: '$randomColor' } }),
              block('FORWARD', { params: { length: 45 } }),
              block('TURN_RIGHT', { params: { angle: 'a' } }),
              block('LOOP_END'),
            ],
          },
          'v1_var10'
        ),
      },
      {
        id: 'var.10-var2-fireworks',
        title: 'Starburst Fireworks',
        icon: 'ðŸŽ‡',
        workspace: makeWorkspace(
          {
            MAIN: [
              loopStart(6),
              varAssign('u', '$randD20'),
              varAssign('v', '$randD20'),
              varOp('x', 'u', '*', 10),
              varOp('y', 'v', '*', 10),
              varOp('x', 'x', '-', 110),
              varOp('y', 'y', '-', 110),
              block('PEN_UP'),
              block('TELEPORT', { params: { x: 'x', y: 'y', heading: 0 } }),
              block('PEN_DOWN'),
              block('SET_PEN_COLOR', { params: { color: '$randomColor' } }),
              block('CALL_F1'),
              block('LOOP_END'),
            ],
            F1: [
              loopStart(8),
              block('FORWARD', { params: { length: 40 } }),
              block('BACKWARD', { params: { length: 40 } }),
              block('TURN_RIGHT', { params: { angle: 45 } }),
              block('LOOP_END'),
            ],
          },
          'v2_var10'
        ),
      },
      {
        id: 'var.10-var3-spiro-tree',
        title: 'Randomized Spirograph Tree',
        icon: 'ðŸŒ³',
        workspace: makeWorkspace(
          {
            MAIN: [
              varAssign('s', 120),
              block('SET_PEN_WIDTH', { params: { width: 3 } }),
              loopStart(6),
              block('SET_PEN_COLOR', { params: { color: '$randomColor' } }),
              block('FORWARD', { params: { length: 's' } }),
              block('CALL_F1'),
              block('BACKWARD', { params: { length: 's' } }),
              block('TURN_RIGHT', { params: { angle: 60 } }),
              block('LOOP_END'),
            ],
            F1: [
              varAssign('r', '$randD4'),
              varOp('a', 'r', '*', 15),
              block('TURN_RIGHT', { params: { angle: 'a' } }),
              block('FORWARD', { params: { length: 50 } }),
              block('CALL_F2'),
              block('BACKWARD', { params: { length: 50 } }),
              block('TURN_LEFT', { params: { angle: 'a' } }),
            ],
            F2: [
              loopStart(4),
              block('ARC_RIGHT', { params: { radius: 25, angle: 90 } }),
              block('LOOP_END'),
            ],
          },
          'v3_var10'
        ),
      },
    ],
  },

  // =========================================================================
  // var.A â€” Inventory Quartermaster (Puzzle Capstone, Grid)
  // =========================================================================
  {
    id: 'var.A',
    moduleId: 'var',
    version: 1,
    format: 'puzzle',
    capstoneType: 'puzzle',
    simId: 'grid',
    icon: 'ðŸ†',
    title: 'Inventory Quartermaster',
    concept: 'Count beacons into c, haul the Energy Cell [xc] onto the Floor Switch, then reach the Goal',
    description:
      'Walk the beacon hall counting red beacons in box c, pick up the Energy Cell at the corner, march [xc] steps south, drop it onto the switch, and step onto the Goal!',
    hint: 'After counting c beacons: Pick Up, Turn Right, Forward [xc], Drop, Move Forward.',
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
            placeholder(),
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
  // var.B â€” Spiral & Wave Studio (Creative Capstone, Turtle)
  // =========================================================================
  {
    id: 'var.B',
    moduleId: 'var',
    version: 1,
    format: 'sandbox',
    capstoneType: 'creative',
    simId: 'turtle',
    icon: 'ðŸŽ¨',
    title: 'Spiral & Wave Studio',
    concept: 'Build multi-part LOGO compositions with Variables, Teleport, Pose Sensors, Dice, and Functions 1â€“3',
    description:
      'Design a signature gallery piece combining growing spirals, dice stars, rainbow sine waves, and pose bookmarks across Main and F1â€“F3.',
    hint: 'Save $x, $y, $heading before calling helper F1/F2/F3, or use Teleport to place shapes on a grid.',
    palette: VAR_B_PALETTE,
    slotCap: {
      perScope: { MAIN: 24, F1: 16, F2: 16, F3: 16 },
    },
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          block('PEN_UP'),
          block('TELEPORT', { params: { x: -100, y: 0, heading: 0 } }),
          block('PEN_DOWN'),
          block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.cyan } }),
          block('CALL_F1'),
          block('PEN_UP'),
          block('TELEPORT', { params: { x: 80, y: 20, heading: 0 } }),
          block('PEN_DOWN'),
          block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.amber } }),
          block('CALL_F2'),
        ],
        F1: [
          varAssign('a', 8),
          loopStart(14),
          block('FORWARD', { params: { length: 'a' } }),
          block('TURN_RIGHT', { params: { angle: 60 } }),
          varOp('a', 'a', '+', 5),
          block('LOOP_END'),
        ],
        F2: [
          loopStart(5),
          block('FORWARD', { params: { length: 90 } }),
          block('TURN_RIGHT', { params: { angle: 144 } }),
          block('LOOP_END'),
        ],
      },
      'start_varB'
    ),
    variations: [
      {
        id: 'var.B-var1-galaxy',
        title: 'Triple Spiral Galaxy',
        icon: 'ðŸŒŒ',
        workspace: makeWorkspace(
          {
            MAIN: [
              block('PEN_UP'),
              block('TELEPORT', { params: { x: -110, y: -40, heading: 0 } }),
              block('PEN_DOWN'),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.cyan } }),
              block('CALL_F1'),
              block('PEN_UP'),
              block('TELEPORT', { params: { x: 90, y: 40, heading: 0 } }),
              block('PEN_DOWN'),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.pink } }),
              block('CALL_F2'),
              block('PEN_UP'),
              block('TELEPORT', { params: { x: 0, y: 90, heading: 0 } }),
              block('PEN_DOWN'),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.amber } }),
              block('CALL_F3'),
            ],
            F1: [
              varAssign('a', 10),
              loopStart(12),
              block('FORWARD', { params: { length: 'a' } }),
              block('TURN_RIGHT', { params: { angle: 90 } }),
              varOp('a', 'a', '+', 6),
              block('LOOP_END'),
            ],
            F2: [
              varAssign('a', 75),
              loopStart(12),
              block('FORWARD', { params: { length: 'a' } }),
              block('TURN_RIGHT', { params: { angle: 90 } }),
              varOp('a', 'a', '-', 5),
              block('LOOP_END'),
            ],
            F3: [
              loopStart(6),
              block('ARC_RIGHT', { params: { radius: 35, angle: 60 } }),
              block('TURN_RIGHT', { params: { angle: 60 } }),
              block('LOOP_END'),
            ],
          },
          'v1_varB'
        ),
      },
      {
        id: 'var.B-var2-sine-wave',
        title: 'Rainbow Sine Ribbon',
        icon: 'ã€°ï¸',
        workspace: makeWorkspace(
          {
            MAIN: [
              block('PEN_UP'),
              block('TELEPORT', { params: { x: -160, y: 0, heading: 45 } }),
              block('PEN_DOWN'),
              block('SET_PEN_WIDTH', { params: { width: 5 } }),
              loopStart(6),
              block('SET_PEN_COLOR', { params: { color: '$randomColor' } }),
              block('CALL_F1'),
              block('CALL_F2'),
              block('LOOP_END'),
            ],
            F1: [
              block('ARC_RIGHT', { params: { radius: 28, angle: 90 } }),
            ],
            F2: [
              block('ARC_LEFT', { params: { radius: 28, angle: 90 } }),
            ],
          },
          'v2_varB'
        ),
      },
      {
        id: 'var.B-var3-star-meadow',
        title: 'Random Dice Star Meadow',
        icon: 'ðŸŒ ',
        workspace: makeWorkspace(
          {
            MAIN: [
              loopStart(8),
              varAssign('x', '$randD20'),
              varAssign('y', '$randD20'),
              varOp('x', 'x', '*', 12),
              varOp('y', 'y', '*', 10),
              varOp('x', 'x', '-', 130),
              varOp('y', 'y', '-', 110),
              block('PEN_UP'),
              block('TELEPORT', { params: { x: 'x', y: 'y', heading: 18 } }),
              block('PEN_DOWN'),
              block('SET_PEN_COLOR', { params: { color: '$randomColor' } }),
              block('CALL_F1'),
              block('LOOP_END'),
            ],
            F1: [
              varAssign('a', '$randD6'),
              varOp('a', 'a', '*', 10),
              loopStart(5),
              block('FORWARD', { params: { length: 'a' } }),
              block('TURN_RIGHT', { params: { angle: 144 } }),
              block('LOOP_END'),
            ],
          },
          'v3_varB'
        ),
      },
    ],
  },

  // =========================================================================
  // var.M1 â€” Multi-Dial Vault (Mastery Challenge, Grid, 0-starter)
  // =========================================================================
  {
    id: 'var.M1',
    moduleId: 'var',
    version: 1,
    format: 'challenge',
    simId: 'grid',
    icon: 'ðŸ”',
    title: 'Multi-Dial Vault',
    concept: 'Read three floor dials (a, b, c), compute d = a + b, retrieve the Vault Core, and drop it on the Goal Switch',
    description:
      'No starter blocks! Read dials a, b, and c from tiles 1..3, compute d = a + b, navigate East [xd] then South [x8] to pick up the Core at (4+d, 9), then turn East [xc] and drop it on the Goal Switch.',
    hint: 'Read a, step, read b, step, read c, step to (4, 1), compute d = a + b, then walk [xd], Turn Right, [x8], Pick Up, Turn Left, [xc], Drop.',
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
            varAssign('a', '$tileDial'),
            block('MOVE_FWD'),
            varAssign('b', '$tileDial'),
            block('MOVE_FWD'),
            varAssign('c', '$tileDial'),
            block('MOVE_FWD'),
            placeholder(),
            block('MOVE_FWD', { repeatCount: 'd' }),
            block('TURN_RIGHT'),
            block('MOVE_FWD', { repeatCount: 8 }),
            placeholder(),
            block('TURN_LEFT'),
            placeholder(),
            block('USE_DROP'),
          ],
        },
        'scaf_varM1'
      ),
    },
    referenceSolution: makeWorkspace(
      {
        MAIN: [
          varAssign('a', '$tileDial'),
          block('MOVE_FWD'),
          varAssign('b', '$tileDial'),
          block('MOVE_FWD'),
          varAssign('c', '$tileDial'),
          block('MOVE_FWD'),
          varOp('d', 'a', '+', 'b'),
          block('MOVE_FWD', { repeatCount: 'd' }),
          block('TURN_RIGHT'),
          block('MOVE_FWD', { repeatCount: 8 }),
          block('PICK_UP'),
          block('TURN_LEFT'),
          block('MOVE_FWD', { repeatCount: 'c' }),
          block('USE_DROP'),
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
  // var.M2 â€” Opposing Spirals (Mastery Challenge, Turtle)
  // =========================================================================
  {
    id: 'var.M2',
    moduleId: 'var',
    version: 1,
    format: 'challenge',
    simId: 'turtle',
    icon: 'â˜¯ï¸',
    title: 'Opposing Spirals',
    concept: 'Coordinate growing F1 and shrinking F2 spirals via Teleport and pose variables ($x, $y, $heading)',
    description:
      'Read initial pose into x, y, and h, grow an outer blue spiral in Function 1, Teleport symmetrically, and unwind an inner red spiral in Function 2.',
    hint: 'Save x = $x, y = $y, h = $heading in Main, then compute opposing step sizes in F1 and F2.',
    palette: VAR_M2_PALETTE,
    slotCap: {
      maxTotal: 50,
      perScope: { MAIN: 20, F1: 20, F2: 20 },
    },
    starterWorkspace: makeWorkspace(
      {
        MAIN: [
          varAssign('a', 12),
          varAssign('b', 110),
          block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.blue } }),
          block('CALL_F1'),
        ],
        F1: [
          loopStart(14),
          block('FORWARD', { params: { length: 'a' } }),
          block('TURN_RIGHT', { params: { angle: 90 } }),
          varOp('a', 'a', '+', 12),
          block('LOOP_END'),
        ],
      },
      'start_varM2'
    ),
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeWorkspace(
        {
          MAIN: [
            varAssign('a', 12),
            varAssign('b', 100),
            block('PEN_UP'),
            block('TELEPORT', { params: { x: -120, y: 20, heading: 0 } }),
            block('PEN_DOWN'),
            block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.blue } }),
            block('CALL_F1'),
            block('PEN_UP'),
            varAssign('x', '$x'),
            varAssign('y', '$y'),
            varAssign('h', '$heading'),
            varOp('u', 'x', '+', 180),
            block('TELEPORT', { params: { x: 'u', y: 'y', heading: 'h' } }),
            block('PEN_DOWN'),
            block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.red } }),
            placeholder(),
          ],
          F1: [
            loopStart(16),
            block('FORWARD', { params: { length: 'a' } }),
            block('TURN_RIGHT', { params: { angle: 90 } }),
            varOp('a', 'a', '+', 6),
            block('LOOP_END'),
          ],
          F2: [
            loopStart(16),
            block('FORWARD', { params: { length: 'b' } }),
            block('TURN_LEFT', { params: { angle: 90 } }),
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
          varAssign('a', 12),
          varAssign('b', 100),
          block('PEN_UP'),
          block('TELEPORT', { params: { x: -120, y: 20, heading: 0 } }),
          block('PEN_DOWN'),
          block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.blue } }),
          block('CALL_F1'),
          block('PEN_UP'),
          varAssign('x', '$x'),
          varAssign('y', '$y'),
          varAssign('h', '$heading'),
          varOp('u', 'x', '+', 180),
          block('TELEPORT', { params: { x: 'u', y: 'y', heading: 'h' } }),
          block('PEN_DOWN'),
          block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.red } }),
          block('CALL_F2'),
        ],
        F1: [
          loopStart(16),
          block('FORWARD', { params: { length: 'a' } }),
          block('TURN_RIGHT', { params: { angle: 90 } }),
          varOp('a', 'a', '+', 6),
          block('LOOP_END'),
        ],
        F2: [
          loopStart(16),
          block('FORWARD', { params: { length: 'b' } }),
          block('TURN_LEFT', { params: { angle: 90 } }),
          varOp('b', 'b', '-', 6),
          block('LOOP_END'),
        ],
      },
      'ref_varM2'
    ),
    variations: [
      {
        id: 'var.M2-target1-twin-spirals',
        title: 'Target 1: Opposing Twin Spirals',
        icon: 'ðŸŒ€',
        workspace: makeWorkspace(
          {
            MAIN: [
              varAssign('a', 12),
              varAssign('b', 100),
              block('PEN_UP'),
              block('TELEPORT', { params: { x: -120, y: 20, heading: 0 } }),
              block('PEN_DOWN'),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.blue } }),
              block('CALL_F1'),
              block('PEN_UP'),
              varAssign('x', '$x'),
              varAssign('y', '$y'),
              varAssign('h', '$heading'),
              varOp('u', 'x', '+', 180),
              block('TELEPORT', { params: { x: 'u', y: 'y', heading: 'h' } }),
              block('PEN_DOWN'),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.red } }),
              block('CALL_F2'),
            ],
            F1: [
              loopStart(16),
              block('FORWARD', { params: { length: 'a' } }),
              block('TURN_RIGHT', { params: { angle: 90 } }),
              varOp('a', 'a', '+', 6),
              block('LOOP_END'),
            ],
            F2: [
              loopStart(16),
              block('FORWARD', { params: { length: 'b' } }),
              block('TURN_LEFT', { params: { angle: 90 } }),
              varOp('b', 'b', '-', 6),
              block('LOOP_END'),
            ],
          },
          't1_varM2'
        ),
      },
      {
        id: 'var.M2-target2-double-helix',
        title: 'Target 2: Double-Helix Lattice',
        icon: 'ðŸ§¬',
        workspace: makeWorkspace(
          {
            MAIN: [
              varAssign('a', 15),
              varAssign('b', 115),
              block('PEN_UP'),
              block('TELEPORT', { params: { x: -110, y: -30, heading: 0 } }),
              block('PEN_DOWN'),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.cyan } }),
              block('CALL_F1'),
              block('PEN_UP'),
              block('TELEPORT', { params: { x: 110, y: 30, heading: 180 } }),
              block('PEN_DOWN'),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.purple } }),
              block('CALL_F2'),
            ],
            F1: [
              loopStart(12),
              block('FORWARD', { params: { length: 'a' } }),
              block('TURN_RIGHT', { params: { angle: 60 } }),
              varOp('a', 'a', '+', 8),
              block('LOOP_END'),
            ],
            F2: [
              loopStart(12),
              block('FORWARD', { params: { length: 'b' } }),
              block('TURN_LEFT', { params: { angle: 60 } }),
              varOp('b', 'b', '-', 8),
              block('LOOP_END'),
            ],
          },
          't2_varM2'
        ),
      },
      {
        id: 'var.M2-target3-quad-mirror',
        title: 'Target 3: Mirrored Whirlpools',
        icon: 'ðŸªž',
        workspace: makeWorkspace(
          {
            MAIN: [
              varAssign('a', 18),
              varAssign('b', 120),
              block('PEN_UP'),
              block('TELEPORT', { params: { x: -95, y: -25, heading: 0 } }),
              block('PEN_DOWN'),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.green } }),
              block('CALL_F1'),
              block('PEN_UP'),
              block('TELEPORT', { params: { x: 95, y: 25, heading: 180 } }),
              block('PEN_DOWN'),
              block('SET_PEN_COLOR', { params: { color: TURTLE_COLORS.amber } }),
              block('CALL_F2'),
            ],
            F1: [
              loopStart(14),
              block('FORWARD', { params: { length: 'a' } }),
              block('TURN_RIGHT', { params: { angle: 92 } }),
              varOp('a', 'a', '+', 7),
              block('LOOP_END'),
            ],
            F2: [
              loopStart(14),
              block('FORWARD', { params: { length: 'b' } }),
              block('TURN_LEFT', { params: { angle: 92 } }),
              varOp('b', 'b', '-', 7),
              block('LOOP_END'),
            ],
          },
          't3_varM2'
        ),
      },
    ],
  },
];
