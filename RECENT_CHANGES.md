# Recent Changes (Loom3)

## Independent eye controls
- CC4 now includes independent eye AUs 65-72 for both morph and bone mappings.
- Grouped composite eye axes now evaluate per-node effective values consistently, so shared-eye balance no longer leaks into independent-eye controls.

## Mixer + clip handling
- Clip stop now resolves cleanly so stopping playback does not throw a rejected promise.
- Eye/head tracking clips remain cached (no uncache on stop) to avoid pose resets during continuous tracking.
- Snippet-to-clip conversion now supports UUID-based tracks for bones, which avoids dot-name binding issues.

## Curve playback + morph targeting
- Curves can be played through the mixer via `snippetToClip` + `playClip`, including composite bone rotations.
- Morph targeting prefers `morphToMesh.face` when present and falls back to scanning meshes for morph keys.

## CC4 head range tuning
- Head yaw/pitch/roll max degrees increased for wider head turns.

## Naming + exports
- README updated to `Loom3` terminology and `@lovelace_lol/loom3` package usage.
- `Loom3` is now the primary Three.js implementation name; legacy aliases remain for compatibility.
