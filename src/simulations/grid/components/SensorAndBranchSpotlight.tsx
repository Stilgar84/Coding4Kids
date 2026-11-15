import React from 'react';
import { ArrowRight, CornerDownRight, ArrowDown } from 'lucide-react';
import type { ConditionExpr } from '../../../data/curriculum/types';
import {
  CodeBlock,
  Direction,
  GridState,
  InterpreterRuntimeState,
  WorkspaceState,
} from '../../../types';
import { evaluateConditionExpr } from '../../../engine/serialization/conditionSerializer';
import { useAppStoreSelector } from '../../../store/useAppStore';
import {
  cellAhead,
  cellLeft,
  cellRight,
  evaluateGridSensor,
  hasAheadBridgedPlank,
  resolveBeaconColorHex,
  resolveTileColorIdx,
} from '../sensors';
import { GRID_CELL_SIZE } from './GridOverlayLayer';

// ─── Helpers for Grid Sensor Target Coordinate ──────────────────────────────

export interface ExtractedSensorRef {
  sensor: string;
  param?: string;
}

export function extractConditionSensors(
  condition?: ConditionExpr | { kind?: string; sensor?: string; param?: string } | null,
  fallbackSensor?: string,
  fallbackParam?: string
): ExtractedSensorRef[] {
  const seen = new Set<string>();
  const refs: ExtractedSensorRef[] = [];

  const pushUnique = (sensor?: string, param?: string) => {
    if (!sensor || sensor === '$input') return;
    const key = `${sensor}:${param ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    refs.push(param !== undefined ? { sensor, param } : { sensor });
  };

  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;
    if (obj.kind === 'sensor' && typeof obj.sensor === 'string') {
      pushUnique(obj.sensor, typeof obj.param === 'string' ? obj.param : undefined);
      return;
    }
    if (obj.kind === 'not') {
      walk(obj.operand);
      return;
    }
    if (obj.kind === 'and' || obj.kind === 'or') {
      walk(obj.left);
      walk(obj.right);
    }
  };

  if (condition && typeof condition === 'object') {
    walk(condition);
    if (refs.length === 0 && typeof (condition as { sensor?: unknown }).sensor === 'string') {
      const c = condition as { sensor: string; param?: string };
      pushUnique(c.sensor, c.param);
    }
  }

  if (refs.length === 0 && fallbackSensor) {
    pushUnique(fallbackSensor, fallbackParam);
  }

  return refs;
}

export function getScannedCellCoord(
  robot: { x: number; y: number; dir: Direction },
  sensorType?: string,
  grid?: GridState
): { x: number; y: number } {
  const { x, y, dir } = robot;
  switch (sensorType) {
    case 'pathAhead':
    case 'unvisitedAhead': {
      switch (dir) {
        case 'NORTH': return { x, y: y - 1 };
        case 'SOUTH': return { x, y: y + 1 };
        case 'EAST':  return { x: x + 1, y };
        case 'WEST':  return { x: x - 1, y };
      }
    }
    case 'pathLeft': {
      switch (dir) {
        case 'NORTH': return { x: x - 1, y };
        case 'SOUTH': return { x: x + 1, y };
        case 'EAST':  return { x, y: y - 1 };
        case 'WEST':  return { x, y: y + 1 };
      }
    }
    case 'pathRight': {
      switch (dir) {
        case 'NORTH': return { x: x + 1, y };
        case 'SOUTH': return { x: x - 1, y };
        case 'EAST':  return { x, y: y + 1 };
        case 'WEST':  return { x, y: y - 1 };
      }
    }
    case 'itemHere': {
      if (grid) {
        const hasFloorItem = (grid.worldItems ?? []).some((it) => it.x === x && it.y === y);
        if (!hasFloorItem && hasAheadBridgedPlank(grid)) {
          return cellAhead(grid);
        }
      }
      return { x, y };
    }
    case 'tileColor':
    case 'carryingItem':
    case 'atGoal':
    default:
      return { x, y };
  }
}

// ─── 1. Sensor-Beam Grid Overlay ────────────────────────────────────────────

export interface SensorBeamGridOverlayProps {
  grid: GridState;
  cellSize?: number;
  runtime?: InterpreterRuntimeState | null;
  workspace?: WorkspaceState;
}

const COND_BLOCK_TYPES = new Set(['IF', 'ELSE_IF', 'WHILE']);

export function resolveActiveConditionalBlock(
  runtime?: InterpreterRuntimeState | null,
  workspace?: WorkspaceState
): CodeBlock | null {
  const currentScope = runtime?.activeScope ?? 'MAIN';
  const scopeBlocks: CodeBlock[] = workspace?.[currentScope] ?? [];

  const activeBlock = runtime?.activeBlockId
    ? scopeBlocks.find((b) => b.id === runtime.activeBlockId) ?? null
    : null;
  if (activeBlock && COND_BLOCK_TYPES.has(activeBlock.type)) {
    return activeBlock;
  }

  const topFrame =
    runtime?.callStack && runtime.callStack.length > 0
      ? runtime.callStack[runtime.callStack.length - 1]
      : null;
  if (topFrame) {
    const frameBlocks = workspace?.[topFrame.scope] ?? [];
    const pendingBlock = frameBlocks[topFrame.pc] ?? null;
    if (pendingBlock && COND_BLOCK_TYPES.has(pendingBlock.type)) {
      return pendingBlock;
    }
  }

  if (runtime === null || runtime === undefined) {
    const firstBlock = scopeBlocks[0] ?? null;
    if (firstBlock && COND_BLOCK_TYPES.has(firstBlock.type)) {
      return firstBlock;
    }
    for (const sc of ['MAIN', 'F1', 'F2', 'F3'] as const) {
      const found = (workspace?.[sc] ?? []).find((b) => COND_BLOCK_TYPES.has(b.type));
      if (found) return found;
    }
  }

  return null;
}

export const SensorBeamGridOverlay: React.FC<SensorBeamGridOverlayProps> = ({
  grid,
  cellSize = GRID_CELL_SIZE,
  runtime,
  workspace,
}) => {
  const { robot } = grid;
  const currentScope = runtime?.activeScope ?? 'MAIN';
  const scopeBlocks: CodeBlock[] = workspace?.[currentScope] ?? [];

  const activeBlock = runtime?.activeBlockId
    ? scopeBlocks.find((b) => b.id === runtime.activeBlockId)
    : null;
  const pendingBlock =
    runtime && runtime.callStack.length > 0
      ? scopeBlocks[runtime.callStack[runtime.callStack.length - 1].pc]
      : scopeBlocks[0];

  const cueBlock = resolveActiveConditionalBlock(runtime, workspace) ?? activeBlock ?? pendingBlock;
  const condition = cueBlock?.params?.condition as
    | ConditionExpr
    | { kind?: string; sensor?: string; param?: string }
    | undefined;
  const sensorRefs = extractConditionSensors(
    condition,
    (cueBlock?.params?.sensor as string | undefined) ?? 'itemHere',
    cueBlock?.params?.param as string | undefined
  );
  const primaryRef = sensorRefs[0] ?? { sensor: 'itemHere' };
  const sensorType = primaryRef.sensor;

  // Evaluate exact sensor / compound ConditionExpr result via Grid sensors (single source of truth)
  let sensorResult: boolean | null = null;
  if (cueBlock && COND_BLOCK_TYPES.has(cueBlock.type)) {
    const evalSensorFn = (s: string, st: GridState, p?: string) => evaluateGridSensor(s, st, p);
    if (condition && typeof condition === 'object' && 'kind' in condition && condition.kind) {
      sensorResult = evaluateConditionExpr(condition as ConditionExpr, grid, evalSensorFn, {
        variables: runtime?.variables,
        sceneInput: runtime?.sceneInput,
      });
    } else {
      sensorResult = evaluateGridSensor(sensorType, grid, primaryRef.param);
    }
  }

  const robotX = robot.x * cellSize + cellSize / 2;
  const robotY = robot.y * cellSize + cellSize / 2;
  const scannedCoord = getScannedCellCoord(robot, sensorType, grid);
  const targetX = scannedCoord.x * cellSize + cellSize / 2;
  const targetY = scannedCoord.y * cellSize + cellSize / 2;
  const isAhead = scannedCoord.x !== robot.x || scannedCoord.y !== robot.y;

  const tileColorRef = sensorRefs.find((r) => r.sensor === 'tileColor');
  const tileColorMatch = tileColorRef
    ? evaluateGridSensor('tileColor', grid, tileColorRef.param)
    : false;
  const tileColorIdx = tileColorRef ? resolveTileColorIdx('tileColor', tileColorRef.param) : 0;
  const tileColorHex = resolveBeaconColorHex(tileColorIdx) ?? '#38bdf8';
  const currentBeacon = (grid.beaconTiles ?? []).find(
    (b) => b.x === robot.x && b.y === robot.y
  );

  const hasFloorItemAtRobot = (grid.worldItems ?? []).some(
    (it) => it.x === robot.x && it.y === robot.y
  );
  const scanningAheadPlank =
    sensorRefs.some((r) => r.sensor === 'itemHere') &&
    !hasFloorItemAtRobot &&
    hasAheadBridgedPlank(grid);
  const aheadPlankCoord = scanningAheadPlank ? cellAhead(grid) : null;

  // Primary beam color reflects directional truth or target color cleanly
  const primarySingleEval = evaluateGridSensor(sensorType, grid, primaryRef.param);
  const primaryBeamColor =
    sensorType === 'tileColor'
      ? tileColorHex
      : primarySingleEval
      ? '#10b981'
      : '#ef4444';

  const secondaryDirections = sensorRefs.filter(
    (r, idx) =>
      idx > 0 &&
      (r.sensor === 'pathAhead' ||
        r.sensor === 'pathLeft' ||
        r.sensor === 'pathRight' ||
        r.sensor === 'unvisitedAhead')
  );

  return (
    <g
      data-testid="sensor-beam-spotlight"
      data-sensor-type={sensorType}
      data-sensor-result={sensorResult === null ? 'none' : sensorResult ? 'true' : 'false'}
      className="pointer-events-none select-none transition-all duration-200"
    >
      <defs>
        <radialGradient id="sensor-beam-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.6" />
          <stop offset="70%" stopColor="#0284c7" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
        </radialGradient>
        <filter id="sensor-beam-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* Sensor Beam Line / Cone for directional or 1-ahead Plank scan */}
      {isAhead && !scanningAheadPlank && (
        <>
          <line
            x1={robotX}
            y1={robotY}
            x2={targetX}
            y2={targetY}
            stroke={primaryBeamColor}
            strokeWidth={4}
            strokeDasharray="4 3"
            opacity={0.85}
            className="animate-pulse"
          />
          <circle
            cx={targetX}
            cy={targetY}
            r={cellSize * 0.42}
            fill="url(#sensor-beam-glow)"
            stroke={primaryBeamColor}
            strokeWidth={2.2}
            strokeDasharray="3 3"
          />
        </>
      )}

      {/* Additional directional scan beams in compound AND / OR conditions */}
      {secondaryDirections.map((ref) => {
        const coord =
          ref.sensor === 'pathLeft'
            ? cellLeft(grid)
            : ref.sensor === 'pathRight'
            ? cellRight(grid)
            : cellAhead(grid);
        const sx = coord.x * cellSize + cellSize / 2;
        const sy = coord.y * cellSize + cellSize / 2;
        const ok = evaluateGridSensor(ref.sensor, grid, ref.param);
        const col = ok ? '#10b981' : '#ef4444';
        return (
          <g key={`${ref.sensor}-${coord.x}-${coord.y}`}>
            <line
              x1={robotX}
              y1={robotY}
              x2={sx}
              y2={sy}
              stroke={col}
              strokeWidth={3}
              strokeDasharray="4 3"
              opacity={0.78}
            />
            <circle
              cx={sx}
              cy={sy}
              r={cellSize * 0.34}
              fill="none"
              stroke={col}
              strokeWidth={2}
              strokeDasharray="3 3"
            />
          </g>
        );
      })}

      {/* 1-Ahead Bridged Plank Sparkle Scan Beam on `itemHere` */}
      {scanningAheadPlank && aheadPlankCoord && (
        <g data-testid="sensor-plank-ahead-beam">
          {(() => {
            const px = aheadPlankCoord.x * cellSize + cellSize / 2;
            const py = aheadPlankCoord.y * cellSize + cellSize / 2;
            return (
              <>
                <line
                  x1={robotX}
                  y1={robotY}
                  x2={px}
                  y2={py}
                  stroke="#fbbf24"
                  strokeWidth={4.5}
                  strokeDasharray="5 3"
                  opacity={0.9}
                  className="animate-pulse"
                />
                <circle
                  cx={px}
                  cy={py}
                  r={cellSize * 0.4}
                  fill="none"
                  stroke="#facc15"
                  strokeWidth={2.5}
                  strokeDasharray="4 2"
                />
                <text
                  x={px - cellSize * 0.25}
                  y={py - cellSize * 0.22}
                  fontSize={12}
                  fill="#fde047"
                >
                  ✦
                </text>
              </>
            );
          })()}
        </g>
      )}

      {/* Beacon Color + Shape Match Ring (`tileColor`) */}
      {tileColorRef && (
        <g
          data-testid="sensor-tile-color-ring"
          data-matched={tileColorMatch ? 'true' : 'false'}
          data-beacon-shape={currentBeacon?.shape ?? 'none'}
        >
          <circle
            cx={robotX}
            cy={robotY}
            r={cellSize * 0.45}
            fill="none"
            stroke={tileColorHex}
            strokeWidth={tileColorMatch ? 3.5 : 2}
            strokeDasharray={tileColorMatch ? undefined : '4 3'}
            opacity={tileColorMatch ? 0.95 : 0.65}
          />
          {currentBeacon && (
            <circle
              cx={robotX}
              cy={robotY}
              r={cellSize * 0.36}
              fill={tileColorMatch ? tileColorHex : 'none'}
              fillOpacity={tileColorMatch ? 0.16 : 0}
              stroke="#ffffff"
              strokeWidth={1.2}
              strokeOpacity={tileColorMatch ? 0.75 : 0.35}
            />
          )}
        </g>
      )}

      {/* Illuminating halo on local-cell scanned condition (when not tileColor / ahead) */}
      {!isAhead && !tileColorRef && (
        <circle
          cx={robotX}
          cy={robotY}
          r={cellSize * 0.46}
          fill="none"
          stroke="#38bdf8"
          strokeWidth={2.5}
          strokeDasharray="4 2"
          className="animate-spin"
          style={{ transformOrigin: `${robotX}px ${robotY}px`, animationDuration: '6s' }}
        />
      )}

      {/* Sensor Result Badge (✓ / ✗) */}
      {sensorResult !== null && (
        <g
          transform={`translate(${isAhead ? targetX : robotX + cellSize * 0.28}, ${
            isAhead ? targetY - cellSize * 0.32 : robotY - cellSize * 0.28
          })`}
        >
          <circle
            r={11}
            fill={sensorResult ? '#059669' : '#dc2626'}
            stroke="#ffffff"
            strokeWidth={2}
            filter="drop-shadow(0 2px 4px rgba(0,0,0,0.5))"
          />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fill="#ffffff"
            fontSize={12}
            fontWeight="900"
          >
            {sensorResult ? '✓' : '✗'}
          </text>
        </g>
      )}
    </g>
  );
};

// ─── 2. Branch-Skip Spotlight (Zero-Reading Visual Arc) ───────────────────────

export const BranchSkipSpotlight: React.FC = () => {
  const { runtime, workspace, activeScope } = useAppStoreSelector((s) => ({
    runtime: s.runtime,
    workspace: s.workspace,
    activeScope: s.activeScope,
  }));

  const currentScope = runtime?.activeScope ?? activeScope ?? 'MAIN';
  const scopeBlocks = workspace?.[currentScope] ?? [];

  // Check top condStack frame or active block
  const topCond = runtime?.condStack && runtime.condStack.length > 0
    ? runtime.condStack[runtime.condStack.length - 1]
    : null;

  const activeBlock = runtime?.activeBlockId
    ? scopeBlocks.find((b) => b.id === runtime.activeBlockId)
    : null;

  const isElseActive = activeBlock?.type === 'ELSE';
  const isIfActive = activeBlock?.type === 'IF';
  const isBranchTaken = topCond?.branchTaken ?? !isElseActive;

  return (
    <div
      data-testid="branch-skip-spotlight"
      aria-label="Two-way decision: If condition holds, enter If and skip Else; otherwise jump to Else"
      className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900/90 rounded-xl border border-sky-500/40 select-none shrink-0 shadow-sm"
    >
      {/* If Node */}
      <span
        className={`inline-flex items-center gap-0.5 px-1.5 h-5 rounded-md border text-[10px] font-black transition-all ${
          isIfActive || topCond
            ? 'bg-amber-500/30 border-amber-300 text-amber-200'
            : 'bg-slate-800 border-slate-700 text-slate-400'
        }`}
      >
        <span>If</span>
        <span className="text-[9px]">?</span>
      </span>

      {/* Decision Path Visual */}
      {isBranchTaken ? (
        <div
          data-testid="branch-skip-path-then"
          className="flex items-center gap-1 text-emerald-400 font-extrabold text-[10px]"
          title="Condition True: Enter then-branch, skip Else"
        >
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-400/60 text-[10px] leading-none">
            ✓
          </span>
          <ArrowRight className="w-3 h-3 stroke-[3]" />
          <span className="px-1 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-[9px] text-emerald-300">
            Then
          </span>
          {/* Arc over Else symbol */}
          <span
            data-testid="branch-skip-arc"
            className="text-[10px] text-sky-400 tracking-tighter font-black"
            title="Arc over Else"
          >
            ↷
          </span>
          <span className="line-through text-slate-500 text-[9px]">Else</span>
        </div>
      ) : (
        <div
          data-testid="branch-skip-path-else"
          className="flex items-center gap-1 text-rose-400 font-extrabold text-[10px]"
          title="Condition False: Skip to Else branch"
        >
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-500/20 border border-rose-400/60 text-[10px] leading-none">
            ✗
          </span>
          <CornerDownRight className="w-3 h-3 stroke-[3] text-rose-400" />
          <span className="line-through text-slate-500 text-[9px]">Then</span>
          <span className="px-1 py-0.5 rounded bg-rose-950/80 border border-rose-500/40 text-[9px] text-rose-300 font-black">
            Else
          </span>
        </div>
      )}

      {/* End Node */}
      <span className="inline-flex items-center justify-center px-1.5 h-5 rounded-md border border-slate-700 bg-slate-800 text-[9px] font-bold text-slate-400">
        End
      </span>
    </div>
  );
};

// ─── 3. FIFO vs LIFO Spotlight ──────────────────────────────────────────────

export const FifoVsLifoSpotlight: React.FC = () => {
  return (
    <div
      data-testid="fifo-vs-lifo-spotlight"
      aria-label="Queue vs Stack: FIFO conveyor queue exits front-first, LIFO stack exits top-first"
      className="flex items-center gap-2 px-2.5 py-1 bg-slate-900/90 rounded-xl border border-indigo-500/40 select-none shrink-0 shadow-sm"
    >
      {/* FIFO Queue Pill */}
      <div
        data-testid="fifo-spotlight-pill"
        className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-[10px] font-extrabold text-emerald-300"
      >
        <span className="px-1 py-0.2 bg-emerald-500/20 rounded font-black text-[9px]">
          FIFO
        </span>
        <span className="text-[10px]">Queue</span>
        <ArrowRight className="w-3 h-3 text-emerald-400 stroke-[3]" />
        <span className="text-[9px] font-bold text-emerald-200">Front 1st</span>
      </div>

      <span className="text-slate-600 font-black text-[10px]">vs</span>

      {/* LIFO Stack Pill */}
      <div
        data-testid="lifo-spotlight-pill"
        className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-amber-950/60 border border-amber-500/40 text-[10px] font-extrabold text-amber-300"
      >
        <span className="px-1 py-0.2 bg-amber-500/20 rounded font-black text-[9px]">
          LIFO
        </span>
        <span className="text-[10px]">Stack</span>
        <ArrowDown className="w-3 h-3 text-amber-400 stroke-[3] rotate-180" />
        <span className="text-[9px] font-bold text-amber-200">Top 1st</span>
      </div>
    </div>
  );
};

// ─── 4. Sensor-Beam Badge (for ExplanationDemoBar) ───────────────────────────

export const SensorBeamBadge: React.FC = () => {
  return (
    <div
      data-testid="sensor-beam-badge"
      aria-label="Sensor beam scanning active item or tile"
      className="flex items-center gap-1 px-2 py-1 bg-sky-950/80 rounded-xl border border-sky-400/50 select-none shrink-0"
    >
      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-sky-500/30 text-sky-300 text-[10px] animate-pulse">
        📡
      </span>
      <span className="text-[10px] font-black text-sky-300 tracking-tight">
        Scanner Beam
      </span>
      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-emerald-500/30 text-emerald-300 text-[9px] font-black">
        ✓
      </span>
      <span className="text-slate-500 text-[9px]">/</span>
      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-rose-500/30 text-rose-300 text-[9px] font-black">
        ✗
      </span>
    </div>
  );
};
