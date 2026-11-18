import React from 'react';
import { Trophy } from 'lucide-react';
import { SimulationSpeed } from '../../../types';
import { SimulationRendererProps } from '../../../engine/simulation/types';
import { isLowQualityActive, useAppStoreSelector } from '../../../store/useAppStore';
import {
  CrateColor,
  DEPOT_CRATE_COLORS,
  DEPOT_STACK_STATIONS,
  DEPOT_STATION_BITS,
  DepotActionTransition,
  DepotState,
} from '../types';
import {
  getEffectiveActiveStationsMask,
  normalizeCrateColor,
  normalizeDepotStation,
  readDepotTypedSensor,
  stationToIndex,
} from '../depotPhysics';
import { getActivityAtVersion, getActivityLatest } from '../../../data/curriculum';
import { DepotStationId } from '../types';
import { WorkspaceState } from '../../../types';

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

interface DepotCanvasProps extends SimulationRendererProps<DepotState> {
  spotlightsOverride?: string[];
}

/** Lighter specular & rim palette for all 10 uniform glossy Toy-Crane workshop rings. */
const RING_STYLES: Record<
  CrateColor,
  { top: string; mid: string; bottom: string; dark: string; rim: string }
> = {
  BLACK: { top: '#475569', mid: '#0f172a', bottom: '#020617', dark: '#020617', rim: '#94a3b8' },
  RED: { top: '#fca5a5', mid: '#ef4444', bottom: '#b91c1c', dark: '#991b1b', rim: '#fee2e2' },
  BLUE: { top: '#93c5fd', mid: '#3b82f6', bottom: '#1d4ed8', dark: '#1e40af', rim: '#dbeafe' },
  GREEN: { top: '#6ee7b7', mid: '#10b981', bottom: '#047857', dark: '#065f46', rim: '#d1fae5' },
  AMBER: { top: '#fde68a', mid: '#f59e0b', bottom: '#b45309', dark: '#92400e', rim: '#fef3c7' },
  PURPLE: { top: '#c4b5fd', mid: '#8b5cf6', bottom: '#5b21b6', dark: '#5b21b6', rim: '#ede9fe' },
  PINK: { top: '#f9a8d4', mid: '#ec4899', bottom: '#9d174d', dark: '#9d174d', rim: '#fce7f3' },
  CYAN: { top: '#67e8f9', mid: '#06b6d4', bottom: '#0e7490', dark: '#155e75', rim: '#cffafe' },
  ORANGE: { top: '#fdba74', mid: '#f97316', bottom: '#c2410c', dark: '#9a3412', rim: '#ffedd5' },
  WHITE: { top: '#ffffff', mid: '#f1f5f9', bottom: '#94a3b8', dark: '#475569', rim: '#cbd5e1' },
};

const LIGHT_TEXT_BLOCK_COLORS = new Set<CrateColor>(['BLACK', 'RED', 'BLUE', 'PURPLE', 'PINK']);

const RingToken: React.FC<{
  color: CrateColor;
  value?: number;
  enforceHanoiRule?: boolean;
  damaged?: boolean;
  isTop?: boolean;
  isDimmed?: boolean;
  isGhost?: boolean;
  isMatched?: boolean;
  compact?: boolean;
  queueBelt?: boolean;
}> = ({
  color,
  value,
  enforceHanoiRule = false,
  damaged = false,
  isTop = false,
  isDimmed = false,
  isGhost = false,
  isMatched = false,
  compact = false,
  queueBelt = false,
}) => {
  const canonical = normalizeCrateColor(color);
  const meta = DEPOT_CRATE_COLORS[canonical];
  const palette = RING_STYLES[canonical];
  const hasNumericValue = typeof value === 'number' && Number.isFinite(value);
  const sizeClass = queueBelt
    ? hasNumericValue
      ? 'w-9 h-5 sm:w-11 sm:h-5'
      : 'w-9 h-4 sm:w-11 sm:h-5'
    : hasNumericValue
      ? compact
        ? 'w-11 h-6 sm:w-12 sm:h-6'
        : 'w-14 h-7 sm:w-16 sm:h-7'
      : compact
        ? 'w-11 h-5 sm:w-12 sm:h-6'
        : 'w-14 h-6 sm:w-16 sm:h-7';
  const holeSizeClass = queueBelt ? 'w-2.5 h-1.5 sm:w-3 sm:h-2' : 'w-3.5 h-2';
  const hanoiWidthStyle: React.CSSProperties | undefined =
    hasNumericValue && enforceHanoiRule && !queueBelt
      ? {
          width: `${Math.min(72, Math.max(36, 32 + Math.min(Math.max(value, 1), 10) * 4))}px`,
        }
      : undefined;

  if (isGhost) {
    const ghostFill =
      canonical === 'WHITE' ? 'rgba(203, 213, 225, 0.55)' : `${palette.mid}40`;
    return (
      <div
        data-block-kind={hasNumericValue ? (enforceHanoiRule ? 'hanoi-disc' : 'numbered-block') : 'ring'}
        data-value={hasNumericValue ? value : undefined}
        className={`${sizeClass} relative ${
          hasNumericValue && !enforceHanoiRule ? 'rounded-lg' : 'rounded-full'
        } border-2 border-dashed flex items-center justify-center select-none pointer-events-none opacity-80 transition-all`}
        style={{
          ...hanoiWidthStyle,
          borderColor: palette.dark,
          background: ghostFill,
        }}
        aria-label={`Target ${meta.label}${hasNumericValue ? ` ${value}` : ''}`}
      >
        {hasNumericValue ? (
          <span
            className="text-xs font-black tabular-nums leading-none"
            style={{ color: palette.dark }}
          >
            {value}
          </span>
        ) : (
          <span
            aria-hidden="true"
            className={`${holeSizeClass} rounded-full border-2 border-dashed border-white/85 bg-white/75`}
            style={{
              boxShadow: `0 0 0 1px ${palette.dark}55`,
            }}
          />
        )}
      </div>
    );
  }

  if (hasNumericValue) {
    const useLightText = LIGHT_TEXT_BLOCK_COLORS.has(canonical);
    return (
      <div
        data-testid={enforceHanoiRule ? 'depot-hanoi-disc' : 'depot-numbered-block'}
        data-block-kind={enforceHanoiRule ? 'hanoi-disc' : 'numbered-block'}
        data-value={value}
        data-damaged={damaged ? 'true' : 'false'}
        data-matched={isMatched ? 'true' : undefined}
        className={`${sizeClass} relative ${
          enforceHanoiRule ? 'rounded-full' : 'rounded-lg'
        } border-2 flex items-center justify-center select-none transition-all duration-200 ${
          isTop
            ? 'ring-2 ring-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.48)] scale-[1.03] z-10'
            : isDimmed
              ? 'opacity-80 saturate-[0.82]'
              : 'shadow-sm'
        }`}
        style={{
          ...hanoiWidthStyle,
          background: `linear-gradient(180deg, ${palette.top} 0%, ${palette.mid} 55%, ${palette.bottom} 100%)`,
          borderColor: isTop ? '#ffffff' : palette.dark,
          boxShadow: isTop
            ? '0 3px 10px rgba(14,165,233,0.35), inset 0 2px 3px rgba(255,255,255,0.65)'
            : '0 2px 4px rgba(15,23,42,0.18), inset 0 1.5px 2px rgba(255,255,255,0.45)',
        }}
        aria-label={`${meta.label} ${value}`}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-[2px] inset-x-1.5 h-[3px] rounded-full bg-white/55"
        />
        <span
          className={`relative z-10 ${
            queueBelt ? 'px-1 py-0 text-[11px] sm:text-xs' : 'px-1.5 py-0.5 text-xs sm:text-sm'
          } rounded font-black tabular-nums leading-none ${
            useLightText
              ? 'text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.65)]'
              : 'text-slate-900 bg-white/55'
          }`}
        >
          {value}
        </span>
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
        className={`${holeSizeClass} rounded-full border shadow-inner ${
          canonical === 'WHITE'
            ? 'bg-slate-400/35 border-slate-500/60'
            : 'bg-slate-900/25 border-white/40'
        }`}
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

function computeCraneLeftPercent(station: DepotStationId, activeMask: number): number {
  const zones: { id: DepotStationId; weight: number }[] = [];
  if ((activeMask & DEPOT_STATION_BITS.INPUT) !== 0) zones.push({ id: 'INPUT', weight: 1 });
  if ((activeMask & DEPOT_STATION_BITS.STACK_1) !== 0) zones.push({ id: 'STACK_1', weight: 1 });
  if ((activeMask & DEPOT_STATION_BITS.STACK_2) !== 0) zones.push({ id: 'STACK_2', weight: 1 });
  if ((activeMask & DEPOT_STATION_BITS.STACK_3) !== 0) zones.push({ id: 'STACK_3', weight: 1 });
  if ((activeMask & DEPOT_STATION_BITS.QUEUE) !== 0) zones.push({ id: 'QUEUE', weight: 1.5 });
  if (zones.length === 0) {
    const idx = stationToIndex(station);
    return idx === 0 ? 16.667 : idx === 1 ? 50 : 83.333;
  }
  const totalWeight = zones.reduce((acc, z) => acc + z.weight, 0);
  let cursor = 0;
  for (const z of zones) {
    if (z.id === station) {
      return ((cursor + z.weight * 0.5) / totalWeight) * 100;
    }
    cursor += z.weight;
  }
  const idx = Math.min(stationToIndex(station), zones.length - 1);
  return ((idx + 0.5) / totalWeight) * 100;
}

function getFailureCueSymbol(reason: DepotState['lastFailureReason']): string {
  switch (reason) {
    case 'CLAW_EMPTY':
    case 'EMPTY_STACK':
      return '∅';
    case 'INPUT_READ_ONLY':
    case 'INVALID_STATION':
      return '⛔';
    case 'HANOI_VIOLATION':
      return '📏';
    case 'WRONG_OUTPUT_ORDER':
      return '❌';
    default:
      return '💥';
  }
}

interface ActiveCmpHint {
  op: string;
  left: unknown;
  right: unknown;
}

interface ActiveSensorHints {
  stationEmptyTarget: string | null;
  hasItemActive: boolean;
  heldColorActive: boolean;
  topColorActive: boolean;
  heldValueActive: boolean;
  topValueActive: boolean;
  topSensorStation: string | null;
  activeCmp: ActiveCmpHint | null;
  moveVarName: string | null;
}

function collectOperandHint(operand: unknown, out: ActiveSensorHints): void {
  if (typeof operand !== 'string') return;
  const trimmed = operand.trim();
  const base = trimmed.includes('[') ? trimmed.slice(0, trimmed.indexOf('[')) : trimmed;
  if (base === '$heldValue') {
    out.heldValueActive = true;
    out.heldColorActive = true;
  } else if (base === '$topValue') {
    out.topValueActive = true;
    out.topColorActive = true;
    if (!out.topSensorStation) {
      const m = trimmed.match(/^[^[]+\[([^\]]+)\]$/);
      out.topSensorStation = m ? m[1] : 'CURRENT';
    }
  } else if (base === '$heldColor') {
    out.heldColorActive = true;
  } else if (base === '$topColor') {
    out.topColorActive = true;
    if (!out.topSensorStation) {
      const m = trimmed.match(/^[^[]+\[([^\]]+)\]$/);
      out.topSensorStation = m ? m[1] : 'CURRENT';
    }
  } else if (base === '$stationLen' && !out.stationEmptyTarget) {
    const m = trimmed.match(/^[^[]+\[([^\]]+)\]$/);
    out.stationEmptyTarget = m ? m[1] : 'CURRENT';
  }
}

function isDepotBridgeOperand(operand: unknown): boolean {
  if (typeof operand !== 'string') return false;
  return /^\$(heldValue|topValue|heldColor|topColor|stationLen|stack1|stack2|stack3|out)(\[[^\]]+\])?$/.test(
    operand.trim()
  );
}

function collectConditionSensorHints(cond: any, out: ActiveSensorHints): void {
  if (!cond) return;
  if (typeof cond === 'string') {
    const s = cond.replace(/^\$/, '');
    if (s === 'hasItem') out.hasItemActive = true;
    else if (s === 'heldColor') out.heldColorActive = true;
    else if (s === 'topColor') {
      out.topColorActive = true;
      if (!out.topSensorStation) out.topSensorStation = 'CURRENT';
    } else if (s === 'heldValue') {
      out.heldValueActive = true;
      out.heldColorActive = true;
    } else if (s === 'topValue') {
      out.topValueActive = true;
      out.topColorActive = true;
      if (!out.topSensorStation) out.topSensorStation = 'CURRENT';
    } else if (s === 'stationEmpty' && !out.stationEmptyTarget) {
      out.stationEmptyTarget = 'CURRENT';
    }
    return;
  }
  if (typeof cond !== 'object') return;
  if (cond.kind === 'sensor' && typeof cond.sensor === 'string') {
    const s = cond.sensor.replace(/^\$/, '');
    if (s === 'stationEmpty' || s === 'stationLen') {
      out.stationEmptyTarget = typeof cond.param === 'string' ? cond.param : 'CURRENT';
    } else if (s === 'hasItem') {
      out.hasItemActive = true;
    } else if (s === 'heldColor') {
      out.heldColorActive = true;
    } else if (s === 'topColor') {
      out.topColorActive = true;
      if (!out.topSensorStation) out.topSensorStation = 'CURRENT';
    } else if (s === 'heldValue') {
      out.heldValueActive = true;
      out.heldColorActive = true;
    } else if (s === 'topValue') {
      out.topValueActive = true;
      out.topColorActive = true;
      if (!out.topSensorStation) {
        out.topSensorStation = typeof cond.param === 'string' ? cond.param : 'CURRENT';
      }
    }
    return;
  }
  if (cond.kind === 'cmp') {
    collectOperandHint(cond.left, out);
    collectOperandHint(cond.right, out);
    if (
      !out.activeCmp &&
      (isDepotBridgeOperand(cond.left) || isDepotBridgeOperand(cond.right))
    ) {
      out.activeCmp = {
        op: String(cond.op ?? '='),
        left: cond.left,
        right: cond.right,
      };
    }
    return;
  }
  if (cond.operand) collectConditionSensorHints(cond.operand, out);
  if (cond.inner) collectConditionSensorHints(cond.inner, out);
  if (cond.left) collectConditionSensorHints(cond.left, out);
  if (cond.right) collectConditionSensorHints(cond.right, out);
}

function extractActiveSensorHints(
  workspace: WorkspaceState | undefined,
  activeBlockId: string | null | undefined
): ActiveSensorHints {
  const hints: ActiveSensorHints = {
    stationEmptyTarget: null,
    hasItemActive: false,
    heldColorActive: false,
    topColorActive: false,
    heldValueActive: false,
    topValueActive: false,
    topSensorStation: null,
    activeCmp: null,
    moveVarName: null,
  };
  if (!workspace || !activeBlockId) return hints;
  for (const scope of ['MAIN', 'F1', 'F2', 'F3'] as const) {
    const found = workspace[scope]?.find((b) => b.id === activeBlockId);
    if (!found) continue;
    if (found.params?.condition) {
      collectConditionSensorHints(found.params.condition, hints);
    }
    if (found.type === 'VAR_ASSIGN' || found.type === 'VAR_OP') {
      collectOperandHint(found.params?.b, hints);
      collectOperandHint(found.params?.c, hints);
    }
    if (found.type === 'DEPOT_MOVE_TO' && typeof found.params?.station === 'string') {
      const st = found.params.station.trim();
      if (/^[a-z]$/.test(st)) {
        hints.moveVarName = st;
      }
    }
    break;
  }
  return hints;
}

const COLOR_DOT_HEX: Record<string, string> = {
  black: '#0f172a',
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#10b981',
  amber: '#f59e0b',
  yellow: '#f59e0b',
  purple: '#8b5cf6',
  pink: '#ec4899',
  cyan: '#06b6d4',
  orange: '#f97316',
  white: '#f8fafc',
};

function resolveBridgeOperand(
  raw: unknown,
  state: DepotState,
  runtimeVariables?: Record<string, unknown>
): { label: string; colorHex?: string; rawVal?: number | string } {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return { label: String(raw), rawVal: raw };
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('$')) {
      const sensed = readDepotTypedSensor(trimmed, state);
      if (typeof sensed === 'number' && Number.isFinite(sensed)) {
        return { label: String(sensed), rawVal: sensed };
      }
      if (sensed && typeof sensed === 'object' && sensed.type === 'color') {
        return {
          label: '●',
          colorHex: COLOR_DOT_HEX[sensed.value] ?? '#94a3b8',
          rawVal: sensed.value,
        };
      }
      return { label: '∅' };
    }
    if (/^[a-z]$/.test(trimmed)) {
      const varVal = runtimeVariables?.[trimmed];
      if (typeof varVal === 'number' && Number.isFinite(varVal)) {
        return { label: String(varVal), rawVal: varVal };
      }
      if (varVal && typeof varVal === 'object' && (varVal as any).type === 'color') {
        const c = String((varVal as any).value ?? '');
        return { label: '●', colorHex: COLOR_DOT_HEX[c] ?? '#94a3b8', rawVal: c };
      }
      return { label: trimmed };
    }
    const colKey = trimmed.replace(/^color:/i, '').toLowerCase();
    if (COLOR_DOT_HEX[colKey]) {
      return { label: '●', colorHex: COLOR_DOT_HEX[colKey], rawVal: colKey === 'yellow' ? 'amber' : colKey };
    }
    const asNum = Number(trimmed);
    if (trimmed.length > 0 && Number.isFinite(asNum)) {
      return { label: String(asNum), rawVal: asNum };
    }
    return { label: trimmed };
  }
  return { label: '?' };
}

function evalBridgeOp(op: string, a: number | string | undefined, b: number | string | undefined): boolean | null {
  if (a === undefined || b === undefined) return null;
  if (typeof a === 'number' && typeof b === 'number') {
    switch (op) {
      case '=':
      case '==':
        return a === b;
      case '!=':
        return a !== b;
      case '>':
        return a > b;
      case '>=':
        return a >= b;
      case '<':
        return a < b;
      case '<=':
        return a <= b;
      default:
        return null;
    }
  }
  if (typeof a === 'string' && typeof b === 'string') {
    if (op === '=' || op === '==') return a === b;
    if (op === '!=') return a !== b;
  }
  return null;
}

/**
 * Computes speed-scaled choreography duration (~90% of step interval, or 0 when disabled).
 */
export function computeDepotAnimDurationMs(
  speed: SimulationSpeed | number,
  isLowQuality: boolean,
  hasLastAction: boolean
): number {
  if (!hasLastAction || isLowQuality || speed === 'instant') {
    return 0;
  }
  const speedMs = typeof speed === 'number' && Number.isFinite(speed) ? speed : 400;
  if (speedMs <= 0) {
    return 0;
  }
  if (speedMs <= 25) {
    return 230;
  }
  if (speedMs <= 100) {
    return 585;
  }
  return Math.round(speedMs * 3.375);
}

/**
 * Computes station-specific SSR fallback vertical/horizontal travel offsets (in px)
 * between the resting gripper jaws and the target station slot/cradle.
 */
export function computeDepotStationTravelPx(
  action: DepotActionTransition | undefined
): { grabDistPx: number; grabDxPx: number; placeDistPx: number; placeDxPx: number } {
  if (!action) {
    return { grabDistPx: 172, grabDxPx: 0, placeDistPx: 172, placeDxPx: 0 };
  }
  const slotIdx = action.stackSlotIndex ?? 0;
  const stackDist = Math.max(96, 182 - slotIdx * 22);

  let grabDistPx = 172;
  let grabDxPx = 0;
  if (action.type === 'GRAB') {
    if (action.fromStation === 'INPUT') {
      grabDistPx = 88;
      grabDxPx = 0;
    } else if (action.fromStation === 'QUEUE') {
      grabDistPx = 96;
      grabDxPx = -30;
    } else {
      grabDistPx = stackDist;
      grabDxPx = 0;
    }
  }

  let placeDistPx = 172;
  let placeDxPx = 0;
  if (action.type === 'PLACE') {
    if (action.toStation === 'QUEUE') {
      placeDistPx = 96;
      placeDxPx = 30;
    } else {
      placeDistPx = stackDist;
      placeDxPx = 0;
    }
  }

  return { grabDistPx, grabDxPx, placeDistPx, placeDxPx };
}

function computeGrabSpringVars(jawsDyPx: number, grabDxPx: number = 0) {
  const s = (ratio: number) => (1 + (jawsDyPx * ratio) / 20).toFixed(3);
  const k = (ratio: number) =>
    `${((Math.atan2(grabDxPx * ratio, 20 + jawsDyPx * ratio) * 180) / Math.PI).toFixed(2)}deg`;
  return {
    s14: s(0.42),
    s28: s(0.84),
    sMax: s(1),
    s64: s(0.64),
    s82: s(0.2),
    k14: k(0.42),
    k28: k(0.84),
    kMax: k(1),
    k64: k(0.64),
    k82: k(0.2),
  };
}

function computePlaceDipVars(placeDxPx: number) {
  const dipX = Math.round(placeDxPx * 0.72);
  const k = (ratio: number, dipY: number) =>
    `${((Math.atan2(dipX * ratio, 20 + dipY) * 180) / Math.PI).toFixed(2)}deg`;
  return {
    dipX,
    k24: k(1, 42),
    k42: k(0.65, 28),
    k66: k(0.25, 14),
    k82: k(0.1, 5),
  };
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
  0% { transform: skewX(0deg) scaleY(1); }
  14% { transform: skewX(var(--depot-grab-skew-14, 0deg)) scaleY(var(--depot-grab-spring-14, 4.65)); }
  28% { transform: skewX(var(--depot-grab-skew-28, 0deg)) scaleY(var(--depot-grab-spring-28, 8.3)); }
  38%, 48% { transform: skewX(var(--depot-grab-skew-max, 0deg)) scaleY(var(--depot-grab-spring-max, 9.7)); }
  64% { transform: skewX(var(--depot-grab-skew-64, 0deg)) scaleY(var(--depot-grab-spring-64, 6.57)); }
  82% { transform: skewX(var(--depot-grab-skew-82, 0deg)) scaleY(var(--depot-grab-spring-82, 2.74)); }
  100% { transform: skewX(0deg) scaleY(1); }
}
@keyframes depotJawsPlunge {
  0% { transform: translate(0px, 0px); }
  14% { transform: translate(calc(var(--depot-grab-x, 0px) * 0.42), calc(var(--depot-grab-jaws-y, 174px) * 0.42)); }
  28% { transform: translate(calc(var(--depot-grab-x, 0px) * 0.84), calc(var(--depot-grab-jaws-y, 174px) * 0.84)); }
  38%, 48% { transform: translate(var(--depot-grab-x, 0px), var(--depot-grab-jaws-y, 174px)); }
  64% { transform: translate(calc(var(--depot-grab-x, 0px) * 0.64), calc(var(--depot-grab-jaws-y, 174px) * 0.64)); }
  82% { transform: translate(calc(var(--depot-grab-x, 0px) * 0.2), calc(var(--depot-grab-jaws-y, 174px) * 0.2)); }
  100% { transform: translate(0px, 0px); }
}
@keyframes depotJawLeftGrab {
  0% { transform: rotate(0deg); }
  24%, 34% { transform: rotate(20deg); }
  46%, 100% { transform: rotate(0deg); }
}
@keyframes depotJawRightGrab {
  0% { transform: rotate(0deg); }
  24%, 34% { transform: rotate(-20deg); }
  46%, 100% { transform: rotate(0deg); }
}
@keyframes depotHeldRingGrabLift {
  0% { transform: translateY(var(--depot-grab-dist, 174px)) scale(0.96); opacity: 1; }
  14% { transform: translateY(calc(var(--depot-grab-dist, 174px) * 0.58)) scale(0.97); opacity: 1; }
  28% { transform: translateY(calc(var(--depot-grab-dist, 174px) * 0.16)) scale(0.99); opacity: 1; }
  38% { transform: translateY(0) scale(1.04); opacity: 1; }
  48% { transform: translateY(0) scale(1); opacity: 1; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}
@keyframes depotHeldRingGrabLiftQueue {
  0% { transform: translate(var(--depot-grab-x, 0px), var(--depot-grab-dist, 96px)) scale(var(--depot-grab-start-scale, 0.88)); opacity: 1; }
  14% { transform: translate(calc(var(--depot-grab-x, 0px) * 0.58), calc(var(--depot-grab-dist, 96px) - var(--depot-grab-jaws-y, 90px) * 0.42)) scale(0.92); opacity: 1; }
  28% { transform: translate(calc(var(--depot-grab-x, 0px) * 0.16), calc(var(--depot-grab-dist, 96px) - var(--depot-grab-jaws-y, 90px) * 0.84 - 2px)) scale(0.97); opacity: 1; }
  38% { transform: translate(0px, 0px) scale(1.04); opacity: 1; }
  48%, 100% { transform: translate(0px, 0px) scale(1); opacity: 1; }
}
@keyframes depotSpringDip {
  0% { transform: skewX(0deg) scaleY(1); }
  24% { transform: skewX(var(--depot-place-skew-24, 0deg)) scaleY(3.1); }
  42% { transform: skewX(var(--depot-place-skew-42, 0deg)) scaleY(2.4); }
  66% { transform: skewX(var(--depot-place-skew-66, 0deg)) scaleY(1.7); }
  82% { transform: skewX(var(--depot-place-skew-82, 0deg)) scaleY(1.25); }
  100% { transform: skewX(0deg) scaleY(1); }
}
@keyframes depotJawsDip {
  0% { transform: translate(0px, 0px); }
  24% { transform: translate(var(--depot-place-dip-x, 0px), 42px); }
  42% { transform: translate(calc(var(--depot-place-dip-x, 0px) * 0.65), 28px); }
  66% { transform: translate(calc(var(--depot-place-dip-x, 0px) * 0.25), 14px); }
  82% { transform: translate(calc(var(--depot-place-dip-x, 0px) * 0.1), 5px); }
  100% { transform: translate(0px, 0px); }
}
@keyframes depotJawLeftRelease {
  0%, 16% { transform: rotate(0deg); }
  30%, 54% { transform: rotate(22deg); }
  100% { transform: rotate(0deg); }
}
@keyframes depotJawRightRelease {
  0%, 16% { transform: rotate(0deg); }
  30%, 54% { transform: rotate(-22deg); }
  100% { transform: rotate(0deg); }
}
@keyframes depotPlaceRingTravel {
  0% { transform: translate(0px, 0px) scale(1); opacity: 1; }
  24% { transform: translate(0px, 0px) scale(1.02); opacity: 1; }
  44% { transform: translate(calc(var(--depot-place-x, 0px) * 0.35), calc(var(--depot-place-dist, 174px) * 0.36 - 32px)) scale(1.01); opacity: 1; }
  66% { transform: translate(calc(var(--depot-place-x, 0px) * 0.8), calc(var(--depot-place-dist, 174px) * 0.74 - 18px)) scale(1); opacity: 1; }
  82% { transform: translate(var(--depot-place-x, 0px), calc(var(--depot-place-dist, 174px) - 6px)) scale(var(--depot-place-end-scale, 1)); opacity: 1; }
  86%, 100% { transform: translate(var(--depot-place-x, 0px), calc(var(--depot-place-dist, 174px) - 6px)) scale(var(--depot-place-end-scale, 1)); opacity: 0; }
}
@keyframes depotPlaceQueueEntry {
  0% { transform: translate(0px, 0px) scale(1); opacity: 1; }
  20% { transform: translate(calc(var(--depot-place-x, 30px) * 0.35 - var(--depot-place-dip-x, 22px) * 0.8), calc(var(--depot-place-dist, 96px) * 0.38 - 34px)) scale(0.96); opacity: 1; }
  41% { transform: translate(calc(var(--depot-place-x, 30px) - var(--depot-place-dip-x, 22px) * 0.65), calc(var(--depot-place-dist, 96px) - 28px)) scale(0.84); opacity: 1; }
  44%, 100% { transform: translate(calc(var(--depot-place-x, 30px) - var(--depot-place-dip-x, 22px) * 0.65), calc(var(--depot-place-dist, 96px) - 28px)) scale(0.84); opacity: 0; }
}
@keyframes depotStackRingDrop {
  0%, 80% { opacity: 0; transform: translateY(-4px) scale(0.96); }
  85% { opacity: 1; transform: translateY(2px) scale(1.03); }
  93% { opacity: 1; transform: translateY(-1px) scale(1); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes depotQueueRingDrop {
  0%, 41% { opacity: 0; transform: translateY(-6px) scale(0.92); }
  52% { opacity: 1; transform: translateY(2px) scale(1.04); }
  66%, 100% { opacity: 1; transform: translateY(0px) scale(1); }
}
@keyframes depotQueueAdvanceUp {
  0%, 26% { transform: translate(0px, var(--depot-q-row-step, 24px)); }
  92%, 100% { transform: translate(0px, 0px); }
}
@keyframes depotQueueAdvanceTurn {
  0%, 26% { transform: translate(var(--depot-q-lane-dx, 52px), 0px); }
  60% { transform: translate(calc(var(--depot-q-lane-dx, 52px) * 0.5), 9px); }
  92%, 100% { transform: translate(0px, 0px); }
}
@keyframes depotQueueAdvanceDown {
  0%, 26% { transform: translate(0px, calc(-1 * var(--depot-q-row-step, 24px))); }
  92%, 100% { transform: translate(0px, 0px); }
}
@keyframes depotQueuePlaceRideRight {
  0%, 41% { opacity: 0; transform: translateY(var(--depot-q-ride-start-y, -24px)); }
  43% { opacity: 1; transform: translateY(var(--depot-q-ride-start-y, -24px)); }
  94% { opacity: 1; transform: translateY(2px); }
  100% { opacity: 1; transform: translateY(0px); }
}
@keyframes depotQueuePlaceRideAroundU {
  0%, 41% { opacity: 0; transform: translate(var(--depot-q-lane-dx, 52px), var(--depot-q-ride-start-y, 0px)); }
  43% { opacity: 1; transform: translate(var(--depot-q-lane-dx, 52px), var(--depot-q-ride-start-y, 0px)); }
  66% { opacity: 1; transform: translate(var(--depot-q-lane-dx, 52px), var(--depot-q-ride-bottom-y, 72px)); }
  76% { opacity: 1; transform: translate(calc(var(--depot-q-lane-dx, 52px) * 0.5), calc(var(--depot-q-ride-bottom-y, 72px) + 9px)); }
  85% { opacity: 1; transform: translate(0px, var(--depot-q-ride-bottom-y, 72px)); }
  97% { opacity: 1; transform: translate(0px, -1.5px); }
  100% { opacity: 1; transform: translate(0px, 0px); }
}
@keyframes depotUBeltTread {
  0% { stroke-dashoffset: 24; }
  100% { stroke-dashoffset: 0; }
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
  0% { top: var(--depot-fly-start-y, 64px); opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(0deg); }
  34% { top: 10px; opacity: 1; transform: translate(-50%, -50%) scale(1.06) rotate(-8deg); }
  68% { top: calc(var(--depot-fly-end-y, calc(100% - 52px)) - 76px); opacity: 1; transform: translate(-50%, -50%) scale(0.94) rotate(5deg); }
  84% { top: var(--depot-fly-end-y, calc(100% - 52px)); opacity: 1; transform: translate(-50%, -50%) scale(0.86) rotate(0deg); }
  90%, 100% { top: var(--depot-fly-end-y, calc(100% - 52px)); opacity: 0; transform: translate(-50%, -50%) scale(0.84) rotate(0deg); }
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
@keyframes depotRadarPulse {
  0%, 100% { transform: scale(0.92); opacity: 0.9; }
  50% { transform: scale(1.14); opacity: 0.45; }
}
@keyframes depotInputAdvanceUp {
  0%, 26% { transform: translateY(calc(100% + 6px)); }
  92%, 100% { transform: translateY(0); }
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
  runtimeVariables,
  spotlightsOverride,
  activeBlockId: propActiveBlockId,
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
    workspace,
    storeActiveBlockId,
    storeRuntimeVariables,
  } = useAppStoreSelector((s) => ({
    storeDepotState: s.depotState,
    isLowQuality: isLowQualityActive(s),
    speed: s.speed,
    hasMultiVariant: s.variantRuns.length > 1,
    appMode: s.appMode,
    activeActivityId: s.activeActivityId,
    activeActivityVersion: s.activeActivityVersion,
    activeDemoTabIndex: s.activeDemoTabIndex,
    workspace: s.workspace,
    storeActiveBlockId: s.runtime?.activeBlockId ?? null,
    storeRuntimeVariables: s.runtime?.variables,
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

  const effectiveActiveBlockId = propActiveBlockId ?? storeActiveBlockId;
  const effectiveVariables = (runtimeVariables ?? storeRuntimeVariables ?? undefined) as
    | Record<string, unknown>
    | undefined;
  const sensorHints = React.useMemo(
    () => extractActiveSensorHints(workspace, effectiveActiveBlockId),
    [workspace, effectiveActiveBlockId]
  );

  const state = propState || storeDepotState;
  const effectiveStatus = runtimeStatus ?? state.status;
  const activeMask = getEffectiveActiveStationsMask(state);
  const showInput = (activeMask & DEPOT_STATION_BITS.INPUT) !== 0;
  const showQueue = (activeMask & DEPOT_STATION_BITS.QUEUE) !== 0;
  const showOut = (activeMask & DEPOT_STATION_BITS.OUT) !== 0;

  const hasFifoVsLifo = spotlights.includes('fifo-vs-lifo');
  const hasSpotlightBeam = spotlights.includes('sensor-beam');
  const hasSensorBeam = hasSpotlightBeam || sensorHints.topColorActive;
  const sensorTargetStation: DepotStationId | null = sensorHints.topColorActive
    ? !sensorHints.topSensorStation || sensorHints.topSensorStation.toUpperCase() === 'CURRENT'
      ? state.workerStation
      : normalizeDepotStation(sensorHints.topSensorStation)
    : hasSpotlightBeam
      ? state.workerStation
      : null;
  const isClawSensorBeamActive =
    hasSensorBeam && (sensorTargetStation === null || sensorTargetStation === state.workerStation);
  const hasClawHalo = sensorHints.hasItemActive || sensorHints.heldColorActive;
  const hasStackTopSpotlight = spotlights.includes('depot-stack-top');
  const hasOutChuteSpotlight = spotlights.includes('depot-out-chute');
  const radarStation: DepotStationId | null = sensorHints.stationEmptyTarget
    ? sensorHints.stationEmptyTarget.toUpperCase() === 'CURRENT'
      ? state.workerStation
      : normalizeDepotStation(sensorHints.stationEmptyTarget)
    : null;

  const isInputStation = state.workerStation === 'INPUT';
  const isQueueStation = state.workerStation === 'QUEUE';
  const activeStationIdx = stationToIndex(state.workerStation);
  const craneLeftPct = computeCraneLeftPercent(state.workerStation, activeMask);

  const action = state.lastAction;
  const shouldAnimate =
    !isLowQuality && speed !== 'instant' && (speed as any) !== 0 && Boolean(action);
  const animDurationMs = computeDepotAnimDurationMs(speed, isLowQuality, Boolean(action));
  const stepKey = action ? `${action.stepId ?? state.stepCount}-${state.stepCount}` : 'idle';

  const isAnimMove = shouldAnimate && action?.type === 'MOVE';
  const isAnimGrab = shouldAnimate && action?.type === 'GRAB';
  const isAnimPlace = shouldAnimate && action?.type === 'PLACE';
  const isAnimSendOut = shouldAnimate && action?.type === 'SEND_OUT';
  const isAnimCollision = shouldAnimate && action?.type === 'COLLISION';

  const fromLeftPct = action ? computeCraneLeftPercent(action.fromStation, activeMask) : craneLeftPct;
  const moveDeltaPct = craneLeftPct - fromLeftPct;
  const moveDir = moveDeltaPct > 0.1 ? 1 : moveDeltaPct < -0.1 ? -1 : 0;

  const isInputGrabAnim = isAnimGrab && action?.fromStation === 'INPUT';
  const isInputArriveAnim = isAnimMove && action?.toStation === 'INPUT';
  const isQueueGrabAnim = isAnimGrab && action?.fromStation === 'QUEUE';
  const isQueuePlaceAnim = isAnimPlace && action?.toStation === 'QUEUE';
  const isQueueArriveAnim = isAnimMove && action?.toStation === 'QUEUE';
  const isOutFlyAnim =
    isAnimSendOut && showOut && action?.outputSlotIndex !== undefined && Boolean(action?.color);
  const isSkyChuteActive = hasOutChuteSpotlight || state.output.length > 0 || isOutFlyAnim;
  const isInputBarrierActive =
    (effectiveStatus === 'COLLISION' || state.status === 'COLLISION') &&
    state.lastFailureReason === 'INPUT_READ_ONLY';

  const { grabDistPx, grabDxPx, placeDistPx, placeDxPx } = React.useMemo(
    () => computeDepotStationTravelPx(action),
    [action]
  );
  const isQueuePlaceAction = action?.type === 'PLACE' && action?.toStation === 'QUEUE';
  const grabJawsY =
    action?.fromStation === 'QUEUE' || action?.fromStation === 'INPUT'
      ? Math.max(44, grabDistPx - 6)
      : grabDistPx;
  const grabSpringVars = React.useMemo(
    () => computeGrabSpringVars(grabJawsY, grabDxPx),
    [grabJawsY, grabDxPx]
  );
  const placeDipVars = React.useMemo(
    () => computePlaceDipVars(isQueuePlaceAction ? placeDxPx : 0),
    [isQueuePlaceAction, placeDxPx]
  );

  const stageRef = React.useRef<HTMLDivElement>(null);
  const trolleyRef = React.useRef<HTMLDivElement>(null);
  const flyingRingRef = React.useRef<HTMLDivElement>(null);

  useIsomorphicLayoutEffect(() => {
    const stageEl = stageRef.current;
    if (!stageEl || !shouldAnimate || !action) return;

    if (showQueue) {
      const slot0El = stageEl.querySelector<HTMLElement>('[data-depot-queue-slot="0"]');
      const slot1El = stageEl.querySelector<HTMLElement>('[data-depot-queue-slot="1"]');
      const slot7El = stageEl.querySelector<HTMLElement>('[data-depot-queue-slot="7"]');
      if (slot0El && slot7El) {
        const r0 = slot0El.getBoundingClientRect();
        const r7 = slot7El.getBoundingClientRect();
        const laneDx = Math.max(
          36,
          Math.round(r7.left + r7.width / 2 - (r0.left + r0.width / 2))
        );
        stageEl.style.setProperty('--depot-q-lane-dx', `${laneDx}px`);
        if (slot1El) {
          const r1 = slot1El.getBoundingClientRect();
          const rowStep = Math.max(
            18,
            Math.round(r1.top + r1.height / 2 - (r0.top + r0.height / 2))
          );
          stageEl.style.setProperty('--depot-q-row-step', `${rowStep}px`);
        }
      }
    }

    const trolleyEl = trolleyRef.current;
    if (!trolleyEl) return;

    const stageRect = stageEl.getBoundingClientRect();
    const trolleyRect = trolleyEl.getBoundingClientRect();
    if (stageRect.height <= 20 || trolleyRect.width <= 0) return;

    // Resting held-ring center sits ~45px below the un-animated trolley housing bottom.
    const jawsRestY = trolleyRect.bottom + 45;
    const craneCenterX = trolleyRect.left + trolleyRect.width / 2;

    if (action.type === 'GRAB') {
      let targetY: number | null = null;
      let targetDx = 0;
      if (action.fromStation === 'INPUT') {
        const slot0El = stageEl.querySelector<HTMLElement>('[data-depot-input-slot="0"]');
        if (slot0El) {
          const r = slot0El.getBoundingClientRect();
          targetY = r.top + r.height / 2;
        } else {
          const stationEl = stageEl.querySelector<HTMLElement>('[data-testid="depot-input-station"]');
          if (stationEl) {
            targetY = stationEl.getBoundingClientRect().top + 34;
          }
        }
      } else if (action.fromStation === 'QUEUE') {
        const slot0El = stageEl.querySelector<HTMLElement>('[data-depot-queue-slot="0"]');
        if (slot0El) {
          const r = slot0El.getBoundingClientRect();
          targetY = r.top + r.height / 2;
          targetDx = Math.round(r.left + r.width / 2 - craneCenterX);
        }
      } else {
        const slotIdx = action.stackSlotIndex ?? 0;
        const slotEl = stageEl.querySelector<HTMLElement>(
          `[data-depot-slot="${action.fromStation}-${slotIdx}"]`
        );
        if (slotEl) {
          const r = slotEl.getBoundingClientRect();
          targetY = r.top + r.height / 2;
        } else {
          const slot0 = stageEl.querySelector<HTMLElement>(`[data-depot-slot="${action.fromStation}-0"]`);
          const slot1 = stageEl.querySelector<HTMLElement>(`[data-depot-slot="${action.fromStation}-1"]`);
          if (slot0 && slot1) {
            const r0 = slot0.getBoundingClientRect();
            const r1 = slot1.getBoundingClientRect();
            const stepY = Math.max(24, r0.top - r1.top);
            targetY = r0.top + r0.height / 2 - slotIdx * stepY;
          }
        }
      }

      if (targetY !== null) {
        const minDy = action.fromStation === 'QUEUE' || action.fromStation === 'INPUT' ? 44 : 80;
        const dy = Math.max(minDy, Math.round(targetY - jawsRestY));
        const jawsY =
          action.fromStation === 'QUEUE' || action.fromStation === 'INPUT'
            ? Math.max(40, dy - 6)
            : dy;
        const vars = computeGrabSpringVars(jawsY, targetDx);
        stageEl.style.setProperty('--depot-grab-dist', `${dy}px`);
        stageEl.style.setProperty('--depot-grab-jaws-y', `${jawsY}px`);
        stageEl.style.setProperty('--depot-grab-x', `${targetDx}px`);
        stageEl.style.setProperty('--depot-grab-spring-14', vars.s14);
        stageEl.style.setProperty('--depot-grab-spring-28', vars.s28);
        stageEl.style.setProperty('--depot-grab-spring-max', vars.sMax);
        stageEl.style.setProperty('--depot-grab-spring-64', vars.s64);
        stageEl.style.setProperty('--depot-grab-spring-82', vars.s82);
        stageEl.style.setProperty('--depot-grab-skew-14', vars.k14);
        stageEl.style.setProperty('--depot-grab-skew-28', vars.k28);
        stageEl.style.setProperty('--depot-grab-skew-max', vars.kMax);
        stageEl.style.setProperty('--depot-grab-skew-64', vars.k64);
        stageEl.style.setProperty('--depot-grab-skew-82', vars.k82);
      }
    } else if (action.type === 'PLACE') {
      let targetY: number | null = null;
      let targetDx = 0;
      if (action.toStation === 'QUEUE') {
        const slot7El = stageEl.querySelector<HTMLElement>('[data-depot-queue-slot="7"]');
        if (slot7El) {
          const r = slot7El.getBoundingClientRect();
          targetY = r.top + r.height / 2;
          targetDx = Math.round(r.left + r.width / 2 - craneCenterX);
        }
      } else if (action.stackIndex !== undefined && action.stackSlotIndex !== undefined) {
        const crateEl = stageEl.querySelector<HTMLElement>(
          `[data-testid="depot-stack-${action.stackIndex + 1}-crate-${action.stackSlotIndex}"]`
        );
        if (crateEl) {
          const r = crateEl.getBoundingClientRect();
          targetY = r.top + r.height / 2;
        }
      }
      if (targetY !== null) {
        const minDy = action.toStation === 'QUEUE' ? 56 : 96;
        const dy = Math.max(minDy, Math.round(targetY - jawsRestY));
        const dipVars = computePlaceDipVars(action.toStation === 'QUEUE' ? targetDx : 0);
        stageEl.style.setProperty('--depot-place-dist', `${dy}px`);
        stageEl.style.setProperty('--depot-place-x', `${targetDx}px`);
        stageEl.style.setProperty('--depot-place-dip-x', `${dipVars.dipX}px`);
        stageEl.style.setProperty('--depot-place-skew-24', dipVars.k24);
        stageEl.style.setProperty('--depot-place-skew-42', dipVars.k42);
        stageEl.style.setProperty('--depot-place-skew-66', dipVars.k66);
        stageEl.style.setProperty('--depot-place-skew-82', dipVars.k82);
      }
    } else if (action.type === 'SEND_OUT' && action.outputSlotIndex !== undefined) {
      const flyEl = flyingRingRef.current;
      const outEl = stageEl.querySelector<HTMLElement>(
        `[data-testid="depot-output-slot-${action.outputSlotIndex}"]`
      );
      if (flyEl && outEl) {
        const outRect = outEl.getBoundingClientRect();
        const startX = Math.round(craneCenterX - stageRect.left);
        const startY = Math.round(jawsRestY - stageRect.top);
        const endX = Math.round(outRect.left + outRect.width / 2 - stageRect.left);
        const endY = Math.round(outRect.top + outRect.height / 2 - stageRect.top);
        flyEl.style.setProperty('--depot-fly-start-x', `${startX}px`);
        flyEl.style.setProperty('--depot-fly-start-y', `${startY}px`);
        flyEl.style.setProperty('--depot-fly-end-x', `${endX}px`);
        flyEl.style.setProperty('--depot-fly-end-y', `${endY}px`);
      }
    }
  }, [shouldAnimate, stepKey, action, craneLeftPct, activeMask, showOut, showQueue]);

  const stageTravelStyle = shouldAnimate
    ? ({
        '--depot-grab-dist': `${grabDistPx}px`,
        '--depot-grab-jaws-y': `${grabJawsY}px`,
        '--depot-grab-x': `${grabDxPx}px`,
        '--depot-grab-start-scale': action?.fromStation === 'QUEUE' ? '0.84' : '0.94',
        '--depot-grab-spring-14': grabSpringVars.s14,
        '--depot-grab-spring-28': grabSpringVars.s28,
        '--depot-grab-spring-max': grabSpringVars.sMax,
        '--depot-grab-spring-64': grabSpringVars.s64,
        '--depot-grab-spring-82': grabSpringVars.s82,
        '--depot-grab-skew-14': grabSpringVars.k14,
        '--depot-grab-skew-28': grabSpringVars.k28,
        '--depot-grab-skew-max': grabSpringVars.kMax,
        '--depot-grab-skew-64': grabSpringVars.k64,
        '--depot-grab-skew-82': grabSpringVars.k82,
        '--depot-place-dist': `${placeDistPx}px`,
        '--depot-place-x': `${placeDxPx}px`,
        '--depot-place-dip-x': `${placeDipVars.dipX}px`,
        '--depot-place-skew-24': placeDipVars.k24,
        '--depot-place-skew-42': placeDipVars.k42,
        '--depot-place-skew-66': placeDipVars.k66,
        '--depot-place-skew-82': placeDipVars.k82,
        '--depot-place-end-scale': action?.toStation === 'QUEUE' ? '0.84' : '1',
      } as React.CSSProperties)
    : undefined;

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
        animation: `depotSpringPlunge ${animDurationMs}ms linear both`,
      }
    : isAnimPlace
      ? {
          transformOrigin: 'top center',
          animation: `depotSpringDip ${animDurationMs}ms linear both`,
        }
      : undefined;

  const jawsContainerAnimationStyle: React.CSSProperties | undefined = isAnimGrab
    ? { animation: `depotJawsPlunge ${animDurationMs}ms linear both` }
    : isAnimPlace
      ? { animation: `depotJawsDip ${animDurationMs}ms linear both` }
      : isAnimSendOut
        ? { animation: `depotJawsRecoil ${animDurationMs}ms ease-out both` }
        : undefined;

  const leftJawAnimStyle: React.CSSProperties | undefined = isAnimGrab
    ? { transformOrigin: '27px 5px', animation: `depotJawLeftGrab ${animDurationMs}ms linear both` }
    : isAnimPlace
      ? { transformOrigin: '27px 5px', animation: `depotJawLeftRelease ${animDurationMs}ms ease-in-out both` }
      : isAnimSendOut
        ? { transformOrigin: '27px 5px', animation: `depotJawLeftFlick ${animDurationMs}ms ease-out both` }
        : undefined;

  const rightJawAnimStyle: React.CSSProperties | undefined = isAnimGrab
    ? { transformOrigin: '37px 5px', animation: `depotJawRightGrab ${animDurationMs}ms linear both` }
    : isAnimPlace
      ? { transformOrigin: '37px 5px', animation: `depotJawRightRelease ${animDurationMs}ms ease-in-out both` }
      : isAnimSendOut
        ? { transformOrigin: '37px 5px', animation: `depotJawRightFlick ${animDurationMs}ms ease-out both` }
        : undefined;

  const isCollision = effectiveStatus === 'COLLISION' || state.status === 'COLLISION';
  const isTypeError = effectiveStatus === 'TYPE_ERROR';
  const isSuccess = effectiveStatus === 'SUCCESS' || state.status === 'SUCCESS';
  const isBumperOob = isCollision && state.lastFailureReason === 'INVALID_STATION';

  const trolleyIndexValue: number | undefined = React.useMemo(() => {
    if (action?.attemptedStationIndex !== undefined) {
      return action.attemptedStationIndex;
    }
    if (sensorHints.moveVarName && effectiveVariables) {
      const v = effectiveVariables[sensorHints.moveVarName];
      if (typeof v === 'number' && Number.isFinite(v)) return v;
    }
    return undefined;
  }, [action?.attemptedStationIndex, sensorHints.moveVarName, effectiveVariables]);

  const comparisonBridge = React.useMemo(() => {
    if (!sensorHints.activeCmp || isTypeError || isCollision) return null;
    const left = resolveBridgeOperand(sensorHints.activeCmp.left, state, effectiveVariables);
    const right = resolveBridgeOperand(sensorHints.activeCmp.right, state, effectiveVariables);
    const matched = evalBridgeOp(sensorHints.activeCmp.op, left.rawVal, right.rawVal);
    return {
      op: sensorHints.activeCmp.op,
      left,
      right,
      matched,
    };
  }, [sensorHints.activeCmp, isTypeError, isCollision, state, effectiveVariables]);

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

      {/* Centered Status Overlay Pills (Collision / Type Error / Comparison Bridge / Victory) below Top HUD Clearance */}
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

      {isTypeError && (
        <div
          data-testid="depot-type-error-cue"
          aria-label="Type mismatch"
          className={`absolute ${hasMultiVariant ? 'top-14' : 'top-12'} left-1/2 -translate-x-1/2 z-30 px-3.5 py-1 bg-amber-500 text-slate-950 rounded-full font-black shadow-lg shadow-amber-500/35 border-2 border-white ${
            isLowQuality ? '' : 'animate-bounce '
          }flex items-center gap-1.5 pointer-events-none`}
        >
          <span className="text-sm leading-none">🎨 ↔ #</span>
          <span className="text-sm leading-none">∅</span>
        </div>
      )}

      {comparisonBridge && (
        <div
          data-testid="depot-comparison-bridge"
          className={`absolute ${hasMultiVariant ? 'top-14' : 'top-12'} left-1/2 -translate-x-1/2 z-30 px-3 py-1 rounded-full bg-white/95 border-2 ${
            comparisonBridge.matched === true
              ? 'border-emerald-400 shadow-[0_0_14px_rgba(16,185,129,0.4)]'
              : comparisonBridge.matched === false
                ? 'border-rose-400 shadow-[0_0_14px_rgba(244,63,94,0.35)]'
                : 'border-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.4)]'
          } flex items-center gap-1.5 text-xs font-black text-slate-800 pointer-events-none`}
        >
          <span className="px-1.5 py-0.5 rounded bg-sky-100 border border-sky-300 tabular-nums flex items-center gap-1">
            {comparisonBridge.left.colorHex ? (
              <span
                className="inline-block w-3 h-3 rounded-full border border-slate-500"
                style={{ backgroundColor: comparisonBridge.left.colorHex }}
              />
            ) : (
              comparisonBridge.left.label
            )}
          </span>
          <span className="text-sky-700 font-black">{comparisonBridge.op}</span>
          <span className="px-1.5 py-0.5 rounded bg-violet-100 border border-violet-300 tabular-nums flex items-center gap-1">
            {comparisonBridge.right.colorHex ? (
              <span
                className="inline-block w-3 h-3 rounded-full border border-slate-500"
                style={{ backgroundColor: comparisonBridge.right.colorHex }}
              />
            ) : (
              comparisonBridge.right.label
            )}
          </span>
          {comparisonBridge.matched !== null && (
            <span
              className={
                comparisonBridge.matched ? 'text-emerald-600' : 'text-rose-600'
              }
            >
              {comparisonBridge.matched ? '✓' : '✗'}
            </span>
          )}
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
      <div className="relative z-10 flex-1 min-h-0 flex items-end px-3 sm:px-5 pb-0 pt-1">
        <div
          ref={stageRef}
          className="depot-stage relative w-full h-full max-h-[336px] sm:max-h-[352px] min-w-0 flex items-stretch gap-3"
          style={stageTravelStyle}
        >
          {/* In-flight sky-chute ring overlay for SEND_OUT (omitted when !shouldAnimate) */}
          {isOutFlyAnim && action?.color && (
            <div
              ref={flyingRingRef}
              key={`fly-${stepKey}`}
              data-testid="depot-flying-ring"
              data-from-station={action.fromStation}
              data-crane-left-pct={craneLeftPct.toFixed(3)}
              data-output-slot={action.outputSlotIndex}
              aria-hidden="true"
              className="pointer-events-none absolute z-30"
              style={
                {
                  '--depot-fly-start-x': `calc((100% - var(--depot-out-w) - 12px) * ${(fromLeftPct / 100).toFixed(4)})`,
                  '--depot-fly-start-y': '64px',
                  '--depot-fly-end-x': 'calc(100% - var(--depot-out-w) / 2)',
                  '--depot-fly-end-y': `calc(100% - ${48 + Math.min(action.outputSlotIndex ?? 0, 4) * 26}px)`,
                  animation: `depotFlyRingX ${animDurationMs}ms cubic-bezier(0.25, 0.46, 0.45, 0.94) both, depotFlyRingY ${animDurationMs}ms ease-in-out both`,
                } as React.CSSProperties
              }
            >
              <RingToken
                color={action.color}
                value={action.value}
                enforceHanoiRule={Boolean(state.enforceHanoiRule)}
                damaged={action.damaged}
                isTop
              />
            </div>
          )}

          {/* Left/Main Gantry + Stations Area (STACK 1..3 + optional QUEUE) */}
          <div className="relative flex-1 min-w-0 flex flex-col">
            {/* Subtle vertical gantry support posts anchored to workbench */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-3 bottom-0 left-0.5 w-1.5 rounded-t bg-gradient-to-r from-slate-300/75 via-slate-100/85 to-slate-400/70 border-x border-slate-400/60 z-0"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-3 bottom-0 right-0.5 w-1.5 rounded-t bg-gradient-to-r from-slate-300/75 via-slate-100/85 to-slate-400/70 border-x border-slate-400/60 z-0"
            />
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
              {isBumperOob && (
                <div
                  data-testid="depot-bumper-collision"
                  className="absolute top-0 left-3 px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-xs font-black shadow border border-white z-40"
                >
                  💥
                </div>
              )}
              {/* Brushed Aluminum I-Beam Rail */}
              <div
                aria-hidden="true"
                className="absolute top-2.5 inset-x-2 h-3 rounded-full bg-gradient-to-b from-slate-200 via-slate-400 to-slate-500 border border-slate-500/80 shadow"
              />

              {/* Animated Trolley + Spring Cable + Articulated Mechanical Claw */}
              <div
                data-testid="depot-worker-crane"
                className="absolute top-0 -translate-x-1/2 flex flex-col items-center z-40"
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
                        key={isAnimMove && moveDir !== 0 ? `wheel-${wIdx}-${stepKey}` : `wheel-${wIdx}-idle`}
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
                <div
                  ref={trolleyRef}
                  className="w-11 h-5 rounded-lg bg-gradient-to-b from-sky-400 to-sky-600 border-2 border-white shadow-md flex items-center justify-center relative"
                >
                  <span className="w-2 h-2 rounded-full bg-slate-100 border border-slate-500/60" />
                  {trolleyIndexValue !== undefined && (
                    <span
                      data-testid="depot-trolley-index-pill"
                      className={`absolute -right-4 -top-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-black tabular-nums leading-none border border-white shadow ${
                        trolleyIndexValue >= 1 && trolleyIndexValue <= 3
                          ? 'bg-amber-400 text-slate-900'
                          : 'bg-rose-600 text-white'
                      }`}
                    >
                      [{trolleyIndexValue}]
                    </span>
                  )}
                </div>

                {/* Keyed Cable + Jaws + Held Crate Rig for per-step choreography */}
                <div
                  key={shouldAnimate && action ? `rig-${action.type}-${stepKey}` : 'rig-static'}
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
                      vectorEffect="non-scaling-stroke"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>

                  {/* Articulated Pincer Jaws + Full-Size Held / In-Flight Ring */}
                  <div
                    className="relative flex flex-col items-center"
                    style={jawsContainerAnimationStyle}
                  >
                    {/* Optical Sensor Beam Cone anchored at claw wrist LED */}
                    {isClawSensorBeamActive && (
                      <div
                        data-testid="depot-sensor-beam"
                        aria-hidden="true"
                        className={`pointer-events-none absolute top-[6px] left-1/2 z-0 bg-gradient-to-b from-cyan-400/65 via-cyan-300/30 to-transparent ${
                          state.heldCrate ? 'w-12 h-8' : 'w-14 h-20'
                        }`}
                        style={{
                          clipPath: 'polygon(42% 0%, 58% 0%, 100% 100%, 0% 100%)',
                          transformOrigin: 'top center',
                          transform:
                            !state.heldCrate && isQueueStation
                              ? 'translateX(-50%) skewX(-20deg)'
                              : 'translateX(-50%)',
                        }}
                      />
                    )}

                    {/* Jaws SVG */}
                    <svg
                      aria-hidden="true"
                      className="relative z-10 w-16 h-6 -mb-2 text-slate-700 drop-shadow-sm overflow-visible"
                      viewBox="0 0 64 24"
                      fill="none"
                    >
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
                      <rect
                        x="24"
                        y="0"
                        width="16"
                        height="7"
                        rx="3.5"
                        fill="#475569"
                        stroke="#1e293b"
                        strokeWidth="0.8"
                      />
                      <circle cx="32" cy="5.5" r="2.8" fill="#0f172a" stroke="#cbd5e1" strokeWidth="0.7" />
                      <circle
                        data-testid="depot-claw-sensor-led"
                        cx="32"
                        cy="5.5"
                        r="1.8"
                        fill={isClawSensorBeamActive ? '#22d3ee' : hasClawHalo ? '#fbbf24' : '#38bdf8'}
                      />
                    </svg>

                    {state.heldCrate ? (
                      <div
                        key={isAnimGrab ? `held-${stepKey}` : 'held-steady'}
                        data-testid="depot-claw-held-crate"
                        className="relative z-10"
                        style={
                          isAnimGrab
                            ? {
                                animation: `${
                                  action?.fromStation === 'QUEUE' || action?.fromStation === 'INPUT'
                                    ? 'depotHeldRingGrabLiftQueue'
                                    : 'depotHeldRingGrabLift'
                                } ${animDurationMs}ms linear both`,
                              }
                            : undefined
                        }
                      >
                        <RingToken
                          color={state.heldCrate}
                          value={state.heldValue}
                          enforceHanoiRule={Boolean(state.enforceHanoiRule)}
                          damaged={state.heldDamaged}
                          isTop
                        />
                      </div>
                    ) : isAnimPlace && action?.color ? (
                      <div
                        key={`inflight-place-${stepKey}`}
                        data-testid="depot-inflight-place-ring"
                        data-to-station={action.toStation}
                        className="relative z-10 pointer-events-none"
                        style={{
                          animation: `${
                            action.toStation === 'QUEUE'
                              ? 'depotPlaceQueueEntry'
                              : 'depotPlaceRingTravel'
                          } ${animDurationMs}ms linear both`,
                        }}
                      >
                        <RingToken
                          color={action.color}
                          value={action.value}
                          enforceHanoiRule={Boolean(state.enforceHanoiRule)}
                          damaged={action.damaged}
                          isTop
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-5 flex items-center justify-center pointer-events-none">
                        <span className="w-2 h-2 rounded-full border border-dashed border-slate-400/70" />
                      </div>
                    )}

                    {/* Claw Sensor Halo for hasItem / heldColor */}
                    {hasClawHalo && (
                      <div
                        data-testid="depot-claw-halo"
                        aria-hidden="true"
                        className="pointer-events-none absolute top-1 -bottom-1 -inset-x-1 rounded-full ring-2 ring-amber-400/90 shadow-[0_0_14px_rgba(245,158,11,0.55)] animate-pulse z-20"
                      />
                    )}

                    {/* Zero-Reading Failure Cue at Claw */}
                    {isCollision && state.lastFailureReason && (
                      <div
                        key={isAnimCollision ? `fail-${action?.stepId}` : 'fail-steady'}
                        data-testid="depot-failure-badge"
                        aria-label={state.lastFailureReason}
                        className="pointer-events-none absolute top-full mt-0.5 px-2 py-0.5 rounded-full bg-rose-600 text-white text-xs font-black shadow border border-white leading-none z-30"
                        style={
                          isAnimCollision
                            ? { animation: `depotBadgePop ${animDurationMs}ms ease-out both` }
                            : undefined
                        }
                      >
                        {getFailureCueSymbol(state.lastFailureReason)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Crane-Reachable Stations Row (Optional INPUT + Stacks 1..3 + Optional QUEUE) */}
            <div className="flex-1 min-h-0 flex items-end gap-2 sm:gap-3 pt-1">
              {/* Vertical Supply Dispenser Bay (INPUT, grab-only one-way station when INPUT bit active) */}
              {showInput && (
                <div
                  data-testid="depot-input-dispenser"
                  className="flex-1 min-w-0 h-full flex flex-col items-center justify-end relative"
                >
                  <div
                    data-testid="depot-input-station"
                    className={`relative w-full max-w-[116px] flex-1 max-h-[210px] min-h-[120px] rounded-t-2xl border-x-2 border-t-2 flex flex-col items-center justify-start gap-1.5 px-1.5 pt-5 pb-2.5 overflow-visible transition-all ${
                      isInputBarrierActive
                        ? 'border-rose-500 bg-rose-50/85 shadow-[0_0_18px_rgba(244,63,94,0.28)]'
                        : isInputStation
                          ? 'border-amber-400 bg-amber-50/85 shadow-[0_0_18px_rgba(245,158,11,0.28)]'
                          : 'border-slate-300/90 bg-white/60 shadow-inner'
                    }`}
                  >
                    {isInputArriveAnim && (
                      <div
                        key={`in-arrive-${stepKey}`}
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 rounded-t-2xl ring-2 ring-amber-400/85 z-30"
                        style={{
                          animation: `depotStationArrivePulse ${animDurationMs}ms ease-out both`,
                        }}
                      />
                    )}

                    {/* Top One-Way Pickup Mouth Header */}
                    <div
                      aria-hidden="true"
                      className="absolute top-0 inset-x-0 h-4 rounded-t-[14px] bg-gradient-to-b from-amber-200/90 to-amber-100/60 border-b border-amber-300/80 flex items-center justify-center text-[10px] font-black text-amber-800"
                    >
                      ▲
                    </div>

                    {/* Upward-Feed Guide Track */}
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute top-5 bottom-2 left-1/2 -translate-x-1/2 w-4 rounded-full border border-dashed border-amber-400/50 bg-amber-100/25"
                    />

                    {/* One-Way Drop Barrier Cue when placing onto INPUT fails */}
                    {isInputBarrierActive && (
                      <div
                        data-testid="depot-input-barrier"
                        aria-label="INPUT one-way guard"
                        className="absolute -top-3 left-1/2 -translate-x-1/2 z-30 px-2 py-0.5 rounded-full bg-rose-600 text-white text-xs font-black border-2 border-white shadow-md"
                        style={
                          isAnimCollision
                            ? { animation: `depotBadgePop ${animDurationMs}ms ease-out both` }
                            : undefined
                        }
                      >
                        ⛔
                      </div>
                    )}

                    {/* Station Empty Radar Spotlight */}
                    {radarStation === 'INPUT' && (
                      <div
                        data-testid="depot-radar-spotlight"
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-1 rounded-xl border-2 border-dashed border-cyan-500/85 flex items-center justify-center z-30"
                        style={{ animation: 'depotRadarPulse 1s ease-in-out infinite' }}
                      >
                        <span className="px-1.5 py-0.5 rounded-full bg-cyan-500 text-white text-xs font-black shadow">
                          ∅
                        </span>
                      </div>
                    )}

                    {(state.input ?? []).length === 0 ? (
                      <div
                        data-depot-input-slot="0"
                        className="relative w-full flex items-center justify-center rounded-full border border-dashed border-amber-300/75 bg-amber-50/45 py-1 px-1 z-10"
                      >
                        <div
                          data-testid="depot-input-empty"
                          className="w-full text-center text-xs font-black text-slate-400 leading-none"
                        >
                          ∅
                        </div>
                      </div>
                    ) : (
                      (state.input ?? []).map((item, iIdx) => {
                        const isFrontCradle = iIdx === 0;
                        return (
                          <div
                            key={`in-slot-${iIdx}`}
                            data-depot-input-slot={iIdx}
                            className={`relative w-full flex items-center justify-center z-10 ${
                              isFrontCradle
                                ? 'rounded-full ring-2 ring-amber-400/80 bg-amber-100/60 py-0.5 px-1'
                                : ''
                            }`}
                          >
                            {isFrontCradle && (
                              <span
                                aria-hidden="true"
                                className="absolute -right-1 top-1/2 -translate-y-1/2 text-[9px] font-black text-amber-600 select-none"
                              >
                                ▲
                              </span>
                            )}
                            <div
                              key={
                                isInputGrabAnim
                                  ? `in-shift-${stepKey}-${iIdx}`
                                  : `in-item-${iIdx}`
                              }
                              data-testid={`depot-input-crate-${iIdx}`}
                              className="relative flex items-center justify-center"
                              style={
                                isInputGrabAnim
                                  ? {
                                      animation: `depotInputAdvanceUp ${animDurationMs}ms cubic-bezier(0.22, 1, 0.36, 1) both`,
                                    }
                                  : undefined
                              }
                            >
                              <RingToken
                                color={item.color}
                                value={item.value}
                                enforceHanoiRule={Boolean(state.enforceHanoiRule)}
                                damaged={item.damaged}
                                isTop={isFrontCradle}
                                isDimmed={!isFrontCradle}
                                compact
                              />
                              {isFrontCradle && sensorTargetStation === 'INPUT' && (
                                <div
                                  data-testid={!isClawSensorBeamActive ? 'depot-sensor-beam' : undefined}
                                  aria-hidden="true"
                                  className="pointer-events-none absolute -inset-1 rounded-full ring-2 ring-cyan-400 bg-cyan-300/20 shadow-[0_0_12px_rgba(34,211,238,0.55)] animate-pulse"
                                />
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}

                    {/* Translucent Acrylic Front Sheen */}
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 rounded-t-[14px] overflow-hidden pointer-events-none z-20"
                      style={{
                        background:
                          'linear-gradient(125deg, transparent 22%, rgba(255,255,255,0.42) 26%, rgba(255,255,255,0.08) 31%, transparent 34%, transparent 62%, rgba(255,255,255,0.34) 66%, transparent 72%)',
                      }}
                    />
                  </div>

                  {/* INPUT Pedestal Badge */}
                  <div
                    className={`w-full max-w-[116px] flex items-center justify-center gap-1 py-1 px-2 rounded-b-lg border-x border-b font-black text-xs shadow-sm transition-colors ${
                      isInputStation
                        ? 'bg-amber-500 text-white border-amber-600'
                        : 'bg-white/95 text-slate-700 border-slate-300'
                    }`}
                  >
                    <span>▲</span>
                    <span>IN</span>
                  </div>
                </div>
              )}

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
                const stackVals = state.stackValues?.[idx];
                const targetStackVals = state.targetStackValues?.[idx];
                const isStationActive = !isQueueStation && !isInputStation && activeStationIdx === idx;
                const isArriveTarget = isAnimMove && action?.toStation === stationId;
                const topIndex = stack.length - 1;
                const isStackMatched = Boolean(
                  targetStack &&
                    targetStack.length === stack.length &&
                    targetStack.every(
                      (c, cIdx) =>
                        c === stack[cIdx] &&
                        (targetStackVals?.[cIdx] === undefined ||
                          stackVals?.[cIdx] === targetStackVals[cIdx])
                    )
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
                          key={`arrive-${stepKey}`}
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 rounded-t-2xl ring-2 ring-sky-400/85 z-30"
                          style={{
                            animation: `depotStationArrivePulse ${animDurationMs}ms ease-out both`,
                          }}
                        />
                      )}

                      {radarStation === stationId && (
                        <div
                          data-testid="depot-radar-spotlight"
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-1 rounded-xl border-2 border-dashed border-cyan-500/85 flex items-center justify-center z-30"
                          style={{ animation: 'depotRadarPulse 1s ease-in-out infinite' }}
                        >
                          <span className="px-1.5 py-0.5 rounded-full bg-cyan-500 text-white text-xs font-black shadow">
                            ∅
                          </span>
                        </div>
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

                      {/* Stacked Rings + High-Contrast Dashed Ghost Blueprints */}
                      {Array.from({ length: maxSlots }).map((_, slotIdx) => {
                        const liveColor = stack[slotIdx];
                        const liveValue = state.stackValues?.[idx]?.[slotIdx];
                        const ghostColor = targetStack?.[slotIdx];
                        const ghostValue = state.targetStackValues?.[idx]?.[slotIdx];
                        const isTop = slotIdx === topIndex && liveColor !== undefined;
                        const isDimmed = liveColor !== undefined && !isTop;
                        const slotMatched =
                          liveColor !== undefined &&
                          ghostColor !== undefined &&
                          liveColor === ghostColor &&
                          (ghostValue === undefined || liveValue === ghostValue);
                        const isNewlyPlacedHere =
                          isAnimPlace &&
                          action?.toStation !== 'QUEUE' &&
                          action?.stackIndex === idx &&
                          action?.stackSlotIndex === slotIdx;

                        return (
                          <div
                            key={slotIdx}
                            data-depot-slot={`${stationId}-${slotIdx}`}
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
                              <div
                                data-testid={`depot-stack-${idx + 1}-crate-${slotIdx}`}
                                className="relative"
                              >
                                <div
                                  key={
                                    isNewlyPlacedHere
                                      ? `stack-place-${stepKey}`
                                      : `stack-slot-${slotIdx}`
                                  }
                                  style={
                                    isNewlyPlacedHere
                                      ? {
                                          animation: `depotStackRingDrop ${animDurationMs}ms ease-out both`,
                                        }
                                      : undefined
                                  }
                                >
                                  <RingToken
                                    color={liveColor}
                                    value={liveValue}
                                    enforceHanoiRule={Boolean(state.enforceHanoiRule)}
                                    isTop={isTop}
                                    isDimmed={isDimmed}
                                    isMatched={slotMatched && isStackMatched}
                                  />
                                </div>
                                {isTop && sensorTargetStation === stationId && (
                                  <div
                                    data-testid={!isClawSensorBeamActive ? 'depot-sensor-beam' : undefined}
                                    aria-hidden="true"
                                    className="pointer-events-none absolute -inset-1 rounded-full ring-2 ring-cyan-400 bg-cyan-300/20 shadow-[0_0_12px_rgba(34,211,238,0.55)] animate-pulse"
                                  />
                                )}
                              </div>
                            ) : ghostColor ? (
                              <div data-testid={`depot-stack-${idx + 1}-ghost-${slotIdx}`}>
                                <RingToken
                                  color={ghostColor}
                                  value={ghostValue}
                                  enforceHanoiRule={Boolean(state.enforceHanoiRule)}
                                  isGhost
                                />
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

              {/* Upright 8-Slot U-Shaped FIFO Conveyor Belt (QUEUE, only shown when QUEUE bit active) */}
              {showQueue && (() => {
                const isQueueBeltMoving = isQueueGrabAnim || isQueuePlaceAnim;
                const renderQueueSlot = (slotIdx: number) => {
                  const isPickupCradle = slotIdx === 0;
                  const isEntryMouth = slotIdx === 7;
                  const item = state.queue[slotIdx];
                  const isNewlyPlacedHere = isQueuePlaceAnim && action?.queueIndex === slotIdx;

                  const advanceAnimName = isQueueGrabAnim
                    ? slotIdx <= 2
                      ? 'depotQueueAdvanceUp'
                      : slotIdx === 3
                        ? 'depotQueueAdvanceTurn'
                        : 'depotQueueAdvanceDown'
                    : null;

                  const placeAnimStyle: React.CSSProperties | undefined = isNewlyPlacedHere
                    ? slotIdx === 7
                      ? {
                          animation: `depotQueueRingDrop ${animDurationMs}ms ease-out both`,
                        }
                      : slotIdx >= 4
                        ? ({
                            '--depot-q-ride-start-y': `calc(${-(7 - slotIdx)} * var(--depot-q-row-step, 24px))`,
                            animation: `depotQueuePlaceRideRight ${animDurationMs}ms linear both`,
                          } as React.CSSProperties)
                        : ({
                            '--depot-q-ride-start-y': `calc(${-slotIdx} * var(--depot-q-row-step, 24px))`,
                            '--depot-q-ride-bottom-y': `calc(${3 - slotIdx} * var(--depot-q-row-step, 24px))`,
                            animation: `depotQueuePlaceRideAroundU ${animDurationMs}ms linear both`,
                          } as React.CSSProperties)
                    : undefined;

                  return (
                    <div
                      key={slotIdx}
                      data-depot-queue-slot={slotIdx}
                      data-depot-queue-entry={isEntryMouth ? 'true' : undefined}
                      className={`relative flex items-center justify-center min-h-[20px] sm:min-h-[24px] ${
                        isPickupCradle
                          ? 'rounded-full ring-2 ring-emerald-400/80 bg-emerald-100/55 py-0.5 px-0.5'
                          : isEntryMouth
                            ? 'rounded-full border border-sky-300/75 bg-sky-50/45 py-0.5 px-0.5'
                            : ''
                      } ${isNewlyPlacedHere ? 'z-30' : 'z-10'}`}
                    >
                      {item ? (
                        <div
                          key={
                            isQueueGrabAnim
                              ? `q-shift-${stepKey}-${slotIdx}`
                              : `q-item-${slotIdx}`
                          }
                          data-testid={`depot-queue-crate-${slotIdx}`}
                          className="relative"
                          style={
                            advanceAnimName
                              ? {
                                  animation: `${advanceAnimName} ${animDurationMs}ms cubic-bezier(0.22, 1, 0.36, 1) both`,
                                }
                              : undefined
                          }
                        >
                          <div
                            key={
                              isNewlyPlacedHere
                                ? `q-drop-${stepKey}`
                                : `q-token-${slotIdx}`
                            }
                            style={placeAnimStyle}
                          >
                            <RingToken
                              color={item.color}
                              value={item.value}
                              enforceHanoiRule={Boolean(state.enforceHanoiRule)}
                              damaged={item.damaged}
                              isTop={isPickupCradle}
                              isDimmed={!isPickupCradle}
                              queueBelt
                            />
                          </div>
                          {isPickupCradle && sensorTargetStation === 'QUEUE' && (
                            <div
                              data-testid={!isClawSensorBeamActive ? 'depot-sensor-beam' : undefined}
                              aria-hidden="true"
                              className="pointer-events-none absolute -inset-1 rounded-full ring-2 ring-cyan-400 bg-cyan-300/20 shadow-[0_0_12px_rgba(34,211,238,0.55)] animate-pulse"
                            />
                          )}
                        </div>
                      ) : isPickupCradle && state.queue.length === 0 ? (
                        <div
                          data-testid="depot-queue-empty"
                          className="w-9 h-4 sm:w-11 sm:h-5 flex items-center justify-center text-xs font-black text-slate-400 leading-none"
                        >
                          ∅
                        </div>
                      ) : (
                        <div
                          aria-hidden="true"
                          className="w-9 h-4 sm:w-11 sm:h-5 rounded-full border border-dashed border-slate-400/45 bg-white/30 pointer-events-none"
                        />
                      )}
                    </div>
                  );
                };

                return (
                  <div
                    data-testid="depot-queue-belt"
                    className="flex-[1.5] min-w-[92px] sm:min-w-[144px] h-full flex flex-col items-center justify-end relative"
                  >
                    <div
                      data-testid="depot-queue-station"
                      className={`relative w-full max-w-[200px] flex-1 max-h-[210px] min-h-[128px] rounded-t-2xl border-x-2 border-t-2 px-1.5 sm:px-2.5 pt-1.5 pb-1.5 flex flex-col justify-between gap-1 overflow-visible transition-all ${
                        isQueueStation
                          ? 'bg-emerald-50/90 border-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.22)]'
                          : 'bg-white/65 border-slate-300/90 shadow-inner'
                      }`}
                    >
                      {isQueueArriveAnim && (
                        <div
                          key={`q-arrive-${stepKey}`}
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 rounded-t-2xl ring-2 ring-emerald-400/85 z-30"
                          style={{
                            animation: `depotStationArrivePulse ${animDurationMs}ms ease-out both`,
                          }}
                        />
                      )}

                      {radarStation === 'QUEUE' && (
                        <div
                          data-testid="depot-radar-spotlight"
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-1 rounded-xl border-2 border-dashed border-cyan-500/85 flex items-center justify-center z-30"
                          style={{ animation: 'depotRadarPulse 1s ease-in-out infinite' }}
                        >
                          <span className="px-1.5 py-0.5 rounded-full bg-cyan-500 text-white text-xs font-black shadow">
                            ∅
                          </span>
                        </div>
                      )}

                      {/* U-Belt Mouth Headers: Left Pickup Cradle (▲) | Right Entry Funnel (⬇) */}
                      <div className="relative z-20 flex items-center justify-between px-0.5 text-[10px] font-black">
                        <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 leading-none">
                          ▲
                        </span>
                        <span
                          aria-hidden="true"
                          className="text-slate-400 text-[10px] leading-none"
                        >
                          ↺
                        </span>
                        <span
                          key={isQueuePlaceAnim ? `q-funnel-${stepKey}` : 'q-funnel-idle'}
                          className="px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-300 leading-none"
                          style={
                            isQueuePlaceAnim
                              ? {
                                  animation: `depotFunnelPulse ${animDurationMs}ms ease-out both`,
                                }
                              : undefined
                          }
                        >
                          ⬇
                        </span>
                      </div>

                      {/* Continuous 8-Slot U-Shaped Conveyor Track (Right 7..4 ▼ -> Bottom Turn ◀ -> Left 3..0 ▲) */}
                      <div
                        data-depot-queue-belt="true"
                        className="relative flex-1 min-h-0 flex flex-col justify-between pt-0.5 pb-4"
                      >
                        {/* SVG U-Track Rail & Animated Tread */}
                        <svg
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 w-full h-full"
                          viewBox="0 0 120 132"
                          preserveAspectRatio="none"
                          fill="none"
                        >
                          <path
                            d="M 92 4 L 92 98 A 32 24 0 0 1 28 98 L 28 4"
                            stroke="#94a3b8"
                            strokeOpacity="0.48"
                            strokeWidth="44"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M 92 4 L 92 98 A 32 24 0 0 1 28 98 L 28 4"
                            stroke="#dbe4ee"
                            strokeWidth="38"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            key={isQueueBeltMoving ? `q-tread-${stepKey}` : 'q-tread-idle'}
                            d="M 92 4 L 92 98 A 32 24 0 0 1 28 98 L 28 4"
                            stroke="#64748b"
                            strokeOpacity="0.45"
                            strokeWidth="2.5"
                            strokeDasharray="6 6"
                            strokeLinecap="round"
                            style={
                              isQueueBeltMoving
                                ? {
                                    animation: `depotUBeltTread ${animDurationMs}ms linear both`,
                                  }
                                : undefined
                            }
                          />
                        </svg>

                        {/* Center Divider Island separating Left Pickup & Right Entry Lanes */}
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute top-0.5 bottom-6 left-1/2 -translate-x-1/2 w-1.5 sm:w-2.5 rounded-full bg-white/85 border border-slate-300/90 shadow-xs z-10"
                        />

                        {/* 4 Rows x 2 Lanes (Left 0..3 ▲, Right 7..4 ▼) */}
                        <div className="relative z-20 flex-1 flex flex-col justify-between gap-0.5">
                          {[0, 1, 2, 3].map((rowIdx) => (
                            <div
                              key={rowIdx}
                              className="grid grid-cols-2 gap-1.5 sm:gap-2.5 items-center"
                            >
                              {renderQueueSlot(rowIdx)}
                              {renderQueueSlot(7 - rowIdx)}
                            </div>
                          ))}
                        </div>

                        {/* Bottom U-Turn Spoked Rollers */}
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute bottom-0 inset-x-2 flex items-center justify-center gap-1.5 text-[10px] font-bold text-slate-600 z-20"
                        >
                          {[0, 1].map((rIdx) => (
                            <React.Fragment key={rIdx}>
                              <span
                                key={isQueueBeltMoving ? `roller-${rIdx}-${stepKey}` : `roller-${rIdx}`}
                                className="inline-block leading-none"
                                style={
                                  isQueueBeltMoving
                                    ? {
                                        animation: `depotRollerSpin ${animDurationMs}ms linear both`,
                                      }
                                    : undefined
                                }
                              >
                                ⊙
                              </span>
                              {rIdx === 0 && (
                                <span className="text-[9px] text-slate-500 leading-none">◀</span>
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`w-full max-w-[200px] py-1 px-2 rounded-b-lg border-x border-b text-center font-black text-xs shadow-sm ${
                        isQueueStation
                          ? 'bg-emerald-500 text-white border-emerald-600'
                          : 'bg-white/95 text-slate-700 border-slate-300'
                      }`}
                    >
                      ↺ FIFO
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Right Side Delivery Zone: Curved Overhead Sky-Chute + OUT Bay (only when OUT bit active) */}
          {showOut && (
            <div className="w-[108px] sm:w-[144px] flex-shrink-0 flex flex-col justify-end relative">
              {/* Curved Overhead Translucent Sky-Chute SVG feeding OUT Tray */}
              <svg
                key={isOutFlyAnim ? `skychute-${stepKey}` : 'skychute-idle'}
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
                className={`w-full max-h-[210px] overflow-hidden rounded-t-2xl border-2 p-2 flex flex-col items-center gap-1.5 transition-all ${
                  isSkyChuteActive
                    ? 'bg-violet-50/90 border-violet-400 shadow-[0_0_14px_rgba(139,92,246,0.2)]'
                    : 'bg-white/65 border-slate-300/90 shadow-inner'
                }`}
              >
                <div className="flex flex-col-reverse items-center gap-1.5 w-full min-h-[92px] justify-start">
                  {Array.from({ length: totalOutputSlots }).map((_, slotIdx) => {
                    const delivered = state.output[slotIdx];
                    const expected = outputGoal[slotIdx];
                    const deliveredVal = state.outputValues?.[slotIdx];
                    const expectedVal = state.targetOutputValues?.[slotIdx];
                    const matched = Boolean(
                      delivered &&
                        expected &&
                        delivered === expected &&
                        (expectedVal === undefined || deliveredVal === expectedVal)
                    );
                    const isLandingHere = isOutFlyAnim && action?.outputSlotIndex === slotIdx;

                    return (
                      <div
                        key={slotIdx}
                        data-testid={`depot-output-slot-${slotIdx}`}
                        className="flex items-center justify-center"
                      >
                        {delivered ? (
                          <div
                            key={isLandingHere ? `out-land-${stepKey}` : `out-slot-${slotIdx}`}
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
                              value={state.outputValues?.[slotIdx]}
                              enforceHanoiRule={Boolean(state.enforceHanoiRule)}
                              isMatched={matched}
                              compact
                            />
                          </div>
                        ) : expected ? (
                          <RingToken
                            color={expected}
                            value={state.targetOutputValues?.[slotIdx]}
                            enforceHanoiRule={Boolean(state.enforceHanoiRule)}
                            isGhost
                            compact
                          />
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
