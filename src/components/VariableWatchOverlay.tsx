import React, { useEffect, useRef, useState } from 'react';
import { isLowQualityActive, useAppStoreSelector } from '../store/useAppStore';
import {
  isTypedValue,
  SimulationStatus,
  TypedValue,
  VariableRuntimeValue,
} from '../types';
import {
  TURTLE_COLOR_PALETTE,
  colorLiteralNameToIdx,
} from '../engine/serialization/types';

export interface VariableWatchOverlayProps {
  variables?: Record<string, VariableRuntimeValue> | null;
  status?: SimulationStatus | null;
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
function formatVarDisplay(raw: VariableRuntimeValue): {
  key: string;
  text: string;
  colorName?: string;
  swatchHex?: string;
} {
  if (isTypedValue(raw)) {
    const tv = raw as TypedValue;
    if (tv.type === 'color') {
      const idx = colorLiteralNameToIdx(tv.value);
      const hex = idx >= 0 ? TURTLE_COLOR_PALETTE[idx] : '#ef4444';
      return {
        key: `color:${tv.value}`,
        text: tv.value,
        colorName: tv.value,
        swatchHex: hex,
      };
    }
    const num = Number(tv.value) || 0;
    const text = Number.isInteger(num) ? String(num) : num.toFixed(2);
    return { key: `num:${num}`, text };
  }
  const num = typeof raw === 'number' ? raw : Number(raw) || 0;
  const text = Number.isInteger(num) ? String(num) : num.toFixed(2);
  return { key: `num:${num}`, text };
}

/**
 * Individual variable memory-box badge with pulse animation on value change.
 * Renders: 📦 a ● = 5 (or circular color swatch for TypedValue colors).
 * Guarantees 'a=5' / 'a=red' is present for testing/SSR while presenting kid-friendly box.
 */
const VarBadge: React.FC<{
  varName: string;
  value: VariableRuntimeValue;
  isLowQuality: boolean;
  isTypeError?: boolean;
}> = ({ varName, value, isLowQuality, isTypeError = false }) => {
  const formatted = formatVarDisplay(value);
  const prevValueRef = useRef<string>(formatted.key);
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    if (prevValueRef.current !== formatted.key) {
      prevValueRef.current = formatted.key;
      if (!isLowQuality) {
        setPulsing(true);
        const t = setTimeout(() => setPulsing(false), 400);
        return () => clearTimeout(t);
      }
    }
  }, [formatted.key, isLowQuality]);

  const shape = getVariableShapeSymbol(varName);

  return (
    <span
      data-testid={`var-badge-${varName}`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border font-mono font-bold text-xs transition-all duration-150 ${
        isTypeError && !isLowQuality ? 'animate-bounce border-rose-400/90 ' : ''
      }${
        pulsing
          ? 'bg-indigo-500/50 border-indigo-300/80 text-white scale-105'
          : 'bg-indigo-950/90 border-indigo-500/40 text-indigo-200'
      }`}
      title={`Variable ${varName} = ${formatted.text}`}
    >
      <span className="sr-only">{varName}={formatted.text}</span>
      <span aria-hidden="true" className="inline-flex items-center gap-1">
        <span className="text-[10px] opacity-75">📦</span>
        <span className="text-indigo-300">{varName}</span>
        <span className="text-indigo-400 opacity-80 text-[10px]">{shape}</span>
        <span className="text-slate-400 text-[10px]">=</span>
        {formatted.swatchHex ? (
          <span
            data-testid={`var-color-swatch-${varName}`}
            className="inline-block w-3 h-3 rounded-full border border-white/80 shadow-sm"
            style={{ backgroundColor: formatted.swatchHex }}
          />
        ) : (
          <span className="text-white">{formatted.text}</span>
        )}
      </span>
    </span>
  );
};

/**
 * Compact, zero-reading variable watch strip rendered inside SimulationTopLeftHud
 * (data-testid="toolbar-variables"). Shows color+shape-tagged memory boxes
 * (`📦 a ● = 5`) or circular color swatches for TypedValue colors, with pulse animation
 * on value change and bounce cue on TYPE_ERROR.
 */
export const VariableWatchOverlay: React.FC<VariableWatchOverlayProps> = ({
  variables: propVariables,
  status: propStatus,
  className = '',
}) => {
  const isLowQuality = useAppStoreSelector((s) => isLowQualityActive(s));
  const storeVariables = useAppStoreSelector((s) => {
    const rtVars = s.runtime?.variables;
    const actVars = (s as any).activeVariables;
    return (rtVars && Object.keys(rtVars).length > 0 ? rtVars : actVars ?? rtVars ?? null) as Record<
      string,
      VariableRuntimeValue
    > | null;
  });
  const storeStatus = useAppStoreSelector((s) => s.runtime?.status ?? null);
  const effectiveStatus = propStatus !== undefined ? propStatus : storeStatus;
  const isTypeError = effectiveStatus === 'TYPE_ERROR';
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
      }border ${
        isTypeError ? 'border-rose-400/80' : 'border-indigo-500/50'
      } rounded-xl text-xs shadow-lg ${className}`.trim()}
    >
      <span className="sr-only">VARS </span>
      {entries.map(([k, v]) => (
        <VarBadge
          key={k}
          varName={k}
          value={v}
          isLowQuality={isLowQuality}
          isTypeError={isTypeError}
        />
      ))}
    </div>
  );
};
