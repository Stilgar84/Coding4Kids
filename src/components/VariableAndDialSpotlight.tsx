import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { GridState, isTypedValue, VariableRuntimeValue } from '../types';
import { TurtleState } from '../simulations/turtle/types';
import { DemoSpotlightType } from '../data/curriculum/types';
import { isLowQualityActive, useAppStoreSelector } from '../store/useAppStore';
import { TileDialGlyphSvg } from './params/VisualParamBadges';

function toNumericDisplay(v: VariableRuntimeValue | undefined, fallback: number): number | string {
  if (v === undefined) return fallback;
  if (isTypedValue(v)) {
    return typeof v.value === 'number' ? v.value : String(v.value);
  }
  return v;
}

export interface VariableAndDialSpotlightProps {
  spotlights?: DemoSpotlightType[];
  variables?: Record<string, VariableRuntimeValue> | null;
  turtleState?: TurtleState | null;
  grid?: GridState | null;
}

/**
 * Dial-Read Spotlight (`dial-read`):
 * Animates the integer on floor dial `$tileDial` lifting off the floor tile
 * into watch box `[📦 a ●]`.
 */
export const DialReadSpotlight: React.FC<{
  variables?: Record<string, VariableRuntimeValue> | null;
  grid?: GridState | null;
  isLowQuality?: boolean;
}> = ({ variables, grid, isLowQuality }) => {
  // Find current floor dial value at robot coordinate or first dial tile
  let dialValue = 3;
  if (grid) {
    const robotX = grid.robot?.x;
    const robotY = grid.robot?.y;
    const dialsList = (grid as any).dialTiles ?? (grid as any).dials ?? [];
    const tileAtRobot = dialsList.find(
      (d: any) => d.x === robotX && d.y === robotY
    );
    if (tileAtRobot && typeof tileAtRobot.value === 'number') {
      dialValue = tileAtRobot.value;
    } else if (dialsList.length > 0) {
      dialValue = dialsList[0].value;
    }
  }

  const varVal = toNumericDisplay(variables?.a, dialValue);
  const prevValRef = useRef<number | string>(varVal);
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    if (prevValRef.current !== varVal) {
      prevValRef.current = varVal;
      if (!isLowQuality) {
        setPulsing(true);
        const t = setTimeout(() => setPulsing(false), 400);
        return () => clearTimeout(t);
      }
    }
  }, [varVal, isLowQuality]);

  return (
    <div
      data-testid="dial-read-spotlight"
      aria-label="Dial read: $tileDial value flows into Variable a"
      className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-800/90 rounded-xl border border-amber-500/30 select-none shrink-0"
    >
      {/* Source: Floor Dial Tile */}
      <span
        className="inline-flex items-center gap-1 px-1.5 h-6 rounded-md bg-amber-500/20 border border-amber-400/50 text-amber-200 text-[11px] font-black tracking-tight"
        title="Floor dial value ($tileDial)"
      >
        <TileDialGlyphSvg compact />
        <span className="font-mono">{dialValue}</span>
      </span>

      {/* Lift / Flow Arrow */}
      <ArrowRight
        aria-hidden="true"
        className="w-3.5 h-3.5 stroke-[2.5] text-amber-400 animate-pulse"
      />

      {/* Target: Watch Box [📦 a ●] */}
      <span
        className={`inline-flex items-center gap-1 px-1.5 h-6 rounded-md border font-mono font-black text-[11px] transition-all duration-200 ${
          pulsing
            ? 'bg-amber-400 text-slate-950 border-amber-200 scale-105 shadow-[0_0_8px_rgba(251,191,36,0.6)]'
            : 'bg-slate-900 border-slate-700 text-amber-300'
        }`}
        title={`Variable Watch Box: a = ${varVal}`}
      >
        <span aria-hidden="true">📦 a ●</span>
        <span>=</span>
        <span className="text-white font-extrabold">{varVal}</span>
      </span>
    </div>
  );
};

/**
 * Pose-Bookmark Spotlight (`pose-bookmark`):
 * Animates turtle coordinates `($x, $y)` saving into Watch Boxes
 * `[📦 a ●]` and `[📦 b ▲]`.
 */
export const PoseBookmarkSpotlight: React.FC<{
  variables?: Record<string, VariableRuntimeValue> | null;
  turtleState?: TurtleState | null;
  isLowQuality?: boolean;
}> = ({ variables, turtleState, isLowQuality }) => {
  const currentX = turtleState ? Math.round(turtleState.robot.x) : -75;
  const currentY = turtleState ? Math.round(turtleState.robot.y) : 0;

  const valA = toNumericDisplay(variables?.a, currentX);
  const valB = toNumericDisplay(variables?.b, currentY);

  const prevRef = useRef({ valA, valB });
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    if (prevRef.current.valA !== valA || prevRef.current.valB !== valB) {
      prevRef.current = { valA, valB };
      if (!isLowQuality) {
        setPulsing(true);
        const t = setTimeout(() => setPulsing(false), 400);
        return () => clearTimeout(t);
      }
    }
  }, [valA, valB, isLowQuality]);

  return (
    <div
      data-testid="pose-bookmark-spotlight"
      aria-label="Pose bookmark: Turtle position saved into Watch Boxes a and b"
      className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-800/90 rounded-xl border border-sky-500/30 select-none shrink-0"
    >
      {/* Source: Pose sensors ($x, $y) */}
      <span
        className="inline-flex items-center gap-1 px-1.5 h-6 rounded-md bg-sky-500/20 border border-sky-400/50 text-sky-200 text-[11px] font-black tracking-tight"
        title="Turtle Pose Sensors ($x, $y)"
      >
        <span aria-hidden="true">📍</span>
        <span className="font-mono">
          ({currentX}, {currentY})
        </span>
      </span>

      {/* Fly / Arrow */}
      <ArrowRight
        aria-hidden="true"
        className="w-3.5 h-3.5 stroke-[2.5] text-sky-400"
      />

      {/* Target: [📦 a ●] [📦 b ▲] */}
      <div className="flex items-center gap-1">
        <span
          className={`inline-flex items-center gap-0.5 px-1.5 h-6 rounded-md border font-mono font-black text-[11px] transition-all duration-200 ${
            pulsing
              ? 'bg-sky-400 text-slate-950 border-sky-200 shadow-[0_0_8px_rgba(56,189,248,0.6)]'
              : 'bg-slate-900 border-slate-700 text-sky-300'
          }`}
          title={`Watch Box a = ${valA}`}
        >
          <span aria-hidden="true">📦 a ●</span>
          <span>=</span>
          <span className="text-white font-extrabold">{valA}</span>
        </span>

        <span
          className={`inline-flex items-center gap-0.5 px-1.5 h-6 rounded-md border font-mono font-black text-[11px] transition-all duration-200 ${
            pulsing
              ? 'bg-indigo-400 text-slate-950 border-indigo-200 shadow-[0_0_8px_rgba(129,140,248,0.6)]'
              : 'bg-slate-900 border-slate-700 text-indigo-300'
          }`}
          title={`Watch Box b = ${valB}`}
        >
          <span aria-hidden="true">📦 b ▲</span>
          <span>=</span>
          <span className="text-white font-extrabold">{valB}</span>
        </span>
      </div>
    </div>
  );
};

/**
 * Variable-Watch Counter Spotlight (`variable-watch`):
 * Shows stepped counter progression: `1 → 2 → 3 → 4` on `a = a + 1`.
 */
export const VariableWatchSpotlight: React.FC<{
  variables?: Record<string, VariableRuntimeValue> | null;
  isLowQuality?: boolean;
}> = ({ variables, isLowQuality }) => {
  // If 's' is active (e.g. 6.0 Tab 1), show 's'; else show counter 'a'
  const isSActive = variables?.s !== undefined;
  const varName = isSActive ? 's' : 'a';
  const shape = isSActive ? '★' : '●';
  const currentVal = isSActive ? toNumericDisplay(variables?.s, 60) : toNumericDisplay(variables?.a, 1);

  const prevValRef = useRef<number | string>(currentVal);
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    if (prevValRef.current !== currentVal) {
      prevValRef.current = currentVal;
      if (!isLowQuality) {
        setPulsing(true);
        const t = setTimeout(() => setPulsing(false), 400);
        return () => clearTimeout(t);
      }
    }
  }, [currentVal, isLowQuality]);

  const steps = [1, 2, 3, 4];

  return (
    <div
      data-testid="variable-watch-spotlight"
      aria-label="Variable counter: variable increments step by step"
      className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-800/90 rounded-xl border border-emerald-500/30 select-none shrink-0"
    >
      {/* Variable Box badge */}
      <span
        className={`inline-flex items-center gap-1 px-1.5 h-6 rounded-md border font-mono font-black text-[11px] transition-all duration-200 ${
          pulsing
            ? 'bg-emerald-400 text-slate-950 border-emerald-200 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
            : 'bg-slate-900 border-slate-700 text-emerald-300'
        }`}
        title={`Variable ${varName} = ${currentVal}`}
      >
        <span aria-hidden="true">
          📦 {varName} {shape}
        </span>
        <span>=</span>
        <span className="text-white font-extrabold">{currentVal}</span>
      </span>

      {/* Stepped sequence chips (1 -> 2 -> 3 -> 4) for counters */}
      {!isSActive && (
        <div className="flex items-center gap-1 text-[10px] font-black">
          {steps.map((st, i) => {
            const numCurrentVal = Number(currentVal) || 0;
            const isMatch = Math.round(numCurrentVal) === st;
            const isPast = Math.round(numCurrentVal) > st;
            return (
              <React.Fragment key={st}>
                {i > 0 && (
                  <span
                    aria-hidden="true"
                    className={`text-[9px] ${
                      isPast || isMatch ? 'text-emerald-400' : 'text-slate-600'
                    }`}
                  >
                    ➔
                  </span>
                )}
                <span
                  data-testid={`counter-step-${st}`}
                  className={`inline-flex items-center justify-center w-5 h-5 rounded-md border font-mono transition-all duration-200 ${
                    isMatch
                      ? 'bg-emerald-500 border-emerald-300 text-slate-950 font-black shadow-[0_0_6px_rgba(16,185,129,0.7)] scale-110'
                      : isPast
                      ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300'
                      : 'bg-slate-900 border-slate-700 text-slate-500'
                  }`}
                >
                  {st}
                </span>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
};

/**
 * Composite Variable & Dial Spotlight container for Module 6.
 * Conditionally mounts whichever spotlights are declared for the active demo tab:
 * - 'dial-read'
 * - 'pose-bookmark'
 * - 'variable-watch'
 */
export const VariableAndDialSpotlight: React.FC<VariableAndDialSpotlightProps> = ({
  spotlights: spotlightsProp,
  variables: variablesProp,
  turtleState: turtleStateProp,
  grid: gridProp,
}) => {
  // Store reads fallback safely for production usage in ExplanationDemoBar
  const storeState = useAppStoreSelector((s) => ({
    runtimeVariables: s.runtime?.variables,
    turtleState: s.turtleState,
    grid: s.grid,
    performanceMode: s.performanceMode,
    isAutoLowQuality: s.isAutoLowQuality,
  }));

  const variables = variablesProp !== undefined ? variablesProp : storeState.runtimeVariables;
  const turtleState = turtleStateProp !== undefined ? turtleStateProp : storeState.turtleState;
  const grid = gridProp !== undefined ? gridProp : storeState.grid;
  const lowQuality = isLowQualityActive(storeState);

  const spotlights = spotlightsProp || [];
  const showDialRead = spotlights.includes('dial-read');
  const showPoseBookmark = spotlights.includes('pose-bookmark');
  const showVariableWatch = spotlights.includes('variable-watch');

  if (!showDialRead && !showPoseBookmark && !showVariableWatch) {
    return null;
  }

  return (
    <div
      data-testid="variable-and-dial-spotlight"
      className="flex items-center gap-1.5 shrink-0"
    >
      {showDialRead && (
        <DialReadSpotlight
          variables={variables}
          grid={grid}
          isLowQuality={lowQuality}
        />
      )}
      {showPoseBookmark && (
        <PoseBookmarkSpotlight
          variables={variables}
          turtleState={turtleState}
          isLowQuality={lowQuality}
        />
      )}
      {showVariableWatch && (
        <VariableWatchSpotlight
          variables={variables}
          isLowQuality={lowQuality}
        />
      )}
    </div>
  );
};
