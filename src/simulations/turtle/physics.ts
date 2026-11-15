import { SimulationSpeed } from '../../types';
import {
  TurtleState,
  TurtleBounds,
  TurtleCanvasBounds,
  TurtlePathItem,
  TurtlePose,
  TurtleActiveAnimation,
} from './types';

export const DEFAULT_STEP_DISTANCE = 100;
export const DEFAULT_ARC_RADIUS = 50;
export const DEFAULT_ARC_ANGLE = 90;

export const MIN_TURTLE_ZOOM = 0.02;
export const MAX_TURTLE_ZOOM = 8;

export const DEFAULT_TURTLE_CANVAS_BOUNDS: TurtleCanvasBounds = {
  halfWidth: 300,
  halfHeight: 240,
};
export const TURTLE_CANVAS_BOUNDS_EPSILON = 1e-6;

export const BASE_LINEAR_SPEED = 200; // px/s at 1x
export const BASE_ANGULAR_SPEED = 360; // deg/s at 1x
export const BASE_TELEPORT_DURATION_MS = 320; // ms at 1x
export const BASE_WAIT_DURATION_MS = 400; // 1 beat/unit = 400ms at 1x

/**
 * Evaluates whether the turtle's current (x, y) pose falls inside nominal paper bounds
 * (honoring optional `state.canvasBounds` or defaulting to 600×480 around origin).
 */
export function isTurtleInsideCanvas(state: TurtleState): boolean {
  const bounds = state.canvasBounds ?? DEFAULT_TURTLE_CANVAS_BOUNDS;
  return (
    Math.abs(state.robot.x) <= bounds.halfWidth + TURTLE_CANVAS_BOUNDS_EPSILON &&
    Math.abs(state.robot.y) <= bounds.halfHeight + TURTLE_CANVAS_BOUNDS_EPSILON
  );
}

/**
 * Computes adaptive world grid spacing so zoomed-out views avoid dense aliasing
 * while keeping 100px steps aligned to 2 × 50px grid intersections at standard zoom.
 */
export function getTurtleGridStep(zoom: number): number {
  const safeZoom = Math.max(MIN_TURTLE_ZOOM, zoom);
  if (safeZoom < 0.05) return 1000;
  if (safeZoom < 0.25) return 250;
  return 50;
}

/**
 * Computes visible world-space bounds from container dimensions, pan, and zoom.
 */
export function getVisibleTurtleWorldBounds(
  containerWidth: number,
  containerHeight: number,
  panX: number,
  panY: number,
  zoom: number,
  marginScreenPx: number = 80
): TurtleBounds {
  const safeZoom = Math.max(MIN_TURTLE_ZOOM, zoom);
  const safeWidth = Math.max(100, containerWidth);
  const safeHeight = Math.max(100, containerHeight);
  const centerX = safeWidth / 2 + panX;
  const centerY = safeHeight / 2 + panY;
  const marginWorld = marginScreenPx / safeZoom;
  return {
    minX: (0 - centerX) / safeZoom - marginWorld,
    maxX: (safeWidth - centerX) / safeZoom + marginWorld,
    minY: (0 - centerY) / safeZoom - marginWorld,
    maxY: (safeHeight - centerY) / safeZoom + marginWorld,
  };
}

/**
 * Returns the union of committed drawing bounds and an active turtle pose margin.
 */
export function combineTurtleBoundsWithPose(
  computedBounds: TurtleBounds,
  robotPose: TurtlePose,
  poseMargin: number = 40
): TurtleBounds {
  return {
    minX: Math.min(computedBounds.minX, robotPose.x - poseMargin),
    minY: Math.min(computedBounds.minY, robotPose.y - poseMargin),
    maxX: Math.max(computedBounds.maxX, robotPose.x + poseMargin),
    maxY: Math.max(computedBounds.maxY, robotPose.y + poseMargin),
  };
}

export interface AutoFitOverflowResult {
  zoom: number;
  pan: { x: number; y: number };
}

/**
 * Computes a smooth zoom-out and centered pan when drawing bounds overflow ~85%
 * of the visible viewport; returns null when already contained or unchanged.
 */
export function computeAutoFitOverflowViewport(
  combinedBounds: TurtleBounds,
  containerWidth: number,
  containerHeight: number,
  currentZoom: number,
  currentPan: { x: number; y: number }
): AutoFitOverflowResult | null {
  if (containerWidth <= 0 || containerHeight <= 0) return null;

  const safeCurrentZoom = Math.min(MAX_TURTLE_ZOOM, Math.max(MIN_TURTLE_ZOOM, currentZoom));
  const fillRatio = 0.85;
  const padX = (containerWidth * (1 - fillRatio)) / 2;
  const padY = (containerHeight * (1 - fillRatio)) / 2;

  const centerX = containerWidth / 2 + currentPan.x;
  const centerY = containerHeight / 2 + currentPan.y;

  const screenMinX = centerX + combinedBounds.minX * safeCurrentZoom;
  const screenMaxX = centerX + combinedBounds.maxX * safeCurrentZoom;
  const screenMinY = centerY + combinedBounds.minY * safeCurrentZoom;
  const screenMaxY = centerY + combinedBounds.maxY * safeCurrentZoom;

  const tolerancePx = 1;
  const overflows =
    screenMinX < padX - tolerancePx ||
    screenMaxX > containerWidth - padX + tolerancePx ||
    screenMinY < padY - tolerancePx ||
    screenMaxY > containerHeight - padY + tolerancePx;

  if (!overflows) return null;

  const boundsWidth = Math.max(100, combinedBounds.maxX - combinedBounds.minX);
  const boundsHeight = Math.max(100, combinedBounds.maxY - combinedBounds.minY);
  const targetWidth = Math.max(40, containerWidth * fillRatio);
  const targetHeight = Math.max(40, containerHeight * fillRatio);

  const fitZoom = Math.min(targetWidth / boundsWidth, targetHeight / boundsHeight);
  const nextZoom = Number(
    Math.max(MIN_TURTLE_ZOOM, Math.min(safeCurrentZoom, fitZoom)).toFixed(4)
  );

  const boundsCenterX = (combinedBounds.minX + combinedBounds.maxX) / 2;
  const boundsCenterY = (combinedBounds.minY + combinedBounds.maxY) / 2;
  const nextPan = {
    x: Number((-boundsCenterX * nextZoom).toFixed(2)),
    y: Number((-boundsCenterY * nextZoom).toFixed(2)),
  };

  const zoomChanged = Math.abs(nextZoom - currentZoom) > 0.0005;
  const panChanged =
    Math.abs(nextPan.x - currentPan.x) > 0.5 ||
    Math.abs(nextPan.y - currentPan.y) > 0.5;

  if (!zoomChanged && !panChanged) {
    return null;
  }

  return {
    zoom: nextZoom,
    pan: nextPan,
  };
}

export function normalizeHeading(degrees: number): number {
  let h = degrees % 360;
  if (h < 0) h += 360;
  return Number(h.toFixed(6));
}

/**
 * Calculates arc center (cx, cy) given starting point, heading, radius, and direction.
 */
export function getArcCenter(
  x: number,
  y: number,
  heading: number,
  radius: number,
  isRight: boolean
): { cx: number; cy: number } {
  const startRad = (heading * Math.PI) / 180;
  const normalAngle = isRight ? startRad + Math.PI / 2 : startRad - Math.PI / 2;
  const cx = Number((x + radius * Math.sin(normalAngle)).toFixed(4));
  const cy = Number((y - radius * Math.cos(normalAngle)).toFixed(4));
  return { cx, cy };
}

/**
 * Returns speed multiplier relative to base speed (1x = 400ms -> 1, 4x = 100ms -> 4, 16x = 25ms -> 16).
 */
export function getSpeedMultiplier(speed: SimulationSpeed | number): number {
  if (speed === 'instant' || speed === 0) return Infinity;
  const num = typeof speed === 'number' ? speed : 400;
  return 400 / num;
}

/**
 * Calculates linear movement duration in milliseconds.
 */
export function calculateLinearDuration(distance: number, speed: SimulationSpeed | number): number {
  if (distance === 0 || speed === 'instant' || speed === 0) return 0;
  const multiplier = getSpeedMultiplier(speed);
  const speedPxPerMs = (BASE_LINEAR_SPEED * multiplier) / 1000;
  return Math.abs(distance) / speedPxPerMs;
}

/**
 * Calculates arc movement duration in milliseconds.
 */
export function calculateArcDuration(radius: number, sweepAngle: number, speed: SimulationSpeed | number): number {
  if (radius === 0 || sweepAngle === 0 || speed === 'instant' || speed === 0) return 0;
  const arcLength = Math.abs(radius * ((sweepAngle * Math.PI) / 180));
  const multiplier = getSpeedMultiplier(speed);
  const speedPxPerMs = (BASE_LINEAR_SPEED * multiplier) / 1000;
  return arcLength / speedPxPerMs;
}

/**
 * Calculates in-place turn duration in milliseconds.
 */
export function calculateAngularDuration(deltaDegrees: number, speed: SimulationSpeed | number): number {
  if (deltaDegrees === 0 || speed === 'instant' || speed === 0) return 0;
  const multiplier = getSpeedMultiplier(speed);
  const speedDegPerMs = (BASE_ANGULAR_SPEED * multiplier) / 1000;
  return Math.abs(deltaDegrees) / speedDegPerMs;
}

/**
 * Traverses an arc at progress p in [0, 1].
 * Computes exact coordinates and tangential heading along the arc.
 */
export function getArcProgressPose(
  fromPose: TurtlePose,
  radius: number,
  sweepAngle: number,
  p: number
): { x: number; y: number; heading: number; currentSweep: number } {
  const clampedP = Math.max(0, Math.min(1, p));
  const isRight = sweepAngle > 0;
  const { cx, cy } = getArcCenter(fromPose.x, fromPose.y, fromPose.heading, radius, isRight);

  const currentSweep = sweepAngle * clampedP;
  const currentHeading = normalizeHeading(fromPose.heading + currentSweep);
  const currentRad = (currentHeading * Math.PI) / 180;

  const currentNormalAngle = isRight ? currentRad - Math.PI / 2 : currentRad + Math.PI / 2;
  const x = Number((cx + radius * Math.sin(currentNormalAngle)).toFixed(4));
  const y = Number((cy - radius * Math.cos(currentNormalAngle)).toFixed(4));

  return {
    x,
    y,
    heading: currentHeading,
    currentSweep,
  };
}

/**
 * Traverses a line between fromPose and toPose at progress p in [0, 1].
 */
export function getLineProgressPose(
  fromPose: TurtlePose,
  toPose: TurtlePose,
  p: number
): { x: number; y: number; heading: number } {
  const clampedP = Math.max(0, Math.min(1, p));
  const x = Number((fromPose.x + (toPose.x - fromPose.x) * clampedP).toFixed(4));
  const y = Number((fromPose.y + (toPose.y - fromPose.y) * clampedP).toFixed(4));
  return {
    x,
    y,
    heading: toPose.heading,
  };
}

/**
 * Rotates in-place from fromPose by deltaDegrees at progress p in [0, 1].
 */
export function getTurnProgressPose(
  fromPose: TurtlePose,
  deltaDegrees: number,
  p: number
): { x: number; y: number; heading: number } {
  const clampedP = Math.max(0, Math.min(1, p));
  const heading = normalizeHeading(fromPose.heading + deltaDegrees * clampedP);
  return {
    x: fromPose.x,
    y: fromPose.y,
    heading,
  };
}

/**
 * Checks whether an action type represents a motion action that animates over time.
 */
export function isTurtleMotionAction(actionType: string): boolean {
  return (
    actionType === 'FORWARD' ||
    actionType === 'MOVE_FWD' ||
    actionType === 'BACKWARD' ||
    actionType === 'MOVE_BACK' ||
    actionType === 'TURN_LEFT' ||
    actionType === 'TURN_RIGHT' ||
    actionType === 'ARC_LEFT' ||
    actionType === 'ARC_RIGHT'
  );
}

/**
 * Checks whether an action type animates over time (motion, wait, or teleport).
 */
export function isTurtleAnimatedAction(actionType: string): boolean {
  return isTurtleMotionAction(actionType) || actionType === 'WAIT' || actionType === 'TELEPORT';
}

export function calculateTeleportDuration(speed: SimulationSpeed | number): number {
  const mult = getSpeedMultiplier(speed);
  if (!Number.isFinite(mult)) return 0;
  return BASE_TELEPORT_DURATION_MS / mult;
}

export function calculateWaitDuration(units: number, speed: SimulationSpeed | number): number {
  const mult = getSpeedMultiplier(speed);
  if (!Number.isFinite(mult) || units <= 0) return 0;
  return (BASE_WAIT_DURATION_MS * units) / mult;
}

/**
 * Creates a TurtleActiveAnimation descriptor for a motion action.
 */
export function createTurtleAnimation(
  actionType: string,
  fromPose: TurtlePose,
  toPose: TurtlePose,
  penDown: boolean,
  penColor: string,
  penWidth: number,
  params: Record<string, any> | undefined,
  speed: SimulationSpeed | number,
  startTime: number = typeof performance !== 'undefined' ? performance.now() : Date.now()
): TurtleActiveAnimation {
  if (actionType === 'TURN_LEFT' || actionType === 'TURN_RIGHT') {
    const angle = params?.angle ?? 90;
    const deltaDegrees = actionType === 'TURN_LEFT' ? -angle : angle;
    const duration = calculateAngularDuration(angle, speed);
    return {
      type: 'TURN',
      fromPose,
      toPose,
      currentPose: { ...fromPose },
      progress: 0,
      duration,
      startTime,
      penDown,
      penColor,
      penWidth,
      deltaDegrees,
    };
  }

  if (actionType === 'WAIT') {
    const units = typeof params?.duration === 'number' && Number.isFinite(params.duration) ? params.duration : 1;
    const duration = calculateWaitDuration(units, speed);
    return {
      type: 'WAIT',
      fromPose,
      toPose: fromPose,
      currentPose: { ...fromPose },
      progress: 0,
      duration,
      startTime,
      penDown: false,
      penColor,
      penWidth,
    };
  }

  if (actionType === 'TELEPORT') {
    const duration = calculateTeleportDuration(speed);
    return {
      type: 'TELEPORT',
      fromPose,
      toPose,
      currentPose: { ...fromPose },
      progress: 0,
      duration,
      startTime,
      penDown: false,
      penColor,
      penWidth,
    };
  }

  if (actionType === 'ARC_LEFT' || actionType === 'ARC_RIGHT') {
    const radius = params?.radius ?? DEFAULT_ARC_RADIUS;
    const angle = params?.angle ?? DEFAULT_ARC_ANGLE;
    const sweepAngle = actionType === 'ARC_LEFT' ? -angle : angle;
    const duration = calculateArcDuration(radius, angle, speed);
    return {
      type: 'ARC',
      fromPose,
      toPose,
      currentPose: { ...fromPose },
      progress: 0,
      duration,
      startTime,
      penDown,
      penColor,
      penWidth,
      radius,
      sweepAngle,
      currentSweep: 0,
    };
  }

  // Straight movement: FORWARD / BACKWARD / MOVE_FWD / MOVE_BACK
  const distance = params?.length ?? params?.distance ?? Math.hypot(toPose.x - fromPose.x, toPose.y - fromPose.y);
  const duration = calculateLinearDuration(distance, speed);
  return {
    type: 'LINE',
    fromPose,
    toPose,
    currentPose: { ...fromPose },
    progress: 0,
    duration,
    startTime,
    penDown,
    penColor,
    penWidth,
  };
}

/**
 * Evaluates the intermediate pose of an active animation at progress p in [0, 1].
 */
export function interpolateAnimationPose(
  anim: TurtleActiveAnimation,
  p: number
): {
  pose: TurtlePose;
  currentSweep?: number;
} {
  if (anim.type === 'LINE') {
    return { pose: getLineProgressPose(anim.fromPose, anim.toPose, p) };
  }
  if (anim.type === 'ARC' && anim.radius !== undefined && anim.sweepAngle !== undefined) {
    const res = getArcProgressPose(anim.fromPose, anim.radius, anim.sweepAngle, p);
    return {
      pose: { x: res.x, y: res.y, heading: res.heading },
      currentSweep: res.currentSweep,
    };
  }
  if (anim.type === 'TURN' && anim.deltaDegrees !== undefined) {
    return { pose: getTurnProgressPose(anim.fromPose, anim.deltaDegrees, p) };
  }
  if (anim.type === 'WAIT') {
    return { pose: anim.fromPose };
  }
  if (anim.type === 'TELEPORT') {
    return { pose: p >= 0.5 ? anim.toPose : anim.fromPose };
  }
  return { pose: anim.toPose };
}

/**
 * Recalculates bounding box encompassing all drawn path points and current turtle position.
 * Returns at least a reasonable centered viewport (e.g. [-100, -100, 100, 100])
 */
export function updateBoundingBox(paths: TurtlePathItem[], robot: TurtlePose): TurtleBounds {
  let minX = Math.min(-100, robot.x);
  let maxX = Math.max(100, robot.x);
  let minY = Math.min(-100, robot.y);
  let maxY = Math.max(100, robot.y);

  for (const p of paths) {
    if (p.type === 'LINE') {
      minX = Math.min(minX, p.fromX, p.toX);
      maxX = Math.max(maxX, p.fromX, p.toX);
      minY = Math.min(minY, p.fromY, p.toY);
      maxY = Math.max(maxY, p.fromY, p.toY);
    } else if (p.type === 'ARC') {
      minX = Math.min(minX, p.fromX, p.toX);
      maxX = Math.max(maxX, p.fromX, p.toX);
      minY = Math.min(minY, p.fromY, p.toY);
      maxY = Math.max(maxY, p.fromY, p.toY);

      // Approximate bounding box with intermediate sample points along arc
      const steps = 8;
      const isRight = p.sweepAngle > 0;
      const { cx, cy } = getArcCenter(p.fromX, p.fromY, p.startHeading, p.radius, isRight);

      for (let i = 1; i < steps; i++) {
        const fraction = i / steps;
        const currentHeading = (p.startHeading + fraction * p.sweepAngle) * (Math.PI / 180);
        const arcNormal = isRight ? currentHeading - Math.PI / 2 : currentHeading + Math.PI / 2;
        const px = cx + p.radius * Math.sin(arcNormal);
        const py = cy - p.radius * Math.cos(arcNormal);
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);
      }
    }
  }

  // Add 40px margin around bounds
  return {
    minX: Math.round(minX - 40),
    minY: Math.round(minY - 40),
    maxX: Math.round(maxX + 40),
    maxY: Math.round(maxY + 40),
  };
}

/**
 * Moves turtle forward along current heading.
 * Heading 0 is North (-Y), 90 is East (+X), 180 is South (+Y), 270 is West (-X).
 */
export function moveTurtleForward(state: TurtleState, distance: number = DEFAULT_STEP_DISTANCE): TurtleState {
  const rad = (state.robot.heading * Math.PI) / 180;
  const dx = distance * Math.sin(rad);
  const dy = -distance * Math.cos(rad);

  const newX = Number((state.robot.x + dx).toFixed(4));
  const newY = Number((state.robot.y + dy).toFixed(4));

  const newPaths = [...state.paths];
  if (state.penDown) {
    newPaths.push({
      type: 'LINE',
      fromX: state.robot.x,
      fromY: state.robot.y,
      toX: newX,
      toY: newY,
      color: state.penColor,
      width: state.penWidth,
    });
  }

  const newRobot: TurtlePose = {
    ...state.robot,
    x: newX,
    y: newY,
  };

  return {
    ...state,
    robot: newRobot,
    paths: newPaths,
    computedBounds: updateBoundingBox(newPaths, newRobot),
  };
}

/**
 * Moves turtle backward along current heading.
 */
export function moveTurtleBackward(state: TurtleState, distance: number = DEFAULT_STEP_DISTANCE): TurtleState {
  return moveTurtleForward(state, -distance);
}

/**
 * Turns turtle by deltaDegrees (positive = clockwise / right, negative = counter-clockwise / left).
 */
export function turnTurtle(state: TurtleState, deltaDegrees: number): TurtleState {
  const newHeading = normalizeHeading(state.robot.heading + deltaDegrees);
  return {
    ...state,
    robot: {
      ...state.robot,
      heading: newHeading,
    },
  };
}

/**
 * Performs a circular arc motion.
 * direction: 'RIGHT' (clockwise) or 'LEFT' (counter-clockwise)
 * radius: arc radius (e.g. 50)
 * sweepAngle: degrees of arc (e.g. 90)
 */
export function arcTurtle(
  state: TurtleState,
  radius: number = DEFAULT_ARC_RADIUS,
  angle: number = DEFAULT_ARC_ANGLE,
  direction: 'LEFT' | 'RIGHT'
): TurtleState {
  const isRight = direction === 'RIGHT';
  const sweepAngle = isRight ? angle : -angle;
  const startHeading = state.robot.heading;

  const { cx, cy } = getArcCenter(state.robot.x, state.robot.y, startHeading, radius, isRight);

  // End heading
  const endHeading = normalizeHeading(startHeading + sweepAngle);
  const endRad = (endHeading * Math.PI) / 180;

  // Vector from center to end position is opposite to the center-to-robot direction at end heading
  const endNormalAngle = isRight ? endRad - Math.PI / 2 : endRad + Math.PI / 2;
  const toX = Number((cx + radius * Math.sin(endNormalAngle)).toFixed(4));
  const toY = Number((cy - radius * Math.cos(endNormalAngle)).toFixed(4));

  const newPaths = [...state.paths];
  if (state.penDown) {
    newPaths.push({
      type: 'ARC',
      fromX: state.robot.x,
      fromY: state.robot.y,
      toX,
      toY,
      radius,
      startHeading,
      sweepAngle,
      color: state.penColor,
      width: state.penWidth,
    });
  }

  const newRobot: TurtlePose = {
    x: toX,
    y: toY,
    heading: endHeading,
  };

  return {
    ...state,
    robot: newRobot,
    paths: newPaths,
    computedBounds: updateBoundingBox(newPaths, newRobot),
  };
}

/**
 * Teleports turtle instantly to (x, y, heading) without drawing any path, even when penDown is true.
 */
export function teleportTurtle(
  state: TurtleState,
  x: number,
  y: number,
  heading: number
): TurtleState {
  const newRobot: TurtlePose = {
    x: Number(x.toFixed(4)),
    y: Number(y.toFixed(4)),
    heading: normalizeHeading(heading),
  };
  return {
    ...state,
    robot: newRobot,
    computedBounds: updateBoundingBox(state.paths, newRobot),
  };
}

/**
 * Computes the SVG path string 'd' for an ARC path.
 * Handles full 360-degree circles by splitting into two semicircles so SVG does not drop the arc.
 */
export function getArcSvgPath(p: {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  radius: number;
  startHeading: number;
  sweepAngle: number;
}): string {
  if (Math.abs(p.sweepAngle) < 0.0001 || (p.fromX === p.toX && p.fromY === p.toY && Math.abs(p.sweepAngle) < 360)) {
    return `M ${p.fromX} ${p.fromY}`;
  }
  const isRight = p.sweepAngle > 0;
  const sweepFlag = isRight ? 1 : 0;
  const isFullCircle = Math.abs(p.sweepAngle) >= 360;

  if (isFullCircle) {
    const { cx, cy } = getArcCenter(p.fromX, p.fromY, p.startHeading, p.radius, isRight);
    const midX = Number((2 * cx - p.fromX).toFixed(4));
    const midY = Number((2 * cy - p.fromY).toFixed(4));
    return `M ${p.fromX} ${p.fromY} A ${p.radius} ${p.radius} 0 0 ${sweepFlag} ${midX} ${midY} A ${p.radius} ${p.radius} 0 0 ${sweepFlag} ${p.fromX} ${p.fromY}`;
  }

  const largeArcFlag = Math.abs(p.sweepAngle) > 180 ? 1 : 0;
  return `M ${p.fromX} ${p.fromY} A ${p.radius} ${p.radius} 0 ${largeArcFlag} ${sweepFlag} ${p.toX} ${p.toY}`;
}
