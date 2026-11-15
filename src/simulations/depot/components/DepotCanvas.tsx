import React from 'react';
import { Trophy } from 'lucide-react';
import { SimulationStatus } from '../../../types';
import { isLowQualityActive, useAppStoreSelector } from '../../../store/useAppStore';
import {
  CrateColor,
  DEPOT_CRATE_COLORS,
  DEPOT_STACK_STATIONS,
  DEPOT_STATION_BITS,
  DepotState,
} from '../types';
import {
  getEffectiveActiveStationsMask,
  normalizeCrateColor,
  stationToIndex,
} from '../depotPhysics';
import { getActivityAtVersion, getActivityLatest } from '../../../data/curriculum';

interface DepotCanvasProps {
  state: DepotState;
  runtimeStatus?: SimulationStatus;
  spotlightsOverride?: string[];
  activeBlockId?: string | null;
}

/** Lighter specular & rim palette for uniform glossy workshop rings. */
const RING_STYLES: Record<CrateColor, { top: string; mid: string; bottom: string; rim: string }> = {
  RED: { top: '#fca5a5', mid: '#ef4444', bottom: '#b91c1c', rim: '#fee2e2' },
  BLUE: { top: '#93c5fd', mid: '#3b82f6', bottom: '#1d4ed8', rim: '#dbeafe' },
  GREEN: { top: '#6ee7b7', mid: '#10b981', bottom: '#047857', rim: '#d1fae5' },
  AMBER: { top: '#fde68a', mid: '#f59e0b', bottom: '#b45309', rim: '#fef3c7' },
};

const RingToken: React.FC<{
  color: CrateColor;
  damaged?: boolean;
  isTop?: boolean;
  isDimmed?: boolean;
  isGhost?: boolean;
  isMatched?: boolean;
  compact?: boolean;
}> = ({
  color,
  damaged = false,
  isTop = false,
  isDimmed = false,
  isGhost = false,
  isMatched = false,
  compact = false,
}) => {
  const canonical = normalizeCrateColor(color);
  const meta = DEPOT_CRATE_COLORS[canonical];
  const palette = RING_STYLES[canonical];
  const sizeClass = compact
    ? 'w-11 h-5 sm:w-12 sm:h-6'
    : 'w-14 h-6 sm:w-16 sm:h-7';

  if (isGhost) {
    return (
      <div
        className={`${sizeClass} relative rounded-full border-2 border-dashed flex items-center justify-center select-none pointer-events-none opacity-30 transition-all`}
        style={{
          borderColor: palette.mid,
          backgroundColor: `${palette.mid}1c`,
        }}
        aria-label={`Target ${meta.label}`}
      >
        <span
          aria-hidden="true"
          className="w-3.5 h-2 rounded-full border border-dashed bg-white/50"
          style={{ borderColor: palette.mid }}
        />
      </div>
    );
  }

  return (
    <div
      data-damaged={damaged ? 'true' : 'false'}
      data-matched={isMatched ? 'true' : undefined}
      className={`${sizeClass} relative rounded-full border flex items-center justify-center select-none transition-all duration-200 ${
        isTop
          ? 'ring-2 ring-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.48)] scale-[1.03] z-10'
          : isDimmed
            ? 'opacity-75 saturate-[0.78] brightness-95'
            : 'shadow-sm'
      }`}
      style={{
        background: `linear-gradient(180deg, ${palette.top} 0%, ${palette.mid} 48%, ${palette.bottom} 100%)`,
        borderColor: isTop ? '#ffffff' : palette.bottom,
        boxShadow: isTop
          ? '0 3px 10px rgba(14,165,233,0.35), inset 0 2px 3px rgba(255,255,255,0.65)'
          : '0 2px 4px rgba(15,23,42,0.16), inset 0 1.5px 2px rgba(255,255,255,0.45)',
      }}
      aria-label={`${meta.label}${damaged ? ' ⚡' : ''}`}
    >
      {/* Top glossy specular arc */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-[2px] inset-x-2 h-[3px] rounded-full bg-white/60"
      />
      {/* Center peg collar hole */}
      <span
        aria-hidden="true"
        className="w-3.5 h-2 rounded-full bg-slate-900/25 border border-white/40 shadow-inner"
      />
      {damaged && (
        <span
          data-testid="crate-damaged-indicator"
          aria-label="Damaged"
          className="absolute -top-2 -left-1 text-[11px] drop-shadow-sm select-none"
        >
          ⚡
        </span>
      )}
      {isMatched && (
        <span
          aria-hidden="true"
          className="absolute -right-1.5 -top-1.5 w-4 h-4 rounded-full bg-emerald-500 text-white text-[10px] font-black flex items-center justify-center shadow ring-1 ring-white"
        >
          ✓
        </span>
      )}
    </div>
  );
};

function computeCraneLeftPercent(
  station: DepotState['workerStation'],
  showQueue: boolean
): number {
  if (!showQueue) {
    const idx = stationToIndex(station);
    return idx === 0 ? 16.667 : idx === 1 ? 50 : 83.333;
  }
  // 4 gantry zones with flex weights [1, 1, 1, 1.5] -> total = 4.5
  if (station === 'QUEUE') return (3.75 / 4.5) * 100;
  const idx = stationToIndex(station);
  return ((idx + 0.5) / 4.5) * 100;
}

function getFailureCueSymbol(reason: DepotState['lastFailureReason']): string {
  switch (reason) {
    case 'CLAW_EMPTY':
    case 'EMPTY_STACK':
      return '∅';
    default:
      return '💥';
  }
}

export const DepotCanvas: React.FC<DepotCanvasProps> = ({
  state: propState,
  runtimeStatus,
  spotlightsOverride,
}) => {
  const {
    storeDepotState,
    isLowQuality,
    hasMultiVariant,
    appMode,
    activeActivityId,
    activeActivityVersion,
    activeDemoTabIndex,
  } = useAppStoreSelector((s) => ({
    storeDepotState: s.depotState,
    isLowQuality: isLowQualityActive(s),
    hasMultiVariant: s.variantRuns.length > 1,
    appMode: s.appMode,
    activeActivityId: s.activeActivityId,
    activeActivityVersion: s.activeActivityVersion,
    activeDemoTabIndex: s.activeDemoTabIndex,
  }));

  const spotlights = React.useMemo(() => {
    if (spotlightsOverride) return spotlightsOverride;
    if (appMode !== 'curriculum') return [];
    const act =
      getActivityAtVersion(activeActivityId, activeActivityVersion) ??
      getActivityLatest(activeActivityId);
    if (!act || act.format !== 'explanation' || !act.demoTabs?.length) return [];
    const idx = Math.min(Math.max(0, activeDemoTabIndex), act.demoTabs.length - 1);
    return act.demoTabs[idx]?.spotlights ?? [];
  }, [spotlightsOverride, appMode, activeActivityId, activeActivityVersion, activeDemoTabIndex]);

  const hasFifoVsLifo = spotlights.includes('fifo-vs-lifo');
  const hasSensorBeam = spotlights.includes('sensor-beam');
  const hasStackTopSpotlight = spotlights.includes('depot-stack-top');
  const hasOutChuteSpotlight = spotlights.includes('depot-out-chute');

  const state = propState || storeDepotState;
  const effectiveStatus = runtimeStatus ?? state.status;
  const activeMask = getEffectiveActiveStationsMask(state);
  const showQueue = (activeMask & DEPOT_STATION_BITS.QUEUE) !== 0;
  const showOut = (activeMask & DEPOT_STATION_BITS.OUT) !== 0;

  const isQueueStation = state.workerStation === 'QUEUE';
  const activeStationIdx = stationToIndex(state.workerStation);
  const craneLeftPct = computeCraneLeftPercent(state.workerStation, showQueue);

  const isCollision = effectiveStatus === 'COLLISION' || state.status === 'COLLISION';
  const isSuccess = effectiveStatus === 'SUCCESS' || state.status === 'SUCCESS';

  const outputGoal = state.targetOutput ?? [];
  const totalOutputSlots = Math.max(state.output.length, outputGoal.length, 3);

  return (
    <div
      data-testid="depot-canvas"
      data-quality={isLowQuality ? 'low' : 'high'}
      data-status={effectiveStatus}
      data-active-mask={activeMask}
      className="relative flex flex-col w-full h-full bg-gradient-to-b from-[#eff5fc] via-[#e4eef9] to-[#d9e7f5] text-slate-800 select-none overflow-hidden"
    >
      {/* Subtle Light Blueprint Grid Pattern */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none opacity-45"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(100,116,139,0.22) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />

      {/* >= 48px Daylight Top HUD Sky Clearance Band (avoids SimulationTopLeftHud & MultiRunPipsBar) */}
      <div className="relative z-10 h-12 min-h-[48px] flex-shrink-0 flex items-center justify-end px-3 sm:px-4">
        {hasFifoVsLifo && (
          <div
            data-testid="depot-fifo-vs-lifo-banner"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 border border-sky-300 shadow-sm text-[11px] font-black text-slate-700"
          >
            <span className="px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-300">
              ▲ LIFO
            </span>
            <span className="text-slate-400">⇄</span>
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300">
              ◀ FIFO
            </span>
          </div>
        )}
      </div>

      {/* Centered Status Overlay Pills (Collision / Victory) below Top HUD Clearance */}
      {isCollision && (
        <div
          data-testid="status-collision"
          className={`absolute ${hasMultiVariant ? 'top-14' : 'top-12'} left-1/2 -translate-x-1/2 z-30 px-4 py-1 bg-rose-600 text-white rounded-full font-black shadow-lg shadow-rose-500/30 border-2 border-white ${
            isLowQuality ? '' : 'animate-bounce '
          }flex items-center gap-1.5 pointer-events-none`}
        >
          <span className="text-lg leading-none">
            {getFailureCueSymbol(state.lastFailureReason)}
          </span>
        </div>
      )}

      {isSuccess && (
        <div
          data-testid="status-success"
          className={`absolute ${hasMultiVariant ? 'top-14' : 'top-12'} left-1/2 -translate-x-1/2 z-30 px-4 py-1 bg-amber-400 text-slate-900 rounded-full font-black shadow-lg shadow-amber-500/35 border-2 border-white ${
            isLowQuality ? '' : 'animate-pulse '
          }flex items-center gap-1.5 pointer-events-none`}
        >
          <Trophy className="w-4 h-4" />
          <span className="text-base leading-none">⭐ ⭐ ⭐</span>
        </div>
      )}

      {/* Main Workshop Stage */}
      <div className="relative z-10 flex-1 min-h-0 flex items-stretch px-3 sm:px-5 pb-0 pt-1 gap-3">
        {/* Left/Main Gantry + Stations Area (STACK 1..3 + optional QUEUE) */}
        <div className="relative flex-1 min-w-0 flex flex-col">
          {/* Overhead Brushed Metallic Gantry Rail + Trolley Crane */}
          <div className="relative h-24 sm:h-28 flex-shrink-0">
            {/* Gantry end-bumpers */}
            <div
              aria-hidden="true"
              className="absolute top-1.5 left-0 w-2.5 h-5 rounded-l bg-amber-400 border border-slate-500 shadow-sm z-10"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(45deg, #f59e0b, #f59e0b 4px, #334155 4px, #334155 8px)',
              }}
            />
            <div
              aria-hidden="true"
              className="absolute top-1.5 right-0 w-2.5 h-5 rounded-r bg-amber-400 border border-slate-500 shadow-sm z-10"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(45deg, #f59e0b, #f59e0b 4px, #334155 4px, #334155 8px)',
              }}
            />
            {/* Brushed Aluminum I-Beam Rail */}
            <div
              aria-hidden="true"
              className="absolute top-2.5 inset-x-2 h-3 rounded-full bg-gradient-to-b from-slate-200 via-slate-400 to-slate-500 border border-slate-500/80 shadow"
            />

            {/* Animated Trolley + Spring Cable + Articulated Mechanical Claw */}
            <div
              data-testid="depot-worker-crane"
              className="absolute top-0 -translate-x-1/2 flex flex-col items-center transition-all ease-out z-20"
              style={{
                left: `${craneLeftPct}%`,
                transitionDuration: isLowQuality ? '0ms' : '280ms',
              }}
            >
              {/* Dual Rolling Wheels + Sky Trolley Housing */}
              <div className="flex items-center justify-between w-10 px-1 mb-[-3px]">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-700 border border-slate-300 shadow" />
                <span className="w-2.5 h-2.5 rounded-full bg-slate-700 border border-slate-300 shadow" />
              </div>
              <div className="w-11 h-5 rounded-lg bg-gradient-to-b from-sky-400 to-sky-600 border-2 border-white shadow-md flex items-center justify-center relative">
                <span className="w-2 h-2 rounded-full bg-amber-300 ring-2 ring-sky-900/20" />
              </div>

              {/* Coiled Telescoping Spring Cable */}
              <svg
                aria-hidden="true"
                className="w-5 h-5 -my-0.5 text-slate-600"
                viewBox="0 0 20 20"
                fill="none"
              >
                <path
                  d="M10 0 L10 3 L6 5.5 L14 8 L6 10.5 L14 13 L10 15.5 L10 20"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

              {/* Articulated Pincer Jaws + Full-Size Held Ring */}
              <div className="relative flex flex-col items-center">
                {/* Jaws SVG */}
                <svg
                  aria-hidden="true"
                  className="w-16 h-6 -mb-2 text-slate-700 drop-shadow-sm"
                  viewBox="0 0 64 24"
                  fill="none"
                >
                  <rect x="25" y="0" width="14" height="6" rx="3" fill="#475569" />
                  <path
                    d="M27 5 C15 8 10 15 14 23"
                    stroke="#334155"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                  <path
                    d="M37 5 C49 8 54 15 50 23"
                    stroke="#334155"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                </svg>

                {state.heldCrate ? (
                  <div data-testid="depot-claw-held-crate" className="relative z-10">
                    <RingToken
                      color={state.heldCrate}
                      damaged={state.heldDamaged}
                      isTop
                    />
                  </div>
                ) : (
                  <div className="w-10 h-5 flex items-center justify-center pointer-events-none">
                    <span className="w-2 h-2 rounded-full border border-dashed border-slate-400/70" />
                  </div>
                )}

                {/* Zero-Reading Failure Cue at Claw */}
                {isCollision && state.lastFailureReason && (
                  <div
                    data-testid="depot-failure-badge"
                    aria-label={state.lastFailureReason}
                    className="mt-0.5 px-2 py-0.5 rounded-full bg-rose-600 text-white text-xs font-black shadow border border-white leading-none"
                  >
                    {getFailureCueSymbol(state.lastFailureReason)}
                  </div>
                )}

                {/* Optical Sensor Beam Cone (spotlight) */}
                {hasSensorBeam && (
                  <div
                    data-testid="depot-sensor-beam"
                    className="w-16 h-8 bg-gradient-to-b from-cyan-400/45 via-cyan-300/20 to-transparent clip-path-cone pointer-events-none -mt-1"
                    style={{ clipPath: 'polygon(35% 0%, 65% 0%, 100% 100%, 0% 100%)' }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Crane-Reachable Stations Row (Stacks 1..3 + Optional QUEUE) */}
          <div className="flex-1 min-h-0 flex items-end gap-2 sm:gap-3 pt-1">
            {/* LIFO Stack Bays 1..3 */}
            {DEPOT_STACK_STATIONS.map((stationId, idx) => {
              const bit =
                idx === 0
                  ? DEPOT_STATION_BITS.STACK_1
                  : idx === 1
                    ? DEPOT_STATION_BITS.STACK_2
                    : DEPOT_STATION_BITS.STACK_3;
              if ((activeMask & bit) === 0) return null;

              const stack = state.stacks[idx];
              const targetStack = state.targetStacks?.[idx];
              const isStationActive = !isQueueStation && activeStationIdx === idx;
              const topIndex = stack.length - 1;
              const isStackMatched = Boolean(
                targetStack &&
                  targetStack.length === stack.length &&
                  targetStack.every((c, cIdx) => c === stack[cIdx])
              );
              const showGoalMiniPreview =
                Boolean(targetStack && targetStack.length > 0) &&
                (state.initialStacks[idx]?.length ?? 0) > 0;
              const maxSlots = Math.max(stack.length, targetStack?.length ?? 0, 3);

              return (
                <div
                  key={stationId}
                  data-testid={`depot-stack-${idx + 1}`}
                  className="flex-1 min-w-0 h-full flex flex-col items-center justify-end relative"
                >
                  {/* Transparent Acrylic LIFO Chute */}
                  <div
                    className={`relative w-full max-w-[116px] flex-1 max-h-[210px] min-h-[120px] rounded-t-2xl border-x-2 border-t-2 flex flex-col-reverse items-center justify-start gap-1.5 px-1.5 pt-4 pb-2.5 overflow-hidden transition-all ${
                      isStationActive
                        ? 'border-sky-400 bg-white/75 shadow-[0_0_18px_rgba(56,189,248,0.22)]'
                        : 'border-slate-300/90 bg-white/55 shadow-inner'
                    }`}
                  >
                    {/* Flared Open Mouth Rim */}
                    <div
                      aria-hidden="true"
                      className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-b from-white/90 to-slate-200/50 border-b border-slate-300/60"
                    />

                    {/* Vertical Center Wooden/Amber Peg */}
                    <div
                      aria-hidden="true"
                      className="absolute bottom-0 top-3 left-1/2 -translate-x-1/2 w-2 rounded-t-full bg-gradient-to-r from-[#d4a373]/75 via-[#f1cfa0]/85 to-[#bc8a5f]/75 border-x border-amber-700/20 pointer-events-none"
                    />

                    {/* Stacked Rings + 25% Dashed Ghost Blueprints */}
                    {Array.from({ length: maxSlots }).map((_, slotIdx) => {
                      const liveColor = stack[slotIdx];
                      const ghostColor = targetStack?.[slotIdx];
                      const isTop = slotIdx === topIndex && liveColor !== undefined;
                      const isDimmed = liveColor !== undefined && !isTop;
                      const slotMatched =
                        liveColor !== undefined &&
                        ghostColor !== undefined &&
                        liveColor === ghostColor;

                      return (
                        <div
                          key={slotIdx}
                          className="relative w-full flex items-center justify-center min-h-[24px] z-10"
                        >
                          {isTop && (
                            <span
                              aria-hidden="true"
                              className={`absolute -top-3.5 text-[10px] font-black leading-none select-none ${
                                hasStackTopSpotlight && isStationActive
                                  ? 'text-sky-600 animate-bounce'
                                  : 'text-sky-500/85'
                              }`}
                            >
                              ▲
                            </span>
                          )}
                          {liveColor ? (
                            <div data-testid={`depot-stack-${idx + 1}-crate-${slotIdx}`}>
                              <RingToken
                                color={liveColor}
                                isTop={isTop}
                                isDimmed={isDimmed}
                                isMatched={slotMatched && isStackMatched}
                              />
                            </div>
                          ) : ghostColor ? (
                            <div data-testid={`depot-stack-${idx + 1}-ghost-${slotIdx}`}>
                              <RingToken color={ghostColor} isGhost />
                            </div>
                          ) : (
                            <div className="h-5 sm:h-6 w-full pointer-events-none" />
                          )}
                        </div>
                      );
                    })}

                    {/* Diagonal Acrylic Glare Lines in Front (lower items rest behind acrylic) */}
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 pointer-events-none z-20"
                      style={{
                        background:
                          'linear-gradient(125deg, transparent 22%, rgba(255,255,255,0.42) 26%, rgba(255,255,255,0.08) 31%, transparent 34%, transparent 62%, rgba(255,255,255,0.34) 66%, transparent 72%)',
                      }}
                    />
                  </div>

                  {/* Bold Numeric Station Pedestal Anchored on Workbench */}
                  <div
                    className={`w-full max-w-[116px] flex items-center justify-center gap-1.5 py-1 px-2 rounded-b-lg border-x border-b font-black text-xs shadow-sm transition-colors ${
                      isStationActive
                        ? 'bg-sky-500 text-white border-sky-600'
                        : isStackMatched
                          ? 'bg-emerald-500 text-white border-emerald-600'
                          : 'bg-white/95 text-slate-700 border-slate-300'
                    }`}
                  >
                    <span>{idx + 1}</span>
                    {isStackMatched && <span className="text-[11px]">✓</span>}
                  </div>

                  {/* Compact Mini Goal Preview if initial stack was non-empty AND had targetStacks */}
                  {showGoalMiniPreview && targetStack && (
                    <div
                      aria-label={`Target Stack ${idx + 1}`}
                      className="mt-1 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/85 border border-slate-300/90 shadow-sm"
                    >
                      {targetStack.map((gc, gIdx) => (
                        <span
                          key={gIdx}
                          className="w-2.5 h-2.5 rounded-full border border-white/80 shadow-xs"
                          style={{ backgroundColor: DEPOT_CRATE_COLORS[gc].hex }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Horizontal FIFO Conveyor Belt (QUEUE, only shown when QUEUE bit active) */}
            {showQueue && (
              <div
                data-testid="depot-queue-belt"
                className="flex-[1.5] min-w-[165px] h-full flex flex-col items-center justify-end"
              >
                <div
                  data-testid="depot-queue-station"
                  className={`relative w-full rounded-t-2xl border-2 p-2 flex flex-col justify-between gap-2 transition-all ${
                    isQueueStation
                      ? 'bg-emerald-50/90 border-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.22)]'
                      : 'bg-white/65 border-slate-300/90 shadow-inner'
                  }`}
                >
                  {/* Belt Direction Header */}
                  <div className="flex items-center justify-between text-[10px] font-black text-emerald-700">
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 border border-emerald-300">
                      ▲
                    </span>
                    <span className="tracking-widest text-slate-400">◀ ◀ ◀</span>
                    <span className="px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-300">
                      ⬅
                    </span>
                  </div>

                  {/* Items on Conveyor Belt (index 0 = left front pickup cradle) */}
                  <div className="min-h-[38px] flex items-center gap-1.5 px-1.5 py-1 rounded-lg bg-slate-200/75 border border-slate-300 overflow-x-auto">
                    {state.queue.length === 0 ? (
                      <div
                        data-testid="depot-queue-empty"
                        className="w-full text-center text-sm font-black text-slate-400"
                      >
                        ∅
                      </div>
                    ) : (
                      state.queue.map((item, qIdx) => (
                        <div
                          key={qIdx}
                          data-testid={`depot-queue-crate-${qIdx}`}
                          className="relative flex-shrink-0"
                        >
                          <RingToken
                            color={item.color}
                            damaged={item.damaged}
                            isTop={qIdx === 0}
                            isDimmed={qIdx > 0}
                            compact
                          />
                          {qIdx === 0 && hasSensorBeam && (
                            <div
                              data-testid="depot-sensor-beam"
                              className="absolute -top-4 left-1/2 -translate-x-1/2 w-10 h-4 bg-gradient-to-b from-cyan-400/50 to-transparent pointer-events-none"
                              style={{ clipPath: 'polygon(30% 0%, 70% 0%, 100% 100%, 0% 100%)' }}
                            />
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Spoked Conveyor Rollers Strip */}
                  <div className="flex items-center justify-around px-2 py-0.5 rounded-full bg-slate-300/80 border border-slate-400/50 text-[10px] font-bold text-slate-600">
                    <span>⊙</span>
                    <span className="h-0.5 flex-1 mx-1 bg-slate-400/50 rounded-full" />
                    <span>⊙</span>
                    <span className="h-0.5 flex-1 mx-1 bg-slate-400/50 rounded-full" />
                    <span>⊙</span>
                  </div>
                </div>

                <div
                  className={`w-full py-1 px-2 rounded-b-lg border-x border-b text-center font-black text-xs shadow-sm ${
                    isQueueStation
                      ? 'bg-emerald-500 text-white border-emerald-600'
                      : 'bg-white/95 text-slate-700 border-slate-300'
                  }`}
                >
                  ◀ FIFO ◀
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side Delivery Zone: Curved Overhead Sky-Chute + OUT Bay (only when OUT bit active) */}
        {showOut && (
          <div className="w-[108px] sm:w-[144px] flex-shrink-0 flex flex-col justify-end relative">
            {/* Curved Overhead Translucent Sky-Chute SVG feeding OUT Tray */}
            <svg
              aria-hidden="true"
              className="w-full h-24 sm:h-28 overflow-visible pointer-events-none"
              viewBox="0 0 120 100"
              fill="none"
            >
              <path
                d="M -14 14 Q 68 8 68 88"
                stroke={hasOutChuteSpotlight || state.output.length > 0 ? '#7c3aed' : '#94a3b8'}
                strokeOpacity="0.32"
                strokeWidth="18"
                strokeLinecap="round"
              />
              <path
                d="M -14 14 Q 68 8 68 88"
                stroke={hasOutChuteSpotlight || state.output.length > 0 ? '#8b5cf6' : '#cbd5e1'}
                strokeOpacity="0.7"
                strokeWidth="2.5"
                strokeDasharray="6 5"
                strokeLinecap="round"
              />
              <polygon
                points="68,94 61,82 75,82"
                fill={hasOutChuteSpotlight || state.output.length > 0 ? '#7c3aed' : '#94a3b8'}
                opacity="0.75"
              />
            </svg>

            {/* Horizontal OUT Delivery Tray */}
            <div
              data-testid="depot-output-bay"
              className={`w-full rounded-t-2xl border-2 p-2 flex flex-col items-center gap-1.5 transition-all ${
                hasOutChuteSpotlight || state.output.length > 0
                  ? 'bg-violet-50/90 border-violet-400 shadow-[0_0_14px_rgba(139,92,246,0.2)]'
                  : 'bg-white/65 border-slate-300/90 shadow-inner'
              }`}
            >
              <div className="flex flex-col-reverse items-center gap-1.5 w-full min-h-[92px] justify-start">
                {Array.from({ length: totalOutputSlots }).map((_, slotIdx) => {
                  const delivered = state.output[slotIdx];
                  const expected = outputGoal[slotIdx];
                  const matched = Boolean(delivered && expected && delivered === expected);

                  return (
                    <div
                      key={slotIdx}
                      data-testid={`depot-output-slot-${slotIdx}`}
                      className="flex items-center justify-center"
                    >
                      {delivered ? (
                        <RingToken
                          color={delivered}
                          isMatched={matched}
                          compact
                        />
                      ) : expected ? (
                        <RingToken color={expected} isGhost compact />
                      ) : (
                        <div className="w-11 h-5 sm:w-12 sm:h-6 rounded-full border border-dashed border-slate-300/80 bg-white/40" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="w-full py-1 px-2 rounded-b-lg border-x border-b bg-violet-600 text-white border-violet-700 text-center font-black text-xs shadow-sm flex items-center justify-center gap-1">
              <span>📤</span>
              <span>OUT</span>
            </div>
          </div>
        )}
      </div>

      {/* Warm Birch Workbench Tabletop Baseboard */}
      <div
        aria-hidden="true"
        className="relative z-10 h-5 sm:h-6 flex-shrink-0 w-full border-t-4 border-[#b9834d] bg-gradient-to-b from-[#eed1a7] via-[#e2b983] to-[#cd995b] shadow-[inset_0_2px_4px_rgba(255,255,255,0.5)]"
      />
    </div>
  );
};
