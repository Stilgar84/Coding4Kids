import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { BlockType } from '../types';
import {
  ArrowUp,
  ArrowDown,
  RotateCcw,
  RotateCw,
  Repeat,
  Square,
  PhoneCall,
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
    icon: <RotateCcw className="w-8 h-8 text-white stroke-[3]" />,
    bgClass: 'bg-amber-600 hover:bg-amber-500',
    borderClass: 'border-amber-400',
  },
  {
    type: 'TURN_RIGHT',
    testId: 'palette-turn-right',
    icon: <RotateCw className="w-8 h-8 text-white stroke-[3]" />,
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
    icon: <Square className="w-8 h-8 text-purple-200 stroke-[3]" />,
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
  const { activeScope, addBlock, workspace, updateBlockRepeat } = useAppStore();

  const handleAdd = (type: BlockType) => {
    addBlock(activeScope, type);
  };

  const handleNumberClick = (num: number) => {
    const blocks = workspace[activeScope];
    if (blocks.length === 0) return;
    const lastBlock = blocks[blocks.length - 1];
    if (
      lastBlock.type === 'MOVE_FWD' ||
      lastBlock.type === 'MOVE_BACK' ||
      lastBlock.type === 'TURN_LEFT' ||
      lastBlock.type === 'TURN_RIGHT' ||
      lastBlock.type === 'LOOP_START'
    ) {
      updateBlockRepeat(activeScope, lastBlock.id, num);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3 bg-slate-900 border-b border-slate-800">
      {/* Draggable/Tappable Palette Blocks */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {PALETTE_ITEMS.map((item) => (
          <button
            key={item.type}
            data-testid={item.testId}
            onClick={() => handleAdd(item.type)}
            className={`flex-shrink-0 flex items-center justify-center p-3 rounded-2xl border-2 shadow-lg transition-transform active:scale-95 ${item.bgClass} ${item.borderClass}`}
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
            onClick={() => handleNumberClick(num)}
            className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-lg border-2 border-yellow-200 shadow-md transition-transform active:scale-95"
            title={`Set repeat ${num}`}
          >
            {num}
          </button>
        ))}
      </div>
    </div>
  );
};
