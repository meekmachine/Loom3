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
import { getJawAmountForViseme, getARKitVisemeIndex } from '../lipsync/visemeToARKit';

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

  // Snippet tracking for cleanup
  private lipsyncSnippets: string[] = [];
  private prosodicSnippets: string[] = [];
  private wordIndex: number = 0;

  constructor(config: TTSConfig = {}, callbacks: TTSCallbacks = {}) {
    this.config = {
      engine: config.engine ?? 'webSpeech',
      rate: config.rate ?? 1.0,
      pitch: config.pitch ?? 1.0,
      volume: config.volume ?? 1.0,
      voiceName: config.voiceName ?? '',
      lipSyncService: config.lipSyncService,
      animationManager: config.animationManager,
      prosodicEnabled: config.prosodicEnabled ?? true
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

      // Reset word index and snippet tracking for new speech
      this.wordIndex = 0;
      this.lipsyncSnippets = [];
      this.prosodicSnippets = [];

      // Play animation
      if (this.config.animationManager) {
        this.config.animationManager.play?.();
      }

      this.callbacks.onStart?.();
      this.executeTimeline(timeline);
    };

    this.utterance.onend = () => {
      this.setState({ status: 'idle' });

      // Clean up all snippets
      this.cleanupSnippets();

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

        // Coordinate LipSync and Prosodic agencies
        this.handleWordBoundary(word);

        // Still fire callback for modules that need it
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
   * Clean up all animation snippets
   */
  private cleanupSnippets(): void {
    if (!this.config.animationManager) return;

    // Remove all lip sync snippets
    this.lipsyncSnippets.forEach(snippetName => {
      this.config.animationManager.remove?.(snippetName);
    });
    this.lipsyncSnippets = [];

    // Remove all prosodic snippets
    this.prosodicSnippets.forEach(snippetName => {
      this.config.animationManager.remove?.(snippetName);
    });
    this.prosodicSnippets = [];

    // Schedule neutral return snippet for all visemes
    const neutralSnippet = `neutral_${Date.now()}`;
    const neutralCurves: Record<string, Array<{ time: number; intensity: number }>> = {};

    // All 15 ARKit viseme indices (0-14)
    for (let i = 0; i < 15; i++) {
      neutralCurves[i.toString()] = [
        { time: 0.0, intensity: 0 },
        { time: 0.3, intensity: 0 },
      ];
    }

    // Jaw closure (AU 26)
    neutralCurves['26'] = [
      { time: 0.0, intensity: 0 },
      { time: 0.3, intensity: 0 },
    ];

    this.config.animationManager.schedule?.({
      name: neutralSnippet,
      curves: neutralCurves,
      maxTime: 0.3,
      loop: false,
      snippetCategory: 'combined',
      snippetPriority: 60,
      snippetPlaybackRate: 1.0,
      snippetIntensityScale: 1.0,
    });

    setTimeout(() => {
      this.config.animationManager.remove?.(neutralSnippet);
    }, 350);
  }

  /**
   * Handle word boundary - coordinates LipSync and Prosodic agencies
   */
  private handleWordBoundary(word: string): void {
    if (!this.config.animationManager) {
      return; // No animation manager, skip coordination
    }

    // === LIPSYNC AGENCY ===
    // Extract visemes and create combined viseme + jaw animation
    if (this.config.lipSyncService) {
      const visemeTimeline = this.config.lipSyncService.extractVisemeTimeline(word);
      const combinedCurves: Record<string, Array<{ time: number; intensity: number }>> = {};
      const lipsyncIntensity = 1.0;
      const jawActivation = 1.5;

      visemeTimeline.forEach((visemeEvent: any) => {
        const arkitIndex = getARKitVisemeIndex(visemeEvent.visemeId);
        const visemeId = arkitIndex.toString();
        const timeInSec = visemeEvent.offsetMs / 1000;
        const durationInSec = visemeEvent.durationMs / 1000;

        const anticipation = durationInSec * 0.1;
        const attack = durationInSec * 0.25;
        const sustain = durationInSec * 0.45;

        if (!combinedCurves[visemeId]) {
          combinedCurves[visemeId] = [];
        }

        const lastKeyframe = combinedCurves[visemeId][combinedCurves[visemeId].length - 1];
        const startIntensity = (lastKeyframe && lastKeyframe.time > timeInSec - 0.02)
          ? lastKeyframe.intensity
          : 0;

        combinedCurves[visemeId].push(
          { time: timeInSec, intensity: startIntensity },
          { time: timeInSec + anticipation, intensity: 30 * lipsyncIntensity },
          { time: timeInSec + attack, intensity: 95 * lipsyncIntensity },
          { time: timeInSec + sustain, intensity: 100 * lipsyncIntensity },
          { time: timeInSec + durationInSec, intensity: 0 }
        );

        // Jaw coordination
        const jawAmount = getJawAmountForViseme(visemeEvent.visemeId);
        if (jawAmount > 0.05) {
          if (!combinedCurves['26']) {
            combinedCurves['26'] = [];
          }

          const jawAnticipation = durationInSec * 0.15;
          const jawAttack = durationInSec * 0.3;
          const jawSustain = durationInSec * 0.4;

          const lastJawKeyframe = combinedCurves['26'][combinedCurves['26'].length - 1];
          const startJawIntensity = (lastJawKeyframe && lastJawKeyframe.time > timeInSec - 0.02)
            ? lastJawKeyframe.intensity
            : 0;

          combinedCurves['26'].push(
            { time: timeInSec, intensity: startJawIntensity },
            { time: timeInSec + jawAnticipation, intensity: jawAmount * 20 * jawActivation },
            { time: timeInSec + jawAttack, intensity: jawAmount * 90 * jawActivation },
            { time: timeInSec + jawSustain, intensity: jawAmount * 100 * jawActivation },
            { time: timeInSec + durationInSec, intensity: 0 }
          );
        }
      });

      const lastVisemeEndTime = visemeTimeline.length > 0
        ? Math.max(...visemeTimeline.map((v: any) => (v.offsetMs + v.durationMs) / 1000))
        : 0;
      const maxTime = lastVisemeEndTime + 0.05;

      const snippetName = `lipsync:${word.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

      this.config.animationManager.schedule?.({
        name: snippetName,
        curves: combinedCurves,
        maxTime,
        loop: false,
        snippetCategory: 'combined',
        snippetPriority: 50,
        snippetPlaybackRate: this.config.rate,
        snippetIntensityScale: 1.0,
      });

      this.lipsyncSnippets.push(snippetName);
    }

    // === PROSODIC EXPRESSION AGENCY ===
    // Natural speech gestures (brow raises, head nods, contemplative frowns)
    if (this.config.prosodicEnabled) {
      const wordMod = this.wordIndex % 6;

      // Pattern 1: Brow raise emphasis (every 6 words)
      if (wordMod === 0) {
        const gestureTime = Date.now();
        const gestureName = `prosodic:emphasis_${gestureTime}`;
        this.config.animationManager.schedule?.({
          name: gestureName,
          curves: {
            '1': [
              { time: 0.0, intensity: 0 },
              { time: 0.15, intensity: 35 },
              { time: 0.45, intensity: 45 },
              { time: 0.75, intensity: 0 },
            ],
            '2': [
              { time: 0.0, intensity: 0 },
              { time: 0.15, intensity: 25 },
              { time: 0.45, intensity: 35 },
              { time: 0.75, intensity: 0 },
            ],
          },
          maxTime: 0.75,
          loop: false,
          snippetCategory: 'prosodic',
          snippetPriority: 30,
          snippetPlaybackRate: 1.0,
          snippetIntensityScale: 0.8,
        });
        this.prosodicSnippets.push(gestureName);
      }

      // Pattern 2: Head nod (every 6 words - word 3)
      else if (wordMod === 3) {
        const gestureTime = Date.now();
        const gestureName = `prosodic:nod_${gestureTime}`;
        this.config.animationManager.schedule?.({
          name: gestureName,
          curves: {
            '33': [
              { time: 0.0, intensity: 0 },
              { time: 0.15, intensity: 40 },
              { time: 0.4, intensity: 50 },
              { time: 0.75, intensity: 0 },
            ],
          },
          maxTime: 0.75,
          loop: false,
          snippetCategory: 'prosodic',
          snippetPriority: 30,
          snippetPlaybackRate: 1.0,
          snippetIntensityScale: 0.9,
        });
        this.prosodicSnippets.push(gestureName);
      }

      // Pattern 3: Contemplative frown (every 6 words - word 5)
      else if (wordMod === 5) {
        const gestureTime = Date.now();
        const gestureName = `prosodic:contemplate_${gestureTime}`;
        this.config.animationManager.schedule?.({
          name: gestureName,
          curves: {
            '4': [
              { time: 0.0, intensity: 0 },
              { time: 0.2, intensity: 20 },
              { time: 0.6, intensity: 25 },
              { time: 0.9, intensity: 0 },
            ],
          },
          maxTime: 0.9,
          loop: false,
          snippetCategory: 'prosodic',
          snippetPriority: 30,
          snippetPlaybackRate: 1.0,
          snippetIntensityScale: 0.7,
        });
        this.prosodicSnippets.push(gestureName);
      }
    }

    this.wordIndex++;
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
