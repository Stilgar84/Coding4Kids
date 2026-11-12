import React, { useEffect, useRef } from 'react';
import { Check, Lock, Sparkles, X } from 'lucide-react';
import { useAppStore, useAppStoreSelector } from '../store/useAppStore';
import { CURRICULUM_MODULES, getActivityLatest } from '../data/curriculum';
import {
  getProfileAvatar,
  getProfileColor,
  getProfileDisplayName,
  getProfileProgress,
} from '../services/profileService';
import { isCurriculumModuleUnlocked } from './LessonPickerModal';

export const BadgeCollectionModal: React.FC = () => {
  const isBadgeModalOpen = useAppStoreSelector((s) => s.isBadgeModalOpen);
  if (!isBadgeModalOpen) return null;
  return <BadgeCollectionModalContent />;
};

const BadgeCollectionModalContent: React.FC = () => {
  useAppStore();
  const {
    isBadgeModalOpen,
    setBadgeModalOpen,
    setLessonPickerOpen,
    activeProfileId,
    profiles,
    setCurriculumActivity,
  } = useAppStore.getState();

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isBadgeModalOpen) return;
    const timer = setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 0);
    return () => clearTimeout(timer);
  }, [isBadgeModalOpen]);

  useEffect(() => {
    if (!isBadgeModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        useAppStore.getState().setBadgeModalOpen(false);
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement as HTMLElement | null;

        if (e.shiftKey) {
          if (!active || active === first || !dialogRef.current.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (!active || active === last || !dialogRef.current.contains(active)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isBadgeModalOpen]);

  if (!isBadgeModalOpen) return null;

  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0];
  const avatar = getProfileAvatar(activeProfile?.avatarId ?? 'robot');
  const color = getProfileColor(activeProfile?.colorId ?? 'sky');
  const displayName = activeProfile ? getProfileDisplayName(activeProfile) : 'Player 1';

  const progress = getProfileProgress(activeProfileId);
  const earnedBadges = progress.earnedBadges || [];
  const earnedCount = CURRICULUM_MODULES.filter((m) => earnedBadges.includes(m.badgeId)).length;

  return (
    <div
      data-testid="badge-collection-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="badge-collection-title"
      onClick={() => setBadgeModalOpen(false)}
      className="fixed inset-0 z-[60] flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-victory-enter"
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] bg-slate-900 border-2 border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 bg-slate-800/80 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl border text-xl shrink-0"
              style={{
                backgroundColor: `${color.accentColor}26`,
                borderColor: color.accentColor,
              }}
              aria-hidden="true"
            >
              {avatar.emoji}
            </span>
            <div className="min-w-0">
              <h2
                id="badge-collection-title"
                className="text-base sm:text-lg font-black text-white leading-tight truncate"
              >
                Badges
              </h2>
              <p className="text-xs font-bold text-slate-400 truncate">{displayName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span
              data-testid="badge-collection-count"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-200 text-xs sm:text-sm font-black"
            >
              <span aria-hidden="true">🏆</span>
              <span>
                {earnedCount}/{CURRICULUM_MODULES.length}
              </span>
            </span>

            <button
              ref={closeBtnRef}
              type="button"
              data-testid="btn-close-badge-modal"
              onClick={() => setBadgeModalOpen(false)}
              aria-label="Close badges"
              className="w-9 h-9 md:w-11 md:h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Trophy & Module Mastery Badges Grid */}
        <div className="p-3 sm:p-5 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3.5">
            {CURRICULUM_MODULES.map((mod) => {
              const isEarned = earnedBadges.includes(mod.badgeId);
              const isModuleUnlocked = isCurriculumModuleUnlocked(mod.id, progress);

              return (
                <div
                  key={mod.id}
                  data-testid={`badge-card-${mod.id}`}
                  data-badge-id={mod.badgeId}
                  data-earned={isEarned ? 'true' : 'false'}
                  className={`flex md:flex-col items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl border-2 transition-all ${
                    isEarned
                      ? 'bg-gradient-to-b from-amber-500/20 via-slate-800/90 to-slate-900 border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.22)]'
                      : 'bg-slate-950/75 border-dashed border-slate-700/90 text-slate-400'
                  }`}
                >
                  {/* Visual Medallion + Module Title */}
                  <div className="flex md:flex-col items-center gap-3 md:gap-2 min-w-0 md:text-center">
                    <div
                      className={`relative flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-2 shrink-0 select-none ${
                        isEarned
                          ? 'bg-amber-400/20 border-amber-300 shadow-inner animate-celebration-float'
                          : 'bg-slate-900 border-slate-800'
                      }`}
                    >
                      <span
                        className={`text-3xl sm:text-4xl leading-none ${
                          isEarned ? '' : 'grayscale opacity-40'
                        }`}
                        aria-hidden="true"
                      >
                        {mod.badgeIcon}
                      </span>

                      {isEarned ? (
                        <span
                          aria-hidden="true"
                          className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-slate-950 border-2 border-slate-900 shadow"
                        >
                          <Check className="w-3 h-3 stroke-[3.5]" />
                        </span>
                      ) : (
                        <span
                          aria-hidden="true"
                          className="absolute -bottom-1.5 -right-1.5 flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-slate-400 border border-slate-700"
                        >
                          <Lock className="w-3 h-3" />
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="inline-flex items-center gap-1 text-xs font-extrabold text-slate-300">
                        <span aria-hidden="true">{mod.icon}</span>
                        <span>{mod.shortTitle}</span>
                        {isEarned && (
                          <Sparkles
                            className="w-3.5 h-3.5 text-amber-300 shrink-0"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                      <h3
                        className={`text-sm sm:text-base font-black leading-snug ${
                          isEarned ? 'text-amber-100' : 'text-slate-300'
                        }`}
                      >
                        {mod.badgeTitle}
                      </h3>
                    </div>
                  </div>

                  {/* Compact Clickable Capstone Completion Chips (`1A ✓`, `1B ✓`, `1C ·`) */}
                  <div
                    role="group"
                    aria-label={`${mod.shortTitle} capstones`}
                    className="flex flex-wrap items-center justify-end md:justify-center gap-1.5 shrink-0"
                  >
                    {mod.capstoneIds.map((capId) => {
                      const isCapDone = Boolean(progress.completedLessons[capId]);
                      const capActivity = getActivityLatest(capId);
                      const canJump = isModuleUnlocked && Boolean(capActivity);

                      return (
                        <button
                          key={capId}
                          type="button"
                          data-testid={`badge-capstone-chip-${capId}`}
                          data-completed={isCapDone ? 'true' : 'false'}
                          disabled={!canJump}
                          aria-disabled={!canJump ? 'true' : undefined}
                          aria-label={
                            canJump
                              ? `Open Capstone ${capId} (${isCapDone ? 'completed' : 'not completed'})`
                              : `Capstone ${capId} locked`
                          }
                          onClick={() => {
                            if (!canJump || !capActivity) return;
                            setCurriculumActivity(capActivity.id, capActivity.version);
                            setBadgeModalOpen(false);
                            setLessonPickerOpen(false);
                          }}
                          className={`min-h-[36px] md:min-h-[44px] px-2.5 rounded-xl border text-xs font-black inline-flex items-center justify-center gap-1 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
                            isCapDone
                              ? canJump
                                ? 'bg-emerald-500/25 hover:bg-emerald-500/35 border-emerald-400 text-emerald-200 cursor-pointer active:scale-95'
                                : 'bg-emerald-950/40 border-emerald-700/50 text-emerald-300/70 cursor-not-allowed'
                              : canJump
                              ? 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-200 cursor-pointer active:scale-95'
                              : 'bg-slate-900/70 border-slate-800 text-slate-500 opacity-60 cursor-not-allowed'
                          }`}
                        >
                          <span>{capId}</span>
                          <span aria-hidden="true">{isCapDone ? '✓' : '·'}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
