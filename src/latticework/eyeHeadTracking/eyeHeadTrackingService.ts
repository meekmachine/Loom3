/**
 * Eye and Head Tracking Service
 * Coordinates eye and head movements that follow mouth animations
 * Integrates two submachines (eye and head) with the animation scheduler
 */

import { createActor } from 'xstate';
import { eyeTrackingMachine } from './eyeTrackingMachine';
import { headTrackingMachine } from './headTrackingMachine';
import type {
  EyeHeadTrackingConfig,
  EyeHeadTrackingState,
  EyeHeadTrackingCallbacks,
  GazeTarget,
  AnimationSnippet,
} from './types';
import { DEFAULT_EYE_HEAD_CONFIG, EYE_AUS, HEAD_AUS } from './types';

export class EyeHeadTrackingService {
  private config: Required<EyeHeadTrackingConfig>;
  private state: EyeHeadTrackingState;
  private callbacks: EyeHeadTrackingCallbacks;

  // Submachine actors
  private eyeMachine: any;
  private headMachine: any;

  // Animation snippets
  private eyeSnippets: Map<string, AnimationSnippet> = new Map();
  private headSnippets: Map<string, AnimationSnippet> = new Map();

  // Timers
  private idleVariationTimer: number | null = null;
  private blinkTimer: number | null = null;

  // Tracking mode
  private trackingMode: 'manual' | 'mouse' | 'webcam' = 'manual';
  private mouseListener: ((e: MouseEvent) => void) | null = null;
  private webcamTracking: any = null; // Webcam tracking instance

  constructor(
    config: EyeHeadTrackingConfig = {},
    callbacks: EyeHeadTrackingCallbacks = {}
  ) {
    this.config = {
      ...DEFAULT_EYE_HEAD_CONFIG,
      ...config,
    };

    this.callbacks = callbacks;

    this.state = {
      eyeStatus: 'idle',
      headStatus: 'idle',
      currentGaze: { x: 0, y: 0, z: 0 },
      targetGaze: { x: 0, y: 0, z: 0 },
      eyeIntensity: 0,
      lastBlinkTime: 0,
      headIntensity: 0,
      headFollowTimer: null,
      isSpeaking: false,
      isListening: false,
    };

    // Initialize submachines
    this.eyeMachine = createActor(eyeTrackingMachine, {
      input: {
        saccadeSpeed: this.config.eyeSaccadeSpeed,
        smoothPursuit: this.config.eyeSmoothPursuit,
        blinkInterval: this.calculateBlinkInterval(),
      },
    });

    this.headMachine = createActor(headTrackingMachine, {
      input: {
        followDelay: this.config.headFollowDelay,
        headSpeed: this.config.headSpeed,
      },
    });

    // Subscribe to machine state changes
    this.eyeMachine.subscribe((snapshot: any) => {
      this.onEyeStateChange(snapshot);
    });

    this.headMachine.subscribe((snapshot: any) => {
      this.onHeadStateChange(snapshot);
    });
  }

  /**
   * Start eye and head tracking
   */
  public start(): void {
    if (!this.eyeMachine.getSnapshot) {
      this.eyeMachine.start();
    }
    if (!this.headMachine.getSnapshot) {
      this.headMachine.start();
    }

    if (this.config.eyeTrackingEnabled) {
      this.eyeMachine.send({ type: 'START_TRACKING' });
      this.callbacks.onEyeStart?.();
    }

    if (this.config.headTrackingEnabled) {
      this.headMachine.send({ type: 'START_TRACKING' });
      this.callbacks.onHeadStart?.();
    }

    // Start idle variation
    if (this.config.idleVariation) {
      this.startIdleVariation();
    }
  }

  /**
   * Stop eye and head tracking
   */
  public stop(): void {
    this.clearTimers();

    if (this.config.eyeTrackingEnabled) {
      this.eyeMachine.send({ type: 'STOP_TRACKING' });
      this.callbacks.onEyeStop?.();
    }

    if (this.config.headTrackingEnabled) {
      this.headMachine.send({ type: 'STOP_TRACKING' });
      this.callbacks.onHeadStop?.();
    }

    this.state.eyeStatus = 'idle';
    this.state.headStatus = 'idle';
  }

  /**
   * Set gaze target (screen coordinates)
   */
  public setGazeTarget(target: GazeTarget): void {
    this.state.targetGaze = target;

    // Send to eye machine
    if (this.config.eyeTrackingEnabled) {
      this.eyeMachine.send({ type: 'SET_GAZE', target });
    }

    // Send to head machine (with delay if following eyes)
    if (this.config.headTrackingEnabled) {
      if (this.config.headFollowEyes) {
        this.headMachine.send({ type: 'FOLLOW_EYES', target });
      } else {
        this.headMachine.send({ type: 'SET_POSITION', target });
      }
    }

    // Apply gaze to character immediately
    this.applyGazeToCharacter(target);

    this.callbacks.onGazeChange?.(target);
  }

  /**
   * Trigger a blink
   */
  public blink(): void {
    if (!this.config.eyeTrackingEnabled) return;

    this.eyeMachine.send({ type: 'BLINK' });
    this.state.lastBlinkTime = Date.now();
    this.callbacks.onBlink?.();
  }

  /**
   * Set speaking state (for coordination with mouth animations)
   */
  public setSpeaking(isSpeaking: boolean): void {
    this.state.isSpeaking = isSpeaking;

    // When speaking, reduce idle variation
    if (isSpeaking && this.idleVariationTimer) {
      clearTimeout(this.idleVariationTimer);
      this.idleVariationTimer = null;
    } else if (!isSpeaking && this.config.idleVariation) {
      this.startIdleVariation();
    }
  }

  /**
   * Set listening state
   */
  public setListening(isListening: boolean): void {
    this.state.isListening = isListening;

    // When listening, look at speaker position
    if (isListening && this.config.lookAtSpeaker) {
      // Default speaker position (center, slightly up)
      this.setGazeTarget({ x: 0, y: 0.1, z: 0 });
    }
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<EyeHeadTrackingConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };

    // Update submachine contexts
    if (config.eyeSaccadeSpeed !== undefined || config.eyeSmoothPursuit !== undefined) {
      this.eyeMachine.send({
        type: 'UPDATE_CONFIG',
        config: {
          saccadeSpeed: this.config.eyeSaccadeSpeed,
          smoothPursuit: this.config.eyeSmoothPursuit,
        },
      });
    }

    if (config.headSpeed !== undefined || config.headFollowDelay !== undefined) {
      this.headMachine.send({
        type: 'UPDATE_CONFIG',
        config: {
          headSpeed: this.config.headSpeed,
          followDelay: this.config.headFollowDelay,
        },
      });
    }
  }

  /**
   * Get current state
   */
  public getState(): EyeHeadTrackingState {
    return { ...this.state };
  }

  /**
   * Get animation snippets for external animation manager
   */
  public getSnippets(): {
    eye: Map<string, AnimationSnippet>;
    head: Map<string, AnimationSnippet>;
  } {
    return {
      eye: this.eyeSnippets,
      head: this.headSnippets,
    };
  }

  /**
   * Set tracking mode (manual, mouse, or webcam)
   */
  public setMode(mode: 'manual' | 'mouse' | 'webcam'): void {
    // Clean up current mode
    this.cleanupMode();

    this.trackingMode = mode;
    console.log(`[EyeHeadTracking] Mode set to: ${mode}`);

    // Setup new mode
    if (mode === 'mouse') {
      this.startMouseTracking();
    } else if (mode === 'webcam') {
      this.startWebcamTracking();
    }
  }

  /**
   * Get current tracking mode
   */
  public getMode(): 'manual' | 'mouse' | 'webcam' {
    return this.trackingMode;
  }

  /**
   * Start mouse tracking
   */
  private startMouseTracking(): void {
    if (this.mouseListener) return;

    this.mouseListener = (e: MouseEvent) => {
      // Convert mouse position to normalized coordinates (-1 to 1)
      // Negate x for mirror behavior: mouse left → character looks right (at the user)
      const x = -((e.clientX / window.innerWidth) * 2 - 1);
      const y = -((e.clientY / window.innerHeight) * 2 - 1);

      console.log(`[EyeHeadTracking] Mouse: (${e.clientX}, ${e.clientY}) → Gaze: (${x.toFixed(2)}, ${y.toFixed(2)})`);
      this.setGazeTarget({ x, y, z: 0 });
    };

    window.addEventListener('mousemove', this.mouseListener);
    console.log('[EyeHeadTracking] Mouse tracking started');
  }

  /**
   * Stop mouse tracking
   */
  private stopMouseTracking(): void {
    if (this.mouseListener) {
      window.removeEventListener('mousemove', this.mouseListener);
      this.mouseListener = null;
      console.log('[EyeHeadTracking] Mouse tracking stopped');
    }
  }

  /**
   * Start webcam tracking
   */
  private startWebcamTracking(): void {
    // Webcam tracking will be initialized externally via setWebcamTracking()
    console.log('[EyeHeadTracking] Webcam tracking mode enabled (awaiting webcam instance)');
  }

  /**
   * Stop webcam tracking
   */
  private stopWebcamTracking(): void {
    if (this.webcamTracking?.stop) {
      this.webcamTracking.stop();
      this.webcamTracking = null;
      console.log('[EyeHeadTracking] Webcam tracking stopped');
    }
  }

  /**
   * Set webcam tracking instance (called externally by UI)
   */
  public setWebcamTracking(webcamInstance: any): void {
    this.webcamTracking = webcamInstance;
  }

  /**
   * Cleanup current tracking mode
   */
  private cleanupMode(): void {
    this.stopMouseTracking();
    this.stopWebcamTracking();
  }

  /**
   * Apply gaze to character using animationManager
   * Converts normalized gaze coordinates to AU values
   */
  private applyGazeToCharacter(target: GazeTarget): void {
    if (!this.config.engine) {
      console.warn('[EyeHeadTracking] No engine available - cannot apply gaze');
      return;
    }

    const { x, y } = target;
    const eyeIntensity = this.config.eyeIntensity ?? 1.0;
    const headIntensity = this.config.headIntensity ?? 0.5;

    console.log(`[EyeHeadTracking] Applying gaze (${x.toFixed(2)}, ${y.toFixed(2)}) - Eye: ${eyeIntensity}, Head: ${headIntensity}`);

    // Apply eye gaze using composite method (continuum values -1 to +1)
    if (this.config.eyeTrackingEnabled) {
      const eyeYaw = x * eyeIntensity;   // -1 (left) to +1 (right)
      const eyePitch = y * eyeIntensity; // -1 (down) to +1 (up)
      console.log(`  → Eyes: yaw=${eyeYaw.toFixed(2)}, pitch=${eyePitch.toFixed(2)}`);
      this.config.engine.applyEyeComposite(eyeYaw, eyePitch);
    }

    // Apply head movement using composite method (continuum values -1 to +1)
    if (this.config.headTrackingEnabled && this.config.headFollowEyes) {
      const headYaw = x * headIntensity;   // Same as eyes: -1 (left) to +1 (right)
      const headPitch = y * headIntensity; // -1 (down) to +1 (up)
      console.log(`  → Head: yaw=${headYaw.toFixed(2)}, pitch=${headPitch.toFixed(2)}, roll=0`);
      this.config.engine.applyHeadComposite(headYaw, headPitch, 0);
    }
  }

  /**
   * Handle eye machine state changes
   */
  private onEyeStateChange(snapshot: any): void {
    const value = snapshot.value;

    if (typeof value === 'string') {
      this.state.eyeStatus = value as any;
    }

    // Update eye intensity from context
    const context = snapshot.context;
    if (context) {
      this.state.eyeIntensity = context.eyeIntensity ?? 0;
      this.state.currentGaze = context.currentGaze ?? this.state.currentGaze;
    }
  }

  /**
   * Handle head machine state changes
   */
  private onHeadStateChange(snapshot: any): void {
    const value = snapshot.value;

    if (typeof value === 'string') {
      this.state.headStatus = value as any;
    }

    // Update head intensity from context
    const context = snapshot.context;
    if (context) {
      this.state.headIntensity = context.headIntensity ?? 0;
    }
  }

  /**
   * Start idle variation (subtle random eye/head movements)
   */
  private startIdleVariation(): void {
    if (this.idleVariationTimer) return;

    const scheduleNext = () => {
      this.idleVariationTimer = window.setTimeout(() => {
        if (!this.state.isSpeaking && this.config.idleVariation) {
          // Random gaze target within small range
          const randomGaze: GazeTarget = {
            x: (Math.random() - 0.5) * 0.3, // -0.15 to 0.15
            y: (Math.random() - 0.5) * 0.2, // -0.1 to 0.1
            z: 0,
          };

          this.setGazeTarget(randomGaze);
        }

        scheduleNext();
      }, this.config.idleVariationInterval);
    };

    scheduleNext();
  }

  /**
   * Calculate blink interval from blinks per minute
   */
  private calculateBlinkInterval(): number {
    return (60 * 1000) / this.config.eyeBlinkRate;
  }

  /**
   * Clear all timers
   */
  private clearTimers(): void {
    if (this.idleVariationTimer) {
      clearTimeout(this.idleVariationTimer);
      this.idleVariationTimer = null;
    }

    if (this.blinkTimer) {
      clearTimeout(this.blinkTimer);
      this.blinkTimer = null;
    }

    if (this.state.headFollowTimer) {
      clearTimeout(this.state.headFollowTimer);
      this.state.headFollowTimer = null;
    }
  }

  /**
   * Cleanup and release resources
   */
  public dispose(): void {
    this.stop();
    this.clearTimers();
    this.cleanupMode();

    try {
      this.eyeMachine?.stop?.();
    } catch {}

    try {
      this.headMachine?.stop?.();
    } catch {}

    this.eyeSnippets.clear();
    this.headSnippets.clear();
  }
}

/**
 * Factory function to create an Eye and Head Tracking service
 */
export function createEyeHeadTrackingService(
  config?: EyeHeadTrackingConfig,
  callbacks?: EyeHeadTrackingCallbacks
): EyeHeadTrackingService {
  return new EyeHeadTrackingService(config, callbacks);
}
