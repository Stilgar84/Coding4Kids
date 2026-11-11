import React from 'react';
import { useAppStore } from '../../../store/useAppStore';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Compass,
} from 'lucide-react';

export const TurtleToolbarTools: React.FC = () => {
  useAppStore();
  const { turtleState, updateTurtleViewport } = useAppStore.getState();

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
    <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur p-1 rounded-xl border border-slate-700/80 shadow-lg">
      {/* Zoom In */}
      <button
        type="button"
        data-testid="tool-zoom-in"
        onClick={handleZoomIn}
        className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all active:scale-95"
        title="Zoom In (+)"
        aria-label="Zoom In"
      >
        <ZoomIn className="w-4 h-4" />
      </button>

      {/* Zoom Out */}
      <button
        type="button"
        data-testid="tool-zoom-out"
        onClick={handleZoomOut}
        className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all active:scale-95"
        title="Zoom Out (-)"
        aria-label="Zoom Out"
      >
        <ZoomOut className="w-4 h-4" />
      </button>

      {/* Fit to Content */}
      <button
        type="button"
        data-testid="tool-fit-content"
        onClick={handleToggleFit}
        aria-pressed={turtleState.fitToView}
        className={`flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg border transition-all active:scale-95 ${
          turtleState.fitToView
            ? 'bg-sky-500 border-sky-300 text-white shadow-md'
            : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
        }`}
        title="Fit drawing to view"
        aria-label="Fit drawing to view"
      >
        <Maximize className="w-4 h-4" />
      </button>

      {/* Reset Pan/Zoom to Center */}
      <button
        type="button"
        data-testid="tool-reset-view"
        onClick={handleResetView}
        className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all active:scale-95"
        title="Reset view (Center at 100%)"
        aria-label="Reset view"
      >
        <Compass className="w-4 h-4" />
      </button>
    </div>
  );
};
