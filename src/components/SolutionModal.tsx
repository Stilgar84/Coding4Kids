import React, { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { LESSONS } from '../data/lessons';
import {
  CURRICULUM_ACTIVITIES,
  CurriculumActivity,
  getActivityAtVersion,
  getActivityLatest,
  isValidatedPuzzleActivity,
} from '../data/curriculum';
import {
  getPlaceholderHintCategory,
  resolveActivityScaffoldWorkspace,
} from '../engine/placeholderHelpers';
import {
  ActivityConstraintReport,
  verifyActivityConstraints,
} from '../engine/verification/constraintSolver';
import { CodeBlock, ScopeType, WorkspaceState } from '../types';
import {
  X,
  Lightbulb,
  ArrowUp,
  ArrowDown,
  CornerUpLeft,
  CornerUpRight,
  CornerDownLeft,
  Repeat,
  Undo2,
  PhoneCall,
  Check,
  Play,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Sparkles,
  PenTool,
  Slash,
  Palette,
  AlertTriangle,
  RotateCcw,
  RotateCw,
  Bell,
  Music,
  Grid,
  Hourglass,
  Eraser,
  Hand,
  Package,
} from 'lucide-react';

/**
 * Checks whether `?dev=1` is present in `window.location.search` (or an explicit search override).
 */
export function isDevProofInspectorEnabled(searchOverride?: string): boolean {
  const rawSearch =
    searchOverride !== undefined
      ? searchOverride
      : typeof window !== 'undefined' && window.location?.search
      ? window.location.search
      : '';
  if (!rawSearch) return false;
  const normalized = rawSearch.startsWith('?') ? rawSearch : `?${rawSearch}`;
  const params = new URLSearchParams(normalized);
  return params.get('dev') === '1';
}

/**
 * Keyboard accessibility helper for the collapsible Constraint Proofs disclosure button.
 */
export function shouldToggleDisclosureOnKey(key: string): boolean {
  return key === 'Enter' || key === ' ';
}

export interface SolutionModalProps {
  /** Optional override for initial expanded state of the `?dev=1` Constraint Proofs disclosure */
  defaultDevProofsExpanded?: boolean;
  /** Optional activity override for inspecting/testing synthetic puzzle fixtures */
  activityOverride?: CurriculumActivity;
}

export const SolutionModal: React.FC<SolutionModalProps> = ({
  defaultDevProofsExpanded = true,
  activityOverride,
}) => {
  useAppStore();
  const {
    appMode,
    activeActivityId,
    activeActivityVersion,
    currentLevel,
    isSolutionOpen,
    setSolutionOpen,
    loadSolution,
    triggerGhostPreview,
    loadPartialScaffold,
  } = useAppStore.getState();

  const [isTier2Revealed, setIsTier2Revealed] = useState(false);
  const [isTeacherTipOpen, setIsTeacherTipOpen] = useState(false);
  const [isDevProofsOpen, setIsDevProofsOpen] = useState(defaultDevProofsExpanded);

  const isCurriculum = appMode === 'curriculum';
  const resolvedActivity =
    activityOverride ??
    getActivityAtVersion(activeActivityId, activeActivityVersion) ??
    getActivityLatest(activeActivityId) ??
    CURRICULUM_ACTIVITIES[0];

  const devProofEnabled = isDevProofInspectorEnabled();
  const showDevProofs =
    isSolutionOpen &&
    isCurriculum &&
    devProofEnabled &&
    Boolean(resolvedActivity && isValidatedPuzzleActivity(resolvedActivity));

  const constraintReport: ActivityConstraintReport | null = useMemo(() => {
    if (!showDevProofs || !resolvedActivity) return null;
    return verifyActivityConstraints(resolvedActivity);
  }, [showDevProofs, resolvedActivity]);

  useEffect(() => {
    setIsTier2Revealed(false);
    setIsTeacherTipOpen(false);
  }, [activeActivityId, isSolutionOpen]);

  useEffect(() => {
    setIsDevProofsOpen(defaultDevProofsExpanded);
  }, [defaultDevProofsExpanded, isSolutionOpen]);

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

  const currentLesson = LESSONS.find((l) => l.id === currentLevel) || LESSONS[0];
  const currentActivity = resolvedActivity;

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
    setSolutionOpen(false);
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
          className={`relative flex items-center justify-center min-w-[46px] h-11 px-2 rounded-xl border-2 border-dashed bg-slate-900/90 text-amber-300 shadow-sm font-black text-lg select-none ${borderTint}`}
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
      case 'CURSOR_STEP':
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
      case 'CURSOR_TURN':
        bg = 'bg-amber-600 border-amber-400 text-white';
        icon = <CornerUpRight className="w-5 h-5 stroke-[2.5]" />;
        break;
      case 'PICK_UP':
        bg = 'bg-teal-600 border-teal-300 text-white';
        icon = <Hand className="w-5 h-5 stroke-[2.4]" />;
        break;
      case 'USE_DROP':
        bg = 'bg-amber-600 border-amber-300 text-white';
        icon = <Package className="w-5 h-5 stroke-[2.4]" />;
        break;
      case 'ARC_LEFT':
        bg = 'bg-cyan-600 border-cyan-400 text-white';
        icon = <RotateCcw className="w-5 h-5 stroke-[2.5]" />;
        break;
      case 'ARC_RIGHT':
        bg = 'bg-cyan-600 border-cyan-400 text-white';
        icon = <RotateCw className="w-5 h-5 stroke-[2.5]" />;
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
      case 'SET_LED_COLOR':
        bg = 'bg-slate-800 border-slate-500 text-pink-300';
        icon = <Palette className="w-4 h-4" />;
        break;
      case 'SET_PEN_WIDTH':
        bg = 'bg-slate-800 border-slate-500 text-white';
        icon = <div className="w-5 h-1.5 rounded-full bg-white" />;
        break;
      case 'DRUM_KICK':
        bg = 'bg-rose-600 border-rose-400 text-white';
        icon = <span className="text-base leading-none">🥁</span>;
        break;
      case 'DRUM_SNARE':
        bg = 'bg-orange-600 border-orange-400 text-white';
        icon = <span className="text-base leading-none">🪘</span>;
        break;
      case 'DRUM_CLAP':
        bg = 'bg-fuchsia-600 border-fuchsia-400 text-white';
        icon = <Sparkles className="w-4 h-4" />;
        break;
      case 'PLAY_CHIME':
        bg = 'bg-amber-500 border-amber-300 text-slate-950';
        icon = <Bell className="w-4 h-4 stroke-[2.5]" />;
        break;
      case 'PLAY_NOTE':
        bg = 'bg-violet-600 border-violet-400 text-white';
        icon = <Music className="w-4 h-4 stroke-[2.5]" />;
        break;
      case 'STAMP_HEART':
        bg = 'bg-rose-500 border-rose-300 text-white';
        icon = <span className="text-base leading-none">❤️</span>;
        break;
      case 'STAMP_STAR':
        bg = 'bg-amber-500 border-amber-200 text-slate-950';
        icon = <span className="text-base leading-none">⭐</span>;
        break;
      case 'STAMP_SMILE':
        bg = 'bg-cyan-600 border-cyan-300 text-white';
        icon = <span className="text-base leading-none">😊</span>;
        break;
      case 'STAMP_PRESET':
        bg = 'bg-cyan-700 border-cyan-400 text-white';
        icon = <Grid className="w-4 h-4" />;
        break;
      case 'WAIT_BEAT':
        bg = 'bg-sky-700 border-sky-400 text-white';
        icon = <Hourglass className="w-4 h-4" />;
        break;
      case 'CLEAR_LEDS':
        bg = 'bg-slate-700 border-slate-500 text-slate-200';
        icon = <Eraser className="w-4 h-4" />;
        break;
      case 'LOOP_START':
        bg = 'bg-purple-700 border-purple-400 text-white';
        icon = <Repeat className="w-5 h-5 stroke-[2.5]" />;
        break;
      case 'LOOP_END':
        bg = 'bg-purple-900 border-purple-500 text-purple-200';
        icon = <CornerDownLeft className="w-5 h-5 stroke-[2.5]" />;
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
        icon = <Sparkles className="w-4 h-4" />;
        break;
    }

    return (
      <div
        key={`${block.id || index}`}
        className={`relative flex items-center justify-center gap-1 min-w-[46px] h-11 px-2 rounded-xl border-2 shadow-sm font-black text-sm select-none ${bg}`}
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
      <div className="flex flex-col gap-2 p-2.5 bg-slate-900/90 rounded-2xl border border-slate-800">
        <div className="flex items-center justify-between">
          <span
            className={`px-2 py-0.5 rounded-lg text-xs font-black tracking-wide border ${colorClass}`}
          >
            {title}
          </span>
          <span className="text-xs text-slate-400 font-semibold">{blocks.length}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          {blocks.map((block, idx) => renderBlockMini(block, idx))}
        </div>
      </div>
    );
  };

  const ghostMaxSteps = currentActivity?.partialHelp?.ghostPreview?.maxSteps ?? 2;
  const conceptText = isCurriculum ? currentActivity?.concept : currentLesson.concept;
  const descText = isCurriculum ? currentActivity?.description : currentLesson.description;
  const hintText = isCurriculum ? currentActivity?.hint : currentLesson.hint;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isCurriculum ? 'Activity Help and Solutions' : 'Lesson Solution'}
      data-testid="solution-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={() => setSolutionOpen(false)}
    >
      <div
        className="flex flex-col max-w-xl w-full max-h-[90vh] bg-slate-900 border-2 border-amber-500/50 rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact Kid-Friendly Header */}
        <header className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-amber-500/20 via-slate-800 to-slate-900 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 shadow-md shrink-0">
              <Lightbulb className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-white truncate flex items-center gap-1.5">
                {isCurriculum && currentActivity?.icon && (
                  <span aria-hidden="true">{currentActivity.icon}</span>
                )}
                <span className="truncate">
                  {isCurriculum ? currentActivity?.title : currentLesson.title}
                </span>
              </h2>
            </div>
          </div>

          <button
            type="button"
            data-testid="btn-close-solution"
            onClick={() => setSolutionOpen(false)}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors shrink-0"
            title="Close"
            aria-label="Close solution modal"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </header>

        {/* Scrollable Content: Visual Action Cards First (Above the Fold!) */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-3.5">
          {isCurriculum ? (
            <>
              {/* TIER 1A: Ghost-Step Visual Hint Card */}
              {isGhostHelp && (
                <section
                  data-testid="tier1-ghost-card"
                  className="p-4 rounded-2xl border-2 border-cyan-400/50 bg-gradient-to-br from-cyan-950/60 via-slate-900 to-slate-950 shadow-lg"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-cyan-500/20 border border-dashed border-cyan-300 text-xl shrink-0">
                        🤖
                      </span>
                      <div className="flex items-center gap-1.5">
                        {Array.from({ length: Math.min(3, Math.max(1, ghostMaxSteps)) }).map(
                          (_, idx) => (
                            <React.Fragment key={idx}>
                              <span className="w-4 border-t-2 border-dashed border-cyan-400/80" />
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-cyan-950 border border-dashed border-cyan-300 text-xs font-black text-cyan-200">
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
                      <span className="text-lg" aria-hidden="true">
                        👻
                      </span>
                      <span>Watch Hint</span>
                    </button>
                  </div>
                </section>
              )}

              {/* TIER 1B: Starter ? Scaffold Card (Action Button in Header so always Above the Fold!) */}
              {!isGhostHelp && scaffoldWorkspace && (
                <section
                  data-testid="tier1-scaffold-card"
                  className="p-3.5 sm:p-4 rounded-2xl border-2 border-cyan-400/50 bg-gradient-to-br from-cyan-950/60 via-slate-900 to-slate-950 shadow-lg space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl" aria-hidden="true">
                        🧩
                      </span>
                      <h3 className="text-sm sm:text-base font-black text-white">Starter ? Blocks</h3>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-amber-300 border border-amber-400/30">
                        <Undo2 className="w-3 h-3" />
                        <span>Undo OK</span>
                      </span>
                    </div>

                    <button
                      type="button"
                      data-testid="btn-load-scaffold"
                      onClick={() => loadPartialScaffold()}
                      className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs sm:text-sm border-2 border-cyan-200 shadow-md transition-all active:scale-95 cursor-pointer"
                    >
                      <span aria-hidden="true">🧩</span>
                      <span>Try Starter</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {renderScopeBlocks(
                      scaffoldWorkspace,
                      'MAIN',
                      '★ Main',
                      'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                    )}
                    {renderScopeBlocks(
                      scaffoldWorkspace,
                      'F1',
                      '📞 F1',
                      'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    )}
                    {renderScopeBlocks(
                      scaffoldWorkspace,
                      'F2',
                      '📞 F2',
                      'bg-blue-500/20 text-blue-300 border-blue-500/40'
                    )}
                    {renderScopeBlocks(
                      scaffoldWorkspace,
                      'F3',
                      '📞 F3',
                      'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    )}
                  </div>
                </section>
              )}

              {/* TIER 2: Expandable Full Reference Solution */}
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
                    className="w-full flex items-center justify-between gap-3 p-3.5 hover:bg-slate-900/80 transition-colors text-left cursor-pointer"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base" aria-hidden="true">
                        👀
                      </span>
                      <span className="text-sm font-black text-slate-100">
                        {isTier2Revealed ? 'Hide Answer' : 'Show Answer'}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        {totalInstructions}
                      </span>
                    </div>
                    {isTier2Revealed ? (
                      <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
                    )}
                  </button>

                  {isTier2Revealed && (
                    <div className="p-3.5 pt-2 border-t border-slate-800/80 space-y-3">
                      <div className="space-y-2">
                        {renderScopeBlocks(
                          solutionWorkspace,
                          'MAIN',
                          '★ Main',
                          'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                        )}
                        {renderScopeBlocks(
                          solutionWorkspace,
                          'F1',
                          '📞 F1',
                          'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        )}
                        {renderScopeBlocks(
                          solutionWorkspace,
                          'F2',
                          '📞 F2',
                          'bg-blue-500/20 text-blue-300 border-blue-500/40'
                        )}
                        {renderScopeBlocks(
                          solutionWorkspace,
                          'F3',
                          '📞 F3',
                          'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
                        <div
                          data-testid="solution-undo-reminder"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-300"
                        >
                          <Undo2 className="w-3.5 h-3.5 text-amber-400" />
                          <span>Undo restores your blocks</span>
                        </div>

                        <button
                          type="button"
                          data-testid="btn-load-solution"
                          onClick={handleLoadSolution}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 border-2 border-amber-300 text-slate-950 font-black text-sm shadow-lg transition-all active:scale-95 cursor-pointer"
                        >
                          <Play className="w-4 h-4 fill-slate-950" />
                          <span>Use Answer</span>
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* DEV INSPECTOR (?dev=1): Live Anti-Bypass Constraint Proofs */}
              {showDevProofs && constraintReport && (
                <section
                  data-testid="dev-constraint-proofs-section"
                  className={`rounded-2xl border-2 overflow-hidden ${
                    constraintReport.passed
                      ? 'border-emerald-500/40 bg-slate-950/80'
                      : 'border-rose-500/60 border-dashed bg-rose-950/20'
                  }`}
                >
                  <button
                    type="button"
                    data-testid="btn-toggle-constraint-proofs"
                    aria-expanded={isDevProofsOpen}
                    aria-controls="dev-constraint-proofs-panel"
                    onClick={() => setIsDevProofsOpen((prev) => !prev)}
                    onKeyDown={(e) => {
                      if (shouldToggleDisclosureOnKey(e.key)) {
                        e.preventDefault();
                        setIsDevProofsOpen((prev) => !prev);
                      }
                    }}
                    className="w-full flex items-center justify-between gap-3 p-4 hover:bg-slate-900/80 transition-colors text-left cursor-pointer"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black text-white flex items-center gap-1.5">
                        <span aria-hidden="true">🛡️</span>
                        <span>Constraint Proofs</span>
                      </span>
                      {constraintReport.passed ? (
                        <span
                          data-testid="constraint-overall-badge"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/40"
                        >
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>Verified</span>
                        </span>
                      ) : (
                        <span
                          data-testid="constraint-overall-badge"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-dashed border-rose-400/60"
                        >
                          <AlertTriangle className="w-3 h-3 stroke-[2.5]" />
                          <span>Bypass Found</span>
                        </span>
                      )}
                      <span
                        data-testid="constraint-total-ms"
                        className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700"
                      >
                        {constraintReport.elapsedMs.toFixed(1)} ms
                      </span>
                    </div>

                    {isDevProofsOpen ? (
                      <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
                    )}
                  </button>

                  {isDevProofsOpen && (
                    <div
                      id="dev-constraint-proofs-panel"
                      data-testid="dev-constraint-proofs-panel"
                      className="p-4 pt-2 border-t border-slate-800/80 space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          data-testid="constraint-reference-badge"
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold border ${
                            constraintReport.referenceCheck.passed
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-300 border-dashed border-rose-400/50'
                          }`}
                        >
                          {constraintReport.referenceCheck.passed ? (
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          )}
                          <span>
                            Ref Solution: {constraintReport.referenceCheck.blockCount}
                            {constraintReport.slotCap !== undefined
                              ? `/${constraintReport.slotCap}`
                              : ''}{' '}
                            slots
                          </span>
                        </span>

                        {constraintReport.scaffoldCheck.applicable && (
                          <span
                            data-testid="constraint-scaffold-badge"
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold border ${
                              constraintReport.scaffoldCheck.passed
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-300 border-dashed border-rose-400/50'
                            }`}
                          >
                            {constraintReport.scaffoldCheck.passed ? (
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5" />
                            )}
                            <span>
                              ? Scaffold ({constraintReport.scaffoldCheck.placeholderCount} ?)
                            </span>
                          </span>
                        )}
                      </div>

                      {!constraintReport.referenceCheck.passed &&
                        constraintReport.referenceCheck.reason && (
                          <div className="p-2.5 rounded-xl bg-rose-950/60 border border-dashed border-rose-400/50 text-xs text-rose-200 font-semibold">
                            Reference Error: {constraintReport.referenceCheck.reason}
                          </div>
                        )}

                      <div className="space-y-2">
                        {constraintReport.ruleResults.map((ruleRes) => (
                          <div
                            key={ruleRes.ruleId}
                            data-testid={`constraint-rule-${ruleRes.ruleId}`}
                            data-rule-passed={String(ruleRes.passed)}
                            className={`p-3 rounded-xl border space-y-2 ${
                              ruleRes.passed
                                ? 'bg-slate-900/90 border-slate-800'
                                : 'bg-rose-950/40 border-dashed border-rose-500/60'
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                {ruleRes.passed ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                    <Check className="w-3 h-3 stroke-[3]" />
                                    <span>PASS</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black uppercase bg-rose-500/25 text-rose-200 border border-dashed border-rose-400/60">
                                    <AlertTriangle className="w-3 h-3 stroke-[2.5]" />
                                    <span>FAIL</span>
                                  </span>
                                )}
                                <span className="text-xs font-bold text-slate-200">
                                  {ruleRes.description}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                                {ruleRes.minWinningBlocks !== null && (
                                  <span className="px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-slate-300">
                                    min: {ruleRes.minWinningBlocks} blk
                                  </span>
                                )}
                                <span className="px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700">
                                  {ruleRes.elapsedMs.toFixed(1)} ms
                                </span>
                              </div>
                            </div>

                            {ruleRes.diagnostic && (
                              <div className="text-[11px] text-slate-400">
                                {ruleRes.diagnostic}
                              </div>
                            )}

                            {!ruleRes.passed && ruleRes.formattedCounterexample && (
                              <div
                                data-testid="constraint-counterexample"
                                className="p-2.5 rounded-lg bg-slate-950/90 border border-rose-500/40 space-y-2"
                              >
                                <div className="text-[11px] font-bold text-rose-300">
                                  Offending Bypass Counterexample:{' '}
                                  <code className="font-mono text-rose-100">
                                    {ruleRes.formattedCounterexample}
                                  </code>
                                </div>
                                {ruleRes.counterexampleWorkspace?.MAIN &&
                                  ruleRes.counterexampleWorkspace.MAIN.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      {ruleRes.counterexampleWorkspace.MAIN.map((blk, bIdx) =>
                                        renderBlockMini(blk, bIdx)
                                      )}
                                    </div>
                                  )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}
            </>
          ) : (
            /* Sandbox Mode: Recommended Solution Breakdown */
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <span>Recommended Solution</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {currentLesson.instructionCount}
                  </span>
                </h3>

                <button
                  type="button"
                  data-testid="btn-load-solution"
                  onClick={handleLoadSolution}
                  className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-500 hover:bg-amber-400 border-2 border-amber-300 text-slate-950 font-black text-sm shadow-lg transition-all active:scale-95 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>Load Solution</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {renderScopeBlocks(
                  solutionWorkspace,
                  'MAIN',
                  '★ Main',
                  'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                )}
                {renderScopeBlocks(
                  solutionWorkspace,
                  'F1',
                  '📞 F1',
                  'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                )}
                {renderScopeBlocks(
                  solutionWorkspace,
                  'F2',
                  '📞 F2',
                  'bg-blue-500/20 text-blue-300 border-blue-500/40'
                )}
                {renderScopeBlocks(
                  solutionWorkspace,
                  'F3',
                  '📞 F3',
                  'bg-rose-500/20 text-rose-300 border-rose-500/40'
                )}
              </div>
            </div>
          )}

          {/* Collapsible Parent / Teacher Tip (keeps adult prose off the primary kid view) */}
          {(conceptText || descText || hintText) && (
            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/50 overflow-hidden">
              <button
                type="button"
                data-testid="btn-toggle-teacher-tip"
                aria-expanded={isTeacherTipOpen}
                onClick={() => setIsTeacherTipOpen((prev) => !prev)}
                className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-sky-400" />
                  <span>Parent / Teacher Tip</span>
                </span>
                {isTeacherTipOpen ? (
                  <ChevronUp className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                )}
              </button>

              {isTeacherTipOpen && (
                <div className="px-3.5 pb-3 pt-1 border-t border-slate-800/70 space-y-1 text-xs">
                  {conceptText && (
                    <div className="font-bold text-sky-300">{conceptText}</div>
                  )}
                  {descText && (
                    <p className="text-slate-300 leading-relaxed">{descText}</p>
                  )}
                  {hintText && (
                    <div className="font-semibold text-amber-300/90 pt-0.5">
                      💡 {hintText}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
