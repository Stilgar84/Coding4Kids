/**
 * BeaconAndDialLayer (Commit 22)
 *
 * Renders into the `beaconAndDialSlot` of GridOverlayLayer:
 * - Color+shape floor beacons (Red ●, Blue ▲, Green ■, Yellow ◆)
 * - Bold high-contrast floor dials (1..20)
 * - Stack count badges (×N) on floor depot items with count > 1
 *
 * Rules:
 * - Zero-reading rule: beacons identified by color+shape (redundant coding).
 * - Non-overlapping: rendered under robot in `grid-slot-beacon-dial`.
 * - Touch targets: glyphs are ≥ 36×36px visual weight at 72px cell size.
 */

import React from 'react';
import { GridState, BeaconColor, BeaconShape } from '../../../types';
import { GRID_CELL_SIZE } from './GridOverlayLayer';

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
}

/**
 * Renders floor beacons, numbered dials, and stack-count badges into the SVG
 * `beaconAndDialSlot` of GridOverlayLayer — always under the robot.
 */
export const BeaconAndDialLayer: React.FC<BeaconAndDialLayerProps> = ({
  grid,
  cellSize = GRID_CELL_SIZE,
}) => {
  const beacons = grid.beaconTiles ?? [];
  const dials = grid.dialTiles ?? [];
  const stackItems = (grid.worldItems ?? []).filter((it) => (it.count ?? 1) > 1);

  if (beacons.length === 0 && dials.length === 0 && stackItems.length === 0) {
    return null;
  }

  const sf = cellSize / 72;

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

      {/* ── Floor Dials (1..20) ───────────────────────────── */}
      {dials.map((dial) => {
        const cx = dial.x * cellSize + cellSize / 2;
        const cy = dial.y * cellSize + cellSize / 2;
        const val = Math.max(1, Math.min(20, dial.value));
        const displayText = String(val);

        return (
          <g
            key={`dial-${dial.x}-${dial.y}`}
            data-testid={`dial-tile-${dial.x}-${dial.y}`}
            data-dial-value={val}
            aria-label={`Floor dial ${val}`}
            transform={`translate(${cx}, ${cy}) scale(${sf})`}
          >
            {/* Background disc */}
            <circle r={26} fill="#1e293b" stroke="#f1f5f9" strokeWidth={2.5} />
            <circle r={22} fill="#0f172a" stroke="#94a3b8" strokeWidth={1.2} strokeDasharray="3 2" />
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
