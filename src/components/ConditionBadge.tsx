import React from 'react';
import type { ConditionExpr } from '../data/curriculum/types';
import { isColorLiteralString, TURTLE_COLOR_PALETTE } from '../engine/serialization/types';
import { PALETTE_COLOR_NAMES } from '../engine/serialization/conditionSerializer';

function normalizeBadgeColorName(raw?: string): string {
  const s = String(raw ?? 'red').trim().toLowerCase();
  const stripped = s.startsWith('color:') ? s.slice(6) : s;
  return stripped === 'yellow' ? 'amber' : stripped;
}

function resolveBadgeColorHex(raw?: string): string {
  const norm = normalizeBadgeColorName(raw);
  const idx = PALETTE_COLOR_NAMES.indexOf(norm);
  return idx >= 0 ? TURTLE_COLOR_PALETTE[idx] : '#ef4444';
}

const ClawRingSvg: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={className}>
    <path
      d="M10 1.5v3M6.5 6.5L10 4.5l3.5 2M5.5 7.5c-1 2.2-.8 4.4.8 5.8M14.5 7.5c1 2.2.8 4.4-.8 5.8"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="10" cy="13.5" r="3.4" stroke="currentColor" strokeWidth="2.1" />
  </svg>
);

const StackTopSvg: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={className}>
    <rect x="4" y="3.5" width="12" height="3.5" rx="1" fill="currentColor" />
    <rect x="4" y="9" width="12" height="3" rx="1" stroke="currentColor" strokeWidth="1.4" opacity="0.65" />
    <rect x="4" y="13.8" width="12" height="3" rx="1" stroke="currentColor" strokeWidth="1.4" opacity="0.45" />
  </svg>
);

export interface ConditionBadgeProps {
  condition?: ConditionExpr;
  compact?: boolean;
  className?: string;
}

/**
 * Kid-friendly zero-reading visual badge for ConditionExpr on IF, ELSE_IF, and WHILE cards.
 */
export const ConditionBadge: React.FC<ConditionBadgeProps> = ({
  condition,
  compact = false,
  className = '',
}) => {
  if (!condition) {
    return (
      <span className={`text-[10px] font-mono text-cyan-200 ${className}`}>
        ?
      </span>
    );
  }

  const renderExpr = (expr: ConditionExpr): React.ReactNode => {
    switch (expr.kind) {
      case 'not':
        return (
          <span className="inline-flex items-center gap-0.5">
            <span className="font-mono font-black text-rose-300">!</span>
            {renderExpr(expr.operand)}
          </span>
        );

      case 'and':
        return (
          <span className="inline-flex items-center gap-0.5">
            {renderExpr(expr.left)}
            <span className="font-mono font-black text-amber-300 text-[9px]">&amp;</span>
            {renderExpr(expr.right)}
          </span>
        );

      case 'or':
        return (
          <span className="inline-flex items-center gap-0.5">
            {renderExpr(expr.left)}
            <span className="font-mono font-black text-amber-300 text-[9px]">||</span>
            {renderExpr(expr.right)}
          </span>
        );

      case 'cmp': {
        const isInputLeft = expr.left === '$input';
        const opGlyph = expr.op === '=' ? '=' : expr.op === '!=' ? '≠' : expr.op;
        const rightStr = String(expr.right);
        const isColorRight = isColorLiteralString(expr.right);
        const swatchHex = isColorRight ? resolveBadgeColorHex(rightStr) : null;
        return (
          <span
            data-sensor={isInputLeft ? '$input' : 'cmp'}
            title={`${expr.left} ${expr.op} ${expr.right}`}
            className="inline-flex items-center gap-1 font-mono text-[9px] font-bold text-cyan-200"
          >
            <span>{isInputLeft ? '🎛️' : String(expr.left)}</span>
            <span className="text-amber-300 font-black">{opGlyph}</span>
            {swatchHex ? (
              <span
                aria-label={normalizeBadgeColorName(rightStr)}
                className="inline-block w-2.5 h-2.5 rounded-full border border-white/80 shadow-sm"
                style={{ backgroundColor: swatchHex }}
              />
            ) : (
              <span className="px-1 rounded bg-slate-800/90 border border-slate-600/80 text-white">
                {rightStr}
              </span>
            )}
          </span>
        );
      }

      case 'sensor':
        return renderSensor(expr.sensor, expr.param);

      default:
        return null;
    }
  };

  const renderSensor = (sensor: string, param?: string): React.ReactNode => {
    switch (sensor) {
      case 'pathAhead':
        return <span title="Path Ahead">⬆️</span>;
      case 'pathLeft':
        return <span title="Path Left">⬅️</span>;
      case 'pathRight':
        return <span title="Path Right">➡️</span>;
      case 'itemHere':
        return (
          <span
            data-sensor="itemHere"
            title="Item Here"
            className="inline-flex items-center justify-center"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              className="w-3.5 h-3.5 text-amber-300"
            >
              <path d="M3 16.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
              <rect x="6" y="8" width="8" height="6.5" rx="1.2" fill="currentColor" fillOpacity="0.85" />
              <path d="M10 2.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8.8-1.9z" fill="#fde047" />
            </svg>
          </span>
        );
      case 'unvisitedAhead':
        return (
          <span
            data-sensor="unvisitedAhead"
            title="Unvisited Ahead"
            className="inline-flex items-center justify-center"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              className="w-3.5 h-3.5 text-cyan-300"
            >
              <ellipse cx="8.2" cy="7.5" rx="2.6" ry="3.8" fill="currentColor" opacity="0.9" />
              <rect x="6.5" y="12.2" width="3.4" height="2.4" rx="1" fill="currentColor" opacity="0.9" />
              <ellipse cx="13.5" cy="9.5" rx="2" ry="2.9" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2 1.5" />
            </svg>
          </span>
        );
      case 'insideCanvas':
        return (
          <span
            data-sensor="insideCanvas"
            title="Inside Canvas"
            className="inline-flex items-center justify-center"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              className="w-3.5 h-3.5 text-emerald-300"
            >
              <rect
                x="3"
                y="3"
                width="14"
                height="14"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeDasharray="3 2"
              />
              <circle cx="10" cy="10" r="2.2" fill="currentColor" />
            </svg>
          </span>
        );
      case 'cursorAtEdge':
        return (
          <span
            data-sensor="cursorAtEdge"
            title="Cursor At Edge"
            className="inline-flex items-center justify-center"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              className="w-3.5 h-3.5 text-amber-300"
            >
              <rect x="3" y="3" width="14" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.6" opacity="0.7" />
              <rect x="12.5" y="4.5" width="3.5" height="3.5" rx="0.6" fill="#22d3ee" />
            </svg>
          </span>
        );
      case 'carryingItem':
        return (
          <span
            title="Carrying Item"
            className="inline-flex items-center justify-center"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              className="w-3.5 h-3.5 text-amber-300"
            >
              <path
                d="M10 2v3M6.5 6.5L10 5l3.5 1.5M5.5 7.5c-1 2.2-.8 4.4.8 5.8M14.5 7.5c1 2.2.8 4.4-.8 5.8"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect
                x="7"
                y="9"
                width="6"
                height="6"
                rx="1.2"
                fill="currentColor"
                fillOpacity="0.9"
              />
            </svg>
          </span>
        );
      case 'atGoal':
        return <span title="At Goal">🏁</span>;
      case 'tileColor': {
        const swatchHex = param ? resolveBadgeColorHex(param) : null;
        return (
          <span
            data-sensor="tileColor"
            className="inline-flex items-center gap-0.5"
            title={`Tile Color: ${param ?? ''}`}
          >
            <span>🎨</span>
            {swatchHex ? (
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm border border-white/80 shadow-sm"
                style={{ backgroundColor: swatchHex }}
              />
            ) : (
              param && <span className="text-[9px] font-bold uppercase">{param}</span>
            )}
          </span>
        );
      }
      case 'hasNextItem':
        return (
          <span
            data-sensor="hasNextItem"
            title="Has Next Item"
            className="inline-flex items-center gap-0.5"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              className="w-3.5 h-3.5 text-sky-300"
            >
              <rect x="2.5" y="6" width="12" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.7" fill="currentColor" fillOpacity="0.2" />
              <circle cx="5.5" cy="15" r="1.5" fill="currentColor" />
              <circle cx="11.5" cy="15" r="1.5" fill="currentColor" />
            </svg>
            <span className="text-[9px] font-black text-amber-300 leading-none">?</span>
          </span>
        );
      case 'itemDamaged':
        return (
          <span
            data-sensor="itemDamaged"
            title="Item Damaged"
            className="inline-flex items-center gap-0.5"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              className="w-3.5 h-3.5 text-rose-300"
            >
              <rect x="2.5" y="6" width="13" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
              <path d="M9.5 6L8 9.5l2.5 1L9 13" stroke="#fde047" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="6" cy="15" r="1.4" fill="currentColor" />
              <circle cx="12.5" cy="15" r="1.4" fill="currentColor" />
            </svg>
            <span className="text-[9px] leading-none">⚡</span>
          </span>
        );
      case 'itemColor': {
        const swatchHex = resolveBadgeColorHex(param);
        return (
          <span
            data-sensor="itemColor"
            className="inline-flex items-center gap-0.5"
            title={`Item Color: ${param ?? ''}`}
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="w-4 h-3.5">
              <rect
                x="2.5"
                y="6"
                width="15"
                height="7.5"
                rx="1.8"
                fill={swatchHex}
                stroke="#ffffff"
                strokeWidth="1.4"
              />
              <circle cx="6.2" cy="15.3" r="1.5" fill="#e2e8f0" />
              <circle cx="13.8" cy="15.3" r="1.5" fill="#e2e8f0" />
            </svg>
          </span>
        );
      }
      case 'itemIcon': {
        const iconKey = String(param ?? 'crate').toLowerCase();
        const glyph =
          iconKey === 'battery'
            ? '🔋'
            : iconKey === 'gear'
            ? '⚙️'
            : iconKey === 'crystal'
            ? '💎'
            : '📦';
        return (
          <span
            data-sensor="itemIcon"
            title={`Item Icon: ${param ?? iconKey}`}
            className="inline-flex items-center gap-0.5 px-1 rounded bg-slate-800/80 border border-slate-600/80"
          >
            <span className="text-[10px] leading-none">{glyph}</span>
          </span>
        );
      }
      case 'stationEmpty':
        return (
          <span
            data-sensor="stationEmpty"
            className="inline-flex items-center gap-0.5"
            title={`Station Empty: ${param}`}
          >
            <span>📭</span>
            {param && (
              <span className="text-[8px] font-mono">
                {param === 'PHYSICAL_TAPE' ? 'TAPE' : param}
              </span>
            )}
          </span>
        );
      case 'hasItem':
        return (
          <span
            data-sensor="hasItem"
            title="Has Item"
            className="inline-flex items-center justify-center text-amber-300"
          >
            <ClawRingSvg className="w-3.5 h-3.5" />
          </span>
        );
      case 'heldColor': {
        const swatchHex = resolveBadgeColorHex(param);
        return (
          <span
            data-sensor="heldColor"
            className="inline-flex items-center gap-0.5"
            title={`Held Color: ${param ?? ''}`}
          >
            <span className="text-amber-300 inline-flex items-center">
              <ClawRingSvg className="w-3.5 h-3.5" />
            </span>
            <span
              className="inline-block w-2.5 h-2.5 rounded-full border border-white/80 shadow-sm"
              style={{ backgroundColor: swatchHex }}
            />
          </span>
        );
      }
      case 'topColor': {
        const swatchHex = resolveBadgeColorHex(param);
        return (
          <span
            data-sensor="topColor"
            className="inline-flex items-center gap-0.5"
            title={`Top Color: ${param ?? ''}`}
          >
            <span className="text-sky-300 inline-flex items-center">
              <StackTopSvg className="w-3.5 h-3.5" />
            </span>
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm border border-white/80 shadow-sm"
              style={{ backgroundColor: swatchHex }}
            />
          </span>
        );
      }
      default:
        return <span className="text-[9px] font-mono">{sensor}</span>;
    }
  };

  return (
    <div
      className={`inline-flex items-center px-1 py-0.5 rounded bg-slate-900/60 border border-cyan-400/30 text-white font-medium select-none ${
        compact ? 'text-[9px]' : 'text-xs'
      } ${className}`}
      data-testid="condition-badge"
    >
      {renderExpr(condition)}
    </div>
  );
};
