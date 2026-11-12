import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ActionParamDef } from '../../engine/simulation/types';
import { ParamVisual } from './VisualParamBadges';
import { X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import {
  computeStagedPalettePolicy,
  resolveActiveCurriculumActivity,
} from '../../utils/curriculumStagePolicy';

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

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
  const paletteEl =
    typeof document !== 'undefined'
      ? document.querySelector('[data-testid="palette-container"]')
      : null;
  const paletteBottom = paletteEl ? paletteEl.getBoundingClientRect().bottom : 0;

  const spaceBelow = window.innerHeight - anchorRect.bottom - margin;
  const safeSpaceAbove = anchorRect.top - paletteBottom - margin;

  // Prefer opening below the badge so it does not overlap/underlap the palette above.
  // Only open above if it safely fits above without overlapping the palette and there is not enough room below.
  let top: number;
  if (spaceBelow >= popoverHeight || safeSpaceAbove < popoverHeight) {
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
  useAppStore();
  const { appMode, activeActivityId, activeActivityVersion } = useAppStore.getState();
  const activeActivity = resolveActiveCurriculumActivity(
    appMode,
    activeActivityId,
    activeActivityVersion
  );
  const policy = computeStagedPalettePolicy(appMode, activeActivity, []);

  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<Coords | null>(() => {
    if (typeof window !== 'undefined' && anchorRef?.current) {
      return computePopoverCoords(anchorRef.current, null);
    }
    return null;
  });

  useIsomorphicLayoutEffect(() => {
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
    paramDef.type === 'number' ||
    paramDef.type === 'length' ||
    paramDef.type === 'pitch' ||
    paramDef.type === 'gridCoord';

  const hideOptionSubLabel =
    paramDef.type === 'angle' ||
    paramDef.type === 'radius' ||
    paramDef.type === 'length' ||
    paramDef.type === 'pitch' ||
    paramDef.type === 'duration' ||
    paramDef.type === 'gridCoord' ||
    paramDef.type === 'turnDir';

  const content = (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={paramDef.label}
      data-testid={`param-popover-${paramDef.id}`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
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
          aria-label="Close parameter picker"
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 min-w-[28px] min-h-[28px] inline-flex items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Options Grid / Row */}
      <div
        className={`grid ${
          paramDef.options.length === 2 ? 'grid-cols-2' : 'grid-cols-4'
        } gap-1.5 max-h-56 overflow-y-auto p-0.5`}
      >
        {paramDef.options.map((opt) => {
          const isSelected = opt.value === effectiveValue;
          return (
            <button
              key={String(opt.value)}
              type="button"
              data-testid={`param-option-${opt.value}`}
              aria-pressed={isSelected}
              aria-label={`${paramDef.label}: ${opt.label ?? opt.value}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(opt.value);
                onClose();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelect(opt.value);
                  onClose();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  e.stopPropagation();
                  onClose();
                }
              }}
              className={`flex flex-col items-center justify-center min-w-[36px] min-h-[36px] md:min-w-[44px] md:min-h-[44px] p-2 rounded-lg border text-xs font-semibold transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                isSelected
                  ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-2 ring-amber-400/40'
                  : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-200 hover:border-slate-500'
              }`}
            >
              <ParamVisual paramDef={paramDef} value={opt.value} compact={false} actionType={actionType} />
              {opt.label && !hideOptionSubLabel && (
                <span className="text-[10px] mt-1 text-slate-400 truncate max-w-full">
                  {opt.label}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Variables Section for Numerical Parameters */}
      {isNumerical && policy.allowVariables && policy.subpaletteVariableNames.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-slate-800 pt-1.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
            Variables
          </span>
          <div className="grid grid-cols-6 gap-1 max-h-28 overflow-y-auto p-0.5">
            {policy.subpaletteVariableNames.map((v) => {
              const isSelected = effectiveValue === v;
              return (
                <button
                  key={v}
                  type="button"
                  data-testid={`param-option-var-${v}`}
                  aria-pressed={isSelected}
                  aria-label={`Variable ${v}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(v);
                    onClose();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      onSelect(v);
                      onClose();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      e.stopPropagation();
                      onClose();
                    }
                  }}
                  className={`flex items-center justify-center min-w-[36px] min-h-[36px] py-1 rounded border text-xs font-mono italic font-bold transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
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
