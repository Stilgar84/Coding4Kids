import React from 'react';
import { RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { BEAT_LED_PALETTE, BeatState } from '../types';

interface BeatToolbarToolsProps {
  state: BeatState;
}

export const BeatToolbarTools: React.FC<BeatToolbarToolsProps> = ({ state: propState }) => {
  const storeBeatState = useAppStore((s) => s.beatState);
  const toggleBeatMuted = useAppStore((s) => s.toggleBeatMuted);
  const unlockBeatAudio = useAppStore((s) => s.unlockBeatAudio);
  const clearBeatMatrix = useAppStore((s) => s.clearBeatMatrix);

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
    <div className="flex items-center gap-1.5 bg-slate-950/60 p-1.5 rounded-2xl border border-slate-800">
      {/* Accessible Mute / Unmute Toggle */}
      <button
        type="button"
        data-testid="tool-beat-mute"
        aria-pressed={isMuted}
        aria-label={isMuted ? 'Unmute Beat Audio' : 'Mute Beat Audio'}
        onClick={handleToggleMute}
        title={isMuted ? 'Unmute Beat Audio' : 'Mute Beat Audio'}
        className={`flex items-center justify-center w-10 h-10 rounded-xl border transition-all active:scale-95 ${
          isMuted
            ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-md'
            : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-emerald-300 hover:text-emerald-200'
        }`}
      >
        {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
      </button>

      {/* Active LED Color Swatch Indicator (with Color-Blind Shape Cue) */}
      <div
        data-testid="tool-beat-active-color"
        title={`Active LED Color: ${swatchMeta?.label || activeColor}`}
        aria-label={`Active LED Color: ${swatchMeta?.label || activeColor}`}
        className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-900 border border-slate-700"
      >
        <span
          style={{
            backgroundColor: activeColor,
            boxShadow: `0 0 8px ${activeColor}99`,
          }}
          className="flex items-center justify-center w-6 h-6 rounded-lg border border-white/60 text-[10px] font-black text-slate-950 leading-none"
        >
          {swatchMeta?.shapeCue || '●'}
        </span>
      </div>

      {/* Clear / Reset 8x8 LED Matrix */}
      <button
        type="button"
        data-testid="tool-beat-clear"
        aria-label="Clear LED Matrix"
        onClick={clearBeatMatrix}
        title="Clear all 64 LEDs and reset Beat pad"
        className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-500 transition-all active:scale-95"
      >
        <RotateCcw className="w-5 h-5 text-rose-400" />
      </button>
    </div>
  );
};
