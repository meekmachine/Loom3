/**
 * LoomLargeThree - Three.js Implementation
 *
 * Default implementation of the LoomLarge interface for Three.js.
 * Controls 3D character facial animation using Action Units (AUs),
 * morph targets, visemes, and bone transformations.
 */

import { Clock, Quaternion, Vector3 } from 'three';
import type {
  LoomLarge,
  LoomMesh,
  LoomObject3D,
  ReadyPayload,
  LoomLargeConfig,
  MeshInfo,
} from '../../interfaces/LoomLarge';
import type { Animation } from '../../interfaces/Animation';
import type { TransitionHandle, BoneKey, RotationsState } from '../../core/types';
import type { AUMappingConfig } from '../../mappings/types';
import { AnimationThree } from './AnimationThree';
import { CC4_PRESET, CC4_MESHES, COMPOSITE_ROTATIONS as CC4_COMPOSITE_ROTATIONS, BONE_AU_TO_BINDINGS as CC4_BONE_AU_TO_BINDINGS } from '../../presets/cc4';
import type { CompositeRotation, BoneBinding } from '../../core/types';

const deg2rad = (d: number) => (d * Math.PI) / 180;

// Axis vectors for quaternion rotation (like stable version)
const X_AXIS = new Vector3(1, 0, 0);
const Y_AXIS = new Vector3(0, 1, 0);
const Z_AXIS = new Vector3(0, 0, 1);

/**
 * Build AU to composite map from composite rotations config.
 * Maps AU ID to { nodes, axis } so we know which semantic axis (pitch/yaw/roll) to use.
 */
function buildAUToCompositeMap(composites: CompositeRotation[]): Map<number, { nodes: string[]; axis: 'pitch' | 'yaw' | 'roll' }> {
  const map = new Map<number, { nodes: string[]; axis: 'pitch' | 'yaw' | 'roll' }>();
  composites.forEach(comp => {
    (['pitch', 'yaw', 'roll'] as const).forEach(axisName => {
      const axisConfig = comp[axisName];
      if (axisConfig) {
        axisConfig.aus.forEach(auId => {
          const existing = map.get(auId);
          if (existing) {
            existing.nodes.push(comp.node);
          } else {
            map.set(auId, { nodes: [comp.node], axis: axisName });
          }
        });
      }
    });
  });
  return map;
}

function clamp01(x: number) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/**
 * NodeBase - internal bone snapshot
 */
interface NodeBase {
  obj: LoomObject3D;
  basePos: { x: number; y: number; z: number };
  baseQuat: any;
  baseEuler: { x: number; y: number; z: number; order: string };
}

type ResolvedBones = Partial<Record<string, NodeBase>>;

export class LoomLargeThree implements LoomLarge {
  // Configuration
  private config: AUMappingConfig;

  // Animation system (injectable)
  private animation: Animation;

  // Composite rotation mappings (built from config or default CC4)
  private compositeRotations: CompositeRotation[];
  private auToCompositeMap: Map<number, { nodes: string[]; axis: 'pitch' | 'yaw' | 'roll' }>;

  // State
  private auValues: Record<number, number> = {};
  private rigReady = false;
  private missingBoneWarnings = new Set<string>();

  // Rotation state
  private rotations: RotationsState = {};
  private pendingCompositeNodes = new Set<string>();
  private isPaused = false;
  private translations: Record<string, { x: number; y: number; z: number }> = {};

  // Mesh references
  private faceMesh: LoomMesh | null = null;
  private meshes: LoomMesh[] = [];
  private model: LoomObject3D | null = null;
  private meshByName = new Map<string, LoomMesh>();
  private morphCache = new Map<string, { infl: number[]; idx: number }[]>();

  // Bones
  private bones: ResolvedBones = {};
  private mixWeights: Record<number, number> = {};

  // Viseme state
  private visemeValues: number[] = new Array(15).fill(0);

  // Internal RAF loop
  private clock = new Clock();
  private rafId: number | null = null;
  private running = false;

  // Viseme jaw amounts
  private static readonly VISEME_JAW_AMOUNTS: number[] = [
    0.15, 0.35, 0.25, 0.70, 0.55, 0.30, 0.10, 0.20, 0.08,
    0.12, 0.18, 0.02, 0.25, 0.60, 0.40,
  ];
  private static readonly JAW_MAX_DEGREES = 28;

  // Hair physics state
  private hairPhysicsEnabled = false;
  private hairPhysicsConfig = {
    stiffness: 7.5,
    damping: 0.18,
    inertia: 3.5,
    gravity: 12,
    responseScale: 2.5,
    idleSwayAmount: 0.12,
    idleSwaySpeed: 1.0,
    windStrength: 0,
    windDirectionX: 1.0,
    windDirectionZ: 0,
    windTurbulence: 0.3,
    windFrequency: 1.4,
  };
  private hairWindIdleState = {
    windTime: 0,
    idlePhase: 0,
    smoothedWindX: 0,
    smoothedWindZ: 0,
  };
  private registeredHairObjects = new Map<string, LoomMesh>();
  private cachedHairMeshNames: string[] | null = null;

  constructor(config: LoomLargeConfig = {}, animation?: Animation) {
    this.config = config.auMappings || CC4_PRESET;
    this.mixWeights = { ...this.config.auMixDefaults };
    this.animation = animation || new AnimationThree();

    // Use config's composite rotations or default to CC4
    this.compositeRotations = this.config.compositeRotations || CC4_COMPOSITE_ROTATIONS;
    this.auToCompositeMap = buildAUToCompositeMap(this.compositeRotations);
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  onReady(payload: ReadyPayload): void {
    const { meshes, model } = payload;

    this.meshes = meshes;
    this.model = model;
    this.meshByName.clear();
    this.morphCache.clear();

    // Build mesh lookup
    model.traverse((obj: any) => {
      if (obj.isMesh && obj.name) {
        const infl = obj.morphTargetInfluences;
        if (Array.isArray(infl) && infl.length > 0) {
          this.meshByName.set(obj.name, obj);
        }
      }
    });

    // Find primary face mesh
    const faceMeshNames = this.config.morphToMesh?.face || [];
    const defaultFace = meshes.find((m) => faceMeshNames.includes(m.name));
    if (defaultFace) {
      this.faceMesh = defaultFace;
    } else {
      const candidate = meshes.find((m) => {
        const dict = m.morphTargetDictionary;
        return dict && typeof dict === 'object' && 'Brow_Drop_L' in dict;
      });
      this.faceMesh = candidate || null;
    }

    // Resolve bones
    this.bones = this.resolveBones(model);
    this.rigReady = true;
    this.missingBoneWarnings.clear();
    this.initBoneRotations();

    // Apply render order and material settings from CC4_MESHES
    this.applyMeshMaterialSettings(model);
  }

  update(deltaSeconds: number): void {
    const dtSeconds = Math.max(0, deltaSeconds || 0);
    if (dtSeconds <= 0 || this.isPaused) return;

    this.animation.tick(dtSeconds);
    this.flushPendingComposites();

    // Wind/idle hair animations (only when physics enabled)
    this.updateHairWindIdle(dtSeconds);
  }

  /** Start the internal RAF loop */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.clock.start();

    const tick = () => {
      if (!this.running) return;
      const dt = this.clock.getDelta();
      this.update(dt);
      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  /** Stop the internal RAF loop */
  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.clock.stop();
  }

  dispose(): void {
    this.stop();
    this.clearTransitions();
    this.meshes = [];
    this.model = null;
    this.bones = {};
  }

  // ============================================================================
  // AU CONTROL
  // ============================================================================

  setAU(id: number | string, v: number, balance?: number): void {
    if (typeof id === 'string') {
      const match = id.match(/^(\d+)([LR])$/i);
      if (match) {
        const au = Number(match[1]);
        const side = match[2].toUpperCase() as 'L' | 'R';
        const sideBalance = side === 'L' ? -1 : 1;
        this.setAU(au, v, sideBalance);
        return;
      }
      const n = Number(id);
      if (!Number.isNaN(n)) {
        this.setAU(n, v, balance);
      }
      return;
    }

    this.auValues[id] = v;

    const keys = this.config.auToMorphs[id] || [];
    if (keys.length) {
      const mixWeight = this.isMixedAU(id) ? this.getAUMixWeight(id) : 1.0;
      const base = clamp01(v) * mixWeight;
      const meshNames = this.getMeshNamesForAU(id);

      const leftKeys = keys.filter((k) => /(_L$| L$|Left$)/i.test(k));
      const rightKeys = keys.filter((k) => /(_R$| R$|Right$)/i.test(k));
      const centerKeys = keys.filter((k) => !/(_L$| L$|Left$|_R$| R$|Right$)/i.test(k));

      const { left: leftVal, right: rightVal } = this.computeSideValues(base, balance);

      if (leftKeys.length || rightKeys.length) {
        for (const k of leftKeys) this.setMorph(k, leftVal, meshNames);
        for (const k of rightKeys) this.setMorph(k, rightVal, meshNames);
      } else {
        centerKeys.push(...keys);
      }

      for (const k of centerKeys) {
        this.setMorph(k, base, meshNames);
      }
    }

    // Check if this AU affects composite rotations
    const compositeInfo = this.auToCompositeMap.get(id);

    if (compositeInfo) {
      // This AU affects composite bone rotations - use axis from compositeRotations
      for (const nodeKey of compositeInfo.nodes) {
        const config = this.compositeRotations.find((c: CompositeRotation) => c.node === nodeKey);
        if (!config) continue;

        const axisConfig = config[compositeInfo.axis];
        if (!axisConfig) continue;

        // Calculate axis value based on whether it's a continuum pair
        let axisValue: number;
        if (axisConfig.negative !== undefined && axisConfig.positive !== undefined) {
          // Continuum: calculate difference between positive and negative AUs
          const negValue = this.auValues[axisConfig.negative] ?? 0;
          const posValue = this.auValues[axisConfig.positive] ?? 0;
          axisValue = posValue - negValue;
        } else if (axisConfig.aus.length > 1) {
          // Multiple AUs affect same axis (e.g., jaw drop) - use max
          axisValue = Math.max(...axisConfig.aus.map((auId: number) => this.auValues[auId] ?? 0));
        } else {
          // Single AU controls this axis
          axisValue = v;
        }

        this.updateBoneRotation(nodeKey, compositeInfo.axis, axisValue);
        this.pendingCompositeNodes.add(nodeKey);
      }
    }

    // Handle translations (non-composite)
    const bindings = this.config.auToBones[id];
    if (bindings) {
      for (const binding of bindings) {
        if (binding.channel === 'tx' || binding.channel === 'ty' || binding.channel === 'tz') {
          if (binding.maxUnits !== undefined) {
            this.updateBoneTranslation(binding.node, binding.channel, v * binding.scale, binding.maxUnits);
          }
        }
      }
    }
  }

  transitionAU(id: number | string, to: number, durationMs = 200, balance?: number): TransitionHandle {
    const numId = typeof id === 'string' ? Number(id.replace(/[^\d]/g, '')) : id;
    const target = clamp01(to);

    const morphKeys = this.config.auToMorphs[numId] || [];
    const bindings = this.config.auToBones[numId] || [];

    const mixWeight = this.isMixedAU(numId) ? this.getAUMixWeight(numId) : 1.0;
    const base = target * mixWeight;

    const { left: leftVal, right: rightVal } = this.computeSideValues(base, balance);

    this.auValues[numId] = target;

    const handles: TransitionHandle[] = [];
    const meshNames = this.getMeshNamesForAU(numId);

    const leftKeys = morphKeys.filter((k) => /(_L$|Left$)/.test(k));
    const rightKeys = morphKeys.filter((k) => /(_R$|Right$)/.test(k));
    const centerKeys = morphKeys.filter((k) => !/(_L$|Left$|_R$|Right$)/.test(k));

    if (leftKeys.length || rightKeys.length) {
      for (const k of leftKeys) {
        handles.push(this.transitionMorph(k, leftVal, durationMs, meshNames));
      }
      for (const k of rightKeys) {
        handles.push(this.transitionMorph(k, rightVal, durationMs, meshNames));
      }
    } else {
      centerKeys.push(...morphKeys);
    }

    for (const k of centerKeys) {
      handles.push(this.transitionMorph(k, base, durationMs, meshNames));
    }

    // Handle bone rotations using auToCompositeMap
    const compositeInfo = this.auToCompositeMap.get(numId);
    if (compositeInfo) {
      for (const nodeKey of compositeInfo.nodes) {
        const config = this.compositeRotations.find((c: CompositeRotation) => c.node === nodeKey);
        if (!config) continue;

        const axisConfig = config[compositeInfo.axis];
        if (!axisConfig) continue;

        // Calculate axis value based on whether it's a continuum pair
        let axisValue: number;
        if (axisConfig.negative !== undefined && axisConfig.positive !== undefined) {
          const negValue = this.auValues[axisConfig.negative] ?? 0;
          const posValue = this.auValues[axisConfig.positive] ?? 0;
          axisValue = posValue - negValue;
        } else if (axisConfig.aus.length > 1) {
          axisValue = Math.max(...axisConfig.aus.map((auId: number) => this.auValues[auId] ?? 0));
        } else {
          axisValue = target;
        }

        handles.push(this.transitionBoneRotation(nodeKey, compositeInfo.axis, axisValue, durationMs));
      }
    }

    // Handle translations
    for (const binding of bindings) {
      if (binding.channel === 'tx' || binding.channel === 'ty' || binding.channel === 'tz') {
        if (binding.maxUnits !== undefined) {
          handles.push(this.transitionBoneTranslation(binding.node, binding.channel, target * binding.scale, binding.maxUnits, durationMs));
        }
      }
    }

    return this.combineHandles(handles);
  }

  getAU(id: number): number {
    return this.auValues[id] ?? 0;
  }

  // ============================================================================
  // CONTINUUM CONTROL (for paired AUs like eyes left/right, head up/down)
  // ============================================================================

  /**
   * Set a continuum AU pair immediately (no animation).
   *
   * Sign convention:
   * - Negative value (-1 to 0): activates negAU (e.g., head left, eyes left)
   * - Positive value (0 to +1): activates posAU (e.g., head right, eyes right)
   *
   * @param negAU - AU ID for negative direction (e.g., 61 for eyes left)
   * @param posAU - AU ID for positive direction (e.g., 62 for eyes right)
   * @param continuumValue - Value from -1 (full negative) to +1 (full positive)
   */
  setContinuum(negAU: number, posAU: number, continuumValue: number): void {
    const value = Math.max(-1, Math.min(1, continuumValue));

    // Negative value = activate negAU, zero posAU
    // Positive value = activate posAU, zero negAU
    const negVal = value < 0 ? Math.abs(value) : 0;
    const posVal = value > 0 ? value : 0;

    this.setAU(negAU, negVal);
    this.setAU(posAU, posVal);
  }

  /**
   * Smoothly transition a continuum AU pair (e.g., eyes left/right, head up/down).
   * Takes a continuum value from -1 to +1 and internally manages both AU values.
   *
   * @param negAU - AU ID for negative direction (e.g., 61 for eyes left)
   * @param posAU - AU ID for positive direction (e.g., 62 for eyes right)
   * @param continuumValue - Target value from -1 (full negative) to +1 (full positive)
   * @param durationMs - Transition duration in milliseconds
   */
  transitionContinuum(negAU: number, posAU: number, continuumValue: number, durationMs = 200): TransitionHandle {
    const target = Math.max(-1, Math.min(1, continuumValue));
    const driverKey = `continuum_${negAU}_${posAU}`;

    // Get current continuum value: positive if posAU active, negative if negAU active
    const currentNeg = this.auValues[negAU] ?? 0;
    const currentPos = this.auValues[posAU] ?? 0;
    const currentContinuum = currentPos - currentNeg;

    return this.animation.addTransition(driverKey, currentContinuum, target, durationMs, (value) => this.setContinuum(negAU, posAU, value));
  }

  // ============================================================================
  // MORPH CONTROL
  // ============================================================================

  /**
   * Set a morph target value.
   *
   * Fast paths (in order of speed):
   * 1. Pass pre-resolved { infl, idx } array directly - zero lookups
   * 2. String key with cache hit - one Map lookup
   * 3. String key cache miss - dictionary lookup, then cached for next time
   */
  setMorph(key: string, v: number, meshNames?: string[]): void;
  setMorph(key: string, v: number, targets: { infl: number[]; idx: number }[]): void;
  setMorph(key: string, v: number, meshNamesOrTargets?: string[] | { infl: number[]; idx: number }[]): void {
    const val = clamp01(v);

    // Fast path: pre-resolved targets array (from transitionMorph)
    if (Array.isArray(meshNamesOrTargets) && meshNamesOrTargets.length > 0 && typeof meshNamesOrTargets[0] === 'object' && 'infl' in meshNamesOrTargets[0]) {
      const targets = meshNamesOrTargets as { infl: number[]; idx: number }[];
      for (const target of targets) {
        target.infl[target.idx] = val;
      }
      return;
    }

    const meshNames = meshNamesOrTargets as string[] | undefined;
    const targetMeshes = meshNames || this.config.morphToMesh?.face || [];

    // Fast path: cache hit
    const cached = this.morphCache.get(key);
    if (cached) {
      for (const target of cached) {
        target.infl[target.idx] = val;
      }
      return;
    }

    // Slow path: resolve and cache
    const targets: { infl: number[]; idx: number }[] = [];

    if (targetMeshes.length) {
      for (const name of targetMeshes) {
        const mesh = this.meshByName.get(name);
        if (!mesh) continue;
        const dict = mesh.morphTargetDictionary;
        const infl = mesh.morphTargetInfluences;
        if (!dict || !infl) continue;
        const idx = dict[key];
        if (idx !== undefined) {
          targets.push({ infl, idx });
          infl[idx] = val;
        }
      }
    } else {
      for (const mesh of this.meshes) {
        const dict = mesh.morphTargetDictionary;
        const infl = mesh.morphTargetInfluences;
        if (!dict || !infl) continue;
        const idx = dict[key];
        if (idx !== undefined) {
          targets.push({ infl, idx });
          infl[idx] = val;
        }
      }
    }

    if (targets.length > 0) {
      this.morphCache.set(key, targets);
    }
  }

  /**
   * Resolve morph key to direct targets for ultra-fast repeated access.
   * Use this when you need to set the same morph many times (e.g., in animation loops).
   */
  resolveMorphTargets(key: string, meshNames?: string[]): { infl: number[]; idx: number }[] {
    // Cache key includes mesh names to avoid conflicts between face and hair morphs
    const targetMeshes = meshNames || this.config.morphToMesh?.face || [];
    const cacheKey = meshNames?.length ? `${key}@${meshNames.join(',')}` : key;

    // Check cache first
    const cached = this.morphCache.get(cacheKey);
    if (cached) return cached;

    // Resolve and cache
    const targets: { infl: number[]; idx: number }[] = [];

    if (targetMeshes.length) {
      for (const name of targetMeshes) {
        const mesh = this.meshByName.get(name);
        if (!mesh) continue;
        const dict = mesh.morphTargetDictionary;
        const infl = mesh.morphTargetInfluences;
        if (!dict || !infl) continue;
        const idx = dict[key];
        if (idx !== undefined) {
          targets.push({ infl, idx });
        }
      }
    } else {
      for (const mesh of this.meshes) {
        const dict = mesh.morphTargetDictionary;
        const infl = mesh.morphTargetInfluences;
        if (!dict || !infl) continue;
        const idx = dict[key];
        if (idx !== undefined) {
          targets.push({ infl, idx });
        }
      }
    }

    if (targets.length > 0) {
      this.morphCache.set(cacheKey, targets);
    }
    return targets;
  }

  transitionMorph(key: string, to: number, durationMs = 120, meshNames?: string[]): TransitionHandle {
    const transitionKey = meshNames?.length ? `morph_${key}@${meshNames.join(',')}` : `morph_${key}`;
    const target = clamp01(to);

    // Pre-resolve targets once, then use direct access during animation
    const targets = this.resolveMorphTargets(key, meshNames);

    // Get "from" value from the resolved targets (more accurate for hair meshes)
    const from = targets.length > 0 ? (targets[0].infl[targets[0].idx] ?? 0) : this.getMorphValue(key);

    return this.animation.addTransition(transitionKey, from, target, durationMs, (value) => {
      // Ultra-fast path: direct array access, no lookups
      const val = clamp01(value);
      for (const t of targets) {
        t.infl[t.idx] = val;
      }
    });
  }

  // ============================================================================
  // VISEME CONTROL
  // ============================================================================

  setViseme(visemeIndex: number, value: number, jawScale = 1.0): void {
    if (visemeIndex < 0 || visemeIndex >= this.config.visemeKeys.length) return;

    const val = clamp01(value);
    this.visemeValues[visemeIndex] = val;

    const morphKey = this.config.visemeKeys[visemeIndex];
    this.setMorph(morphKey, val);

    const jawAmount = LoomLargeThree.VISEME_JAW_AMOUNTS[visemeIndex] * val * jawScale;
    if (Math.abs(jawScale) > 1e-6 && Math.abs(jawAmount) > 1e-6) {
      this.updateBoneRotation('JAW', 'pitch', jawAmount);
    }
  }

  transitionViseme(visemeIndex: number, to: number, durationMs = 80, jawScale = 1.0): TransitionHandle {
    if (visemeIndex < 0 || visemeIndex >= this.config.visemeKeys.length) {
      return { promise: Promise.resolve(), pause: () => {}, resume: () => {}, cancel: () => {} };
    }

    const morphKey = this.config.visemeKeys[visemeIndex];
    const target = clamp01(to);
    this.visemeValues[visemeIndex] = target;

    const morphHandle = this.transitionMorph(morphKey, target, durationMs);

    const jawAmount = LoomLargeThree.VISEME_JAW_AMOUNTS[visemeIndex] * target * jawScale;
    if (Math.abs(jawScale) <= 1e-6 || Math.abs(jawAmount) <= 1e-6) {
      return morphHandle;
    }

    const jawHandle = this.transitionBoneRotation('JAW', 'pitch', jawAmount, durationMs);
    return this.combineHandles([morphHandle, jawHandle]);
  }

  // ============================================================================
  // MIX WEIGHT CONTROL
  // ============================================================================

  setAUMixWeight(id: number, weight: number): void {
    this.mixWeights[id] = clamp01(weight);
    const v = this.auValues[id] ?? 0;
    if (v > 0) this.setAU(id, v);

    const boneBindings = this.config.auToBones[id];
    if (boneBindings) {
      for (const binding of boneBindings) {
        this.pendingCompositeNodes.add(binding.node);
      }
    }
  }

  getAUMixWeight(id: number): number {
    return this.mixWeights[id] ?? this.config.auMixDefaults?.[id] ?? 1.0;
  }

  // ============================================================================
  // PLAYBACK CONTROL
  // ============================================================================

  pause(): void { this.isPaused = true; }
  resume(): void { this.isPaused = false; }
  getPaused(): boolean { return this.isPaused; }
  clearTransitions(): void { this.animation.clearTransitions(); }
  getActiveTransitionCount(): number { return this.animation.getActiveTransitionCount(); }

  resetToNeutral(): void {
    this.auValues = {};
    this.initBoneRotations();
    this.clearTransitions();

    for (const m of this.meshes) {
      const infl = m.morphTargetInfluences;
      if (!infl) continue;
      for (let i = 0; i < infl.length; i++) {
        infl[i] = 0;
      }
    }

    Object.values(this.bones).forEach((entry) => {
      if (!entry) return;
      entry.obj.position.copy(entry.basePos as any);
      entry.obj.quaternion.copy(entry.baseQuat);
    });
  }

  // ============================================================================
  // MESH CONTROL
  // ============================================================================

  getMeshList(): MeshInfo[] {
    if (!this.model) return [];
    const result: MeshInfo[] = [];
    this.model.traverse((obj: any) => {
      if (obj.isMesh) {
        const meshInfo = CC4_MESHES[obj.name];
        result.push({
          name: obj.name,
          visible: obj.visible,
          morphCount: obj.morphTargetInfluences?.length || 0,
          category: meshInfo?.category || 'other',
        });
      }
    });
    return result;
  }

  /** Get all morph targets grouped by mesh name */
  getMorphTargets(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const mesh of this.meshes) {
      const dict = mesh.morphTargetDictionary;
      if (dict) {
        result[mesh.name] = Object.keys(dict).sort();
      }
    }
    return result;
  }

  /** Get all resolved bone names and their current transforms */
  getBones(): Record<string, { position: [number, number, number]; rotation: [number, number, number] }> {
    const result: Record<string, { position: [number, number, number]; rotation: [number, number, number] }> = {};
    for (const name of Object.keys(this.bones)) {
      const entry = this.bones[name];
      if (entry) {
        const pos = entry.obj.position;
        const rot = entry.obj.rotation;
        result[name] = {
          position: [pos.x, pos.y, pos.z],
          rotation: [rot.x * 180 / Math.PI, rot.y * 180 / Math.PI, rot.z * 180 / Math.PI],
        };
      }
    }
    return result;
  }

  setMeshVisible(meshName: string, visible: boolean): void {
    if (!this.model) return;
    this.model.traverse((obj: any) => {
      if (obj.isMesh && obj.name === meshName) {
        obj.visible = visible;
      }
    });
  }

  /** Blending mode options for Three.js materials */
  private static readonly BLENDING_MODES: Record<string, number> = {
    'Normal': 1,      // THREE.NormalBlending
    'Additive': 2,    // THREE.AdditiveBlending
    'Subtractive': 3, // THREE.SubtractiveBlending
    'Multiply': 4,    // THREE.MultiplyBlending
    'None': 0,        // THREE.NoBlending
  };

  /** Get material config for a mesh */
  getMeshMaterialConfig(meshName: string): {
    renderOrder: number;
    transparent: boolean;
    opacity: number;
    depthWrite: boolean;
    depthTest: boolean;
    blending: string;
  } | null {
    if (!this.model) return null;
    let result: ReturnType<LoomLargeThree['getMeshMaterialConfig']> = null;

    this.model.traverse((obj: any) => {
      if (obj.isMesh && obj.name === meshName) {
        const mat = obj.material;
        if (mat) {
          // Reverse lookup blending mode name
          let blendingName = 'Normal';
          for (const [name, value] of Object.entries(LoomLargeThree.BLENDING_MODES)) {
            if (mat.blending === value) {
              blendingName = name;
              break;
            }
          }
          result = {
            renderOrder: obj.renderOrder,
            transparent: mat.transparent,
            opacity: mat.opacity,
            depthWrite: mat.depthWrite,
            depthTest: mat.depthTest,
            blending: blendingName,
          };
        }
      }
    });

    return result;
  }

  /** Set material config for a mesh */
  setMeshMaterialConfig(meshName: string, config: {
    renderOrder?: number;
    transparent?: boolean;
    opacity?: number;
    depthWrite?: boolean;
    depthTest?: boolean;
    blending?: string;
  }): void {
    if (!this.model) return;

    this.model.traverse((obj: any) => {
      if (obj.isMesh && obj.name === meshName) {
        const mat = obj.material;

        if (config.renderOrder !== undefined) {
          obj.renderOrder = config.renderOrder;
        }

        if (mat) {
          // Handle transparency - auto-enable when opacity < 1
          if (config.opacity !== undefined) {
            mat.opacity = config.opacity;
            // Auto-enable transparency when opacity is reduced
            if (config.opacity < 1 && config.transparent === undefined) {
              mat.transparent = true;
            }
          }
          if (config.transparent !== undefined) {
            mat.transparent = config.transparent;
          }
          if (config.depthWrite !== undefined) {
            mat.depthWrite = config.depthWrite;
          }
          if (config.depthTest !== undefined) {
            mat.depthTest = config.depthTest;
          }
          if (config.blending !== undefined) {
            const blendValue = LoomLargeThree.BLENDING_MODES[config.blending];
            if (blendValue !== undefined) {
              mat.blending = blendValue;
            }
          }
          // Always mark material as needing update after any change
          mat.needsUpdate = true;
        }
      }
    });
  }

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  setAUMappings(mappings: AUMappingConfig): void {
    this.config = mappings;
    this.mixWeights = { ...mappings.auMixDefaults };
  }

  getAUMappings(): AUMappingConfig { return this.config; }

  // ============================================================================
  // HAIR PHYSICS
  // ============================================================================

  /**
   * Register hair objects for physics simulation.
   * Call this after loading the model with objects that should respond to physics.
   * Returns metadata about registered objects for service layer use.
   */
  registerHairObjects(objects: LoomObject3D[]): Array<{ name: string; isMesh: boolean; isEyebrow: boolean }> {
    this.registeredHairObjects.clear();
    this.cachedHairMeshNames = null;

    const result: Array<{ name: string; isMesh: boolean; isEyebrow: boolean }> = [];

    for (const obj of objects) {
      if ((obj as any).isMesh) {
        const mesh = obj as unknown as LoomMesh;
        this.registeredHairObjects.set(mesh.name, mesh);

        const meshInfo = CC4_MESHES[mesh.name];
        const isEyebrow = meshInfo?.category === 'eyebrow';

        result.push({
          name: mesh.name,
          isMesh: true,
          isEyebrow,
        });
      }
    }

    return result;
  }

  /** Get registered hair objects (for service layer) */
  getRegisteredHairObjects(): LoomMesh[] {
    return Array.from(this.registeredHairObjects.values());
  }

  /** Enable or disable hair physics simulation */
  setHairPhysicsEnabled(enabled: boolean): void {
    this.hairPhysicsEnabled = enabled;
    if (!enabled) {
      // Reset hair morphs to neutral
      // Note: L_ prefix = "Long section", not "Left side"
      const duration = 200;
      const hairMeshNames = this.getHairMeshNames();
      this.transitionMorph('L_Hair_Left', 0, duration, hairMeshNames);
      this.transitionMorph('L_Hair_Right', 0, duration, hairMeshNames);
      this.transitionMorph('L_Hair_Front', 0, duration, hairMeshNames);
      this.transitionMorph('Fluffy_Right', 0, duration, hairMeshNames);
      this.transitionMorph('Fluffy_Bottom_ALL', 0, duration, hairMeshNames);
    }
  }

  /** Check if hair physics is enabled */
  isHairPhysicsEnabled(): boolean {
    return this.hairPhysicsEnabled;
  }

  /** Update hair physics configuration */
  setHairPhysicsConfig(config: Partial<typeof this.hairPhysicsConfig>): void {
    this.hairPhysicsConfig = { ...this.hairPhysicsConfig, ...config };
  }

  /** Get current hair physics config */
  getHairPhysicsConfig(): typeof this.hairPhysicsConfig {
    return { ...this.hairPhysicsConfig };
  }

  /** Get head rotation values for hair physics (range -1 to 1) */
  getHeadRotation(): { yaw: number; pitch: number; roll: number } {
    return {
      yaw: this.rotations.HEAD?.yaw ?? 0,
      pitch: this.rotations.HEAD?.pitch ?? 0,
      roll: this.rotations.HEAD?.roll ?? 0,
    };
  }

  /** Get hair mesh names (excludes eyebrows) */
  private getHairMeshNames(): string[] {
    if (this.cachedHairMeshNames) return this.cachedHairMeshNames;

    const names: string[] = [];
    this.registeredHairObjects.forEach((mesh, name) => {
      const info = CC4_MESHES[name];
      // Check CC4_MESHES category first
      if (info?.category === 'hair') {
        names.push(name);
      }
      // For pattern-detected hair, check if it has hair morph targets
      else if (info?.category !== 'eyebrow') {
        const dict = mesh.morphTargetDictionary;
        if (dict && ('L_Hair_Left' in dict || 'L_Hair_Right' in dict || 'L_Hair_Front' in dict)) {
          names.push(name);
        }
      }
    });
    this.cachedHairMeshNames = names;
    return names;
  }

  /**
   * Lightweight per-frame update for wind and idle sway.
   * Only runs when wind or idle is enabled. Called automatically in update().
   */
  private updateHairWindIdle(dt: number): void {
    if (!this.hairPhysicsEnabled) return;
    if (this.registeredHairObjects.size === 0) return;

    const cfg = this.hairPhysicsConfig;
    const st = this.hairWindIdleState;

    // Skip if neither wind nor idle is active
    const hasWind = cfg.windStrength > 0;
    const hasIdle = cfg.idleSwayAmount > 0;
    if (!hasWind && !hasIdle) return;

    // Update time-based state
    st.idlePhase += dt * cfg.idleSwaySpeed;
    st.windTime += dt;

    // Calculate wind contribution
    let windOffset = 0;
    if (hasWind) {
      const primaryWave = Math.sin(st.windTime * cfg.windFrequency);
      const secondaryWave = Math.sin(st.windTime * cfg.windFrequency * 1.7) * 0.3;
      const waveStrength = primaryWave + secondaryWave;

      const targetWind = cfg.windDirectionX * waveStrength * cfg.windStrength * 0.1;
      const smoothFactor = 1 - Math.exp(-dt * 8);
      st.smoothedWindX += (targetWind - st.smoothedWindX) * smoothFactor;
      windOffset = st.smoothedWindX;
    }

    // Calculate idle sway contribution
    let idleOffset = 0;
    if (hasIdle) {
      idleOffset = Math.sin(st.idlePhase * Math.PI * 2) * cfg.idleSwayAmount;
    }

    // Apply wind/idle offset to hair morphs
    const hairMeshNames = this.getHairMeshNames();
    if (hairMeshNames.length === 0) return;

    const duration = 50;

    // Map offset to left/right morphs (L_ = Long section, not Left side)
    const combinedOffset = idleOffset + windOffset;
    const leftValue = clamp01(combinedOffset > 0 ? combinedOffset : 0);
    const rightValue = clamp01(combinedOffset < 0 ? -combinedOffset : 0);
    const fluffyRightValue = clamp01(rightValue * 0.7);
    const fluffyBottomValue = clamp01(Math.abs(combinedOffset) * 0.25);

    // Only apply if there's meaningful movement
    if (Math.abs(combinedOffset) > 0.001) {
      this.transitionMorph('L_Hair_Left', leftValue, duration, hairMeshNames);
      this.transitionMorph('L_Hair_Right', rightValue, duration, hairMeshNames);
      this.transitionMorph('Fluffy_Right', fluffyRightValue, duration, hairMeshNames);
      this.transitionMorph('Fluffy_Bottom_ALL', fluffyBottomValue, duration, hairMeshNames);
    }
  }

  /**
   * Update hair morphs in response to head rotation changes.
   * Called automatically when HEAD bone changes.
   * Note: This runs regardless of hairPhysicsEnabled - head-driven hair motion
   * is a basic feature. Only wind/idle sway is gated by hairPhysicsEnabled.
   */
  private updateHairForHeadChange(): void {
    // Only check for registered hair objects - NOT hairPhysicsEnabled
    // Head-driven motion should always work when hair is registered
    if (this.registeredHairObjects.size === 0) return;

    const cfg = this.hairPhysicsConfig;
    const headYaw = this.rotations.HEAD?.yaw ?? 0;
    const headPitch = this.rotations.HEAD?.pitch ?? 0;

    // Calculate hair offset based on head position
    // Hair swings opposite to head rotation (inertia effect)
    const horizontal = -headYaw * cfg.inertia * cfg.responseScale;
    const vertical = headPitch * cfg.gravity * 0.1 * cfg.responseScale;

    // Map to morph targets (L_ = Long section, not Left side)
    const leftValue = clamp01(horizontal > 0 ? horizontal : 0);
    const rightValue = clamp01(horizontal < 0 ? -horizontal : 0);
    const frontValue = clamp01(vertical * 0.5);
    const fluffyRightValue = clamp01(rightValue * 0.7);
    const movementIntensity = Math.abs(horizontal) + Math.abs(vertical);
    const fluffyBottomValue = clamp01(movementIntensity * 0.25);

    // Schedule transitions for each hair morph
    const hairMeshNames = this.getHairMeshNames();
    if (hairMeshNames.length === 0) return;

    const duration = 150; // ms - short for responsive feel

    // Hair morphs (L_ prefix = "Long section" of hair)
    this.transitionMorph('L_Hair_Left', leftValue, duration, hairMeshNames);
    this.transitionMorph('L_Hair_Right', rightValue, duration, hairMeshNames);
    this.transitionMorph('L_Hair_Front', frontValue, duration, hairMeshNames);
    // Fluffy morphs
    this.transitionMorph('Fluffy_Right', fluffyRightValue, duration, hairMeshNames);
    this.transitionMorph('Fluffy_Bottom_ALL', fluffyBottomValue, duration, hairMeshNames);
  }

  /**
   * Update hair physics for wind and idle sway.
   * @deprecated Use the internal update() loop instead - physics now runs automatically.
   */
  updateHairPhysics(dt: number): void {
    this.updateHairWindIdle(dt);
  }

  /**
   * Get available hair morph targets from registered hair meshes.
   */
  getHairMorphTargets(meshName?: string): string[] {
    let targetMesh: LoomMesh | undefined;

    if (meshName) {
      targetMesh = this.registeredHairObjects.get(meshName);
    } else {
      // Get first non-eyebrow hair mesh
      for (const [name, mesh] of this.registeredHairObjects) {
        const info = CC4_MESHES[name];
        if (info?.category === 'hair') {
          targetMesh = mesh;
          break;
        }
      }
    }

    if (!targetMesh) return [];

    const dict = targetMesh.morphTargetDictionary;
    if (!dict) return [];

    return Object.keys(dict);
  }

  /**
   * Set morph on specific meshes (for hair physics).
   */
  setMorphOnMeshes(meshNames: string[], morphKey: string, value: number): void {
    const val = clamp01(value);
    for (const name of meshNames) {
      const mesh = this.registeredHairObjects.get(name) || this.meshByName.get(name);
      if (!mesh) continue;

      const dict = mesh.morphTargetDictionary;
      const infl = mesh.morphTargetInfluences;
      if (!dict || !infl) continue;

      const idx = dict[morphKey];
      if (idx !== undefined) {
        infl[idx] = val;
      }
    }
  }

  /**
   * Apply hair state from HairService.
   * Used by HairService to update hair appearance (color, outline, etc.)
   */
  applyHairStateToObject(objectName: string, state: {
    color?: { baseColor: string; emissive: string; emissiveIntensity: number };
    outline?: { show: boolean; color: string; opacity: number };
    visible?: boolean;
    scale?: { x: number; y: number; z: number };
    position?: { x: number; y: number; z: number };
    isEyebrow?: boolean;
  }): void {
    const mesh = this.registeredHairObjects.get(objectName);
    if (!mesh) return;

    const obj = mesh as any;

    // Set visibility
    if (state.visible !== undefined) {
      obj.visible = state.visible;
    }

    // Set scale
    if (state.scale) {
      obj.scale.set(state.scale.x, state.scale.y, state.scale.z);
    }

    // Set position offset
    if (state.position) {
      obj.position.set(state.position.x, state.position.y, state.position.z);
    }

    // Set material colors
    if (state.color && obj.material) {
      const mat = obj.material;
      if (mat.color) {
        mat.color.set(state.color.baseColor);
      }
      if (mat.emissive !== undefined) {
        mat.emissive.set(state.color.emissive);
        mat.emissiveIntensity = state.color.emissiveIntensity;
      }
      mat.needsUpdate = true;
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private computeSideValues(base: number, balance?: number): { left: number; right: number } {
    const b = Math.max(-1, Math.min(1, balance ?? 0));
    if (b === 0) return { left: base, right: base };
    if (b < 0) return { left: base, right: base * (1 + b) };
    return { left: base * (1 - b), right: base };
  }

  private getMeshNamesForAU(auId: number): string[] {
    const info = this.config.auInfo?.[String(auId)];
    if (!info?.facePart) return this.config.morphToMesh?.face || [];
    switch (info.facePart) {
      case 'Tongue': return this.config.morphToMesh?.tongue || [];
      case 'Eye': return this.config.morphToMesh?.eye || [];
      default: return this.config.morphToMesh?.face || [];
    }
  }

  private getMorphValue(key: string): number {
    if (this.faceMesh) {
      const dict = this.faceMesh.morphTargetDictionary;
      const infl = this.faceMesh.morphTargetInfluences;
      if (dict && infl) {
        const idx = dict[key];
        if (idx !== undefined) return infl[idx] ?? 0;
      }
      return 0;
    }
    for (const mesh of this.meshes) {
      const dict = mesh.morphTargetDictionary;
      const infl = mesh.morphTargetInfluences;
      if (!dict || !infl) continue;
      const idx = dict[key];
      if (idx !== undefined) return infl[idx] ?? 0;
    }
    return 0;
  }

  private isMixedAU(id: number): boolean {
    return !!(this.config.auToMorphs[id]?.length && this.config.auToBones[id]?.length);
  }

  private initBoneRotations(): void {
    this.rotations = {};
    this.pendingCompositeNodes.clear();

    const allBoneKeys = Array.from(
      new Set(Object.values(this.config.auToBones).flat().map((binding) => binding.node))
    );

    for (const node of allBoneKeys) {
      this.rotations[node] = { pitch: 0, yaw: 0, roll: 0 };
      this.pendingCompositeNodes.add(node);
    }
  }

  /** Update rotation state - just stores -1 to 1 value like stable version */
  private updateBoneRotation(nodeKey: string, axis: 'pitch' | 'yaw' | 'roll', value: number): void {
    if (!this.rotations[nodeKey]) return;
    this.rotations[nodeKey][axis] = Math.max(-1, Math.min(1, value));
    this.pendingCompositeNodes.add(nodeKey);
  }

  private updateBoneTranslation(nodeKey: string, channel: 'tx' | 'ty' | 'tz', value: number, maxUnits: number): void {
    if (!this.translations[nodeKey]) this.translations[nodeKey] = { x: 0, y: 0, z: 0 };
    const clamped = Math.max(-1, Math.min(1, value));
    const offset = clamped * maxUnits;
    if (channel === 'tx') this.translations[nodeKey].x = offset;
    else if (channel === 'ty') this.translations[nodeKey].y = offset;
    else this.translations[nodeKey].z = offset;
    this.pendingCompositeNodes.add(nodeKey);
  }

  private transitionBoneRotation(nodeKey: string, axis: 'pitch' | 'yaw' | 'roll', to: number, durationMs = 200): TransitionHandle {
    const transitionKey = `bone_${nodeKey}_${axis}`;
    const from = this.rotations[nodeKey]?.[axis] ?? 0;
    const target = Math.max(-1, Math.min(1, to));
    return this.animation.addTransition(transitionKey, from, target, durationMs, (value) => this.updateBoneRotation(nodeKey, axis, value));
  }

  private transitionBoneTranslation(nodeKey: string, channel: 'tx' | 'ty' | 'tz', to: number, maxUnits: number, durationMs = 200): TransitionHandle {
    const transitionKey = `boneT_${nodeKey}_${channel}`;
    const current = this.translations[nodeKey] || { x: 0, y: 0, z: 0 };
    const currentOffset = channel === 'tx' ? current.x : channel === 'ty' ? current.y : current.z;
    const from = maxUnits !== 0 ? Math.max(-1, Math.min(1, currentOffset / maxUnits)) : 0;
    const target = Math.max(-1, Math.min(1, to));
    return this.animation.addTransition(transitionKey, from, target, durationMs, (value) => this.updateBoneTranslation(nodeKey, channel, value, maxUnits));
  }

  private flushPendingComposites(): void {
    if (this.pendingCompositeNodes.size === 0) return;

    // Check if HEAD changed - triggers hair physics update
    const headChanged = this.pendingCompositeNodes.has('HEAD');

    for (const nodeKey of this.pendingCompositeNodes) {
      this.applyCompositeRotation(nodeKey as BoneKey);
    }
    this.pendingCompositeNodes.clear();

    // Update hair when head rotation changes
    if (headChanged && this.hairPhysicsEnabled) {
      this.updateHairForHeadChange();
    }
  }

  /**
   * Apply composite rotation using quaternion composition like stable version.
   * Looks up maxDegrees and channel from BONE_AU_TO_BINDINGS.
   */
  private applyCompositeRotation(nodeKey: BoneKey): void {
    const entry = this.bones[nodeKey];
    if (!entry || !this.model) {
      if (!entry && this.rigReady && !this.missingBoneWarnings.has(nodeKey)) {
        this.missingBoneWarnings.add(nodeKey);
      }
      return;
    }

    const { obj, basePos, baseQuat } = entry;
    const rotState = this.rotations[nodeKey];
    if (!rotState) return;

    // Find the composite rotation config for this node
    const config = this.compositeRotations.find((c: CompositeRotation) => c.node === nodeKey);
    if (!config) return;

    // Helper to get binding from the correct AU for an axis based on direction
    const getBindingForAxis = (
      axisConfig: typeof config.pitch | typeof config.yaw | typeof config.roll,
      direction: number
    ) => {
      if (!axisConfig) return null;

      // For continuum pairs, select the AU based on direction
      if (axisConfig.negative !== undefined && axisConfig.positive !== undefined) {
        const auId = direction < 0 ? axisConfig.negative : axisConfig.positive;
        return this.config.auToBones[auId]?.find((b: BoneBinding) => b.node === nodeKey);
      }

      // If multiple AUs, find which one is active (has highest value)
      if (axisConfig.aus.length > 1) {
        let maxAU = axisConfig.aus[0];
        let maxValue = this.auValues[maxAU] ?? 0;
        for (const auId of axisConfig.aus) {
          const val = this.auValues[auId] ?? 0;
          if (val > maxValue) {
            maxValue = val;
            maxAU = auId;
          }
        }
        return this.config.auToBones[maxAU]?.find((b: BoneBinding) => b.node === nodeKey);
      }

      // Single AU
      return this.config.auToBones[axisConfig.aus[0]]?.find((b: BoneBinding) => b.node === nodeKey);
    };

    // Helper to get Vector3 axis from channel
    const getAxis = (channel: 'rx' | 'ry' | 'rz') =>
      channel === 'rx' ? X_AXIS : channel === 'ry' ? Y_AXIS : Z_AXIS;

    // Build composite quaternion from base
    const compositeQ = new Quaternion().copy(baseQuat);

    // Apply yaw rotation
    if (config.yaw && rotState.yaw !== 0) {
      const binding = getBindingForAxis(config.yaw, rotState.yaw);
      if (binding?.maxDegrees && binding.channel) {
        const radians = deg2rad(binding.maxDegrees) * Math.abs(rotState.yaw) * binding.scale;
        const axis = getAxis(binding.channel as 'rx' | 'ry' | 'rz');
        const deltaQ = new Quaternion().setFromAxisAngle(axis, radians);
        compositeQ.multiply(deltaQ);
      }
    }

    // Apply pitch rotation
    if (config.pitch && rotState.pitch !== 0) {
      const binding = getBindingForAxis(config.pitch, rotState.pitch);
      if (binding?.maxDegrees && binding.channel) {
        const radians = deg2rad(binding.maxDegrees) * Math.abs(rotState.pitch) * binding.scale;
        const axis = getAxis(binding.channel as 'rx' | 'ry' | 'rz');
        const deltaQ = new Quaternion().setFromAxisAngle(axis, radians);
        compositeQ.multiply(deltaQ);
      }
    }

    // Apply roll rotation
    if (config.roll && rotState.roll !== 0) {
      const binding = getBindingForAxis(config.roll, rotState.roll);
      if (binding?.maxDegrees && binding.channel) {
        const radians = deg2rad(binding.maxDegrees) * Math.abs(rotState.roll) * binding.scale;
        const axis = getAxis(binding.channel as 'rx' | 'ry' | 'rz');
        const deltaQ = new Quaternion().setFromAxisAngle(axis, radians);
        compositeQ.multiply(deltaQ);
      }
    }

    // Apply position
    obj.position.copy(basePos as any);
    const t = this.translations[nodeKey];
    if (t) {
      obj.position.x += t.x;
      obj.position.y += t.y;
      obj.position.z += t.z;
    }

    // Apply composite quaternion rotation
    (obj.quaternion as any).copy(compositeQ);
    obj.updateMatrixWorld(false);
    this.model.updateMatrixWorld(true);
  }

  private resolveBones(root: LoomObject3D): ResolvedBones {
    const resolved: ResolvedBones = {};

    const snapshot = (obj: any): NodeBase => ({
      obj,
      basePos: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
      baseQuat: obj.quaternion.clone(),
      baseEuler: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z, order: obj.rotation.order },
    });

    const findNode = (name?: string | null): LoomObject3D | undefined => {
      if (!name) return undefined;
      return root.getObjectByName(name);
    };

    for (const [key, nodeName] of Object.entries(this.config.boneNodes)) {
      const node = findNode(nodeName);
      if (node) resolved[key] = snapshot(node);
    }

    if (!resolved.EYE_L && this.config.eyeMeshNodes) {
      const node = findNode(this.config.eyeMeshNodes.LEFT);
      if (node) resolved.EYE_L = snapshot(node);
    }
    if (!resolved.EYE_R && this.config.eyeMeshNodes) {
      const node = findNode(this.config.eyeMeshNodes.RIGHT);
      if (node) resolved.EYE_R = snapshot(node);
    }

    return resolved;
  }

  private combineHandles(handles: TransitionHandle[]): TransitionHandle {
    if (handles.length === 0) return { promise: Promise.resolve(), pause: () => {}, resume: () => {}, cancel: () => {} };
    if (handles.length === 1) return handles[0];
    return {
      promise: Promise.all(handles.map((h) => h.promise)).then(() => {}),
      pause: () => handles.forEach((h) => h.pause()),
      resume: () => handles.forEach((h) => h.resume()),
      cancel: () => handles.forEach((h) => h.cancel()),
    };
  }

  /**
   * Apply render order and material settings from CC4_MESHES to all meshes.
   * This ensures proper layering (e.g., hair renders on top of eyebrows).
   * Also auto-registers hair and eyebrow meshes for hair physics.
   */
  private applyMeshMaterialSettings(root: LoomObject3D): void {
    // Clear and rebuild hair object registry
    this.registeredHairObjects.clear();
    this.cachedHairMeshNames = null;

    root.traverse((obj: any) => {
      if (!obj.isMesh || !obj.name) return;

      const meshInfo = CC4_MESHES[obj.name];
      let category = meshInfo?.category;

      // Pattern-based detection for meshes not in CC4_MESHES
      // This allows any CC4 character to be detected automatically
      if (!category) {
        const lowerName = obj.name.toLowerCase();
        // Body patterns: CC_Base_Body, body mesh, etc.
        if (lowerName.includes('body') || lowerName.includes('cc_base_body')) {
          category = 'body';
        }
        // Eyebrow patterns: contains 'brow', 'eyebrow', etc.
        else if (lowerName.includes('brow') || lowerName.includes('eyebrow')) {
          category = 'eyebrow';
        }
        // Hair patterns: meshes that end with _1, _2 and have hair-like morph targets
        // or mesh names that suggest hair (wavy, curly, straight, short, long, etc.)
        else if (
          lowerName.includes('hair') ||
          lowerName.includes('wavy') ||
          lowerName.includes('curly') ||
          lowerName.includes('straight') ||
          lowerName.includes('ponytail') ||
          lowerName.includes('braided') ||
          lowerName.includes('afro') ||
          lowerName.includes('bob') ||
          lowerName.includes('pixie') ||
          lowerName.includes('bangs') ||
          lowerName.includes('fringe') ||
          lowerName.includes('mohawk') ||
          lowerName.includes('dreadlock') ||
          lowerName.includes('bald') === false && lowerName.includes('part_') // Side_part_wavy, etc.
        ) {
          // Check if it has hair-like morph targets (L_Hair_Left, R_Hair_Right, etc.)
          const dict = obj.morphTargetDictionary;
          if (dict && (
            'L_Hair_Left' in dict ||
            'L_Hair_Right' in dict ||
            'R_Hair_Left' in dict ||
            'R_Hair_Right' in dict ||
            'L_Hair_Front' in dict ||
            'R_Hair_Front' in dict
          )) {
            category = 'hair';
          }
        }
      }

      // Auto-register hair and eyebrow meshes for hair physics
      if (category === 'hair' || category === 'eyebrow') {
        this.registeredHairObjects.set(obj.name, obj);
        // Set render order: eyebrows=5, hair=10
        obj.renderOrder = category === 'eyebrow' ? 5 : 10;

        // Enable depth write and depth test for proper rendering
        if (obj.material) {
          obj.material.depthWrite = true;
          obj.material.depthTest = true;
          obj.material.needsUpdate = true;
        }
      }

      // Also ensure body meshes have depth write/test enabled
      if (category === 'body' && obj.material) {
        obj.material.depthWrite = true;
        obj.material.depthTest = true;
        obj.material.needsUpdate = true;
      }

      if (!meshInfo?.material) return;

      const settings = meshInfo.material;

      // Apply renderOrder to the mesh itself
      if (typeof settings.renderOrder === 'number') {
        obj.renderOrder = settings.renderOrder;
      }

      // Apply material settings if the mesh has a material
      if (obj.material) {
        if (typeof settings.transparent === 'boolean') {
          obj.material.transparent = settings.transparent;
        }
        if (typeof settings.opacity === 'number') {
          obj.material.opacity = settings.opacity;
        }
        if (typeof settings.depthWrite === 'boolean') {
          obj.material.depthWrite = settings.depthWrite;
        }
        if (typeof settings.depthTest === 'boolean') {
          obj.material.depthTest = settings.depthTest;
        }
        if (typeof settings.blending === 'string') {
          const blendValue = LoomLargeThree.BLENDING_MODES[settings.blending];
          if (blendValue !== undefined) {
            obj.material.blending = blendValue;
          }
        }
        obj.material.needsUpdate = true;
      }
    });

    // Log detected hair objects for debugging
    if (this.registeredHairObjects.size > 0) {
      console.log('[LoomLargeThree] Registered hair/eyebrow objects:', Array.from(this.registeredHairObjects.keys()));
    }
  }
}

/**
 * Helper function to collect meshes with morph targets from a scene.
 */
export function collectMorphMeshes(root: LoomObject3D): LoomMesh[] {
  const meshes: LoomMesh[] = [];
  root.traverse((obj: any) => {
    if (obj.isMesh) {
      if (Array.isArray(obj.morphTargetInfluences) && obj.morphTargetInfluences.length > 0) {
        meshes.push(obj);
      }
    }
  });
  return meshes;
}
