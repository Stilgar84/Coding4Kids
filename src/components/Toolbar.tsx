import React from 'react';
import { useAppStore, EditorTool, PRESET_LEVELS } from '../store/useAppStore';
import { ScopeType } from '../types';
import { validateLoopStructure } from '../engine/interpreter';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Bot,
  Square,
  Flag,
  Trophy,
  Eraser,
  Zap,
} from 'lucide-react';

export const Toolbar: React.FC = () => {
  const {
    currentLevel,
    setLevel,
    isPlaying,
    play,
    pause,
    step,
    reset,
    speed,
    setSpeed,
    editorTool,
    setEditorTool,
    workspace,
  } = useAppStore();

  const hasLoopError = (['MAIN', 'F1', 'F2', 'F3'] as ScopeType[]).some((sc) => {
    return (workspace[sc]?.length ?? 0) > 0 && validateLoopStructure(workspace[sc]).hasError;
  });

  const toggleSpeed = () => {
    if (speed === 400) setSpeed(200);
    else if (speed === 200) setSpeed(100);
    else setSpeed(400);
  };

  const getSpeedLabel = () => {
    if (speed === 100) return '3x';
    if (speed === 200) return '2x';
    return '1x';
  };

  const handleToolClick = (tool: EditorTool) => {
    setEditorTool(editorTool === tool ? 'NONE' : tool);
  };

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900 border-b-2 border-slate-800 shadow-md">
      {/* Level Selection (1, 2, 3) */}
      <div className="flex items-center gap-2">
        {PRESET_LEVELS.map((lvl) => (
          <button
            key={lvl.id}
            data-testid={`btn-level-${lvl.id}`}
            onClick={() => setLevel(lvl.id)}
            className={`flex items-center justify-center w-11 h-11 rounded-2xl font-black text-lg border-2 transition-all ${
              currentLevel === lvl.id
                ? 'bg-amber-500 border-amber-300 text-slate-950 shadow-md scale-105'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
            }`}
          >
            {lvl.id}
          </button>
        ))}
      </div>

      {/* Playback Controls */}
      <div className="flex items-center gap-2">
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

      {/* Grid Editing Tools Palette */}
      <div className="flex items-center gap-1.5 bg-slate-950/60 p-1.5 rounded-2xl border border-slate-800">
        <button
          data-testid="tool-robot"
          onClick={() => handleToolClick('ROBOT')}
          className={`flex items-center justify-center w-10 h-10 rounded-xl border transition-all ${
            editorTool === 'ROBOT'
              ? 'bg-sky-500 border-sky-300 text-white scale-105'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
          }`}
          title="Robot tool"
        >
          <Bot className="w-5 h-5" />
        </button>

        <button
          data-testid="tool-wall"
          onClick={() => handleToolClick('WALL')}
          className={`flex items-center justify-center w-10 h-10 rounded-xl border transition-all ${
            editorTool === 'WALL'
              ? 'bg-red-500 border-red-300 text-white scale-105'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
          }`}
          title="Wall tool"
        >
          <Square className="w-5 h-5 fill-red-400" />
        </button>

        <button
          data-testid="tool-flag"
          onClick={() => handleToolClick('FLAG')}
          className={`flex items-center justify-center w-10 h-10 rounded-xl border transition-all ${
            editorTool === 'FLAG'
              ? 'bg-blue-500 border-blue-300 text-white scale-105'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
          }`}
          title="Flag tool"
        >
          <Flag className="w-5 h-5 fill-blue-400" />
        </button>

        <button
          data-testid="tool-goal"
          onClick={() => handleToolClick('GOAL')}
          className={`flex items-center justify-center w-10 h-10 rounded-xl border transition-all ${
            editorTool === 'GOAL'
              ? 'bg-yellow-500 border-yellow-300 text-slate-950 scale-105'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
          }`}
          title="Goal tool"
        >
          <Trophy className="w-5 h-5 fill-yellow-400" />
        </button>

        <button
          data-testid="tool-erase"
          onClick={() => handleToolClick('ERASE')}
          className={`flex items-center justify-center w-10 h-10 rounded-xl border transition-all ${
            editorTool === 'ERASE'
              ? 'bg-rose-500 border-rose-300 text-white scale-105'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
          }`}
          title="Erase tool"
        >
          <Eraser className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};
