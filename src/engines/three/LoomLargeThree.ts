/**
 * LoomLargeThree - Three.js Implementation
 *
 * Default implementation of the LoomLarge interface for Three.js.
 * Controls 3D character facial animation using Action Units (AUs),
 * morph targets, visemes, and bone transformations.
 */

import { Clock } from 'three';
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
import { CC4_PRESET, CC4_MESHES } from '../../presets/cc4';

const deg2rad = (d: number) => (d * Math.PI) / 180;

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

  constructor(config: LoomLargeConfig = {}, animation?: Animation) {
    this.config = config.auMappings || CC4_PRESET;
    this.mixWeights = { ...this.config.auMixDefaults };
    this.animation = animation || new AnimationThree();
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

    const bindings = this.config.auToBones[id];
    if (bindings) {
      for (const binding of bindings) {
        if (binding.channel === 'rx' || binding.channel === 'ry' || binding.channel === 'rz') {
          if (binding.axis) {
            this.updateBoneRotation(binding.node, binding.axis, v * binding.scale, binding.maxDegrees ?? 0);
          }
        } else if (binding.channel === 'tx' || binding.channel === 'ty' || binding.channel === 'tz') {
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

    for (const binding of bindings) {
      if (binding.channel === 'rx' || binding.channel === 'ry' || binding.channel === 'rz') {
        if (binding.axis) {
          handles.push(this.transitionBoneRotation(binding.node, binding.axis, target * binding.scale, binding.maxDegrees ?? 0, durationMs));
        }
      } else if (binding.channel === 'tx' || binding.channel === 'ty' || binding.channel === 'tz') {
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
    // Check cache first
    const cached = this.morphCache.get(key);
    if (cached) return cached;

    // Resolve and cache
    const targetMeshes = meshNames || this.config.morphToMesh?.face || [];
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
      this.morphCache.set(key, targets);
    }
    return targets;
  }

  transitionMorph(key: string, to: number, durationMs = 120, meshNames?: string[]): TransitionHandle {
    const transitionKey = `morph_${key}`;
    const from = this.getMorphValue(key);
    const target = clamp01(to);

    // Pre-resolve targets once, then use direct access during animation
    const targets = this.resolveMorphTargets(key, meshNames);

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
      this.updateBoneRotation('JAW', 'roll', jawAmount, LoomLargeThree.JAW_MAX_DEGREES);
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

    const jawHandle = this.transitionBoneRotation('JAW', 'roll', jawAmount, LoomLargeThree.JAW_MAX_DEGREES, durationMs);
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
    const zeroAxis = { value: 0, maxRadians: 0 };
    this.rotations = {};
    this.pendingCompositeNodes.clear();

    const allBoneKeys = Array.from(
      new Set(Object.values(this.config.auToBones).flat().map((binding) => binding.node))
    );

    for (const node of allBoneKeys) {
      this.rotations[node] = { pitch: { ...zeroAxis }, yaw: { ...zeroAxis }, roll: { ...zeroAxis } };
      this.pendingCompositeNodes.add(node);
    }
  }

  private updateBoneRotation(nodeKey: string, axis: 'pitch' | 'yaw' | 'roll', value: number, maxDegrees: number): void {
    if (!this.rotations[nodeKey]) return;
    this.rotations[nodeKey][axis] = { value: Math.max(-1, Math.min(1, value)), maxRadians: deg2rad(maxDegrees) };
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

  private transitionBoneRotation(nodeKey: string, axis: 'pitch' | 'yaw' | 'roll', to: number, maxDegrees: number, durationMs = 200): TransitionHandle {
    const transitionKey = `bone_${nodeKey}_${axis}`;
    const from = this.rotations[nodeKey]?.[axis]?.value ?? 0;
    const target = Math.max(-1, Math.min(1, to));
    return this.animation.addTransition(transitionKey, from, target, durationMs, (value) => this.updateBoneRotation(nodeKey, axis, value, maxDegrees));
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
    for (const nodeKey of this.pendingCompositeNodes) {
      this.applyCompositeRotation(nodeKey as BoneKey);
    }
    this.pendingCompositeNodes.clear();
  }

  private applyCompositeRotation(nodeKey: BoneKey): void {
    const entry = this.bones[nodeKey];
    if (!entry || !this.model) {
      if (!entry && this.rigReady && !this.missingBoneWarnings.has(nodeKey)) {
        this.missingBoneWarnings.add(nodeKey);
      }
      return;
    }

    const { obj, basePos, baseEuler } = entry;
    const rotState = this.rotations[nodeKey];
    if (!rotState) return;

    const yawRad = rotState.yaw.maxRadians * rotState.yaw.value;
    const pitchRad = rotState.pitch.maxRadians * rotState.pitch.value;
    const rollRad = rotState.roll.maxRadians * rotState.roll.value;

    obj.position.copy(basePos as any);
    const t = this.translations[nodeKey];
    if (t) {
      obj.position.x += t.x;
      obj.position.y += t.y;
      obj.position.z += t.z;
    }

    obj.rotation.set(baseEuler.x + pitchRad, baseEuler.y + yawRad, baseEuler.z + rollRad, baseEuler.order);
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
   */
  private applyMeshMaterialSettings(root: LoomObject3D): void {
    root.traverse((obj: any) => {
      if (!obj.isMesh || !obj.name) return;

      const meshInfo = CC4_MESHES[obj.name];
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
