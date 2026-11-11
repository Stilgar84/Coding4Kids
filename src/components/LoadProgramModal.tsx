import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
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
} from 'lucide-react';

export const LoadProgramModal: React.FC = () => {
  const {
    activeProfileId,
    isLoadModalOpen,
    setLoadModalOpen,
    importCode,
  } = useAppStore();

  const [saves, setSaves] = useState<SavedProgramEntry[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (isLoadModalOpen) {
      setSaves(getSavedPrograms(activeProfileId));
      setDeleteConfirmId(null);
    }
  }, [isLoadModalOpen, activeProfileId]);

  if (!isLoadModalOpen) return null;

  const handleLoad = (entry: SavedProgramEntry) => {
    const res = importCode(entry.code);
    if (res.success) {
      setLoadModalOpen(false);
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
      data-testid="load-program-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
      onClick={() => setLoadModalOpen(false)}
    >
      <div
        className="relative w-full max-w-4xl max-h-[85vh] bg-slate-900 border-2 border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-500/50 text-indigo-400">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white">Saved Programs</h2>
                <span
                  data-testid="saved-count-badge"
                  className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700"
                >
                  {saves.length}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Choose a saved map & program to load or delete
              </p>
            </div>
          </div>
          <button
            data-testid="modal-load-close-btn"
            onClick={() => setLoadModalOpen(false)}
            className="flex items-center justify-center w-9 h-9 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {saves.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 gap-3">
              <div className="flex items-center justify-center w-16 h-16 rounded-3xl bg-slate-800/80 border border-slate-700 text-slate-500">
                <FolderOpen className="w-8 h-8" />
              </div>
              <div className="max-w-xs">
                <p className="font-bold text-slate-200 text-base">No saved programs yet</p>
                <p className="text-xs text-slate-400 mt-1">
                  Build and test your code, then click the Save button in the toolbar to save it locally.
                </p>
              </div>
            </div>
          ) : (
            <div
              data-testid="saved-programs-grid"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {saves.map((entry) => (
                <div
                  key={entry.id}
                  data-testid={`saved-card-${entry.id}`}
                  className="group relative flex flex-col bg-slate-950 border-2 border-slate-800 hover:border-slate-600 rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-xl"
                >
                  {/* Screenshot Thumbnail */}
                  <div className={`relative w-full h-36 p-2 flex items-center justify-center border-b border-slate-800 overflow-hidden ${
                    entry.simId === 'grid' ? 'bg-slate-950' : 'bg-white'
                  }`}>
                    {entry.screenshot ? (
                      <img
                        src={entry.screenshot}
                        alt={entry.title}
                        className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex items-center justify-center text-slate-400 text-xs">
                        No thumbnail
                      </div>
                    )}

                    {/* Environment Badge */}
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-900/90 text-slate-200 backdrop-blur-sm border border-slate-700">
                      {entry.simId === 'turtle' ? '🐢 Turtle' : '🤖 Grid'}
                    </div>

                    {/* Outcome Badge */}
                    <div className="absolute top-2 right-2">
                      {entry.status === 'SUCCESS' ? (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-600/50 backdrop-blur-sm">
                          <Trophy className="w-3 h-3 text-emerald-400" />
                          <span>Win</span>
                        </div>
                      ) : entry.status === 'COLLISION' ? (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-red-950/90 text-red-300 border border-red-600/50 backdrop-blur-sm">
                          <AlertTriangle className="w-3 h-3 text-red-400" />
                          <span>Hit</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-sky-950/90 text-sky-300 border border-sky-600/50 backdrop-blur-sm">
                          <Compass className="w-3 h-3 text-sky-400" />
                          <span>Done</span>
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
                          {entry.stepCount} steps
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
                      <button
                        data-testid={`btn-load-entry-${entry.id}`}
                        onClick={() => handleLoad(entry)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors active:scale-95 shadow-md"
                      >
                        <span>Load</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      <button
                        data-testid={`btn-delete-entry-${entry.id}`}
                        onClick={(e) => handleDelete(entry.id, e)}
                        className={`flex items-center justify-center py-2 px-2.5 rounded-xl text-xs font-bold transition-all ${
                          deleteConfirmId === entry.id
                            ? 'bg-red-600 hover:bg-red-500 text-white px-3'
                            : 'text-slate-400 hover:text-red-400 hover:bg-slate-800'
                        }`}
                        title="Delete saved program"
                      >
                        {deleteConfirmId === entry.id ? (
                          <span>Confirm</span>
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
