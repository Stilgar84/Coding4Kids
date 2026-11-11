import React, { useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getActivityAtVersion, getActivityLatest } from '../data/curriculum';
import { Sparkles, History, X, AlertCircle, ArrowRight } from 'lucide-react';

export const LessonVersionMismatchModal: React.FC = () => {
  const { pendingVersionMismatch, resolveVersionMismatch, dismissVersionMismatch } = useAppStore();

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
    ? `Activity ${latestActivity.id}: ${latestActivity.title}`
    : `Activity ${pendingVersionMismatch.lessonId}`;
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
        className="relative w-full max-w-lg bg-slate-900 border-2 border-amber-500/60 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
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
                className="text-lg font-black text-white leading-tight"
              >
                Updated Lesson Detected!
              </h2>
              <p className="text-xs text-slate-300 font-semibold truncate max-w-[290px]">
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
        <div className="p-6 flex flex-col gap-4">
          {/* Version Comparison Banner */}
          <div
            data-testid="mismatch-version-badges"
            className="flex items-center justify-between gap-2 px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800"
          >
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Your Saved Blocks
              </span>
              <span className="inline-flex items-center gap-1.5 mt-0.5 text-sm font-black text-amber-300">
                <span>■ Version v{pendingVersionMismatch.savedVersion}</span>
                {pendingVersionMismatch.slotIndex !== undefined && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                    Slot {pendingVersionMismatch.slotIndex}
                  </span>
                )}
              </span>
            </div>

            <ArrowRight className="w-5 h-5 text-slate-500 shrink-0" aria-hidden="true" />

            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Current Lesson
              </span>
              <span className="inline-flex items-center gap-1 mt-0.5 text-sm font-black text-emerald-300">
                <span>● Version v{pendingVersionMismatch.latestVersion}</span>
              </span>
            </div>
          </div>

          <p id="lesson-version-mismatch-desc" className="text-xs text-slate-300 leading-relaxed">
            {pendingVersionMismatch.title ? (
              <>
                <strong className="text-white">&ldquo;{pendingVersionMismatch.title}&rdquo;</strong>{' '}
                was built on an earlier version of this puzzle. How would you like to open your
                blocks?
              </>
            ) : (
              <>
                This shared program was built on an earlier version of this puzzle. How would you
                like to open the blocks?
              </>
            )}
          </p>

          {/* Choice 1: Load into Latest Lesson */}
          <button
            ref={latestBtnRef}
            type="button"
            data-testid="btn-mismatch-load-latest"
            onClick={() => resolveVersionMismatch('latest')}
            className="group flex items-center gap-3.5 w-full p-4 text-left rounded-2xl bg-emerald-600/20 hover:bg-emerald-600/30 border-2 border-emerald-400/70 hover:border-emerald-300 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 active:scale-[0.99]"
          >
            <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-emerald-500 text-slate-950 shrink-0 shadow">
              <Sparkles className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-black text-sm text-white">Load into Latest Lesson</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/30 text-emerald-200 border border-emerald-400/40">
                  v{pendingVersionMismatch.latestVersion}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Keep the newest map &amp; goals and place your saved blocks inside.
              </p>
            </div>
          </button>

          {/* Choice 2: Open in Original Lesson Version */}
          <button
            type="button"
            data-testid="btn-mismatch-open-original"
            disabled={!canOpenOriginal}
            onClick={() => {
              if (canOpenOriginal) {
                resolveVersionMismatch('original');
              }
            }}
            className={`group flex items-center gap-3.5 w-full p-4 text-left rounded-2xl border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${
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
              <div className="flex items-center gap-2">
                <span className="font-black text-sm text-white">
                  Open in Original Lesson Version
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-500/30 text-indigo-200 border border-indigo-400/40">
                  v{pendingVersionMismatch.savedVersion}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {canOpenOriginal
                  ? `Play on the classic v${pendingVersionMismatch.savedVersion} map where these blocks were saved.`
                  : `Original version v${pendingVersionMismatch.savedVersion} is no longer stored in this app build.`}
              </p>
            </div>
          </button>

          {!canOpenOriginal && (
            <div
              data-testid="mismatch-original-unavailable-note"
              role="note"
              className="flex items-start gap-2 p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-amber-200"
            >
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Historical map v{pendingVersionMismatch.savedVersion} is unavailable, so{' '}
                <strong>Load into Latest Lesson</strong> will safely import your blocks into v
                {pendingVersionMismatch.latestVersion}.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
