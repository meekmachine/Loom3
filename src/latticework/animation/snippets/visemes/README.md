# Viseme Animation Best Practices

Guide for creating realistic lip sync animations using combined viseme snippets.

## JALI Model Integration

This implementation uses the **JALI (Jaw And Lip Integration)** model from:

> Edwards, P., Landreth, C., Fiume, E., & Singh, K. (2016). **JALI: An Animator-Centric Viseme Model for Expressive Lip Synchronization.** *ACM Transactions on Graphics (TOG)*, 35(4), Article 127. SIGGRAPH 2016.

The JALI model separates jaw movement from lip articulation, allowing independent control of:
- **Jaw activation** (AU 26): Controls vertical jaw opening/closing
- **Lip intensity** (Visemes 0-14): Controls ARKit viseme morph targets

This separation enables different speech styles through parameter variation.

## Speech Style Variations

Different speaking contexts require different amounts of articulatory effort. The JALI model captures this through two parameters:

### Parameter Ranges

| Style | Jaw Activation | Lip Intensity | Use Case |
|-------|----------------|---------------|----------|
| **Mumbled** | 0.3-0.6 | 0.4-0.7 | Tired, distracted, private conversation |
| **Relaxed** | 0.8-1.1 | 0.8-1.0 | Casual conversation, informal dialogue |
| **Natural** | 1.0-1.3 | 1.0-1.2 | Standard conversational speech (default) |
| **Precise** | 1.5-1.8 | 1.3-1.6 | News anchors, public speaking, clear enunciation |
| **Theatrical** | 1.8-2.5 | 1.7-2.2 | Stage performance, exaggerated for visibility |

### Snippet Metadata Format

All viseme snippets should include JALI parameters in their metadata:

```json
{
  "name": "lipsync:word_style",
  "description": "JALI-based lip-sync: 'word' - Style description",
  "snippetCategory": "combined",
  "snippetPriority": 50,
  "snippetPlaybackRate": 1.0,
  "snippetIntensityScale": 1.0,
  "loop": false,
  "maxTime": 0.65,
  "jaliReference": "Edwards et al., SIGGRAPH 2016 - Jaw And Lip Integration model",
  "jaliParameters": {
    "jawActivation": 1.2,
    "lipsyncIntensity": 1.0,
    "speechStyle": "natural",
    "description": "Standard conversational speech combining viseme morphs (0-14) and jaw AU (26)"
  },
  "curves": {
    "12": [...],  // Viseme curve
    "26": [...]   // Jaw curve
  }
}
```

### Creating Speech Style Variations

When creating different speech styles for the same word:

1. **Start with accurate phoneme timing** - Get the base timing right first
2. **Scale viseme intensities** - Multiply by `lipsyncIntensity` (0.4-2.2)
3. **Scale jaw movements** - Multiply by `jawActivation` (0.3-2.5)
4. **Adjust attack/release** - Faster for precise/theatrical, slower for mumbled
5. **Document style in metadata** - Include `jaliParameters` section

**Example naming convention:**
- `lipsync_hello_world.json` - Natural/default style
- `lipsync_hello_relaxed.json` - Relaxed variation
- `lipsync_hello_precise.json` - Precise variation
- `lipsync_hello_mumbled.json` - Mumbled variation
- `lipsync_hello_theatrical.json` - Theatrical variation

## Core Principles

### 1. **Independent Viseme Activation**
Each viseme should activate **independently** with minimal overlap. Realistic speech shows distinct mouth shapes, not smooth morphing.

**Bad (Blurry):**
```json
"4": [
  {"time": 0.12, "intensity": 0},
  {"time": 0.14, "intensity": 30},    // Gradual rise
  {"time": 0.17, "intensity": 95},    // Slow to peak
  {"time": 0.22, "intensity": 100},   // Long hold
  {"time": 0.24, "intensity": 15}     // Blends into next
]
```

**Good (Clear):**
```json
"4": [
  {"time": 0.12, "intensity": 0},     // Start from neutral
  {"time": 0.14, "intensity": 100},   // SNAP to peak (20ms)
  {"time": 0.22, "intensity": 100},   // Hold steady
  {"time": 0.24, "intensity": 0}      // SNAP back to neutral (20ms)
]
```

### 2. **Timing Guidelines**

| Phoneme Type | Duration | Attack | Release | Notes |
|--------------|----------|--------|---------|-------|
| **Plosives** (P, B, T, D, K, G) | 40-60ms | 10ms | 10ms | Very fast, sharp |
| **Fricatives** (F, V, S, Z, SH) | 60-80ms | 15ms | 15ms | Quick but sustained |
| **Nasals** (M, N, NG) | 50-70ms | 10ms | 10ms | Fast closure |
| **Approximants** (R, L, W, Y) | 70-100ms | 20ms | 20ms | Slightly smoother |
| **Short Vowels** (IH, EH, UH) | 80-120ms | 20ms | 20ms | Brief but clear |
| **Long Vowels** (EE, AH, OO, OH) | 120-180ms | 25ms | 25ms | Held steady |
| **Diphthongs** (AY, OW, OY) | 140-200ms | 30ms | 30ms | Two-part motion |

### 3. **Return to Neutral**

**Critical**: Add 10-30ms neutral gaps between most phonemes for clarity.

```json
{
  "curves": {
    "15": [  // S sound
      {"time": 0.00, "intensity": 0},
      {"time": 0.01, "intensity": 100},
      {"time": 0.06, "intensity": 100},
      {"time": 0.07, "intensity": 0}    // Return to neutral
    ],
    // 20ms GAP (0.07 → 0.09) for visual separation
    "21": [  // P sound
      {"time": 0.09, "intensity": 0},   // Start from neutral
      {"time": 0.10, "intensity": 100},
      {"time": 0.14, "intensity": 100},
      {"time": 0.15, "intensity": 0}
    ]
  }
}
```

### 4. **Jaw Motion Principles**

**Jaw moves differently than lips:**
- Opens **before** vowels (anticipation)
- Closes **after** vowels (delayed)
- Smoother, slower motion than lip shapes
- Less extreme range (avoid 100% unless screaming)

```json
"26": [  // Jaw for word "CAT" /K AE T/
  {"time": 0.00, "intensity": 0},     // K - jaw neutral
  {"time": 0.03, "intensity": 20},    // Anticipate AE
  {"time": 0.06, "intensity": 60},    // AE - moderate open
  {"time": 0.16, "intensity": 60},    // Hold through vowel
  {"time": 0.20, "intensity": 10},    // T - nearly closed
  {"time": 0.22, "intensity": 0}      // Return neutral
]
```

**Jaw opening by viseme type:**
- Closed consonants (P, B, M): 0%
- Narrow consonants (S, Z, F, V, TH): 5-15%
- Alveolar (T, D, N, L): 10-20%
- Small vowels (IH, EH): 30-40%
- Medium vowels (ER, UH): 40-50%
- Wide vowels (AE, AH): 60-75%
- Very wide (AA, OH): 75-90%

### 5. **Coarticulation (When to Blend)**

Only use blending (residual intensity) in these cases:

**YES - Natural blends:**
- Consonant clusters: "str", "spl", "thr" (15% residual)
- Same viseme twice: "mommy", "daddy" (30% residual)
- Liquid + vowel: "la", "ra", "wa" (20% residual)

**NO - Keep separate:**
- Different vowels: "a" → "e" (return to 0)
- Vowel → consonant: "at" (return to 0)
- Different consonant types: "pt", "ks" (return to 0)

### 6. **Intensity Curves**

**Use 3-point curves for clarity:**

```json
// Simple 3-point (best for consonants)
[
  {"time": t, "intensity": 0},
  {"time": t + attack, "intensity": 100},
  {"time": t + duration, "intensity": 0}
]

// 4-point with hold (vowels)
[
  {"time": t, "intensity": 0},
  {"time": t + attack, "intensity": 100},
  {"time": t + sustain, "intensity": 100},
  {"time": t + duration, "intensity": 0}
]
```

**Avoid:**
- Gradual ramps (30 → 60 → 90 → 100)
- Overshoot (100 → 110 → 95)
- Complex easing (5+ keyframes per viseme)

### 7. **Priority and Categories**

```json
{
  "snippetCategory": "combined",  // Visemes + jaw in one snippet
  "snippetPriority": 50,          // High (overrides expressions)
  "snippetPlaybackRate": 1.0,     // Normal speed
  "snippetIntensityScale": 1.0    // Full strength
}
```

## Complete Example: "CAT"

Phonemes: /K AE T/
- K (velar): Index 20, 50ms
- AE (vowel): Index 6, 120ms
- T (alveolar): Index 19, 40ms

```json
{
  "name": "lipsync_cat",
  "description": "Word: 'cat' - /K AE T/",
  "snippetCategory": "combined",
  "snippetPriority": 50,
  "snippetPlaybackRate": 1.0,
  "snippetIntensityScale": 1.0,
  "loop": false,
  "curves": {
    "20": [
      {"time": 0.00, "intensity": 0},
      {"time": 0.01, "intensity": 100},
      {"time": 0.05, "intensity": 100},
      {"time": 0.06, "intensity": 0}
    ],
    "6": [
      {"time": 0.08, "intensity": 0},
      {"time": 0.10, "intensity": 100},
      {"time": 0.20, "intensity": 100},
      {"time": 0.22, "intensity": 0}
    ],
    "19": [
      {"time": 0.24, "intensity": 0},
      {"time": 0.25, "intensity": 100},
      {"time": 0.28, "intensity": 100},
      {"time": 0.29, "intensity": 0}
    ],
    "26": [
      {"time": 0.00, "intensity": 0},
      {"time": 0.03, "intensity": 20},
      {"time": 0.08, "intensity": 65},
      {"time": 0.22, "intensity": 65},
      {"time": 0.27, "intensity": 10},
      {"time": 0.29, "intensity": 0}
    ]
  }
}
```

## Viseme Index Reference

| Index | ARKit Key | IPA Examples | Type | Jaw % |
|-------|-----------|--------------|------|-------|
| 0 | Ah | /ɑ/ "father" | Wide vowel | 80 |
| 1 | W_OO | /w/ "want", /u/ "boot" | Rounded | 40 |
| 2 | Oh | /o/ "go" | Mid round | 70 |
| 3 | EE | /i/ "see" | High front | 20 |
| 4 | Er | /ɜ/ "bird" | R-color | 45 |
| 5 | IH | /ɪ/ "sit" | High front | 30 |
| 6 | AE | /æ/ "cat" | Low front | 65 |
| 7 | R | /r/ "red" | Approximant | 30 |
| 8 | S_Z | /s/ "sit", /z/ "zoo" | Fricative | 10 |
| 9 | Ch_J | /tʃ/ "church", /dʒ/ "judge" | Affricate | 20 |
| 10 | F_V | /f/ "fan", /v/ "van" | Fricative | 15 |
| 11 | TH | /θ/ "think", /ð/ "this" | Fricative | 20 |
| 12 | T_L_D_N | /t/ "top", /l/ "let", /d/ "do", /n/ "no" | Alveolar | 15 |
| 13 | B_M_P | /b/ "bat", /m/ "mat", /p/ "pat" | Bilabial | 0 |
| 14 | K_G_H_NG | /k/ "cat", /g/ "go", /h/ "hat", /ŋ/ "sing" | Velar | 35 |

## Common Mistakes

### ❌ DON'T: Smooth Morphing
```json
// This creates blurry, unrealistic motion
{"time": 0.12, "intensity": 0},
{"time": 0.14, "intensity": 30},
{"time": 0.17, "intensity": 60},
{"time": 0.20, "intensity": 90},
{"time": 0.22, "intensity": 100},
{"time": 0.24, "intensity": 80},
{"time": 0.26, "intensity": 50},
{"time": 0.28, "intensity": 20},
{"time": 0.30, "intensity": 0}
```

### ✅ DO: Sharp Articulation
```json
// Clear, realistic phoneme
{"time": 0.12, "intensity": 0},
{"time": 0.14, "intensity": 100},
{"time": 0.22, "intensity": 100},
{"time": 0.24, "intensity": 0}
```

### ❌ DON'T: Continuous Blending
```json
// No visual separation between phonemes
"4": [..., {"time": 0.24, "intensity": 15}],  // Residual
"8": [{"time": 0.24, "intensity": 15}, ...]   // Picks up residual
```

### ✅ DO: Clear Separation
```json
// Neutral gap for visual clarity
"4": [..., {"time": 0.24, "intensity": 0}],
// 20ms gap
"8": [{"time": 0.26, "intensity": 0}, ...]
```

## Testing Checklist

- [ ] Each viseme peaks at 100% (or close)
- [ ] Attack time < 25ms for most phonemes
- [ ] Release time < 25ms for most phonemes
- [ ] 10-30ms neutral gaps between distinct phonemes
- [ ] Jaw opens before vowels, closes after
- [ ] Jaw range appropriate (consonants 0-20%, vowels 30-90%)
- [ ] No unnecessary blending between different phoneme types
- [ ] Total duration feels natural (not too slow/fast)
- [ ] Can clearly see each mouth shape when playing

## Quick Reference: Timing Template

```javascript
const TIMING = {
  // Consonants
  plosive:    { attack: 10, hold: 30, release: 10 },  // 50ms total
  fricative:  { attack: 15, hold: 45, release: 15 },  // 75ms total
  nasal:      { attack: 10, hold: 40, release: 10 },  // 60ms total
  liquid:     { attack: 20, hold: 50, release: 20 },  // 90ms total

  // Vowels
  short:      { attack: 20, hold: 70, release: 20 },  // 110ms total
  long:       { attack: 25, hold: 110, release: 25 }, // 160ms total
  diphthong:  { attack: 30, hold: 130, release: 30 }, // 190ms total

  // Gaps
  neutralGap: 20  // ms between most phonemes
};
```

## Summary

**The key to realistic lip sync is CLARITY, not smoothness.**

Think of it like sign language - each hand position is distinct and held briefly, not morphed continuously. Lip sync works the same way. Each viseme is a clear "sign" that the mouth makes, and stringing them together quickly creates the illusion of speech.

**Golden Rule**: If you can't clearly identify each phoneme's mouth shape when watching at 0.5x speed, the animation is too blurry.
