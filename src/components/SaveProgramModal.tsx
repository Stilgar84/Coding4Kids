import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
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
  Clock,
  Compass,
  Plus,
} from 'lucide-react';

export const SaveProgramModal: React.FC = () => {
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
  } = useAppStore();

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
        setTitle(`Lesson ${currentLevel} Solution (${timeStr})`);
      } else if (activeSimId === 'beat') {
        setTitle(`Beat & Light Mix (${timeStr})`);
      } else {
        setTitle(`Turtle Drawing (${timeStr})`);
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
      // Path A: code-only payload + top-level lessonId, lessonVersion, slotIndex
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
        title: title.trim() || 'Untitled Program',
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
    setTimeout(() => {
      setSaveModalOpen(false);
    }, 900);
  };

  const selectedSlotOccupied = appMode === 'curriculum' && slotMap.has(selectedSlot);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-program-modal-title"
      data-testid="save-program-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
      onClick={() => setSaveModalOpen(false)}
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-md max-h-[90vh] bg-slate-900 border-2 border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-emerald-600/30 border border-emerald-500/50 text-emerald-400">
              <Save className="w-5 h-5" />
            </div>
            <div>
              <h2 id="save-program-modal-title" className="text-lg font-black text-white">
                {appMode === 'curriculum' ? 'Save Lesson Slot' : 'Save Program Locally'}
              </h2>
              <p className="text-xs text-slate-400">
                {appMode === 'curriculum'
                  ? `Activity ${activeActivityId} (v${activeActivityVersion}) • Code-only slot`
                  : `Pre-simulated up to ${MAX_SAVE_SIMULATION_STEPS} steps`}
              </p>
            </div>
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

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex flex-col gap-4">
          {/* Visual Numbered Lesson Save Slots (Curriculum Mode) */}
          {appMode === 'curriculum' && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>Choose Save Slot</span>
                <span className="text-[11px] text-slate-400">
                  {selectedSlotOccupied ? `Replaces Slot ${selectedSlot}` : `New Slot ${selectedSlot}`}
                </span>
              </div>
              <div
                role="group"
                aria-label="Lesson save slots"
                data-testid="lesson-save-slots-grid"
                className="grid grid-cols-3 gap-2.5"
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
                      className={`relative flex flex-col items-center justify-between p-2 rounded-2xl border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
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
                          <span
                            className="text-[10px] font-extrabold text-slate-400"
                            title={`Saved at v${occupied.lessonVersion ?? 1}`}
                          >
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
                          className={`w-full h-14 rounded-xl overflow-hidden flex items-center justify-center border border-slate-800 ${
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
                        <div className="w-full h-14 rounded-xl border border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-500 gap-0.5">
                          <Plus className="w-4 h-4" />
                          <span className="text-[10px] font-bold">Empty</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Resulting Map Screenshot Preview */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span>Resulting Map Preview</span>
              <span className="text-[11px] text-slate-500">
                {activeSimId === 'grid'
                  ? 'Grid World'
                  : activeSimId === 'beat'
                  ? 'Beat & Light Matrix'
                  : 'Turtle LOGO'}
              </span>
            </div>
            <div
              className={`relative w-full h-40 rounded-2xl border-2 border-slate-700 p-2 overflow-hidden flex items-center justify-center shadow-inner group ${
                activeSimId === 'grid' || activeSimId === 'beat' ? 'bg-slate-950' : 'bg-white'
              }`}
            >
              <img
                data-testid="save-map-preview"
                src={simData.screenshot}
                alt="Resulting map preview"
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          {/* Simulation Outcome Badge */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              {simData.status === 'SUCCESS' ? (
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <Trophy className="w-4 h-4 text-emerald-400" />
                  <span>Success</span>
                </div>
              ) : simData.status === 'COLLISION' ? (
                <div className="flex items-center gap-1.5 text-red-400 font-bold">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span>Collision</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-sky-400 font-bold">
                  <Compass className="w-4 h-4 text-sky-400" />
                  <span>Completed</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 text-slate-400 font-medium">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>
                {simData.stepCount >= MAX_SAVE_SIMULATION_STEPS
                  ? `Limit (${MAX_SAVE_SIMULATION_STEPS} steps)`
                  : `${simData.stepCount} ${simData.stepCount === 1 ? 'step' : 'steps'}`}
              </span>
            </div>
          </div>

          {/* Title Input */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="save-program-title-input" className="text-xs text-slate-400 font-semibold">
              Program Title
            </label>
            <input
              id="save-program-title-input"
              type="text"
              data-testid="input-save-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setHasCustomTitle(true);
              }}
              placeholder="Enter program name..."
              maxLength={60}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-medium"
            />
          </div>

          {/* Save Button */}
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
                <span>
                  {appMode === 'curriculum'
                    ? `Saved to Slot ${selectedSlot}!`
                    : 'Saved to Local Storage!'}
                </span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                <span>
                  {appMode === 'curriculum'
                    ? selectedSlotOccupied
                      ? `Overwrite Slot ${selectedSlot}`
                      : `Save to Slot ${selectedSlot}`
                    : 'Save Locally'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
