import { toVariableName, VariableName, WorkspaceState } from '../../types';

const v = (name: string): VariableName => toVariableName(name);
import {
  CurriculumActivity,
  CurriculumGridDefinition,
  CreativeVariationCard,
  ExplanationDemoTab,
  createCurriculumBlock,
} from './types';

export const MODULE_6_TURTLE_ALLOWED_BLOCKS: string[] = [
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
  'WAIT',
  'SET_INSTANT',
  'CLEAR_CANVAS',
  'TELEPORT',
];

export const MODULE_6_BEAT_ALLOWED_BLOCKS: string[] = [
  'PLAY_NOTE',
  'REST',
  'DRUM_KICK',
  'DRUM_SNARE',
  'DRUM_HIHAT',
  'DRUM_CLAP',
  'LIGHT_ROW',
  'LIGHT_COL',
  'LIGHT_PIXEL',
  'CLEAR_LEDS',
  'SET_LED_COLOR',
  'WAIT_BEAT',
  'SET_BEAT_DELAY',
  'STAMP_HEART',
  'STAMP_STAR',
  'STAMP_SMILE',
];

interface BlockSpec {
  type: string;
  repeatCount?: number | VariableName;
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
        s.repeatCount as (VariableName | number | undefined),
        s.params ? { ...s.params } : undefined,
        `${idPrefix}_m_${idx + 1}`
      )
    ),
    F1: (specs.F1 || []).map((s, idx) =>
      createCurriculumBlock(
        s.type,
        s.repeatCount as (VariableName | number | undefined),
        s.params ? { ...s.params } : undefined,
        `${idPrefix}_f1_${idx + 1}`
      )
    ),
    F2: (specs.F2 || []).map((s, idx) =>
      createCurriculumBlock(
        s.type,
        s.repeatCount as (VariableName | number | undefined),
        s.params ? { ...s.params } : undefined,
        `${idPrefix}_f2_${idx + 1}`
      )
    ),
    F3: (specs.F3 || []).map((s, idx) =>
      createCurriculumBlock(
        s.type,
        s.repeatCount as (VariableName | number | undefined),
        s.params ? { ...s.params } : undefined,
        `${idPrefix}_f3_${idx + 1}`
      )
    ),
  };
}

// =============================================================================
// 6.0 [📖 🐢/🤖 Explanation]: Variable Memory Boxes
// =============================================================================

export const LESSON_6_0_GRID_TAB2: CurriculumGridDefinition = {
  width: 6,
  height: 4,
  robot: { x: 1, y: 1, dir: 'EAST' },
  barriers: [],
  dialTiles: [{ x: 2, y: 1, value: 3, label: '3' }],
  flags: [
    { id: 'goal_6_0_t2', x: 5, y: 1, isGoal: true, order: 1, collected: false },
  ],
};

const LESSON_6_0_TAB1_WS = buildMultiScopeWorkspace(
  {
    MAIN: [
      { type: 'VAR_ASSIGN', params: { a: 's', b: 60 } },
      { type: 'LOOP_START', repeatCount: 4 },
      { type: 'FORWARD', params: { distance: 's' } },
      { type: 'TURN_RIGHT', params: { angle: 90 } },
      { type: 'LOOP_END' },
    ],
  },
  'ws_6_0_t1'
);

const LESSON_6_0_TAB2_WS = buildMultiScopeWorkspace(
  {
    MAIN: [
      { type: 'MOVE_FWD' },
      { type: 'VAR_ASSIGN', params: { a: 'a', b: '$tileDial' } },
      { type: 'MOVE_FWD', repeatCount: v('a') },
    ],
  },
  'ws_6_0_t2'
);

const LESSON_6_0_TABS: ExplanationDemoTab[] = [
  {
    id: 'tab-6-0-turtle',
    label: '1',
    icon: '🐢',
    title: 'Turtle Variable Scale (s = 60)',
    simId: 'turtle',
    workspace: LESSON_6_0_TAB1_WS,
    spotlights: ['variable-watch'],
  },
  {
    id: 'tab-6-0-robot',
    label: '2',
    icon: '🤖',
    title: 'Robot Dial Sensor (a = $tileDial)',
    simId: 'grid',
    gridState: LESSON_6_0_GRID_TAB2,
    workspace: LESSON_6_0_TAB2_WS,
    spotlights: ['dial-read'],
  },
];

export const LESSON_6_0: CurriculumActivity = {
  id: '6.0',
  concept: 'Variable Memory Boxes — Named storage for single-point numbers and floor sensors',
  version: 1,
  moduleId: 'module-6',
  format: 'explanation',
  title: 'Variable Memory Boxes',
  icon: '📦',
  simId: 'turtle',
  palette: {
    allowedSimBlocks: MODULE_6_TURTLE_ALLOWED_BLOCKS,
    allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'VAR_ASSIGN'],
    allowedScopes: ['MAIN'],
    allowVariables: true,
    allowedVariableNames: [v('s'), v('a')],
    allowedValueSensors: ['$tileDial'],
  },
  demoTabs: LESSON_6_0_TABS,
};

// =============================================================================
// 6.1 [🐢 Sandbox]: Variables as Single-Point Constants
// =============================================================================

const LESSON_6_1_STARTER = buildMultiScopeWorkspace(
  {
    MAIN: [
      { type: 'VAR_ASSIGN', params: { a: 's', b: 60 } },
      // House base square of side s
      { type: 'LOOP_START', repeatCount: 4 },
      { type: 'FORWARD', params: { distance: 's' } },
      { type: 'TURN_RIGHT', params: { angle: 90 } },
      { type: 'LOOP_END' },
      // Position for roof
      { type: 'FORWARD', params: { distance: 's' } },
      { type: 'TURN_RIGHT', params: { angle: 30 } },
      // Triangle roof of side s
      { type: 'FORWARD', params: { distance: 's' } },
      { type: 'TURN_RIGHT', params: { angle: 120 } },
      { type: 'FORWARD', params: { distance: 's' } },
    ],
  },
  'ws_6_1_starter'
);

const LESSON_6_1_VARIATIONS: CreativeVariationCard[] = [
  {
    id: '6.1-tiny-giant-house',
    title: 'Tiny vs. Giant House',
    icon: '🏡',
    workspace: buildMultiScopeWorkspace(
      {
        MAIN: [
          { type: 'VAR_ASSIGN', params: { a: 's', b: 35 } },
          { type: 'LOOP_START', repeatCount: 4 },
          { type: 'FORWARD', params: { distance: 's' } },
          { type: 'TURN_RIGHT', params: { angle: 90 } },
          { type: 'LOOP_END' },
          { type: 'FORWARD', params: { distance: 's' } },
          { type: 'TURN_RIGHT', params: { angle: 30 } },
          { type: 'FORWARD', params: { distance: 's' } },
          { type: 'TURN_RIGHT', params: { angle: 120 } },
          { type: 'FORWARD', params: { distance: 's' } },
        ],
      },
      'ws_6_1_v1'
    ),
  },
  {
    id: '6.1-scalable-robot-head',
    title: 'Scalable Robot Head',
    icon: '🤖',
    workspace: buildMultiScopeWorkspace(
      {
        MAIN: [
          { type: 'VAR_ASSIGN', params: { a: 's', b: 50 } },
          // Head square
          { type: 'LOOP_START', repeatCount: 4 },
          { type: 'FORWARD', params: { distance: 's' } },
          { type: 'TURN_RIGHT', params: { angle: 90 } },
          { type: 'LOOP_END' },
          // Antenna
          { type: 'FORWARD', params: { distance: 's' } },
          { type: 'TURN_RIGHT', params: { angle: 45 } },
          { type: 'FORWARD', params: { distance: 20 } },
          { type: 'BACKWARD', params: { distance: 20 } },
          { type: 'TURN_RIGHT', params: { angle: 90 } },
          { type: 'FORWARD', params: { distance: 20 } },
        ],
      },
      'ws_6_1_v2'
    ),
  },
  {
    id: '6.1-twin-offset-shapes',
    title: 'Twin Offset Squares',
    icon: '🔲',
    workspace: buildMultiScopeWorkspace(
      {
        MAIN: [
          { type: 'VAR_ASSIGN', params: { a: 's', b: 40 } },
          // Inner square
          { type: 'LOOP_START', repeatCount: 4 },
          { type: 'FORWARD', params: { distance: 's' } },
          { type: 'TURN_RIGHT', params: { angle: 90 } },
          { type: 'LOOP_END' },
          // Scale up by 30
          { type: 'VAR_OP', params: { a: 's', op: '+', b: 's', c: 30 } },
          { type: 'LOOP_START', repeatCount: 4 },
          { type: 'FORWARD', params: { distance: 's' } },
          { type: 'TURN_RIGHT', params: { angle: 90 } },
          { type: 'LOOP_END' },
        ],
      },
      'ws_6_1_v3'
    ),
  },
];

export const LESSON_6_1: CurriculumActivity = {
  id: '6.1',
  concept: 'Variables as Single-Point Constants — Scaling multi-part illustrations with one variable',
  version: 1,
  moduleId: 'module-6',
  format: 'sandbox',
  title: 'Variables as Single-Point Constants',
  icon: '🏠',
  simId: 'turtle',
  palette: {
    allowedSimBlocks: MODULE_6_TURTLE_ALLOWED_BLOCKS,
    allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'VAR_ASSIGN', 'VAR_OP'],
    allowedScopes: ['MAIN'],
    allowVariables: true,
    allowedVariableNames: [v('s')],
    allowedVarOps: ['+', '-'],
  },
  starterWorkspace: LESSON_6_1_STARTER,
  variations: LESSON_6_1_VARIATIONS,
};

// =============================================================================
// 6.3 [📖 🤖 Explanation]: Updating a Variable (a = a + 1)
// =============================================================================

export const LESSON_6_3_GRID_TAB1: CurriculumGridDefinition = {
  width: 6,
  height: 6,
  robot: { x: 0, y: 5, dir: 'EAST' },
  barriers: [],
  flags: [
    { id: 'goal_6_3_t1', x: 4, y: 1, isGoal: true, order: 1, collected: false },
  ],
};

export const LESSON_6_3_GRID_TAB2: CurriculumGridDefinition = {
  width: 7,
  height: 4,
  robot: { x: 0, y: 1, dir: 'EAST' },
  barriers: [],
  flags: [
    { id: 'goal_6_3_t2', x: 6, y: 1, isGoal: true, order: 1, collected: false },
  ],
};

const LESSON_6_3_TAB1_WS = buildMultiScopeWorkspace(
  {
    MAIN: [
      { type: 'VAR_ASSIGN', params: { a: 'a', b: 1 } },
      { type: 'LOOP_START', repeatCount: 4 },
      { type: 'MOVE_FWD', repeatCount: v('a') },
      { type: 'TURN_LEFT' },
      { type: 'MOVE_FWD' },
      { type: 'TURN_RIGHT' },
      { type: 'VAR_OP', params: { a: 'a', op: '+', b: 'a', c: 1 } },
      { type: 'LOOP_END' },
    ],
  },
  'ws_6_3_t1'
);

const LESSON_6_3_TAB2_WS = buildMultiScopeWorkspace(
  {
    MAIN: [
      { type: 'VAR_ASSIGN', params: { a: 'a', b: 1 } },
      { type: 'LOOP_START', repeatCount: 3 },
      { type: 'MOVE_FWD', repeatCount: v('a') },
      { type: 'VAR_OP', params: { a: 'a', op: '+', b: 'a', c: 1 } },
      { type: 'LOOP_END' },
    ],
  },
  'ws_6_3_t2'
);

const LESSON_6_3_TABS: ExplanationDemoTab[] = [
  {
    id: 'tab-6-3-stairs',
    label: '1',
    icon: '🪜',
    title: 'Stepping Stairs (1 → 2 → 3 → 4)',
    simId: 'grid',
    gridState: LESSON_6_3_GRID_TAB1,
    workspace: LESSON_6_3_TAB1_WS,
    spotlights: ['variable-watch'],
  },
  {
    id: 'tab-6-3-accumulator',
    label: '2',
    icon: '📦',
    title: 'Growing Moves (1 + 2 + 3)',
    simId: 'grid',
    gridState: LESSON_6_3_GRID_TAB2,
    workspace: LESSON_6_3_TAB2_WS,
    spotlights: ['variable-watch'],
  },
];

export const LESSON_6_3: CurriculumActivity = {
  id: '6.3',
  concept: 'Updating Variables in Loops — Incremental counting and stepping arithmetic (a = a + 1)',
  version: 1,
  moduleId: 'module-6',
  format: 'explanation',
  title: 'Updating a Variable (a = a + 1)',
  icon: '🪜',
  simId: 'grid',
  palette: {
    allowedSimBlocks: ['MOVE_FWD', 'TURN_LEFT', 'TURN_RIGHT'],
    allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'VAR_ASSIGN', 'VAR_OP'],
    allowedScopes: ['MAIN'],
    allowVariables: true,
    allowedVariableNames: [v('a')],
    allowedVarOps: ['+'],
  },
  demoTabs: LESSON_6_3_TABS,
};

// =============================================================================
// 6.5 [🐢 Sandbox]: Growing & Shrinking Loops (Spirals)
// =============================================================================

const LESSON_6_5_STARTER = buildMultiScopeWorkspace(
  {
    MAIN: [
      { type: 'VAR_ASSIGN', params: { a: 'a', b: 10 } },
      { type: 'LOOP_START', repeatCount: 14 },
      { type: 'FORWARD', params: { distance: 'a' } },
      { type: 'TURN_RIGHT', params: { angle: 90 } },
      { type: 'VAR_OP', params: { a: 'a', op: '+', b: 'a', c: 8 } },
      { type: 'LOOP_END' },
    ],
  },
  'ws_6_5_starter'
);

const LESSON_6_5_VARIATIONS: CreativeVariationCard[] = [
  {
    id: '6.5-skewed-star-spiral',
    title: 'Skewed Star Spiral',
    icon: '✴️',
    workspace: buildMultiScopeWorkspace(
      {
        MAIN: [
          { type: 'VAR_ASSIGN', params: { a: 'a', b: 12 } },
          { type: 'LOOP_START', repeatCount: 16 },
          { type: 'FORWARD', params: { distance: 'a' } },
          { type: 'TURN_RIGHT', params: { angle: 122 } },
          { type: 'VAR_OP', params: { a: 'a', op: '+', b: 'a', c: 7 } },
          { type: 'LOOP_END' },
        ],
      },
      'ws_6_5_v1'
    ),
  },
  {
    id: '6.5-growing-arc-seashell',
    title: 'Growing Arc Seashell',
    icon: '🐚',
    workspace: buildMultiScopeWorkspace(
      {
        MAIN: [
          { type: 'VAR_ASSIGN', params: { a: 'a', b: 10 } },
          { type: 'LOOP_START', repeatCount: 8 },
          { type: 'ARC_RIGHT', params: { radius: 'a', angle: 90 } },
          { type: 'VAR_OP', params: { a: 'a', op: '+', b: 'a', c: 12 } },
          { type: 'LOOP_END' },
        ],
      },
      'ws_6_5_v2'
    ),
  },
  {
    id: '6.5-shrinking-tunnel',
    title: 'Shrinking Inward Tunnel',
    icon: '🕳️',
    workspace: buildMultiScopeWorkspace(
      {
        MAIN: [
          { type: 'VAR_ASSIGN', params: { a: 'a', b: 120 } },
          { type: 'LOOP_START', repeatCount: 11 },
          { type: 'FORWARD', params: { distance: 'a' } },
          { type: 'TURN_RIGHT', params: { angle: 90 } },
          { type: 'VAR_OP', params: { a: 'a', op: '-', b: 'a', c: 10 } },
          { type: 'LOOP_END' },
        ],
      },
      'ws_6_5_v3'
    ),
  },
];

export const LESSON_6_5: CurriculumActivity = {
  id: '6.5',
  concept: 'Growing and Shrinking Loops — Expanding spirals and geometric growth with variables',
  version: 1,
  moduleId: 'module-6',
  format: 'sandbox',
  title: 'Growing & Shrinking Loops (Spirals)',
  icon: '🌀',
  simId: 'turtle',
  palette: {
    allowedSimBlocks: MODULE_6_TURTLE_ALLOWED_BLOCKS,
    allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'VAR_ASSIGN', 'VAR_OP'],
    allowedScopes: ['MAIN'],
    allowVariables: true,
    allowedVariableNames: [v('a')],
    allowedVarOps: ['+', '-'],
  },
  starterWorkspace: LESSON_6_5_STARTER,
  variations: LESSON_6_5_VARIATIONS,
};

// =============================================================================
// 6.5a [📖 🐢 Explanation]: TELEPORT & Pose Sensors ($x, $y, $heading)
// =============================================================================

const LESSON_6_5A_TAB1_WS = buildMultiScopeWorkspace(
  {
    MAIN: [
      { type: 'TELEPORT', params: { x: -75, y: 0, heading: 0 } },
      { type: 'LOOP_START', repeatCount: 4 },
      { type: 'FORWARD', params: { distance: 35 } },
      { type: 'TURN_RIGHT', params: { angle: 90 } },
      { type: 'LOOP_END' },
      // Jump to (75, 0) without drawing any connecting stroke!
      { type: 'TELEPORT', params: { x: 75, y: 0, heading: 0 } },
      { type: 'LOOP_START', repeatCount: 4 },
      { type: 'FORWARD', params: { distance: 35 } },
      { type: 'TURN_RIGHT', params: { angle: 90 } },
      { type: 'LOOP_END' },
    ],
  },
  'ws_6_5a_t1'
);

const LESSON_6_5A_TAB2_WS = buildMultiScopeWorkspace(
  {
    MAIN: [
      { type: 'TELEPORT', params: { x: -60, y: -40, heading: 0 } },
      { type: 'VAR_ASSIGN', params: { a: 'a', b: '$x' } },
      { type: 'VAR_ASSIGN', params: { a: 'b', b: '$y' } },
      { type: 'LOOP_START', repeatCount: 6 },
      { type: 'FORWARD', params: { distance: 45 } },
      { type: 'TURN_RIGHT', params: { angle: 75 } },
      { type: 'LOOP_END' },
      // Snap straight back to bookmarked home!
      { type: 'TELEPORT', params: { x: 'a', y: 'b', heading: 0 } },
    ],
  },
  'ws_6_5a_t2'
);

const LESSON_6_5A_TABS: ExplanationDemoTab[] = [
  {
    id: 'tab-6-5a-jump',
    label: '1',
    icon: '🎯',
    title: 'TELEPORT — Jump Without Drawing',
    simId: 'turtle',
    workspace: LESSON_6_5A_TAB1_WS,
    spotlights: ['pose-bookmark'],
  },
  {
    id: 'tab-6-5a-bookmark',
    label: '2',
    icon: '📍',
    title: 'Pose Sensors — Bookmarking Home',
    simId: 'turtle',
    workspace: LESSON_6_5A_TAB2_WS,
    spotlights: ['pose-bookmark'],
  },
];

export const LESSON_6_5A: CurriculumActivity = {
  id: '6.5a',
  concept: 'TELEPORT & Pose Sensors — Instant positioning and coordinate bookmarking ($x, $y, $heading)',
  version: 1,
  moduleId: 'module-6',
  format: 'explanation',
  title: 'TELEPORT & Pose Sensors',
  icon: '🎯',
  simId: 'turtle',
  palette: {
    allowedSimBlocks: MODULE_6_TURTLE_ALLOWED_BLOCKS,
    allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'VAR_ASSIGN'],
    allowedScopes: ['MAIN'],
    allowVariables: true,
    allowedVariableNames: [v('a'), v('b')],
    allowedValueSensors: ['$x', '$y', '$heading'],
  },
  demoTabs: LESSON_6_5A_TABS,
};

// =============================================================================
// 6.5b [🐢 Sandbox]: Breathing Star (Loop Mode ∞ + Multi-Frame Loop Hygiene)
// =============================================================================

const LESSON_6_5B_STARTER = buildMultiScopeWorkspace(
  {
    MAIN: [
      { type: 'SET_INSTANT', params: { mode: 'ON' } },
      { type: 'VAR_ASSIGN', params: { a: 's', b: 25 } },
      { type: 'CALL_F1' },
      { type: 'CALL_F2' },
    ],
    // F1: Grow pass (6 blocks) — CLEAR_CANVAS at frame START!
    F1: [
      { type: 'LOOP_START', repeatCount: 6 },
      { type: 'CLEAR_CANVAS' },
      { type: 'CALL_F3' },
      { type: 'WAIT', params: { duration: 0.25 } },
      { type: 'VAR_OP', params: { a: 's', op: '+', b: 's', c: 15 } },
      { type: 'LOOP_END' },
    ],
    // F2: Shrink pass (6 blocks) — CLEAR_CANVAS at frame START!
    F2: [
      { type: 'LOOP_START', repeatCount: 6 },
      { type: 'CLEAR_CANVAS' },
      { type: 'CALL_F3' },
      { type: 'WAIT', params: { duration: 0.25 } },
      { type: 'VAR_OP', params: { a: 's', op: '-', b: 's', c: 15 } },
      { type: 'LOOP_END' },
    ],
    // F3: Draw 5-pointed star of side s (4 blocks)
    F3: [
      { type: 'LOOP_START', repeatCount: 5 },
      { type: 'FORWARD', params: { distance: 's' } },
      { type: 'TURN_RIGHT', params: { angle: 144 } },
      { type: 'LOOP_END' },
    ],
  },
  'ws_6_5b_starter'
);

const LESSON_6_5B_VARIATIONS: CreativeVariationCard[] = [
  {
    id: '6.5b-breathing-hexagon',
    title: 'Breathing Hexagon',
    icon: '🛑',
    workspace: buildMultiScopeWorkspace(
      {
        MAIN: [
          { type: 'SET_INSTANT', params: { mode: 'ON' } },
          { type: 'VAR_ASSIGN', params: { a: 's', b: 20 } },
          { type: 'CALL_F1' },
          { type: 'CALL_F2' },
        ],
        F1: [
          { type: 'LOOP_START', repeatCount: 6 },
          { type: 'CLEAR_CANVAS' },
          { type: 'CALL_F3' },
          { type: 'WAIT', params: { duration: 0.25 } },
          { type: 'VAR_OP', params: { a: 's', op: '+', b: 's', c: 12 } },
          { type: 'LOOP_END' },
        ],
        F2: [
          { type: 'LOOP_START', repeatCount: 6 },
          { type: 'CLEAR_CANVAS' },
          { type: 'CALL_F3' },
          { type: 'WAIT', params: { duration: 0.25 } },
          { type: 'VAR_OP', params: { a: 's', op: '-', b: 's', c: 12 } },
          { type: 'LOOP_END' },
        ],
        F3: [
          { type: 'LOOP_START', repeatCount: 6 },
          { type: 'FORWARD', params: { distance: 's' } },
          { type: 'TURN_RIGHT', params: { angle: 60 } },
          { type: 'LOOP_END' },
        ],
      },
      'ws_6_5b_v1'
    ),
  },
  {
    id: '6.5b-heartbeat-pulse',
    title: 'Heartbeat Pulse',
    icon: '💓',
    workspace: buildMultiScopeWorkspace(
      {
        MAIN: [
          { type: 'SET_INSTANT', params: { mode: 'ON' } },
          { type: 'SET_PEN_COLOR', params: { color: '#ef4444' } },
          { type: 'SET_PEN_WIDTH', params: { width: 4 } },
          { type: 'VAR_ASSIGN', params: { a: 's', b: 30 } },
          { type: 'CALL_F1' },
          { type: 'CALL_F2' },
        ],
        F1: [
          { type: 'LOOP_START', repeatCount: 5 },
          { type: 'CLEAR_CANVAS' },
          { type: 'CALL_F3' },
          { type: 'WAIT', params: { duration: 0.25 } },
          { type: 'VAR_OP', params: { a: 's', op: '+', b: 's', c: 15 } },
          { type: 'LOOP_END' },
        ],
        F2: [
          { type: 'LOOP_START', repeatCount: 5 },
          { type: 'CLEAR_CANVAS' },
          { type: 'CALL_F3' },
          { type: 'WAIT', params: { duration: 0.5 } },
          { type: 'VAR_OP', params: { a: 's', op: '-', b: 's', c: 15 } },
          { type: 'LOOP_END' },
        ],
        F3: [
          { type: 'LOOP_START', repeatCount: 5 },
          { type: 'FORWARD', params: { distance: 's' } },
          { type: 'TURN_RIGHT', params: { angle: 144 } },
          { type: 'LOOP_END' },
        ],
      },
      'ws_6_5b_v2'
    ),
  },
  {
    id: '6.5b-sunburst-rays',
    title: 'Expanding Sunburst Rays',
    icon: '☀️',
    workspace: buildMultiScopeWorkspace(
      {
        MAIN: [
          { type: 'SET_INSTANT', params: { mode: 'ON' } },
          { type: 'SET_PEN_COLOR', params: { color: '#f59e0b' } },
          { type: 'VAR_ASSIGN', params: { a: 's', b: 20 } },
          { type: 'CALL_F1' },
          { type: 'CALL_F2' },
        ],
        F1: [
          { type: 'LOOP_START', repeatCount: 6 },
          { type: 'CLEAR_CANVAS' },
          { type: 'CALL_F3' },
          { type: 'WAIT', params: { duration: 0.25 } },
          { type: 'VAR_OP', params: { a: 's', op: '+', b: 's', c: 14 } },
          { type: 'LOOP_END' },
        ],
        F2: [
          { type: 'LOOP_START', repeatCount: 6 },
          { type: 'CLEAR_CANVAS' },
          { type: 'CALL_F3' },
          { type: 'WAIT', params: { duration: 0.25 } },
          { type: 'VAR_OP', params: { a: 's', op: '-', b: 's', c: 14 } },
          { type: 'LOOP_END' },
        ],
        F3: [
          { type: 'LOOP_START', repeatCount: 8 },
          { type: 'FORWARD', params: { distance: 's' } },
          { type: 'BACKWARD', params: { distance: 's' } },
          { type: 'TURN_RIGHT', params: { angle: 45 } },
          { type: 'LOOP_END' },
        ],
      },
      'ws_6_5b_v3'
    ),
  },
];

export const LESSON_6_5B: CurriculumActivity = {
  id: '6.5b',
  concept: 'Multi-Frame Paced Animation — Expanding and contracting loops with clean frame clears',
  version: 1,
  moduleId: 'module-6',
  format: 'sandbox',
  title: 'Breathing Star',
  icon: '⭐',
  simId: 'turtle',
  defaultLoopPlayback: true,
  palette: {
    allowedSimBlocks: MODULE_6_TURTLE_ALLOWED_BLOCKS,
    allowedControlBlocks: [
      'LOOP_START',
      'LOOP_END',
      'CALL_F1',
      'CALL_F2',
      'CALL_F3',
      'VAR_ASSIGN',
      'VAR_OP',
    ],
    allowedScopes: ['MAIN', 'F1', 'F2', 'F3'],
    allowVariables: true,
    allowedVariableNames: [v('s')],
    allowedVarOps: ['+', '-'],
  },
  slotCap: {
    maxTotal: 22,
    perScope: { MAIN: 6, F1: 6, F2: 6, F3: 4 },
  },
  starterWorkspace: LESSON_6_5B_STARTER,
  variations: LESSON_6_5B_VARIATIONS,
};

// =============================================================================
// 6.5c [🐢 Sandbox]: Spiral Builder — Paced Drawing (SET_INSTANT [OFF] + WAIT)
// =============================================================================

const LESSON_6_5C_STARTER = buildMultiScopeWorkspace(
  {
    MAIN: [
      { type: 'SET_INSTANT', params: { mode: 'OFF' } },
      { type: 'VAR_ASSIGN', params: { a: 's', b: 15 } },
      { type: 'LOOP_START', repeatCount: 14 },
      { type: 'FORWARD', params: { distance: 's' } },
      { type: 'TURN_RIGHT', params: { angle: 90 } },
      { type: 'WAIT', params: { duration: 0.25 } },
      { type: 'VAR_OP', params: { a: 's', op: '+', b: 's', c: 10 } },
      { type: 'LOOP_END' },
    ],
  },
  'ws_6_5c_starter'
);

const LESSON_6_5C_VARIATIONS: CreativeVariationCard[] = [
  {
    id: '6.5c-skewed-vortex',
    title: 'Skewed 92° Vortex',
    icon: '🌪️',
    workspace: buildMultiScopeWorkspace(
      {
        MAIN: [
          { type: 'SET_INSTANT', params: { mode: 'OFF' } },
          { type: 'VAR_ASSIGN', params: { a: 's', b: 15 } },
          { type: 'LOOP_START', repeatCount: 16 },
          { type: 'FORWARD', params: { distance: 's' } },
          { type: 'TURN_RIGHT', params: { angle: 92 } },
          { type: 'WAIT', params: { duration: 0.25 } },
          { type: 'VAR_OP', params: { a: 's', op: '+', b: 's', c: 8 } },
          { type: 'LOOP_END' },
        ],
      },
      'ws_6_5c_v1'
    ),
  },
  {
    id: '6.5c-nautilus-shell',
    title: 'Growing Nautilus Shell',
    icon: '🐚',
    workspace: buildMultiScopeWorkspace(
      {
        MAIN: [
          { type: 'SET_INSTANT', params: { mode: 'OFF' } },
          { type: 'VAR_ASSIGN', params: { a: 's', b: 12 } },
          { type: 'LOOP_START', repeatCount: 10 },
          { type: 'ARC_RIGHT', params: { radius: 's', angle: 90 } },
          { type: 'WAIT', params: { duration: 0.25 } },
          { type: 'VAR_OP', params: { a: 's', op: '+', b: 's', c: 10 } },
          { type: 'LOOP_END' },
        ],
      },
      'ws_6_5c_v2'
    ),
  },
  {
    id: '6.5c-unwind-white-eraser',
    title: 'Draw-Then-Unwind White Eraser',
    icon: '🪄',
    workspace: buildMultiScopeWorkspace(
      {
        MAIN: [
          { type: 'SET_INSTANT', params: { mode: 'OFF' } },
          { type: 'SET_PEN_COLOR', params: { color: '#0284c7' } },
          { type: 'VAR_ASSIGN', params: { a: 's', b: 15 } },
          { type: 'CALL_F1' },
          { type: 'SET_PEN_COLOR', params: { color: '#ffffff' } },
          { type: 'SET_PEN_WIDTH', params: { width: 4 } },
          { type: 'CALL_F2' },
        ],
        // F1: Draw spiral outward
        F1: [
          { type: 'LOOP_START', repeatCount: 8 },
          { type: 'FORWARD', params: { distance: 's' } },
          { type: 'TURN_RIGHT', params: { angle: 90 } },
          { type: 'WAIT', params: { duration: 0.25 } },
          { type: 'VAR_OP', params: { a: 's', op: '+', b: 's', c: 10 } },
          { type: 'LOOP_END' },
        ],
        // F2: Retrace inward in White to erase cleanly
        F2: [
          { type: 'LOOP_START', repeatCount: 8 },
          { type: 'VAR_OP', params: { a: 's', op: '-', b: 's', c: 10 } },
          { type: 'TURN_LEFT', params: { angle: 90 } },
          { type: 'BACKWARD', params: { distance: 's' } },
          { type: 'WAIT', params: { duration: 0.25 } },
          { type: 'LOOP_END' },
        ],
      },
      'ws_6_5c_v3'
    ),
  },
];

export const LESSON_6_5C: CurriculumActivity = {
  id: '6.5c',
  concept: 'Paced Incremental Drawing — Growing geometry with unbatched steps and timed pauses',
  version: 1,
  moduleId: 'module-6',
  format: 'sandbox',
  title: 'Spiral Builder — Paced Drawing',
  icon: '🌀',
  simId: 'turtle',
  defaultLoopPlayback: true,
  palette: {
    allowedSimBlocks: MODULE_6_TURTLE_ALLOWED_BLOCKS,
    allowedControlBlocks: [
      'LOOP_START',
      'LOOP_END',
      'CALL_F1',
      'CALL_F2',
      'VAR_ASSIGN',
      'VAR_OP',
    ],
    allowedScopes: ['MAIN', 'F1', 'F2'],
    allowVariables: true,
    allowedVariableNames: [v('s')],
    allowedVarOps: ['+', '-'],
  },
  starterWorkspace: LESSON_6_5C_STARTER,
  variations: LESSON_6_5C_VARIATIONS,
};

// =============================================================================
// 6.6 [🎵 Sandbox]: Sweeping Coordinates & Scales
// =============================================================================

const LESSON_6_6_STARTER = buildMultiScopeWorkspace(
  {
    MAIN: [
      { type: 'VAR_ASSIGN', params: { a: 'p', b: 1 } },
      { type: 'VAR_ASSIGN', params: { a: 'x', b: 1 } },
      { type: 'LOOP_START', repeatCount: 8 },
      { type: 'LIGHT_COL', params: { x: 'x' } },
      { type: 'PLAY_NOTE', params: { pitch: 'p', duration: 1 } },
      { type: 'WAIT_BEAT', params: { duration: 0.5 } },
      { type: 'VAR_OP', params: { a: 'p', op: '+', b: 'p', c: 1 } },
      { type: 'VAR_OP', params: { a: 'x', op: '+', b: 'x', c: 1 } },
      { type: 'LOOP_END' },
    ],
  },
  'ws_6_6_starter'
);

const LESSON_6_6_VARIATIONS: CreativeVariationCard[] = [
  {
    id: '6.6-laser-sweep',
    title: 'Diagonal Laser Sweep',
    icon: '⚡',
    workspace: buildMultiScopeWorkspace(
      {
        MAIN: [
          { type: 'VAR_ASSIGN', params: { a: 'x', b: 1 } },
          { type: 'LOOP_START', repeatCount: 8 },
          { type: 'LIGHT_PIXEL', params: { x: 'x', y: 'x' } },
          { type: 'DRUM_SNARE' },
          { type: 'WAIT_BEAT', params: { duration: 0.25 } },
          { type: 'VAR_OP', params: { a: 'x', op: '+', b: 'x', c: 1 } },
          { type: 'LOOP_END' },
        ],
      },
      'ws_6_6_v1'
    ),
  },
  {
    id: '6.6-equalizer-bars',
    title: 'Growing Equalizer Bars',
    icon: '📊',
    workspace: buildMultiScopeWorkspace(
      {
        MAIN: [
          { type: 'SET_LED_COLOR', params: { color: '#10b981' } },
          { type: 'VAR_ASSIGN', params: { a: 'x', b: 1 } },
          { type: 'LOOP_START', repeatCount: 8 },
          { type: 'LIGHT_COL', params: { x: 'x' } },
          { type: 'PLAY_NOTE', params: { pitch: 'x', duration: 1 } },
          { type: 'WAIT_BEAT', params: { duration: 0.25 } },
          { type: 'VAR_OP', params: { a: 'x', op: '+', b: 'x', c: 1 } },
          { type: 'LOOP_END' },
        ],
      },
      'ws_6_6_v2'
    ),
  },
  {
    id: '6.6-siren-scale',
    title: 'Up-and-Down Siren Scale',
    icon: '🚨',
    workspace: buildMultiScopeWorkspace(
      {
        MAIN: [
          { type: 'VAR_ASSIGN', params: { a: 'p', b: 1 } },
          { type: 'LOOP_START', repeatCount: 7 },
          { type: 'PLAY_NOTE', params: { pitch: 'p', duration: 1 } },
          { type: 'WAIT_BEAT', params: { duration: 0.25 } },
          { type: 'VAR_OP', params: { a: 'p', op: '+', b: 'p', c: 1 } },
          { type: 'LOOP_END' },
          { type: 'LOOP_START', repeatCount: 7 },
          { type: 'PLAY_NOTE', params: { pitch: 'p', duration: 1 } },
          { type: 'WAIT_BEAT', params: { duration: 0.25 } },
          { type: 'VAR_OP', params: { a: 'p', op: '-', b: 'p', c: 1 } },
          { type: 'LOOP_END' },
        ],
      },
      'ws_6_6_v3'
    ),
  },
];

export const LESSON_6_6: CurriculumActivity = {
  id: '6.6',
  concept: 'Sweeping Coordinates & Scales — Dual-variable pitch sweeps and LED matrix tracking',
  version: 1,
  moduleId: 'module-6',
  format: 'sandbox',
  title: 'Sweeping Coordinates & Scales',
  icon: '🎚️',
  simId: 'beat',
  palette: {
    allowedSimBlocks: MODULE_6_BEAT_ALLOWED_BLOCKS,
    allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'VAR_ASSIGN', 'VAR_OP'],
    allowedScopes: ['MAIN'],
    allowVariables: true,
    allowedVariableNames: [v('p'), v('x'), v('y')],
    allowedVarOps: ['+', '-'],
  },
  starterWorkspace: LESSON_6_6_STARTER,
  variations: LESSON_6_6_VARIATIONS,
};

// =============================================================================
// 6.6a [🎵 Sandbox]: Scanner Bar & Wipe Transitions (4 Playable Variations)
// =============================================================================

const LESSON_6_6A_STARTER = buildMultiScopeWorkspace(
  {
    MAIN: [
      { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
      { type: 'SET_LED_COLOR', params: { color: '#10b981' } },
      { type: 'VAR_ASSIGN', params: { a: 'r', b: 1 } },
      { type: 'CALL_F1' },
      { type: 'CALL_F2' },
      { type: 'LIGHT_ROW', params: { y: 1 } },
    ],
    // F1: Sweep down rows 1 -> 7 (6 blocks) — CLEAR_LEDS at frame START!
    F1: [
      { type: 'LOOP_START', repeatCount: 7 },
      { type: 'CLEAR_LEDS' },
      { type: 'LIGHT_ROW', params: { y: 'r' } },
      { type: 'WAIT_BEAT', params: { duration: 0.25 } },
      { type: 'VAR_OP', params: { a: 'r', op: '+', b: 'r', c: 1 } },
      { type: 'LOOP_END' },
    ],
    // F2: Sweep up rows 8 -> 2 (6 blocks) — CLEAR_LEDS at frame START!
    F2: [
      { type: 'LOOP_START', repeatCount: 7 },
      { type: 'CLEAR_LEDS' },
      { type: 'LIGHT_ROW', params: { y: 'r' } },
      { type: 'WAIT_BEAT', params: { duration: 0.25 } },
      { type: 'VAR_OP', params: { a: 'r', op: '-', b: 'r', c: 1 } },
      { type: 'LOOP_END' },
    ],
  },
  'ws_6_6a_starter'
);

const LESSON_6_6A_VARIATIONS: CreativeVariationCard[] = [
  {
    id: '6.6a-color-wipe',
    title: 'Left-to-Right Color Wipe',
    icon: '🟩',
    workspace: buildMultiScopeWorkspace(
      {
        MAIN: [
          { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
          { type: 'SET_LED_COLOR', params: { color: '#06b6d4' } },
          { type: 'VAR_ASSIGN', params: { a: 'c', b: 1 } },
          { type: 'LOOP_START', repeatCount: 8 },
          { type: 'LIGHT_COL', params: { x: 'c' } },
          { type: 'WAIT_BEAT', params: { duration: 0.25 } },
          { type: 'VAR_OP', params: { a: 'c', op: '+', b: 'c', c: 1 } },
          { type: 'LOOP_END' },
          { type: 'DRUM_KICK' },
        ],
      },
      'ws_6_6a_v1'
    ),
  },
  {
    id: '6.6a-curtain-reveal',
    title: 'Curtain Reveal',
    icon: '🎭',
    workspace: buildMultiScopeWorkspace(
      {
        MAIN: [
          { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
          { type: 'SET_LED_COLOR', params: { color: '#a855f7' } },
          { type: 'VAR_ASSIGN', params: { a: 'c', b: 1 } },
          { type: 'LOOP_START', repeatCount: 4 },
          { type: 'LIGHT_COL', params: { x: 'c' } },
          // Right mirror column m = 9 - c
          { type: 'VAR_OP', params: { a: 'm', op: '-', b: 9, c: 'c' } },
          { type: 'LIGHT_COL', params: { x: 'm' } },
          { type: 'WAIT_BEAT', params: { duration: 0.25 } },
          { type: 'VAR_OP', params: { a: 'c', op: '+', b: 'c', c: 1 } },
          { type: 'LOOP_END' },
        ],
      },
      'ws_6_6a_v2'
    ),
  },
  {
    id: '6.6a-diagonal-pixel',
    title: 'Diagonal Bouncing Pixel',
    icon: '💠',
    workspace: buildMultiScopeWorkspace(
      {
        MAIN: [
          { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
          { type: 'SET_LED_COLOR', params: { color: '#f59e0b' } },
          { type: 'VAR_ASSIGN', params: { a: 'x', b: 1 } },
          { type: 'LOOP_START', repeatCount: 8 },
          { type: 'CLEAR_LEDS' },
          { type: 'LIGHT_PIXEL', params: { x: 'x', y: 'x' } },
          { type: 'WAIT_BEAT', params: { duration: 0.25 } },
          { type: 'VAR_OP', params: { a: 'x', op: '+', b: 'x', c: 1 } },
          { type: 'LOOP_END' },
        ],
      },
      'ws_6_6a_v3'
    ),
  },
  {
    id: '6.6a-black-eraser-wipe',
    title: 'Black Eraser Wipe',
    icon: '🖤',
    workspace: buildMultiScopeWorkspace(
      {
        MAIN: [
          { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
          { type: 'SET_LED_COLOR', params: { color: '#f43f5e' } },
          { type: 'STAMP_STAR' },
          { type: 'WAIT_BEAT', params: { duration: 1 } },
          { type: 'SET_LED_COLOR', params: { color: '#000000' } },
          { type: 'VAR_ASSIGN', params: { a: 'c', b: 1 } },
          { type: 'LOOP_START', repeatCount: 8 },
          { type: 'LIGHT_COL', params: { x: 'c' } },
          { type: 'WAIT_BEAT', params: { duration: 0.25 } },
          { type: 'VAR_OP', params: { a: 'c', op: '+', b: 'c', c: 1 } },
          { type: 'LOOP_END' },
        ],
      },
      'ws_6_6a_v4'
    ),
  },
];

export const LESSON_6_6A: CurriculumActivity = {
  id: '6.6a',
  concept: 'Continuous Scanner Animation & Wipe Transitions — Paced row sweeps and color wipes',
  version: 1,
  moduleId: 'module-6',
  format: 'sandbox',
  title: 'Scanner Bar & Wipe Transitions',
  icon: '📻',
  simId: 'beat',
  defaultLoopPlayback: true,
  palette: {
    allowedSimBlocks: MODULE_6_BEAT_ALLOWED_BLOCKS,
    allowedControlBlocks: [
      'LOOP_START',
      'LOOP_END',
      'CALL_F1',
      'CALL_F2',
      'VAR_ASSIGN',
      'VAR_OP',
    ],
    allowedScopes: ['MAIN', 'F1', 'F2'],
    allowVariables: true,
    allowedVariableNames: [v('r'), v('c'), v('m')],
    allowedVarOps: ['+', '-'],
  },
  slotCap: {
    maxTotal: 18,
    perScope: { MAIN: 6, F1: 6, F2: 6 },
  },
  starterWorkspace: LESSON_6_6A_STARTER,
  variations: LESSON_6_6A_VARIATIONS,
};

// =============================================================================
// 6B [🎨 🐢 Capstone]: Spiral & Wave Studio
// =============================================================================

const CAPSTONE_6B_STARTER = buildMultiScopeWorkspace(
  {
    MAIN: [
      { type: 'VAR_ASSIGN', params: { a: 's', b: 10 } },
      { type: 'VAR_ASSIGN', params: { a: 'a', b: 88 } },
      { type: 'CALL_F1' },
    ],
    F1: [
      { type: 'LOOP_START', repeatCount: 16 },
      { type: 'FORWARD', params: { distance: 's' } },
      { type: 'TURN_RIGHT', params: { angle: 'a' } },
      { type: 'VAR_OP', params: { a: 's', op: '+', b: 's', c: 6 } },
      { type: 'LOOP_END' },
    ],
  },
  'ws_6b_starter'
);

const CAPSTONE_6B_VARIATIONS: CreativeVariationCard[] = [
  {
    id: '6B-double-scroll',
    title: 'Double-Ended Scroll',
    icon: '📜',
    workspace: buildMultiScopeWorkspace(
      {
        MAIN: [
          { type: 'VAR_ASSIGN', params: { a: 's', b: 10 } },
          { type: 'CALL_F1' },
          { type: 'TURN_RIGHT', params: { angle: 180 } },
          { type: 'VAR_ASSIGN', params: { a: 's', b: 10 } },
          { type: 'CALL_F1' },
        ],
        F1: [
          { type: 'LOOP_START', repeatCount: 12 },
          { type: 'FORWARD', params: { distance: 's' } },
          { type: 'TURN_LEFT', params: { angle: 90 } },
          { type: 'VAR_OP', params: { a: 's', op: '+', b: 's', c: 7 } },
          { type: 'LOOP_END' },
        ],
      },
      'ws_6b_v1'
    ),
  },
  {
    id: '6B-shell-horn',
    title: 'Shell Horn',
    icon: '📯',
    workspace: buildMultiScopeWorkspace(
      {
        MAIN: [
          { type: 'VAR_ASSIGN', params: { a: 's', b: 8 } },
          { type: 'CALL_F1' },
        ],
        F1: [
          { type: 'LOOP_START', repeatCount: 10 },
          { type: 'ARC_RIGHT', params: { radius: 's', angle: 90 } },
          { type: 'VAR_OP', params: { a: 's', op: '+', b: 's', c: 8 } },
          { type: 'LOOP_END' },
        ],
      },
      'ws_6b_v2'
    ),
  },
  {
    id: '6B-pyramid-steps',
    title: 'Pyramid Steps',
    icon: '🏛️',
    workspace: buildMultiScopeWorkspace(
      {
        MAIN: [
          { type: 'VAR_ASSIGN', params: { a: 's', b: 15 } },
          { type: 'CALL_F1' },
        ],
        F1: [
          { type: 'LOOP_START', repeatCount: 8 },
          { type: 'FORWARD', params: { distance: 's' } },
          { type: 'TURN_LEFT', params: { angle: 90 } },
          { type: 'FORWARD', params: { distance: 15 } },
          { type: 'TURN_RIGHT', params: { angle: 90 } },
          { type: 'VAR_OP', params: { a: 's', op: '+', b: 's', c: 10 } },
          { type: 'LOOP_END' },
        ],
      },
      'ws_6b_v3'
    ),
  },
];

export const CAPSTONE_6B: CurriculumActivity = {
  id: '6B',
  concept: 'Creative Synthesis — Variable-driven geometric spiral and wave choreography',
  version: 1,
  moduleId: 'module-6',
  format: 'capstone',
  capstoneType: 'creative',
  title: 'Spiral & Wave Studio',
  icon: '🎨',
  simId: 'turtle',
  palette: {
    allowedSimBlocks: MODULE_6_TURTLE_ALLOWED_BLOCKS,
    allowedControlBlocks: [
      'LOOP_START',
      'LOOP_END',
      'CALL_F1',
      'CALL_F2',
      'VAR_ASSIGN',
      'VAR_OP',
    ],
    allowedScopes: ['MAIN', 'F1', 'F2'],
    allowVariables: true,
    allowedVariableNames: [v('s'), v('a')],
    allowedVarOps: ['+', '-'],
  },
  starterWorkspace: CAPSTONE_6B_STARTER,
  variations: CAPSTONE_6B_VARIATIONS,
};

// =============================================================================
// Export Module 6 Activities Bundle
// =============================================================================

export const MODULE_6_CREATIVE_ACTIVITIES: CurriculumActivity[] = [
  LESSON_6_0,
  LESSON_6_1,
  LESSON_6_3,
  LESSON_6_5,
  LESSON_6_5A,
  LESSON_6_5B,
  LESSON_6_5C,
  LESSON_6_6,
  LESSON_6_6A,
  CAPSTONE_6B,
];
