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
import { VictoryCelebrationModal } from './components/VictoryCelebrationModal';
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt';
import { useAppStore } from './store/useAppStore';
import { VariationCardsPanel } from './components/VariationCardsPanel';
import { GridToolbarTools } from './simulations/grid/components/GridToolbarTools';
import { getSimEnvironment } from './engine/simulation/registry';
import { useUndoRedoShortcuts } from './hooks/useUndoRedoShortcuts';

export const App: React.FC = () => {
  useUndoRedoShortcuts();
  useAppStore();
  const { appMode, activeSimId, grid, turtleState, beatState, runtime, isMapHidden } =
    useAppStore.getState();
  const simEnv = getSimEnvironment(activeSimId);
  const Renderer = simEnv?.Renderer;
  const activeState =
    activeSimId === 'grid' ? grid : activeSimId === 'beat' ? beatState : turtleState;

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
        </section>

        {/* Right Pane: Active Simulation World (Grid, Turtle LOGO, or Beat Matrix) */}
        {!isMapHidden && (
          <section
            data-testid="pane-simulation"
            className="flex flex-col w-full md:w-1/2 h-1/2 md:h-full overflow-hidden bg-slate-900/30"
          >
            {/* Sandbox Grid Map Editor Top Dock */}
            {appMode === 'sandbox' && activeSimId === 'grid' && (
              <div
                data-testid="grid-editor-dock"
                className="shrink-0 z-40 bg-slate-900/95 border-b border-slate-800 px-2 py-1 flex items-center justify-center overflow-visible"
              >
                <GridToolbarTools state={grid} />
              </div>
            )}

            <div className="relative flex-1 min-h-0 w-full overflow-hidden flex flex-col">
              {/* Runtime Variables HUD for Turtle & Beat (Grid renders inside its non-overlapping top-left HUD stack) */}
              {activeSimId !== 'grid' &&
                runtime?.variables &&
                Object.keys(runtime.variables).length > 0 && (
                  <div
                    data-testid="toolbar-variables"
                    className="absolute top-3 left-3 z-20 pointer-events-none flex items-center gap-1.5 px-2.5 py-1 bg-slate-900/90 backdrop-blur border border-indigo-500/50 rounded-xl text-xs shadow-lg"
                  >
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider">
                      VARS
                    </span>
                    {Object.entries(runtime.variables).map(([k, v]) => (
                      <span
                        key={k}
                        data-testid={`var-badge-${k}`}
                        className="px-1.5 py-0.5 rounded bg-indigo-950/90 border border-indigo-500/40 font-mono font-bold text-indigo-200"
                      >
                        {k}={v}
                      </span>
                    ))}
                  </div>
                )}

              {Renderer && <Renderer state={activeState} runtimeStatus={runtime?.status} />}
            </div>
            <VariationCardsPanel />
          </section>
        )}
      </main>

      {/* Lesson & World Picker Modal */}
      <LessonPickerModal />

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

