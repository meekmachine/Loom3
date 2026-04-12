# Loom3 README Findings

This note is the research-backed bridge between the old README and the new one.

The point is not to make the package docs shorter. The point is to make them better:

- broad enough to cover the full shipped surface
- accurate about the current code
- ordered around what readers actually care about
- strong enough to explain why Loom3 matters as an animation system, not just as a mapping table

## 1. What The README Should Lead With

The README should open by saying, in plain English, that Loom3 creates performant, mixable Three.js character animation that is still easy to compose.

That is the right top-level story because the architecture really does support it:

- Loom3 uses Three.js `AnimationMixer` for clip playback and procedural clip playback.
- Loom3 can build mixer-playable clips from semantic curves instead of forcing users to hand-author raw keyframe tracks.
- Loom3 can combine morph target animation with bone rotation and bone translation.
- Loom3 uses a FACS-based semantic layer, which means the control vocabulary is well-defined and reusable even when the underlying rig is not.

The first paragraph should therefore sound more like:

> Loom3 is an expressive animation engine for Three.js characters. It gives you performant, mixable animation built on `AnimationMixer`, but lets you author and control that animation in a higher-level language: Action Units, speech animation, morph targets, bone rotations, and reusable profile mappings instead of one-off rig plumbing.

## 2. `AnimationMixer` Is A Core Value Prop, Not A Detail

The README needs to say this explicitly.

### What the code actually does

- `BakedAnimationController` owns an `AnimationMixer` in `src/engines/three/AnimationThree.ts:197`
- the mixer is created lazily in `src/engines/three/AnimationThree.ts:1160`
- baked clips are played by name through `playAnimation()` in `src/engines/three/AnimationThree.ts:287`
- procedural clips are generated through `snippetToClip()` in `src/engines/three/AnimationThree.ts:504`
- generated clips are played through the same mixer in `playClip()` in `src/engines/three/AnimationThree.ts:824`

### Why this matters

This is one of the strongest things about Loom3.

It means:

- imported baked animation and generated runtime animation live in the same playback world
- those animations can be mixed, weighted, crossfaded, paused, resumed, and layered with the same surface
- the system is useful for real-time character interaction, not just static playback

This should be described as a major differentiator.

## 3. The README Should Not Use `Viseme` As The Main User-Facing Heading

The user-facing section should be called:

- `Lip Sync`
- or `Lip Sync and Speech Animation`

`viseme` should be introduced later as the current low-level API term.

That is clearer for a broad audience and better matches what people think they are trying to do.

## 4. Lip Sync Should Be Framed As Speech Animation, Not Mouth-Shape Swapping

The README should explain that believable speech animation is not just changing mouth shapes.

It should say that Loom3 supports speech animation by coordinating:

- lip-driven morph target influence
- jaw-driven bone motion
- timing over animation curves
- mixable playback inside the same animation system as the rest of the character

### JALI is the right research reference here

The JALI paper matters because it frames speech animation around two distinct anatomical actions:

- Jaw
- Lip

and explains that the mapping from phonemes to visible speech is many-valued rather than flat.

The JALI abstract says:

- the mapping from phonemes to visemes is inherently many-valued
- the system captures variation using two visually distinct anatomical actions: Jaw and Lip
- acoustic properties map naturally to the dynamic degree of jaw and lip in visual speech

Source:

- Project page: https://www.dgp.toronto.edu/~elf/jali.html
- Paper PDF: https://www.dgp.toronto.edu/~elf/JALISIG16.pdf

### What the README should say

The README should explain, clearly and without assuming prior familiarity:

- realistic speech animation needs both lip articulation and jaw movement
- changing the relative amount of jaw and lip activation can approximate different styles of speech
- this idea is explored in the JALI research
- Loom3’s architecture is a good fit for this because it can combine morph influences and bone motion inside the same system

### Artwork note

The best README asset here is probably not a raw paper screenshot dropped in without explanation.

Better:

- make a Loom3-specific diagram inspired by the JALI jaw/lip style continuum
- cite the JALI paper directly
- explain the idea in package language

That would be clearer and safer than relying on a paper figure that was made for a different context.

## 5. Current Loom3 Speech Truth Must Be Documented Honestly

The README still has to describe what ships today.

### What is true right now

- low-level speech control APIs are `setViseme()` and `transitionViseme()`
- these are index-based, not name-based
- the shipped CC4 compatibility surface uses the exported `VISEME_KEYS` order from `src/presets/cc4.ts`

### What is also true right now

The current jaw model is split:

- clip generation uses `config.visemeJawAmounts` in `src/engines/three/AnimationThree.ts:624`
- live viseme playback uses the runtime’s internal jaw table in `src/engines/three/Loom3.ts:896`

That needs to be described exactly, because it affects behavior and because the overhaul is tracked in `#100`.

## 6. Bone Rotations And Transformations Need Their Own Section

The README should have a real section for:

- bone rotations
- bone translations
- composite rotations
- mix weights between morph motion and bone motion

That material is too important to hide under generic AU control prose.

### What the code actually does

- live bone rotation transitions are driven by `transitionBoneRotation()` in `src/engines/three/Loom3.ts:1503`
- pending composite rotations are flushed through `applyCompositeRotation()` in `src/engines/three/Loom3.ts:1539`
- generated clips build quaternion rotation tracks in `src/engines/three/AnimationThree.ts:731`
- generated clips build translation tracks in `src/engines/three/AnimationThree.ts:785`

### Why this matters

This is the mechanism that lets a single semantic control produce:

- morph target changes
- bone rotation
- bone translation

and blend those together realistically.

That is a major part of why Loom3 can feel more lifelike than a pure blend-shape-only system.

## 7. Quaternions Should Be Mentioned Briefly, In The Bone Section

The README does not need a quaternion tutorial.

It does need one short, friendly explanation:

- bone orientation in 3D is represented with quaternions because they interpolate cleanly and avoid common Euler-angle problems
- Loom3 uses quaternion tracks and quaternion composition when it builds and applies composite bone motion

The right reference here is:

- https://www.3blue1brown.com/lessons/quaternions-and-3d-rotation

That is the main 3Blue1Brown explanation to link, not a random secondary quaternion reference.

## 8. Curves, Clips, And Snippets Need Clear Definitions

This is one of the biggest doc gaps.

The README should define these three terms directly:

### Curve

A time-varying control signal for one channel.

In Loom3 that channel might be:

- an AU
- a viseme slot
- a morph target
- a bone-related control

### Clip

A mixer-playable animation composed of tracks.

In Loom3 a generated clip can contain:

- morph influence tracks
- quaternion bone rotation tracks
- bone translation tracks

### Snippet

A named bundle of curves that can be compiled into a clip and scheduled or played.

### Why this is valuable

This is the real power of the system:

- the author works in compact semantic curves
- Loom3 expands those curves into the constituent animation tracks
- the result is still a real mixer clip that can be blended with other clips

That is much better than either extreme:

- hand-authoring everything as raw low-level tracks
- or keeping everything as ad hoc procedural state with no clip/mixer integration

## 9. FACS Is The Stable Semantic Layer

The README should explain why FACS matters.

Not as academic decoration, but as engineering leverage.

The benefit is:

- FACS gives a stable, named control vocabulary
- the profile system maps that vocabulary onto arbitrary rig-specific morph names and bone bindings
- this makes character control portable across rigs

The generic `Profile` type supports exactly this shape:

- `auToMorphs`
- `auToBones`
- `visemeKeys`
- `morphToMesh`
- `compositeRotations`

See `src/mappings/types.ts`.

## 10. ARKit Should Be Mentioned Carefully

The README should not imply that Loom3 ships a generic ARKit preset if it does not.

But it should say something important and true:

- ARKit is another example of a rig vocabulary based on named facial coefficients
- Apple’s face tracking exposes named blend-shape coefficients through `ARFaceAnchor.blendShapes`
- because Loom3 uses a semantic mapping layer, arbitrary rig vocabularies can be adapted into Loom3’s FACS-based control model through profiles

Source:

- Apple ARKit `blendShapes`: https://developer.apple.com/documentation/arkit/arfaceanchor/blendshapes

The right claim is:

- Loom3 is not limited to CC4 naming
- the profile system lets you map arbitrary morph target names into a semantic control layer

The wrong claim would be:

- Loom3 natively ships a complete ARKit preset today

## 11. Recommended README Section Names

The current outline should move toward these user-facing names:

1. What Loom3 is
2. Why it matters
3. What it covers
4. Quickstart
5. How the system fits together
6. Presets and profiles
7. Validation and model analysis
8. Action Units
9. Bone rotations, transformations, and mix weights
10. Direct morph control and continuum pairs
11. Lip Sync and Speech Animation
12. Animation system
13. Playback control
14. Hair physics
15. Regions and geometry helpers
16. Non-human and skeletal rigs
17. LoomLarge walkthrough
18. API reference
19. Further reading

That is closer to the real story than the old method-list structure.

## 12. What The Main README Must Not Do

It must not:

- lead with stale viseme jargon
- bury `AnimationMixer`
- describe the package like a face-wrapper plus some extras
- talk about doc assembly or screenshot capture process
- treat the old README ordering as sacred
- use ARKit, CC4, and internal viseme vocabulary interchangeably
- describe future viseme/jaw behavior as if it already ships

## 13. Recommended Next Rewrite Moves

The next actual README writing pass should:

1. Rewrite the opening sections around performant, mixable Three.js animation plus FACS semantics.
2. Rename the speech section to `Lip Sync and Speech Animation`.
3. Add a real section on bone rotations, transformations, and mix weights.
4. Rewrite the animation section so it defines curves, clips, and snippets clearly.
5. Keep current viseme/jaw behavior honest while the larger overhaul in `#100` remains pending.

## 14. Sources

### Code

- `src/engines/three/AnimationThree.ts`
- `src/engines/three/Loom3.ts`
- `src/mappings/types.ts`
- `src/interfaces/Animation.ts`

### External references

- JALI project page: https://www.dgp.toronto.edu/~elf/jali.html
- JALI paper PDF: https://www.dgp.toronto.edu/~elf/JALISIG16.pdf
- 3Blue1Brown quaternion lesson: https://www.3blue1brown.com/lessons/quaternions-and-3d-rotation
- Apple ARKit `blendShapes`: https://developer.apple.com/documentation/arkit/arfaceanchor/blendshapes
