import { WorkspaceState } from '../../types';
import { createInitialDepotState } from '../../simulations/depot/depotPhysics';
import { DepotState } from '../../simulations/depot/types';
import { CurriculumActivity, createCurriculumBlock } from './types';

export const MODULE_3_DEPOT_ALLOWED_BLOCKS: string[] = [
  'DEPOT_MOVE_TO',
  'DEPOT_GRAB',
  'DEPOT_PLACE',
  'DEPOT_SEND_OUT',
];

interface DepotBlockSpec {
  type: string;
  repeatCount?: number;
  params?: Record<string, unknown>;
}

function buildDepotWorkspace(specs: readonly DepotBlockSpec[], idPrefix: string): WorkspaceState {
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

export const LESSON_3_8_TAB1_DEPOT: DepotState = createInitialDepotState({
  stacks: [['RED', 'BLUE'], [], []],
  targetStacks: [[], ['BLUE', 'RED'], []],
  workerStation: 'STACK_1',
});

export const LESSON_3_8_TAB2_DEPOT: DepotState = createInitialDepotState({
  stacks: [['GREEN', 'RED'], [], []],
  targetOutput: ['RED', 'GREEN'],
  workerStation: 'STACK_1',
});

export const LESSON_3_8_TAB3_DEPOT: DepotState = createInitialDepotState({
  stacks: [['RED', 'BLUE'], [], []],
  targetStacks: [[], ['BLUE', 'RED'], []],
  workerStation: 'STACK_1',
});

export const LESSON_3_9_DEPOT: DepotState = createInitialDepotState({
  stacks: [['RED', 'BLUE'], [], []],
  targetStacks: [[], ['BLUE', 'RED'], []],
  workerStation: 'STACK_1',
});

export const LESSON_3_10_DEPOT: DepotState = createInitialDepotState({
  stacks: [['GREEN', 'RED'], ['AMBER', 'BLUE'], []],
  targetOutput: ['RED', 'BLUE', 'GREEN', 'AMBER'],
  workerStation: 'STACK_1',
});

export const MODULE_3_DEPOT_ACTIVITIES: CurriculumActivity[] = [
  // =========================================================================
  // 3.8 [📖 🏗️ Explanation]: Meet the Crate Depot — Top-Only Stacks
  // =========================================================================
  {
    id: '3.8',
    moduleId: 'module-3',
    version: 1,
    format: 'explanation',
    simId: 'depot',
    icon: '📖',
    title: 'Meet the Crate Depot — Top-Only Stacks',
    concept: 'Last-In First-Out (LIFO) Top-Only Access, 1-Crate Claw & Ordered Output Bay',
    description:
      'The crane claw holds only 1 crate at a time and can grab or place only the top crate of a stack! Moving a 2-crate stack to another bay reverses its order (Last In, First Out).',
    hint: 'Step through Demo [1], [2], and [3] to watch LIFO order reversal, sending crates to OUTPUT ✅, and repeating a stack transfer inside Loop ×2.',
    palette: {
      allowedSimBlocks: [...MODULE_3_DEPOT_ALLOWED_BLOCKS],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END'],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: true,
      allowVariables: false,
    },
    depot: LESSON_3_8_TAB1_DEPOT,
    starterWorkspace: buildDepotWorkspace(
      [
        { type: 'DEPOT_GRAB' },
        { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_2' } },
        { type: 'DEPOT_PLACE' },
        { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_1' } },
        { type: 'DEPOT_GRAB' },
        { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_2' } },
        { type: 'DEPOT_PLACE' },
      ],
      'm3_8_t1'
    ),
    demoTabs: [
      {
        id: '3.8-tab-1',
        label: '1',
        icon: '🏗️',
        title: 'LIFO Stack Transfer',
        depotState: LESSON_3_8_TAB1_DEPOT,
        workspace: buildDepotWorkspace(
          [
            { type: 'DEPOT_GRAB' },
            { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_2' } },
            { type: 'DEPOT_PLACE' },
            { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_1' } },
            { type: 'DEPOT_GRAB' },
            { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_2' } },
            { type: 'DEPOT_PLACE' },
          ],
          'm3_8_t1'
        ),
        spotlights: ['execution-order'],
      },
      {
        id: '3.8-tab-2',
        label: '2',
        icon: '📦',
        title: 'Send Top Crates to OUTPUT ✅',
        depotState: LESSON_3_8_TAB2_DEPOT,
        workspace: buildDepotWorkspace(
          [
            { type: 'DEPOT_GRAB' },
            { type: 'DEPOT_SEND_OUT' },
            { type: 'DEPOT_GRAB' },
            { type: 'DEPOT_SEND_OUT' },
          ],
          'm3_8_t2'
        ),
        spotlights: ['execution-order'],
      },
      {
        id: '3.8-tab-3',
        label: '3',
        icon: '🔁',
        title: 'Compact Transfer with Loop ×2',
        depotState: LESSON_3_8_TAB3_DEPOT,
        workspace: buildDepotWorkspace(
          [
            { type: 'LOOP_START', repeatCount: 2 },
            { type: 'DEPOT_GRAB' },
            { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_2' } },
            { type: 'DEPOT_PLACE' },
            { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_1' } },
            { type: 'LOOP_END' },
          ],
          'm3_8_t3'
        ),
        spotlights: ['loop-counter'],
      },
    ],
  },

  // =========================================================================
  // 3.9 [🧩 🏗️ Puzzle]: Stack Transfer — LIFO Discovery
  // =========================================================================
  {
    id: '3.9',
    moduleId: 'module-3',
    version: 1,
    format: 'puzzle',
    simId: 'depot',
    icon: '🏗️',
    title: 'Stack Transfer — LIFO Discovery',
    concept: 'Using a Loop to Transfer & Reverse a Top-Only LIFO Stack in 6 Slots',
    description:
      'Move both crates from Stack 1 onto Stack 2 to match the ghost outline (Blue on bottom, Red on top) inside the 6-slot tray!',
    hint: 'Inside Loop ×2: Grab the top crate on Stack 1, Move Crane to Stack 2, Place Crate, then Move Crane back to Stack 1.',
    palette: {
      allowedSimBlocks: [...MODULE_3_DEPOT_ALLOWED_BLOCKS],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END'],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: true,
      allowVariables: false,
    },
    slotCap: {
      maxTotal: 6,
    },
    depot: LESSON_3_9_DEPOT,
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: buildDepotWorkspace(
        [
          { type: 'LOOP_START', repeatCount: 2 },
          { type: 'DEPOT_GRAB' },
          { type: 'PLACEHOLDER', params: { hintCategory: 'motion' } },
          { type: 'PLACEHOLDER', params: { hintCategory: 'item' } },
          { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_1' } },
          { type: 'LOOP_END' },
        ],
        'scaf_3_9'
      ),
    },
    referenceSolution: buildDepotWorkspace(
      [
        { type: 'LOOP_START', repeatCount: 2 },
        { type: 'DEPOT_GRAB' },
        { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_2' } },
        { type: 'DEPOT_PLACE' },
        { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_1' } },
        { type: 'LOOP_END' },
      ],
      'ref_3_9'
    ),
    antiBypassRules: [
      {
        id: '3.9-require-loop',
        description:
          'Cannot transfer both crates from Stack 1 to Stack 2 within 6 slots without a loop (unrolled requires 7 blocks)',
        maxLoopNestingDepth: 0,
      },
    ],
  },

  // =========================================================================
  // 3.10 [🧩 🏗️ Puzzle]: Alternating Stack Unpack
  // =========================================================================
  {
    id: '3.10',
    moduleId: 'module-3',
    version: 1,
    format: 'puzzle',
    simId: 'depot',
    icon: '🏗️',
    title: 'Alternating Stack Unpack',
    concept: 'Coordinating Two Stacks & Ordered LIFO Output Delivery with a Loop',
    description:
      'Deliver crates to OUTPUT ✅ in exact GOAL order: Red → Blue → Green → Amber. Pull one crate from Stack 1, move to Stack 2 for the next, and loop back to Stack 1 inside the 8-slot tray!',
    hint: 'Inside Loop ×2: Grab + Send Out from Stack 1, Move Crane to Stack 2, Grab + Send Out, then Move Crane back to Stack 1.',
    palette: {
      allowedSimBlocks: [...MODULE_3_DEPOT_ALLOWED_BLOCKS],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END'],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: true,
      allowVariables: false,
    },
    slotCap: {
      maxTotal: 8,
    },
    depot: LESSON_3_10_DEPOT,
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: buildDepotWorkspace(
        [
          { type: 'LOOP_START', repeatCount: 2 },
          { type: 'PLACEHOLDER', params: { hintCategory: 'item' } },
          { type: 'DEPOT_SEND_OUT' },
          { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_2' } },
          { type: 'DEPOT_GRAB' },
          { type: 'PLACEHOLDER', params: { hintCategory: 'item' } },
          { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_1' } },
          { type: 'LOOP_END' },
        ],
        'scaf_3_10'
      ),
    },
    referenceSolution: buildDepotWorkspace(
      [
        { type: 'LOOP_START', repeatCount: 2 },
        { type: 'DEPOT_GRAB' },
        { type: 'DEPOT_SEND_OUT' },
        { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_2' } },
        { type: 'DEPOT_GRAB' },
        { type: 'DEPOT_SEND_OUT' },
        { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_1' } },
        { type: 'LOOP_END' },
      ],
      'ref_3_10'
    ),
    antiBypassRules: [
      {
        id: '3.10-require-loop',
        description:
          'Cannot unpack 4 alternating crates from Stack 1 and Stack 2 into OUTPUT within 8 slots without a loop (unrolled requires 11 blocks)',
        maxLoopNestingDepth: 0,
      },
    ],
  },
];
