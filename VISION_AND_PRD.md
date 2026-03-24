# loom3 Vision and PRD

## Vision

loom3 should be the reusable character-control engine that gives any Three.js character a stable expressive profile: Action Units, visemes, bones, regions, and supporting runtime behavior exposed through a clean typed API.

The package should feel trustworthy in two ways:

- technically: stable schema, reliable presets, passing tests, predictable releases
- product-wise: clear docs, working examples, and an obvious path from install to first successful character control

## Product Position

loom3 is not the full application. It is the engine and schema layer that powers LoomLarge and can also be adopted directly by other Three.js applications.

That boundary matters:

- application workflows, backend orchestration, Firebase persistence, and UI-heavy authoring belong in LoomLarge
- engine behavior, profile shape, preset resolution, and runtime APIs belong in loom3

## Users

- developers integrating expressive character control into Three.js apps
- LoomLarge as the primary downstream application
- technical users who need a typed profile model they can persist and version

## Problem

Three.js teams can render a character, but turning that character into a consistently controllable expressive rig is still custom, fragile, and poorly documented. loom3 exists to remove that reinvention.

The current package is already technically promising, but it still has a few clear product gaps:

- release and versioning discipline are not yet reliable enough
- docs and examples lag the engine
- some preset correctness work is still open
- the profile schema is not yet complete enough to carry every important downstream asset, especially animations

## Product Goal

The next loom3 release should establish the package as a stable dependency, not just a working codebase.

That means:

- npm publishing is reliable and version-synced
- the public API and profile schema are coherent
- the CC4 preset behaves correctly for common use
- docs and examples make the package understandable without reading source
- LoomLarge can depend on released schema changes instead of local drift

## Non-Goals For This Release

- absorbing LoomLarge-specific UI or backend features
- turning loom3 into a no-code editor
- moving screenshot automation ownership into the package
- broad architectural audits as a substitute for shipping the package cleanly

## Current Reality

loom3 is in better technical shape than LoomLarge right now:

- local typecheck passes
- local tests pass
- the main open risks are release process, package/version drift, schema completion, and documentation

There is also a real dependency-management problem today:

- LoomLarge declares `@lovelace_lol/loom3 ^1.0.7`
- the installed copy under `LoomLarge/frontend/node_modules` is `1.0.4`
- the local `loom3` repo is at `1.0.6`
- npm currently reports `1.0.8`

That mismatch is exactly why loom3 now needs product-level release discipline, not just more code.

## PRD

### Problem Statement

Developers need a portable, documented, versioned character-profile engine for Three.js. Right now the engine mostly works, but the package story is weaker than the code story.

### Core User Promise

"I can install loom3, apply or extend a profile, and confidently drive a character rig with a documented API and released package."

### Release Objective

Ship loom3 as a stable public engine package with a trustworthy release pipeline, a complete enough profile schema for downstream persistence, and documentation that supports first-use success.

### Must-Have Requirements

#### 1. Reliable release pipeline

- npm publishing must work every time from the supported release path.
- package version, git tags, and GitHub releases must stay in sync.
- release notes should clearly point users to the published package version.

Relevant work:

- `#21` fix npm deployment pipeline
- `#22` link npm releases to GitHub releases

#### 2. Stable profile schema for downstream apps

- The `Profile` model must be able to carry the data LoomLarge needs to persist complete character behavior.
- Animation/snippet libraries should be supported in the schema with backwards-compatible loading behavior.
- Public exports and docs must reflect the final schema.

Relevant work:

- `#36` move animation/snippet libraries into `Profile`

#### 3. Preset correctness

- The CC4 preset must have correct viseme mapping for expected lip-sync quality.
- Any major preset fixes should ship with regression coverage and clear notes.

Relevant work:

- `#35` fix CC4 viseme mapping

#### 4. Docs and first-run examples

- The README must describe the modern install and usage path accurately.
- Public examples should make it easy to test features quickly.
- Screenshots and animated examples should show the package in action.

Relevant work:

- `#31`, `#32`, `#33`

### Should-Have Requirements

- support for preset composition
- clearer guidance on mapping architecture and type patterns
- documented hair-physics defaults and validation

Relevant work:

- `#20`
- `#29`
- `#27`
- `#15`

### Explicitly Deferred

These should not block the next stable package milestone:

- broad architecture reviews (`#28`, `#29`, `#27`) unless they expose a concrete release blocker
- application-layer screenshot and thumbnail workflows
- large feature expansion before the release/distribution story is stable

## Product Boundary Decision

One important clarification for the roadmap:

- profile schema support for thumbnails or animation metadata can live in loom3 if the data is part of the reusable character profile model
- backend-driven tab control, screenshot orchestration, Firebase persistence, and authoring UI belong in LoomLarge

That means issue `#34` should be treated as primarily a LoomLarge implementation concern, with loom3 only supplying any shared types that are genuinely reusable.

## Definition of Done

loom3 is "finished" for the next release when all of the following are true:

1. The package publishes cleanly from an agreed release workflow.
2. Published versions, tags, and release notes agree with each other.
3. The profile schema supports downstream profile-scoped animation data in a backward-compatible way.
4. The CC4 viseme mapping is corrected and covered by tests.
5. The docs and examples are good enough that a new user can install the package and drive a character without reading deep source files.
6. LoomLarge can adopt the released package without depending on stale or ambiguous local versions.

## Priority Order

### P0: Package integrity

- fix release pipeline and version-sync discipline
- release a clean package version that downstream apps can trust

### P1: Schema and preset correctness

- land profile-scoped animation schema support
- fix CC4 viseme mapping

### P2: Docs and examples

- improve README, screenshots, and editable examples

### P3: Nice-to-have extensibility

- preset composition
- hair physics improvements
- broader architecture cleanup

## Success Metrics

- downstream apps can depend on released loom3 versions instead of unpublished local state
- a new developer can reach a first working character faster
- package updates have a clear, traceable release record
- profile portability improves because the schema carries the right data

## Summary

loom3 should be treated as a dependency product. The package is already technically solid enough to ship, but it needs release rigor, schema completion, and documentation clarity more than it needs another wave of speculative architecture work.
