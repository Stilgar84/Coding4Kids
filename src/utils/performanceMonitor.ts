import { useEffect } from 'react';
import { useAppStore, useAppStoreSelector } from '../store/useAppStore';
import { beatVariationPreviewPlayer } from '../components/VariationCardsPanel';

export type PerformanceMode = 'auto' | 'low' | 'high';

const PERF_MODE_STORAGE_KEY = 'robotemu_perf_mode';

export function loadPersistedPerformanceMode(): PerformanceMode {
  if (typeof window === 'undefined') return 'auto';
  try {
    const raw = window.localStorage?.getItem(PERF_MODE_STORAGE_KEY);
    if (raw === 'low' || raw === 'high' || raw === 'auto') {
      return raw;
    }
  } catch {
    // Ignore storage errors (private mode, etc.)
  }
  return 'auto';
}

export function savePersistedPerformanceMode(mode: PerformanceMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage?.setItem(PERF_MODE_STORAGE_KEY, mode);
  } catch {
    // Ignore storage errors
  }
}

export interface FrameSmoothnessMonitorOptions {
  /** Number of frames in the rolling evaluation window (default: 14) */
  windowSize?: number;
  /** Number of initial warm-up frames to skip after starting (default: 2) */
  warmupFrames?: number;
  /** Mean frame delta threshold in ms above which low-quality is triggered (default: 34ms ~29fps) */
  avgDeltaThresholdMs?: number;
  /** Individual frame delta threshold considered a jank spike (default: 50ms <20fps) */
  jankFrameThresholdMs?: number;
  /** Minimum count of jank spikes inside the window to trigger low-quality (default: 4) */
  jankCountThreshold?: number;
  /** Callback fired once per session when low smoothness is detected */
  onLowSmoothnessDetected: () => void;
}

/**
 * Lightweight requestAnimationFrame-based smoothness monitor.
 * Runs ONLY while an animated simulation or preview is actively playing,
 * ignoring cold-start warm-up frames and background tab pauses (>1000ms).
 */
export class FrameSmoothnessMonitor {
  private rafId: number | null = null;
  private isRunning = false;
  private hasTriggered = false;
  private warmupRemaining = 0;
  private lastTimestamp: number | null = null;
  private deltas: number[] = [];
  private readonly windowSize: number;
  private readonly warmupFrames: number;
  private readonly avgDeltaThresholdMs: number;
  private readonly jankFrameThresholdMs: number;
  private readonly jankCountThreshold: number;
  private readonly onLowSmoothnessDetected: () => void;

  constructor(options: FrameSmoothnessMonitorOptions) {
    this.windowSize = options.windowSize ?? 14;
    this.warmupFrames = options.warmupFrames ?? 2;
    this.avgDeltaThresholdMs = options.avgDeltaThresholdMs ?? 34;
    this.jankFrameThresholdMs = options.jankFrameThresholdMs ?? 50;
    this.jankCountThreshold = options.jankCountThreshold ?? 4;
    this.onLowSmoothnessDetected = options.onLowSmoothnessDetected;
    this.warmupRemaining = this.warmupFrames;
  }

  start(): void {
    if (this.isRunning || this.hasTriggered) return;
    if (typeof requestAnimationFrame !== 'function') return;
    this.isRunning = true;
    this.warmupRemaining = this.warmupFrames;
    this.lastTimestamp = null;
    this.deltas = [];
    this.rafId = requestAnimationFrame(this.onFrame);
  }

  stop(): void {
    this.isRunning = false;
    if (this.rafId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.rafId);
    }
    this.rafId = null;
    this.lastTimestamp = null;
    this.deltas = [];
  }

  resetTrigger(): void {
    this.hasTriggered = false;
  }

  private onFrame = (timestamp: number): void => {
    if (!this.isRunning || this.hasTriggered) return;
    const triggered = this.recordFrame(timestamp);
    if (!triggered && this.isRunning) {
      this.rafId = requestAnimationFrame(this.onFrame);
    }
  };

  /**
   * Processes a single frame timestamp. Public for deterministic unit testing.
   * Returns true if low smoothness was detected and triggered.
   */
  recordFrame(timestamp: number): boolean {
    if (this.hasTriggered) return false;

    if (typeof document !== 'undefined' && document.hidden) {
      this.lastTimestamp = null;
      return false;
    }

    if (this.lastTimestamp === null) {
      this.lastTimestamp = timestamp;
      return false;
    }

    const dt = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;

    // Ignore tab-switch / debugger pauses or zero/negative deltas
    if (dt <= 0 || dt > 1000) {
      return false;
    }

    if (this.warmupRemaining > 0) {
      this.warmupRemaining--;
      return false;
    }

    this.deltas.push(dt);
    if (this.deltas.length > this.windowSize) {
      this.deltas.shift();
    }

    if (this.deltas.length < this.windowSize) {
      return false;
    }

    let sum = 0;
    let jankCount = 0;
    for (let i = 0; i < this.deltas.length; i++) {
      const d = this.deltas[i];
      sum += d;
      if (d >= this.jankFrameThresholdMs) {
        jankCount++;
      }
    }
    const avg = sum / this.deltas.length;

    if (avg > this.avgDeltaThresholdMs || jankCount >= this.jankCountThreshold) {
      this.hasTriggered = true;
      this.stop();
      this.onLowSmoothnessDetected();
      return true;
    }

    return false;
  }
}

/**
 * App-wide hook that monitors frame smoothness whenever Beat, Turtle, Grid,
 * or a Beat variation card preview is actively animating in `'auto'` mode.
 */
export function usePerformanceMonitor(): void {
  const { isPlaying, speed, performanceMode, isAutoLowQuality } = useAppStoreSelector((s) => ({
    isPlaying: s.isPlaying,
    speed: s.speed,
    performanceMode: s.performanceMode,
    isAutoLowQuality: s.isAutoLowQuality,
  }));

  useEffect(() => {
    if (performanceMode !== 'auto' || isAutoLowQuality) {
      return;
    }

    const monitor = new FrameSmoothnessMonitor({
      onLowSmoothnessDetected: () => {
        useAppStore.getState().triggerAutoLowQuality();
      },
    });

    const syncMonitoring = () => {
      const isInstant = speed === 'instant' || (speed as unknown) === 0;
      const previewPlaying = beatVariationPreviewPlayer.getSnapshot().isPlaying;
      const shouldMonitor = (isPlaying && !isInstant) || previewPlaying;
      if (shouldMonitor) {
        monitor.start();
      } else {
        monitor.stop();
      }
    };

    syncMonitoring();
    const unsubPreview = beatVariationPreviewPlayer.subscribe(syncMonitoring);

    return () => {
      unsubPreview();
      monitor.stop();
    };
  }, [isPlaying, speed, performanceMode, isAutoLowQuality]);
}
