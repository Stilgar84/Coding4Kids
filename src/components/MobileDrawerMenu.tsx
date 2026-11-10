import React, { useEffect, useState } from 'react';
import { useAppStore, PRESET_LEVELS } from '../store/useAppStore';
import { LESSONS } from '../data/lessons';
import { getSimEnvironment } from '../engine/simulation/registry';
import {
  X,
  Lightbulb,
  Save,
  FolderOpen,
  Share2,
  Zap,
  Maximize2,
  Minimize2,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { isFullscreenActive, toggleFullscreen } from '../utils/fullscreen';
import { usePwaUpdateStore, applyAppUpdate } from '../services/pwaUpdateManager';

export const MobileDrawerMenu: React.FC = () => {
  const {
    isMobileMenuOpen,
    setMobileMenuOpen,
    activeSimId,
    setSimEnvironment,
    currentLevel,
    setLevel,
    speed,
    setSpeed,
    setSolutionOpen,
    setSaveModalOpen,
    setLoadModalOpen,
    setExportImportOpen,
    isMapHidden,
    toggleMapHidden,
    grid,
    turtleState,
    runtime,
  } = useAppStore();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const { needRefresh, isUpdating } = usePwaUpdateStore();

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(isFullscreenActive());
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  if (!isMobileMenuOpen) return null;

  const currentSimEnv = getSimEnvironment(activeSimId);
  const currentLesson = LESSONS.find((l) => l.id === currentLevel) || LESSONS[0];
  const ToolsComponent = currentSimEnv?.ToolsComponent;
  const currentSimState = activeSimId === 'grid' ? grid : turtleState;

  const isInstant = speed === 'instant' || (speed as any) === 0;

  const toggleSpeed = () => {
    if (speed === 400) setSpeed(100);
    else if (speed === 100) setSpeed(25);
    else if (speed === 25) setSpeed('instant');
    else setSpeed(400);
  };

  const getSpeedLabel = () => {
    if (isInstant) return 'Instant';
    if (speed === 25) return '16x';
    if (speed === 100) return '4x';
    return '1x';
  };

  const handlePrevLevel = () => {
    const prevId = currentLevel > 1 ? currentLevel - 1 : PRESET_LEVELS.length;
    setLevel(prevId);
  };

  const handleNextLevel = () => {
    const nextId = currentLevel < PRESET_LEVELS.length ? currentLevel + 1 : 1;
    setLevel(nextId);
  };

  const handleToggleFullscreen = async () => {
    const active = await toggleFullscreen();
    setIsFullscreen(active);
  };

  return (
    <div
      data-testid="mobile-drawer-overlay"
      className="fixed inset-0 z-50 flex bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={() => setMobileMenuOpen(false)}
    >
      <div
        data-testid="mobile-drawer-content"
        className="w-[85vw] max-w-[340px] h-full bg-slate-900 border-r border-slate-800 flex flex-col shadow-2xl p-4 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Title and Close Button */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xl">🤖</span>
            <span className="font-extrabold text-white text-base">Menu</span>
          </div>
          <button
            data-testid="btn-close-mobile-menu"
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-slate-700 active:scale-95 transition-transform"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col gap-5 py-4">
          {/* Pending App Update Action (when update is available) */}
          {needRefresh && (
            <button
              data-testid="drawer-btn-pwa-update"
              disabled={isUpdating}
              onClick={() => {
                setMobileMenuOpen(false);
                void applyAppUpdate();
              }}
              className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs rounded-2xl border-2 border-sky-300 shadow-lg active:scale-95 transition-all disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 stroke-[2.5] ${isUpdating ? 'animate-spin' : ''}`} />
              <span>{isUpdating ? 'Updating…' : 'Update App & Restore Workspace'}</span>
            </button>
          )}

          {/* Section: Environment Selector */}
          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">
              Environment
            </span>
            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
              <button
                data-testid="drawer-tab-grid"
                onClick={() => setSimEnvironment('grid')}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl font-bold text-xs transition-all ${
                  activeSimId === 'grid'
                    ? 'bg-sky-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>🤖</span>
                <span>Grid</span>
              </button>
              <button
                data-testid="drawer-tab-turtle"
                onClick={() => setSimEnvironment('turtle')}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl font-bold text-xs transition-all ${
                  activeSimId === 'turtle'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>🐢</span>
                <span>Turtle</span>
              </button>
            </div>
          </div>

          {/* Section: Lessons (Grid only) */}
          {activeSimId === 'grid' && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">
                  Lessons
                </span>
                <button
                  data-testid="drawer-btn-solution"
                  onClick={() => {
                    setSolutionOpen(true);
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-400/40 rounded-xl text-xs font-bold active:scale-95 transition-transform"
                >
                  <Lightbulb className="w-3.5 h-3.5 fill-amber-300" />
                  <span>Solution</span>
                </button>
              </div>

              {/* Prev / Next & Dropdown */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handlePrevLevel}
                  className="flex items-center justify-center w-9 h-10 bg-slate-800 text-slate-300 rounded-xl border border-slate-700 active:scale-95"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex-1 flex items-center gap-1 bg-slate-800 px-2 rounded-xl border border-slate-700 min-w-0">
                  <span className="text-sm flex-shrink-0">{currentLesson.moduleIcon}</span>
                  <select
                    value={currentLevel}
                    onChange={(e) => setLevel(Number(e.target.value))}
                    className="bg-transparent text-white font-bold text-xs h-10 w-full focus:outline-none cursor-pointer truncate"
                  >
                    {LESSONS.map((l) => (
                      <option key={l.id} value={l.id} className="bg-slate-900 text-slate-100">
                        {l.id}. {l.title}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleNextLevel}
                  className="flex items-center justify-center w-9 h-10 bg-slate-800 text-slate-300 rounded-xl border border-slate-700 active:scale-95"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Quick Level Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar">
                {PRESET_LEVELS.map((lvl) => (
                  <button
                    key={lvl.id}
                    data-testid={`drawer-level-${lvl.id}`}
                    onClick={() => setLevel(lvl.id)}
                    className={`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg font-black text-xs border transition-all ${
                      currentLevel === lvl.id
                        ? 'bg-amber-500 border-amber-300 text-slate-950 shadow-md scale-105'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    {lvl.id}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Section: Files & Storage */}
          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">
              Program Storage & Sharing
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                data-testid="drawer-btn-save"
                onClick={() => {
                  setSaveModalOpen(true);
                  setMobileMenuOpen(false);
                }}
                className="flex flex-col items-center justify-center gap-1 p-2.5 bg-slate-800 hover:bg-sky-700 text-white rounded-xl border border-slate-700 active:scale-95 transition-transform"
              >
                <Save className="w-5 h-5 text-sky-400" />
                <span className="text-[11px] font-bold">Save</span>
              </button>
              <button
                data-testid="drawer-btn-load"
                onClick={() => {
                  setLoadModalOpen(true);
                  setMobileMenuOpen(false);
                }}
                className="flex flex-col items-center justify-center gap-1 p-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl border border-slate-700 active:scale-95 transition-transform"
              >
                <FolderOpen className="w-5 h-5 text-amber-400" />
                <span className="text-[11px] font-bold">Load</span>
              </button>
              <button
                data-testid="drawer-btn-share"
                onClick={() => {
                  setExportImportOpen(true);
                  setMobileMenuOpen(false);
                }}
                className="flex flex-col items-center justify-center gap-1 p-2.5 bg-slate-800 hover:bg-indigo-700 text-white rounded-xl border border-slate-700 active:scale-95 transition-transform"
              >
                <Share2 className="w-5 h-5 text-indigo-400" />
                <span className="text-[11px] font-bold">Share</span>
              </button>
            </div>
          </div>

          {/* Section: Speed & Display */}
          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">
              Display & Performance
            </span>
            <div className="grid grid-cols-3 gap-2">
              {/* Speed Button */}
              <button
                data-testid="drawer-btn-speed"
                onClick={toggleSpeed}
                className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl border font-bold transition-all active:scale-95 ${
                  isInstant
                    ? 'bg-amber-400 text-slate-950 border-amber-300'
                    : 'bg-slate-800 text-yellow-400 border-slate-700'
                }`}
              >
                <Zap className={`w-5 h-5 ${isInstant ? 'fill-slate-950' : 'fill-yellow-400'}`} />
                <span className="text-[11px]">{getSpeedLabel()}</span>
              </button>

              {/* Hide / Show Map */}
              <button
                data-testid="drawer-btn-toggle-map"
                onClick={toggleMapHidden}
                className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl border font-bold transition-all active:scale-95 ${
                  isMapHidden
                    ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {isMapHidden ? <EyeOff className="w-5 h-5 text-amber-300" /> : <Eye className="w-5 h-5 text-sky-400" />}
                <span className="text-[11px]">{isMapHidden ? 'Map: Off' : 'Map: On'}</span>
              </button>

              {/* Fullscreen Button */}
              <button
                data-testid="drawer-btn-fullscreen"
                onClick={handleToggleFullscreen}
                className="flex flex-col items-center justify-center gap-1 p-2.5 bg-slate-800 text-slate-300 rounded-xl border border-slate-700 active:scale-95 transition-transform"
              >
                {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                <span className="text-[11px] font-bold">{isFullscreen ? 'Exit Full' : 'Fullscreen'}</span>
              </button>
            </div>
          </div>

          {/* Section: Custom Environment Tools (if present) */}
          {ToolsComponent && (
            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">
                Map Editor Tools
              </span>
              <div className="p-2 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-center">
                <ToolsComponent state={currentSimState} />
              </div>
            </div>
          )}

          {/* Section: Runtime Variables */}
          {runtime?.variables && Object.keys(runtime.variables).length > 0 && (
            <div className="flex flex-col gap-1.5 p-2.5 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                VARS:
              </span>
              <div className="flex flex-wrap gap-2">
                {Object.entries(runtime.variables).map(([k, v]) => (
                  <span key={k} className="text-amber-300 font-bold">
                    <span className="italic">{k}</span> ={' '}
                    <span className="text-violet-200">
                      {typeof v === 'number' ? (Number.isInteger(v) ? v : Number(v.toFixed(2))) : v}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
