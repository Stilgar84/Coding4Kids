import React, { useEffect, useRef, useState } from 'react';
import { FlagObjective, GridState } from '../../../types';
import {
  isFlagPadlocked,
  getPadlockedFlagIds,
  getNextRequiredWaypointOrder,
} from '../../../engine/physics';
import { useAppStore } from '../../../store/useAppStore';
import { GRID_CELL_SIZE } from './GridOverlayLayer';

export { isFlagPadlocked, getPadlockedFlagIds, getNextRequiredWaypointOrder };

export interface PadlockTransitionInfo {
  /** Flags that just transitioned from padlocked to unlocked (ready to collect). */
  newlyUnlockedFlags: FlagObjective[];
  /** Padlocked flag/goal at the robot's new tile if the robot just stepped onto one. */
  steppedLockedFlag: FlagObjective | null;
  /** Concise screen-reader status announcement for unlock or padlocked-step events. */
  announcement: string | null;
}

function isSameFlagLayout(prevFlags: readonly FlagObjective[], nextFlags: readonly FlagObjective[]): boolean {
  if (prevFlags.length !== nextFlags.length) return false;
  for (let i = 0; i < prevFlags.length; i++) {
    const a = prevFlags[i];
    const b = nextFlags[i];
    if (
      a.id !== b.id ||
      a.x !== b.x ||
      a.y !== b.y ||
      a.isGoal !== b.isGoal ||
      a.order !== b.order
    ) {
      return false;
    }
  }
  return true;
}

function formatFlagLabel(flag: FlagObjective): string {
  return flag.isGoal ? 'Goal' : `Flag ${flag.order}`;
}

/**
 * Pure transition detector comparing consecutive GridState snapshots.
 * Ignores level/map switches and simulation resets so announcements and pop animations
 * fire strictly on genuine runtime waypoint unlocks or locked-tile steps.
 */
export function detectPadlockTransition(
  prevGrid: GridState | null | undefined,
  nextGrid: GridState
): PadlockTransitionInfo {
  if (
    !prevGrid ||
    prevGrid.width !== nextGrid.width ||
    prevGrid.height !== nextGrid.height ||
    !isSameFlagLayout(prevGrid.flags, nextGrid.flags)
  ) {
    return { newlyUnlockedFlags: [], steppedLockedFlag: null, announcement: null };
  }

  // Ignore simulation resets back to initial uncollected state
  const wasAnyCollected = prevGrid.flags.some((f) => f.collected);
  const isNowAllUncollected = nextGrid.flags.every((f) => !f.collected);
  if (wasAnyCollected && isNowAllUncollected && nextGrid.trace.length <= 1) {
    return { newlyUnlockedFlags: [], steppedLockedFlag: null, announcement: null };
  }

  // Detect flags that unlocked because a prerequisite non-goal flag was collected
  const prerequisiteCollected = nextGrid.flags.some(
    (nf, idx) => !nf.isGoal && !prevGrid.flags[idx].collected && nf.collected
  );

  const newlyUnlockedFlags: FlagObjective[] = [];
  if (prerequisiteCollected) {
    for (let i = 0; i < nextGrid.flags.length; i++) {
      const prevFlag = prevGrid.flags[i];
      const nextFlag = nextGrid.flags[i];
      if (
        !nextFlag.collected &&
        isFlagPadlocked(prevFlag, prevGrid.flags) &&
        !isFlagPadlocked(nextFlag, nextGrid.flags)
      ) {
        newlyUnlockedFlags.push(nextFlag);
      }
    }
    newlyUnlockedFlags.sort((a, b) => {
      if (a.isGoal !== b.isGoal) return a.isGoal ? 1 : -1;
      return a.order - b.order;
    });
  }

  // Detect robot stepping onto a still-padlocked flag or goal
  const robotMoved =
    nextGrid.trace.length > prevGrid.trace.length ||
    prevGrid.robot.x !== nextGrid.robot.x ||
    prevGrid.robot.y !== nextGrid.robot.y;

  let steppedLockedFlag: FlagObjective | null = null;
  if (robotMoved) {
    const lockedHere = nextGrid.flags.find(
      (f) =>
        f.x === nextGrid.robot.x &&
        f.y === nextGrid.robot.y &&
        isFlagPadlocked(f, nextGrid.flags)
    );
    if (lockedHere) {
      steppedLockedFlag = lockedHere;
    }
  }

  const parts: string[] = [];
  if (newlyUnlockedFlags.length > 0) {
    const labels = newlyUnlockedFlags.map(formatFlagLabel);
    parts.push(`${labels.join(', ')} unlocked.`);
  }
  if (steppedLockedFlag) {
    const nextOrder = getNextRequiredWaypointOrder(nextGrid.flags);
    const targetLabel = formatFlagLabel(steppedLockedFlag);
    const prereqHint = nextOrder !== null ? ` Collect flag ${nextOrder} first.` : '';
    parts.push(`${targetLabel} is padlocked.${prereqHint}`);
  }

  return {
    newlyUnlockedFlags,
    steppedLockedFlag,
    announcement: parts.length > 0 ? parts.join(' ') : null,
  };
}

export interface FlagPadlockOverlayProps {
  grid: GridState;
  cellSize?: number;
  isInstant?: boolean;
  /**
   * Optional explicit set of flag IDs currently playing the unlock pop animation
   * (used for deterministic SSR / unit tests; live transitions also trigger automatically).
   */
  unlockedFlagIds?: ReadonlySet<string>;
}

const UNLOCK_POP_DURATION_MS = 650;

const PADLOCK_ANIMATION_CSS = `
@keyframes padlockRingPop {
  0% { transform: scale(0.92); opacity: 0.95; }
  60% { transform: scale(1.32); opacity: 0.65; }
  100% { transform: scale(1.55); opacity: 0; }
}
@keyframes padlockBadgePop {
  0% { transform: translateY(0px) scale(1); opacity: 1; }
  35% { transform: translateY(-6px) scale(1.25); opacity: 1; }
  100% { transform: translateY(-12px) scale(0.85); opacity: 0; }
}
.padlock-unlock-ring {
  transform-box: fill-box;
  transform-origin: center;
  animation: padlockRingPop 620ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.padlock-unlock-pop {
  transform-box: fill-box;
  transform-origin: center;
  animation: padlockBadgePop 620ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@media (prefers-reduced-motion: reduce) {
  .padlock-unlock-ring,
  .padlock-unlock-pop {
    animation-duration: 1ms;
  }
}
`;

function getFlagTestKey(flag: FlagObjective, allFlags: readonly FlagObjective[]): string {
  if (flag.isGoal) {
    return `goal-${flag.x}-${flag.y}`;
  }
  const sameOrderCount = allFlags.filter((f) => !f.isGoal && f.order === flag.order).length;
  return sameOrderCount > 1 ? `flag-${flag.order}-${flag.x}-${flag.y}` : `flag-${flag.order}`;
}

/**
 * Non-verbal, color-blind safe padlock rings & lock badge icons rendered over locked
 * ordered waypoints (`2`, `3`, `Goal`), with an unlock pop animation and polite
 * screen-reader announcements as each prerequisite waypoint is collected.
 */
export const FlagPadlockOverlay: React.FC<FlagPadlockOverlayProps> = ({
  grid,
  cellSize = GRID_CELL_SIZE,
  isInstant = false,
  unlockedFlagIds,
}) => {
  const prevGridRef = useRef<GridState | null>(null);
  const [animatingIds, setAnimatingIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const prevGrid = prevGridRef.current;
    prevGridRef.current = grid;

    const transition = detectPadlockTransition(prevGrid, grid);

    if (transition.announcement) {
      useAppStore.setState((prev) => ({
        statusAnnouncement:
          prev.statusAnnouncement === transition.announcement
            ? `${transition.announcement}\u00A0`
            : transition.announcement!,
      }));
    }

    if (transition.newlyUnlockedFlags.length > 0 && !isInstant) {
      const idsToAdd = transition.newlyUnlockedFlags.map((f) => f.id);
      setAnimatingIds((prev) => {
        const next = new Set(prev);
        for (const id of idsToAdd) next.add(id);
        return next;
      });

      const timer = setTimeout(() => {
        setAnimatingIds((prev) => {
          const next = new Set(prev);
          for (const id of idsToAdd) next.delete(id);
          return next;
        });
      }, UNLOCK_POP_DURATION_MS);

      return () => clearTimeout(timer);
    }

    return undefined;
  }, [grid, isInstant]);

  const flags = grid.flags || [];
  if (flags.length === 0) {
    return null;
  }

  const lockedIds = getPadlockedFlagIds(flags);
  const hasAnyUnlockAnim =
    (unlockedFlagIds ? unlockedFlagIds.size > 0 : false) || animatingIds.size > 0;

  if (lockedIds.size === 0 && !hasAnyUnlockAnim) {
    return null;
  }

  const scaleFactor = cellSize / 72;

  return (
    <g data-testid="flag-padlock-overlay" className="pointer-events-none">
      {hasAnyUnlockAnim && <style>{PADLOCK_ANIMATION_CSS}</style>}

      {flags.map((flag) => {
        const cx = flag.x * cellSize + cellSize / 2;
        const cy = flag.y * cellSize + cellSize / 2;
        const flagKey = getFlagTestKey(flag, flags);
        const isLocked = lockedIds.has(flag.id);
        const isUnlocking =
          !isLocked &&
          !flag.collected &&
          (Boolean(unlockedFlagIds?.has(flag.id)) || animatingIds.has(flag.id));

        if (isLocked) {
          const isRobotHere =
            Boolean(grid.robot) && grid.robot.x === flag.x && grid.robot.y === flag.y;
          const baseRadius = (flag.isGoal ? 22 : 18) * scaleFactor;
          const ringRadius = (isRobotHere ? 26 : flag.isGoal ? 25 : 22) * scaleFactor;
          const badgeOffsetX = (isRobotHere ? 18 : flag.isGoal ? 16 : 14) * scaleFactor;
          const badgeOffsetY = -(isRobotHere ? 18 : flag.isGoal ? 16 : 14) * scaleFactor;
          const strokeAccent = isRobotHere ? '#fbbf24' : '#cbd5e1';

          return (
            <g
              key={`padlock-${flag.id}`}
              data-testid={`padlock-${flagKey}`}
              data-flag-id={flag.id}
              data-padlock-state="locked"
              aria-label={`${formatFlagLabel(flag)} padlocked`}
              transform={`translate(${cx}, ${cy})`}
            >
              {/* Dimmed translucent veil over locked flag (omitted when robot stands here so robot stays bright) */}
              {!isRobotHere && (
                <circle r={baseRadius} fill="#0f172a" fillOpacity={0.44} />
              )}

              {/* High-contrast dashed padlock ring (shape + stroke-pattern redundancy for color-blind safety) */}
              <circle
                r={ringRadius}
                fill="none"
                stroke="#0f172a"
                strokeWidth={4.5 * scaleFactor}
                strokeOpacity={0.8}
              />
              <circle
                r={ringRadius}
                fill="none"
                stroke={strokeAccent}
                strokeWidth={2.5 * scaleFactor}
                strokeDasharray={`${5 * scaleFactor} ${4 * scaleFactor}`}
                strokeLinecap="round"
              />

              {/* Corner padlock badge icon (closed shackle + keyhole) */}
              <g transform={`translate(${badgeOffsetX}, ${badgeOffsetY}) scale(${scaleFactor})`}>
                <circle r={10} fill="#0f172a" stroke={strokeAccent} strokeWidth={1.8} />
                <path
                  d="M -3.2 -1 V -3.6 A 3.2 3.2 0 0 1 3.2 -3.6 V -1"
                  fill="none"
                  stroke="#f8fafc"
                  strokeWidth={1.9}
                  strokeLinecap="round"
                />
                <rect
                  x={-4.8}
                  y={-1.2}
                  width={9.6}
                  height={7.2}
                  rx={1.8}
                  fill="#fbbf24"
                  stroke="#0f172a"
                  strokeWidth={0.8}
                />
                <circle cx={0} cy={2.2} r={1.15} fill="#0f172a" />
              </g>
            </g>
          );
        }

        if (isUnlocking) {
          const ringRadius = (flag.isGoal ? 25 : 22) * scaleFactor;
          const badgeOffsetX = (flag.isGoal ? 16 : 14) * scaleFactor;
          const badgeOffsetY = -(flag.isGoal ? 16 : 14) * scaleFactor;

          return (
            <g
              key={`padlock-unlock-${flag.id}`}
              data-testid={`padlock-unlock-${flagKey}`}
              data-flag-id={flag.id}
              data-padlock-state="unlocking"
              aria-label={`${formatFlagLabel(flag)} unlocked`}
              transform={`translate(${cx}, ${cy})`}
            >
              {/* Expanding unlock ring burst */}
              <circle
                className="padlock-unlock-ring"
                r={ringRadius}
                fill="none"
                stroke="#38bdf8"
                strokeWidth={3 * scaleFactor}
              />

              {/* Open-shackle padlock badge popping upward */}
              <g transform={`translate(${badgeOffsetX}, ${badgeOffsetY}) scale(${scaleFactor})`}>
                <g className="padlock-unlock-pop">
                  <circle r={10.5} fill="#0f172a" stroke="#38bdf8" strokeWidth={1.8} />
                  <path
                    d="M -3.2 -2.6 V -4.8 A 3.2 3.2 0 0 1 3.2 -4.8 V -3.4"
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth={1.9}
                    strokeLinecap="round"
                    transform="translate(1.5, -1.2) rotate(18)"
                  />
                  <rect
                    x={-4.8}
                    y={-1.0}
                    width={9.6}
                    height={7.0}
                    rx={1.8}
                    fill="#38bdf8"
                    stroke="#0f172a"
                    strokeWidth={0.8}
                  />
                  <circle cx={0} cy={2.3} r={1.15} fill="#0f172a" />
                </g>
              </g>
            </g>
          );
        }

        return null;
      })}
    </g>
  );
};
