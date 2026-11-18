import type { ScopeType } from '../../types';
import { resolveActiveCurriculumActivity } from '../../utils/curriculumStagePolicy';
import type { StoreGet, StoreSet, UiChromeSliceActions } from '../types';

export function createUiChromeSlice(
  set: StoreSet,
  get: StoreGet
): UiChromeSliceActions {
  return {
    toggleSubpalette: () =>
      set((state) => ({ isSubpaletteCollapsed: !state.isSubpaletteCollapsed })),

    setSubpaletteCollapsed: (collapsed) =>
      set({ isSubpaletteCollapsed: collapsed }),

    toggleMapHidden: () =>
      set((state) => ({ isMapHidden: !state.isMapHidden })),

    setMapHidden: (hidden) => set({ isMapHidden: hidden }),

    toggleFunctionBar: () =>
      set((state) => ({ isFunctionBarOpen: !state.isFunctionBarOpen })),

    setFunctionBarOpen: (open) => set({ isFunctionBarOpen: open }),

    toggleMobileMenu: () =>
      set((state) => ({ isMobileMenuOpen: !state.isMobileMenuOpen })),

    setMobileMenuOpen: (open) => set({ isMobileMenuOpen: open }),

    setSolutionOpen: (open) => set({ isSolutionOpen: open }),

    setExportImportOpen: (open) => set({ isExportImportOpen: open }),

    setSaveModalOpen: (open) => set({ isSaveModalOpen: open }),

    setLoadModalOpen: (open) => set({ isLoadModalOpen: open }),

    setLessonPickerOpen: (open) => set({ isLessonPickerOpen: open }),

    setBadgeModalOpen: (open) => set({ isBadgeModalOpen: open }),

    dismissVictoryModal: () =>
      set({ isVictoryModalOpen: false, victoryEarnedBadges: [] }),

    setActiveScope: (scope) => {
      const s = get();
      if (s.appMode === 'curriculum') {
        const activity = resolveActiveCurriculumActivity(
          s.appMode,
          s.activeActivityId,
          s.activeActivityVersion
        );
        if (activity) {
          const allowedScopes: ScopeType[] =
            activity.palette.allowedScopes &&
            activity.palette.allowedScopes.length > 0
              ? activity.palette.allowedScopes
              : ['MAIN'];
          if (!allowedScopes.includes(scope)) {
            return;
          }
        }
      }
      set({
        activeScope: scope,
        selectedBlockId: null,
        lastSlotCapRejectedAt: null,
      });
    },

    setSelectedBlockId: (id) => set({ selectedBlockId: id }),

    setEditorTool: (tool) => {
      if (get().appMode === 'curriculum' && tool !== 'NONE') return;
      set({ editorTool: tool });
    },

    setEditorKeyGateVariant: (variant) => {
      if (get().appMode === 'curriculum') return;
      set({ editorKeyGateVariant: variant });
    },
  };
}
