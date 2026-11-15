import React from 'react';
import { VariableWatchOverlay } from './VariableWatchOverlay';
import { SimulationStatus } from '../types';
import { useAppStoreSelector } from '../store/useAppStore';

export interface SimulationTopLeftHudProps {
  /** Optional simulation-specific top pill (rendered cleanly above runtime variables). */
  topSlot?: React.ReactNode;
  /** Runtime scalar variables rendered cleanly beneath topSlot. */
  variables?: Record<string, number> | null;
  /** Reserved vertical slot beneath variables for CallStack depth pills. */
  callStackSlot?: React.ReactNode;
  /** Optional simulation status override (defaults to active runtime status when omitted). */
  status?: SimulationStatus | null;
  /** Optional top offset override. */
  positionClassName?: string;
}

/**
 * Shared Top-Left Non-Overlapping HUD Stack (`flex-col items-start gap-1.5`) per
 * `docs/ui_guidelines.md` §3. Stacks optional topSlot, VariableWatchOverlay,
 * step-limit cue (`⏳🔁`), and CallStack pills cleanly without ever overlapping.
 */
export const SimulationTopLeftHud: React.FC<SimulationTopLeftHudProps> = ({
  topSlot = null,
  variables = null,
  callStackSlot = null,
  status,
  positionClassName = 'top-3 left-3',
}) => {
  const storeRuntimeStatus = useAppStoreSelector((s) => s.runtime?.status ?? null);
  const effectiveStatus = status !== undefined ? status : storeRuntimeStatus;
  const isStepLimit = effectiveStatus === 'STEP_LIMIT';
  const hasVariables = Boolean(variables && Object.keys(variables).length > 0);
  if (!topSlot && !hasVariables && !callStackSlot && !isStepLimit) {
    return null;
  }

  return (
    <div
      data-testid="simulation-top-left-hud"
      className={`absolute ${positionClassName} z-20 flex flex-col items-start gap-1.5 pointer-events-none`}
    >
      {topSlot}
      {isStepLimit && (
        <div
          data-testid="hud-step-limit-badge"
          role="status"
          aria-label="Step limit reached"
          title="Step limit reached"
          className="pointer-events-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-400/80 text-amber-200 text-xs font-black shadow-md"
        >
          <span aria-hidden="true">⏳🔁</span>
        </div>
      )}
      <VariableWatchOverlay variables={variables} />
      {callStackSlot}
    </div>
  );
};
