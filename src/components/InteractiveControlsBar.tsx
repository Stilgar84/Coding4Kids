import React from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, MousePointerClick } from 'lucide-react';
import { getActivityAtVersion, getActivityLatest } from '../data/curriculum';
import { WorkspaceState, EventScopeType } from '../types';
import type { ConditionExpr } from '../data/curriculum/types';
import { EVENT_SCOPE_KEYS, useAppStoreSelector } from '../store/useAppStore';

type InteractiveKey = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'A' | 'B';

const KEY_TO_EVENT_SCOPE: Record<InteractiveKey, EventScopeType> = {
  UP: 'ON_KEY_UP',
  DOWN: 'ON_KEY_DOWN',
  LEFT: 'ON_KEY_LEFT',
  RIGHT: 'ON_KEY_RIGHT',
  A: 'ON_KEY_A',
  B: 'ON_KEY_B',
};

function conditionUsesKeyHeld(cond?: ConditionExpr): boolean {
  if (!cond) return false;
  if (cond.kind === 'keyHeld') return true;
  if (cond.kind === 'not') return conditionUsesKeyHeld(cond.operand);
  if (cond.kind === 'and' || cond.kind === 'or') {
    return conditionUsesKeyHeld(cond.left) || conditionUsesKeyHeld(cond.right);
  }
  return false;
}

function workspaceUsesInteractiveControls(workspace: WorkspaceState): boolean {
  if (EVENT_SCOPE_KEYS.some((sc) => (workspace[sc]?.length ?? 0) > 0)) {
    return true;
  }
  return Object.values(workspace).some((blocks) =>
    Array.isArray(blocks) &&
    blocks.some(
      (b) =>
        b.params?.sensor === 'keyHeld' ||
        conditionUsesKeyHeld(b.params?.condition as ConditionExpr | undefined)
    )
  );
}

/**
 * Kid-friendly Bottom-Dock D-Pad + A/B + Tap controller for interactive programs
 * using `ON_TAP`, `ON_KEY_*`, or `keyHeld`. Renders outside `<header>` to respect
 * the single-row toolbar contract.
 */
export const InteractiveControlsBar: React.FC = () => {
  const {
    appMode,
    activeActivityId,
    activeActivityVersion,
    workspace,
    heldKeys,
    setKeyHeld,
    setPointerState,
    enqueueInteractiveEvent,
  } = useAppStoreSelector((s) => ({
    appMode: s.appMode,
    activeActivityId: s.activeActivityId,
    activeActivityVersion: s.activeActivityVersion,
    workspace: s.workspace,
    heldKeys: s.heldKeys,
    setKeyHeld: s.setKeyHeld,
    setPointerState: s.setPointerState,
    enqueueInteractiveEvent: s.enqueueInteractiveEvent,
  }));

  const activeActivity =
    appMode === 'curriculum'
      ? getActivityAtVersion(activeActivityId, activeActivityVersion) ??
        getActivityLatest(activeActivityId)
      : undefined;

  const allowedByCurriculum = Boolean(
    activeActivity &&
      (activeActivity.palette.allowInteractiveEvents ||
        activeActivity.palette.allowedScopes?.some((sc) => sc.startsWith('ON_')) ||
        activeActivity.palette.allowedSensors?.includes('keyHeld'))
  );

  const shouldRender = allowedByCurriculum || workspaceUsesInteractiveControls(workspace);
  if (!shouldRender) {
    return null;
  }

  const hasTapHandler =
    (workspace.ON_TAP?.length ?? 0) > 0 ||
    Boolean(activeActivity?.palette.allowedScopes?.includes('ON_TAP'));

  const renderKeyButton = (
    keyName: InteractiveKey,
    label: React.ReactNode,
    ariaLabel: string
  ) => {
    const isHeld = heldKeys.includes(keyName);
    const scope = KEY_TO_EVENT_SCOPE[keyName];
    return (
      <button
        key={keyName}
        type="button"
        data-testid={`btn-interactive-key-${keyName.toLowerCase()}`}
        aria-label={ariaLabel}
        aria-pressed={isHeld}
        onPointerDown={() => setKeyHeld(keyName, true)}
        onPointerUp={() => setKeyHeld(keyName, false)}
        onPointerLeave={() => setKeyHeld(keyName, false)}
        onPointerCancel={() => setKeyHeld(keyName, false)}
        onClick={() => enqueueInteractiveEvent(scope)}
        className={`min-w-[40px] min-h-[40px] px-2.5 rounded-xl border-2 font-black text-xs flex items-center justify-center transition-all select-none cursor-pointer ${
          isHeld
            ? 'bg-sky-500 text-slate-950 border-sky-200 scale-95 shadow-inner'
            : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-600 shadow-sm'
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div
      data-testid="interactive-controls-bar"
      className="w-full shrink-0 bg-slate-950/95 border-t border-slate-800 px-3 py-1.5 flex items-center justify-between gap-2 select-none z-20"
    >
      {/* Left: D-Pad */}
      <div className="flex items-center gap-1" role="group" aria-label="Direction pad">
        {renderKeyButton('LEFT', <ArrowLeft className="w-4 h-4 stroke-[3]" />, 'Key Left')}
        {renderKeyButton('UP', <ArrowUp className="w-4 h-4 stroke-[3]" />, 'Key Up')}
        {renderKeyButton('DOWN', <ArrowDown className="w-4 h-4 stroke-[3]" />, 'Key Down')}
        {renderKeyButton('RIGHT', <ArrowRight className="w-4 h-4 stroke-[3]" />, 'Key Right')}
      </div>

      {/* Right: Optional Tap + A / B Action Buttons */}
      <div className="flex items-center gap-1.5" role="group" aria-label="Action buttons">
        {hasTapHandler && (
          <button
            type="button"
            data-testid="btn-interactive-tap"
            aria-label="Tap stage"
            onPointerDown={() => setPointerState({ isDown: true })}
            onPointerUp={() => setPointerState({ isDown: false })}
            onPointerLeave={() => setPointerState({ isDown: false })}
            onClick={() => enqueueInteractiveEvent('ON_TAP')}
            className="min-w-[40px] min-h-[40px] px-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 text-amber-200 border-2 border-amber-400/70 font-black text-xs flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition-all"
          >
            <MousePointerClick className="w-4 h-4" />
          </button>
        )}
        {renderKeyButton('A', <span>A</span>, 'Key A')}
        {renderKeyButton('B', <span>B</span>, 'Key B')}
      </div>
    </div>
  );
};
