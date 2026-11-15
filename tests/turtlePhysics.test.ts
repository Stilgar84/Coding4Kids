import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  DEFAULT_STEP_DISTANCE,
  DEFAULT_TURTLE_CANVAS_BOUNDS,
  moveTurtleForward,
  moveTurtleBackward,
  turnTurtle,
  arcTurtle,
  normalizeHeading,
  updateBoundingBox,
  isTurtleInsideCanvas,
} from '../src/simulations/turtle/physics';
import { TurtleState } from '../src/simulations/turtle/types';
import {
  TURTLE_ANGLE_PARAM_DEF,
  TURTLE_ARC_RADIUS_PARAM_DEF,
  TURTLE_LENGTH_PARAM_DEF,
  TURTLE_TELEPORT_X_PARAM_DEF,
  TURTLE_TELEPORT_Y_PARAM_DEF,
  createInitialTurtleState,
  resetTurtleState,
  turtleSimulationEnvironment,
} from '../src/simulations/turtle/turtleEnvironment';
import { TurtleCanvas } from '../src/simulations/turtle/components/TurtleCanvas';
import { CurriculumTurtleDefinition } from '../src/data/curriculum/types';
import { renderTurtleMapSvg } from '../src/services/mapThumbnailGenerator';

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
    instantMode: false,
    showTurtle: true,
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

    // Set Pen Width 12
    const widthRes = turtleSimulationEnvironment.executeAction('SET_PEN_WIDTH', fwdRes.nextState, { params: { width: 12 } });
    expect(widthRes.nextState.penWidth).toBe(12);

    // Draw line with penWidth 12
    const fwd2Res = turtleSimulationEnvironment.executeAction('FORWARD', widthRes.nextState, { params: { distance: 50 } });
    expect(fwd2Res.nextState.paths.length).toBe(2);
    expect(fwd2Res.nextState.paths[1].width).toBe(12);
  });

  it('executes parameterized ARC with custom radius and angle', () => {
    let state = createInitialTurtleState();
    const arcRes = turtleSimulationEnvironment.executeAction('ARC_LEFT', state, { params: { radius: 75, angle: 45 } });
    expect(arcRes.nextState.robot.heading).toBe(315);
    expect(arcRes.nextState.paths.length).toBe(1);
    if (arcRes.nextState.paths[0].type === 'ARC') {
      expect(arcRes.nextState.paths[0].radius).toBe(75);
      expect(arcRes.nextState.paths[0].sweepAngle).toBe(-45);
    }
  });

  it('includes 72° and 144° angle presets and closes pentagon/5-star polygons', () => {
    const presetValues = TURTLE_ANGLE_PARAM_DEF.options.map((o) => Number(o.value));
    expect(presetValues).toEqual([15, 30, 45, 60, 72, 90, 120, 135, 144, 180]);

    // 5 x 72° regular pentagon closure
    let pentagon = createInitialTurtleState();
    for (let i = 0; i < 5; i++) {
      pentagon = moveTurtleForward(pentagon, 80);
      pentagon = turnTurtle(pentagon, 72);
    }
    expect(pentagon.robot.x).toBeCloseTo(0, 5);
    expect(pentagon.robot.y).toBeCloseTo(0, 5);
    expect(pentagon.robot.heading).toBeCloseTo(0, 5);

    // 5 x 144° regular 5-pointed star closure
    let star = createInitialTurtleState();
    for (let i = 0; i < 5; i++) {
      star = moveTurtleForward(star, 100);
      star = turnTurtle(star, 144);
    }
    expect(star.robot.x).toBeCloseTo(0, 5);
    expect(star.robot.y).toBeCloseTo(0, 5);
    expect(star.robot.heading).toBeCloseTo(0, 5);
  });

  it('renders miniature turtle silhouette accent alongside Crosshair on TELEPORT icon', () => {
    const teleportItem = turtleSimulationEnvironment.paletteItems.find(
      (item) => item.actionType === 'TELEPORT'
    );
    expect(teleportItem).toBeDefined();

    const inactiveHtml = renderToStaticMarkup(
      React.createElement('div', null, teleportItem!.icon({ isActive: false }))
    );
    expect(inactiveHtml).toContain('lucide-crosshair');
    expect(inactiveHtml).toContain('data-testid="teleport-mini-turtle"');

    const activeHtml = renderToStaticMarkup(
      React.createElement('div', null, teleportItem!.icon({ isActive: true }))
    );
    expect(activeHtml).toContain('lucide-crosshair');
    expect(activeHtml).toContain('data-testid="teleport-mini-turtle"');
    expect(activeHtml).toContain('text-slate-950');
  });

  it('erases prior strokes cleanly with #ffffff ink compositing without width halo inflation', () => {
    let state = createInitialTurtleState();

    // 1. Red base line (width 8)
    state = turtleSimulationEnvironment.executeAction('SET_PEN_COLOR', state, {
      params: { color: '#ef4444' },
    }).nextState;
    state = turtleSimulationEnvironment.executeAction('SET_PEN_WIDTH', state, {
      params: { width: 8 },
    }).nextState;
    state = turtleSimulationEnvironment.executeAction('FORWARD', state, {
      params: { distance: 100 },
    }).nextState;

    // 2. White eraser stroke overlapping red at exact width 6 (no halo inflation)
    state = turtleSimulationEnvironment.executeAction('SET_PEN_COLOR', state, {
      params: { color: '#ffffff' },
    }).nextState;
    state = turtleSimulationEnvironment.executeAction('SET_PEN_WIDTH', state, {
      params: { width: 6 },
    }).nextState;
    state = turtleSimulationEnvironment.executeAction('BACKWARD', state, {
      params: { distance: 60 },
    }).nextState;

    // 3. Blue post-eraser stroke painted on top after white
    state = turtleSimulationEnvironment.executeAction('SET_PEN_COLOR', state, {
      params: { color: '#3b82f6' },
    }).nextState;
    state = turtleSimulationEnvironment.executeAction('FORWARD', state, {
      params: { distance: 40 },
    }).nextState;

    expect(state.paths).toHaveLength(3);
    expect(state.paths[1].color).toBe('#ffffff');
    expect(state.paths[1].width).toBe(6);

    const html = renderToStaticMarkup(React.createElement(TurtleCanvas, { state }));
    // Background grid sits outside/underneath turtle-ink-layer
    const gridIdx = html.indexOf('url(#turtle-grid)');
    const inkLayerIdx = html.indexOf('data-testid="turtle-ink-layer"');
    expect(gridIdx).toBeGreaterThan(-1);
    expect(inkLayerIdx).toBeGreaterThan(gridIdx);

    // Mask cuts out only prior strokes (turtle-line-0) with black mask stroke at exact stroke-width="6"
    const maskStart = html.indexOf('<mask ');
    const maskEnd = html.indexOf('</mask>');
    expect(maskStart).toBeGreaterThan(-1);
    expect(maskEnd).toBeGreaterThan(maskStart);
    const maskMarkup = html.slice(maskStart, maskEnd);
    expect(maskMarkup).toContain('data-testid="turtle-line-1"');
    expect(maskMarkup).toContain('data-ink-eraser="true"');
    expect(maskMarkup).toContain('stroke="#000000"');
    expect(maskMarkup).toContain('stroke-width="6"');

    // Prior red stroke is inside masked group, whereas later blue stroke is outside the mask group
    const maskedGroupMatch = html.match(/<g mask="url\(#([^"]+)\)">([\s\S]*?)<\/g><g><line data-testid="turtle-line-2"/);
    expect(maskedGroupMatch).not.toBeNull();
    expect(maskedGroupMatch![2]).toContain('data-testid="turtle-line-0"');
    expect(maskedGroupMatch![2]).not.toContain('data-testid="turtle-line-2"');
  });

  it('uses DEFAULT_STEP_DISTANCE = 100 and aligns length, radius, and teleport parameter presets', () => {
    expect(DEFAULT_STEP_DISTANCE).toBe(100);
    const moved = moveTurtleForward(createInitialState());
    expect(moved.robot.x).toBe(0);
    expect(moved.robot.y).toBe(-100);
    expect(moved.paths[0]).toMatchObject({ fromX: 0, fromY: 0, toX: 0, toY: -100 });

    expect(TURTLE_LENGTH_PARAM_DEF.defaultValue).toBe(100);
    expect(TURTLE_LENGTH_PARAM_DEF.options?.map((o) => o.value)).toEqual([
      25, 50, 75, 100, 125, 150, 200, 250, 300,
    ]);

    expect(TURTLE_ARC_RADIUS_PARAM_DEF.defaultValue).toBe(50);
    expect(TURTLE_ARC_RADIUS_PARAM_DEF.options?.map((o) => o.value)).toEqual([
      25, 50, 75, 100, 150, 200,
    ]);

    const expectedCoords = [-250, -200, -150, -100, -50, 0, 50, 100, 150, 200, 250];
    expect(TURTLE_TELEPORT_X_PARAM_DEF.options?.map((o) => o.value)).toEqual(expectedCoords);
    expect(TURTLE_TELEPORT_Y_PARAM_DEF.options?.map((o) => o.value)).toEqual(expectedCoords);

    const forwardItem = turtleSimulationEnvironment.paletteItems.find((p) => p.actionType === 'FORWARD');
    const backwardItem = turtleSimulationEnvironment.paletteItems.find((p) => p.actionType === 'BACKWARD');
    expect(forwardItem?.params).toEqual({ length: 100 });
    expect(backwardItem?.params).toEqual({ length: 100 });
  });

  it('evaluates insideCanvas against 600x480 default nominal bounds and preserves custom canvasBounds', () => {
    expect(DEFAULT_TURTLE_CANVAS_BOUNDS).toEqual({ halfWidth: 300, halfHeight: 240 });

    const baseState = createInitialTurtleState();
    expect(isTurtleInsideCanvas(baseState)).toBe(true);
    expect(turtleSimulationEnvironment.evaluateSensor?.('insideCanvas', baseState)).toBe(true);
    expect(turtleSimulationEnvironment.evaluateSensor?.('$insideCanvas', baseState)).toBe(true);
    expect(turtleSimulationEnvironment.evaluateSensor?.(0x28, baseState)).toBe(true);

    // Inclusive boundary + 1e-6 epsilon check
    expect(
      isTurtleInsideCanvas({
        ...baseState,
        robot: { x: 300, y: -240, heading: 0 },
      })
    ).toBe(true);
    expect(
      isTurtleInsideCanvas({
        ...baseState,
        robot: { x: 300 + 5e-7, y: 240 + 5e-7, heading: 0 },
      })
    ).toBe(true);
    expect(
      isTurtleInsideCanvas({
        ...baseState,
        robot: { x: 300.01, y: 0, heading: 0 },
      })
    ).toBe(false);
    expect(
      isTurtleInsideCanvas({
        ...baseState,
        robot: { x: 0, y: -240.01, heading: 0 },
      })
    ).toBe(false);

    // Custom canvasBounds on TurtleState & CurriculumTurtleDefinition preserved through resetTurtleState
    const customDef: CurriculumTurtleDefinition = {
      canvasBounds: { halfWidth: 180, halfHeight: 140 },
    };
    const customInitial = createInitialTurtleState(customDef.canvasBounds);
    expect(customInitial.canvasBounds).toEqual({ halfWidth: 180, halfHeight: 140 });
    expect(
      isTurtleInsideCanvas({
        ...customInitial,
        robot: { x: 185, y: 0, heading: 0 },
      })
    ).toBe(false);

    const afterMove: TurtleState = {
      ...customInitial,
      pan: { x: 25, y: -15 },
      zoom: 0.5,
      robot: { x: 185, y: 0, heading: 90 },
    };
    const reset = resetTurtleState(afterMove);
    expect(reset.canvasBounds).toEqual({ halfWidth: 180, halfHeight: 140 });
    expect(reset.pan).toEqual({ x: 25, y: -15 });
    expect(reset.zoom).toBe(0.5);
    expect(reset.robot).toEqual({ x: 0, y: 0, heading: 0 });
  });

  it('renders block-sized sky-blue turtle geometry in renderTurtleMapSvg thumbnails matching TurtleCanvas', () => {
    const state = {
      ...createInitialState(),
      robot: { x: 100, y: -100, heading: 90 },
      penColor: '#ef4444',
      penDown: true,
    };
    const svgDown = renderTurtleMapSvg(state);
    expect(svgDown).toContain('data-testid="thumbnail-turtle-robot"');
    expect(svgDown).toContain('transform="translate(100, -100) rotate(90)"');
    expect(svgDown).toContain('<circle r="16" fill="#38bdf8" opacity="0.15"');
    expect(svgDown).toContain('<circle r="12" fill="#0284c7" stroke="#38bdf8" stroke-width="1.8"');
    expect(svgDown).toContain('<ellipse cx="0" cy="-13" rx="4.2" ry="5.5" fill="#38bdf8"');
    expect(svgDown).toContain('r="4" fill="#ef4444"');
    expect(svgDown).not.toContain('points="0,-9 6,6 -6,6"');

    const svgUp = renderTurtleMapSvg({ ...state, penDown: false });
    expect(svgUp).toContain('stroke-dasharray="2 1.6"');
    expect(svgUp).toContain('r="1.9"');

    const svgHidden = renderTurtleMapSvg({ ...state, showTurtle: false });
    expect(svgHidden).not.toContain('data-testid="thumbnail-turtle-robot"');
  });
});
