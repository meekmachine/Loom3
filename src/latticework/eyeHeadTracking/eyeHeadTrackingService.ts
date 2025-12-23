/**
 * Eye and Head Tracking Service
 * Coordinates eye and head movements that follow mouth animations
 * Uses the animation scheduler to drive both eyes and head with a shared controller.
 */

import type {
  EyeHeadTrackingConfig,
  EyeHeadTrackingState,
  EyeHeadTrackingCallbacks,
  GazeTarget,
  AnimationSnippet,
} from './types';
import { DEFAULT_EYE_HEAD_CONFIG } from './types';
import { EyeHeadTrackingScheduler, type EyeHeadHostCaps } from './eyeHeadTrackingScheduler';
import { createActor } from 'xstate';
import {
  eyeHeadTrackingMachine,
  type EyeHeadTrackingMachine,
  type EyeHeadTrackingMachineContext,
} from './eyeHeadTrackingMachine';

// Declare global BlazeFace from CDN
declare const blazeface: {
  load: () => Promise<any>;
};

export class EyeHeadTrackingService {
  private config: EyeHeadTrackingConfig;
  private state: EyeHeadTrackingState;
  private callbacks: EyeHeadTrackingCallbacks;

  private scheduler: EyeHeadTrackingScheduler | null = null;

  // Animation snippets
  private eyeSnippets: Map<string, AnimationSnippet> = new Map();
  private headSnippets: Map<string, AnimationSnippet> = new Map();

  // Timers
  private idleVariationTimer: number | null = null;

  // Tracking mode
  private trackingMode: 'manual' | 'mouse' | 'webcam' = 'manual';
  private mouseListener: ((e: MouseEvent) => void) | null = null;
  private machine: ReturnType<typeof createActor<EyeHeadTrackingMachine>> | null = null;
  private filteredGaze: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };
  private lastMouseUpdate: number = 0;

  // Webcam tracking state (internal - no React hooks)
  private webcamModel: any = null;
  private webcamStream: MediaStream | null = null;
  private webcamVideo: HTMLVideoElement | null = null;
  private webcamRafId: number | null = null;
  private webcamFaceDetected: boolean = false;
  private webcamListeners: Set<(detected: boolean, landmarks?: Array<{ x: number; y: number }>) => void> = new Set();
  private lastWebcamUpdate: number = 0;

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
      returnToNeutralTimer: null,
      lastGazeUpdateTime: Date.now(),
    };

    this.initializeScheduler();
    this.applyMixWeightSettings();
    this.initializeMachine();
  }

  private initializeMachine(): void {
    try {
      this.machine = createActor(eyeHeadTrackingMachine).start();
      this.machine.send({ type: 'UPDATE_CONFIG', config: this.config });
      this.machine.send({
        type: 'SET_STATUS',
        eye: this.state.eyeStatus,
        head: this.state.headStatus,
        lastApplied: this.state.currentGaze,
      });
    } catch (err) {
      console.warn('[EyeHeadTracking] Failed to initialize tracking machine', err);
    }
  }

  private initializeScheduler(): void {
    if (!this.config.animationAgency) {
      this.scheduler = null;
      return;
    }

    const agency = this.config.animationAgency;
    const host: EyeHeadHostCaps = {
      scheduleSnippet: (snippet: any) => agency.schedule?.(snippet) ?? null,
      removeSnippet: (name: string) => {
        agency.remove?.(name);
      },
      onSnippetEnd: (name: string) => {
        try { agency.onSnippetEnd?.(name); } catch {}
      }
    };

    this.scheduler = new EyeHeadTrackingScheduler(host, {
      duration: this.config.returnToNeutralDuration ?? 200,
      eyeIntensity: this.config.eyeIntensity ?? DEFAULT_EYE_HEAD_CONFIG.eyeIntensity,
      headIntensity: this.config.headIntensity ?? DEFAULT_EYE_HEAD_CONFIG.headIntensity,
      eyePriority: this.config.eyePriority ?? DEFAULT_EYE_HEAD_CONFIG.eyePriority,
      headPriority: this.config.headPriority ?? DEFAULT_EYE_HEAD_CONFIG.headPriority,
    });
  }

  private clampMix(value: number | undefined, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.min(1, Math.max(0, value));
    }
    return fallback;
  }

  private applyMixWeightSettings(): void {
    const engine = this.config.engine;
    if (!engine?.setAUMixWeight) return;

    const eyeMix = this.clampMix(
      this.config.eyeBlendWeight,
      DEFAULT_EYE_HEAD_CONFIG.eyeBlendWeight
    );
    const headMix = this.clampMix(
      this.config.headBlendWeight,
      DEFAULT_EYE_HEAD_CONFIG.headBlendWeight
    );

    [61, 62, 63, 64].forEach((au) => engine.setAUMixWeight(au, eyeMix));
    [31, 32, 33, 54, 55, 56].forEach((au) => engine.setAUMixWeight(au, headMix));
  }

  /**
   * Start eye and head tracking
   */
  public start(): void {
    if (this.config.eyeTrackingEnabled) {
      this.state.eyeStatus = 'tracking';
      this.callbacks.onEyeStart?.();
    }

    if (this.config.headTrackingEnabled) {
      this.state.headStatus = 'tracking';
      this.callbacks.onHeadStart?.();
    }

    // Start idle variation (DISABLED - only mouse/webcam/manual tracking)
    // if (this.config.idleVariation) {
    //   this.startIdleVariation();
    // }
  }

  /**
   * Stop eye and head tracking
   */
  public stop(): void {
    this.clearTimers();
    this.scheduler?.stop();

    if (this.config.eyeTrackingEnabled) {
      this.callbacks.onEyeStop?.();
    }

    if (this.config.headTrackingEnabled) {
      this.callbacks.onHeadStop?.();
    }

    this.state.eyeStatus = 'idle';
    this.state.headStatus = 'idle';
    this.machine?.send({
      type: 'SET_STATUS',
      eye: this.state.eyeStatus,
      head: this.state.headStatus,
      lastApplied: this.state.currentGaze,
    });
  }

  /**
   * Set gaze target (screen coordinates)
   */
  public setGazeTarget(target: GazeTarget): void {
    // Early return if both eye and head tracking are disabled
    if (!this.config.eyeTrackingEnabled && !this.config.headTrackingEnabled) {
      return;
    }

    this.state.targetGaze = target;
    this.state.lastGazeUpdateTime = Date.now();
    this.machine?.send({ type: 'SET_TARGET', target });

    if (this.config.eyeTrackingEnabled) {
      this.state.eyeStatus = 'tracking';
    }

    // Clear any existing return-to-neutral timer since we have a new target
    this.clearReturnToNeutralTimer();

    const headDelay = this.config.headFollowEyes ? (this.config.headFollowDelay ?? 0) : 0;
    const applyHeadImmediately = !this.config.headTrackingEnabled
      ? false
      : !this.config.headFollowEyes || headDelay <= 0;

    // Apply eyes immediately; apply head immediately only when needed (otherwise schedule lag).
    this.applyGazeToCharacter(target, {
      applyEyes: this.config.eyeTrackingEnabled,
      applyHead: applyHeadImmediately,
    });

    if (this.config.headTrackingEnabled) {
      this.state.headStatus = this.config.headFollowEyes && headDelay > 0 ? 'lagging' : 'tracking';
    }
    this.machine?.send({
      type: 'SET_STATUS',
      eye: this.state.eyeStatus,
      head: this.state.headStatus,
      lastApplied: this.state.currentGaze,
    });

    if (this.config.headTrackingEnabled && this.config.headFollowEyes && headDelay > 0) {
      if (this.state.headFollowTimer) {
        clearTimeout(this.state.headFollowTimer);
      }
      this.state.headFollowTimer = window.setTimeout(() => {
        this.applyGazeToCharacter(target, { applyEyes: false, applyHead: true });
        this.state.headStatus = 'tracking';
        this.state.headFollowTimer = null;
      }, headDelay);
    }

    // Schedule return to neutral if enabled (only for manual mode)
    this.scheduleReturnToNeutral();

    this.callbacks.onGazeChange?.(target);
  }

  /**
   * Reset gaze to neutral center position
   *
   * Use this when you want to explicitly return the head/eyes to center,
   * such as when switching tracking modes or ending a conversation.
   *
   * @param duration - Transition duration in milliseconds (default: 300ms)
   */
  public resetToNeutral(duration: number = 300): void {
    this.setGazeTarget({ x: 0, y: 0, z: 0 });
  }

  /**
   * Trigger a blink
   */
  public blink(): void {
    console.warn('[EyeHeadTracking] blink() called but blink handling has moved to BlinkService');
    this.callbacks.onBlink?.();
  }

  /**
   * Set speaking state (for coordination with mouth animations)
   */
  public setSpeaking(isSpeaking: boolean): void {
    this.state.isSpeaking = isSpeaking;

    // When speaking, reduce idle variation (DISABLED - idle variation removed)
    // if (isSpeaking && this.idleVariationTimer) {
    //   clearTimeout(this.idleVariationTimer);
    //   this.idleVariationTimer = null;
    // } else if (!isSpeaking && this.config.idleVariation) {
    //   this.startIdleVariation();
    // }
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

  public setEyeBlendWeight(value: number): void {
    this.config.eyeBlendWeight = this.clampMix(value, DEFAULT_EYE_HEAD_CONFIG.eyeBlendWeight);
    this.applyMixWeightSettings();
  }

  public setHeadBlendWeight(value: number): void {
    this.config.headBlendWeight = this.clampMix(value, DEFAULT_EYE_HEAD_CONFIG.headBlendWeight);
    this.applyMixWeightSettings();
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<EyeHeadTrackingConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };

    if (config.animationAgency !== undefined) {
      this.initializeScheduler();
    } else {
      this.scheduler?.updateConfig?.({
        eyeIntensity: this.config.eyeIntensity ?? DEFAULT_EYE_HEAD_CONFIG.eyeIntensity,
        headIntensity: this.config.headIntensity ?? DEFAULT_EYE_HEAD_CONFIG.headIntensity,
        eyePriority: this.config.eyePriority ?? DEFAULT_EYE_HEAD_CONFIG.eyePriority,
        headPriority: this.config.headPriority ?? DEFAULT_EYE_HEAD_CONFIG.headPriority,
      });
    }

    if (
      config.eyeBlendWeight !== undefined ||
      config.headBlendWeight !== undefined ||
      config.engine !== undefined
    ) {
      this.applyMixWeightSettings();
    }

    this.machine?.send({ type: 'UPDATE_CONFIG', config: this.config });
  }

  /**
   * Get current state
   */
  public getState(): EyeHeadTrackingState {
    return { ...this.state };
  }

  /**
   * Get machine context (config + current/target gaze) for UI/debug overlays
   */
  public getMachineContext(): EyeHeadTrackingMachineContext | null {
    if (!this.machine) return null;
    try {
      return this.machine.getSnapshot().context;
    } catch {
      return null;
    }
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
   *
   * IMPORTANT: When switching modes, the head/eyes PRESERVE their last position.
   * They do NOT reset to neutral automatically. This is by design:
   * - Switching from mouse→manual: Head stays at last mouse position
   * - Switching from webcam→manual: Head stays at last detected face position
   * - Call resetToNeutral() explicitly if you want to return to center
   *
   * This behavior is enabled by the automatic continuity system in the animation agency,
   * which ensures smooth transitions from the current position when new gaze targets are set.
   */
  public setMode(mode: 'manual' | 'mouse' | 'webcam'): void {
    // Clean up current mode (removes listeners, but preserves last position)
    this.cleanupMode();

    this.trackingMode = mode;
    this.machine?.send({ type: 'SET_MODE', mode });

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

    // Clear return to neutral timer when actively tracking mouse
    this.clearReturnToNeutralTimer();

    this.mouseListener = (e: MouseEvent) => {
      // Early return if both eye and head tracking are disabled
      if (!this.config.eyeTrackingEnabled && !this.config.headTrackingEnabled) {
        return;
      }

      // Throttle to ~60fps (16ms)
      const now = performance.now();
      if (now - this.lastMouseUpdate < 16) return;
      this.lastMouseUpdate = now;

      // Convert mouse position to normalized coordinates (-1 to 1)
      // Negate x for mirror behavior: mouse left → character looks right (at the user)
      const x = -((e.clientX / window.innerWidth) * 2 - 1);
      const y = -((e.clientY / window.innerHeight) * 2 - 1);

      // Use setGazeTarget which respects useAnimationAgency toggle
      this.setGazeTarget({ x, y, z: 0 });
    };

    window.addEventListener('mousemove', this.mouseListener);
  }

  /**
   * Stop mouse tracking
   */
  private stopMouseTracking(): void {
    if (this.mouseListener) {
      window.removeEventListener('mousemove', this.mouseListener);
      this.mouseListener = null;
    }
  }

  /**
   * Start webcam tracking - loads model, starts camera, runs detection loop
   */
  private async startWebcamTracking(): Promise<void> {
    // Load BlazeFace model if not already loaded
    if (!this.webcamModel) {
      try {
        if (typeof blazeface === 'undefined') {
          console.error('[EyeHeadTracking] BlazeFace not loaded from CDN');
          return;
        }
        console.log('[EyeHeadTracking] Loading BlazeFace model...');
        this.webcamModel = await blazeface.load();
        console.log('[EyeHeadTracking] BlazeFace model loaded');
      } catch (err) {
        console.error('[EyeHeadTracking] Failed to load BlazeFace:', err);
        return;
      }
    }

    // Start webcam stream
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        console.error('[EyeHeadTracking] getUserMedia not supported');
        return;
      }

      this.webcamStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });

      // Create hidden video element
      this.webcamVideo = document.createElement('video');
      this.webcamVideo.srcObject = this.webcamStream;
      this.webcamVideo.width = 640;
      this.webcamVideo.height = 480;
      this.webcamVideo.autoplay = true;
      this.webcamVideo.playsInline = true;
      this.webcamVideo.muted = true;

      await new Promise<void>((resolve) => {
        this.webcamVideo!.onloadedmetadata = () => resolve();
      });
      await this.webcamVideo.play();

      console.log('[EyeHeadTracking] Webcam started');

      // Start detection loop using RAF (no setInterval)
      this.runWebcamDetectionLoop();
    } catch (err) {
      console.error('[EyeHeadTracking] Failed to start webcam:', err);
    }
  }

  /**
   * Run webcam face detection in RAF loop (throttled to ~30fps)
   */
  private runWebcamDetectionLoop(): void {
    if (!this.webcamVideo || !this.webcamModel || this.trackingMode !== 'webcam') {
      return;
    }

    const detect = async () => {
      if (!this.webcamVideo || !this.webcamModel || this.trackingMode !== 'webcam') {
        return;
      }

      // Throttle to ~30fps (33ms)
      const now = performance.now();
      if (now - this.lastWebcamUpdate < 33) {
        this.webcamRafId = requestAnimationFrame(detect);
        return;
      }
      this.lastWebcamUpdate = now;

      try {
        const predictions = await this.webcamModel.estimateFaces(this.webcamVideo, false);

        if (predictions && predictions.length > 0) {
          const face = predictions[0];
          const width = this.webcamVideo.width;
          const height = this.webcamVideo.height;

          // BlazeFace landmarks: leftEye, rightEye, nose, mouth, leftEar, rightEar
          const landmarks = face.landmarks.map((point: number[]) => ({
            x: point[0] / width,
            y: point[1] / height,
          }));

          // Calculate gaze from eye positions
          const leftEye = landmarks[0];
          const rightEye = landmarks[1];
          const avgX = (leftEye.x + rightEye.x) / 2;
          const avgY = (leftEye.y + rightEye.y) / 2;

          // Convert to -1 to 1 range
          const gazeX = avgX * 2 - 1;
          const gazeY = -(avgY * 2 - 1);

          // Use setGazeTarget which respects useAnimationAgency toggle
          this.setGazeTarget({ x: gazeX, y: gazeY, z: 0 });

          // Notify listeners if face detection status changed
          if (!this.webcamFaceDetected) {
            this.webcamFaceDetected = true;
            this.notifyWebcamListeners(true, landmarks);
          }
        } else {
          if (this.webcamFaceDetected) {
            this.webcamFaceDetected = false;
            this.notifyWebcamListeners(false);
          }
        }
      } catch (err) {
        // Silently ignore detection errors
      }

      // Continue loop
      this.webcamRafId = requestAnimationFrame(detect);
    };

    this.webcamRafId = requestAnimationFrame(detect);
  }

  /**
   * Stop webcam tracking
   */
  private stopWebcamTracking(): void {
    // Cancel detection loop
    if (this.webcamRafId !== null) {
      cancelAnimationFrame(this.webcamRafId);
      this.webcamRafId = null;
    }

    // Stop media stream tracks
    if (this.webcamStream) {
      this.webcamStream.getTracks().forEach(track => track.stop());
      this.webcamStream = null;
    }

    // Clean up video element
    if (this.webcamVideo) {
      this.webcamVideo.srcObject = null;
      this.webcamVideo = null;
    }

    this.webcamFaceDetected = false;
    this.notifyWebcamListeners(false);
  }

  /**
   * Subscribe to webcam detection updates (for UI to show face status)
   */
  public subscribeToWebcam(callback: (detected: boolean, landmarks?: Array<{ x: number; y: number }>) => void): () => void {
    this.webcamListeners.add(callback);
    // Immediately notify current state
    callback(this.webcamFaceDetected);
    return () => {
      this.webcamListeners.delete(callback);
    };
  }

  /**
   * Get current webcam video element (for UI preview)
   */
  public getWebcamVideoElement(): HTMLVideoElement | null {
    return this.webcamVideo;
  }

  /**
   * Check if webcam is actively tracking
   */
  public isWebcamActive(): boolean {
    return this.trackingMode === 'webcam' && this.webcamVideo !== null;
  }

  /**
   * Notify webcam listeners of detection status change
   */
  private notifyWebcamListeners(detected: boolean, landmarks?: Array<{ x: number; y: number }>): void {
    this.webcamListeners.forEach(cb => cb(detected, landmarks));
  }

  /**
   * Cleanup current tracking mode
   */
  private cleanupMode(): void {
    this.stopMouseTracking();
    this.stopWebcamTracking();
  }

  /**
   * Apply gaze to character using smooth transitions
   * Converts normalized gaze coordinates to AU values
   * Always uses transitions for smooth, natural movement
   * Duration scales with distance traveled for natural motion
   *
   * Camera offset is applied to make the character look at the camera position,
   * then the target gaze is added on top for perspective-correct eye contact.
   */
  private applyGazeToCharacter(
    target: GazeTarget,
    options?: { applyEyes?: boolean; applyHead?: boolean; skipMachine?: boolean }
  ): void {
    // Early return if both eye and head tracking are disabled (already checked in setGazeTarget, but double-check)
    if (!this.config.eyeTrackingEnabled && !this.config.headTrackingEnabled) {
      return;
    }

    const { x, y } = target;
    const eyeIntensity = this.config.eyeIntensity ?? 1.0;
    const headIntensity = this.config.headIntensity ?? 0.5;

    const cameraOffset = this.config.engine?.getCameraOffset?.() ?? { x: 0, y: 0 };

    // Apply camera offset to target coordinates
    // For webcam mode, this creates realistic eye contact
    // For mouse/manual modes, this adds subtle perspective correction
    const adjustedX = x + cameraOffset.x;
    const adjustedY = y + cameraOffset.y;

    // Smooth target to prevent micro-jumps (especially near center crossing)
    const prev = this.filteredGaze ?? this.state.currentGaze;
    const rawDistance = Math.hypot(adjustedX - prev.x, adjustedY - prev.y);
    const baseAlpha = this.trackingMode === 'mouse' ? 0.35 : 0.25;
    const alpha = Math.min(0.85, baseAlpha + rawDistance * 0.3); // Larger moves respond faster
    const smoothX = prev.x + (adjustedX - prev.x) * alpha;
    const smoothY = prev.y + (adjustedY - prev.y) * alpha;
    const smoothedTarget = { x: smoothX, y: smoothY, z: 0 };

    // Calculate distance from current position (using smoothed coordinates)
    const { x: currentX, y: currentY } = this.state.currentGaze;
    const deltaX = smoothX - currentX;
    const deltaY = smoothY - currentY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Ignore ultra-small changes to avoid rescheduling noise when crossing center
    if (distance < 0.003) {
      this.filteredGaze = smoothedTarget;
      this.state.currentGaze = smoothedTarget;
      return;
    }

    // Scale duration based on distance traveled
    // Base durations: eye 150-400ms, head 250-600ms
    // Use different scaling for mouse (faster response) vs manual
    const minEyeDuration = this.trackingMode === 'mouse' ? 100 : 150;
    const maxEyeDuration = this.trackingMode === 'mouse' ? 300 : 400;
    const minHeadDuration = this.trackingMode === 'mouse' ? 200 : 250;
    const maxHeadDuration = this.trackingMode === 'mouse' ? 500 : 600;

    // Linear interpolation based on distance (0 to sqrt(2) for full diagonal)
    const normalizedDistance = Math.min(distance / Math.sqrt(2), 1.0);
    const eyeDuration = Math.round(minEyeDuration + normalizedDistance * (maxEyeDuration - minEyeDuration));
    const headDuration = Math.round(minHeadDuration + normalizedDistance * (maxHeadDuration - minHeadDuration));

    const applyEyes = options?.applyEyes ?? true;
    const applyHead = options?.applyHead ?? true;
    const scheduler = this.scheduler;
    const useAgency = this.config.useAnimationAgency ?? DEFAULT_EYE_HEAD_CONFIG.useAnimationAgency;

    // Use animation agency if enabled AND available, otherwise use direct engine calls
    if (useAgency && scheduler && this.config.animationAgency) {
      scheduler.scheduleGazeTransition(
        smoothedTarget,
        {
          eyeEnabled: applyEyes && this.config.eyeTrackingEnabled,
          headEnabled: applyHead && this.config.headTrackingEnabled,
          headFollowEyes: this.config.headFollowEyes,
          eyeDuration: eyeDuration,
          headDuration: headDuration,
        }
      );
    } else if (this.config.engine) {
      // Direct engine path - simpler, bypasses animation scheduler
      // Use transitionAU for each axis (yaw/pitch)
      // Only call ONE AU based on continuum sign (calling both would overwrite the bone)
      if (applyEyes && this.config.eyeTrackingEnabled) {
        const eyeYaw = smoothedTarget.x * eyeIntensity;
        const eyePitch = smoothedTarget.y * eyeIntensity;
        // Eyes horizontal: AU61 (left) / AU62 (right)
        if (eyeYaw < 0) {
          this.config.engine.transitionAU?.(61, Math.abs(eyeYaw), eyeDuration);
        } else {
          this.config.engine.transitionAU?.(62, eyeYaw, eyeDuration);
        }
        // Eyes vertical: AU64 (down) / AU63 (up)
        if (eyePitch < 0) {
          this.config.engine.transitionAU?.(64, Math.abs(eyePitch), eyeDuration);
        } else {
          this.config.engine.transitionAU?.(63, eyePitch, eyeDuration);
        }
      }

      if (applyHead && this.config.headTrackingEnabled && this.config.headFollowEyes) {
        const headYaw = smoothedTarget.x * headIntensity;
        const headPitch = smoothedTarget.y * headIntensity;
        // Head horizontal: AU31 (left) / AU32 (right)
        if (headYaw < 0) {
          this.config.engine.transitionAU?.(31, Math.abs(headYaw), headDuration);
        } else {
          this.config.engine.transitionAU?.(32, headYaw, headDuration);
        }
        // Head vertical: AU54 (down) / AU33 (up)
        if (headPitch < 0) {
          this.config.engine.transitionAU?.(54, Math.abs(headPitch), headDuration);
        } else {
          this.config.engine.transitionAU?.(33, headPitch, headDuration);
        }
      }
    } else {
      console.warn('[EyeHeadTracking] No animation agency or engine available - cannot apply gaze');
    }

    if (applyEyes && this.config.eyeTrackingEnabled) {
      this.state.eyeIntensity = eyeIntensity;
    }
    if (applyHead && this.config.headTrackingEnabled) {
      this.state.headIntensity = headIntensity;
    }

    // Update current gaze position for next distance calculation (use adjusted coordinates)
    this.filteredGaze = smoothedTarget;
    this.state.currentGaze = smoothedTarget;

    // Skip machine updates for continuous tracking (mouse/webcam) to avoid overhead
    if (!options?.skipMachine) {
      this.machine?.send({
        type: 'SET_STATUS',
        lastApplied: this.state.currentGaze,
      });
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
   * Schedule graceful return to neutral after delay
   * Only applies when returnToNeutralEnabled is true
   */
  private scheduleReturnToNeutral(): void {
    if (!this.config.returnToNeutralEnabled) {
      return;
    }

    // Clear any existing timer
    this.clearReturnToNeutralTimer();

    const delay = this.config.returnToNeutralDelay ?? 3000;
    const duration = this.config.returnToNeutralDuration ?? 800;

    this.state.returnToNeutralTimer = window.setTimeout(() => {
      // Only return to neutral if we're not at neutral already
      const { x, y } = this.state.targetGaze;
      const isAlreadyNeutral = Math.abs(x) < 0.01 && Math.abs(y) < 0.01;

      if (!isAlreadyNeutral) {
        const useAgency = this.config.useAnimationAgency ?? DEFAULT_EYE_HEAD_CONFIG.useAnimationAgency;
        if (useAgency && this.scheduler && this.config.animationAgency) {
          this.scheduler.resetToNeutral(duration);
        } else if (this.config.engine) {
          // Use transitionAU to return all axes to neutral (0)
          // Reset both AUs in each pair to 0
          if (this.config.eyeTrackingEnabled) {
            this.config.engine.transitionAU?.(61, 0, duration); // Eyes left
            this.config.engine.transitionAU?.(62, 0, duration); // Eyes right
            this.config.engine.transitionAU?.(63, 0, duration); // Eyes up
            this.config.engine.transitionAU?.(64, 0, duration); // Eyes down
          }
          if (this.config.headTrackingEnabled && this.config.headFollowEyes) {
            this.config.engine.transitionAU?.(31, 0, duration); // Head left
            this.config.engine.transitionAU?.(32, 0, duration); // Head right
            this.config.engine.transitionAU?.(33, 0, duration); // Head up
            this.config.engine.transitionAU?.(54, 0, duration); // Head down
          }
        }

        this.state.targetGaze = { x: 0, y: 0, z: 0 };
      }

      this.state.returnToNeutralTimer = null;
    }, delay);
  }

  /**
   * Clear return to neutral timer
   */
  private clearReturnToNeutralTimer(): void {
    if (this.state.returnToNeutralTimer) {
      clearTimeout(this.state.returnToNeutralTimer);
      this.state.returnToNeutralTimer = null;
    }
  }

  /**
   * Clear all timers
   */
  private clearTimers(): void {
    if (this.idleVariationTimer) {
      clearTimeout(this.idleVariationTimer);
      this.idleVariationTimer = null;
    }

    if (this.state.headFollowTimer) {
      clearTimeout(this.state.headFollowTimer);
      this.state.headFollowTimer = null;
    }

    this.clearReturnToNeutralTimer();
  }

  /**
   * Cleanup and release resources
   */
  public dispose(): void {
    this.stop();
    this.clearTimers();
    this.cleanupMode();

    this.eyeSnippets.clear();
    this.headSnippets.clear();
    try { this.scheduler?.stop(); } catch {}
    this.scheduler = null;
    try { this.machine?.stop(); } catch {}
    this.machine = null;
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
