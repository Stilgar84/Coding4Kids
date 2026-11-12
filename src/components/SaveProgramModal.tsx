import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAppStore, useAppStoreSelector } from '../store/useAppStore';
import { getSimEnvironment } from '../engine/simulation/registry';
import { runHeadlessSimulation, MAX_SAVE_SIMULATION_STEPS } from '../engine/simulationRunner';
import { generateSimulationThumbnail } from '../services/mapThumbnailGenerator';
import {
  getLessonSaveSlots,
  getNextAvailableLessonSlot,
  SavedProgramEntry,
  saveProgram,
} from '../services/localSaveService';
import { GridState } from '../types';
import { TurtleState } from '../simulations/turtle/types';
import { resetBeatState } from '../simulations/beat/beatEnvironment';
import {
  X,
  Save,
  Check,
  Trophy,
  AlertTriangle,
  Compass,
  Plus,
} from 'lucide-react';

export const SaveProgramModal: React.FC = () => {
  const isSaveModalOpen = useAppStoreSelector((s) => s.isSaveModalOpen);
  if (!isSaveModalOpen) return null;
  return <SaveProgramModalContent />;
};

const SaveProgramModalContent: React.FC = () => {
  useAppStore();
  const {
    activeProfileId,
    appMode,
    activeActivityId,
    activeActivityVersion,
    isSaveModalOpen,
    setSaveModalOpen,
    activeSimId,
    workspace,
    grid,
    turtleState,
    beatState,
    currentLevel,
    exportCode,
  } = useAppStore.getState();

  const initialNextSlot =
    appMode === 'curriculum'
      ? getNextAvailableLessonSlot(activeProfileId, activeActivityId)
      : 1;

  const [selectedSlot, setSelectedSlot] = useState<number>(initialNextSlot);
  const [title, setTitle] = useState(
    appMode === 'curriculum'
      ? `Activity ${activeActivityId} — Slot ${initialNextSlot}`
      : ''
  );
  const [hasCustomTitle, setHasCustomTitle] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isSaveModalOpen && closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [isSaveModalOpen]);

  const lessonSlots = useMemo<SavedProgramEntry[]>(() => {
    if (!isSaveModalOpen || appMode !== 'curriculum') return [];
    return getLessonSaveSlots(activeProfileId, activeActivityId);
  }, [isSaveModalOpen, appMode, activeProfileId, activeActivityId, savedSuccess]);

  const slotMap = useMemo(() => {
    const map = new Map<number, SavedProgramEntry>();
    for (const s of lessonSlots) {
      if (s.slotIndex !== undefined && !map.has(s.slotIndex)) {
        map.set(s.slotIndex, s);
      }
    }
    return map;
  }, [lessonSlots]);

  const displayedSlotNumbers = useMemo(() => {
    const maxExisting = lessonSlots.reduce(
      (max, item) => Math.max(max, item.slotIndex ?? 0),
      0
    );
    const count = Math.min(6, Math.max(3, maxExisting + 1));
    return Array.from({ length: count }, (_, idx) => idx + 1);
  }, [lessonSlots]);

  // Run simulation and generate screenshot when modal opens
  const simData = useMemo(() => {
    if (!isSaveModalOpen) return null;

    const simEnv = getSimEnvironment(activeSimId);
    if (!simEnv) return null;

    if (activeSimId === 'grid') {
      const initialState: GridState = {
        ...grid,
        robot: {
          ...grid.robot,
          x: grid.robot.initialX,
          y: grid.robot.initialY,
          dir: grid.robot.initialDir,
        },
        flags: grid.flags.map((f) => ({ ...f, collected: false })),
        trace: [{ x: grid.robot.initialX, y: grid.robot.initialY }],
        status: 'IDLE',
      };

      const result = runHeadlessSimulation(
        workspace,
        'grid',
        initialState,
        MAX_SAVE_SIMULATION_STEPS
      );

      const screenshot = generateSimulationThumbnail('grid', result.finalState);

      return {
        status: result.status,
        stepCount: result.stepCount,
        screenshot,
      };
    } else if (activeSimId === 'beat') {
      const initialState = resetBeatState(beatState);
      const result = runHeadlessSimulation(
        workspace,
        'beat',
        initialState,
        MAX_SAVE_SIMULATION_STEPS
      );
      const screenshot = generateSimulationThumbnail('beat', result.finalState);

      return {
        status: result.status,
        stepCount: result.stepCount,
        screenshot,
      };
    } else {
      const initialState: TurtleState = {
        ...turtleState,
        robot: { x: 0, y: 0, heading: 0 },
        paths: [],
        status: 'IDLE',
      };

      const result = runHeadlessSimulation(
        workspace,
        'turtle',
        initialState,
        MAX_SAVE_SIMULATION_STEPS
      );

      const screenshot = generateSimulationThumbnail('turtle', result.finalState);

      return {
        status: result.status,
        stepCount: result.stepCount,
        screenshot,
      };
    }
  }, [isSaveModalOpen, activeSimId, grid, turtleState, beatState, workspace]);

  useEffect(() => {
    if (isSaveModalOpen) {
      setSavedSuccess(false);
      setHasCustomTitle(false);
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (appMode === 'curriculum') {
        const nextSlot = getNextAvailableLessonSlot(activeProfileId, activeActivityId);
        setSelectedSlot(nextSlot);
        setTitle(`Activity ${activeActivityId} — Slot ${nextSlot}`);
      } else if (activeSimId === 'grid') {
        setTitle(`Level ${currentLevel} (${timeStr})`);
      } else if (activeSimId === 'beat') {
        setTitle(`Beat Mix (${timeStr})`);
      } else {
        setTitle(`Turtle Art (${timeStr})`);
      }
    }
  }, [isSaveModalOpen, appMode, activeProfileId, activeActivityId, activeSimId, currentLevel]);

  useEffect(() => {
    if (!isSaveModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setSaveModalOpen(false);
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
  }, [isSaveModalOpen, setSaveModalOpen]);

  if (!isSaveModalOpen || !simData) return null;

  const handleSelectSlot = (slotNum: number) => {
    setSelectedSlot(slotNum);
    if (!hasCustomTitle) {
      const existing = slotMap.get(slotNum);
      setTitle(existing?.title || `Activity ${activeActivityId} — Slot ${slotNum}`);
    }
  };

  const handleSave = () => {
    if (appMode === 'curriculum') {
      const code = exportCode(false);
      saveProgram({
        title: title.trim() || `Activity ${activeActivityId} — Slot ${selectedSlot}`,
        profileId: activeProfileId,
        simId: activeSimId,
        code,
        screenshot: simData.screenshot,
        status: simData.status,
        stepCount: simData.stepCount,
        lessonId: activeActivityId,
        lessonVersion: activeActivityVersion,
        slotIndex: selectedSlot,
      });
    } else {
      const code = exportCode(true);
      saveProgram({
        title: title.trim() || 'My Program',
        profileId: activeProfileId,
        simId: activeSimId,
        code,
        screenshot: simData.screenshot,
        status: simData.status,
        stepCount: simData.stepCount,
        levelId: activeSimId === 'grid' ? currentLevel : undefined,
      });
    }

    setSavedSuccess(true);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      setSaveModalOpen(false);
    }, 650);
  };

  const selectedSlotOccupied = appMode === 'curriculum' && slotMap.has(selectedSlot);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-program-modal-title"
      data-testid="save-program-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
      onClick={() => setSaveModalOpen(false)}
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-md max-h-[90vh] bg-slate-900 border-2 border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-2xl bg-emerald-600/30 border border-emerald-500/50 text-emerald-400">
              <Save className="w-4 h-4" />
            </div>
            <h2 id="save-program-modal-title" className="text-base sm:text-lg font-black text-white">
              Save
            </h2>
          </div>
          <button
            type="button"
            data-testid="modal-save-close-btn"
            aria-label="Close save dialog"
            onClick={() => setSaveModalOpen(false)}
            className="flex items-center justify-center w-9 h-9 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Above-the-Fold Body Content */}
        <div className="p-4 overflow-y-auto flex flex-col gap-3">
          {/* 1. Visual Numbered Lesson Save Slots (Curriculum Mode) */}
          {appMode === 'curriculum' && (
            <div
              role="group"
              aria-label="Lesson save slots"
              data-testid="lesson-save-slots-grid"
              className="grid grid-cols-3 gap-2"
            >
              {displayedSlotNumbers.map((slotNum) => {
                const occupied = slotMap.get(slotNum);
                const isSelected = selectedSlot === slotNum;
                return (
                  <button
                    key={slotNum}
                    type="button"
                    data-testid={`save-slot-btn-${slotNum}`}
                    aria-pressed={isSelected}
                    aria-label={
                      occupied
                        ? `Slot ${slotNum}, occupied (${occupied.title})`
                        : `Slot ${slotNum}, empty`
                    }
                    onClick={() => handleSelectSlot(slotNum)}
                    className={`relative flex flex-col items-center justify-between p-1.5 rounded-2xl border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                      isSelected
                        ? 'bg-emerald-500/15 border-emerald-400 shadow-md scale-[1.02]'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span
                        className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                          isSelected
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        Slot {slotNum}
                      </span>
                      {occupied && (
                        <span className="text-[10px] font-extrabold text-amber-300">
                          {occupied.status === 'SUCCESS'
                            ? '★'
                            : occupied.status === 'COLLISION'
                            ? '!'
                            : '●'}
                        </span>
                      )}
                    </div>

                    {occupied ? (
                      <div
                        className={`w-full h-12 rounded-xl overflow-hidden flex items-center justify-center border border-slate-800 ${
                          occupied.simId === 'turtle' ? 'bg-white' : 'bg-slate-950'
                        }`}
                      >
                        <img
                          src={occupied.screenshot}
                          alt={`Slot ${slotNum} preview`}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-12 rounded-xl border border-dashed border-slate-700 flex items-center justify-center text-slate-500">
                        <Plus className="w-4 h-4" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* 2. Compact Preview Thumbnail + Overlaid Outcome Pill */}
          <div
            className={`relative w-full h-28 sm:h-36 rounded-2xl border-2 border-slate-700 p-2 overflow-hidden flex items-center justify-center shadow-inner ${
              activeSimId === 'grid' || activeSimId === 'beat' ? 'bg-slate-950' : 'bg-white'
            }`}
          >
            <img
              data-testid="save-map-preview"
              src={simData.screenshot}
              alt="Program preview"
              className="w-full h-full object-contain"
            />

            <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/90 backdrop-blur border border-slate-700 text-xs font-extrabold shadow">
              {simData.status === 'SUCCESS' ? (
                <span className="inline-flex items-center gap-1 text-emerald-400">
                  <Trophy className="w-3.5 h-3.5" />
                  <span>🏁</span>
                </span>
              ) : simData.status === 'COLLISION' ? (
                <span className="inline-flex items-center gap-1 text-red-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>💥</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-sky-400">
                  <Compass className="w-3.5 h-3.5" />
                  <span>✓</span>
                </span>
              )}
              <span className="text-slate-400 font-mono text-[11px]">{simData.stepCount}</span>
            </div>
          </div>

          {/* 3. Compact Name Input */}
          <input
            id="save-program-title-input"
            type="text"
            aria-label="Program name"
            data-testid="input-save-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setHasCustomTitle(true);
            }}
            placeholder="Name..."
            maxLength={60}
            className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-medium"
          />

          {/* 4. Primary Save Button (Always Above the Fold!) */}
          <button
            type="button"
            data-testid="btn-confirm-save"
            onClick={handleSave}
            disabled={savedSuccess}
            className={`flex items-center justify-center gap-2 w-full py-3 font-black rounded-2xl shadow-lg border transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${
              savedSuccess
                ? 'bg-emerald-700 border-emerald-500 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400 text-white'
            }`}
          >
            {savedSuccess ? (
              <>
                <Check className="w-5 h-5 text-emerald-300" />
                <span>Saved!</span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                <span>
                  {appMode === 'curriculum'
                    ? selectedSlotOccupied
                      ? `Save Slot ${selectedSlot}`
                      : `Save Slot ${selectedSlot}`
                    : 'Save'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
