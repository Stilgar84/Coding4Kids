import React from 'react';
import { useAppStoreSelector } from '../../../store/useAppStore';
import {
  CrateColor,
  DEPOT_DEFAULT_STACK_MASK,
  DEPOT_MAX_QUEUE_LENGTH,
  DEPOT_RING_PALETTE,
  DEPOT_STATION_BITS,
  DepotQueueItem,
  DepotStacks,
  DepotState,
} from '../types';
import {
  cloneQueue,
  cloneStacks,
  createInitialDepotState,
} from '../depotPhysics';

interface DepotToolbarToolsProps {
  state: DepotState;
}

interface SandboxDepotPreset {
  id: string;
  label: string;
  stacks: DepotStacks;
  queue: DepotQueueItem[];
  input?: DepotQueueItem[];
  activeStationsMask: number;
}

const SANDBOX_PRESETS: readonly SandboxDepotPreset[] = [
  {
    id: 'stacks-queue',
    label: 'Stacks & Conveyor Ring Setup',
    stacks: [['RED', 'BLUE'], ['GREEN'], []],
    queue: [{ color: 'AMBER' }, { color: 'PURPLE' }, { color: 'CYAN' }],
    activeStationsMask:
      DEPOT_DEFAULT_STACK_MASK | DEPOT_STATION_BITS.QUEUE | DEPOT_STATION_BITS.OUT,
  },
  {
    id: 'input-fifo-sort',
    label: 'Input Dispenser & FIFO Sort Setup',
    stacks: [[], [], []],
    queue: [{ color: 'PINK' }, { color: 'ORANGE' }],
    input: [
      { color: 'RED' },
      { color: 'BLUE' },
      { color: 'PURPLE' },
      { color: 'AMBER' },
    ],
    activeStationsMask:
      DEPOT_DEFAULT_STACK_MASK |
      DEPOT_STATION_BITS.QUEUE |
      DEPOT_STATION_BITS.INPUT |
      DEPOT_STATION_BITS.OUT,
  },
  {
    id: 'ten-color-workshop',
    label: 'Ten-Color Peg & Queue Setup',
    stacks: [['BLACK', 'WHITE'], ['ORANGE', 'PINK'], ['CYAN']],
    queue: [{ color: 'PURPLE' }, { color: 'GREEN' }, { color: 'BLUE' }],
    input: [{ color: 'RED' }, { color: 'AMBER' }],
    activeStationsMask:
      DEPOT_DEFAULT_STACK_MASK |
      DEPOT_STATION_BITS.QUEUE |
      DEPOT_STATION_BITS.INPUT |
      DEPOT_STATION_BITS.OUT,
  },
];

function serializePresetKey(state: DepotState): string {
  return JSON.stringify({
    stacks: state.initialStacks,
    queue: state.initialQueue,
    input: state.initialInput ?? [],
  });
}

const SANDBOX_RING_ADD_COLORS: readonly CrateColor[] = DEPOT_RING_PALETTE
  .filter((c) => c.id !== 'BLACK' && c.id !== 'WHITE')
  .map((c) => c.id)
  .concat(['BLACK', 'WHITE']);

export const DepotToolbarTools: React.FC<DepotToolbarToolsProps> = () => {
  const { appMode, depotState, setDepotState } = useAppStoreSelector((s) => ({
    appMode: s.appMode,
    depotState: s.depotState,
    setDepotState: s.setDepotState,
  }));

  if (appMode !== 'sandbox') {
    return null;
  }

  const handleCyclePreset = () => {
    const currentKey = serializePresetKey(depotState);
    const curIdx = SANDBOX_PRESETS.findIndex(
      (p) =>
        JSON.stringify({
          stacks: p.stacks,
          queue: p.queue,
          input: p.input ?? [],
        }) === currentKey
    );
    const nextIdx = (curIdx + 1) % SANDBOX_PRESETS.length;
    const next = SANDBOX_PRESETS[nextIdx];
    setDepotState(
      createInitialDepotState({
        stacks: cloneStacks(next.stacks),
        queue: cloneQueue(next.queue),
        ...(next.input ? { input: cloneQueue(next.input), initialInput: cloneQueue(next.input) } : {}),
        activeStationsMask: next.activeStationsMask,
      })
    );
  };

  const handleAddQueueRing = () => {
    if (depotState.queue.length >= DEPOT_MAX_QUEUE_LENGTH) {
      return;
    }
    const nextColor =
      SANDBOX_RING_ADD_COLORS[depotState.queue.length % SANDBOX_RING_ADD_COLORS.length];
    const newQueue: DepotQueueItem[] = [
      ...depotState.queue,
      { color: nextColor },
    ];
    setDepotState({
      ...depotState,
      queue: newQueue,
      initialQueue: cloneQueue(newQueue),
      activeStationsMask:
        (depotState.activeStationsMask ?? DEPOT_DEFAULT_STACK_MASK) |
        DEPOT_STATION_BITS.QUEUE,
    });
  };

  return (
    <div className="flex items-center gap-1.5 bg-white/95 p-1 rounded-xl border border-slate-300 shadow-sm">
      <button
        type="button"
        data-testid="tool-depot-cycle-preset"
        onClick={handleCyclePreset}
        aria-label="Next Depot Ring Setup"
        title="Next Ring Setup"
        className="flex items-center justify-center min-w-[36px] min-h-[36px] md:min-w-[44px] md:min-h-[44px] w-9 h-9 md:w-11 md:h-11 rounded-lg border bg-amber-50 hover:bg-amber-100 border-amber-300 text-slate-800 transition-all active:scale-95"
      >
        {/* Custom stacked-ring preset switcher SVG (vertical peg + colored stacked rings + cycle arcs) */}
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M10 6 V19" stroke="#92400e" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M5 19.5 H15" stroke="#b45309" strokeWidth="2.2" strokeLinecap="round" />
          <rect x="6" y="15.2" width="8" height="3.2" rx="1.5" fill="#ef4444" stroke="#991b1b" strokeWidth="0.9" />
          <rect x="6.5" y="11.2" width="7" height="3.2" rx="1.5" fill="#3b82f6" stroke="#1e40af" strokeWidth="0.9" />
          <rect x="7" y="7.2" width="6" height="3.2" rx="1.5" fill="#8b5cf6" stroke="#5b21b6" strokeWidth="0.9" />
          <path d="M16.5 6.5 C18.5 6.5 20 8 20 10" stroke="#0284c7" strokeWidth="1.8" strokeLinecap="round" />
          <polyline points="18.2 9.4 20.1 10.6 21.2 8.7" stroke="#0284c7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <button
        type="button"
        data-testid="tool-depot-add-queue"
        onClick={handleAddQueueRing}
        aria-label="Add Conveyor Ring"
        title="Add Ring to Conveyor"
        className="flex items-center justify-center min-w-[36px] min-h-[36px] md:min-w-[44px] md:min-h-[44px] w-9 h-9 md:w-11 md:h-11 rounded-lg border bg-sky-50 hover:bg-sky-100 border-sky-300 text-slate-800 transition-all active:scale-95"
      >
        {/* Intact conveyor ring + forward arrow */}
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="9" cy="11" r="5" fill="#06b6d4" stroke="#155e75" strokeWidth="1.6" />
          <circle cx="9" cy="11" r="2" fill="#e0f2fe" />
          <path d="M4 18.5 H20" stroke="#475569" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="6.5" cy="18.5" r="1.2" fill="#64748b" />
          <circle cx="12" cy="18.5" r="1.2" fill="#64748b" />
          <circle cx="17.5" cy="18.5" r="1.2" fill="#64748b" />
          <path d="M16 11 H21" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" />
          <polyline points="18.5 8.5 21 11 18.5 13.5" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
};
