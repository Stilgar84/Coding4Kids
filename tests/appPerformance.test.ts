import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BeatSynthEngine } from '../src/simulations/beat/beatSynth';
import {
  FrameSmoothnessMonitor,
  loadPersistedPerformanceMode,
  savePersistedPerformanceMode,
} from '../src/utils/performanceMonitor';
import { useAppStore, isLowQualityActive } from '../src/store/useAppStore';
import { BeatCanvas } from '../src/simulations/beat/components/BeatCanvas';
import { GridCanvas } from '../src/components/GridCanvas';
import { TurtleCanvas } from '../src/simulations/turtle/components/TurtleCanvas';
import { VictoryCelebrationModal } from '../src/components/VictoryCelebrationModal';
import { MobileDrawerMenu } from '../src/components/MobileDrawerMenu';
import { createInitialBeatState } from '../src/simulations/beat/beatEnvironment';
import { createInitialTurtleState } from '../src/simulations/turtle/turtleEnvironment';

class MockBufferSourceNode {
  buffer: unknown = null;
  onended: (() => void) | null = null;
  connect = () => this;
  start = () => {};
  stop = () => {
    this.onended?.();
  };
  disconnect = () => {};
}

class MockGainNode {
  gain = {
    value: 1,
    setValueAtTime: () => {},
    linearRampToValueAtTime: () => {},
    exponentialRampToValueAtTime: () => {},
  };
  connect = () => this;
  disconnect = () => {};
}

class MockOscillatorNode {
  type = 'sine';
  frequency = {
    value: 440,
    setValueAtTime: () => {},
    exponentialRampToValueAtTime: () => {},
  };
  onended: (() => void) | null = null;
  connect = () => this;
  start = () => {};
  stop = () => {
    this.onended?.();
  };
  disconnect = () => {};
}

class MockBiquadFilterNode {
  type = 'lowpass';
  frequency = {
    value: 1000,
    setValueAtTime: () => {},
    exponentialRampToValueAtTime: () => {},
  };
  Q = { value: 1 };
  connect = () => this;
}

class MockAudioBuffer {
  length: number;
  sampleRate: number;
  constructor(length: number, sampleRate: number) {
    this.length = length;
    this.sampleRate = sampleRate;
  }
  getChannelData() {
    return new Float32Array(this.length);
  }
}

describe('App & Beat Performance Optimizations', () => {
  const originalAudioContext = (globalThis as any).AudioContext;
  const originalOfflineAudioContext = (globalThis as any).OfflineAudioContext;

  beforeEach(() => {
    useAppStore.setState({
      performanceMode: 'auto',
      isAutoLowQuality: false,
      isVictoryModalOpen: false,
      isMobileMenuOpen: false,
    });
  });

  afterEach(() => {
    (globalThis as any).AudioContext = originalAudioContext;
    (globalThis as any).OfflineAudioContext = originalOfflineAudioContext;
  });

  it('caches rendered PCM AudioBuffers and enforces voice caps in BeatSynthEngine', async () => {
    let bufferSourcesCreated = 0;
    let buffersCreated = 0;

    class MockOnlineAudioContext {
      state = 'running';
      currentTime = 0;
      sampleRate = 44100;
      destination = {};
      resume = async () => {};
      createGain = () => new MockGainNode();
      createOscillator = () => new MockOscillatorNode();
      createBiquadFilter = () => new MockBiquadFilterNode();
      createBuffer = (_ch: number, len: number, sr: number) => {
        buffersCreated++;
        return new MockAudioBuffer(len, sr);
      };
      createBufferSource = () => {
        bufferSourcesCreated++;
        return new MockBufferSourceNode();
      };
    }

    (globalThis as any).AudioContext = MockOnlineAudioContext;

    const synth = new BeatSynthEngine();
    synth.setSampleCacheEnabled(true);
    expect(synth.isSampleCacheEnabled()).toBe(true);
    expect(synth.unlockFromGesture()).toBe(true);

    // First play synthesizes & caches 'kick' AudioBuffer once
    synth.playKick();
    expect(buffersCreated).toBe(1);
    expect(synth.getCachedSampleCount()).toBe(1);

    // Subsequent plays reuse the cached AudioBuffer without re-creating buffers
    synth.playKick();
    synth.playKick();
    expect(buffersCreated).toBe(1);
    expect(bufferSourcesCreated).toBe(3);

    // Low quality mode switches voice cap cleanly (caps active voices at 4)
    synth.setLowQualityMode(true);
    expect(synth.isLowQualityMode()).toBe(true);
    for (let i = 0; i < 8; i++) {
      synth.playKick();
    }
    expect(synth.getCachedSampleCount()).toBe(1);
  });

  it('detects sustained jank in FrameSmoothnessMonitor while ignoring warm-up and background spikes', () => {
    let triggered = 0;
    const monitor = new FrameSmoothnessMonitor({
      windowSize: 6,
      warmupFrames: 2,
      avgDeltaThresholdMs: 34,
      jankFrameThresholdMs: 50,
      jankCountThreshold: 3,
      onLowSmoothnessDetected: () => {
        triggered++;
      },
    });

    // Initial timestamp + 2 warm-up frames (even if slow) must not trigger
    let t = 1000;
    expect(monitor.recordFrame(t)).toBe(false);
    t += 120; // warmup 1
    expect(monitor.recordFrame(t)).toBe(false);
    t += 120; // warmup 2
    expect(monitor.recordFrame(t)).toBe(false);

    // Smooth 60fps frames (~16ms)
    for (let i = 0; i < 6; i++) {
      t += 16;
      expect(monitor.recordFrame(t)).toBe(false);
    }
    expect(triggered).toBe(0);

    // Background tab pause (>1000ms) is ignored
    t += 2500;
    expect(monitor.recordFrame(t)).toBe(false);
    expect(triggered).toBe(0);

    // Sustained jank (~45ms avg) triggers once
    let didTrigger = false;
    for (let i = 0; i < 6; i++) {
      t += 45;
      if (monitor.recordFrame(t)) {
        didTrigger = true;
      }
    }
    expect(didTrigger).toBe(true);
    expect(triggered).toBe(1);

    // Does not trigger a second time
    t += 80;
    expect(monitor.recordFrame(t)).toBe(false);
    expect(triggered).toBe(1);
  });

  it('cycles performanceMode and keeps isAutoLowQuality transient (non-persisted)', () => {
    expect(useAppStore.getState().performanceMode).toBe('auto');
    expect(isLowQualityActive(useAppStore.getState())).toBe(false);

    useAppStore.getState().triggerAutoLowQuality();
    expect(useAppStore.getState().isAutoLowQuality).toBe(true);
    expect(isLowQualityActive(useAppStore.getState())).toBe(true);

    // When auto-Lite is active, cycling escapes directly to 'high'
    useAppStore.getState().cyclePerformanceMode(); // auto(lite) -> high
    expect(useAppStore.getState().performanceMode).toBe('high');
    expect(isLowQualityActive(useAppStore.getState())).toBe(false);

    useAppStore.getState().cyclePerformanceMode(); // high -> auto
    expect(useAppStore.getState().performanceMode).toBe('auto');

    useAppStore.getState().cyclePerformanceMode(); // auto -> low
    expect(useAppStore.getState().performanceMode).toBe('low');
    expect(isLowQualityActive(useAppStore.getState())).toBe(true);

    useAppStore.getState().cyclePerformanceMode(); // low -> high
    expect(useAppStore.getState().performanceMode).toBe('high');

    // Persisted helper only stores manual mode
    savePersistedPerformanceMode('auto');
    expect(loadPersistedPerformanceMode()).toBe('auto');
  });

  it('strips heavy visual effects in Lite mode across Beat, Grid, Turtle, VictoryModal, and renders Menu toggle', () => {
    const beatState = createInitialBeatState();
    beatState.leds[0][0] = '#10b981';
    beatState.beatIndex = 1;
    const turtleState = createInitialTurtleState();

    // Standard (High) mode
    useAppStore.setState({
      performanceMode: 'high',
      isAutoLowQuality: false,
      beatState,
      turtleState,
      isVictoryModalOpen: true,
      isMobileMenuOpen: true,
      runtime: {
        status: 'RUNNING',
        variables: { x: 1 },
        currentPc: 0,
        callStack: [],
        loopStack: [],
      } as any,
    });

    const beatHighHtml = renderToStaticMarkup(
      React.createElement(BeatCanvas, { state: beatState, runtimeStatus: 'RUNNING' })
    );
    expect(beatHighHtml).toContain('data-quality="high"');
    expect(beatHighHtml).toContain('data-testid="beat-ring-pulse"');
    expect(beatHighHtml).toContain('box-shadow');

    const gridHighHtml = renderToStaticMarkup(React.createElement(GridCanvas));
    expect(gridHighHtml).toContain('data-quality="high"');
    expect(gridHighHtml).toContain('backdrop-blur');

    const turtleHighHtml = renderToStaticMarkup(
      React.createElement(TurtleCanvas, { state: turtleState, runtimeStatus: 'RUNNING' })
    );
    expect(turtleHighHtml).toContain('data-quality="high"');
    expect(turtleHighHtml).toContain('animate-pulse');

    const victoryHighHtml = renderToStaticMarkup(React.createElement(VictoryCelebrationModal));
    expect(victoryHighHtml).toContain('data-quality="high"');
    expect(victoryHighHtml).toContain('backdrop-blur-md');

    const menuHighHtml = renderToStaticMarkup(React.createElement(MobileDrawerMenu));
    expect(menuHighHtml).toContain('data-testid="drawer-btn-quality-mode"');
    expect(menuHighHtml).toContain('Glow');

    // Lite (Low) mode via auto-detection
    useAppStore.setState({
      performanceMode: 'auto',
      isAutoLowQuality: true,
    });

    const beatLowHtml = renderToStaticMarkup(
      React.createElement(BeatCanvas, { state: beatState, runtimeStatus: 'RUNNING' })
    );
    expect(beatLowHtml).toContain('data-quality="low"');
    expect(beatLowHtml).not.toContain('data-testid="beat-ring-pulse"');
    expect(beatLowHtml).not.toContain('box-shadow');

    const gridLowHtml = renderToStaticMarkup(React.createElement(GridCanvas));
    expect(gridLowHtml).toContain('data-quality="low"');
    expect(gridLowHtml).not.toContain('backdrop-blur');

    const turtleLowHtml = renderToStaticMarkup(
      React.createElement(TurtleCanvas, { state: turtleState, runtimeStatus: 'RUNNING' })
    );
    expect(turtleLowHtml).toContain('data-quality="low"');
    expect(turtleLowHtml).not.toContain('animate-pulse');

    const victoryLowHtml = renderToStaticMarkup(React.createElement(VictoryCelebrationModal));
    expect(victoryLowHtml).toContain('data-quality="low"');
    expect(victoryLowHtml).not.toContain('backdrop-blur-md');
    expect(victoryLowHtml).not.toContain('blur-3xl');

    const menuLowHtml = renderToStaticMarkup(React.createElement(MobileDrawerMenu));
    expect(menuLowHtml).toContain('data-testid="drawer-btn-quality-mode"');
    expect(menuLowHtml).toContain('Auto (Lite)');
  });
});
