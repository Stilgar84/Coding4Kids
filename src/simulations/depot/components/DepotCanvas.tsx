import React from 'react';
import { ArrowRight, CheckCircle2, AlertTriangle, Package, Trophy } from 'lucide-react';
import { SimulationStatus } from '../../../types';
import { isLowQualityActive, useAppStoreSelector } from '../../../store/useAppStore';
import {
  CrateColor,
  DEPOT_CRATE_COLORS,
  DEPOT_STACK_STATIONS,
  DepotState,
} from '../types';
import { stationToIndex } from '../depotPhysics';
import { getActivityAtVersion, getActivityLatest } from '../../../data/curriculum';

interface DepotCanvasProps {
  state: DepotState;
  runtimeStatus?: SimulationStatus;
  spotlightsOverride?: string[];
}

const CrateBox: React.FC<{
  color: CrateColor;
  damaged?: boolean;
  isTop?: boolean;
  isDimmed?: boolean;
  isGhost?: boolean;
  compact?: boolean;
}> = ({
  color,
  damaged = false,
  isTop = false,
  isDimmed = false,
  isGhost = false,
  compact = false,
}) => {
  const meta = DEPOT_CRATE_COLORS[color] ?? DEPOT_CRATE_COLORS.RED;
  const sizeClass = compact
    ? 'w-11 h-8 sm:w-12 sm:h-9 text-xs'
    : 'w-14 h-10 sm:w-16 sm:h-11 text-sm sm:text-base';

  if (isGhost) {
    return (
      <div
        className={`${sizeClass} rounded-lg border-2 border-dashed flex items-center justify-center font-black select-none pointer-events-none transition-all`}
        style={{
          borderColor: meta.hex,
          backgroundColor: `${meta.hex}1a`,
          color: `${meta.hex}cc`,
        }}
        aria-label={`Target ${meta.label}`}
      >
        <span>{meta.symbol}</span>
      </div>
    );
  }

  return (
    <div
      data-damaged={damaged ? 'true' : 'false'}
      className={`${sizeClass} relative rounded-lg border-2 flex items-center justify-center font-black text-white shadow-md select-none transition-all duration-200 ${
        isTop
          ? 'ring-2 ring-white/90 shadow-[0_0_12px_rgba(255,255,255,0.35)] scale-[1.03] z-10'
          : isDimmed
          ? 'opacity-45 saturate-75 brightness-75'
          : ''
      }`}
      style={{
        backgroundColor: meta.hex,
        borderColor: isTop ? '#ffffff' : meta.borderHex,
      }}
      aria-label={`${meta.label}${damaged ? ' (Damaged)' : ''}`}
      title={`${meta.label}${damaged ? ' (Damaged)' : ''}`}
    >
      <span className="drop-shadow-sm">{meta.symbol}</span>
      {damaged && (
        <span
          data-testid="crate-damaged-indicator"
          aria-label="Damaged"
          className="absolute -top-1.5 -left-1 text-[11px] select-none"
        >
          ⚡
        </span>
      )}
      {damaged && (
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-md border border-rose-400/80 pointer-events-none bg-rose-500/20"
        />
      )}
      {isDimmed && (
        <span
          aria-hidden="true"
          className="absolute inset-x-1 top-1/2 -translate-y-1/2 h-1 rounded-full bg-slate-950/55 pointer-events-none"
        />
      )}
    </div>
  );
};

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

  const state = propState || storeDepotState;
  const effectiveStatus = runtimeStatus ?? state.status;
  const isQueueStation = state.workerStation === 'QUEUE';
  const activeStationIdx = stationToIndex(state.workerStation);
  const craneLeftPct = isQueueStation
    ? 16.667
    : activeStationIdx === 0
    ? 16.667
    : activeStationIdx === 1
    ? 50
    : 83.333;
  const heldMeta = state.heldCrate ? DEPOT_CRATE_COLORS[state.heldCrate] : null;

  const isCollision = effectiveStatus === 'COLLISION' || state.status === 'COLLISION';
  const isSuccess = effectiveStatus === 'SUCCESS' || state.status === 'SUCCESS';

  const outputGoal = state.targetOutput ?? [];
  const totalOutputSlots = Math.max(state.output.length, outputGoal.length, 3);

  return (
    <div
      data-testid="depot-canvas"
      data-quality={isLowQuality ? 'low' : 'high'}
      data-status={effectiveStatus}
      className="relative flex flex-col w-full h-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white select-none overflow-hidden p-3 sm:p-4 gap-2.5 sm:gap-3"
    >
      {isCollision && (
        <div
          data-testid="status-collision"
          className={`absolute ${hasMultiVariant ? 'top-14' : 'top-3'} left-1/2 -translate-x-1/2 z-20 px-5 py-1.5 bg-red-600/90 text-white rounded-full font-bold shadow-lg shadow-red-500/30 ${
            isLowQuality ? '' : 'animate-bounce '
          }flex items-center gap-2 pointer-events-none`}
        >
          <span className="text-lg">💥</span>
        </div>
      )}

      {isSuccess && (
        <div
          data-testid="status-success"
          className={`absolute ${hasMultiVariant ? 'top-14' : 'top-3'} left-1/2 -translate-x-1/2 z-20 px-5 py-1.5 bg-amber-500 text-slate-900 rounded-full font-extrabold shadow-lg shadow-amber-500/40 ${
            isLowQuality ? '' : 'animate-pulse '
          }flex items-center gap-2 pointer-events-none`}
        >
          <Trophy className="w-5 h-5" />
          <span className="text-lg">⭐ ⭐ ⭐</span>
        </div>
      )}

      {/* Top Status Strip */}
      <div className="flex items-center justify-between gap-2 pr-28 sm:pr-36 flex-shrink-0">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-800/90 border border-slate-700 text-xs font-extrabold text-slate-200 shadow-sm">
          <Package className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-mono">{state.stepCount}</span>
          {heldMeta ? (
            <span
              data-testid="depot-hud-claw"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-black text-white border border-white/60"
              style={{ backgroundColor: heldMeta.hex }}
            >
              <span>{heldMeta.symbol}</span>
              {state.heldDamaged && <span className="text-[10px]">⚡</span>}
            </span>
          ) : (
            <span
              data-testid="depot-hud-claw"
              className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-dashed border-slate-500 text-[10px] text-slate-400"
              title="Empty Claw"
            >
              ∅
            </span>
          )}
        </div>

        {isCollision && (
          <div
            data-testid="depot-failure-badge"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/25 border border-rose-400 text-rose-200 text-xs font-extrabold shadow-md animate-pulse"
            title={state.lastFailureReason ?? 'Depot Error'}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-300" />
            <span className="font-mono">
              {state.lastFailureReason === 'CLAW_FULL'
                ? 'CLAW FULL'
                : state.lastFailureReason === 'EMPTY_STACK'
                ? 'EMPTY'
                : state.lastFailureReason === 'CLAW_EMPTY'
                ? 'NO CRATE'
                : state.lastFailureReason === 'STACK_FULL'
                ? 'FULL'
                : state.lastFailureReason === 'WRONG_OUTPUT_ORDER'
                ? 'ORDER!'
                : state.lastFailureReason === 'DAMAGED_TO_STACK'
                ? 'CRACKED!'
                : state.lastFailureReason === 'INTACT_TO_SCRAP'
                ? 'NOT SCRAP!'
                : 'ERROR'}
            </span>
          </div>
        )}
      </div>

      {/* Main Depot Stage: Left (Gantry + 3 Stacks + FIFO Queue) and Right (Output + Scrap) */}
      <div className="flex-1 min-h-0 flex items-stretch gap-3 sm:gap-4">
        {/* Left: Overhead Gantry Crane + 3 LIFO Stack Bays + FIFO Queue Belt */}
        <div className="flex-1 min-w-0 flex flex-col justify-between bg-slate-900/60 border border-slate-800 rounded-2xl p-2.5 sm:p-3 relative gap-2">
          {/* Gantry Crane Overhead Rail */}
          <div className="relative h-18 sm:h-20 flex-shrink-0">
            {/* Horizontal Track Rail */}
            <div className="absolute inset-x-4 top-2 h-2.5 rounded-full bg-slate-700 border border-slate-600 shadow-inner" />

            {/* Moving Worker Crane Trolley */}
            <div
              data-testid="depot-worker-crane"
              data-station={state.workerStation}
              className={`absolute top-0 -translate-x-1/2 flex flex-col items-center ${
                isLowQuality ? '' : 'transition-all duration-200 ease-out'
              }`}
              style={{ left: `${craneLeftPct}%` }}
            >
              {/* Trolley Wheel Block */}
              <div className="w-10 h-6 rounded-lg bg-amber-400 border-2 border-amber-200 shadow-md flex items-center justify-center gap-1 font-black text-[10px] text-slate-950">
                {isQueueStation ? 'Q' : activeStationIdx + 1}
              </div>
              {/* Hoist Cable */}
              <div className="w-1 h-2 bg-slate-400" />
              {/* Mechanical Claw + Optional Held Crate */}
              <div className="relative flex flex-col items-center">
                <svg
                  className="w-12 h-5 text-slate-300"
                  viewBox="0 0 48 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M24 0 V5" />
                  <path d="M12 14 C12 7, 36 7, 36 14" />
                  {state.heldCrate ? (
                    <>
                      <path d="M12 14 L15 19" />
                      <path d="M36 14 L33 19" />
                    </>
                  ) : (
                    <>
                      <path d="M12 14 L8 18" />
                      <path d="M36 14 L40 18" />
                    </>
                  )}
                </svg>
                {state.heldCrate && (
                  <div
                    data-testid="depot-claw-held-crate"
                    data-color={state.heldCrate}
                    data-damaged={state.heldDamaged ? 'true' : 'false'}
                    className="-mt-1"
                  >
                    <CrateBox
                      color={state.heldCrate}
                      damaged={state.heldDamaged}
                      isTop
                      compact
                    />
                  </div>
                )}
                {/* Sensor beam on claw held crate */}
                {hasSensorBeam && state.heldCrate && (
                  <div
                    data-testid="depot-sensor-beam"
                    className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-0.5 pointer-events-none bg-sky-950/90 border border-sky-400/80 rounded px-1 text-[9px] font-black text-sky-300"
                  >
                    <span>📡</span>
                    <span>✓</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* FIFO vs LIFO Spotlight Banner (Commit 27) */}
          {hasFifoVsLifo && (
            <div
              data-testid="depot-fifo-vs-lifo-banner"
              className="w-full flex items-center justify-between px-3 py-1 bg-indigo-950/70 border border-indigo-400/50 rounded-xl text-[11px] font-black select-none pointer-events-none"
            >
              <span className="text-amber-300">⬆ LIFO Stacks (Top Crate First)</span>
              <span className="text-emerald-300">FIFO Queue (Front Crate First ➔)</span>
            </div>
          )}

          {/* 3 LIFO Stack Bays */}
          <div className="flex-1 min-h-0 grid grid-cols-3 gap-2 sm:gap-3 items-end pt-1">
            {DEPOT_STACK_STATIONS.map((stationId, idx) => {
              const stack = state.stacks[idx] ?? [];
              const targetStack = state.targetStacks?.[idx] ?? [];
              const isWorkerHere = state.workerStation === stationId;
              const slotCount = Math.max(stack.length, targetStack.length, 3);

              return (
                <div
                  key={stationId}
                  data-testid={`depot-stack-${idx + 1}`}
                  className="flex flex-col items-center justify-end h-full min-h-0 gap-1"
                >
                  {/* Vertical Stack Rail Container */}
                  <div
                    className={`relative flex-1 w-full max-w-[84px] min-h-[100px] rounded-t-xl border-x-2 border-b-4 flex flex-col justify-end items-center pb-1.5 px-1 transition-colors ${
                      isWorkerHere
                        ? 'border-amber-400/80 bg-amber-500/5 shadow-[inset_0_-8px_16px_rgba(245,158,11,0.08)]'
                        : 'border-slate-600/70 border-x-dashed bg-slate-950/45'
                    }`}
                  >
                    {/* Stack Slots Rendered Bottom-to-Top */}
                    <div className="flex flex-col-reverse items-center gap-1 w-full">
                      {Array.from({ length: slotCount }, (_, slotIdx) => {
                        const crate = stack[slotIdx];
                        const ghost = targetStack[slotIdx];
                        const isTop = Boolean(crate) && slotIdx === stack.length - 1;
                        const isDimmed = Boolean(crate) && !isTop;

                        if (crate) {
                          return (
                            <div
                              key={slotIdx}
                              data-testid={`depot-stack-${idx + 1}-crate-${slotIdx}`}
                              data-color={crate}
                              data-top={isTop ? 'true' : 'false'}
                              className="relative"
                            >
                              <CrateBox color={crate} isTop={isTop} isDimmed={isDimmed} />
                            </div>
                          );
                        }

                        if (ghost) {
                          return (
                            <div
                              key={slotIdx}
                              data-testid={`depot-stack-${idx + 1}-ghost-${slotIdx}`}
                            >
                              <CrateBox color={ghost} isGhost />
                            </div>
                          );
                        }

                        return <div key={slotIdx} className="w-14 h-9 sm:w-16 sm:h-10 opacity-0" />;
                      })}
                    </div>
                  </div>

                  {/* Numeric Station Badge (1, 2, 3) */}
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl border-2 flex items-center justify-center font-black text-xs sm:text-sm shadow-sm transition-colors ${
                      isWorkerHere
                        ? 'bg-amber-400 text-slate-950 border-amber-200'
                        : 'bg-slate-800 text-slate-200 border-slate-600'
                    }`}
                  >
                    {idx + 1}
                  </div>
                </div>
              );
            })}
          </div>

          {/* FIFO Conveyor Queue Belt (M5) */}
          <div
            data-testid="depot-queue-belt"
            className={`w-full flex items-center justify-between rounded-xl border p-2 bg-slate-950/70 transition-colors ${
              isQueueStation
                ? 'border-amber-400 bg-amber-500/10 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                : 'border-slate-800'
            }`}
          >
            {/* Front marker */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div
                data-testid="depot-queue-station"
                className={`px-2 py-0.5 rounded-lg border text-xs font-black flex items-center gap-1 ${
                  isQueueStation
                    ? 'bg-amber-400 text-slate-950 border-amber-200'
                    : 'bg-slate-800 text-slate-200 border-slate-600'
                }`}
              >
                <span>Q</span>
                <span className="text-[10px] text-slate-400 hidden sm:inline">FRONT</span>
              </div>
              <span className="text-slate-500 text-xs font-bold">◄──</span>
            </div>

            {/* Queue slots (front = index 0) */}
            <div className="flex-1 flex items-center gap-1.5 px-2 overflow-x-auto min-w-0">
              {state.queue.length === 0 ? (
                <div
                  data-testid="depot-queue-empty"
                  className="text-xs text-slate-500 font-mono italic px-2 py-1"
                >
                  Empty
                </div>
              ) : (
                state.queue.map((item, qIdx) => {
                  const isFront = qIdx === 0;
                  return (
                    <div
                      key={qIdx}
                      data-testid={`depot-queue-crate-${qIdx}`}
                      data-color={item.color}
                      data-damaged={item.damaged ? 'true' : 'false'}
                      data-front={isFront ? 'true' : 'false'}
                      className="relative flex-shrink-0"
                    >
                      <CrateBox
                        color={item.color}
                        damaged={item.damaged}
                        isTop={isFront}
                        isDimmed={!isFront}
                        compact
                      />
                      {isFront && (
                        <span className="absolute -top-1 -right-1 text-[9px] bg-amber-400 text-slate-950 font-black px-1 rounded-full">
                          1st
                        </span>
                      )}
                      {hasSensorBeam && isFront && (
                        <div
                          data-testid="depot-sensor-beam"
                          className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-0.5 pointer-events-none bg-sky-950/90 border border-sky-400/80 rounded px-1 text-[8px] font-black text-sky-300"
                        >
                          <span>📡</span>
                          <span>✓</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Back marker */}
            <div className="text-[10px] font-mono text-slate-500 flex-shrink-0">
              BACK
            </div>
          </div>
        </div>

        {/* Right: Output Bay & Scrap Chute */}
        <div className="w-24 sm:w-32 flex-shrink-0 flex flex-col justify-between gap-2.5">
          {/* Output Bay */}
          <div
            data-testid="depot-output-bay"
            className={`flex-1 flex flex-col justify-between rounded-2xl border-2 p-2 sm:p-2.5 transition-colors ${
              isSuccess
                ? 'bg-emerald-950/45 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                : 'bg-slate-900/75 border-slate-700'
            }`}
          >
            <div className="flex items-center justify-center gap-1 pb-1 border-b border-slate-700/80">
              <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-[10px] font-bold text-emerald-300">OUT</span>
            </div>

            <div className="flex-1 flex flex-col justify-center items-center gap-1.5 py-1.5 overflow-y-auto">
              {Array.from({ length: totalOutputSlots }, (_, slotIdx) => {
                const delivered = state.output[slotIdx];
                const target = outputGoal[slotIdx];
                const matchesTarget = Boolean(delivered && target && delivered === target);

                return (
                  <div
                    key={slotIdx}
                    data-testid={`depot-output-slot-${slotIdx}`}
                    className="relative flex items-center gap-1.5"
                  >
                    <span className="text-[10px] font-mono font-bold text-slate-400 w-3 text-right">
                      {slotIdx + 1}
                    </span>
                    {delivered ? (
                      <div className="relative">
                        <CrateBox color={delivered} isTop={matchesTarget} compact />
                        {matchesTarget && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300 bg-slate-950 rounded-full absolute -top-1 -right-1" />
                        )}
                      </div>
                    ) : target ? (
                      <CrateBox color={target} isGhost compact />
                    ) : (
                      <div className="w-11 h-8 sm:w-12 sm:h-9 rounded-lg border border-dashed border-slate-700 bg-slate-950/50" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scrap Bay (M5) */}
          <div
            data-testid="depot-scrap-bay"
            className="h-16 sm:h-20 rounded-2xl border-2 border-rose-800/80 bg-rose-950/40 p-1.5 flex flex-col justify-between items-center text-rose-300 shadow-inner flex-shrink-0"
            title="Scrap Hazard Chute"
          >
            <div className="flex items-center gap-1 text-[10px] font-bold tracking-wider">
              <span>⚠️</span>
              <span>SCRAP</span>
            </div>
            <div
              data-testid="depot-scrap-count"
              className="text-sm sm:text-base font-mono font-black text-rose-200"
            >
              {state.scrapCount}
            </div>
            <div className="text-[8px] text-rose-400/80 font-mono">
              CHUTE
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
