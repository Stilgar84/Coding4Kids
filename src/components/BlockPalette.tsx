import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getSimEnvironment } from '../engine/simulation/registry';
import { SimPaletteItem } from '../engine/simulation/types';
import {
  Repeat,
  Undo2,
  PhoneCall,
  Trash2,
} from 'lucide-react';
import { TouchDataTransfer, dispatchDragEvent } from '../utils/touchDragDrop';

interface CoreControlItem {
  type: string;
  testId: string;
  icon: React.ReactNode;
  bgClass: string;
  borderClass: string;
  supportsRepeat?: boolean;
}

const CORE_CONTROL_ITEMS: CoreControlItem[] = [
  {
    type: 'LOOP_START',
    testId: 'palette-loop-start',
    icon: <Repeat className="w-8 h-8 text-white stroke-[3]" />,
    bgClass: 'bg-purple-700 hover:bg-purple-600',
    borderClass: 'border-purple-400',
    supportsRepeat: true,
  },
  {
    type: 'LOOP_END',
    testId: 'palette-loop-end',
    icon: <Undo2 className="w-8 h-8 text-purple-200 stroke-[3]" />,
    bgClass: 'bg-purple-900 hover:bg-purple-800',
    borderClass: 'border-purple-500',
    supportsRepeat: false,
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
    supportsRepeat: false,
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
    supportsRepeat: false,
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
    supportsRepeat: false,
  },
];

const NUMBER_BADGES = [2, 3, 4, 5, 6, 7, 8, 9];

interface PaletteScrollRowProps {
  children: React.ReactNode;
  className?: string;
  testId?: string;
}

export const PaletteScrollRow: React.FC<PaletteScrollRowProps> = ({
  children,
  className = '',
  testId,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const isDownRef = React.useRef(false);
  const activePointerIdRef = React.useRef<number | null>(null);
  const startXRef = React.useRef(0);
  const startYRef = React.useRef(0);
  const startScrollLeftRef = React.useRef(0);
  const isDraggingBlockRef = React.useRef(false);
  const hasScrolledRef = React.useRef(false);
  const targetButtonRef = React.useRef<HTMLElement | null>(null);
  const dragAvatarRef = React.useRef<HTMLElement | null>(null);
  const avatarOffsetRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const currentDataTransferRef = React.useRef<TouchDataTransfer | null>(null);
  const lastHoverElRef = React.useRef<Element | null>(null);

  const cleanup = React.useCallback(() => {
    if (dragAvatarRef.current && dragAvatarRef.current.parentElement) {
      dragAvatarRef.current.parentElement.removeChild(dragAvatarRef.current);
    }
    dragAvatarRef.current = null;
    isDownRef.current = false;
    activePointerIdRef.current = null;
    isDraggingBlockRef.current = false;
    targetButtonRef.current = null;
    currentDataTransferRef.current = null;
    lastHoverElRef.current = null;
    setTimeout(() => {
      hasScrolledRef.current = false;
    }, 60);
  }, []);

  React.useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (!isDownRef.current || !containerRef.current) return;
      if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return;

      const rowRect = containerRef.current.getBoundingClientRect();
      const isBelowBar = e.clientY > rowRect.bottom + 4;
      const dx = e.clientX - startXRef.current;

      // Activate block drag if pointer moves below the block bar, even if there was horizontal movement!
      if (!isDraggingBlockRef.current && targetButtonRef.current && isBelowBar) {
        isDraggingBlockRef.current = true;
        const dataTransfer = new TouchDataTransfer();
        currentDataTransferRef.current = dataTransfer;

        // Dispatch dragstart on the source button to populate payload
        dispatchDragEvent('dragstart', targetButtonRef.current, e, dataTransfer);

        // Create drag avatar centered around pointer
        const rect = targetButtonRef.current.getBoundingClientRect();
        avatarOffsetRef.current = { x: rect.width / 2, y: rect.height / 2 };
        const avatar = targetButtonRef.current.cloneNode(true) as HTMLElement;
        avatar.removeAttribute('id');
        avatar.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
        Object.assign(avatar.style, {
          position: 'fixed',
          left: `${e.clientX - avatarOffsetRef.current.x}px`,
          top: `${e.clientY - avatarOffsetRef.current.y}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
          margin: '0',
          zIndex: '999999',
          pointerEvents: 'none',
          opacity: '0.88',
          transform: 'scale(1.06)',
          boxShadow: '0 12px 28px rgba(0, 0, 0, 0.5)',
          boxSizing: 'border-box',
        });
        document.body.appendChild(avatar);
        dragAvatarRef.current = avatar;
      }

      if (isDraggingBlockRef.current) {
        if (dragAvatarRef.current) {
          dragAvatarRef.current.style.left = `${e.clientX - avatarOffsetRef.current.x}px`;
          dragAvatarRef.current.style.top = `${e.clientY - avatarOffsetRef.current.y}px`;
        }
        const hoverEl = document.elementFromPoint(e.clientX, e.clientY);
        if (hoverEl !== lastHoverElRef.current) {
          if (lastHoverElRef.current && currentDataTransferRef.current) {
            dispatchDragEvent('dragleave', lastHoverElRef.current, e, currentDataTransferRef.current, hoverEl);
          }
          if (hoverEl && currentDataTransferRef.current) {
            dispatchDragEvent('dragenter', hoverEl, e, currentDataTransferRef.current, lastHoverElRef.current);
          }
          lastHoverElRef.current = hoverEl;
        }
        if (hoverEl && currentDataTransferRef.current) {
          dispatchDragEvent('dragover', hoverEl, e, currentDataTransferRef.current);
        }
      } else {
        // Horizontal scroll inside/around the bar
        if (Math.abs(dx) > 3) {
          containerRef.current.scrollLeft = startScrollLeftRef.current - dx;
          hasScrolledRef.current = true;
        }
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isDownRef.current) return;
      if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return;

      if (isDraggingBlockRef.current && currentDataTransferRef.current) {
        const dropTarget = document.elementFromPoint(e.clientX, e.clientY);
        if (dropTarget) {
          dispatchDragEvent('drop', dropTarget, e, currentDataTransferRef.current);
        }
        if (targetButtonRef.current) {
          dispatchDragEvent('dragend', targetButtonRef.current, e, currentDataTransferRef.current);
        }
      }
      cleanup();
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', cleanup);
    window.addEventListener('dragend', cleanup);
    window.addEventListener('drop', cleanup);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', cleanup);
      window.removeEventListener('dragend', cleanup);
      window.removeEventListener('drop', cleanup);
    };
  }, [cleanup]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    isDownRef.current = true;
    activePointerIdRef.current = e.pointerId;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    startScrollLeftRef.current = containerRef.current?.scrollLeft || 0;
    isDraggingBlockRef.current = false;
    hasScrolledRef.current = false;
    targetButtonRef.current = (e.target as HTMLElement).closest('button');
  };

  const handleClickCapture = (e: React.MouseEvent) => {
    if (hasScrolledRef.current || isDraggingBlockRef.current) {
      e.stopPropagation();
      e.preventDefault();
      hasScrolledRef.current = false;
    }
  };

  const handleDragStartCapture = (e: React.DragEvent) => {
    // Suppress native dragstart within block bar so our smooth drag & scroll take precedence
    e.preventDefault();
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      containerRef.current.scrollLeft += e.deltaY;
    }
  };

  return (
    <div
      ref={containerRef}
      data-testid={testId}
      onPointerDown={handlePointerDown}
      onClickCapture={handleClickCapture}
      onDragStartCapture={handleDragStartCapture}
      onWheel={handleWheel}
      className={`palette-scrollbar flex items-center gap-2 overflow-x-auto pb-1.5 select-none touch-none ${className}`}
    >
      {children}
    </div>
  );
};

export const BlockPalette: React.FC = () => {
  const {
    activeSimId,
    activeScope,
    addBlock,
    workspace,
    updateBlockRepeat,
    selectedBlockId,
    removeBlock,
  } = useAppStore();

  const [isDeleteHovered, setIsDeleteHovered] = useState(false);

  const currentSimEnv = getSimEnvironment(activeSimId);
  const simPaletteItems: SimPaletteItem[] = currentSimEnv?.paletteItems || [];

  const handleAddSimBlock = (item: SimPaletteItem) => {
    const blocks = workspace[activeScope] || [];
    if (selectedBlockId) {
      const idx = blocks.findIndex((b) => b.id === selectedBlockId);
      if (idx !== -1) {
        addBlock(activeScope, item.actionType, undefined, idx + 1, item.params);
        return;
      }
    }
    // Default to end
    addBlock(activeScope, item.actionType, undefined, blocks.length, item.params);
  };

  const handleAddCoreBlock = (item: CoreControlItem) => {
    const blocks = workspace[activeScope] || [];
    if (selectedBlockId) {
      const idx = blocks.findIndex((b) => b.id === selectedBlockId);
      if (idx !== -1) {
        addBlock(activeScope, item.type, undefined, idx + 1);
        return;
      }
    }
    addBlock(activeScope, item.type, undefined, blocks.length);
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

    if (!targetBlock) return;

    // Check if current block supports repeat
    const isControlRepeatable = targetBlock.type === 'LOOP_START';
    const isSimRepeatable = simPaletteItems.some(
      (p) => p.actionType === targetBlock.type && p.supportsRepeat !== false
    );
    // Legacy support for basic grid types
    const isGridRepeatable =
      targetBlock.type === 'MOVE_FWD' ||
      targetBlock.type === 'MOVE_BACK' ||
      targetBlock.type === 'TURN_LEFT' ||
      targetBlock.type === 'TURN_RIGHT';

    if (isControlRepeatable || isSimRepeatable || isGridRepeatable) {
      updateBlockRepeat(activeScope, targetBlock.id, num);
    }
  };

  const handlePaletteBlockDragStart = (e: React.DragEvent, item: SimPaletteItem) => {
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        type: 'PALETTE_BLOCK',
        blockType: item.actionType,
        params: item.params,
      })
    );
    e.dataTransfer.setData('application/x-robotemu-block', item.actionType);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleCoreControlDragStart = (e: React.DragEvent, item: CoreControlItem) => {
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        type: 'PALETTE_BLOCK',
        blockType: item.type,
      })
    );
    e.dataTransfer.setData('application/x-robotemu-block', item.type);
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

      {/* Draggable/Tappable Action & Control Blocks */}
      <PaletteScrollRow testId="palette-action-row">
        {/* Dynamic Simulation Palette Blocks */}
        {simPaletteItems.map((item) => {
          const testId = `palette-${item.id}`;
          return (
            <button
              key={item.id}
              data-testid={testId}
              draggable
              onDragStart={(e) => handlePaletteBlockDragStart(e, item)}
              onClick={() => handleAddSimBlock(item)}
              title={item.name}
              className={`flex-shrink-0 flex items-center justify-center p-3 rounded-2xl border-2 shadow-lg cursor-grab active:cursor-grabbing transition-transform active:scale-95 touch-none min-w-[56px] min-h-[56px] ${item.bgClass} ${item.borderClass}`}
            >
              {item.icon({ isActive: false })}
            </button>
          );
        })}

        {/* Vertical divider */}
        <div className="w-[1px] h-9 bg-slate-700/60 mx-1 flex-shrink-0" />

        {/* Core Control Structure Blocks (LOOP, Functions) */}
        {CORE_CONTROL_ITEMS.map((item) => (
          <button
            key={item.type}
            data-testid={item.testId}
            draggable
            onDragStart={(e) => handleCoreControlDragStart(e, item)}
            onClick={() => handleAddCoreBlock(item)}
            className={`flex-shrink-0 flex items-center justify-center p-3 rounded-2xl border-2 shadow-lg cursor-grab active:cursor-grabbing transition-transform active:scale-95 touch-none min-w-[56px] min-h-[56px] ${item.bgClass} ${item.borderClass}`}
          >
            {item.icon}
          </button>
        ))}
      </PaletteScrollRow>

      {/* Number Multipliers Row */}
      <PaletteScrollRow testId="palette-number-row">
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
      </PaletteScrollRow>
    </div>
  );
};

