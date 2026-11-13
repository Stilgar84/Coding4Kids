import { WorkspaceState } from '../../types';
import { MODULE_3_BEAT_ALLOWED_BLOCKS } from './module3Beat';
import {
  CurriculumActivity,
  CurriculumGridDefinition,
  ExplanationDemoTab,
  createCurriculumBlock,
} from './types';

export const MODULE_4_TURTLE_ALLOWED_BLOCKS: string[] = [
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
];

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
// 4.0 [📖 🤖 Explanation]: Jumping to F1 and Returning
// =============================================================================

export const LESSON_4_0_GRID_TAB1: CurriculumGridDefinition = {
  width: 5,
  height: 4,
  robot: { x: 1, y: 2, dir: 'EAST' },
  barriers: [
    { orientation: 'H', x: 1, y: 2 },
    { orientation: 'H', x: 2, y: 1 },
    { orientation: 'H', x: 3, y: 1 },
    { orientation: 'H', x: 1, y: 3 },
    { orientation: 'H', x: 2, y: 3 },
    { orientation: 'H', x: 3, y: 2 },
    { orientation: 'V', x: 1, y: 2 },
    { orientation: 'V', x: 4, y: 1 },
  ],
  flags: [
    { id: 'goal_4_0_t1', x: 3, y: 1, isGoal: true, order: 1, collected: false },
  ],
};

export const LESSON_4_0_GRID_TAB2: CurriculumGridDefinition = {
  width: 6,
  height: 4,
  robot: { x: 0, y: 2, dir: 'EAST' },
  barriers: [
    { orientation: 'H', x: 0, y: 2 },
    { orientation: 'H', x: 1, y: 1 },
    { orientation: 'H', x: 2, y: 1 },
    { orientation: 'H', x: 3, y: 0 },
    { orientation: 'H', x: 4, y: 0 },
    { orientation: 'H', x: 0, y: 3 },
    { orientation: 'H', x: 1, y: 3 },
    { orientation: 'H', x: 2, y: 2 },
    { orientation: 'H', x: 3, y: 2 },
    { orientation: 'H', x: 4, y: 1 },
    { orientation: 'V', x: 0, y: 2 },
    { orientation: 'V', x: 5, y: 0 },
  ],
  flags: [
    { id: 'goal_4_0_t2', x: 4, y: 0, isGoal: true, order: 1, collected: false },
  ],
};

const LESSON_4_0_TAB1_WORKSPACE = buildMultiScopeWorkspace(
  {
    MAIN: [
      { type: 'MOVE_FWD' },
      { type: 'CALL_F1' },
      { type: 'MOVE_FWD' },
    ],
    F1: [
      { type: 'TURN_LEFT' },
      { type: 'MOVE_FWD' },
      { type: 'TURN_RIGHT' },
    ],
  },
  'm4_0_t1'
);

const LESSON_4_0_TAB2_WORKSPACE = buildMultiScopeWorkspace(
  {
    MAIN: [
      { type: 'CALL_F1' },
      { type: 'MOVE_FWD' },
      { type: 'CALL_F1' },
    ],
    F1: [
      { type: 'MOVE_FWD' },
      { type: 'TURN_LEFT' },
      { type: 'MOVE_FWD' },
      { type: 'TURN_RIGHT' },
    ],
  },
  'm4_0_t2'
);

export const LESSON_4_0_DEMO_TABS: ExplanationDemoTab[] = [
  {
    id: '4.0-tab-1',
    label: '1',
    icon: '📞',
    title: 'Call F1 and Return',
    gridState: LESSON_4_0_GRID_TAB1,
    workspace: LESSON_4_0_TAB1_WORKSPACE,
    spotlights: ['execution-order', 'call-stack-jump'],
  },
  {
    id: '4.0-tab-2',
    label: '2',
    icon: '🔁',
    title: 'Call F1 Twice',
    gridState: LESSON_4_0_GRID_TAB2,
    workspace: LESSON_4_0_TAB2_WORKSPACE,
    spotlights: ['execution-order', 'call-stack-jump'],
  },
];

// =============================================================================
// Module 4 Creative & Demo Activities
// =============================================================================

export const MODULE_4_CREATIVE_ACTIVITIES: CurriculumActivity[] = [
  // =========================================================================
  // 4.0 [📖 🤖 Explanation]: Jumping to F1 and Returning
  // =========================================================================
  {
    id: '4.0',
    moduleId: 'module-4',
    version: 1,
    format: 'explanation',
    simId: 'grid',
    icon: '📖',
    title: 'Jumping to F1 and Returning',
    concept: 'Helper Function Calls & Execution Order — Jump to F1, Execute, Return to Main',
    description:
      'Watch how calling a helper function works! When execution reaches Call F1, it jumps into tab 1 (F1), runs all its blocks, and then returns right back to Main to resume at the next block.',
    hint: 'Step through Demo [1] and [2] to see execution jump from Main into tab 1 (F1) and return cleanly!',
    palette: {
      allowedSimBlocks: ['MOVE_FWD', 'TURN_LEFT', 'TURN_RIGHT'],
      allowedControlBlocks: ['CALL_F1'],
      allowedScopes: ['MAIN', 'F1'],
      allowRepeatBadges: true,
      allowActionParams: false,
      allowVariables: false,
    },
    grid: LESSON_4_0_GRID_TAB1,
    starterWorkspace: LESSON_4_0_TAB1_WORKSPACE,
    demoTabs: LESSON_4_0_DEMO_TABS,
  },

  // =========================================================================
  // 4.2 [🐢 Sandbox]: Shape Stamps & State Hygiene
  // =========================================================================
  {
    id: '4.2',
    moduleId: 'module-4',
    version: 1,
    format: 'sandbox',
    simId: 'turtle',
    icon: '🐢',
    title: 'Shape Stamps & State Hygiene',
    concept: 'Helper Function Encapsulation & State Hygiene (Restoring Pen & Heading)',
    description:
      'A helper function should always clean up after itself! Inside F1, draw a shape and restore the turtle heading and pen state. In Main, jump around with Pen Up and call F1 to stamp clean stars anywhere on the canvas.',
    hint: 'Tap Play to watch Main stamp 4 stars with clean state hygiene, or explore the House with 4 Windows, Pine Trees, and Big Dipper cards!',
    palette: {
      allowedSimBlocks: [...MODULE_4_TURTLE_ALLOWED_BLOCKS],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'CALL_F1'],
      allowedScopes: ['MAIN', 'F1'],
      allowRepeatBadges: true,
      allowActionParams: true,
      allowVariables: false,
    },
    starterWorkspace: buildMultiScopeWorkspace(
      {
        MAIN: [
          { type: 'SET_PEN_WIDTH', params: { width: 2 } },
          { type: 'PEN_UP' },
          { type: 'LOOP_START', repeatCount: 4 },
          { type: 'FORWARD', params: { length: 60 } },
          { type: 'CALL_F1' },
          { type: 'TURN_RIGHT', params: { angle: 90 } },
          { type: 'LOOP_END' },
        ],
        F1: [
          { type: 'SET_PEN_COLOR', params: { color: '#eab308' } },
          { type: 'PEN_DOWN' },
          { type: 'LOOP_START', repeatCount: 5 },
          { type: 'FORWARD', params: { length: 30 } },
          { type: 'TURN_RIGHT', params: { angle: 144 } },
          { type: 'LOOP_END' },
          { type: 'PEN_UP' },
        ],
      },
      'm4_2_starter'
    ),
    variations: [
      {
        id: '4.2-house-windows',
        title: 'House with 4 Stamped Windows',
        icon: '🏠',
        workspace: buildMultiScopeWorkspace(
          {
            MAIN: [
              { type: 'SET_PEN_COLOR', params: { color: '#f97316' } },
              { type: 'SET_PEN_WIDTH', params: { width: 2 } },
              { type: 'PEN_DOWN' },
              { type: 'LOOP_START', repeatCount: 4 },
              { type: 'FORWARD', params: { length: 100 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'LOOP_END' },
              { type: 'PEN_UP' },
              { type: 'FORWARD', params: { length: 25 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 25 } },
              { type: 'TURN_LEFT', params: { angle: 90 } },
              { type: 'CALL_F1' },
              { type: 'FORWARD', params: { length: 45 } },
              { type: 'CALL_F1' },
            ],
            F1: [
              { type: 'SET_PEN_COLOR', params: { color: '#38bdf8' } },
              { type: 'PEN_DOWN' },
              { type: 'LOOP_START', repeatCount: 4 },
              { type: 'FORWARD', params: { length: 20 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'LOOP_END' },
              { type: 'PEN_UP' },
            ],
          },
          'm4_2_house'
        ),
      },
      {
        id: '4.2-pine-trees',
        title: 'Row of 3 Stamped Pine Trees',
        icon: '🌲',
        workspace: buildMultiScopeWorkspace(
          {
            MAIN: [
              { type: 'PEN_UP' },
              { type: 'TURN_LEFT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 80 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'LOOP_START', repeatCount: 3 },
              { type: 'CALL_F1' },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 70 } },
              { type: 'TURN_LEFT', params: { angle: 90 } },
              { type: 'LOOP_END' },
            ],
            F1: [
              { type: 'SET_PEN_COLOR', params: { color: '#10b981' } },
              { type: 'PEN_DOWN' },
              { type: 'TURN_LEFT', params: { angle: 30 } },
              { type: 'FORWARD', params: { length: 40 } },
              { type: 'TURN_RIGHT', params: { angle: 120 } },
              { type: 'FORWARD', params: { length: 40 } },
              { type: 'TURN_RIGHT', params: { angle: 120 } },
              { type: 'FORWARD', params: { length: 40 } },
              { type: 'TURN_RIGHT', params: { angle: 150 } },
              { type: 'PEN_UP' },
            ],
          },
          'm4_2_trees'
        ),
      },
      {
        id: '4.2-big-dipper',
        title: 'Big Dipper Constellation',
        icon: '✨',
        workspace: buildMultiScopeWorkspace(
          {
            MAIN: [
              { type: 'SET_PEN_COLOR', params: { color: '#94a3b8' } },
              { type: 'SET_PEN_WIDTH', params: { width: 1 } },
              { type: 'CALL_F1' },
              { type: 'PEN_DOWN' },
              { type: 'FORWARD', params: { length: 40 } },
              { type: 'CALL_F1' },
              { type: 'TURN_RIGHT', params: { angle: 30 } },
              { type: 'FORWARD', params: { length: 45 } },
              { type: 'CALL_F1' },
              { type: 'TURN_LEFT', params: { angle: 45 } },
              { type: 'FORWARD', params: { length: 50 } },
              { type: 'CALL_F1' },
              { type: 'PEN_UP' },
            ],
            F1: [
              { type: 'SET_PEN_COLOR', params: { color: '#eab308' } },
              { type: 'PEN_DOWN' },
              { type: 'LOOP_START', repeatCount: 5 },
              { type: 'FORWARD', params: { length: 15 } },
              { type: 'TURN_RIGHT', params: { angle: 144 } },
              { type: 'LOOP_END' },
              { type: 'PEN_UP' },
            ],
          },
          'm4_2_dipper'
        ),
      },
    ],
  },

  // =========================================================================
  // 4.3 [🎵 Sandbox]: Chorus & Verse Composition (F1, F2)
  // =========================================================================
  {
    id: '4.3',
    moduleId: 'module-4',
    version: 1,
    format: 'sandbox',
    simId: 'beat',
    icon: '🎵',
    title: 'Chorus & Verse Composition (F1, F2)',
    concept: 'Musical Form & Structural Reuse with Functions (Verse & Chorus)',
    description:
      'Assemble complete musical tracks by building a Chorus groove in F1 and a Verse melody in F2. In Main, arrange the song form F1 → F1 → F2 → F1 without re-entering the notes!',
    hint: 'Tap Play to listen to the song arrangement F1–F1–F2–F1, or preview the Dance Track, 4-Frame Sprite Animation, and Call-and-Response cards!',
    palette: {
      allowedSimBlocks: [...MODULE_3_BEAT_ALLOWED_BLOCKS],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'CALL_F1', 'CALL_F2'],
      allowedScopes: ['MAIN', 'F1', 'F2'],
      allowRepeatBadges: true,
      allowActionParams: true,
      allowVariables: false,
    },
    starterWorkspace: buildMultiScopeWorkspace(
      {
        MAIN: [
          { type: 'CALL_F1' },
          { type: 'CALL_F1' },
          { type: 'CALL_F2' },
          { type: 'CALL_F1' },
        ],
        F1: [
          { type: 'SET_LED_COLOR', params: { color: '#06b6d4' } },
          { type: 'DRUM_KICK' },
          { type: 'CURSOR_STEP', repeatCount: 4 },
          { type: 'DRUM_SNARE' },
          { type: 'CURSOR_STEP', repeatCount: 4 },
          { type: 'PLAY_CHIME' },
        ],
        F2: [
          { type: 'SET_LED_COLOR', params: { color: '#fbbf24' } },
          { type: 'PLAY_NOTE', params: { pitch: 3, duration: 0.5 } },
          { type: 'CURSOR_STEP', repeatCount: 2 },
          { type: 'PLAY_NOTE', params: { pitch: 5, duration: 0.5 } },
          { type: 'CURSOR_STEP', repeatCount: 2 },
          { type: 'PLAY_NOTE', params: { pitch: 7, duration: 0.5 } },
          { type: 'DRUM_CLAP' },
        ],
      },
      'm4_3_starter'
    ),
    variations: [
      {
        id: '4.3-dance-track',
        title: 'A-B-A-B Dance Track',
        icon: '💃',
        workspace: buildMultiScopeWorkspace(
          {
            MAIN: [
              { type: 'LOOP_START', repeatCount: 2 },
              { type: 'CALL_F1' },
              { type: 'CALL_F2' },
              { type: 'LOOP_END' },
            ],
            F1: [
              { type: 'SET_LED_COLOR', params: { color: '#ec4899' } },
              { type: 'DRUM_KICK' },
              { type: 'CURSOR_STEP', repeatCount: 2 },
              { type: 'DRUM_CLAP' },
              { type: 'CURSOR_STEP', repeatCount: 2 },
            ],
            F2: [
              { type: 'SET_LED_COLOR', params: { color: '#a855f7' } },
              { type: 'DRUM_SNARE', repeatCount: 2 },
              { type: 'PLAY_NOTE', params: { pitch: 6, duration: 0.5 } },
              { type: 'CURSOR_STEP', repeatCount: 4 },
              { type: 'PLAY_CHIME' },
            ],
          },
          'm4_3_dance'
        ),
      },
      {
        id: '4.3-sprite-animation',
        title: '4-Frame Sprite Animation',
        icon: '👾',
        workspace: buildMultiScopeWorkspace(
          {
            MAIN: [
              { type: 'LOOP_START', repeatCount: 2 },
              { type: 'CALL_F1' },
              { type: 'CALL_F2' },
              { type: 'LOOP_END' },
            ],
            F1: [
              { type: 'CLEAR_LEDS' },
              { type: 'SET_LED_COLOR', params: { color: '#38bdf8' } },
              { type: 'DRUM_KICK' },
              { type: 'CURSOR_STEP', repeatCount: 3 },
              { type: 'PLAY_NOTE', params: { pitch: 4, duration: 0.5 } },
            ],
            F2: [
              { type: 'CLEAR_LEDS' },
              { type: 'SET_LED_COLOR', params: { color: '#f43f5e' } },
              { type: 'DRUM_SNARE' },
              { type: 'CURSOR_STEP', repeatCount: 3 },
              { type: 'PLAY_NOTE', params: { pitch: 8, duration: 0.5 } },
            ],
          },
          'm4_3_sprite'
        ),
      },
      {
        id: '4.3-call-response',
        title: 'Call-and-Response Melody',
        icon: '🎷',
        workspace: buildMultiScopeWorkspace(
          {
            MAIN: [
              { type: 'CALL_F1' },
              { type: 'CALL_F2' },
              { type: 'CALL_F1' },
              { type: 'CALL_F2' },
            ],
            F1: [
              { type: 'SET_LED_COLOR', params: { color: '#ef4444' } },
              { type: 'DRUM_KICK' },
              { type: 'PLAY_NOTE', params: { pitch: 2, duration: 0.5 } },
              { type: 'PLAY_NOTE', params: { pitch: 4, duration: 0.5 } },
            ],
            F2: [
              { type: 'SET_LED_COLOR', params: { color: '#10b981' } },
              { type: 'PLAY_NOTE', params: { pitch: 7, duration: 0.5 } },
              { type: 'PLAY_NOTE', params: { pitch: 9, duration: 0.5 } },
              { type: 'PLAY_CHIME' },
            ],
          },
          'm4_3_call_response'
        ),
      },
    ],
  },

  // =========================================================================
  // 4B [🎨 🐢 Capstone]: Castle Architect
  // =========================================================================
  {
    id: '4B',
    moduleId: 'module-4',
    version: 1,
    format: 'capstone',
    capstoneType: 'creative',
    simId: 'turtle',
    icon: '🎨',
    title: 'Castle Architect',
    concept: 'Creative Synthesis — Multi-Function Architectural Decomposition (F1, F2, F3)',
    description:
      'Decompose a magnificent castle into reusable architectural components: Tower (F1), Wall (F2), and Flag (F3). Arrange them across the canvas in Main to construct towering fortresses!',
    hint: 'Run the castle starter, preview the City Skyline, Sailboat Fleet, or Flower Garden cards, and tap ✓ Done when your architectural masterpiece is complete!',
    palette: {
      allowedSimBlocks: [...MODULE_4_TURTLE_ALLOWED_BLOCKS],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'CALL_F1', 'CALL_F2', 'CALL_F3'],
      allowedScopes: ['MAIN', 'F1', 'F2', 'F3'],
      allowRepeatBadges: true,
      allowActionParams: true,
      allowVariables: false,
    },
    starterWorkspace: buildMultiScopeWorkspace(
      {
        MAIN: [
          { type: 'SET_PEN_WIDTH', params: { width: 2 } },
          { type: 'CALL_F1' },
          { type: 'CALL_F3' },
          { type: 'PEN_UP' },
          { type: 'TURN_RIGHT', params: { angle: 90 } },
          { type: 'FORWARD', params: { length: 50 } },
          { type: 'TURN_LEFT', params: { angle: 90 } },
          { type: 'CALL_F2' },
          { type: 'CALL_F1' },
          { type: 'CALL_F3' },
        ],
        F1: [
          { type: 'SET_PEN_COLOR', params: { color: '#64748b' } },
          { type: 'PEN_DOWN' },
          { type: 'LOOP_START', repeatCount: 4 },
          { type: 'FORWARD', params: { length: 50 } },
          { type: 'TURN_RIGHT', params: { angle: 90 } },
          { type: 'LOOP_END' },
          { type: 'PEN_UP' },
        ],
        F2: [
          { type: 'SET_PEN_COLOR', params: { color: '#94a3b8' } },
          { type: 'PEN_DOWN' },
          { type: 'FORWARD', params: { length: 30 } },
          { type: 'TURN_LEFT', params: { angle: 90 } },
          { type: 'FORWARD', params: { length: 15 } },
          { type: 'TURN_RIGHT', params: { angle: 90 } },
          { type: 'FORWARD', params: { length: 15 } },
          { type: 'TURN_RIGHT', params: { angle: 90 } },
          { type: 'FORWARD', params: { length: 15 } },
          { type: 'TURN_LEFT', params: { angle: 90 } },
          { type: 'PEN_UP' },
        ],
        F3: [
          { type: 'SET_PEN_COLOR', params: { color: '#ef4444' } },
          { type: 'PEN_DOWN' },
          { type: 'TURN_LEFT', params: { angle: 30 } },
          { type: 'FORWARD', params: { length: 20 } },
          { type: 'TURN_RIGHT', params: { angle: 120 } },
          { type: 'FORWARD', params: { length: 20 } },
          { type: 'TURN_RIGHT', params: { angle: 120 } },
          { type: 'FORWARD', params: { length: 20 } },
          { type: 'TURN_RIGHT', params: { angle: 90 } },
          { type: 'PEN_UP' },
        ],
      },
      'capstone_4b_starter'
    ),
    variations: [
      {
        id: '4b-city-skyline',
        title: 'City Skyline',
        icon: '🏙️',
        workspace: buildMultiScopeWorkspace(
          {
            MAIN: [
              { type: 'CALL_F1' },
              { type: 'PEN_UP' },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 45 } },
              { type: 'TURN_LEFT', params: { angle: 90 } },
              { type: 'CALL_F2' },
              { type: 'PEN_UP' },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 45 } },
              { type: 'TURN_LEFT', params: { angle: 90 } },
              { type: 'CALL_F1' },
              { type: 'CALL_F3' },
            ],
            F1: [
              { type: 'SET_PEN_COLOR', params: { color: '#0284c7' } },
              { type: 'PEN_DOWN' },
              { type: 'FORWARD', params: { length: 80 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 40 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 80 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 40 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'PEN_UP' },
            ],
            F2: [
              { type: 'SET_PEN_COLOR', params: { color: '#f59e0b' } },
              { type: 'PEN_DOWN' },
              { type: 'FORWARD', params: { length: 45 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 35 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 45 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 35 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'PEN_UP' },
            ],
            F3: [
              { type: 'SET_PEN_COLOR', params: { color: '#ef4444' } },
              { type: 'PEN_DOWN' },
              { type: 'FORWARD', params: { length: 25 } },
              { type: 'BACKWARD', params: { length: 25 } },
              { type: 'PEN_UP' },
            ],
          },
          'capstone_4b_skyline'
        ),
      },
      {
        id: '4b-sailboat-fleet',
        title: 'Sailboat Fleet',
        icon: '⛵',
        workspace: buildMultiScopeWorkspace(
          {
            MAIN: [
              { type: 'CALL_F1' },
              { type: 'CALL_F2' },
              { type: 'CALL_F3' },
              { type: 'PEN_UP' },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 70 } },
              { type: 'TURN_LEFT', params: { angle: 90 } },
              { type: 'CALL_F1' },
              { type: 'CALL_F2' },
            ],
            F1: [
              { type: 'SET_PEN_COLOR', params: { color: '#b45309' } },
              { type: 'PEN_DOWN' },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 50 } },
              { type: 'TURN_RIGHT', params: { angle: 120 } },
              { type: 'FORWARD', params: { length: 20 } },
              { type: 'TURN_RIGHT', params: { angle: 60 } },
              { type: 'FORWARD', params: { length: 30 } },
              { type: 'TURN_RIGHT', params: { angle: 60 } },
              { type: 'FORWARD', params: { length: 20 } },
              { type: 'TURN_RIGHT', params: { angle: 30 } },
              { type: 'PEN_UP' },
            ],
            F2: [
              { type: 'SET_PEN_COLOR', params: { color: '#ffffff' } },
              { type: 'PEN_DOWN' },
              { type: 'FORWARD', params: { length: 45 } },
              { type: 'TURN_RIGHT', params: { angle: 135 } },
              { type: 'FORWARD', params: { length: 45 } },
              { type: 'TURN_RIGHT', params: { angle: 135 } },
              { type: 'FORWARD', params: { length: 32 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'PEN_UP' },
            ],
            F3: [
              { type: 'SET_PEN_COLOR', params: { color: '#38bdf8' } },
              { type: 'PEN_DOWN' },
              { type: 'TURN_LEFT', params: { angle: 30 } },
              { type: 'FORWARD', params: { length: 15 } },
              { type: 'TURN_RIGHT', params: { angle: 120 } },
              { type: 'FORWARD', params: { length: 15 } },
              { type: 'TURN_RIGHT', params: { angle: 120 } },
              { type: 'FORWARD', params: { length: 15 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'PEN_UP' },
            ],
          },
          'capstone_4b_fleet'
        ),
      },
      {
        id: '4b-flower-garden',
        title: 'Flower Garden',
        icon: '🌸',
        workspace: buildMultiScopeWorkspace(
          {
            MAIN: [
              { type: 'CALL_F2' },
              { type: 'CALL_F1' },
              { type: 'PEN_UP' },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'FORWARD', params: { length: 60 } },
              { type: 'TURN_LEFT', params: { angle: 90 } },
              { type: 'CALL_F2' },
              { type: 'CALL_F1' },
              { type: 'CALL_F3' },
            ],
            F1: [
              { type: 'SET_PEN_COLOR', params: { color: '#ec4899' } },
              { type: 'PEN_DOWN' },
              { type: 'LOOP_START', repeatCount: 6 },
              { type: 'FORWARD', params: { length: 20 } },
              { type: 'TURN_RIGHT', params: { angle: 60 } },
              { type: 'LOOP_END' },
              { type: 'PEN_UP' },
            ],
            F2: [
              { type: 'SET_PEN_COLOR', params: { color: '#22c55e' } },
              { type: 'PEN_DOWN' },
              { type: 'FORWARD', params: { length: 45 } },
              { type: 'PEN_UP' },
            ],
            F3: [
              { type: 'SET_PEN_COLOR', params: { color: '#a855f7' } },
              { type: 'PEN_DOWN' },
              { type: 'LOOP_START', repeatCount: 4 },
              { type: 'FORWARD', params: { length: 12 } },
              { type: 'TURN_RIGHT', params: { angle: 90 } },
              { type: 'LOOP_END' },
              { type: 'PEN_UP' },
            ],
          },
          'capstone_4b_garden'
        ),
      },
    ],
  },

  // =========================================================================
  // 4C [🎨 🎵 Capstone]: Full Song Choreography
  // =========================================================================
  {
    id: '4C',
    moduleId: 'module-4',
    version: 1,
    format: 'capstone',
    capstoneType: 'creative',
    simId: 'beat',
    icon: '🎨',
    title: 'Full Song Choreography',
    concept: 'Creative Synthesis — Three-Part Song Structure (Intro, Verse, Chorus)',
    description:
      'Choreograph a complete electronic music production! Build an ambient Intro (F1), a driving Verse (F2), and an explosive Chorus (F3), then arrange the full performance in Main with synchronized light choreography.',
    hint: 'Listen to the full Intro–Verse–Chorus starter, explore the Chiptune Boss Theme, Fireworks Finale, and Pixel Story cards, or craft your own groove!',
    palette: {
      allowedSimBlocks: [...MODULE_3_BEAT_ALLOWED_BLOCKS],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'CALL_F1', 'CALL_F2', 'CALL_F3'],
      allowedScopes: ['MAIN', 'F1', 'F2', 'F3'],
      allowRepeatBadges: true,
      allowActionParams: true,
      allowVariables: false,
    },
    starterWorkspace: buildMultiScopeWorkspace(
      {
        MAIN: [
          { type: 'CALL_F1' },
          { type: 'CALL_F2' },
          { type: 'CALL_F3' },
          { type: 'CALL_F3' },
        ],
        F1: [
          { type: 'SET_LED_COLOR', params: { color: '#818cf8' } },
          { type: 'PLAY_CHIME' },
          { type: 'CURSOR_STEP', repeatCount: 4 },
          { type: 'PLAY_NOTE', params: { pitch: 4, duration: 0.5 } },
          { type: 'CURSOR_STEP', repeatCount: 4 },
        ],
        F2: [
          { type: 'SET_LED_COLOR', params: { color: '#38bdf8' } },
          { type: 'DRUM_KICK' },
          { type: 'CURSOR_STEP', repeatCount: 2 },
          { type: 'PLAY_NOTE', params: { pitch: 6, duration: 0.5 } },
          { type: 'DRUM_CLAP' },
          { type: 'CURSOR_STEP', repeatCount: 2 },
        ],
        F3: [
          { type: 'SET_LED_COLOR', params: { color: '#f43f5e' } },
          { type: 'DRUM_KICK' },
          { type: 'PLAY_NOTE', params: { pitch: 8, duration: 0.5 } },
          { type: 'DRUM_SNARE' },
          { type: 'PLAY_NOTE', params: { pitch: 11, duration: 0.5 } },
          { type: 'PLAY_CHIME' },
        ],
      },
      'capstone_4c_starter'
    ),
    variations: [
      {
        id: '4c-chiptune-boss',
        title: 'Chiptune Boss Theme',
        icon: '👾',
        workspace: buildMultiScopeWorkspace(
          {
            MAIN: [
              { type: 'CALL_F1' },
              { type: 'LOOP_START', repeatCount: 2 },
              { type: 'CALL_F2' },
              { type: 'CALL_F3' },
              { type: 'LOOP_END' },
            ],
            F1: [
              { type: 'SET_LED_COLOR', params: { color: '#eab308' } },
              { type: 'PLAY_NOTE', params: { pitch: 1, duration: 0.5 } },
              { type: 'PLAY_NOTE', params: { pitch: 3, duration: 0.5 } },
              { type: 'PLAY_NOTE', params: { pitch: 5, duration: 0.5 } },
              { type: 'DRUM_SNARE' },
            ],
            F2: [
              { type: 'SET_LED_COLOR', params: { color: '#06b6d4' } },
              { type: 'DRUM_KICK' },
              { type: 'CURSOR_STEP', repeatCount: 2 },
              { type: 'PLAY_NOTE', params: { pitch: 7, duration: 0.5 } },
              { type: 'CURSOR_STEP', repeatCount: 2 },
              { type: 'DRUM_CLAP' },
            ],
            F3: [
              { type: 'SET_LED_COLOR', params: { color: '#a855f7' } },
              { type: 'DRUM_KICK', repeatCount: 2 },
              { type: 'PLAY_NOTE', params: { pitch: 10, duration: 0.5 } },
              { type: 'DRUM_SNARE' },
              { type: 'PLAY_CHIME' },
            ],
          },
          'capstone_4c_boss'
        ),
      },
      {
        id: '4c-fireworks-finale',
        title: 'Fireworks Finale',
        icon: '🎆',
        workspace: buildMultiScopeWorkspace(
          {
            MAIN: [
              { type: 'CALL_F1' },
              { type: 'CALL_F2' },
              { type: 'CALL_F3' },
            ],
            F1: [
              { type: 'SET_LED_COLOR', params: { color: '#fbbf24' } },
              { type: 'PLAY_NOTE', params: { pitch: 2, duration: 0.5 } },
              { type: 'CURSOR_STEP', repeatCount: 3 },
              { type: 'PLAY_NOTE', params: { pitch: 5, duration: 0.5 } },
              { type: 'CURSOR_STEP', repeatCount: 3 },
            ],
            F2: [
              { type: 'SET_LED_COLOR', params: { color: '#f97316' } },
              { type: 'DRUM_KICK' },
              { type: 'PLAY_NOTE', params: { pitch: 7, duration: 0.5 } },
              { type: 'CURSOR_STEP', repeatCount: 4 },
              { type: 'DRUM_CLAP' },
            ],
            F3: [
              { type: 'SET_LED_COLOR', params: { color: '#ec4899' } },
              { type: 'DRUM_KICK' },
              { type: 'PLAY_NOTE', params: { pitch: 12, duration: 0.5 } },
              { type: 'DRUM_SNARE', repeatCount: 2 },
              { type: 'PLAY_CHIME' },
            ],
          },
          'capstone_4c_fireworks'
        ),
      },
      {
        id: '4c-pixel-story',
        title: 'Pixel Story',
        icon: '🎬',
        workspace: buildMultiScopeWorkspace(
          {
            MAIN: [
              { type: 'CALL_F1' },
              { type: 'CALL_F2' },
              { type: 'CALL_F3' },
            ],
            F1: [
              { type: 'SET_LED_COLOR', params: { color: '#f59e0b' } },
              { type: 'PLAY_CHIME' },
              { type: 'CURSOR_STEP', repeatCount: 2 },
              { type: 'PLAY_NOTE', params: { pitch: 3, duration: 0.5 } },
            ],
            F2: [
              { type: 'SET_LED_COLOR', params: { color: '#10b981' } },
              { type: 'DRUM_KICK' },
              { type: 'CURSOR_STEP', repeatCount: 4 },
              { type: 'PLAY_NOTE', params: { pitch: 6, duration: 0.5 } },
              { type: 'DRUM_SNARE' },
            ],
            F3: [
              { type: 'SET_LED_COLOR', params: { color: '#3b82f6' } },
              { type: 'DRUM_KICK' },
              { type: 'PLAY_NOTE', params: { pitch: 9, duration: 0.5 } },
              { type: 'PLAY_CHIME' },
              { type: 'DRUM_CLAP' },
            ],
          },
          'capstone_4c_story'
        ),
      },
    ],
  },
];
