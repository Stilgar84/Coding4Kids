import React from 'react';
import { getActivityAtVersion, getActivityLatest, SceneInputConfig } from '../data/curriculum';
import { TURTLE_COLOR_PALETTE } from '../engine/serialization/types';
import { PALETTE_COLOR_NAMES } from '../engine/serialization/conditionSerializer';
import { useAppStoreSelector } from '../store/useAppStore';

function normalizeColorName(raw: unknown): string {
  const s = String(raw ?? 'red').trim().toLowerCase();
  const stripped = s.startsWith('color:') ? s.slice(6) : s;
  return stripped === 'yellow' ? 'amber' : stripped;
}

function resolveColorHex(raw: unknown): string {
  const norm = normalizeColorName(raw);
  const idx = PALETTE_COLOR_NAMES.indexOf(norm);
  return idx >= 0 ? TURTLE_COLOR_PALETTE[idx] : '#ef4444';
}

export interface SceneInputBarViewProps {
  inputConfig: SceneInputConfig;
  value: number | string | undefined;
  onChange: (value: number | string) => void;
  className?: string;
}

/**
 * Pure zero-reading Scene Input Selector strip (`🎛️` + `[1]..[N]` or color swatches).
 */
export const SceneInputBarView: React.FC<SceneInputBarViewProps> = ({
  inputConfig,
  value,
  onChange,
  className = '',
}) => {
  if (!inputConfig || !inputConfig.options || inputConfig.options.length === 0) {
    return null;
  }

  const effectiveVal =
    value !== undefined
      ? value
      : inputConfig.previewInput !== undefined
      ? inputConfig.previewInput
      : inputConfig.options[0];
  const isColorMode = inputConfig.mode === 'color';

  return (
    <div
      data-testid="scene-input-bar"
      role="group"
      aria-label="Scene input selector"
      className={`shrink-0 z-40 bg-slate-900/95 border-b border-slate-800 px-3 py-1.5 flex items-center justify-center gap-2 overflow-x-auto select-none ${className}`.trim()}
    >
      <span
        aria-hidden="true"
        title="Scene selector"
        className="text-base leading-none shrink-0"
      >
        🎛️
      </span>

      <div className="flex items-center gap-1.5">
        {inputConfig.options.map((opt) => {
          if (isColorMode) {
            const normOpt = normalizeColorName(opt);
            const normVal = normalizeColorName(effectiveVal);
            const isSelected = normOpt === normVal;
            const emitted = `color:${normOpt}`;
            return (
              <button
                key={String(opt)}
                type="button"
                data-testid={`scene-input-opt-${normOpt}`}
                data-selected={isSelected ? 'true' : 'false'}
                aria-pressed={isSelected}
                aria-label={`Scene ${normOpt}`}
                title={normOpt}
                onClick={() => onChange(emitted)}
                className={`w-9 h-9 md:w-11 md:h-11 rounded-full border-2 transition-all active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
                  isSelected
                    ? 'border-white ring-2 ring-amber-400 scale-110 shadow-md'
                    : 'border-slate-600 hover:border-slate-300 opacity-85 hover:opacity-100'
                }`}
                style={{ backgroundColor: resolveColorHex(normOpt) }}
              />
            );
          }

          const numOpt = typeof opt === 'number' ? opt : Number(opt);
          const isSelected = Number(effectiveVal) === numOpt;
          return (
            <button
              key={String(opt)}
              type="button"
              data-testid={`scene-input-opt-${numOpt}`}
              data-selected={isSelected ? 'true' : 'false'}
              aria-pressed={isSelected}
              aria-label={`Scene ${numOpt}`}
              onClick={() => onChange(numOpt)}
              className={`min-w-[36px] min-h-[36px] h-9 md:min-w-[44px] md:min-h-[44px] md:h-11 px-2.5 rounded-xl border-2 font-mono font-black text-xs md:text-sm transition-all active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
                isSelected
                  ? 'bg-amber-500 text-slate-950 border-amber-200 ring-2 ring-amber-400/50 shadow-md'
                  : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-600'
              }`}
            >
              {numOpt}
            </button>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Top-Dock connected SceneInputBar mounted above the simulation viewport so HUD
 * overlays (`top-3`) stay clear and `<header>` remains single-row.
 */
export const SceneInputBar: React.FC<{ className?: string }> = ({ className = '' }) => {
  const {
    appMode,
    activeActivityId,
    activeActivityVersion,
    activeDemoTabIndex,
    activeVariationInputConfig,
    sceneInput,
    setSceneInput,
  } = useAppStoreSelector((s) => ({
    appMode: s.appMode,
    activeActivityId: s.activeActivityId,
    activeActivityVersion: s.activeActivityVersion,
    activeDemoTabIndex: s.activeDemoTabIndex,
    activeVariationInputConfig: s.activeVariationInputConfig,
    sceneInput: s.sceneInput,
    setSceneInput: s.setSceneInput,
  }));

  if (appMode !== 'curriculum') {
    return null;
  }

  const activity =
    getActivityAtVersion(activeActivityId, activeActivityVersion) ??
    getActivityLatest(activeActivityId);
  if (!activity) {
    return null;
  }

  let effectiveInputConfig: SceneInputConfig | undefined =
    activeVariationInputConfig ?? undefined;
  if (!effectiveInputConfig && activity.format === 'explanation' && activity.demoTabs?.length) {
    const clampedIdx = Math.min(
      Math.max(0, activeDemoTabIndex),
      activity.demoTabs.length - 1
    );
    effectiveInputConfig = activity.demoTabs[clampedIdx]?.inputConfig;
  }
  if (!effectiveInputConfig) {
    effectiveInputConfig = activity.inputConfig;
  }

  if (!effectiveInputConfig || effectiveInputConfig.options.length === 0) {
    return null;
  }

  return (
    <SceneInputBarView
      inputConfig={effectiveInputConfig}
      value={sceneInput}
      onChange={setSceneInput}
      className={className}
    />
  );
};
