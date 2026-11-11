import { CodeBlock, WorkspaceState } from '../types';
import { CURRICULUM_MODULES, getActivitiesForModule } from '../data/curriculum';
import {
  deleteProgramsForProfile,
  getStorageItem,
  migrateLegacySavedProgramsToDefault,
  removeStorageItem,
  setStorageItem,
} from './localSaveService';

export const PROFILES_STORAGE_KEY = 'robotemu_profiles_v1';
export const LESSON_AUTOSAVE_STORAGE_KEY = 'robotemu_lesson_autosave_v1';
export const CURRICULUM_PROGRESS_STORAGE_KEY = 'robotemu_curriculum_progress_v1';

export const PROFILES_SCHEMA_VERSION = 1;
export const LESSON_AUTOSAVE_SCHEMA_VERSION = 1;
export const CURRICULUM_PROGRESS_SCHEMA_VERSION = 1;

export const DEFAULT_PROFILE_ID = 'default';

export type ProfileAvatarId =
  | 'robot'
  | 'frog'
  | 'fox'
  | 'owl'
  | 'cat'
  | 'panda'
  | 'rocket'
  | 'turtle';

export type ProfileColorId = 'sky' | 'emerald' | 'amber' | 'violet' | 'rose' | 'orange';

export interface ProfileAvatarOption {
  id: ProfileAvatarId;
  emoji: string;
  label: string;
}

export interface ProfileColorOption {
  id: ProfileColorId;
  accentColor: string;
  /** Distinct geometric cue paired with color for color-blind accessibility */
  shapeSymbol: string;
  shapeName: string;
  label: string;
}

export const PROFILE_AVATARS: readonly ProfileAvatarOption[] = [
  { id: 'robot', emoji: '🤖', label: 'Robot' },
  { id: 'frog', emoji: '🐸', label: 'Frog' },
  { id: 'fox', emoji: '🦊', label: 'Fox' },
  { id: 'owl', emoji: '🦉', label: 'Owl' },
  { id: 'cat', emoji: '🐱', label: 'Cat' },
  { id: 'panda', emoji: '🐼', label: 'Panda' },
  { id: 'rocket', emoji: '🚀', label: 'Rocket' },
  { id: 'turtle', emoji: '🐢', label: 'Turtle' },
] as const;

export const PROFILE_COLORS: readonly ProfileColorOption[] = [
  {
    id: 'sky',
    accentColor: '#0ea5e9',
    shapeSymbol: '●',
    shapeName: 'Circle',
    label: 'Blue Circle',
  },
  {
    id: 'emerald',
    accentColor: '#10b981',
    shapeSymbol: '▲',
    shapeName: 'Triangle',
    label: 'Green Triangle',
  },
  {
    id: 'amber',
    accentColor: '#f59e0b',
    shapeSymbol: '■',
    shapeName: 'Square',
    label: 'Amber Square',
  },
  {
    id: 'violet',
    accentColor: '#8b5cf6',
    shapeSymbol: '◆',
    shapeName: 'Diamond',
    label: 'Purple Diamond',
  },
  {
    id: 'rose',
    accentColor: '#f43f5e',
    shapeSymbol: '★',
    shapeName: 'Star',
    label: 'Pink Star',
  },
  {
    id: 'orange',
    accentColor: '#f97316',
    shapeSymbol: '⬟',
    shapeName: 'Pentagon',
    label: 'Orange Pentagon',
  },
] as const;

export interface UserProfile {
  id: string;
  avatarId: ProfileAvatarId;
  colorId: ProfileColorId;
  accentColor: string;
  name: string;
  createdAt: number;
}

export interface ProfilesStoreV1 {
  version: number;
  activeProfileId: string;
  profiles: UserProfile[];
}

export interface CreateProfileInput {
  avatarId: ProfileAvatarId;
  colorId?: ProfileColorId;
  name?: string;
}

export interface LessonAutosaveEntry {
  workspace: WorkspaceState;
  lessonVersion: number;
  updatedAt: number;
}

export interface SandboxAutosaveEntry {
  workspace: WorkspaceState;
  updatedAt: number;
}

export interface ProfileAutosaveData {
  lessons: Record<string, LessonAutosaveEntry>;
  sandbox: Record<string, SandboxAutosaveEntry>;
}

export interface LessonAutosaveStoreV1 {
  version: number;
  profiles: Record<string, ProfileAutosaveData>;
}

export interface LessonCompletionRecord {
  completedAt: number;
  version: number;
}

export interface ProfileCurriculumProgress {
  completedLessons: Record<string, LessonCompletionRecord>;
  unlockedModules: string[];
  earnedBadges: string[];
}

export interface CurriculumProgressStoreV1 {
  version: number;
  profiles: Record<string, ProfileCurriculumProgress>;
}

export interface MarkLessonCompletedResult {
  progress: ProfileCurriculumProgress;
  newlyCompleted: boolean;
  newlyEarnedBadges: string[];
}

const VALID_AVATAR_IDS = new Set<string>(PROFILE_AVATARS.map((a) => a.id));
const VALID_COLOR_IDS = new Set<string>(PROFILE_COLORS.map((c) => c.id));

export function getProfileAvatar(avatarId: string): ProfileAvatarOption {
  return PROFILE_AVATARS.find((a) => a.id === avatarId) ?? PROFILE_AVATARS[0];
}

export function getProfileColor(colorId: string): ProfileColorOption {
  return PROFILE_COLORS.find((c) => c.id === colorId) ?? PROFILE_COLORS[0];
}

export function getProfileDisplayName(profile: UserProfile): string {
  const trimmed = profile.name?.trim();
  if (trimmed) return trimmed;
  return getProfileAvatar(profile.avatarId).label;
}

function createDefaultProfile(now: number = Date.now()): UserProfile {
  const defaultColor = getProfileColor('sky');
  return {
    id: DEFAULT_PROFILE_ID,
    avatarId: 'robot',
    colorId: defaultColor.id,
    accentColor: defaultColor.accentColor,
    name: 'Player 1',
    createdAt: now,
  };
}

function sanitizeProfile(raw: unknown, fallbackNow: number = Date.now()): UserProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.id !== 'string' || !obj.id.trim()) return null;

  const avatarId: ProfileAvatarId =
    typeof obj.avatarId === 'string' && VALID_AVATAR_IDS.has(obj.avatarId)
      ? (obj.avatarId as ProfileAvatarId)
      : 'robot';

  const colorId: ProfileColorId =
    typeof obj.colorId === 'string' && VALID_COLOR_IDS.has(obj.colorId)
      ? (obj.colorId as ProfileColorId)
      : 'sky';

  const colorOpt = getProfileColor(colorId);
  const accentColor =
    typeof obj.accentColor === 'string' && obj.accentColor.trim()
      ? obj.accentColor.trim()
      : colorOpt.accentColor;

  const name = typeof obj.name === 'string' ? obj.name.trim().slice(0, 24) : '';
  const createdAt = typeof obj.createdAt === 'number' ? obj.createdAt : fallbackNow;

  return {
    id: obj.id.trim(),
    avatarId,
    colorId,
    accentColor,
    name,
    createdAt,
  };
}

function sanitizeBlockList(raw: unknown): CodeBlock[] {
  if (!Array.isArray(raw)) return [];
  const blocks: CodeBlock[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    if (typeof obj.id !== 'string' || !obj.id || typeof obj.type !== 'string' || !obj.type) {
      continue;
    }
    const block: CodeBlock = {
      id: obj.id,
      type: obj.type,
    };
    if (typeof obj.repeatCount === 'number' || typeof obj.repeatCount === 'string') {
      block.repeatCount = obj.repeatCount as CodeBlock['repeatCount'];
    }
    if (obj.params && typeof obj.params === 'object' && !Array.isArray(obj.params)) {
      block.params = JSON.parse(JSON.stringify(obj.params));
    }
    blocks.push(block);
  }
  return blocks;
}

export function sanitizeAutosaveWorkspace(raw: unknown): WorkspaceState {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    MAIN: sanitizeBlockList(src.MAIN),
    F1: sanitizeBlockList(src.F1),
    F2: sanitizeBlockList(src.F2),
    F3: sanitizeBlockList(src.F3),
  };
}

/**
 * Ensures `robotemu_profiles_v1` is initialized with at least the `'default'` profile,
 * guarantees a valid `activeProfileId`, and runs non-destructive legacy save association
 * on `robotemu_saved_programs` -> `'default'`.
 */
export function ensureProfilesInitialized(now: number = Date.now()): ProfilesStoreV1 {
  migrateLegacySavedProgramsToDefault(DEFAULT_PROFILE_ID);

  const raw = getStorageItem(PROFILES_STORAGE_KEY);
  let profiles: UserProfile[] = [];
  let activeProfileId = DEFAULT_PROFILE_ID;
  let needsWrite = false;

  if (!raw) {
    profiles = [createDefaultProfile(now)];
    activeProfileId = DEFAULT_PROFILE_ID;
    needsWrite = true;
  } else {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const rawList = Array.isArray(parsed.profiles) ? parsed.profiles : [];
        const seenIds = new Set<string>();
        for (const item of rawList) {
          const sanitized = sanitizeProfile(item, now);
          if (sanitized && !seenIds.has(sanitized.id)) {
            seenIds.add(sanitized.id);
            profiles.push(sanitized);
          }
        }
        if (typeof parsed.activeProfileId === 'string' && parsed.activeProfileId.trim()) {
          activeProfileId = parsed.activeProfileId.trim();
        }
      } else {
        needsWrite = true;
      }
    } catch {
      needsWrite = true;
    }

    if (!profiles.some((p) => p.id === DEFAULT_PROFILE_ID)) {
      profiles.unshift(createDefaultProfile(now));
      needsWrite = true;
    }

    if (!profiles.some((p) => p.id === activeProfileId)) {
      activeProfileId = DEFAULT_PROFILE_ID;
      needsWrite = true;
    }
  }

  const store: ProfilesStoreV1 = {
    version: PROFILES_SCHEMA_VERSION,
    activeProfileId,
    profiles,
  };

  if (needsWrite) {
    setStorageItem(PROFILES_STORAGE_KEY, JSON.stringify(store));
  }

  return store;
}

export function getProfilesState(): ProfilesStoreV1 {
  return ensureProfilesInitialized();
}

export function getProfiles(): UserProfile[] {
  return ensureProfilesInitialized().profiles;
}

export function getActiveProfileId(): string {
  return ensureProfilesInitialized().activeProfileId;
}

export function getActiveProfile(): UserProfile {
  const state = ensureProfilesInitialized();
  return state.profiles.find((p) => p.id === state.activeProfileId) ?? state.profiles[0];
}

export function createProfile(input: CreateProfileInput, now: number = Date.now()): UserProfile {
  const state = ensureProfilesInitialized(now);

  const avatarOption = getProfileAvatar(input.avatarId);

  let chosenColorId: ProfileColorId = input.colorId
    ? getProfileColor(input.colorId).id
    : 'emerald';

  if (!input.colorId) {
    const usedColors = new Set(state.profiles.map((p) => p.colorId));
    const unused = PROFILE_COLORS.find((c) => !usedColors.has(c.id));
    if (unused) {
      chosenColorId = unused.id;
    } else {
      chosenColorId = PROFILE_COLORS[state.profiles.length % PROFILE_COLORS.length].id;
    }
  }

  const colorOption = getProfileColor(chosenColorId);
  const trimmedName = typeof input.name === 'string' ? input.name.trim().slice(0, 24) : '';
  const id = `profile_${now}_${Math.random().toString(36).substring(2, 7)}`;

  const newProfile: UserProfile = {
    id,
    avatarId: avatarOption.id,
    colorId: colorOption.id,
    accentColor: colorOption.accentColor,
    name: trimmedName,
    createdAt: now,
  };

  const nextState: ProfilesStoreV1 = {
    version: PROFILES_SCHEMA_VERSION,
    activeProfileId: state.activeProfileId,
    profiles: [...state.profiles, newProfile],
  };

  setStorageItem(PROFILES_STORAGE_KEY, JSON.stringify(nextState));
  return newProfile;
}

export function updateProfile(
  profileId: string,
  updates: Partial<CreateProfileInput>
): UserProfile | null {
  const state = ensureProfilesInitialized();
  const idx = state.profiles.findIndex((p) => p.id === profileId);
  if (idx < 0) return null;

  const existing = state.profiles[idx];
  const nextAvatarId = updates.avatarId ? getProfileAvatar(updates.avatarId).id : existing.avatarId;
  const nextColorOpt = updates.colorId
    ? getProfileColor(updates.colorId)
    : getProfileColor(existing.colorId);
  const nextName =
    updates.name !== undefined ? updates.name.trim().slice(0, 24) : existing.name;

  const updated: UserProfile = {
    ...existing,
    avatarId: nextAvatarId,
    colorId: nextColorOpt.id,
    accentColor: nextColorOpt.accentColor,
    name: nextName,
  };

  const nextProfiles = [...state.profiles];
  nextProfiles[idx] = updated;

  setStorageItem(
    PROFILES_STORAGE_KEY,
    JSON.stringify({
      version: PROFILES_SCHEMA_VERSION,
      activeProfileId: state.activeProfileId,
      profiles: nextProfiles,
    } satisfies ProfilesStoreV1)
  );

  return updated;
}

export function setActiveProfileId(profileId: string): UserProfile | null {
  const state = ensureProfilesInitialized();
  const found = state.profiles.find((p) => p.id === profileId);
  if (!found) return null;

  const nextState: ProfilesStoreV1 = {
    version: PROFILES_SCHEMA_VERSION,
    activeProfileId: found.id,
    profiles: state.profiles,
  };

  setStorageItem(PROFILES_STORAGE_KEY, JSON.stringify(nextState));
  return found;
}

/**
 * Deletes a non-default profile along with its isolated lesson auto-saves,
 * curriculum progress, and profile-scoped saved programs.
 * The `'default'` profile can never be deleted.
 */
export function deleteProfile(profileId: string): boolean {
  if (!profileId || profileId === DEFAULT_PROFILE_ID) {
    return false;
  }

  const state = ensureProfilesInitialized();
  if (!state.profiles.some((p) => p.id === profileId)) {
    return false;
  }

  const remainingProfiles = state.profiles.filter((p) => p.id !== profileId);
  const nextActiveProfileId =
    state.activeProfileId === profileId ? DEFAULT_PROFILE_ID : state.activeProfileId;

  setStorageItem(
    PROFILES_STORAGE_KEY,
    JSON.stringify({
      version: PROFILES_SCHEMA_VERSION,
      activeProfileId: nextActiveProfileId,
      profiles: remainingProfiles,
    } satisfies ProfilesStoreV1)
  );

  // Clean up isolated auto-saves for the deleted profile
  const autosaveStore = readAutosaveStore();
  if (autosaveStore.profiles[profileId]) {
    delete autosaveStore.profiles[profileId];
    writeAutosaveStore(autosaveStore);
  }

  // Clean up isolated curriculum progress for the deleted profile
  const progressStore = readProgressStore();
  if (progressStore.profiles[profileId]) {
    delete progressStore.profiles[profileId];
    writeProgressStore(progressStore);
  }

  // Clean up profile-scoped manual saves
  deleteProgramsForProfile(profileId);

  return true;
}

// ============================================================================
// Per-Profile Lesson & Sandbox Auto-Save (`robotemu_lesson_autosave_v1`)
// ============================================================================

function readAutosaveStore(): LessonAutosaveStoreV1 {
  const raw = getStorageItem(LESSON_AUTOSAVE_STORAGE_KEY);
  if (!raw) {
    return {
      version: LESSON_AUTOSAVE_SCHEMA_VERSION,
      profiles: {},
    };
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.profiles !== 'object' || !parsed.profiles) {
      return {
        version: LESSON_AUTOSAVE_SCHEMA_VERSION,
        profiles: {},
      };
    }

    const profiles: Record<string, ProfileAutosaveData> = {};
    for (const [profileId, rawBundle] of Object.entries(parsed.profiles as Record<string, unknown>)) {
      if (!rawBundle || typeof rawBundle !== 'object') continue;
      const b = rawBundle as Record<string, unknown>;
      const lessons: Record<string, LessonAutosaveEntry> = {};
      const sandbox: Record<string, SandboxAutosaveEntry> = {};

      if (b.lessons && typeof b.lessons === 'object') {
        for (const [lessonId, rawEntry] of Object.entries(b.lessons as Record<string, unknown>)) {
          if (!rawEntry || typeof rawEntry !== 'object') continue;
          const e = rawEntry as Record<string, unknown>;
          lessons[lessonId] = {
            workspace: sanitizeAutosaveWorkspace(e.workspace),
            lessonVersion: typeof e.lessonVersion === 'number' ? e.lessonVersion : 1,
            updatedAt: typeof e.updatedAt === 'number' ? e.updatedAt : 0,
          };
        }
      }

      if (b.sandbox && typeof b.sandbox === 'object') {
        for (const [simId, rawEntry] of Object.entries(b.sandbox as Record<string, unknown>)) {
          if (!rawEntry || typeof rawEntry !== 'object') continue;
          const e = rawEntry as Record<string, unknown>;
          sandbox[simId] = {
            workspace: sanitizeAutosaveWorkspace(e.workspace),
            updatedAt: typeof e.updatedAt === 'number' ? e.updatedAt : 0,
          };
        }
      }

      profiles[profileId] = { lessons, sandbox };
    }

    return {
      version: LESSON_AUTOSAVE_SCHEMA_VERSION,
      profiles,
    };
  } catch {
    return {
      version: LESSON_AUTOSAVE_SCHEMA_VERSION,
      profiles: {},
    };
  }
}

function writeAutosaveStore(store: LessonAutosaveStoreV1): void {
  setStorageItem(LESSON_AUTOSAVE_STORAGE_KEY, JSON.stringify(store));
}

export function getProfileAutosaveData(profileId: string): ProfileAutosaveData {
  const store = readAutosaveStore();
  return (
    store.profiles[profileId] ?? {
      lessons: {},
      sandbox: {},
    }
  );
}

export function saveLessonAutosave(
  profileId: string,
  lessonId: string,
  workspace: WorkspaceState,
  lessonVersion: number = 1,
  now: number = Date.now()
): LessonAutosaveEntry {
  const targetProfileId = profileId || DEFAULT_PROFILE_ID;
  const store = readAutosaveStore();
  const bundle = store.profiles[targetProfileId] ?? { lessons: {}, sandbox: {} };

  const entry: LessonAutosaveEntry = {
    workspace: sanitizeAutosaveWorkspace(workspace),
    lessonVersion,
    updatedAt: now,
  };

  bundle.lessons[lessonId] = entry;
  store.profiles[targetProfileId] = bundle;
  writeAutosaveStore(store);

  return entry;
}

export function getLessonAutosave(
  profileId: string,
  lessonId: string
): LessonAutosaveEntry | null {
  const bundle = getProfileAutosaveData(profileId || DEFAULT_PROFILE_ID);
  const entry = bundle.lessons[lessonId];
  if (!entry) return null;
  return {
    workspace: sanitizeAutosaveWorkspace(entry.workspace),
    lessonVersion: entry.lessonVersion,
    updatedAt: entry.updatedAt,
  };
}

export function getProfileLessonWorkspaces(profileId: string): Record<string, WorkspaceState> {
  const bundle = getProfileAutosaveData(profileId || DEFAULT_PROFILE_ID);
  const result: Record<string, WorkspaceState> = {};
  for (const [lessonId, entry] of Object.entries(bundle.lessons)) {
    result[lessonId] = sanitizeAutosaveWorkspace(entry.workspace);
  }
  return result;
}

export function deleteLessonAutosave(profileId: string, lessonId: string): boolean {
  const targetProfileId = profileId || DEFAULT_PROFILE_ID;
  const store = readAutosaveStore();
  const bundle = store.profiles[targetProfileId];
  if (!bundle || !bundle.lessons[lessonId]) return false;
  delete bundle.lessons[lessonId];
  writeAutosaveStore(store);
  return true;
}

export function saveSandboxAutosave(
  profileId: string,
  simId: string,
  workspace: WorkspaceState,
  now: number = Date.now()
): SandboxAutosaveEntry {
  const targetProfileId = profileId || DEFAULT_PROFILE_ID;
  const store = readAutosaveStore();
  const bundle = store.profiles[targetProfileId] ?? { lessons: {}, sandbox: {} };

  const entry: SandboxAutosaveEntry = {
    workspace: sanitizeAutosaveWorkspace(workspace),
    updatedAt: now,
  };

  bundle.sandbox[simId] = entry;
  store.profiles[targetProfileId] = bundle;
  writeAutosaveStore(store);

  return entry;
}

export function getSandboxAutosave(
  profileId: string,
  simId: string
): SandboxAutosaveEntry | null {
  const bundle = getProfileAutosaveData(profileId || DEFAULT_PROFILE_ID);
  const entry = bundle.sandbox[simId];
  if (!entry) return null;
  return {
    workspace: sanitizeAutosaveWorkspace(entry.workspace),
    updatedAt: entry.updatedAt,
  };
}

export function getProfileSandboxWorkspaces(profileId: string): Record<string, WorkspaceState> {
  const bundle = getProfileAutosaveData(profileId || DEFAULT_PROFILE_ID);
  const result: Record<string, WorkspaceState> = {};
  for (const [simId, entry] of Object.entries(bundle.sandbox)) {
    result[simId] = sanitizeAutosaveWorkspace(entry.workspace);
  }
  return result;
}

// ============================================================================
// Per-Profile Curriculum Progress (`robotemu_curriculum_progress_v1`)
// ============================================================================

function createDefaultProgress(): ProfileCurriculumProgress {
  const firstModuleId = CURRICULUM_MODULES[0]?.id ?? 'module-1';
  return {
    completedLessons: {},
    unlockedModules: [firstModuleId],
    earnedBadges: [],
  };
}

function sanitizeProgress(raw: unknown): ProfileCurriculumProgress {
  const defaults = createDefaultProgress();
  if (!raw || typeof raw !== 'object') return defaults;

  const obj = raw as Record<string, unknown>;
  const completedLessons: Record<string, LessonCompletionRecord> = {};

  if (obj.completedLessons && typeof obj.completedLessons === 'object') {
    for (const [lessonId, rec] of Object.entries(obj.completedLessons as Record<string, unknown>)) {
      if (!rec || typeof rec !== 'object') continue;
      const r = rec as Record<string, unknown>;
      completedLessons[lessonId] = {
        completedAt: typeof r.completedAt === 'number' ? r.completedAt : 0,
        version: typeof r.version === 'number' ? r.version : 1,
      };
    }
  }

  const unlockedSet = new Set<string>(defaults.unlockedModules);
  if (Array.isArray(obj.unlockedModules)) {
    for (const m of obj.unlockedModules) {
      if (typeof m === 'string' && m.trim()) {
        unlockedSet.add(m.trim());
      }
    }
  }

  const badgeSet = new Set<string>();
  if (Array.isArray(obj.earnedBadges)) {
    for (const b of obj.earnedBadges) {
      if (typeof b === 'string' && b.trim()) {
        badgeSet.add(b.trim());
      }
    }
  }

  return {
    completedLessons,
    unlockedModules: Array.from(unlockedSet),
    earnedBadges: Array.from(badgeSet),
  };
}

function readProgressStore(): CurriculumProgressStoreV1 {
  const raw = getStorageItem(CURRICULUM_PROGRESS_STORAGE_KEY);
  if (!raw) {
    return {
      version: CURRICULUM_PROGRESS_SCHEMA_VERSION,
      profiles: {},
    };
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.profiles !== 'object' || !parsed.profiles) {
      return {
        version: CURRICULUM_PROGRESS_SCHEMA_VERSION,
        profiles: {},
      };
    }

    const profiles: Record<string, ProfileCurriculumProgress> = {};
    for (const [profileId, rawProg] of Object.entries(parsed.profiles as Record<string, unknown>)) {
      profiles[profileId] = sanitizeProgress(rawProg);
    }

    return {
      version: CURRICULUM_PROGRESS_SCHEMA_VERSION,
      profiles,
    };
  } catch {
    return {
      version: CURRICULUM_PROGRESS_SCHEMA_VERSION,
      profiles: {},
    };
  }
}

function writeProgressStore(store: CurriculumProgressStoreV1): void {
  setStorageItem(CURRICULUM_PROGRESS_STORAGE_KEY, JSON.stringify(store));
}

export function getProfileProgress(profileId: string): ProfileCurriculumProgress {
  const store = readProgressStore();
  return store.profiles[profileId || DEFAULT_PROFILE_ID]
    ? sanitizeProgress(store.profiles[profileId || DEFAULT_PROFILE_ID])
    : createDefaultProgress();
}

export function isLessonCompleted(profileId: string, lessonId: string): boolean {
  const progress = getProfileProgress(profileId);
  return Boolean(progress.completedLessons[lessonId]);
}

export function markLessonCompleted(
  profileId: string,
  lessonId: string,
  version: number = 1,
  now: number = Date.now()
): MarkLessonCompletedResult {
  const targetProfileId = profileId || DEFAULT_PROFILE_ID;
  const store = readProgressStore();
  const current = store.profiles[targetProfileId]
    ? sanitizeProgress(store.profiles[targetProfileId])
    : createDefaultProgress();

  const alreadyCompleted = Boolean(current.completedLessons[lessonId]);
  current.completedLessons[lessonId] = {
    completedAt: current.completedLessons[lessonId]?.completedAt || now,
    version,
  };

  const unlockedSet = new Set<string>(current.unlockedModules);
  const badgeSet = new Set<string>(current.earnedBadges);
  const newlyEarnedBadges: string[] = [];

  for (let i = 0; i < CURRICULUM_MODULES.length; i++) {
    const mod = CURRICULUM_MODULES[i];
    const allCapstonesDone =
      mod.capstoneIds.length > 0 &&
      mod.capstoneIds.every((capId) => Boolean(current.completedLessons[capId]));

    if (allCapstonesDone && !badgeSet.has(mod.badgeId)) {
      badgeSet.add(mod.badgeId);
      newlyEarnedBadges.push(mod.badgeId);
    }

    const modActivities = getActivitiesForModule(mod.id);
    const allRegisteredActivitiesDone =
      modActivities.length > 0 &&
      modActivities.every((act) => Boolean(current.completedLessons[act.id]));

    if ((allCapstonesDone || allRegisteredActivitiesDone) && CURRICULUM_MODULES[i + 1]) {
      unlockedSet.add(CURRICULUM_MODULES[i + 1].id);
    }
  }

  const updated: ProfileCurriculumProgress = {
    completedLessons: current.completedLessons,
    unlockedModules: Array.from(unlockedSet),
    earnedBadges: Array.from(badgeSet),
  };

  store.profiles[targetProfileId] = updated;
  writeProgressStore(store);

  return {
    progress: updated,
    newlyCompleted: !alreadyCompleted,
    newlyEarnedBadges,
  };
}

export function unlockModuleForProfile(
  profileId: string,
  moduleId: string
): ProfileCurriculumProgress {
  const targetProfileId = profileId || DEFAULT_PROFILE_ID;
  const store = readProgressStore();
  const current = store.profiles[targetProfileId]
    ? sanitizeProgress(store.profiles[targetProfileId])
    : createDefaultProgress();

  if (!current.unlockedModules.includes(moduleId)) {
    current.unlockedModules = [...current.unlockedModules, moduleId];
    store.profiles[targetProfileId] = current;
    writeProgressStore(store);
  }
  return current;
}

export function awardBadgeForProfile(
  profileId: string,
  badgeId: string
): ProfileCurriculumProgress {
  const targetProfileId = profileId || DEFAULT_PROFILE_ID;
  const store = readProgressStore();
  const current = store.profiles[targetProfileId]
    ? sanitizeProgress(store.profiles[targetProfileId])
    : createDefaultProgress();

  if (!current.earnedBadges.includes(badgeId)) {
    current.earnedBadges = [...current.earnedBadges, badgeId];
    store.profiles[targetProfileId] = current;
    writeProgressStore(store);
  }
  return current;
}

/**
 * Clears profile, auto-save, and curriculum progress storage keys (for isolated unit testing).
 */
export function resetAllProfileDataForTests(): void {
  removeStorageItem(PROFILES_STORAGE_KEY);
  removeStorageItem(LESSON_AUTOSAVE_STORAGE_KEY);
  removeStorageItem(CURRICULUM_PROGRESS_STORAGE_KEY);
}
