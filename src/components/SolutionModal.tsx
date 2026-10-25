import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { LESSONS } from '../data/lessons';
import { CodeBlock, ScopeType } from '../types';
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
  BookOpen,
} from 'lucide-react';

export const SolutionModal: React.FC = () => {
  const {
    currentLevel,
    setLevel,
    isSolutionOpen,
    setSolutionOpen,
    loadSolution,
  } = useAppStore();

  const [copiedNotification, setCopiedNotification] = useState(false);

  if (!isSolutionOpen) return null;

  const currentLesson = LESSONS.find((l) => l.id === currentLevel) || LESSONS[0];

  const handleLoadSolution = () => {
    loadSolution(currentLesson.id);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2500);
  };

  const handlePrevLesson = () => {
    const prevId = currentLesson.id > 1 ? currentLesson.id - 1 : LESSONS.length;
    setLevel(prevId);
  };

  const handleNextLesson = () => {
    const nextId = currentLesson.id < LESSONS.length ? currentLesson.id + 1 : 1;
    setLevel(nextId);
  };

  const renderBlockMini = (block: CodeBlock, index: number) => {
    let bg = 'bg-sky-600 border-sky-400 text-white';
    let icon = <ArrowUp className="w-5 h-5 stroke-[2.5]" />;
    let label = '';

    switch (block.type) {
      case 'MOVE_FWD':
        bg = 'bg-sky-600 border-sky-400 text-white';
        icon = <ArrowUp className="w-5 h-5 stroke-[2.5]" />;
        break;
      case 'MOVE_BACK':
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
    }

    return (
      <div
        key={`${block.id || index}`}
        className={`relative flex items-center justify-center gap-1 min-w-[50px] h-12 px-2 rounded-xl border-2 shadow-sm font-black text-sm select-none ${bg}`}
      >
        {icon}
        {label && <span className="font-black text-base">{label}</span>}

        {block.repeatCount && block.repeatCount > 1 && (
          <span className="absolute -top-2 -right-2 flex items-center justify-center w-5 h-5 rounded-full bg-yellow-400 border border-yellow-200 text-slate-950 text-xs font-black shadow">
            {block.repeatCount}
          </span>
        )}
      </div>
    );
  };

  const renderScopeSolution = (scope: ScopeType, title: string, colorClass: string) => {
    const blocks = currentLesson.solution[scope];
    if (!blocks || blocks.length === 0) return null;

    return (
      <div className="flex flex-col gap-2 p-3 bg-slate-900/90 rounded-2xl border border-slate-800">
        <div className="flex items-center justify-between">
          <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black tracking-wide border ${colorClass}`}>
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

  return (
    <div
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
                  {currentLesson.moduleTitle}
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  Lesson {currentLesson.id} of {LESSONS.length}
                </span>
              </div>
              <h2 className="text-xl font-black text-white flex items-center gap-2 mt-0.5">
                {currentLesson.title}
              </h2>
            </div>
          </div>

          <button
            data-testid="btn-close-solution"
            onClick={() => setSolutionOpen(false)}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors"
            title="Close"
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
                Core Concept: {currentLesson.concept}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {currentLesson.description}
              </p>
              <div className="text-xs font-semibold text-amber-300/90 pt-1 flex items-center gap-1.5">
                <span>💡 Hint:</span>
                <span>{currentLesson.hint}</span>
              </div>
            </div>
          </div>

          {/* Solution Breakdown */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <span>Recommended Solution</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {currentLesson.instructionCount} instructions (&lt;15)
                </span>
              </h3>
            </div>

            <div className="space-y-2.5">
              {renderScopeSolution(
                'MAIN',
                '★ Main Program',
                'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
              )}
              {renderScopeSolution(
                'F1',
                '📞 Function 1',
                'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              )}
              {renderScopeSolution(
                'F2',
                '📞 Function 2',
                'bg-blue-500/20 text-blue-300 border-blue-500/40'
              )}
              {renderScopeSolution(
                'F3',
                '📞 Function 3',
                'bg-rose-500/20 text-rose-300 border-rose-500/40'
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <footer className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-950/90 border-t border-slate-800">
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrevLesson}
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              title="Previous Lesson"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-xs font-bold text-slate-400 px-1">
              {currentLesson.id} / {LESSONS.length}
            </span>
            <button
              onClick={handleNextLesson}
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              title="Next Lesson"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
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
