import { SimulationSpeed } from '../../types';
import { BeatTriggerEvent } from './types';

export type BeatAudioStatus = 'uninitialized' | 'running' | 'suspended' | 'unavailable';

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

export class BeatSynthEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted: boolean = false;
  private blockedByAutoplay: boolean = false;
  private unavailable: boolean = false;
  private activeNodes = new Set<StoppableNode>();
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
            }
            this.notify();
          });
        }
      }

      if (this.ctx.state === 'suspended' && typeof this.ctx.resume === 'function') {
        const maybePromise = this.ctx.resume();
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise
            .then(() => {
              if (this.ctx?.state === 'running') {
                this.blockedByAutoplay = false;
              }
              this.notify();
            })
            .catch(() => {
              this.blockedByAutoplay = true;
              this.notify();
            });
        }
      }

      if (this.ctx.state === 'running') {
        this.blockedByAutoplay = false;
      }
      this.notify();
      return this.ctx.state === 'running';
    } catch {
      this.unavailable = true;
      this.ctx = null;
      this.notify();
      return false;
    }
  }

  private getReadyContext(): AudioContext | null {
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
      this.blockedByAutoplay = true;
      this.notify();
      return null;
    }
    return this.ctx;
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

  private trackSource(node: AudioScheduledSourceNode | StoppableNode): void {
    this.activeNodes.add(node as StoppableNode);
    const anyNode = node as any;
    if ('onended' in anyNode) {
      anyNode.onended = () => {
        this.activeNodes.delete(node as StoppableNode);
        try {
          node.disconnect();
        } catch {
          // Ignore
        }
      };
    }
  }

  /**
   * Immediately stops any active synth oscillators or noise bursts.
   */
  stopAll(): void {
    for (const node of Array.from(this.activeNodes)) {
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
  playKick(): void {
    const ctx = this.getReadyContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(155, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.16);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.45, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      this.trackSource(osc);
      osc.start(now);
      osc.stop(now + 0.21);

      // Subtle beater click
      const clickOsc = ctx.createOscillator();
      const clickGain = ctx.createGain();
      clickOsc.type = 'triangle';
      clickOsc.frequency.setValueAtTime(240, now);
      clickOsc.frequency.exponentialRampToValueAtTime(65, now + 0.025);

      clickGain.gain.setValueAtTime(0.18, now);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

      clickOsc.connect(clickGain);
      clickGain.connect(ctx.destination);

      this.trackSource(clickOsc);
      clickOsc.start(now);
      clickOsc.stop(now + 0.035);
    } catch {
      // Never block or throw
    }
  }

  /**
   * Crisp snare drum: highpass-filtered noise wires + triangle drum body.
   */
  playSnare(): void {
    const ctx = this.getReadyContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const noiseBuf = this.getNoiseBuffer(ctx);

      if (noiseBuf) {
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuf;

        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(950, now);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.28, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(ctx.destination);

        this.trackSource(noise);
        noise.start(now);
        noise.stop(now + 0.15);
      }

      const bodyOsc = ctx.createOscillator();
      const bodyGain = ctx.createGain();
      bodyOsc.type = 'triangle';
      bodyOsc.frequency.setValueAtTime(190, now);
      bodyOsc.frequency.exponentialRampToValueAtTime(95, now + 0.08);

      bodyGain.gain.setValueAtTime(0.26, now);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      bodyOsc.connect(bodyGain);
      bodyGain.connect(ctx.destination);

      this.trackSource(bodyOsc);
      bodyOsc.start(now);
      bodyOsc.stop(now + 0.1);
    } catch {
      // Never block or throw
    }
  }

  /**
   * Multi-burst bandpass-filtered handclap accent.
   */
  playClap(): void {
    const ctx = this.getReadyContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const noiseBuf = this.getNoiseBuffer(ctx);
      if (!noiseBuf) return;

      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuf;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1350, now);
      filter.Q.setValueAtTime(1.4, now);

      const gain = ctx.createGain();
      // 3 crisp micro-bursts (0ms, 11ms, 22ms) + warm decay tail
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.32, now + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.05, now + 0.01);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.05, now + 0.02);
      gain.gain.linearRampToValueAtTime(0.34, now + 0.023);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      this.trackSource(noise);
      noise.start(now);
      noise.stop(now + 0.16);
    } catch {
      // Never block or throw
    }
  }

  /**
   * Bright celebratory bell chime arpeggio (C6 - E6 - G6).
   */
  playChime(): void {
    const ctx = this.getReadyContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [1046.5, 1318.51, 1567.98]; // C6, E6, G6

      notes.forEach((freq, idx) => {
        const t0 = now + idx * 0.035;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t0);

        gain.gain.setValueAtTime(0.001, t0);
        gain.gain.linearRampToValueAtTime(0.2, t0 + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.28);

        osc.connect(gain);
        gain.connect(ctx.destination);

        this.trackSource(osc);
        osc.start(t0);
        osc.stop(t0 + 0.29);
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
    const ctx = this.getReadyContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = isGrand
        ? [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98] // C5..G6 grand trophy fanfare
        : [523.25, 659.25, 783.99, 1046.5]; // C5..C6 puzzle win arpeggio
      const spacing = isGrand ? 0.085 : 0.075;

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
    const ctx = this.getReadyContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const clampedIdx = Math.max(0, Math.min(BEAT_SCALE_FREQUENCIES.length - 1, Math.round(pitch) - 1));
      const freq = BEAT_SCALE_FREQUENCIES[clampedIdx];
      const safeDur = Math.max(0.06, Math.min(2.0, durationSec));

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
   * Dispatches a BeatTriggerEvent to the Web Audio synth.
   * Guaranteed 100% silent when muted or in `'instant'` simulation mode.
   */
  playEvent(event: BeatTriggerEvent | null | undefined, speed: SimulationSpeed = 400): void {
    if (!event || this.muted) return;
    if (speed === 'instant' || (speed as any) === 0) return;

    switch (event.kind) {
      case 'DRUM_KICK':
        this.playKick();
        break;
      case 'DRUM_SNARE':
        this.playSnare();
        break;
      case 'DRUM_CLAP':
        this.playClap();
        break;
      case 'PLAY_CHIME':
        this.playChime();
        break;
      case 'PLAY_NOTE': {
        const beatSec = typeof speed === 'number' ? Math.max(0.06, (speed / 1000) * 0.9) : 0.28;
        const mult = event.durationBeats ?? 1;
        this.playNote(event.pitch ?? 1, beatSec * mult);
        break;
      }
      default:
        // WAIT_BEAT, STAMP, CLEAR_LEDS, LED_CHANGE are visual-only events
        break;
    }
  }

  /**
   * Test helper to reset internal singleton state between Vitest runs.
   */
  resetForTests(): void {
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
    this.muted = false;
    this.blockedByAutoplay = false;
    this.unavailable = false;
    this.notify();
  }
}

export const beatSynth = new BeatSynthEngine();
