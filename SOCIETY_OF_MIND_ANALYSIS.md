# LoomLarge "Society of Mind" Architecture Analysis

## Executive Summary

The LoomLarge project implements a **multi-agent collaborative architecture** inspired by Marvin Minsky's "Society of Mind" philosophy. The codebase structures facial animation and expression as a collection of specialized, independent agencies (services) that coordinate through a standardized pattern: **Service/Machine/Scheduler trinity**.

Each agency is a semi-autonomous system responsible for one aspect of facial expression:
- **LipSync** - mouth shapes for phonetic accuracy
- **Animation** - action units and keyframe curves
- **Prosodic** - speech gestures (brows, head nods)
- **EyeHeadTracking** - gaze and head orientation
- **TTS** - speech synthesis and production
- **Transcription** - speech perception and understanding
- **Conversation** - turn-taking dialogue orchestration

This report documents:
1. The complete architecture pattern and philosophy
2. Agency inventory with component mapping
3. Completeness analysis (which agencies fully implement the pattern)
4. The hierarchical nature of agency interactions
5. Gaps and recommendations for consistency

---

## Part 1: The Latticework Agency Pattern

### Core Philosophy: Three-Layer Architecture

Each agency in Latticework consists of exactly three components working in concert:

```
┌─────────────────────────────────────────────────────────┐
│                    AGENCY (e.g., Animation)             │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  SERVICE (Public API)                            │  │
│  │  - Singleton factory function or class           │  │
│  │  - Exposes high-level methods                    │  │
│  │  - Integrates machine + scheduler                │  │
│  │  - Provides callbacks and subscriptions          │  │
│  └────────────────┬─────────────────────────────────┘  │
│                   │ owns & delegates to                 │
│  ┌────────────────▼─────────────────────────────────┐  │
│  │  MACHINE (XState)                                │  │
│  │  - Canonical state representation                │  │
│  │  - State transitions via events                  │  │
│  │  - Context updates (immutable patterns)          │  │
│  │  - NO side effects (pure state)                  │  │
│  └────────────────┬─────────────────────────────────┘  │
│                   │ updates state via events            │
│  ┌────────────────▼─────────────────────────────────┐  │
│  │  SCHEDULER (Execution/Timing)                    │  │
│  │  - Wall-clock anchoring                          │  │
│  │  - Sample curves and apply values                │  │
│  │  - Priority resolution                          │  │
│  │  - RequestAnimationFrame synchronization        │  │
│  │  - Side effects here ONLY                        │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Why This Pattern?

1. **Separation of Concerns**: State management (Machine) separate from execution (Scheduler)
2. **Testability**: Each layer can be tested in isolation without rendering
3. **Parallel Operation**: Multiple snippets/instances run concurrently with independent state
4. **Clear Contracts**: Agencies interact only via Service APIs, never directly with internal state
5. **Composability**: Agencies can be chained together safely
6. **Determinism**: XState guarantees predictable state transitions

### Example: Animation Agency

**Service** (`animationService.ts`)
- Factory: `createAnimationService(host)`
- Public methods: `play()`, `pause()`, `schedule(data)`, `setSnippetPlaybackRate(name, rate)`
- Responsibility: Load/remove snippets, control playback, expose state subscriptions

**Machine** (`animationMachine.ts`)
- State: `{ stopped | playing | paused }`
- Context: `{ animations: [], currentAUs: {}, currentVisemes: {} }`
- Events: `LOAD_ANIMATION`, `REMOVE_ANIMATION`, `PLAY_ALL`, `PAUSE_ALL`, `STOP_ALL`
- Pure state transitions, no side effects

**Scheduler** (`animationScheduler.ts`)
- Samples curve keyframes based on wall-clock time
- Resolves priority conflicts (higher priority wins)
- Applies values via `host.transitionAU()` or `host.applyAU()`
- Handles looping and completion callbacks
- Wall-clock anchoring for independent snippet timelines

---

## Part 2: Complete Agency Inventory

### Status Legend
- **COMPLETE**: All three components (Service/Machine/Scheduler)
- **PARTIAL**: Missing one or more components
- **CUSTOM**: Uses alternative pattern
- **MISSING**: Not yet implemented

### 1. Animation Agency
**Status**: ✅ COMPLETE  
**Location**: `src/latticework/animation/`

**Components**:
- ✅ Service: `animationService.ts` (Factory function)
- ✅ Machine: `animationMachine.ts` (XState v5)
- ✅ Scheduler: `animationScheduler.ts` (Wall-clock anchoring)
- ✅ Tests: `__tests__/` (service, machine, scheduler)
- ✅ Documentation: `README.md` (36KB detailed spec)

**Key Features**:
- Concurrent snippet playback with independent timelines
- Per-snippet control (playback rate, intensity, priority, looping)
- Priority-based conflict resolution
- Wall-clock anchoring for smooth, time-independent playback
- Support for both Action Units (numeric) and visemes (string keys)
- Logarithmic intensity scaling (scale^2)
- Live curve editing support

**Philosophy Integration**:
This is the reference implementation of the Latticework pattern. All other agencies are designed after this model.

---

### 2. Prosodic Expression Agency
**Status**: ✅ COMPLETE  
**Location**: `src/latticework/prosodic/`

**Components**:
- ✅ Service: `prosodicService.ts` (Factory function)
- ✅ Machine: `prosodicMachine.ts` (XState)
- ✅ Scheduler: `prosodicScheduler.ts` (Timing & fade)
- ✅ Documentation: `README.md` (11KB)

**Key Features**:
- Two independent channels: brow and head
- Looping animations during speech
- Graceful fade-out with configurable fade steps
- Word-boundary pulse triggering
- Integration with Animation Service via public API
- Proper encapsulation (never passes machine directly)

**Philosophy Integration**:
Perfect example of **agency hierarchy**. Prosodic Service delegates to Animation Service API, never directly to its internals. This creates a clean dependency graph.

---

### 3. LipSync Agency
**Status**: ⚠️ PARTIAL (Service-only)  
**Location**: `src/latticework/lipsync/`

**Components**:
- ✅ Service: `lipSyncService.ts` (Class-based)
- ❌ Machine: None (uses utility modules instead)
- ❌ Scheduler: None
- ✅ Documentation: `README.md` (14KB)
- ✅ Utilities: `PhonemeExtractor.ts`, `VisemeMapper.ts`, etc.

**Key Features**:
- Phoneme extraction from text
- Viseme timeline generation
- JALI-based speech style variation
- Integration with animation snippets
- WebSpeech API + SAPI support

**Analysis**:
LipSync doesn't need a full Machine/Scheduler because:
1. Viseme generation is deterministic (text → phonemes → visemes)
2. No complex state transitions needed
3. Timing is handled by Animation Agency when snippet is scheduled
4. Utility modules replace state management

**Philosophy Alignment**: ⚠️ WEAKLY ALIGNED
- Should consider: Creating a `lipSyncMachine` for state tracking (speaking/idle, active viseme)
- Could improve: Separated concerns if state (current phoneme, timeline) is in Machine vs. Service

---

### 4. Eye/Head Tracking Agency
**Status**: ⚠️ PARTIAL (Dual-Submachine, no Scheduler)  
**Location**: `src/latticework/eyeHeadTracking/`

**Components**:
- ✅ Service: `eyeHeadTrackingService.ts` (Class-based)
- ⚠️ Machines: `eyeTrackingMachine.ts` + `headTrackingMachine.ts` (Dual XState machines)
- ❌ Scheduler: None (animations pushed to Animation Service directly)
- ✅ Documentation: `README.md` (7KB)

**Key Features**:
- Coordinated eye and head movements
- Saccade vs. smooth pursuit eye movements
- Automatic blinking
- Idle variation and speech coordination
- High-priority animations (overrides other expressions)
- Integration with Animation Service

**Analysis**:
Non-standard pattern: Uses TWO submachines (eye + head) rather than one.

**Philosophy Alignment**: ⚠️ MODIFIED PATTERN
- Eye and Head submachines are justified (independent systems that must coordinate)
- Service correctly orchestrates both machines
- No dedicated Scheduler (delegates to Animation Service instead)

---

### 5. TTS (Text-to-Speech) Agency
**Status**: ⚠️ CUSTOM PATTERN  
**Location**: `src/latticework/tts/`

**Components**:
- ✅ Service: `ttsService.ts` (Class-based)
- ❌ Machine: None (uses Web Speech API state directly)
- ❌ Scheduler: None
- ✅ Documentation: `README.md` (7KB)
- ✅ Utilities: `utils.ts` (timeline building)

**Key Features**:
- Web Speech API + SAPI support
- Timeline-based event scheduling
- Word boundary detection
- Emoji parsing and integration
- Voice management and selection

**Philosophy Alignment**: ❌ NO MACHINE PATTERN
- TTS doesn't track rich state, so no Machine needed
- Web Speech API is the implicit state source
- Consider: Could benefit from explicit state machine (speaking/paused/idle)

---

### 6. Transcription (Speech-to-Text) Agency
**Status**: ⚠️ CUSTOM PATTERN  
**Location**: `src/latticework/transcription/`

**Components**:
- ✅ Service: `transcriptionService.ts` (Class-based)
- ❌ Machine: None
- ❌ Scheduler: None
- Utilities: Simple callback-based state
- Documentation: Minimal (types.ts)

**Key Features**:
- Web Speech API recognition
- Microphone permission handling
- Boundary stream (word-level events)
- Agent speech filtering (ignore self during speech)

**Philosophy Alignment**: ❌ MINIMAL PATTERN
- Single-layer design (Service only)
- State is implicit in Web Speech API
- Could benefit from Machine for clarity (listening/recognizing/idle states)

---

### 7. Conversation Agency
**Status**: ⚠️ ORCHESTRATOR PATTERN  
**Location**: `src/latticework/conversation/`

**Components**:
- ✅ Service: `conversationService.ts` (Class-based)
- ❌ Machine: None
- ❌ Scheduler: None
- Documentation: Minimal

**Key Features**:
- Coordinates TTS, Transcription, EyeHeadTracking
- Turn-taking management
- Generator-based conversation flow
- Gaze scheduling during conversation

**Philosophy Alignment**: ❌ ORCHESTRATOR, NOT AGENCY
Conversation Service is a **coordinator**, not a full agency:
- Doesn't manage its own state via Machine
- Doesn't schedule its own animations
- Delegates everything to sub-agencies
- Acts as a "conductor" in the Society of Mind

**Design Note**: This is correct! Not every service needs to be a full three-layer agency. Orchestrators can exist at a higher level.

---

## Part 3: Historical Context (Old Agencies)

Located in `src/latticework/old_agencies/`:

### Old Pattern Structure
The original implementation used the same trinity pattern but with JavaScript:

1. **FACS Agency** (old_agencies/cognition/facs/)
   - Machine, Service, Scheduler pattern
   - Direct Action Unit (AU) state management
   - Collision logic for incompatible AUs

2. **Animation Agency** (old_agencies/action/visualizers/animation/)
   - Older version of current Animation Agency
   - Similar three-layer pattern

3. **Survey Conversation Agency**
   - Conversation orchestration
   - Multiple conversation modes

4. **Emotive Expression Agency**
   - Emotion snippet sequencing
   - Queuing based on emoji/emotional state

### Evolution
The codebase is **actively transitioning** from old_agencies (JavaScript) to latticework (TypeScript):
- Animation, TTS, Transcription: Fully migrated ✅
- Prosodic, LipSync: Newly created ✅
- FACS: Replaced by Animation Agency's AU system ✅
- Cognition agencies: Being replaced by Conversation + AI integration 🔄

---

## Part 4: The Society of Mind Hierarchy

### How Agencies Interact

```
┌─────────────────────────────────────────────────────────────┐
│                   ORCHESTRATION LAYER                       │
│  (Conversation Service - coordinates entire dialogue flow)  │
└──────────────┬────────────────────────────────────────────┬─┘
               │                                            │
        ┌──────▼──────┐                               ┌──────▼──────┐
        │ TTS Service │ ────┐                   ┌────▶│ Transcription│
        │  (Output)   │     │                   │     │   (Input)    │
        └─────────────┘     │                   │     └──────────────┘
                            │                   │
                      ┌─────▼───────────────────▼─────┐
                      │   ANIMATION SERVICE            │
                      │   (Core Facial Animation)      │
                      │                                │
                      │  - Concurrent snippets         │
                      │  - Priority resolution         │
                      │  - Wall-clock anchoring        │
                      └─────┬─────────────────────┬────┘
                            │                     │
             ┌──────────────▼────┐      ┌─────────▼──────────────┐
             │  LIPSYNC SERVICE  │      │  PROSODIC SERVICE      │
             │  (Mouth shapes)   │      │  (Gestures)            │
             │                   │      │                        │
             │  - Phoneme→Viseme │      │  - Brow raises         │
             │  - Timeline       │      │  - Head nods           │
             │  - Loads snippets │      │  - Fade-out            │
             │    to Animation   │      │  - Loads snippets      │
             │                   │      │    to Animation        │
             └───────────────────┘      └────────────────────────┘
                            │                     │
             ┌──────────────▼────────────────────▼──────┐
             │   EYE/HEAD TRACKING SERVICE               │
             │   (Gaze & orientation)                   │
             │                                          │
             │   - Eye saccades                         │
             │   - Head following                       │
             │   - Blinking                             │
             │   - Loads snippets to Animation          │
             └──────────────────────────────────────────┘
```

### Communication Patterns

**Direct Access (❌ Wrong)**:
```typescript
// NEVER do this:
const machine = animationService.machine;  // Can't access
machine.send({ type: 'LOAD_ANIMATION', ... });  // Violates encapsulation
```

**Via Service API (✅ Correct)**:
```typescript
// Prosodic Service uses Animation Service correctly:
const name = scheduleSnippet(animationService.schedule(snippet));
```

### Priority Hierarchy
```
Priority    Agency          Purpose
────────────────────────────────────────────────
  20        EyeHeadTracking  Gaze MUST be visible
  15        LipSync          Mouth sync critical
   5        Prosodic         Gesture emphasis
   0        Emotion/Idle     Baseline expression
```

When multiple agencies control the same AU:
- **Higher priority wins** (20 > 5 > 0)
- **Equal priority**: Higher intensity value wins
- **Tween duration**: Calculated from keyframe intervals

---

## Part 5: Completeness Analysis

### Fully Conforming Agencies (Complete Trinity)

**✅ Animation Agency**
- Pattern: ✅ Complete (Service → Machine → Scheduler)
- Architecture: ✅ Reference implementation
- Testing: ✅ Comprehensive
- Documentation: ✅ Extensive (36KB README)
- State Management: ✅ Rich XState machine
- Integration: ✅ All agencies depend on it

**✅ Prosodic Expression Agency**
- Pattern: ✅ Complete (Service → Machine → Scheduler)
- Dependency: ✅ Uses Animation Service API correctly
- Testing: ⚠️ Minimal (in main module only)
- Documentation: ✅ Detailed (11KB README)
- State Management: ✅ Simple but clear XState
- Fade Management: ✅ Sophisticated (multi-step)

### Partially Conforming Agencies

**⚠️ LipSync Agency**
- Pattern: ⚠️ Service + Utilities (no Machine)
- Justification: Deterministic phoneme→viseme mapping doesn't need state machine
- Recommendation: Create optional `lipSyncMachine` for state tracking
- Missing: Dedicated scheduler (relies on Animation Service)
- Gap: Could track "current phoneme" and "active timeline" in Machine

**⚠️ EyeHeadTracking Agency**
- Pattern: ⚠️ Service + Dual Machines (no Scheduler)
- Justification: Eye and Head are semi-independent systems
- Recommendation: Consider dedicated Scheduler for state sampling
- Missing: Own scheduler (relies on Animation Service)
- Gap: Eye blinking and saccades are computed in Service, should be in Machine

**⚠️ TTS Agency**
- Pattern: ⚠️ Service Only (Web Speech API as implicit state)
- Justification: Web Speech API handles most complexity
- Recommendation: Wrap with explicit Machine for clarity
- Missing: Machine and Scheduler
- Gap: `speaking | paused | idle` states are implicit in Web Speech API

**⚠️ Transcription Agency**
- Pattern: ⚠️ Service Only
- Justification: Simple callback-based architecture
- Recommendation: Could benefit from explicit state machine
- Missing: Machine and Scheduler
- Gap: `listening | recognizing | idle` states are implicit

### Special Case: Conversation Agency

**⚠️ Conversation Service**
- Pattern: ⚠️ Orchestrator (not a traditional Agency)
- Role: Coordinates other agencies for dialogue
- Justification: ✅ Correct (not all services need to be three-layer)
- Design: Generator-based flow management
- Missing: No own Machine/Scheduler (by design)

---

## Part 6: Philosophical Analysis - "Society of Mind"

### Marvin Minsky's Core Concept

"The mind is a society of simple agents."

Key principles:
1. **No central controller**: Each agency operates semi-autonomously
2. **Local rules**: Each agency follows simple rules for its domain
3. **Emergent complexity**: Global behavior emerges from local interactions
4. **Parallelism**: Agencies run concurrently and independently
5. **Communication**: Agencies signal each other via well-defined channels

### How LoomLarge Embodies Society of Mind

**Parallel Agencies**:
- Animation, LipSync, Prosodic, EyeHeadTracking run concurrently
- Each operates on independent timelines (wall-clock anchoring)
- No global synchronization needed (except priorities)

**Local Rules**:
- **Animation Agency**: "Apply curves based on wall time"
- **Prosodic Agency**: "Pulse every word, fade gracefully"
- **LipSync Agency**: "Map phonemes to visemes"
- **EyeHeadTracking Agency**: "Saccade to target, head follows eyes"

**Emergent Behavior**:
- Combined: Natural speech with synchronized mouth, prosodic gestures, and gaze
- Simple rules combine to create complex, lifelike expression
- No central "animation controller" directing all parts

**Communication Pattern**:
```
Agency1 (TTS)          Agency2 (Animation)        Agency3 (Prosodic)
    │                       │                           │
    │ calls API              │                           │
    ├──────schedule()───────▶│                           │
    │                        │ updates context           │
    │                        │ ✓ AU values applied       │
    │                        │                           │
    │ emits boundary         │                           │
    ├─────────────────────────┼──────pulse()────────────▶│
    │                        │                           │
    │                        │◀────schedule()────────────┤
    │                        │ (brow/head snippets)      │
```

### Philosophical Strengths

1. **No Global State**: Each agency maintains local state via XState
2. **Concurrent Independence**: Agencies don't block each other
3. **Graceful Degradation**: If one agency fails, others continue
4. **Priority-Based Arbitration**: Natural conflict resolution without explicit negotiations
5. **Composability**: New agencies can be added without rewriting existing ones

### Current Gaps from Pure "Society of Mind"

1. **Strict Priority Ordering**: Hard-coded priorities (20, 15, 5, 0)
   - Pure Society of Mind would use more fluid negotiation
   - LoomLarge is pragmatic: priorities work well for facial animation

2. **Some Centralized Coordination**: Conversation Service acts as conductor
   - In pure Society of Mind, would be emergent from agency interactions
   - Practical trade-off: necessary for turn-taking dialogue

3. **Unequal Agency "Intelligence"**:
   - Animation Agency is complex (full trinity)
   - TTS/Transcription are simple (service only)
   - Pure model would have more uniform complexity

4. **Incomplete Machine Pattern**:
   - TTS, Transcription don't fully model their state
   - LipSync uses external utilities instead of state machine
   - Could be more consistent

---

## Part 7: Gap Analysis & Recommendations

### Critical Gaps

#### 1. **Machine/Scheduler Inconsistency**
**Current State**:
- Animation, Prosodic: ✅ Full trinity
- LipSync, EyeHeadTracking: ⚠️ Partial (uses Animation Service scheduler)
- TTS, Transcription: ❌ No machines

**Recommendation**:
```typescript
// TTS should have explicit state machine
export const ttsMachine = createMachine({
  id: 'ttsMachine',
  initial: 'idle',
  states: {
    idle: { on: { START: 'speaking' } },
    speaking: { on: { PAUSE: 'paused', STOP: 'idle' } },
    paused: { on: { RESUME: 'speaking', STOP: 'idle' } }
  },
  context: {
    text: '',
    currentWord: 0,
    timeline: []
  }
});
```

**Impact**: Easier testing, clearer state transitions, better encapsulation

#### 2. **LipSync State Management**
**Current State**:
- Utility modules (PhonemeExtractor, VisemeMapper) handle logic
- No explicit state for "current phoneme" or "active timeline"

**Recommendation**:
```typescript
// Create optional lipSyncMachine for timeline state
export const lipSyncMachine = createMachine({
  id: 'lipSyncMachine',
  initial: 'idle',
  states: {
    idle: { on: { START_SPEECH: 'speaking' } },
    speaking: {
      on: {
        PHONEME_START: { actions: 'setCurrentPhoneme' },
        PHONEME_END: { actions: 'clearCurrentPhoneme' },
        SPEECH_END: 'idle'
      }
    }
  },
  context: {
    currentPhoneme: null,
    timeline: [],
    currentIndex: 0
  }
});
```

**Impact**: Better debugging, clearer phoneme sequencing

#### 3. **Missing Explicit Schedulers**
**Current State**:
- LipSync, EyeHeadTracking, TTS, Transcription: No dedicated schedulers
- All rely on Animation Service scheduler or implicit Web API scheduling

**Recommendation**:
Create schedulers for agencies that need own timing:
```typescript
// TTS could have timeline-based scheduler
export class TTSScheduler {
  private timeline: TimelineEvent[] = [];
  private timelineStart: number = 0;
  
  scheduleTimeline(events: TimelineEvent[]) {
    this.timeline = events;
    this.timelineStart = now();
    this.processTimeline();
  }
  
  private processTimeline() {
    const elapsed = now() - this.timelineStart;
    for (const event of this.timeline) {
      if (event.offsetMs <= elapsed && !event.fired) {
        this.fireEvent(event);
        event.fired = true;
      }
    }
    requestAnimationFrame(() => this.processTimeline());
  }
}
```

#### 4. **Documentation Gaps**
**Missing Documentation**:
- No top-level "Architecture" document explaining the trinity pattern
- No "How to create a new agency" guide
- No "Society of Mind philosophy" document

**Recommendation**:
Create `/docs/SOCIETY_OF_MIND.md`:
```markdown
# Society of Mind Architecture

## The Agency Trinity
Each agency in LoomLarge follows the same pattern:

1. **Service** - Public API factory function
2. **Machine** - XState state management  
3. **Scheduler** - Timing and side effects

## Example: Creating a New Agency (e.g., Breathing)
```

#### 5. **No Central Registry**
**Current State**:
Agencies are created ad-hoc in modules, no central way to:
- List all active agencies
- Get aggregate state across agencies
- Monitor agency health/performance

**Recommendation**:
```typescript
// Create AgencyRegistry
export class AgencyRegistry {
  private agencies = new Map<string, AgencyInstance>();
  
  register(name: string, agency: any) {
    this.agencies.set(name, agency);
  }
  
  getAgencies(): Map<string, any> {
    return new Map(this.agencies);
  }
  
  getFullState() {
    const state: Record<string, any> = {};
    for (const [name, agency] of this.agencies) {
      if (agency.getState) {
        state[name] = agency.getState();
      }
    }
    return state;
  }
}
```

### Consistency Recommendations

#### Priority 1: Complete TTS Machine
```typescript
// src/latticework/tts/ttsMachine.ts
export const ttsMachine = createMachine({
  // States: idle, speaking, paused, stopped
  // Context: { text, currentWord, rate, pitch, volume }
  // Events: { type: 'SPEAK', data: TTSSpeakEvent }
});
```

#### Priority 2: Complete Transcription Machine
```typescript
// src/latticework/transcription/transcriptionMachine.ts
export const transcriptionMachine = createMachine({
  // States: idle, listening, recognizing, recognized
  // Context: { currentTranscript, isFinal, interim }
  // Events: { type: 'START_LISTENING' }
});
```

#### Priority 3: LipSync Machine (Optional)
```typescript
// src/latticework/lipsync/lipSyncMachine.ts
export const lipSyncMachine = createMachine({
  // States: idle, speaking
  // Context: { phonemes[], currentIndex, timeline }
  // Events: { type: 'START_PHONEMES', data: PhonemeSequence }
});
```

#### Priority 4: Create Architecture Guide
File: `/docs/SOCIETY_OF_MIND.md`
- Explain the trinity pattern
- Show complete example (copy from Animation Agency)
- Provide checklist for new agencies
- Document the philosophy

---

## Part 8: Architectural Patterns Found

### Pattern 1: Service Factory Pattern
**Used by**: Animation, Prosodic
```typescript
export function createAnimationService(host: HostCaps): AnimationServiceAPI {
  // Create machine and scheduler internally
  const machine = createActor(animationMachine).start();
  const scheduler = new AnimationScheduler(machine, host);
  
  // Return opaque API
  return {
    play: () => { ... },
    pause: () => { ... },
    // ... rest of API
  };
}
```

**Advantages**:
- Machine and Scheduler are internal (can't be accessed directly)
- Service is the only public interface
- Implementation can change without breaking consumers

### Pattern 2: Class-Based Service
**Used by**: LipSync, TTS, Transcription, EyeHeadTracking
```typescript
export class LipSyncService {
  constructor(config: LipSyncConfig, callbacks: LipSyncCallbacks) {
    // ...
  }
  
  public handleViseme(visemeId: VisemeID): void {
    // ...
  }
}
```

**Advantages**:
- Similar to factory but using `new`
- Can inherit and extend
- Clear lifecycle (constructor/dispose)

### Pattern 3: Orchestrator Service
**Used by**: Conversation
```typescript
export class ConversationService implements ConversationServiceAPI {
  constructor(
    tts: TTSService,
    transcription: TranscriptionService,
    config: ConversationConfig
  ) {
    // Composes other services
  }
  
  public start(flowGenerator: ConversationFlow) {
    // Coordinates agencies for dialogue flow
  }
}
```

**Advantages**:
- Higher-level coordination
- Not every service needs full trinity
- Works well for workflow orchestration

### Pattern 4: Utility Module Pattern
**Used by**: LipSync utilities (PhonemeExtractor, VisemeMapper)
```typescript
export const phonemeExtractor = {
  extractPhonemes(text: string): string[] { ... },
  addWord(word: string, phonemes: string[]): void { ... }
};
```

**Advantages**:
- Pure functions, no state
- Easy to test
- Can be used across agencies

### Pattern 5: Dual Submachine Pattern
**Used by**: EyeHeadTracking
```typescript
export class EyeHeadTrackingService {
  private eyeMachine: Actor<typeof eyeTrackingMachine>;
  private headMachine: Actor<typeof headTrackingMachine>;
  
  constructor(config, callbacks) {
    this.eyeMachine = createActor(eyeTrackingMachine, { input: config }).start();
    this.headMachine = createActor(headTrackingMachine, { input: config }).start();
    
    // Coordinate machines
    this.eyeMachine.subscribe((snapshot) => {
      if (snapshot.changed) {
        this.onEyeStateChange(snapshot);
        // Might trigger head following
      }
    });
  }
}
```

**Advantages**:
- Each submachine can be tested independently
- Coordination logic in Service
- Models dependent but separate systems

---

## Part 9: Recommendations for Future Development

### Immediate Actions (Priority 1)

1. **Document the Trinity Pattern**
   - Create `docs/AGENCY_PATTERN.md`
   - Provide template for new agencies
   - Link from main README

2. **Add TTS Machine**
   - Wraps Web Speech API state
   - Provides explicit transitions
   - Makes testing easier

3. **Add Transcription Machine**
   - Models listening/recognizing states
   - Improves clarity

### Medium-Term (Priority 2)

4. **Create New Agencies**
   - **Breathing Agency**: Chest/torso subtlemovement during idle
   - **Blinking Agency**: More sophisticated eye blink management
   - **Emotion Agency**: Coordinate multiple emotional expressions

5. **Improve Consistency**
   - Standardize Service factory vs. class-based
   - Add Scheduler to TTS, Transcription
   - Create AgencyRegistry for monitoring

### Long-Term (Priority 3)

6. **Advanced Features**
   - **Agency Learning**: Let agencies adapt based on feedback
   - **Dynamicriorities**: Adjust based on context
   - **Cross-Agency Communication**: Direct signaling between agencies
   - **Performance Monitoring**: Track each agency's overhead

7. **Developer Experience**
   - Create visual debugger for agency state
   - Build agency timeline visualizer
   - Add profiling tools for scheduler overhead

---

## Part 10: File Structure Reference

```
src/latticework/
├── animation/                    # ✅ COMPLETE PATTERN
│   ├── README.md
│   ├── animationService.ts      # Service: Factory function
│   ├── animationMachine.ts      # Machine: XState, LOAD/REMOVE/PLAY/PAUSE
│   ├── animationScheduler.ts    # Scheduler: Wall-clock, priority resolution
│   ├── types.ts
│   ├── __tests__/
│   │   ├── animationService.test.ts
│   │   ├── animationMachine.test.ts
│   │   └── animationScheduler.test.ts
│   └── snippets/                # Bundled animation libraries
│
├── prosodic/                     # ✅ COMPLETE PATTERN
│   ├── README.md
│   ├── prosodicService.ts       # Service: Factory function
│   ├── prosodicMachine.ts       # Machine: XState, START_SPEAKING/STOP_SPEAKING
│   ├── prosodicScheduler.ts     # Scheduler: Fade management, pulse timing
│   ├── types.ts
│   └── index.ts
│
├── lipsync/                      # ⚠️ PARTIAL (Service + Utilities)
│   ├── README.md
│   ├── lipSyncService.ts        # Service: Class-based
│   ├── PhonemeExtractor.ts      # Utility: Text → phoneme extraction
│   ├── VisemeMapper.ts          # Utility: Phoneme → viseme mapping
│   ├── visemeToARKit.ts         # Utility: Mapping to ARKit morphs
│   ├── types.ts
│   ├── [advanced analyzers]     # Coarticulation, emotional modulation, etc.
│   └── index.ts
│
├── tts/                          # ⚠️ PARTIAL (Service only)
│   ├── README.md
│   ├── ttsService.ts            # Service: Class-based, Web Speech + SAPI
│   ├── utils.ts                 # Utility: Timeline building
│   ├── types.ts
│   └── index.ts
│
├── transcription/                # ⚠️ PARTIAL (Service only)
│   ├── transcriptionService.ts  # Service: Class-based, Web Speech API
│   ├── types.ts
│   └── index.ts
│
├── eyeHeadTracking/              # ⚠️ PARTIAL (Service + Dual Machines)
│   ├── README.md
│   ├── eyeHeadTrackingService.ts # Service: Class-based
│   ├── eyeTrackingMachine.ts    # Submachine 1: Eye movements
│   ├── headTrackingMachine.ts   # Submachine 2: Head orientation
│   ├── types.ts
│   └── index.ts
│
├── conversation/                 # ⚠️ ORCHESTRATOR (Not full agency)
│   ├── conversationService.ts   # Service: Coordinates TTS + Transcription
│   ├── types.ts
│   └── index.ts
│
├── old_agencies/                 # 📦 ARCHIVED (Legacy implementations)
│   ├── action/
│   │   ├── visualizers/animation/     # Old animation (JavaScript)
│   │   ├── visualizers/emotiveExpression/
│   │   └── verbalizers/lipSync/
│   ├── cognition/
│   │   ├── conversation/              # Old conversation
│   │   ├── facs/                      # AU management (superseded)
│   │   └── surveyConversation/
│   └── perception/
│       └── audio/                     # Old transcription
│
└── latticework.d.ts              # Global type definitions
```

---

## Summary

### The Big Picture

LoomLarge implements a **Society of Mind** architecture where:

1. **Independent Agencies** operate semi-autonomously
   - Animation, Prosodic, LipSync, EyeHeadTracking, TTS, Transcription
   - Each focuses on one aspect of facial expression

2. **Standardized Pattern** (Service/Machine/Scheduler)
   - Animation and Prosodic fully conform ✅
   - LipSync, EyeHeadTracking partially conform ⚠️
   - TTS, Transcription use simpler patterns ⚠️

3. **Clear Communication**
   - Agencies interact via public Service APIs
   - Never directly access internal state
   - Priority-based conflict resolution
   - Wall-clock anchoring for independent timelines

4. **Emergent Complexity**
   - Simple local rules (each agency's logic)
   - Complex global behavior (natural speech animation)
   - No central controller

### Key Strengths
- ✅ Concurrent operation (agencies run in parallel)
- ✅ Clear separation of concerns
- ✅ Testable (each layer independent)
- ✅ Extensible (new agencies can be added)
- ✅ Philosophical coherence (true Society of Mind)

### Key Gaps
- ❌ Inconsistent use of pattern (some agencies missing Machine)
- ❌ Minimal documentation of the philosophy
- ❌ No agency registry or monitoring system
- ❌ Missing some state machines (TTS, Transcription)

### Next Steps
1. Document the trinity pattern clearly
2. Add missing machines to TTS and Transcription
3. Create agency registry for monitoring
4. Maintain pattern consistency as new agencies are added

