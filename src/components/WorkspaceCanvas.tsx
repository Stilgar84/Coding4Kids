import React, { useState, useEffect, useMemo } from 'react';
import { useAppStoreSelector } from '../store/useAppStore';
import {
  BlockItem,
  computeLoopNestingMetadata,
  type LoopStrokeStyle,
  type MatchedLoopSpan,
  type BlockLoopRoleSpan,
  type BlockLoopMetadata,
  type ScopeLoopNestingAnalysis,
} from './BlockItem';
import { AlertTriangle } from 'lucide-react';
import { validateLoopStructure } from '../engine/interpreter';
import {
  computeSlotBudget,
  resolveActiveCurriculumActivity,
} from '../utils/curriculumStagePolicy';

export {
  computeLoopNestingMetadata,
  type LoopStrokeStyle,
  type MatchedLoopSpan,
  type BlockLoopRoleSpan,
  type BlockLoopMetadata,
  type ScopeLoopNestingAnalysis,
};

const SLOT_SHAKE_DURATION_MS = 500;

export const WorkspaceCanvas: React.FC = () => {
  const {
    appMode,
    activeActivityId,
    activeActivityVersion,
    slotCapRejectionCount,
    lastSlotCapRejectedAt,
    activeScope,
    workspace,
    runtime,
    selectedBlockId,
    setSelectedBlockId,
    addBlock,
    reorderBlocks,
    removeBlock,
  } = useAppStoreSelector((s) => ({
    appMode: s.appMode,
    activeActivityId: s.activeActivityId,
    activeActivityVersion: s.activeActivityVersion,
    slotCapRejectionCount: s.slotCapRejectionCount,
    lastSlotCapRejectedAt: s.lastSlotCapRejectedAt,
    activeScope: s.activeScope,
    workspace: s.workspace,
    runtime: s.runtime,
    selectedBlockId: s.selectedBlockId,
    setSelectedBlockId: s.setSelectedBlockId,
    addBlock: s.addBlock,
    reorderBlocks: s.reorderBlocks,
    removeBlock: s.removeBlock,
  }));

  const [dropIndicatorIndex, setDropIndicatorIndex] = useState<number | null>(null);
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [, setShakeTick] = useState(0);

  useEffect(() => {
    if (lastSlotCapRejectedAt === null) return;
    const remaining = SLOT_SHAKE_DURATION_MS - (Date.now() - lastSlotCapRejectedAt);
    if (remaining <= 0) return;
    const timer = setTimeout(() => {
      setShakeTick((n) => n + 1);
    }, remaining + 16);
    return () => clearTimeout(timer);
  }, [lastSlotCapRejectedAt, slotCapRejectionCount]);

  const activeActivity = resolveActiveCurriculumActivity(
    appMode,
    activeActivityId,
    activeActivityVersion
  );
  const budget = computeSlotBudget(workspace, activeScope, appMode, activeActivity?.slotCap);
  const isSlotRejected =
    budget.isCapped &&
    lastSlotCapRejectedAt !== null &&
    Date.now() - lastSlotCapRejectedAt < SLOT_SHAKE_DURATION_MS;

  const blocks = workspace[activeScope] || [];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBlockId) {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
          return;
        }
        e.preventDefault();
        removeBlock(activeScope, selectedBlockId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeScope, selectedBlockId, removeBlock]);

  // Loop validation diagnostics & matched nesting bracket metadata
  const loopValidation = useMemo(() => validateLoopStructure(blocks), [blocks]);
  const unclosedSet = useMemo(
    () =>
      new Set([
        ...loopValidation.unclosedLoopStartIds,
        ...loopValidation.orphanLoopEndIds,
      ]),
    [loopValidation]
  );
  const activeLoopStartPcsKey = (runtime?.loopStack ?? [])
    .filter((frame) => frame.scope === activeScope)
    .map((frame) => frame.loopStartPc)
    .join(',');
  const loopAnalysis = useMemo(() => {
    const activeLoopStartPcs = new Set(
      activeLoopStartPcsKey
        ? activeLoopStartPcsKey.split(',').map((v) => Number(v))
        : []
    );
    return computeLoopNestingMetadata(blocks, activeLoopStartPcs);
  }, [blocks, activeLoopStartPcsKey]);
  const sequenceGapClass =
    loopAnalysis.maxTier >= 2
      ? 'gap-x-1.5 gap-y-9 pb-9'
      : loopAnalysis.maxTier >= 1
      ? 'gap-x-1.5 gap-y-7 pb-7'
      : loopAnalysis.maxDepth > 0
      ? 'gap-x-1.5 gap-y-5 pb-5'
      : 'gap-1.5';

  // Handle canvas background click to reset selection
  const handleCanvasClick = (e: React.MouseEvent) => {
    // If not clicking inside a block, clear selection
    const target = e.target as HTMLElement;
    if (!target.closest('[data-testid^="block-"]')) {
      setSelectedBlockId(null);
    }
  };

  const handleSequenceDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (dropIndicatorIndex === null) {
      setDropIndicatorIndex(blocks.length);
    }
  };

  const handleSequenceDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDropIndicatorIndex(null);
    }
  };

  const handleSlotDragOver = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDropIndicatorIndex(targetIndex);
  };

  const handleDropAtSlot = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDropIndicatorIndex(null);
    setDraggingBlockId(null);

    const dataStr = e.dataTransfer.getData('application/json');
    if (!dataStr) return;

    try {
      const data = JSON.parse(dataStr);
      if (data.type === 'PALETTE_BLOCK') {
        addBlock(activeScope, data.blockType, undefined, targetIndex, data.params);
      } else if (data.type === 'WORKSPACE_BLOCK') {
        const fromIndex = data.index;
        if (fromIndex !== undefined && fromIndex !== null && fromIndex !== targetIndex) {
          const finalToIndex = targetIndex > fromIndex ? targetIndex - 1 : targetIndex;
          reorderBlocks(data.scope || activeScope, fromIndex, finalToIndex);
        }
      }
    } catch {
      // ignore
    }
  };

  const handleSequenceDropFallback = (e: React.DragEvent) => {
    e.preventDefault();
    const targetIdx = dropIndicatorIndex !== null ? dropIndicatorIndex : blocks.length;
    handleDropAtSlot(e, targetIdx);
  };

  const handleDragEnd = () => {
    setDraggingBlockId(null);
    setDropIndicatorIndex(null);
  };

  const renderPlacedBlocks = () =>
    blocks.map((block, idx) => {
      const isSelected = selectedBlockId === block.id;
      const isLoopError = unclosedSet.has(block.id);
      const showDropBefore = dropIndicatorIndex === idx && idx === 0;
      const showDropAfter = dropIndicatorIndex === idx + 1;
      const showCaretAfter = isSelected && block.type !== 'PLACEHOLDER' && !showDropAfter;

      let iterationProgress: { current: number; total: number } | null = null;
      if (block.type === 'LOOP_START') {
        const activeLoop = runtime?.loopStack?.find(
          (f) => f.scope === activeScope && f.loopStartPc === idx
        );
        if (activeLoop) {
          iterationProgress = {
            current: activeLoop.currentIteration,
            total: activeLoop.totalIterations,
          };
        }
      } else if (
        runtime?.activeRepeatProgress &&
        runtime.activeRepeatProgress.blockId === block.id
      ) {
        iterationProgress = {
          current: runtime.activeRepeatProgress.current,
          total: runtime.activeRepeatProgress.total,
        };
      }

      return (
        <React.Fragment key={block.id}>
          {/* Visual insertion indicator before first block (only rendered when active!) */}
          {showDropBefore && (
            <div
              data-testid="drop-indicator-line"
              className="w-1.5 h-8 md:h-12 bg-yellow-400 rounded-full shadow-[0_0_10px_rgba(250,204,21,0.8)] animate-pulse flex-shrink-0"
            />
          )}

          <BlockItem
            block={block}
            index={idx}
            scope={activeScope}
            isActive={runtime?.activeBlockId === block.id}
            isSelected={isSelected}
            isLoopError={isLoopError}
            isDragging={draggingBlockId === block.id}
            iterationProgress={iterationProgress}
            loopMeta={loopAnalysis.blockMeta[idx]}
            onSelect={() => setSelectedBlockId(block.id)}
            onDragStartBlock={(_e, _index, blockId) => setDraggingBlockId(blockId)}
            onDragEndBlock={handleDragEnd}
            onDragOverSlot={handleSlotDragOver}
            onDropAtSlot={handleDropAtSlot}
            onClearDropIndicator={() => setDropIndicatorIndex(null)}
          />

          {/* Insertion caret or drop indicator after block - ONLY rendered when active, no phantom space! */}
          {showDropAfter ? (
            <div
              data-testid="drop-indicator-line"
              className="w-1.5 h-8 md:h-12 bg-yellow-400 rounded-full shadow-[0_0_10px_rgba(250,204,21,0.8)] animate-pulse flex-shrink-0"
            />
          ) : showCaretAfter ? (
            <div
              data-testid="selection-insertion-pip"
              className="w-1 h-6 md:h-9 bg-sky-400 rounded-full shadow-[0_0_8px_rgba(56,189,248,0.9)] animate-pulse flex-shrink-0"
              title="Insertion point"
            />
          ) : null}
        </React.Fragment>
      );
    });

  return (
    <div
      className="flex flex-col flex-1 h-full overflow-hidden bg-slate-950"
      onClick={handleCanvasClick}
      data-bg-canvas="true"
    >
      {/* Unclosed Loop Warning Banner */}
      {loopValidation.hasError && (
        <div
          data-testid="loop-error-banner"
          className="flex items-center gap-2 px-4 py-2 bg-red-950/80 border-b border-red-500 text-red-200 text-sm font-semibold animate-pulse"
        >
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <span>
            ⚠️ Loop not closed: Missing matching Loop Start or Loop End block
          </span>
        </div>
      )}

      {/* Program Code Sequence Canvas */}
      <div
        data-testid="workspace-sequence"
        data-bg-canvas="true"
        data-slot-capped={budget.isCapped ? 'true' : 'false'}
        data-slot-rejected={isSlotRejected ? 'true' : 'false'}
        data-loop-count={loopAnalysis.matchedSpans.length}
        data-max-loop-depth={loopAnalysis.maxDepth}
        role="region"
        aria-label={
          budget.isCapped && budget.counterMax !== null
            ? `Program workspace tray, ${budget.counterUsed} of ${budget.counterMax} block slots used`
            : 'Program workspace'
        }
        onClick={handleCanvasClick}
        onDragOver={handleSequenceDragOver}
        onDragLeave={handleSequenceDragLeave}
        onDrop={handleSequenceDropFallback}
        onDragEnd={handleDragEnd}
        className={`flex-1 p-3 overflow-y-auto overflow-x-hidden flex flex-wrap content-start items-center ${sequenceGapClass} min-h-[160px] transition-colors ${
          isSlotRejected
            ? 'animate-slot-tray-shake bg-amber-950/20 ring-2 ring-inset ring-amber-400/70'
            : ''
        }`}
      >
        {budget.isCapped ? (
          <>
            {renderPlacedBlocks()}
            {Array.from({ length: budget.remainingForScope ?? 0 }).map((_, slotIdx) => {
              const slotNumber = blocks.length + slotIdx + 1;
              const totalSlots =
                budget.effectiveScopeSlots ?? blocks.length + (budget.remainingForScope ?? 0);
              const isNextDropTarget =
                slotIdx === 0 &&
                (dropIndicatorIndex === blocks.length ||
                  (blocks.length === 0 && dropIndicatorIndex === 0));
              return (
                <div
                  key={`empty-slot-${slotIdx}`}
                  data-testid="workspace-empty-slot"
                  data-slot-index={blocks.length + slotIdx}
                  aria-label={`Empty block slot ${slotNumber} of ${totalSlots}`}
                  onDragOver={(e) => handleSlotDragOver(e, blocks.length)}
                  onDrop={(e) => handleDropAtSlot(e, blocks.length)}
                  className={`w-[40px] h-[40px] md:w-[56px] md:h-[56px] rounded-xl md:rounded-2xl border-2 border-dashed flex items-center justify-center flex-shrink-0 select-none transition-colors ${
                    isNextDropTarget
                      ? 'border-yellow-400 bg-yellow-950/30 text-yellow-300 scale-105'
                      : 'border-slate-700/90 bg-slate-900/40 text-slate-600'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-sm ${
                      isNextDropTarget ? 'bg-yellow-400/80' : 'bg-slate-700/70'
                    }`}
                  />
                </div>
              );
            })}
          </>
        ) : blocks.length === 0 ? (
          <div
            onDragOver={(e) => handleSlotDragOver(e, 0)}
            onDrop={(e) => handleDropAtSlot(e, 0)}
            className={`flex items-center justify-center w-full h-48 border-2 border-dashed rounded-3xl transition-colors ${
              dropIndicatorIndex === 0
                ? 'border-yellow-400 bg-yellow-950/20 text-yellow-300'
                : 'border-slate-800 text-slate-600'
            }`}
          >
            <span className="text-4xl opacity-40">➕</span>
          </div>
        ) : (
          renderPlacedBlocks()
        )}
      </div>
    </div>
  );
};
