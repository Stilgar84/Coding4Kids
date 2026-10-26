import React, { useRef, useState, useEffect } from 'react';
import { TurtleState } from '../types';
import { SimulationStatus } from '../../../types';
import { useAppStore } from '../../../store/useAppStore';

interface TurtleCanvasProps {
  state: TurtleState;
  runtimeStatus?: SimulationStatus;
}

export const TurtleCanvas: React.FC<TurtleCanvasProps> = () => {
  const { turtleState, updateTurtleViewport } = useAppStore();
  const state = turtleState;

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 600, height: 600 });
  const [isPanning, setIsPanning] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number }>({
    x: 0,
    y: 0,
    panX: 0,
    panY: 0,
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      setContainerSize({
        width: el.clientWidth,
        height: el.clientHeight,
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: state.pan.x,
      panY: state.pan.y,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    updateTurtleViewport({
      pan: {
        x: dragStartRef.current.panX + dx,
        y: dragStartRef.current.panY + dy,
      },
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isPanning) {
      setIsPanning(false);
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const nextZoom = Math.min(5, Math.max(0.2, state.zoom * zoomFactor));
    updateTurtleViewport({ zoom: nextZoom, fitToView: false });
  };

  // Compute transform
  // When fitToView is active, scale automatically fits computedBounds into container
  let effectiveZoom = state.zoom;
  let effectivePanX = state.pan.x;
  let effectivePanY = state.pan.y;

  if (state.fitToView && containerSize.width > 0 && containerSize.height > 0) {
    const bounds = state.computedBounds;
    const boundsWidth = Math.max(100, bounds.maxX - bounds.minX);
    const boundsHeight = Math.max(100, bounds.maxY - bounds.minY);
    const scaleX = (containerSize.width - 64) / boundsWidth;
    const scaleY = (containerSize.height - 64) / boundsHeight;
    effectiveZoom = Math.min(scaleX, scaleY, 2.5);

    const boundsCenterX = (bounds.minX + bounds.maxX) / 2;
    const boundsCenterY = (bounds.minY + bounds.maxY) / 2;
    effectivePanX = -boundsCenterX * effectiveZoom;
    effectivePanY = -boundsCenterY * effectiveZoom;
  }

  const centerX = containerSize.width / 2 + effectivePanX;
  const centerY = containerSize.height / 2 + effectivePanY;

  return (
    <div
      ref={containerRef}
      data-testid="turtle-canvas-container"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      className={`relative w-full h-full overflow-hidden bg-white select-none touch-none ${
        isPanning ? 'cursor-grabbing' : 'cursor-grab'
      }`}
    >
      {/* Background Coordinate Grid & SVG Canvas */}
      <svg
        data-testid="turtle-canvas-svg"
        width="100%"
        height="100%"
        className="w-full h-full overflow-visible block"
      >
        <defs>
          <pattern id="turtle-grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e2e8f0" strokeWidth="1" strokeOpacity="0.8" />
          </pattern>
        </defs>

        <rect width="100%" height="100%" fill="#ffffff" />
        <rect width="100%" height="100%" fill="url(#turtle-grid)" />

        {/* Viewport Transform Group */}
        <g transform={`translate(${centerX}, ${centerY}) scale(${effectiveZoom})`}>
          {/* Coordinate Crosshairs at (0, 0) */}
          <line x1="-10000" y1="0" x2="10000" y2="0" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />
          <line x1="0" y1="-10000" x2="0" y2="10000" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />
          <circle cx="0" cy="0" r="3" fill="#94a3b8" opacity="0.8" />

          {/* Render Paths (Lines and Arcs) */}
          {state.paths.map((p, idx) => {
            if (p.type === 'LINE') {
              return (
                <line
                  key={`line-${idx}`}
                  data-testid={`turtle-line-${idx}`}
                  x1={p.fromX}
                  y1={p.fromY}
                  x2={p.toX}
                  y2={p.toY}
                  stroke={p.color}
                  strokeWidth={p.width}
                  strokeLinecap="round"
                />
              );
            }
            if (p.type === 'ARC') {
              // SVG Arc path:
              // M fromX fromY A radius radius 0 largeArcFlag sweepFlag toX toY
              const largeArcFlag = Math.abs(p.sweepAngle) > 180 ? 1 : 0;
              const sweepFlag = p.sweepAngle > 0 ? 1 : 0;
              const d = `M ${p.fromX} ${p.fromY} A ${p.radius} ${p.radius} 0 ${largeArcFlag} ${sweepFlag} ${p.toX} ${p.toY}`;

              return (
                <path
                  key={`arc-${idx}`}
                  data-testid={`turtle-arc-${idx}`}
                  d={d}
                  fill="none"
                  stroke={p.color}
                  strokeWidth={p.width}
                  strokeLinecap="round"
                />
              );
            }
            return null;
          })}

          {/* Robot Turtle Avatar */}
          <g
            data-testid="turtle-robot"
            transform={`translate(${state.robot.x}, ${state.robot.y}) rotate(${state.robot.heading})`}
            className="transition-transform duration-200"
          >
            {/* Pulsing selection aura */}
            <circle r={22} fill="#38bdf8" opacity="0.15" className="animate-pulse" />

            {/* Turtle Shell / Body */}
            <circle r={18} fill="#0284c7" stroke="#38bdf8" strokeWidth={2.5} className="shadow-lg" />

            {/* Front Head */}
            <ellipse cx="0" cy="-19" rx="6" ry="8" fill="#38bdf8" />

            {/* Flipper Legs */}
            <ellipse cx="-16" cy="-10" rx="4" ry="7" fill="#0369a1" transform="rotate(-30 -16 -10)" />
            <ellipse cx="16" cy="-10" rx="4" ry="7" fill="#0369a1" transform="rotate(30 16 -10)" />
            <ellipse cx="-15" cy="12" rx="3.5" ry="6" fill="#0369a1" transform="rotate(-40 -15 12)" />
            <ellipse cx="15" cy="12" rx="3.5" ry="6" fill="#0369a1" transform="rotate(40 15 12)" />

            {/* Turtle Shell Pattern */}
            <circle r={11} fill="#0369a1" stroke="#0ea5e9" strokeWidth="1.5" />
            <polygon points="0,-8 7,-4 7,4 0,8 -7,4 -7,-4" fill="#0284c7" />

            {/* Eyes */}
            <circle cx="-3" cy="-21" r="1.5" fill="#0f172a" />
            <circle cx="3" cy="-21" r="1.5" fill="#0f172a" />

            {/* Active Pen Indicator in center */}
            <circle
              r={state.penDown ? 5.5 : 4}
              fill={state.penColor}
              stroke="#ffffff"
              strokeWidth={1.5}
              className={state.penDown ? 'shadow-md' : 'opacity-60'}
            />
            {!state.penDown && (
              <line x1="-3" y1="-3" x2="3" y2="3" stroke="#ef4444" strokeWidth="1.5" />
            )}
          </g>
        </g>
      </svg>

      {/* Floating Info Pill: Coordinate & Heading readout */}
      <div
        data-testid="turtle-info-pill"
        className="absolute bottom-4 left-4 z-20 flex items-center gap-3 px-3 py-1.5 bg-slate-900/90 backdrop-blur border border-slate-700/80 rounded-xl text-xs font-mono text-slate-200 pointer-events-none select-none shadow-lg"
      >
        <span>
          X: <b className="text-amber-400">{Math.round(state.robot.x)}</b> Y: <b className="text-amber-400">{Math.round(state.robot.y)}</b>
        </span>
        <span className="text-slate-500">|</span>
        <span>
          ∠ <b className="text-sky-400">{Math.round(state.robot.heading)}°</b>
        </span>
        <span className="text-slate-500">|</span>
        <span className="flex items-center gap-1.5">
          Pen:
          <span
            className="w-3 h-3 rounded-full border border-white/60 inline-block"
            style={{ backgroundColor: state.penColor }}
          />
          <b className={state.penDown ? 'text-emerald-400' : 'text-slate-400'}>
            {state.penDown ? 'DOWN' : 'UP'}
          </b>
        </span>
      </div>
    </div>
  );
};
