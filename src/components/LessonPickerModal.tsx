import React, { useEffect, useRef } from 'react';
import { Check, Flame, GraduationCap, Lock, Sparkles, Wrench, X } from 'lucide-react';
import { PRESET_LEVELS, useAppStore } from '../store/useAppStore';
import {
  CURRICULUM_ACTIVITIES,
  CURRICULUM_MODULES,
  getActivitiesForModule,
} from '../data/curriculum';
import { LESSONS } from '../data/lessons';
import { getProfileProgress } from '../services/profileService';

export const LessonPickerModal: React.FC = () => {
  useAppStore();
  const {
    isLessonPickerOpen,
    setLessonPickerOpen,
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

  useEffect(() => {
    if (!isLessonPickerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        useAppStore.getState().setLessonPickerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLessonPickerOpen]);

  useEffect(() => {
    if (isLessonPickerOpen && activeCardRef.current?.scrollIntoView) {
      activeCardRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isLessonPickerOpen]);

  if (!isLessonPickerOpen) return null;

  const progress = getProfileProgress(activeProfileId);
  const earnedBadges = progress.earnedBadges || [];
  const challengeActivities = CURRICULUM_ACTIVITIES.filter((a) => a.format === 'challenge');
  const hasChallenges = challengeActivities.length > 0;

  // Highlight the first uncompleted activity in Learn mode as "Up Next"
  const nextUpActivity = CURRICULUM_ACTIVITIES.find((a) => !completedActivities[a.id]);

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
        {/* Top Mode Tabs & Close Button */}
        <div className="flex items-center justify-between gap-2 px-3 sm:px-5 py-3 bg-slate-800/80 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <h2 id="lesson-picker-title" className="sr-only">
              Choose Lesson or World
            </h2>
            <button
              type="button"
              data-testid="picker-mode-curriculum"
              aria-pressed={appMode === 'curriculum'}
              onClick={() => setAppMode('curriculum')}
              className={`h-10 sm:h-11 px-3.5 sm:px-5 rounded-xl font-extrabold text-sm sm:text-base flex items-center gap-2 transition-all cursor-pointer ${
                appMode === 'curriculum'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/50 ring-2 ring-indigo-300/60'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
              }`}
            >
              <GraduationCap className="w-5 h-5 shrink-0" />
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
                className="h-10 sm:h-11 px-3.5 sm:px-4 rounded-xl font-extrabold text-sm sm:text-base flex items-center gap-2 bg-slate-800 text-amber-300 hover:bg-slate-700 border border-slate-700 transition-all cursor-pointer"
              >
                <Flame className="w-5 h-5 shrink-0" />
                <span>Challenges</span>
              </button>
            )}

            <button
              type="button"
              data-testid="picker-mode-sandbox"
              aria-pressed={appMode === 'sandbox'}
              onClick={() => setAppMode('sandbox')}
              className={`h-10 sm:h-11 px-3.5 sm:px-5 rounded-xl font-extrabold text-sm sm:text-base flex items-center gap-2 transition-all cursor-pointer ${
                appMode === 'sandbox'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50 ring-2 ring-emerald-300/60'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
              }`}
            >
              <Wrench className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span>Sandbox</span>
            </button>
          </div>

          <button
            type="button"
            data-testid="btn-close-lesson-picker"
            onClick={() => setLessonPickerOpen(false)}
            aria-label="Close lesson picker"
            className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center border border-slate-700 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-3 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {appMode === 'curriculum' ? (
            <div className="space-y-4">
              {CURRICULUM_MODULES.map((mod) => {
                const activities = getActivitiesForModule(mod.id);
                const isBadgeEarned = earnedBadges.includes(mod.badgeId);

                if (activities.length === 0) {
                  return (
                    <div
                      key={mod.id}
                      data-testid={`module-coming-soon-${mod.id}`}
                      className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-800/40 border border-slate-800 text-slate-400"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xl opacity-60" aria-hidden="true">
                          {mod.icon}
                        </span>
                        <span className="font-bold text-sm truncate">
                          {mod.shortTitle}: {mod.badgeTitle}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 shrink-0">
                        <Lock className="w-3.5 h-3.5" />
                        <span>Soon</span>
                      </span>
                    </div>
                  );
                }

                const completedCount = activities.filter((a) => completedActivities[a.id]).length;

                return (
                  <section
                    key={mod.id}
                    data-testid={`module-section-${mod.id}`}
                    className="rounded-2xl bg-slate-800/50 border border-slate-700/80 p-3 sm:p-4 space-y-3"
                  >
                    {/* Module Header with Progress & Mastery Badge */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl" aria-hidden="true">
                          {mod.icon}
                        </span>
                        <div>
                          <h3 className="text-base sm:text-lg font-black text-white leading-tight">
                            {mod.shortTitle}
                          </h3>
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
                        <span
                          data-testid={`module-badge-${mod.id}`}
                          data-earned={isBadgeEarned ? 'true' : 'false'}
                          title={
                            isBadgeEarned
                              ? `${mod.badgeTitle} Badge Earned!`
                              : `Complete Capstones (${mod.capstoneIds.join(', ')}) to earn ${mod.badgeTitle}`
                          }
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold border transition-all ${
                            isBadgeEarned
                              ? 'bg-amber-500/25 border-amber-400 text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.35)]'
                              : 'bg-slate-900/60 border-slate-700/80 text-slate-500 opacity-75'
                          }`}
                        >
                          <span className="text-sm leading-none" aria-hidden="true">
                            {mod.badgeIcon}
                          </span>
                          <span className="hidden sm:inline">{mod.badgeTitle}</span>
                        </span>
                      </div>
                    </div>

                    {/* Visual Activity Cards Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-2.5">
                      {activities.map((act) => {
                        const isActive = act.id === activeActivityId;
                        const isCompleted = Boolean(completedActivities[act.id]);
                        const isCapstone = act.format === 'capstone';
                        const isNextUp = nextUpActivity?.id === act.id && !isActive;

                        return (
                          <button
                            key={act.id}
                            ref={isActive ? activeCardRef : undefined}
                            type="button"
                            data-testid={`btn-activity-${act.id}`}
                            aria-current={isActive ? 'true' : undefined}
                            onClick={() => {
                              setCurriculumActivity(act.id, act.version);
                              setLessonPickerOpen(false);
                            }}
                            className={`relative flex flex-col items-start justify-between p-2.5 sm:p-3 rounded-xl border text-left transition-all cursor-pointer min-h-[78px] ${
                              isActive
                                ? 'bg-indigo-600/35 border-indigo-400 ring-2 ring-indigo-400/70 text-white shadow-md'
                                : isCapstone
                                ? 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/50 text-amber-100'
                                : isCompleted
                                ? 'bg-emerald-950/35 hover:bg-slate-800 border-emerald-600/40 text-slate-100'
                                : isNextUp
                                ? 'bg-slate-800 hover:bg-slate-750 border-sky-400/70 ring-1 ring-sky-400/40 text-slate-100'
                                : 'bg-slate-900/80 hover:bg-slate-800 border-slate-700/80 text-slate-200'
                            }`}
                          >
                            <div className="w-full flex items-center justify-between gap-1">
                              <span className="inline-flex items-center gap-1.5 font-black text-sm sm:text-base">
                                <span className="text-lg leading-none" aria-hidden="true">
                                  {act.icon}
                                </span>
                                <span>{act.id}</span>
                              </span>

                              {isCompleted ? (
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

                            <span className="mt-1.5 text-xs font-bold leading-snug line-clamp-2 text-slate-200">
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
                        aria-current={isSelected ? 'true' : undefined}
                        onClick={() => {
                          setAppMode('sandbox');
                          setSimEnvironment('grid');
                          setLevel(lvl.id);
                          setLessonPickerOpen(false);
                        }}
                        className={`flex flex-col items-start justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
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
