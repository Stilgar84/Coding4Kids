import React from 'react';
import { VariableWatchOverlay } from './VariableWatchOverlay';
import { SimulationStatus, VariableRuntimeValue } from '../types';
import { useAppStoreSelector } from '../store/useAppStore';

export interface SimulationTopLeftHudProps {
  /** Optional simulation-specific top pill (rendered cleanly above runtime variables). */
  topSlot?: React.ReactNode;
  /** Runtime scalar or typed variables rendered cleanly beneath topSlot. */
  variables?: Record<string, VariableRuntimeValue> | null;
  /** Reserved vertical slot beneath variables for CallStack depth pills. */
  callStackSlot?: React.ReactNode;
  /** Optional simulation status override (defaults to active runtime status when omitted). */
  status?: SimulationStatus | null;
  /** Optional top offset override. */
  positionClassName?: string;
}

const HUD_STATUS_BADGES: Partial<
  Record<
    SimulationStatus,
    { testId: string; label: string; icon: string; className: string }
  >
> = {
  TYPE_ERROR: {
    testId: 'hud-type-error-badge',
    label: 'Type mismatch',
    icon: '🎨≠#',
    className: 'bg-rose-500/20 border-rose-400/80 text-rose-200',
  },
  MATH_ERROR: {
    testId: 'hud-math-error-badge',
    label: 'Math error',
    icon: '🧮÷0',
    className: 'bg-rose-500/20 border-rose-400/80 text-rose-200',
  },
  STACK_OVERFLOW: {
    testId: 'hud-stack-overflow-badge',
    label: 'Stack overflow',
    icon: '📚💥',
    className: 'bg-rose-500/20 border-rose-400/80 text-rose-200',
  },
  STEP_LIMIT: {
    testId: 'hud-step-limit-badge',
    label: 'Step limit reached',
    icon: '⏳🔁',
    className: 'bg-amber-500/20 border-amber-400/80 text-amber-200',
  },
  DEADLOCK: {
    testId: 'hud-deadlock-badge',
    label: 'Deadlock detected',
    icon: '🔒💥',
    className: 'bg-rose-500/20 border-rose-400/80 text-rose-200',
  },
};

/**
 * Shared Top-Left Non-Overlapping HUD Stack (`flex-col items-start gap-1.5`) per
 * `docs/ui_guidelines.md` §3. Stacks optional topSlot, VariableWatchOverlay,
 * terminal error/step-limit cues, and CallStack pills cleanly without ever overlapping.
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
  const statusBadge = effectiveStatus ? HUD_STATUS_BADGES[effectiveStatus] : undefined;
  const hasVariables = Boolean(variables && Object.keys(variables).length > 0);
  if (!topSlot && !hasVariables && !callStackSlot && !statusBadge) {
    return null;
  }

  return (
    <div
      data-testid="simulation-top-left-hud"
      className={`absolute ${positionClassName} z-20 flex flex-col items-start gap-1.5 pointer-events-none`}
    >
      {topSlot}
      {statusBadge && (
        <div
          data-testid={statusBadge.testId}
          role="status"
          aria-label={statusBadge.label}
          title={statusBadge.label}
          className={`pointer-events-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-black shadow-md ${statusBadge.className}`}
        >
          <span aria-hidden="true">{statusBadge.icon}</span>
        </div>
      )}
      <VariableWatchOverlay variables={variables} status={effectiveStatus} />
      {callStackSlot}
    </div>
  );
};
