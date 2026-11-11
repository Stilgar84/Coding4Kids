import React, { useEffect } from 'react';
import { Play, Sparkles } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import {
  CURRICULUM_ACTIVITIES,
  CURRICULUM_MODULES,
  getActivityAtVersion,
  getActivityLatest,
} from '../data/curriculum';

export const VictoryCelebrationModal: React.FC = () => {
  useAppStore();
  const {
    isVictoryModalOpen,
    victoryEarnedBadges,
    dismissVictoryModal,
    appMode,
    activeActivityId,
    activeActivityVersion,
    speed,
    setCurriculumActivity,
  } = useAppStore.getState();

  useEffect(() => {
    if (!isVictoryModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        useAppStore.getState().dismissVictoryModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVictoryModalOpen]);

  if (!isVictoryModalOpen) return null;

  const activeActivity =
    appMode === 'curriculum'
      ? getActivityAtVersion(activeActivityId, activeActivityVersion) ??
        getActivityLatest(activeActivityId)
      : undefined;

  const isCapstone = Boolean(activeActivity && activeActivity.format === 'capstone');
  const earnedModules = CURRICULUM_MODULES.filter((m) =>
    victoryEarnedBadges.includes(m.badgeId)
  );
  const earnedModule =
    earnedModules.length > 0
      ? earnedModules[0]
      : isCapstone && activeActivity
      ? CURRICULUM_MODULES.find((m) => m.id === activeActivity.moduleId)
      : undefined;
  const isBadgeOrCapstone = victoryEarnedBadges.length > 0 || isCapstone;

  const liveAnnouncementText =
    earnedModules.length > 0
      ? `Module Mastery Badge unlocked: ${earnedModules
          .map((m) => m.badgeTitle)
          .join(', ')}!${activeActivity ? ` Completed ${activeActivity.title}.` : ''}`
      : isCapstone
      ? `Capstone completed${activeActivity ? `: ${activeActivity.title}` : ''}!`
      : `Puzzle completed${activeActivity ? `: ${activeActivity.title}` : ''}!`;

  const currentActivityIdx =
    appMode === 'curriculum' && activeActivity
      ? CURRICULUM_ACTIVITIES.findIndex((a) => a.id === activeActivity.id)
      : -1;
  const nextActivity =
    currentActivityIdx >= 0 && currentActivityIdx < CURRICULUM_ACTIVITIES.length - 1
      ? CURRICULUM_ACTIVITIES[currentActivityIdx + 1]
      : undefined;

  const entranceClass =
    speed === 'instant' || (speed as any) === 0
      ? 'animate-victory-enter'
      : 'animate-victory-enter-delayed';

  return (
    <div
      data-testid="victory-modal"
      data-ceremony={isBadgeOrCapstone ? 'badge' : 'standard'}
      role="dialog"
      aria-modal="true"
      aria-label="Puzzle Completed Celebration"
      onClick={() => dismissVictoryModal()}
      className={`fixed inset-0 z-[70] flex flex-col items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md cursor-pointer select-none ${entranceClass}`}
    >
      {/* Screen-reader polite completion & badge unlock announcement */}
      <div
        data-testid="victory-live-announcement"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {liveAnnouncementText}
      </div>

      {/* Radial celebratory glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
      >
        <div
          className={`w-[360px] h-[360px] sm:w-[480px] sm:h-[480px] rounded-full blur-3xl opacity-35 animate-celebration-pulse ${
            isBadgeOrCapstone
              ? 'bg-gradient-to-tr from-amber-400 via-yellow-300 to-emerald-400'
              : 'bg-gradient-to-tr from-emerald-400 via-amber-300 to-sky-400'
          }`}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center max-w-md w-full gap-4 sm:gap-5">
        {/* Big Visual Illustration */}
        {isBadgeOrCapstone ? (
          <div className="relative flex flex-col items-center">
            <svg
              viewBox="0 0 240 210"
              className="w-52 h-44 sm:w-64 sm:h-56 drop-shadow-[0_12px_28px_rgba(251,191,36,0.45)] animate-celebration-float"
              aria-hidden="true"
            >
              {/* Confetti sparkles */}
              <g className="animate-confetti-sparkle">
                <circle cx="34" cy="40" r="6" fill="#34d399" />
                <circle cx="206" cy="36" r="7" fill="#60a5fa" />
                <circle cx="26" cy="138" r="5" fill="#f472b6" />
                <circle cx="214" cy="142" r="6" fill="#fbbf24" />
                <polygon points="62,22 66,32 76,32 68,38 71,48 62,42 53,48 56,38 48,32 58,32" fill="#fde047" />
                <polygon points="178,20 182,30 192,30 184,36 187,46 178,40 169,46 172,36 164,30 174,30" fill="#fde047" />
              </g>

              {/* Golden Trophy Cup */}
              <defs>
                <linearGradient id="trophyGold" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#fef08a" />
                  <stop offset="50%" stopColor="#fbbf24" />
                  <stop offset="100%" stopColor="#d97706" />
                </linearGradient>
              </defs>
              {/* Handles */}
              <path
                d="M72 62 C44 62, 44 106, 76 110"
                fill="none"
                stroke="url(#trophyGold)"
                strokeWidth="10"
                strokeLinecap="round"
              />
              <path
                d="M168 62 C196 62, 196 106, 164 110"
                fill="none"
                stroke="url(#trophyGold)"
                strokeWidth="10"
                strokeLinecap="round"
              />
              {/* Cup body */}
              <path
                d="M70 46 H170 V96 C170 128, 145 144, 120 144 C95 144, 70 128, 70 96 Z"
                fill="url(#trophyGold)"
                stroke="#fef9c3"
                strokeWidth="3"
              />
              {/* Stem & Base */}
              <rect x="110" y="142" width="20" height="24" rx="4" fill="#d97706" />
              <rect x="82" y="164" width="76" height="18" rx="7" fill="url(#trophyGold)" stroke="#fef08a" strokeWidth="2" />
              {/* Center Star */}
              <polygon
                points="120,66 127,84 146,84 131,95 137,113 120,102 103,113 109,95 94,84 113,84"
                fill="#ffffff"
              />
            </svg>

            {/* Module Mastery Badge Pill */}
            <div
              data-testid="victory-earned-badge"
              className="mt-1 inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-500/25 border-2 border-amber-400 text-amber-100 shadow-lg"
            >
              <span className="text-2xl" aria-hidden="true">
                {victoryEarnedBadges.length > 0 ? earnedModule?.badgeIcon ?? '🏅' : '🏆'}
              </span>
              <span className="text-base sm:text-lg font-extrabold tracking-tight">
                {victoryEarnedBadges.length > 0
                  ? earnedModule?.badgeTitle ?? 'Module Badge!'
                  : activeActivity?.title ?? 'Capstone Complete!'}
              </span>
            </div>
          </div>
        ) : (
          <div className="relative flex flex-col items-center">
            {/* 3 Big Glowing Stars */}
            <div className="flex items-end gap-3 mb-1" aria-hidden="true">
              <span className="text-4xl sm:text-5xl drop-shadow-[0_0_14px_rgba(250,204,21,0.8)] -rotate-12">
                ⭐
              </span>
              <span className="text-5xl sm:text-6xl drop-shadow-[0_0_18px_rgba(250,204,21,0.95)] -translate-y-2">
                ⭐
              </span>
              <span className="text-4xl sm:text-5xl drop-shadow-[0_0_14px_rgba(250,204,21,0.8)] rotate-12">
                ⭐
              </span>
            </div>

            {/* Cheering Robot Illustration */}
            <svg
              viewBox="0 0 220 180"
              className="w-48 h-40 sm:w-56 sm:h-48 drop-shadow-[0_12px_24px_rgba(16,185,129,0.35)] animate-celebration-float"
              aria-hidden="true"
            >
              {/* Confetti dots */}
              <g className="animate-confetti-sparkle">
                <circle cx="28" cy="36" r="6" fill="#fbbf24" />
                <circle cx="192" cy="34" r="6" fill="#34d399" />
                <circle cx="24" cy="126" r="5" fill="#60a5fa" />
                <circle cx="196" cy="124" r="6" fill="#f472b6" />
                <rect x="48" y="18" width="8" height="8" rx="2" fill="#a78bfa" transform="rotate(20 48 18)" />
                <rect x="166" y="18" width="8" height="8" rx="2" fill="#fb923c" transform="rotate(-20 166 18)" />
              </g>

              {/* Antenna */}
              <line x1="110" y1="24" x2="110" y2="44" stroke="#38bdf8" strokeWidth="6" strokeLinecap="round" />
              <circle cx="110" cy="20" r="9" fill="#fbbf24" />

              {/* Raised Cheering Arms */}
              <path
                d="M64 102 C40 84, 38 56, 52 44"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="12"
                strokeLinecap="round"
              />
              <path
                d="M156 102 C180 84, 182 56, 168 44"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="12"
                strokeLinecap="round"
              />

              {/* Robot Head & Body */}
              <rect x="64" y="44" width="92" height="72" rx="22" fill="#0ea5e9" stroke="#e0f2fe" strokeWidth="4" />
              <rect x="76" y="58" width="68" height="40" rx="12" fill="#0f172a" />

              {/* Happy ^ ^ Eyes & Smile */}
              <path d="M88 76 Q95 66 102 76" fill="none" stroke="#34d399" strokeWidth="4.5" strokeLinecap="round" />
              <path d="M118 76 Q125 66 132 76" fill="none" stroke="#34d399" strokeWidth="4.5" strokeLinecap="round" />
              <path d="M98 86 Q110 96 122 86" fill="none" stroke="#fde047" strokeWidth="4" strokeLinecap="round" />

              {/* Belly Goal Badge */}
              <rect x="76" y="120" width="68" height="42" rx="14" fill="#0284c7" stroke="#bae6fd" strokeWidth="3" />
              <circle cx="110" cy="141" r="11" fill="#10b981" />
              <path d="M104 141 L108 145 L116 137" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}

        {/* Short Playful Banner */}
        <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight drop-shadow flex items-center gap-2">
          <Sparkles className="w-7 h-7 text-amber-300 shrink-0" aria-hidden="true" />
          <span>{isBadgeOrCapstone ? 'Awesome!' : 'You Did It!'}</span>
          <Sparkles className="w-7 h-7 text-amber-300 shrink-0" aria-hidden="true" />
        </h2>

        {/* Curriculum Next Lesson Pill */}
        {appMode === 'curriculum' && nextActivity && (
          <button
            type="button"
            data-testid="btn-victory-next"
            onClick={(e) => {
              e.stopPropagation();
              dismissVictoryModal();
              setCurriculumActivity(nextActivity.id, nextActivity.version);
            }}
            className="mt-1 inline-flex items-center gap-3 px-7 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xl shadow-[0_8px_24px_rgba(16,185,129,0.5)] border-2 border-emerald-200 transition-all cursor-pointer"
          >
            <span>Next</span>
            <span className="text-2xl leading-none" aria-hidden="true">
              {nextActivity.icon}
            </span>
            <Play className="w-6 h-6 fill-current" aria-hidden="true" />
          </button>
        )}

        {/* Subtle visual tap-anywhere cue */}
        <div className="mt-1 px-3.5 py-1 rounded-full bg-slate-900/70 border border-slate-700/80 text-slate-300 text-xs sm:text-sm font-semibold">
          👆 Tap anywhere to keep playing
        </div>
      </div>
    </div>
  );
};
