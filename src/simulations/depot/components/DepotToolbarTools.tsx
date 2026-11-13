import React from 'react';
import { Shuffle } from 'lucide-react';
import { useAppStoreSelector } from '../../../store/useAppStore';
import { DepotStacks, DepotState } from '../types';
import { cloneStacks, createInitialDepotState } from '../depotPhysics';

interface DepotToolbarToolsProps {
  state: DepotState;
}

const SANDBOX_PRESETS: readonly DepotStacks[] = [
  [['RED', 'BLUE'], ['GREEN'], []],
  [['BLUE', 'RED', 'AMBER'], [], []],
  [['GREEN', 'RED'], ['AMBER', 'BLUE'], []],
];

function serializeStacks(s: DepotStacks): string {
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
    const currentKey = serializeStacks(depotState.initialStacks);
    const curIdx = SANDBOX_PRESETS.findIndex((p) => serializeStacks(p) === currentKey);
    const nextIdx = (curIdx + 1) % SANDBOX_PRESETS.length;
    setDepotState(
      createInitialDepotState({
        stacks: cloneStacks(SANDBOX_PRESETS[nextIdx]),
      })
    );
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
    </div>
  );
};
