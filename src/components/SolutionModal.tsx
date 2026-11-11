import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { LESSONS } from '../data/lessons';
import {
  CURRICULUM_ACTIVITIES,
  getActivityAtVersion,
  getActivityLatest,
  getCurriculumModule,
} from '../data/curriculum';
import {
  getPlaceholderHintCategory,
  resolveActivityScaffoldWorkspace,
} from '../engine/placeholderHelpers';
import { CodeBlock, ScopeType, WorkspaceState } from '../types';
import {
  X,
  Lightbulb,
  ArrowUp,
  ArrowDown,
  CornerUpLeft,
  CornerUpRight,
  Repeat,
  Undo2,
  PhoneCall,
  Check,
  Play,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Sparkles,
  PenTool,
  Slash,
  Palette,
} from 'lucide-react';

export const SolutionModal: React.FC = () => {
  const subscribedStore = useAppStore();
  const {
    appMode,
    activeActivityId,
    activeActivityVersion,
    setCurriculumActivity,
    currentLevel,
    setLevel,
    isSolutionOpen,
    setSolutionOpen,
    loadSolution,
    triggerGhostPreview,
    loadPartialScaffold,
  } = typeof window === 'undefined' ? useAppStore.getState() : subscribedStore;

  const [copiedNotification, setCopiedNotification] = useState(false);
  const [isTier2Revealed, setIsTier2Revealed] = useState(false);

  useEffect(() => {
    setIsTier2Revealed(false);
    setCopiedNotification(false);
  }, [activeActivityId, isSolutionOpen]);

  useEffect(() => {
    if (!isSolutionOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setSolutionOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSolutionOpen, setSolutionOpen]);

  if (!isSolutionOpen) return null;

  const isCurriculum = appMode === 'curriculum';
  const currentLesson = LESSONS.find((l) => l.id === currentLevel) || LESSONS[0];
  const currentActivity =
    getActivityAtVersion(activeActivityId, activeActivityVersion) ??
    getActivityLatest(activeActivityId) ??
    CURRICULUM_ACTIVITIES[0];
  const currentModule = currentActivity
    ? getCurriculumModule(currentActivity.moduleId)
    : undefined;

  const solutionWorkspace = isCurriculum
    ? currentActivity?.referenceSolution
    : currentLesson.solution;

  const totalInstructions = solutionWorkspace
    ? (['MAIN', 'F1', 'F2', 'F3'] as ScopeType[]).reduce(
        (acc, sc) => acc + (solutionWorkspace[sc]?.length || 0),
        0
      )
    : 0;

  const isGhostHelp =
    isCurriculum &&
    currentActivity?.partialHelp?.mode === 'ghost' &&
    Boolean(currentActivity?.partialHelp?.ghostPreview);

  const scaffoldWorkspace =
    isCurriculum && !isGhostHelp
      ? resolveActivityScaffoldWorkspace(currentActivity)
      : null;

  const handleLoadSolution = () => {
    if (isCurriculum) {
      loadSolution();
    } else {
      loadSolution(currentLesson.id);
    }
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2500);
  };

  const handlePrevLesson = () => {
    if (isCurriculum) {
      if (CURRICULUM_ACTIVITIES.length === 0) return;
      const idx = CURRICULUM_ACTIVITIES.findIndex((a) => a.id === activeActivityId);
      const prevIdx = idx > 0 ? idx - 1 : CURRICULUM_ACTIVITIES.length - 1;
      setCurriculumActivity(CURRICULUM_ACTIVITIES[prevIdx].id);
      return;
    }
    const prevId = currentLesson.id > 1 ? currentLesson.id - 1 : LESSONS.length;
    setLevel(prevId);
  };

  const handleNextLesson = () => {
    if (isCurriculum) {
      if (CURRICULUM_ACTIVITIES.length === 0) return;
      const idx = CURRICULUM_ACTIVITIES.findIndex((a) => a.id === activeActivityId);
      const nextIdx = idx >= 0 && idx < CURRICULUM_ACTIVITIES.length - 1 ? idx + 1 : 0;
      setCurriculumActivity(CURRICULUM_ACTIVITIES[nextIdx].id);
      return;
    }
    const nextId = currentLesson.id < LESSONS.length ? currentLesson.id + 1 : 1;
    setLevel(nextId);
  };

  const renderBlockMini = (block: CodeBlock, index: number) => {
    if (block.type === 'PLACEHOLDER') {
      const hintCategory = getPlaceholderHintCategory(block);
      const borderTint =
        hintCategory === 'motion'
          ? 'border-sky-400'
          : hintCategory === 'turn'
          ? 'border-amber-400'
          : hintCategory === 'loop'
          ? 'border-purple-400'
          : hintCategory === 'function'
          ? 'border-emerald-400'
          : hintCategory === 'item'
          ? 'border-teal-400'
          : 'border-cyan-400';

      return (
        <div
          key={`${block.id || index}`}
          data-testid="solution-mini-placeholder"
          data-placeholder-hint={hintCategory}
          className={`relative flex items-center justify-center min-w-[50px] h-12 px-2 rounded-xl border-2 border-dashed bg-slate-900/90 text-amber-300 shadow-sm font-black text-lg select-none ${borderTint}`}
        >
          <span>?</span>
          {hintCategory === 'motion' && (
            <ArrowUp className="w-3 h-3 absolute bottom-1 right-1 text-cyan-300 stroke-[3]" />
          )}
          {hintCategory === 'turn' && (
            <CornerUpRight className="w-3 h-3 absolute bottom-1 right-1 text-cyan-300 stroke-[3]" />
          )}
          {hintCategory === 'loop' && (
            <Repeat className="w-3 h-3 absolute bottom-1 right-1 text-cyan-300 stroke-[3]" />
          )}
          {hintCategory === 'function' && (
            <PhoneCall className="w-3 h-3 absolute bottom-1 right-1 text-cyan-300 stroke-[3]" />
          )}
          {hintCategory === 'item' && (
            <Sparkles className="w-3 h-3 absolute bottom-1 right-1 text-cyan-300 stroke-[2.5]" />
          )}
        </div>
      );
    }

    let bg = 'bg-sky-600 border-sky-400 text-white';
    let icon: React.ReactNode = <ArrowUp className="w-5 h-5 stroke-[2.5]" />;
    let label = '';

    switch (block.type) {
      case 'MOVE_FWD':
      case 'FORWARD':
        bg = 'bg-sky-600 border-sky-400 text-white';
        icon = <ArrowUp className="w-5 h-5 stroke-[2.5]" />;
        break;
      case 'MOVE_BACK':
      case 'BACKWARD':
        bg = 'bg-sky-700 border-sky-500 text-white';
        icon = <ArrowDown className="w-5 h-5 stroke-[2.5]" />;
        break;
      case 'TURN_LEFT':
        bg = 'bg-amber-600 border-amber-400 text-white';
        icon = <CornerUpLeft className="w-5 h-5 stroke-[2.5]" />;
        break;
      case 'TURN_RIGHT':
        bg = 'bg-amber-600 border-amber-400 text-white';
        icon = <CornerUpRight className="w-5 h-5 stroke-[2.5]" />;
        break;
      case 'PEN_UP':
        bg = 'bg-teal-700 border-teal-400 text-teal-100';
        icon = (
          <div className="relative flex items-center justify-center">
            <PenTool className="w-4 h-4" />
            <Slash className="w-5 h-5 text-red-300 absolute" />
          </div>
        );
        break;
      case 'PEN_DOWN':
        bg = 'bg-teal-600 border-teal-300 text-teal-100';
        icon = <PenTool className="w-4 h-4" />;
        break;
      case 'SET_PEN_COLOR':
        bg = 'bg-slate-800 border-slate-500 text-pink-300';
        icon = <Palette className="w-4 h-4" />;
        break;
      case 'LOOP_START':
        bg = 'bg-purple-700 border-purple-400 text-white';
        icon = <Repeat className="w-5 h-5 stroke-[2.5]" />;
        break;
      case 'LOOP_END':
        bg = 'bg-purple-900 border-purple-500 text-purple-200';
        icon = <Undo2 className="w-5 h-5 stroke-[2.5]" />;
        break;
      case 'CALL_F1':
        bg = 'bg-emerald-600 border-emerald-400 text-white';
        icon = <PhoneCall className="w-4 h-4 stroke-[2.5]" />;
        label = '1';
        break;
      case 'CALL_F2':
        bg = 'bg-blue-600 border-blue-400 text-white';
        icon = <PhoneCall className="w-4 h-4 stroke-[2.5]" />;
        label = '2';
        break;
      case 'CALL_F3':
        bg = 'bg-rose-600 border-rose-400 text-white';
        icon = <PhoneCall className="w-4 h-4 stroke-[2.5]" />;
        label = '3';
        break;
      case 'VAR_ASSIGN':
        bg = 'bg-violet-700 border-violet-400 text-white';
        icon = (
          <span className="font-mono text-xs font-bold">
            {block.params?.a ?? 'a'}={block.params?.b ?? 1}
          </span>
        );
        break;
      case 'VAR_OP':
        bg = 'bg-indigo-700 border-indigo-400 text-white';
        icon = (
          <span className="font-mono text-[11px] font-bold">
            {block.params?.a ?? 'a'}={block.params?.b ?? 'a'}
            {block.params?.op ?? '+'}
            {block.params?.c ?? 1}
          </span>
        );
        break;
      default:
        bg = 'bg-slate-700 border-slate-500 text-white';
        icon = <span className="text-xs font-bold">{block.type}</span>;
        break;
    }

    return (
      <div
        key={`${block.id || index}`}
        className={`relative flex items-center justify-center gap-1 min-w-[50px] h-12 px-2 rounded-xl border-2 shadow-sm font-black text-sm select-none ${bg}`}
      >
        {icon}
        {label && <span className="font-black text-base">{label}</span>}

        {block.repeatCount !== undefined &&
          (typeof block.repeatCount === 'string' || block.repeatCount > 1) && (
            <span className="absolute -top-2 -right-2 flex items-center justify-center w-5 h-5 rounded-full bg-yellow-400 border border-yellow-200 text-slate-950 text-xs font-black shadow">
              {typeof block.repeatCount === 'string' ? (
                <span className="italic font-mono">{block.repeatCount}</span>
              ) : (
                block.repeatCount
              )}
            </span>
          )}
      </div>
    );
  };

  const renderScopeBlocks = (
    targetWorkspace: WorkspaceState | undefined | null,
    scope: ScopeType,
    title: string,
    colorClass: string
  ) => {
    const blocks = targetWorkspace?.[scope];
    if (!blocks || blocks.length === 0) return null;

    return (
      <div className="flex flex-col gap-2 p-3 bg-slate-900/90 rounded-2xl border border-slate-800">
        <div className="flex items-center justify-between">
          <span
            className={`px-2.5 py-0.5 rounded-lg text-xs font-black tracking-wide border ${colorClass}`}
          >
            {title}
          </span>
          <span className="text-xs text-slate-400 font-semibold">
            {blocks.length} {blocks.length === 1 ? 'block' : 'blocks'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {blocks.map((block, idx) => renderBlockMini(block, idx))}
        </div>
      </div>
    );
  };

  const activityIndex = CURRICULUM_ACTIVITIES.findIndex((a) => a.id === activeActivityId);
  const ghostMaxSteps = currentActivity?.partialHelp?.ghostPreview?.maxSteps ?? 2;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isCurriculum ? 'Activity Help and Solutions' : 'Lesson Solution'}
      data-testid="solution-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={() => setSolutionOpen(false)}
    >
      <div
        className="flex flex-col max-w-2xl w-full max-h-[90vh] bg-slate-900 border-2 border-amber-500/50 rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between p-4 sm:p-5 bg-gradient-to-r from-amber-500/20 via-slate-800 to-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-amber-500 text-slate-950 shadow-md">
              <Lightbulb className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/30">
                  {isCurriculum
                    ? currentModule?.title || `Module ${currentActivity?.moduleId ?? 1}`
                    : currentLesson.moduleTitle}
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  {isCurriculum
                    ? `Activity ${currentActivity?.id} (${activityIndex + 1} of ${
                        CURRICULUM_ACTIVITIES.length
                      })`
                    : `Lesson ${currentLesson.id} of ${LESSONS.length}`}
                </span>
              </div>
              <h2 className="text-xl font-black text-white flex items-center gap-2 mt-0.5">
                {isCurriculum ? currentActivity?.title : currentLesson.title}
              </h2>
            </div>
          </div>

          <button
            data-testid="btn-close-solution"
            onClick={() => setSolutionOpen(false)}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors"
            title="Close"
            aria-label="Close solution modal"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Concept Banner */}
          <div className="p-3.5 bg-slate-950/60 rounded-2xl border border-slate-800 flex items-start gap-3">
            <BookOpen className="w-5 h-5 text-sky-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <div className="text-sm font-black text-sky-300">
                Core Concept: {isCurriculum ? currentActivity?.concept : currentLesson.concept}
              </div>
              {(isCurriculum ? currentActivity?.description : currentLesson.description) && (
                <p className="text-xs text-slate-300 leading-relaxed">
                  {isCurriculum ? currentActivity?.description : currentLesson.description}
                </p>
              )}
              {(isCurriculum ? currentActivity?.hint : currentLesson.hint) && (
                <div className="text-xs font-semibold text-amber-300/90 pt-1 flex items-center gap-1.5">
                  <span>💡 Hint:</span>
                  <span>{isCurriculum ? currentActivity?.hint : currentLesson.hint}</span>
                </div>
              )}
            </div>
          </div>

          {isCurriculum ? (
            <>
              {/* TIER 1: Non-Spoiling Partial Help Card */}
              {isGhostHelp && (
                <section
                  data-testid="tier1-ghost-card"
                  className="p-4 sm:p-5 rounded-2xl border-2 border-cyan-400/50 bg-gradient-to-br from-cyan-950/60 via-slate-900 to-slate-950 shadow-lg space-y-3.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-400/40">
                        Tier 1 • Non-Spoiling Hint
                      </span>
                      <span className="text-xs font-bold text-cyan-200/80">
                        Keeps your blocks untouched
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                        <span className="text-xl" aria-hidden="true">
                          👻
                        </span>
                        <span>Ghost-Step Preview</span>
                      </h3>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Watch a translucent ghost robot animate the first{' '}
                        {ghostMaxSteps === 1 ? 'step' : `${ghostMaxSteps} steps`} right on the
                        map without changing your program.
                      </p>
                      {/* Visual Trail Illustration */}
                      <div className="flex items-center gap-2 pt-1">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-cyan-500/20 border border-dashed border-cyan-300 text-sm">
                          🤖
                        </span>
                        {Array.from({ length: Math.min(3, Math.max(1, ghostMaxSteps)) }).map(
                          (_, idx) => (
                            <React.Fragment key={idx}>
                              <span className="w-5 border-t-2 border-dashed border-cyan-400/80" />
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-cyan-950 border border-dashed border-cyan-300 text-[11px] font-black text-cyan-200">
                                {idx + 1}
                              </span>
                            </React.Fragment>
                          )
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      data-testid="btn-trigger-ghost-preview"
                      onClick={() => triggerGhostPreview()}
                      className="flex-shrink-0 flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-sm border-2 border-cyan-200 shadow-lg shadow-cyan-500/20 transition-all active:scale-95 cursor-pointer"
                    >
                      <span className="text-base" aria-hidden="true">
                        👻
                      </span>
                      <span>Watch Ghost Preview</span>
                    </button>
                  </div>
                </section>
              )}

              {!isGhostHelp && scaffoldWorkspace && (
                <section
                  data-testid="tier1-scaffold-card"
                  className="p-4 sm:p-5 rounded-2xl border-2 border-cyan-400/50 bg-gradient-to-br from-cyan-950/60 via-slate-900 to-slate-950 shadow-lg space-y-3.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-400/40">
                      Tier 1 • Guided Starter
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-amber-300 border border-amber-400/30">
                      <Undo2 className="w-3 h-3" />
                      <span>1-tap Undo restores your blocks</span>
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                      <span className="text-xl" aria-hidden="true">
                        🧩
                      </span>
                      <span>Starter ? Scaffold</span>
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Load a partial starter structure and fill in the dashed{' '}
                      <span className="font-black text-amber-300">?</span> blocks yourself!
                    </p>
                  </div>

                  <div className="space-y-2">
                    {renderScopeBlocks(
                      scaffoldWorkspace,
                      'MAIN',
                      '★ Starter Main',
                      'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                    )}
                    {renderScopeBlocks(
                      scaffoldWorkspace,
                      'F1',
                      '📞 Starter Function 1',
                      'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    )}
                    {renderScopeBlocks(
                      scaffoldWorkspace,
                      'F2',
                      '📞 Starter Function 2',
                      'bg-blue-500/20 text-blue-300 border-blue-500/40'
                    )}
                    {renderScopeBlocks(
                      scaffoldWorkspace,
                      'F3',
                      '📞 Starter Function 3',
                      'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    )}
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      data-testid="btn-load-scaffold"
                      onClick={() => loadPartialScaffold()}
                      className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-sm border-2 border-cyan-200 shadow-lg shadow-cyan-500/20 transition-all active:scale-95 cursor-pointer"
                    >
                      <span aria-hidden="true">🧩</span>
                      <span>Load ? Starter Scaffold</span>
                    </button>
                  </div>
                </section>
              )}

              {/* TIER 2: Secondary Expandable Full Reference Solution */}
              {solutionWorkspace && (
                <section
                  data-testid="tier2-full-solution-section"
                  className="rounded-2xl border border-slate-800 bg-slate-950/70 overflow-hidden"
                >
                  <button
                    type="button"
                    data-testid="btn-reveal-full-solution"
                    aria-expanded={isTier2Revealed}
                    onClick={() => setIsTier2Revealed((prev) => !prev)}
                    className="w-full flex items-center justify-between gap-3 p-4 hover:bg-slate-900/80 transition-colors text-left cursor-pointer"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        Tier 2 • Full Solution
                      </span>
                      <span className="text-sm font-bold text-slate-200">
                        {isTier2Revealed
                          ? 'Hide Full Reference Solution'
                          : 'Still stuck? Reveal Full Reference Solution'}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        {totalInstructions} blocks
                      </span>
                    </div>
                    {isTier2Revealed ? (
                      <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
                    )}
                  </button>

                  {isTier2Revealed && (
                    <div className="p-4 pt-1 border-t border-slate-800/80 space-y-3.5">
                      <div className="space-y-2.5 pt-2">
                        {renderScopeBlocks(
                          solutionWorkspace,
                          'MAIN',
                          '★ Main Program',
                          'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                        )}
                        {renderScopeBlocks(
                          solutionWorkspace,
                          'F1',
                          '📞 Function 1',
                          'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        )}
                        {renderScopeBlocks(
                          solutionWorkspace,
                          'F2',
                          '📞 Function 2',
                          'bg-blue-500/20 text-blue-300 border-blue-500/40'
                        )}
                        {renderScopeBlocks(
                          solutionWorkspace,
                          'F3',
                          '📞 Function 3',
                          'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <div
                          data-testid="solution-undo-reminder"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-300"
                        >
                          <Undo2 className="w-3.5 h-3.5 text-amber-400" />
                          <span>Safe to try — 1-tap Undo restores your previous work</span>
                        </div>

                        <button
                          type="button"
                          data-testid="btn-load-solution"
                          onClick={handleLoadSolution}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-sm border shadow-lg transition-all active:scale-95 cursor-pointer ${
                            copiedNotification
                              ? 'bg-emerald-600 border-emerald-400 text-white'
                              : 'bg-amber-500 hover:bg-amber-400 border-amber-300 text-slate-950'
                          }`}
                        >
                          {copiedNotification ? (
                            <>
                              <Check className="w-4 h-4 stroke-[3]" />
                              <span>Loaded into Workspace!</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4 fill-slate-950" />
                              <span>Load Full Solution</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              )}
            </>
          ) : (
            /* Sandbox Mode: Original Solution Breakdown */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <span>Recommended Solution</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {`${currentLesson.instructionCount} instructions (<15)`}
                  </span>
                </h3>
              </div>

              <div className="space-y-2.5">
                {renderScopeBlocks(
                  solutionWorkspace,
                  'MAIN',
                  '★ Main Program',
                  'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                )}
                {renderScopeBlocks(
                  solutionWorkspace,
                  'F1',
                  '📞 Function 1',
                  'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                )}
                {renderScopeBlocks(
                  solutionWorkspace,
                  'F2',
                  '📞 Function 2',
                  'bg-blue-500/20 text-blue-300 border-blue-500/40'
                )}
                {renderScopeBlocks(
                  solutionWorkspace,
                  'F3',
                  '📞 Function 3',
                  'bg-rose-500/20 text-rose-300 border-rose-500/40'
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <footer className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-950/90 border-t border-slate-800">
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrevLesson}
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              title="Previous Lesson"
              aria-label="Previous Lesson"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-xs font-bold text-slate-400 px-1">
              {isCurriculum
                ? `${currentActivity?.id} (${activityIndex + 1}/${CURRICULUM_ACTIVITIES.length})`
                : `${currentLesson.id} / ${LESSONS.length}`}
            </span>
            <button
              onClick={handleNextLesson}
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              title="Next Lesson"
              aria-label="Next Lesson"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {!isCurriculum && (
              <button
                data-testid="btn-load-solution"
                onClick={handleLoadSolution}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-sm border shadow-lg transition-all active:scale-95 ${
                  copiedNotification
                    ? 'bg-emerald-600 border-emerald-400 text-white'
                    : 'bg-amber-500 hover:bg-amber-400 border-amber-300 text-slate-950'
                }`}
              >
                {copiedNotification ? (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Loaded into Workspace!</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-slate-950" />
                    <span>Load into Workspace</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={() => setSolutionOpen(false)}
              className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm border border-slate-700 transition-colors"
            >
              Close
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
