# Animation Agency

A modular, state-driven system for loading, scheduling, and controlling facial animations via Action Units (AUs) and visemes. Built on XState for predictable state management and designed for concurrent snippet playback with independent timelines.

---

## Architecture Philosophy

The Animation Agency follows the **Latticework Agency Pattern**: a three-layer architecture that separates concerns for maintainability, testability, and concurrent operation.

### Why Three Files?

Each agency in Latticework consists of three core components:

1. **Service** - The public API layer
2. **Machine** - State management and lifecycle
3. **Scheduler** - Timing, priority, and execution

This separation enables:
- **Parallel Operation**: Multiple instances (snippets) can run concurrently with independent state
- **Clear Contracts**: Other agencies interact only with the Service API, never directly with internal state
- **Testability**: Each layer can be tested in isolation
- **State Predictability**: XState machine provides deterministic state transitions

---

## Layer 1: Service ([animationService.ts](animationService.ts))

**Purpose**: The public API that other agencies and UI components use to interact with animations.

**Responsibilities**:
- Load animations from localStorage or JSON
- Control playback (play/pause/stop)
- Manage per-snippet parameters (playback rate, intensity, priority, looping)
- Provide state subscription for UI updates
- Preload bundled snippet libraries

**Key Methods**:
```typescript
// Loading
loadFromLocal(key: string, category?, priority?) → snippet name
loadFromJSON(data: any) → snippet name
schedule(data: any, opts?: ScheduleOpts) → snippet name
remove(name: string)

// Playback control
play(), pause(), stop()
setSnippetPlaying(name: string, playing: boolean)
setSnippetLoop(name: string, loop: boolean)

// Tuning
setSnippetPlaybackRate(name: string, rate: number)
setSnippetIntensityScale(name: string, scale: number)
setSnippetPriority(name: string, priority: number)
setSnippetTime(name: string, timeSec: number)

// State observation
onTransition(callback) → unsubscribe function
getState() → machine snapshot
```

**Design Pattern**: Singleton service wrapping a machine actor and scheduler. The service owns the lifecycle and delegates to the scheduler for execution.

---

## Layer 2: Machine ([animationMachine.ts](animationMachine.ts))

**Purpose**: Maintain the canonical state of all loaded animations and their parameters.

**Responsibilities**:
- Track all loaded snippets with their curves, loop settings, and metadata
- Handle state transitions (stopped ↔ playing ↔ paused)
- Normalize incoming snippet data (handle multiple formats)
- Maintain wall-clock anchors for independent snippet timelines
- Provide state snapshots for UI and scheduler

**State Chart**:
```
┌─────────┐  PLAY_ALL   ┌─────────┐  PAUSE_ALL  ┌────────┐
│ stopped │────────────→│ playing │────────────→│ paused │
└─────────┘             └─────────┘             └────────┘
     ↑                       │                        │
     └───────────────────────┴────────────────────────┘
                       STOP_ALL
```

**Context Structure**:
```typescript
{
  animations: Array<{
    name: string
    curves: Record<string, Array<{time: number, intensity: number}>>
    isPlaying: boolean
    loop: boolean
    snippetPlaybackRate: number
    snippetIntensityScale: number
    snippetCategory: string
    snippetPriority: number
    currentTime: number
    startWallTime: number  // ms timestamp for wall-clock anchoring
    cursor: Record<string, number>
  }>
  currentAUs: Record<string, number>
  currentVisemes: Record<string, number>
  manualOverrides: Record<string, number>
  scheduledTransitions: string[]
}
```

**Key Events**:
- `LOAD_ANIMATION` - Add a new snippet (paused or playing depending on state)
- `REMOVE_ANIMATION` - Remove a snippet by name
- `PLAY_ALL`, `PAUSE_ALL`, `STOP_ALL` - Global playback control
- `CURVE_CHANGED` - Update keyframes for live editing
- `MANUAL_SET`, `MANUAL_CLEAR` - Override values for UI control

**Wall-Clock Anchoring**: Each snippet stores `startWallTime` (a `performance.now()` timestamp) to calculate its independent local time. This allows:
- Concurrent snippets with different playback rates
- Scrubbing without affecting other snippets
- Pause/resume without timeline drift

**Automatic Duration Calculation**: The `duration` field is automatically calculated from keyframes by finding the latest keyframe time across all curves. This replaces the old hardcoded 5-second limit and ensures snippets play for their natural length.

---

## Layer 3: Scheduler ([animationScheduler.ts](animationScheduler.ts))

**Purpose**: Execute animations by sampling curves and applying values to the facial engine at the correct times.

**Responsibilities**:
- Sample curve keyframes based on wall-clock time
- Resolve priority conflicts (highest priority wins, ties broken by highest value)
- Call `transitionAU` or `applyAU` on the host engine
- Handle looping and snippet completion
- Support external frame-based stepping (for synchronized rendering)

**Execution Flow**:
```
step(dt) or RAF tick
  ↓
Calculate current wall time
  ↓
For each snippet:
  - Calculate local time from startWallTime and playbackRate
  - Handle looping or clamping
  - Sample all curves at local time
  - Apply logarithmic intensity scale (scale^2 multiplier)
  ↓
Build target map (resolve priority conflicts)
  ↓
Apply transitions to EngineThree
```

**Intensity Scaling** (Logarithmic):
The intensity scale uses quadratic scaling (`scale^2`) for better control:
- `scale = 0.0` → `0.00x` (silent, no animation)
- `scale = 0.5` → `0.25x` (very subtle)
- `scale = 0.75` → `0.56x` (half intensity, approx)
- `scale = 1.0` → `1.00x` (neutral, original values)
- `scale = 1.5` → `2.25x` (amplified)
- `scale = 2.0` → `4.00x` (4x amplification)

This gives finer control at low intensities (where linear scaling would make small adjustments too coarse) and smooth amplification at high intensities.

**Priority Resolution**:
When multiple snippets control the same AU:
1. Higher priority wins
2. If priorities are equal, higher value wins
3. Duration to next keyframe determines tween smoothness (50-1000ms)

**Timing Models**:
- **Wall-Clock Anchoring** (default): Each snippet's local time = `((now - startWallTime) / 1000) * playbackRate`
- **External Stepping**: Optional frame-based time accumulation for render-loop synchronization

**Key Methods**:
```typescript
schedule(data, opts?: {priority, offsetSec, startInSec, startAtSec})
play(), pause(), stop()
seek(name: string, offsetSec: number)
enable(name: string, enabled: boolean)
flushOnce() // Force immediate sample (for scrubbing)
step(dtSec: number) // External frame step
getScheduleSnapshot() // Introspection for UI
```

---

## Integration with EngineThree

The Animation Agency does **not** own transitions — it delegates to [EngineThree](../../engine/EngineThree.ts):

```typescript
// Scheduler calls EngineThree for each AU
host.transitionAU(auId: number, value: number, durationMs: number)
host.transitionMorph(morphName: string, value: number, durationMs: number)
```

**Why?** EngineThree handles:
- Bone vs. morph rendering
- Multi-axis composite motions
- Mix weight blending
- RequestAnimationFrame-based tweening

The Animation Agency focuses on **what** values to apply and **when**, while EngineThree handles **how** they're rendered.

---

## Snippet Data Format

Animations are JSON keyframe curves:

```json
{
  "name": "happy_smile",
  "loop": false,
  "snippetCategory": "emotion",
  "snippetPriority": 5,
  "snippetPlaybackRate": 1.0,
  "snippetIntensityScale": 1.0,
  "curves": {
    "12": [
      { "time": 0, "intensity": 0 },
      { "time": 0.5, "intensity": 0.8 },
      { "time": 1.0, "intensity": 0 }
    ],
    "6": [
      { "time": 0, "intensity": 0 },
      { "time": 0.3, "intensity": 0.6 },
      { "time": 1.0, "intensity": 0 }
    ]
  }
}
```

**Curve Keys**:
- Numeric strings (`"12"`, `"6"`) → AU IDs
- Non-numeric strings (`"jawOpen"`) → Viseme/morph names

**Legacy Format Support**:
The normalizer also handles the old Vios format:
```json
{
  "au": [{ "id": 12, "t": 0, "v": 0 }, { "id": 12, "t": 0.5, "v": 0.8 }],
  "viseme": [{ "key": "aa", "t": 0, "v": 0 }]
}
```

---

## Concurrent Snippet Management

Multiple snippets can play simultaneously with **independent timelines**:

```typescript
// Load two snippets with different priorities
animationService.schedule(happySmile, { priority: 5 });
animationService.schedule(eyebrowRaise, { priority: 3 });

// Both play concurrently
// AU 12 (smile) comes from happySmile (priority 5)
// AU 1 (eyebrow) comes from eyebrowRaise (priority 3)
// If both control AU 6, happySmile wins (higher priority)
```

**Per-Snippet Control**:
```typescript
// Speed up just the smile
animationService.setSnippetPlaybackRate('happy_smile', 2.0);

// Reduce intensity of eyebrow
animationService.setSnippetIntensityScale('eyebrow_raise', 0.5);

// Pause smile while eyebrow continues
animationService.setSnippetPlaying('happy_smile', false);
```

---

## State Subscription for UI

React components can subscribe to machine state changes:

```typescript
useEffect(() => {
  const unsubscribe = animationService.onTransition((snapshot) => {
    const animations = snapshot.context.animations;
    setSnippets(animations);
  });
  return unsubscribe;
}, []);
```

**What to watch**:
- `snapshot.context.animations` - List of loaded snippets
- `snapshot.value` - Current state ('stopped', 'playing', 'paused')
- `snapshot.context.currentAUs` - Current AU values (for debugging)

---

## Testing Strategy

Each layer can be tested independently:

**Service Tests** ([\_\_tests\_\_/animationService.test.ts](\_\_tests\_\_/animationService.test.ts)):
- API contracts
- LocalStorage integration
- Snippet preloading

**Machine Tests** ([\_\_tests\_\_/animationMachine.test.ts](\_\_tests\_\_/animationMachine.test.ts)):
- State transitions
- Snippet normalization
- Context mutations

**Scheduler Tests** ([\_\_tests\_\_/animationScheduler.test.ts](\_\_tests\_\_/animationScheduler.test.ts)):
- Priority resolution
- Timing calculations
- Loop handling
- Host integration

---

## Example Usage

```typescript
import { createAnimationService } from './animationService';

// Initialize with host (EngineThree)
const animationService = createAnimationService({
  transitionAU: (id, value, duration) => engine.transitionAU(id, value, duration),
  transitionMorph: (name, value, duration) => engine.transitionMorph(name, value, duration)
});

// Load from localStorage (preloaded snippets)
animationService.loadFromLocal('emotionAnimationsList/happy_smile', 'emotion', 5);

// Or load from JSON
animationService.schedule({
  name: 'blink',
  loop: true,
  curves: { ... }
}, { priority: 10 });

// Start playback
animationService.play();

// Drive from render loop (recommended)
function animate() {
  const dt = clock.getDelta();
  animationService.step(dt); // Scheduler samples and applies
  requestAnimationFrame(animate);
}
```

---

## File Structure

```
latticework/animation/
├── README.md                          # This file
├── animationService.ts                # Service API layer
├── animationMachine.ts                # XState machine
├── animationScheduler.ts              # Scheduler (timing & execution)
├── types.ts                           # Shared TypeScript types
├── snippets/                          # Bundled animation libraries
│   ├── emotion/
│   ├── speaking/
│   └── visemes/
└── __tests__/
    ├── animationService.test.ts
    ├── animationMachine.test.ts
    └── animationScheduler.test.ts
```

---

## Common Patterns

### Loading Bundled Snippets

```typescript
// Snippets are preloaded to localStorage on service creation
// Access them via key format: "{category}List/{name}"
animationService.loadFromLocal('emotionAnimationsList/happy_smile');
animationService.loadFromLocal('speakingAnimationsList/thinking_hum');
```

### Scrubbing (UI Timeline Control)

```typescript
// Seek to specific time without playing
animationService.setSnippetTime('happy_smile', 1.5); // Jump to 1.5 seconds
animationService.flushOnce(); // Immediate visual update
```

### Dynamic Priority Adjustment

```typescript
// Boost priority when user is speaking
animationService.setSnippetPriority('lip_sync', 20);

// Lower priority when idle
animationService.setSnippetPriority('idle_breathing', 1);
```

---

## Differences from Old Vios Agency

**Similarities**:
- Three-layer architecture (Service/Machine/Scheduler)
- Wall-clock anchoring for independent timelines
- Priority-based conflict resolution
- XState for state management

**Improvements**:
- XState v5 (better TypeScript support)
- External frame stepping (render-loop synchronization)
- Per-snippet play/pause without removal
- Tween duration calculated from keyframe intervals
- Simplified snippet format (unified curves object)
- Built-in snippet preloading system

---

## Formal Specification & Contract

### Product Requirements

The Animation Agency must provide a **type-safe, testable API** for:

1. **Concurrent Animation Playback**: Multiple snippets with independent timelines
2. **Priority-Based Conflict Resolution**: Deterministic AU value resolution
3. **Real-Time Parameter Tuning**: Adjust speed, intensity, priority without reloading
4. **Timeline Control**: Seek, scrub, pause/resume individual snippets
5. **State Observability**: Subscribe to state changes for UI synchronization

### Behavioral Guarantees (Invariants)

These properties must always hold true and are verified by tests:

```typescript
// INVARIANT 1: Priority Resolution
// Given two snippets controlling the same AU:
// - Higher priority ALWAYS wins
// - Equal priority → higher value wins
∀ (s1, s2: Snippet), (au: number):
  if s1.priority > s2.priority then output = s1.value(au)
  if s1.priority == s2.priority then output = max(s1.value(au), s2.value(au))

// INVARIANT 2: Wall-Clock Independence
// Each snippet's local time is independent of others
∀ (s: Snippet):
  s.currentTime = ((now - s.startWallTime) / 1000) * s.playbackRate
  // Adjusting s1.playbackRate does NOT affect s2.currentTime

// INVARIANT 3: Intensity Scale Bounds
// Final AU values are always clamped to [0, 1]
∀ (au: number, v: number):
  output(au) = clamp(v * intensityScale, 0, 1)

// INVARIANT 4: Loop Continuity
// Looping snippets wrap without gaps
∀ (s: Snippet) where s.loop == true:
  s.currentTime = (s.currentTime % s.duration + s.duration) % s.duration

// INVARIANT 5: Non-Loop Termination
// Non-looping snippets stop at duration and fire completion callback
∀ (s: Snippet) where s.loop == false:
  if s.currentTime >= s.duration then
    s.isPlaying = false
    host.onSnippetEnd(s.name)
```

### Interface Contract (Types as Proofs)

The TypeScript types encode correctness guarantees:

```typescript
// PROOF 1: Service is the only public interface
// External code cannot bypass the Service to mutate state directly
export function createAnimationService(host: HostCaps): AnimationServiceAPI;
// ↑ Returns an opaque object; machine/scheduler are private closures

// PROOF 2: Host capabilities are explicitly required
export type HostCaps = {
  applyAU: (id: number | string, v: number) => void;
  setMorph: (key: string, v: number) => void;
  transitionAU?: (id: number | string, v: number, dur?: number) => void;
  transitionMorph?: (key: string, v: number, dur?: number) => void;
  onSnippetEnd?: (name: string) => void;
};
// ↑ Compiler enforces that Service consumers provide rendering implementation

// PROOF 3: State mutations are only via XState events
export type AnimEvent =
  | LoadAnimationEvent
  | RemoveAnimationEvent
  | PlayAllEvent
  | PauseAllEvent
  | StopAllEvent
  | CurveChangedEvent
  | KeyframeHitEvent
  | UIProgressEvent
  | ManualSetEvent
  | ManualClearEvent;
// ↑ Finite set of events = finite set of state transitions

// PROOF 4: Normalized snippets enforce required fields
export type NormalizedSnippet = {
  name: string;                    // Always present after normalization
  curves: CurvesMap;               // Always present (may be empty {})
  isPlaying: boolean;              // Explicit play state
  loop: boolean;                   // Explicit loop behavior
  snippetPlaybackRate: number;     // Always has default (1)
  snippetIntensityScale: number;   // Always has default (1)
  snippetCategory: 'auSnippet' | 'visemeSnippet' | 'default';
  snippetPriority: number;         // Always has default (0)
  currentTime: number;             // Always initialized (0)
  startWallTime: number;           // Always initialized (performance.now())
  cursor: Record<string, number>;  // Always initialized ({})
};
// ↑ No optional fields = no runtime undefined errors

// PROOF 5: Schedule options are explicitly typed
export type ScheduleOpts = {
  startInSec?: number;   // Relative delay before start
  startAtSec?: number;   // Absolute play-time to start
  offsetSec?: number;    // Initial seek position
  priority?: number;     // Override snippet priority
};
// ↑ Compiler catches invalid option combinations
```

### Test-Driven Specification

The test suite serves as executable specification. Key test categories:

**Service Tests** ([\_\_tests\_\_/animationService.test.ts](\_\_tests\_\_/animationService.test.ts)):
- ✓ API surface completeness (all methods exposed)
- ✓ LocalStorage integration (preload, load, extract names)
- ✓ Normalization (AU/viseme keyframes → unified curves)
- ✓ Parameter tuning (playback rate, intensity, priority, loop)
- ✓ Independent snippet control (pause one, continue others)
- ✓ State subscription (UI updates on transitions)

**Machine Tests** ([\_\_tests\_\_/animationMachine.test.ts](\_\_tests\_\_/animationMachine.test.ts)):
- ✓ State transitions (stopped ↔ playing ↔ paused)
- ✓ Snippet normalization (t/v syntax, time/intensity syntax)
- ✓ Curve sorting (always ascending by time)
- ✓ Default value application (all optional fields get defaults)
- ✓ startWallTime initialization (performance.now() at load)
- ✓ Manual overrides (UI sliders override keyframes)
- ✓ Curve changes (live editing without reload)

**Scheduler Tests** ([\_\_tests\_\_/animationScheduler.test.ts](\_\_tests\_\_/animationScheduler.test.ts)):
- ✓ Wall-clock anchoring (independent timelines)
- ✓ Looping behavior (wrap vs. clamp)
- ✓ Playback rate (2x speed = 2x snippet time)
- ✓ Intensity scale (0.5 scale = 50% intensity)
- ✓ Priority resolution (higher priority wins, then higher value)
- ✓ Seek functionality (adjust startWallTime correctly)
- ✓ Completion callbacks (onSnippetEnd for non-looping)
- ✓ Curve sampling (linear interpolation between keyframes)
- ✓ Value clamping (all outputs in [0, 1])

### Inter-Agency Communication Pattern

Agencies communicate **only through Service APIs**, never direct state access:

```typescript
// ✓ CORRECT: ProsodicExpressionService uses AnimationService API
import { createAnimationService } from '../animation/animationService';

class ProsodicExpressionService {
  private animService: ReturnType<typeof createAnimationService>;

  constructor(animService) {
    this.animService = animService;
  }

  onSpeechStart() {
    // Load speaking animations via public API
    this.animService.loadFromLocal('speakingAnimationsList/brow_raise', 'speaking', 5);
    this.animService.play();
  }

  onSpeechEnd() {
    // Remove via public API
    this.animService.remove('brow_raise');
  }
}

// ✗ INCORRECT: Accessing machine state directly
class BadProsodicService {
  constructor(animMachine) { // NEVER PASS MACHINE DIRECTLY
    this.machine = animMachine; // ✗ Violates encapsulation
  }

  onSpeechStart() {
    this.machine.send({ type: 'LOAD_ANIMATION', ... }); // ✗ Bypasses service
  }
}
```

**Why this matters**:
- Service layer can add validation, logging, side effects
- Machine implementation can change without breaking consumers
- Easy to mock Service API for testing consumers
- Clear dependency graph (Service → Machine → Scheduler)

### UI Integration Pattern

React components observe state via subscription:

```typescript
function AnimationTimeline() {
  const [snippets, setSnippets] = useState<NormalizedSnippet[]>([]);

  useEffect(() => {
    // Subscribe to state transitions
    const unsubscribe = animationService.onTransition((snapshot) => {
      // Only update if state actually changed
      if (snapshot.changed !== false) {
        setSnippets(snapshot.context.animations);
      }
    });

    return unsubscribe; // Cleanup on unmount
  }, []);

  return (
    <div>
      {snippets.map(sn => (
        <TimelineRow
          key={sn.name}
          name={sn.name}
          currentTime={sn.currentTime}
          duration={/* calculate from curves */}
          isPlaying={sn.isPlaying}
          onSeek={(time) => animationService.setSnippetTime(sn.name, time)}
          onTogglePlay={() => animationService.setSnippetPlaying(sn.name, !sn.isPlaying)}
        />
      ))}
    </div>
  );
}
```

**Proof of correctness**:
- UI never mutates state directly (read-only snapshot)
- All mutations via Service API (type-checked)
- Subscription ensures UI stays in sync with machine
- Unsubscribe prevents memory leaks

---

## Known Issues & Current Problems

### CRITICAL: Independent Snippet Control Issues

**Problem**: Individual snippets do not play, pause, loop, and update their playtime and intensity gracefully and independently from one another.

**Symptoms**:
1. **Pause/Resume Fails**: Pausing one snippet affects others or snippet doesn't resume from correct time
2. **Timeline Drift**: Snippets lose their correct position after rate/intensity changes
3. **Loop Jank**: Looping snippets stutter or jump instead of smooth wrapping
4. **Intensity Updates**: Changing intensity on one snippet causes visual jumps

**Root Causes** (Confirmed by Code Analysis):

```typescript
// ISSUE 1: setSnippetPlaying() DOES re-anchor, but only when resuming (playing=true)
// In animationService.ts:266-289
setSnippetPlaying(name: string, playing: boolean) {
  sn.isPlaying = !!playing;

  if (playing) {  // ✓ Re-anchors when resuming
    const currentLocal = sn.currentTime || 0;
    sn.startWallTime = now - (currentLocal / rate) * 1000;
  }
  // ❌ But when PAUSING (playing=false), it does NOT capture currentTime!
  //    The scheduler's step() will skip updating currentTime for paused snippets
  //    So currentTime becomes stale

  try { (impl as any).flushOnce?.(); } catch {}
  // ❌ flushOnce() is called AFTER pausing, which may show the wrong frame
}

// ISSUE 2: Pausing doesn't freeze currentTime in the snippet object
// In animationScheduler.ts:423-425 (step method):
snippets.forEach(sn => {
  if (!(sn as any).isPlaying) return;  // ❌ Skips paused snippets
  // ... calculate and update currentTime
  (sn as any).currentTime = local;
});
// Result: When paused, currentTime is NOT updated
// But when resuming, setSnippetPlaying uses this stale currentTime to re-anchor
// If time has passed while paused, the wall-clock anchor will be wrong

// ISSUE 3: flushOnce() DOES ignore isPlaying state (by design for scrubbing)
// In animationScheduler.ts:384-398
flushOnce() {
  const tPlay = this.useExternalStep ? this.playTimeSec : (this.now() - this.startWall) / 1000;
  const targets = this.buildTargetMap(this.currentSnippets(), tPlay, true);
  //                                                                  ^^^^ ignorePlayingState=true
  targets.forEach((entry, curveId) => {
    (this.host.transitionAU ?? this.host.applyAU)(parseInt(curveId, 10), v, entry.durMs);
  });
}
// ✓ This is CORRECT for scrubbing (want to show paused position)
// ❌ But the tPlay calculation may be wrong:
//    - If using external step: tPlay = playTimeSec (global accumulator)
//    - This doesn't account for per-snippet wall-clock anchors!

// ISSUE 4: buildTargetMap calculates local time from wall-clock, not currentTime
// In animationScheduler.ts:145-176
buildTargetMap(snippets, tPlay, ignorePlayingState) {
  for (const sn of snippets) {
    if (!ignorePlayingState && sn.isPlaying === false) continue;

    // ❌ Uses wall-clock to calculate local time, ignoring sn.currentTime
    let local = ((now - sn.startWallTime) / 1000) * rate;

    // For paused snippets being flushed:
    // - sn.currentTime may be 2.5 (where we paused)
    // - But this calculates from wall-clock, which continues advancing
    // - Result: shows wrong frame when scrubbing paused snippet
  }
}

// ISSUE 5: setSnippetPlaybackRate tries to re-anchor but uses stale currentTime
// In animationService.ts:220-221
const currentLocal = ((now - (sn.startWallTime || now)) / 1000) * oldRate;
// ✓ Calculates current position from wall-clock
sn.startWallTime = now - (currentLocal / newRate) * 1000;
// ✓ Re-anchors for new rate
// ❌ But then calls flushOnce which uses playTimeSec, not wall-clock
try { (impl as any).flushOnce?.(); } catch {}
```

**The Core Problem**:

There are **TWO timing models** fighting each other:

1. **Wall-Clock Model** (in `buildTargetMap` and `step`):
   - `local = ((now - startWallTime) / 1000) * rate`
   - Used for calculating what frame to show during playback
   - Advances continuously based on real time

2. **Accumulated Time Model** (in `flushOnce`):
   - `tPlay = this.playTimeSec` (accumulated delta times)
   - Used for scrubbing and immediate updates
   - Should reflect current position, but doesn't

**The wall-clock model doesn't respect paused state properly**:
- When paused, `startWallTime` is NOT adjusted
- So when buildTargetMap calculates `local`, it uses the old anchor
- Result: paused snippet continues to "play" in its calculated local time

---

### Solution Design

**Fix: Capture `currentTime` when pausing, use it as source of truth**

```typescript
// SOLUTION 1: Update setSnippetPlaying to capture currentTime when pausing
// In animationService.ts:
setSnippetPlaying(name: string, playing: boolean) {
  const sn = /* find snippet */;

  if (!playing) {
    // ✓ CAPTURE current position from wall-clock before pausing
    const now = this.now();
    const rate = sn.snippetPlaybackRate ?? 1;
    const currentLocal = ((now - (sn.startWallTime || now)) / 1000) * rate;
    const dur = this.totalDuration(sn);

    // Handle looping/clamping same as buildTargetMap
    if (sn.loop && dur > 0) {
      sn.currentTime = ((currentLocal % dur) + dur) % dur;
    } else {
      sn.currentTime = Math.min(dur, Math.max(0, currentLocal));
    }
  }

  sn.isPlaying = !!playing;

  if (playing) {
    // ✓ Re-anchor from captured currentTime
    const now = this.now();
    const currentLocal = sn.currentTime || 0;
    const rate = sn.snippetPlaybackRate ?? 1;
    sn.startWallTime = now - (currentLocal / rate) * 1000;
  }

  // ✓ Flush to show correct frame
  this.flushOnce();
}

// SOLUTION 2: buildTargetMap should use sn.currentTime for paused snippets
// In animationScheduler.ts:
buildTargetMap(snippets, tPlay, ignorePlayingState) {
  for (const sn of snippets) {
    const isPaused = !sn.isPlaying;

    let local: number;

    if (isPaused && ignorePlayingState) {
      // ✓ Use frozen currentTime for paused snippets being flushed
      local = sn.currentTime || 0;
    } else {
      // ✓ Use wall-clock for actively playing snippets
      local = ((now - sn.startWallTime) / 1000) * rate;

      // Handle looping/clamping
      if (sn.loop && dur > 0) {
        local = ((local % dur) + dur) % dur;
      } else {
        local = Math.min(dur, Math.max(0, local));
      }
    }

    // Sample curves at local time...
  }
}

// SOLUTION 3: step() should update currentTime even for paused snippets (for UI display)
// In animationScheduler.ts:
step(dtSec: number) {
  const now = this.now();

  snippets.forEach(sn => {
    const rate = sn.snippetPlaybackRate ?? 1;
    const dur = this.totalDuration(sn);

    if (!(sn as any).isPlaying) {
      // ✓ Don't advance, but ensure currentTime is accurate for display
      // (already captured by setSnippetPlaying when pausing)
      return;
    }

    // ✓ Playing: calculate from wall-clock and update currentTime
    let local = ((now - sn.startWallTime) / 1000) * rate;

    if (sn.loop && dur > 0) {
      local = ((local % dur) + dur) % dur;
    } else {
      local = Math.min(dur, Math.max(0, local));
    }

    sn.currentTime = local;
  });

  // Build targets (will use wall-clock for playing, currentTime for paused)
  const targets = this.buildTargetMap(snippets, tPlay);
  // ...
}
```

**Invariant Proofs After Fix**:

```typescript
// PROOF: Pause/Resume Identity
// Given: snippet at t=2.5
service.setSnippetPlaying('s', false);
// → Captures currentTime=2.5 from wall-clock
// → Sets isPlaying=false
// → Calls flushOnce() which uses currentTime=2.5

/* time passes */

service.setSnippetPlaying('s', true);
// → Uses currentTime=2.5 to re-anchor startWallTime
// → startWallTime = now - (2.5 / rate) * 1000
// → Sets isPlaying=true
// → Next step() will calculate from new anchor
// ✓ Preserves position

// PROOF: Independent Timelines
service.setSnippetPlaybackRate('s1', 2.0);
// → Calculates s1.currentTime from wall-clock with OLD rate
// → Re-anchors s1.startWallTime for NEW rate
// → Calls flushOnce() which:
//    - For s1: uses wall-clock (just re-anchored, same position)
//    - For s2: uses wall-clock (unchanged startWallTime)
// ✓ s2 unaffected

// PROOF: Intensity Immediacy
service.setSnippetIntensityScale('s1', 0.5);
// → Updates s1.snippetIntensityScale
// → Calls flushOnce() which:
//    - Calculates local time (unchanged)
//    - Samples curves at same time
//    - Applies NEW scale to sampled values
// ✓ Value changes, time doesn't
```

**Expected Behavior** (Invariant Violations):

```typescript
// INVARIANT: Pause/Resume Identity
// Pausing and immediately resuming should preserve currentTime
snippet.currentTime = 2.5;
service.setSnippetPlaying('snippet', false);  // Pause
service.setSnippetPlaying('snippet', true);   // Resume
// MUST: snippet.currentTime still ~2.5 (allowing for frame delta)
// ACTUAL: snippet.currentTime may jump or drift

// INVARIANT: Independent Playback Rates
// Changing rate on s1 should NOT affect s2's timeline
service.setSnippetPlaybackRate('s1', 2.0);
// MUST: s2.currentTime unchanged
// ACTUAL: May cause visual jump in s2 due to flushOnce timing

// INVARIANT: Loop Continuity
// Looping snippet should wrap smoothly without gaps
// MUST: t=0.99 → t=1.0 → t=0.0 → t=0.01 (seamless)
// ACTUAL: May show jump or hold on last frame

// INVARIANT: Intensity Scale Immediacy
// Changing intensity should update visual immediately without timeline jump
service.setSnippetIntensityScale('s1', 0.5);
// MUST: AU value halved, currentTime unchanged
// ACTUAL: May cause currentTime to reset or jump
```

**Test Cases to Add**:

```typescript
describe('Independent Snippet Control (Bug Reproduction)', () => {
  it('should preserve currentTime when pausing and resuming', () => {
    const snippet = { name: 's1', curves: { '1': [{ time: 0, intensity: 0 }, { time: 5, intensity: 1 }] } };
    service.loadFromJSON(snippet);
    service.play();

    // Advance to t=2.5
    vi.advanceTimersByTime(2500);
    service.step(2.5);

    const timeBeforePause = service.getState().context.animations[0].currentTime;

    // Pause
    service.setSnippetPlaying('s1', false);

    // Wait 1 second (should NOT advance)
    vi.advanceTimersByTime(1000);
    service.step(1.0);

    const timeWhilePaused = service.getState().context.animations[0].currentTime;
    expect(timeWhilePaused).toBeCloseTo(timeBeforePause, 2);

    // Resume
    service.setSnippetPlaying('s1', true);

    const timeAfterResume = service.getState().context.animations[0].currentTime;
    expect(timeAfterResume).toBeCloseTo(timeBeforePause, 2);
  });

  it('should not affect other snippets when changing one snippet rate', () => {
    const s1 = { name: 's1', curves: { '1': [{ time: 0, intensity: 0 }, { time: 5, intensity: 1 }] } };
    const s2 = { name: 's2', curves: { '2': [{ time: 0, intensity: 0 }, { time: 5, intensity: 1 }] } };

    service.loadFromJSON(s1);
    service.loadFromJSON(s2);
    service.play();

    // Advance to t=2.0
    vi.advanceTimersByTime(2000);
    service.step(2.0);

    const s2TimeBefore = service.getState().context.animations[1].currentTime;

    // Change s1 rate (should NOT affect s2)
    service.setSnippetPlaybackRate('s1', 3.0);

    const s2TimeAfter = service.getState().context.animations[1].currentTime;
    expect(s2TimeAfter).toBeCloseTo(s2TimeBefore, 2);
  });

  it('should wrap loop smoothly without stutter', () => {
    const snippet = {
      name: 'loop',
      loop: true,
      curves: { '1': [{ time: 0, intensity: 0 }, { time: 1, intensity: 1 }] }
    };

    service.loadFromJSON(snippet);
    service.play();

    const samples: number[] = [];

    // Sample every 100ms through 3 loops
    for (let i = 0; i < 30; i++) {
      vi.advanceTimersByTime(100);
      service.step(0.1);
      appliedAUs = [];
      service.flushOnce();
      const au1 = appliedAUs.find(au => au.id === 1);
      samples.push(au1?.value ?? 0);
    }

    // Check for discontinuities (jumps > 0.2)
    for (let i = 1; i < samples.length; i++) {
      const delta = Math.abs(samples[i] - samples[i - 1]);
      if (i % 10 !== 0) { // Not at loop boundary
        expect(delta).toBeLessThan(0.2); // Smooth interpolation
      }
    }
  });

  it('should update intensity immediately without timeline jump', () => {
    const snippet = { name: 's1', curves: { '1': [{ time: 0, intensity: 1.0 }] } };
    service.loadFromJSON(snippet);
    service.play();

    vi.advanceTimersByTime(1000);
    service.step(1.0);

    const timeBefore = service.getState().context.animations[0].currentTime;

    appliedAUs = [];
    service.flushOnce();
    const valueBefore = appliedAUs.find(au => au.id === 1)?.value ?? 0;
    expect(valueBefore).toBeCloseTo(1.0, 2);

    // Change intensity to 50%
    service.setSnippetIntensityScale('s1', 0.5);

    const timeAfter = service.getState().context.animations[0].currentTime;
    expect(timeAfter).toBeCloseTo(timeBefore, 2);

    appliedAUs = [];
    service.flushOnce();
    const valueAfter = appliedAUs.find(au => au.id === 1)?.value ?? 0;
    expect(valueAfter).toBeCloseTo(0.5, 2);
  });
});
```

### Other Limitations

1. **No Blend Transitions**: Snippets start/stop abruptly (no fade in/out)
2. **No Easing Curves**: Only linear interpolation between keyframes
3. **No Event Triggers**: Can't fire callbacks at specific keyframe times
4. **No Snippet Sequencing**: Must manually chain snippets
5. **No Performance Monitoring**: No visibility into scheduler overhead

### Future Enhancements

- **Blend Curves**: Smooth transitions when loading/removing snippets
- **Event Triggers**: Fire callbacks at specific keyframe times
- **Interpolation Modes**: Support step, ease-in/out, custom bezier curves
- **Snippet Sequencing**: Queue snippets for automatic playback chains
- **Performance Monitoring**: Track scheduler overhead and frame budget
- **WASM Scheduler**: Move scheduler to WebAssembly for 60fps+ playback
- **Snippet Hot-Reload**: Update running snippets without restart
