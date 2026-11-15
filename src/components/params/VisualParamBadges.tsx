import React from 'react';
import { ActionParamDef } from '../../engine/simulation/types';
import { BEAT_GRID_SIZE } from '../../simulations/beat/types';
import { getPresetDef } from '../../simulations/beat/presets';
import { isVariableName } from '../../types';

// ==========================================
// 1. Rotation Visual (Robot trajectory before and after turn)
// ==========================================
interface RotationVisualProps {
  angle: number;
  direction?: 'left' | 'right';
  size?: number;
  className?: string;
  showText?: boolean;
}

export const RotationVisual: React.FC<RotationVisualProps> = ({
  angle,
  direction = 'left',
  size = 28,
  className = '',
  showText = true,
}) => {
  const center = size / 2;
  const len = size * 0.38;
  const isRight = direction === 'right';
  // Turning left goes up (negative Y in SVG), turning right goes down (positive Y in SVG)
  const dirMult = isRight ? 1 : -1;

  // Normal angle: incoming line on left, then turns by angle
  const rad = (dirMult * angle * Math.PI) / 180;
  const xRay = center + len * Math.cos(rad);
  const yRay = center + len * Math.sin(rad);

  const isUturn = angle === 180;
  const uturnOffset = isRight ? 2.5 : -2.5;

  return (
    <div className={`flex flex-col items-center justify-center leading-none ${className}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        {isUturn ? (
          // 180° U-turn: incoming line before turn on left, U-turn loop, outgoing line after turn
          <>
            {/* White line before turn (incoming on the left) */}
            <line
              x1={center - len}
              y1={center - uturnOffset}
              x2={center}
              y2={center - uturnOffset}
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* U-turn curve around center */}
            <path
              d={`M ${center} ${center - uturnOffset} A ${Math.abs(uturnOffset)} ${Math.abs(uturnOffset)} 0 0 ${isRight ? 1 : 0} ${center} ${center + uturnOffset}`}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* Amber line after turn (heading back to the left) */}
            <line
              x1={center}
              y1={center + uturnOffset}
              x2={center - len}
              y2={center + uturnOffset}
              stroke="#f59e0b"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </>
        ) : (
          // Angles other than 180°: line before turn on left, vertex dot, line after turn
          <>
            {/* Line before turn: white line on the left entering center */}
            <line
              x1={center - len}
              y1={center}
              x2={center}
              y2={center}
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* Vertex point */}
            <circle cx={center} cy={center} r="2" fill="#fbbf24" />
            {/* Line after turn: amber line exiting center at the turn angle */}
            <line
              x1={center}
              y1={center}
              x2={xRay}
              y2={yRay}
              stroke="#f59e0b"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </>
        )}
      </svg>
      {showText && (
        <span className="text-[10px] font-black text-amber-200 mt-0.5 tracking-tighter">
          {angle}°
        </span>
      )}
    </div>
  );
};

// ==========================================
// 2. Arc Angle Visual (White line before arc, orange arc, no end line)
// ==========================================
interface ArcAngleVisualProps {
  angle: number;
  direction?: 'left' | 'right';
  size?: number;
  className?: string;
  showText?: boolean;
}

export const ArcAngleVisual: React.FC<ArcAngleVisualProps> = ({
  angle,
  direction = 'left',
  size = 28,
  className = '',
  showText = true,
}) => {
  const isRight = direction === 'right';
  const scale = size / 28;

  // Incoming white line on the left, then orange arc
  const Rarc = 6.5 * scale;
  const xStart = 14 * scale;
  const yStart = (isRight ? 8 : 20) * scale;
  const lineLen = 8.5 * scale;

  // Center of curvature circle
  const cx = xStart;
  const cy = isRight ? yStart + Rarc : yStart - Rarc;

  const isFullCircle = angle >= 360;
  const largeArcFlag = angle > 180 ? 1 : 0;
  const sweepFlag = isRight ? 1 : 0;

  // End point of arc
  const rad = (angle * Math.PI) / 180;
  const dx = Rarc * Math.sin(rad);
  const dy = Rarc * (1 - Math.cos(rad));
  const xEnd = xStart + dx;
  const yEnd = isRight ? yStart + dy : yStart - dy;

  return (
    <div className={`flex flex-col items-center justify-center leading-none ${className}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        {/* Previous robot path: small white line on the left */}
        <line
          x1={xStart - lineLen}
          y1={yStart}
          x2={xStart}
          y2={yStart}
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Junction dot */}
        <circle cx={xStart} cy={yStart} r="1.8" fill="#fbbf24" />

        {/* Arc in orange (no line for the end) */}
        {isFullCircle ? (
          <circle
            cx={cx}
            cy={cy}
            r={Rarc}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2.5"
          />
        ) : (
          <path
            d={`M ${xStart.toFixed(2)} ${yStart.toFixed(2)} A ${Rarc.toFixed(2)} ${Rarc.toFixed(2)} 0 ${largeArcFlag} ${sweepFlag} ${xEnd.toFixed(2)} ${yEnd.toFixed(2)}`}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        )}
      </svg>
      {showText && (
        <span className="text-[10px] font-black text-amber-200 mt-0.5 tracking-tighter">
          {angle}°
        </span>
      )}
    </div>
  );
};

// Backwards-compatible AngleVisual
export const AngleVisual: React.FC<RotationVisualProps> = (props) => {
  return <RotationVisual {...props} />;
};

// ==========================================
// 3. Radius Visual (Curvature based on fixed distance, smaller arc for higher radius)
// ==========================================
interface RadiusVisualProps {
  radius: number;
  direction?: 'left' | 'right';
  size?: number;
  className?: string;
  showText?: boolean;
}

export const RadiusVisual: React.FC<RadiusVisualProps> = ({
  radius,
  direction = 'left',
  size = 28,
  className = '',
  showText = true,
}) => {
  const isRight = direction === 'right';

  // Base geometry for curvature based on a fixed distance:
  // Fixed distance S along the curve. For smaller radius -> curves sharply (larger angular arc).
  // For higher radius -> curves gently (smaller angular arc).
  // Curvature calibrated so radius 50 matches the previous radius 25 arc (~84°),
  // and radius 25 curves even more deeply (~160°).
  const S = 21; // Fixed arc length
  const clampedRadius = Math.max(10, radius);
  const sweepAngleDeg = Math.min(160, 4200 / clampedRadius);
  const sweepRad = (sweepAngleDeg * Math.PI) / 180;

  const Rvis = S / sweepRad;
  const dx = Rvis * Math.sin(sweepRad);
  const dy = Rvis * (1 - Math.cos(sweepRad));

  const x0 = 5;
  const y0 = isRight ? 6 : 18;
  const xEnd = x0 + dx;
  const yEnd = isRight ? y0 + dy : y0 - dy;
  const sweepFlag = isRight ? 1 : 0;
  const largeArcFlag = sweepAngleDeg > 180 ? 1 : 0;

  return (
    <div className={`flex flex-col items-center justify-center leading-none ${className}`}>
      <svg width={size} height={size * 0.75} viewBox="0 0 32 24" className="overflow-visible">
        {/* Curved arc line */}
        <path
          d={`M ${x0} ${y0} A ${Rvis.toFixed(1)} ${Rvis.toFixed(1)} 0 ${largeArcFlag} ${sweepFlag} ${xEnd.toFixed(1)} ${yEnd.toFixed(1)}`}
          fill="none"
          stroke="#818cf8"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Origin dot */}
        <circle cx={x0} cy={y0} r="2" fill="#a5b4fc" />
      </svg>
      {showText && (
        <span className="text-[9px] font-black text-indigo-200 mt-0.5 tracking-tighter">
          {radius}
        </span>
      )}
    </div>
  );
};

// ==========================================
// 4. Color Visual (Clean Color Swatch)
// ==========================================
export function isBeatLedOffColor(color: unknown): boolean {
  if (typeof color !== 'string') return false;
  const normalized = color.trim().toLowerCase();
  return normalized === '#0f172a' || normalized === '#000000';
}

export function isBeatLedEraseOption(actionType: string | undefined, value: unknown): boolean {
  return actionType === 'SET_LED_COLOR' && isBeatLedOffColor(value);
}

/**
 * Crisp ⊘ Erase/Off SVG overlay rendered OUTSIDE `ColorVisual` for Beat `SET_LED_COLOR` on `#0f172a`/`#000000`.
 */
export const BeatLedOffEraseOverlay: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    aria-hidden="true"
    data-testid="beat-led-erase-overlay"
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    className="pointer-events-none absolute inset-0 m-auto text-slate-200 drop-shadow-[0_1px_1px_rgba(2,6,23,0.9)]"
  >
    <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.75" />
    <line x1="4.2" y1="11.8" x2="11.8" y2="4.2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);

interface ColorVisualProps {
  color: string;
  size?: number;
  className?: string;
  showEraserCue?: boolean;
}

export const ColorVisual: React.FC<ColorVisualProps> = ({
  color,
  size = 20,
  className = '',
  showEraserCue = false,
}) => {
  const effectiveColor = color || '#0f172a';
  const normalized = effectiveColor.toLowerCase();
  const isWhite = normalized === '#ffffff' || normalized === '#fff';
  const isBlack = normalized === '#0f172a' || normalized === '#000000';
  const borderClass = isWhite
    ? 'border-slate-500 ring-1 ring-slate-900/50'
    : isBlack
    ? 'border-slate-400/90 ring-1 ring-white/25'
    : 'border-white/90';

  return (
    <div
      data-testid="color-swatch-visual"
      className={`inline-flex items-center justify-center rounded-full border-2 shadow-sm transition-transform select-none ${
        showEraserCue && isWhite ? 'relative overflow-hidden' : ''
      } ${borderClass} ${className}`}
      style={{
        backgroundColor: effectiveColor,
        width: `${size}px`,
        height: `${size}px`,
      }}
      title={`Color: ${effectiveColor}`}
    >
      {showEraserCue && isWhite && (
        <svg
          aria-hidden="true"
          data-testid="turtle-white-eraser-cue"
          viewBox="0 0 16 16"
          fill="none"
          className="pointer-events-none absolute inset-0 w-full h-full"
        >
          <polygon points="9.5,16 16,9.5 16,16" fill="#fda4af" />
          <line x1="9" y1="16" x2="16" y2="9" stroke="#94a3b8" strokeWidth="1.2" />
        </svg>
      )}
    </div>
  );
};

// ==========================================
// 5. Pen Width Visual (Preview of stroke thickness)
// ==========================================
interface PenWidthVisualProps {
  width: number;
  boxWidth?: number;
  boxHeight?: number;
  className?: string;
  showText?: boolean;
}

export const PenWidthVisual: React.FC<PenWidthVisualProps> = ({
  width,
  boxWidth = 32,
  boxHeight = 22,
  className = '',
  showText = true,
}) => {
  const clampedStroke = Math.max(1, Math.min(width, boxHeight - 4));

  return (
    <div className={`flex flex-col items-center justify-center leading-none ${className}`}>
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{ width: `${boxWidth}px`, height: `${boxHeight}px` }}
      >
        <div
          className="w-full rounded-full bg-white shadow-sm"
          style={{ height: `${clampedStroke}px` }}
        />
      </div>
      {showText && (
        <span className="text-[9px] font-bold text-slate-200 tracking-tight mt-0.5">
          {width}px
        </span>
      )}
    </div>
  );
};

// ==========================================
// 6. Length Visual (Straight distance segment)
// ==========================================
interface LengthVisualProps {
  length: number;
  size?: number;
  className?: string;
  showText?: boolean;
}

export const LengthVisual: React.FC<LengthVisualProps> = ({
  length,
  size = 28,
  className = '',
  showText = true,
}) => {
  return (
    <div className={`flex flex-col items-center justify-center leading-none ${className}`}>
      <svg width={size} height={size * 0.75} viewBox="0 0 28 20" className="overflow-visible">
        {/* Dimension line with end ticks */}
        <line x1="4" y1="10" x2="24" y2="10" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="4" y1="6" x2="4" y2="14" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="24" y1="6" x2="24" y2="14" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      {showText && (
        <span className="text-[10px] font-black text-sky-200 mt-0.5 tracking-tighter">
          {length}px
        </span>
      )}
    </div>
  );
};

// ==========================================
// 6b. Pitch Scale Bar Visual (Ascending 1..8 Stepped Scale Bars)
// ==========================================
interface PitchVisualProps {
  pitch: number;
  compact?: boolean;
  className?: string;
  showText?: boolean;
}

export const PitchVisual: React.FC<PitchVisualProps> = ({
  pitch,
  compact = true,
  className = '',
  showText = true,
}) => {
  const clamped = Math.max(1, Math.min(8, Math.round(Number(pitch) || 1)));
  const svgWidth = compact ? 30 : 38;
  const svgHeight = compact ? 15 : 20;

  return (
    <div
      data-testid={`pitch-visual-${clamped}`}
      className={`flex flex-col items-center justify-center leading-none ${className}`}
    >
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox="0 0 32 18"
        className="overflow-visible"
        aria-hidden="true"
      >
        {Array.from({ length: 8 }, (_, idx) => {
          const step = idx + 1;
          const barHeight = 3.5 + idx * 1.8; // Ascending stepped heights 3.5..16.1
          const x = idx * 4 + 0.5;
          const y = 17 - barHeight;
          const isTarget = step === clamped;
          const isLit = step <= clamped;
          const fill = isTarget
            ? '#fbbf24'
            : isLit
            ? '#38bdf8'
            : 'rgba(148, 163, 184, 0.28)';
          return (
            <rect
              key={step}
              x={x.toFixed(1)}
              y={y.toFixed(1)}
              width="2.8"
              height={barHeight.toFixed(1)}
              rx="1"
              fill={fill}
            />
          );
        })}
      </svg>
      {showText && (
        <span className="text-[10px] font-black text-amber-200 mt-0.5 tracking-tighter">
          ♪{clamped}
        </span>
      )}
    </div>
  );
};

// ==========================================
// 6c. Beat Duration Visual (½ | 1 | 2 Beat Bar Width Badges)
// ==========================================
interface BeatDurationVisualProps {
  duration: number;
  compact?: boolean;
  className?: string;
  showText?: boolean;
}

export function formatBeatDurationLabel(duration: number): string {
  if (duration <= 0.5) return '½';
  if (duration >= 2) return '2';
  return '1';
}

export const BeatDurationVisual: React.FC<BeatDurationVisualProps> = ({
  duration,
  compact = true,
  className = '',
  showText = true,
}) => {
  const num = Number(duration) || 1;
  const normalized = num <= 0.5 ? 0.5 : num >= 2 ? 2 : 1;
  const label = formatBeatDurationLabel(normalized);
  // Fill fraction out of a 2-beat ruler: 0.5 -> 25%, 1 -> 50%, 2 -> 100%
  const fillFraction = normalized / 2;
  const trackW = compact ? 26 : 36;
  const fillW = Math.max(5, Math.round((trackW - 2) * fillFraction));

  return (
    <div
      data-testid={`duration-visual-${normalized}`}
      className={`flex flex-col items-center justify-center leading-none ${className}`}
    >
      <svg
        width={trackW}
        height={compact ? 12 : 16}
        viewBox={`0 0 ${trackW} 12`}
        aria-hidden="true"
      >
        {/* 2-beat ruler track */}
        <rect
          x="0.5"
          y="2"
          width={trackW - 1}
          height="8"
          rx="3"
          fill="rgba(15, 23, 42, 0.85)"
          stroke="rgba(148, 163, 184, 0.45)"
          strokeWidth="1"
        />
        {/* Mid-point 1-beat divider tick */}
        <line
          x1={trackW / 2}
          y1="2.5"
          x2={trackW / 2}
          y2="9.5"
          stroke="rgba(148, 163, 184, 0.45)"
          strokeWidth="1"
        />
        {/* Active duration bar */}
        <rect
          x="1"
          y="2.5"
          width={fillW}
          height="7"
          rx="2.5"
          fill={normalized === 0.5 ? '#38bdf8' : normalized === 1 ? '#34d399' : '#fbbf24'}
        />
      </svg>
      {showText && (
        <span className="text-[10px] font-black text-emerald-200 mt-0.5 tracking-tight">
          {label}
        </span>
      )}
    </div>
  );
};

// ==========================================
// 6d. Stamp Preset 8x8 Pixel Matrix Visual
// ==========================================
interface StampPresetVisualProps {
  preset: string;
  size?: number;
  className?: string;
}

export const StampPresetVisual: React.FC<StampPresetVisualProps> = ({
  preset,
  size = 24,
  className = '',
}) => {
  const def = getPresetDef(preset);

  return (
    <div
      data-testid={`stamp-preset-visual-${def.name}`}
      className={`inline-flex items-center justify-center rounded-md bg-slate-950/90 border border-slate-700/80 p-0.5 ${className}`}
      title={def.label}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        aria-hidden="true"
      >
        {def.pattern.map((rowStr, r) =>
          Array.from({ length: BEAT_GRID_SIZE }, (_, c) => {
            const lit = rowStr[c] === '#';
            return (
              <rect
                key={`${r}-${c}`}
                x={c * 2 + 0.2}
                y={r * 2 + 0.2}
                width="1.6"
                height="1.6"
                rx="0.35"
                fill={lit ? def.defaultColor : 'rgba(51, 65, 85, 0.35)'}
              />
            );
          })
        )}
      </svg>
    </div>
  );
};

// ==========================================
// 6e. LED Grid Coordinate Visual (Row y / Col x / Pixel x,y)
// ==========================================
interface GridCoordVisualProps {
  coord: number;
  variant?: 'row' | 'col' | 'pixelX' | 'pixelY';
  compact?: boolean;
  className?: string;
  showText?: boolean;
}

export const GridCoordVisual: React.FC<GridCoordVisualProps> = ({
  coord,
  variant = 'row',
  compact = true,
  className = '',
  showText = true,
}) => {
  const clamped = Math.max(1, Math.min(8, Math.round(Number(coord) || 1)));
  const idx = clamped - 1;
  const svgSize = compact ? 16 : 22;
  const isRowLike = variant === 'row' || variant === 'pixelY';

  return (
    <div
      data-testid={`grid-coord-visual-${variant}-${clamped}`}
      className={`flex flex-col items-center justify-center leading-none ${className}`}
    >
      <svg
        width={svgSize}
        height={svgSize}
        viewBox="0 0 18 18"
        aria-hidden="true"
      >
        <rect
          x="0.5"
          y="0.5"
          width="17"
          height="17"
          rx="2.5"
          fill="rgba(15, 23, 42, 0.9)"
          stroke="rgba(148, 163, 184, 0.4)"
          strokeWidth="1"
        />
        {Array.from({ length: 8 }, (_, lineIdx) => {
          const isLit = lineIdx === idx;
          if (isRowLike) {
            return (
              <rect
                key={lineIdx}
                x="2"
                y={1.8 + lineIdx * 1.85}
                width="14"
                height="1.35"
                rx="0.6"
                fill={isLit ? '#22d3ee' : 'rgba(71, 85, 105, 0.4)'}
              />
            );
          }
          return (
            <rect
              key={lineIdx}
              x={1.8 + lineIdx * 1.85}
              y="2"
              width="1.35"
              height="14"
              rx="0.6"
              fill={isLit ? '#22d3ee' : 'rgba(71, 85, 105, 0.4)'}
            />
          );
        })}
      </svg>
      {showText && (
        <span className="text-[10px] font-black text-cyan-200 mt-0.5 tracking-tighter">
          {clamped}
        </span>
      )}
    </div>
  );
};

// ==========================================
// 6f. Cursor Turn Direction Visual (Left 90° vs Right 90° L-Turn Arrow)
// ==========================================
interface CursorTurnVisualProps {
  turnDir: 'LEFT' | 'RIGHT' | string;
  compact?: boolean;
  className?: string;
}

export const CursorTurnVisual: React.FC<CursorTurnVisualProps> = ({
  turnDir,
  compact = true,
  className = '',
}) => {
  const normalized = String(turnDir || 'RIGHT').toUpperCase() === 'LEFT' ? 'LEFT' : 'RIGHT';
  const isLeft = normalized === 'LEFT';
  const size = compact ? 22 : 28;

  return (
    <div
      data-testid={`cursor-turn-visual-${normalized.toLowerCase()}`}
      className={`flex flex-col items-center justify-center leading-none ${className}`}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className="overflow-visible"
        aria-hidden="true"
      >
        {/* Incoming forward stem from bottom to center */}
        <line
          x1="12"
          y1="20"
          x2="12"
          y2="10"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        {/* Pivot dot */}
        <circle cx="12" cy="10" r="2.1" fill="#fbbf24" />
        {/* 90° turn ray + arrowhead */}
        {isLeft ? (
          <>
            <line
              x1="12"
              y1="10"
              x2="4.5"
              y2="10"
              stroke="#fbbf24"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
            <polyline
              points="8.5,6 4,10 8.5,14"
              stroke="#fbbf24"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : (
          <>
            <line
              x1="12"
              y1="10"
              x2="19.5"
              y2="10"
              stroke="#fbbf24"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
            <polyline
              points="15.5,6 20,10 15.5,14"
              stroke="#fbbf24"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}
      </svg>
      {!compact && (
        <span className="text-[9px] font-black text-amber-200 mt-0.5 tracking-tighter">
          90°
        </span>
      )}
    </div>
  );
};

// ==========================================
// 7. Generic Param Renderer
// ==========================================
interface ParamVisualProps {
  paramDef: ActionParamDef;
  value: any;
  compact?: boolean;
  actionType?: string;
}

/**
 * Canonical #301 unified circular rotary dial gauge icon for `$tileDial`.
 */
export const TileDialGlyphSvg: React.FC<{ compact?: boolean; className?: string }> = ({
  compact = true,
  className = '',
}) => (
  <svg
    data-testid="tile-dial-glyph"
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} shrink-0 text-cyan-200 ${className}`.trim()}
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="9" className="fill-cyan-950/80" />
    <path d="M7.5 16.5 A 6 6 0 1 1 16.5 16.5" strokeWidth="1.6" opacity="0.65" />
    <line x1="12" y1="12" x2="16.5" y2="7.5" stroke="#fbbf24" strokeWidth="2.4" />
    <circle cx="12" cy="12" r="1.8" fill="#fbbf24" stroke="none" />
  </svg>
);

const DOCK_CHIP_LABELS = ['A', 'B', 'C'] as const;

function parseIndexedSensorBadge(sensorId: string): React.ReactNode {
  if (sensorId === '$tileDial') {
    return <TileDialGlyphSvg compact />;
  }
  const simpleMap: Record<string, string> = {
    '$x': '📍X',
    '$y': '📍Y',
    '$heading': '🧭∠',
    '$input': '🎛️',
    '$randCoin': '🎲🪙',
    '$randD4': '🎲4',
    '$randD6': '🎲6',
    '$randD8': '🎲8',
    '$randD20': '🎲20',
    '$rand01': '🎲0..1',
    '$randomColor': '🎲🎨',
    '$pointerX': '👆X',
    '$pointerY': '👆Y',
    '$pointerDown': '👆⬇',
    '$heldValue': '📦#',
    '$heldColor': '📦🎨',
    '$topValue': '🏔️#',
    '$topColor': '🏔️🎨',
    '$stationLen': '📏',
    '$itemWeight': '⚖️',
    '$itemColor': '🚂🎨',
    '$dockQuota': '🎯[A]',
    '$dockCount': '📊[A]',
    '$cursorX': '🎵X',
    '$cursorY': '🎵Y',
    '$beatIndex': '🎵#',
  };
  if (simpleMap[sensorId]) {
    return simpleMap[sensorId];
  }
  const dockMatch = /^\$(dockQuota|dockCount)\[(\d+)\]$/.exec(sensorId);
  if (dockMatch) {
    const idx = Number(dockMatch[2]);
    const letter = DOCK_CHIP_LABELS[idx] ?? String(idx);
    return `${dockMatch[1] === 'dockQuota' ? '🎯' : '📊'}[${letter}]`;
  }
  const depotMatch = /^\$(topValue|topColor|stationLen)\[([^\]]+)\]$/.exec(sensorId);
  if (depotMatch) {
    const prefix =
      depotMatch[1] === 'topValue' ? '🏔️#' : depotMatch[1] === 'topColor' ? '🏔️🎨' : '📏';
    return `${prefix}[${depotMatch[2]}]`;
  }
  return sensorId;
}

export const SensorVisual: React.FC<{ sensorId: string; compact?: boolean }> = ({
  sensorId,
  compact = true,
}) => {
  return (
    <span
      data-testid={`sensor-badge-${sensorId}`}
      className={`font-mono font-black text-cyan-200 bg-cyan-950/90 rounded border border-cyan-400/70 shadow-sm inline-flex items-center justify-center gap-0.5 leading-none ${
        compact ? 'px-1.5 py-0.5 text-[11px] min-w-[24px] h-[22px]' : 'px-2 py-1 text-xs min-w-[32px] h-[28px]'
      }`}
    >
      {parseIndexedSensorBadge(sensorId)}
    </span>
  );
};

export const BeatDelayVisual: React.FC<{ multiplier: number; compact?: boolean }> = ({
  multiplier,
  compact = true,
}) => {
  const label =
    multiplier === 0
      ? '⚡0'
      : multiplier === 0.25
      ? '¼×'
      : multiplier === 0.5
      ? '½×'
      : `${multiplier}×`;
  return (
    <span
      className={`font-black leading-none flex items-center justify-center ${
        multiplier === 0 ? 'text-yellow-300' : 'text-sky-200'
      } ${compact ? 'text-[11px]' : 'text-xs'}`}
    >
      {label}
    </span>
  );
};

export const WaitDurationVisual: React.FC<{ duration: number; compact?: boolean }> = ({
  duration,
  compact = true,
}) => {
  const label =
    duration === 0.25 ? '¼×' : duration === 0.5 ? '½×' : `${duration}×`;
  return (
    <span className={`font-black text-amber-200 leading-none ${compact ? 'text-[11px]' : 'text-xs'}`}>
      {label}
    </span>
  );
};

export const InstantModeVisual: React.FC<{ mode: string; compact?: boolean }> = ({
  mode,
  compact = true,
}) => {
  const isOn = String(mode).toUpperCase() !== 'OFF';
  return (
    <span
      className={`font-black rounded px-1.5 py-0.5 leading-none border ${
        isOn
          ? 'bg-yellow-400/25 text-yellow-200 border-yellow-400/70'
          : 'bg-slate-800 text-slate-300 border-slate-500/70'
      } ${compact ? 'text-[10px]' : 'text-xs'}`}
    >
      {isOn ? 'ON' : 'OFF'}
    </span>
  );
};

export const CoordVisual: React.FC<{ value: number; axis?: string; compact?: boolean }> = ({
  value,
  axis,
  compact = true,
}) => {
  return (
    <span className={`font-mono font-black text-cyan-200 leading-none ${compact ? 'text-[10px]' : 'text-xs'}`}>
      {axis ? `${axis}:` : ''}
      {value}
    </span>
  );
};

export const DepotStationVisual: React.FC<{ station: string | number; compact?: boolean }> = ({
  station,
  compact = true,
}) => {
  const norm = String(station ?? 'STACK_1').trim().toUpperCase();
  const isQueue = norm === 'QUEUE' || norm === 'Q';
  const num = isQueue ? 'Q' : norm === 'STACK_2' || norm === '2' ? 2 : norm === 'STACK_3' || norm === '3' ? 3 : 1;

  if (compact) {
    if (isQueue) {
      return (
        <span className="inline-flex items-center justify-center rounded px-1 h-4 bg-amber-400 text-slate-950 text-[10px] font-black shadow-sm select-none">
          Q
        </span>
      );
    }
    return (
      <div className="inline-flex items-center gap-0.5 leading-none select-none">
        {[1, 2, 3].map((slot) => (
          <span
            key={slot}
            className={`inline-flex items-center justify-center rounded text-[10px] font-black transition-colors ${
              slot === num
                ? 'w-4 h-4 bg-amber-400 text-slate-950 shadow-sm'
                : 'w-2.5 h-3.5 bg-slate-800 text-slate-500 border border-slate-700'
            }`}
          >
            {slot === num ? slot : ''}
          </span>
        ))}
      </div>
    );
  }

  if (isQueue) {
    return (
      <div className="flex flex-col items-center gap-1 select-none">
        <span className="inline-flex items-center justify-center rounded px-2 py-0.5 bg-amber-400 text-slate-950 font-black text-xs shadow-sm">
          QUEUE (FIFO)
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <div className="flex items-end gap-1">
        {[1, 2, 3].map((slot) => (
          <div
            key={slot}
            className={`w-3.5 rounded-t border-x border-b flex items-center justify-center ${
              slot === num
                ? 'h-5 bg-amber-400/25 border-amber-400 text-amber-200'
                : 'h-3.5 bg-slate-800/60 border-slate-600/60 text-slate-500'
            }`}
          />
        ))}
      </div>
      <span className="font-mono font-black text-xs text-amber-200 leading-none">
        #{num}
      </span>
    </div>
  );
};

export const DepotGateVisual: React.FC<{ gate: string | unknown; compact?: boolean }> = ({
  gate,
  compact = true,
}) => {
  const norm = String(gate ?? 'OUT').trim().toUpperCase();
  const isAccept = norm === 'ACCEPT';
  const isReject = norm === 'REJECT';

  const bg = isAccept
    ? 'bg-emerald-500 text-slate-950'
    : isReject
    ? 'bg-red-600 text-white'
    : 'bg-violet-500 text-white';

  const label = isAccept ? 'ACCEPT' : isReject ? 'REJECT' : 'OUT';

  return (
    <span
      className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 font-black uppercase text-[10px] select-none shadow-sm ${bg}`}
    >
      {compact ? label : `GATE: ${label}`}
    </span>
  );
};

export const SwitchyardJunctionVisual: React.FC<{
  junction: string | unknown;
  compact?: boolean;
}> = ({ junction, compact = true }) => {
  const raw = String(junction ?? 'A').trim().toUpperCase();
  const norm = raw === 'B' || raw === 'DOCK_B' ? 'B' : raw === 'C' || raw === 'DOCK_C' ? 'C' : 'A';
  const styleClass =
    norm === 'C'
      ? 'bg-emerald-500 text-slate-950 border-emerald-200'
      : norm === 'B'
      ? 'bg-amber-500 text-slate-950 border-amber-200'
      : 'bg-sky-500 text-slate-950 border-sky-200';
  return (
    <span
      data-testid="switchyard-junction-visual"
      className={`inline-flex items-center justify-center rounded border font-mono font-black leading-none select-none shadow-sm ${
        compact ? 'px-1.5 py-0.5 text-[10px] min-w-[20px] h-[20px]' : 'px-2 py-1 text-xs'
      } ${styleClass}`}
    >
      [{norm}]
    </span>
  );
};

export const ParamVisual: React.FC<ParamVisualProps> = ({
  paramDef,
  value,
  compact = true,
  actionType,
}) => {
  const effectiveValue = value !== undefined ? value : paramDef.defaultValue;

  if (typeof effectiveValue === 'string' && effectiveValue.startsWith('$')) {
    return <SensorVisual sensorId={effectiveValue} compact={compact} />;
  }

  if (isVariableName(effectiveValue)) {
    return (
      <span
        data-testid={`var-badge-${effectiveValue}`}
        className={`italic font-mono font-black text-amber-300 bg-slate-950/80 rounded border border-amber-400/60 shadow-sm flex items-center justify-center leading-none ${
          compact ? 'px-1.5 py-0.5 text-xs min-w-[20px] h-[20px]' : 'px-2 py-1 text-sm min-w-[28px] h-[28px]'
        }`}
      >
        {effectiveValue}
      </span>
    );
  }

  if (
    paramDef.id === 'junction' ||
    (paramDef.type as string) === 'switchyard-junction' ||
    ((actionType === 'SWITCH_LEFT' || actionType === 'SWITCH_RIGHT') &&
      (effectiveValue === 'A' || effectiveValue === 'B'))
  ) {
    return <SwitchyardJunctionVisual junction={effectiveValue} compact={compact} />;
  }

  const isRight = actionType === 'TURN_RIGHT' || actionType === 'ARC_RIGHT';
  const direction = isRight ? 'right' : 'left';

  switch (paramDef.type) {
    case 'angle': {
      // Differentiate between Rotation parameter and Arc Angle parameter
      const isArcAngle =
        paramDef.visualVariant === 'arcAngle' ||
        actionType === 'ARC_LEFT' ||
        actionType === 'ARC_RIGHT';

      if (isArcAngle) {
        return (
          <ArcAngleVisual
            angle={Number(effectiveValue)}
            direction={direction}
            size={compact ? 22 : 32}
          />
        );
      }

      // Default angle parameter is rotation
      return (
        <RotationVisual
          angle={Number(effectiveValue)}
          direction={direction}
          size={compact ? 22 : 32}
        />
      );
    }
    case 'radius':
      return (
        <RadiusVisual
          radius={Number(effectiveValue)}
          direction={direction}
          size={compact ? 24 : 32}
        />
      );
    case 'color':
      return (
        <ColorVisual
          color={String(effectiveValue)}
          size={compact ? 18 : 26}
          showEraserCue={actionType === 'SET_PEN_COLOR'}
        />
      );
    case 'penWidth':
      return (
        <PenWidthVisual
          width={Number(effectiveValue)}
          boxWidth={compact ? 26 : 38}
          boxHeight={compact ? 16 : 22}
        />
      );
    case 'length':
      return (
        <LengthVisual
          length={Number(effectiveValue)}
          size={compact ? 24 : 32}
        />
      );
    case 'pitch':
      return <PitchVisual pitch={Number(effectiveValue)} compact={compact} />;
    case 'duration':
      return <BeatDurationVisual duration={Number(effectiveValue)} compact={compact} />;
    case 'preset':
      return <StampPresetVisual preset={String(effectiveValue)} size={compact ? 22 : 28} />;
    case 'turnDir':
      return <CursorTurnVisual turnDir={String(effectiveValue)} compact={compact} />;
    case 'gridCoord': {
      const coordVariant =
        paramDef.visualVariant === 'col' ||
        paramDef.visualVariant === 'pixelX' ||
        paramDef.visualVariant === 'pixelY'
          ? paramDef.visualVariant
          : actionType === 'LIGHT_COL'
          ? 'col'
          : actionType === 'LIGHT_PIXEL'
          ? paramDef.id === 'x'
            ? 'pixelX'
            : 'pixelY'
          : 'row';
      return (
        <GridCoordVisual
          coord={Number(effectiveValue)}
          variant={coordVariant}
          compact={compact}
        />
      );
    }
    case 'beat-delay':
      return <BeatDelayVisual multiplier={Number(effectiveValue)} compact={compact} />;
    case 'wait-duration':
      return <WaitDurationVisual duration={Number(effectiveValue)} compact={compact} />;
    case 'instant-mode':
      return <InstantModeVisual mode={String(effectiveValue)} compact={compact} />;
    case 'coord':
      return (
        <CoordVisual
          value={Number(effectiveValue)}
          axis={paramDef.id === 'x' ? 'X' : paramDef.id === 'y' ? 'Y' : undefined}
          compact={compact}
        />
      );
    case 'depot-station':
      return <DepotStationVisual station={effectiveValue} compact={compact} />;
    case 'depot-gate':
      return <DepotGateVisual gate={effectiveValue} compact={compact} />;
    default:
      return (
        <span className="text-xs font-bold text-white">
          {effectiveValue}
          {paramDef.unit || ''}
        </span>
      );
  }
};
