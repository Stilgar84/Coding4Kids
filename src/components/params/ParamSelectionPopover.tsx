import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ActionParamDef } from '../../engine/simulation/types';
import { ALL_VARIABLE_NAMES } from '../../types';
import { ParamVisual } from './VisualParamBadges';
import { X } from 'lucide-react';

export interface Coords {
  top: number;
  left: number;
}

export const computePopoverCoords = (
  anchorEl: HTMLElement,
  popoverEl: HTMLElement | null
): Coords => {
  const anchorRect = anchorEl.getBoundingClientRect();
  const popoverWidth = popoverEl ? popoverEl.offsetWidth : 240;
  const popoverHeight = popoverEl ? popoverEl.offsetHeight : 210;

  const margin = 8;
  const spaceBelow = window.innerHeight - anchorRect.bottom - margin;
  const spaceAbove = anchorRect.top - margin;

  // Prefer opening below the badge so it does not overlap/underlap the palette above.
  // If there isn't enough room below and there is more room above, place above.
  let top: number;
  if (spaceBelow >= popoverHeight || spaceBelow >= spaceAbove) {
    top = anchorRect.bottom + margin;
  } else {
    top = Math.max(margin, anchorRect.top - popoverHeight - margin);
  }

  // Horizontally center relative to anchor
  const anchorCenterX = anchorRect.left + anchorRect.width / 2;
  let left = anchorCenterX - popoverWidth / 2;

  // Clamp horizontally within viewport
  if (left < margin) {
    left = margin;
  } else if (left + popoverWidth > window.innerWidth - margin) {
    left = Math.max(margin, window.innerWidth - popoverWidth - margin);
  }

  return { top, left };
};

interface ParamSelectionPopoverProps {
  paramDef: ActionParamDef;
  currentValue: any;
  onSelect: (value: any) => void;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement>;
  actionType?: string;
}

export const ParamSelectionPopover: React.FC<ParamSelectionPopoverProps> = ({
  paramDef,
  currentValue,
  onSelect,
  onClose,
  anchorRef,
  actionType,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<Coords | null>(() => {
    if (typeof window !== 'undefined' && anchorRef?.current) {
      return computePopoverCoords(anchorRef.current, null);
    }
    return null;
  });

  useLayoutEffect(() => {
    if (!anchorRef?.current) return;

    const updatePosition = () => {
      if (!anchorRef.current || !anchorRef.current.isConnected) {
        onClose();
        return;
      }
      const anchorRect = anchorRef.current.getBoundingClientRect();
      if (anchorRect.bottom < 0 || anchorRect.top > window.innerHeight) {
        onClose();
        return;
      }
      setCoords(computePopoverCoords(anchorRef.current, popoverRef.current));
    };

    updatePosition();

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorRef, onClose]);

  useEffect(() => {
    const handlePointerDownOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        (!anchorRef?.current || !anchorRef.current.contains(target))
      ) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handlePointerDownOutside, true);
    document.addEventListener('touchstart', handlePointerDownOutside, true);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutside, true);
      document.removeEventListener('touchstart', handlePointerDownOutside, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, anchorRef]);

  const effectiveValue = currentValue !== undefined ? currentValue : paramDef.defaultValue;
  const isNumerical =
    paramDef.type === 'angle' ||
    paramDef.type === 'radius' ||
    paramDef.type === 'penWidth' ||
    paramDef.type === 'number';

  const content = (
    <div
      ref={popoverRef}
      data-testid={`param-popover-${paramDef.id}`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      style={
        coords
          ? {
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
            }
          : undefined
      }
      className={`${
        anchorRef ? 'fixed' : 'absolute top-full mt-2 left-1/2 -translate-x-1/2'
      } z-50 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl p-2.5 flex flex-col gap-2 min-w-[200px] max-w-[calc(100vw-16px)] sm:max-w-[320px] animate-in fade-in zoom-in-95 duration-100`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          {paramDef.label}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-white p-0.5 rounded transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Options Grid / Row */}
      <div className="grid grid-cols-4 gap-1.5 max-h-52 overflow-y-auto p-0.5">
        {paramDef.options.map((opt) => {
          const isSelected = opt.value === effectiveValue;
          return (
            <button
              key={String(opt.value)}
              type="button"
              data-testid={`param-option-${opt.value}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(opt.value);
                onClose();
              }}
              className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs font-semibold transition-all active:scale-95 ${
                isSelected
                  ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-2 ring-amber-400/40'
                  : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-200 hover:border-slate-500'
              }`}
            >
              <ParamVisual paramDef={paramDef} value={opt.value} compact={false} actionType={actionType} />
              {opt.label && paramDef.type !== 'angle' && paramDef.type !== 'radius' && (
                <span className="text-[10px] mt-1 text-slate-400 truncate max-w-full">
                  {opt.label}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Variables Section for Numerical Parameters */}
      {isNumerical && (
        <div className="flex flex-col gap-1 border-t border-slate-800 pt-1.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
            Variables
          </span>
          <div className="grid grid-cols-6 gap-1 max-h-28 overflow-y-auto p-0.5">
            {ALL_VARIABLE_NAMES.map((v) => {
              const isSelected = effectiveValue === v;
              return (
                <button
                  key={v}
                  type="button"
                  data-testid={`param-option-var-${v}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(v);
                    onClose();
                  }}
                  className={`flex items-center justify-center py-1 rounded border text-xs font-mono italic font-bold transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-2 ring-amber-400/40'
                      : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-amber-200 hover:border-slate-500'
                  }`}
                >
                  {v}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(content, document.body);
  }

  return content;
};
