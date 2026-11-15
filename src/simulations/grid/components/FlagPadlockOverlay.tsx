import React, { useEffect, useRef, useState } from 'react';
import { FlagObjective, GridState } from '../../../types';
import {
  isFlagPadlocked,
  isFloorSwitchRequiredForGoal,
  getPadlockedFlagIds,
  getNextRequiredWaypointOrder,
} from '../../../engine/physics';
import { useAppStore, useAppStoreSelector, isLowQualityActive } from '../../../store/useAppStore';
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

  // Detect flags/goal that unlocked because a prerequisite non-goal flag was collected
  // OR because a goal-required floor switch became active
  const prerequisiteCollected = nextGrid.flags.some(
    (nf, idx) => !nf.isGoal && !prevGrid.flags[idx].collected && nf.collected
  );
  const goalSwitchNewlySatisfied = Boolean(
    nextGrid.floorSwitches?.some((ns) => {
      const ps = prevGrid.floorSwitches?.find((s) => s.id === ns.id || (s.x === ns.x && s.y === ns.y));
      return !ps?.active && ns.active;
    })
  );

  const prevRules = {
    worldItems: prevGrid.worldItems,
    carriedItem: prevGrid.robot.carriedItem,
    carriedCount: prevGrid.robot.carriedCount,
    requireAllItemsCollected: prevGrid.requireAllItemsCollected,
    requireEmptyBackpackAtGoal: prevGrid.requireEmptyBackpackAtGoal,
  };
  const nextRules = {
    worldItems: nextGrid.worldItems,
    carriedItem: nextGrid.robot.carriedItem,
    carriedCount: nextGrid.robot.carriedCount,
    requireAllItemsCollected: nextGrid.requireAllItemsCollected,
    requireEmptyBackpackAtGoal: nextGrid.requireEmptyBackpackAtGoal,
  };

  const newlyUnlockedFlags: FlagObjective[] = [];
  if (prerequisiteCollected || goalSwitchNewlySatisfied) {
    for (let i = 0; i < nextGrid.flags.length; i++) {
      const prevFlag = prevGrid.flags[i];
      const nextFlag = nextGrid.flags[i];
      if (
        !nextFlag.collected &&
        isFlagPadlocked(prevFlag, prevGrid.flags, prevGrid.floorSwitches, prevGrid.lockedGates, prevRules) &&
        !isFlagPadlocked(nextFlag, nextGrid.flags, nextGrid.floorSwitches, nextGrid.lockedGates, nextRules)
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
        isFlagPadlocked(f, nextGrid.flags, nextGrid.floorSwitches, nextGrid.lockedGates, nextRules)
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
    const prereqHint =
      nextOrder !== null
        ? ` Collect flag ${nextOrder} first.`
        : steppedLockedFlag.isGoal && (nextGrid.floorSwitches?.length ?? 0) > 0
        ? ' Activate floor switch first.'
        : '';
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
  0% { transform: translateY(0px) scale(0.95); opacity: 1; }
  35% { transform: translateY(-5px) scale(1.22); opacity: 1; }
  100% { transform: translateY(-10px) scale(0.8); opacity: 0; }
}
@keyframes waypointShutterWiggle {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-7deg); }
  50% { transform: rotate(7deg); }
  75% { transform: rotate(-4deg); }
}
@keyframes prerequisiteBeaconPulse {
  0%, 100% { transform: scale(0.95); opacity: 0.9; }
  50% { transform: scale(1.18); opacity: 0.35; }
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
.waypoint-shutter-wiggle {
  transform-box: fill-box;
  transform-origin: center;
  animation: waypointShutterWiggle 380ms ease-in-out;
}
.prerequisite-beacon-pulse {
  transform-box: fill-box;
  transform-origin: center;
  animation: prerequisiteBeaconPulse 720ms ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .padlock-unlock-ring,
  .padlock-unlock-pop,
  .waypoint-shutter-wiggle,
  .prerequisite-beacon-pulse {
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
 * Non-verbal, zero-padlock shuttered overlays for ordered waypoints (`1 ⋯▶ 2`)
 * and gated Goal progress barriers (`[🏁 k/N]`), plus gentle early-step wiggle,
 * prerequisite beacon pulse, and shutter-release bursts.
 */
export const FlagPadlockOverlay: React.FC<FlagPadlockOverlayProps> = ({
  grid,
  cellSize = GRID_CELL_SIZE,
  isInstant = false,
  unlockedFlagIds,
}) => {
  const isLowQuality = useAppStoreSelector(isLowQualityActive);
  const prevGridRef = useRef<GridState | null>(null);
  const [animatingIds, setAnimatingIds] = useState<Set<string>>(() => new Set());
  const [earlyStepFlagId, setEarlyStepFlagId] = useState<string | null>(null);

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

    const hasUnlock = transition.newlyUnlockedFlags.length > 0 && !isInstant && !isLowQuality;
    const hasEarlyStep = Boolean(transition.steppedLockedFlag) && !isInstant && !isLowQuality;

    if (!hasUnlock && !hasEarlyStep) {
      return undefined;
    }

    const idsToAdd = hasUnlock ? transition.newlyUnlockedFlags.map((f) => f.id) : [];
    if (hasUnlock) {
      setAnimatingIds((prev) => {
        const next = new Set(prev);
        for (const id of idsToAdd) next.add(id);
        return next;
      });
    }

    if (hasEarlyStep && transition.steppedLockedFlag) {
      setEarlyStepFlagId(transition.steppedLockedFlag.id);
    }

    const timer = setTimeout(() => {
      if (hasUnlock) {
        setAnimatingIds((prev) => {
          const next = new Set(prev);
          for (const id of idsToAdd) next.delete(id);
          return next;
        });
      }
      if (hasEarlyStep) {
        setEarlyStepFlagId(null);
      }
    }, UNLOCK_POP_DURATION_MS);

    return () => clearTimeout(timer);
  }, [grid, isInstant, isLowQuality]);

  const flags = grid.flags || [];
  if (flags.length === 0) {
    return null;
  }

  const lockedIds = getPadlockedFlagIds(flags, grid.floorSwitches, grid.lockedGates, {
    worldItems: grid.worldItems,
    carriedItem: grid.robot.carriedItem,
    carriedCount: grid.robot.carriedCount,
    requireAllItemsCollected: grid.requireAllItemsCollected,
    requireEmptyBackpackAtGoal: grid.requireEmptyBackpackAtGoal,
  });
  const hasAnyUnlockAnim =
    (unlockedFlagIds ? unlockedFlagIds.size > 0 : false) || animatingIds.size > 0;

  // Ordered sequence chain connectors (strictly for flags with order > 0; completely omitted for order === 0)
  const orderedFlags = flags
    .filter((f) => !f.isGoal && f.order > 0)
    .sort((a, b) => a.order - b.order);
  const goalFlags = flags.filter((f) => f.isGoal);
  const hasUncollectedOrdered = orderedFlags.some((f) => !f.collected);

  interface SequenceLink {
    key: string;
    from: FlagObjective;
    to: FlagObjective;
    dimmed: boolean;
  }
  const sequenceLinks: SequenceLink[] = [];
  if (orderedFlags.length > 0 && hasUncollectedOrdered) {
    for (let i = 0; i < orderedFlags.length - 1; i++) {
      const from = orderedFlags[i];
      const to = orderedFlags[i + 1];
      if (from.order < to.order) {
        sequenceLinks.push({
          key: `${from.order}-to-${to.order}`,
          from,
          to,
          dimmed: Boolean(from.collected && to.collected),
        });
      }
    }
    const lastOrdered = orderedFlags[orderedFlags.length - 1];
    if (goalFlags.length > 0 && !goalFlags[0].collected) {
      sequenceLinks.push({
        key: `${lastOrdered.order}-to-goal`,
        from: lastOrdered,
        to: goalFlags[0],
        dimmed: false,
      });
    }
  }

  if (lockedIds.size === 0 && !hasAnyUnlockAnim && sequenceLinks.length === 0) {
    return null;
  }

  const scaleFactor = cellSize / 72;

  // Compute Goal barrier progress [k/N]
  const nonGoalFlags = flags.filter((f) => !f.isGoal);
  const collectedFlagCount = nonGoalFlags.filter((f) => f.collected).length;
  const reqSwitches = (grid.floorSwitches ?? []).filter((sw) =>
    isFloorSwitchRequiredForGoal(sw, grid.lockedGates)
  );
  const activeSwitchCount = reqSwitches.filter((sw) => Boolean(sw.active)).length;
  const needsAllItems = Boolean(grid.requireAllItemsCollected);
  const itemsDone = needsAllItems && (grid.worldItems?.length ?? 0) === 0 ? 1 : 0;
  const needsEmptyHand = Boolean(grid.requireEmptyBackpackAtGoal);
  const emptyHandDone =
    needsEmptyHand && !grid.robot.carriedItem && (grid.robot.carriedCount ?? 0) === 0 ? 1 : 0;
  const totalGoalSteps =
    nonGoalFlags.length +
    reqSwitches.length +
    (needsAllItems ? 1 : 0) +
    (needsEmptyHand ? 1 : 0);
  const doneGoalSteps = collectedFlagCount + activeSwitchCount + itemsDone + emptyHandDone;

  // Highlight active prerequisite flag if the robot is currently stepped onto a locked waypoint/goal
  const steppedLockedOnCurrent = flags.find(
    (f) =>
      lockedIds.has(f.id) &&
      (earlyStepFlagId === f.id || (Boolean(grid.robot) && grid.robot.x === f.x && grid.robot.y === f.y))
  );
  const nextRequiredOrder = getNextRequiredWaypointOrder(flags);
  const prerequisiteTargets = steppedLockedOnCurrent
    ? nextRequiredOrder !== null
      ? flags.filter((f) => !f.isGoal && !f.collected && f.order === nextRequiredOrder)
      : steppedLockedOnCurrent.isGoal
      ? flags.filter((f) => !f.isGoal && !f.collected)
      : []
    : [];

  const needsAnimCss =
    hasAnyUnlockAnim || Boolean(steppedLockedOnCurrent) || prerequisiteTargets.length > 0;

  return (
    <g data-testid="flag-padlock-overlay" className="pointer-events-none">
      {needsAnimCss && <style>{PADLOCK_ANIMATION_CSS}</style>}

      {/* 1. Dashed 1 ⋯▶ 2 directional sequence chains (omitted when order === 0) */}
      {sequenceLinks.map((link) => {
        const x1 = link.from.x * cellSize + cellSize / 2;
        const y1 = link.from.y * cellSize + cellSize / 2;
        const x2 = link.to.x * cellSize + cellSize / 2;
        const y2 = link.to.y * cellSize + cellSize / 2;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.hypot(dx, dy);
        if (dist <= 38 * scaleFactor) return null;
        const ux = dx / dist;
        const uy = dy / dist;
        const trimStart = 20 * scaleFactor;
        const trimEnd = 22 * scaleFactor;
        const sx = x1 + ux * trimStart;
        const sy = y1 + uy * trimStart;
        const ex = x2 - ux * trimEnd;
        const ey = y2 - uy * trimEnd;
        const deg = (Math.atan2(dy, dx) * 180) / Math.PI;

        return (
          <g
            key={link.key}
            data-testid={`sequence-chain-${link.key}`}
            opacity={link.dimmed ? 0.25 : 0.78}
          >
            <line
              x1={sx}
              y1={sy}
              x2={ex}
              y2={ey}
              stroke="#0f172a"
              strokeWidth={4 * scaleFactor}
              strokeDasharray={`${4 * scaleFactor} ${4 * scaleFactor}`}
              strokeLinecap="round"
            />
            <line
              x1={sx}
              y1={sy}
              x2={ex}
              y2={ey}
              stroke="#7dd3fc"
              strokeWidth={2 * scaleFactor}
              strokeDasharray={`${4 * scaleFactor} ${4 * scaleFactor}`}
              strokeLinecap="round"
            />
            <g transform={`translate(${ex}, ${ey}) rotate(${deg}) scale(${scaleFactor})`}>
              <path
                d="M -5 -4 L 2 0 L -5 4"
                fill="none"
                stroke="#7dd3fc"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          </g>
        );
      })}

      {/* 2. Prerequisite pulse highlight when robot steps early onto a gated waypoint or goal */}
      {prerequisiteTargets.map((target) => {
        const px = target.x * cellSize + cellSize / 2;
        const py = target.y * cellSize + cellSize / 2;
        const pKey = getFlagTestKey(target, flags);
        return (
          <g
            key={`prereq-pulse-${target.id}`}
            data-testid={`prerequisite-pulse-${pKey}`}
            transform={`translate(${px}, ${py})`}
          >
            <circle
              r={24 * scaleFactor}
              fill="none"
              stroke="#38bdf8"
              strokeWidth={3 * scaleFactor}
              className={!isInstant && !isLowQuality ? 'prerequisite-beacon-pulse' : undefined}
            />
          </g>
        );
      })}

      {/* 3. Shuttered gated waypoints, shuttered Goal [🏁 k/N] barriers, and shutter-release bursts */}
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
          const isEarlyWiggle =
            !isInstant && !isLowQuality && (earlyStepFlagId === flag.id || isRobotHere);
          const baseRadius = (flag.isGoal ? 22 : 18) * scaleFactor;
          const ringRadius = (isRobotHere ? 26 : flag.isGoal ? 25 : 22) * scaleFactor;
          const strokeAccent = isRobotHere ? '#fbbf24' : '#94a3b8';

          return (
            <g
              key={`padlock-${flag.id}`}
              data-testid={`padlock-${flagKey}`}
              data-flag-id={flag.id}
              data-padlock-state="locked"
              data-shutter-variant={flag.isGoal ? 'goal' : 'waypoint'}
              aria-label={`${formatFlagLabel(flag)} gated`}
              transform={`translate(${cx}, ${cy})`}
            >
              <g className={isEarlyWiggle ? 'waypoint-shutter-wiggle' : undefined}>
                {/* Desaturated veil over gated flag (omitted when robot stands here so robot stays crisp) */}
                {!isRobotHere && (
                  <circle r={baseRadius} fill="#0f172a" fillOpacity={0.56} />
                )}

                {/* Dashed desaturated shutter perimeter */}
                <circle
                  r={ringRadius}
                  fill="none"
                  stroke="#0f172a"
                  strokeWidth={4 * scaleFactor}
                  strokeOpacity={0.78}
                />
                <circle
                  r={ringRadius}
                  fill="none"
                  stroke={strokeAccent}
                  strokeWidth={2.2 * scaleFactor}
                  strokeDasharray={`${5 * scaleFactor} ${4 * scaleFactor}`}
                  strokeLinecap="round"
                />

                {/* Diagonal shutter louvers (replaces SVG padlock icons completely) */}
                {!isRobotHere && (
                  <g
                    transform={`scale(${scaleFactor})`}
                    stroke={flag.isGoal ? '#fbbf24' : '#cbd5e1'}
                    strokeOpacity={flag.isGoal ? 0.65 : 0.55}
                    strokeWidth={2.4}
                    strokeLinecap="round"
                  >
                    <line x1={-12} y1={-6} x2={-2} y2={-16} />
                    <line x1={-14} y1={8} x2={8} y2={-14} />
                    <line x1={-6} y1={16} x2={16} y2={-6} />
                    <line x1={6} y1={16} x2={14} y2={8} />
                  </g>
                )}

                {/* Gated Goal shutter progress pill: [🏁 k/N] */}
                {flag.isGoal && totalGoalSteps > 0 && (
                  <g
                    data-testid="goal-shutter-progress"
                    transform={`translate(0, ${22 * scaleFactor}) scale(${scaleFactor})`}
                  >
                    <rect
                      x={-22}
                      y={-8.5}
                      width={44}
                      height={17}
                      rx={8.5}
                      fill="#0f172a"
                      stroke={isRobotHere ? '#fbbf24' : '#94a3b8'}
                      strokeWidth={1.6}
                    />
                    <text
                      x={0}
                      y={0.5}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={9.5}
                      fontWeight={900}
                      fill="#fef3c7"
                    >
                      {`🏁 ${doneGoalSteps}/${totalGoalSteps}`}
                    </text>
                  </g>
                )}
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
              data-shutter-variant={flag.isGoal ? 'goal' : 'waypoint'}
              aria-label={`${formatFlagLabel(flag)} unlocked`}
              transform={`translate(${cx}, ${cy})`}
            >
              {/* Expanding shutter-release ring burst */}
              <circle
                className="padlock-unlock-ring"
                r={ringRadius}
                fill="none"
                stroke="#38bdf8"
                strokeWidth={3 * scaleFactor}
              />

              {/* Open-shutter starburst badge (zero padlock shackle) */}
              <g transform={`translate(${badgeOffsetX}, ${badgeOffsetY}) scale(${scaleFactor})`}>
                <g className="padlock-unlock-pop">
                  <circle r={9.5} fill="#0f172a" stroke="#38bdf8" strokeWidth={1.8} />
                  <polygon
                    points="0,-5.8 1.8,-1.8 5.8,0 1.8,1.8 0,5.8 -1.8,1.8 -5.8,0 -1.8,-1.8"
                    fill="#38bdf8"
                    stroke="#e0f2fe"
                    strokeWidth={0.8}
                    strokeLinejoin="round"
                  />
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
