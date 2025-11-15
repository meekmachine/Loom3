/**
 * LipSync Agency Types
 * Type definitions for lip-sync functionality with TTS integration
 */

export type VisemeID = number; // 0-21 for Microsoft SAPI viseme set

export interface VisemeEvent {
  visemeId: VisemeID;
  offsetMs: number;
  durationMs: number;
}

export interface AnimationCurve {
  time: number;
  intensity: number;
}

export interface VisemeSnippet {
  name: string;
  curves: Record<VisemeID, AnimationCurve[]>;
  maxTime: number;
  loop: boolean;
  snippetPlaybackRate: number;
  snippetIntensityScale: number;
}

export interface LipSyncConfig {
  engine?: 'webSpeech' | 'sapi';
  onsetIntensity?: number; // 0-100, default: 90
  holdMs?: number; // Hold duration for WebSpeech, default: 140ms
  speechRate?: number; // 0.1-10.0, default: 1.0
  jawActivation?: number; // 0-2.0, multiplier for jaw movement, default: 1.0
  lipsyncIntensity?: number; // 0-2.0, multiplier for viseme intensity, default: 1.0
  useEmotionalModulation?: boolean; // Enable emotional modulation, default: false
  useCoarticulation?: boolean; // Enable coarticulation, default: true
}

export interface LipSyncState {
  status: 'idle' | 'speaking' | 'stopped';
  currentViseme?: VisemeID;
  intensity?: number;
  error?: string;
}

export interface LipSyncCallbacks {
  onVisemeStart?: (visemeId: VisemeID, intensity: number) => void;
  onVisemeEnd?: (visemeId: VisemeID) => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  onError?: (error: Error) => void;
}

export interface PhonemeMapping {
  phoneme: string;
  viseme: VisemeID;
  duration: number;
}

export interface SAPIViseme {
  number: VisemeID;
  offset?: number;
  duration: number;
  audioPosition?: number;
}

export interface SAPIResponse {
  audioStream: string; // base64 WAV
  visemes: SAPIViseme[];
}

export interface PhonemeTiming {
  phoneme: string;
  startMs: number;
  durationMs: number;
}

/**
 * Microsoft SAPI Viseme Set (0-21)
 * Compatible with Windows Speech API
 */
export const VISEME_NAMES: Record<VisemeID, string> = {
  0: 'Silence',
  1: 'AE-AX-AH',
  2: 'AA',
  3: 'AO',
  4: 'EY-EH-UH',
  5: 'ER',
  6: 'Y-IY-IH-IX',
  7: 'W-UW',
  8: 'OW',
  9: 'AW',
  10: 'OY',
  11: 'AY',
  12: 'H',
  13: 'R',
  14: 'L',
  15: 'S-Z',
  16: 'SH-CH-JH-ZH',
  17: 'TH-DH',
  18: 'F-V',
  19: 'D-T-N',
  20: 'K-G-NG',
  21: 'P-B-M',
};
