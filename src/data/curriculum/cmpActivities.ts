import { toVariableName, type CodeBlock, type VariableName, type WallEdge, type WorkspaceState } from '../../types';
import { createInitialDepotState } from '../../simulations/depot/depotPhysics';
import {
  DEPOT_RING_PALETTE,
  DEPOT_STATION_BITS,
  type CrateColor,
  type DepotQueueItem,
  type DepotStacks,
} from '../../simulations/depot/types';
import {
  type ConditionCompareOp,
  type ConditionExpr,
  type CreativeVariationCard,
  type CurriculumActivity,
  type CurriculumBeatDefinition,
  type CurriculumDepotDefinition,
  type CurriculumGridDefinition,
  type CurriculumSwitchyardDefinition,
  type ExplanationDemoTab,
  type PaletteConfig,
  type SwitchyardColor,
  type SwitchyardDockDef,
  type SwitchyardIcon,
  type SwitchyardItemDef,
  createCurriculumBlock,
} from './types';

// ---------------------------------------------------------------------------
// Shared Construction Helpers
// ---------------------------------------------------------------------------

type LowerVarChar =
  | 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k' | 'l' | 'm'
  | 'n' | 'o' | 'p' | 'q' | 'r' | 's' | 't' | 'u' | 'v' | 'w' | 'x' | 'y' | 'z';

function varNames(...names: LowerVarChar[]): VariableName[] {
  return names.map((n) => toVariableName(n));
}

interface BlockSpec {
  type: string;
  repeatCount?: number | VariableName;
  params?: Record<string, unknown>;
}

interface MultiScopeSpecs {
  MAIN: BlockSpec[];
  F1?: BlockSpec[];
  F2?: BlockSpec[];
  F3?: BlockSpec[];
}

function block(
  type: string,
  repeatCount?: number | VariableName,
  params?: Record<string, unknown>,
  idPrefix = 'cmp'
): CodeBlock {
  return createCurriculumBlock(type, repeatCount, params, idPrefix);
}

function makeWorkspace(specs: MultiScopeSpecs, idPrefix: string): WorkspaceState {
  const mapScope = (items: BlockSpec[] | undefined, scopeTag: string): CodeBlock[] =>
    (items ?? []).map((item, index) =>
      block(
        item.type,
        item.repeatCount,
        item.params ? { ...item.params } : undefined,
        `${idPrefix}_${scopeTag}_${index + 1}`
      )
    );

  return {
    MAIN: mapScope(specs.MAIN, 'm'),
    F1: mapScope(specs.F1, 'f1'),
    F2: mapScope(specs.F2, 'f2'),
    F3: mapScope(specs.F3, 'f3'),
  };
}

function makeMainWorkspace(specs: BlockSpec[], idPrefix: string): WorkspaceState {
  return makeWorkspace({ MAIN: specs }, idPrefix);
}

function makeScaffoldFromReference(
  reference: WorkspaceState,
  placeholderIndicesByScope: Partial<Record<'MAIN' | 'F1' | 'F2' | 'F3', readonly number[]>>,
  idPrefix: string
): WorkspaceState {
  const scopes: Array<'MAIN' | 'F1' | 'F2' | 'F3'> = ['MAIN', 'F1', 'F2', 'F3'];
  const out: WorkspaceState = { MAIN: [], F1: [], F2: [], F3: [] };

  for (const sc of scopes) {
    const src = reference[sc] ?? [];
    const phSet = new Set(placeholderIndicesByScope[sc] ?? []);
    out[sc] = src.map((blk, idx) =>
      phSet.has(idx)
        ? block('PLACEHOLDER', undefined, { hintCategory: 'any' }, `${idPrefix}_${sc.toLowerCase()}_ph_${idx + 1}`)
        : block(
            blk.type,
            typeof blk.repeatCount === 'string' ? toVariableName(blk.repeatCount) : blk.repeatCount,
            blk.params ? { ...blk.params } : undefined,
            `${idPrefix}_${sc.toLowerCase()}_${idx + 1}`
          )
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// Condition & Statement Builders (Strict 3-Address + Canonical Op Shapes)
// ---------------------------------------------------------------------------

function sensor(
  sensorName: Extract<ConditionExpr, { kind: 'sensor' }>['sensor'],
  param?: string
): ConditionExpr {
  return {
    kind: 'sensor',
    sensor: sensorName,
    ...(param !== undefined ? { param } : {}),
  };
}

function notCond(operand: ConditionExpr): ConditionExpr {
  return { kind: 'not', operand };
}

function andCond(left: ConditionExpr, right: ConditionExpr): ConditionExpr {
  return { kind: 'and', left, right };
}

function orCond(left: ConditionExpr, right: ConditionExpr): ConditionExpr {
  return { kind: 'or', left, right };
}

function cmpCond(
  op: ConditionCompareOp,
  left: string | number,
  right: string | number
): ConditionExpr {
  return { kind: 'cmp', op, left, right };
}

function varAssign(a: LowerVarChar, b: number | string): BlockSpec {
  return { type: 'VAR_ASSIGN', params: { a: toVariableName(a), b } };
}

function varOp(
  a: LowerVarChar,
  b: number | string,
  op: '+' | '-' | '*' | '/' | '%',
  c: number | string
): BlockSpec {
  return { type: 'VAR_OP', params: { a: toVariableName(a), b, op, c } };
}

function ifBlk(condition: ConditionExpr): BlockSpec {
  return { type: 'IF', params: { condition } };
}

function elseIfBlk(condition: ConditionExpr): BlockSpec {
  return { type: 'ELSE_IF', params: { condition } };
}

const ELSE_BLK: BlockSpec = { type: 'ELSE' };
const END_IF_BLK: BlockSpec = { type: 'END_IF' };

function whileBlk(condition: ConditionExpr): BlockSpec {
  return { type: 'WHILE', params: { condition } };
}

const END_WHILE_BLK: BlockSpec = { type: 'END_WHILE' };

function loopStart(repeatCount: number | LowerVarChar): BlockSpec {
  return {
    type: 'LOOP_START',
    repeatCount: typeof repeatCount === 'number' ? repeatCount : toVariableName(repeatCount),
  };
}

const LOOP_END_BLK: BlockSpec = { type: 'LOOP_END' };

function edge(x: number, y: number, orientation: 'H' | 'V'): WallEdge {
  return { x, y, orientation };
}

// ---------------------------------------------------------------------------
// Canonical Palette Color Hex Maps
// ---------------------------------------------------------------------------

const TURTLE_COLORS = {
  black: '#0f172a',
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#10b981',
  amber: '#f59e0b',
  yellow: '#f59e0b',
  purple: '#8b5cf6',
  pink: '#ec4899',
  cyan: '#06b6d4',
  orange: '#f97316',
  white: '#ffffff',
} as const;

const BEAT_COLORS = {
  black: '#0f172a',
  red: '#f43f5e',
  blue: '#3b82f6',
  green: '#10b981',
  amber: '#fbbf24',
  yellow: '#fbbf24',
  purple: '#a855f7',
  pink: '#ec4899',
  cyan: '#06b6d4',
  orange: '#f97316',
  white: '#ffffff',
} as const;

const CMP_ALL_OPS: ConditionCompareOp[] = ['<', '>', '<=', '>=', '==', '!='];

const CMP_TURTLE_SANDBOX_BLOCKS: string[] = [
  'FORWARD',
  'BACKWARD',
  'TURN_LEFT',
  'TURN_RIGHT',
  'PEN_UP',
  'PEN_DOWN',
  'SET_PEN_COLOR',
  'TELEPORT',
];

const CMP_BEAT_PUZZLE_BLOCKS: string[] = [
  'DRUM_KICK',
  'DRUM_SNARE',
  'DRUM_CLAP',
  'SET_LED_COLOR',
  'LIGHT_PIXEL',
  'CURSOR_STEP',
];

// ---------------------------------------------------------------------------
// Environment Variant Builders (Switchyard, Depot, Robot Grid)
// ---------------------------------------------------------------------------

interface WeightedStreamSpec {
  weight: number;
  damaged?: boolean;
  seqNum?: number;
  color?: SwitchyardColor;
  icon?: SwitchyardIcon;
}

const DEFAULT_CAR_COLORS: readonly SwitchyardColor[] = ['sky', 'amber', 'emerald', 'rose'];

function makeWeightedSwitchyardDef(
  label: string,
  idPrefix: string,
  items: readonly WeightedStreamSpec[],
  docks: SwitchyardDockDef[],
  options?: {
    initialDirection?: 'left' | 'right';
    scrapChute?: CurriculumSwitchyardDefinition['scrapChute'];
    scrapRules?: CurriculumSwitchyardDefinition['scrapRules'];
    mode?: CurriculumSwitchyardDefinition['mode'];
    balanceTolerance?: number;
    scaleTolerance?: number;
  }
): CurriculumSwitchyardDefinition {
  const incomingStream: SwitchyardItemDef[] = items.map((item, idx) => ({
    id: `${idPrefix}_car_${idx + 1}`,
    color: item.color ?? DEFAULT_CAR_COLORS[idx % DEFAULT_CAR_COLORS.length],
    icon: item.icon ?? 'crate',
    weight: item.weight,
    ...(item.damaged ? { damaged: true } : {}),
    ...(item.seqNum !== undefined
      ? { seqNum: item.seqNum, seqTag: `#${item.seqNum}` }
      : {}),
  }));

  return {
    label,
    incomingStream,
    switches: [
      {
        id: 'A',
        initialDirection: options?.initialDirection ?? 'left',
        leftTarget: 'DOCK_A',
        rightTarget: 'DOCK_B',
      },
    ],
    docks,
    ...(options?.scrapChute ? { scrapChute: options.scrapChute } : {}),
    ...(options?.scrapRules !== undefined ? { scrapRules: options.scrapRules } : {}),
    ...(options?.mode !== undefined ? { mode: options.mode } : {}),
    ...(options?.balanceTolerance !== undefined
      ? { balanceTolerance: options.balanceTolerance }
      : {}),
    ...(options?.scaleTolerance !== undefined ? { scaleTolerance: options.scaleTolerance } : {}),
  };
}

function valueToRingColor(val: number): CrateColor {
  const paletteIdx = ((Math.abs(Math.trunc(val)) - 1) % 8) + 1; // 1..8 (RED..ORANGE, high contrast)
  return DEPOT_RING_PALETTE[paletteIdx]?.id ?? 'BLUE';
}

function makeNumberedDepotDef(options: {
  inputValues: readonly number[];
  stack1Values?: readonly number[];
  stack2Values?: readonly number[];
  stack3Values?: readonly number[];
  targetOutputValues?: readonly number[];
  targetStack2Values?: readonly number[];
  activeStationsMask: number;
  workerStation?: 'INPUT' | 'STACK_1' | 'STACK_2' | 'STACK_3';
  enforceHanoiRule?: boolean;
  requireEmptyStacks?: boolean;
}): CurriculumDepotDefinition {
  const toQueueItems = (vals: readonly number[]): DepotQueueItem[] =>
    vals.map((value) => ({
      color: valueToRingColor(value),
      value,
    }));

  const s1Vals = options.stack1Values ?? [];
  const s2Vals = options.stack2Values ?? [];
  const s3Vals = options.stack3Values ?? [];

  const initialStacks: DepotStacks = [
    s1Vals.map(valueToRingColor),
    s2Vals.map(valueToRingColor),
    s3Vals.map(valueToRingColor),
  ];

  const targetOutput = options.targetOutputValues?.map(valueToRingColor);
  const targetStacks: DepotStacks | undefined = options.targetStack2Values
    ? [
        s1Vals.map(valueToRingColor),
        options.targetStack2Values.map(valueToRingColor),
        [],
      ]
    : undefined;

  const inputItems = toQueueItems(options.inputValues);
  const workerStation = options.workerStation ?? 'INPUT';

  const base = createInitialDepotState({
    stacks: initialStacks,
    initialStacks,
    queue: [],
    initialQueue: [],
    input: inputItems,
    initialInput: inputItems,
    workerStation,
    initialWorkerStation: workerStation,
    targetStacks,
    targetOutput,
    enforceHanoiRule: options.enforceHanoiRule ?? false,
    requireEmptyStacks: options.requireEmptyStacks ?? false,
    activeStationsMask: options.activeStationsMask,
    ...(options.targetOutputValues !== undefined
      ? { exactOutputCount: options.targetOutputValues.length }
      : {}),
  });

  // Attach numeric stack & target value metadata for Phase 3 Toy-Block Mode (`p3-depot` / `p3-integrate`)
  const stackValues: [number[], number[], number[]] = [
    [...s1Vals],
    [...s2Vals],
    [...s3Vals],
  ];

  return {
    ...base,
    input: inputItems.map((it) => ({ ...it })),
    initialInput: inputItems.map((it) => ({ ...it })),
    enforceHanoiRule: options.enforceHanoiRule ?? false,
    requireEmptyStacks: options.requireEmptyStacks ?? false,
    activeStationsMask: options.activeStationsMask,
    ...(options.targetOutputValues !== undefined
      ? { exactOutputCount: options.targetOutputValues.length }
      : {}),
    ...({
      stackValues,
      initialStackValues: stackValues.map((arr) => [...arr]),
      ...(options.targetOutputValues
        ? { targetOutputValues: [...options.targetOutputValues] }
        : {}),
      ...(options.targetStack2Values
        ? {
            targetStackValues: [
              [...s1Vals],
              [...options.targetStack2Values],
              [],
            ],
          }
        : {}),
    } as Record<string, unknown>),
  };
}

// ===========================================================================
// cmp.0 — Tipping the Scales (Explanation · Switchyard)
// ===========================================================================

export const CMP_0_DEMO_TABS: ExplanationDemoTab[] = [
  {
    id: 'cmp_0_tab_weight',
    label: 'Weight > 10',
    icon: '📦',
    title: 'Strict Weight Threshold ($itemWeight > 10)',
    simId: 'switchyard',
    coPilotCard:
      "Watch each crate's weight badge check > 10. Notice 10 > 10 is false, so exact 10 kg stays on the Express track!",
    switchyard: makeWeightedSwitchyardDef(
      'Weight > 10 Gate',
      'cmp0_t1',
      [{ weight: 4 }, { weight: 14 }, { weight: 10 }, { weight: 12 }],
      [
        { id: 'DOCK_A', label: 'Heavy (> 10)', minWeight: 11, acceptsDamaged: false },
        { id: 'DOCK_B', label: 'Express (<= 10)', maxWeight: 10, acceptsDamaged: false },
      ],
      { initialDirection: 'right' }
    ),
    spotlights: ['variable-watch', 'branch'],
    workspace: makeMainWorkspace(
      [
        whileBlk(sensor('hasNextItem')),
        ifBlk(cmpCond('>', '$itemWeight', 10)),
        { type: 'SWITCH_LEFT' },
        ELSE_BLK,
        { type: 'SWITCH_RIGHT' },
        END_IF_BLK,
        { type: 'SEND_NEXT' },
        END_WHILE_BLK,
      ],
      'cmp0_t1'
    ),
  },
  {
    id: 'cmp_0_tab_quota',
    label: 'Quota ==',
    icon: '🎯',
    title: 'Exact Dock Quota ($dockCount == $dockQuota)',
    simId: 'switchyard',
    coPilotCard:
      'Compare $dockCount [A] with the painted $dockQuota [A] sign (2). As soon as they match (==), extra crates detour to Dock B!',
    switchyard: makeWeightedSwitchyardDef(
      'Exact Quota == 2',
      'cmp0_t2',
      [{ weight: 5 }, { weight: 6 }, { weight: 7 }, { weight: 8 }],
      [
        { id: 'DOCK_A', label: 'Dock A (Quota 2)', quota: 2, acceptsDamaged: false },
        { id: 'DOCK_B', label: 'Dock B (Overflow)', acceptsDamaged: false },
      ],
      { initialDirection: 'left' }
    ),
    spotlights: ['variable-watch', 'branch'],
    workspace: makeMainWorkspace(
      [
        whileBlk(sensor('hasNextItem')),
        ifBlk(cmpCond('==', '$dockCount[0]', '$dockQuota[0]')),
        { type: 'SWITCH_RIGHT' },
        ELSE_BLK,
        { type: 'SWITCH_LEFT' },
        END_IF_BLK,
        { type: 'SEND_NEXT' },
        END_WHILE_BLK,
      ],
      'cmp0_t2'
    ),
  },
];

// ===========================================================================
// cmp.1 — Heavy Freight Bypass (Puzzle · Switchyard)
// ===========================================================================

export const CMP_1_VARIANTS: CurriculumSwitchyardDefinition[] = [
  makeWeightedSwitchyardDef(
    'Variant 1: [4, 10, 15, 8, 12] kg',
    'cmp1_v1',
    [{ weight: 4 }, { weight: 10 }, { weight: 15 }, { weight: 8 }, { weight: 12 }],
    [
      { id: 'DOCK_A', label: 'Heavy (> 10 kg)', minWeight: 11, acceptsDamaged: false },
      { id: 'DOCK_B', label: 'Express (<= 10 kg)', maxWeight: 10, acceptsDamaged: false },
    ],
    { initialDirection: 'right' }
  ),
  makeWeightedSwitchyardDef(
    'Variant 2: [11, 10, 9, 20, 10] kg',
    'cmp1_v2',
    [{ weight: 11 }, { weight: 10 }, { weight: 9 }, { weight: 20 }, { weight: 10 }],
    [
      { id: 'DOCK_A', label: 'Heavy (> 10 kg)', minWeight: 11, acceptsDamaged: false },
      { id: 'DOCK_B', label: 'Express (<= 10 kg)', maxWeight: 10, acceptsDamaged: false },
    ],
    { initialDirection: 'right' }
  ),
  makeWeightedSwitchyardDef(
    'Variant 3: [15, 14, 1, 2] kg',
    'cmp1_v3',
    [{ weight: 15 }, { weight: 14 }, { weight: 1 }, { weight: 2 }],
    [
      { id: 'DOCK_A', label: 'Heavy (> 10 kg)', minWeight: 11, acceptsDamaged: false },
      { id: 'DOCK_B', label: 'Express (<= 10 kg)', maxWeight: 10, acceptsDamaged: false },
    ],
    { initialDirection: 'right' }
  ),
  makeWeightedSwitchyardDef(
    'Variant 4: [10, 10, 11, 3, 18, 7] kg',
    'cmp1_v4',
    [
      { weight: 10 },
      { weight: 10 },
      { weight: 11 },
      { weight: 3 },
      { weight: 18 },
      { weight: 7 },
    ],
    [
      { id: 'DOCK_A', label: 'Heavy (> 10 kg)', minWeight: 11, acceptsDamaged: false },
      { id: 'DOCK_B', label: 'Express (<= 10 kg)', maxWeight: 10, acceptsDamaged: false },
    ],
    { initialDirection: 'right' }
  ),
];

const CMP_1_STARTER = makeMainWorkspace(
  [
    whileBlk(sensor('hasNextItem')),
    { type: 'SWITCH_RIGHT' },
    { type: 'SEND_NEXT' },
    END_WHILE_BLK,
  ],
  'cmp1_st'
);

const CMP_1_REF = makeMainWorkspace(
  [
    whileBlk(sensor('hasNextItem')),
    ifBlk(cmpCond('>', '$itemWeight', 10)),
    { type: 'SWITCH_LEFT' },
    ELSE_BLK,
    { type: 'SWITCH_RIGHT' },
    END_IF_BLK,
    { type: 'SEND_NEXT' },
    END_WHILE_BLK,
  ],
  'cmp1_ref'
);

// ===========================================================================
// cmp.1a — Dynamic Dock Quota (Puzzle · Switchyard)
// ===========================================================================

export const CMP_1A_VARIANTS: CurriculumSwitchyardDefinition[] = [
  makeWeightedSwitchyardDef(
    'Variant 1: Quota 2 · 5 Crates',
    'cmp1a_v1',
    [{ weight: 2 }, { weight: 5 }, { weight: 4 }, { weight: 8 }, { weight: 3 }],
    [
      { id: 'DOCK_A', label: 'Dock A (Quota 2)', quota: 2, acceptsDamaged: false },
      { id: 'DOCK_B', label: 'Dock B (Overflow)', acceptsDamaged: false },
    ],
    { initialDirection: 'left' }
  ),
  makeWeightedSwitchyardDef(
    'Variant 2: Quota 4 · 6 Crates',
    'cmp1a_v2',
    [
      { weight: 9 },
      { weight: 1 },
      { weight: 7 },
      { weight: 6 },
      { weight: 4 },
      { weight: 2 },
    ],
    [
      { id: 'DOCK_A', label: 'Dock A (Quota 4)', quota: 4, acceptsDamaged: false },
      { id: 'DOCK_B', label: 'Dock B (Overflow)', acceptsDamaged: false },
    ],
    { initialDirection: 'left' }
  ),
  makeWeightedSwitchyardDef(
    'Variant 3: Quota 1 · 4 Crates',
    'cmp1a_v3',
    [{ weight: 6 }, { weight: 8 }, { weight: 3 }, { weight: 5 }],
    [
      { id: 'DOCK_A', label: 'Dock A (Quota 1)', quota: 1, acceptsDamaged: false },
      { id: 'DOCK_B', label: 'Dock B (Overflow)', acceptsDamaged: false },
    ],
    { initialDirection: 'left' }
  ),
  makeWeightedSwitchyardDef(
    'Variant 4: Quota 3 · 7 Crates',
    'cmp1a_v4',
    [
      { weight: 4 },
      { weight: 4 },
      { weight: 9 },
      { weight: 2 },
      { weight: 7 },
      { weight: 5 },
      { weight: 1 },
    ],
    [
      { id: 'DOCK_A', label: 'Dock A (Quota 3)', quota: 3, acceptsDamaged: false },
      { id: 'DOCK_B', label: 'Dock B (Overflow)', acceptsDamaged: false },
    ],
    { initialDirection: 'left' }
  ),
];

const CMP_1A_STARTER = makeMainWorkspace(
  [
    whileBlk(sensor('hasNextItem')),
    { type: 'SWITCH_LEFT' },
    { type: 'SEND_NEXT' },
    END_WHILE_BLK,
  ],
  'cmp1a_st'
);

const CMP_1A_REF = makeMainWorkspace(
  [
    whileBlk(sensor('hasNextItem')),
    ifBlk(cmpCond('<', '$dockCount[0]', '$dockQuota[0]')),
    { type: 'SWITCH_LEFT' },
    ELSE_BLK,
    { type: 'SWITCH_RIGHT' },
    END_IF_BLK,
    { type: 'SEND_NEXT' },
    END_WHILE_BLK,
  ],
  'cmp1a_ref'
);

// ===========================================================================
// cmp.2 — Dial-Distance Stop (Puzzle · Robot Grid)
// ===========================================================================

function buildCmp2CorridorGrid(
  idSuffix: string,
  label: string,
  length: number,
  k: number
): CurriculumGridDefinition {
  return {
    label,
    width: length,
    height: 1,
    robot: { x: 0, y: 0, dir: 'EAST' },
    barriers: [],
    dialTiles: [{ x: 0, y: 0, value: k }],
    worldItems: [{ id: `cell_cmp2_${idSuffix}`, type: 'crate', x: 0, y: 0 }],
    floorSwitches: [
      { id: `sw_cmp2_${idSuffix}`, x: k, y: 0, requiredForGoal: true },
    ],
    flags: [
      {
        id: `goal_cmp2_${idSuffix}`,
        x: length - 1,
        y: 0,
        isGoal: true,
        order: 0,
        collected: false,
      },
    ],
    strictInteractionCollision: true,
    requireAllItemsCollected: false,
    requireEmptyBackpackAtGoal: true,
  };
}

export const CMP_2_VARIANTS: CurriculumGridDefinition[] = [
  buildCmp2CorridorGrid('v1', 'Map 1: L = 6, Dial k = 3', 6, 3),
  buildCmp2CorridorGrid('v2', 'Map 2: L = 7, Dial k = 5', 7, 5),
  buildCmp2CorridorGrid('v3', 'Map 3: L = 5, Dial k = 2', 5, 2),
  buildCmp2CorridorGrid('v4', 'Map 4: L = 7, Dial k = 4', 7, 4),
];

const CMP_2_STARTER = makeMainWorkspace(
  [
    { type: 'PICK_UP' },
    { type: 'MOVE_FWD' },
    { type: 'USE_DROP' },
    whileBlk(notCond(sensor('atGoal'))),
    { type: 'MOVE_FWD' },
    END_WHILE_BLK,
  ],
  'cmp2_st'
);

const CMP_2_REF = makeMainWorkspace(
  [
    varAssign('k', '$tileDial'),
    varAssign('c', 0),
    { type: 'PICK_UP' },
    whileBlk(cmpCond('<', 'c', 'k')),
    { type: 'MOVE_FWD' },
    varOp('c', 'c', '+', 1),
    END_WHILE_BLK,
    { type: 'USE_DROP' },
    whileBlk(notCond(sensor('atGoal'))),
    { type: 'MOVE_FWD' },
    END_WHILE_BLK,
  ],
  'cmp2_ref'
);

// ===========================================================================
// cmp.3 — Slices & Leftovers (Explanation · Mixed Switchyard / Beat / Turtle)
// ===========================================================================

export const CMP_3_DEMO_TABS: ExplanationDemoTab[] = [
  {
    id: 'cmp_3_tab_parity',
    label: 'Leftover % 2',
    icon: '🚂',
    title: 'Alternating Switchyard Split (r = i % 2)',
    simId: 'switchyard',
    coPilotCard:
      'Dividing crate count i by 2 leaves remainder r flipping 1, 0, 1, 0. When r == 0, the switch swings Left; otherwise it swings Right!',
    switchyard: makeWeightedSwitchyardDef(
      '4-Crate Parity Stream (#1..#4)',
      'cmp3_t1',
      [
        { weight: 5, seqNum: 1 },
        { weight: 5, seqNum: 2 },
        { weight: 5, seqNum: 3 },
        { weight: 5, seqNum: 4 },
      ],
      [
        { id: 'DOCK_A', label: 'Even (#2, #4)', paritySlot: 'even', acceptsDamaged: false },
        { id: 'DOCK_B', label: 'Odd (#1, #3)', paritySlot: 'odd', acceptsDamaged: false },
      ],
      { initialDirection: 'right' }
    ),
    spotlights: ['variable-watch', 'branch'],
    workspace: makeMainWorkspace(
      [
        varAssign('i', 0),
        whileBlk(sensor('hasNextItem')),
        varOp('i', 'i', '+', 1),
        varOp('r', 'i', '%', 2),
        ifBlk(cmpCond('==', 'r', 0)),
        { type: 'SWITCH_LEFT' },
        ELSE_BLK,
        { type: 'SWITCH_RIGHT' },
        END_IF_BLK,
        { type: 'SEND_NEXT' },
        END_WHILE_BLK,
      ],
      'cmp3_t1'
    ),
  },
  {
    id: 'cmp_3_tab_beat',
    label: 'Beat % 4 & LED',
    icon: '🥁',
    title: 'Downbeat % 4 & Coordinate Parity (x + y) % 2',
    simId: 'beat',
    coPilotCard:
      'Watch b = $beatIndex % 4 drop the Kick drum on the downbeat while s = $cursorX + $cursorY and p = s % 2 swap Cyan and Purple LEDs!',
    beatRules: { patternLength: 8 },
    spotlights: ['variable-watch', 'beat-cursor-reticle'],
    workspace: makeMainWorkspace(
      [
        loopStart(8),
        varOp('s', '$cursorX', '+', '$cursorY'),
        varOp('p', 's', '%', 2),
        ifBlk(cmpCond('==', 'p', 0)),
        { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.cyan } },
        ELSE_BLK,
        { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.purple } },
        END_IF_BLK,
        { type: 'LIGHT_PIXEL', params: { x: '$cursorX', y: '$cursorY' } },
        varOp('b', '$beatIndex', '%', 4),
        ifBlk(cmpCond('==', 'b', 1)),
        { type: 'DRUM_KICK' },
        ELSE_BLK,
        { type: 'DRUM_CLAP' },
        END_IF_BLK,
        ifBlk(cmpCond('<', '$cursorX', 8)),
        { type: 'CURSOR_STEP' },
        END_IF_BLK,
        LOOP_END_BLK,
      ],
      'cmp3_t2'
    ),
  },
  {
    id: 'cmp_3_tab_heptagon',
    label: '360 / 7 Shape',
    icon: '🔷',
    title: 'Full-Precision Decimal Division (a = 360 / 7)',
    simId: 'turtle',
    coPilotCard:
      'a = 360 / n keeps full decimal precision (360 / 7) so all 7 big 110 px edges close cleanly back at home!',
    turtle: { mode: 'static' },
    spotlights: ['variable-watch'],
    workspace: makeMainWorkspace(
      [
        { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.blue } },
        varAssign('n', 7),
        varOp('a', 360, '/', 'n'),
        loopStart('n'),
        { type: 'FORWARD', params: { length: 110 } },
        { type: 'TURN_RIGHT', params: { angle: 'a' } },
        LOOP_END_BLK,
      ],
      'cmp3_t3'
    ),
  },
  {
    id: 'cmp_3_tab_zeroguard',
    label: '!= 0 Guard',
    icon: '🛡️',
    title: 'Zero-Guard Bubble (d != 0)',
    simId: 'turtle',
    coPilotCard:
      'You cannot slice a circle into 0 pieces — 360 / 0 or x % 0 pauses gently with an orange ÷0 bubble! Always check d != 0 first.',
    turtle: { mode: 'static' },
    spotlights: ['variable-watch', 'branch-skip'],
    workspace: makeMainWorkspace(
      [
        varAssign('d', 0),
        ifBlk(cmpCond('!=', 'd', 0)),
        varOp('a', 360, '/', 'd'),
        END_IF_BLK,
      ],
      'cmp3_t4'
    ),
  },
];

// ===========================================================================
// cmp.4 — Twin-Track Alternating Split (Puzzle · Switchyard)
// ===========================================================================

function buildCmp4ParityVariant(
  variantIdx: number,
  crateCount: number
): CurriculumSwitchyardDefinition {
  const items: WeightedStreamSpec[] = Array.from({ length: crateCount }, (_, i) => ({
    weight: 5,
    seqNum: i + 1,
  }));
  return makeWeightedSwitchyardDef(
    `Variant ${variantIdx}: ${crateCount} Crates (#1..#${crateCount})`,
    `cmp4_v${variantIdx}`,
    items,
    [
      { id: 'DOCK_A', label: 'Odd (#1, #3, ...)', paritySlot: 'odd', acceptsDamaged: false },
      { id: 'DOCK_B', label: 'Even (#2, #4, ...)', paritySlot: 'even', acceptsDamaged: false },
    ],
    { initialDirection: 'left' }
  );
}

export const CMP_4_VARIANTS: CurriculumSwitchyardDefinition[] = [
  buildCmp4ParityVariant(1, 6),
  buildCmp4ParityVariant(2, 4),
  buildCmp4ParityVariant(3, 5),
  buildCmp4ParityVariant(4, 8),
];

const CMP_4_STARTER = makeMainWorkspace(
  [
    whileBlk(sensor('hasNextItem')),
    varOp('c', 'c', '+', 1),
    { type: 'SWITCH_LEFT' },
    { type: 'SEND_NEXT' },
    END_WHILE_BLK,
  ],
  'cmp4_st'
);

const CMP_4_REF = makeMainWorkspace(
  [
    varAssign('c', 0),
    whileBlk(sensor('hasNextItem')),
    varOp('c', 'c', '+', 1),
    varOp('r', 'c', '%', 2),
    ifBlk(cmpCond('==', 'r', 1)),
    { type: 'SWITCH_LEFT' },
    ELSE_BLK,
    { type: 'SWITCH_RIGHT' },
    END_IF_BLK,
    { type: 'SEND_NEXT' },
    END_WHILE_BLK,
  ],
  'cmp4_ref'
);

// ===========================================================================
// cmp.5 — Computed Geometry Lab (Sandbox · Turtle LOGO)
// ===========================================================================

const CMP_5_STARTER = makeMainWorkspace(
  [
    { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.green } },
    varAssign('n', 5),
    varAssign('l', 100),
    varOp('a', 360, '/', 'n'),
    loopStart('n'),
    { type: 'FORWARD', params: { length: 'l' } },
    { type: 'TURN_RIGHT', params: { angle: 'a' } },
    LOOP_END_BLK,
  ],
  'cmp5_st'
);

export const CMP_5_VARIATIONS: CreativeVariationCard[] = [
  {
    id: 'cmp_5_var_star',
    title: 'Odd 7-Pointed Star (720 / n)',
    icon: '⭐',
    workspace: makeMainWorkspace(
      [
        { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.yellow } },
        varAssign('n', 7),
        varAssign('l', 200),
        varOp('a', 720, '/', 'n'),
        loopStart('n'),
        { type: 'FORWARD', params: { length: 'l' } },
        { type: 'TURN_RIGHT', params: { angle: 'a' } },
        LOOP_END_BLK,
      ],
      'cmp5_v1'
    ),
  },
  {
    id: 'cmp_5_var_sunburst',
    title: 'Two-Color Alternating Sunburst (i % 2)',
    icon: '☀️',
    workspace: makeMainWorkspace(
      [
        varAssign('n', 12),
        varOp('a', 360, '/', 'n'),
        loopStart('n'),
        varOp('i', 'i', '+', 1),
        varOp('r', 'i', '%', 2),
        ifBlk(cmpCond('==', 'r', 0)),
        { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.orange } },
        ELSE_BLK,
        { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.yellow } },
        END_IF_BLK,
        { type: 'FORWARD', params: { length: 140 } },
        { type: 'BACKWARD', params: { length: 140 } },
        { type: 'TURN_RIGHT', params: { angle: 'a' } },
        LOOP_END_BLK,
      ],
      'cmp5_v2'
    ),
  },
  {
    id: 'cmp_5_var_bullseye',
    title: 'Concentric Bullseye Rings (l = i * 24)',
    icon: '🎯',
    workspace: makeMainWorkspace(
      [
        varOp('a', 360, '/', 12),
        loopStart(4),
        varOp('i', 'i', '+', 1),
        varOp('l', 'i', '*', 24),
        varOp('d', 'i', '*', 45),
        varOp('x', 0, '-', 'd'),
        varOp('h', 'i', '*', 12),
        { type: 'TELEPORT', params: { x: 'x', y: 'h', heading: 0 } },
        varOp('r', 'i', '%', 2),
        ifBlk(cmpCond('==', 'r', 1)),
        { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.cyan } },
        ELSE_BLK,
        { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.pink } },
        END_IF_BLK,
        loopStart(12),
        { type: 'FORWARD', params: { length: 'l' } },
        { type: 'TURN_RIGHT', params: { angle: 'a' } },
        LOOP_END_BLK,
        LOOP_END_BLK,
      ],
      'cmp5_v3'
    ),
  },
  {
    id: 'cmp_5_var_pinwheel',
    title: 'Starburst Pinwheel (n = 8 Triangles)',
    icon: '🌀',
    workspace: makeMainWorkspace(
      [
        { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.purple } },
        varAssign('n', 8),
        varOp('a', 360, '/', 'n'),
        loopStart('n'),
        loopStart(3),
        { type: 'FORWARD', params: { length: 110 } },
        { type: 'TURN_RIGHT', params: { angle: 120 } },
        LOOP_END_BLK,
        { type: 'TURN_RIGHT', params: { angle: 'a' } },
        LOOP_END_BLK,
      ],
      'cmp5_v4'
    ),
  },
];

// ===========================================================================
// cmp.5a — Modulo Beat & Checkerboard Runway (Puzzle · Beat & Light)
// ===========================================================================

export interface CmpBeatCursorRowVariant {
  id: string;
  label: string;
  startX: number;
  startY: number;
  expectedRowColors: readonly string[];
}

export const CMP_5A_ROW_VARIANTS: readonly CmpBeatCursorRowVariant[] = [
  {
    id: 'cmp5a_v1_row1',
    label: 'Variant 1: Start (1, 1) Odd Row',
    startX: 1,
    startY: 1,
    expectedRowColors: Array.from({ length: 8 }, (_, idx) =>
      idx % 2 === 0 ? BEAT_COLORS.cyan : BEAT_COLORS.purple
    ),
  },
  {
    id: 'cmp5a_v2_row2',
    label: 'Variant 2: Start (1, 2) Even Row',
    startX: 1,
    startY: 2,
    expectedRowColors: Array.from({ length: 8 }, (_, idx) =>
      idx % 2 === 0 ? BEAT_COLORS.purple : BEAT_COLORS.cyan
    ),
  },
  {
    id: 'cmp5a_v3_row5',
    label: 'Variant 3: Start (1, 5) Odd Row',
    startX: 1,
    startY: 5,
    expectedRowColors: Array.from({ length: 8 }, (_, idx) =>
      idx % 2 === 0 ? BEAT_COLORS.cyan : BEAT_COLORS.purple
    ),
  },
  {
    id: 'cmp5a_v4_row6',
    label: 'Variant 4: Start (1, 6) Even Row',
    startX: 1,
    startY: 6,
    expectedRowColors: Array.from({ length: 8 }, (_, idx) =>
      idx % 2 === 0 ? BEAT_COLORS.purple : BEAT_COLORS.cyan
    ),
  },
];

export const CMP_5A_BEAT_VARIANTS: CurriculumBeatDefinition[] = CMP_5A_ROW_VARIANTS.map((v) => ({
  id: v.id,
  label: v.label,
  startX: v.startX,
  startY: v.startY,
  startDir: 'EAST',
  cursorVisible: true,
  expectedRow: {
    row: v.startY,
    colors: [...v.expectedRowColors],
  },
}));

const CMP_5A_MAIN_SPECS: BlockSpec[] = [
  loopStart(8),
  { type: 'CALL_F1' },
  varOp('b', '$beatIndex', '%', 2),
  ifBlk(cmpCond('==', 'b', 1)),
  { type: 'DRUM_KICK' },
  ELSE_BLK,
  { type: 'DRUM_SNARE' },
  END_IF_BLK,
  ifBlk(cmpCond('<', '$cursorX', 8)),
  { type: 'CURSOR_STEP' },
  END_IF_BLK,
  LOOP_END_BLK,
];

const CMP_5A_STARTER = makeWorkspace(
  {
    MAIN: CMP_5A_MAIN_SPECS,
    F1: [{ type: 'LIGHT_PIXEL', params: { x: '$cursorX', y: '$cursorY' } }],
  },
  'cmp5a_st'
);

const CMP_5A_REF = makeWorkspace(
  {
    MAIN: CMP_5A_MAIN_SPECS,
    F1: [
      varOp('s', '$cursorX', '+', '$cursorY'),
      varOp('p', 's', '%', 2),
      ifBlk(cmpCond('==', 'p', 0)),
      { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.cyan } },
      ELSE_BLK,
      { type: 'SET_LED_COLOR', params: { color: BEAT_COLORS.purple } },
      END_IF_BLK,
      { type: 'LIGHT_PIXEL', params: { x: '$cursorX', y: '$cursorY' } },
    ],
  },
  'cmp5a_ref'
);

// ===========================================================================
// cmp.6 — Comparing Stack Tops (Explanation · Depot)
// ===========================================================================

const DEPOT_MASK_S1_S2_IN_OUT =
  DEPOT_STATION_BITS.STACK_1 |
  DEPOT_STATION_BITS.STACK_2 |
  DEPOT_STATION_BITS.INPUT |
  DEPOT_STATION_BITS.OUT;

const DEPOT_MASK_S1_S2_S3_IN_OUT =
  DEPOT_STATION_BITS.STACK_1 |
  DEPOT_STATION_BITS.STACK_2 |
  DEPOT_STATION_BITS.STACK_3 |
  DEPOT_STATION_BITS.INPUT |
  DEPOT_STATION_BITS.OUT;

export const CMP_6_DEMO_TABS: ExplanationDemoTab[] = [
  {
    id: 'cmp_6_tab_peek',
    label: 'Peek $topValue',
    icon: '🔍',
    title: 'Non-Destructive Stack Peek ($heldValue > $topValue [Stack 1])',
    simId: 'depot',
    coPilotCard:
      'Hold block [7] to see $heldValue > $topValue [Stack 1] turn green without moving Stack 1! Bigger blocks go to Output, and smaller ones land on Stack 2.',
    depot: makeNumberedDepotDef({
      inputValues: [7, 2],
      stack1Values: [4],
      targetOutputValues: [7],
      targetStack2Values: [2],
      activeStationsMask: DEPOT_MASK_S1_S2_IN_OUT,
      enforceHanoiRule: false,
      requireEmptyStacks: false,
    }),
    spotlights: ['depot-stack-top', 'variable-watch'],
    workspace: makeMainWorkspace(
      [
        whileBlk(notCond(sensor('stationEmpty', 'INPUT'))),
        { type: 'DEPOT_MOVE_TO', params: { station: 'INPUT' } },
        { type: 'DEPOT_GRAB' },
        ifBlk(cmpCond('>', '$heldValue', '$topValue[STACK_1]')),
        { type: 'DEPOT_SEND_OUT' },
        ELSE_BLK,
        { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_2' } },
        { type: 'DEPOT_PLACE' },
        END_IF_BLK,
        END_WHILE_BLK,
      ],
      'cmp6_t1'
    ),
  },
  {
    id: 'cmp_6_tab_guard',
    label: 'Empty Guard OR',
    icon: '🛡️',
    title: 'Short-Circuit Empty Stack Guard (stationEmpty OR $heldValue > $topValue)',
    simId: 'depot',
    coPilotCard:
      'Peeking $topValue on an empty stack has no number to read! Put stationEmpty [Stack 2] on the left of OR so empty stacks skip the peek safely.',
    depot: makeNumberedDepotDef({
      inputValues: [5],
      stack2Values: [],
      targetStack2Values: [5],
      activeStationsMask: DEPOT_MASK_S1_S2_IN_OUT,
      enforceHanoiRule: false,
      requireEmptyStacks: false,
    }),
    spotlights: ['depot-stack-top', 'branch'],
    workspace: makeMainWorkspace(
      [
        { type: 'DEPOT_MOVE_TO', params: { station: 'INPUT' } },
        { type: 'DEPOT_GRAB' },
        ifBlk(
          orCond(
            sensor('stationEmpty', 'STACK_2'),
            cmpCond('>', '$heldValue', '$topValue[STACK_2]')
          )
        ),
        { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_2' } },
        { type: 'DEPOT_PLACE' },
        ELSE_BLK,
        { type: 'DEPOT_SEND_OUT' },
        END_IF_BLK,
      ],
      'cmp6_t2'
    ),
  },
];

// ===========================================================================
// cmp.7 — Count & Provision / Toy-Block Threshold Filter (Puzzle · Depot)
// ===========================================================================

export const CMP_7_VARIANTS: CurriculumDepotDefinition[] = [
  makeNumberedDepotDef({
    stack1Values: [5],
    inputValues: [2, 8, 5, 9, 4],
    targetOutputValues: [8, 9],
    targetStack2Values: [2, 5, 4],
    activeStationsMask: DEPOT_MASK_S1_S2_IN_OUT,
    enforceHanoiRule: false,
    requireEmptyStacks: false,
  }),
  makeNumberedDepotDef({
    stack1Values: [8],
    inputValues: [10, 8, 7, 12],
    targetOutputValues: [10, 12],
    targetStack2Values: [8, 7],
    activeStationsMask: DEPOT_MASK_S1_S2_IN_OUT,
    enforceHanoiRule: false,
    requireEmptyStacks: false,
  }),
  makeNumberedDepotDef({
    stack1Values: [3],
    inputValues: [1, 4, 3, 6, 2, 7],
    targetOutputValues: [4, 6, 7],
    targetStack2Values: [1, 3, 2],
    activeStationsMask: DEPOT_MASK_S1_S2_IN_OUT,
    enforceHanoiRule: false,
    requireEmptyStacks: false,
  }),
  makeNumberedDepotDef({
    stack1Values: [10],
    inputValues: [10, 15, 3, 11, 9],
    targetOutputValues: [15, 11],
    targetStack2Values: [10, 3, 9],
    activeStationsMask: DEPOT_MASK_S1_S2_IN_OUT,
    enforceHanoiRule: false,
    requireEmptyStacks: false,
  }),
];

const CMP_7_STARTER = makeMainWorkspace(
  [
    whileBlk(notCond(sensor('stationEmpty', 'INPUT'))),
    { type: 'DEPOT_MOVE_TO', params: { station: 'INPUT' } },
    { type: 'DEPOT_GRAB' },
    { type: 'DEPOT_SEND_OUT' },
    END_WHILE_BLK,
  ],
  'cmp7_st'
);

const CMP_7_REF = makeMainWorkspace(
  [
    whileBlk(notCond(sensor('stationEmpty', 'INPUT'))),
    { type: 'DEPOT_MOVE_TO', params: { station: 'INPUT' } },
    { type: 'DEPOT_GRAB' },
    ifBlk(cmpCond('>', '$heldValue', '$topValue[STACK_1]')),
    { type: 'DEPOT_SEND_OUT' },
    ELSE_BLK,
    { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_2' } },
    { type: 'DEPOT_PLACE' },
    END_IF_BLK,
    END_WHILE_BLK,
  ],
  'cmp7_ref'
);

// ===========================================================================
// cmp.8 — Maximum Crate Hunter (Puzzle · Depot)
// ===========================================================================

export const CMP_8_VARIANTS: CurriculumDepotDefinition[] = [
  makeNumberedDepotDef({
    inputValues: [4, 9, 2, 7],
    targetOutputValues: [9],
    targetStack2Values: [4, 2, 7],
    activeStationsMask: DEPOT_MASK_S1_S2_S3_IN_OUT,
    enforceHanoiRule: false,
    requireEmptyStacks: false,
  }),
  makeNumberedDepotDef({
    inputValues: [12, 5, 8, 11],
    targetOutputValues: [12],
    targetStack2Values: [5, 8, 11],
    activeStationsMask: DEPOT_MASK_S1_S2_S3_IN_OUT,
    enforceHanoiRule: false,
    requireEmptyStacks: false,
  }),
  makeNumberedDepotDef({
    inputValues: [3, 6, 6, 15, 10],
    targetOutputValues: [15],
    targetStack2Values: [3, 6, 6, 10],
    activeStationsMask: DEPOT_MASK_S1_S2_S3_IN_OUT,
    enforceHanoiRule: false,
    requireEmptyStacks: false,
  }),
  makeNumberedDepotDef({
    inputValues: [1, 8, 4],
    targetOutputValues: [8],
    targetStack2Values: [1, 4],
    activeStationsMask: DEPOT_MASK_S1_S2_S3_IN_OUT,
    enforceHanoiRule: false,
    requireEmptyStacks: false,
  }),
];

const CMP_8_F1_SWAP_SPECS: BlockSpec[] = [
  { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_3' } },
  { type: 'DEPOT_PLACE' },
  ifBlk(notCond(sensor('stationEmpty', 'STACK_1'))),
  { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_1' } },
  { type: 'DEPOT_GRAB' },
  { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_2' } },
  { type: 'DEPOT_PLACE' },
  END_IF_BLK,
  { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_3' } },
  { type: 'DEPOT_GRAB' },
  { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_1' } },
  { type: 'DEPOT_PLACE' },
];

const CMP_8_STARTER = makeWorkspace(
  {
    MAIN: [
      whileBlk(notCond(sensor('stationEmpty', 'INPUT'))),
      { type: 'DEPOT_MOVE_TO', params: { station: 'INPUT' } },
      { type: 'DEPOT_GRAB' },
      { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_1' } },
      { type: 'DEPOT_PLACE' },
      END_WHILE_BLK,
      { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_1' } },
      { type: 'DEPOT_GRAB' },
      { type: 'DEPOT_SEND_OUT' },
    ],
    F1: CMP_8_F1_SWAP_SPECS,
  },
  'cmp8_st'
);

const CMP_8_REF = makeWorkspace(
  {
    MAIN: [
      whileBlk(notCond(sensor('stationEmpty', 'INPUT'))),
      { type: 'DEPOT_MOVE_TO', params: { station: 'INPUT' } },
      { type: 'DEPOT_GRAB' },
      ifBlk(
        orCond(
          sensor('stationEmpty', 'STACK_1'),
          cmpCond('>', '$heldValue', '$topValue[STACK_1]')
        )
      ),
      { type: 'CALL_F1' },
      ELSE_BLK,
      { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_2' } },
      { type: 'DEPOT_PLACE' },
      END_IF_BLK,
      END_WHILE_BLK,
      { type: 'DEPOT_MOVE_TO', params: { station: 'STACK_1' } },
      { type: 'DEPOT_GRAB' },
      { type: 'DEPOT_SEND_OUT' },
    ],
    F1: CMP_8_F1_SWAP_SPECS,
  },
  'cmp8_ref'
);

// ===========================================================================
// cmp.9 — Fix Boundary Weight & Quota Gate (Fix-It Puzzle · Switchyard)
// ===========================================================================

export const CMP_9_VARIANTS: CurriculumSwitchyardDefinition[] = [
  makeWeightedSwitchyardDef(
    'Variant 1: [6, 10, 8, 4, 15] · Quota 2, Light < 10',
    'cmp9_v1',
    [{ weight: 6 }, { weight: 10 }, { weight: 8 }, { weight: 4 }, { weight: 15 }],
    [
      { id: 'DOCK_A', label: 'Express (< 10, Quota 2)', maxWeight: 9, quota: 2, acceptsDamaged: false },
      { id: 'DOCK_B', label: 'Overflow / >= 10', acceptsDamaged: false },
    ],
    { initialDirection: 'right' }
  ),
  makeWeightedSwitchyardDef(
    'Variant 2: [10, 5, 9, 3] · Quota 1, Light < 10',
    'cmp9_v2',
    [{ weight: 10 }, { weight: 5 }, { weight: 9 }, { weight: 3 }],
    [
      { id: 'DOCK_A', label: 'Express (< 10, Quota 1)', maxWeight: 9, quota: 1, acceptsDamaged: false },
      { id: 'DOCK_B', label: 'Overflow / >= 10', acceptsDamaged: false },
    ],
    { initialDirection: 'right' }
  ),
  makeWeightedSwitchyardDef(
    'Variant 3: [10, 10, 4, 8] · Quota 3, Light < 10',
    'cmp9_v3',
    [{ weight: 10 }, { weight: 10 }, { weight: 4 }, { weight: 8 }],
    [
      { id: 'DOCK_A', label: 'Express (< 10, Quota 3)', maxWeight: 9, quota: 3, acceptsDamaged: false },
      { id: 'DOCK_B', label: 'Overflow / >= 10', acceptsDamaged: false },
    ],
    { initialDirection: 'right' }
  ),
  makeWeightedSwitchyardDef(
    'Variant 4: [3, 7, 9, 2, 6] · Quota 3, Light < 10',
    'cmp9_v4',
    [{ weight: 3 }, { weight: 7 }, { weight: 9 }, { weight: 2 }, { weight: 6 }],
    [
      { id: 'DOCK_A', label: 'Express (< 10, Quota 3)', maxWeight: 9, quota: 3, acceptsDamaged: false },
      { id: 'DOCK_B', label: 'Overflow / >= 10', acceptsDamaged: false },
    ],
    { initialDirection: 'right' }
  ),
];

const CMP_9_STARTER = makeMainWorkspace(
  [
    whileBlk(sensor('hasNextItem')),
    ifBlk(
      andCond(
        cmpCond('<=', '$itemWeight', 10),
        cmpCond('<=', '$dockCount[0]', '$dockQuota[0]')
      )
    ),
    { type: 'SWITCH_LEFT' },
    ELSE_BLK,
    { type: 'SWITCH_RIGHT' },
    END_IF_BLK,
    { type: 'SEND_NEXT' },
    END_WHILE_BLK,
  ],
  'cmp9_st'
);

const CMP_9_REF = makeMainWorkspace(
  [
    whileBlk(sensor('hasNextItem')),
    ifBlk(
      andCond(
        cmpCond('<', '$itemWeight', 10),
        cmpCond('<', '$dockCount[0]', '$dockQuota[0]')
      )
    ),
    { type: 'SWITCH_LEFT' },
    ELSE_BLK,
    { type: 'SWITCH_RIGHT' },
    END_IF_BLK,
    { type: 'SEND_NEXT' },
    END_WHILE_BLK,
  ],
  'cmp9_ref'
);

// ===========================================================================
// cmp.A — Batch Quota Dispatcher (Capstone Puzzle · Switchyard)
// ===========================================================================

export const CMP_A_VARIANTS: CurriculumSwitchyardDefinition[] = [
  makeWeightedSwitchyardDef(
    'Variant 1: [8, 25, 12*, 20, 15, 6] · Quota 2',
    'cmpA_v1',
    [
      { weight: 8 },
      { weight: 25 },
      { weight: 12, damaged: true },
      { weight: 20 },
      { weight: 15 },
      { weight: 6 },
    ],
    [
      { id: 'DOCK_A', label: 'Priority (<= 20, Quota 2)', maxWeight: 20, quota: 2, acceptsDamaged: false },
      { id: 'DOCK_B', label: 'Overflow (<= 20)', maxWeight: 20, acceptsDamaged: false },
    ],
    {
      initialDirection: 'right',
      scrapChute: { expectedDamagedOnly: false, expectedCount: 2 },
      scrapRules: { kind: 'damaged_or_overweight', maxWeight: 20, allowDamaged: true, forbidIntact: true },
    }
  ),
  makeWeightedSwitchyardDef(
    'Variant 2: [21, 10, 5*, 14, 18, 9, 3] · Quota 3',
    'cmpA_v2',
    [
      { weight: 21 },
      { weight: 10 },
      { weight: 5, damaged: true },
      { weight: 14 },
      { weight: 18 },
      { weight: 9 },
      { weight: 3 },
    ],
    [
      { id: 'DOCK_A', label: 'Priority (<= 20, Quota 3)', maxWeight: 20, quota: 3, acceptsDamaged: false },
      { id: 'DOCK_B', label: 'Overflow (<= 20)', maxWeight: 20, acceptsDamaged: false },
    ],
    {
      initialDirection: 'right',
      scrapChute: { expectedDamagedOnly: false, expectedCount: 2 },
      scrapRules: { kind: 'damaged_or_overweight', maxWeight: 20, allowDamaged: true, forbidIntact: true },
    }
  ),
  makeWeightedSwitchyardDef(
    'Variant 3: [19, 22*, 4] · Quota 1',
    'cmpA_v3',
    [{ weight: 19 }, { weight: 22, damaged: true }, { weight: 4 }],
    [
      { id: 'DOCK_A', label: 'Priority (<= 20, Quota 1)', maxWeight: 20, quota: 1, acceptsDamaged: false },
      { id: 'DOCK_B', label: 'Overflow (<= 20)', maxWeight: 20, acceptsDamaged: false },
    ],
    {
      initialDirection: 'right',
      scrapChute: { expectedDamagedOnly: false, expectedCount: 1 },
      scrapRules: { kind: 'damaged_or_overweight', maxWeight: 20, allowDamaged: true, forbidIntact: true },
    }
  ),
  makeWeightedSwitchyardDef(
    'Variant 4: [11, 20, 30, 7, 13*, 5] · Quota 4',
    'cmpA_v4',
    [
      { weight: 11 },
      { weight: 20 },
      { weight: 30 },
      { weight: 7 },
      { weight: 13, damaged: true },
      { weight: 5 },
    ],
    [
      { id: 'DOCK_A', label: 'Priority (<= 20, Quota 4)', maxWeight: 20, quota: 4, acceptsDamaged: false },
      { id: 'DOCK_B', label: 'Overflow (<= 20)', maxWeight: 20, acceptsDamaged: false },
    ],
    {
      initialDirection: 'right',
      scrapChute: { expectedDamagedOnly: false, expectedCount: 2 },
      scrapRules: { kind: 'damaged_or_overweight', maxWeight: 20, allowDamaged: true, forbidIntact: true },
    }
  ),
];

const CMP_A_STARTER = makeMainWorkspace(
  [
    whileBlk(sensor('hasNextItem')),
    ifBlk(sensor('itemDamaged')),
    { type: 'SCRAP_ITEM' },
    ELSE_BLK,
    { type: 'SWITCH_RIGHT' },
    { type: 'SEND_NEXT' },
    END_IF_BLK,
    END_WHILE_BLK,
  ],
  'cmpA_st'
);

const CMP_A_REF = makeMainWorkspace(
  [
    whileBlk(sensor('hasNextItem')),
    ifBlk(orCond(sensor('itemDamaged'), cmpCond('>', '$itemWeight', 20))),
    { type: 'SCRAP_ITEM' },
    elseIfBlk(cmpCond('<', '$dockCount[0]', '$dockQuota[0]')),
    { type: 'SWITCH_LEFT' },
    { type: 'SEND_NEXT' },
    ELSE_BLK,
    { type: 'SWITCH_RIGHT' },
    { type: 'SEND_NEXT' },
    END_IF_BLK,
    END_WHILE_BLK,
  ],
  'cmpA_ref'
);

// ===========================================================================
// cmp.B — Parity & Threshold Maintenance (Capstone Puzzle · Robot Grid)
// ===========================================================================

function buildCmpBAlcoveHallGrid(
  idSuffix: string,
  label: string,
  thresholdK: number,
  junctionDials: readonly number[],
  moveCap: number
): CurriculumGridDefinition {
  const n = junctionDials.length;
  const width = n + 2;
  const height = 5;
  const barriers: WallEdge[] = [];

  // Seal start (0, 2) and goal (N + 1, 2) North & South
  barriers.push(edge(0, 2, 'H'), edge(0, 3, 'H'));
  barriers.push(edge(n + 1, 2, 'H'), edge(n + 1, 3, 'H'));

  // Open North (y = 1) and South (y = 3) alcoves at every junction x = 1..N,
  // sealed from y = 0 / y = 4 and sealed East/West from neighboring alcoves.
  for (let x = 1; x <= n; x++) {
    barriers.push(edge(x, 1, 'H'));
    barriers.push(edge(x, 4, 'H'));
  }
  for (let x = 1; x <= n + 1; x++) {
    barriers.push(edge(x, 1, 'V'));
    barriers.push(edge(x, 3, 'V'));
  }

  const dialTiles = [
    { x: 0, y: 2, value: thresholdK },
    ...junctionDials.map((t, idx) => ({ x: idx + 1, y: 2, value: t })),
  ];

  const worldItems: NonNullable<CurriculumGridDefinition['worldItems']> = [];
  const floorSwitches: NonNullable<CurriculumGridDefinition['floorSwitches']> = [];

  junctionDials.forEach((t, idx) => {
    const x = idx + 1;
    if (t >= thresholdK) {
      const bayY = x % 2 === 1 ? 1 : 3;
      worldItems.push({
        id: `cell_cmpB_${idSuffix}_${x}`,
        type: 'crate',
        x,
        y: bayY,
      });
      floorSwitches.push({
        id: `sw_cmpB_${idSuffix}_${x}`,
        x,
        y: 2,
        requiredForGoal: true,
      });
    }
  });

  return {
    label,
    width,
    height,
    robot: { x: 0, y: 2, dir: 'EAST' },
    barriers,
    dialTiles,
    worldItems,
    floorSwitches,
    flags: [
      {
        id: `goal_cmpB_${idSuffix}`,
        x: n + 1,
        y: 2,
        isGoal: true,
        order: 0,
        collected: false,
      },
    ],
    strictInteractionCollision: true,
    requireAllItemsCollected: false,
    requireEmptyBackpackAtGoal: true,
    ...({ moveCap } as Record<string, unknown>),
  };
}

export const CMP_B_VARIANTS: CurriculumGridDefinition[] = [
  buildCmpBAlcoveHallGrid('v1', 'Map 1: k = 5, Dials [7, 3, 6, 2]', 5, [7, 3, 6, 2], 9),
  buildCmpBAlcoveHallGrid('v2', 'Map 2: k = 4, Dials [4, 5, 2, 6, 4]', 4, [4, 5, 2, 6, 4], 14),
  buildCmpBAlcoveHallGrid('v3', 'Map 3: k = 6, Dials [2, 8, 6]', 6, [2, 8, 6], 8),
  buildCmpBAlcoveHallGrid(
    'v4',
    'Map 4: k = 3, Dials [1, 4, 3, 2, 5, 6]',
    3,
    [1, 4, 3, 2, 5, 6],
    15
  ),
];

const CMP_B_F1_LEFT_BAY: BlockSpec[] = [
  { type: 'TURN_LEFT' },
  { type: 'MOVE_FWD' },
  { type: 'PICK_UP' },
  { type: 'TURN_RIGHT' },
  { type: 'TURN_RIGHT' },
  { type: 'MOVE_FWD' },
  { type: 'USE_DROP' },
  { type: 'TURN_LEFT' },
];

const CMP_B_F2_RIGHT_BAY: BlockSpec[] = [
  { type: 'TURN_RIGHT' },
  { type: 'MOVE_FWD' },
  { type: 'PICK_UP' },
  { type: 'TURN_LEFT' },
  { type: 'TURN_LEFT' },
  { type: 'MOVE_FWD' },
  { type: 'USE_DROP' },
  { type: 'TURN_RIGHT' },
];

const CMP_B_STARTER = makeWorkspace(
  {
    MAIN: [
      varAssign('k', '$tileDial'),
      varAssign('s', 0),
      { type: 'MOVE_FWD' },
      whileBlk(notCond(sensor('atGoal'))),
      { type: 'MOVE_FWD' },
      END_WHILE_BLK,
    ],
    F1: CMP_B_F1_LEFT_BAY,
    F2: CMP_B_F2_RIGHT_BAY,
  },
  'cmpB_st'
);

const CMP_B_REF = makeWorkspace(
  {
    MAIN: [
      varAssign('k', '$tileDial'),
      varAssign('s', 0),
      { type: 'MOVE_FWD' },
      whileBlk(notCond(sensor('atGoal'))),
      varOp('s', 's', '+', 1),
      varAssign('t', '$tileDial'),
      ifBlk(cmpCond('>=', 't', 'k')),
      varOp('r', 's', '%', 2),
      ifBlk(cmpCond('==', 'r', 1)),
      { type: 'CALL_F1' },
      ELSE_BLK,
      { type: 'CALL_F2' },
      END_IF_BLK,
      END_IF_BLK,
      { type: 'MOVE_FWD' },
      END_WHILE_BLK,
    ],
    F1: CMP_B_F1_LEFT_BAY,
    F2: CMP_B_F2_RIGHT_BAY,
  },
  'cmpB_ref'
);

// ===========================================================================
// cmp.C — Parametric Spirograph & Galaxy (Capstone Creative · Turtle LOGO)
// ===========================================================================

const CMP_C_STARTER = makeWorkspace(
  {
    MAIN: [
      varAssign('n', 8),
      varAssign('k', 5),
      varAssign('d', 95),
      varOp('a', 360, '/', 'n'),
      varOp('b', 360, '/', 'k'),
      loopStart('n'),
      { type: 'CALL_F1' },
      { type: 'TURN_RIGHT', params: { angle: 'a' } },
      LOOP_END_BLK,
    ],
    F1: [
      varOp('i', 'i', '+', 1),
      varOp('r', 'i', '%', 2),
      ifBlk(cmpCond('==', 'r', 0)),
      { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.cyan } },
      ELSE_BLK,
      { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.pink } },
      END_IF_BLK,
      loopStart('k'),
      { type: 'FORWARD', params: { length: 'd' } },
      { type: 'TURN_RIGHT', params: { angle: 'b' } },
      LOOP_END_BLK,
    ],
  },
  'cmpC_st'
);

export const CMP_C_VARIATIONS: CreativeVariationCard[] = [
  {
    id: 'cmp_c_var_sunflower',
    title: 'Golden-Angle Sunflower (137.5°)',
    icon: '🌻',
    workspace: makeWorkspace(
      {
        MAIN: [
          varAssign('l', 50),
          loopStart(24),
          { type: 'CALL_F1' },
          varOp('l', 'l', '+', 8),
          { type: 'FORWARD', params: { length: 'l' } },
          { type: 'TURN_RIGHT', params: { angle: 137.5 } },
          LOOP_END_BLK,
        ],
        F1: [
          varOp('i', 'i', '+', 1),
          varOp('r', 'i', '%', 2),
          ifBlk(cmpCond('==', 'r', 0)),
          { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.yellow } },
          ELSE_BLK,
          { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.orange } },
          END_IF_BLK,
          loopStart(3),
          { type: 'FORWARD', params: { length: 55 } },
          { type: 'TURN_RIGHT', params: { angle: 120 } },
          LOOP_END_BLK,
        ],
      },
      'cmpC_v1'
    ),
  },
  {
    id: 'cmp_c_var_spiderweb',
    title: '6-Spoke Spiderweb (F1 Hex Rings)',
    icon: '🕸️',
    workspace: makeWorkspace(
      {
        MAIN: [
          { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.cyan } },
          loopStart(6),
          { type: 'FORWARD', params: { length: 200 } },
          { type: 'BACKWARD', params: { length: 200 } },
          { type: 'TURN_RIGHT', params: { angle: 60 } },
          LOOP_END_BLK,
          { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.purple } },
          loopStart(4),
          varOp('i', 'i', '+', 1),
          varOp('d', 'i', '*', 45),
          { type: 'CALL_F1' },
          LOOP_END_BLK,
        ],
        F1: [
          { type: 'PEN_UP' },
          { type: 'FORWARD', params: { length: 'd' } },
          { type: 'TURN_RIGHT', params: { angle: 120 } },
          { type: 'PEN_DOWN' },
          loopStart(6),
          { type: 'FORWARD', params: { length: 'd' } },
          { type: 'TURN_RIGHT', params: { angle: 60 } },
          LOOP_END_BLK,
          { type: 'PEN_UP' },
          { type: 'TURN_RIGHT', params: { angle: 60 } },
          { type: 'FORWARD', params: { length: 'd' } },
          { type: 'TURN_RIGHT', params: { angle: 180 } },
          { type: 'PEN_DOWN' },
        ],
      },
      'cmpC_v2'
    ),
  },
  {
    id: 'cmp_c_var_vortex',
    title: 'Optical Vortex ((360 / n) + 3)',
    icon: '🌀',
    workspace: makeMainWorkspace(
      [
        { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.blue } },
        varAssign('n', 10),
        varOp('t', 360, '/', 'n'),
        varOp('a', 't', '+', 3),
        varAssign('l', 40),
        loopStart(36),
        varOp('l', 'l', '+', 6),
        { type: 'FORWARD', params: { length: 'l' } },
        { type: 'TURN_RIGHT', params: { angle: 'a' } },
        LOOP_END_BLK,
      ],
      'cmpC_v3'
    ),
  },
  {
    id: 'cmp_c_var_mandala',
    title: 'Triple-Star Concentric Mandala (5, 7, 9)',
    icon: '✨',
    workspace: makeWorkspace(
      {
        MAIN: [
          { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.cyan } },
          varAssign('n', 5),
          varAssign('l', 150),
          varAssign('y', -79),
          { type: 'CALL_F1' },
          { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.purple } },
          varAssign('n', 7),
          varAssign('l', 210),
          varAssign('y', -134),
          { type: 'CALL_F1' },
          { type: 'SET_PEN_COLOR', params: { color: TURTLE_COLORS.yellow } },
          varAssign('n', 9),
          varAssign('l', 270),
          varAssign('y', -210),
          { type: 'CALL_F1' },
        ],
        F1: [
          varOp('t', 360, '/', 'n'),
          varOp('h', 90, '+', 't'),
          varOp('a', 720, '/', 'n'),
          { type: 'TELEPORT', params: { x: 0, y: 'y', heading: 'h' } },
          loopStart('n'),
          { type: 'FORWARD', params: { length: 'l' } },
          { type: 'TURN_RIGHT', params: { angle: 'a' } },
          LOOP_END_BLK,
        ],
      },
      'cmpC_v4'
    ),
  },
];

// ===========================================================================
// cmp.M1 — Max-Vault Hunter (Mastery Challenge · Robot Grid)
// ===========================================================================

function buildCmpM1VaultGrid(
  idSuffix: string,
  label: string,
  hallEndD: number,
  corridorDials: readonly number[],
  requiredMaxM: number
): CurriculumGridDefinition {
  const width = hallEndD + 1;
  const height = 4;
  const barriers: WallEdge[] = [];

  // Seal East corridor (0..D-1, 1) from y = 0 and y = 2
  for (let x = 0; x < hallEndD; x++) {
    barriers.push(edge(x, 1, 'H'));
    barriers.push(edge(x, 2, 'H'));
  }

  // Seal vertical end-vault shaft (D, 0..3) from West cells (D-1, 0), (D-1, 2), (D-1, 3)
  barriers.push(edge(hallEndD, 0, 'V'));
  barriers.push(edge(hallEndD, 2, 'V'));
  barriers.push(edge(hallEndD, 3, 'V'));

  return {
    label,
    width,
    height,
    robot: { x: 0, y: 1, dir: 'EAST' },
    barriers,
    dialTiles: corridorDials.map((val, idx) => ({
      x: idx + 1,
      y: 1,
      value: val,
    })),
    worldItems: [
      {
        id: `supply_cmpM1_${idSuffix}`,
        type: 'crate',
        x: hallEndD,
        y: 0,
        count: 10,
      },
    ],
    floorSwitches: [
      {
        id: `charge_pad_cmpM1_${idSuffix}`,
        x: hallEndD,
        y: 2,
        requiredForGoal: true,
        requiredCount: requiredMaxM,
      },
    ],
    flags: [
      {
        id: `goal_cmpM1_${idSuffix}`,
        x: hallEndD,
        y: 3,
        isGoal: true,
        order: 0,
        collected: false,
      },
    ],
    strictInteractionCollision: true,
    requireAllItemsCollected: false,
    requireEmptyBackpackAtGoal: true,
  };
}

export const CMP_M1_VARIANTS: CurriculumGridDefinition[] = [
  buildCmpM1VaultGrid('v1', 'Map 1: D = 4, Dials [2, 5, 1, 3], Max = 5', 4, [2, 5, 1, 3], 5),
  buildCmpM1VaultGrid('v2', 'Map 2: D = 3, Dials [4, 2, 1], Max = 4', 3, [4, 2, 1], 4),
  buildCmpM1VaultGrid(
    'v3',
    'Map 3: D = 5, Dials [1, 2, 3, 2, 6], Max = 6',
    5,
    [1, 2, 3, 2, 6],
    6
  ),
  buildCmpM1VaultGrid(
    'v4',
    'Map 4: D = 6, Dials [3, 3, 1, 2, 4, 3], Max = 4',
    6,
    [3, 3, 1, 2, 4, 3],
    4
  ),
];

const CMP_M1_STARTER: WorkspaceState = { MAIN: [], F1: [], F2: [], F3: [] };

const CMP_M1_REF = makeWorkspace(
  {
    MAIN: [
      varAssign('m', 0),
      whileBlk(sensor('pathAhead')),
      { type: 'MOVE_FWD' },
      varAssign('d', '$tileDial'),
      ifBlk(cmpCond('>', 'd', 'm')),
      varAssign('m', 'd'),
      END_IF_BLK,
      END_WHILE_BLK,
      { type: 'TURN_LEFT' },
      loopStart('m'),
      { type: 'CALL_F1' },
      LOOP_END_BLK,
      { type: 'TURN_RIGHT' },
      { type: 'TURN_RIGHT' },
      whileBlk(notCond(sensor('atGoal'))),
      { type: 'MOVE_FWD' },
      END_WHILE_BLK,
    ],
    F1: [
      { type: 'MOVE_FWD' },
      { type: 'PICK_UP' },
      { type: 'TURN_RIGHT' },
      { type: 'TURN_RIGHT' },
      { type: 'MOVE_FWD' },
      { type: 'MOVE_FWD' },
      { type: 'USE_DROP' },
      { type: 'TURN_RIGHT' },
      { type: 'TURN_RIGHT' },
      { type: 'MOVE_FWD' },
    ],
  },
  'cmpM1_ref'
);

// ===========================================================================
// cmp.M2 — Balanced Twin Scale (Mastery Challenge · Switchyard)
// ===========================================================================

export const CMP_M2_VARIANTS: CurriculumSwitchyardDefinition[] = [
  makeWeightedSwitchyardDef(
    'Variant 1: [10, 2*, 4, 3, 3] -> 10 kg vs 10 kg',
    'cmpM2_v1',
    [
      { weight: 10 },
      { weight: 2, damaged: true },
      { weight: 4 },
      { weight: 3 },
      { weight: 3 },
    ],
    [
      { id: 'DOCK_A', label: 'Scale A', acceptsDamaged: false },
      { id: 'DOCK_B', label: 'Scale B', acceptsDamaged: false },
    ],
    {
      initialDirection: 'left',
      scrapChute: { expectedDamagedOnly: true, expectedCount: 1 },
      scrapRules: 'damagedOnly',
      mode: 'balance_scale',
      balanceTolerance: 0,
      scaleTolerance: 0,
    }
  ),
  makeWeightedSwitchyardDef(
    'Variant 2: [12, 5, 4, 3, 1*, 8, 8] -> 20 kg vs 20 kg',
    'cmpM2_v2',
    [
      { weight: 12 },
      { weight: 5 },
      { weight: 4 },
      { weight: 3 },
      { weight: 1, damaged: true },
      { weight: 8 },
      { weight: 8 },
    ],
    [
      { id: 'DOCK_A', label: 'Scale A', acceptsDamaged: false },
      { id: 'DOCK_B', label: 'Scale B', acceptsDamaged: false },
    ],
    {
      initialDirection: 'left',
      scrapChute: { expectedDamagedOnly: true, expectedCount: 1 },
      scrapRules: 'damagedOnly',
      mode: 'balance_scale',
      balanceTolerance: 0,
      scaleTolerance: 0,
    }
  ),
  makeWeightedSwitchyardDef(
    'Variant 3: [15, 5, 5, 5, 6*] -> 15 kg vs 15 kg',
    'cmpM2_v3',
    [
      { weight: 15 },
      { weight: 5 },
      { weight: 5 },
      { weight: 5 },
      { weight: 6, damaged: true },
    ],
    [
      { id: 'DOCK_A', label: 'Scale A', acceptsDamaged: false },
      { id: 'DOCK_B', label: 'Scale B', acceptsDamaged: false },
    ],
    {
      initialDirection: 'left',
      scrapChute: { expectedDamagedOnly: true, expectedCount: 1 },
      scrapRules: 'damagedOnly',
      mode: 'balance_scale',
      balanceTolerance: 0,
      scaleTolerance: 0,
    }
  ),
  makeWeightedSwitchyardDef(
    'Variant 4: [20, 6, 7, 7, 4*, 8, 8] -> 28 kg vs 28 kg',
    'cmpM2_v4',
    [
      { weight: 20 },
      { weight: 6 },
      { weight: 7 },
      { weight: 7 },
      { weight: 4, damaged: true },
      { weight: 8 },
      { weight: 8 },
    ],
    [
      { id: 'DOCK_A', label: 'Scale A', acceptsDamaged: false },
      { id: 'DOCK_B', label: 'Scale B', acceptsDamaged: false },
    ],
    {
      initialDirection: 'left',
      scrapChute: { expectedDamagedOnly: true, expectedCount: 1 },
      scrapRules: 'damagedOnly',
      mode: 'balance_scale',
      balanceTolerance: 0,
      scaleTolerance: 0,
    }
  ),
];

const CMP_M2_STARTER: WorkspaceState = { MAIN: [], F1: [], F2: [], F3: [] };

const CMP_M2_REF = makeMainWorkspace(
  [
    varAssign('l', 0),
    varAssign('r', 0),
    whileBlk(sensor('hasNextItem')),
    ifBlk(sensor('itemDamaged')),
    { type: 'SCRAP_ITEM' },
    ELSE_BLK,
    ifBlk(cmpCond('<=', 'l', 'r')),
    { type: 'SWITCH_LEFT' },
    varOp('l', 'l', '+', '$itemWeight'),
    ELSE_BLK,
    { type: 'SWITCH_RIGHT' },
    varOp('r', 'r', '+', '$itemWeight'),
    END_IF_BLK,
    { type: 'SEND_NEXT' },
    END_IF_BLK,
    END_WHILE_BLK,
  ],
  'cmpM2_ref'
);

// ===========================================================================
// cmp.M3 — Snake-Plow Sweeper (Mastery Challenge · Robot Grid)
// ===========================================================================

function buildCmpM3WarehouseGrid(
  idSuffix: string,
  label: string,
  colsM: number,
  rowsN: number
): CurriculumGridDefinition {
  const goalX = rowsN % 2 === 1 ? colsM - 1 : 0;
  const goalY = rowsN - 1;
  const flags: CurriculumGridDefinition['flags'] = [];

  for (let y = 0; y < rowsN; y++) {
    for (let x = 0; x < colsM; x++) {
      if (x === 0 && y === 0) continue; // Start tile
      if (x === goalX && y === goalY) continue; // Goal tile added below
      flags.push({
        id: `flag_cmpM3_${idSuffix}_${x}_${y}`,
        x,
        y,
        isGoal: false,
        order: 0,
        collected: false,
      });
    }
  }

  flags.push({
    id: `goal_cmpM3_${idSuffix}`,
    x: goalX,
    y: goalY,
    isGoal: true,
    order: 0,
    collected: false,
  });

  return {
    label,
    width: colsM,
    height: rowsN,
    robot: { x: 0, y: 0, dir: 'EAST' },
    barriers: [],
    flags,
    strictInteractionCollision: true,
    requireAllItemsCollected: false,
    requireEmptyBackpackAtGoal: false,
  };
}

export const CMP_M3_VARIANTS: CurriculumGridDefinition[] = [
  buildCmpM3WarehouseGrid('v1', 'Map 1: 3 Rows × 4 Cols (SE Goal)', 4, 3),
  buildCmpM3WarehouseGrid('v2', 'Map 2: 4 Rows × 3 Cols (SW Goal)', 3, 4),
  buildCmpM3WarehouseGrid('v3', 'Map 3: 4 Rows × 5 Cols (SW Goal)', 5, 4),
  buildCmpM3WarehouseGrid('v4', 'Map 4: 5 Rows × 4 Cols (SE Goal)', 4, 5),
];

const CMP_M3_STARTER: WorkspaceState = { MAIN: [], F1: [], F2: [], F3: [] };

const CMP_M3_REF = makeMainWorkspace(
  [
    varAssign('r', 0),
    whileBlk(notCond(sensor('atGoal'))),
    whileBlk(andCond(sensor('pathAhead'), notCond(sensor('atGoal')))),
    { type: 'MOVE_FWD' },
    END_WHILE_BLK,
    ifBlk(notCond(sensor('atGoal'))),
    varOp('p', 'r', '%', 2),
    ifBlk(cmpCond('==', 'p', 0)),
    { type: 'TURN_RIGHT' },
    { type: 'MOVE_FWD' },
    { type: 'TURN_RIGHT' },
    ELSE_BLK,
    { type: 'TURN_LEFT' },
    { type: 'MOVE_FWD' },
    { type: 'TURN_LEFT' },
    END_IF_BLK,
    varOp('r', 'r', '+', 1),
    END_IF_BLK,
    END_WHILE_BLK,
  ],
  'cmpM3_ref'
);

// ===========================================================================
// Palette Presets
// ===========================================================================

const CMP_SWITCHYARD_BASIC_PALETTE: PaletteConfig = {
  allowedSimBlocks: ['SWITCH_LEFT', 'SWITCH_RIGHT', 'SEND_NEXT'],
  allowedControlBlocks: ['WHILE', 'END_WHILE', 'IF', 'ELSE', 'END_IF'],
  allowedScopes: ['MAIN'],
  allowRepeatBadges: false,
  allowVariables: false,
  allowedSensors: ['hasNextItem'],
  allowedValueSensors: ['$itemWeight', '$dockCount', '$dockQuota'],
  allowedCmpOps: CMP_ALL_OPS,
  allowRecursion: false,
};

// ===========================================================================
// Canonical Export: CMP_ACTIVITIES (18 Activities in Curriculum Order)
// ===========================================================================

export const CMP_ACTIVITIES: CurriculumActivity[] = [
  // 1. cmp.0 — Tipping the Scales (Explanation · Switchyard)
  {
    id: 'cmp.0',
    moduleId: 'cmp',
    version: 1,
    format: 'explanation',
    simId: 'switchyard',
    icon: '⚖️',
    title: 'Tipping the Scales',
    concept:
      'Relational comparisons (<, >, <=, >=, ==, !=) compare live sensor values like $itemWeight and $dockCount against thresholds and $dockQuota',
    description:
      'Explore live Watch Tray comparisons on Switchyard weight gates ($itemWeight > 10) and exact dock quotas ($dockCount == $dockQuota).',
    coPilotCard:
      'Watch live crate weights and dock counters tip the comparison scale green or red! Notice > skips exact ties while == triggers only on an exact match.',
    switchyard: CMP_0_DEMO_TABS[0].switchyard,
    demoTabs: CMP_0_DEMO_TABS,
    palette: {
      ...CMP_SWITCHYARD_BASIC_PALETTE,
    },
  },

  // 2. cmp.1 — Heavy Freight Bypass (Puzzle · Switchyard)
  {
    id: 'cmp.1',
    moduleId: 'cmp',
    version: 1,
    format: 'puzzle',
    simId: 'switchyard',
    icon: '🏋️',
    title: 'Heavy Freight Bypass',
    concept:
      'Strict greater-than comparison ($itemWeight > 10) separating heavy > 10 kg freight from <= 10 kg boundary crates',
    description:
      'Route strictly heavy crates ($itemWeight > 10) to Dock A (Left) and keep 10 kg or lighter crates on Dock B (Right).',
    hint: 'Check IF ($itemWeight > 10) so exact 10 kg crates stay on the Right track!',
    switchyard: CMP_1_VARIANTS[0],
    switchyardVariants: CMP_1_VARIANTS,
    starterWorkspace: CMP_1_STARTER,
    palette: {
      ...CMP_SWITCHYARD_BASIC_PALETTE,
      allowedValueSensors: ['$itemWeight'],
    },
    slotCap: { maxTotal: 10, perScope: { MAIN: 10 } },
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeScaffoldFromReference(CMP_1_REF, { MAIN: [2, 4] }, 'cmp1_scaf'),
    },
    referenceSolution: CMP_1_REF,
    antiBypassRules: [
      {
        id: 'cmp1_starter_fails',
        description: 'Unmodified starter sends heavy (> 10 kg) crates to Express Dock B.',
        unmodifiedStarterMustFail: true,
      },
      {
        id: 'cmp1_min_edits',
        description: 'Requires inserting IF ($itemWeight > 10) / ELSE branch around switch routing.',
        minStarterEditDistance: 2,
      },
    ],
  },

  // 3. cmp.1a — Dynamic Dock Quota (Puzzle · Switchyard)
  {
    id: 'cmp.1a',
    moduleId: 'cmp',
    version: 1,
    format: 'puzzle',
    simId: 'switchyard',
    icon: '📊',
    title: 'Dynamic Dock Quota',
    concept:
      'Comparing two live sensors ($dockCount[0] < $dockQuota[0]) to fill varying dock quotas without hardcoding counts',
    description:
      'Fill Dock A (Left) until $dockCount [A] reaches $dockQuota [A], then route remaining overflow crates to Dock B (Right).',
    hint: 'Compare $dockCount [A] < $dockQuota [A] directly so one program works for quotas 1, 2, 3, and 4!',
    switchyard: CMP_1A_VARIANTS[0],
    switchyardVariants: CMP_1A_VARIANTS,
    starterWorkspace: CMP_1A_STARTER,
    palette: {
      ...CMP_SWITCHYARD_BASIC_PALETTE,
      allowedValueSensors: ['$dockCount', '$dockQuota'],
    },
    slotCap: { maxTotal: 10, perScope: { MAIN: 10 } },
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeScaffoldFromReference(CMP_1A_REF, { MAIN: [2, 4] }, 'cmp1a_scaf'),
    },
    referenceSolution: CMP_1A_REF,
    antiBypassRules: [
      {
        id: 'cmp1a_starter_fails',
        description: 'Unmodified starter overflows Dock A past its quota on every variant.',
        unmodifiedStarterMustFail: true,
      },
      {
        id: 'cmp1a_min_edits',
        description: 'Requires adding sensor-to-sensor IF ($dockCount < $dockQuota) / ELSE check.',
        minStarterEditDistance: 2,
      },
    ],
  },

  // 4. cmp.2 — Dial-Distance Stop (Puzzle · Robot Grid)
  {
    id: 'cmp.2',
    moduleId: 'cmp',
    version: 1,
    format: 'puzzle',
    simId: 'grid',
    icon: '🎛️',
    title: 'Dial-Distance Stop',
    concept:
      'Variable-driven WHILE loop condition (c < k) counting steps up to a saved $tileDial distance',
    description:
      'Read k = $tileDial at start, carry the power cell forward while c < k, drop it on the hidden switch at tile k, and walk to the Goal flag.',
    hint: 'Save k = $tileDial and c = 0 first, then step and add c = c + 1 inside WHILE (c < k) before dropping!',
    grid: CMP_2_VARIANTS[0],
    gridVariants: CMP_2_VARIANTS,
    starterWorkspace: CMP_2_STARTER,
    palette: {
      allowedSimBlocks: ['MOVE_FWD', 'PICK_UP', 'USE_DROP'],
      allowedControlBlocks: ['WHILE', 'END_WHILE', 'VAR_ASSIGN', 'VAR_OP'],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: false,
      allowVariables: true,
      allowedVariableNames: varNames('k', 'c'),
      allowedVarOps: ['+'],
      allowedCmpOps: CMP_ALL_OPS,
      allowedValueSensors: ['$tileDial'],
      allowedSensors: ['atGoal'],
      allowedCombinators: ['NOT'],
      allowRecursion: false,
    },
    slotCap: { maxTotal: 13, perScope: { MAIN: 13 } },
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeScaffoldFromReference(CMP_2_REF, { MAIN: [0, 5] }, 'cmp2_scaf'),
    },
    referenceSolution: CMP_2_REF,
    antiBypassRules: [
      {
        id: 'cmp2_starter_fails',
        description: 'Unmodified starter drops the cell at x = 1 instead of dial distance k.',
        unmodifiedStarterMustFail: true,
      },
      {
        id: 'cmp2_requires_variables',
        description: 'Varied switch positions k in {3, 5, 2, 4} with zero visual beacon cue require saving $tileDial into a variable.',
        allowVariables: false,
      },
    ],
  },

  // 5. cmp.3 — Slices & Leftovers (Explanation · Mixed Switchyard / Beat / Turtle)
  {
    id: 'cmp.3',
    moduleId: 'cmp',
    version: 1,
    format: 'explanation',
    simId: 'turtle',
    icon: '➗',
    title: 'Slices & Leftovers',
    concept:
      'Decimal division (/) for exact polygon angles (360 / n), integer modulo (%) for alternating remainders, and != 0 zero-division guards',
    description:
      'Tour four live Watch Tray beats: % 2 Switchyard alternation, % 4 downbeat + (x + y) % 2 LEDs, 360 / 7 heptagon geometry, and safe d != 0 guards.',
    coPilotCard:
      'Division (/) slices circles into exact decimal turns, while modulo (%) spots leftover remainders for alternating rhythms! Always check != 0 before dividing.',
    turtle: { mode: 'static' },
    demoTabs: CMP_3_DEMO_TABS,
    palette: {
      allowedSimBlocks: CMP_TURTLE_SANDBOX_BLOCKS,
      allowedControlBlocks: [
        'LOOP_START',
        'LOOP_END',
        'WHILE',
        'END_WHILE',
        'IF',
        'ELSE',
        'END_IF',
        'VAR_ASSIGN',
        'VAR_OP',
      ],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: true,
      allowVariables: true,
      allowedVariableNames: varNames('n', 'a', 'd', 'i', 'r', 's', 'p', 'b'),
      allowedVarOps: ['+', '-', '*', '/', '%'],
      allowedCmpOps: CMP_ALL_OPS,
      allowRecursion: false,
    },
  },

  // 6. cmp.4 — Twin-Track Alternating Split (Puzzle · Switchyard)
  {
    id: 'cmp.4',
    moduleId: 'cmp',
    version: 1,
    format: 'puzzle',
    simId: 'switchyard',
    icon: '🔀',
    title: 'Twin-Track Alternating Split',
    concept:
      'Strict 3-address modulo parity (r = c % 2) alternating odd crates Left (r == 1) and even crates Right (r == 0)',
    description:
      'Count each incoming crate with c = c + 1, compute r = c % 2, and send odd crates (#1, #3, ...) Left and even crates (#2, #4, ...) Right.',
    hint: 'Compute r = c % 2 into variable r first, then check IF (r == 1) to alternate Left and Right!',
    switchyard: CMP_4_VARIANTS[0],
    switchyardVariants: CMP_4_VARIANTS,
    starterWorkspace: CMP_4_STARTER,
    palette: {
      allowedSimBlocks: ['SWITCH_LEFT', 'SWITCH_RIGHT', 'SEND_NEXT'],
      allowedControlBlocks: [
        'WHILE',
        'END_WHILE',
        'IF',
        'ELSE',
        'END_IF',
        'VAR_ASSIGN',
        'VAR_OP',
      ],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: false,
      allowVariables: true,
      allowedVariableNames: varNames('c', 'r'),
      allowedVarOps: ['+', '%'],
      allowedCmpOps: CMP_ALL_OPS,
      allowedSensors: ['hasNextItem'],
      allowRecursion: false,
    },
    slotCap: { maxTotal: 13, perScope: { MAIN: 13 } },
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeScaffoldFromReference(CMP_4_REF, { MAIN: [3, 5] }, 'cmp4_scaf'),
    },
    referenceSolution: CMP_4_REF,
    antiBypassRules: [
      {
        id: 'cmp4_starter_fails',
        description: 'Unmodified starter sends all crates Left instead of alternating odd/even.',
        unmodifiedStarterMustFail: true,
      },
      {
        id: 'cmp4_requires_if',
        description: 'Odd-length Variant #3 (5 crates) defeats unguarded 2-item pair loops without IF.',
        forbidBlocks: ['IF'],
      },
      {
        id: 'cmp4_requires_while',
        description: 'Variable stream lengths (6, 4, 5, 8) defeat flat unrolling within 13 slots without WHILE.',
        forbidBlocks: ['WHILE'],
      },
    ],
  },

  // 7. cmp.5 — Computed Geometry Lab (Sandbox · Turtle LOGO)
  {
    id: 'cmp.5',
    moduleId: 'cmp',
    version: 1,
    format: 'sandbox',
    simId: 'turtle',
    icon: '📐',
    title: 'Computed Geometry Lab',
    concept:
      'Parametric polygons (360 / n), odd star turns (720 / n), and % 2 two-color rays & concentric rings at full >= 160 px canvas scale',
    description:
      'Experiment with n-sided polygons (360 / n), odd stars (720 / n), two-color sunbursts (i % 2), bullseyes, and rotating pinwheels!',
    hint: 'Keep side length l >= 100 px so shapes stay bold on canvas, and keep n > 0 before dividing 360 / n!',
    turtle: { mode: 'static' },
    starterWorkspace: CMP_5_STARTER,
    variations: CMP_5_VARIATIONS,
    palette: {
      allowedSimBlocks: CMP_TURTLE_SANDBOX_BLOCKS,
      allowedControlBlocks: [
        'LOOP_START',
        'LOOP_END',
        'IF',
        'ELSE',
        'END_IF',
        'VAR_ASSIGN',
        'VAR_OP',
      ],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: true,
      allowActionParams: true,
      allowVariables: true,
      allowedVariableNames: varNames('n', 'l', 'a', 'i', 'r', 'd', 'x', 'h'),
      allowedVarOps: ['+', '-', '*', '/', '%'],
      allowedCmpOps: CMP_ALL_OPS,
      allowRecursion: false,
    },
    slotCap: { maxTotal: 24, perScope: { MAIN: 24 } },
  },

  // 8. cmp.5a — Modulo Beat & Checkerboard Runway (Puzzle · Beat & Light)
  {
    id: 'cmp.5a',
    moduleId: 'cmp',
    version: 1,
    format: 'puzzle',
    simId: 'beat',
    icon: '🎹',
    title: 'Checkerboard Groove Runway',
    concept:
      '2D coordinate parity (($cursorX + $cursorY) % 2) inside F1 painting alternating Cyan and Purple LEDs across both odd and even rows',
    description:
      'Complete F1 using s = $cursorX + $cursorY and p = s % 2 so odd and even start rows light up in true checkerboard Cyan (0) and Purple (1) colors!',
    hint: 'Add s = $cursorX + $cursorY inside F1, then check p = s % 2 == 0 for Cyan and ELSE for Purple before LIGHT_PIXEL!',
    beat: CMP_5A_BEAT_VARIANTS[0],
    beatVariants: CMP_5A_BEAT_VARIANTS,
    beatRules: { patternLength: 8 },
    starterWorkspace: CMP_5A_STARTER,
    palette: {
      allowedSimBlocks: CMP_BEAT_PUZZLE_BLOCKS,
      allowedControlBlocks: [
        'LOOP_START',
        'LOOP_END',
        'CALL_F1',
        'IF',
        'ELSE',
        'END_IF',
        'VAR_ASSIGN',
        'VAR_OP',
      ],
      allowedScopes: ['MAIN', 'F1'],
      allowRepeatBadges: false,
      allowActionParams: true,
      allowVariables: true,
      allowedVariableNames: varNames('s', 'p', 'b'),
      allowedVarOps: ['+', '-', '%'],
      allowedCmpOps: CMP_ALL_OPS,
      allowedValueSensors: ['$cursorX', '$cursorY', '$beatIndex'],
      allowRecursion: false,
    },
    slotCap: { maxTotal: 28, perScope: { MAIN: 14, F1: 14 } },
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeScaffoldFromReference(CMP_5A_REF, { F1: [0, 1, 3] }, 'cmp5a_scaf'),
    },
    referenceSolution: CMP_5A_REF,
    antiBypassRules: [
      {
        id: 'cmp5a_starter_fails',
        description: 'Unmodified starter paints monochrome Cyan across the row instead of alternating Cyan/Purple.',
        unmodifiedStarterMustFail: true,
      },
      {
        id: 'cmp5a_min_edits',
        description: 'Requires adding 2D coordinate sum + % 2 branch inside F1.',
        minStarterEditDistance: 4,
      },
    ],
  },

  // 9. cmp.6 — Comparing Stack Tops (Explanation · Depot)
  {
    id: 'cmp.6',
    moduleId: 'cmp',
    version: 1,
    format: 'explanation',
    simId: 'depot',
    icon: '🏗️',
    title: 'Peeking the Top Block',
    concept:
      'Non-destructive numeric stack peeks ($heldValue vs $topValue[Station]) and short-circuit stationEmpty OR guards in Toy-Block Mode',
    description:
      'Watch $heldValue compare against $topValue [Stack 1] without moving Stack 1, and see why stationEmpty [Stack 2] OR ... guards empty stacks.',
    coPilotCard:
      'Compare $heldValue against $topValue [Stack 1] right in mid-air without disturbing the stack! When a stack might start empty, check stationEmpty on the left of OR first.',
    depot: CMP_6_DEMO_TABS[0].depot,
    demoTabs: CMP_6_DEMO_TABS,
    palette: {
      allowedSimBlocks: ['DEPOT_MOVE_TO', 'DEPOT_GRAB', 'DEPOT_PLACE', 'DEPOT_SEND_OUT'],
      allowedControlBlocks: ['WHILE', 'END_WHILE', 'IF', 'ELSE', 'END_IF'],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: false,
      allowVariables: false,
      allowedSensors: ['stationEmpty', 'hasItem'],
      allowedCombinators: ['NOT', 'OR', 'AND'],
      allowedValueSensors: ['$heldValue', '$topValue'],
      allowedCmpOps: CMP_ALL_OPS,
      allowRecursion: false,
    },
  },

  // 10. cmp.7 — Toy-Block Threshold Filter (Puzzle · Depot)
  {
    id: 'cmp.7',
    moduleId: 'cmp',
    version: 1,
    format: 'puzzle',
    simId: 'depot',
    icon: '🧱',
    title: 'Reference Post Filter',
    concept:
      'Filtering numbered Input blocks by peeking $heldValue > $topValue[STACK_1] without disturbing the reference block on Stack 1',
    description:
      'Grab each numbered block from INPUT: if $heldValue > $topValue [Stack 1], send it to OUTPUT; otherwise stack it on Stack 2.',
    hint: 'Keep Stack 1 untouched as your reference post! Check IF ($heldValue > $topValue [Stack 1]) so ties (==) go to Stack 2.',
    depot: CMP_7_VARIANTS[0],
    depotVariants: CMP_7_VARIANTS,
    starterWorkspace: CMP_7_STARTER,
    palette: {
      allowedSimBlocks: ['DEPOT_MOVE_TO', 'DEPOT_GRAB', 'DEPOT_PLACE', 'DEPOT_SEND_OUT'],
      allowedControlBlocks: ['WHILE', 'END_WHILE', 'IF', 'ELSE', 'END_IF'],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: false,
      allowVariables: false,
      allowedSensors: ['stationEmpty', 'hasItem'],
      allowedCombinators: ['NOT'],
      allowedValueSensors: ['$heldValue', '$topValue'],
      allowedCmpOps: CMP_ALL_OPS,
      allowRecursion: false,
    },
    slotCap: { maxTotal: 10, perScope: { MAIN: 10 } },
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeScaffoldFromReference(CMP_7_REF, { MAIN: [4, 7] }, 'cmp7_scaf'),
    },
    referenceSolution: CMP_7_REF,
    antiBypassRules: [
      {
        id: 'cmp7_starter_fails',
        description: 'Unmodified starter sends <= threshold blocks to Output instead of Stack 2.',
        unmodifiedStarterMustFail: true,
      },
      {
        id: 'cmp7_min_edits',
        description: 'Requires adding IF ($heldValue > $topValue[STACK_1]) / ELSE Stack 2 branch.',
        minStarterEditDistance: 3,
      },
    ],
  },

  // 11. cmp.8 — Maximum Crate Hunter (Puzzle · Depot)
  {
    id: 'cmp.8',
    moduleId: 'cmp',
    version: 1,
    format: 'puzzle',
    simId: 'depot',
    icon: '👑',
    title: 'Champion Block Hunter',
    concept:
      'Running-maximum pattern using short-circuit stationEmpty[STACK_1] OR $heldValue > $topValue[STACK_1] with an F1 champion swap',
    description:
      'Scan every block from INPUT: when Stack 1 is empty OR $heldValue beats $topValue [Stack 1], call F1 to crown the new champion; send smaller/tied blocks to Stack 2, then ship Stack 1 to OUTPUT!',
    hint: 'Put stationEmpty [Stack 1] on the LEFT of OR ($heldValue > $topValue [Stack 1]) so the very first block crowns Stack 1 safely!',
    depot: CMP_8_VARIANTS[0],
    depotVariants: CMP_8_VARIANTS,
    starterWorkspace: CMP_8_STARTER,
    palette: {
      allowedSimBlocks: ['DEPOT_MOVE_TO', 'DEPOT_GRAB', 'DEPOT_PLACE', 'DEPOT_SEND_OUT'],
      allowedControlBlocks: ['WHILE', 'END_WHILE', 'IF', 'ELSE', 'END_IF', 'CALL_F1'],
      allowedScopes: ['MAIN', 'F1'],
      allowRepeatBadges: false,
      allowVariables: false,
      allowedSensors: ['stationEmpty', 'hasItem'],
      allowedCombinators: ['NOT', 'OR', 'AND'],
      allowedValueSensors: ['$heldValue', '$topValue'],
      allowedCmpOps: CMP_ALL_OPS,
      allowRecursion: false,
    },
    slotCap: { maxTotal: 26, perScope: { MAIN: 14, F1: 12 } },
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeScaffoldFromReference(CMP_8_REF, { MAIN: [4, 7] }, 'cmp8_scaf'),
    },
    referenceSolution: CMP_8_REF,
    antiBypassRules: [
      {
        id: 'cmp8_starter_fails',
        description: 'Unmodified starter stacks every block onto Stack 1 and ships the last block instead of the maximum.',
        unmodifiedStarterMustFail: true,
      },
      {
        id: 'cmp8_min_edits',
        description: 'Requires adding short-circuit OR guard + CALL_F1 / Stack 2 branch.',
        minStarterEditDistance: 3,
      },
    ],
  },

  // 12. cmp.9 — Fix Boundary Weight & Quota Gate (Fix-It Puzzle · Switchyard)
  {
    id: 'cmp.9',
    moduleId: 'cmp',
    version: 1,
    format: 'puzzle',
    simId: 'switchyard',
    icon: '🔧',
    title: 'Fix the Off-by-One Gates',
    concept:
      'Debugging inclusive (<=) vs strict (<) boundary bugs on both $itemWeight < 10 and $dockCount[0] < $dockQuota[0]',
    description:
      'Dock A only accepts strictly light (< 10 kg) crates up to its exact quota! Fix both <= off-by-one bugs inside the compound AND check.',
    hint: 'Change <= 10 to < 10 (so 10 kg goes Right) AND change <= $dockQuota [A] to < $dockQuota [A] (so Dock A stops at quota instead of quota + 1)!',
    switchyard: CMP_9_VARIANTS[0],
    switchyardVariants: CMP_9_VARIANTS,
    starterWorkspace: CMP_9_STARTER,
    palette: {
      ...CMP_SWITCHYARD_BASIC_PALETTE,
      allowedCombinators: ['AND', 'OR', 'NOT'],
    },
    slotCap: { maxTotal: 10, perScope: { MAIN: 10 } },
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeScaffoldFromReference(CMP_9_REF, { MAIN: [2] }, 'cmp9_scaf'),
    },
    referenceSolution: CMP_9_REF,
    antiBypassRules: [
      {
        id: 'cmp9_starter_fails',
        description: 'Buggy <= / <= starter admits 10 kg crates and overfills Dock A by 1.',
        unmodifiedStarterMustFail: true,
      },
      {
        id: 'cmp9_min_edits',
        description: 'Requires editing the compound IF condition to fix both off-by-one operators.',
        minStarterEditDistance: 1,
      },
    ],
  },

  // 13. cmp.A — Batch Quota Dispatcher (Capstone Puzzle · Switchyard)
  {
    id: 'cmp.A',
    moduleId: 'cmp',
    version: 1,
    format: 'capstone',
    capstoneType: 'puzzle',
    simId: 'switchyard',
    icon: '🏆',
    title: 'Batch Quota Dispatcher',
    concept:
      'Priority ELSE_IF chain combining OR rejection (itemDamaged OR $itemWeight > 20), dynamic quota filling ($dockCount < $dockQuota), and overflow routing',
    description:
      'Scrap damaged OR overweight (> 20 kg) crates first, fill Priority Dock A up to $dockQuota [A] with valid crates (including exact 20 kg!), and send extra valid crates to Dock B.',
    hint: 'Check IF (itemDamaged OR $itemWeight > 20) -> SCRAP_ITEM, ELSE_IF ($dockCount [A] < $dockQuota [A]) -> Left + SEND_NEXT, ELSE -> Right + SEND_NEXT!',
    switchyard: CMP_A_VARIANTS[0],
    switchyardVariants: CMP_A_VARIANTS,
    starterWorkspace: CMP_A_STARTER,
    palette: {
      allowedSimBlocks: ['SWITCH_LEFT', 'SWITCH_RIGHT', 'SEND_NEXT', 'SCRAP_ITEM'],
      allowedControlBlocks: ['WHILE', 'END_WHILE', 'IF', 'ELSE_IF', 'ELSE', 'END_IF'],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: false,
      allowVariables: false,
      allowedSensors: ['hasNextItem', 'itemDamaged'],
      allowedCombinators: ['OR', 'AND', 'NOT'],
      allowedValueSensors: ['$itemWeight', '$dockCount', '$dockQuota'],
      allowedCmpOps: CMP_ALL_OPS,
      allowRecursion: false,
    },
    slotCap: { maxTotal: 15, perScope: { MAIN: 15 } },
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeScaffoldFromReference(CMP_A_REF, { MAIN: [2, 4] }, 'cmpA_scaf'),
    },
    referenceSolution: CMP_A_REF,
    antiBypassRules: [
      {
        id: 'cmpA_starter_fails',
        description: 'Starter fails to scrap > 20 kg intact crates and ignores Dock A quota.',
        unmodifiedStarterMustFail: true,
      },
      {
        id: 'cmpA_min_edits',
        description: 'Requires adding OR > 20 scrap guard and ELSE_IF quota branch.',
        minStarterEditDistance: 3,
      },
    ],
  },

  // 14. cmp.B — Parity & Threshold Maintenance (Capstone Puzzle · Robot Grid)
  {
    id: 'cmp.B',
    moduleId: 'cmp',
    version: 1,
    format: 'capstone',
    capstoneType: 'puzzle',
    simId: 'grid',
    icon: '⚡',
    title: 'Parity & Threshold Maintenance',
    concept:
      'Composing saved threshold checks (t >= k) with step-counter parity (r = s % 2) to dispatch F1 (Left bay) vs F2 (Right bay)',
    description:
      'Save threshold k = $tileDial at start. At each junction s = 1..N, read t = $tileDial: whenever t >= k, use r = s % 2 to call F1 on odd junctions (Left bay) or F2 on even junctions (Right bay)!',
    hint: 'Increment s = s + 1 at every junction even when t < k! When t >= k, compute r = s % 2 -> IF (r == 1) CALL_F1 ELSE CALL_F2.',
    grid: CMP_B_VARIANTS[0],
    gridVariants: CMP_B_VARIANTS,
    starterWorkspace: CMP_B_STARTER,
    palette: {
      allowedSimBlocks: ['MOVE_FWD', 'TURN_LEFT', 'TURN_RIGHT', 'PICK_UP', 'USE_DROP'],
      allowedControlBlocks: [
        'WHILE',
        'END_WHILE',
        'IF',
        'ELSE',
        'END_IF',
        'CALL_F1',
        'CALL_F2',
        'VAR_ASSIGN',
        'VAR_OP',
      ],
      allowedScopes: ['MAIN', 'F1', 'F2'],
      allowRepeatBadges: false,
      allowVariables: true,
      allowedVariableNames: varNames('k', 's', 't', 'r'),
      allowedVarOps: ['+', '-', '%'],
      allowedCmpOps: CMP_ALL_OPS,
      allowedValueSensors: ['$tileDial', '$x', '$y'],
      allowedSensors: ['pathAhead', 'atGoal', 'itemHere', 'carryingItem'],
      allowedCombinators: ['NOT', 'AND', 'OR'],
      allowRecursion: false,
    },
    slotCap: { maxTotal: 38, perScope: { MAIN: 18, F1: 10, F2: 10 } },
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeScaffoldFromReference(
        CMP_B_REF,
        { MAIN: [7, 9, 11] },
        'cmpB_scaf'
      ),
    },
    referenceSolution: CMP_B_REF,
    antiBypassRules: [
      {
        id: 'cmpB_starter_fails',
        description: 'Starter walks straight to the end without servicing >= k junctions.',
        unmodifiedStarterMustFail: true,
      },
      {
        id: 'cmpB_requires_variables',
        description: 'Open twin alcoves on every junction + randomized k and dial values require saved threshold k and parity counter s % 2.',
        allowVariables: false,
      },
    ],
  },

  // 15. cmp.C — Parametric Spirograph & Galaxy (Capstone Creative · Turtle LOGO)
  {
    id: 'cmp.C',
    moduleId: 'cmp',
    version: 1,
    format: 'capstone',
    capstoneType: 'creative',
    simId: 'turtle',
    icon: '🌌',
    title: 'Parametric Spirograph & Galaxy',
    concept:
      'Subroutine composition (F1) with decimal division angles (360 / n, 720 / n), growing spirals, and % 2 color alternation at >= 240 px scale',
    description:
      'Tweak n, k, and d to remix the Crystal Flower spirograph, or explore Golden-Angle Sunflowers, 6-Spoke Spiderwebs, Optical Vortices, and Concentric Star Mandalas!',
    hint: 'Keep n and k above 0 when dividing 360 / n, and try odd values like 5, 7, or 9 with 720 / n for crisp star mandalas!',
    turtle: { mode: 'static' },
    starterWorkspace: CMP_C_STARTER,
    variations: CMP_C_VARIATIONS,
    palette: {
      allowedSimBlocks: CMP_TURTLE_SANDBOX_BLOCKS,
      allowedControlBlocks: [
        'LOOP_START',
        'LOOP_END',
        'CALL_F1',
        'CALL_F2',
        'IF',
        'ELSE',
        'END_IF',
        'VAR_ASSIGN',
        'VAR_OP',
      ],
      allowedScopes: ['MAIN', 'F1', 'F2'],
      allowRepeatBadges: true,
      allowActionParams: true,
      allowVariables: true,
      allowedVariableNames: varNames('n', 'k', 'd', 'a', 'b', 'i', 'r', 'l', 't', 'y', 'h'),
      allowedVarOps: ['+', '-', '*', '/', '%'],
      allowedCmpOps: CMP_ALL_OPS,
      allowRecursion: false,
    },
    slotCap: { maxTotal: 50, perScope: { MAIN: 25, F1: 25, F2: 25 } },
  },

  // 16. cmp.M1 — Max-Vault Hunter (Mastery Challenge · Robot Grid)
  {
    id: 'cmp.M1',
    moduleId: 'cmp',
    version: 1,
    format: 'challenge',
    simId: 'grid',
    icon: '🔥',
    title: 'Max-Vault Hunter',
    concept:
      'Scanning a variable-length corridor for the maximum $tileDial value m (d > m), then driving Loop [m] single-cell F1 shuttles',
    description:
      'Walk East until the end of the vault while tracking the largest $tileDial in m. Turn North at the shaft, shuttle exactly m single power cells from (D, 0) onto the Charge Pad at (D, 2), and walk South to the Goal flag!',
    hint: 'Track m = 0 before WHILE (pathAhead), update IF (d > m) -> m = d on each step, then TURN_LEFT (North) and run LOOP [m] { CALL_F1 }!',
    grid: CMP_M1_VARIANTS[0],
    gridVariants: CMP_M1_VARIANTS,
    starterWorkspace: CMP_M1_STARTER,
    palette: {
      allowedSimBlocks: ['MOVE_FWD', 'TURN_LEFT', 'TURN_RIGHT', 'PICK_UP', 'USE_DROP'],
      allowedControlBlocks: [
        'LOOP_START',
        'LOOP_END',
        'WHILE',
        'END_WHILE',
        'IF',
        'ELSE',
        'END_IF',
        'CALL_F1',
        'VAR_ASSIGN',
        'VAR_OP',
      ],
      allowedScopes: ['MAIN', 'F1'],
      allowRepeatBadges: false,
      allowVariables: true,
      allowedVariableNames: varNames('m', 'd', 'c'),
      allowedVarOps: ['+', '-'],
      allowedCmpOps: CMP_ALL_OPS,
      allowedValueSensors: ['$tileDial', '$x', '$y'],
      allowedSensors: ['pathAhead', 'atGoal', 'itemHere', 'carryingItem'],
      allowedCombinators: ['NOT'],
      allowRecursion: false,
    },
    slotCap: { maxTotal: 50, perScope: { MAIN: 20, F1: 20 } },
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeScaffoldFromReference(
        CMP_M1_REF,
        { MAIN: [5, 10], F1: [1, 6] },
        'cmpM1_scaf'
      ),
    },
    referenceSolution: CMP_M1_REF,
    antiBypassRules: [
      {
        id: 'cmpM1_starter_fails',
        description: 'Empty 0-block mastery starter stays at (0, 1) and does not reach Goal.',
        unmodifiedStarterMustFail: true,
      },
      {
        id: 'cmpM1_requires_variables',
        description: 'Randomized hall lengths D in {4, 3, 5, 6} and max dial m in {5, 4, 6, 4} at first/middle/last positions require tracking max variable m.',
        allowVariables: false,
      },
    ],
  },

  // 17. cmp.M2 — Balanced Twin Scale (Mastery Challenge · Switchyard)
  {
    id: 'cmp.M2',
    moduleId: 'cmp',
    version: 1,
    format: 'challenge',
    simId: 'switchyard',
    icon: '⚖️',
    title: 'Balanced Twin Scale',
    concept:
      'Greedy load-balancing via running weight accumulators (l <= r) after scrapping damaged crates, defeating naive % 2 alternation',
    description:
      'Scrap damaged crates first, then track running scale weights l and r so every intact crate tips onto the lighter scale (l <= r) for an exact 0 kg balance!',
    hint: 'Initialize l = 0 and r = 0. Scrap itemDamaged crates, otherwise check IF (l <= r) to route Left and add $itemWeight to l (ELSE Right and add to r)!',
    switchyard: CMP_M2_VARIANTS[0],
    switchyardVariants: CMP_M2_VARIANTS,
    starterWorkspace: CMP_M2_STARTER,
    palette: {
      allowedSimBlocks: ['SWITCH_LEFT', 'SWITCH_RIGHT', 'SEND_NEXT', 'SCRAP_ITEM'],
      allowedControlBlocks: [
        'WHILE',
        'END_WHILE',
        'IF',
        'ELSE',
        'END_IF',
        'VAR_ASSIGN',
        'VAR_OP',
      ],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: false,
      allowVariables: true,
      allowedVariableNames: varNames('l', 'r', 'c'),
      allowedVarOps: ['+', '-', '%'],
      allowedCmpOps: CMP_ALL_OPS,
      allowedSensors: ['hasNextItem', 'itemDamaged'],
      allowedCombinators: ['NOT', 'AND', 'OR'],
      allowedValueSensors: ['$itemWeight'],
      allowRecursion: false,
    },
    slotCap: { maxTotal: 50, perScope: { MAIN: 20 } },
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeScaffoldFromReference(
        CMP_M2_REF,
        { MAIN: [4, 8, 11] },
        'cmpM2_scaf'
      ),
    },
    referenceSolution: CMP_M2_REF,
    antiBypassRules: [
      {
        id: 'cmpM2_starter_fails',
        description: 'Empty 0-block mastery starter leaves all crates unprocessed.',
        unmodifiedStarterMustFail: true,
      },
      {
        id: 'cmpM2_requires_variables',
        description: 'Asymmetric heavy anchor + multi-crate counterweight streams defeat % 2 and require running weight sums l and r.',
        allowVariables: false,
      },
    ],
  },

  // 18. cmp.M3 — Snake-Plow Sweeper (Mastery Challenge · Robot Grid)
  {
    id: 'cmp.M3',
    moduleId: 'cmp',
    version: 1,
    format: 'challenge',
    simId: 'grid',
    icon: '🐍',
    title: 'Snake-Plow Sweeper',
    concept:
      'Full-coverage N × M boustrophedon sweep driven by row-parity modulo (p = r % 2) and !atGoal corner termination without side-wall sensors',
    description:
      'Sweep every floor flag across open N × M warehouses without pathLeft or pathRight! Advance while pathAhead AND NOT atGoal, then use p = r % 2 to alternate Right and Left U-turns onto the next row.',
    hint: 'Sweep each row with WHILE (pathAhead AND NOT atGoal) MOVE_FWD. If NOT atGoal, check p = r % 2 == 0 for a Right U-turn (ELSE Left U-turn) and add r = r + 1!',
    grid: CMP_M3_VARIANTS[0],
    gridVariants: CMP_M3_VARIANTS,
    starterWorkspace: CMP_M3_STARTER,
    palette: {
      allowedSimBlocks: ['MOVE_FWD', 'TURN_LEFT', 'TURN_RIGHT'],
      allowedControlBlocks: [
        'WHILE',
        'END_WHILE',
        'IF',
        'ELSE',
        'END_IF',
        'VAR_ASSIGN',
        'VAR_OP',
      ],
      allowedScopes: ['MAIN'],
      allowRepeatBadges: false,
      allowVariables: true,
      allowedVariableNames: varNames('r', 'p'),
      allowedVarOps: ['+', '%'],
      allowedCmpOps: CMP_ALL_OPS,
      allowedSensors: ['pathAhead', 'atGoal'],
      allowedCombinators: ['NOT', 'AND', 'OR'],
      allowRecursion: false,
    },
    slotCap: { maxTotal: 50, perScope: { MAIN: 20 } },
    partialHelp: {
      mode: 'scaffold',
      scaffoldWorkspace: makeScaffoldFromReference(
        CMP_M3_REF,
        { MAIN: [6, 8, 16] },
        'cmpM3_scaf'
      ),
    },
    referenceSolution: CMP_M3_REF,
    antiBypassRules: [
      {
        id: 'cmpM3_starter_fails',
        description: 'Empty 0-block mastery starter collects 0 flags.',
        unmodifiedStarterMustFail: true,
      },
      {
        id: 'cmpM3_requires_variables',
        description: 'Open multi-row N × M grids without pathLeft/pathRight require row counter r and parity r % 2 to alternate U-turns.',
        allowVariables: false,
      },
    ],
  },
];
