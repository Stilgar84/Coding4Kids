import React from 'react';
import { useAppStore } from '../../../store/useAppStore';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Compass,
  RotateCcw,
} from 'lucide-react';

export const TurtleToolbarTools: React.FC = () => {
  const { turtleState, updateTurtleViewport, clearTurtleCanvas } = useAppStore();

  const handleZoomIn = () => {
    updateTurtleViewport({
      zoom: Math.min(5, Number((turtleState.zoom * 1.25).toFixed(2))),
      fitToView: false,
    });
  };

  const handleZoomOut = () => {
    updateTurtleViewport({
      zoom: Math.max(0.2, Number((turtleState.zoom * 0.8).toFixed(2))),
      fitToView: false,
    });
  };

  const handleResetView = () => {
    updateTurtleViewport({
      pan: { x: 0, y: 0 },
      zoom: 1,
      fitToView: false,
    });
  };

  const handleToggleFit = () => {
    updateTurtleViewport({
      fitToView: !turtleState.fitToView,
    });
  };

  return (
    <div className="flex items-center gap-1.5 bg-slate-950/60 p-1.5 rounded-2xl border border-slate-800">
      {/* Zoom In */}
      <button
        data-testid="tool-zoom-in"
        onClick={handleZoomIn}
        className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all active:scale-95"
        title="Zoom In (+)"
      >
        <ZoomIn className="w-5 h-5" />
      </button>

      {/* Zoom Out */}
      <button
        data-testid="tool-zoom-out"
        onClick={handleZoomOut}
        className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all active:scale-95"
        title="Zoom Out (-)"
      >
        <ZoomOut className="w-5 h-5" />
      </button>

      {/* Fit to Content */}
      <button
        data-testid="tool-fit-content"
        onClick={handleToggleFit}
        className={`flex items-center justify-center w-10 h-10 rounded-xl border transition-all active:scale-95 ${
          turtleState.fitToView
            ? 'bg-sky-500 border-sky-300 text-white shadow-md'
            : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
        }`}
        title="Fit drawing to view"
      >
        <Maximize className="w-5 h-5" />
      </button>

      {/* Reset Pan/Zoom to Center */}
      <button
        data-testid="tool-reset-view"
        onClick={handleResetView}
        className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all active:scale-95"
        title="Reset view (Center at 100%)"
      >
        <Compass className="w-5 h-5" />
      </button>

      {/* Clear Drawing Canvas */}
      <button
        data-testid="tool-clear-canvas"
        onClick={clearTurtleCanvas}
        className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-500 transition-all active:scale-95 ml-1"
        title="Clear drawing canvas and reset Turtle to (0, 0)"
      >
        <RotateCcw className="w-5 h-5 text-rose-400" />
      </button>
    </div>
  );
};
