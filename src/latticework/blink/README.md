# Blink Agency

A complete implementation of the latticework agency architecture for automatic and manual character blinking.

## Architecture

The blink agency follows the standard latticework pattern with three core components:

### 1. **Machine** ([blinkMachine.ts](blinkMachine.ts))
XState machine that manages blink state:
- Enabled/disabled state
- Frequency (blinks per minute)
- Duration (seconds per blink)
- Intensity (0-1)
- Randomness (0-1 for natural variation)
- Individual eye intensity overrides (for asymmetric blinks)

### 2. **Scheduler** ([blinkScheduler.ts](blinkScheduler.ts))
Handles timing and animation curve generation:
- Automatic blink scheduling based on frequency
- Randomness application for natural timing
- Animation curve building with realistic motion
- Uses AU 43 (Eyes Closed) for synchronized eye blinking
- Natural blink curve: fast close (35%), brief hold (10%), gradual open (55%)

### 3. **Service** ([blinkService.ts](blinkService.ts))
Coordinates machine and scheduler:
- Creates and manages the XState actor
- Integrates with animation service for snippet scheduling
- Provides public API for control
- Manages subscriptions for state updates
- Handles automatic blinking start/stop based on enabled state

## Usage

### Basic Setup

```typescript
import { BlinkService } from './latticework/blink/blinkService';

// Create service with animation host capabilities
const blinkService = new BlinkService({
  scheduleSnippet: (snippet) => animService.schedule(snippet),
  removeSnippet: (name) => animService.remove(name),
});

// Blinking starts automatically by default
```

### Manual Control

```typescript
// Trigger a single blink
blinkService.triggerBlink();

// Trigger with custom parameters
blinkService.triggerBlink(0.8, 0.2); // 80% intensity, 0.2s duration

// Enable/disable automatic blinking
blinkService.enable();
blinkService.disable();

// Adjust parameters
blinkService.setFrequency(20); // 20 blinks per minute
blinkService.setDuration(0.15); // 0.15 seconds
blinkService.setIntensity(0.9); // 90% intensity
blinkService.setRandomness(0.3); // 30% variation

// Reset to defaults
blinkService.reset();
```

### State Subscription

```typescript
const unsubscribe = blinkService.subscribe((state) => {
  console.log('Blink state:', state);
  console.log('Enabled:', state.enabled);
  console.log('Frequency:', state.frequency);
});

// Later: cleanup
unsubscribe();
```

## UI Integration

The [BlinkSection](../../components/au/BlinkSection.tsx) component provides a UI for controlling the blink agency:

- **Toggle**: Enable/disable automatic blinking
- **Manual Trigger**: Button to trigger immediate blink
- **Frequency Slider**: Adjust blinks per minute (0-60)
- **Duration Slider**: Adjust blink duration (0.05-1.0s)
- **Intensity Slider**: Adjust blink strength (0-100%)
- **Randomness Slider**: Adjust natural variation (0-100%)
- **Reset Button**: Return to default settings

## Default Settings

```typescript
{
  enabled: true,
  frequency: 17,        // blinks per minute (typical: 15-20)
  duration: 0.15,       // seconds (typical: 0.1-0.3)
  intensity: 1.0,       // 100%
  randomness: 0.3,      // 30% variation
  leftEyeIntensity: null,  // use default
  rightEyeIntensity: null, // use default
}
```

## Animation Details

### AU 43: Eyes Closed
The blink agency uses Action Unit 43 (Eyes Closed) which controls both eyes simultaneously. This is the standard for synchronized blinking.

### Blink Curve Timing
A natural blink follows this timing pattern:
1. **Fast Close** (35% of duration): Quick downward movement with anticipation
2. **Brief Hold** (10% of duration): Peak closure
3. **Gradual Open** (55% of duration): Slower return with natural deceleration

### Randomness Effects
Randomness affects:
- **Timing**: ±randomness% variation in interval between blinks
- **Intensity**: ±(randomness*30)% variation in blink intensity
- Creates natural, human-like variation

## Integration Points

### Animation Service
The blink agency integrates with the animation service through:
- **scheduleSnippet**: Schedules blink animations as high-priority snippets (priority: 100)
- **removeSnippet**: Cleans up completed blink animations
- **Category**: Snippets are tagged as `'blink'` category

### App Integration
In [App.tsx](../../App.tsx):
```typescript
// Service is created when animation service is ready
useEffect(() => {
  if (!anim) return;

  const service = new BlinkService({
    scheduleSnippet: (snippet) => anim.schedule(snippet),
    removeSnippet: (name) => anim.remove(name),
  });

  setBlinkService(service);

  return () => service.dispose();
}, [anim]);
```

## Future Enhancements

Potential improvements:
1. **Asymmetric Blinks**: Support for independent left/right eye control (winking)
2. **Context-Aware Blinking**: Adjust frequency based on activity (e.g., slower when reading)
3. **Emotional Modulation**: Vary blink patterns based on emotional state
4. **Fatigue Simulation**: Slower, heavier blinks when character is tired
5. **Synchronization**: Coordinate blinks with speech or other animations

## Debug Access

The service is exposed globally for debugging:
```javascript
// In browser console
window.blinkService.triggerBlink();
window.blinkService.getState();
```
