import React from 'react';
import { CodeBlock, ScopeType } from '../types';
import {
  ArrowUp,
  ArrowDown,
  RotateCcw,
  RotateCw,
  Repeat,
  Square,
  PhoneCall,
  X,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

interface BlockItemProps {
  block: CodeBlock;
  index: number;
  scope: ScopeType;
  isActive: boolean;
  onDropNumber?: (blockId: string, num: number) => void;
}

export const BlockItem: React.FC<BlockItemProps> = ({
  block,
  scope,
  isActive,
}) => {
  const { removeBlock, updateBlockRepeat } = useAppStore();

  const handleCycleNumber = (e: React.MouseEvent) => {
    e.stopPropagation();
    const current = block.repeatCount ?? (block.type === 'LOOP_START' ? 2 : 1);
    const next = current >= 9 ? (block.type === 'LOOP_START' ? 2 : undefined) : current + 1;
    updateBlockRepeat(scope, block.id, next);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeBlock(scope, block.id);
  };

  // Block color & icon mapping
  const renderBlockContent = () => {
    switch (block.type) {
      case 'MOVE_FWD':
        return (
          <div className="flex flex-col items-center justify-center bg-sky-600 border-2 border-sky-400 rounded-2xl p-3 shadow-md">
            <ArrowUp className="w-8 h-8 text-white stroke-[3]" />
          </div>
        );
      case 'MOVE_BACK':
        return (
          <div className="flex flex-col items-center justify-center bg-sky-700 border-2 border-sky-500 rounded-2xl p-3 shadow-md">
            <ArrowDown className="w-8 h-8 text-white stroke-[3]" />
          </div>
        );
      case 'TURN_LEFT':
        return (
          <div className="flex flex-col items-center justify-center bg-amber-600 border-2 border-amber-400 rounded-2xl p-3 shadow-md">
            <RotateCcw className="w-8 h-8 text-white stroke-[3]" />
          </div>
        );
      case 'TURN_RIGHT':
        return (
          <div className="flex flex-col items-center justify-center bg-amber-600 border-2 border-amber-400 rounded-2xl p-3 shadow-md">
            <RotateCw className="w-8 h-8 text-white stroke-[3]" />
          </div>
        );
      case 'LOOP_START':
        return (
          <div className="flex flex-col items-center justify-center bg-purple-700 border-2 border-purple-400 rounded-2xl p-3 shadow-md">
            <Repeat className="w-8 h-8 text-white stroke-[3]" />
          </div>
        );
      case 'LOOP_END':
        return (
          <div className="flex flex-col items-center justify-center bg-purple-900 border-2 border-purple-500 rounded-2xl p-3 shadow-md">
            <Square className="w-8 h-8 text-purple-200 stroke-[3]" />
          </div>
        );
      case 'CALL_F1':
        return (
          <div className="flex items-center justify-center gap-1 bg-emerald-600 border-2 border-emerald-400 rounded-2xl p-3 shadow-md">
            <PhoneCall className="w-7 h-7 text-white stroke-[2.5]" />
            <span className="text-xl font-black text-white">1</span>
          </div>
        );
      case 'CALL_F2':
        return (
          <div className="flex items-center justify-center gap-1 bg-blue-600 border-2 border-blue-400 rounded-2xl p-3 shadow-md">
            <PhoneCall className="w-7 h-7 text-white stroke-[2.5]" />
            <span className="text-xl font-black text-white">2</span>
          </div>
        );
      case 'CALL_F3':
        return (
          <div className="flex items-center justify-center gap-1 bg-rose-600 border-2 border-rose-400 rounded-2xl p-3 shadow-md">
            <PhoneCall className="w-7 h-7 text-white stroke-[2.5]" />
            <span className="text-xl font-black text-white">3</span>
          </div>
        );
    }
  };

  const supportsMultiplier =
    block.type === 'MOVE_FWD' ||
    block.type === 'MOVE_BACK' ||
    block.type === 'TURN_LEFT' ||
    block.type === 'TURN_RIGHT' ||
    block.type === 'LOOP_START';

  return (
    <div
      data-testid={`block-${block.id}`}
      data-active={isActive ? 'true' : 'false'}
      className={`relative group flex flex-col items-center min-w-[76px] transition-all duration-200 ${
        isActive ? 'ring-4 ring-yellow-400 rounded-2xl scale-110 z-10' : 'hover:scale-105'
      }`}
    >
      {/* Delete button on hover / touch */}
      <button
        data-testid={`btn-delete-block-${block.id}`}
        onClick={handleDelete}
        className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 hover:bg-red-500 text-white rounded-full flex items-center justify-center shadow-md z-20"
      >
        <X className="w-3.5 h-3.5 stroke-[3]" />
      </button>

      {/* Main Block Visual */}
      <div className="cursor-pointer">{renderBlockContent()}</div>

      {/* Number Badge Slot */}
      {supportsMultiplier && (
        <button
          data-testid={`badge-repeat-${block.id}`}
          onClick={handleCycleNumber}
          className={`-mt-2 z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 font-black text-sm shadow-md transition-all ${
            block.repeatCount && block.repeatCount > 1
              ? 'bg-yellow-400 border-yellow-200 text-slate-950 scale-100'
              : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-yellow-400'
          }`}
          title="Click to change repeat number"
        >
          {block.repeatCount ?? (block.type === 'LOOP_START' ? 2 : 1)}
        </button>
      )}
    </div>
  );
};
