import { create } from 'zustand';
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';
import { useAppStore } from '../store/useAppStore';

/** Check for PWA updates every 3 hours */
export const DEFAULT_UPDATE_CHECK_INTERVAL_MS = 3 * 60 * 60 * 1000;

export type RegisterSWFn = (options?: RegisterSWOptions) => (reloadPage?: boolean) => Promise<void>;

export interface InitPwaUpdateManagerOptions {
  checkIntervalMs?: number;
  registerSWFn?: RegisterSWFn;
  fetchFn?: typeof fetch;
  reloadFn?: () => void;
  nowFn?: () => number;
}

export interface PwaUpdateStoreState {
  needRefresh: boolean;
  offlineReady: boolean;
  isPromptDismissed: boolean;
  isUpdating: boolean;
  lastCheckedAt: number | null;
}

export const usePwaUpdateStore = create<PwaUpdateStoreState>(() => ({
  needRefresh: false,
  offlineReady: false,
  isPromptDismissed: false,
  isUpdating: false,
  lastCheckedAt: null,
}));

let isInitialized = false;
let cleanupListeners: (() => void) | null = null;
let updateSWCallback: ((reloadPage?: boolean) => Promise<void>) | null = null;
let activeRegistration: ServiceWorkerRegistration | undefined;
let activeSwUrl: string | undefined;
let fetchImpl: typeof fetch | undefined;
let reloadImpl: () => void = () => {
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
};
let nowImpl: () => number = () => Date.now();

/**
 * Performs an explicit network check for a new Service Worker version,
 * bypassing browser HTTP caches for `sw.js`.
 */
export async function checkForAppUpdate(): Promise<boolean> {
  if (!activeRegistration) return false;
  if (activeRegistration.installing) return false;
  if (typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine) {
    return false;
  }

  try {
    const fetcher = fetchImpl ?? (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : undefined);
    if (activeSwUrl && fetcher) {
      const resp = await fetcher(activeSwUrl, {
        cache: 'no-store',
        headers: {
          cache: 'no-store',
          'cache-control': 'no-cache',
        },
      });
      if (resp?.status !== 200) {
        return false;
      }
    }

    await activeRegistration.update();
    usePwaUpdateStore.setState({ lastCheckedAt: nowImpl() });

    // If an update is waiting (including one previously snoozed via "Later"), propose it again
    if (activeRegistration.waiting) {
      usePwaUpdateStore.setState({
        needRefresh: true,
        isPromptDismissed: false,
      });
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Saves current workspace/simulation state and activates the waiting Service Worker to reload into the new version.
 */
export async function applyAppUpdate(): Promise<void> {
  if (usePwaUpdateStore.getState().isUpdating) return;
  usePwaUpdateStore.setState({ isUpdating: true });

  // Persist complete workspace, custom map, turtle canvas, and UI state before reload
  try {
    useAppStore.getState().prepareStateForUpdate();
  } catch {
    // Continue update even if storage is unavailable
  }

  let didReload = false;
  const triggerReloadOnce = () => {
    if (didReload) return;
    didReload = true;
    reloadImpl();
  };

  if (typeof navigator !== 'undefined' && navigator.serviceWorker?.addEventListener) {
    navigator.serviceWorker.addEventListener('controllerchange', triggerReloadOnce, { once: true });
  }

  // Fallback reload in case the page was uncontrolled (e.g. after hard refresh) or controllerchange was already handled
  const fallbackTimer = setTimeout(triggerReloadOnce, 1500);

  try {
    if (updateSWCallback) {
      await updateSWCallback(true);
    } else if (activeRegistration?.waiting) {
      activeRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      clearTimeout(fallbackTimer);
      triggerReloadOnce();
    }
  } catch {
    clearTimeout(fallbackTimer);
    triggerReloadOnce();
  }
}

/**
 * Snoozes the update banner until the next periodic update check (or manual trigger).
 */
export function dismissUpdatePrompt(): void {
  usePwaUpdateStore.setState({ isPromptDismissed: true });
}

/**
 * Re-opens the update banner if an update is currently waiting.
 */
export function reopenUpdatePrompt(): void {
  if (usePwaUpdateStore.getState().needRefresh) {
    usePwaUpdateStore.setState({ isPromptDismissed: false });
  }
}

/**
 * Initializes Service Worker registration and schedules periodic update checks every few hours.
 * Safe to call multiple times (e.g. under React.StrictMode).
 */
export async function initPwaUpdateManager(options: InitPwaUpdateManagerOptions = {}): Promise<void> {
  if (isInitialized) return;
  isInitialized = true;

  const intervalMs = options.checkIntervalMs ?? DEFAULT_UPDATE_CHECK_INTERVAL_MS;
  fetchImpl = options.fetchFn;
  if (options.reloadFn) reloadImpl = options.reloadFn;
  if (options.nowFn) nowImpl = options.nowFn;

  let registerSW: RegisterSWFn | undefined = options.registerSWFn;
  if (!registerSW) {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }
    try {
      const mod = await import('virtual:pwa-register');
      registerSW = mod.registerSW;
    } catch {
      return;
    }
  }

  let intervalId: ReturnType<typeof setInterval> | null = null;

  const checkIfStale = () => {
    const { lastCheckedAt } = usePwaUpdateStore.getState();
    if (lastCheckedAt === null || nowImpl() - lastCheckedAt >= intervalMs) {
      void checkForAppUpdate();
    }
  };

  const handleVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      checkIfStale();
    }
  };

  const handleOnline = () => {
    checkIfStale();
  };

  const handleSimulateUpdate = () => {
    usePwaUpdateStore.setState({
      needRefresh: true,
      isPromptDismissed: false,
    });
  };

  updateSWCallback = registerSW({
    immediate: true,
    onOfflineReady() {
      usePwaUpdateStore.setState({ offlineReady: true });
    },
    onNeedRefresh() {
      usePwaUpdateStore.setState({
        needRefresh: true,
        isPromptDismissed: false,
      });
    },
    onRegisteredSW(swUrl, registration) {
      activeSwUrl = swUrl;
      activeRegistration = registration;
      usePwaUpdateStore.setState({ lastCheckedAt: nowImpl() });

      if (registration?.waiting) {
        usePwaUpdateStore.setState({
          needRefresh: true,
          isPromptDismissed: false,
        });
      }

      if (registration && intervalMs > 0) {
        if (intervalId) clearInterval(intervalId);
        intervalId = setInterval(() => {
          void checkForAppUpdate();
        }, intervalMs);
      }
    },
  });

  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('online', handleOnline);
    window.addEventListener('robotemu:pwa-simulate-update', handleSimulateUpdate);
  }

  cleanupListeners = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (typeof document !== 'undefined' && document.removeEventListener) {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
    if (typeof window !== 'undefined' && window.removeEventListener) {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('robotemu:pwa-simulate-update', handleSimulateUpdate);
    }
  };
}

/**
 * Resets internal singleton state (for unit tests).
 */
export function resetPwaUpdateManagerForTests(): void {
  cleanupListeners?.();
  cleanupListeners = null;
  isInitialized = false;
  updateSWCallback = null;
  activeRegistration = undefined;
  activeSwUrl = undefined;
  fetchImpl = undefined;
  reloadImpl = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };
  nowImpl = () => Date.now();
  usePwaUpdateStore.setState({
    needRefresh: false,
    offlineReady: false,
    isPromptDismissed: false,
    isUpdating: false,
    lastCheckedAt: null,
  });
}
