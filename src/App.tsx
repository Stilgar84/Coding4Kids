import React from 'react';
import { Toolbar } from './components/Toolbar';
import { BlockPalette } from './components/BlockPalette';
import { WorkspaceCanvas } from './components/WorkspaceCanvas';
import { SolutionModal } from './components/SolutionModal';
import { useAppStore } from './store/useAppStore';
import { getSimEnvironment } from './engine/simulation/registry';

export const App: React.FC = () => {
  const { activeSimId, grid, turtleState, runtime } = useAppStore();
  const simEnv = getSimEnvironment(activeSimId);
  const Renderer = simEnv?.Renderer;
  const activeState = activeSimId === 'grid' ? grid : turtleState;

  return (
    <div className="flex flex-col w-screen h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Application Bar */}
      <Toolbar />

      {/* Main Split-Pane Workspace */}
      <main className="flex flex-1 flex-col md:flex-row overflow-hidden">
        {/* Left Pane: Visual Block Programmer */}
        <section
          data-testid="pane-programming"
          className="flex flex-col w-full md:w-1/2 h-1/2 md:h-full border-b-2 md:border-b-0 md:border-r-2 border-slate-800 overflow-hidden"
        >
          <BlockPalette />
          <WorkspaceCanvas />
        </section>

        {/* Right Pane: Active Simulation World (Grid or Turtle LOGO) */}
        <section
          data-testid="pane-simulation"
          className="flex flex-col w-full md:w-1/2 h-1/2 md:h-full overflow-hidden bg-slate-900/30"
        >
          {Renderer && <Renderer state={activeState} runtimeStatus={runtime?.status} />}
        </section>
      </main>

      {/* Solution Viewer Modal */}
      <SolutionModal />
    </div>
  );
};

export default App;

