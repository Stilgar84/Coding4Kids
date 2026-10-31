import React from 'react';
import { useAppStore, PRESET_LEVELS } from '../store/useAppStore';
import { ScopeType } from '../types';
import { getSimEnvironment } from '../engine/simulation/registry';
import { validateLoopStructure } from '../engine/interpreter';
import { LESSONS } from '../data/lessons';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Zap,
  Lightbulb,
  ChevronLeft,
  ChevronRight,
  Share2,
} from 'lucide-react';

export const Toolbar: React.FC = () => {
  const {
    activeSimId,
    setSimEnvironment,
    currentLevel,
    setLevel,
    isPlaying,
    play,
    pause,
    step,
    reset,
    speed,
    setSpeed,
    workspace,
    setSolutionOpen,
    setExportImportOpen,
    grid,
    turtleState,
  } = useAppStore();

  const currentSimEnv = getSimEnvironment(activeSimId);
  const currentLesson = LESSONS.find((l) => l.id === currentLevel) || LESSONS[0];

  const hasLoopError = (['MAIN', 'F1', 'F2', 'F3'] as ScopeType[]).some((sc) => {
    return (workspace[sc]?.length ?? 0) > 0 && validateLoopStructure(workspace[sc]).hasError;
  });

  const toggleSpeed = () => {
    if (speed === 400) setSpeed(200);
    else if (speed === 200) setSpeed(100);
    else if (speed === 100) setSpeed(50);
    else setSpeed(400);
  };

  const getSpeedLabel = () => {
    if (speed === 50) return '8x';
    if (speed === 100) return '4x';
    if (speed === 200) return '2x';
    return '1x';
  };

  const handlePrevLevel = () => {
    const prevId = currentLevel > 1 ? currentLevel - 1 : PRESET_LEVELS.length;
    setLevel(prevId);
  };

  const handleNextLevel = () => {
    const nextId = currentLevel < PRESET_LEVELS.length ? currentLevel + 1 : 1;
    setLevel(nextId);
  };

  const ToolsComponent = currentSimEnv?.ToolsComponent;
  const currentSimState = activeSimId === 'grid' ? grid : turtleState;

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900 border-b-2 border-slate-800 shadow-md">
      {/* Left Section: Environment Switcher + Grid Lesson Navigation */}
      <div className="flex items-center gap-3 max-w-full overflow-hidden">
        {/* Environment Switcher Pill */}
        <div className="flex items-center bg-slate-950 p-1 rounded-2xl border border-slate-800">
          <button
            data-testid="sim-tab-grid"
            onClick={() => setSimEnvironment('grid')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
              activeSimId === 'grid'
                ? 'bg-sky-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🤖</span>
            <span>Grid</span>
          </button>
          <button
            data-testid="sim-tab-turtle"
            onClick={() => setSimEnvironment('turtle')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
              activeSimId === 'turtle'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🐢</span>
            <span>Turtle</span>
          </button>
        </div>

        {/* If Grid is active, show Lesson Navigation & Selection */}
        {activeSimId === 'grid' ? (
          <div className="flex items-center gap-2 max-w-full overflow-hidden">
            {/* Prev / Next Chevrons */}
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrevLevel}
                className="flex items-center justify-center w-8 h-11 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700"
                title="Previous Lesson"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handleNextLevel}
                className="flex items-center justify-center w-8 h-11 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700"
                title="Next Lesson"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Dropdown Selector for Course Lessons */}
            <div className="flex items-center gap-1.5 bg-slate-800 px-2 rounded-2xl border-2 border-slate-700">
              <span className="text-base" title={currentLesson.moduleTitle}>
                {currentLesson.moduleIcon}
              </span>
              <select
                value={currentLevel}
                onChange={(e) => setLevel(Number(e.target.value))}
                className="bg-transparent text-white font-bold text-sm h-11 focus:outline-none cursor-pointer max-w-[190px] sm:max-w-[240px] truncate"
                title="Select Course Lesson"
              >
                {LESSONS.map((l) => (
                  <option key={l.id} value={l.id} className="bg-slate-900 text-slate-100">
                    {l.id}. {l.title} ({l.concept})
                  </option>
                ))}
              </select>
            </div>

            {/* Level Quick Buttons (Scrollable Tray) */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-[200px] md:max-w-[280px] lg:max-w-[360px] no-scrollbar">
              {PRESET_LEVELS.map((lvl) => (
                <button
                  key={lvl.id}
                  data-testid={`btn-level-${lvl.id}`}
                  onClick={() => setLevel(lvl.id)}
                  className={`flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl font-black text-sm border-2 transition-all ${
                    currentLevel === lvl.id
                      ? 'bg-amber-500 border-amber-300 text-slate-950 shadow-md scale-105'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {lvl.id}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Turtle mode badge */
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 rounded-xl border border-slate-700 text-xs font-semibold text-emerald-300">
            <span>LOGO Unbounded Canvas</span>
          </div>
        )}
      </div>

      {/* Center: Playback Controls & Solution Button */}
      <div className="flex items-center gap-2">
        {/* Solution Button (available in Grid mode) */}
        {activeSimId === 'grid' && (
          <button
            data-testid="btn-solution"
            onClick={() => setSolutionOpen(true)}
            className="flex items-center gap-1.5 px-3.5 h-12 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-2xl border-2 border-amber-300 shadow-lg transition-transform active:scale-95"
            title="View Lesson Solution"
          >
            <Lightbulb className="w-5 h-5 fill-slate-950" />
            <span className="hidden sm:inline">Solution</span>
          </button>
        )}

        {/* Export / Import Button */}
        <button
          data-testid="btn-export-import"
          onClick={() => setExportImportOpen(true)}
          className="flex items-center gap-1.5 px-3.5 h-12 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl border-2 border-indigo-400 shadow-lg transition-transform active:scale-95"
          title="Share / Export / Import Program"
        >
          <Share2 className="w-5 h-5" />
          <span className="hidden sm:inline">Share</span>
        </button>

        {isPlaying ? (
          <button
            data-testid="btn-pause"
            onClick={pause}
            className="flex items-center justify-center w-12 h-12 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-2xl shadow-lg border-2 border-amber-300 transition-transform active:scale-95"
            title="Pause"
          >
            <Pause className="w-6 h-6 stroke-[3]" />
          </button>
        ) : (
          <button
            data-testid="btn-play"
            disabled={hasLoopError}
            onClick={play}
            className={`flex items-center justify-center w-12 h-12 rounded-2xl shadow-lg border-2 transition-transform ${
              hasLoopError
                ? 'bg-slate-800 border-red-500/60 text-slate-500 cursor-not-allowed opacity-60'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-300 active:scale-95'
            }`}
            title={hasLoopError ? 'Cannot play: unclosed loop detected' : 'Play'}
          >
            <Play className="w-6 h-6 stroke-[3] ml-0.5" />
          </button>
        )}

        {/* Step Button */}
        <button
          data-testid="btn-step"
          disabled={hasLoopError}
          onClick={step}
          className={`flex items-center justify-center w-12 h-12 rounded-2xl shadow-lg border-2 transition-transform ${
            hasLoopError
              ? 'bg-slate-800 border-red-500/60 text-slate-500 cursor-not-allowed opacity-60'
              : 'bg-sky-600 hover:bg-sky-500 text-white border-sky-400 active:scale-95'
          }`}
          title={hasLoopError ? 'Cannot step: unclosed loop detected' : 'Step'}
        >
          <SkipForward className="w-6 h-6 stroke-[3]" />
        </button>

        {/* Reset Button */}
        <button
          data-testid="btn-reset"
          onClick={reset}
          className="flex items-center justify-center w-12 h-12 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl border-2 border-slate-700 transition-transform active:scale-95"
          title="Reset"
        >
          <RotateCcw className="w-6 h-6 stroke-[2.5]" />
        </button>

        {/* Speed Toggle */}
        <button
          data-testid="btn-speed"
          onClick={toggleSpeed}
          className="flex items-center justify-center gap-1 px-3 h-12 bg-slate-800 hover:bg-slate-700 text-yellow-400 rounded-2xl border-2 border-slate-700 font-black text-sm"
          title="Speed"
        >
          <Zap className="w-4 h-4 fill-yellow-400" />
          <span>{getSpeedLabel()}</span>
        </button>
      </div>

      {/* Right Section: Environment-Specific Toolbar Tools */}
      {ToolsComponent && (
        <ToolsComponent state={currentSimState} />
      )}
    </header>
  );
};

