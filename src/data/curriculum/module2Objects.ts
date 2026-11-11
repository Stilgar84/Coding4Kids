import {
  CurriculumActivity,
  CurriculumGridDefinition,
  ExplanationDemoTab,
  createCurriculumBlock,
} from './types';
import { WorkspaceState } from '../../types';

/**
 * Lesson 2.6 — Tab [1] Grid (4×3):
 * Key & Locked Gate:
 * Robot starts at (0,1) facing EAST.
 * Amber Circle Key (●) sits at (1,1); matching Amber Circle Locked Gate (●) guards (2,1);
 * Goal Flag sits at (3,1).
 */
export const LESSON_2_6_TAB_1_GRID: CurriculumGridDefinition = {
  width: 4,
  height: 3,
  robot: { x: 0, y: 1, dir: 'EAST' },
  barriers: [
    { orientation: 'H', x: 0, y: 1 },
    { orientation: 'H', x: 1, y: 1 },
    { orientation: 'H', x: 2, y: 1 },
    { orientation: 'H', x: 3, y: 1 },
    { orientation: 'H', x: 0, y: 2 },
    { orientation: 'H', x: 1, y: 2 },
    { orientation: 'H', x: 2, y: 2 },
    { orientation: 'H', x: 3, y: 2 },
  ],
  lockedGates: [
    {
      id: 'gate_2_6_t1',
      x: 2,
      y: 1,
      shape: 'circle',
      color: 'amber',
      unlocked: false,
    },
  ],
  worldItems: [
    {
      id: 'key_2_6_t1',
      type: 'key',
      x: 1,
      y: 1,
      shape: 'circle',
      color: 'amber',
    },
  ],
  flags: [{ id: 'goal_2_6_tab1', x: 3, y: 1, isGoal: true, order: 1, collected: false }],
};

/**
 * Lesson 2.6 — Tab [2] Grid (4×3):
 * Plank & Water Gap:
 * Robot starts at (0,1) facing EAST.
 * Wooden Plank sits at (1,1); Water Channel blocks (2,1); Goal Flag sits at (3,1).
 */
export const LESSON_2_6_TAB_2_GRID: CurriculumGridDefinition = {
  width: 4,
  height: 3,
  robot: { x: 0, y: 1, dir: 'EAST' },
  barriers: [
    { orientation: 'H', x: 0, y: 1 },
    { orientation: 'H', x: 1, y: 1 },
    { orientation: 'H', x: 2, y: 1 },
    { orientation: 'H', x: 3, y: 1 },
    { orientation: 'H', x: 0, y: 2 },
    { orientation: 'H', x: 1, y: 2 },
    { orientation: 'H', x: 2, y: 2 },
    { orientation: 'H', x: 3, y: 2 },
  ],
  waterCells: [{ x: 2, y: 1 }],
  worldItems: [
    {
      id: 'plank_2_6_t2',
      type: 'plank',
      x: 1,
      y: 1,
    },
  ],
  flags: [{ id: 'goal_2_6_tab2', x: 3, y: 1, isGoal: true, order: 1, collected: false }],
};

/**
 * Lesson 2.6 — Tab [3] Grid (5×3):
 * Crate & Floor Switch (with 1-Slot Backpack Spotlight):
 * Robot starts at (0,1) facing EAST.
 * Crate sits at (1,1); recessed FloorSwitch at (2,1) links to Purple Diamond Gate (◆) at (3,1);
 * Goal Flag sits at (4,1). Dropping the crate onto (2,1) empties the 1-slot backpack and opens the gate.
 */
export const LESSON_2_6_TAB_3_GRID: CurriculumGridDefinition = {
  width: 5,
  height: 3,
  robot: { x: 0, y: 1, dir: 'EAST' },
  barriers: [
    { orientation: 'H', x: 0, y: 1 },
    { orientation: 'H', x: 1, y: 1 },
    { orientation: 'H', x: 2, y: 1 },
    { orientation: 'H', x: 3, y: 1 },
    { orientation: 'H', x: 4, y: 1 },
    { orientation: 'H', x: 0, y: 2 },
    { orientation: 'H', x: 1, y: 2 },
    { orientation: 'H', x: 2, y: 2 },
    { orientation: 'H', x: 3, y: 2 },
    { orientation: 'H', x: 4, y: 2 },
  ],
  floorSwitches: [
    {
      id: 'sw_2_6_t3',
      x: 2,
      y: 1,
      linkedGateId: 'gate_2_6_t3',
      requiredForGoal: false,
    },
  ],
  lockedGates: [
    {
      id: 'gate_2_6_t3',
      x: 3,
      y: 1,
      shape: 'diamond',
      color: 'purple',
      unlocked: false,
      linkedSwitchId: 'sw_2_6_t3',
    },
  ],
  worldItems: [
    {
      id: 'crate_2_6_t3',
      type: 'crate',
      x: 1,
      y: 1,
    },
  ],
  flags: [{ id: 'goal_2_6_tab3', x: 4, y: 1, isGoal: true, order: 1, collected: false }],
};

const LESSON_2_6_TAB_1_WORKSPACE: WorkspaceState = {
  MAIN: [
    createCurriculumBlock('MOVE_FWD', undefined, undefined, 'demo_2_6_t1_1'),
    createCurriculumBlock('PICK_UP', undefined, undefined, 'demo_2_6_t1_2'),
    createCurriculumBlock('USE_DROP', undefined, undefined, 'demo_2_6_t1_3'),
    createCurriculumBlock('MOVE_FWD', undefined, undefined, 'demo_2_6_t1_4'),
    createCurriculumBlock('MOVE_FWD', undefined, undefined, 'demo_2_6_t1_5'),
  ],
  F1: [],
  F2: [],
  F3: [],
};

const LESSON_2_6_TAB_2_WORKSPACE: WorkspaceState = {
  MAIN: [
    createCurriculumBlock('MOVE_FWD', undefined, undefined, 'demo_2_6_t2_1'),
    createCurriculumBlock('PICK_UP', undefined, undefined, 'demo_2_6_t2_2'),
    createCurriculumBlock('USE_DROP', undefined, undefined, 'demo_2_6_t2_3'),
    createCurriculumBlock('MOVE_FWD', undefined, undefined, 'demo_2_6_t2_4'),
    createCurriculumBlock('MOVE_FWD', undefined, undefined, 'demo_2_6_t2_5'),
  ],
  F1: [],
  F2: [],
  F3: [],
};

const LESSON_2_6_TAB_3_WORKSPACE: WorkspaceState = {
  MAIN: [
    createCurriculumBlock('MOVE_FWD', undefined, undefined, 'demo_2_6_t3_1'),
    createCurriculumBlock('PICK_UP', undefined, undefined, 'demo_2_6_t3_2'),
    createCurriculumBlock('MOVE_FWD', undefined, undefined, 'demo_2_6_t3_3'),
    createCurriculumBlock('USE_DROP', undefined, undefined, 'demo_2_6_t3_4'),
    createCurriculumBlock('MOVE_FWD', 2, undefined, 'demo_2_6_t3_5'),
  ],
  F1: [],
  F2: [],
  F3: [],
};

export const LESSON_2_6_DEMO_TABS: ExplanationDemoTab[] = [
  {
    id: '2.6-tab-1',
    label: '1',
    icon: '🔑',
    title: 'Key & Locked Gate',
    gridState: LESSON_2_6_TAB_1_GRID,
    workspace: LESSON_2_6_TAB_1_WORKSPACE,
    spotlights: ['execution-order', 'world-item', 'backpack'],
  },
  {
    id: '2.6-tab-2',
    label: '2',
    icon: '🪵',
    title: 'Plank & Water Gap',
    gridState: LESSON_2_6_TAB_2_GRID,
    workspace: LESSON_2_6_TAB_2_WORKSPACE,
    spotlights: ['execution-order', 'world-item', 'backpack'],
  },
  {
    id: '2.6-tab-3',
    label: '3',
    icon: '📦',
    title: 'Crate & Floor Switch',
    gridState: LESSON_2_6_TAB_3_GRID,
    workspace: LESSON_2_6_TAB_3_WORKSPACE,
    spotlights: ['execution-order', 'world-item', 'backpack'],
  },
];

/**
 * Lesson 2.7 Grid (5×5):
 * Sealed perimeter U-corridor:
 * Robot starts at (0,4) facing NORTH -> walks ×4 to Emerald Triangle Key (▲) at (0,0),
 * carries it ×4 East to (4,0), turns South to unlock the Emerald Triangle Gate (▲) at (4,1),
 * and walks ×4 South to Goal at (4,4).
 */
export const LESSON_2_7_GRID: CurriculumGridDefinition = {
  width: 5,
  height: 5,
  robot: { x: 0, y: 4, dir: 'NORTH' },
  barriers: [
    // West inner wall separating col 0 from col 1 (y = 1..4)
    { orientation: 'V', x: 1, y: 1 },
    { orientation: 'V', x: 1, y: 2 },
    { orientation: 'V', x: 1, y: 3 },
    { orientation: 'V', x: 1, y: 4 },
    // North inner wall separating row 0 from row 1 (x = 1..3)
    { orientation: 'H', x: 1, y: 1 },
    { orientation: 'H', x: 2, y: 1 },
    { orientation: 'H', x: 3, y: 1 },
    // East inner wall separating col 3 from col 4 (y = 1..4)
    { orientation: 'V', x: 4, y: 1 },
    { orientation: 'V', x: 4, y: 2 },
    { orientation: 'V', x: 4, y: 3 },
    { orientation: 'V', x: 4, y: 4 },
  ],
  lockedGates: [
    {
      id: 'gate_2_7',
      x: 4,
      y: 1,
      shape: 'triangle',
      color: 'emerald',
      unlocked: false,
    },
  ],
  worldItems: [
    {
      id: 'key_2_7',
      type: 'key',
      x: 0,
      y: 0,
      shape: 'triangle',
      color: 'emerald',
    },
  ],
  flags: [{ id: 'goal_2_7', x: 4, y: 4, isGoal: true, order: 1, collected: false }],
};

/**
 * Capstone 2A Grid (6×5) — "The Supply Courier":
 * Sealed perimeter route combining a Purple Diamond Key + Gate (◆) AND a Wooden Plank + Water Gap,
 * respecting the 1-slot backpack limit:
 * (0,4,NORTH) -> ×4 to Key ◆ at (0,0) -> Pick Up -> Turn Right -> Use/Drop on Gate ◆ at (1,0)
 * -> ×5 East to Plank at (5,0) -> Pick Up -> Turn Right -> Use/Drop on Water at (5,1) -> ×4 South to Goal at (5,4).
 */
export const CAPSTONE_2A_GRID: CurriculumGridDefinition = {
  width: 6,
  height: 5,
  robot: { x: 0, y: 4, dir: 'NORTH' },
  barriers: [
    // West inner wall separating col 0 from col 1 (y = 1..4)
    { orientation: 'V', x: 1, y: 1 },
    { orientation: 'V', x: 1, y: 2 },
    { orientation: 'V', x: 1, y: 3 },
    { orientation: 'V', x: 1, y: 4 },
    // North inner wall separating row 0 from row 1 (x = 1..4)
    { orientation: 'H', x: 1, y: 1 },
    { orientation: 'H', x: 2, y: 1 },
    { orientation: 'H', x: 3, y: 1 },
    { orientation: 'H', x: 4, y: 1 },
    // East inner wall separating col 4 from col 5 (y = 1..4)
    { orientation: 'V', x: 5, y: 1 },
    { orientation: 'V', x: 5, y: 2 },
    { orientation: 'V', x: 5, y: 3 },
    { orientation: 'V', x: 5, y: 4 },
  ],
  waterCells: [{ x: 5, y: 1 }],
  lockedGates: [
    {
      id: 'gate_2A',
      x: 1,
      y: 0,
      shape: 'diamond',
      color: 'purple',
      unlocked: false,
    },
  ],
  worldItems: [
    {
      id: 'key_2A',
      type: 'key',
      x: 0,
      y: 0,
      shape: 'diamond',
      color: 'purple',
    },
    {
      id: 'plank_2A',
      type: 'plank',
      x: 5,
      y: 0,
    },
  ],
  flags: [{ id: 'goal_2A', x: 5, y: 4, isGoal: true, order: 1, collected: false }],
};

/**
 * Commit 15 (Wave 4): Module 2 Interactive Object Lessons (2.6, 2.7) & Capstone 2A ("The Supply Courier").
 */
export const MODULE_2_OBJECTS_ACTIVITIES: CurriculumActivity[] = [
  {
    id: '2.6',
    moduleId: 'module-2',
    version: 1,
    format: 'explanation',
    simId: 'grid',
    icon: '📖',
    title: 'Interactive World Items (Pick Up & Use/Drop)',
    concept: 'Stateful World Interaction & 1-Slot Backpack',
    description:
      'Explore three interactive examples showing how Pick Up stores one item in the robot’s backpack and Use/Drop unlocks a matching gate ahead, bridges water ahead, or places a crate onto a floor switch.',
    hint: 'Step or Play through Demo [1], Demo [2], and Demo [3], then tap Continue (→).',
    palette: {
      allowedSimBlocks: [
        'MOVE_FWD',
        'MOVE_BACK',
        'TURN_LEFT',
        'TURN_RIGHT',
        'PICK_UP',
        'USE_DROP',
      ],
      allowedControlBlocks: [],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: false,
      allowVariables: false,
    },
    grid: LESSON_2_6_TAB_1_GRID,
    starterWorkspace: {
      MAIN: LESSON_2_6_TAB_1_WORKSPACE.MAIN.map((b) => ({ ...b })),
      F1: [],
      F2: [],
      F3: [],
    },
    demoTabs: LESSON_2_6_DEMO_TABS,
  },
  {
    id: '2.7',
    moduleId: 'module-2',
    version: 1,
    format: 'puzzle',
    simId: 'grid',
    icon: '🤖',
    title: 'Fetching, Carrying & Using Objects',
    concept: 'Fetching, Carrying & Contextual Object Use (Pick Up, Use/Drop & ×N)',
    description:
      'Combine ×N repeat badges with Pick Up and Use/Drop to fetch the emerald triangle key (▲), carry it across the north hall in your backpack, unlock the matching gate, and reach the goal.',
    hint: 'Walk ×4 North to grab the ▲ key, carry it ×4 East, turn South to face the ▲ gate, Use/Drop the key, and walk ×4 to the goal.',
    palette: {
      allowedSimBlocks: [
        'MOVE_FWD',
        'MOVE_BACK',
        'TURN_LEFT',
        'TURN_RIGHT',
        'PICK_UP',
        'USE_DROP',
      ],
      allowedControlBlocks: [],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: false,
      allowVariables: false,
    },
    slotCap: {
      maxTotal: 8,
    },
    grid: LESSON_2_7_GRID,
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: {
        MAIN: [
          createCurriculumBlock('MOVE_FWD', 4, undefined, 'scaf_2_7'),
          { id: 'scaf_2_7_ph_pickup', type: 'PLACEHOLDER', params: { hintCategory: 'item' } },
          createCurriculumBlock('TURN_RIGHT', undefined, undefined, 'scaf_2_7'),
          createCurriculumBlock('MOVE_FWD', 4, undefined, 'scaf_2_7'),
          createCurriculumBlock('TURN_RIGHT', undefined, undefined, 'scaf_2_7'),
          { id: 'scaf_2_7_ph_use', type: 'PLACEHOLDER', params: { hintCategory: 'item' } },
          { id: 'scaf_2_7_ph_finish', type: 'PLACEHOLDER', params: { hintCategory: 'motion' } },
        ],
        F1: [],
        F2: [],
        F3: [],
      },
    },
    referenceSolution: {
      MAIN: [
        createCurriculumBlock('MOVE_FWD', 4, undefined, 'ref_2_7'),
        createCurriculumBlock('PICK_UP', undefined, undefined, 'ref_2_7'),
        createCurriculumBlock('TURN_RIGHT', undefined, undefined, 'ref_2_7'),
        createCurriculumBlock('MOVE_FWD', 4, undefined, 'ref_2_7'),
        createCurriculumBlock('TURN_RIGHT', undefined, undefined, 'ref_2_7'),
        createCurriculumBlock('USE_DROP', undefined, undefined, 'ref_2_7'),
        createCurriculumBlock('MOVE_FWD', 4, undefined, 'ref_2_7'),
      ],
      F1: [],
      F2: [],
      F3: [],
    },
    antiBypassRules: [
      {
        id: '2.7-require-world-interaction',
        description: 'Cannot reach goal past locked gate without PICK_UP and USE_DROP',
        forbidBlocks: ['PICK_UP', 'USE_DROP'],
      },
      {
        id: '2.7-require-repeat-badges',
        description: 'Cannot fit inside the 8-slot tray without ×N repeat badges',
        allowRepeatBadges: false,
      },
    ],
  },
  {
    id: '2A',
    moduleId: 'module-2',
    version: 1,
    format: 'capstone',
    capstoneType: 'puzzle',
    simId: 'grid',
    icon: '🏆',
    title: 'The Supply Courier',
    concept: 'Sequential 1-Slot Inventory Management (Key + Gate, Plank + Water & ×N)',
    description:
      'The robot’s backpack holds one item at a time. Fetch and use the purple diamond key (◆) to unlock the gate first, then fetch the wooden plank to bridge the water channel and reach the goal within 10 slots.',
    hint: 'Fetch and use the ◆ key at the top-left gate first so your 1-slot backpack is empty when you reach the wooden plank at the top-right corner.',
    palette: {
      allowedSimBlocks: [
        'MOVE_FWD',
        'MOVE_BACK',
        'TURN_LEFT',
        'TURN_RIGHT',
        'PICK_UP',
        'USE_DROP',
      ],
      allowedControlBlocks: [],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: false,
      allowVariables: false,
    },
    slotCap: {
      maxTotal: 10,
    },
    grid: CAPSTONE_2A_GRID,
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: {
        MAIN: [
          createCurriculumBlock('MOVE_FWD', 4, undefined, 'scaf_2A'),
          createCurriculumBlock('PICK_UP', undefined, undefined, 'scaf_2A'),
          createCurriculumBlock('TURN_RIGHT', undefined, undefined, 'scaf_2A'),
          { id: 'scaf_2A_ph_unlock', type: 'PLACEHOLDER', params: { hintCategory: 'item' } },
          createCurriculumBlock('MOVE_FWD', 5, undefined, 'scaf_2A'),
          { id: 'scaf_2A_ph_plank', type: 'PLACEHOLDER', params: { hintCategory: 'item' } },
          createCurriculumBlock('TURN_RIGHT', undefined, undefined, 'scaf_2A'),
          { id: 'scaf_2A_ph_bridge', type: 'PLACEHOLDER', params: { hintCategory: 'item' } },
          { id: 'scaf_2A_ph_goal', type: 'PLACEHOLDER', params: { hintCategory: 'motion' } },
        ],
        F1: [],
        F2: [],
        F3: [],
      },
    },
    referenceSolution: {
      MAIN: [
        createCurriculumBlock('MOVE_FWD', 4, undefined, 'ref_2A'),
        createCurriculumBlock('PICK_UP', undefined, undefined, 'ref_2A'),
        createCurriculumBlock('TURN_RIGHT', undefined, undefined, 'ref_2A'),
        createCurriculumBlock('USE_DROP', undefined, undefined, 'ref_2A'),
        createCurriculumBlock('MOVE_FWD', 5, undefined, 'ref_2A'),
        createCurriculumBlock('PICK_UP', undefined, undefined, 'ref_2A'),
        createCurriculumBlock('TURN_RIGHT', undefined, undefined, 'ref_2A'),
        createCurriculumBlock('USE_DROP', undefined, undefined, 'ref_2A'),
        createCurriculumBlock('MOVE_FWD', 4, undefined, 'ref_2A'),
      ],
      F1: [],
      F2: [],
      F3: [],
    },
    antiBypassRules: [
      {
        id: '2A-require-world-interaction',
        description: 'Cannot solve The Supply Courier without PICK_UP and USE_DROP',
        forbidBlocks: ['PICK_UP', 'USE_DROP'],
      },
      {
        id: '2A-require-both-key-and-plank',
        description:
          'Cannot skip either the Key+Gate or the Plank+Water (requires >= 2 USE_DROP executions)',
        maxActionExecutions: { USE_DROP: 1 },
      },
      {
        id: '2A-require-repeat-badges',
        description: 'Cannot fit inside the 10-slot tray without ×N repeat badges',
        allowRepeatBadges: false,
      },
    ],
  },
];
