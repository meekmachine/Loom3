![Latticework by Lovelace LOL](LoomLarge.png)

# LoomLarge (Latticework Animation Platform)

**LoomLarge** is a next-generation interactive 3D character animation platform built on **Latticework**, featuring reactive state management with XState, facial animation control via ARKit FACS (Facial Action Coding System), and modular agency-based architecture for lip-sync, eye/head tracking, prosodic expression, and conversational AI.

---

## Table of Contents
1. [Quick Start](#quick-start)
2. [Core Concepts](#core-concepts)
   - [Latticework Architecture](#latticework-architecture)
   - [Composite Rotation System](#composite-rotation-system)
   - [XState & Reactive Services](#xstate--reactive-services)
3. [Installation](#installation)
4. [Project Structure](#project-structure)
5. [How It Works](#how-it-works)
   - [Animation Service](#animation-service)
   - [Eye & Head Tracking](#eye--head-tracking)
   - [Lip-Sync Agency](#lip-sync-agency)
   - [Prosodic Expression](#prosodic-expression)
6. [Modules](#modules)
7. [Development](#development)
8. [Deployment](#deployment)
9. [License & Acknowledgments](#license--acknowledgments)

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/meekmachine/LoomLarge.git
cd LoomLarge

# Install dependencies
yarn install

# Start development server (Vite)
yarn dev

# Build for production
yarn build

# Deploy to GitHub Pages
yarn deploy
```

The development server will start at `http://localhost:5173` with hot module replacement enabled.

---

## Core Concepts

### Latticework Architecture

- **Agency-Based Design**: Independent services (agencies) handle specialized tasks:
  - **Animation Agency**: Core snippet scheduling and playback
  - **Lip-Sync Agency**: Phoneme prediction and viseme animation
  - **Prosodic Expression Agency**: Emotional head gestures and speech timing
  - **Eye/Head Tracking Agency**: Gaze control with mouse, webcam, or manual modes
  - **Conversation Agency**: Multi-modal conversational AI orchestration

- **Immutable State**: Reactive state management ensures predictable updates and time-travel debugging
- **XState Machines**: Declarative state machines replace callback hell and ad-hoc timers

### Composite Rotation System

The **Composite Rotation System** in EngineThree allows smooth blending of blendshapes (morphs) and bone rotations:

- **Continuum Values** (-1 to +1): Single value controls paired AUs (e.g., Head Left ↔ Right)
- **Mix Weights** (0 to 1): Blend between 100% morph (0) and 100% bone (1)
- **Unified Rotation State**: Prevents axis conflicts when multiple systems control the same bones

Example:
```typescript
// Eyes: -1 (look left) to +1 (look right)
engine.applyEyeComposite(yaw, pitch);

// Head: yaw/pitch/roll with mix control
engine.applyHeadComposite(yaw, pitch, roll);
```

### XState & Reactive Services

- **XState 5.x**: Modern state machines with TypeScript support
- **Service Pattern**: Each agency exposes a service with start/stop/update lifecycle
- **Global Context**: Services registered in `ModulesContext` for cross-component access

---

## Installation

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **Yarn** 1.22+ or npm 8+
- Modern browser with WebGL 2.0 support

### Setup Steps

1. **Clone and install**:
   ```bash
   git clone https://github.com/meekmachine/LoomLarge.git
   cd LoomLarge
   yarn install
   ```

2. **Add your 3D model**:
   - Place GLB file in `public/characters/`
   - Update model path in `src/App.tsx`:
     ```typescript
     const glbSrc = import.meta.env.BASE_URL + "characters/your-model.glb";
     ```

3. **Configure API keys** (optional, for AI modules):
   - Create `.env.local`:
     ```
     VITE_ANTHROPIC_API_KEY=sk-ant-...
     ```

4. **Start development**:
   ```bash
   yarn dev
   ```

---

## Project Structure

```
LoomLarge/
├── README.md                           # ← This file
├── package.json
├── vite.config.ts                      # Vite bundler config
├── public/
│   ├── characters/                     # GLB 3D models
│   ├── animations/                     # Pre-baked animation JSON
│   ├── models/                         # ML models (face-api.js)
│   └── skyboxes/                       # Environment maps
├── src/
│   ├── App.tsx                         # Main React app entry
│   ├── main.tsx                        # Vite entry point
│   ├── engine/
│   │   ├── EngineThree.ts              # Three.js engine (AU/morph control)
│   │   ├── EngineWind.ts               # Wind physics for hair/cloth
│   │   └── arkit/
│   │       └── shapeDict.ts            # ARKit FACS AU → morph mappings
│   ├── latticework/                    # Core agencies
│   │   ├── animation/                  # Animation scheduler (XState)
│   │   ├── lipsync/                    # Lip-sync phoneme predictor
│   │   ├── prosodic/                   # Prosodic expression (head gestures)
│   │   ├── eyeHeadTracking/            # Eye/head tracking service
│   │   ├── conversation/               # Conversational AI orchestration
│   │   └── transcription/              # Speech-to-text services
│   ├── components/
│   │   ├── au/                         # AU control UI components
│   │   │   ├── AUSection.tsx           # AU sliders
│   │   │   ├── VisemeSection.tsx       # Viseme controls
│   │   │   ├── EyeHeadTrackingSection.tsx  # Eye/head tracking UI
│   │   │   └── ContinuumSlider.tsx     # Bidirectional AU slider
│   │   ├── SliderDrawer.tsx            # Main dockable UI drawer
│   │   ├── PlaybackControls.tsx        # Animation playback controls
│   │   ├── CurveEditor.tsx             # Visual curve editor
│   │   └── ModulesMenu.tsx             # Module activation UI
│   ├── modules/                        # Pluggable modules
│   │   ├── aiChat/                     # AI chat module (Anthropic)
│   │   ├── frenchQuiz/                 # French quiz demo module
│   │   └── config.ts                   # Module registry
│   ├── context/
│   │   ├── threeContext.tsx            # Global engine/animation context
│   │   └── ModulesContext.tsx          # Module state management
│   ├── hooks/
│   │   └── useWebcamEyeTracking.ts     # Webcam face tracking hook
│   ├── scenes/
│   │   └── CharacterGLBScene.tsx       # Three.js React scene
│   └── utils/
│       └── animationLoader.ts          # Load animation JSON files
└── docs/                               # Documentation
    ├── QUICK_START.md
    ├── LIPSYNC_COMPLETE_GUIDE.md
    ├── BACKEND_INTEGRATION.md
    └── DEPLOYMENT.md
```

---

## How It Works

### Animation Service

The **Animation Service** (`latticework/animation/animationService.ts`) is the core scheduler:

1. **Load Snippets**: JSON files defining AU/morph keyframe curves
   ```typescript
   const anim = createAnimationService(host);
   anim.loadSnippet('smile', smileSnippetJSON);
   ```

2. **Schedule Playback**: Queue snippets with priority and duration
   ```typescript
   anim.schedule('smile', {
     duration: 1000,
     priority: 10,
     loop: false
   });
   ```

3. **XState Machine**: Manages snippet lifecycle (`idle` → `playing` → `paused`)
   - Driven by central frame loop (`threeContext.tsx`)
   - Handles overlapping snippets with priority-based blending

4. **Host Interface**: Abstraction layer for AU/morph application
   ```typescript
   const host = {
     applyAU: (id, value) => engine.setAU(id, value),
     setMorph: (key, value) => engine.setMorph(key, value),
     transitionAU: (id, value, duration) => engine.transitionAU(id, value, duration)
   };
   ```

### Eye & Head Tracking

The **Eye/Head Tracking Service** (`latticework/eyeHeadTracking/eyeHeadTrackingService.ts`) provides three tracking modes:

1. **Manual Mode**: Direct slider control of gaze direction
2. **Mouse Mode**: Character follows cursor with mirror behavior
   - Mouse left → Character looks right (at user)
   - Negative x coordinate for natural gaze
3. **Webcam Mode**: Face tracking using BlazeFace model
   - Real-time eye position detection
   - Normalized coordinates (-1 to 1)

**Key Features**:
- **Composite Methods**: Uses `applyEyeComposite(yaw, pitch)` and `applyHeadComposite(yaw, pitch, roll)`
- **Intensity Control**: Separate sliders for eye and head movement intensity
- **Head Follow Eyes**: Optional delayed head movement matching eye gaze
- **Global Service**: Created in App.tsx and shared via ModulesContext

**Usage**:
```typescript
// Initialize service with engine reference
const service = createEyeHeadTrackingService({
  eyeTrackingEnabled: true,
  headTrackingEnabled: true,
  headFollowEyes: true,
  eyeIntensity: 1.0,
  headIntensity: 0.5,
  engine: engine
});

service.start();
service.setMode('mouse'); // or 'webcam' or 'manual'

// Set gaze target manually
service.setGazeTarget({ x: 0.5, y: -0.2, z: 0 });
```

### Lip-Sync Agency

The **Lip-Sync Agency** (`latticework/lipsync/`) generates viseme animations from text:

1. **Phoneme Prediction**: Enhanced predictor with coarticulation model
   ```typescript
   const predictor = new EnhancedPhonemePredictor();
   const phonemes = predictor.predict('Hello world');
   ```

2. **Viseme Mapping**: Phonemes → ARKit visemes (AA, CH_J, DD, etc.)
   - Timing based on phoneme duration and speech rate
   - Coarticulation smoothing between adjacent phonemes

3. **Animation Snippet Generation**: Creates JSON snippets for animation service
   ```typescript
   const snippet = generateLipsyncSnippet(text, {
     speechRate: 1.0,
     intensity: 0.8,
     style: 'relaxed' // or 'precise', 'theatrical', etc.
   });
   ```

4. **Integration**: Scheduled via animation service with high priority (30)

### Prosodic Expression

The **Prosodic Expression Agency** (`latticework/prosodic/prosodicService.ts`) adds emotional head movements:

1. **XState Machine**: Models prosodic states (idle → analyzing → expressing)
2. **Gesture Library**: Pre-defined head nods, tilts, and shakes
   - Nod: Positive affirmation (head pitch down)
   - Shake: Negation (head yaw side-to-side)
   - Tilt: Curiosity/emphasis (head roll)

3. **Emotion Mapping**: Text analysis triggers appropriate gestures
   ```typescript
   // Question → slight head tilt
   // Exclamation → head nod emphasis
   // Negation words → head shake
   ```

4. **Scheduling**: Prosodic snippets scheduled with medium priority (20)

---

## Modules

LoomLarge supports pluggable modules for extended functionality:

### AI Chat Module
- **Description**: Real-time conversational AI using Anthropic Claude
- **Location**: `src/modules/aiChat/`
- **Features**:
  - Streaming text-to-speech synthesis
  - Lip-sync integration with prosodic expression
  - Eye/head tracking during conversation
  - WebSocket or LiveKit audio streaming

**Activation**:
```typescript
// Via ModulesMenu UI or programmatically:
import { AIChatApp } from './modules/aiChat';
<AIChatApp animationManager={anim} />
```

### French Quiz Module
- **Description**: Interactive language learning demo
- **Location**: `src/modules/frenchQuiz/`
- **Features**:
  - Survey-style question flow
  - Facial expressions tied to correct/incorrect answers
  - Modal-based UI with progress tracking

### Custom Modules

Create your own modules by following this pattern:

1. **Define module config** (`src/modules/config.ts`):
   ```typescript
   export default {
     modules: [
       {
         name: 'My Module',
         description: 'Custom module description',
         component: './modules/myModule/index.tsx'
       }
     ]
   };
   ```

2. **Create module component**:
   ```typescript
   // src/modules/myModule/index.tsx
   import React from 'react';
   import { useModulesContext } from '../../context/ModulesContext';

   export default function MyModule({ animationManager }: any) {
     const { eyeHeadTrackingService } = useModulesContext();

     // Your module logic here
     return <div>My Module UI</div>;
   }
   ```

---

## Development

### Running the Dev Server

```bash
yarn dev
```

Access at `http://localhost:5173` with:
- Hot module replacement (HMR)
- Source maps for debugging
- Console logging for all services

### Testing Animation Snippets

Load test animations in the browser console:

```javascript
// Global handles (auto-exposed in dev mode)
window.facslib  // EngineThree instance
window.anim     // Animation service

// Load and play a snippet
anim.loadSnippet('test', {
  duration: 2000,
  keyframes: {
    'AU_12': [[0, 0], [1000, 1], [2000, 0]], // Smile curve
    'AU_6': [[0, 0], [1000, 0.8], [2000, 0]]  // Cheek raise
  }
});
anim.schedule('test', { priority: 10 });
anim.play();
```

### Debugging Eye/Head Tracking

The service includes comprehensive diagnostic logging:

```javascript
// Check current mode
window.eyeHeadTrackingService?.getMode(); // 'manual' | 'mouse' | 'webcam'

// Set gaze manually
window.eyeHeadTrackingService?.setGazeTarget({ x: 0.5, y: -0.3, z: 0 });

// Update configuration
window.eyeHeadTrackingService?.updateConfig({
  eyeIntensity: 1.0,
  headIntensity: 0.7,
  headFollowEyes: true
});
```

### TypeScript Type Checking

```bash
yarn typecheck
```

Runs `tsc --noEmit` to validate types without building.

---

## Deployment

### GitHub Pages Deployment

The project is configured for automatic GitHub Pages deployment:

```bash
yarn deploy
```

This script:
1. Builds production bundle (`yarn build`)
2. Deploys to `gh-pages` branch
3. Publishes to `https://meekmachine.github.io/LoomLarge`

**Configuration** (`vite.config.ts`):
```typescript
export default defineConfig({
  base: '/LoomLarge/', // GitHub repo name
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});
```

### Custom Domain

To use a custom domain:

1. Add `CNAME` file to `public/`:
   ```
   your-domain.com
   ```

2. Configure DNS:
   ```
   A    185.199.108.153
   A    185.199.109.153
   A    185.199.110.153
   A    185.199.111.153
   CNAME www your-username.github.io
   ```

3. Deploy:
   ```bash
   yarn deploy
   ```

---

## API Reference

### Animation Service API

```typescript
interface AnimationService {
  loadSnippet(name: string, snippet: AnimationSnippet): void;
  schedule(name: string, options?: ScheduleOptions): void;
  play(): void;
  pause(): void;
  stop(): void;
  setLoop(loop: boolean): void;
  scrub(time: number): void;
  step(deltaSeconds: number): void;
  dispose(): void;
}
```

### Eye/Head Tracking Service API

```typescript
interface EyeHeadTrackingService {
  start(): void;
  stop(): void;
  setGazeTarget(target: GazeTarget): void;
  setMode(mode: 'manual' | 'mouse' | 'webcam'): void;
  getMode(): 'manual' | 'mouse' | 'webcam';
  updateConfig(config: Partial<EyeHeadTrackingConfig>): void;
  setSpeaking(isSpeaking: boolean): void;
  setListening(isListening: boolean): void;
  blink(): void;
  dispose(): void;
}
```

### EngineThree Composite Methods

```typescript
class EngineThree {
  // Eye composite rotation (yaw/pitch)
  applyEyeComposite(yaw: number, pitch: number): void;

  // Head composite rotation (yaw/pitch/roll)
  applyHeadComposite(yaw: number, pitch: number, roll?: number): void;

  // Get/Set AU mix weight (morph ↔ bone blend)
  getAUMixWeight(auId: number): number | undefined;
  setAUMixWeight(auId: number, mix: number): void;

  // Direct AU control
  setAU(id: number | string, value: number): void;
  setMorph(key: string, value: number): void;

  // Smooth transitions
  transitionAU(id: number | string, target: number, duration?: number): void;
  transitionMorph(key: string, target: number, duration?: number): void;
}
```

---

## Troubleshooting

### Character Not Moving

1. **Check engine initialization**:
   ```javascript
   console.log(window.facslib); // Should show EngineThree instance
   ```

2. **Verify service startup**:
   ```javascript
   console.log(window.anim?.getSnapshot?.().value); // Should show 'playing' or 'idle'
   ```

3. **Check eye/head tracking**:
   ```javascript
   window.eyeHeadTrackingService?.getState(); // Should show current gaze/status
   ```

### Eye Tracking Direction Issues

- **Eyes looking wrong way**: Check coordinate negation in `eyeHeadTrackingService.ts:283`
- **Head not following**: Verify `headFollowEyes` is enabled in config
- **Intensity too low**: Increase `eyeIntensity` and `headIntensity` sliders

### Animation Not Loading

1. **Check JSON format**:
   - Must have `duration` and `keyframes` fields
   - AU keys must match ARKit spec (e.g., 'AU_12', not '12')

2. **Verify snippet name**:
   ```javascript
   anim.listSnippets(); // Show all loaded snippets
   ```

3. **Check console for errors**:
   - Look for `[Animation]` prefixed logs
   - Validate keyframe curve format: `[[time, value], ...]`

### TensorFlow.js Bundling Errors

If you encounter errors related to TensorFlow.js modules (e.g., `@tensorflow/tfjs-core/dist/ops/ops_for_converter`), this is a **known issue** with TensorFlow.js 4.x and Vite.

**The Problem:**
- TensorFlow.js references internal module paths that don't actually exist in the npm package
- Vite's esbuild optimizer cannot resolve these phantom paths
- Results in 100+ bundling errors about missing exports and modules

**Solution (Already Implemented):**
LoomLarge loads TensorFlow.js and BlazeFace from **CDN** instead of npm packages:

```html
<!-- index.html -->
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface@0.0.7/dist/blazeface.js"></script>
```

The code uses global `blazeface` object with TypeScript declarations:
```typescript
// useWebcamEyeTracking.ts
declare const blazeface: any;
const model = await blazeface.load();
```

Vite config excludes TensorFlow packages from optimization:
```typescript
// vite.config.ts
optimizeDeps: {
  exclude: [
    '@tensorflow/tfjs',
    '@tensorflow/tfjs-core',
    '@tensorflow/tfjs-converter',
    '@tensorflow/tfjs-backend-cpu',
    '@tensorflow/tfjs-backend-webgl',
    '@tensorflow-models/blazeface',
  ],
}
```

**If you still see errors:**
1. Ensure TensorFlow packages are NOT in `package.json` dependencies
2. Clear Vite cache: `rm -rf node_modules/.vite`
3. Restart dev server: `yarn dev`

See [src/hooks/README_useWebcamEyeTracking.md](src/hooks/README_useWebcamEyeTracking.md) for full documentation.

### Build Errors

```bash
# Clear cache and rebuild
rm -rf node_modules dist .vite
yarn install
yarn build
```

---

## Performance Optimization

### Animation Loop

- Central frame loop runs at 60 FPS (`threeContext.tsx`)
- Animation scheduler ticks every frame via `step(deltaTime)`
- Morph/bone updates batched per frame

### Composite Rotation Caching

- Rotation state cached in `compositeRotationState` map
- Only recalculates when values change
- Avoids redundant Three.js object updates

### Snippet Scheduling

- Priority-based scheduler prevents conflicts
- Lower priority snippets paused when higher priority plays
- Automatic cleanup of completed snippets

---

## Contributing

We welcome contributions! Please follow these guidelines:

1. **Fork and clone** the repository
2. **Create a feature branch**: `git checkout -b feature/my-feature`
3. **Follow code style**:
   - TypeScript strict mode
   - ESLint/Prettier for formatting
   - Descriptive variable names
4. **Test thoroughly**:
   - Manual testing in dev mode
   - TypeScript type checking (`yarn typecheck`)
5. **Commit with descriptive messages**:
   ```
   feat: Add webcam eye tracking support
   fix: Correct head yaw direction in mouse mode
   docs: Update README with API reference
   ```
6. **Push and create PR** to `main` branch

---

## License & Acknowledgments

**© 2025 Jonathan Sutton Fields, Lovelace LOL**
Licensed under the **Loom Large, Latticework copyleft license**

### Acknowledgments

- **Three.js** – 3D rendering engine
- **XState** – State machine library
- **React** – UI framework
- **Vite** – Lightning-fast bundler
- **ARKit** – Facial Action Coding System specification
- **BlazeFace** – Webcam face detection model

### Related Projects

- **VISOS** – Predecessor architecture (object-oriented)
- **eEVA Workbench** – Original survey/conversation platform
- **Latticework** – Core agency framework

---

## Support

- **Issues**: [GitHub Issues](https://github.com/meekmachine/LoomLarge/issues)
- **Discussions**: [GitHub Discussions](https://github.com/meekmachine/LoomLarge/discussions)
- **Email**: jonathan@lovelacelol.com

---

**Built with ❤️ by the Latticework team**
