import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { BEAT_LED_PALETTE, BeatState } from '../types';

interface BeatToolbarToolsProps {
  state: BeatState;
}

export const BeatToolbarTools: React.FC<BeatToolbarToolsProps> = ({ state: propState }) => {
  useAppStore();
  const {
    beatState: storeBeatState,
    toggleBeatMuted,
    unlockBeatAudio,
  } = useAppStore.getState();

  const state = propState || storeBeatState;
  const isMuted = Boolean(state?.isMuted);
  const activeColor = state?.activeColor || '#06b6d4';
  const swatchMeta = BEAT_LED_PALETTE.find(
    (s) => s.hex.toLowerCase() === activeColor.toLowerCase()
  );

  const handleToggleMute = () => {
    if (isMuted) {
      unlockBeatAudio();
    }
    toggleBeatMuted();
  };

  return (
    <div className="flex items-center gap-1.5 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
      {/* Accessible Mute / Unmute Toggle */}
      <button
        type="button"
        data-testid="tool-beat-mute"
        aria-pressed={isMuted}
        aria-label={isMuted ? 'Unmute Beat Audio' : 'Mute Beat Audio'}
        onClick={handleToggleMute}
        title={isMuted ? 'Unmute Beat Audio' : 'Mute Beat Audio'}
        className={`flex items-center justify-center w-9 h-9 rounded-lg border transition-all active:scale-95 ${
          isMuted
            ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-md'
            : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-emerald-300 hover:text-emerald-200'
        }`}
      >
        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </button>

      {/* Active LED Color Swatch Indicator */}
      <div
        data-testid="tool-beat-active-color"
        title={`Active LED Color: ${swatchMeta?.label || activeColor}`}
        aria-label={`Active LED Color: ${swatchMeta?.label || activeColor}`}
        className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-900 border border-slate-700"
      >
        <span
          style={{
            backgroundColor: activeColor,
            boxShadow: `0 0 8px ${activeColor}99`,
          }}
          className="block w-5 h-5 rounded-md border border-white/60"
        />
      </div>
    </div>
  );
};
