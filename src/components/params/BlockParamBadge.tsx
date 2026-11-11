import React, { useState, useRef, useEffect } from 'react';
import { ActionParamDef } from '../../engine/simulation/types';
import { ParamVisual } from './VisualParamBadges';
import { ParamSelectionPopover } from './ParamSelectionPopover';

interface BlockParamBadgeProps {
  paramDef: ActionParamDef;
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
  actionType?: string;
}

export const BlockParamBadge: React.FC<BlockParamBadgeProps> = ({
  paramDef,
  value,
  onChange,
  disabled = false,
  actionType,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (disabled && isOpen) {
      setIsOpen(false);
    }
  }, [disabled, isOpen]);

  const effectiveValue = value !== undefined ? value : paramDef.defaultValue;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    setIsOpen((prev) => !prev);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      setIsOpen((prev) => !prev);
    } else if (e.key === 'Escape' && isOpen) {
      e.preventDefault();
      e.stopPropagation();
      setIsOpen(false);
    }
  };

  return (
    <div className="relative inline-flex items-center">
      <button
        ref={buttonRef}
        type="button"
        data-testid={`block-param-badge-${paramDef.id}`}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={`${paramDef.label}: ${effectiveValue}${paramDef.unit || ''}`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        title={`Click to edit ${paramDef.label}`}
        className="flex items-center justify-center min-w-[36px] min-h-[36px] h-[36px] md:min-w-[44px] md:h-[48px] px-1.5 md:px-2 rounded-lg md:rounded-xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-600/70 hover:border-amber-400/80 text-white shadow-inner cursor-pointer transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-default disabled:opacity-75 group"
      >
        <ParamVisual paramDef={paramDef} value={effectiveValue} compact={true} actionType={actionType} />
      </button>

      {isOpen && (
        <ParamSelectionPopover
          anchorRef={buttonRef}
          paramDef={paramDef}
          currentValue={effectiveValue}
          actionType={actionType}
          onSelect={(newVal) => {
            onChange(newVal);
            setIsOpen(false);
          }}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};
