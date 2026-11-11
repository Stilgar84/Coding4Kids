import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  ProfileBackupImportMode,
  exportProfileBackupToJson,
  exportProfileBackupToQrBytes,
  getProfileAvatar,
  getProfileDisplayName,
  getProfileProgress,
  isProfileBackupPayload,
} from '../services/profileService';
import { getSavedPrograms } from '../services/localSaveService';
import {
  X,
  Share2,
  Download,
  Upload,
  Copy,
  Check,
  AlertCircle,
  QrCode,
  Camera,
  UserPlus,
  RefreshCw,
  FileUp,
  Users,
} from 'lucide-react';
import { FullScreenQrModal } from './FullScreenQrModal';
import { QrScannerModal } from './QrScannerModal';

export const ExportImportModal: React.FC = () => {
  const {
    isExportImportOpen,
    setExportImportOpen,
    appMode,
    activeActivityId,
    activeActivityVersion,
    activeSimId,
    profiles,
    activeProfileId,
    exportCode,
    exportBinary,
    importCode,
    importBinary,
    importUserProfileBackup,
  } = useAppStore();

  const [shareScope, setShareScope] = useState<'program' | 'profile'>('program');
  const [tab, setTab] = useState<'export' | 'import'>('export');
  const [includeMap, setIncludeMap] = useState(true);
  const [importText, setImportText] = useState('');
  const [copied, setCopied] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isExportImportOpen) {
      setShareScope('program');
      setCopied(false);
      setStatusMessage(null);
      setImportText('');
      setShowQrModal(false);
      setShowScannerModal(false);
    }
  }, [isExportImportOpen]);

  useEffect(() => {
    if (!isExportImportOpen || showQrModal || showScannerModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setExportImportOpen(false);
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]):not([type="file"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement as HTMLElement | null;

        if (e.shiftKey) {
          if (!active || active === first || !dialogRef.current.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (!active || active === last || !dialogRef.current.contains(active)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExportImportOpen, showQrModal, showScannerModal, setExportImportOpen]);

  if (!isExportImportOpen) return null;

  const activeProfile =
    profiles.find((p) => p.id === activeProfileId) ?? profiles[0];
  const activeProfileName = activeProfile
    ? getProfileDisplayName(activeProfile)
    : 'Player 1';
  const activeAvatar = activeProfile
    ? getProfileAvatar(activeProfile.avatarId)
    : null;

  const exportedString =
    shareScope === 'profile'
      ? exportProfileBackupToJson(activeProfileId)
      : exportCode(includeMap);
  const binaryPayload =
    shareScope === 'profile'
      ? exportProfileBackupToQrBytes(activeProfileId)
      : exportBinary(includeMap);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportedString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadProfileJson = () => {
    const json = exportProfileBackupToJson(activeProfileId);
    const safeSlug =
      activeProfileName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'player';
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `robotemu-profile-${safeSlug}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImportText(reader.result);
        setShareScope('profile');
        setStatusMessage({
          type: 'success',
          text: `Loaded "${file.name}". Choose "Add as New Profile" or "Replace Active Profile" below.`,
        });
      }
    };
    reader.onerror = () => {
      setStatusMessage({ type: 'error', text: 'Failed to read backup file.' });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportProgram = () => {
    setStatusMessage(null);
    const trimmed = importText.trim();
    if (!trimmed) {
      setStatusMessage({ type: 'error', text: 'Please paste a valid Base64URL code string.' });
      return;
    }

    // Auto-detect if user pasted a Whole-Profile Backup JSON inside Program tab
    if (isProfileBackupPayload(trimmed)) {
      setShareScope('profile');
      setStatusMessage({
        type: 'success',
        text: 'Profile backup detected! Choose "Add as New Profile" or "Replace Active Profile" below.',
      });
      return;
    }

    const res = importCode(trimmed);
    if (res.success) {
      if (res.versionMismatchPending) {
        // Store already closed ExportImportModal and opened LessonVersionMismatchModal
        return;
      }
      setStatusMessage({ type: 'success', text: 'Program & environment loaded successfully!' });
      setTimeout(() => {
        setExportImportOpen(false);
      }, 1200);
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to import program.' });
    }
  };

  const handleImportProfile = (mode: ProfileBackupImportMode) => {
    setStatusMessage(null);
    const trimmed = importText.trim();
    if (!trimmed) {
      setStatusMessage({
        type: 'error',
        text: 'Paste a profile backup JSON or choose a .json backup file first.',
      });
      return;
    }

    const res = importUserProfileBackup(trimmed, mode);
    if (res.success && res.profile) {
      const name = getProfileDisplayName(res.profile);
      setStatusMessage({
        type: 'success',
        text:
          mode === 'new'
            ? `Added new profile "${name}" (${res.importedSlotCount ?? 0} saved slots)!`
            : `Replaced active profile with "${name}" (${res.importedSlotCount ?? 0} saved slots)!`,
      });
      setTimeout(() => {
        setExportImportOpen(false);
      }, 1200);
    } else {
      setStatusMessage({
        type: 'error',
        text: res.error || 'Failed to import profile backup.',
      });
    }
  };

  const handleScanSuccess = (scannedBinary: Uint8Array) => {
    setShowScannerModal(false);

    if (isProfileBackupPayload(scannedBinary)) {
      const decodedText = new TextDecoder().decode(scannedBinary);
      setShareScope('profile');
      setTab('import');
      setImportText(decodedText);
      setStatusMessage({
        type: 'success',
        text: 'Profile backup scanned! Choose "Add as New Profile" or "Replace Active Profile" below.',
      });
      return;
    }

    const res = importBinary(scannedBinary);
    if (res.success) {
      if (res.versionMismatchPending) {
        return;
      }
      setStatusMessage({
        type: 'success',
        text: 'Program & environment loaded from QR code successfully!',
      });
      setTimeout(() => {
        setExportImportOpen(false);
      }, 1200);
    } else {
      setStatusMessage({
        type: 'error',
        text: res.error || 'Failed to import program from QR code.',
      });
    }
  };

  const completedStarsCount = activeProfile
    ? Object.keys(getProfileProgress(activeProfile.id).completedLessons).length
    : 0;
  const manualSlotsCount = activeProfile
    ? getSavedPrograms(activeProfile.id).length
    : 0;

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-import-modal-title"
        data-testid="export-import-modal"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
        onClick={() => setExportImportOpen(false)}
      >
        <div
          ref={dialogRef}
          className="relative w-full max-w-lg max-h-[90vh] bg-slate-900 border-2 border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-500/50 text-indigo-400">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <h2 id="export-import-modal-title" className="text-lg font-black text-white">
                  {shareScope === 'profile' ? 'Whole-Profile Backup' : 'Share Program'}
                </h2>
                <p className="text-xs text-slate-400">
                  {shareScope === 'profile'
                    ? 'Export or restore player progress, auto-saves & slots'
                    : 'Export & Import compact binary code'}
                </p>
              </div>
            </div>
            <button
              type="button"
              data-testid="modal-close-btn"
              aria-label="Close share dialog"
              onClick={() => setExportImportOpen(false)}
              className="flex items-center justify-center w-9 h-9 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scope Selector: Program vs Whole Profile */}
          <div
            role="group"
            aria-label="Share scope"
            className="flex items-center gap-2 px-6 pt-3 pb-2 bg-slate-950/50 border-b border-slate-800/80 shrink-0"
          >
            <button
              type="button"
              data-testid="share-scope-program"
              aria-pressed={shareScope === 'program'}
              onClick={() => {
                setShareScope('program');
                setStatusMessage(null);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-extrabold border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                shareScope === 'program'
                  ? 'bg-slate-800 text-white border-indigo-400 shadow'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Single Program</span>
            </button>
            <button
              type="button"
              data-testid="share-scope-profile"
              aria-pressed={shareScope === 'profile'}
              onClick={() => {
                setShareScope('profile');
                setStatusMessage(null);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-extrabold border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                shareScope === 'profile'
                  ? 'bg-slate-800 text-white border-violet-400 shadow'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Whole Profile</span>
            </button>
          </div>

          {/* Tab Switcher */}
          <div className="flex border-b border-slate-800 bg-slate-950/40 p-2 gap-2 shrink-0">
            <button
              type="button"
              data-testid="tab-export"
              onClick={() => {
                setTab('export');
                setStatusMessage(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                tab === 'export'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>{shareScope === 'profile' ? 'Export Backup' : 'Export Code'}</span>
            </button>
            <button
              type="button"
              data-testid="tab-import"
              onClick={() => {
                setTab('import');
                setStatusMessage(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                tab === 'import'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>{shareScope === 'profile' ? 'Import Backup' : 'Import Code'}</span>
            </button>
          </div>

          {/* Content Body */}
          <div className="p-6 overflow-y-auto flex flex-col gap-4">
            {shareScope === 'program' ? (
              tab === 'export' ? (
                <>
                  {appMode === 'curriculum' ? (
                    <div className="flex flex-col gap-2">
                      <div
                        data-testid="export-lesson-envelope-badge"
                        className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-xs"
                      >
                        <span className="font-bold text-emerald-300">
                          🎓 Activity {activeActivityId} • v{activeActivityVersion}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-400">
                          {includeMap ? 'Self-contained lesson share' : 'Code-only blocks'}
                        </span>
                      </div>
                      <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          data-testid="checkbox-include-lesson-envelope"
                          checked={includeMap}
                          onChange={(e) => setIncludeMap(e.target.checked)}
                          className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <span>
                          Include Lesson ID &amp; Version (opens directly into Activity{' '}
                          {activeActivityId})
                        </span>
                      </label>
                    </div>
                  ) : (
                    activeSimId === 'grid' && (
                      <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={includeMap}
                          onChange={(e) => setIncludeMap(e.target.checked)}
                          className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <span>
                          Include Grid map layout (dimensions, robot start, barriers &amp; flags)
                        </span>
                      </label>
                    )
                  )}

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                      <span>Base64URL Binary Payload</span>
                      <span className="text-slate-500">
                        {exportedString.length} chars ({binaryPayload.length} bytes)
                      </span>
                    </div>
                    <textarea
                      data-testid="export-code-textarea"
                      readOnly
                      value={exportedString}
                      onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                      rows={3}
                      className="w-full p-3 font-mono text-xs bg-slate-950 border border-slate-800 rounded-2xl text-slate-200 resize-none focus:outline-none focus:border-indigo-500 select-all"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <button
                      type="button"
                      data-testid="btn-copy-code"
                      onClick={handleCopy}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl border border-slate-600 transition-all active:scale-95 shadow-md"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-300" />
                          <span>Copied String!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-slate-300" />
                          <span>Copy String</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      data-testid="btn-show-qr"
                      onClick={() => setShowQrModal(true)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-lg border border-indigo-400 transition-all active:scale-95"
                    >
                      <QrCode className="w-5 h-5" />
                      <span>Show QR Code</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* QR Code Scan Button */}
                  <button
                    type="button"
                    data-testid="btn-scan-qr"
                    onClick={() => setShowScannerModal(true)}
                    className="flex items-center justify-center gap-2 w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-lg border border-indigo-400 transition-all active:scale-95"
                  >
                    <Camera className="w-5 h-5" />
                    <span>Scan QR Code</span>
                  </button>

                  <div className="flex items-center gap-3 my-0.5">
                    <div className="flex-1 h-px bg-slate-800" />
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      or paste Base64URL string
                    </span>
                    <div className="flex-1 h-px bg-slate-800" />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <textarea
                      data-testid="import-code-textarea"
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      placeholder="Paste your exported program string here..."
                      rows={3}
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
                    type="button"
                    data-testid="btn-load-code"
                    onClick={handleImportProgram}
                    className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl shadow-lg border border-emerald-400 transition-all active:scale-95"
                  >
                    <Upload className="w-5 h-5" />
                    <span>Load &amp; Restore Program</span>
                  </button>
                </>
              )
            ) : tab === 'export' ? (
              <>
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-violet-500/40">
                  <div className="flex items-center gap-2.5">
                    {activeAvatar && (
                      <span className="text-2xl" aria-hidden="true">
                        {activeAvatar.emoji}
                      </span>
                    )}
                    <div>
                      <p className="text-sm font-black text-white">{activeProfileName}</p>
                      <p className="text-[11px] text-slate-400">
                        ★ {completedStarsCount} completed • {manualSlotsCount} saved slots
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    data-testid="btn-export-profile-download"
                    onClick={handleDownloadProfileJson}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold border border-violet-400 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .json</span>
                  </button>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                    <span>Whole-Profile Backup JSON</span>
                    <span className="text-slate-500">
                      QR payload: {binaryPayload.length} bytes
                    </span>
                  </div>
                  <textarea
                    data-testid="export-code-textarea"
                    readOnly
                    value={exportedString}
                    onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                    rows={4}
                    className="w-full p-3 font-mono text-xs bg-slate-950 border border-slate-800 rounded-2xl text-slate-200 resize-none focus:outline-none focus:border-violet-500 select-all"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <button
                    type="button"
                    data-testid="btn-copy-code"
                    onClick={handleCopy}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl border border-slate-600 transition-all active:scale-95 shadow-md"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-300" />
                        <span>Copied Backup!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-slate-300" />
                        <span>Copy JSON</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    data-testid="btn-show-qr"
                    onClick={() => setShowQrModal(true)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-lg border border-indigo-400 transition-all active:scale-95"
                  >
                    <QrCode className="w-5 h-5" />
                    <span>Show QR Code</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    data-testid="btn-scan-qr"
                    onClick={() => setShowScannerModal(true)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-lg border border-indigo-400 transition-all active:scale-95 text-xs"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Scan Backup QR</span>
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    data-testid="input-share-profile-file"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    data-testid="btn-upload-share-profile-json"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl border border-slate-600 transition-all active:scale-95 text-xs"
                  >
                    <FileUp className="w-4 h-4 text-violet-300" />
                    <span>Choose .json File</span>
                  </button>
                </div>

                <div className="flex flex-col gap-1.5">
                  <textarea
                    data-testid="import-code-textarea"
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder="Paste Whole-Profile Backup JSON here..."
                    rows={3}
                    className="w-full p-3 font-mono text-xs bg-slate-950 border border-slate-800 rounded-2xl text-slate-200 resize-none focus:outline-none focus:border-violet-500"
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    data-testid="btn-share-import-profile-new"
                    onClick={() => handleImportProfile('new')}
                    className="flex items-center justify-center gap-2 py-3 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl shadow-lg border border-emerald-400 transition-all active:scale-95 text-xs"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Add as New Profile</span>
                  </button>

                  <button
                    type="button"
                    data-testid="btn-share-import-profile-replace"
                    onClick={() => handleImportProfile('replace')}
                    className="flex items-center justify-center gap-2 py-3 px-3 bg-amber-600 hover:bg-amber-500 text-slate-950 font-black rounded-2xl shadow-lg border border-amber-300 transition-all active:scale-95 text-xs"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Replace Active Profile</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen QR Code Display Modal */}
      <FullScreenQrModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        binaryPayload={binaryPayload}
      />

      {/* QR Code Scanner Modal */}
      <QrScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        onSuccess={handleScanSuccess}
      />
    </>
  );
};
