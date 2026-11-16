import React, { useEffect, useRef, useState } from 'react';
import { useAppStoreSelector, isLowQualityActive } from '../../../store/useAppStore';
import {
  CellCoord,
  GridState,
  KeyGateColor,
  KeyGateShape,
  WorldItem,
} from '../../../types';
import {
  SHAPE_SYMBOLS,
  isSwitchLinkedToGate,
  isWaterBridged,
  resolveKeyGateColor,
  resolveKeyGateShape,
} from '../../../engine/physics';
import { useAppStore } from '../../../store/useAppStore';
import { GRID_CELL_SIZE } from './GridOverlayLayer';

const WORLD_LAYER_CSS = `
@keyframes worldSplashRipple {
  0% { transform: scale(0.55); opacity: 0.95; }
  100% { transform: scale(1.3); opacity: 0; }
}
@keyframes worldGateFlash {
  0% { transform: scale(0.75); opacity: 0.95; }
  100% { transform: scale(1.35); opacity: 0; }
}
.world-splash-ripple {
  transform-box: fill-box;
  transform-origin: center;
  animation: worldSplashRipple 420ms ease-out forwards;
}
.world-gate-flash {
  transform-box: fill-box;
  transform-origin: center;
  animation: worldGateFlash 420ms ease-out forwards;
}
@media (prefers-reduced-motion: reduce) {
  .world-splash-ripple,
  .world-gate-flash {
    animation-duration: 1ms;
  }
}
`;

export const KEY_GATE_VISUALS: Record<
  KeyGateColor,
  { fill: string; stroke: string; dark: string; badgeText: string; label: string }
> = {
  amber: {
    fill: '#f59e0b',
    stroke: '#fde68a',
    dark: '#451a03',
    badgeText: '#fef3c7',
    label: 'amber',
  },
  emerald: {
    fill: '#10b981',
    stroke: '#a7f3d0',
    dark: '#022c22',
    badgeText: '#d1fae5',
    label: 'emerald',
  },
  purple: {
    fill: '#a855f7',
    stroke: '#e9d5ff',
    dark: '#3b0764',
    badgeText: '#f3e8ff',
    label: 'purple',
  },
};

export const SHAPE_LABELS: Record<KeyGateShape, string> = {
  circle: 'circle',
  triangle: 'triangle',
  diamond: 'diamond',
};

export interface WorldItemTransitionInfo {
  announcement: string | null;
  newlyUnlockedGateIds: string[];
  newlyBridgedCells: CellCoord[];
  newlyActivatedSwitchIds: string[];
  shookBackpack: boolean;
}

function sameInitialAuthoring(prevGrid: GridState, nextGrid: GridState): boolean {
  if (prevGrid.width !== nextGrid.width || prevGrid.height !== nextGrid.height) {
    return false;
  }
  const prevWater = prevGrid.waterCells ?? [];
  const nextWater = nextGrid.waterCells ?? [];
  if (prevWater.length !== nextWater.length) return false;
  for (let i = 0; i < prevWater.length; i++) {
    if (prevWater[i].x !== nextWater[i].x || prevWater[i].y !== nextWater[i].y) return false;
  }

  const prevInitGates = prevGrid.initialLockedGates ?? [];
  const nextInitGates = nextGrid.initialLockedGates ?? [];
  if (prevInitGates.length !== nextInitGates.length && prevInitGates.length > 0 && nextInitGates.length > 0) {
    return false;
  }

  const prevInitItems = prevGrid.initialWorldItems ?? [];
  const nextInitItems = nextGrid.initialWorldItems ?? [];
  if (prevInitItems.length !== nextInitItems.length && prevInitItems.length > 0 && nextInitItems.length > 0) {
    return false;
  }

  const prevSwitches = prevGrid.floorSwitches ?? [];
  const nextSwitches = nextGrid.floorSwitches ?? [];
  if (prevSwitches.length !== nextSwitches.length) return false;

  return true;
}

function formatItemLabel(item: WorldItem): string {
  if (item.type === 'key') {
    const shape = resolveKeyGateShape(item.shape);
    const color = resolveKeyGateColor(item.color, shape);
    return `${color} ${SHAPE_LABELS[shape]} (${SHAPE_SYMBOLS[shape]}) key`;
  }
  if (item.type === 'plank') {
    return 'wooden plank';
  }
  return 'wooden crate';
}

/**
 * Pure transition detector comparing consecutive GridState snapshots for interactive world items.
 * Ignores map switches, sandbox map edits, and simulation resets so screen-reader announcements
 * fire strictly on genuine runtime pickups, unlocks, bridges, switch activations, or contextual warnings.
 */
export function detectWorldItemTransition(
  prevGrid: GridState | null | undefined,
  nextGrid: GridState
): WorldItemTransitionInfo {
  const empty: WorldItemTransitionInfo = {
    announcement: null,
    newlyUnlockedGateIds: [],
    newlyBridgedCells: [],
    newlyActivatedSwitchIds: [],
    shookBackpack: false,
  };

  if (!prevGrid || !sameInitialAuthoring(prevGrid, nextGrid)) {
    return empty;
  }

  // Ignore simulation resets back to clean initial state
  const prevHadProgress =
    prevGrid.trace.length > 1 ||
    Boolean(prevGrid.robot.carriedItem) ||
    (prevGrid.bridgedWaterCells?.length ?? 0) > 0 ||
    Boolean(prevGrid.lockedGates?.some((g) => g.unlocked)) ||
    Boolean(prevGrid.lastInteractionFeedback);

  const nextIsCleanReset =
    nextGrid.status === 'IDLE' &&
    nextGrid.trace.length <= 1 &&
    !nextGrid.robot.carriedItem &&
    (nextGrid.bridgedWaterCells?.length ?? 0) === 0 &&
    !nextGrid.lastInteractionFeedback &&
    !(nextGrid.lockedGates?.some((g) => g.unlockedByKey));

  if (prevHadProgress && nextIsCleanReset) {
    return empty;
  }

  const parts: string[] = [];
  const newlyUnlockedGateIds: string[] = [];
  const newlyBridgedCells: CellCoord[] = [];
  const newlyActivatedSwitchIds: string[] = [];

  const prevFeedbackSeq = prevGrid.lastInteractionFeedback?.seq ?? 0;
  const nextFeedback = nextGrid.lastInteractionFeedback;
  const shookBackpack = Boolean(nextFeedback && nextFeedback.seq !== prevFeedbackSeq);

  if (shookBackpack && nextFeedback) {
    parts.push(nextFeedback.message);
  }

  // Item pickup
  if (!prevGrid.robot.carriedItem && nextGrid.robot.carriedItem) {
    parts.push(`Picked up ${formatItemLabel(nextGrid.robot.carriedItem)}.`);
  }

  // Plank bridge placement
  const prevBridges = prevGrid.bridgedWaterCells ?? [];
  const nextBridges = nextGrid.bridgedWaterCells ?? [];
  for (const b of nextBridges) {
    if (!prevBridges.some((pb) => pb.x === b.x && pb.y === b.y)) {
      newlyBridgedCells.push(b);
    }
  }
  if (newlyBridgedCells.length > 0) {
    parts.push('Wooden plank bridge placed over water.');
  }

  // Floor switches activated / deactivated
  const prevSwitches = prevGrid.floorSwitches ?? [];
  const nextSwitches = nextGrid.floorSwitches ?? [];
  let activatedCount = 0;
  let deactivatedCount = 0;
  for (const ns of nextSwitches) {
    const ps = prevSwitches.find((s) => s.id === ns.id || (s.x === ns.x && s.y === ns.y));
    const wasActive = Boolean(ps?.active);
    const isActive = Boolean(ns.active);
    if (!wasActive && isActive) {
      activatedCount++;
      newlyActivatedSwitchIds.push(ns.id);
    } else if (wasActive && !isActive) {
      deactivatedCount++;
    }
  }
  if (activatedCount > 0) {
    parts.push(activatedCount === 1 ? 'Floor switch activated.' : `${activatedCount} floor switches activated.`);
  }
  if (deactivatedCount > 0) {
    parts.push(
      deactivatedCount === 1 ? 'Floor switch deactivated.' : `${deactivatedCount} floor switches deactivated.`
    );
  }

  // Gates unlocked / closed
  const prevGates = prevGrid.lockedGates ?? [];
  const nextGates = nextGrid.lockedGates ?? [];
  for (const ng of nextGates) {
    const pg = prevGates.find((g) => g.id === ng.id || (g.x === ng.x && g.y === ng.y));
    const wasUnlocked = Boolean(pg?.unlocked);
    const isUnlocked = Boolean(ng.unlocked);
    const shape = resolveKeyGateShape(ng.shape);
    const color = resolveKeyGateColor(ng.color, shape);
    const symbol = SHAPE_SYMBOLS[shape];

    if (!wasUnlocked && isUnlocked) {
      newlyUnlockedGateIds.push(ng.id);
      if (ng.unlockedByKey && !pg?.unlockedByKey) {
        parts.push(`Unlocked ${color} ${SHAPE_LABELS[shape]} (${symbol}) gate.`);
      } else {
        parts.push(`Linked ${color} ${SHAPE_LABELS[shape]} (${symbol}) gate opened.`);
      }
    } else if (wasUnlocked && !isUnlocked) {
      parts.push(`Linked ${color} ${SHAPE_LABELS[shape]} (${symbol}) gate closed.`);
    }
  }

  return {
    announcement: parts.length > 0 ? parts.join(' ') : null,
    newlyUnlockedGateIds,
    newlyBridgedCells,
    newlyActivatedSwitchIds,
    shookBackpack,
  };
}

export const ShapeEmblemSvg: React.FC<{
  shape: KeyGateShape;
  radius?: number;
  fill: string;
  stroke: string;
  strokeWidth?: number;
}> = ({ shape, radius = 9, fill, stroke, strokeWidth = 1.8 }) => {
  if (shape === 'triangle') {
    const topY = -radius * 1.05;
    const botY = radius * 0.85;
    const halfX = radius * 1.02;
    return (
      <polygon
        points={`0,${topY} ${halfX},${botY} ${-halfX},${botY}`}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    );
  }
  if (shape === 'diamond') {
    const r = radius * 1.08;
    return (
      <polygon
        points={`0,${-r} ${r},0 0,${r} ${-r},0`}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    );
  }
  return <circle r={radius * 0.92} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
};

export interface WorldItemsLayerProps {
  grid: GridState;
  cellSize?: number;
  isInstant?: boolean;
}

/**
 * Renders interactive Grid terrain and items beneath the robot & flags:
 * - Water tiles & placed wooden plank bridges
 * - Recessed floor switches (with linked-gate shape indicator when applicable)
 * - Shape + color redundant Locked Gates (closed portcullis vs open threshold)
 * - Pickup items on the floor: Keys (`● / ▲ / ◆`), Wooden Planks, and Crates
 */
export const WorldItemsLayer: React.FC<WorldItemsLayerProps> = ({
  grid,
  cellSize = GRID_CELL_SIZE,
  isInstant = false,
}) => {
  const isLowQuality = useAppStoreSelector(isLowQualityActive);
  const prevGridRef = useRef<GridState | null>(null);
  const fxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [recentBridgeKeys, setRecentBridgeKeys] = useState<string[]>([]);
  const [recentUnbridgeKeys, setRecentUnbridgeKeys] = useState<string[]>([]);
  const [recentUnlockedGateIds, setRecentUnlockedGateIds] = useState<string[]>([]);

  useEffect(() => {
    return () => {
      if (fxTimerRef.current !== null) {
        clearTimeout(fxTimerRef.current);
        fxTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const prevGrid = prevGridRef.current;
    prevGridRef.current = grid;

    const transition = detectWorldItemTransition(prevGrid, grid);
    if (transition.announcement) {
      useAppStore.setState((prev) => ({
        statusAnnouncement:
          prev.statusAnnouncement === transition.announcement
            ? `${transition.announcement}\u00A0`
            : transition.announcement!,
      }));
    }

    const isCleanReset =
      grid.status === 'IDLE' &&
      grid.trace.length <= 1 &&
      (grid.bridgedWaterCells?.length ?? 0) === 0 &&
      !(grid.lockedGates?.some((g) => g.unlockedByKey));

    if (!prevGrid || isInstant || isLowQuality || isCleanReset) {
      if (fxTimerRef.current !== null) {
        clearTimeout(fxTimerRef.current);
        fxTimerRef.current = null;
      }
      setRecentBridgeKeys((prev) => (prev.length > 0 ? [] : prev));
      setRecentUnbridgeKeys((prev) => (prev.length > 0 ? [] : prev));
      setRecentUnlockedGateIds((prev) => (prev.length > 0 ? [] : prev));
      return;
    }

    const prevBridges = prevGrid.bridgedWaterCells ?? [];
    const nextBridges = grid.bridgedWaterCells ?? [];
    const unbridged = prevBridges
      .filter((pb) => !nextBridges.some((nb) => nb.x === pb.x && nb.y === pb.y))
      .map((c) => `${c.x},${c.y}`);
    const bridged = transition.newlyBridgedCells.map((c) => `${c.x},${c.y}`);
    const unlockedIds = transition.newlyUnlockedGateIds;

    if (bridged.length === 0 && unbridged.length === 0 && unlockedIds.length === 0) {
      return;
    }

    if (fxTimerRef.current !== null) {
      clearTimeout(fxTimerRef.current);
    }

    setRecentBridgeKeys(bridged);
    setRecentUnbridgeKeys(unbridged);
    setRecentUnlockedGateIds(unlockedIds);

    fxTimerRef.current = setTimeout(() => {
      fxTimerRef.current = null;
      setRecentBridgeKeys([]);
      setRecentUnbridgeKeys([]);
      setRecentUnlockedGateIds([]);
    }, 450);
  }, [grid, isInstant, isLowQuality]);

  const waterCells = grid.waterCells ?? [];
  const bridgedWaterCells = grid.bridgedWaterCells ?? [];
  const floorSwitches = grid.floorSwitches ?? [];
  const lockedGates = grid.lockedGates ?? [];
  const worldItems = grid.worldItems ?? [];

  if (
    waterCells.length === 0 &&
    floorSwitches.length === 0 &&
    lockedGates.length === 0 &&
    worldItems.length === 0
  ) {
    return null;
  }

  const sf = cellSize / 72;
  const hasWorldEffects =
    recentBridgeKeys.length > 0 ||
    recentUnbridgeKeys.length > 0 ||
    recentUnlockedGateIds.length > 0;

  return (
    <g data-testid="world-items-layer" className="pointer-events-none">
      {hasWorldEffects && <style>{WORLD_LAYER_CSS}</style>}
      {/* 1. Water Channels & Wooden Plank Bridges */}
      {waterCells.map((w) => {
        const bridged = isWaterBridged(w.x, w.y, bridgedWaterCells);
        const wKey = `${w.x},${w.y}`;
        const showBridgeSplash = !isInstant && !isLowQuality && (recentBridgeKeys.includes(wKey) || recentUnbridgeKeys.includes(wKey));
        const x0 = w.x * cellSize;
        const y0 = w.y * cellSize;
        const cx = x0 + cellSize / 2;
        const cy = y0 + cellSize / 2;
        const pad = 2 * sf;

        return (
          <g
            key={`water-${w.x}-${w.y}`}
            data-testid={`water-cell-${w.x}-${w.y}`}
            data-bridged={bridged ? 'true' : 'false'}
          >
            {/* Deep water basin */}
            <rect
              x={x0 + pad}
              y={y0 + pad}
              width={cellSize - pad * 2}
              height={cellSize - pad * 2}
              rx={6 * sf}
              fill="#0369a1"
              stroke="#38bdf8"
              strokeOpacity={0.55}
              strokeWidth={1.5 * sf}
            />
            <rect
              x={x0 + 6 * sf}
              y={y0 + 6 * sf}
              width={cellSize - 12 * sf}
              height={cellSize - 12 * sf}
              rx={4 * sf}
              fill="#0284c7"
              fillOpacity={0.55}
            />

            {/* Water ripple wave strokes (pattern redundancy for non-color identification) */}
            <g
              transform={`translate(${cx}, ${cy}) scale(${sf})`}
              fill="none"
              stroke="#bae6fd"
              strokeWidth={2.2}
              strokeLinecap="round"
              opacity={bridged ? 0.45 : 0.85}
            >
              <path d="M -20 -11 Q -13 -16 -6 -11 T 8 -11 T 22 -11" />
              <path d="M -22 0 Q -15 -5 -8 0 T 6 0 T 20 0" />
              <path d="M -18 11 Q -11 6 -4 11 T 10 11 T 22 11" />
            </g>

            {/* Wooden Plank Bridge when placed */}
            {bridged && (
              <g
                data-testid={`plank-bridge-${w.x}-${w.y}`}
                transform={`translate(${cx}, ${cy}) scale(${sf})`}
                className={isInstant ? '' : 'transition-transform duration-200'}
              >
                {/* Longitudinal support stringers */}
                <rect x={-23} y={-29} width={7} height={58} rx={2} fill="#78350f" stroke="#451a03" strokeWidth={1} />
                <rect x={16} y={-29} width={7} height={58} rx={2} fill="#78350f" stroke="#451a03" strokeWidth={1} />
                {/* Cross-planks */}
                {[-21, -7, 7, 21].map((py, idx) => (
                  <g key={idx} transform={`translate(0, ${py})`}>
                    <rect
                      x={-28}
                      y={-5.2}
                      width={56}
                      height={10.4}
                      rx={2.2}
                      fill={idx % 2 === 0 ? '#d97706' : '#b45309'}
                      stroke="#451a03"
                      strokeWidth={1.2}
                    />
                    <circle cx={-19.5} cy={0} r={1.3} fill="#fde68a" />
                    <circle cx={19.5} cy={0} r={1.3} fill="#fde68a" />
                  </g>
                ))}
              </g>
            )}

            {/* Animated water splash ripple when plank drops or lifts */}
            {showBridgeSplash && (
              <g transform={`translate(${cx}, ${cy}) scale(${sf})`}>
                <circle
                  r={24}
                  fill="none"
                  stroke="#bae6fd"
                  strokeWidth={2.6}
                  className="world-splash-ripple"
                />
              </g>
            )}
          </g>
        );
      })}

      {/* 1b. Floor Circuit Trace Lines connecting FloorSwitches to Linked Gates */}
      {floorSwitches.map((sw) =>
        lockedGates
          .filter((gate) => isSwitchLinkedToGate(sw, gate))
          .map((gate) => {
            const active = Boolean(sw.active);
            const sx = sw.x * cellSize + cellSize / 2;
            const sy = sw.y * cellSize + cellSize / 2;
            const gx = gate.x * cellSize + cellSize / 2;
            const gy = gate.y * cellSize + cellSize / 2;
            const pathD =
              sx === gx || sy === gy
                ? `M ${sx} ${sy} L ${gx} ${gy}`
                : `M ${sx} ${sy} L ${gx} ${sy} L ${gx} ${gy}`;

            return (
              <g
                key={`circuit-${sw.id}-${gate.id}`}
                data-testid={`switch-circuit-trace-${sw.id}-${gate.id}`}
                data-active={active ? 'true' : 'false'}
              >
                <path
                  d={pathD}
                  fill="none"
                  stroke="#0f172a"
                  strokeWidth={5.5 * sf}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeOpacity={0.65}
                />
                <path
                  d={pathD}
                  fill="none"
                  stroke={active ? '#22d3ee' : '#64748b'}
                  strokeWidth={(active ? 2.8 : 2) * sf}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={active ? undefined : `${5 * sf} ${4 * sf}`}
                  strokeOpacity={active ? 0.95 : 0.72}
                />
                {sx !== gx && sy !== gy && (
                  <circle
                    cx={gx}
                    cy={sy}
                    r={2.5 * sf}
                    fill={active ? '#34d399' : '#64748b'}
                  />
                )}
              </g>
            );
          })
      )}

      {/* 2. Recessed Floor Switches */}
      {floorSwitches.map((sw) => {
        const active = Boolean(sw.active);
        const cx = sw.x * cellSize + cellSize / 2;
        const cy = sw.y * cellSize + cellSize / 2;
        const linkedGate = lockedGates.find((g) => isSwitchLinkedToGate(sw, g));
        const linkedShape = linkedGate ? resolveKeyGateShape(linkedGate.shape) : null;
        const linkedVisual = linkedGate
          ? KEY_GATE_VISUALS[resolveKeyGateColor(linkedGate.color, linkedShape!)]
          : null;
        const reqCount = typeof sw.requiredCount === 'number' && sw.requiredCount > 1 ? sw.requiredCount : undefined;
        const crateCountHere = reqCount
          ? worldItems
              .filter((it) => it.type === 'crate' && it.x === sw.x && it.y === sw.y)
              .reduce((sum, it) => sum + (it.count ?? 1), 0)
          : 0;

        return (
          <g
            key={sw.id}
            data-testid={`floor-switch-${sw.x}-${sw.y}`}
            data-active={active ? 'true' : 'false'}
            data-required-count={reqCount}
            transform={`translate(${cx}, ${cy}) scale(${sf})`}
          >
            {/* Outer recessed metal frame */}
            <rect
              x={-26}
              y={-26}
              width={52}
              height={52}
              rx={8}
              fill="#0f172a"
              stroke={active ? '#34d399' : '#64748b'}
              strokeWidth={active ? 2.6 : 1.8}
            />
            {/* Inner pressure plate */}
            <rect
              x={-20}
              y={-20}
              width={40}
              height={40}
              rx={5}
              fill={active ? '#059669' : '#1e293b'}
              stroke={active ? '#a7f3d0' : '#94a3b8'}
              strokeWidth={1.6}
              strokeDasharray={active ? undefined : '4 3'}
            />
            {/* Corner bolts */}
            <circle cx={-22} cy={-22} r={1.6} fill={active ? '#6ee7b7' : '#64748b'} />
            <circle cx={22} cy={-22} r={1.6} fill={active ? '#6ee7b7' : '#64748b'} />
            <circle cx={-22} cy={22} r={1.6} fill={active ? '#6ee7b7' : '#64748b'} />
            <circle cx={22} cy={22} r={1.6} fill={active ? '#6ee7b7' : '#64748b'} />

            {/* Center pressure icon */}
            <circle
              cx={0}
              cy={0}
              r={8}
              fill={active ? '#34d399' : '#334155'}
              stroke={active ? '#ecfdf5' : '#94a3b8'}
              strokeWidth={1.4}
            />

            {/* Linked gate emblem badge in top-right corner when switch controls a gate */}
            {linkedShape && linkedVisual && (
              <g transform="translate(18, -18)">
                <circle r={7.5} fill="#0f172a" stroke={linkedVisual.stroke} strokeWidth={1.2} />
                <ShapeEmblemSvg
                  shape={linkedShape}
                  radius={4.5}
                  fill={linkedVisual.fill}
                  stroke={linkedVisual.stroke}
                  strokeWidth={1}
                />
              </g>
            )}

            {/* Multi-crate target count badge in bottom-right corner (`k/N`, zero prose) */}
            {reqCount !== undefined && (
              <g
                transform="translate(15, 19)"
                data-testid={`floor-switch-count-${sw.x}-${sw.y}`}
              >
                <rect
                  x={-11}
                  y={-6.5}
                  width={22}
                  height={13}
                  rx={4}
                  fill={active ? '#064e3b' : '#0f172a'}
                  stroke={active ? '#6ee7b7' : '#fbbf24'}
                  strokeWidth={1.2}
                />
                <text
                  x={0}
                  y={3}
                  textAnchor="middle"
                  fontSize={8.5}
                  fontWeight="800"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  fill={active ? '#ecfdf5' : '#fef3c7'}
                >
                  {`${crateCountHere}/${reqCount}`}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* 3. Shape + Color Coded Locked Gates */}
      {lockedGates.map((gate) => {
        const unlocked = Boolean(gate.unlocked);
        const shape = resolveKeyGateShape(gate.shape);
        const color = resolveKeyGateColor(gate.color, shape);
        const vis = KEY_GATE_VISUALS[color];
        const symbol = SHAPE_SYMBOLS[shape];
        const cx = gate.x * cellSize + cellSize / 2;
        const cy = gate.y * cellSize + cellSize / 2;

        return (
          <g
            key={gate.id}
            data-testid={`locked-gate-${gate.x}-${gate.y}`}
            data-shape={shape}
            data-color={color}
            data-unlocked={unlocked ? 'true' : 'false'}
            aria-label={`${color} ${shape} gate ${unlocked ? 'unlocked' : 'locked'}`}
            transform={`translate(${cx}, ${cy}) scale(${sf})`}
          >
            {unlocked ? (
              /* Open Gate: retracted side pillars + passable threshold */
              <g opacity={0.82}>
                <rect
                  x={-31}
                  y={-28}
                  width={9}
                  height={56}
                  rx={3}
                  fill="#334155"
                  stroke={vis.fill}
                  strokeWidth={1.8}
                />
                <rect
                  x={22}
                  y={-28}
                  width={9}
                  height={56}
                  rx={3}
                  fill="#334155"
                  stroke={vis.fill}
                  strokeWidth={1.8}
                />
                <line
                  x1={-20}
                  y1={-24}
                  x2={20}
                  y2={-24}
                  stroke={vis.fill}
                  strokeOpacity={0.45}
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                />
                <line
                  x1={-20}
                  y1={24}
                  x2={20}
                  y2={24}
                  stroke={vis.fill}
                  strokeOpacity={0.45}
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                />
                {/* Small corner shape badge confirming which gate opened */}
                <g transform="translate(26.5, -22)">
                  <ShapeEmblemSvg
                    shape={shape}
                    radius={5.2}
                    fill={vis.fill}
                    stroke={vis.stroke}
                    strokeWidth={1.2}
                  />
                </g>
              </g>
            ) : (
              /* Closed Gate: fortified portcullis bars + central color-blind safe shape emblem */
              <g>
                {/* Outer portcullis frame */}
                <rect
                  x={-30}
                  y={-30}
                  width={60}
                  height={60}
                  rx={8}
                  fill="#0f172a"
                  fillOpacity={0.86}
                  stroke={vis.fill}
                  strokeWidth={3}
                />
                {/* Vertical iron bars */}
                {[-18, -6, 6, 18].map((bx) => (
                  <rect
                    key={bx}
                    x={bx - 2.2}
                    y={-28}
                    width={4.4}
                    height={56}
                    fill="#475569"
                    stroke="#1e293b"
                    strokeWidth={0.8}
                  />
                ))}
                {/* Horizontal crossbars */}
                <rect x={-29} y={-16} width={58} height={5} fill="#334155" />
                <rect x={-29} y={11} width={58} height={5} fill="#334155" />

                {/* Central Lock Escutcheon + Distinct Shape Emblem (● / ▲ / ◆) */}
                <circle r={16} fill="#0f172a" stroke={vis.stroke} strokeWidth={2} />
                <ShapeEmblemSvg
                  shape={shape}
                  radius={11.5}
                  fill={vis.fill}
                  stroke={vis.stroke}
                  strokeWidth={2}
                />
                {/* Inner keyhole slot for unmistakable lock affordance */}
                <circle cx={0} cy={-1.2} r={2.3} fill={vis.dark} />
                <polygon points="-1.6,0 1.6,0 2.4,5 -2.4,5" fill={vis.dark} />
                <title>{`${vis.label} ${shape} (${symbol}) locked gate`}</title>
              </g>
            )}
          </g>
        );
      })}

      {/* 4. Pickup World Items on the Floor (Keys, Planks, Crates) */}
      {worldItems.map((item) => {
        const cx = item.x * cellSize + cellSize / 2;
        const cy = item.y * cellSize + cellSize / 2;

        if (item.type === 'key') {
          const shape = resolveKeyGateShape(item.shape);
          const color = resolveKeyGateColor(item.color, shape);
          const vis = KEY_GATE_VISUALS[color];
          const symbol = SHAPE_SYMBOLS[shape];

          return (
            <g
              key={item.id}
              data-testid={`world-item-key-${item.x}-${item.y}`}
              data-item-type="key"
              data-shape={shape}
              data-color={color}
              aria-label={`${color} ${shape} key`}
              transform={`translate(${cx}, ${cy}) scale(${sf})`}
            >
              {/* Soft ground glow */}
              <circle r={21} fill={vis.fill} fillOpacity={0.18} />
              <g transform="rotate(-35)">
                {/* Key shaft & bit teeth */}
                <rect
                  x={2}
                  y={-3}
                  width={21}
                  height={6}
                  rx={2}
                  fill={vis.fill}
                  stroke={vis.stroke}
                  strokeWidth={1.4}
                />
                <rect
                  x={12}
                  y={2.5}
                  width={4}
                  height={6.5}
                  rx={1}
                  fill={vis.fill}
                  stroke={vis.stroke}
                  strokeWidth={1.1}
                />
                <rect
                  x={18}
                  y={2.5}
                  width={4}
                  height={8}
                  rx={1}
                  fill={vis.fill}
                  stroke={vis.stroke}
                  strokeWidth={1.1}
                />
                {/* Shaped Key Bow (● / ▲ / ◆) */}
                <g transform="translate(-8, 0) rotate(35)">
                  <ShapeEmblemSvg
                    shape={shape}
                    radius={11}
                    fill={vis.fill}
                    stroke={vis.stroke}
                    strokeWidth={2}
                  />
                  <ShapeEmblemSvg
                    shape={shape}
                    radius={4.2}
                    fill={vis.dark}
                    stroke={vis.stroke}
                    strokeWidth={0.9}
                  />
                </g>
              </g>
              <title>{`${vis.label} ${shape} (${symbol}) key`}</title>
            </g>
          );
        }

        if (item.type === 'plank') {
          return (
            <g
              key={item.id}
              data-testid={`world-item-plank-${item.x}-${item.y}`}
              data-item-type="plank"
              aria-label="Wooden plank"
              transform={`translate(${cx}, ${cy}) scale(${sf})`}
            >
              <g transform="rotate(-24)">
                <rect
                  x={-22}
                  y={-9}
                  width={44}
                  height={18}
                  rx={3.5}
                  fill="#d97706"
                  stroke="#fef3c7"
                  strokeWidth={1.5}
                />
                <line x1={-17} y1={-3} x2={17} y2={-3} stroke="#92400e" strokeWidth={1.5} strokeLinecap="round" />
                <line x1={-15} y1={3} x2={16} y2={3} stroke="#92400e" strokeWidth={1.5} strokeLinecap="round" />
                <circle cx={-17} cy={-5} r={1.4} fill="#fef3c7" />
                <circle cx={-17} cy={5} r={1.4} fill="#fef3c7" />
                <circle cx={17} cy={-5} r={1.4} fill="#fef3c7" />
                <circle cx={17} cy={5} r={1.4} fill="#fef3c7" />
              </g>
              <title>Wooden plank</title>
            </g>
          );
        }

        // Crate item (sized so floor switch rim remains clearly visible around it when depressed)
        const crateCount = item.count ?? 1;
        return (
          <g
            key={item.id}
            data-testid={`world-item-crate-${item.x}-${item.y}`}
            data-item-type="crate"
            data-count={crateCount > 1 ? crateCount : undefined}
            aria-label={crateCount > 1 ? `Wooden crate stack (${crateCount})` : 'Wooden crate'}
            transform={`translate(${cx}, ${cy}) scale(${sf})`}
          >
            <rect
              x={-16}
              y={-16}
              width={32}
              height={32}
              rx={4.5}
              fill="#b45309"
              stroke="#fde68a"
              strokeWidth={1.8}
            />
            <rect
              x={-11.5}
              y={-11.5}
              width={23}
              height={23}
              rx={2}
              fill="#d97706"
              stroke="#78350f"
              strokeWidth={1.2}
            />
            <line x1={-11} y1={-11} x2={11} y2={11} stroke="#78350f" strokeWidth={2.5} strokeLinecap="round" />
            <line x1={11} y1={-11} x2={-11} y2={11} stroke="#78350f" strokeWidth={2.5} strokeLinecap="round" />
            <circle cx={-13} cy={-13} r={1.3} fill="#fef3c7" />
            <circle cx={13} cy={-13} r={1.3} fill="#fef3c7" />
            <circle cx={-13} cy={13} r={1.3} fill="#fef3c7" />
            <circle cx={13} cy={13} r={1.3} fill="#fef3c7" />
            {crateCount > 1 && (
              <g transform="translate(0, -16)">
                <rect
                  x={-10}
                  y={-6.5}
                  width={20}
                  height={13}
                  rx={4}
                  fill="#0f172a"
                  stroke="#fde68a"
                  strokeWidth={1.2}
                />
                <text
                  x={0}
                  y={3}
                  textAnchor="middle"
                  fontSize={8.5}
                  fontWeight="800"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  fill="#fef3c7"
                >
                  {`×${crateCount}`}
                </text>
              </g>
            )}
            <title>{crateCount > 1 ? `Wooden crate (×${crateCount})` : 'Wooden crate'}</title>
          </g>
        );
      })}

      {/* 5. Gate unlock micro-feedback flashes */}
      {!isInstant &&
        !isLowQuality &&
        recentUnlockedGateIds.map((gateId) => {
          const gate = lockedGates.find((g) => g.id === gateId);
          if (!gate) return null;
          const gShape = resolveKeyGateShape(gate.shape);
          const gVis = KEY_GATE_VISUALS[resolveKeyGateColor(gate.color, gShape)];
          const gx = gate.x * cellSize + cellSize / 2;
          const gy = gate.y * cellSize + cellSize / 2;
          return (
            <g key={`gate-flash-${gateId}`} transform={`translate(${gx}, ${gy}) scale(${sf})`}>
              <circle
                r={26}
                fill="none"
                stroke={gVis.stroke}
                strokeWidth={3}
                className="world-gate-flash"
              />
            </g>
          );
        })}
    </g>
  );
};
