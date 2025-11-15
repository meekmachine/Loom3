# Prosodic Expression Agency

A modular system for managing prosodic gestures during speech (brow raises, head nods) using XState for state management and a scheduler for timing control.

---

## Architecture

The Prosodic Expression Agency follows the **Animation Agency pattern** with three core components:

```
┌─────────────────────────────────────────────────────────┐
│              Prosodic Expression Agency                 │
│                                                         │
│  ┌───────────────────┐                                 │
│  │  ProsodicService  │  ← Public API                   │
│  │  (Factory)        │                                  │
│  └─────────┬─────────┘                                 │
│            │                                            │
│    ┌───────▼─────────┐      ┌─────────────────────┐   │
│    │ ProsodicMachine │◄─────┤ ProsodicScheduler   │   │
│    │   (XState)      │      │  (Timing & Fading)  │   │
│    └─────────────────┘      └──────────┬──────────┘   │
│            │                            │              │
│            │                            │              │
│            ▼                            ▼              │
│     State Management          Animation Service        │
│     (brow/head state)         (schedule/remove)        │
└─────────────────────────────────────────────────────────┘
```

### 1. **ProsodicMachine** (XState)

**File:** [`prosodicMachine.ts`](./prosodicMachine.ts)

State machine managing:
- **States:** `idle`, `speaking`, `fading`
- **Context:** Brow/head snippets, fade progress
- **Events:** `START_SPEAKING`, `STOP_SPEAKING`, `PULSE`, etc.

**State Diagram:**
```
     idle
      │
      │ START_SPEAKING
      ▼
   speaking ◄──────┐
      │            │
      │ STOP_SPEAKING
      ▼            │
   fading          │
      │            │
      │ (fade complete)
      └────────────┘
```

### 2. **ProsodicScheduler**

**File:** [`prosodicScheduler.ts`](./prosodicScheduler.ts)

Manages:
- Snippet scheduling to Animation Service
- Pulse timing (brow every word, head every 2nd word)
- Fade-out sequences (gradual intensity reduction)
- Cleanup and resource management

### 3. **ProsodicService**

**File:** [`prosodicService.ts`](./prosodicService.ts)

Public API factory:
- Creates machine + scheduler
- Loads snippets from localStorage
- Provides simple API: `startTalking()`, `stopTalking()`, `pulse()`
- Handles callbacks

---

## Usage

### Basic Example

```typescript
import { createProsodicService } from './latticework/prosodic';

// Create service
const prosodic = createProsodicService(
  {
    browLoopKey: 'speakingAnimationsList/browRaiseSmall',
    headLoopKey: 'speakingAnimationsList/headNodSmall',
    browPriority: 2,
    headPriority: 2,
    fadeSteps: 4,
    fadeStepInterval: 120,
  },
  {
    onBrowStart: () => console.log('Brow started'),
    onBrowStop: () => console.log('Brow stopped'),
    onHeadStart: () => console.log('Head started'),
    onHeadStop: () => console.log('Head stopped'),
    onPulse: (channel, wordIndex) => console.log(`Pulse: ${channel} @${wordIndex}`),
  }
);

// Start speech
prosodic.startTalking();

// Pulse on word boundaries
let wordIndex = 0;
['Hello', 'world', 'this', 'is', 'a', 'test'].forEach(word => {
  prosodic.pulse(wordIndex++);
});

// Stop speech (with fade)
prosodic.stopTalking();

// Or stop immediately
prosodic.stop();

// Cleanup
prosodic.dispose();
```

### With Animation Service Integration

```typescript
import { createAnimationService } from './latticework/animation';
import { createProsodicService } from './latticework/prosodic';

// Create animation service
const animService = createAnimationService(engine);

// Create prosodic service with host capabilities
const prosodic = createProsodicService(
  {},
  {},
  {
    scheduleSnippet: (snippet) => animService.schedule(snippet),
    removeSnippet: (name) => animService.remove(name),
  }
);

// Use normally
prosodic.startTalking();
```

### Class-Based API (Backward Compatible)

```typescript
import { ProsodicService } from './latticework/prosodic';

const prosodic = new ProsodicService(
  { fadeSteps: 6 },
  { onBrowStart: () => console.log('Started') }
);

prosodic.startTalking();
prosodic.pulse(0);
prosodic.stopTalking();
```

---

## API Reference

### `createProsodicService(config, callbacks, hostCaps)`

Factory function to create a prosodic service.

**Parameters:**

- **config**: `ProsodicConfig` (optional)
  ```typescript
  {
    browLoopKey?: string;         // localStorage key for brow snippet
    headLoopKey?: string;         // localStorage key for head snippet
    browPriority?: number;        // Animation priority (default: 2)
    headPriority?: number;        // Animation priority (default: 2)
    pulsePriority?: number;       // Pulse priority (default: 5)
    defaultIntensity?: number;    // Initial intensity (default: 1.0)
    fadeSteps?: number;           // Fade steps (default: 4)
    fadeStepInterval?: number;    // Fade interval ms (default: 120)
  }
  ```

- **callbacks**: `ProsodicCallbacks` (optional)
  ```typescript
  {
    onBrowStart?: () => void;
    onBrowStop?: () => void;
    onHeadStart?: () => void;
    onHeadStop?: () => void;
    onPulse?: (channel: ProsodicChannel, wordIndex: number) => void;
    onError?: (error: Error) => void;
  }
  ```

- **hostCaps**: `{ scheduleSnippet, removeSnippet }` (optional)
  - Integration with Animation Service
  - Defaults to global `window.anim` if available

**Returns:** `ProsodicServiceAPI`

### ProsodicServiceAPI Methods

#### `startTalking()`
Start prosodic gestures (brow and head loops).

#### `stopTalking()`
Stop with graceful fade-out.

#### `pulse(wordIndex: number)`
Trigger gesture pulse on word boundary.
- Brow: every word
- Head: every 2nd word

#### `stop()`
Stop immediately without fade.

#### `updateConfig(config: Partial<ProsodicConfig>)`
Update configuration dynamically.

#### `getState(): ProsodicState`
Get current state:
```typescript
{
  browStatus: 'idle' | 'active' | 'stopping';
  headStatus: 'idle' | 'active' | 'stopping';
  browIntensity: number;
  headIntensity: number;
  isLooping: boolean;
}
```

#### `dispose()`
Cleanup and release resources.

---

## State Machine Details

### States

- **idle**: No gestures active
- **speaking**: Brow and head loops playing
- **fading**: Gradual intensity reduction in progress

### Events

| Event | Description | Transitions |
|-------|-------------|-------------|
| `START_SPEAKING` | Activate gestures | idle → speaking |
| `STOP_SPEAKING` | Begin fade-out | speaking → fading |
| `PULSE` | Word boundary pulse | (internal) |
| `FADE_BROW_COMPLETE` | Brow fade done | (internal) |
| `FADE_HEAD_COMPLETE` | Head fade done | (internal) |
| `SET_BROW_INTENSITY` | Adjust brow intensity | (internal) |
| `SET_HEAD_INTENSITY` | Adjust head intensity | (internal) |
| `STOP_IMMEDIATE` | Force stop | any → idle |

### Context

```typescript
{
  browSnippet: ProsodicSnippet | null;
  headSnippet: ProsodicSnippet | null;
  isSpeaking: boolean;
  fadeInProgress: {
    brow: boolean;
    head: boolean;
  };
}
```

---

## Scheduler Details

### Responsibilities

1. **Snippet Scheduling**: Convert prosodic snippets to animation format and schedule
2. **Pulse Handling**: Reset snippet timing on word boundaries
3. **Fade Management**: Gradual intensity reduction over multiple steps
4. **Cleanup**: Remove snippets and clear timers

### Fade Sequence

When `stopTalking()` is called:

1. Machine transitions to `fading` state
2. Scheduler creates fade steps (e.g., 4 steps @ 120ms)
3. Each step reduces intensity: `1.0 → 0.75 → 0.5 → 0.25 → 0.0`
4. Final step removes snippet and sends `FADE_COMPLETE` event
5. Machine transitions back to `idle`

---

## Integration with Animation Service

The Prosodic Agency schedules snippets through the Animation Service with:

- **Category**: `'prosodic'`
- **Priority**: Configurable (default: 2)
- **Loop**: Always `true`
- **Intensity**: Dynamically adjusted during fade

**Priority Hierarchy** (higher wins):
- Lip-sync visemes: 50
- Prosodic gestures: 2-5
- Emotional expressions: 1

---

## Testing

```typescript
import { prosodicMachine } from './prosodicMachine';
import { createActor } from 'xstate';

// Test machine directly
const machine = createActor(prosodicMachine).start();

// Load snippets
machine.send({ type: 'LOAD_BROW', data: browData });
machine.send({ type: 'LOAD_HEAD', data: headData });

// Start speaking
machine.send({ type: 'START_SPEAKING' });
console.log(machine.getSnapshot().value); // 'speaking'

// Pulse
machine.send({ type: 'PULSE', wordIndex: 0 });

// Stop
machine.send({ type: 'STOP_SPEAKING' });
console.log(machine.getSnapshot().value); // 'fading'
```

---

## File Structure

```
prosodic/
├── README.md                   ← This file
├── index.ts                    ← Public API exports
├── types.ts                    ← Type definitions
├── prosodicMachine.ts          ← XState machine (state management)
├── prosodicScheduler.ts        ← Scheduler (timing & fading)
└── prosodicService.ts          ← Service factory (public API)
```

---

## Comparison with Animation Agency

| Feature | Animation Agency | Prosodic Agency |
|---------|------------------|-----------------|
| **State Machine** | ✅ `animationMachine.ts` | ✅ `prosodicMachine.ts` |
| **Scheduler** | ✅ `animationScheduler.ts` | ✅ `prosodicScheduler.ts` |
| **Service Factory** | ✅ `createAnimationService()` | ✅ `createProsodicService()` |
| **XState-Based** | ✅ Yes | ✅ Yes |
| **Multiple Channels** | ✅ Many snippets | ✅ 2 channels (brow/head) |
| **Looping** | ✅ Per-snippet | ✅ Always looping |
| **Fade-Out** | ❌ No | ✅ Gradual fade |
| **Pulse Timing** | ❌ No | ✅ Word boundaries |

---

## Future Enhancements

1. **Adaptive Timing**: Adjust pulse frequency based on speech rate
2. **Emotion Modulation**: Vary gesture intensity by emotional state
3. **Multi-Channel**: Add more gesture types (eyebrow furrow, head shake)
4. **Context-Aware**: Different patterns for questions vs. statements
5. **Performance Metrics**: Track pulse timing accuracy

---

## Credits

Based on the Animation Agency architecture pattern established in [`src/latticework/animation/`](../animation/).

**See also:**
- [Animation Agency README](../animation/README.md)
- [Lip-Sync Complete Guide](../../../docs/LIPSYNC_COMPLETE_GUIDE.md)
