import { WorkspaceState } from '../../types';
import { MODULE_2_BEAT_ALLOWED_BLOCKS } from './module2Params';
import { CurriculumActivity, createCurriculumBlock } from './types';

/**
 * Tier 3 Beat & Light Matrix blocks exposed in Module 3 (`3.4`, `3.4a`, and Capstone `3C`):
 * All Module 2 Beat blocks plus `SET_BEAT_DELAY`, `CURSOR_STEP`, and `CURSOR_TURN`.
 */
export const MODULE_3_BEAT_ALLOWED_BLOCKS: string[] = [
  ...MODULE_2_BEAT_ALLOWED_BLOCKS,
  'SET_BEAT_DELAY',
  'CURSOR_STEP',
  'CURSOR_TURN',
];

interface BeatBlockSpec {
  type: string;
  repeatCount?: number;
  params?: Record<string, any>;
}

function buildModule3BeatWorkspace(specs: BeatBlockSpec[], idPrefix: string): WorkspaceState {
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

/**
 * Module 3 Beat & Light Matrix Rhythm Loops & LED Cursor lesson (`3.4`).
 */
export const MODULE_3_BEAT_ACTIVITIES: CurriculumActivity[] = [
  {
    id: '3.4',
    moduleId: 'module-3',
    version: 2,
    format: 'sandbox',
    simId: 'beat',
    icon: '🎵',
    title: 'Rhythm Loops & Chasing Border LEDs',
    concept: 'Audio-Visual Ostinato Loops & Chasing Perimeter LED Cursor',
    description:
      'Wrap drum hits, synth notes, and the new Step LED Cursor and Turn LED Cursor blocks inside a Loop to chase glowing lights around the 8x8 pad in time with the beat.',
    hint: 'Press Play to watch Loop x4 chase all 28 border LEDs around the 8x8 pad, tap Play inside each Variation Card to preview grooves (including an Instant Frame Beacon), or remix colors, notes, and turns!',
    palette: {
      allowedSimBlocks: [...MODULE_3_BEAT_ALLOWED_BLOCKS],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END'],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: true,
      allowVariables: false,
    },
    starterWorkspace: buildModule3BeatWorkspace(
      [
        { type: 'SET_LED_COLOR', params: { color: '#06b6d4' } },
        { type: 'LOOP_START', repeatCount: 4 },
        { type: 'DRUM_KICK' },
        { type: 'CURSOR_STEP', repeatCount: 7 },
        { type: 'DRUM_SNARE' },
        { type: 'CURSOR_TURN', params: { direction: 'RIGHT' } },
        { type: 'LOOP_END' },
        { type: 'PLAY_CHIME' },
      ],
      'm3_4_starter'
    ),
    variations: [
      {
        id: '3.4-clap-ostinato',
        title: 'Syncopated Clap Ostinato',
        icon: '👏',
        workspace: buildModule3BeatWorkspace(
          [
            { type: 'SET_LED_COLOR', params: { color: '#ec4899' } },
            { type: 'LOOP_START', repeatCount: 4 },
            { type: 'DRUM_KICK' },
            { type: 'CURSOR_STEP', repeatCount: 3 },
            { type: 'DRUM_CLAP', repeatCount: 2 },
            { type: 'CURSOR_STEP', repeatCount: 4 },
            { type: 'CURSOR_TURN', params: { direction: 'RIGHT' } },
            { type: 'LOOP_END' },
          ],
          'm3_4_clap_ostinato'
        ),
      },
      {
        id: '3.4-two-color-border',
        title: 'Two-Color Border Flash',
        icon: '🌈',
        workspace: buildModule3BeatWorkspace(
          [
            { type: 'LOOP_START', repeatCount: 2 },
            { type: 'SET_LED_COLOR', params: { color: '#fbbf24' } },
            { type: 'PLAY_NOTE', params: { pitch: 5, duration: 0.5 } },
            { type: 'CURSOR_STEP', repeatCount: 7 },
            { type: 'CURSOR_TURN', params: { direction: 'RIGHT' } },
            { type: 'SET_LED_COLOR', params: { color: '#a855f7' } },
            { type: 'PLAY_NOTE', params: { pitch: 8, duration: 0.5 } },
            { type: 'CURSOR_STEP', repeatCount: 7 },
            { type: 'CURSOR_TURN', params: { direction: 'RIGHT' } },
            { type: 'DRUM_SNARE' },
            { type: 'LOOP_END' },
          ],
          'm3_4_two_color_border'
        ),
      },
      {
        id: '3.4-marquee-chase',
        title: 'Marquee Chase Lights',
        icon: '✨',
        workspace: buildModule3BeatWorkspace(
          [
            { type: 'SET_LED_COLOR', params: { color: '#10b981' } },
            { type: 'LOOP_START', repeatCount: 4 },
            { type: 'DRUM_KICK' },
            { type: 'CURSOR_STEP', repeatCount: 2 },
            { type: 'PLAY_NOTE', params: { pitch: 3, duration: 0.5 } },
            { type: 'CURSOR_TURN', params: { direction: 'RIGHT' } },
            { type: 'CURSOR_STEP', repeatCount: 2 },
            { type: 'DRUM_CLAP' },
            { type: 'CURSOR_TURN', params: { direction: 'LEFT' } },
            { type: 'LOOP_END' },
          ],
          'm3_4_marquee_chase'
        ),
      },
      {
        id: '3.4-instant-beacon',
        title: 'Instant Frame Beacon',
        icon: '🚨',
        workspace: buildModule3BeatWorkspace(
          [
            { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
            { type: 'LOOP_START', repeatCount: 4 },
            { type: 'CLEAR_LEDS' },
            { type: 'SET_LED_COLOR', params: { color: '#fbbf24' } },
            { type: 'STAMP_PRESET', params: { preset: 'STAR' } },
            { type: 'SET_LED_COLOR', params: { color: '#ffffff' } },
            { type: 'LIGHT_ROW', params: { y: 1 } },
            { type: 'DRUM_KICK' },
            { type: 'WAIT_BEAT', params: { duration: 0.5 } },
            { type: 'LOOP_END' },
          ],
          'm3_4_instant_beacon'
        ),
      },
    ],
    historicalVersions: {
      1: {
        version: 1,
        archivedNote: 'v1 included 3 static/stepped border chase variations',
        palette: {
          allowedSimBlocks: [...MODULE_3_BEAT_ALLOWED_BLOCKS],
          allowedControlBlocks: ['LOOP_START', 'LOOP_END'],
          allowedScopes: ['MAIN'],
          allowRepeatBadges: true,
          allowActionParams: true,
          allowVariables: false,
        },
        starterWorkspace: buildModule3BeatWorkspace(
          [
            { type: 'SET_LED_COLOR', params: { color: '#06b6d4' } },
            { type: 'LOOP_START', repeatCount: 4 },
            { type: 'DRUM_KICK' },
            { type: 'CURSOR_STEP', repeatCount: 7 },
            { type: 'DRUM_SNARE' },
            { type: 'CURSOR_TURN', params: { direction: 'RIGHT' } },
            { type: 'LOOP_END' },
            { type: 'PLAY_CHIME' },
          ],
          'm3_4_starter'
        ),
        variations: [
          {
            id: '3.4-clap-ostinato',
            title: 'Syncopated Clap Ostinato',
            icon: '👏',
            workspace: buildModule3BeatWorkspace(
              [
                { type: 'SET_LED_COLOR', params: { color: '#ec4899' } },
                { type: 'LOOP_START', repeatCount: 4 },
                { type: 'DRUM_KICK' },
                { type: 'CURSOR_STEP', repeatCount: 3 },
                { type: 'DRUM_CLAP', repeatCount: 2 },
                { type: 'CURSOR_STEP', repeatCount: 4 },
                { type: 'CURSOR_TURN', params: { direction: 'RIGHT' } },
                { type: 'LOOP_END' },
              ],
              'm3_4_clap_ostinato'
            ),
          },
          {
            id: '3.4-two-color-border',
            title: 'Two-Color Border Flash',
            icon: '🌈',
            workspace: buildModule3BeatWorkspace(
              [
                { type: 'LOOP_START', repeatCount: 2 },
                { type: 'SET_LED_COLOR', params: { color: '#fbbf24' } },
                { type: 'PLAY_NOTE', params: { pitch: 5, duration: 0.5 } },
                { type: 'CURSOR_STEP', repeatCount: 7 },
                { type: 'CURSOR_TURN', params: { direction: 'RIGHT' } },
                { type: 'SET_LED_COLOR', params: { color: '#a855f7' } },
                { type: 'PLAY_NOTE', params: { pitch: 8, duration: 0.5 } },
                { type: 'CURSOR_STEP', repeatCount: 7 },
                { type: 'CURSOR_TURN', params: { direction: 'RIGHT' } },
                { type: 'DRUM_SNARE' },
                { type: 'LOOP_END' },
              ],
              'm3_4_two_color_border'
            ),
          },
          {
            id: '3.4-marquee-chase',
            title: 'Marquee Chase Lights',
            icon: '✨',
            workspace: buildModule3BeatWorkspace(
              [
                { type: 'SET_LED_COLOR', params: { color: '#10b981' } },
                { type: 'LOOP_START', repeatCount: 4 },
                { type: 'DRUM_KICK' },
                { type: 'CURSOR_STEP', repeatCount: 2 },
                { type: 'PLAY_NOTE', params: { pitch: 3, duration: 0.5 } },
                { type: 'CURSOR_TURN', params: { direction: 'RIGHT' } },
                { type: 'CURSOR_STEP', repeatCount: 2 },
                { type: 'DRUM_CLAP' },
                { type: 'CURSOR_TURN', params: { direction: 'LEFT' } },
                { type: 'LOOP_END' },
              ],
              'm3_4_marquee_chase'
            ),
          },
        ],
      },
    },
  },
  {
    id: '3.4a',
    moduleId: 'module-3',
    version: 1,
    format: 'sandbox',
    simId: 'beat',
    icon: '🎵',
    defaultLoopPlayback: true,
    title: 'LED Rain & Smooth Frame Loops',
    concept: 'Animating Clean 8×8 LED Pictures with Clear LEDs, Set Step Delay (0), and Wait',
    description:
      'Put Clear LEDs at the top of your loop with Step Delay set to Instant so whole light-matrix frames snap cleanly in rhythm without flickering!',
    hint: 'Loop Playback starts ON automatically! Tap Play to watch the LED raindrop cascade, or preview any of the 4 animated frame cards.',
    palette: {
      allowedSimBlocks: [...MODULE_3_BEAT_ALLOWED_BLOCKS],
      allowedControlBlocks: ['LOOP_START', 'LOOP_END'],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: true,
      allowVariables: false,
    },
    starterWorkspace: buildModule3BeatWorkspace(
      [
        { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
        { type: 'LOOP_START', repeatCount: 4 },
        { type: 'CLEAR_LEDS' },
        { type: 'SET_LED_COLOR', params: { color: '#06b6d4' } },
        { type: 'LIGHT_ROW', params: { y: 2 } },
        { type: 'LIGHT_ROW', params: { y: 5 } },
        { type: 'SET_LED_COLOR', params: { color: '#0f172a' } },
        { type: 'LIGHT_COL', params: { x: 4 } },
        { type: 'SET_LED_COLOR', params: { color: '#ffffff' } },
        { type: 'LIGHT_PIXEL', params: { x: 4, y: 8 } },
        { type: 'PLAY_NOTE', params: { pitch: 5, duration: 0.5 } },
        { type: 'WAIT_BEAT', params: { duration: 0.5 } },
        { type: 'LOOP_END' },
      ],
      'm3_4a_starter'
    ),
    variations: [
      {
        id: '3.4a-shooting-star',
        title: 'Twinkling White Star',
        icon: '🌠',
        workspace: buildModule3BeatWorkspace(
          [
            { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
            { type: 'LOOP_START', repeatCount: 4 },
            { type: 'CLEAR_LEDS' },
            { type: 'SET_LED_COLOR', params: { color: '#fbbf24' } },
            { type: 'STAMP_PRESET', params: { preset: 'STAR' } },
            { type: 'SET_LED_COLOR', params: { color: '#ffffff' } },
            { type: 'LIGHT_PIXEL', params: { x: 1, y: 1 } },
            { type: 'LIGHT_PIXEL', params: { x: 8, y: 1 } },
            { type: 'PLAY_CHIME' },
            { type: 'WAIT_BEAT', params: { duration: 0.5 } },
            { type: 'LOOP_END' },
          ],
          'm3_4a_star'
        ),
      },
      {
        id: '3.4a-blinking-eyes',
        title: 'Heart Cutout Pulse',
        icon: '💗',
        workspace: buildModule3BeatWorkspace(
          [
            { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
            { type: 'LOOP_START', repeatCount: 4 },
            { type: 'CLEAR_LEDS' },
            { type: 'SET_LED_COLOR', params: { color: '#f43f5e' } },
            { type: 'STAMP_PRESET', params: { preset: 'HEART' } },
            { type: 'SET_LED_COLOR', params: { color: '#0f172a' } },
            { type: 'LIGHT_PIXEL', params: { x: 4, y: 4 } },
            { type: 'LIGHT_PIXEL', params: { x: 5, y: 4 } },
            { type: 'DRUM_KICK' },
            { type: 'WAIT_BEAT', params: { duration: 0.5 } },
            { type: 'LOOP_END' },
          ],
          'm3_4a_heart'
        ),
      },
      {
        id: '3.4a-equalizer-bars',
        title: 'Equalizer Frame Sweep',
        icon: '📊',
        workspace: buildModule3BeatWorkspace(
          [
            { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
            { type: 'LOOP_START', repeatCount: 4 },
            { type: 'CLEAR_LEDS' },
            { type: 'SET_LED_COLOR', params: { color: '#10b981' } },
            { type: 'LIGHT_COL', params: { x: 2 } },
            { type: 'LIGHT_COL', params: { x: 7 } },
            { type: 'SET_LED_COLOR', params: { color: '#a855f7' } },
            { type: 'LIGHT_COL', params: { x: 4 } },
            { type: 'LIGHT_COL', params: { x: 5 } },
            { type: 'DRUM_CLAP' },
            { type: 'WAIT_BEAT', params: { duration: 0.5 } },
            { type: 'LOOP_END' },
          ],
          'm3_4a_equalizer'
        ),
      },
      {
        id: '3.4a-cursor-flash',
        title: 'Cursor Frame Runner',
        icon: '⚡',
        workspace: buildModule3BeatWorkspace(
          [
            { type: 'SET_BEAT_DELAY', params: { delay: 0 } },
            { type: 'LOOP_START', repeatCount: 4 },
            { type: 'CLEAR_LEDS' },
            { type: 'SET_LED_COLOR', params: { color: '#38bdf8' } },
            { type: 'CURSOR_STEP', repeatCount: 4 },
            { type: 'CURSOR_TURN', params: { direction: 'RIGHT' } },
            { type: 'PLAY_NOTE', params: { pitch: 3, duration: 0.5 } },
            { type: 'WAIT_BEAT', params: { duration: 0.5 } },
            { type: 'LOOP_END' },
          ],
          'm3_4a_cursor'
        ),
      },
    ],
  },
];
