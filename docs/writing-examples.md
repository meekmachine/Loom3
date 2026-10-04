# Writing examples from Loom3

Use these alongside [development guidance](development-guidance.md). Source
excerpts are exact text at the pinned revision. Weak examples are weak for a
specific use; a vision statement need not be an API specification. Proposed
rewrites illustrate wording, not newly shipped features or completed tests.
Recheck the implementation before reusing an example.

## 1. Scope: turn a product aspiration into a bounded library task

**Source excerpt — useful vision, insufficient as an issue deliverable:**

> Profiles need to carry the important things: mappings, visemes, expressive defaults, animation vocabularies, and over time the information needed for richer motion and scene behavior.

Source: [VISION_AND_PRD.md, profile direction](https://github.com/meekmachine/loom3/blob/879138c085bb49b8e0dc67a7304c11f9b6308d08/VISION_AND_PRD.md#L85).

**Why it needs narrowing:** Copied into an implementation issue, this gives no
specific input, merge behavior, or finish condition. It also mixes current profile
concerns with future motion and scene behavior.

**Proposed better wording for a bounded profile-documentation task:**

> Document how a saved `CharacterProfile` selects a preset with `profilePresetId`
> and overrides `annotationRegions` through `extendProfileConfigWithPreset`.
> Show an override for one named region and explain the canonical result and the
> legacy `regions` mirror. Verify the example against the resolver. This task
> documents a library contract; it does not implement a consuming app's profile
> editor or persistence.

Evidence: [existing runtime-extension guide](https://github.com/meekmachine/loom3/blob/879138c085bb49b8e0dc67a7304c11f9b6308d08/ANNOTATION_CONFIGURATION.md#runtime-extension)
and [exported resolver](https://github.com/meekmachine/loom3/blob/879138c085bb49b8e0dc67a7304c11f9b6308d08/src/index.ts#L176). The suggested task is an example of
scope, not a claim that this documentation is currently missing.

**Rule:** Keep the aspiration in the vision document. An issue needs a concrete
consumer action, owning contract, and observable completion criterion.

## 2. API prose: replace reassurance with update ownership and units

**Source excerpt — weak as a standalone integration instruction:**

> Loaded mixer clips and facial AU control work together seamlessly. The AnimationMixer updates automatically when you call `loom.update()` or use `loom.start()`:

Source: [README.md, Combining with facial animation](https://github.com/meekmachine/loom3/blob/879138c085bb49b8e0dc67a7304c11f9b6308d08/README.md#combining-with-facial-animation).

**Why it needs precision:** “Seamlessly” does not specify scheduling, and the
argument-free call hides the required time delta. At this revision,
[`update(deltaSeconds)`](https://github.com/meekmachine/loom3/blob/879138c085bb49b8e0dc67a7304c11f9b6308d08/src/engines/three/Loom3.ts#L432-L457) returns without
advancing when the delta is missing/nonpositive or the engine is paused. `start()`
obtains a delta from the clock and calls that same update method.

**Proposed better integration wording:**

> After binding the model, choose one owner for engine updates: call
> `loom.update(deltaSeconds)` from the application's loop, or call `loom.start()`
> to use the internal animation loop. Supply a positive delta in seconds for
> external updates. That update path advances transitions, mixer playback, and
> hair physics unless the engine is paused. This describes engine updates, not
> a guarantee about how every rig looks or how the app renders its scene.

**Rule:** Name the caller, units, and conditions instead of promising a seamless
result. Avoid implying that internal animation scheduling renders the app's scene.

## 3. Good existing lifecycle reference: distinguish stopping from teardown

**Source excerpt — preserve these distinctions:**

> `start()` / `stop()`: opt into or out of the internal loop
>
> `dispose()`: stop playback and release engine state when the character is torn down

Source: [README.md, Lifecycle and update ownership](https://github.com/meekmachine/loom3/blob/879138c085bb49b8e0dc67a7304c11f9b6308d08/README.md#lifecycle-and-update-ownership).

**Why it works:** It tells the consumer which operation controls scheduling and
which releases a character's engine state. A generic “stops the engine” comment
would blur those responsibilities. The
[implementation](https://github.com/meekmachine/loom3/blob/879138c085bb49b8e0dc67a7304c11f9b6308d08/src/engines/three/Loom3.ts#L460-L490) separates stopping the
internal frame callback from disposal cleanup.

**Proposed companion wording for a lifecycle review:**

> Check whether this path only needs to stop internal updates or is tearing down
> the character. `stop()` cancels the internal frame loop; it does not express
> complete disposal. When reviewing teardown, inspect `dispose()` and the calling
> app's resource ownership, and cite the missing cleanup and its consequence if
> there is a defect. Do not infer a leak merely from a naming preference.

**Rule:** Document lifecycle operations by their distinct effects. Review findings
need an actual triggering path and consequence, not a generic cleanup checklist.
