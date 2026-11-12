import React, { useState, useEffect, useRef } from 'react';
import { useAppStoreSelector, isLowQualityActive } from '../store/useAppStore';
import { WallEdge, Direction } from '../types';
import { Trophy, Footprints, Maximize2, Minimize2, Lock } from 'lucide-react';
import { GridOverlayLayer } from '../simulations/grid/components/GridOverlayLayer';
import { FlagPadlockOverlay } from '../simulations/grid/components/FlagPadlockOverlay';
import { GhostStepOverlay } from '../simulations/grid/components/GhostStepOverlay';
import { DemoSpotlightOverlay } from '../simulations/grid/components/DemoSpotlightOverlay';
import { WorldItemsLayer, BackpackHud } from '../simulations/grid/components/WorldItemsLayer';

const CELL_SIZE = 72; // pixels per cell

interface GridStaticBoardLayerProps {
  width: number;
  height: number;
  barriers: WallEdge[];
  isReadOnly: boolean;
  isLowQuality: boolean;
  setCellContent: (x: number, y: number) => void;
  handleCellMouseDown: (x: number, y: number) => void;
  handleCellMouseEnter: (x: number, y: number, e: React.MouseEvent) => void;
  handleEdgeMouseDown: (edge: WallEdge, e: React.MouseEvent) => void;
  handleEdgeMouseEnter: (edge: WallEdge, e: React.MouseEvent) => void;
  handleEdgeClick: (edge: WallEdge, e: React.MouseEvent) => void;
}

const GridStaticBoardLayer = React.memo<GridStaticBoardLayerProps>(
  ({
    width,
    height,
    barriers,
    isReadOnly,
    isLowQuality,
    setCellContent,
    handleCellMouseDown,
    handleCellMouseEnter,
    handleEdgeMouseDown,
    handleEdgeMouseEnter,
    handleEdgeClick,
  }) => {
    const wallShadowClass = isLowQuality ? '' : 'filter drop-shadow-[0_0_8px_rgba(239,68,68,0.8)] ';
    return (
      <>
        {/* Grid Background cells */}
        {Array.from({ length: height }).map((_, y) =>
          Array.from({ length: width }).map((_, x) => (
            <rect
              key={`cell-${x}-${y}`}
              data-testid={`cell-${x}-${y}`}
              x={x * CELL_SIZE}
              y={y * CELL_SIZE}
              width={CELL_SIZE}
              height={CELL_SIZE}
              fill={(x + y) % 2 === 0 ? '#1e293b' : '#0f172a'}
              stroke="#334155"
              strokeWidth={1}
              className={
                isReadOnly
                  ? undefined
                  : 'cursor-pointer transition-colors hover:fill-slate-700/50'
              }
              onClick={isReadOnly ? undefined : () => setCellContent(x, y)}
              onMouseDown={isReadOnly ? undefined : () => handleCellMouseDown(x, y)}
              onMouseEnter={isReadOnly ? undefined : (e) => handleCellMouseEnter(x, y, e)}
            />
          ))
        )}

        {/* Horizontal Barrier Wall Hitboxes & Lines */}
        {Array.from({ length: height - 1 }).map((_, row) =>
          Array.from({ length: width }).map((_, col) => {
            const y = row + 1;
            const hasWall = barriers.some(
              (b) => b.orientation === 'H' && b.x === col && b.y === y
            );
            if (isReadOnly && !hasWall) return null;
            return (
              <g key={`h-wall-${col}-${y}`}>
                {!isReadOnly && (
                  <rect
                    data-testid={`wall-h-hitbox-${col}-${y}`}
                    x={col * CELL_SIZE}
                    y={y * CELL_SIZE - 14}
                    width={CELL_SIZE}
                    height={28}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseDown={(e) => handleEdgeMouseDown({ orientation: 'H', x: col, y }, e)}
                    onMouseEnter={(e) => handleEdgeMouseEnter({ orientation: 'H', x: col, y }, e)}
                    onClick={(e) => handleEdgeClick({ orientation: 'H', x: col, y }, e)}
                  />
                )}
                {hasWall && (
                  <rect
                    data-testid={`wall-h-${col}-${y}`}
                    x={col * CELL_SIZE + 2}
                    y={y * CELL_SIZE - 4}
                    width={CELL_SIZE - 4}
                    height={8}
                    rx={4}
                    fill="#ef4444"
                    className={`${wallShadowClass}${
                      isReadOnly ? 'pointer-events-none' : 'cursor-pointer'
                    }`}
                    onMouseDown={
                      isReadOnly
                        ? undefined
                        : (e) => handleEdgeMouseDown({ orientation: 'H', x: col, y }, e)
                    }
                    onMouseEnter={
                      isReadOnly
                        ? undefined
                        : (e) => handleEdgeMouseEnter({ orientation: 'H', x: col, y }, e)
                    }
                    onClick={
                      isReadOnly
                        ? undefined
                        : (e) => handleEdgeClick({ orientation: 'H', x: col, y }, e)
                    }
                  />
                )}
              </g>
            );
          })
        )}

        {/* Vertical Barrier Wall Hitboxes & Lines */}
        {Array.from({ length: height }).map((_, row) =>
          Array.from({ length: width - 1 }).map((_, col) => {
            const x = col + 1;
            const hasWall = barriers.some(
              (b) => b.orientation === 'V' && b.x === x && b.y === row
            );
            if (isReadOnly && !hasWall) return null;
            return (
              <g key={`v-wall-${x}-${row}`}>
                {!isReadOnly && (
                  <rect
                    data-testid={`wall-v-hitbox-${x}-${row}`}
                    x={x * CELL_SIZE - 14}
                    y={row * CELL_SIZE}
                    width={28}
                    height={CELL_SIZE}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseDown={(e) => handleEdgeMouseDown({ orientation: 'V', x, y: row }, e)}
                    onMouseEnter={(e) => handleEdgeMouseEnter({ orientation: 'V', x, y: row }, e)}
                    onClick={(e) => handleEdgeClick({ orientation: 'V', x, y: row }, e)}
                  />
                )}
                {hasWall && (
                  <rect
                    data-testid={`wall-v-${x}-${row}`}
                    x={x * CELL_SIZE - 4}
                    y={row * CELL_SIZE + 2}
                    width={8}
                    height={CELL_SIZE - 4}
                    rx={4}
                    fill="#ef4444"
                    className={`${wallShadowClass}${
                      isReadOnly ? 'pointer-events-none' : 'cursor-pointer'
                    }`}
                    onMouseDown={
                      isReadOnly
                        ? undefined
                        : (e) => handleEdgeMouseDown({ orientation: 'V', x, y: row }, e)
                    }
                    onMouseEnter={
                      isReadOnly
                        ? undefined
                        : (e) => handleEdgeMouseEnter({ orientation: 'V', x, y: row }, e)
                    }
                    onClick={
                      isReadOnly
                        ? undefined
                        : (e) => handleEdgeClick({ orientation: 'V', x, y: row }, e)
                    }
                  />
                )}
              </g>
            );
          })
        )}
      </>
    );
  },
  (prev, next) => {
    if (
      prev.width !== next.width ||
      prev.height !== next.height ||
      prev.barriers !== next.barriers ||
      prev.isReadOnly !== next.isReadOnly ||
      prev.isLowQuality !== next.isLowQuality
    ) {
      return false;
    }
    // In read-only mode (curriculum / running playback), handlers are unused.
    if (next.isReadOnly) return true;
    return (
      prev.setCellContent === next.setCellContent &&
      prev.handleCellMouseDown === next.handleCellMouseDown &&
      prev.handleCellMouseEnter === next.handleCellMouseEnter &&
      prev.handleEdgeMouseDown === next.handleEdgeMouseDown &&
      prev.handleEdgeMouseEnter === next.handleEdgeMouseEnter &&
      prev.handleEdgeClick === next.handleEdgeClick
    );
  }
);

export const GridCanvas: React.FC = () => {
  const {
    appMode,
    grid,
    runtime,
    toggleWall,
    addWall,
    resizeBoard,
    setCellContent,
    toggleTrace,
    toggleFitToView,
    editorTool,
    speed,
    startHistoryBatch,
    endHistoryBatch,
    isLowQuality,
  } = useAppStoreSelector((s) => ({
    appMode: s.appMode,
    grid: s.grid,
    runtime: s.runtime,
    toggleWall: s.toggleWall,
    addWall: s.addWall,
    resizeBoard: s.resizeBoard,
    setCellContent: s.setCellContent,
    toggleTrace: s.toggleTrace,
    toggleFitToView: s.toggleFitToView,
    editorTool: s.editorTool,
    speed: s.speed,
    startHistoryBatch: s.startHistoryBatch,
    endHistoryBatch: s.endHistoryBatch,
    isLowQuality: isLowQualityActive(s),
  }));

  const isReadOnly = appMode === 'curriculum';
  const isInstant = speed === 'instant' || (speed as any) === 0;

  const handleToggleFit = () => {
    setUserZoom(1);
    setPanOffset({ x: 0, y: 0 });
    toggleFitToView();
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      setUserZoom((prev) => Math.min(3.5, Math.max(0.4, prev * factor)));
    }
  };

  const { width, height, robot, barriers, flags, trace, status, showTrace, fitToView } = grid;
  const isBarrierMode = editorTool === 'WALL';
  const isFitToView = Boolean(fitToView);

  const svgWidth = width * CELL_SIZE;
  const svgHeight = height * CELL_SIZE;
  const boardBaseWidth = svgWidth + 24;
  const boardBaseHeight = svgHeight + 24;
  const CLEARANCE = 48; // Clearance for boundary resize handles and indicators
  const unscaledTotalWidth = boardBaseWidth + CLEARANCE;
  const unscaledTotalHeight = boardBaseHeight + CLEARANCE;

  // Viewport container measurement for fit-to-view calculation
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [userZoom, setUserZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  const pinchStartRef = useRef<{
    dist: number;
    zoom: number;
    centerX: number;
    centerY: number;
    panX: number;
    panY: number;
  } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const centerX = (t1.clientX + t2.clientX) / 2;
        const centerY = (t1.clientY + t2.clientY) / 2;
        pinchStartRef.current = {
          dist,
          zoom: userZoom,
          centerX,
          centerY,
          panX: panOffset.x,
          panY: panOffset.y,
        };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchStartRef.current) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const centerX = (t1.clientX + t2.clientX) / 2;
        const centerY = (t1.clientY + t2.clientY) / 2;

        const scaleChange = dist / pinchStartRef.current.dist;
        const nextZoom = Math.min(3.5, Math.max(0.4, pinchStartRef.current.zoom * scaleChange));
        setUserZoom(nextZoom);

        const dx = centerX - pinchStartRef.current.centerX;
        const dy = centerY - pinchStartRef.current.centerY;
        setPanOffset({
          x: pinchStartRef.current.panX + dx,
          y: pinchStartRef.current.panY + dy,
        });
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        pinchStartRef.current = null;
      }
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [userZoom, panOffset]);

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

  const availableWidth = Math.max(containerSize.width - 32, 100);
  const availableHeight = Math.max(containerSize.height - 32, 100);
  const computedScale = Math.min(
    availableWidth / unscaledTotalWidth,
    availableHeight / unscaledTotalHeight
  );
  const scale =
    containerSize.width > 0 && containerSize.height > 0
      ? Math.max(0.1, Math.min(2.0, computedScale))
      : 1;

  // Barrier drag drawing tracking
  const [isDrawingBarriers, setIsDrawingBarriers] = useState(false);
  const dragStartEdgeRef = useRef<WallEdge | null>(null);
  const hasMovedToOtherEdgesRef = useRef(false);
  const edgeExistedAtMouseDownRef = useRef(false);
  const lastCellRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const handleMouseUp = () => {
      setIsDrawingBarriers(false);
      dragStartEdgeRef.current = null;
      lastCellRef.current = null;
      endHistoryBatch();
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [endHistoryBatch]);

  // Handle clicking or dragging on an edge
  const handleEdgeMouseDown = (edge: WallEdge, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isBarrierMode) {
      startHistoryBatch('Draw walls');
      setIsDrawingBarriers(true);
      dragStartEdgeRef.current = edge;
      hasMovedToOtherEdgesRef.current = false;
      const exists = barriers.some(
        (b) => b.orientation === edge.orientation && b.x === edge.x && b.y === edge.y
      );
      edgeExistedAtMouseDownRef.current = exists;
      if (!exists) {
        addWall(edge);
      }
    }
  };

  const handleEdgeMouseEnter = (edge: WallEdge, e: React.MouseEvent) => {
    if (isBarrierMode && (isDrawingBarriers || e.buttons === 1)) {
      if (!isDrawingBarriers) {
        startHistoryBatch('Draw walls');
        setIsDrawingBarriers(true);
      }
      hasMovedToOtherEdgesRef.current = true;
      addWall(edge);
    }
  };

  const handleEdgeClick = (edge: WallEdge, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isBarrierMode) {
      // If user dragged over other edges, do not toggle off the initial edge
      if (hasMovedToOtherEdgesRef.current) {
        return;
      }
      // If edge existed at mousedown, stationary click toggles it off
      if (edgeExistedAtMouseDownRef.current) {
        toggleWall(edge);
      }
    } else {
      toggleWall(edge);
    }
  };

  // Cross-cell dragging to create barrier between adjacent cells
  const handleCellMouseDown = (x: number, y: number) => {
    lastCellRef.current = { x, y };
    if (isBarrierMode) {
      startHistoryBatch('Draw walls');
      setIsDrawingBarriers(true);
      hasMovedToOtherEdgesRef.current = false;
    }
  };

  const handleCellMouseEnter = (x: number, y: number, e: React.MouseEvent) => {
    if (isBarrierMode && (isDrawingBarriers || e.buttons === 1)) {
      if (lastCellRef.current) {
        const lx = lastCellRef.current.x;
        const ly = lastCellRef.current.y;
        if (x === lx + 1 && y === ly) {
          addWall({ orientation: 'V', x, y: ly });
          hasMovedToOtherEdgesRef.current = true;
        } else if (x === lx - 1 && y === ly) {
          addWall({ orientation: 'V', x: lx, y: ly });
          hasMovedToOtherEdgesRef.current = true;
        } else if (y === ly + 1 && x === lx) {
          addWall({ orientation: 'H', x: lx, y });
          hasMovedToOtherEdgesRef.current = true;
        } else if (y === ly - 1 && x === lx) {
          addWall({ orientation: 'H', x: lx, y: ly });
          hasMovedToOtherEdgesRef.current = true;
        }
      }
      lastCellRef.current = { x, y };
    }
  };

  // Drag resizing of board boundaries
  const startResizeDrag = (
    direction: 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT',
    e: React.PointerEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();
    startHistoryBatch('Resize board');
    const startX = e.clientX;
    const startY = e.clientY;
    let accumulatedDelta = 0;
    const currentScale = isFitToView ? scale : 1;
    const stepSize = CELL_SIZE * currentScale * 0.7;

    const onPointerMove = (moveEv: PointerEvent) => {
      moveEv.preventDefault();
      const dx = moveEv.clientX - startX;
      const dy = moveEv.clientY - startY;

      let currentStep = 0;
      if (direction === 'RIGHT') {
        currentStep = Math.trunc(dx / stepSize);
      } else if (direction === 'BOTTOM') {
        currentStep = Math.trunc(dy / stepSize);
      } else if (direction === 'LEFT') {
        currentStep = Math.trunc(-dx / stepSize);
      } else if (direction === 'TOP') {
        currentStep = Math.trunc(-dy / stepSize);
      }

      const diff = currentStep - accumulatedDelta;
      if (diff !== 0) {
        resizeBoard(direction, diff);
        accumulatedDelta = currentStep;
      }
    };

    const onPointerUp = (upEv: PointerEvent) => {
      upEv.preventDefault();
      endHistoryBatch();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  // Robot rotation angle
  const getAngle = (dir: Direction): number => {
    switch (dir) {
      case 'NORTH':
        return 0;
      case 'EAST':
        return 90;
      case 'SOUTH':
        return 180;
      case 'WEST':
        return 270;
    }
  };

  return (
    <div
      data-quality={isLowQuality ? 'low' : 'high'}
      className="relative w-full h-full overflow-hidden bg-slate-950/60 select-none"
    >
      {/* Top-Left Non-Overlapping HUD Stack: 1-Slot Backpack + Runtime Variables */}
      <div className="absolute top-3 left-3 z-20 flex flex-col items-start gap-1.5 pointer-events-none">
        <BackpackHud grid={grid} stacked />
        {runtime?.variables && Object.keys(runtime.variables).length > 0 && (
          <div
            data-testid="toolbar-variables"
            className={`flex items-center gap-1.5 px-2.5 py-1 bg-slate-900/90 ${isLowQuality ? '' : 'backdrop-blur '}border border-indigo-500/50 rounded-xl text-xs shadow-lg`}
          >
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider">
              VARS
            </span>
            {Object.entries(runtime.variables).map(([k, v]) => (
              <span
                key={k}
                data-testid={`var-badge-${k}`}
                className="px-1.5 py-0.5 rounded bg-indigo-950/90 border border-indigo-500/40 font-mono font-bold text-indigo-200"
              >
                {k}={v}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Simulation status banner if collision or victory */}
      {status === 'COLLISION' && (
        <div
          data-testid="status-collision"
          className={`absolute top-4 left-1/2 -translate-x-1/2 z-20 px-6 py-2 bg-red-600/90 text-white rounded-full font-bold shadow-lg shadow-red-500/30 ${isLowQuality ? '' : 'animate-bounce '}flex items-center gap-2 pointer-events-none`}
        >
          <span className="text-xl">💥</span>
        </div>
      )}

      {status === 'SUCCESS' && (
        <div
          data-testid="status-success"
          className={`absolute top-4 left-1/2 -translate-x-1/2 z-20 px-6 py-2 bg-amber-500 text-slate-900 rounded-full font-extrabold shadow-lg shadow-amber-500/40 ${isLowQuality ? '' : 'animate-pulse '}flex items-center gap-2 pointer-events-none`}
        >
          <Trophy className="w-6 h-6" />
          <span className="text-xl">⭐ ⭐ ⭐</span>
        </div>
      )}

      {/* Scrollable Viewport Container for the Grid Map */}
      <div
        ref={containerRef}
        data-testid="grid-scroll-container"
        onWheel={handleWheel}
        className="w-full h-full overflow-auto flex touch-none"
      >
        <div
          data-testid="grid-fit-wrapper"
          className="m-auto shrink-0 flex items-center justify-center transition-all duration-200"
          style={
            isFitToView
              ? {
                  width: `${unscaledTotalWidth * scale}px`,
                  height: `${unscaledTotalHeight * scale}px`,
                  overflow: 'visible',
                }
              : {
                  padding: '2rem',
                }
          }
        >
          <div
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${
                (isFitToView ? scale : 1) * userZoom
              })`,
              transformOrigin: 'center center',
            }}
            className="shrink-0 transition-transform duration-200"
          >
            {/* SVG Grid Container with Boundary Drag Handles */}
            <div className="relative p-2 bg-slate-900 rounded-2xl border-4 border-slate-800 shadow-2xl">
        {/* Grid dimensions pill + Read-only indicator in Curriculum mode */}
        <div className="absolute -top-3.5 -right-3.5 z-30 flex items-center gap-1.5 select-none">
          {isReadOnly && (
            <div
              data-testid="grid-readonly-badge"
              aria-label="Read-only lesson map"
              title="Read-only lesson map — use Open Copy in Sandbox to edit"
              className="flex items-center justify-center w-6 h-6 bg-slate-800 border-2 border-sky-500/60 rounded-full text-sky-300 shadow-md"
            >
              <Lock className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="sr-only">Read-only lesson map</span>
            </div>
          )}
          <div
            data-testid="grid-size-indicator"
            className="px-2.5 py-0.5 bg-slate-800 border-2 border-slate-700 rounded-full text-[11px] font-black text-amber-300 shadow-md"
          >
            {width} × {height}
          </div>
        </div>

        {/* Boundary Resize Handles (Sandbox mode only) */}
        {!isReadOnly && (
          <>
            {/* Top Boundary Resize Handle */}
            <div
              data-testid="resize-handle-top"
              onPointerDown={(e) => startResizeDrag('TOP', e)}
              className="group absolute -top-4 left-6 right-6 h-6 cursor-ns-resize flex items-center justify-center z-30 select-none"
              title="Drag top boundary to resize board"
            >
              <div className="flex items-center gap-1 px-3 py-0.5 rounded-full bg-slate-800/90 border border-slate-600 group-hover:border-amber-400 group-hover:bg-slate-700 text-slate-400 group-hover:text-amber-300 shadow-md transition-colors">
                <span className="text-[10px] font-black">▲</span>
                <button
                  type="button"
                  data-testid="btn-resize-top-plus"
                  onClick={(e) => {
                    e.stopPropagation();
                    resizeBoard('TOP', 1);
                  }}
                  className="text-xs font-black hover:text-white px-0.5"
                  title="Add row at top"
                >
                  +
                </button>
                <span className="text-[10px] font-black">▼</span>
              </div>
            </div>

            {/* Bottom Boundary Resize Handle */}
            <div
              data-testid="resize-handle-bottom"
              onPointerDown={(e) => startResizeDrag('BOTTOM', e)}
              className="group absolute -bottom-4 left-6 right-6 h-6 cursor-ns-resize flex items-center justify-center z-30 select-none"
              title="Drag bottom boundary to resize board"
            >
              <div className="flex items-center gap-1 px-3 py-0.5 rounded-full bg-slate-800/90 border border-slate-600 group-hover:border-amber-400 group-hover:bg-slate-700 text-slate-400 group-hover:text-amber-300 shadow-md transition-colors">
                <span className="text-[10px] font-black">▲</span>
                <button
                  type="button"
                  data-testid="btn-resize-bottom-plus"
                  onClick={(e) => {
                    e.stopPropagation();
                    resizeBoard('BOTTOM', 1);
                  }}
                  className="text-xs font-black hover:text-white px-0.5"
                  title="Add row at bottom"
                >
                  +
                </button>
                <span className="text-[10px] font-black">▼</span>
              </div>
            </div>

            {/* Left Boundary Resize Handle */}
            <div
              data-testid="resize-handle-left"
              onPointerDown={(e) => startResizeDrag('LEFT', e)}
              className="group absolute -left-4 top-6 bottom-6 w-6 cursor-ew-resize flex items-center justify-center z-30 select-none"
              title="Drag left boundary to resize board"
            >
              <div className="flex flex-col items-center gap-0.5 py-2 px-1 rounded-full bg-slate-800/90 border border-slate-600 group-hover:border-amber-400 group-hover:bg-slate-700 text-slate-400 group-hover:text-amber-300 shadow-md transition-colors">
                <span className="text-[10px] font-black">◀</span>
                <button
                  type="button"
                  data-testid="btn-resize-left-plus"
                  onClick={(e) => {
                    e.stopPropagation();
                    resizeBoard('LEFT', 1);
                  }}
                  className="text-xs font-black hover:text-white py-0.5"
                  title="Add column at left"
                >
                  +
                </button>
                <span className="text-[10px] font-black">▶</span>
              </div>
            </div>

            {/* Right Boundary Resize Handle */}
            <div
              data-testid="resize-handle-right"
              onPointerDown={(e) => startResizeDrag('RIGHT', e)}
              className="group absolute -right-4 top-6 bottom-6 w-6 cursor-ew-resize flex items-center justify-center z-30 select-none"
              title="Drag right boundary to resize board"
            >
              <div className="flex flex-col items-center gap-0.5 py-2 px-1 rounded-full bg-slate-800/90 border border-slate-600 group-hover:border-amber-400 group-hover:bg-slate-700 text-slate-400 group-hover:text-amber-300 shadow-md transition-colors">
                <span className="text-[10px] font-black">◀</span>
                <button
                  type="button"
                  data-testid="btn-resize-right-plus"
                  onClick={(e) => {
                    e.stopPropagation();
                    resizeBoard('RIGHT', 1);
                  }}
                  className="text-xs font-black hover:text-white py-0.5"
                  title="Add column at right"
                >
                  +
                </button>
                <span className="text-[10px] font-black">▶</span>
              </div>
            </div>
          </>
        )}

        <svg
          data-testid="grid-canvas"
          width={svgWidth}
          height={svgHeight}
          className="overflow-visible block"
        >
          <GridStaticBoardLayer
            width={width}
            height={height}
            barriers={barriers}
            isReadOnly={isReadOnly}
            isLowQuality={isLowQuality}
            setCellContent={setCellContent}
            handleCellMouseDown={handleCellMouseDown}
            handleCellMouseEnter={handleCellMouseEnter}
            handleEdgeMouseDown={handleEdgeMouseDown}
            handleEdgeMouseEnter={handleEdgeMouseEnter}
            handleEdgeClick={handleEdgeClick}
          />

          {/* Pluggable Under-Robot Overlay Slot (World Items — Commit 14) */}
          <GridOverlayLayer
            grid={grid}
            cellSize={CELL_SIZE}
            isInstant={isInstant}
            isReadOnly={isReadOnly}
            layer="under-robot"
            worldItemsSlot={
              <WorldItemsLayer
                grid={grid}
                cellSize={CELL_SIZE}
                isInstant={isInstant}
              />
            }
          />

          {/* Trace Path Line */}
          {showTrace && trace.length > 1 && (
            <polyline
              data-testid="robot-trace"
              points={trace
                .map((pt) => `${pt.x * CELL_SIZE + CELL_SIZE / 2},${pt.y * CELL_SIZE + CELL_SIZE / 2}`)
                .join(' ')}
              fill="none"
              stroke="#38bdf8"
              strokeWidth={4}
              strokeDasharray="6 6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-80"
            />
          )}

          {/* Flags and Goals */}
          {flags.map((flag) => {
            const cx = flag.x * CELL_SIZE + CELL_SIZE / 2;
            const cy = flag.y * CELL_SIZE + CELL_SIZE / 2;
            return (
              <g
                key={flag.id}
                data-testid={flag.isGoal ? `goal-flag-${flag.x}-${flag.y}` : `flag-${flag.order}`}
                transform={`translate(${cx}, ${cy})`}
                className={`pointer-events-none ${isInstant || isLowQuality ? '' : 'transition-transform duration-300'}`}
              >
                {flag.isGoal ? (
                  <g className={flag.collected ? 'scale-125 opacity-90' : (isInstant || isLowQuality ? '' : 'animate-pulse')}>
                    <circle r={22} fill="#eab308" className={isLowQuality ? undefined : 'shadow-lg'} />
                    <circle r={18} fill="#ca8a04" />
                    <foreignObject x={-14} y={-14} width={28} height={28}>
                      <div className="flex items-center justify-center w-full h-full text-slate-950 font-black">
                        🏁
                      </div>
                    </foreignObject>
                  </g>
                ) : (
                  <g className={flag.collected ? 'opacity-30 scale-75' : 'scale-100'}>
                    <circle
                      r={18}
                      fill={flag.collected ? '#64748b' : '#3b82f6'}
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                    <text
                      y={5}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize={16}
                      fontWeight="bold"
                    >
                      {flag.order}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Robot Representation */}
          <g
            data-testid="robot"
            transform={`translate(${robot.x * CELL_SIZE + CELL_SIZE / 2}, ${
              robot.y * CELL_SIZE + CELL_SIZE / 2
            })`}
            className={`pointer-events-none ${isInstant || isLowQuality ? '' : 'transition-transform duration-300 ease-out'}`}
          >
            {/* Rotate robot to face direction */}
            <g transform={`rotate(${getAngle(robot.dir)})`}>
              {/* Outer halo */}
              <circle
                r={24}
                fill="#0284c7"
                className={`opacity-30 ${isInstant || isLowQuality ? '' : 'animate-pulse'}`}
              />
              {/* Robot body base */}
              <circle
                r={20}
                fill={status === 'COLLISION' ? '#dc2626' : '#0ea5e9'}
                stroke="#ffffff"
                strokeWidth={3}
                className={isLowQuality ? undefined : 'drop-shadow-md'}
              />
              {/* Directional Arrow Pointer */}
              <polygon
                points="0,-16 7,-3 -7,-3"
                fill="#ffffff"
              />
              {/* Eyes */}
              <circle cx={-6} cy={3} r={3} fill="#0f172a" />
              <circle cx={6} cy={3} r={3} fill="#0f172a" />
            </g>
          </g>

          {/* Pluggable Over-Robot Overlay Slots (Flag Padlocks C6, Ghost Step C7, Demo Spotlights C8a) */}
          <GridOverlayLayer
            grid={grid}
            cellSize={CELL_SIZE}
            isInstant={isInstant}
            isReadOnly={isReadOnly}
            layer="over-robot"
            flagPadlockSlot={
              <FlagPadlockOverlay
                grid={grid}
                cellSize={CELL_SIZE}
                isInstant={isInstant}
              />
            }
            ghostStepSlot={<GhostStepOverlay cellSize={CELL_SIZE} />}
            demoSpotlightSlot={
              <DemoSpotlightOverlay
                grid={grid}
                cellSize={CELL_SIZE}
                isInstant={isInstant}
              />
            }
          />
        </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Controls Overlay: Trajectory button and Fit Toggle button (Fixed in place) */}
      <div className="absolute bottom-4 right-4 z-30 flex flex-col items-center gap-2 pointer-events-auto">
        {/* Toggle Fit to Screen Button */}
        <button
          data-testid="btn-toggle-fit"
          onClick={handleToggleFit}
          className={`p-3 rounded-2xl shadow-lg border-2 transition-all ${
            isFitToView
              ? 'bg-sky-500 border-sky-300 text-white shadow-sky-500/30'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500'
          }`}
          title={isFitToView ? 'Reset to Actual Size (100%)' : 'Fit to Available Size'}
        >
          {isFitToView ? <Minimize2 className="w-6 h-6" /> : <Maximize2 className="w-6 h-6" />}
        </button>

        {/* Floating Trace / Trajectory Toggle Button */}
        <button
          data-testid="btn-toggle-trace"
          onClick={toggleTrace}
          className={`p-3 rounded-2xl shadow-lg border-2 transition-all ${
            showTrace
              ? 'bg-sky-500 border-sky-300 text-white shadow-sky-500/30'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500'
          }`}
          title="Trace"
        >
          <Footprints className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
