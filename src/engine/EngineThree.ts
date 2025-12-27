import * as THREE from 'three';
import {
  AU_TO_MORPHS,
  BONE_AU_TO_BINDINGS,
  AU_MIX_DEFAULTS,
  CC4_BONE_NODES,
  CC4_EYE_MESH_NODES,
  CC4_MESHES,
  VISEME_KEYS,
  isMixedAU,
  MORPH_TO_MESH,
  AU_INFO,
} from './arkit/shapeDict';
import type {
  TransitionHandle,
  ResolvedBones,
  BoneKey,
  NodeBase,
  RotationsState,
} from './EngineThree.types';
import { ThreeAnimation } from './ThreeAnimation';

// ============================================================================
// DERIVED CONSTANTS - computed from shapeDict core data
// ============================================================================

/** All AU IDs that have bone bindings */
export const BONE_DRIVEN_AUS = new Set(Object.keys(BONE_AU_TO_BINDINGS).map(Number));

/** All bone keys used in AU bindings (derived from BONE_AU_TO_BINDINGS) */
const ALL_BONE_KEYS = Array.from(
  new Set(
    Object.values(BONE_AU_TO_BINDINGS)
      .flat()
      .map(binding => binding.node)
  )
) as BoneKey[];

const X_AXIS = new THREE.Vector3(1,0,0);
const Y_AXIS = new THREE.Vector3(0,1,0);
const Z_AXIS = new THREE.Vector3(0,0,1);
const deg2rad = (d: number) => (d * Math.PI) / 180;

// Primary face mesh name for AU/viseme morphs - derived from shapeDict mapping
const FACE_MESH_NAME_DEFAULT = MORPH_TO_MESH.face[0] || 'CC_Base_Body_1';

export class EngineThree {
  private auValues: Record<number, number> = {};

  // Unified transition system - delegated to ThreeAnimation
  private animation = new ThreeAnimation();

  private rigReady = false;
  private missingBoneWarnings = new Set<string>();

  // Skybox storage
  private scene: THREE.Scene | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private skyboxTexture: THREE.Texture | null = null;

  // Unified rotation state tracking for bones
  // Each axis stores value (signed, with scale applied) and maxRadians for rendering
  private rotations: RotationsState = {};

  // Nodes with pending rotation changes - applied once per frame in update()
  private pendingCompositeNodes = new Set<string>();
  private isPaused: boolean = false;

  // Optional translation offsets for composite bones (tx/ty/tz), in model units.
  // Used for AUs that drive bone translations (e.g., Tongue_Out, Jaw_Forward).
  private translations: Record<string, { x: number; y: number; z: number }> = {};

  // Primary face mesh used for all AU and viseme morphs (CC_Base_Body_1)
  private faceMeshName: string | null = FACE_MESH_NAME_DEFAULT;
  private faceMesh: THREE.Mesh | null = null;

  // Internal RAF loop - EngineThree owns the frame loop
  private clock = new THREE.Clock();
  private rafId: number | null = null;
  private running = false;

  // Morph index cache: morphKey → array of { influences array, index }
  // Stores multiple targets since a morph like browInnerUp exists in face + eyebrow meshes
  private morphCache = new Map<string, { infl: number[], idx: number }[]>();

  // Mesh lookup by name - populated from MORPH_TO_MESH mesh names
  // Used by setMorph to quickly find the right mesh for each morph category
  private meshByName = new Map<string, THREE.Mesh>();


  /**
   * Compute per-side AU values given a base intensity and optional L/R balance.
   * - balance = -1 → left = base, right = 0
   * - balance =  0 → left = base, right = base
   * - balance = +1 → left = 0, right = base
   */
  private computeSideValues(base: number, balance?: number): { left: number; right: number } {
    const b = Math.max(-1, Math.min(1, balance ?? 0));
    if (b === 0) {
      return { left: base, right: base };
    }
    if (b < 0) {
      // Negative balance → reduce right side
      return { left: base, right: base * (1 + b) };
    }
    // Positive balance → reduce left side
    return { left: base * (1 - b), right: base };
  }

  // ============================================================================
  // OPTIMIZED TRANSITION SYSTEM
  // Pre-resolves morph indices and bone references at transition creation time
  // ============================================================================

  /**
   * Get the correct mesh names for an AU based on its facePart.
   * Routes morphs to the appropriate mesh(es) based on AU_INFO metadata.
   */
  private getMeshNamesForAU(auId: number): string[] {
    const info = AU_INFO[String(auId)];
    if (!info?.facePart) return MORPH_TO_MESH.face;

    switch (info.facePart) {
      case 'Tongue':
        return MORPH_TO_MESH.tongue;
      case 'Eye':
        return MORPH_TO_MESH.eye;
      default:
        return MORPH_TO_MESH.face;
    }
  }

  /**
   * Read current morph value from the specified mesh set.
   * For face AUs/visemes this defaults to the face mesh + brows.
   */
  private getMorphValue(key: string, meshNames: string[] = MORPH_TO_MESH.face): number {
    // Fast path for face AUs/visemes: read directly from primary face mesh.
    if (this.faceMesh) {
      const dict: any = (this.faceMesh as any).morphTargetDictionary;
      const infl: any = (this.faceMesh as any).morphTargetInfluences;
      if (dict && infl) {
        const idx = dict[key];
        if (idx !== undefined) return infl[idx] ?? 0;
      }
      // If the face mesh doesn't have this morph, treat as 0 for AU/viseme purposes.
      return 0;
    }

    // Scan all meshes for the morph key
    for (const mesh of this.meshes) {
      const dict: any = (mesh as any).morphTargetDictionary;
      const infl: any = (mesh as any).morphTargetInfluences;
      if (!dict || !infl) continue;
      const idx = dict[key];
      if (idx !== undefined) return infl[idx] ?? 0;
    }

    return 0;
  }
  /** Start the internal RAF loop */
  start() {
    if (this.running) return;
    this.running = true;
    this.clock.start();

    const tick = () => {
      if (!this.running) return;
      const dt = this.clock.getDelta();

      // Update transitions and composite rotations
      this.update(dt);

      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  /** Stop the internal RAF loop */
  stop() {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.clock.stop();
  }

  /** Dispose engine resources */
  dispose() {
    this.stop();
    this.clearTransitions();
  }
  /**
   * Smoothly tween an AU to a target value.
   * For continuum pairs (e.g., AU 41/42 tongue tilt), supports -1 to +1 range:
   * - Negative values activate the paired AU
   * - Positive values activate this AU
   */
  /**
   * Smoothly tween an AU to a target value.
   * For continuum pairs (e.g., AU 41/42 tongue tilt), supports -1 to +1 range.
   *
   * @param id - AU ID (number) or string with side suffix ('12L', '12R')
   * @param to - Target intensity value
   * @param durationMs - Transition duration in milliseconds
   * @param balance - Optional left/right balance: -1 = left only, 0 = both equally, +1 = right only
   */
  transitionAU = (id: number | string, to: number, durationMs = 200, balance?: number): TransitionHandle => {
    const numId = typeof id === 'string' ? Number(id.replace(/[^\d]/g, '')) : id;
    const target = clamp01(to);

    // Get morph keys and bone bindings directly from shape dict
    const morphKeys = AU_TO_MORPHS[numId] || [];
    const bindings = BONE_AU_TO_BINDINGS[numId] || [];

    // Mix weight applies only to morph overlay (not bones)
    const mixWeight = isMixedAU(numId) ? this.getAUMixWeight(numId) : 1.0;
    const base = target * mixWeight;

    // Calculate per-side values using shared helper
    const { left: leftVal, right: rightVal } = this.computeSideValues(base, balance);

    this.auValues[numId] = target;

    const handles: TransitionHandle[] = [];

    // Get correct mesh names for this AU (tongue AUs go to tongue mesh, face AUs to face mesh)
    const meshNames = this.getMeshNamesForAU(numId);

    // Transition morphs - split into left/right/center by name
    const leftKeys = morphKeys.filter(k => /(_L$|Left$)/.test(k));
    const rightKeys = morphKeys.filter(k => /(_R$|Right$)/.test(k));
    const centerKeys = morphKeys.filter(k => !/(_L$|Left$|_R$|Right$)/.test(k));

    if (leftKeys.length || rightKeys.length) {
      for (const k of leftKeys) {
        handles.push(this.transitionMorph(k, leftVal, durationMs, meshNames));
      }
      for (const k of rightKeys) {
        handles.push(this.transitionMorph(k, rightVal, durationMs, meshNames));
      }
    } else {
      // No explicit L/R split – treat all as center
      centerKeys.push(...morphKeys);
    }

    for (const k of centerKeys) {
      handles.push(this.transitionMorph(k, base, durationMs, meshNames));
    }

    // Transition bones - handle both rotation (rx/ry/rz) and translation (tx/ty/tz) channels
    for (const binding of bindings) {
      if (binding.channel === 'rx' || binding.channel === 'ry' || binding.channel === 'rz') {
        // Rotation channel
        const axis = binding.channel === 'rx' ? 'pitch' : binding.channel === 'ry' ? 'yaw' : 'roll';
        handles.push(this.transitionBoneRotation(
          binding.node,
          axis,
          target * binding.scale,
          binding.maxDegrees ?? 0,
          durationMs
        ));
      } else if (binding.channel === 'tx' || binding.channel === 'ty' || binding.channel === 'tz') {
        // Translation channel
        if (binding.maxUnits !== undefined) {
          handles.push(this.transitionBoneTranslation(
            binding.node,
            binding.channel,
            target * binding.scale,
            binding.maxUnits,
            durationMs
          ));
        }
      }
    }

    return this.combineHandles(handles);
  };

  /** Smoothly tween a morph to a target value */
  transitionMorph = (key: string, to: number, durationMs = 120, meshNames: string[] = MORPH_TO_MESH.face): TransitionHandle => {
    const transitionKey = `morph_${key}`;
    const from = this.getMorphValue(key, meshNames);
    const target = clamp01(to);
    return this.animation.addTransition(
      transitionKey,
      from,
      target,
      durationMs,
      (value) => this.setMorph(key, value, meshNames)
    );
  };

  /**
   * Smoothly transition a composite bone rotation axis.
   * Value should already have scale applied. maxDegrees from binding.
   */
  private transitionBoneRotation = (
    nodeKey: string,
    axis: 'pitch' | 'yaw' | 'roll',
    to: number,
    maxDegrees: number,
    durationMs = 200
  ): TransitionHandle => {
    const transitionKey = `bone_${nodeKey}_${axis}`;
    const from = this.rotations[nodeKey]?.[axis]?.value ?? 0;
    const target = Math.max(-1, Math.min(1, to));
    return this.animation.addTransition(
      transitionKey,
      from,
      target,
      durationMs,
      (value) => this.updateBoneRotation(nodeKey, axis, value, maxDegrees)
    );
  };

  /**
   * Smoothly transition a composite bone translation axis (tx/ty/tz).
   * Uses normalized value in [-1, 1] and maxUnits in model units.
   */
  private transitionBoneTranslation = (
    nodeKey: string,
    channel: 'tx' | 'ty' | 'tz',
    to: number,
    maxUnits: number,
    durationMs = 200
  ): TransitionHandle => {
    const transitionKey = `boneT_${nodeKey}_${channel}`;
    const current = this.translations[nodeKey] || { x: 0, y: 0, z: 0 };
    const currentOffset =
      channel === 'tx' ? current.x :
      channel === 'ty' ? current.y :
      current.z;
    const from = maxUnits !== 0 ? Math.max(-1, Math.min(1, currentOffset / maxUnits)) : 0;
    const target = Math.max(-1, Math.min(1, to));

    return this.animation.addTransition(
      transitionKey,
      from,
      target,
      durationMs,
      (value) => this.updateBoneTranslation(nodeKey, channel, value, maxUnits)
    );
  };

  /**
   * Combine multiple TransitionHandles into one.
   * The combined promise resolves when ALL transitions complete.
   */
  private combineHandles(handles: TransitionHandle[]): TransitionHandle {
    if (handles.length === 0) {
      return { promise: Promise.resolve(), pause: () => {}, resume: () => {}, cancel: () => {} };
    }
    if (handles.length === 1) {
      return handles[0];
    }
    return {
      promise: Promise.all(handles.map(h => h.promise)).then(() => {}),
      pause: () => handles.forEach(h => h.pause()),
      resume: () => handles.forEach(h => h.resume()),
      cancel: () => handles.forEach(h => h.cancel()),
    };
  }

  // ============================================================================
  // VISEME SYSTEM - Separate from AU System
  //
  // Visemes apply BOTH morph targets AND coordinated jaw bone rotation.
  // Each viseme has an associated jaw opening amount based on phonetics.
  // - setViseme() / transitionViseme() apply morph + jaw bone rotation
  // - The AnimationScheduler routes viseme curve IDs (0-14) to transitionViseme()
  // ============================================================================

  /** Track current viseme values for transitions */
  private visemeValues: number[] = new Array(15).fill(0);

  /**
   * Jaw opening amount per viseme (0-1 range).
   * Based on phonetic properties - open vowels need more jaw, closed consonants less.
   * Index matches VISEME_KEYS: EE, Er, IH, Ah, Oh, W_OO, S_Z, Ch_J, F_V, TH, T_L_D_N, B_M_P, K_G_H_NG, AE, R
   */
  private static readonly VISEME_JAW_AMOUNTS: number[] = [
    0.15,  // 0: EE - closed front vowel, minimal jaw
    0.35,  // 1: Er - mid vowel with tongue curl
    0.25,  // 2: IH - near-close front vowel
    0.70,  // 3: Ah - open back vowel, wide jaw
    0.55,  // 4: Oh - mid-back rounded vowel
    0.30,  // 5: W_OO - rounded close back vowel
    0.10,  // 6: S_Z - fricatives, teeth nearly closed
    0.20,  // 7: Ch_J - affricates, slight opening
    0.08,  // 8: F_V - labiodental fricatives, minimal
    0.12,  // 9: TH - dental fricatives
    0.18,  // 10: T_L_D_N - alveolar consonants
    0.02,  // 11: B_M_P - bilabial stops, lips closed
    0.25,  // 12: K_G_H_NG - velars, some opening
    0.60,  // 13: AE - open front vowel
    0.40,  // 14: R - approximant
  ];

  /** Max degrees for jaw bone rotation (from shapeDict AU 26 binding) */
  private static readonly JAW_MAX_DEGREES = 28;

  /**
   * Set viseme value immediately (no transition)
   * Applies both viseme morph target AND coordinated jaw bone rotation
   *
   * @param visemeIndex - Viseme index (0-14) corresponding to VISEME_KEYS
   * @param value - Target value in [0, 1]
   * @param jawScale - Jaw activation multiplier (default: 1.0)
   */
  setViseme = (visemeIndex: number, value: number, jawScale: number = 1.0) => {
    if (visemeIndex < 0 || visemeIndex >= VISEME_KEYS.length) return;

    const val = clamp01(value);
    this.visemeValues[visemeIndex] = val;

    // Apply viseme morph
    const morphKey = VISEME_KEYS[visemeIndex];
    this.setMorph(morphKey, val);

    // Apply jaw bone rotation directly (NOT via AU 26 which would also apply Jaw_Open morph)
    // Jaw amount is: viseme_base_amount * viseme_intensity * jawScale
    const jawAmount = EngineThree.VISEME_JAW_AMOUNTS[visemeIndex] * val * jawScale;
    // Skip jaw rotation if jawScale (activation) is effectively zero
    if (Math.abs(jawScale) > 1e-6 && Math.abs(jawAmount) > 1e-6) {
      this.updateBoneRotation('JAW', 'roll', jawAmount, EngineThree.JAW_MAX_DEGREES);
    }
  };

  /**
   * Smoothly transition a viseme value
   * Applies both viseme morph target AND coordinated jaw bone rotation
   *
   * @param visemeIndex - Viseme index (0-14) corresponding to VISEME_KEYS
   * @param to - Target value in [0, 1]
   * @param durationMs - Transition duration in milliseconds (default: 80ms)
   * @param jawScale - Jaw activation multiplier (default: 1.0)
   */
  transitionViseme = (visemeIndex: number, to: number, durationMs = 80, jawScale: number = 1.0): TransitionHandle => {
    if (visemeIndex < 0 || visemeIndex >= VISEME_KEYS.length) {
      return { promise: Promise.resolve(), pause: () => {}, resume: () => {}, cancel: () => {} };
    }

    const morphKey = VISEME_KEYS[visemeIndex];
    const target = clamp01(to);
    this.visemeValues[visemeIndex] = target;

    // Transition viseme morph
    const morphHandle = this.transitionMorph(morphKey, target, durationMs);

    // Transition jaw bone rotation directly (NOT via AU 26 which would also apply Jaw_Open morph)
    // Jaw amount is: viseme_base_amount * viseme_intensity * jawScale
    const jawAmount = EngineThree.VISEME_JAW_AMOUNTS[visemeIndex] * target * jawScale;

    // If jaw activation/scale is effectively zero, skip jaw rotation transition
    if (Math.abs(jawScale) <= 1e-6 || Math.abs(jawAmount) <= 1e-6) {
      return morphHandle;
    }

    const jawHandle = this.transitionBoneRotation(
      'JAW',
      'roll',
      jawAmount,
      EngineThree.JAW_MAX_DEGREES,
      durationMs
    );

    // Combine both handles
    return this.combineHandles([morphHandle, jawHandle]);
  };

  /** Advance internal transition tweens by deltaSeconds (called from ThreeProvider RAF loop). */
  update(deltaSeconds: number) {
    const dtSeconds = Math.max(0, deltaSeconds || 0);
    if (dtSeconds <= 0 || this.isPaused) return;

    // Unified transitions (AU, morph, composite movements)
    this.animation.tick(dtSeconds);

    // Flush pending composite rotations (deferred from setAU calls)
    this.flushPendingComposites();
  }

  /** Apply all pending composite rotations and clear the set */
  private flushPendingComposites() {
    if (this.pendingCompositeNodes.size === 0) return;

    for (const nodeKey of this.pendingCompositeNodes) {
      this.applyCompositeRotation(nodeKey as BoneKey);
    }
    this.pendingCompositeNodes.clear();

  }

  /** Clear all running transitions (used when playback rate changes to prevent timing conflicts). */
  clearTransitions() {
    this.animation.clearTransitions();
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
    return this.animation.getActiveTransitionCount();
  }

  private meshes: THREE.Mesh[] = [];
  private model: THREE.Object3D | null = null;
  // Hair system removed for now.

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

  // ============================================================================
  // MESH MATERIAL CONFIGURATION
  // Runtime-configurable material properties for debugging render order/blending
  // ============================================================================

  /** Blending mode options for Three.js materials */
  static readonly BLENDING_MODES = {
    'Normal': THREE.NormalBlending,
    'Additive': THREE.AdditiveBlending,
    'Subtractive': THREE.SubtractiveBlending,
    'Multiply': THREE.MultiplyBlending,
    'None': THREE.NoBlending,
  } as const;

  /** Get material config for a mesh */
  getMeshMaterialConfig = (meshName: string): {
    renderOrder: number;
    transparent: boolean;
    opacity: number;
    depthWrite: boolean;
    depthTest: boolean;
    blending: string;
  } | null => {
    if (!this.model) return null;
    let result: ReturnType<typeof this.getMeshMaterialConfig> = null;

    this.model.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh && obj.name === meshName) {
        const mesh = obj as THREE.Mesh;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat) {
          // Reverse lookup blending mode name
          let blendingName = 'Normal';
          for (const [name, value] of Object.entries(EngineThree.BLENDING_MODES)) {
            if (mat.blending === value) {
              blendingName = name;
              break;
            }
          }
          result = {
            renderOrder: mesh.renderOrder,
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
  };

  /** Set material config for a mesh */
  setMeshMaterialConfig = (meshName: string, config: {
    renderOrder?: number;
    transparent?: boolean;
    opacity?: number;
    depthWrite?: boolean;
    depthTest?: boolean;
    blending?: string;
  }) => {
    if (!this.model) return;

    this.model.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh && obj.name === meshName) {
        const mesh = obj as THREE.Mesh;
        const mat = mesh.material as THREE.MeshStandardMaterial;

        if (config.renderOrder !== undefined) {
          mesh.renderOrder = config.renderOrder;
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
            const blendValue = EngineThree.BLENDING_MODES[config.blending as keyof typeof EngineThree.BLENDING_MODES];
            if (blendValue !== undefined) {
              mat.blending = blendValue;
            }
          }
          // Always mark material as needing update after any change
          mat.needsUpdate = true;
        }
      }
    });
  };

  private bones: ResolvedBones = {};

  // --- Mix weight system ---
  // Bones always apply at 100%. Mix weight controls the morph overlay:
  // 0 = bone only (no morph), 1 = bone + full morph overlay
  private mixWeights: Record<number, number> = { ...AU_MIX_DEFAULTS };

  // --- Balance system for bilateral AUs ---
  // Controls left/right asymmetry for AUs with separate L/R morphs (blink, smile, etc.)
  // -1 = left only, 0 = both sides equally, +1 = right only
  /**
   * Initialize composite bone rotation state and mark all composite bones as pending.
   * Uses bone/node definitions from shapeDict via BONE_AU_TO_BINDINGS (no hardcoded lists).
   */
  private initBoneRotations() {
    const zeroAxis = { value: 0, maxRadians: 0 };
    this.rotations = {};
    this.pendingCompositeNodes.clear();

    for (const node of ALL_BONE_KEYS) {
      this.rotations[node] = {
        pitch: { ...zeroAxis },
        yaw: { ...zeroAxis },
        roll: { ...zeroAxis },
      };
      this.pendingCompositeNodes.add(node);
    }
  }

  setAUMixWeight = (id: number, weight: number) => {
    this.mixWeights[id] = clamp01(weight);

    // Reapply this AU with the new mix weight (bones unaffected by mix)
    const v = this.auValues[id] ?? 0;
    if (v > 0) {
      this.setAU(id, v);
    }

    // Mark affected bones as pending
    const boneBindings = BONE_AU_TO_BINDINGS[id];
    if (boneBindings) {
      for (const binding of boneBindings) {
        this.pendingCompositeNodes.add(binding.node);
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

    // 2. Reset all composite bone rotation state based on bindings
    this.initBoneRotations();

    // 3. Clear all active transitions
    this.clearTransitions();

    // 4. Zero out all morphs directly
    for (const m of this.meshes) {
      const infl: any = (m as any).morphTargetInfluences;
      if (!infl) continue;
      for (let i = 0; i < infl.length; i++) {
        infl[i] = 0;
      }
    }

    // 5. Reset all bones to their base transforms
    Object.values(this.bones).forEach((entry) => {
      if (!entry) return;
      entry.obj.position.copy(entry.basePos);
      entry.obj.quaternion.copy(entry.baseQuat);
    });
  };

  hasBoneBinding = (id: number) => BONE_DRIVEN_AUS.has(id);

  onReady = ({ meshes, model, scene, renderer, skyboxTexture }: {
    meshes: THREE.Mesh[];
    model?: THREE.Object3D;
    scene?: THREE.Scene;
    renderer?: THREE.WebGLRenderer;
    skyboxTexture?: THREE.Texture;
  }) => {
    this.meshes = meshes;
    this.meshByName.clear();
    this.morphCache.clear(); // Invalidate morph index cache when model changes

    // Populate meshByName from the full model traversal (not just this.meshes)
    // This ensures we find all morph meshes including eye occlusion, tear lines, etc.
    if (model) {
      model.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh && mesh.name) {
          const infl = (mesh as any).morphTargetInfluences;
          // Only add meshes that have morph targets
          if (Array.isArray(infl) && infl.length > 0) {
            this.meshByName.set(mesh.name, mesh);
          }
        }
      });
    } else {
      // Fallback: use the meshes array if model not provided
      for (const m of meshes) {
        if (m && m.name) {
          this.meshByName.set(m.name, m);
        }
      }
    }

    // Resolve primary face mesh for AU/viseme morphs
    const defaultFace = meshes.find(m => m.name === FACE_MESH_NAME_DEFAULT);
    if (defaultFace) {
      this.faceMeshName = defaultFace.name;
      this.faceMesh = defaultFace;
    } else {
      // Fallback: pick first mesh that has common face morphs
      const candidate = meshes.find((m) => {
        const dict: any = (m as any).morphTargetDictionary;
        return dict && typeof dict === 'object' && 'Brow_Drop_L' in dict;
      });
      this.faceMeshName = candidate?.name || null;
      this.faceMesh = candidate || null;
    }

    if (scene) this.scene = scene;
    if (renderer) this.renderer = renderer;
    if (skyboxTexture) this.skyboxTexture = skyboxTexture;

    if (model) {
      this.model = model;
      this.bones = this.resolveBones(model);
      this.logResolvedOnce(this.bones);
      this.rigReady = true;
      this.missingBoneWarnings.clear();
      this.setupMeshRenderOrder(model);
      this.initBoneRotations();
    }

  };

  /** Morphs **/
  setMorph = (key: string, v: number, meshNames: string[] = MORPH_TO_MESH.face) => {
    const val = clamp01(v);

    // Fast path: check cache first (may have multiple entries for same morph key)
    const cached = this.morphCache.get(key);
    if (cached) {
      for (const target of cached) {
        target.infl[target.idx] = val;
      }
      return;
    }

    // Cache miss: look up in all specified meshes and cache for next time
    const targets: { infl: number[], idx: number }[] = [];

    if (meshNames && meshNames.length) {
      for (const name of meshNames) {
        const mesh = this.meshByName.get(name);
        if (!mesh) continue;
        const dict: any = (mesh as any).morphTargetDictionary;
        const infl: any = (mesh as any).morphTargetInfluences;
        if (!dict || !infl) continue;
        const idx = dict[key];
        if (idx !== undefined) {
          targets.push({ infl, idx });
          infl[idx] = val;
        }
      }
    } else {
      // Fallback: scan all known meshes (for unknown morphs or categories)
      for (const mesh of this.meshes) {
        const dict: any = (mesh as any).morphTargetDictionary;
        const infl: any = (mesh as any).morphTargetInfluences;
        if (!dict || !infl) continue;
        const idx = dict[key];
        if (idx !== undefined) {
          targets.push({ infl, idx });
          infl[idx] = val;
        }
      }
    }

    // Cache all targets found for this morph key
    if (targets.length > 0) {
      this.morphCache.set(key, targets);
    }
  };
  

  /**
   * Set an AU value immediately (no transition).
   *
   * @param id - AU ID (number) or string with side suffix ('12L', '12R')
   * @param v - Intensity value (0-1)
   * @param balance - Optional left/right balance: -1 = left only, 0 = both equally, +1 = right only
   */
  setAU = (id: number | string, v: number, balance?: number) => {
    if (typeof id === 'string') {
      const match = id.match(/^(\d+)([LR])$/i);
      if (match) {
        // Legacy string format: '12L' → setAU(12, v, -1), '12R' → setAU(12, v, +1)
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

    // Apply morphs (with balance for bilateral morphs)
    const keys = AU_TO_MORPHS[id] || [];
    if (keys.length) {
      // Mix weight scales only the morph overlay – bones stay at full strength
      const mixWeight = isMixedAU(id) ? this.getAUMixWeight(id) : 1.0;
      const base = clamp01(v) * mixWeight;

      // Get correct mesh names for this AU (tongue AUs go to tongue mesh, face AUs to face mesh)
      const meshNames = this.getMeshNamesForAU(id);

      // Partition into left/right/center based on naming
      // Matches: _L, Left, or " L" (space+L) at end of string
      const leftKeys = keys.filter(k => /(_L$| L$|Left$)/i.test(k));
      const rightKeys = keys.filter(k => /(_R$| R$|Right$)/i.test(k));
      const centerKeys = keys.filter(k => !/(_L$| L$|Left$|_R$| R$|Right$)/i.test(k));

      const { left: leftVal, right: rightVal } = this.computeSideValues(base, balance);

      if (leftKeys.length || rightKeys.length) {
        for (const k of leftKeys) this.setMorph(k, leftVal, meshNames);
        for (const k of rightKeys) this.setMorph(k, rightVal, meshNames);
      } else {
        // No explicit L/R split – treat all as center
        centerKeys.push(...keys);
      }

      for (const k of centerKeys) {
        this.setMorph(k, base, meshNames);
      }
    }

    // Apply bones - channel tells us axis, scale gives direction
    const bindings = BONE_AU_TO_BINDINGS[id];
    if (bindings) {
      for (const binding of bindings) {
        // Rotation channels (rx/ry/rz) → composite rotation state
        if (binding.channel === 'rx' || binding.channel === 'ry' || binding.channel === 'rz') {
          const axis = binding.channel === 'rx' ? 'pitch' : binding.channel === 'ry' ? 'yaw' : 'roll';
          this.updateBoneRotation(binding.node, axis, v * binding.scale, binding.maxDegrees ?? 0);
        }
        // Translation channels (tx/ty/tz) → translation offsets in model units
        else if (binding.channel === 'tx' || binding.channel === 'ty' || binding.channel === 'tz') {
          if (binding.maxUnits !== undefined) {
            const maxUnits = binding.maxUnits;
            const value = v * binding.scale; // normalized [-1,1]
            this.updateBoneTranslation(binding.node, binding.channel, value, maxUnits);
          }
        }
      }
    }
  };

  /** Engine internals **/

  /**
   * Update rotation state for a specific axis of a composite bone.
   * Value should already have scale applied (signed direction).
   * maxDegrees is stored for use in applyCompositeRotation.
   */
  private updateBoneRotation(
    nodeKey: string,
    axis: 'pitch' | 'yaw' | 'roll',
    value: number,
    maxDegrees: number
  ) {
    if (!this.rotations[nodeKey]) return; // Skip unknown bones
    this.rotations[nodeKey][axis] = {
      value: Math.max(-1, Math.min(1, value)),
      // Precompute radians once; per-frame we only multiply by value.
      maxRadians: deg2rad(maxDegrees)
    };
    this.pendingCompositeNodes.add(nodeKey);
  }

  /**
   * Update translation state for a composite bone along a single axis (tx/ty/tz).
   * value is normalized in [-1, 1]; maxUnits is the maximum translation in model units.
   */
  private updateBoneTranslation(
    nodeKey: string,
    channel: 'tx' | 'ty' | 'tz',
    value: number,
    maxUnits: number
  ) {
    if (!this.translations[nodeKey]) {
      this.translations[nodeKey] = { x: 0, y: 0, z: 0 };
    }
    const clamped = Math.max(-1, Math.min(1, value));
    const offset = clamped * maxUnits;
    if (channel === 'tx') this.translations[nodeKey].x = offset;
    else if (channel === 'ty') this.translations[nodeKey].y = offset;
    else this.translations[nodeKey].z = offset;

    this.pendingCompositeNodes.add(nodeKey);
  }

  /**
   * Apply the complete composite rotation for a bone.
   * Combines pitch/yaw/roll from rotation state into a single quaternion.
   * All values and maxDegrees are already stored in rotations state.
   */
  private applyCompositeRotation(nodeKey: BoneKey) {
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

    // Convert stored normalized values [-1, 1] to radians per axis (rx, ry, rz)
    const yawRad = rotState.yaw.maxRadians * rotState.yaw.value;
    const pitchRad = rotState.pitch.maxRadians * rotState.pitch.value;
    const rollRad = rotState.roll.maxRadians * rotState.roll.value;

    // Apply translation offsets (if any) relative to the base pose.
    obj.position.copy(basePos);
    const t = this.translations[nodeKey];
    if (t) {
      obj.position.x += t.x;
      obj.position.y += t.y;
      obj.position.z += t.z;
    }

    // Apply Euler offsets relative to the base pose.
    obj.rotation.set(
      baseEuler.x + pitchRad,
      baseEuler.y + yawRad,
      baseEuler.z + rollRad,
      baseEuler.order
    );
    obj.updateMatrixWorld(false);
    this.model.updateMatrixWorld(true);
  }

  /** Resolve CC4 bones using explicit node names from shapeDict. */
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

    // Register all bones from CC4_BONE_NODES
    for (const [key, nodeName] of Object.entries(CC4_BONE_NODES)) {
      const node = findNode(nodeName);
      if (node) resolved[key as BoneKey] = snapshot(node);
    }

    // Eye fallbacks - try mesh nodes if bone nodes not found
    if (!resolved.EYE_L) {
      const node = findNode(CC4_EYE_MESH_NODES.LEFT);
      if (node) resolved.EYE_L = snapshot(node);
    }
    if (!resolved.EYE_R) {
      const node = findNode(CC4_EYE_MESH_NODES.RIGHT);
      if (node) resolved.EYE_R = snapshot(node);
    }

    return resolved;
  };

  // ========================================
  // Mesh Render Order & Material Settings
  // Configured via CC4_MESHES in shapeDict.ts
  // ========================================

  /**
   * Set up render order and material settings for all meshes.
   * Settings are defined in CC4_MESHES (shapeDict.ts) per-mesh.
   */
  private setupMeshRenderOrder(model: THREE.Object3D) {
    model.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      const mesh = obj as THREE.Mesh;
      const info = CC4_MESHES[mesh.name];
      if (!info?.material) return;

      const settings = info.material;
      const mat = mesh.material as THREE.MeshStandardMaterial;

      // Apply render order
      if (settings.renderOrder !== undefined) {
        mesh.renderOrder = settings.renderOrder;
      }

      // Apply material settings
      if (mat) {
        if (settings.transparent !== undefined) {
          mat.transparent = settings.transparent;
        }
        if (settings.opacity !== undefined) {
          mat.opacity = settings.opacity;
        }
        if (settings.depthWrite !== undefined) {
          mat.depthWrite = settings.depthWrite;
        }
        if (settings.depthTest !== undefined) {
          mat.depthTest = settings.depthTest;
        }
        if (settings.blending !== undefined) {
          const blendValue = EngineThree.BLENDING_MODES[settings.blending];
          if (blendValue !== undefined) {
            mat.blending = blendValue;
          }
        }
        mat.needsUpdate = true;
      }
    });
  }

  /**
   * Debug helper: log all meshes that have morph targets,
   * along with their morphTargetDictionary keys and current influences.
   *
   * Call from devtools via `engine.logShapeKeys()` after the model is ready.
   */
  logShapeKeys() {
    console.log('[EngineThree.logShapeKeys] --- BEGIN ---');
    const seen = new Set<THREE.Mesh>();

    const processMesh = (mesh: THREE.Mesh, fallbackIndex: number) => {
      const dict = (mesh as any).morphTargetDictionary;
      const infl = (mesh as any).morphTargetInfluences;
      if (!dict || !infl) return;

      const meshName = mesh.name || `(unnamed_${fallbackIndex})`;
      console.log(`\n[Mesh] ${meshName}`);
      console.log('  morphTargetDictionary keys:', Object.keys(dict));

      const byName: Record<string, number> = {};
      for (const [name, idx] of Object.entries(dict as Record<string, number>)) {
        byName[name] = infl[idx] ?? 0;
      }
      console.log('  current influences:', byName);
    };

    // Prefer traversing the full model so we don't miss any morph meshes,
    // even if this.meshes was not populated as expected.
    if (this.model) {
      let i = 0;
      this.model.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        seen.add(mesh);
        processMesh(mesh, i++);
      });
    } else {
      console.warn('[EngineThree.logShapeKeys] No model loaded yet (this.model is null).');
    }

    // Also include any meshes tracked in this.meshes that weren't reached via model traversal
    if (this.meshes && this.meshes.length) {
      this.meshes.forEach((mesh, idx) => {
        if (seen.has(mesh)) return;
        processMesh(mesh, idx);
      });
    } else {
      console.warn('[EngineThree.logShapeKeys] this.meshes is empty.');
    }

    console.log('[EngineThree.logShapeKeys] --- END ---');
  }

  /**
   * Debug helper: log all bone nodes and skinned meshes in the model.
   * Call from devtools via `engine.logBones()` after the model is ready.
   */
  logBones() {
    if (!this.model) {
      console.warn('[EngineThree.logBones] No model loaded');
      return;
    }

    console.log('[EngineThree.logBones] --- BEGIN ---');

    // Find all skinned meshes and their skeletons
    const skinnedMeshes: THREE.SkinnedMesh[] = [];
    this.model.traverse((obj) => {
      if ((obj as THREE.SkinnedMesh).isSkinnedMesh) {
        skinnedMeshes.push(obj as THREE.SkinnedMesh);
      }
    });

    console.log(`\nFound ${skinnedMeshes.length} skinned meshes:`);
    for (const mesh of skinnedMeshes) {
      const skeleton = mesh.skeleton;
      console.log(`\n[SkinnedMesh] ${mesh.name}`);
      console.log(`  Skeleton bones (${skeleton.bones.length}):`);
      console.log('  ', skeleton.bones.map(b => b.name));
    }

    // Also list all bones in hierarchy
    const allBones: string[] = [];
    this.model.traverse((obj) => {
      if ((obj as THREE.Bone).isBone) {
        allBones.push(obj.name);
      }
    });
    console.log('\nAll bone nodes in hierarchy:', allBones);
    console.log('Total bones:', allBones.length);

    console.log('[EngineThree.logBones] --- END ---');
  }

  private logResolvedOnce = (_bones: ResolvedBones) => {
    // Debug logging disabled for performance
    // Call engine.logShapeKeys() and engine.logBones() manually if needed
  };

  // ============================================================================
  // SKYBOX CONTROL METHODS
  // ============================================================================

  /** Rotate skybox - not supported with scene.background texture approach */
  setSkyboxRotation = (_degrees: number) => {
    // Rotation not supported - would require upgrading Three.js or using a skybox mesh
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

  /** Check if skybox is ready - checks if scene has background */
  isSkyboxReady = (): boolean => {
    return this.scene !== null && this.scene.background !== null;
  };

  /** Set skybox texture reference (called when texture finishes loading) */
  setSkyboxTexture = (texture: THREE.Texture) => {
    this.skyboxTexture = texture;
  };

  /** Check if renderer is ready for skybox/tone mapping controls */
  isRendererReady = (): boolean => {
    return this.renderer !== null;
  };
}

function clamp01(x: number) { return x < 0 ? 0 : x > 1 ? 1 : x; }
