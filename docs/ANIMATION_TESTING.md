# Animation Testing Guide

This guide explains how to test and refine lip sync animations using the sample snippets and animation tester.

## Quick Start

1. **Open the Application**
   - Start the dev server: `npm run dev`
   - Open the browser console (for debugging)

2. **Access the Animation Tester**
   - Click the menu button (top-left)
   - Find "Animation Tester" section in the drawer
   - Expand it

3. **Load and Play Samples**
   - Select a snippet from the dropdown (e.g., "Word: 'hello'")
   - Click "Load & Play"
   - Watch the face animate!

4. **View the Curves**
   - Toggle "Use curve editor" ON in the drawer controls
   - Expand "Visemes (Speech)" section
   - You'll see curve editors for each active viseme with playback position

## Sample Snippets

### Single Words
- **hello** - /HH EH L OW/ - Tests H, EH, L, OW visemes
- **world** - /W ER L D/ - Tests W, ER, L, D visemes
- **speech** - /S P IY CH/ - Tests S, P, IY, CH visemes
- **amazing** - /AH M EY Z IH NG/ - Longer word with 6 phonemes
- **anthropic** - /AE N TH R AH P IH K/ - 8 phonemes, complex
- **beautiful** - /B Y UW T AH F AH L/ - 8 phonemes, lots of jaw movement

### Phrases
- **hello world** - Two-word phrase combining multiple visemes

## Understanding the Architecture

### Snippet Structure
Each lip sync snippet is a **combined** animation containing:
- Multiple viseme curves (indices 0-14)
- Jaw motion curve (AU 26)
- All synchronized to create natural speech

```json
{
  "name": "lipsync_hello",
  "snippetCategory": "combined",
  "snippetPriority": 50,
  "curves": {
    "12": [...],  // H viseme (VISEME_KEYS[12])
    "4": [...],   // EH viseme (VISEME_KEYS[4])
    "14": [...],  // L viseme (VISEME_KEYS[14])
    "8": [...],   // OW viseme (VISEME_KEYS[8])
    "26": [...]   // Jaw (AU 26)
  }
}
```

### Why Combined?
- **Single snippet per word** = all visemes work together
- **Coordinated timing** = jaw and lips move in sync
- **Priority-based blending** = lip sync (priority 50) overrides expressions (priority 10-20)
- **No conflicts** = all curves in one snippet means smooth transitions

### Viseme Index Mapping
Visemes use numeric indices (0-14) that map to the ARKit VISEME_KEYS array:

```
0: 'Ah'          - Wide open vowel
1: 'W_OO'        - Rounded lips
2: 'Oh'          - Medium rounded
3: 'EE'          - Lips spread
4: 'Er'          - R-colored vowel
5: 'IH'          - Small open
6: 'AE'          - Medium open
7: 'R'           - R consonant
8: 'S_Z'         - Sibilant
9: 'Ch_J'        - Affricate
10: 'F_V'        - Labiodental
11: 'TH'         - Dental
12: 'T_L_D_N'    - Alveolar
13: 'B_M_P'      - Bilabial (closed)
14: 'K_G_H_NG'   - Velar/glottal
```

## Testing and Refinement

### What to Test

1. **Timing**
   - Do visemes start/end at the right times?
   - Are transitions smooth?
   - Does coarticulation look natural?

2. **Intensity**
   - Are viseme shapes strong enough (0-100 range)?
   - Does jaw open appropriately?
   - Any overshoot or undershoot?

3. **Coordination**
   - Do lips and jaw move together?
   - Does anticipation feel natural?
   - Is release smooth?

4. **Visual Quality**
   - Does it look like natural speech?
   - Any "popping" between visemes?
   - Mouth returning to neutral correctly?

### How to Refine

#### Adjust Timing
Edit the keyframe `time` values in the JSON:
```json
{ "time": 0.12, "intensity": 0 },   // Start time
{ "time": 0.14, "intensity": 30 },  // Anticipation
{ "time": 0.17, "intensity": 95 },  // Peak
{ "time": 0.22, "intensity": 100 }, // Sustain
{ "time": 0.24, "intensity": 0 }    // Release
```

#### Adjust Intensity
Change the `intensity` values (0-100):
- **30** = Gentle anticipation
- **95-100** = Full viseme shape
- **0** = Neutral/transition

#### Adjust Jaw Amount
Modify AU 26 curve for more/less jaw movement:
```json
"26": [
  { "time": 0.00, "intensity": 0 },
  { "time": 0.10, "intensity": 40 },  // Less jaw (was 60)
  { "time": 0.24, "intensity": 0 }
]
```

#### Add Coarticulation
Leave residual intensity between adjacent visemes:
```json
// Instead of dropping to 0 between visemes:
{ "time": 0.24, "intensity": 15 }  // 15% carryover
```

### Console Utilities

The animation loader is available in the browser console:

```javascript
// Get reference to animation service
const anim = window.threeState?.anim;

// Load a snippet manually
const snippet = {
  name: "test_snippet",
  snippetCategory: "combined",
  snippetPriority: 50,
  snippetPlaybackRate: 1.0,
  snippetIntensityScale: 1.0,
  loop: false,
  curves: {
    "0": [
      { time: 0.0, intensity: 0 },
      { time: 0.1, intensity: 90 },
      { time: 0.2, intensity: 0 }
    ],
    "26": [
      { time: 0.0, intensity: 0 },
      { time: 0.1, intensity: 60 },
      { time: 0.2, intensity: 0 }
    ]
  }
};
window.animLoader.loadSnippet(anim, snippet);

// Play it
window.animLoader.playSnippet(anim, "test_snippet");

// Remove it
window.animLoader.removeSnippet(anim, "test_snippet");

// Clear all
window.animLoader.clearAllSnippets(anim);

// Load from JSON file
window.animLoader.loadSnippetsFromJSON(anim, "/docs/sample-lipsync-animations.json");
```

## Common Issues

### Visemes Competing
**Problem**: Individual visemes override each other
**Solution**: Ensure all visemes for a word are in ONE snippet with `snippetCategory: "combined"`

### Curves Not Showing in UI
**Problem**: Curves don't appear in curve editor
**Solution**:
1. Enable "Use curve editor" toggle
2. Check that snippet is loaded (not just playing)
3. Verify `isPlaying: true` in snippet state

### Jaw Not Moving
**Problem**: Only lips move, no jaw
**Solution**: Add AU 26 curve to the snippet with appropriate intensity (0-100 range)

### Mouth Stuck Open/Closed
**Problem**: Visemes don't return to neutral
**Solution**: Ensure last keyframe has `intensity: 0` and add neutral hold at end

### Choppy Animation
**Problem**: Sharp transitions between visemes
**Solution**:
1. Add more keyframes for smoother curves
2. Use anticipation/overshoot/settle pattern
3. Add coarticulation (15% residual)

## Performance Tips

1. **Snippet Count**: Keep < 10 active snippets for best performance
2. **Keyframe Density**: 3-5 keyframes per viseme is optimal
3. **Priority Conflicts**: Use priority 50 for lip sync, lower for other animations
4. **Cleanup**: Remove completed snippets to reduce memory

## Next Steps

1. Test all sample snippets
2. Note which ones need refinement
3. Adjust timing/intensity values
4. Test with TTS to compare
5. Create new snippets for common utterances
6. Build a library of reusable animations

## File Locations

- **Sample JSON**: `/docs/sample-lipsync-animations.json`
- **Animation Loader**: `/src/utils/animationLoader.ts`
- **Animation Tester UI**: `/src/components/au/AnimationTester.tsx`
- **SliderDrawer (curve editor)**: `/src/components/SliderDrawer.tsx`
