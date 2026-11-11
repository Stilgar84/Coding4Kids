import { BEAT_GRID_SIZE, BeatPresetName } from './types';

export interface BeatStampPresetDef {
  id: number;
  name: BeatPresetName;
  label: string;
  defaultColor: string;
  /** 8 strings of 8 chars ('#' = lit LED, '.' = off LED) */
  pattern: readonly string[];
}

export const BEAT_STAMP_PRESETS: readonly BeatStampPresetDef[] = [
  {
    id: 0,
    name: 'HEART',
    label: 'Heart',
    defaultColor: '#f43f5e', // Vibrant Rose
    pattern: [
      '........',
      '.##..##.',
      '########',
      '########',
      '.######.',
      '..####..',
      '...##...',
      '........',
    ],
  },
  {
    id: 1,
    name: 'STAR',
    label: 'Star',
    defaultColor: '#fbbf24', // Golden Amber
    pattern: [
      '...##...',
      '...##...',
      '########',
      '.######.',
      '..####..',
      '.##..##.',
      '##....##',
      '........',
    ],
  },
  {
    id: 2,
    name: 'SMILE',
    label: 'Smile',
    defaultColor: '#06b6d4', // Bright Cyan
    pattern: [
      '..####..',
      '.#....#.',
      '#.#..#.#',
      '#......#',
      '#.#..#.#',
      '#..##..#',
      '.#....#.',
      '..####..',
    ],
  },
  // Reserved Preset IDs (3..7) ready for Tier 2 STAMP_PRESET badge in Commit 13
  {
    id: 3,
    name: 'NOTE',
    label: 'Music Note',
    defaultColor: '#a855f7', // Purple
    pattern: [
      '....###.',
      '....#..#',
      '....#..#',
      '....#...',
      '....#...',
      '..###...',
      '.####...',
      '..##....',
    ],
  },
  {
    id: 4,
    name: 'BOLT',
    label: 'Lightning Bolt',
    defaultColor: '#facc15', // Electric Yellow
    pattern: [
      '....###.',
      '...###..',
      '..###...',
      '.######.',
      '...###..',
      '..###...',
      '.###....',
      '##......',
    ],
  },
  {
    id: 5,
    name: 'DIAMOND',
    label: 'Diamond',
    defaultColor: '#38bdf8', // Sky Blue
    pattern: [
      '...##...',
      '..####..',
      '.######.',
      '########',
      '########',
      '.######.',
      '..####..',
      '...##...',
    ],
  },
  {
    id: 6,
    name: 'CHECK',
    label: 'Checkmark',
    defaultColor: '#10b981', // Emerald
    pattern: [
      '........',
      '.......#',
      '......##',
      '.....##.',
      '#...##..',
      '##.##...',
      '.###....',
      '..#.....',
    ],
  },
  {
    id: 7,
    name: 'ROBOT',
    label: 'Robot Face',
    defaultColor: '#fb923c', // Orange
    pattern: [
      '...##...',
      '.######.',
      '#..##..#',
      '########',
      '#.####.#',
      '#......#',
      '.######.',
      '........',
    ],
  },
];

export const BEAT_PRESETS: Record<BeatPresetName, BeatStampPresetDef> = BEAT_STAMP_PRESETS.reduce(
  (acc, def) => {
    acc[def.name] = def;
    return acc;
  },
  {} as Record<BeatPresetName, BeatStampPresetDef>
);

export function createEmptyLedGrid(): (string | null)[][] {
  return Array.from({ length: BEAT_GRID_SIZE }, () =>
    Array.from({ length: BEAT_GRID_SIZE }, () => null)
  );
}

export function cloneLedGrid(leds: (string | null)[][]): (string | null)[][] {
  return Array.from({ length: BEAT_GRID_SIZE }, (_, r) =>
    Array.from({ length: BEAT_GRID_SIZE }, (__, c) => leds?.[r]?.[c] ?? null)
  );
}

export function getPresetDef(preset: BeatPresetName | number | string | undefined): BeatStampPresetDef {
  if (typeof preset === 'number') {
    return BEAT_STAMP_PRESETS[preset] ?? BEAT_STAMP_PRESETS[0];
  }
  if (typeof preset === 'string') {
    const upper = preset.toUpperCase();
    const found = BEAT_STAMP_PRESETS.find((p) => p.name === upper);
    if (found) return found;
    const asNum = Number(preset);
    if (Number.isInteger(asNum) && asNum >= 0 && asNum < BEAT_STAMP_PRESETS.length) {
      return BEAT_STAMP_PRESETS[asNum];
    }
  }
  return BEAT_STAMP_PRESETS[0];
}

export function presetNameToId(preset: BeatPresetName | string | number | undefined): number {
  return getPresetDef(preset).id;
}

export function presetIdToName(id: number): BeatPresetName {
  const safeIdx = Math.max(0, Math.min(BEAT_STAMP_PRESETS.length - 1, id));
  return BEAT_STAMP_PRESETS[safeIdx].name;
}

/**
 * Renders an 8x8 pixel icon preset onto a fresh 8x8 LED grid.
 * Uses `colorOverride` when provided (e.g. after SET_LED_COLOR), otherwise the preset's signature color.
 */
export function createPresetLedGrid(
  preset: BeatPresetName | number | string,
  colorOverride?: string | null
): (string | null)[][] {
  const def = getPresetDef(preset);
  const fill = colorOverride || def.defaultColor;
  return Array.from({ length: BEAT_GRID_SIZE }, (_, r) => {
    const rowStr = def.pattern[r] || '........';
    return Array.from({ length: BEAT_GRID_SIZE }, (__, c) =>
      rowStr[c] === '#' ? fill : null
    );
  });
}

export function countLitLeds(leds: (string | null)[][]): number {
  let count = 0;
  for (let r = 0; r < BEAT_GRID_SIZE; r++) {
    for (let c = 0; c < BEAT_GRID_SIZE; c++) {
      if (leds?.[r]?.[c]) count++;
    }
  }
  return count;
}
