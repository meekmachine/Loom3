/**
 * TTS Agency Types
 * Type definitions for Text-to-Speech functionality
 */

export type TTSEngine = 'webSpeech' | 'sapi';

export type VisemeID = number; // 0-20 for ARKit/FACS visemes

export interface TTSConfig {
  engine?: TTSEngine;
  rate?: number; // 0.1 - 10.0
  pitch?: number; // 0.0 - 2.0
  volume?: number; // 0.0 - 1.0
  voiceName?: string;
}

export interface TTSVoice {
  name: string;
  lang: string;
  localService?: boolean;
  default?: boolean;
}

export interface TimelineItem {
  type: 'WORD' | 'VISEME' | 'EMOJI' | 'PHONEME';
  offsetMs: number;
  durMs?: number;
  data?: any;
}

export interface WordTimelineItem extends TimelineItem {
  type: 'WORD';
  word: string;
  index: number;
}

export interface VisemeTimelineItem extends TimelineItem {
  type: 'VISEME';
  visemeId: VisemeID;
  durMs: number;
}

export interface EmojiTimelineItem extends TimelineItem {
  type: 'EMOJI';
  emoji: string;
}

export interface PhonemeTimelineItem extends TimelineItem {
  type: 'PHONEME';
  phoneme: string;
  durMs: number;
}

export type TimelineEvent =
  | WordTimelineItem
  | VisemeTimelineItem
  | EmojiTimelineItem
  | PhonemeTimelineItem;

export interface SAPIResponse {
  audio: string; // base64 encoded WAV
  visemes: Array<{ id: VisemeID; duration: number }>;
  duration: number;
}

export interface TTSState {
  status: 'idle' | 'loading' | 'speaking' | 'paused' | 'stopped' | 'error';
  currentText?: string;
  currentTimeline?: TimelineEvent[];
  currentVoice?: TTSVoice;
  error?: string;
}

export interface TTSCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onBoundary?: (event: { word: string; charIndex: number }) => void;
  onViseme?: (visemeId: VisemeID, durationMs: number) => void;
  onError?: (error: Error) => void;
  onPause?: () => void;
  onResume?: () => void;
}

export interface ParsedTokens {
  text: string;
  emojis: Array<{ emoji: string; index: number }>;
}
