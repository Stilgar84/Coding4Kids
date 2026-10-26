import { TurtleState, TurtleBounds, TurtlePathItem, TurtlePose } from './types';

export const DEFAULT_STEP_DISTANCE = 50;
export const DEFAULT_ARC_RADIUS = 50;
export const DEFAULT_ARC_ANGLE = 90;

export function normalizeHeading(degrees: number): number {
  let h = degrees % 360;
  if (h < 0) h += 360;
  return Number(h.toFixed(6));
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
      const startRad = (p.startHeading * Math.PI) / 180;
      // Center of rotation C
      // When heading is theta, orthogonal to right is theta + 90, to left is theta - 90
      const isRight = p.sweepAngle > 0;
      const normalAngle = isRight ? startRad + Math.PI / 2 : startRad - Math.PI / 2;
      const cx = p.fromX + p.radius * Math.sin(normalAngle);
      const cy = p.fromY - p.radius * Math.cos(normalAngle);

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
  // In screen coordinates:
  // Heading 0 = North (dx = 0, dy = -distance)
  // Heading 90 = East (dx = distance, dy = 0)
  // Heading 180 = South (dx = 0, dy = distance)
  // Heading 270 = West (dx = -distance, dy = 0)
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
  const startRad = (startHeading * Math.PI) / 180;

  // Center of rotation C
  // Heading theta:
  // If turning right, center is 90 deg clockwise (heading + 90)
  // If turning left, center is 90 deg counter-clockwise (heading - 90)
  const centerAngle = isRight ? startRad + Math.PI / 2 : startRad - Math.PI / 2;
  const cx = state.robot.x + radius * Math.sin(centerAngle);
  const cy = state.robot.y - radius * Math.cos(centerAngle);

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
