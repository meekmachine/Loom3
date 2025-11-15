# LipSync Agency

A modular system for managing lip-sync animation during speech using XState for state management and a scheduler for precise timing control.

---

## Architecture

The LipSync Agency follows the **Animation Agency pattern** with three core components:

```
┌─────────────────────────────────────────────────────────┐
│                  LipSync Agency                         │
│                                                         │
│  ┌───────────────────┐                                 │
│  │  LipSyncService   │  ← Public API                   │
│  │  (Factory)        │                                  │
│  └─────────┬─────────┘                                 │
│            │                                            │
│    ┌───────▼─────────┐      ┌─────────────────────┐   │
│    │  LipSyncMachine │◄─────┤  LipSyncScheduler   │   │
│    │    (XState)     │      │  (Curve Building &  │   │
│    └─────────────────┘      │   Scheduling)       │   │
│            │                 └──────────┬──────────┘   │
│            │                            │              │
│            ▼                            ▼              │
│     State Management          Animation Service        │
│     (word tracking)          (schedule/remove)         │
└─────────────────────────────────────────────────────────┘
```

### 1. **LipSyncMachine** (XState)

**File:** [lipSyncMachine.ts](./lipSyncMachine.ts)

State machine managing:
- **States:** `idle`, `speaking`, `ending`
- **Context:** Snippets array, word count, config
- **Events:** `START_SPEECH`, `PROCESS_WORD`, `END_SPEECH`, etc.

**State Diagram:**
```
     idle
      │
      │ START_SPEECH
      ▼
   speaking ◄──────┐
      │            │
      │ PROCESS_WORD (for each word)
      │            │
      │ END_SPEECH
      ▼            │
   ending          │
      │            │
      │ (all snippets completed)
      └────────────┘
```

### 2. **LipSyncScheduler**

**File:** [lipSyncScheduler.ts](./lipSyncScheduler.ts)

Manages:
- Phoneme extraction (word → phonemes)
- Viseme mapping (phonemes → SAPI visemes → ARKit indices)
- Animation curve building with natural easing
- Jaw coordination (AU 26) synchronized with visemes
- Snippet scheduling to Animation Service
- Neutral return animations
- Optional emotional modulation and coarticulation

### 3. **LipSyncService**

**File:** [lipSyncService.ts](./lipSyncService.ts)

Public API factory:
- Creates machine + scheduler
- Provides simple API: `startSpeech()`, `processWord()`, `endSpeech()`
- Handles host integration with Animation Service
- Supports callbacks for speech start/end events

---

## Usage

### Basic Example

```typescript
import { createLipSyncService } from './latticework/lipsync';

// Create service with animation service integration
const lipSync = createLipSyncService(
  {
    jawActivation: 1.5,
    lipsyncIntensity: 1.0,
    speechRate: 1.0,
    useEmotionalModulation: false,
    useCoarticulation: true,
  },
  {
    onSpeechStart: () => console.log('Speech started'),
    onSpeechEnd: () => console.log('Speech ended'),
  },
  {
    scheduleSnippet: (snippet) => animationService.schedule(snippet),
    removeSnippet: (name) => animationService.remove(name),
  }
);

// Start speech
lipSync.startSpeech();

// Process each word from TTS
const words = ['Hello', 'world', 'this', 'is', 'amazing'];
words.forEach((word, index) => {
  lipSync.processWord(word, index);
});

// End speech (with graceful neutral return)
lipSync.endSpeech();

// Cleanup
lipSync.dispose();
```

### With TTS Integration

```typescript
import { createTTSService } from './latticework/tts';
import { createLipSyncService } from './latticework/lipsync';

const tts = createTTSService({ engine: 'webSpeech' }, {
  onStart: () => {
    lipSync.startSpeech();
  },
  onBoundary: ({ word, charIndex }) => {
    if (word) {
      lipSync.processWord(word, wordIndex++);
    }
  },
  onEnd: () => {
    lipSync.endSpeech();
  },
});

// Speak text
await tts.speak('Hello world, this is amazing!');
```

### Class-Based API (Backward Compatible)

```typescript
import { LipSyncService } from './latticework/lipsync';

const lipSync = new LipSyncService(
  { jawActivation: 1.5 },
  { onSpeechStart: () => console.log('Started') }
);

lipSync.startSpeech();
lipSync.processWord('hello', 0);
lipSync.endSpeech();
```

---

## API Reference

### `createLipSyncService(config, callbacks, hostCaps)`

Factory function to create a LipSync service.

**Parameters:**

- **config**: `LipSyncConfig` (optional)
  ```typescript
  {
    jawActivation?: number;           // 0-2.0, jaw movement multiplier (default: 1.0)
    lipsyncIntensity?: number;        // 0-2.0, viseme intensity multiplier (default: 1.0)
    speechRate?: number;              // 0.1-10.0, speed multiplier (default: 1.0)
    useEmotionalModulation?: boolean; // Enable emotion-based adjustments (default: false)
    useCoarticulation?: boolean;      // Enable phoneme blending (default: true)

    // Legacy parameters (for backward compatibility):
    engine?: 'webSpeech' | 'sapi';    // TTS engine type (default: 'webSpeech')
    onsetIntensity?: number;          // 0-100, initial intensity (default: 90)
    holdMs?: number;                  // Hold duration in ms (default: 140)
  }
  ```

- **callbacks**: `LipSyncCallbacks` (optional)
  ```typescript
  {
    onSpeechStart?: () => void;
    onSpeechEnd?: () => void;
    onError?: (error: Error) => void;
  }
  ```

- **hostCaps**: `{ scheduleSnippet, removeSnippet }` (optional)
  - Integration with Animation Service
  - Defaults to global `window.anim` if available

**Returns:** `LipSyncServiceAPI`

### LipSyncServiceAPI Methods

#### `startSpeech()`
Start lip-sync session (transition to speaking state).

#### `processWord(word: string, wordIndex: number)`
Process a word and generate lip-sync animation:
1. Extracts phonemes from word
2. Maps phonemes to visemes
3. Builds animation curves with easing
4. Adds coordinated jaw movement
5. Schedules to Animation Service

#### `endSpeech()`
End speech with graceful neutral return (all visemes and jaw to 0).

#### `stop()`
Stop immediately without neutral return.

#### `updateConfig(config: Partial<LipSyncConfig>)`
Update configuration dynamically.

#### `getState(): { status, wordCount, isSpeaking }`
Get current state:
```typescript
{
  status: 'idle' | 'speaking' | 'ending';
  wordCount: number;
  isSpeaking: boolean;
}
```

#### `dispose()`
Cleanup and release resources.

---

## State Machine Details

### States

- **idle**: No speech active
- **speaking**: Processing words, animating visemes
- **ending**: Graceful transition back to neutral

### Events

| Event | Description | Transitions |
|-------|-------------|-------------|
| `START_SPEECH` | Begin speech session | idle → speaking |
| `PROCESS_WORD` | Process word boundary | (internal) |
| `END_SPEECH` | Begin graceful end | speaking → ending |
| `SNIPPET_SCHEDULED` | Track scheduled snippet | (internal) |
| `SNIPPET_COMPLETED` | Remove completed snippet | (internal) |
| `UPDATE_CONFIG` | Update configuration | (internal) |
| `STOP_IMMEDIATE` | Force stop | any → idle |

### Context

```typescript
{
  snippets: Array<{
    word: string;
    snippetName: string;
    scheduledName: string | null;
    completed: boolean;
  }>;
  isSpeaking: boolean;
  wordCount: number;
  config: {
    jawActivation: number;
    lipsyncIntensity: number;
    speechRate: number;
    useEmotionalModulation: boolean;
    useCoarticulation: boolean;
  };
}
```

---

## Scheduler Details

### Responsibilities

1. **Phoneme Extraction**: Text → phonemes using built-in dictionary
2. **Viseme Mapping**: Phonemes → SAPI visemes (0-21) → ARKit indices (0-14)
3. **Curve Building**: Generate smooth animation curves with easing
4. **Jaw Coordination**: Synchronized jaw (AU 26) movements
5. **Snippet Scheduling**: Package and schedule to Animation Service
6. **Neutral Return**: Smooth transition back to neutral state

### Animation Curve Generation

For each viseme, the scheduler creates smooth keyframes:

```typescript
// Natural easing with anticipation
const anticipation = durationInSec * 0.1;  // Small anticipation
const attack = durationInSec * 0.25;       // Attack to peak
const sustain = durationInSec * 0.45;      // Hold at peak

[
  { time: startTime, intensity: 0 },
  { time: startTime + anticipation, intensity: 30 },
  { time: startTime + attack, intensity: 95 },
  { time: startTime + sustain, intensity: 95 },
  { time: startTime + duration, intensity: 0 },
]
```

### Jaw Coordination

Jaw (AU 26) movements are calculated based on viseme type:
- Open vowels (AE, AA, AO, AW, AY): High jaw amount (0.7-0.9)
- Mid vowels (EY, OW, OY): Medium jaw amount (0.4-0.6)
- Closed vowels (IY, UW, ER): Low jaw amount (0.1-0.3)
- Consonants: Minimal jaw movement (0.0-0.2)

Jaw animation uses slower, smoother curves than lips.

---

## Integration with Animation Service

The LipSync Agency schedules snippets through the Animation Service with:

- **Category**: `'combined'` (visemes + AU)
- **Priority**: 50 (higher than emotions, lower than urgent overrides)
- **Loop**: Always `false`
- **Playback Rate**: Matches `speechRate` config
- **Auto-Cleanup**: Snippets automatically removed after completion

**Priority Hierarchy** (higher wins):
- Neutral return: 60
- Lip-sync visemes: 50
- Prosodic gestures: 30
- Emotional expressions: 1

---

## Phoneme → Viseme Mapping

### SAPI Visemes (22 total, IDs 0-21)

| Viseme ID | Phonemes | Description | ARKit Index |
|-----------|----------|-------------|-------------|
| 0 | Silence | Closed mouth | 0 |
| 1 | AE, AX, AH | Low vowels | 1 |
| 2 | AA | Open back vowel | 2 |
| 3 | AO | Mid back vowel | 3 |
| 4 | EY, EH, UH | Mid front vowels | 4 |
| 5 | ER | R-colored vowel | 5 |
| 6 | Y, IY, IH, IX | High front vowels | 6 |
| 7 | W, UW | High back vowels | 7 |
| 8 | OW | Mid back rounded | 8 |
| 9 | AW | Low back rounded | 9 |
| 10 | OY | Diphthong | 10 |
| 11 | AY | Diphthong | 11 |
| 12 | H | Glottal fricative | 12 |
| 13 | R | Liquid | 13 |
| 14 | L | Liquid | 14 |
| 15 | S, Z | Alveolar fricatives | 0 (reused) |
| 16 | SH, CH, JH, ZH | Post-alveolar fricatives | 1 (reused) |
| 17 | TH, DH | Dental fricatives | 2 (reused) |
| 18 | F, V | Labiodental fricatives | 3 (reused) |
| 19 | D, T, N | Alveolar stops | 4 (reused) |
| 20 | K, G, NG | Velar stops | 5 (reused) |
| 21 | P, B, M | Bilabial stops | 6 (reused) |

**Note:** ARKit has only 15 viseme blendshapes, so SAPI visemes 15-21 are mapped to reuse ARKit indices 0-6.

---

## Advanced Features

### Emotional Modulation (Optional)

When `useEmotionalModulation: true`, the system adjusts:
- Viseme intensity (happy: +20%, sad: -20%)
- Jaw activation (angry: +30%, contempt: -10%)
- Duration (excited: -15%, relaxed: +10%)

See [emotionalModulation.ts](./emotionalModulation.ts) for details.

### Coarticulation (Default: Enabled)

When `useCoarticulation: true`, the system applies:
- **Anticipatory coarticulation**: Next phoneme influences current (40ms window)
- **Carryover coarticulation**: Previous phoneme residual (30ms window)
- **Dominance functions**: Linear, sigmoid, and cosine blending curves

See [coarticulationModel.ts](./coarticulationModel.ts) for details.

---

## File Structure

```
lipsync/
├── README.md                     ← This file
├── index.ts                      ← Public API exports
├── types.ts                      ← Type definitions
├── lipSyncMachine.ts             ← XState machine (state management)
├── lipSyncScheduler.ts           ← Scheduler (curve building & scheduling)
├── lipSyncService.ts             ← Service factory (public API)
├── PhonemeExtractor.ts           ← Text → phonemes
├── VisemeMapper.ts               ← Phonemes → SAPI visemes
├── visemeToARKit.ts              ← SAPI → ARKit mapping
├── emotionalModulation.ts        ← Emotion-based adjustments (optional)
├── coarticulationModel.ts        ← Phoneme blending (optional)
└── performanceOptimizer.ts       ← LRU caching & metrics (optional)
```

---

## Comparison with Other Agencies

| Feature | Animation Agency | Prosodic Agency | LipSync Agency |
|---------|-----------------|-----------------|----------------|
| **State Machine** | ✅ `animationMachine.ts` | ✅ `prosodicMachine.ts` | ✅ `lipSyncMachine.ts` |
| **Scheduler** | ✅ `animationScheduler.ts` | ✅ `prosodicScheduler.ts` | ✅ `lipSyncScheduler.ts` |
| **Service Factory** | ✅ `createAnimationService()` | ✅ `createProsodicService()` | ✅ `createLipSyncService()` |
| **XState-Based** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Multiple Channels** | ✅ Many snippets | ✅ 2 channels (brow/head) | ✅ Per-word snippets |
| **Word Boundary** | ❌ No | ✅ Pulse timing | ✅ Word processing |
| **Jaw Coordination** | ❌ No | ❌ No | ✅ AU 26 sync |
| **Phoneme Extraction** | ❌ No | ❌ No | ✅ Built-in dictionary |
| **Coarticulation** | ❌ No | ❌ No | ✅ Optional |

---

## Testing

See [testUtilities.ts](./testUtilities.ts) for comprehensive test suite:

```typescript
import { createLipSyncTestSuite } from './latticework/lipsync/testUtilities';

const testSuite = createLipSyncTestSuite();

// Run all tests
const results = [
  ...testSuite.testPhonemeExtraction(),
  ...testSuite.testVisemeMapping(),
  ...testSuite.testARKitConversion(),
  ...testSuite.testCoarticulation(),
  ...testSuite.testPerformance(),
];

console.table(results);
```

---

## Future Enhancements

1. **SAPI Backend Integration**: Direct viseme timeline from Azure TTS
2. **Multi-Language Support**: Phoneme dictionaries for other languages
3. **Real-Time Adjustment**: Dynamic intensity based on audio analysis
4. **Emotion-Aware Defaults**: Auto-detect emotion from text sentiment
5. **Performance Metrics**: Track latency and cache hit rates

---

## Credits

Based on the Animation Agency architecture pattern established in [src/latticework/animation/](../animation/).

Inspired by JALI research: Edwards, P., Landreth, C., Fiume, E., & Singh, K. (2016). JALI: An animator-centric viseme model for expressive lip synchronization. *ACM Transactions on Graphics*, 35(4).

**See also:**
- [Animation Agency README](../animation/README.md)
- [Prosodic Expression Agency README](../prosodic/README.md)
- [Lip-Sync Complete Guide](../../../docs/LIPSYNC_COMPLETE_GUIDE.md)
