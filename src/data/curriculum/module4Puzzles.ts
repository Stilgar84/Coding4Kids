import { WorkspaceState } from '../../types';
import {
  CurriculumActivity,
  CurriculumGridDefinition,
  createCurriculumBlock,
} from './types';
import { createInitialDepotState } from '../../simulations/depot/depotPhysics';
import { MODULE_3_DEPOT_ALLOWED_BLOCKS } from './module3Depot';

// =============================================================================
// Helper: Multi-Scope Workspace Builder
// =============================================================================

interface BlockSpec {
  type: string;
  repeatCount?: number;
  params?: Record<string, unknown>;
}

interface MultiScopeBlockSpecs {
  MAIN: BlockSpec[];
  F1?: BlockSpec[];
  F2?: BlockSpec[];
  F3?: BlockSpec[];
}

function buildMultiScopeWorkspace(
  specs: MultiScopeBlockSpecs,
  idPrefix: string
): WorkspaceState {
  return {
    MAIN: (specs.MAIN || []).map((s, idx) =>
      createCurriculumBlock(
        s.type,
        s.repeatCount,
        s.params ? { ...s.params } : undefined,
        `${idPrefix}_m_${idx + 1}`
      )
    ),
    F1: (specs.F1 || []).map((s, idx) =>
      createCurriculumBlock(
        s.type,
        s.repeatCount,
        s.params ? { ...s.params } : undefined,
        `${idPrefix}_f1_${idx + 1}`
      )
    ),
    F2: (specs.F2 || []).map((s, idx) =>
      createCurriculumBlock(
        s.type,
        s.repeatCount,
        s.params ? { ...s.params } : undefined,
        `${idPrefix}_f2_${idx + 1}`
      )
    ),
    F3: (specs.F3 || []).map((s, idx) =>
      createCurriculumBlock(
        s.type,
        s.repeatCount,
        s.params ? { ...s.params } : undefined,
        `${idPrefix}_f3_${idx + 1}`
      )
    ),
  };
}

// =============================================================================
// 4.1 Grid: Defining & Calling a Helper (F1) (6×5)
// =============================================================================

export const PUZZLE_4_1_GRID: CurriculumGridDefinition = {
  width: 6,
  height: 5,
  robot: { x: 0, y: 3, dir: 'EAST' },
  flags: [{ id: 'goal_4_1', x: 3, y: 0, isGoal: true, order: 1, collected: false }],
  barriers: [
    { orientation: 'V', x: 1, y: 3 },
    { orientation: 'V', x: 2, y: 2 },
    { orientation: 'V', x: 4, y: 1 },
    { orientation: 'H', x: 0, y: 2 },
    { orientation: 'H', x: 1, y: 1 },
    { orientation: 'H', x: 2, y: 1 },
    { orientation: 'H', x: 2, y: 2 },
    { orientation: 'H', x: 3, y: 2 },
  ],
};

// =============================================================================
// 4.4 Grid: Functions + Loops Together (5×5 3-Wing)
// =============================================================================

export const PUZZLE_4_4_GRID: CurriculumGridDefinition = {
  width: 5,
  height: 5,
  robot: { x: 2, y: 2, dir: 'NORTH' },
  flags: [
    { id: 'flag_4_4_1', x: 2, y: 0, isGoal: false, order: 1, collected: false },
    { id: 'flag_4_4_2', x: 4, y: 2, isGoal: false, order: 2, collected: false },
    { id: 'goal_4_4', x: 2, y: 4, isGoal: true, order: 3, collected: false },
  ],
  barriers: [
    { orientation: 'V', x: 2, y: 2 },
    { orientation: 'V', x: 2, y: 0 },
    { orientation: 'V', x: 2, y: 1 },
    { orientation: 'V', x: 3, y: 0 },
    { orientation: 'V', x: 3, y: 1 },
    { orientation: 'V', x: 2, y: 3 },
    { orientation: 'V', x: 2, y: 4 },
    { orientation: 'V', x: 3, y: 3 },
    { orientation: 'V', x: 3, y: 4 },
    { orientation: 'H', x: 3, y: 2 },
    { orientation: 'H', x: 4, y: 2 },
    { orientation: 'H', x: 3, y: 3 },
    { orientation: 'H', x: 4, y: 3 },
  ],
};

// =============================================================================
// 4.5 Grid: Layered Composition (Main -> F1 -> F2) (6×5)
// =============================================================================

export const PUZZLE_4_5_GRID: CurriculumGridDefinition = {
  width: 6,
  height: 5,
  robot: { x: 1, y: 1, dir: 'EAST' },
  flags: [
    { id: 'flag_4_5_1', x: 2, y: 1, isGoal: false, order: 1, collected: false },
    { id: 'goal_4_5', x: 2, y: 3, isGoal: true, order: 2, collected: false },
  ],
  worldItems: [
    { id: 'key_4_5_1', type: 'key', shape: 'circle', color: 'amber', x: 1, y: 1 },
    { id: 'key_4_5_2', type: 'key', shape: 'triangle', color: 'emerald', x: 1, y: 3 },
  ],
  lockedGates: [
    { id: 'gate_4_5_1', shape: 'circle', color: 'amber', x: 2, y: 1, unlocked: false },
    { id: 'gate_4_5_2', shape: 'triangle', color: 'emerald', x: 2, y: 3, unlocked: false },
  ],
  barriers: [
    { orientation: 'V', x: 1, y: 1 },
    { orientation: 'V', x: 1, y: 2 },
    { orientation: 'V', x: 1, y: 3 },
    { orientation: 'V', x: 3, y: 1 },
    { orientation: 'V', x: 3, y: 3 },
    { orientation: 'H', x: 2, y: 1 },
    { orientation: 'H', x: 2, y: 2 },
    { orientation: 'H', x: 2, y: 3 },
    { orientation: 'H', x: 2, y: 4 },
  ],
};

// =============================================================================
// 4.6 Depot State: Double Stack Reversal = Original Order
// =============================================================================

export const PUZZLE_4_6_DEPOT = createInitialDepotState({
  stacks: [['AMBER', 'GREEN', 'BLUE', 'RED'], [], []],
  targetStacks: [[], [], ['AMBER', 'GREEN', 'BLUE', 'RED']],
  workerStation: 'STACK_1',
});

// =============================================================================
// 4A Grid: Modular Station Repair (6×6)
// =============================================================================

export const CAPSTONE_4A_GRID: CurriculumGridDefinition = {
  width: 6,
  height: 6,
  robot: { x: 2, y: 2, dir: 'NORTH' },
  flags: [
    { id: 'flag_4A_1', x: 2, y: 0, isGoal: false, order: 1, collected: false },
    { id: 'flag_4A_2', x: 4, y: 2, isGoal: false, order: 2, collected: false },
    { id: 'flag_4A_3', x: 2, y: 4, isGoal: false, order: 3, collected: false },
    { id: 'goal_4A', x: 0, y: 2, isGoal: true, order: 4, collected: false },
  ],
  worldItems: [
    { id: 'key_4A_1', type: 'key', shape: 'circle', color: 'amber', x: 2, y: 1 },
    { id: 'key_4A_2', type: 'key', shape: 'triangle', color: 'emerald', x: 3, y: 2 },
    { id: 'key_4A_3', type: 'key', shape: 'diamond', color: 'purple', x: 2, y: 3 },
    { id: 'key_4A_4', type: 'key', shape: 'circle', color: 'amber', x: 1, y: 2 },
  ],
  lockedGates: [
    { id: 'gate_4A_1', shape: 'circle', color: 'amber', x: 2, y: 0, unlocked: false },
    { id: 'gate_4A_2', shape: 'triangle', color: 'emerald', x: 4, y: 2, unlocked: false },
    { id: 'gate_4A_3', shape: 'diamond', color: 'purple', x: 2, y: 4, unlocked: false },
    { id: 'gate_4A_4', shape: 'circle', color: 'amber', x: 0, y: 2, unlocked: false },
  ],
  barriers: [
    { orientation: 'V', x: 2, y: 0 },
    { orientation: 'V', x: 2, y: 1 },
    { orientation: 'V', x: 3, y: 0 },
    { orientation: 'V', x: 3, y: 1 },
    { orientation: 'V', x: 2, y: 3 },
    { orientation: 'V', x: 2, y: 4 },
    { orientation: 'V', x: 3, y: 3 },
    { orientation: 'V', x: 3, y: 4 },
    { orientation: 'H', x: 3, y: 2 },
    { orientation: 'H', x: 4, y: 2 },
    { orientation: 'H', x: 3, y: 3 },
    { orientation: 'H', x: 4, y: 3 },
    { orientation: 'H', x: 1, y: 2 },
    { orientation: 'H', x: 0, y: 2 },
    { orientation: 'H', x: 1, y: 3 },
    { orientation: 'H', x: 0, y: 3 },
  ],
};

// =============================================================================
// MODULE_4_PUZZLE_ACTIVITIES
// =============================================================================

export const MODULE_4_PUZZLE_ACTIVITIES: CurriculumActivity[] = [
  // =========================================================================
  // 4.1 [🧩 🤖 Puzzle]: Defining & Calling a Helper (F1)
  // =========================================================================
  {
    id: '4.1',
    moduleId: 'module-4',
    version: 1,
    format: 'puzzle',
    simId: 'grid',
    icon: '🤖',
    title: 'Defining & Calling a Helper (F1)',
    concept: 'Decomposing Repeated Maneuvers into a Named Function (F1)',
    description:
      'The robot must navigate three step-jumps separated by uneven distances. Define the 3-block step maneuver once in F1 and call it from Main to reach the goal within the 9-block total budget!',
    hint: 'Put Turn Left, Move Forward, Turn Right inside F1. In Main, call F1 across the uneven steps to reach the Goal.',
    palette: {
      allowedSimBlocks: ['MOVE_FWD', 'TURN_LEFT', 'TURN_RIGHT'],
      allowedControlBlocks: ['CALL_F1'],
      allowedScopes: ['MAIN', 'F1'],
      allowRepeatBadges: false,
      allowActionParams: false,
      allowVariables: false,
    },
    slotCap: {
      perScope: { MAIN: 6, F1: 4 },
      maxTotal: 9,
    },
    grid: PUZZLE_4_1_GRID,
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: buildMultiScopeWorkspace(
        {
          MAIN: [
            { type: 'CALL_F1' },
            { type: 'MOVE_FWD' },
            { type: 'CALL_F1' },
            { type: 'MOVE_FWD' },
            { type: 'PLACEHOLDER', params: { hintCategory: 'motion' } },
            { type: 'PLACEHOLDER', params: { hintCategory: 'function' } },
          ],
          F1: [
            { type: 'TURN_LEFT' },
            { type: 'MOVE_FWD' },
            { type: 'TURN_RIGHT' },
          ],
        },
        'scaf_4_1'
      ),
    },
    referenceSolution: buildMultiScopeWorkspace(
      {
        MAIN: [
          { type: 'CALL_F1' },
          { type: 'MOVE_FWD' },
          { type: 'CALL_F1' },
          { type: 'MOVE_FWD' },
          { type: 'MOVE_FWD' },
          { type: 'CALL_F1' },
        ],
        F1: [
          { type: 'TURN_LEFT' },
          { type: 'MOVE_FWD' },
          { type: 'TURN_RIGHT' },
        ],
      },
      'ref_4_1'
    ),
    antiBypassRules: [
      {
        id: '4.1-require-f1',
        description: 'Cannot reach goal in MAIN without CALL_F1 within MAIN: 6 slots',
        forbidBlocks: ['CALL_F1'],
      },
    ],
  },

  // =========================================================================
  // 4.4 [🧩 🤖 Puzzle]: Functions + Loops Together
  // =========================================================================
  {
    id: '4.4',
    moduleId: 'module-4',
    version: 1,
    format: 'puzzle',
    simId: 'grid',
    icon: '🤖',
    title: 'Functions + Loops Together',
    concept: 'Combining Loops in Functions with Loops in Main',
    description:
      'Clear all three station wings radiating from the center hub! Place a branch-clearing loop inside F1, and call F1 inside a turning loop in Main within the 8-block tray limit.',
    hint: 'In F1, use Loop ×2 { Move Forward } then Move Backward ×2. In Main, use Loop ×3 { Call F1, Turn Right }.',
    palette: {
      allowedSimBlocks: ['MOVE_FWD', 'MOVE_BACK', 'TURN_LEFT', 'TURN_RIGHT'],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'CALL_F1'],
      allowedScopes: ['MAIN', 'F1'],
      allowRepeatBadges: true,
      allowActionParams: false,
      allowVariables: false,
    },
    slotCap: {
      perScope: { MAIN: 4, F1: 4 },
      maxTotal: 8,
    },
    grid: PUZZLE_4_4_GRID,
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: buildMultiScopeWorkspace(
        {
          MAIN: [
            { type: 'LOOP_START', repeatCount: 3 },
            { type: 'CALL_F1' },
            { type: 'PLACEHOLDER', params: { hintCategory: 'turn' } },
            { type: 'LOOP_END' },
          ],
          F1: [
            { type: 'LOOP_START', repeatCount: 2 },
            { type: 'PLACEHOLDER', params: { hintCategory: 'motion' } },
            { type: 'LOOP_END' },
            { type: 'MOVE_BACK', repeatCount: 2 },
          ],
        },
        'scaf_4_4'
      ),
    },
    referenceSolution: buildMultiScopeWorkspace(
      {
        MAIN: [
          { type: 'LOOP_START', repeatCount: 3 },
          { type: 'CALL_F1' },
          { type: 'TURN_RIGHT' },
          { type: 'LOOP_END' },
        ],
        F1: [
          { type: 'LOOP_START', repeatCount: 2 },
          { type: 'MOVE_FWD' },
          { type: 'LOOP_END' },
          { type: 'MOVE_BACK', repeatCount: 2 },
        ],
      },
      'ref_4_4'
    ),
    antiBypassRules: [
      {
        id: '4.4-require-f1',
        description: 'Cannot clear all 3 wings in MAIN without CALL_F1 within MAIN: 4 slots',
        forbidBlocks: ['CALL_F1'],
      },
      {
        id: '4.4-require-loops-in-main',
        description: 'Cannot solve without loop in MAIN',
        maxLoopNestingDepthPerScope: { MAIN: 0 },
      },
      {
        id: '4.4-require-loops-in-f1',
        description: 'Cannot solve without loop in F1',
        maxLoopNestingDepthPerScope: { F1: 0 },
      },
    ],
  },

  // =========================================================================
  // 4.5 [🧩 🤖 Puzzle]: Layered Composition (Main -> F1 -> F2)
  // =========================================================================
  {
    id: '4.5',
    moduleId: 'module-4',
    version: 1,
    format: 'puzzle',
    simId: 'grid',
    icon: '🤖',
    title: 'Layered Composition (Main -> F1 -> F2)',
    concept: 'Hierarchical Function Calls: Main Calls F1, F1 Calls F2',
    description:
      'Two locked research chambers require key retrieval and gate unlocking. F2 performs the key-unlock sequence, F1 visits each room via F2, and Main coordinates the full run in 10 blocks!',
    hint: 'In F2: Pick Up, Use/Drop, Move Forward. In F1: Call F2, Move Backward, Turn Right. In Main: Call F1, Move Forward ×2, Turn Left, Call F1.',
    palette: {
      allowedSimBlocks: [
        'MOVE_FWD',
        'MOVE_BACK',
        'TURN_LEFT',
        'TURN_RIGHT',
        'PICK_UP',
        'USE_DROP',
      ],
      allowedControlBlocks: ['CALL_F1', 'CALL_F2'],
      allowedScopes: ['MAIN', 'F1', 'F2'],
      allowRepeatBadges: true,
      allowActionParams: false,
      allowVariables: false,
    },
    slotCap: {
      perScope: { MAIN: 4, F1: 4, F2: 3 },
      maxTotal: 10,
    },
    grid: PUZZLE_4_5_GRID,
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: buildMultiScopeWorkspace(
        {
          MAIN: [
            { type: 'CALL_F1' },
            { type: 'MOVE_FWD', repeatCount: 2 },
            { type: 'PLACEHOLDER', params: { hintCategory: 'turn' } },
            { type: 'CALL_F1' },
          ],
          F1: [
            { type: 'CALL_F2' },
            { type: 'MOVE_BACK' },
            { type: 'TURN_RIGHT' },
          ],
          F2: [
            { type: 'PICK_UP' },
            { type: 'USE_DROP' },
            { type: 'MOVE_FWD' },
          ],
        },
        'scaf_4_5'
      ),
    },
    referenceSolution: buildMultiScopeWorkspace(
      {
        MAIN: [
          { type: 'CALL_F1' },
          { type: 'MOVE_FWD', repeatCount: 2 },
          { type: 'TURN_LEFT' },
          { type: 'CALL_F1' },
        ],
        F1: [
          { type: 'CALL_F2' },
          { type: 'MOVE_BACK' },
          { type: 'TURN_RIGHT' },
        ],
        F2: [
          { type: 'PICK_UP' },
          { type: 'USE_DROP' },
          { type: 'MOVE_FWD' },
        ],
      },
      'ref_4_5'
    ),
    antiBypassRules: [
      {
        id: '4.5-require-f1',
        description: 'Cannot solve in MAIN without CALL_F1 within MAIN: 4 slots',
        forbidBlocks: ['CALL_F1'],
      },
      {
        id: '4.5-require-f2',
        description: 'Cannot solve without CALL_F2',
        forbidBlocks: ['CALL_F2'],
      },
    ],
  },

  // =========================================================================
  // 4.6 [🧩 🏗️ Depot Puzzle]: Double Stack Reversal = Original Order
  // =========================================================================
  {
    id: '4.6',
    moduleId: 'module-4',
    version: 1,
    format: 'puzzle',
    simId: 'depot',
    icon: '🏗️',
    title: 'Double Stack Reversal = Original Order',
    concept: 'Reversing a LIFO Stack Twice to Restore Original Bottom-to-Top Order',
    description:
      'Stack 1 holds 4 ordered crates [🟨, 🟩, 🟦, 🟥]. Reversing once flips order; reversing twice restores original order! Define Stack 1 -> Stack 2 transfer in F1 (6 cards), and call F1 before transferring Stack 2 -> Stack 3 in Main (7 cards).',
    hint: 'F1 transfers all 4 crates from Stack 1 onto Stack 2 in a Loop ×4. Main calls F1, then uses Loop ×4 to transfer Stack 2 onto Stack 3.',
    palette: {
      allowedSimBlocks: [...MODULE_3_DEPOT_ALLOWED_BLOCKS],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'CALL_F1'],
      allowedScopes: ['MAIN', 'F1'],
      allowRepeatBadges: true,
      allowActionParams: true,
      allowVariables: false,
    },
    slotCap: {
      perScope: { MAIN: 7, F1: 6 },
      maxTotal: 13,
    },
    depot: PUZZLE_4_6_DEPOT,
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: buildMultiScopeWorkspace(
        {
          MAIN: [
            { type: 'CALL_F1' },
            { type: 'LOOP_START', repeatCount: 4 },
            { type: 'PLACEHOLDER', params: { station: 'STACK_2', hintCategory: 'motion' } },
            { type: 'DEPOT_GRAB' },
            { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_3' } },
            { type: 'PLACEHOLDER', params: { hintCategory: 'item' } },
            { type: 'LOOP_END' },
          ],
          F1: [
            { type: 'LOOP_START', repeatCount: 4 },
            { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_1' } },
            { type: 'DEPOT_GRAB' },
            { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_2' } },
            { type: 'DEPOT_PLACE' },
            { type: 'LOOP_END' },
          ],
        },
        'scaf_4_6'
      ),
    },
    referenceSolution: buildMultiScopeWorkspace(
      {
        MAIN: [
          { type: 'CALL_F1' },
          { type: 'LOOP_START', repeatCount: 4 },
          { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_2' } },
          { type: 'DEPOT_GRAB' },
          { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_3' } },
          { type: 'DEPOT_PLACE' },
          { type: 'LOOP_END' },
        ],
        F1: [
          { type: 'LOOP_START', repeatCount: 4 },
          { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_1' } },
          { type: 'DEPOT_GRAB' },
          { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_2' } },
          { type: 'DEPOT_PLACE' },
          { type: 'LOOP_END' },
        ],
      },
      'ref_4_6'
    ),
    antiBypassRules: [
      {
        id: '4.6-require-f1',
        description: 'Cannot reverse Stack 1 to Stack 2 and Stack 2 to Stack 3 within MAIN: 7 slots without CALL_F1',
        forbidBlocks: ['CALL_F1'],
      },
      {
        id: '4.6-require-loops',
        description: 'Cannot solve without loops in 13 slots',
        maxLoopNestingDepth: 0,
      },
    ],
  },

  // =========================================================================
  // 4A [🏆 🤖 Capstone]: Modular Station Repair
  // =========================================================================
  {
    id: '4A',
    moduleId: 'module-4',
    version: 1,
    format: 'capstone',
    capstoneType: 'puzzle',
    simId: 'grid',
    icon: '🏆',
    title: 'Modular Station Repair',
    concept: 'Full Module 4 Decomposition Capstone across Main, F1, and F2 (5-Slot Trays)',
    description:
      'All four auxiliary generator wings require maintenance! Each tab is capped at a strict 5-slot physical tray. F2 executes key unlock, F1 enters and retreats from the wing, and Main cycles all four wings in a clean 10-block loop!',
    hint: 'In F2: Pick Up, Use/Drop, Move Forward. In F1: Move Forward, Call F2, Move Backward ×2. In Main: Loop ×4 { Call F1, Turn Right }.',
    palette: {
      allowedSimBlocks: [
        'MOVE_FWD',
        'MOVE_BACK',
        'TURN_LEFT',
        'TURN_RIGHT',
        'PICK_UP',
        'USE_DROP',
      ],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'CALL_F1', 'CALL_F2'],
      allowedScopes: ['MAIN', 'F1', 'F2'],
      allowRepeatBadges: true,
      allowActionParams: false,
      allowVariables: false,
    },
    slotCap: {
      perScope: { MAIN: 5, F1: 5, F2: 5 },
      maxTotal: 14,
    },
    grid: CAPSTONE_4A_GRID,
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: buildMultiScopeWorkspace(
        {
          MAIN: [
            { type: 'LOOP_START', repeatCount: 4 },
            { type: 'CALL_F1' },
            { type: 'PLACEHOLDER', params: { hintCategory: 'turn' } },
            { type: 'LOOP_END' },
          ],
          F1: [
            { type: 'MOVE_FWD' },
            { type: 'CALL_F2' },
            { type: 'PLACEHOLDER', params: { hintCategory: 'motion' } },
          ],
          F2: [
            { type: 'PICK_UP' },
            { type: 'PLACEHOLDER', params: { hintCategory: 'item' } },
            { type: 'MOVE_FWD' },
          ],
        },
        'scaf_4A'
      ),
    },
    referenceSolution: buildMultiScopeWorkspace(
      {
        MAIN: [
          { type: 'LOOP_START', repeatCount: 4 },
          { type: 'CALL_F1' },
          { type: 'TURN_RIGHT' },
          { type: 'LOOP_END' },
        ],
        F1: [
          { type: 'MOVE_FWD' },
          { type: 'CALL_F2' },
          { type: 'MOVE_BACK', repeatCount: 2 },
        ],
        F2: [
          { type: 'PICK_UP' },
          { type: 'USE_DROP' },
          { type: 'MOVE_FWD' },
        ],
      },
      'ref_4A'
    ),
    antiBypassRules: [
      {
        id: '4A-require-f1',
        description: 'Cannot solve in MAIN without CALL_F1 within MAIN: 5 slots',
        forbidBlocks: ['CALL_F1'],
      },
      {
        id: '4A-require-f2',
        description: 'Cannot solve without CALL_F2',
        forbidBlocks: ['CALL_F2'],
      },
      {
        id: '4A-require-loops',
        description: 'Cannot solve without loops in MAIN (unrolled 4 wings requires 7 slots > 5)',
        maxLoopNestingDepth: 0,
      },
    ],
  },
];
