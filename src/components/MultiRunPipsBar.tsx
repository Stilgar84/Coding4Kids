import React from 'react';
import { Check, Play, X } from 'lucide-react';
import {
  useAppStoreSelector,
  isLowQualityActive,
  VariantRunSnapshot,
} from '../store/useAppStore';

export interface MultiRunPipsBarViewProps {
  variants: readonly VariantRunSnapshot[];
  focusedIndex: number;
  onSelectVariant: (index: number) => void;
  className?: string;
}

function getStatusLabel(status: VariantRunSnapshot['status']): string {
  switch (status) {
    case 'SUCCESS':
      return 'passed';
    case 'COLLISION':
      return 'failed';
    case 'TYPE_ERROR':
      return 'type mismatch';
    case 'MATH_ERROR':
      return 'math error';
    case 'STACK_OVERFLOW':
      return 'stack overflow';
    case 'DEADLOCK':
      return 'deadlock';
    case 'STEP_LIMIT':
      return 'step limit reached';
    case 'RUNNING':
      return 'running';
    case 'PAUSED':
      return 'paused';
    default:
      return 'not run';
  }
}

/**
 * Pure presentational multi-variant pip bar (`[1 ✓] [2 ✗] [3 ·] [4 ·]`) for
 * synchronized multi-map / multi-stream curriculum challenges.
 * Returns null when fewer than 2 variants exist so single-map M1–M3 lessons stay clean.
 */
export const MultiRunPipsBarView: React.FC<MultiRunPipsBarViewProps> = ({
  variants,
  focusedIndex,
  onSelectVariant,
  className = '',
}) => {
  const isLowQuality = useAppStoreSelector((s) => isLowQualityActive(s));
  if (!variants || variants.length <= 1) {
    return null;
  }

  const passedCount = variants.filter((v) => v.status === 'SUCCESS').length;

  return (
    <div
      data-testid="multi-run-pips-bar"
      role="group"
      aria-label={`Test map variants (${passedCount} of ${variants.length} passed)`}
      className={`pointer-events-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/95 ${
        isLowQuality ? '' : 'backdrop-blur-md '
      }border border-slate-700/90 shadow-lg ${className}`.trim()}
    >
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {`Variant ${focusedIndex + 1} of ${variants.length} focused; ${passedCount} of ${variants.length} passed`}
      </div>
      {variants.map((variant, idx) => {
        const isFocused = idx === focusedIndex;
        const isSuccess = variant.status === 'SUCCESS';
        const isStepLimit = variant.status === 'STEP_LIMIT';
        const isFail =
          variant.status === 'COLLISION' ||
          variant.status === 'TYPE_ERROR' ||
          variant.status === 'MATH_ERROR' ||
          variant.status === 'STACK_OVERFLOW' ||
          variant.status === 'DEADLOCK';
        const isRunning = variant.status === 'RUNNING' || variant.status === 'PAUSED';
        const variantNumber = idx + 1;
        const statusText = getStatusLabel(variant.status);
        const labelSuffix = variant.label ? ` (${variant.label})` : '';

        const colorClasses = isSuccess
          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 hover:bg-emerald-500/30'
          : isStepLimit
          ? 'bg-amber-500/20 border-amber-400 text-amber-200 hover:bg-amber-500/30'
          : isFail
          ? 'bg-rose-500/20 border-rose-400 text-rose-200 hover:bg-rose-500/30'
          : isRunning
          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 hover:bg-cyan-500/30'
          : 'bg-slate-800/90 border-slate-600 text-slate-300 hover:bg-slate-700/90';

        const focusClasses = isFocused
          ? 'ring-2 ring-amber-300 ring-offset-1 ring-offset-slate-950 scale-105 font-black'
          : 'opacity-85 hover:opacity-100';

        return (
          <button
            key={variant.index}
            type="button"
            data-testid={`variant-pip-${variant.index}`}
            data-variant-status={variant.status}
            data-variant-focused={isFocused ? 'true' : 'false'}
            aria-pressed={isFocused}
            aria-label={`Variant ${variantNumber}${labelSuffix}: ${statusText}`}
            title={`Map ${variantNumber}${labelSuffix}: ${statusText}`}
            onClick={() => onSelectVariant(idx)}
            className={`min-h-[28px] min-w-[42px] px-2 py-0.5 rounded-full border text-xs font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${colorClasses} ${focusClasses}`}
          >
            <span className="font-mono">{variantNumber}</span>
            {isSuccess ? (
              <Check className="w-3.5 h-3.5 stroke-[3] text-emerald-300" aria-hidden="true" />
            ) : isStepLimit ? (
              <span aria-hidden="true" className="text-[11px] leading-none">
                ⏳🔁
              </span>
            ) : isFail ? (
              <X className="w-3.5 h-3.5 stroke-[3] text-rose-300" aria-hidden="true" />
            ) : isRunning ? (
              <Play className="w-3 h-3 fill-current text-cyan-300" aria-hidden="true" />
            ) : (
              <span aria-hidden="true" className="text-slate-400 leading-none">
                ·
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

/**
 * Store-connected Top-Center Pill rendering multi-variant run pips inside the
 * simulation viewport without overlapping Top-Left HUD or <header>.
 */
export const MultiRunPipsBar: React.FC<{ className?: string }> = ({ className = '' }) => {
  const variantRuns = useAppStoreSelector((s) => s.variantRuns);
  const focusedVariantIndex = useAppStoreSelector((s) => s.focusedVariantIndex);
  const setFocusedVariantIndex = useAppStoreSelector((s) => s.setFocusedVariantIndex);

  if (variantRuns.length <= 1) {
    return null;
  }

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
      <MultiRunPipsBarView
        variants={variantRuns}
        focusedIndex={focusedVariantIndex}
        onSelectVariant={setFocusedVariantIndex}
        className={className}
      />
    </div>
  );
};
