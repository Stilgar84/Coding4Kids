import React from 'react';
import { GridState } from '../../../types';

export const GRID_CELL_SIZE = 72;

export interface GridOverlaySlotProps {
  grid: GridState;
  cellSize: number;
  isInstant: boolean;
  isReadOnly: boolean;
}

export interface GridOverlayLayerProps extends GridOverlaySlotProps {
  /**
   * Controls which z-plane of overlays to render inside GridCanvas SVG:
   * - 'under-robot': world terrain/items (water, bridges, switches, pickups, gates) — Commit 14
   * - 'over-robot': padlocks (Commit 6), ghost-step preview (Commit 7), demo spotlights (Commit 8a)
   * - 'all': renders all four isolated mount points (default for standalone tests)
   */
  layer?: 'under-robot' | 'over-robot' | 'all';
  worldItemsSlot?: React.ReactNode;
  flagPadlockSlot?: React.ReactNode;
  ghostStepSlot?: React.ReactNode;
  demoSpotlightSlot?: React.ReactNode;
}

/**
 * Pluggable SVG overlay container inside GridCanvas exposing isolated mount points
 * for parallel curriculum worktracks:
 * - WorldItemsLayer (Commit 14)
 * - FlagPadlockOverlay (Commit 6)
 * - GhostStepOverlay (Commit 7)
 * - DemoSpotlightOverlay (Commit 8a)
 */
export const GridOverlayLayer: React.FC<GridOverlayLayerProps> = ({
  layer = 'all',
  worldItemsSlot = null,
  flagPadlockSlot = null,
  ghostStepSlot = null,
  demoSpotlightSlot = null,
}) => {
  const showUnder = layer === 'under-robot' || layer === 'all';
  const showOver = layer === 'over-robot' || layer === 'all';

  return (
    <g
      data-testid={layer === 'all' ? 'grid-overlay-layer' : `grid-overlay-layer-${layer}`}
      className="pointer-events-none"
    >
      {showUnder && (
        <g data-testid="grid-slot-world-items" className="pointer-events-none">
          {worldItemsSlot}
        </g>
      )}

      {showOver && (
        <>
          <g data-testid="grid-slot-flag-padlocks" className="pointer-events-none">
            {flagPadlockSlot}
          </g>
          <g data-testid="grid-slot-ghost-preview" className="pointer-events-none">
            {ghostStepSlot}
          </g>
          <g data-testid="grid-slot-demo-spotlights" className="pointer-events-none">
            {demoSpotlightSlot}
          </g>
        </>
      )}
    </g>
  );
};
