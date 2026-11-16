import React, { useRef, useState, useEffect, useId } from 'react';
import {
  TurtleActiveAnimation,
  TurtleState,
  subscribeTurtleCameraPinned,
} from '../types';
import {
  DEFAULT_TURTLE_CANVAS_BOUNDS,
  MIN_TURTLE_ZOOM,
  MAX_TURTLE_ZOOM,
  combineTurtleBoundsWithPose,
  computeAutoFitOverflowViewport,
  getArcSvgPath,
  getTurtleGridStep,
  getVisibleTurtleWorldBounds,
} from '../physics';
import { SimulationStatus, WorkspaceState } from '../../../types';
import {
  isLowQualityActive,
  isTerminalErrorStatus,
  useAppStore,
  useAppStoreSelector,
} from '../../../store/useAppStore';
import { resolveActiveCurriculumActivity } from '../../../utils/curriculumStagePolicy';
import { TurtleToolbarTools } from './TurtleToolbarTools';
import { Infinity as InfinityIcon, Sparkles } from 'lucide-react';

export function screenToTurtleWorld(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  panX: number,
  panY: number,
  zoom: number
): { x: number; y: number } {
  const safeZoom = Math.max(MIN_TURTLE_ZOOM, zoom);
  const centerX = rect.width / 2 + panX;
  const centerY = rect.height / 2 + panY;
  const localX = clientX - rect.left;
  const localY = clientY - rect.top;
  return {
    x: Math.round((localX - centerX) / safeZoom),
    y: Math.round((localY - centerY) / safeZoom),
  };
}

function valueContainsTurtlePointerRef(val: unknown): boolean {
  if (val === '$pointerX' || val === '$pointerY' || val === '$pointerDown') return true;
  if (!val || typeof val !== 'object') return false;
  for (const child of Object.values(val as Record<string, unknown>)) {
    if (valueContainsTurtlePointerRef(child)) return true;
  }
  return false;
}

export function workspaceUsesTurtlePointerOrTap(workspace?: WorkspaceState | null): boolean {
  if (!workspace) return false;
  if ((workspace.ON_TAP?.length ?? 0) > 0) return true;
  for (const blocks of Object.values(workspace)) {
    if (!Array.isArray(blocks)) continue;
    for (const b of blocks) {
      if (valueContainsTurtlePointerRef(b.repeatCount) || valueContainsTurtlePointerRef(b.params)) {
        return true;
      }
    }
  }
  return false;
}

const TURTLE_TERMINAL_GLYPHS: Partial<Record<SimulationStatus, string>> = {
  COLLISION: '💥',
  TYPE_ERROR: '🎨≠#',
  MATH_ERROR: '🧮÷0',
  STACK_OVERFLOW: '📚💥',
  STEP_LIMIT: '⏳🔁',
  DEADLOCK: '🔒💥',
};

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

export interface CompletedAirTrail {
  type: 'LINE' | 'ARC';
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  radius?: number;
  startHeading?: number;
  sweepAngle?: number;
}

export interface PenUpMoveSnapshot {
  moveKey: string;
  type: 'LINE' | 'ARC';
  penDown: boolean;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  radius?: number;
  startHeading?: number;
  sweepAngle?: number;
  lastProgress: number;
}

export interface PenUpAirTrailTransition {
  nextSnapshot: PenUpMoveSnapshot | null;
  emittedTrail: CompletedAirTrail | null;
  clearExistingTrails: boolean;
}

/**
 * Stable identity key for a logical PEN_UP motion segment so cloned
 * per-frame `activeAnimation` objects do not emit duplicate trails.
 */
export function getPenUpMoveKey(anim: TurtleActiveAnimation): string {
  return [
    anim.type,
    anim.penDown ? '1' : '0',
    anim.fromPose.x,
    anim.fromPose.y,
    anim.fromPose.heading,
    anim.toPose.x,
    anim.toPose.y,
    anim.radius ?? '',
    anim.sweepAngle ?? '',
  ].join('|');
}

function snapshotToCompletedAirTrail(snapshot: PenUpMoveSnapshot): CompletedAirTrail | null {
  const dist = Math.hypot(snapshot.toX - snapshot.fromX, snapshot.toY - snapshot.fromY);
  if (dist <= 0.5 && Math.abs(snapshot.sweepAngle ?? 0) <= 0.5) {
    return null;
  }
  return {
    type: snapshot.type,
    fromX: snapshot.fromX,
    fromY: snapshot.fromY,
    toX: snapshot.toX,
    toY: snapshot.toY,
    radius: snapshot.radius,
    startHeading: snapshot.startHeading,
    sweepAngle: snapshot.sweepAngle,
  };
}

/**
 * Reconciles `PEN_UP` air-trail tracking across RAF frames, move completion,
 * and reset/rewind transitions.
 */
export function reconcilePenUpAirTrailState(
  prevSnapshot: PenUpMoveSnapshot | null,
  activeAnim: TurtleActiveAnimation | null,
  state: Pick<TurtleState, 'status' | 'paths' | 'penDown' | 'robot'>,
  prevPathsLen: number
): PenUpAirTrailTransition {
  const wasCleared = prevPathsLen > 0 && state.paths.length === 0;
  const isResetToOrigin =
    state.status === 'IDLE' &&
    !activeAnim &&
    state.paths.length === 0 &&
    state.penDown === true &&
    state.robot.x === 0 &&
    state.robot.y === 0 &&
    state.robot.heading === 0 &&
    (prevSnapshot === null ||
      prevSnapshot.toX !== 0 ||
      prevSnapshot.toY !== 0 ||
      prevSnapshot.lastProgress < 0.99);

  if (wasCleared || isResetToOrigin) {
    return {
      nextSnapshot: null,
      emittedTrail: null,
      clearExistingTrails: true,
    };
  }

  const isCurrentPenUpMove =
    !!activeAnim &&
    !activeAnim.penDown &&
    (activeAnim.type === 'LINE' || activeAnim.type === 'ARC');

  if (isCurrentPenUpMove && activeAnim) {
    const moveKey = getPenUpMoveKey(activeAnim);
    if (
      prevSnapshot &&
      prevSnapshot.moveKey === moveKey &&
      activeAnim.progress >= prevSnapshot.lastProgress
    ) {
      return {
        nextSnapshot: {
          ...prevSnapshot,
          lastProgress: activeAnim.progress,
        },
        emittedTrail: null,
        clearExistingTrails: false,
      };
    }

    return {
      nextSnapshot: {
        moveKey,
        type: activeAnim.type as 'LINE' | 'ARC',
        penDown: activeAnim.penDown,
        fromX: activeAnim.fromPose.x,
        fromY: activeAnim.fromPose.y,
        toX: activeAnim.toPose.x,
        toY: activeAnim.toPose.y,
        radius: activeAnim.radius,
        startHeading: activeAnim.fromPose.heading,
        sweepAngle: activeAnim.sweepAngle,
        lastProgress: activeAnim.progress,
      },
      emittedTrail: prevSnapshot ? snapshotToCompletedAirTrail(prevSnapshot) : null,
      clearExistingTrails: false,
    };
  }

  return {
    nextSnapshot: null,
    emittedTrail: prevSnapshot ? snapshotToCompletedAirTrail(prevSnapshot) : null,
    clearExistingTrails: false,
  };
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

export const TurtleCanvas: React.FC<TurtleCanvasProps> = ({
  state: propState,
  runtimeStatus: propRuntimeStatus,
}) => {
  const {
    turtleState,
    updateTurtleViewport,
    speed,
    isLowQuality,
    isPlaying,
    isLoopPlayback,
    toggleLoopPlayback,
    setLoopPlayback,
    toggleTurtleVisible,
    appMode,
    activeActivityId,
    activeActivityVersion,
    workspace,
    pointerState,
    setPointerState,
    enqueueInteractiveEvent,
    hasMultiVariant,
  } = useAppStoreSelector((s) => ({
    turtleState: s.turtleState,
    updateTurtleViewport: s.updateTurtleViewport,
    speed: s.speed,
    isLowQuality: isLowQualityActive(s),
    isPlaying: s.isPlaying,
    isLoopPlayback: s.isLoopPlayback,
    toggleLoopPlayback: s.toggleLoopPlayback,
    setLoopPlayback: s.setLoopPlayback,
    toggleTurtleVisible: s.toggleTurtleVisible,
    appMode: s.appMode,
    activeActivityId: s.activeActivityId,
    activeActivityVersion: s.activeActivityVersion,
    workspace: s.workspace,
    pointerState: s.pointerState,
    setPointerState: s.setPointerState,
    enqueueInteractiveEvent: s.enqueueInteractiveEvent,
    hasMultiVariant: s.variantRuns.length > 1,
  }));
  const state = propState || turtleState;
  const effectiveStatus: SimulationStatus = isTerminalErrorStatus(state.status)
    ? state.status
    : isTerminalErrorStatus(propRuntimeStatus)
    ? (propRuntimeStatus as SimulationStatus)
    : state.status;
  const activeActivity = resolveActiveCurriculumActivity(
    appMode,
    activeActivityId,
    activeActivityVersion
  );
  const isCurriculumLiveMode = activeActivity?.turtle?.mode === 'live';
  const isLiveModeActive = state.mode === 'live' || isCurriculumLiveMode;
  const showLiveToggle = appMode === 'sandbox' || isCurriculumLiveMode;
  const workspaceUsesPointer = workspaceUsesTurtlePointerOrTap(workspace);
  const isInteractivePointerActive = isLiveModeActive || workspaceUsesPointer;
  const shouldCaptureLivePointer = isPlaying && isInteractivePointerActive;
  const hasInsideCanvasSensor = Boolean(
    activeActivity?.palette?.allowedSensors?.includes('insideCanvas')
  );
  const showSafeFrame = Boolean(
    state.canvasBounds ||
      state.showCanvasBounds ||
      activeActivity?.turtle?.showCanvasBounds ||
      hasInsideCanvasSensor
  );
  const safeFrameBounds =
    state.canvasBounds ??
    activeActivity?.turtle?.canvasBounds ??
    DEFAULT_TURTLE_CANVAS_BOUNDS;
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

  const [lingeringTeleportFx, setLingeringTeleportFx] = useState<{
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  } | null>(null);
  const prevTeleportAnimRef = useRef<TurtleActiveAnimation | null>(null);
  const teleportTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (teleportTimerRef.current !== null) {
        window.clearTimeout(teleportTimerRef.current);
        teleportTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (activeAnim?.type === 'TELEPORT') {
      prevTeleportAnimRef.current = activeAnim;
      return;
    }
    if (prevTeleportAnimRef.current) {
      const completed = prevTeleportAnimRef.current;
      prevTeleportAnimRef.current = null;
      if (!isLowQuality) {
        setLingeringTeleportFx({
          fromX: completed.fromPose.x,
          fromY: completed.fromPose.y,
          toX: completed.toPose.x,
          toY: completed.toPose.y,
        });
        if (teleportTimerRef.current !== null) {
          window.clearTimeout(teleportTimerRef.current);
        }
        teleportTimerRef.current = window.setTimeout(() => {
          teleportTimerRef.current = null;
          setLingeringTeleportFx(null);
        }, 280);
      }
    }
  }, [activeAnim, isLowQuality]);

  const [tapRipple, setTapRipple] = useState<{ id: number; x: number; y: number } | null>(null);
  const tapRippleTimerRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (tapRippleTimerRef.current !== null) {
        window.clearTimeout(tapRippleTimerRef.current);
        tapRippleTimerRef.current = null;
      }
    };
  }, []);

  const [fadingAirTrails, setFadingAirTrails] = useState<FadingAirTrail[]>([]);
  const airTrailIdRef = useRef(0);
  const prevPenUpAnimRef = useRef<PenUpMoveSnapshot | null>(null);
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
    const prevPathsLen = prevPathsLenRef.current;
    prevPathsLenRef.current = state.paths.length;

    const transition = reconcilePenUpAirTrailState(
      prevPenUpAnimRef.current,
      activeAnim ?? null,
      state,
      prevPathsLen
    );
    prevPenUpAnimRef.current = transition.nextSnapshot;

    if (transition.clearExistingTrails) {
      if (airTrailTimersRef.current.length > 0) {
        airTrailTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
        airTrailTimersRef.current = [];
      }
      setFadingAirTrails((prev) => (prev.length > 0 ? [] : prev));
      return;
    }

    if (transition.emittedTrail) {
      const trailId = ++airTrailIdRef.current;
      const completedTrail: FadingAirTrail = {
        id: trailId,
        ...transition.emittedTrail,
      };
      setFadingAirTrails((prev) => [...prev, completedTrail]);
      const timerId = window.setTimeout(() => {
        setFadingAirTrails((prev) => prev.filter((item) => item.id !== trailId));
        airTrailTimersRef.current = airTrailTimersRef.current.filter((id) => id !== timerId);
      }, AIR_TRAIL_FADE_MS);
      airTrailTimersRef.current.push(timerId);
    }
  }, [activeAnim, state.paths.length, state.status, state.penDown, state.robot.x, state.robot.y, state.robot.heading]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 600, height: 600 });
  const [isPanning, setIsPanning] = useState(false);
  const [isTrackingLivePointer, setIsTrackingLivePointer] = useState(false);
  const isTrackingLivePointerRef = useRef(false);
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

  const userPinnedCameraRef = useRef(false);
  const autoFittedByCanvasRef = useRef(false);
  const hasRunActivityRef = useRef(false);

  useEffect(() => {
    return subscribeTurtleCameraPinned((pinned) => {
      userPinnedCameraRef.current = pinned;
      if (!pinned) {
        autoFittedByCanvasRef.current = false;
      }
    });
  }, []);

  useEffect(() => {
    const isInitialOrigin =
      state.paths.length === 0 &&
      !state.activeAnimation &&
      Math.abs(state.robot.x) < 1e-6 &&
      Math.abs(state.robot.y) < 1e-6;

    if (!isInitialOrigin) {
      hasRunActivityRef.current = true;
      return;
    }

    if (hasRunActivityRef.current && state.status !== 'RUNNING') {
      hasRunActivityRef.current = false;
      const shouldRestoreCamera = autoFittedByCanvasRef.current && !userPinnedCameraRef.current;
      userPinnedCameraRef.current = false;
      autoFittedByCanvasRef.current = false;
      if (
        shouldRestoreCamera &&
        (Math.abs(state.zoom - 1) > 1e-4 ||
          Math.abs(state.pan.x) > 0.5 ||
          Math.abs(state.pan.y) > 0.5)
      ) {
        updateTurtleViewport({ pan: { x: 0, y: 0 }, zoom: 1, fitToView: false });
      }
    }
  }, [
    state.paths.length,
    state.activeAnimation,
    state.robot.x,
    state.robot.y,
    state.status,
    state.zoom,
    state.pan.x,
    state.pan.y,
    updateTurtleViewport,
  ]);

  useEffect(() => {
    if (
      state.fitToView ||
      userPinnedCameraRef.current ||
      containerSize.width <= 0 ||
      containerSize.height <= 0
    ) {
      return;
    }
    const activePose = state.activeAnimation ? state.activeAnimation.currentPose : state.robot;
    const hasContent =
      state.paths.length > 0 ||
      Boolean(state.activeAnimation) ||
      Math.abs(activePose.x) > 1e-6 ||
      Math.abs(activePose.y) > 1e-6;
    if (!hasContent) return;

    const combinedBounds = combineTurtleBoundsWithPose(state.computedBounds, activePose);
    const nextViewport = computeAutoFitOverflowViewport(
      combinedBounds,
      containerSize.width,
      containerSize.height,
      state.zoom,
      state.pan
    );
    if (!nextViewport) return;

    const zoomChanged = Math.abs(nextViewport.zoom - state.zoom) > 0.0005;
    const panChanged =
      Math.abs(nextViewport.pan.x - state.pan.x) > 0.5 ||
      Math.abs(nextViewport.pan.y - state.pan.y) > 0.5;
    if (zoomChanged || panChanged) {
      autoFittedByCanvasRef.current = true;
      updateTurtleViewport({
        zoom: nextViewport.zoom,
        pan: nextViewport.pan,
        fitToView: false,
      });
    }
  }, [
    state.fitToView,
    state.paths.length,
    state.computedBounds,
    state.activeAnimation,
    state.robot.x,
    state.robot.y,
    state.zoom,
    state.pan.x,
    state.pan.y,
    containerSize.width,
    containerSize.height,
    updateTurtleViewport,
  ]);

  // Compute transform
  // When fitToView is active, scale automatically fits computedBounds into container
  let effectiveZoom = state.zoom;
  let effectivePanX = state.pan.x;
  let effectivePanY = state.pan.y;

  if (state.fitToView && containerSize.width > 0 && containerSize.height > 0) {
    const bounds = state.computedBounds;
    const boundsWidth = Math.max(100, bounds.maxX - bounds.minX);
    const boundsHeight = Math.max(100, bounds.maxY - bounds.minY);
    const scaleX = Math.max(16, containerSize.width - 64) / boundsWidth;
    const scaleY = Math.max(16, containerSize.height - 64) / boundsHeight;
    effectiveZoom = Math.max(MIN_TURTLE_ZOOM, Math.min(scaleX, scaleY, 2.5));

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
        if (isTrackingLivePointerRef.current) {
          isTrackingLivePointerRef.current = false;
          setIsTrackingLivePointer(false);
          setPointerState({ isDown: false });
        }
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
        const nextZoom = Math.min(
          MAX_TURTLE_ZOOM,
          Math.max(MIN_TURTLE_ZOOM, pinchStartRef.current.zoom * scaleChange)
        );
        userPinnedCameraRef.current = true;

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
  }, [updateTurtleViewport, setPointerState]);

  const computeEventWorldCoords = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect() ?? {
      left: 0,
      top: 0,
      width: containerSize.width || 600,
      height: containerSize.height || 600,
    };
    return screenToTurtleWorld(
      clientX,
      clientY,
      rect,
      effectivePanX,
      effectivePanY,
      effectiveZoom
    );
  };

  const handleToggleLiveMode = () => {
    if (appMode !== 'sandbox') return;
    const current = useAppStore.getState().turtleState;
    const nextLive = current.mode !== 'live';
    useAppStore.setState({
      turtleState: {
        ...current,
        mode: nextLive ? 'live' : 'static',
        clearBetweenFrames: current.clearBetweenFrames ?? true,
        instantMode: nextLive,
      },
    });
    setLoopPlayback(nextLive);
  };

  const handleToggleClearBetweenFrames = () => {
    if (appMode !== 'sandbox') return;
    const current = useAppStore.getState().turtleState;
    const nextClear = current.clearBetweenFrames === false;
    useAppStore.setState({
      turtleState: {
        ...current,
        clearBetweenFrames: nextClear,
      },
    });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if (pinchStartRef.current) return;

    if (shouldCaptureLivePointer) {
      const world = computeEventWorldCoords(e.clientX, e.clientY);
      isTrackingLivePointerRef.current = true;
      setIsTrackingLivePointer(true);
      setPointerState({ x: world.x, y: world.y, isDown: true });
      enqueueInteractiveEvent('ON_TAP');
      if (!isLowQuality) {
        const rippleId = Date.now();
        setTapRipple({ id: rippleId, x: world.x, y: world.y });
        if (tapRippleTimerRef.current !== null) {
          window.clearTimeout(tapRippleTimerRef.current);
        }
        tapRippleTimerRef.current = window.setTimeout(() => {
          tapRippleTimerRef.current = null;
          setTapRipple((curr) => (curr?.id === rippleId ? null : curr));
        }, 320);
      }
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      return;
    }

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
    if (pinchStartRef.current) return;

    if (isTrackingLivePointerRef.current) {
      const world = computeEventWorldCoords(e.clientX, e.clientY);
      setPointerState({ x: world.x, y: world.y, isDown: true });
      return;
    }

    if (!isPanning) {
      if (isInteractivePointerActive) {
        const world = computeEventWorldCoords(e.clientX, e.clientY);
        setPointerState({ x: world.x, y: world.y, isDown: false });
      }
      return;
    }

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (dx === 0 && dy === 0) return;
    userPinnedCameraRef.current = true;
    updateTurtleViewport({
      pan: {
        x: dragStartRef.current.panX + dx,
        y: dragStartRef.current.panY + dy,
      },
      fitToView: false,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isTrackingLivePointerRef.current) {
      const world = computeEventWorldCoords(e.clientX, e.clientY);
      isTrackingLivePointerRef.current = false;
      setIsTrackingLivePointer(false);
      setPointerState({ x: world.x, y: world.y, isDown: false });
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      return;
    }
    if (isPanning) {
      setIsPanning(false);
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const nextZoom = Math.min(MAX_TURTLE_ZOOM, Math.max(MIN_TURTLE_ZOOM, effectiveZoom * zoomFactor));
    userPinnedCameraRef.current = true;
    updateTurtleViewport({
      zoom: nextZoom,
      ...(state.fitToView ? { pan: { x: effectivePanX, y: effectivePanY } } : {}),
      fitToView: false,
    });
  };

  const safeZoom = Math.max(MIN_TURTLE_ZOOM, effectiveZoom);
  const gridStep = getTurtleGridStep(safeZoom);
  const visibleWorldBounds = getVisibleTurtleWorldBounds(
    containerSize.width,
    containerSize.height,
    effectivePanX,
    effectivePanY,
    safeZoom,
    120
  );
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
        shouldCaptureLivePointer || isTrackingLivePointer
          ? 'cursor-crosshair'
          : isPanning
          ? 'cursor-grabbing'
          : 'cursor-grab'
      }`}
    >
      {/* Top-Center Zero-Reading Terminal Status Pill */}
      {TURTLE_TERMINAL_GLYPHS[effectiveStatus] && (
        <div
          data-testid="turtle-terminal-status"
          data-terminal-status={effectiveStatus}
          className={`absolute ${hasMultiVariant ? 'top-14' : 'top-3'} left-1/2 -translate-x-1/2 z-20 px-5 py-1.5 bg-rose-600/95 text-white rounded-full font-black shadow-lg pointer-events-none`}
        >
          <span className="text-base">{TURTLE_TERMINAL_GLYPHS[effectiveStatus]}</span>
        </div>
      )}
      {/* Background Coordinate Grid & SVG Canvas */}
      <svg
        data-testid="turtle-canvas-svg"
        width="100%"
        height="100%"
        className="w-full h-full overflow-visible block"
      >
        <defs>
          <pattern
            id="turtle-grid"
            data-grid-step={gridStep}
            width={gridStep}
            height={gridStep}
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${centerX}, ${centerY}) scale(${safeZoom})`}
          >
            <path
              d={`M ${gridStep} 0 L 0 0 0 ${gridStep}`}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth={1 / safeZoom}
              strokeOpacity="0.8"
            />
          </pattern>
          {fadingAirTrails.length > 0 && !isLowQuality && (
            <style>{`@keyframes turtleAirTrailFade { from { opacity: 0.85; } to { opacity: 0; } }`}</style>
          )}
        </defs>

        <rect width="100%" height="100%" fill="#ffffff" />
        <rect width="100%" height="100%" fill="url(#turtle-grid)" />

        {/* Viewport Transform Group */}
        <g transform={`translate(${centerX}, ${centerY}) scale(${safeZoom})`}>
          {/* Optional Nominal 600x480 Paper Bounds Safe-Frame */}
          {showSafeFrame && (
            <rect
              data-testid="turtle-canvas-bounds"
              data-bounds-width={safeFrameBounds.halfWidth * 2}
              data-bounds-height={safeFrameBounds.halfHeight * 2}
              x={-safeFrameBounds.halfWidth}
              y={-safeFrameBounds.halfHeight}
              width={safeFrameBounds.halfWidth * 2}
              height={safeFrameBounds.halfHeight * 2}
              fill="none"
              stroke="#94a3b8"
              strokeWidth={1.25 / safeZoom}
              strokeDasharray={`${6 / safeZoom} ${4 / safeZoom}`}
              opacity={0.72}
              pointerEvents="none"
            />
          )}

          {/* Coordinate Crosshairs at (0, 0) spanning visible viewport */}
          <line
            data-testid="turtle-axis-x"
            x1={visibleWorldBounds.minX}
            y1={0}
            x2={visibleWorldBounds.maxX}
            y2={0}
            stroke="#cbd5e1"
            strokeWidth={1 / safeZoom}
            strokeDasharray={`${4 / safeZoom} ${4 / safeZoom}`}
            opacity="0.6"
          />
          <line
            data-testid="turtle-axis-y"
            x1={0}
            y1={visibleWorldBounds.minY}
            x2={0}
            y2={visibleWorldBounds.maxY}
            stroke="#cbd5e1"
            strokeWidth={1 / safeZoom}
            strokeDasharray={`${4 / safeZoom} ${4 / safeZoom}`}
            opacity="0.6"
          />
          <circle cx="0" cy="0" r={3 / safeZoom} fill="#94a3b8" opacity="0.8" />

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
                strokeWidth={2 / safeZoom}
                strokeDasharray={`${4 / safeZoom} ${4 / safeZoom}`}
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
                strokeWidth={2 / safeZoom}
                strokeDasharray={`${4 / safeZoom} ${4 / safeZoom}`}
                strokeLinecap="round"
                opacity={0.85}
              />
            ) : null
          )}

          {/* TELEPORT Departure Flash + Landing Target Crosshair Ring */}
          {(activeAnim?.type === 'TELEPORT' || lingeringTeleportFx) && (() => {
            const fromX =
              activeAnim?.type === 'TELEPORT'
                ? activeAnim.fromPose.x
                : lingeringTeleportFx!.fromX;
            const fromY =
              activeAnim?.type === 'TELEPORT'
                ? activeAnim.fromPose.y
                : lingeringTeleportFx!.fromY;
            const toX =
              activeAnim?.type === 'TELEPORT'
                ? activeAnim.toPose.x
                : lingeringTeleportFx!.toX;
            const toY =
              activeAnim?.type === 'TELEPORT'
                ? activeAnim.toPose.y
                : lingeringTeleportFx!.toY;
            const p =
              activeAnim?.type === 'TELEPORT'
                ? Math.max(0, Math.min(1, activeAnim.progress))
                : 1;
            const flashOpacity = activeAnim?.type === 'TELEPORT' ? Math.max(0.25, 1 - p * 0.8) : 0.35;
            const ringScale = activeAnim?.type === 'TELEPORT' ? 0.65 + p * 0.55 : 1.25;

            return (
              <g pointerEvents="none">
                <g
                  data-testid="turtle-teleport-departure-flash"
                  transform={`translate(${fromX}, ${fromY}) scale(${1 / safeZoom})`}
                  opacity={flashOpacity}
                >
                  <circle r={18} fill="#38bdf8" fillOpacity={0.22} stroke="#0ea5e9" strokeWidth={2} />
                  {[0, 45, 90, 135].map((deg) => (
                    <line
                      key={deg}
                      x1={-24}
                      y1={0}
                      x2={24}
                      y2={0}
                      stroke="#0284c7"
                      strokeWidth={2}
                      strokeLinecap="round"
                      transform={`rotate(${deg})`}
                    />
                  ))}
                </g>

                <g
                  data-testid="turtle-teleport-landing-ring"
                  transform={`translate(${toX}, ${toY}) scale(${ringScale / safeZoom})`}
                  opacity={activeAnim?.type === 'TELEPORT' ? Math.max(0.4, p) : 0.45}
                >
                  <circle
                    r={22}
                    fill="none"
                    stroke="#0ea5e9"
                    strokeWidth={2.2}
                    strokeDasharray="5 3"
                  />
                  <circle r={12} fill="#38bdf8" fillOpacity={0.18} stroke="#0284c7" strokeWidth={1.6} />
                  <line x1={-28} y1={0} x2={-17} y2={0} stroke="#0284c7" strokeWidth={2} strokeLinecap="round" />
                  <line x1={17} y1={0} x2={28} y2={0} stroke="#0284c7" strokeWidth={2} strokeLinecap="round" />
                  <line x1={0} y1={-28} x2={0} y2={-17} stroke="#0284c7" strokeWidth={2} strokeLinecap="round" />
                  <line x1={0} y1={17} x2={0} y2={28} stroke="#0284c7" strokeWidth={2} strokeLinecap="round" />
                </g>
              </g>
            );
          })()}

          {/* Interactive Live Mode Pointer Reticle & Tap Ripple */}
          {isInteractivePointerActive && (
            <g
              data-testid="turtle-pointer-reticle"
              transform={`translate(${pointerState.x}, ${pointerState.y}) scale(${1 / safeZoom})`}
              pointerEvents="none"
            >
              <circle
                r={pointerState.isDown ? 13 : 10}
                fill={pointerState.isDown ? '#f59e0b' : 'none'}
                fillOpacity={pointerState.isDown ? 0.2 : 0}
                stroke={pointerState.isDown ? '#f59e0b' : '#64748b'}
                strokeWidth={1.8}
                strokeDasharray={pointerState.isDown ? undefined : '3 2'}
              />
              <line x1={-6} y1={0} x2={6} y2={0} stroke={pointerState.isDown ? '#d97706' : '#64748b'} strokeWidth={1.4} />
              <line x1={0} y1={-6} x2={0} y2={6} stroke={pointerState.isDown ? '#d97706' : '#64748b'} strokeWidth={1.4} />
            </g>
          )}

          {tapRipple && (
            <g
              data-testid="turtle-tap-ripple"
              transform={`translate(${tapRipple.x}, ${tapRipple.y}) scale(${1 / safeZoom})`}
              pointerEvents="none"
            >
              <circle r={22} fill="none" stroke="#f59e0b" strokeWidth={2.4} opacity={0.75} />
            </g>
          )}

          {/* Robot Turtle Avatar (zoom-independent block-sized ~28x32px footprint) */}
          {state.showTurtle !== false && (
            <g
              data-testid="turtle-robot"
              data-pen-down={isPenDown ? 'true' : 'false'}
              transform={`translate(${robotPose.x}, ${robotPose.y}) rotate(${robotPose.heading}) scale(${teleportScale / safeZoom})`}
              opacity={teleportOpacity}
            >
              {/* Soft ground shadow when PEN_UP lifted */}
              {!isPenDown && (
                <ellipse
                  data-testid="turtle-lift-shadow"
                  cx="0"
                  cy="0"
                  rx="13"
                  ry="12.5"
                  transform={`rotate(${-robotPose.heading}) translate(2, 4)`}
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
                  r={16}
                  fill="#38bdf8"
                  opacity="0.15"
                  className={isInstant || isLowQuality ? '' : 'animate-pulse'}
                />

                {/* Turtle Shell / Body */}
                <circle r={12} fill="#0284c7" stroke="#38bdf8" strokeWidth={1.8} className="shadow-lg" />

                {/* Front Head */}
                <ellipse cx="0" cy="-13" rx="4.2" ry="5.5" fill="#38bdf8" />

                {/* Flipper Legs */}
                <ellipse cx="-11" cy="-7" rx="2.8" ry="4.8" fill="#0369a1" transform="rotate(-30 -11 -7)" />
                <ellipse cx="11" cy="-7" rx="2.8" ry="4.8" fill="#0369a1" transform="rotate(30 11 -7)" />
                <ellipse cx="-10" cy="8.5" rx="2.5" ry="4.2" fill="#0369a1" transform="rotate(-40 -10 8.5)" />
                <ellipse cx="10" cy="8.5" rx="2.5" ry="4.2" fill="#0369a1" transform="rotate(40 10 8.5)" />

                {/* Turtle Shell Pattern */}
                <circle r={7.5} fill="#0369a1" stroke="#0ea5e9" strokeWidth="1.1" />
                <polygon points="0,-5.5 4.8,-2.8 4.8,2.8 0,5.5 -4.8,2.8 -4.8,-2.8" fill="#0284c7" />

                {/* Eyes */}
                <circle cx="-2" cy="-14.5" r="1.1" fill="#0f172a" />
                <circle cx="2" cy="-14.5" r="1.1" fill="#0f172a" />

                {/* Active Pen Nib Cue: Solid Ink Dot (PEN_DOWN) vs Hollow Lifted Nib (PEN_UP) */}
                {isPenDown ? (
                  <circle
                    data-testid="turtle-pen-nib"
                    data-pen-state="down"
                    r={4}
                    fill={state.penColor}
                    stroke={isWhiteInkColor(state.penColor) ? '#94a3b8' : '#ffffff'}
                    strokeWidth={1.2}
                    className="shadow-md"
                  />
                ) : (
                  <g data-testid="turtle-pen-nib" data-pen-state="up">
                    <circle
                      r={3.8}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth={1.4}
                      strokeDasharray="2 1.6"
                      opacity={0.95}
                    />
                    <circle
                      r={1.9}
                      fill="none"
                      stroke={isWhiteInkColor(state.penColor) ? '#94a3b8' : state.penColor}
                      strokeWidth={1}
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

        {showLiveToggle && (
          <button
            type="button"
            data-testid="tool-turtle-live"
            onClick={handleToggleLiveMode}
            disabled={appMode !== 'sandbox'}
            aria-pressed={isLiveModeActive}
            title={isLiveModeActive ? 'Live Frame Loop: On (60fps)' : 'Live Frame Loop: Off'}
            aria-label={isLiveModeActive ? 'Live Frame Loop: On' : 'Live Frame Loop: Off'}
            className={`relative flex items-center justify-center gap-0.5 min-h-9 min-w-9 sm:min-h-11 sm:min-w-11 px-1.5 sm:px-2 rounded-lg border transition-all active:scale-95 ${
              appMode === 'sandbox' ? 'cursor-pointer' : 'cursor-default'
            } ${
              isLiveModeActive
                ? 'bg-emerald-500 hover:bg-emerald-400 border-emerald-200 text-slate-950 shadow-md font-black'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            <InfinityIcon className="w-4 h-4 sm:w-4 sm:h-4 stroke-[2.6]" />
            <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[2.5]" />
          </button>
        )}

        {isLiveModeActive && appMode === 'sandbox' && (
          <button
            type="button"
            data-testid="tool-turtle-live-clear"
            onClick={handleToggleClearBetweenFrames}
            aria-pressed={state.clearBetweenFrames !== false}
            title={
              state.clearBetweenFrames !== false
                ? 'Clear Each Frame: On'
                : 'Keep Trails Across Frames'
            }
            aria-label={
              state.clearBetweenFrames !== false
                ? 'Clear Each Frame: On'
                : 'Clear Each Frame: Off'
            }
            className={`flex items-center justify-center min-h-9 min-w-9 sm:min-h-11 sm:min-w-11 w-9 h-9 sm:w-11 sm:h-11 rounded-lg border transition-all active:scale-95 cursor-pointer ${
              state.clearBetweenFrames !== false
                ? 'bg-sky-500 hover:bg-sky-400 border-sky-200 text-slate-950 shadow-md'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-400 hover:text-white opacity-75'
            }`}
          >
            <span className="text-sm sm:text-base leading-none" aria-hidden="true">
              🧹
            </span>
          </button>
        )}
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
        {isInteractivePointerActive && (
          <>
            <span className="text-slate-500">|</span>
            <span data-testid="turtle-pointer-readout">
              👆 <b className="text-emerald-400">{Math.round(pointerState.x)}</b>,{' '}
              <b className="text-emerald-400">{Math.round(pointerState.y)}</b>
            </span>
          </>
        )}
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
