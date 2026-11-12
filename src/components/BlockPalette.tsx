import React, { useState, useEffect, useRef } from 'react';
import { useAppStore, useAppStoreSelector } from '../store/useAppStore';
import { getSimEnvironment } from '../engine/simulation/registry';
import { SimPaletteItem } from '../engine/simulation/types';
import {
  Repeat,
  CornerDownLeft,
  PhoneCall,
  Trash2,
  SlidersHorizontal,
  Layers,
  Sparkles,
} from 'lucide-react';
import { TouchDataTransfer, dispatchDragEvent } from '../utils/touchDragDrop';
import { BlockSubpalette } from './BlockSubpalette';
import { CodeBlock, ScopeType, VariableName } from '../types';
import {
  doesBlockMatchHintCategory,
  getPlaceholderHintCategory,
} from '../engine/placeholderHelpers';
import {
  computeSlotBudget,
  computeStagedPalettePolicy,
  getAllowedParamDefs,
  resolveActiveCurriculumActivity,
} from '../utils/curriculumStagePolicy';

const SLOT_SHAKE_DURATION_MS = 500;
const MAX_RENDERED_COUNTER_PIPS = 12;

interface CoreControlItem {
  type: string;
  name: string;
  testId: string;
  icon: React.ReactNode;
  bgClass: string;
  borderClass: string;
  supportsRepeat?: boolean;
  params?: Record<string, any>;
}

const CORE_CONTROL_ITEMS: CoreControlItem[] = [
  {
    type: 'LOOP_START',
    name: 'Loop Start',
    testId: 'palette-loop-start',
    icon: <Repeat className="w-5 h-5 md:w-8 md:h-8 text-white stroke-[3]" />,
    bgClass: 'bg-purple-700 hover:bg-purple-600',
    borderClass: 'border-purple-400',
    supportsRepeat: true,
  },
  {
    type: 'LOOP_END',
    name: 'Loop End',
    testId: 'palette-loop-end',
    icon: <CornerDownLeft className="w-5 h-5 md:w-8 md:h-8 text-purple-200 stroke-[3]" />,
    bgClass: 'bg-purple-900 hover:bg-purple-800',
    borderClass: 'border-purple-500',
    supportsRepeat: false,
  },
  {
    type: 'VAR_ASSIGN',
    name: 'Set Variable',
    testId: 'palette-var-assign',
    icon: (
      <span className="font-mono font-bold text-[11px] md:text-sm text-white tracking-tight">a=b</span>
    ),
    bgClass: 'bg-violet-700 hover:bg-violet-600',
    borderClass: 'border-violet-400',
    supportsRepeat: false,
    params: { a: 'a', b: 1 },
  },
  {
    type: 'VAR_OP',
    name: 'Variable Math',
    testId: 'palette-var-op',
    icon: (
      <span className="font-mono font-bold text-[9px] md:text-xs text-white tracking-tight">a=b*c</span>
    ),
    bgClass: 'bg-indigo-700 hover:bg-indigo-600',
    borderClass: 'border-indigo-400',
    supportsRepeat: false,
    params: { a: 'a', b: 'a', op: '+', c: 1 },
  },
  {
    type: 'CALL_F1',
    name: 'Call Function 1',
    testId: 'palette-call-f1',
    icon: (
      <div className="flex items-center gap-0.5 md:gap-1">
        <PhoneCall className="w-3.5 h-3.5 md:w-6 md:h-6 text-white stroke-[2.5]" />
        <span className="text-sm md:text-xl font-black text-white">1</span>
      </div>
    ),
    bgClass: 'bg-emerald-600 hover:bg-emerald-500',
    borderClass: 'border-emerald-400',
    supportsRepeat: false,
  },
  {
    type: 'CALL_F2',
    name: 'Call Function 2',
    testId: 'palette-call-f2',
    icon: (
      <div className="flex items-center gap-0.5 md:gap-1">
        <PhoneCall className="w-3.5 h-3.5 md:w-6 md:h-6 text-white stroke-[2.5]" />
        <span className="text-sm md:text-xl font-black text-white">2</span>
      </div>
    ),
    bgClass: 'bg-blue-600 hover:bg-blue-500',
    borderClass: 'border-blue-400',
    supportsRepeat: false,
  },
  {
    type: 'CALL_F3',
    name: 'Call Function 3',
    testId: 'palette-call-f3',
    icon: (
      <div className="flex items-center gap-0.5 md:gap-1">
        <PhoneCall className="w-3.5 h-3.5 md:w-6 md:h-6 text-white stroke-[2.5]" />
        <span className="text-sm md:text-xl font-black text-white">3</span>
      </div>
    ),
    bgClass: 'bg-rose-600 hover:bg-rose-500',
    borderClass: 'border-rose-400',
    supportsRepeat: false,
  },
];

const NUMBER_BADGES = [2, 3, 4, 5, 6, 7, 8, 9];

const PALETTE_SCOPE_TABS = [
  {
    id: 'MAIN' as ScopeType,
    label: 'Main',
    icon: <Sparkles className="w-3.5 h-3.5 text-yellow-300" />,
    activeColor: 'bg-indigo-600 border-indigo-400 text-white',
  },
  {
    id: 'F1' as ScopeType,
    label: '1',
    icon: <span className="font-black text-xs">1</span>,
    activeColor: 'bg-emerald-600 border-emerald-400 text-white',
  },
  {
    id: 'F2' as ScopeType,
    label: '2',
    icon: <span className="font-black text-xs">2</span>,
    activeColor: 'bg-blue-600 border-blue-400 text-white',
  },
  {
    id: 'F3' as ScopeType,
    label: '3',
    icon: <span className="font-black text-xs">3</span>,
    activeColor: 'bg-rose-600 border-rose-400 text-white',
  },
];

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

      // Activate block drag if pointer moves below the block bar (mouse only; touch is handled by touchDragDrop polyfill)
      if (!isDraggingBlockRef.current && targetButtonRef.current && isBelowBar && e.pointerType === 'mouse') {
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
    if (e.isTrusted) {
      e.preventDefault();
    }
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

export const BlockPalette: React.FC = React.memo(() => {
  const {
    appMode,
    activeActivityId,
    activeActivityVersion,
    slotCapRejectionCount,
    lastSlotCapRejectedAt,
    activeSimId,
    activeScope,
    setActiveScope,
    addBlock,
    replacePlaceholderBlock,
    workspace,
    clearWorkspace,
    runtime,
    updateBlockRepeat,
    selectedBlockId,
    setSelectedBlockId,
    removeBlock,
    isSubpaletteCollapsed,
    toggleSubpalette,
    isFunctionBarOpen,
    toggleFunctionBar,
  } = useAppStoreSelector((s) => ({
    appMode: s.appMode,
    activeActivityId: s.activeActivityId,
    activeActivityVersion: s.activeActivityVersion,
    slotCapRejectionCount: s.slotCapRejectionCount,
    lastSlotCapRejectedAt: s.lastSlotCapRejectedAt,
    activeSimId: s.activeSimId,
    activeScope: s.activeScope,
    setActiveScope: s.setActiveScope,
    addBlock: s.addBlock,
    replacePlaceholderBlock: s.replacePlaceholderBlock,
    workspace: s.workspace,
    clearWorkspace: s.clearWorkspace,
    runtime: s.runtime,
    updateBlockRepeat: s.updateBlockRepeat,
    selectedBlockId: s.selectedBlockId,
    setSelectedBlockId: s.setSelectedBlockId,
    removeBlock: s.removeBlock,
    isSubpaletteCollapsed: s.isSubpaletteCollapsed,
    toggleSubpalette: s.toggleSubpalette,
    isFunctionBarOpen: s.isFunctionBarOpen,
    toggleFunctionBar: s.toggleFunctionBar,
  }));

  const [isDeleteHovered, setIsDeleteHovered] = useState(false);
  const [isTrashArmed, setIsTrashArmed] = useState(false);
  const trashBtnRef = useRef<HTMLButtonElement>(null);
  const [, setShakeTick] = useState(0);

  useEffect(() => {
    setIsTrashArmed(false);
  }, [selectedBlockId, activeScope, activeActivityId, appMode, activeSimId, workspace[activeScope]?.length === 0]);

  useEffect(() => {
    if (!isTrashArmed) return;
    const timer = setTimeout(() => setIsTrashArmed(false), 3000);
    const onPointerDown = (ev: PointerEvent) => {
      if (trashBtnRef.current && !trashBtnRef.current.contains(ev.target as Node)) {
        setIsTrashArmed(false);
      }
    };
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        setIsTrashArmed(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isTrashArmed]);

  useEffect(() => {
    if (lastSlotCapRejectedAt === null) return;
    const remaining = SLOT_SHAKE_DURATION_MS - (Date.now() - lastSlotCapRejectedAt);
    if (remaining <= 0) return;
    const timer = setTimeout(() => {
      setShakeTick((n) => n + 1);
    }, remaining + 16);
    return () => clearTimeout(timer);
  }, [lastSlotCapRejectedAt, slotCapRejectionCount]);

  const currentSimEnv = getSimEnvironment(activeSimId);
  const simPaletteItems: SimPaletteItem[] = currentSimEnv?.paletteItems || [];

  const activeActivity = resolveActiveCurriculumActivity(
    appMode,
    activeActivityId,
    activeActivityVersion
  );
  const policy = computeStagedPalettePolicy(appMode, activeActivity, simPaletteItems);
  const budget = computeSlotBudget(workspace, activeScope, appMode, activeActivity?.slotCap);
  const isSlotRejected =
    budget.isCapped &&
    lastSlotCapRejectedAt !== null &&
    Date.now() - lastSlotCapRejectedAt < SLOT_SHAKE_DURATION_MS;
  const counterPipTotal =
    budget.isCapped && budget.counterMax !== null
      ? Math.min(budget.counterMax, MAX_RENDERED_COUNTER_PIPS)
      : 0;
  const visibleSimItems = policy.visibleSimItems;
  const visibleControlItems = CORE_CONTROL_ITEMS.filter((item) =>
    policy.allowedControlTypes.has(item.type)
  );
  const visibleScopeTabs = PALETTE_SCOPE_TABS.filter((tab) =>
    policy.allowedScopes.includes(tab.id)
  );
  const showBadgeRow = policy.allowRepeatBadges || policy.paletteVariableBadges.length > 0;

  const resolveControlItemParams = (item: CoreControlItem): Record<string, any> | undefined => {
    if (!item.params) return undefined;
    if (
      policy.isCurriculum &&
      policy.subpaletteVariableNames.length > 0 &&
      !policy.subpaletteVariableNames.includes('a' as VariableName)
    ) {
      const firstVar = policy.subpaletteVariableNames[0];
      if (item.type === 'VAR_ASSIGN') {
        return { ...item.params, a: firstVar };
      }
      if (item.type === 'VAR_OP') {
        return { ...item.params, a: firstVar, b: firstVar };
      }
    }
    return item.params;
  };

  const blocks = workspace[activeScope] || [];
  const explicitlySelectedBlock = selectedBlockId
    ? blocks.find((b) => b.id === selectedBlockId) ?? null
    : null;

  const activePlaceholderTarget: { scope: ScopeType; block: CodeBlock } | null = (() => {
    if (explicitlySelectedBlock) {
      return explicitlySelectedBlock.type === 'PLACEHOLDER'
        ? { scope: activeScope, block: explicitlySelectedBlock }
        : null;
    }
    if (runtime?.status === 'PAUSED' && runtime.activeBlockId) {
      const pausedScope = runtime.activeScope || activeScope;
      const pausedBlock = (workspace[pausedScope] || []).find(
        (b) => b.id === runtime.activeBlockId && b.type === 'PLACEHOLDER'
      );
      if (pausedBlock) {
        return { scope: pausedScope, block: pausedBlock };
      }
    }
    return null;
  })();

  const activeHintCategory = activePlaceholderTarget
    ? getPlaceholderHintCategory(activePlaceholderTarget.block)
    : null;

  let targetBlock = explicitlySelectedBlock;
  if (!targetBlock && blocks.length > 0) {
    const last = blocks[blocks.length - 1];
    const lastPaletteItem = currentSimEnv?.paletteItems.find((p) => p.actionType === last.type);
    const allowedLastParams = getAllowedParamDefs(
      last.type,
      lastPaletteItem?.paramDefs,
      appMode,
      policy.palette
    );
    if (allowedLastParams.length > 0) {
      targetBlock = last;
    }
  }

  const targetPaletteItem = currentSimEnv?.paletteItems.find(
    (p) => p.actionType === targetBlock?.type
  );
  const allowedTargetParamDefs = targetBlock
    ? getAllowedParamDefs(
        targetBlock.type,
        targetPaletteItem?.paramDefs,
        appMode,
        policy.palette
      )
    : [];
  const isVarBlock =
    (targetBlock?.type === 'VAR_ASSIGN' || targetBlock?.type === 'VAR_OP') &&
    (!policy.isCurriculum ||
      policy.allowVariables ||
      policy.allowedControlTypes.has(targetBlock.type));
  const hasParams = Boolean(allowedTargetParamDefs.length > 0 || isVarBlock);

  const handleToggleParams = () => {
    if (!selectedBlockId && targetBlock) {
      setSelectedBlockId(targetBlock.id);
      if (isSubpaletteCollapsed) {
        toggleSubpalette();
      }
      return;
    }
    toggleSubpalette();
  };

  const handleAddSimBlock = (item: SimPaletteItem) => {
    if (activePlaceholderTarget) {
      replacePlaceholderBlock(
        activePlaceholderTarget.scope,
        activePlaceholderTarget.block.id,
        item.actionType,
        item.params
      );
      return;
    }
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
    const resolvedParams = resolveControlItemParams(item);
    if (activePlaceholderTarget) {
      replacePlaceholderBlock(
        activePlaceholderTarget.scope,
        activePlaceholderTarget.block.id,
        item.type,
        resolvedParams
      );
      return;
    }
    const blocks = workspace[activeScope] || [];
    if (selectedBlockId) {
      const idx = blocks.findIndex((b) => b.id === selectedBlockId);
      if (idx !== -1) {
        addBlock(activeScope, item.type, undefined, idx + 1, resolvedParams);
        return;
      }
    }
    addBlock(activeScope, item.type, undefined, blocks.length, resolvedParams);
  };

  const handleNumberClick = (num: number | string) => {
    if (typeof num === 'number' && !policy.allowRepeatBadges) return;
    if (
      typeof num === 'string' &&
      (!policy.allowVariables || !policy.paletteVariableBadges.includes(num as VariableName))
    ) {
      return;
    }

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
      updateBlockRepeat(activeScope, targetBlock.id, num as any);
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
    e.dataTransfer.setData('application/x-robotemu-palette-block', item.actionType);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleCoreControlDragStart = (e: React.DragEvent, item: CoreControlItem) => {
    const resolvedParams = resolveControlItemParams(item);
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        type: 'PALETTE_BLOCK',
        blockType: item.type,
        params: resolvedParams,
      })
    );
    e.dataTransfer.setData('application/x-robotemu-block', item.type);
    e.dataTransfer.setData('application/x-robotemu-palette-block', item.type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleNumberDragStart = (e: React.DragEvent, num: number | string) => {
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
      <PaletteScrollRow testId="palette-action-row" className="pt-1 px-0.5">
        {/* Dynamic Simulation Palette Blocks */}
        {visibleSimItems.map((item) => {
          const testId = `palette-${item.id}`;
          const isHintHighlighted =
            activeHintCategory !== null &&
            doesBlockMatchHintCategory(item.actionType, item.category, activeHintCategory);
          return (
            <button
              key={item.id}
              type="button"
              data-testid={testId}
              data-hint-highlighted={isHintHighlighted ? 'true' : undefined}
              draggable
              onDragStart={(e) => handlePaletteBlockDragStart(e, item)}
              onClick={() => handleAddSimBlock(item)}
              title={item.name}
              aria-label={item.name}
              className={`flex-shrink-0 flex items-center justify-center p-1.5 md:p-3 rounded-xl md:rounded-2xl border-2 shadow-lg cursor-grab active:cursor-grabbing transition-all active:scale-95 touch-none min-w-[40px] min-h-[40px] md:min-w-[56px] md:min-h-[56px] ${item.bgClass} ${item.borderClass} ${
                isHintHighlighted
                  ? 'ring-3 ring-amber-300 shadow-[0_0_16px_rgba(34,211,238,0.75)] scale-[1.03]'
                  : ''
              }`}
            >
              {item.icon({ isActive: false, className: 'w-5 h-5 md:w-8 md:h-8 text-white stroke-[3]' })}
            </button>
          );
        })}

        {/* Vertical divider (only when both sim and control groups are non-empty) */}
        {visibleSimItems.length > 0 && visibleControlItems.length > 0 && (
          <div className="w-[1px] h-6 md:h-9 bg-slate-700/60 mx-1 flex-shrink-0" />
        )}

        {/* Core Control Structure Blocks (LOOP, Variables, Functions) */}
        {visibleControlItems.map((item) => {
          const isHintHighlighted =
            activeHintCategory !== null &&
            doesBlockMatchHintCategory(item.type, undefined, activeHintCategory);
          return (
            <button
              key={item.type}
              type="button"
              data-testid={item.testId}
              data-hint-highlighted={isHintHighlighted ? 'true' : undefined}
              draggable
              onDragStart={(e) => handleCoreControlDragStart(e, item)}
              onClick={() => handleAddCoreBlock(item)}
              title={item.name}
              aria-label={item.name}
              className={`flex-shrink-0 flex items-center justify-center p-1.5 md:p-3 rounded-xl md:rounded-2xl border-2 shadow-lg cursor-grab active:cursor-grabbing transition-all active:scale-95 touch-none min-w-[40px] min-h-[40px] md:min-w-[56px] md:min-h-[56px] ${item.bgClass} ${item.borderClass} ${
                isHintHighlighted
                  ? 'ring-3 ring-amber-300 shadow-[0_0_16px_rgba(34,211,238,0.75)] scale-[1.03]'
                  : ''
              }`}
            >
              {item.icon}
            </button>
          );
        })}
      </PaletteScrollRow>

      {/* Repeat Tags & Action Param Toggle Row */}
      <div className="flex items-center gap-1.5 md:gap-2">
        {/* Toggle icon for action parameters */}
        {policy.canUseSubpaletteParams && (
          <button
            type="button"
            data-testid="palette-param-toggle-btn"
            onClick={handleToggleParams}
            aria-expanded={!isSubpaletteCollapsed}
            aria-label={
              hasParams
                ? !isSubpaletteCollapsed
                  ? 'Hide action parameters'
                  : 'Show action parameters'
                : 'Action parameters'
            }
            title={
              hasParams
                ? !isSubpaletteCollapsed
                  ? 'Hide action parameters'
                  : 'Show action parameters'
                : 'Action parameters'
            }
            className={`flex-shrink-0 flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl border-2 transition-all active:scale-95 touch-none ${
              hasParams && !isSubpaletteCollapsed
                ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-md ring-2 ring-amber-400/40'
                : hasParams
                ? 'bg-slate-800 hover:bg-slate-700 border-amber-500/50 text-amber-400/90 shadow-sm'
                : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4 md:w-5 md:h-5 stroke-[2.2]" />
          </button>
        )}

        {/* Toggle Function Selection Bar Button (hidden in Curriculum mode when only MAIN is allowed) */}
        {policy.showScopeSelector && (
          <button
            type="button"
            data-testid="btn-toggle-function-bar"
            onClick={toggleFunctionBar}
            aria-expanded={isFunctionBarOpen}
            aria-label={isFunctionBarOpen ? 'Hide function tabs' : 'Show function tabs'}
            title={isFunctionBarOpen ? 'Hide function tabs' : 'Show function tabs'}
            className={`flex-shrink-0 flex items-center justify-center gap-1 px-1.5 md:px-2 h-8 md:h-10 rounded-lg md:rounded-xl border-2 transition-all active:scale-95 touch-none ${
              activeScope === 'F1'
                ? 'bg-emerald-600/30 border-emerald-400 text-emerald-100 shadow-sm'
                : activeScope === 'F2'
                ? 'bg-blue-600/30 border-blue-400 text-blue-100 shadow-sm'
                : activeScope === 'F3'
                ? 'bg-rose-600/30 border-rose-400 text-rose-100 shadow-sm'
                : isFunctionBarOpen
                ? 'bg-indigo-600/30 border-indigo-400 text-indigo-200 shadow-md ring-2 ring-indigo-400/40'
                : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5 md:w-4 md:h-4 text-indigo-300 stroke-[2.2]" />
            <span className="font-bold text-[10px] md:text-xs tracking-tight">
              {activeScope === 'MAIN' ? 'Main' : activeScope}
            </span>
          </button>
        )}

        {/* Divider & Number/Variable Multipliers Row */}
        {showBadgeRow && (
          <>
            <div className="w-[1px] h-6 md:h-8 bg-slate-700/60 flex-shrink-0" />

            <PaletteScrollRow testId="palette-number-row" className="flex-1 min-w-0">
              {policy.allowRepeatBadges &&
                NUMBER_BADGES.map((num) => (
                  <button
                    key={num}
                    type="button"
                    data-testid={`palette-number-${num}`}
                    draggable
                    onDragStart={(e) => handleNumberDragStart(e, num)}
                    onClick={() => handleNumberClick(num)}
                    className="flex-shrink-0 flex items-center justify-center w-7 h-7 md:w-10 md:h-10 rounded-full bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-xs md:text-lg border-2 border-yellow-200 shadow-md cursor-grab active:cursor-grabbing transition-transform active:scale-95 touch-none"
                    title={`Set repeat ${num}`}
                    aria-label={`Set repeat ${num}`}
                  >
                    {num}
                  </button>
                ))}
              {policy.allowRepeatBadges && policy.paletteVariableBadges.length > 0 && (
                <div className="w-[1px] h-5 md:h-6 bg-slate-700/60 mx-1 flex-shrink-0" />
              )}
              {policy.paletteVariableBadges.map((v) => (
                <button
                  key={v}
                  type="button"
                  data-testid={`palette-number-var-${v}`}
                  draggable
                  onDragStart={(e) => handleNumberDragStart(e, v)}
                  onClick={() => handleNumberClick(v)}
                  className="flex-shrink-0 flex items-center justify-center w-7 h-7 md:w-10 md:h-10 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black italic font-mono text-[11px] md:text-base border-2 border-amber-300 shadow-md cursor-grab active:cursor-grabbing transition-transform active:scale-95 touch-none"
                  title={`Set repeat variable ${v}`}
                  aria-label={`Set repeat variable ${v}`}
                  >
                  {v}
                </button>
              ))}
            </PaletteScrollRow>
          </>
        )}

        {/* Physical Block-Budget Visual Slot Counter (inline in existing palette control row) */}
        {budget.isCapped && budget.counterMax !== null && (
          <div
            data-testid="workspace-slot-counter"
            data-slot-full={budget.isFull ? 'true' : 'false'}
            data-slot-rejected={isSlotRejected ? 'true' : 'false'}
            role="group"
            aria-label={`Block slots: ${budget.counterUsed} of ${budget.counterMax} used${
              budget.isFull ? ', tray full' : ''
            }`}
            className={`ml-auto flex-shrink-0 flex items-center gap-1.5 px-2 md:px-2.5 h-8 md:h-10 rounded-lg md:rounded-xl border-2 transition-colors select-none ${
              isSlotRejected
                ? 'animate-slot-tray-shake border-amber-400 bg-amber-500/20 text-amber-200 ring-2 ring-amber-400/50'
                : budget.isFull
                ? 'border-amber-500/70 bg-amber-950/40 text-amber-200'
                : 'border-slate-700/90 bg-slate-950/70 text-slate-200'
            }`}
          >
            <div
              className={`${showBadgeRow ? 'hidden sm:flex' : 'flex'} items-center gap-1`}
              aria-hidden="true"
            >
              {Array.from({ length: counterPipTotal }).map((_, pipIdx) => {
                const isFilled = pipIdx < budget.counterUsed;
                return (
                  <span
                    key={pipIdx}
                    data-slot-pip={isFilled ? 'filled' : 'empty'}
                    className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-[3px] transition-colors ${
                      isFilled
                        ? budget.isFull
                          ? 'bg-amber-400 border border-amber-200 shadow-[0_0_6px_rgba(251,191,36,0.5)]'
                          : 'bg-sky-400 border border-sky-200'
                        : 'border border-dashed border-slate-500 bg-slate-900/60'
                    }`}
                  />
                );
              })}
            </div>
            <span
              data-testid="workspace-slot-count-label"
              className="font-mono font-black text-xs md:text-sm tracking-tight whitespace-nowrap"
            >
              {budget.counterUsed} / {budget.counterMax}
            </span>
          </div>
        )}

        {/* Smart 2-Tap Trash Button (1-tap delete selected block; 2-tap armed clear all) */}
        <button
          ref={trashBtnRef}
          type="button"
          data-testid="btn-trash"
          data-armed={isTrashArmed ? 'true' : 'false'}
          disabled={!selectedBlockId && blocks.length === 0}
          onClick={() => {
            if (selectedBlockId) {
              removeBlock(activeScope, selectedBlockId);
              setIsTrashArmed(false);
            } else if (blocks.length > 0) {
              if (!isTrashArmed) {
                setIsTrashArmed(true);
                useAppStore.setState({
                  statusAnnouncement: 'Tap Trash again to clear all blocks.',
                });
              } else {
                clearWorkspace(activeScope);
                setIsTrashArmed(false);
              }
            }
          }}
          title={
            selectedBlockId
              ? 'Delete selected block'
              : isTrashArmed
              ? 'Tap again to clear all blocks'
              : blocks.length > 0
              ? 'Clear all blocks (tap twice)'
              : 'Workspace empty'
          }
          aria-label={
            selectedBlockId
              ? 'Delete selected block'
              : isTrashArmed
              ? 'Confirm clear all blocks'
              : 'Trash'
          }
          className={`${
            budget.isCapped && budget.counterMax !== null ? '' : 'ml-auto'
          } relative flex-shrink-0 flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-lg md:rounded-xl border-2 transition-all ${
            selectedBlockId
              ? 'bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white border-rose-400 shadow-md cursor-pointer active:scale-95'
              : isTrashArmed
              ? 'bg-red-600 hover:bg-red-500 text-white border-red-300 shadow-lg ring-2 ring-red-400/60 animate-pulse cursor-pointer active:scale-95'
              : blocks.length > 0
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700 cursor-pointer active:scale-95'
              : 'bg-slate-900/60 text-slate-600 border-slate-800/80 cursor-not-allowed opacity-40'
          }`}
        >
          <Trash2 className="w-4 h-4 md:w-5 md:h-5 stroke-[2.2]" />
          {isTrashArmed && !selectedBlockId && (
            <span
              aria-hidden="true"
              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-300 text-slate-950 font-black text-[10px] leading-none flex items-center justify-center border border-slate-900 shadow"
            >
              ?
            </span>
          )}
        </button>
      </div>

      {/* Collapsible Function Selection Bar (auto-opened by store on F1+ lessons/execution, manually toggleable) */}
      {isFunctionBarOpen && policy.showScopeSelector && (
        <div
          data-testid="palette-function-bar"
          className="flex items-center gap-1.5 p-1.5 bg-slate-950/80 rounded-xl border border-slate-800 animate-in fade-in slide-in-from-top-1"
        >
          <span className="text-[10px] uppercase font-bold text-slate-400 px-1">Scope:</span>
          {visibleScopeTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              data-testid={`palette-tab-${tab.id.toLowerCase()}`}
              onClick={() => setActiveScope(tab.id)}
              aria-pressed={activeScope === tab.id}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold transition-all active:scale-95 ${
                activeScope === tab.id
                  ? `${tab.activeColor} shadow-sm`
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Subpalette for Selected Block Parameters */}
      <BlockSubpalette />
    </div>
  );
});

