import React from 'react';
import { Trophy } from 'lucide-react';
import { SimulationSpeed, SimulationStatus } from '../../../types';
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
        className={`${sizeClass} relative rounded-full border-2 border-dashed flex items-center justify-center select-none pointer-events-none opacity-25 transition-all`}
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

/**
 * Computes speed-scaled choreography duration (clamped [24, 360] ms, or 0 when disabled).
 */
export function computeDepotAnimDurationMs(
  speed: SimulationSpeed | number,
  isLowQuality: boolean,
  hasLastAction: boolean
): number {
  if (isLowQuality || speed === 'instant' || speed === 0 || !hasLastAction) {
    return 0;
  }
  const speedMs = typeof speed === 'number' && Number.isFinite(speed) && speed > 0 ? speed : 400;
  return Math.round(Math.min(360, Math.max(24, speedMs * 0.88)));
}

const DEPOT_ANIMATION_CSS = `
.depot-stage {
  --depot-out-w: 108px;
}
@media (min-width: 640px) {
  .depot-stage {
    --depot-out-w: 144px;
  }
}
@keyframes depotWheelSpinRight {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
@keyframes depotWheelSpinLeft {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(-360deg); }
}
@keyframes depotCableSwayRight {
  0% { transform: rotate(0deg); }
  25% { transform: rotate(-6deg); }
  65% { transform: rotate(2.5deg); }
  100% { transform: rotate(0deg); }
}
@keyframes depotCableSwayLeft {
  0% { transform: rotate(0deg); }
  25% { transform: rotate(6deg); }
  65% { transform: rotate(-2.5deg); }
  100% { transform: rotate(0deg); }
}
@keyframes depotStationArrivePulse {
  0% { opacity: 0.95; transform: scale(1); }
  45% { opacity: 0.75; transform: scale(1.02); }
  100% { opacity: 0; transform: scale(1); }
}
@keyframes depotSpringPlunge {
  0%, 100% { transform: scaleY(1); }
  40%, 54% { transform: scaleY(2.5); }
}
@keyframes depotJawsPlunge {
  0%, 100% { transform: translateY(0); }
  40%, 54% { transform: translateY(30px); }
}
@keyframes depotJawLeftGrab {
  0% { transform: rotate(0deg); }
  36% { transform: rotate(14deg); }
  52%, 100% { transform: rotate(0deg); }
}
@keyframes depotJawRightGrab {
  0% { transform: rotate(0deg); }
  36% { transform: rotate(-14deg); }
  52%, 100% { transform: rotate(0deg); }
}
@keyframes depotHeldRingGrabLift {
  0% { transform: translateY(48px) scale(0.94); opacity: 0.9; }
  40% { transform: translateY(18px) scale(0.97); opacity: 1; }
  54% { transform: translateY(8px) scale(1.04); opacity: 1; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}
@keyframes depotHeldRingGrabLiftQueue {
  0% { transform: translateY(58px) scale(0.92); opacity: 0.9; }
  40% { transform: translateY(28px) scale(0.96); opacity: 1; }
  54% { transform: translateY(12px) scale(1.04); opacity: 1; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}
@keyframes depotSpringDip {
  0%, 100% { transform: scaleY(1); }
  42%, 56% { transform: scaleY(2.2); }
}
@keyframes depotJawsDip {
  0%, 100% { transform: translateY(0); }
  42%, 56% { transform: translateY(24px); }
}
@keyframes depotJawLeftRelease {
  0% { transform: rotate(0deg); }
  42% { transform: rotate(18deg); }
  66% { transform: rotate(12deg); }
  100% { transform: rotate(0deg); }
}
@keyframes depotJawRightRelease {
  0% { transform: rotate(0deg); }
  42% { transform: rotate(-18deg); }
  66% { transform: rotate(-12deg); }
  100% { transform: rotate(0deg); }
}
@keyframes depotStackRingDrop {
  0% { transform: translateY(var(--depot-drop-y, -84px)) scale(1.04); opacity: 0.95; }
  24% { transform: translateY(var(--depot-drop-y, -84px)) scale(1.02); opacity: 1; }
  86% { transform: translateY(2px) scale(1); opacity: 1; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}
@keyframes depotQueueRingDrop {
  0% { transform: translate(14px, -62px) scale(1.08); opacity: 0.95; }
  26% { transform: translate(10px, -44px) scale(1.05); opacity: 1; }
  86% { transform: translate(0, 2px) scale(1); opacity: 1; }
  100% { transform: translate(0, 0) scale(1); opacity: 1; }
}
@keyframes depotQueueSlideLeft {
  0% { transform: translateX(calc(100% + 6px)); }
  100% { transform: translateX(0); }
}
@keyframes depotRollerSpin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(-360deg); }
}
@keyframes depotFunnelPulse {
  0%, 100% { transform: scale(1); }
  45% { transform: scale(1.16); }
}
@keyframes depotJawsRecoil {
  0% { transform: translateY(0); }
  24% { transform: translateY(-7px); }
  56% { transform: translateY(2px); }
  100% { transform: translateY(0); }
}
@keyframes depotJawLeftFlick {
  0% { transform: rotate(0deg); }
  22% { transform: rotate(22deg); }
  62% { transform: rotate(10deg); }
  100% { transform: rotate(0deg); }
}
@keyframes depotJawRightFlick {
  0% { transform: rotate(0deg); }
  22% { transform: rotate(-22deg); }
  62% { transform: rotate(-10deg); }
  100% { transform: rotate(0deg); }
}
@keyframes depotSkyChutePulse {
  0% { filter: drop-shadow(0 0 0 rgba(139, 92, 246, 0)); }
  35% { filter: drop-shadow(0 0 10px rgba(139, 92, 246, 0.78)); }
  100% { filter: drop-shadow(0 0 2px rgba(139, 92, 246, 0.25)); }
}
@keyframes depotSkyChuteStream {
  0% { stroke-dashoffset: 33; }
  100% { stroke-dashoffset: 0; }
}
@keyframes depotFlyRingX {
  0% { left: var(--depot-fly-start-x); }
  84%, 100% { left: var(--depot-fly-end-x); }
}
@keyframes depotFlyRingY {
  0% { top: 64px; opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(0deg); }
  36% { top: 10px; opacity: 1; transform: translate(-50%, -50%) scale(1.06) rotate(-8deg); }
  70% { top: calc(100% - 134px); opacity: 1; transform: translate(-50%, -50%) scale(0.94) rotate(5deg); }
  84% { top: var(--depot-fly-end-y, calc(100% - 52px)); opacity: 1; transform: translate(-50%, -50%) scale(0.86) rotate(0deg); }
  94%, 100% { top: var(--depot-fly-end-y, calc(100% - 52px)); opacity: 0; transform: translate(-50%, -50%) scale(0.84) rotate(0deg); }
}
@keyframes depotOutputSlotLand {
  0%, 82% { opacity: 0; transform: scale(0.68) translateY(-10px); }
  92% { opacity: 1; transform: scale(1.14) translateY(0); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes depotClawBonkRattle {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  16% { transform: translate(-7px, 4px) rotate(-8deg); }
  34% { transform: translate(7px, -2px) rotate(8deg); }
  52% { transform: translate(-5px, 3px) rotate(-5deg); }
  70% { transform: translate(4px, -1px) rotate(4deg); }
  86% { transform: translate(-2px, 1px) rotate(-2deg); }
}
@keyframes depotBadgePop {
  0% { opacity: 0; transform: scale(0.6); }
  55% { opacity: 1; transform: scale(1.16); }
  100% { opacity: 1; transform: scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  [data-testid="depot-canvas"] *,
  [data-testid="depot-canvas"] *::before,
  [data-testid="depot-canvas"] *::after {
    animation-duration: 1ms !important;
    transition-duration: 0ms !important;
  }
}
`;

export const DepotCanvas: React.FC<DepotCanvasProps> = ({
  state: propState,
  runtimeStatus,
  spotlightsOverride,
}) => {
  const {
    storeDepotState,
    isLowQuality,
    speed,
    hasMultiVariant,
    appMode,
    activeActivityId,
    activeActivityVersion,
    activeDemoTabIndex,
  } = useAppStoreSelector((s) => ({
    storeDepotState: s.depotState,
    isLowQuality: isLowQualityActive(s),
    speed: s.speed,
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

  const action = state.lastAction;
  const shouldAnimate =
    !isLowQuality && speed !== 'instant' && (speed as any) !== 0 && Boolean(action);
  const animDurationMs = computeDepotAnimDurationMs(speed, isLowQuality, Boolean(action));

  const isAnimMove = shouldAnimate && action?.type === 'MOVE';
  const isAnimGrab = shouldAnimate && action?.type === 'GRAB';
  const isAnimPlace = shouldAnimate && action?.type === 'PLACE';
  const isAnimSendOut = shouldAnimate && action?.type === 'SEND_OUT';
  const isAnimCollision = shouldAnimate && action?.type === 'COLLISION';

  const fromLeftPct = action ? computeCraneLeftPercent(action.fromStation, showQueue) : craneLeftPct;
  const moveDeltaPct = craneLeftPct - fromLeftPct;
  const moveDir = moveDeltaPct > 0.1 ? 1 : moveDeltaPct < -0.1 ? -1 : 0;

  const isQueueGrabAnim = isAnimGrab && action?.fromStation === 'QUEUE';
  const isQueuePlaceAnim = isAnimPlace && action?.toStation === 'QUEUE';
  const isQueueArriveAnim = isAnimMove && action?.toStation === 'QUEUE';
  const isOutFlyAnim =
    isAnimSendOut && showOut && action?.outputSlotIndex !== undefined && Boolean(action?.color);
  const isSkyChuteActive = hasOutChuteSpotlight || state.output.length > 0 || isOutFlyAnim;

  const rigAnimationStyle: React.CSSProperties | undefined =
    isAnimMove && moveDir !== 0
      ? {
          transformOrigin: 'top center',
          animation: `${moveDir > 0 ? 'depotCableSwayRight' : 'depotCableSwayLeft'} ${animDurationMs}ms cubic-bezier(0.22, 1, 0.36, 1) both`,
        }
      : isAnimCollision
        ? {
            transformOrigin: 'top center',
            animation: `depotClawBonkRattle ${animDurationMs}ms cubic-bezier(0.36, 0.07, 0.19, 0.97) both`,
          }
        : undefined;

  const springAnimationStyle: React.CSSProperties | undefined = isAnimGrab
    ? {
        transformOrigin: 'top center',
        animation: `depotSpringPlunge ${animDurationMs}ms ease-in-out both`,
      }
    : isAnimPlace
      ? {
          transformOrigin: 'top center',
          animation: `depotSpringDip ${animDurationMs}ms ease-in-out both`,
        }
      : undefined;

  const jawsContainerAnimationStyle: React.CSSProperties | undefined = isAnimGrab
    ? { animation: `depotJawsPlunge ${animDurationMs}ms ease-in-out both` }
    : isAnimPlace
      ? { animation: `depotJawsDip ${animDurationMs}ms ease-in-out both` }
      : isAnimSendOut
        ? { animation: `depotJawsRecoil ${animDurationMs}ms ease-out both` }
        : undefined;

  const leftJawAnimStyle: React.CSSProperties | undefined = isAnimGrab
    ? { transformOrigin: '27px 5px', animation: `depotJawLeftGrab ${animDurationMs}ms ease-in-out both` }
    : isAnimPlace
      ? { transformOrigin: '27px 5px', animation: `depotJawLeftRelease ${animDurationMs}ms ease-in-out both` }
      : isAnimSendOut
        ? { transformOrigin: '27px 5px', animation: `depotJawLeftFlick ${animDurationMs}ms ease-out both` }
        : undefined;

  const rightJawAnimStyle: React.CSSProperties | undefined = isAnimGrab
    ? { transformOrigin: '37px 5px', animation: `depotJawRightGrab ${animDurationMs}ms ease-in-out both` }
    : isAnimPlace
      ? { transformOrigin: '37px 5px', animation: `depotJawRightRelease ${animDurationMs}ms ease-in-out both` }
      : isAnimSendOut
        ? { transformOrigin: '37px 5px', animation: `depotJawRightFlick ${animDurationMs}ms ease-out both` }
        : undefined;

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
      data-anim-duration={animDurationMs}
      data-anim-action={shouldAnimate && action ? action.type : 'NONE'}
      className="relative flex flex-col w-full h-full bg-gradient-to-b from-[#eff5fc] via-[#e4eef9] to-[#d9e7f5] text-slate-800 select-none overflow-hidden"
    >
      {shouldAnimate && <style>{DEPOT_ANIMATION_CSS}</style>}

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
      <div className="relative z-10 flex-1 min-h-0 flex items-stretch px-3 sm:px-5 pb-0 pt-1">
        <div className="depot-stage relative flex-1 min-w-0 flex items-stretch gap-3">
          {/* In-flight sky-chute ring overlay for SEND_OUT (omitted when !shouldAnimate) */}
          {isOutFlyAnim && action?.color && (
            <div
              key={`fly-${action.stepId}`}
              data-testid="depot-flying-ring"
              data-from-station={action.fromStation}
              data-crane-left-pct={craneLeftPct.toFixed(3)}
              data-output-slot={action.outputSlotIndex}
              aria-hidden="true"
              className="pointer-events-none absolute z-30"
              style={
                {
                  '--depot-fly-start-x': `calc((100% - var(--depot-out-w) - 12px) * ${(craneLeftPct / 100).toFixed(4)})`,
                  '--depot-fly-end-x': 'calc(100% - var(--depot-out-w) / 2)',
                  '--depot-fly-end-y': `calc(100% - ${48 + Math.min(action.outputSlotIndex ?? 0, 4) * 26}px)`,
                  animation: `depotFlyRingX ${animDurationMs}ms cubic-bezier(0.25, 0.46, 0.45, 0.94) both, depotFlyRingY ${animDurationMs}ms ease-in-out both`,
                } as React.CSSProperties
              }
            >
              <RingToken color={action.color} damaged={action.damaged} isTop />
            </div>
          )}

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
                className="absolute top-0 -translate-x-1/2 flex flex-col items-center z-20"
                style={{
                  left: `${craneLeftPct}%`,
                  transitionProperty: 'left',
                  transitionDuration: `${animDurationMs}ms`,
                  transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                {/* Dual Rolling Wheels + Sky Trolley Housing */}
                <div className="flex items-center justify-between w-10 px-1 mb-[-3px]">
                  {[0, 1].map((wIdx) => (
                    <span
                      key={wIdx}
                      className="w-2.5 h-2.5 rounded-full bg-slate-700 border border-slate-300 shadow flex items-center justify-center"
                    >
                      <span
                        key={isAnimMove && moveDir !== 0 ? `wheel-${wIdx}-${action?.stepId}` : `wheel-${wIdx}-idle`}
                        className="w-1.5 h-[1.5px] rounded-full bg-slate-200"
                        style={
                          isAnimMove && moveDir !== 0
                            ? {
                                animation: `${
                                  moveDir > 0 ? 'depotWheelSpinRight' : 'depotWheelSpinLeft'
                                } ${animDurationMs}ms cubic-bezier(0.22, 1, 0.36, 1) both`,
                              }
                            : undefined
                        }
                      />
                    </span>
                  ))}
                </div>
                <div className="w-11 h-5 rounded-lg bg-gradient-to-b from-sky-400 to-sky-600 border-2 border-white shadow-md flex items-center justify-center relative">
                  <span className="w-2 h-2 rounded-full bg-amber-300 ring-2 ring-sky-900/20" />
                </div>

                {/* Keyed Cable + Jaws + Held Crate Rig for per-step choreography */}
                <div
                  key={shouldAnimate && action ? `rig-${action.type}-${action.stepId}` : 'rig-static'}
                  className="flex flex-col items-center"
                  style={rigAnimationStyle}
                >
                  {/* Coiled Telescoping Spring Cable */}
                  <svg
                    aria-hidden="true"
                    className="w-5 h-5 -my-0.5 text-slate-600"
                    viewBox="0 0 20 20"
                    fill="none"
                    style={springAnimationStyle}
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
                  <div
                    className="relative flex flex-col items-center"
                    style={jawsContainerAnimationStyle}
                  >
                    {/* Jaws SVG */}
                    <svg
                      aria-hidden="true"
                      className="w-16 h-6 -mb-2 text-slate-700 drop-shadow-sm overflow-visible"
                      viewBox="0 0 64 24"
                      fill="none"
                    >
                      <rect x="25" y="0" width="14" height="6" rx="3" fill="#475569" />
                      <g style={leftJawAnimStyle}>
                        <path
                          d="M27 5 C15 8 10 15 14 23"
                          stroke="#334155"
                          strokeWidth="4"
                          strokeLinecap="round"
                        />
                      </g>
                      <g style={rightJawAnimStyle}>
                        <path
                          d="M37 5 C49 8 54 15 50 23"
                          stroke="#334155"
                          strokeWidth="4"
                          strokeLinecap="round"
                        />
                      </g>
                    </svg>

                    {state.heldCrate ? (
                      <div
                        key={isAnimGrab ? `held-${action?.stepId}` : 'held-steady'}
                        data-testid="depot-claw-held-crate"
                        className="relative z-10"
                        style={
                          isAnimGrab
                            ? {
                                animation: `${
                                  action?.fromStation === 'QUEUE'
                                    ? 'depotHeldRingGrabLiftQueue'
                                    : 'depotHeldRingGrabLift'
                                } ${animDurationMs}ms cubic-bezier(0.22, 1, 0.36, 1) both`,
                              }
                            : undefined
                        }
                      >
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
                        key={isAnimCollision ? `fail-${action?.stepId}` : 'fail-steady'}
                        data-testid="depot-failure-badge"
                        aria-label={state.lastFailureReason}
                        className="mt-0.5 px-2 py-0.5 rounded-full bg-rose-600 text-white text-xs font-black shadow border border-white leading-none"
                        style={
                          isAnimCollision
                            ? { animation: `depotBadgePop ${animDurationMs}ms ease-out both` }
                            : undefined
                        }
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
                const isArriveTarget = isAnimMove && action?.toStation === stationId;
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
                      className={`relative w-full max-w-[116px] flex-1 max-h-[210px] min-h-[120px] rounded-t-2xl border-x-2 border-t-2 flex flex-col-reverse items-center justify-start gap-1.5 px-1.5 pt-4 pb-2.5 overflow-visible transition-all ${
                        isStationActive
                          ? 'border-sky-400 bg-white/75 shadow-[0_0_18px_rgba(56,189,248,0.22)]'
                          : 'border-slate-300/90 bg-white/55 shadow-inner'
                      }`}
                    >
                      {isArriveTarget && (
                        <div
                          key={`arrive-${action?.stepId}`}
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 rounded-t-2xl ring-2 ring-sky-400/85 z-30"
                          style={{
                            animation: `depotStationArrivePulse ${animDurationMs}ms ease-out both`,
                          }}
                        />
                      )}

                      {/* Flared Open Mouth Rim */}
                      <div
                        aria-hidden="true"
                        className="absolute top-0 inset-x-0 h-1.5 rounded-t-[14px] bg-gradient-to-b from-white/90 to-slate-200/50 border-b border-slate-300/60"
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
                        const isNewlyPlacedHere =
                          isAnimPlace &&
                          action?.toStation !== 'QUEUE' &&
                          action?.stackIndex === idx &&
                          action?.stackSlotIndex === slotIdx;

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
                                <div
                                  key={
                                    isNewlyPlacedHere
                                      ? `stack-place-${action?.stepId}`
                                      : `stack-slot-${slotIdx}`
                                  }
                                  style={
                                    isNewlyPlacedHere
                                      ? ({
                                          '--depot-drop-y': `-${Math.max(
                                            54,
                                            (maxSlots - slotIdx) * 28 + 26
                                          )}px`,
                                          animation: `depotStackRingDrop ${animDurationMs}ms cubic-bezier(0.22, 1, 0.36, 1) both`,
                                        } as React.CSSProperties)
                                      : undefined
                                  }
                                >
                                  <RingToken
                                    color={liveColor}
                                    isTop={isTop}
                                    isDimmed={isDimmed}
                                    isMatched={slotMatched && isStackMatched}
                                  />
                                </div>
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
                        className="absolute inset-0 rounded-t-[14px] overflow-hidden pointer-events-none z-20"
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
                    {isQueueArriveAnim && (
                      <div
                        key={`q-arrive-${action?.stepId}`}
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 rounded-t-2xl ring-2 ring-emerald-400/85 z-30"
                        style={{
                          animation: `depotStationArrivePulse ${animDurationMs}ms ease-out both`,
                        }}
                      />
                    )}

                    {/* Belt Direction Header */}
                    <div className="flex items-center justify-between text-[10px] font-black text-emerald-700">
                      <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 border border-emerald-300">
                        ▲
                      </span>
                      <span
                        key={isQueueGrabAnim ? `q-arrows-${action?.stepId}` : 'q-arrows-idle'}
                        className="tracking-widest text-slate-400"
                        style={
                          isQueueGrabAnim
                            ? {
                                animation: `depotQueueSlideLeft ${animDurationMs}ms ease-out both`,
                              }
                            : undefined
                        }
                      >
                        ◀ ◀ ◀
                      </span>
                      <span
                        key={isQueuePlaceAnim ? `q-funnel-${action?.stepId}` : 'q-funnel-idle'}
                        className="px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-300"
                        style={
                          isQueuePlaceAnim
                            ? {
                                animation: `depotFunnelPulse ${animDurationMs}ms ease-out both`,
                              }
                            : undefined
                        }
                      >
                        ⬅
                      </span>
                    </div>

                    {/* Items on Conveyor Belt (index 0 = left front pickup cradle) */}
                    <div
                      className={`min-h-[38px] flex items-center gap-1.5 px-1.5 py-1 rounded-lg bg-slate-200/75 border border-slate-300 ${
                        state.queue.length <= 4 ? 'overflow-visible' : 'overflow-x-auto'
                      }`}
                    >
                      {state.queue.length === 0 ? (
                        <div
                          data-testid="depot-queue-empty"
                          className="w-full text-center text-sm font-black text-slate-400"
                        >
                          ∅
                        </div>
                      ) : (
                        state.queue.map((item, qIdx) => {
                          const isNewlyPlacedInQueue =
                            isQueuePlaceAnim && action?.queueIndex === qIdx;
                          return (
                            <div
                              key={
                                isQueueGrabAnim
                                  ? `q-shift-${action?.stepId}-${qIdx}`
                                  : `q-item-${qIdx}`
                              }
                              data-testid={`depot-queue-crate-${qIdx}`}
                              className="relative flex-shrink-0"
                              style={
                                isQueueGrabAnim
                                  ? {
                                      animation: `depotQueueSlideLeft ${animDurationMs}ms cubic-bezier(0.22, 1, 0.36, 1) both`,
                                    }
                                  : undefined
                              }
                            >
                              <div
                                key={
                                  isNewlyPlacedInQueue
                                    ? `q-drop-${action?.stepId}`
                                    : `q-token-${qIdx}`
                                }
                                style={
                                  isNewlyPlacedInQueue
                                    ? {
                                        animation: `depotQueueRingDrop ${animDurationMs}ms cubic-bezier(0.22, 1, 0.36, 1) both`,
                                      }
                                    : undefined
                                }
                              >
                                <RingToken
                                  color={item.color}
                                  damaged={item.damaged}
                                  isTop={qIdx === 0}
                                  isDimmed={qIdx > 0}
                                  compact
                                />
                              </div>
                              {qIdx === 0 && hasSensorBeam && (
                                <div
                                  data-testid="depot-sensor-beam"
                                  className="absolute -top-4 left-1/2 -translate-x-1/2 w-10 h-4 bg-gradient-to-b from-cyan-400/50 to-transparent pointer-events-none"
                                  style={{
                                    clipPath: 'polygon(30% 0%, 70% 0%, 100% 100%, 0% 100%)',
                                  }}
                                />
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Spoked Conveyor Rollers Strip */}
                    <div className="flex items-center justify-around px-2 py-0.5 rounded-full bg-slate-300/80 border border-slate-400/50 text-[10px] font-bold text-slate-600">
                      {[0, 1, 2].map((rIdx) => (
                        <React.Fragment key={rIdx}>
                          <span
                            key={isQueueGrabAnim ? `roller-${rIdx}-${action?.stepId}` : `roller-${rIdx}`}
                            className="inline-block leading-none"
                            style={
                              isQueueGrabAnim
                                ? {
                                    animation: `depotRollerSpin ${animDurationMs}ms linear both`,
                                  }
                                : undefined
                            }
                          >
                            ⊙
                          </span>
                          {rIdx < 2 && (
                            <span className="h-0.5 flex-1 mx-1 bg-slate-400/50 rounded-full" />
                          )}
                        </React.Fragment>
                      ))}
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
                key={isOutFlyAnim ? `skychute-${action?.stepId}` : 'skychute-idle'}
                aria-hidden="true"
                className="w-full h-24 sm:h-28 overflow-visible pointer-events-none"
                viewBox="0 0 120 100"
                fill="none"
                style={
                  isOutFlyAnim
                    ? { animation: `depotSkyChutePulse ${animDurationMs}ms ease-in-out both` }
                    : undefined
                }
              >
                <path
                  d="M -14 14 Q 68 8 68 88"
                  stroke={isSkyChuteActive ? '#7c3aed' : '#94a3b8'}
                  strokeOpacity={isOutFlyAnim ? '0.52' : '0.32'}
                  strokeWidth="18"
                  strokeLinecap="round"
                />
                <path
                  d="M -14 14 Q 68 8 68 88"
                  stroke={isSkyChuteActive ? '#8b5cf6' : '#cbd5e1'}
                  strokeOpacity={isOutFlyAnim ? '0.95' : '0.7'}
                  strokeWidth="2.5"
                  strokeDasharray="6 5"
                  strokeLinecap="round"
                  style={
                    isOutFlyAnim
                      ? { animation: `depotSkyChuteStream ${animDurationMs}ms linear both` }
                      : undefined
                  }
                />
                <polygon
                  points="68,94 61,82 75,82"
                  fill={isSkyChuteActive ? '#7c3aed' : '#94a3b8'}
                  opacity={isOutFlyAnim ? '0.95' : '0.75'}
                />
              </svg>

              {/* Horizontal OUT Delivery Tray */}
              <div
                data-testid="depot-output-bay"
                className={`w-full rounded-t-2xl border-2 p-2 flex flex-col items-center gap-1.5 transition-all ${
                  isSkyChuteActive
                    ? 'bg-violet-50/90 border-violet-400 shadow-[0_0_14px_rgba(139,92,246,0.2)]'
                    : 'bg-white/65 border-slate-300/90 shadow-inner'
                }`}
              >
                <div className="flex flex-col-reverse items-center gap-1.5 w-full min-h-[92px] justify-start">
                  {Array.from({ length: totalOutputSlots }).map((_, slotIdx) => {
                    const delivered = state.output[slotIdx];
                    const expected = outputGoal[slotIdx];
                    const matched = Boolean(delivered && expected && delivered === expected);
                    const isLandingHere = isOutFlyAnim && action?.outputSlotIndex === slotIdx;

                    return (
                      <div
                        key={slotIdx}
                        data-testid={`depot-output-slot-${slotIdx}`}
                        className="flex items-center justify-center"
                      >
                        {delivered ? (
                          <div
                            key={isLandingHere ? `out-land-${action?.stepId}` : `out-slot-${slotIdx}`}
                            style={
                              isLandingHere
                                ? {
                                    animation: `depotOutputSlotLand ${animDurationMs}ms ease-out both`,
                                  }
                                : undefined
                            }
                          >
                            <RingToken
                              color={delivered}
                              isMatched={matched}
                              compact
                            />
                          </div>
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
      </div>

      {/* Warm Birch Workbench Tabletop Baseboard */}
      <div
        aria-hidden="true"
        className="relative z-10 h-5 sm:h-6 flex-shrink-0 w-full border-t-4 border-[#b9834d] bg-gradient-to-b from-[#eed1a7] via-[#e2b983] to-[#cd995b] shadow-[inset_0_2px_4px_rgba(255,255,255,0.5)]"
      />
    </div>
  );
};
