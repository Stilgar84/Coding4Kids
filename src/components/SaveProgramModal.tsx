import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getSimEnvironment } from '../engine/simulation/registry';
import { runHeadlessSimulation, MAX_SAVE_SIMULATION_STEPS } from '../engine/simulationRunner';
import { generateSimulationThumbnail } from '../services/mapThumbnailGenerator';
import { saveProgram } from '../services/localSaveService';
import { GridState } from '../types';
import { TurtleState } from '../simulations/turtle/types';
import {
  X,
  Save,
  Check,
  Trophy,
  AlertTriangle,
  Clock,
  Compass,
} from 'lucide-react';

export const SaveProgramModal: React.FC = () => {
  const {
    activeProfileId,
    appMode,
    activeActivityId,
    isSaveModalOpen,
    setSaveModalOpen,
    activeSimId,
    workspace,
    grid,
    turtleState,
    currentLevel,
    exportCode,
  } = useAppStore();

  const [title, setTitle] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

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
  }, [isSaveModalOpen, activeSimId, grid, turtleState, workspace]);

  useEffect(() => {
    if (isSaveModalOpen) {
      setSavedSuccess(false);
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (appMode === 'curriculum') {
        setTitle(`Activity ${activeActivityId} (${timeStr})`);
      } else if (activeSimId === 'grid') {
        setTitle(`Lesson ${currentLevel} Solution (${timeStr})`);
      } else {
        setTitle(`Turtle Drawing (${timeStr})`);
      }
    }
  }, [isSaveModalOpen, appMode, activeActivityId, activeSimId, currentLevel]);

  useEffect(() => {
    if (!isSaveModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setSaveModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSaveModalOpen, setSaveModalOpen]);

  if (!isSaveModalOpen || !simData) return null;

  const handleSave = () => {
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

    setSavedSuccess(true);
    setTimeout(() => {
      setSaveModalOpen(false);
    }, 900);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="save-program-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
      onClick={() => setSaveModalOpen(false)}
    >
      <div
        className="relative w-full max-w-md bg-slate-900 border-2 border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-emerald-600/30 border border-emerald-500/50 text-emerald-400">
              <Save className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Save Program Locally</h2>
              <p className="text-xs text-slate-400">
                Pre-simulated up to {MAX_SAVE_SIMULATION_STEPS} steps
              </p>
            </div>
          </div>
          <button
            data-testid="modal-save-close-btn"
            onClick={() => setSaveModalOpen(false)}
            className="flex items-center justify-center w-9 h-9 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 flex flex-col gap-4">
          {/* Resulting Map Screenshot Preview (White Background) */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span>Resulting Map Preview</span>
              <span className="text-[11px] text-slate-500">
                {activeSimId === 'grid' ? 'Grid World' : 'Turtle LOGO'}
              </span>
            </div>
            <div className={`relative w-full h-48 rounded-2xl border-2 border-slate-700 p-2 overflow-hidden flex items-center justify-center shadow-inner group ${
              activeSimId === 'grid' ? 'bg-slate-950' : 'bg-white'
            }`}>
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
            <label className="text-xs text-slate-400 font-semibold">Program Title</label>
            <input
              type="text"
              data-testid="input-save-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter program name..."
              maxLength={60}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-medium"
            />
          </div>

          {/* Save Button */}
          <button
            data-testid="btn-confirm-save"
            onClick={handleSave}
            disabled={savedSuccess}
            className={`flex items-center justify-center gap-2 w-full py-3 font-black rounded-2xl shadow-lg border transition-all active:scale-95 ${
              savedSuccess
                ? 'bg-emerald-700 border-emerald-500 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400 text-white'
            }`}
          >
            {savedSuccess ? (
              <>
                <Check className="w-5 h-5 text-emerald-300" />
                <span>Saved to Local Storage!</span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                <span>Save Locally</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
