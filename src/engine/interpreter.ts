import {
  WorkspaceState,
  InterpreterRuntimeState,
  ScopeType,
  CodeBlock,
  StackFrame,
  LoopFrame,
  GridState,
} from '../types';
import { SimulationEnvironment } from './simulation/types';
import { gridSimulationEnvironment } from '../simulations/grid/gridEnvironment';

export const MAX_CALL_STACK_DEPTH = 32;
export const MAX_TOTAL_STEPS = 1000;

export function createInitialInterpreterState(): InterpreterRuntimeState {
  return {
    callStack: [{ scope: 'MAIN', pc: 0, subTickLeft: 0 }],
    loopStack: [],
    activeBlockId: null,
    activeScope: 'MAIN',
    status: 'RUNNING',
    stepCount: 0,
    activeRepeatProgress: null,
  };
}

export interface TickResult<TState = any> {
  nextRuntime: InterpreterRuntimeState;
  nextGrid: TState;
  done: boolean;
}

export interface LoopValidationResult {
  isValid: boolean;
  unclosedLoopStartIds: string[];
  orphanLoopEndIds: string[];
  hasError: boolean;
}

/**
 * Validates loop structure in a list of blocks, checking for unclosed LOOP_START
 * and orphan LOOP_END blocks.
 */
export function validateLoopStructure(blocks: CodeBlock[]): LoopValidationResult {
  const unclosedLoopStartIds: string[] = [];
  const orphanLoopEndIds: string[] = [];
  const openStack: CodeBlock[] = [];

  for (const block of blocks) {
    if (block.type === 'LOOP_START') {
      openStack.push(block);
    } else if (block.type === 'LOOP_END') {
      if (openStack.length > 0) {
        openStack.pop();
      } else {
        orphanLoopEndIds.push(block.id);
      }
    }
  }

  for (const block of openStack) {
    unclosedLoopStartIds.push(block.id);
  }

  const hasError = unclosedLoopStartIds.length > 0 || orphanLoopEndIds.length > 0;

  return {
    isValid: !hasError,
    unclosedLoopStartIds,
    orphanLoopEndIds,
    hasError,
  };
}

/**
 * Finds the index of the matching LOOP_END for a LOOP_START at startIdx in blocks array.
 */
export function findMatchingLoopEnd(blocks: CodeBlock[], startIdx: number): number {
  let depth = 0;
  for (let i = startIdx; i < blocks.length; i++) {
    if (blocks[i].type === 'LOOP_START') {
      depth++;
    } else if (blocks[i].type === 'LOOP_END') {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1; // Unmatched loop
}

/**
 * Performs a single atomic lockstep execution tick decoupled from any specific simulation.
 */
export function tickInterpreter<TState = GridState>(
  runtime: InterpreterRuntimeState,
  workspace: WorkspaceState,
  simState: TState,
  simEnv: SimulationEnvironment<TState> = gridSimulationEnvironment as unknown as SimulationEnvironment<TState>
): TickResult<TState> {
  // If already stopped, do nothing
  if (runtime.status === 'SUCCESS' || runtime.status === 'COLLISION') {
    return { nextRuntime: runtime, nextGrid: simState, done: true };
  }

  // Safety guard against infinite loops
  if (runtime.stepCount >= MAX_TOTAL_STEPS) {
    const nextSimState = (simState && typeof simState === 'object')
      ? { ...simState, status: 'COLLISION' }
      : simState;
    return {
      nextRuntime: { ...runtime, status: 'COLLISION', activeBlockId: null },
      nextGrid: nextSimState,
      done: true,
    };
  }

  const callStack: StackFrame[] = [...runtime.callStack];
  const loopStack: LoopFrame[] = [...runtime.loopStack];

  // Pop finished stack frames
  while (callStack.length > 0) {
    const top = callStack[callStack.length - 1];
    const scopeBlocks = workspace[top.scope] || [];
    if (top.pc < scopeBlocks.length) {
      break;
    }
    callStack.pop();
  }

  // If call stack is empty, program has completed
  if (callStack.length === 0) {
    const finalStatus = simEnv.evaluateCompletion
      ? simEnv.evaluateCompletion(simState)
      : 'IDLE';

    const nextSimState = (simState && typeof simState === 'object')
      ? { ...simState, status: finalStatus }
      : simState;

    return {
      nextRuntime: {
        ...runtime,
        callStack: [],
        activeBlockId: null,
        status: finalStatus,
      },
      nextGrid: nextSimState,
      done: true,
    };
  }

  const currentFrame = { ...callStack[callStack.length - 1] };
  const scopeBlocks = workspace[currentFrame.scope] || [];
  const currentBlock = scopeBlocks[currentFrame.pc];

  if (!currentBlock) {
    callStack.pop();
    return tickInterpreter({ ...runtime, callStack }, workspace, simState, simEnv);
  }

  const blockType = currentBlock.type;
  const activeBlockId = currentBlock.id;
  const activeScope = currentFrame.scope;

  // Handle Function Calls
  if (blockType === 'CALL_F1' || blockType === 'CALL_F2' || blockType === 'CALL_F3') {
    const targetScope: ScopeType =
      blockType === 'CALL_F1' ? 'F1' : blockType === 'CALL_F2' ? 'F2' : 'F3';

    // Advance caller's PC
    currentFrame.pc++;
    callStack[callStack.length - 1] = currentFrame;

    // Check stack overflow
    if (callStack.length >= MAX_CALL_STACK_DEPTH) {
      const nextSimState = (simState && typeof simState === 'object')
        ? { ...simState, status: 'COLLISION' }
        : simState;
      return {
        nextRuntime: { ...runtime, status: 'COLLISION', activeBlockId },
        nextGrid: nextSimState,
        done: true,
      };
    }

    // Push new frame
    callStack.push({ scope: targetScope, pc: 0, subTickLeft: 0 });

    return {
      nextRuntime: {
        ...runtime,
        callStack,
        loopStack,
        activeBlockId,
        activeScope: targetScope,
        stepCount: runtime.stepCount + 1,
        activeRepeatProgress: null,
      },
      nextGrid: simState,
      done: false,
    };
  }

  // Handle LOOP_START
  if (blockType === 'LOOP_START') {
    const matchingEnd = findMatchingLoopEnd(scopeBlocks, currentFrame.pc);
    const loopCount = currentBlock.repeatCount ?? 2;

    if (matchingEnd === -1 || loopCount <= 0) {
      // Skip invalid loop or jump past
      currentFrame.pc++;
      callStack[callStack.length - 1] = currentFrame;
    } else {
      loopStack.push({
        scope: currentFrame.scope,
        loopStartPc: currentFrame.pc,
        loopEndPc: matchingEnd,
        currentIteration: 1,
        totalIterations: loopCount,
      });
      currentFrame.pc++;
      callStack[callStack.length - 1] = currentFrame;
    }

    return {
      nextRuntime: {
        ...runtime,
        callStack,
        loopStack,
        activeBlockId,
        activeScope,
        stepCount: runtime.stepCount + 1,
        activeRepeatProgress: null,
      },
      nextGrid: simState,
      done: false,
    };
  }

  // Handle LOOP_END
  if (blockType === 'LOOP_END') {
    const topLoop = loopStack.length > 0 ? loopStack[loopStack.length - 1] : null;

    if (topLoop && topLoop.scope === currentFrame.scope && topLoop.loopEndPc === currentFrame.pc) {
      if (topLoop.currentIteration < topLoop.totalIterations) {
        topLoop.currentIteration++;
        currentFrame.pc = topLoop.loopStartPc + 1;
      } else {
        loopStack.pop();
        currentFrame.pc++;
      }
    } else {
      currentFrame.pc++;
    }

    callStack[callStack.length - 1] = currentFrame;

    return {
      nextRuntime: {
        ...runtime,
        callStack,
        loopStack,
        activeBlockId,
        activeScope,
        stepCount: runtime.stepCount + 1,
        activeRepeatProgress: null,
      },
      nextGrid: simState,
      done: false,
    };
  }

  // Handle Domain Action blocks (e.g. MOVE_FWD, TURN_LEFT, SET_PEN_COLOR, etc.)
  const totalRepeats = currentBlock.repeatCount ?? 1;
  const currentSubTick = currentFrame.subTickLeft > 0 ? currentFrame.subTickLeft : totalRepeats;
  const iterationIndex = totalRepeats - currentSubTick + 1;
  const activeRepeatProgress =
    totalRepeats > 1
      ? { blockId: currentBlock.id, current: iterationIndex, total: totalRepeats }
      : null;

  // Delegate action to the active simulation environment!
  const actionRes = simEnv.executeAction(blockType, simState, {
    repeatCount: totalRepeats,
    params: currentBlock.params,
  });

  if (actionRes.isCollision) {
    return {
      nextRuntime: {
        ...runtime,
        status: 'COLLISION',
        activeBlockId,
        activeScope,
        stepCount: runtime.stepCount + 1,
        activeRepeatProgress,
      },
      nextGrid: actionRes.nextState,
      done: true,
    };
  }

  const remainingSubTicks = currentSubTick - 1;
  if (remainingSubTicks <= 0) {
    currentFrame.pc++;
    currentFrame.subTickLeft = 0;
  } else {
    currentFrame.subTickLeft = remainingSubTicks;
  }

  callStack[callStack.length - 1] = currentFrame;

  const isDone = actionRes.isSuccess || actionRes.status === 'SUCCESS';

  return {
    nextRuntime: {
      ...runtime,
      callStack,
      loopStack,
      activeBlockId,
      activeScope,
      status: actionRes.status,
      stepCount: runtime.stepCount + 1,
      activeRepeatProgress,
    },
    nextGrid: actionRes.nextState,
    done: isDone,
  };
}
