# Development guidance for Loom3

Loom3 provides expressive control, rig configuration, and runtime tooling to
consumers of `@lovelace_lol/loom3`. Changes must explain what a developer or
technical artist can do with a rig and what the library actually guarantees.
A downstream app's authoring controls, persistence, and integration are separate
work unless their code is also changed and verified.

## Keep the owning layer visible

Trace the affected exported API through [src/index.ts](../src/index.ts) and its
interface to the implementation before changing or describing behavior.

| Concern | Owner to inspect | Clarity requirement |
| --- | --- | --- |
| Engine state and rig binding | [Loom3.ts](../src/engines/three/Loom3.ts) | Distinguish loaded model, resolved mappings, and live control state; keep one authoritative owner for each. |
| Mixer clips and playback | [AnimationThree.ts](../src/engines/three/AnimationThree.ts), [Animation interface](../src/interfaces/Animation.ts) | State who advances time and how handles, events, completion, and stopping relate. |
| Preset/profile composition | [resolveProfileConfig.ts](../src/profiles/resolveProfileConfig.ts), [profile types](../src/profiles/types.ts), [mapping types](../src/mappings/types.ts) | Separate stored input, preset defaults, overrides, and resolved runtime configuration; make precedence explicit. |
| Model compatibility | [validation](../src/validation/validateMappings.ts) | Distinguish invalid configuration, unsupported mappings, and absent model targets; do not silently treat all three as a working rig. |

- Name Action Units (AUs), visemes, morph targets, bones, presets, profiles, and
  clips precisely. Define FACS and other abbreviations for readers who need them.
  A preset is not a loaded character and a profile field is not evidence of a
  runtime effect. Use `Loom3` for the current API and label compatibility aliases.
- Include units and spaces in names or contracts: update deltas in seconds,
  transition duration units, angles, local versus world coordinates, normalized
  weights, and left/right conventions. Follow each API's actual contract; do not
  assume every time or angle field uses the same units.
- Keep mapping and profile transformations separate from mutating Three.js
  objects, scheduling frames, and notifying subscribers. Extract concrete domain
  operations rather than adding a generic runtime manager for hypothetical uses.
- Make lifecycle transitions and ownership explicit. External updates and the
  internal loop must have a clear owner; pause, stop, completion, reset, and
  disposal must not become interchangeable names for different behavior. Explain
  how promises settle, listeners unsubscribe, and retained state is cleaned up
  when modifying those contracts. Avoid extra flags whose valid combinations
  cannot be explained or verified.
- Define public inputs, outputs, optional results, failure behavior, and relevant
  model prerequisites in interfaces and examples. Preserve useful error context;
  do not silently turn an unsupported curve or unresolved target into a success.
  Avoid leaking mutable configuration ownership across consumers.
- Comments should explain rig constraints, composition order, or compatibility
  reasons. Explain why a fallback exists and what it supports; remove obsolete
  workarounds when their justification no longer applies.

## Put technical writing where consumers look

| Change | Documentation to maintain |
| --- | --- |
| Public runtime API, setup, mapping, visemes, or playback semantics | Relevant section and example in [README.md](../README.md), plus affected interface documentation. Check exports and signatures rather than copying an old example. |
| Profile annotation merging, region naming, or legacy region compatibility | [ANNOTATION_CONFIGURATION.md](../ANNOTATION_CONFIGURATION.md); specify stored input, override precedence, resolved output, and compatibility behavior. |
| Release-facing behavior or migration | [RECENT_CHANGES.md](../RECENT_CHANGES.md) when applicable. Distinguish merged source changes from published package versions; verify release status before claiming availability. |
| Product direction or planned capability | [VISION_AND_PRD.md](../VISION_AND_PRD.md). Keep aspirations separate from the README's supported runtime contract. |
| Contributor ownership or recurring implementation decisions | [AGENTS.md](../AGENTS.md) and this guide; avoid making a second copy of the API reference. |

Examples should identify a usable rig/profile, setup prerequisites, the exact API
call, and the observable result. For a profile merge change, show the conflicting
preset and override fields and resulting configuration. For playback, identify
the loop mode, time progression, and relevant handle/event result. Keep these
examples tied to exported APIs, and label pseudocode or proposed contracts.

A screenshot from a consuming app can illustrate an effect but does not prove
that the app currently imports this library version. Verify the integration before
claiming a UI change, and label historical screenshots or alias examples. Link
related consumer work when needed rather than describing it as delivered here.

## Verify the behavior, not the implementation shape

Use focused fixtures and observable results. Existing
[clip event tests](../src/engines/three/AnimationThree.clipEvents.test.ts) illustrate
advancing mixer time and checking emitted events; profile tests can assert merged
values and input preservation. For changed contracts, cover relevant invalid
inputs, replacement, stop, or disposal paths rather than asserting private fields
or copying the algorithm into a test. Visual correctness needs appropriate
rendered evidence; a numerical test alone does not prove that a rig looks right.
Report which evidence exists and which consumer or visual checks remain unverified.

Keep refactoring and documentation proportional to the task. Do not rename every
legacy alias, split working modules by arbitrary line counts, or add generic
abstractions merely to satisfy a style preference. Explain the concrete ambiguity
or contract risk a clarity change resolves.

## Examples grounded in this repository

See [writing examples](writing-examples.md) for source excerpts, context-specific
weaknesses, proposed rewrites, and existing explanations worth preserving. Use
the examples to apply these rules; verify current code before copying a claim.
