import React, { useState } from 'react';
import { CodeBlock, ScopeType, VariableName } from '../types';
import {
  ArrowUp,
  ArrowDown,
  CornerUpLeft,
  CornerUpRight,
  CornerDownLeft,
  Repeat,
  PhoneCall,
  AlertTriangle,
  RotateCcw,
  RotateCw,
  PenTool,
  Slash,
  Palette,
} from 'lucide-react';
import { useAppStoreSelector } from '../store/useAppStore';
import { getSimEnvironment } from '../engine/simulation/registry';
import { getActivityAtVersion, getActivityLatest } from '../data/curriculum';
import { BlockParamBadge } from './params/BlockParamBadge';
import { ConditionBadge } from './ConditionBadge';
import { SensorVisual, TileDialGlyphSvg } from './params/VisualParamBadges';
import {
  computeStagedPalettePolicy,
  getAllowedParamDefs,
  resolveActiveCurriculumActivity,
} from '../utils/curriculumStagePolicy';

export type LoopStrokeStyle = 'solid';
export type ControlSpanKind = 'loop' | 'if' | 'while';
export type ControlSpanColorFamily = 'purple' | 'cyan' | 'amber' | 'emerald' | 'rose' | 'fuchsia';
export type ControlBlockRole = 'start' | 'branch' | 'body' | 'end';

export interface MatchedLoopSpan {
  loopId: string;
  kind: ControlSpanKind;
  colorFamily: ControlSpanColorFamily;
  startIndex: number;
  endIndex: number;
  branchIndices: number[];
  /** 1-based nesting depth across all control spans (1 = outer, 2+ = nested) */
  depth: number;
  /** 1-based nesting depth within the same ControlSpanKind */
  kindDepth: number;
  /** 0-based bottom-up rail tier (0 = innermost bracket closest to blocks, higher = outer cradles below) */
  tier: number;
  strokeStyle: LoopStrokeStyle;
  isActiveLoop: boolean;
}

export interface BlockLoopRoleSpan {
  loopId: string;
  kind: ControlSpanKind;
  colorFamily: ControlSpanColorFamily;
  depth: number;
  kindDepth: number;
  tier: number;
  strokeStyle: LoopStrokeStyle;
  role: ControlBlockRole;
  isActiveLoop: boolean;
}

export interface BlockLoopMetadata {
  /** Enclosing matched control spans ordered outermost (depth 1) -> innermost */
  enclosingSpans: BlockLoopRoleSpan[];
  /** Nesting depth of the innermost matched control span enclosing this block (0 if outside matched spans) */
  innermostDepth: number;
  /** Control span kind of the innermost enclosing span */
  innermostKind?: ControlSpanKind;
  /** Color family of the innermost enclosing span */
  innermostColorFamily?: ControlSpanColorFamily;
  /** Stroke style of the innermost matched span */
  innermostStroke?: LoopStrokeStyle;
  /** Structural role of this block within its innermost enclosing span */
  primaryRole: ControlBlockRole | 'none';
}

export interface ScopeLoopNestingAnalysis {
  matchedSpans: MatchedLoopSpan[];
  blockMeta: BlockLoopMetadata[];
  maxDepth: number;
  maxTier: number;
}

export interface ControlSpanVisualSpec {
  strokeStyle: LoopStrokeStyle;
  startBgClass: string;
  startBorderClass: string;
  branchBgClass: string;
  branchBorderClass: string;
  branchTextColorClass: string;
  endBgClass: string;
  endBorderClass: string;
  endIconColorClass: string;
  railBorderColorClass: string;
  railTickBgClass: string;
  railActiveBorderColorClass: string;
  railActiveTickBgClass: string;
  borderStyleClass: string;
}

export function getControlSpanVisualSpec(
  colorFamily: ControlSpanColorFamily,
  kind: ControlSpanKind
): ControlSpanVisualSpec {
  switch (colorFamily) {
    case 'purple':
      return {
        strokeStyle: 'solid',
        startBgClass: 'bg-purple-700',
        startBorderClass: 'border-purple-400 border-solid',
        branchBgClass: 'bg-purple-800',
        branchBorderClass: 'border-purple-400 border-solid',
        branchTextColorClass: 'text-purple-200',
        endBgClass: 'bg-purple-900',
        endBorderClass: 'border-purple-400 border-solid',
        endIconColorClass: 'text-purple-200',
        railBorderColorClass: 'border-purple-400/90',
        railTickBgClass: 'bg-purple-400/90',
        railActiveBorderColorClass: 'border-yellow-300 shadow-[0_2px_8px_rgba(250,204,21,0.55)]',
        railActiveTickBgClass: 'bg-yellow-300',
        borderStyleClass: 'border-solid',
      };
    case 'cyan':
      return {
        strokeStyle: 'solid',
        startBgClass: 'bg-cyan-700',
        startBorderClass:
          kind === 'loop' ? 'border-cyan-300 border-solid' : 'border-cyan-400 border-solid',
        branchBgClass: 'bg-cyan-800',
        branchBorderClass: 'border-cyan-400 border-solid',
        branchTextColorClass: 'text-cyan-200',
        endBgClass: kind === 'if' ? 'bg-cyan-950' : 'bg-cyan-900',
        endBorderClass:
          kind === 'if' ? 'border-cyan-500 border-solid' : 'border-cyan-400 border-solid',
        endIconColorClass: 'text-cyan-200',
        railBorderColorClass: 'border-cyan-400/95',
        railTickBgClass: 'bg-cyan-400/95',
        railActiveBorderColorClass: 'border-yellow-300 shadow-[0_2px_8px_rgba(34,211,238,0.6)]',
        railActiveTickBgClass: 'bg-yellow-300',
        borderStyleClass: 'border-solid',
      };
    case 'amber':
      return {
        strokeStyle: 'solid',
        startBgClass: 'bg-amber-600',
        startBorderClass: 'border-amber-400 border-solid',
        branchBgClass: 'bg-amber-800',
        branchBorderClass: 'border-amber-400 border-solid',
        branchTextColorClass: 'text-amber-200',
        endBgClass: 'bg-amber-950',
        endBorderClass: 'border-amber-500 border-solid',
        endIconColorClass: 'text-amber-200',
        railBorderColorClass: 'border-amber-400/95',
        railTickBgClass: 'bg-amber-400/95',
        railActiveBorderColorClass: 'border-yellow-300 shadow-[0_2px_8px_rgba(251,191,36,0.6)]',
        railActiveTickBgClass: 'bg-yellow-300',
        borderStyleClass: 'border-solid',
      };
    case 'emerald':
      return {
        strokeStyle: 'solid',
        startBgClass: 'bg-emerald-700',
        startBorderClass: 'border-emerald-300 border-solid',
        branchBgClass: 'bg-emerald-800',
        branchBorderClass: 'border-emerald-400 border-solid',
        branchTextColorClass: 'text-emerald-200',
        endBgClass: kind === 'loop' ? 'bg-emerald-900' : 'bg-emerald-950',
        endBorderClass: 'border-emerald-400 border-solid',
        endIconColorClass: 'text-emerald-200',
        railBorderColorClass: 'border-emerald-400/95',
        railTickBgClass: 'bg-emerald-400/95',
        railActiveBorderColorClass: 'border-yellow-300 shadow-[0_2px_8px_rgba(52,211,153,0.6)]',
        railActiveTickBgClass: 'bg-yellow-300',
        borderStyleClass: 'border-solid',
      };
    case 'rose':
      return {
        strokeStyle: 'solid',
        startBgClass: 'bg-rose-700',
        startBorderClass: 'border-rose-400 border-solid',
        branchBgClass: 'bg-rose-800',
        branchBorderClass: 'border-rose-400 border-solid',
        branchTextColorClass: 'text-rose-200',
        endBgClass: 'bg-rose-950',
        endBorderClass: 'border-rose-400 border-solid',
        endIconColorClass: 'text-rose-200',
        railBorderColorClass: 'border-rose-400/95',
        railTickBgClass: 'bg-rose-400/95',
        railActiveBorderColorClass: 'border-yellow-300 shadow-[0_2px_8px_rgba(251,113,133,0.6)]',
        railActiveTickBgClass: 'bg-yellow-300',
        borderStyleClass: 'border-solid',
      };
    case 'fuchsia':
      return {
        strokeStyle: 'solid',
        startBgClass: 'bg-fuchsia-700',
        startBorderClass: 'border-fuchsia-400 border-solid',
        branchBgClass: 'bg-fuchsia-800',
        branchBorderClass: 'border-fuchsia-400 border-solid',
        branchTextColorClass: 'text-fuchsia-200',
        endBgClass: 'bg-fuchsia-950',
        endBorderClass: 'border-fuchsia-400 border-solid',
        endIconColorClass: 'text-fuchsia-200',
        railBorderColorClass: 'border-fuchsia-400/95',
        railTickBgClass: 'bg-fuchsia-400/95',
        railActiveBorderColorClass: 'border-yellow-300 shadow-[0_2px_8px_rgba(232,121,249,0.6)]',
        railActiveTickBgClass: 'bg-yellow-300',
        borderStyleClass: 'border-solid',
      };
  }
}

export function getLoopDepthVisualSpec(depth: number): {
  strokeStyle: LoopStrokeStyle;
  startBgClass: string;
  startBorderClass: string;
  endBgClass: string;
  endBorderClass: string;
  endIconColorClass: string;
  railBorderColorClass: string;
  railActiveBorderColorClass: string;
  borderStyleClass: string;
} {
  const family: ControlSpanColorFamily =
    depth <= 1 ? 'purple' : depth === 2 ? 'cyan' : 'emerald';
  return getControlSpanVisualSpec(family, 'loop');
}

const KIND_COLOR_PALETTES: Record<ControlSpanKind, readonly ControlSpanColorFamily[]> = {
  loop: ['purple', 'cyan', 'emerald', 'fuchsia'],
  if: ['cyan', 'emerald', 'fuchsia', 'purple'],
  while: ['amber', 'rose', 'emerald', 'fuchsia'],
};

function findOwnControlSpan(
  enclosingSpans: readonly BlockLoopRoleSpan[],
  kind: ControlSpanKind,
  allowedRoles: readonly ControlBlockRole[]
): BlockLoopRoleSpan | undefined {
  for (let i = enclosingSpans.length - 1; i >= 0; i--) {
    const s = enclosingSpans[i];
    if (s.kind === kind && allowedRoles.includes(s.role)) {
      return s;
    }
  }
  return undefined;
}

/**
 * Computes matched `LOOP_START .. LOOP_END`, `IF .. (ELSE_IF/ELSE) .. END_IF`, and
 * `WHILE .. END_WHILE` spans, 1-based nesting depths, non-crossing bottom-up visual
 * bracket tiers, and per-block metadata across `blocks`.
 * Gracefully ignores unclosed openers and orphan closers/branches without crashing.
 */
export function computeLoopNestingMetadata(
  blocks: readonly CodeBlock[],
  activeLoopStartPcs?: ReadonlySet<number>
): ScopeLoopNestingAnalysis {
  const loopStack: number[] = [];
  const ifStack: Array<{ startIndex: number; hasElse: boolean; branchIndices: number[] }> = [];
  const whileStack: number[] = [];
  const rawPairs: Array<{
    loopId: string;
    kind: ControlSpanKind;
    startIndex: number;
    endIndex: number;
    branchIndices: number[];
  }> = [];

  for (let i = 0; i < blocks.length; i++) {
    const blk = blocks[i];
    if (blk.type === 'LOOP_START') {
      loopStack.push(i);
    } else if (blk.type === 'LOOP_END') {
      if (loopStack.length > 0) {
        const startIdx = loopStack.pop()!;
        rawPairs.push({
          loopId: blocks[startIdx].id,
          kind: 'loop',
          startIndex: startIdx,
          endIndex: i,
          branchIndices: [],
        });
      }
    } else if (blk.type === 'IF') {
      ifStack.push({ startIndex: i, hasElse: false, branchIndices: [] });
    } else if (blk.type === 'ELSE_IF') {
      if (ifStack.length > 0 && !ifStack[ifStack.length - 1].hasElse) {
        ifStack[ifStack.length - 1].branchIndices.push(i);
      }
    } else if (blk.type === 'ELSE') {
      if (ifStack.length > 0 && !ifStack[ifStack.length - 1].hasElse) {
        ifStack[ifStack.length - 1].branchIndices.push(i);
        ifStack[ifStack.length - 1].hasElse = true;
      }
    } else if (blk.type === 'END_IF') {
      if (ifStack.length > 0) {
        const frame = ifStack.pop()!;
        rawPairs.push({
          loopId: blocks[frame.startIndex].id,
          kind: 'if',
          startIndex: frame.startIndex,
          endIndex: i,
          branchIndices: frame.branchIndices,
        });
      }
    } else if (blk.type === 'WHILE') {
      whileStack.push(i);
    } else if (blk.type === 'END_WHILE') {
      if (whileStack.length > 0) {
        const startIdx = whileStack.pop()!;
        rawPairs.push({
          loopId: blocks[startIdx].id,
          kind: 'while',
          startIndex: startIdx,
          endIndex: i,
          branchIndices: [],
        });
      }
    }
  }

  rawPairs.sort((a, b) => a.startIndex - b.startIndex);

  const depths = rawPairs.map((pair, idx) => {
    let enclosingCount = 0;
    for (let j = 0; j < rawPairs.length; j++) {
      if (j === idx) continue;
      const other = rawPairs[j];
      if (other.startIndex < pair.startIndex && pair.endIndex < other.endIndex) {
        enclosingCount++;
      }
    }
    return 1 + enclosingCount;
  });

  const kindDepths = rawPairs.map((pair, idx) => {
    let enclosingSameKindCount = 0;
    for (let j = 0; j < rawPairs.length; j++) {
      if (j === idx) continue;
      const other = rawPairs[j];
      if (
        other.kind === pair.kind &&
        other.startIndex < pair.startIndex &&
        pair.endIndex < other.endIndex
      ) {
        enclosingSameKindCount++;
      }
    }
    return 1 + enclosingSameKindCount;
  });

  // Compute bottom-up tier: 0 for innermost spans with no overlapping assigned spans,
  // 1 + max(overlapping.tier) for enclosing/crossed spans so bracket lines never collide.
  const tiers = new Array<number>(rawPairs.length).fill(0);
  const bySpanLengthAsc = rawPairs
    .map((pair, idx) => ({ pair, idx, len: pair.endIndex - pair.startIndex }))
    .sort((a, b) => a.len - b.len || b.pair.startIndex - a.pair.startIndex);

  const assignedIndices = new Set<number>();
  for (const item of bySpanLengthAsc) {
    let maxOverlapTier = -1;
    for (const j of assignedIndices) {
      const other = rawPairs[j];
      if (other.startIndex <= item.pair.endIndex && item.pair.startIndex <= other.endIndex) {
        if (tiers[j] > maxOverlapTier) {
          maxOverlapTier = tiers[j];
        }
      }
    }
    tiers[item.idx] = maxOverlapTier + 1;
    assignedIndices.add(item.idx);
  }

  // Assign color families outermost -> innermost so child spans never collide with parent color
  const colorFamilies = new Array<ControlSpanColorFamily>(rawPairs.length);
  for (let idx = 0; idx < rawPairs.length; idx++) {
    const pair = rawPairs[idx];
    const palette = KIND_COLOR_PALETTES[pair.kind];
    let immediateParentIdx = -1;
    for (let p = 0; p < idx; p++) {
      const other = rawPairs[p];
      if (other.startIndex < pair.startIndex && pair.endIndex < other.endIndex) {
        if (immediateParentIdx === -1 || depths[p] > depths[immediateParentIdx]) {
          immediateParentIdx = p;
        }
      }
    }
    const parentColor = immediateParentIdx >= 0 ? colorFamilies[immediateParentIdx] : undefined;
    const preferred = palette[Math.min(kindDepths[idx] - 1, palette.length - 1)];
    colorFamilies[idx] =
      parentColor && preferred === parentColor
        ? palette.find((c) => c !== parentColor) ?? preferred
        : preferred;
  }

  let maxDepth = 0;
  let maxTier = 0;
  const matchedSpans: MatchedLoopSpan[] = rawPairs.map((pair, idx) => {
    const depth = depths[idx];
    const kindDepth = kindDepths[idx];
    const tier = tiers[idx];
    const colorFamily = colorFamilies[idx];
    if (depth > maxDepth) maxDepth = depth;
    if (tier > maxTier) maxTier = tier;
    const spec = getControlSpanVisualSpec(colorFamily, pair.kind);
    return {
      loopId: pair.loopId,
      kind: pair.kind,
      colorFamily,
      startIndex: pair.startIndex,
      endIndex: pair.endIndex,
      branchIndices: pair.branchIndices,
      depth,
      kindDepth,
      tier,
      strokeStyle: spec.strokeStyle,
      isActiveLoop: Boolean(activeLoopStartPcs?.has(pair.startIndex)),
    };
  });

  const blockMeta: BlockLoopMetadata[] = blocks.map((_blk, blockIdx) => {
    const enclosingSpans: BlockLoopRoleSpan[] = [];
    for (const span of matchedSpans) {
      if (span.startIndex <= blockIdx && blockIdx <= span.endIndex) {
        const role: ControlBlockRole =
          blockIdx === span.startIndex
            ? 'start'
            : blockIdx === span.endIndex
            ? 'end'
            : span.branchIndices.includes(blockIdx)
            ? 'branch'
            : 'body';
        enclosingSpans.push({
          loopId: span.loopId,
          kind: span.kind,
          colorFamily: span.colorFamily,
          depth: span.depth,
          kindDepth: span.kindDepth,
          tier: span.tier,
          strokeStyle: span.strokeStyle,
          role,
          isActiveLoop: span.isActiveLoop,
        });
      }
    }

    enclosingSpans.sort((a, b) => a.depth - b.depth || b.tier - a.tier);
    const innermost =
      enclosingSpans.length > 0 ? enclosingSpans[enclosingSpans.length - 1] : undefined;

    return {
      enclosingSpans,
      innermostDepth: innermost ? innermost.depth : 0,
      innermostKind: innermost?.kind,
      innermostColorFamily: innermost?.colorFamily,
      innermostStroke: innermost?.strokeStyle,
      primaryRole: innermost ? innermost.role : 'none',
    };
  });

  return {
    matchedSpans,
    blockMeta,
    maxDepth,
    maxTier,
  };
}

interface BlockItemProps {
  block: CodeBlock;
  index: number;
  scope: ScopeType;
  isActive: boolean;
  isSelected?: boolean;
  isLoopError?: boolean;
  isDragging?: boolean;
  iterationProgress?: { current: number; total: number } | null;
  loopMeta?: BlockLoopMetadata;
  onSelect?: () => void;
  onDragStartBlock?: (e: React.DragEvent, index: number, blockId: string) => void;
  onDragEndBlock?: () => void;
  onDragOverSlot?: (e: React.DragEvent, targetIndex: number) => void;
  onDropAtSlot?: (e: React.DragEvent, targetIndex: number) => void;
  onClearDropIndicator?: () => void;
}

export const BlockItem: React.FC<BlockItemProps> = React.memo(({
  block,
  index,
  scope,
  isActive,
  isSelected = false,
  isLoopError = false,
  isDragging = false,
  iterationProgress = null,
  loopMeta,
  onSelect,
  onDragStartBlock,
  onDragEndBlock,
  onDragOverSlot,
  onDropAtSlot,
  onClearDropIndicator,
}) => {
  const {
    updateBlockRepeat,
    updateBlockParams,
    replacePlaceholderBlock,
    workspace,
    runtime,
    setSelectedBlockId,
    appMode,
    activeActivityId,
    activeActivityVersion,
    activeDemoTabIndex,
    activeSimId,
  } = useAppStoreSelector((s) => ({
    updateBlockRepeat: s.updateBlockRepeat,
    updateBlockParams: s.updateBlockParams,
    replacePlaceholderBlock: s.replacePlaceholderBlock,
    workspace: s.workspace,
    runtime: s.runtime,
    setSelectedBlockId: s.setSelectedBlockId,
    appMode: s.appMode,
    activeActivityId: s.activeActivityId,
    activeActivityVersion: s.activeActivityVersion,
    activeDemoTabIndex: s.activeDemoTabIndex,
    activeSimId: s.activeSimId,
  }));
  const [isNumberHovered, setIsNumberHovered] = useState(false);
  const [isReplaceHovered, setIsReplaceHovered] = useState(false);

  const isPlaceholder = block.type === 'PLACEHOLDER';

  const activeCurriculumActivity =
    appMode === 'curriculum'
      ? getActivityAtVersion(activeActivityId, activeActivityVersion) ??
        getActivityLatest(activeActivityId)
      : undefined;
  const allowActionParams =
    appMode !== 'curriculum' || activeCurriculumActivity?.palette?.allowActionParams !== false;

  const activeDemoSpotlights =
    appMode === 'curriculum' &&
    activeCurriculumActivity?.format === 'explanation' &&
    activeCurriculumActivity.demoTabs?.length
      ? activeCurriculumActivity.demoTabs[
          Math.min(
            Math.max(0, activeDemoTabIndex),
            activeCurriculumActivity.demoTabs.length - 1
          )
        ]?.spotlights ?? []
      : [];
  const showDemoExecutionOrderCue =
    scope === 'MAIN' && activeDemoSpotlights.includes('execution-order');
  const showDemoLoopCounterCue =
    scope === 'MAIN' &&
    activeDemoSpotlights.includes('loop-counter') &&
    block.type === 'LOOP_START';

  const scopeBlocks = workspace[scope] || [];
  const activeStartPcs = new Set<number>([
    ...(runtime?.loopStack ?? [])
      .filter((frame) => frame.scope === scope)
      .map((frame) => frame.loopStartPc),
    ...(runtime?.whileStack ?? [])
      .filter((frame) => frame.scope === scope)
      .map((frame) => frame.whileStartPc),
    ...(runtime?.condStack ?? [])
      .filter((frame) => frame.scope === scope)
      .map((frame) => frame.ifPc),
  ]);
  const effectiveLoopMeta: BlockLoopMetadata =
    loopMeta ??
    (scopeBlocks[index]?.id === block.id
      ? computeLoopNestingMetadata(scopeBlocks, activeStartPcs).blockMeta[index]
      : undefined) ?? {
      enclosingSpans: [],
      innermostDepth: 0,
      primaryRole: 'none',
    };
  const ownLoopSpan = findOwnControlSpan(effectiveLoopMeta.enclosingSpans, 'loop', [
    'start',
    'end',
  ]);
  const ownIfSpan = findOwnControlSpan(effectiveLoopMeta.enclosingSpans, 'if', [
    'start',
    'branch',
    'end',
  ]);
  const ownWhileSpan = findOwnControlSpan(effectiveLoopMeta.enclosingSpans, 'while', [
    'start',
    'end',
  ]);
  const ownLoopSpec = ownLoopSpan
    ? getControlSpanVisualSpec(ownLoopSpan.colorFamily, 'loop')
    : null;
  const ownIfSpec = ownIfSpan
    ? getControlSpanVisualSpec(ownIfSpan.colorFamily, 'if')
    : null;
  const ownWhileSpec = ownWhileSpan
    ? getControlSpanVisualSpec(ownWhileSpan.colorFamily, 'while')
    : null;

  const currentSimEnv = getSimEnvironment(activeSimId);
  const simPaletteItems = currentSimEnv?.paletteItems || [];
  const lookupActionType =
    activeSimId === 'turtle' && block.type === 'MOVE_FWD'
      ? 'FORWARD'
      : activeSimId === 'turtle' && block.type === 'MOVE_BACK'
      ? 'BACKWARD'
      : block.type;
  const paletteItem = simPaletteItems.find((p) => p.actionType === lookupActionType);
  const activeActivity = resolveActiveCurriculumActivity(
    appMode,
    activeActivityId,
    activeActivityVersion
  );
  const policy = computeStagedPalettePolicy(
    appMode,
    activeActivity,
    simPaletteItems,
    activeDemoTabIndex
  );
  const paramDefs = isPlaceholder
    ? []
    : getAllowedParamDefs(
        lookupActionType,
        paletteItem?.paramDefs,
        appMode,
        policy.palette,
        activeActivity,
        activeDemoTabIndex
      );
  const hasParams = !isPlaceholder && paramDefs.length > 0 && allowActionParams;

  // Check if block type supports repeat multipliers
  const nonRepeatableTypes = [
    'PLACEHOLDER',
    'PEN_UP',
    'PEN_DOWN',
    'SET_PEN_COLOR',
    'SET_PEN_WIDTH',
    'LOOP_END',
    'CALL_F1',
    'CALL_F2',
    'CALL_F3',
    'VAR_ASSIGN',
    'VAR_OP',
    'IF',
    'ELSE_IF',
    'ELSE',
    'END_IF',
    'WHILE',
    'END_WHILE',
  ];
  const supportsMultiplier = paletteItem
    ? paletteItem.supportsRepeat !== false
    : !nonRepeatableTypes.includes(block.type);

  const effectiveRepeatCount =
    block.type === 'LOOP_START' && block.repeatCount === undefined ? 2 : block.repeatCount;
  const isVarRepeat =
    typeof effectiveRepeatCount === 'string' && /^[a-z]$/.test(effectiveRepeatCount);
  const showRepeatBadge =
    supportsMultiplier &&
    effectiveRepeatCount !== undefined &&
    (isVarRepeat ||
      (block.type === 'LOOP_START'
        ? (effectiveRepeatCount as number) >= 0
        : (effectiveRepeatCount as number) > 1));

  // Theme & color classes for action and parameter container
  const getBlockTheme = () => {
    if (isActive) {
      if (isPlaceholder) {
        return {
          bgClass: 'bg-amber-400',
          borderClass: 'border-dashed border-amber-100',
          iconColor: 'text-slate-950 stroke-[3]',
          activeClass:
            'animate-pulse bg-amber-400 border-dashed border-amber-100 text-slate-950 shadow-[0_0_16px_rgba(251,191,36,0.9)]',
        };
      }
      return {
        bgClass: 'bg-yellow-400',
        borderClass: 'border-yellow-200',
        iconColor: 'text-slate-950 stroke-[3]',
        activeClass:
          'bg-yellow-400 border-yellow-200 text-slate-950 shadow-[0_0_14px_rgba(250,204,21,0.85)]',
      };
    }

    let bgClass = 'bg-slate-700';
    let borderClass = 'border-slate-500';

    switch (block.type) {
      case 'PLACEHOLDER':
        bgClass = 'bg-slate-900/90';
        borderClass = 'border-dashed border-cyan-400';
        break;

      case 'MOVE_FWD':
      case 'FORWARD':
        bgClass = 'bg-sky-600';
        borderClass = 'border-sky-400';
        break;

      case 'MOVE_BACK':
      case 'BACKWARD':
        bgClass = 'bg-sky-700';
        borderClass = 'border-sky-500';
        break;

      case 'TURN_LEFT':
      case 'TURN_RIGHT':
        bgClass = 'bg-amber-600';
        borderClass = 'border-amber-400';
        break;

      case 'ARC_LEFT':
      case 'ARC_RIGHT':
        bgClass = 'bg-indigo-600';
        borderClass = 'border-indigo-400';
        break;

      case 'PEN_UP':
        bgClass = 'bg-teal-700';
        borderClass = 'border-teal-400';
        break;

      case 'PEN_DOWN':
        bgClass = 'bg-teal-600';
        borderClass = 'border-teal-300';
        break;

      case 'SET_PEN_COLOR':
      case 'SET_PEN_WIDTH':
        bgClass = 'bg-slate-800';
        borderClass = 'border-slate-500';
        break;

      case 'LOOP_START': {
        if (ownLoopSpec) {
          bgClass = ownLoopSpec.startBgClass;
          borderClass = ownLoopSpec.startBorderClass;
        } else {
          bgClass = 'bg-purple-700';
          borderClass = 'border-purple-400 border-solid';
        }
        break;
      }

      case 'LOOP_END': {
        if (ownLoopSpec) {
          bgClass = ownLoopSpec.endBgClass;
          borderClass = ownLoopSpec.endBorderClass;
        } else {
          bgClass = 'bg-purple-900';
          borderClass = 'border-purple-500 border-solid';
        }
        break;
      }

      case 'CALL_F1':
        bgClass = 'bg-emerald-600';
        borderClass = 'border-emerald-400';
        break;

      case 'CALL_F2':
        bgClass = 'bg-blue-600';
        borderClass = 'border-blue-400';
        break;

      case 'CALL_F3':
        bgClass = 'bg-rose-600';
        borderClass = 'border-rose-400';
        break;

      case 'VAR_ASSIGN':
        bgClass = 'bg-violet-700';
        borderClass = 'border-violet-400';
        break;

      case 'VAR_OP':
        bgClass = 'bg-indigo-700';
        borderClass = 'border-indigo-400';
        break;

      case 'IF': {
        bgClass = ownIfSpec ? ownIfSpec.startBgClass : 'bg-cyan-700';
        borderClass = ownIfSpec ? ownIfSpec.startBorderClass : 'border-cyan-400';
        break;
      }

      case 'ELSE_IF': {
        bgClass = ownIfSpec ? ownIfSpec.branchBgClass : 'bg-cyan-800';
        borderClass = ownIfSpec ? ownIfSpec.branchBorderClass : 'border-cyan-400';
        break;
      }

      case 'ELSE': {
        bgClass = ownIfSpec ? ownIfSpec.branchBgClass : 'bg-cyan-800';
        borderClass = ownIfSpec ? ownIfSpec.endBorderClass : 'border-cyan-500';
        break;
      }

      case 'END_IF': {
        bgClass = ownIfSpec ? ownIfSpec.endBgClass : 'bg-cyan-950';
        borderClass = ownIfSpec ? ownIfSpec.endBorderClass : 'border-cyan-500';
        break;
      }

      case 'WHILE': {
        bgClass = ownWhileSpec ? ownWhileSpec.startBgClass : 'bg-amber-600';
        borderClass = ownWhileSpec ? ownWhileSpec.startBorderClass : 'border-amber-400';
        break;
      }

      case 'END_WHILE': {
        bgClass = ownWhileSpec ? ownWhileSpec.endBgClass : 'bg-amber-950';
        borderClass = ownWhileSpec ? ownWhileSpec.endBorderClass : 'border-amber-500';
        break;
      }

      default: {
        if (paletteItem) {
          const baseBg = paletteItem.bgClass.split(' ').find((cls) => cls.startsWith('bg-'));
          bgClass = baseBg || 'bg-slate-700';
          borderClass = paletteItem.borderClass || 'border-slate-500';
        } else {
          bgClass = 'bg-slate-700';
          borderClass = 'border-slate-500';
        }
        break;
      }
    }

    return {
      bgClass,
      borderClass,
      iconColor: 'text-white stroke-[3]',
      activeClass:
        'bg-yellow-400 border-yellow-200 text-slate-950 shadow-[0_0_14px_rgba(250,204,21,0.85)]',
    };
  };

  const theme = getBlockTheme();
  const iconColor = theme.iconColor;

  // Inner icon / content for the action block
  const renderBlockIcon = () => {
    switch (block.type) {
      case 'MOVE_FWD':
      case 'FORWARD':
        return <ArrowUp className={`w-5 h-5 md:w-7 md:h-7 ${iconColor}`} />;

      case 'MOVE_BACK':
      case 'BACKWARD':
        return <ArrowDown className={`w-5 h-5 md:w-7 md:h-7 ${iconColor}`} />;

      case 'TURN_LEFT':
        return activeSimId === 'turtle' ? (
          <RotateCcw className={`w-5 h-5 md:w-7 md:h-7 ${iconColor}`} />
        ) : (
          <CornerUpLeft className={`w-5 h-5 md:w-7 md:h-7 ${iconColor}`} />
        );

      case 'TURN_RIGHT':
        return activeSimId === 'turtle' ? (
          <RotateCw className={`w-5 h-5 md:w-7 md:h-7 ${iconColor}`} />
        ) : (
          <CornerUpRight className={`w-5 h-5 md:w-7 md:h-7 ${iconColor}`} />
        );

      case 'ARC_LEFT':
        return (
          <div className="flex flex-col items-center justify-center leading-none">
            <svg
              className={`w-4 h-4 md:w-5 md:h-5 ${isActive ? 'stroke-slate-950' : 'stroke-white'}`}
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth="2.5"
            >
              <path d="M 19 20 A 15 15 0 0 0 4 5" />
              <polyline points="4 10 4 5 9 5" />
            </svg>
            <span
              className={`text-[8px] md:text-[9px] font-black ${
                isActive ? 'text-slate-950' : 'text-indigo-200'
              }`}
            >
              Arc L
            </span>
          </div>
        );

      case 'ARC_RIGHT':
        return (
          <div className="flex flex-col items-center justify-center leading-none">
            <svg
              className={`w-4 h-4 md:w-5 md:h-5 ${isActive ? 'stroke-slate-950' : 'stroke-white'}`}
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth="2.5"
            >
              <path d="M 5 20 A 15 15 0 0 1 20 5" />
              <polyline points="20 10 20 5 15 5" />
            </svg>
            <span
              className={`text-[8px] md:text-[9px] font-black ${
                isActive ? 'text-slate-950' : 'text-indigo-200'
              }`}
            >
              Arc R
            </span>
          </div>
        );

      case 'PEN_UP':
        return (
          <div className="relative flex items-center justify-center">
            <PenTool className={`w-4.5 h-4.5 md:w-6 md:h-6 ${isActive ? 'text-slate-950' : 'text-teal-200'}`} />
            <Slash className="w-5 h-5 md:w-7 md:h-7 text-red-400 stroke-[2.5] absolute -top-0.5 -left-0.5" />
          </div>
        );

      case 'PEN_DOWN':
        return (
          <PenTool
            className={`w-4.5 h-4.5 md:w-6 md:h-6 ${
              isActive ? 'text-slate-950 stroke-[2.5]' : 'text-teal-100 stroke-[2.5]'
            }`}
          />
        );

      case 'SET_PEN_COLOR':
        return (
          <Palette
            className={`w-4.5 h-4.5 md:w-6 md:h-6 stroke-[2.5] ${
              isActive ? 'text-slate-950' : 'text-pink-300'
            }`}
          />
        );

      case 'SET_PEN_WIDTH':
        return (
          <div className="flex flex-col items-center justify-center gap-0.5 md:gap-1">
            <div className={`w-4 md:w-6 h-1 md:h-1.5 rounded-full ${isActive ? 'bg-slate-950' : 'bg-white'}`} />
            <span
              className={`text-[8px] md:text-[9px] font-bold ${
                isActive ? 'text-slate-950' : 'text-slate-300'
              }`}
            >
              Width
            </span>
          </div>
        );

      case 'LOOP_START':
        return <Repeat className={`w-5 h-5 md:w-7 md:h-7 ${iconColor}`} />;

      case 'LOOP_END': {
        const endColor = ownLoopSpec ? ownLoopSpec.endIconColorClass : 'text-purple-200';
        return (
          <CornerDownLeft
            className={`w-5 h-5 md:w-7 md:h-7 ${
              isActive ? 'text-slate-950 stroke-[3]' : `${endColor} stroke-[3]`
            }`}
          />
        );
      }

      case 'CALL_F1':
        return (
          <div className="flex items-center justify-center gap-0.5 md:gap-1">
            <PhoneCall
              className={`w-4 h-4 md:w-6 md:h-6 stroke-[2.5] ${isActive ? 'text-slate-950' : 'text-white'}`}
            />
            <span
              className={`text-sm md:text-lg font-black ${isActive ? 'text-slate-950' : 'text-white'}`}
            >
              1
            </span>
          </div>
        );

      case 'CALL_F2':
        return (
          <div className="flex items-center justify-center gap-0.5 md:gap-1">
            <PhoneCall
              className={`w-4 h-4 md:w-6 md:h-6 stroke-[2.5] ${isActive ? 'text-slate-950' : 'text-white'}`}
            />
            <span
              className={`text-sm md:text-lg font-black ${isActive ? 'text-slate-950' : 'text-white'}`}
            >
              2
            </span>
          </div>
        );

      case 'CALL_F3':
        return (
          <div className="flex items-center justify-center gap-0.5 md:gap-1">
            <PhoneCall
              className={`w-4 h-4 md:w-6 md:h-6 stroke-[2.5] ${isActive ? 'text-slate-950' : 'text-white'}`}
            />
            <span
              className={`text-sm md:text-lg font-black ${isActive ? 'text-slate-950' : 'text-white'}`}
            >
              3
            </span>
          </div>
        );

      case 'VAR_ASSIGN':
      case 'VAR_OP': {
        const formatOp = (v: any): React.ReactNode => {
          if (v === '$tileDial') {
            return <TileDialGlyphSvg compact className="inline-block align-middle" />;
          }
          if (typeof v === 'string' && v.startsWith('$')) {
            return <SensorVisual sensorId={v} compact />;
          }
          return v;
        };
        if (block.type === 'VAR_ASSIGN') {
          return (
            <div className="flex items-center gap-0.5 md:gap-1 font-mono font-bold text-xs md:text-sm select-none px-1">
              <span className="text-[10px] opacity-75" aria-hidden="true">📦</span>
              <span className={`italic ${isActive ? 'text-slate-950 font-black' : 'text-amber-300'}`}>
                {block.params?.a ?? 'a'}
              </span>
              <span className={isActive ? 'text-slate-800' : 'text-slate-300'}>←</span>
              <span className={`inline-flex items-center ${isActive ? 'text-slate-950 font-black' : 'text-violet-200'}`}>
                {formatOp(block.params?.b ?? 1)}
              </span>
            </div>
          );
        }
        return (
          <div className="flex items-center gap-0.5 md:gap-1 font-mono font-bold text-[10px] md:text-xs select-none px-0.5 md:px-1">
            <span className="text-[10px] opacity-75" aria-hidden="true">📦</span>
            <span className={`italic ${isActive ? 'text-slate-950 font-black' : 'text-amber-300'}`}>
              {block.params?.a ?? 'a'}
            </span>
            <span className={isActive ? 'text-slate-800' : 'text-slate-300'}>←</span>
            <span className={`inline-flex items-center ${isActive ? 'text-slate-950 font-black' : 'text-violet-200'}`}>
              {formatOp(block.params?.b ?? 'a')}
            </span>
            <span className={isActive ? 'text-slate-950 font-black' : 'text-amber-400'}>
              {block.params?.op ?? '+'}
            </span>
            <span className={`inline-flex items-center ${isActive ? 'text-slate-950 font-black' : 'text-violet-200'}`}>
              {formatOp(block.params?.c ?? 1)}
            </span>
          </div>
        );
      }

      case 'PLACEHOLDER': {
        return (
          <div className="relative w-full h-full flex items-center justify-center">
            <span
              className={`font-black text-lg md:text-2xl leading-none select-none ${
                isActive ? 'text-slate-950' : 'text-amber-300'
              }`}
            >
              ?
            </span>
          </div>
        );
      }

      case 'IF':
        return (
          <div className="flex flex-col items-center justify-center gap-0.5 px-1">
            <span className={`text-[10px] md:text-xs font-black uppercase tracking-wider ${isActive ? 'text-slate-950' : 'text-white'}`}>
              IF
            </span>
            <ConditionBadge condition={block.params?.condition} compact />
          </div>
        );

      case 'ELSE_IF':
        return (
          <div className="flex flex-col items-center justify-center gap-0.5 px-1">
            <span className={`text-[9px] md:text-[11px] font-black uppercase tracking-tight ${isActive ? 'text-slate-950' : 'text-white'}`}>
              ELSE IF
            </span>
            <ConditionBadge condition={block.params?.condition} compact />
          </div>
        );

      case 'ELSE': {
        const elseColor = ownIfSpec ? ownIfSpec.branchTextColorClass : 'text-cyan-200';
        return (
          <span className={`text-xs md:text-sm font-black uppercase tracking-wider ${isActive ? 'text-slate-950' : elseColor}`}>
            ELSE
          </span>
        );
      }

      case 'END_IF': {
        const endColor = ownIfSpec ? ownIfSpec.endIconColorClass : 'text-cyan-200';
        return (
          <span
            className={`text-xs md:text-sm font-black uppercase tracking-wider ${
              isActive ? 'text-slate-950' : endColor
            }`}
          >
            END
          </span>
        );
      }

      case 'WHILE':
        return (
          <div className="flex flex-col items-center justify-center gap-0.5 px-1">
            <span className={`text-[10px] md:text-xs font-black uppercase tracking-wider ${isActive ? 'text-slate-950' : 'text-white'}`}>
              WHILE
            </span>
            <ConditionBadge condition={block.params?.condition} compact />
          </div>
        );

      case 'END_WHILE': {
        const endColor = ownWhileSpec ? ownWhileSpec.endIconColorClass : 'text-amber-200';
        return (
          <CornerDownLeft
            className={`w-5 h-5 md:w-7 md:h-7 ${isActive ? 'text-slate-950 stroke-[3]' : `${endColor} stroke-[3]`}`}
          />
        );
      }

      default:
        if (paletteItem?.icon) {
          return paletteItem.icon({ isActive });
        }
        return <span className="text-xs font-bold text-white truncate">{block.type}</span>;
    }
  };

  // Block visual container: left side has flat right edge when parameters are present
  const renderBlockContent = () => {
    const roundedClass = hasParams ? 'rounded-l-2xl rounded-r-none' : 'rounded-2xl';
    const borderEdgesClass = hasParams ? 'border-2 border-r-0' : 'border-2';

    return (
      <div
        className={`w-full h-full flex flex-col items-center justify-center ${roundedClass} ${borderEdgesClass} p-2 shadow-md transition-colors ${
          isActive ? theme.activeClass : `${theme.bgClass} ${theme.borderClass}`
        }`}
      >
        {renderBlockIcon()}
      </div>
    );
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        type: 'WORKSPACE_BLOCK',
        scope,
        blockId: block.id,
        index,
      })
    );
    e.dataTransfer.setData('application/x-robotemu-block', block.type);
    e.dataTransfer.effectAllowed = 'move';
    if (onDragStartBlock) {
      onDragStartBlock(e, index, block.id);
    }
  };

  const handleDragEnd = () => {
    setIsNumberHovered(false);
    setIsReplaceHovered(false);
    if (onDragEndBlock) {
      onDragEndBlock();
    }
  };

  const canAcceptMultiplierDrop =
    supportsMultiplier && (policy.allowRepeatBadges || policy.paletteVariableBadges.length > 0);

  const handleDragOverOnBlock = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('application/x-robotemu-number') && canAcceptMultiplierDrop) {
      e.dataTransfer.dropEffect = 'copy';
      setIsNumberHovered(true);
      setIsReplaceHovered(false);
      return;
    }

    if (
      isPlaceholder &&
      e.dataTransfer.types.includes('application/x-robotemu-palette-block')
    ) {
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
      setIsReplaceHovered(true);
      setIsNumberHovered(false);
      if (onClearDropIndicator) {
        onClearDropIndicator();
      }
      return;
    }

    setIsNumberHovered(false);
    setIsReplaceHovered(false);
    // Dragging a block over this node: always calculate insertion slot (before or after)
    const rect = e.currentTarget.getBoundingClientRect();
    const isAfter = e.clientX - rect.left > rect.width / 2;
    const targetIdx = isAfter ? index + 1 : index;

    if (onDragOverSlot) {
      onDragOverSlot(e, targetIdx);
    }
  };

  const handleDragLeaveOnBlock = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsNumberHovered(false);
      setIsReplaceHovered(false);
    }
  };

  const handleDropOnBlock = (e: React.DragEvent) => {
    setIsNumberHovered(false);
    setIsReplaceHovered(false);
    e.preventDefault();
    e.stopPropagation();

    const dataStr = e.dataTransfer.getData('application/json');
    if (!dataStr) return;

    try {
      const data = JSON.parse(dataStr);
      if (data.type === 'PALETTE_NUMBER' && supportsMultiplier) {
        if (typeof data.number === 'number' && !policy.allowRepeatBadges) {
          return;
        }
        if (
          typeof data.number === 'string' &&
          (!policy.allowVariables ||
            !policy.paletteVariableBadges.includes(data.number as VariableName))
        ) {
          return;
        }
        updateBlockRepeat(scope, block.id, data.number);
        return;
      }

      if (isPlaceholder && data.type === 'PALETTE_BLOCK' && data.blockType) {
        replacePlaceholderBlock(scope, block.id, data.blockType, data.params);
        return;
      }

      // Dragging a block: always insert between nodes based on cursor position
      const rect = e.currentTarget.getBoundingClientRect();
      const isAfter = e.clientX - rect.left > rect.width / 2;
      const targetIdx = isAfter ? index + 1 : index;

      if (onDropAtSlot) {
        onDropAtSlot(e, targetIdx);
      }
    } catch {
      // ignore
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      if (onSelect) onSelect();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSelectedBlockId(null);
    }
  };

  const controlBlockLabels: Record<string, string> = {
    LOOP_START: 'Loop Start',
    LOOP_END: 'Loop End',
    IF: 'If',
    ELSE_IF: 'Else If',
    ELSE: 'Else',
    END_IF: 'End If',
    WHILE: 'While',
    END_WHILE: 'End While',
  };
  const blockLabelName =
    paletteItem?.name ||
    controlBlockLabels[block.type] ||
    block.type.replace(/_/g, ' ');
  const loopDepth = effectiveLoopMeta.innermostDepth;
  const innermostKindLabel =
    effectiveLoopMeta.innermostKind === 'if'
      ? 'if'
      : effectiveLoopMeta.innermostKind === 'while'
      ? 'while'
      : 'loop';
  const innermostKindCap =
    effectiveLoopMeta.innermostKind === 'if'
      ? 'If'
      : effectiveLoopMeta.innermostKind === 'while'
      ? 'While'
      : 'Loop';
  const unmatchedKindLabel =
    block.type === 'IF' ||
    block.type === 'ELSE_IF' ||
    block.type === 'ELSE' ||
    block.type === 'END_IF'
      ? 'unmatched if'
      : block.type === 'WHILE' || block.type === 'END_WHILE'
      ? 'unmatched while'
      : 'unmatched loop';
  const loopRolePhrase =
    loopDepth > 0
      ? effectiveLoopMeta.primaryRole === 'body'
        ? loopDepth === 1
          ? `Inside ${innermostKindLabel} level 1`
          : `Inside ${innermostKindLabel} level ${loopDepth} (nested)`
        : loopDepth === 1
        ? `${innermostKindCap} level 1`
        : `${innermostKindCap} level ${loopDepth} (nested)`
      : isLoopError
      ? unmatchedKindLabel
      : '';
  const activeLoopIterationAria =
    block.type === 'LOOP_START' && iterationProgress
      ? `, iteration ${iterationProgress.current} of ${iterationProgress.total}`
      : '';
  const blockAriaLabel = isPlaceholder
    ? `Clue ? block, slot ${index + 1}${
        loopRolePhrase ? `, ${loopRolePhrase}` : ''
      }. Select and choose a palette block to replace.`
    : `${blockLabelName}, slot ${index + 1}${
        showRepeatBadge ? `, repeat ${effectiveRepeatCount}` : ''
      }${loopRolePhrase ? `, ${loopRolePhrase}` : ''}${activeLoopIterationAria}`;

  return (
    <div
      data-testid={`block-${block.id}`}
      data-block-type={block.type}
      data-active={isActive ? 'true' : 'false'}
      data-selected={isSelected ? 'true' : 'false'}
      data-loop-depth={loopDepth > 0 ? String(loopDepth) : undefined}
      data-loop-stroke={effectiveLoopMeta.innermostStroke}
      data-loop-role={loopDepth > 0 ? effectiveLoopMeta.primaryRole : undefined}
      tabIndex={0}
      role={isPlaceholder ? 'button' : undefined}
      aria-label={blockAriaLabel}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOverOnBlock}
      onDragLeave={handleDragLeaveOnBlock}
      onDrop={handleDropOnBlock}
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        e.stopPropagation();
        if (onSelect) onSelect();
      }}
      className={`relative flex items-center justify-center cursor-grab active:cursor-grabbing select-none transition-transform duration-150 flex-shrink-0 touch-none rounded-xl md:rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
        isDragging ? 'opacity-40' : ''
      } ${
        isNumberHovered || isReplaceHovered
          ? 'scale-110 z-20'
          : isLoopError
          ? 'animate-pulse z-10'
          : 'hover:scale-105'
      }`}
    >
      {/* Loop Error Warning Badge Overlay */}
      {isLoopError && (
        <div
          data-testid={`badge-loop-error-${block.id}`}
          className="absolute -top-2 -left-2 w-6 h-6 bg-red-600 border-2 border-red-300 text-white rounded-full flex items-center justify-center shadow-lg z-30 animate-bounce"
          title="Loop syntax error"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-white stroke-[2.5]" />
        </div>
      )}

      {/* Explanation Demo Execution-Order Step Badge & Active Pointer */}
      {showDemoExecutionOrderCue && !isLoopError && (
        <div
          data-testid={`demo-step-badge-${index + 1}`}
          aria-hidden="true"
          className={`absolute -top-2 -left-1.5 min-w-[18px] h-[18px] px-1 rounded-full border text-[10px] font-black flex items-center justify-center shadow-sm z-20 pointer-events-none ${
            isActive
              ? 'bg-yellow-300 border-yellow-100 text-slate-950 scale-110'
              : 'bg-slate-900/95 border-sky-400/70 text-sky-200'
          }`}
        >
          {index + 1}
        </div>
      )}
      {showDemoExecutionOrderCue && isActive && (
        <div
          data-testid="demo-active-block-pointer"
          aria-hidden="true"
          className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-[10px] leading-none text-yellow-300 drop-shadow font-black z-30 pointer-events-none"
        >
          ▼
        </div>
      )}

      {/* Main Block Visual & Attached Parameter Badges */}
      <div
        className={`flex items-center rounded-xl md:rounded-2xl transition-all ${
          isReplaceHovered
            ? 'ring-4 ring-cyan-400 shadow-[0_0_16px_rgba(34,211,238,0.8)]'
            : isNumberHovered
            ? 'ring-4 ring-yellow-400'
            : isLoopError
            ? 'ring-2 ring-red-500'
            : isSelected && isPlaceholder
            ? 'ring-3 ring-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.65)]'
            : isSelected
            ? 'ring-2 ring-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.5)]'
            : ''
        }`}
      >
        <div className={`${(block.type === 'VAR_ASSIGN' || block.type === 'VAR_OP') ? 'min-w-[40px] md:min-w-[56px] px-1 md:px-2' : 'w-[40px] md:w-[56px]'} h-[40px] md:h-[56px] flex items-center justify-center flex-shrink-0`}>
          {renderBlockContent()}
        </div>

        {/* Attached Parameter Badges on the Right */}
        {hasParams && (
          <div
            data-testid={`block-params-container-${block.id}`}
            className={`flex items-center gap-1 md:gap-1.5 pl-0.5 md:pl-1 pr-1 md:pr-2 h-[40px] md:h-[56px] -ml-px rounded-r-xl md:rounded-r-2xl border-2 border-l-0 shadow-md transition-colors flex-shrink-0 ${
              isActive
                ? 'bg-yellow-400 border-yellow-200'
                : `${theme.bgClass} ${theme.borderClass}`
            }`}
          >
            {paramDefs.map((def) => (
              <BlockParamBadge
                key={def.id}
                paramDef={def}
                value={def.id === 'length' ? (block.params?.length ?? block.params?.distance) : block.params?.[def.id]}
                actionType={block.type}
                disabled={runtime?.status === 'RUNNING'}
                onChange={(newVal) =>
                  updateBlockParams(scope, block.id, { [def.id]: newVal })
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Visual Control Nesting Bracket / Under-Bar Connectors (Color-Coded by Kind & Depth) */}
      {effectiveLoopMeta.enclosingSpans.map((span) => {
        const spec = getControlSpanVisualSpec(span.colorFamily, span.kind);
        const bottomPx = -(8 + span.tier * 8);
        const hookHeightPx = span.role === 'body' ? 4 : 7 + span.tier * 6;
        const horizontalClass =
          span.role === 'start'
            ? 'left-1.5 -right-1.5'
            : span.role === 'end'
            ? '-left-1.5 right-1.5'
            : '-left-1.5 -right-1.5';
        const borderThicknessClass =
          span.role === 'start'
            ? 'border-b-[3px] border-l-[3px] rounded-bl-md'
            : span.role === 'end'
            ? 'border-b-[3px] border-r-[3px] rounded-br-md'
            : 'border-b-[3px]';
        const colorClass = span.isActiveLoop
          ? spec.railActiveBorderColorClass
          : spec.railBorderColorClass;

        return (
          <div
            key={`loop-bracket-${span.kind}-${span.loopId}-${span.role}`}
            data-testid="loop-bracket-segment"
            data-control-kind={span.kind}
            data-loop-id={span.loopId}
            data-loop-depth={span.depth}
            data-loop-tier={span.tier}
            data-loop-stroke={span.strokeStyle}
            data-loop-role={span.role}
            data-loop-active={span.isActiveLoop ? 'true' : 'false'}
            aria-hidden="true"
            style={{
              bottom: `${bottomPx}px`,
              height: `${hookHeightPx}px`,
            }}
            className={`absolute ${horizontalClass} ${borderThicknessClass} ${spec.borderStyleClass} ${colorClass} pointer-events-none z-10 transition-colors`}
          >
            {span.role === 'branch' && (
              <span
                data-testid="loop-bracket-branch-tick"
                className={`absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-[3px] rounded-t-sm ${
                  span.isActiveLoop ? spec.railActiveTickBgClass : spec.railTickBgClass
                }`}
              />
            )}
          </div>
        );
      })}

      {/* Number Badge Slot: Absolute-positioned so it does not alter block height or vertical alignment.
          Shows <current>/<total> at runtime when iterating, or multiplier tag when idle */}
      {iterationProgress ? (
        <div
          data-testid={`badge-repeat-${block.id}`}
          data-iteration-badge="true"
          className={`absolute -bottom-1.5 -right-1.5 z-20 flex items-center justify-center min-w-[24px] md:min-w-[28px] h-5 md:h-6 px-1 rounded-full border-2 border-yellow-300 bg-slate-900 shadow-lg text-[10px] md:text-xs ${
            showDemoLoopCounterCue
              ? 'ring-2 ring-purple-400/90 shadow-[0_0_12px_rgba(192,132,252,0.85)]'
              : ''
          }`}
        >
          {block.type === 'LOOP_START' ? (
            <span data-testid="loop-iteration-badge" className="inline-flex items-center">
              <span
                data-testid="iteration-current"
                className="text-amber-400 font-extrabold"
              >
                {iterationProgress.current}
              </span>
              <span className="text-slate-400 font-bold mx-0.5">/</span>
              <span
                data-testid="iteration-total"
                className="text-slate-100 font-bold"
              >
                {iterationProgress.total}
              </span>
            </span>
          ) : (
            <>
              <span
                data-testid="iteration-current"
                className="text-amber-400 font-extrabold"
              >
                {iterationProgress.current}
              </span>
              <span className="text-slate-400 font-bold mx-0.5">/</span>
              <span
                data-testid="iteration-total"
                className="text-slate-100 font-bold"
              >
                {iterationProgress.total}
              </span>
            </>
          )}
        </div>
      ) : showRepeatBadge ? (
        <button
          type="button"
          data-testid={`badge-repeat-${block.id}`}
          onClick={(e) => {
            e.stopPropagation();
            updateBlockRepeat(scope, block.id, block.type === 'LOOP_START' ? 2 : undefined);
          }}
          className="absolute -bottom-1.5 -right-1 z-20 flex items-center justify-center w-5 h-5 md:w-6 md:h-6 rounded-full border-2 border-yellow-200 bg-yellow-400 hover:bg-red-500 hover:border-red-300 hover:text-white text-slate-950 font-black text-[10px] md:text-xs shadow-md transition-colors cursor-pointer"
          title={block.type === 'LOOP_START' ? 'Click to reset to 2' : 'Click to remove tag'}
        >
          {typeof effectiveRepeatCount === 'string' ? (
            <span className="italic font-mono">{effectiveRepeatCount}</span>
          ) : (
            effectiveRepeatCount
          )}
        </button>
      ) : null}
    </div>
  );
});

