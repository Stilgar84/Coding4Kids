import { GridState, Direction } from '../types';
import { isFlagPadlocked } from '../engine/physics';
import { TurtleState } from '../simulations/turtle/types';
import { getArcSvgPath } from '../simulations/turtle/physics';

const CELL_SIZE = 40;

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
      if (!isFlagPadlocked(flag, grid.flags)) continue;
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
 * Returns a data URL (`data:image/svg+xml;charset=utf-8,...`) for a given simulation state.
 */
export function generateSimulationThumbnail(
  simId: 'grid' | 'turtle',
  state: any
): string {
  return simId === 'turtle'
    ? generateTurtleMapThumbnail(state as TurtleState)
    : generateGridMapThumbnail(state as GridState);
}
