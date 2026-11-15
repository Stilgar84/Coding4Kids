import React from 'react';
import { Trophy } from 'lucide-react';
import { SimulationStatus } from '../../../types';
import { isLowQualityActive, useAppStoreSelector } from '../../../store/useAppStore';
import { getActivityAtVersion, getActivityLatest } from '../../../data/curriculum';
import {
  DockId,
  DockState,
  ItemIcon,
  SWITCHYARD_COLOR_META,
  SwitchState,
  SwitchyardItem,
  SwitchyardState,
} from '../types';
import {
  deriveSwitchyardFailureDiagnostic,
  resolveSwitchyardRoute,
} from '../physics';

export interface SwitchyardCanvasProps {
  state: SwitchyardState;
  runtimeStatus?: SimulationStatus;
  spotlightsOverride?: string[];
  activeBlockId?: string | null;
}

const ANIM_KEYFRAMES = `
@keyframes syLaserPulse {
  0%, 100% { opacity: 0.45; transform: translateY(0px); }
  50% { opacity: 0.95; transform: translateY(3px); }
}
@keyframes syCarEnterScanner {
  0% { transform: translate(-52px, -28px) scale(0.88); opacity: 0.55; }
  100% { transform: translate(0px, 0px) scale(1); opacity: 1; }
}
@keyframes syChevronFlow {
  0% { stroke-dashoffset: 24; }
  100% { stroke-dashoffset: 0; }
}
@keyframes syDockSlotReveal {
  0%, 84% { opacity: 0; transform: scale(0.75); }
  92% { opacity: 1; transform: scale(1.06); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes sySwitchPulse {
  0% { opacity: 0.9; transform: scale(0.92); }
  100% { opacity: 0; transform: scale(1.36); }
}
@keyframes syHazardSpark {
  0%, 100% { opacity: 0.72; transform: scale(0.96) rotate(-3deg); }
  50% { opacity: 1; transform: scale(1.06) rotate(3deg); }
}
@keyframes syCollisionShake {
  0%, 100% { transform: translateX(0px); }
  25% { transform: translateX(-6px); }
  55% { transform: translateX(6px); }
  80% { transform: translateX(-3px); }
}
@media (prefers-reduced-motion: reduce) {
  [data-testid="switchyard-canvas"] *,
  [data-testid="switchyard-canvas"] *::before,
  [data-testid="switchyard-canvas"] *::after {
    animation-duration: 1ms !important;
    transition-duration: 0ms !important;
  }
}
`;

/**
 * Computes Switchyard animation duration in ms matching the Depot speed schedule.
 */
export function computeSwitchyardAnimDurationMs(
  speed: number | 'instant',
  isLowQuality: boolean,
  hasEvent: boolean
): number {
  if (!hasEvent || isLowQuality || speed === 'instant') return 0;
  const numericSpeed = Number(speed);
  if (!Number.isFinite(numericSpeed)) return 1350;
  if (numericSpeed <= 0) return 0;
  if (numericSpeed <= 25) return 230;
  if (numericSpeed <= 100) return 585;
  return Math.round(numericSpeed * 3.375);
}

/**
 * Vector emblem glyphs rendered directly inside SVG cargo bays, floor stencils, and failure bubbles.
 */
const ItemEmblemGlyph: React.FC<{
  icon: ItemIcon;
  cx: number;
  cy: number;
  size?: number;
  stroke?: string;
  fill?: string;
}> = ({ icon, cx, cy, size = 18, stroke = '#0f172a', fill = '#ffffff' }) => {
  const half = size / 2;
  switch (icon) {
    case 'CRATE':
      return (
        <g transform={`translate(${cx - half}, ${cy - half})`} aria-hidden="true">
          <rect
            x="1"
            y="1"
            width={size - 2}
            height={size - 2}
            rx="3"
            fill={fill}
            fillOpacity="0.92"
            stroke={stroke}
            strokeWidth="1.8"
          />
          <line x1="2.5" y1="2.5" x2={size - 2.5} y2={size - 2.5} stroke={stroke} strokeWidth="1.5" />
          <line x1={size - 2.5} y1="2.5" x2="2.5" y2={size - 2.5} stroke={stroke} strokeWidth="1.5" />
        </g>
      );
    case 'BATTERY':
      return (
        <g transform={`translate(${cx - half}, ${cy - half})`} aria-hidden="true">
          <rect
            x={size * 0.34}
            y="0.5"
            width={size * 0.32}
            height={size * 0.14}
            rx="1"
            fill={stroke}
          />
          <rect
            x={size * 0.18}
            y={size * 0.16}
            width={size * 0.64}
            height={size * 0.78}
            rx="2.5"
            fill={fill}
            fillOpacity="0.94"
            stroke={stroke}
            strokeWidth="1.8"
          />
          <path
            d={`M${size * 0.54} ${size * 0.3} L${size * 0.36} ${size * 0.56} H${size * 0.52} L${size * 0.44} ${size * 0.8} L${size * 0.64} ${size * 0.52} H${size * 0.49} Z`}
            fill="#f59e0b"
            stroke={stroke}
            strokeWidth="0.9"
            strokeLinejoin="round"
          />
        </g>
      );
    case 'GEAR': {
      const rOuter = size * 0.44;
      const rInner = size * 0.18;
      const teeth = 6;
      const pts: string[] = [];
      for (let i = 0; i < teeth * 2; i++) {
        const angle = (i * Math.PI) / teeth;
        const r = i % 2 === 0 ? rOuter : rOuter * 0.72;
        pts.push(`${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`);
      }
      return (
        <g aria-hidden="true">
          <polygon
            points={pts.join(' ')}
            fill={fill}
            fillOpacity="0.94"
            stroke={stroke}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle cx={cx} cy={cy} r={rInner} fill="#94a3b8" stroke={stroke} strokeWidth="1.4" />
        </g>
      );
    }
    case 'CRYSTAL':
      return (
        <g aria-hidden="true">
          <polygon
            points={`${cx},${cy - half} ${cx + half * 0.88},${cy - half * 0.15} ${cx},${cy + half} ${cx - half * 0.88},${cy - half * 0.15}`}
            fill="#e0f2fe"
            stroke={stroke}
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <line
            x1={cx - half * 0.85}
            y1={cy - half * 0.15}
            x2={cx + half * 0.85}
            y2={cy - half * 0.15}
            stroke={stroke}
            strokeWidth="1.2"
          />
          <line x1={cx} y1={cy - half} x2={cx} y2={cy + half} stroke={stroke} strokeWidth="1.1" opacity="0.5" />
        </g>
      );
  }
};

/**
 * Core freight car vector shapes centered at (0, 0).
 */
const ToyRailCarBody: React.FC<{
  item: SwitchyardItem;
  inScanner?: boolean;
}> = ({ item, inScanner = false }) => {
  const meta = SWITCHYARD_COLOR_META[item.color] ?? SWITCHYARD_COLOR_META.RED;
  const damaged = Boolean(item.damaged);
  const bodyStroke = item.color === 'WHITE' ? '#475569' : meta.stroke;

  return (
    <>
      {/* Drop shadow on sleepers */}
      <ellipse cx="0" cy="18" rx="22" ry="4.5" fill="#0f172a" fillOpacity="0.16" />

      {/* Undercarriage & steel wheels */}
      <rect x="-20" y="9" width="40" height="5" rx="2" fill="#334155" />
      <circle cx="-12" cy="14.5" r="4" fill="#1e293b" stroke="#cbd5e1" strokeWidth="1.2" />
      <circle cx="12" cy="14.5" r="4" fill="#1e293b" stroke="#cbd5e1" strokeWidth="1.2" />

      {/* Painted Toy Freight Body */}
      <rect
        x="-23"
        y="-14"
        width="46"
        height="25"
        rx="6"
        fill={meta.hex}
        stroke={inScanner ? '#0ea5e9' : bodyStroke}
        strokeWidth={inScanner ? '2.8' : '2'}
      />
      {/* Top glossy wooden-toy specular rim */}
      <rect x="-19" y="-11.5" width="38" height="4.5" rx="2.2" fill="#ffffff" fillOpacity="0.38" />

      {/* Center Emblem */}
      <ItemEmblemGlyph
        icon={item.icon}
        cx={0}
        cy={-1}
        size={17}
        stroke={item.color === 'BLACK' ? '#f8fafc' : '#0f172a'}
        fill="#ffffff"
      />

      {/* 4-cue itemDamaged Hazard Overlay (Crack + Spark + Tilt + Alert Badge) */}
      {damaged && (
        <g aria-label="Damaged hazard cue">
          <path
            d="M-15 -13 L-7 -3 L-12 2 L-4 10 M11 -12 L6 -4 L13 2 L8 10"
            stroke="#1e293b"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />
          <polygon
            points="18,-23 11,-11 17,-11 13,-2 24,-13 18,-13"
            fill="#facc15"
            stroke="#991b1b"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <polygon
            points="-20,-18 -25,-12 -21,-12 -24,-6 -16,-14 -20,-14"
            fill="#fde047"
            stroke="#b45309"
            strokeWidth="1"
          />
        </g>
      )}
    </>
  );
};

/**
 * Toy railway freight car rendered inside the tunnel queue, scanner gate, or dock bays.
 * Outer <g> uses strictly SVG transform placement so CSS animations on the inner <g>
 * never override SVG coordinates in Chromium SVG2.
 */
const ToyRailCarSvg: React.FC<{
  item: SwitchyardItem;
  cx: number;
  cy: number;
  scale?: number;
  inScanner?: boolean;
  dimmed?: boolean;
  animStyle?: React.CSSProperties;
  testId?: string;
}> = ({ item, cx, cy, scale = 1, inScanner = false, dimmed = false, animStyle, testId }) => {
  const damaged = Boolean(item.damaged);
  const tilt = damaged ? 'rotate(-5)' : '';

  return (
    <g
      data-testid={testId}
      transform={`translate(${cx}, ${cy}) scale(${scale})${tilt ? ` ${tilt}` : ''}`}
      opacity={dimmed ? 0.72 : 1}
    >
      {animStyle ? (
        <g style={animStyle}>
          <ToyRailCarBody item={item} inScanner={inScanner} />
        </g>
      ) : (
        <ToyRailCarBody item={item} inScanner={inScanner} />
      )}
    </g>
  );
};

type RouteSeg =
  | { kind: 'L'; x0: number; y0: number; x1: number; y1: number }
  | {
      kind: 'C';
      x0: number;
      y0: number;
      cx1: number;
      cy1: number;
      cx2: number;
      cy2: number;
      x1: number;
      y1: number;
    };

function makeCurvedSeg(x0: number, y0: number, x1: number, y1: number): RouteSeg {
  const midY = (y0 + y1) / 2;
  return { kind: 'C', x0, y0, cx1: x0, cy1: midY, cx2: x1, cy2: midY, x1, y1 };
}

function evalRouteSeg(seg: RouteSeg, t: number): { x: number; y: number } {
  if (seg.kind === 'L') {
    return {
      x: seg.x0 + (seg.x1 - seg.x0) * t,
      y: seg.y0 + (seg.y1 - seg.y0) * t,
    };
  }
  const u = 1 - t;
  const uu = u * u;
  const tt = t * t;
  const uuu = uu * u;
  const ttt = tt * t;
  return {
    x: uuu * seg.x0 + 3 * uu * t * seg.cx1 + 3 * u * tt * seg.cx2 + ttt * seg.x1,
    y: uuu * seg.y0 + 3 * uu * t * seg.cy1 + 3 * u * tt * seg.cy2 + ttt * seg.y1,
  };
}

function segsToSvgPath(segs: readonly RouteSeg[]): string {
  if (segs.length === 0) return '';
  const parts: string[] = [`M ${segs[0].x0} ${segs[0].y0}`];
  for (const s of segs) {
    if (s.kind === 'L') {
      parts.push(`L ${s.x1} ${s.y1}`);
    } else {
      parts.push(`C ${s.cx1} ${s.cy1}, ${s.cx2} ${s.cy2}, ${s.x1} ${s.y1}`);
    }
  }
  return parts.join(' ');
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

interface InflightRouteData {
  path: string;
  keyframesCss: string;
  animName: string;
  waypointsAttr: string;
}

function buildInflightRouteData(
  segs: readonly RouteSeg[],
  animName: string,
  startScale: number,
  endScale: number
): InflightRouteData | null {
  if (segs.length === 0) return null;
  const originX = segs[0].x0;
  const originY = segs[0].y0;

  const rawPts: { x: number; y: number; s: number }[] = [];
  let totalLen = 0;
  const samplesPerSeg = 24;
  for (const seg of segs) {
    for (let i = 0; i <= samplesPerSeg; i++) {
      if (rawPts.length > 0 && i === 0) continue;
      const pt = evalRouteSeg(seg, i / samplesPerSeg);
      if (rawPts.length > 0) {
        const prev = rawPts[rawPts.length - 1];
        totalLen += Math.hypot(pt.x - prev.x, pt.y - prev.y);
      }
      rawPts.push({ x: pt.x, y: pt.y, s: totalLen });
    }
  }
  if (rawPts.length < 2 || totalLen <= 0) return null;

  const sampleAtNormS = (normS: number): { x: number; y: number } => {
    const targetS = Math.min(1, Math.max(0, normS)) * totalLen;
    for (let i = 1; i < rawPts.length; i++) {
      if (rawPts[i].s >= targetS) {
        const prev = rawPts[i - 1];
        const curr = rawPts[i];
        const span = curr.s - prev.s || 1;
        const frac = (targetS - prev.s) / span;
        return {
          x: prev.x + (curr.x - prev.x) * frac,
          y: prev.y + (curr.y - prev.y) * frac,
        };
      }
    }
    return rawPts[rawPts.length - 1];
  };

  const travelEndPct = 85;
  const numStops = 16;
  const keyframeStops: string[] = [];
  const waypointPairs: string[] = [];

  for (let i = 0; i <= numStops; i++) {
    const u = i / numStops;
    const pct = (u * travelEndPct).toFixed(1).replace(/\.0$/, '');
    const eased = easeInOutQuad(u);
    const pt = sampleAtNormS(eased);
    const dx = (pt.x - originX).toFixed(1);
    const dy = (pt.y - originY).toFixed(1);
    const scale = (startScale + (endScale - startScale) * eased).toFixed(3);
    keyframeStops.push(
      `${pct}% { transform: translate(${dx}px, ${dy}px) scale(${scale}); opacity: 1; }`
    );
    if (i % 4 === 0 || i === numStops) {
      waypointPairs.push(`${Math.round(pt.x)},${Math.round(pt.y)}`);
    }
  }

  const endPt = rawPts[rawPts.length - 1];
  const endDx = (endPt.x - originX).toFixed(1);
  const endDy = (endPt.y - originY).toFixed(1);
  const endScaleStr = endScale.toFixed(3);
  keyframeStops.push(
    `92% { transform: translate(${endDx}px, ${endDy}px) scale(${endScaleStr}); opacity: 0.92; }`
  );
  keyframeStops.push(
    `100% { transform: translate(${endDx}px, ${endDy}px) scale(${endScaleStr}); opacity: 0; }`
  );

  return {
    path: segsToSvgPath(segs),
    keyframesCss: `@keyframes ${animName} {\n  ${keyframeStops.join('\n  ')}\n}`,
    animName,
    waypointsAttr: waypointPairs.join(';'),
  };
}

interface DockLayoutSlot {
  id: Exclude<DockId, 'SCRAP'>;
  cx: number;
}

function getDockLayout(docks: readonly DockState[], switchCount: number): DockLayoutSlot[] {
  if (switchCount === 0 && docks.length <= 1) {
    return [{ id: docks[0]?.id ?? 'DOCK_A', cx: 320 }];
  }
  if (docks.length <= 2 && switchCount <= 1) {
    return [
      { id: docks[0]?.id ?? 'DOCK_A', cx: 186 },
      { id: docks[1]?.id ?? 'DOCK_B', cx: 454 },
    ];
  }
  const positions = [128, 336, 524];
  return docks.slice(0, 3).map((d, i) => ({
    id: d.id,
    cx: positions[i] ?? 524,
  }));
}

interface TrackSegment {
  key: string;
  d: string;
  active: boolean;
  isSkipCandidate?: boolean;
  chevronPos?: { x: number; y: number; angleDeg: number };
}

function buildCurvedPath(x1: number, y1: number, x2: number, y2: number): string {
  const midY = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
}

export const SwitchyardCanvas: React.FC<SwitchyardCanvasProps> = ({
  state: propState,
  runtimeStatus,
  spotlightsOverride,
}) => {
  // All React hooks strictly above any conditional returns (per UI Guidelines)
  const {
    storeSwitchyardState,
    isLowQuality,
    speed,
    hasMultiVariant,
    appMode,
    activeActivityId,
    activeActivityVersion,
    activeDemoTabIndex,
  } = useAppStoreSelector((s) => ({
    storeSwitchyardState: s.switchyardState,
    isLowQuality: isLowQualityActive(s),
    speed: s.speed,
    hasMultiVariant: s.variantRuns.length > 1,
    appMode: s.appMode,
    activeActivityId: s.activeActivityId,
    activeActivityVersion: s.activeActivityVersion,
    activeDemoTabIndex: s.activeDemoTabIndex,
  }));

  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

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

  const state = propState || storeSwitchyardState;
  if (!state) {
    return (
      <div
        data-testid="switchyard-canvas"
        data-anim-duration={0}
        data-anim-event="NONE"
        className="w-full h-full flex items-center justify-center bg-[#dbeafe]"
      />
    );
  }

  const effectiveStatus = runtimeStatus ?? state.status;
  const isSuccess = effectiveStatus === 'SUCCESS';
  const isCollision = effectiveStatus === 'COLLISION';
  const animEv = state.lastAnimEvent;
  const rawAnimMs = computeSwitchyardAnimDurationMs(speed, isLowQuality, Boolean(animEv));
  const animMs = prefersReducedMotion ? 0 : rawAnimMs;
  const shouldAnimate = animMs > 0;
  const allowAmbientMotion =
    !isLowQuality &&
    !prefersReducedMotion &&
    speed !== 'instant' &&
    (typeof speed !== 'number' || speed > 0);
  const ambientAnimMs = allowAmbientMotion
    ? computeSwitchyardAnimDurationMs(speed, isLowQuality, true)
    : 0;

  const hasSensorBeamSpotlight = spotlights.includes('sensor-beam');
  const hasBranchSkipSpotlight = spotlights.includes('branch-skip');

  const headItem = state.queue[0];
  const peekQueue = state.queue.slice(1, 3);
  const hiddenExtraCount = Math.max(0, state.queue.length - 3);

  const switches = state.switches ?? [];
  const switchCount = switches.length;
  const swA: SwitchState | undefined = switches.find((s) => s.id === 'A') ?? switches[0];
  const swB: SwitchState | undefined =
    switchCount >= 2 ? switches.find((s) => s.id === 'B') ?? switches[1] : undefined;

  const dockSlots = getDockLayout(state.docks, switchCount);
  const dockCenterById = new Map<string, number>(dockSlots.map((s) => [s.id, s.cx]));

  const { targetDock, switchesTraversed } = resolveSwitchyardRoute(switches, state.docks);
  const bActive = switchesTraversed.includes('B');

  const showScrapChute =
    state.scrapRule !== 'none' &&
    (state.scrapped.length > 0 ||
      state.queue.some((i) => i.damaged) ||
      state.initialQueue.some((i) => i.damaged) ||
      state.scrapRule === 'damaged_only');

  // Switch hub coordinates
  const swACoord = switchCount >= 2 ? { x: 320, y: 270 } : { x: 320, y: 290 };
  const swBCoord = { x: 430, y: 344 };

  // Build track tree segments for 0, 1, or 2 switches
  const trackSegments: TrackSegment[] = [];
  if (switchCount === 0) {
    const cx = dockSlots[0]?.cx ?? 320;
    trackSegments.push({
      key: 'direct-dock-a',
      d: buildCurvedPath(320, 224, cx, 420),
      active: true,
      chevronPos: { x: 320, y: 326, angleDeg: 0 },
    });
  } else if (switchCount === 1 && swA) {
    const leftDest = swA.leftTarget === 'DOCK_B' ? 'DOCK_B' : 'DOCK_A';
    const rightDest = swA.rightTarget === 'DOCK_A' ? 'DOCK_A' : 'DOCK_B';
    const leftX = dockCenterById.get(leftDest) ?? 186;
    const rightX = dockCenterById.get(rightDest) ?? 454;

    trackSegments.push({
      key: 'trunk-a',
      d: `M 320 224 L ${swACoord.x} ${swACoord.y}`,
      active: true,
    });
    trackSegments.push({
      key: 'a-left',
      d: buildCurvedPath(swACoord.x, swACoord.y, leftX, 420),
      active: swA.direction === 'LEFT',
      isSkipCandidate: swA.direction !== 'LEFT',
      chevronPos: { x: (swACoord.x + leftX) / 2, y: 356, angleDeg: 28 },
    });
    trackSegments.push({
      key: 'a-right',
      d: buildCurvedPath(swACoord.x, swACoord.y, rightX, 420),
      active: swA.direction === 'RIGHT',
      isSkipCandidate: swA.direction !== 'RIGHT',
      chevronPos: { x: (swACoord.x + rightX) / 2, y: 356, angleDeg: -28 },
    });
  } else if (swA && swB) {
    const dockAX = dockCenterById.get(swA.leftTarget ?? 'DOCK_A') ?? 128;
    const dockBX = dockCenterById.get(swB.leftTarget ?? 'DOCK_B') ?? 336;
    const dockCX = dockCenterById.get(swB.rightTarget ?? 'DOCK_C') ?? 524;

    trackSegments.push({
      key: 'trunk-a',
      d: `M 320 224 L ${swACoord.x} ${swACoord.y}`,
      active: true,
    });
    trackSegments.push({
      key: 'a-left',
      d: buildCurvedPath(swACoord.x, swACoord.y, dockAX, 420),
      active: swA.direction === 'LEFT',
      isSkipCandidate: swA.direction !== 'LEFT',
      chevronPos: { x: 218, y: 344, angleDeg: 38 },
    });
    trackSegments.push({
      key: 'a-to-b',
      d: buildCurvedPath(swACoord.x, swACoord.y, swBCoord.x, swBCoord.y),
      active: swA.direction === 'RIGHT' && bActive,
      isSkipCandidate: swA.direction !== 'RIGHT',
      chevronPos: { x: 378, y: 306, angleDeg: -42 },
    });
    trackSegments.push({
      key: 'b-left',
      d: buildCurvedPath(swBCoord.x, swBCoord.y, dockBX, 420),
      active: bActive && swB.direction === 'LEFT',
      isSkipCandidate: !bActive || swB.direction !== 'LEFT',
      chevronPos: { x: 384, y: 382, angleDeg: 32 },
    });
    trackSegments.push({
      key: 'b-right',
      d: buildCurvedPath(swBCoord.x, swBCoord.y, dockCX, 420),
      active: bActive && swB.direction === 'RIGHT',
      isSkipCandidate: !bActive || swB.direction !== 'RIGHT',
      chevronPos: { x: 478, y: 382, angleDeg: -32 },
    });
  }

  const failureDiag = isCollision ? deriveSwitchyardFailureDiagnostic(state) : {};
  const failureDetail = failureDiag.detail;
  const strandedCount =
    failureDetail?.code === 'STRANDED_CARS'
      ? failureDetail.remainingCount ?? state.queue.length
      : failureDiag.reason === 'UNSORTED_ITEMS_REMAIN'
      ? state.queue.length
      : 0;

  const animSeq = animEv?.seq ?? animEv?.stepId ?? state.stepCount;
  const dispatchedItem = animEv?.dispatchedItem ?? animEv?.item;
  const destDock = animEv?.toDock ?? animEv?.targetDock;
  const isEnterScannerAnim =
    shouldAnimate && (animEv?.type === 'SEND_NEXT' || animEv?.type === 'SCRAP_ITEM');
  const isScrapAnim =
    shouldAnimate &&
    Boolean(dispatchedItem) &&
    (animEv?.type === 'SCRAP_ITEM' || (animEv?.type === 'SEND_NEXT' && destDock === 'SCRAP'));
  const isSendNextAnim =
    shouldAnimate &&
    animEv?.type === 'SEND_NEXT' &&
    Boolean(dispatchedItem) &&
    Boolean(destDock) &&
    destDock !== 'SCRAP';
  const isSwitchToggleAnim =
    shouldAnimate && (animEv?.type === 'SWITCH_LEFT' || animEv?.type === 'SWITCH_RIGHT');
  const switchTransitionMs = shouldAnimate ? animMs : 0;
  const isScrapFlash = isScrapAnim;
  const headColorMeta = headItem ? SWITCHYARD_COLOR_META[headItem.color] : undefined;

  let inflightRoute: InflightRouteData | null = null;
  if (isScrapAnim) {
    inflightRoute = buildInflightRouteData(
      [
        {
          kind: 'C',
          x0: 320,
          y0: 199,
          cx1: 380,
          cy1: 194,
          cx2: 470,
          cy2: 196,
          x1: 558,
          y1: 215,
        },
      ],
      `syInflightRoute_${animSeq}`,
      0.96,
      0.5
    );
  } else if (isSendNextAnim && destDock) {
    const destSlot = dockSlots.find((s) => s.id === destDock);
    const destDockObj = state.docks.find((d) => d.id === destDock);
    if (destSlot && destDockObj) {
      const bayWidth = dockSlots.length <= 2 ? 174 : 156;
      const visibleCars = destDockObj.items.slice(-3);
      const overflowCars = Math.max(0, destDockObj.items.length - visibleCars.length);
      const localTargetIdx =
        animEv?.targetSlotIndex !== undefined
          ? Math.max(0, Math.min(visibleCars.length - 1, animEv.targetSlotIndex - overflowCars))
          : Math.max(0, visibleCars.length - 1);
      const spacing = Math.min(44, (bayWidth - 44) / Math.max(1, visibleCars.length));
      const startX = destSlot.cx - ((visibleCars.length - 1) * spacing) / 2;
      const slotCx = visibleCars.length > 0 ? startX + localTargetIdx * spacing : destSlot.cx;
      const slotCy = 494;

      const routeSegs: RouteSeg[] = [{ kind: 'L', x0: 320, y0: 199, x1: 320, y1: 224 }];
      if (switchCount === 0) {
        routeSegs.push(makeCurvedSeg(320, 224, destSlot.cx, 420));
      } else if (switchCount === 1 || !swB) {
        routeSegs.push({ kind: 'L', x0: 320, y0: 224, x1: swACoord.x, y1: swACoord.y });
        routeSegs.push(makeCurvedSeg(swACoord.x, swACoord.y, destSlot.cx, 420));
      } else {
        routeSegs.push({ kind: 'L', x0: 320, y0: 224, x1: swACoord.x, y1: swACoord.y });
        const traversedB = animEv?.switchesTraversed
          ? animEv.switchesTraversed.includes('B')
          : (animEv?.switchADir ?? swA?.direction) === 'RIGHT' &&
            destDock !== (swA?.leftTarget ?? 'DOCK_A');
        if (traversedB) {
          routeSegs.push(makeCurvedSeg(swACoord.x, swACoord.y, swBCoord.x, swBCoord.y));
          routeSegs.push(makeCurvedSeg(swBCoord.x, swBCoord.y, destSlot.cx, 420));
        } else {
          routeSegs.push(makeCurvedSeg(swACoord.x, swACoord.y, destSlot.cx, 420));
        }
      }
      routeSegs.push(makeCurvedSeg(destSlot.cx, 420, slotCx, slotCy));

      inflightRoute = buildInflightRouteData(
        routeSegs,
        `syInflightRoute_${animSeq}`,
        0.96,
        0.62
      );
    }
  }

  return (
    <div
      data-testid="switchyard-canvas"
      data-anim-duration={animMs}
      data-anim-event={shouldAnimate && animEv ? animEv.type : 'NONE'}
      className="relative w-full h-full flex flex-col overflow-hidden select-none bg-gradient-to-b from-[#dbeafe] via-[#eff6ff] to-[#fef3c7]"
    >
      <style>{`${ANIM_KEYFRAMES}${inflightRoute ? `\n${inflightRoute.keyframesCss}` : ''}`}</style>

      {/* Top Centered Victory / Collision Pill safely below MultiRunPipsBar sky slot */}
      {isCollision && (
        <div
          data-testid="status-collision"
          className={`absolute ${
            hasMultiVariant ? 'top-14' : 'top-12'
          } right-3 z-20 px-3 py-1 bg-rose-600 text-white rounded-full font-black shadow-lg border-2 border-white flex items-center gap-1.5 pointer-events-none ${
            isLowQuality || prefersReducedMotion ? '' : 'animate-bounce'
          }`}
          style={
            shouldAnimate && animEv?.type === 'COLLISION'
              ? { animation: `syCollisionShake ${animMs}ms ease-out` }
              : undefined
          }
        >
          <span className="text-sm leading-none">
            {strandedCount > 0 ? `🚂 ×${strandedCount}` : '❌'}
          </span>
        </div>
      )}

      {isSuccess && (
        <div
          data-testid="status-success"
          className={`absolute ${
            hasMultiVariant ? 'top-14' : 'top-12'
          } left-1/2 -translate-x-1/2 z-20 px-4 py-1 bg-amber-400 text-slate-900 rounded-full font-black shadow-lg border-2 border-white flex items-center gap-1.5 pointer-events-none ${
            isLowQuality || prefersReducedMotion ? '' : 'animate-pulse'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span className="text-base leading-none">⭐ ⭐ ⭐</span>
        </div>
      )}

      {/* Daylight Top-to-Bottom Toy Railway Workshop SVG (y=0..48 kept open sky for HUD!) */}
      <svg
        viewBox="0 0 640 540"
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full flex-1 min-h-0"
        role="img"
        aria-label="Switchyard rail sorting workshop"
      >
        <defs>
          <linearGradient id="sy-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#dbeafe" />
            <stop offset="100%" stopColor="#eff6ff" />
          </linearGradient>
          <linearGradient id="sy-board" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fef9c3" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#fde68a" stopOpacity="0.88" />
          </linearGradient>
          <pattern id="sy-hazard-stripes" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="12" fill="#facc15" />
            <rect x="6" width="6" height="12" fill="#1e293b" />
          </pattern>
          <clipPath id="sy-tunnel-arch-clip">
            <rect x="50" y="76" width="120" height="60" rx="8" />
          </clipPath>
        </defs>

        {/* y = 0..48: Uncluttered HUD Sky Band */}
        <rect x="0" y="0" width="640" height="58" fill="url(#sy-sky)" />

        {/* Daylight Wooden Craft Workshop Deck (y = 54..540) */}
        <rect
          x="10"
          y="54"
          width="620"
          height="478"
          rx="22"
          fill="url(#sy-board)"
          stroke="#d9b27c"
          strokeWidth="4"
        />
        <rect
          x="16"
          y="60"
          width="608"
          height="466"
          rx="18"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.65"
          strokeWidth="2"
        />

        {/* Curved Feeder Track from Tunnel (190, 110) into Scanner Top (320, 152) */}
        <path
          d="M 184 110 C 266 110, 320 118, 320 156"
          fill="none"
          stroke="#d4a373"
          strokeWidth="20"
          strokeLinecap="round"
        />
        <path
          d="M 184 110 C 266 110, 320 118, 320 156"
          fill="none"
          stroke="#475569"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M 184 110 C 266 110, 320 118, 320 156"
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="6"
          strokeDasharray="6 8"
          strokeLinecap="round"
        />

        {/* Upper-Left Brick Masonry Tunnel & Convoy Queue (y >= 58) */}
        <g data-testid="switchyard-tunnel">
          {/* Tunnel Approach Track Bed */}
          <rect x="24" y="96" width="166" height="28" rx="6" fill="#334155" />
          <line x1="28" y1="104" x2="188" y2="104" stroke="#94a3b8" strokeWidth="2.5" />
          <line x1="28" y1="117" x2="188" y2="117" stroke="#94a3b8" strokeWidth="2.5" />

          {/* Brick Tunnel Arch Frame */}
          <path
            d="M 24 62 H 196 V 136 H 170 V 96 C 170 80, 156 76, 110 76 C 64 76, 50 80, 50 96 V 136 H 24 Z"
            fill="#c2410c"
            stroke="#7c2d12"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* Decorative Masonry Mortar Lines */}
          <path
            d="M 28 74 H 192 M 58 62 V 74 M 110 62 V 74 M 162 62 V 74"
            stroke="#fed7aa"
            strokeOpacity="0.45"
            strokeWidth="1.5"
          />

          {/* Cozy Hanging Warm Lantern */}
          <circle
            cx="182"
            cy="88"
            r="9"
            fill={state.queue.length === 0 && !isCollision ? '#34d399' : '#fde047'}
            stroke="#78350f"
            strokeWidth="2"
          />

          {/* Remaining Convoy Peek Cars inside Tunnel */}
          <g clipPath="url(#sy-tunnel-arch-clip)">
            {peekQueue
              .slice()
              .reverse()
              .map((peekItem, revIdx) => {
                const slotX = 136 - (peekQueue.length - 1 - revIdx) * 52;
                return (
                  <ToyRailCarSvg
                    key={peekItem.id}
                    testId={`switchyard-tunnel-car-${revIdx}`}
                    item={peekItem}
                    cx={slotX}
                    cy={106}
                    scale={0.72}
                    dimmed
                  />
                );
              })}
          </g>

          {/* +N Queue Counter Badge */}
          {state.queue.length > 0 && (
            <g transform="translate(46, 70)">
              <rect
                x="-22"
                y="-11"
                width="44"
                height="22"
                rx="11"
                fill="#0f172a"
                stroke="#38bdf8"
                strokeWidth="2"
              />
              <text
                x="0"
                y="4"
                textAnchor="middle"
                fill="#f8fafc"
                fontSize="12"
                fontWeight="900"
              >
                {hiddenExtraCount > 0 ? `+${state.queue.length}` : `×${state.queue.length}`}
              </text>
            </g>
          )}
        </g>

        {/* Track Tree (0, 1, or 2 Switches) */}
        <g data-testid="switchyard-track-tree">
          {trackSegments.map((seg) => (
            <g
              key={seg.key}
              data-testid={
                seg.isSkipCandidate && (hasBranchSkipSpotlight || !seg.active)
                  ? 'switchyard-branch-skip'
                  : undefined
              }
              data-spotlight={hasBranchSkipSpotlight && seg.isSkipCandidate ? 'true' : undefined}
            >
              {/* Wooden Track Ties Base */}
              <path
                d={seg.d}
                fill="none"
                stroke={seg.active ? '#d4a373' : '#cbd5e1'}
                strokeOpacity={seg.active ? 0.95 : 0.32}
                strokeWidth="22"
                strokeLinecap="round"
              />
              {/* Active Cyan-Sky Outer Glow */}
              {seg.active && (
                <path
                  d={seg.d}
                  fill="none"
                  stroke="#38bdf8"
                  strokeOpacity="0.45"
                  strokeWidth="26"
                  strokeLinecap="round"
                />
              )}
              {/* Twin Steel Track Channel */}
              <path
                d={seg.d}
                fill="none"
                stroke={seg.active ? '#0284c7' : '#64748b'}
                strokeOpacity={seg.active ? 1 : 0.3}
                strokeWidth="12"
                strokeLinecap="round"
              />
              {/* Animated Center Flow Line */}
              <path
                d={seg.d}
                fill="none"
                stroke={seg.active ? '#e0f2fe' : '#94a3b8'}
                strokeOpacity={seg.active ? 0.95 : 0.25}
                strokeWidth={seg.active ? '4' : '2.5'}
                strokeDasharray="6 6"
                strokeLinecap="round"
                style={
                  seg.active && allowAmbientMotion
                    ? { animation: `syChevronFlow ${Math.max(450, ambientAnimMs)}ms linear infinite` }
                    : undefined
                }
              />

              {/* Directional Chevron Indicator on Active Branches */}
              {seg.active && seg.chevronPos && (
                <g
                  transform={`translate(${seg.chevronPos.x}, ${seg.chevronPos.y}) rotate(${seg.chevronPos.angleDeg})`}
                >
                  <circle cx="0" cy="0" r="11" fill="#0ea5e9" stroke="#ffffff" strokeWidth="2" />
                  <path
                    d="M -4.5 -2 L 0 3.5 L 4.5 -2"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              )}
            </g>
          ))}
        </g>

        {/* Right-Wall Attached Hazard Trapdoor Chute & Scrap Bin */}
        {showScrapChute && (
          <g data-testid="switchyard-scrap-chute">
            {/* Chute Connector Ramp */}
            <path
              d="M 372 184 L 510 198 L 510 220 L 372 204 Z"
              fill={isScrapFlash ? '#fef08a' : '#e2e8f0'}
              stroke="#475569"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            {/* Yellow/Black Hazard Trapdoor Strip */}
            <rect
              x="382"
              y="182"
              width="58"
              height="10"
              rx="3"
              transform="rotate(7 382 182)"
              fill="url(#sy-hazard-stripes)"
              stroke="#0f172a"
              strokeWidth="1.5"
            />
            {/* Scrap Recycling Bin */}
            <g transform="translate(510, 174)">
              <path
                d="M 4 12 H 92 L 82 82 H 14 Z"
                fill={
                  failureDetail?.code === 'GOOD_SCRAPPED'
                    ? '#fecaca'
                    : isScrapFlash
                    ? '#fef08a'
                    : '#fffbeb'
                }
                stroke={failureDetail?.code === 'GOOD_SCRAPPED' ? '#dc2626' : '#d97706'}
                strokeWidth="3"
                strokeLinejoin="round"
              />
              <rect
                x="0"
                y="4"
                width="96"
                height="12"
                rx="5"
                fill="url(#sy-hazard-stripes)"
                stroke="#1e293b"
                strokeWidth="2"
              />
              <text x="48" y="34" textAnchor="middle" fontSize="18">
                ♻️
              </text>
              {/* Scrapped count chips */}
              {state.scrapped.length > 0 && (
                <g transform="translate(48, 68)">
                  <g
                    style={
                      isScrapAnim && state.scrapped.length === 1
                        ? { animation: `syDockSlotReveal ${animMs}ms linear both` }
                        : undefined
                    }
                  >
                    <rect x="-20" y="-10" width="40" height="20" rx="10" fill="#1e293b" />
                    <text
                      x="0"
                      y="4"
                      textAnchor="middle"
                      fill="#fef08a"
                      fontSize="12"
                      fontWeight="900"
                    >
                      ×{state.scrapped.length}
                    </text>
                  </g>
                </g>
              )}
            </g>
            {/* Latest Scrapped Car Mini Preview inside Bin */}
            {state.scrapped.length > 0 && (
              <ToyRailCarSvg
                key={`scrap-preview-${state.scrapped.length}-${state.scrapped[state.scrapped.length - 1].id}`}
                testId="switchyard-scrap-preview-car"
                item={state.scrapped[state.scrapped.length - 1]}
                cx={558}
                cy={222}
                scale={0.48}
                dimmed
                animStyle={
                  isScrapAnim
                    ? { animation: `syDockSlotReveal ${animMs}ms linear both` }
                    : undefined
                }
              />
            )}
          </g>
        )}

        {/* Inspection Scanner Gate (center x=320, y=150..228) */}
        <g data-testid="switchyard-scanner">
          {/* Scanner Housing Frame */}
          <rect
            x="262"
            y="150"
            width="116"
            height="78"
            rx="16"
            fill="#f8fafc"
            stroke={hasSensorBeamSpotlight ? '#0ea5e9' : '#475569'}
            strokeWidth={hasSensorBeamSpotlight ? '3.5' : '2.5'}
          />
          <rect x="272" y="176" width="96" height="46" rx="10" fill="#0f172a" />

          {/* Top Hood Sensor Trio (Color Lamp, Emblem Tile, Hazard Lamp) */}
          <g transform="translate(320, 163)">
            {/* Color Sensor Lamp */}
            <circle
              cx="-28"
              cy="0"
              r="8"
              fill={headColorMeta ? headColorMeta.hex : '#cbd5e1'}
              stroke="#1e293b"
              strokeWidth="1.8"
            />
            {/* Emblem Sensor Lamp */}
            <rect
              x="-10"
              y="-9"
              width="20"
              height="18"
              rx="4"
              fill="#e2e8f0"
              stroke="#1e293b"
              strokeWidth="1.6"
            />
            {headItem && (
              <ItemEmblemGlyph
                icon={headItem.icon}
                cx={0}
                cy={0}
                size={13}
                stroke="#0f172a"
                fill="#ffffff"
              />
            )}
            {/* Hazard / Damaged Lamp */}
            <circle
              cx="28"
              cy="0"
              r="8"
              fill={
                !headItem
                  ? '#cbd5e1'
                  : headItem.damaged
                  ? '#f59e0b'
                  : '#10b981'
              }
              stroke="#1e293b"
              strokeWidth="1.8"
            />
            {headItem?.damaged && (
              <text
                x="28"
                y="3.5"
                textAnchor="middle"
                fontSize="10"
                fontWeight="900"
                fill="#ffffff"
              >
                ⚡
              </text>
            )}
          </g>

          {/* Scanning Laser Beam */}
          <g
            data-testid="switchyard-sensor-beam"
            data-spotlight={hasSensorBeamSpotlight ? 'true' : undefined}
            style={
              allowAmbientMotion
                ? { animation: `syLaserPulse ${Math.max(800, ambientAnimMs)}ms ease-in-out infinite` }
                : undefined
            }
          >
            <line
              x1="276"
              y1="198"
              x2="364"
              y2="198"
              stroke={headItem?.damaged ? '#fbbf24' : '#38bdf8'}
              strokeWidth={hasSensorBeamSpotlight ? '4' : '2.5'}
              strokeLinecap="round"
            />
            <line
              x1="276"
              y1="198"
              x2="364"
              y2="198"
              stroke="#ffffff"
              strokeWidth="1"
              strokeOpacity="0.85"
            />
          </g>

          {/* Current Head Freight Car Centered in Scanner Gate */}
          {headItem && (
            <ToyRailCarSvg
              key={isEnterScannerAnim ? `${headItem.id}-enter-${animSeq}` : headItem.id}
              testId="switchyard-scanner-wagon"
              item={headItem}
              cx={320}
              cy={199}
              scale={0.96}
              inScanner
              animStyle={
                isEnterScannerAnim
                  ? { animation: `syCarEnterScanner ${animMs}ms ease-out both` }
                  : headItem.damaged && allowAmbientMotion
                  ? { animation: `syHazardSpark ${Math.max(700, ambientAnimMs)}ms ease-in-out infinite` }
                  : undefined
              }
            />
          )}
        </g>

        {/* Stranded Cars Bubble (`🚂 ×N left!`) when queue remains at program end */}
        {isCollision && strandedCount > 0 && (
          <g data-testid="switchyard-stranded-bubble" transform="translate(215, 162)">
            <rect
              x="-54"
              y="-20"
              width="108"
              height="34"
              rx="17"
              fill="#fff1f2"
              stroke="#e11d48"
              strokeWidth="2.5"
            />
            <text
              x="0"
              y="2"
              textAnchor="middle"
              fill="#be123c"
              fontSize="13"
              fontWeight="900"
            >
              {`🚂 ×${strandedCount} left!`}
            </text>
          </g>
        )}

        {/* Switch A Turntable Hub */}
        {swA && (
          <g data-testid="switchyard-switch-A" transform={`translate(${swACoord.x}, ${swACoord.y})`}>
            {isSwitchToggleAnim && (animEv?.junction ?? 'A') === 'A' && (
              <circle
                key={`sw-pulse-A-${animSeq}`}
                cx="0"
                cy="0"
                r="26"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="3"
                style={{
                  transformOrigin: '0px 0px',
                  animation: `sySwitchPulse ${animMs}ms ease-out both`,
                }}
              />
            )}
            <circle cx="0" cy="0" r="24" fill="#ffffff" stroke="#0284c7" strokeWidth="3.5" />
            <circle cx="0" cy="0" r="19" fill="#e0f2fe" />
            {/* Rotating Mechanical Rail Pointer (CSS transition strictly on inner <g>) */}
            <g
              data-testid="switchyard-switch-A-lever"
              style={{
                transformOrigin: '0px -14px',
                transform: `rotate(${swA.direction === 'LEFT' ? 25 : -25}deg)`,
                transitionProperty: 'transform',
                transitionDuration: `${switchTransitionMs}ms`,
                transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            >
              <line
                x1="0"
                y1="-14"
                x2="0"
                y2="16"
                stroke="#0369a1"
                strokeWidth="5"
                strokeLinecap="round"
              />
            </g>
            <circle cx="0" cy="0" r="10" fill="#0ea5e9" stroke="#ffffff" strokeWidth="2" />
            <text x="0" y="4" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="900">
              A
            </text>
          </g>
        )}

        {/* Switch B Turntable Hub (when 2-switch topology) */}
        {swB && (
          <g
            data-testid="switchyard-switch-B"
            transform={`translate(${swBCoord.x}, ${swBCoord.y})`}
            opacity={bActive ? 1 : 0.72}
          >
            {isSwitchToggleAnim && animEv?.junction === 'B' && (
              <circle
                key={`sw-pulse-B-${animSeq}`}
                cx="0"
                cy="0"
                r="24"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="3"
                style={{
                  transformOrigin: '0px 0px',
                  animation: `sySwitchPulse ${animMs}ms ease-out both`,
                }}
              />
            )}
            <circle
              cx="0"
              cy="0"
              r="22"
              fill="#ffffff"
              stroke={bActive ? '#d97706' : '#94a3b8'}
              strokeWidth="3.5"
            />
            <circle cx="0" cy="0" r="17" fill={bActive ? '#fef3c7' : '#f1f5f9'} />
            <g
              data-testid="switchyard-switch-B-lever"
              style={{
                transformOrigin: '0px -13px',
                transform: `rotate(${swB.direction === 'LEFT' ? 25 : -25}deg)`,
                transitionProperty: 'transform',
                transitionDuration: `${switchTransitionMs}ms`,
                transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            >
              <line
                x1="0"
                y1="-13"
                x2="0"
                y2="15"
                stroke={bActive ? '#b45309' : '#64748b'}
                strokeWidth="4.5"
                strokeLinecap="round"
              />
            </g>
            <circle
              cx="0"
              cy="0"
              r="9.5"
              fill={bActive ? '#f59e0b' : '#64748b'}
              stroke="#ffffff"
              strokeWidth="2"
            />
            <text x="0" y="3.5" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="900">
              B
            </text>
          </g>
        )}

        {/* Bottom Receiving Dock Bays (y = 418..520) */}
        <g data-testid="switchyard-docks">
          {dockSlots.map((slot) => {
            const dock = state.docks.find((d) => d.id === slot.id);
            if (!dock) return null;

            const isTargeted = targetDock === dock.id;
            const isDockFailed =
              isCollision &&
              (failureDetail?.dockId === dock.id ||
                (state.lastRoutedDock === dock.id && strandedCount === 0));
            const colorMeta = dock.spec.acceptColor
              ? SWITCHYARD_COLOR_META[dock.spec.acceptColor]
              : undefined;
            const bayWidth = dockSlots.length <= 2 ? 174 : 156;
            const leftX = slot.cx - bayWidth / 2;
            const dockLetter = dock.id.replace('DOCK_', '');

            const visibleCars = dock.items.slice(-3);
            const overflowCars = Math.max(0, dock.items.length - visibleCars.length);

            return (
              <g key={dock.id} data-testid={`switchyard-dock-${dock.id}`}>
                {/* Toy Loading Bay Box */}
                <rect
                  x={leftX}
                  y="418"
                  width={bayWidth}
                  height="100"
                  rx="16"
                  fill={isDockFailed ? '#fff1f2' : colorMeta ? colorMeta.lightBg : '#ffffff'}
                  stroke={
                    isDockFailed
                      ? '#e11d48'
                      : isTargeted
                      ? '#0ea5e9'
                      : colorMeta
                      ? colorMeta.stroke
                      : '#64748b'
                  }
                  strokeWidth={isDockFailed || isTargeted ? '3.5' : '2.5'}
                />

                {/* Top Dock Letter Tag + Optional Quota Pill */}
                <g transform={`translate(${leftX + 18}, 434)`}>
                  <circle
                    cx="0"
                    cy="0"
                    r="11"
                    fill={colorMeta ? colorMeta.hex : '#475569'}
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                  <text
                    x="0"
                    y="4"
                    textAnchor="middle"
                    fill={dock.spec.acceptColor === 'WHITE' ? '#0f172a' : '#ffffff'}
                    fontSize="11"
                    fontWeight="900"
                  >
                    {dockLetter}
                  </text>
                </g>

                {dock.spec.quota !== undefined && (
                  <g transform={`translate(${leftX + bayWidth - 28}, 434)`}>
                    <rect x="-18" y="-9" width="36" height="18" rx="9" fill="#0f172a" />
                    <text x="0" y="4" textAnchor="middle" fill="#f8fafc" fontSize="10" fontWeight="900">
                      {`${dock.items.length}/${dock.spec.quota}`}
                    </text>
                  </g>
                )}

                {/* No-Hazard Shield Corner Icon */}
                {dock.spec.rejectDamaged && (
                  <g transform={`translate(${leftX + bayWidth - 18}, 500)`} aria-label="No damaged cars">
                    <circle cx="0" cy="0" r="10" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.5" />
                    <text x="0" y="3.5" textAnchor="middle" fontSize="10">
                      ⚡
                    </text>
                    <line x1="-6" y1="-6" x2="6" y2="6" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" />
                  </g>
                )}

                {/* Large >=44px Floor Stencil Target Badge */}
                <g transform={`translate(${slot.cx}, 456)`}>
                  <rect
                    x="-24"
                    y="-22"
                    width="48"
                    height="44"
                    rx="11"
                    fill={colorMeta ? colorMeta.hex : '#e2e8f0'}
                    fillOpacity={colorMeta ? 0.25 : 0.7}
                    stroke={colorMeta ? colorMeta.stroke : '#64748b'}
                    strokeWidth="2.2"
                    strokeDasharray={dock.items.length === 0 ? '4 3' : undefined}
                  />
                  {dock.spec.acceptIcon ? (
                    <ItemEmblemGlyph
                      icon={dock.spec.acceptIcon}
                      cx={0}
                      cy={0}
                      size={22}
                      stroke={colorMeta ? colorMeta.stroke : '#0f172a'}
                      fill="#ffffff"
                    />
                  ) : (
                    <circle
                      cx="0"
                      cy="0"
                      r="12"
                      fill={colorMeta ? colorMeta.hex : '#94a3b8'}
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                  )}
                </g>

                {/* Parked Mini-Cars Successfully Sorted Into Dock */}
                {visibleCars.map((car, idx) => {
                  const spacing = Math.min(44, (bayWidth - 44) / Math.max(1, visibleCars.length));
                  const startX = slot.cx - ((visibleCars.length - 1) * spacing) / 2;
                  const actualItemIdx = overflowCars + idx;
                  const isNewest =
                    isSendNextAnim &&
                    destDock === dock.id &&
                    (animEv?.targetSlotIndex !== undefined
                      ? actualItemIdx === animEv.targetSlotIndex
                      : idx === visibleCars.length - 1);
                  return (
                    <ToyRailCarSvg
                      key={`${dock.id}-car-${actualItemIdx}-${car.id}`}
                      testId={`switchyard-dock-${dock.id}-car-${actualItemIdx}`}
                      item={car}
                      cx={startX + idx * spacing}
                      cy={494}
                      scale={0.62}
                      animStyle={
                        isNewest
                          ? { animation: `syDockSlotReveal ${animMs}ms linear both` }
                          : undefined
                      }
                    />
                  );
                })}

                {overflowCars > 0 && (
                  <g transform={`translate(${leftX + 22}, 500)`}>
                    <rect x="-14" y="-9" width="28" height="18" rx="9" fill="#0f172a" />
                    <text x="0" y="3.5" textAnchor="middle" fill="#f8fafc" fontSize="10" fontWeight="900">
                      +{overflowCars}
                    </text>
                  </g>
                )}

                {/* Zero-Reading Failure Diagnostic Bubble above Failing Dock */}
                {isDockFailed && failureDetail && (
                  <g
                    data-testid="switchyard-failure-bubble"
                    transform={`translate(${slot.cx}, 394)`}
                  >
                    <rect
                      x="-52"
                      y="-20"
                      width="104"
                      height="34"
                      rx="14"
                      fill="#fff1f2"
                      stroke="#e11d48"
                      strokeWidth="2.5"
                    />
                    {/* Actual vs Expected visual chips */}
                    <circle
                      cx="-26"
                      cy="-3"
                      r="8"
                      fill={
                        failureDetail.actualColor
                          ? SWITCHYARD_COLOR_META[failureDetail.actualColor].hex
                          : '#f59e0b'
                      }
                      stroke="#1e293b"
                      strokeWidth="1.5"
                    />
                    <text x="0" y="2" textAnchor="middle" fill="#e11d48" fontSize="14" fontWeight="900">
                      {failureDetail.code === 'DAMAGED_REJECTED' ? '⚡🚫' : '≠'}
                    </text>
                    {failureDetail.expectedIcon ? (
                      <ItemEmblemGlyph
                        icon={failureDetail.expectedIcon}
                        cx={26}
                        cy={-3}
                        size={14}
                        stroke="#0f172a"
                        fill="#ffffff"
                      />
                    ) : (
                      <circle
                        cx="26"
                        cy="-3"
                        r="8"
                        fill={
                          failureDetail.expectedColor
                            ? SWITCHYARD_COLOR_META[failureDetail.expectedColor].hex
                            : '#10b981'
                        }
                        stroke="#1e293b"
                        strokeWidth="1.5"
                      />
                    )}
                  </g>
                )}
              </g>
            );
          })}
        </g>

        {/* Zero-Reading Scrap Failure Bubble when Good Car Scrapped */}
        {isCollision && failureDetail?.code === 'GOOD_SCRAPPED' && (
          <g data-testid="switchyard-failure-bubble" transform="translate(556, 152)">
            <rect
              x="-44"
              y="-18"
              width="88"
              height="30"
              rx="14"
              fill="#fff1f2"
              stroke="#e11d48"
              strokeWidth="2.5"
            />
            <text x="0" y="2" textAnchor="middle" fill="#be123c" fontSize="13" fontWeight="900">
              ✓ ≠ ♻️
            </text>
          </g>
        )}

        {/* In-Flight Dispatched Freight Wagon Traveling Along Exact Rail Path */}
        {shouldAnimate && inflightRoute && dispatchedItem && (
          <g
            key={`inflight-${animSeq}`}
            data-testid="switchyard-inflight-wagon"
            data-route-path={inflightRoute.path}
            data-target-dock={destDock}
            data-anim-seq={animSeq}
            data-waypoints={inflightRoute.waypointsAttr}
            transform="translate(320, 199)"
          >
            <g
              style={{
                animation: `${inflightRoute.animName} ${animMs}ms linear both`,
              }}
            >
              <g transform={dispatchedItem.damaged ? 'rotate(-5)' : undefined}>
                <ToyRailCarBody item={dispatchedItem} />
              </g>
            </g>
          </g>
        )}
      </svg>
    </div>
  );
};
