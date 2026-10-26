import { describe, it, expect } from 'vitest';
import {
  moveTurtleForward,
  moveTurtleBackward,
  turnTurtle,
  arcTurtle,
  normalizeHeading,
  updateBoundingBox,
} from '../src/simulations/turtle/physics';
import { TurtleState } from '../src/simulations/turtle/types';
import {
  createInitialTurtleState,
  turtleSimulationEnvironment,
} from '../src/simulations/turtle/turtleEnvironment';

function createInitialState(): TurtleState {
  return {
    robot: { x: 0, y: 0, heading: 0 },
    penDown: true,
    penColor: '#0f172a',
    penWidth: 6,
    paths: [],
    status: 'IDLE',
    pan: { x: 0, y: 0 },
    zoom: 1,
    fitToView: false,
    computedBounds: { minX: -140, minY: -140, maxX: 140, maxY: 140 },
  };
}

describe('Turtle Physics & Kinematics', () => {
  it('normalizes headings cleanly within [0, 360)', () => {
    expect(normalizeHeading(0)).toBe(0);
    expect(normalizeHeading(360)).toBe(0);
    expect(normalizeHeading(450)).toBe(90);
    expect(normalizeHeading(-90)).toBe(270);
    expect(normalizeHeading(-30)).toBe(330);
  });

  it('moves forward and backward according to heading', () => {
    const s0 = createInitialState();
    // Facing North (0 deg): dy is -50
    const s1 = moveTurtleForward(s0, 50);
    expect(s1.robot.x).toBeCloseTo(0);
    expect(s1.robot.y).toBeCloseTo(-50);
    expect(s1.paths.length).toBe(1);
    expect(s1.paths[0].type).toBe('LINE');

    // Turn East (90 deg) and move forward 100
    const s2 = turnTurtle(s1, 90);
    expect(s2.robot.heading).toBe(90);
    const s3 = moveTurtleForward(s2, 100);
    expect(s3.robot.x).toBeCloseTo(100);
    expect(s3.robot.y).toBeCloseTo(-50);

    // Move backward 50
    const s4 = moveTurtleBackward(s3, 50);
    expect(s4.robot.x).toBeCloseTo(50);
    expect(s4.robot.y).toBeCloseTo(-50);
  });

  it('does not draw paths when pen is up', () => {
    const s0 = createInitialState();
    s0.penDown = false;
    const s1 = moveTurtleForward(s0, 50);
    expect(s1.paths.length).toBe(0);
    expect(s1.robot.y).toBeCloseTo(-50);
  });

  it('draws with the assigned pen color', () => {
    const s0 = createInitialState();
    s0.penColor = '#ef4444'; // Red
    const s1 = moveTurtleForward(s0, 40);
    expect(s1.paths[0].color).toBe('#ef4444');
  });

  it('turns left and right with 30° and 45° increments', () => {
    let s = createInitialState();
    // Turn right 30 deg 3 times -> 90 deg
    s = turnTurtle(s, 30);
    s = turnTurtle(s, 30);
    s = turnTurtle(s, 30);
    expect(s.robot.heading).toBe(90);

    // Turn right 45 deg 2 times -> 180 deg
    s = turnTurtle(s, 45);
    s = turnTurtle(s, 45);
    expect(s.robot.heading).toBe(180);

    // Turn left 45 deg -> 135 deg
    s = turnTurtle(s, -45);
    expect(s.robot.heading).toBe(135);

    // Turn left 30 deg -> 105 deg
    s = turnTurtle(s, -30);
    expect(s.robot.heading).toBe(105);
  });

  it('calculates smooth circular arcs (arc right 90 deg)', () => {
    // Start at (0, 0), facing North (0)
    // Arc Right (clockwise) by 90 deg with R=50:
    // Center is at (50, 0)
    // End position is at (50, -50), end heading is 90 (East)
    const s0 = createInitialState();
    const s1 = arcTurtle(s0, 50, 90, 'RIGHT');

    expect(s1.robot.heading).toBe(90);
    expect(s1.robot.x).toBeCloseTo(50);
    expect(s1.robot.y).toBeCloseTo(-50);
    expect(s1.paths.length).toBe(1);
    expect(s1.paths[0].type).toBe('ARC');
    if (s1.paths[0].type === 'ARC') {
      expect(s1.paths[0].sweepAngle).toBe(90);
      expect(s1.paths[0].radius).toBe(50);
    }
  });

  it('calculates smooth circular arcs (arc left 90 deg)', () => {
    // Start at (0, 0), facing North (0)
    // Arc Left (counter-clockwise) by 90 deg with R=50:
    // Center is at (-50, 0)
    // End position is at (-50, -50), end heading is 270 (West)
    const s0 = createInitialState();
    const s1 = arcTurtle(s0, 50, 90, 'LEFT');

    expect(s1.robot.heading).toBe(270);
    expect(s1.robot.x).toBeCloseTo(-50);
    expect(s1.robot.y).toBeCloseTo(-50);
    expect(s1.paths.length).toBe(1);
    if (s1.paths[0].type === 'ARC') {
      expect(s1.paths[0].sweepAngle).toBe(-90);
    }
  });

  it('updates bounding box across negative and positive quadrants', () => {
    const s0 = createInitialState();
    const s1 = moveTurtleForward(s0, 300); // y = -300
    expect(s1.computedBounds.minY).toBeLessThanOrEqual(-340);
  });

  it('initializes turtle environment with pen width 6 (twice as wide)', () => {
    const state = createInitialTurtleState();
    expect(state.penWidth).toBe(6);
  });

  it('executes turn and color actions with specific block params', () => {
    let state = createInitialTurtleState();

    // Turn Left 30°
    const turn30Res = turtleSimulationEnvironment.executeAction('TURN_LEFT', state, { params: { angle: 30 } });
    expect(turn30Res.nextState.robot.heading).toBe(330);

    // Turn Right 45°
    const turn45Res = turtleSimulationEnvironment.executeAction('TURN_RIGHT', state, { params: { angle: 45 } });
    expect(turn45Res.nextState.robot.heading).toBe(45);

    // Set Pen Color Red
    const redRes = turtleSimulationEnvironment.executeAction('SET_PEN_COLOR', state, { params: { color: '#ef4444' } });
    expect(redRes.nextState.penColor).toBe('#ef4444');

    // Draw line with penWidth 6 and red color
    const fwdRes = turtleSimulationEnvironment.executeAction('FORWARD', redRes.nextState, { params: { distance: 50 } });
    expect(fwdRes.nextState.paths.length).toBe(1);
    expect(fwdRes.nextState.paths[0].color).toBe('#ef4444');
    expect(fwdRes.nextState.paths[0].width).toBe(6);
  });
});
