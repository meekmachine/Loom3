/**
 * Conversation Service Types
 * Coordinates TTS (mouth) and Transcription (ear) for turn-taking dialogue
 */

import type { TTSService } from '../tts/ttsService';
import type { TranscriptionService } from '../transcription/transcriptionService';
import type { EyeHeadTrackingService } from '../eyeHeadTracking/eyeHeadTrackingService';

export interface ConversationConfig {
  /** Enable automatic listening after agent finishes speaking */
  autoListen?: boolean;
  /** Enable interruption detection */
  detectInterruptions?: boolean;
  /** Minimum time (ms) agent must speak before interruption is allowed */
  minSpeakTime?: number;
  /** Optional eye/head tracking service for natural gaze coordination */
  eyeHeadTracking?: EyeHeadTrackingService;
}

export interface ConversationCallbacks {
  /** Called when user speaks (partial or final) */
  onUserSpeech?: (transcript: string, isFinal: boolean, isInterruption: boolean) => void;
  /** Called when agent speaks */
  onAgentUtterance?: (text: string) => void;
  /** Called on state transitions */
  onStateChange?: (state: ConversationState) => void;
  /** Called on errors */
  onError?: (error: Error) => void;
}

export type ConversationState = 'idle' | 'agentSpeaking' | 'userSpeaking' | 'processing';

export interface ConversationContext {
  state: ConversationState;
  lastUserSpeech?: string;
  lastAgentSpeech?: string;
  isInterrupted?: boolean;
  speakStartTime?: number;
}

/**
 * Generator function that yields agent responses
 * Takes user input, returns agent response
 */
export type ConversationFlow = Generator<string | Promise<string>, string | void, string>;

export interface ConversationServiceAPI {
  /** Start the conversation */
  start: (flowGenerator: () => ConversationFlow) => void;
  /** Stop the conversation */
  stop: () => void;
  /** Get current state */
  getState: () => ConversationContext;
  /** Send user input programmatically (for testing/debugging) */
  submitUserInput: (text: string) => void;
}

export const DEFAULT_CONVERSATION_CONFIG = {
  autoListen: true,
  detectInterruptions: true,
  minSpeakTime: 500, // 500ms
  eyeHeadTracking: undefined,
};
