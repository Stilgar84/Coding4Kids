import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Sparkles, Undo2, Play } from 'lucide-react';
import { ScopeType, WorkspaceState } from '../types';
import {
  CreativeVariationCard,
  CurriculumSimId,
  getActivityAtVersion,
  getActivityLatest,
} from '../data/curriculum';
import { TurtleState } from '../simulations/turtle/types';
import { createInitialTurtleState } from '../simulations/turtle/turtleEnvironment';
import {
  runHeadlessSimulation,
  MAX_INSTANT_SIMULATION_STEPS,
} from '../engine/simulationRunner';
import {
  generateTurtleMapThumbnail,
  renderTurtleMapSvg,
} from '../services/mapThumbnailGenerator';
import { useAppStore } from '../store/useAppStore';

export interface TurtleVariationPreview {
  finalState: TurtleState;
  svgMarkup: string;
  thumbnailUrl: string;
}

/**
 * Headlessly executes a Turtle LOGO variation workspace and renders its SVG markup and data URL thumbnail.
 */
export function renderTurtleVariationPreview(workspace: WorkspaceState): TurtleVariationPreview {
  const initialTurtle = createInitialTurtleState();
  const simResult = runHeadlessSimulation(
    workspace,
    'turtle',
    initialTurtle,
    MAX_INSTANT_SIMULATION_STEPS
  );
  const finalState = simResult.finalState as TurtleState;
  const svgMarkup = renderTurtleMapSvg(finalState);
  const thumbnailUrl = generateTurtleMapThumbnail(finalState);
  return { finalState, svgMarkup, thumbnailUrl };
}

function countWorkspaceBlocks(workspace: WorkspaceState): number {
  return (['MAIN', 'F1', 'F2', 'F3'] as ScopeType[]).reduce(
    (sum, scope) => sum + (workspace[scope]?.length ?? 0),
    0
  );
}

interface VariationCardPreviewProps {
  simId: CurriculumSimId;
  card: CreativeVariationCard;
}

const VariationCardPreview: React.FC<VariationCardPreviewProps> = ({ simId, card }) => {
  const turtlePreview = useMemo(() => {
    if (simId !== 'turtle') return null;
    return renderTurtleVariationPreview(card.workspace);
  }, [simId, card.workspace]);

  if (simId === 'turtle' && turtlePreview) {
    return (
      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-white border border-slate-300 overflow-hidden shrink-0 flex items-center justify-center shadow-inner">
        <img
          src={turtlePreview.thumbnailUrl}
          alt={`${card.title} drawing preview`}
          data-testid={`variation-thumbnail-${card.id}`}
          className="w-full h-full object-contain p-0.5 select-none pointer-events-none"
          draggable={false}
        />
      </div>
    );
  }

  if (simId === 'beat') {
    // Extensible preview slot for Wave 3 Commit 11 (Beat & Light 8x8 playable previews)
    return (
      <div
        data-testid={`variation-beat-preview-${card.id}`}
        className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-slate-950 border border-slate-700 shrink-0 flex items-center justify-center text-2xl select-none"
        aria-hidden="true"
      >
        {card.icon || '🎵'}
      </div>
    );
  }

  return (
    <div
      className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-slate-800 border border-slate-700 shrink-0 flex items-center justify-center text-2xl select-none"
      aria-hidden="true"
    >
      {card.icon || '✨'}
    </div>
  );
};

export const VariationCardsPanel: React.FC = () => {
  const subscribedAppMode = useAppStore((state) => state.appMode);
  const subscribedActivityId = useAppStore((state) => state.activeActivityId);
  const subscribedActivityVersion = useAppStore((state) => state.activeActivityVersion);
  const subscribedCanUndo = useAppStore((state) => state.canUndo);

  const snapshot = useAppStore.getState();
  const appMode = snapshot.appMode || subscribedAppMode;
  const activeActivityId = snapshot.activeActivityId || subscribedActivityId;
  const activeActivityVersion = snapshot.activeActivityVersion || subscribedActivityVersion;
  const canUndo = snapshot.canUndo ?? subscribedCanUndo;
  const loadVariationWorkspace = snapshot.loadVariationWorkspace;
  const undo = snapshot.undo;

  const [isCollapsed, setIsCollapsed] = useState(false);

  const activeActivity =
    appMode === 'curriculum'
      ? getActivityAtVersion(activeActivityId, activeActivityVersion) ??
        getActivityLatest(activeActivityId)
      : undefined;

  const variations = activeActivity?.variations;
  if (appMode !== 'curriculum' || !activeActivity || !variations || variations.length === 0) {
    return null;
  }

  return (
    <aside
      data-testid="variation-cards-panel"
      aria-label="Creative variation cards"
      className="w-full shrink-0 bg-slate-950/95 border-t border-slate-800 text-slate-100 select-none z-20"
    >
      {/* Compact Header Strip */}
      <div className="flex items-center justify-between gap-2 px-3 py-1.5">
        <button
          type="button"
          data-testid="btn-toggle-variation-cards"
          aria-expanded={!isCollapsed}
          aria-controls="variation-cards-list"
          onClick={() => setIsCollapsed((prev) => !prev)}
          className="flex items-center gap-2 text-xs font-semibold text-slate-200 hover:text-sky-300 rounded-lg px-2 py-1 -ml-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
          <span>Try a Variation</span>
          <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[11px] font-mono">
            {variations.length}
          </span>
          {isCollapsed ? (
            <ChevronUp className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          )}
        </button>

        {canUndo && (
          <button
            type="button"
            data-testid="btn-variation-undo"
            onClick={() => undo()}
            title="Undo last workspace change"
            aria-label="Undo last workspace change"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <Undo2 className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
            <span>Undo</span>
          </button>
        )}
      </div>

      {/* Collapsible Horizontal Card Strip */}
      {!isCollapsed && (
        <div
          id="variation-cards-list"
          data-testid="variation-cards-list"
          role="list"
          className="flex items-stretch gap-2.5 px-3 pb-2.5 pt-0.5 overflow-x-auto"
        >
          {variations.map((card) => {
            const blockCount = countWorkspaceBlocks(card.workspace);
            return (
              <div
                key={card.id}
                role="listitem"
                data-testid={`variation-card-${card.id}`}
                className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-sky-500/60 min-w-[205px] sm:min-w-[224px] shrink-0 transition-colors shadow-sm"
              >
                <VariationCardPreview simId={activeActivity.simId} card={card} />

                <div className="flex flex-col justify-between min-w-0 flex-1 gap-1.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 text-xs font-semibold text-slate-100 truncate">
                      {card.icon && (
                        <span aria-hidden="true" className="shrink-0">
                          {card.icon}
                        </span>
                      )}
                      <span className="truncate">{card.title}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {blockCount} {blockCount === 1 ? 'block' : 'blocks'}
                    </div>
                  </div>

                  <button
                    type="button"
                    data-testid={`btn-load-variation-${card.id}`}
                    aria-label={`Load code for ${card.title}`}
                    onClick={() => loadVariationWorkspace(card.workspace, card.title)}
                    className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white text-xs font-semibold transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                  >
                    <Play className="w-3 h-3 fill-current shrink-0" aria-hidden="true" />
                    <span>Load Code</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
};
