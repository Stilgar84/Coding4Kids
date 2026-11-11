import React, { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  DEFAULT_PROFILE_ID,
  PROFILE_AVATARS,
  PROFILE_COLORS,
  ProfileAvatarId,
  ProfileBackupImportMode,
  ProfileColorId,
  exportProfileBackupToJson,
  getProfileAvatar,
  getProfileColor,
  getProfileDisplayName,
  getProfileProgress,
} from '../services/profileService';
import {
  AlertCircle,
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
  const {
    isProfileModalOpen,
    setProfileModalOpen,
    profiles,
    activeProfileId,
    switchProfile,
    createAndSwitchProfile,
    deleteUserProfile,
    importUserProfileBackup,
  } = useAppStore();

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

    // Pick a default avatar & color not yet used if possible for variety
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
    const json = exportProfileBackupToJson(activeProfileId);
    try {
      await navigator.clipboard.writeText(json);
    } catch {
      // Fallback in restricted environments
    }
    setCopiedBackup(true);
    setBackupStatus({
      type: 'success',
      text: `Copied ${activeDisplayName}'s full profile backup JSON to clipboard!`,
    });
    setTimeout(() => setCopiedBackup(false), 2000);
  };

  const handleDownloadBackup = () => {
    const json = exportProfileBackupToJson(activeProfileId);
    const safeSlug = activeDisplayName
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
    setBackupStatus({
      type: 'success',
      text: `Downloaded ${activeDisplayName}'s backup file!`,
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setBackupImportText(reader.result);
        setBackupStatus({
          type: 'success',
          text: `Loaded "${file.name}". Choose "Add as New Profile" or "Replace Active Profile" below.`,
        });
      }
    };
    reader.onerror = () => {
      setBackupStatus({ type: 'error', text: 'Could not read selected backup file.' });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportBackup = (mode: ProfileBackupImportMode) => {
    setBackupStatus(null);
    if (!backupImportText.trim()) {
      setBackupStatus({
        type: 'error',
        text: 'Paste a profile backup JSON or choose a .json backup file first.',
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
            ? `Added new profile "${importedName}" (${res.importedSlotCount ?? 0} saved slots restored)!`
            : `Replaced active profile with "${importedName}" (${res.importedSlotCount ?? 0} saved slots restored)!`,
      });
    } else {
      setBackupStatus({
        type: 'error',
        text: res.error || 'Invalid profile backup.',
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
      onClick={() => setProfileModalOpen(false)}
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-2xl max-h-[88vh] bg-slate-900 border-2 border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-violet-600/30 border border-violet-400/50 text-violet-300">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 id="profile-switcher-title" className="text-lg font-black text-white">
                Who&apos;s Playing?
              </h2>
              <p className="text-xs text-slate-400">
                Tap your character to switch — everyone gets their own saved blocks &amp; stars!
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="modal-profile-close-btn"
            onClick={() => setProfileModalOpen(false)}
            aria-label="Close profile switcher"
            className="flex items-center justify-center w-11 h-11 rounded-2xl text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-5">
          {/* Avatar Profile Cards Grid */}
          <div
            role="list"
            aria-label="Player profiles"
            data-testid="profile-cards-grid"
            className="grid grid-cols-1 sm:grid-cols-2 gap-3.5"
          >
            {profiles.map((profile, index) => {
              const avatar = getProfileAvatar(profile.avatarId);
              const color = getProfileColor(profile.colorId);
              const displayName = getProfileDisplayName(profile);
              const isActive = profile.id === activeProfileId;
              const isDefault = profile.id === DEFAULT_PROFILE_ID;
              const isConfirmingDelete = confirmDeleteId === profile.id;
              const completedCount = Object.keys(
                getProfileProgress(profile.id).completedLessons
              ).length;

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
                  {/* 1-Tap Switch Button (full keyboard Enter/Space accessible) */}
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

                    {/* Name & Stars */}
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
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-400 font-semibold">
                        <span className="inline-flex items-center gap-1 text-amber-300">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span data-testid={`profile-stars-${profile.id}`}>{completedCount}</span>
                        </span>
                        <span aria-hidden="true">•</span>
                        <span>{color.label}</span>
                      </div>
                    </div>
                  </button>

                  {/* Non-Default Profile Delete Control (Sibling button — never nested inside switch button) */}
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
              className="flex items-center justify-center gap-2 w-full min-h-[54px] py-3 px-4 rounded-2xl border-2 border-dashed border-emerald-500/60 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 font-black text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 active:scale-[0.99] transition-all"
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
                  <div>
                    <h3 className="text-sm font-black text-white">Pick Your Character</h3>
                    <p className="text-[11px] text-slate-400">
                      {customName.trim() || selectedAvatar.label} • {selectedColor.label}
                    </p>
                  </div>
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
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-slate-300">1. Character</span>
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
                        className={`flex flex-col items-center justify-center gap-0.5 min-h-[56px] p-1.5 rounded-2xl border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
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
              </div>

              {/* Step 2: Color + Shape Badge Picker (Color-blind accessible) */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-slate-300">2. Color &amp; Shape Badge</span>
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
                        className={`flex items-center justify-center gap-1.5 min-h-[48px] px-2.5 py-2 rounded-2xl border-2 font-black text-xs transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${
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
              </div>

              {/* Step 3: Optional Short Name */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="new-profile-name-input"
                  className="text-xs font-bold text-slate-300"
                >
                  3. Nickname <span className="text-slate-500 font-normal">(optional)</span>
                </label>
                <input
                  id="new-profile-name-input"
                  type="text"
                  data-testid="input-profile-name"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder={selectedAvatar.label}
                  maxLength={16}
                  className="w-full px-4 py-2.5 bg-slate-900 border-2 border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 font-bold"
                />
              </div>

              {/* Confirm Create Button */}
              <button
                type="submit"
                data-testid="btn-create-profile"
                className="flex items-center justify-center gap-2 w-full min-h-[52px] py-3 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm border-2 border-emerald-300 shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 active:scale-[0.99] transition-all"
              >
                <Check className="w-5 h-5 stroke-[3]" />
                <span>Start Playing as {customName.trim() || selectedAvatar.label}!</span>
              </button>
            </form>
          )}

          {/* Whole-Profile Backup Export & Import */}
          <div className="border-t border-slate-800 pt-4">
            <button
              type="button"
              data-testid="btn-toggle-profile-backup"
              aria-expanded={isBackupOpen}
              onClick={() => {
                setIsBackupOpen((v) => !v);
                setBackupStatus(null);
              }}
              className="flex items-center justify-between w-full px-4 py-2.5 rounded-2xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 text-xs font-bold text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Download className="w-4 h-4 text-violet-400" />
                <span>Backup or Move Profile ({activeDisplayName})</span>
              </span>
              <span className="text-slate-400">{isBackupOpen ? 'Hide' : 'Open'}</span>
            </button>

            {isBackupOpen && (
              <div
                data-testid="profile-backup-panel"
                className="mt-3 p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col gap-3.5"
              >
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-slate-200">
                    Export {activeDisplayName}&apos;s Whole Profile
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Includes stars, badges, lesson auto-saves, sandbox auto-saves, and manual save
                    slots.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 mt-1">
                    <button
                      type="button"
                      data-testid="btn-copy-profile-backup"
                      onClick={handleCopyBackup}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 transition-colors"
                    >
                      {copiedBackup ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span>Copied Backup!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-slate-300" />
                          <span>Copy Backup JSON</span>
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
                      <span>Download .json</span>
                    </button>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="profile-backup-import-textarea"
                      className="text-xs font-bold text-slate-200"
                    >
                      Import Profile Backup
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,application/json"
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
                      <span>Choose .json File</span>
                    </button>
                  </div>

                  <textarea
                    id="profile-backup-import-textarea"
                    data-testid="textarea-profile-backup-import"
                    value={backupImportText}
                    onChange={(e) => setBackupImportText(e.target.value)}
                    placeholder="Paste profile backup JSON here, or choose a .json file above..."
                    rows={3}
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
                      <span>Add as New Profile</span>
                    </button>
                    <button
                      type="button"
                      data-testid="btn-import-profile-replace"
                      onClick={() => handleImportBackup('replace')}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-black border border-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 active:scale-95 transition-all"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Replace Active Profile</span>
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
