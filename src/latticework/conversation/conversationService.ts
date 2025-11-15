/**
 * Conversation Service
 * Coordinates TTS (mouth) and Transcription (ear) for turn-taking dialogue
 *
 * Flow:
 * 1. Generator yields agent text
 * 2. TTS speaks the text (agentSpeaking state)
 * 3. When TTS ends, auto-start listening (userSpeaking state)
 * 4. User speaks, transcription captures it
 * 5. On final transcript, send to generator
 * 6. Generator yields next response, repeat
 */

import type {
  ConversationConfig,
  ConversationCallbacks,
  ConversationContext,
  ConversationFlow,
  ConversationServiceAPI,
} from './types';
import { DEFAULT_CONVERSATION_CONFIG } from './types';
import type { TTSService } from '../tts/ttsService';
import type { TranscriptionService } from '../transcription/transcriptionService';

export class ConversationService implements ConversationServiceAPI {
  private config: Required<Omit<ConversationConfig, 'eyeHeadTracking'>> & { eyeHeadTracking?: any };
  private callbacks: ConversationCallbacks;
  private context: ConversationContext;

  private tts: TTSService;
  private transcription: TranscriptionService;
  private eyeHeadTracking: any; // EyeHeadTrackingService | undefined
  private flowGenerator: ConversationFlow | null = null;

  private isRunning = false;
  private gazeScheduleTimer: number | null = null;

  constructor(
    tts: TTSService,
    transcription: TranscriptionService,
    config: ConversationConfig = {},
    callbacks: ConversationCallbacks = {}
  ) {
    this.config = { ...DEFAULT_CONVERSATION_CONFIG, ...config };
    this.callbacks = callbacks;
    this.tts = tts;
    this.transcription = transcription;
    this.eyeHeadTracking = config.eyeHeadTracking;

    this.context = {
      state: 'idle',
    };
  }

  /**
   * Start conversation with a generator flow
   */
  public start(flowGenerator: () => ConversationFlow): void {
    if (this.isRunning) {
      console.warn('[ConversationService] Already running');
      return;
    }

    this.isRunning = true;
    this.flowGenerator = flowGenerator();

    console.log('[ConversationService] Starting conversation');
    this.setState('idle');

    // Start with greeting (first yield with empty input)
    this.processFlow('');
  }

  /**
   * Stop conversation
   */
  public stop(): void {
    if (!this.isRunning) return;

    console.log('[ConversationService] Stopping conversation');
    this.isRunning = false;

    this.tts.stop();
    this.transcription.stopListening();

    if (this.gazeScheduleTimer) {
      clearTimeout(this.gazeScheduleTimer);
      this.gazeScheduleTimer = null;
    }

    this.setState('idle');
    this.flowGenerator = null;
  }

  /**
   * Get current context
   */
  public getState(): ConversationContext {
    return { ...this.context };
  }

  /**
   * Submit user input programmatically
   */
  public submitUserInput(text: string): void {
    console.log('[ConversationService] Manual user input:', text);
    this.handleFinalUserSpeech(text, false);
  }

  /**
   * Process the generator flow
   */
  private async processFlow(userInput: string): Promise<void> {
    if (!this.flowGenerator) return;

    try {
      const { value, done } = this.flowGenerator.next(userInput);

      if (done) {
        console.log('[ConversationService] Flow complete');
        this.stop();
        return;
      }

      // Resolve the value (could be string or Promise<string>)
      const agentText = await Promise.resolve(value);

      if (typeof agentText !== 'string') {
        console.warn('[ConversationService] Generator yielded non-string:', agentText);
        return;
      }

      // Agent speaks
      await this.speakAgent(agentText);

    } catch (error) {
      console.error('[ConversationService] Flow error:', error);
      this.callbacks.onError?.(error as Error);
      this.stop();
    }
  }

  /**
   * Make agent speak
   */
  private async speakAgent(text: string): Promise<void> {
    console.log('[ConversationService] Agent speaking:', text);

    this.setState('agentSpeaking');
    this.context.lastAgentSpeech = text;
    this.context.speakStartTime = Date.now();
    this.context.isInterrupted = false;

    this.callbacks.onAgentUtterance?.(text);

    // Notify eye/head tracking that agent is speaking
    if (this.eyeHeadTracking) {
      this.eyeHeadTracking.setSpeaking(true);
      this.eyeHeadTracking.setListening(false);
      // Look at user while speaking
      this.eyeHeadTracking.setGazeTarget({ x: 0, y: 0, z: 0 });
      // Schedule natural gaze variations during speech
      this.scheduleNaturalGazeDuringSpeech(text);
    }

    // Notify transcription service to filter this text (prevent echo)
    if (this.transcription.notifyAgentSpeech) {
      this.transcription.notifyAgentSpeech(text);
    }

    // Speak using TTS
    await this.tts.speak(text);

    // Notify transcription that agent finished speaking
    if (this.transcription.notifyAgentSpeechEnd) {
      this.transcription.notifyAgentSpeechEnd();
    }

    // Notify eye/head tracking that speaking ended
    if (this.eyeHeadTracking) {
      this.eyeHeadTracking.setSpeaking(false);
      if (this.gazeScheduleTimer) {
        clearTimeout(this.gazeScheduleTimer);
        this.gazeScheduleTimer = null;
      }
    }

    // After speaking, start listening for user
    if (this.config.autoListen && this.isRunning) {
      this.startListening();
    } else {
      this.setState('idle');
    }
  }

  /**
   * Start listening for user speech
   */
  private startListening(): void {
    console.log('[ConversationService] Starting to listen');
    this.setState('userSpeaking');

    // Notify eye/head tracking that we're listening
    if (this.eyeHeadTracking) {
      this.eyeHeadTracking.setSpeaking(false);
      this.eyeHeadTracking.setListening(true);
      // Attentive gaze - look at speaker (slightly up)
      this.eyeHeadTracking.setGazeTarget({ x: 0, y: 0.1, z: 0 });
    }

    this.transcription.startListening();
  }

  /**
   * Handle user speech (partial or final)
   */
  private handleUserSpeech(transcript: string, isFinal: boolean): void {
    const isInterruption = this.detectInterruption();

    console.log(
      `[ConversationService] User speech: "${transcript}" (final: ${isFinal}, interruption: ${isInterruption})`
    );

    this.callbacks.onUserSpeech?.(transcript, isFinal, isInterruption);

    if (isFinal) {
      this.handleFinalUserSpeech(transcript, isInterruption);
    }
  }

  /**
   * Handle final user speech
   */
  private handleFinalUserSpeech(transcript: string, isInterruption: boolean): void {
    this.context.lastUserSpeech = transcript;
    this.context.isInterrupted = isInterruption;

    // Stop listening
    this.transcription.stopListening();

    // Notify eye/head tracking we're processing (thinking pose)
    if (this.eyeHeadTracking) {
      this.eyeHeadTracking.setListening(false);
      // Thinking gaze - down and to the side
      this.eyeHeadTracking.setGazeTarget({ x: -0.2, y: -0.15, z: 0 });
      // Schedule a thoughtful blink
      setTimeout(() => {
        if (this.eyeHeadTracking && this.context.state === 'processing') {
          this.eyeHeadTracking.blink();
        }
      }, 300);
    }

    // Process user input through generator
    this.setState('processing');
    this.processFlow(transcript);
  }

  /**
   * Detect if user is interrupting agent
   */
  private detectInterruption(): boolean {
    if (!this.config.detectInterruptions) return false;
    if (this.context.state !== 'agentSpeaking') return false;

    const speakDuration = Date.now() - (this.context.speakStartTime || 0);
    return speakDuration >= this.config.minSpeakTime;
  }

  /**
   * Schedule natural gaze shifts during agent speech
   * Creates subtle, natural eye movements while talking
   */
  private scheduleNaturalGazeDuringSpeech(text: string): void {
    if (!this.eyeHeadTracking) return;

    // Estimate speech duration (rough approximation: 150 words per minute)
    const wordCount = text.split(/\s+/).length;
    const estimatedDuration = (wordCount / 150) * 60 * 1000; // ms

    // Schedule gaze shifts at natural intervals
    const gazeShiftInterval = 2000; // Shift gaze every 2 seconds
    const numShifts = Math.floor(estimatedDuration / gazeShiftInterval);

    // Predefined natural gaze targets (subtle movements)
    const gazeTargets = [
      { x: 0, y: 0, z: 0 },        // Center (looking at user)
      { x: -0.15, y: 0.05, z: 0 }, // Slight left-up
      { x: 0.15, y: -0.05, z: 0 }, // Slight right-down
      { x: 0, y: 0.1, z: 0 },      // Slight up
      { x: -0.1, y: -0.05, z: 0 }, // Slight left-down
    ];

    let currentShift = 0;

    const scheduleNext = () => {
      if (currentShift >= numShifts || this.context.state !== 'agentSpeaking') {
        return;
      }

      this.gazeScheduleTimer = window.setTimeout(() => {
        if (this.eyeHeadTracking && this.context.state === 'agentSpeaking') {
          const targetIndex = currentShift % gazeTargets.length;
          this.eyeHeadTracking.setGazeTarget(gazeTargets[targetIndex]);

          // Occasional blinks during speech (every ~4 seconds)
          if (currentShift % 2 === 0) {
            setTimeout(() => {
              if (this.eyeHeadTracking && this.context.state === 'agentSpeaking') {
                this.eyeHeadTracking.blink();
              }
            }, 800);
          }
        }

        currentShift++;
        scheduleNext();
      }, gazeShiftInterval);
    };

    // Start scheduling
    scheduleNext();
  }

  /**
   * Set state and notify
   */
  private setState(state: ConversationContext['state']): void {
    this.context.state = state;
    console.log('[ConversationService] State:', state);
    this.callbacks.onStateChange?.(state);
  }
}

/**
 * Factory function to create conversation service
 */
export function createConversationService(
  tts: TTSService,
  transcription: TranscriptionService,
  config?: ConversationConfig,
  callbacks?: ConversationCallbacks
): ConversationService {
  // Wire up transcription callbacks
  const transcriptionCallbacks = transcription['callbacks'] || {};
  const originalOnTranscript = transcriptionCallbacks.onTranscript;

  const service = new ConversationService(tts, transcription, config, callbacks);

  // Intercept transcription events
  transcription['callbacks'] = {
    ...transcriptionCallbacks,
    onTranscript: (text: string, isFinal: boolean) => {
      // Call original callback
      originalOnTranscript?.(text, isFinal);
      // Handle in conversation service
      (service as any).handleUserSpeech(text, isFinal);
    },
  };

  return service;
}
