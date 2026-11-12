import { WallEdge, WorkspaceState } from '../../types';
import { MODULE_3_BEAT_ALLOWED_BLOCKS } from './module3Beat';
import {
  CurriculumActivity,
  CurriculumGridDefinition,
  createCurriculumBlock,
} from './types';

interface GridCoord {
  x: number;
  y: number;
}

interface BlockSpec {
  type: string;
  repeatCount?: number;
  params?: Record<string, unknown>;
}

function buildWorkspaceFromSpecs(specs: readonly BlockSpec[], idPrefix: string): WorkspaceState {
  return {
    MAIN: specs.map((spec, idx) =>
      createCurriculumBlock(
        spec.type,
        spec.repeatCount,
        spec.params ? { ...spec.params } : undefined,
        `${idPrefix}_${idx + 1}`
      )
    ),
    F1: [],
    F2: [],
    F3: [],
  };
}

/**
 * Builds clean interior WallEdge barriers sealing a walkable path of consecutive coordinates
 * so off-corridor cells remain uncluttered while shortcuts outside the corridor are blocked.
 */
function buildSealedPathBarriers(
  width: number,
  height: number,
  orderedPathCells: readonly GridCoord[]
): WallEdge[] {
  const cellKey = (x: number, y: number) => `${x},${y}`;
  const edgeKey = (ax: number, ay: number, bx: number, by: number) =>
    ax < bx || (ax === bx && ay <= by)
      ? `${ax},${ay}|${bx},${by}`
      : `${bx},${by}|${ax},${ay}`;

  const inCorridor = new Set<string>();
  const openEdges = new Set<string>();

  for (let i = 0; i < orderedPathCells.length; i++) {
    const cur = orderedPathCells[i];
    inCorridor.add(cellKey(cur.x, cur.y));
    if (i + 1 < orderedPathCells.length) {
      const nxt = orderedPathCells[i + 1];
      openEdges.add(edgeKey(cur.x, cur.y, nxt.x, nxt.y));
    }
  }

  const barriers: WallEdge[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 1; x < width; x++) {
      const leftIn = inCorridor.has(cellKey(x - 1, y));
      const rightIn = inCorridor.has(cellKey(x, y));
      if ((leftIn || rightIn) && !openEdges.has(edgeKey(x - 1, y, x, y))) {
        barriers.push({ orientation: 'V', x, y });
      }
    }
  }

  for (let y = 1; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const topIn = inCorridor.has(cellKey(x, y - 1));
      const bottomIn = inCorridor.has(cellKey(x, y));
      if ((topIn || bottomIn) && !openEdges.has(edgeKey(x, y - 1, x, y))) {
        barriers.push({ orientation: 'H', x, y });
      }
    }
  }

  return barriers;
}

/**
 * Seals specific pillar cells off from their neighbors on all 4 sides without cluttering
 * open corridors, deduplicating any shared edges cleanly.
 */
function buildBlockedPillarBarriers(
  width: number,
  height: number,
  pillars: readonly GridCoord[]
): WallEdge[] {
  const seen = new Set<string>();
  const barriers: WallEdge[] = [];

  const addEdge = (orientation: 'H' | 'V', x: number, y: number) => {
    if (orientation === 'H' && (y <= 0 || y >= height || x < 0 || x >= width)) return;
    if (orientation === 'V' && (x <= 0 || x >= width || y < 0 || y >= height)) return;
    const key = `${orientation}:${x},${y}`;
    if (!seen.has(key)) {
      seen.add(key);
      barriers.push({ orientation, x, y });
    }
  };

  for (const p of pillars) {
    addEdge('H', p.x, p.y);
    addEdge('H', p.x, p.y + 1);
    addEdge('V', p.x, p.y);
    addEdge('V', p.x + 1, p.y);
  }

  return barriers;
}

const MODULE_3_TURTLE_ALLOWED_BLOCKS: string[] = [
  'FORWARD',
  'BACKWARD',
  'MOVE_FWD',
  'MOVE_BACK',
  'TURN_LEFT',
  'TURN_RIGHT',
  'PEN_UP',
  'PEN_DOWN',
  'SET_PEN_COLOR',
  'SET_PEN_WIDTH',
  'ARC_LEFT',
  'ARC_RIGHT',
];

const MODULE_3_OBJECT_ROBOT_ALLOWED_BLOCKS: string[] = [
  'MOVE_FWD',
  'MOVE_BACK',
  'TURN_LEFT',
  'TURN_RIGHT',
  'PICK_UP',
  'USE_DROP',
];

// ============================================================================
// Lesson 3.5 Grid (6×5, 8-slot tray): Loops with Object Workflows
// Sealed 3-side bridge track: (1,4) -> (1,1) -> (4,1) -> (4,4)
// Each 3-step side has a wooden plank followed by an unbridged water channel and a corner flag/goal:
//   Side 1 (North): Plank (1,3), Water (1,2), Flag 1 (1,1)
//   Side 2 (East):  Plank (2,1), Water (3,1), Flag 2 (4,1)
//   Side 3 (South): Plank (4,2), Water (4,3), Goal   (4,4)
// Reference (7 blocks <= 8 slots):
//   Loop ×3 [Move Fwd, Pick Up, Use/Drop, Move Fwd ×2, Turn Right]
// ============================================================================
const LESSON_3_5_PATH: GridCoord[] = [
  { x: 1, y: 4 },
  { x: 1, y: 3 },
  { x: 1, y: 2 },
  { x: 1, y: 1 },
  { x: 2, y: 1 },
  { x: 3, y: 1 },
  { x: 4, y: 1 },
  { x: 4, y: 2 },
  { x: 4, y: 3 },
  { x: 4, y: 4 },
];

export const LESSON_3_5_GRID: CurriculumGridDefinition = {
  width: 6,
  height: 5,
  robot: { x: 1, y: 4, dir: 'NORTH' },
  barriers: buildSealedPathBarriers(6, 5, LESSON_3_5_PATH),
  waterCells: [
    { x: 1, y: 2 },
    { x: 3, y: 1 },
    { x: 4, y: 3 },
  ],
  worldItems: [
    { id: 'plank_3_5_1', type: 'plank', x: 1, y: 3 },
    { id: 'plank_3_5_2', type: 'plank', x: 2, y: 1 },
    { id: 'plank_3_5_3', type: 'plank', x: 4, y: 2 },
  ],
  flags: [
    { id: 'flag_3_5_1', x: 1, y: 1, isGoal: false, order: 1, collected: false },
    { id: 'flag_3_5_2', x: 4, y: 1, isGoal: false, order: 2, collected: false },
    { id: 'goal_3_5', x: 4, y: 4, isGoal: true, order: 3, collected: false },
  ],
};

// ============================================================================
// Lesson 3.6 Grid (5×5, 8-slot tray): Nested Loops (Loop Inside a Loop)
// 4-Wing Windowpane Hub with sealed pillar cells at (1,1), (3,1), (1,3), (3,3).
// Robot starts at central hub (2,2) facing NORTH.
// Ordered wing corner flags run counter-clockwise around the 4 wings while each wing
// traces a clockwise 2×2 quadrant loop returning to (2,2) rotated 90° counter-clockwise:
//   Flag 1 (NE): (4,0), Flag 2 (NW): (0,0), Flag 3 (SW): (0,4), Flag 4 (SE): (4,4),
//   Goal (order 5): central hub (2,2).
// Reference (7 blocks <= 8 slots):
//   Loop ×4 [ Loop ×3 [ Move Fwd ×2, Turn Right ], Move Fwd ×2 ]
// Mathematically proven: 0 solutions with maxLoopNestingDepth: 1 within 8 slots!
// ============================================================================
export const LESSON_3_6_GRID: CurriculumGridDefinition = {
  width: 5,
  height: 5,
  robot: { x: 2, y: 2, dir: 'NORTH' },
  barriers: buildBlockedPillarBarriers(5, 5, [
    { x: 1, y: 1 },
    { x: 3, y: 1 },
    { x: 1, y: 3 },
    { x: 3, y: 3 },
  ]),
  flags: [
    { id: 'flag_3_6_1', x: 4, y: 0, isGoal: false, order: 1, collected: false },
    { id: 'flag_3_6_2', x: 0, y: 0, isGoal: false, order: 2, collected: false },
    { id: 'flag_3_6_3', x: 0, y: 4, isGoal: false, order: 3, collected: false },
    { id: 'flag_3_6_4', x: 4, y: 4, isGoal: false, order: 4, collected: false },
    { id: 'goal_3_6', x: 2, y: 2, isGoal: true, order: 5, collected: false },
  ],
};

// ============================================================================
// Capstone 3A Grid (6×6, 10-slot tray): The Automated Greenhouse
// Sealed 3-aisle U-shaped greenhouse track:
//   Entrance (North): (0,5)[Start] -> (0,4)[Plank 1]
//   Aisle 1 (North):  (0,4)[Plank 1] -> (0,3)[Water 1] -> (0,2)[Amber ● Key]   -> (0,1)[Amber ● Gate]   -> (0,0)[Plank 2]
//   Aisle 2 (East):   (0,0)[Plank 2] -> (1,0)[Water 2] -> (2,0)[Emerald ▲ Key] -> (3,0)[Emerald ▲ Gate] -> (4,0)[Plank 3]
//   Aisle 3 (South):  (4,0)[Plank 3] -> (4,1)[Water 3] -> (4,2)[Purple ◆ Key]  -> (4,3)[Purple ◆ Gate]  -> (4,4)[Corner]
//   Exit (East):      (4,4) -> (5,4)[Goal — reached via Move Back while facing West]
// Reference (10 blocks <= 10 slots):
//   Move Fwd, Loop ×3 [ Loop ×2 [ Pick Up, Use/Drop, Move Fwd ×2 ], Turn Right ], Move Back
// Unrolled flat loop requires 11 blocks (> 10 slots -> 0 flat-loop solutions!).
// ============================================================================
const CAPSTONE_3A_PATH: GridCoord[] = [
  { x: 0, y: 5 },
  { x: 0, y: 4 },
  { x: 0, y: 3 },
  { x: 0, y: 2 },
  { x: 0, y: 1 },
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 2, y: 0 },
  { x: 3, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 1 },
  { x: 4, y: 2 },
  { x: 4, y: 3 },
  { x: 4, y: 4 },
  { x: 5, y: 4 },
];

export const CAPSTONE_3A_GRID: CurriculumGridDefinition = {
  width: 6,
  height: 6,
  robot: { x: 0, y: 5, dir: 'NORTH' },
  barriers: buildSealedPathBarriers(6, 6, CAPSTONE_3A_PATH),
  waterCells: [
    { x: 0, y: 3 },
    { x: 1, y: 0 },
    { x: 4, y: 1 },
  ],
  lockedGates: [
    { id: 'gate_3A_1', x: 0, y: 1, shape: 'circle', color: 'amber', unlocked: false },
    { id: 'gate_3A_2', x: 3, y: 0, shape: 'triangle', color: 'emerald', unlocked: false },
    { id: 'gate_3A_3', x: 4, y: 3, shape: 'diamond', color: 'purple', unlocked: false },
  ],
  worldItems: [
    { id: 'plank_3A_1', type: 'plank', x: 0, y: 4 },
    { id: 'key_3A_1', type: 'key', x: 0, y: 2, shape: 'circle', color: 'amber' },
    { id: 'plank_3A_2', type: 'plank', x: 0, y: 0 },
    { id: 'key_3A_2', type: 'key', x: 2, y: 0, shape: 'triangle', color: 'emerald' },
    { id: 'plank_3A_3', type: 'plank', x: 4, y: 0 },
    { id: 'key_3A_3', type: 'key', x: 4, y: 2, shape: 'diamond', color: 'purple' },
  ],
  flags: [
    { id: 'flag_3A_1', x: 0, y: 0, isGoal: false, order: 1, collected: false },
    { id: 'flag_3A_2', x: 4, y: 0, isGoal: false, order: 2, collected: false },
    { id: 'goal_3A', x: 5, y: 4, isGoal: true, order: 3, collected: false },
  ],
};

/**
 * Module 3 Part 2 Activities (`3.5`–`3.7`, Capstones `3A`, `3B`, `3C` — Commit 18).
 */
export const MODULE_3_PART2_ACTIVITIES: CurriculumActivity[] = [
  // =========================================================================
  // 3.5 [🤖 Puzzle]: Loops with Object Workflows
  // =========================================================================
  {
    id: '3.5',
    moduleId: 'module-3',
    version: 1,
    format: 'puzzle',
    simId: 'grid',
    icon: '🤖',
    title: 'Loops with Object Workflows',
    concept: 'Repeating Multi-Step Pick Up & Bridge Workflows Inside a Loop',
    description:
      'All three sides of the canal follow the exact same bridge-building routine! Wrap Pick Up, Use/Drop, Move Forward ×2, and Turn Right inside Loop ×3 so your whole routine fits inside the 8-slot tray.',
    hint: 'Inside Loop ×3: step onto the plank with Move Forward, Pick Up, Use/Drop to bridge the water ahead, step Move Forward ×2 onto the corner flag, and Turn Right.',
    palette: {
      allowedSimBlocks: [...MODULE_3_OBJECT_ROBOT_ALLOWED_BLOCKS],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END'],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: false,
      allowVariables: false,
    },
    slotCap: {
      maxTotal: 8,
    },
    grid: LESSON_3_5_GRID,
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: {
        MAIN: [
          createCurriculumBlock('LOOP_START', 3, undefined, 'scaf_3_5_1'),
          createCurriculumBlock('MOVE_FWD', undefined, undefined, 'scaf_3_5_2'),
          createCurriculumBlock(
            'PLACEHOLDER',
            undefined,
            { hintCategory: 'item' },
            'scaf_3_5_3'
          ),
          createCurriculumBlock(
            'PLACEHOLDER',
            undefined,
            { hintCategory: 'item' },
            'scaf_3_5_4'
          ),
          createCurriculumBlock('MOVE_FWD', 2, undefined, 'scaf_3_5_5'),
          createCurriculumBlock(
            'PLACEHOLDER',
            undefined,
            { hintCategory: 'turn' },
            'scaf_3_5_6'
          ),
          createCurriculumBlock('LOOP_END', undefined, undefined, 'scaf_3_5_7'),
        ],
        F1: [],
        F2: [],
        F3: [],
      },
    },
    referenceSolution: {
      MAIN: [
        createCurriculumBlock('LOOP_START', 3, undefined, 'ref_3_5_1'),
        createCurriculumBlock('MOVE_FWD', undefined, undefined, 'ref_3_5_2'),
        createCurriculumBlock('PICK_UP', undefined, undefined, 'ref_3_5_3'),
        createCurriculumBlock('USE_DROP', undefined, undefined, 'ref_3_5_4'),
        createCurriculumBlock('MOVE_FWD', 2, undefined, 'ref_3_5_5'),
        createCurriculumBlock('TURN_RIGHT', undefined, undefined, 'ref_3_5_6'),
        createCurriculumBlock('LOOP_END', undefined, undefined, 'ref_3_5_7'),
      ],
      F1: [],
      F2: [],
      F3: [],
    },
    antiBypassRules: [
      {
        id: '3.5-require-loop',
        description:
          'Cannot bridge all 3 canal sides within the 8-slot tray without using a loop (even with ×2..×9 repeat badges enabled)',
        maxLoopNestingDepth: 0,
      },
      {
        id: '3.5-require-world-interaction',
        description:
          'Cannot cross the water channels without PICK_UP and USE_DROP (even with loops)',
        forbidBlocks: ['PICK_UP', 'USE_DROP'],
      },
    ],
  },

  // =========================================================================
  // 3.6 [🤖 Puzzle]: Nested Loops (Loop Inside a Loop)
  // =========================================================================
  {
    id: '3.6',
    moduleId: 'module-3',
    version: 1,
    format: 'puzzle',
    simId: 'grid',
    icon: '🤖',
    title: 'Nested Loops (Loop Inside a Loop)',
    concept: 'Outer Loop × Inner Loop Composition (Depth-2 Loop Nesting)',
    description:
      'Sweep all four corner wings from the central hub and return home! Place an inner Loop ×3 inside an outer Loop ×4 so the robot traces each wing loop and rotates cleanly to the next wing within 8 slots.',
    hint: 'Use Outer Loop ×4 around [ Inner Loop ×3 [ Move Forward ×2, Turn Right ], Move Forward ×2 ] to visit all 4 wing corners in order and return to the center goal.',
    palette: {
      allowedSimBlocks: ['MOVE_FWD', 'MOVE_BACK', 'TURN_LEFT', 'TURN_RIGHT'],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END'],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: false,
      allowVariables: false,
    },
    slotCap: {
      maxTotal: 8,
    },
    grid: LESSON_3_6_GRID,
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: {
        MAIN: [
          createCurriculumBlock('LOOP_START', 4, undefined, 'scaf_3_6_1'),
          createCurriculumBlock('LOOP_START', 3, undefined, 'scaf_3_6_2'),
          createCurriculumBlock('MOVE_FWD', 2, undefined, 'scaf_3_6_3'),
          createCurriculumBlock(
            'PLACEHOLDER',
            undefined,
            { hintCategory: 'turn' },
            'scaf_3_6_4'
          ),
          createCurriculumBlock('LOOP_END', undefined, undefined, 'scaf_3_6_5'),
          createCurriculumBlock(
            'PLACEHOLDER',
            undefined,
            { hintCategory: 'motion' },
            'scaf_3_6_6'
          ),
          createCurriculumBlock('LOOP_END', undefined, undefined, 'scaf_3_6_7'),
        ],
        F1: [],
        F2: [],
        F3: [],
      },
    },
    referenceSolution: {
      MAIN: [
        createCurriculumBlock('LOOP_START', 4, undefined, 'ref_3_6_1'),
        createCurriculumBlock('LOOP_START', 3, undefined, 'ref_3_6_2'),
        createCurriculumBlock('MOVE_FWD', 2, undefined, 'ref_3_6_3'),
        createCurriculumBlock('TURN_RIGHT', undefined, undefined, 'ref_3_6_4'),
        createCurriculumBlock('LOOP_END', undefined, undefined, 'ref_3_6_5'),
        createCurriculumBlock('MOVE_FWD', 2, undefined, 'ref_3_6_6'),
        createCurriculumBlock('LOOP_END', undefined, undefined, 'ref_3_6_7'),
      ],
      F1: [],
      F2: [],
      F3: [],
    },
    antiBypassRules: [
      {
        id: '3.6-require-nested-loop',
        description:
          'Cannot solve the 4-wing hub within 8 slots using only flat loops (depth <= 1) and ×2..×9 repeat badges',
        maxLoopNestingDepth: 1,
      },
    ],
  },

  // =========================================================================
  // 3.7 [🐢 Sandbox]: Nested Loop Rosettes & Spirographs
  // =========================================================================
  {
    id: '3.7',
    moduleId: 'module-3',
    version: 1,
    format: 'sandbox',
    simId: 'turtle',
    icon: '🐢',
    title: 'Nested Loop Rosettes & Spirographs',
    concept: 'Inner Shape Loop + Outer Rotation / Translation Loop',
    description:
      'Put a shape loop inside an outer rotation or stepping loop to spin squares, arc petals, triangles, and stars into dazzling geometric rosettes!',
    hint: 'Run the 6-rotated-squares rosette, preview the Arc Flower, Triangle Pinwheel, or Star Row cards, and tweak inner vs. outer repeat counts to invent new spirographs.',
    palette: {
      allowedSimBlocks: [
        ...MODULE_3_TURTLE_ALLOWED_BLOCKS,
        'TELEPORT',
        'WAIT',
        'SET_INSTANT',
        'CLEAR_CANVAS',
      ],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END'],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: true,
      allowVariables: false,
    },
    starterWorkspace: buildWorkspaceFromSpecs(
      [
        { type: 'SET_PEN_COLOR', params: { color: '#8b5cf6' } },
        { type: 'SET_PEN_WIDTH', params: { width: 4 } },
        { type: 'LOOP_START', repeatCount: 6 },
        { type: 'LOOP_START', repeatCount: 4 },
        { type: 'FORWARD', params: { length: 75 } },
        { type: 'TURN_RIGHT', params: { angle: 90 } },
        { type: 'LOOP_END' },
        { type: 'TURN_RIGHT', params: { angle: 60 } },
        { type: 'LOOP_END' },
      ],
      'm3_7_starter'
    ),
    variations: [
      {
        id: '3.7-arc-flower',
        title: '8-Petal Arc Flower',
        icon: '🌸',
        workspace: buildWorkspaceFromSpecs(
          [
            { type: 'SET_PEN_COLOR', params: { color: '#ec4899' } },
            { type: 'LOOP_START', repeatCount: 8 },
            { type: 'LOOP_START', repeatCount: 2 },
            { type: 'ARC_RIGHT', params: { radius: 75, angle: 90 } },
            { type: 'TURN_RIGHT', params: { angle: 90 } },
            { type: 'LOOP_END' },
            { type: 'TURN_RIGHT', params: { angle: 45 } },
            { type: 'LOOP_END' },
          ],
          'm3_7_arc_flower'
        ),
      },
      {
        id: '3.7-triangle-pinwheel',
        title: '6-Wing Pinwheel',
        icon: '🌀',
        workspace: buildWorkspaceFromSpecs(
          [
            { type: 'SET_PEN_COLOR', params: { color: '#06b6d4' } },
            { type: 'LOOP_START', repeatCount: 6 },
            { type: 'LOOP_START', repeatCount: 3 },
            { type: 'FORWARD', params: { length: 100 } },
            { type: 'TURN_RIGHT', params: { angle: 120 } },
            { type: 'LOOP_END' },
            { type: 'TURN_LEFT', params: { angle: 60 } },
            { type: 'LOOP_END' },
          ],
          'm3_7_pinwheel'
        ),
      },
      {
        id: '3.7-star-row',
        title: 'Spaced Star Row',
        icon: '🌟',
        workspace: buildWorkspaceFromSpecs(
          [
            { type: 'SET_PEN_COLOR', params: { color: '#f59e0b' } },
            { type: 'LOOP_START', repeatCount: 4 },
            { type: 'LOOP_START', repeatCount: 8 },
            { type: 'FORWARD', params: { length: 50 } },
            { type: 'TURN_RIGHT', params: { angle: 135 } },
            { type: 'LOOP_END' },
            { type: 'PEN_UP' },
            { type: 'FORWARD', params: { length: 75 } },
            { type: 'PEN_DOWN' },
            { type: 'LOOP_END' },
          ],
          'm3_7_star_row'
        ),
      },
    ],
  },

  // =========================================================================
  // 3A [🏆 🤖 Capstone]: The Automated Greenhouse
  // =========================================================================
  {
    id: '3A',
    moduleId: 'module-3',
    version: 1,
    format: 'capstone',
    capstoneType: 'puzzle',
    simId: 'grid',
    icon: '🏆',
    title: 'The Automated Greenhouse',
    concept: 'Capstone Synthesis — Nested Aisle Loops + Canal Planks & Greenhouse Gates',
    description:
      'Bridge three irrigation canals and unlock three security gates across the three greenhouse aisles! Step onto the first plank, run an inner Loop ×2 inside an outer Loop ×3, and back into the East exit dock within 10 slots.',
    hint: 'Start with Move Forward onto the first plank, wrap Inner Loop ×2 [ Pick Up, Use/Drop, Move Forward ×2 ] + Turn Right inside Outer Loop ×3, and finish with Move Back into the East goal dock.',
    palette: {
      allowedSimBlocks: [...MODULE_3_OBJECT_ROBOT_ALLOWED_BLOCKS],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END'],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: false,
      allowVariables: false,
    },
    slotCap: {
      maxTotal: 10,
    },
    grid: CAPSTONE_3A_GRID,
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: {
        MAIN: [
          createCurriculumBlock('MOVE_FWD', undefined, undefined, 'scaf_3A_1'),
          createCurriculumBlock('LOOP_START', 3, undefined, 'scaf_3A_2'),
          createCurriculumBlock('LOOP_START', 2, undefined, 'scaf_3A_3'),
          createCurriculumBlock(
            'PLACEHOLDER',
            undefined,
            { hintCategory: 'item' },
            'scaf_3A_4'
          ),
          createCurriculumBlock(
            'PLACEHOLDER',
            undefined,
            { hintCategory: 'item' },
            'scaf_3A_5'
          ),
          createCurriculumBlock('MOVE_FWD', 2, undefined, 'scaf_3A_6'),
          createCurriculumBlock('LOOP_END', undefined, undefined, 'scaf_3A_7'),
          createCurriculumBlock(
            'PLACEHOLDER',
            undefined,
            { hintCategory: 'turn' },
            'scaf_3A_8'
          ),
          createCurriculumBlock('LOOP_END', undefined, undefined, 'scaf_3A_9'),
          createCurriculumBlock('MOVE_BACK', undefined, undefined, 'scaf_3A_10'),
        ],
        F1: [],
        F2: [],
        F3: [],
      },
    },
    referenceSolution: {
      MAIN: [
        createCurriculumBlock('MOVE_FWD', undefined, undefined, 'ref_3A_1'),
        createCurriculumBlock('LOOP_START', 3, undefined, 'ref_3A_2'),
        createCurriculumBlock('LOOP_START', 2, undefined, 'ref_3A_3'),
        createCurriculumBlock('PICK_UP', undefined, undefined, 'ref_3A_4'),
        createCurriculumBlock('USE_DROP', undefined, undefined, 'ref_3A_5'),
        createCurriculumBlock('MOVE_FWD', 2, undefined, 'ref_3A_6'),
        createCurriculumBlock('LOOP_END', undefined, undefined, 'ref_3A_7'),
        createCurriculumBlock('TURN_RIGHT', undefined, undefined, 'ref_3A_8'),
        createCurriculumBlock('LOOP_END', undefined, undefined, 'ref_3A_9'),
        createCurriculumBlock('MOVE_BACK', undefined, undefined, 'ref_3A_10'),
      ],
      F1: [],
      F2: [],
      F3: [],
    },
    antiBypassRules: [
      {
        id: '3A-require-nested-loops',
        description:
          'Cannot clear all 3 greenhouse aisles (3 canals + 3 locked gates) within 10 slots using only flat loops (depth <= 1)',
        maxLoopNestingDepth: 1,
      },
      {
        id: '3A-require-world-interaction',
        description:
          'Cannot cross the greenhouse canals and locked gates without PICK_UP and USE_DROP (even with nested loops)',
        forbidBlocks: ['PICK_UP', 'USE_DROP'],
      },
    ],
  },

  // =========================================================================
  // 3B [🎨 🐢 Capstone]: Kaleidoscope Medallion
  // =========================================================================
  {
    id: '3B',
    moduleId: 'module-3',
    version: 1,
    format: 'capstone',
    capstoneType: 'creative',
    simId: 'turtle',
    icon: '🎨',
    title: 'Kaleidoscope Medallion',
    concept: 'Creative Synthesis — Layered Nested Loop Mandalas, Colors & Arcs',
    description:
      'Design a multi-layered kaleidoscope medallion by combining nested polygon loops, sweeping outer arc rings, and bold pen colors!',
    hint: 'Run the two-layer mandala starter, explore the Crystal Snowflake, Gondola Ferris Wheel, or Honeycomb Ring cards, and tap ✓ Done when your medallion is complete!',
    palette: {
      allowedSimBlocks: [
        ...MODULE_3_TURTLE_ALLOWED_BLOCKS,
        'TELEPORT',
        'WAIT',
        'SET_INSTANT',
        'CLEAR_CANVAS',
      ],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END'],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: true,
      allowVariables: false,
    },
    starterWorkspace: buildWorkspaceFromSpecs(
      [
        { type: 'SET_PEN_COLOR', params: { color: '#8b5cf6' } },
        { type: 'SET_PEN_WIDTH', params: { width: 4 } },
        { type: 'LOOP_START', repeatCount: 6 },
        { type: 'LOOP_START', repeatCount: 4 },
        { type: 'FORWARD', params: { length: 50 } },
        { type: 'TURN_RIGHT', params: { angle: 90 } },
        { type: 'LOOP_END' },
        { type: 'TURN_RIGHT', params: { angle: 60 } },
        { type: 'LOOP_END' },
        { type: 'SET_PEN_COLOR', params: { color: '#ec4899' } },
        { type: 'LOOP_START', repeatCount: 6 },
        { type: 'ARC_LEFT', params: { radius: 100, angle: 120 } },
        { type: 'TURN_LEFT', params: { angle: 180 } },
        { type: 'LOOP_END' },
      ],
      'm3_3B_starter'
    ),
    variations: [
      {
        id: '3B-crystal-snowflake',
        title: 'Crystal Snowflake Ring',
        icon: '❄️',
        workspace: buildWorkspaceFromSpecs(
          [
            { type: 'SET_PEN_COLOR', params: { color: '#06b6d4' } },
            { type: 'SET_PEN_WIDTH', params: { width: 4 } },
            { type: 'LOOP_START', repeatCount: 6 },
            { type: 'FORWARD', params: { length: 75 } },
            { type: 'TURN_LEFT', params: { angle: 60 } },
            { type: 'LOOP_START', repeatCount: 3 },
            { type: 'FORWARD', params: { length: 25 } },
            { type: 'BACKWARD', params: { length: 25 } },
            { type: 'TURN_RIGHT', params: { angle: 60 } },
            { type: 'LOOP_END' },
            { type: 'TURN_LEFT', params: { angle: 120 } },
            { type: 'BACKWARD', params: { length: 75 } },
            { type: 'TURN_RIGHT', params: { angle: 60 } },
            { type: 'LOOP_END' },
          ],
          'm3_3B_snowflake'
        ),
      },
      {
        id: '3B-ferris-wheel',
        title: 'Gondola Ferris Wheel',
        icon: '🎡',
        workspace: buildWorkspaceFromSpecs(
          [
            { type: 'SET_PEN_COLOR', params: { color: '#f59e0b' } },
            { type: 'SET_PEN_WIDTH', params: { width: 4 } },
            { type: 'LOOP_START', repeatCount: 8 },
            { type: 'FORWARD', params: { length: 100 } },
            { type: 'SET_PEN_COLOR', params: { color: '#3b82f6' } },
            { type: 'LOOP_START', repeatCount: 4 },
            { type: 'FORWARD', params: { length: 25 } },
            { type: 'TURN_RIGHT', params: { angle: 90 } },
            { type: 'LOOP_END' },
            { type: 'SET_PEN_COLOR', params: { color: '#f59e0b' } },
            { type: 'BACKWARD', params: { length: 100 } },
            { type: 'TURN_RIGHT', params: { angle: 45 } },
            { type: 'LOOP_END' },
          ],
          'm3_3B_ferris'
        ),
      },
      {
        id: '3B-honeycomb-ring',
        title: 'Honeycomb Medallion',
        icon: '🐝',
        workspace: buildWorkspaceFromSpecs(
          [
            { type: 'SET_PEN_COLOR', params: { color: '#10b981' } },
            { type: 'SET_PEN_WIDTH', params: { width: 4 } },
            { type: 'LOOP_START', repeatCount: 6 },
            { type: 'LOOP_START', repeatCount: 6 },
            { type: 'FORWARD', params: { length: 50 } },
            { type: 'TURN_RIGHT', params: { angle: 60 } },
            { type: 'LOOP_END' },
            { type: 'TURN_RIGHT', params: { angle: 60 } },
            { type: 'LOOP_END' },
            { type: 'SET_PEN_COLOR', params: { color: '#ef4444' } },
            { type: 'ARC_RIGHT', params: { radius: 50, angle: 360 } },
            { type: 'ARC_LEFT', params: { radius: 50, angle: 360 } },
          ],
          'm3_3B_honeycomb'
        ),
      },
    ],
  },

  // =========================================================================
  // 3C [🎨 🎵 Capstone]: Looping Lightshow
  // =========================================================================
  {
    id: '3C',
    moduleId: 'module-3',
    version: 1,
    format: 'capstone',
    capstoneType: 'creative',
    simId: 'beat',
    icon: '🎨',
    title: 'Looping Lightshow',
    concept: 'Creative Synthesis — Nested Rhythm Ostinatos & Synchronized 8×8 LED Sweeps',
    description:
      'Combine nested beat loops, synth melodies, LED matrix stamps, and perimeter cursor sweeps to choreograph your own concert lightshow!',
    hint: 'Press Play to launch the Star Border Lightshow, preview the Equalizer Pulse, Radar Crosshair, or Arcade Heartbeat cards, and tap ✓ Done when your show rocks!',
    palette: {
      allowedSimBlocks: [...MODULE_3_BEAT_ALLOWED_BLOCKS],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END'],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: true,
      allowVariables: false,
    },
    starterWorkspace: buildWorkspaceFromSpecs(
      [
        { type: 'SET_LED_COLOR', params: { color: '#06b6d4' } },
        { type: 'STAMP_PRESET', params: { preset: 'STAR' } },
        { type: 'LOOP_START', repeatCount: 4 },
        { type: 'DRUM_KICK' },
        { type: 'LOOP_START', repeatCount: 2 },
        { type: 'CURSOR_STEP', repeatCount: 3 },
        { type: 'PLAY_NOTE', params: { pitch: 5, duration: 0.5 } },
        { type: 'LOOP_END' },
        { type: 'CURSOR_STEP' },
        { type: 'DRUM_SNARE' },
        { type: 'CURSOR_TURN', params: { direction: 'RIGHT' } },
        { type: 'LOOP_END' },
      ],
      'm3_3C_starter'
    ),
    variations: [
      {
        id: '3C-equalizer-pulse',
        title: 'Equalizer Column Pulse',
        icon: '📊',
        workspace: buildWorkspaceFromSpecs(
          [
            { type: 'LOOP_START', repeatCount: 2 },
            { type: 'SET_LED_COLOR', params: { color: '#10b981' } },
            { type: 'LIGHT_COL', params: { x: 2 } },
            { type: 'LIGHT_COL', params: { x: 7 } },
            { type: 'LOOP_START', repeatCount: 2 },
            { type: 'DRUM_KICK' },
            { type: 'PLAY_NOTE', params: { pitch: 2, duration: 0.5 } },
            { type: 'LOOP_END' },
            { type: 'SET_LED_COLOR', params: { color: '#fbbf24' } },
            { type: 'LIGHT_COL', params: { x: 4 } },
            { type: 'LIGHT_COL', params: { x: 5 } },
            { type: 'DRUM_CLAP' },
            { type: 'LOOP_END' },
          ],
          'm3_3C_equalizer'
        ),
      },
      {
        id: '3C-radar-sweep',
        title: 'Radar Crosshair Sweep',
        icon: '📡',
        workspace: buildWorkspaceFromSpecs(
          [
            { type: 'SET_LED_COLOR', params: { color: '#a855f7' } },
            { type: 'LIGHT_ROW', params: { y: 4 } },
            { type: 'LIGHT_COL', params: { x: 4 } },
            { type: 'SET_LED_COLOR', params: { color: '#f43f5e' } },
            { type: 'LOOP_START', repeatCount: 4 },
            { type: 'PLAY_NOTE', params: { pitch: 6, duration: 0.5 } },
            { type: 'LOOP_START', repeatCount: 2 },
            { type: 'CURSOR_STEP', repeatCount: 3 },
            { type: 'DRUM_CLAP' },
            { type: 'LOOP_END' },
            { type: 'CURSOR_STEP' },
            { type: 'CURSOR_TURN', params: { direction: 'RIGHT' } },
            { type: 'LOOP_END' },
          ],
          'm3_3C_radar'
        ),
      },
      {
        id: '3C-arcade-heartbeat',
        title: 'Arcade Heartbeat Loop',
        icon: '🕹️',
        workspace: buildWorkspaceFromSpecs(
          [
            { type: 'LOOP_START', repeatCount: 2 },
            { type: 'SET_LED_COLOR', params: { color: '#ec4899' } },
            { type: 'STAMP_PRESET', params: { preset: 'HEART' } },
            { type: 'LOOP_START', repeatCount: 2 },
            { type: 'DRUM_KICK' },
            { type: 'PLAY_NOTE', params: { pitch: 3, duration: 0.5 } },
            { type: 'PLAY_NOTE', params: { pitch: 5, duration: 0.5 } },
            { type: 'LOOP_END' },
            { type: 'SET_LED_COLOR', params: { color: '#3b82f6' } },
            { type: 'LIGHT_ROW', params: { y: 1 } },
            { type: 'LIGHT_ROW', params: { y: 8 } },
            { type: 'PLAY_CHIME' },
            { type: 'LOOP_END' },
          ],
          'm3_3C_arcade'
        ),
      },
    ],
  },
];
