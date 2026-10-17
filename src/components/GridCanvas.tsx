import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { WallEdge, Direction } from '../types';
import { Trophy, Footprints } from 'lucide-react';

const CELL_SIZE = 72; // pixels per cell

export const GridCanvas: React.FC = () => {
  const {
    grid,
    toggleWall,
    setCellContent,
    toggleTrace,
  } = useAppStore();

  const { width, height, robot, barriers, flags, trace, status, showTrace } = grid;

  const svgWidth = width * CELL_SIZE;
  const svgHeight = height * CELL_SIZE;

  // Handle clicking an edge to toggle a wall barrier
  const handleEdgeClick = (edge: WallEdge, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleWall(edge);
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
    <div className="relative flex flex-col items-center justify-center w-full h-full p-4 overflow-auto bg-slate-950/60 select-none">
      {/* Simulation status banner if collision or victory */}
      {status === 'COLLISION' && (
        <div
          data-testid="status-collision"
          className="absolute top-4 z-20 px-6 py-2 bg-red-600/90 text-white rounded-full font-bold shadow-lg shadow-red-500/30 animate-bounce flex items-center gap-2"
        >
          <span className="text-xl">💥</span>
        </div>
      )}

      {status === 'SUCCESS' && (
        <div
          data-testid="status-success"
          className="absolute top-4 z-20 px-6 py-2 bg-amber-500 text-slate-900 rounded-full font-extrabold shadow-lg shadow-amber-500/40 animate-pulse flex items-center gap-2"
        >
          <Trophy className="w-6 h-6" />
          <span className="text-xl">⭐ ⭐ ⭐</span>
        </div>
      )}

      {/* SVG Grid Container */}
      <div className="relative p-2 bg-slate-900 rounded-2xl border-4 border-slate-800 shadow-2xl">
        <svg
          data-testid="grid-canvas"
          width={svgWidth}
          height={svgHeight}
          className="overflow-visible block"
        >
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
                className="cursor-pointer transition-colors hover:fill-slate-700/50"
                onClick={() => setCellContent(x, y)}
              />
            ))
          )}

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
                className="pointer-events-none transition-all duration-300"
              >
                {flag.isGoal ? (
                  <g className={flag.collected ? 'scale-125 opacity-90' : 'animate-pulse'}>
                    <circle r={22} fill="#eab308" className="shadow-lg" />
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
                    <text
                      y={5}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize={16}
                      fontWeight="bold"
                    >
                      {flag.order}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Horizontal Barrier Wall Hitboxes & Lines */}
          {Array.from({ length: height - 1 }).map((_, row) =>
            Array.from({ length: width }).map((_, col) => {
              const y = row + 1;
              const hasWall = barriers.some(
                (b) => b.orientation === 'H' && b.x === col && b.y === y
              );
              return (
                <g key={`h-wall-${col}-${y}`}>
                  {/* Invisible wide hitbox for touch */}
                  <rect
                    data-testid={`wall-h-hitbox-${col}-${y}`}
                    x={col * CELL_SIZE}
                    y={y * CELL_SIZE - 12}
                    width={CELL_SIZE}
                    height={24}
                    fill="transparent"
                    className="cursor-pointer"
                    onClick={(e) => handleEdgeClick({ orientation: 'H', x: col, y }, e)}
                  />
                  {/* Visible Wall Rectangle */}
                  {hasWall && (
                    <rect
                      data-testid={`wall-h-${col}-${y}`}
                      x={col * CELL_SIZE + 2}
                      y={y * CELL_SIZE - 4}
                      width={CELL_SIZE - 4}
                      height={8}
                      rx={4}
                      fill="#ef4444"
                      className="filter drop-shadow-[0_0_8px_rgba(239,68,68,0.8)] cursor-pointer"
                      onClick={(e) => handleEdgeClick({ orientation: 'H', x: col, y }, e)}
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
              return (
                <g key={`v-wall-${x}-${row}`}>
                  {/* Invisible wide hitbox for touch */}
                  <rect
                    data-testid={`wall-v-hitbox-${x}-${row}`}
                    x={x * CELL_SIZE - 12}
                    y={row * CELL_SIZE}
                    width={24}
                    height={CELL_SIZE}
                    fill="transparent"
                    className="cursor-pointer"
                    onClick={(e) => handleEdgeClick({ orientation: 'V', x, y: row }, e)}
                  />
                  {/* Visible Wall Rectangle */}
                  {hasWall && (
                    <rect
                      data-testid={`wall-v-${x}-${row}`}
                      x={x * CELL_SIZE - 4}
                      y={row * CELL_SIZE + 2}
                      width={8}
                      height={CELL_SIZE - 4}
                      rx={4}
                      fill="#ef4444"
                      className="filter drop-shadow-[0_0_8px_rgba(239,68,68,0.8)] cursor-pointer"
                      onClick={(e) => handleEdgeClick({ orientation: 'V', x, y: row }, e)}
                    />
                  )}
                </g>
              );
            })
          )}

          {/* Robot Representation */}
          <g
            data-testid="robot"
            transform={`translate(${robot.x * CELL_SIZE + CELL_SIZE / 2}, ${
              robot.y * CELL_SIZE + CELL_SIZE / 2
            })`}
            className="transition-all duration-300 ease-out"
          >
            {/* Rotate robot to face direction */}
            <g transform={`rotate(${getAngle(robot.dir)})`}>
              {/* Outer halo */}
              <circle
                r={24}
                fill="#0284c7"
                className="opacity-30 animate-pulse"
              />
              {/* Robot body base */}
              <circle
                r={20}
                fill={status === 'COLLISION' ? '#dc2626' : '#0ea5e9'}
                stroke="#ffffff"
                strokeWidth={3}
                className="drop-shadow-md"
              />
              {/* Directional Arrow Pointer */}
              <polygon
                points="0,-16 7,-3 -7,-3"
                fill="#ffffff"
              />
              {/* Eyes */}
              <circle cx={-6} cy={3} r={3} fill="#0f172a" />
              <circle cx={6} cy={3} r={3} fill="#0f172a" />
            </g>
          </g>
        </svg>
      </div>

      {/* Floating Trace Toggle Button */}
      <button
        data-testid="btn-toggle-trace"
        onClick={toggleTrace}
        className={`absolute bottom-4 right-4 p-3 rounded-2xl shadow-lg border-2 transition-all ${
          showTrace
            ? 'bg-sky-500 border-sky-300 text-white shadow-sky-500/30'
            : 'bg-slate-800 border-slate-700 text-slate-400'
        }`}
        title="Trace"
      >
        <Footprints className="w-6 h-6" />
      </button>
    </div>
  );
};
