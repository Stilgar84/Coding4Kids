import React, { useEffect, useRef, useState } from 'react';
import { useAppStore, useAppStoreSelector } from '../store/useAppStore';
import {
  DEFAULT_PROFILE_ID,
  PROFILE_AVATARS,
  PROFILE_COLORS,
  ProfileAvatarId,
  ProfileBackupImportMode,
  ProfileColorId,
  exportProfileBackupToString,
  getProfileAvatar,
  getProfileColor,
  getProfileDisplayName,
  getProfileProgress,
  isProfileBackupPayload,
} from '../services/profileService';
import { uint8ArrayToBase64URL } from '../engine/serialization/binaryWriter';
import { isBinaryProfileBackupBytes } from '../engine/serialization/profileSerializer';
import {
  AlertCircle,
  Award,
  Check,
  Copy,
  Download,
  FileUp,
  Plus,
  RefreshCw,
  Star,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

export const ProfileSwitcherModal: React.FC = () => {
  const isProfileModalOpen = useAppStoreSelector((s) => s.isProfileModalOpen);
  if (!isProfileModalOpen) return null;
  return <ProfileSwitcherModalContent />;
};

const ProfileSwitcherModalContent: React.FC = () => {
  useAppStore();
  const {
    isProfileModalOpen,
    setProfileModalOpen,
    profiles,
    activeProfileId,
    switchProfile,
    createAndSwitchProfile,
    deleteUserProfile,
    importUserProfileBackup,
  } = useAppStore.getState();

  const [isCreating, setIsCreating] = useState(false);
  const [selectedAvatarId, setSelectedAvatarId] = useState<ProfileAvatarId>('frog');
  const [selectedColorId, setSelectedColorId] = useState<ProfileColorId>('emerald');
  const [customName, setCustomName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);
  const [backupImportText, setBackupImportText] = useState('');
  const [backupStatus, setBackupStatus] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const firstCardRef = useRef<HTMLButtonElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isProfileModalOpen) return;

    const usedAvatars = new Set(profiles.map((p) => p.avatarId));
    const nextAvatar =
      PROFILE_AVATARS.find((a) => !usedAvatars.has(a.id))?.id ?? PROFILE_AVATARS[1].id;
    const nextColor =
      PROFILE_COLORS[profiles.length % PROFILE_COLORS.length]?.id ?? PROFILE_COLORS[0].id;

    setSelectedAvatarId(nextAvatar);
    setSelectedColorId(nextColor);
    setCustomName('');
    setIsCreating(false);
    setConfirmDeleteId(null);
    setIsBackupOpen(false);
    setCopiedBackup(false);
    setBackupImportText('');
    setBackupStatus(null);

    const timer = setTimeout(() => {
      firstCardRef.current?.focus();
    }, 0);
    return () => clearTimeout(timer);
  }, [isProfileModalOpen]);

  useEffect(() => {
    if (!isProfileModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (confirmDeleteId) {
          setConfirmDeleteId(null);
        } else if (isCreating) {
          setIsCreating(false);
        } else if (isBackupOpen) {
          setIsBackupOpen(false);
        } else {
          setProfileModalOpen(false);
        }
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
  }, [isProfileModalOpen, confirmDeleteId, isCreating, isBackupOpen, setProfileModalOpen]);

  if (!isProfileModalOpen) return null;

  const handleCreateProfile = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    createAndSwitchProfile({
      avatarId: selectedAvatarId,
      colorId: selectedColorId,
      name: customName.trim(),
    });
    setIsCreating(false);
    setCustomName('');
  };

  const activeProfileObj =
    profiles.find((p) => p.id === activeProfileId) ?? profiles[0];
  const activeDisplayName = activeProfileObj
    ? getProfileDisplayName(activeProfileObj)
    : 'Player 1';

  const handleCopyBackup = async () => {
    const backupCode = exportProfileBackupToString(activeProfileId);
    try {
      await navigator.clipboard.writeText(backupCode);
    } catch {
      // Fallback in restricted environments
    }
    setCopiedBackup(true);
    setBackupStatus({
      type: 'success',
      text: `Copied ${activeDisplayName}'s backup!`,
    });
    setTimeout(() => setCopiedBackup(false), 2000);
  };

  const handleDownloadBackup = () => {
    const backupCode = exportProfileBackupToString(activeProfileId);
    const safeSlug =
      activeDisplayName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'player';
    const blob = new Blob([backupCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `robotemu-profile-${safeSlug}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setBackupStatus({
      type: 'success',
      text: `Saved ${activeDisplayName}'s backup file!`,
    });
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
        setBackupImportText(decodedText);
        if (isProfileBackupPayload(bytes) || isProfileBackupPayload(decodedText)) {
          setBackupStatus({
            type: 'success',
            text: `Loaded "${file.name}". Choose New Player or Replace below.`,
          });
        } else {
          setBackupStatus({
            type: 'error',
            text: `"${file.name}" is not a valid player backup file.`,
          });
        }
      }
    };
    reader.onerror = () => {
      setBackupStatus({ type: 'error', text: 'Could not read selected backup file.' });
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleImportBackup = (mode: ProfileBackupImportMode) => {
    setBackupStatus(null);
    if (!backupImportText.trim()) {
      setBackupStatus({
        type: 'error',
        text: 'Paste a player backup or choose a file first.',
      });
      return;
    }

    const res = importUserProfileBackup(backupImportText.trim(), mode);
    if (res.success && res.profile) {
      const importedName = getProfileDisplayName(res.profile);
      setBackupImportText('');
      setBackupStatus({
        type: 'success',
        text:
          mode === 'new'
            ? `Added new player "${importedName}" (${res.importedSlotCount ?? 0} saves)!`
            : `Updated "${importedName}" (${res.importedSlotCount ?? 0} saves)!`,
      });
    } else {
      setBackupStatus({
        type: 'error',
        text: res.error || 'Invalid player backup.',
      });
    }
  };

  const selectedAvatar = getProfileAvatar(selectedAvatarId);
  const selectedColor = getProfileColor(selectedColorId);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-switcher-title"
      data-testid="profile-switcher-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
      onClick={() => setProfileModalOpen(false)}
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-2xl max-h-[88vh] bg-slate-900 border-2 border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-violet-600/30 border border-violet-400/50 text-violet-300">
              <Users className="w-5 h-5" />
            </div>
            <h2 id="profile-switcher-title" className="text-lg font-black text-white">
              Who&apos;s Playing?
            </h2>
          </div>

          <button
            type="button"
            data-testid="modal-profile-close-btn"
            onClick={() => setProfileModalOpen(false)}
            aria-label="Close profile switcher"
            className="flex items-center justify-center w-10 h-10 rounded-2xl text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-4">
          {/* Avatar Profile Cards Grid */}
          <div
            role="list"
            aria-label="Player profiles"
            data-testid="profile-cards-grid"
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            {profiles.map((profile, index) => {
              const avatar = getProfileAvatar(profile.avatarId);
              const color = getProfileColor(profile.colorId);
              const displayName = getProfileDisplayName(profile);
              const isActive = profile.id === activeProfileId;
              const isDefault = profile.id === DEFAULT_PROFILE_ID;
              const isConfirmingDelete = confirmDeleteId === profile.id;
              const progress = getProfileProgress(profile.id);
              const completedCount = Object.keys(progress.completedLessons).length;
              const earnedBadges = progress.earnedBadges;

              return (
                <div
                  key={profile.id}
                  role="listitem"
                  data-testid={`profile-item-${profile.id}`}
                  className={`relative flex items-stretch rounded-2xl border-2 transition-all ${
                    isActive
                      ? 'bg-slate-800/90 border-violet-400 shadow-lg ring-2 ring-violet-500/30'
                      : 'bg-slate-950/90 border-slate-800 hover:border-slate-600'
                  }`}
                >
                  {/* 1-Tap Switch Button */}
                  <button
                    ref={index === 0 ? firstCardRef : undefined}
                    type="button"
                    data-testid={`profile-card-${profile.id}`}
                    aria-pressed={isActive}
                    aria-label={`${displayName} (${avatar.label}, ${color.label})${
                      isActive ? ', active profile' : ', switch to this profile'
                    }`}
                    onClick={() => switchProfile(profile.id)}
                    className="flex-1 flex items-center gap-3.5 p-3.5 text-left rounded-2xl min-h-[72px] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 active:scale-[0.99] transition-transform"
                  >
                    {/* Large Kid-Friendly Avatar + Color/Shape Badge */}
                    <div
                      className="relative flex items-center justify-center w-14 h-14 rounded-2xl border-2 shrink-0 text-3xl select-none shadow-inner"
                      style={{
                        backgroundColor: `${color.accentColor}26`,
                        borderColor: color.accentColor,
                      }}
                    >
                      <span aria-hidden="true">{avatar.emoji}</span>
                      <span
                        data-testid={`profile-shape-badge-${profile.id}`}
                        title={color.label}
                        aria-hidden="true"
                        className="absolute -bottom-1.5 -right-1.5 flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-black text-slate-950 border-2 border-slate-900 shadow"
                        style={{ backgroundColor: color.accentColor }}
                      >
                        {color.shapeSymbol}
                      </span>
                    </div>

                    {/* Name, Stars & Module Badges */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          data-testid={`profile-name-${profile.id}`}
                          className="font-black text-base text-white truncate"
                        >
                          {displayName}
                        </span>
                        {isActive && (
                          <span
                            data-testid={`profile-active-badge-${profile.id}`}
                            className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-violet-500 text-white shrink-0"
                          >
                            <Check className="w-3 h-3 stroke-[3]" />
                            <span>Active</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2.5 mt-1 text-xs text-slate-400 font-semibold">
                        <span className="inline-flex items-center gap-1 text-amber-300">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span data-testid={`profile-stars-${profile.id}`}>{completedCount}</span>
                        </span>
                        <span
                          data-testid={`profile-badges-${profile.id}`}
                          className={`inline-flex items-center gap-1 ${
                            earnedBadges.length > 0 ? 'text-amber-200' : 'text-slate-500'
                          }`}
                        >
                          <Award className="w-3.5 h-3.5 text-amber-400" />
                          <span>{earnedBadges.length}</span>
                          {earnedBadges.length > 0 && <span aria-hidden="true">🏅</span>}
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* Non-Default Profile Delete Control */}
                  {!isDefault && (
                    <div className="flex items-center pr-3">
                      {isConfirmingDelete ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            data-testid={`btn-confirm-delete-profile-${profile.id}`}
                            aria-label={`Confirm delete profile ${displayName}`}
                            onClick={() => {
                              deleteUserProfile(profile.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-2.5 h-10 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 active:scale-95"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            data-testid={`btn-cancel-delete-profile-${profile.id}`}
                            aria-label={`Cancel delete profile ${displayName}`}
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2.5 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 active:scale-95"
                          >
                            Keep
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          data-testid={`btn-delete-profile-${profile.id}`}
                          aria-label={`Delete profile ${displayName}`}
                          title={`Delete ${displayName}`}
                          onClick={() => setConfirmDeleteId(profile.id)}
                          className="flex items-center justify-center w-10 h-10 rounded-xl text-slate-400 hover:text-red-400 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Create New Profile Toggle / Form */}
          {!isCreating ? (
            <button
              type="button"
              data-testid="btn-show-create-profile"
              onClick={() => setIsCreating(true)}
              className="flex items-center justify-center gap-2 w-full min-h-[52px] py-3 px-4 rounded-2xl border-2 border-dashed border-emerald-500/60 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 font-black text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 active:scale-[0.99] transition-all"
            >
              <Plus className="w-5 h-5 stroke-[2.75]" />
              <span>New Player</span>
            </button>
          ) : (
            <form
              data-testid="profile-creator-panel"
              onSubmit={handleCreateProfile}
              className="flex flex-col gap-4 p-4 rounded-2xl bg-slate-950 border-2 border-emerald-500/50"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span
                    className="inline-flex items-center justify-center w-10 h-10 rounded-xl border-2 text-2xl"
                    style={{
                      backgroundColor: `${selectedColor.accentColor}26`,
                      borderColor: selectedColor.accentColor,
                    }}
                    aria-hidden="true"
                  >
                    {selectedAvatar.emoji}
                  </span>
                  <h3 className="text-sm font-black text-white">Pick Character</h3>
                </div>
                <button
                  type="button"
                  data-testid="btn-cancel-create-profile"
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                >
                  Cancel
                </button>
              </div>

              {/* Step 1: Avatar Grid */}
              <div
                role="group"
                aria-label="Choose character avatar"
                className="grid grid-cols-4 sm:grid-cols-8 gap-2"
              >
                {PROFILE_AVATARS.map((avatar) => {
                  const selected = avatar.id === selectedAvatarId;
                  return (
                    <button
                      key={avatar.id}
                      type="button"
                      data-testid={`avatar-option-${avatar.id}`}
                      aria-pressed={selected}
                      aria-label={avatar.label}
                      title={avatar.label}
                      onClick={() => setSelectedAvatarId(avatar.id)}
                      className={`flex flex-col items-center justify-center gap-0.5 min-h-[54px] p-1.5 rounded-2xl border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                        selected
                          ? 'bg-emerald-500/20 border-emerald-400 scale-105 shadow-md'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <span className="text-2xl leading-none" aria-hidden="true">
                        {avatar.emoji}
                      </span>
                      <span className="text-[10px] font-bold text-slate-300">{avatar.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Step 2: Color + Shape Badge Picker */}
              <div
                role="group"
                aria-label="Choose color and shape badge"
                className="grid grid-cols-3 sm:grid-cols-6 gap-2"
              >
                {PROFILE_COLORS.map((color) => {
                  const selected = color.id === selectedColorId;
                  return (
                    <button
                      key={color.id}
                      type="button"
                      data-testid={`color-option-${color.id}`}
                      aria-pressed={selected}
                      aria-label={color.label}
                      title={color.label}
                      onClick={() => setSelectedColorId(color.id)}
                      className={`flex items-center justify-center gap-1.5 min-h-[44px] px-2.5 py-1.5 rounded-2xl border-2 font-black text-xs transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                        selected
                          ? 'border-white scale-105 shadow-md text-white bg-slate-800'
                          : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="inline-flex items-center justify-center w-6 h-6 rounded-full text-slate-950 font-black text-xs shadow"
                        style={{ backgroundColor: color.accentColor }}
                      >
                        {color.shapeSymbol}
                      </span>
                      <span className="truncate">{color.shapeName}</span>
                    </button>
                  );
                })}
              </div>

              {/* Step 3: Optional Short Name */}
              <input
                id="new-profile-name-input"
                type="text"
                aria-label="Nickname (optional)"
                data-testid="input-profile-name"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={`${selectedAvatar.label} (name optional)`}
                maxLength={16}
                className="w-full px-4 py-2.5 bg-slate-900 border-2 border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 font-bold"
              />

              {/* Confirm Create Button */}
              <button
                type="submit"
                data-testid="btn-create-profile"
                className="flex items-center justify-center gap-2 w-full min-h-[50px] py-3 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm border-2 border-emerald-300 shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 active:scale-[0.99] transition-all"
              >
                <Check className="w-5 h-5 stroke-[3]" />
                <span>Play as {customName.trim() || selectedAvatar.label}!</span>
              </button>
            </form>
          )}

          {/* Parent / Teacher Backup Disclosure */}
          <div className="border-t border-slate-800 pt-3">
            <button
              type="button"
              data-testid="btn-toggle-profile-backup"
              aria-expanded={isBackupOpen}
              onClick={() => {
                setIsBackupOpen((v) => !v);
                setBackupStatus(null);
              }}
              className="flex items-center justify-between w-full px-4 py-2.5 rounded-2xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 text-xs font-bold text-slate-400 hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Download className="w-4 h-4 text-violet-400" />
                <span>Parent Backup ({activeDisplayName})</span>
              </span>
              <span>{isBackupOpen ? '▲' : '▼'}</span>
            </button>

            {isBackupOpen && (
              <div
                data-testid="profile-backup-panel"
                className="mt-3 p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col gap-3.5"
              >
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    data-testid="btn-copy-profile-backup"
                    onClick={handleCopyBackup}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 transition-colors"
                  >
                    {copiedBackup ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
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
                    data-testid="btn-download-profile-json"
                    onClick={handleDownloadBackup}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold border border-violet-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Save Backup File</span>
                  </button>
                </div>

                <div className="border-t border-slate-800 pt-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="profile-backup-import-textarea"
                      className="text-xs font-bold text-slate-200"
                    >
                      Restore Backup
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.rprof,.bin,.json,text/plain,application/json"
                      data-testid="input-profile-backup-file"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      data-testid="btn-upload-profile-json"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-200 border border-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                    >
                      <FileUp className="w-3.5 h-3.5 text-violet-300" />
                      <span>Open File</span>
                    </button>
                  </div>

                  <textarea
                    id="profile-backup-import-textarea"
                    data-testid="textarea-profile-backup-import"
                    value={backupImportText}
                    onChange={(e) => setBackupImportText(e.target.value)}
                    placeholder="Paste player backup here..."
                    rows={2}
                    className="w-full p-2.5 font-mono text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-200 resize-none focus:outline-none focus:border-violet-400"
                  />

                  {backupStatus && (
                    <div
                      data-testid="profile-backup-status"
                      role="status"
                      className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-semibold ${
                        backupStatus.type === 'success'
                          ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-200'
                          : 'bg-red-950/80 border border-red-500/50 text-red-200'
                      }`}
                    >
                      {backupStatus.type === 'success' ? (
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                      )}
                      <span>{backupStatus.text}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      data-testid="btn-import-profile-new"
                      onClick={() => handleImportBackup('new')}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black border border-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 active:scale-95 transition-all"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>New Player</span>
                    </button>
                    <button
                      type="button"
                      data-testid="btn-import-profile-replace"
                      onClick={() => handleImportBackup('replace')}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-black border border-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 active:scale-95 transition-all"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Replace Active</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
