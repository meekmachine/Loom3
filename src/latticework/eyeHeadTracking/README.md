# Eye and Head Tracking Agency

Coordinates eye and head movements that naturally follow mouth animations and speech patterns.

## Architecture

- **Single controller + scheduler**: `EyeHeadTrackingService` now talks directly to `EyeHeadTrackingScheduler`, which generates the exact AU curves that get scheduled through the animation agency (no more per-axis XState machines).
- **Shared animation agency**: Every gaze change results in snippets named `eyeHeadTracking/eyeYaw`, `eyePitch`, `headYaw`, `headPitch`, and `headRoll`, so you can play and inspect the same snippets directly from the snippets library UI.
- **Head lag logic**: Head motion reuses the existing follow-delay concept, but it’s implemented inside the service (eyes move immediately, head schedules its own delayed snippet).
- **Blinking handled elsewhere**: Automatic blinking moved to the dedicated `BlinkService`; this agency focuses purely on gaze and head pose.
- **Blend weights**: Eye/head morph↔bone blend controls are exposed in the UI and forwarded to `engine.setAUMixWeight(...)` so bones always move, with morph overlays matched to the slider.

## Features

- **Coordinated Eye-Head Movement**: Head automatically follows eye gaze with configurable delay.
- **Configurable Lag**: Eyes can react instantly while the head eases into the same pose after a delay.
- **Idle Variation**: Subtle random movements when not actively tracking.
- **Speech Coordination**: Reduces idle variation during speech.
- **Listener Mode**: Can look at imaginary speaker position.
- **High Priority**: Eye/head movements override prosodic and lip-sync animations.
- **Blend Control**: UI exposes morph ↔ bone mix for both eyes and head (hooked to `engine.setAUMixWeight`).

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

// Eyes move immediately; head follows after the configured delay (if enabled)
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

## Integration with Animation Agency

The Eye and Head Tracking Agency supports two operational modes:

### 1. Animation Agency Mode (Scheduler-Based)

Uses the animation agency for full animation curve scheduling with priority blending:

```typescript
import { createEyeHeadTrackingService } from '@/latticework/eyeHeadTracking';
import { createAnimationService } from '@/latticework/animation';

const anim = createAnimationService(engine);

const eyeHeadTracking = createEyeHeadTrackingService({
  eyeTrackingEnabled: true,
  headTrackingEnabled: true,
  animationAgency: anim, // Use animation agency for scheduling
}, callbacks);

// Gaze changes create animation snippets that blend with other animations
eyeHeadTracking.setGazeTarget({ x: 0.5, y: 0.2 });

// Priority hierarchy (from Animation Agency):
// - Eye/Head Tracking: Priority 15-20 (highest)
// - LipSync Visemes: Priority 10
// - Prosodic Pulses: Priority 5
// - Emotion/Expression: Priority 0-5 (baseline)
```

**How it works:**
- Scheduler creates directional animation snippets using real ARKit AU IDs (61-64, 31-33, 54-56)
- Animation agency blends eye/head movements with lip-sync and expressions
- Smooth transitions between gaze targets using animation curves
- See [ANIMATION_APPROACH.md](ANIMATION_APPROACH.md) for technical details

### 2. Direct Composite Mode (Engine-Based)

Uses direct composite method calls for immediate AU application:

```typescript
const eyeHeadTracking = createEyeHeadTrackingService({
  eyeTrackingEnabled: true,
  headTrackingEnabled: true,
  engine: engine, // Use engine for direct composite calls
}, callbacks);

// Gaze changes apply directly to engine via applyEyeComposite/applyHeadComposite
eyeHeadTracking.setGazeTarget({ x: 0.5, y: 0.2 });
```

**When to use:**
- Real-time interactive tracking (mouse, webcam)
- Lower latency requirements
- Simpler integration without animation agency

**Note:** Both modes use the same composite AU architecture (morphs + bones), just different scheduling mechanisms.

## Runtime Status Flags

The service maintains simple status flags instead of separate state machines:

- `eyeStatus`: `'idle' | 'tracking' | 'lagging'`
- `headStatus`: `'idle' | 'tracking' | 'lagging'`
- `headFollowTimer`: tracks the pending timeout when `headFollowEyes` and `headFollowDelay` are enabled.

These flags are surfaced via `getState()` and useful for UI/debug overlays (e.g., highlighting when the head is intentionally lagging behind the eyes).

## Action Units (AUs)

The agency controls the following ARKit blendshapes via AUs:

### Eye AUs (Priority: 20)
- **61-64**: Both eyes (look left/right/up/down)
- **65-68**: Left eye individual (look left/right/up/down)
- **69-72**: Right eye individual (look left/right/up/down)
- **43**: Blink *(handled by BlinkService snippets)*
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

## Input Modes

The agency supports multiple input modes for gaze control:

### Manual Mode

Direct programmatic control via `setGazeTarget()`:

```typescript
eyeHeadTracking.setMode('manual');
eyeHeadTracking.setGazeTarget({ x: 0.5, y: 0.2 });
```

### Mouse Tracking Mode

Character follows mouse cursor position:

```typescript
eyeHeadTracking.setMode('mouse');
// Character now automatically tracks mouse movements
```

**Coordinate processing:**
- X and Y are both negated for mirror behavior
- Mouse left → character looks right (at the user)
- Natural interaction like looking at someone across from you

### Webcam Tracking Mode

Character follows user's face position from webcam:

```typescript
eyeHeadTracking.setMode('webcam');
eyeHeadTracking.setWebcamTracking(webcamInstance);
```

**Coordinate processing:**
- **X is NOT negated** (webcam feed is already mirrored by camera hardware)
- **Y is negated** (to flip from top-down to standard coordinates)
- Natural interaction where moving left makes character look at you on the left

**Critical difference:** Webcam feeds are pre-mirrored by camera hardware, so only Y needs negation. See [ANIMATION_APPROACH.md](ANIMATION_APPROACH.md) for details.

## Future Enhancements

- Vergence (eye convergence for depth)
- Microsaccades during fixation
- Vestibulo-ocular reflex (VOR) simulation
- Attention-based gaze selection
- Emotional modulation of gaze patterns
