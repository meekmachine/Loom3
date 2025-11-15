
# Animation Agency Documentation

A modular system for loading, controlling, and driving facial animations (Action Units and visemes) via a unified Service API, backed by an XState machine and a simple scheduler.

---

## 1. Architecture Overview

The Animation Agency consists of multiple layers:

1. **Service API** (`animationService.js`)
   - A singleton JavaScript API used by React components, the Prosodic Expression Service, and the Emotive Expression Service to interact with animations.
   - Methods include loading/removing snippets, playback control, scrubbing, and AU curve management.

2. **State Machine** (`animationMachine.js`)
   - An XState machine maintaining `context.animations`, handling events such as `LOAD_ANIMATION`, `REMOVE_ANIMATION`, `TICK`, `PLAY_ALL`, `PAUSE_ALL`, and `STOP_ALL`.
   - On each `TICK`, it advances snippet times, interpolates AU intensities from keyframe curves, and syncs them to the FACS service.

3. **Scheduler** (`animationScheduler.js`)
   - A simple interval scheduler that sends `TICK` events to the machine at a configurable rate (default 100 ms).
   - Supports continuous playback when snippets are playing and immediate scrubbing via manual `TICK` triggers.

4. **Expression Services**
   - **Prosodic Expression Service** (`prosodicExpressionService.js`) uses the Animation Service to load and loop facial animations (e.g., brow and head loops) in sync with prosody.
   - **Emotive Expression Service** (`emotiveExpressionService.js`) queues and plays emotion snippets based on emojis or explicit API calls, also leveraging the same Animation Service.

---

## 2. Service API Reference

Import and instantiate the singleton:

```js
import { createAnimationService } from './animationService';
const animationService = createAnimationService();
```

### Snippet Loading & Removal

- `animationService.loadFromLocal(key, category?, priority?)` – Load a JSON snippet from `localStorage[key]`.
- `animationService.loadFromJSON(json, category?, priority?)` – Load a JSON object as a snippet.
- `animationService.removeAnimation(name)` – Remove a snippet by name.

### Playback Control

- `animationService.play()`, `.pause()`, `.stop()` – Global playback controls for all snippets.
- `animationService.setSnippetPlaying(name, bool)` – Play or pause a specific snippet.
- `animationService.setSnippetLoop(name, bool)` – Toggle looping for a snippet.

### Time Control & Scrubbing

- `animationService.setSnippetTime(name, time)` – Set the snippet’s currentTime in seconds and immediately fire a `TICK` to update the machine and UI.
- `animationService.setSnippetMaxTime(name, maxTime)`
- `animationService.setSnippetPlaybackRate(name, rate)`
- `animationService.setSnippetIntensityScale(name, scale)`

### AU Curve Management

- `animationService.getCurves()` – Get the keyframes for the most recently loaded snippet.
- `animationService.setAUCurve(auId, keyframes)` – Replace the AU keyframes in the last snippet.

### Subscription & State

- `animationService.onTransition(cb)` – Subscribe to machine transitions when the state changes.
- `animationService.getState()` – Retrieve the raw XState state.
- `animationService.dispose()` – Stop the scheduler and the machine service.

---

## 3. State Machine Internals

Defined in `animationMachine.js`:

- **Context:**
  ```text
  {
    animations: Array<Snippet>,
    stepTime: number,
    currentTime: number,
    overallMaxTime: number,
    loop: boolean
  }
  ```

- **Events:**
  - `LOAD_ANIMATION`, `REMOVE_ANIMATION`
  - `TICK` – advances time and syncs all AUs
  - `PLAY_ALL`, `PAUSE_ALL`, `STOP_ALL`

- **Tick Handler:** Advances each snippet’s `currentTime`, interpolates keyframes, and sends `SET_AU` to the FACS service for each AU. Updates global time and loop flags.

---

## 4. Scheduler Details

Provided by `animationScheduler.js`:

```js
createAnimationScheduler(xstateService, intervalMs = 100)
```
- `start()` – begins periodic `TICK` events.
- `stop()` – halts them.

Manual calls to `setSnippetTime` also trigger an immediate `TICK`, ensuring scrubbing works when paused.

---

## 5. Integration with Expression Services

- **Prosodic Expression Service** uses the Animation Service to load and loop animations in parallel (brow and head control) based on speaking events. It shares the same scheduler and machine.

- **Emotive Expression Service** queues emotion snippets from emojis or API calls, loading them via the Animation Service and playing them in sequence using its own XState scheduler.

Both services rely on the same core Animation Agency for snippet management, scrubbing, and AU syncing.
