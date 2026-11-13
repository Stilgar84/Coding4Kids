import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ArrowRight, Check, ChevronDown, ChevronUp, Copy, Play, Sparkles, Square } from 'lucide-react';
import { InterpreterRuntimeState, ScopeType, SimulationSpeed, WorkspaceState } from '../types';
import {
  CreativeVariationCard,
  CurriculumSimId,
  getActivityAtVersion,
  getActivityLatest,
} from '../data/curriculum';
import { TurtleState } from '../simulations/turtle/types';
import { createInitialTurtleState } from '../simulations/turtle/turtleEnvironment';
import {
  BEAT_GRID_SIZE,
  BeatCueKind,
  BeatState,
} from '../simulations/beat/types';
import { countLitLeds } from '../simulations/beat/presets';
import {
  beatSimulationEnvironment,
  createInitialBeatState,
} from '../simulations/beat/beatEnvironment';
import { beatSynth } from '../simulations/beat/beatSynth';
import {
  createInitialInterpreterState,
  tickInterpreter,
  validateLoopStructure,
} from '../engine/interpreter';
import {
  runHeadlessSimulation,
  MAX_INSTANT_SIMULATION_STEPS,
} from '../engine/simulationRunner';
import {
  generateBeatMapThumbnail,
  generateTurtleMapThumbnail,
  renderBeatMapSvg,
  renderTurtleMapSvg,
} from '../services/mapThumbnailGenerator';
import { isLowQualityActive, useAppStore, useAppStoreSelector } from '../store/useAppStore';
import {
  getNextCurriculumActivity,
  isCreativeOpenLessonActivity,
} from '../utils/curriculumStagePolicy';

export const BEAT_VARIATION_PREVIEW_TICK_MS = 320;
const MAX_CONTROL_HOPS_PER_BEAT = 64;

export interface TurtleVariationPreview {
  finalState: TurtleState;
  svgMarkup: string;
  thumbnailUrl: string;
}

export interface BeatVariationPreview {
  frames: BeatState[];
  finalState: BeatState;
  representativeState: BeatState;
  svgMarkup: string;
  thumbnailUrl: string;
  totalBeats: number;
}

export interface BeatVariationPreviewSnapshot {
  activeCardId: string | null;
  activeCardTitle: string | null;
  activityId: string | null;
  isPlaying: boolean;
  currentState: BeatState | null;
  tickCount: number;
  totalBeats: number;
  liveAnnouncement: string;
}

const IDLE_PREVIEW_SNAPSHOT: BeatVariationPreviewSnapshot = {
  activeCardId: null,
  activeCardTitle: null,
  activityId: null,
  isPlaying: false,
  currentState: null,
  tickCount: 0,
  totalBeats: 0,
  liveAnnouncement: '',
};

function hasValidNonEmptyWorkspace(workspace: WorkspaceState): boolean {
  let totalBlocks = 0;
  for (const scope of ['MAIN', 'F1', 'F2', 'F3'] as ScopeType[]) {
    const blocks = workspace[scope] || [];
    totalBlocks += blocks.length;
    if (blocks.length > 0 && validateLoopStructure(blocks).hasError) {
      return false;
    }
  }
  return totalBlocks > 0;
}

/**
 * Headlessly executes a Turtle LOGO variation workspace and renders its SVG markup and data URL thumbnail.
 */
export function renderTurtleVariationPreview(workspace: WorkspaceState): TurtleVariationPreview {
  const initialTurtle = createInitialTurtleState();
  const simResult = runHeadlessSimulation(
    workspace,
    'turtle',
    initialTurtle,
    MAX_INSTANT_SIMULATION_STEPS
  );
  const finalState = simResult.finalState as TurtleState;
  const svgMarkup = renderTurtleMapSvg(finalState);
  const thumbnailUrl = generateTurtleMapThumbnail(finalState);
  return { finalState, svgMarkup, thumbnailUrl };
}

/**
 * Headlessly simulates a Beat & Light variation workspace to extract its beat-by-beat LED frames
 * and a static representative 8x8 LED thumbnail frame for idle display.
 */
export function renderBeatVariationPreview(workspace: WorkspaceState): BeatVariationPreview {
  const initialBeat = createInitialBeatState(true);
  if (!hasValidNonEmptyWorkspace(workspace)) {
    const svgMarkup = renderBeatMapSvg(initialBeat);
    const thumbnailUrl = generateBeatMapThumbnail(initialBeat);
    return {
      frames: [],
      finalState: initialBeat,
      representativeState: initialBeat,
      svgMarkup,
      thumbnailUrl,
      totalBeats: 0,
    };
  }

  let runtime = createInitialInterpreterState();
  let state = initialBeat;
  const frames: BeatState[] = [];
  let steps = 0;

  while (steps < MAX_INSTANT_SIMULATION_STEPS) {
    const prevBeatIndex = state.beatIndex;
    const res = tickInterpreter(runtime, workspace, state, beatSimulationEnvironment);
    runtime = res.nextRuntime;
    state = res.nextGrid;
    steps++;

    if (state.beatIndex !== prevBeatIndex) {
      frames.push(state);
    }

    if (res.done || runtime.status === 'PAUSED') {
      break;
    }
  }

  const finalState: BeatState = { ...state, status: 'IDLE' };
  let representativeState: BeatState = finalState;
  if (countLitLeds(finalState.leds) === 0) {
    for (let i = frames.length - 1; i >= 0; i--) {
      if (countLitLeds(frames[i].leds) > 0) {
        representativeState = { ...frames[i], status: 'IDLE' };
        break;
      }
    }
  }

  const svgMarkup = renderBeatMapSvg(representativeState);
  const thumbnailUrl = generateBeatMapThumbnail(representativeState);

  return {
    frames,
    finalState,
    representativeState,
    svgMarkup,
    thumbnailUrl,
    totalBeats: frames.length,
  };
}

export interface BeatVariationStartOptions {
  activityId?: string;
  tickMs?: number;
  getIsMuted?: () => boolean;
}

/**
 * Isolated timer & interpreter controller for in-card Beat & Light 8x8 previews.
 * Drives live LED matrix frames and gesture-safe `beatSynth` events without mutating
 * the learner's main workspace, main BeatState, or Undo/Redo history.
 */
export class BeatVariationPreviewPlayer {
  private snapshot: BeatVariationPreviewSnapshot = IDLE_PREVIEW_SNAPSHOT;
  private listeners = new Set<() => void>();
  private timerId: ReturnType<typeof setInterval> | null = null;
  private runtime: InterpreterRuntimeState | null = null;
  private beatState: BeatState | null = null;
  private workspace: WorkspaceState | null = null;
  private card: CreativeVariationCard | null = null;
  private activityId: string | null = null;
  private totalBeats: number = 0;
  private tickMs: number = BEAT_VARIATION_PREVIEW_TICK_MS;
  private getIsMuted: () => boolean = () =>
    Boolean(useAppStore.getState().beatState.isMuted || beatSynth.isMuted());

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        // Ignore subscriber errors
      }
    }
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): BeatVariationPreviewSnapshot => {
    return this.snapshot;
  };

  private clearActiveRun(): void {
    const wasRunning =
      this.snapshot.isPlaying || this.timerId !== null || this.runtime !== null;
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (wasRunning) {
      try {
        beatSynth.stopSource('preview');
      } catch {
        // Never block cleanup
      }
    }
    this.runtime = null;
    this.beatState = null;
    this.workspace = null;
    this.card = null;
    this.activityId = null;
    this.totalBeats = 0;
  }

  private stepNextBeat(isInitialTick: boolean): void {
    if (!this.runtime || !this.beatState || !this.workspace || !this.card) {
      this.stop('silent');
      return;
    }

    let runtime: InterpreterRuntimeState = this.runtime;
    let beatState: BeatState = this.beatState;
    const workspace: WorkspaceState = this.workspace;
    const card: CreativeVariationCard = this.card;

    const startBeatIndex = beatState.beatIndex;
    let hops = 0;
    let done = false;

    while (hops < MAX_CONTROL_HOPS_PER_BEAT) {
      const res = tickInterpreter<BeatState>(
        runtime,
        workspace,
        beatState,
        beatSimulationEnvironment
      );
      runtime = res.nextRuntime;
      beatState = res.nextGrid;
      hops++;

      if (beatState.beatIndex !== startBeatIndex) {
        break;
      }

      if (res.done || runtime.status === 'PAUSED') {
        done = true;
        break;
      }
    }

    this.runtime = runtime;
    this.beatState = beatState;

    if (beatState.beatIndex !== startBeatIndex && !done) {
      const mutedNow = Boolean(this.getIsMuted());
      const frameState: BeatState = {
        ...beatState,
        isMuted: mutedNow,
      };
      this.beatState = frameState;

      if (!mutedNow) {
        try {
          beatSynth.withSource('preview', () => {
            beatSynth.playEvent(frameState.lastTriggeredEvent, 400 as SimulationSpeed);
          });
        } catch {
          // Never block preview frames if Web Audio fails or is suspended
        }
      }

      const cardTitle = card.title;
      this.snapshot = {
        activeCardId: card.id,
        activeCardTitle: cardTitle,
        activityId: this.activityId,
        isPlaying: true,
        currentState: frameState,
        tickCount: frameState.beatIndex,
        totalBeats: Math.max(this.totalBeats, frameState.beatIndex),
        liveAnnouncement: isInitialTick
          ? `Previewing variation: ${cardTitle}${mutedNow ? ' (muted)' : ''}.`
          : this.snapshot.liveAnnouncement,
      };
      this.notify();
      return;
    }

    // All beats have completed their display window
    const finishedTitle = card.title;
    this.clearActiveRun();
    this.snapshot = {
      ...IDLE_PREVIEW_SNAPSHOT,
      liveAnnouncement: `Finished preview for ${finishedTitle}.`,
    };
    this.notify();
  }

  start(card: CreativeVariationCard, options?: BeatVariationStartOptions): boolean {
    this.clearActiveRun();

    if (!hasValidNonEmptyWorkspace(card.workspace)) {
      if (this.snapshot !== IDLE_PREVIEW_SNAPSHOT) {
        this.snapshot = IDLE_PREVIEW_SNAPSHOT;
        this.notify();
      }
      return false;
    }

    const previewMeta = renderBeatVariationPreview(card.workspace);
    if (previewMeta.totalBeats === 0) {
      if (this.snapshot !== IDLE_PREVIEW_SNAPSHOT) {
        this.snapshot = IDLE_PREVIEW_SNAPSHOT;
        this.notify();
      }
      return false;
    }

    this.getIsMuted =
      options?.getIsMuted ??
      (() => Boolean(useAppStore.getState().beatState.isMuted || beatSynth.isMuted()));
    const mutedNow = Boolean(this.getIsMuted());

    try {
      beatSynth.setMuted(mutedNow);
      if (!mutedNow) {
        beatSynth.unlockFromGesture();
      }
    } catch {
      // Never block preview ticks when AudioContext is unavailable or blocked
    }

    this.runtime = createInitialInterpreterState();
    this.beatState = createInitialBeatState(mutedNow);
    this.workspace = card.workspace;
    this.card = card;
    this.activityId = options?.activityId ?? null;
    this.totalBeats = previewMeta.totalBeats;
    this.tickMs = Math.max(20, options?.tickMs ?? BEAT_VARIATION_PREVIEW_TICK_MS);

    // Run Beat #1 synchronously on the user's click/key gesture
    this.stepNextBeat(true);

    if (this.snapshot.isPlaying) {
      this.timerId = setInterval(() => {
        this.stepNextBeat(false);
      }, this.tickMs);
    }

    return this.snapshot.isPlaying;
  }

  stop(reason: 'manual' | 'silent' = 'silent'): void {
    const wasPlaying = this.snapshot.isPlaying;
    const prevTitle = this.snapshot.activeCardTitle;
    this.clearActiveRun();

    const nextAnnouncement =
      reason === 'manual' && wasPlaying && prevTitle
        ? `Stopped preview for ${prevTitle}.`
        : '';

    if (
      !wasPlaying &&
      this.snapshot.activeCardId === null &&
      this.snapshot.liveAnnouncement === nextAnnouncement
    ) {
      return;
    }

    this.snapshot = {
      ...IDLE_PREVIEW_SNAPSHOT,
      liveAnnouncement: nextAnnouncement,
    };
    this.notify();
  }

  toggle(
    card: CreativeVariationCard,
    options?: BeatVariationStartOptions
  ): 'playing' | 'stopped' {
    if (this.snapshot.isPlaying && this.snapshot.activeCardId === card.id) {
      this.stop('manual');
      return 'stopped';
    }
    const started = this.start(card, options);
    return started ? 'playing' : 'stopped';
  }

  resetForTests(): void {
    this.clearActiveRun();
    this.snapshot = IDLE_PREVIEW_SNAPSHOT;
    this.notify();
  }
}

export const beatVariationPreviewPlayer = new BeatVariationPreviewPlayer();

/**
 * Keyboard activation helper for `Enter` and `Space` on interactive card controls.
 * Calls `preventDefault()` so native `<button>` elements never double-fire a synthesized click
 * and ignores auto-repeated keydown events while held.
 */
export function handleButtonKeyboardActivation(
  event: { key: string; repeat?: boolean; preventDefault: () => void },
  action: () => void
): boolean {
  if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
    event.preventDefault();
    if (!event.repeat) {
      action();
    }
    return true;
  }
  return false;
}

function countWorkspaceBlocks(workspace: WorkspaceState): number {
  return (['MAIN', 'F1', 'F2', 'F3'] as ScopeType[]).reduce(
    (sum, scope) => sum + (workspace[scope]?.length ?? 0),
    0
  );
}

interface MiniCueRingStyle {
  borderClass: string;
  glowColor: string;
}

function getMiniCueRingStyle(cue: BeatCueKind | 'NONE'): MiniCueRingStyle {
  switch (cue) {
    case 'DRUM_KICK':
      return { borderClass: 'border-rose-400 border-solid', glowColor: 'rgba(244, 63, 94, 0.5)' };
    case 'DRUM_SNARE':
      return {
        borderClass: 'border-orange-400 border-dashed',
        glowColor: 'rgba(251, 146, 60, 0.5)',
      };
    case 'DRUM_CLAP':
      return {
        borderClass: 'border-fuchsia-400 border-double',
        glowColor: 'rgba(232, 121, 249, 0.5)',
      };
    case 'PLAY_CHIME':
      return {
        borderClass: 'border-amber-300 border-solid',
        glowColor: 'rgba(251, 191, 36, 0.5)',
      };
    case 'PLAY_NOTE':
      return {
        borderClass: 'border-violet-400 border-solid',
        glowColor: 'rgba(167, 139, 250, 0.45)',
      };
    case 'STAMP':
      return { borderClass: 'border-cyan-400 border-solid', glowColor: 'rgba(34, 211, 238, 0.45)' };
    case 'WAIT_BEAT':
      return {
        borderClass: 'border-sky-400/80 border-dashed',
        glowColor: 'rgba(56, 189, 248, 0.3)',
      };
    case 'CLEAR_LEDS':
      return {
        borderClass: 'border-slate-500 border-solid',
        glowColor: 'rgba(100, 116, 139, 0.25)',
      };
    case 'LED_CHANGE':
      return {
        borderClass: 'border-emerald-400 border-solid',
        glowColor: 'rgba(52, 211, 153, 0.45)',
      };
    default:
      return {
        borderClass: 'border-fuchsia-400/80 border-solid',
        glowColor: 'rgba(232, 121, 249, 0.35)',
      };
  }
}

interface VariationCardPreviewProps {
  simId: CurriculumSimId;
  card: CreativeVariationCard;
  liveBeatState?: BeatState | null;
  isPreviewPlaying?: boolean;
  isLowQuality?: boolean;
  onToggleBeatPreview?: () => void;
}

const VariationCardPreview: React.FC<VariationCardPreviewProps> = React.memo(({
  simId,
  card,
  liveBeatState,
  isPreviewPlaying = false,
  isLowQuality = false,
  onToggleBeatPreview,
}) => {
  const turtlePreview = useMemo(() => {
    if (simId !== 'turtle') return null;
    return renderTurtleVariationPreview(card.workspace);
  }, [simId, card.workspace]);

  const beatPreview = useMemo(() => {
    if (simId !== 'beat') return null;
    return renderBeatVariationPreview(card.workspace);
  }, [simId, card.workspace]);

  if (simId === 'turtle' && turtlePreview) {
    return (
      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-white border border-slate-300 overflow-hidden shrink-0 flex items-center justify-center shadow-inner">
        <img
          src={turtlePreview.thumbnailUrl}
          alt={`${card.title} drawing preview`}
          data-testid={`variation-thumbnail-${card.id}`}
          className="w-full h-full object-contain p-0.5 select-none pointer-events-none"
          draggable={false}
        />
      </div>
    );
  }

  if (simId === 'beat' && beatPreview) {
    const displayState =
      isPreviewPlaying && liveBeatState ? liveBeatState : beatPreview.representativeState;
    const activeCue: BeatCueKind | 'NONE' = isPreviewPlaying
      ? displayState.lastTriggeredEvent?.kind || 'NONE'
      : 'NONE';
    const ringStyle = getMiniCueRingStyle(activeCue);

    return (
      <div
        data-testid={`variation-beat-preview-${card.id}`}
        data-preview-playing={isPreviewPlaying ? 'true' : 'false'}
        data-beat-index={displayState.beatIndex}
        data-cue={activeCue}
        onClick={onToggleBeatPreview}
        aria-hidden="true"
        style={
          isPreviewPlaying && !isLowQuality
            ? {
                boxShadow: `0 0 14px ${ringStyle.glowColor}, inset 0 1px 1px rgba(255,255,255,0.08)`,
              }
            : undefined
        }
        className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-slate-950 p-1.5 shrink-0 flex items-center justify-center select-none cursor-pointer ${
          isLowQuality ? '' : 'transition-colors duration-100'
        } ${
          isPreviewPlaying
            ? `border-2 ${ringStyle.borderClass}`
            : 'border border-slate-700 hover:border-fuchsia-400/70 shadow-inner'
        }`}
      >
        {!isLowQuality && isPreviewPlaying && displayState.beatIndex > 0 && (
          <span
            data-testid={`variation-beat-ring-pulse-${card.id}`}
            aria-hidden="true"
            className={`pointer-events-none absolute -inset-1 rounded-xl border-2 opacity-0 ${
              displayState.beatIndex % 2 === 0 ? 'animate-beat-ripple-a' : 'animate-beat-ripple-b'
            } ${ringStyle.borderClass}`}
          />
        )}

        <div
          data-testid={`variation-beat-grid-${card.id}`}
          className="w-full h-full grid grid-cols-8 grid-rows-8 gap-[1.5px]"
        >
          {Array.from({ length: BEAT_GRID_SIZE }, (_, row) =>
            Array.from({ length: BEAT_GRID_SIZE }, (__, col) => {
              const ledColor = displayState.leds?.[row]?.[col] ?? null;
              const isLit = Boolean(ledColor);
              const isCursorHere =
                Boolean(displayState.cursor?.visible) &&
                displayState.cursor.x === col + 1 &&
                displayState.cursor.y === row + 1;
              return (
                <span
                  key={`${col}-${row}`}
                  data-testid={`variation-beat-led-${card.id}-${col}-${row}`}
                  data-lit={isLit ? 'true' : 'false'}
                  data-color={ledColor || ''}
                  style={
                    isLit && ledColor
                      ? isLowQuality
                        ? { backgroundColor: ledColor }
                        : {
                            backgroundColor: ledColor,
                            boxShadow: `0 0 4px ${ledColor}b3`,
                          }
                      : undefined
                  }
                  className={`relative block w-full h-full rounded-[1.5px] ${
                    isLowQuality ? '' : 'transition-colors duration-100'
                  } ${
                    isCursorHere
                      ? 'ring-1 ring-white z-10'
                      : isLit
                      ? 'border border-white/30'
                      : 'bg-slate-800/90'
                  }`}
                >
                  {isCursorHere && (
                    <span
                      data-testid={`variation-beat-cursor-${card.id}`}
                      data-cursor-dir={displayState.cursor.dir}
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 rounded-[1.5px] ring-1 ring-slate-950/90"
                    />
                  )}
                </span>
              );
            })
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-slate-800 border border-slate-700 shrink-0 flex items-center justify-center text-2xl select-none"
      aria-hidden="true"
    >
      {card.icon || '✨'}
    </div>
  );
});

export const VariationCardsPanel: React.FC = () => {
  const {
    appMode,
    activeActivityId,
    activeActivityVersion,
    mainIsPlaying,
    completedActivities,
    loadVariationWorkspace,
    completeCreativeActivity,
    isLowQuality,
  } = useAppStoreSelector((snapshot) => ({
    appMode: snapshot.appMode,
    activeActivityId: snapshot.activeActivityId,
    activeActivityVersion: snapshot.activeActivityVersion,
    mainIsPlaying: snapshot.isPlaying,
    completedActivities: snapshot.completedActivities,
    loadVariationWorkspace: snapshot.loadVariationWorkspace,
    completeCreativeActivity: snapshot.completeCreativeActivity,
    isLowQuality: isLowQualityActive(snapshot),
  }));

  const previewSnapshot = useSyncExternalStore(
    beatVariationPreviewPlayer.subscribe,
    beatVariationPreviewPlayer.getSnapshot,
    beatVariationPreviewPlayer.getSnapshot
  );

  const [isCollapsed, setIsCollapsed] = useState(false);

  // Stop any active Beat card preview on unmount
  useEffect(() => {
    return () => {
      beatVariationPreviewPlayer.stop('silent');
    };
  }, []);

  // Stop any active Beat card preview when switching modes or activities/versions
  useEffect(() => {
    beatVariationPreviewPlayer.stop('silent');
  }, [appMode, activeActivityId, activeActivityVersion]);

  // Stop any active Beat card preview when collapsing the strip or starting main playback
  useEffect(() => {
    if (isCollapsed || mainIsPlaying) {
      beatVariationPreviewPlayer.stop('silent');
    }
  }, [isCollapsed, mainIsPlaying]);

  const activeActivity =
    appMode === 'curriculum'
      ? getActivityAtVersion(activeActivityId, activeActivityVersion) ??
        getActivityLatest(activeActivityId)
      : undefined;

  const variationList = activeActivity?.variations ?? [];
  const hasVariations = variationList.length > 0;
  const isOpenLesson = isCreativeOpenLessonActivity(activeActivity);
  if (appMode !== 'curriculum' || !activeActivity || (!hasVariations && !isOpenLesson)) {
    return null;
  }

  const nextActivity = getNextCurriculumActivity(activeActivity.id);
  const isCompleted = Boolean(completedActivities[activeActivity.id]);
  const isBeatActivity = activeActivity.simId === 'beat';

  const handleToggleCardPreview = (card: CreativeVariationCard) => {
    beatVariationPreviewPlayer.toggle(card, { activityId: activeActivity.id });
  };

  const handleLoadCard = (card: CreativeVariationCard) => {
    beatVariationPreviewPlayer.stop('silent');
    loadVariationWorkspace(card.workspace, card.title);
  };

  const handlePanelKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && previewSnapshot.isPlaying) {
      event.stopPropagation();
      beatVariationPreviewPlayer.stop('manual');
    }
  };

  return (
    <aside
      data-testid="variation-cards-panel"
      aria-label="Creative variation cards"
      onKeyDown={handlePanelKeyDown}
      className="w-full shrink-0 bg-slate-950/95 border-t border-slate-800 text-slate-100 select-none z-20"
    >
      {/* Screen-reader polite status announcements for Beat preview playback */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="variation-preview-live-status"
        className="sr-only"
      >
        {previewSnapshot.liveAnnouncement}
      </div>

      {/* Compact Header Strip */}
      <div className="flex items-center justify-between gap-2 px-3 py-1.5">
        {hasVariations ? (
          <button
            type="button"
            data-testid="btn-toggle-variation-cards"
            aria-expanded={!isCollapsed}
            aria-controls="variation-cards-list"
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="flex items-center gap-2 text-xs font-semibold text-slate-200 hover:text-sky-300 rounded-lg px-2 py-1 -ml-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
            <span>Try a Variation</span>
            <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[11px] font-mono">
              {variationList.length}
            </span>
            {isCollapsed ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            )}
          </button>
        ) : (
          <div className="flex items-center gap-1.5 text-xs font-black text-slate-200">
            <span aria-hidden="true">{activeActivity.icon}</span>
            <span>{activeActivity.id}</span>
          </div>
        )}

        <button
          type="button"
          data-testid="btn-complete-creative-activity"
          onClick={() => {
            beatVariationPreviewPlayer.stop('silent');
            completeCreativeActivity(true);
          }}
          title={
            nextActivity
              ? `Next lesson: Activity ${nextActivity.id}: ${nextActivity.title}`
              : 'Mark creative lesson complete'
          }
          aria-label={
            nextActivity
              ? `Next lesson: Activity ${nextActivity.id}: ${nextActivity.title}`
              : 'Mark creative lesson complete'
          }
          className="min-h-[36px] md:min-h-[44px] px-3.5 md:px-4 rounded-xl text-xs md:text-sm font-black border-2 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 border-emerald-200 shadow-md shadow-emerald-500/25 flex items-center gap-1.5 transition-all cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
        >
          {nextActivity ? (
            <>
              {isCompleted && (
                <Check className="w-3.5 h-3.5 stroke-[3] shrink-0" aria-hidden="true" />
              )}
              <span>Next</span>
              <span aria-hidden="true" className="text-sm leading-none">
                {nextActivity.icon}
              </span>
              <ArrowRight className="w-4 h-4 stroke-[3] shrink-0" aria-hidden="true" />
            </>
          ) : (
            <>
              <Check className="w-3.5 h-3.5 stroke-[3] shrink-0" aria-hidden="true" />
              <span>{isCompleted ? 'Lessons' : 'Done'}</span>
              <ArrowRight className="w-4 h-4 stroke-[3] shrink-0" aria-hidden="true" />
            </>
          )}
        </button>
      </div>

      {/* Collapsible Horizontal Card Strip */}
      {hasVariations && !isCollapsed && (
        <div
          id="variation-cards-list"
          data-testid="variation-cards-list"
          role="list"
          className="flex items-stretch gap-2.5 px-3 pb-2.5 pt-0.5 overflow-x-auto"
        >
          {variationList.map((card) => {
            const blockCount = countWorkspaceBlocks(card.workspace);
            const isThisCardPlaying =
              isBeatActivity &&
              previewSnapshot.isPlaying &&
              previewSnapshot.activeCardId === card.id &&
              (previewSnapshot.activityId === null ||
                previewSnapshot.activityId === activeActivity.id);

            return (
              <div
                key={card.id}
                role="listitem"
                data-testid={`variation-card-${card.id}`}
                data-preview-active={isThisCardPlaying ? 'true' : 'false'}
                className={`flex items-center gap-2.5 p-2 rounded-xl bg-slate-900/90 border shrink-0 transition-colors shadow-sm ${
                  isBeatActivity
                    ? 'min-w-[236px] sm:min-w-[252px]'
                    : 'min-w-[205px] sm:min-w-[224px]'
                } ${
                  isThisCardPlaying
                    ? 'border-fuchsia-400/80 bg-slate-900'
                    : 'border-slate-800 hover:border-sky-500/60'
                }`}
              >
                <VariationCardPreview
                  simId={activeActivity.simId}
                  card={card}
                  liveBeatState={isThisCardPlaying ? previewSnapshot.currentState : null}
                  isPreviewPlaying={isThisCardPlaying}
                  isLowQuality={isLowQuality}
                  onToggleBeatPreview={
                    isBeatActivity ? () => handleToggleCardPreview(card) : undefined
                  }
                />

                <div className="flex flex-col justify-between min-w-0 flex-1 gap-1.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 text-xs font-semibold text-slate-100 truncate">
                      {card.icon && (
                        <span aria-hidden="true" className="shrink-0">
                          {card.icon}
                        </span>
                      )}
                      <span className="truncate">{card.title}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                      <span>
                        {blockCount} {blockCount === 1 ? 'block' : 'blocks'}
                      </span>
                      {isThisCardPlaying && previewSnapshot.totalBeats > 0 && (
                        <span
                          data-testid={`variation-beat-step-${card.id}`}
                          className="text-fuchsia-300 font-bold"
                        >
                          · #{previewSnapshot.tickCount}/{previewSnapshot.totalBeats}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isBeatActivity && (
                      <button
                        type="button"
                        data-testid={`btn-preview-variation-${card.id}`}
                        data-preview-state={isThisCardPlaying ? 'playing' : 'idle'}
                        aria-pressed={isThisCardPlaying}
                        aria-label={
                          isThisCardPlaying
                            ? `Stop preview for ${card.title}`
                            : `Play preview for ${card.title}`
                        }
                        title={
                          isThisCardPlaying
                            ? `Stop preview (${card.title})`
                            : `Play preview (${card.title})`
                        }
                        onPointerDown={() => {
                          if (!useAppStore.getState().beatState.isMuted) {
                            beatSynth.unlockFromGesture();
                          }
                        }}
                        onClick={() => handleToggleCardPreview(card)}
                        onKeyDown={(e) =>
                          handleButtonKeyboardActivation(e, () => handleToggleCardPreview(card))
                        }
                        className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300 ${
                          isThisCardPlaying
                            ? 'bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950'
                            : 'bg-fuchsia-600 hover:bg-fuchsia-500 active:bg-fuchsia-700 text-white'
                        }`}
                      >
                        {isThisCardPlaying ? (
                          <Square className="w-3 h-3 fill-current shrink-0" aria-hidden="true" />
                        ) : (
                          <Play className="w-3 h-3 fill-current shrink-0" aria-hidden="true" />
                        )}
                        <span aria-hidden="true">{isThisCardPlaying ? '⏹' : '▶'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      data-testid={`btn-load-variation-${card.id}`}
                      aria-label={`Load code for ${card.title}`}
                      onClick={() => handleLoadCard(card)}
                      onKeyDown={(e) =>
                        handleButtonKeyboardActivation(e, () => handleLoadCard(card))
                      }
                      className="inline-flex flex-1 items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white text-xs font-semibold transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                    >
                      {isBeatActivity ? (
                        <Copy className="w-3 h-3 shrink-0" aria-hidden="true" />
                      ) : (
                        <Play className="w-3 h-3 fill-current shrink-0" aria-hidden="true" />
                      )}
                      <span>Load Code</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
};
