/**
 * TTS Service
 * Main Text-to-Speech service facade
 */

import type {
  TTSConfig,
  TTSVoice,
  TTSCallbacks,
  TTSState,
  TimelineEvent,
  SAPIResponse,
  VisemeID
} from './types';
import {
  parseTokens,
  buildLocalTimeline,
  buildSAPITimeline,
  decodeBase64Audio,
  getTimelineDuration
} from './utils';

export class TTSService {
  private config: Required<TTSConfig>;
  private state: TTSState;
  private callbacks: TTSCallbacks;

  // Web Speech API
  private synthesis: SpeechSynthesis | null = null;
  private utterance: SpeechSynthesisUtterance | null = null;
  private voices: SpeechSynthesisVoice[] = [];

  // Audio playback
  private audioContext: AudioContext | null = null;
  private audioSource: AudioBufferSourceNode | null = null;

  // Timeline execution
  private timelineTimeouts: number[] = [];
  private timelineStartTime: number = 0;

  // SAPI endpoint
  private sapiEndpoint = 'https://new-emotion.cis.fiu.edu/HapGL/HapGLService.svc';

  constructor(config: TTSConfig = {}, callbacks: TTSCallbacks = {}) {
    this.config = {
      engine: config.engine ?? 'webSpeech',
      rate: config.rate ?? 1.0,
      pitch: config.pitch ?? 1.0,
      volume: config.volume ?? 1.0,
      voiceName: config.voiceName ?? '',
    };

    this.callbacks = callbacks;

    this.state = {
      status: 'idle'
    };

    this.initialize();
  }

  /**
   * Initialize TTS service
   */
  private async initialize(): Promise<void> {
    if (typeof window === 'undefined') return;

    if (this.config.engine === 'webSpeech') {
      await this.initWebSpeech();
    } else {
      await this.initSAPI();
    }
  }

  /**
   * Initialize Web Speech API
   */
  private async initWebSpeech(): Promise<void> {
    if (!window.speechSynthesis) {
      console.error('Web Speech API not supported');
      return;
    }

    this.synthesis = window.speechSynthesis;

    // Load voices
    await this.loadVoices();

    // Set default voice
    if (this.config.voiceName) {
      this.setVoice(this.config.voiceName);
    }
  }

  /**
   * Initialize SAPI
   */
  private async initSAPI(): Promise<void> {
    // Create audio context for playback
    this.audioContext = new AudioContext();
  }

  /**
   * Load available voices
   */
  private async loadVoices(): Promise<void> {
    if (!this.synthesis) return;

    return new Promise((resolve) => {
      const loadVoicesImpl = () => {
        this.voices = this.synthesis!.getVoices();
        resolve();
      };

      // Voices might load async
      if (this.synthesis.getVoices().length > 0) {
        loadVoicesImpl();
      } else {
        this.synthesis.addEventListener('voiceschanged', loadVoicesImpl, { once: true });
      }
    });
  }

  /**
   * Get available voices
   */
  public getVoices(): TTSVoice[] {
    if (this.config.engine === 'webSpeech') {
      return this.voices.map(v => ({
        name: v.name,
        lang: v.lang,
        localService: v.localService,
        default: v.default
      }));
    }

    return [];
  }

  /**
   * Set voice by name
   */
  public setVoice(voiceName: string): boolean {
    if (this.config.engine === 'webSpeech') {
      const voice = this.voices.find(v => v.name === voiceName);
      if (voice) {
        this.config.voiceName = voiceName;
        return true;
      }
    } else if (this.config.engine === 'sapi') {
      this.config.voiceName = voiceName;
      return true;
    }

    return false;
  }

  /**
   * Speak text
   */
  public async speak(text: string): Promise<void> {
    // Stop current speech
    this.stop();

    // Update state
    this.setState({ status: 'loading', currentText: text });

    // Parse tokens
    const { text: sanitizedText, emojis } = parseTokens(text);

    if (!sanitizedText) {
      console.warn('No text to speak after parsing');
      this.setState({ status: 'idle' });
      return;
    }

    try {
      if (this.config.engine === 'webSpeech') {
        await this.speakWebSpeech(sanitizedText, emojis);
      } else {
        await this.speakSAPI(sanitizedText, emojis);
      }
    } catch (error) {
      console.error('TTS error:', error);
      this.setState({ status: 'error', error: (error as Error).message });
      this.callbacks.onError?.(error as Error);
    }
  }

  /**
   * Speak using Web Speech API
   */
  private async speakWebSpeech(
    text: string,
    emojis: Array<{ emoji: string; index: number }>
  ): Promise<void> {
    if (!this.synthesis) {
      throw new Error('Web Speech API not initialized');
    }

    // Build timeline
    const timeline = buildLocalTimeline(text, emojis, this.config.rate);
    this.setState({ currentTimeline: timeline });

    // Create utterance
    this.utterance = new SpeechSynthesisUtterance(text);
    this.utterance.rate = this.config.rate;
    this.utterance.pitch = this.config.pitch;
    this.utterance.volume = this.config.volume;

    // Set voice
    if (this.config.voiceName) {
      const voice = this.voices.find(v => v.name === this.config.voiceName);
      if (voice) {
        this.utterance.voice = voice;
      }
    }

    // Set up event handlers
    this.utterance.onstart = () => {
      this.setState({ status: 'speaking' });
      this.callbacks.onStart?.();
      this.executeTimeline(timeline);
    };

    this.utterance.onend = () => {
      this.setState({ status: 'idle' });
      this.callbacks.onEnd?.();
      this.clearTimelineTimeouts();
    };

    this.utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      this.setState({ status: 'error', error: event.error });
      this.callbacks.onError?.(new Error(event.error));
      this.clearTimelineTimeouts();
    };

    this.utterance.onboundary = (event) => {
      if (event.name === 'word') {
        const word = text.substring(event.charIndex, event.charIndex + event.charLength);
        // Fire callback - caller is responsible for coordinating lip sync, prosodic, etc.
        this.callbacks.onBoundary?.({ word, charIndex: event.charIndex });
      }
    };

    // Speak
    this.synthesis.speak(this.utterance);
  }

  /**
   * Speak using SAPI
   */
  private async speakSAPI(
    text: string,
    emojis: Array<{ emoji: string; index: number }>
  ): Promise<void> {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }

    // Request audio from SAPI
    const response = await this.fetchSAPIAudio(text);

    // Build timeline
    const timeline = buildSAPITimeline(text, emojis, response.visemes, response.duration);
    this.setState({ currentTimeline: timeline });

    // Decode audio
    const audioBuffer = await decodeBase64Audio(response.audio, this.audioContext);

    // Create audio source
    this.audioSource = this.audioContext.createBufferSource();
    this.audioSource.buffer = audioBuffer;
    this.audioSource.connect(this.audioContext.destination);

    // Set up event handlers
    this.audioSource.onended = () => {
      this.setState({ status: 'idle' });
      this.callbacks.onEnd?.();
      this.clearTimelineTimeouts();
    };

    // Start playback
    this.setState({ status: 'speaking' });
    this.callbacks.onStart?.();
    this.executeTimeline(timeline);
    this.audioSource.start();
  }

  /**
   * Fetch audio from SAPI endpoint
   */
  private async fetchSAPIAudio(text: string): Promise<SAPIResponse> {
    const response = await fetch(this.sapiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        voice: this.config.voiceName || 'default',
        rate: this.config.rate
      })
    });

    if (!response.ok) {
      throw new Error(`SAPI request failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Execute timeline events
   */
  private executeTimeline(timeline: TimelineEvent[]): void {
    this.clearTimelineTimeouts();
    this.timelineStartTime = Date.now();

    for (const event of timeline) {
      const timeout = window.setTimeout(() => {
        this.handleTimelineEvent(event);
      }, event.offsetMs);

      this.timelineTimeouts.push(timeout);
    }
  }

  /**
   * Handle timeline event
   */
  private handleTimelineEvent(event: TimelineEvent): void {
    switch (event.type) {
      case 'WORD':
        this.callbacks.onBoundary?.({
          word: event.word,
          charIndex: event.index
        });
        break;

      case 'VISEME':
        this.callbacks.onViseme?.(event.visemeId, event.durMs);
        break;

      case 'EMOJI':
        // Emoji events can be used for emotive expressions
        // This could trigger facial expressions or other animations
        console.log('Emoji event:', event.emoji);
        break;

      case 'PHONEME':
        // Phoneme events for advanced lip-sync
        break;
    }
  }

  /**
   * Clear timeline timeouts
   */
  private clearTimelineTimeouts(): void {
    for (const timeout of this.timelineTimeouts) {
      clearTimeout(timeout);
    }
    this.timelineTimeouts = [];
  }

  /**
   * Stop current speech
   */
  public stop(): void {
    if (this.config.engine === 'webSpeech' && this.synthesis) {
      this.synthesis.cancel();
    }

    if (this.audioSource) {
      try {
        this.audioSource.stop();
      } catch (e) {
        // Ignore if already stopped
      }
      this.audioSource = null;
    }

    this.clearTimelineTimeouts();
    this.setState({ status: 'idle' });
  }

  /**
   * Pause speech
   */
  public pause(): void {
    if (this.config.engine === 'webSpeech' && this.synthesis) {
      this.synthesis.pause();
      this.setState({ status: 'paused' });
      this.callbacks.onPause?.();
    }

    if (this.audioContext && this.audioContext.state === 'running') {
      this.audioContext.suspend();
      this.setState({ status: 'paused' });
      this.callbacks.onPause?.();
    }
  }

  /**
   * Resume speech
   */
  public resume(): void {
    if (this.config.engine === 'webSpeech' && this.synthesis) {
      this.synthesis.resume();
      this.setState({ status: 'speaking' });
      this.callbacks.onResume?.();
    }

    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
      this.setState({ status: 'speaking' });
      this.callbacks.onResume?.();
    }
  }

  /**
   * Get current state
   */
  public getState(): TTSState {
    return { ...this.state };
  }

  /**
   * Update state
   */
  private setState(update: Partial<TTSState>): void {
    this.state = { ...this.state, ...update };
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<TTSConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Cleanup
   */
  public dispose(): void {
    this.stop();

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

/**
 * Create TTS service instance
 */
export function createTTSService(
  config?: TTSConfig,
  callbacks?: TTSCallbacks
): TTSService {
  return new TTSService(config, callbacks);
}
