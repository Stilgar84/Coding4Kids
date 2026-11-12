import React from 'react';
import { useAppStoreSelector } from '../store/useAppStore';
import { getSimEnvironment } from '../engine/simulation/registry';
import { ParamVisual } from './params/VisualParamBadges';
import { BinaryOp } from '../types';
import {
  computeStagedPalettePolicy,
  getAllowedParamDefs,
  resolveActiveCurriculumActivity,
} from '../utils/curriculumStagePolicy';

const COMMON_NUMBERS = [0, 1, 2, 3, 5, 10, 45, 90, 180];
const ALL_OPS: BinaryOp[] = ['+', '-', '*', '/', '%', '==', '!=', '<', '<=', '>', '>=', '&&', '||'];

export const BlockSubpalette: React.FC = React.memo(() => {
  const {
    appMode,
    activeActivityId,
    activeActivityVersion,
    activeSimId,
    activeScope,
    workspace,
    selectedBlockId,
    updateBlockParams,
    isSubpaletteCollapsed,
  } = useAppStoreSelector((s) => ({
    appMode: s.appMode,
    activeActivityId: s.activeActivityId,
    activeActivityVersion: s.activeActivityVersion,
    activeSimId: s.activeSimId,
    activeScope: s.activeScope,
    workspace: s.workspace,
    selectedBlockId: s.selectedBlockId,
    updateBlockParams: s.updateBlockParams,
    isSubpaletteCollapsed: s.isSubpaletteCollapsed,
  }));

  if (isSubpaletteCollapsed) {
    return null;
  }

  const blocks = workspace[activeScope] || [];
  const selectedBlock = selectedBlockId ? blocks.find((b) => b.id === selectedBlockId) : null;

  if (!selectedBlock) {
    return null;
  }

  const currentSimEnv = getSimEnvironment(activeSimId);
  const simPaletteItems = currentSimEnv?.paletteItems || [];
  const activeActivity = resolveActiveCurriculumActivity(
    appMode,
    activeActivityId,
    activeActivityVersion
  );
  const policy = computeStagedPalettePolicy(appMode, activeActivity, simPaletteItems);
  const targetVarNames = policy.subpaletteVariableNames;
  const operandVarNames =
    policy.isCurriculum && !policy.allowVariables ? [] : policy.subpaletteOperandVarNames;
  const simSensors =
    policy.isCurriculum && !policy.allowVariables ? [] : (currentSimEnv?.sensors || []);

  // Handle VAR_ASSIGN
  if (selectedBlock.type === 'VAR_ASSIGN') {
    if (
      policy.isCurriculum &&
      !policy.allowVariables &&
      !policy.allowedControlTypes.has('VAR_ASSIGN')
    ) {
      return null;
    }

    const currentA = selectedBlock.params?.a ?? 'a';
    const currentB = selectedBlock.params?.b ?? 1;

    return (
      <div
        data-testid="block-subpalette-var-assign"
        className="flex flex-col gap-2 max-h-[160px] md:max-h-[220px] overflow-y-auto bg-slate-950/70 border border-slate-800/80 rounded-xl mx-1 p-2 transition-all duration-200 shadow-inner animate-in fade-in slide-in-from-top-1"
      >
        {/* Variable A */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 px-1">
            <span>Target Variable (a)</span>
            <span className="text-amber-300 font-mono font-bold italic">{currentA}</span>
          </div>
          <div className="palette-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1 px-1">
            {targetVarNames.map((v) => (
              <button
                key={v}
                type="button"
                data-testid={`subpalette-assign-a-${v}`}
                onClick={() => updateBlockParams(activeScope, selectedBlock.id, { a: v })}
                className={`flex-shrink-0 flex items-center justify-center min-w-[28px] h-[30px] md:min-w-[34px] md:h-[34px] rounded-lg border text-xs font-mono italic font-bold transition-all active:scale-95 ${
                  currentA === v
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-2 ring-amber-400/40 shadow-sm'
                    : 'bg-slate-900/90 hover:bg-slate-800/90 border-slate-700/80 text-slate-300 hover:border-slate-500'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Operand B */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 px-1">
            <span>Value / Variable (b)</span>
            <span className="text-violet-300 font-mono font-bold">
              {typeof currentB === 'string' ? <span className="italic">{currentB}</span> : currentB}
            </span>
          </div>
          <div className="palette-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1 px-1">
            {operandVarNames.map((v) => (
              <button
                key={v}
                type="button"
                data-testid={`subpalette-assign-b-var-${v}`}
                onClick={() => updateBlockParams(activeScope, selectedBlock.id, { b: v })}
                className={`flex-shrink-0 flex items-center justify-center min-w-[28px] h-[30px] md:min-w-[34px] md:h-[34px] rounded-lg border text-xs font-mono italic font-bold transition-all active:scale-95 ${
                  currentB === v
                    ? 'bg-violet-500/20 border-violet-400 text-violet-200 ring-2 ring-violet-400/40 shadow-sm'
                    : 'bg-slate-900/90 hover:bg-slate-800/90 border-slate-700/80 text-violet-300 hover:border-slate-500'
                }`}
              >
                {v}
              </button>
            ))}
            {simSensors.map((s) => (
              <button
                key={s.id}
                type="button"
                data-testid={`subpalette-assign-b-sensor-${s.id}`}
                onClick={() => updateBlockParams(activeScope, selectedBlock.id, { b: s.id })}
                className={`flex-shrink-0 flex items-center justify-center px-1.5 h-[30px] md:h-[34px] rounded-lg border text-xs font-mono font-bold transition-all active:scale-95 ${
                  currentB === s.id
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 ring-2 ring-cyan-400/40 shadow-sm'
                    : 'bg-slate-900/90 hover:bg-slate-800/90 border-slate-700/80 text-cyan-300 hover:border-slate-500'
                }`}
              >
                {s.icon}
              </button>
            ))}
            {(operandVarNames.length > 0 || simSensors.length > 0) && (
              <div className="w-[1px] h-6 bg-slate-700/60 mx-0.5 flex-shrink-0" />
            )}
            {COMMON_NUMBERS.map((n) => (
              <button
                key={n}
                type="button"
                data-testid={`subpalette-assign-b-num-${n}`}
                onClick={() => updateBlockParams(activeScope, selectedBlock.id, { b: n })}
                className={`flex-shrink-0 flex items-center justify-center min-w-[28px] h-[30px] md:min-w-[34px] md:h-[34px] rounded-lg border text-xs font-mono font-bold transition-all active:scale-95 ${
                  currentB === n
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-2 ring-amber-400/40 shadow-sm'
                    : 'bg-slate-900/90 hover:bg-slate-800/90 border-slate-700/80 text-slate-200 hover:border-slate-500'
                }`}
              >
                {n}
              </button>
            ))}
            <input
              type="number"
              placeholder="#"
              aria-label="Numeric value for b"
              className="w-12 md:w-14 h-[30px] md:h-[34px] px-1 text-center bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono flex-shrink-0"
              value={typeof currentB === 'number' ? currentB : ''}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) updateBlockParams(activeScope, selectedBlock.id, { b: val });
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Handle VAR_OP
  if (selectedBlock.type === 'VAR_OP') {
    if (
      policy.isCurriculum &&
      !policy.allowVariables &&
      !policy.allowedControlTypes.has('VAR_OP')
    ) {
      return null;
    }

    const currentA = selectedBlock.params?.a ?? 'a';
    const currentB = selectedBlock.params?.b ?? 'a';
    const currentOp = (selectedBlock.params?.op ?? '+') as BinaryOp;
    const currentC = selectedBlock.params?.c ?? 1;

    return (
      <div
        data-testid="block-subpalette-var-op"
        className="flex flex-col gap-2 max-h-[160px] md:max-h-[220px] overflow-y-auto bg-slate-950/70 border border-slate-800/80 rounded-xl mx-1 p-2 transition-all duration-200 shadow-inner animate-in fade-in slide-in-from-top-1"
      >
        {/* Variable A */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 px-1">
            <span>Target Variable (a)</span>
            <span className="text-amber-300 font-mono font-bold italic">{currentA}</span>
          </div>
          <div className="palette-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1 px-1">
            {targetVarNames.map((v) => (
              <button
                key={v}
                type="button"
                data-testid={`subpalette-op-a-${v}`}
                onClick={() => updateBlockParams(activeScope, selectedBlock.id, { a: v })}
                className={`flex-shrink-0 flex items-center justify-center min-w-[28px] h-[30px] md:min-w-[34px] md:h-[34px] rounded-lg border text-xs font-mono italic font-bold transition-all active:scale-95 ${
                  currentA === v
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-2 ring-amber-400/40 shadow-sm'
                    : 'bg-slate-900/90 hover:bg-slate-800/90 border-slate-700/80 text-slate-300 hover:border-slate-500'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Operand B */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 px-1">
            <span>First Operand (b)</span>
            <span className="text-violet-300 font-mono font-bold">
              {typeof currentB === 'string' ? <span className="italic">{currentB}</span> : currentB}
            </span>
          </div>
          <div className="palette-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1 px-1">
            {operandVarNames.map((v) => (
              <button
                key={v}
                type="button"
                data-testid={`subpalette-op-b-var-${v}`}
                onClick={() => updateBlockParams(activeScope, selectedBlock.id, { b: v })}
                className={`flex-shrink-0 flex items-center justify-center min-w-[28px] h-[30px] md:min-w-[34px] md:h-[34px] rounded-lg border text-xs font-mono italic font-bold transition-all active:scale-95 ${
                  currentB === v
                    ? 'bg-violet-500/20 border-violet-400 text-violet-200 ring-2 ring-violet-400/40 shadow-sm'
                    : 'bg-slate-900/90 hover:bg-slate-800/90 border-slate-700/80 text-violet-300 hover:border-slate-500'
                }`}
              >
                {v}
              </button>
            ))}
            {simSensors.map((s) => (
              <button
                key={s.id}
                type="button"
                data-testid={`subpalette-assign-b-sensor-${s.id}`}
                onClick={() => updateBlockParams(activeScope, selectedBlock.id, { b: s.id })}
                className={`flex-shrink-0 flex items-center justify-center px-1.5 h-[30px] md:h-[34px] rounded-lg border text-xs font-mono font-bold transition-all active:scale-95 ${
                  currentB === s.id
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 ring-2 ring-cyan-400/40 shadow-sm'
                    : 'bg-slate-900/90 hover:bg-slate-800/90 border-slate-700/80 text-cyan-300 hover:border-slate-500'
                }`}
              >
                {s.icon}
              </button>
            ))}
            {(operandVarNames.length > 0 || simSensors.length > 0) && (
              <div className="w-[1px] h-6 bg-slate-700/60 mx-0.5 flex-shrink-0" />
            )}
            {COMMON_NUMBERS.map((n) => (
              <button
                key={n}
                type="button"
                data-testid={`subpalette-op-b-num-${n}`}
                onClick={() => updateBlockParams(activeScope, selectedBlock.id, { b: n })}
                className={`flex-shrink-0 flex items-center justify-center min-w-[28px] h-[30px] md:min-w-[34px] md:h-[34px] rounded-lg border text-xs font-mono font-bold transition-all active:scale-95 ${
                  currentB === n
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-2 ring-amber-400/40 shadow-sm'
                    : 'bg-slate-900/90 hover:bg-slate-800/90 border-slate-700/80 text-slate-200 hover:border-slate-500'
                }`}
              >
                {n}
              </button>
            ))}
            <input
              type="number"
              placeholder="#"
              aria-label="Numeric value for b"
              className="w-12 md:w-14 h-[30px] md:h-[34px] px-1 text-center bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono flex-shrink-0"
              value={typeof currentB === 'number' ? currentB : ''}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) updateBlockParams(activeScope, selectedBlock.id, { b: val });
              }}
            />
          </div>
        </div>

        {/* Operator */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 px-1">
            <span>Operator</span>
            <span className="text-amber-400 font-mono font-bold text-sm">{currentOp}</span>
          </div>
          <div className="palette-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1 px-1">
            {ALL_OPS.map((op) => (
              <button
                key={op}
                type="button"
                data-testid={`subpalette-op-choice-${op}`}
                onClick={() => updateBlockParams(activeScope, selectedBlock.id, { op })}
                className={`flex-shrink-0 flex items-center justify-center min-w-[30px] h-[30px] md:min-w-[36px] md:h-[34px] rounded-lg border text-xs font-mono font-bold transition-all active:scale-95 ${
                  currentOp === op
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-2 ring-amber-400/40 shadow-sm'
                    : 'bg-slate-900/90 hover:bg-slate-800/90 border-slate-700/80 text-slate-300 hover:border-slate-500'
                }`}
              >
                {op}
              </button>
            ))}
          </div>
        </div>

        {/* Operand C */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 px-1">
            <span>Second Operand (c)</span>
            <span className="text-violet-300 font-mono font-bold">
              {typeof currentC === 'string' ? <span className="italic">{currentC}</span> : currentC}
            </span>
          </div>
          <div className="palette-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1 px-1">
            {operandVarNames.map((v) => (
              <button
                key={v}
                type="button"
                data-testid={`subpalette-op-c-var-${v}`}
                onClick={() => updateBlockParams(activeScope, selectedBlock.id, { c: v })}
                className={`flex-shrink-0 flex items-center justify-center min-w-[28px] h-[30px] md:min-w-[34px] md:h-[34px] rounded-lg border text-xs font-mono italic font-bold transition-all active:scale-95 ${
                  currentC === v
                    ? 'bg-violet-500/20 border-violet-400 text-violet-200 ring-2 ring-violet-400/40 shadow-sm'
                    : 'bg-slate-900/90 hover:bg-slate-800/90 border-slate-700/80 text-violet-300 hover:border-slate-500'
                }`}
              >
                {v}
              </button>
            ))}
            {simSensors.map((s) => (
              <button
                key={s.id}
                type="button"
                data-testid={`subpalette-op-c-sensor-${s.id}`}
                onClick={() => updateBlockParams(activeScope, selectedBlock.id, { c: s.id })}
                className={`flex-shrink-0 flex items-center justify-center px-1.5 h-[30px] md:h-[34px] rounded-lg border text-xs font-mono font-bold transition-all active:scale-95 ${
                  currentC === s.id
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 ring-2 ring-cyan-400/40 shadow-sm'
                    : 'bg-slate-900/90 hover:bg-slate-800/90 border-slate-700/80 text-cyan-300 hover:border-slate-500'
                }`}
              >
                {s.icon}
              </button>
            ))}
            {(operandVarNames.length > 0 || simSensors.length > 0) && (
              <div className="w-[1px] h-6 bg-slate-700/60 mx-0.5 flex-shrink-0" />
            )}
            {COMMON_NUMBERS.map((n) => (
              <button
                key={n}
                type="button"
                data-testid={`subpalette-op-c-num-${n}`}
                onClick={() => updateBlockParams(activeScope, selectedBlock.id, { c: n })}
                className={`flex-shrink-0 flex items-center justify-center min-w-[28px] h-[30px] md:min-w-[34px] md:h-[34px] rounded-lg border text-xs font-mono font-bold transition-all active:scale-95 ${
                  currentC === n
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-2 ring-amber-400/40 shadow-sm'
                    : 'bg-slate-900/90 hover:bg-slate-800/90 border-slate-700/80 text-slate-200 hover:border-slate-500'
                }`}
              >
                {n}
              </button>
            ))}
            <input
              type="number"
              placeholder="#"
              aria-label="Numeric value for c"
              className="w-12 md:w-14 h-[30px] md:h-[34px] px-1 text-center bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono flex-shrink-0"
              value={typeof currentC === 'number' ? currentC : ''}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) updateBlockParams(activeScope, selectedBlock.id, { c: val });
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  const paletteItem = simPaletteItems.find((p) => p.actionType === selectedBlock.type);
  const paramDefs = getAllowedParamDefs(
    selectedBlock.type,
    paletteItem?.paramDefs,
    appMode,
    policy.palette
  );

  if (paramDefs.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="block-subpalette"
      className="flex flex-col gap-2 max-h-[160px] md:max-h-[220px] overflow-y-auto bg-slate-950/70 border border-slate-800/80 rounded-xl mx-1 p-2 transition-all duration-200 shadow-inner animate-in fade-in slide-in-from-top-1"
    >
      {paramDefs.map((paramDef) => {
        const currentValue =
          selectedBlock.params?.[paramDef.id] !== undefined
            ? selectedBlock.params[paramDef.id]
            : (paramDef.id === 'length' && selectedBlock.params?.distance !== undefined
                ? selectedBlock.params.distance
                : paramDef.defaultValue);

        return (
          <div key={paramDef.id} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 px-1">
              <span>{paramDef.label}</span>
              <span className="text-amber-300 font-mono font-bold">
                {currentValue}
                {paramDef.unit || ''}
              </span>
            </div>

            <div className="palette-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1 px-1">
              {paramDef.options.map((opt) => {
                const isSelected = opt.value === currentValue;
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    data-testid={`subpalette-param-${paramDef.id}-${opt.value}`}
                    onClick={() =>
                      updateBlockParams(activeScope, selectedBlock.id, {
                        [paramDef.id]: opt.value,
                      })
                    }
                    className={`flex-shrink-0 flex flex-col items-center justify-center p-1 md:p-1.5 min-w-[34px] h-[38px] md:min-w-[42px] md:h-[46px] rounded-lg md:rounded-xl border text-xs font-semibold transition-all active:scale-95 touch-none ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-2 ring-amber-400/40 shadow-sm'
                        : 'bg-slate-900/90 hover:bg-slate-800/90 border-slate-700/80 text-slate-300 hover:border-slate-500'
                    }`}
                    title={`${paramDef.label}: ${opt.label || opt.value}`}
                  >
                    <ParamVisual
                      paramDef={paramDef}
                      value={opt.value}
                      compact={true}
                      actionType={selectedBlock.type}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
});
