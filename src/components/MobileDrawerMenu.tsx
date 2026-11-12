import React, { useEffect, useState } from 'react';
import {
  Copy,
  Eye,
  EyeOff,
  FolderOpen,
  Gauge,
  Lightbulb,
  Map,
  Maximize2,
  Minimize2,
  Redo2,
  RefreshCw,
  RotateCcw,
  Save,
  Share2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useAppStoreSelector, isLowQualityActive } from '../store/useAppStore';
import {
  CURRICULUM_ACTIVITIES,
  getActivityAtVersion,
  getActivityLatest,
} from '../data/curriculum';
import { isFullscreenActive, toggleFullscreen } from '../utils/fullscreen';
import { applyAppUpdate, usePwaUpdateStore } from '../services/pwaUpdateManager';
import {
  getProfileAvatar,
  getProfileColor,
  getProfileDisplayName,
  getProfileProgress,
} from '../services/profileService';

export const MobileDrawerMenu: React.FC = () => {
  const isMobileMenuOpen = useAppStoreSelector((s) => s.isMobileMenuOpen);
  if (!isMobileMenuOpen) return null;
  return <MobileDrawerMenuContent />;
};

const MobileDrawerMenuContent: React.FC = () => {
  const {
    profiles,
    activeProfileId,
    setProfileModalOpen,
    resetActivityToStarter,
    appMode,
    setAppMode,
    activeActivityId,
    activeActivityVersion,
    openCopyInSandbox,
    setMobileMenuOpen,
    activeSimId,
    setSimEnvironment,
    setSolutionOpen,
    setSaveModalOpen,
    setLoadModalOpen,
    setExportImportOpen,
    setLessonPickerOpen,
    setBadgeModalOpen,
    isMapHidden,
    toggleMapHidden,
    beatIsMuted,
    toggleBeatMuted,
    canRedo,
    redo,
    performanceMode,
    isAutoLowQuality,
    cyclePerformanceMode,
    isLowQuality,
  } = useAppStoreSelector((s) => ({
    profiles: s.profiles,
    activeProfileId: s.activeProfileId,
    setProfileModalOpen: s.setProfileModalOpen,
    resetActivityToStarter: s.resetActivityToStarter,
    appMode: s.appMode,
    setAppMode: s.setAppMode,
    activeActivityId: s.activeActivityId,
    activeActivityVersion: s.activeActivityVersion,
    openCopyInSandbox: s.openCopyInSandbox,
    setMobileMenuOpen: s.setMobileMenuOpen,
    activeSimId: s.activeSimId,
    setSimEnvironment: s.setSimEnvironment,
    setSolutionOpen: s.setSolutionOpen,
    setSaveModalOpen: s.setSaveModalOpen,
    setLoadModalOpen: s.setLoadModalOpen,
    setExportImportOpen: s.setExportImportOpen,
    setLessonPickerOpen: s.setLessonPickerOpen,
    setBadgeModalOpen: s.setBadgeModalOpen,
    isMapHidden: s.isMapHidden,
    toggleMapHidden: s.toggleMapHidden,
    beatIsMuted: s.beatState.isMuted,
    toggleBeatMuted: s.toggleBeatMuted,
    canRedo: s.canRedo,
    redo: s.redo,
    performanceMode: s.performanceMode,
    isAutoLowQuality: s.isAutoLowQuality,
    cyclePerformanceMode: s.cyclePerformanceMode,
    isLowQuality: isLowQualityActive(s),
  }));

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setMobileMenuOpen]);

  const currentCurriculumActivity =
    getActivityAtVersion(activeActivityId, activeActivityVersion) ??
    getActivityLatest(activeActivityId) ??
    CURRICULUM_ACTIVITIES[0];

  const canShowSolution =
    appMode === 'curriculum'
      ? Boolean(
          currentCurriculumActivity?.referenceSolution ||
            currentCurriculumActivity?.partialHelp
        )
      : activeSimId === 'grid';

  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0];
  const activeAvatar = getProfileAvatar(activeProfile?.avatarId ?? 'robot');
  const activeColor = getProfileColor(activeProfile?.colorId ?? 'sky');
  const activeDisplayName = activeProfile ? getProfileDisplayName(activeProfile) : 'Player 1';
  const progress = getProfileProgress(activeProfileId);
  const completedCount = Object.keys(progress.completedLessons || {}).length;
  const badgeCount = (progress.earnedBadges || []).length;

  const handleToggleFullscreen = async () => {
    const active = await toggleFullscreen();
    setIsFullscreen(active);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Navigation Menu"
      data-testid="mobile-drawer-overlay"
      className="fixed inset-0 z-50 flex bg-black/65 backdrop-blur-sm"
      onClick={() => setMobileMenuOpen(false)}
    >
      <div
        data-testid="mobile-drawer-content"
        className="w-[88vw] max-w-[340px] h-full bg-slate-900 border-r border-slate-800 flex flex-col shadow-2xl p-3.5 sm:p-4 overflow-y-auto gap-3.5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden="true">
              {appMode === 'curriculum' ? '🎓' : '🤖'}
            </span>
            <span className="font-black text-white text-base tracking-tight">Menu</span>
          </div>
          <button
            type="button"
            data-testid="btn-close-mobile-menu"
            onClick={() => setMobileMenuOpen(false)}
            className="w-9 h-9 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pending PWA Update CTA */}
        {needRefresh && (
          <button
            type="button"
            data-testid="drawer-btn-pwa-update"
            disabled={isUpdating}
            onClick={() => {
              setMobileMenuOpen(false);
              void applyAppUpdate();
            }}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs rounded-2xl border-2 border-sky-300 shadow-lg active:scale-95 transition-all disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 stroke-[2.5] ${isUpdating ? 'animate-spin' : ''}`} />
            <span>{isUpdating ? 'Updating…' : 'Update App'}</span>
          </button>
        )}

        {/* Row 1: Primary File Actions (Save / Open / Share) — Immediately Visible */}
        <div className="grid grid-cols-3 gap-2 shrink-0">
          <button
            type="button"
            data-testid="drawer-btn-save"
            onClick={() => {
              setSaveModalOpen(true);
              setMobileMenuOpen(false);
            }}
            className="flex flex-col items-center justify-center gap-1.5 py-3 px-2 bg-slate-800 hover:bg-sky-700/80 text-white rounded-2xl border border-slate-700 active:scale-95 transition-all cursor-pointer"
          >
            <Save className="w-6 h-6 text-sky-400" />
            <span className="text-xs font-extrabold">Save</span>
          </button>
          <button
            type="button"
            data-testid="drawer-btn-load"
            onClick={() => {
              setLoadModalOpen(true);
              setMobileMenuOpen(false);
            }}
            className="flex flex-col items-center justify-center gap-1.5 py-3 px-2 bg-slate-800 hover:bg-amber-700/60 text-white rounded-2xl border border-slate-700 active:scale-95 transition-all cursor-pointer"
          >
            <FolderOpen className="w-6 h-6 text-amber-400" />
            <span className="text-xs font-extrabold">Open</span>
          </button>
          <button
            type="button"
            data-testid="drawer-btn-share"
            onClick={() => {
              setExportImportOpen(true);
              setMobileMenuOpen(false);
            }}
            className="flex flex-col items-center justify-center gap-1.5 py-3 px-2 bg-slate-800 hover:bg-indigo-700/80 text-white rounded-2xl border border-slate-700 active:scale-95 transition-all cursor-pointer"
          >
            <Share2 className="w-6 h-6 text-indigo-400" />
            <span className="text-xs font-extrabold">Share</span>
          </button>
        </div>

        {/* Row 2: Active Player Profile Card & Collectible Badges Button */}
        <div className="flex items-stretch gap-2 shrink-0">
          <button
            type="button"
            data-testid="drawer-btn-profile-switcher"
            aria-label={`Active Profile: ${activeDisplayName}. Switch player profile`}
            onClick={() => {
              setMobileMenuOpen(false);
              setProfileModalOpen(true);
            }}
            className="flex-1 min-w-0 flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-slate-950 hover:bg-slate-800 border-2 transition-all active:scale-[0.99] cursor-pointer"
            style={{ borderColor: `${activeColor.accentColor}99` }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="relative flex items-center justify-center w-11 h-11 rounded-xl border text-2xl shrink-0"
                style={{
                  backgroundColor: `${activeColor.accentColor}26`,
                  borderColor: activeColor.accentColor,
                }}
              >
                <span aria-hidden="true">{activeAvatar.emoji}</span>
                <span
                  aria-hidden="true"
                  className="absolute -bottom-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-black text-slate-950 border border-slate-900"
                  style={{ backgroundColor: activeColor.accentColor }}
                >
                  {activeColor.shapeSymbol}
                </span>
              </span>
              <div className="flex flex-col text-left min-w-0">
                <span className="font-black text-sm text-white truncate">{activeDisplayName}</span>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                  <span>⭐ {completedCount}</span>
                  <span data-testid="drawer-profile-badge-count">🏅 {badgeCount}</span>
                </div>
              </div>
            </div>
            <span className="px-2 py-1 rounded-xl bg-violet-600/30 border border-violet-400/50 text-violet-200 font-extrabold text-xs shrink-0">
              Players
            </span>
          </button>

          <button
            type="button"
            data-testid="drawer-btn-badges"
            aria-label={`Open Badges (${badgeCount} earned)`}
            onClick={() => {
              setMobileMenuOpen(false);
              setBadgeModalOpen(true);
            }}
            className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 border-2 border-amber-400/50 text-amber-200 active:scale-95 transition-all shrink-0 cursor-pointer"
          >
            <span className="text-xl leading-none" aria-hidden="true">
              🏅
            </span>
            <span className="text-[11px] font-extrabold leading-none">Badges</span>
          </button>
        </div>

        {/* Row 3: Mode Switcher, Sandbox Worlds & Lessons/Maps Picker */}
        <div className="flex flex-col gap-2 shrink-0">
          <div
            role="group"
            aria-label="Application Mode"
            className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800"
          >
            <button
              data-testid="drawer-mode-curriculum"
              type="button"
              aria-pressed={appMode === 'curriculum'}
              onClick={() => setAppMode('curriculum')}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer ${
                appMode === 'curriculum'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span aria-hidden="true">🎓</span>
              <span>Learn</span>
            </button>
            <button
              data-testid="drawer-mode-sandbox"
              type="button"
              aria-pressed={appMode === 'sandbox'}
              onClick={() => setAppMode('sandbox')}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer ${
                appMode === 'sandbox'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span aria-hidden="true">🛠️</span>
              <span>Sandbox</span>
            </button>
          </div>

          {/* Sandbox World Switcher Tiles */}
          {appMode === 'sandbox' && (
            <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
              <button
                type="button"
                data-testid="drawer-tab-grid"
                onClick={() => setSimEnvironment('grid')}
                className={`flex items-center justify-center gap-1 py-2 rounded-xl font-extrabold text-xs transition-all cursor-pointer ${
                  activeSimId === 'grid'
                    ? 'bg-sky-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span aria-hidden="true">🤖</span>
                <span>Grid</span>
              </button>
              <button
                type="button"
                data-testid="drawer-tab-turtle"
                onClick={() => setSimEnvironment('turtle')}
                className={`flex items-center justify-center gap-1 py-2 rounded-xl font-extrabold text-xs transition-all cursor-pointer ${
                  activeSimId === 'turtle'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span aria-hidden="true">🐢</span>
                <span>Art</span>
              </button>
              <button
                type="button"
                data-testid="drawer-tab-beat"
                onClick={() => setSimEnvironment('beat')}
                className={`flex items-center justify-center gap-1 py-2 rounded-xl font-extrabold text-xs transition-all cursor-pointer ${
                  activeSimId === 'beat'
                    ? 'bg-fuchsia-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span aria-hidden="true">🎵</span>
                <span>Beat</span>
              </button>
            </div>
          )}

          {/* Big Lessons & Maps Picker CTA */}
          <button
            type="button"
            data-testid="drawer-btn-lesson-picker"
            onClick={() => {
              setMobileMenuOpen(false);
              setLessonPickerOpen(true);
            }}
            className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-2xl bg-indigo-600/25 hover:bg-indigo-600/35 border border-indigo-400/50 text-indigo-100 font-extrabold text-sm active:scale-[0.99] transition-all cursor-pointer"
          >
            <Map className="w-5 h-5 text-indigo-300" />
            <span>Lessons &amp; Maps</span>
          </button>
        </div>

        {/* Row 4: Secondary Kid-Friendly Tools Grid */}
        <div className="grid grid-cols-2 gap-2 shrink-0">
          {/* Sound On / Muted */}
          <button
            type="button"
            data-testid="drawer-btn-sound"
            aria-pressed={!beatIsMuted}
            onClick={toggleBeatMuted}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border font-bold text-xs active:scale-95 transition-all cursor-pointer ${
              beatIsMuted
                ? 'bg-slate-800 text-slate-400 border-slate-700'
                : 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40'
            }`}
          >
            {beatIsMuted ? (
              <VolumeX className="w-4 h-4 text-slate-400 shrink-0" />
            ) : (
              <Volume2 className="w-4 h-4 text-emerald-300 shrink-0" />
            )}
            <span>{beatIsMuted ? 'Muted' : 'Sound On'}</span>
          </button>

          {/* Redo */}
          <button
            type="button"
            data-testid="drawer-btn-redo"
            disabled={!canRedo}
            onClick={redo}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border font-bold text-xs transition-all ${
              canRedo
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 active:scale-95 cursor-pointer'
                : 'bg-slate-900/60 text-slate-600 border-slate-800 cursor-not-allowed opacity-50'
            }`}
          >
            <Redo2 className="w-4 h-4 shrink-0" />
            <span>Redo</span>
          </button>

          {/* Clue / Solution shortcut */}
          {canShowSolution && (
            <button
              type="button"
              data-testid="drawer-btn-solution"
              onClick={() => {
                setSolutionOpen(true);
                setMobileMenuOpen(false);
              }}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/40 font-bold text-xs active:scale-95 transition-all cursor-pointer"
            >
              <Lightbulb className="w-4 h-4 fill-amber-300 text-amber-300 shrink-0" />
              <span>Clue</span>
            </button>
          )}

          {/* Curriculum-specific tools: Start Over & Edit in Sandbox */}
          {appMode === 'curriculum' && (
            <>
              <button
                type="button"
                data-testid="drawer-btn-reset-to-starter"
                onClick={() => {
                  resetActivityToStarter();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-rose-200 border border-rose-400/40 font-bold text-xs active:scale-95 transition-all cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 shrink-0" />
                <span>Start Over</span>
              </button>

              <button
                type="button"
                data-testid="drawer-btn-open-copy-sandbox"
                onClick={openCopyInSandbox}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold text-xs active:scale-95 transition-all cursor-pointer"
              >
                <Copy className="w-4 h-4 shrink-0" />
                <span className="truncate">Edit in Sandbox</span>
              </button>
            </>
          )}

          {/* Mobile Stacked Layout Map Visibility Toggle */}
          <button
            type="button"
            data-testid="drawer-btn-toggle-map"
            onClick={() => {
              toggleMapHidden();
              setMobileMenuOpen(false);
            }}
            className={`md:hidden flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border font-bold text-xs active:scale-95 transition-all cursor-pointer ${
              isMapHidden
                ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            {isMapHidden ? (
              <EyeOff className="w-4 h-4 text-amber-300 shrink-0" />
            ) : (
              <Eye className="w-4 h-4 text-sky-400 shrink-0" />
            )}
            <span>{isMapHidden ? 'Show Map' : 'Hide Map'}</span>
          </button>

          {/* Fullscreen */}
          <button
            type="button"
            data-testid="drawer-btn-fullscreen"
            onClick={handleToggleFullscreen}
            className="flex items-center justify-center gap-2 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 font-bold text-xs active:scale-95 transition-all cursor-pointer"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 shrink-0" />
            ) : (
              <Maximize2 className="w-4 h-4 shrink-0" />
            )}
            <span>{isFullscreen ? 'Exit Full' : 'Fullscreen'}</span>
          </button>

          {/* Visual Quality Mode (Auto / Lite / Glow) */}
          <button
            type="button"
            data-testid="drawer-btn-quality-mode"
            data-quality-mode={performanceMode}
            data-quality={isLowQuality ? 'low' : 'high'}
            onClick={cyclePerformanceMode}
            aria-label={`Visual quality mode: ${
              performanceMode === 'auto'
                ? isAutoLowQuality
                  ? 'Auto (Lite)'
                  : 'Auto'
                : performanceMode === 'low'
                ? 'Lite'
                : 'Glow'
            }`}
            title="Cycle visual quality mode (Auto / Lite / Glow)"
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border font-bold text-xs active:scale-95 transition-colors cursor-pointer ${
              isLowQuality
                ? 'bg-amber-950/70 hover:bg-amber-900/70 text-amber-200 border-amber-500/60'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            <Gauge className={`w-4 h-4 shrink-0 ${isLowQuality ? 'text-amber-400' : 'text-sky-400'}`} />
            <span>
              {performanceMode === 'auto'
                ? isAutoLowQuality
                  ? 'Auto (Lite)'
                  : 'Auto'
                : performanceMode === 'low'
                ? 'Lite'
                : 'Glow'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
