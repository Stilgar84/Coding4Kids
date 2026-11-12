import React, { useEffect, useRef } from 'react';
import { Check, Flame, GraduationCap, Lock, Sparkles, Wrench, X } from 'lucide-react';
import { PRESET_LEVELS, useAppStore, useAppStoreSelector } from '../store/useAppStore';
import {
  CURRICULUM_ACTIVITIES,
  CURRICULUM_MODULES,
  CurriculumActivity,
  getActivitiesForModule,
} from '../data/curriculum';
import { LESSONS } from '../data/lessons';
import {
  ProfileCurriculumProgress,
  getProfileProgress,
} from '../services/profileService';

/**
 * Returns true when `?dev=1` or `?dev=true` is present in the URL query string (or explicit override).
 */
export function isDevQueryEnabled(searchOverride?: string): boolean {
  const rawSearch =
    searchOverride !== undefined
      ? searchOverride
      : typeof window !== 'undefined' && window.location?.search
      ? window.location.search
      : '';
  if (!rawSearch) return false;
  const normalized = rawSearch.startsWith('?') ? rawSearch : `?${rawSearch}`;
  try {
    const params = new URLSearchParams(normalized);
    const val = params.get('dev');
    return val === '1' || val === 'true';
  } catch {
    return false;
  }
}

/**
 * Determines whether a curriculum module is unlocked for the given profile progress.
 * Module 1 (`module-1`) is always unlocked by default.
 */
export function isCurriculumModuleUnlocked(
  moduleId: string,
  progress: ProfileCurriculumProgress,
  searchOverride?: string
): boolean {
  if (moduleId === 'module-1') return true;
  if (progress.unlockedModules.includes(moduleId)) return true;
  if (Boolean(progress.unlockAllModules)) return true;
  if (isDevQueryEnabled(searchOverride)) return true;
  return false;
}

/**
 * Resolves unmistakable kid-friendly format & world icons (`📖`, `🤖`, `🐢`, `🎵`, `🏆`, `🎨`)
 * for an activity card.
 */
export function getActivityFormatCues(act: CurriculumActivity): {
  formatIcon: string;
  worldIcon: string;
} {
  const worldIcon =
    act.simId === 'turtle'
      ? '🐢'
      : act.simId === 'beat'
      ? '🎵'
      : act.simId === 'switchyard'
      ? '🚂'
      : '🤖';

  let formatIcon = act.icon || worldIcon;
  if (act.format === 'explanation') {
    formatIcon = '📖';
  } else if (act.format === 'capstone') {
    const isCreative =
      act.capstoneType === 'creative' ||
      (act.capstoneType !== 'puzzle' && !act.referenceSolution);
    formatIcon = isCreative ? '🎨' : '🏆';
  } else if (act.format === 'challenge') {
    formatIcon = '🔥';
  } else {
    formatIcon = worldIcon;
  }

  return { formatIcon, worldIcon };
}

/**
 * Computes the next card index for keyboard arrow-key navigation across a 2D card grid.
 */
export function getNextGridFocusIndex(
  currentIndex: number,
  total: number,
  key: string,
  columns: number = 4
): number | null {
  if (total <= 0 || currentIndex < 0 || currentIndex >= total) return null;
  const safeCols = Math.max(1, columns);

  switch (key) {
    case 'ArrowRight':
      return (currentIndex + 1) % total;
    case 'ArrowLeft':
      return (currentIndex - 1 + total) % total;
    case 'ArrowDown': {
      const next = currentIndex + safeCols;
      return next < total ? next : currentIndex % safeCols;
    }
    case 'ArrowUp': {
      const prev = currentIndex - safeCols;
      if (prev >= 0) return prev;
      const col = currentIndex % safeCols;
      const lastRowStart = Math.floor((total - 1) / safeCols) * safeCols;
      const candidate = lastRowStart + col;
      return candidate < total ? candidate : Math.max(0, candidate - safeCols);
    }
    case 'Home':
      return 0;
    case 'End':
      return total - 1;
    default:
      return null;
  }
}

export const LessonPickerModal: React.FC = () => {
  const isLessonPickerOpen = useAppStoreSelector((s) => s.isLessonPickerOpen);
  if (!isLessonPickerOpen) return null;
  return <LessonPickerModalContent />;
};

const LessonPickerModalContent: React.FC = () => {
  useAppStore();
  const {
    isLessonPickerOpen,
    setLessonPickerOpen,
    setBadgeModalOpen,
    toggleUnlockAllModules,
    appMode,
    setAppMode,
    activeActivityId,
    setCurriculumActivity,
    completedActivities,
    activeProfileId,
    activeSimId,
    setSimEnvironment,
    currentLevel,
    setLevel,
  } = useAppStore.getState();

  const activeCardRef = useRef<HTMLButtonElement | null>(null);
  const contentContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isLessonPickerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (useAppStore.getState().isBadgeModalOpen) return;
        e.preventDefault();
        useAppStore.getState().setLessonPickerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLessonPickerOpen]);

  useEffect(() => {
    if (!isLessonPickerOpen) return;
    if (activeCardRef.current?.scrollIntoView) {
      activeCardRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    const timer = setTimeout(() => {
      if (activeCardRef.current && !activeCardRef.current.disabled) {
        activeCardRef.current.focus();
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [isLessonPickerOpen]);

  if (!isLessonPickerOpen) return null;

  const progress = getProfileProgress(activeProfileId);
  const earnedBadges = progress.earnedBadges || [];
  const isUnlockAll = Boolean(progress.unlockAllModules);
  const challengeActivities = CURRICULUM_ACTIVITIES.filter((a) => a.format === 'challenge');
  const hasChallenges = challengeActivities.length > 0;

  // Highlight the first uncompleted activity inside an unlocked module as "Up Next"
  const nextUpActivity = CURRICULUM_ACTIVITIES.find(
    (a) => !completedActivities[a.id] && isCurriculumModuleUnlocked(a.moduleId, progress)
  );

  const openBadgeShowcase = () => {
    setLessonPickerOpen(false);
    setBadgeModalOpen(true);
  };

  const handleGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      e.key !== 'ArrowRight' &&
      e.key !== 'ArrowLeft' &&
      e.key !== 'ArrowDown' &&
      e.key !== 'ArrowUp' &&
      e.key !== 'Home' &&
      e.key !== 'End'
    ) {
      return;
    }

    const container = contentContainerRef.current;
    if (!container || typeof document === 'undefined') return;
    const activeEl = document.activeElement as HTMLElement | null;
    if (!activeEl || !container.contains(activeEl)) return;

    const cardAttr = activeEl.getAttribute('data-picker-card');
    if (!cardAttr) return;

    const cards = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        `button[data-picker-card="${cardAttr}"]:not([disabled])`
      )
    );
    const currentIdx = cards.indexOf(activeEl as HTMLButtonElement);
    if (currentIdx === -1 || cards.length === 0) return;

    // Use real visual coordinates for Up/Down across multi-section grids when layout rects exist
    const currentRect = cards[currentIdx].getBoundingClientRect();
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && currentRect.width > 0) {
      const centerX = currentRect.left + currentRect.width / 2;
      const candidates = cards
        .map((el, idx) => ({ idx, rect: el.getBoundingClientRect() }))
        .filter(({ idx, rect }) =>
          idx !== currentIdx &&
          (e.key === 'ArrowDown'
            ? rect.top > currentRect.top + 8
            : rect.bottom < currentRect.bottom - 8)
        );

      if (candidates.length > 0) {
        candidates.sort((a, b) => {
          const dyA =
            e.key === 'ArrowDown'
              ? a.rect.top - currentRect.top
              : currentRect.top - a.rect.top;
          const dyB =
            e.key === 'ArrowDown'
              ? b.rect.top - currentRect.top
              : currentRect.top - b.rect.top;
          if (Math.abs(dyA - dyB) > 12) return dyA - dyB;
          const dxA = Math.abs(a.rect.left + a.rect.width / 2 - centerX);
          const dxB = Math.abs(b.rect.left + b.rect.width / 2 - centerX);
          return dxA - dxB;
        });
        e.preventDefault();
        cards[candidates[0].idx]?.focus();
        return;
      }
    }

    const fallbackIdx = getNextGridFocusIndex(currentIdx, cards.length, e.key, 4);
    if (fallbackIdx !== null && cards[fallbackIdx]) {
      e.preventDefault();
      cards[fallbackIdx].focus();
    }
  };

  return (
    <div
      data-testid="lesson-picker-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lesson-picker-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm"
      onClick={() => setLessonPickerOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Top Mode Tabs, Badges, Unlock All & Close Button */}
        <div className="flex items-center justify-between gap-1.5 sm:gap-2 px-2.5 sm:px-5 py-2.5 sm:py-3 bg-slate-800/80 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <h2 id="lesson-picker-title" className="sr-only">
              Choose Lesson or World
            </h2>
            <button
              type="button"
              data-testid="picker-mode-curriculum"
              aria-pressed={appMode === 'curriculum'}
              onClick={() => setAppMode('curriculum')}
              className={`h-9 sm:h-11 px-3 sm:px-4 rounded-xl font-extrabold text-xs sm:text-base flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer ${
                appMode === 'curriculum'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/50 ring-2 ring-indigo-300/60'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
              }`}
            >
              <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span>Learn</span>
            </button>

            {hasChallenges && (
              <button
                type="button"
                data-testid="picker-mode-challenges"
                onClick={() => {
                  setAppMode('curriculum');
                  const firstChallenge = challengeActivities[0];
                  if (firstChallenge) {
                    setCurriculumActivity(firstChallenge.id);
                    setLessonPickerOpen(false);
                  }
                }}
                className="h-9 sm:h-11 px-2.5 sm:px-4 rounded-xl font-extrabold text-xs sm:text-base flex items-center gap-1.5 bg-slate-800 text-amber-300 hover:bg-slate-700 border border-slate-700 transition-all cursor-pointer"
              >
                <Flame className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span className="hidden sm:inline">Challenges</span>
              </button>
            )}

            <button
              type="button"
              data-testid="picker-mode-sandbox"
              aria-pressed={appMode === 'sandbox'}
              onClick={() => setAppMode('sandbox')}
              className={`h-9 sm:h-11 px-3 sm:px-4 rounded-xl font-extrabold text-xs sm:text-base flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer ${
                appMode === 'sandbox'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50 ring-2 ring-emerald-300/60'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
              }`}
            >
              <Wrench className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span>Sandbox</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Collectible Badges Showcase Button */}
            <button
              type="button"
              data-testid="btn-open-badges"
              onClick={openBadgeShowcase}
              aria-label={`Badges (${earnedBadges.length} of ${CURRICULUM_MODULES.length} earned)`}
              title="My Badges"
              className="h-9 sm:h-11 min-w-[38px] px-2.5 sm:px-3.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/50 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            >
              <span className="text-base leading-none" aria-hidden="true">
                🏅
              </span>
              <span className="hidden sm:inline">Badges</span>
              <span className="px-1.5 py-0.5 rounded-full bg-slate-900/80 text-[11px] font-black text-amber-300">
                {earnedBadges.length}
              </span>
            </button>

            {/* Kid / Teacher 1-Tap Unlock All Modules Toggle */}
            <button
              type="button"
              data-testid="btn-toggle-unlock-all"
              aria-pressed={isUnlockAll}
              onClick={() => toggleUnlockAllModules()}
              aria-label={
                isUnlockAll
                  ? 'All modules unlocked. Switch to sequential unlock'
                  : 'Unlock all modules'
              }
              title={isUnlockAll ? 'All Modules Open' : 'Unlock All Modules'}
              className={`h-9 sm:h-11 min-w-[38px] px-2.5 sm:px-3 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 border transition-all active:scale-95 cursor-pointer ${
                isUnlockAll
                  ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200 shadow-sm'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              <span className="text-base leading-none" aria-hidden="true">
                {isUnlockAll ? '🔓' : '🔒'}
              </span>
              <span className="hidden md:inline">
                {isUnlockAll ? 'All Open' : 'Unlock All'}
              </span>
            </button>

            <button
              type="button"
              data-testid="btn-close-lesson-picker"
              onClick={() => setLessonPickerOpen(false)}
              aria-label="Close lesson picker"
              className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center border border-slate-700 transition-colors cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div
          ref={contentContainerRef}
          onKeyDown={handleGridKeyDown}
          className="p-3 sm:p-5 overflow-y-auto space-y-4 flex-1"
        >
          {appMode === 'curriculum' ? (
            <div className="space-y-4">
              {CURRICULUM_MODULES.map((mod) => {
                const activities = getActivitiesForModule(mod.id);
                const isBadgeEarned = earnedBadges.includes(mod.badgeId);
                const isModuleUnlocked = isCurriculumModuleUnlocked(mod.id, progress);

                if (activities.length === 0) {
                  return (
                    <div
                      key={mod.id}
                      data-testid={`module-coming-soon-${mod.id}`}
                      className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-slate-800/40 border border-slate-800 text-slate-400"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xl opacity-60" aria-hidden="true">
                          {mod.icon}
                        </span>
                        <span className="font-bold text-sm truncate">
                          {mod.shortTitle}: {mod.badgeTitle}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          data-testid={`module-badge-${mod.id}`}
                          data-earned={isBadgeEarned ? 'true' : 'false'}
                          onClick={openBadgeShowcase}
                          aria-label={`${mod.badgeTitle} badge (${
                            isBadgeEarned ? 'earned' : 'locked'
                          }). Open badge collection`}
                          className={`inline-flex items-center gap-1 px-2.5 min-h-[36px] rounded-full text-xs font-extrabold border transition-all cursor-pointer ${
                            isBadgeEarned
                              ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                              : 'bg-slate-900/60 border-slate-700/80 text-slate-400 hover:border-slate-600'
                          }`}
                        >
                          <span aria-hidden="true">{mod.badgeIcon}</span>
                        </button>
                        <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 shrink-0">
                          <Lock className="w-3.5 h-3.5" />
                          <span>Soon</span>
                        </span>
                      </div>
                    </div>
                  );
                }

                const completedCount = activities.filter((a) => completedActivities[a.id]).length;

                return (
                  <section
                    key={mod.id}
                    data-testid={`module-section-${mod.id}`}
                    data-unlocked={isModuleUnlocked ? 'true' : 'false'}
                    className={`rounded-2xl border p-3 sm:p-4 space-y-3 transition-colors ${
                      isModuleUnlocked
                        ? 'bg-slate-800/50 border-slate-700/80'
                        : 'bg-slate-900/60 border-slate-800'
                    }`}
                  >
                    {/* Module Header with Lock Status, Progress & Clickable Mastery Badge */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`text-2xl ${!isModuleUnlocked ? 'opacity-60' : ''}`}
                          aria-hidden="true"
                        >
                          {mod.icon}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base sm:text-lg font-black text-white leading-tight">
                              {mod.shortTitle}
                            </h3>
                            {!isModuleUnlocked && (
                              <span
                                data-testid={`module-locked-${mod.id}`}
                                title="Complete the previous module or tap Unlock All"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-950 border border-amber-500/40 text-xs font-extrabold text-amber-300"
                              >
                                <span aria-hidden="true">🔒</span>
                                <span className="sr-only">Locked</span>
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 font-medium hidden sm:block">
                            {mod.badgeTitle}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          data-testid={`module-progress-${mod.id}`}
                          className="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-700 text-xs font-extrabold text-emerald-300"
                        >
                          {completedCount}/{activities.length} ✓
                        </span>
                        <button
                          type="button"
                          data-testid={`module-badge-${mod.id}`}
                          data-earned={isBadgeEarned ? 'true' : 'false'}
                          onClick={openBadgeShowcase}
                          aria-label={`${mod.badgeTitle} badge (${
                            isBadgeEarned ? 'earned' : 'locked'
                          }). Open badge collection`}
                          title={
                            isBadgeEarned
                              ? `${mod.badgeTitle} Badge Earned! Tap to view badges`
                              : `Tap to view ${mod.badgeTitle} badge progress`
                          }
                          className={`inline-flex items-center gap-1.5 px-2.5 min-h-[36px] sm:min-h-[38px] rounded-full text-xs font-extrabold border transition-all active:scale-95 cursor-pointer ${
                            isBadgeEarned
                              ? 'bg-amber-500/25 border-amber-400 text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.35)] hover:bg-amber-500/35'
                              : 'bg-slate-900/60 border-slate-700/80 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                          }`}
                        >
                          <span className="text-sm leading-none" aria-hidden="true">
                            {mod.badgeIcon}
                          </span>
                          <span className="hidden sm:inline">{mod.badgeTitle}</span>
                        </button>
                      </div>
                    </div>

                    {/* Visual Activity Cards Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-2.5">
                      {activities.map((act) => {
                        const isActive = act.id === activeActivityId;
                        const isCompleted = Boolean(completedActivities[act.id]);
                        const isCapstone = act.format === 'capstone';
                        const isNextUp =
                          isModuleUnlocked && nextUpActivity?.id === act.id && !isActive;
                        const { formatIcon, worldIcon } = getActivityFormatCues(act);

                        return (
                          <button
                            key={act.id}
                            ref={isActive && isModuleUnlocked ? activeCardRef : undefined}
                            type="button"
                            data-testid={`btn-activity-${act.id}`}
                            data-picker-card="curriculum"
                            disabled={!isModuleUnlocked}
                            aria-disabled={!isModuleUnlocked ? 'true' : undefined}
                            aria-current={isActive ? 'true' : undefined}
                            onClick={() => {
                              if (!isModuleUnlocked) return;
                              setCurriculumActivity(act.id, act.version);
                              setLessonPickerOpen(false);
                            }}
                            className={`relative flex flex-col items-start justify-between p-2.5 sm:p-3 rounded-xl border text-left transition-all min-h-[78px] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                              !isModuleUnlocked
                                ? 'bg-slate-950/70 border-slate-800 text-slate-500 opacity-55 cursor-not-allowed'
                                : isActive
                                ? 'bg-indigo-600/35 border-indigo-400 ring-2 ring-indigo-400/70 text-white shadow-md cursor-pointer'
                                : isCapstone
                                ? 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/50 text-amber-100 cursor-pointer'
                                : isCompleted
                                ? 'bg-emerald-950/35 hover:bg-slate-800 border-emerald-600/40 text-slate-100 cursor-pointer'
                                : isNextUp
                                ? 'bg-slate-800 hover:bg-slate-750 border-sky-400/70 ring-1 ring-sky-400/40 text-slate-100 cursor-pointer'
                                : 'bg-slate-900/80 hover:bg-slate-800 border-slate-700/80 text-slate-200 cursor-pointer'
                            }`}
                          >
                            <div className="w-full flex items-center justify-between gap-1">
                              <span className="inline-flex items-center gap-1.5 font-black text-sm sm:text-base">
                                <span
                                  data-testid={`format-badge-${act.id}`}
                                  data-format={act.format}
                                  className="inline-flex items-center gap-0.5 leading-none"
                                  aria-hidden="true"
                                >
                                  <span className="text-lg">{formatIcon}</span>
                                  {formatIcon !== worldIcon && (
                                    <span className="text-xs opacity-90">{worldIcon}</span>
                                  )}
                                </span>
                                <span>{act.id}</span>
                              </span>

                              {!isModuleUnlocked ? (
                                <Lock
                                  className="w-3.5 h-3.5 text-slate-500 shrink-0"
                                  aria-hidden="true"
                                />
                              ) : isCompleted ? (
                                <span
                                  data-testid={`completed-badge-${act.id}`}
                                  className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-sm shrink-0"
                                  title="Completed"
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                </span>
                              ) : isCapstone ? (
                                <Sparkles
                                  className="w-4 h-4 text-amber-300 shrink-0"
                                  aria-hidden="true"
                                />
                              ) : null}
                            </div>

                            <span
                              className={`mt-1.5 text-xs font-bold leading-snug line-clamp-2 ${
                                !isModuleUnlocked ? 'text-slate-500' : 'text-slate-200'
                              }`}
                            >
                              {act.title}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            /* Sandbox Tab: 3 World Tiles + Grid Course Maps */
            <div className="space-y-4">
              {/* 3 Colorful World Tiles */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <button
                  type="button"
                  data-testid="sim-tab-grid"
                  aria-pressed={activeSimId === 'grid'}
                  onClick={() => {
                    setAppMode('sandbox');
                    setSimEnvironment('grid');
                    setLessonPickerOpen(false);
                  }}
                  className={`flex flex-col items-center justify-center gap-1.5 p-3 sm:p-4 rounded-2xl border-2 font-extrabold transition-all cursor-pointer ${
                    activeSimId === 'grid'
                      ? 'bg-sky-600/30 border-sky-400 text-white shadow-lg ring-2 ring-sky-400/40'
                      : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  <span className="text-3xl sm:text-4xl" aria-hidden="true">
                    🤖
                  </span>
                  <span className="text-xs sm:text-sm">Robot Grid</span>
                </button>

                <button
                  type="button"
                  data-testid="sim-tab-turtle"
                  aria-pressed={activeSimId === 'turtle'}
                  onClick={() => {
                    setAppMode('sandbox');
                    setSimEnvironment('turtle');
                    setLessonPickerOpen(false);
                  }}
                  className={`flex flex-col items-center justify-center gap-1.5 p-3 sm:p-4 rounded-2xl border-2 font-extrabold transition-all cursor-pointer ${
                    activeSimId === 'turtle'
                      ? 'bg-emerald-600/30 border-emerald-400 text-white shadow-lg ring-2 ring-emerald-400/40'
                      : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  <span className="text-3xl sm:text-4xl" aria-hidden="true">
                    🐢
                  </span>
                  <span className="text-xs sm:text-sm">Turtle Art</span>
                </button>

                <button
                  type="button"
                  data-testid="sim-tab-beat"
                  aria-pressed={activeSimId === 'beat'}
                  onClick={() => {
                    setAppMode('sandbox');
                    setSimEnvironment('beat');
                    setLessonPickerOpen(false);
                  }}
                  className={`flex flex-col items-center justify-center gap-1.5 p-3 sm:p-4 rounded-2xl border-2 font-extrabold transition-all cursor-pointer ${
                    activeSimId === 'beat'
                      ? 'bg-fuchsia-600/30 border-fuchsia-400 text-white shadow-lg ring-2 ring-fuchsia-400/40'
                      : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  <span className="text-3xl sm:text-4xl" aria-hidden="true">
                    🎵
                  </span>
                  <span className="text-xs sm:text-sm">Beat &amp; Light</span>
                </button>
              </div>

              {/* Grid Course Maps */}
              <div className="rounded-2xl bg-slate-800/50 border border-slate-700/80 p-3 sm:p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-200 flex items-center gap-2">
                    <span aria-hidden="true">🗺️</span>
                    <span>Robot Maps</span>
                  </h3>
                  <span className="text-xs font-bold text-slate-400">
                    {PRESET_LEVELS.length} maps
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PRESET_LEVELS.map((lvl) => {
                    const lessonMeta = LESSONS.find((l) => l.id === lvl.id);
                    const isSelected = activeSimId === 'grid' && currentLevel === lvl.id;
                    const cleanTitle = lessonMeta
                      ? lessonMeta.title.replace(/^Course\s+\d+:\s*/i, '')
                      : `Map ${lvl.id}`;

                    return (
                      <button
                        key={lvl.id}
                        type="button"
                        data-testid={`btn-level-${lvl.id}`}
                        data-picker-card="sandbox-level"
                        aria-current={isSelected ? 'true' : undefined}
                        onClick={() => {
                          setAppMode('sandbox');
                          setSimEnvironment('grid');
                          setLevel(lvl.id);
                          setLessonPickerOpen(false);
                        }}
                        className={`flex flex-col items-start justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                          isSelected
                            ? 'bg-sky-600/35 border-sky-400 ring-2 ring-sky-400/60 text-white shadow-sm'
                            : 'bg-slate-900/80 hover:bg-slate-800 border-slate-700/80 text-slate-200'
                        }`}
                      >
                        <div className="w-full flex items-center justify-between gap-1">
                          <span className="font-black text-sm text-sky-300">#{lvl.id}</span>
                          <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                            {lvl.width}×{lvl.height}
                          </span>
                        </div>
                        <span className="mt-1 text-xs font-bold truncate w-full">{cleanTitle}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
