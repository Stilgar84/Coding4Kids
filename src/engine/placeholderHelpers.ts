import { CodeBlock, Direction, GridState, ScopeType, WorkspaceState } from '../types';
import {
  CurriculumActivity,
  GhostStepPreview,
  PlaceholderHintCategory,
} from '../data/curriculum/types';
import { gridSimulationEnvironment } from '../simulations/grid/gridEnvironment';
import { createInitialInterpreterState, tickInterpreter } from './interpreter';
import { getPlaceholderHintCategory } from './serialization/types';

export { getPlaceholderHintCategory };

export interface GhostPreviewPose {
  x: number;
  y: number;
  dir: Direction;
  stepIndex: number;
  actionBlockType?: string;
}

export interface GhostPreviewState {
  active: boolean;
  activityId: string;
  poses: GhostPreviewPose[];
  currentStepIndex: number;
  runId: number;
}

/**
 * Computes the deterministic step-by-step robot pose trajectory for a Tier 1 Ghost-Step Preview
 * without mutating the learner's live GridState or WorkspaceState.
 */
export function computeGhostPreviewSteps(
  grid: GridState,
  ghostPreview: GhostStepPreview
): GhostPreviewPose[] {
  let simGrid = gridSimulationEnvironment.resetState(grid);
  const poses: GhostPreviewPose[] = [
    {
      x: simGrid.robot.x,
      y: simGrid.robot.y,
      dir: simGrid.robot.dir,
      stepIndex: 0,
    },
  ];

  const maxSteps = Math.max(1, ghostPreview.maxSteps ?? 3);
  let runtime = createInitialInterpreterState();

  for (let step = 1; step <= maxSteps; step++) {
    const topFrame = runtime.callStack[runtime.callStack.length - 1];
    const pendingBlock = topFrame
      ? ghostPreview.previewWorkspace[topFrame.scope]?.[topFrame.pc]
      : undefined;

    const res = tickInterpreter(
      runtime,
      ghostPreview.previewWorkspace,
      simGrid,
      gridSimulationEnvironment
    );
    runtime = res.nextRuntime;
    simGrid = res.nextGrid;

    if (runtime.status === 'PAUSED') {
      break;
    }

    poses.push({
      x: simGrid.robot.x,
      y: simGrid.robot.y,
      dir: simGrid.robot.dir,
      stepIndex: poses.length,
      actionBlockType: pendingBlock?.type,
    });

    if (res.done || runtime.callStack.length === 0) {
      break;
    }
  }

  return poses;
}

/**
 * Infers the pedagogical PlaceholderHintCategory for a concrete block type.
 */
export function inferHintCategoryForBlockType(blockType: string): PlaceholderHintCategory {
  switch (blockType) {
    case 'MOVE_FWD':
    case 'MOVE_BACK':
    case 'FORWARD':
    case 'BACKWARD':
    case 'ARC_LEFT':
    case 'ARC_RIGHT':
    case 'CURSOR_STEP':
      return 'motion';
    case 'TURN_LEFT':
    case 'TURN_RIGHT':
    case 'CURSOR_TURN':
      return 'turn';
    case 'PICK_UP':
    case 'USE_DROP':
    case 'PEN_UP':
    case 'PEN_DOWN':
    case 'SET_PEN_COLOR':
    case 'SET_PEN_WIDTH':
      return 'item';
    case 'LOOP_START':
    case 'LOOP_END':
      return 'loop';
    case 'CALL_F1':
    case 'CALL_F2':
    case 'CALL_F3':
      return 'function';
    case 'IF':
    case 'ELSE':
    case 'END_IF':
    case 'WHILE':
      return 'conditional';
    case 'VAR_ASSIGN':
      return 'variable';
    case 'VAR_OP':
      return 'operator';
    default:
      return 'any';
  }
}

/**
 * Determines whether a palette block matches the active/selected '?' Placeholder hintCategory.
 */
export function doesBlockMatchHintCategory(
  blockType: string,
  itemCategory: string | undefined,
  hintCategory: PlaceholderHintCategory
): boolean {
  switch (hintCategory) {
    case 'any':
      return true;
    case 'turn':
      return (
        blockType === 'TURN_LEFT' ||
        blockType === 'TURN_RIGHT' ||
        blockType === 'CURSOR_TURN' ||
        itemCategory === 'turn'
      );
    case 'motion':
      return (
        blockType === 'MOVE_FWD' ||
        blockType === 'MOVE_BACK' ||
        blockType === 'FORWARD' ||
        blockType === 'BACKWARD' ||
        blockType === 'ARC_LEFT' ||
        blockType === 'ARC_RIGHT' ||
        blockType === 'CURSOR_STEP' ||
        (itemCategory === 'motion' &&
          blockType !== 'TURN_LEFT' &&
          blockType !== 'TURN_RIGHT' &&
          blockType !== 'CURSOR_TURN')
      );
    case 'item':
      return (
        blockType === 'PICK_UP' ||
        blockType === 'USE_DROP' ||
        itemCategory === 'item' ||
        itemCategory === 'pen' ||
        itemCategory === 'sound' ||
        itemCategory === 'led'
      );
    case 'loop':
      return blockType === 'LOOP_START' || blockType === 'LOOP_END';
    case 'function':
      return blockType === 'CALL_F1' || blockType === 'CALL_F2' || blockType === 'CALL_F3';
    case 'conditional':
      return (
        blockType === 'IF' ||
        blockType === 'ELSE' ||
        blockType === 'END_IF' ||
        blockType === 'WHILE'
      );
    case 'sensor':
      return itemCategory === 'sensor';
    case 'variable':
      return blockType === 'VAR_ASSIGN' || blockType === 'VAR_OP';
    case 'operator':
      return blockType === 'VAR_OP';
    case 'socket':
      return itemCategory === 'socket';
    default:
      return false;
  }
}

/**
 * Human-readable accessibility label for a PlaceholderHintCategory.
 */
export function getPlaceholderHintLabel(hintCategory: PlaceholderHintCategory): string {
  switch (hintCategory) {
    case 'motion':
      return 'movement';
    case 'turn':
      return 'turn';
    case 'item':
      return 'item action';
    case 'loop':
      return 'loop';
    case 'function':
      return 'function call';
    case 'conditional':
      return 'condition';
    case 'sensor':
      return 'sensor';
    case 'variable':
      return 'variable';
    case 'operator':
      return 'math operator';
    case 'socket':
      return 'parameter socket';
    case 'any':
    default:
      return 'any action';
  }
}

/**
 * Synthesizes a clean '?' starter scaffold from a reference solution when an activity
 * does not explicitly specify `partialHelp.scaffoldWorkspace`.
 * Preserves structural loop brackets and replaces key action steps with hinted PLACEHOLDER blocks.
 */
export function buildFallbackScaffoldFromSolution(
  referenceSolution: WorkspaceState
): WorkspaceState {
  const transformScope = (blocks: CodeBlock[] = [], scope: ScopeType): CodeBlock[] => {
    if (blocks.length === 0) return [];

    const actionIndices: number[] = [];
    blocks.forEach((b, idx) => {
      if (b.type !== 'LOOP_START' && b.type !== 'LOOP_END') {
        actionIndices.push(idx);
      }
    });

    const placeholderIndexSet = new Set<number>();
    if (actionIndices.length === 1) {
      placeholderIndexSet.add(actionIndices[0]);
    } else if (actionIndices.length === 2) {
      placeholderIndexSet.add(actionIndices[1]);
    } else if (actionIndices.length >= 3) {
      // Replace up to 2 strategic action slots (middle and final step) while keeping starter anchors
      const midIdx = actionIndices[Math.floor(actionIndices.length / 2)];
      const lastIdx = actionIndices[actionIndices.length - 1];
      placeholderIndexSet.add(midIdx);
      if (actionIndices.length >= 4) {
        placeholderIndexSet.add(lastIdx);
      }
    }

    return blocks.map((block, idx) => {
      if (!placeholderIndexSet.has(idx)) {
        return {
          ...block,
          ...(block.params ? { params: JSON.parse(JSON.stringify(block.params)) } : {}),
        };
      }
      const hintCategory = inferHintCategoryForBlockType(block.type);
      return {
        id: `scaf_${scope}_PLACEHOLDER_${idx}`,
        type: 'PLACEHOLDER',
        params: { hintCategory },
      };
    });
  };

  return {
    MAIN: transformScope(referenceSolution.MAIN, 'MAIN'),
    F1: transformScope(referenceSolution.F1, 'F1'),
    F2: transformScope(referenceSolution.F2, 'F2'),
    F3: transformScope(referenceSolution.F3, 'F3'),
  };
}

/**
 * Resolves the Tier 1 '?' Scaffold workspace for an activity (explicit `scaffoldWorkspace`
 * if provided, or synthesized fallback scaffold when `referenceSolution` is present).
 */
export function resolveActivityScaffoldWorkspace(
  activity?: CurriculumActivity | null
): WorkspaceState | null {
  if (!activity) return null;
  if (activity.partialHelp?.scaffoldWorkspace) {
    return activity.partialHelp.scaffoldWorkspace;
  }
  if (activity.referenceSolution) {
    return buildFallbackScaffoldFromSolution(activity.referenceSolution);
  }
  return null;
}
