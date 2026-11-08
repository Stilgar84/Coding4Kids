import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../src/store/useAppStore';

describe('Compact Mobile Layout State & Store Actions', () => {
  beforeEach(() => {
    const store = useAppStore.getState();
    store.clearWorkspace();
    store.setMapHidden(false);
    store.setFunctionBarOpen(false);
    store.setMobileMenuOpen(false);
    store.setSelectedBlockId(null);
  });

  it('initializes with default mobile layout settings', () => {
    const state = useAppStore.getState();
    expect(state.isMapHidden).toBe(false);
    expect(state.isFunctionBarOpen).toBe(false);
    expect(state.isMobileMenuOpen).toBe(false);
  });

  it('toggles map visibility', () => {
    const store = useAppStore.getState();
    expect(store.isMapHidden).toBe(false);

    store.toggleMapHidden();
    expect(useAppStore.getState().isMapHidden).toBe(true);

    store.toggleMapHidden();
    expect(useAppStore.getState().isMapHidden).toBe(false);

    store.setMapHidden(true);
    expect(useAppStore.getState().isMapHidden).toBe(true);
  });

  it('toggles collapsible function bar', () => {
    const store = useAppStore.getState();
    expect(store.isFunctionBarOpen).toBe(false);

    store.toggleFunctionBar();
    expect(useAppStore.getState().isFunctionBarOpen).toBe(true);

    store.toggleFunctionBar();
    expect(useAppStore.getState().isFunctionBarOpen).toBe(false);

    store.setFunctionBarOpen(true);
    expect(useAppStore.getState().isFunctionBarOpen).toBe(true);
  });

  it('toggles mobile drawer menu', () => {
    const store = useAppStore.getState();
    expect(store.isMobileMenuOpen).toBe(false);

    store.toggleMobileMenu();
    expect(useAppStore.getState().isMobileMenuOpen).toBe(true);

    store.toggleMobileMenu();
    expect(useAppStore.getState().isMobileMenuOpen).toBe(false);

    store.setMobileMenuOpen(true);
    expect(useAppStore.getState().isMobileMenuOpen).toBe(true);
  });

  it('supports selecting and deleting a block via single-block delete action', () => {
    const store = useAppStore.getState();
    store.addBlock('MAIN', 'MOVE_FWD');
    store.addBlock('MAIN', 'TURN_LEFT');

    const blocksBefore = useAppStore.getState().workspace.MAIN;
    expect(blocksBefore.length).toBe(2);

    const firstBlockId = blocksBefore[0].id;
    store.setSelectedBlockId(firstBlockId);
    expect(useAppStore.getState().selectedBlockId).toBe(firstBlockId);

    // Delete selected block
    store.removeBlock('MAIN', firstBlockId);
    const blocksAfter = useAppStore.getState().workspace.MAIN;
    expect(blocksAfter.length).toBe(1);
    expect(blocksAfter[0].type).toBe('TURN_LEFT');
  });
});
