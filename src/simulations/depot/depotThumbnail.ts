import {
  CrateColor,
  DEPOT_CRATE_COLORS,
  DEPOT_STATION_BITS,
  DepotState,
} from './types';
import {
  getEffectiveActiveStationsMask,
  normalizeCrateColor,
  stationToIndex,
} from './depotPhysics';

function ringColorHex(color: CrateColor): string {
  return DEPOT_CRATE_COLORS[normalizeCrateColor(color)].hex;
}

/**
 * Renders a bright Light Toy-Crane Workshop SVG thumbnail (`180x132`) for a DepotState.
 * Adapts layout automatically via `activeStationsMask` (`STACK 1..3`, optional `QUEUE`, optional `OUT`).
 */
export function renderDepotWorkshopSvg(depot: DepotState): string {
  const w = 180;
  const h = 132;
  const parts: string[] = [];

  const activeMask = getEffectiveActiveStationsMask(depot);
  const showQueue = (activeMask & DEPOT_STATION_BITS.QUEUE) !== 0;
  const showOut = (activeMask & DEPOT_STATION_BITS.OUT) !== 0;

  // Daylight blueprint-slate backdrop + warm birch workbench base
  parts.push(`<rect width="${w}" height="${h}" rx="12" fill="#edf4fb" />`);
  parts.push(`<rect x="0" y="110" width="${w}" height="22" rx="4" fill="#e4be8b" />`);
  parts.push(`<line x1="0" y1="110" x2="${w}" y2="110" stroke="#b9834d" stroke-width="2.5" />`);

  // Compute responsive X positions for active stations
  let bayXs: [number, number, number];
  let bayW: number;
  let queueX = 0;
  let queueW = 0;
  let outX = 0;
  let outW = 0;
  let railEndX = 166;

  if (!showQueue && !showOut) {
    bayXs = [22, 74, 126];
    bayW = 32;
    railEndX = 166;
  } else if (!showQueue && showOut) {
    bayXs = [14, 52, 90];
    bayW = 28;
    railEndX = 124;
    outX = 136;
    outW = 32;
  } else if (showQueue && !showOut) {
    bayXs = [12, 46, 80];
    bayW = 24;
    queueX = 114;
    queueW = 54;
    railEndX = 170;
  } else {
    bayXs = [10, 40, 70];
    bayW = 22;
    queueX = 98;
    queueW = 36;
    railEndX = 136;
    outX = 142;
    outW = 28;
  }

  // Brushed overhead gantry rail
  parts.push(
    `<line x1="10" y1="22" x2="${railEndX}" y2="22" stroke="#94a3b8" stroke-width="4" stroke-linecap="round" />`
  );
  parts.push(
    `<rect x="8" y="19" width="4" height="6" rx="1" fill="#f59e0b" /><rect x="${railEndX - 2}" y="19" width="4" height="6" rx="1" fill="#f59e0b" />`
  );

  // Trolley carriage, spring wire & held full-size ring
  const isQueueWorker = depot.workerStation === 'QUEUE' && showQueue;
  const activeStackIdx = stationToIndex(depot.workerStation);
  const craneCenterX = isQueueWorker
    ? queueX + queueW / 2
    : bayXs[activeStackIdx] + bayW / 2;

  parts.push(
    `<rect x="${craneCenterX - 8}" y="15" width="16" height="8" rx="3" fill="#0284c7" stroke="#ffffff" stroke-width="1" />`
  );
  parts.push(
    `<path d="M ${craneCenterX} 23 L ${craneCenterX - 2} 27 L ${craneCenterX + 2} 30 L ${craneCenterX} 33" fill="none" stroke="#475569" stroke-width="1.4" stroke-linecap="round" />`
  );
  parts.push(
    `<path d="M ${craneCenterX - 7} 40 Q ${craneCenterX - 8} 34 ${craneCenterX} 33 Q ${craneCenterX + 8} 34 ${craneCenterX + 7} 40" fill="none" stroke="#334155" stroke-width="1.8" stroke-linecap="round" />`
  );
  if (depot.heldCrate) {
    const heldHex = ringColorHex(depot.heldCrate);
    parts.push(
      `<rect x="${craneCenterX - 9}" y="35" width="18" height="8" rx="4" fill="${heldHex}" stroke="#ffffff" stroke-width="1.2" />`
    );
  }

  // LIFO Stack Acrylic Chutes [1] [2] [3]
  for (let b = 0; b < 3; b++) {
    const bx = bayXs[b];
    const center = bx + bayW / 2;
    const isActive = !isQueueWorker && activeStackIdx === b;
    const stack = depot.stacks?.[b] ?? [];
    const targetStack = depot.targetStacks?.[b] ?? [];

    // Acrylic chute frame + wooden center peg
    parts.push(
      `<rect x="${bx}" y="46" width="${bayW}" height="62" rx="4" fill="rgba(255,255,255,0.65)" stroke="${
        isActive ? '#38bdf8' : '#94a3b8'
      }" stroke-width="${isActive ? '1.8' : '1.2'}" />`
    );
    parts.push(
      `<rect x="${center - 1.5}" y="52" width="3" height="56" rx="1.5" fill="#d4a373" fill-opacity="0.7" />`
    );

    // 25% dashed target ghost rings (for empty target slots)
    const ringW = Math.max(16, bayW - 6);
    const ringX = center - ringW / 2;
    for (let g = stack.length; g < targetStack.length && g < 5; g++) {
      const gy = 104 - (g + 1) * 10;
      const gHex = ringColorHex(targetStack[g]);
      parts.push(
        `<rect x="${ringX}" y="${gy}" width="${ringW}" height="7.5" rx="3.75" fill="${gHex}" fill-opacity="0.16" stroke="${gHex}" stroke-opacity="0.55" stroke-width="1" stroke-dasharray="2.5 1.5" />`
      );
    }

    // Live glossy color rings
    for (let s = 0; s < stack.length && s < 5; s++) {
      const cy = 104 - (s + 1) * 10;
      const hex = ringColorHex(stack[s]);
      const isTop = s === stack.length - 1;
      parts.push(
        `<rect x="${ringX}" y="${cy}" width="${ringW}" height="8" rx="4" fill="${hex}" fill-opacity="${
          isTop ? '1' : '0.72'
        }" stroke="${isTop ? '#0284c7' : '#ffffff'}" stroke-width="${isTop ? '1.2' : '0.6'}" />`
      );
      parts.push(
        `<rect x="${center - 2.5}" y="${cy + 2.5}" width="5" height="3" rx="1.5" fill="#0f172a" fill-opacity="0.22" />`
      );
    }

    // Diagonal acrylic glare sheen
    parts.push(
      `<line x1="${bx + 3}" y1="54" x2="${bx + bayW - 4}" y2="74" stroke="#ffffff" stroke-opacity="0.55" stroke-width="2" />`
    );

    // Pedestal badge
    parts.push(
      `<rect x="${bx}" y="108" width="${bayW}" height="12" rx="2.5" fill="${
        isActive ? '#0284c7' : '#ffffff'
      }" stroke="#94a3b8" stroke-width="0.8" />`
    );
    parts.push(
      `<text x="${center}" y="117" text-anchor="middle" font-family="sans-serif" font-size="8" font-weight="900" fill="${
        isActive ? '#ffffff' : '#334155'
      }">${b + 1}</text>`
    );
  }

  // Optional FIFO Conveyor Belt (QUEUE)
  if (showQueue) {
    parts.push(
      `<rect x="${queueX}" y="76" width="${queueW}" height="32" rx="4" fill="rgba(255,255,255,0.72)" stroke="${
        isQueueWorker ? '#10b981' : '#94a3b8'
      }" stroke-width="${isQueueWorker ? '1.8' : '1.2'}" />`
    );
    parts.push(
      `<rect x="${queueX + 2}" y="97" width="${queueW - 4}" height="8" rx="4" fill="#cbd5e1" />`
    );
    const qItems = depot.queue ?? [];
    for (let i = 0; i < qItems.length && i < 3; i++) {
      const qx = queueX + 4 + i * 11;
      if (qx + 9 > queueX + queueW - 2) break;
      const qHex = ringColorHex(qItems[i].color);
      parts.push(
        `<rect x="${qx}" y="86" width="9" height="8" rx="4" fill="${qHex}" stroke="#ffffff" stroke-width="0.8" />`
      );
    }
    parts.push(
      `<rect x="${queueX}" y="108" width="${queueW}" height="12" rx="2.5" fill="${
        isQueueWorker ? '#10b981' : '#ffffff'
      }" stroke="#94a3b8" stroke-width="0.8" />`
    );
  }

  // Optional Curved Overhead Sky-Chute + OUT Dock
  if (showOut) {
    const outCenter = outX + outW / 2;
    parts.push(
      `<path d="M ${railEndX - 2} 22 Q ${outCenter} 18 ${outCenter} 44" fill="none" stroke="#8b5cf6" stroke-opacity="0.35" stroke-width="6" stroke-linecap="round" />`
    );
    parts.push(
      `<rect x="${outX}" y="46" width="${outW}" height="62" rx="5" fill="#f5f3ff" stroke="#a78bfa" stroke-width="1.3" />`
    );
    const outItems = depot.output ?? [];
    const outGoal = depot.targetOutput ?? [];
    const slotCount = Math.min(4, Math.max(outItems.length, outGoal.length));
    for (let i = 0; i < slotCount; i++) {
      const oy = 102 - (i + 1) * 11;
      const itemColor = outItems[i];
      const goalColor = outGoal[i];
      if (itemColor) {
        parts.push(
          `<rect x="${outX + 4}" y="${oy}" width="${outW - 8}" height="8" rx="4" fill="${ringColorHex(itemColor)}" stroke="#ffffff" stroke-width="0.8" />`
        );
      } else if (goalColor) {
        const gHex = ringColorHex(goalColor);
        parts.push(
          `<rect x="${outX + 4}" y="${oy}" width="${outW - 8}" height="8" rx="4" fill="${gHex}" fill-opacity="0.18" stroke="${gHex}" stroke-opacity="0.55" stroke-dasharray="2.5 1.5" stroke-width="1" />`
        );
      }
    }
    parts.push(
      `<rect x="${outX}" y="108" width="${outW}" height="12" rx="2.5" fill="#7c3aed" />`
    );
    parts.push(
      `<text x="${outCenter}" y="117" text-anchor="middle" font-family="sans-serif" font-size="7" font-weight="900" fill="#ffffff">OUT</text>`
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${parts.join('')}</svg>`;
}
