/**
 * Webcam Eye Tracking Hook using TensorFlow.js BlazeFace
 * Provides webcam access and face landmark data
 *
 * Note: TensorFlow.js and BlazeFace are loaded from CDN in index.html
 * to avoid Vite bundling issues with internal TensorFlow.js paths
 */

import { useEffect, useRef, useState, useCallback } from 'react';

// Use global blazeface from CDN
declare const blazeface: any;

export interface EyeTrackingState {
  isReady: boolean;
  isTracking: boolean;
  faceDetected: boolean;
  error: string | null;
}

export interface UseWebcamEyeTrackingOptions {
  onLandmarksDetected?: (landmarks: Array<{ x: number; y: number }>, detections: any) => void;
}

export function useWebcamEyeTracking(options: UseWebcamEyeTrackingOptions = {}) {
  const { onLandmarksDetected } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<number | null>(null);
  const modelRef = useRef<any | null>(null);

  const [state, setState] = useState<EyeTrackingState>({
    isReady: false,
    isTracking: false,
    faceDetected: false,
    error: null,
  });

  /**
   * Initialize BlazeFace model
   */
  const initializeModels = useCallback(async () => {
    try {
      console.log('[WebcamTracking] Loading BlazeFace model...');

      // Check if blazeface is available
      if (typeof blazeface === 'undefined') {
        throw new Error('BlazeFace not loaded from CDN. Check index.html script tags.');
      }

      const model = await blazeface.load();
      modelRef.current = model;

      console.log('[WebcamTracking] ✓ BlazeFace model loaded successfully');
      setState(prev => ({ ...prev, isReady: true, error: null }));
    } catch (err) {
      console.error('[WebcamTracking] ✗ Failed to load model:', err);
      setState(prev => ({ ...prev, error: `Failed to load face detection model: ${err}` }));
    }
  }, []);

  /**
   * Start webcam
   */
  const startWebcam = useCallback(async () => {
    try {
      console.log('[WebcamTracking] Requesting webcam access...');

      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia not supported in this browser');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });

      console.log('[WebcamTracking] ✓ Webcam stream obtained');
      streamRef.current = stream;

      if (videoRef.current) {
        console.log('[WebcamTracking] Attaching stream to video element...');
        videoRef.current.srcObject = stream;

        await new Promise<void>((resolve) => {
          const onLoaded = () => {
            console.log('[WebcamTracking] ✓ Video metadata loaded');
            videoRef.current?.removeEventListener('loadedmetadata', onLoaded);
            resolve();
          };
          videoRef.current?.addEventListener('loadedmetadata', onLoaded);
        });

        console.log('[WebcamTracking] Playing video...');
        await videoRef.current.play();
        console.log('[WebcamTracking] ✓ Video playing successfully');
      }

      setState(prev => ({ ...prev, error: null }));
      return true;
    } catch (err: any) {
      console.error('[WebcamTracking] ✗ Webcam error:', err);
      const errorMsg = err.name === 'NotAllowedError'
        ? 'Camera permission denied'
        : `Failed to access webcam: ${err.message}`;
      setState(prev => ({ ...prev, error: errorMsg }));
      return false;
    }
  }, []);

  /**
   * Detect faces and extract landmarks
   */
  const detectFace = async () => {
    if (!videoRef.current || !modelRef.current) {
      return;
    }

    try {
      const predictions = await modelRef.current.estimateFaces(videoRef.current, false);

      if (predictions && predictions.length > 0) {
        setState(prev => ({ ...prev, faceDetected: true }));

        const face = predictions[0];

        // BlazeFace provides 6 keypoints: leftEye, rightEye, nose, mouth, leftEar, rightEar
        // Create simplified landmark array (normalized 0-1)
        const width = videoRef.current.width;
        const height = videoRef.current.height;

        const landmarks = face.landmarks.map((point: number[]) => ({
          x: point[0] / width,
          y: point[1] / height,
        }));

        console.log('Face detected with', landmarks.length, 'keypoints');
        onLandmarksDetected?.(landmarks, predictions);
      } else {
        setState(prev => ({ ...prev, faceDetected: false }));
      }
    } catch (err) {
      console.error('Detection error:', err);
    }
  };

  /**
   * Start tracking
   */
  const startTracking = useCallback(async () => {
    console.log('Starting webcam tracking...');

    if (!state.isReady) {
      await initializeModels();
    }

    const webcamStarted = await startWebcam();
    if (!webcamStarted) return;

    setState(prev => ({ ...prev, isTracking: true }));
  }, [state.isReady, initializeModels, startWebcam]);

  /**
   * Stop tracking
   */
  const stopTracking = useCallback(() => {
    console.log('Stopping tracking');
    setState(prev => ({ ...prev, isTracking: false, faceDetected: false }));

    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  /**
   * Initialize models on mount
   */
  useEffect(() => {
    initializeModels();
  }, [initializeModels]);

  /**
   * Set up detection loop when video plays
   */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      console.log('useEffect: no video ref yet');
      return;
    }

    console.log('Setting up play event listener on video element');

    const handlePlay = () => {
      console.log('Video play event fired - starting detection interval');
      if (detectionIntervalRef.current) {
        console.log('Clearing existing interval');
        clearInterval(detectionIntervalRef.current);
      }
      const interval = setInterval(() => {
        detectFace();
      }, 100);
      detectionIntervalRef.current = interval;
      console.log('Detection interval started:', interval);
    };

    video.addEventListener('play', handlePlay);
    console.log('Play event listener attached to:', video);

    // If video is already playing, start detection immediately
    if (!video.paused) {
      console.log('Video already playing, starting detection now');
      handlePlay();
    }

    return () => {
      console.log('Cleaning up play event listener');
      video.removeEventListener('play', handlePlay);
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
    };
  }, [state.isTracking]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  return {
    videoRef,
    state,
    startTracking,
    stopTracking,
  };
}
