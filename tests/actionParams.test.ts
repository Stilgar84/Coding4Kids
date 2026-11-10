import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { useAppStore } from '../src/store/useAppStore';
import { getSimEnvironment } from '../src/engine/simulation/registry';
import { computePopoverCoords } from '../src/components/params/ParamSelectionPopover';
import { getArcSvgPath } from '../src/simulations/turtle/physics';
import {
  RotationVisual,
  RadiusVisual,
  ArcAngleVisual,
  ParamVisual,
} from '../src/components/params/VisualParamBadges';
import { BlockItem } from '../src/components/BlockItem';

describe('Action Parameters & Subpalette System', () => {
  beforeEach(() => {
    const store = useAppStore.getState();
    store.clearWorkspace();
    store.setSelectedBlockId(null);
    store.setSimEnvironment('turtle');
  });

  it('populates default parameters automatically when adding a parameterized block', () => {
    const store = useAppStore.getState();

    // Add Turn Left without explicit params
    store.addBlock('MAIN', 'TURN_LEFT');
    const blocks = useAppStore.getState().workspace.MAIN;
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('TURN_LEFT');
    expect(blocks[0].params).toBeDefined();
    expect(blocks[0].params?.angle).toBe(90);

    // Add Arc Right without explicit params
    store.addBlock('MAIN', 'ARC_RIGHT');
    const blocks2 = useAppStore.getState().workspace.MAIN;
    expect(blocks2).toHaveLength(2);
    expect(blocks2[1].type).toBe('ARC_RIGHT');
    expect(blocks2[1].params?.radius).toBe(50);
    expect(blocks2[1].params?.angle).toBe(90);

    // Add Set Pen Color without explicit params
    store.addBlock('MAIN', 'SET_PEN_COLOR');
    const blocks3 = useAppStore.getState().workspace.MAIN;
    expect(blocks3).toHaveLength(3);
    expect(blocks3[2].params?.color).toBe('#0f172a');

    // Add Set Pen Width without explicit params
    store.addBlock('MAIN', 'SET_PEN_WIDTH');
    const blocks4 = useAppStore.getState().workspace.MAIN;
    expect(blocks4).toHaveLength(4);
    expect(blocks4[3].params?.width).toBe(6);
  });

  it('updates block parameters via updateBlockParams and selects the block', () => {
    const store = useAppStore.getState();
    store.addBlock('MAIN', 'TURN_LEFT');
    const blockId = useAppStore.getState().workspace.MAIN[0].id;
    expect(useAppStore.getState().selectedBlockId).toBe(blockId);

    // Update angle to 45
    store.updateBlockParams('MAIN', blockId, { angle: 45 });
    const updated = useAppStore.getState().workspace.MAIN[0];
    expect(updated.params?.angle).toBe(45);
  });

  it('toggles subpalette collapsed state', () => {
    const store = useAppStore.getState();
    expect(useAppStore.getState().isSubpaletteCollapsed).toBe(false);

    store.toggleSubpalette();
    expect(useAppStore.getState().isSubpaletteCollapsed).toBe(true);

    store.setSubpaletteCollapsed(false);
    expect(useAppStore.getState().isSubpaletteCollapsed).toBe(false);
  });

  it('adding a new block does not change the collapsed state of the action subpalette', () => {
    const store = useAppStore.getState();

    // Start collapsed
    store.setSubpaletteCollapsed(true);
    expect(useAppStore.getState().isSubpaletteCollapsed).toBe(true);

    // Add a block with parameters
    store.addBlock('MAIN', 'TURN_LEFT');
    expect(useAppStore.getState().isSubpaletteCollapsed).toBe(true);

    // Set to expanded (false)
    store.setSubpaletteCollapsed(false);
    expect(useAppStore.getState().isSubpaletteCollapsed).toBe(false);

    // Add another block
    store.addBlock('MAIN', 'ARC_RIGHT');
    expect(useAppStore.getState().isSubpaletteCollapsed).toBe(false);
  });

  it('consolidates palette items: verifies parameter definitions schema in Turtle env', () => {
    const sim = getSimEnvironment('turtle');
    expect(sim).toBeDefined();

    const forward = sim?.paletteItems.find((p) => p.actionType === 'FORWARD');
    expect(forward).toBeDefined();
    expect(forward?.paramDefs).toHaveLength(1);
    expect(forward?.paramDefs?.[0].id).toBe('length');
    expect(forward?.paramDefs?.[0].type).toBe('length');
    expect(forward?.paramDefs?.[0].defaultValue).toBe(50);

    const backward = sim?.paletteItems.find((p) => p.actionType === 'BACKWARD');
    expect(backward).toBeDefined();
    expect(backward?.paramDefs).toHaveLength(1);
    expect(backward?.paramDefs?.[0].id).toBe('length');
    expect(backward?.paramDefs?.[0].defaultValue).toBe(50);

    const turnLeft = sim?.paletteItems.find((p) => p.actionType === 'TURN_LEFT');
    expect(turnLeft).toBeDefined();
    expect(turnLeft?.paramDefs).toHaveLength(1);
    expect(turnLeft?.paramDefs?.[0].id).toBe('angle');
    expect(turnLeft?.paramDefs?.[0].type).toBe('angle');
    expect(turnLeft?.paramDefs?.[0].options.length).toBeGreaterThan(4);

    const arcLeft = sim?.paletteItems.find((p) => p.actionType === 'ARC_LEFT');
    expect(arcLeft).toBeDefined();
    expect(arcLeft?.paramDefs).toHaveLength(2);
    expect(arcLeft?.paramDefs?.[0].id).toBe('radius');
    expect(arcLeft?.paramDefs?.[1].id).toBe('angle');

    const penColor = sim?.paletteItems.find((p) => p.actionType === 'SET_PEN_COLOR');
    expect(penColor).toBeDefined();
    expect(penColor?.paramDefs).toHaveLength(1);
    expect(penColor?.paramDefs?.[0].id).toBe('color');

    const penWidth = sim?.paletteItems.find((p) => p.actionType === 'SET_PEN_WIDTH');
    expect(penWidth).toBeDefined();
    expect(penWidth?.paramDefs).toHaveLength(1);
    expect(penWidth?.paramDefs?.[0].id).toBe('width');
  });

  it('triggers live instant simulation when updating block parameters in instant mode', () => {
    const store = useAppStore.getState();
    store.setSpeed('instant');

    // Add forward then turn left
    store.addBlock('MAIN', 'FORWARD');
    store.addBlock('MAIN', 'TURN_LEFT'); // default 90
    const fwdBlockId = useAppStore.getState().workspace.MAIN[0].id;
    const turnBlockId = useAppStore.getState().workspace.MAIN[1].id;

    expect(useAppStore.getState().turtleState.robot.y).toBe(-50);
    expect(useAppStore.getState().turtleState.robot.heading).toBe(270);

    // Update forward length to 150 -> y should be -150
    store.updateBlockParams('MAIN', fwdBlockId, { length: 150 });
    expect(useAppStore.getState().turtleState.robot.y).toBe(-150);

    // Update angle to 45 -> heading should be 315 (-45)
    store.updateBlockParams('MAIN', turnBlockId, { angle: 45 });
    expect(useAppStore.getState().turtleState.robot.heading).toBe(315);
  });

  describe('computePopoverCoords positioning logic', () => {
    const originalWindow = globalThis.window;

    beforeEach(() => {
      // Setup mock window dimensions if not in browser/jsdom
      if (typeof globalThis.window === 'undefined') {
        (globalThis as any).window = {
          innerWidth: 1024,
          innerHeight: 768,
        };
      } else {
        (globalThis.window as any).innerWidth = 1024;
        (globalThis.window as any).innerHeight = 768;
      }
    });

    it('positions popover BELOW the badge when block is near the top (under palette)', () => {
      const mockAnchor = {
        getBoundingClientRect: () => ({
          top: 150,
          bottom: 198,
          left: 200,
          right: 236,
          width: 36,
          height: 48,
        }),
      } as unknown as HTMLElement;

      const mockPopover = {
        offsetWidth: 240,
        offsetHeight: 200,
      } as unknown as HTMLElement;

      const coords = computePopoverCoords(mockAnchor, mockPopover);
      // anchor.bottom (198) + margin (8) = 206
      expect(coords.top).toBe(206);
      // anchorCenter is 200 + 18 = 218. left = 218 - 120 = 98
      expect(coords.left).toBe(98);
    });

    it('positions popover ABOVE the badge when block is near the bottom of the viewport', () => {
      const mockAnchor = {
        getBoundingClientRect: () => ({
          top: 700,
          bottom: 748,
          left: 200,
          right: 236,
          width: 36,
          height: 48,
        }),
      } as unknown as HTMLElement;

      const mockPopover = {
        offsetWidth: 240,
        offsetHeight: 200,
      } as unknown as HTMLElement;

      const coords = computePopoverCoords(mockAnchor, mockPopover);
      // anchor.top (700) - popoverHeight (200) - margin (8) = 492
      expect(coords.top).toBe(492);
      expect(coords.left).toBe(98);
    });

    it('clamps left position so popover does not bleed past left or right viewport edges', () => {
      // Near left edge
      const leftAnchor = {
        getBoundingClientRect: () => ({
          top: 200,
          bottom: 248,
          left: 10,
          right: 46,
          width: 36,
          height: 48,
        }),
      } as unknown as HTMLElement;

      const mockPopover = {
        offsetWidth: 240,
        offsetHeight: 200,
      } as unknown as HTMLElement;

      const leftCoords = computePopoverCoords(leftAnchor, mockPopover);
      expect(leftCoords.left).toBe(8); // Clamped to margin

      // Near right edge
      const rightAnchor = {
        getBoundingClientRect: () => ({
          top: 200,
          bottom: 248,
          left: 1000,
          right: 1036,
          width: 36,
          height: 48,
        }),
      } as unknown as HTMLElement;

      const rightCoords = computePopoverCoords(rightAnchor, mockPopover);
      // innerWidth (1024) - popoverWidth (240) - margin (8) = 776
      expect(rightCoords.left).toBe(776);
    });
  });

  describe('Rotation and Arc Parameter Visuals', () => {
    it('RotationVisual shows white line on left and turns up for left, mirrored down for right', () => {
      const size = 28;
      const center = size / 2; // 14
      const len = size * 0.38; // 10.64

      // Turn left (default) 90 deg: white line on left, yellow line turns up
      const htmlLeft = renderToStaticMarkup(
        React.createElement(RotationVisual, { angle: 90, direction: 'left', size })
      );
      // White line before turn starts at x = center - len (approx 3.36) and ends at center (14)
      expect(htmlLeft).toContain(`x1="${center - len}"`);
      expect(htmlLeft).toContain(`x2="${center}"`);
      expect(htmlLeft).toContain('stroke="currentColor"');
      // For 90 deg left: y goes up (negative delta: y = center - len = 3.36)
      expect(htmlLeft).toContain(`y2="${center - len}"`);

      // Turn right 90 deg: mirrored! yellow line turns down (y = center + len = 24.64)
      const htmlRight = renderToStaticMarkup(
        React.createElement(RotationVisual, { angle: 90, direction: 'right', size })
      );
      expect(htmlRight).toContain(`x1="${center - len}"`);
      expect(htmlRight).toContain(`x2="${center}"`);
      expect(htmlRight).toContain(`y2="${center + len}"`);

      // 180 deg U-turn: shows incoming and outgoing lines with U-turn curve
      const htmlUturn = renderToStaticMarkup(
        React.createElement(RotationVisual, { angle: 180, direction: 'left', size })
      );
      expect(htmlUturn).toContain('180°');
      expect(htmlUturn).toContain('<path');
    });

    it('RadiusVisual shows curvature based on fixed distance and smaller arc for higher radius', () => {
      // Radius 25 vs Radius 50 vs Radius 150
      const html25 = renderToStaticMarkup(React.createElement(RadiusVisual, { radius: 25, direction: 'left', size: 28 }));
      const html50 = renderToStaticMarkup(React.createElement(RadiusVisual, { radius: 50, direction: 'left', size: 28 }));
      const html150 = renderToStaticMarkup(React.createElement(RadiusVisual, { radius: 150, direction: 'left', size: 28 }));

      // No 'r:' prefix
      expect(html50).toContain('>50</span>');
      expect(html50).not.toContain('r:50');

      // Extract the end y coordinates from path d attribute: M 5 18 A ... 0 0 0 xEnd yEnd
      const match25 = html25.match(/A [\d.]+ [\d.]+ 0 0 0 ([\d.]+) ([\d.]+)/);
      const match50 = html50.match(/A [\d.]+ [\d.]+ 0 0 0 ([\d.]+) ([\d.]+)/);
      const match150 = html150.match(/A [\d.]+ [\d.]+ 0 0 0 ([\d.]+) ([\d.]+)/);

      expect(match25).not.toBeNull();
      expect(match50).not.toBeNull();
      expect(match150).not.toBeNull();

      const deltaY25 = 18 - parseFloat(match25![2]);
      const deltaY50 = 18 - parseFloat(match50![2]);
      const deltaY150 = 18 - parseFloat(match150![2]);

      // Current 50 has curvature delta ~12.8px (what 25 previously was)
      expect(deltaY50).toBeGreaterThan(12);
      // 25 curves even more sharply
      expect(deltaY25).toBeGreaterThan(deltaY50);
      // Higher radius curves less
      expect(deltaY50).toBeGreaterThan(deltaY150 * 2);

      // Right direction is mirrored (curves down, starting at y=6)
      const htmlRight = renderToStaticMarkup(React.createElement(RadiusVisual, { radius: 50, direction: 'right', size: 28 }));
      expect(htmlRight).toContain('M 5 6 A');
    });

    it('ArcAngleVisual shows previous path white line on left and orange arc without end line', () => {
      const html90 = renderToStaticMarkup(React.createElement(ArcAngleVisual, { angle: 90, direction: 'left', size: 28 }));
      // Contains small white line on left
      expect(html90).toContain('<line');
      expect(html90).toContain('stroke="currentColor"');
      // Contains orange arc path
      expect(html90).toContain('<path');
      expect(html90).toContain('stroke="#f59e0b"');
      expect(html90).toContain('90°');

      // Only ONE line element exists (the previous path white line), NO straight line at the end!
      const lineCount = (html90.match(/<line/g) || []).length;
      expect(lineCount).toBe(1);

      // 360 deg shows full circular arc
      const html360 = renderToStaticMarkup(React.createElement(ArcAngleVisual, { angle: 360, direction: 'left', size: 28 }));
      expect(html360).toContain('<circle');
      expect(html360).toContain('360°');
    });

    it('getArcSvgPath handles 360 degree arcs without SVG dropping the path', () => {
      const arc360 = {
        type: 'ARC' as const,
        fromX: 0,
        fromY: 0,
        toX: 0,
        toY: 0,
        radius: 50,
        startHeading: 0,
        sweepAngle: 360,
        color: '#0f172a',
        width: 6,
      };

      const pathString = getArcSvgPath(arc360);
      // Should split into two semicircles so SVG engines render the full circle
      const arcCommands = (pathString.match(/A 50 50/g) || []).length;
      expect(arcCommands).toBe(2);
      expect(pathString).toContain('M 0 0 A 50 50 0 0 1');
    });

    it('ParamVisual correctly delegates based on actionType and visualVariant', () => {
      const angleDef = {
        id: 'angle',
        label: 'Angle',
        type: 'angle' as const,
        visualVariant: 'rotation' as const,
        defaultValue: 90,
        options: [{ value: 90 }],
      };

      const arcAngleDef = {
        id: 'angle',
        label: 'Angle',
        type: 'angle' as const,
        visualVariant: 'arcAngle' as const,
        defaultValue: 90,
        options: [{ value: 90 }],
      };

      // Rotation on TURN_RIGHT is mirrored
      const htmlTurnRight = renderToStaticMarkup(
        React.createElement(ParamVisual, { paramDef: angleDef, value: 90, actionType: 'TURN_RIGHT' })
      );
      // y2 is center + len (mirrored downwards, center=11, len=8.36 -> 19.36)
      expect(htmlTurnRight).toContain('y2="19.36"');

      // Arc angle visual contains arc stroke
      const htmlArc = renderToStaticMarkup(
        React.createElement(ParamVisual, { paramDef: arcAngleDef, value: 90, actionType: 'ARC_LEFT' })
      );
      expect(htmlArc).toContain('fill="none"');
    });
  });

  describe('BlockItem Action Block & Parameter Display Styling', () => {
    it('renders single rounded rect styling when block has parameters (no right rounded corners on left block, matching bg/border on param container)', () => {
      useAppStore.setState({ activeSimId: 'turtle' });
      const turnBlock = { id: 'turn-1', type: 'TURN_LEFT' as const, params: { angle: 90 } };
      const html = renderToStaticMarkup(
        React.createElement(BlockItem, {
          block: turnBlock,
          index: 0,
          scope: 'MAIN',
          isActive: false,
        })
      );

      // Left block has rounded-l-2xl rounded-r-none and border-2 border-r-0
      expect(html).toContain('rounded-l-2xl');
      expect(html).toContain('rounded-r-none');
      expect(html).toContain('border-r-0');

      // Parameter container exists and matches left block bg & border (bg-amber-600 border-amber-400)
      expect(html).toContain('data-testid="block-params-container-turn-1"');
      expect(html).toContain('bg-amber-600');
      expect(html).toContain('border-amber-400');
      expect(html).toContain('rounded-r-2xl');
      expect(html).toContain('border-l-0');

      // Inner parameter badge maintains its distinct rect styling
      expect(html).toContain('data-testid="block-param-badge-angle"');
      expect(html).toContain('bg-slate-900/80');
    });

    it('renders standalone rounded-2xl when block has no parameters', () => {
      const store = useAppStore.getState();
      store.setSimEnvironment('turtle');

      const penUpBlock = { id: 'penup-1', type: 'PEN_UP' as const };
      const html = renderToStaticMarkup(
        React.createElement(BlockItem, {
          block: penUpBlock,
          index: 0,
          scope: 'MAIN',
          isActive: false,
        })
      );

      // Has rounded-2xl on left block, no param container
      expect(html).toContain('rounded-2xl border-2');
      expect(html).not.toContain('rounded-r-none');
      expect(html).not.toContain('block-params-container-penup-1');
    });

    it('updates parameter container to yellow active theme when block is active', () => {
      useAppStore.setState({ activeSimId: 'turtle' });

      const turnBlock = { id: 'turn-1', type: 'TURN_LEFT' as const, params: { angle: 90 } };
      const htmlActive = renderToStaticMarkup(
        React.createElement(BlockItem, {
          block: turnBlock,
          index: 0,
          scope: 'MAIN',
          isActive: true,
        })
      );

      // Parameter container has active yellow colors
      expect(htmlActive).toContain('data-testid="block-params-container-turn-1"');
      expect(htmlActive).toContain('bg-yellow-400');
      expect(htmlActive).toContain('border-yellow-200');
    });
  });
});
