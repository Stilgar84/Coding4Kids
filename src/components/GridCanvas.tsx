import React, { useState, useEffect, useRef } from 'react';
import { useAppStoreSelector, isLowQualityActive } from '../store/useAppStore';
import { WallEdge, Direction, WorldItem, GridState } from '../types';
import { Trophy, Footprints, Maximize2, Minimize2, Eye } from 'lucide-react';
import { GridOverlayLayer } from '../simulations/grid/components/GridOverlayLayer';
import { FlagPadlockOverlay } from '../simulations/grid/components/FlagPadlockOverlay';
import { GhostStepOverlay } from '../simulations/grid/components/GhostStepOverlay';
import { DemoSpotlightOverlay } from '../simulations/grid/components/DemoSpotlightOverlay';
import {
  WorldItemsLayer,
  KEY_GATE_VISUALS,
  ShapeEmblemSvg,
} from '../simulations/grid/components/WorldItemsLayer';
import { BeaconAndDialLayer } from '../simulations/grid/components/BeaconAndDialLayer';
import { SimulationTopLeftHud } from './SimulationTopLeftHud';
import { resolveActiveCurriculumActivity } from '../utils/curriculumStagePolicy';
import {
  SensorBeamGridOverlay,
  extractConditionSensors,
  resolveActiveConditionalBlock,
} from '../simulations/grid/components/SensorAndBranchSpotlight';
import {
  evaluateGridSensor,
  hasAheadBridgedPlank,
  resolveBeaconColorHex,
  resolveTileColorIdx,
} from '../simulations/grid/sensors';
import {
  DIR_DELTAS,
  hasInteractiveWorldElements,
  resolveKeyGateColor,
  resolveKeyGateShape,
} from '../engine/physics';

const CELL_SIZE = 72; // pixels per cell

const ROBOT_FEEDBACK_CSS = `
@keyframes robotGripperWiggle {
  0%, 100% { transform: translate(15px, -16px) rotate(0deg); }
  22% { transform: translate(11px, -17px) rotate(-14deg); }
  48% { transform: translate(19px, -15px) rotate(14deg); }
  74% { transform: translate(13px, -17px) rotate(-8deg); }
}
@keyframes robotPlankReachLift {
  0% { transform: translate(0px, -46px) scale(0.95); opacity: 0.95; }
  60% { transform: translate(8px, -24px) scale(1.06); opacity: 1; }
  100% { transform: translate(15px, -16px) scale(1); opacity: 0; }
}
@keyframes robotWrongKeyFlash {
  0% { transform: scale(0.65); opacity: 1; }
  55% { transform: scale(1.12); opacity: 1; }
  100% { transform: scale(1); opacity: 0; }
}
@keyframes robotReverseDust {
  0% { transform: scale(0.6); opacity: 0.82; }
  100% { transform: scale(1.35); opacity: 0; }
}
.robot-gripper-wiggle {
  animation: robotGripperWiggle 360ms ease-in-out;
}
.robot-plank-lift-fx {
  animation: robotPlankReachLift 420ms ease-out forwards;
}
.robot-wrong-key-fx {
  transform-box: fill-box;
  transform-origin: center;
  animation: robotWrongKeyFlash 440ms ease-out forwards;
}
.robot-reverse-dust-fx {
  transform-box: fill-box;
  transform-origin: center;
  animation: robotReverseDust 380ms ease-out forwards;
}
@media (prefers-reduced-motion: reduce) {
  .robot-gripper-wiggle,
  .robot-plank-lift-fx,
  .robot-wrong-key-fx,
  .robot-reverse-dust-fx {
    animation-duration: 1ms;
  }
}
`;

export interface RobotShoulderCarryProps {
  carriedItem: WorldItem | null | undefined;
  carriedCount: number;
  robotAngleDeg: number;
  showEmptyClamp?: boolean;
  isWiggling?: boolean;
  isWrongKey?: boolean;
}

/**
 * Renders the robot's upper-right shoulder gripper clamp and carried Key/Plank/Crate.
 * Anchored at `translate(15, -16)` in chassis space and counter-rotated by `-robotAngleDeg`
 * so the carried item remains 0-deg screen-upright across N/E/S/W headings.
 */
export const RobotShoulderCarry: React.FC<RobotShoulderCarryProps> = ({
  carriedItem,
  carriedCount,
  robotAngleDeg,
  showEmptyClamp = false,
  isWiggling = false,
  isWrongKey = false,
}) => {
  if (!carriedItem && !showEmptyClamp) {
    return null;
  }

  const keyShape = carriedItem?.type === 'key' ? resolveKeyGateShape(carriedItem.shape) : undefined;
  const keyColor =
    carriedItem?.type === 'key' ? resolveKeyGateColor(carriedItem.color, keyShape) : undefined;
  const keyVis = keyColor ? KEY_GATE_VISUALS[keyColor] : undefined;

  return (
    <g
      data-testid="robot-shoulder-carry"
      data-carried-item={carriedItem?.type ?? 'empty'}
      data-carried-count={carriedItem ? carriedCount : 0}
      data-upright-deg={-robotAngleDeg}
      transform="translate(15, -16)"
      className={isWiggling ? 'robot-gripper-wiggle' : undefined}
    >
      {/* Articulated shoulder bracket connecting chassis rim to pincer */}
      <path
        d="M -5 5 L 0 0"
        stroke="#0f172a"
        strokeWidth={4.5}
        strokeLinecap="round"
      />
      <path
        d="M -5 5 L 0 0"
        stroke="#94a3b8"
        strokeWidth={2}
        strokeLinecap="round"
      />

      {/* Left/Right robotic gripper jaws */}
      <path
        d={carriedItem ? 'M -7 -3 Q -10 1 -6 6' : 'M -5 -2 Q -7 1 -4 4'}
        fill="none"
        stroke={isWrongKey ? '#ef4444' : '#cbd5e1'}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <path
        d={carriedItem ? 'M 7 -3 Q 10 1 6 6' : 'M 5 -2 Q 7 1 4 4'}
        fill="none"
        stroke={isWrongKey ? '#ef4444' : '#cbd5e1'}
        strokeWidth={2.2}
        strokeLinecap="round"
      />

      {/* Counter-rotated upright item held inside gripper jaws */}
      {carriedItem && (
        <g
          data-testid="robot-shoulder-upright"
          transform={`rotate(${-robotAngleDeg})`}
        >
          {/* 2px dark #0f172a outline cushion */}
          <circle
            r={10.5}
            fill="#0f172a"
            fillOpacity={0.92}
            stroke={isWrongKey ? '#ef4444' : '#0f172a'}
            strokeWidth={2}
          />

          {carriedItem.type === 'key' && keyShape && keyVis && (
            <g data-carried-shape={keyShape} data-carried-color={keyColor}>
              {/* Mini key shaft + teeth */}
              <line
                x1={0}
                y1={-1}
                x2={6.5}
                y2={5.5}
                stroke="#0f172a"
                strokeWidth={4}
                strokeLinecap="round"
              />
              <line
                x1={0}
                y1={-1}
                x2={6.5}
                y2={5.5}
                stroke={keyVis.stroke}
                strokeWidth={2}
                strokeLinecap="round"
              />
              <ShapeEmblemSvg
                shape={keyShape}
                radius={6.5}
                fill={keyVis.fill}
                stroke={keyVis.stroke}
                strokeWidth={1.8}
              />
            </g>
          )}

          {carriedItem.type === 'plank' && (
            <g>
              <rect
                x={-11}
                y={-4.5}
                width={22}
                height={9}
                rx={2.5}
                fill="#d97706"
                stroke="#0f172a"
                strokeWidth={2}
              />
              <rect
                x={-9.5}
                y={-3}
                width={19}
                height={6}
                rx={1.5}
                fill="#f59e0b"
                stroke="#fde68a"
                strokeWidth={0.9}
              />
              <circle cx={-6.5} cy={0} r={1} fill="#451a03" />
              <circle cx={6.5} cy={0} r={1} fill="#451a03" />
            </g>
          )}

          {carriedItem.type === 'crate' && (
            <g>
              <rect
                x={-8.5}
                y={-8.5}
                width={17}
                height={17}
                rx={2.5}
                fill="#b45309"
                stroke="#0f172a"
                strokeWidth={2}
              />
              <rect
                x={-6.8}
                y={-6.8}
                width={13.6}
                height={13.6}
                rx={1.6}
                fill="#d97706"
                stroke="#fde68a"
                strokeWidth={1}
              />
              <line x1={-5.2} y1={-5.2} x2={5.2} y2={5.2} stroke="#78350f" strokeWidth={1.6} strokeLinecap="round" />
              <line x1={5.2} y1={-5.2} x2={-5.2} y2={5.2} stroke="#78350f" strokeWidth={1.6} strokeLinecap="round" />
            </g>
          )}

          {carriedCount > 1 && (
            <g transform="translate(8, 8)">
              <rect x={-7} y={-5.5} width={14} height={11} rx={4} fill="#0284c7" stroke="#0f172a" strokeWidth={1.6} />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={7.5}
                fontWeight={900}
                fill="#ffffff"
              >
                ×{carriedCount}
              </text>
            </g>
          )}
        </g>
      )}
    </g>
  );
};

interface GridStaticBoardLayerProps {
  width: number;
  height: number;
  barriers: WallEdge[];
  isReadOnly: boolean;
  isLowQuality: boolean;
  setCellContent: (x: number, y: number) => void;
  handleCellMouseDown: (x: number, y: number) => void;
  handleCellMouseEnter: (x: number, y: number, e: React.MouseEvent) => void;
  handleEdgeMouseDown: (edge: WallEdge, e: React.MouseEvent) => void;
  handleEdgeMouseEnter: (edge: WallEdge, e: React.MouseEvent) => void;
  handleEdgeClick: (edge: WallEdge, e: React.MouseEvent) => void;
}

const GridStaticBoardLayer = React.memo<GridStaticBoardLayerProps>(
  ({
    width,
    height,
    barriers,
    isReadOnly,
    isLowQuality,
    setCellContent,
    handleCellMouseDown,
    handleCellMouseEnter,
    handleEdgeMouseDown,
    handleEdgeMouseEnter,
    handleEdgeClick,
  }) => {
    const wallShadowClass = isLowQuality ? '' : 'filter drop-shadow-[0_0_8px_rgba(239,68,68,0.8)] ';
    return (
      <>
        {/* Grid Background cells */}
        {Array.from({ length: height }).map((_, y) =>
          Array.from({ length: width }).map((_, x) => (
            <rect
              key={`cell-${x}-${y}`}
              data-testid={`cell-${x}-${y}`}
              x={x * CELL_SIZE}
              y={y * CELL_SIZE}
              width={CELL_SIZE}
              height={CELL_SIZE}
              fill={(x + y) % 2 === 0 ? '#1e293b' : '#0f172a'}
              stroke="#334155"
              strokeWidth={1}
              className={
                isReadOnly
                  ? undefined
                  : 'cursor-pointer transition-colors hover:fill-slate-700/50'
              }
              onClick={isReadOnly ? undefined : () => setCellContent(x, y)}
              onMouseDown={isReadOnly ? undefined : () => handleCellMouseDown(x, y)}
              onMouseEnter={isReadOnly ? undefined : (e) => handleCellMouseEnter(x, y, e)}
            />
          ))
        )}

        {/* Horizontal Barrier Wall Hitboxes & Lines */}
        {Array.from({ length: height - 1 }).map((_, row) =>
          Array.from({ length: width }).map((_, col) => {
            const y = row + 1;
            const hasWall = barriers.some(
              (b) => b.orientation === 'H' && b.x === col && b.y === y
            );
            if (isReadOnly && !hasWall) return null;
            return (
              <g key={`h-wall-${col}-${y}`}>
                {!isReadOnly && (
                  <rect
                    data-testid={`wall-h-hitbox-${col}-${y}`}
                    x={col * CELL_SIZE}
                    y={y * CELL_SIZE - 14}
                    width={CELL_SIZE}
                    height={28}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseDown={(e) => handleEdgeMouseDown({ orientation: 'H', x: col, y }, e)}
                    onMouseEnter={(e) => handleEdgeMouseEnter({ orientation: 'H', x: col, y }, e)}
                    onClick={(e) => handleEdgeClick({ orientation: 'H', x: col, y }, e)}
                  />
                )}
                {hasWall && (
                  <rect
                    data-testid={`wall-h-${col}-${y}`}
                    x={col * CELL_SIZE + 2}
                    y={y * CELL_SIZE - 4}
                    width={CELL_SIZE - 4}
                    height={8}
                    rx={4}
                    fill="#ef4444"
                    className={`${wallShadowClass}${
                      isReadOnly ? 'pointer-events-none' : 'cursor-pointer'
                    }`}
                    onMouseDown={
                      isReadOnly
                        ? undefined
                        : (e) => handleEdgeMouseDown({ orientation: 'H', x: col, y }, e)
                    }
                    onMouseEnter={
                      isReadOnly
                        ? undefined
                        : (e) => handleEdgeMouseEnter({ orientation: 'H', x: col, y }, e)
                    }
                    onClick={
                      isReadOnly
                        ? undefined
                        : (e) => handleEdgeClick({ orientation: 'H', x: col, y }, e)
                    }
                  />
                )}
              </g>
            );
          })
        )}

        {/* Vertical Barrier Wall Hitboxes & Lines */}
        {Array.from({ length: height }).map((_, row) =>
          Array.from({ length: width - 1 }).map((_, col) => {
            const x = col + 1;
            const hasWall = barriers.some(
              (b) => b.orientation === 'V' && b.x === x && b.y === row
            );
            if (isReadOnly && !hasWall) return null;
            return (
              <g key={`v-wall-${x}-${row}`}>
                {!isReadOnly && (
                  <rect
                    data-testid={`wall-v-hitbox-${x}-${row}`}
                    x={x * CELL_SIZE - 14}
                    y={row * CELL_SIZE}
                    width={28}
                    height={CELL_SIZE}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseDown={(e) => handleEdgeMouseDown({ orientation: 'V', x, y: row }, e)}
                    onMouseEnter={(e) => handleEdgeMouseEnter({ orientation: 'V', x, y: row }, e)}
                    onClick={(e) => handleEdgeClick({ orientation: 'V', x, y: row }, e)}
                  />
                )}
                {hasWall && (
                  <rect
                    data-testid={`wall-v-${x}-${row}`}
                    x={x * CELL_SIZE - 4}
                    y={row * CELL_SIZE + 2}
                    width={8}
                    height={CELL_SIZE - 4}
                    rx={4}
                    fill="#ef4444"
                    className={`${wallShadowClass}${
                      isReadOnly ? 'pointer-events-none' : 'cursor-pointer'
                    }`}
                    onMouseDown={
                      isReadOnly
                        ? undefined
                        : (e) => handleEdgeMouseDown({ orientation: 'V', x, y: row }, e)
                    }
                    onMouseEnter={
                      isReadOnly
                        ? undefined
                        : (e) => handleEdgeMouseEnter({ orientation: 'V', x, y: row }, e)
                    }
                    onClick={
                      isReadOnly
                        ? undefined
                        : (e) => handleEdgeClick({ orientation: 'V', x, y: row }, e)
                    }
                  />
                )}
              </g>
            );
          })
        )}
      </>
    );
  },
  (prev, next) => {
    if (
      prev.width !== next.width ||
      prev.height !== next.height ||
      prev.barriers !== next.barriers ||
      prev.isReadOnly !== next.isReadOnly ||
      prev.isLowQuality !== next.isLowQuality
    ) {
      return false;
    }
    // In read-only mode (curriculum / running playback), handlers are unused.
    if (next.isReadOnly) return true;
    return (
      prev.setCellContent === next.setCellContent &&
      prev.handleCellMouseDown === next.handleCellMouseDown &&
      prev.handleCellMouseEnter === next.handleCellMouseEnter &&
      prev.handleEdgeMouseDown === next.handleEdgeMouseDown &&
      prev.handleEdgeMouseEnter === next.handleEdgeMouseEnter &&
      prev.handleEdgeClick === next.handleEdgeClick
    );
  }
);

export const GridCanvas: React.FC<{ state?: GridState }> = ({ state: propGrid }) => {
  const {
    appMode,
    storeGrid,
    runtime,
    workspace,
    activeActivityId,
    activeActivityVersion,
    activeDemoTabIndex,
    toggleWall,
    addWall,
    resizeBoard,
    setCellContent,
    toggleTrace,
    toggleFitToView,
    editorTool,
    speed,
    startHistoryBatch,
    endHistoryBatch,
    isLowQuality,
    hasMultiVariant,
  } = useAppStoreSelector((s) => ({
    appMode: s.appMode,
    storeGrid: s.grid,
    runtime: s.runtime,
    workspace: s.workspace,
    activeActivityId: s.activeActivityId,
    activeActivityVersion: s.activeActivityVersion,
    activeDemoTabIndex: s.activeDemoTabIndex,
    toggleWall: s.toggleWall,
    addWall: s.addWall,
    resizeBoard: s.resizeBoard,
    setCellContent: s.setCellContent,
    toggleTrace: s.toggleTrace,
    toggleFitToView: s.toggleFitToView,
    editorTool: s.editorTool,
    speed: s.speed,
    startHistoryBatch: s.startHistoryBatch,
    endHistoryBatch: s.endHistoryBatch,
    isLowQuality: isLowQualityActive(s),
    hasMultiVariant: s.variantRuns.length > 1,
  }));
  const grid = propGrid || storeGrid;

  const isReadOnly = appMode === 'curriculum';
  const isInstant = speed === 'instant' || (speed as any) === 0;
  const activeActivity = resolveActiveCurriculumActivity(
    appMode,
    activeActivityId,
    activeActivityVersion
  );
  const hasDemoSensorBeamSpotlight = Boolean(
    appMode === 'curriculum' &&
      activeActivity?.format === 'explanation' &&
      activeActivity.demoTabs?.length &&
      activeActivity.demoTabs[
        Math.min(Math.max(0, activeDemoTabIndex), activeActivity.demoTabs.length - 1)
      ]?.spotlights?.includes('sensor-beam')
  );
  const cueCondBlock = resolveActiveConditionalBlock(runtime, workspace);
  const activeCondRefs = cueCondBlock
    ? extractConditionSensors(
        cueCondBlock.params?.condition,
        cueCondBlock.params?.sensor as string | undefined,
        cueCondBlock.params?.param as string | undefined
      )
    : [];
  const allWorkspaceSensorRefs = (['MAIN', 'F1', 'F2', 'F3'] as const).flatMap((sc) =>
    (workspace?.[sc] ?? []).flatMap((b) =>
      b.type === 'IF' || b.type === 'ELSE_IF' || b.type === 'WHILE'
        ? extractConditionSensors(
            b.params?.condition,
            b.params?.sensor as string | undefined,
            b.params?.param as string | undefined
          )
        : []
    )
  );
  const robotSensors = activeCondRefs.length > 0 ? activeCondRefs : allWorkspaceSensorRefs;
  const hasSensorAhead = robotSensors.some(
    (r) => r.sensor === 'pathAhead' || r.sensor === 'unvisitedAhead'
  );
  const hasSensorLeft = robotSensors.some((r) => r.sensor === 'pathLeft');
  const hasSensorRight = robotSensors.some((r) => r.sensor === 'pathRight');
  const hasSensorItemHere = robotSensors.some((r) => r.sensor === 'itemHere');
  const tileColorSensorRef = robotSensors.find((r) => r.sensor === 'tileColor');
  const aheadOpen = hasSensorAhead ? evaluateGridSensor('pathAhead', grid) : false;
  const leftOpen = hasSensorLeft ? evaluateGridSensor('pathLeft', grid) : false;
  const rightOpen = hasSensorRight ? evaluateGridSensor('pathRight', grid) : false;
  const hasFloorItemAtRobot = (grid.worldItems ?? []).some(
    (it) => it.x === grid.robot.x && it.y === grid.robot.y
  );
  const showAheadPlankScanBeam =
    hasSensorItemHere && !hasFloorItemAtRobot && hasAheadBridgedPlank(grid);
  const tileColorTargetHex = tileColorSensorRef
    ? resolveBeaconColorHex(resolveTileColorIdx('tileColor', tileColorSensorRef.param)) ?? '#38bdf8'
    : null;
  const tileColorMatched = tileColorSensorRef
    ? evaluateGridSensor('tileColor', grid, tileColorSensorRef.param)
    : false;
  const robotBeaconHere = tileColorSensorRef
    ? (grid.beaconTiles ?? []).find(
        (b) => b.x === grid.robot.x && b.y === grid.robot.y
      )
    : undefined;

  // Track short-lived robot micro-feedback animations (plank 1-ahead lift, hands-full wiggle, wrong-key X, reverse dust)
  const EMPTY_MICRO_FX = {
    plankLift: false,
    handsFull: false,
    wrongKeyCell: null as { x: number; y: number } | null,
    reverseDustCell: null as { x: number; y: number } | null,
  };
  const prevGridRef = useRef<GridState | null>(null);
  const microFxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [microFx, setMicroFx] = useState(EMPTY_MICRO_FX);

  useEffect(() => {
    return () => {
      if (microFxTimerRef.current !== null) {
        clearTimeout(microFxTimerRef.current);
        microFxTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const prev = prevGridRef.current;
    prevGridRef.current = grid;

    const isCleanReset =
      grid.status === 'IDLE' &&
      grid.trace.length <= 1 &&
      !grid.lastInteractionFeedback;

    if (!prev || isInstant || isLowQuality || isCleanReset) {
      if (microFxTimerRef.current !== null) {
        clearTimeout(microFxTimerRef.current);
        microFxTimerRef.current = null;
      }
      setMicroFx((curr) =>
        curr.plankLift || curr.handsFull || curr.wrongKeyCell || curr.reverseDustCell
          ? EMPTY_MICRO_FX
          : curr
      );
      return;
    }

    const prevBridged = prev.bridgedWaterCells ?? [];
    const nextBridged = grid.bridgedWaterCells ?? [];
    const plankLift =
      !prev.robot.carriedItem &&
      grid.robot.carriedItem?.type === 'plank' &&
      prevBridged.length > nextBridged.length;

    const prevSeq = prev.lastInteractionFeedback?.seq ?? 0;
    const nextFb = grid.lastInteractionFeedback;
    const isNewFb = Boolean(nextFb && nextFb.seq !== prevSeq);
    const handsFull = isNewFb && nextFb?.kind === 'noop-full';
    const wrongKey = isNewFb && nextFb?.kind === 'wrong-key';
    const d = DIR_DELTAS[grid.robot.dir];
    const wrongKeyCell = wrongKey
      ? { x: grid.robot.x + d.dx, y: grid.robot.y + d.dy }
      : null;

    const movedBack =
      grid.trace.length > prev.trace.length &&
      grid.robot.dir === prev.robot.dir &&
      grid.robot.x - prev.robot.x === -d.dx &&
      grid.robot.y - prev.robot.y === -d.dy;
    const reverseDustCell = movedBack ? { x: prev.robot.x, y: prev.robot.y } : null;

    if (!plankLift && !handsFull && !wrongKeyCell && !reverseDustCell) {
      return;
    }

    if (microFxTimerRef.current !== null) {
      clearTimeout(microFxTimerRef.current);
    }

    setMicroFx({
      plankLift,
      handsFull,
      wrongKeyCell,
      reverseDustCell,
    });

    microFxTimerRef.current = setTimeout(() => {
      microFxTimerRef.current = null;
      setMicroFx(EMPTY_MICRO_FX);
    }, 450);
  }, [grid, isInstant, isLowQuality]);

  const handleToggleFit = () => {
    setUserZoom(1);
    setPanOffset({ x: 0, y: 0 });
    toggleFitToView();
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      setUserZoom((prev) => Math.min(3.5, Math.max(0.4, prev * factor)));
    }
  };

  const { width, height, robot, barriers, flags, trace, status, showTrace, fitToView } = grid;
  const isBarrierMode = editorTool === 'WALL';
  const isFitToView = Boolean(fitToView);

  const svgWidth = width * CELL_SIZE;
  const svgHeight = height * CELL_SIZE;
  const boardBaseWidth = svgWidth + 24;
  const boardBaseHeight = svgHeight + 24;
  const CLEARANCE = 48; // Clearance for boundary resize handles and indicators
  const unscaledTotalWidth = boardBaseWidth + CLEARANCE;
  const unscaledTotalHeight = boardBaseHeight + CLEARANCE;

  // Viewport container measurement for fit-to-view calculation
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [userZoom, setUserZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  const pinchStartRef = useRef<{
    dist: number;
    zoom: number;
    centerX: number;
    centerY: number;
    panX: number;
    panY: number;
  } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const centerX = (t1.clientX + t2.clientX) / 2;
        const centerY = (t1.clientY + t2.clientY) / 2;
        pinchStartRef.current = {
          dist,
          zoom: userZoom,
          centerX,
          centerY,
          panX: panOffset.x,
          panY: panOffset.y,
        };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchStartRef.current) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const centerX = (t1.clientX + t2.clientX) / 2;
        const centerY = (t1.clientY + t2.clientY) / 2;

        const scaleChange = dist / pinchStartRef.current.dist;
        const nextZoom = Math.min(3.5, Math.max(0.4, pinchStartRef.current.zoom * scaleChange));
        setUserZoom(nextZoom);

        const dx = centerX - pinchStartRef.current.centerX;
        const dy = centerY - pinchStartRef.current.centerY;
        setPanOffset({
          x: pinchStartRef.current.panX + dx,
          y: pinchStartRef.current.panY + dy,
        });
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        pinchStartRef.current = null;
      }
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [userZoom, panOffset]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      setContainerSize({
        width: el.clientWidth,
        height: el.clientHeight,
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const availableWidth = Math.max(containerSize.width - 32, 100);
  const availableHeight = Math.max(containerSize.height - 32, 100);
  const computedScale = Math.min(
    availableWidth / unscaledTotalWidth,
    availableHeight / unscaledTotalHeight
  );
  const scale =
    containerSize.width > 0 && containerSize.height > 0
      ? Math.max(0.1, Math.min(2.0, computedScale))
      : 1;

  // Barrier drag drawing tracking
  const [isDrawingBarriers, setIsDrawingBarriers] = useState(false);
  const dragStartEdgeRef = useRef<WallEdge | null>(null);
  const hasMovedToOtherEdgesRef = useRef(false);
  const edgeExistedAtMouseDownRef = useRef(false);
  const lastCellRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const handleMouseUp = () => {
      setIsDrawingBarriers(false);
      dragStartEdgeRef.current = null;
      lastCellRef.current = null;
      endHistoryBatch();
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [endHistoryBatch]);

  // Handle clicking or dragging on an edge
  const handleEdgeMouseDown = (edge: WallEdge, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isBarrierMode) {
      startHistoryBatch('Draw walls');
      setIsDrawingBarriers(true);
      dragStartEdgeRef.current = edge;
      hasMovedToOtherEdgesRef.current = false;
      const exists = barriers.some(
        (b) => b.orientation === edge.orientation && b.x === edge.x && b.y === edge.y
      );
      edgeExistedAtMouseDownRef.current = exists;
      if (!exists) {
        addWall(edge);
      }
    }
  };

  const handleEdgeMouseEnter = (edge: WallEdge, e: React.MouseEvent) => {
    if (isBarrierMode && (isDrawingBarriers || e.buttons === 1)) {
      if (!isDrawingBarriers) {
        startHistoryBatch('Draw walls');
        setIsDrawingBarriers(true);
      }
      hasMovedToOtherEdgesRef.current = true;
      addWall(edge);
    }
  };

  const handleEdgeClick = (edge: WallEdge, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isBarrierMode) {
      // If user dragged over other edges, do not toggle off the initial edge
      if (hasMovedToOtherEdgesRef.current) {
        return;
      }
      // If edge existed at mousedown, stationary click toggles it off
      if (edgeExistedAtMouseDownRef.current) {
        toggleWall(edge);
      }
    } else {
      toggleWall(edge);
    }
  };

  // Cross-cell dragging to create barrier between adjacent cells
  const handleCellMouseDown = (x: number, y: number) => {
    lastCellRef.current = { x, y };
    if (isBarrierMode) {
      startHistoryBatch('Draw walls');
      setIsDrawingBarriers(true);
      hasMovedToOtherEdgesRef.current = false;
    }
  };

  const handleCellMouseEnter = (x: number, y: number, e: React.MouseEvent) => {
    if (isBarrierMode && (isDrawingBarriers || e.buttons === 1)) {
      if (lastCellRef.current) {
        const lx = lastCellRef.current.x;
        const ly = lastCellRef.current.y;
        if (x === lx + 1 && y === ly) {
          addWall({ orientation: 'V', x, y: ly });
          hasMovedToOtherEdgesRef.current = true;
        } else if (x === lx - 1 && y === ly) {
          addWall({ orientation: 'V', x: lx, y: ly });
          hasMovedToOtherEdgesRef.current = true;
        } else if (y === ly + 1 && x === lx) {
          addWall({ orientation: 'H', x: lx, y });
          hasMovedToOtherEdgesRef.current = true;
        } else if (y === ly - 1 && x === lx) {
          addWall({ orientation: 'H', x: lx, y: ly });
          hasMovedToOtherEdgesRef.current = true;
        }
      }
      lastCellRef.current = { x, y };
    }
  };

  // Drag resizing of board boundaries
  const startResizeDrag = (
    direction: 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT',
    e: React.PointerEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();
    startHistoryBatch('Resize board');
    const startX = e.clientX;
    const startY = e.clientY;
    let accumulatedDelta = 0;
    const currentScale = isFitToView ? scale : 1;
    const stepSize = CELL_SIZE * currentScale * 0.7;

    const onPointerMove = (moveEv: PointerEvent) => {
      moveEv.preventDefault();
      const dx = moveEv.clientX - startX;
      const dy = moveEv.clientY - startY;

      let currentStep = 0;
      if (direction === 'RIGHT') {
        currentStep = Math.trunc(dx / stepSize);
      } else if (direction === 'BOTTOM') {
        currentStep = Math.trunc(dy / stepSize);
      } else if (direction === 'LEFT') {
        currentStep = Math.trunc(-dx / stepSize);
      } else if (direction === 'TOP') {
        currentStep = Math.trunc(-dy / stepSize);
      }

      const diff = currentStep - accumulatedDelta;
      if (diff !== 0) {
        resizeBoard(direction, diff);
        accumulatedDelta = currentStep;
      }
    };

    const onPointerUp = (upEv: PointerEvent) => {
      upEv.preventDefault();
      endHistoryBatch();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  // Robot rotation angle
  const getAngle = (dir: Direction): number => {
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

  return (
    <div
      data-quality={isLowQuality ? 'low' : 'high'}
      className="relative w-full h-full overflow-hidden bg-slate-950/60 select-none"
    >
      {/* Top-Left Non-Overlapping HUD Stack: Runtime Variables */}
      <SimulationTopLeftHud variables={runtime?.variables} />

      {/* Simulation status banner if collision or victory (shifted down below MultiRunPipsBar when active) */}
      {status === 'COLLISION' && (
        <div
          data-testid="status-collision"
          className={`absolute ${hasMultiVariant ? 'top-14' : 'top-4'} left-1/2 -translate-x-1/2 z-20 px-6 py-2 bg-red-600/90 text-white rounded-full font-bold shadow-lg shadow-red-500/30 ${isLowQuality ? '' : 'animate-bounce '}flex items-center gap-2 pointer-events-none`}
        >
          <span className="text-xl">💥</span>
        </div>
      )}

      {status === 'SUCCESS' && (
        <div
          data-testid="status-success"
          className={`absolute ${hasMultiVariant ? 'top-14' : 'top-4'} left-1/2 -translate-x-1/2 z-20 px-6 py-2 bg-amber-500 text-slate-900 rounded-full font-extrabold shadow-lg shadow-amber-500/40 ${isLowQuality ? '' : 'animate-pulse '}flex items-center gap-2 pointer-events-none`}
        >
          <Trophy className="w-6 h-6" />
          <span className="text-xl">⭐ ⭐ ⭐</span>
        </div>
      )}

      {/* Scrollable Viewport Container for the Grid Map */}
      <div
        ref={containerRef}
        data-testid="grid-scroll-container"
        onWheel={handleWheel}
        className="w-full h-full overflow-auto flex touch-none"
      >
        <div
          data-testid="grid-fit-wrapper"
          className="m-auto shrink-0 flex items-center justify-center transition-all duration-200"
          style={
            isFitToView
              ? {
                  width: `${unscaledTotalWidth * scale}px`,
                  height: `${unscaledTotalHeight * scale}px`,
                  overflow: 'visible',
                }
              : {
                  padding: '2rem',
                }
          }
        >
          <div
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${
                (isFitToView ? scale : 1) * userZoom
              })`,
              transformOrigin: 'center center',
            }}
            className="shrink-0 transition-transform duration-200"
          >
            {/* SVG Grid Container with Boundary Drag Handles */}
            <div className="relative p-2 bg-slate-900 rounded-2xl border-4 border-slate-800 shadow-2xl">
        {/* Grid dimensions pill + Read-only indicator in Curriculum mode */}
        <div className="absolute -top-3.5 -right-3.5 z-30 flex items-center gap-1.5 select-none">
          {isReadOnly && (
            <div
              data-testid="grid-readonly-badge"
              aria-label="Read-only lesson map"
              title="Read-only lesson map — use Open Copy in Sandbox to edit"
              className="flex items-center justify-center w-6 h-6 bg-slate-800 border-2 border-sky-500/60 rounded-full text-sky-300 shadow-md"
            >
              <Eye className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="sr-only">Read-only lesson map</span>
            </div>
          )}
          <div
            data-testid="grid-size-indicator"
            className="px-2.5 py-0.5 bg-slate-800 border-2 border-slate-700 rounded-full text-[11px] font-black text-amber-300 shadow-md"
          >
            {width} × {height}
          </div>
        </div>

        {/* Boundary Resize Handles (Sandbox mode only) */}
        {!isReadOnly && (
          <>
            {/* Top Boundary Resize Handle */}
            <div
              data-testid="resize-handle-top"
              onPointerDown={(e) => startResizeDrag('TOP', e)}
              className="group absolute -top-4 left-6 right-6 h-6 cursor-ns-resize flex items-center justify-center z-30 select-none"
              title="Drag top boundary to resize board"
            >
              <div className="flex items-center gap-1 px-3 py-0.5 rounded-full bg-slate-800/90 border border-slate-600 group-hover:border-amber-400 group-hover:bg-slate-700 text-slate-400 group-hover:text-amber-300 shadow-md transition-colors">
                <span className="text-[10px] font-black">▲</span>
                <button
                  type="button"
                  data-testid="btn-resize-top-plus"
                  onClick={(e) => {
                    e.stopPropagation();
                    resizeBoard('TOP', 1);
                  }}
                  className="text-xs font-black hover:text-white px-0.5"
                  title="Add row at top"
                >
                  +
                </button>
                <span className="text-[10px] font-black">▼</span>
              </div>
            </div>

            {/* Bottom Boundary Resize Handle */}
            <div
              data-testid="resize-handle-bottom"
              onPointerDown={(e) => startResizeDrag('BOTTOM', e)}
              className="group absolute -bottom-4 left-6 right-6 h-6 cursor-ns-resize flex items-center justify-center z-30 select-none"
              title="Drag bottom boundary to resize board"
            >
              <div className="flex items-center gap-1 px-3 py-0.5 rounded-full bg-slate-800/90 border border-slate-600 group-hover:border-amber-400 group-hover:bg-slate-700 text-slate-400 group-hover:text-amber-300 shadow-md transition-colors">
                <span className="text-[10px] font-black">▲</span>
                <button
                  type="button"
                  data-testid="btn-resize-bottom-plus"
                  onClick={(e) => {
                    e.stopPropagation();
                    resizeBoard('BOTTOM', 1);
                  }}
                  className="text-xs font-black hover:text-white px-0.5"
                  title="Add row at bottom"
                >
                  +
                </button>
                <span className="text-[10px] font-black">▼</span>
              </div>
            </div>

            {/* Left Boundary Resize Handle */}
            <div
              data-testid="resize-handle-left"
              onPointerDown={(e) => startResizeDrag('LEFT', e)}
              className="group absolute -left-4 top-6 bottom-6 w-6 cursor-ew-resize flex items-center justify-center z-30 select-none"
              title="Drag left boundary to resize board"
            >
              <div className="flex flex-col items-center gap-0.5 py-2 px-1 rounded-full bg-slate-800/90 border border-slate-600 group-hover:border-amber-400 group-hover:bg-slate-700 text-slate-400 group-hover:text-amber-300 shadow-md transition-colors">
                <span className="text-[10px] font-black">◀</span>
                <button
                  type="button"
                  data-testid="btn-resize-left-plus"
                  onClick={(e) => {
                    e.stopPropagation();
                    resizeBoard('LEFT', 1);
                  }}
                  className="text-xs font-black hover:text-white py-0.5"
                  title="Add column at left"
                >
                  +
                </button>
                <span className="text-[10px] font-black">▶</span>
              </div>
            </div>

            {/* Right Boundary Resize Handle */}
            <div
              data-testid="resize-handle-right"
              onPointerDown={(e) => startResizeDrag('RIGHT', e)}
              className="group absolute -right-4 top-6 bottom-6 w-6 cursor-ew-resize flex items-center justify-center z-30 select-none"
              title="Drag right boundary to resize board"
            >
              <div className="flex flex-col items-center gap-0.5 py-2 px-1 rounded-full bg-slate-800/90 border border-slate-600 group-hover:border-amber-400 group-hover:bg-slate-700 text-slate-400 group-hover:text-amber-300 shadow-md transition-colors">
                <span className="text-[10px] font-black">◀</span>
                <button
                  type="button"
                  data-testid="btn-resize-right-plus"
                  onClick={(e) => {
                    e.stopPropagation();
                    resizeBoard('RIGHT', 1);
                  }}
                  className="text-xs font-black hover:text-white py-0.5"
                  title="Add column at right"
                >
                  +
                </button>
                <span className="text-[10px] font-black">▶</span>
              </div>
            </div>
          </>
        )}

        <svg
          data-testid="grid-canvas"
          width={svgWidth}
          height={svgHeight}
          className="overflow-visible block"
        >
          <GridStaticBoardLayer
            width={width}
            height={height}
            barriers={barriers}
            isReadOnly={isReadOnly}
            isLowQuality={isLowQuality}
            setCellContent={setCellContent}
            handleCellMouseDown={handleCellMouseDown}
            handleCellMouseEnter={handleCellMouseEnter}
            handleEdgeMouseDown={handleEdgeMouseDown}
            handleEdgeMouseEnter={handleEdgeMouseEnter}
            handleEdgeClick={handleEdgeClick}
          />

          {/* Pluggable Under-Robot Overlay Slot (Beacon & Dial C22, World Items C14) */}
          <GridOverlayLayer
            grid={grid}
            cellSize={CELL_SIZE}
            isInstant={isInstant}
            isReadOnly={isReadOnly}
            layer="under-robot"
            beaconAndDialSlot={<BeaconAndDialLayer grid={grid} cellSize={CELL_SIZE} />}
            worldItemsSlot={
              <WorldItemsLayer
                grid={grid}
                cellSize={CELL_SIZE}
                isInstant={isInstant}
              />
            }
          />

          {/* Trace Path Line */}
          {showTrace && trace.length > 1 && (
            <polyline
              data-testid="robot-trace"
              points={trace
                .map((pt) => `${pt.x * CELL_SIZE + CELL_SIZE / 2},${pt.y * CELL_SIZE + CELL_SIZE / 2}`)
                .join(' ')}
              fill="none"
              stroke="#38bdf8"
              strokeWidth={4}
              strokeDasharray="6 6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-80"
            />
          )}

          {/* Flags and Goals */}
          {flags.map((flag) => {
            const cx = flag.x * CELL_SIZE + CELL_SIZE / 2;
            const cy = flag.y * CELL_SIZE + CELL_SIZE / 2;
            return (
              <g
                key={flag.id}
                data-testid={flag.isGoal ? `goal-flag-${flag.x}-${flag.y}` : `flag-${flag.order}`}
                transform={`translate(${cx}, ${cy})`}
                className={`pointer-events-none ${isInstant || isLowQuality ? '' : 'transition-transform duration-300'}`}
              >
                {flag.isGoal ? (
                  <g
                    className={
                      flag.collected &&
                      (status === 'SUCCESS' || (robot.x === flag.x && robot.y === flag.y))
                        ? 'scale-125 opacity-90'
                        : isInstant || isLowQuality
                        ? ''
                        : 'animate-pulse'
                    }
                  >
                    <circle r={22} fill="#eab308" className={isLowQuality ? undefined : 'shadow-lg'} />
                    <circle r={18} fill="#ca8a04" />
                    <foreignObject x={-14} y={-14} width={28} height={28}>
                      <div className="flex items-center justify-center w-full h-full text-slate-950 font-black">
                        🏁
                      </div>
                    </foreignObject>
                  </g>
                ) : (
                  <g className={flag.collected ? 'opacity-30 scale-75' : 'scale-100'}>
                    <circle
                      r={18}
                      fill={flag.collected ? '#64748b' : '#3b82f6'}
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                    {flag.order > 0 ? (
                      <text
                        y={5}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize={16}
                        fontWeight="bold"
                      >
                        {flag.order}
                      </text>
                    ) : (
                      /* Unordered waypoint (order === 0): crisp white pennant instead of digit 0 */
                      <g fill="#ffffff" stroke="#ffffff" strokeLinejoin="round">
                        <line x1={-5} y1={-8} x2={-5} y2={8} strokeWidth={2.2} strokeLinecap="round" />
                        <polygon points="-4,-7 7,-3 -4,1" strokeWidth={1.2} />
                      </g>
                    )}
                  </g>
                )}
              </g>
            );
          })}

          {(microFx.plankLift || microFx.handsFull || microFx.wrongKeyCell || microFx.reverseDustCell) && (
            <style>{ROBOT_FEEDBACK_CSS}</style>
          )}

          {/* Reverse tread dust puffs behind previous cell on MOVE_BACK */}
          {microFx.reverseDustCell && !isInstant && !isLowQuality && (
            <g
              data-testid="robot-reverse-dust-fx"
              transform={`translate(${microFx.reverseDustCell.x * CELL_SIZE + CELL_SIZE / 2}, ${
                microFx.reverseDustCell.y * CELL_SIZE + CELL_SIZE / 2
              })`}
              className="pointer-events-none robot-reverse-dust-fx"
            >
              <circle cx={-10} cy={8} r={4.5} fill="#94a3b8" fillOpacity={0.55} />
              <circle cx={10} cy={8} r={4.5} fill="#94a3b8" fillOpacity={0.55} />
              <circle cx={0} cy={14} r={3.5} fill="#cbd5e1" fillOpacity={0.45} />
            </g>
          )}

          {/* Wrong-key X flash ahead of robot on mismatched key USE_DROP */}
          {microFx.wrongKeyCell && !isInstant && !isLowQuality && (
            <g
              data-testid="robot-wrong-key-fx"
              transform={`translate(${microFx.wrongKeyCell.x * CELL_SIZE + CELL_SIZE / 2}, ${
                microFx.wrongKeyCell.y * CELL_SIZE + CELL_SIZE / 2
              })`}
              className="pointer-events-none robot-wrong-key-fx"
            >
              <circle r={15} fill="#7f1d1d" fillOpacity={0.92} stroke="#fca5a5" strokeWidth={2.5} />
              <path
                d="M -6 -6 L 6 6 M 6 -6 L -6 6"
                stroke="#ffffff"
                strokeWidth={3}
                strokeLinecap="round"
              />
            </g>
          )}

          {/* Robot Representation */}
          <g
            data-testid="robot"
            transform={`translate(${robot.x * CELL_SIZE + CELL_SIZE / 2}, ${
              robot.y * CELL_SIZE + CELL_SIZE / 2
            })`}
            className={`pointer-events-none ${isInstant || isLowQuality ? '' : 'transition-transform duration-300 ease-out'}`}
          >
            {/* Rotate robot to face direction */}
            <g transform={`rotate(${getAngle(robot.dir)})`}>
              {/* Outer halo */}
              <circle
                r={24}
                fill="#0284c7"
                className={`opacity-30 ${isInstant || isLowQuality ? '' : 'animate-pulse'}`}
              />
              {/* Beacon color+shape match ring for tileColor sensor */}
              {tileColorSensorRef && tileColorTargetHex && (
                <g
                  data-testid="robot-tile-color-ring"
                  data-matched={tileColorMatched ? 'true' : 'false'}
                  data-beacon-shape={robotBeaconHere?.shape ?? 'none'}
                >
                  <circle
                    r={28}
                    fill="none"
                    stroke={tileColorTargetHex}
                    strokeWidth={tileColorMatched ? 3.2 : 2}
                    strokeDasharray={tileColorMatched ? undefined : '4 3'}
                    opacity={tileColorMatched ? 0.95 : 0.6}
                  />
                  {robotBeaconHere && (
                    <circle
                      r={24}
                      fill={tileColorMatched ? tileColorTargetHex : 'none'}
                      fillOpacity={tileColorMatched ? 0.16 : 0}
                      stroke="#ffffff"
                      strokeWidth={1}
                      strokeOpacity={tileColorMatched ? 0.75 : 0.3}
                    />
                  )}
                </g>
              )}
              {/* Directional Scan Visor & Ears (pathAhead / pathLeft / pathRight) */}
              {hasSensorAhead && (
                <g
                  data-testid="robot-sensor-visor-ahead"
                  data-open={aheadOpen ? 'true' : 'false'}
                >
                  <path
                    d="M -13 -24 Q 0 -31 13 -24"
                    fill="none"
                    stroke={aheadOpen ? '#10b981' : '#ef4444'}
                    strokeWidth={3.2}
                    strokeLinecap="round"
                  />
                  <g transform="translate(0, -32)">
                    <g transform={`rotate(${-getAngle(robot.dir)})`}>
                      <circle
                        r={6.5}
                        fill={aheadOpen ? '#059669' : '#dc2626'}
                        stroke="#ffffff"
                        strokeWidth={1.4}
                      />
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="#ffffff"
                        fontSize={8.5}
                        fontWeight={900}
                      >
                        {aheadOpen ? '✓' : '✕'}
                      </text>
                    </g>
                  </g>
                </g>
              )}
              {hasSensorLeft && (
                <g
                  data-testid="robot-sensor-ear-left"
                  data-open={leftOpen ? 'true' : 'false'}
                >
                  <path
                    d="M -24 -11 Q -31 0 -24 11"
                    fill="none"
                    stroke={leftOpen ? '#10b981' : '#ef4444'}
                    strokeWidth={3}
                    strokeLinecap="round"
                  />
                  <g transform="translate(-31, 0)">
                    <g transform={`rotate(${-getAngle(robot.dir)})`}>
                      <circle
                        r={6}
                        fill={leftOpen ? '#059669' : '#dc2626'}
                        stroke="#ffffff"
                        strokeWidth={1.3}
                      />
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="#ffffff"
                        fontSize={8}
                        fontWeight={900}
                      >
                        {leftOpen ? '✓' : '✕'}
                      </text>
                    </g>
                  </g>
                </g>
              )}
              {hasSensorRight && (
                <g
                  data-testid="robot-sensor-ear-right"
                  data-open={rightOpen ? 'true' : 'false'}
                >
                  <path
                    d="M 24 -11 Q 31 0 24 11"
                    fill="none"
                    stroke={rightOpen ? '#10b981' : '#ef4444'}
                    strokeWidth={3}
                    strokeLinecap="round"
                  />
                  <g transform="translate(31, 0)">
                    <g transform={`rotate(${-getAngle(robot.dir)})`}>
                      <circle
                        r={6}
                        fill={rightOpen ? '#059669' : '#dc2626'}
                        stroke="#ffffff"
                        strokeWidth={1.3}
                      />
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="#ffffff"
                        fontSize={8}
                        fontWeight={900}
                      >
                        {rightOpen ? '✓' : '✕'}
                      </text>
                    </g>
                  </g>
                </g>
              )}
              {/* 1-Ahead Bridged Plank Sparkle Scan Beam on `itemHere` */}
              {showAheadPlankScanBeam && (
                <g data-testid="robot-plank-scan-beam">
                  <line
                    x1={0}
                    y1={-22}
                    x2={0}
                    y2={-CELL_SIZE}
                    stroke="#fbbf24"
                    strokeWidth={3.5}
                    strokeDasharray="4 3"
                    strokeLinecap="round"
                    className={isInstant || isLowQuality ? undefined : 'animate-pulse'}
                  />
                  <circle
                    cx={0}
                    cy={-CELL_SIZE}
                    r={CELL_SIZE * 0.34}
                    fill="none"
                    stroke="#facc15"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                  />
                  <g transform={`translate(14, ${-CELL_SIZE + 14})`}>
                    <g transform={`rotate(${-getAngle(robot.dir)})`}>
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={12}
                        fill="#fde047"
                      >
                        ✦
                      </text>
                    </g>
                  </g>
                </g>
              )}
              {/* 1-ahead plank retrieval telescopic arm reach animation */}
              {microFx.plankLift && !isInstant && !isLowQuality && (
                <g data-testid="robot-plank-lift-fx">
                  <line
                    x1={10}
                    y1={-12}
                    x2={4}
                    y2={-52}
                    stroke="#38bdf8"
                    strokeWidth={3}
                    strokeDasharray="4 3"
                    strokeLinecap="round"
                  />
                  <g className="robot-plank-lift-fx">
                    <rect
                      x={-11}
                      y={-4.5}
                      width={22}
                      height={9}
                      rx={2.5}
                      fill="#f59e0b"
                      stroke="#0f172a"
                      strokeWidth={2}
                    />
                  </g>
                </g>
              )}
              {/* Robot body base */}
              <circle
                r={20}
                fill={status === 'COLLISION' ? '#dc2626' : '#0ea5e9'}
                stroke="#ffffff"
                strokeWidth={3}
                className={isLowQuality ? undefined : 'drop-shadow-md'}
              />
              {/* Directional Arrow Pointer */}
              <polygon
                points="0,-16 7,-3 -7,-3"
                fill="#ffffff"
              />
              {/* Eyes */}
              <circle cx={-6} cy={3} r={3} fill="#0f172a" />
              <circle cx={6} cy={3} r={3} fill="#0f172a" />
              {/* Upper-right shoulder gripper clamp (keeps visor, nose cone, and center body unobstructed) */}
              <RobotShoulderCarry
                carriedItem={robot.carriedItem}
                carriedCount={robot.carriedCount ?? (robot.carriedItem ? robot.carriedItem.count ?? 1 : 0)}
                robotAngleDeg={getAngle(robot.dir)}
                showEmptyClamp={hasInteractiveWorldElements(grid)}
                isWiggling={microFx.handsFull}
                isWrongKey={Boolean(microFx.wrongKeyCell)}
              />
              {/* Hands-full bump warning badge when PICK_UP fails while carrying */}
              {microFx.handsFull && !isInstant && !isLowQuality && (
                <g data-testid="robot-hands-full-fx" transform="translate(26, -24)">
                  <g transform={`rotate(${-getAngle(robot.dir)})`}>
                    <circle r={7} fill="#f59e0b" stroke="#0f172a" strokeWidth={1.8} />
                    <path
                      d="M -2.5 -2.5 L 2.5 2.5 M 2.5 -2.5 L -2.5 2.5"
                      stroke="#0f172a"
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                  </g>
                </g>
              )}
            </g>
          </g>

          {/* Pluggable Over-Robot Overlay Slots (Flag Padlocks C6, Ghost Step C7, Demo Spotlights C8a) */}
          <GridOverlayLayer
            grid={grid}
            cellSize={CELL_SIZE}
            isInstant={isInstant}
            isReadOnly={isReadOnly}
            layer="over-robot"
            flagPadlockSlot={
              <FlagPadlockOverlay
                grid={grid}
                cellSize={CELL_SIZE}
                isInstant={isInstant}
              />
            }
            ghostStepSlot={<GhostStepOverlay cellSize={CELL_SIZE} />}
            demoSpotlightSlot={
              <DemoSpotlightOverlay
                grid={grid}
                cellSize={CELL_SIZE}
                isInstant={isInstant}
              />
            }
          />
          {cueCondBlock && !hasDemoSensorBeamSpotlight && (
            <SensorBeamGridOverlay
              grid={grid}
              cellSize={CELL_SIZE}
              runtime={runtime}
              workspace={workspace}
            />
          )}
        </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Controls Overlay: Trajectory button and Fit Toggle button (Fixed in place) */}
      <div className="absolute bottom-4 right-4 z-30 flex flex-col items-center gap-2 pointer-events-auto">
        {/* Toggle Fit to Screen Button */}
        <button
          data-testid="btn-toggle-fit"
          onClick={handleToggleFit}
          className={`p-3 rounded-2xl shadow-lg border-2 transition-all ${
            isFitToView
              ? 'bg-sky-500 border-sky-300 text-white shadow-sky-500/30'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500'
          }`}
          title={isFitToView ? 'Reset to Actual Size (100%)' : 'Fit to Available Size'}
        >
          {isFitToView ? <Minimize2 className="w-6 h-6" /> : <Maximize2 className="w-6 h-6" />}
        </button>

        {/* Floating Trace / Trajectory Toggle Button */}
        <button
          data-testid="btn-toggle-trace"
          onClick={toggleTrace}
          className={`p-3 rounded-2xl shadow-lg border-2 transition-all ${
            showTrace
              ? 'bg-sky-500 border-sky-300 text-white shadow-sky-500/30'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500'
          }`}
          title="Trace"
        >
          <Footprints className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
