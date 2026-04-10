# Loom3 README Rewrite Outline

## Purpose

This outline is for the new package README.

The goal is:

- keep the main README broad, accurate, and product-facing
- cover every major capability Loom3 actually ships today
- move deep feature details into separate docs instead of bloating the landing document
- keep the viseme / lip-sync / jaw material precise about current behavior while the runtime overhaul tracked in `#100` is still ahead of us

## Main README Principles

- Lead with what Loom3 is, why it exists, and why the abstraction matters.
- Show the real public API and the real setup path early.
- Explain the system as a system, not as a bag of unrelated methods.
- Put preset/profile fit before advanced runtime control, because readers need to know whether their character matches the mappings first.
- Treat the animation system as a first-class value proposition, not a late appendix.
- Keep LoomLarge references useful but secondary; they should clarify the product, not narrate documentation assembly.
- Describe current shipped viseme and jaw behavior exactly as it is today.
- Push long tables, edge cases, provider-specific details, and workflow depth into companion docs.

## Proposed Main README Sections

### 1. Title and one-paragraph promise

- State what Loom3 is in one clean paragraph.
- Say that it is the expressive runtime and profile layer for Three.js characters.
- Explain the central abstraction: developers work in expressive semantics instead of rig plumbing.
- Briefly clarify the boundary with LoomLarge.

### 2. Why Loom3 exists

- Explain the problem Loom3 solves.
- Show the gap between raw morph targets / bones and reusable character behavior.
- Summarize the package value in terms of portability, programmability, and remixability.
- Keep this short but sharper than the current generic intro.

### 3. What Loom3 covers

- Give the broad capability map:
- semantic runtime control
- profile and preset mapping
- validation and inspection
- animation playback and clip generation
- speech / viseme control
- hair and region tooling
- Make clear that Loom3 is more than a face wrapper, but do not dump full API details here.

### 4. Quickstart

- Install `@lovelace_lol/loom3` and `three`.
- Show the minimal Three.js setup with `GLTFLoader`, `collectMorphMeshes`, `Loom3`, and `onReady()`.
- Show the two update ownership patterns:
- external render loop with `update(dt)`
- internal loop with `start()`
- End with one tiny end-to-end example:
- set one AU
- set one viseme
- play one baked animation or one transition

### 5. Core mental model

- Explain the four main pieces:
- model
- preset/profile
- controller
- update/playback loop
- Explain the difference between:
- preset
- profile override
- runtime controller
- clip playback
- direct control
- This section should orient the rest of the README.

### 6. Public surface and package shape

- Clarify the real public exports:
- `Loom3` is the shipped Three.js implementation
- `LoomLarge` is the exported type/interface shape
- built-in presets and helpers come from the package root
- Explain that the runtime contract is still Three.js-shaped today.
- Include one short export map, not a full dump.

### 7. Presets and profiles

- Explain what a preset contains at a high level:
- AU mappings
- bone mappings
- viseme mappings
- mesh routing
- mix defaults
- metadata
- Explain built-in presets:
- `CC4_PRESET`
- `BETTA_FISH_PRESET`
- Explain profile overrides and how they merge.
- Explain naming resolution at a broad level:
- `boneNodes`
- prefix/suffix handling
- morph prefix/suffix behavior
- Keep exact merge and edge-case details for a deeper doc.

### 8. Validate and inspect before authoring

- Explain why preset validation matters before tuning expressions.
- Cover:
- `validateMappingConfig()`
- `validateMappings()`
- `isPresetCompatible()`
- `suggestBestPreset()`
- `generateMappingCorrections()`
- `analyzeModel()`
- `extractFromGLTF()` / `extractModelData()`
- Position this as the recommended workflow before custom mapping work.

### 9. Runtime control overview

- Give the broad map of control surfaces:
- Action Units
- direct morph control
- continuum pairs
- composite rotations
- mix weights
- Keep this section conceptual and brief.
- Explain when to use each control path.
- Link out to deeper feature docs for per-method depth.

### 10. Action Units

- Explain the FACS-based AU model.
- Show a few concrete examples:
- smile
- brow raise
- blink
- jaw drop
- head turn
- Cover both `setAU()` and `transitionAU()`.
- Briefly mention mixed morph/bone AUs and mix weights.
- Do not inline the full AU catalog in the main README.

### 11. Direct morph control, continuum pairs, and composite rotations

- Explain these as the lower-level or specialized runtime controls.
- Cover when to use:
- `setMorph()` / `transitionMorph()`
- `setContinuum()` / `transitionContinuum()`
- composite rotations
- Explain that these are important, but not the first thing a new reader should reach for.

### 12. Viseme, lip-sync, and jaw overview

- This section must be very carefully scoped.
- State the current shipped CC4 `VISEME_KEYS` order exactly.
- Explain that current live viseme APIs are index-based.
- Explain the current jaw truth exactly:
- clip generation uses profile `visemeJawAmounts`
- live `setViseme()` and `transitionViseme()` still use the runtime's internal jaw table
- Make clear that viseme and jaw behavior are under active overhaul in `#100`.
- Do not describe the future model as if it already ships.
- Give readers the correct current behavior plus the broad direction of change.
- Keep provider-specific depth out of the main README.

### 13. Animation system

- This needs to be one of the central sections, not an afterthought.
- Explain the animation model as a coherent system:
- transitions
- baked animation clips
- snippet / curve-to-clip playback
- shared handles and lifecycle
- Explain how transition playback differs from mixer-backed clip playback.
- Explain the role of:
- crossfading
- weight/intensity
- playback rate
- loop behavior
- Explain why baked and generated clips are remixable:
- same mixer-backed playback world
- same control surfaces
- shared update ownership
- Explain how direct runtime control coexists with clip playback.
- Explain the efficiency and reliability story in plain language.
- Be explicit that the point is not just feature enumeration. This section needs to explain why the system feels coherent instead of accidental.
- Include one combined example:
- play a baked clip
- layer a generated clip or snippet
- drive a live AU or viseme on top

### 14. Playback and state control

- Cover:
- pause/resume
- active transition state
- clip handles
- animation handles
- global playback controls
- reset/neutral behavior
- This can stay short if the animation section already explains the architecture.

### 15. Hair physics

- Explain what Loom3 provides here at a broad level.
- Cover registration, configuration, and runtime enable/disable.
- Keep detailed parameter tuning in a dedicated doc.

### 16. Regions, geometry, and annotation helpers

- Explain these as tooling helpers for semantic camera targets, markers, and face anchors.
- Cover:
- `resolveBoneName()`
- `resolveBoneNames()`
- `resolveFaceCenter()`
- `findFaceCenter()`
- orientation helpers
- Keep the current Loom3 versus LoomLarge annotation boundary accurate.
- Link to the deeper annotation configuration doc instead of inlining every field.

### 17. Skeletal-only and non-human presets

- Keep a dedicated broad section for rigs like the fish preset.
- Explain what this section is really proving:
- Loom3 is not only for CC4 humanoid face rigs
- skeletal-driven expressive mappings are supported
- Use the shipped fish preset structure, not pseudo-API inventions.
- Keep the full fish preset walkthrough in a deeper doc.

### 18. LoomLarge companion walkthrough

- Keep this optional and concise.
- Use screenshots and links only when they help the reader understand the product.
- Each LoomLarge reference should answer:
- what the reader is looking at
- why it matters
- what to inspect next
- Remove maintainer-process commentary, capture notes, and stale justifications.
- Remove prose about:
- what the README "should" do
- deep-link limitations
- screenshots being captured before a label refresh
- features not yet moved from a demo/runtime unless that limitation materially changes user understanding
- The walkthrough prose should read like product guidance, not notes from whoever assembled the docs.

### 19. Compact API reference

- End with a compact export-oriented reference.
- Group by:
- runtime
- presets/profiles
- validation
- animation
- tooling/helpers
- Do not turn the bottom of the README into generated docs.

### 20. Further reading

- Link to deeper docs by topic.
- Link to relevant reference material:
- FACS
- Reallusion CC4
- Three.js
- internal Loom3 docs

### 21. License

- Keep this minimal.

## Companion Docs We Should Have

The main README should hand off to a deeper doc set. At minimum we should have:

- `docs/getting-started.md`
- `docs/presets-and-profiles.md`
- `docs/validation-and-model-analysis.md`
- `docs/action-units.md`
- `docs/visemes-and-lip-sync.md`
- `docs/animation-system.md`
- `docs/baked-animations-and-clips.md`
- `docs/hair-physics.md`
- `docs/regions-and-annotations.md`
- `docs/custom-presets.md`
- `docs/skeletal-and-nonhuman-rigs.md`
- `docs/troubleshooting.md`

## Existing Repo Docs We Can Reuse Or Expand

- `ANNOTATION_CONFIGURATION.md` should become the source for the deeper annotations doc.
- `VISION_AND_PRD.md` should inform the framing and value proposition, but not be pasted directly into the README.
- The viseme research and implementation issues should shape the speech section:
- `#86`
- `#87`
- `#88`
- `#100`
- The animation architecture README work should stay aligned with:
- `#96`
- `#97`
- `#98`

## What Should Not Live In The Main README

- maintainer-process notes
- screenshot capture commentary
- deep-link limitation commentary unless it directly affects usage
- "captured before label refresh" style caveats
- runtime migration status notes unless they change the actual package contract
- stale or approximate pseudo-code presented as shipped code
- provider-specific research detail that belongs in a deeper viseme/lip-sync doc
- exhaustive preset tables that overwhelm first-time readers
- speculative future behavior described as current API behavior

## Inputs Incorporated From Supporting Drafts

These two draft issue notes are now reflected in the outline and should stay as rewrite constraints:

- `/tmp/loom3-animation-playback-docs-issue.md`
- `/tmp/loom3-loomlarge-walkthrough-prose-issue.md`

Concretely, that means:

- the animation section must explain the playback model as a system, not as a method list
- the animation section must explain remixability, efficiency, and reliability in plain language
- the walkthrough prose must explain the product state being shown, not the documentation process
- LoomLarge screenshots and links need to justify their presence with actual reader value

## Recommended Section Order For The Rewrite

1. Title and promise
2. Why Loom3 exists
3. What Loom3 covers
4. Quickstart
5. Core mental model
6. Public surface and package shape
7. Presets and profiles
8. Validate and inspect before authoring
9. Runtime control overview
10. Action Units
11. Direct morph control, continuum pairs, and composite rotations
12. Viseme, lip-sync, and jaw overview
13. Animation system
14. Playback and state control
15. Hair physics
16. Regions, geometry, and annotation helpers
17. Skeletal-only and non-human presets
18. LoomLarge companion walkthrough
19. Compact API reference
20. Further reading
21. License
