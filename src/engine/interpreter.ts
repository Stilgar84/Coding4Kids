import {
  WorkspaceState,
  InterpreterRuntimeState,
  ScopeType,
  CodeBlock,
  StackFrame,
  LoopFrame,
  WhileFrame,
  CondFrame,
  GridState,
  SimulationStatus,
  VariableName,
  BinaryOp,
  TypedValue,
  VariableRuntimeValue,
  isTypedValue,
  PALETTE_COLORS,
  PaletteColor,
} from '../types';
import { SimulationEnvironment } from './simulation/types';
import { gridSimulationEnvironment } from '../simulations/grid/gridEnvironment';
import { ConditionExpr } from '../data/curriculum/types';
import { evaluateConditionExpr } from './serialization/conditionSerializer';
import {
  TURTLE_COLOR_PALETTE,
  colorLiteralNameToIdx,
  isColorLiteralString,
  isSensorRefString,
  parseSensorRef,
} from './serialization/types';

export const MAX_CALL_STACK_DEPTH = 32;
export const MAX_TOTAL_STEPS = 10000;

export function isSensorToken(val: unknown): val is string {
  return typeof val === 'string' && /^\$[a-zA-Z][a-zA-Z0-9_]*(\[[^\]]+\])?$/.test(val.trim());
}

export function nextMulberry32(seed: number): { nextVal: number; nextSeed: number } {
  const s = (Math.trunc(seed) + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const nextVal = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { nextVal, nextSeed: s };
}

export function mulberry32(seed: number): () => number {
  let s = Math.trunc(seed);
  return () => {
    const res = nextMulberry32(s);
    s = res.nextSeed;
    return res.nextVal;
  };
}

export interface EvaluateValueContext<TState = any> {
  simEnv?: SimulationEnvironment<TState>;
  simState?: TState;
  sceneInput?: number | string | TypedValue;
  seed?: number;
  pointer?: { x: number; y: number; isDown: boolean };
  onRuntimeError?: (status: SimulationStatus) => void;
}

export function resolveSimulationSensor<TState>(
  sensorName: string,
  simState?: TState,
  simEnv?: SimulationEnvironment<TState>
): number | TypedValue | undefined {
  if (simEnv?.readTypedSensor && simState !== undefined) {
    try {
      const typedSensed = simEnv.readTypedSensor(sensorName, simState);
      if (typedSensed !== undefined) {
        return typedSensed;
      }
    } catch {
      // fallback below
    }
  }

  if (!simState || typeof simState !== 'object') {
    return undefined;
  }

  const st = simState as any;
  const parsed = parseSensorRef(sensorName);
  const base = parsed?.base ?? sensorName;
  const param = parsed?.param;

  const resolveDepotContainer = (stationParam?: string | number): any[] | undefined => {
    const raw = String(
      stationParam !== undefined && stationParam !== 'CURRENT' && stationParam !== '0' && stationParam !== 0
        ? stationParam
        : typeof st.workerStation === 'string'
        ? st.workerStation
        : 'STACK_1'
    )
      .trim()
      .toUpperCase();
    if (raw === 'QUEUE' || raw === '4') return st.queue;
    if (raw === 'INPUT' || raw === 'IN' || raw === '5') return st.input;
    if (raw === 'STACK_2' || raw === '2' || raw === 'STACK 2') return st.stacks?.[1];
    if (raw === 'STACK_3' || raw === '3' || raw === 'STACK 3') return st.stacks?.[2];
    return st.stacks?.[0];
  };

  // Depot typed & indexed sensor reads
  if (base === '$heldValue') {
    if (!st.heldItem || st.heldItem.value === undefined) return undefined;
    return st.heldItem.value;
  }
  if (base === '$heldColor') {
    if (!st.heldItem || !st.heldItem.color) return undefined;
    return { type: 'color', value: String(st.heldItem.color).toLowerCase() as PaletteColor };
  }
  if (base === '$topValue') {
    const container = resolveDepotContainer(param);
    if (!container || container.length === 0) return undefined;
    const rawStation = String(param ?? st.workerStation ?? 'STACK_1').toUpperCase();
    const isFifo = rawStation === 'QUEUE' || rawStation === '4' || rawStation === 'INPUT' || rawStation === 'IN' || rawStation === '5';
    const top = isFifo ? container[0] : container[container.length - 1];
    if (typeof top === 'number') return top;
    if (top && typeof top === 'object' && top.value !== undefined) return top.value;
    return undefined;
  }
  if (base === '$topColor') {
    const container = resolveDepotContainer(param);
    if (!container || container.length === 0) return undefined;
    const rawStation = String(param ?? st.workerStation ?? 'STACK_1').toUpperCase();
    const isFifo = rawStation === 'QUEUE' || rawStation === '4' || rawStation === 'INPUT' || rawStation === 'IN' || rawStation === '5';
    const top = isFifo ? container[0] : container[container.length - 1];
    if (typeof top === 'string') return { type: 'color', value: top.toLowerCase() as PaletteColor };
    if (top && typeof top === 'object' && top.color) {
      return { type: 'color', value: String(top.color).toLowerCase() as PaletteColor };
    }
    return undefined;
  }
  if (base === '$stationLen') {
    const container = resolveDepotContainer(param);
    return (container || []).length;
  }

  // Switchyard typed & indexed sensor reads
  if (base === '$itemWeight') {
    const car = st.queue?.[0];
    if (!car) return undefined;
    return car.weight ?? 1;
  }
  if (base === '$itemColor') {
    const car = st.queue?.[0];
    if (!car || !car.color) return undefined;
    return { type: 'color', value: String(car.color).toLowerCase() as PaletteColor };
  }
  if (base === '$dockCount') {
    const rawIdx = (param ?? '0').toUpperCase();
    const idx = rawIdx === 'A' ? 0 : rawIdx === 'B' ? 1 : rawIdx === 'C' ? 2 : Number(rawIdx) || 0;
    const dock = st.docks?.[idx] ?? st.docks?.find?.((d: any) => d.id === `DOCK_${rawIdx}`);
    return (dock?.items ?? dock?.received ?? []).length;
  }
  if (base === '$dockQuota') {
    const rawIdx = (param ?? '0').toUpperCase();
    const idx = rawIdx === 'A' ? 0 : rawIdx === 'B' ? 1 : rawIdx === 'C' ? 2 : Number(rawIdx) || 0;
    const dock = st.docks?.[idx] ?? st.docks?.find?.((d: any) => d.id === `DOCK_${rawIdx}`);
    return dock?.quota ?? dock?.spec?.quota ?? st.dockQuotas?.[idx] ?? 0;
  }

  // Beat sensor reads
  if (base === '$cursorX') return st.cursor?.x ?? 1;
  if (base === '$cursorY') return st.cursor?.y ?? 1;
  if (base === '$beatIndex') return st.beatIndex ?? 0;

  if (simEnv?.readSensor && simState !== undefined) {
    try {
      const sensed = simEnv.readSensor(sensorName, simState);
      if (sensed !== undefined && (typeof sensed !== 'number' || !Number.isNaN(sensed))) {
        return sensed;
      }
    } catch {
      // fallback below
    }
  }

  // Turtle & Grid fallback sensor reads
  if (base === '$x') return st.x ?? st.robot?.x ?? 0;
  if (base === '$y') return st.y ?? st.robot?.y ?? 0;
  if (base === '$heading') return st.heading ?? 0;
  if (base === '$tileDial') {
    const rx = st.robot?.x;
    const ry = st.robot?.y;
    if (rx !== undefined && ry !== undefined && Array.isArray(st.dialTiles)) {
      const dial = st.dialTiles.find((d: any) => d.x === rx && d.y === ry);
      if (dial) return dial.value ?? dial.val ?? 1;
    }
    return 1;
  }

  return undefined;
}

export function evaluateTypedValue<TState = any>(
  val: number | string | undefined | TypedValue,
  variables: Record<string, VariableRuntimeValue>,
  defaultValue: number = 0,
  context?: EvaluateValueContext<TState>
): { value: VariableRuntimeValue; nextSeed?: number } {
  if (val === undefined || val === null) return { value: defaultValue };
  if (isTypedValue(val)) return { value: val };
  if (typeof val === 'number') return { value: isNaN(val) ? defaultValue : val };
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^[a-z]$/.test(trimmed) || (/^\$[a-z]$/.test(trimmed) && !isSensorRefString(trimmed))) {
      const varKey = trimmed.startsWith('$') ? trimmed.slice(1) : trimmed;
      return { value: variables[varKey] ?? 0 };
    }
    if (trimmed === '$input') {
      if (context?.sceneInput !== undefined) {
        const inp = context.sceneInput;
        if (isTypedValue(inp)) return { value: inp };
        if (typeof inp === 'string' && isColorLiteralString(inp)) {
          const idx = colorLiteralNameToIdx(inp);
          return { value: { type: 'color', value: PALETTE_COLORS[idx] ?? 'red' } };
        }
        const n = typeof inp === 'number' ? inp : Number(inp);
        return { value: Number.isFinite(n) ? n : defaultValue };
      }
      return { value: defaultValue };
    }

    // Deterministic Mulberry32 PRNG seeded sensors
    if (
      trimmed === '$randCoin' ||
      trimmed === '$randD4' ||
      trimmed === '$randD6' ||
      trimmed === '$randD8' ||
      trimmed === '$randD20' ||
      trimmed === '$rand01' ||
      trimmed === '$randomColor'
    ) {
      const curSeed = context?.seed ?? 12345;
      const { nextVal, nextSeed } = nextMulberry32(curSeed);
      if (trimmed === '$randCoin') return { value: nextVal < 0.5 ? 0 : 1, nextSeed };
      if (trimmed === '$randD4') return { value: Math.floor(nextVal * 4) + 1, nextSeed };
      if (trimmed === '$randD6') return { value: Math.floor(nextVal * 6) + 1, nextSeed };
      if (trimmed === '$randD8') return { value: Math.floor(nextVal * 8) + 1, nextSeed };
      if (trimmed === '$randD20') return { value: Math.floor(nextVal * 20) + 1, nextSeed };
      if (trimmed === '$rand01') return { value: nextVal, nextSeed };
      if (trimmed === '$randomColor') {
        const colorIdx = Math.floor(nextVal * 10);
        return { value: { type: 'color', value: PALETTE_COLORS[colorIdx] ?? 'red' }, nextSeed };
      }
    }

    if (trimmed === '$pointerX') return { value: context?.pointer?.x ?? 0 };
    if (trimmed === '$pointerY') return { value: context?.pointer?.y ?? 0 };
    if (trimmed === '$pointerDown') return { value: context?.pointer?.isDown ? 1 : 0 };

    if (isSensorRefString(trimmed) || isSensorToken(trimmed)) {
      const sensed = resolveSimulationSensor(trimmed, context?.simState, context?.simEnv);
      if (sensed === undefined) {
        context?.onRuntimeError?.('TYPE_ERROR');
        return { value: defaultValue };
      }
      return { value: sensed };
    }

    if (isColorLiteralString(trimmed)) {
      const idx = colorLiteralNameToIdx(trimmed);
      return { value: { type: 'color', value: PALETTE_COLORS[idx] ?? 'red' } };
    }

    const num = Number(trimmed);
    return { value: isNaN(num) ? defaultValue : num };
  }
  return { value: defaultValue };
}

export function evaluateValue<TState = any>(
  val: number | string | undefined | TypedValue,
  variables: Record<string, VariableRuntimeValue>,
  defaultValue: number = 0,
  simEnv?: SimulationEnvironment<TState>,
  simState?: TState,
  sceneInput?: number | string | TypedValue,
  onRuntimeError?: (status: SimulationStatus) => void,
  context?: Partial<EvaluateValueContext<TState>>
): number {
  const res = evaluateTypedValue(val, variables, defaultValue, {
    simEnv,
    simState,
    sceneInput,
    onRuntimeError,
    ...context,
  });
  if (isTypedValue(res.value)) {
    if (res.value.type === 'color') {
      onRuntimeError?.('TYPE_ERROR');
      return defaultValue;
    }
    return res.value.value;
  }
  return typeof res.value === 'number' ? res.value : defaultValue;
}

export function evaluateBinaryOp(
  b: number | TypedValue,
  op: BinaryOp | string,
  c: number | TypedValue,
  onRuntimeError?: (status: SimulationStatus) => void
): number | TypedValue {
  const isBColor = isTypedValue(b) && b.type === 'color';
  const isCColor = isTypedValue(c) && c.type === 'color';

  if (isBColor || isCColor) {
    if (op === '==' || op === '=') {
      if (isBColor && isCColor) {
        return colorLiteralNameToIdx(String((b as TypedValue).value)) ===
          colorLiteralNameToIdx(String((c as TypedValue).value))
          ? 1
          : 0;
      }
      onRuntimeError?.('TYPE_ERROR');
      return 0;
    }
    if (op === '!=') {
      if (isBColor && isCColor) {
        return colorLiteralNameToIdx(String((b as TypedValue).value)) !==
          colorLiteralNameToIdx(String((c as TypedValue).value))
          ? 1
          : 0;
      }
      onRuntimeError?.('TYPE_ERROR');
      return 1;
    }
    onRuntimeError?.('TYPE_ERROR');
    return 0;
  }

  const numB: number = isTypedValue(b)
    ? (typeof b.value === 'number' ? b.value : Number(b.value))
    : typeof b === 'number'
    ? b
    : Number(b);
  const numC: number = isTypedValue(c)
    ? (typeof c.value === 'number' ? c.value : Number(c.value))
    : typeof c === 'number'
    ? c
    : Number(c);

  switch (op) {
    case '+': return numB + numC;
    case '-': return numB - numC;
    case '*': return numB * numC;
    case '/': {
      if (numC === 0) {
        onRuntimeError?.('MATH_ERROR');
        return 0;
      }
      return numB / numC;
    }
    case '%': {
      if (numC === 0) {
        onRuntimeError?.('MATH_ERROR');
        return 0;
      }
      return Math.trunc(numB) % Math.trunc(numC);
    }
    case '=':
    case '==': return numB === numC ? 1 : 0;
    case '!=': return numB !== numC ? 1 : 0;
    case '<': return numB < numC ? 1 : 0;
    case '<=': return numB <= numC ? 1 : 0;
    case '>': return numB > numC ? 1 : 0;
    case '>=': return numB >= numC ? 1 : 0;
    case '&&': return (numB !== 0 && numC !== 0) ? 1 : 0;
    case '||': return (numB !== 0 || numC !== 0) ? 1 : 0;
    default: return 0;
  }
}

export function normalizeInitialVariables(
  initialVars?: Record<string, number | TypedValue | { type: string; value: any }>
): Record<VariableName, VariableRuntimeValue> {
  const vars: Record<string, VariableRuntimeValue> = {};
  if (!initialVars) return vars as Record<VariableName, VariableRuntimeValue>;
  for (const [k, raw] of Object.entries(initialVars)) {
    if (typeof raw === 'number') {
      vars[k] = raw;
    } else if (raw && typeof raw === 'object') {
      if (raw.type === 'color' && typeof raw.value === 'string') {
        vars[k] = { type: 'color', value: raw.value as PaletteColor };
      } else if (raw.type === 'number') {
        vars[k] = typeof raw.value === 'number' ? raw.value : Number(raw.value) || 0;
      } else {
        vars[k] = raw as VariableRuntimeValue;
      }
    }
  }
  return vars as Record<VariableName, VariableRuntimeValue>;
}

export function createInitialInterpreterState(
  randomSeed?: number,
  initialVars?: Record<string, number | TypedValue | { type: string; value: any }>
): InterpreterRuntimeState {
  return {
    callStack: [{ scope: 'MAIN', pc: 0, subTickLeft: 0 }],
    loopStack: [],
    whileStack: [],
    condStack: [],
    activeBlockId: null,
    activeScope: 'MAIN',
    status: 'RUNNING',
    stepCount: 0,
    activeRepeatProgress: null,
    variables: normalizeInitialVariables(initialVars),
    randomSeed,
    eventQueue: [],
  };
}

export function enqueueInterpreterEvent(
  runtime: InterpreterRuntimeState,
  eventScope: ScopeType
): InterpreterRuntimeState {
  const q = runtime.eventQueue ? [...runtime.eventQueue] : [];
  q.push(eventScope);
  return { ...runtime, eventQueue: q };
}

export interface TickResult<TState = any> {
  nextRuntime: InterpreterRuntimeState;
  nextGrid: TState;
  done: boolean;
}

export interface InterpreterTickOptions {
  /** Whether direct or indirect recursive calls (`F1->F1` or `F1->F2->F1`) are permitted at runtime. Defaults to true. */
  allowRecursion?: boolean;
  /** Active `$input` scene-selector value (`1..N` int or color string `'red'` / `'color:red'`). */
  sceneInput?: number | string | TypedValue;
  /** Seed for Mulberry32 deterministic PRNG. */
  seed?: number;
  /** Optional initial variable bindings. */
  initialVars?: Record<string, number | TypedValue | { type: string; value: any }>;
  /** Virtual pointer state for $pointerX, $pointerY, $pointerDown. */
  pointer?: { x: number; y: number; isDown: boolean };
  /** Held keys for 0x2E keyHeld sensor. */
  heldKeys?: ReadonlySet<string | number> | readonly (string | number)[];
  /** Key held predicate. */
  isKeyHeld?: (key: string | number) => boolean;
}

const CALL_TYPE_TO_SCOPE: Record<string, ScopeType> = {
  CALL_F1: 'F1',
  CALL_F2: 'F2',
  CALL_F3: 'F3',
};

/**
 * Returns the target function scope for `CALL_F1` / `CALL_F2` / `CALL_F3`, or `null` otherwise.
 */
export function getCalleeScopeForBlockType(blockType: string): ScopeType | null {
  return CALL_TYPE_TO_SCOPE[blockType] ?? null;
}

/**
 * Returns true when `targetScope` is reachable via call blocks starting at `startScope`.
 */
export function workspaceHasReachableScope(
  workspace: WorkspaceState,
  startScope: ScopeType,
  targetScope: ScopeType
): boolean {
  if (startScope === targetScope) return true;
  const visited = new Set<ScopeType>([startScope]);
  const queue: ScopeType[] = [startScope];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const blocks = workspace[current] || [];
    for (const block of blocks) {
      const callee = getCalleeScopeForBlockType(block.type);
      if (!callee) continue;
      if (callee === targetScope) return true;
      if (!visited.has(callee)) {
        visited.add(callee);
        queue.push(callee);
      }
    }
  }
  return false;
}

/**
 * Returns true if placing a call to `calleeScope` inside `callerScope` would create
 * either direct self-recursion or a transitive cycle across function scopes.
 */
export function wouldCallCreateCycle(
  workspace: WorkspaceState,
  callerScope: ScopeType,
  calleeScope: ScopeType
): boolean {
  if (callerScope === 'MAIN') return false;
  if (callerScope === calleeScope) return true;
  return workspaceHasReachableScope(workspace, calleeScope, callerScope);
}

export interface LoopValidationResult {
  isValid: boolean;
  unclosedLoopStartIds: string[];
  orphanLoopEndIds: string[];
  hasError: boolean;
}

export interface ControlStructureValidationResult extends LoopValidationResult {
  unclosedIfIds: string[];
  orphanElseIds: string[];
  orphanEndIfIds: string[];
  unclosedWhileIds: string[];
  orphanEndWhileIds: string[];
}

/**
 * Validates loop, while, and conditional structures in a list of blocks.
 */
export function validateControlStructure(blocks: CodeBlock[]): ControlStructureValidationResult {
  const unclosedLoopStartIds: string[] = [];
  const orphanLoopEndIds: string[] = [];
  const loopOpenStack: CodeBlock[] = [];

  const unclosedIfIds: string[] = [];
  const orphanElseIds: string[] = [];
  const orphanEndIfIds: string[] = [];
  const ifOpenStack: { ifBlock: CodeBlock; hasElse: boolean }[] = [];

  const unclosedWhileIds: string[] = [];
  const orphanEndWhileIds: string[] = [];
  const whileOpenStack: CodeBlock[] = [];

  for (const block of blocks) {
    if (block.type === 'LOOP_START') {
      loopOpenStack.push(block);
    } else if (block.type === 'LOOP_END') {
      if (loopOpenStack.length > 0) {
        loopOpenStack.pop();
      } else {
        orphanLoopEndIds.push(block.id);
      }
    } else if (block.type === 'IF') {
      ifOpenStack.push({ ifBlock: block, hasElse: false });
    } else if (block.type === 'ELSE_IF') {
      if (ifOpenStack.length === 0 || ifOpenStack[ifOpenStack.length - 1].hasElse) {
        orphanElseIds.push(block.id);
      }
    } else if (block.type === 'ELSE') {
      if (ifOpenStack.length === 0 || ifOpenStack[ifOpenStack.length - 1].hasElse) {
        orphanElseIds.push(block.id);
      } else {
        ifOpenStack[ifOpenStack.length - 1].hasElse = true;
      }
    } else if (block.type === 'END_IF') {
      if (ifOpenStack.length > 0) {
        ifOpenStack.pop();
      } else {
        orphanEndIfIds.push(block.id);
      }
    } else if (block.type === 'WHILE') {
      whileOpenStack.push(block);
    } else if (block.type === 'END_WHILE') {
      if (whileOpenStack.length > 0) {
        whileOpenStack.pop();
      } else {
        orphanEndWhileIds.push(block.id);
      }
    }
  }

  for (const block of loopOpenStack) {
    unclosedLoopStartIds.push(block.id);
  }
  for (const frame of ifOpenStack) {
    unclosedIfIds.push(frame.ifBlock.id);
  }
  for (const block of whileOpenStack) {
    unclosedWhileIds.push(block.id);
  }

  const hasError =
    unclosedLoopStartIds.length > 0 ||
    orphanLoopEndIds.length > 0 ||
    unclosedIfIds.length > 0 ||
    orphanElseIds.length > 0 ||
    orphanEndIfIds.length > 0 ||
    unclosedWhileIds.length > 0 ||
    orphanEndWhileIds.length > 0;

  return {
    isValid: !hasError,
    unclosedLoopStartIds,
    orphanLoopEndIds,
    unclosedIfIds,
    orphanElseIds,
    orphanEndIfIds,
    unclosedWhileIds,
    orphanEndWhileIds,
    hasError,
  };
}

/**
 * Validates loop structure in a list of blocks, checking for unclosed LOOP_START
 * and orphan LOOP_END blocks, as well as IF/ELSE/WHILE control structures.
 */
export function validateLoopStructure(blocks: CodeBlock[]): ControlStructureValidationResult {
  return validateControlStructure(blocks);
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
 * Finds the index of the matching END_WHILE for a WHILE at startIdx in blocks array.
 */
export function findMatchingWhileEnd(blocks: CodeBlock[], startIdx: number): number {
  let depth = 0;
  for (let i = startIdx; i < blocks.length; i++) {
    if (blocks[i].type === 'WHILE') {
      depth++;
    } else if (blocks[i].type === 'END_WHILE') {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
}

export interface IfStructure {
  ifPc: number;
  elseIfPcs: number[];
  elsePc: number | null;
  endIfPc: number;
}

/**
 * Scans an IF construct starting at ifIdx to find its ELSE_IF, ELSE, and matching END_IF blocks.
 */
export function findIfStructure(blocks: CodeBlock[], ifIdx: number): IfStructure {
  const elseIfPcs: number[] = [];
  let elsePc: number | null = null;
  let endIfPc = -1;

  let depth = 0;
  for (let i = ifIdx; i < blocks.length; i++) {
    const t = blocks[i].type;
    if (t === 'IF') {
      depth++;
    } else if (t === 'END_IF') {
      depth--;
      if (depth === 0) {
        endIfPc = i;
        break;
      }
    } else if (depth === 1) {
      if (t === 'ELSE_IF') {
        elseIfPcs.push(i);
      } else if (t === 'ELSE' && elsePc === null) {
        elsePc = i;
      }
    }
  }

  return { ifPc: ifIdx, elseIfPcs, elsePc, endIfPc };
}

export interface BlockConditionContext {
  variables?: Record<string, VariableRuntimeValue>;
  sceneInput?: number | string | TypedValue;
  heldKeys?: ReadonlySet<string | number> | readonly (string | number)[];
  isKeyHeld?: (key: string | number) => boolean;
  onRuntimeError?: (status: SimulationStatus) => void;
  readValueSensor?: (sensor: string, state: any) => number | string | TypedValue | undefined;
}

/**
 * Evaluates the condition on a code block (IF, ELSE_IF, WHILE), delegating to
 * `simEnv.evaluateSensor` when available and supplying variables + `$input` context.
 */
export function evaluateBlockCondition<TState = any>(
  block: CodeBlock,
  simState: TState,
  simEnv?: SimulationEnvironment<TState>,
  context?: BlockConditionContext
): boolean {
  const evalSensor = (sensor: string, state: TState, param?: string): boolean => {
    if (simEnv?.evaluateSensor) {
      return simEnv.evaluateSensor(sensor, state, param);
    }
    // Fallback for environments whose Wave 2B sensor handler is not mounted yet (e.g. Beat cursorAtEdge)
    if (sensor === 'cursorAtEdge' && state && typeof state === 'object') {
      const st = state as { cursor?: { x?: number; y?: number }; gridSize?: number };
      if (st.cursor && typeof st.cursor.x === 'number' && typeof st.cursor.y === 'number') {
        const size = typeof st.gridSize === 'number' && st.gridSize > 0 ? st.gridSize : 8;
        return st.cursor.x <= 1 || st.cursor.x >= size || st.cursor.y <= 1 || st.cursor.y >= size;
      }
    }
    return false;
  };

  const readValueSensor = context?.readValueSensor
    ? context.readValueSensor
    : (sensor: string, state: TState) => resolveSimulationSensor(sensor, state, simEnv);

  const cond = block.params?.condition as ConditionExpr | undefined;
  if (cond && typeof cond === 'object') {
    return evaluateConditionExpr(cond, simState, evalSensor, {
      variables: context?.variables,
      sceneInput: context?.sceneInput,
      readValueSensor,
      heldKeys: context?.heldKeys,
      isKeyHeld: context?.isKeyHeld,
      onRuntimeError: context?.onRuntimeError,
    });
  }

  if (typeof block.params?.sensor === 'string') {
    return evalSensor(block.params.sensor, simState, block.params.param as string | undefined);
  }

  return true;
}

/**
 * Performs a single atomic lockstep execution tick decoupled from any specific simulation.
 */
export function tickInterpreter<TState = GridState>(
  runtime: InterpreterRuntimeState,
  workspace: WorkspaceState,
  simState: TState,
  simEnv: SimulationEnvironment<TState> = gridSimulationEnvironment as unknown as SimulationEnvironment<TState>,
  options?: InterpreterTickOptions
): TickResult<TState> {
  // If already stopped, do nothing
  if (
    runtime.status === 'SUCCESS' ||
    runtime.status === 'COLLISION' ||
    runtime.status === 'STEP_LIMIT' ||
    runtime.status === 'TYPE_ERROR' ||
    runtime.status === 'MATH_ERROR' ||
    runtime.status === 'STACK_OVERFLOW' ||
    runtime.status === 'DEADLOCK'
  ) {
    return { nextRuntime: runtime, nextGrid: simState, done: true };
  }

  // Safety guard against infinite loops
  if (runtime.stepCount >= MAX_TOTAL_STEPS) {
    const nextSimState =
      simState && typeof simState === 'object'
        ? { ...simState, status: 'STEP_LIMIT' as SimulationStatus }
        : simState;
    return {
      nextRuntime: { ...runtime, status: 'STEP_LIMIT', activeBlockId: null },
      nextGrid: nextSimState,
      done: true,
    };
  }

  const callStack: StackFrame[] = [...runtime.callStack];
  const loopStack: LoopFrame[] = [...runtime.loopStack];
  const whileStack: WhileFrame[] = runtime.whileStack ? [...runtime.whileStack] : [];
  const condStack: CondFrame[] = runtime.condStack ? [...runtime.condStack] : [];

  // Pop finished stack frames
  while (callStack.length > 0) {
    const top = callStack[callStack.length - 1];
    const scopeBlocks = workspace[top.scope] || [];
    if (top.pc < scopeBlocks.length) {
      break;
    }
    callStack.pop();
  }

  // If call stack is empty, check event queue before finishing
  let activeEventQueue = runtime.eventQueue;
  if (callStack.length === 0) {
    if (activeEventQueue && activeEventQueue.length > 0) {
      const nextQueue = [...activeEventQueue];
      while (nextQueue.length > 0) {
        const nextEventScope = nextQueue.shift()!;
        const eventBlocks = workspace[nextEventScope] || [];
        if (eventBlocks.length > 0) {
          callStack.push({ scope: nextEventScope, pc: 0, subTickLeft: 0 });
          return {
            nextRuntime: {
              ...runtime,
              callStack,
              eventQueue: nextQueue,
              activeScope: nextEventScope,
              status: 'RUNNING',
            },
            nextGrid: simState,
            done: false,
          };
        }
      }
      activeEventQueue = nextQueue;
    }

    const finalStatus = simEnv.evaluateCompletion
      ? simEnv.evaluateCompletion(simState)
      : 'IDLE';

    const nextSimState =
      simState && typeof simState === 'object'
        ? { ...simState, status: finalStatus }
        : simState;

    return {
      nextRuntime: {
        ...runtime,
        callStack: [],
        loopStack: [],
        whileStack: [],
        condStack: [],
        activeBlockId: null,
        status: finalStatus,
        eventQueue: activeEventQueue,
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
    return tickInterpreter(
      { ...runtime, callStack, loopStack, whileStack, condStack },
      workspace,
      simState,
      simEnv,
      options
    );
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
        whileStack,
        condStack,
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

    // Guard against direct or transitive recursion when disabled by curriculum policy
    if (
      options?.allowRecursion === false &&
      callStack.some((frame) => frame.scope === targetScope)
    ) {
      const nextSimState =
        simState && typeof simState === 'object'
          ? { ...simState, status: 'COLLISION' }
          : simState;
      return {
        nextRuntime: {
          ...runtime,
          status: 'COLLISION',
          activeBlockId,
          activeScope,
          whileStack,
          condStack,
        },
        nextGrid: nextSimState,
        done: true,
      };
    }

    // Advance caller's PC
    currentFrame.pc++;
    callStack[callStack.length - 1] = currentFrame;

    // Check stack overflow
    if (callStack.length >= MAX_CALL_STACK_DEPTH) {
      const nextSimState =
        simState && typeof simState === 'object'
          ? { ...simState, status: 'STACK_OVERFLOW' as SimulationStatus }
          : simState;
      return {
        nextRuntime: {
          ...runtime,
          status: 'STACK_OVERFLOW',
          activeBlockId,
          whileStack,
          condStack,
        },
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
        whileStack,
        condStack,
        activeBlockId,
        activeScope: targetScope,
        stepCount: runtime.stepCount + 1,
        activeRepeatProgress: null,
      },
      nextGrid: simState,
      done: false,
    };
  }

  const activeSceneInput =
    options?.sceneInput !== undefined ? options.sceneInput : runtime.sceneInput;

  let runtimeErrorStatus: SimulationStatus | null = null;
  const onRuntimeError = (status: SimulationStatus) => {
    runtimeErrorStatus = status;
  };

  const evalContext: EvaluateValueContext<TState> = {
    simEnv,
    simState,
    sceneInput: activeSceneInput,
    seed: runtime.randomSeed !== undefined ? runtime.randomSeed : (options?.seed ?? 12345),
    pointer: options?.pointer ?? runtime.pointer,
    onRuntimeError,
  };

  // Handle Variable Assignment: a = b
  if (blockType === 'VAR_ASSIGN') {
    const a = (currentBlock.params?.a || 'a') as VariableName;
    const bRes = evaluateTypedValue(
      currentBlock.params?.b,
      runtime.variables,
      0,
      evalContext
    );
    if (runtimeErrorStatus) {
      const nextSimState =
        simState && typeof simState === 'object'
          ? { ...simState, status: runtimeErrorStatus }
          : simState;
      return {
        nextRuntime: { ...runtime, status: runtimeErrorStatus, activeBlockId },
        nextGrid: nextSimState,
        done: true,
      };
    }
    const nextVariables: Record<VariableName, VariableRuntimeValue> = {
      ...runtime.variables,
      [a]: bRes.value,
    };
    currentFrame.pc++;
    callStack[callStack.length - 1] = currentFrame;

    return {
      nextRuntime: {
        ...runtime,
        status: runningStatus,
        callStack,
        loopStack,
        whileStack,
        condStack,
        activeBlockId,
        activeScope,
        variables: nextVariables,
        stepCount: runtime.stepCount + 1,
        activeRepeatProgress: null,
        randomSeed: bRes.nextSeed ?? runtime.randomSeed,
      },
      nextGrid: simState,
      done: false,
    };
  }

  // Handle Variable Binary Operation: a = b op c
  if (blockType === 'VAR_OP') {
    const a = (currentBlock.params?.a || 'a') as VariableName;
    const op = (currentBlock.params?.op || '+') as BinaryOp;
    const bRes = evaluateTypedValue(
      currentBlock.params?.b,
      runtime.variables,
      0,
      evalContext
    );
    if (bRes.nextSeed !== undefined) evalContext.seed = bRes.nextSeed;
    const cRes = evaluateTypedValue(
      currentBlock.params?.c,
      runtime.variables,
      0,
      evalContext
    );
    if (runtimeErrorStatus) {
      const nextSimState =
        simState && typeof simState === 'object'
          ? { ...simState, status: runtimeErrorStatus }
          : simState;
      return {
        nextRuntime: { ...runtime, status: runtimeErrorStatus, activeBlockId },
        nextGrid: nextSimState,
        done: true,
      };
    }
    const result = evaluateBinaryOp(bRes.value, op, cRes.value, onRuntimeError);
    if (runtimeErrorStatus) {
      const nextSimState =
        simState && typeof simState === 'object'
          ? { ...simState, status: runtimeErrorStatus }
          : simState;
      return {
        nextRuntime: { ...runtime, status: runtimeErrorStatus, activeBlockId },
        nextGrid: nextSimState,
        done: true,
      };
    }
    const nextVariables: Record<VariableName, VariableRuntimeValue> = {
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
        whileStack,
        condStack,
        activeBlockId,
        activeScope,
        variables: nextVariables,
        stepCount: runtime.stepCount + 1,
        activeRepeatProgress: null,
        randomSeed: cRes.nextSeed ?? bRes.nextSeed ?? runtime.randomSeed,
      },
      nextGrid: simState,
      done: false,
    };
  }

  // Handle IF
  if (blockType === 'IF') {
    const ifStruct = findIfStructure(scopeBlocks, currentFrame.pc);
    if (ifStruct.endIfPc === -1) {
      currentFrame.pc++;
      callStack[callStack.length - 1] = currentFrame;
      return {
        nextRuntime: {
          ...runtime,
          status: runningStatus,
          callStack,
          loopStack,
          whileStack,
          condStack,
          activeBlockId,
          activeScope,
          stepCount: runtime.stepCount + 1,
          activeRepeatProgress: null,
        },
        nextGrid: simState,
        done: false,
      };
    }

    const condTrue = evaluateBlockCondition(currentBlock, simState, simEnv, {
      variables: runtime.variables,
      sceneInput: activeSceneInput,
      heldKeys: options?.heldKeys,
      isKeyHeld: options?.isKeyHeld,
      onRuntimeError,
      readValueSensor: (sensorName, _st) => {
        const r = evaluateTypedValue(sensorName, runtime.variables, 0, evalContext);
        if (r.nextSeed !== undefined) evalContext.seed = r.nextSeed;
        if (runtimeErrorStatus) return undefined;
        return r.value;
      },
    });

    if (runtimeErrorStatus) {
      const nextSimState =
        simState && typeof simState === 'object'
          ? { ...simState, status: runtimeErrorStatus }
          : simState;
      return {
        nextRuntime: { ...runtime, status: runtimeErrorStatus, activeBlockId },
        nextGrid: nextSimState,
        done: true,
      };
    }

    if (condTrue) {
      condStack.push({
        scope: currentFrame.scope,
        ifPc: currentFrame.pc,
        endIfPc: ifStruct.endIfPc,
        branchTaken: true,
      });
      currentFrame.pc++;
    } else {
      condStack.push({
        scope: currentFrame.scope,
        ifPc: currentFrame.pc,
        endIfPc: ifStruct.endIfPc,
        branchTaken: false,
      });
      const nextTarget =
        ifStruct.elseIfPcs.length > 0
          ? ifStruct.elseIfPcs[0]
          : ifStruct.elsePc ?? ifStruct.endIfPc;
      currentFrame.pc = nextTarget;
    }

    callStack[callStack.length - 1] = currentFrame;
    return {
      nextRuntime: {
        ...runtime,
        status: runningStatus,
        callStack,
        loopStack,
        whileStack,
        condStack,
        activeBlockId,
        activeScope,
        stepCount: runtime.stepCount + 1,
        activeRepeatProgress: null,
        randomSeed: evalContext.seed ?? runtime.randomSeed,
      },
      nextGrid: simState,
      done: false,
    };
  }

  // Handle ELSE_IF
  if (blockType === 'ELSE_IF') {
    const topCond = condStack.length > 0 ? condStack[condStack.length - 1] : null;
    if (topCond && topCond.scope === currentFrame.scope) {
      if (topCond.branchTaken) {
        // Prior branch was taken, skip past END_IF
        currentFrame.pc = topCond.endIfPc + 1;
        condStack.pop();
      } else {
        const condTrue = evaluateBlockCondition(currentBlock, simState, simEnv, {
          variables: runtime.variables,
          sceneInput: activeSceneInput,
          heldKeys: options?.heldKeys,
          isKeyHeld: options?.isKeyHeld,
          onRuntimeError,
          readValueSensor: (sensorName, _st) => {
            const r = evaluateTypedValue(sensorName, runtime.variables, 0, evalContext);
            if (r.nextSeed !== undefined) evalContext.seed = r.nextSeed;
            if (runtimeErrorStatus) return undefined;
            return r.value;
          },
        });

        if (runtimeErrorStatus) {
          const nextSimState =
            simState && typeof simState === 'object'
              ? { ...simState, status: runtimeErrorStatus }
              : simState;
          return {
            nextRuntime: { ...runtime, status: runtimeErrorStatus, activeBlockId },
            nextGrid: nextSimState,
            done: true,
          };
        }

        if (condTrue) {
          topCond.branchTaken = true;
          currentFrame.pc++;
        } else {
          const ifStruct = findIfStructure(scopeBlocks, topCond.ifPc);
          const k = ifStruct.elseIfPcs.indexOf(currentFrame.pc);
          const nextTarget =
            k >= 0 && k + 1 < ifStruct.elseIfPcs.length
              ? ifStruct.elseIfPcs[k + 1]
              : ifStruct.elsePc ?? ifStruct.endIfPc;
          currentFrame.pc = nextTarget;
        }
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
        whileStack,
        condStack,
        activeBlockId,
        activeScope,
        stepCount: runtime.stepCount + 1,
        activeRepeatProgress: null,
        randomSeed: evalContext.seed ?? runtime.randomSeed,
      },
      nextGrid: simState,
      done: false,
    };
  }

  // Handle ELSE
  if (blockType === 'ELSE') {
    const topCond = condStack.length > 0 ? condStack[condStack.length - 1] : null;
    if (topCond && topCond.scope === currentFrame.scope) {
      if (topCond.branchTaken) {
        // Prior branch was taken, skip past END_IF
        currentFrame.pc = topCond.endIfPc + 1;
        condStack.pop();
      } else {
        topCond.branchTaken = true;
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
        whileStack,
        condStack,
        activeBlockId,
        activeScope,
        stepCount: runtime.stepCount + 1,
        activeRepeatProgress: null,
      },
      nextGrid: simState,
      done: false,
    };
  }

  // Handle END_IF
  if (blockType === 'END_IF') {
    const topCond = condStack.length > 0 ? condStack[condStack.length - 1] : null;
    if (topCond && topCond.scope === currentFrame.scope && topCond.endIfPc === currentFrame.pc) {
      condStack.pop();
    }
    currentFrame.pc++;

    callStack[callStack.length - 1] = currentFrame;
    return {
      nextRuntime: {
        ...runtime,
        status: runningStatus,
        callStack,
        loopStack,
        whileStack,
        condStack,
        activeBlockId,
        activeScope,
        stepCount: runtime.stepCount + 1,
        activeRepeatProgress: null,
      },
      nextGrid: simState,
      done: false,
    };
  }

  // Handle WHILE
  if (blockType === 'WHILE') {
    const matchingEnd = findMatchingWhileEnd(scopeBlocks, currentFrame.pc);
    if (matchingEnd === -1) {
      currentFrame.pc++;
      callStack[callStack.length - 1] = currentFrame;
      return {
        nextRuntime: {
          ...runtime,
          status: runningStatus,
          callStack,
          loopStack,
          whileStack,
          condStack,
          activeBlockId,
          activeScope,
          stepCount: runtime.stepCount + 1,
          activeRepeatProgress: null,
        },
        nextGrid: simState,
        done: false,
      };
    }

    const condTrue = evaluateBlockCondition(currentBlock, simState, simEnv, {
      variables: runtime.variables,
      sceneInput: activeSceneInput,
      heldKeys: options?.heldKeys,
      isKeyHeld: options?.isKeyHeld,
      onRuntimeError,
      readValueSensor: (sensorName, _st) => {
        const r = evaluateTypedValue(sensorName, runtime.variables, 0, evalContext);
        if (r.nextSeed !== undefined) evalContext.seed = r.nextSeed;
        if (runtimeErrorStatus) return undefined;
        return r.value;
      },
    });

    if (runtimeErrorStatus) {
      const nextSimState =
        simState && typeof simState === 'object'
          ? { ...simState, status: runtimeErrorStatus }
          : simState;
      return {
        nextRuntime: { ...runtime, status: runtimeErrorStatus, activeBlockId },
        nextGrid: nextSimState,
        done: true,
      };
    }

    if (!condTrue) {
      if (
        whileStack.length > 0 &&
        whileStack[whileStack.length - 1].whileStartPc === currentFrame.pc
      ) {
        whileStack.pop();
      }
      currentFrame.pc = matchingEnd + 1;
    } else {
      if (
        whileStack.length === 0 ||
        whileStack[whileStack.length - 1].whileStartPc !== currentFrame.pc
      ) {
        whileStack.push({
          scope: currentFrame.scope,
          whileStartPc: currentFrame.pc,
          whileEndPc: matchingEnd,
        });
      }
      currentFrame.pc++;
    }

    callStack[callStack.length - 1] = currentFrame;
    return {
      nextRuntime: {
        ...runtime,
        status: runningStatus,
        callStack,
        loopStack,
        whileStack,
        condStack,
        activeBlockId,
        activeScope,
        stepCount: runtime.stepCount + 1,
        activeRepeatProgress: null,
        randomSeed: evalContext.seed ?? runtime.randomSeed,
      },
      nextGrid: simState,
      done: false,
    };
  }

  // Handle END_WHILE
  if (blockType === 'END_WHILE') {
    const topWhile = whileStack.length > 0 ? whileStack[whileStack.length - 1] : null;
    if (topWhile && topWhile.scope === currentFrame.scope && topWhile.whileEndPc === currentFrame.pc) {
      currentFrame.pc = topWhile.whileStartPc;
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
        whileStack,
        condStack,
        activeBlockId,
        activeScope,
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
    const countValRes = currentBlock.repeatCount !== undefined
      ? evaluateTypedValue(
          currentBlock.repeatCount,
          runtime.variables,
          2,
          evalContext
        )
      : { value: 2 };
    if (countValRes.nextSeed !== undefined) evalContext.seed = countValRes.nextSeed;

    if (runtimeErrorStatus) {
      const nextSimState =
        simState && typeof simState === 'object'
          ? { ...simState, status: runtimeErrorStatus }
          : simState;
      return {
        nextRuntime: { ...runtime, status: runtimeErrorStatus, activeBlockId },
        nextGrid: nextSimState,
        done: true,
      };
    }

    if (isTypedValue(countValRes.value) && countValRes.value.type === 'color') {
      const nextSimState =
        simState && typeof simState === 'object'
          ? { ...simState, status: 'TYPE_ERROR' as SimulationStatus }
          : simState;
      return {
        nextRuntime: { ...runtime, status: 'TYPE_ERROR', activeBlockId },
        nextGrid: nextSimState,
        done: true,
      };
    }

    const rawCount = isTypedValue(countValRes.value) ? countValRes.value.value : countValRes.value;
    const loopCount = Math.round(typeof rawCount === 'number' ? rawCount : Number(rawCount));

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
          whileStack,
          condStack,
          activeBlockId,
          activeScope,
          stepCount: runtime.stepCount + 1,
          activeRepeatProgress: null,
          randomSeed: evalContext.seed ?? runtime.randomSeed,
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
        whileStack,
        condStack,
        activeBlockId,
        activeScope,
        stepCount: runtime.stepCount + 1,
        activeRepeatProgress: null,
        randomSeed: evalContext.seed ?? runtime.randomSeed,
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
        whileStack,
        condStack,
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
  const repValRes = currentBlock.repeatCount !== undefined
    ? evaluateTypedValue(
        currentBlock.repeatCount,
        runtime.variables,
        1,
        evalContext
      )
    : { value: 1 };
  if (repValRes.nextSeed !== undefined) evalContext.seed = repValRes.nextSeed;

  if (runtimeErrorStatus) {
    const nextSimState =
      simState && typeof simState === 'object'
        ? { ...simState, status: runtimeErrorStatus }
        : simState;
    return {
      nextRuntime: { ...runtime, status: runtimeErrorStatus, activeBlockId },
      nextGrid: nextSimState,
      done: true,
    };
  }

  if (isTypedValue(repValRes.value) && repValRes.value.type === 'color') {
    const nextSimState =
      simState && typeof simState === 'object'
        ? { ...simState, status: 'TYPE_ERROR' as SimulationStatus }
        : simState;
    return {
      nextRuntime: { ...runtime, status: 'TYPE_ERROR', activeBlockId },
      nextGrid: nextSimState,
      done: true,
    };
  }

  const rawRepeats = isTypedValue(repValRes.value) ? repValRes.value.value : repValRes.value;
  const totalRepeats = Math.round(typeof rawRepeats === 'number' ? rawRepeats : Number(rawRepeats));

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
        whileStack,
        condStack,
        activeBlockId,
        activeScope,
        stepCount: runtime.stepCount + 1,
        activeRepeatProgress: null,
        randomSeed: evalContext.seed ?? runtime.randomSeed,
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
      if (
        typeof v === 'string' &&
        (/^[a-z]$/.test(v.trim()) || isSensorRefString(v) || isSensorToken(v) || isColorLiteralString(v))
      ) {
        const pRes = evaluateTypedValue(v, runtime.variables, 0, evalContext);
        if (pRes.nextSeed !== undefined) evalContext.seed = pRes.nextSeed;
        if (runtimeErrorStatus) {
          const nextSimState =
            simState && typeof simState === 'object'
              ? { ...simState, status: runtimeErrorStatus }
              : simState;
          return {
            nextRuntime: { ...runtime, status: runtimeErrorStatus, activeBlockId },
            nextGrid: nextSimState,
            done: true,
          };
        }
        if (isTypedValue(pRes.value)) {
          if (pRes.value.type === 'color' && k === 'color') {
            const cIdx = colorLiteralNameToIdx(pRes.value.value);
            resolvedParams[k] = cIdx >= 0 ? TURTLE_COLOR_PALETTE[cIdx] : pRes.value.value;
          } else {
            resolvedParams[k] = pRes.value.value;
          }
        } else {
          resolvedParams[k] = pRes.value;
        }
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
        callStack,
        loopStack,
        whileStack,
        condStack,
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

  if (remainingSubTicks <= 0 && !isDone && actionRes.status !== 'COLLISION') {
    const hasRemainingWork = callStack.some(
      (f) => f.pc < (workspace[f.scope] || []).length
    );
    if (!hasRemainingWork) {
      const finalStatus = simEnv.evaluateCompletion
        ? simEnv.evaluateCompletion(actionRes.nextState)
        : actionRes.status;
      const nextGrid =
        actionRes.nextState && typeof actionRes.nextState === 'object'
          ? { ...actionRes.nextState, status: finalStatus }
          : actionRes.nextState;

      return {
        nextRuntime: {
          ...runtime,
          callStack: [],
          loopStack: [],
          whileStack: [],
          condStack: [],
          activeBlockId,
          activeScope,
          status: finalStatus,
          stepCount: runtime.stepCount + 1,
          activeRepeatProgress,
        },
        nextGrid,
        done: true,
      };
    }
  }

  return {
    nextRuntime: {
      ...runtime,
      callStack,
      loopStack,
      whileStack,
      condStack,
      activeBlockId,
      activeScope,
      status: actionRes.status,
      stepCount: runtime.stepCount + 1,
      activeRepeatProgress,
      randomSeed: evalContext.seed ?? runtime.randomSeed,
    },
    nextGrid: actionRes.nextState,
    done: isDone,
  };
}
