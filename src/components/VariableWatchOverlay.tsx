import React, { useEffect, useRef, useState } from 'react';
import { isLowQualityActive, useAppStoreSelector } from '../store/useAppStore';

export interface VariableWatchOverlayProps {
  variables?: Record<string, number> | null;
  className?: string;
}

/**
 * Shape-socket shape symbols paired with variable names for color-blind accessible cues.
 * Canonical mapping per specs/curriculum_m4_m6_plan.md Commit 25:
 * a: ●, b: ▲, c: ■, s: ★, p: ♪, r: ↕, x: ↔, y: ↕
 */
const CANONICAL_VAR_SHAPES: Record<string, string> = {
  a: '●',
  b: '▲',
  c: '■',
  s: '★',
  p: '♪',
  r: '↕',
  x: '↔',
  y: '↕',
};

const VAR_SHAPE_FALLBACKS = ['●', '▲', '■', '◆', '★', '♪', '↕', '↔'] as const;

export function getVariableShapeSymbol(varName: string): string {
  if (CANONICAL_VAR_SHAPES[varName]) {
    return CANONICAL_VAR_SHAPES[varName];
  }
  const idx = varName.charCodeAt(0) - 97; // 'a' = 0
  return VAR_SHAPE_FALLBACKS[Math.max(0, idx) % VAR_SHAPE_FALLBACKS.length];
}

/**
 * Individual variable memory-box badge with pulse animation on value change.
 * Renders: 📦 a ● = 5
 * Guarantees 'a=5' is present for testing/SSR while presenting kid-friendly box.
 */
const VarBadge: React.FC<{
  varName: string;
  value: number;
  isLowQuality: boolean;
}> = ({ varName, value, isLowQuality }) => {
  const prevValueRef = useRef<number>(value);
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    if (prevValueRef.current !== value) {
      prevValueRef.current = value;
      if (!isLowQuality) {
        setPulsing(true);
        const t = setTimeout(() => setPulsing(false), 400);
        return () => clearTimeout(t);
      }
    }
  }, [value, isLowQuality]);

  const shape = getVariableShapeSymbol(varName);
  const displayValue = Number.isInteger(value) ? String(value) : value.toFixed(2);

  return (
    <span
      data-testid={`var-badge-${varName}`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border font-mono font-bold text-xs transition-all duration-150 ${
        pulsing
          ? 'bg-indigo-500/50 border-indigo-300/80 text-white scale-105'
          : 'bg-indigo-950/90 border-indigo-500/40 text-indigo-200'
      }`}
      title={`Variable ${varName} = ${value}`}
    >
      <span className="sr-only">{varName}={displayValue}</span>
      <span aria-hidden="true" className="inline-flex items-center gap-1">
        <span className="text-[10px] opacity-75">📦</span>
        <span className="text-indigo-300">{varName}</span>
        <span className="text-indigo-400 opacity-80 text-[10px]">{shape}</span>
        <span className="text-slate-400 text-[10px]">=</span>
        <span className="text-white">{displayValue}</span>
      </span>
    </span>
  );
};

/**
 * Compact, zero-reading variable watch strip rendered inside SimulationTopLeftHud
 * (data-testid="toolbar-variables"). Shows color+shape-tagged memory boxes
 * (`📦 a ● = 5`) only for referenced variables, with a crisp pulse animation on
 * value change. Designed to extend to circular color swatches in Module 7.
 *
 * Per docs/ui_guidelines.md §3: rendered inside the Top-Left Stack
 * (`absolute top-3 left-3 flex flex-col items-start gap-1.5`), never in <header>.
 */
export const VariableWatchOverlay: React.FC<VariableWatchOverlayProps> = ({
  variables: propVariables,
  className = '',
}) => {
  const isLowQuality = useAppStoreSelector((s) => isLowQualityActive(s));
  const storeVariables = useAppStoreSelector(
    (s) => s.runtime?.variables ?? (s as any).activeVariables ?? null
  );
  const resolvedVariables = propVariables !== undefined ? propVariables : storeVariables;
  const entries = resolvedVariables ? Object.entries(resolvedVariables) : [];
  if (entries.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="toolbar-variables"
      role="status"
      aria-live="polite"
      aria-label="Variable watch"
      className={`flex items-center flex-wrap gap-1.5 px-2.5 py-1 bg-slate-900/90 ${
        isLowQuality ? '' : 'backdrop-blur '
      }border border-indigo-500/50 rounded-xl text-xs shadow-lg ${className}`.trim()}
    >
      <span className="sr-only">VARS </span>
      {entries.map(([k, v]) => (
        <VarBadge
          key={k}
          varName={k}
          value={typeof v === 'number' ? v : Number(v) || 0}
          isLowQuality={isLowQuality}
        />
      ))}
    </div>
  );
};
