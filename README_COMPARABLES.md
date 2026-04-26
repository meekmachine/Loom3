# Comparable Systems For The Loom3 README Rewrite

This note is not here to say Loom3 should copy any of these systems wholesale.

It is here to answer a more useful question:

What do comparable systems reveal about how Loom3 should explain itself?

The three most useful comparison points here are:

- TalkingHead for web-facing avatar animation UX
- Greta for embodied conversational agent architecture
- VHToolkit for integrated socially interactive agent system framing

## 1. TalkingHead

### What it is

TalkingHead is a JavaScript class for real-time lip-sync and avatar control in the browser. It is explicitly aimed at web developers building interactive avatar experiences.

Primary source:

- https://github.com/met4citizen/talkinghead

### What it emphasizes

The TalkingHead README and API surface are very concrete and outcome-oriented.

It foregrounds things like:

- real-time lip sync
- browser-based demo videos
- direct avatar behaviors such as eye contact and mood
- animation playback from Mixamo files
- simple methods like `playAnimation()`, `playGesture()`, `start()`, `stop()`

Examples from the public README include:

- `playAnimation(...)`
- `playGesture(...)`
- `makeEyeContact(...)`
- `setMood(...)`
- `start()` / `stop()`

### What Loom3 should learn from it

TalkingHead is stronger than the current Loom3 README in one very important way:

- it quickly tells a web developer what they can do

That is a real lesson.

Loom3 should borrow:

- direct, concrete language
- immediate browser/runtime value
- strong demo-first framing for the main use cases

But Loom3 should also explain what it does that TalkingHead does not foreground:

- a reusable semantic control layer
- FACS-based mappings
- profile-driven retargeting
- procedural clip generation
- mixer-backed composability across morphs and bones

### README implication

The Loom3 README should feel at least as concrete and immediately useful as TalkingHead, but more architecturally ambitious.

The opening should not read like:

- “here is a mapping library”

It should read more like:

- “here is how you make a Three.js character expressive, mixable, and programmable in realtime”

## 2. Greta

### What it is

Greta is a long-running embodied conversational agent platform focused on socio-emotional virtual characters and multimodal behavior generation.

Primary sources:

- Repository: https://github.com/isir/greta
- AAMAS paper: https://www.enib.fr/~bevacqua/site/papers/aamas09.pdf

### What it emphasizes

Greta is explicit that it is not just facial animation.

It presents itself as a system for:

- verbal behavior
- nonverbal behavior
- gaze
- head and torso movement
- facial expression
- gesture
- real-time interactive use

The older paper also frames Greta in standards-oriented terms:

- SAIBA framework
- FML-APML
- BML
- MPEG-4 animation

And it highlights low latency, modularity, and interactive application suitability.

### What Loom3 should learn from it

Greta is useful because it makes one thing very clear:

- expressive character systems should be described as multimodal behavior systems, not just as animation utilities

That does not mean Loom3 should imitate Greta’s full framework language or standards stack.

But it does mean the Loom3 README should speak more confidently about:

- speech
- gaze/head behavior
- facial expression
- mixable real-time interaction
- socially expressive characters

Greta also demonstrates that architecture matters in the docs.

Readers need to understand:

- what layer the system owns
- how modules relate
- how real-time expressive behavior is composed

### README implication

The Loom3 README should make the package boundary clear:

- not a full conversational agent platform
- not the entire sensing, planning, and dialog stack
- but a serious expressive runtime and mapping layer that belongs inside that larger stack

This is exactly the kind of language that can make Loom3 feel like infrastructure for embodied agents rather than “just a character helper.”

## 3. VHToolkit

### What it is

The Virtual Human Toolkit is a research and development platform for building virtual humans, embodied conversational agents, and socially interactive agents.

Primary source:

- https://vhtoolkit.ict.usc.edu/

### What it emphasizes

VHToolkit explicitly presents itself as an integrated framework.

Its homepage foregrounds:

- audio-visual sensing
- speech recognition
- NLP
- text-to-speech
- nonverbal behavior generation
- flexible architecture
- multi-platform deployment

It also makes interoperability and extensibility central to the story.

### What Loom3 should learn from it

The main lesson is not that Loom3 should become VHToolkit.

The lesson is that system boundary clarity is a strength.

VHToolkit clearly says:

- here is the whole stack we cover

Loom3 should be equally clear in the opposite direction:

- here is the layer we cover really well

That means the Loom3 README should clearly say:

- Loom3 is the expressive runtime and profile substrate
- it can sit under TTS, dialog, and agent systems
- it is designed to interoperate with larger conversational stacks
- it does not try to be the whole SIA platform

### README implication

The relationship with LoomLarge and with external speech/agent systems should be stated plainly.

Loom3 should come across as:

- a reusable engine layer
- a portable mapping/profile layer
- a mixer-backed expressive animation layer

not as an all-in-one agent toolkit.

## 4. The Most Important Documentation Lessons

Across these systems, a few patterns repeat.

### A. Lead with outcomes, not internals

TalkingHead is good at saying what the developer gets.

Loom3 should do more of that.

Examples:

- make a character smile, speak, look, gesture, and react in realtime
- mix imported and procedural animation together
- retarget rig-specific morphs and bones into a reusable semantic control layer

### B. Explain the architecture as a system

Greta and VHToolkit both do this better than the current Loom3 README.

Loom3 should explain:

- where `AnimationMixer` fits
- where procedural clips fit
- where direct runtime control fits
- where presets/profiles fit

### C. Be clear about scope

Greta and VHToolkit each know what kind of system they are.

Loom3 should say:

- not the whole social agent platform
- yes the expressive animation and profile layer that such a platform needs

### D. Keep the speech story human-readable

TalkingHead says “lip-sync.”

That is clearer than leading with “viseme.”

Loom3 should use:

- `Lip Sync`
- `Speech Animation`

and only then explain the current low-level `viseme` API.

### E. Show that the package supports real interaction, not just playback

All three comparison points imply this in different ways.

The Loom3 README should emphasize:

- realtime use
- mixable interaction
- layered animation
- socially expressive behavior

## 5. Where Loom3 Is Actually Stronger

These systems are helpful comparisons, but Loom3 has its own real strengths.

The README should lean into them:

- FACS-based semantic mapping as a reusable control layer
- profile-driven retargeting
- morph-plus-bone composition
- procedural curve-to-clip generation
- `AnimationMixer` integration for baked and generated animation together
- a clean package shape that can sit underneath broader products

TalkingHead is more immediately concrete for web developers.

Greta and VHToolkit are broader system stories.

Loom3 has the opportunity to combine:

- the concreteness of a frontend animation package
- with the conceptual seriousness of embodied-agent infrastructure

That is probably the right README voice.

## 6. Recommended README Adjustments From This Comparison Pass

The main README should now do the following:

1. Open with performant, mixable Three.js character animation.
2. Explain Loom3 as an expressive runtime layer, not just a mapping table.
3. Use `Lip Sync and Speech Animation` instead of leading with `Viseme`.
4. Make `AnimationMixer` a first-class concept early.
5. Clearly distinguish Loom3 from a full conversational-agent stack.
6. Preserve the stronger, more infrastructure-level story that makes Loom3 bigger than a simple browser avatar helper.

## 7. Sources

- TalkingHead GitHub: https://github.com/met4citizen/talkinghead
- Greta GitHub: https://github.com/isir/greta
- Greta AAMAS paper: https://www.enib.fr/~bevacqua/site/papers/aamas09.pdf
- VHToolkit homepage: https://vhtoolkit.ict.usc.edu/
