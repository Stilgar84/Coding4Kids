import React from 'react';
import {
  CodeBlock,
  Direction,
  GridState,
  InterpreterRuntimeState,
  WorkspaceState,
} from '../../../types';
import {
  DemoSpotlightType,
  getActivityAtVersion,
  getActivityLatest,
} from '../../../data/curriculum';
import { useAppStore } from '../../../store/useAppStore';
import { GRID_CELL_SIZE } from './GridOverlayLayer';

export interface DemoSpotlightOverlayProps {
  grid: GridState;
  cellSize?: number;
  isInstant?: boolean;
  /** Optional explicit overrides for isolated unit tests or custom embeds */
  spotlightsOverride?: DemoSpotlightType[];
  runtimeOverride?: InterpreterRuntimeState | null;
  workspaceOverride?: WorkspaceState;
}

export function getDirectionRotationDeg(dir: Direction): number {
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
}

export function getEgocentricSideDirections(dir: Direction): {
  leftDir: Direction;
  rightDir: Direction;
} {
  switch (dir) {
    case 'NORTH':
      return { leftDir: 'WEST', rightDir: 'EAST' };
    case 'EAST':
      return { leftDir: 'NORTH', rightDir: 'SOUTH' };
    case 'SOUTH':
      return { leftDir: 'EAST', rightDir: 'WEST' };
    case 'WEST':
      return { leftDir: 'SOUTH', rightDir: 'NORTH' };
  }
}

function getMotionDelta(
  dir: Direction,
  blockType: string
): { dx: number; dy: number } | null {
  const sign = blockType === 'MOVE_FWD' ? 1 : blockType === 'MOVE_BACK' ? -1 : 0;
  if (sign === 0) return null;
  switch (dir) {
    case 'NORTH':
      return { dx: 0, dy: -1 * sign };
    case 'SOUTH':
      return { dx: 0, dy: 1 * sign };
    case 'EAST':
      return { dx: 1 * sign, dy: 0 };
    case 'WEST':
      return { dx: -1 * sign, dy: 0 };
  }
}

interface WorldHighlightCoord {
  key: string;
  x: number;
  y: number;
  kind: string;
}

function collectWorldItemHighlights(grid: GridState): WorldHighlightCoord[] {
  const anyGrid = grid as unknown as Record<string, unknown>;
  const coords: WorldHighlightCoord[] = [];

  const pushEntries = (raw: unknown, kind: string) => {
    if (!Array.isArray(raw)) return;
    raw.forEach((entry, idx) => {
      if (
        entry &&
        typeof entry === 'object' &&
        typeof (entry as { x?: unknown }).x === 'number' &&
        typeof (entry as { y?: unknown }).y === 'number'
      ) {
        if ((entry as { collected?: boolean }).collected) return;
        const x = (entry as { x: number }).x;
        const y = (entry as { y: number }).y;
        coords.push({ key: `${kind}-${idx}-${x}-${y}`, x, y, kind });
      }
    });
  };

  pushEntries(anyGrid.items, 'item');
  pushEntries(anyGrid.worldItems, 'item');
  pushEntries(anyGrid.lockedGates, 'gate');
  pushEntries(anyGrid.waterCells, 'water');
  pushEntries(anyGrid.floorSwitches, 'switch');

  return coords;
}

/**
 * Interactive Explanation Demo Spotlights rendered inside GridCanvas's isolated
 * `<GridOverlayLayer layer="over-robot" demoSpotlightSlot={...} />` slot.
 *
 * Supports:
 * - `execution-order`: Step index badge & motion target reticle synced with interpreter execution
 * - `egocentric-pov`: Robot eye-heading vision cone + color-blind safe Left (circle, solid) &
 *   Right (diamond, dashed) wing cues anchored to and rotating with robot orientation
 * - `world-item`, `backpack`, `loop-counter`: Forward-compatible hooks for Wave 4 (`C15`, `C16`)
 */
export const DemoSpotlightOverlay: React.FC<DemoSpotlightOverlayProps> = ({
  grid,
  cellSize = GRID_CELL_SIZE,
  isInstant = false,
  spotlightsOverride,
  runtimeOverride,
  workspaceOverride,
}) => {
  const subAppMode = useAppStore((s) => s.appMode);
  const subActivityId = useAppStore((s) => s.activeActivityId);
  const subActivityVer = useAppStore((s) => s.activeActivityVersion);
  const subDemoTabIndex = useAppStore((s) => s.activeDemoTabIndex);
  const subRuntime = useAppStore((s) => s.runtime);
  const subWorkspace = useAppStore((s) => s.workspace);

  const isSSR = typeof window === 'undefined';
  const liveState = isSSR ? useAppStore.getState() : null;

  const appMode = liveState ? liveState.appMode : subAppMode;
  const activeActivityId = liveState ? liveState.activeActivityId : subActivityId;
  const activeActivityVersion = liveState ? liveState.activeActivityVersion : subActivityVer;
  const activeDemoTabIndex = liveState ? liveState.activeDemoTabIndex : subDemoTabIndex;
  const runtime =
    runtimeOverride !== undefined
      ? runtimeOverride
      : liveState
      ? liveState.runtime
      : subRuntime;
  const workspace =
    workspaceOverride !== undefined
      ? workspaceOverride
      : liveState
      ? liveState.workspace
      : subWorkspace;

  const spotlights: DemoSpotlightType[] = React.useMemo(() => {
    if (spotlightsOverride) {
      return spotlightsOverride;
    }
    if (appMode !== 'curriculum') {
      return [];
    }
    const activity =
      getActivityAtVersion(activeActivityId, activeActivityVersion) ??
      getActivityLatest(activeActivityId);
    if (!activity || activity.format !== 'explanation' || !activity.demoTabs?.length) {
      return [];
    }
    const clampedIdx = Math.min(
      Math.max(0, activeDemoTabIndex),
      activity.demoTabs.length - 1
    );
    return activity.demoTabs[clampedIdx]?.spotlights ?? [];
  }, [
    spotlightsOverride,
    appMode,
    activeActivityId,
    activeActivityVersion,
    activeDemoTabIndex,
  ]);

  if (spotlights.length === 0) {
    return null;
  }

  const hasExecutionOrder = spotlights.includes('execution-order');
  const hasEgocentricPov = spotlights.includes('egocentric-pov');
  const hasWorldItem = spotlights.includes('world-item');
  const hasBackpack = spotlights.includes('backpack');
  const hasLoopCounter = spotlights.includes('loop-counter');

  const effectiveGrid =
    liveState && spotlightsOverride === undefined ? liveState.grid : grid;
  const { robot } = effectiveGrid;
  const cx = robot.x * cellSize + cellSize / 2;
  const cy = robot.y * cellSize + cellSize / 2;
  const rotationDeg = getDirectionRotationDeg(robot.dir);
  const { leftDir, rightDir } = getEgocentricSideDirections(robot.dir);

  // Resolve active and next-pending block in MAIN (or active callStack scope)
  const topFrame =
    runtime && runtime.callStack.length > 0
      ? runtime.callStack[runtime.callStack.length - 1]
      : null;
  const currentScope = topFrame?.scope ?? runtime?.activeScope ?? 'MAIN';
  const scopeBlocks: CodeBlock[] = workspace?.[currentScope] ?? [];
  const totalBlocks = scopeBlocks.length;

  const activeBlockIndex = runtime?.activeBlockId
    ? scopeBlocks.findIndex((b) => b.id === runtime.activeBlockId)
    : -1;
  const activeBlock = activeBlockIndex >= 0 ? scopeBlocks[activeBlockIndex] : null;

  const pendingBlockIndex =
    runtime === null
      ? 0
      : topFrame && topFrame.pc >= 0 && topFrame.pc < scopeBlocks.length
      ? topFrame.pc
      : -1;
  const pendingBlock = pendingBlockIndex >= 0 ? scopeBlocks[pendingBlockIndex] : null;

  // Prefer emphasizing the next pending action when paused between steps, or active block on initial/final tick
  const cueBlock = pendingBlock ?? activeBlock;
  const isLeftTurnEmphasized = cueBlock?.type === 'TURN_LEFT';
  const isRightTurnEmphasized = cueBlock?.type === 'TURN_RIGHT';

  const displayedStepNumber =
    activeBlockIndex >= 0
      ? activeBlockIndex + 1
      : pendingBlockIndex >= 0
      ? pendingBlockIndex + 1
      : totalBlocks > 0
      ? totalBlocks
      : 1;

  // Target cell preview for execution-order when moving forward/backward
  const motionBlock = effectiveGrid.status === 'SUCCESS' ? null : cueBlock;
  const motionDelta = motionBlock ? getMotionDelta(robot.dir, motionBlock.type) : null;
  const targetCell =
    motionDelta &&
    robot.x + motionDelta.dx >= 0 &&
    robot.x + motionDelta.dx < effectiveGrid.width &&
    robot.y + motionDelta.dy >= 0 &&
    robot.y + motionDelta.dy < effectiveGrid.height
      ? {
          x: robot.x + motionDelta.dx,
          y: robot.y + motionDelta.dy,
        }
      : null;

  // Forward-compatible loop counter state (C16)
  const topLoop =
    runtime && runtime.loopStack.length > 0
      ? runtime.loopStack[runtime.loopStack.length - 1]
      : null;
  const firstLoopBlock = scopeBlocks.find((b) => b.type === 'LOOP_START');
  const fallbackRepeatTotal =
    typeof firstLoopBlock?.repeatCount === 'number' ? firstLoopBlock.repeatCount : 0;
  const loopTotal: number =
    topLoop?.totalIterations ??
    runtime?.activeRepeatProgress?.total ??
    fallbackRepeatTotal;
  const loopCurrent: number =
    topLoop?.currentIteration ??
    runtime?.activeRepeatProgress?.current ??
    0;

  // Forward-compatible backpack state (C14 / C15)
  const rawCarried = (robot as unknown as { carriedItem?: unknown }).carriedItem;
  const carriedKind =
    rawCarried && typeof rawCarried === 'object' && 'type' in (rawCarried as object)
      ? String((rawCarried as { type: unknown }).type)
      : typeof rawCarried === 'string'
      ? rawCarried
      : null;
  const carriedIcon =
    carriedKind === 'key'
      ? '🔑'
      : carriedKind === 'plank'
      ? '🪵'
      : carriedKind === 'crate'
      ? '📦'
      : carriedKind
      ? '🎒'
      : '·';

  const worldHighlights = hasWorldItem ? collectWorldItemHighlights(effectiveGrid) : [];

  return (
    <g
      data-testid="demo-spotlight-overlay"
      data-spotlights={spotlights.join(',')}
      className="pointer-events-none"
    >
      {/* Forward-Compatible World Item Highlights (Wave 4 C15) */}
      {hasWorldItem && (
        <g
          data-testid="spotlight-world-item"
          data-item-count={worldHighlights.length}
          className="pointer-events-none"
        >
          {worldHighlights.map((item) => {
            const ix = item.x * cellSize + cellSize / 2;
            const iy = item.y * cellSize + cellSize / 2;
            return (
              <g key={item.key} transform={`translate(${ix}, ${iy})`}>
                <circle
                  r={cellSize * 0.38}
                  fill="none"
                  stroke="#facc15"
                  strokeWidth={2.5}
                  strokeDasharray="5 3"
                  opacity={0.85}
                />
              </g>
            );
          })}
        </g>
      )}

      {/* Sequential Execution-Order Target & Step Pill */}
      {hasExecutionOrder && (
        <g
          data-testid="spotlight-execution-order"
          data-step-number={displayedStepNumber}
          data-total-steps={totalBlocks}
          className="pointer-events-none"
        >
          {targetCell && (
            <g
              data-testid="spotlight-motion-target"
              data-target-x={targetCell.x}
              data-target-y={targetCell.y}
            >
              <line
                x1={cx}
                y1={cy}
                x2={targetCell.x * cellSize + cellSize / 2}
                y2={targetCell.y * cellSize + cellSize / 2}
                stroke="#38bdf8"
                strokeWidth={3}
                strokeDasharray="5 4"
                strokeLinecap="round"
                opacity={0.75}
              />
              <circle
                cx={targetCell.x * cellSize + cellSize / 2}
                cy={targetCell.y * cellSize + cellSize / 2}
                r={12}
                fill="rgba(56, 189, 248, 0.16)"
                stroke="#38bdf8"
                strokeWidth={2}
                strokeDasharray="4 3"
              />
            </g>
          )}

          {/* Subtle Execution Pulse Ring + Step Number Pill on Robot */}
          <g
            transform={`translate(${cx}, ${cy})`}
            className={isInstant ? '' : 'transition-all duration-300 ease-out'}
          >
            <circle
              r={27}
              fill="none"
              stroke={effectiveGrid.status === 'SUCCESS' ? '#34d399' : '#38bdf8'}
              strokeWidth={2}
              strokeDasharray="6 4"
              opacity={0.75}
            />
            {totalBlocks > 0 && (
              <g
                data-testid="spotlight-step-pill"
                transform="translate(-26, -26)"
              >
                <rect
                  x={-15}
                  y={-10}
                  width={30}
                  height={20}
                  rx={10}
                  fill={effectiveGrid.status === 'SUCCESS' ? '#065f46' : '#0f172a'}
                  stroke={effectiveGrid.status === 'SUCCESS' ? '#34d399' : '#38bdf8'}
                  strokeWidth={2}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={10}
                  fontWeight={900}
                  fill="#f8fafc"
                >
                  {effectiveGrid.status === 'SUCCESS'
                    ? '✓'
                    : `${displayedStepNumber}/${totalBlocks}`}
                </text>
              </g>
            )}
          </g>
        </g>
      )}

      {/* Egocentric Robot Point-of-View Cone & Color-Blind Safe L/R Wings */}
      {hasEgocentricPov && (
        <g
          data-testid="spotlight-egocentric-pov"
          data-robot-dir={robot.dir}
          data-rotation-deg={rotationDeg}
          data-left-world-dir={leftDir}
          data-right-world-dir={rightDir}
          transform={`translate(${cx}, ${cy})`}
          className={`pointer-events-none ${
            isInstant ? '' : 'transition-all duration-300 ease-out'
          }`}
        >
          <g
            data-testid="pov-rotated-rig"
            transform={`rotate(${rotationDeg})`}
            className={isInstant ? '' : 'transition-transform duration-300 ease-out'}
          >
            {/* Forward Eye-Heading Vision Cone */}
            <polygon
              data-testid="pov-heading-cone"
              points="-6,-16 -24,-54 24,-54 6,-16"
              fill="rgba(56, 189, 248, 0.22)"
              stroke="#7dd3fc"
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
            {/* Forward Sightline Chevron inside Vision Cone */}
            <polyline
              points="-7,-38 0,-47 7,-38"
              fill="none"
              stroke="#e0f2fe"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Robot's LEFT Wing: Solid Cyan Curve + Circle Badge (●) */}
            <g
              data-testid="pov-left-wing"
              data-marker-shape="circle"
              data-stroke-style="solid"
              data-emphasized={isLeftTurnEmphasized ? 'true' : 'false'}
              opacity={isLeftTurnEmphasized ? 1 : 0.86}
            >
              <path
                d="M -15 -14 Q -33 -14 -33 2"
                fill="none"
                stroke="#38bdf8"
                strokeWidth={isLeftTurnEmphasized ? 3.5 : 2.25}
                strokeLinecap="round"
              />
              <polygon points="-33,6 -38,-1 -28,-1" fill="#38bdf8" />
              <g transform="translate(-35, 16)">
                <circle
                  r={isLeftTurnEmphasized ? 10.5 : 9}
                  fill="#0c4a6e"
                  stroke="#38bdf8"
                  strokeWidth={isLeftTurnEmphasized ? 2.5 : 1.75}
                />
                {/* Counter-rotate text so L stays upright even when facing SOUTH (180°) */}
                <g transform={`rotate(${-rotationDeg})`}>
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={10}
                    fontWeight={900}
                    fill="#e0f2fe"
                  >
                    L
                  </text>
                </g>
              </g>
            </g>

            {/* Robot's RIGHT Wing: Dashed Amber Curve + Diamond Badge (◆) */}
            <g
              data-testid="pov-right-wing"
              data-marker-shape="diamond"
              data-stroke-style="dashed"
              data-emphasized={isRightTurnEmphasized ? 'true' : 'false'}
              opacity={isRightTurnEmphasized ? 1 : 0.86}
            >
              <path
                d="M 15 -14 Q 33 -14 33 2"
                fill="none"
                stroke="#fbbf24"
                strokeWidth={isRightTurnEmphasized ? 3.5 : 2.25}
                strokeDasharray="4 2"
                strokeLinecap="round"
              />
              <polygon points="33,6 28,-1 38,-1" fill="#fbbf24" />
              <g transform="translate(35, 16)">
                <polygon
                  points={
                    isRightTurnEmphasized
                      ? '0,-11.5 11.5,0 0,11.5 -11.5,0'
                      : '0,-9.5 9.5,0 0,9.5 -9.5,0'
                  }
                  fill="#451a03"
                  stroke="#fbbf24"
                  strokeWidth={isRightTurnEmphasized ? 2.5 : 1.75}
                />
                {/* Counter-rotate text so R stays upright at every heading */}
                <g transform={`rotate(${-rotationDeg})`}>
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={10}
                    fontWeight={900}
                    fill="#fef3c7"
                  >
                    R
                  </text>
                </g>
              </g>
            </g>
          </g>
        </g>
      )}

      {/* Forward-Compatible 1-Slot Backpack Spotlight (Wave 4 C15) */}
      {hasBackpack && (
        <g
          data-testid="spotlight-backpack"
          data-carried-item={carriedKind ?? 'empty'}
          transform={`translate(${cx + 26}, ${cy - 26})`}
          className="pointer-events-none"
        >
          <rect
            x={-13}
            y={-11}
            width={26}
            height={22}
            rx={7}
            fill="#1e293b"
            stroke={carriedKind ? '#fbbf24' : '#64748b'}
            strokeWidth={2}
            strokeDasharray={carriedKind ? undefined : '3 2'}
          />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={11}
            fontWeight={800}
            fill="#f8fafc"
          >
            {carriedIcon}
          </text>
        </g>
      )}

      {/* Forward-Compatible Loop Iteration Counter Spotlight (Wave 4 C16) */}
      {hasLoopCounter && loopTotal > 0 && (
        <g
          data-testid="spotlight-loop-counter"
          data-iteration={loopCurrent}
          data-total={loopTotal}
          transform={`translate(${cx + 24}, ${cy - 26})`}
          className="pointer-events-none"
        >
          <rect
            x={-20}
            y={-10}
            width={40}
            height={20}
            rx={10}
            fill="#312e81"
            stroke="#a5b4fc"
            strokeWidth={2}
          />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={10}
            fontWeight={900}
            fill="#eef2ff"
          >
            {`↻${loopCurrent}/${loopTotal}`}
          </text>
        </g>
      )}
    </g>
  );
};
