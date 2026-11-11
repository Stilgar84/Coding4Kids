import { WorkspaceState } from '../../types';
import { CurriculumActivity, createCurriculumBlock } from './types';

/**
 * Tier 1 parameterless Beat & Light Matrix blocks exposed in Module 1 (`1.8` and Capstone `1C`).
 */
export const MODULE_1_BEAT_ALLOWED_BLOCKS: string[] = [
  'DRUM_KICK',
  'DRUM_SNARE',
  'DRUM_CLAP',
  'PLAY_CHIME',
  'STAMP_HEART',
  'STAMP_STAR',
  'STAMP_SMILE',
  'WAIT_BEAT',
  'CLEAR_LEDS',
];

function buildBeatWorkspace(types: string[], idPrefix: string): WorkspaceState {
  return {
    MAIN: types.map((type, idx) =>
      createCurriculumBlock(type, undefined, undefined, `${idPrefix}_${idx + 1}`)
    ),
    F1: [],
    F2: [],
    F3: [],
  };
}

/**
 * Module 1 Beat & Light Matrix creative activities (`1.8` and Creative Capstone `1C`).
 * All Module 1 Beat activities use parameterless Tier 1 percussion, chime, 8x8 icon stamp,
 * beat-wait, and LED-clear blocks (`allowRepeatBadges: false`, `allowActionParams: false`,
 * `allowVariables: false`, `allowedControlBlocks: []`, `allowedScopes: ['MAIN']`).
 */
export const MODULE_1_BEAT_ACTIVITIES: CurriculumActivity[] = [
  {
    id: '1.8',
    moduleId: 'module-1',
    version: 1,
    format: 'sandbox',
    simId: 'beat',
    icon: '🎵',
    title: 'Meet Beat & Light — Drum Pads & Icon Stamps',
    concept: 'Audio-Visual Sequencing (Drum Hits, LED Icon Stamps & Beat Rests)',
    description:
      'Sequence punchy drum hits, bright bell chimes, and glowing 8x8 pixel icon stamps top-to-bottom on the Beat & Light pad.',
    hint: 'Press Play on the starter groove, tap Play inside each Variation Card to listen and watch, or load any card to remix your own beat.',
    palette: {
      allowedSimBlocks: [...MODULE_1_BEAT_ALLOWED_BLOCKS],
      allowedControlBlocks: [],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: false,
      allowActionParams: false,
      allowVariables: false,
    },
    starterWorkspace: buildBeatWorkspace(
      [
        'STAMP_HEART',
        'DRUM_KICK',
        'DRUM_SNARE',
        'WAIT_BEAT',
        'STAMP_STAR',
        'DRUM_KICK',
        'DRUM_SNARE',
        'PLAY_CHIME',
      ],
      'm1_8_starter'
    ),
    variations: [
      {
        id: '1.8-rock-smiley',
        title: 'Blinking Smiley Rock',
        icon: '😊',
        workspace: buildBeatWorkspace(
          [
            'STAMP_SMILE',
            'DRUM_KICK',
            'DRUM_SNARE',
            'CLEAR_LEDS',
            'WAIT_BEAT',
            'STAMP_SMILE',
            'DRUM_KICK',
            'DRUM_SNARE',
          ],
          'm1_8_rock_smiley'
        ),
      },
      {
        id: '1.8-chime-fanfare',
        title: 'Starlight Chime Fanfare',
        icon: '🌟',
        workspace: buildBeatWorkspace(
          [
            'STAMP_HEART',
            'PLAY_CHIME',
            'CLEAR_LEDS',
            'STAMP_STAR',
            'PLAY_CHIME',
            'WAIT_BEAT',
            'PLAY_CHIME',
          ],
          'm1_8_chime_fanfare'
        ),
      },
      {
        id: '1.8-clap-stomp',
        title: 'Clap-Clap-Stomp Groove',
        icon: '👏',
        workspace: buildBeatWorkspace(
          [
            'DRUM_KICK',
            'STAMP_HEART',
            'DRUM_CLAP',
            'DRUM_CLAP',
            'DRUM_KICK',
            'STAMP_STAR',
            'DRUM_CLAP',
            'STAMP_HEART',
          ],
          'm1_8_clap_stomp'
        ),
      },
    ],
  },
  {
    id: '1C',
    moduleId: 'module-1',
    version: 1,
    format: 'capstone',
    capstoneType: 'creative',
    simId: 'beat',
    icon: '🎨',
    title: 'Sticker & Beat Intro',
    concept: 'Creative Synthesis — Multi-Frame Sticker Choreography & Rhythm Intro',
    description:
      'Combine Kick, Snare, Clap, Chime, Wait, Clear, and 8x8 Heart, Star, and Smile stamps into an animated sticker-and-beat show.',
    hint: 'Preview all 3 playable variation cards to hear and watch different sticker rhythms, then load one or compose your own finale.',
    palette: {
      allowedSimBlocks: [...MODULE_1_BEAT_ALLOWED_BLOCKS],
      allowedControlBlocks: [],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: false,
      allowActionParams: false,
      allowVariables: false,
    },
    starterWorkspace: buildBeatWorkspace(
      [
        'STAMP_HEART',
        'DRUM_KICK',
        'DRUM_CLAP',
        'STAMP_STAR',
        'DRUM_KICK',
        'DRUM_SNARE',
        'CLEAR_LEDS',
        'WAIT_BEAT',
        'STAMP_SMILE',
        'DRUM_CLAP',
        'PLAY_CHIME',
      ],
      'm1_1c_starter'
    ),
    variations: [
      {
        id: '1C-victory-jingle',
        title: 'Victory Jingle',
        icon: '🏆',
        workspace: buildBeatWorkspace(
          [
            'DRUM_KICK',
            'DRUM_SNARE',
            'STAMP_HEART',
            'PLAY_CHIME',
            'STAMP_SMILE',
            'PLAY_CHIME',
            'CLEAR_LEDS',
            'STAMP_STAR',
            'DRUM_CLAP',
            'PLAY_CHIME',
          ],
          'm1_1c_victory_jingle'
        ),
      },
      {
        id: '1C-winking-dance',
        title: 'Winking Sticker Dance',
        icon: '😉',
        workspace: buildBeatWorkspace(
          [
            'STAMP_SMILE',
            'DRUM_KICK',
            'CLEAR_LEDS',
            'DRUM_CLAP',
            'STAMP_HEART',
            'WAIT_BEAT',
            'DRUM_SNARE',
            'CLEAR_LEDS',
            'STAMP_SMILE',
            'DRUM_KICK',
            'PLAY_CHIME',
          ],
          'm1_1c_winking_dance'
        ),
      },
      {
        id: '1C-countdown-drop',
        title: 'Countdown Drop',
        icon: '🚀',
        workspace: buildBeatWorkspace(
          [
            'STAMP_STAR',
            'DRUM_KICK',
            'WAIT_BEAT',
            'STAMP_SMILE',
            'DRUM_SNARE',
            'WAIT_BEAT',
            'STAMP_HEART',
            'DRUM_CLAP',
            'CLEAR_LEDS',
            'DRUM_KICK',
            'STAMP_HEART',
            'PLAY_CHIME',
          ],
          'm1_1c_countdown_drop'
        ),
      },
    ],
  },
];
