import * as THREE from 'three';
import {
  AU_TO_MORPHS,
  BONE_AU_TO_BINDINGS,
  COMPOSITE_ROTATIONS,
  AU_MIX_DEFAULTS,
  CC4_BONE_NODES,
  CC4_EYE_MESH_NODES,
  CC4_MESHES,
  CONTINUUM_PAIRS_MAP,
  type CompositeRotation,
} from './arkit/shapeDict';

// ============================================================================
// DERIVED CONSTANTS - computed from shapeDict core data
// ============================================================================

/** All AU IDs that have bone bindings */
export const BONE_DRIVEN_AUS = new Set(Object.keys(BONE_AU_TO_BINDINGS).map(Number));

/** Eye axis override for CC rigs (eyes rotate around Z for yaw) */
export const EYE_AXIS = {
  yaw: 'rz' as 'ry' | 'rz',
  pitch: 'rx' as 'rx' | 'ry' | 'rz'
};

/** AUs that have both morphs and bones - can blend between them */
export const MIXED_AUS = new Set(
  Object.keys(AU_TO_MORPHS)
    .map(Number)
    .filter(id => AU_TO_MORPHS[id]?.length && BONE_AU_TO_BINDINGS[id]?.length)
);

/** Map AU ID to which composite rotation it belongs to, and which axis */
export const AU_TO_COMPOSITE_MAP = new Map<number, {
  nodes: CompositeRotation['node'][];
  axis: 'pitch' | 'yaw' | 'roll';
}>();

// Build the reverse mapping from COMPOSITE_ROTATIONS
COMPOSITE_ROTATIONS.forEach(comp => {
  (['pitch', 'yaw', 'roll'] as const).forEach(axisName => {
    const axis = comp[axisName];
    if (axis) {
      axis.aus.forEach(auId => {
        const existing = AU_TO_COMPOSITE_MAP.get(auId);
        if (existing) {
          existing.nodes.push(comp.node);
        } else {
          AU_TO_COMPOSITE_MAP.set(auId, { nodes: [comp.node], axis: axisName });
        }
      });
    }
  });
});

/** Continuum pairs derived from COMPOSITE_ROTATIONS for UI sliders */
export const CONTINUUM_PAIRS: Array<{ negative: number; positive: number; showBlend: boolean }> = (() => {
  const seen = new Set<string>();
  const pairs: Array<{ negative: number; positive: number; showBlend: boolean }> = [];
  for (const comp of COMPOSITE_ROTATIONS) {
    for (const axisName of ['pitch', 'yaw', 'roll'] as const) {
      const axis = comp[axisName];
      if (axis?.negative !== undefined && axis?.positive !== undefined) {
        const key = `${axis.negative}-${axis.positive}`;
        if (!seen.has(key)) {
          seen.add(key);
          pairs.push({ negative: axis.negative, positive: axis.positive, showBlend: true });
        }
      }
    }
  }
  return pairs;
})();

/** Check if an AU has separate left/right morphs */
export function hasLeftRightMorphs(auId: number): boolean {
  const morphs = AU_TO_MORPHS[auId] || [];
  const hasLeft = morphs.some(k => /_L$|Left$/.test(k));
  const hasRight = morphs.some(k => /_R$|Right$/.test(k));
  return hasLeft && hasRight;
}

const X_AXIS = new THREE.Vector3(1,0,0);
const Y_AXIS = new THREE.Vector3(0,1,0);
const Z_AXIS = new THREE.Vector3(0,0,1);
const deg2rad = (d: number) => (d * Math.PI) / 180;

type BoneKeys = 'EYE_L' | 'EYE_R' | 'JAW' | 'HEAD' | 'NECK' | 'TONGUE';

type NodeBase = {
  obj: THREE.Object3D;
  basePos: THREE.Vector3;
  baseQuat: THREE.Quaternion;
  baseEuler: THREE.Euler;
};

type ResolvedBones = Partial<Record<BoneKeys, NodeBase>>;

// Unified transition system - simple lerp-based
type Transition = {
  key: string;
  from: number;
  to: number;
  duration: number;      // seconds
  elapsed: number;       // seconds
  apply: (value: number) => void;
  easing: (t: number) => number;
  resolve?: () => void;  // Called when transition completes
};

// Optimized transition types - pre-resolved targets for direct access
type MorphTarget = {
  mesh: THREE.Mesh;
  index: number;
  key: string;
};

type BoneTarget = {
  bone: NodeBase;
  node: string;
  channel: 'rx' | 'ry' | 'rz' | 'tx' | 'ty' | 'tz';
  scale: number;
  maxDegrees?: number;
  maxUnits?: number;
};

type ResolvedAUTargets = {
  auId: number;
  morphTargets: MorphTarget[];
  boneTargets: BoneTarget[];
  mixWeight: number;
  compositeInfo: {
    nodes: CompositeRotation['node'][];
    axis: 'pitch' | 'yaw' | 'roll';
  } | null;
};

type OptimizedTransition = {
  key: string;
  resolved: ResolvedAUTargets;
};

export class EngineThree {
  private auValues: Record<number, number> = {};

  // Unified transition system - simple lerp-based
  private transitions = new Map<string, Transition>();

  private rigReady = false;
  private missingBoneWarnings = new Set<string>();
  private bakedMixer: THREE.AnimationMixer | null = null;
  private bakedActions = new Map<string, THREE.AnimationAction>();
  private bakedClips: THREE.AnimationClip[] = [];
  private bakedPaused = true;
  private bakedCurrent: string | null = null;

  // Skybox storage
  private scene: THREE.Scene | null = null;
  private skyboxTexture: THREE.Texture | null = null;

  // Unified rotation state tracking for bones
  // Each bone maintains its complete 3D rotation (pitch/yaw/roll) to prevent overwriting
  // TODO: Eventually build this dynamically from shapeDict data and include ALL bones,
  // not just face/head bones. For now, hardcoded to the 5 composite face bones.
  private rotations: Record<string, { pitch: number; yaw: number; roll: number }> = {
    JAW: { pitch: 0, yaw: 0, roll: 0 },
    HEAD: { pitch: 0, yaw: 0, roll: 0 },
    EYE_L: { pitch: 0, yaw: 0, roll: 0 },
    EYE_R: { pitch: 0, yaw: 0, roll: 0 },
    TONGUE: { pitch: 0, yaw: 0, roll: 0 }
  };

  // Nodes with pending rotation changes - applied once per frame in update()
  private pendingCompositeNodes = new Set<string>();
  private isPaused: boolean = false;
  private easeInOutQuad = (t:number) => (t<0.5? 2*t*t : -1+(4-2*t)*t);

  // ============================================================================
  // OPTIMIZED TRANSITION SYSTEM
  // Pre-resolves morph indices and bone references at transition creation time
  // ============================================================================

  // Cache: morph key → array of { mesh, index } for direct access
  private morphIndexCache = new Map<string, Array<{ mesh: THREE.Mesh; index: number }>>();

  // Pre-resolved transition targets for optimized AU transitions
  private optimizedTransitions = new Map<string, OptimizedTransition>();

  /** Build the morph index cache after meshes are loaded */
  private buildMorphIndexCache() {
    this.morphIndexCache.clear();

    for (const mesh of this.meshes) {
      const dict = (mesh as any).morphTargetDictionary as Record<string, number> | undefined;
      if (!dict) continue;

      for (const [key, index] of Object.entries(dict)) {
        let entries = this.morphIndexCache.get(key);
        if (!entries) {
          entries = [];
          this.morphIndexCache.set(key, entries);
        }
        entries.push({ mesh, index });
      }
    }

    console.log(`[EngineThree] Built morph index cache: ${this.morphIndexCache.size} unique morph keys`);
  }

  /**
   * Resolve all targets for an AU transition upfront.
   * Returns morph targets with direct mesh/index access and bone rotation configs.
   */
  private resolveAUTargets(auId: number): ResolvedAUTargets | null {
    const morphKeys = AU_TO_MORPHS[auId] || [];
    const boneBindings = BONE_AU_TO_BINDINGS[auId] || [];
    const mixWeight = MIXED_AUS.has(auId) ? this.getAUMixWeight(auId) : 1.0;

    // Resolve morph targets to direct mesh/index references
    const morphTargets: MorphTarget[] = [];
    for (const key of morphKeys) {
      const entries = this.morphIndexCache.get(key);
      if (entries) {
        for (const { mesh, index } of entries) {
          // Skip occlusion and tearline meshes
          const name = (mesh.name || '').toLowerCase();
          if (name.includes('occlusion') || name.includes('tearline')) continue;
          morphTargets.push({ mesh, index, key });
        }
      }
    }

    // Resolve bone targets to direct bone references
    const boneTargets: BoneTarget[] = [];
    for (const binding of boneBindings) {
      const boneEntry = this.bones[binding.node as BoneKeys];
      if (boneEntry) {
        boneTargets.push({
          bone: boneEntry,
          node: binding.node,
          channel: binding.channel,
          scale: binding.scale,
          maxDegrees: binding.maxDegrees,
          maxUnits: binding.maxUnits
        });
      }
    }

    // Check if this AU is part of a composite rotation
    const compositeInfo = AU_TO_COMPOSITE_MAP.get(auId);

    return {
      auId,
      morphTargets,
      boneTargets,
      mixWeight,
      compositeInfo: compositeInfo || null
    };
  }

  /**
   * OPTIMIZED: Smoothly tween an AU using pre-resolved targets.
   * Morph indices and bone references are resolved once at creation time,
   * then applied directly each tick without lookups.
   */
  transitionAUOptimized = (id: number | string, to: number, durationMs = 200): Promise<void> => {
    const numId = typeof id === 'string' ? Number(id.replace(/[^\d]/g, '')) : id;
    const transitionKey = `au_opt_${numId}`;
    const from = this.auValues[numId] ?? 0;
    const target = clamp01(to);

    // Resolve all targets upfront
    const resolved = this.resolveAUTargets(numId);
    if (!resolved) {
      console.warn(`[EngineThree] Could not resolve targets for AU ${numId}`);
      return Promise.resolve();
    }

    // Create the optimized apply function that uses direct references
    const applyOptimized = (value: number) => {
      // Update AU value for tracking
      this.auValues[numId] = value;

      // Apply morphs directly (with mix weight)
      const morphValue = value * resolved.mixWeight;
      for (const { mesh, index } of resolved.morphTargets) {
        const influences = mesh.morphTargetInfluences;
        if (influences) {
          influences[index] = morphValue;
        }
      }

      // Handle bone rotations
      if (resolved.compositeInfo) {
        // Composite rotation: update rotation state and mark for flush
        for (const nodeKey of resolved.compositeInfo.nodes) {
          const config = COMPOSITE_ROTATIONS.find(c => c.node === nodeKey);
          if (!config) continue;

          const axisConfig = config[resolved.compositeInfo.axis];
          if (!axisConfig) continue;

          // Calculate axis value
          let axisValue = 0;
          if (axisConfig.negative !== undefined && axisConfig.positive !== undefined) {
            const negValue = this.auValues[axisConfig.negative] ?? 0;
            const posValue = this.auValues[axisConfig.positive] ?? 0;
            axisValue = posValue - negValue;
          } else if (axisConfig.aus.length > 1) {
            axisValue = Math.max(...axisConfig.aus.map(auId => this.auValues[auId] ?? 0));
          } else {
            axisValue = value;
          }

          // Update rotation state
          this.rotations[nodeKey][resolved.compositeInfo.axis] = Math.max(-1, Math.min(1, axisValue));
          this.pendingCompositeNodes.add(nodeKey);
        }
      } else {
        // Non-composite: apply bones directly
        for (const boneTarget of resolved.boneTargets) {
          this.applyBoneTargetDirect(boneTarget, value);
        }
      }
    };

    return this.addTransition(
      transitionKey,
      from,
      target,
      durationMs / 1000,
      applyOptimized
    );
  };

  /** Apply a single bone target directly (for non-composite bones) */
  private applyBoneTargetDirect(target: BoneTarget, value: number) {
    const { bone, channel, scale, maxDegrees, maxUnits } = target;
    const { obj, basePos, baseQuat } = bone;

    const clampedVal = Math.min(1, Math.max(-1, value));
    const radians = maxDegrees ? deg2rad(maxDegrees) * clampedVal * scale : 0;
    const units = maxUnits ? maxUnits * clampedVal * scale : 0;

    obj.position.copy(basePos);

    if (channel === 'rx' || channel === 'ry' || channel === 'rz') {
      const axis = channel === 'rx' ? X_AXIS : channel === 'ry' ? Y_AXIS : Z_AXIS;
      const deltaQ = new THREE.Quaternion().setFromAxisAngle(axis, radians);
      obj.quaternion.copy(baseQuat).multiply(deltaQ);
    } else {
      const dir = channel === 'tx' ? X_AXIS.clone() : channel === 'ty' ? Y_AXIS.clone() : Z_AXIS.clone();
      dir.applyQuaternion(baseQuat);
      obj.position.copy(basePos).add(dir.multiplyScalar(units));
    }

    obj.updateMatrixWorld(false);
  }

  // No constructor needed - all state is initialized inline

  private getMorphValue(key: string): number {
    for (const m of this.meshes) {
      const dict: any = (m as any).morphTargetDictionary;
      const infl: any = (m as any).morphTargetInfluences;
      if (!dict || !infl) continue;
      const idx = dict[key];
      if (idx !== undefined) return infl[idx] ?? 0;
    }
    return 0;
  }
  /** Smoothly tween an AU to a target value */
  transitionAU = (id: number | string, to: number, durationMs = 200): Promise<void> => {
    const numId = typeof id === 'string' ? Number(id.replace(/[^\d]/g, '')) : id;
    const transitionKey = `au_${numId}`;
    const from = this.auValues[numId] ?? 0;
    const target = clamp01(to);
    return this.addTransition(
      transitionKey,
      from,
      target,
      durationMs / 1000,
      (value) => this.setAU(numId, value)
    );
  };

  /** Smoothly tween a morph to a target value */
  transitionMorph = (key: string, to: number, durationMs = 120): Promise<void> => {
    const transitionKey = `morph_${key}`;
    const from = this.getMorphValue(key);
    const target = clamp01(to);
    return this.addTransition(
      transitionKey,
      from,
      target,
      durationMs / 1000,
      (value) => this.setMorph(key, value)
    );
  };

  /**
   * Set a continuum AU pair immediately (no animation).
   *
   * Sign convention:
   * - Negative value (-1 to 0): activates negAU (e.g., head left, eyes left)
   * - Positive value (0 to +1): activates posAU (e.g., head right, eyes right)
   *
   * Internally calls setAU() which handles:
   * - Morph application (scaled by mixWeight)
   * - Bone rotation (always at full strength based on value)
   *
   * @param negAU - AU ID for negative direction (e.g., 31 for head left, 61 for eyes left)
   * @param posAU - AU ID for positive direction (e.g., 32 for head right, 62 for eyes right)
   * @param continuumValue - Value from -1 (full negative) to +1 (full positive)
   */
  setContinuum = (negAU: number, posAU: number, continuumValue: number) => {
    const value = Math.max(-1, Math.min(1, continuumValue));

    // Negative value = activate negAU, zero posAU
    // Positive value = activate posAU, zero negAU
    const negVal = value < 0 ? Math.abs(value) : 0;
    const posVal = value > 0 ? value : 0;

    this.setAU(negAU, negVal);
    this.setAU(posAU, posVal);
  };

  /**
   * Smoothly transition a continuum AU pair (e.g., eyes left/right, head up/down).
   * Takes a continuum value from -1 to +1 and internally manages both AU values.
   *
   * Sign convention:
   * - Negative value (-1 to 0): activates negAU (e.g., head left, eyes left)
   * - Positive value (0 to +1): activates posAU (e.g., head right, eyes right)
   *
   * @param negAU - AU ID for negative direction (e.g., 31 for head left, 61 for eyes left)
   * @param posAU - AU ID for positive direction (e.g., 32 for head right, 62 for eyes right)
   * @param continuumValue - Target value from -1 (full negative) to +1 (full positive)
   * @param durationMs - Transition duration in milliseconds
   */
  transitionContinuum = (negAU: number, posAU: number, continuumValue: number, durationMs = 200): Promise<void> => {
    const target = Math.max(-1, Math.min(1, continuumValue));
    const driverKey = `continuum_${negAU}_${posAU}`;

    // Get current continuum value: negative if negAU active, positive if posAU active
    const currentNeg = this.auValues[negAU] ?? 0;
    const currentPos = this.auValues[posAU] ?? 0;
    const currentContinuum = currentPos - currentNeg;  // pos - neg so positive = right

    return this.addTransition(
      driverKey,
      currentContinuum,
      target,
      durationMs / 1000,
      (value) => this.setContinuum(negAU, posAU, value)
    );
  };

  /** Advance internal transition tweens by deltaSeconds (called from ThreeProvider RAF loop). */
  update(deltaSeconds: number) {
    const dtSeconds = Math.max(0, deltaSeconds || 0);
    if (dtSeconds <= 0 || this.isPaused) return;

    // Baked clip animations (pre-authored clips like idle animations)
    if (this.bakedMixer && !this.bakedPaused) this.bakedMixer.update(dtSeconds);

    // Morph target animations
    if (this.morphMixer) this.morphMixer.update(dtSeconds);

    // Unified transitions (AU, morph, composite movements)
    this.tickTransitions(dtSeconds);

    // Flush pending composite rotations (deferred from setAU calls)
    this.flushPendingComposites();

    // Mouse tracking interpolation
    if (this.rigReady && this.mouseTrackingEnabled) {
      this.updateMouseTrackingSmooth(0.08);
    }
  }

  /** Apply all pending composite rotations and clear the set */
  private flushPendingComposites() {
    if (this.pendingCompositeNodes.size === 0) return;

    for (const nodeKey of this.pendingCompositeNodes) {
      this.applyCompositeRotation(nodeKey as 'JAW' | 'HEAD' | 'EYE_L' | 'EYE_R' | 'TONGUE');
    }
    this.pendingCompositeNodes.clear();
  }

  /**
   * Tick all active transitions by dt seconds.
   * Applies eased interpolation and removes completed transitions.
   */
  private tickTransitions(dt: number) {
    const completed: string[] = [];

    this.transitions.forEach((t, key) => {
      t.elapsed += dt;
      const progress = Math.min(t.elapsed / t.duration, 1.0);
      const easedProgress = t.easing(progress);

      // Interpolate and apply
      const value = t.from + (t.to - t.from) * easedProgress;
      t.apply(value);

      // Check completion
      if (progress >= 1.0) {
        completed.push(key);
        t.resolve?.();
      }
    });

    // Remove completed transitions
    completed.forEach(key => this.transitions.delete(key));
  }

  /**
   * Add or replace a transition for the given key.
   * If a transition with the same key exists, it is cancelled and replaced.
   * @returns Promise that resolves when the transition completes
   */
  private addTransition(
    key: string,
    from: number,
    to: number,
    durationSec: number,
    apply: (value: number) => void,
    easing: (t: number) => number = this.easeInOutQuad
  ): Promise<void> {
    // Cancel existing transition for this key
    const existing = this.transitions.get(key);
    if (existing?.resolve) {
      existing.resolve(); // Resolve immediately (cancelled)
    }

    // Instant transition if duration is 0 or values are equal
    if (durationSec <= 0 || Math.abs(to - from) < 1e-6) {
      apply(to);
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.transitions.set(key, {
        key,
        from,
        to,
        duration: durationSec,
        elapsed: 0,
        apply,
        easing,
        resolve,
      });
    });
  }

  /** Clear all running transitions (used when playback rate changes to prevent timing conflicts). */
  clearTransitions() {
    this.transitions.forEach(t => t.resolve?.());
    this.transitions.clear();
  }

  /** Pause all active transitions (they will resume when update() is called again). */
  pause() {
    this.isPaused = true;
  }

  /** Resume all paused transitions. */
  resume() {
    this.isPaused = false;
  }

  /** Get current pause state. */
  getPaused(): boolean {
    return this.isPaused;
  }

  /** Get count of active transitions (useful for debugging). */
  getActiveTransitionCount(): number {
    return this.transitions.size;
  }

  private meshes: THREE.Mesh[] = [];
  private model: THREE.Object3D | null = null;

  /** Get all mesh info for UI display (traverses full model, not just morph meshes) */
  getMeshList = (): Array<{ name: string; visible: boolean; category: string; morphCount: number }> => {
    if (!this.model) return [];
    const result: Array<{ name: string; visible: boolean; category: string; morphCount: number }> = [];
    this.model.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        const info = CC4_MESHES[mesh.name];
        result.push({
          name: mesh.name,
          visible: mesh.visible,
          category: info?.category || 'other',
          morphCount: info?.morphCount ?? (mesh.morphTargetInfluences?.length || 0),
        });
      }
    });
    return result;
  };

  /** Set mesh visibility by name (searches full model) */
  setMeshVisible = (meshName: string, visible: boolean) => {
    if (!this.model) return;
    this.model.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh && obj.name === meshName) {
        obj.visible = visible;
      }
    });
  };

  /** Set visibility for all meshes of a category */
  setCategoryVisible = (category: string, visible: boolean) => {
    if (!this.model) return;
    this.model.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const info = CC4_MESHES[obj.name];
        if (info?.category === category) {
          obj.visible = visible;
        }
      }
    });
  };
  private bones: ResolvedBones = {};

  // --- Mix weight system ---
  // Bones always apply at 100%. Mix weight controls the morph overlay:
  // 0 = bone only (no morph), 1 = bone + full morph overlay
  private mixWeights: Record<number, number> = { ...AU_MIX_DEFAULTS };

  setAUMixWeight = (id: number, weight: number) => {
    this.mixWeights[id] = clamp01(weight);

    // Reapply just this AU's morph with the new mix weight
    const v = this.auValues[id] ?? 0;
    if (v > 0) this.applyBothSides(id, v);

    // Mark affected bone as pending (bones don't change, but ensures consistency)
    const compositeInfo = AU_TO_COMPOSITE_MAP.get(id);
    if (compositeInfo) {
      for (const nodeKey of compositeInfo.nodes) {
        this.pendingCompositeNodes.add(nodeKey);
      }
    }
  };

  getAUMixWeight = (id: number): number => {
    // Return stored mix weight, or default from AU_MIX_DEFAULTS, or 1.0 (full bone)
    return this.mixWeights[id] ?? AU_MIX_DEFAULTS[id] ?? 1.0;
  };

  /**
   * Reset all facial animation to neutral state.
   * This resets both blend shapes (morphs) AND bone rotations.
   */
  resetToNeutral = () => {
    // 1. Clear all AU values
    this.auValues = {};

    // 2. Reset all composite bone rotation state
    this.rotations = {
      JAW: { pitch: 0, yaw: 0, roll: 0 },
      HEAD: { pitch: 0, yaw: 0, roll: 0 },
      EYE_L: { pitch: 0, yaw: 0, roll: 0 },
      EYE_R: { pitch: 0, yaw: 0, roll: 0 },
      TONGUE: { pitch: 0, yaw: 0, roll: 0 }
    };

    // 3. Clear all active transitions
    this.clearTransitions();

    // 4. Mark all composite bones as pending (they'll reset to base in flushPendingComposites)
    (['HEAD', 'EYE_L', 'EYE_R', 'JAW', 'TONGUE'] as const).forEach(node => {
      this.pendingCompositeNodes.add(node);
    });

    // 5. Zero out all morphs directly
    for (const m of this.meshes) {
      const infl: any = (m as any).morphTargetInfluences;
      if (!infl) continue;
      for (let i = 0; i < infl.length; i++) {
        infl[i] = 0;
      }
    }

    // 6. Reset all bones to their base transforms
    Object.values(this.bones).forEach((entry) => {
      if (!entry) return;
      entry.obj.position.copy(entry.basePos);
      entry.obj.quaternion.copy(entry.baseQuat);
    });
  };

  hasBoneBinding = (id: number) => BONE_DRIVEN_AUS.has(id);

  onReady = ({ meshes, model, animations, scene, skyboxTexture }: {
    meshes: THREE.Mesh[];
    model?: THREE.Object3D;
    animations?: THREE.AnimationClip[];
    scene?: THREE.Scene;
    skyboxTexture?: THREE.Texture;
  }) => {
    this.meshes = meshes;

    // Build morph index cache for optimized transitions
    this.buildMorphIndexCache();

    // Store scene and skybox references
    if (scene) this.scene = scene;
    if (skyboxTexture) this.skyboxTexture = skyboxTexture;

    if (model) {
      this.model = model;
      this.bones = this.resolveBones(model);
      this.logResolvedOnce(this.bones);
      this.rigReady = true;
      this.missingBoneWarnings.clear();

      // Set render order for proper layering (eyes behind hair)
      this.setupMeshRenderOrder(model);
    }

    if (model && animations && animations.length) {
      this.bakedMixer = new THREE.AnimationMixer(model);
      this.bakedActions.clear();
      this.bakedClips = animations;
      animations.forEach((clip) => {
        const action = this.bakedMixer!.clipAction(clip);
        action.loop = THREE.LoopRepeat;
        action.clampWhenFinished = false;
        action.reset();
        action.play();
        action.paused = true; // keep paused by default
        this.bakedActions.set(clip.name || `clip_${this.bakedActions.size}`, action);
      });
      this.bakedCurrent = this.bakedActions.keys().next().value ?? null;
      this.bakedPaused = true;
    }
  };

  getBakedClipNames = () => Array.from(this.bakedActions.keys());

  getCurrentBakedClip = () => this.bakedCurrent;

  setBakedClip = (name: string) => {
    if (!this.bakedActions.has(name)) return;
    // Pause and reset all others
    this.bakedActions.forEach((action, key) => {
      if (key !== name) {
        action.stop();
        action.reset();
        action.paused = true;
      }
    });
    this.bakedCurrent = name;
    const current = this.bakedActions.get(name)!;
    if (!this.bakedPaused) {
      current.reset();
      current.paused = false;
      current.play();
    }
  };

  setBakedPlayback = (play: boolean) => {
    if (!this.bakedActions.size || !this.bakedMixer) return;
    if (!this.bakedCurrent) {
      const first = this.bakedActions.keys().next().value;
      if (first) this.bakedCurrent = first;
    }
    const current = this.bakedCurrent ? this.bakedActions.get(this.bakedCurrent) : undefined;
    if (!current) return;

    this.bakedPaused = !play;
    if (play) {
      current.reset();
      current.paused = false;
      current.play();
    } else {
      current.paused = true;
    }
  };

  resetBakedClip = () => {
    if (!this.bakedCurrent) return;
    const action = this.bakedActions.get(this.bakedCurrent);
    if (!action) return;
    action.reset();
    action.paused = this.bakedPaused;
  };

  getBakedPlaybackState = () => !this.bakedPaused && this.bakedActions.size > 0;

  /** Morphs **/
  setMorph = (key: string, v: number) => {
    const val = clamp01(v);
    for (const m of this.meshes) {
      const name = (m.name || '').toLowerCase();
      if (name.includes('occlusion') || name.includes('tearline')) continue;
      const dict: any = (m as any).morphTargetDictionary;
      const infl: any = (m as any).morphTargetInfluences;
      if (!dict || !infl) continue;
      const idx = dict[key];
      if (idx !== undefined) infl[idx] = val;
    }
  };

  /**
   * Set a morph on a specific subset of meshes.
   * This avoids iterating over the entire scene for hair-only updates.
   */
  setMorphOnMeshes = (meshNames: string[], key: string, v: number) => {
    if (!meshNames || meshNames.length === 0) {
      this.setMorph(key, v);
      return;
    }

    const val = clamp01(v);
    const nameSet = new Set(meshNames.map((n) => (n || '').toLowerCase()));

    for (const m of this.meshes) {
      const name = (m.name || '').toLowerCase();
      if (!nameSet.has(name)) continue;
      const dict: any = (m as any).morphTargetDictionary;
      const infl: any = (m as any).morphTargetInfluences;
      if (!dict || !infl) continue;
      const idx = dict[key];
      if (idx !== undefined) infl[idx] = val;
    }
  };

  applyMorphs = (keys: string[], v: number) => {
    const val = clamp01(v);
    const foundMorphs: string[] = [];
    const notFoundMorphs: string[] = [];

    for (const m of this.meshes) {
      const name = (m.name || '').toLowerCase();
      if (name.includes('occlusion') || name.includes('tearline')) continue;
      const dict: any = (m as any).morphTargetDictionary;
      const infl: any = (m as any).morphTargetInfluences;
      if (!dict || !infl) continue;
      for (const k of keys) {
        const idx = dict[k];
        if (idx !== undefined) {
          infl[idx] = val;
          if (!foundMorphs.includes(k)) foundMorphs.push(k);
        } else {
          if (!notFoundMorphs.includes(k)) notFoundMorphs.push(k);
        }
      }
    }

  };

  /** AU — supports numeric (both sides) and string with side, e.g., '12L'/'12R' **/
  setAU = (id: number | string, v: number) => {
    if (typeof id === 'string') {
      const match = id.match(/^(\d+)([LR])$/i);
      if (match) {
        const au = Number(match[1]);
        const side = match[2].toUpperCase() as 'L' | 'R';
        const keys = this.keysForSide(au, side);
        if (keys.length) this.applyMorphs(keys, v);
        this.auValues[au] = v;
        return;
      }
      const n = Number(id);
      if (!Number.isNaN(n)) this.applyBothSides(n, v);
      return;
    }

    this.auValues[id] = v;

    // Check if this AU is part of a composite rotation system
    const compositeInfo = AU_TO_COMPOSITE_MAP.get(id);

    if (compositeInfo) {
      // This AU affects composite bone rotations (jaw, head, eyes)
      // console.log(`[EngineThree] setAU(${id}, ${v.toFixed(2)}) → axis: ${compositeInfo.axis}, nodes: ${compositeInfo.nodes.join(', ')}`);

      // Always apply morphs first
      this.applyBothSides(id, v);

      // Update rotation state for each affected node
      for (const nodeKey of compositeInfo.nodes) {
        // Determine the value for this axis based on the continuum
        const config = COMPOSITE_ROTATIONS.find(c => c.node === nodeKey);
        if (!config) continue;

        const axisConfig = config[compositeInfo.axis];
        if (!axisConfig) continue;

        // Calculate axis value based on whether it's a continuum or multi-AU axis
        let axisValue = 0;
        if (axisConfig.negative !== undefined && axisConfig.positive !== undefined) {
          // Continuum: calculate difference between positive and negative AUs
          const negValue = this.auValues[axisConfig.negative] ?? 0;
          const posValue = this.auValues[axisConfig.positive] ?? 0;
          axisValue = posValue - negValue;
          // console.log(`    ${nodeKey}.${compositeInfo.axis}: AU${axisConfig.negative}(${negValue.toFixed(2)}) - AU${axisConfig.positive}(${posValue.toFixed(2)}) = ${axisValue.toFixed(2)}`);
        } else if (axisConfig.aus.length > 1) {
          // Multiple AUs affect same axis (e.g., jaw drop has AU 25, 26, 27)
          // Use the maximum value among all AUs for this axis
          axisValue = Math.max(...axisConfig.aus.map(auId => this.auValues[auId] ?? 0));
          // console.log(`    ${nodeKey}.${compositeInfo.axis}: max of AUs ${axisConfig.aus.join(', ')} = ${axisValue.toFixed(2)}`);
        } else {
          // Single AU controls this axis
          axisValue = v;
          // console.log(`    ${nodeKey}.${compositeInfo.axis}: direct value = ${axisValue.toFixed(2)}`);
        }

        // Update the rotation state for this axis
        this.updateBoneRotation(nodeKey, compositeInfo.axis, axisValue);

        // Mark node as pending - will be applied in update()
        this.pendingCompositeNodes.add(nodeKey);
      }
    } else {
      // Non-composite AU: apply directly to both morphs and bones
      this.applyBothSides(id, v);
      if (this.hasBoneBinding(id)) {
        this.applyBones(id, v);
      }
    }
  };

  /**
   * Calculate the offset needed for the character to look at the camera
   * This is used for perspective-correct eye contact when using webcam tracking
   *
   * @param cameraPosition - Position of the camera in world space (default: [0, 1.6, 3])
   * @param characterPosition - Position of the character in world space (default: [0, 1, 0])
   * @returns Normalized offset { x: -1..1 (left..right), y: -1..1 (down..up) }
   */
  public getCameraOffset(
    cameraPosition: THREE.Vector3 = new THREE.Vector3(0, 1.6, 3),
    characterPosition: THREE.Vector3 = new THREE.Vector3(0, 1, 0)
  ): { x: number; y: number } {
    // Vector from character to camera
    const toCamera = new THREE.Vector3().subVectors(cameraPosition, characterPosition);

    // Calculate horizontal angle (yaw) - rotation around Y axis
    // Positive X is right, negative X is left
    const horizontalDistance = Math.sqrt(toCamera.x * toCamera.x + toCamera.z * toCamera.z);
    const yaw = Math.atan2(toCamera.x, toCamera.z);

    // Calculate vertical angle (pitch) - rotation around X axis
    // Positive Y is up, negative Y is down
    const pitch = Math.atan2(toCamera.y, horizontalDistance);

    // Normalize to -1..1 range
    // Yaw: -PI..PI → -1..1 (but clamp to reasonable FOV, ~60 degrees = ~1 radian)
    const maxYawAngle = Math.PI / 3; // 60 degrees
    const normalizedX = Math.max(-1, Math.min(1, yaw / maxYawAngle));

    // Pitch: -PI/2..PI/2 → -1..1 (but clamp to reasonable vertical FOV)
    const maxPitchAngle = Math.PI / 4; // 45 degrees
    const normalizedY = Math.max(-1, Math.min(1, pitch / maxPitchAngle));

    // console.log(`[EngineThree] Camera offset: yaw=${(yaw * 180 / Math.PI).toFixed(1)}°, pitch=${(pitch * 180 / Math.PI).toFixed(1)}°, normalized=(${normalizedX.toFixed(2)}, ${normalizedY.toFixed(2)})`);

    return { x: normalizedX, y: normalizedY };
  }

  // Handles bidirectional morph logic for eyes and head
  private applyDirectionalMorphs(id: number, value: number) {
    const absVal = Math.abs(value);
    const dir = Math.sign(value);
    const morphs = AU_TO_MORPHS[id] || [];
    if (!morphs.length) return;

    // Head
    if (id === 31 || id === 32) {
      // Horizontal (character POV)
      this.applyMorphs(dir > 0 ? AU_TO_MORPHS[31] : AU_TO_MORPHS[32], absVal);
    } else if (id === 33 || id === 54) {
      // Vertical (character POV)
      this.applyMorphs(dir > 0 ? AU_TO_MORPHS[33] : AU_TO_MORPHS[54], absVal);
    }

    // Eyes
    else if (id === 61 || id === 62) {
      this.applyMorphs(dir > 0 ? AU_TO_MORPHS[61] : AU_TO_MORPHS[62], absVal);
    } else if (id === 63 || id === 64) {
      this.applyMorphs(dir > 0 ? AU_TO_MORPHS[63] : AU_TO_MORPHS[64], absVal);
    }

    // Default
    else {
      this.applyMorphs(morphs, absVal);
    }
  }

  /** Engine internals **/
  /**
   * Apply morphs for an AU, with mix weight scaling for mixed AUs.
   *
   * ⚠️ CRITICAL MIX WEIGHT BEHAVIOR:
   * - For mixed AUs (bones + morphs): morphValue = v * mixWeight
   *   - mixWeight = 0.0 → morphValue = 0 (no morph, bones only)
   *   - mixWeight = 1.0 → morphValue = v (full morph + bones)
   * - For morph-only AUs: morphValue = v (always 100%)
   *
   * Note: Bones are NOT scaled here - they're handled separately in applyCompositeMotion
   * See: MIX_WEIGHT_SYSTEM.md for detailed explanation
   */
  private applyBothSides = (id: number, v: number) => {
    // For head and eye AUs that aren't left/right split, apply all keys directly
    const globalAUs = new Set([31, 32, 33, 54, 61, 62, 63, 64]);
    const keys = AU_TO_MORPHS[id] || [];

    // ⚠️ CRITICAL: Scale morphs by mixWeight (NOT bones - they're handled elsewhere)
    // For mixed AUs: morphValue = v * mixWeight
    // mixWeight = 0.0 → no morph (bone only)
    // mixWeight = 1.0 → full morph (bone + morph)
    const mixWeight = MIXED_AUS.has(id) ? this.getAUMixWeight(id) : 1.0;
    const morphValue = v * mixWeight;

    if (globalAUs.has(id)) {
      this.applyMorphs(keys, morphValue);
    } else {
      const leftKeys = keys.filter(k => /(_L|Left)$/.test(k));
      const rightKeys = keys.filter(k => /(_R|Right)$/.test(k));
      if (leftKeys.length || rightKeys.length) {
        this.applyMorphs(leftKeys, morphValue);
        this.applyMorphs(rightKeys, morphValue);
      } else if (keys.length) {
        this.applyMorphs(keys, morphValue);
      }
    }
  };

  /**
   * Update rotation state for a specific axis of a composite bone.
   * This allows independent control of pitch/yaw/roll without overwriting.
   */
  private updateBoneRotation(
    nodeKey: 'JAW' | 'HEAD' | 'EYE_L' | 'EYE_R' | 'TONGUE',
    axis: 'pitch' | 'yaw' | 'roll',
    value: number
  ) {
    this.rotations[nodeKey][axis] = Math.max(-1, Math.min(1, value));
  }

  /**
   * Apply the complete composite rotation for a bone.
   * Combines pitch/yaw/roll from rotation state into a single quaternion.
   */
  private applyCompositeRotation(nodeKey: 'JAW' | 'HEAD' | 'EYE_L' | 'EYE_R' | 'TONGUE') {
    const bones = this.bones;
    const entry = bones[nodeKey];
    if (!entry || !this.model) {
      if (!entry && this.rigReady && !this.missingBoneWarnings.has(nodeKey)) {
        console.warn(`[EngineThree] applyCompositeRotation: No bone entry for ${nodeKey}`);
        this.missingBoneWarnings.add(nodeKey);
      }
      return;
    }

    const { obj, basePos, baseQuat } = entry;
    const rotState = this.rotations[nodeKey];

    // Find the composite rotation config for this node
    const config = COMPOSITE_ROTATIONS.find(c => c.node === nodeKey);
    if (!config) return;

    // Helper to get binding from the correct AU for an axis based on direction
    const getBindingForAxis = (
      axisConfig: typeof config.pitch | typeof config.yaw | typeof config.roll,
      direction: number
    ) => {
      if (!axisConfig) return null;

      // For continuum pairs, select the AU based on direction
      // negative direction → use negative AU's binding
      // positive direction → use positive AU's binding
      if (axisConfig.negative !== undefined && axisConfig.positive !== undefined) {
        const auId = direction < 0 ? axisConfig.negative : axisConfig.positive;
        return BONE_AU_TO_BINDINGS[auId]?.[0];
      }

      // If multiple AUs (non-continuum), find which one is active (has highest value)
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
        return BONE_AU_TO_BINDINGS[maxAU]?.[0];
      }

      // Single AU - use first AU
      return BONE_AU_TO_BINDINGS[axisConfig.aus[0]]?.[0];
    };

    // Build composite quaternion from individual axes
    const compositeQ = new THREE.Quaternion().copy(baseQuat);

    // Helper to get axis from config
    const getAxis = (axisName: 'rx' | 'ry' | 'rz') =>
      axisName === 'rx' ? X_AXIS : axisName === 'ry' ? Y_AXIS : Z_AXIS;

    // Apply rotations in order: yaw, pitch, roll
    // Use the axis from config (e.g., eyes use rz for yaw, head uses ry)
    if (config.yaw && rotState.yaw !== 0) {
      const binding = getBindingForAxis(config.yaw, rotState.yaw);
      if (binding?.maxDegrees) {
        // Use absolute value * scale since we selected the correct AU for direction
        const radians = deg2rad(binding.maxDegrees) * Math.abs(rotState.yaw) * binding.scale;
        const axis = getAxis(config.yaw.axis);
        const deltaQ = new THREE.Quaternion().setFromAxisAngle(axis, radians);
        compositeQ.multiply(deltaQ);
      }
    }

    if (config.pitch && rotState.pitch !== 0) {
      const binding = getBindingForAxis(config.pitch, rotState.pitch);
      if (binding?.maxDegrees) {
        // Use absolute value * scale since we selected the correct AU for direction
        const radians = deg2rad(binding.maxDegrees) * Math.abs(rotState.pitch) * binding.scale;
        const axis = getAxis(config.pitch.axis);
        const deltaQ = new THREE.Quaternion().setFromAxisAngle(axis, radians);
        compositeQ.multiply(deltaQ);
      }
    }

    if (config.roll && rotState.roll !== 0) {
      const binding = getBindingForAxis(config.roll, rotState.roll);
      if (binding?.maxDegrees) {
        // Use absolute value * scale since we selected the correct AU for direction
        const radians = deg2rad(binding.maxDegrees) * Math.abs(rotState.roll) * binding.scale;
        const axis = getAxis(config.roll.axis);
        const deltaQ = new THREE.Quaternion().setFromAxisAngle(axis, radians);
        compositeQ.multiply(deltaQ);
      }
    }

    // Apply composite rotation
    obj.position.copy(basePos);
    obj.quaternion.copy(compositeQ);
    obj.updateMatrixWorld(false);
    this.model.updateMatrixWorld(true);
    // console.log(`  → Applied composite rotation to ${nodeKey} bone`);
  }

  private applyBones = (id: number, v: number) => {
    const bindings = BONE_AU_TO_BINDINGS[id];
    if (!bindings || !bindings.length || !this.model) return;
    const bones = this.bones;

    // Clamp to normalized range (-1 to +1) to preserve natural limits
    const val = Math.min(1, Math.max(-1, v));

    for (const b of bindings) {
      const entry = bones[b.node as BoneKeys];
      if (!entry) continue;

      // Eye axis override for CC rigs
      let binding = { ...b };
      if (id >= 61 && id <= 62) {
        binding = { ...binding, channel: EYE_AXIS.yaw };
      } else if (id >= 63 && id <= 64) {
        binding = { ...binding, channel: EYE_AXIS.pitch };
      }

      // Use absolute magnitude (0–1) with signed rotation respecting maxDegrees
      const absVal = Math.abs(val);
      const signedScale = Math.sign(val) || 1;
      const radians = b.maxDegrees ? deg2rad(b.maxDegrees) * absVal * b.scale * signedScale : 0;
      const units = b.maxUnits ? b.maxUnits * absVal * b.scale * signedScale : 0;

      // Apply the binding
      this.applySingleBinding(entry, { ...binding, maxDegrees: b.maxDegrees, maxUnits: b.maxUnits, scale: b.scale }, val);
    }

    this.model.updateMatrixWorld(true);
  };

  private applySingleBinding(
    entry: NodeBase,
    b: { channel: string; maxDegrees?: number; maxUnits?: number; scale: number; node?: string },
    val: number
  ) {
    const { obj, basePos, baseQuat } = entry;

    // Clamp input to natural range [-1, 1]
    const clampedVal = Math.min(1, Math.max(-1, val));

    // Calculate radians/units respecting maxDegrees and scale
    const radians = b.maxDegrees ? deg2rad(b.maxDegrees) * clampedVal * b.scale : 0;
    const units = b.maxUnits ? b.maxUnits * clampedVal * b.scale : 0;

    // Maintain base position (no drift)
    obj.position.copy(basePos);

    // Apply combined axis rotation while preserving boundaries
    if (b.channel === 'rx' || b.channel === 'ry' || b.channel === 'rz') {
      const deltaQ = new THREE.Quaternion();
      const axis = b.channel === 'rx' ? X_AXIS : b.channel === 'ry' ? Y_AXIS : Z_AXIS;

      // Compute new rotation relative to baseQuat (no accumulation here; callers should compose before calling)
      deltaQ.setFromAxisAngle(axis, radians);
      obj.quaternion.copy(baseQuat).multiply(deltaQ);
    } else {
      const dir =
        b.channel === 'tx' ? X_AXIS.clone() :
        b.channel === 'ty' ? Y_AXIS.clone() : Z_AXIS.clone();
      dir.applyQuaternion(baseQuat);
      const offset = dir.multiplyScalar(units);
      obj.position.copy(basePos).add(offset);
    }

    // Update only this node’s matrix without resetting others
    obj.updateMatrixWorld(false);
  }

  /** Resolve CC4 bones using explicit node names (no heuristics). */
  private resolveBones = (root: THREE.Object3D): ResolvedBones => {
    const resolved: ResolvedBones = {};

    const snapshot = (obj: THREE.Object3D): NodeBase => ({
      obj,
      basePos: obj.position.clone(),
      baseQuat: obj.quaternion.clone(),
      baseEuler: new THREE.Euler().setFromQuaternion(obj.quaternion.clone(), obj.rotation.order),
    });

    const findNode = (name?: string | null): THREE.Object3D | null => {
      if (!name) return null;
      return root.getObjectByName(name) || null;
    };

    const register = (key: BoneKeys, primary?: string | null, fallback?: string | null) => {
      if (resolved[key]) return;
      const node = findNode(primary) || findNode(fallback || undefined);
      if (node) resolved[key] = snapshot(node);
    };

    register('EYE_L', CC4_BONE_NODES.EYE_L, CC4_EYE_MESH_NODES.LEFT);
    register('EYE_R', CC4_BONE_NODES.EYE_R, CC4_EYE_MESH_NODES.RIGHT);
    register('JAW', CC4_BONE_NODES.JAW);
    register('HEAD', CC4_BONE_NODES.HEAD);
    register('NECK', CC4_BONE_NODES.NECK);
    register('TONGUE', CC4_BONE_NODES.TONGUE);

    const neckTwist = findNode(CC4_BONE_NODES.NECK_TWIST);
    if (neckTwist) (resolved as any).NECK2 = snapshot(neckTwist);

    (['HEAD','EYE_L','EYE_R','JAW','TONGUE'] as const).forEach((key) => {
      if (!resolved[key]) {
        const expected =
          key === 'EYE_L' ? CC4_BONE_NODES.EYE_L :
          key === 'EYE_R' ? CC4_BONE_NODES.EYE_R :
          key === 'HEAD' ? CC4_BONE_NODES.HEAD :
          key === 'JAW' ? CC4_BONE_NODES.JAW :
          CC4_BONE_NODES.TONGUE;
        console.warn(`[EngineThree] Missing ${key} bone (expected node "${expected}")`);
      }
    });

    return resolved;
  };

  // ========================================
  // Hair & Eyebrow Color Control
  // ========================================

  /**
   * Set up render order for all meshes to ensure proper layering.
   * Eyes render first (behind), then face/body, then hair (on top).
   * This prevents eyes from showing through transparent hair.
   */
  private setupMeshRenderOrder(model: THREE.Object3D) {
    model.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      const mesh = obj as THREE.Mesh;
      const name = mesh.name;

      // Look up mesh category from CC4_MESHES
      const info = CC4_MESHES[name];
      const category = info?.category;

      // Render order strategy:
      // -10: Eyes, cornea (render first, behind everything)
      //  -5: Eye occlusion, tear lines (close to eyes)
      //   0: Body, face, teeth, tongue (default)
      //   5: Eyebrows (above face)
      //  10: Hair (render last, on top of everything)
      switch (category) {
        case 'eye':
        case 'cornea':
          mesh.renderOrder = -10;
          break;
        case 'eyeOcclusion':
        case 'tearLine':
          mesh.renderOrder = -5;
          break;
        case 'eyebrow':
          mesh.renderOrder = 5;
          break;
        case 'hair':
          mesh.renderOrder = 10;
          break;
        // body, teeth, tongue, etc. stay at default 0
      }
    });
  }

  /**
   * Apply color to a hair or eyebrow mesh
   */
  setHairColor(mesh: THREE.Mesh, baseColor: string, emissive: string, emissiveIntensity: number, isEyebrow: boolean = false) {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    materials.forEach((mat) => {
      const standardMat = mat as THREE.MeshStandardMaterial;

      // Set base color
      if (standardMat.color !== undefined) {
        standardMat.color.set(baseColor);
      }

      // Set emissive glow
      if (standardMat.emissive !== undefined) {
        standardMat.emissive.set(emissive);
        standardMat.emissiveIntensity = emissiveIntensity;
      }
    });

    // Set renderOrder: eyebrows=5, hair=10 (consistent with setupMeshRenderOrder)
    mesh.renderOrder = isEyebrow ? 5 : 10;
  }

  /**
   * Create or remove wireframe outline for a mesh
   */
  setHairOutline(mesh: THREE.Mesh, show: boolean, color: string, opacity: number): THREE.LineSegments | undefined {
    // Remove existing wireframe if present
    const existingWireframe = mesh.children.find(
      (child) => child.name === `${mesh.name}_wireframe`
    ) as THREE.LineSegments | undefined;

    if (existingWireframe) {
      mesh.remove(existingWireframe);
      existingWireframe.geometry.dispose();
      (existingWireframe.material as THREE.Material).dispose();
    }

    // Add wireframe if requested
    if (show) {
      const wireframeGeometry = new THREE.WireframeGeometry(mesh.geometry);
      const wireframeMaterial = new THREE.LineBasicMaterial({
        color: new THREE.Color(color),
        linewidth: 2,
        transparent: true,
        opacity: opacity,
      });
      const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
      wireframe.name = `${mesh.name}_wireframe`;
      mesh.add(wireframe);
      return wireframe;
    }

    return undefined;
  }


  /**
   * Register hair objects and return engine-agnostic metadata.
   * Classification is handled by shapeDict (single source of truth).
   */
  registerHairObjects(objects: THREE.Object3D[]): Array<{
    name: string;
    isEyebrow: boolean;
    isMesh: boolean;
  }> {
    return objects.map((obj) => {
      const isMesh = (obj as THREE.Mesh).isMesh || false;
      const info = CC4_MESHES[obj.name];
      const isEyebrow = info?.category === 'eyebrow';

      if (isMesh) {
        const mesh = obj as THREE.Mesh;
        // Eyebrows=5, hair=10 (consistent with setupMeshRenderOrder)
        mesh.renderOrder = isEyebrow ? 5 : 10;
      }

      return {
        name: obj.name,
        isEyebrow,
        isMesh,
      };
    });
  }

  /**
   * Apply hair state to scene objects by name
   * This method handles all Three.js-specific operations for applying hair state
   * NOTE: Handles objects with _1, _2, etc suffixes (e.g. Side_part_wavy_1, Side_part_wavy_2)
   */
  applyHairStateToObject(
    objectName: string,
    state: {
      color: { baseColor: string; emissive: string; emissiveIntensity: number };
      outline: { show: boolean; color: string; opacity: number };
      visible?: boolean;
      scale?: number;
      position?: [number, number, number];
      isEyebrow?: boolean;
    }
  ): THREE.LineSegments | undefined {
    if (!this.model) return undefined;

    // Find ALL objects that match this name (handles _1, _2, etc. suffixes)
    // For example: "Side_part_wavy" will match "Side_part_wavy_1" and "Side_part_wavy_2"
    const matchingObjects: THREE.Object3D[] = [];

    this.model.traverse((obj) => {
      if (obj.name === objectName) {
        matchingObjects.push(obj);
      }
    });

    if (matchingObjects.length === 0) {
      console.warn(`[EngineThree] applyHairStateToObject: No object found with name "${objectName}"`);
      return undefined;
    }

    let lastOutline: THREE.LineSegments | undefined;

    // Apply state to all matching objects
    matchingObjects.forEach((object) => {
      // Apply visibility
      if (state.visible !== undefined) {
        object.visible = state.visible;
      }

      // Apply scale
      if (state.scale !== undefined) {
        object.scale.setScalar(state.scale);
      }

      // Apply position
      if (state.position) {
        const [x, y, z] = state.position;
        object.position.set(x, y, z);
      }

      // Apply color if it's a mesh
      if ((object as THREE.Mesh).isMesh) {
        const mesh = object as THREE.Mesh;
        this.setHairColor(
          mesh,
          state.color.baseColor,
          state.color.emissive,
          state.color.emissiveIntensity,
          state.isEyebrow || false
        );

        // Apply outline
        lastOutline = this.setHairOutline(
          mesh,
          state.outline.show,
          state.outline.color,
          state.outline.opacity
        );
      }
    });

    return lastOutline;
  }

  /**
   * Get hair geometry info for vertex manipulation
   * Returns cloned geometry that can be manipulated without affecting original
   */
  getHairGeometry(objectName: string): {
    geometry: THREE.BufferGeometry | null;
    originalPositions: Float32Array | null;
    vertexCount: number;
  } | null {
    const object = this.model?.getObjectByName(objectName);
    if (!object || !(object as THREE.Mesh).isMesh) return null;

    const mesh = object as THREE.Mesh;
    const geometry = mesh.geometry;

    if (!geometry.attributes.position) return null;

    // Store original positions for reset/animation
    const originalPositions = new Float32Array(geometry.attributes.position.array);

    return {
      geometry,
      originalPositions,
      vertexCount: geometry.attributes.position.count,
    };
  }

  /**
   * Get available hair morph targets from a hair object
   * Returns array of morph target names
   */
  getHairMorphTargets(objectName: string): string[] {
    const object = this.model?.getObjectByName(objectName);
    if (!object || !(object as THREE.Mesh).isMesh) return [];

    const mesh = object as THREE.Mesh;
    const dict = (mesh as any).morphTargetDictionary;
    if (!dict) return [];

    return Object.keys(dict);
  }

  /**
   * Get current head rotation values for hair physics
   * Returns { yaw, pitch, roll } in range [-1, 1]
   */
  getHeadRotation(): { yaw: number; pitch: number; roll: number } {
    return {
      yaw: this.rotations.HEAD?.yaw ?? 0,
      pitch: this.rotations.HEAD?.pitch ?? 0,
      roll: this.rotations.HEAD?.roll ?? 0
    };
  }

  /**
   * Apply vertex displacement to hair geometry
   * Uses a displacement function that takes vertex position and returns new position
   */
  applyHairVertexDisplacement(
    objectName: string,
    displacementFn: (vertex: THREE.Vector3, index: number) => THREE.Vector3,
    blend: number = 1.0
  ): boolean {
    const object = this.model?.getObjectByName(objectName);
    if (!object || !(object as THREE.Mesh).isMesh) return false;

    const mesh = object as THREE.Mesh;
    const geometry = mesh.geometry;
    const positionAttr = geometry.attributes.position;

    if (!positionAttr) return false;

    // Get or store original positions
    if (!geometry.userData.originalPositions) {
      geometry.userData.originalPositions = new Float32Array(positionAttr.array);
    }

    const originalPositions = geometry.userData.originalPositions as Float32Array;
    const vertex = new THREE.Vector3();

    for (let i = 0; i < positionAttr.count; i++) {
      const i3 = i * 3;

      // Get original vertex position
      vertex.set(
        originalPositions[i3],
        originalPositions[i3 + 1],
        originalPositions[i3 + 2]
      );

      // Apply displacement function
      const newVertex = displacementFn(vertex, i);

      // Blend with original
      positionAttr.setXYZ(
        i,
        originalPositions[i3] + (newVertex.x - originalPositions[i3]) * blend,
        originalPositions[i3 + 1] + (newVertex.y - originalPositions[i3 + 1]) * blend,
        originalPositions[i3 + 2] + (newVertex.z - originalPositions[i3 + 2]) * blend
      );
    }

    positionAttr.needsUpdate = true;
    geometry.computeVertexNormals(); // Recompute normals for proper lighting
    return true;
  }

  /**
   * Apply wave/wind effect to hair vertices
   */
  applyHairWaveEffect(
    objectName: string,
    options: {
      amplitude?: number;      // Wave height
      frequency?: number;      // Wave speed
      wavelength?: number;     // Wave spacing
      direction?: THREE.Vector3; // Wave direction
      time?: number;          // Animation time
      blend?: number;         // Blend factor (0-1)
    } = {}
  ): boolean {
    const {
      amplitude = 0.1,
      frequency = 1.0,
      wavelength = 1.0,
      direction = new THREE.Vector3(1, 0, 0),
      time = 0,
      blend = 1.0,
    } = options;

    const normalizedDir = direction.clone().normalize();

    return this.applyHairVertexDisplacement(
      objectName,
      (vertex, _index) => {
        // Calculate distance along wave direction
        const distance = vertex.dot(normalizedDir);

        // Apply sine wave
        const wave = Math.sin(distance * wavelength + time * frequency) * amplitude;

        // Displace along Y-axis (upward wave)
        return new THREE.Vector3(
          vertex.x,
          vertex.y + wave,
          vertex.z
        );
      },
      blend
    );
  }

  /**
   * Apply gravity/droop effect to hair vertices
   */
  applyHairGravityEffect(
    objectName: string,
    options: {
      strength?: number;       // Gravity strength
      direction?: THREE.Vector3; // Gravity direction
      falloff?: number;        // Distance falloff
      pivot?: THREE.Vector3;   // Pivot point (hair root)
      blend?: number;
    } = {}
  ): boolean {
    const {
      strength = 0.5,
      direction = new THREE.Vector3(0, -1, 0),
      falloff = 1.0,
      pivot = new THREE.Vector3(0, 0, 0),
      blend = 1.0,
    } = options;

    const normalizedDir = direction.clone().normalize();

    return this.applyHairVertexDisplacement(
      objectName,
      (vertex, _index) => {
        // Calculate distance from pivot (hair root)
        const distance = vertex.distanceTo(pivot);

        // Apply falloff (more effect further from root)
        const falloffFactor = Math.pow(distance * falloff, 2);

        // Apply gravity displacement
        const displacement = normalizedDir.clone().multiplyScalar(strength * falloffFactor);

        return vertex.clone().add(displacement);
      },
      blend
    );
  }

  /**
   * Apply curl/twist effect to hair vertices
   */
  applyHairCurlEffect(
    objectName: string,
    options: {
      intensity?: number;      // Curl intensity
      radius?: number;         // Curl radius
      axis?: THREE.Vector3;    // Curl axis
      center?: THREE.Vector3;  // Center point
      blend?: number;
    } = {}
  ): boolean {
    const {
      intensity = 1.0,
      radius = 0.5,
      axis = new THREE.Vector3(0, 1, 0),
      center = new THREE.Vector3(0, 0, 0),
      blend = 1.0,
    } = options;

    const normalizedAxis = axis.clone().normalize();

    return this.applyHairVertexDisplacement(
      objectName,
      (vertex, _index) => {
        // Vector from center to vertex
        const toVertex = vertex.clone().sub(center);

        // Project onto axis to get height
        const height = toVertex.dot(normalizedAxis);

        // Get perpendicular component
        const perpendicular = toVertex.clone().sub(
          normalizedAxis.clone().multiplyScalar(height)
        );

        // Apply rotation around axis based on height
        const angle = height * intensity;
        const rotatedPerp = perpendicular.clone()
          .applyAxisAngle(normalizedAxis, angle);

        // Scale by radius
        rotatedPerp.multiplyScalar(radius);

        // Reconstruct position
        return center.clone()
          .add(normalizedAxis.clone().multiplyScalar(height))
          .add(rotatedPerp);
      },
      blend
    );
  }

  /**
   * Reset hair geometry to original positions
   */
  resetHairGeometry(objectName: string): boolean {
    const object = this.model?.getObjectByName(objectName);
    if (!object || !(object as THREE.Mesh).isMesh) return false;

    const mesh = object as THREE.Mesh;
    const geometry = mesh.geometry;
    const positionAttr = geometry.attributes.position;

    if (!positionAttr || !geometry.userData.originalPositions) return false;

    const originalPositions = geometry.userData.originalPositions as Float32Array;
    positionAttr.array.set(originalPositions);
    positionAttr.needsUpdate = true;
    geometry.computeVertexNormals();
    return true;
  }

  /**
   * Apply custom vertex shader displacement to hair
   * Useful for GPU-accelerated hair effects
   */
  applyHairVertexShader(
    objectName: string,
    shaderCode: string
  ): boolean {
    const object = this.model?.getObjectByName(objectName);
    if (!object || !(object as THREE.Mesh).isMesh) return false;

    const mesh = object as THREE.Mesh;

    // Store original material
    if (!mesh.userData.originalMaterial) {
      mesh.userData.originalMaterial = mesh.material;
    }

    // Create custom shader material
    const material = mesh.material as THREE.MeshStandardMaterial;

    // Clone material and add custom vertex shader
    const customMaterial = material.clone();
    customMaterial.onBeforeCompile = (shader) => {
      // Inject custom vertex shader code
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        shaderCode + '\n#include <begin_vertex>'
      );
    };

    mesh.material = customMaterial;
    return true;
  }

  // ========================================
  // End Hair & Eyebrow Control
  // ========================================

  private logResolvedOnce = (bones: ResolvedBones) => {
    // Log all available shape keys (morph targets) in the model
    console.group('[EngineThree] 🔍 MODEL SHAPE KEYS INVENTORY');
    const allMorphKeys = new Set<string>();
    for (const m of this.meshes) {
      const dict: any = (m as any).morphTargetDictionary;
      if (!dict) continue;
      const keys = Object.keys(dict).sort();
      console.log(`📦 Mesh "${m.name || 'unnamed'}" has ${keys.length} shape keys`);

      // Log hair mesh keys in detail
      if (m.name && (m.name.includes('Side_part_wavy') || m.name.toLowerCase().includes('hair'))) {
        console.log(`   💇 Hair morph keys for ${m.name}:`, keys);
      }

      keys.forEach(k => allMorphKeys.add(k));
    }
    console.log(`\n✅ Total unique shape keys: ${allMorphKeys.size}`);
    console.log('All shape keys:', Array.from(allMorphKeys).sort());
    console.groupEnd();

    // Log which bones were successfully resolved
    console.group('[EngineThree] ✅ RESOLVED BONES');
    Object.entries(bones).forEach(([key, value]) => {
      if (value) console.log(`  ${key}: ${value.obj.name}`);
    });
    console.groupEnd();
  };

  // Filter L/R morph keys for an AU by suffix (e.g., *_L, *_R)
  private keysForSide(au: number, side: 'L' | 'R'): string[] {
    const keys = AU_TO_MORPHS[au] || [];
    const suffix = side === 'L' ? /(^|_)L$/ : /(^|_)R$/;
    return keys.filter(k => suffix.test(k));
  }

  // ========================================
  // Proper AnimationMixer-based Morph Animations
  // Works directly on real model geometry, not dummy objects
  // ========================================

  private morphMixer: THREE.AnimationMixer | null = null;
  private morphActions = new Map<string, THREE.AnimationAction>();

  /**
   * Initialize the morph animation mixer on the actual model.
   * Call this after onReady when model is loaded.
   */
  initMorphMixer = () => {
    if (!this.model) {
      console.warn('[EngineThree] Cannot init morph mixer - no model loaded');
      return false;
    }
    this.morphMixer = new THREE.AnimationMixer(this.model);
    this.morphActions.clear();
    console.log('[EngineThree] ✅ Morph mixer initialized on model:', this.model.name);
    return true;
  };

  /**
   * Create a morph target animation clip.
   * @param name - Clip name
   * @param morphKey - The morph target key (e.g., 'Mouth_Smile_L')
   * @param keyframes - Array of {time, value} keyframes
   * @param meshName - Optional: target specific mesh, otherwise animates all meshes with this morph
   */
  createMorphClip = (
    name: string,
    morphKey: string,
    keyframes: Array<{ time: number; value: number }>,
    meshName?: string
  ): THREE.AnimationClip | null => {
    if (!this.meshes.length) {
      console.warn('[EngineThree] No meshes available for morph clip');
      return null;
    }

    const times = keyframes.map(k => k.time);
    const values = keyframes.map(k => k.value);

    const tracks: THREE.KeyframeTrack[] = [];

    // Find meshes that have this morph target
    for (const mesh of this.meshes) {
      if (meshName && mesh.name !== meshName) continue;

      const dict = (mesh as any).morphTargetDictionary;
      if (!dict) continue;

      const morphIndex = dict[morphKey];
      if (morphIndex !== undefined) {
        // Three.js morph target track path format: "meshName.morphTargetInfluences[index]"
        const trackName = `${mesh.name}.morphTargetInfluences[${morphIndex}]`;
        const track = new THREE.NumberKeyframeTrack(trackName, times, values);
        tracks.push(track);
      }
    }

    if (tracks.length === 0) {
      console.warn(`[EngineThree] No meshes found with morph target: ${morphKey}`);
      return null;
    }

    const clip = new THREE.AnimationClip(name, -1, tracks);
    console.log(`[EngineThree] Created morph clip "${name}" with ${tracks.length} tracks for "${morphKey}"`);
    return clip;
  };

  /**
   * Create a multi-morph animation clip (multiple morphs animated together).
   * @param name - Clip name
   * @param morphAnimations - Array of {morphKey, keyframes} objects
   */
  createMultiMorphClip = (
    name: string,
    morphAnimations: Array<{
      morphKey: string;
      keyframes: Array<{ time: number; value: number }>;
    }>
  ): THREE.AnimationClip | null => {
    const tracks: THREE.KeyframeTrack[] = [];

    for (const { morphKey, keyframes } of morphAnimations) {
      const times = keyframes.map(k => k.time);
      const values = keyframes.map(k => k.value);

      for (const mesh of this.meshes) {
        const dict = (mesh as any).morphTargetDictionary;
        if (!dict) continue;

        const morphIndex = dict[morphKey];
        if (morphIndex !== undefined) {
          const trackName = `${mesh.name}.morphTargetInfluences[${morphIndex}]`;
          const track = new THREE.NumberKeyframeTrack(trackName, times, values);
          tracks.push(track);
        }
      }
    }

    if (tracks.length === 0) {
      console.warn(`[EngineThree] No tracks created for multi-morph clip "${name}"`);
      return null;
    }

    const clip = new THREE.AnimationClip(name, -1, tracks);
    console.log(`[EngineThree] Created multi-morph clip "${name}" with ${tracks.length} tracks`);
    return clip;
  };

  /**
   * Play a morph animation clip.
   * @param clip - The animation clip to play
   * @param options - Playback options
   */
  playMorphClip = (
    clip: THREE.AnimationClip,
    options: {
      loop?: boolean;
      clampWhenFinished?: boolean;
      timeScale?: number;
      fadeIn?: number;
    } = {}
  ): THREE.AnimationAction | null => {
    if (!this.morphMixer) {
      console.warn('[EngineThree] Morph mixer not initialized. Call initMorphMixer() first.');
      return null;
    }

    const { loop = false, clampWhenFinished = true, timeScale = 1, fadeIn = 0 } = options;

    const action = this.morphMixer.clipAction(clip);
    action.loop = loop ? THREE.LoopRepeat : THREE.LoopOnce;
    action.clampWhenFinished = clampWhenFinished;
    action.timeScale = timeScale;

    if (fadeIn > 0) {
      action.fadeIn(fadeIn);
    }

    action.reset();
    action.play();

    this.morphActions.set(clip.name, action);
    console.log(`[EngineThree] Playing morph clip: ${clip.name}`);
    return action;
  };

  /**
   * Stop a playing morph animation.
   */
  stopMorphClip = (clipName: string, fadeOut: number = 0) => {
    const action = this.morphActions.get(clipName);
    if (!action) return;

    if (fadeOut > 0) {
      action.fadeOut(fadeOut);
    } else {
      action.stop();
    }
  };

  /**
   * Stop all morph animations.
   */
  stopAllMorphClips = () => {
    this.morphActions.forEach(action => action.stop());
    this.morphActions.clear();
  };

  /**
   * Update the morph mixer. Call this in your animation loop.
   * This is separate from the main update() which handles the driver-based system.
   */
  updateMorphMixer = (deltaSeconds: number) => {
    this.morphMixer?.update(deltaSeconds);
  };

  // ========================================
  // Test functions for App.tsx
  // ========================================

  /**
   * Test: Create and play a simple smile animation.
   * Call this from App.tsx to verify the system works.
   */
  testSmileAnimation = () => {
    if (!this.initMorphMixer()) return;

    const clip = this.createMultiMorphClip('test_smile', [
      {
        morphKey: 'Mouth_Smile_L',
        keyframes: [
          { time: 0, value: 0 },
          { time: 0.5, value: 1 },
          { time: 1, value: 1 },
          { time: 1.5, value: 0 },
        ]
      },
      {
        morphKey: 'Mouth_Smile_R',
        keyframes: [
          { time: 0, value: 0 },
          { time: 0.5, value: 1 },
          { time: 1, value: 1 },
          { time: 1.5, value: 0 },
        ]
      }
    ]);

    if (clip) {
      this.playMorphClip(clip, { loop: true });
      console.log('[EngineThree] 🎭 Test smile animation started! Call engine.stopAllMorphClips() to stop.');
    }
  };

  /**
   * Test: Create and play a blink animation.
   */
  testBlinkAnimation = () => {
    if (!this.morphMixer && !this.initMorphMixer()) return;

    const clip = this.createMultiMorphClip('test_blink', [
      {
        morphKey: 'Eye_Blink_L',
        keyframes: [
          { time: 0, value: 0 },
          { time: 0.1, value: 1 },
          { time: 0.2, value: 0 },
        ]
      },
      {
        morphKey: 'Eye_Blink_R',
        keyframes: [
          { time: 0, value: 0 },
          { time: 0.1, value: 1 },
          { time: 0.2, value: 0 },
        ]
      }
    ]);

    if (clip) {
      this.playMorphClip(clip, { loop: true, timeScale: 0.5 });
      console.log('[EngineThree] 👁️ Test blink animation started!');
    }
  };

  /**
   * Test: Play an AU-based animation using COMPOSITE_ROTATIONS data.
   * Demonstrates animating a continuum axis (e.g., head yaw).
   */
  testHeadAnimation = () => {
    if (!this.morphMixer && !this.initMorphMixer()) return;

    // Get head yaw morphs from AU_TO_MORPHS
    const leftMorphs = AU_TO_MORPHS[31] || []; // Head Turn Left
    const rightMorphs = AU_TO_MORPHS[32] || []; // Head Turn Right

    const morphAnims: Array<{ morphKey: string; keyframes: Array<{ time: number; value: number }> }> = [];

    // Animate left turn morphs
    leftMorphs.forEach(morphKey => {
      morphAnims.push({
        morphKey,
        keyframes: [
          { time: 0, value: 0 },
          { time: 1, value: 0.7 },
          { time: 2, value: 0 },
          { time: 3, value: 0 },
        ]
      });
    });

    // Animate right turn morphs
    rightMorphs.forEach(morphKey => {
      morphAnims.push({
        morphKey,
        keyframes: [
          { time: 0, value: 0 },
          { time: 1, value: 0 },
          { time: 2, value: 0 },
          { time: 3, value: 0.7 },
          { time: 4, value: 0 },
        ]
      });
    });

    const clip = this.createMultiMorphClip('test_head_turn', morphAnims);
    if (clip) {
      this.playMorphClip(clip, { loop: true });
      console.log('[EngineThree] 🙂 Test head turn animation started!');
    }
  };

  /**
   * Looping smile animation targeting only body meshes using CC4_MESHES.
   * Creates tracks directly on the 6 body meshes.
   */
  testBodySmile = () => {
    if (!this.morphMixer && !this.initMorphMixer()) return;

    // Get body mesh names from CC4_MESHES
    const bodyMeshNames = Object.entries(CC4_MESHES)
      .filter(([_, info]) => info.category === 'body')
      .map(([name]) => name);

    console.log('[EngineThree] Body meshes:', bodyMeshNames);

    const tracks: THREE.KeyframeTrack[] = [];
    const times = [0, 0.5, 1.5, 2];
    const values = [0, 1, 1, 0];

    // For each body mesh, create tracks for smile morphs
    for (const meshName of bodyMeshNames) {
      const mesh = this.meshes.find(m => m.name === meshName);
      if (!mesh) continue;

      const dict = (mesh as any).morphTargetDictionary;
      if (!dict) continue;

      // Add Mouth_Smile_L track
      const smileLIdx = dict['Mouth_Smile_L'];
      if (smileLIdx !== undefined) {
        tracks.push(new THREE.NumberKeyframeTrack(
          `${meshName}.morphTargetInfluences[${smileLIdx}]`,
          times,
          values
        ));
      }

      // Add Mouth_Smile_R track
      const smileRIdx = dict['Mouth_Smile_R'];
      if (smileRIdx !== undefined) {
        tracks.push(new THREE.NumberKeyframeTrack(
          `${meshName}.morphTargetInfluences[${smileRIdx}]`,
          times,
          values
        ));
      }
    }

    if (tracks.length === 0) {
      console.warn('[EngineThree] No smile morphs found on body meshes');
      return;
    }

    const clip = new THREE.AnimationClip('body_smile', -1, tracks);
    console.log(`[EngineThree] Created body smile clip with ${tracks.length} tracks`);

    this.playMorphClip(clip, { loop: true });
    console.log('[EngineThree] 😊 Body smile animation started! Call engine.stopAllMorphClips() to stop.');
  };

  // ========================================
  // MOUSE TRACKING / LOOK AT
  // Character follows mouse cursor with head, neck, and eyes
  // Based on: https://tympanus.net/codrops/2019/10/14/how-to-create-an-interactive-3d-character-with-three-js/
  // ========================================

  private mouseTrackingEnabled = false;
  private mousePosition = { x: 0.5, y: 0.5 }; // Normalized 0-1 screen coords
  private mouseMoveHandler: ((e: MouseEvent) => void) | null = null;

  /**
   * Enable mouse tracking - character will look at the mouse cursor.
   * Head, neck, and eyes will smoothly follow the cursor.
   */
  enableMouseTracking = () => {
    if (this.mouseTrackingEnabled) return;

    this.mouseMoveHandler = (e: MouseEvent) => {
      // Normalize to 0-1 range (0,0 = top-left, 1,1 = bottom-right)
      this.mousePosition.x = e.clientX / window.innerWidth;
      this.mousePosition.y = e.clientY / window.innerHeight;
    };

    window.addEventListener('mousemove', this.mouseMoveHandler);
    this.mouseTrackingEnabled = true;
    console.log('[EngineThree] 👀 Mouse tracking enabled');
  };

  /**
   * Disable mouse tracking
   */
  disableMouseTracking = () => {
    if (!this.mouseTrackingEnabled) return;

    if (this.mouseMoveHandler) {
      window.removeEventListener('mousemove', this.mouseMoveHandler);
      this.mouseMoveHandler = null;
    }

    this.mouseTrackingEnabled = false;
    console.log('[EngineThree] Mouse tracking disabled');
  };

  /**
   * Get rotation degrees based on mouse position.
   * Returns how many degrees to rotate on X and Y axes.
   * @param degreeLimit - Maximum rotation in degrees
   */
  private getMouseDegrees(degreeLimit: number): { x: number; y: number } {
    // Convert from 0-1 to -1 to 1 (center = 0)
    const dx = (this.mousePosition.x - 0.5) * 2; // -1 (left) to 1 (right)
    const dy = (this.mousePosition.y - 0.5) * 2; // -1 (top) to 1 (bottom)

    // Scale by degree limit
    return {
      x: dx * degreeLimit,  // Yaw (left/right)
      y: dy * degreeLimit   // Pitch (up/down)
    };
  }

  /**
   * Apply mouse tracking to joints.
   * Call this in your animation loop or update function.
   */
  updateMouseTracking = () => {
    if (!this.mouseTrackingEnabled) return;
    if (!this.bones.HEAD || !this.bones.NECK) return;

    const headBone = this.bones.HEAD.obj;
    const neckBone = this.bones.NECK.obj;
    const leftEye = this.bones.EYE_L?.obj;
    const rightEye = this.bones.EYE_R?.obj;

    // Get rotation amounts for different body parts
    const headDegrees = this.getMouseDegrees(25);  // Head moves most
    const neckDegrees = this.getMouseDegrees(15);  // Neck moves less
    const eyeDegrees = this.getMouseDegrees(20);   // Eyes can move more than neck

    // Apply to head (yaw and pitch)
    if (headBone) {
      const base = this.bones.HEAD.baseEuler;
      headBone.rotation.y = base.y + THREE.MathUtils.degToRad(headDegrees.x);
      headBone.rotation.x = base.x + THREE.MathUtils.degToRad(headDegrees.y);
    }

    // Apply to neck (less movement)
    if (neckBone) {
      const base = this.bones.NECK.baseEuler;
      neckBone.rotation.y = base.y + THREE.MathUtils.degToRad(neckDegrees.x);
      neckBone.rotation.x = base.x + THREE.MathUtils.degToRad(neckDegrees.y);
    }

    // Apply to eyes (they can move more freely)
    if (leftEye) {
      const base = this.bones.EYE_L!.baseEuler;
      // Eyes rotate on Z for yaw in CC4 rigs
      leftEye.rotation.z = base.z + THREE.MathUtils.degToRad(-eyeDegrees.x);
      leftEye.rotation.x = base.x + THREE.MathUtils.degToRad(eyeDegrees.y);
    }
    if (rightEye) {
      const base = this.bones.EYE_R!.baseEuler;
      rightEye.rotation.z = base.z + THREE.MathUtils.degToRad(-eyeDegrees.x);
      rightEye.rotation.x = base.x + THREE.MathUtils.degToRad(eyeDegrees.y);
    }
  };

  /**
   * Smoothly interpolated mouse tracking (call this in update loop).
   * Uses lerp for smoother, more natural movement.
   */
  private targetRotations = {
    head: { x: 0, y: 0 },
    neck: { x: 0, y: 0 },
    eyes: { x: 0, y: 0 }
  };
  private currentRotations = {
    head: { x: 0, y: 0 },
    neck: { x: 0, y: 0 },
    eyes: { x: 0, y: 0 }
  };

  updateMouseTrackingSmooth = (lerpFactor = 0.1) => {
    if (!this.mouseTrackingEnabled) return;
    if (!this.bones.HEAD || !this.bones.NECK) return;

    // Calculate target rotations
    const headDegrees = this.getMouseDegrees(25);
    const neckDegrees = this.getMouseDegrees(15);
    const eyeDegrees = this.getMouseDegrees(30);

    this.targetRotations.head = headDegrees;
    this.targetRotations.neck = neckDegrees;
    this.targetRotations.eyes = eyeDegrees;

    // Lerp current toward target
    this.currentRotations.head.x += (this.targetRotations.head.x - this.currentRotations.head.x) * lerpFactor;
    this.currentRotations.head.y += (this.targetRotations.head.y - this.currentRotations.head.y) * lerpFactor;
    this.currentRotations.neck.x += (this.targetRotations.neck.x - this.currentRotations.neck.x) * lerpFactor;
    this.currentRotations.neck.y += (this.targetRotations.neck.y - this.currentRotations.neck.y) * lerpFactor;
    this.currentRotations.eyes.x += (this.targetRotations.eyes.x - this.currentRotations.eyes.x) * lerpFactor * 1.5; // Eyes move faster
    this.currentRotations.eyes.y += (this.targetRotations.eyes.y - this.currentRotations.eyes.y) * lerpFactor * 1.5;

    // Apply rotations
    const headBone = this.bones.HEAD.obj;
    const neckBone = this.bones.NECK.obj;
    const leftEye = this.bones.EYE_L?.obj;
    const rightEye = this.bones.EYE_R?.obj;

    if (headBone) {
      const base = this.bones.HEAD.baseEuler;
      headBone.rotation.y = base.y + THREE.MathUtils.degToRad(this.currentRotations.head.x);
      headBone.rotation.x = base.x + THREE.MathUtils.degToRad(this.currentRotations.head.y);
    }

    if (neckBone) {
      const base = this.bones.NECK.baseEuler;
      neckBone.rotation.y = base.y + THREE.MathUtils.degToRad(this.currentRotations.neck.x);
      neckBone.rotation.x = base.x + THREE.MathUtils.degToRad(this.currentRotations.neck.y);
    }

    if (leftEye) {
      const base = this.bones.EYE_L!.baseEuler;
      leftEye.rotation.z = base.z + THREE.MathUtils.degToRad(-this.currentRotations.eyes.x);
      leftEye.rotation.x = base.x + THREE.MathUtils.degToRad(this.currentRotations.eyes.y);
    }
    if (rightEye) {
      const base = this.bones.EYE_R!.baseEuler;
      rightEye.rotation.z = base.z + THREE.MathUtils.degToRad(-this.currentRotations.eyes.x);
      rightEye.rotation.x = base.x + THREE.MathUtils.degToRad(this.currentRotations.eyes.y);
    }
  };

  // ============================================================================
  // SKYBOX CONTROL METHODS
  // ============================================================================

  /** Rotate skybox by degrees (0-360) */
  setSkyboxRotation = (degrees: number) => {
    if (this.skyboxTexture) {
      // Convert degrees to texture offset (0-360 maps to 0-1)
      this.skyboxTexture.offset.x = degrees / 360;
      this.skyboxTexture.needsUpdate = true;
    }
  };

  /** Set skybox blur (0-1) */
  setSkyboxBlur = (blur: number) => {
    if (this.scene) {
      this.scene.backgroundBlurriness = Math.max(0, Math.min(1, blur));
    }
  };

  /** Set skybox intensity (0-2) */
  setSkyboxIntensity = (intensity: number) => {
    if (this.scene) {
      this.scene.backgroundIntensity = Math.max(0, Math.min(2, intensity));
    }
  };

  /** Check if skybox is ready */
  isSkyboxReady = (): boolean => {
    return this.skyboxTexture !== null && this.scene !== null;
  };

  // ========================================
  // PERFORMANCE TESTING
  // ========================================

  /**
   * Compare performance of transitionAU vs transitionAUOptimized.
   * Runs many transitions and logs timing.
   */
  benchmarkTransitions = (iterations = 100) => {
    console.log(`[EngineThree] 🏎️ Benchmarking ${iterations} iterations...`);

    // Test AUs: 12 (smile), 31 (head left), 61 (eyes left)
    const testAUs = [12, 31, 61];

    // Benchmark original transitionAU
    const startOrig = performance.now();
    for (let i = 0; i < iterations; i++) {
      for (const au of testAUs) {
        this.transitionAU(au, i % 2 === 0 ? 0.8 : 0.2, 10);
      }
    }
    const timeOrig = performance.now() - startOrig;

    // Clear transitions
    this.clearTransitions();
    this.resetToNeutral();

    // Benchmark optimized transitionAUOptimized
    const startOpt = performance.now();
    for (let i = 0; i < iterations; i++) {
      for (const au of testAUs) {
        this.transitionAUOptimized(au, i % 2 === 0 ? 0.8 : 0.2, 10);
      }
    }
    const timeOpt = performance.now() - startOpt;

    // Clear transitions
    this.clearTransitions();
    this.resetToNeutral();

    console.log(`[EngineThree] 📊 Benchmark Results:`);
    console.log(`  Original transitionAU:   ${timeOrig.toFixed(2)}ms`);
    console.log(`  Optimized transitionAU:  ${timeOpt.toFixed(2)}ms`);
    console.log(`  Speedup: ${(timeOrig / timeOpt).toFixed(2)}x`);

    return { original: timeOrig, optimized: timeOpt };
  };

  /**
   * Test the optimized transition visually - run a smile animation.
   */
  testOptimizedSmile = () => {
    console.log('[EngineThree] 😊 Testing optimized smile transition...');

    // Sequence: smile on, hold, smile off
    this.transitionAUOptimized(12, 0.9, 400);

    setTimeout(() => {
      this.transitionAUOptimized(12, 0, 400);
    }, 1000);
  };

  /**
   * Test the optimized transition for head turn.
   */
  testOptimizedHeadTurn = () => {
    console.log('[EngineThree] 🔄 Testing optimized head turn transition...');

    // Turn left
    this.transitionAUOptimized(31, 0.7, 500);

    setTimeout(() => {
      // Back to center
      this.transitionAUOptimized(31, 0, 500);

      setTimeout(() => {
        // Turn right
        this.transitionAUOptimized(32, 0.7, 500);

        setTimeout(() => {
          // Back to center
          this.transitionAUOptimized(32, 0, 500);
        }, 1000);
      }, 600);
    }, 1000);
  };
}

function clamp01(x: number) { return x < 0 ? 0 : x > 1 ? 1 : x; }
