import React from 'react';
import { useAppStore, EditorTool } from '../../../store/useAppStore';
import { Bot, Square, Flag, Trophy, Eraser } from 'lucide-react';

export const GridToolbarTools: React.FC = () => {
  const { editorTool, setEditorTool } = useAppStore();

  const handleToolClick = (tool: EditorTool) => {
    setEditorTool(editorTool === tool ? 'NONE' : tool);
  };

  return (
    <div className="flex items-center gap-1.5 bg-slate-950/60 p-1.5 rounded-2xl border border-slate-800">
      <button
        data-testid="tool-robot"
        onClick={() => handleToolClick('ROBOT')}
        className={`flex items-center justify-center w-10 h-10 rounded-xl border transition-all ${
          editorTool === 'ROBOT'
            ? 'bg-sky-500 border-sky-300 text-white scale-105'
            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
        }`}
        title="Robot placement tool"
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
        title="Wall barrier tool"
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
        title="Numbered flag tool"
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
  );
};
