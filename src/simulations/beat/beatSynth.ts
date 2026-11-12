import { SimulationSpeed } from '../../types';
import { BeatTriggerEvent } from './types';

export type BeatAudioStatus = 'uninitialized' | 'running' | 'suspended' | 'unavailable';
export type BeatSynthSource = 'main' | 'preview';

// C4..C5 Major Scale frequencies (Hz) for Tier 2 PLAY_NOTE (1..8)
export const BEAT_SCALE_FREQUENCIES: readonly number[] = [
  261.63, // 1: C4
  293.66, // 2: D4
  329.63, // 3: E4
  349.23, // 4: F4
  392.0,  // 5: G4
  440.0,  // 6: A4
  493.88, // 7: B4
  523.25, // 8: C5
];

interface StoppableNode {
  stop: (when?: number) => void;
  disconnect: () => void;
}

function resolveAudioContextConstructor(): (new () => AudioContext) | null {
  if (typeof globalThis === 'undefined') return null;
  const g = globalThis as Record<string, any>;
  const ctor = g.AudioContext || g.webkitAudioContext;
  return typeof ctor === 'function' ? ctor : null;
}

function hasNativeOfflineAudioContext(): boolean {
  if (typeof globalThis === 'undefined') return false;
  const g = globalThis as Record<string, any>;
  return (
    typeof g.OfflineAudioContext === 'function' ||
    typeof g.webkitOfflineAudioContext === 'function'
  );
}

function triangleWave(phase: number): number {
  const p = phase - Math.floor(phase);
  if (p < 0.25) return p * 4;
  if (p < 0.75) return 2 - p * 4;
  return p * 4 - 4;
}

const MAX_NOTE_CACHE_ENTRIES = 48;
const MAX_ACTIVE_VOICES_STANDARD = 8;
const MAX_ACTIVE_VOICES_LOW = 4;

export const BEAT_SOUND_BASE_DURATIONS_MS = {
  DRUM_KICK: 210,
  DRUM_SNARE: 150,
  DRUM_CLAP: 160,
  PLAY_CHIME: 360,
} as const;

function normalizeSpeedScale(speed: SimulationSpeed | number = 400): number {
  if (typeof speed !== 'number' || !Number.isFinite(speed) || speed <= 0) return 1;
  return Math.max(0.0625, speed / 400);
}

export function getBeatNoteDurationSec(
  durationBeats: number = 1,
  speed: SimulationSpeed | number = 400
): number {
  const speedMs = typeof speed === 'number' && Number.isFinite(speed) && speed > 0 ? speed : 400;
  const beatSec = Math.max(0.025, (speedMs / 1000) * 0.9);
  const mult = Number.isFinite(durationBeats) && durationBeats > 0 ? durationBeats : 1;
  return Math.max(0.025, Math.min(2.0, beatSec * mult));
}

export function getBeatEventSoundDurationMs(
  event: BeatTriggerEvent | null | undefined,
  speed: SimulationSpeed = 400
): number {
  if (!event || speed === 'instant' || (speed as any) === 0) return 0;
  const scale = normalizeSpeedScale(speed);
  switch (event.kind) {
    case 'DRUM_KICK':
      return Math.max(25, Math.round(BEAT_SOUND_BASE_DURATIONS_MS.DRUM_KICK * scale));
    case 'DRUM_SNARE':
      return Math.max(25, Math.round(BEAT_SOUND_BASE_DURATIONS_MS.DRUM_SNARE * scale));
    case 'DRUM_CLAP':
      return Math.max(25, Math.round(BEAT_SOUND_BASE_DURATIONS_MS.DRUM_CLAP * scale));
    case 'PLAY_CHIME':
      return Math.max(30, Math.round(BEAT_SOUND_BASE_DURATIONS_MS.PLAY_CHIME * scale));
    case 'PLAY_NOTE': {
      const safeDur = getBeatNoteDurationSec(event.durationBeats ?? 1, speed);
      return Math.round((safeDur + 0.01) * 1000);
    }
    default:
      return 0;
  }
}

export class BeatSynthEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private sampleCache = new Map<string, AudioBuffer>();
  private noteCacheKeys: string[] = [];
  private sampleCacheSampleRate: number = 0;
  private sampleCacheEnabled: boolean = hasNativeOfflineAudioContext();
  private lowQualityMode: boolean = false;
  private prewarmScheduled: boolean = false;
  private muted: boolean = false;
  private blockedByAutoplay: boolean = false;
  private unavailable: boolean = false;
  private isResuming: boolean = false;
  private currentSource: BeatSynthSource = 'main';
  private activeNodes = new Map<StoppableNode, BeatSynthSource>();
  private pendingGestureQueue: Array<{
    fn: () => void;
    source: BeatSynthSource;
    queuedAt: number;
  }> = [];
  private listeners = new Set<() => void>();

  private notify(): void {
    for (const fn of this.listeners) {
      try {
        fn();
      } catch {
        // Ignore listener errors
      }
    }
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  isMuted(): boolean {
    return this.muted;
  }

  isSampleCacheEnabled(): boolean {
    return this.sampleCacheEnabled;
  }

  setSampleCacheEnabled(enabled: boolean): void {
    this.sampleCacheEnabled = Boolean(enabled);
  }

  isLowQualityMode(): boolean {
    return this.lowQualityMode;
  }

  setLowQualityMode(low: boolean): void {
    this.lowQualityMode = Boolean(low);
    this.enforceVoiceCap();
  }

  getCachedSampleCount(): number {
    return this.sampleCache.size;
  }

  setMuted(muted: boolean): void {
    const next = Boolean(muted);
    if (this.muted === next) return;
    this.muted = next;
    if (this.muted) {
      this.stopAll();
    }
    this.notify();
  }

  getAudioStatus(): BeatAudioStatus {
    if (this.unavailable) return 'unavailable';
    if (!this.ctx) {
      return resolveAudioContextConstructor() ? 'uninitialized' : 'unavailable';
    }
    if (this.ctx.state === 'running') return 'running';
    return 'suspended';
  }

  /**
   * True when audio is unmuted in a browser with Web Audio support,
   * yet the AudioContext is currently suspended (e.g. blocked by autoplay policy).
   */
  needsSoundUnlock(): boolean {
    if (this.muted || this.unavailable) return false;
    if (this.blockedByAutoplay) return true;
    if (this.ctx && this.ctx.state === 'suspended') return true;
    return false;
  }

  /**
   * Must be called synchronously inside user-gesture handlers (Play, Step, Unmute, Tap-for-Sound pill).
   * Never awaits, blocks, or throws if AudioContext is unavailable or suspended.
   */
  unlockFromGesture(): boolean {
    const Ctor = resolveAudioContextConstructor();
    if (!Ctor) {
      this.unavailable = true;
      return false;
    }

    try {
      this.unavailable = false;
      if (!this.ctx) {
        const created = new Ctor();
        this.ctx = created;
        if (typeof created.addEventListener === 'function') {
          created.addEventListener('statechange', () => {
            if (this.ctx?.state === 'running') {
              this.blockedByAutoplay = false;
              this.isResuming = false;
              this.flushPendingGestureQueue();
            }
            this.notify();
          });
        }
      }

      const currentState = this.ctx.state as string;
      if (
        currentState !== 'running' &&
        currentState !== 'closed' &&
        typeof this.ctx.resume === 'function'
      ) {
        this.isResuming = true;
        const maybePromise = this.ctx.resume();
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise
            .then(() => {
              this.isResuming = false;
              if (this.ctx?.state === 'running') {
                this.blockedByAutoplay = false;
                this.flushPendingGestureQueue();
              } else {
                this.pendingGestureQueue = [];
                this.blockedByAutoplay = true;
              }
              this.notify();
            })
            .catch(() => {
              this.isResuming = false;
              this.pendingGestureQueue = [];
              this.blockedByAutoplay = true;
              this.notify();
            });
        } else if ((this.ctx.state as string) !== 'running') {
          this.isResuming = false;
        }
      }

      if (this.ctx.state === 'running') {
        this.isResuming = false;
        this.blockedByAutoplay = false;
        this.schedulePrewarm(this.ctx);
        this.flushPendingGestureQueue();
      }
      this.notify();
      return this.ctx.state === 'running';
    } catch {
      this.isResuming = false;
      this.pendingGestureQueue = [];
      this.unavailable = true;
      this.ctx = null;
      this.notify();
      return false;
    }
  }

  /**
   * Executes `fn` while tagging any scheduled audio nodes with `source` (`'main'` or `'preview'`),
   * ensuring preview-card cleanup can never cut off main simulation playback.
   */
  withSource<T>(source: BeatSynthSource, fn: () => T): T {
    const prev = this.currentSource;
    this.currentSource = source;
    try {
      return fn();
    } finally {
      this.currentSource = prev;
    }
  }

  private flushPendingGestureQueue(): void {
    if (this.pendingGestureQueue.length === 0) return;
    const pending = this.pendingGestureQueue.splice(0);
    if (this.muted || this.unavailable || !this.ctx || this.ctx.state !== 'running') {
      return;
    }
    const nowMs = Date.now();
    for (const item of pending) {
      if (nowMs - item.queuedAt <= 600) {
        this.withSource(item.source, item.fn);
      }
    }
  }

  private getReadyContext(replayWhenReady?: () => void): AudioContext | null {
    if (this.muted || this.unavailable) return null;
    if (!this.ctx) {
      // Do NOT instantiate AudioContext outside a gesture handler; mark unlock needed if supported
      if (resolveAudioContextConstructor()) {
        this.blockedByAutoplay = true;
        this.notify();
      }
      return null;
    }
    if (this.ctx.state !== 'running') {
      if (this.isResuming && replayWhenReady) {
        if (this.pendingGestureQueue.length < 8) {
          this.pendingGestureQueue.push({
            fn: replayWhenReady,
            source: this.currentSource,
            queuedAt: Date.now(),
          });
        }
        return null;
      }
      this.blockedByAutoplay = true;
      this.notify();
      return null;
    }
    return this.ctx;
  }

  /**
   * Adds a tiny lookahead so initial transients (0..5ms attack ramps) are never clipped
   * by the Web Audio render quantum or freshly awakened OS audio hardware stream.
   */
  private getScheduleStartTime(ctx: AudioContext): number {
    const t = ctx.currentTime;
    return t + (t < 0.05 ? 0.015 : 0.005);
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer | null {
    if (this.noiseBuffer) return this.noiseBuffer;
    try {
      const sampleRate = ctx.sampleRate || 44100;
      const length = Math.floor(sampleRate * 0.3);
      const buffer = ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      // Fast deterministic LCG PRNG so noise generation is instantaneous
      let seed = 0x12345678;
      for (let i = 0; i < length; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        data[i] = (seed / 0xffffffff) * 2 - 1;
      }
      this.noiseBuffer = buffer;
      return buffer;
    } catch {
      return null;
    }
  }

  private enforceVoiceCap(): void {
    const cap = this.lowQualityMode ? MAX_ACTIVE_VOICES_LOW : MAX_ACTIVE_VOICES_STANDARD;
    while (this.activeNodes.size > cap) {
      const oldest = this.activeNodes.keys().next().value as StoppableNode | undefined;
      if (!oldest) break;
      this.activeNodes.delete(oldest);
      try {
        oldest.stop();
      } catch {
        // Ignore already-stopped nodes
      }
      try {
        oldest.disconnect();
      } catch {
        // Ignore
      }
    }
  }

  private trackSource(node: AudioScheduledSourceNode | StoppableNode): void {
    const stoppable = node as StoppableNode;
    this.activeNodes.set(stoppable, this.currentSource);
    this.enforceVoiceCap();
    const anyNode = node as any;
    if ('onended' in anyNode) {
      anyNode.onended = () => {
        this.activeNodes.delete(stoppable);
        try {
          node.disconnect();
        } catch {
          // Ignore
        }
      };
    }
  }

  private schedulePrewarm(ctx: AudioContext): void {
    if (!this.sampleCacheEnabled || this.prewarmScheduled) return;
    this.prewarmScheduled = true;
    const warm = () => {
      if (!this.ctx || this.ctx !== ctx || this.muted || this.unavailable) return;
      this.getOrCreateCachedSample(ctx, 'kick', () => this.renderKickBuffer(ctx));
      this.getOrCreateCachedSample(ctx, 'snare', () => this.renderSnareBuffer(ctx));
      this.getOrCreateCachedSample(ctx, 'clap', () => this.renderClapBuffer(ctx));
      this.getOrCreateCachedSample(ctx, 'chime', () => this.renderChimeBuffer(ctx));
    };
    const g = globalThis as Record<string, any>;
    if (typeof g.requestIdleCallback === 'function') {
      g.requestIdleCallback(warm, { timeout: 300 });
    } else if (typeof setTimeout === 'function') {
      setTimeout(warm, 16);
    }
  }

  private getOrCreateCachedSample(
    ctx: AudioContext,
    key: string,
    builder: () => AudioBuffer | null,
    isNoteKey: boolean = false
  ): AudioBuffer | null {
    const sr = ctx.sampleRate || 44100;
    if (this.sampleCacheSampleRate !== sr) {
      this.sampleCache.clear();
      this.noteCacheKeys = [];
      this.sampleCacheSampleRate = sr;
    }
    const existing = this.sampleCache.get(key);
    if (existing) return existing;

    const built = builder();
    if (!built) return null;

    if (isNoteKey) {
      if (this.noteCacheKeys.length >= MAX_NOTE_CACHE_ENTRIES) {
        const evictKey = this.noteCacheKeys.shift();
        if (evictKey) this.sampleCache.delete(evictKey);
      }
      this.noteCacheKeys.push(key);
    }
    this.sampleCache.set(key, built);
    return built;
  }

  private playCachedBuffer(ctx: AudioContext, buffer: AudioBuffer): void {
    const now = this.getScheduleStartTime(ctx);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    this.trackSource(src);
    src.start(now);
    src.stop(now + buffer.length / (ctx.sampleRate || 44100));
  }

  private renderKickBuffer(ctx: AudioContext): AudioBuffer | null {
    try {
      const sr = ctx.sampleRate || 44100;
      const length = Math.max(1, Math.floor(sr * 0.21));
      const buffer = ctx.createBuffer(1, length, sr);
      const data = buffer.getChannelData(0);
      let bodyPhase = 0;
      let clickPhase = 0;

      for (let i = 0; i < length; i++) {
        const t = i / sr;
        // Body sine sweep 155 -> 42 Hz
        const bodyFreq = t < 0.16 ? 155 * Math.pow(42 / 155, t / 0.16) : 42;
        bodyPhase += bodyFreq / sr;
        const bodyEnv =
          t < 0.005
            ? 0.001 + (0.45 - 0.001) * (t / 0.005)
            : 0.45 * Math.pow(0.001 / 0.45, Math.min(1, (t - 0.005) / 0.195));

        let sample = Math.sin(bodyPhase * Math.PI * 2) * bodyEnv;

        // Subtle beater click (first 35ms)
        if (t < 0.035) {
          const clickFreq = t < 0.025 ? 240 * Math.pow(65 / 240, t / 0.025) : 65;
          clickPhase += clickFreq / sr;
          const clickEnv = 0.18 * Math.pow(0.001 / 0.18, Math.min(1, t / 0.03));
          sample += triangleWave(clickPhase) * clickEnv;
        }

        data[i] = Math.max(-1, Math.min(1, sample));
      }
      return buffer;
    } catch {
      return null;
    }
  }

  private renderSnareBuffer(ctx: AudioContext): AudioBuffer | null {
    try {
      const sr = ctx.sampleRate || 44100;
      const length = Math.max(1, Math.floor(sr * 0.15));
      const buffer = ctx.createBuffer(1, length, sr);
      const data = buffer.getChannelData(0);

      // 2-pole Butterworth highpass at 950 Hz
      const w0 = (2 * Math.PI * 950) / sr;
      const cosW0 = Math.cos(w0);
      const alpha = Math.sin(w0) / (2 * 0.7071);
      const a0 = 1 + alpha;
      const b0 = (1 + cosW0) / 2 / a0;
      const b1 = -(1 + cosW0) / a0;
      const b2 = b0;
      const a1 = (-2 * cosW0) / a0;
      const a2 = (1 - alpha) / a0;

      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      let seed = 0x12345678;
      let bodyPhase = 0;

      for (let i = 0; i < length; i++) {
        const t = i / sr;
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const x0 = (seed / 0xffffffff) * 2 - 1;
        const hp = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1; x1 = x0; y2 = y1; y1 = hp;

        const noiseEnv = 0.28 * Math.pow(0.001 / 0.28, Math.min(1, t / 0.14));
        let sample = hp * noiseEnv;

        if (t < 0.1) {
          const bodyFreq = t < 0.08 ? 190 * Math.pow(95 / 190, t / 0.08) : 95;
          bodyPhase += bodyFreq / sr;
          const bodyEnv = 0.26 * Math.pow(0.001 / 0.26, Math.min(1, t / 0.09));
          sample += triangleWave(bodyPhase) * bodyEnv;
        }

        data[i] = Math.max(-1, Math.min(1, sample));
      }
      return buffer;
    } catch {
      return null;
    }
  }

  private renderClapBuffer(ctx: AudioContext): AudioBuffer | null {
    try {
      const sr = ctx.sampleRate || 44100;
      const length = Math.max(1, Math.floor(sr * 0.16));
      const buffer = ctx.createBuffer(1, length, sr);
      const data = buffer.getChannelData(0);

      // 2-pole bandpass at 1350 Hz, Q = 1.4
      const w0 = (2 * Math.PI * 1350) / sr;
      const cosW0 = Math.cos(w0);
      const alpha = Math.sin(w0) / (2 * 1.4);
      const a0 = 1 + alpha;
      const b0 = alpha / a0;
      const b1 = 0;
      const b2 = -alpha / a0;
      const a1 = (-2 * cosW0) / a0;
      const a2 = (1 - alpha) / a0;

      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      let seed = 0x12345678;

      for (let i = 0; i < length; i++) {
        const t = i / sr;
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const x0 = (seed / 0xffffffff) * 2 - 1;
        const bp = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1; x1 = x0; y2 = y1; y1 = bp;

        let env = 0.001;
        if (t < 0.002) env = 0.001 + 0.319 * (t / 0.002);
        else if (t < 0.01) env = 0.32 * Math.pow(0.05 / 0.32, (t - 0.002) / 0.008);
        else if (t < 0.012) env = 0.05 + 0.25 * ((t - 0.01) / 0.002);
        else if (t < 0.02) env = 0.3 * Math.pow(0.05 / 0.3, (t - 0.012) / 0.008);
        else if (t < 0.023) env = 0.05 + 0.29 * ((t - 0.02) / 0.003);
        else env = 0.34 * Math.pow(0.001 / 0.34, Math.min(1, (t - 0.023) / 0.127));

        data[i] = Math.max(-1, Math.min(1, bp * env));
      }
      return buffer;
    } catch {
      return null;
    }
  }

  private renderArpeggioBuffer(
    ctx: AudioContext,
    notes: readonly number[],
    spacing: number,
    durations: readonly number[],
    peaks: readonly number[]
  ): AudioBuffer | null {
    try {
      const sr = ctx.sampleRate || 44100;
      let totalSec = 0;
      for (let n = 0; n < notes.length; n++) {
        totalSec = Math.max(totalSec, n * spacing + durations[n] + 0.015);
      }
      const length = Math.max(1, Math.floor(sr * totalSec));
      const buffer = ctx.createBuffer(1, length, sr);
      const data = buffer.getChannelData(0);

      for (let n = 0; n < notes.length; n++) {
        const freq = notes[n];
        const startSample = Math.floor(n * spacing * sr);
        const dur = durations[n];
        const peak = peaks[n];
        const endSample = Math.min(length, startSample + Math.floor((dur + 0.01) * sr));
        let phase = 0;
        for (let i = startSample; i < endSample; i++) {
          const localT = (i - startSample) / sr;
          phase += freq / sr;
          const env =
            localT < 0.01
              ? 0.001 + (peak - 0.001) * (localT / 0.01)
              : peak * Math.pow(0.001 / peak, Math.min(1, (localT - 0.01) / Math.max(0.01, dur - 0.01)));
          data[i] += triangleWave(phase) * env;
        }
      }

      for (let i = 0; i < length; i++) {
        if (data[i] > 1) data[i] = 1;
        else if (data[i] < -1) data[i] = -1;
      }
      return buffer;
    } catch {
      return null;
    }
  }

  private renderChimeBuffer(ctx: AudioContext): AudioBuffer | null {
    return this.renderArpeggioBuffer(
      ctx,
      [1046.5, 1318.51, 1567.98],
      0.035,
      [0.28, 0.28, 0.28],
      [0.2, 0.2, 0.2]
    );
  }

  private renderNoteBuffer(ctx: AudioContext, freq: number, safeDur: number): AudioBuffer | null {
    try {
      const sr = ctx.sampleRate || 44100;
      const length = Math.max(1, Math.floor(sr * (safeDur + 0.01)));
      const buffer = ctx.createBuffer(1, length, sr);
      const data = buffer.getChannelData(0);
      let phase = 0;
      for (let i = 0; i < length; i++) {
        const t = i / sr;
        phase += freq / sr;
        const env =
          t < 0.01
            ? 0.001 + (0.26 - 0.001) * (t / 0.01)
            : 0.26 * Math.pow(0.001 / 0.26, Math.min(1, (t - 0.01) / Math.max(0.01, safeDur - 0.01)));
        data[i] = triangleWave(phase) * env;
      }
      return buffer;
    } catch {
      return null;
    }
  }

  /**
   * Stops only synth oscillators/noise bursts belonging to a specific playback source (`'main'` or `'preview'`).
   */
  stopSource(source: BeatSynthSource): void {
    if (this.pendingGestureQueue.length > 0) {
      this.pendingGestureQueue = this.pendingGestureQueue.filter((item) => item.source !== source);
    }
    for (const [node, nodeSource] of Array.from(this.activeNodes.entries())) {
      if (nodeSource !== source) continue;
      this.activeNodes.delete(node);
      try {
        node.stop();
      } catch {
        // Ignore already-stopped nodes
      }
      try {
        node.disconnect();
      } catch {
        // Ignore
      }
    }
  }

  /**
   * Immediately stops any active synth oscillators or noise bursts across all sources.
   */
  stopAll(): void {
    this.pendingGestureQueue = [];
    for (const node of Array.from(this.activeNodes.keys())) {
      try {
        node.stop();
      } catch {
        // Ignore already-stopped nodes
      }
      try {
        node.disconnect();
      } catch {
        // Ignore
      }
    }
    this.activeNodes.clear();
  }

  /**
   * Punchy 808-style kick drum: sine pitch-drop (155 Hz -> 42 Hz) + soft click transient.
   */
  playKick(speedScale: number = 1): void {
    const ctx = this.getReadyContext(() => this.playKick(speedScale));
    if (!ctx) return;

    const s = Math.max(0.12, Math.min(2, speedScale));
    const totalDur = Math.max(0.025, 0.21 * s);

    try {
      if (this.sampleCacheEnabled && Math.abs(s - 1) < 0.01) {
        const cached = this.getOrCreateCachedSample(ctx, 'kick', () => this.renderKickBuffer(ctx));
        if (cached) {
          this.playCachedBuffer(ctx, cached);
          return;
        }
      }

      const now = this.getScheduleStartTime(ctx);

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(155, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.16 * s);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.45, now + 0.005 * s);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2 * s);

      osc.connect(gain);
      gain.connect(ctx.destination);

      this.trackSource(osc);
      osc.start(now);
      osc.stop(now + totalDur);

      // Subtle beater click
      const clickOsc = ctx.createOscillator();
      const clickGain = ctx.createGain();
      clickOsc.type = 'triangle';
      clickOsc.frequency.setValueAtTime(240, now);
      clickOsc.frequency.exponentialRampToValueAtTime(65, now + 0.025 * s);

      clickGain.gain.setValueAtTime(0.18, now);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03 * s);

      clickOsc.connect(clickGain);
      clickGain.connect(ctx.destination);

      this.trackSource(clickOsc);
      clickOsc.start(now);
      clickOsc.stop(now + 0.035 * s);
    } catch {
      // Never block or throw
    }
  }

  /**
   * Crisp snare drum: highpass-filtered noise wires + triangle drum body.
   */
  playSnare(speedScale: number = 1): void {
    const ctx = this.getReadyContext(() => this.playSnare(speedScale));
    if (!ctx) return;

    const s = Math.max(0.16, Math.min(2, speedScale));
    const totalDur = Math.max(0.025, 0.15 * s);

    try {
      if (this.sampleCacheEnabled && Math.abs(s - 1) < 0.01) {
        const cached = this.getOrCreateCachedSample(ctx, 'snare', () => this.renderSnareBuffer(ctx));
        if (cached) {
          this.playCachedBuffer(ctx, cached);
          return;
        }
      }

      const now = this.getScheduleStartTime(ctx);
      const noiseBuf = this.getNoiseBuffer(ctx);

      if (noiseBuf) {
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuf;

        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(950, now);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.28, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14 * s);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(ctx.destination);

        this.trackSource(noise);
        noise.start(now);
        noise.stop(now + totalDur);
      }

      const bodyOsc = ctx.createOscillator();
      const bodyGain = ctx.createGain();
      bodyOsc.type = 'triangle';
      bodyOsc.frequency.setValueAtTime(190, now);
      bodyOsc.frequency.exponentialRampToValueAtTime(95, now + 0.08 * s);

      bodyGain.gain.setValueAtTime(0.26, now);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09 * s);

      bodyOsc.connect(bodyGain);
      bodyGain.connect(ctx.destination);

      this.trackSource(bodyOsc);
      bodyOsc.start(now);
      bodyOsc.stop(now + 0.1 * s);
    } catch {
      // Never block or throw
    }
  }

  /**
   * Multi-burst bandpass-filtered handclap accent.
   */
  playClap(speedScale: number = 1): void {
    const ctx = this.getReadyContext(() => this.playClap(speedScale));
    if (!ctx) return;

    const s = Math.max(0.15, Math.min(2, speedScale));
    const totalDur = Math.max(0.025, 0.16 * s);

    try {
      if (this.sampleCacheEnabled && Math.abs(s - 1) < 0.01) {
        const cached = this.getOrCreateCachedSample(ctx, 'clap', () => this.renderClapBuffer(ctx));
        if (cached) {
          this.playCachedBuffer(ctx, cached);
          return;
        }
      }

      const now = this.getScheduleStartTime(ctx);
      const noiseBuf = this.getNoiseBuffer(ctx);
      if (!noiseBuf) return;

      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuf;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1350, now);
      filter.Q.setValueAtTime(1.4, now);

      const gain = ctx.createGain();
      // 3 crisp micro-bursts + warm decay tail
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.32, now + 0.002 * s);
      gain.gain.exponentialRampToValueAtTime(0.05, now + 0.01 * s);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.012 * s);
      gain.gain.exponentialRampToValueAtTime(0.05, now + 0.02 * s);
      gain.gain.linearRampToValueAtTime(0.34, now + 0.023 * s);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15 * s);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      this.trackSource(noise);
      noise.start(now);
      noise.stop(now + totalDur);
    } catch {
      // Never block or throw
    }
  }

  /**
   * Bright celebratory bell chime arpeggio (C6 - E6 - G6).
   */
  playChime(speedScale: number = 1): void {
    const ctx = this.getReadyContext(() => this.playChime(speedScale));
    if (!ctx) return;

    const s = Math.max(0.085, Math.min(2, speedScale));

    try {
      if (this.sampleCacheEnabled && Math.abs(s - 1) < 0.01) {
        const cached = this.getOrCreateCachedSample(ctx, 'chime', () => this.renderChimeBuffer(ctx));
        if (cached) {
          this.playCachedBuffer(ctx, cached);
          return;
        }
      }

      const now = this.getScheduleStartTime(ctx);
      const notes = [1046.5, 1318.51, 1567.98]; // C6, E6, G6

      notes.forEach((freq, idx) => {
        const t0 = now + idx * 0.035 * s;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t0);

        gain.gain.setValueAtTime(0.001, t0);
        gain.gain.linearRampToValueAtTime(0.2, t0 + 0.008 * s);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.28 * s);

        osc.connect(gain);
        gain.connect(ctx.destination);

        this.trackSource(osc);
        osc.start(t0);
        osc.stop(t0 + 0.29 * s);
      });
    } catch {
      // Never block or throw
    }
  }

  /**
   * Cheerful victory fanfare played when a puzzle is solved or a module badge is earned.
   * Respects mute & Web Audio autoplay state; never throws or blocks.
   */
  playVictoryFanfare(isGrand: boolean = false): void {
    const ctx = this.getReadyContext(() => this.playVictoryFanfare(isGrand));
    if (!ctx) return;

    try {
      const notes = isGrand
        ? [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98] // C5..G6 grand trophy fanfare
        : [523.25, 659.25, 783.99, 1046.5]; // C5..C6 puzzle win arpeggio
      const spacing = isGrand ? 0.085 : 0.075;

      if (this.sampleCacheEnabled) {
        const fanfareKey = isGrand ? 'fanfare:grand' : 'fanfare:std';
        const cached = this.getOrCreateCachedSample(ctx, fanfareKey, () =>
          this.renderArpeggioBuffer(
            ctx,
            notes,
            spacing,
            notes.map((_, idx) => (idx === notes.length - 1 ? (isGrand ? 0.55 : 0.4) : 0.2)),
            notes.map((_, idx) => (idx === notes.length - 1 ? 0.24 : 0.18))
          )
        );
        if (cached) {
          this.playCachedBuffer(ctx, cached);
          return;
        }
      }

      const now = this.getScheduleStartTime(ctx);

      notes.forEach((freq, idx) => {
        const isLast = idx === notes.length - 1;
        const t0 = now + idx * spacing;
        const dur = isLast ? (isGrand ? 0.55 : 0.4) : 0.2;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t0);

        gain.gain.setValueAtTime(0.001, t0);
        gain.gain.linearRampToValueAtTime(isLast ? 0.24 : 0.18, t0 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        this.trackSource(osc);
        osc.start(t0);
        osc.stop(t0 + dur + 0.015);
      });
    } catch {
      // Never block or throw
    }
  }

  /**
   * Plays a scale note (1..8 => C4..C5) for Tier 2 PLAY_NOTE.
   */
  playNote(pitch: number = 1, durationSec: number = 0.28): void {
    const ctx = this.getReadyContext(() => this.playNote(pitch, durationSec));
    if (!ctx) return;

    try {
      const clampedIdx = Math.max(0, Math.min(BEAT_SCALE_FREQUENCIES.length - 1, Math.round(pitch) - 1));
      const freq = BEAT_SCALE_FREQUENCIES[clampedIdx];
      const safeDur = Math.max(0.025, Math.min(2.0, durationSec));

      if (this.sampleCacheEnabled) {
        const bucketMs = Math.max(60, Math.round((safeDur * 1000) / 20) * 20);
        const noteKey = `note:${clampedIdx}:${bucketMs}`;
        const cached = this.getOrCreateCachedSample(
          ctx,
          noteKey,
          () => this.renderNoteBuffer(ctx, freq, bucketMs / 1000),
          true
        );
        if (cached) {
          this.playCachedBuffer(ctx, cached);
          return;
        }
      }

      const now = this.getScheduleStartTime(ctx);

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.26, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + safeDur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      this.trackSource(osc);
      osc.start(now);
      osc.stop(now + safeDur + 0.01);
    } catch {
      // Never block or throw
    }
  }

  /**
   * Returns the exact sound playback duration in ms for a BeatTriggerEvent at `speed`.
   */
  getEventDurationMs(event: BeatTriggerEvent | null | undefined, speed: SimulationSpeed = 400): number {
    return getBeatEventSoundDurationMs(event, speed);
  }

  /**
   * Dispatches a BeatTriggerEvent to the Web Audio synth.
   * Guaranteed 100% silent when muted or in `'instant'` simulation mode.
   */
  playEvent(event: BeatTriggerEvent | null | undefined, speed: SimulationSpeed = 400): void {
    if (!event || this.muted) return;
    if (speed === 'instant' || (speed as any) === 0) return;

    const speedScale = normalizeSpeedScale(speed);

    switch (event.kind) {
      case 'DRUM_KICK':
        this.playKick(speedScale);
        break;
      case 'DRUM_SNARE':
        this.playSnare(speedScale);
        break;
      case 'DRUM_CLAP':
        this.playClap(speedScale);
        break;
      case 'PLAY_CHIME':
        this.playChime(speedScale);
        break;
      case 'PLAY_NOTE': {
        const durSec = getBeatNoteDurationSec(event.durationBeats ?? 1, speed);
        this.playNote(event.pitch ?? 1, durSec);
        break;
      }
      default:
        // WAIT_BEAT, STAMP, CLEAR_LEDS, LED_CHANGE, SET_BEAT_DELAY are visual-only events
        break;
    }
  }

  /**
   * Test helper to reset internal singleton state between Vitest runs.
   */
  resetForTests(): void {
    this.isResuming = false;
    this.currentSource = 'main';
    this.stopAll();
    if (this.ctx && typeof this.ctx.close === 'function') {
      try {
        const p = this.ctx.close();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch {
        // Ignore
      }
    }
    this.ctx = null;
    this.noiseBuffer = null;
    this.sampleCache.clear();
    this.noteCacheKeys = [];
    this.sampleCacheSampleRate = 0;
    this.sampleCacheEnabled = hasNativeOfflineAudioContext();
    this.lowQualityMode = false;
    this.prewarmScheduled = false;
    this.muted = false;
    this.blockedByAutoplay = false;
    this.unavailable = false;
    this.notify();
  }
}

export const beatSynth = new BeatSynthEngine();
