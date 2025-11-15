/**
 * Transcription Service
 * Main Speech-to-Text service using Web Speech API
 * Modernized TypeScript version of the old transcriptionService.js
 */

import type {
  TranscriptionConfig,
  TranscriptionState,
  TranscriptionCallbacks,
  RecognitionResult,
  AgentSpeechEvent,
  BoundaryEvent,
} from './types';
import { DEFAULT_TRANSCRIPTION_CONFIG } from './types';

export class TranscriptionService {
  private config: Required<TranscriptionConfig>;
  private state: TranscriptionState;
  private callbacks: TranscriptionCallbacks;

  // Web Speech API
  private recognition: SpeechRecognition | null = null;
  private isManualStop = false;

  // Agent speech filtering
  private agentWordSet = new Set<string>();
  private agentScriptStr = '';
  private agentSpeakingActive = false;
  private currentAgentWord = '';

  // Boundary stream
  private boundaryListeners: Array<(event: BoundaryEvent) => void> = [];

  // Tokenizer (simple whitespace tokenizer - can be upgraded to Natural if needed)
  private tokenizer = (text: string): string[] => {
    return text
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token.length > 0);
  };

  constructor(config: TranscriptionConfig = {}, callbacks: TranscriptionCallbacks = {}) {
    this.config = {
      ...DEFAULT_TRANSCRIPTION_CONFIG,
      ...config,
    };

    this.callbacks = callbacks;

    this.state = {
      status: 'idle',
    };

    this.initialize();
  }

  /**
   * Initialize Web Speech API
   */
  private initialize(): void {
    if (typeof window === 'undefined') {
      console.warn('TranscriptionService: window not available (SSR context)');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.error('TranscriptionService: Web Speech API not supported');
      this.setState({ status: 'error', error: 'Web Speech API not supported' });
      return;
    }

    this.recognition = new SpeechRecognition();
    this.setupRecognition();
  }

  /**
   * Setup recognition handlers
   */
  private setupRecognition(): void {
    if (!this.recognition) return;

    this.recognition.lang = this.config.lang;
    this.recognition.continuous = this.config.continuous;
    this.recognition.interimResults = this.config.interimResults;
    this.recognition.maxAlternatives = this.config.maxAlternatives;

    // Handle results
    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript.trim();

        if (!transcript) continue;

        const isFinal = result.isFinal;

        // Apply agent speech filtering if enabled
        if (this.config.agentFilteringEnabled && this.shouldFilterTranscript(transcript)) {
          console.log('[TranscriptionService] Filtered agent echo:', transcript);
          continue;
        }

        // Emit word boundary events
        this.emitWordBoundaries(transcript, 'user');

        // Update state and notify
        this.setState({
          status: 'listening',
          currentTranscript: transcript,
          isFinal,
        });

        this.callbacks.onTranscript?.(transcript, isFinal);
      }
    };

    // Handle errors
    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.warn('[TranscriptionService] Recognition error:', event.error);

      this.setState({
        status: 'error',
        error: event.error,
      });

      this.callbacks.onError?.(new Error(event.error));

      // Auto-restart on certain errors if continuous
      if (this.config.continuous && !this.isManualStop) {
        this.restartRecognition();
      }
    };

    // Handle end
    this.recognition.onend = () => {
      console.log('[TranscriptionService] Recognition ended, manualStop:', this.isManualStop);

      if (!this.isManualStop && this.config.continuous) {
        // Auto-restart if continuous and not manually stopped
        this.restartRecognition();
      } else {
        this.setState({ status: 'idle' });
        this.callbacks.onEnd?.();
      }
    };

    // Handle start
    this.recognition.onstart = () => {
      console.log('[TranscriptionService] Recognition started');
      this.setState({ status: 'listening' });
      this.callbacks.onStart?.();
    };
  }

  /**
   * Restart recognition after error or unexpected end
   */
  private restartRecognition(): void {
    if (!this.recognition || this.isManualStop) return;

    console.log('[TranscriptionService] Auto-restarting recognition...');

    setTimeout(() => {
      try {
        this.recognition?.start();
      } catch (err) {
        console.warn('[TranscriptionService] Restart failed:', err);
      }
    }, 100);
  }

  /**
   * Check if transcript should be filtered (agent echo detection)
   */
  private shouldFilterTranscript(transcript: string): boolean {
    if (!this.agentSpeakingActive) return false;

    const transcriptLower = transcript.toLowerCase();
    const tokens = this.tokenizer(transcriptLower);

    // Check if all tokens match agent script
    const allMatchScript = tokens.every((token) => this.agentWordSet.has(token));

    // Check if transcript is a prefix of agent script
    const prefixMatch = this.agentScriptStr.startsWith(transcriptLower);

    return allMatchScript || prefixMatch;
  }

  /**
   * Emit word boundary events for transcript
   */
  private emitWordBoundaries(transcript: string, speaker: 'user' | 'agent'): void {
    const tokens = this.tokenizer(transcript);

    tokens.forEach((word, index) => {
      const event: BoundaryEvent = {
        word,
        index,
        timestamp: Date.now(),
        speaker,
      };

      this.boundaryListeners.forEach((listener) => listener(event));
      this.callbacks.onBoundary?.(event);
    });
  }

  /**
   * Start listening
   */
  public async startListening(): Promise<void> {
    if (!this.recognition) {
      console.error('[TranscriptionService] Recognition not initialized');
      this.callbacks.onError?.(new Error('Recognition not initialized'));
      return;
    }

    if (this.state.status === 'listening') {
      console.warn('[TranscriptionService] Already listening');
      return;
    }

    // Request microphone permission first
    try {
      console.log('[TranscriptionService] Requesting microphone permission...');
      await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('[TranscriptionService] Microphone permission granted');
    } catch (err) {
      console.error('[TranscriptionService] Microphone permission denied:', err);
      this.setState({ status: 'error', error: 'Microphone permission denied' });
      this.callbacks.onError?.(new Error('Microphone permission denied'));
      return;
    }

    this.isManualStop = false;

    try {
      console.log('[TranscriptionService] Starting speech recognition...');
      this.recognition.start();
    } catch (err) {
      console.error('[TranscriptionService] Failed to start:', err);
      this.setState({ status: 'error', error: 'Failed to start recognition' });
      this.callbacks.onError?.(err as Error);
    }
  }

  /**
   * Stop listening
   */
  public stopListening(): void {
    if (!this.recognition) return;

    this.isManualStop = true;

    try {
      this.recognition.stop();
    } catch (err) {
      console.warn('[TranscriptionService] Failed to stop:', err);
    }

    this.setState({ status: 'idle' });
  }

  /**
   * Handle agent speech event (for echo filtering)
   */
  public handleAgentSpeech(event: AgentSpeechEvent): void {
    switch (event.type) {
      case 'AGENT_SCRIPT':
        // Store full agent script for filtering
        this.agentWordSet.clear();
        (event.words || []).forEach((word) => this.agentWordSet.add(word.toLowerCase()));
        this.agentScriptStr = (event.words || []).join(' ').toLowerCase();
        break;

      case 'AGENT_START':
        // Agent starts speaking
        this.agentSpeakingActive = true;
        break;

      case 'WORD':
        // Current agent word
        this.currentAgentWord = event.word?.toLowerCase() || '';

        if (event.word) {
          const boundaryEvent: BoundaryEvent = {
            word: event.word.toLowerCase(),
            index: event.index ?? -1,
            timestamp: Date.now(),
            speaker: 'agent',
          };

          this.boundaryListeners.forEach((listener) => listener(boundaryEvent));
        }
        break;

      case 'END':
        // Agent finished phrase
        this.currentAgentWord = '';
        break;

      case 'AGENT_DONE':
      case 'PLAYBACK_ENDED':
        // Agent completely done speaking
        this.agentSpeakingActive = false;
        this.agentWordSet.clear();
        this.agentScriptStr = '';
        this.currentAgentWord = '';
        break;
    }
  }

  /**
   * Notify that agent is speaking (for echo filtering)
   */
  public notifyAgentSpeech(text: string): void {
    // Store agent script for filtering
    this.agentWordSet.clear();
    const words = this.tokenizer(text);
    words.forEach((word) => this.agentWordSet.add(word));
    this.agentScriptStr = text.toLowerCase();
    this.agentSpeakingActive = true;
  }

  /**
   * Notify that agent has finished speaking
   */
  public notifyAgentSpeechEnd(): void {
    // Clear agent speech filtering
    this.agentSpeakingActive = false;
    this.agentWordSet.clear();
    this.agentScriptStr = '';
    this.currentAgentWord = '';
  }

  /**
   * Subscribe to boundary events
   */
  public onBoundary(listener: (event: BoundaryEvent) => void): () => void {
    this.boundaryListeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.boundaryListeners.indexOf(listener);
      if (index > -1) {
        this.boundaryListeners.splice(index, 1);
      }
    };
  }

  /**
   * Get current state
   */
  public getState(): TranscriptionState {
    return { ...this.state };
  }

  /**
   * Update state
   */
  private setState(update: Partial<TranscriptionState>): void {
    this.state = { ...this.state, ...update };
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<TranscriptionConfig>): void {
    this.config = { ...this.config, ...config };

    // Reapply config to recognition
    if (this.recognition) {
      this.recognition.lang = this.config.lang;
      this.recognition.continuous = this.config.continuous;
      this.recognition.interimResults = this.config.interimResults;
      this.recognition.maxAlternatives = this.config.maxAlternatives;
    }
  }

  /**
   * Cleanup and dispose
   */
  public dispose(): void {
    this.stopListening();
    this.boundaryListeners = [];
    this.recognition = null;
  }
}

/**
 * Create transcription service instance
 */
export function createTranscriptionService(
  config?: TranscriptionConfig,
  callbacks?: TranscriptionCallbacks
): TranscriptionService {
  return new TranscriptionService(config, callbacks);
}
