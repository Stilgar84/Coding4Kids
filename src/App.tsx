import React from 'react';
import { Toolbar } from './components/Toolbar';
import { ExplanationDemoBar } from './components/ExplanationDemoBar';
import { BlockPalette } from './components/BlockPalette';
import { WorkspaceCanvas } from './components/WorkspaceCanvas';
import { SolutionModal } from './components/SolutionModal';
import { ExportImportModal } from './components/ExportImportModal';
import { SaveProgramModal } from './components/SaveProgramModal';
import { LoadProgramModal } from './components/LoadProgramModal';
import { LessonVersionMismatchModal } from './components/LessonVersionMismatchModal';
import { ProfileSwitcherModal } from './components/ProfileSwitcherModal';
import { LessonPickerModal } from './components/LessonPickerModal';
import { BadgeCollectionModal } from './components/BadgeCollectionModal';
import { VictoryCelebrationModal } from './components/VictoryCelebrationModal';
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt';
import { useAppStoreSelector } from './store/useAppStore';
import { CurriculumNextLessonBar } from './components/CurriculumNextLessonBar';
import { MultiRunPipsBar } from './components/MultiRunPipsBar';
import { SimulationTopLeftHud } from './components/SimulationTopLeftHud';
import { SceneInputBar } from './components/SceneInputBar';
import { VariationCardsPanel } from './components/VariationCardsPanel';
import { GridToolbarTools } from './simulations/grid/components/GridToolbarTools';
import { getSimEnvironment } from './engine/simulation/registry';
import { useUndoRedoShortcuts } from './hooks/useUndoRedoShortcuts';
import { usePerformanceMonitor } from './utils/performanceMonitor';

const ActiveSimulationPane: React.FC = React.memo(() => {
  const {
    appMode,
    activeSimId,
    activeState,
    runtimeStatus,
    runtimeVariables,
    activeBlockId,
    activeScope,
  } = useAppStoreSelector((s) => ({
    appMode: s.appMode,
    activeSimId: s.activeSimId,
    activeState:
      s.activeSimId === 'grid'
        ? s.grid
        : s.activeSimId === 'beat'
        ? s.beatState
        : s.activeSimId === 'depot'
        ? s.depotState
        : s.activeSimId === 'switchyard'
        ? s.switchyardState
        : s.turtleState,
    runtimeStatus: s.runtime?.status,
    runtimeVariables: s.runtime?.variables,
    activeBlockId: s.runtime?.activeBlockId ?? null,
    activeScope: s.runtime?.activeScope ?? s.activeScope,
  }));

  const simEnv = getSimEnvironment(activeSimId);
  const Renderer = simEnv?.Renderer;

  return (
    <section
      data-testid="pane-simulation"
      className="flex flex-col w-full md:w-1/2 h-1/2 md:h-full overflow-hidden bg-slate-900/30"
    >
      {/* Top Dock (shrink-0): Sandbox Grid Map Editor */}
      {appMode === 'sandbox' && activeSimId === 'grid' && (
        <div
          data-testid="grid-editor-dock"
          className="shrink-0 z-40 bg-slate-900/95 border-b border-slate-800 px-2 py-1 flex items-center justify-center overflow-visible"
        >
          <GridToolbarTools />
        </div>
      )}

      {/* Top Dock (shrink-0): Curriculum Scene Input Selector ($input) */}
      <SceneInputBar />

      {/* Main Simulation Viewport (relative flex-1 min-h-0) */}
      <div className="relative flex-1 min-h-0 w-full overflow-hidden flex flex-col">
        {/* Runtime Variables HUD for Turtle, Depot & Switchyard (Grid & Beat mount inside their own stage viewports) */}
        {activeSimId !== 'grid' && activeSimId !== 'beat' && (
          <SimulationTopLeftHud
            variables={runtimeVariables}
            positionClassName="top-3 left-3"
          />
        )}

        {/* Top-Center Multi-Run Pips Bar for multi-variant M5–M6+ challenges */}
        <MultiRunPipsBar />

        {Renderer && (
          <Renderer
            state={activeState}
            runtimeStatus={runtimeStatus}
            runtimeVariables={runtimeVariables}
            activeBlockId={activeBlockId}
            activeScope={activeScope}
          />
        )}
      </div>

      {/* Bottom Dock (shrink-0): Next Lesson CTA & Creative Variation Cards */}
      <div className="shrink-0">
        <CurriculumNextLessonBar />
        <VariationCardsPanel />
      </div>
    </section>
  );
});

export const App: React.FC = () => {
  useUndoRedoShortcuts();
  usePerformanceMonitor();
  const isMapHidden = useAppStoreSelector((s) => s.isMapHidden);

  return (
    <div className="flex flex-col w-screen h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Application Bar */}
      <Toolbar />

      {/* Interactive Explanation Demo Bar (Lesson 1.0, 2.6, 3.0) */}
      <ExplanationDemoBar />

      {/* Main Split-Pane Workspace */}
      <main className="flex flex-1 flex-col md:flex-row overflow-hidden">
        {/* Left Pane: Visual Block Programmer */}
        <section
          data-testid="pane-programming"
          className={`flex flex-col border-slate-800 ${
            isMapHidden
              ? 'w-full h-full overflow-hidden'
              : 'w-full md:w-1/2 h-1/2 md:h-full border-b-2 md:border-b-0 md:border-r-2 overflow-y-auto md:overflow-hidden'
          }`}
        >
          <BlockPalette />
          <WorkspaceCanvas />
          {isMapHidden && <CurriculumNextLessonBar forHiddenMapPane />}
        </section>

        {/* Right Pane: Active Simulation World (Grid, Turtle LOGO, or Beat Matrix) */}
        {!isMapHidden && <ActiveSimulationPane />}
      </main>

      {/* Lesson & World Picker Modal */}
      <LessonPickerModal />

      {/* Collectible Module Badges & Trophies Modal */}
      <BadgeCollectionModal />

      {/* Victory & Module Badge Celebration Modal */}
      <VictoryCelebrationModal />

      {/* Solution Viewer Modal */}
      <SolutionModal />

      {/* Share / Export / Import Modal */}
      <ExportImportModal />

      {/* Local Save & Load Modals */}
      <SaveProgramModal />
      <LoadProgramModal />
      <LessonVersionMismatchModal />

      {/* Kid-Friendly Multi-Profile Switcher Modal */}
      <ProfileSwitcherModal />

      {/* PWA Update Banner & Post-Update State Restore Toast */}
      <PwaUpdatePrompt />
    </div>
  );
};

export default App;

