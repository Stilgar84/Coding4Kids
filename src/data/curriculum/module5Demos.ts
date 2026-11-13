import { WorkspaceState } from '../../types';
import {
  CurriculumActivity,
  CurriculumGridDefinition,
  CurriculumSwitchyardDefinition,
  ExplanationDemoTab,
  createCurriculumBlock,
} from './types';
import { createInitialDepotState } from '../../simulations/depot/depotPhysics';
import { DepotState } from '../../simulations/depot/types';

interface BlockSpec {
  type: string;
  repeatCount?: number;
  params?: Record<string, unknown>;
}

function buildMainScopeWorkspace(specs: BlockSpec[], idPrefix: string): WorkspaceState {
  return {
    MAIN: specs.map((s, idx) =>
      createCurriculumBlock(
        s.type,
        s.repeatCount,
        s.params ? { ...s.params } : undefined,
        `${idPrefix}_${idx + 1}`
      )
    ),
    F1: [],
    F2: [],
    F3: [],
  };
}

// =============================================================================
// 5.0 [📖 🤖 Explanation Demo]: Sensors, If, and Multi-Map Runs
// =============================================================================

export const LESSON_5_0_GRID_VAR1: CurriculumGridDefinition = {
  label: 'Corridor 1 (Item at 2)',
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
  flags: [{ id: 'goal_5_0_v1', x: 4, y: 1, isGoal: true, order: 1, collected: false }],
  worldItems: [{ id: 'item_5_0_v1', type: 'crate', x: 2, y: 1 }],
  requireAllItemsCollected: true,
};

export const LESSON_5_0_GRID_VAR2: CurriculumGridDefinition = {
  label: 'Corridor 2 (Item at 3)',
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
  flags: [{ id: 'goal_5_0_v2', x: 4, y: 1, isGoal: true, order: 1, collected: false }],
  worldItems: [{ id: 'item_5_0_v2', type: 'crate', x: 3, y: 1 }],
  requireAllItemsCollected: true,
};

export const LESSON_5_0_GRID_VAR3: CurriculumGridDefinition = {
  label: 'Corridor 3 (Item at 1)',
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
  flags: [{ id: 'goal_5_0_v3', x: 4, y: 1, isGoal: true, order: 1, collected: false }],
  worldItems: [{ id: 'item_5_0_v3', type: 'crate', x: 1, y: 1 }],
  requireAllItemsCollected: true,
};

const LESSON_5_0_TAB1_WORKSPACE = buildMainScopeWorkspace(
  [
    { type: 'MOVE_FWD' },
    { type: 'MOVE_FWD' },
    { type: 'PICK_UP' },
    { type: 'MOVE_FWD' },
    { type: 'MOVE_FWD' },
  ],
  'm5_0_t1'
);

const LESSON_5_0_TAB2_WORKSPACE = buildMainScopeWorkspace(
  [
    { type: 'LOOP_START', repeatCount: 4 },
    { type: 'MOVE_FWD' },
    { type: 'IF', params: { condition: { kind: 'sensor', sensor: 'itemHere' } } },
    { type: 'PICK_UP' },
    { type: 'END_IF' },
    { type: 'LOOP_END' },
  ],
  'm5_0_t2'
);

export const LESSON_5_0_DEMO_TABS: ExplanationDemoTab[] = [
  {
    id: '5.0-tab-1',
    label: '1',
    icon: '❌',
    title: 'Fixed Pick Up Fails Across Maps',
    gridState: LESSON_5_0_GRID_VAR1,
    workspace: LESSON_5_0_TAB1_WORKSPACE,
    spotlights: ['sensor-beam', 'execution-order'],
  },
  {
    id: '5.0-tab-2',
    label: '2',
    icon: '✨',
    title: 'If (itemHere) Adapts to Any Hallway',
    gridState: LESSON_5_0_GRID_VAR1,
    workspace: LESSON_5_0_TAB2_WORKSPACE,
    spotlights: ['sensor-beam', 'branch-skip'],
  },
];

// =============================================================================
// 5.2 [📖 🚂 Explanation Demo]: Meet the Switchyard (Scanner, Docks & Scrap)
// =============================================================================

export const LESSON_5_2_SWITCHYARD_VAR1: CurriculumSwitchyardDefinition = {
  label: 'Stream 1 (Damaged 1st)',
  incomingStream: [
    { id: 'c1', color: 'blue', icon: 'battery', damaged: true },
    { id: 'c2', color: 'red', icon: 'crate', damaged: false },
  ],
  switches: [{ id: 'A', initialDirection: 'left', leftTarget: 'DOCK_A', rightTarget: 'DOCK_B' }],
  docks: [
    { id: 'DOCK_A', label: 'Dock A', acceptsDamaged: false },
    { id: 'DOCK_B', label: 'Dock B' },
  ],
  scrapChute: { expectedDamagedOnly: true },
};

export const LESSON_5_2_SWITCHYARD_VAR2: CurriculumSwitchyardDefinition = {
  label: 'Stream 2 (Intact 1st)',
  incomingStream: [
    { id: 'c1', color: 'red', icon: 'crate', damaged: false },
    { id: 'c2', color: 'amber', icon: 'crate', damaged: true },
  ],
  switches: [{ id: 'A', initialDirection: 'left', leftTarget: 'DOCK_A', rightTarget: 'DOCK_B' }],
  docks: [
    { id: 'DOCK_A', label: 'Dock A', acceptsDamaged: false },
    { id: 'DOCK_B', label: 'Dock B' },
  ],
  scrapChute: { expectedDamagedOnly: true },
};

export const LESSON_5_2_SWITCHYARD_VAR3: CurriculumSwitchyardDefinition = {
  label: 'Stream 3 (Damaged 1st)',
  incomingStream: [
    { id: 'c1', color: 'emerald', icon: 'gem', damaged: true },
    { id: 'c2', color: 'blue', icon: 'battery', damaged: false },
  ],
  switches: [{ id: 'A', initialDirection: 'left', leftTarget: 'DOCK_A', rightTarget: 'DOCK_B' }],
  docks: [
    { id: 'DOCK_A', label: 'Dock A', acceptsDamaged: false },
    { id: 'DOCK_B', label: 'Dock B' },
  ],
  scrapChute: { expectedDamagedOnly: true },
};

const LESSON_5_2_TAB1_WORKSPACE = buildMainScopeWorkspace(
  [{ type: 'SEND_NEXT' }],
  'm5_2_t1'
);

const LESSON_5_2_TAB2_WORKSPACE = buildMainScopeWorkspace(
  [
    { type: 'IF', params: { condition: { kind: 'sensor', sensor: 'itemDamaged' } } },
    { type: 'SCRAP_ITEM' },
    { type: 'END_IF' },
    { type: 'SEND_NEXT' },
  ],
  'm5_2_t2'
);

export const LESSON_5_2_DEMO_TABS: ExplanationDemoTab[] = [
  {
    id: '5.2-tab-1',
    label: '1',
    icon: '⚠️',
    title: 'No Filter: Damaged Crate Crashes Dock',
    switchyardState: LESSON_5_2_SWITCHYARD_VAR1,
    workspace: LESSON_5_2_TAB1_WORKSPACE,
    spotlights: ['sensor-beam'],
  },
  {
    id: '5.2-tab-2',
    label: '2',
    icon: '🛡️',
    title: 'If (itemDamaged) Scrap Damaged Car',
    switchyardState: LESSON_5_2_SWITCHYARD_VAR1,
    workspace: LESSON_5_2_TAB2_WORKSPACE,
    spotlights: ['sensor-beam', 'branch-skip'],
  },
];

// =============================================================================
// 5.4 [📖 🚂 Explanation Demo]: Two-Way Decisions (If / Else)
// =============================================================================

export const LESSON_5_4_SWITCHYARD_VAR1: CurriculumSwitchyardDefinition = {
  label: 'Stream 1 (Red, Blue)',
  incomingStream: [
    { id: 'c1', color: 'red', icon: 'crate', damaged: false },
    { id: 'c2', color: 'blue', icon: 'battery', damaged: false },
  ],
  switches: [{ id: 'A', initialDirection: 'left', leftTarget: 'DOCK_A', rightTarget: 'DOCK_B' }],
  docks: [
    { id: 'DOCK_A', label: 'Dock A', expectedColor: 'red' },
    { id: 'DOCK_B', label: 'Dock B', expectedColor: 'blue' },
  ],
};

export const LESSON_5_4_SWITCHYARD_VAR2: CurriculumSwitchyardDefinition = {
  label: 'Stream 2 (Blue, Red)',
  incomingStream: [
    { id: 'c1', color: 'blue', icon: 'battery', damaged: false },
    { id: 'c2', color: 'red', icon: 'crate', damaged: false },
  ],
  switches: [{ id: 'A', initialDirection: 'left', leftTarget: 'DOCK_A', rightTarget: 'DOCK_B' }],
  docks: [
    { id: 'DOCK_A', label: 'Dock A', expectedColor: 'red' },
    { id: 'DOCK_B', label: 'Dock B', expectedColor: 'blue' },
  ],
};

export const LESSON_5_4_SWITCHYARD_VAR3: CurriculumSwitchyardDefinition = {
  label: 'Stream 3 (Red, Red)',
  incomingStream: [
    { id: 'c1', color: 'red', icon: 'crate', damaged: false },
    { id: 'c2', color: 'red', icon: 'crate', damaged: false },
  ],
  switches: [{ id: 'A', initialDirection: 'left', leftTarget: 'DOCK_A', rightTarget: 'DOCK_B' }],
  docks: [
    { id: 'DOCK_A', label: 'Dock A', expectedColor: 'red' },
    { id: 'DOCK_B', label: 'Dock B', expectedColor: 'blue' },
  ],
};

const LESSON_5_4_TAB1_WORKSPACE = buildMainScopeWorkspace(
  [
    { type: 'IF', params: { condition: { kind: 'sensor', sensor: 'itemColor', param: 'RED' } } },
    { type: 'SWITCH_LEFT' },
    { type: 'ELSE' },
    { type: 'SWITCH_RIGHT' },
    { type: 'END_IF' },
    { type: 'SEND_NEXT' },
  ],
  'm5_4_t1'
);

const LESSON_5_4_TAB2_WORKSPACE = buildMainScopeWorkspace(
  [
    { type: 'LOOP_START', repeatCount: 2 },
    { type: 'IF', params: { condition: { kind: 'sensor', sensor: 'itemColor', param: 'RED' } } },
    { type: 'SWITCH_LEFT' },
    { type: 'ELSE' },
    { type: 'SWITCH_RIGHT' },
    { type: 'END_IF' },
    { type: 'SEND_NEXT' },
    { type: 'LOOP_END' },
  ],
  'm5_4_t2'
);

export const LESSON_5_4_DEMO_TABS: ExplanationDemoTab[] = [
  {
    id: '5.4-tab-1',
    label: '1',
    icon: '🔴',
    title: 'Red Crate Takes If Branch',
    switchyardState: LESSON_5_4_SWITCHYARD_VAR1,
    workspace: LESSON_5_4_TAB1_WORKSPACE,
    spotlights: ['sensor-beam', 'branch-skip'],
  },
  {
    id: '5.4-tab-2',
    label: '2',
    icon: '🔵',
    title: 'Two-Way If / Else Sorts Both Colors',
    switchyardState: LESSON_5_4_SWITCHYARD_VAR1,
    workspace: LESSON_5_4_TAB2_WORKSPACE,
    spotlights: ['sensor-beam', 'branch-skip'],
  },
];

// =============================================================================
// 5.7 [📖 🤖 Explanation Demo]: While Loops vs. Fixed Repeat Counts
// =============================================================================

export const LESSON_5_7_GRID_SHORT: CurriculumGridDefinition = {
  label: 'Short Hall (2 tiles)',
  width: 3,
  height: 3,
  robot: { x: 0, y: 1, dir: 'EAST' },
  barriers: [
    { orientation: 'H', x: 0, y: 1 },
    { orientation: 'H', x: 1, y: 1 },
    { orientation: 'H', x: 2, y: 1 },
    { orientation: 'H', x: 0, y: 2 },
    { orientation: 'H', x: 1, y: 2 },
    { orientation: 'H', x: 2, y: 2 },
  ],
  flags: [],
};

export const LESSON_5_7_GRID_LONG: CurriculumGridDefinition = {
  label: 'Long Hall (7 tiles)',
  width: 8,
  height: 3,
  robot: { x: 0, y: 1, dir: 'EAST' },
  barriers: [
    { orientation: 'H', x: 0, y: 1 },
    { orientation: 'H', x: 1, y: 1 },
    { orientation: 'H', x: 2, y: 1 },
    { orientation: 'H', x: 3, y: 1 },
    { orientation: 'H', x: 4, y: 1 },
    { orientation: 'H', x: 5, y: 1 },
    { orientation: 'H', x: 6, y: 1 },
    { orientation: 'H', x: 7, y: 1 },
    { orientation: 'H', x: 0, y: 2 },
    { orientation: 'H', x: 1, y: 2 },
    { orientation: 'H', x: 2, y: 2 },
    { orientation: 'H', x: 3, y: 2 },
    { orientation: 'H', x: 4, y: 2 },
    { orientation: 'H', x: 5, y: 2 },
    { orientation: 'H', x: 6, y: 2 },
    { orientation: 'H', x: 7, y: 2 },
  ],
  flags: [{ id: 'goal_5_7_long', x: 7, y: 1, isGoal: true, order: 1, collected: false }],
};

const LESSON_5_7_TAB1_WORKSPACE = buildMainScopeWorkspace(
  [{ type: 'MOVE_FWD', repeatCount: 4 }],
  'm5_7_t1'
);

const LESSON_5_7_TAB2_WORKSPACE = buildMainScopeWorkspace(
  [
    { type: 'WHILE', params: { condition: { kind: 'sensor', sensor: 'pathAhead' } } },
    { type: 'MOVE_FWD' },
    { type: 'END_WHILE' },
  ],
  'm5_7_t2'
);

export const LESSON_5_7_DEMO_TABS: ExplanationDemoTab[] = [
  {
    id: '5.7-tab-1',
    label: '1',
    icon: '⚠️',
    title: 'Fixed Repeat ×4 Crashes Wall',
    gridState: LESSON_5_7_GRID_SHORT,
    workspace: LESSON_5_7_TAB1_WORKSPACE,
    spotlights: ['sensor-beam', 'execution-order'],
  },
  {
    id: '5.7-tab-2',
    label: '2',
    icon: '✨',
    title: 'While (pathAhead) Stops Cleanly at Goal',
    gridState: LESSON_5_7_GRID_SHORT,
    workspace: LESSON_5_7_TAB2_WORKSPACE,
    spotlights: ['sensor-beam', 'branch-skip'],
  },
];

// =============================================================================
// 5.11 [📖 🏗️ Explanation Demo]: FIFO Conveyor Queue + If / Else
// =============================================================================

export const LESSON_5_11_DEPOT_LIFO: DepotState = createInitialDepotState({
  stacks: [['RED', 'BLUE'], [], []],
  queue: [],
  targetStacks: [['RED'], ['BLUE'], []],
  workerStation: 'STACK_1',
});

export const LESSON_5_11_DEPOT_FIFO: DepotState = createInitialDepotState({
  stacks: [[], [], []],
  queue: [{ color: 'RED' }, { color: 'BLUE' }],
  targetStacks: [['RED'], ['BLUE'], []],
  workerStation: 'QUEUE',
});

const LESSON_5_11_TAB1_WORKSPACE = buildMainScopeWorkspace(
  [
    { type: 'DEPOT_GRAB' },
    { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_2' } },
    { type: 'DEPOT_PLACE' },
  ],
  'm5_11_t1'
);

const LESSON_5_11_TAB2_WORKSPACE = buildMainScopeWorkspace(
  [
    { type: 'DEPOT_MOVE_TO', params: { station: 'QUEUE' } },
    { type: 'DEPOT_GRAB' },
    { type: 'IF', params: { condition: { kind: 'sensor', sensor: 'heldColor', param: 'RED' } } },
    { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_1' } },
    { type: 'DEPOT_PLACE' },
    { type: 'ELSE' },
    { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_2' } },
    { type: 'DEPOT_PLACE' },
    { type: 'END_IF' },
    { type: 'DEPOT_MOVE_TO', params: { station: 'QUEUE' } },
    { type: 'DEPOT_GRAB' },
    { type: 'IF', params: { condition: { kind: 'sensor', sensor: 'heldColor', param: 'RED' } } },
    { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_1' } },
    { type: 'DEPOT_PLACE' },
    { type: 'ELSE' },
    { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_2' } },
    { type: 'DEPOT_PLACE' },
    { type: 'END_IF' },
  ],
  'm5_11_t2'
);

export const LESSON_5_11_DEMO_TABS: ExplanationDemoTab[] = [
  {
    id: '5.11-tab-1',
    label: '1',
    icon: '📚',
    title: 'LIFO Stack: Top Crate Exits First',
    depotState: LESSON_5_11_DEPOT_LIFO,
    workspace: LESSON_5_11_TAB1_WORKSPACE,
    spotlights: ['fifo-vs-lifo'],
  },
  {
    id: '5.11-tab-2',
    label: '2',
    icon: '🛤️',
    title: 'FIFO Queue: Front Crate First + If / Else',
    depotState: LESSON_5_11_DEPOT_FIFO,
    workspace: LESSON_5_11_TAB2_WORKSPACE,
    spotlights: ['fifo-vs-lifo', 'sensor-beam', 'branch-skip'],
  },
];

// =============================================================================
// Module 5 Demo Activities
// =============================================================================

export const MODULE_5_DEMO_ACTIVITIES: CurriculumActivity[] = [
  // =========================================================================
  // 5.0 [📖 🤖 Demo]: Sensors, If, and Multi-Map Runs
  // =========================================================================
  {
    id: '5.0',
    moduleId: 'module-5',
    version: 1,
    format: 'explanation',
    simId: 'grid',
    icon: '📖',
    title: 'Sensors, If, and Multi-Map Runs',
    concept: 'Sensors, If Branching & Multi-Map Adaptation',
    description:
      'Discover how sensors let your robot adapt! A fixed sequence that picks up at a single spot fails when items appear in different places across multiple hallways. With an If (itemHere) sensor check, the robot checks every step and picks up the item wherever it appears!',
    hint: 'Step through Demo [1] and [2] to see how If (itemHere) adapts across multiple hallway layouts!',
    palette: {
      allowedSimBlocks: ['MOVE_FWD', 'PICK_UP', 'TURN_LEFT', 'TURN_RIGHT'],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'IF', 'END_IF'],
      allowedSensors: ['itemHere', 'pathAhead'],
      allowRepeatBadges: true,
      allowActionParams: false,
      allowVariables: false,
    },
    grid: LESSON_5_0_GRID_VAR1,
    gridVariants: [LESSON_5_0_GRID_VAR1, LESSON_5_0_GRID_VAR2, LESSON_5_0_GRID_VAR3],
    starterWorkspace: LESSON_5_0_TAB1_WORKSPACE,
    demoTabs: LESSON_5_0_DEMO_TABS,
  },

  // =========================================================================
  // 5.2 [📖 🚂 Demo]: Meet the Switchyard (Scanner, Docks & Scrap Chute)
  // =========================================================================
  {
    id: '5.2',
    moduleId: 'module-5',
    version: 1,
    format: 'explanation',
    simId: 'switchyard',
    icon: '📖',
    title: 'Meet the Switchyard (Scanner, Docks & Scrap)',
    concept: 'Switchyard Environment, Scanner & Single-Branch If Scrapping',
    description:
      'Welcome to the Switchyard! Cargo crates arrive on the incoming belt and enter the scanner. Intact crates route smoothly to the dock, but damaged crates must be diverted to the Scrap chute using If (itemDamaged)!',
    hint: 'Step through Demo [1] and [2] to see how single-branch If (itemDamaged) diverts broken crates to Scrap!',
    palette: {
      allowedSimBlocks: ['SEND_NEXT', 'SCRAP_ITEM', 'SWITCH_LEFT', 'SWITCH_RIGHT'],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'IF', 'END_IF'],
      allowedSensors: ['itemDamaged', 'hasNextItem'],
      allowRepeatBadges: true,
      allowActionParams: false,
      allowVariables: false,
    },
    switchyard: LESSON_5_2_SWITCHYARD_VAR1,
    switchyardVariants: [
      LESSON_5_2_SWITCHYARD_VAR1,
      LESSON_5_2_SWITCHYARD_VAR2,
      LESSON_5_2_SWITCHYARD_VAR3,
    ],
    starterWorkspace: LESSON_5_2_TAB1_WORKSPACE,
    demoTabs: LESSON_5_2_DEMO_TABS,
  },

  // =========================================================================
  // 5.4 [📖 🚂 Demo]: Two-Way Decisions (If / Else)
  // =========================================================================
  {
    id: '5.4',
    moduleId: 'module-5',
    version: 1,
    format: 'explanation',
    simId: 'switchyard',
    icon: '📖',
    title: 'Two-Way Decisions (If / Else)',
    concept: 'Two-Way Branching (If / Else) — Color Routing to Left vs Right Docks',
    description:
      'Watch If / Else route crates in two directions! Red crates take the If branch to Switch Left and skip Else. Blue crates jump straight to Else to Switch Right. Both paths then run Send Next to deliver the cargo to the correct dock!',
    hint: 'Step through Demo [1] and [2] to see how Red triggers Then while Blue jumps directly to Else!',
    palette: {
      allowedSimBlocks: ['SWITCH_LEFT', 'SWITCH_RIGHT', 'SEND_NEXT', 'SCRAP_ITEM'],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'IF', 'ELSE', 'END_IF'],
      allowedSensors: ['itemColor', 'hasNextItem'],
      allowRepeatBadges: true,
      allowActionParams: false,
      allowVariables: false,
    },
    switchyard: LESSON_5_4_SWITCHYARD_VAR1,
    switchyardVariants: [
      LESSON_5_4_SWITCHYARD_VAR1,
      LESSON_5_4_SWITCHYARD_VAR2,
      LESSON_5_4_SWITCHYARD_VAR3,
    ],
    starterWorkspace: LESSON_5_4_TAB1_WORKSPACE,
    demoTabs: LESSON_5_4_DEMO_TABS,
  },

  // =========================================================================
  // 5.7 [📖 🤖 Demo]: While Loops vs. Fixed Repeat Counts
  // =========================================================================
  {
    id: '5.7',
    moduleId: 'module-5',
    version: 1,
    format: 'explanation',
    simId: 'grid',
    icon: '📖',
    title: 'While Loops vs. Fixed Repeat Counts',
    concept: 'Conditional Loops (While) vs Fixed Repeats — Dynamic Stop at Walls',
    description:
      'A fixed Move Forward ×4 crashes into the wall if the hallway is only 2 tiles long, and stops short if the hall is 7 tiles long! But While (pathAhead) checks the path before each step and stops right at the goal in any hallway!',
    hint: 'Step through Demo [1] and [2] to see fixed repeats crash while While (pathAhead) stops safely!',
    palette: {
      allowedSimBlocks: ['MOVE_FWD', 'TURN_LEFT', 'TURN_RIGHT'],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'WHILE', 'END_WHILE'],
      allowedSensors: ['pathAhead', 'atGoal'],
      allowRepeatBadges: true,
      allowActionParams: false,
      allowVariables: false,
    },
    grid: LESSON_5_7_GRID_SHORT,
    gridVariants: [LESSON_5_7_GRID_SHORT, LESSON_5_7_GRID_LONG],
    starterWorkspace: LESSON_5_7_TAB1_WORKSPACE,
    demoTabs: LESSON_5_7_DEMO_TABS,
  },

  // =========================================================================
  // 5.11 [📖 🏗️ Demo]: FIFO Conveyor Queue + If / Else
  // =========================================================================
  {
    id: '5.11',
    moduleId: 'module-5',
    version: 1,
    format: 'explanation',
    simId: 'depot',
    icon: '📖',
    title: 'FIFO Conveyor Queue + If / Else',
    concept: 'FIFO Conveyor Queue vs LIFO Stack — Front-First Retrieval & Color Routing',
    description:
      'Contrast FIFO and LIFO! In a LIFO Stack, the top crate placed last is the first to be retrieved. On the FIFO Queue conveyor belt, crates move forward and exit front-first! The crane grabs each crate from the front of the queue, inspects $heldColor with If / Else, and places Red onto Stack 1 and Blue onto Stack 2.',
    hint: 'Step through Demo [1] to see LIFO top-first exit, and Demo [2] to see FIFO front-first queue routing!',
    palette: {
      allowedSimBlocks: ['DEPOT_MOVE_TO', 'DEPOT_GRAB', 'DEPOT_PLACE', 'DEPOT_SEND_OUT', 'DEPOT_SEND_GATE'],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'IF', 'ELSE', 'END_IF', 'WHILE', 'END_WHILE'],
      allowedSensors: ['stationEmpty', 'hasItem', 'itemDamaged', 'heldColor', '$heldColor', 'topColor', '$topColor'],
      allowedBlockParams: { DEPOT_MOVE_TO: ['STACK_1', 'STACK_2', 'STACK_3', 'QUEUE'] },
      allowRepeatBadges: true,
      allowActionParams: true,
      allowVariables: false,
    },
    depot: LESSON_5_11_DEPOT_FIFO,
    starterWorkspace: LESSON_5_11_TAB1_WORKSPACE,
    demoTabs: LESSON_5_11_DEMO_TABS,
  },
];
