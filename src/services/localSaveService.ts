import { SimulationStatus } from '../types';

export const STORAGE_KEY = 'robotemu_saved_programs';
export const CURRENT_STORAGE_VERSION = 1;
export const DEFAULT_SAVE_PROFILE_ID = 'default';

export interface SavedProgramEntry {
  version: number;
  id: string;
  title: string;
  createdAt: number;
  simId: 'grid' | 'turtle' | 'beat';
  code: string; // Base64URL payload according to binary_format.md
  screenshot: string; // SVG data URL thumbnail
  status: SimulationStatus;
  stepCount: number;
  levelId?: number;
  profileId?: string;
  lessonId?: string;
  lessonVersion?: number;
  slotIndex?: number;
}

export const DEFAULT_FALLBACK_THUMBNAIL =
  'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20100%20100%22%20width%3D%22100%22%20height%3D%22100%22%3E%3Crect%20width%3D%22100%22%20height%3D%22100%22%20fill%3D%22%23ffffff%22%2F%3E%3C%2Fsvg%3E';

// Shared in-memory fallback for test environments (such as Node.js in Vitest)
let memoryStorage: Record<string, string> = {};

export function getStorageItem(key: string): string | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memoryStorage[key] ?? null;
    }
  }
  return memoryStorage[key] ?? null;
}

export function setStorageItem(key: string, value: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(key, value);
      return;
    } catch {
      // Fallback to memoryStorage on quota error or privacy mode
    }
  }
  memoryStorage[key] = value;
}

export function removeStorageItem(key: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore
    }
  }
  delete memoryStorage[key];
}

/**
 * Migrates and normalizes a raw parsed object to a valid SavedProgramEntry.
 * Guarantees backward compatibility for entries created without schema versioning or with missing fields.
 * Legacy v1 entries without a `profileId` associate automatically with `'default'`.
 */
export function migrateSavedEntry(raw: any): SavedProgramEntry | null {
  if (!raw || typeof raw !== 'object') return null;

  // Code is required for the entry to be loadable
  if (!raw.code || typeof raw.code !== 'string' || !raw.code.trim()) return null;

  const version = typeof raw.version === 'number' ? raw.version : CURRENT_STORAGE_VERSION;
  const id =
    typeof raw.id === 'string' && raw.id.trim()
      ? raw.id.trim()
      : `save_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const title =
    typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : 'Untitled Program';
  const createdAt = typeof raw.createdAt === 'number' ? raw.createdAt : Date.now();
  const simId: 'grid' | 'turtle' | 'beat' =
    raw.simId === 'turtle' ? 'turtle' : raw.simId === 'beat' ? 'beat' : 'grid';
  const screenshot =
    typeof raw.screenshot === 'string' && raw.screenshot.trim()
      ? raw.screenshot.trim()
      : DEFAULT_FALLBACK_THUMBNAIL;
  const status: SimulationStatus =
    raw.status === 'SUCCESS' || raw.status === 'COLLISION' || raw.status === 'PAUSED'
      ? raw.status
      : 'IDLE';
  const stepCount = typeof raw.stepCount === 'number' ? raw.stepCount : 0;
  const levelId = typeof raw.levelId === 'number' ? raw.levelId : undefined;
  const profileId =
    typeof raw.profileId === 'string' && raw.profileId.trim()
      ? raw.profileId.trim()
      : DEFAULT_SAVE_PROFILE_ID;
  const lessonId =
    typeof raw.lessonId === 'string' && raw.lessonId.trim() ? raw.lessonId.trim() : undefined;
  const lessonVersion =
    typeof raw.lessonVersion === 'number' &&
    Number.isFinite(raw.lessonVersion) &&
    raw.lessonVersion >= 1
      ? Math.floor(raw.lessonVersion)
      : lessonId !== undefined
      ? 1
      : undefined;
  const slotIndex =
    typeof raw.slotIndex === 'number' && Number.isFinite(raw.slotIndex) && raw.slotIndex >= 1
      ? Math.floor(raw.slotIndex)
      : undefined;

  return {
    version,
    id,
    title,
    createdAt,
    simId,
    code: raw.code.trim(),
    screenshot,
    status,
    stepCount,
    levelId,
    profileId,
    ...(lessonId !== undefined ? { lessonId } : {}),
    ...(lessonVersion !== undefined ? { lessonVersion } : {}),
    ...(slotIndex !== undefined ? { slotIndex } : {}),
  };
}

export const normalizeSavedEntry = migrateSavedEntry;

/**
 * Non-destructively migrates persisted `robotemu_saved_programs` entries so any legacy v1 save
 * missing `profileId` is explicitly stamped with `defaultProfileId` (`'default'`) in storage
 * without altering any existing fields or invalidating existing saves.
 */
export function migrateLegacySavedProgramsToDefault(
  defaultProfileId: string = DEFAULT_SAVE_PROFILE_ID
): number {
  try {
    const raw = getStorageItem(STORAGE_KEY);
    if (!raw) return 0;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return 0;

    let migratedCount = 0;
    const updated = parsed.map((item) => {
      if (!item || typeof item !== 'object') return item;
      if (typeof item.profileId === 'string' && item.profileId.trim()) {
        return item;
      }
      migratedCount++;
      return {
        ...item,
        profileId: defaultProfileId,
      };
    });

    if (migratedCount > 0) {
      setStorageItem(STORAGE_KEY, JSON.stringify(updated));
    }
    return migratedCount;
  } catch {
    return 0;
  }
}

/**
 * Retrieves saved programs from storage, migrated to the current schema.
 * When `profileId` is provided, scopes results to that profile (associating legacy entries without `profileId` to `'default'`).
 */
export function getSavedPrograms(profileId?: string): SavedProgramEntry[] {
  try {
    const raw = getStorageItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const entries: SavedProgramEntry[] = [];
    for (const item of parsed) {
      const migrated = migrateSavedEntry(item);
      if (migrated) {
        if (!profileId || (migrated.profileId || DEFAULT_SAVE_PROFILE_ID) === profileId) {
          entries.push(migrated);
        }
      }
    }

    // Sort by latest created first
    return entries.sort((a, b) => b.createdAt - a.createdAt);
  } catch (err) {
    console.error('Failed to read saved programs:', err);
    return [];
  }
}

/**
 * Saves or updates a program in storage.
 * When `lessonId` and `slotIndex` are provided without an explicit `id`, upserts the
 * matching `(profileId, lessonId, slotIndex)` slot so each numbered lesson slot stays unique.
 */
export function saveProgram(
  entry: Omit<SavedProgramEntry, 'id' | 'createdAt' | 'version'> & {
    id?: string;
    createdAt?: number;
    version?: number;
  }
): SavedProgramEntry {
  const all = getSavedPrograms();
  const now = Date.now();

  const targetProfileId =
    typeof entry.profileId === 'string' && entry.profileId.trim()
      ? entry.profileId.trim()
      : DEFAULT_SAVE_PROFILE_ID;
  const cleanLessonId =
    typeof entry.lessonId === 'string' && entry.lessonId.trim() ? entry.lessonId.trim() : undefined;
  const cleanLessonVersion =
    typeof entry.lessonVersion === 'number' &&
    Number.isFinite(entry.lessonVersion) &&
    entry.lessonVersion >= 1
      ? Math.floor(entry.lessonVersion)
      : cleanLessonId !== undefined
      ? 1
      : undefined;
  const cleanSlotIndex =
    typeof entry.slotIndex === 'number' && Number.isFinite(entry.slotIndex) && entry.slotIndex >= 1
      ? Math.floor(entry.slotIndex)
      : undefined;

  let existingIndex = -1;
  if (entry.id) {
    existingIndex = all.findIndex((item) => item.id === entry.id);
  } else if (cleanLessonId !== undefined && cleanSlotIndex !== undefined) {
    existingIndex = all.findIndex(
      (item) =>
        (item.profileId || DEFAULT_SAVE_PROFILE_ID) === targetProfileId &&
        item.lessonId === cleanLessonId &&
        item.slotIndex === cleanSlotIndex
    );
  }

  const resolvedId =
    entry.id ||
    (existingIndex >= 0
      ? all[existingIndex].id
      : `save_${now}_${Math.random().toString(36).substring(2, 7)}`);

  const completeEntry: SavedProgramEntry = {
    version: entry.version ?? CURRENT_STORAGE_VERSION,
    id: resolvedId,
    title: entry.title.trim() || 'Untitled Program',
    createdAt: entry.createdAt || now,
    simId: entry.simId,
    code: entry.code,
    screenshot: entry.screenshot || DEFAULT_FALLBACK_THUMBNAIL,
    status: entry.status,
    stepCount: entry.stepCount,
    levelId: entry.levelId,
    profileId: targetProfileId,
    ...(cleanLessonId !== undefined ? { lessonId: cleanLessonId } : {}),
    ...(cleanLessonVersion !== undefined ? { lessonVersion: cleanLessonVersion } : {}),
    ...(cleanSlotIndex !== undefined ? { slotIndex: cleanSlotIndex } : {}),
  };

  if (existingIndex >= 0) {
    all[existingIndex] = completeEntry;
  } else {
    all.unshift(completeEntry);
  }

  setStorageItem(STORAGE_KEY, JSON.stringify(all));

  return completeEntry;
}

/**
 * Retrieves manual save slots for a given `(profileId, lessonId)`, sorted by `slotIndex` ascending
 * (with unnumbered entries sorted after numbered slots by newest `createdAt`).
 */
export function getLessonSaveSlots(profileId: string, lessonId: string): SavedProgramEntry[] {
  const targetProfileId = profileId?.trim() || DEFAULT_SAVE_PROFILE_ID;
  const targetLessonId = lessonId?.trim();
  if (!targetLessonId) return [];

  return getSavedPrograms(targetProfileId)
    .filter((entry) => entry.lessonId === targetLessonId)
    .sort((a, b) => {
      const slotA = a.slotIndex ?? Number.MAX_SAFE_INTEGER;
      const slotB = b.slotIndex ?? Number.MAX_SAFE_INTEGER;
      if (slotA !== slotB) return slotA - slotB;
      return b.createdAt - a.createdAt;
    });
}

/**
 * Returns the lowest unused positive integer slot index (`1, 2, 3...`) for `(profileId, lessonId)`.
 */
export function getNextAvailableLessonSlot(profileId: string, lessonId: string): number {
  const usedSlots = new Set<number>();
  for (const entry of getLessonSaveSlots(profileId, lessonId)) {
    if (entry.slotIndex !== undefined && entry.slotIndex >= 1) {
      usedSlots.add(entry.slotIndex);
    }
  }
  let candidate = 1;
  while (usedSlots.has(candidate)) {
    candidate++;
  }
  return candidate;
}

let mintedSaveSeq = 0;

function mintProfileSaveEntry(
  rawEntry: Omit<SavedProgramEntry, 'id'> & { id?: string },
  targetProfileId: string,
  now: number
): SavedProgramEntry | null {
  mintedSaveSeq = (mintedSaveSeq + 1) % 100000;
  const freshId = `save_${now}_${mintedSaveSeq}_${Math.random().toString(36).substring(2, 7)}`;
  return migrateSavedEntry({
    ...rawEntry,
    id: freshId,
    profileId: targetProfileId,
  });
}

/**
 * Replaces all manual saved programs belonging to `profileId` (including `'default'` when
 * explicitly restoring a backup) with freshly minted IDs, leaving other profiles untouched.
 */
export function replaceSavedProgramsForProfile(
  profileId: string,
  entries: Array<Omit<SavedProgramEntry, 'id'> & { id?: string }>
): SavedProgramEntry[] {
  const targetProfileId = profileId?.trim() || DEFAULT_SAVE_PROFILE_ID;
  const now = Date.now();
  const others = getSavedPrograms().filter(
    (item) => (item.profileId || DEFAULT_SAVE_PROFILE_ID) !== targetProfileId
  );

  const imported: SavedProgramEntry[] = [];
  for (const raw of entries) {
    const normalized = mintProfileSaveEntry(raw, targetProfileId, now);
    if (normalized) {
      imported.push(normalized);
    }
  }

  setStorageItem(STORAGE_KEY, JSON.stringify([...imported, ...others]));
  return imported;
}

/**
 * Appends imported manual saved programs to a newly created `profileId` with freshly minted IDs
 * so importing a profile backup on the same browser never collides with the source profile's saves.
 */
export function appendSavedProgramsForProfile(
  profileId: string,
  entries: Array<Omit<SavedProgramEntry, 'id'> & { id?: string }>
): SavedProgramEntry[] {
  const targetProfileId = profileId?.trim() || DEFAULT_SAVE_PROFILE_ID;
  const now = Date.now();
  const existing = getSavedPrograms();

  const imported: SavedProgramEntry[] = [];
  for (const raw of entries) {
    const normalized = mintProfileSaveEntry(raw, targetProfileId, now);
    if (normalized) {
      imported.push(normalized);
    }
  }

  if (imported.length > 0) {
    setStorageItem(STORAGE_KEY, JSON.stringify([...imported, ...existing]));
  }
  return imported;
}

/**
 * Deletes a saved program by ID.
 */
export function deleteProgram(id: string): boolean {
  try {
    const all = getSavedPrograms();
    const filtered = all.filter((item) => item.id !== id);
    if (filtered.length !== all.length) {
      setStorageItem(STORAGE_KEY, JSON.stringify(filtered));
      return true;
    }
    return false;
  } catch (err) {
    console.error('Failed to delete program:', err);
    return false;
  }
}

/**
 * Deletes all saved programs belonging to a specific non-default profile.
 */
export function deleteProgramsForProfile(profileId: string): number {
  if (!profileId || profileId === DEFAULT_SAVE_PROFILE_ID) return 0;
  try {
    const all = getSavedPrograms();
    const remaining = all.filter(
      (item) => (item.profileId || DEFAULT_SAVE_PROFILE_ID) !== profileId
    );
    const removedCount = all.length - remaining.length;
    if (removedCount > 0) {
      setStorageItem(STORAGE_KEY, JSON.stringify(remaining));
    }
    return removedCount;
  } catch {
    return 0;
  }
}

/**
 * Finds a saved program by ID.
 */
export function getProgramById(id: string): SavedProgramEntry | null {
  const all = getSavedPrograms();
  return all.find((item) => item.id === id) || null;
}

/**
 * Clears all saved programs.
 */
export function clearAllSavedPrograms(): void {
  removeStorageItem(STORAGE_KEY);
}
