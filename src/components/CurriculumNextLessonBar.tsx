import React from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { getActivityAtVersion, getActivityLatest } from '../data/curriculum';
import { useAppStoreSelector } from '../store/useAppStore';
import {
  getNextCurriculumActivity,
  isCreativeOpenLessonActivity,
  isPuzzleExerciseActivity,
} from '../utils/curriculumStagePolicy';

export interface CurriculumNextLessonBarProps {
  forHiddenMapPane?: boolean;
}

/**
 * Kid-friendly Bottom Dock bar surfaced in Learning mode whenever:
 * - Case A: A puzzle exercise / puzzle capstone is solved (`completedActivities[id]` or `SUCCESS`),
 *   giving an unmistakable 1-tap `Next` button even after dismissing `VictoryCelebrationModal`.
 * - Case B: `isMapHidden` is active on an open creative lesson, keeping the `Next` CTA reachable.
 */
export const CurriculumNextLessonBar: React.FC<CurriculumNextLessonBarProps> = ({
  forHiddenMapPane = false,
}) => {
  const {
    appMode,
    activeActivityId,
    activeActivityVersion,
    completedActivities,
    activeSimStatus,
    runtimeStatus,
    setCurriculumActivity,
    completeCreativeActivity,
    dismissVictoryModal,
    setLessonPickerOpen,
  } = useAppStoreSelector((s) => ({
    appMode: s.appMode,
    activeActivityId: s.activeActivityId,
    activeActivityVersion: s.activeActivityVersion,
    completedActivities: s.completedActivities,
    activeSimStatus:
      s.activeSimId === 'grid'
        ? s.grid.status
        : s.activeSimId === 'beat'
        ? s.beatState.status
        : s.turtleState.status,
    runtimeStatus: s.runtime?.status,
    setCurriculumActivity: s.setCurriculumActivity,
    completeCreativeActivity: s.completeCreativeActivity,
    dismissVictoryModal: s.dismissVictoryModal,
    setLessonPickerOpen: s.setLessonPickerOpen,
  }));

  if (appMode !== 'curriculum') {
    return null;
  }

  const activeActivity =
    getActivityAtVersion(activeActivityId, activeActivityVersion) ??
    getActivityLatest(activeActivityId);
  if (!activeActivity) {
    return null;
  }

  const nextActivity = getNextCurriculumActivity(activeActivity.id);
  const isCompleted = Boolean(completedActivities[activeActivity.id]);

  // Case B: Open creative lesson when map pane is hidden on compact screens
  if (forHiddenMapPane && isCreativeOpenLessonActivity(activeActivity)) {
    return (
      <div
        data-testid="hidden-map-creative-next-bar"
        className="w-full shrink-0 bg-slate-950/95 border-t border-slate-800 px-3 py-1.5 flex items-center justify-between gap-2 select-none z-20"
      >
        <div className="flex items-center gap-1.5 text-xs md:text-sm font-black text-slate-200">
          <span aria-hidden="true">{activeActivity.icon}</span>
          <span>{activeActivity.id}</span>
          {isCompleted && (
            <Check className="w-4 h-4 stroke-[3] text-emerald-400" aria-hidden="true" />
          )}
        </div>

        <button
          type="button"
          data-testid="btn-complete-creative-activity"
          onClick={() => completeCreativeActivity(true)}
          title={
            nextActivity
              ? `Next lesson: Activity ${nextActivity.id}: ${nextActivity.title}`
              : 'Mark creative lesson complete'
          }
          aria-label={
            nextActivity
              ? `Next lesson: Activity ${nextActivity.id}: ${nextActivity.title}`
              : 'Mark creative lesson complete'
          }
          className="min-h-[36px] md:min-h-[44px] px-4 md:px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs md:text-sm border-2 border-emerald-200 shadow-md shadow-emerald-500/30 flex items-center gap-1.5 cursor-pointer shrink-0 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
        >
          {nextActivity ? (
            <>
              {isCompleted && (
                <Check className="w-3.5 h-3.5 stroke-[3] shrink-0" aria-hidden="true" />
              )}
              <span>Next</span>
              <span aria-hidden="true" className="text-base leading-none">
                {nextActivity.icon}
              </span>
              <ArrowRight className="w-4 h-4 stroke-[3] shrink-0" aria-hidden="true" />
            </>
          ) : (
            <>
              <Check className="w-3.5 h-3.5 stroke-[3] shrink-0" aria-hidden="true" />
              <span>{isCompleted ? 'Lessons' : 'Done'}</span>
              <ArrowRight className="w-4 h-4 stroke-[3] shrink-0" aria-hidden="true" />
            </>
          )}
        </button>
      </div>
    );
  }

  // Case A: Solved puzzle / capstone exercise
  if (!isPuzzleExerciseActivity(activeActivity)) {
    return null;
  }

  const isSolved =
    isCompleted || activeSimStatus === 'SUCCESS' || runtimeStatus === 'SUCCESS';
  if (!isSolved) {
    return null;
  }

  return (
    <div
      data-testid="solved-lesson-next-bar"
      className="w-full shrink-0 bg-slate-950/95 border-t border-emerald-500/40 px-3 py-1.5 flex items-center justify-between gap-2 select-none z-20"
    >
      <div className="flex items-center gap-1.5 text-xs md:text-sm font-black text-emerald-300">
        <span aria-hidden="true">⭐</span>
        <span>{activeActivity.id}</span>
        <Check className="w-4 h-4 stroke-[3] text-emerald-400" aria-hidden="true" />
      </div>

      <button
        type="button"
        data-testid="btn-next-solved-lesson"
        onClick={() => {
          dismissVictoryModal();
          if (nextActivity) {
            setCurriculumActivity(nextActivity.id, nextActivity.version);
          } else {
            setLessonPickerOpen(true);
          }
        }}
        title={
          nextActivity
            ? `Next lesson: Activity ${nextActivity.id}: ${nextActivity.title}`
            : 'Choose Lesson'
        }
        aria-label={
          nextActivity
            ? `Next lesson: Activity ${nextActivity.id}: ${nextActivity.title}`
            : 'Choose Lesson'
        }
        className="min-h-[36px] md:min-h-[44px] px-4 md:px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs md:text-sm border-2 border-emerald-200 shadow-md shadow-emerald-500/30 flex items-center gap-1.5 cursor-pointer shrink-0 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
      >
        {nextActivity ? (
          <>
            <span>Next</span>
            <span aria-hidden="true" className="text-base leading-none">
              {nextActivity.icon}
            </span>
            <ArrowRight className="w-4 h-4 stroke-[3] shrink-0" aria-hidden="true" />
          </>
        ) : (
          <>
            <span>Lessons</span>
            <ArrowRight className="w-4 h-4 stroke-[3] shrink-0" aria-hidden="true" />
          </>
        )}
      </button>
    </div>
  );
};
