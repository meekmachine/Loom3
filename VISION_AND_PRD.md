# loom3 Vision, Thesis, and PRD

## Thesis

loom3 should become the **open embodiment layer for AI avatars**.

Large language models gave agents language. They did not give them a body, a face, a gaze system, a timing model, a gesture vocabulary, a movement grammar, or a portable expressive identity. loom3 should provide that missing layer for Three.js-based characters and, over time, help define a standard way to represent expressive avatar behavior.

If LoomLarge is the studio, loom3 is the engine and profile system that makes the studio possible.

## Why loom3 Matters

There is a real gap in the current stack.

- Most AI systems are still disembodied.
- Most graphics systems expose low-level rig controls, not high-level expressive semantics.
- Most avatar pipelines are not portable, not composable, and not easy to remix.

loom3 is valuable because it sits between those layers:

- above raw blendshapes and bone transforms
- below product-specific authoring UI and backend logic
- exactly where a reusable expressive character engine should live

This is not just an engineering convenience. It is a product and cultural opportunity.

Research on **ECAs**, **SIAs**, **Intelligent Virtual Agents**, **CASA**, and **The Media Equation** all support the same thesis: when an interactive system has socially legible cues, users treat it differently. That means the body layer is not polish. It changes the meaning of the interaction.

And culturally, if remixable AI avatars are going to matter, they need an open, reusable substrate. That is where Lessig's read/write and remix thinking is useful: the future is not just better proprietary avatars. It is a shared expressive layer that can be reused, forked, extended, and recombined.

loom3 should help make that possible.

## Vision

loom3 should be the best open-source library for giving 3D characters **semantic expressive control**.

That means a developer should not have to think first in terms of:

- morph target index 38
- quaternion track wiring
- rig-specific naming chaos
- one-off hand-coded viseme tables

They should be able to think in terms of:

- smile
- brow raise
- eye contact
- jaw open
- viseme set
- expressive preset
- profile
- animation clip
- gesture library
- later locomotion and scene behavior

The library should let developers work at the level of expressive intent while still remaining close enough to the engine to be fast, portable, and precise.

## Product Promise

loom3 should let a developer say:

> I can take a 3D character, attach a profile, and immediately start controlling it as a socially legible agent instead of fighting rig internals.

That promise is powerful because it gives value to three different audiences:

### For application developers

- faster path from model to expressive interaction
- a cleaner abstraction over rig complexity
- stable typed profiles instead of ad hoc per-project mapping logic

### For tools like LoomLarge

- a reusable engine and schema layer
- a common character-profile representation
- a foundation for long-term features like saved performance libraries, movement, and multi-agent scenes

### For the ecosystem

- an open substrate for remixable avatar behavior
- a way to share presets, profiles, and expressive conventions
- a path toward a broader common language for embodied agents

## Value Proposition

The core value proposition is:

**loom3 turns rig controls into expressive semantics.**

More concretely, it provides:

- AU-driven face control rather than only raw morph control
- viseme and speech-related expression infrastructure
- bone + morph blending
- preset and profile resolution
- runtime animation conversion and scheduling primitives
- a reusable profile format for character identity
- a foundation for future movement, gesture, and multi-agent behavior

This is how AI avatar development becomes less bespoke and more composable.

## Product Principles

### 1. Semantics Over Rig Chaos

The library should expose expressive meaning, not just low-level implementation detail.

### 2. Profiles Over Per-Project Hacks

Character configuration should live in portable profiles and presets that can be persisted, shared, versioned, and remixed.

### 3. Open Remixability

The engine should support a world where expressive profiles, mappings, and behavior libraries can be reused and recombined across projects.

### 4. Performance Matters

The abstraction has to stay practical in real-time applications. This is not just an offline authoring format.

### 5. The Face Is Only The Beginning

loom3 should start with expressive facial and upper-body control, but it should be designed with room for locomotion, scene behavior, and social multi-agent semantics.

## What loom3 Should Become

### Near-Term Identity

An open-source expressive character engine with:

- strong AU and viseme control
- reliable presets
- portable typed profiles
- runtime animation support
- enough documentation that developers can succeed quickly

### Mid-Term Identity

A reusable profile and behavior layer with:

- profile-embedded animation libraries
- preset composition
- stronger gesture and expressive state modeling
- better interoperability with authoring tools

### Long-Term Identity

A broader embodiment substrate for AI agents with:

- locomotion and IK-related semantics
- scene anchors, affordances, and movement intents
- social attention and multi-agent behavior primitives
- reusable behavior packs and character profile ecosystems

## Boundary With LoomLarge

This needs to stay clear.

loom3 should own:

- runtime expressive control
- profile and preset schema
- portable animation and behavior representations
- reusable engine abstractions

LoomLarge should own:

- product UI
- profile editing workflows
- backend orchestration
- capture pipelines
- Firebase and app-specific persistence
- scene direction and authoring experiences

That boundary is critical. If loom3 tries to become the whole app, it loses focus. If it is too narrow, every downstream app has to reinvent the expressive layer.

## PRD

## Product Goal

Build the canonical open-source engine and schema for expressive AI avatars in Three.js, starting with face and profile semantics, then expanding toward richer movement, reusable behavior libraries, and multi-agent embodiment.

## Product Objectives

### Objective 1: Make character embodiment programmable

Developers should be able to express intent semantically rather than wiring every rig by hand.

Required capabilities:

- AU-based control
- viseme support
- bone/morph blending
- preset resolution
- expressive animation clip generation

### Objective 2: Make character identity portable

A character should not be locked inside one project-specific mapping script.

Required capabilities:

- stable typed profile schema
- profile and preset composition
- schema support for stored animation libraries
- clear serialization and compatibility story

### Objective 3: Make the package trustworthy to adopt

The package has to feel real, not experimental.

Required capabilities:

- reliable npm publishing
- version/tag/release alignment
- docs that match the actual package
- examples that show immediate value

### Objective 4: Prepare for a broader embodiment stack

The design should not stop at facial control.

Future required capabilities:

- locomotion and IK-oriented semantics
- movement intents and path-related hooks
- gesture and posture libraries
- scene-aware behavior anchors

### Objective 5: Support future multi-agent systems

Even if LoomLarge implements the product surface, loom3 should be able to support the lower-level expressive primitives needed for many agents in shared scenes.

Future required capabilities:

- attention targets
- social gaze and reaction primitives
- interoperable animation/state payloads
- portable behavior representations

## Target Users

- developers building AI avatar apps on Three.js
- tools like LoomLarge
- technical artists and experimental creators who need a programmable expressive layer

## Jobs To Be Done

- "Help me get this model under expressive control fast."
- "Help me persist and reuse the character's expressive identity."
- "Help me stop rewriting mapping and preset logic in every app."
- "Help me build toward avatars that can speak, emote, move, and later interact socially in scenes."

## Core Requirements For The Next Package Milestone

### 1. Release reliability

The publish pipeline, package versions, tags, and release notes need to be disciplined and trustworthy.

### 2. Schema completeness

The profile model needs to represent what downstream apps actually need, especially profile-embedded animation/snippet libraries.

### 3. Preset correctness

Core presets, especially CC4-related lip-sync and viseme behavior, need to be right enough that the package feels dependable.

### 4. Developer comprehension

The docs and examples need to communicate the package clearly enough that new adopters can succeed without reading the codebase end to end.

## Roadmap

### Phase 1: Make loom3 a trustworthy package

- fix release pipeline and version discipline
- align tags, npm versions, and release notes
- tighten README and examples
- land schema improvements for profile-scoped animation data

### Phase 2: Strengthen the expressive model

- better viseme correctness
- preset composition
- richer animation/profile interoperability
- improved type clarity and mapping ergonomics

### Phase 3: Expand embodiment

- locomotion-oriented schema design
- IK-related semantics
- movement intent hooks
- gesture and posture expansion

### Phase 4: Support social scenes

- lower-level primitives for gaze, attention, and reaction
- portable representations that can support many agents
- foundations for scene-level expressive systems built in downstream apps

### Phase 5: Become a remixable standard

- shared profile ecosystems
- reusable preset packs
- common expressive conventions across apps
- a stronger bridge between open-source tooling and remix culture

## Non-Goals For The Next Release

- becoming a full no-code application
- absorbing app-specific backend and UI concerns
- chasing every speculative architecture idea before the package is solid to publish and adopt

## Success Metrics

loom3 is succeeding when:

- downstream apps trust released versions instead of relying on unpublished local state
- developers can get a character working faster and at a higher level of abstraction
- profiles become portable and reusable across projects
- the package clearly points toward a future of expressive, moving, socially legible avatars instead of only face sliders

## Research And Cultural References

- Embodied Conversational Agent research
- Socially Intelligent Agent and Intelligent Virtual Agent research traditions
- CASA and *The Media Equation*
- Lawrence Lessig on remix and read/write culture

loom3 matters because the future of AI avatars needs an engine layer that is technically robust, semantically expressive, and culturally open to reuse. That is the role this package should grow into.
