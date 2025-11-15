# useWebcamEyeTracking Hook

React hook for webcam-based face tracking using TensorFlow.js BlazeFace model.

## Overview

This hook provides real-time face detection and landmark extraction from a webcam feed, enabling the character to track the user's face position. It handles webcam access, model loading, and face detection, returning normalized landmark coordinates.

## Installation & Setup

### TensorFlow.js via CDN (Required)

Due to Vite bundling issues with TensorFlow.js 4.x, we load TensorFlow.js and BlazeFace from CDN instead of npm packages.

Add these scripts to your `index.html`:

```html
<head>
  <!-- Load TensorFlow.js from CDN to avoid bundling issues -->
  <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface@0.0.7/dist/blazeface.js"></script>
</head>
```

### Why CDN and Not npm?

TensorFlow.js 4.x has critical bundling issues with Vite:

**The Problem:**
- `@tensorflow/tfjs-core/dist/ops/ops_for_converter` - Referenced internally but doesn't exist
- 100+ export mismatch errors between TensorFlow.js subpackages
- Complex internal module structure that Vite's esbuild optimizer can't resolve

**Attempted Solutions (all failed):**
- ❌ Vite `optimizeDeps.exclude` - Still tried to bundle transitive dependencies
- ❌ Resolve aliases - Path doesn't actually exist to alias to
- ❌ Build externals - Caused runtime errors
- ❌ Different TensorFlow.js versions - Same issues across 4.x

**Working Solution:**
- ✅ Load from CDN in HTML - Bypasses Vite bundler entirely
- ✅ Use global `blazeface` object with TypeScript declaration
- ✅ No build errors, works in both dev and production

## Usage

### Basic Example

```typescript
import { useWebcamEyeTracking } from '@/hooks/useWebcamEyeTracking';

function MyComponent() {
  const {
    videoRef,
    state,
    startTracking,
    stopTracking
  } = useWebcamEyeTracking({
    onLandmarksDetected: (landmarks, detections) => {
      console.log('Detected face with landmarks:', landmarks);
      // landmarks[0] = left eye
      // landmarks[1] = right eye
      // landmarks[2] = nose
      // etc.
    }
  });

  return (
    <div>
      <video ref={videoRef} autoPlay playsInline muted />
      <button onClick={startTracking}>Start</button>
      <button onClick={stopTracking}>Stop</button>
      <p>Status: {state.isTracking ? 'Tracking' : 'Idle'}</p>
      <p>Face: {state.faceDetected ? 'Detected' : 'Not detected'}</p>
    </div>
  );
}
```

### With Canvas Overlay

```typescript
const { videoRef, state } = useWebcamEyeTracking({
  onLandmarksDetected: (landmarks, detections) => {
    // Draw landmarks on canvas
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && videoRef.current) {
      ctx.clearRect(0, 0, 640, 480);

      landmarks.forEach((point, i) => {
        const x = point.x * videoRef.current!.width;
        const y = point.y * videoRef.current!.height;

        ctx.fillStyle = i === 2 ? '#00ff00' : '#ff0000'; // Green nose, red others
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.fill();
      });
    }
  }
});

return (
  <div style={{ position: 'relative' }}>
    <video ref={videoRef} autoPlay playsInline muted width="640" height="480" />
    <canvas
      ref={canvasRef}
      width="640"
      height="480"
      style={{ position: 'absolute', top: 0, left: 0 }}
    />
  </div>
);
```

## API Reference

### Hook Signature

```typescript
function useWebcamEyeTracking(
  options?: UseWebcamEyeTrackingOptions
): {
  videoRef: RefObject<HTMLVideoElement>;
  state: EyeTrackingState;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
}
```

### Options

```typescript
interface UseWebcamEyeTrackingOptions {
  onLandmarksDetected?: (
    landmarks: Array<{ x: number; y: number }>,
    detections: any
  ) => void;
}
```

**`onLandmarksDetected`**: Callback fired every ~100ms when a face is detected
- `landmarks`: Array of 6 normalized keypoints (0-1 range)
- `detections`: Raw BlazeFace prediction data

### Return Value

**`videoRef`**: React ref to attach to your `<video>` element
- Must include `autoPlay`, `playsInline`, and `muted` attributes
- Webcam stream is automatically attached when tracking starts

**`state`**: Current tracking state
```typescript
interface EyeTrackingState {
  isReady: boolean;      // Model loaded successfully
  isTracking: boolean;   // Webcam active and detecting
  faceDetected: boolean; // Face currently in frame
  error: string | null;  // Error message if any
}
```

**`startTracking()`**: Async function to start webcam and face detection
- Requests camera permission
- Loads BlazeFace model if not already loaded
- Starts detection loop at 10 FPS (100ms intervals)

**`stopTracking()`**: Function to stop tracking and release webcam
- Stops video stream
- Clears detection interval
- Releases camera access

## BlazeFace Landmarks

BlazeFace provides **6 keypoints** per detected face:

```typescript
const landmarks = [
  { x: 0.45, y: 0.35 }, // 0: Left Eye
  { x: 0.55, y: 0.35 }, // 1: Right Eye
  { x: 0.50, y: 0.50 }, // 2: Nose
  { x: 0.50, y: 0.65 }, // 3: Mouth
  { x: 0.35, y: 0.40 }, // 4: Left Ear
  { x: 0.65, y: 0.40 }, // 5: Right Ear
];
```

All coordinates are **normalized** (0-1 range):
- `x`: 0 = left edge, 1 = right edge
- `y`: 0 = top edge, 1 = bottom edge

## Error Handling

The hook provides comprehensive error handling:

```typescript
const { state } = useWebcamEyeTracking({
  onLandmarksDetected: (landmarks) => {
    // Process landmarks
  }
});

// Check for errors
if (state.error) {
  if (state.error.includes('Camera permission denied')) {
    // User denied camera access
  } else if (state.error.includes('getUserMedia not supported')) {
    // Browser doesn't support webcam
  } else if (state.error.includes('BlazeFace not loaded')) {
    // TensorFlow.js CDN scripts not loaded
  }
}
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Camera permission denied` | User declined webcam access | Request permission again or show instructions |
| `getUserMedia not supported` | Old browser | Upgrade browser or disable webcam mode |
| `BlazeFace not loaded from CDN` | CDN scripts missing | Verify `index.html` has TensorFlow.js scripts |
| `Failed to load face detection model` | Network error loading model | Check internet connection |

## Performance Considerations

### Detection Rate
- Detection runs at **10 FPS** (every 100ms)
- Lower FPS saves CPU/battery but may feel laggy
- Higher FPS is smoother but more resource-intensive

### Smoothing
Apply exponential moving average to reduce jitter:

```typescript
const smoothedGaze = { x: 0, y: 0 };
const smoothing = 0.7; // Higher = smoother but slower response

const { videoRef } = useWebcamEyeTracking({
  onLandmarksDetected: (landmarks) => {
    const leftEye = landmarks[0];
    const rightEye = landmarks[1];

    const rawX = (leftEye.x + rightEye.x) / 2;
    const rawY = (leftEye.y + rightEye.y) / 2;

    smoothedGaze.x = smoothedGaze.x * smoothing + rawX * (1 - smoothing);
    smoothedGaze.y = smoothedGaze.y * smoothing + rawY * (1 - smoothing);

    // Use smoothedGaze for character tracking
  }
});
```

### Memory Management
- Hook automatically cleans up on unmount
- Stops webcam stream
- Clears detection interval
- Model persists across component re-renders (singleton)

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| getUserMedia | ✅ 53+ | ✅ 36+ | ✅ 11+ | ✅ 79+ |
| TensorFlow.js | ✅ | ✅ | ✅ | ✅ |
| BlazeFace | ✅ | ✅ | ✅ | ✅ |

**Note**: Webcam requires **HTTPS** in production (or localhost in development).

## Debugging

Enable verbose logging by checking console output:

```typescript
// Hook logs include [WebcamTracking] prefix
[WebcamTracking] Loading BlazeFace model...
[WebcamTracking] ✓ BlazeFace model loaded successfully
[WebcamTracking] Requesting webcam access...
[WebcamTracking] ✓ Webcam stream obtained
[WebcamTracking] ✓ Video metadata loaded
[WebcamTracking] ✓ Video playing successfully
Face detected with 6 keypoints
```

## Vite Configuration

Your `vite.config.ts` should **exclude** TensorFlow.js packages to prevent bundling attempts:

```typescript
export default defineConfig({
  optimizeDeps: {
    exclude: [
      '@tensorflow/tfjs',
      '@tensorflow/tfjs-core',
      '@tensorflow/tfjs-converter',
      '@tensorflow/tfjs-backend-cpu',
      '@tensorflow/tfjs-backend-webgl',
      '@tensorflow-models/blazeface',
    ],
  },
});
```

This prevents Vite from trying to optimize packages that are loaded from CDN.

## Related Files

- [src/latticework/eyeHeadTracking/README.md](../latticework/eyeHeadTracking/README.md) - Eye/Head tracking service
- [src/components/au/EyeHeadTrackingSection.tsx](../components/au/EyeHeadTrackingSection.tsx) - UI component
- [index.html](../../index.html) - TensorFlow.js CDN scripts

## Future Improvements

- Support for MediaPipe FaceMesh (468 landmarks for detailed tracking)
- Face orientation/pose estimation (pitch, yaw, roll)
- Multiple face tracking
- Depth estimation
- Iris tracking for precise gaze direction
