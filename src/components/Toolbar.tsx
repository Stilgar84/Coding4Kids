import React from 'react';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Menu,
  Pause,
  Play,
  RefreshCw,
  Save,
  SkipBack,
  StepForward,
  Undo2,
  Zap,
} from 'lucide-react';
import { PRESET_LEVELS, useAppStore } from '../store/useAppStore';
import { ScopeType } from '../types';
import { validateLoopStructure } from '../engine/interpreter';
import { LESSONS } from '../data/lessons';
import {
  CURRICULUM_ACTIVITIES,
  getActivityAtVersion,
  getActivityLatest,
} from '../data/curriculum';
import { MobileDrawerMenu } from './MobileDrawerMenu';
import { reopenUpdatePrompt, usePwaUpdateStore } from '../services/pwaUpdateManager';
import {
  getProfileAvatar,
  getProfileColor,
  getProfileDisplayName,
} from '../services/profileService';

export const Toolbar: React.FC = () => {
  useAppStore();
  const {
    profiles,
    activeProfileId,
    setProfileModalOpen,
    completedActivities,
    appMode,
    activeActivityId,
    activeActivityVersion,
    setCurriculumActivity,
    statusAnnouncement,
    activeSimId,
    currentLevel,
    setLevel,
    isPlaying,
    play,
    pause,
    step,
    reset,
    speed,
    setSpeed,
    workspace,
    setSolutionOpen,
    setSaveModalOpen,
    setLessonPickerOpen,
    undo,
    canUndo,
    toggleMobileMenu,
    beatState,
    unlockBeatAudio,
  } = useAppStore.getState();

  const currentLesson = LESSONS.find((l) => l.id === currentLevel) || LESSONS[0];
  const currentCurriculumActivity =
    getActivityAtVersion(activeActivityId, activeActivityVersion) ??
    getActivityLatest(activeActivityId) ??
    CURRICULUM_ACTIVITIES[0];

  const hasLoopError = (['MAIN', 'F1', 'F2', 'F3'] as ScopeType[]).some((sc) => {
    return (workspace[sc]?.length ?? 0) > 0 && validateLoopStructure(workspace[sc]).hasError;
  });

  const isInstant = speed === 'instant' || (speed as any) === 0;

  const toggleSpeed = () => {
    if (speed === 400) setSpeed(100);
    else if (speed === 100) setSpeed(25);
    else if (speed === 25) setSpeed('instant');
    else setSpeed(400);
  };

  const getFullSpeedLabel = () => {
    if (isInstant) return 'Instant';
    if (speed === 25) return '16x';
    if (speed === 100) return '4x';
    return '1x';
  };

  const getCompactSpeedLabel = () => {
    if (isInstant) return '∞';
    if (speed === 25) return '16×';
    if (speed === 100) return '4×';
    return '1×';
  };

  const handlePrev = () => {
    if (appMode === 'curriculum') {
      if (CURRICULUM_ACTIVITIES.length === 0) return;
      const idx = CURRICULUM_ACTIVITIES.findIndex((a) => a.id === activeActivityId);
      const prevIdx = idx > 0 ? idx - 1 : CURRICULUM_ACTIVITIES.length - 1;
      setCurriculumActivity(CURRICULUM_ACTIVITIES[prevIdx].id);
    } else {
      const prevId = currentLevel > 1 ? currentLevel - 1 : PRESET_LEVELS.length;
      setLevel(prevId);
    }
  };

  const handleNext = () => {
    if (appMode === 'curriculum') {
      if (CURRICULUM_ACTIVITIES.length === 0) return;
      const idx = CURRICULUM_ACTIVITIES.findIndex((a) => a.id === activeActivityId);
      const nextIdx = idx >= 0 && idx < CURRICULUM_ACTIVITIES.length - 1 ? idx + 1 : 0;
      setCurriculumActivity(CURRICULUM_ACTIVITIES[nextIdx].id);
    } else {
      const nextId = currentLevel < PRESET_LEVELS.length ? currentLevel + 1 : 1;
      setLevel(nextId);
    }
  };

  const showPrevNextChevrons = appMode === 'curriculum' || activeSimId === 'grid';
  const canShowSolution =
    appMode === 'curriculum'
      ? Boolean(
          currentCurriculumActivity?.referenceSolution ||
            currentCurriculumActivity?.partialHelp
        )
      : activeSimId === 'grid';

  const { needRefresh, isPromptDismissed } = usePwaUpdateStore();

  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0];
  const activeAvatar = getProfileAvatar(activeProfile?.avatarId ?? 'robot');
  const activeColor = getProfileColor(activeProfile?.colorId ?? 'sky');
  const activeDisplayName = activeProfile ? getProfileDisplayName(activeProfile) : 'Player 1';

  const isCurrentActivityCompleted =
    appMode === 'curriculum' && Boolean(completedActivities[activeActivityId]);

  const cleanSandboxLessonTitle = currentLesson.title.replace(/^Course\s+\d+:\s*/i, '');

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="mode-status-announcer"
        className="sr-only"
      >
        {statusAnnouncement}
      </div>

      <header className="flex flex-nowrap items-center justify-between gap-1 sm:gap-2 px-1 sm:px-2.5 md:px-3 h-12 md:h-14 bg-slate-900 border-b-2 border-slate-800 shadow-md shrink-0 select-none z-30">
        {/* Left Cluster: Menu + Profile (md+) + Lesson/World Picker */}
        <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 min-w-0 shrink">
          <button
            type="button"
            data-testid="btn-hamburger-menu"
            onClick={toggleMobileMenu}
            className="flex items-center justify-center w-9 h-9 md:w-10 md:h-10 lg:w-11 lg:h-11 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 shadow-sm active:scale-95 transition-transform shrink-0 cursor-pointer"
            title="Menu"
            aria-label="Open Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Avatar Profile Pill (md+) */}
          <button
            type="button"
            data-testid="btn-profile-switcher"
            onClick={() => setProfileModalOpen(true)}
            aria-label={`Active Profile: ${activeDisplayName}. Switch player profile`}
            title={`Player: ${activeDisplayName}`}
            className="hidden md:flex items-center gap-1.5 px-2.5 h-10 lg:h-11 rounded-xl bg-slate-800 hover:bg-slate-700 border-2 transition-all active:scale-95 shrink-0 shadow-sm cursor-pointer"
            style={{ borderColor: `${activeColor.accentColor}99` }}
          >
            <span className="flex items-center justify-center text-base lg:text-lg leading-none">
              <span aria-hidden="true">{activeAvatar.emoji}</span>
              <span
                aria-hidden="true"
                className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-black text-slate-950"
                style={{ backgroundColor: activeColor.accentColor }}
              >
                {activeColor.shapeSymbol}
              </span>
            </span>
            <span className="hidden xl:inline text-xs font-extrabold text-slate-100 max-w-[96px] truncate">
              {activeDisplayName}
            </span>
          </button>

          {/* Unified Lesson / World Navigation Pill */}
          <div className="flex items-center h-9 md:h-10 lg:h-11 bg-slate-800/95 rounded-xl border border-slate-700 shadow-sm min-w-0 shrink overflow-hidden">
            {showPrevNextChevrons && (
              <button
                type="button"
                data-testid="btn-prev-lesson"
                onClick={handlePrev}
                className="hidden sm:flex items-center justify-center w-8 md:w-9 h-full text-slate-300 hover:text-white hover:bg-slate-700 active:bg-slate-600 transition-colors border-r border-slate-700/80 shrink-0 cursor-pointer"
                title={appMode === 'curriculum' ? 'Previous Activity' : 'Previous Map'}
                aria-label={appMode === 'curriculum' ? 'Previous Activity' : 'Previous Map'}
              >
                <ChevronLeft className="w-4 h-4 md:w-5 md:h-5 stroke-[2.5]" />
              </button>
            )}

            <button
              type="button"
              data-testid="btn-lesson-picker"
              onClick={() => setLessonPickerOpen(true)}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 md:px-3 h-full min-w-[36px] shrink hover:bg-slate-700/80 active:bg-slate-700 text-slate-100 font-extrabold text-xs sm:text-sm transition-colors cursor-pointer"
              title="Choose Lesson or World"
              aria-label={
                appMode === 'curriculum'
                  ? `Learn Activity ${activeActivityId}: ${currentCurriculumActivity?.title ?? ''}. Choose lesson or world`
                  : `Sandbox ${activeSimId === 'grid' ? `Map ${currentLevel}` : activeSimId}. Choose lesson or world`
              }
            >
              {appMode === 'curriculum' ? (
                <>
                  <span className="text-sm sm:text-base leading-none shrink-0" aria-hidden="true">
                    {currentCurriculumActivity?.icon || '🎓'}
                  </span>
                  <span className="font-black text-indigo-200 shrink-0">{activeActivityId}</span>
                  <span className="hidden sm:inline truncate max-w-[110px] md:max-w-[150px] lg:max-w-[230px] text-slate-200 font-bold">
                    {currentCurriculumActivity?.title}
                  </span>
                  {isCurrentActivityCompleted && (
                    <span
                      aria-hidden="true"
                      className="w-4 h-4 rounded-full bg-emerald-500 text-slate-950 inline-flex items-center justify-center shrink-0"
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  )}
                </>
              ) : activeSimId === 'grid' ? (
                <>
                  <span className="text-sm sm:text-base leading-none shrink-0" aria-hidden="true">
                    🤖
                  </span>
                  <span className="font-black text-sky-200 shrink-0">L{currentLevel}</span>
                  <span className="hidden sm:inline truncate max-w-[110px] md:max-w-[150px] lg:max-w-[220px] text-slate-200 font-bold">
                    {cleanSandboxLessonTitle}
                  </span>
                </>
              ) : activeSimId === 'beat' ? (
                <>
                  <span className="text-sm sm:text-base leading-none shrink-0" aria-hidden="true">
                    🎵
                  </span>
                  <span className="truncate font-bold text-fuchsia-200">Beat</span>
                </>
              ) : (
                <>
                  <span className="text-sm sm:text-base leading-none shrink-0" aria-hidden="true">
                    🐢
                  </span>
                  <span className="truncate font-bold text-emerald-200">Art</span>
                </>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            </button>

            {showPrevNextChevrons && (
              <button
                type="button"
                data-testid="btn-next-lesson"
                onClick={handleNext}
                className="hidden sm:flex items-center justify-center w-8 md:w-9 h-full text-slate-300 hover:text-white hover:bg-slate-700 active:bg-slate-600 transition-colors border-l border-slate-700/80 shrink-0 cursor-pointer"
                title={appMode === 'curriculum' ? 'Next Activity' : 'Next Map'}
                aria-label={appMode === 'curriculum' ? 'Next Activity' : 'Next Map'}
              >
                <ChevronRight className="w-4 h-4 md:w-5 md:h-5 stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>

        {/* Right Cluster: Update (md+) + Clue/Save + Transport Controls */}
        <div className="flex items-center gap-1 md:gap-1.5 shrink-0">
          {/* Snoozed PWA Update Indicator (md+) */}
          {needRefresh && isPromptDismissed && (
            <button
              type="button"
              data-testid="btn-toolbar-pwa-update"
              onClick={reopenUpdatePrompt}
              className="hidden md:flex items-center justify-center gap-1.5 px-2.5 h-10 lg:h-11 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 font-black rounded-xl border-2 border-sky-400/70 shadow-sm transition-transform active:scale-95 shrink-0 cursor-pointer"
              title="App update available"
              aria-label="App update available"
            >
              <RefreshCw className="w-4 h-4 text-sky-300" />
              <span className="hidden xl:inline text-xs">Update</span>
            </button>
          )}

          {/* Clue / Solution Button */}
          {canShowSolution && (
            <button
              type="button"
              data-testid="btn-solution"
              onClick={() => setSolutionOpen(true)}
              className="flex items-center justify-center gap-1.5 w-9 h-9 md:w-auto md:px-2.5 lg:px-3.5 md:h-10 lg:h-11 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl border-2 border-amber-300 shadow-sm transition-transform active:scale-95 shrink-0 cursor-pointer"
              title="Clue & Solution"
              aria-label="Clue and Solution"
            >
              <Lightbulb className="w-4 h-4 md:w-5 md:h-5 fill-slate-950 shrink-0" />
              <span className="hidden lg:inline text-sm">Clue</span>
            </button>
          )}

          {/* Save Button (always on md+, and on <md when Clue is absent in creative/sandbox worlds) */}
          <button
            type="button"
            data-testid="btn-save-modal"
            onClick={() => setSaveModalOpen(true)}
            className={`${
              canShowSolution ? 'hidden md:flex' : 'flex'
            } items-center justify-center gap-1.5 w-9 h-9 md:w-auto md:px-2.5 lg:px-3.5 md:h-10 lg:h-11 bg-sky-600 hover:bg-sky-500 text-white font-black rounded-xl border-2 border-sky-400 shadow-sm transition-transform active:scale-95 shrink-0 cursor-pointer`}
            title="Save"
            aria-label="Save Program"
          >
            <Save className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
            <span className="hidden lg:inline text-sm">Save</span>
          </button>

          {/* Undo */}
          <button
            type="button"
            data-testid="btn-undo"
            disabled={!canUndo}
            onClick={undo}
            className={`flex items-center justify-center w-9 h-9 md:w-10 md:h-10 lg:w-11 lg:h-11 rounded-xl border-2 transition-transform shrink-0 ${
              canUndo
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 active:scale-95 shadow-sm cursor-pointer'
                : 'bg-slate-900/60 text-slate-600 border-slate-800/80 cursor-not-allowed opacity-40'
            }`}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
          >
            <Undo2 className="w-4 h-4 md:w-5 md:h-5 stroke-[2.5]" />
          </button>

          {/* Reset (Rewind ⏮ — distinct from Undo) */}
          <button
            type="button"
            data-testid="btn-reset"
            onClick={reset}
            className="flex items-center justify-center w-9 h-9 md:w-10 md:h-10 lg:w-11 lg:h-11 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border-2 border-slate-700 transition-transform active:scale-95 shadow-sm shrink-0 cursor-pointer"
            title="Rewind to Start"
            aria-label="Reset Simulation"
          >
            <SkipBack className="w-4 h-4 md:w-5 md:h-5 stroke-[2.5]" />
          </button>

          {/* Step (Visible on all widths so kids can single-step on phones & tablets!) */}
          <button
            type="button"
            data-testid="btn-step"
            disabled={hasLoopError || isInstant}
            onPointerDown={() => {
              if (!beatState.isMuted) {
                unlockBeatAudio();
              }
            }}
            onClick={step}
            className={`flex items-center justify-center w-9 h-9 md:w-10 md:h-10 lg:w-11 lg:h-11 rounded-xl shadow-sm border-2 transition-transform shrink-0 ${
              hasLoopError || isInstant
                ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed opacity-55'
                : 'bg-sky-600 hover:bg-sky-500 text-white border-sky-400 active:scale-95 cursor-pointer'
            }`}
            title={
              hasLoopError
                ? 'Cannot step: unclosed loop'
                : isInstant
                ? 'Step disabled in Instant mode'
                : 'Step One Block'
            }
            aria-label="Step"
          >
            <StepForward className="w-4 h-4 md:w-5 md:h-5 stroke-[2.75]" />
          </button>

          {/* Play / Pause */}
          {isPlaying ? (
            <button
              type="button"
              data-testid="btn-pause"
              onClick={pause}
              className="flex items-center justify-center w-9 h-9 sm:w-10 md:w-11 md:h-10 lg:w-12 lg:h-11 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl shadow-md border-2 border-amber-300 transition-transform active:scale-95 shrink-0 cursor-pointer"
              title="Pause"
              aria-label="Pause"
            >
              <Pause className="w-5 h-5 md:w-6 md:h-6 stroke-[3]" />
            </button>
          ) : (
            <button
              type="button"
              data-testid="btn-play"
              disabled={hasLoopError}
              onPointerDown={() => {
                if (!beatState.isMuted) {
                  unlockBeatAudio();
                }
              }}
              onClick={play}
              className={`flex items-center justify-center w-9 h-9 sm:w-10 md:w-11 md:h-10 lg:w-12 lg:h-11 rounded-xl shadow-md border-2 transition-transform shrink-0 ${
                hasLoopError
                  ? 'bg-slate-800 border-red-500/60 text-slate-500 cursor-not-allowed opacity-60'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-300 active:scale-95 cursor-pointer'
              }`}
              title={hasLoopError ? 'Cannot play: unclosed loop' : 'Play'}
              aria-label="Play"
            >
              <Play className="w-5 h-5 md:w-6 md:h-6 stroke-[3] ml-0.5" />
            </button>
          )}

          {/* Speed Toggle (Visible on all widths with compact label on <sm) */}
          <button
            type="button"
            data-testid="btn-speed"
            onClick={toggleSpeed}
            className={`flex items-center justify-center gap-0.5 sm:gap-1 min-w-[36px] px-1.5 sm:px-2.5 h-9 md:h-10 lg:h-11 rounded-xl border-2 font-black text-xs sm:text-sm transition-all shrink-0 cursor-pointer ${
              isInstant
                ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-sm'
                : 'bg-slate-800 hover:bg-slate-700 text-yellow-400 border-slate-700'
            }`}
            title={`Speed: ${getFullSpeedLabel()}`}
            aria-label={`Simulation Speed: ${getFullSpeedLabel()}`}
          >
            <Zap
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${
                isInstant ? 'fill-slate-950 text-slate-950' : 'fill-yellow-400'
              }`}
            />
            <span className="sm:hidden">{getCompactSpeedLabel()}</span>
            <span className="hidden sm:inline">{getFullSpeedLabel()}</span>
          </button>
        </div>
      </header>

      {/* Unified Menu Drawer (Available on all screen widths) */}
      <MobileDrawerMenu />
    </>
  );
};
