import { SimulationStatus } from '../../types';

export interface TurtlePose {
  x: number; // floating-point X
  y: number; // floating-point Y
  heading: number; // degrees (0 = North, 90 = East, 180 = South, 270 = West)
}

export interface TurtleLine {
  type: 'LINE';
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
  width: number;
}

export interface TurtleArc {
  type: 'ARC';
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  radius: number;
  startHeading: number;
  sweepAngle: number; // positive = right/clockwise, negative = left/counter-clockwise
  color: string;
  width: number;
}

export type TurtlePathItem = TurtleLine | TurtleArc;

export interface TurtleActiveAnimation {
  type: 'LINE' | 'ARC' | 'TURN' | 'WAIT' | 'TELEPORT';
  fromPose: TurtlePose;
  toPose: TurtlePose;
  currentPose: TurtlePose;
  progress: number; // 0 to 1
  duration: number; // in ms
  startTime: number;
  penDown: boolean;
  penColor: string;
  penWidth: number;
  // Arc specific:
  radius?: number;
  sweepAngle?: number;
  currentSweep?: number;
  // Turn specific:
  deltaDegrees?: number;
}

export interface TurtleBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface TurtleCanvasBounds {
  halfWidth: number;
  halfHeight: number;
}

export type TurtleCameraPinListener = (pinned: boolean) => void;
const turtleCameraPinListeners = new Set<TurtleCameraPinListener>();

export function notifyTurtleCameraPinned(pinned: boolean): void {
  turtleCameraPinListeners.forEach((listener) => listener(pinned));
}

export function subscribeTurtleCameraPinned(listener: TurtleCameraPinListener): () => void {
  turtleCameraPinListeners.add(listener);
  return () => {
    turtleCameraPinListeners.delete(listener);
  };
}

export type TurtleExecutionMode = 'static' | 'live' | 'flipbook';

export interface TurtleState {
  robot: TurtlePose;
  penDown: boolean;
  penColor: string; // '#0f172a' | '#ef4444' | '#3b82f6' | '#22c55e' | palette hex
  penWidth: number;
  paths: TurtlePathItem[];
  status: SimulationStatus;
  // Viewport & Pan/Zoom state
  pan: { x: number; y: number };
  zoom: number;
  fitToView: boolean;
  computedBounds: TurtleBounds;
  canvasBounds?: TurtleCanvasBounds;
  /** Shows the dashed nominal 600x480 safe-frame boundary even if canvasBounds uses default dimensions */
  showCanvasBounds?: boolean;
  activeAnimation?: TurtleActiveAnimation | null;
  instantMode: boolean;
  showTurtle: boolean;
  /** Optional Phase 3 / v2 execution mode ('static' default, 'live' 60fps loop, 'flipbook') */
  mode?: TurtleExecutionMode;
  /** Whether Live / Flipbook mode clears strokes between frames (default true) */
  clearBetweenFrames?: boolean;
  /** Optional total frame count for flipbook mode */
  totalFrames?: number;
  /** Optional target frames-per-second override */
  fps?: number;
}
