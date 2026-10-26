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
  RotateCcw,
  RotateCw,
  PenTool,
  Slash,
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
  iterationProgress?: { current: number; total: number } | null;
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
  iterationProgress = null,
  onSelect,
  onDragStartBlock,
  onDragEndBlock,
  onDragOverSlot,
  onDropAtSlot,
}) => {
  const { updateBlockRepeat } = useAppStore();
  const [isNumberHovered, setIsNumberHovered] = useState(false);

  // Check if block type supports repeat multipliers
  const nonRepeatableTypes = ['PEN_UP', 'PEN_DOWN', 'SET_PEN_COLOR', 'LOOP_END', 'CALL_F1', 'CALL_F2', 'CALL_F3'];
  const supportsMultiplier = !nonRepeatableTypes.includes(block.type);

  const showRepeatBadge =
    supportsMultiplier &&
    block.repeatCount !== undefined &&
    block.repeatCount > 1;

  // Block color & icon mapping
  const renderBlockContent = () => {
    const activeClass =
      'bg-yellow-400 border-yellow-200 text-slate-950 shadow-[0_0_14px_rgba(250,204,21,0.85)]';
    const iconColor = isActive ? 'text-slate-950 stroke-[3]' : 'text-white stroke-[3]';

    switch (block.type) {
      case 'MOVE_FWD':
      case 'FORWARD':
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
      case 'BACKWARD':
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
            {block.params?.angle ? (
              <div className="flex flex-col items-center justify-center leading-none">
                <RotateCcw className={`w-5 h-5 ${isActive ? 'text-slate-950 stroke-[2.5]' : 'text-white stroke-[2.5]'}`} />
                <span className={`text-[10px] font-black mt-0.5 ${isActive ? 'text-slate-950' : 'text-amber-200'}`}>
                  {block.params.angle}°
                </span>
              </div>
            ) : (
              <CornerUpLeft className={`w-7 h-7 ${iconColor}`} />
            )}
          </div>
        );

      case 'TURN_RIGHT':
        return (
          <div
            className={`w-full h-full flex flex-col items-center justify-center rounded-2xl border-2 p-2 shadow-md transition-colors ${
              isActive ? activeClass : 'bg-amber-600 border-amber-400'
            }`}
          >
            {block.params?.angle ? (
              <div className="flex flex-col items-center justify-center leading-none">
                <RotateCw className={`w-5 h-5 ${isActive ? 'text-slate-950 stroke-[2.5]' : 'text-white stroke-[2.5]'}`} />
                <span className={`text-[10px] font-black mt-0.5 ${isActive ? 'text-slate-950' : 'text-amber-200'}`}>
                  {block.params.angle}°
                </span>
              </div>
            ) : (
              <CornerUpRight className={`w-7 h-7 ${iconColor}`} />
            )}
          </div>
        );

      case 'ARC_LEFT':
        return (
          <div
            className={`w-full h-full flex flex-col items-center justify-center rounded-2xl border-2 p-2 shadow-md transition-colors ${
              isActive ? activeClass : 'bg-indigo-600 border-indigo-400'
            }`}
          >
            <div className="flex flex-col items-center justify-center leading-none">
              <svg className={`w-5 h-5 ${isActive ? 'stroke-slate-950' : 'stroke-white'}`} viewBox="0 0 24 24" fill="none" strokeWidth="2.5">
                <path d="M 19 20 A 15 15 0 0 0 4 5" />
                <polyline points="4 10 4 5 9 5" />
              </svg>
              <span className={`text-[9px] font-black ${isActive ? 'text-slate-950' : 'text-indigo-200'}`}>Arc L</span>
            </div>
          </div>
        );

      case 'ARC_RIGHT':
        return (
          <div
            className={`w-full h-full flex flex-col items-center justify-center rounded-2xl border-2 p-2 shadow-md transition-colors ${
              isActive ? activeClass : 'bg-indigo-600 border-indigo-400'
            }`}
          >
            <div className="flex flex-col items-center justify-center leading-none">
              <svg className={`w-5 h-5 ${isActive ? 'stroke-slate-950' : 'stroke-white'}`} viewBox="0 0 24 24" fill="none" strokeWidth="2.5">
                <path d="M 5 20 A 15 15 0 0 1 20 5" />
                <polyline points="20 10 20 5 15 5" />
              </svg>
              <span className={`text-[9px] font-black ${isActive ? 'text-slate-950' : 'text-indigo-200'}`}>Arc R</span>
            </div>
          </div>
        );

      case 'PEN_UP':
        return (
          <div
            className={`w-full h-full flex items-center justify-center rounded-2xl border-2 p-2 shadow-md transition-colors ${
              isActive ? activeClass : 'bg-teal-700 border-teal-400'
            }`}
          >
            <div className="relative flex items-center justify-center">
              <PenTool className={`w-6 h-6 ${isActive ? 'text-slate-950' : 'text-teal-200'}`} />
              <Slash className="w-7 h-7 text-red-400 stroke-[2.5] absolute -top-0.5 -left-0.5" />
            </div>
          </div>
        );

      case 'PEN_DOWN':
        return (
          <div
            className={`w-full h-full flex items-center justify-center rounded-2xl border-2 p-2 shadow-md transition-colors ${
              isActive ? activeClass : 'bg-teal-600 border-teal-300'
            }`}
          >
            <PenTool className={`w-6 h-6 ${isActive ? 'text-slate-950 stroke-[2.5]' : 'text-teal-100 stroke-[2.5]'}`} />
          </div>
        );

      case 'SET_PEN_COLOR': {
        const color = block.params?.color || '#0f172a';
        return (
          <div
            className={`w-full h-full flex flex-col items-center justify-center gap-1 rounded-2xl border-2 p-2 shadow-md transition-colors ${
              isActive ? activeClass : 'bg-slate-800 border-slate-500'
            }`}
          >
            <div
              className="w-5 h-5 rounded-full border-2 border-white shadow-sm"
              style={{ backgroundColor: color }}
            />
          </div>
        );
      }

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

      default:
        return (
          <div
            className={`w-full h-full flex items-center justify-center rounded-2xl border-2 p-2 shadow-md ${
              isActive ? activeClass : 'bg-slate-700 border-slate-500'
            }`}
          >
            <span className="text-xs font-bold text-white truncate">{block.type}</span>
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
      className={`relative flex items-center justify-center cursor-grab active:cursor-grabbing select-none transition-transform duration-150 flex-shrink-0 touch-none ${
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
          Shows <current>/<total> at runtime when iterating, or multiplier tag when idle */}
      {iterationProgress ? (
        <div
          data-testid={`badge-repeat-${block.id}`}
          data-iteration-badge="true"
          className="absolute -bottom-2 -right-2 z-20 flex items-center justify-center min-w-[28px] h-6 px-1.5 rounded-full border-2 border-yellow-300 bg-slate-900 shadow-lg text-xs"
        >
          <span
            data-testid="iteration-current"
            className="text-amber-400 font-extrabold"
          >
            {iterationProgress.current}
          </span>
          <span className="text-slate-400 font-bold mx-0.5">/</span>
          <span
            data-testid="iteration-total"
            className="text-slate-100 font-bold"
          >
            {iterationProgress.total}
          </span>
        </div>
      ) : showRepeatBadge ? (
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
      ) : null}
    </div>
  );
};

