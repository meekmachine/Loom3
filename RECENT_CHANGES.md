# Recent Changes (Loom3)

## Current release highlights

### Mapping and control updates
- CC4 now includes independent eye AUs 65-72 for both morph and bone mappings.
- Composite eye axes now evaluate per-node effective values consistently, so shared-eye balance no longer leaks into independent-eye controls.
- CC4 head yaw/pitch/roll max degrees were increased for wider head turns.
- Preset-backed profile configs now extend canonical `annotationRegions` into the runtime `regions` mirror, preserving legacy `regions` only as fallback input or non-preset extras.
- Profile config, region/marker, and camera gaze helpers now live under profile-, region-, and camera-focused modules internally; the public `CharacterConfig` helpers remain as deprecated compatibility aliases.
- Annotation region profile overrides now merge by region name and preserve nested camera/style fields such as partial `cameraOffset` updates.

### Playback and mixer updates
- Clip stop now resolves cleanly, so stopping playback does not throw a rejected promise.
- Clip handles now expose `subscribe()` for keyframe, loop, seek, and completion events from the runtime update loop.
- Eye and head tracking clips stay cached on stop to avoid pose resets during continuous tracking.
- Snippet-to-clip conversion supports UUID-based tracks for bones, which avoids dot-name binding issues.
- Curves can be played through the mixer via `snippetToClip()` + `playClip()`, including composite bone rotations.

### Morph routing and docs
- Morph targeting prefers `morphToMesh.face` when present and falls back to scanning meshes for morph keys.
- README terminology now uses `Loom3` as the primary name, with `@lovelace_lol/loom3` as the package import.
- The docs now reflect the current viseme keys, preset extension helpers, and profile fields that the code actually exports.
- Publish versions are computed by `.github/workflows/publish.yml` from the current npm version or release tag before `npm publish`; the committed `package.json` version is only the baseline used by that workflow.
