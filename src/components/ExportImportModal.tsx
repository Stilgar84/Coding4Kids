import React, { useState, useEffect, useRef, useMemo } from 'react';
import QRCode from 'qrcode';
import { useAppStore, useAppStoreSelector } from '../store/useAppStore';
import {
  ProfileBackupImportMode,
  exportProfileBackupToQrBytes,
  exportProfileBackupToString,
  getProfileAvatar,
  getProfileDisplayName,
  getProfileProgress,
  isProfileBackupPayload,
} from '../services/profileService';
import { getSavedPrograms } from '../services/localSaveService';
import { uint8ArrayToBase64URL } from '../engine/serialization/binaryWriter';
import { isBinaryProfileBackupBytes } from '../engine/serialization/profileSerializer';
import { splitIntoQrChunks } from '../engine/serialization/qrChunker';
import {
  X,
  Share2,
  Download,
  Upload,
  Copy,
  Check,
  AlertCircle,
  Camera,
  UserPlus,
  RefreshCw,
  FileUp,
  Users,
  Maximize2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { FullScreenQrModal } from './FullScreenQrModal';
import { QrScannerModal } from './QrScannerModal';

export const ExportImportModal: React.FC = () => {
  const isExportImportOpen = useAppStoreSelector((s) => s.isExportImportOpen);
  if (!isExportImportOpen) return null;
  return <ExportImportModalContent />;
};

const ExportImportModalContent: React.FC = () => {
  useAppStore();
  const {
    isExportImportOpen,
    setExportImportOpen,
    appMode,
    activeActivityId,
    activeSimId,
    profiles,
    activeProfileId,
    exportCode,
    exportBinary,
    importCode,
    importBinary,
    importUserProfileBackup,
  } = useAppStore.getState();

  const [shareScope, setShareScope] = useState<'program' | 'profile'>('program');
  const [tab, setTab] = useState<'export' | 'import'>('export');
  const [includeMap, setIncludeMap] = useState(true);
  const [importText, setImportText] = useState('');
  const [copied, setCopied] = useState(false);
  const [isTextCodeOpen, setIsTextCodeOpen] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inlineQrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (isExportImportOpen) {
      setShareScope('program');
      setTab('export');
      setCopied(false);
      setIsTextCodeOpen(false);
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

  const binaryPayload = useMemo(() => {
    if (!isExportImportOpen) return new Uint8Array(0);
    try {
      return shareScope === 'profile'
        ? exportProfileBackupToQrBytes(activeProfileId)
        : exportBinary(includeMap);
    } catch {
      return new Uint8Array(0);
    }
  }, [isExportImportOpen, shareScope, activeProfileId, includeMap, exportBinary]);

  const exportedString = useMemo(() => {
    if (!isExportImportOpen) return '';
    if (shareScope === 'profile') {
      return binaryPayload.length > 0 ? uint8ArrayToBase64URL(binaryPayload) : '';
    }
    try {
      return exportCode(includeMap);
    } catch {
      return '';
    }
  }, [isExportImportOpen, shareScope, binaryPayload, includeMap, exportCode]);

  const qrChunks = useMemo(() => {
    if (!binaryPayload || binaryPayload.length === 0) return [];
    try {
      return splitIntoQrChunks(binaryPayload);
    } catch {
      return [];
    }
  }, [binaryPayload]);

  // Render inline scannable QR code immediately on open when on Export tab
  useEffect(() => {
    if (!isExportImportOpen || tab !== 'export' || qrChunks.length === 0 || !inlineQrCanvasRef.current) {
      return;
    }
    const firstChunk = qrChunks[0];
    QRCode.toCanvas(
      inlineQrCanvasRef.current,
      [{ data: firstChunk.data, mode: 'byte' }],
      {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 176,
        color: {
          dark: '#020617',
          light: '#ffffff',
        },
      },
      () => {}
    );
  }, [isExportImportOpen, tab, qrChunks]);

  if (!isExportImportOpen) return null;

  const activeProfile =
    profiles.find((p) => p.id === activeProfileId) ?? profiles[0];
  const activeProfileName = activeProfile
    ? getProfileDisplayName(activeProfile)
    : 'Player 1';
  const activeAvatar = activeProfile
    ? getProfileAvatar(activeProfile.avatarId)
    : null;

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
    const backupText = exportedString || exportProfileBackupToString(activeProfileId);
    const safeSlug =
      activeProfileName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'player';
    const blob = new Blob([backupText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `robotemu-profile-${safeSlug}.txt`;
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
      if (reader.result instanceof ArrayBuffer) {
        const bytes = new Uint8Array(reader.result);
        const decodedText = isBinaryProfileBackupBytes(bytes)
          ? uint8ArrayToBase64URL(bytes)
          : new TextDecoder().decode(bytes).replace(/^\uFEFF/, '').trim();
        setImportText(decodedText);
        if (isProfileBackupPayload(bytes) || isProfileBackupPayload(decodedText)) {
          setShareScope('profile');
          setTab('import');
          setStatusMessage({
            type: 'success',
            text: `Loaded "${file.name}". Choose New Player or Replace below.`,
          });
        } else {
          setStatusMessage({
            type: 'error',
            text: `"${file.name}" is not a valid player backup file.`,
          });
        }
      }
    };
    reader.onerror = () => {
      setStatusMessage({ type: 'error', text: 'Could not read backup file.' });
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleImportProgram = () => {
    setStatusMessage(null);
    const trimmed = importText.trim();
    if (!trimmed) {
      setStatusMessage({ type: 'error', text: 'Paste a share code first.' });
      return;
    }

    if (isProfileBackupPayload(trimmed)) {
      setShareScope('profile');
      setStatusMessage({
        type: 'success',
        text: 'Player backup found! Choose New Player or Replace below.',
      });
      return;
    }

    const res = importCode(trimmed);
    if (res.success) {
      if (res.versionMismatchPending) {
        return;
      }
      setStatusMessage({ type: 'success', text: 'Blocks loaded!' });
      setTimeout(() => {
        setExportImportOpen(false);
      }, 900);
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Could not load share code.' });
    }
  };

  const handleImportProfile = (mode: ProfileBackupImportMode) => {
    setStatusMessage(null);
    const trimmed = importText.trim();
    if (!trimmed) {
      setStatusMessage({
        type: 'error',
        text: 'Paste a player backup or choose a file first.',
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
            ? `Added "${name}" (${res.importedSlotCount ?? 0} saves)!`
            : `Updated "${name}" (${res.importedSlotCount ?? 0} saves)!`,
      });
      setTimeout(() => {
        setExportImportOpen(false);
      }, 900);
    } else {
      setStatusMessage({
        type: 'error',
        text: res.error || 'Could not load player backup.',
      });
    }
  };

  const handleScanSuccess = (scannedBinary: Uint8Array) => {
    setShowScannerModal(false);

    if (isProfileBackupPayload(scannedBinary)) {
      const decodedText = isBinaryProfileBackupBytes(scannedBinary)
        ? uint8ArrayToBase64URL(scannedBinary)
        : new TextDecoder().decode(scannedBinary).replace(/^\uFEFF/, '').trim();
      setShareScope('profile');
      setTab('import');
      setImportText(decodedText);
      setStatusMessage({
        type: 'success',
        text: 'Player QR scanned! Choose New Player or Replace below.',
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
        text: 'Blocks loaded from QR!',
      });
      setTimeout(() => {
        setExportImportOpen(false);
      }, 900);
    } else {
      setStatusMessage({
        type: 'error',
        text: res.error || 'Could not read QR code.',
      });
    }
  };

  const progress = activeProfile ? getProfileProgress(activeProfile.id) : null;
  const completedStarsCount = progress ? Object.keys(progress.completedLessons).length : 0;
  const badgesCount = progress ? progress.earnedBadges.length : 0;
  const manualSlotsCount = activeProfile ? getSavedPrograms(activeProfile.id).length : 0;

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-import-modal-title"
        data-testid="export-import-modal"
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
        onClick={() => setExportImportOpen(false)}
      >
        <div
          ref={dialogRef}
          className="relative w-full max-w-md max-h-[90vh] bg-slate-900 border-2 border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/60 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-9 h-9 rounded-2xl bg-indigo-600/30 border border-indigo-500/50 text-indigo-400">
                <Share2 className="w-4 h-4" />
              </div>
              <h2 id="export-import-modal-title" className="text-base sm:text-lg font-black text-white">
                {shareScope === 'profile' ? 'Player Backup' : 'Share'}
              </h2>
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
            className="flex items-center gap-2 px-4 pt-2.5 pb-2 bg-slate-950/50 border-b border-slate-800/80 shrink-0"
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
              <span>Blocks</span>
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
              <span>Player</span>
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
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                tab === 'export'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>QR &amp; Share</span>
            </button>
            <button
              type="button"
              data-testid="tab-import"
              onClick={() => {
                setTab('import');
                setStatusMessage(null);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                tab === 'import'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>Scan &amp; Open</span>
            </button>
          </div>

          {/* Content Body */}
          <div className="p-4 overflow-y-auto flex flex-col gap-3">
            {shareScope === 'program' ? (
              tab === 'export' ? (
                <>
                  {/* Inline Scannable QR Code (Immediate Visual Payoff!) */}
                  <div className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-slate-950 border border-slate-800">
                    <div className="p-2.5 bg-white rounded-2xl shadow-lg">
                      <canvas
                        ref={inlineQrCanvasRef}
                        data-testid="inline-share-qr"
                        className="block rounded-lg w-44 h-44"
                      />
                    </div>
                    {qrChunks.length > 1 && (
                      <span className="text-[11px] font-bold text-amber-300">
                        {qrChunks.length} QR parts — tap Big QR to auto-play
                      </span>
                    )}
                  </div>

                  {/* Action Row: Scan QR, Big QR, Copy Code */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      data-testid="btn-scan-qr"
                      onClick={() => setShowScannerModal(true)}
                      className="flex flex-col items-center justify-center gap-1 py-2.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl shadow border border-emerald-400 transition-all active:scale-95 text-xs"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Scan QR</span>
                    </button>

                    <button
                      type="button"
                      data-testid="btn-show-qr"
                      onClick={() => setShowQrModal(true)}
                      className="flex flex-col items-center justify-center gap-1 py-2.5 px-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow border border-indigo-400 transition-all active:scale-95 text-xs"
                    >
                      <Maximize2 className="w-4 h-4" />
                      <span>Big QR</span>
                    </button>

                    <button
                      type="button"
                      data-testid="btn-copy-code"
                      onClick={handleCopy}
                      className="flex flex-col items-center justify-center gap-1 py-2.5 px-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl border border-slate-600 transition-all active:scale-95 text-xs"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-300" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-slate-300" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  {appMode === 'curriculum' ? (
                    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/30 text-xs">
                      <span
                        data-testid="export-lesson-envelope-badge"
                        className="font-bold text-emerald-300"
                      >
                        🎓 Puzzle {activeActivityId}
                      </span>
                      <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          data-testid="checkbox-include-lesson-envelope"
                          checked={includeMap}
                          onChange={(e) => setIncludeMap(e.target.checked)}
                          className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <span>Include puzzle</span>
                      </label>
                    </div>
                  ) : (
                    activeSimId === 'grid' && (
                      <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={includeMap}
                          onChange={(e) => setIncludeMap(e.target.checked)}
                          className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <span>Include map layout</span>
                      </label>
                    )
                  )}

                  {/* Collapsible Text Code Disclosure (No Raw Base64 Wall!) */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
                    <button
                      type="button"
                      data-testid="btn-toggle-text-code"
                      aria-expanded={isTextCodeOpen}
                      onClick={() => setIsTextCodeOpen((v) => !v)}
                      className="flex items-center justify-between w-full px-3 py-2 text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      <span>🔤 Text Code</span>
                      {isTextCodeOpen ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                    {isTextCodeOpen && (
                      <div className="px-3 pb-3">
                        <textarea
                          data-testid="export-code-textarea"
                          readOnly
                          value={exportedString}
                          onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                          rows={2}
                          className="w-full p-2.5 font-mono text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-200 resize-none focus:outline-none focus:border-indigo-500 select-all"
                        />
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    data-testid="btn-scan-qr"
                    onClick={() => setShowScannerModal(true)}
                    className="flex items-center justify-center gap-2 w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-lg border border-indigo-400 transition-all active:scale-95"
                  >
                    <Camera className="w-5 h-5" />
                    <span>Scan QR Code</span>
                  </button>

                  <div className="flex flex-col gap-1.5">
                    <textarea
                      data-testid="import-code-textarea"
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      placeholder="Or paste share code here..."
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
                    <span>Open Blocks</span>
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
                        ⭐ {completedStarsCount} • 🏅 {badgesCount} • 💾 {manualSlotsCount}
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
                    <span>Save File</span>
                  </button>
                </div>

                {/* Inline QR for Profile Backup */}
                <div className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="p-2.5 bg-white rounded-2xl shadow-lg">
                    <canvas
                      ref={inlineQrCanvasRef}
                      data-testid="inline-share-qr"
                      className="block rounded-lg w-40 h-40"
                    />
                  </div>
                  {qrChunks.length > 1 && (
                    <span className="text-[11px] font-bold text-amber-300">
                      {qrChunks.length} QR parts — tap Big QR to auto-play
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    data-testid="btn-copy-code"
                    onClick={handleCopy}
                    className="flex items-center justify-center gap-1.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl border border-slate-600 transition-all active:scale-95 text-xs"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-300" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-slate-300" />
                        <span>Copy Backup</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    data-testid="btn-show-qr"
                    onClick={() => setShowQrModal(true)}
                    className="flex items-center justify-center gap-1.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow border border-indigo-400 transition-all active:scale-95 text-xs"
                  >
                    <Maximize2 className="w-4 h-4" />
                    <span>Big QR</span>
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
                  <button
                    type="button"
                    data-testid="btn-toggle-text-code"
                    aria-expanded={isTextCodeOpen}
                    onClick={() => setIsTextCodeOpen((v) => !v)}
                    className="flex items-center justify-between w-full px-3 py-2 text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <span>🔤 Text Code</span>
                    {isTextCodeOpen ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                  {isTextCodeOpen && (
                    <div className="px-3 pb-3">
                      <textarea
                        data-testid="export-code-textarea"
                        readOnly
                        value={exportedString}
                        onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                        rows={3}
                        className="w-full p-2.5 font-mono text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-200 resize-none focus:outline-none focus:border-violet-500 select-all"
                      />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    data-testid="btn-scan-qr"
                    onClick={() => setShowScannerModal(true)}
                    className="flex items-center justify-center gap-1.5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow border border-indigo-400 transition-all active:scale-95 text-xs"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Scan QR</span>
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.rprof,.bin,.json,text/plain,application/json"
                    data-testid="input-share-profile-file"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    data-testid="btn-upload-share-profile-json"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-1.5 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl border border-slate-600 transition-all active:scale-95 text-xs"
                  >
                    <FileUp className="w-4 h-4 text-violet-300" />
                    <span>Open File</span>
                  </button>
                </div>

                <textarea
                  data-testid="import-code-textarea"
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="Or paste player backup here..."
                  rows={3}
                  className="w-full p-3 font-mono text-xs bg-slate-950 border border-slate-800 rounded-2xl text-slate-200 resize-none focus:outline-none focus:border-violet-500"
                />

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

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    data-testid="btn-share-import-profile-new"
                    onClick={() => handleImportProfile('new')}
                    className="flex items-center justify-center gap-1.5 py-3 px-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl shadow border border-emerald-400 transition-all active:scale-95 text-xs"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>New Player</span>
                  </button>

                  <button
                    type="button"
                    data-testid="btn-share-import-profile-replace"
                    onClick={() => handleImportProfile('replace')}
                    className="flex items-center justify-center gap-1.5 py-3 px-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-black rounded-2xl shadow border border-amber-300 transition-all active:scale-95 text-xs"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Replace</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <FullScreenQrModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        binaryPayload={binaryPayload}
      />

      <QrScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        onSuccess={handleScanSuccess}
      />
    </>
  );
};
