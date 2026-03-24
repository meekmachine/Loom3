# loom3 Vision and PRD

## Vision

**Language models gave AI words. loom3 gives AI a body language.**

loom3 exists to become the open expressive layer for AI avatars: the engine and profile system that lets a character emote, speak, look, gesture, and eventually move and interact in ways that read as intentional rather than mechanical.

Without a layer like this, AI remains disembodied. It can produce language, but it cannot easily become a character. It cannot smile with intention, sustain eye contact, shift posture, carry an expressive identity across projects, or participate in a scene as more than a voice with a mesh attached.

loom3 is meant to solve that.

## Why This Is Exciting

This package matters because expressive embodiment is the missing infrastructure for AI avatars.

The field already gave us the reasons to care:

- **Embodied Conversational Agent** research showed that face-to-face interaction is multimodal, and that expression, timing, and gesture are part of the communicative act itself.
- **Socially Intelligent Agent** and virtual human research made the same point at the level of systems: intelligence that cannot be socially legible is incomplete.
- **CASA** and **The Media Equation** showed that people treat responsive media socially as soon as it exhibits the right cues.
- Lessig's writing on remix culture points to something equally important: the real cultural explosion comes when a medium becomes writable, forkable, and reusable.

That is the opportunity for loom3.

Not merely better rig utilities.  
Not merely cleaner animation code.  
An expressive engine that helps make AI avatars **portable**, **programmable**, and **remixable**.

## What Makes loom3 Valuable

loom3 is valuable because it turns rig internals into expressive semantics.

Instead of forcing developers to think in terms of:

- arbitrary morph target names
- bone channels
- rig-specific naming conventions
- one-off viseme tables
- project-specific glue code

it lets them think in terms of:

- smile
- brow raise
- eye contact
- jaw drop
- viseme set
- expression preset
- profile
- gesture library
- later, movement intent and scene behavior

That is the heart of the value proposition:

**loom3 lets developers work in the language of performance instead of the language of rig plumbing.**

## The Bigger Bet

The deeper bet is that expressive avatar behavior should become a shared substrate, not a thousand incompatible hacks.

If AI avatars are going to matter culturally, then there needs to be a layer that is:

- open enough to reuse
- stable enough to build on
- semantic enough to be understandable
- portable enough to move across tools and applications
- extensible enough to grow from facial expression to full embodied behavior

That is what loom3 can be:

- a character profile standard
- an expressive control engine
- a bridge between AI and animation
- an open foundation for remixable avatar culture

## What We Plan To Get Right

### We plan to get the abstraction right

The API should feel like expressive intent, not rig trivia. Developers should spend their time shaping how a character communicates, not reverse-engineering every mesh and bone.

### We plan to get the profile right

A character should have a durable expressive identity. Profiles need to carry the important things: mappings, visemes, expressive defaults, animation vocabularies, and over time the information needed for richer motion and scene behavior.

### We plan to get portability right

The engine should make character behavior easier to persist, share, and remix across projects. The point is not merely that it works once. The point is that it becomes reusable.

### We plan to get trust right

A package like this only matters if people trust it. Release discipline, version clarity, schema stability, documentation quality, and examples are not boring chores. They are the reason the ecosystem can form around the package at all.

### We plan to get the future right

loom3 should begin with face, visemes, and expressive runtime control, but it should clearly point toward more:

- gesture and posture vocabularies
- locomotion and IK-oriented semantics
- movement intent
- scene anchors and spatial behavior
- attention and reaction primitives
- eventually the foundations for many agents interacting in shared scenes

## Product Promise

loom3 should let someone say:

> I can take a 3D character, attach a profile, and immediately start directing expressive behavior instead of fighting rig internals.

And then, one level deeper:

> I can persist that expressive identity, reuse it, extend it, and build toward avatars that can talk, emote, move, and eventually participate in social scenes.

## Boundary With LoomLarge

The relationship between the two projects should be very clear.

LoomLarge is the studio and the product experience.  
loom3 is the expressive engine and profile substrate.

LoomLarge should own:

- authoring UI
- workflow
- capture
- persistence layers
- scene direction and product UX

loom3 should own:

- semantic expressive control
- profile and preset structures
- runtime animation and expression infrastructure
- portable behavior representations
- the foundations that downstream products can share

That clarity is a feature, not a limitation.

## PRD

## Product Goal

Build the best open-source engine for expressive AI avatars in Three.js, and lay the groundwork for a broader standard around profile-driven embodied behavior.

The first win is expressive face and voice semantics.  
The next win is portability and remixability.  
The longer win is an open embodiment layer that can support movement, scenes, and many-agent interaction.

## Who This Is For

- developers building avatar-based products
- tools like LoomLarge
- technical artists who need a programmable expressive layer
- researchers and creators exploring embodied agents

## Jobs To Be Done

- "Help me make this character expressive without hand-wiring everything."
- "Help me save and reuse the character's expressive identity."
- "Help me avoid rewriting profile and preset logic in every project."
- "Help me build toward avatars that can do more than animate a face."
- "Help me create a foundation that can later support movement and many-agent interaction."

## What The Near-Term Product Must Do

### 1. Feel great to use

The semantic layer has to be elegant enough that developers immediately feel the lift in abstraction.

### 2. Have a profile model worth building on

The profile cannot be a half-measure. It needs to represent the character in a way that feels durable and expandable.

### 3. Be easy to trust

The package must publish cleanly, document itself clearly, and give downstream teams confidence that the dependency is stable.

### 4. Show immediate expressive value

It needs to be obvious from the examples and the runtime behavior that this is not just another low-level helper library. It is a character engine.

## What Comes Next

### Phase 2: Richer expressive identity

- better preset composition
- stronger profile-embedded animation libraries
- more reusable expressive building blocks
- a more complete portable character definition

### Phase 3: Motion and embodiment

- locomotion-oriented schema design
- IK-related hooks and semantics
- movement intent and scene behavior foundations
- stronger support for body language beyond the face

### Phase 4: Social scenes

- attention targets
- reaction and timing primitives
- foundations for agent-to-agent expressive systems
- support for the lower-level substrate required by many-avatar environments

### Phase 5: A shared expressive standard

- reusable character profiles
- preset ecosystems
- open behavior packs
- a growing commons for remixable AI avatars

## What Success Looks Like

loom3 is succeeding when:

- developers describe it as the layer that finally makes avatars feel programmable
- downstream apps trust released versions and build around the profile model
- characters become easier to reuse and remix across projects
- the package clearly grows from expression into movement and social embodiment
- it starts to feel less like a utility library and more like the beginning of an open standard for expressive AI avatars

## Closing Statement

loom3 is exciting because it aims at the right layer.

It is not trying to be the whole product.  
It is trying to be the layer that makes the whole category possible.

If LoomLarge is about directing characters, loom3 is about giving those characters an expressive grammar, a portable identity, and eventually a path from facial motion to full embodied social behavior.

That is a serious opportunity. That is worth building well.
