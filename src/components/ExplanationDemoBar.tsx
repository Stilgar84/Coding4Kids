import React, { useRef } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import {
  CURRICULUM_ACTIVITIES,
  getActivityAtVersion,
  getActivityLatest,
} from '../data/curriculum';
import { useAppStoreSelector } from '../store/useAppStore';

/**
 * Pure helper for WAI-ARIA tablist keyboard navigation.
 * Exported for deterministic unit verification in headless environments.
 */
export function computeNextDemoTabIndex(
  key: string,
  currentIndex: number,
  tabCount: number
): number | null {
  if (tabCount <= 0) return null;
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (currentIndex + 1) % tabCount;
    case 'ArrowLeft':
    case 'ArrowUp':
      return (currentIndex - 1 + tabCount) % tabCount;
    case 'Home':
      return 0;
    case 'End':
      return tabCount - 1;
    case 'Enter':
    case ' ':
      return currentIndex;
    default:
      return null;
  }
}

/**
 * Compact, zero-reading interactive demo bar rendered below Toolbar whenever
 * the active curriculum activity has `format === 'explanation'` and `demoTabs`.
 *
 * Learners use the main Toolbar Play / Step / Reset buttons to watch and step
 * through each visual example tab (`[1]`, `[2]`, ...), then tap **Continue (`→`)**
 * to mark the explanation lesson complete and advance to the next activity.
 */
export const ExplanationDemoBar: React.FC = () => {
  const {
    appMode,
    activeActivityId,
    activeActivityVersion,
    activeDemoTabIndex,
    exploredDemoTabs,
    completedActivities,
    statusAnnouncement,
    selectExplanationDemoTab,
    completeExplanationAndContinue,
  } = useAppStoreSelector((s) => ({
    appMode: s.appMode,
    activeActivityId: s.activeActivityId,
    activeActivityVersion: s.activeActivityVersion,
    activeDemoTabIndex: s.activeDemoTabIndex,
    exploredDemoTabs: s.exploredDemoTabs,
    completedActivities: s.completedActivities,
    statusAnnouncement: s.statusAnnouncement,
    selectExplanationDemoTab: s.selectExplanationDemoTab,
    completeExplanationAndContinue: s.completeExplanationAndContinue,
  }));

  const tabButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  if (appMode !== 'curriculum') {
    return null;
  }

  const activity =
    getActivityAtVersion(activeActivityId, activeActivityVersion) ??
    getActivityLatest(activeActivityId);

  if (
    !activity ||
    activity.format !== 'explanation' ||
    !activity.demoTabs ||
    activity.demoTabs.length === 0
  ) {
    return null;
  }

  const demoTabs = activity.demoTabs;
  const clampedActiveIdx = Math.min(
    Math.max(0, activeDemoTabIndex),
    demoTabs.length - 1
  );
  const activeTab = demoTabs[clampedActiveIdx];
  const exploredForActivity = exploredDemoTabs[activity.id] ?? [];
  const allExplored = demoTabs.every((t) => exploredForActivity.includes(t.id));
  const isCompleted = Boolean(completedActivities[activity.id]);
  const isContinueHighlighted = allExplored || isCompleted;

  const currentIdxInCatalog = CURRICULUM_ACTIVITIES.findIndex(
    (a) => a.id === activity.id
  );
  const nextActivity =
    currentIdxInCatalog >= 0 && currentIdxInCatalog < CURRICULUM_ACTIVITIES.length - 1
      ? CURRICULUM_ACTIVITIES[currentIdxInCatalog + 1]
      : undefined;

  const handleTabKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    idx: number
  ) => {
    const nextIdx = computeNextDemoTabIndex(e.key, idx, demoTabs.length);
    if (nextIdx === null) return;

    e.preventDefault();
    selectExplanationDemoTab(nextIdx);
    const targetEl = tabButtonRefs.current[nextIdx];
    if (targetEl) {
      targetEl.focus();
    }
  };

  const liveAnnouncement =
    statusAnnouncement ||
    `Example ${clampedActiveIdx + 1} of ${demoTabs.length}${
      activeTab?.title ? `: ${activeTab.title}` : ''
    }`;

  return (
    <div
      data-testid="explanation-demo-bar"
      data-activity-id={activity.id}
      className="flex items-center justify-between gap-2 px-2.5 md:px-4 py-1.5 bg-slate-900/95 border-b-2 border-slate-800 shrink-0 select-none z-20"
    >
      {/* Screen-reader polite status announcement for tab switches & completion */}
      <div
        data-testid="explanation-demo-live-region"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {liveAnnouncement}
      </div>

      {/* Left + Center: Format Badge + Visual Example Switcher Tabs */}
      <div className="flex items-center gap-1.5 md:gap-2.5 min-w-0 overflow-x-auto">
        <span
          aria-hidden="true"
          className="inline-flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-xl bg-sky-500/15 border border-sky-400/30 text-sm md:text-base shrink-0"
          title={activity.title}
        >
          {activity.icon || '📖'}
        </span>

        <div
          role="tablist"
          aria-label={`Interactive examples for ${activity.title}`}
          className="flex items-center gap-1.5"
        >
          {demoTabs.map((tab, idx) => {
            const tabNumber = idx + 1;
            const isSelected = idx === clampedActiveIdx;
            const isExplored = exploredForActivity.includes(tab.id);
            const displayLabel = tab.label || String(tabNumber);

            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabButtonRefs.current[idx] = el;
                }}
                type="button"
                role="tab"
                id={`demo-tab-btn-${tab.id}`}
                data-testid={`demo-tab-${tabNumber}`}
                data-tab-id={tab.id}
                data-explored={isExplored ? 'true' : 'false'}
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                aria-label={`Example ${displayLabel}${
                  tab.title ? `: ${tab.title}` : ''
                }${isExplored ? ' (explored)' : ''}`}
                title={
                  tab.title
                    ? `[${displayLabel}] ${tab.title}`
                    : `Example [${displayLabel}]`
                }
                onClick={() => selectExplanationDemoTab(idx)}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                className={`flex items-center gap-1.5 px-2.5 md:px-3 h-8 md:h-9 rounded-xl border-2 font-extrabold text-xs md:text-sm transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 shrink-0 ${
                  isSelected
                    ? 'bg-sky-600 border-sky-300 text-white shadow-md shadow-sky-500/25'
                    : 'bg-slate-800/90 hover:bg-slate-700/90 border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                <span aria-hidden="true" className="text-sm leading-none">
                  {tab.icon}
                </span>
                <span className="font-black tracking-tight">
                  [{displayLabel}]
                </span>
                {tab.title && (
                  <span className="hidden sm:inline font-bold text-xs truncate max-w-[150px]">
                    {tab.title}
                  </span>
                )}
                {isExplored && (
                  <span
                    data-testid={`demo-tab-explored-${tabNumber}`}
                    aria-hidden="true"
                    className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-black ${
                      isSelected
                        ? 'bg-emerald-400 text-slate-950'
                        : 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/50'
                    }`}
                  >
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Prominent 1-Tap Continue (→) Button */}
      <button
        type="button"
        data-testid="btn-explanation-continue"
        data-all-explored={allExplored ? 'true' : 'false'}
        onClick={() => completeExplanationAndContinue()}
        aria-label={
          nextActivity
            ? `Mark Activity ${activity.id} complete and continue to Activity ${nextActivity.id}: ${nextActivity.title}`
            : `Mark Activity ${activity.id} complete and continue`
        }
        title={
          nextActivity
            ? `Continue to ${nextActivity.id}: ${nextActivity.title}`
            : 'Continue'
        }
        className={`flex items-center gap-1.5 px-3 md:px-4 h-8 md:h-9 rounded-xl border-2 font-black text-xs md:text-sm transition-all cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${
          isContinueHighlighted
            ? 'bg-emerald-500 hover:bg-emerald-400 border-emerald-200 text-slate-950 shadow-[0_0_14px_rgba(16,185,129,0.55)] scale-[1.02]'
            : 'bg-sky-600 hover:bg-sky-500 border-sky-400 text-white shadow-sm'
        }`}
      >
        {isContinueHighlighted && (
          <Check
            aria-hidden="true"
            className="w-4 h-4 stroke-[3] shrink-0"
          />
        )}
        <span className="hidden xs:inline sm:inline">Continue</span>
        <ArrowRight
          aria-hidden="true"
          className="w-4 h-4 md:w-4.5 md:h-4.5 stroke-[3] shrink-0"
        />
      </button>
    </div>
  );
};
