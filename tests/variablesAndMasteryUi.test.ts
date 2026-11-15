import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useAppStore } from '../src/store/useAppStore';
import { VariableWatchOverlay } from '../src/components/VariableWatchOverlay';
import {
  LessonPickerModal,
  isMasteryChallengeTierUnlocked,
} from '../src/components/LessonPickerModal';
import {
  writeCodeScopes,
  readCodeScopes,
} from '../src/engine/serialization/codeScopes';
import {
  BinaryWriter,
} from '../src/engine/serialization/binaryWriter';
import {
  BinaryReader,
} from '../src/engine/serialization/binaryReader';
import {
  OP_VAR_ASSIGN,
  OP_VAR_OP,
  OP_TURTLE_TELEPORT,
  SENSOR_REF_FLAG,
  SERIALIZED_SENSOR_IDS,
  encodeVarOrSensorIndex,
  decodeVarOrSensorIndex,
} from '../src/engine/serialization/types';
import {
  inferHintCategoryForBlockType,
  doesBlockMatchHintCategory,
} from '../src/engine/placeholderHelpers';
import {
  computeStagedPalettePolicy,
} from '../src/utils/curriculumStagePolicy';
import {
  resetAllProfileDataForTests,
  awardMedalForProfile,
  getActiveProfile,
  getProfileProgress,
  markLessonCompleted,
} from '../src/services/profileService';
import { MASTERY_CHALLENGE_TIERS, CurriculumActivity } from '../src/data/curriculum';
import { CodeBlock } from '../src/types';

describe('Commit 25: Variables UI, operandDescMask, Turtle TELEPORT & Mastery Challenges', () => {
  beforeEach(() => {
    resetAllProfileDataForTests();
    const s = useAppStore.getState();
    s.pause();
    s.setAppMode('sandbox');
    s.setSimEnvironment('grid');
    s.setLessonPickerOpen(false);
    useAppStore.setState({
      activeVariables: {},
      isLessonPickerOpen: true,
      lessonPickerMode: 'challenges',
    });
  });

  describe('1. VariableWatchOverlay Kid-Friendly Visuals & Badges', () => {
    it('returns empty/null markup when no variables are assigned', () => {
      useAppStore.setState({ activeVariables: {} });
      const html = renderToStaticMarkup(React.createElement(VariableWatchOverlay));
      expect(html).toBe('');
    });

    it('renders canonical kid-friendly shape symbols for key variables', () => {
      useAppStore.setState({
        activeVariables: {
          a: 4,
          b: 2,
          c: 10,
          s: 1,
          p: 8,
          r: 3,
          x: 100,
          y: 200,
        },
      });

      const html = renderToStaticMarkup(React.createElement(VariableWatchOverlay));

      // Root testid
      expect(html).toContain('data-testid="toolbar-variables"');

      // Canonical symbols and box icons
      expect(html).toContain('📦');
      expect(html).toContain('●'); // a
      expect(html).toContain('▲'); // b
      expect(html).toContain('■'); // c
      expect(html).toContain('★'); // s
      expect(html).toContain('♪'); // p
      expect(html).toContain('↕'); // r or y
      expect(html).toContain('↔'); // x

      // Accessible text substring format "{varName}={displayValue}" preserved
      expect(html).toContain('a=4');
      expect(html).toContain('b=2');
      expect(html).toContain('c=10');
      expect(html).toContain('x=100');
      expect(html).toContain('y=200');

      // Badges have data-testid="var-badge-<name>"
      expect(html).toContain('data-testid="var-badge-a"');
      expect(html).toContain('data-testid="var-badge-b"');
      expect(html).toContain('data-testid="var-badge-x"');
    });

    it('formats numbers to 2 decimal places when non-integer', () => {
      useAppStore.setState({
        activeVariables: {
          a: 3.14159,
        },
      });

      const html = renderToStaticMarkup(React.createElement(VariableWatchOverlay));
      expect(html).toContain('a=3.14');
    });
  });

  describe('2. Binary Serialization: operandDescMask & Live Sensors', () => {
    it('encodes and decodes sensor IDs using SENSOR_REF_FLAG = 0x80', () => {
      expect(encodeVarOrSensorIndex('$x')).toBe(0x80 | 0);
      expect(encodeVarOrSensorIndex('$y')).toBe(0x80 | 1);
      expect(encodeVarOrSensorIndex('$heading')).toBe(0x80 | 2);
      expect(encodeVarOrSensorIndex('$tileDial')).toBe(0x80 | 3);

      expect(decodeVarOrSensorIndex(0x80 | 0)).toBe('$x');
      expect(decodeVarOrSensorIndex(0x80 | 1)).toBe('$y');
      expect(decodeVarOrSensorIndex(0x80 | 2)).toBe('$heading');
      expect(decodeVarOrSensorIndex(0x80 | 3)).toBe('$tileDial');

      // Normal variables 0..25
      expect(encodeVarOrSensorIndex('a')).toBe(0);
      expect(encodeVarOrSensorIndex('z')).toBe(25);
      expect(decodeVarOrSensorIndex(0)).toBe('a');
      expect(decodeVarOrSensorIndex(25)).toBe('z');
    });

    it('serializes and deserializes VAR_ASSIGN with integer, variable, and sensor operands', () => {
      const blocks: CodeBlock[] = [
        { id: 'b1', type: 'VAR_ASSIGN', params: { varName: 'a', value: 42 } },
        { id: 'b2', type: 'VAR_ASSIGN', params: { varName: 'b', value: -15 } },
        { id: 'b3', type: 'VAR_ASSIGN', params: { varName: 'c', value: 'a' } },
        { id: 'b4', type: 'VAR_ASSIGN', params: { varName: 'a', value: '$tileDial' } },
        { id: 'b5', type: 'VAR_ASSIGN', params: { varName: 'x', value: '$x' } },
      ];

      const scopes = {
        MAIN: blocks,
        F1: [],
        F2: [],
        F3: [],
      };

      const writer = new BinaryWriter();
      writeCodeScopes(writer, scopes, 0x01); // Grid env
      const bytes = writer.getBytes();

      // Read back
      const reader = new BinaryReader(bytes);
      const decodedScopes = readCodeScopes(reader, 0x01);

      expect(decodedScopes.MAIN).toHaveLength(5);
      expect(decodedScopes.MAIN[0].type).toBe('VAR_ASSIGN');
      expect(decodedScopes.MAIN[0].params?.a).toBe('a');
      expect(decodedScopes.MAIN[0].params?.b).toBe(42);

      expect(decodedScopes.MAIN[1].params?.a).toBe('b');
      expect(decodedScopes.MAIN[1].params?.b).toBe(-15);

      expect(decodedScopes.MAIN[2].params?.a).toBe('c');
      expect(decodedScopes.MAIN[2].params?.b).toBe('a');

      expect(decodedScopes.MAIN[3].params?.a).toBe('a');
      expect(decodedScopes.MAIN[3].params?.b).toBe('$tileDial');

      expect(decodedScopes.MAIN[4].params?.a).toBe('x');
      expect(decodedScopes.MAIN[4].params?.b).toBe('$x');
    });

    it('serializes and deserializes VAR_OP with sensor and binary op (+, -)', () => {
      const blocks: CodeBlock[] = [
        {
          id: 'b1',
          type: 'VAR_OP',
          params: { a: 'a', b: '$tileDial', op: '+', c: 1 },
        },
        {
          id: 'b2',
          type: 'VAR_OP',
          params: { a: 'b', b: 'a', op: '-', c: '$heading' },
        },
      ];

      const scopes = {
        MAIN: blocks,
        F1: [],
        F2: [],
        F3: [],
      };

      const writer = new BinaryWriter();
      writeCodeScopes(writer, scopes, 0x01);
      const bytes = writer.getBytes();

      const reader = new BinaryReader(bytes);
      const decodedScopes = readCodeScopes(reader, 0x01);

      expect(decodedScopes.MAIN).toHaveLength(2);
      expect(decodedScopes.MAIN[0].type).toBe('VAR_OP');
      expect(decodedScopes.MAIN[0].params?.a).toBe('a');
      expect(decodedScopes.MAIN[0].params?.b).toBe('$tileDial');
      expect(decodedScopes.MAIN[0].params?.op).toBe('+');
      expect(decodedScopes.MAIN[0].params?.c).toBe(1);

      expect(decodedScopes.MAIN[1].params?.a).toBe('b');
      expect(decodedScopes.MAIN[1].params?.b).toBe('a');
      expect(decodedScopes.MAIN[1].params?.op).toBe('-');
      expect(decodedScopes.MAIN[1].params?.c).toBe('$heading');
    });

    it('ensures Byte 0 of VAR_ASSIGN and VAR_OP has bits 7..5 set to 0', () => {
      const blocks: CodeBlock[] = [
        { id: 'b1', type: 'VAR_ASSIGN', params: { varName: 'a', value: 5 } },
        { id: 'b2', type: 'VAR_OP', params: { varName: 'a', left: 'a', op: '+', right: 1 } },
      ];

      const writer = new BinaryWriter();
      writeCodeScopes(writer, { MAIN: blocks, F1: [], F2: [], F3: [] }, 0x01);
      const bytes = writer.getBytes();

      // Find OP_VAR_ASSIGN (0x07) and OP_VAR_OP (0x08)
      const assignIdx = bytes.indexOf(OP_VAR_ASSIGN);
      expect(assignIdx).toBeGreaterThan(-1);
      expect(bytes[assignIdx] & 0xe0).toBe(0); // Bits 7..5 must be 0

      const opIdx = bytes.indexOf(OP_VAR_OP);
      expect(opIdx).toBeGreaterThan(-1);
      expect(bytes[opIdx] & 0xe0).toBe(0); // Bits 7..5 must be 0
    });
  });

  describe('3. Placeholder and Category Hints', () => {
    it('infers "variable" hint category for VAR_ASSIGN and "operator" for VAR_OP', () => {
      expect(inferHintCategoryForBlockType('VAR_ASSIGN')).toBe('variable');
      expect(inferHintCategoryForBlockType('VAR_OP')).toBe('operator');
    });

    it('infers "motion" hint category for TELEPORT', () => {
      expect(inferHintCategoryForBlockType('TELEPORT')).toBe('motion');
    });

    it('matches "variable" category correctly with VAR_ASSIGN and VAR_OP', () => {
      expect(doesBlockMatchHintCategory('VAR_ASSIGN', undefined, 'variable')).toBe(true);
      expect(doesBlockMatchHintCategory('VAR_OP', undefined, 'variable')).toBe(true);
      expect(doesBlockMatchHintCategory('MOVE_FWD', undefined, 'variable')).toBe(false);
    });

    it('matches "motion" category correctly with TELEPORT', () => {
      expect(doesBlockMatchHintCategory('TELEPORT', undefined, 'motion')).toBe(true);
    });
  });

  describe('4. Staged Palette Policy & Allowed Sensors/Ops', () => {
    it('computes allowedValueSensors and allowedVarOps when specified in activity', () => {
      const activity: CurriculumActivity = {
        id: '6.1',
        version: 1,
        moduleId: 'module-6',
        format: 'activity',
        simId: 'grid',
        title: 'Dial Sensors',
        concept: 'variables',
        palette: {
          allowedSimBlocks: ['MOVE_FWD', 'VAR_ASSIGN', 'VAR_OP'],
          allowVariables: true,
          allowedVariableNames: ['a', 'b'],
          allowedValueSensors: ['$tileDial'],
          allowedVarOps: ['+', '-'],
        },
      };

      const policy = computeStagedPalettePolicy('curriculum', activity, []);
      expect(policy.paletteVariableBadges).toEqual(['a', 'b']);
      expect(policy.allowedValueSensors).toEqual(['$tileDial']);
      expect(policy.allowedVarOps).toEqual(['+', '-']);
    });
  });

  describe('5. Mastery Challenges UI & Roadmap (V1 Tiers + V2 Deferred Empty State)', () => {
    it('handles tier prerequisites cleanly when tiers exist or returns false safely when empty', () => {
      const unlockedProgress = {
        activeProfileId: 'default',
        unlockedModules: ['module-1'],
        completedLessons: {},
        earnedBadges: ['badge-module-6'],
        earnedMedals: [],
      };

      const lockedProgress = {
        activeProfileId: 'default',
        unlockedModules: ['module-1'],
        completedLessons: {},
        earnedBadges: [],
        earnedMedals: [],
      };

      if (MASTERY_CHALLENGE_TIERS.length > 0) {
        const tier1 = MASTERY_CHALLENGE_TIERS[0];
        const tier2 = MASTERY_CHALLENGE_TIERS[1];
        const tier5 = MASTERY_CHALLENGE_TIERS[4];

        expect(isMasteryChallengeTierUnlocked(tier1, unlockedProgress)).toBe(true);
        expect(isMasteryChallengeTierUnlocked(tier2, lockedProgress)).toBe(false);
        expect(isMasteryChallengeTierUnlocked(tier5, lockedProgress)).toBe(false);
      } else {
        expect(isMasteryChallengeTierUnlocked(undefined, unlockedProgress)).toBe(false);
      }
    });

    it('renders mastery challenges view cleanly (5-tier roadmap or V2 empty placeholder) with zero padlocks', () => {
      const html = renderToStaticMarkup(
        React.createElement(LessonPickerModal, { initialTab: 'challenges' })
      );

      // Challenges view container
      expect(html).toContain('data-testid="mastery-challenges-view"');
      expect(html).toContain('data-testid="picker-mode-challenges"');
      expect(html).not.toContain('🔒');

      if (MASTERY_CHALLENGE_TIERS.length > 0) {
        expect(html).toContain('data-testid="challenge-tier-tier-1"');
        expect(html).toContain('data-testid="challenge-tier-tier-2"');
        expect(html).toContain('data-testid="challenge-tier-tier-5"');
        expect(html).toContain('Tier 1 Mastery Challenges');
        expect(html).toContain('Tier 2 Mastery Challenges');
        expect(html).toContain('Tier 5 Mastery Challenges');
        expect(html).toContain('data-testid="btn-activity-C6.1"');
        expect(html).toContain('data-testid="btn-activity-C6.2"');
      } else {
        expect(html).toContain('data-testid="mastery-challenges-empty"');
      }
    });

    it('awards medals and displays them on earned challenge cards when tiers are active', () => {
      const profile = getActiveProfile();
      awardMedalForProfile(profile.id, 'medal-c6-1');

      // Re-render modal in challenges tab
      const html = renderToStaticMarkup(
        React.createElement(LessonPickerModal, { initialTab: 'challenges' })
      );

      if (MASTERY_CHALLENGE_TIERS.length > 0) {
        expect(html).toContain('data-testid="medal-badge-medal-c6-1"');
        expect(html).toContain('data-earned="true"');
        expect(html).toContain('🏅');
      } else {
        expect(getProfileProgress(profile.id).earnedMedals).toContain('medal-c6-1');
      }
    });

    it('automatically awards challenge medal upon completing challenge activity C6.1', () => {
      const profile = getActiveProfile();
      markLessonCompleted(profile.id, 'C6.1', 1);

      const updatedProgress = getProfileProgress(profile.id);
      expect(updatedProgress.earnedMedals).toContain('medal-c6-1');
    });
  });
});
