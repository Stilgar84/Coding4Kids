import type { WorkspaceState } from '../types';
import {
  type AppMode,
  getActivityAtVersion,
  getActivityLatest,
  isValidatedPuzzleActivity,
} from '../data/curriculum';
import { getNextCurriculumActivity } from '../utils/curriculumStagePolicy';
import {
  markLessonCompleted,
  saveLessonAutosave,
  saveSandboxAutosave,
} from '../services/profileService';
import { playCelebrationAudio } from '../services/celebrationAudio';
import type {
  AppState,
  HistoryHandles,
  HistorySnapshot,
  PlaybackHandles,
  SimId,
  StoreContext,
  StoreGet,
  StoreSet,
} from './types';
import { cloneWorkspace } from './helpers/workspaceHelpers';
import { cancelFrame } from './helpers/simStateHelpers';
import {
  formatEarnedBadgesAnnouncement,
  getActiveCurriculumActivity,
  isCreativeCurriculumActivity,
  isExplanationActivity,
} from './helpers/curriculumHelpers';

export const MAX_HISTORY = 100;

export function createStoreContext(set: StoreSet, get: StoreGet): StoreContext {
  const playback: PlaybackHandles = {
    timerId: null,
    turtleRafId: null,
    pendingTurtleCommit: null,
    turtlePassHadDelay: false,
    beatPassHadDelay: false,
  };

  const history: HistoryHandles = {
    activeBatchSnapshot: null,
  };

  const cancelPlaybackTimers = (): void => {
    if (playback.timerId) {
      clearTimeout(playback.timerId);
      playback.timerId = null;
    }
    if (playback.turtleRafId !== null) {
      cancelFrame(playback.turtleRafId);
      playback.turtleRafId = null;
    }
  };

  const takeSnapshot = (state: AppState, desc?: string): HistorySnapshot => ({
    workspace: cloneWorkspace(state.workspace),
    grid: JSON.parse(JSON.stringify(state.grid)),
    turtleState: JSON.parse(JSON.stringify(state.turtleState)),
    beatState: JSON.parse(JSON.stringify(state.beatState)),
    depotState: JSON.parse(JSON.stringify(state.depotState)),
    switchyardState: JSON.parse(JSON.stringify(state.switchyardState)),
    activeScope: state.activeScope,
    selectedBlockId: state.selectedBlockId,
    activeSimId: state.activeSimId,
    description: desc,
  });

  const recordMutation = (desc?: string): void => {
    if (history.activeBatchSnapshot !== null) {
      return;
    }
    const snapshot = takeSnapshot(get(), desc);
    const currentPast = get().past;
    const newPast = [
      ...currentPast.slice(Math.max(0, currentPast.length - (MAX_HISTORY - 1))),
      snapshot,
    ];
    set({
      past: newPast,
      future: [],
      canUndo: true,
      canRedo: false,
    });
  };

  const persistActiveWorkspace = (
    ws: WorkspaceState,
    override?: {
      appMode?: AppMode;
      profileId?: string;
      activityId?: string;
      activityVersion?: number;
      simId?: SimId;
    }
  ): void => {
    const s = get();
    const mode = override?.appMode ?? s.appMode;
    const profileId = override?.profileId ?? s.activeProfileId;
    if (mode === 'curriculum') {
      const actId = override?.activityId ?? s.activeActivityId;
      const actVer = override?.activityVersion ?? s.activeActivityVersion;
      const act = getActivityAtVersion(actId, actVer) ?? getActivityLatest(actId);
      // Do not overwrite primary lesson autosave when viewing secondary explanation demo tabs
      if (
        act?.format === 'explanation' &&
        (act.demoTabs?.length ?? 0) > 1 &&
        s.activeDemoTabIndex > 0
      ) {
        return;
      }
      saveLessonAutosave(profileId, actId, ws, actVer);
    } else {
      const simId = override?.simId ?? s.activeSimId;
      saveSandboxAutosave(profileId, simId, ws);
    }
  };

  const markDemoTabExploredInternal = (announceOnAllExplored = true): void => {
    const s = get();
    if (s.appMode !== 'curriculum') return;
    const activity =
      getActivityAtVersion(s.activeActivityId, s.activeActivityVersion) ??
      getActivityLatest(s.activeActivityId);
    if (!activity || activity.format !== 'explanation' || !activity.demoTabs?.length) {
      return;
    }
    const clampedIdx = Math.min(
      Math.max(0, s.activeDemoTabIndex),
      activity.demoTabs.length - 1
    );
    const activeTab = activity.demoTabs[clampedIdx];
    if (!activeTab) return;

    const prevExplored = s.exploredDemoTabs[activity.id] ?? [];
    if (prevExplored.includes(activeTab.id)) {
      return;
    }
    const nextExploredForActivity = [...prevExplored, activeTab.id];
    const allExploredNow = activity.demoTabs.every((t) =>
      nextExploredForActivity.includes(t.id)
    );
    const nextActivity = getNextCurriculumActivity(activity.id);

    set((curr) => ({
      exploredDemoTabs: {
        ...curr.exploredDemoTabs,
        [activity.id]: nextExploredForActivity,
      },
      ...(announceOnAllExplored && allExploredNow && curr.runtime?.status !== 'PAUSED'
        ? {
            statusAnnouncement: nextActivity
              ? `All ${activity.demoTabs!.length} examples explored in Activity ${activity.id}! Press Continue to advance to Activity ${nextActivity.id}: ${nextActivity.title}.`
              : `All ${activity.demoTabs!.length} examples explored in Activity ${activity.id}! Press Continue when ready.`,
          }
        : {}),
    }));
  };

  const triggerVictoryModal = (earnedBadges: string[] = [], playAudio = true): void => {
    const s = get();
    if (isExplanationActivity(s)) return;
    const act = getActiveCurriculumActivity(s);
    const isGrand =
      earnedBadges.length > 0 || Boolean(act && act.format === 'capstone');
    const badgeAnnouncement = formatEarnedBadgesAnnouncement(earnedBadges, act);
    set({
      isVictoryModalOpen: true,
      victoryEarnedBadges: earnedBadges,
      ...(badgeAnnouncement ? { statusAnnouncement: badgeAnnouncement } : {}),
    });
    if (playAudio) {
      playCelebrationAudio(isGrand, {
        speed: s.speed,
        isMuted: s.beatState.isMuted,
      });
    }
  };

  const recordCurriculumSuccessIfApplicable = (): {
    newlyEarnedBadges: string[];
    isCapstone: boolean;
  } | null => {
    const s = get();
    if (s.appMode !== 'curriculum') return null;
    const activity = getActiveCurriculumActivity(s);
    if (!activity || !isValidatedPuzzleActivity(activity)) return null;
    const res = markLessonCompleted(
      s.activeProfileId,
      s.activeActivityId,
      s.activeActivityVersion
    );
    if (!s.completedActivities[s.activeActivityId]) {
      set((curr) => ({
        completedActivities: {
          ...curr.completedActivities,
          [curr.activeActivityId]: true,
        },
      }));
    }
    return {
      newlyEarnedBadges: res.newlyEarnedBadges,
      isCapstone: activity.format === 'capstone',
    };
  };

  const recordCreativePlayCompletionIfApplicable = (playAudio = true): void => {
    const s = get();
    if (s.appMode !== 'curriculum') return;
    const activity = getActiveCurriculumActivity(s);
    if (!activity || !isCreativeCurriculumActivity(activity)) return;
    const totalBlocks =
      s.workspace.MAIN.length +
      s.workspace.F1.length +
      s.workspace.F2.length +
      s.workspace.F3.length;
    if (totalBlocks === 0) return;

    const res = markLessonCompleted(s.activeProfileId, activity.id, activity.version);
    if (!s.completedActivities[activity.id]) {
      set((curr) => ({
        completedActivities: {
          ...curr.completedActivities,
          [activity.id]: true,
        },
      }));
    }
    if (activity.format === 'capstone' || res.newlyEarnedBadges.length > 0) {
      triggerVictoryModal(res.newlyEarnedBadges, playAudio);
    }
  };

  return {
    playback,
    history,
    cancelPlaybackTimers,
    takeSnapshot,
    recordMutation,
    persistActiveWorkspace,
    markDemoTabExploredInternal,
    triggerVictoryModal,
    recordCurriculumSuccessIfApplicable,
    recordCreativePlayCompletionIfApplicable,
  };
}
