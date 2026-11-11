import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getActivityLatest } from '../data/curriculum';
import {
  getSavedPrograms,
  deleteProgram,
  SavedProgramEntry,
} from '../services/localSaveService';
import {
  X,
  FolderOpen,
  Trash2,
  Trophy,
  AlertTriangle,
  Clock,
  Compass,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';

export type LoadFilterMode = 'current-lesson' | 'all-lessons' | 'sandbox' | 'all';

export const LoadProgramModal: React.FC = () => {
  useAppStore();
  const {
    activeProfileId,
    appMode,
    activeActivityId,
    isLoadModalOpen,
    setLoadModalOpen,
    loadSavedProgram,
  } = useAppStore.getState();

  const [saves, setSaves] = useState<SavedProgramEntry[]>(() =>
    isLoadModalOpen ? getSavedPrograms(activeProfileId) : []
  );
  const [filterMode, setFilterMode] = useState<LoadFilterMode>(() =>
    appMode === 'curriculum' ? 'current-lesson' : 'all'
  );
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isLoadModalOpen) {
      setSaves(getSavedPrograms(activeProfileId));
      setFilterMode(appMode === 'curriculum' ? 'current-lesson' : 'all');
      setDeleteConfirmId(null);
      setLoadError(null);
    }
  }, [isLoadModalOpen, activeProfileId, appMode, activeActivityId]);

  useEffect(() => {
    if (!isLoadModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (deleteConfirmId) {
          setDeleteConfirmId(null);
        } else {
          setLoadModalOpen(false);
        }
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
  }, [isLoadModalOpen, deleteConfirmId, setLoadModalOpen]);

  const counts = useMemo(() => {
    let currentLesson = 0;
    let allLessons = 0;
    let sandbox = 0;
    for (const s of saves) {
      if (s.lessonId) {
        allLessons++;
        if (s.lessonId === activeActivityId) {
          currentLesson++;
        }
      } else {
        sandbox++;
      }
    }
    return {
      currentLesson,
      allLessons,
      sandbox,
      all: saves.length,
    };
  }, [saves, activeActivityId]);

  const filteredSaves = useMemo(() => {
    if (filterMode === 'current-lesson') {
      return saves
        .filter((s) => s.lessonId === activeActivityId)
        .sort((a, b) => {
          const slotA = a.slotIndex ?? Number.MAX_SAFE_INTEGER;
          const slotB = b.slotIndex ?? Number.MAX_SAFE_INTEGER;
          if (slotA !== slotB) return slotA - slotB;
          return b.createdAt - a.createdAt;
        });
    }
    if (filterMode === 'all-lessons') {
      return saves.filter((s) => Boolean(s.lessonId));
    }
    if (filterMode === 'sandbox') {
      return saves.filter((s) => !s.lessonId);
    }
    return saves;
  }, [saves, filterMode, activeActivityId]);

  if (!isLoadModalOpen) return null;

  const handleLoad = (entry: SavedProgramEntry) => {
    setLoadError(null);
    const res = loadSavedProgram(entry);
    if (res.success) {
      setLoadModalOpen(false);
    } else {
      setLoadError(res.error || 'Could not open saved blocks.');
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (deleteConfirmId === id) {
      deleteProgram(id);
      setSaves((prev) => prev.filter((s) => s.id !== id));
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(id);
    }
  };

  const formatTimestamp = (ts: number) => {
    try {
      const d = new Date(ts);
      return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    } catch {
      return '';
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="load-program-modal-title"
      data-testid="load-program-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
      onClick={() => setLoadModalOpen(false)}
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-4xl max-h-[85vh] bg-slate-900 border-2 border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-500/50 text-indigo-400">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-2">
              <h2 id="load-program-modal-title" className="text-lg font-black text-white">
                Open Saved
              </h2>
              <span
                data-testid="saved-count-badge"
                className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700"
              >
                {filteredSaves.length}
              </span>
            </div>
          </div>
          <button
            type="button"
            data-testid="modal-load-close-btn"
            aria-label="Close saved programs dialog"
            onClick={() => setLoadModalOpen(false)}
            className="flex items-center justify-center w-9 h-9 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scope Filter Pills */}
        <div
          role="group"
          aria-label="Filter saved programs"
          className="flex flex-wrap items-center gap-2 px-5 py-2.5 border-b border-slate-800 bg-slate-950/40 shrink-0"
        >
          {appMode === 'curriculum' && (
            <button
              type="button"
              data-testid="load-filter-current-lesson"
              aria-pressed={filterMode === 'current-lesson'}
              onClick={() => setFilterMode('current-lesson')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                filterMode === 'current-lesson'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-600'
              }`}
            >
              🎓 {activeActivityId} ({counts.currentLesson})
            </button>
          )}
          <button
            type="button"
            data-testid="load-filter-all"
            aria-pressed={filterMode === 'all'}
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
              filterMode === 'all'
                ? 'bg-indigo-600 text-white shadow'
                : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-600'
            }`}
          >
            ✨ All ({counts.all})
          </button>
          <button
            type="button"
            data-testid="load-filter-all-lessons"
            aria-pressed={filterMode === 'all-lessons'}
            onClick={() => setFilterMode('all-lessons')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
              filterMode === 'all-lessons'
                ? 'bg-indigo-600 text-white shadow'
                : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-600'
            }`}
          >
            🎓 Learn ({counts.allLessons})
          </button>
          <button
            type="button"
            data-testid="load-filter-sandbox"
            aria-pressed={filterMode === 'sandbox'}
            onClick={() => setFilterMode('sandbox')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
              filterMode === 'sandbox'
                ? 'bg-indigo-600 text-white shadow'
                : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-600'
            }`}
          >
            🛠️ Play ({counts.sandbox})
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-4">
          {loadError && (
            <div
              role="alert"
              className="flex items-center gap-2 p-3 rounded-2xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs font-semibold"
            >
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{loadError}</span>
            </div>
          )}

          {filteredSaves.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400 gap-3">
              <div className="flex items-center justify-center w-16 h-16 rounded-3xl bg-slate-800/80 border border-slate-700 text-slate-500">
                <FolderOpen className="w-8 h-8" />
              </div>
              <div className="max-w-xs">
                <p className="font-bold text-slate-200 text-base">
                  {filterMode === 'current-lesson'
                    ? `No saved slots for ${activeActivityId} yet`
                    : 'No saved blocks yet'}
                </p>
                {filterMode !== 'all' && counts.all > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilterMode('all')}
                    className="mt-3 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-indigo-300 border border-slate-700 transition-colors"
                  >
                    Show All ({counts.all})
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div
              data-testid="saved-programs-grid"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {filteredSaves.map((entry) => {
                const latestLesson = entry.lessonId
                  ? getActivityLatest(entry.lessonId)
                  : undefined;
                const savedVer = entry.lessonVersion ?? 1;
                const hasVersionMismatch = Boolean(
                  latestLesson && savedVer !== latestLesson.version
                );

                return (
                  <div
                    key={entry.id}
                    data-testid={`saved-card-${entry.id}`}
                    className="group relative flex flex-col bg-slate-950 border-2 border-slate-800 hover:border-slate-600 rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-xl"
                  >
                    {/* Screenshot Thumbnail */}
                    <div
                      className={`relative w-full h-36 p-2 flex items-center justify-center border-b border-slate-800 overflow-hidden ${
                        entry.simId === 'grid' || entry.simId === 'beat'
                          ? 'bg-slate-950'
                          : 'bg-white'
                      }`}
                    >
                      {entry.screenshot ? (
                        <img
                          src={entry.screenshot}
                          alt={entry.title}
                          className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex items-center justify-center text-slate-400 text-xs">
                          🤖
                        </div>
                      )}

                      {/* Top-Left Environment + Slot Badge */}
                      <div className="absolute top-2 left-2 flex items-center gap-1.5">
                        {entry.slotIndex !== undefined && (
                          <span
                            data-testid={`load-slot-badge-${entry.id}`}
                            className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-indigo-600/95 text-white border border-indigo-400/60 shadow"
                          >
                            Slot {entry.slotIndex}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-slate-900/90 text-slate-200 backdrop-blur-sm border border-slate-700">
                          {entry.simId === 'turtle'
                            ? '🐢'
                            : entry.simId === 'beat'
                            ? '🎵'
                            : '🤖'}
                        </span>
                      </div>

                      {/* Bottom-Left Lesson / Play Origin */}
                      <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
                        {entry.lessonId ? (
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-900/90 text-emerald-300 border border-emerald-600/40 backdrop-blur-sm">
                            🎓 {entry.lessonId}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-900/90 text-slate-300 border border-slate-700 backdrop-blur-sm">
                            🛠️ Play
                          </span>
                        )}

                        {hasVersionMismatch && latestLesson && (
                          <span
                            data-testid={`load-mismatch-badge-${entry.id}`}
                            title="Newer puzzle map available"
                            className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-amber-950/95 text-amber-300 border border-amber-500/60"
                          >
                            ✨ New Map
                          </span>
                        )}
                      </div>

                      {/* Top-Right Outcome Badge */}
                      <div className="absolute top-2 right-2">
                        {entry.status === 'SUCCESS' ? (
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-600/50 backdrop-blur-sm">
                            <Trophy className="w-3 h-3 text-emerald-400" />
                            <span>🏁</span>
                          </div>
                        ) : entry.status === 'COLLISION' ? (
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-red-950/90 text-red-300 border border-red-600/50 backdrop-blur-sm">
                            <AlertTriangle className="w-3 h-3 text-red-400" />
                            <span>💥</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-sky-950/90 text-sky-300 border border-sky-600/50 backdrop-blur-sm">
                            <Compass className="w-3 h-3 text-sky-400" />
                            <span>✓</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Info & Actions */}
                    <div className="p-3.5 flex flex-col flex-1 justify-between gap-3">
                      <div>
                        <h3
                          data-testid={`card-title-${entry.id}`}
                          className="font-bold text-sm text-white truncate"
                          title={entry.title}
                        >
                          {entry.title}
                        </h3>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                          <span>{formatTimestamp(entry.createdAt)}</span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {entry.stepCount}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
                        <button
                          type="button"
                          data-testid={`btn-load-entry-${entry.id}`}
                          onClick={() => handleLoad(entry)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors active:scale-95 shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                        >
                          <span>Open</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          data-testid={`btn-delete-entry-${entry.id}`}
                          aria-label={
                            deleteConfirmId === entry.id
                              ? `Confirm delete ${entry.title}`
                              : `Delete ${entry.title}`
                          }
                          onClick={(e) => handleDelete(entry.id, e)}
                          className={`flex items-center justify-center py-2 px-2.5 rounded-xl text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 ${
                            deleteConfirmId === entry.id
                              ? 'bg-red-600 hover:bg-red-500 text-white px-3'
                              : 'text-slate-400 hover:text-red-400 hover:bg-slate-800'
                          }`}
                          title="Delete saved program"
                        >
                          {deleteConfirmId === entry.id ? (
                            <span>Delete?</span>
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
