import React, { useState } from 'react';
import { CodeBlock, ScopeType } from '../types';
import {
  ArrowUp,
  ArrowDown,
  CornerUpLeft,
  CornerUpRight,
  Repeat,
  Undo2,
  PhoneCall,
  AlertTriangle,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

interface BlockItemProps {
  block: CodeBlock;
  index: number;
  scope: ScopeType;
  isActive: boolean;
  isSelected?: boolean;
  isLoopError?: boolean;
  isDragging?: boolean;
  onSelect?: () => void;
  onDragStartBlock?: (e: React.DragEvent, index: number, blockId: string) => void;
  onDragEndBlock?: () => void;
  onDragOverSlot?: (e: React.DragEvent, targetIndex: number) => void;
  onDropAtSlot?: (e: React.DragEvent, targetIndex: number) => void;
}

export const BlockItem: React.FC<BlockItemProps> = ({
  block,
  index,
  scope,
  isActive,
  isSelected = false,
  isLoopError = false,
  isDragging = false,
  onSelect,
  onDragStartBlock,
  onDragEndBlock,
  onDragOverSlot,
  onDropAtSlot,
}) => {
  const { updateBlockRepeat } = useAppStore();
  const [isNumberHovered, setIsNumberHovered] = useState(false);

  const supportsMultiplier =
    block.type === 'MOVE_FWD' ||
    block.type === 'MOVE_BACK' ||
    block.type === 'TURN_LEFT' ||
    block.type === 'TURN_RIGHT' ||
    block.type === 'LOOP_START';

  const showRepeatBadge =
    supportsMultiplier &&
    block.repeatCount !== undefined &&
    block.repeatCount > 1;

  // Block color & icon mapping
  const renderBlockContent = () => {
    // For runtime active node, use direct color change to vibrant yellow (no circle around it)
    const activeClass =
      'bg-yellow-400 border-yellow-200 text-slate-950 shadow-[0_0_14px_rgba(250,204,21,0.85)]';
    const iconColor = isActive ? 'text-slate-950 stroke-[3]' : 'text-white stroke-[3]';

    switch (block.type) {
      case 'MOVE_FWD':
        return (
          <div
            className={`w-full h-full flex flex-col items-center justify-center rounded-2xl border-2 p-2 shadow-md transition-colors ${
              isActive ? activeClass : 'bg-sky-600 border-sky-400'
            }`}
          >
            <ArrowUp className={`w-7 h-7 ${iconColor}`} />
          </div>
        );
      case 'MOVE_BACK':
        return (
          <div
            className={`w-full h-full flex flex-col items-center justify-center rounded-2xl border-2 p-2 shadow-md transition-colors ${
              isActive ? activeClass : 'bg-sky-700 border-sky-500'
            }`}
          >
            <ArrowDown className={`w-7 h-7 ${iconColor}`} />
          </div>
        );
      case 'TURN_LEFT':
        return (
          <div
            className={`w-full h-full flex flex-col items-center justify-center rounded-2xl border-2 p-2 shadow-md transition-colors ${
              isActive ? activeClass : 'bg-amber-600 border-amber-400'
            }`}
          >
            <CornerUpLeft className={`w-7 h-7 ${iconColor}`} />
          </div>
        );
      case 'TURN_RIGHT':
        return (
          <div
            className={`w-full h-full flex flex-col items-center justify-center rounded-2xl border-2 p-2 shadow-md transition-colors ${
              isActive ? activeClass : 'bg-amber-600 border-amber-400'
            }`}
          >
            <CornerUpRight className={`w-7 h-7 ${iconColor}`} />
          </div>
        );
      case 'LOOP_START':
        return (
          <div
            className={`w-full h-full flex flex-col items-center justify-center rounded-2xl border-2 p-2 shadow-md transition-colors ${
              isActive ? activeClass : 'bg-purple-700 border-purple-400'
            }`}
          >
            <Repeat className={`w-7 h-7 ${iconColor}`} />
          </div>
        );
      case 'LOOP_END':
        return (
          <div
            className={`w-full h-full flex flex-col items-center justify-center rounded-2xl border-2 p-2 shadow-md transition-colors ${
              isActive ? activeClass : 'bg-purple-900 border-purple-500'
            }`}
          >
            <Undo2
              className={`w-7 h-7 ${
                isActive ? 'text-slate-950 stroke-[3]' : 'text-purple-200 stroke-[3]'
              }`}
            />
          </div>
        );
      case 'CALL_F1':
        return (
          <div
            className={`w-full h-full flex items-center justify-center gap-1 rounded-2xl border-2 p-2 shadow-md transition-colors ${
              isActive ? activeClass : 'bg-emerald-600 border-emerald-400'
            }`}
          >
            <PhoneCall
              className={`w-6 h-6 stroke-[2.5] ${isActive ? 'text-slate-950' : 'text-white'}`}
            />
            <span
              className={`text-lg font-black ${isActive ? 'text-slate-950' : 'text-white'}`}
            >
              1
            </span>
          </div>
        );
      case 'CALL_F2':
        return (
          <div
            className={`w-full h-full flex items-center justify-center gap-1 rounded-2xl border-2 p-2 shadow-md transition-colors ${
              isActive ? activeClass : 'bg-blue-600 border-blue-400'
            }`}
          >
            <PhoneCall
              className={`w-6 h-6 stroke-[2.5] ${isActive ? 'text-slate-950' : 'text-white'}`}
            />
            <span
              className={`text-lg font-black ${isActive ? 'text-slate-950' : 'text-white'}`}
            >
              2
            </span>
          </div>
        );
      case 'CALL_F3':
        return (
          <div
            className={`w-full h-full flex items-center justify-center gap-1 rounded-2xl border-2 p-2 shadow-md transition-colors ${
              isActive ? activeClass : 'bg-rose-600 border-rose-400'
            }`}
          >
            <PhoneCall
              className={`w-6 h-6 stroke-[2.5] ${isActive ? 'text-slate-950' : 'text-white'}`}
            />
            <span
              className={`text-lg font-black ${isActive ? 'text-slate-950' : 'text-white'}`}
            >
              3
            </span>
          </div>
        );
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        type: 'WORKSPACE_BLOCK',
        scope,
        blockId: block.id,
        index,
      })
    );
    e.dataTransfer.setData('application/x-robotemu-block', block.type);
    e.dataTransfer.effectAllowed = 'move';
    if (onDragStartBlock) {
      onDragStartBlock(e, index, block.id);
    }
  };

  const handleDragEnd = () => {
    setIsNumberHovered(false);
    if (onDragEndBlock) {
      onDragEndBlock();
    }
  };

  const handleDragOverOnBlock = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('application/x-robotemu-number') && supportsMultiplier) {
      e.dataTransfer.dropEffect = 'copy';
      setIsNumberHovered(true);
      return;
    }

    setIsNumberHovered(false);
    // Dragging a block over this node: always calculate insertion slot (before or after)
    const rect = e.currentTarget.getBoundingClientRect();
    const isAfter = e.clientX - rect.left > rect.width / 2;
    const targetIdx = isAfter ? index + 1 : index;

    if (onDragOverSlot) {
      onDragOverSlot(e, targetIdx);
    }
  };

  const handleDragLeaveOnBlock = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsNumberHovered(false);
    }
  };

  const handleDropOnBlock = (e: React.DragEvent) => {
    setIsNumberHovered(false);
    e.preventDefault();
    e.stopPropagation();

    const dataStr = e.dataTransfer.getData('application/json');
    if (!dataStr) return;

    try {
      const data = JSON.parse(dataStr);
      if (data.type === 'PALETTE_NUMBER' && supportsMultiplier) {
        updateBlockRepeat(scope, block.id, data.number);
        return;
      }

      // Dragging a block: always insert between nodes based on cursor position
      const rect = e.currentTarget.getBoundingClientRect();
      const isAfter = e.clientX - rect.left > rect.width / 2;
      const targetIdx = isAfter ? index + 1 : index;

      if (onDropAtSlot) {
        onDropAtSlot(e, targetIdx);
      }
    } catch {
      // ignore
    }
  };

  return (
    <div
      data-testid={`block-${block.id}`}
      data-active={isActive ? 'true' : 'false'}
      data-selected={isSelected ? 'true' : 'false'}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOverOnBlock}
      onDragLeave={handleDragLeaveOnBlock}
      onDrop={handleDropOnBlock}
      onClick={(e) => {
        e.stopPropagation();
        if (onSelect) onSelect();
      }}
      className={`relative flex items-center justify-center cursor-grab active:cursor-grabbing select-none transition-transform duration-150 flex-shrink-0 ${
        isDragging ? 'opacity-40' : ''
      } ${
        isNumberHovered
          ? 'scale-105 z-20'
          : isLoopError
          ? 'animate-pulse z-10'
          : 'hover:scale-105'
      }`}
    >
      {/* Loop Error Warning Badge Overlay */}
      {isLoopError && (
        <div
          data-testid={`badge-loop-error-${block.id}`}
          className="absolute -top-2 -left-2 w-6 h-6 bg-red-600 border-2 border-red-300 text-white rounded-full flex items-center justify-center shadow-lg z-30 animate-bounce"
          title="Loop syntax error"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-white stroke-[2.5]" />
        </div>
      )}

      {/* Main Block Visual: Fixed uniform dimensions ensuring identical vertical alignment */}
      <div
        className={`w-[56px] h-[56px] flex items-center justify-center rounded-2xl ${
          isNumberHovered
            ? 'ring-4 ring-yellow-400'
            : isLoopError
            ? 'ring-2 ring-red-500'
            : ''
        }`}
      >
        {renderBlockContent()}
      </div>

      {/* Number Badge Slot: Absolute-positioned so it does not alter block height or vertical alignment.
          Clicking on it removes the tag! */}
      {showRepeatBadge && (
        <button
          type="button"
          data-testid={`badge-repeat-${block.id}`}
          onClick={(e) => {
            e.stopPropagation();
            updateBlockRepeat(scope, block.id, undefined);
          }}
          className="absolute -bottom-2 -right-1 z-20 flex items-center justify-center w-6 h-6 rounded-full border-2 border-yellow-200 bg-yellow-400 hover:bg-red-500 hover:border-red-300 hover:text-white text-slate-950 font-black text-xs shadow-md transition-colors cursor-pointer"
          title="Click to remove tag"
        >
          {block.repeatCount}
        </button>
      )}
    </div>
  );
};
