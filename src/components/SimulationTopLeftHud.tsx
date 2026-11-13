import React from 'react';
import { VariableWatchOverlay } from './VariableWatchOverlay';

export interface SimulationTopLeftHudProps {
  /** Optional simulation-specific top pill (e.g., Grid 1-slot BackpackHud). */
  topSlot?: React.ReactNode;
  /** Runtime scalar variables rendered cleanly beneath topSlot. */
  variables?: Record<string, number> | null;
  /** Reserved vertical slot beneath variables for future CallStack depth pills (M11). */
  callStackSlot?: React.ReactNode;
  /** Optional top offset override (e.g., below Depot's in-flow status strip). */
  positionClassName?: string;
}

/**
 * Shared Top-Left Non-Overlapping HUD Stack (`flex-col items-start gap-1.5`) per
 * `docs/ui_guidelines.md` §3. Guarantees BackpackHud, VariableWatchOverlay, and
 * future CallStack pills stack cleanly without ever overlapping.
 */
export const SimulationTopLeftHud: React.FC<SimulationTopLeftHudProps> = ({
  topSlot = null,
  variables = null,
  callStackSlot = null,
  positionClassName = 'top-3 left-3',
}) => {
  const hasVariables = Boolean(variables && Object.keys(variables).length > 0);
  if (!topSlot && !hasVariables && !callStackSlot) {
    return null;
  }

  return (
    <div
      data-testid="simulation-top-left-hud"
      className={`absolute ${positionClassName} z-20 flex flex-col items-start gap-1.5 pointer-events-none`}
    >
      {topSlot}
      <VariableWatchOverlay variables={variables} />
      {callStackSlot}
    </div>
  );
};
