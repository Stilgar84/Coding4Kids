export * from './types';

import { CurriculumActivity, CurriculumModule } from './types';
import { MODULE_1_DEMO_ACTIVITIES } from './module1Demo';
import { MODULE_1_ROBOT_ACTIVITIES } from './module1Robot';
import { MODULE_1_LOGO_ACTIVITIES } from './module1Logo';
import { MODULE_1_BEAT_ACTIVITIES } from './module1Beat';

export { MODULE_1_DEMO_ACTIVITIES } from './module1Demo';
export { MODULE_1_ROBOT_ACTIVITIES } from './module1Robot';
export { MODULE_1_LOGO_ACTIVITIES } from './module1Logo';
export { MODULE_1_BEAT_ACTIVITIES } from './module1Beat';

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

/**
 * Aggregated curriculum activities across Modules 1–3.
 * Downstream curriculum slices spread into this list in canonical pedagogical order.
 */
export const CURRICULUM_ACTIVITIES: CurriculumActivity[] = [
  ...MODULE_1_DEMO_ACTIVITIES,
  ...MODULE_1_ROBOT_ACTIVITIES,
  ...MODULE_1_LOGO_ACTIVITIES,
  ...MODULE_1_BEAT_ACTIVITIES,
];

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
  return CURRICULUM_ACTIVITIES.filter((a) => a.moduleId === moduleId);
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
