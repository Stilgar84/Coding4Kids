import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  SwitchyardCanvas,
  computeSwitchyardAnimDurationMs,
} from '../src/simulations/switchyard/components/SwitchyardCanvas';
import {
  applySwitchyardAction,
  createInitialSwitchyardState,
  loadSwitchyardScanner,
  resetSwitchyardState,
} from '../src/simulations/switchyard/physics';
import type { SwitchyardItem, SwitchyardState } from '../src/simulations/switchyard/types';
import { useAppStore } from '../src/store/useAppStore';

function makeItem(
  id: string,
  color: SwitchyardItem['color'] = 'RED',
  icon: SwitchyardItem['icon'] = 'CRATE',
  damaged = false,
): SwitchyardItem {
  return { id, color, icon, damaged, weight: 1 };
}

function renderCanvas(state: SwitchyardState): string {
  return renderToStaticMarkup(React.createElement(SwitchyardCanvas, { state }));
}

function getTagByTestId(html: string, testId: string): string | null {
  const escaped = testId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(new RegExp(`<[^>]*data-testid="${escaped}"[^>]*>`, 'i'));
  return match ? match[0] : null;
}

function parseTranslateAttr(tag: string): { cx: number; cy: number } | null {
  const match = tag.match(/transform="translate\(\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*\)/);
  if (!match) return null;
  return { cx: Number(match[1]), cy: Number(match[2]) };
}

describe('Switchyard offscreen wagon fix & speed-scaled rail animation', () => {
  let prevSpeed: number | 'instant';
  let prevPerfMode: 'auto' | 'high' | 'low';
  let prevAutoLowQuality: boolean;

  beforeEach(() => {
    const store = useAppStore.getState();
    prevSpeed = store.speed;
    prevPerfMode = store.performanceMode;
    prevAutoLowQuality = store.isAutoLowQuality;
    useAppStore.setState({
      speed: 400,
      performanceMode: 'high',
      isAutoLowQuality: false,
    });
  });

  afterEach(() => {
    useAppStore.setState({
      speed: prevSpeed,
      performanceMode: prevPerfMode,
      isAutoLowQuality: prevAutoLowQuality,
    });
  });

  describe('computeSwitchyardAnimDurationMs', () => {
    it('matches the halved speed selector schedule (1x=675, 4x=290, 16x=115, instant=0)', () => {
      expect(computeSwitchyardAnimDurationMs(400, false, true)).toBe(675);
      expect(computeSwitchyardAnimDurationMs(100, false, true)).toBe(290);
      expect(computeSwitchyardAnimDurationMs(25, false, true)).toBe(115);
      expect(computeSwitchyardAnimDurationMs('instant', false, true)).toBe(0);
    });

    it('returns 0 when event is absent, low quality is active, or speed <= 0', () => {
      expect(computeSwitchyardAnimDurationMs(400, false, false)).toBe(0);
      expect(computeSwitchyardAnimDurationMs(400, true, true)).toBe(0);
      expect(computeSwitchyardAnimDurationMs(0, false, true)).toBe(0);
      expect(computeSwitchyardAnimDurationMs(-5, false, true)).toBe(0);
    });
  });

  describe('physics lastAnimEvent tracking', () => {
    it('populates dispatchedItem, toDock, targetSlotIndex, switch state, and monotonic seq on SEND_NEXT', () => {
      const s0 = createInitialSwitchyardState({
        switches: [
          { id: 'A', direction: 'LEFT', initialDirection: 'LEFT' },
          { id: 'B', direction: 'LEFT', initialDirection: 'LEFT' },
        ],
        queue: [
          makeItem('c1', 'RED', 'CRATE'),
          makeItem('c2', 'RED', 'GEAR'),
          makeItem('c3', 'GREEN', 'CRYSTAL'),
        ],
      });

      const s1 = applySwitchyardAction('SEND_NEXT', s0);
      expect(s1.status).not.toBe('COLLISION');
      const ev1 = s1.lastAnimEvent;
      expect(ev1).toBeDefined();
      expect(ev1?.type).toBe('SEND_NEXT');
      expect(ev1?.dispatchedItem?.id).toBe('c1');
      expect(ev1?.toDock).toBe('DOCK_A');
      expect(ev1?.targetDock).toBe('DOCK_A');
      expect(ev1?.targetSlotIndex).toBe(0);
      expect(ev1?.switchCount).toBe(2);
      expect(ev1?.switchADir).toBe('LEFT');
      expect(ev1?.switchBDir).toBe('LEFT');
      expect(ev1?.seq).toBeTypeOf('number');

      const s2 = applySwitchyardAction('SEND_NEXT', s1);
      expect(s2.status).not.toBe('COLLISION');
      const ev2 = s2.lastAnimEvent;
      expect(ev2?.dispatchedItem?.id).toBe('c2');
      expect(ev2?.toDock).toBe('DOCK_A');
      expect(ev2?.targetSlotIndex).toBe(1);
      expect((ev2?.seq ?? 0) > (ev1?.seq ?? 0)).toBe(true);

      const cleared = resetSwitchyardState(s2);
      expect(cleared.lastAnimEvent).toBeUndefined();
    });

    it('populates SCRAP_ITEM and SWITCH_LEFT/SWITCH_RIGHT metadata accurately', () => {
      const s0 = createInitialSwitchyardState({
        switches: [{ id: 'A', direction: 'LEFT', initialDirection: 'LEFT' }],
        queue: [makeItem('bad1', 'YELLOW', 'BATTERY', true), makeItem('ok2', 'BLUE', 'CRATE', false)],
      });

      const sToggle = applySwitchyardAction('SWITCH_RIGHT', s0, { params: { junction: 'A' } });
      expect(sToggle.status).not.toBe('COLLISION');
      expect(sToggle.lastAnimEvent?.type).toBe('SWITCH_RIGHT');
      expect(sToggle.lastAnimEvent?.junction).toBe('A');
      expect(sToggle.lastAnimEvent?.direction).toBe('RIGHT');
      expect(sToggle.lastAnimEvent?.switchADir).toBe('RIGHT');
      expect(sToggle.lastAnimEvent?.switchCount).toBe(1);

      const sScrap = applySwitchyardAction('SCRAP_ITEM', sToggle);
      expect(sScrap.status).not.toBe('COLLISION');
      const evScrap = sScrap.lastAnimEvent;
      expect(evScrap?.type).toBe('SCRAP_ITEM');
      expect(evScrap?.dispatchedItem?.id).toBe('bad1');
      expect(evScrap?.toDock).toBe('SCRAP');
      expect(evScrap?.targetDock).toBe('SCRAP');
      expect(evScrap?.targetSlotIndex).toBe(0);
      expect(evScrap?.switchADir).toBe('RIGHT');
      expect((evScrap?.seq ?? 0) > (sToggle.lastAnimEvent?.seq ?? 0)).toBe(true);
    });
  });

  describe('SVG transform / CSS transform isolation & tunnel bounds', () => {
    it('never applies CSS transform or animation on outer <g transform="..."> wagon elements', () => {
      const s0 = createInitialSwitchyardState({
        switches: [{ id: 'A', direction: 'RIGHT', initialDirection: 'RIGHT' }],
        queue: [
          makeItem('q1', 'BLUE', 'CRATE', false),
          makeItem('q2', 'RED', 'BATTERY', true),
          makeItem('q3', 'GREEN', 'CRYSTAL', false),
          makeItem('q4', 'YELLOW', 'GEAR', false),
        ],
      });
      // Dispatch q1 -> DOCK_B, leaving damaged q2 at scanner and q3,q4 inside intake tunnel
      const sAfterSend = applySwitchyardAction('SEND_NEXT', s0);
      expect(sAfterSend.status).not.toBe('COLLISION');
      const htmlSend = renderCanvas(sAfterSend);

      // Every <g ...> tag in SVG that has an SVG transform="..." attribute must NOT carry CSS animation or transform in style="..."
      const gTags = htmlSend.match(/<g\b[^>]*>/g) ?? [];
      expect(gTags.length).toBeGreaterThan(10);
      for (const tag of gTags) {
        if (/transform="/.test(tag)) {
          const styleMatch = tag.match(/style="([^"]*)"/i);
          if (styleMatch) {
            expect(styleMatch[1]).not.toMatch(/animation|transform/i);
          }
        }
      }

      // Damaged car at scanner uses syHazardSpark only on inner <g>, never on outer scanner <g>
      const scannerTag = getTagByTestId(htmlSend, 'switchyard-scanner-wagon');
      expect(scannerTag).not.toBeNull();
      expect(scannerTag!).not.toMatch(/style="/i);
      const scannerCoords = parseTranslateAttr(scannerTag!);
      expect(scannerCoords).toEqual({ cx: 320, cy: 199 });

      // Queue tunnel peek cars sit comfortably inside canvas & tunnel mouth (cx >= 65) and are clipped
      expect(htmlSend).toContain('clipPath id="sy-tunnel-arch-clip"');
      expect(htmlSend).toContain('clip-path="url(#sy-tunnel-arch-clip)"');
      const tunnel0 = getTagByTestId(htmlSend, 'switchyard-tunnel-car-0');
      const tunnel1 = getTagByTestId(htmlSend, 'switchyard-tunnel-car-1');
      expect(tunnel0).not.toBeNull();
      expect(tunnel1).not.toBeNull();
      expect(tunnel0!).not.toMatch(/style="/i);
      expect(tunnel1!).not.toMatch(/style="/i);
      const c0 = parseTranslateAttr(tunnel0!);
      const c1 = parseTranslateAttr(tunnel1!);
      expect(c0!.cx).toBeGreaterThanOrEqual(65);
      expect(c1!.cx).toBeGreaterThanOrEqual(65);
      expect(c0!.cy).toBeGreaterThan(0);
      expect(c1!.cy).toBeGreaterThan(0);

      // Docked car outer <g> also has clean coordinates >= 65 and zero inline style
      const dockedTag = getTagByTestId(htmlSend, 'switchyard-dock-DOCK_B-car-0');
      expect(dockedTag).not.toBeNull();
      expect(dockedTag!).not.toMatch(/style="/i);
      const dockedCoords = parseTranslateAttr(dockedTag!);
      expect(dockedCoords!.cx).toBeGreaterThanOrEqual(65);
      expect(dockedCoords!.cy).toBe(494);
    });
  });

  describe('Speed-scaled rail travel, dock reveal, scrap arc, and lever transitions', () => {
    it('renders switchyard-inflight-wagon along exact rail waypoints at 1x, 4x, and 16x', () => {
      const base = createInitialSwitchyardState({
        switches: [{ id: 'A', direction: 'RIGHT', initialDirection: 'RIGHT' }],
        queue: [makeItem('car1', 'BLUE', 'CRYSTAL'), makeItem('car2', 'RED', 'CRATE')],
      });
      const afterSend = applySwitchyardAction('SEND_NEXT', base);
      expect(afterSend.status).not.toBe('COLLISION');

      // 1x (400) -> 675ms
      useAppStore.setState({ speed: 400 });
      const html1x = renderCanvas(afterSend);
      const canvas1x = getTagByTestId(html1x, 'switchyard-canvas');
      expect(canvas1x).toContain('data-anim-duration="675"');
      expect(canvas1x).toContain('data-anim-event="SEND_NEXT"');

      const inflight1x = getTagByTestId(html1x, 'switchyard-inflight-wagon');
      expect(inflight1x).not.toBeNull();
      expect(inflight1x!).toContain('data-target-dock="DOCK_B"');
      expect(inflight1x!).toContain('data-route-path="M 320 199');
      expect(inflight1x!).toContain('data-waypoints="320,199;');
      expect(inflight1x!).not.toMatch(/style="/i);
      expect(html1x).toContain('@keyframes syInflightRoute_');
      expect(html1x).toContain('@keyframes syDockSlotReveal');
      expect(html1x).toContain('prefers-reduced-motion: reduce');

      // Newly landed dock car waits until 85% via syDockSlotReveal inner animation
      const dockIdx = html1x.indexOf('data-testid="switchyard-dock-DOCK_B-car-0"');
      expect(dockIdx).toBeGreaterThan(-1);
      expect(html1x.slice(dockIdx, dockIdx + 360)).toContain('syDockSlotReveal 675ms');

      // 4x (100) -> 290ms
      useAppStore.setState({ speed: 100 });
      const html4x = renderCanvas(afterSend);
      expect(getTagByTestId(html4x, 'switchyard-canvas')).toContain('data-anim-duration="290"');
      expect(html4x).toContain('syDockSlotReveal 290ms');

      // 16x (25) -> 115ms
      useAppStore.setState({ speed: 25 });
      const html16x = renderCanvas(afterSend);
      expect(getTagByTestId(html16x, 'switchyard-canvas')).toContain('data-anim-duration="115"');
      expect(html16x).toContain('syDockSlotReveal 115ms');
    });

    it('routes 0-switch and 2-switch (A/B/C) dispatches along exact rail curves', () => {
      // 0 switches -> DOCK_A direct straight path from (320, 199) to (320, 494)
      const s0 = createInitialSwitchyardState({
        switches: [],
        docks: [{ dockId: 'DOCK_A', rejectDamaged: true }],
        queue: [makeItem('z1', 'RED', 'CRATE')],
      });
      const r0 = applySwitchyardAction('SEND_NEXT', s0);
      expect(r0.lastAnimEvent?.toDock).toBe('DOCK_A');
      const html0 = renderCanvas(r0);
      const w0 = getTagByTestId(html0, 'switchyard-inflight-wagon');
      expect(w0).toContain('data-target-dock="DOCK_A"');
      expect(w0).toContain('data-route-path="M 320 199 L 320 224');
      expect(w0).toContain('320 420');
      expect(w0).toContain('320 494');

      // 2 switches RIGHT + RIGHT -> DOCK_C via Switch A (320, 270) and Switch B (430, 344)
      const s2 = createInitialSwitchyardState({
        switches: [
          { id: 'A', direction: 'RIGHT', initialDirection: 'RIGHT', leftTarget: 'DOCK_A', rightTarget: 'SWITCH_B' },
          { id: 'B', direction: 'RIGHT', initialDirection: 'RIGHT', leftTarget: 'DOCK_B', rightTarget: 'DOCK_C' },
        ],
        queue: [makeItem('c1', 'GREEN', 'CRYSTAL')],
      });
      const r2 = applySwitchyardAction('SEND_NEXT', s2);
      expect(r2.lastAnimEvent?.toDock).toBe('DOCK_C');
      const html2 = renderCanvas(r2);
      const w2 = getTagByTestId(html2, 'switchyard-inflight-wagon');
      expect(w2).toContain('data-target-dock="DOCK_C"');
      expect(w2).toContain('320 270');
      expect(w2).toContain('430 344');
      expect(w2).toContain('524 494');
    });

    it('animates SCRAP_ITEM along the upper-right scrap chute and delays scrap preview reveal', () => {
      const s0 = createInitialSwitchyardState({
        switches: [{ id: 'A', direction: 'LEFT', initialDirection: 'LEFT' }],
        queue: [makeItem('bad', 'RED', 'BATTERY', true), makeItem('next', 'GREEN', 'CRATE')],
      });
      const afterScrap = applySwitchyardAction('SCRAP_ITEM', s0);
      expect(afterScrap.status).not.toBe('COLLISION');
      const html = renderCanvas(afterScrap);

      const canvas = getTagByTestId(html, 'switchyard-canvas');
      expect(canvas).toContain('data-anim-event="SCRAP_ITEM"');
      expect(canvas).toContain('data-anim-duration="675"');

      const inflight = getTagByTestId(html, 'switchyard-inflight-wagon');
      expect(inflight).not.toBeNull();
      expect(inflight!).toContain('data-target-dock="SCRAP"');
      expect(inflight!).toContain('data-route-path="M 320 199 C 380 194, 470 196, 558 215"');

      const scrapIdx = html.indexOf('data-testid="switchyard-scrap-preview-car"');
      expect(scrapIdx).toBeGreaterThan(-1);
      expect(html.slice(scrapIdx, scrapIdx + 360)).toContain('syDockSlotReveal 675ms');
    });

    it('scales switch lever transition duration with speed', () => {
      const s0 = createInitialSwitchyardState({
        switches: [
          { id: 'A', direction: 'LEFT', initialDirection: 'LEFT' },
          { id: 'B', direction: 'LEFT', initialDirection: 'LEFT' },
        ],
      });
      const toggled = applySwitchyardAction('SWITCH_RIGHT', s0, { params: { junction: 'A' } });
      expect(toggled.status).not.toBe('COLLISION');

      useAppStore.setState({ speed: 400 });
      const html1x = renderCanvas(toggled);
      expect(getTagByTestId(html1x, 'switchyard-switch-A-lever')).toContain('transition-duration:675ms');

      useAppStore.setState({ speed: 100 });
      const html4x = renderCanvas(toggled);
      expect(getTagByTestId(html4x, 'switchyard-switch-A-lever')).toContain('transition-duration:290ms');

      useAppStore.setState({ speed: 25 });
      const html16x = renderCanvas(toggled);
      expect(getTagByTestId(html16x, 'switchyard-switch-A-lever')).toContain('transition-duration:115ms');

      useAppStore.setState({ speed: 'instant' });
      const htmlInstant = renderCanvas(toggled);
      expect(getTagByTestId(htmlInstant, 'switchyard-switch-A-lever')).toContain('transition-duration:0ms');
    });

    it('omits inflight wagon and dock reveal animation when speed is instant or low quality is enabled', () => {
      const s0 = createInitialSwitchyardState({
        switches: [{ id: 'A', direction: 'LEFT', initialDirection: 'LEFT' }],
        queue: [makeItem('c1', 'RED', 'CRATE')],
      });
      const afterSend = applySwitchyardAction('SEND_NEXT', s0);

      // Instant mode
      useAppStore.setState({ speed: 'instant' });
      const htmlInstant = renderCanvas(afterSend);
      const canvasInstant = getTagByTestId(htmlInstant, 'switchyard-canvas');
      expect(canvasInstant).toContain('data-anim-duration="0"');
      expect(canvasInstant).toContain('data-anim-event="NONE"');
      expect(getTagByTestId(htmlInstant, 'switchyard-inflight-wagon')).toBeNull();
      expect(htmlInstant).not.toMatch(/animation\s*:\s*syDockSlotReveal/);

      // Low quality mode at 1x speed
      useAppStore.setState({ speed: 400, performanceMode: 'low' });
      const htmlLow = renderCanvas(afterSend);
      expect(getTagByTestId(htmlLow, 'switchyard-canvas')).toContain('data-anim-duration="0"');
      expect(getTagByTestId(htmlLow, 'switchyard-inflight-wagon')).toBeNull();
      expect(htmlLow).not.toMatch(/animation\s*:\s*syDockSlotReveal/);
    });
  });

  describe('Initial depot FIFO order, plain counter, feeder animation, and error visuals', () => {
    it('parks all wagons in depot at t=0 with plain counter and FIFO right-exit order, then animates along feeder curve on load', () => {
      const s0 = createInitialSwitchyardState({
        switches: [{ id: 'A', direction: 'RIGHT', initialDirection: 'RIGHT' }],
        docks: [
          { dockId: 'DOCK_A', acceptIcon: 'GEAR', quota: 2, rejectDamaged: true },
          { dockId: 'DOCK_B', acceptIcon: 'CRATE', quota: 2, rejectDamaged: true },
        ],
        queue: [
          makeItem('w1', 'RED', 'GEAR'),
          makeItem('w2', 'BLUE', 'CRATE'),
          makeItem('w3', 'YELLOW', 'GEAR'),
          makeItem('w4', 'RED', 'CRATE'),
        ],
      });

      const htmlIdle = renderCanvas(s0);
      // t = 0: scanner is empty; all 4 cars wait in depot with plain badge "4" (no + or ×)
      expect(getTagByTestId(htmlIdle, 'switchyard-scanner-wagon')).toBeNull();
      expect(htmlIdle).toContain('data-testid="switchyard-depot-count"');
      expect(htmlIdle).toMatch(/data-testid="switchyard-depot-count"[^>]*>4<\/text>/);
      expect(htmlIdle).not.toContain('+4');
      expect(htmlIdle).not.toContain('×4');

      // Rightmost car (cx=136) is w1 (Red GEAR), behind it (cx=84) is w2 (Blue CRATE)
      const carLeft = getTagByTestId(htmlIdle, 'switchyard-tunnel-car-0');
      const carRight = getTagByTestId(htmlIdle, 'switchyard-tunnel-car-1');
      expect(parseTranslateAttr(carLeft!)).toEqual({ cx: 84, cy: 106 });
      expect(parseTranslateAttr(carRight!)).toEqual({ cx: 136, cy: 106 });
      // w2 (blue #3b82f6) is painted in car-0 (left), w1 (red #ef4444) in car-1 (right)
      const idxCar0 = htmlIdle.indexOf('data-testid="switchyard-tunnel-car-0"');
      const idxCar1 = htmlIdle.indexOf('data-testid="switchyard-tunnel-car-1"');
      expect(htmlIdle.slice(idxCar0, idxCar1)).toContain('#3b82f6');
      expect(htmlIdle.slice(idxCar1, idxCar1 + 1200)).toContain('#ef4444');

      // Step 0 -> LOAD_SCANNER rolls w1 into scanner and immediately drops depot count to 3
      const sLoaded = loadSwitchyardScanner(s0);
      const htmlLoaded = renderCanvas(sLoaded);
      const scannerTag = getTagByTestId(htmlLoaded, 'switchyard-scanner-wagon');
      expect(scannerTag).not.toBeNull();
      expect(scannerTag).toContain('data-feeder-anim="true"');
      expect(scannerTag).not.toMatch(/style="/i);
      expect(htmlLoaded).toContain('@keyframes syFeederRoute_');
      expect(htmlLoaded).toContain('@keyframes syTunnelAdvance');
      expect(htmlLoaded).toMatch(/data-testid="switchyard-depot-count"[^>]*>3<\/text>/);

      // Sending cars through the scanner decrements depot count immediately (2 -> 1 -> hidden)
      const fourCarState = createInitialSwitchyardState({
        switches: [{ id: 'A', direction: 'LEFT', initialDirection: 'LEFT' }],
        docks: [{ dockId: 'DOCK_A', acceptColor: 'RED', quota: 4, rejectDamaged: true }],
        queue: [
          makeItem('a1', 'RED', 'CRATE'),
          makeItem('a2', 'RED', 'GEAR'),
          makeItem('a3', 'RED', 'BATTERY'),
          makeItem('a4', 'RED', 'CRYSTAL'),
        ],
      });
      const step0 = loadSwitchyardScanner(fourCarState);
      expect(renderCanvas(step0)).toMatch(/data-testid="switchyard-depot-count"[^>]*>3<\/text>/);
      const step1 = applySwitchyardAction('SEND_NEXT', step0);
      expect(renderCanvas(step1)).toMatch(/data-testid="switchyard-depot-count"[^>]*>2<\/text>/);
      const step2 = applySwitchyardAction('SEND_NEXT', step1);
      expect(renderCanvas(step2)).toMatch(/data-testid="switchyard-depot-count"[^>]*>1<\/text>/);
      const step3 = applySwitchyardAction('SEND_NEXT', step2);
      const htmlZeroLeft = renderCanvas(step3);
      expect(htmlZeroLeft).not.toContain('data-testid="switchyard-depot-count"');
      expect(getTagByTestId(htmlZeroLeft, 'switchyard-scanner-wagon')).not.toBeNull();
    });

    it('animates rejected wagon along tracks with recoil on COLLISION and renders Red Gear != Crate in branch.3', () => {
      // Exact branch.3 Variant 1 Starter trace: Red Gear sent to Crate Dock B
      const b3 = createInitialSwitchyardState({
        switches: [{ id: 'A', direction: 'RIGHT', initialDirection: 'RIGHT' }],
        docks: [
          { dockId: 'DOCK_A', acceptIcon: 'GEAR', quota: 2, rejectDamaged: true },
          { dockId: 'DOCK_B', acceptIcon: 'CRATE', quota: 2, rejectDamaged: true },
        ],
        queue: [
          makeItem('b3_1', 'RED', 'GEAR'),
          makeItem('b3_2', 'BLUE', 'CRATE'),
          makeItem('b3_3', 'YELLOW', 'GEAR'),
          makeItem('b3_4', 'RED', 'CRATE'),
        ],
      });

      const crashed = applySwitchyardAction('SEND_NEXT', loadSwitchyardScanner(b3));
      expect(crashed.status).toBe('COLLISION');
      expect(crashed.queue).toHaveLength(3);
      expect(crashed.lastFailureDetail).toMatchObject({
        code: 'WRONG_ICON',
        dockId: 'DOCK_B',
        expectedIcon: 'CRATE',
        actualIcon: 'GEAR',
        actualColor: 'RED',
      });

      const htmlCrash = renderCanvas(crashed);
      expect(htmlCrash).toContain('data-anim-event="COLLISION"');
      // Dispatched wagon animates to Dock B and stays visible at 100% (recoil) instead of freezing in scanner
      expect(getTagByTestId(htmlCrash, 'switchyard-scanner-wagon')).toBeNull();
      const inflightCrash = getTagByTestId(htmlCrash, 'switchyard-inflight-wagon');
      expect(inflightCrash).not.toBeNull();
      expect(inflightCrash!).toContain('data-target-dock="DOCK_B"');
      expect(htmlCrash).toMatch(/100% \{[^}]*opacity: 1; \}/);
      // Remaining depot badge shows 3 (never 4)
      expect(htmlCrash).toMatch(/data-testid="switchyard-depot-count"[^>]*>3<\/text>/);

      // Failure bubble shows Red (#ef4444) chip + GEAR glyph vs CRATE glyph — NOT an amber #f59e0b fallback circle
      const bubbleIdx = htmlCrash.indexOf('data-testid="switchyard-failure-bubble"');
      expect(bubbleIdx).toBeGreaterThan(-1);
      const bubbleSnippet = htmlCrash.slice(bubbleIdx, bubbleIdx + 1400);
      expect(bubbleSnippet).toContain('#ef4444');
      expect(bubbleSnippet).not.toContain('fill="#f59e0b"');
      expect(bubbleSnippet).toContain('≠');
      expect(bubbleSnippet).toContain('polygon'); // Gear emblem glyph
    });

    it('emits LOAD_SCANNER pre-step on first step() before Block 1 across multi-variant and sandbox Switchyard runs', () => {
      const prevMode = useAppStore.getState().appMode;
      const prevActivity = useAppStore.getState().activeActivityId;
      try {
        useAppStore.getState().setCurriculumActivity('branch.3');
        expect(useAppStore.getState().switchyardState.scannerLoaded).toBeFalsy();
        expect(useAppStore.getState().variantRuns.length).toBe(3);

        // First step loads Wagon #1 into the scanner without advancing runtime past Block 1 yet
        useAppStore.getState().step();
        const afterLoad = useAppStore.getState();
        expect(afterLoad.switchyardState.scannerLoaded).toBe(true);
        expect(afterLoad.switchyardState.lastAnimEvent?.type).toBe('LOAD_SCANNER');
        expect(afterLoad.variantRuns.every((v) => v.switchyardState?.scannerLoaded)).toBe(true);
        expect(afterLoad.runtime).toBeNull();

        // Subsequent steps advance Starter code through LOOP_START -> SWITCH_RIGHT -> SEND_NEXT (colliding on Variant 1)
        useAppStore.getState().step(); // LOOP_START
        useAppStore.getState().step(); // SWITCH_RIGHT
        useAppStore.getState().step(); // SEND_NEXT -> COLLISION
        expect(useAppStore.getState().switchyardState.status).toBe('COLLISION');
        expect(useAppStore.getState().switchyardState.lastFailureDetail?.code).toBe('WRONG_ICON');

        // Condition parameters on IF/ELSE_IF/WHILE must remain editable even when allowActionParams === false (branch.3)
        useAppStore.getState().addBlock('MAIN', 'IF', undefined, 2, {
          condition: { kind: 'sensor', sensor: 'itemIcon', param: 'crate' },
        });
        const insertedIf = useAppStore.getState().workspace.MAIN.find((b) => b.type === 'IF');
        expect(insertedIf).toBeDefined();
        useAppStore.getState().updateBlockParams('MAIN', insertedIf!.id, {
          condition: { kind: 'sensor', sensor: 'itemIcon', param: 'gear' },
        });
        const updatedIf = useAppStore.getState().workspace.MAIN.find((b) => b.id === insertedIf!.id);
        expect(updatedIf?.params?.condition).toEqual({
          kind: 'sensor',
          sensor: 'itemIcon',
          param: 'gear',
        });
      } finally {
        useAppStore.getState().setAppMode(prevMode);
        if (prevActivity) {
          useAppStore.getState().setCurriculumActivity(prevActivity);
        }
      }
    });
  });
});
