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

function ringStrokeHex(color: CrateColor, fallback = '#ffffff'): string {
  return normalizeCrateColor(color) === 'WHITE' ? '#64748b' : fallback;
}

/**
 * Renders a bright Light Toy-Crane Workshop SVG thumbnail (`180x132`) for a DepotState.
 * Adapts layout automatically via `activeStationsMask` (optional `INPUT`, `STACK 1..3`, optional `QUEUE`, optional `OUT`).
 */
export function renderDepotWorkshopSvg(depot: DepotState): string {
  const w = 180;
  const h = 132;
  const parts: string[] = [];

  const activeMask = getEffectiveActiveStationsMask(depot);
  const showInput = (activeMask & DEPOT_STATION_BITS.INPUT) !== 0;
  const showQueue = (activeMask & DEPOT_STATION_BITS.QUEUE) !== 0;
  const showOut = (activeMask & DEPOT_STATION_BITS.OUT) !== 0;

  // Daylight blueprint-slate backdrop + warm birch workbench base
  parts.push(`<rect width="${w}" height="${h}" rx="12" fill="#edf4fb" />`);
  parts.push(`<rect x="0" y="110" width="${w}" height="22" rx="4" fill="#e4be8b" />`);
  parts.push(`<line x1="0" y1="110" x2="${w}" y2="110" stroke="#b9834d" stroke-width="2.5" />`);

  // Compute responsive X positions for active stations
  let bayXs: [number, number, number];
  let bayW: number;
  let inputX = 0;
  let inputW = 0;
  let queueX = 0;
  let queueW = 0;
  let outX = 0;
  let outW = 0;
  let railEndX = 166;

  if (showInput) {
    outW = showOut ? 26 : 0;
    outX = showOut ? 144 : 0;
    const availEnd = showOut ? 136 : 168;
    const totalW = availEnd - 10;
    const units = 4 + (showQueue ? 1.4 : 0);
    const gap = 4;
    const gapTotal = gap * (showQueue ? 4 : 3);
    const unitW = Math.floor((totalW - gapTotal) / units);
    inputX = 10;
    inputW = unitW;
    bayW = unitW;
    bayXs = [
      inputX + inputW + gap,
      inputX + (inputW + gap) * 2,
      inputX + (inputW + gap) * 3,
    ];
    queueX = bayXs[2] + bayW + gap;
    queueW = showQueue ? Math.max(24, availEnd - queueX) : 0;
    railEndX = showQueue ? queueX + queueW - 2 : bayXs[2] + bayW + 2;
  } else if (!showQueue && !showOut) {
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
  const isInputWorker = depot.workerStation === 'INPUT' && showInput;
  const isQueueWorker = depot.workerStation === 'QUEUE' && showQueue;
  const activeStackIdx = stationToIndex(depot.workerStation);
  const craneCenterX = isInputWorker
    ? inputX + inputW / 2
    : isQueueWorker
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
      `<rect x="${craneCenterX - 9}" y="35" width="18" height="8" rx="4" fill="${heldHex}" stroke="${ringStrokeHex(depot.heldCrate)}" stroke-width="1.2" />`
    );
  }

  // Optional INPUT Vertical Supply Dispenser
  if (showInput) {
    const inCenter = inputX + inputW / 2;
    parts.push(
      `<rect x="${inputX}" y="46" width="${inputW}" height="62" rx="4" fill="rgba(254,243,199,0.72)" stroke="${
        isInputWorker ? '#f59e0b' : '#d97706'
      }" stroke-width="${isInputWorker ? '1.8' : '1.2'}" />`
    );
    const inItems = depot.input ?? [];
    const inRingW = Math.max(12, inputW - 6);
    const inRingX = inCenter - inRingW / 2;
    for (let i = 0; i < inItems.length && i < 5; i++) {
      const iy = 52 + i * 10;
      const iHex = ringColorHex(inItems[i].color);
      parts.push(
        `<rect x="${inRingX}" y="${iy}" width="${inRingW}" height="8" rx="4" fill="${iHex}" fill-opacity="${
          i === 0 ? '1' : '0.72'
        }" stroke="${ringStrokeHex(inItems[i].color, i === 0 ? '#d97706' : '#ffffff')}" stroke-width="1" />`
      );
    }
    parts.push(
      `<rect x="${inputX}" y="108" width="${inputW}" height="12" rx="2.5" fill="${
        isInputWorker ? '#f59e0b' : '#ffffff'
      }" stroke="#d97706" stroke-width="0.8" />`
    );
    parts.push(
      `<text x="${inCenter}" y="117" text-anchor="middle" font-family="sans-serif" font-size="6.5" font-weight="900" fill="${
        isInputWorker ? '#ffffff' : '#92400e'
      }">IN</text>`
    );
  }

  // LIFO Stack Acrylic Chutes [1] [2] [3]
  for (let b = 0; b < 3; b++) {
    const bx = bayXs[b];
    const center = bx + bayW / 2;
    const isActive = !isInputWorker && !isQueueWorker && activeStackIdx === b;
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

    // Dashed target ghost rings/blocks (for empty target slots)
    const ringW = Math.max(10, bayW - 6);
    const ringX = center - ringW / 2;
    const targetStackVals = depot.targetStackValues?.[b];
    for (let g = stack.length; g < targetStack.length && g < 5; g++) {
      const gy = 104 - (g + 1) * 10;
      const gHex = ringColorHex(targetStack[g]);
      const gVal = targetStackVals?.[g];
      const rx = gVal !== undefined && !depot.enforceHanoiRule ? '2' : '3.75';
      parts.push(
        `<rect x="${ringX}" y="${gy}" width="${ringW}" height="7.5" rx="${rx}" fill="${gHex}" fill-opacity="0.16" stroke="${gHex}" stroke-opacity="0.55" stroke-width="1" stroke-dasharray="2.5 1.5" />`
      );
    }

    // Live glossy color rings / numbered toy blocks
    const stackVals = depot.stackValues?.[b];
    for (let s = 0; s < stack.length && s < 5; s++) {
      const cy = 104 - (s + 1) * 10;
      const hex = ringColorHex(stack[s]);
      const isTop = s === stack.length - 1;
      const val = stackVals?.[s];
      const rx = val !== undefined && !depot.enforceHanoiRule ? '2' : '4';
      parts.push(
        `<rect x="${ringX}" y="${cy}" width="${ringW}" height="8" rx="${rx}" fill="${hex}" fill-opacity="${
          isTop ? '1' : '0.72'
        }" stroke="${isTop ? '#0284c7' : ringStrokeHex(stack[s])}" stroke-width="${isTop ? '1.2' : '0.7'}" />`
      );
      if (val !== undefined) {
        parts.push(
          `<text x="${center}" y="${cy + 6}" text-anchor="middle" font-family="sans-serif" font-size="6" font-weight="900" fill="#ffffff">${val}</text>`
        );
      } else {
        parts.push(
          `<rect x="${center - 2.5}" y="${cy + 2.5}" width="5" height="3" rx="1.5" fill="#0f172a" fill-opacity="0.22" />`
        );
      }
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

  // Optional Upright 8-Slot U-Shaped FIFO Conveyor Belt (QUEUE)
  if (showQueue) {
    const leftLaneX = queueX + queueW * 0.28;
    const rightLaneX = queueX + queueW * 0.72;
    const midX = queueX + queueW / 2;
    const trackW = Math.max(8, Math.floor(queueW * 0.34));
    const turnRx = (queueW * 0.22).toFixed(1);
    const uPath = `M ${rightLaneX.toFixed(1)} 52 L ${rightLaneX.toFixed(1)} 95 A ${turnRx} 10 0 0 1 ${leftLaneX.toFixed(1)} 95 L ${leftLaneX.toFixed(1)} 52`;

    parts.push(
      `<rect x="${queueX}" y="46" width="${queueW}" height="62" rx="4" fill="rgba(255,255,255,0.72)" stroke="${
        isQueueWorker ? '#10b981' : '#94a3b8'
      }" stroke-width="${isQueueWorker ? '1.8' : '1.2'}" />`
    );
    parts.push(
      `<path d="${uPath}" fill="none" stroke="#94a3b8" stroke-opacity="0.45" stroke-width="${trackW + 2}" stroke-linecap="round" stroke-linejoin="round" />`
    );
    parts.push(
      `<path d="${uPath}" fill="none" stroke="#cbd5e1" stroke-width="${trackW}" stroke-linecap="round" stroke-linejoin="round" />`
    );
    parts.push(
      `<line x1="${midX.toFixed(1)}" y1="51" x2="${midX.toFixed(1)}" y2="88" stroke="#ffffff" stroke-width="2" stroke-linecap="round" />`
    );

    const qItems = depot.queue ?? [];
    const ringW = Math.max(6, Math.floor(queueW * 0.3));
    const ringH = 6.5;
    for (let i = 0; i < qItems.length && i < 8; i++) {
      const isLeftLane = i < 4;
      const rowIdx = isLeftLane ? i : 7 - i;
      const qx = (isLeftLane ? leftLaneX : rightLaneX) - ringW / 2;
      const qy = 53 + rowIdx * 10;
      const qHex = ringColorHex(qItems[i].color);
      parts.push(
        `<rect x="${qx.toFixed(1)}" y="${qy}" width="${ringW}" height="${ringH}" rx="3" fill="${qHex}" stroke="${ringStrokeHex(
          qItems[i].color,
          i === 0 ? '#10b981' : '#ffffff'
        )}" stroke-width="${i === 0 ? '1.1' : '0.7'}" />`
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
