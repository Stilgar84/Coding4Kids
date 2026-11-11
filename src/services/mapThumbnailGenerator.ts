import { GridState, Direction, KeyGateColor, KeyGateShape } from '../types';
import {
  isFlagPadlocked,
  isWaterBridged,
  resolveKeyGateColor,
  resolveKeyGateShape,
} from '../engine/physics';
import { TurtleState } from '../simulations/turtle/types';
import { getArcSvgPath } from '../simulations/turtle/physics';
import { BEAT_GRID_SIZE, BeatState } from '../simulations/beat/types';

const CELL_SIZE = 40;

const THUMB_KEY_COLORS: Record<KeyGateColor, { fill: string; stroke: string }> = {
  amber: { fill: '#f59e0b', stroke: '#fde68a' },
  emerald: { fill: '#10b981', stroke: '#a7f3d0' },
  purple: { fill: '#a855f7', stroke: '#e9d5ff' },
};

function renderThumbShapeSvg(
  shape: KeyGateShape,
  r: number,
  fill: string,
  stroke: string,
  sw = 1.2
): string {
  if (shape === 'triangle') {
    const ty = (-r * 1.05).toFixed(1);
    const by = (r * 0.85).toFixed(1);
    const hx = (r * 1.02).toFixed(1);
    return `<polygon points="0,${ty} ${hx},${by} -${hx},${by}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />`;
  }
  if (shape === 'diamond') {
    const dr = (r * 1.08).toFixed(1);
    return `<polygon points="0,-${dr} ${dr},0 0,${dr} -${dr},0" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />`;
  }
  return `<circle r="${(r * 0.92).toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`;
}

function getDirectionAngle(dir: Direction): number {
  switch (dir) {
    case 'NORTH':
      return 0;
    case 'EAST':
      return 90;
    case 'SOUTH':
      return 180;
    case 'WEST':
      return 270;
  }
}

/**
 * Generates an SVG string representation of a Grid world with a dark background
 * matching the in-app robot grid display.
 */
export function renderGridMapSvg(grid: GridState): string {
  const width = Math.max(1, grid.width || 5);
  const height = Math.max(1, grid.height || 5);
  const boardWidth = width * CELL_SIZE;
  const boardHeight = height * CELL_SIZE;
  const padding = 16;
  const totalWidth = boardWidth + padding * 2;
  const totalHeight = boardHeight + padding * 2;

  let elements: string[] = [];

  // Dark base background (matches bg-slate-950/60 outer container)
  elements.push(
    `<rect width="${totalWidth}" height="${totalHeight}" fill="#0c0c1d" rx="8" />`
  );

  // Group translated by padding
  elements.push(`<g transform="translate(${padding}, ${padding})">`);

  // Checkerboard cells (dark theme matching GridCanvas.tsx)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const isEven = (x + y) % 2 === 0;
      const fill = isEven ? '#1e293b' : '#0f172a';
      elements.push(
        `<rect x="${x * CELL_SIZE}" y="${y * CELL_SIZE}" width="${CELL_SIZE}" height="${CELL_SIZE}" fill="${fill}" stroke="#334155" stroke-width="1" />`
      );
    }
  }

  // Board boundary stroke
  elements.push(
    `<rect x="0" y="0" width="${boardWidth}" height="${boardHeight}" fill="none" stroke="#475569" stroke-width="2" rx="4" />`
  );

  // Interactive World Layer: Water & Bridges
  if (grid.waterCells && grid.waterCells.length > 0) {
    for (const w of grid.waterCells) {
      const x0 = w.x * CELL_SIZE;
      const y0 = w.y * CELL_SIZE;
      const cx = x0 + CELL_SIZE / 2;
      const cy = y0 + CELL_SIZE / 2;
      const bridged = isWaterBridged(w.x, w.y, grid.bridgedWaterCells);
      elements.push(
        `<g data-thumb-water="${w.x}-${w.y}" data-bridged="${bridged}">
          <rect x="${x0 + 1.5}" y="${y0 + 1.5}" width="${CELL_SIZE - 3}" height="${CELL_SIZE - 3}" rx="3.5" fill="#0369a1" stroke="#38bdf8" stroke-opacity="0.55" stroke-width="1" />
          <path d="M ${cx - 11} ${cy - 5} Q ${cx - 6} ${cy - 8} ${cx - 1} ${cy - 5} T ${cx + 11} ${cy - 5}" fill="none" stroke="#bae6fd" stroke-width="1.3" stroke-linecap="round" opacity="${bridged ? '0.45' : '0.85'}" />
          <path d="M ${cx - 11} ${cy + 5} Q ${cx - 6} ${cy + 2} ${cx - 1} ${cy + 5} T ${cx + 11} ${cy + 5}" fill="none" stroke="#bae6fd" stroke-width="1.3" stroke-linecap="round" opacity="${bridged ? '0.45' : '0.85'}" />
          ${
            bridged
              ? `<g data-thumb-bridge="${w.x}-${w.y}" transform="translate(${cx}, ${cy})">
                  <rect x="-15" y="-13" width="30" height="5.5" rx="1.5" fill="#d97706" stroke="#451a03" stroke-width="0.8" />
                  <rect x="-15" y="-3" width="30" height="5.5" rx="1.5" fill="#b45309" stroke="#451a03" stroke-width="0.8" />
                  <rect x="-15" y="7" width="30" height="5.5" rx="1.5" fill="#d97706" stroke="#451a03" stroke-width="0.8" />
                </g>`
              : ''
          }
        </g>`
      );
    }
  }

  // Interactive World Layer: Floor Switches
  if (grid.floorSwitches && grid.floorSwitches.length > 0) {
    for (const sw of grid.floorSwitches) {
      const cx = sw.x * CELL_SIZE + CELL_SIZE / 2;
      const cy = sw.y * CELL_SIZE + CELL_SIZE / 2;
      const active = Boolean(sw.active);
      elements.push(
        `<g data-thumb-switch="${sw.x}-${sw.y}" data-active="${active}" transform="translate(${cx}, ${cy})">
          <rect x="-14" y="-14" width="28" height="28" rx="4.5" fill="#0f172a" stroke="${active ? '#34d399' : '#64748b'}" stroke-width="1.5" />
          <rect x="-10" y="-10" width="20" height="20" rx="3" fill="${active ? '#059669' : '#1e293b'}" stroke="${active ? '#a7f3d0' : '#94a3b8'}" stroke-width="1" />
        </g>`
      );
    }
  }

  // Interactive World Layer: Locked Gates
  if (grid.lockedGates && grid.lockedGates.length > 0) {
    for (const gate of grid.lockedGates) {
      const cx = gate.x * CELL_SIZE + CELL_SIZE / 2;
      const cy = gate.y * CELL_SIZE + CELL_SIZE / 2;
      const unlocked = Boolean(gate.unlocked);
      const shape = resolveKeyGateShape(gate.shape);
      const color = resolveKeyGateColor(gate.color, shape);
      const vis = THUMB_KEY_COLORS[color];
      if (unlocked) {
        elements.push(
          `<g data-thumb-gate="${gate.x}-${gate.y}" data-shape="${shape}" data-unlocked="true" transform="translate(${cx}, ${cy})" opacity="0.8">
            <rect x="-17" y="-15" width="5" height="30" rx="1.5" fill="#334155" stroke="${vis.fill}" stroke-width="1" />
            <rect x="12" y="-15" width="5" height="30" rx="1.5" fill="#334155" stroke="${vis.fill}" stroke-width="1" />
          </g>`
        );
      } else {
        elements.push(
          `<g data-thumb-gate="${gate.x}-${gate.y}" data-shape="${shape}" data-unlocked="false" transform="translate(${cx}, ${cy})">
            <rect x="-16.5" y="-16.5" width="33" height="33" rx="4.5" fill="#0f172a" fill-opacity="0.88" stroke="${vis.fill}" stroke-width="2" />
            <line x1="-8" y1="-15" x2="-8" y2="15" stroke="#475569" stroke-width="2.2" />
            <line x1="8" y1="-15" x2="8" y2="15" stroke="#475569" stroke-width="2.2" />
            ${renderThumbShapeSvg(shape, 6.8, vis.fill, vis.stroke, 1.3)}
          </g>`
        );
      }
    }
  }

  // Interactive World Layer: World Items (Keys, Planks, Crates)
  if (grid.worldItems && grid.worldItems.length > 0) {
    for (const item of grid.worldItems) {
      const cx = item.x * CELL_SIZE + CELL_SIZE / 2;
      const cy = item.y * CELL_SIZE + CELL_SIZE / 2;
      if (item.type === 'key') {
        const shape = resolveKeyGateShape(item.shape);
        const color = resolveKeyGateColor(item.color, shape);
        const vis = THUMB_KEY_COLORS[color];
        elements.push(
          `<g data-thumb-item="key-${item.x}-${item.y}" data-shape="${shape}" transform="translate(${cx}, ${cy})">
            <g transform="rotate(-35)">
              <rect x="1" y="-1.8" width="11.5" height="3.6" rx="1" fill="${vis.fill}" stroke="${vis.stroke}" stroke-width="0.9" />
              <g transform="translate(-4.5, 0) rotate(35)">
                ${renderThumbShapeSvg(shape, 6, vis.fill, vis.stroke, 1.2)}
              </g>
            </g>
          </g>`
        );
      } else if (item.type === 'plank') {
        elements.push(
          `<g data-thumb-item="plank-${item.x}-${item.y}" transform="translate(${cx}, ${cy}) rotate(-24)">
            <rect x="-12" y="-5" width="24" height="10" rx="2" fill="#d97706" stroke="#fef3c7" stroke-width="1" />
          </g>`
        );
      } else {
        elements.push(
          `<g data-thumb-item="crate-${item.x}-${item.y}" transform="translate(${cx}, ${cy})">
            <rect x="-9" y="-9" width="18" height="18" rx="2.5" fill="#b45309" stroke="#fde68a" stroke-width="1.2" />
            <line x1="-6" y1="-6" x2="6" y2="6" stroke="#78350f" stroke-width="1.5" />
            <line x1="6" y1="-6" x2="-6" y2="6" stroke="#78350f" stroke-width="1.5" />
          </g>`
        );
      }
    }
  }

  // Trace path
  if (grid.trace && grid.trace.length > 1) {
    const points = grid.trace
      .map(
        (pt) =>
          `${pt.x * CELL_SIZE + CELL_SIZE / 2},${pt.y * CELL_SIZE + CELL_SIZE / 2}`
      )
      .join(' ');
    elements.push(
      `<polyline points="${points}" fill="none" stroke="#38bdf8" stroke-width="3" stroke-dasharray="4 4" stroke-linecap="round" stroke-linejoin="round" opacity="0.80" />`
    );
  }

  // Flags and Goals
  if (grid.flags) {
    for (const flag of grid.flags) {
      const cx = flag.x * CELL_SIZE + CELL_SIZE / 2;
      const cy = flag.y * CELL_SIZE + CELL_SIZE / 2;
      if (flag.isGoal) {
        elements.push(
          `<g transform="translate(${cx}, ${cy})">
            <circle r="12" fill="#eab308" stroke="#ca8a04" stroke-width="1.5" />
            <text text-anchor="middle" dominant-baseline="central" font-size="12">🏁</text>
          </g>`
        );
      } else {
        const fill = flag.collected ? '#64748b' : '#3b82f6';
        elements.push(
          `<g transform="translate(${cx}, ${cy})">
            <circle r="10" fill="${fill}" stroke="#ffffff" stroke-width="1.5" />
            <text y="1" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="10" font-weight="bold" font-family="sans-serif">${flag.order}</text>
          </g>`
        );
      }
    }
  }

  // Barriers
  if (grid.barriers) {
    for (const barrier of grid.barriers) {
      if (barrier.orientation === 'H') {
        const bx = barrier.x * CELL_SIZE + 2;
        const by = barrier.y * CELL_SIZE - 3;
        const bw = CELL_SIZE - 4;
        const bh = 6;
        elements.push(
          `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="3" fill="#ef4444" />`
        );
      } else {
        const bx = barrier.x * CELL_SIZE - 3;
        const by = barrier.y * CELL_SIZE + 2;
        const bw = 6;
        const bh = CELL_SIZE - 4;
        elements.push(
          `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="3" fill="#ef4444" />`
        );
      }
    }
  }

  // Robot representation
  if (grid.robot) {
    const rx = grid.robot.x * CELL_SIZE + CELL_SIZE / 2;
    const ry = grid.robot.y * CELL_SIZE + CELL_SIZE / 2;
    const angle = getDirectionAngle(grid.robot.dir);
    const robotColor = grid.status === 'COLLISION' ? '#dc2626' : '#0ea5e9';

    elements.push(
      `<g transform="translate(${rx}, ${ry})">
        <g transform="rotate(${angle})">
          <circle r="14" fill="#0284c7" opacity="0.3" />
          <circle r="12" fill="${robotColor}" stroke="#ffffff" stroke-width="2" />
          <polygon points="0,-10 4,-2 -4,-2" fill="#ffffff" />
          <circle cx="-3" cy="2" r="1.5" fill="#0f172a" />
          <circle cx="3" cy="2" r="1.5" fill="#0f172a" />
        </g>
      </g>`
    );
  }

  // Padlock rings & lock badges on locked ordered flags (2+, Goal when prerequisites exist)
  if (grid.flags) {
    for (const flag of grid.flags) {
      if (!isFlagPadlocked(flag, grid.flags, grid.floorSwitches, grid.lockedGates)) continue;
      const cx = flag.x * CELL_SIZE + CELL_SIZE / 2;
      const cy = flag.y * CELL_SIZE + CELL_SIZE / 2;
      const isRobotHere =
        Boolean(grid.robot) && grid.robot.x === flag.x && grid.robot.y === flag.y;
      const baseRadius = flag.isGoal ? 12 : 10;
      const ringRadius = isRobotHere ? 15 : flag.isGoal ? 14 : 12.5;
      const badgeX = isRobotHere ? 10 : flag.isGoal ? 9 : 8;
      const badgeY = -(isRobotHere ? 10 : flag.isGoal ? 9 : 8);
      const targetId = flag.isGoal ? `goal-${flag.x}-${flag.y}` : `flag-${flag.order}`;
      const veilSvg = isRobotHere
        ? ''
        : `<circle r="${baseRadius}" fill="#0f172a" fill-opacity="0.42" />`;

      elements.push(
        `<g data-padlocked="true" data-padlock-target="${targetId}" transform="translate(${cx}, ${cy})">
          ${veilSvg}
          <circle r="${ringRadius}" fill="none" stroke="#0f172a" stroke-width="2.5" stroke-opacity="0.8" />
          <circle r="${ringRadius}" fill="none" stroke="${
            isRobotHere ? '#fbbf24' : '#cbd5e1'
          }" stroke-width="1.5" stroke-dasharray="3 2.5" stroke-linecap="round" />
          <g transform="translate(${badgeX}, ${badgeY})">
            <circle r="5.5" fill="#0f172a" stroke="${
              isRobotHere ? '#fbbf24' : '#cbd5e1'
            }" stroke-width="1" />
            <path d="M -1.8 -0.5 V -2 A 1.8 1.8 0 0 1 1.8 -2 V -0.5" fill="none" stroke="#f8fafc" stroke-width="1.1" stroke-linecap="round" />
            <rect x="-2.6" y="-0.6" width="5.2" height="4" rx="1" fill="#fbbf24" />
          </g>
        </g>`
      );
    }
  }

  elements.push(`</g>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}">${elements.join(
    ''
  )}</svg>`;
}

/**
 * Generates an SVG string representation of a Turtle LOGO canvas with a clean white background.
 */
export function renderTurtleMapSvg(turtle: TurtleState): string {
  const bounds = turtle.computedBounds || { minX: -50, maxX: 50, minY: -50, maxY: 50 };
  const minX = Math.min(bounds.minX, turtle.robot.x - 20);
  const maxX = Math.max(bounds.maxX, turtle.robot.x + 20);
  const minY = Math.min(bounds.minY, turtle.robot.y - 20);
  const maxY = Math.max(bounds.maxY, turtle.robot.y + 20);

  const spanX = Math.max(80, maxX - minX);
  const spanY = Math.max(80, maxY - minY);
  const padding = 20;

  const width = spanX + padding * 2;
  const height = spanY + padding * 2;
  const originX = -minX + padding;
  const originY = -minY + padding;

  let elements: string[] = [];

  // White base
  elements.push(
    `<rect width="${width}" height="${height}" fill="#ffffff" rx="8" stroke="#e2e8f0" stroke-width="1" />`
  );

  // Group centered around bounds
  elements.push(`<g transform="translate(${originX}, ${originY})">`);

  // Origin crosshair indicator
  elements.push(
    `<line x1="-8" y1="0" x2="8" y2="0" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="2 2" />`
  );
  elements.push(
    `<line x1="0" y1="-8" x2="0" y2="8" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="2 2" />`
  );

  // Draw paths (Lines & Arcs)
  if (turtle.paths) {
    for (const path of turtle.paths) {
      if (path.type === 'LINE') {
        elements.push(
          `<line x1="${path.fromX}" y1="${path.fromY}" x2="${path.toX}" y2="${path.toY}" stroke="${
            path.color || '#0f172a'
          }" stroke-width="${path.width || 2}" stroke-linecap="round" />`
        );
      } else if (path.type === 'ARC') {
        const d = getArcSvgPath(path);
        elements.push(
          `<path d="${d}" fill="none" stroke="${path.color || '#0f172a'}" stroke-width="${
            path.width || 2
          }" stroke-linecap="round" />`
        );
      }
    }
  }

  // Draw turtle at final pose
  const tx = turtle.robot.x;
  const ty = turtle.robot.y;
  const heading = turtle.robot.heading;

  elements.push(
    `<g transform="translate(${tx}, ${ty}) rotate(${heading})">
      <polygon points="0,-9 6,6 -6,6" fill="#10b981" stroke="#047857" stroke-width="1.5" />
    </g>`
  );

  elements.push(`</g>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${elements.join(
    ''
  )}</svg>`;
}

/**
 * Generates an SVG string representation of the 8x8 Beat & Light Matrix pad.
 */
export function renderBeatMapSvg(beat: BeatState): string {
  const padSize = 24;
  const gap = 4;
  const boardSpan = BEAT_GRID_SIZE * padSize + (BEAT_GRID_SIZE - 1) * gap;
  const padding = 16;
  const totalWidth = boardSpan + padding * 2;
  const totalHeight = boardSpan + padding * 2;

  const ringStroke = beat?.beatIndex && beat.beatIndex > 0 ? beat.activeColor || '#06b6d4' : '#334155';
  const elements: string[] = [];

  // Dark chassis frame
  elements.push(
    `<rect width="${totalWidth}" height="${totalHeight}" fill="#020617" rx="14" />`
  );
  elements.push(
    `<rect x="4" y="4" width="${totalWidth - 8}" height="${totalHeight - 8}" fill="#0f172a" rx="11" stroke="${ringStroke}" stroke-width="2" />`
  );

  elements.push(`<g transform="translate(${padding}, ${padding})">`);

  for (let row = 0; row < BEAT_GRID_SIZE; row++) {
    for (let col = 0; col < BEAT_GRID_SIZE; col++) {
      const cellColor = beat?.leds?.[row]?.[col] ?? null;
      const x = col * (padSize + gap);
      const y = row * (padSize + gap);
      if (cellColor) {
        elements.push(
          `<rect x="${x}" y="${y}" width="${padSize}" height="${padSize}" rx="5" fill="${cellColor}" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1" />`
        );
        elements.push(
          `<rect x="${x + 4}" y="${y + 4}" width="${padSize - 8}" height="${padSize - 8}" rx="3" fill="#ffffff" fill-opacity="0.28" />`
        );
      } else {
        elements.push(
          `<rect x="${x}" y="${y}" width="${padSize}" height="${padSize}" rx="5" fill="#1e293b" stroke="#334155" stroke-width="1" />`
        );
      }
    }
  }

  elements.push(`</g>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}">${elements.join(
    ''
  )}</svg>`;
}

/**
 * Returns a data URL (`data:image/svg+xml;charset=utf-8,...`) for a Grid state.
 */
export function generateGridMapThumbnail(gridState: GridState): string {
  const svg = renderGridMapSvg(gridState);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Returns a data URL (`data:image/svg+xml;charset=utf-8,...`) for a Turtle state.
 */
export function generateTurtleMapThumbnail(turtleState: TurtleState): string {
  const svg = renderTurtleMapSvg(turtleState);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Returns a data URL (`data:image/svg+xml;charset=utf-8,...`) for a Beat & Light Matrix state.
 */
export function generateBeatMapThumbnail(beatState: BeatState): string {
  const svg = renderBeatMapSvg(beatState);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Returns a data URL (`data:image/svg+xml;charset=utf-8,...`) for a given simulation state.
 */
export function generateSimulationThumbnail(
  simId: 'grid' | 'turtle' | 'beat',
  state: any
): string {
  if (simId === 'turtle') {
    return generateTurtleMapThumbnail(state as TurtleState);
  }
  if (simId === 'beat') {
    return generateBeatMapThumbnail(state as BeatState);
  }
  return generateGridMapThumbnail(state as GridState);
}
