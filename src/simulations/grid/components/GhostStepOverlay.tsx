import React, { useEffect } from 'react';
import { Direction } from '../../../types';
import { useAppStoreSelector } from '../../../store/useAppStore';
import {
  GhostPreviewPose,
  GhostPreviewState,
  computeGhostPreviewSteps,
} from '../../../engine/placeholderHelpers';
import { GRID_CELL_SIZE } from './GridOverlayLayer';

export { computeGhostPreviewSteps };
export type { GhostPreviewPose, GhostPreviewState };

export interface GhostStepOverlayProps {
  cellSize?: number;
  previewOverride?: GhostPreviewState | null;
  stepIntervalMs?: number;
}

const getRotationAngle = (dir: Direction): number => {
  switch (dir) {
    case 'NORTH':
      return 0;
    case 'EAST':
      return 90;
    case 'SOUTH':
      return 180;
    case 'WEST':
      return 270;
  }
};

/**
 * Translucent animated ghost robot + dashed step trail rendered inside GridCanvas's
 * `<GridOverlayLayer layer="over-robot" ghostStepSlot={...} />` slot.
 * Previews 1-3 starter steps on the map without modifying the learner's workspace blocks.
 */
export const GhostStepOverlay: React.FC<GhostStepOverlayProps> = ({
  cellSize = GRID_CELL_SIZE,
  previewOverride,
  stepIntervalMs = 550,
}) => {
  const {
    ghostPreview: storePreview,
    advanceGhostPreviewStep,
    stopGhostPreview,
  } = useAppStoreSelector((state) => ({
    ghostPreview: state.ghostPreview,
    advanceGhostPreviewStep: state.advanceGhostPreviewStep,
    stopGhostPreview: state.stopGhostPreview,
  }));

  const preview = previewOverride !== undefined ? previewOverride : storePreview;
  const isActive = Boolean(preview?.active && preview.poses.length > 0);
  const runId = preview?.runId ?? 0;
  const poseCount = preview?.poses.length ?? 0;

  useEffect(() => {
    if (previewOverride !== undefined || !isActive || poseCount <= 1) {
      return;
    }

    // Play through 2 full cycles of the ghost steps, then fade/dismiss cleanly
    const totalTicks = poseCount * 2;
    let ticks = 0;
    const interval = setInterval(() => {
      ticks += 1;
      if (ticks >= totalTicks) {
        clearInterval(interval);
        stopGhostPreview();
        return;
      }
      advanceGhostPreviewStep();
    }, stepIntervalMs);

    return () => clearInterval(interval);
  }, [
    previewOverride,
    isActive,
    runId,
    poseCount,
    stepIntervalMs,
    advanceGhostPreviewStep,
    stopGhostPreview,
  ]);

  if (!preview || !preview.active || preview.poses.length === 0) {
    return null;
  }

  const clampedIndex = Math.min(
    Math.max(0, preview.currentStepIndex),
    preview.poses.length - 1
  );
  const currentPose = preview.poses[clampedIndex];

  const trailPoints = preview.poses
    .map((p) => `${p.x * cellSize + cellSize / 2},${p.y * cellSize + cellSize / 2}`)
    .join(' ');

  return (
    <g
      data-testid="ghost-step-overlay"
      data-step-index={clampedIndex}
      className="pointer-events-none"
    >
      {/* Dashed Ghost Trajectory Trail */}
      {preview.poses.length > 1 && (
        <polyline
          data-testid="ghost-trail"
          points={trailPoints}
          fill="none"
          stroke="#67e8f9"
          strokeWidth={5}
          strokeDasharray="8 6"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.78}
        />
      )}

      {/* Step Waypoint Badges along the Ghost Trail */}
      {preview.poses.slice(1).map((pose, idx) => {
        const stepNum = idx + 1;
        const cx = pose.x * cellSize + cellSize / 2;
        const cy = pose.y * cellSize + cellSize / 2;
        const isReached = clampedIndex >= stepNum;
        return (
          <g
            key={`ghost-waypoint-${stepNum}-${pose.x}-${pose.y}`}
            data-testid={`ghost-waypoint-${stepNum}`}
            transform={`translate(${cx}, ${cy})`}
            opacity={isReached ? 0.92 : 0.55}
          >
            <circle
              r={10}
              fill="#083344"
              stroke="#67e8f9"
              strokeWidth={2}
              strokeDasharray="3 2"
            />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fill="#cffafe"
              fontSize={10}
              fontWeight={800}
            >
              {stepNum}
            </text>
          </g>
        );
      })}

      {/* Translucent Animated Ghost Robot */}
      <g
        data-testid="ghost-robot"
        transform={`translate(${currentPose.x * cellSize + cellSize / 2}, ${
          currentPose.y * cellSize + cellSize / 2
        })`}
        className="transition-all duration-300 ease-out"
        opacity={0.76}
      >
        <g transform={`rotate(${getRotationAngle(currentPose.dir)})`}>
          {/* Dashed Ghost Aura */}
          <circle
            r={26}
            fill="rgba(34, 211, 238, 0.22)"
            stroke="#67e8f9"
            strokeWidth={2}
            strokeDasharray="5 4"
          />
          {/* Ghost Robot Body */}
          <circle
            r={19}
            fill="rgba(56, 189, 248, 0.55)"
            stroke="#e0f2fe"
            strokeWidth={2.5}
            strokeDasharray="6 3"
          />
          {/* Directional Pointer */}
          <polygon points="0,-15 6.5,-3 -6.5,-3" fill="#ecfeff" />
          {/* Friendly Ghost Eyes */}
          <circle cx={-5.5} cy={3} r={2.8} fill="#083344" />
          <circle cx={5.5} cy={3} r={2.8} fill="#083344" />
        </g>
      </g>
    </g>
  );
};
