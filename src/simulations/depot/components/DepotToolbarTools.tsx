import React from 'react';
import { Shuffle, PlusCircle } from 'lucide-react';
import { useAppStoreSelector } from '../../../store/useAppStore';
import { CrateColor, DepotQueueItem, DepotStacks, DepotState } from '../types';
import { cloneQueue, cloneStacks, createInitialDepotState } from '../depotPhysics';

interface DepotToolbarToolsProps {
  state: DepotState;
}

interface SandboxDepotPreset {
  stacks: DepotStacks;
  queue: DepotQueueItem[];
}

const SANDBOX_PRESETS: readonly SandboxDepotPreset[] = [
  {
    stacks: [['RED', 'BLUE'], ['GREEN'], []],
    queue: [{ color: 'RED' }, { color: 'BLUE' }, { color: 'GREEN', damaged: true }],
  },
  {
    stacks: [['BLUE', 'RED', 'AMBER'], [], []],
    queue: [{ color: 'AMBER', damaged: true }, { color: 'RED' }],
  },
  {
    stacks: [['GREEN', 'RED'], ['AMBER', 'BLUE'], []],
    queue: [{ color: 'BLUE' }, { color: 'GREEN' }, { color: 'RED' }],
  },
];

function serializePresetKey(s: DepotStacks): string {
  return JSON.stringify(s);
}

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
    const currentKey = serializePresetKey(depotState.initialStacks);
    const curIdx = SANDBOX_PRESETS.findIndex((p) => serializePresetKey(p.stacks) === currentKey);
    const nextIdx = (curIdx + 1) % SANDBOX_PRESETS.length;
    const next = SANDBOX_PRESETS[nextIdx];
    setDepotState(
      createInitialDepotState({
        stacks: cloneStacks(next.stacks),
        queue: cloneQueue(next.queue),
      })
    );
  };

  const handleAddQueueCrate = () => {
    const colors: CrateColor[] = ['RED', 'BLUE', 'GREEN', 'AMBER'];
    const nextColor = colors[depotState.queue.length % colors.length];
    const isDamaged = depotState.queue.length % 2 === 1;
    const newQueue: DepotQueueItem[] = [
      ...depotState.queue,
      { color: nextColor, damaged: isDamaged || undefined },
    ];
    setDepotState({
      ...depotState,
      queue: newQueue,
      initialQueue: cloneQueue(newQueue),
    });
  };

  return (
    <div className="flex items-center gap-1.5 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
      <button
        type="button"
        data-testid="tool-depot-cycle-preset"
        onClick={handleCyclePreset}
        aria-label="Next Depot Crate Setup"
        title="Next Crate Setup"
        className="flex items-center justify-center w-9 h-9 rounded-lg border bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-300 transition-all active:scale-95"
      >
        <Shuffle className="w-4 h-4" />
      </button>

      <button
        type="button"
        data-testid="tool-depot-add-queue"
        onClick={handleAddQueueCrate}
        aria-label="Add Queue Crate"
        title="Add Crate to Queue"
        className="flex items-center justify-center w-9 h-9 rounded-lg border bg-slate-800 hover:bg-slate-700 border-slate-700 text-sky-300 transition-all active:scale-95 text-xs font-mono"
      >
        <PlusCircle className="w-4 h-4" />
      </button>
    </div>
  );
};
