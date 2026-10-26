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

export interface TurtleBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface TurtleState {
  robot: TurtlePose;
  penDown: boolean;
  penColor: string; // '#0f172a' | '#ef4444' | '#3b82f6' | '#22c55e'
  penWidth: number;
  paths: TurtlePathItem[];
  status: SimulationStatus;
  // Viewport & Pan/Zoom state
  pan: { x: number; y: number };
  zoom: number;
  fitToView: boolean;
  computedBounds: TurtleBounds;
}
