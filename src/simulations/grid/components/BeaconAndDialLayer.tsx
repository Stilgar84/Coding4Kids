/**
 * BeaconAndDialLayer (Commit 22 + Phase 3 Rotary Dial & Sensor Cues)
 *
 * Renders into the `beaconAndDialSlot` of GridOverlayLayer:
 * - Color+shape floor beacons (Red ●, Blue ▲, Green ■, Yellow ◆)
 * - Rotary gauge floor dials (1..20) with active pulse rings
 * - Curved glowing numeral fly arc when reading `$tileDial` on a dial tile
 * - Muted `0` ring when reading `$tileDial` on an empty non-dial tile
 * - Stack count badges (×N) on floor depot items with count > 1
 *
 * Rules:
 * - Zero-reading rule: beacons identified by color+shape; dial cues use numerals only.
 * - Non-overlapping: rendered under robot in `grid-slot-beacon-dial`.
 * - Touch targets: glyphs are ≥ 36×36px visual weight at 72px cell size.
 */

import React from 'react';
import {
  GridState,
  BeaconColor,
  BeaconShape,
  CodeBlock,
  InterpreterRuntimeState,
  ScopeType,
  WorkspaceState,
} from '../../../types';
import { GRID_CELL_SIZE } from './GridOverlayLayer';

export type DialReadTargetKind = 'vars' | 'cmp' | 'param';

const DIAL_TICK_ANGLES = [
  -135, -110, -85, -60, -35, -10, 15, 40, 65, 90, 115, 135,
] as const;

function blockReferencesTileDialInVarOp(block: CodeBlock): boolean {
  const p = block.params;
  if (!p) return false;
  if (
    p.b === '$tileDial' ||
    p.c === '$tileDial' ||
    p.value === '$tileDial' ||
    p.delta === '$tileDial'
  ) {
    return true;
  }
  const expr = p.expression as Record<string, unknown> | undefined;
  if (expr && (expr.operandA === '$tileDial' || expr.operandB === '$tileDial')) {
    return true;
  }
  if (p.operandA === '$tileDial' || p.operandB === '$tileDial') {
    return true;
  }
  return false;
}

function conditionReferencesTileDial(cond: unknown): boolean {
  if (!cond || typeof cond !== 'object') return false;
  const c = cond as Record<string, unknown>;
  if (c.left === '$tileDial' || c.right === '$tileDial' || c.sensor === '$tileDial') {
    return true;
  }
  if (c.kind === 'not') {
    return conditionReferencesTileDial(c.inner ?? c.operand);
  }
  if (c.kind === 'and' || c.kind === 'or') {
    return (
      conditionReferencesTileDial(c.left) ||
      conditionReferencesTileDial(c.right)
    );
  }
  return false;
}

function findBlockById(
  workspace: WorkspaceState | null | undefined,
  blockId: string,
  preferredScope?: ScopeType | null
): CodeBlock | undefined {
  if (!workspace || !blockId) return undefined;
  if (preferredScope && workspace[preferredScope]) {
    const direct = workspace[preferredScope]?.find((b) => b.id === blockId);
    if (direct) return direct;
  }
  for (const blocks of Object.values(workspace)) {
    if (!Array.isArray(blocks)) continue;
    const match = blocks.find((b) => b.id === blockId);
    if (match) return match;
  }
  return undefined;
}

/**
 * Inspects the active execution block to determine whether `$tileDial` is currently being
 * read into a variable (`'vars'`), compared in a condition (`'cmp'`), or used as a block/repeat
 * parameter (`'param'`).
 */
export function resolveActiveDialReadTarget(
  runtime?: Pick<InterpreterRuntimeState, 'activeBlockId' | 'callStack'> | null,
  workspace?: WorkspaceState | null,
  activeBlockId?: string | null,
  activeScope?: ScopeType | null
): DialReadTargetKind | null {
  const targetId = activeBlockId ?? runtime?.activeBlockId ?? null;
  if (!targetId || !workspace) return null;

  const topFrameScope =
    activeScope ??
    (runtime?.callStack && runtime.callStack.length > 0
      ? runtime.callStack[runtime.callStack.length - 1].scope
      : null);

  const block = findBlockById(workspace, targetId, topFrameScope);
  if (!block) return null;

  if (
    block.type === 'VAR_ASSIGN' ||
    block.type === 'VAR_OP' ||
    block.type === 'SET_VAR' ||
    block.type === 'CHANGE_VAR'
  ) {
    if (blockReferencesTileDialInVarOp(block)) return 'vars';
  }

  if (block.type === 'IF' || block.type === 'ELSE_IF' || block.type === 'WHILE') {
    if (
      block.params?.sensor === '$tileDial' ||
      block.params?.left === '$tileDial' ||
      block.params?.right === '$tileDial' ||
      conditionReferencesTileDial(block.params?.condition)
    ) {
      return 'cmp';
    }
  }

  if (block.repeatCount === '$tileDial') {
    return 'param';
  }

  if (block.params) {
    for (const val of Object.values(block.params)) {
      if (val === '$tileDial') {
        return 'param';
      }
    }
  }

  return null;
}

// ─── Beacon Visuals ───────────────────────────────────────────────────────────

const BEACON_FILL: Record<BeaconColor, string> = {
  red:    '#ef4444',
  blue:   '#3b82f6',
  green:  '#10b981',
  yellow: '#f59e0b',
};

const BEACON_STROKE: Record<BeaconColor, string> = {
  red:    '#fca5a5',
  blue:   '#93c5fd',
  green:  '#6ee7b7',
  yellow: '#fde68a',
};

const BEACON_LABEL: Record<BeaconColor, string> = {
  red:    'Red',
  blue:   'Blue',
  green:  'Green',
  yellow: 'Yellow',
};

/** Inner beacon shape rendered at center of cell */
function BeaconShape_({
  shape,
  r,
  fill,
  stroke,
}: {
  shape: BeaconShape;
  r: number;
  fill: string;
  stroke: string;
}): React.ReactElement {
  const sw = 2.2;
  if (shape === 'circle') {
    return <circle r={r} fill={fill} stroke={stroke} strokeWidth={sw} />;
  }
  if (shape === 'triangle') {
    const topY = -r * 1.05;
    const botY = r * 0.85;
    const hx = r * 1.02;
    return (
      <polygon
        points={`0,${topY} ${hx},${botY} ${-hx},${botY}`}
        fill={fill}
        stroke={stroke}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
    );
  }
  if (shape === 'square') {
    const h = r * 0.92;
    return (
      <rect
        x={-h}
        y={-h}
        width={h * 2}
        height={h * 2}
        rx={h * 0.18}
        fill={fill}
        stroke={stroke}
        strokeWidth={sw}
      />
    );
  }
  // diamond
  return (
    <polygon
      points={`0,${-r} ${r},0 0,${r} ${-r},0`}
      fill={fill}
      stroke={stroke}
      strokeWidth={sw}
      strokeLinejoin="round"
    />
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export interface BeaconAndDialLayerProps {
  grid: GridState;
  cellSize?: number;
  dialReadTarget?: DialReadTargetKind | null;
  isInstant?: boolean;
}

/**
 * Renders floor beacons, rotary numbered dials, `$tileDial` read cues, and stack-count badges
 * into the SVG `beaconAndDialSlot` of GridOverlayLayer — always under the robot.
 */
export const BeaconAndDialLayer: React.FC<BeaconAndDialLayerProps> = ({
  grid,
  cellSize = GRID_CELL_SIZE,
  dialReadTarget = null,
  isInstant = false,
}) => {
  const beacons = grid.beaconTiles ?? [];
  const dials = grid.dialTiles ?? [];
  const stackItems = (grid.worldItems ?? []).filter((it) => (it.count ?? 1) > 1);

  const robotX = grid.robot.x;
  const robotY = grid.robot.y;
  const dialUnderRobot = dials.find((d) => d.x === robotX && d.y === robotY);
  const showEmptyZeroRing = Boolean(dialReadTarget && !dialUnderRobot);

  if (
    beacons.length === 0 &&
    dials.length === 0 &&
    stackItems.length === 0 &&
    !showEmptyZeroRing
  ) {
    return null;
  }

  const sf = cellSize / 72;
  const robotCx = robotX * cellSize + cellSize / 2;
  const robotCy = robotY * cellSize + cellSize / 2;

  return (
    <g data-testid="beacon-dial-layer" className="pointer-events-none">
      {/* ── Floor Beacons ─────────────────────────────────── */}
      {beacons.map((beacon) => {
        const cx = beacon.x * cellSize + cellSize / 2;
        const cy = beacon.y * cellSize + cellSize / 2;
        const fill   = BEACON_FILL[beacon.color];
        const stroke = BEACON_STROKE[beacon.color];
        const label  = BEACON_LABEL[beacon.color];

        return (
          <g
            key={`beacon-${beacon.x}-${beacon.y}`}
            data-testid={`beacon-tile-${beacon.x}-${beacon.y}`}
            data-beacon-color={beacon.color}
            data-beacon-shape={beacon.shape}
            aria-label={`${label} ${beacon.shape} floor beacon`}
            transform={`translate(${cx}, ${cy}) scale(${sf})`}
          >
            {/* Soft ground glow */}
            <circle r={28} fill={fill} fillOpacity={0.15} />
            {/* Main shape */}
            <BeaconShape_ shape={beacon.shape} r={16} fill={fill} stroke={stroke} />
            <title>{`${label} ${beacon.shape} beacon`}</title>
          </g>
        );
      })}

      {/* ── Floor Dials (1..20) with Rotary Gauge Bezel & Pulse Rings ── */}
      {dials.map((dial) => {
        const cx = dial.x * cellSize + cellSize / 2;
        const cy = dial.y * cellSize + cellSize / 2;
        const val = Math.max(1, Math.min(20, dial.value));
        const displayText = String(val);
        const isRobotOnDial = robotX === dial.x && robotY === dial.y;
        const isActivelyReading = isRobotOnDial && dialReadTarget !== null;
        const needleDeg = -135 + ((val - 1) / 19) * 270;

        return (
          <g
            key={`dial-${dial.x}-${dial.y}`}
            data-testid={`dial-tile-${dial.x}-${dial.y}`}
            data-dial-value={val}
            aria-label={`Floor dial ${val}`}
            transform={`translate(${cx}, ${cy}) scale(${sf})`}
          >
            {/* Concentric active pulse rings when robot stands on / reads dial */}
            {isRobotOnDial && (
              <g data-testid={`dial-pulse-ring-${dial.x}-${dial.y}`}>
                <circle
                  r={33}
                  fill="none"
                  stroke={isActivelyReading ? '#fbbf24' : '#38bdf8'}
                  strokeWidth={isActivelyReading ? 2.5 : 1.8}
                  strokeOpacity={isActivelyReading ? 0.85 : 0.45}
                  className={isInstant ? undefined : 'animate-ping'}
                />
                <circle
                  r={30}
                  fill={isActivelyReading ? '#fbbf24' : '#38bdf8'}
                  fillOpacity={isActivelyReading ? 0.16 : 0.08}
                  stroke={isActivelyReading ? '#fde68a' : '#7dd3fc'}
                  strokeWidth={1.6}
                />
              </g>
            )}

            {/* Rotary gauge outer metallic bezel */}
            <circle
              r={26}
              fill="#1e293b"
              stroke={isActivelyReading ? '#fbbf24' : '#f1f5f9'}
              strokeWidth={2.5}
            />

            {/* Rotary gauge rim ticks */}
            {DIAL_TICK_ANGLES.map((deg) => (
              <line
                key={deg}
                x1={0}
                y1={-25}
                x2={0}
                y2={-22}
                stroke="#94a3b8"
                strokeWidth={1.3}
                strokeLinecap="round"
                transform={`rotate(${deg})`}
              />
            ))}

            {/* Inner recessed dial face */}
            <circle r={21} fill="#0f172a" stroke="#64748b" strokeWidth={1.2} />

            {/* Rotary indicator notch angled by 1..20 value */}
            <polygon
              points="0,-24.5 2.6,-20.2 -2.6,-20.2"
              fill="#fbbf24"
              transform={`rotate(${needleDeg})`}
            />

            {/* Dial number — bold, high-contrast */}
            <text
              x={0}
              y={0}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#f8fafc"
              fontSize={val >= 10 ? 16 : 20}
              fontWeight="900"
              fontFamily="ui-monospace, monospace"
              letterSpacing={-0.5}
            >
              {displayText}
            </text>
            <title>{`Floor dial: ${val}`}</title>
          </g>
        );
      })}

      {/* ── Curved Numeral Fly Arc when reading `$tileDial` on a dial tile ── */}
      {dialReadTarget && dialUnderRobot && (() => {
        const val = Math.max(1, Math.min(20, dialUnderRobot.value));
        const endX =
          dialReadTarget === 'vars'
            ? Math.max(20 * sf, robotCx - 54 * sf)
            : robotCx + 26 * sf;
        const endY =
          dialReadTarget === 'vars'
            ? Math.max(18 * sf, robotCy - 56 * sf)
            : Math.max(18 * sf, robotCy - 44 * sf);
        const ctrlX = (robotCx + endX) / 2 - 22 * sf;
        const ctrlY = Math.min(robotCy, endY) - 28 * sf;
        const arcPath = `M ${robotCx} ${robotCy} Q ${ctrlX} ${ctrlY} ${endX} ${endY}`;

        return (
          <g
            data-testid="dial-fly-arc"
            data-dial-read-value={val}
            data-dial-read-target={dialReadTarget}
          >
            <path
              d={arcPath}
              fill="none"
              stroke="#fbbf24"
              strokeWidth={2.6 * sf}
              strokeDasharray="5 3"
              strokeLinecap="round"
            />
            <g transform={`translate(${endX}, ${endY}) scale(${sf})`}>
              <circle
                r={14}
                fill="#f59e0b"
                stroke="#fef3c7"
                strokeWidth={2}
              />
              <text
                x={0}
                y={0}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#0f172a"
                fontSize={val >= 10 ? 11 : 13}
                fontWeight="900"
                fontFamily="ui-monospace, monospace"
              >
                {val}
              </text>
            </g>
          </g>
        );
      })()}

      {/* ── Muted `0` Ring when reading `$tileDial` on an empty non-dial tile ── */}
      {showEmptyZeroRing && (
        <g
          data-testid="dial-empty-zero-ring"
          data-dial-read-value={0}
          transform={`translate(${robotCx}, ${robotCy}) scale(${sf})`}
        >
          <circle
            r={29}
            fill="#0f172a"
            fillOpacity={0.35}
            stroke="#94a3b8"
            strokeWidth={2}
            strokeDasharray="4 3"
          />
          <g transform="translate(-22, -22)">
            <circle r={11} fill="#334155" stroke="#94a3b8" strokeWidth={1.6} />
            <text
              x={0}
              y={0}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#cbd5e1"
              fontSize={12}
              fontWeight="900"
              fontFamily="ui-monospace, monospace"
            >
              0
            </text>
          </g>
        </g>
      )}

      {/* ── Stack Count Badges (×N) ───────────────────────── */}
      {stackItems.map((item) => {
        const count = item.count ?? 1;
        const cx = item.x * cellSize + cellSize / 2;
        const cy = item.y * cellSize + cellSize / 2;
        return (
          <g
            key={`stack-badge-${item.id}`}
            data-testid={`stack-badge-${item.x}-${item.y}`}
            data-stack-count={count}
            transform={`translate(${cx + 20 * sf}, ${cy - 20 * sf}) scale(${sf})`}
          >
            {/* Badge pill */}
            <rect x={-14} y={-10} width={28} height={20} rx={6} fill="#0ea5e9" />
            <text
              x={0}
              y={0}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#fff"
              fontSize={11}
              fontWeight="800"
              fontFamily="ui-sans-serif, sans-serif"
            >
              ×{count}
            </text>
          </g>
        );
      })}
    </g>
  );
};
