import React from 'react';
import { ArrowRight, CornerDownRight, ArrowDown } from 'lucide-react';
import {
  CodeBlock,
  Direction,
  GridState,
  InterpreterRuntimeState,
  WorkspaceState,
} from '../../../types';
import { useAppStoreSelector } from '../../../store/useAppStore';
import { GRID_CELL_SIZE } from './GridOverlayLayer';

// ─── Helpers for Grid Sensor Target Coordinate ──────────────────────────────

export function getScannedCellCoord(
  robot: { x: number; y: number; dir: Direction },
  sensorType?: string
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
    case 'itemHere':
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

  const cueBlock = activeBlock ?? pendingBlock;
  const condition = cueBlock?.params?.condition as
    | { kind?: string; sensor?: string; param?: string }
    | undefined;
  const sensorType = condition?.sensor ?? (cueBlock?.params?.sensor as string | undefined) ?? 'itemHere';

  // Evaluate sensor result on grid
  let sensorResult: boolean | null = null;
  if (cueBlock?.type === 'IF' || cueBlock?.type === 'WHILE' || cueBlock?.type === 'ELSE_IF') {
    if (sensorType === 'itemHere') {
      sensorResult = (grid.worldItems ?? []).some((it) => it.x === robot.x && it.y === robot.y);
    } else if (sensorType === 'pathAhead') {
      const target = getScannedCellCoord(robot, 'pathAhead');
      sensorResult =
        target.x >= 0 &&
        target.x < grid.width &&
        target.y >= 0 &&
        target.y < grid.height &&
        !(grid.barriers ?? []).some(
          (b) =>
            (b.orientation === 'H' &&
              ((b.x === robot.x && b.y === Math.min(robot.y, target.y) + 1 && robot.x === target.x) ||
                (b.x === robot.x && b.y === robot.y && target.y < robot.y))) ||
            (b.orientation === 'V' &&
              ((b.y === robot.y && b.x === Math.min(robot.x, target.x) + 1 && robot.y === target.y) ||
                (b.y === robot.y && b.x === robot.x && target.x < robot.x)))
        );
    } else if (sensorType === 'atGoal') {
      sensorResult = (grid.flags ?? []).some((f) => f.isGoal && f.x === robot.x && f.y === robot.y);
    } else if (sensorType === 'carryingItem') {
      sensorResult = Boolean(robot.carriedItem);
    }
  }

  const scannedCoord = getScannedCellCoord(robot, sensorType);
  const targetX = scannedCoord.x * cellSize + cellSize / 2;
  const targetY = scannedCoord.y * cellSize + cellSize / 2;
  const robotX = robot.x * cellSize + cellSize / 2;
  const robotY = robot.y * cellSize + cellSize / 2;

  const isAhead = scannedCoord.x !== robot.x || scannedCoord.y !== robot.y;

  return (
    <g
      data-testid="sensor-beam-spotlight"
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

      {/* Sensor Beam Line / Cone if ahead */}
      {isAhead && (
        <>
          <line
            x1={robotX}
            y1={robotY}
            x2={targetX}
            y2={targetY}
            stroke="#38bdf8"
            strokeWidth={4}
            strokeDasharray="4 3"
            opacity={0.8}
            className="animate-pulse"
          />
          <circle
            cx={targetX}
            cy={targetY}
            r={cellSize * 0.42}
            fill="url(#sensor-beam-glow)"
            stroke="#38bdf8"
            strokeWidth={2}
            strokeDasharray="3 3"
          />
        </>
      )}

      {/* Illuminating halo on scanned cell */}
      {!isAhead && (
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
