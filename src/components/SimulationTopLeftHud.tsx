import React from 'react';
import { VariableWatchOverlay } from './VariableWatchOverlay';

export interface SimulationTopLeftHudProps {
  /** Optional simulation-specific top pill (rendered cleanly above runtime variables). */
  topSlot?: React.ReactNode;
  /** Runtime scalar variables rendered cleanly beneath topSlot. */
  variables?: Record<string, number> | null;
  /** Reserved vertical slot beneath variables for CallStack depth pills. */
  callStackSlot?: React.ReactNode;
  /** Optional top offset override. */
  positionClassName?: string;
}

/**
 * Shared Top-Left Non-Overlapping HUD Stack (`flex-col items-start gap-1.5`) per
 * `docs/ui_guidelines.md` §3. Stacks optional topSlot, VariableWatchOverlay, and
 * CallStack pills cleanly without ever overlapping.
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
