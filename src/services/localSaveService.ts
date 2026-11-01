import { SimulationStatus } from '../types';

export const STORAGE_KEY = 'robotemu_saved_programs';
export const CURRENT_STORAGE_VERSION = 1;

export interface SavedProgramEntry {
  version: number;
  id: string;
  title: string;
  createdAt: number;
  simId: 'grid' | 'turtle';
  code: string; // Base64URL payload according to binary_format.md
  screenshot: string; // SVG data URL thumbnail
  status: SimulationStatus;
  stepCount: number;
  levelId?: number;
}

const DEFAULT_FALLBACK_THUMBNAIL =
  'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20100%20100%22%20width%3D%22100%22%20height%3D%22100%22%3E%3Crect%20width%3D%22100%22%20height%3D%22100%22%20fill%3D%22%23ffffff%22%2F%3E%3C%2Fsvg%3E';

// In-memory fallback for test environments (such as Node.js in Vitest)
let memoryStorage: Record<string, string> = {};

function getStorageItem(key: string): string | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memoryStorage[key] ?? null;
    }
  }
  return memoryStorage[key] ?? null;
}

function setStorageItem(key: string, value: string): void {
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

function removeStorageItem(key: string): void {
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
  const simId: 'grid' | 'turtle' = raw.simId === 'turtle' ? 'turtle' : 'grid';
  const screenshot =
    typeof raw.screenshot === 'string' && raw.screenshot.trim()
      ? raw.screenshot.trim()
      : DEFAULT_FALLBACK_THUMBNAIL;
  const status: SimulationStatus =
    raw.status === 'SUCCESS' || raw.status === 'COLLISION' ? raw.status : 'IDLE';
  const stepCount = typeof raw.stepCount === 'number' ? raw.stepCount : 0;
  const levelId = typeof raw.levelId === 'number' ? raw.levelId : undefined;

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
  };
}

export const normalizeSavedEntry = migrateSavedEntry;

/**
 * Retrieves all saved programs from storage, migrated to the current schema.
 */
export function getSavedPrograms(): SavedProgramEntry[] {
  try {
    const raw = getStorageItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const entries: SavedProgramEntry[] = [];
    for (const item of parsed) {
      const migrated = migrateSavedEntry(item);
      if (migrated) {
        entries.push(migrated);
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

  const completeEntry: SavedProgramEntry = {
    version: entry.version ?? CURRENT_STORAGE_VERSION,
    id: entry.id || `save_${now}_${Math.random().toString(36).substring(2, 7)}`,
    title: entry.title.trim() || 'Untitled Program',
    createdAt: entry.createdAt || now,
    simId: entry.simId,
    code: entry.code,
    screenshot: entry.screenshot || DEFAULT_FALLBACK_THUMBNAIL,
    status: entry.status,
    stepCount: entry.stepCount,
    levelId: entry.levelId,
  };

  const existingIndex = all.findIndex((item) => item.id === completeEntry.id);
  if (existingIndex >= 0) {
    all[existingIndex] = completeEntry;
  } else {
    all.unshift(completeEntry);
  }

  setStorageItem(STORAGE_KEY, JSON.stringify(all));

  return completeEntry;
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
  memoryStorage = {};
}
