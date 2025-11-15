# The Latticework Agency Pattern

This document explains the core architectural pattern used throughout LoomLarge's "Society of Mind" implementation.

## The Trinity Pattern

Every agency in Latticework follows a three-layer architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                           AGENCY                                │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                      SERVICE                            │   │
│  │                  (Public API Layer)                     │   │
│  │                                                         │   │
│  │  - Factory function or class constructor               │   │
│  │  - Only public interface to outside world              │   │
│  │  - Exposes high-level methods (play, pause, etc)       │   │
│  │  - Provides state subscriptions                        │   │
│  │  - Handles configuration and initialization            │   │
│  └────────────────────┬────────────────────────────────────┘   │
│                       │ creates & owns                           │
│                       ▼                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                     MACHINE                             │   │
│  │               (State Management Layer)                  │   │
│  │                                                         │   │
│  │  - XState finite state machine                          │   │
│  │  - Maintains canonical state in context                │   │
│  │  - Handles state transitions via events                │   │
│  │  - Pure functions only (no side effects)               │   │
│  │  - Testable in isolation                               │   │
│  └────────────────────┬────────────────────────────────────┘   │
│                       │ sends events to & reads state from      │
│                       ▼                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    SCHEDULER                            │   │
│  │             (Timing & Execution Layer)                  │   │
│  │                                                         │   │
│  │  - Timing logic (wall-clock, RAF, timers)              │   │
│  │  - Sample curves, interpolate values                   │   │
│  │  - Apply side effects (call host engine)               │   │
│  │  - Handle looping and completion                       │   │
│  │  - Priority resolution when needed                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Why Three Layers?

### Layer 1: Service (Public API)

**Responsibility**: Be the only public interface

**Benefits**:
- Clients never directly access Machine or Scheduler
- Can change implementation without breaking consumers
- Single entry point for configuration and lifecycle
- Can add validation, logging, or preprocessing

**Example**:
```typescript
export function createAnimationService(host: HostCaps): AnimationServiceAPI {
  // Implementation detail: create machine and scheduler
  const machine = createActor(animationMachine).start();
  const scheduler = new AnimationScheduler(machine, host);
  
  // Return ONLY public API
  return {
    play: () => machine.send({ type: 'PLAY_ALL' }),
    pause: () => machine.send({ type: 'PAUSE_ALL' }),
    schedule: (data, opts) => scheduler.schedule(data, opts),
    // ... rest of API
    // Machine and Scheduler are NOT exposed!
  };
}
```

### Layer 2: Machine (State Management)

**Responsibility**: Maintain canonical state, handle transitions

**Benefits**:
- Pure state logic (testable without rendering)
- Deterministic (same input → same output)
- Clear state diagram
- XState tools for visualization/debugging

**Example**:
```typescript
export const animationMachine = createMachine({
  id: 'animationMachine',
  initial: 'stopped',
  
  states: {
    stopped: {
      on: { PLAY_ALL: 'playing' }
    },
    playing: {
      on: { 
        PAUSE_ALL: 'paused',
        STOP_ALL: 'stopped'
      },
      entry: 'startScheduler'
    },
    paused: {
      on: {
        PLAY_ALL: 'playing',
        STOP_ALL: 'stopped'
      }
    }
  },
  
  context: {
    animations: [],
    currentAUs: {},
    currentVisemes: {}
  }
});
```

### Layer 3: Scheduler (Execution)

**Responsibility**: Execute timing logic and apply side effects

**Benefits**:
- Separated from pure state (Machine)
- Can handle complex timing without affecting testability
- Side effects isolated in one place
- Easy to swap implementations (RAF, external frame stepping, etc)

**Example**:
```typescript
export class AnimationScheduler {
  private rafId: number | null = null;
  
  private tick = () => {
    if (!this.playing) return;
    
    // Sample curves at current wall-clock time
    const now = performance.now();
    const targets = this.buildTargetMap(now);
    
    // Apply to host engine (ONLY side effect in scheduler)
    targets.forEach((entry, auId) => {
      this.host.transitionAU(parseInt(auId), entry.v, entry.durMs);
    });
    
    this.rafId = requestAnimationFrame(this.tick);
  };
}
```

## The Four Patterns

LoomLarge uses four variations of this pattern:

### Pattern 1: Full Trinity (Service + Machine + Scheduler)

**Agencies**: Animation, Prosodic

```typescript
// Factory function creates machine and scheduler internally
export function createAnimationService(host) {
  const machine = createActor(animationMachine).start();
  const scheduler = new AnimationScheduler(machine, host);
  return { play, pause, schedule, ... };
}
```

**Characteristics**:
- Rich state management
- Complex timing requirements
- Independent playback of multiple snippets
- Full suite of tests

**When to use**: Complex state, timing-critical operations, multiple concurrent instances

### Pattern 2: Service + Utilities (No Machine)

**Agencies**: LipSync

```typescript
export class LipSyncService {
  private phonemeExtractor = phonemeExtractor;  // Pure utility
  private visemeMapper = visemeMapper;          // Pure utility
  
  extractVisemeTimeline(text: string) {
    const phonemes = this.phonemeExtractor.extractPhonemes(text);
    return this.visemeMapper.mapToVisemes(phonemes);
  }
}
```

**Characteristics**:
- Deterministic transformation (text → visemes)
- No complex state needed
- Delegates animation timing to Animation Service

**When to use**: Stateless utilities, deterministic transformations

### Pattern 3: Service Only (Web API as State)

**Agencies**: TTS, Transcription

```typescript
export class TTSService {
  private synthesis: SpeechSynthesis;  // Web API is the state source
  
  async speak(text: string) {
    const utterance = new SpeechSynthesisUtterance(text);
    this.synthesis.speak(utterance);
  }
}
```

**Characteristics**:
- Web API (Web Speech, etc) manages state
- No need for explicit Machine
- Simple callbacks for events

**When to use**: Wrapping browser APIs, simple callback-based logic

### Pattern 4: Orchestrator (No own Machine/Scheduler)

**Agencies**: Conversation

```typescript
export class ConversationService {
  constructor(
    tts: TTSService,
    transcription: TranscriptionService,
    eyeHeadTracking: EyeHeadTrackingService
  ) {
    // Compose other services
  }
  
  start(flowGenerator) {
    // Coordinate services for dialogue flow
  }
}
```

**Characteristics**:
- Higher-level coordination
- Composes other services
- Handles workflow, not rendering

**When to use**: Workflow orchestration, coordinating multiple services

## Communication Between Agencies

### The Rule: Use Public APIs Only

```typescript
// WRONG: Direct machine access
const anim = createAnimationService(host);
anim.machine.send({ type: 'LOAD_ANIMATION', ... });  // ❌

// RIGHT: Via public API
anim.schedule(snippet);  // ✅
```

### Why This Matters

1. **Encapsulation**: Implementation can change without breaking consumers
2. **Versioning**: Can deprecate internal details independently
3. **Testing**: Can mock/stub the public API
4. **Clarity**: Clear contracts between agencies

### Example: Prosodic Using Animation

```typescript
// Prosodic Service receives Animation Service as dependency
export class ProsodicService {
  constructor(
    machine: Actor<typeof prosodicMachine>,
    scheduler: ProsodicScheduler,
    // Key: receives PUBLIC service, not private internals
    private animationService: ReturnType<typeof createAnimationService>
  ) {}
  
  private scheduleSnippet(snippet: any) {
    // Use ONLY public API
    const name = this.animationService.schedule(snippet);
    return name;
  }
}
```

## Creating a New Agency

Follow these steps to create a new agency following the pattern:

### 1. Identify State

What state does this agency track?

```typescript
interface MyAgencyContext {
  isActive: boolean;
  currentValue: number;
  // ... more fields
}

type MyAgencyEvent = 
  | { type: 'ACTIVATE' }
  | { type: 'DEACTIVATE' }
  | { type: 'SET_VALUE'; value: number };
```

### 2. Create Machine

Define state transitions:

```typescript
// src/latticework/myagency/myAgencyMachine.ts
export const myAgencyMachine = createMachine({
  id: 'myAgencyMachine',
  initial: 'idle',
  
  states: {
    idle: { on: { ACTIVATE: 'active' } },
    active: { on: { DEACTIVATE: 'idle' } }
  },
  
  context: {
    isActive: false,
    currentValue: 0
  }
});
```

### 3. Create Scheduler (if needed)

Handle timing and side effects:

```typescript
// src/latticework/myagency/myAgencyScheduler.ts
export class MyAgencyScheduler {
  constructor(machine: any, host: HostCaps) {
    this.machine = machine;
    this.host = host;
  }
  
  update() {
    // Apply side effects based on machine state
  }
}
```

### 4. Create Service

Expose public API:

```typescript
// src/latticework/myagency/myAgencyService.ts
export function createMyAgencyService(
  config: MyAgencyConfig,
  callbacks: MyAgencyCallbacks
): MyAgencyServiceAPI {
  const machine = createActor(myAgencyMachine).start();
  const scheduler = new MyAgencyScheduler(machine, config);
  
  return {
    activate: () => machine.send({ type: 'ACTIVATE' }),
    deactivate: () => machine.send({ type: 'DEACTIVATE' }),
    setValue: (value) => machine.send({ type: 'SET_VALUE', value }),
    getState: () => machine.getSnapshot(),
    dispose: () => {
      machine.stop();
      scheduler.cleanup();
    }
  };
}
```

### 5. Add Tests

Test each layer:

```typescript
// src/latticework/myagency/__tests__/myAgencyMachine.test.ts
describe('myAgencyMachine', () => {
  it('should transition from idle to active', () => {
    const actor = createActor(myAgencyMachine).start();
    actor.send({ type: 'ACTIVATE' });
    expect(actor.getSnapshot().value).toBe('active');
  });
});

// src/latticework/myagency/__tests__/myAgencyService.test.ts
describe('myAgencyService', () => {
  it('should activate via API', () => {
    const service = createMyAgencyService({}, {});
    service.activate();
    expect(service.getState().value).toBe('active');
  });
});
```

### 6. Add Documentation

Document the agency:

```typescript
// src/latticework/myagency/README.md
# My Agency

A brief description of what this agency does.

## Architecture

Follows the Latticework three-layer pattern:
- **Service**: Public API
- **Machine**: State management
- **Scheduler**: Timing and execution

## Usage

```typescript
import { createMyAgencyService } from '@/latticework/myagency';

const myAgency = createMyAgencyService(config, callbacks);
myAgency.activate();
```

## State Diagram

```
idle ──ACTIVATE──> active
  ▲                 │
  └────DEACTIVATE──┘
```
```

## Best Practices

1. **Encapsulation**: Never expose Machine or Scheduler from Service
2. **Pure Functions**: Keep Machine pure (no side effects)
3. **Side Effects**: Only in Scheduler, never in Machine
4. **Testing**: Test each layer independently
5. **Documentation**: Document state transitions and API
6. **Composition**: Accept other services as dependencies via public APIs
7. **Cleanup**: Provide `dispose()` method for cleanup

## Anti-Patterns to Avoid

### Anti-Pattern 1: Exposing Internal State

```typescript
// WRONG
export function createMyAgencyService() {
  const machine = createActor(...).start();
  return { machine, play, pause };  // ❌ Exposes machine!
}

// RIGHT
export function createMyAgencyService() {
  const machine = createActor(...).start();
  return { play, pause };  // ✅ Only expose public API
}
```

### Anti-Pattern 2: Side Effects in Machine

```typescript
// WRONG
export const myMachine = createMachine({
  entry: () => {
    fetch('/api/data');  // ❌ Side effect in machine!
  }
});

// RIGHT
export class MyScheduler {
  update() {
    fetch('/api/data');  // ✅ Side effect in scheduler
  }
}
```

### Anti-Pattern 3: Machine Knows About Host

```typescript
// WRONG
export const myMachine = createMachine({
  entry: (ctx, event) => {
    // ❌ Machine depends on host engine
    host.setAU(1, 0.5);
  }
});

// RIGHT
export class MyScheduler {
  update() {
    // ✅ Scheduler handles host interaction
    this.host.setAU(1, 0.5);
  }
}
```

### Anti-Pattern 4: Direct Machine Access Between Agencies

```typescript
// WRONG
const anim = createAnimationService(...);
const prosodic = createProsodicService();
prosodic.sendToAnimation = (event) => {
  anim.machine.send(event);  // ❌ Bypasses public API
};

// RIGHT
const prosodic = createProsodicService({}, {}, {
  scheduleSnippet: (snippet) => anim.schedule(snippet)  // ✅ Via public API
});
```

## Summary

The Latticework pattern provides:
- Clear separation of concerns (Service/Machine/Scheduler)
- Testability (each layer independent)
- Composability (agencies use public APIs)
- Determinism (XState machines)
- Extensibility (can add new agencies without changing others)

Follow this pattern for new agencies to maintain consistency and architectural coherence.

