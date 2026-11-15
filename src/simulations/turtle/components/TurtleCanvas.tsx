import React, { useRef, useState, useEffect, useId } from 'react';
import { TurtleActiveAnimation, TurtleState } from '../types';
import { getArcSvgPath } from '../physics';
import { SimulationStatus } from '../../../types';
import { isLowQualityActive, useAppStoreSelector } from '../../../store/useAppStore';
import { TurtleToolbarTools } from './TurtleToolbarTools';
import { Infinity as InfinityIcon } from 'lucide-react';

interface TurtleCanvasProps {
  state: TurtleState;
  runtimeStatus?: SimulationStatus;
}

const AIR_TRAIL_FADE_MS = 1000;

interface InkStrokeDescriptor {
  key: string;
  testId: string;
  type: 'LINE' | 'ARC';
  color: string;
  width: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  radius?: number;
  startHeading?: number;
  sweepAngle?: number;
}

interface FadingAirTrail {
  id: number;
  type: 'LINE' | 'ARC';
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  radius?: number;
  startHeading?: number;
  sweepAngle?: number;
}

interface PenUpAnimSnapshot {
  anim: TurtleActiveAnimation;
  type: 'LINE' | 'ARC';
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  radius?: number;
  startHeading?: number;
  sweepAngle?: number;
}

function isWhiteInkColor(color: string): boolean {
  const normalized = color.trim().toLowerCase();
  return normalized === '#ffffff' || normalized === '#fff';
}

function renderInkStroke(
  stroke: InkStrokeDescriptor,
  overrideColor?: string,
  isEraserMaskStroke?: boolean
): React.ReactNode {
  const strokeColor = overrideColor ?? stroke.color;
  const eraserAttr = isEraserMaskStroke ? 'true' : undefined;

  if (stroke.type === 'LINE') {
    return (
      <line
        key={stroke.key}
        data-testid={stroke.testId}
        data-ink-color={stroke.color}
        data-ink-eraser={eraserAttr}
        x1={stroke.fromX}
        y1={stroke.fromY}
        x2={stroke.toX}
        y2={stroke.toY}
        stroke={strokeColor}
        strokeWidth={stroke.width}
        strokeLinecap="round"
      />
    );
  }

  const d = getArcSvgPath({
    fromX: stroke.fromX,
    fromY: stroke.fromY,
    toX: stroke.toX,
    toY: stroke.toY,
    radius: stroke.radius ?? 0,
    startHeading: stroke.startHeading ?? 0,
    sweepAngle: stroke.sweepAngle ?? 0,
  });

  return (
    <path
      key={stroke.key}
      data-testid={stroke.testId}
      data-ink-color={stroke.color}
      data-ink-eraser={eraserAttr}
      d={d}
      fill="none"
      stroke={strokeColor}
      strokeWidth={stroke.width}
      strokeLinecap="round"
    />
  );
}

const TurtleInkLayer = React.memo<{
  paths: TurtleState['paths'];
  activeAnim: TurtleActiveAnimation | null;
  maskIdPrefix: string;
}>(({ paths, activeAnim, maskIdPrefix }) => {
  const strokes: InkStrokeDescriptor[] = [];

  for (let idx = 0; idx < paths.length; idx++) {
    const p = paths[idx];
    if (p.type === 'LINE') {
      strokes.push({
        key: `line-${idx}`,
        testId: `turtle-line-${idx}`,
        type: 'LINE',
        color: p.color,
        width: p.width,
        fromX: p.fromX,
        fromY: p.fromY,
        toX: p.toX,
        toY: p.toY,
      });
    } else if (p.type === 'ARC') {
      strokes.push({
        key: `arc-${idx}`,
        testId: `turtle-arc-${idx}`,
        type: 'ARC',
        color: p.color,
        width: p.width,
        fromX: p.fromX,
        fromY: p.fromY,
        toX: p.toX,
        toY: p.toY,
        radius: p.radius,
        startHeading: p.startHeading,
        sweepAngle: p.sweepAngle,
      });
    }
  }

  if (activeAnim && activeAnim.penDown) {
    if (activeAnim.type === 'LINE') {
      strokes.push({
        key: 'active-line',
        testId: 'turtle-active-line',
        type: 'LINE',
        color: activeAnim.penColor,
        width: activeAnim.penWidth,
        fromX: activeAnim.fromPose.x,
        fromY: activeAnim.fromPose.y,
        toX: activeAnim.currentPose.x,
        toY: activeAnim.currentPose.y,
      });
    } else if (
      activeAnim.type === 'ARC' &&
      activeAnim.radius !== undefined &&
      activeAnim.currentSweep !== undefined
    ) {
      strokes.push({
        key: 'active-arc',
        testId: 'turtle-active-arc',
        type: 'ARC',
        color: activeAnim.penColor,
        width: activeAnim.penWidth,
        fromX: activeAnim.fromPose.x,
        fromY: activeAnim.fromPose.y,
        toX: activeAnim.currentPose.x,
        toY: activeAnim.currentPose.y,
        radius: activeAnim.radius,
        startHeading: activeAnim.fromPose.heading,
        sweepAngle: activeAnim.currentSweep,
      });
    }
  }

  if (strokes.length === 0) {
    return null;
  }

  const hasWhiteEraser = strokes.some((s) => isWhiteInkColor(s.color));
  if (!hasWhiteEraser) {
    return <g data-testid="turtle-ink-layer">{strokes.map((s) => renderInkStroke(s))}</g>;
  }

  // Group strokes into alternating paint / erase runs so `#ffffff` selectively
  // erases ONLY prior strokes via SVG mask compositing (exact strokeWidth,
  // preserving grid/axes underneath and allowing subsequent colored strokes on top).
  const runs: Array<{ isEraser: boolean; items: InkStrokeDescriptor[] }> = [];
  for (const stroke of strokes) {
    const isEraser = isWhiteInkColor(stroke.color);
    const prevRun = runs[runs.length - 1];
    if (prevRun && prevRun.isEraser === isEraser) {
      prevRun.items.push(stroke);
    } else {
      runs.push({ isEraser, items: [stroke] });
    }
  }

  const masks: React.ReactNode[] = [];
  let accumulatedLayer: React.ReactNode = null;
  let maskCounter = 0;

  runs.forEach((run, runIndex) => {
    if (!run.isEraser) {
      const paintGroup = <g key={`paint-${runIndex}`}>{run.items.map((s) => renderInkStroke(s))}</g>;
      accumulatedLayer = accumulatedLayer ? (
        <React.Fragment key={`acc-${runIndex}`}>
          {accumulatedLayer}
          {paintGroup}
        </React.Fragment>
      ) : (
        paintGroup
      );
      return;
    }

    const maskId = `${maskIdPrefix}-${maskCounter++}`;
    masks.push(
      <mask
        key={maskId}
        id={maskId}
        maskUnits="userSpaceOnUse"
        x="-100000"
        y="-100000"
        width="200000"
        height="200000"
      >
        <rect x="-100000" y="-100000" width="200000" height="200000" fill="#ffffff" />
        {run.items.map((s) => renderInkStroke(s, '#000000', true))}
      </mask>
    );
    accumulatedLayer = (
      <g key={`masked-${runIndex}`} mask={`url(#${maskId})`}>
        {accumulatedLayer}
      </g>
    );
  });

  return (
    <g data-testid="turtle-ink-layer">
      <defs>{masks}</defs>
      {accumulatedLayer}
    </g>
  );
});

export const TurtleCanvas: React.FC<TurtleCanvasProps> = ({ state: propState }) => {
  const {
    turtleState,
    updateTurtleViewport,
    speed,
    isLowQuality,
    isLoopPlayback,
    toggleLoopPlayback,
    toggleTurtleVisible,
  } = useAppStoreSelector((s) => ({
    turtleState: s.turtleState,
    updateTurtleViewport: s.updateTurtleViewport,
    speed: s.speed,
    isLowQuality: isLowQualityActive(s),
    isLoopPlayback: s.isLoopPlayback,
    toggleLoopPlayback: s.toggleLoopPlayback,
    toggleTurtleVisible: s.toggleTurtleVisible,
  }));
  const state = propState || turtleState;
  const isInstant = speed === 'instant' || (speed as any) === 0 || state.instantMode;
  const rawMaskId = useId();
  const maskIdPrefix = `turtle-erase-mask-${rawMaskId.replace(/[^a-zA-Z0-9_-]/g, '') || '0'}`;

  const activeAnim = state.activeAnimation;
  const isPenDown = activeAnim ? activeAnim.penDown : state.penDown;
  let teleportScale = 1;
  let teleportOpacity = 1;
  if (activeAnim?.type === 'TELEPORT') {
    const p = Math.max(0, Math.min(1, activeAnim.progress));
    const phase = p < 0.5 ? 1 - p * 2 : (p - 0.5) * 2;
    teleportScale = Math.max(0.05, phase);
    teleportOpacity = Math.max(0, phase);
  }

  const [fadingAirTrails, setFadingAirTrails] = useState<FadingAirTrail[]>([]);
  const airTrailIdRef = useRef(0);
  const prevPenUpAnimRef = useRef<PenUpAnimSnapshot | null>(null);
  const prevPathsLenRef = useRef(state.paths.length);
  const airTrailTimersRef = useRef<number[]>([]);

  useEffect(() => {
    const timers = airTrailTimersRef.current;
    return () => {
      timers.forEach((timerId) => window.clearTimeout(timerId));
      timers.length = 0;
    };
  }, []);

  useEffect(() => {
    const wasCleared = prevPathsLenRef.current > 0 && state.paths.length === 0;
    prevPathsLenRef.current = state.paths.length;

    if (wasCleared) {
      airTrailTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      airTrailTimersRef.current = [];
      prevPenUpAnimRef.current = null;
      setFadingAirTrails([]);
      return;
    }

    const prevSnapshot = prevPenUpAnimRef.current;
    const isCurrentPenUpMove =
      !!activeAnim &&
      !activeAnim.penDown &&
      (activeAnim.type === 'LINE' || activeAnim.type === 'ARC');

    if (prevSnapshot && (!isCurrentPenUpMove || activeAnim !== prevSnapshot.anim)) {
      const dist = Math.hypot(
        prevSnapshot.toX - prevSnapshot.fromX,
        prevSnapshot.toY - prevSnapshot.fromY
      );
      if (dist > 0.5 || Math.abs(prevSnapshot.sweepAngle ?? 0) > 0.5) {
        const trailId = ++airTrailIdRef.current;
        const completedTrail: FadingAirTrail = {
          id: trailId,
          type: prevSnapshot.type,
          fromX: prevSnapshot.fromX,
          fromY: prevSnapshot.fromY,
          toX: prevSnapshot.toX,
          toY: prevSnapshot.toY,
          radius: prevSnapshot.radius,
          startHeading: prevSnapshot.startHeading,
          sweepAngle: prevSnapshot.sweepAngle,
        };
        setFadingAirTrails((prev) => [...prev, completedTrail]);
        const timerId = window.setTimeout(() => {
          setFadingAirTrails((prev) => prev.filter((item) => item.id !== trailId));
          airTrailTimersRef.current = airTrailTimersRef.current.filter((id) => id !== timerId);
        }, AIR_TRAIL_FADE_MS);
        airTrailTimersRef.current.push(timerId);
      }
      prevPenUpAnimRef.current = null;
    }

    if (isCurrentPenUpMove && activeAnim) {
      prevPenUpAnimRef.current = {
        anim: activeAnim,
        type: activeAnim.type as 'LINE' | 'ARC',
        fromX: activeAnim.fromPose.x,
        fromY: activeAnim.fromPose.y,
        toX: activeAnim.currentPose.x,
        toY: activeAnim.currentPose.y,
        radius: activeAnim.radius,
        startHeading: activeAnim.fromPose.heading,
        sweepAngle: activeAnim.currentSweep,
      };
    }
  }, [activeAnim, state.paths.length]);

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

  const liveViewportRef = useRef({
    zoom: effectiveZoom,
    panX: effectivePanX,
    panY: effectivePanY,
  });
  liveViewportRef.current = {
    zoom: effectiveZoom,
    panX: effectivePanX,
    panY: effectivePanY,
  };

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
          zoom: liveViewportRef.current.zoom,
          centerX,
          centerY,
          panX: liveViewportRef.current.panX,
          panY: liveViewportRef.current.panY,
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
        const nextZoom = Math.min(5, Math.max(0.2, pinchStartRef.current.zoom * scaleChange));

        const dx = centerX - pinchStartRef.current.centerX;
        const dy = centerY - pinchStartRef.current.centerY;
        updateTurtleViewport({
          zoom: nextZoom,
          pan: {
            x: pinchStartRef.current.panX + dx,
            y: pinchStartRef.current.panY + dy,
          },
          fitToView: false,
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
  }, [updateTurtleViewport]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: effectivePanX,
      panY: effectivePanY,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (dx === 0 && dy === 0) return;
    updateTurtleViewport({
      pan: {
        x: dragStartRef.current.panX + dx,
        y: dragStartRef.current.panY + dy,
      },
      fitToView: false,
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
    const nextZoom = Math.min(5, Math.max(0.2, effectiveZoom * zoomFactor));
    updateTurtleViewport({
      zoom: nextZoom,
      ...(state.fitToView ? { pan: { x: effectivePanX, y: effectivePanY } } : {}),
      fitToView: false,
    });
  };

  const centerX = containerSize.width / 2 + effectivePanX;
  const centerY = containerSize.height / 2 + effectivePanY;

  const robotPose = state.activeAnimation ? state.activeAnimation.currentPose : state.robot;

  return (
    <div
      ref={containerRef}
      data-testid="turtle-canvas-container"
      data-quality={isLowQuality ? 'low' : 'high'}
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
          {fadingAirTrails.length > 0 && !isLowQuality && (
            <style>{`@keyframes turtleAirTrailFade { from { opacity: 0.85; } to { opacity: 0; } }`}</style>
          )}
        </defs>

        <rect width="100%" height="100%" fill="#ffffff" />
        <rect width="100%" height="100%" fill="url(#turtle-grid)" />

        {/* Viewport Transform Group */}
        <g transform={`translate(${centerX}, ${centerY}) scale(${effectiveZoom})`}>
          {/* Coordinate Crosshairs at (0, 0) */}
          <line x1="-10000" y1="0" x2="10000" y2="0" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />
          <line x1="0" y1="-10000" x2="0" y2="10000" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />
          <circle cx="0" cy="0" r="3" fill="#94a3b8" opacity="0.8" />

          {/* Composited Ink Layer: Committed Paths + Active Pen-Down Stroke (#ffffff erases prior ink cleanly) */}
          <TurtleInkLayer
            paths={state.paths}
            activeAnim={activeAnim ?? null}
            maskIdPrefix={maskIdPrefix}
          />

          {/* Ephemeral Animated PEN_UP Air-Trails (fading ~1s; never persisted to state.paths or SVG thumbnails) */}
          {fadingAirTrails.map((trail) => {
            const fadeStyle: React.CSSProperties = isLowQuality
              ? { opacity: 0.45 }
              : { animation: `turtleAirTrailFade ${AIR_TRAIL_FADE_MS}ms ease-out forwards` };
            if (trail.type === 'LINE') {
              return (
                <line
                  key={`air-trail-${trail.id}`}
                  data-testid={`turtle-air-trail-fading-${trail.id}`}
                  x1={trail.fromX}
                  y1={trail.fromY}
                  x2={trail.toX}
                  y2={trail.toY}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  strokeLinecap="round"
                  style={fadeStyle}
                />
              );
            }
            if (trail.radius !== undefined && trail.sweepAngle !== undefined) {
              return (
                <path
                  key={`air-trail-${trail.id}`}
                  data-testid={`turtle-air-trail-fading-${trail.id}`}
                  d={getArcSvgPath({
                    fromX: trail.fromX,
                    fromY: trail.fromY,
                    toX: trail.toX,
                    toY: trail.toY,
                    radius: trail.radius,
                    startHeading: trail.startHeading ?? 0,
                    sweepAngle: trail.sweepAngle,
                  })}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  strokeLinecap="round"
                  style={fadeStyle}
                />
              );
            }
            return null;
          })}

          {activeAnim && !activeAnim.penDown && (
            activeAnim.type === 'LINE' ? (
              <line
                data-testid="turtle-air-trail"
                x1={activeAnim.fromPose.x}
                y1={activeAnim.fromPose.y}
                x2={activeAnim.currentPose.x}
                y2={activeAnim.currentPose.y}
                fill="none"
                stroke="#94a3b8"
                strokeWidth={2}
                strokeDasharray="4 4"
                strokeLinecap="round"
                opacity={0.85}
              />
            ) : activeAnim.type === 'ARC' &&
              activeAnim.radius !== undefined &&
              activeAnim.currentSweep !== undefined ? (
              <path
                data-testid="turtle-air-trail"
                d={getArcSvgPath({
                  fromX: activeAnim.fromPose.x,
                  fromY: activeAnim.fromPose.y,
                  toX: activeAnim.currentPose.x,
                  toY: activeAnim.currentPose.y,
                  radius: activeAnim.radius,
                  startHeading: activeAnim.fromPose.heading,
                  sweepAngle: activeAnim.currentSweep,
                })}
                fill="none"
                stroke="#94a3b8"
                strokeWidth={2}
                strokeDasharray="4 4"
                strokeLinecap="round"
                opacity={0.85}
              />
            ) : null
          )}

          {/* Robot Turtle Avatar */}
          {state.showTurtle !== false && (
            <g
              data-testid="turtle-robot"
              data-pen-down={isPenDown ? 'true' : 'false'}
              transform={`translate(${robotPose.x}, ${robotPose.y}) rotate(${robotPose.heading}) scale(${teleportScale})`}
              opacity={teleportOpacity}
            >
              {/* Soft ground shadow when PEN_UP lifted */}
              {!isPenDown && (
                <ellipse
                  data-testid="turtle-lift-shadow"
                  cx="0"
                  cy="0"
                  rx="19"
                  ry="18"
                  transform={`rotate(${-robotPose.heading}) translate(3, 6)`}
                  fill="#0f172a"
                  opacity="0.22"
                />
              )}

              <g
                data-testid="turtle-sprite-body"
                transform={isPenDown ? undefined : 'scale(1.12)'}
              >
                {/* Pulsing selection aura (disabled in Instant or Lite mode) */}
                <circle
                  r={22}
                  fill="#38bdf8"
                  opacity="0.15"
                  className={isInstant || isLowQuality ? '' : 'animate-pulse'}
                />

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

                {/* Active Pen Nib Cue: Solid Ink Dot (PEN_DOWN) vs Hollow Lifted Nib (PEN_UP) */}
                {isPenDown ? (
                  <circle
                    data-testid="turtle-pen-nib"
                    data-pen-state="down"
                    r={5.5}
                    fill={state.penColor}
                    stroke={isWhiteInkColor(state.penColor) ? '#94a3b8' : '#ffffff'}
                    strokeWidth={1.5}
                    className="shadow-md"
                  />
                ) : (
                  <g data-testid="turtle-pen-nib" data-pen-state="up">
                    <circle
                      r={5}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth={1.75}
                      strokeDasharray="2.5 2"
                      opacity={0.95}
                    />
                    <circle
                      r={2.5}
                      fill="none"
                      stroke={isWhiteInkColor(state.penColor) ? '#94a3b8' : state.penColor}
                      strokeWidth={1.25}
                    />
                  </g>
                )}
              </g>
            </g>
          )}
        </g>
      </svg>

      {/* Top-Right HUD: Show/Hide Turtle (🐢👁️) & Loop Playback */}
      <div
        className={`absolute top-3 right-3 z-20 flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-700/80 shadow-lg ${
          isLowQuality ? '' : 'backdrop-blur'
        }`}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          data-testid="tool-toggle-turtle"
          onClick={toggleTurtleVisible}
          aria-pressed={state.showTurtle === false}
          title={state.showTurtle === false ? 'Show Turtle' : 'Hide Turtle'}
          aria-label={state.showTurtle === false ? 'Show Turtle' : 'Hide Turtle'}
          className={`relative flex items-center justify-center min-h-9 min-w-9 sm:min-h-11 sm:min-w-11 px-1.5 sm:px-2 rounded-lg border transition-all active:scale-95 cursor-pointer ${
            state.showTurtle === false
              ? 'bg-sky-600 hover:bg-sky-500 border-sky-300 text-white shadow-md'
              : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200 hover:text-white'
          }`}
        >
          <span
            className="relative inline-flex items-center justify-center gap-0.5 text-sm sm:text-base leading-none select-none"
            aria-hidden="true"
          >
            <span>🐢</span>
            <span className={state.showTurtle === false ? 'opacity-65' : ''}>👁️</span>
            {state.showTurtle === false && (
              <svg
                data-testid="toggle-turtle-hidden-slash"
                viewBox="0 0 24 24"
                className="pointer-events-none absolute inset-0 w-full h-full text-red-400"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.75"
                strokeLinecap="round"
              >
                <line x1="3" y1="21" x2="21" y2="3" />
              </svg>
            )}
          </span>
        </button>
        <button
          type="button"
          data-testid="tool-loop-playback"
          onClick={toggleLoopPlayback}
          aria-pressed={isLoopPlayback}
          title={isLoopPlayback ? 'Loop Playback: On' : 'Loop Playback: Off'}
          aria-label={isLoopPlayback ? 'Loop Playback: On' : 'Loop Playback: Off'}
          className={`flex items-center justify-center min-h-9 min-w-9 sm:min-h-11 sm:min-w-11 w-9 h-9 sm:w-11 sm:h-11 rounded-lg border transition-all active:scale-95 cursor-pointer ${
            isLoopPlayback
              ? 'bg-amber-500 hover:bg-amber-400 border-amber-300 text-slate-950 shadow-md'
              : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white'
          }`}
        >
          <InfinityIcon className={`w-4 h-4 sm:w-5 sm:h-5 ${isLoopPlayback ? 'stroke-[2.5]' : 'stroke-[2.25]'}`} />
        </button>
      </div>

      {/* Floating Info Pill: Compact Coordinate, Heading & Pen Indicator */}
      <div
        data-testid="turtle-info-pill"
        className={`absolute bottom-3 left-3 z-20 flex items-center gap-2 px-2.5 py-1.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-[11px] font-mono text-slate-200 pointer-events-none select-none shadow-lg ${
          isLowQuality ? '' : 'backdrop-blur'
        }`}
      >
        <span>
          X: <b className="text-amber-400">{Math.round(robotPose.x)}</b> Y:{' '}
          <b className="text-amber-400">{Math.round(robotPose.y)}</b>
        </span>
        <span className="hidden sm:inline text-slate-500">|</span>
        <span className="hidden sm:inline">
          ∠ <b className="text-sky-400">{Math.round(robotPose.heading)}°</b>
        </span>
        <span
          className={`w-3 h-3 rounded-full border border-white/70 inline-block ${
            state.penDown ? 'shadow-sm' : 'opacity-40'
          }`}
          style={{ backgroundColor: state.penColor }}
          title={state.penDown ? 'Pen Down' : 'Pen Up'}
        />
      </div>

      {/* Floating Viewport Controls (Zoom In/Out, Fit, Reset View) */}
      <div
        className="absolute bottom-3 right-3 z-20"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <TurtleToolbarTools />
      </div>
    </div>
  );
};
