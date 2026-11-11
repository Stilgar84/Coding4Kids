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
  Palette,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { getSimEnvironment } from '../engine/simulation/registry';
import { getActivityAtVersion, getActivityLatest } from '../data/curriculum';
import { BlockParamBadge } from './params/BlockParamBadge';

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
  const { updateBlockRepeat, updateBlockParams, runtime } = useAppStore();
  const subscribedSimId = useAppStore((state) => state.activeSimId);
  const subscribedAppMode = useAppStore((state) => state.appMode);
  const subscribedActivityId = useAppStore((state) => state.activeActivityId);
  const subscribedActivityVersion = useAppStore((state) => state.activeActivityVersion);

  const storeSnapshot = useAppStore.getState();
  const activeSimId = storeSnapshot.activeSimId || subscribedSimId;
  const appMode = storeSnapshot.appMode || subscribedAppMode;
  const activeActivityId = storeSnapshot.activeActivityId || subscribedActivityId;
  const activeActivityVersion = storeSnapshot.activeActivityVersion || subscribedActivityVersion;

  const [isNumberHovered, setIsNumberHovered] = useState(false);

  const activeCurriculumActivity =
    appMode === 'curriculum'
      ? getActivityAtVersion(activeActivityId, activeActivityVersion) ??
        getActivityLatest(activeActivityId)
      : undefined;
  const allowActionParams =
    appMode !== 'curriculum' || activeCurriculumActivity?.palette?.allowActionParams !== false;

  const currentSimEnv = getSimEnvironment(activeSimId);
  const lookupActionType =
    activeSimId === 'turtle' && block.type === 'MOVE_FWD'
      ? 'FORWARD'
      : activeSimId === 'turtle' && block.type === 'MOVE_BACK'
      ? 'BACKWARD'
      : block.type;
  const paletteItem = currentSimEnv?.paletteItems.find((p) => p.actionType === lookupActionType);
  const paramDefs = paletteItem?.paramDefs || [];
  const hasParams = paramDefs.length > 0 && allowActionParams;

  // Check if block type supports repeat multipliers
  const nonRepeatableTypes = [
    'PEN_UP',
    'PEN_DOWN',
    'SET_PEN_COLOR',
    'SET_PEN_WIDTH',
    'LOOP_END',
    'CALL_F1',
    'CALL_F2',
    'CALL_F3',
    'VAR_ASSIGN',
    'VAR_OP',
  ];
  const supportsMultiplier = !nonRepeatableTypes.includes(block.type);

  const isVarRepeat = typeof block.repeatCount === 'string' && /^[a-z]$/.test(block.repeatCount);
  const showRepeatBadge =
    supportsMultiplier &&
    block.repeatCount !== undefined &&
    (isVarRepeat || (block.type === 'LOOP_START' ? (block.repeatCount as number) >= 0 : (block.repeatCount as number) > 1));

  // Theme & color classes for action and parameter container
  const getBlockTheme = () => {
    if (isActive) {
      return {
        bgClass: 'bg-yellow-400',
        borderClass: 'border-yellow-200',
        iconColor: 'text-slate-950 stroke-[3]',
        activeClass:
          'bg-yellow-400 border-yellow-200 text-slate-950 shadow-[0_0_14px_rgba(250,204,21,0.85)]',
      };
    }

    let bgClass = 'bg-slate-700';
    let borderClass = 'border-slate-500';

    switch (block.type) {
      case 'MOVE_FWD':
      case 'FORWARD':
        bgClass = 'bg-sky-600';
        borderClass = 'border-sky-400';
        break;

      case 'MOVE_BACK':
      case 'BACKWARD':
        bgClass = 'bg-sky-700';
        borderClass = 'border-sky-500';
        break;

      case 'TURN_LEFT':
      case 'TURN_RIGHT':
        bgClass = 'bg-amber-600';
        borderClass = 'border-amber-400';
        break;

      case 'ARC_LEFT':
      case 'ARC_RIGHT':
        bgClass = 'bg-indigo-600';
        borderClass = 'border-indigo-400';
        break;

      case 'PEN_UP':
        bgClass = 'bg-teal-700';
        borderClass = 'border-teal-400';
        break;

      case 'PEN_DOWN':
        bgClass = 'bg-teal-600';
        borderClass = 'border-teal-300';
        break;

      case 'SET_PEN_COLOR':
      case 'SET_PEN_WIDTH':
        bgClass = 'bg-slate-800';
        borderClass = 'border-slate-500';
        break;

      case 'LOOP_START':
        bgClass = 'bg-purple-700';
        borderClass = 'border-purple-400';
        break;

      case 'LOOP_END':
        bgClass = 'bg-purple-900';
        borderClass = 'border-purple-500';
        break;

      case 'CALL_F1':
        bgClass = 'bg-emerald-600';
        borderClass = 'border-emerald-400';
        break;

      case 'CALL_F2':
        bgClass = 'bg-blue-600';
        borderClass = 'border-blue-400';
        break;

      case 'CALL_F3':
        bgClass = 'bg-rose-600';
        borderClass = 'border-rose-400';
        break;

      case 'VAR_ASSIGN':
        bgClass = 'bg-violet-700';
        borderClass = 'border-violet-400';
        break;

      case 'VAR_OP':
        bgClass = 'bg-indigo-700';
        borderClass = 'border-indigo-400';
        break;

      default:
        bgClass = 'bg-slate-700';
        borderClass = 'border-slate-500';
        break;
    }

    return {
      bgClass,
      borderClass,
      iconColor: 'text-white stroke-[3]',
      activeClass:
        'bg-yellow-400 border-yellow-200 text-slate-950 shadow-[0_0_14px_rgba(250,204,21,0.85)]',
    };
  };

  const theme = getBlockTheme();
  const iconColor = theme.iconColor;

  // Inner icon / content for the action block
  const renderBlockIcon = () => {
    switch (block.type) {
      case 'MOVE_FWD':
      case 'FORWARD':
        return <ArrowUp className={`w-5 h-5 md:w-7 md:h-7 ${iconColor}`} />;

      case 'MOVE_BACK':
      case 'BACKWARD':
        return <ArrowDown className={`w-5 h-5 md:w-7 md:h-7 ${iconColor}`} />;

      case 'TURN_LEFT':
        return activeSimId === 'turtle' ? (
          <RotateCcw className={`w-5 h-5 md:w-7 md:h-7 ${iconColor}`} />
        ) : (
          <CornerUpLeft className={`w-5 h-5 md:w-7 md:h-7 ${iconColor}`} />
        );

      case 'TURN_RIGHT':
        return activeSimId === 'turtle' ? (
          <RotateCw className={`w-5 h-5 md:w-7 md:h-7 ${iconColor}`} />
        ) : (
          <CornerUpRight className={`w-5 h-5 md:w-7 md:h-7 ${iconColor}`} />
        );

      case 'ARC_LEFT':
        return (
          <div className="flex flex-col items-center justify-center leading-none">
            <svg
              className={`w-4 h-4 md:w-5 md:h-5 ${isActive ? 'stroke-slate-950' : 'stroke-white'}`}
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth="2.5"
            >
              <path d="M 19 20 A 15 15 0 0 0 4 5" />
              <polyline points="4 10 4 5 9 5" />
            </svg>
            <span
              className={`text-[8px] md:text-[9px] font-black ${
                isActive ? 'text-slate-950' : 'text-indigo-200'
              }`}
            >
              Arc L
            </span>
          </div>
        );

      case 'ARC_RIGHT':
        return (
          <div className="flex flex-col items-center justify-center leading-none">
            <svg
              className={`w-4 h-4 md:w-5 md:h-5 ${isActive ? 'stroke-slate-950' : 'stroke-white'}`}
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth="2.5"
            >
              <path d="M 5 20 A 15 15 0 0 1 20 5" />
              <polyline points="20 10 20 5 15 5" />
            </svg>
            <span
              className={`text-[8px] md:text-[9px] font-black ${
                isActive ? 'text-slate-950' : 'text-indigo-200'
              }`}
            >
              Arc R
            </span>
          </div>
        );

      case 'PEN_UP':
        return (
          <div className="relative flex items-center justify-center">
            <PenTool className={`w-4.5 h-4.5 md:w-6 md:h-6 ${isActive ? 'text-slate-950' : 'text-teal-200'}`} />
            <Slash className="w-5 h-5 md:w-7 md:h-7 text-red-400 stroke-[2.5] absolute -top-0.5 -left-0.5" />
          </div>
        );

      case 'PEN_DOWN':
        return (
          <PenTool
            className={`w-4.5 h-4.5 md:w-6 md:h-6 ${
              isActive ? 'text-slate-950 stroke-[2.5]' : 'text-teal-100 stroke-[2.5]'
            }`}
          />
        );

      case 'SET_PEN_COLOR':
        return (
          <Palette
            className={`w-4.5 h-4.5 md:w-6 md:h-6 stroke-[2.5] ${
              isActive ? 'text-slate-950' : 'text-pink-300'
            }`}
          />
        );

      case 'SET_PEN_WIDTH':
        return (
          <div className="flex flex-col items-center justify-center gap-0.5 md:gap-1">
            <div className={`w-4 md:w-6 h-1 md:h-1.5 rounded-full ${isActive ? 'bg-slate-950' : 'bg-white'}`} />
            <span
              className={`text-[8px] md:text-[9px] font-bold ${
                isActive ? 'text-slate-950' : 'text-slate-300'
              }`}
            >
              Width
            </span>
          </div>
        );

      case 'LOOP_START':
        return <Repeat className={`w-5 h-5 md:w-7 md:h-7 ${iconColor}`} />;

      case 'LOOP_END':
        return (
          <Undo2
            className={`w-5 h-5 md:w-7 md:h-7 ${
              isActive ? 'text-slate-950 stroke-[3]' : 'text-purple-200 stroke-[3]'
            }`}
          />
        );

      case 'CALL_F1':
        return (
          <div className="flex items-center justify-center gap-0.5 md:gap-1">
            <PhoneCall
              className={`w-4 h-4 md:w-6 md:h-6 stroke-[2.5] ${isActive ? 'text-slate-950' : 'text-white'}`}
            />
            <span
              className={`text-sm md:text-lg font-black ${isActive ? 'text-slate-950' : 'text-white'}`}
            >
              1
            </span>
          </div>
        );

      case 'CALL_F2':
        return (
          <div className="flex items-center justify-center gap-0.5 md:gap-1">
            <PhoneCall
              className={`w-4 h-4 md:w-6 md:h-6 stroke-[2.5] ${isActive ? 'text-slate-950' : 'text-white'}`}
            />
            <span
              className={`text-sm md:text-lg font-black ${isActive ? 'text-slate-950' : 'text-white'}`}
            >
              2
            </span>
          </div>
        );

      case 'CALL_F3':
        return (
          <div className="flex items-center justify-center gap-0.5 md:gap-1">
            <PhoneCall
              className={`w-4 h-4 md:w-6 md:h-6 stroke-[2.5] ${isActive ? 'text-slate-950' : 'text-white'}`}
            />
            <span
              className={`text-sm md:text-lg font-black ${isActive ? 'text-slate-950' : 'text-white'}`}
            >
              3
            </span>
          </div>
        );

      case 'VAR_ASSIGN':
        return (
          <div className="flex items-center gap-0.5 md:gap-1 font-mono font-bold text-xs md:text-sm select-none px-1">
            <span className={`italic ${isActive ? 'text-slate-950 font-black' : 'text-amber-300'}`}>
              {block.params?.a ?? 'a'}
            </span>
            <span className={isActive ? 'text-slate-800' : 'text-slate-300'}>=</span>
            <span className={isActive ? 'text-slate-950 font-black' : 'text-violet-200'}>
              {block.params?.b ?? 1}
            </span>
          </div>
        );

      case 'VAR_OP':
        return (
          <div className="flex items-center gap-0.5 md:gap-1 font-mono font-bold text-[10px] md:text-xs select-none px-0.5 md:px-1">
            <span className={`italic ${isActive ? 'text-slate-950 font-black' : 'text-amber-300'}`}>
              {block.params?.a ?? 'a'}
            </span>
            <span className={isActive ? 'text-slate-800' : 'text-slate-300'}>=</span>
            <span className={isActive ? 'text-slate-950 font-black' : 'text-violet-200'}>
              {block.params?.b ?? 'a'}
            </span>
            <span className={isActive ? 'text-slate-950 font-black' : 'text-amber-400'}>
              {block.params?.op ?? '+'}
            </span>
            <span className={isActive ? 'text-slate-950 font-black' : 'text-violet-200'}>
              {block.params?.c ?? 1}
            </span>
          </div>
        );

      default:
        return <span className="text-xs font-bold text-white truncate">{block.type}</span>;
    }
  };

  // Block visual container: left side has flat right edge when parameters are present
  const renderBlockContent = () => {
    const roundedClass = hasParams ? 'rounded-l-2xl rounded-r-none' : 'rounded-2xl';
    const borderEdgesClass = hasParams ? 'border-2 border-r-0' : 'border-2';

    return (
      <div
        className={`w-full h-full flex flex-col items-center justify-center ${roundedClass} ${borderEdgesClass} p-2 shadow-md transition-colors ${
          isActive ? theme.activeClass : `${theme.bgClass} ${theme.borderClass}`
        }`}
      >
        {renderBlockIcon()}
      </div>
    );
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

      {/* Main Block Visual & Attached Parameter Badges */}
      <div
        className={`flex items-center rounded-xl md:rounded-2xl transition-all ${
          isNumberHovered
            ? 'ring-4 ring-yellow-400'
            : isLoopError
            ? 'ring-2 ring-red-500'
            : isSelected
            ? 'ring-2 ring-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.5)]'
            : ''
        }`}
      >
        <div className={`${(block.type === 'VAR_ASSIGN' || block.type === 'VAR_OP') ? 'min-w-[40px] md:min-w-[56px] px-1 md:px-2' : 'w-[40px] md:w-[56px]'} h-[40px] md:h-[56px] flex items-center justify-center flex-shrink-0`}>
          {renderBlockContent()}
        </div>

        {/* Attached Parameter Badges on the Right */}
        {hasParams && (
          <div
            data-testid={`block-params-container-${block.id}`}
            className={`flex items-center gap-1 md:gap-1.5 pl-0.5 md:pl-1 pr-1 md:pr-2 h-[40px] md:h-[56px] -ml-px rounded-r-xl md:rounded-r-2xl border-2 border-l-0 shadow-md transition-colors flex-shrink-0 ${
              isActive
                ? 'bg-yellow-400 border-yellow-200'
                : `${theme.bgClass} ${theme.borderClass}`
            }`}
          >
            {paramDefs.map((def) => (
              <BlockParamBadge
                key={def.id}
                paramDef={def}
                value={def.id === 'length' ? (block.params?.length ?? block.params?.distance) : block.params?.[def.id]}
                actionType={block.type}
                disabled={runtime?.status === 'RUNNING'}
                onChange={(newVal) =>
                  updateBlockParams(scope, block.id, { [def.id]: newVal })
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Number Badge Slot: Absolute-positioned so it does not alter block height or vertical alignment.
          Shows <current>/<total> at runtime when iterating, or multiplier tag when idle */}
      {iterationProgress ? (
        <div
          data-testid={`badge-repeat-${block.id}`}
          data-iteration-badge="true"
          className="absolute -bottom-1.5 -right-1.5 z-20 flex items-center justify-center min-w-[24px] md:min-w-[28px] h-5 md:h-6 px-1 rounded-full border-2 border-yellow-300 bg-slate-900 shadow-lg text-[10px] md:text-xs"
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
          className="absolute -bottom-1.5 -right-1 z-20 flex items-center justify-center w-5 h-5 md:w-6 md:h-6 rounded-full border-2 border-yellow-200 bg-yellow-400 hover:bg-red-500 hover:border-red-300 hover:text-white text-slate-950 font-black text-[10px] md:text-xs shadow-md transition-colors cursor-pointer"
          title="Click to remove tag"
        >
          {typeof block.repeatCount === 'string' ? (
            <span className="italic font-mono">{block.repeatCount}</span>
          ) : (
            block.repeatCount
          )}
        </button>
      ) : null}
    </div>
  );
};

