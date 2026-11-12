import {
  Bell,
  Eraser,
  Gauge,
  Heart,
  Hourglass,
  Music,
  Palette,
  Smile,
  Sparkles,
  Stamp,
  Star,
} from 'lucide-react';
import {
  ActionParamDef,
  SimActionResult,
  SimPaletteItem,
  SimulationEnvironment,
} from '../../engine/simulation/types';
import { registerSimulation } from '../../engine/simulation/registry';
import {
  BEAT_GRID_SIZE,
  BEAT_LED_PALETTE,
  BeatPresetName,
  BeatState,
  DEFAULT_BEAT_LED_COLOR,
} from './types';
import {
  BEAT_STAMP_PRESETS,
  cloneLedGrid,
  createEmptyLedGrid,
  createPresetLedGrid,
  getPresetDef,
} from './presets';
import { BeatCanvas } from './components/BeatCanvas';
import { BeatToolbarTools } from './components/BeatToolbarTools';

export function createInitialBeatState(isMuted: boolean = false): BeatState {
  return {
    leds: createEmptyLedGrid(),
    activeColor: DEFAULT_BEAT_LED_COLOR,
    isColorCustomized: false,
    beatIndex: 0,
    stepCount: 0,
    lastTriggeredEvent: null,
    cursor: {
      x: 1,
      y: 1,
      dir: 'EAST',
      visible: false,
    },
    isMuted,
    stepDelayMultiplier: 1,
    status: 'IDLE',
  };
}

export function resetBeatState(state?: BeatState): BeatState {
  return createInitialBeatState(Boolean(state?.isMuted));
}

export const BEAT_PITCH_PARAM_DEF: ActionParamDef = {
  id: 'pitch',
  label: 'Pitch',
  type: 'pitch',
  visualVariant: 'pitch',
  defaultValue: 1,
  options: [
    { value: 1, label: '1' },
    { value: 2, label: '2' },
    { value: 3, label: '3' },
    { value: 4, label: '4' },
    { value: 5, label: '5' },
    { value: 6, label: '6' },
    { value: 7, label: '7' },
    { value: 8, label: '8' },
  ],
};

export const BEAT_DURATION_PARAM_DEF: ActionParamDef = {
  id: 'duration',
  label: 'Beats',
  type: 'duration',
  visualVariant: 'duration',
  defaultValue: 1,
  options: [
    { value: 0.5, label: '½' },
    { value: 1, label: '1' },
    { value: 2, label: '2' },
  ],
};

export const BEAT_COLOR_PARAM_DEF: ActionParamDef = {
  id: 'color',
  label: 'LED Color',
  type: 'color',
  defaultValue: DEFAULT_BEAT_LED_COLOR,
  options: BEAT_LED_PALETTE.map((swatch) => ({
    value: swatch.hex,
    label: swatch.label,
  })),
};

export const BEAT_ROW_PARAM_DEF: ActionParamDef = {
  id: 'y',
  label: 'Row',
  type: 'gridCoord',
  visualVariant: 'row',
  defaultValue: 1,
  options: Array.from({ length: BEAT_GRID_SIZE }, (_, idx) => ({
    value: idx + 1,
    label: `${idx + 1}`,
  })),
};

export const BEAT_COL_PARAM_DEF: ActionParamDef = {
  id: 'x',
  label: 'Column',
  type: 'gridCoord',
  visualVariant: 'col',
  defaultValue: 1,
  options: Array.from({ length: BEAT_GRID_SIZE }, (_, idx) => ({
    value: idx + 1,
    label: `${idx + 1}`,
  })),
};

export const BEAT_PIXEL_X_PARAM_DEF: ActionParamDef = {
  id: 'x',
  label: 'Column',
  type: 'gridCoord',
  visualVariant: 'pixelX',
  defaultValue: 1,
  options: Array.from({ length: BEAT_GRID_SIZE }, (_, idx) => ({
    value: idx + 1,
    label: `${idx + 1}`,
  })),
};

export const BEAT_PIXEL_Y_PARAM_DEF: ActionParamDef = {
  id: 'y',
  label: 'Row',
  type: 'gridCoord',
  visualVariant: 'pixelY',
  defaultValue: 1,
  options: Array.from({ length: BEAT_GRID_SIZE }, (_, idx) => ({
    value: idx + 1,
    label: `${idx + 1}`,
  })),
};

export const BEAT_STAMP_PRESET_PARAM_DEF: ActionParamDef = {
  id: 'preset',
  label: 'Stamp Icon',
  type: 'preset',
  visualVariant: 'preset',
  defaultValue: 'HEART',
  options: BEAT_STAMP_PRESETS.map((preset) => ({
    value: preset.name,
    label: preset.label,
  })),
};

export const BEAT_WAIT_DURATION_PARAM_DEF: ActionParamDef = {
  id: 'duration',
  label: 'Wait',
  type: 'wait-duration',
  defaultValue: 1,
  options: [
    { value: 0.25, label: '¼' },
    { value: 0.5, label: '½' },
    { value: 1, label: '1' },
    { value: 2, label: '2' },
    { value: 4, label: '4' },
  ],
};

export const BEAT_DELAY_PARAM_DEF: ActionParamDef = {
  id: 'delay',
  label: 'Step Delay',
  type: 'beat-delay',
  defaultValue: 0,
  options: [
    { value: 0, label: 'Instant' },
    { value: 0.25, label: '¼×' },
    { value: 0.5, label: '½×' },
    { value: 1, label: '1×' },
    { value: 2, label: '2×' },
    { value: 4, label: '4×' },
  ],
};

export const BEAT_CURSOR_TURN_PARAM_DEF: ActionParamDef = {
  id: 'direction',
  label: 'Turn Direction',
  type: 'turnDir',
  visualVariant: 'turnDir',
  defaultValue: 'RIGHT',
  options: [
    { value: 'LEFT', label: 'Left 90°' },
    { value: 'RIGHT', label: 'Right 90°' },
  ],
};

export const BEAT_PALETTE_ITEMS: SimPaletteItem[] = [
  {
    id: 'beat-drum-kick',
    actionType: 'DRUM_KICK',
    name: 'Kick Drum',
    category: 'action',
    icon: ({ isActive }) => (
      <svg
        className={`w-6 h-6 md:w-7 md:h-7 ${
          isActive ? 'stroke-slate-950 text-slate-950' : 'stroke-white text-rose-200'
        }`}
        viewBox="0 0 24 24"
        fill="none"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="13" r="8" />
        <circle cx="12" cy="13" r="3" fill="currentColor" stroke="none" />
        <line x1="6" y1="3" x2="10" y2="6" />
        <line x1="18" y1="3" x2="14" y2="6" />
      </svg>
    ),
    bgClass: 'bg-rose-600 hover:bg-rose-500',
    borderClass: 'border-rose-400',
    supportsRepeat: true,
  },
  {
    id: 'beat-drum-snare',
    actionType: 'DRUM_SNARE',
    name: 'Snare Drum',
    category: 'action',
    icon: ({ isActive }) => (
      <svg
        className={`w-6 h-6 md:w-7 md:h-7 ${
          isActive ? 'stroke-slate-950' : 'stroke-white'
        }`}
        viewBox="0 0 24 24"
        fill="none"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="4" y1="3" x2="15" y2="10" />
        <line x1="20" y1="3" x2="9" y2="10" />
        <rect x="4" y="12" width="16" height="8" rx="2" />
        <polyline points="6 12 9 20 12 12 15 20 18 12" strokeWidth="1.6" />
      </svg>
    ),
    bgClass: 'bg-orange-600 hover:bg-orange-500',
    borderClass: 'border-orange-400',
    supportsRepeat: true,
  },
  {
    id: 'beat-drum-clap',
    actionType: 'DRUM_CLAP',
    name: 'Handclap',
    category: 'action',
    icon: ({ isActive }) => (
      <svg
        className={`w-6 h-6 md:w-7 md:h-7 ${
          isActive ? 'stroke-slate-950 text-slate-950' : 'stroke-white text-fuchsia-200'
        }`}
        viewBox="0 0 24 24"
        fill="none"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Starburst accent rays */}
        <line x1="12" y1="2" x2="12" y2="5" />
        <line x1="5" y1="5" x2="7.2" y2="7.2" />
        <line x1="19" y1="5" x2="16.8" y2="7.2" />
        {/* Clapping hands silhouette */}
        <path d="M8 14l-2.5-2.5a1.5 1.5 0 0 1 2.1-2.1L11 12.8" />
        <path d="M16 14l2.5-2.5a1.5 1.5 0 0 0-2.1-2.1L13 12.8" />
        <path d="M7.5 14.5L11 19h2l3.5-4.5" />
      </svg>
    ),
    bgClass: 'bg-fuchsia-600 hover:bg-fuchsia-500',
    borderClass: 'border-fuchsia-400',
    supportsRepeat: true,
  },
  {
    id: 'beat-play-chime',
    actionType: 'PLAY_CHIME',
    name: 'Play Chime',
    category: 'action',
    icon: ({ isActive }) => (
      <div className="relative flex items-center justify-center">
        <Bell
          className={`w-5 h-5 md:w-6 md:h-6 stroke-[2.5] ${
            isActive ? 'text-slate-950 fill-slate-950/20' : 'text-white fill-white/20'
          }`}
        />
        <Sparkles
          className={`w-3.5 h-3.5 absolute -top-1.5 -right-1.5 stroke-[2.5] ${
            isActive ? 'text-slate-950' : 'text-yellow-100'
          }`}
        />
      </div>
    ),
    bgClass: 'bg-amber-500 hover:bg-amber-400',
    borderClass: 'border-amber-300',
    supportsRepeat: true,
  },
  {
    id: 'beat-stamp-heart',
    actionType: 'STAMP_HEART',
    name: 'Stamp Heart',
    category: 'action',
    icon: ({ isActive }) => (
      <Heart
        className={`w-5 h-5 md:w-6 md:h-6 stroke-[2.5] ${
          isActive ? 'text-slate-950 fill-slate-950' : 'text-white fill-pink-200/80'
        }`}
      />
    ),
    bgClass: 'bg-pink-600 hover:bg-pink-500',
    borderClass: 'border-pink-300',
    supportsRepeat: false,
  },
  {
    id: 'beat-stamp-star',
    actionType: 'STAMP_STAR',
    name: 'Stamp Star',
    category: 'action',
    icon: ({ isActive }) => (
      <Star
        className={`w-5 h-5 md:w-6 md:h-6 stroke-[2.5] ${
          isActive ? 'text-slate-950 fill-slate-950' : 'text-amber-200 fill-amber-300/85'
        }`}
      />
    ),
    bgClass: 'bg-indigo-600 hover:bg-indigo-500',
    borderClass: 'border-indigo-300',
    supportsRepeat: false,
  },
  {
    id: 'beat-stamp-smile',
    actionType: 'STAMP_SMILE',
    name: 'Stamp Smile',
    category: 'action',
    icon: ({ isActive }) => (
      <Smile
        className={`w-5 h-5 md:w-6 md:h-6 stroke-[2.5] ${
          isActive ? 'text-slate-950' : 'text-white'
        }`}
      />
    ),
    bgClass: 'bg-cyan-600 hover:bg-cyan-500',
    borderClass: 'border-cyan-300',
    supportsRepeat: false,
  },
  {
    id: 'beat-wait-beat',
    actionType: 'WAIT_BEAT',
    name: 'Wait Beat',
    category: 'action',
    params: { duration: 1 },
    paramDefs: [BEAT_WAIT_DURATION_PARAM_DEF],
    icon: ({ isActive }) => (
      <Hourglass
        className={`w-5 h-5 md:w-6 md:h-6 stroke-[2.5] ${
          isActive ? 'text-slate-950' : 'text-sky-200'
        }`}
      />
    ),
    bgClass: 'bg-slate-600 hover:bg-slate-500',
    borderClass: 'border-slate-400',
    supportsRepeat: true,
  },
  {
    id: 'beat-clear-leds',
    actionType: 'CLEAR_LEDS',
    name: 'Clear LEDs',
    category: 'action',
    icon: ({ isActive }) => (
      <Eraser
        className={`w-5 h-5 md:w-6 md:h-6 stroke-[2.5] ${
          isActive ? 'text-slate-950' : 'text-rose-300'
        }`}
      />
    ),
    bgClass: 'bg-slate-800 hover:bg-slate-700',
    borderClass: 'border-slate-500',
    supportsRepeat: false,
  },
  // Tier 2 (Module 2+): Parameterized Synth & LED Matrix Blocks
  {
    id: 'beat-play-note',
    actionType: 'PLAY_NOTE',
    name: 'Play Note',
    category: 'action',
    params: { pitch: 1, duration: 1 },
    paramDefs: [BEAT_PITCH_PARAM_DEF, BEAT_DURATION_PARAM_DEF],
    icon: ({ isActive }) => (
      <Music
        className={`w-5 h-5 md:w-6 md:h-6 stroke-[2.5] ${
          isActive ? 'text-slate-950' : 'text-white'
        }`}
      />
    ),
    bgClass: 'bg-violet-600 hover:bg-violet-500',
    borderClass: 'border-violet-300',
    supportsRepeat: true,
  },
  {
    id: 'beat-set-led-color',
    actionType: 'SET_LED_COLOR',
    name: 'Set LED Color',
    category: 'pen',
    params: { color: DEFAULT_BEAT_LED_COLOR },
    paramDefs: [BEAT_COLOR_PARAM_DEF],
    icon: ({ isActive }) => (
      <Palette
        className={`w-5 h-5 md:w-6 md:h-6 stroke-[2.5] ${
          isActive ? 'text-slate-950' : 'text-white'
        }`}
      />
    ),
    bgClass: 'bg-emerald-600 hover:bg-emerald-500',
    borderClass: 'border-emerald-300',
    supportsRepeat: false,
  },
  {
    id: 'beat-light-row',
    actionType: 'LIGHT_ROW',
    name: 'Light LED Row',
    category: 'action',
    params: { y: 1 },
    paramDefs: [BEAT_ROW_PARAM_DEF],
    icon: ({ isActive }) => (
      <svg
        className="w-6 h-6 md:w-7 md:h-7"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <rect
          x="3"
          y="3"
          width="18"
          height="18"
          rx="3"
          stroke={isActive ? '#020617' : 'rgba(255,255,255,0.55)'}
          strokeWidth="2"
        />
        <rect
          x="5.5"
          y="6.5"
          width="13"
          height="2.5"
          rx="1"
          fill={isActive ? 'rgba(2,6,23,0.35)' : 'rgba(255,255,255,0.3)'}
        />
        <rect
          x="5.5"
          y="10.75"
          width="13"
          height="2.8"
          rx="1"
          fill={isActive ? '#020617' : '#fef08a'}
        />
        <rect
          x="5.5"
          y="15.25"
          width="13"
          height="2.5"
          rx="1"
          fill={isActive ? 'rgba(2,6,23,0.35)' : 'rgba(255,255,255,0.3)'}
        />
      </svg>
    ),
    bgClass: 'bg-sky-600 hover:bg-sky-500',
    borderClass: 'border-sky-300',
    supportsRepeat: false,
  },
  {
    id: 'beat-light-col',
    actionType: 'LIGHT_COL',
    name: 'Light LED Column',
    category: 'action',
    params: { x: 1 },
    paramDefs: [BEAT_COL_PARAM_DEF],
    icon: ({ isActive }) => (
      <svg
        className="w-6 h-6 md:w-7 md:h-7"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <rect
          x="3"
          y="3"
          width="18"
          height="18"
          rx="3"
          stroke={isActive ? '#020617' : 'rgba(255,255,255,0.55)'}
          strokeWidth="2"
        />
        <rect
          x="6.5"
          y="5.5"
          width="2.5"
          height="13"
          rx="1"
          fill={isActive ? 'rgba(2,6,23,0.35)' : 'rgba(255,255,255,0.3)'}
        />
        <rect
          x="10.75"
          y="5.5"
          width="2.8"
          height="13"
          rx="1"
          fill={isActive ? '#020617' : '#fef08a'}
        />
        <rect
          x="15.25"
          y="5.5"
          width="2.5"
          height="13"
          rx="1"
          fill={isActive ? 'rgba(2,6,23,0.35)' : 'rgba(255,255,255,0.3)'}
        />
      </svg>
    ),
    bgClass: 'bg-teal-600 hover:bg-teal-500',
    borderClass: 'border-teal-300',
    supportsRepeat: false,
  },
  {
    id: 'beat-light-pixel',
    actionType: 'LIGHT_PIXEL',
    name: 'Light LED Pixel',
    category: 'action',
    params: { x: 1, y: 1 },
    paramDefs: [BEAT_PIXEL_X_PARAM_DEF, BEAT_PIXEL_Y_PARAM_DEF],
    icon: ({ isActive }) => (
      <svg
        className="w-6 h-6 md:w-7 md:h-7"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <rect
          x="3"
          y="3"
          width="18"
          height="18"
          rx="3"
          stroke={isActive ? '#020617' : 'rgba(255,255,255,0.55)'}
          strokeWidth="2"
        />
        <circle
          cx="8.5"
          cy="8.5"
          r="1.8"
          fill={isActive ? 'rgba(2,6,23,0.35)' : 'rgba(255,255,255,0.3)'}
        />
        <circle
          cx="15.5"
          cy="8.5"
          r="1.8"
          fill={isActive ? 'rgba(2,6,23,0.35)' : 'rgba(255,255,255,0.3)'}
        />
        <circle
          cx="8.5"
          cy="15.5"
          r="1.8"
          fill={isActive ? 'rgba(2,6,23,0.35)' : 'rgba(255,255,255,0.3)'}
        />
        <rect
          x="12.5"
          y="12.5"
          width="5.5"
          height="5.5"
          rx="1.4"
          fill={isActive ? '#020617' : '#fef08a'}
        />
      </svg>
    ),
    bgClass: 'bg-blue-600 hover:bg-blue-500',
    borderClass: 'border-blue-300',
    supportsRepeat: false,
  },
  {
    id: 'beat-stamp-preset',
    actionType: 'STAMP_PRESET',
    name: 'Stamp Icon',
    category: 'action',
    params: { preset: 'HEART' },
    paramDefs: [BEAT_STAMP_PRESET_PARAM_DEF],
    icon: ({ isActive }) => (
      <Stamp
        className={`w-5 h-5 md:w-6 md:h-6 stroke-[2.5] ${
          isActive ? 'text-slate-950' : 'text-white'
        }`}
      />
    ),
    bgClass: 'bg-pink-600 hover:bg-pink-500',
    borderClass: 'border-pink-300',
    supportsRepeat: false,
  },
  // Tier 3 (Module 3+): LED Cursor Blocks for Border / Marquee / Wave Loops
  {
    id: 'beat-cursor-step',
    actionType: 'CURSOR_STEP',
    name: 'Step LED Cursor',
    category: 'motion',
    icon: ({ isActive }) => (
      <svg
        className="w-6 h-6 md:w-7 md:h-7"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        {/* Trailing lit LED cell */}
        <rect
          x="3"
          y="8.5"
          width="6"
          height="7"
          rx="1.6"
          fill={isActive ? 'rgba(2,6,23,0.35)' : 'rgba(254,240,138,0.45)'}
        />
        {/* Target cursor LED cell */}
        <rect
          x="11"
          y="7"
          width="10"
          height="10"
          rx="2.2"
          stroke={isActive ? '#020617' : '#ffffff'}
          strokeWidth="2"
          fill={isActive ? 'rgba(2,6,23,0.2)' : 'rgba(255,255,255,0.18)'}
        />
        {/* Forward directional dart */}
        <polygon
          points="19,12 13.5,9 14.8,12 13.5,15"
          fill={isActive ? '#020617' : '#fef08a'}
        />
      </svg>
    ),
    bgClass: 'bg-cyan-600 hover:bg-cyan-500',
    borderClass: 'border-cyan-300',
    supportsRepeat: true,
  },
  {
    id: 'beat-cursor-turn',
    actionType: 'CURSOR_TURN',
    name: 'Turn LED Cursor',
    category: 'action',
    params: { direction: 'RIGHT' },
    paramDefs: [BEAT_CURSOR_TURN_PARAM_DEF],
    icon: ({ isActive }) => (
      <svg
        className="w-6 h-6 md:w-7 md:h-7"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        {/* LED cursor reticle frame */}
        <rect
          x="4"
          y="4"
          width="16"
          height="16"
          rx="3"
          stroke={isActive ? '#020617' : 'rgba(255,255,255,0.65)'}
          strokeWidth="2"
        />
        {/* 90-degree corner rotation arrow inside reticle */}
        <path
          d="M9 16V9h6"
          stroke={isActive ? '#020617' : '#fef08a'}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points="13,6.5 16,9 13,11.5"
          stroke={isActive ? '#020617' : '#fef08a'}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    bgClass: 'bg-amber-600 hover:bg-amber-500',
    borderClass: 'border-amber-300',
    supportsRepeat: false,
  },
  {
    id: 'beat-set-delay',
    actionType: 'SET_BEAT_DELAY',
    name: 'Step Delay',
    category: 'action',
    params: { delay: 0 },
    paramDefs: [BEAT_DELAY_PARAM_DEF],
    icon: ({ isActive }) => (
      <Gauge
        className={`w-5 h-5 md:w-6 md:h-6 stroke-[2.5] ${
          isActive ? 'text-slate-950' : 'text-emerald-200'
        }`}
      />
    ),
    bgClass: 'bg-emerald-700 hover:bg-emerald-600',
    borderClass: 'border-emerald-400',
    supportsRepeat: false,
  },
];

const CARDINAL_DIRS: readonly BeatState['cursor']['dir'][] = ['NORTH', 'EAST', 'SOUTH', 'WEST'];

function stepBeatCursor(cursor: BeatState['cursor']): BeatState['cursor'] {
  const baseX = Math.max(1, Math.min(BEAT_GRID_SIZE, Math.round(cursor?.x || 1)));
  const baseY = Math.max(1, Math.min(BEAT_GRID_SIZE, Math.round(cursor?.y || 1)));
  const dir: BeatState['cursor']['dir'] = CARDINAL_DIRS.includes(cursor?.dir)
    ? cursor.dir
    : 'EAST';

  let nextX = baseX;
  let nextY = baseY;
  switch (dir) {
    case 'EAST':
      nextX = (baseX % BEAT_GRID_SIZE) + 1;
      break;
    case 'WEST':
      nextX = ((baseX + BEAT_GRID_SIZE - 2) % BEAT_GRID_SIZE) + 1;
      break;
    case 'SOUTH':
      nextY = (baseY % BEAT_GRID_SIZE) + 1;
      break;
    case 'NORTH':
      nextY = ((baseY + BEAT_GRID_SIZE - 2) % BEAT_GRID_SIZE) + 1;
      break;
  }

  return {
    x: nextX,
    y: nextY,
    dir,
    visible: true,
  };
}

function turnBeatCursor(
  cursor: BeatState['cursor'],
  rawTurnDir: unknown
): BeatState['cursor'] {
  const baseX = Math.max(1, Math.min(BEAT_GRID_SIZE, Math.round(cursor?.x || 1)));
  const baseY = Math.max(1, Math.min(BEAT_GRID_SIZE, Math.round(cursor?.y || 1)));
  const currentIdx = Math.max(0, CARDINAL_DIRS.indexOf(cursor?.dir || 'EAST'));
  const isLeft =
    rawTurnDir === 0 || String(rawTurnDir ?? 'RIGHT').trim().toUpperCase() === 'LEFT';
  const nextIdx = isLeft
    ? (currentIdx + CARDINAL_DIRS.length - 1) % CARDINAL_DIRS.length
    : (currentIdx + 1) % CARDINAL_DIRS.length;

  return {
    x: baseX,
    y: baseY,
    dir: CARDINAL_DIRS[nextIdx],
    visible: true,
  };
}

function resolveLedColor(rawColor: unknown, fallback: string): string {
  if (typeof rawColor === 'number') {
    // 1..8 variable index (Module 6+) or 0 fallback to first swatch
    const normalized = rawColor >= 1 ? Math.round(rawColor) - 1 : 0;
    const idx = Math.max(0, Math.min(BEAT_LED_PALETTE.length - 1, normalized));
    return BEAT_LED_PALETTE[idx].hex;
  }
  if (typeof rawColor === 'string' && rawColor.trim()) {
    const trimmed = rawColor.trim();
    if (trimmed.startsWith('#')) return trimmed;
    const byNum = Number(trimmed);
    if (Number.isFinite(byNum)) {
      // 1..8 variable index or 0..7 colorId
      const idx = Math.max(0, Math.min(BEAT_LED_PALETTE.length - 1, Math.round(byNum) - 1));
      return BEAT_LED_PALETTE[idx].hex;
    }
  }
  return fallback;
}

export const beatSimulationEnvironment: SimulationEnvironment<BeatState> = {
  id: 'beat',
  name: 'Beat & Light Matrix',
  icon: <span className="text-xl">🎵</span>,

  paletteItems: BEAT_PALETTE_ITEMS,

  createInitialState: () => createInitialBeatState(false),

  resetState: (state: BeatState): BeatState => resetBeatState(state),

  executeAction: (
    actionType: string,
    state: BeatState,
    options?: { repeatCount?: number; params?: Record<string, any> }
  ): SimActionResult<BeatState> => {
    const nextBeatIndex = (state.beatIndex || 0) + 1;
    const nextStepCount = (state.stepCount || 0) + 1;
    let nextLeds = state.leds;
    let nextActiveColor = state.activeColor || DEFAULT_BEAT_LED_COLOR;
    let nextIsColorCustomized = Boolean(state.isColorCustomized);
    let nextCursor = state.cursor || { x: 1, y: 1, dir: 'EAST' as const, visible: false };
    let nextStepDelayMultiplier =
      typeof state.stepDelayMultiplier === 'number' && Number.isFinite(state.stepDelayMultiplier)
        ? state.stepDelayMultiplier
        : 1;
    let lastTriggeredEvent: BeatState['lastTriggeredEvent'] = state.lastTriggeredEvent;

    switch (actionType) {
      case 'DRUM_KICK': {
        lastTriggeredEvent = {
          kind: 'DRUM_KICK',
          actionType,
          beatIndex: nextBeatIndex,
        };
        break;
      }

      case 'DRUM_SNARE': {
        lastTriggeredEvent = {
          kind: 'DRUM_SNARE',
          actionType,
          beatIndex: nextBeatIndex,
        };
        break;
      }

      case 'DRUM_CLAP': {
        lastTriggeredEvent = {
          kind: 'DRUM_CLAP',
          actionType,
          beatIndex: nextBeatIndex,
        };
        break;
      }

      case 'PLAY_CHIME': {
        lastTriggeredEvent = {
          kind: 'PLAY_CHIME',
          actionType,
          beatIndex: nextBeatIndex,
        };
        break;
      }

      case 'STAMP_HEART':
      case 'STAMP_STAR':
      case 'STAMP_SMILE':
      case 'STAMP_PRESET': {
        const requestedPreset: BeatPresetName | number | string =
          actionType === 'STAMP_HEART'
            ? 'HEART'
            : actionType === 'STAMP_STAR'
            ? 'STAR'
            : actionType === 'STAMP_SMILE'
            ? 'SMILE'
            : options?.params?.preset ?? options?.params?.presetId ?? 'HEART';
        const presetDef = getPresetDef(requestedPreset);
        const stampColor = nextIsColorCustomized ? nextActiveColor : presetDef.defaultColor;
        nextLeds = createPresetLedGrid(presetDef.name, stampColor);
        lastTriggeredEvent = {
          kind: 'STAMP',
          actionType,
          beatIndex: nextBeatIndex,
          preset: presetDef.name,
          color: stampColor,
        };
        break;
      }

      case 'WAIT_BEAT': {
        const rawWait = Number(options?.params?.duration ?? 1);
        const waitBeats = Number.isFinite(rawWait) && rawWait > 0 ? rawWait : 1;
        lastTriggeredEvent = {
          kind: 'WAIT_BEAT',
          actionType,
          beatIndex: nextBeatIndex,
          waitBeats,
        };
        break;
      }

      case 'SET_BEAT_DELAY': {
        const rawDelay = Number(options?.params?.delay ?? 0);
        nextStepDelayMultiplier =
          Number.isFinite(rawDelay) && rawDelay >= 0 ? rawDelay : 0;
        lastTriggeredEvent = {
          kind: 'SET_BEAT_DELAY',
          actionType,
          beatIndex: nextBeatIndex,
          delayMultiplier: nextStepDelayMultiplier,
        };
        break;
      }

      case 'CLEAR_LEDS': {
        nextLeds = createEmptyLedGrid();
        lastTriggeredEvent = {
          kind: 'CLEAR_LEDS',
          actionType,
          beatIndex: nextBeatIndex,
        };
        break;
      }

      // Forward-compatible hooks for Commit 13 (Tier 2) & Commit 17 (Tier 3 Cursor)
      case 'SET_LED_COLOR': {
        nextActiveColor = resolveLedColor(options?.params?.color, nextActiveColor);
        nextIsColorCustomized = true;
        lastTriggeredEvent = {
          kind: 'LED_CHANGE',
          actionType,
          beatIndex: nextBeatIndex,
          color: nextActiveColor,
        };
        break;
      }

      case 'PLAY_NOTE': {
        const pitch = Math.max(1, Math.min(8, Math.round(Number(options?.params?.pitch ?? 1))));
        const durationBeats = Number(options?.params?.duration ?? 1) || 1;
        lastTriggeredEvent = {
          kind: 'PLAY_NOTE',
          actionType,
          beatIndex: nextBeatIndex,
          pitch,
          durationBeats,
        };
        break;
      }

      case 'LIGHT_ROW': {
        const rowIdx = Math.max(
          0,
          Math.min(BEAT_GRID_SIZE - 1, Math.round(Number(options?.params?.y ?? 1)) - 1)
        );
        nextLeds = cloneLedGrid(state.leds);
        for (let c = 0; c < BEAT_GRID_SIZE; c++) {
          nextLeds[rowIdx][c] = nextActiveColor;
        }
        lastTriggeredEvent = {
          kind: 'LED_CHANGE',
          actionType,
          beatIndex: nextBeatIndex,
          color: nextActiveColor,
        };
        break;
      }

      case 'LIGHT_COL': {
        const colIdx = Math.max(
          0,
          Math.min(BEAT_GRID_SIZE - 1, Math.round(Number(options?.params?.x ?? 1)) - 1)
        );
        nextLeds = cloneLedGrid(state.leds);
        for (let r = 0; r < BEAT_GRID_SIZE; r++) {
          nextLeds[r][colIdx] = nextActiveColor;
        }
        lastTriggeredEvent = {
          kind: 'LED_CHANGE',
          actionType,
          beatIndex: nextBeatIndex,
          color: nextActiveColor,
        };
        break;
      }

      case 'LIGHT_PIXEL': {
        const colIdx = Math.max(
          0,
          Math.min(BEAT_GRID_SIZE - 1, Math.round(Number(options?.params?.x ?? 1)) - 1)
        );
        const rowIdx = Math.max(
          0,
          Math.min(BEAT_GRID_SIZE - 1, Math.round(Number(options?.params?.y ?? 1)) - 1)
        );
        nextLeds = cloneLedGrid(state.leds);
        nextLeds[rowIdx][colIdx] = nextActiveColor;
        lastTriggeredEvent = {
          kind: 'LED_CHANGE',
          actionType,
          beatIndex: nextBeatIndex,
          color: nextActiveColor,
        };
        break;
      }

      case 'CURSOR_STEP': {
        nextCursor = stepBeatCursor(nextCursor);
        nextLeds = cloneLedGrid(state.leds);
        nextLeds[nextCursor.y - 1][nextCursor.x - 1] = nextActiveColor;
        lastTriggeredEvent = {
          kind: 'LED_CHANGE',
          actionType,
          beatIndex: nextBeatIndex,
          color: nextActiveColor,
        };
        break;
      }

      case 'CURSOR_TURN': {
        const rawDir = options?.params?.direction ?? options?.params?.dir ?? 'RIGHT';
        nextCursor = turnBeatCursor(nextCursor, rawDir);
        lastTriggeredEvent = {
          kind: 'LED_CHANGE',
          actionType,
          beatIndex: nextBeatIndex,
          color: nextActiveColor,
        };
        break;
      }

      default:
        break;
    }

    const nextState: BeatState = {
      ...state,
      leds: nextLeds,
      activeColor: nextActiveColor,
      isColorCustomized: nextIsColorCustomized,
      beatIndex: nextBeatIndex,
      stepCount: nextStepCount,
      lastTriggeredEvent,
      cursor: nextCursor,
      stepDelayMultiplier: nextStepDelayMultiplier,
      status: 'RUNNING',
    };

    return {
      nextState,
      status: 'RUNNING',
    };
  },

  evaluateCompletion: () => 'IDLE',

  Renderer: BeatCanvas,

  ToolsComponent: BeatToolbarTools,
};

// Self-register so getSimEnvironment('beat') is always populated regardless of import order
registerSimulation(beatSimulationEnvironment);
