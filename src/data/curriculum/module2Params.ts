import { WorkspaceState } from '../../types';
import { CurriculumActivity, createCurriculumBlock } from './types';

interface BlockSpec {
  type: string;
  repeatCount?: number;
  params?: Record<string, unknown>;
}

function buildModule2Workspace(specs: BlockSpec[], idPrefix: string): WorkspaceState {
  return {
    MAIN: specs.map((spec, idx) =>
      createCurriculumBlock(
        spec.type,
        spec.repeatCount,
        spec.params,
        `${idPrefix}_${idx + 1}`
      )
    ),
    F1: [],
    F2: [],
    F3: [],
  };
}

/**
 * Tier 1 + Tier 2 Beat & Light Matrix blocks exposed in Module 2 (`2.5`).
 */
export const MODULE_2_BEAT_ALLOWED_BLOCKS: string[] = [
  'DRUM_KICK',
  'DRUM_SNARE',
  'DRUM_CLAP',
  'PLAY_CHIME',
  'WAIT_BEAT',
  'CLEAR_LEDS',
  'PLAY_NOTE',
  'SET_LED_COLOR',
  'LIGHT_ROW',
  'LIGHT_COL',
  'LIGHT_PIXEL',
  'STAMP_PRESET',
  'SET_BEAT_DELAY',
];

/**
 * Module 2 Action Parameters (`2.1`–`2.4`, Creative Capstone `2B`) &
 * Beat & Light Tier 2 Blocks (`2.5`).
 */
export const MODULE_2_PARAMS_ACTIVITIES: CurriculumActivity[] = [
  // =========================================================================
  // 2.1 [🤖 Puzzle]: Action Repeat Badges (×2..×9)
  // =========================================================================
  {
    id: '2.1',
    moduleId: 'module-2',
    version: 1,
    format: 'puzzle',
    simId: 'grid',
    icon: '🤖',
    title: 'Action Repeat Badges (×2..×9)',
    concept: 'Compressing Straight Runs with Action Repeat Badges',
    description:
      'Attach a ×2..×9 number badge to Move Forward or Move Back so a single block steps multiple cells inside the 5-slot tray.',
    hint: 'Snap ×5 onto the first Move Forward, turn Right, then use ×4 on the next two corridors to reach the flag in 5 blocks.',
    palette: {
      allowedSimBlocks: ['MOVE_FWD', 'MOVE_BACK', 'TURN_LEFT', 'TURN_RIGHT'],
      allowedControlBlocks: [],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: false,
      allowVariables: false,
    },
    slotCap: {
      maxTotal: 5,
    },
    grid: {
      width: 6,
      height: 5,
      robot: { x: 0, y: 0, dir: 'EAST' },
      barriers: [
        // Seal top corridor (y = 0, x = 0..4); leave (5, 0) open South to (5, 1)
        { orientation: 'H', x: 0, y: 1 },
        { orientation: 'H', x: 1, y: 1 },
        { orientation: 'H', x: 2, y: 1 },
        { orientation: 'H', x: 3, y: 1 },
        { orientation: 'H', x: 4, y: 1 },
        // Seal right vertical corridor (x = 5, y = 1..3); leave (5, 4) open West to (4, 4)
        { orientation: 'V', x: 5, y: 1 },
        { orientation: 'V', x: 5, y: 2 },
        { orientation: 'V', x: 5, y: 3 },
        // Seal bottom corridor (y = 4, x = 1..4) and cap West end of goal (1, 4)
        { orientation: 'H', x: 1, y: 4 },
        { orientation: 'H', x: 2, y: 4 },
        { orientation: 'H', x: 3, y: 4 },
        { orientation: 'H', x: 4, y: 4 },
        { orientation: 'V', x: 1, y: 4 },
      ],
      flags: [{ id: 'goal_2_1', x: 1, y: 4, isGoal: true, order: 1, collected: false }],
    },
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: buildModule2Workspace(
        [
          { type: 'MOVE_FWD', repeatCount: 5 },
          { type: 'TURN_RIGHT' },
          { type: 'PLACEHOLDER', params: { hintCategory: 'motion' } },
          { type: 'TURN_RIGHT' },
          { type: 'PLACEHOLDER', params: { hintCategory: 'motion' } },
        ],
        'm2_1_scaffold'
      ),
    },
    referenceSolution: buildModule2Workspace(
      [
        { type: 'MOVE_FWD', repeatCount: 5 },
        { type: 'TURN_RIGHT' },
        { type: 'MOVE_FWD', repeatCount: 4 },
        { type: 'TURN_RIGHT' },
        { type: 'MOVE_FWD', repeatCount: 4 },
      ],
      'm2_1_ref'
    ),
    antiBypassRules: [
      {
        id: '2.1-require-repeat-badges',
        description:
          'Cannot solve the 6x5 U-corridor within the 5-slot tray without ×N repeat badges (unrolled minimum is 15 blocks >= 9)',
        allowRepeatBadges: false,
      },
    ],
  },

  // =========================================================================
  // 2.2 [🐢 Sandbox]: Length & Turn Angle Parameters
  // =========================================================================
  {
    id: '2.2',
    moduleId: 'module-2',
    version: 1,
    format: 'sandbox',
    simId: 'turtle',
    icon: '🐢',
    title: 'Length & Turn Angle Parameters',
    concept: 'Distance & Exterior Angle Parameter Badges',
    description:
      'Tap the parameter badge on Forward, Backward, Turn Left, or Turn Right to pick custom pixel lengths and crisp turn angles like 30°, 60°, and 120°.',
    hint: 'Notice how three 120° exterior turns add up to 360° to close the starter triangle. Try loading a variation card or changing any angle badge!',
    palette: {
      allowedSimBlocks: [
        'FORWARD',
        'BACKWARD',
        'TURN_LEFT',
        'TURN_RIGHT',
        'PEN_UP',
        'PEN_DOWN',
      ],
      allowedControlBlocks: [],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: true,
      allowVariables: false,
    },
    starterWorkspace: buildModule2Workspace(
      [
        { type: 'FORWARD', params: { length: 100 } },
        { type: 'TURN_RIGHT', params: { angle: 120 } },
        { type: 'FORWARD', params: { length: 100 } },
        { type: 'TURN_RIGHT', params: { angle: 120 } },
        { type: 'FORWARD', params: { length: 100 } },
        { type: 'TURN_RIGHT', params: { angle: 120 } },
      ],
      'm2_2_starter'
    ),
    variations: [
      {
        id: '2.2-mountain-roof',
        title: 'Mountain Peak & Roof',
        icon: '🏔️',
        workspace: buildModule2Workspace(
          [
            { type: 'TURN_RIGHT', params: { angle: 30 } },
            { type: 'FORWARD', params: { length: 100 } },
            { type: 'TURN_RIGHT', params: { angle: 120 } },
            { type: 'FORWARD', params: { length: 100 } },
            { type: 'TURN_LEFT', params: { angle: 60 } },
            { type: 'FORWARD', params: { length: 75 } },
            { type: 'TURN_RIGHT', params: { angle: 60 } },
            { type: 'FORWARD', params: { length: 75 } },
          ],
          'm2_2_mountain'
        ),
      },
      {
        id: '2.2-tilted-diamond',
        title: 'Tilted Diamond (60°/120°)',
        icon: '🔷',
        workspace: buildModule2Workspace(
          [
            { type: 'TURN_RIGHT', params: { angle: 30 } },
            { type: 'FORWARD', params: { length: 100 } },
            { type: 'TURN_RIGHT', params: { angle: 60 } },
            { type: 'FORWARD', params: { length: 100 } },
            { type: 'TURN_RIGHT', params: { angle: 120 } },
            { type: 'FORWARD', params: { length: 100 } },
            { type: 'TURN_RIGHT', params: { angle: 60 } },
            { type: 'FORWARD', params: { length: 100 } },
          ],
          'm2_2_diamond'
        ),
      },
      {
        id: '2.2-hexagon-dish',
        title: 'Open Hexagon Dish',
        icon: '🥣',
        workspace: buildModule2Workspace(
          [
            { type: 'TURN_RIGHT', params: { angle: 180 } },
            { type: 'FORWARD', params: { length: 75 } },
            { type: 'TURN_LEFT', params: { angle: 60 } },
            { type: 'FORWARD', params: { length: 75 } },
            { type: 'TURN_LEFT', params: { angle: 60 } },
            { type: 'FORWARD', params: { length: 75 } },
            { type: 'TURN_LEFT', params: { angle: 60 } },
            { type: 'FORWARD', params: { length: 75 } },
          ],
          'm2_2_dish'
        ),
      },
    ],
  },

  // =========================================================================
  // 2.3 [🐢 Sandbox]: Persistent Style State (Pen Color & Pen Width)
  // =========================================================================
  {
    id: '2.3',
    moduleId: 'module-2',
    version: 1,
    format: 'sandbox',
    simId: 'turtle',
    icon: '🎨',
    title: 'Persistent Style State (Pen Color & Width)',
    concept: 'Persistent Style State Across Multiple Strokes',
    description:
      'Set Pen Color and Set Pen Width stay active for every line the turtle draws until you change them again.',
    hint: 'Watch how the starter sets thick Cyan once and draws two parallel strokes before switching color, then try the Rainbow Ladder, Tree, or Tricolor Triangle!',
    palette: {
      allowedSimBlocks: [
        'FORWARD',
        'BACKWARD',
        'TURN_LEFT',
        'TURN_RIGHT',
        'PEN_UP',
        'PEN_DOWN',
        'SET_PEN_COLOR',
        'SET_PEN_WIDTH',
      ],
      allowedControlBlocks: [],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: true,
      allowVariables: false,
    },
    starterWorkspace: buildModule2Workspace(
      [
        { type: 'FORWARD', params: { length: 100 } },
        { type: 'TURN_RIGHT', params: { angle: 90 } },
        { type: 'FORWARD', params: { length: 50 } },
        { type: 'TURN_RIGHT', params: { angle: 90 } },
        { type: 'SET_PEN_COLOR', params: { color: '#06b6d4' } },
        { type: 'SET_PEN_WIDTH', params: { width: 12 } },
        { type: 'FORWARD', params: { length: 100 } },
        { type: 'TURN_LEFT', params: { angle: 90 } },
        { type: 'FORWARD', params: { length: 50 } },
        { type: 'TURN_LEFT', params: { angle: 90 } },
        { type: 'FORWARD', params: { length: 100 } },
      ],
      'm2_3_starter'
    ),
    variations: [
      {
        id: '2.3-rainbow-ladder',
        title: 'Rainbow Ladder',
        icon: '🌈',
        workspace: buildModule2Workspace(
          [
            { type: 'SET_PEN_WIDTH', params: { width: 8 } },
            { type: 'SET_PEN_COLOR', params: { color: '#ef4444' } },
            { type: 'TURN_RIGHT', params: { angle: 90 } },
            { type: 'FORWARD', params: { length: 75 } },
            { type: 'TURN_LEFT', params: { angle: 90 } },
            { type: 'FORWARD', params: { length: 50 } },
            { type: 'SET_PEN_COLOR', params: { color: '#f59e0b' } },
            { type: 'TURN_LEFT', params: { angle: 90 } },
            { type: 'FORWARD', params: { length: 75 } },
            { type: 'TURN_RIGHT', params: { angle: 90 } },
            { type: 'SET_PEN_COLOR', params: { color: '#10b981' } },
            { type: 'FORWARD', params: { length: 50 } },
          ],
          'm2_3_ladder'
        ),
      },
      {
        id: '2.3-trunk-twigs',
        title: 'Thick Trunk & Green Twigs',
        icon: '🌳',
        workspace: buildModule2Workspace(
          [
            { type: 'SET_PEN_COLOR', params: { color: '#f59e0b' } },
            { type: 'SET_PEN_WIDTH', params: { width: 16 } },
            { type: 'FORWARD', params: { length: 100 } },
            { type: 'SET_PEN_COLOR', params: { color: '#10b981' } },
            { type: 'SET_PEN_WIDTH', params: { width: 4 } },
            { type: 'TURN_LEFT', params: { angle: 45 } },
            { type: 'FORWARD', params: { length: 75 } },
            { type: 'BACKWARD', params: { length: 75 } },
            { type: 'TURN_RIGHT', params: { angle: 90 } },
            { type: 'FORWARD', params: { length: 75 } },
          ],
          'm2_3_tree'
        ),
      },
      {
        id: '2.3-tricolor-triangle',
        title: 'Tricolor Triangle',
        icon: '🔺',
        workspace: buildModule2Workspace(
          [
            { type: 'SET_PEN_WIDTH', params: { width: 8 } },
            { type: 'SET_PEN_COLOR', params: { color: '#ef4444' } },
            { type: 'FORWARD', params: { length: 100 } },
            { type: 'TURN_RIGHT', params: { angle: 120 } },
            { type: 'SET_PEN_COLOR', params: { color: '#3b82f6' } },
            { type: 'FORWARD', params: { length: 100 } },
            { type: 'TURN_RIGHT', params: { angle: 120 } },
            { type: 'SET_PEN_COLOR', params: { color: '#10b981' } },
            { type: 'FORWARD', params: { length: 100 } },
          ],
          'm2_3_tricolor'
        ),
      },
    ],
  },

  // =========================================================================
  // 2.4 [🐢 Sandbox]: Multi-Parameter Actions (Arc Radius + Angle)
  // =========================================================================
  {
    id: '2.4',
    moduleId: 'module-2',
    version: 1,
    format: 'sandbox',
    simId: 'turtle',
    icon: '〰️',
    title: 'Multi-Parameter Actions (Arc Radius + Angle)',
    concept: 'Coordinating Two Independent Parameters on One Action Block',
    description:
      'Arc Left and Arc Right carry two badges side-by-side: Radius sets how wide the curve bends, and Angle sets how far around the circle the turtle glides.',
    hint: 'Tap the first badge on an Arc block to change its curve radius (25..150) and the second badge to change its sweep angle (30°..360°).',
    palette: {
      allowedSimBlocks: [
        'FORWARD',
        'BACKWARD',
        'TURN_LEFT',
        'TURN_RIGHT',
        'PEN_UP',
        'PEN_DOWN',
        'SET_PEN_COLOR',
        'SET_PEN_WIDTH',
        'ARC_LEFT',
        'ARC_RIGHT',
      ],
      allowedControlBlocks: [],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: true,
      allowVariables: false,
    },
    starterWorkspace: buildModule2Workspace(
      [
        { type: 'SET_PEN_COLOR', params: { color: '#ec4899' } },
        { type: 'SET_PEN_WIDTH', params: { width: 8 } },
        { type: 'TURN_LEFT', params: { angle: 45 } },
        { type: 'FORWARD', params: { length: 100 } },
        { type: 'ARC_RIGHT', params: { radius: 50, angle: 180 } },
        { type: 'TURN_LEFT', params: { angle: 90 } },
        { type: 'ARC_RIGHT', params: { radius: 50, angle: 180 } },
        { type: 'FORWARD', params: { length: 100 } },
      ],
      'm2_4_starter'
    ),
    variations: [
      {
        id: '2.4-ocean-wave',
        title: 'Wavy Ocean Line',
        icon: '🌊',
        workspace: buildModule2Workspace(
          [
            { type: 'SET_PEN_COLOR', params: { color: '#06b6d4' } },
            { type: 'SET_PEN_WIDTH', params: { width: 8 } },
            { type: 'ARC_RIGHT', params: { radius: 50, angle: 180 } },
            { type: 'ARC_LEFT', params: { radius: 50, angle: 180 } },
            { type: 'ARC_RIGHT', params: { radius: 50, angle: 180 } },
            { type: 'ARC_LEFT', params: { radius: 50, angle: 180 } },
          ],
          'm2_4_wave'
        ),
      },
      {
        id: '2.4-snowman',
        title: '3-Radius Snowman (25, 50, 75)',
        icon: '⛄',
        workspace: buildModule2Workspace(
          [
            { type: 'SET_PEN_COLOR', params: { color: '#3b82f6' } },
            { type: 'SET_PEN_WIDTH', params: { width: 6 } },
            { type: 'TURN_RIGHT', params: { angle: 90 } },
            { type: 'ARC_LEFT', params: { radius: 25, angle: 360 } },
            { type: 'ARC_RIGHT', params: { radius: 50, angle: 180 } },
            { type: 'ARC_LEFT', params: { radius: 75, angle: 360 } },
            { type: 'ARC_RIGHT', params: { radius: 50, angle: 180 } },
          ],
          'm2_4_snowman'
        ),
      },
      {
        id: '2.4-rainbow-arches',
        title: 'Nested Rainbow Arches',
        icon: '🌈',
        workspace: buildModule2Workspace(
          [
            { type: 'SET_PEN_COLOR', params: { color: '#ef4444' } },
            { type: 'ARC_RIGHT', params: { radius: 100, angle: 180 } },
            { type: 'TURN_RIGHT', params: { angle: 90 } },
            { type: 'FORWARD', params: { length: 25 } },
            { type: 'TURN_RIGHT', params: { angle: 90 } },
            { type: 'SET_PEN_COLOR', params: { color: '#f59e0b' } },
            { type: 'ARC_LEFT', params: { radius: 75, angle: 180 } },
            { type: 'TURN_LEFT', params: { angle: 90 } },
            { type: 'FORWARD', params: { length: 25 } },
            { type: 'TURN_LEFT', params: { angle: 90 } },
            { type: 'SET_PEN_COLOR', params: { color: '#10b981' } },
            { type: 'ARC_RIGHT', params: { radius: 50, angle: 180 } },
          ],
          'm2_4_arches'
        ),
      },
    ],
  },

  // =========================================================================
  // 2.5 [🎵 Sandbox]: Pitch, Duration & Colored LED Rows
  // =========================================================================
  {
    id: '2.5',
    moduleId: 'module-2',
    version: 1,
    format: 'sandbox',
    simId: 'beat',
    icon: '🎵',
    title: 'Pitch, Duration & Colored LED Rows',
    concept: 'Musical Note Pitch (1..8), Beat Duration (½|1|2) & Colored LED Matrix Lines',
    description:
      'Play Note combines a stepped Pitch scale badge (1..8) with a Beat Duration badge (½, 1, or 2 beats), while Set LED Color paints rows, columns, pixels, and stamps.',
    hint: 'Press Play to hear the 4-note melody light up colored rows, preview each Variation Card with ▶, or tap any Pitch, Duration, or Color badge to compose your own tune!',
    palette: {
      allowedSimBlocks: [...MODULE_2_BEAT_ALLOWED_BLOCKS],
      allowedControlBlocks: [],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: true,
      allowVariables: false,
    },
    starterWorkspace: buildModule2Workspace(
      [
        { type: 'SET_LED_COLOR', params: { color: '#06b6d4' } },
        { type: 'LIGHT_ROW', params: { y: 7 } },
        { type: 'PLAY_NOTE', params: { pitch: 1, duration: 0.5 } },
        { type: 'PLAY_NOTE', params: { pitch: 3, duration: 0.5 } },
        { type: 'SET_LED_COLOR', params: { color: '#fbbf24' } },
        { type: 'LIGHT_ROW', params: { y: 4 } },
        { type: 'PLAY_NOTE', params: { pitch: 5, duration: 1 } },
        { type: 'SET_LED_COLOR', params: { color: '#f43f5e' } },
        { type: 'LIGHT_ROW', params: { y: 1 } },
        { type: 'PLAY_NOTE', params: { pitch: 8, duration: 2 } },
      ],
      'm2_5_starter'
    ),
    variations: [
      {
        id: '2.5-doorbell-chime',
        title: 'Doorbell Chime',
        icon: '🔔',
        workspace: buildModule2Workspace(
          [
            { type: 'SET_LED_COLOR', params: { color: '#fbbf24' } },
            { type: 'STAMP_PRESET', params: { preset: 'NOTE' } },
            { type: 'PLAY_NOTE', params: { pitch: 5, duration: 1 } },
            { type: 'SET_LED_COLOR', params: { color: '#06b6d4' } },
            { type: 'LIGHT_ROW', params: { y: 1 } },
            { type: 'LIGHT_ROW', params: { y: 8 } },
            { type: 'PLAY_NOTE', params: { pitch: 3, duration: 2 } },
          ],
          'm2_5_doorbell'
        ),
      },
      {
        id: '2.5-traffic-countdown',
        title: 'Traffic-Light Countdown',
        icon: '🚦',
        workspace: buildModule2Workspace(
          [
            { type: 'SET_LED_COLOR', params: { color: '#f43f5e' } },
            { type: 'LIGHT_ROW', params: { y: 2 } },
            { type: 'PLAY_NOTE', params: { pitch: 2, duration: 1 } },
            { type: 'SET_LED_COLOR', params: { color: '#fbbf24' } },
            { type: 'LIGHT_ROW', params: { y: 5 } },
            { type: 'PLAY_NOTE', params: { pitch: 4, duration: 1 } },
            { type: 'SET_LED_COLOR', params: { color: '#10b981' } },
            { type: 'LIGHT_ROW', params: { y: 8 } },
            { type: 'PLAY_NOTE', params: { pitch: 8, duration: 2 } },
          ],
          'm2_5_traffic'
        ),
      },
      {
        id: '2.5-rising-bassline',
        title: 'Rising Color Bar & Bassline',
        icon: '📊',
        workspace: buildModule2Workspace(
          [
            { type: 'DRUM_KICK', repeatCount: 2 },
            { type: 'SET_LED_COLOR', params: { color: '#3b82f6' } },
            { type: 'LIGHT_COL', params: { x: 2 } },
            { type: 'PLAY_NOTE', params: { pitch: 1, duration: 0.5 } },
            { type: 'SET_LED_COLOR', params: { color: '#a855f7' } },
            { type: 'LIGHT_COL', params: { x: 5 } },
            { type: 'PLAY_NOTE', params: { pitch: 5, duration: 0.5 } },
            { type: 'SET_LED_COLOR', params: { color: '#ec4899' } },
            { type: 'LIGHT_COL', params: { x: 8 } },
            { type: 'PLAY_NOTE', params: { pitch: 8, duration: 2 } },
          ],
          'm2_5_bassline'
        ),
      },
    ],
  },

  // =========================================================================
  // 2B [🎨 🐢 Capstone]: Emblem & Emoji Studio
  // =========================================================================
  {
    id: '2B',
    moduleId: 'module-2',
    version: 1,
    format: 'capstone',
    capstoneType: 'creative',
    simId: 'turtle',
    icon: '🎨',
    title: 'Emblem & Emoji Studio',
    concept: 'Creative Synthesis — Parameterized Lines, Angles, Colors, Widths & Arcs',
    description:
      'Combine custom line lengths, angles, pen colors, stroke widths, Pen Up jumps, and circular arcs to design your own colorful emblem or emoji!',
    hint: 'Run the starter ribbon medal, explore the Winking Emoji, Curved-Petal Flower, or Bullseye Shield cards, and customize colors and radii to craft your signature badge.',
    palette: {
      allowedSimBlocks: [
        'FORWARD',
        'BACKWARD',
        'TURN_LEFT',
        'TURN_RIGHT',
        'ARC_LEFT',
        'ARC_RIGHT',
        'PEN_UP',
        'PEN_DOWN',
        'SET_PEN_COLOR',
        'SET_PEN_WIDTH',
      ],
      allowedControlBlocks: [],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: true,
      allowVariables: false,
    },
    starterWorkspace: buildModule2Workspace(
      [
        { type: 'SET_PEN_COLOR', params: { color: '#3b82f6' } },
        { type: 'SET_PEN_WIDTH', params: { width: 8 } },
        { type: 'TURN_LEFT', params: { angle: 30 } },
        { type: 'FORWARD', params: { length: 100 } },
        { type: 'BACKWARD', params: { length: 100 } },
        { type: 'TURN_RIGHT', params: { angle: 60 } },
        { type: 'FORWARD', params: { length: 100 } },
        { type: 'BACKWARD', params: { length: 100 } },
        { type: 'TURN_RIGHT', params: { angle: 60 } },
        { type: 'SET_PEN_COLOR', params: { color: '#f59e0b' } },
        { type: 'SET_PEN_WIDTH', params: { width: 16 } },
        { type: 'ARC_RIGHT', params: { radius: 50, angle: 360 } },
      ],
      'm2_2b_starter'
    ),
    variations: [
      {
        id: '2B-winking-emoji',
        title: 'Winking Emoji',
        icon: '😉',
        workspace: buildModule2Workspace(
          [
            // Outer face circle centered at (100, 0), radius 100
            { type: 'SET_PEN_COLOR', params: { color: '#f59e0b' } },
            { type: 'SET_PEN_WIDTH', params: { width: 12 } },
            { type: 'ARC_RIGHT', params: { radius: 100, angle: 360 } },
            // Reposition to (25, 0) facing South (180°) and draw smile arc to (175, 0)
            { type: 'PEN_UP' },
            { type: 'TURN_RIGHT', params: { angle: 90 } },
            { type: 'FORWARD', params: { length: 25 } },
            { type: 'TURN_RIGHT', params: { angle: 90 } },
            { type: 'SET_PEN_COLOR', params: { color: '#0f172a' } },
            { type: 'SET_PEN_WIDTH', params: { width: 8 } },
            { type: 'PEN_DOWN' },
            { type: 'ARC_LEFT', params: { radius: 75, angle: 180 } },
            // Step up to (175, -25) facing North (0°) and draw right winking eye arch (175,-25)->(125,-25)
            { type: 'PEN_UP' },
            { type: 'FORWARD', params: { length: 25 } },
            { type: 'PEN_DOWN' },
            { type: 'ARC_LEFT', params: { radius: 25, angle: 180 } },
            // Reposition across to (50, -25) facing North (0°) and draw bold left open eye
            { type: 'PEN_UP' },
            { type: 'TURN_RIGHT', params: { angle: 90 } },
            { type: 'FORWARD', params: { length: 75 } },
            { type: 'TURN_RIGHT', params: { angle: 90 } },
            { type: 'SET_PEN_WIDTH', params: { width: 16 } },
            { type: 'PEN_DOWN' },
            { type: 'FORWARD', params: { length: 25 } },
          ],
          'm2_2b_emoji'
        ),
      },
      {
        id: '2B-curved-flower',
        title: 'Curved-Petal Flower',
        icon: '🌸',
        workspace: buildModule2Workspace(
          [
            { type: 'SET_PEN_COLOR', params: { color: '#10b981' } },
            { type: 'SET_PEN_WIDTH', params: { width: 8 } },
            { type: 'FORWARD', params: { length: 100 } },
            { type: 'SET_PEN_COLOR', params: { color: '#ec4899' } },
            { type: 'ARC_RIGHT', params: { radius: 50, angle: 90 } },
            { type: 'TURN_RIGHT', params: { angle: 90 } },
            { type: 'ARC_RIGHT', params: { radius: 50, angle: 90 } },
            { type: 'SET_PEN_COLOR', params: { color: '#8b5cf6' } },
            { type: 'ARC_RIGHT', params: { radius: 50, angle: 90 } },
            { type: 'TURN_RIGHT', params: { angle: 90 } },
            { type: 'ARC_RIGHT', params: { radius: 50, angle: 90 } },
            { type: 'SET_PEN_COLOR', params: { color: '#f59e0b' } },
            { type: 'SET_PEN_WIDTH', params: { width: 12 } },
            { type: 'ARC_LEFT', params: { radius: 25, angle: 360 } },
          ],
          'm2_2b_flower'
        ),
      },
      {
        id: '2B-bullseye-shield',
        title: 'Bullseye Shield',
        icon: '🛡️',
        workspace: buildModule2Workspace(
          [
            // Outer blue ring (R=75) centered at (75, 0)
            { type: 'SET_PEN_WIDTH', params: { width: 12 } },
            { type: 'SET_PEN_COLOR', params: { color: '#3b82f6' } },
            { type: 'ARC_RIGHT', params: { radius: 75, angle: 360 } },
            // Step 25px inward to (25, 0) facing North and draw concentric middle red ring (R=50, center (75, 0))
            { type: 'PEN_UP' },
            { type: 'TURN_RIGHT', params: { angle: 90 } },
            { type: 'FORWARD', params: { length: 25 } },
            { type: 'TURN_LEFT', params: { angle: 90 } },
            { type: 'SET_PEN_COLOR', params: { color: '#ef4444' } },
            { type: 'PEN_DOWN' },
            { type: 'ARC_RIGHT', params: { radius: 50, angle: 360 } },
            // Step 25px inward to (50, 0) facing North and draw concentric inner gold bullseye (R=25, center (75, 0))
            { type: 'PEN_UP' },
            { type: 'TURN_RIGHT', params: { angle: 90 } },
            { type: 'FORWARD', params: { length: 25 } },
            { type: 'TURN_LEFT', params: { angle: 90 } },
            { type: 'SET_PEN_COLOR', params: { color: '#f59e0b' } },
            { type: 'PEN_DOWN' },
            { type: 'ARC_RIGHT', params: { radius: 25, angle: 360 } },
          ],
          'm2_2b_shield'
        ),
      },
    ],
  },
];
