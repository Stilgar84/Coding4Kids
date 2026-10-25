import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { BlockType } from '../types';
import {
  ArrowUp,
  ArrowDown,
  CornerUpLeft,
  CornerUpRight,
  Repeat,
  Undo2,
  PhoneCall,
  Trash2,
} from 'lucide-react';

interface PaletteItem {
  type: BlockType;
  testId: string;
  icon: React.ReactNode;
  bgClass: string;
  borderClass: string;
}

const PALETTE_ITEMS: PaletteItem[] = [
  {
    type: 'MOVE_FWD',
    testId: 'palette-move-fwd',
    icon: <ArrowUp className="w-8 h-8 text-white stroke-[3]" />,
    bgClass: 'bg-sky-600 hover:bg-sky-500',
    borderClass: 'border-sky-400',
  },
  {
    type: 'MOVE_BACK',
    testId: 'palette-move-back',
    icon: <ArrowDown className="w-8 h-8 text-white stroke-[3]" />,
    bgClass: 'bg-sky-700 hover:bg-sky-600',
    borderClass: 'border-sky-500',
  },
  {
    type: 'TURN_LEFT',
    testId: 'palette-turn-left',
    icon: <CornerUpLeft className="w-8 h-8 text-white stroke-[3]" />,
    bgClass: 'bg-amber-600 hover:bg-amber-500',
    borderClass: 'border-amber-400',
  },
  {
    type: 'TURN_RIGHT',
    testId: 'palette-turn-right',
    icon: <CornerUpRight className="w-8 h-8 text-white stroke-[3]" />,
    bgClass: 'bg-amber-600 hover:bg-amber-500',
    borderClass: 'border-amber-400',
  },
  {
    type: 'LOOP_START',
    testId: 'palette-loop-start',
    icon: <Repeat className="w-8 h-8 text-white stroke-[3]" />,
    bgClass: 'bg-purple-700 hover:bg-purple-600',
    borderClass: 'border-purple-400',
  },
  {
    type: 'LOOP_END',
    testId: 'palette-loop-end',
    icon: <Undo2 className="w-8 h-8 text-purple-200 stroke-[3]" />,
    bgClass: 'bg-purple-900 hover:bg-purple-800',
    borderClass: 'border-purple-500',
  },
  {
    type: 'CALL_F1',
    testId: 'palette-call-f1',
    icon: (
      <div className="flex items-center gap-1">
        <PhoneCall className="w-6 h-6 text-white stroke-[2.5]" />
        <span className="text-xl font-black text-white">1</span>
      </div>
    ),
    bgClass: 'bg-emerald-600 hover:bg-emerald-500',
    borderClass: 'border-emerald-400',
  },
  {
    type: 'CALL_F2',
    testId: 'palette-call-f2',
    icon: (
      <div className="flex items-center gap-1">
        <PhoneCall className="w-6 h-6 text-white stroke-[2.5]" />
        <span className="text-xl font-black text-white">2</span>
      </div>
    ),
    bgClass: 'bg-blue-600 hover:bg-blue-500',
    borderClass: 'border-blue-400',
  },
  {
    type: 'CALL_F3',
    testId: 'palette-call-f3',
    icon: (
      <div className="flex items-center gap-1">
        <PhoneCall className="w-6 h-6 text-white stroke-[2.5]" />
        <span className="text-xl font-black text-white">3</span>
      </div>
    ),
    bgClass: 'bg-rose-600 hover:bg-rose-500',
    borderClass: 'border-rose-400',
  },
];

const NUMBER_BADGES = [2, 3, 4, 5, 6, 7, 8, 9];

export const BlockPalette: React.FC = () => {
  const {
    activeScope,
    addBlock,
    workspace,
    updateBlockRepeat,
    selectedBlockId,
    removeBlock,
  } = useAppStore();

  const [isDeleteHovered, setIsDeleteHovered] = useState(false);

  const handleAdd = (type: BlockType) => {
    const blocks = workspace[activeScope] || [];
    if (selectedBlockId) {
      const idx = blocks.findIndex((b) => b.id === selectedBlockId);
      if (idx !== -1) {
        addBlock(activeScope, type, undefined, idx + 1);
        return;
      }
    }
    // Default to end
    addBlock(activeScope, type, undefined, blocks.length);
  };

  const handleNumberClick = (num: number) => {
    const blocks = workspace[activeScope] || [];
    if (blocks.length === 0) return;

    let targetBlock = null;
    if (selectedBlockId) {
      targetBlock = blocks.find((b) => b.id === selectedBlockId);
    }
    if (!targetBlock) {
      targetBlock = blocks[blocks.length - 1];
    }

    if (
      targetBlock &&
      (targetBlock.type === 'MOVE_FWD' ||
        targetBlock.type === 'MOVE_BACK' ||
        targetBlock.type === 'TURN_LEFT' ||
        targetBlock.type === 'TURN_RIGHT' ||
        targetBlock.type === 'LOOP_START')
    ) {
      updateBlockRepeat(activeScope, targetBlock.id, num);
    }
  };

  const handlePaletteBlockDragStart = (e: React.DragEvent, type: BlockType) => {
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        type: 'PALETTE_BLOCK',
        blockType: type,
      })
    );
    e.dataTransfer.setData('application/x-robotemu-block', type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleNumberDragStart = (e: React.DragEvent, num: number) => {
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        type: 'PALETTE_NUMBER',
        number: num,
      })
    );
    e.dataTransfer.setData('application/x-robotemu-number', String(num));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragOverPalette = (e: React.DragEvent) => {
    // Only accept drag if it's a WORKSPACE_BLOCK
    e.preventDefault();
    setIsDeleteHovered(true);
  };

  const handleDragLeavePalette = () => {
    setIsDeleteHovered(false);
  };

  const handleDropOnPalette = (e: React.DragEvent) => {
    setIsDeleteHovered(false);
    const dataStr = e.dataTransfer.getData('application/json');
    if (!dataStr) return;
    try {
      const data = JSON.parse(dataStr);
      if (data.type === 'WORKSPACE_BLOCK' && data.blockId) {
        e.preventDefault();
        e.stopPropagation();
        removeBlock(data.scope || activeScope, data.blockId);
      }
    } catch {
      // ignore
    }
  };

  return (
    <div
      data-testid="palette-container"
      onDragOver={handleDragOverPalette}
      onDragLeave={handleDragLeavePalette}
      onDrop={handleDropOnPalette}
      className={`relative flex flex-col gap-2 p-3 bg-slate-900 border-b border-slate-800 transition-colors ${
        isDeleteHovered
          ? 'border-red-500 bg-red-950/40 ring-2 ring-red-500/50'
          : ''
      }`}
    >
      {/* Drop here to delete overlay */}
      {isDeleteHovered && (
        <div
          data-testid="palette-trash-dropzone"
          className="absolute inset-0 z-30 flex items-center justify-center bg-red-950/80 border-2 border-dashed border-red-500 rounded-lg pointer-events-none text-red-200 font-bold gap-2 text-base animate-pulse"
        >
          <Trash2 className="w-6 h-6 text-red-400 stroke-[2.5]" />
          <span>Drop here to delete</span>
        </div>
      )}

      {/* Draggable/Tappable Palette Blocks */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {PALETTE_ITEMS.map((item) => (
          <button
            key={item.type}
            data-testid={item.testId}
            draggable
            onDragStart={(e) => handlePaletteBlockDragStart(e, item.type)}
            onClick={() => handleAdd(item.type)}
            className={`flex-shrink-0 flex items-center justify-center p-3 rounded-2xl border-2 shadow-lg cursor-grab active:cursor-grabbing transition-transform active:scale-95 touch-none ${item.bgClass} ${item.borderClass}`}
          >
            {item.icon}
          </button>
        ))}
      </div>

      {/* Number Multipliers Row */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {NUMBER_BADGES.map((num) => (
          <button
            key={num}
            data-testid={`palette-number-${num}`}
            draggable
            onDragStart={(e) => handleNumberDragStart(e, num)}
            onClick={() => handleNumberClick(num)}
            className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-lg border-2 border-yellow-200 shadow-md cursor-grab active:cursor-grabbing transition-transform active:scale-95 touch-none"
            title={`Set repeat ${num}`}
          >
            {num}
          </button>
        ))}
      </div>
    </div>
  );
};
