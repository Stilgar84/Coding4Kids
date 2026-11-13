import React from 'react';
import { SimulationStatus } from '../../../types';
import {
  SwitchyardState,
  SwitchyardItem,
  DockState,
  ITEM_COLORS,
  ITEM_ICONS,
} from '../types';
import { useAppStoreSelector } from '../../../store/useAppStore';
import { getActivityAtVersion, getActivityLatest } from '../../../data/curriculum';

// ─── Sizing constants ──────────────────────────────────────────────────────
const SVG_W = 480;
const SVG_H = 320;

const QUEUE_ITEM_W = 44;
const QUEUE_ITEM_H = 44;
const QUEUE_START_X = 20;
const QUEUE_Y = 60;
const QUEUE_GAP = 8;

const SCANNER_X = 190;
const SCANNER_Y = 42;
const SCANNER_W = 56;
const SCANNER_H = 76;

const SWITCH_X = 265;
const SWITCH_Y = 120;

const DOCK_W = 70;
const DOCK_H = 54;
const DOCK_A_X = 350;
const DOCK_A_Y = 60;
const DOCK_B_X = 350;
const DOCK_B_Y = 170;

const SCRAP_X = 350;
const SCRAP_Y = 265;

// ─── Helpers ───────────────────────────────────────────────────────────────

function colorHex(color: string): string {
  return ITEM_COLORS.find((c) => c.id === color)?.hex ?? '#94a3b8';
}

function iconEmoji(icon: string): string {
  return ITEM_ICONS.find((i) => i.id === icon)?.emoji ?? '📦';
}

/** Renders a single conveyor item card (SVG foreignObject for emoji). */
function ItemCard({
  item,
  x,
  y,
  w = QUEUE_ITEM_W,
  h = QUEUE_ITEM_H,
  atScanner = false,
  dimmed = false,
}: {
  item: SwitchyardItem;
  x: number;
  y: number;
  w?: number;
  h?: number;
  atScanner?: boolean;
  dimmed?: boolean;
}) {
  const hex = colorHex(item.color);
  return (
    <g opacity={dimmed ? 0.4 : 1}>
      {/* Glow ring when at scanner */}
      {atScanner && (
        <rect
          x={x - 3}
          y={y - 3}
          width={w + 6}
          height={h + 6}
          rx={8}
          fill="none"
          stroke="#fbbf24"
          strokeWidth={2.5}
          strokeDasharray={atScanner ? undefined : '4 3'}
        />
      )}
      {/* Body */}
      <rect x={x} y={y} width={w} height={h} rx={6} fill={hex} opacity={0.9} />
      {/* Cracked overlay for damaged items */}
      {item.damaged && (
        <line
          x1={x + 10}
          y1={y + 8}
          x2={x + w - 8}
          y2={y + h - 8}
          stroke="#fff"
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.7}
        />
      )}
      {/* Icon */}
      <text
        x={x + w / 2}
        y={y + h / 2 + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={atScanner ? 22 : 18}
      >
        {iconEmoji(item.icon)}
      </text>
      {/* Damage indicator spark */}
      {item.damaged && (
        <text
          x={x + w - 4}
          y={y + 4}
          textAnchor="end"
          dominantBaseline="hanging"
          fontSize={10}
        >
          ⚡
        </text>
      )}
    </g>
  );
}

/** Renders the illuminated scanner gate arch. */
function ScannerGate({
  active,
  x,
  y,
  w,
  h,
}: {
  active: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
}) {
  return (
    <g>
      {/* Background */}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={5}
        fill={active ? '#1e3a5f' : '#1e293b'}
        stroke={active ? '#38bdf8' : '#334155'}
        strokeWidth={2}
      />
      {/* Scanner beam */}
      {active && (
        <line
          x1={x + 4}
          y1={y + h / 2}
          x2={x + w - 4}
          y2={y + h / 2}
          stroke="#38bdf8"
          strokeWidth={1.5}
          strokeDasharray="3 2"
          opacity={0.7}
        />
      )}
      {/* Label */}
      <text
        x={x + w / 2}
        y={y + h - 6}
        textAnchor="middle"
        fontSize={9}
        fill={active ? '#7dd3fc' : '#64748b'}
        fontWeight="600"
      >
        SCAN
      </text>
    </g>
  );
}

/** Renders a track switch arrow. */
function SwitchArrow({
  direction,
  switchId,
  x,
  y,
}: {
  direction: 'LEFT' | 'RIGHT';
  switchId: string;
  x: number;
  y: number;
}) {
  const isLeft = direction === 'LEFT';
  return (
    <g>
      <circle cx={x} cy={y} r={16} fill={isLeft ? '#1e40af' : '#7c3aed'} stroke="#c4b5fd" strokeWidth={1.5} />
      <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle" fontSize={14} fill="#fff">
        {isLeft ? '←' : '→'}
      </text>
      <text x={x} y={y + 20} textAnchor="middle" fontSize={9} fill="#94a3b8">
        Sw {switchId}
      </text>
    </g>
  );
}

/** Renders a receiving dock. */
function DockBox({
  dock,
  x,
  y,
  label,
}: {
  dock: DockState;
  x: number;
  y: number;
  label: string;
}) {
  const spec = dock.spec;
  const hasItems = dock.items.length > 0;
  const isScrap = spec.id === 'SCRAP';

  return (
    <g>
      {/* Dock floor */}
      <rect
        x={x}
        y={y}
        width={DOCK_W}
        height={DOCK_H}
        rx={6}
        fill={dock.mismatch ? '#7f1d1d' : isScrap ? '#292524' : '#0f172a'}
        stroke={dock.mismatch ? '#ef4444' : isScrap ? '#78716c' : '#334155'}
        strokeWidth={2}
      />

      {/* Dock label */}
      <text x={x + DOCK_W / 2} y={y + 10} textAnchor="middle" fontSize={9} fill="#94a3b8" fontWeight="700">
        {label}
      </text>

      {/* Acceptance emblem */}
      {spec.acceptColor && (
        <circle
          cx={x + 14}
          cy={y + 26}
          r={6}
          fill={colorHex(spec.acceptColor)}
          opacity={0.9}
        />
      )}
      {spec.rejectDamaged && (
        <text x={x + 30} y={y + 30} fontSize={12} textAnchor="middle">
          🚫⚡
        </text>
      )}

      {/* Item count badge */}
      {hasItems && (
        <>
          <rect x={x + DOCK_W - 22} y={y + DOCK_H - 20} width={18} height={16} rx={4} fill="#1e293b" />
          <text
            x={x + DOCK_W - 13}
            y={y + DOCK_H - 11}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={10}
            fill="#34d399"
            fontWeight="700"
          >
            {dock.items.length}
          </text>
        </>
      )}

      {/* Mismatch indicator */}
      {dock.mismatch && (
        <text x={x + DOCK_W / 2} y={y + DOCK_H / 2 + 4} textAnchor="middle" fontSize={16}>
          💥
        </text>
      )}
    </g>
  );
}

// ─── Main Canvas ───────────────────────────────────────────────────────────

export const SwitchyardCanvas: React.FC<{
  state: SwitchyardState;
  runtimeStatus?: SimulationStatus;
  spotlightsOverride?: string[];
}> = ({ state, runtimeStatus, spotlightsOverride }) => {
  const { appMode, activeActivityId, activeActivityVersion, activeDemoTabIndex } =
    useAppStoreSelector((s) => ({
      appMode: s.appMode,
      activeActivityId: s.activeActivityId,
      activeActivityVersion: s.activeActivityVersion,
      activeDemoTabIndex: s.activeDemoTabIndex,
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

  const hasSensorBeam = spotlights.includes('sensor-beam');
  const hasBranchSkip = spotlights.includes('branch-skip');

  const hasScanner = state.queue.length > 0;
  const scannerItem = state.queue[0] ?? null;
  const queueRest = state.queue.slice(1);
  const isTwoSwitch = state.switches.length >= 2;

  // Map dock states to display configs
  const dockLabels = ['Dock A', 'Dock B', 'Dock C'];
  const dockYPositions = [DOCK_A_Y, DOCK_B_Y, DOCK_B_Y + DOCK_H + 12];

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950" data-testid="switchyard-canvas">
      {/* SVG simulation scene */}
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
        aria-label="Switchyard simulation"
      >
        {/* Background conveyor track */}
        <rect x={QUEUE_START_X} y={QUEUE_Y + 8} width={SCANNER_X - QUEUE_START_X} height={QUEUE_ITEM_H - 16} rx={4} fill="#1e293b" />
        {/* Track to switch */}
        <line x1={SCANNER_X + SCANNER_W} y1={QUEUE_Y + QUEUE_ITEM_H / 2} x2={SWITCH_X} y2={SWITCH_Y} stroke="#334155" strokeWidth={6} strokeLinecap="round" />

        {/* Track from switch to Dock A (left branch) */}
        <line x1={SWITCH_X} y1={SWITCH_Y} x2={DOCK_A_X} y2={DOCK_A_Y + DOCK_H / 2} stroke="#334155" strokeWidth={4} strokeLinecap="round" />
        {/* Track from switch to Dock B / Switch B area (right branch) */}
        {!isTwoSwitch ? (
          <line x1={SWITCH_X} y1={SWITCH_Y} x2={DOCK_B_X} y2={DOCK_B_Y + DOCK_H / 2} stroke="#334155" strokeWidth={4} strokeLinecap="round" />
        ) : (
          <>
            <line x1={SWITCH_X} y1={SWITCH_Y} x2={SWITCH_X + 24} y2={DOCK_B_Y + DOCK_H / 2} stroke="#334155" strokeWidth={4} />
            <line x1={SWITCH_X + 24} y1={DOCK_B_Y + DOCK_H / 2} x2={DOCK_B_X} y2={DOCK_B_Y + DOCK_H / 2} stroke="#334155" strokeWidth={4} />
            <line x1={SWITCH_X + 24} y1={DOCK_B_Y + DOCK_H / 2} x2={DOCK_B_X} y2={dockYPositions[2] + DOCK_H / 2} stroke="#334155" strokeWidth={4} />
          </>
        )}

        {/* Scanner gate */}
        <ScannerGate active={hasScanner} x={SCANNER_X} y={SCANNER_Y} w={SCANNER_W} h={SCANNER_H} />

        {/* Sensor-Beam Spotlight (Commit 27) */}
        {hasSensorBeam && scannerItem && (
          <g data-testid="switchyard-sensor-beam" className="pointer-events-none select-none">
            <line
              x1={SCANNER_X + SCANNER_W / 2}
              y1={SCANNER_Y + 4}
              x2={SCANNER_X + SCANNER_W / 2}
              y2={SCANNER_Y + SCANNER_H - 4}
              stroke="#38bdf8"
              strokeWidth={3}
              strokeDasharray="4 2"
              className="animate-pulse"
            />
            <circle
              cx={SCANNER_X + SCANNER_W / 2}
              cy={SCANNER_Y - 10}
              r={10}
              fill={scannerItem.damaged ? '#dc2626' : '#059669'}
              stroke="#ffffff"
              strokeWidth={1.5}
            />
            <text
              x={SCANNER_X + SCANNER_W / 2}
              y={SCANNER_Y - 9}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#ffffff"
              fontSize={10}
              fontWeight="900"
            >
              {scannerItem.damaged ? '⚠️' : '✓'}
            </text>
          </g>
        )}

        {/* Branch-Skip Switch Path Arc Indicator (Commit 27) */}
        {hasBranchSkip && state.switches.length > 0 && (
          <g data-testid="switchyard-branch-skip" className="pointer-events-none select-none">
            <path
              d={
                state.switches[0].direction === 'LEFT'
                  ? `M ${SWITCH_X} ${SWITCH_Y} Q ${SWITCH_X + 40} ${SWITCH_Y - 20} ${DOCK_A_X} ${DOCK_A_Y + DOCK_H / 2}`
                  : `M ${SWITCH_X} ${SWITCH_Y} Q ${SWITCH_X + 40} ${SWITCH_Y + 20} ${DOCK_B_X} ${DOCK_B_Y + DOCK_H / 2}`
              }
              fill="none"
              stroke="#38bdf8"
              strokeWidth={3}
              strokeDasharray="5 3"
              opacity={0.85}
              className="animate-pulse"
            />
          </g>
        )}

        {/* Item at scanner */}
        {scannerItem && (
          <ItemCard
            item={scannerItem}
            x={SCANNER_X + 6}
            y={SCANNER_Y + (SCANNER_H - QUEUE_ITEM_H) / 2}
            atScanner
          />
        )}

        {/* Incoming queue items (index 1+, right-to-left of scanner) */}
        {queueRest.map((item, i) => (
          <ItemCard
            key={i}
            item={item}
            x={SCANNER_X - (i + 1) * (QUEUE_ITEM_W + QUEUE_GAP) - QUEUE_GAP}
            y={QUEUE_Y}
            dimmed={i > 2}
          />
        ))}

        {/* Switch(es) */}
        {state.switches.map((sw, i) => (
          <SwitchArrow
            key={sw.id}
            direction={sw.direction}
            switchId={sw.id}
            x={SWITCH_X + i * 36}
            y={SWITCH_Y}
          />
        ))}

        {/* Docks */}
        {state.docks.map((dock, i) => (
          <DockBox
            key={dock.spec.id}
            dock={dock}
            x={DOCK_A_X}
            y={dockYPositions[i] ?? DOCK_B_Y + i * (DOCK_H + 12)}
            label={dockLabels[i] ?? `Dock ${i + 1}`}
          />
        ))}

        {/* Scrap chute */}
        <g>
          <rect x={SCRAP_X} y={SCRAP_Y} width={DOCK_W} height={36} rx={5} fill="#292524" stroke="#78716c" strokeWidth={1.5} />
          <text x={SCRAP_X + DOCK_W / 2} y={SCRAP_Y + 12} textAnchor="middle" fontSize={9} fill="#a8a29e" fontWeight="700">
            SCRAP
          </text>
          <text x={SCRAP_X + DOCK_W / 2} y={SCRAP_Y + 25} textAnchor="middle" fontSize={12}>
            🗑️ {state.scrapped.length > 0 ? `×${state.scrapped.length}` : ''}
          </text>
        </g>

        {/* Success / Collision overlay */}
        {(runtimeStatus === 'SUCCESS' || runtimeStatus === 'COLLISION') && (
          <text
            x={SVG_W / 2}
            y={SVG_H / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={48}
            opacity={0.85}
          >
            {runtimeStatus === 'SUCCESS' ? '🏁' : '💥'}
          </text>
        )}
      </svg>
    </div>
  );
};
