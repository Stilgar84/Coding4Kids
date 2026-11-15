import React, { useEffect, useState } from 'react';
import type {
  ConditionCompareOp,
  ConditionExpr,
  ConditionKeyCode,
  ConditionSensorType,
  SceneInputConfig,
} from '../data/curriculum/types';
import { CodeBlock, isTypedValue, ScopeType } from '../types';
import { TURTLE_COLOR_PALETTE } from '../engine/serialization/types';
import {
  PALETTE_COLOR_NAMES,
  STATION_CODE_NAMES,
} from '../engine/serialization/conditionSerializer';
import {
  StagedPalettePolicy,
  normalizeColorLiteralParam,
  resolveDefaultConditionForContext,
} from '../utils/curriculumStagePolicy';
import { ConditionBadge } from './ConditionBadge';
import { SensorVisual, TileDialGlyphSvg } from './params/VisualParamBadges';

const ALL_CMP_OPS: readonly ConditionCompareOp[] = ['=', '!=', '<', '<=', '>', '>='];
const CMP_OP_GLYPHS: Record<ConditionCompareOp, string> = {
  '=': '=',
  '==': '=',
  '!=': '≠',
  '<': '<',
  '<=': '≤',
  '>': '>',
  '>=': '≥',
};
const KEY_HELD_CHOICES: ReadonlyArray<{ key: ConditionKeyCode; glyph: string }> = [
  { key: 'UP', glyph: '▲' },
  { key: 'DOWN', glyph: '▼' },
  { key: 'LEFT', glyph: '◀' },
  { key: 'RIGHT', glyph: '▶' },
  { key: 'A', glyph: '🅰️' },
  { key: 'B', glyph: '🅱️' },
];
const CMP_NUMBERS = [0, 1, 2, 3, 5, 10] as const;

export interface ConditionSubpaletteProps {
  block: CodeBlock;
  activeScope: ScopeType;
  activeSimId: string;
  policy: StagedPalettePolicy;
  inputConfig?: SceneInputConfig | null;
  updateBlockParams: (scope: ScopeType, blockId: string, params: Record<string, any>) => void;
}

const SENSOR_COLOR_SWATCH_MAP: ReadonlyArray<{ name: string; hex: string }> = PALETTE_COLOR_NAMES.map(
  (name, idx) => ({
    name,
    hex: TURTLE_COLOR_PALETTE[idx] ?? '#ef4444',
  })
);

const ITEM_ICON_CHOICES: ReadonlyArray<{ id: string; glyph: string }> = [
  { id: 'crate', glyph: '📦' },
  { id: 'battery', glyph: '🔋' },
  { id: 'gear', glyph: '⚙️' },
  { id: 'crystal', glyph: '💎' },
];

const DEPOT_STATION_CHOICES: ReadonlyArray<{ id: string; badge: string }> = [
  { id: 'CURRENT', badge: '📍' },
  { id: 'STACK_1', badge: 'S1' },
  { id: 'STACK_2', badge: 'S2' },
  { id: 'STACK_3', badge: 'S3' },
  { id: 'QUEUE', badge: 'Q' },
  { id: 'INPUT', badge: 'IN' },
  { id: 'PHYSICAL_TAPE', badge: '🎞️' },
];

const COLOR_SENSOR_SET = new Set(['tileColor', 'itemColor', 'heldColor', 'topColor']);

function getFallbackSensorsForSim(
  simId: string,
  hasInputConfig: boolean
): string[] {
  let base: string[];
  switch (simId) {
    case 'switchyard':
      base = ['hasNextItem', 'itemDamaged', 'itemColor', 'itemIcon'];
      break;
    case 'depot':
      base = ['hasItem', 'heldColor', 'topColor', 'stationEmpty'];
      break;
    case 'turtle':
      base = ['insideCanvas'];
      break;
    case 'beat':
      base = ['cursorAtEdge'];
      break;
    case 'grid':
    default:
      base = [
        'pathAhead',
        'pathLeft',
        'pathRight',
        'itemHere',
        'carryingItem',
        'atGoal',
        'tileColor',
        'unvisitedAhead',
      ];
      break;
  }
  return hasInputConfig ? [...base, '$input'] : base;
}

function unwrapNot(expr: ConditionExpr): { negated: boolean; atom: ConditionExpr } {
  if (expr.kind === 'not') {
    return { negated: true, atom: expr.operand };
  }
  return { negated: false, atom: expr };
}

function wrapNot(atom: ConditionExpr, negated: boolean): ConditionExpr {
  if (!negated) return atom;
  return { kind: 'not', operand: atom };
}

function normalizeColorName(raw: unknown): string {
  const s = String(raw ?? 'red').trim().toLowerCase();
  const stripped = s.startsWith('color:') ? s.slice(6) : s;
  return stripped === 'yellow' ? 'amber' : stripped;
}

function getSwatchHex(colorNameOrVal: unknown): string {
  const norm = normalizeColorName(colorNameOrVal);
  const idx = PALETTE_COLOR_NAMES.indexOf(norm);
  return idx >= 0 ? TURTLE_COLOR_PALETTE[idx] : '#ef4444';
}

function makeDefaultExprForSensor(
  sensor: string,
  prevAtom: ConditionExpr | undefined,
  inputConfig?: SceneInputConfig | null,
  allowedDepotStations?: ReadonlySet<string>,
  allowedCmpOps?: readonly ConditionCompareOp[]
): ConditionExpr {
  if (sensor === 'cmp') {
    if (prevAtom?.kind === 'cmp' && prevAtom.left !== '$input') {
      return prevAtom;
    }
    return {
      kind: 'cmp',
      op: allowedCmpOps?.[0] ?? '=',
      left: 'a',
      right: 0,
    };
  }
  if (sensor === 'keyHeld') {
    if (prevAtom?.kind === 'keyHeld') {
      return prevAtom;
    }
    return { kind: 'keyHeld', key: 'UP' };
  }
  if (sensor === '$input') {
    const prevRight = prevAtom?.kind === 'cmp' && prevAtom.left === '$input' ? prevAtom.right : undefined;
    const prevOp =
      prevAtom?.kind === 'cmp' && (prevAtom.op === '=' || prevAtom.op === '!=')
        ? prevAtom.op
        : '=';
    const defaultOpt =
      inputConfig?.previewInput ??
      (inputConfig?.options && inputConfig.options.length > 0 ? inputConfig.options[0] : 1);
    const chosen = prevRight ?? defaultOpt;
    const chosenScalar = isTypedValue(chosen) ? chosen.value : chosen;
    return {
      kind: 'cmp',
      op: prevOp,
      left: '$input',
      right:
        inputConfig?.mode === 'color'
          ? normalizeColorLiteralParam(String(chosenScalar))
          : typeof chosenScalar === 'number'
          ? chosenScalar
          : Number(chosenScalar) || 1,
    };
  }
  if (COLOR_SENSOR_SET.has(sensor)) {
    const prevColor =
      prevAtom?.kind === 'sensor' && prevAtom.param
        ? normalizeColorName(prevAtom.param)
        : 'red';
    return { kind: 'sensor', sensor: sensor as ConditionSensorType, param: prevColor };
  }
  if (sensor === 'itemIcon') {
    const prevIcon =
      prevAtom?.kind === 'sensor' && prevAtom.sensor === 'itemIcon' && prevAtom.param
        ? prevAtom.param
        : 'crate';
    return { kind: 'sensor', sensor: 'itemIcon', param: prevIcon };
  }
  if (sensor === 'stationEmpty') {
    const fallbackStation =
      allowedDepotStations && allowedDepotStations.size > 0
        ? allowedDepotStations.has('QUEUE')
          ? 'QUEUE'
          : Array.from(allowedDepotStations)[0] ?? 'CURRENT'
        : 'QUEUE';
    const prevStation =
      prevAtom?.kind === 'sensor' && prevAtom.sensor === 'stationEmpty' && prevAtom.param
        ? prevAtom.param
        : undefined;
    const validPrev =
      prevStation &&
      (!allowedDepotStations ||
        allowedDepotStations.size === 0 ||
        prevStation === 'CURRENT' ||
        allowedDepotStations.has(prevStation))
        ? prevStation
        : undefined;
    return { kind: 'sensor', sensor: 'stationEmpty', param: validPrev ?? fallbackStation };
  }
  return { kind: 'sensor', sensor: sensor as ConditionSensorType };
}

export const ConditionSubpalette: React.FC<ConditionSubpaletteProps> = ({
  block,
  activeScope,
  activeSimId,
  policy,
  inputConfig,
  updateBlockParams,
}) => {
  const [activeSlot, setActiveSlot] = useState<'left' | 'right'>('left');

  useEffect(() => {
    setActiveSlot('left');
  }, [block.id]);

  const allowedDepotStations = policy.isCurriculum ? policy.allowedDepotStations : undefined;
  const fallbackExpr = resolveDefaultConditionForContext(
    activeSimId,
    policy.palette,
    inputConfig,
    allowedDepotStations
  );
  const currentCond: ConditionExpr =
    block.params?.condition && typeof block.params.condition === 'object'
      ? (block.params.condition as ConditionExpr)
      : fallbackExpr;

  const hasInputConfig = Boolean(inputConfig && inputConfig.options.length > 0);
  const rawAllowedSensors =
    policy.isCurriculum && policy.allowedSensors && policy.allowedSensors.length > 0
      ? policy.allowedSensors
      : getFallbackSensorsForSim(activeSimId, hasInputConfig);
  const effectiveSensorPool = [...rawAllowedSensors];
  if (
    (!policy.isCurriculum || (policy.allowedCmpOps && policy.allowedCmpOps.length > 0)) &&
    !effectiveSensorPool.includes('cmp')
  ) {
    effectiveSensorPool.push('cmp');
  }
  if (
    (!policy.isCurriculum || policy.allowInteractiveEvents) &&
    !effectiveSensorPool.includes('keyHeld')
  ) {
    effectiveSensorPool.push('keyHeld');
  }
  const allowedSensors = Array.from(new Set(effectiveSensorPool));
  const allowedCmpOps: readonly ConditionCompareOp[] =
    policy.allowedCmpOps && policy.allowedCmpOps.length > 0
      ? policy.allowedCmpOps
      : ALL_CMP_OPS;

  const allowedCombinators: ReadonlySet<'NOT' | 'AND' | 'OR'> = policy.isCurriculum
    ? new Set(policy.allowedCombinators ?? [])
    : new Set(['NOT', 'AND', 'OR']);

  const canNot = allowedCombinators.has('NOT');
  const canAnd = allowedCombinators.has('AND');
  const canOr = allowedCombinators.has('OR');

  const isBinaryCombinator = currentCond.kind === 'and' || currentCond.kind === 'or';
  const effectiveSlot: 'left' | 'right' = isBinaryCombinator ? activeSlot : 'left';
  const activeClauseRaw: ConditionExpr = isBinaryCombinator
    ? effectiveSlot === 'left'
      ? currentCond.left
      : currentCond.right
    : currentCond;
  const { negated: isActiveNegated, atom: activeAtom } = unwrapNot(activeClauseRaw);

  const commitCondition = (nextCond: ConditionExpr) => {
    updateBlockParams(activeScope, block.id, { condition: nextCond });
  };

  const commitActiveClause = (nextClause: ConditionExpr) => {
    if (isBinaryCombinator) {
      commitCondition(
        effectiveSlot === 'left'
          ? { ...currentCond, left: nextClause }
          : { ...currentCond, right: nextClause }
      );
    } else {
      commitCondition(nextClause);
    }
  };

  const handleToggleNot = () => {
    if (!canNot) return;
    commitActiveClause(wrapNot(activeAtom, !isActiveNegated));
  };

  const handleSelectJoinMode = (mode: 'single' | 'and' | 'or') => {
    if (mode === 'single') {
      if (isBinaryCombinator) {
        commitCondition(effectiveSlot === 'left' ? currentCond.left : currentCond.right);
        setActiveSlot('left');
      }
      return;
    }
    if (mode === 'and' && !canAnd) return;
    if (mode === 'or' && !canOr) return;

    if (isBinaryCombinator) {
      if (currentCond.kind === mode) {
        commitCondition(effectiveSlot === 'left' ? currentCond.left : currentCond.right);
        setActiveSlot('left');
      } else {
        commitCondition({ kind: mode, left: currentCond.left, right: currentCond.right });
      }
      return;
    }

    const secondSensor =
      allowedSensors.length > 1
        ? allowedSensors[1]
        : allowedSensors[0] ?? 'pathAhead';
    const secondClause = makeDefaultExprForSensor(
      secondSensor,
      undefined,
      inputConfig,
      allowedDepotStations,
      allowedCmpOps
    );
    commitCondition({ kind: mode, left: currentCond, right: secondClause });
  };

  const handleSelectSensor = (sensorId: string) => {
    const nextAtom = makeDefaultExprForSensor(
      sensorId,
      activeAtom,
      inputConfig,
      allowedDepotStations,
      allowedCmpOps
    );
    commitActiveClause(wrapNot(nextAtom, isActiveNegated));
  };

  const activeSensorId =
    activeAtom.kind === 'cmp'
      ? activeAtom.left === '$input'
        ? '$input'
        : 'cmp'
      : activeAtom.kind === 'keyHeld'
      ? 'keyHeld'
      : activeAtom.kind === 'sensor'
      ? activeAtom.sensor
      : null;

  const cmpVarChoices = policy.subpaletteOperandVarNames?.length
    ? policy.subpaletteOperandVarNames
    : ['a', 'b', 'c'];
  const cmpValueSensorChoices = policy.allowedValueSensors?.length
    ? policy.allowedValueSensors
    : activeSimId === 'depot'
    ? ['$heldValue', '$topValue', '$heldColor', '$topColor', '$stationLen']
    : activeSimId === 'switchyard'
    ? ['$itemWeight', '$itemColor', '$dockQuota[0]', '$dockCount[0]', '$dockQuota[1]', '$dockCount[1]']
    : activeSimId === 'beat'
    ? ['$cursorX', '$cursorY', '$beatIndex']
    : activeSimId === 'turtle'
    ? ['$x', '$y', '$heading']
    : ['$tileDial', '$randD6', '$randomColor'];

  const showCombinatorRow = canNot || canAnd || canOr;
  const inputOptions = inputConfig?.options?.length ? inputConfig.options : [1, 2, 3];
  const isColorInputMode = inputConfig?.mode === 'color';

  return (
    <div
      data-testid="condition-subpalette"
      className="flex flex-col gap-2 max-h-[180px] md:max-h-[230px] overflow-y-auto bg-slate-950/75 border border-cyan-800/60 rounded-xl mx-1 p-2 transition-all duration-200 shadow-inner"
    >
      {/* Active Condition Preview + Optional Combinator Controls */}
      <div className="flex items-center justify-between gap-2 flex-wrap px-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {isBinaryCombinator ? (
            <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-700/80 rounded-lg p-0.5">
              <button
                type="button"
                data-testid="cond-slot-left"
                onClick={() => setActiveSlot('left')}
                aria-pressed={effectiveSlot === 'left'}
                className={`inline-flex items-center justify-center min-w-[36px] min-h-[36px] md:min-w-[44px] md:min-h-[44px] px-2 py-1 rounded-lg text-xs transition-all ${
                  effectiveSlot === 'left'
                    ? 'bg-cyan-500/25 border border-cyan-400 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Edit first condition"
              >
                <ConditionBadge condition={currentCond.left} compact />
              </button>
              <span className="font-mono font-black text-amber-300 text-xs px-0.5">
                {currentCond.kind === 'and' ? '&' : '||'}
              </span>
              <button
                type="button"
                data-testid="cond-slot-right"
                onClick={() => setActiveSlot('right')}
                aria-pressed={effectiveSlot === 'right'}
                className={`inline-flex items-center justify-center min-w-[36px] min-h-[36px] md:min-w-[44px] md:min-h-[44px] px-2 py-1 rounded-lg text-xs transition-all ${
                  effectiveSlot === 'right'
                    ? 'bg-cyan-500/25 border border-cyan-400 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Edit second condition"
              >
                <ConditionBadge condition={currentCond.right} compact />
              </button>
            </div>
          ) : (
            <ConditionBadge condition={currentCond} />
          )}
        </div>

        {showCombinatorRow && (
          <div className="flex items-center gap-1" data-testid="cond-combinator-controls">
            {canNot && (
              <button
                type="button"
                data-testid="cond-toggle-not"
                aria-pressed={isActiveNegated}
                onClick={handleToggleNot}
                title="Toggle NOT (!)"
                aria-label="Toggle NOT (!)"
                className={`min-w-[36px] min-h-[36px] md:min-w-[44px] md:min-h-[44px] px-2 rounded-lg border text-xs font-mono font-black transition-all active:scale-95 ${
                  isActiveNegated
                    ? 'bg-rose-500/25 border-rose-400 text-rose-200 ring-2 ring-rose-400/40'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                !
              </button>
            )}
            {(canAnd || canOr) && isBinaryCombinator && (
              <button
                type="button"
                data-testid="cond-join-single"
                onClick={() => handleSelectJoinMode('single')}
                title="Use single condition"
                aria-label="Use single condition"
                className="min-w-[36px] min-h-[36px] md:min-w-[44px] md:min-h-[44px] px-2 rounded-lg border bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500 text-xs font-mono font-bold transition-all active:scale-95"
              >
                1
              </button>
            )}
            {canAnd && (
              <button
                type="button"
                data-testid="cond-join-and"
                aria-pressed={currentCond.kind === 'and'}
                onClick={() => handleSelectJoinMode('and')}
                title="Combine with AND (&)"
                aria-label="Combine with AND"
                className={`min-w-[36px] min-h-[36px] md:min-w-[44px] md:min-h-[44px] px-2 rounded-lg border text-xs font-mono font-black transition-all active:scale-95 ${
                  currentCond.kind === 'and'
                    ? 'bg-amber-500/25 border-amber-400 text-amber-200 ring-2 ring-amber-400/40'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                &amp;
              </button>
            )}
            {canOr && (
              <button
                type="button"
                data-testid="cond-join-or"
                aria-pressed={currentCond.kind === 'or'}
                onClick={() => handleSelectJoinMode('or')}
                title="Combine with OR (||)"
                aria-label="Combine with OR"
                className={`min-w-[36px] min-h-[36px] md:min-w-[44px] md:min-h-[44px] px-2 rounded-lg border text-xs font-mono font-black transition-all active:scale-95 ${
                  currentCond.kind === 'or'
                    ? 'bg-amber-500/25 border-amber-400 text-amber-200 ring-2 ring-amber-400/40'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                ||
              </button>
            )}
          </div>
        )}
      </div>

      {/* Sensor Picker Chips */}
      <div
        data-testid="cond-sensor-chips"
        className="palette-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5 px-0.5"
      >
        {allowedSensors.map((sensorId) => {
          const isSelected = activeSensorId === sensorId;
          const previewExpr = makeDefaultExprForSensor(
            sensorId,
            isSelected ? activeAtom : undefined,
            inputConfig,
            allowedDepotStations,
            allowedCmpOps
          );
          return (
            <button
              key={sensorId}
              type="button"
              data-testid={`cond-sensor-${sensorId}`}
              aria-pressed={isSelected}
              onClick={() => handleSelectSensor(sensorId)}
              title={sensorId}
              className={`flex-shrink-0 flex items-center justify-center min-w-[36px] min-h-[36px] md:min-w-[44px] md:min-h-[44px] px-2 rounded-lg border transition-all active:scale-95 ${
                isSelected
                  ? 'bg-cyan-500/25 border-cyan-400 ring-2 ring-cyan-400/40 shadow-sm'
                  : 'bg-slate-900/90 hover:bg-slate-800/90 border-slate-700/80 hover:border-slate-500'
              }`}
            >
              {sensorId === '$input' ? (
                <span className="text-sm leading-none" aria-hidden="true">
                  🎛️
                </span>
              ) : (
                <ConditionBadge condition={previewExpr} compact className="!border-0 !bg-transparent !p-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Zero-reading Color Swatch Picker (tileColor, itemColor, heldColor, topColor) */}
      {activeAtom.kind === 'sensor' && COLOR_SENSOR_SET.has(activeAtom.sensor) && (
        <div
          data-testid="cond-color-picker"
          className="palette-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5 px-0.5"
        >
          {SENSOR_COLOR_SWATCH_MAP.map(({ name, hex }) => {
            const isSelected = normalizeColorName(activeAtom.param) === name;
            return (
              <button
                key={name}
                type="button"
                data-testid={`cond-color-${name}`}
                aria-pressed={isSelected}
                aria-label={`Color ${name}`}
                title={name}
                onClick={() =>
                  commitActiveClause(
                    wrapNot({ kind: 'sensor', sensor: activeAtom.sensor, param: name }, isActiveNegated)
                  )
                }
                className={`flex-shrink-0 w-9 h-9 md:w-11 md:h-11 rounded-full border-2 transition-all active:scale-95 ${
                  isSelected
                    ? 'border-amber-300 ring-2 ring-amber-400/60 scale-110'
                    : 'border-slate-600 hover:border-white/70'
                }`}
                style={{ backgroundColor: hex }}
              />
            );
          })}
        </div>
      )}

      {/* Cargo Icon Picker (Switchyard itemIcon) */}
      {activeAtom.kind === 'sensor' && activeAtom.sensor === 'itemIcon' && (
        <div data-testid="cond-icon-picker" className="flex items-center gap-1.5 px-0.5">
          {ITEM_ICON_CHOICES.map(({ id, glyph }) => {
            const isSelected = (activeAtom.param ?? 'crate') === id;
            return (
              <button
                key={id}
                type="button"
                data-testid={`cond-icon-${id}`}
                aria-pressed={isSelected}
                aria-label={id}
                title={id}
                onClick={() =>
                  commitActiveClause(
                    wrapNot({ kind: 'sensor', sensor: 'itemIcon', param: id }, isActiveNegated)
                  )
                }
                className={`flex-shrink-0 flex items-center justify-center w-9 h-9 md:w-11 md:h-11 rounded-lg border text-base transition-all active:scale-95 ${
                  isSelected
                    ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/40'
                    : 'bg-slate-900 border-slate-700 hover:border-slate-500'
                }`}
              >
                <span aria-hidden="true">{glyph}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Station Empty Picker (Depot stationEmpty) */}
      {activeAtom.kind === 'sensor' && activeAtom.sensor === 'stationEmpty' && (
        <div
          data-testid="cond-station-picker"
          className="palette-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5 px-0.5"
        >
          {DEPOT_STATION_CHOICES.filter(({ id }) => {
            if (!STATION_CODE_NAMES.includes(id)) return false;
            if (
              policy.isCurriculum &&
              policy.allowedDepotStations &&
              policy.allowedDepotStations.size > 0
            ) {
              return id === 'CURRENT' || policy.allowedDepotStations.has(id);
            }
            return true;
          }).map(({ id, badge }) => {
              const isSelected = (activeAtom.param ?? 'CURRENT') === id;
              return (
                <button
                  key={id}
                  type="button"
                  data-testid={`cond-station-${id}`}
                  aria-pressed={isSelected}
                  aria-label={id}
                  title={id}
                  onClick={() =>
                    commitActiveClause(
                      wrapNot(
                        { kind: 'sensor', sensor: 'stationEmpty', param: id },
                        isActiveNegated
                      )
                    )
                  }
                  className={`flex-shrink-0 flex items-center justify-center min-w-[36px] min-h-[36px] md:min-w-[44px] md:min-h-[44px] px-2 rounded-lg border text-xs font-black font-mono transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-2 ring-amber-400/40'
                      : 'bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-500'
                  }`}
                >
                  {badge}
                </button>
              );
            }
          )}
        </div>
      )}

      {/* $input Comparison Op (= / !=) and Scene Option Chips */}
      {activeAtom.kind === 'cmp' && activeAtom.left === '$input' && (
        <div
          data-testid="cond-input-picker"
          className="palette-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5 px-0.5"
        >
          <button
            type="button"
            data-testid="cond-input-op-eq"
            aria-pressed={activeAtom.op === '='}
            onClick={() =>
              commitActiveClause(
                wrapNot({ ...activeAtom, op: '=' }, isActiveNegated)
              )
            }
            className={`flex-shrink-0 min-w-[36px] min-h-[36px] md:min-w-[44px] md:min-h-[44px] px-2 rounded-lg border font-mono font-black text-xs transition-all active:scale-95 ${
              activeAtom.op === '='
                ? 'bg-cyan-500/25 border-cyan-400 text-cyan-100 ring-2 ring-cyan-400/40'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
            }`}
            title="Equals (=)"
          >
            =
          </button>
          <button
            type="button"
            data-testid="cond-input-op-neq"
            aria-pressed={activeAtom.op === '!='}
            onClick={() =>
              commitActiveClause(
                wrapNot({ ...activeAtom, op: '!=' }, isActiveNegated)
              )
            }
            className={`flex-shrink-0 min-w-[36px] min-h-[36px] md:min-w-[44px] md:min-h-[44px] px-2 rounded-lg border font-mono font-black text-xs transition-all active:scale-95 ${
              activeAtom.op === '!='
                ? 'bg-rose-500/25 border-rose-400 text-rose-100 ring-2 ring-rose-400/40'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
            }`}
            title="Not equals (!=)"
          >
            !=
          </button>
          <div className="w-[1px] h-5 bg-slate-700/80 mx-0.5 flex-shrink-0" />
          {inputOptions.map((opt) => {
            if (isColorInputMode) {
              const normColor = normalizeColorName(opt);
              const targetVal = `color:${normColor}`;
              const isSelected = normalizeColorName(activeAtom.right) === normColor;
              return (
                <button
                  key={String(opt)}
                  type="button"
                  data-testid={`cond-input-opt-${normColor}`}
                  aria-pressed={isSelected}
                  aria-label={`Input color ${normColor}`}
                  title={normColor}
                  onClick={() =>
                    commitActiveClause(
                      wrapNot({ ...activeAtom, right: targetVal }, isActiveNegated)
                    )
                  }
                  className={`flex-shrink-0 w-9 h-9 md:w-11 md:h-11 rounded-full border-2 transition-all active:scale-95 ${
                    isSelected
                      ? 'border-amber-300 ring-2 ring-amber-400/60 scale-110'
                      : 'border-slate-600 hover:border-white/70'
                  }`}
                  style={{ backgroundColor: getSwatchHex(normColor) }}
                />
              );
            }
            const numVal = typeof opt === 'number' ? opt : Number(opt);
            const isSelected = activeAtom.right === numVal;
            return (
              <button
                key={String(opt)}
                type="button"
                data-testid={`cond-input-opt-${numVal}`}
                aria-pressed={isSelected}
                onClick={() =>
                  commitActiveClause(
                    wrapNot({ ...activeAtom, right: numVal }, isActiveNegated)
                  )
                }
                className={`flex-shrink-0 min-w-[36px] min-h-[36px] md:min-w-[44px] md:min-h-[44px] px-2.5 rounded-lg border font-mono font-black text-xs transition-all active:scale-95 ${
                  isSelected
                    ? 'bg-amber-500/25 border-amber-400 text-amber-200 ring-2 ring-amber-400/40'
                    : 'bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-500'
                }`}
              >
                {numVal}
              </button>
            );
          })}
        </div>
      )}

      {/* KeyHeld Picker (`UP/DOWN/LEFT/RIGHT/A/B`) */}
      {activeAtom.kind === 'keyHeld' && (
        <div
          data-testid="cond-keyheld-picker"
          className="palette-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5 px-0.5"
        >
          {KEY_HELD_CHOICES.map(({ key, glyph }) => {
            const isSelected = String(activeAtom.key).toUpperCase() === key;
            return (
              <button
                key={key}
                type="button"
                data-testid={`cond-keyheld-opt-${key}`}
                aria-pressed={isSelected}
                aria-label={`Key held ${key}`}
                onClick={() =>
                  commitActiveClause(wrapNot({ kind: 'keyHeld', key }, isActiveNegated))
                }
                className={`flex-shrink-0 min-w-[36px] min-h-[36px] md:min-w-[44px] md:min-h-[44px] px-2 rounded-lg border font-bold text-sm transition-all active:scale-95 ${
                  isSelected
                    ? 'bg-amber-500/25 border-amber-400 text-amber-100 ring-2 ring-amber-400/40'
                    : 'bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-500'
                }`}
              >
                {glyph}
              </button>
            );
          })}
        </div>
      )}

      {/* Typed Comparison Builder (`0x30 COND_TAG_CMP`: left op right) */}
      {activeAtom.kind === 'cmp' && activeAtom.left !== '$input' && (
        <div data-testid="cond-cmp-picker" className="flex flex-col gap-1.5 px-0.5">
          {/* Left operand row */}
          <div className="palette-scrollbar flex items-center gap-1 overflow-x-auto pb-0.5">
            {cmpVarChoices.map((v) => {
              const isSelected = activeAtom.left === v;
              return (
                <button
                  key={`l-var-${v}`}
                  type="button"
                  data-testid={`cond-cmp-left-var-${v}`}
                  aria-pressed={isSelected}
                  onClick={() =>
                    commitActiveClause(wrapNot({ ...activeAtom, left: v }, isActiveNegated))
                  }
                  className={`flex-shrink-0 min-w-[32px] h-[32px] px-2 rounded-lg border font-mono font-black italic text-xs transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-amber-500/25 border-amber-400 text-amber-200 ring-2 ring-amber-400/40'
                      : 'bg-slate-900 border-slate-700 text-amber-300/80 hover:border-slate-500'
                  }`}
                >
                  {v}
                </button>
              );
            })}
            {cmpValueSensorChoices.map((sId) => {
              const isSelected = activeAtom.left === sId;
              return (
                <button
                  key={`l-sen-${sId}`}
                  type="button"
                  data-testid={`cond-cmp-left-sensor-${sId}`}
                  aria-pressed={isSelected}
                  onClick={() =>
                    commitActiveClause(wrapNot({ ...activeAtom, left: sId }, isActiveNegated))
                  }
                  className={`flex-shrink-0 h-[32px] px-1.5 rounded-lg border inline-flex items-center justify-center transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-cyan-500/25 border-cyan-400 ring-2 ring-cyan-400/40'
                      : 'bg-slate-900 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {sId === '$tileDial' ? (
                    <TileDialGlyphSvg compact />
                  ) : (
                    <SensorVisual sensorId={sId} compact />
                  )}
                </button>
              );
            })}
          </div>

          {/* Operator row */}
          <div className="palette-scrollbar flex items-center gap-1 overflow-x-auto pb-0.5">
            {allowedCmpOps.map((op) => {
              const isSelected =
                activeAtom.op === op || (op === '=' && activeAtom.op === '==');
              return (
                <button
                  key={`cmp-op-${op}`}
                  type="button"
                  data-testid={`cond-cmp-op-${op}`}
                  aria-pressed={isSelected}
                  onClick={() =>
                    commitActiveClause(wrapNot({ ...activeAtom, op }, isActiveNegated))
                  }
                  className={`flex-shrink-0 min-w-[34px] h-[32px] px-2 rounded-lg border font-mono font-black text-xs transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-cyan-500/25 border-cyan-400 text-cyan-100 ring-2 ring-cyan-400/40'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {CMP_OP_GLYPHS[op]}
                </button>
              );
            })}
          </div>

          {/* Right operand row (numbers, vars, sensors, colors) */}
          <div className="palette-scrollbar flex items-center gap-1 overflow-x-auto pb-0.5">
            {CMP_NUMBERS.map((n) => {
              const isSelected = activeAtom.right === n;
              return (
                <button
                  key={`r-num-${n}`}
                  type="button"
                  data-testid={`cond-cmp-right-num-${n}`}
                  aria-pressed={isSelected}
                  onClick={() =>
                    commitActiveClause(wrapNot({ ...activeAtom, right: n }, isActiveNegated))
                  }
                  className={`flex-shrink-0 min-w-[30px] h-[30px] px-1.5 rounded-lg border font-mono font-black text-xs transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-amber-500/25 border-amber-400 text-amber-200 ring-2 ring-amber-400/40'
                      : 'bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-500'
                  }`}
                >
                  {n}
                </button>
              );
            })}
            {cmpVarChoices.map((v) => {
              const isSelected = activeAtom.right === v;
              return (
                <button
                  key={`r-var-${v}`}
                  type="button"
                  data-testid={`cond-cmp-right-var-${v}`}
                  aria-pressed={isSelected}
                  onClick={() =>
                    commitActiveClause(wrapNot({ ...activeAtom, right: v }, isActiveNegated))
                  }
                  className={`flex-shrink-0 min-w-[30px] h-[30px] px-1.5 rounded-lg border font-mono font-black italic text-xs transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-amber-500/25 border-amber-400 text-amber-200 ring-2 ring-amber-400/40'
                      : 'bg-slate-900 border-slate-700 text-amber-300/80 hover:border-slate-500'
                  }`}
                >
                  {v}
                </button>
              );
            })}
            {cmpValueSensorChoices.map((sId) => {
              const isSelected = activeAtom.right === sId;
              return (
                <button
                  key={`r-sen-${sId}`}
                  type="button"
                  data-testid={`cond-cmp-right-sensor-${sId}`}
                  aria-pressed={isSelected}
                  onClick={() =>
                    commitActiveClause(wrapNot({ ...activeAtom, right: sId }, isActiveNegated))
                  }
                  className={`flex-shrink-0 h-[30px] px-1.5 rounded-lg border inline-flex items-center justify-center transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-cyan-500/25 border-cyan-400 ring-2 ring-cyan-400/40'
                      : 'bg-slate-900 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {sId === '$tileDial' ? (
                    <TileDialGlyphSvg compact />
                  ) : (
                    <SensorVisual sensorId={sId} compact />
                  )}
                </button>
              );
            })}
            {SENSOR_COLOR_SWATCH_MAP.map(({ name, hex }) => {
              const targetVal = `color:${name}`;
              const isSelected =
                isTypedValue(activeAtom.right)
                  ? activeAtom.right.type === 'color' && normalizeColorName(activeAtom.right.value) === name
                  : typeof activeAtom.right === 'string' &&
                    activeAtom.right.startsWith('color:') &&
                    normalizeColorName(activeAtom.right) === name;
              return (
                <button
                  key={`r-col-${name}`}
                  type="button"
                  data-testid={`cond-cmp-right-color-${name}`}
                  aria-pressed={isSelected}
                  aria-label={`Compare color ${name}`}
                  onClick={() =>
                    commitActiveClause(wrapNot({ ...activeAtom, right: targetVal }, isActiveNegated))
                  }
                  className={`flex-shrink-0 w-7 h-7 rounded-full border-2 transition-all active:scale-95 ${
                    isSelected
                      ? 'border-amber-300 ring-2 ring-amber-400/60 scale-110'
                      : 'border-slate-600 hover:border-white/70'
                  }`}
                  style={{ backgroundColor: hex }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
