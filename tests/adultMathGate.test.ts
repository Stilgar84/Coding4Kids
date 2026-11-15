import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AdultMathChallenge,
  generateAdultMathChallenge,
  verifyAdultMathAnswer,
} from '../src/utils/adultMathGate';
import { SolutionModal } from '../src/components/SolutionModal';
import { clearPendingUpdateState } from '../src/services/pwaStateRestoreService';
import { useAppStore } from '../src/store/useAppStore';

function createSequenceRng(values: number[]): () => number {
  let idx = 0;
  return () => {
    const val = values[Math.min(idx, values.length - 1)];
    idx += 1;
    return val;
  };
}

describe('Adult Math Gate (src/utils/adultMathGate.ts & SolutionModal)', () => {
  describe('generateAdultMathChallenge', () => {
    it('generates deterministic challenges for all 3 arithmetic categories with seeded RNGs', () => {
      // Category 0: 2-digit addition with carry (e.g. 47 + 36)
      // 47 -> (47 - 24) / 74 ≈ 0.315; 36 -> (36 - 15) / 75 = 0.285
      const add2 = generateAdultMathChallenge(createSequenceRng([0.1, 0.315, 0.285]));
      expect(add2).toEqual({
        a: 47,
        b: 36,
        op: '+',
        prompt: '47 + 36',
        answer: 83,
      });
      expect((add2.a % 10) + (add2.b % 10)).toBeGreaterThanOrEqual(10);

      // Category 1: 3-digit addition (e.g. 115..685 + 27..285)
      const add3 = generateAdultMathChallenge(createSequenceRng([0.4, 0.0, 0.999999]));
      expect(add3).toEqual({
        a: 115,
        b: 285,
        op: '+',
        prompt: '115 + 285',
        answer: 400,
      });

      // Category 2: 2x1-digit multiplication (12..48 x 3..9)
      const mult = generateAdultMathChallenge(createSequenceRng([0.8, 0.999999, 0.999999]));
      expect(mult).toEqual({
        a: 48,
        b: 9,
        op: '×',
        prompt: '48 × 9',
        answer: 432,
      });
    });

    it('handles constant or out-of-range RNG outputs safely without infinite loops', () => {
      const zeroChallenge = generateAdultMathChallenge(() => 0);
      expect(zeroChallenge.op).toBe('+');
      expect(zeroChallenge.a).toBeGreaterThanOrEqual(24);
      expect(zeroChallenge.a).toBeLessThanOrEqual(97);
      expect(zeroChallenge.b).toBeGreaterThanOrEqual(15);
      expect(zeroChallenge.b).toBeLessThanOrEqual(89);
      expect((zeroChallenge.a % 10) + (zeroChallenge.b % 10)).toBeGreaterThanOrEqual(10);
      expect(zeroChallenge.answer).toBe(zeroChallenge.a + zeroChallenge.b);

      const negChallenge = generateAdultMathChallenge(() => -5);
      expect(negChallenge.answer).toBe(negChallenge.a + negChallenge.b);

      const highChallenge = generateAdultMathChallenge(() => 2);
      expect(highChallenge).toEqual({
        a: 48,
        b: 9,
        op: '×',
        prompt: '48 × 9',
        answer: 432,
      });
    });

    it('satisfies category bounds and exact answers across 300 random samples', () => {
      let twoDigitCount = 0;
      let threeDigitCount = 0;
      let multCount = 0;

      for (let i = 0; i < 300; i++) {
        const ch = generateAdultMathChallenge();
        expect(ch.prompt).toBe(`${ch.a} ${ch.op} ${ch.b}`);

        if (ch.op === '×') {
          multCount++;
          expect(ch.a).toBeGreaterThanOrEqual(12);
          expect(ch.a).toBeLessThanOrEqual(48);
          expect(ch.b).toBeGreaterThanOrEqual(3);
          expect(ch.b).toBeLessThanOrEqual(9);
          expect(ch.answer).toBe(ch.a * ch.b);
        } else {
          expect(ch.op).toBe('+');
          expect(ch.answer).toBe(ch.a + ch.b);
          if (ch.a >= 115) {
            threeDigitCount++;
            expect(ch.a).toBeLessThanOrEqual(685);
            expect(ch.b).toBeGreaterThanOrEqual(27);
            expect(ch.b).toBeLessThanOrEqual(285);
          } else {
            twoDigitCount++;
            expect(ch.a).toBeGreaterThanOrEqual(24);
            expect(ch.a).toBeLessThanOrEqual(97);
            expect(ch.b).toBeGreaterThanOrEqual(15);
            expect(ch.b).toBeLessThanOrEqual(89);
            expect((ch.a % 10) + (ch.b % 10)).toBeGreaterThanOrEqual(10);
          }
        }
      }

      // All 3 categories are chosen equally (1/3 each)
      expect(twoDigitCount).toBeGreaterThan(55);
      expect(threeDigitCount).toBeGreaterThan(55);
      expect(multCount).toBeGreaterThan(55);
      expect(twoDigitCount + threeDigitCount + multCount).toBe(300);
    });
  });

  describe('verifyAdultMathAnswer', () => {
    const sample: AdultMathChallenge = {
      a: 17,
      b: 6,
      op: '×',
      prompt: '17 × 6',
      answer: 102,
    };

    it('accepts exact digits with optional surrounding whitespace', () => {
      expect(verifyAdultMathAnswer(sample, '102')).toBe(true);
      expect(verifyAdultMathAnswer(sample, '  102 \t\n')).toBe(true);
    });

    it('rejects wrong numbers, non-numeric text, signs, decimals, and empty strings', () => {
      expect(verifyAdultMathAnswer(sample, '103')).toBe(false);
      expect(verifyAdultMathAnswer(sample, '0')).toBe(false);
      expect(verifyAdultMathAnswer(sample, '')).toBe(false);
      expect(verifyAdultMathAnswer(sample, '   ')).toBe(false);
      expect(verifyAdultMathAnswer(sample, '+102')).toBe(false);
      expect(verifyAdultMathAnswer(sample, '-102')).toBe(false);
      expect(verifyAdultMathAnswer(sample, '102.0')).toBe(false);
      expect(verifyAdultMathAnswer(sample, '102a')).toBe(false);
      expect(verifyAdultMathAnswer(sample, '1 02')).toBe(false);
      expect(verifyAdultMathAnswer(sample, '1e2')).toBe(false);
      expect(verifyAdultMathAnswer(sample, 'abc')).toBe(false);
    });
  });

  describe('SolutionModal SSR gating & zero-padlock compliance', () => {
    const originalWindow = (globalThis as any).window;

    beforeEach(() => {
      clearPendingUpdateState();
      const s = useAppStore.getState();
      s.pause();
      s.setAppMode('sandbox');
      s.setSimEnvironment('grid');
      s.setLevel(1);
      s.setSolutionOpen(false);
    });

    afterEach(() => {
      if (originalWindow === undefined) {
        delete (globalThis as any).window;
      } else {
        (globalThis as any).window = originalWindow;
      }
      useAppStore.getState().setSolutionOpen(false);
    });

    it('keeps Curriculum Tier 1 hints (Ghost & Scaffold), Teacher Tip, and ?dev=1 Constraint Proofs ungated', () => {
      (globalThis as any).window = {
        location: { search: '?dev=1' },
        addEventListener: () => {},
        removeEventListener: () => {},
      };
      const s = useAppStore.getState();
      s.setAppMode('curriculum');

      // Tier 1A Ghost Preview (seq.2)
      s.setCurriculumActivity('seq.2');
      s.setSolutionOpen(true);
      const ghostHtml = renderToStaticMarkup(React.createElement(SolutionModal));
      expect(ghostHtml).toContain('data-testid="tier1-ghost-card"');
      expect(ghostHtml).toContain('data-testid="btn-trigger-ghost-preview"');
      expect(ghostHtml).toContain('data-testid="dev-constraint-proofs-section"');
      expect(ghostHtml).toContain('data-testid="btn-toggle-teacher-tip"');
      expect(ghostHtml).toContain('data-testid="btn-reveal-full-solution"');
      expect(ghostHtml).toContain('aria-expanded="false"');
      expect(ghostHtml).not.toContain('data-testid="btn-load-solution"');
      expect(ghostHtml).not.toContain('🔒');
      expect(ghostHtml).not.toContain('🔓');

      // Tier 1B Starter ? Scaffold (seq.4)
      s.setCurriculumActivity('seq.4');
      s.setSolutionOpen(true);
      const scaffoldHtml = renderToStaticMarkup(React.createElement(SolutionModal));
      expect(scaffoldHtml).toContain('data-testid="tier1-scaffold-card"');
      expect(scaffoldHtml).toContain('data-testid="btn-load-scaffold"');
      expect(scaffoldHtml).toContain('data-testid="dev-constraint-proofs-section"');
      expect(scaffoldHtml).toContain('data-testid="btn-toggle-teacher-tip"');
      expect(scaffoldHtml).toContain('data-testid="btn-reveal-full-solution"');
      expect(scaffoldHtml).toContain('aria-expanded="false"');
      expect(scaffoldHtml).not.toContain('data-testid="btn-load-solution"');
      expect(scaffoldHtml).not.toContain('🔒');
      expect(scaffoldHtml).not.toContain('🔓');
    });

    it('gates Sandbox Recommended Solution behind Grown-Up Check with 🧮 and >=44px touch targets', () => {
      const s = useAppStore.getState();
      s.setAppMode('sandbox');
      s.setLevel(1);
      s.setSolutionOpen(true);

      const html = renderToStaticMarkup(React.createElement(SolutionModal));
      expect(html).toContain('Recommended Solution');
      expect(html).toContain('data-testid="adult-math-gate"');
      expect(html).toContain('🧮');
      expect(html).toContain('Grown-Up Check');
      expect(html).toContain('data-testid="adult-math-prompt"');
      expect(html).toContain('data-testid="adult-math-input"');
      expect(html).toContain('data-testid="btn-adult-math-submit"');
      expect(html).toContain('min-h-[44px]');
      expect(html).toContain('data-testid="btn-toggle-teacher-tip"');
      expect(html).not.toContain('data-testid="btn-load-solution"');
      expect(html).not.toContain('★ Main');
      expect(html).not.toContain('🔒');
      expect(html).not.toContain('🔓');
    });
  });
});
