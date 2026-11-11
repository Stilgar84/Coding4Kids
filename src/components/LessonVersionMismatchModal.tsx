import React, { useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getActivityAtVersion, getActivityLatest } from '../data/curriculum';
import { Sparkles, History, X, AlertCircle, ArrowRight } from 'lucide-react';

export const LessonVersionMismatchModal: React.FC = () => {
  useAppStore();
  const { pendingVersionMismatch, resolveVersionMismatch, dismissVersionMismatch } =
    useAppStore.getState();

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const latestBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!pendingVersionMismatch) return;
    const timer = setTimeout(() => {
      latestBtnRef.current?.focus();
    }, 0);
    return () => clearTimeout(timer);
  }, [pendingVersionMismatch]);

  useEffect(() => {
    if (!pendingVersionMismatch) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        dismissVersionMismatch();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement as HTMLElement | null;

        if (e.shiftKey) {
          if (!active || active === first || !dialogRef.current.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (!active || active === last || !dialogRef.current.contains(active)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingVersionMismatch, dismissVersionMismatch]);

  if (!pendingVersionMismatch) return null;

  const latestActivity = getActivityLatest(pendingVersionMismatch.lessonId);
  const originalActivity = getActivityAtVersion(
    pendingVersionMismatch.lessonId,
    pendingVersionMismatch.savedVersion
  );
  const canOpenOriginal = Boolean(
    pendingVersionMismatch.hasHistoricalVersion && originalActivity
  );

  const activityTitle = latestActivity
    ? `${latestActivity.id} ${latestActivity.title}`
    : pendingVersionMismatch.lessonId;
  const activityIcon = latestActivity?.icon || '🎓';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lesson-version-mismatch-title"
      aria-describedby="lesson-version-mismatch-desc"
      data-testid="lesson-version-mismatch-modal"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in"
      onClick={dismissVersionMismatch}
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-md bg-slate-900 border-2 border-amber-500/60 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — btn-mismatch-cancel MUST stay 1st in Tab order */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-400/50 text-2xl select-none"
              aria-hidden="true"
            >
              {activityIcon}
            </div>
            <div>
              <h2
                id="lesson-version-mismatch-title"
                className="text-base sm:text-lg font-black text-white leading-tight"
              >
                Newer Puzzle Map!
              </h2>
              <p className="text-xs text-slate-300 font-semibold truncate max-w-[260px]">
                {activityTitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="btn-mismatch-cancel"
            onClick={dismissVersionMismatch}
            aria-label="Cancel and close version mismatch dialog"
            className="flex items-center justify-center w-10 h-10 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-3.5">
          <div
            data-testid="mismatch-version-badges"
            className="flex items-center justify-between gap-2 px-4 py-2.5 rounded-2xl bg-slate-950 border border-slate-800"
          >
            <span className="inline-flex items-center gap-1.5 text-xs font-black text-amber-300">
              <span>🗺️ Old Map</span>
              {pendingVersionMismatch.slotIndex !== undefined && (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                  Slot {pendingVersionMismatch.slotIndex}
                </span>
              )}
            </span>
            <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
            <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-300">
              <span>✨ New Map</span>
            </span>
          </div>

          <p id="lesson-version-mismatch-desc" className="text-xs text-slate-300 leading-relaxed">
            Pick which map to open with your blocks:
          </p>

          {/* Choice 1: New Map (btn-mismatch-load-latest — 2nd in Tab order) */}
          <button
            ref={latestBtnRef}
            type="button"
            data-testid="btn-mismatch-load-latest"
            onClick={() => resolveVersionMismatch('latest')}
            className="group flex items-center gap-3.5 w-full p-3.5 text-left rounded-2xl bg-emerald-600/20 hover:bg-emerald-600/30 border-2 border-emerald-400/70 hover:border-emerald-300 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 active:scale-[0.99]"
          >
            <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-emerald-500 text-slate-950 shrink-0 shadow">
              <Sparkles className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-black text-sm text-white block">Play on New Map ✨</span>
              <span className="text-xs text-slate-300">Put your blocks on the newest puzzle</span>
            </div>
          </button>

          {/* Choice 2: Old Map (btn-mismatch-open-original — 3rd in Tab order) */}
          <button
            type="button"
            data-testid="btn-mismatch-open-original"
            disabled={!canOpenOriginal}
            onClick={() => {
              if (canOpenOriginal) {
                resolveVersionMismatch('original');
              }
            }}
            className={`group flex items-center gap-3.5 w-full p-3.5 text-left rounded-2xl border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${
              canOpenOriginal
                ? 'bg-indigo-600/20 hover:bg-indigo-600/30 border-indigo-400/70 hover:border-indigo-300 cursor-pointer active:scale-[0.99]'
                : 'bg-slate-950/70 border-slate-800 opacity-60 cursor-not-allowed'
            }`}
          >
            <div
              className={`flex items-center justify-center w-11 h-11 rounded-2xl shrink-0 ${
                canOpenOriginal
                  ? 'bg-indigo-500 text-white shadow'
                  : 'bg-slate-800 text-slate-500'
              }`}
            >
              <History className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-black text-sm text-white block">Play on Old Map 🕰️</span>
              <span className="text-xs text-slate-300">
                {canOpenOriginal
                  ? 'Open the classic puzzle map'
                  : 'Old map is no longer stored'}
              </span>
            </div>
          </button>

          {!canOpenOriginal && (
            <div
              data-testid="mismatch-original-unavailable-note"
              role="note"
              className="flex items-start gap-2 p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-amber-200"
            >
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>Tap Play on New Map to open your blocks!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
