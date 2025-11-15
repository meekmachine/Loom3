# LoomLarge Architecture Summary

**Full analysis available in**: `/SOCIETY_OF_MIND_ANALYSIS.md`

## Quick Overview

LoomLarge implements a **"Society of Mind"** architecture with 7 semi-autonomous agencies coordinating to create natural facial animation and expression.

### The Core Pattern: Service/Machine/Scheduler Trinity

Every agency consists of three layers:

```
┌─────────────────────────────────────────────┐
│ SERVICE (Public API)                        │
│ - Factory or class with public methods      │
├─────────────────────────────────────────────┤
│ MACHINE (XState)                            │
│ - State management, pure transitions        │
├─────────────────────────────────────────────┤
│ SCHEDULER (Execution)                       │
│ - Timing, side effects, rendering           │
└─────────────────────────────────────────────┘
```

## Agency Inventory

### Complete Implementations (✅ Full Trinity)

| Agency | Status | Service | Machine | Scheduler | Role |
|--------|--------|---------|---------|-----------|------|
| **Animation** | ✅ Complete | `animationService.ts` | `animationMachine.ts` | `animationScheduler.ts` | Core animation engine, all others depend on it |
| **Prosodic** | ✅ Complete | `prosodicService.ts` | `prosodicMachine.ts` | `prosodicScheduler.ts` | Speech gestures (brows, head nods) |

### Partial Implementations (⚠️ Incomplete)

| Agency | Status | Components | Justification |
|--------|--------|------------|----------------|
| **LipSync** | ⚠️ Service + Utils | Service, Utilities | Deterministic phoneme→viseme; uses Animation Service scheduler |
| **EyeHeadTracking** | ⚠️ Service + Dual Machines | Service, Eye Machine, Head Machine | Eye/head are semi-independent; relies on Animation Service |
| **TTS** | ⚠️ Service Only | Service | Web Speech API is implicit state source |
| **Transcription** | ⚠️ Service Only | Service | Simple callback-based, Web Speech API state |

### Orchestrators (⚠️ Special Case)

| Agency | Status | Role |
|--------|--------|------|
| **Conversation** | ⚠️ Orchestrator | Coordinates TTS + Transcription for dialogue flow; not a traditional agency |

## Philosophy: How It Embodies "Society of Mind"

**Marvin Minsky's core concept**: "The mind is a society of simple agents"

### Key Principles Implemented

1. **No Central Controller**: Each agency operates semi-autonomously
   - Animation, LipSync, Prosodic, EyeHeadTracking run concurrently
   - Each has independent timeline (wall-clock anchoring)

2. **Local Rules**: Each agency follows simple rules for its domain
   - Animation: "Apply curves based on wall time"
   - Prosodic: "Pulse every word, fade gracefully"
   - LipSync: "Map phonemes to visemes"
   - EyeHeadTracking: "Saccade to target, head follows eyes"

3. **Emergent Behavior**: Complex behavior emerges from simple combinations
   - No central "expression director"
   - Natural speech = mouth + prosody + gaze working together

4. **Parallel Execution**: Agencies run concurrently without blocking
   - Wall-clock anchoring ensures independent timelines
   - Priority resolution handles conflicts naturally

5. **Composable Communication**: Agencies interact via well-defined APIs
   - Prosodic uses Animation's public API (never direct machine access)
   - Clean dependency graph with no circular references

## Priority Hierarchy

When multiple agencies control the same facial feature:

```
Priority 20: EyeHeadTracking (gaze MUST be visible)
Priority 15: LipSync        (mouth sync critical)
Priority  5: Prosodic       (gesture emphasis)
Priority  0: Emotion/Idle   (baseline expression)
```

Higher priority wins; on tie, higher intensity value wins.

## Agency Dependency Graph

```
Conversation Service (orchestrator)
  ├─→ TTS Service (output)
  ├─→ Transcription Service (input)
  └─→ Animation Service (core)
       ├─→ LipSync Service
       ├─→ Prosodic Service
       └─→ EyeHeadTracking Service
```

Each arrow represents "uses public API of".

## Key Strengths

✅ **Concurrent Operation**: Multiple animations run in parallel with independent control  
✅ **Clear Contracts**: Agencies interact only via Service APIs  
✅ **Testable**: Each layer can be tested in isolation  
✅ **Extensible**: New agencies can be added without changing existing ones  
✅ **Deterministic**: XState machines guarantee predictable transitions  
✅ **Pragmatic**: Priorities provide deterministic conflict resolution  

## Key Gaps

❌ **Inconsistent Pattern**: Some agencies missing Machine/Scheduler components  
❌ **Documentation**: No unified "how to create a new agency" guide  
❌ **Monitoring**: No central registry of active agencies  
❌ **State Transparency**: Some state is implicit (Web Speech API)  
❌ **Testing**: Prosodic tests minimal, no dedicated agency tests  

## Recommendations (Priority Order)

### Priority 1: Document the Pattern
- Create `docs/AGENCY_PATTERN.md` with template
- Explain trinity pattern clearly
- Provide "Creating a New Agency" checklist

### Priority 2: Complete Missing Machines
- Add `ttsMachine` for explicit state (speaking/paused/idle)
- Add `transcriptionMachine` for explicit state (listening/recognizing/idle)
- Makes testing and debugging easier

### Priority 3: Improve Consistency
- Standardize on factory function pattern
- Add tests for all agencies
- Create AgencyRegistry for monitoring

### Priority 4: Advanced Features
- Dynamic priority adjustment
- Agency-to-agency signaling
- Performance monitoring per agency

## Where to Find Code

| File | Purpose |
|------|---------|
| `src/latticework/animation/` | Reference implementation of trinity pattern |
| `src/latticework/prosodic/` | Example of agency using another agency's API |
| `src/latticework/lipsync/` | Simpler service using utilities instead of machine |
| `src/latticework/tts/` | Service wrapping Web Speech API |
| `src/latticework/eyeHeadTracking/` | Service with dual submachines |
| `src/latticework/conversation/` | Orchestrator coordinating multiple agencies |
| `src/latticework/old_agencies/` | Legacy JavaScript implementations (archived) |

## Quick Example: How It Works

```typescript
// 1. Create animation service
const animationService = createAnimationService(engine);

// 2. Create prosodic service (depends on animation)
const prosodic = createProsodicService({}, {}, {
  scheduleSnippet: (snippet) => animationService.schedule(snippet),
  removeSnippet: (name) => animationService.remove(name)
});

// 3. Create TTS service
const tts = createTTSService({ engine: 'webSpeech' }, {
  onBoundary: (word) => prosodic.pulse(wordIndex++)
});

// 4. Start talking (agents coordinate automatically)
await tts.speak('Hello world');
// → TTS emits word boundaries
// → Prosodic pulses on boundaries
// → Prosodic schedules gestures to Animation
// → Animation applies all curves with priority resolution
// → Result: Natural speech with synchronized mouth and gestures
```

## Next Steps

1. Read `/SOCIETY_OF_MIND_ANALYSIS.md` for complete details
2. Review animation/README.md as reference implementation
3. Check `src/latticework/prosodic/` for example of proper agency composition
4. Consider following the pattern when adding new agencies

---

**Last Updated**: November 15, 2025  
**Analysis Depth**: Complete (all 7 agencies documented)  
**Recommendations**: 15+ specific improvements identified
