import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { getSimEnvironment } from '../engine/simulation/registry';
import { ParamVisual } from './params/VisualParamBadges';

export const BlockSubpalette: React.FC = () => {
  const {
    activeSimId,
    activeScope,
    workspace,
    selectedBlockId,
    updateBlockParams,
    isSubpaletteCollapsed,
  } = useAppStore();

  if (isSubpaletteCollapsed) {
    return null;
  }

  const blocks = workspace[activeScope] || [];
  const selectedBlock = selectedBlockId ? blocks.find((b) => b.id === selectedBlockId) : null;

  if (!selectedBlock) {
    return null;
  }

  const currentSimEnv = getSimEnvironment(activeSimId);
  const paletteItem = currentSimEnv?.paletteItems.find((p) => p.actionType === selectedBlock.type);
  const paramDefs = paletteItem?.paramDefs || [];

  if (paramDefs.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="block-subpalette"
      className="flex flex-col gap-2 bg-slate-950/70 border border-slate-800/80 rounded-xl mx-1 p-2 transition-all duration-200 shadow-inner animate-in fade-in slide-in-from-top-1"
    >
      {paramDefs.map((paramDef) => {
        const currentValue =
          selectedBlock.params?.[paramDef.id] !== undefined
            ? selectedBlock.params[paramDef.id]
            : paramDef.defaultValue;

        return (
          <div key={paramDef.id} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 px-1">
              <span>{paramDef.label}</span>
              <span className="text-amber-300 font-mono font-bold">
                {currentValue}
                {paramDef.unit || ''}
              </span>
            </div>

            <div className="palette-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1 px-1">
              {paramDef.options.map((opt) => {
                const isSelected = opt.value === currentValue;
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    data-testid={`subpalette-param-${paramDef.id}-${opt.value}`}
                    onClick={() =>
                      updateBlockParams(activeScope, selectedBlock.id, {
                        [paramDef.id]: opt.value,
                      })
                    }
                    className={`flex-shrink-0 flex flex-col items-center justify-center p-1.5 min-w-[42px] h-[46px] rounded-xl border text-xs font-semibold transition-all active:scale-95 touch-none ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-2 ring-amber-400/40 shadow-sm'
                        : 'bg-slate-900/90 hover:bg-slate-800/90 border-slate-700/80 text-slate-300 hover:border-slate-500'
                    }`}
                    title={`${paramDef.label}: ${opt.label || opt.value}`}
                  >
                    <ParamVisual
                      paramDef={paramDef}
                      value={opt.value}
                      compact={true}
                      actionType={selectedBlock.type}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
