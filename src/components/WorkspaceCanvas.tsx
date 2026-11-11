import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { ScopeType } from '../types';
import { BlockItem } from './BlockItem';
import { Trash, Trash2, Sparkles, AlertTriangle, Undo2, Redo2 } from 'lucide-react';
import { validateLoopStructure } from '../engine/interpreter';
import {
  computeSlotBudget,
  computeStagedPalettePolicy,
  resolveActiveCurriculumActivity,
} from '../utils/curriculumStagePolicy';

const SLOT_SHAKE_DURATION_MS = 500;
const MAX_RENDERED_COUNTER_PIPS = 12;

interface ScopeTab {
  id: ScopeType;
  label: string;
  testId: string;
  icon: React.ReactNode;
  activeColor: string;
}

const SCOPE_TABS: ScopeTab[] = [
  {
    id: 'MAIN',
    label: 'Main',
    testId: 'tab-main',
    icon: <Sparkles className="w-5 h-5 text-yellow-300" />,
    activeColor: 'bg-indigo-600 border-indigo-400 text-white',
  },
  {
    id: 'F1',
    label: '1',
    testId: 'tab-f1',
    icon: <span className="font-black text-lg">1</span>,
    activeColor: 'bg-emerald-600 border-emerald-400 text-white',
  },
  {
    id: 'F2',
    label: '2',
    testId: 'tab-f2',
    icon: <span className="font-black text-lg">2</span>,
    activeColor: 'bg-blue-600 border-blue-400 text-white',
  },
  {
    id: 'F3',
    label: '3',
    testId: 'tab-f3',
    icon: <span className="font-black text-lg">3</span>,
    activeColor: 'bg-rose-600 border-rose-400 text-white',
  },
];

export const WorkspaceCanvas: React.FC = () => {
  useAppStore();
  const {
    appMode,
    activeActivityId,
    activeActivityVersion,
    slotCapRejectionCount,
    lastSlotCapRejectedAt,
    activeScope,
    setActiveScope,
    workspace,
    clearWorkspace,
    runtime,
    selectedBlockId,
    setSelectedBlockId,
    addBlock,
    reorderBlocks,
    removeBlock,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useAppStore.getState();

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
  const policy = computeStagedPalettePolicy(appMode, activeActivity, []);
  const budget = computeSlotBudget(workspace, activeScope, appMode, activeActivity?.slotCap);
  const visibleScopeTabs = SCOPE_TABS.filter((tab) => policy.allowedScopes.includes(tab.id));
  const isSlotRejected =
    budget.isCapped &&
    lastSlotCapRejectedAt !== null &&
    Date.now() - lastSlotCapRejectedAt < SLOT_SHAKE_DURATION_MS;

  const blocks = workspace[activeScope] || [];

  const handleDeleteSelected = () => {
    if (selectedBlockId) {
      removeBlock(activeScope, selectedBlockId);
    }
  };

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

  // Loop validation diagnostics
  const loopValidation = validateLoopStructure(blocks);
  const unclosedSet = new Set([
    ...loopValidation.unclosedLoopStartIds,
    ...loopValidation.orphanLoopEndIds,
  ]);

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

  const counterPipTotal =
    budget.isCapped && budget.counterMax !== null
      ? Math.min(budget.counterMax, MAX_RENDERED_COUNTER_PIPS)
      : 0;

  return (
    <div
      className="flex flex-col flex-1 h-full overflow-hidden bg-slate-950"
      onClick={handleCanvasClick}
      data-bg-canvas="true"
    >
      {/* Scope Navigation Tabs, Visual Slot Counter & Actions */}
      <div
        className={`${
          budget.isCapped ? 'flex' : 'hidden md:flex'
        } items-center justify-between gap-2 px-2.5 py-1.5 md:p-2 bg-slate-900 border-b border-slate-800`}
      >
        <div className="flex items-center gap-2">
          {policy.showScopeSelector && (
            <div className="hidden md:flex items-center gap-2" role="tablist" aria-label="Program scopes">
              {visibleScopeTabs.map((tab) => {
                const isSelected = activeScope === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    aria-label={tab.id === 'MAIN' ? 'Main scope' : `Function ${tab.label} scope`}
                    data-testid={tab.testId}
                    onClick={() => setActiveScope(tab.id)}
                    className={`flex items-center justify-center w-12 h-12 rounded-2xl border-2 transition-all ${
                      isSelected
                        ? `${tab.activeColor} shadow-lg scale-105`
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    {tab.icon}
                  </button>
                );
              })}
            </div>
          )}

          {/* Physical Block-Budget Visual Slot Counter (zero reading required) */}
          {budget.isCapped && budget.counterMax !== null && (
            <div
              data-testid="workspace-slot-counter"
              data-slot-full={budget.isFull ? 'true' : 'false'}
              data-slot-rejected={isSlotRejected ? 'true' : 'false'}
              role="group"
              aria-label={`Block slots: ${budget.counterUsed} of ${budget.counterMax} used${
                budget.isFull ? ', tray full' : ''
              }`}
              className={`flex items-center gap-2 px-2.5 py-1 md:px-3 md:py-1.5 rounded-xl border-2 transition-colors select-none ${
                isSlotRejected
                  ? 'animate-slot-tray-shake border-amber-400 bg-amber-500/20 text-amber-200 ring-2 ring-amber-400/50'
                  : budget.isFull
                  ? 'border-amber-500/70 bg-amber-950/40 text-amber-200'
                  : 'border-slate-700/90 bg-slate-950/70 text-slate-200'
              }`}
            >
              <div className="flex items-center gap-1" aria-hidden="true">
                {Array.from({ length: counterPipTotal }).map((_, pipIdx) => {
                  const isFilled = pipIdx < budget.counterUsed;
                  return (
                    <span
                      key={pipIdx}
                      data-slot-pip={isFilled ? 'filled' : 'empty'}
                      className={`w-2.5 h-2.5 md:w-3 md:h-3 rounded-[3px] transition-colors ${
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
                className="font-mono font-black text-xs md:text-sm tracking-tight"
              >
                {budget.counterUsed} / {budget.counterMax}
              </span>
            </div>
          )}
        </div>

        {/* Workspace Actions: Undo, Redo, Delete Selected & Clear All */}
        <div className="hidden md:flex items-center gap-2">
          {/* Workspace Undo Button */}
          <button
            type="button"
            data-testid="btn-workspace-undo"
            onClick={undo}
            disabled={!canUndo}
            className={`flex items-center justify-center w-12 h-12 rounded-2xl border-2 transition-all ${
              canUndo
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 shadow-md cursor-pointer active:scale-95'
                : 'bg-slate-900/60 text-slate-600 border-slate-800/80 cursor-not-allowed opacity-40'
            }`}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
          >
            <Undo2 className="w-5 h-5" />
          </button>

          {/* Workspace Redo Button */}
          <button
            type="button"
            data-testid="btn-workspace-redo"
            onClick={redo}
            disabled={!canRedo}
            className={`flex items-center justify-center w-12 h-12 rounded-2xl border-2 transition-all ${
              canRedo
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 shadow-md cursor-pointer active:scale-95'
                : 'bg-slate-900/60 text-slate-600 border-slate-800/80 cursor-not-allowed opacity-40'
            }`}
            title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
            aria-label="Redo"
          >
            <Redo2 className="w-5 h-5" />
          </button>

          {/* Delete Current Selected Element Only */}
          <button
            type="button"
            data-testid="btn-delete-selected"
            onClick={handleDeleteSelected}
            disabled={!selectedBlockId}
            className={`flex items-center justify-center w-12 h-12 rounded-2xl border-2 transition-all ${
              selectedBlockId
                ? 'bg-slate-800 hover:bg-rose-600 text-rose-400 hover:text-white border-slate-700 shadow-md cursor-pointer active:scale-95'
                : 'bg-slate-900/60 text-slate-600 border-slate-800/80 cursor-not-allowed opacity-40'
            }`}
            title={selectedBlockId ? 'Delete selected element' : 'Select an element to delete'}
            aria-label="Delete selected element"
          >
            <Trash className="w-5 h-5" />
          </button>

          {/* Clear Scope / Delete All Button */}
          <button
            type="button"
            data-testid="btn-clear-workspace"
            onClick={() => clearWorkspace(activeScope)}
            className="flex items-center justify-center w-12 h-12 bg-slate-800 hover:bg-red-600/80 text-slate-400 hover:text-white rounded-2xl border-2 border-slate-700 transition-colors active:scale-95"
            title="Delete all"
            aria-label="Delete all"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

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
        className={`flex-1 p-3 overflow-y-auto overflow-x-hidden flex flex-wrap content-start items-center gap-1.5 min-h-[160px] transition-colors ${
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
