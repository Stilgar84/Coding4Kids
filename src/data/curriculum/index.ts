export * from './types';

import { CurriculumActivity, CurriculumModule } from './types';
import { MODULE_1_DEMO_ACTIVITIES } from './module1Demo';
import { MODULE_1_ROBOT_ACTIVITIES } from './module1Robot';
import { MODULE_1_LOGO_ACTIVITIES } from './module1Logo';
import { MODULE_1_BEAT_ACTIVITIES } from './module1Beat';
import { MODULE_2_PARAMS_ACTIVITIES } from './module2Params';
import { MODULE_2_OBJECTS_ACTIVITIES } from './module2Objects';
import { MODULE_3_PART1_ACTIVITIES } from './module3Part1';

export { MODULE_1_DEMO_ACTIVITIES } from './module1Demo';
export { MODULE_1_ROBOT_ACTIVITIES } from './module1Robot';
export { MODULE_1_LOGO_ACTIVITIES } from './module1Logo';
export { MODULE_1_BEAT_ACTIVITIES } from './module1Beat';
export { MODULE_2_PARAMS_ACTIVITIES, MODULE_2_BEAT_ALLOWED_BLOCKS } from './module2Params';
export { MODULE_2_OBJECTS_ACTIVITIES } from './module2Objects';
export { MODULE_3_PART1_ACTIVITIES } from './module3Part1';

/**
 * Static Module catalog for Modules 1–3.
 * Declaring badgeId and capstoneIds statically in Commit 1 decouples
 * Reward/Badge UI (Commit 12) from individual Capstone authoring slices.
 */
export const CURRICULUM_MODULES: CurriculumModule[] = [
  {
    id: 'module-1',
    number: 1,
    title: 'First Steps — Sequences, Orientation & Visual Debugging',
    shortTitle: 'Module 1',
    icon: '🧭',
    badgeId: 'badge-module-1',
    badgeTitle: 'Sequence Navigator',
    badgeIcon: '🏅',
    capstoneIds: ['1A', '1B', '1C'],
  },
  {
    id: 'module-2',
    number: 2,
    title: 'Action Parameters & World Interaction',
    shortTitle: 'Module 2',
    icon: '🎛️',
    badgeId: 'badge-module-2',
    badgeTitle: 'Parameter & Gadget Crafter',
    badgeIcon: '🎖️',
    capstoneIds: ['2A', '2B'],
  },
  {
    id: 'module-3',
    number: 3,
    title: 'Loops — Repeating Sequences & Nested Patterns',
    shortTitle: 'Module 3',
    icon: '🔁',
    badgeId: 'badge-module-3',
    badgeTitle: 'Loop Architect',
    badgeIcon: '🏆',
    capstoneIds: ['3A', '3B', '3C'],
  },
];

interface ParsedCurriculumActivityId {
  moduleNum: number;
  /** 0 = numbered lesson (e.g. '1.0', '2.7'), 1 = module capstone (e.g. '1A', '3C'), 2 = other/challenge */
  kindRank: number;
  lessonNum: number;
  suffix: string;
}

function parseCurriculumActivityId(id: string, moduleId?: string): ParsedCurriculumActivityId {
  const lessonMatch = /^(\d+)\.(\d+)(.*)$/.exec(id);
  if (lessonMatch) {
    return {
      moduleNum: Number(lessonMatch[1]),
      kindRank: 0,
      lessonNum: Number(lessonMatch[2]),
      suffix: lessonMatch[3] ?? '',
    };
  }

  const capstoneMatch = /^(\d+)([A-Za-z]+)(.*)$/.exec(id);
  if (capstoneMatch) {
    return {
      moduleNum: Number(capstoneMatch[1]),
      kindRank: 1,
      lessonNum: 0,
      suffix: `${capstoneMatch[2].toUpperCase()}${capstoneMatch[3] ?? ''}`,
    };
  }

  const modMatch = moduleId ? /^module-(\d+)$/.exec(moduleId) : null;
  return {
    moduleNum: modMatch ? Number(modMatch[1]) : Number.MAX_SAFE_INTEGER,
    kindRank: 2,
    lessonNum: 0,
    suffix: id,
  };
}

/**
 * Compares two curriculum activity IDs (e.g. '1.0', '1.8', '1A', '2.7', '2B', '3.0', '3C')
 * in canonical pedagogical order: numbered lessons ascending first, followed by capstones A..Z.
 */
export function compareCurriculumActivityIds(
  idA: string,
  idB: string,
  moduleIdA?: string,
  moduleIdB?: string
): number {
  const a = parseCurriculumActivityId(idA, moduleIdA);
  const b = parseCurriculumActivityId(idB, moduleIdB);

  if (a.moduleNum !== b.moduleNum) {
    return a.moduleNum - b.moduleNum;
  }
  if (a.kindRank !== b.kindRank) {
    return a.kindRank - b.kindRank;
  }
  if (a.lessonNum !== b.lessonNum) {
    return a.lessonNum - b.lessonNum;
  }
  return a.suffix.localeCompare(b.suffix);
}

/**
 * Returns a canonically ordered shallow copy of `activities` across all modules
 * (`1.0`..`1.8`, `1A`..`1C`, `2.1`..`2.7`, `2A`..`2B`, `3.0`..`3.7`, `3A`..`3C`),
 * keeping optional Mastery Challenges (`format === 'challenge'`) after core module tracks.
 */
export function sortCurriculumActivities(
  activities: readonly CurriculumActivity[]
): CurriculumActivity[] {
  return [...activities].sort((a, b) => {
    const challengeDiff =
      (a.format === 'challenge' ? 1 : 0) - (b.format === 'challenge' ? 1 : 0);
    if (challengeDiff !== 0) {
      return challengeDiff;
    }
    return compareCurriculumActivityIds(a.id, b.id, a.moduleId, b.moduleId);
  });
}

/**
 * Aggregated curriculum activities across Modules 1–3 in canonical curriculum order.
 * Downstream curriculum slices spread into this list and are ordered automatically via
 * `sortCurriculumActivities` regardless of slice file grouping.
 */
export const CURRICULUM_ACTIVITIES: CurriculumActivity[] = sortCurriculumActivities([
  ...MODULE_1_DEMO_ACTIVITIES,
  ...MODULE_1_ROBOT_ACTIVITIES,
  ...MODULE_1_LOGO_ACTIVITIES,
  ...MODULE_1_BEAT_ACTIVITIES,
  ...MODULE_2_PARAMS_ACTIVITIES,
  ...MODULE_2_OBJECTS_ACTIVITIES,
  ...MODULE_3_PART1_ACTIVITIES,
]);

export function getCurriculumModules(): CurriculumModule[] {
  return CURRICULUM_MODULES;
}

export function getCurriculumModule(moduleId: string): CurriculumModule | undefined {
  return CURRICULUM_MODULES.find((m) => m.id === moduleId);
}

export function getCurriculumActivities(): CurriculumActivity[] {
  return CURRICULUM_ACTIVITIES;
}

export function getActivitiesForModule(moduleId: string): CurriculumActivity[] {
  return sortCurriculumActivities(
    CURRICULUM_ACTIVITIES.filter((a) => a.moduleId === moduleId)
  );
}

/**
 * Returns the latest definition for a given curriculum activity ID.
 */
export function getActivityLatest(
  activityId: string,
  catalog: readonly CurriculumActivity[] = CURRICULUM_ACTIVITIES
): CurriculumActivity | undefined {
  return catalog.find((a) => a.id === activityId);
}

/**
 * Resolves a curriculum activity at a specific version number.
 * Returns the latest activity when `version === latest.version`, or reconstructs
 * the historical definition from `latest.historicalVersions[version]` when present.
 */
export function getActivityAtVersion(
  activityId: string,
  version: number,
  catalog: readonly CurriculumActivity[] = CURRICULUM_ACTIVITIES
): CurriculumActivity | undefined {
  const latest = getActivityLatest(activityId, catalog);
  if (!latest) return undefined;

  if (version === latest.version) {
    return latest;
  }

  const historical = latest.historicalVersions?.[version];
  if (!historical) {
    return undefined;
  }

  return {
    id: latest.id,
    moduleId: latest.moduleId,
    version: historical.version,
    format: latest.format,
    capstoneType: latest.capstoneType,
    simId: latest.simId,
    icon: latest.icon,
    title: latest.title,
    concept: latest.concept,
    description: latest.description,
    hint: latest.hint,
    grid: historical.grid,
    starterWorkspace: historical.starterWorkspace,
    palette: historical.palette,
    slotCap: historical.slotCap,
    partialHelp: historical.partialHelp,
    referenceSolution: historical.referenceSolution,
    variations: historical.variations,
    demoTabs: historical.demoTabs,
    antiBypassRules: historical.antiBypassRules,
    historicalVersions: latest.historicalVersions,
  };
}
