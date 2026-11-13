export * from './types';

import {
  CurriculumActivity,
  CurriculumModule,
  MasteryChallengeTier,
} from './types';
import { MODULE_1_DEMO_ACTIVITIES } from './module1Demo';
import { MODULE_1_ROBOT_ACTIVITIES } from './module1Robot';
import { MODULE_1_LOGO_ACTIVITIES } from './module1Logo';
import { MODULE_1_BEAT_ACTIVITIES } from './module1Beat';
import { MODULE_2_PARAMS_ACTIVITIES } from './module2Params';
import { MODULE_2_OBJECTS_ACTIVITIES } from './module2Objects';
import { MODULE_3_PART1_ACTIVITIES } from './module3Part1';
import { MODULE_3_BEAT_ACTIVITIES } from './module3Beat';
import { MODULE_3_PART2_ACTIVITIES } from './module3Part2';
import { MODULE_3_DEPOT_ACTIVITIES } from './module3Depot';
import { MODULE_4_CREATIVE_ACTIVITIES } from './module4CreativeAndDemo';

export { MODULE_1_DEMO_ACTIVITIES } from './module1Demo';
export { MODULE_1_ROBOT_ACTIVITIES } from './module1Robot';
export { MODULE_1_LOGO_ACTIVITIES } from './module1Logo';
export { MODULE_1_BEAT_ACTIVITIES } from './module1Beat';
export { MODULE_2_PARAMS_ACTIVITIES, MODULE_2_BEAT_ALLOWED_BLOCKS } from './module2Params';
export { MODULE_2_OBJECTS_ACTIVITIES } from './module2Objects';
export { MODULE_3_PART1_ACTIVITIES } from './module3Part1';
export { MODULE_3_BEAT_ACTIVITIES, MODULE_3_BEAT_ALLOWED_BLOCKS } from './module3Beat';
export {
  MODULE_3_PART2_ACTIVITIES,
  LESSON_3_5_GRID,
  LESSON_3_6_GRID,
  CAPSTONE_3A_GRID,
} from './module3Part2';
export {
  MODULE_3_DEPOT_ACTIVITIES,
  MODULE_3_DEPOT_ALLOWED_BLOCKS,
} from './module3Depot';
export {
  MODULE_4_CREATIVE_ACTIVITIES,
  MODULE_4_TURTLE_ALLOWED_BLOCKS,
} from './module4CreativeAndDemo';

/**
 * Static Module catalog for Modules 1–6.
 * Declaring badgeId and capstoneIds statically decouples
 * Reward/Badge UI from individual Capstone authoring slices.
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
    title: 'Loops — Repeating Sequences, Frame Animation & LIFO Stacks',
    shortTitle: 'Module 3',
    icon: '🔁',
    badgeId: 'badge-module-3',
    badgeTitle: 'Loop Architect',
    badgeIcon: '🏆',
    capstoneIds: ['3A', '3B', '3C'],
  },
  {
    id: 'module-4',
    number: 4,
    title: 'Functions — Abstraction, Naming & Decomposition',
    shortTitle: 'Module 4',
    icon: '🧩',
    badgeId: 'badge-module-4',
    badgeTitle: 'Function Composer',
    badgeIcon: '🧩',
    capstoneIds: ['4A', '4B', '4C'],
  },
  {
    id: 'module-5',
    number: 5,
    title: 'Sensors, Conditionals & FIFO Queues',
    shortTitle: 'Module 5',
    icon: '📡',
    badgeId: 'badge-module-5',
    badgeTitle: 'Sensor Navigator',
    badgeIcon: '📡',
    capstoneIds: ['5A', '5B'],
  },
  {
    id: 'module-6',
    number: 6,
    title: 'Variables, Pose Sensors & Stepping Counters',
    shortTitle: 'Module 6',
    icon: '📦',
    badgeId: 'badge-module-6',
    badgeTitle: 'Memory Master',
    badgeIcon: '📦',
    capstoneIds: ['6A', '6B'],
  },
];

/**
 * 5-Tier Post-Module Mastery Challenge metadata.
 * Tier 1 unlocks after Module 6 completion (challengeIds C6.1 & C6.2); Tiers 2–5 are
 * reserved for Modules 8–11.
 */
export const MASTERY_CHALLENGE_TIERS: MasteryChallengeTier[] = [
  {
    tier: 1,
    id: 'tier-1',
    title: 'Tier 1 Mastery Challenges',
    badgeId: 'badge-challenge-tier-1',
    unlockAfterModuleId: 'module-6',
    challengeIds: ['C6.1', 'C6.2'],
  },
  {
    tier: 2,
    id: 'tier-2',
    title: 'Tier 2 Mastery Challenges',
    badgeId: 'badge-challenge-tier-2',
    unlockAfterModuleId: 'module-8',
    challengeIds: [],
  },
  {
    tier: 3,
    id: 'tier-3',
    title: 'Tier 3 Mastery Challenges',
    badgeId: 'badge-challenge-tier-3',
    unlockAfterModuleId: 'module-9',
    challengeIds: [],
  },
  {
    tier: 4,
    id: 'tier-4',
    title: 'Tier 4 Mastery Challenges',
    badgeId: 'badge-challenge-tier-4',
    unlockAfterModuleId: 'module-10',
    challengeIds: [],
  },
  {
    tier: 5,
    id: 'tier-5',
    title: 'Tier 5 Mastery Challenges',
    badgeId: 'badge-challenge-tier-5',
    unlockAfterModuleId: 'module-11',
    challengeIds: [],
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
  ...MODULE_3_BEAT_ACTIVITIES,
  ...MODULE_3_PART2_ACTIVITIES,
  ...MODULE_3_DEPOT_ACTIVITIES,
  ...MODULE_4_CREATIVE_ACTIVITIES,
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
    gridVariants: historical.gridVariants,
    depot: historical.depot ?? latest.depot,
    depotVariants: historical.depotVariants,
    switchyard: historical.switchyard ?? latest.switchyard,
    switchyardVariants: historical.switchyardVariants,
    defaultLoopPlayback: historical.defaultLoopPlayback,
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
