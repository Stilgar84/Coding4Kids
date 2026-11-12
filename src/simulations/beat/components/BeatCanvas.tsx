import React, { useSyncExternalStore } from 'react';
import { Bell, Eraser, Gauge, Grid, Hourglass, Infinity as InfinityIcon, Music, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { Direction, SimulationStatus } from '../../../types';
import { isLowQualityActive, useAppStoreSelector } from '../../../store/useAppStore';
import { BEAT_GRID_SIZE, BEAT_LED_PALETTE, BeatCueKind, BeatState } from '../types';
import { beatSynth } from '../beatSynth';

interface BeatCanvasProps {
  state: BeatState;
  runtimeStatus?: SimulationStatus;
}

interface CueVisualStyle {
  ringBorderClass: string;
  ringGlowColor: string;
  pillClass: string;
  symbol: string;
  label: string;
  icon: React.ReactNode;
}

function getCueVisualStyle(cue: BeatCueKind | 'NONE'): CueVisualStyle {
  switch (cue) {
    case 'DRUM_KICK':
      return {
        ringBorderClass: 'border-rose-400 border-solid',
        ringGlowColor: 'rgba(244, 63, 94, 0.55)',
        pillClass: 'bg-rose-500/20 border-rose-400 text-rose-200',
        symbol: '●',
        label: 'Kick Drum',
        icon: (
          <svg className="w-4 h-4 stroke-current" viewBox="0 0 24 24" fill="none" strokeWidth="2.4">
            <circle cx="12" cy="12" r="8" />
            <circle cx="12" cy="12" r="3" fill="currentColor" />
          </svg>
        ),
      };
    case 'DRUM_SNARE':
      return {
        ringBorderClass: 'border-orange-400 border-dashed',
        ringGlowColor: 'rgba(251, 146, 60, 0.55)',
        pillClass: 'bg-orange-500/20 border-orange-400 text-orange-200',
        symbol: '✕',
        label: 'Snare Drum',
        icon: (
          <svg className="w-4 h-4 stroke-current" viewBox="0 0 24 24" fill="none" strokeWidth="2.4" strokeLinecap="round">
            <line x1="5" y1="4" x2="15" y2="11" />
            <line x1="19" y1="4" x2="9" y2="11" />
            <rect x="4" y="12" width="16" height="7" rx="2" />
          </svg>
        ),
      };
    case 'DRUM_CLAP':
      return {
        ringBorderClass: 'border-fuchsia-400 border-double',
        ringGlowColor: 'rgba(232, 121, 249, 0.55)',
        pillClass: 'bg-fuchsia-500/20 border-fuchsia-400 text-fuchsia-200',
        symbol: '✦',
        label: 'Handclap',
        icon: <Sparkles className="w-4 h-4" />,
      };
    case 'PLAY_CHIME':
      return {
        ringBorderClass: 'border-amber-300 border-solid',
        ringGlowColor: 'rgba(251, 191, 36, 0.55)',
        pillClass: 'bg-amber-500/20 border-amber-300 text-amber-200',
        symbol: '★',
        label: 'Bell Chime',
        icon: <Bell className="w-4 h-4" />,
      };
    case 'PLAY_NOTE':
      return {
        ringBorderClass: 'border-violet-400 border-solid',
        ringGlowColor: 'rgba(167, 139, 250, 0.5)',
        pillClass: 'bg-violet-500/20 border-violet-400 text-violet-200',
        symbol: '♪',
        label: 'Musical Note',
        icon: <Music className="w-4 h-4" />,
      };
    case 'STAMP':
      return {
        ringBorderClass: 'border-cyan-400 border-solid',
        ringGlowColor: 'rgba(34, 211, 238, 0.45)',
        pillClass: 'bg-cyan-500/20 border-cyan-400 text-cyan-200',
        symbol: '❖',
        label: 'LED Stamp',
        icon: <Grid className="w-4 h-4" />,
      };
    case 'WAIT_BEAT':
      return {
        ringBorderClass: 'border-sky-400/80 border-dashed',
        ringGlowColor: 'rgba(56, 189, 248, 0.3)',
        pillClass: 'bg-sky-500/15 border-sky-400/70 text-sky-200',
        symbol: '◌',
        label: 'Hold Beat',
        icon: <Hourglass className="w-4 h-4" />,
      };
    case 'CLEAR_LEDS':
      return {
        ringBorderClass: 'border-slate-500 border-solid',
        ringGlowColor: 'rgba(100, 116, 139, 0.25)',
        pillClass: 'bg-slate-800 border-slate-600 text-slate-300',
        symbol: '□',
        label: 'Clear LEDs',
        icon: <Eraser className="w-4 h-4" />,
      };
    case 'LED_CHANGE':
      return {
        ringBorderClass: 'border-emerald-400 border-solid',
        ringGlowColor: 'rgba(52, 211, 153, 0.4)',
        pillClass: 'bg-emerald-500/15 border-emerald-400/70 text-emerald-200',
        symbol: '◆',
        label: 'LED Light',
        icon: <Sparkles className="w-4 h-4" />,
      };
    case 'SET_BEAT_DELAY':
      return {
        ringBorderClass: 'border-sky-400 border-solid',
        ringGlowColor: 'rgba(56, 189, 248, 0.45)',
        pillClass: 'bg-sky-500/20 border-sky-400 text-sky-200',
        symbol: '⏱',
        label: 'Step Delay',
        icon: <Gauge className="w-4 h-4 text-sky-300" />,
      };
    default:
      return {
        ringBorderClass: 'border-slate-700/80 border-solid',
        ringGlowColor: 'transparent',
        pillClass: 'bg-slate-900/90 border-slate-700 text-slate-300',
        symbol: '♪',
        label: 'Ready',
        icon: <Music className="w-4 h-4 text-fuchsia-400" />,
      };
  }
}

function getCursorArrowRotation(dir: BeatState['cursor']['dir']): number {
  switch (dir) {
    case 'NORTH':
      return 0;
    case 'EAST':
      return 90;
    case 'SOUTH':
      return 180;
    case 'WEST':
      return 270;
  }
}

interface BeatLedCellProps {
  col: number;
  row: number;
  ledColor: string | null;
  isCursorHere: boolean;
  cursorDir: Direction;
  isLowQuality: boolean;
}

const BeatLedCell = React.memo<BeatLedCellProps>(
  ({ col, row, ledColor, isCursorHere, cursorDir, isLowQuality }) => {
    const isLit = Boolean(ledColor);

    return (
      <div
        data-testid={`beat-led-${col}-${row}`}
        data-coord={`${col + 1},${row + 1}`}
        data-lit={isLit ? 'true' : 'false'}
        data-color={ledColor || ''}
        style={
          isLit && ledColor
            ? isLowQuality
              ? { backgroundColor: ledColor }
              : {
                  backgroundColor: ledColor,
                  boxShadow: `0 0 12px ${ledColor}b3, inset 0 1px 3px rgba(255,255,255,0.65)`,
                }
            : undefined
        }
        className={`relative w-full h-full rounded-md sm:rounded-lg ${
          isLowQuality ? '' : 'transition-colors duration-100'
        } ${
          isLit
            ? isLowQuality
              ? 'border border-white/50'
              : 'scale-[1.02] border border-white/50'
            : isLowQuality
            ? 'bg-slate-800/85 border border-slate-700/60'
            : 'bg-slate-800/85 border border-slate-700/60 shadow-inner'
        }`}
      >
        {/* Subtle glossy LED lens highlight when lit (omitted in Lite mode) */}
        {isLit && !isLowQuality && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-0.5 left-0.5 right-0.5 h-1/3 rounded-t-sm bg-white/30"
          />
        )}

        {/* High-Contrast Directional LED Cursor Reticle (Visible when CURSOR_STEP / CURSOR_TURN runs) */}
        {isCursorHere && (
          <div
            data-testid="beat-cursor-reticle"
            data-cursor-x={col + 1}
            data-cursor-y={row + 1}
            data-cursor-dir={cursorDir}
            role="img"
            aria-label={`LED Cursor at column ${col + 1}, row ${row + 1}, facing ${cursorDir.toLowerCase()}`}
            className={`pointer-events-none absolute -inset-0.5 rounded-md sm:rounded-lg ring-2 ring-white flex items-center justify-center z-10 ${
              isLowQuality
                ? ''
                : 'shadow-[0_0_0_1.5px_rgba(2,6,23,0.92),0_0_10px_rgba(255,255,255,0.8)]'
            }`}
          >
            <svg
              viewBox="0 0 16 16"
              aria-hidden="true"
              className="w-3.5 h-3.5 sm:w-4 sm:h-4 overflow-visible"
              style={{
                transform: `rotate(${getCursorArrowRotation(cursorDir)}deg)`,
              }}
            >
              <polygon
                points="8,1.8 13.4,12.8 8,10.1 2.6,12.8"
                fill="#ffffff"
                stroke="#020617"
                strokeWidth="2.2"
                strokeLinejoin="round"
                style={{ paintOrder: 'stroke fill' }}
              />
            </svg>
          </div>
        )}
      </div>
    );
  }
);

export const BeatCanvas: React.FC<BeatCanvasProps> = ({ state: propState }) => {
  const {
    storeBeatState,
    setBeatMuted,
    toggleBeatMuted,
    unlockBeatAudio,
    isLowQuality,
    isLoopPlayback,
    toggleLoopPlayback,
  } = useAppStoreSelector((s) => ({
    storeBeatState: s.beatState,
    setBeatMuted: s.setBeatMuted,
    toggleBeatMuted: s.toggleBeatMuted,
    unlockBeatAudio: s.unlockBeatAudio,
    isLowQuality: isLowQualityActive(s),
    isLoopPlayback: s.isLoopPlayback,
    toggleLoopPlayback: s.toggleLoopPlayback,
  }));

  const state = propState || storeBeatState;
  const isMuted = Boolean(state.isMuted);
  const activeColor = state.activeColor || '#06b6d4';
  const swatchMeta = BEAT_LED_PALETTE.find(
    (s) => s.hex.toLowerCase() === activeColor.toLowerCase()
  );

  const synthNeedsUnlock = useSyncExternalStore(
    beatSynth.subscribe,
    () => beatSynth.needsSoundUnlock(),
    () => false
  );

  const activeCue: BeatCueKind | 'NONE' = state.lastTriggeredEvent?.kind || 'NONE';
  const cueVisual = getCueVisualStyle(activeCue);
  const activeBeatSlot = state.beatIndex > 0 ? ((state.beatIndex - 1) % 4) + 1 : 0;

  const handleTapForSound = () => {
    setBeatMuted(false);
    unlockBeatAudio();
  };

  const handleToggleMute = () => {
    if (isMuted) {
      unlockBeatAudio();
    }
    toggleBeatMuted();
  };

  return (
    <div
      data-testid="beat-canvas"
      data-quality={isLowQuality ? 'low' : 'high'}
      className="relative flex flex-col w-full h-full bg-slate-950 select-none overflow-hidden"
    >
      {/* Top Status & Accessibility Bar: Beat-Ring Cue Indicator + Active LED Color + Mute / Tap-for-Sound */}
      <div className="flex items-center justify-between gap-2 px-3 pt-2.5 pb-1 z-10 flex-shrink-0">
        {/* Visual Percussion & 4-Beat Rhythm Indicator (Color-Blind & Deaf Inclusive) */}
        <div
          data-testid="beat-cue-indicator"
          data-cue={activeCue}
          aria-label={`Beat ${state.beatIndex}: ${cueVisual.label}`}
          className={`flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs font-extrabold transition-colors shadow-sm ${cueVisual.pillClass}`}
        >
          <span className="flex items-center gap-1" title={cueVisual.label}>
            {cueVisual.icon}
            <span aria-hidden="true" className="text-[11px] leading-none">
              {cueVisual.symbol}
            </span>
          </span>

          {/* 4-Beat Visual Metronome Dots */}
          <div className="flex items-center gap-1 px-1 border-l border-current/25" aria-hidden="true">
            {[1, 2, 3, 4].map((slot) => {
              const isCurrentSlot = activeBeatSlot === slot;
              return (
                <span
                  key={slot}
                  className={`inline-block rounded-full transition-transform duration-150 ${
                    isCurrentSlot
                      ? 'w-2.5 h-2.5 bg-current scale-125 shadow-sm'
                      : 'w-1.5 h-1.5 bg-current/30'
                  }`}
                />
              );
            })}
          </div>

          <span data-testid="beat-step-counter" className="font-mono text-[11px] opacity-90">
            #{state.beatIndex}
          </span>
        </div>

        {/* Right Controls: Active LED Color Swatch + Autoplay Unlock Pill + Mute Toggle */}
        <div className="flex items-center gap-1.5">
          <div
            data-testid="tool-beat-active-color"
            title={`Active LED Color: ${swatchMeta?.label || activeColor}`}
            aria-label={`Active LED Color: ${swatchMeta?.label || activeColor}`}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-900 border border-slate-700"
          >
            <span
              style={{
                backgroundColor: activeColor,
                ...(isLowQuality ? {} : { boxShadow: `0 0 8px ${activeColor}99` }),
              }}
              className="block w-5 h-5 rounded-md border border-white/60"
            />
          </div>

          {synthNeedsUnlock && !isMuted && (
            <button
              type="button"
              data-testid="beat-tap-for-sound-pill"
              onClick={handleTapForSound}
              aria-label="Audio paused by browser — Tap for Sound"
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/70 text-[11px] font-extrabold shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <VolumeX className="w-3.5 h-3.5 text-amber-300" />
              <span className="hidden sm:inline">Tap for Sound</span>
            </button>
          )}

          <button
            type="button"
            data-testid="tool-beat-mute"
            aria-pressed={isMuted}
            aria-label={isMuted ? 'Unmute Beat Audio' : 'Mute Beat Audio'}
            title={isMuted ? 'Sound Muted (Tap to Unmute)' : 'Sound On (Tap to Mute)'}
            onClick={handleToggleMute}
            className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-all active:scale-95 cursor-pointer ${
              isMuted
                ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-400/80 shadow-md'
                : 'bg-slate-900/90 hover:bg-slate-800 text-emerald-300 border-slate-700'
            }`}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            data-testid="tool-loop-playback"
            aria-pressed={isLoopPlayback}
            aria-label={isLoopPlayback ? 'Loop Playback: On' : 'Loop Playback: Off'}
            title={isLoopPlayback ? 'Loop Playback: On' : 'Loop Playback: Off'}
            onClick={toggleLoopPlayback}
            className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-all active:scale-95 cursor-pointer ${
              isLoopPlayback
                ? 'bg-amber-500/25 border-amber-400 text-amber-200 ring-2 ring-amber-400/30'
                : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            <InfinityIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Centered 8x8 RGB LED Matrix Chassis + Synchronized Beat-Ring Pulse */}
      <div className="flex-1 min-h-0 w-full flex items-center justify-center p-2.5 sm:p-5">
        <div
          data-testid="beat-ring"
          data-beat-index={state.beatIndex}
          data-cue={activeCue}
          style={
            isLowQuality
              ? undefined
              : {
                  boxShadow:
                    state.beatIndex > 0
                      ? `0 0 28px ${cueVisual.ringGlowColor}, inset 0 1px 1px rgba(255,255,255,0.08)`
                      : 'inset 0 1px 1px rgba(255,255,255,0.06)',
                }
          }
          className={`relative aspect-square max-h-full max-w-[min(86vw,430px)] w-full p-3 sm:p-4 rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 ${
            isLowQuality ? '' : 'transition-colors duration-100'
          } flex items-center justify-center ${cueVisual.ringBorderClass}`}
        >
          {/* Persistent compositor-only Beat-Ring Ripple (omitted in Lite mode; alternating classes avoid DOM remount) */}
          {!isLowQuality && state.beatIndex > 0 && (
            <div
              data-testid="beat-ring-pulse"
              aria-hidden="true"
              className={`pointer-events-none absolute -inset-1.5 rounded-[28px] border-2 opacity-0 ${
                state.beatIndex % 2 === 0 ? 'animate-beat-ripple-a' : 'animate-beat-ripple-b'
              } ${cueVisual.ringBorderClass}`}
            />
          )}

          {/* 8x8 Rounded Silicone LED Pad Matrix */}
          <div
            data-testid="beat-led-grid"
            role="img"
            aria-label="8 by 8 RGB LED Matrix"
            className={`w-full h-full grid grid-cols-8 grid-rows-8 gap-1.5 sm:gap-2 p-2 sm:p-2.5 rounded-2xl bg-slate-950 border border-slate-800 ${
              isLowQuality ? '' : 'shadow-inner'
            }`}
          >
            {Array.from({ length: BEAT_GRID_SIZE }, (_, row) =>
              Array.from({ length: BEAT_GRID_SIZE }, (__, col) => {
                const ledColor = state.leds?.[row]?.[col] ?? null;
                const isCursorHere =
                  Boolean(state.cursor?.visible) &&
                  state.cursor.x === col + 1 &&
                  state.cursor.y === row + 1;

                return (
                  <BeatLedCell
                    key={`${col}-${row}`}
                    col={col}
                    row={row}
                    ledColor={ledColor}
                    isCursorHere={isCursorHere}
                    cursorDir={state.cursor?.dir || 'EAST'}
                    isLowQuality={isLowQuality}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
