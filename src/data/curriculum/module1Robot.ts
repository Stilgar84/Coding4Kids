import { CurriculumActivity, createCurriculumBlock } from './types';

/**
 * Module 1 Robot Grid puzzles.
 * Seeded in Commit 1 with 1.1–1.3 draft fixtures to exercise Curriculum Mode,
 * read-only maps, and Open Copy in Sandbox; expanded to full 1.1–1.5 + 1A in Commit 8b.
 */
export const MODULE_1_ROBOT_ACTIVITIES: CurriculumActivity[] = [
  {
    id: '1.1',
    moduleId: 'module-1',
    version: 1,
    format: 'puzzle',
    simId: 'grid',
    icon: '🤖',
    title: 'Moving Forward & Execution Order',
    concept: 'Sequential Motion (Move Forward)',
    description:
      'Blocks run one after another from left to right. Each Move Forward block moves the robot one cell in the direction its nose is pointing.',
    hint: 'Chain 3 Move Forward blocks to guide the robot down the straight corridor to the goal.',
    palette: {
      allowedSimBlocks: ['MOVE_FWD'],
      allowedControlBlocks: [],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: false,
      allowActionParams: false,
      allowVariables: false,
    },
    slotCap: {
      maxTotal: 4,
    },
    grid: {
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
      flags: [{ id: 'goal_1_1', x: 3, y: 1, isGoal: true, order: 1, collected: false }],
    },
    partialHelp: {
      mode: 'ghost',
      ghostPreview: {
        previewWorkspace: {
          MAIN: [createCurriculumBlock('MOVE_FWD', undefined, undefined, 'ghost_1_1')],
          F1: [],
          F2: [],
          F3: [],
        },
        maxSteps: 1,
      },
    },
    referenceSolution: {
      MAIN: [
        createCurriculumBlock('MOVE_FWD', undefined, undefined, 'ref_1_1'),
        createCurriculumBlock('MOVE_FWD', undefined, undefined, 'ref_1_1'),
        createCurriculumBlock('MOVE_FWD', undefined, undefined, 'ref_1_1'),
      ],
      F1: [],
      F2: [],
      F3: [],
    },
    antiBypassRules: [
      {
        id: '1.1-require-fwd',
        description: 'Cannot reach goal without MOVE_FWD',
        forbidBlocks: ['MOVE_FWD'],
      },
    ],
  },
  {
    id: '1.2',
    moduleId: 'module-1',
    version: 1,
    format: 'puzzle',
    simId: 'grid',
    icon: '🤖',
    title: 'Turning in Place (Egocentric)',
    concept: 'Egocentric Left & Right Turns',
    description:
      'Turns rotate the robot in place from the robot’s own point of view without stepping onto a new cell.',
    hint: 'Step South, turn Left (robot POV) to face East, step across, turn Right to face South, and step to the goal.',
    palette: {
      allowedSimBlocks: ['MOVE_FWD', 'TURN_LEFT', 'TURN_RIGHT'],
      allowedControlBlocks: [],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: false,
      allowActionParams: false,
      allowVariables: false,
    },
    slotCap: {
      maxTotal: 6,
    },
    grid: {
      width: 4,
      height: 4,
      robot: { x: 1, y: 1, dir: 'SOUTH' },
      barriers: [
        { orientation: 'H', x: 1, y: 1 },
        { orientation: 'V', x: 1, y: 1 },
        { orientation: 'V', x: 2, y: 1 },
        { orientation: 'V', x: 1, y: 2 },
        { orientation: 'H', x: 1, y: 3 },
        { orientation: 'H', x: 2, y: 2 },
        { orientation: 'V', x: 3, y: 2 },
        { orientation: 'V', x: 2, y: 3 },
        { orientation: 'V', x: 3, y: 3 },
      ],
      flags: [{ id: 'goal_1_2', x: 2, y: 3, isGoal: true, order: 1, collected: false }],
    },
    partialHelp: {
      mode: 'ghost',
      ghostPreview: {
        previewWorkspace: {
          MAIN: [
            createCurriculumBlock('MOVE_FWD', undefined, undefined, 'ghost_1_2'),
            createCurriculumBlock('TURN_LEFT', undefined, undefined, 'ghost_1_2'),
          ],
          F1: [],
          F2: [],
          F3: [],
        },
        maxSteps: 2,
      },
    },
    referenceSolution: {
      MAIN: [
        createCurriculumBlock('MOVE_FWD', undefined, undefined, 'ref_1_2'),
        createCurriculumBlock('TURN_LEFT', undefined, undefined, 'ref_1_2'),
        createCurriculumBlock('MOVE_FWD', undefined, undefined, 'ref_1_2'),
        createCurriculumBlock('TURN_RIGHT', undefined, undefined, 'ref_1_2'),
        createCurriculumBlock('MOVE_FWD', undefined, undefined, 'ref_1_2'),
      ],
      F1: [],
      F2: [],
      F3: [],
    },
    antiBypassRules: [
      {
        id: '1.2-require-turns',
        description: 'Cannot solve without turning',
        forbidBlocks: ['TURN_LEFT', 'TURN_RIGHT'],
      },
      {
        id: '1.2-require-turn-left',
        description: 'Cannot bypass TURN_LEFT with 3x TURN_RIGHT inside 6-slot tray',
        forbidBlocks: ['TURN_LEFT'],
      },
      {
        id: '1.2-require-turn-right',
        description: 'Cannot bypass TURN_RIGHT with 3x TURN_LEFT inside 6-slot tray',
        forbidBlocks: ['TURN_RIGHT'],
      },
    ],
  },
  {
    id: '1.3',
    moduleId: 'module-1',
    version: 1,
    format: 'puzzle',
    simId: 'grid',
    icon: '🤖',
    title: 'Stepping Backward',
    concept: 'Retreating from Tight Alcoves (Move Back)',
    description:
      'Move Back steps one cell backward while keeping the robot facing the same direction — ideal for tight 1-cell alcoves.',
    hint: 'Step North into the alcove to grab Flag 1, step Backward out of the alcove, turn Right, and walk East to the goal.',
    palette: {
      allowedSimBlocks: ['MOVE_FWD', 'MOVE_BACK', 'TURN_LEFT', 'TURN_RIGHT'],
      allowedControlBlocks: [],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: false,
      allowActionParams: false,
      allowVariables: false,
    },
    slotCap: {
      maxTotal: 5,
    },
    grid: {
      width: 4,
      height: 3,
      robot: { x: 1, y: 1, dir: 'NORTH' },
      barriers: [
        { orientation: 'V', x: 1, y: 0 },
        { orientation: 'V', x: 2, y: 0 },
        { orientation: 'V', x: 1, y: 1 },
        { orientation: 'H', x: 1, y: 2 },
        { orientation: 'H', x: 2, y: 1 },
        { orientation: 'H', x: 2, y: 2 },
        { orientation: 'H', x: 3, y: 1 },
        { orientation: 'H', x: 3, y: 2 },
      ],
      flags: [
        { id: 'f1_1_3', x: 1, y: 0, isGoal: false, order: 1, collected: false },
        { id: 'goal_1_3', x: 3, y: 1, isGoal: true, order: 2, collected: false },
      ],
    },
    partialHelp: {
      mode: 'ghost',
      ghostPreview: {
        previewWorkspace: {
          MAIN: [
            createCurriculumBlock('MOVE_FWD', undefined, undefined, 'ghost_1_3'),
            createCurriculumBlock('MOVE_BACK', undefined, undefined, 'ghost_1_3'),
          ],
          F1: [],
          F2: [],
          F3: [],
        },
        maxSteps: 2,
      },
    },
    referenceSolution: {
      MAIN: [
        createCurriculumBlock('MOVE_FWD', undefined, undefined, 'ref_1_3'),
        createCurriculumBlock('MOVE_BACK', undefined, undefined, 'ref_1_3'),
        createCurriculumBlock('TURN_RIGHT', undefined, undefined, 'ref_1_3'),
        createCurriculumBlock('MOVE_FWD', undefined, undefined, 'ref_1_3'),
        createCurriculumBlock('MOVE_FWD', undefined, undefined, 'ref_1_3'),
      ],
      F1: [],
      F2: [],
      F3: [],
    },
    antiBypassRules: [
      {
        id: '1.3-require-move-back',
        description: 'Turning 180° inside the alcove requires >= 7 blocks, overflowing the 5-slot tray without MOVE_BACK',
        forbidBlocks: ['MOVE_BACK'],
      },
    ],
  },
];
