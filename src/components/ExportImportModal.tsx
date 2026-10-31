import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  X,
  Share2,
  Download,
  Upload,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react';

export const ExportImportModal: React.FC = () => {
  const {
    isExportImportOpen,
    setExportImportOpen,
    activeSimId,
    exportCode,
    importCode,
  } = useAppStore();

  const [tab, setTab] = useState<'export' | 'import'>('export');
  const [includeMap, setIncludeMap] = useState(true);
  const [importText, setImportText] = useState('');
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (isExportImportOpen) {
      setCopied(false);
      setStatusMessage(null);
      setImportText('');
    }
  }, [isExportImportOpen]);

  if (!isExportImportOpen) return null;

  const exportedString = exportCode(includeMap);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportedString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleImport = () => {
    setStatusMessage(null);
    if (!importText.trim()) {
      setStatusMessage({ type: 'error', text: 'Please paste a valid Base64URL code string.' });
      return;
    }

    const res = importCode(importText.trim());
    if (res.success) {
      setStatusMessage({ type: 'success', text: 'Program & environment loaded successfully!' });
      setTimeout(() => {
        setExportImportOpen(false);
      }, 1200);
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to import program.' });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="export-import-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
      onClick={() => setExportImportOpen(false)}
    >
      <div
        className="relative w-full max-w-lg bg-slate-900 border-2 border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-500/50 text-indigo-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Share Program</h2>
              <p className="text-xs text-slate-400">Export & Import compact binary code</p>
            </div>
          </div>
          <button
            data-testid="modal-close-btn"
            onClick={() => setExportImportOpen(false)}
            className="flex items-center justify-center w-9 h-9 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 p-2 gap-2">
          <button
            data-testid="tab-export"
            onClick={() => {
              setTab('export');
              setStatusMessage(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all ${
              tab === 'export'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Export Code</span>
          </button>
          <button
            data-testid="tab-import"
            onClick={() => {
              setTab('import');
              setStatusMessage(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all ${
              tab === 'import'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Import Code</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 flex flex-col gap-4">
          {tab === 'export' ? (
            <>
              {activeSimId === 'grid' && (
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeMap}
                    onChange={(e) => setIncludeMap(e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>Include Grid map layout (dimensions, robot start, barriers & flags)</span>
                </label>
              )}

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                  <span>Base64URL Binary Payload</span>
                  <span className="text-slate-500">
                    {exportedString.length} chars
                  </span>
                </div>
                <textarea
                  data-testid="export-code-textarea"
                  readOnly
                  value={exportedString}
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                  rows={4}
                  className="w-full p-3 font-mono text-xs bg-slate-950 border border-slate-800 rounded-2xl text-slate-200 resize-none focus:outline-none focus:border-indigo-500 select-all"
                />
              </div>

              <button
                data-testid="btn-copy-code"
                onClick={handleCopy}
                className="flex items-center justify-center gap-2 w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-lg border border-indigo-400 transition-all active:scale-95"
              >
                {copied ? (
                  <>
                    <Check className="w-5 h-5 text-emerald-300" />
                    <span>Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    <span>Copy Code to Clipboard</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400 font-semibold">
                  Paste Base64URL Binary Payload
                </label>
                <textarea
                  data-testid="import-code-textarea"
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="Paste your exported program string here..."
                  rows={4}
                  className="w-full p-3 font-mono text-xs bg-slate-950 border border-slate-800 rounded-2xl text-slate-200 resize-none focus:outline-none focus:border-indigo-500"
                />
              </div>

              {statusMessage && (
                <div
                  className={`flex items-center gap-2 p-3 rounded-2xl text-xs font-semibold ${
                    statusMessage.type === 'success'
                      ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-200'
                      : 'bg-red-950/80 border border-red-500/50 text-red-200'
                  }`}
                >
                  {statusMessage.type === 'success' ? (
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  )}
                  <span>{statusMessage.text}</span>
                </div>
              )}

              <button
                data-testid="btn-load-code"
                onClick={handleImport}
                className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl shadow-lg border border-emerald-400 transition-all active:scale-95"
              >
                <Upload className="w-5 h-5" />
                <span>Load & Restore Program</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
