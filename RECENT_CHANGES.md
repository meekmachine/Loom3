# Recent Changes (Loom3)

## Current release highlights

### Mapping and control updates
- CC4 now includes independent eye AUs 65-72 for both morph and bone mappings.
- Composite eye axes now evaluate per-node effective values consistently, so shared-eye balance no longer leaks into independent-eye controls.
- CC4 head yaw/pitch/roll max degrees were increased for wider head turns.

### Playback and mixer updates
- Clip stop now resolves cleanly, so stopping playback does not throw a rejected promise.
- Clip handles now expose `subscribe()` for keyframe, loop, seek, and completion events from the runtime update loop.
- Eye and head tracking clips stay cached on stop to avoid pose resets during continuous tracking.
- Snippet-to-clip conversion supports UUID-based tracks for bones, which avoids dot-name binding issues.
- Curves can be played through the mixer via `snippetToClip()` + `playClip()`, including composite bone rotations.

### Morph routing and docs
- Morph targeting prefers `morphToMesh.face` when present and falls back to scanning meshes for morph keys.
- README terminology now uses `Loom3` as the primary name, with `@lovelace_lol/loom3` as the package import.
- The docs now reflect the current viseme keys, preset merge helper, and profile fields that the code actually exports.
