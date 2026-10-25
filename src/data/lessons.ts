import { BlockType, CodeBlock, Direction, ScopeType, WallEdge, WorkspaceState } from '../types';

export interface Lesson {
  id: number;
  moduleId: string;
  moduleTitle: string;
  moduleIcon: string;
  title: string;
  concept: string;
  description: string;
  hint: string;
  grid: {
    width: number;
    height: number;
    robot: { x: number; y: number; dir: Direction };
    barriers: WallEdge[];
    flags: { id: string; x: number; y: number; isGoal: boolean; order: number; collected: boolean }[];
  };
  solution: WorkspaceState;
  instructionCount: number;
}

let blockCounter = 0;
export function createBlock(type: BlockType, repeatCount?: number): CodeBlock {
  blockCounter++;
  return {
    id: `sol_${type}_${blockCounter}_${Math.random().toString(36).substring(2, 6)}`,
    type,
    ...(repeatCount !== undefined ? { repeatCount } : {}),
  };
}

export function countInstructions(workspace: WorkspaceState): number {
  return (['MAIN', 'F1', 'F2', 'F3'] as ScopeType[]).reduce(
    (sum, sc) => sum + (workspace[sc]?.length ?? 0),
    0
  );
}

export const LESSONS: Lesson[] = [
  // ==========================================
  // MODULE 1: SEQUENTIAL NAVIGATION (Steps & Turns)
  // ==========================================
  {
    id: 1,
    moduleId: 'sequences',
    moduleTitle: 'Module 1: Basic Sequences',
    moduleIcon: '⬆',
    title: 'First Steps',
    concept: 'Sequential Motion (Move Forward)',
    description: 'Robots execute instructions one by one in exact order. Guide the robot along the straight path to the trophy!',
    hint: 'Add Move Forward blocks to walk straight to the goal.',
    grid: {
      width: 5,
      height: 5,
      robot: { x: 0, y: 2, dir: 'EAST' },
      barriers: [],
      flags: [{ id: 'goal', x: 4, y: 2, isGoal: true, order: 1, collected: false }],
    },
    solution: {
      MAIN: [
        createBlock('MOVE_FWD'),
        createBlock('MOVE_FWD'),
        createBlock('MOVE_FWD'),
        createBlock('MOVE_FWD'),
      ],
      F1: [],
      F2: [],
      F3: [],
    },
    instructionCount: 4,
  },
  {
    id: 2,
    moduleId: 'sequences',
    moduleTitle: 'Module 1: Basic Sequences',
    moduleIcon: '⬆',
    title: 'First Corner',
    concept: 'Turning Right & Sequential Heading',
    description: 'Robots can turn 90° in place! Walk forward, turn right at the corner, and advance to the goal flag.',
    hint: 'Move forward 2 cells, turn right, and move forward 2 more cells.',
    grid: {
      width: 5,
      height: 5,
      robot: { x: 1, y: 1, dir: 'EAST' },
      barriers: [
        { orientation: 'H', x: 1, y: 2 },
        { orientation: 'H', x: 2, y: 2 },
        { orientation: 'V', x: 4, y: 1 },
      ],
      flags: [{ id: 'goal', x: 3, y: 3, isGoal: true, order: 1, collected: false }],
    },
    solution: {
      MAIN: [
        createBlock('MOVE_FWD'),
        createBlock('MOVE_FWD'),
        createBlock('TURN_RIGHT'),
        createBlock('MOVE_FWD'),
        createBlock('MOVE_FWD'),
      ],
      F1: [],
      F2: [],
      F3: [],
    },
    instructionCount: 5,
  },
  {
    id: 3,
    moduleId: 'sequences',
    moduleTitle: 'Module 1: Basic Sequences',
    moduleIcon: '⬆',
    title: 'The Zigzag Corridor',
    concept: 'Combining Left and Right Turns',
    description: 'Weave through tight wall barriers using both left and right turns to reach the goal.',
    hint: 'Move North, turn Right to go East, then turn Left to head North to the goal.',
    grid: {
      width: 5,
      height: 5,
      robot: { x: 0, y: 4, dir: 'NORTH' },
      barriers: [
        { orientation: 'H', x: 0, y: 2 },
        { orientation: 'H', x: 1, y: 2 },
        { orientation: 'V', x: 3, y: 2 },
        { orientation: 'V', x: 3, y: 3 },
      ],
      flags: [
        { id: 'f1', x: 2, y: 2, isGoal: false, order: 1, collected: false },
        { id: 'goal', x: 2, y: 0, isGoal: true, order: 2, collected: false },
      ],
    },
    solution: {
      MAIN: [
        createBlock('MOVE_FWD'),
        createBlock('MOVE_FWD'),
        createBlock('TURN_RIGHT'),
        createBlock('MOVE_FWD'),
        createBlock('MOVE_FWD'),
        createBlock('TURN_LEFT'),
        createBlock('MOVE_FWD'),
        createBlock('MOVE_FWD'),
      ],
      F1: [],
      F2: [],
      F3: [],
    },
    instructionCount: 8,
  },
  {
    id: 4,
    moduleId: 'sequences',
    moduleTitle: 'Module 1: Basic Sequences',
    moduleIcon: '⬆',
    title: 'Checkpoint Dash',
    concept: 'Sequential Checkpoint Collection',
    description: 'Collect intermediate checkpoints in order before arriving at the final victory flag.',
    hint: 'Collect Flag 1, turn towards Flag 2, and then step forward to the checkered goal.',
    grid: {
      width: 5,
      height: 5,
      robot: { x: 0, y: 0, dir: 'EAST' },
      barriers: [
        { orientation: 'H', x: 0, y: 1 },
        { orientation: 'H', x: 1, y: 1 },
        { orientation: 'V', x: 3, y: 0 },
        { orientation: 'V', x: 3, y: 1 },
      ],
      flags: [
        { id: 'f1', x: 2, y: 0, isGoal: false, order: 1, collected: false },
        { id: 'f2', x: 2, y: 2, isGoal: false, order: 2, collected: false },
        { id: 'goal', x: 4, y: 2, isGoal: true, order: 3, collected: false },
      ],
    },
    solution: {
      MAIN: [
        createBlock('MOVE_FWD'),
        createBlock('MOVE_FWD'),
        createBlock('TURN_RIGHT'),
        createBlock('MOVE_FWD'),
        createBlock('MOVE_FWD'),
        createBlock('TURN_LEFT'),
        createBlock('MOVE_FWD'),
        createBlock('MOVE_FWD'),
      ],
      F1: [],
      F2: [],
      F3: [],
    },
    instructionCount: 8,
  },

  // ==========================================
  // MODULE 2: REPEAT BADGES (Number Multipliers)
  // ==========================================
  {
    id: 5,
    moduleId: 'multipliers',
    moduleTitle: 'Module 2: Repeat Badges',
    moduleIcon: '⚡',
    title: 'Highway Sprint',
    concept: 'Number Multipliers (2..9)',
    description: 'Instead of placing 5 separate forward blocks, attach a number badge onto a single block to sprint in one instruction!',
    hint: 'Add a single Move Forward block and tap the number 5 badge.',
    grid: {
      width: 6,
      height: 5,
      robot: { x: 0, y: 2, dir: 'EAST' },
      barriers: [
        { orientation: 'H', x: 0, y: 2 },
        { orientation: 'H', x: 1, y: 2 },
        { orientation: 'H', x: 2, y: 2 },
        { orientation: 'H', x: 3, y: 2 },
        { orientation: 'H', x: 4, y: 2 },
        { orientation: 'H', x: 5, y: 2 },
        { orientation: 'H', x: 0, y: 3 },
        { orientation: 'H', x: 1, y: 3 },
        { orientation: 'H', x: 2, y: 3 },
        { orientation: 'H', x: 3, y: 3 },
        { orientation: 'H', x: 4, y: 3 },
        { orientation: 'H', x: 5, y: 3 },
      ],
      flags: [{ id: 'goal', x: 5, y: 2, isGoal: true, order: 1, collected: false }],
    },
    solution: {
      MAIN: [createBlock('MOVE_FWD', 5)],
      F1: [],
      F2: [],
      F3: [],
    },
    instructionCount: 1,
  },
  {
    id: 6,
    moduleId: 'multipliers',
    moduleTitle: 'Module 2: Repeat Badges',
    moduleIcon: '⚡',
    title: 'The L-Turn Runway',
    concept: 'Multipliers on Perpendicular Stretches',
    description: 'Use number badges on both legs of an L-shaped track to write concise, professional code.',
    hint: 'Sprint 5 steps East, turn Right, then sprint 4 steps South.',
    grid: {
      width: 6,
      height: 6,
      robot: { x: 0, y: 0, dir: 'EAST' },
      barriers: [
        { orientation: 'H', x: 1, y: 1 },
        { orientation: 'H', x: 2, y: 1 },
        { orientation: 'H', x: 3, y: 1 },
        { orientation: 'H', x: 4, y: 1 },
        { orientation: 'V', x: 5, y: 2 },
        { orientation: 'V', x: 5, y: 3 },
        { orientation: 'V', x: 5, y: 4 },
      ],
      flags: [{ id: 'goal', x: 5, y: 4, isGoal: true, order: 1, collected: false }],
    },
    solution: {
      MAIN: [
        createBlock('MOVE_FWD', 5),
        createBlock('TURN_RIGHT'),
        createBlock('MOVE_FWD', 4),
      ],
      F1: [],
      F2: [],
      F3: [],
    },
    instructionCount: 3,
  },
  {
    id: 7,
    moduleId: 'multipliers',
    moduleTitle: 'Module 2: Repeat Badges',
    moduleIcon: '⚡',
    title: 'The U-Turn Express',
    concept: 'Multi-Leg Distances & Checkpoints',
    description: 'Race up one corridor, cross the divider wall, and race down the other corridor to the finish!',
    hint: 'Sprint 3 steps North to Flag 1, turn Right, cross 2 steps, turn Right, and sprint 3 steps South.',
    grid: {
      width: 6,
      height: 6,
      robot: { x: 1, y: 4, dir: 'NORTH' },
      barriers: [
        { orientation: 'V', x: 2, y: 2 },
        { orientation: 'V', x: 2, y: 3 },
        { orientation: 'V', x: 2, y: 4 },
      ],
      flags: [
        { id: 'f1', x: 1, y: 1, isGoal: false, order: 1, collected: false },
        { id: 'goal', x: 3, y: 4, isGoal: true, order: 2, collected: false },
      ],
    },
    solution: {
      MAIN: [
        createBlock('MOVE_FWD', 3),
        createBlock('TURN_RIGHT'),
        createBlock('MOVE_FWD', 2),
        createBlock('TURN_RIGHT'),
        createBlock('MOVE_FWD', 3),
      ],
      F1: [],
      F2: [],
      F3: [],
    },
    instructionCount: 5,
  },
  {
    id: 8,
    moduleId: 'multipliers',
    moduleTitle: 'Module 2: Repeat Badges',
    moduleIcon: '⚡',
    title: 'Gate Slalom',
    concept: 'Efficient Traversal Between Gates',
    description: 'Use distance badges to cleanly navigate between offset wall openings with just 5 instructions.',
    hint: 'Move forward 3, turn Right, move forward 2, turn Left, move forward 3 to the goal.',
    grid: {
      width: 7,
      height: 5,
      robot: { x: 0, y: 1, dir: 'EAST' },
      barriers: [
        { orientation: 'V', x: 4, y: 0 },
        { orientation: 'V', x: 4, y: 1 },
        { orientation: 'V', x: 3, y: 3 },
        { orientation: 'V', x: 3, y: 4 },
      ],
      flags: [{ id: 'goal', x: 6, y: 3, isGoal: true, order: 1, collected: false }],
    },
    solution: {
      MAIN: [
        createBlock('MOVE_FWD', 3),
        createBlock('TURN_RIGHT'),
        createBlock('MOVE_FWD', 2),
        createBlock('TURN_LEFT'),
        createBlock('MOVE_FWD', 3),
      ],
      F1: [],
      F2: [],
      F3: [],
    },
    instructionCount: 5,
  },

  // ==========================================
  // MODULE 3: LOOPS (LOOP_START ... LOOP_END)
  // ==========================================
  {
    id: 9,
    moduleId: 'loops',
    moduleTitle: 'Module 3: Loops',
    moduleIcon: '🔁',
    title: 'The Staircase Climb',
    concept: 'Repeating Multi-Step Patterns',
    description: 'Climbing a staircase requires repeating the exact same pattern: step East, step North. Wrap this pattern inside a loop with repeat badge 3!',
    hint: 'Put [Move Fwd, Turn Left, Move Fwd, Turn Right] inside a Loop with badge 3.',
    grid: {
      width: 6,
      height: 6,
      robot: { x: 0, y: 4, dir: 'EAST' },
      barriers: [
        { orientation: 'H', x: 0, y: 4 },
        { orientation: 'V', x: 1, y: 3 },
        { orientation: 'H', x: 1, y: 3 },
        { orientation: 'V', x: 2, y: 2 },
        { orientation: 'H', x: 2, y: 2 },
        { orientation: 'V', x: 3, y: 1 },
      ],
      flags: [
        { id: 'f1', x: 1, y: 3, isGoal: false, order: 1, collected: false },
        { id: 'f2', x: 2, y: 2, isGoal: false, order: 2, collected: false },
        { id: 'goal', x: 3, y: 1, isGoal: true, order: 3, collected: false },
      ],
    },
    solution: {
      MAIN: [
        createBlock('LOOP_START', 3),
        createBlock('MOVE_FWD'),
        createBlock('TURN_LEFT'),
        createBlock('MOVE_FWD'),
        createBlock('TURN_RIGHT'),
        createBlock('LOOP_END'),
      ],
      F1: [],
      F2: [],
      F3: [],
    },
    instructionCount: 6,
  },
  {
    id: 10,
    moduleId: 'loops',
    moduleTitle: 'Module 3: Loops',
    moduleIcon: '🔁',
    title: 'Square Perimeter Patrol',
    concept: 'Loop with Internal Multipliers',
    description: 'Patrol all 4 sides of a square fortress and collect the corner flags using a 4-iteration loop.',
    hint: 'Loop 4 times: Move Forward with badge 2, then Turn Right.',
    grid: {
      width: 5,
      height: 5,
      robot: { x: 1, y: 1, dir: 'EAST' },
      barriers: [
        { orientation: 'H', x: 2, y: 2 },
        { orientation: 'V', x: 3, y: 2 },
        { orientation: 'H', x: 2, y: 3 },
        { orientation: 'V', x: 2, y: 2 },
      ],
      flags: [
        { id: 'f1', x: 3, y: 1, isGoal: false, order: 1, collected: false },
        { id: 'f2', x: 3, y: 3, isGoal: false, order: 2, collected: false },
        { id: 'f3', x: 1, y: 3, isGoal: false, order: 3, collected: false },
        { id: 'goal', x: 1, y: 1, isGoal: true, order: 4, collected: false },
      ],
    },
    solution: {
      MAIN: [
        createBlock('LOOP_START', 4),
        createBlock('MOVE_FWD', 2),
        createBlock('TURN_RIGHT'),
        createBlock('LOOP_END'),
      ],
      F1: [],
      F2: [],
      F3: [],
    },
    instructionCount: 4,
  },
  {
    id: 11,
    moduleId: 'loops',
    moduleTitle: 'Module 3: Loops',
    moduleIcon: '🔁',
    title: 'Sawtooth Canyon',
    concept: 'Alternating Turns in a Loop',
    description: 'Weave through the teeth of a jagged canyon by repeating a step-down, step-across rhythm.',
    hint: 'Loop 3 times: Move Forward, Turn Right, Move Forward, Turn Left.',
    grid: {
      width: 6,
      height: 5,
      robot: { x: 0, y: 1, dir: 'EAST' },
      barriers: [
        { orientation: 'V', x: 2, y: 1 },
        { orientation: 'H', x: 1, y: 3 },
        { orientation: 'V', x: 3, y: 2 },
        { orientation: 'H', x: 2, y: 4 },
      ],
      flags: [
        { id: 'f1', x: 1, y: 2, isGoal: false, order: 1, collected: false },
        { id: 'f2', x: 2, y: 3, isGoal: false, order: 2, collected: false },
        { id: 'goal', x: 3, y: 4, isGoal: true, order: 3, collected: false },
      ],
    },
    solution: {
      MAIN: [
        createBlock('LOOP_START', 3),
        createBlock('MOVE_FWD'),
        createBlock('TURN_RIGHT'),
        createBlock('MOVE_FWD'),
        createBlock('TURN_LEFT'),
        createBlock('LOOP_END'),
      ],
      F1: [],
      F2: [],
      F3: [],
    },
    instructionCount: 6,
  },
  {
    id: 12,
    moduleId: 'loops',
    moduleTitle: 'Module 3: Loops',
    moduleIcon: '🔁',
    title: 'Island Hopper',
    concept: 'Looping Complex Leaps',
    description: 'Leap across 3 water barriers. Each leap requires moving forward 2 steps, stepping right, and reorienting forward.',
    hint: 'Loop 3 times: Move Forward 2, Turn Right, Move Forward 1, Turn Left.',
    grid: {
      width: 8,
      height: 5,
      robot: { x: 0, y: 0, dir: 'EAST' },
      barriers: [
        { orientation: 'H', x: 0, y: 1 },
        { orientation: 'H', x: 1, y: 1 },
        { orientation: 'H', x: 2, y: 2 },
        { orientation: 'H', x: 3, y: 2 },
        { orientation: 'H', x: 4, y: 3 },
        { orientation: 'H', x: 5, y: 3 },
      ],
      flags: [
        { id: 'f1', x: 2, y: 1, isGoal: false, order: 1, collected: false },
        { id: 'f2', x: 4, y: 2, isGoal: false, order: 2, collected: false },
        { id: 'goal', x: 6, y: 3, isGoal: true, order: 3, collected: false },
      ],
    },
    solution: {
      MAIN: [
        createBlock('LOOP_START', 3),
        createBlock('MOVE_FWD', 2),
        createBlock('TURN_RIGHT'),
        createBlock('MOVE_FWD'),
        createBlock('TURN_LEFT'),
        createBlock('LOOP_END'),
      ],
      F1: [],
      F2: [],
      F3: [],
    },
    instructionCount: 6,
  },

  // ==========================================
  // MODULE 4: FUNCTIONS & SUBROUTINES (F1 & CALL_F1)
  // ==========================================
  {
    id: 13,
    moduleId: 'functions',
    moduleTitle: 'Module 4: Functions & Subroutines',
    moduleIcon: '📞',
    title: 'The Bridge Crossing',
    concept: 'Procedural Abstraction with Function 1',
    description: 'Write a subroutine in Tab 1 to cross a long 3-step bridge. Call Function 1 twice from Main to cross both bridges!',
    hint: 'In Tab 1: place Move Forward with badge 3. In Main: Call 1, Turn Right, Move Forward 2, Turn Right, Call 1.',
    grid: {
      width: 6,
      height: 6,
      robot: { x: 0, y: 1, dir: 'EAST' },
      barriers: [
        { orientation: 'H', x: 0, y: 1 },
        { orientation: 'H', x: 1, y: 1 },
        { orientation: 'H', x: 2, y: 1 },
        { orientation: 'H', x: 0, y: 2 },
        { orientation: 'H', x: 1, y: 2 },
        { orientation: 'H', x: 2, y: 2 },
        { orientation: 'H', x: 0, y: 3 },
        { orientation: 'H', x: 1, y: 3 },
        { orientation: 'H', x: 2, y: 3 },
        { orientation: 'H', x: 0, y: 4 },
        { orientation: 'H', x: 1, y: 4 },
        { orientation: 'H', x: 2, y: 4 },
      ],
      flags: [
        { id: 'f1', x: 3, y: 1, isGoal: false, order: 1, collected: false },
        { id: 'goal', x: 0, y: 3, isGoal: true, order: 2, collected: false },
      ],
    },
    solution: {
      MAIN: [
        createBlock('CALL_F1'),
        createBlock('TURN_RIGHT'),
        createBlock('MOVE_FWD', 2),
        createBlock('TURN_RIGHT'),
        createBlock('CALL_F1'),
      ],
      F1: [createBlock('MOVE_FWD', 3)],
      F2: [],
      F3: [],
    },
    instructionCount: 6,
  },
  {
    id: 14,
    moduleId: 'functions',
    moduleTitle: 'Module 4: Functions & Subroutines',
    moduleIcon: '📞',
    title: 'Two Outpost Towers',
    concept: 'Non-Consecutive Subroutine Reuse (Why Functions != Loops)',
    description: 'You need to visit two separate outposts to collect flags. Because the paths to each outpost involve different turns and distances, you cannot use a simple loop! Write the outpost inspection routine once in F1 and call it at each tower.',
    hint: 'In F1: Turn Left, Move Fwd, Move Back, Turn Right. In Main: walk to Tower 1, Call 1, navigate through the corridor turns to Tower 2, Call 1, then step to Goal.',
    grid: {
      width: 7,
      height: 6,
      robot: { x: 0, y: 1, dir: 'EAST' },
      barriers: [
        { orientation: 'V', x: 2, y: 0 },
        { orientation: 'V', x: 3, y: 0 },
        { orientation: 'V', x: 5, y: 2 },
        { orientation: 'V', x: 6, y: 2 },
      ],
      flags: [
        { id: 'f1', x: 2, y: 0, isGoal: false, order: 1, collected: false },
        { id: 'f2', x: 5, y: 2, isGoal: false, order: 2, collected: false },
        { id: 'goal', x: 5, y: 5, isGoal: true, order: 3, collected: false },
      ],
    },
    solution: {
      MAIN: [
        createBlock('MOVE_FWD', 2),
        createBlock('CALL_F1'),
        createBlock('TURN_RIGHT'),
        createBlock('MOVE_FWD', 2),
        createBlock('TURN_LEFT'),
        createBlock('MOVE_FWD', 3),
        createBlock('CALL_F1'),
        createBlock('TURN_RIGHT'),
        createBlock('MOVE_FWD', 2),
      ],
      F1: [
        createBlock('TURN_LEFT'),
        createBlock('MOVE_FWD'),
        createBlock('MOVE_BACK'),
        createBlock('TURN_RIGHT'),
      ],
      F2: [],
      F3: [],
    },
    instructionCount: 13,
  },
  {
    id: 15,
    moduleId: 'functions',
    moduleTitle: 'Module 4: Functions & Subroutines',
    moduleIcon: '📞',
    title: 'The Alcove Scavenger',
    concept: 'Composite Subroutine (Movement + Search)',
    description: 'Bundle the corridor walk and the room search together! Function 1 steps forward 2 cells, enters the alcove to grab the flag, and backs out. Main becomes an ultra-clean 3-instruction master program!',
    hint: 'F1: Move Fwd [2], Turn Left, Move Fwd, Move Back, Turn Right. Main: Call 1, Call 1, Move Fwd 1.',
    grid: {
      width: 6,
      height: 4,
      robot: { x: 0, y: 2, dir: 'EAST' },
      barriers: [
        { orientation: 'V', x: 2, y: 0 },
        { orientation: 'V', x: 2, y: 1 },
        { orientation: 'V', x: 3, y: 0 },
        { orientation: 'V', x: 3, y: 1 },
        { orientation: 'V', x: 4, y: 0 },
        { orientation: 'V', x: 4, y: 1 },
        { orientation: 'V', x: 5, y: 0 },
        { orientation: 'V', x: 5, y: 1 },
      ],
      flags: [
        { id: 'f1', x: 2, y: 1, isGoal: false, order: 1, collected: false },
        { id: 'f2', x: 4, y: 1, isGoal: false, order: 2, collected: false },
        { id: 'goal', x: 5, y: 2, isGoal: true, order: 3, collected: false },
      ],
    },
    solution: {
      MAIN: [
        createBlock('CALL_F1'),
        createBlock('CALL_F1'),
        createBlock('MOVE_FWD'),
      ],
      F1: [
        createBlock('MOVE_FWD', 2),
        createBlock('TURN_LEFT'),
        createBlock('MOVE_FWD'),
        createBlock('MOVE_BACK'),
        createBlock('TURN_RIGHT'),
      ],
      F2: [],
      F3: [],
    },
    instructionCount: 8,
  },
  {
    id: 16,
    moduleId: 'functions',
    moduleTitle: 'Module 4: Functions & Subroutines',
    moduleIcon: '📞',
    title: 'Wall Bypass Routine',
    concept: 'Non-Consecutive Obstacle Detours',
    description: 'Two identical wall obstacles block corridors in different parts of the map, separated by corner turns. Because the two walls are not consecutive, a loop cannot be used! Define the bypass maneuver once in F1 and reuse it across both corridors.',
    hint: 'F1 detours around a wall: Turn Right, Move Fwd, Turn Left, Move Fwd 2, Turn Left, Move Fwd, Turn Right. Main: Call 1, Turn Right, Move Fwd 2, Turn Left, Call 1, Move Fwd 1.',
    grid: {
      width: 6,
      height: 5,
      robot: { x: 0, y: 1, dir: 'EAST' },
      barriers: [
        { orientation: 'V', x: 1, y: 1 },
        { orientation: 'V', x: 3, y: 3 },
        { orientation: 'H', x: 0, y: 1 },
        { orientation: 'H', x: 2, y: 1 },
      ],
      flags: [{ id: 'goal', x: 5, y: 3, isGoal: true, order: 1, collected: false }],
    },
    solution: {
      MAIN: [
        createBlock('CALL_F1'),
        createBlock('TURN_RIGHT'),
        createBlock('MOVE_FWD', 2),
        createBlock('TURN_LEFT'),
        createBlock('CALL_F1'),
        createBlock('MOVE_FWD'),
      ],
      F1: [
        createBlock('TURN_RIGHT'),
        createBlock('MOVE_FWD'),
        createBlock('TURN_LEFT'),
        createBlock('MOVE_FWD', 2),
        createBlock('TURN_LEFT'),
        createBlock('MOVE_FWD'),
        createBlock('TURN_RIGHT'),
      ],
      F2: [],
      F3: [],
    },
    instructionCount: 13,
  },

  // ==========================================
  // MODULE 5: ADVANCED MASTERY (Loops + Functions + Dual Functions)
  // ==========================================
  {
    id: 17,
    moduleId: 'advanced',
    moduleTitle: 'Module 5: Advanced Synthesis',
    moduleIcon: '⭐',
    title: 'Twin Mountain Peaks',
    concept: 'Subroutine Containing a Loop (Function Encapsulating Iteration)',
    description: 'Functions can contain loops! Define a 3-step staircase ascent loop inside F1. Main calls F1 to scale Peak 1, walks across the mountain ridge, and calls F1 again to conquer Peak 2. Inlining this without F1 would exceed instruction limits!',
    hint: 'Put a 3-iteration climb loop in F1. In Main: Call 1 (scale Peak 1), Turn Right, Move Fwd 2, Turn Left (cross ridge), Call 1 (scale Peak 2).',
    grid: {
      width: 7,
      height: 6,
      robot: { x: 0, y: 5, dir: 'EAST' },
      barriers: [
        { orientation: 'V', x: 2, y: 5 },
        { orientation: 'H', x: 1, y: 3 },
        { orientation: 'V', x: 3, y: 4 },
        { orientation: 'H', x: 2, y: 2 },
        { orientation: 'V', x: 5, y: 4 },
        { orientation: 'H', x: 4, y: 2 },
        { orientation: 'V', x: 6, y: 3 },
        { orientation: 'H', x: 5, y: 1 },
      ],
      flags: [
        { id: 'f1', x: 3, y: 2, isGoal: false, order: 1, collected: false },
        { id: 'goal', x: 6, y: 1, isGoal: true, order: 2, collected: false },
      ],
    },
    solution: {
      MAIN: [
        createBlock('CALL_F1'),
        createBlock('TURN_RIGHT'),
        createBlock('MOVE_FWD', 2),
        createBlock('TURN_LEFT'),
        createBlock('CALL_F1'),
      ],
      F1: [
        createBlock('LOOP_START', 3),
        createBlock('MOVE_FWD'),
        createBlock('TURN_LEFT'),
        createBlock('MOVE_FWD'),
        createBlock('TURN_RIGHT'),
        createBlock('LOOP_END'),
      ],
      F2: [],
      F3: [],
    },
    instructionCount: 11,
  },
  {
    id: 18,
    moduleId: 'advanced',
    moduleTitle: 'Module 5: Advanced Synthesis',
    moduleIcon: '⭐',
    title: 'Dance of Two Functions',
    concept: 'Loop Coordinating Multiple Subroutines (Loop + F1 + F2)',
    description: 'Main runs a loop that coordinates two different functions: F1 performs the upward zigzag ("Zig") and F2 performs the downward zigzag ("Zag"). This structure creates clean, modular, self-documenting code.',
    hint: 'F1: Turn Left, Move Fwd, Turn Right, Move Fwd. F2: Turn Right, Move Fwd, Turn Left, Move Fwd. Main: Loop 2 times calling Call 1 then Call 2.',
    grid: {
      width: 6,
      height: 5,
      robot: { x: 0, y: 2, dir: 'EAST' },
      barriers: [
        { orientation: 'H', x: 1, y: 1 },
        { orientation: 'H', x: 3, y: 1 },
        { orientation: 'H', x: 2, y: 4 },
        { orientation: 'H', x: 4, y: 4 },
      ],
      flags: [
        { id: 'f1', x: 1, y: 1, isGoal: false, order: 1, collected: false },
        { id: 'f2', x: 2, y: 2, isGoal: false, order: 2, collected: false },
        { id: 'f3', x: 3, y: 1, isGoal: false, order: 3, collected: false },
        { id: 'goal', x: 4, y: 2, isGoal: true, order: 4, collected: false },
      ],
    },
    solution: {
      MAIN: [
        createBlock('LOOP_START', 2),
        createBlock('CALL_F1'),
        createBlock('CALL_F2'),
        createBlock('LOOP_END'),
      ],
      F1: [
        createBlock('TURN_LEFT'),
        createBlock('MOVE_FWD'),
        createBlock('TURN_RIGHT'),
        createBlock('MOVE_FWD'),
      ],
      F2: [
        createBlock('TURN_RIGHT'),
        createBlock('MOVE_FWD'),
        createBlock('TURN_LEFT'),
        createBlock('MOVE_FWD'),
      ],
      F3: [],
    },
    instructionCount: 12,
  },
  {
    id: 19,
    moduleId: 'advanced',
    moduleTitle: 'Module 5: Advanced Synthesis',
    moduleIcon: '⭐',
    title: 'The Grand Citadel',
    concept: 'Mastery: Subroutine Used Outside AND Inside Loop',
    description: 'The ultimate synthesis! F1 defines the bastion inspection routine. The robot must call F1 at the entrance gate BEFORE entering the courtyard, and then call F1 repeatedly inside a perimeter loop. Because F1 is needed both before and within the loop, inlining would cause code duplication!',
    hint: 'F1: Turn Right, Move Fwd, Move Back, Turn Left. Main: Call 1 (entrance), then Loop 3 times: Move Fwd 3, Call 1, Turn Right. Finally Move Fwd 3 to the Goal.',
    grid: {
      width: 6,
      height: 6,
      robot: { x: 1, y: 1, dir: 'EAST' },
      barriers: [
        { orientation: 'H', x: 2, y: 2 },
        { orientation: 'H', x: 3, y: 2 },
        { orientation: 'V', x: 4, y: 2 },
        { orientation: 'V', x: 4, y: 3 },
        { orientation: 'H', x: 2, y: 4 },
        { orientation: 'H', x: 3, y: 4 },
        { orientation: 'V', x: 2, y: 2 },
        { orientation: 'V', x: 2, y: 3 },
      ],
      flags: [
        { id: 'f1', x: 1, y: 2, isGoal: false, order: 1, collected: false },
        { id: 'f2', x: 4, y: 2, isGoal: false, order: 2, collected: false },
        { id: 'f3', x: 3, y: 4, isGoal: false, order: 3, collected: false },
        { id: 'f4', x: 1, y: 3, isGoal: false, order: 4, collected: false },
        { id: 'goal', x: 1, y: 1, isGoal: true, order: 5, collected: false },
      ],
    },
    solution: {
      MAIN: [
        createBlock('CALL_F1'),
        createBlock('LOOP_START', 3),
        createBlock('MOVE_FWD', 3),
        createBlock('CALL_F1'),
        createBlock('TURN_RIGHT'),
        createBlock('LOOP_END'),
        createBlock('MOVE_FWD', 3),
      ],
      F1: [
        createBlock('TURN_RIGHT'),
        createBlock('MOVE_FWD'),
        createBlock('MOVE_BACK'),
        createBlock('TURN_LEFT'),
      ],
      F2: [],
      F3: [],
    },
    instructionCount: 11,
  },
];
