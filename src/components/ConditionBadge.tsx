import React from 'react';
import type { ConditionExpr } from '../data/curriculum/types';

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

      case 'cmp':
        return (
          <span className="font-mono text-[9px] text-cyan-200">
            {expr.left} {expr.op} {expr.right}
          </span>
        );

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
        return <span title="Item Here">💎</span>;
      case 'carryingItem':
        return <span title="Carrying Item">🎒</span>;
      case 'atGoal':
        return <span title="At Goal">🏁</span>;
      case 'tileColor':
        return (
          <span className="inline-flex items-center gap-0.5" title={`Tile Color: ${param}`}>
            <span>🎨</span>
            {param && <span className="text-[9px] font-bold uppercase">{param}</span>}
          </span>
        );
      case 'hasNextItem':
        return <span title="Has Next Item">📦</span>;
      case 'itemDamaged':
        return <span title="Item Damaged">💥</span>;
      case 'itemColor':
        return (
          <span className="inline-flex items-center gap-0.5" title={`Item Color: ${param}`}>
            <span>🏷️</span>
            {param && <span className="text-[9px] font-bold uppercase">{param}</span>}
          </span>
        );
      case 'itemIcon':
        return <span title={`Item Icon: ${param}`}>🏷️{param}</span>;
      case 'stationEmpty':
        return (
          <span className="inline-flex items-center gap-0.5" title={`Station Empty: ${param}`}>
            <span>📭</span>
            {param && <span className="text-[8px] font-mono">{param}</span>}
          </span>
        );
      case 'hasItem':
        return <span title="Has Item">📦</span>;
      case 'heldColor':
        return (
          <span className="inline-flex items-center gap-0.5" title={`Held Color: ${param}`}>
            <span>✊</span>
            {param && <span className="text-[9px] font-bold uppercase">{param}</span>}
          </span>
        );
      case 'topColor':
        return (
          <span className="inline-flex items-center gap-0.5" title={`Top Color: ${param}`}>
            <span>🔝</span>
            {param && <span className="text-[9px] font-bold uppercase">{param}</span>}
          </span>
        );
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
