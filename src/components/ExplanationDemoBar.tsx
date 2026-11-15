import React, { useRef } from 'react';
import { ArrowRight, Check, CornerRightDown, CornerLeftUp } from 'lucide-react';
import { VariableAndDialSpotlight } from './VariableAndDialSpotlight';
import {
  getActivityAtVersion,
  getActivityLatest,
} from '../data/curriculum';
import { useAppStoreSelector } from '../store/useAppStore';
import {
  findNextUnviewedDemoTabIndex,
  getNextCurriculumActivity,
} from '../utils/curriculumStagePolicy';
import {
  BranchSkipSpotlight,
  FifoVsLifoSpotlight,
  SensorBeamBadge,
} from '../simulations/grid/components/SensorAndBranchSpotlight';

/**
 * Zero-reading animated badge visualizing a `Main → F1 → Main` call/return cycle.
 * Renders as a compact pill row: [Main] ↓ [1] ↑ [Main], flashing the active scope
 * in sync with stepped playback when present in a demo tab's `spotlights` list.
 */
const CallStackJumpSpotlight: React.FC<{ activeScope?: string }> = ({ activeScope }) => {
  const isInF1 = activeScope === 'F1';
  const isInF2 = activeScope === 'F2';
  const isInF3 = activeScope === 'F3';
  const isInHelper = isInF1 || isInF2 || isInF3;
  const helperLabel = isInF2 ? '2' : isInF3 ? '3' : '1';

  return (
    <div
      data-testid="call-stack-jump-spotlight"
      aria-label="Call and return: Main calls Function 1 and returns"
      className="flex items-center gap-1 px-2 py-1 bg-slate-800/80 rounded-xl border border-slate-700/70 select-none shrink-0"
    >
      {/* Main scope badge */}
      <span
        className={`inline-flex items-center justify-center px-1.5 h-5 rounded-md border text-[9px] font-black transition-all duration-200 ${
          !isInHelper
            ? 'bg-indigo-600 border-indigo-300 text-white shadow-[0_0_8px_rgba(99,102,241,0.6)]'
            : 'bg-slate-900 border-slate-600 text-slate-400'
        }`}
        aria-hidden="true"
      >
        Main
      </span>
      {/* Call arrow (down into helper) */}
      <CornerRightDown
        aria-hidden="true"
        className={`w-3 h-3 stroke-[2.5] transition-colors duration-200 ${
          isInHelper ? 'text-emerald-400' : 'text-slate-500'
        }`}
      />
      {/* F1 scope badge */}
      <span
        className={`inline-flex items-center justify-center px-1.5 h-5 rounded-md border text-[9px] font-black transition-all duration-200 ${
          isInHelper
            ? 'bg-emerald-600 border-emerald-300 text-white shadow-[0_0_8px_rgba(16,185,129,0.6)]'
            : 'bg-slate-900 border-slate-600 text-slate-400'
        }`}
        aria-hidden="true"
      >
        {helperLabel}
      </span>
      {/* Return arrow (up back to Main) */}
      <CornerLeftUp
        aria-hidden="true"
        className={`w-3 h-3 stroke-[2.5] transition-colors duration-200 ${
          !isInHelper ? 'text-indigo-400' : 'text-slate-500'
        }`}
      />
    </div>
  );
};

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
    viewedDemoTabs,
    completedActivities,
    statusAnnouncement,
    activeScope,
    selectExplanationDemoTab,
    completeExplanationAndContinue,
  } = useAppStoreSelector((s) => ({
    appMode: s.appMode,
    activeActivityId: s.activeActivityId,
    activeActivityVersion: s.activeActivityVersion,
    activeDemoTabIndex: s.activeDemoTabIndex,
    exploredDemoTabs: s.exploredDemoTabs,
    viewedDemoTabs: s.viewedDemoTabs,
    completedActivities: s.completedActivities,
    statusAnnouncement: s.statusAnnouncement,
    activeScope: s.activeScope,
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

  if (!activity) {
    return null;
  }

  const hasDemoTabs =
    activity.format === 'explanation' &&
    Boolean(activity.demoTabs && activity.demoTabs.length > 0);
  const challengeCoPilotText = !hasDemoTabs ? activity.coPilotCard?.trim() : undefined;

  if (!hasDemoTabs && !challengeCoPilotText) {
    return null;
  }

  if (!hasDemoTabs && challengeCoPilotText) {
    return (
      <div
        data-testid="copilot-card-banner"
        data-activity-id={activity.id}
        className="flex items-center gap-2 px-3 md:px-4 py-1.5 bg-slate-900/95 border-b border-slate-800 shrink-0 select-none z-20"
      >
        <span aria-hidden="true" className="text-sm shrink-0">
          🤖
        </span>
        <span className="text-xs font-medium text-sky-200 leading-snug">
          {challengeCoPilotText}
        </span>
      </div>
    );
  }

  const demoTabs = activity.demoTabs!;
  const clampedActiveIdx = Math.min(
    Math.max(0, activeDemoTabIndex),
    demoTabs.length - 1
  );
  const activeTab = demoTabs[clampedActiveIdx];
  const exploredForActivity = exploredDemoTabs[activity.id] ?? [];
  const viewedForActivity = viewedDemoTabs[activity.id] ?? [];
  const nextUnviewedIdx = findNextUnviewedDemoTabIndex(
    demoTabs,
    clampedActiveIdx,
    viewedForActivity
  );
  const allViewed = nextUnviewedIdx === null;
  const nextUnviewedTab = nextUnviewedIdx !== null ? demoTabs[nextUnviewedIdx] : undefined;
  const nextUnviewedLabel = nextUnviewedTab
    ? nextUnviewedTab.label || String(nextUnviewedIdx! + 1)
    : '';
  const allExplored = demoTabs.every((t) => exploredForActivity.includes(t.id));
  const isCompleted = Boolean(completedActivities[activity.id]);
  const isContinueHighlighted = allExplored || isCompleted;

  const nextActivity = getNextCurriculumActivity(activity.id);

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
            const isViewed = isSelected || viewedForActivity.includes(tab.id);
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
                data-viewed={isViewed ? 'true' : 'false'}
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

      {/* Center spotlight: Call-Stack Jump Animation Badge */}
      {activeTab?.spotlights?.includes('call-stack-jump') && (
        <CallStackJumpSpotlight activeScope={activeScope} />
      )}
      {activeTab?.spotlights?.includes('branch-skip') && (
        <BranchSkipSpotlight />
      )}
      {activeTab?.spotlights?.includes('fifo-vs-lifo') && (
        <FifoVsLifoSpotlight />
      )}
      {activeTab?.spotlights?.includes('sensor-beam') &&
        !activeTab?.spotlights?.includes('branch-skip') &&
        !activeTab?.spotlights?.includes('fifo-vs-lifo') && (
          <SensorBeamBadge />
        )}

      {/* Module 6 Variable & Dial Spotlights */}
      {activeTab?.spotlights?.some((s) =>
        ['dial-read', 'pose-bookmark', 'variable-watch'].includes(s)
      ) && (
        <VariableAndDialSpotlight spotlights={activeTab.spotlights} />
      )}

      {/* Optional <= 2 sentence Co-Pilot concept card */}
      {(activeTab?.coPilotCard ?? activity.coPilotCard)?.trim() && (
        <div
          data-testid="copilot-card-banner"
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-950/60 border border-sky-700/60 text-[11px] font-medium text-sky-200 max-w-md"
        >
          <span aria-hidden="true" className="shrink-0">
            🤖
          </span>
          <span className="line-clamp-2 leading-tight">
            {(activeTab?.coPilotCard ?? activity.coPilotCard)?.trim()}
          </span>
        </div>
      )}

      {/* Right: Prominent 1-Tap Next Step / Next Lesson (→) Button */}
      <button
        type="button"
        data-testid="btn-explanation-continue"
        data-all-explored={allExplored ? 'true' : 'false'}
        data-all-viewed={allViewed ? 'true' : 'false'}
        data-next-action={allViewed ? 'next-lesson' : 'next-step'}
        onClick={() => completeExplanationAndContinue()}
        aria-label={
          !allViewed && nextUnviewedTab
            ? `Next step [${nextUnviewedLabel}]${nextUnviewedTab.title ? `: ${nextUnviewedTab.title}` : ''}`
            : nextActivity
            ? `Next lesson: Activity ${nextActivity.id}: ${nextActivity.title}`
            : `Complete Activity ${activity.id}`
        }
        title={
          !allViewed && nextUnviewedTab
            ? `Next step [${nextUnviewedLabel}]${nextUnviewedTab.title ? `: ${nextUnviewedTab.title}` : ''}`
            : nextActivity
            ? `Next lesson: Activity ${nextActivity.id}: ${nextActivity.title}`
            : `Complete Activity ${activity.id}`
        }
        className={`flex items-center gap-1.5 px-3.5 md:px-4 h-9 md:h-11 rounded-xl border-2 font-black text-xs md:text-sm transition-all cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${
          !allViewed
            ? 'bg-sky-500 hover:bg-sky-400 active:scale-95 border-sky-200 text-slate-950 shadow-sm'
            : isContinueHighlighted
            ? 'bg-emerald-500 hover:bg-emerald-400 active:scale-95 border-emerald-200 text-slate-950 shadow-[0_0_14px_rgba(16,185,129,0.5)] scale-[1.02]'
            : 'bg-emerald-500 hover:bg-emerald-400 active:scale-95 border-emerald-200 text-slate-950 shadow-[0_0_14px_rgba(16,185,129,0.5)]'
        }`}
      >
        {!allViewed && nextUnviewedTab ? (
          <>
            <span>Next</span>
            <span
              aria-hidden="true"
              className="px-1.5 py-0.5 rounded-md bg-slate-950/15 font-black text-[11px] leading-none"
            >
              [{nextUnviewedLabel}]
            </span>
            <ArrowRight
              aria-hidden="true"
              className="w-4 h-4 md:w-4.5 md:h-4.5 stroke-[3] shrink-0"
            />
          </>
        ) : (
          <>
            {(isContinueHighlighted || isCompleted) && (
              <Check
                aria-hidden="true"
                className="w-4 h-4 stroke-[3] shrink-0"
              />
            )}
            <span>Next</span>
            {nextActivity?.icon && (
              <span aria-hidden="true" className="text-sm leading-none">
                {nextActivity.icon}
              </span>
            )}
            <ArrowRight
              aria-hidden="true"
              className="w-4 h-4 md:w-4.5 md:h-4.5 stroke-[3] shrink-0"
            />
          </>
        )}
      </button>
    </div>
  );
};
