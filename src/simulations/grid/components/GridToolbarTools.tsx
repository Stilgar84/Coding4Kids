import React, { useEffect, useRef, useState } from 'react';
import { useAppStore, EditorTool } from '../../../store/useAppStore';
import { GridState, KeyGateShape } from '../../../types';
import { SHAPE_SYMBOLS } from '../../../engine/physics';
import {
  Bot,
  Square,
  Flag,
  Trophy,
  Eraser,
  Waves,
  KeyRound,
  DoorClosed,
  Package,
  CircleDot,
  Layers,
} from 'lucide-react';

export const WORLD_EDITOR_TOOLS: readonly EditorTool[] = [
  'WATER',
  'PLANK',
  'KEY',
  'GATE',
  'CRATE',
  'SWITCH',
];

export function isWorldEditorTool(tool: EditorTool): boolean {
  return WORLD_EDITOR_TOOLS.includes(tool);
}

const KEY_GATE_VARIANTS: readonly {
  shape: KeyGateShape;
  label: string;
  symbol: string;
  activeClass: string;
  dotColor: string;
}[] = [
  {
    shape: 'circle',
    label: 'Amber Circle',
    symbol: SHAPE_SYMBOLS.circle,
    activeClass: 'bg-amber-500/25 border-amber-400 text-amber-200',
    dotColor: '#f59e0b',
  },
  {
    shape: 'triangle',
    label: 'Emerald Triangle',
    symbol: SHAPE_SYMBOLS.triangle,
    activeClass: 'bg-emerald-500/25 border-emerald-400 text-emerald-200',
    dotColor: '#10b981',
  },
  {
    shape: 'diamond',
    label: 'Purple Diamond',
    symbol: SHAPE_SYMBOLS.diamond,
    activeClass: 'bg-purple-500/25 border-purple-400 text-purple-200',
    dotColor: '#a855f7',
  },
];

export interface GridToolbarToolsProps {
  state?: GridState;
  /** Optional initial open state for deterministic SSR / unit testing */
  defaultWorldMenuOpen?: boolean;
}

export function GridToolbarTools({
  defaultWorldMenuOpen = false,
}: GridToolbarToolsProps = {}): React.ReactElement | null {
  useAppStore();
  const {
    appMode,
    editorTool,
    editorKeyGateVariant,
    setEditorTool,
    setEditorKeyGateVariant,
  } = useAppStore.getState();

  const [isWorldMenuOpen, setIsWorldMenuOpen] = useState(defaultWorldMenuOpen);
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isWorldMenuOpen) return;

    const handlePointerDown = (ev: MouseEvent) => {
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(ev.target as Node)
      ) {
        setIsWorldMenuOpen(false);
      }
    };

    const handleKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        ev.stopPropagation();
        setIsWorldMenuOpen(false);
        triggerButtonRef.current?.focus();
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isWorldMenuOpen]);

  if (appMode === 'curriculum') {
    return null;
  }

  const handleToolClick = (tool: EditorTool) => {
    setEditorTool(editorTool === tool ? 'NONE' : tool);
  };

  const handleWorldToolSelect = (tool: EditorTool) => {
    setEditorTool(editorTool === tool ? 'NONE' : tool);
  };

  const activeWorldTool = isWorldEditorTool(editorTool);

  const renderActiveWorldIcon = () => {
    switch (editorTool) {
      case 'WATER':
        return <Waves className="w-5 h-5" />;
      case 'KEY':
        return <KeyRound className="w-5 h-5" />;
      case 'GATE':
        return <DoorClosed className="w-5 h-5" />;
      case 'CRATE':
        return <Package className="w-5 h-5" />;
      case 'SWITCH':
        return <CircleDot className="w-5 h-5" />;
      case 'PLANK':
        return (
          <span className="text-base leading-none" aria-hidden="true">
            🪵
          </span>
        );
      default:
        return <Layers className="w-5 h-5" />;
    }
  };

  return (
    <div
      role="group"
      aria-label="Grid Map Editor Tools"
      className="relative flex items-center gap-1.5 bg-slate-950/60 p-1.5 rounded-2xl border border-slate-800"
    >
      <button
        type="button"
        data-testid="tool-robot"
        onClick={() => handleToolClick('ROBOT')}
        aria-pressed={editorTool === 'ROBOT'}
        aria-label="Robot placement tool"
        className={`flex items-center justify-center w-10 h-10 rounded-xl border transition-all ${
          editorTool === 'ROBOT'
            ? 'bg-sky-500 border-sky-300 text-white scale-105'
            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
        }`}
        title="Robot placement tool"
      >
        <Bot className="w-5 h-5" />
      </button>

      <button
        type="button"
        data-testid="tool-wall"
        onClick={() => handleToolClick('WALL')}
        aria-pressed={editorTool === 'WALL'}
        aria-label="Wall barrier tool"
        className={`flex items-center justify-center w-10 h-10 rounded-xl border transition-all ${
          editorTool === 'WALL'
            ? 'bg-red-500 border-red-300 text-white scale-105'
            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
        }`}
        title="Wall barrier tool"
      >
        <Square className="w-5 h-5 fill-red-400" />
      </button>

      <button
        type="button"
        data-testid="tool-flag"
        onClick={() => handleToolClick('FLAG')}
        aria-pressed={editorTool === 'FLAG'}
        aria-label="Numbered flag tool"
        className={`flex items-center justify-center w-10 h-10 rounded-xl border transition-all ${
          editorTool === 'FLAG'
            ? 'bg-blue-500 border-blue-300 text-white scale-105'
            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
        }`}
        title="Numbered flag tool"
      >
        <Flag className="w-5 h-5 fill-blue-400" />
      </button>

      <button
        type="button"
        data-testid="tool-goal"
        onClick={() => handleToolClick('GOAL')}
        aria-pressed={editorTool === 'GOAL'}
        aria-label="Goal tool"
        className={`flex items-center justify-center w-10 h-10 rounded-xl border transition-all ${
          editorTool === 'GOAL'
            ? 'bg-yellow-500 border-yellow-300 text-slate-950 scale-105'
            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
        }`}
        title="Goal tool"
      >
        <Trophy className="w-5 h-5 fill-yellow-400" />
      </button>

      {/* Compact Grouped Interactive World Items & Terrain Selector */}
      <div ref={menuContainerRef} className="relative">
        <button
          ref={triggerButtonRef}
          type="button"
          data-testid="tool-world-items-menu"
          onClick={() => setIsWorldMenuOpen((open) => !open)}
          aria-haspopup="dialog"
          aria-expanded={isWorldMenuOpen}
          aria-pressed={activeWorldTool}
          aria-label="World items and terrain tools"
          title="World items & terrain (Water, Plank, Key, Gate, Crate, Switch)"
          className={`relative flex items-center justify-center w-10 h-10 rounded-xl border transition-all ${
            activeWorldTool
              ? 'bg-teal-500 border-teal-300 text-slate-950 font-bold scale-105'
              : isWorldMenuOpen
              ? 'bg-slate-700 border-slate-500 text-white'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
          }`}
        >
          {renderActiveWorldIcon()}
          {(editorTool === 'KEY' || editorTool === 'GATE') && (
            <span
              aria-hidden="true"
              className="absolute -bottom-1 -right-1 px-1 rounded-full bg-slate-900 border border-slate-600 text-[9px] font-black text-amber-200 leading-tight"
            >
              {SHAPE_SYMBOLS[editorKeyGateVariant]}
            </span>
          )}
        </button>

        {isWorldMenuOpen && (
          <div
            data-testid="world-items-popover"
            role="dialog"
            aria-label="Interactive World Items and Terrain"
            className="absolute top-12 right-0 z-50 w-64 p-2.5 rounded-2xl bg-slate-900/95 border border-slate-700 shadow-2xl backdrop-blur-md flex flex-col gap-2.5"
          >
            <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="World Terrain and Item Tools">
              <button
                type="button"
                data-testid="tool-water"
                onClick={() => handleWorldToolSelect('WATER')}
                aria-pressed={editorTool === 'WATER'}
                aria-label="Water channel tool"
                className={`flex flex-col items-center justify-center gap-1 py-2 px-1.5 rounded-xl border text-[11px] font-bold transition-all ${
                  editorTool === 'WATER'
                    ? 'bg-sky-600 border-sky-300 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                <Waves className="w-4 h-4 text-sky-300" />
                <span>Water</span>
              </button>

              <button
                type="button"
                data-testid="tool-plank"
                onClick={() => handleWorldToolSelect('PLANK')}
                aria-pressed={editorTool === 'PLANK'}
                aria-label="Wooden plank tool"
                className={`flex flex-col items-center justify-center gap-1 py-2 px-1.5 rounded-xl border text-[11px] font-bold transition-all ${
                  editorTool === 'PLANK'
                    ? 'bg-amber-600 border-amber-300 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                <span className="text-sm leading-none" aria-hidden="true">
                  🪵
                </span>
                <span>Plank</span>
              </button>

              <button
                type="button"
                data-testid="tool-key"
                onClick={() => handleWorldToolSelect('KEY')}
                aria-pressed={editorTool === 'KEY'}
                aria-label={`Key placement tool (${editorKeyGateVariant} ${SHAPE_SYMBOLS[editorKeyGateVariant]})`}
                className={`flex flex-col items-center justify-center gap-1 py-2 px-1.5 rounded-xl border text-[11px] font-bold transition-all ${
                  editorTool === 'KEY'
                    ? 'bg-amber-500 border-amber-200 text-slate-950'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                <KeyRound className="w-4 h-4" />
                <span>Key {SHAPE_SYMBOLS[editorKeyGateVariant]}</span>
              </button>

              <button
                type="button"
                data-testid="tool-gate"
                onClick={() => handleWorldToolSelect('GATE')}
                aria-pressed={editorTool === 'GATE'}
                aria-label={`Locked gate tool (${editorKeyGateVariant} ${SHAPE_SYMBOLS[editorKeyGateVariant]})`}
                className={`flex flex-col items-center justify-center gap-1 py-2 px-1.5 rounded-xl border text-[11px] font-bold transition-all ${
                  editorTool === 'GATE'
                    ? 'bg-purple-600 border-purple-300 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                <DoorClosed className="w-4 h-4" />
                <span>Gate {SHAPE_SYMBOLS[editorKeyGateVariant]}</span>
              </button>

              <button
                type="button"
                data-testid="tool-crate"
                onClick={() => handleWorldToolSelect('CRATE')}
                aria-pressed={editorTool === 'CRATE'}
                aria-label="Crate placement tool"
                className={`flex flex-col items-center justify-center gap-1 py-2 px-1.5 rounded-xl border text-[11px] font-bold transition-all ${
                  editorTool === 'CRATE'
                    ? 'bg-amber-700 border-amber-300 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                <Package className="w-4 h-4" />
                <span>Crate</span>
              </button>

              <button
                type="button"
                data-testid="tool-switch"
                onClick={() => handleWorldToolSelect('SWITCH')}
                aria-pressed={editorTool === 'SWITCH'}
                aria-label="Floor switch tool"
                className={`flex flex-col items-center justify-center gap-1 py-2 px-1.5 rounded-xl border text-[11px] font-bold transition-all ${
                  editorTool === 'SWITCH'
                    ? 'bg-emerald-600 border-emerald-300 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                <CircleDot className="w-4 h-4" />
                <span>Switch</span>
              </button>
            </div>

            {/* Color-Blind Inclusive Shape + Color Selector for Keys & Gates */}
            <div
              role="group"
              aria-label="Key and Gate Shape Variant"
              className="pt-2 border-t border-slate-800 flex items-center justify-between gap-1"
            >
              {KEY_GATE_VARIANTS.map((v) => {
                const selected = editorKeyGateVariant === v.shape;
                return (
                  <button
                    key={v.shape}
                    type="button"
                    data-testid={`variant-${v.shape}`}
                    onClick={() => setEditorKeyGateVariant(v.shape)}
                    aria-pressed={selected}
                    aria-label={`${v.label} (${v.symbol}) key and gate variant`}
                    title={`${v.label} (${v.symbol})`}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border text-xs font-extrabold transition-all ${
                      selected
                        ? v.activeClass
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span style={{ color: v.dotColor }} aria-hidden="true">
                      {v.symbol}
                    </span>
                    <span className="capitalize text-[10px]">{v.shape}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        data-testid="tool-erase"
        onClick={() => handleToolClick('ERASE')}
        aria-pressed={editorTool === 'ERASE'}
        aria-label="Erase tool"
        className={`flex items-center justify-center w-10 h-10 rounded-xl border transition-all ${
          editorTool === 'ERASE'
            ? 'bg-rose-500 border-rose-300 text-white scale-105'
            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
        }`}
        title="Erase tool"
      >
        <Eraser className="w-5 h-5" />
      </button>
    </div>
  );
};
