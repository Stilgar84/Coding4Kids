import React, { useEffect, useState } from 'react';
import type {
  ConditionExpr,
  ConditionSensorType,
  SceneInputConfig,
} from '../data/curriculum/types';
import { CodeBlock, ScopeType } from '../types';
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
  inputConfig?: SceneInputConfig | null
): ConditionExpr {
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
    return {
      kind: 'cmp',
      op: prevOp,
      left: '$input',
      right:
        inputConfig?.mode === 'color'
          ? normalizeColorLiteralParam(chosen)
          : typeof chosen === 'number'
          ? chosen
          : Number(chosen) || 1,
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
    const prevStation =
      prevAtom?.kind === 'sensor' && prevAtom.sensor === 'stationEmpty' && prevAtom.param
        ? prevAtom.param
        : 'QUEUE';
    return { kind: 'sensor', sensor: 'stationEmpty', param: prevStation };
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

  const fallbackExpr = resolveDefaultConditionForContext(
    activeSimId,
    policy.palette,
    inputConfig
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
  const allowedSensors = Array.from(new Set(rawAllowedSensors));

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
    const secondClause = makeDefaultExprForSensor(secondSensor, undefined, inputConfig);
    commitCondition({ kind: mode, left: currentCond, right: secondClause });
  };

  const handleSelectSensor = (sensorId: string) => {
    const nextAtom = makeDefaultExprForSensor(sensorId, activeAtom, inputConfig);
    commitActiveClause(wrapNot(nextAtom, isActiveNegated));
  };

  const activeSensorId =
    activeAtom.kind === 'cmp' && activeAtom.left === '$input'
      ? '$input'
      : activeAtom.kind === 'sensor'
      ? activeAtom.sensor
      : null;

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
            inputConfig
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
          {DEPOT_STATION_CHOICES.filter(({ id }) => STATION_CODE_NAMES.includes(id)).map(
            ({ id, badge }) => {
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
    </div>
  );
};
