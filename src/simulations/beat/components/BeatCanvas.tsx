import React, { useRef, useSyncExternalStore } from 'react';
import { Bell, Eraser, Gauge, Grid, Hourglass, Infinity as InfinityIcon, Music, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { Direction, ScopeType, SimulationStatus } from '../../../types';
import {
  isLowQualityActive,
  isTerminalErrorStatus,
  useAppStoreSelector,
} from '../../../store/useAppStore';
import { SimulationTopLeftHud } from '../../../components/SimulationTopLeftHud';
import { resolveActiveCurriculumActivity } from '../../../utils/curriculumStagePolicy';
import { BEAT_GRID_SIZE, BEAT_LED_PALETTE, BeatCueKind, BeatState } from '../types';
import { isBeatLedOffHex } from '../presets';
import { beatSynth } from '../beatSynth';

/**
 * Quantizes a pointer event's client coordinates over the Beat 8×8 LED matrix bounding box
 * into clamped 0-indexed `{ x: 0..width-1, y: 0..height-1 }` pad coordinates (`0..7` on `8×8`).
 */
export function quantizeBeatPointerCell(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  width: number = BEAT_GRID_SIZE,
  height: number = BEAT_GRID_SIZE
): { x: number; y: number } {
  const safeW = Math.max(1, rect.width);
  const safeH = Math.max(1, rect.height);
  const relX = (clientX - rect.left) / safeW;
  const relY = (clientY - rect.top) / safeH;
  const x = Math.max(0, Math.min(width - 1, Math.floor(relX * width)));
  const y = Math.max(0, Math.min(height - 1, Math.floor(relY * height)));
  return { x, y };
}

const BEAT_TERMINAL_GLYPHS: Partial<Record<SimulationStatus, string>> = {
  COLLISION: '💥',
  TYPE_ERROR: '🎨≠#',
  MATH_ERROR: '🧮÷0',
  STACK_OVERFLOW: '📚💥',
  STEP_LIMIT: '⏳🔁',
  DEADLOCK: '🔒💥',
};

export interface BeatCanvasProps {
  state: BeatState;
  runtimeStatus?: SimulationStatus;
  runtimeVariables?: Record<string, any> | null;
  activeBlockId?: string | null;
  activeScope?: ScopeType;
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
  isEdgeBonk: boolean;
  edgeBonkPulse: number;
  isLowQuality: boolean;
}

const BeatLedCell = React.memo<BeatLedCellProps>(
  ({ col, row, ledColor, isCursorHere, cursorDir, isEdgeBonk, edgeBonkPulse, isLowQuality }) => {
    const isLit = Boolean(ledColor) && !isBeatLedOffHex(ledColor);
    const bonkBorderStyle: React.CSSProperties | undefined =
      isCursorHere && isEdgeBonk
        ? cursorDir === 'WEST'
          ? { borderLeftColor: '#fb7185', boxShadow: 'inset 3px 0 10px rgba(251, 113, 133, 0.75)' }
          : cursorDir === 'EAST'
          ? { borderRightColor: '#fb7185', boxShadow: 'inset -3px 0 10px rgba(251, 113, 133, 0.75)' }
          : cursorDir === 'NORTH'
          ? { borderTopColor: '#fb7185', boxShadow: 'inset 0 3px 10px rgba(251, 113, 133, 0.75)' }
          : { borderBottomColor: '#fb7185', boxShadow: 'inset 0 -3px 10px rgba(251, 113, 133, 0.75)' }
        : undefined;

    return (
      <div
        data-testid={`beat-led-${col}-${row}`}
        data-coord={`${col + 1},${row + 1}`}
        data-lit={isLit ? 'true' : 'false'}
        data-color={isLit && ledColor ? ledColor : ''}
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
            data-edge-bonk={isEdgeBonk ? 'true' : 'false'}
            role="img"
            aria-label={`LED Cursor at column ${col + 1}, row ${row + 1}, facing ${cursorDir.toLowerCase()}`}
            className={`pointer-events-none absolute -inset-0.5 rounded-md sm:rounded-lg ring-2 ${
              isEdgeBonk ? 'ring-amber-300' : 'ring-white'
            } flex items-center justify-center z-10 ${
              isLowQuality
                ? ''
                : isEdgeBonk
                ? 'shadow-[0_0_0_1.5px_rgba(2,6,23,0.92),0_0_14px_rgba(251,191,36,0.9)]'
                : 'shadow-[0_0_0_1.5px_rgba(2,6,23,0.92),0_0_10px_rgba(255,255,255,0.8)]'
            }`}
          >
            {isEdgeBonk && (
              <span
                key={`bonk-${edgeBonkPulse}`}
                data-testid="beat-edge-bonk-shimmer"
                aria-hidden="true"
                style={bonkBorderStyle}
                className={`pointer-events-none absolute inset-0 rounded-md sm:rounded-lg border-2 border-amber-300/80 ${
                  isLowQuality ? '' : 'animate-pulse'
                }`}
              />
            )}
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

export const BeatCanvas: React.FC<BeatCanvasProps> = ({
  state: propState,
  runtimeStatus: propRuntimeStatus,
  runtimeVariables: propRuntimeVariables,
}) => {
  const {
    storeBeatState,
    setBeatMuted,
    toggleBeatMuted,
    unlockBeatAudio,
    isLowQuality,
    isLoopPlayback,
    toggleLoopPlayback,
    randomSeed,
    rerollRandomSeed,
    appMode,
    activeActivityId,
    activeActivityVersion,
    storeRuntimeStatus,
    storeRuntimeVariables,
    setPointerState,
    enqueueInteractiveEvent,
    hasMultiVariant,
  } = useAppStoreSelector((s) => ({
    storeBeatState: s.beatState,
    setBeatMuted: s.setBeatMuted,
    toggleBeatMuted: s.toggleBeatMuted,
    unlockBeatAudio: s.unlockBeatAudio,
    isLowQuality: isLowQualityActive(s),
    isLoopPlayback: s.isLoopPlayback,
    toggleLoopPlayback: s.toggleLoopPlayback,
    randomSeed: s.randomSeed,
    rerollRandomSeed: s.rerollRandomSeed,
    appMode: s.appMode,
    activeActivityId: s.activeActivityId,
    activeActivityVersion: s.activeActivityVersion,
    storeRuntimeStatus: s.runtime?.status,
    storeRuntimeVariables: s.runtime?.variables,
    setPointerState: s.setPointerState,
    enqueueInteractiveEvent: s.enqueueInteractiveEvent,
    hasMultiVariant: s.variantRuns.length > 1,
  }));

  const state = propState || storeBeatState;
  const candidateRuntimeStatus = propRuntimeStatus ?? storeRuntimeStatus;
  const effectiveStatus: SimulationStatus = isTerminalErrorStatus(state.status)
    ? state.status
    : isTerminalErrorStatus(candidateRuntimeStatus)
    ? (candidateRuntimeStatus as SimulationStatus)
    : state.status;
  const gridRef = useRef<HTMLDivElement>(null);
  const pointerDownRef = useRef(false);
  const matrixWidth =
    typeof state.width === 'number' && state.width > 0 ? Math.round(state.width) : BEAT_GRID_SIZE;
  const matrixHeight =
    typeof state.height === 'number' && state.height > 0 ? Math.round(state.height) : BEAT_GRID_SIZE;

  const resolveGridPointerCell = (e: React.PointerEvent<HTMLDivElement>) => {
    const targetEl = (e.target as HTMLElement | null)?.closest?.('[data-coord]') as HTMLElement | null;
    if (targetEl) {
      const coordAttr = targetEl.getAttribute('data-coord');
      if (coordAttr) {
        const parts = coordAttr.split(',');
        const col1 = Number(parts[0]);
        const row1 = Number(parts[1]);
        if (Number.isFinite(col1) && Number.isFinite(row1)) {
          return {
            x: Math.max(0, Math.min(matrixWidth - 1, Math.trunc(col1) - 1)),
            y: Math.max(0, Math.min(matrixHeight - 1, Math.trunc(row1) - 1)),
          };
        }
      }
    }
    const rect = gridRef.current?.getBoundingClientRect() ?? {
      left: 0,
      top: 0,
      width: 320,
      height: 320,
    };
    return quantizeBeatPointerCell(e.clientX, e.clientY, rect, matrixWidth, matrixHeight);
  };

  const handleGridPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    unlockBeatAudio();
    const cell = resolveGridPointerCell(e);
    pointerDownRef.current = true;
    setPointerState({ x: cell.x, y: cell.y, isDown: true });
    enqueueInteractiveEvent('ON_TAP');
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handleGridPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const cell = resolveGridPointerCell(e);
    setPointerState({ x: cell.x, y: cell.y, isDown: pointerDownRef.current });
  };

  const handleGridPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const cell = resolveGridPointerCell(e);
    pointerDownRef.current = false;
    setPointerState({ x: cell.x, y: cell.y, isDown: false });
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };
  const isMuted = Boolean(state.isMuted);
  const activeColor = state.activeColor || '#06b6d4';
  const isActiveColorOff = isBeatLedOffHex(activeColor);
  const swatchMeta = BEAT_LED_PALETTE.find(
    (s) => s.hex.toLowerCase() === activeColor.toLowerCase()
  );
  const activeActivity = resolveActiveCurriculumActivity(
    appMode,
    activeActivityId,
    activeActivityVersion
  );
  const showActiveColorTool =
    appMode === 'sandbox' ||
    Boolean(activeActivity?.palette?.allowedSimBlocks?.includes('SET_LED_COLOR'));
  const resolvedVariables =
    propRuntimeVariables !== undefined ? propRuntimeVariables : storeRuntimeVariables;

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
      <div
        data-testid="beat-canvas-header"
        className="flex items-center justify-between gap-2 px-3 pt-2.5 pb-1 z-10 flex-shrink-0"
      >
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
            {`🎵 #${state.beatIndex}`}
          </span>
        </div>

        {/* Right Controls: Active LED Color Swatch + Autoplay Unlock Pill + Mute Toggle + Loop + Random Seed */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {showActiveColorTool && (
            <div
              data-testid="tool-beat-active-color"
              data-led-off={isActiveColorOff ? 'true' : 'false'}
              title={`Active LED Color: ${swatchMeta?.label || activeColor}${
                isActiveColorOff ? ' (Off / Erase)' : ''
              }`}
              aria-label={`Active LED Color: ${swatchMeta?.label || activeColor}${
                isActiveColorOff ? ' (Off / Erase)' : ''
              }`}
              className="flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-lg bg-slate-900 border border-slate-700"
            >
              {isActiveColorOff ? (
                <span
                  className={`relative flex items-center justify-center w-5 h-5 rounded-md bg-slate-800/85 border border-slate-600/80 ${
                    isLowQuality ? '' : 'shadow-inner'
                  }`}
                >
                  <svg
                    viewBox="0 0 16 16"
                    aria-hidden="true"
                    data-testid="beat-active-color-erase-cue"
                    className="w-3.5 h-3.5 text-slate-300"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                  >
                    <circle cx="8" cy="8" r="5.5" />
                    <line x1="4.1" y1="11.9" x2="11.9" y2="4.1" />
                  </svg>
                </span>
              ) : (
                <span
                  style={{
                    backgroundColor: activeColor,
                    ...(isLowQuality ? {} : { boxShadow: `0 0 8px ${activeColor}99` }),
                  }}
                  className="block w-5 h-5 rounded-md border border-white/60"
                />
              )}
            </div>
          )}

          {synthNeedsUnlock && !isMuted && (
            <button
              type="button"
              data-testid="beat-tap-for-sound-pill"
              onClick={handleTapForSound}
              aria-label="Audio paused by browser — Tap for Sound"
              className="flex items-center gap-1 px-2.5 py-1 min-h-9 sm:min-h-11 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/70 text-[11px] font-extrabold shadow-md transition-all active:scale-95 cursor-pointer"
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
            className={`flex items-center justify-center min-h-9 min-w-9 sm:min-h-11 sm:min-w-11 w-9 h-9 sm:w-11 sm:h-11 rounded-lg border transition-all active:scale-95 cursor-pointer ${
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
            className={`flex items-center justify-center min-h-9 min-w-9 sm:min-h-11 sm:min-w-11 w-9 h-9 sm:w-11 sm:h-11 rounded-lg border transition-all active:scale-95 cursor-pointer ${
              isLoopPlayback
                ? 'bg-amber-500/25 border-amber-400 text-amber-200 ring-2 ring-amber-400/30'
                : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            <InfinityIcon className="w-4 h-4" />
          </button>

          <button
            type="button"
            data-testid="tool-random-seed"
            data-seed={randomSeed}
            onClick={() => {
              rerollRandomSeed();
            }}
            title="New Random Seed"
            aria-label="New random seed"
            className="flex items-center justify-center min-h-9 min-w-9 sm:min-h-11 sm:min-w-11 w-9 h-9 sm:w-11 sm:h-11 rounded-lg border bg-slate-900/90 hover:bg-slate-800 border-slate-700 text-slate-200 hover:text-white transition-all active:scale-95 cursor-pointer"
          >
            <span className="text-sm sm:text-base leading-none select-none" aria-hidden="true">
              🎲
            </span>
          </button>
        </div>
      </div>

      {/* Main Centered 8x8 RGB LED Matrix Chassis + Synchronized Beat-Ring Pulse */}
      <div
        data-testid="beat-matrix-stage"
        className="relative flex-1 min-h-0 w-full flex items-center justify-center p-2.5 sm:p-5"
      >
        <SimulationTopLeftHud
          variables={resolvedVariables ?? {}}
          status={effectiveStatus}
          positionClassName="top-3 left-3"
        />
        {BEAT_TERMINAL_GLYPHS[effectiveStatus] && (
          <div
            data-testid="beat-terminal-status"
            data-terminal-status={effectiveStatus}
            className={`absolute ${hasMultiVariant ? 'top-12' : 'top-3'} left-1/2 -translate-x-1/2 z-20 px-5 py-1.5 bg-rose-600/95 text-white rounded-full font-black shadow-lg pointer-events-none`}
          >
            <span className="text-base">{BEAT_TERMINAL_GLYPHS[effectiveStatus]}</span>
          </div>
        )}
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
            ref={gridRef}
            data-testid="beat-led-grid"
            data-edge-bonk={state.edgeBonk ? 'true' : 'false'}
            role="img"
            aria-label="8 by 8 RGB LED Matrix"
            onPointerDown={handleGridPointerDown}
            onPointerMove={handleGridPointerMove}
            onPointerUp={handleGridPointerUp}
            onPointerCancel={handleGridPointerUp}
            className={`w-full h-full grid grid-cols-8 grid-rows-8 gap-1.5 sm:gap-2 p-2 sm:p-2.5 rounded-2xl bg-slate-950 border touch-none ${
              state.edgeBonk ? 'border-amber-400/80' : 'border-slate-800'
            } ${isLowQuality ? '' : 'shadow-inner'}`}
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
                    isEdgeBonk={Boolean(state.edgeBonk)}
                    edgeBonkPulse={state.edgeBonkPulse ?? 0}
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
