# Animation Agency Architecture V2

## Design Principle: Snippets as Independent Actors

**Core Idea**: Each snippet is a spawned XState actor (sub-machine) with its own state, completely independent from others.

---

## Why Remove Global Play/Pause?

**Problem with Global Control**:
```typescript
// ❌ OLD DESIGN: Global state causes conflicts
service.play();  // Starts ALL snippets
service.setSnippetPlaying('s1', false);  // Pause one snippet
// But global state says "playing" - confusing!
```

**Better Design - No Global State**:
```typescript
// ✓ NEW DESIGN: Each snippet controls itself
service.playSnippet('s1');   // Only s1 plays
service.playSnippet('s2');   // Only s2 plays
service.pauseSnippet('s1');  // Only s1 pauses, s2 continues
```

---

## New Architecture: Actor Model

### Layer 1: Snippet Actor (Sub-Machine)

Each snippet is a spawned actor with its own state:

```typescript
// snippetMachine.ts
import { setup } from 'xstate';

export const snippetMachine = setup({
  types: {
    context: {} as SnippetContext,
    events: {} as SnippetEvent,
    input: {} as SnippetInput
  }
}).createMachine({
  id: 'snippet',
  initial: 'paused',

  context: ({ input }) => ({
    name: input.name,
    curves: input.curves,
    loop: input.loop ?? false,
    playbackRate: input.playbackRate ?? 1,
    intensityScale: input.intensityScale ?? 1,
    category: input.category ?? 'default',
    priority: input.priority ?? 0,
    currentTime: 0,
    startWallTime: 0,
    duration: calculateDuration(input.curves)
  }),

  states: {
    paused: {
      on: {
        PLAY: {
          target: 'playing',
          actions: 'anchorWallClock'
        },
        SEEK: {
          actions: 'updateCurrentTime'
        },
        UPDATE_RATE: {
          actions: 'updatePlaybackRate'
        },
        UPDATE_INTENSITY: {
          actions: 'updateIntensityScale'
        }
      }
    },

    playing: {
      entry: 'anchorWallClock',

      on: {
        PAUSE: {
          target: 'paused',
          actions: 'freezeCurrentTime'
        },
        TICK: {
          actions: 'updateCurrentTimeFromWallClock'
        },
        COMPLETED: {
          target: 'paused',
          actions: 'notifyCompletion',
          guard: 'isNonLooping'
        },
        UPDATE_RATE: {
          actions: ['updatePlaybackRate', 'reanchorWallClock']
        },
        UPDATE_INTENSITY: {
          actions: 'updateIntensityScale'
        }
      }
    }
  }
});

// Actions
const actions = {
  anchorWallClock: assign({
    startWallTime: ({ context }) => {
      const now = performance.now();
      const rate = context.playbackRate;
      // Anchor so current position is maintained
      return now - (context.currentTime / rate) * 1000;
    }
  }),

  freezeCurrentTime: assign({
    currentTime: ({ context }) => {
      // Capture position from wall-clock before pausing
      const now = performance.now();
      const rate = context.playbackRate;
      let local = ((now - context.startWallTime) / 1000) * rate;

      // Handle looping/clamping
      if (context.loop && context.duration > 0) {
        local = ((local % context.duration) + context.duration) % context.duration;
      } else {
        local = Math.min(context.duration, Math.max(0, local));
      }

      return local;
    }
  }),

  updateCurrentTimeFromWallClock: assign({
    currentTime: ({ context }) => {
      const now = performance.now();
      const rate = context.playbackRate;
      let local = ((now - context.startWallTime) / 1000) * rate;

      if (context.loop && context.duration > 0) {
        local = ((local % context.duration) + context.duration) % context.duration;
      } else {
        local = Math.min(context.duration, Math.max(0, local));
      }

      return local;
    }
  }),

  updatePlaybackRate: assign({
    playbackRate: ({ event }) => event.rate
  }),

  reanchorWallClock: assign({
    startWallTime: ({ context }) => {
      const now = performance.now();
      return now - (context.currentTime / context.playbackRate) * 1000;
    }
  })
};
```

### Layer 2: Parent Machine (Manages Snippet Actors)

```typescript
// animationMachine.ts
import { setup, spawn } from 'xstate';
import { snippetMachine } from './snippetMachine';

export const animationMachine = setup({
  types: {
    context: {} as AnimContext,
    events: {} as AnimEvent
  }
}).createMachine({
  id: 'animation',
  initial: 'active',

  context: {
    snippetActors: new Map<string, ActorRef>(),
    engine: null  // Injected EngineThree reference
  },

  states: {
    active: {
      on: {
        LOAD_SNIPPET: {
          actions: 'spawnSnippetActor'
        },
        REMOVE_SNIPPET: {
          actions: 'stopSnippetActor'
        },
        PLAY_SNIPPET: {
          actions: 'sendPlayToSnippet'
        },
        PAUSE_SNIPPET: {
          actions: 'sendPauseToSnippet'
        },
        UPDATE_SNIPPET_RATE: {
          actions: 'sendUpdateRateToSnippet'
        },
        UPDATE_SNIPPET_INTENSITY: {
          actions: 'sendUpdateIntensityToSnippet'
        }
      }
    }
  }
});

const actions = {
  spawnSnippetActor: assign({
    snippetActors: ({ context, event }) => {
      if (event.type !== 'LOAD_SNIPPET') return context.snippetActors;

      const actor = spawn(snippetMachine, {
        input: event.data,
        id: event.data.name
      });

      const newMap = new Map(context.snippetActors);
      newMap.set(event.data.name, actor);
      return newMap;
    }
  }),

  stopSnippetActor: assign({
    snippetActors: ({ context, event }) => {
      if (event.type !== 'REMOVE_SNIPPET') return context.snippetActors;

      const actor = context.snippetActors.get(event.name);
      if (actor) {
        actor.stop();
      }

      const newMap = new Map(context.snippetActors);
      newMap.delete(event.name);
      return newMap;
    }
  }),

  sendPlayToSnippet: ({ context, event }) => {
    if (event.type !== 'PLAY_SNIPPET') return;
    const actor = context.snippetActors.get(event.name);
    if (actor) {
      actor.send({ type: 'PLAY' });
    }
  },

  sendPauseToSnippet: ({ context, event }) => {
    if (event.type !== 'PAUSE_SNIPPET') return;
    const actor = context.snippetActors.get(event.name);
    if (actor) {
      actor.send({ type: 'PAUSE' });
    }
  }
};
```

### Layer 3: Scheduler (Collects from All Actors)

```typescript
// animationScheduler.ts
export class AnimationScheduler {
  constructor(
    private machine: any,  // Parent machine
    private engine: Engine  // EngineThree
  ) {}

  step(dtSec: number) {
    const actors = this.getSnippetActors();

    // Each actor independently decides its current time
    actors.forEach(actor => {
      const state = actor.getSnapshot();

      if (state.value === 'playing') {
        // Send TICK to update currentTime
        actor.send({ type: 'TICK' });
      }
    });

    // Build target map from all actors
    const targets = this.buildTargetMap(actors);

    // Apply to engine
    targets.forEach((entry, auId) => {
      this.engine.transitionAU(
        parseInt(auId, 10),
        entry.value,
        entry.durationMs
      );
    });
  }

  private buildTargetMap(actors: ActorRef[]) {
    const targets = new Map<string, { value: number; priority: number; durationMs: number }>();

    actors.forEach(actor => {
      const state = actor.getSnapshot();
      const ctx = state.context;

      // Only include if playing (or if we're flushing for scrubbing)
      if (state.value !== 'playing' && !this.isFlushing) {
        return;
      }

      // Use frozen currentTime for paused, wall-clock for playing
      const local = state.value === 'paused'
        ? ctx.currentTime
        : ctx.currentTime;  // Already updated by TICK action

      // Sample curves at local time
      for (const [curveId, curve] of Object.entries(ctx.curves)) {
        const rawValue = this.sampleCurve(curve, local);
        const scaled = rawValue * ctx.intensityScale;
        const value = clamp01(scaled);

        // Priority resolution
        const prev = targets.get(curveId);
        if (!prev || ctx.priority > prev.priority ||
            (ctx.priority === prev.priority && value > prev.value)) {

          // Calculate duration to next keyframe
          const nextKfTime = this.findNextKeyframe(curve, local);
          const timeToNext = (nextKfTime - local) / ctx.playbackRate;
          const durationMs = Math.max(50, Math.min(1000, timeToNext * 1000));

          targets.set(curveId, {
            value,
            priority: ctx.priority,
            durationMs
          });
        }
      }
    });

    return targets;
  }

  private getSnippetActors(): ActorRef[] {
    const state = this.machine.getSnapshot();
    return Array.from(state.context.snippetActors.values());
  }
}
```

### Layer 4: Service API (Simplified)

```typescript
// animationService.ts
export function createAnimationService(engine: Engine) {
  const machine = createActor(animationMachine, {
    input: { engine }
  }).start();

  const scheduler = new AnimationScheduler(machine, engine);

  return {
    // Load snippet - spawns new actor
    loadSnippet(data: Snippet) {
      const name = data.name ?? `snippet_${Date.now()}`;
      machine.send({
        type: 'LOAD_SNIPPET',
        data: { ...data, name }
      });
      return name;
    },

    // Remove snippet - stops actor
    removeSnippet(name: string) {
      machine.send({ type: 'REMOVE_SNIPPET', name });
    },

    // Play individual snippet
    playSnippet(name: string) {
      machine.send({ type: 'PLAY_SNIPPET', name });
    },

    // Pause individual snippet
    pauseSnippet(name: string) {
      machine.send({ type: 'PAUSE_SNIPPET', name });
    },

    // Update snippet parameters
    setSnippetPlaybackRate(name: string, rate: number) {
      machine.send({ type: 'UPDATE_SNIPPET_RATE', name, rate });
    },

    setSnippetIntensityScale(name: string, scale: number) {
      machine.send({ type: 'UPDATE_SNIPPET_INTENSITY', name, scale });
    },

    seekSnippet(name: string, time: number) {
      machine.send({ type: 'SEEK_SNIPPET', name, time });
    },

    // External frame step
    step(dt: number) {
      scheduler.step(dt);
    },

    // Get all snippet states for UI
    getSnippets() {
      const state = machine.getSnapshot();
      return Array.from(state.context.snippetActors.entries()).map(([name, actor]) => {
        const snippetState = actor.getSnapshot();
        return {
          name,
          ...snippetState.context,
          isPlaying: snippetState.value === 'playing'
        };
      });
    },

    // Subscribe to changes
    onTransition(callback: (state: any) => void) {
      return machine.subscribe(callback);
    }
  };
}
```

---

## Benefits of Actor Model

### 1. **True Independence**
Each snippet is a separate actor with its own:
- State machine (paused/playing)
- Context (currentTime, playbackRate, etc.)
- Wall-clock anchor
- Event queue

### 2. **No Global State Conflicts**
```typescript
// ❌ OLD: Global state causes issues
service.play();  // What does this mean for 10 snippets?
service.pause(); // Does it pause ALL? Some?

// ✓ NEW: Crystal clear
service.playSnippet('s1');
service.pauseSnippet('s2');
// s1 plays, s2 pauses, no ambiguity
```

### 3. **Simpler State Management**
```typescript
// Each snippet's state is simple:
type SnippetState = 'paused' | 'playing';

// No need for:
// - isPlaying per snippet in shared context
// - Global playing state that conflicts with per-snippet state
// - Complex synchronization logic
```

### 4. **Actor Lifecycle**
```typescript
// Spawn when loaded
const actor = spawn(snippetMachine, { input: snippetData });

// Stop when removed
actor.stop();  // Cleans up automatically

// No memory leaks - XState handles cleanup
```

### 5. **Easier Testing**
```typescript
// Test individual snippet machine in isolation
const snippetActor = createActor(snippetMachine, {
  input: { name: 's1', curves: {...} }
});

snippetActor.start();
snippetActor.send({ type: 'PLAY' });
expect(snippetActor.getSnapshot().value).toBe('playing');

snippetActor.send({ type: 'PAUSE' });
expect(snippetActor.getSnapshot().value).toBe('paused');
```

---

## Migration Path

### Phase 1: Create Snippet Machine
- [ ] Define snippet machine with paused/playing states
- [ ] Implement wall-clock anchoring actions
- [ ] Test snippet machine in isolation

### Phase 2: Update Parent Machine
- [ ] Add actor spawning logic
- [ ] Remove global PLAY_ALL/PAUSE_ALL events
- [ ] Add PLAY_SNIPPET/PAUSE_SNIPPET events

### Phase 3: Update Scheduler
- [ ] Iterate over spawned actors instead of context.animations
- [ ] Use actor.getSnapshot() to read state
- [ ] Send TICK events to playing actors

### Phase 4: Update Service API
- [ ] Replace global play()/pause() with playSnippet()/pauseSnippet()
- [ ] Update getSnippets() to iterate over actors
- [ ] Update parameter setters to send events to actors

### Phase 5: Update Tests
- [ ] Remove global play/pause tests
- [ ] Add per-snippet control tests
- [ ] Add actor lifecycle tests

---

## Type Improvements

```typescript
// types.ts

/**
 * Engine interface - replaces old HostCaps
 * Represents the 3D rendering engine (EngineThree)
 */
export interface Engine {
  /** Apply AU value immediately (no transition) */
  applyAU: (id: number | string, value: number) => void;

  /** Apply morph value immediately (no transition) */
  setMorph: (name: string, value: number) => void;

  /** Transition AU value over duration (smooth) */
  transitionAU?: (id: number | string, value: number, durationMs?: number) => void;

  /** Transition morph value over duration (smooth) */
  transitionMorph?: (name: string, value: number, durationMs?: number) => void;

  /** Callback when non-looping snippet completes */
  onSnippetEnd?: (name: string) => void;
}

/**
 * Snippet context - lives inside each actor
 */
export interface SnippetContext {
  name: string;
  curves: CurvesMap;
  loop: boolean;
  playbackRate: number;
  intensityScale: number;
  category: 'au' | 'viseme' | 'default';
  priority: number;
  currentTime: number;
  startWallTime: number;
  duration: number;
}

/**
 * Snippet events - sent to individual actors
 */
export type SnippetEvent =
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'TICK' }
  | { type: 'SEEK'; time: number }
  | { type: 'UPDATE_RATE'; rate: number }
  | { type: 'UPDATE_INTENSITY'; scale: number }
  | { type: 'COMPLETED' };

/**
 * Parent machine events - manages actors
 */
export type AnimEvent =
  | { type: 'LOAD_SNIPPET'; data: Snippet }
  | { type: 'REMOVE_SNIPPET'; name: string }
  | { type: 'PLAY_SNIPPET'; name: string }
  | { type: 'PAUSE_SNIPPET'; name: string }
  | { type: 'UPDATE_SNIPPET_RATE'; name: string; rate: number }
  | { type: 'UPDATE_SNIPPET_INTENSITY'; name: string; scale: number }
  | { type: 'SEEK_SNIPPET'; name: string; time: number };
```

---

## Questions?

**Q: Does this fix the pause/resume bug?**
A: Yes! Each actor's `freezeCurrentTime` action captures from wall-clock before pausing, and `anchorWallClock` restores it when resuming.

**Q: Does this fix the rate change bug?**
A: Yes! The `reanchorWallClock` action recalculates startWallTime after rate changes, keeping position stable.

**Q: Can multiple snippets still conflict?**
A: Yes, but it's cleaner - the scheduler collects all actor states and resolves via priority, just like before.

**Q: Performance impact?**
A: Minimal - spawning actors is lightweight, and iteration is the same cost as before.
