import React from 'react';
import { SwitchyardState } from '../types';

/**
 * Sandbox top-dock editor for Switchyard.
 * Shown in Sandbox mode; hidden on curriculum read-only maps (top-right shows 🔒 badge instead).
 * Intentionally minimal for now — full item/dock/switch editors can be added in C27+.
 */
export const SwitchyardToolbarTools: React.FC<{ state: SwitchyardState }> = (_props) => {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-400 select-none"
      data-testid="switchyard-toolbar-tools"
    >
      <span>🚂</span>
      <span className="font-semibold text-slate-300">Switchyard</span>
      <span className="text-slate-600">Sandbox</span>
    </div>
  );
};
