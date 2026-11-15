export * from './types';

import {
  CurriculumActivity,
  CurriculumModule,
  MasteryChallengeTier,
} from './types';
import { SEQ_ACTIVITIES } from './seqActivities';
import { PARAM_ACTIVITIES } from './paramActivities';
import { LOOP_ACTIVITIES } from './loopActivities';
import { FUNC_ACTIVITIES } from './funcActivities';

export { SEQ_ACTIVITIES, SEQ_0_DEMO_TABS, SEQ_BEAT_ALLOWED_BLOCKS } from './seqActivities';
export {
  PARAM_ACTIVITIES,
  PARAM_0_DEMO_TABS,
  PARAM_6_DEMO_TABS,
  PARAM_7_DEMO_TABS,
} from './paramActivities';
export {
  LOOP_ACTIVITIES,
  LOOP_0_DEMO_TABS,
  LOOP_8_DEMO_TABS,
  LOOP_DEPOT_ALLOWED_BLOCKS,
} from './loopActivities';
export {
  FUNC_ACTIVITIES,
  FUNC_0_DEMO_TABS,
  FUNC_TURTLE_ALLOWED_BLOCKS,
  FUNC_CAPSTONE_TURTLE_ALLOWED_BLOCKS,
  FUNC_BEAT_ALLOWED_BLOCKS,
} from './funcActivities';

/**
 * One-way backward-compatibility aliases from V1 numeric module IDs
 * (`module-1`..`module-4`) to V2 lowercase slug module IDs.
 */
export const LEGACY_MODULE_ID_ALIASES: Record<string, string> = {
  'module-1': 'seq',
  'module-2': 'param',
  'module-3': 'loop',
  'module-4': 'func',
  'module-5': 'branch',
};

/**
 * One-way backward-compatibility aliases from V1 numeric/capstone activity IDs
 * (`1.0`..`5C`) to V2 slug activity IDs (`seq.0`..`branch.C`).
 */
export const LEGACY_ACTIVITY_ID_ALIASES: Record<string, string> = {
  // Module 1 -> seq
  '1.0': 'seq.0',
  '1.1': 'seq.1',
  '1.2': 'seq.2',
  '1.2a': 'seq.2a',
  '1.3': 'seq.3',
  '1.4': 'seq.4',
  '1.5': 'seq.5',
  '1.6': 'seq.6',
  '1.7': 'seq.7',
  '1.7a': 'seq.7a',
  '1.8': 'seq.8',
  '1A': 'seq.A',
  '1B': 'seq.B',
  '1C': 'seq.C',
  // Module 2 -> param
  '2.0': 'param.0',
  '2.1': 'param.1',
  '2.2': 'param.2',
  '2.3': 'param.3',
  '2.4': 'param.4',
  '2.5': 'param.5',
  '2.5a': 'param.6',
  '2C': 'param.C',
  '2.6': 'param.7',
  '2.7': 'param.8',
  '2.8': 'param.9',
  '2.9': 'param.10',
  '2A': 'param.A',
  '2B': 'param.B',
  // Module 3 -> loop
  '3.0': 'loop.0',
  '3.1': 'loop.1',
  '3.2': 'loop.2',
  '3.3': 'loop.3',
  '3.3a': 'loop.3a',
  '3.4': 'loop.4',
  '3.5': 'loop.5',
  '3.5a': 'loop.5a',
  '3.6': 'loop.6',
  '3.7': 'loop.7',
  '3.8': 'loop.8',
  '3.9': 'loop.9',
  '3.10': 'loop.10',
  '3.11': 'loop.11',
  '3A': 'loop.A',
  '3B': 'loop.B',
  '3C': 'loop.C',
  // Module 4 -> func
  '4.0': 'func.0',
  '4.1': 'func.1',
  '4.2': 'func.2',
  '4.3': 'func.3',
  '4.4': 'func.4',
  '4.5': 'func.5',
  '4.6': 'func.6',
  '4.7': 'func.7',
  '4A': 'func.A',
  '4B': 'func.B',
  '4C': 'func.C',
  // Module 5 -> branch
  '5.0': 'branch.0',
  '5.1': 'branch.1',
  '5.2': 'branch.2',
  '5.3': 'branch.3',
  '5.4': 'branch.4',
  '5.5': 'branch.5',
  '5.6': 'branch.6',
  '5.7': 'branch.7',
  '5.8': 'branch.8',
  '5.9': 'branch.9',
  '5.10': 'branch.10',
  '5A': 'branch.A',
  '5C': 'branch.C',
};

export function resolveModuleIdAlias(moduleId: string): string {
  return LEGACY_MODULE_ID_ALIASES[moduleId] ?? moduleId;
}

export function resolveActivityIdAlias(activityId: string): string {
  return LEGACY_ACTIVITY_ID_ALIASES[activityId] ?? activityId;
}

/**
 * Static Module catalog for Phase 1 Core Spine Modules (`seq`, `param`, `loop`, `func`).
 */
export const CURRICULUM_MODULES: CurriculumModule[] = [
  {
    id: 'seq',
    number: 1,
    title: 'Sequences — First Steps, Orientation & Visual Debugging',
    shortTitle: 'seq',
    icon: '🧭',
    badgeId: 'badge-seq',
    badgeTitle: 'Sequence Navigator',
    badgeIcon: '🏅',
    capstoneIds: ['seq.A', 'seq.B', 'seq.C'],
  },
  {
    id: 'param',
    number: 2,
    title: 'Parameters — Repeats, Angles, Colors & World Objects',
    shortTitle: 'param',
    icon: '🎛️',
    badgeId: 'badge-param',
    badgeTitle: 'Parameter & Gadget Crafter',
    badgeIcon: '🎖️',
    capstoneIds: ['param.C', 'param.A', 'param.B'],
  },
  {
    id: 'loop',
    number: 3,
    title: 'Loops — Repeating Sequences, Nested Loops & LIFO Stacks',
    shortTitle: 'loop',
    icon: '🔁',
    badgeId: 'badge-loop',
    badgeTitle: 'Loop Architect',
    badgeIcon: '🏆',
    capstoneIds: ['loop.A', 'loop.B', 'loop.C'],
  },
  {
    id: 'func',
    number: 4,
    title: 'Functions — Helper Decomposition, Layering & State Hygiene',
    shortTitle: 'func',
    icon: '🧩',
    badgeId: 'badge-func',
    badgeTitle: 'Function Composer',
    badgeIcon: '🧩',
    capstoneIds: ['func.A', 'func.B', 'func.C'],
  },
];

/**
 * Phase 1 includes only the 4 Core modules (`seq`, `param`, `loop`, `func`);
 * Mastery Challenges unlock in later phases.
 */
export const MASTERY_CHALLENGE_TIERS: MasteryChallengeTier[] = [];

const SLUG_MODULE_ORDER: Record<string, number> = {
  seq: 1,
  param: 2,
  loop: 3,
  func: 4,
  branch: 5,
  while: 6,
  var: 7,
  cmp: 8,
  tape: 9,
  sort: 10,
  args: 11,
  rec: 12,
  inter: 13,
  anim: 14,
  conc: 15,
  fp: 16,
};

interface ParsedCurriculumActivityId {
  familyRank: number;
  moduleNum: number;
  /** 0 = numbered lesson (plus `param.C`), 1 = module capstone (e.g. `seq.A`, `1A`), 2 = other/challenge */
  kindRank: number;
  lessonNum: number;
  suffix: string;
}

const PEDAGOGICAL_LESSON_NUM_OVERRIDES: Record<
  string,
  { slug: keyof typeof SLUG_MODULE_ORDER; lessonNum: number }
> = {
  'param.C': { slug: 'param', lessonNum: 6.5 },
  'branch.9': { slug: 'branch', lessonNum: 7.05 },
  'branch.7a': { slug: 'branch', lessonNum: 7.1 },
  'branch.7b': { slug: 'branch', lessonNum: 7.2 },
  'branch.8a': { slug: 'branch', lessonNum: 7.9 },
  'branch.10a': { slug: 'branch', lessonNum: 9.9 },
};

function parseCurriculumActivityId(
  id: string,
  moduleId?: string
): ParsedCurriculumActivityId {
  const override = PEDAGOGICAL_LESSON_NUM_OVERRIDES[id];
  if (override) {
    return {
      familyRank: 0,
      moduleNum: SLUG_MODULE_ORDER[override.slug],
      kindRank: 0,
      lessonNum: override.lessonNum,
      suffix: '',
    };
  }

  const slugChallengeMatch = /^([a-z]+)\.(M\d+.*)$/i.exec(id);
  if (slugChallengeMatch && SLUG_MODULE_ORDER[slugChallengeMatch[1].toLowerCase()]) {
    const slug = slugChallengeMatch[1].toLowerCase();
    const digits = /^\D*(\d+)/.exec(slugChallengeMatch[2]);
    return {
      familyRank: 0,
      moduleNum: SLUG_MODULE_ORDER[slug],
      kindRank: 2,
      lessonNum: digits ? Number(digits[1]) : 0,
      suffix: slugChallengeMatch[2].toUpperCase(),
    };
  }

  const slugLessonMatch = /^([a-z]+)\.(\d+)(.*)$/i.exec(id);
  if (slugLessonMatch && SLUG_MODULE_ORDER[slugLessonMatch[1].toLowerCase()]) {
    const slug = slugLessonMatch[1].toLowerCase();
    return {
      familyRank: 0,
      moduleNum: SLUG_MODULE_ORDER[slug],
      kindRank: 0,
      lessonNum: Number(slugLessonMatch[2]),
      suffix: slugLessonMatch[3] ?? '',
    };
  }

  const slugCapstoneMatch = /^([a-z]+)\.([A-Za-z]+.*)$/.exec(id);
  if (slugCapstoneMatch && SLUG_MODULE_ORDER[slugCapstoneMatch[1].toLowerCase()]) {
    const slug = slugCapstoneMatch[1].toLowerCase();
    return {
      familyRank: 0,
      moduleNum: SLUG_MODULE_ORDER[slug],
      kindRank: 1,
      lessonNum: 0,
      suffix: slugCapstoneMatch[2].toUpperCase(),
    };
  }

  const legacyLessonMatch = /^(\d+)\.(\d+)(.*)$/.exec(id);
  if (legacyLessonMatch) {
    return {
      familyRank: 1,
      moduleNum: Number(legacyLessonMatch[1]),
      kindRank: 0,
      lessonNum: Number(legacyLessonMatch[2]),
      suffix: legacyLessonMatch[3] ?? '',
    };
  }

  const legacyCapstoneMatch = /^(\d+)([A-Za-z]+)(.*)$/.exec(id);
  if (legacyCapstoneMatch) {
    return {
      familyRank: 1,
      moduleNum: Number(legacyCapstoneMatch[1]),
      kindRank: 1,
      lessonNum: 0,
      suffix: `${legacyCapstoneMatch[2].toUpperCase()}${legacyCapstoneMatch[3] ?? ''}`,
    };
  }

  const resolvedModuleId = moduleId ? resolveModuleIdAlias(moduleId) : undefined;
  const legacyModMatch = resolvedModuleId ? /^module-(\d+)$/.exec(resolvedModuleId) : null;
  const moduleNum =
    resolvedModuleId && SLUG_MODULE_ORDER[resolvedModuleId]
      ? SLUG_MODULE_ORDER[resolvedModuleId]
      : legacyModMatch
        ? Number(legacyModMatch[1])
        : Number.MAX_SAFE_INTEGER;

  return {
    familyRank: 2,
    moduleNum,
    kindRank: 2,
    lessonNum: 0,
    suffix: id,
  };
}

/**
 * Compares two curriculum activity IDs in canonical pedagogical play order
 * (supporting both V2 slug IDs `seq.0`..`func.C` with `param.C` between `param.6`
 * and `param.7` and legacy/synthetic IDs like `1.0`, `5.10`, `5A`, `9.10`, `9C`, `C6.1`).
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
  const suffixDiff = a.suffix.localeCompare(b.suffix);
  if (suffixDiff !== 0) {
    return suffixDiff;
  }
  if (a.familyRank !== b.familyRank) {
    return a.familyRank - b.familyRank;
  }
  return idA.localeCompare(idB);
}

/**
 * Returns a canonically ordered shallow copy of `activities` across all modules
 * (`seq.0`..`seq.C`, `param.0`..`param.6`, `param.C`, `param.7`..`param.B`, `loop.0`..`loop.C`, `func.0`..`func.C`),
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
 * Aggregated Phase 1 curriculum activities (`56` total across `seq`, `param`, `loop`, `func`)
 * ordered in canonical play order via `sortCurriculumActivities`.
 */
export const CURRICULUM_ACTIVITIES: CurriculumActivity[] = sortCurriculumActivities([
  ...SEQ_ACTIVITIES,
  ...PARAM_ACTIVITIES,
  ...LOOP_ACTIVITIES,
  ...FUNC_ACTIVITIES,
]);

export function getCurriculumModules(): CurriculumModule[] {
  return CURRICULUM_MODULES;
}

export function getCurriculumModule(moduleId: string): CurriculumModule | undefined {
  const direct = CURRICULUM_MODULES.find((m) => m.id === moduleId);
  if (direct) return direct;
  const resolved = resolveModuleIdAlias(moduleId);
  return CURRICULUM_MODULES.find((m) => m.id === resolved);
}

export function getCurriculumActivities(): CurriculumActivity[] {
  return CURRICULUM_ACTIVITIES;
}

export function getActivitiesForModule(moduleId: string): CurriculumActivity[] {
  const hasDirect = CURRICULUM_ACTIVITIES.some((a) => a.moduleId === moduleId);
  const resolved = hasDirect ? moduleId : resolveModuleIdAlias(moduleId);
  return sortCurriculumActivities(
    CURRICULUM_ACTIVITIES.filter((a) => a.moduleId === resolved)
  );
}

/**
 * Returns the latest definition for a given canonical or legacy curriculum activity ID.
 */
export function getActivityLatest(
  activityId: string,
  catalog: readonly CurriculumActivity[] = CURRICULUM_ACTIVITIES
): CurriculumActivity | undefined {
  const direct = catalog.find((a) => a.id === activityId);
  if (direct) return direct;
  const resolved = resolveActivityIdAlias(activityId);
  if (resolved === activityId) return undefined;
  return catalog.find((a) => a.id === resolved);
}

/**
 * Resolves a curriculum activity (by canonical or legacy ID) at a specific version number.
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
    turtle: historical.turtle ?? latest.turtle,
    beatRules: historical.beatRules ?? latest.beatRules,
    inputConfig: historical.inputConfig ?? latest.inputConfig,
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
