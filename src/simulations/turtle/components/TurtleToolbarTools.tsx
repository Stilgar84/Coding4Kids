import React from 'react';
import { isLowQualityActive, useAppStoreSelector } from '../../../store/useAppStore';
import { MIN_TURTLE_ZOOM, MAX_TURTLE_ZOOM } from '../physics';
import { notifyTurtleCameraPinned } from '../types';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Compass,
} from 'lucide-react';

export const TurtleToolbarTools: React.FC = React.memo(() => {
  const { zoom, fitToView, updateTurtleViewport, isLowQuality } = useAppStoreSelector((s) => ({
    zoom: s.turtleState.zoom,
    fitToView: s.turtleState.fitToView,
    updateTurtleViewport: s.updateTurtleViewport,
    isLowQuality: isLowQualityActive(s),
  }));

  const handleZoomIn = () => {
    notifyTurtleCameraPinned(true);
    updateTurtleViewport({
      zoom: Math.min(MAX_TURTLE_ZOOM, Number((zoom * 1.25).toFixed(4))),
      fitToView: false,
    });
  };

  const handleZoomOut = () => {
    notifyTurtleCameraPinned(true);
    updateTurtleViewport({
      zoom: Math.max(MIN_TURTLE_ZOOM, Number((zoom * 0.8).toFixed(4))),
      fitToView: false,
    });
  };

  const handleResetView = () => {
    notifyTurtleCameraPinned(false);
    updateTurtleViewport({
      pan: { x: 0, y: 0 },
      zoom: 1,
      fitToView: false,
    });
  };

  const handleToggleFit = () => {
    notifyTurtleCameraPinned(true);
    updateTurtleViewport({
      fitToView: !fitToView,
    });
  };

  return (
    <div
      className={`flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-700/80 shadow-lg ${
        isLowQuality ? '' : 'backdrop-blur'
      }`}
    >
      {/* Zoom In */}
      <button
        type="button"
        data-testid="tool-zoom-in"
        onClick={handleZoomIn}
        className="flex items-center justify-center min-h-9 min-w-9 sm:min-h-11 sm:min-w-11 w-9 h-9 sm:w-11 sm:h-11 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all active:scale-95"
        title="Zoom In (+)"
        aria-label="Zoom In"
      >
        <ZoomIn className="w-4 h-4 sm:w-5 sm:h-5" />
      </button>

      {/* Zoom Out */}
      <button
        type="button"
        data-testid="tool-zoom-out"
        onClick={handleZoomOut}
        className="flex items-center justify-center min-h-9 min-w-9 sm:min-h-11 sm:min-w-11 w-9 h-9 sm:w-11 sm:h-11 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all active:scale-95"
        title="Zoom Out (-)"
        aria-label="Zoom Out"
      >
        <ZoomOut className="w-4 h-4 sm:w-5 sm:h-5" />
      </button>

      {/* Fit to Content */}
      <button
        type="button"
        data-testid="tool-fit-content"
        onClick={handleToggleFit}
        aria-pressed={fitToView}
        className={`flex items-center justify-center min-h-9 min-w-9 sm:min-h-11 sm:min-w-11 w-9 h-9 sm:w-11 sm:h-11 rounded-lg border transition-all active:scale-95 ${
          fitToView
            ? 'bg-sky-500 border-sky-300 text-white shadow-md'
            : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
        }`}
        title="Fit drawing to view"
        aria-label="Fit drawing to view"
      >
        <Maximize className="w-4 h-4 sm:w-5 sm:h-5" />
      </button>

      {/* Reset Pan/Zoom to Center */}
      <button
        type="button"
        data-testid="tool-reset-view"
        onClick={handleResetView}
        className="flex items-center justify-center min-h-9 min-w-9 sm:min-h-11 sm:min-w-11 w-9 h-9 sm:w-11 sm:h-11 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all active:scale-95"
        title="Reset view (Center at 100%)"
        aria-label="Reset view"
      >
        <Compass className="w-4 h-4 sm:w-5 sm:h-5" />
      </button>
    </div>
  );
});
