import React from 'react';
import { GitFork, Zap, Shuffle } from 'lucide-react';
import { useAppStoreSelector } from '../../../store/useAppStore';
import { ITEM_COLORS, ITEM_ICONS, SwitchyardItem, SwitchyardState } from '../types';
import { createInitialSwitchyardState } from '../physics';
import { DEFAULT_SWITCHYARD_STATE, HAZARD_PRESET, TWO_SWITCH_PRESET } from '../presets';

export interface SwitchyardToolbarToolsProps {
  state: SwitchyardState;
}

export const SwitchyardToolbarTools: React.FC<SwitchyardToolbarToolsProps> = () => {
  const { appMode, switchyardState, setSwitchyardState } = useAppStoreSelector((s) => ({
    appMode: s.appMode,
    switchyardState: s.switchyardState,
    setSwitchyardState: s.setSwitchyardState,
  }));

  if (appMode !== 'sandbox') {
    return null;
  }

  const isTwoSwitch = (switchyardState.switches?.length ?? 1) >= 2;
  const hasHazards = switchyardState.initialQueue.some((item) => item.damaged);

  const handleToggleTopology = () => {
    const nextPreset = isTwoSwitch ? DEFAULT_SWITCHYARD_STATE : TWO_SWITCH_PRESET;
    setSwitchyardState(createInitialSwitchyardState(nextPreset));
  };

  const handleToggleHazards = () => {
    if (!isTwoSwitch) {
      const nextPreset = hasHazards ? DEFAULT_SWITCHYARD_STATE : HAZARD_PRESET;
      setSwitchyardState(createInitialSwitchyardState(nextPreset));
      return;
    }
    const nextQueue: SwitchyardItem[] = switchyardState.initialQueue.map((item, idx) => ({
      ...item,
      damaged: hasHazards ? undefined : idx % 2 === 1,
    }));
    setSwitchyardState(
      createInitialSwitchyardState({
        ...switchyardState,
        queue: nextQueue,
        initialQueue: nextQueue,
      })
    );
  };

  const handleCycleStream = () => {
    const baseColors = isTwoSwitch ? (['RED', 'BLUE', 'GREEN'] as const) : (['RED', 'BLUE'] as const);
    const seed = switchyardState.initialQueue.length + (switchyardState.stepCount || 0) + 1;
    const nextQueue: SwitchyardItem[] = Array.from({ length: 4 }, (_, idx) => {
      const color = baseColors[(idx + seed) % baseColors.length] ?? ITEM_COLORS[0];
      const icon = ITEM_ICONS[(idx + seed) % ITEM_ICONS.length];
      return {
        id: `sb_${seed}_${idx}`,
        color,
        icon,
        ...(hasHazards && idx % 2 === 0 ? { damaged: true } : {}),
      };
    });
    setSwitchyardState(
      createInitialSwitchyardState({
        ...switchyardState,
        queue: nextQueue,
        initialQueue: nextQueue,
      })
    );
  };

  return (
    <div
      data-testid="switchyard-toolbar-tools"
      className="flex items-center gap-1.5 bg-slate-950/60 p-1 rounded-xl border border-slate-800"
    >
      <button
        type="button"
        data-testid="tool-switchyard-topology"
        onClick={handleToggleTopology}
        aria-label={isTwoSwitch ? 'Switch to 1-Switch topology' : 'Switch to 2-Switch topology'}
        title={isTwoSwitch ? '1-Switch' : '2-Switch'}
        className={`flex items-center justify-center gap-1 min-w-[36px] min-h-[36px] md:min-w-[44px] md:min-h-[44px] px-2 rounded-lg border font-black text-xs transition-all active:scale-95 ${
          isTwoSwitch
            ? 'bg-amber-500/20 border-amber-400 text-amber-200'
            : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-sky-300'
        }`}
      >
        <GitFork className="w-4 h-4" />
        <span>{isTwoSwitch ? 'A+B' : 'A'}</span>
      </button>

      <button
        type="button"
        data-testid="tool-switchyard-hazard"
        onClick={handleToggleHazards}
        aria-label={hasHazards ? 'Disable hazard cars' : 'Enable hazard cars'}
        title="Hazards"
        className={`flex items-center justify-center min-w-[36px] min-h-[36px] md:min-w-[44px] md:min-h-[44px] rounded-lg border transition-all active:scale-95 ${
          hasHazards
            ? 'bg-amber-500/25 border-amber-400 text-amber-300'
            : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
        }`}
      >
        <Zap className="w-4 h-4" />
      </button>

      <button
        type="button"
        data-testid="tool-switchyard-cycle"
        onClick={handleCycleStream}
        aria-label="Shuffle incoming convoy"
        title="New Convoy"
        className="flex items-center justify-center min-w-[36px] min-h-[36px] md:min-w-[44px] md:min-h-[44px] rounded-lg border bg-slate-800 hover:bg-slate-700 border-slate-700 text-emerald-300 transition-all active:scale-95"
      >
        <Shuffle className="w-4 h-4" />
      </button>
    </div>
  );
};
