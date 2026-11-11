import {
  CurriculumActivity,
  CurriculumGridDefinition,
  ExplanationDemoTab,
  createCurriculumBlock,
} from './types';
import { WorkspaceState } from '../../types';

/**
 * Lesson 1.0 — Tab [1] Grid (3×3):
 * Sequential execution order corridor: (0,2) NORTH -> (0,1) -> (0,0) -> TURN_RIGHT -> (1,0) Goal.
 */
export const LESSON_1_0_TAB_1_GRID: CurriculumGridDefinition = {
  width: 3,
  height: 3,
  robot: { x: 0, y: 2, dir: 'NORTH' },
  barriers: [
    { orientation: 'V', x: 1, y: 2 },
    { orientation: 'V', x: 1, y: 1 },
    { orientation: 'H', x: 1, y: 1 },
    { orientation: 'V', x: 2, y: 0 },
  ],
  flags: [{ id: 'goal_1_0_tab1', x: 1, y: 0, isGoal: true, order: 1, collected: false }],
};

/**
 * Lesson 1.0 — Tab [2] Grid (3×3):
 * Egocentric Robot Point-of-View corridor:
 * Starts at center (1,1) facing SOUTH (looking at a red wall ahead).
 * Robot's Turn Left rotates SOUTH -> EAST (screen right!), steps to (2,1),
 * then Turn Left rotates EAST -> NORTH, and steps up to Goal at (2,0) —
 * directly contrasting South-facing vs. North-facing robot POV in 4 steps!
 */
export const LESSON_1_0_TAB_2_GRID: CurriculumGridDefinition = {
  width: 3,
  height: 3,
  robot: { x: 1, y: 1, dir: 'SOUTH' },
  barriers: [
    { orientation: 'H', x: 1, y: 1 },
    { orientation: 'V', x: 1, y: 1 },
    { orientation: 'H', x: 1, y: 2 },
    { orientation: 'H', x: 2, y: 2 },
    { orientation: 'V', x: 2, y: 0 },
  ],
  flags: [{ id: 'goal_1_0_tab2', x: 2, y: 0, isGoal: true, order: 1, collected: false }],
};

const LESSON_1_0_TAB_1_WORKSPACE: WorkspaceState = {
  MAIN: [
    createCurriculumBlock('MOVE_FWD', undefined, undefined, 'demo_1_0_t1_1'),
    createCurriculumBlock('MOVE_FWD', undefined, undefined, 'demo_1_0_t1_2'),
    createCurriculumBlock('TURN_RIGHT', undefined, undefined, 'demo_1_0_t1_3'),
    createCurriculumBlock('MOVE_FWD', undefined, undefined, 'demo_1_0_t1_4'),
  ],
  F1: [],
  F2: [],
  F3: [],
};

const LESSON_1_0_TAB_2_WORKSPACE: WorkspaceState = {
  MAIN: [
    createCurriculumBlock('TURN_LEFT', undefined, undefined, 'demo_1_0_t2_1'),
    createCurriculumBlock('MOVE_FWD', undefined, undefined, 'demo_1_0_t2_2'),
    createCurriculumBlock('TURN_LEFT', undefined, undefined, 'demo_1_0_t2_3'),
    createCurriculumBlock('MOVE_FWD', undefined, undefined, 'demo_1_0_t2_4'),
  ],
  F1: [],
  F2: [],
  F3: [],
};

export const LESSON_1_0_DEMO_TABS: ExplanationDemoTab[] = [
  {
    id: '1.0-tab-1',
    label: '1',
    icon: '▶️',
    title: 'Step-by-Step Order',
    gridState: LESSON_1_0_TAB_1_GRID,
    workspace: LESSON_1_0_TAB_1_WORKSPACE,
    spotlights: ['execution-order'],
  },
  {
    id: '1.0-tab-2',
    label: '2',
    icon: '👀',
    title: 'Robot Point-of-View',
    gridState: LESSON_1_0_TAB_2_GRID,
    workspace: LESSON_1_0_TAB_2_WORKSPACE,
    spotlights: ['egocentric-pov', 'execution-order'],
  },
];

/**
 * Module 1 Interactive Explanation Demo (Lesson 1.0).
 */
export const MODULE_1_DEMO_ACTIVITIES: CurriculumActivity[] = [
  {
    id: '1.0',
    moduleId: 'module-1',
    version: 1,
    format: 'explanation',
    simId: 'grid',
    icon: '📖',
    title: 'How Programs Run & Robot Point-of-View',
    concept: 'Sequential Execution & Egocentric Point-of-View',
    description:
      'Watch two short visual demos: (1) blocks run one step at a time from left to right, and (2) Turn Left and Turn Right rotate from where the robot’s own eyes face (South vs. North).',
    hint: 'Press Step or Play on Demo [1] and Demo [2], then tap Continue (→) to start Lesson 1.1.',
    palette: {
      allowedSimBlocks: ['MOVE_FWD', 'TURN_LEFT', 'TURN_RIGHT'],
      allowedControlBlocks: [],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: false,
      allowActionParams: false,
      allowVariables: false,
    },
    grid: LESSON_1_0_TAB_1_GRID,
    starterWorkspace: {
      MAIN: LESSON_1_0_TAB_1_WORKSPACE.MAIN.map((b) => ({ ...b })),
      F1: [],
      F2: [],
      F3: [],
    },
    demoTabs: LESSON_1_0_DEMO_TABS,
  },
];
