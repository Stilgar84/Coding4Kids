import {
  WorkspaceState,
  InterpreterRuntimeState,
  ScopeType,
  CodeBlock,
  StackFrame,
  LoopFrame,
  GridState,
  SimulationStatus,
  VariableName,
  BinaryOp,
} from '../types';
import { SimulationEnvironment } from './simulation/types';
import { gridSimulationEnvironment } from '../simulations/grid/gridEnvironment';

export const MAX_CALL_STACK_DEPTH = 32;
export const MAX_TOTAL_STEPS = 10000;

export function isSensorToken(val: unknown): val is string {
  return typeof val === 'string' && /^\$[a-zA-Z][a-zA-Z0-9_]*$/.test(val.trim());
}

export function evaluateValue<TState = any>(
  val: number | string | undefined,
  variables: Record<string, number>,
  defaultValue: number = 0,
  simEnv?: SimulationEnvironment<TState>,
  simState?: TState
): number {
  if (val === undefined || val === null) return defaultValue;
  if (typeof val === 'number') return isNaN(val) ? defaultValue : val;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^[a-z]$/.test(trimmed)) {
      return variables[trimmed] ?? 0;
    }
    if (isSensorToken(trimmed) && simEnv?.readSensor && simState !== undefined) {
      const sensed = simEnv.readSensor(trimmed, simState);
      return Number.isFinite(sensed) ? sensed : defaultValue;
    }
    const num = Number(trimmed);
    return isNaN(num) ? defaultValue : num;
  }
  return defaultValue;
}

export function evaluateBinaryOp(b: number, op: BinaryOp | string, c: number): number {
  switch (op) {
    case '+': return b + c;
    case '-': return b - c;
    case '*': return b * c;
    case '/': return c === 0 ? 0 : b / c; // Safe divide by zero
    case '%': return c === 0 ? 0 : b % c;
    case '==': return b === c ? 1 : 0;
    case '!=': return b !== c ? 1 : 0;
    case '<': return b < c ? 1 : 0;
    case '<=': return b <= c ? 1 : 0;
    case '>': return b > c ? 1 : 0;
    case '>=': return b >= c ? 1 : 0;
    case '&&': return (b !== 0 && c !== 0) ? 1 : 0;
    case '||': return (b !== 0 || c !== 0) ? 1 : 0;
    default: return 0;
  }
}

export function createInitialInterpreterState(): InterpreterRuntimeState {
  return {
    callStack: [{ scope: 'MAIN', pc: 0, subTickLeft: 0 }],
    loopStack: [],
    activeBlockId: null,
    activeScope: 'MAIN',
    status: 'RUNNING',
    stepCount: 0,
    activeRepeatProgress: null,
    variables: {} as Record<VariableName, number>,
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
  const runningStatus: SimulationStatus =
    runtime.status === 'PAUSED' ? 'RUNNING' : runtime.status;

  // Handle '?' Placeholder block (OP_PLACEHOLDER = 0x09):
  // Pause cleanly on '?' without advancing PC or erroring out.
  if (blockType === 'PLACEHOLDER') {
    const nextSimState =
      simState && typeof simState === 'object'
        ? { ...simState, status: 'PAUSED' as SimulationStatus }
        : simState;

    return {
      nextRuntime: {
        ...runtime,
        callStack,
        loopStack,
        activeBlockId,
        activeScope,
        status: 'PAUSED',
        activeRepeatProgress: null,
      },
      nextGrid: nextSimState,
      done: true,
    };
  }

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
        status: runningStatus,
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

  // Handle Variable Assignment: a = b
  if (blockType === 'VAR_ASSIGN') {
    const a = (currentBlock.params?.a || 'a') as VariableName;
    const bVal = evaluateValue(currentBlock.params?.b, runtime.variables, 0, simEnv, simState);
    const nextVariables: Record<VariableName, number> = {
      ...runtime.variables,
      [a]: bVal,
    };
    currentFrame.pc++;
    callStack[callStack.length - 1] = currentFrame;

    return {
      nextRuntime: {
        ...runtime,
        status: runningStatus,
        callStack,
        loopStack,
        activeBlockId,
        activeScope,
        variables: nextVariables,
        stepCount: runtime.stepCount + 1,
        activeRepeatProgress: null,
      },
      nextGrid: simState,
      done: false,
    };
  }

  // Handle Variable Binary Operation: a = b op c
  if (blockType === 'VAR_OP') {
    const a = (currentBlock.params?.a || 'a') as VariableName;
    const op = (currentBlock.params?.op || '+') as BinaryOp;
    const bVal = evaluateValue(currentBlock.params?.b, runtime.variables, 0, simEnv, simState);
    const cVal = evaluateValue(currentBlock.params?.c, runtime.variables, 0, simEnv, simState);
    const result = evaluateBinaryOp(bVal, op, cVal);
    const nextVariables: Record<VariableName, number> = {
      ...runtime.variables,
      [a]: result,
    };
    currentFrame.pc++;
    callStack[callStack.length - 1] = currentFrame;

    return {
      nextRuntime: {
        ...runtime,
        status: runningStatus,
        callStack,
        loopStack,
        activeBlockId,
        activeScope,
        variables: nextVariables,
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
    const rawCount = currentBlock.repeatCount !== undefined
      ? evaluateValue(currentBlock.repeatCount, runtime.variables, 2, simEnv, simState)
      : 2;
    const loopCount = Math.round(rawCount);

    if (loopCount <= 0) {
      // Conditional skip: Jump directly past the matching LOOP_END block!
      if (matchingEnd !== -1) {
        currentFrame.pc = matchingEnd + 1;
      } else {
        currentFrame.pc++;
      }
      callStack[callStack.length - 1] = currentFrame;
      return {
        nextRuntime: {
          ...runtime,
          status: runningStatus,
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

    if (matchingEnd === -1) {
      // Skip invalid loop
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
        status: runningStatus,
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
        status: runningStatus,
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
  const rawRepeats = currentBlock.repeatCount !== undefined
    ? evaluateValue(currentBlock.repeatCount, runtime.variables, 1, simEnv, simState)
    : 1;
  const totalRepeats = Math.round(rawRepeats);

  if (totalRepeats <= 0) {
    // 0-repeat skip: Do not execute simulation action, advance directly to next block
    currentFrame.pc++;
    currentFrame.subTickLeft = 0;
    callStack[callStack.length - 1] = currentFrame;
    return {
      nextRuntime: {
        ...runtime,
        status: runningStatus,
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

  const currentSubTick = currentFrame.subTickLeft > 0 ? currentFrame.subTickLeft : totalRepeats;
  const iterationIndex = totalRepeats - currentSubTick + 1;
  const activeRepeatProgress =
    totalRepeats > 1
      ? { blockId: currentBlock.id, current: iterationIndex, total: totalRepeats }
      : null;

  // Resolve numerical parameters & sensors in params
  const resolvedParams: Record<string, any> = {};
  if (currentBlock.params) {
    for (const [k, v] of Object.entries(currentBlock.params)) {
      if (typeof v === 'string' && (/^[a-z]$/.test(v.trim()) || isSensorToken(v))) {
        resolvedParams[k] = evaluateValue(v, runtime.variables, 0, simEnv, simState);
      } else {
        resolvedParams[k] = v;
      }
    }
  }

  // Delegate action to the active simulation environment!
  const actionRes = simEnv.executeAction(blockType, simState, {
    repeatCount: totalRepeats,
    params: resolvedParams,
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
