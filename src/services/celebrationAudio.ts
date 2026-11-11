import { SimulationSpeed } from '../types';
import { beatSynth } from '../simulations/beat/beatSynth';

export interface CelebrationAudioOptions {
  speed?: SimulationSpeed | number;
  isMuted?: boolean;
}

function shouldMuteOrSuppressCelebration(options?: CelebrationAudioOptions): boolean {
  if (options?.isMuted || beatSynth.isMuted()) return true;
  if (options?.speed === 'instant' || options?.speed === 0) return true;
  return false;
}

/**
 * Plays the upbeat 4-note victory jingle (`C5 -> E5 -> G5 -> C6`) for standard puzzle completions.
 * Gesture-safe & non-blocking: respects mute and `'instant'` simulation mode, and never throws
 * if Web Audio is unavailable or suspended.
 */
export function playStandardVictoryJingle(options?: CelebrationAudioOptions): boolean {
  if (shouldMuteOrSuppressCelebration(options)) return false;
  beatSynth.playVictoryFanfare(false);
  return true;
}

/**
 * Plays the richer 6-note grand fanfare (`C5 -> G6`) for Capstone completions and
 * newly unlocked Module Mastery Badges.
 * Gesture-safe & non-blocking: respects mute and `'instant'` simulation mode, and never throws
 * if Web Audio is unavailable or suspended.
 */
export function playGrandBadgeFanfare(options?: CelebrationAudioOptions): boolean {
  if (shouldMuteOrSuppressCelebration(options)) return false;
  beatSynth.playVictoryFanfare(true);
  return true;
}

/**
 * Dispatches either the grand badge/capstone fanfare or the standard victory jingle.
 */
export function playCelebrationAudio(
  isGrand: boolean,
  options?: CelebrationAudioOptions
): boolean {
  return isGrand ? playGrandBadgeFanfare(options) : playStandardVictoryJingle(options);
}
