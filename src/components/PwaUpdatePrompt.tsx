import React, { useEffect } from 'react';
import { RefreshCw, CheckCircle2, X } from 'lucide-react';
import {
  usePwaUpdateStore,
  applyAppUpdate,
  dismissUpdatePrompt,
} from '../services/pwaUpdateManager';
import { useAppStore } from '../store/useAppStore';

export const PwaUpdatePrompt: React.FC = () => {
  const { needRefresh, isPromptDismissed, isUpdating } = usePwaUpdateStore();
  const { wasRestoredAfterUpdate, dismissRestoredNotice } = useAppStore();

  useEffect(() => {
    if (!wasRestoredAfterUpdate) return;
    const timer = setTimeout(() => {
      dismissRestoredNotice();
    }, 5000);
    return () => clearTimeout(timer);
  }, [wasRestoredAfterUpdate, dismissRestoredNotice]);

  const showUpdateBanner = needRefresh && !isPromptDismissed;

  if (!showUpdateBanner && !wasRestoredAfterUpdate) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-4 sm:w-96 z-50 flex flex-col gap-2 pointer-events-none">
      {wasRestoredAfterUpdate && (
        <div
          data-testid="pwa-restored-toast"
          role="status"
          className="pointer-events-auto flex items-center justify-between gap-2.5 px-4 py-3 bg-slate-900/95 backdrop-blur-md border-2 border-emerald-500/70 rounded-2xl shadow-2xl text-slate-100"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <span className="text-xs sm:text-sm font-bold truncate">
              App updated — workspace restored!
            </span>
          </div>
          <button
            data-testid="btn-dismiss-restored-toast"
            onClick={dismissRestoredNotice}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {showUpdateBanner && (
        <div
          data-testid="pwa-update-banner"
          role="alertdialog"
          aria-labelledby="pwa-update-title"
          aria-describedby="pwa-update-desc"
          className="pointer-events-auto flex flex-col gap-3 p-4 bg-slate-900/95 backdrop-blur-md border-2 border-sky-500/80 rounded-2xl shadow-2xl text-slate-100"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/40 text-sky-400 flex-shrink-0 mt-0.5">
                <RefreshCw className={`w-5 h-5 ${isUpdating ? 'animate-spin' : ''}`} />
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <h3 id="pwa-update-title" className="text-sm font-extrabold text-white">
                  Update Available
                </h3>
                <p id="pwa-update-desc" className="text-xs text-slate-300 leading-relaxed">
                  A new version of Robot Emulator is ready. Your current code and map will be restored automatically.
                </p>
              </div>
            </div>
            <button
              onClick={dismissUpdatePrompt}
              disabled={isUpdating}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex-shrink-0"
              aria-label="Close update prompt"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              data-testid="btn-pwa-update-later"
              onClick={dismissUpdatePrompt}
              disabled={isUpdating}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-colors disabled:opacity-50"
            >
              Later
            </button>
            <button
              data-testid="btn-pwa-update-now"
              onClick={() => {
                void applyAppUpdate();
              }}
              disabled={isUpdating}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-black border border-sky-300 shadow-lg active:scale-95 transition-all disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 stroke-[2.5] ${isUpdating ? 'animate-spin' : ''}`} />
              <span>{isUpdating ? 'Updating…' : 'Update Now'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
