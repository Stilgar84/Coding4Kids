import { WallEdge, WorkspaceState } from '../../types';
import {
  CurriculumActivity,
  CurriculumGridDefinition,
  ExplanationDemoTab,
  createCurriculumBlock,
} from './types';

interface GridCoord {
  x: number;
  y: number;
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
 * Lesson 3.0 Shared Grid (6×5):
 * Robot starts at (1,1) facing NORTH.
 * Walkable perimeter circuit (1,1) -> (4,1) [Flag 1] -> (4,4) [Flag 2] -> (1,4) [Flag 3] -> (1,1),
 * plus final North exit step (1,1) -> (1,0) [Goal, order 4].
 * - Tab [1]: 8 unrolled blocks reach Goal on block 8.
 * - Tab [2]: Loop ×4 [Turn Right, Move Fwd ×3] + Move Fwd (5 blocks) steps through 1/4..4/4
 *            and exits past LOOP_END onto the final Move Fwd to reach Goal.
 */
const LESSON_3_0_PATH: GridCoord[] = [
  { x: 1, y: 1 },
  { x: 2, y: 1 },
  { x: 3, y: 1 },
  { x: 4, y: 1 },
  { x: 4, y: 2 },
  { x: 4, y: 3 },
  { x: 4, y: 4 },
  { x: 3, y: 4 },
  { x: 2, y: 4 },
  { x: 1, y: 4 },
  { x: 1, y: 3 },
  { x: 1, y: 2 },
  { x: 1, y: 1 },
  { x: 1, y: 0 },
];

export const LESSON_3_0_SHARED_GRID: CurriculumGridDefinition = {
  width: 6,
  height: 5,
  robot: { x: 1, y: 1, dir: 'NORTH' },
  barriers: buildSealedPathBarriers(6, 5, LESSON_3_0_PATH),
  flags: [
    { id: 'flag_3_0_1', x: 4, y: 1, isGoal: false, order: 1, collected: false },
    { id: 'flag_3_0_2', x: 4, y: 4, isGoal: false, order: 2, collected: false },
    { id: 'flag_3_0_3', x: 1, y: 4, isGoal: false, order: 3, collected: false },
    { id: 'goal_3_0', x: 1, y: 0, isGoal: true, order: 4, collected: false },
  ],
};

const LESSON_3_0_UNROLLED_WORKSPACE: WorkspaceState = {
  MAIN: [
    createCurriculumBlock('TURN_RIGHT', undefined, undefined, 'demo_3_0_t1_1'),
    createCurriculumBlock('MOVE_FWD', 3, undefined, 'demo_3_0_t1_2'),
    createCurriculumBlock('TURN_RIGHT', undefined, undefined, 'demo_3_0_t1_3'),
    createCurriculumBlock('MOVE_FWD', 3, undefined, 'demo_3_0_t1_4'),
    createCurriculumBlock('TURN_RIGHT', undefined, undefined, 'demo_3_0_t1_5'),
    createCurriculumBlock('MOVE_FWD', 3, undefined, 'demo_3_0_t1_6'),
    createCurriculumBlock('TURN_RIGHT', undefined, undefined, 'demo_3_0_t1_7'),
    createCurriculumBlock('MOVE_FWD', 4, undefined, 'demo_3_0_t1_8'),
  ],
  F1: [],
  F2: [],
  F3: [],
};

const LESSON_3_0_LOOP_WORKSPACE: WorkspaceState = {
  MAIN: [
    createCurriculumBlock('LOOP_START', 4, undefined, 'demo_3_0_t2_1'),
    createCurriculumBlock('TURN_RIGHT', undefined, undefined, 'demo_3_0_t2_2'),
    createCurriculumBlock('MOVE_FWD', 3, undefined, 'demo_3_0_t2_3'),
    createCurriculumBlock('LOOP_END', undefined, undefined, 'demo_3_0_t2_4'),
    createCurriculumBlock('MOVE_FWD', undefined, undefined, 'demo_3_0_t2_5'),
  ],
  F1: [],
  F2: [],
  F3: [],
};

export const LESSON_3_0_DEMO_TABS: ExplanationDemoTab[] = [
  {
    id: '3.0-tab-1',
    label: '1',
    icon: '📏',
    title: '8 Unrolled Blocks',
    gridState: LESSON_3_0_SHARED_GRID,
    workspace: LESSON_3_0_UNROLLED_WORKSPACE,
    spotlights: ['execution-order', 'loop-counter'],
  },
  {
    id: '3.0-tab-2',
    label: '2',
    icon: '🔁',
    title: 'Loop ×4 Compact Pattern',
    gridState: LESSON_3_0_SHARED_GRID,
    workspace: LESSON_3_0_LOOP_WORKSPACE,
    spotlights: ['execution-order', 'loop-counter'],
  },
];

/**
 * Lesson 3.1 Grid (5×5, 5-slot tray):
 * Repeating 3-block stepped corner motif: Loop ×3 [Move Fwd ×2, Turn Right, Move Fwd] (5 blocks).
 * Unrolled with ×2..×9 repeat badges takes 7 blocks:
 * [Move Fwd ×2, Turn Right, Move Fwd ×3, Turn Right, Move Fwd ×3, Turn Right, Move Fwd],
 * which exceeds the 5-slot tray (proven 0 loop-free solutions).
 */
const LESSON_3_1_PATH: GridCoord[] = [
  { x: 0, y: 3 },
  { x: 0, y: 2 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
  { x: 2, y: 1 },
  { x: 3, y: 1 },
  { x: 3, y: 2 },
  { x: 3, y: 3 },
  { x: 3, y: 4 },
  { x: 2, y: 4 },
];

export const LESSON_3_1_GRID: CurriculumGridDefinition = {
  width: 5,
  height: 5,
  robot: { x: 0, y: 3, dir: 'NORTH' },
  barriers: buildSealedPathBarriers(5, 5, LESSON_3_1_PATH),
  flags: [
    { id: 'flag_3_1_1', x: 1, y: 1, isGoal: false, order: 1, collected: false },
    { id: 'flag_3_1_2', x: 3, y: 2, isGoal: false, order: 2, collected: false },
    { id: 'goal_3_1', x: 2, y: 4, isGoal: true, order: 3, collected: false },
  ],
};

/**
 * Lesson 3.2 Grid (6×5, 7-slot tray):
 * Pre-loop setup: (1,3) SOUTH -> Move Fwd -> (1,4).
 * Loop ×3 [Turn Left, Move Fwd ×3]:
 *   Iter 1: Turn Left (EAST), (1,4) -> (4,4) [Flag 1]
 *   Iter 2: Turn Left (NORTH), (4,4) -> (4,1) [Flag 2]
 *   Iter 3: Turn Left (WEST), (4,1) -> (1,1) [Flag 3]
 * Post-loop finish: Turn Right (NORTH), Move Fwd -> (1,0) [Goal].
 * Proven unsolvable without loops (needs 9 blocks > 7 slots) AND proven unsolvable
 * with pureSingleLoopOnly: true (flat or nested) within 7 slots.
 */
const LESSON_3_2_PATH: GridCoord[] = [
  { x: 1, y: 3 },
  { x: 1, y: 4 },
  { x: 2, y: 4 },
  { x: 3, y: 4 },
  { x: 4, y: 4 },
  { x: 4, y: 3 },
  { x: 4, y: 2 },
  { x: 4, y: 1 },
  { x: 3, y: 1 },
  { x: 2, y: 1 },
  { x: 1, y: 1 },
  { x: 1, y: 0 },
];

export const LESSON_3_2_GRID: CurriculumGridDefinition = {
  width: 6,
  height: 5,
  robot: { x: 1, y: 3, dir: 'SOUTH' },
  barriers: buildSealedPathBarriers(6, 5, LESSON_3_2_PATH),
  flags: [
    { id: 'flag_3_2_1', x: 4, y: 4, isGoal: false, order: 1, collected: false },
    { id: 'flag_3_2_2', x: 4, y: 1, isGoal: false, order: 2, collected: false },
    { id: 'flag_3_2_3', x: 1, y: 1, isGoal: false, order: 3, collected: false },
    { id: 'goal_3_2', x: 1, y: 0, isGoal: true, order: 4, collected: false },
  ],
};

/**
 * Module 3 Core Loop Activities (`3.0`–`3.3` — Commit 16).
 */
export const MODULE_3_PART1_ACTIVITIES: CurriculumActivity[] = [
  {
    id: '3.0',
    moduleId: 'module-3',
    version: 1,
    format: 'explanation',
    simId: 'grid',
    icon: '📖',
    title: 'How Loop Start & Loop End Work',
    concept: 'Multi-Block Loop Brackets, Iteration Counter (1/4..4/4) & Loop Exit',
    description:
      'Compare 8 unrolled blocks on Tab [1] with a compact Loop ×4 bracket on Tab [2]. Watch the live counter step 1/4 → 2/4 → 3/4 → 4/4 and exit past Loop End to reach the goal.',
    hint: 'Step through Demo [1] and Demo [2] to compare 8 blocks against Loop ×4, then tap Continue (→) for Lesson 3.1.',
    palette: {
      allowedSimBlocks: ['MOVE_FWD', 'TURN_LEFT', 'TURN_RIGHT'],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END'],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: false,
      allowVariables: false,
    },
    grid: LESSON_3_0_SHARED_GRID,
    starterWorkspace: {
      MAIN: LESSON_3_0_UNROLLED_WORKSPACE.MAIN.map((b) => ({ ...b })),
      F1: [],
      F2: [],
      F3: [],
    },
    demoTabs: LESSON_3_0_DEMO_TABS,
  },
  {
    id: '3.1',
    moduleId: 'module-3',
    version: 1,
    format: 'puzzle',
    simId: 'grid',
    icon: '🤖',
    title: 'Simple Multi-Block Loops',
    concept: 'Wrapping a Multi-Block Motif Inside Loop Start & Loop End',
    description:
      'Wrap the repeating 3-block corner motif inside Loop Start (×3) and Loop End so your whole program fits cleanly inside the 5-slot tray.',
    hint: 'Place Loop Start ×3 at the beginning, Move Forward ×2 + Turn Right + Move Forward inside, and Loop End at the end.',
    palette: {
      allowedSimBlocks: ['MOVE_FWD', 'MOVE_BACK', 'TURN_LEFT', 'TURN_RIGHT'],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END'],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: false,
      allowVariables: false,
    },
    slotCap: {
      maxTotal: 5,
    },
    grid: LESSON_3_1_GRID,
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: {
        MAIN: [
          createCurriculumBlock('LOOP_START', 3, undefined, 'scaf_3_1_1'),
          createCurriculumBlock('MOVE_FWD', 2, undefined, 'scaf_3_1_2'),
          createCurriculumBlock(
            'PLACEHOLDER',
            undefined,
            { hintCategory: 'turn' },
            'scaf_3_1_3'
          ),
          createCurriculumBlock(
            'PLACEHOLDER',
            undefined,
            { hintCategory: 'motion' },
            'scaf_3_1_4'
          ),
          createCurriculumBlock('LOOP_END', undefined, undefined, 'scaf_3_1_5'),
        ],
        F1: [],
        F2: [],
        F3: [],
      },
    },
    referenceSolution: {
      MAIN: [
        createCurriculumBlock('LOOP_START', 3, undefined, 'ref_3_1_1'),
        createCurriculumBlock('MOVE_FWD', 2, undefined, 'ref_3_1_2'),
        createCurriculumBlock('TURN_RIGHT', undefined, undefined, 'ref_3_1_3'),
        createCurriculumBlock('MOVE_FWD', undefined, undefined, 'ref_3_1_4'),
        createCurriculumBlock('LOOP_END', undefined, undefined, 'ref_3_1_5'),
      ],
      F1: [],
      F2: [],
      F3: [],
    },
    antiBypassRules: [
      {
        id: '3.1-require-loop',
        description:
          'Cannot solve within 5 slots without using a loop (even with ×2..×9 repeat badges enabled)',
        maxLoopNestingDepth: 0,
      },
    ],
  },
  {
    id: '3.2',
    moduleId: 'module-3',
    version: 1,
    format: 'puzzle',
    simId: 'grid',
    icon: '🤖',
    title: 'Before, Inside, and After the Loop',
    concept: 'Separating One-Time Setup & Finish Steps from the Repeated Loop Body',
    description:
      'Not every step belongs inside the loop! Step South into the corner before Loop Start, repeat the 3 counter-clockwise sides inside the loop, and turn Right to step North to the goal after Loop End.',
    hint: 'Use Move Forward before Loop Start ×3, put Turn Left + Move Forward ×3 inside, and finish with Turn Right + Move Forward after Loop End.',
    palette: {
      allowedSimBlocks: ['MOVE_FWD', 'MOVE_BACK', 'TURN_LEFT', 'TURN_RIGHT'],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END'],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: false,
      allowVariables: false,
    },
    slotCap: {
      maxTotal: 7,
    },
    grid: LESSON_3_2_GRID,
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: {
        MAIN: [
          createCurriculumBlock(
            'PLACEHOLDER',
            undefined,
            { hintCategory: 'motion' },
            'scaf_3_2_1'
          ),
          createCurriculumBlock('LOOP_START', 3, undefined, 'scaf_3_2_2'),
          createCurriculumBlock('TURN_LEFT', undefined, undefined, 'scaf_3_2_3'),
          createCurriculumBlock('MOVE_FWD', 3, undefined, 'scaf_3_2_4'),
          createCurriculumBlock('LOOP_END', undefined, undefined, 'scaf_3_2_5'),
          createCurriculumBlock(
            'PLACEHOLDER',
            undefined,
            { hintCategory: 'turn' },
            'scaf_3_2_6'
          ),
          createCurriculumBlock('MOVE_FWD', undefined, undefined, 'scaf_3_2_7'),
        ],
        F1: [],
        F2: [],
        F3: [],
      },
    },
    referenceSolution: {
      MAIN: [
        createCurriculumBlock('MOVE_FWD', undefined, undefined, 'ref_3_2_1'),
        createCurriculumBlock('LOOP_START', 3, undefined, 'ref_3_2_2'),
        createCurriculumBlock('TURN_LEFT', undefined, undefined, 'ref_3_2_3'),
        createCurriculumBlock('MOVE_FWD', 3, undefined, 'ref_3_2_4'),
        createCurriculumBlock('LOOP_END', undefined, undefined, 'ref_3_2_5'),
        createCurriculumBlock('TURN_RIGHT', undefined, undefined, 'ref_3_2_6'),
        createCurriculumBlock('MOVE_FWD', undefined, undefined, 'ref_3_2_7'),
      ],
      F1: [],
      F2: [],
      F3: [],
    },
    antiBypassRules: [
      {
        id: '3.2-require-loop',
        description:
          'Cannot solve within 7 slots without using a loop (even with ×2..×9 repeat badges enabled)',
        maxLoopNestingDepth: 0,
      },
      {
        id: '3.2-require-outside-loop-steps',
        description:
          'Cannot absorb pre-loop setup and post-loop finish steps into a single pure outer loop within 7 slots',
        pureSingleLoopOnly: true,
      },
    ],
  },
  {
    id: '3.3',
    moduleId: 'module-3',
    version: 1,
    format: 'sandbox',
    simId: 'turtle',
    icon: '🐢',
    title: 'Closed Polygons & Star Loops',
    concept: 'Geometric Star & Sunburst Symmetry with Loops',
    description:
      'Repeating Forward and Turn inside a loop weaves closed stars and sunbursts! Run the 5-pointed star, then try a 6-pointed star, 8-pointed star, or spiked sun rays.',
    hint: 'Experiment with repeat counts and turn angles (like 144° for a 5-star or 135° for an 8-star), or load a variation card to remix!',
    palette: {
      allowedSimBlocks: [
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
    starterWorkspace: {
      MAIN: [
        createCurriculumBlock(
          'SET_PEN_COLOR',
          undefined,
          { color: '#f59e0b' },
          'm3_3_starter_1'
        ),
        createCurriculumBlock('LOOP_START', 5, undefined, 'm3_3_starter_2'),
        createCurriculumBlock('FORWARD', undefined, { length: 140 }, 'm3_3_starter_3'),
        createCurriculumBlock('TURN_RIGHT', undefined, { angle: 144 }, 'm3_3_starter_4'),
        createCurriculumBlock('LOOP_END', undefined, undefined, 'm3_3_starter_5'),
      ],
      F1: [],
      F2: [],
      F3: [],
    },
    variations: [
      {
        id: '3.3-six-star',
        title: '6-Pointed Star',
        icon: '✡️',
        workspace: {
          MAIN: [
            createCurriculumBlock(
              'SET_PEN_COLOR',
              undefined,
              { color: '#8b5cf6' },
              'm3_3_var1_1'
            ),
            createCurriculumBlock('LOOP_START', 6, undefined, 'm3_3_var1_2'),
            createCurriculumBlock('FORWARD', undefined, { length: 65 }, 'm3_3_var1_3'),
            createCurriculumBlock('TURN_RIGHT', undefined, { angle: 120 }, 'm3_3_var1_4'),
            createCurriculumBlock('FORWARD', undefined, { length: 65 }, 'm3_3_var1_5'),
            createCurriculumBlock('TURN_LEFT', undefined, { angle: 60 }, 'm3_3_var1_6'),
            createCurriculumBlock('LOOP_END', undefined, undefined, 'm3_3_var1_7'),
          ],
          F1: [],
          F2: [],
          F3: [],
        },
      },
      {
        id: '3.3-eight-star',
        title: '8-Pointed Star',
        icon: '✴️',
        workspace: {
          MAIN: [
            createCurriculumBlock(
              'SET_PEN_COLOR',
              undefined,
              { color: '#06b6d4' },
              'm3_3_var2_1'
            ),
            createCurriculumBlock('LOOP_START', 8, undefined, 'm3_3_var2_2'),
            createCurriculumBlock('FORWARD', undefined, { length: 140 }, 'm3_3_var2_3'),
            createCurriculumBlock('TURN_RIGHT', undefined, { angle: 135 }, 'm3_3_var2_4'),
            createCurriculumBlock('LOOP_END', undefined, undefined, 'm3_3_var2_5'),
          ],
          F1: [],
          F2: [],
          F3: [],
        },
      },
      {
        id: '3.3-sun-rays',
        title: 'Spiked Sun Rays',
        icon: '☀️',
        workspace: {
          MAIN: [
            createCurriculumBlock(
              'SET_PEN_COLOR',
              undefined,
              { color: '#ef4444' },
              'm3_3_var3_1'
            ),
            createCurriculumBlock('LOOP_START', 6, undefined, 'm3_3_var3_2'),
            createCurriculumBlock('LOOP_START', 2, undefined, 'm3_3_var3_3'),
            createCurriculumBlock('FORWARD', undefined, { length: 95 }, 'm3_3_var3_4'),
            createCurriculumBlock('BACKWARD', undefined, { length: 95 }, 'm3_3_var3_5'),
            createCurriculumBlock('TURN_RIGHT', undefined, { angle: 30 }, 'm3_3_var3_6'),
            createCurriculumBlock('LOOP_END', undefined, undefined, 'm3_3_var3_7'),
            createCurriculumBlock('LOOP_END', undefined, undefined, 'm3_3_var3_8'),
          ],
          F1: [],
          F2: [],
          F3: [],
        },
      },
    ],
  },
];
