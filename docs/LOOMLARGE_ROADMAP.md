# LoomLarge Roadmap

## Vision

Create a flexible realtime 3D character platform that can render complex personalities and agency-driven behaviors across multiple rendering engines (Babylon.js, React Three Fiber/Three.js, PlayCanvas), while remaining configurable via a shared dialogue/interaction layer. LoomLarge should become the canonical front-end shell that can be remotely orchestrated by agents, models, and external pipelines. A core requirement is first-class support for off-the-shelf avatar ecosystems (VRoid Studio, Ready Player Me) via engine adapters, mapping dictionaries, and animation retargeting packs tuned to their lower-resolution geometry.

## Strategic Pillars

1. **Engine Flexibility** – abstract rendering and asset pipelines so experiences can target Babylon.js, Fiber/Three.js, VRoid/Ready Player Me adapters, or other WebGL/WebGPU engines without rewriting interaction logic.
2. **Agency-driven Personas** – define configurable personality/interaction archetypes that can be composed into scene-level “agency networks.”
3. **Remote Orchestration** – expose a Python-based backend (with LiveKit streaming) that can drive avatars, camera moves, narrative beats, and tool responses.
4. **Operational Observability** – provide debugging, performance profiling, and agency state visualization tools to help authors tune behavior.

## Phase 1 – Foundations (Weeks 0-4)

- **Rendering Abstraction Layer**
  - Define an engine-agnostic scene contract (materials, shaders, animation controls, post-processing hooks).
  - Build adapters for Babylon.js and React Three Fiber that implement the contract; stub for VRoid/Ready Player Me engines (including avatar import workflows and metadata mapping).
- **Personality + Interaction Schema**
  - Specify JSON/YAML schema for persona definition (tone, gestures, autonomy, tool access).
  - Implement runtime loader that configures behaviors per agent; expose overrides via query params/URL config.
- **Agency Orchestration Hooks**
  - Align with existing agencies in the repo, defining lifecycle events (onSceneEnter, onCue, onToolInvoke).
  - Add instrumentation/logging for agency decisions (glbCacheDebug style UI overlay).
- **Python Backend Bootstrap**
  - Stand up FastAPI project with endpoints for persona config, scene state, and LiveKit session management.
  - Implement LiveKit signaling helpers to broadcast state changes to FE.

## Phase 2 – Multi-Engine Parity + Tooling (Weeks 4-8)

- **Parity Across Engines**
  - Ensure animation controllers, lip sync, morph targets, and lighting behave consistently between Babylon.js, Fiber, and avatar adapters (VRoid, Ready Player Me).
  - Create automated regression scenes to validate parity (screenshot/metric diffs).
  - Introduce mapping dictionaries that align LoomLarge persona rigs/visemes to lower-resolution skeletons/blendshapes.
- **Agency Graph Editor**
  - Build visual editor (likely React) for linking agencies together; export graph definitions used at runtime.
  - Support rule-based triggers, emotional state propagation, and memory slots shared between agents.
- **Complex Personality Packs**
  - Author reusable persona packs (e.g., “Navigator,” “Storyteller,” “Skeptic”) including vocal settings, gestural cues, and agency affinities.
  - Provide CLI to package and publish personas to a registry or Git-based catalog.
- **Avatar Adapter Toolkit**
  - Ship animation retargeting utilities and curated packs optimized for VRoid/Ready Player Me geometry (simplified rigs, reduced blendshape sets).
  - Document reference workflows for importing avatar assets, applying mapping dictionaries, and validating animation coverage.
- **Python Backend ↔ FE Bridge**
  - Integrate LiveKit data channels for sending agency directives, callbacks for FE telemetry.
  - Add Python-side adapters for major LLM providers (OpenAI, Anthropic) to generate dialog and control instructions.

## Phase 3 – Advanced Interactions (Weeks 8-12)

- **Agency-based Scene Simulation**
  - Support multi-agent conversations moderated by an agency “director,” with conflict resolution and turn-taking policies.
  - Add timeline scripting that mixes authored cues with AI improvisation while maintaining continuity.
- **Dynamic Environment + Avatar Control**
  - Expose APIs for Python backend to alter scene layout, lighting, camera rigs, or hot-swap avatar adapters (e.g., switch between LoomLarge native rig and Ready Player Me asset) in real time.
  - Provide preset cinematic sequences (push-ins, orbit shots) that can be triggered by agents or backend cues.
- **Telemetry + Debug Dashboard**
  - Build FE overlay for tracking persona states, agency votes, and backend directives.
  - Stream logs/metrics to the Python backend for centralized monitoring.

## Phase 4 – Ecosystem + Distribution (Weeks 12+)

- **Engine Marketplace**
  - Encourage community contributions for new engine adapters; provide testing harness and certification checklist.
- **Persona/Agency Marketplace**
  - Host library of persona packs and agency templates, with rating/versioning.
- **Deployment Tooling**
  - Offer turnkey deployment recipes (Vite/static hosting + backend) and CI templates for regression testing.
- **Live Performances**
  - Integrate with LiveKit’s SFU for multi-speaker stages, enabling real-time remote performances directed by the backend.

## Success Metrics

- Time to add a new rendering engine adapter < 2 weeks with parity suite passing.
- Persona pack adoption (downloads/installs) and agency graph reuse across demos.
- Backend orchestrated sessions running continuously with <150ms command latency via LiveKit.
- Developer satisfaction (survey or internal feedback) with debugging/visibility tools.

## Documentation-as-Book Plan – “Looms of Mind”

- **Working Title**: *Looms of Mind: Engineering Societies of Agents*. Subtitle: *From Society of Mind to Cybernetic Big Five Avatars*.
- **Format**: README chapters that mirror LoomLarge components, each pairing implementation notes with referenced scholarship.
- **Key References**: Minsky’s *Society of Mind* (sections “Simple Machines,” “Societies of Learners”), Minsky’s *The Emotion Machine* (chapters “Levels of Mental Activities,” “Critic-Selector”), Lugrin & Pelachaud’s *Handbook on Socially Interactive Agents*, Gumperz’s *Discourse Strategies*, *Oxford Handbook of Facial Perception*, and CBFT papers.

### LoomLarge-focused Chapters

1. **Chapter 0 – LoomLarge Project Setup**
   - Content: repo architecture, tooling, backend linkage, LiveKit plumbing.
   - References: *Society of Mind* chapter “Societies of Mind” (framing modular agents); *The Emotion Machine* “Resourcefulness” for layered control loops.
2. **Chapter 1 – LoomLarge UI Weave**
   - Content: UI composition, debug overlays, persona selectors.
   - References: Lugrin & Pelachaud “Interface Considerations” for socially interactive affordances; Gumperz “Conversational Inference” for UI cues tied to discourse framing.
3. **Chapter 2 – Engines & Mapping Lexicon**
   - Content: Babylon/Fiber adapters, VRoid and Ready Player Me pipelines, mapping dictionaries for rigs/visemes, animation retargeting packs.
   - References: *Oxford Handbook of Facial Perception* chapter “Dynamic Facial Information” for morph target fidelity; Lugrin & Pelachaud chapters on embodiment fidelity; CBFT’s trait modulation guiding animation parameter ranges.
4. **Chapter 3 – Persona + Interaction Systems**
   - Content: schema definition, agency hooks, emotion drives.
   - References: *The Emotion Machine* “Critics and Selectors,” *Society of Mind* “K-Lines,” CBFT literature on personality-driven behavior selection.
5. **Chapter 4 – Backend Orchestration & Remote Control**
   - Content: Python service, LiveKit streaming, agency directives.
   - References: Gumperz “Contextualization Cues” informing dialogue synthesis; Lugrin & Pelachaud chapters on multimodal coordination.

Each README chapter should cross-link to agencies detailed in the Latticework roadmap, ensuring readers can trace philosophical sources to concrete code modules.
