import React from 'react';
import { isLowQualityActive, useAppStoreSelector } from '../store/useAppStore';

export interface VariableWatchOverlayProps {
  variables?: Record<string, number> | null;
  className?: string;
}

/**
 * Compact, zero-reading variable watch pill (`VARS a=1 b=2`) rendered inside
 * SimulationTopLeftHud when runtime variables exist.
 */
export const VariableWatchOverlay: React.FC<VariableWatchOverlayProps> = ({
  variables,
  className = '',
}) => {
  const isLowQuality = useAppStoreSelector((s) => isLowQualityActive(s));
  const entries = variables ? Object.entries(variables) : [];
  if (entries.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="toolbar-variables"
      className={`flex items-center flex-wrap gap-1.5 px-2.5 py-1 bg-slate-900/90 ${
        isLowQuality ? '' : 'backdrop-blur '
      }border border-indigo-500/50 rounded-xl text-xs shadow-lg ${className}`.trim()}
    >
      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider">
        VARS
      </span>
      {entries.map(([k, v]) => (
        <span
          key={k}
          data-testid={`var-badge-${k}`}
          className="px-1.5 py-0.5 rounded bg-indigo-950/90 border border-indigo-500/40 font-mono font-bold text-indigo-200"
        >
          {k}={v}
        </span>
      ))}
    </div>
  );
};
