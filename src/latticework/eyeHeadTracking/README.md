# Eye and Head Tracking Agency

Coordinates eye and head movements that naturally follow mouth animations and speech patterns.

## Architecture

The Eye and Head Tracking Agency uses a **dual-submachine architecture** with two independent XState state machines:

1. **Eye Tracking Machine** - Manages eye gaze direction, saccades, smooth pursuit, and blinking
2. **Head Tracking Machine** - Manages head rotation and tilt to follow eye gaze or external targets

Both submachines are coordinated by the **EyeHeadTrackingService**, which provides a unified API and integrates with the Animation Service for scheduling.

## Features

- **Coordinated Eye-Head Movement**: Head automatically follows eye gaze with configurable delay
- **Natural Eye Movements**: Supports both saccadic (rapid) and smooth pursuit eye movements
- **Automatic Blinking**: Configurable blink rate with natural timing
- **Idle Variation**: Subtle random movements when not actively tracking
- **Speech Coordination**: Reduces idle variation during speech
- **Listener Mode**: Can look at imaginary speaker position
- **High Priority**: Eye/head movements override prosodic and lip-sync animations

## Usage

### Basic Setup

```typescript
import { createEyeHeadTrackingService } from '@/latticework/eyeHeadTracking';

const eyeHeadTracking = createEyeHeadTrackingService({
  eyeTrackingEnabled: true,
  headTrackingEnabled: true,
  headFollowEyes: true,
  headFollowDelay: 200, // ms
}, {
  onGazeChange: (target) => {
    console.log('Gaze changed to:', target);
  },
  onBlink: () => {
    console.log('Blink!');
  },
});

// Start tracking
eyeHeadTracking.start();
```

### Setting Gaze Targets

```typescript
// Set gaze target (normalized screen space: -1 to 1)
eyeHeadTracking.setGazeTarget({
  x: 0.3,  // Right of center
  y: -0.2, // Below center
  z: 0,    // Depth (optional)
});

// Eyes will move immediately (saccade or smooth pursuit)
// Head will follow after the configured delay
```

### Coordinating with Speech

```typescript
// When starting to speak
eyeHeadTracking.setSpeaking(true);

// When listening
eyeHeadTracking.setListening(true);

// When finished
eyeHeadTracking.setSpeaking(false);
eyeHeadTracking.setListening(false);
```

### Manual Blinking

```typescript
// Trigger a blink manually
eyeHeadTracking.blink();

// Automatic blinking happens based on eyeBlinkRate config
```

### Configuration

```typescript
eyeHeadTracking.updateConfig({
  eyeSaccadeSpeed: 0.8,      // Faster eye movements
  headSpeed: 0.3,            // Slower head movements
  headFollowDelay: 300,      // Longer delay before head follows
  eyeBlinkRate: 20,          // 20 blinks per minute
  idleVariation: true,       // Enable natural idle movements
  idleVariationInterval: 3000, // Every 3 seconds
});
```

## Integration with Animation Service

The Eye and Head Tracking Agency works alongside other Latticework agencies with priority-based scheduling:

```typescript
// Priority hierarchy (from AnimationService):
// - Eye/Head Tracking: Priority 15-20 (highest)
// - LipSync Visemes: Priority 10
// - Prosodic Pulses: Priority 5
// - Emotion/Expression: Priority 0-5 (baseline)

// Eye movements will always override lower-priority animations
```

## State Machine Architecture

### Eye Tracking Machine States

- **idle**: Not tracking, eyes at rest
- **tracking**: Actively tracking a target
- **saccade**: Rapid eye movement (50-200ms)
- **smooth_pursuit**: Smooth following movement
- **blinking**: Eye blink (150ms)

### Head Tracking Machine States

- **idle**: Not tracking, head at neutral position
- **tracking**: Actively tracking a target
- **delayedFollow**: Waiting before following eyes
- **following**: Following eye gaze direction
- **moving**: Moving to explicit position target

## Action Units (AUs)

The agency controls the following ARKit blendshapes via AUs:

### Eye AUs (Priority: 20)
- **61-64**: Both eyes (look left/right/up/down)
- **65-68**: Left eye individual (look left/right/up/down)
- **69-72**: Right eye individual (look left/right/up/down)
- **43**: Blink
- **5**: Eye wide
- **7**: Eye squint

### Head AUs (Priority: 15)
- **31-32**: Head turn (left/right)
- **33, 54**: Head turn (up/down)
- **55-56**: Head tilt (left/right)

## Example: Full Integration with TTS

```typescript
import { createTTSService } from '@/latticework/tts';
import { createProsodicService } from '@/latticework/prosodic';
import { createEyeHeadTrackingService } from '@/latticework/eyeHeadTracking';

// Create services
const prosodic = createProsodicService();
const eyeHeadTracking = createEyeHeadTrackingService({
  headFollowEyes: true,
  mouthSyncEnabled: true,
});

const tts = createTTSService(config, {
  onStart: () => {
    prosodic.startTalking();
    eyeHeadTracking.setSpeaking(true);
    // Look slightly away when starting to speak
    eyeHeadTracking.setGazeTarget({ x: 0.2, y: -0.1 });
  },
  onBoundary: (wordIndex) => {
    prosodic.pulse(wordIndex);
    // Occasional gaze shifts during speech
    if (wordIndex % 5 === 0) {
      const randomGaze = {
        x: (Math.random() - 0.5) * 0.3,
        y: (Math.random() - 0.5) * 0.2,
      };
      eyeHeadTracking.setGazeTarget(randomGaze);
    }
  },
  onEnd: () => {
    prosodic.stopTalking();
    eyeHeadTracking.setSpeaking(false);
    // Return to center
    eyeHeadTracking.setGazeTarget({ x: 0, y: 0 });
  },
});

// Start tracking
eyeHeadTracking.start();
```

## API Reference

### `createEyeHeadTrackingService(config?, callbacks?)`

Creates and returns an `EyeHeadTrackingService` instance.

**Config Options:**
```typescript
interface EyeHeadTrackingConfig {
  // Eye tracking
  eyeTrackingEnabled?: boolean;
  eyeSaccadeSpeed?: number;        // 0.1-1.0
  eyeSmoothPursuit?: boolean;
  eyeBlinkRate?: number;           // blinks per minute
  eyePriority?: number;

  // Head tracking
  headTrackingEnabled?: boolean;
  headFollowEyes?: boolean;
  headFollowDelay?: number;        // milliseconds
  headSpeed?: number;              // 0.1-1.0
  headPriority?: number;

  // Coordination
  mouthSyncEnabled?: boolean;
  lookAtSpeaker?: boolean;

  // Idle behavior
  idleVariation?: boolean;
  idleVariationInterval?: number;  // milliseconds
}
```

**Callbacks:**
```typescript
interface EyeHeadTrackingCallbacks {
  onEyeStart?: () => void;
  onEyeStop?: () => void;
  onHeadStart?: () => void;
  onHeadStop?: () => void;
  onGazeChange?: (target: GazeTarget) => void;
  onBlink?: () => void;
  onError?: (error: Error) => void;
}
```

### Service Methods

- `start()` - Start eye and head tracking
- `stop()` - Stop tracking and return to neutral
- `setGazeTarget(target: GazeTarget)` - Set target gaze position
- `blink()` - Trigger a manual blink
- `setSpeaking(isSpeaking: boolean)` - Update speaking state
- `setListening(isListening: boolean)` - Update listening state
- `updateConfig(config: Partial<EyeHeadTrackingConfig>)` - Update configuration
- `getState()` - Get current state
- `getSnippets()` - Get animation snippets
- `dispose()` - Clean up and release resources

## Performance Considerations

- Eye movements are fast (50-200ms) and high priority
- Head movements are slower (200-800ms) and slightly lower priority
- Idle variation is throttled to avoid excessive updates
- Submachines run independently for optimal performance
- State changes are batched to minimize re-renders

## Future Enhancements

- Face/object tracking integration
- Vergence (eye convergence for depth)
- Microsaccades during fixation
- Vestibulo-ocular reflex (VOR) simulation
- Attention-based gaze selection
- Emotional modulation of gaze patterns
