import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { ScopeType } from '../types';
import { BlockItem } from './BlockItem';
import { Trash2, Sparkles } from 'lucide-react';

interface ScopeTab {
  id: ScopeType;
  label: string;
  testId: string;
  icon: React.ReactNode;
  activeColor: string;
}

const SCOPE_TABS: ScopeTab[] = [
  {
    id: 'MAIN',
    label: 'Main',
    testId: 'tab-main',
    icon: <Sparkles className="w-5 h-5 text-yellow-300" />,
    activeColor: 'bg-indigo-600 border-indigo-400 text-white',
  },
  {
    id: 'F1',
    label: '1',
    testId: 'tab-f1',
    icon: <span className="font-black text-lg">1</span>,
    activeColor: 'bg-emerald-600 border-emerald-400 text-white',
  },
  {
    id: 'F2',
    label: '2',
    testId: 'tab-f2',
    icon: <span className="font-black text-lg">2</span>,
    activeColor: 'bg-blue-600 border-blue-400 text-white',
  },
  {
    id: 'F3',
    label: '3',
    testId: 'tab-f3',
    icon: <span className="font-black text-lg">3</span>,
    activeColor: 'bg-rose-600 border-rose-400 text-white',
  },
];

export const WorkspaceCanvas: React.FC = () => {
  const {
    activeScope,
    setActiveScope,
    workspace,
    clearWorkspace,
    runtime,
  } = useAppStore();

  const blocks = workspace[activeScope] || [];

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden bg-slate-950">
      {/* Scope Navigation Tabs & Actions */}
      <div className="flex items-center justify-between p-2 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2">
          {SCOPE_TABS.map((tab) => {
            const isSelected = activeScope === tab.id;
            return (
              <button
                key={tab.id}
                data-testid={tab.testId}
                onClick={() => setActiveScope(tab.id)}
                className={`flex items-center justify-center w-12 h-12 rounded-2xl border-2 transition-all ${
                  isSelected
                    ? `${tab.activeColor} shadow-lg scale-105`
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                }`}
              >
                {tab.icon}
              </button>
            );
          })}
        </div>

        {/* Clear Scope Button */}
        <button
          data-testid="btn-clear-workspace"
          onClick={() => clearWorkspace(activeScope)}
          className="flex items-center justify-center w-12 h-12 bg-slate-800 hover:bg-red-600/80 text-slate-400 hover:text-white rounded-2xl border-2 border-slate-700 transition-colors"
          title="Clear"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {/* Program Code Sequence Canvas */}
      <div
        data-testid="workspace-sequence"
        className="flex-1 p-4 overflow-y-auto overflow-x-hidden flex flex-wrap content-start items-start gap-3 min-h-[160px]"
      >
        {blocks.length === 0 ? (
          <div className="flex items-center justify-center w-full h-48 border-2 border-dashed border-slate-800 rounded-3xl text-slate-600">
            <span className="text-4xl opacity-40">➕</span>
          </div>
        ) : (
          blocks.map((block, idx) => (
            <BlockItem
              key={block.id}
              block={block}
              index={idx}
              scope={activeScope}
              isActive={runtime?.activeBlockId === block.id}
            />
          ))
        )}
      </div>
    </div>
  );
};
