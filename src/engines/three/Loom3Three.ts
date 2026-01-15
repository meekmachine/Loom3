/**
 * Loom3Three - Three.js Implementation
 *
 * Default implementation of the Loom3 interface for Three.js.
 * Controls 3D character facial animation using Action Units (AUs),
 * morph targets, visemes, and bone transformations.
 */

import {
  Quaternion,
  Vector3,
  Box3,
  AnimationMixer,
  AnimationAction,
  AnimationClip,
  NumberKeyframeTrack,
  QuaternionKeyframeTrack,
  LoopRepeat,
  LoopPingPong,
  LoopOnce,
  Clock,
} from 'three';
import type { Mesh, Object3D } from 'three';
import type {
  Loom3,
  ReadyPayload,
  Loom3Config,
} from '../../interfaces/Loom3';
import type { MeshInfo } from '../../mappings/types';
import type { Animation } from '../../interfaces/Animation';
import type {
  TransitionHandle,
  BoneKey,
  RotationsState,
  AnimationPlayOptions,
  AnimationClipInfo,
  AnimationState,
  AnimationActionHandle,
  CurvesMap,
  ClipOptions,
  ClipHandle,
  Snippet,
} from '../../core/types';
import type { AUMappingConfig } from '../../mappings/types';
import { AnimationThree } from './AnimationThree';
import { CC4_PRESET, CC4_MESHES, COMPOSITE_ROTATIONS as CC4_COMPOSITE_ROTATIONS } from '../../presets/cc4';
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

// Lightweight unique id for mixer actions/handles
const makeActionId = () => `act_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;

/**
 * NodeBase - internal bone snapshot
 */
interface NodeBase {
  obj: Object3D;
  basePos: { x: number; y: number; z: number };
  baseQuat: any;
  baseEuler: { x: number; y: number; z: number; order: string };
}

type ResolvedBones = Partial<Record<string, NodeBase>>;

export class Loom3Three implements Loom3 {
  // Configuration
  private config: AUMappingConfig;

  // Animation system (injectable)
  private animation: Animation;

  // Composite rotation mappings (built from config or default CC4)
  private compositeRotations: CompositeRotation[];
  private auToCompositeMap: Map<number, { nodes: string[]; axis: 'pitch' | 'yaw' | 'roll' }>;

  // State
  private auValues: Record<number, number> = {};
  private auBalances: Record<number, number> = {};  // Balance values per AU (-1 to 1)
  private rigReady = false;
  private missingBoneWarnings = new Set<string>();
  private clipActions = new Map<string, AnimationAction>();

  // Rotation state
  private rotations: RotationsState = {};
  private pendingCompositeNodes = new Set<string>();
  private isPaused = false;
  private translations: Record<string, { x: number; y: number; z: number }> = {};

  // Mesh references
  private faceMesh: Mesh | null = null;
  private resolvedFaceMeshes: string[] = [];
  private meshes: Mesh[] = [];
  private model: Object3D | null = null;
  private meshByName = new Map<string, Mesh>();
  private morphCache = new Map<string, { infl: number[]; idx: number }[]>();

  // Bones
  private bones: ResolvedBones = {};
  private mixWeights: Record<number, number> = {};

  // Viseme state
  private visemeValues: number[] = new Array(15).fill(0);


  // Viseme jaw amounts
  private static readonly VISEME_JAW_AMOUNTS: number[] = [
    0.15, 0.35, 0.25, 0.70, 0.55, 0.30, 0.10, 0.20, 0.08,
    0.12, 0.18, 0.02, 0.25, 0.60, 0.40,
  ];

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
  private registeredHairObjects = new Map<string, Mesh>();
  private cachedHairMeshNames: string[] | null = null;

  // Baked animation state (Three.js AnimationMixer)
  private animationMixer: AnimationMixer | null = null;
  private mixerFinishedListenerAttached = false;
  private animationClips: AnimationClip[] = [];
  private animationActions = new Map<string, AnimationAction>();
  private animationFinishedCallbacks = new Map<string, () => void>();
  // Track live clip handles by name so scheduler param updates can always reach mixer-backed snippets
  private clipHandles = new Map<string, ClipHandle>();
  // Track action IDs for debugging/matching
  private actionIds = new WeakMap<AnimationAction, string>();
  // Map actionId to clip name for quick reverse lookup
  private actionIdToClip = new Map<string, string>();

  // Internal animation loop
  private clock = new Clock(false); // Don't auto-start
  private animationFrameId: number | null = null;
  private isRunning = false;

  constructor(config: Loom3Config = {}, animation?: Animation) {
    this.config = config.auMappings || CC4_PRESET;
    this.mixWeights = { ...this.config.auMixDefaults };
    this.animation = animation || new AnimationThree();

    // Use config's composite rotations or default to CC4
    this.compositeRotations = this.config.compositeRotations || CC4_COMPOSITE_ROTATIONS;
    this.auToCompositeMap = buildAUToCompositeMap(this.compositeRotations);
  }

  /**
   * Ensure the mixer exists and has the finished listener attached.
   */
  private ensureMixer(): AnimationMixer | null {
    if (!this.model) return null;

    if (!this.animationMixer) {
      this.animationMixer = new AnimationMixer(this.model as any);
    }

    if (this.animationMixer && !this.mixerFinishedListenerAttached) {
      this.animationMixer.addEventListener('finished', (event: any) => {
        const action = event.action as AnimationAction;
        const clip = action.getClip();
        const callback = this.animationFinishedCallbacks.get(clip.name);
        if (callback) {
          callback();
          this.animationFinishedCallbacks.delete(clip.name);
        }
      });
      this.mixerFinishedListenerAttached = true;
    }

    return this.animationMixer;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  onReady(payload: ReadyPayload): void {
    const { meshes, model } = payload;

    const collectedMeshes = collectMorphMeshes(model);
    const meshByKey = new Map<string, Mesh>();
    const addMesh = (mesh: Mesh) => {
      const key = mesh.name || (mesh as any).uuid;
      if (!meshByKey.has(key)) {
        meshByKey.set(key, mesh);
      }
    };

    meshes.forEach(addMesh);
    collectedMeshes.forEach(addMesh);

    this.meshes = Array.from(meshByKey.values());
    this.model = model;
    this.meshByName.clear();
    this.morphCache.clear();

    // Build mesh lookup
    model.traverse((obj: any) => {
      if (obj.isMesh && obj.name) {
        const infl = obj.morphTargetInfluences;
        const dict = obj.morphTargetDictionary;
        if ((Array.isArray(infl) && infl.length > 0) || (dict && Object.keys(dict).length > 0)) {
          this.meshByName.set(obj.name, obj);
        }
      }
    });

    // Resolve bones
    this.bones = this.resolveBones(model);
    this.rigReady = true;
    this.missingBoneWarnings.clear();
    this.initBoneRotations();

    // Find primary face mesh (use head bone proximity when available)
    this.resolvedFaceMeshes = this.resolveFaceMeshes(this.meshes);
    this.faceMesh = this.resolvedFaceMeshes.length > 0
      ? this.meshByName.get(this.resolvedFaceMeshes[0]) || null
      : null;

    // Make sure all morph-capable meshes are considered face targets (includes brows/hair pieces with morphs)
    const morphMeshNames = this.meshes
      .filter((m) => {
        const infl = m.morphTargetInfluences;
        const dict = m.morphTargetDictionary;
        return (Array.isArray(infl) && infl.length > 0) || (dict && Object.keys(dict).length > 0);
      })
      .map((m) => m.name)
      .filter(Boolean);

    if (morphMeshNames.length > 0) {
      this.config.morphToMesh = {
        ...this.config.morphToMesh,
        face: Array.from(new Set(morphMeshNames)),
      };
    }

    if (this.resolvedFaceMeshes.length > 0) {
      for (const faceName of this.resolvedFaceMeshes) {
        const faceMesh = this.meshByName.get(faceName);
        const morphKeys = faceMesh?.morphTargetDictionary
          ? Object.keys(faceMesh.morphTargetDictionary)
          : [];
        console.log('[Loom3Three] Face mesh resolved:', faceName);
        console.log('[Loom3Three] Face mesh morphs:', morphKeys);
      }
    } else {
      console.log('[Loom3Three] No face mesh resolved from morph targets.');
    }

    // Apply render order and material settings from CC4_MESHES
    this.applyMeshMaterialSettings(model);
  }

  private resolveFaceMeshes(meshes: Mesh[]): string[] {
    const faceMeshNames = this.config.morphToMesh?.face || [];
    const availableMorphMeshes = meshes.filter((m) => {
      const dict = m.morphTargetDictionary;
      const infl = m.morphTargetInfluences;
      return (dict && Object.keys(dict).length > 0) || (Array.isArray(infl) && infl.length > 0);
    });
    const defaultFace = meshes.find((m) => faceMeshNames.includes(m.name));
    if (defaultFace) {
      return [defaultFace.name];
    }

    const candidateByMorph = meshes.find((m) => {
      const dict = m.morphTargetDictionary;
      return dict && typeof dict === 'object' && 'Brow_Drop_L' in dict;
    });
    if (candidateByMorph) {
      return [candidateByMorph.name];
    }

    const head = this.bones['HEAD']?.obj;
    if (head && availableMorphMeshes.length > 0) {
      const headPos = new Vector3();
      (head as any).getWorldPosition?.(headPos);
      const headCandidates = availableMorphMeshes.map((mesh) => {
        const box = new Box3().setFromObject(mesh as any);
        const center = new Vector3();
        box.getCenter(center);
        const distance = box.containsPoint(headPos) ? 0 : center.distanceTo(headPos);
        const morphCount = mesh.morphTargetDictionary
          ? Object.keys(mesh.morphTargetDictionary).length
          : 0;
        const name = mesh.name.toLowerCase();
        const penalty = /eye|occlusion|tear|teeth|tongue|hair|lash/.test(name) ? 10 : 0;
        return { name: mesh.name, distance, morphCount, penalty };
      });

      headCandidates.sort((a, b) => {
        if (a.distance !== b.distance) return a.distance - b.distance;
        if (a.penalty !== b.penalty) return a.penalty - b.penalty;
        return b.morphCount - a.morphCount;
      });

      const best = headCandidates[0];
      const extras = headCandidates
        .filter((entry) => /brow|eyebrow/.test(entry.name.toLowerCase()))
        .map((entry) => entry.name);

      return [best.name, ...extras].filter((value, index, arr) => arr.indexOf(value) === index);
    }

    if (availableMorphMeshes.length > 0) {
      const best = availableMorphMeshes.reduce((prev, current) => {
        const prevCount = prev.morphTargetDictionary ? Object.keys(prev.morphTargetDictionary).length : 0;
        const currCount = current.morphTargetDictionary ? Object.keys(current.morphTargetDictionary).length : 0;
        return currCount > prevCount ? current : prev;
      });
      const browExtras = availableMorphMeshes
        .filter((m) => {
          const dict = m.morphTargetDictionary || {};
          const morphKeys = Object.keys(dict);
          return /brow|eyebrow/i.test(m.name) || morphKeys.some((k) => /brow/i.test(k));
        })
        .map((m) => m.name);
      return [best.name, ...browExtras].filter((value, index, arr) => arr.indexOf(value) === index);
    }

    return [];
  }

  update(deltaSeconds: number): void {
    const dtSeconds = Math.max(0, deltaSeconds || 0);
    if (dtSeconds <= 0 || this.isPaused) return;

    this.animation.tick(dtSeconds);
    this.flushPendingComposites();

    // Update baked animations via AnimationMixer
    if (this.animationMixer) {
      this.animationMixer.update(dtSeconds);
    }

    // Wind/idle hair animations (only when physics enabled)
    this.updateHairWindIdle(dtSeconds);
  }

  /** Start the internal animation loop using Three.js Clock */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.clock.start();

    const tick = () => {
      if (!this.isRunning) return;
      const delta = this.clock.getDelta();
      this.update(delta);
      this.animationFrameId = requestAnimationFrame(tick);
    };

    this.animationFrameId = requestAnimationFrame(tick);
  }

  /** Stop the internal animation loop */
  stop(): void {
    this.isRunning = false;
    this.clock.stop();
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  dispose(): void {
    this.stop();
    this.clearTransitions();
    this.stopAllAnimations();
    if (this.animationMixer) {
      this.animationMixer.stopAllAction();
      this.animationMixer = null;
    }
    this.animationClips = [];
    this.animationActions.clear();
    this.animationFinishedCallbacks.clear();
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

    // Handle negative values for continuum pairs:
    // If v < 0 and this AU has a continuum pair, activate the opposite AU instead
    if (v < 0 && this.config.continuumPairs) {
      const pairInfo = this.config.continuumPairs[id];
      if (pairInfo) {
        // Activate the pair AU with the absolute value, deactivate this AU
        this.setAU(pairInfo.pairId, Math.abs(v), balance);
        this.setAU(id, 0, balance);
        return;
      }
    }

    this.auValues[id] = v;
    // Store balance for this AU (used by bilateral bone AUs like fish gills)
    if (balance !== undefined) {
      this.auBalances[id] = balance;
    }

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
      // Compute balance-adjusted values for bilateral bone AUs
      const storedBalance = this.auBalances[id] ?? 0;
      const { left: leftVal, right: rightVal } = this.computeSideValues(clamp01(v), storedBalance);

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

        // Apply balance for bilateral bone nodes (L/R pattern in node name)
        // This allows balance slider control for bone-only bilateral AUs like fish gills
        // BUT skip for AUs where both L and R nodes are controlled by the same AU (like eyes)
        // Eyes: AU 61 controls both EYE_L and EYE_R together
        // Fish gills: AU 45 controls only GILL_L, AU 46 controls only GILL_R
        const auBoneBindings = this.config.auToBones[id] || [];

        // Only apply balance if this AU exclusively controls one side
        const hasOnlyLeftBindings = auBoneBindings.length > 0 && auBoneBindings.every(b => /_L$|_L_|^GILL_L/.test(b.node));
        const hasOnlyRightBindings = auBoneBindings.length > 0 && auBoneBindings.every(b => /_R$|_R_|^GILL_R/.test(b.node));
        const isTrueBilateralAU = !hasOnlyLeftBindings && !hasOnlyRightBindings;

        const isLeftNode = /_L$|_L_|^GILL_L/.test(nodeKey);
        const isRightNode = /_R$|_R_|^GILL_R/.test(nodeKey);

        // Only apply balance scaling for unilateral AUs (like fish gills)
        // For bilateral AUs where one AU controls both sides (like eyes), skip balance
        if (!isTrueBilateralAU) {
          if (isLeftNode) {
            axisValue = axisValue * (leftVal / clamp01(v || 1));
          } else if (isRightNode) {
            axisValue = axisValue * (rightVal / clamp01(v || 1));
          }
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

    // Handle negative values for continuum pairs:
    // If to < 0 and this AU has a continuum pair, transition the opposite AU instead
    if (to < 0 && this.config.continuumPairs) {
      const pairInfo = this.config.continuumPairs[numId];
      if (pairInfo) {
        // Transition the pair AU to the absolute value, and this AU to 0
        const pairHandle = this.transitionAU(pairInfo.pairId, Math.abs(to), durationMs, balance);
        const thisHandle = this.transitionAU(numId, 0, durationMs, balance);
        return this.combineHandles([pairHandle, thisHandle]);
      }
    }

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

  getCompositeRotations(): CompositeRotation[] {
    return this.compositeRotations;
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

    const jawAmount = Loom3Three.VISEME_JAW_AMOUNTS[visemeIndex] * val * jawScale;
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

    const jawAmount = Loom3Three.VISEME_JAW_AMOUNTS[visemeIndex] * target * jawScale;
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

  /**
   * Check if an AU has bilateral bone bindings (L and R nodes)
   * Used to determine if a balance slider should be shown for bone-only bilateral AUs
   */
  hasLeftRightBones(auId: number): boolean {
    const compositeInfo = this.auToCompositeMap.get(auId);
    if (!compositeInfo) return false;

    const nodes = compositeInfo.nodes;
    const hasLeft = nodes.some(n => /_L$|_L_|^GILL_L/.test(n));
    const hasRight = nodes.some(n => /_R$|_R_|^GILL_R/.test(n));

    return hasLeft && hasRight;
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

  /** Store original emissive colors for highlight reset */
  private originalEmissive = new Map<string, { color: number; intensity: number }>();

  /**
   * Highlight a mesh with an emissive glow effect
   * @param meshName - Name of the mesh to highlight (null to clear all highlights)
   * @param color - Highlight color (default: cyan 0x00ffff)
   * @param intensity - Emissive intensity (default: 0.5)
   */
  highlightMesh(meshName: string | null, color: number = 0x00ffff, intensity: number = 0.5): void {
    if (!this.model) return;

    this.model.traverse((obj: any) => {
      if (!obj.isMesh) return;

      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];

      for (const mat of materials) {
        if (!mat || !('emissive' in mat)) continue;

        if (meshName === null || obj.name !== meshName) {
          // Reset to original emissive
          const original = this.originalEmissive.get(obj.name);
          if (original) {
            mat.emissive.setHex(original.color);
            mat.emissiveIntensity = original.intensity;
          }
        } else if (obj.name === meshName) {
          // Store original if not already stored
          if (!this.originalEmissive.has(obj.name)) {
            this.originalEmissive.set(obj.name, {
              color: mat.emissive.getHex(),
              intensity: mat.emissiveIntensity || 0,
            });
          }
          // Apply highlight
          mat.emissive.setHex(color);
          mat.emissiveIntensity = intensity;
        }
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
    let result: ReturnType<Loom3Three['getMeshMaterialConfig']> = null;

    this.model.traverse((obj: any) => {
      if (obj.isMesh && obj.name === meshName) {
        const mat = obj.material;
        if (mat) {
          // Reverse lookup blending mode name
          let blendingName = 'Normal';
          for (const [name, value] of Object.entries(Loom3Three.BLENDING_MODES)) {
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
            const blendValue = Loom3Three.BLENDING_MODES[config.blending];
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
  registerHairObjects(objects: Object3D[]): Array<{ name: string; isMesh: boolean; isEyebrow: boolean }> {
    this.registeredHairObjects.clear();
    this.cachedHairMeshNames = null;

    const result: Array<{ name: string; isMesh: boolean; isEyebrow: boolean }> = [];

    for (const obj of objects) {
      if ((obj as any).isMesh) {
        const mesh = obj as unknown as Mesh;
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
  getRegisteredHairObjects(): Mesh[] {
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
    let targetMesh: Mesh | undefined;

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
    if (!rotState) {
      return;
    }

    // Find the composite rotation config for this node
    const config = this.compositeRotations.find((c: CompositeRotation) => c.node === nodeKey);
    if (!config) {
      return;
    }

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

  private resolveBones(root: Object3D): ResolvedBones {
    const resolved: ResolvedBones = {};

    const snapshot = (obj: any): NodeBase => ({
      obj,
      basePos: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
      baseQuat: obj.quaternion.clone(),
      baseEuler: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z, order: obj.rotation.order },
    });

    // Build suffix regex from config pattern
    const prefix = this.config.bonePrefix || '';
    const suffix = this.config.boneSuffix || '';
    const suffixRegex = this.config.suffixPattern
      ? new RegExp(this.config.suffixPattern)
      : null;

    // Find node with exact match first, then fuzzy match with suffix pattern
    const findNode = (baseName?: string | null): Object3D | undefined => {
      if (!baseName) return undefined;

      // Build full name with prefix and suffix
      const fullName = prefix + baseName + suffix;

      // Try exact match first
      const exactMatch = root.getObjectByName(fullName);
      if (exactMatch) return exactMatch;

      // Try fuzzy match with suffix pattern if configured
      if (suffixRegex) {
        let found: Object3D | undefined;
        root.traverse((obj: any) => {
          if (found) return; // Already found
          if (obj.name && obj.name.startsWith(fullName)) {
            const suffix = obj.name.slice(fullName.length);
            // Match if suffix is empty or matches the pattern
            if (suffix === '' || suffixRegex.test(suffix)) {
              found = obj;
            }
          }
        });
        if (found) return found;
      }

      // Fallback: try without prefix (for configs that don't use prefix)
      if (prefix) {
        const noPrefix = root.getObjectByName(baseName);
        if (noPrefix) return noPrefix;
      }

      return undefined;
    };

    for (const [key, nodeName] of Object.entries(this.config.boneNodes)) {
      const node = findNode(nodeName);
      if (node) {
        resolved[key] = snapshot(node);
      }
    }

    if (!resolved.EYE_L && this.config.eyeMeshNodes) {
      const node = findNode(this.config.eyeMeshNodes.LEFT);
      if (node) {
        resolved.EYE_L = snapshot(node);
      }
    }
    if (!resolved.EYE_R && this.config.eyeMeshNodes) {
      const node = findNode(this.config.eyeMeshNodes.RIGHT);
      if (node) {
        resolved.EYE_R = snapshot(node);
      }
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
  private applyMeshMaterialSettings(root: Object3D): void {
    // Clear and rebuild hair object registry
    this.registeredHairObjects.clear();
    this.cachedHairMeshNames = null;

    root.traverse((obj: any) => {
      if (!obj.isMesh || !obj.name) return;

      // Try config.meshes first, then fall back to CC4_MESHES for backwards compatibility
      const meshInfo = this.config.meshes?.[obj.name] ?? CC4_MESHES[obj.name];
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
          const blendValue = Loom3Three.BLENDING_MODES[settings.blending];
          if (blendValue !== undefined) {
            obj.material.blending = blendValue;
          }
        }
        obj.material.needsUpdate = true;
      }
    });

  }

  // ============================================================================
  // BAKED ANIMATION CONTROL (Three.js AnimationMixer)
  // ============================================================================

  /**
   * Load animation clips from a GLTF/GLB file.
   * Call this after onReady() with the animations array from the GLTF loader.
   */
  loadAnimationClips(clips: unknown[]): void {
    if (!this.model) {
      console.warn('Loom3: Cannot load animation clips before calling onReady()');
      return;
    }

    // Create mixer if not exists
    this.ensureMixer();

    // Store clips
    this.animationClips = clips as AnimationClip[];

    // Pre-create actions for all clips
    for (const clip of this.animationClips) {
      if (!this.animationActions.has(clip.name) && this.animationMixer) {
        const action = this.animationMixer.clipAction(clip);
        this.animationActions.set(clip.name, action);
      }
    }
  }

  /**
   * Get list of all loaded animation clips.
   */
  getAnimationClips(): AnimationClipInfo[] {
    return this.animationClips.map(clip => ({
      name: clip.name,
      duration: clip.duration,
      trackCount: clip.tracks.length,
    }));
  }

  /**
   * Play a baked animation by name.
   */
  playAnimation(clipName: string, options: AnimationPlayOptions = {}): AnimationActionHandle | null {
    const action = this.animationActions.get(clipName);
    if (!action) {
      console.warn(`Loom3: Animation clip "${clipName}" not found`);
      return null;
    }

    const {
      speed = 1.0,
      intensity = 1.0,
      loop = true,
      loopMode = 'repeat',
      crossfadeDuration = 0,
      clampWhenFinished = true,
      startTime = 0,
    } = options;

    // Configure action
    action.setEffectiveTimeScale(speed);
    action.setEffectiveWeight(intensity);
    action.clampWhenFinished = clampWhenFinished;

    // Set loop mode
    if (!loop || loopMode === 'once') {
      action.setLoop(LoopOnce, 1);
    } else if (loopMode === 'pingpong') {
      action.setLoop(LoopPingPong, Infinity);
    } else {
      action.setLoop(LoopRepeat, Infinity);
    }

    // Set start time
    if (startTime > 0) {
      action.time = startTime;
    }

    // Handle crossfade
    if (crossfadeDuration > 0) {
      action.reset();
      action.fadeIn(crossfadeDuration);
    } else {
      action.reset();
    }

    // Play the action
    action.play();

    // Track in both maps so updateClipParams can always find it
    this.animationActions.set(clipName, action);
    this.clipActions.set(clipName, action);

    // Create finished promise
    let resolveFinished: () => void;
    const finishedPromise = new Promise<void>((resolve) => {
      resolveFinished = resolve;
    });

    // Store callback for non-looping animations
    if (!loop || loopMode === 'once') {
      this.animationFinishedCallbacks.set(clipName, () => resolveFinished());
    }

    // Return handle (uses same action registration as snippets)
    return this.createAnimationHandle(clipName, action, finishedPromise);
  }

  /**
   * Stop a specific animation by name.
   */
  stopAnimation(clipName: string): void {
    const action = this.animationActions.get(clipName);
    if (action) {
      action.stop();
      this.animationFinishedCallbacks.delete(clipName);
    }
    const clipAction = this.clipActions.get(clipName);
    if (clipAction && clipAction !== action) {
      try { clipAction.stop(); } catch {}
    }
    // Keep entries so params can still target this action/handle; cleanup happens on explicit snippet removal.
  }

  /**
   * Stop all currently playing animations.
   */
  stopAllAnimations(): void {
    for (const [name, action] of this.animationActions) {
      try { action.paused = true; } catch {}
      try { this.animationFinishedCallbacks.delete(name); } catch {}
    }
    for (const [name, action] of this.clipActions) {
      if (!this.animationActions.has(name)) {
        try { action.paused = true; } catch {}
      }
    }
  }

  /**
   * Pause a specific animation by name.
   */
  pauseAnimation(clipName: string): void {
    const action = this.animationActions.get(clipName);
    if (action) {
      action.paused = true;
    }
  }

  /**
   * Resume a paused animation by name.
   */
  resumeAnimation(clipName: string): void {
    const action = this.animationActions.get(clipName);
    if (action) {
      action.paused = false;
    }
  }

  /**
   * Pause all currently playing animations.
   */
  pauseAllAnimations(): void {
    for (const action of this.animationActions.values()) {
      if (action.isRunning()) {
        action.paused = true;
      }
    }
  }

  /**
   * Resume all paused animations.
   */
  resumeAllAnimations(): void {
    for (const action of this.animationActions.values()) {
      if (action.paused) {
        action.paused = false;
      }
    }
  }

  /**
   * Set the playback speed for a specific animation.
   */
  setAnimationSpeed(clipName: string, speed: number): void {
    const action = this.animationActions.get(clipName);
    if (action) {
      action.setEffectiveTimeScale(speed);
    }
  }

  /**
   * Set the intensity/weight for a specific animation.
   */
  setAnimationIntensity(clipName: string, intensity: number): void {
    const action = this.animationActions.get(clipName);
    if (action) {
      action.setEffectiveWeight(Math.max(0, Math.min(1, intensity)));
    }
  }

  /**
   * Set the global time scale for all animations.
   */
  setAnimationTimeScale(timeScale: number): void {
    if (this.animationMixer) {
      this.animationMixer.timeScale = timeScale;
    }
  }

  /**
   * Get the current state of a specific animation.
   */
  getAnimationState(clipName: string): AnimationState | null {
    const action = this.animationActions.get(clipName);
    if (!action) return null;

    const clip = action.getClip();
    return {
      name: clip.name,
      isPlaying: action.isRunning() && !action.paused,
      isPaused: action.paused,
      time: action.time,
      duration: clip.duration,
      speed: action.getEffectiveTimeScale(),
      weight: action.getEffectiveWeight(),
      isLooping: action.loop !== LoopOnce,
    };
  }

  /**
   * Get states of all currently playing animations.
   */
  getPlayingAnimations(): AnimationState[] {
    const playing: AnimationState[] = [];
    for (const [name, action] of this.animationActions) {
      if (action.isRunning()) {
        const state = this.getAnimationState(name);
        if (state) playing.push(state);
      }
    }
    return playing;
  }

  /**
   * Crossfade from current animation(s) to a new animation.
   */
  crossfadeTo(clipName: string, duration = 0.3, options: AnimationPlayOptions = {}): AnimationActionHandle | null {
    // Fade out all currently playing animations
    for (const action of this.animationActions.values()) {
      if (action.isRunning()) {
        action.fadeOut(duration);
      }
    }

    // Play new animation with fade in
    return this.playAnimation(clipName, {
      ...options,
      crossfadeDuration: duration,
    });
  }

  /**
   * Create an animation handle for controlling a playing animation.
   */
  private createAnimationHandle(
    clipName: string,
    action: AnimationAction,
    finishedPromise: Promise<void>
  ): AnimationActionHandle {
    return {
      stop: () => this.stopAnimation(clipName),
      pause: () => this.pauseAnimation(clipName),
      resume: () => this.resumeAnimation(clipName),
      setSpeed: (speed: number) => this.setAnimationSpeed(clipName, speed),
      setWeight: (weight: number) => this.setAnimationIntensity(clipName, weight),
      seekTo: (time: number) => {
        action.time = Math.max(0, Math.min(time, action.getClip().duration));
      },
      getState: () => this.getAnimationState(clipName)!,
      crossfadeTo: (targetClip: string, dur?: number) => this.crossfadeTo(targetClip, dur),
      finished: finishedPromise,
    };
  }

  // ============================================================================
  // SNIPPET-TO-CLIP API (Dynamic clip construction from AU curves)
  // TODO: Integrate with AnimationMixer for smooth clip-based playback
  // ============================================================================

  /**
   * Convert a snippet's curves to a Three.js AnimationClip.
   *
   * This builds keyframe tracks for each AU/morph in the curves,
   * creating a clip that can be played via the AnimationMixer.
   *
   * Strategy:
   * - Morph targets are animated via NumberKeyframeTrack
   * - Composite bone rotations are animated via QuaternionKeyframeTrack
   * - Bone translations use NumberKeyframeTrack on position axes
   *
   * @param clipName - Unique name for the clip
   * @param curves - Map of AU IDs or morph names to keyframe arrays
   * @param options - Playback options (loop, playbackRate, etc.)
   * @returns The constructed AnimationClip, or null if curves are empty
   */
  snippetToClip(
    clipName: string,
    curves: CurvesMap,
    options?: ClipOptions
  ): AnimationClip | null {
    if (!this.model) {
      console.warn(`[Loom3] snippetToClip: No model loaded for "${clipName}"`);
      return null;
    }
    if (Object.keys(curves).length === 0) {
      console.warn(`[Loom3] snippetToClip: Empty curves for "${clipName}"`);
      return null;
    }
    // Intentionally quiet to avoid per-frame logging in continuous tracking.

    const tracks: Array<NumberKeyframeTrack | QuaternionKeyframeTrack> = [];
    const intensityScale = options?.intensityScale ?? 1.0;
    const balance = options?.balance ?? 0;
    let maxTime = 0;

    // Helper to check if a curve ID is a numeric AU
    const isNumericAU = (id: string) => /^\d+$/.test(id);

    // Helper to check if a curve ID is a viseme index (0-14)
    // ONLY returns true when snippetCategory is 'visemeSnippet' - otherwise numeric IDs are AU IDs
    const isVisemeIndex = (id: string) => {
      if (options?.snippetCategory !== 'visemeSnippet') return false;
      const num = Number(id);
      return !Number.isNaN(num) && num >= 0 && num < this.config.visemeKeys.length;
    };

    const sampleAt = (arr: Array<{ time: number; intensity: number }>, t: number) => {
      if (!arr.length) return 0;
      if (t <= arr[0].time) return arr[0].intensity;
      if (t >= arr[arr.length - 1].time) return arr[arr.length - 1].intensity;
      for (let i = 0; i < arr.length - 1; i++) {
        const a = arr[i];
        const b = arr[i + 1];
        if (t >= a.time && t <= b.time) {
          const dt = Math.max(1e-6, b.time - a.time);
          const p = (t - a.time) / dt;
          return a.intensity + (b.intensity - a.intensity) * p;
        }
      }
      return 0;
    };

    const clampIntensity = (v: number) => Math.max(0, Math.min(2, v));
    const sampleCurve = (curveId: string, t: number) => {
      const arr = curves[curveId];
      if (!arr) return 0;
      return clampIntensity(sampleAt(arr, t) * intensityScale);
    };

    const keyframeTimes = (() => {
      const times = new Set<number>();
      Object.values(curves).forEach((arr) => {
        arr.forEach((kf) => times.add(kf.time));
      });
      return Array.from(times).sort((a, b) => a - b);
    })();

    // Process each curve
    for (const [curveId, keyframes] of Object.entries(curves)) {
      if (!keyframes || keyframes.length === 0) continue;

      // Track max time for clip duration
      const curveMaxTime = keyframes[keyframes.length - 1].time;
      if (curveMaxTime > maxTime) maxTime = curveMaxTime;

      // Determine what type of curve this is
      if (isNumericAU(curveId)) {
        const auId = Number(curveId);

        // Check if this is a viseme index (0-14) - these map to viseme morphs
        if (isVisemeIndex(curveId)) {
          const visemeKey = this.config.visemeKeys[auId];
          if (visemeKey) {
            this.addMorphTracks(tracks, visemeKey, keyframes, intensityScale);
          }
        } else {
          // Regular AU - resolve to morph targets
          const morphKeys = this.config.auToMorphs[auId] || [];
          const mixWeight = this.isMixedAU(auId) ? this.getAUMixWeight(auId) : 1.0;

          for (const morphKey of morphKeys) {
            // Apply balance for L/R morphs
            let effectiveScale = intensityScale * mixWeight;
            if (balance !== 0) {
              const isLeft = /(_L$| L$|Left$)/i.test(morphKey);
              const isRight = /(_R$| R$|Right$)/i.test(morphKey);
              if (isLeft && balance > 0) effectiveScale *= (1 - balance);
              if (isRight && balance < 0) effectiveScale *= (1 + balance);
            }

            this.addMorphTracks(tracks, morphKey, keyframes, effectiveScale);
          }

        }
      } else {
        // Direct morph name (e.g., 'Brow_Drop_L', 'viseme_aa', etc.)
        this.addMorphTracks(tracks, curveId, keyframes, intensityScale);
      }
    }

    // Build composite bone rotation tracks (QuaternionKeyframeTrack)
    if (keyframeTimes.length > 0) {
      const hasCurveAU = new Set<number>(
        Object.keys(curves)
          .filter(isNumericAU)
          .map((id) => Number(id))
      );

      const getAxisBinding = (
        nodeKey: BoneKey,
        axisConfig: CompositeRotation['pitch'] | CompositeRotation['yaw'] | CompositeRotation['roll'],
        axisValue: number,
        t: number
      ) => {
        if (!axisConfig) return null;

        if (axisConfig.negative !== undefined && axisConfig.positive !== undefined) {
          const auId = axisValue < 0 ? axisConfig.negative : axisConfig.positive;
          return this.config.auToBones[auId]?.find((b) => b.node === nodeKey) ?? null;
        }

        if (axisConfig.aus.length > 1) {
          let maxAU = axisConfig.aus[0];
          let maxVal = sampleCurve(String(maxAU), t);
          for (const auId of axisConfig.aus) {
            const val = sampleCurve(String(auId), t);
            if (val > maxVal) {
              maxVal = val;
              maxAU = auId;
            }
          }
          return this.config.auToBones[maxAU]?.find((b) => b.node === nodeKey) ?? null;
        }

        const auId = axisConfig.aus[0];
        return this.config.auToBones[auId]?.find((b) => b.node === nodeKey) ?? null;
      };

      const getAxisValue = (
        axisConfig: CompositeRotation['pitch'] | CompositeRotation['yaw'] | CompositeRotation['roll'],
        t: number
      ) => {
        if (!axisConfig) return 0;

        if (axisConfig.negative !== undefined && axisConfig.positive !== undefined) {
          const posValue = sampleCurve(String(axisConfig.positive), t);
          const negValue = sampleCurve(String(axisConfig.negative), t);
          return posValue - negValue;
        }

        if (axisConfig.aus.length > 1) {
          let maxVal = 0;
          for (const auId of axisConfig.aus) {
            const val = sampleCurve(String(auId), t);
            if (val > maxVal) maxVal = val;
          }
          return maxVal;
        }

        return sampleCurve(String(axisConfig.aus[0]), t);
      };

      const isLeftNode = (nodeKey: string) => /_L$|_L_|^GILL_L/.test(nodeKey);
      const isRightNode = (nodeKey: string) => /_R$|_R_|^GILL_R/.test(nodeKey);

      for (const composite of this.compositeRotations) {
        const nodeKey = composite.node as BoneKey;
        const entry = this.bones[nodeKey];
        if (!entry) {
          console.log(`[snippetToClip] Skipping composite for "${nodeKey}" - bone not resolved`);
          continue;
        }

        const hasRelevantAU = [composite.pitch, composite.yaw, composite.roll]
          .filter(Boolean)
          .some((axisConfig) => axisConfig!.aus.some((auId) => hasCurveAU.has(auId)));

        if (!hasRelevantAU) {
          continue;
        }

        const values: number[] = [];

        for (const t of keyframeTimes) {
          const compositeQ = new Quaternion().copy(entry.baseQuat);

          const applyAxis = (
            axisConfig: CompositeRotation['pitch'] | CompositeRotation['yaw'] | CompositeRotation['roll']
          ) => {
            if (!axisConfig) return;
            let axisValue = getAxisValue(axisConfig, t);
            if (Math.abs(axisValue) <= 1e-6) return;

            const sign = axisValue < 0 ? -1 : 1;
            const { left, right } = this.computeSideValues(Math.abs(axisValue), balance);
            if (isLeftNode(nodeKey)) axisValue = sign * left;
            if (isRightNode(nodeKey)) axisValue = sign * right;

            const binding = getAxisBinding(nodeKey, axisConfig, axisValue, t);
            if (!binding?.maxDegrees || !binding.channel) return;

            const radians = deg2rad(binding.maxDegrees) * Math.abs(axisValue) * binding.scale;
            const axis = binding.channel === 'rx' ? X_AXIS : binding.channel === 'ry' ? Y_AXIS : Z_AXIS;
            const deltaQ = new Quaternion().setFromAxisAngle(axis, radians);
            compositeQ.multiply(deltaQ);
          };

          applyAxis(composite.yaw);
          applyAxis(composite.pitch);
          applyAxis(composite.roll);

          values.push(compositeQ.x, compositeQ.y, compositeQ.z, compositeQ.w);
        }

        // Use UUID to avoid issues with dots in bone names (e.g., "Bone.001_Armature")
        // Three.js PropertyBinding uses dots as path separators, so names with dots fail
        const trackName = `${(entry.obj as any).uuid}.quaternion`;
        tracks.push(new QuaternionKeyframeTrack(trackName, keyframeTimes, values));
      }

      // Translation-only bone bindings (tx/ty/tz)
      for (const curveId of Object.keys(curves)) {
        if (!isNumericAU(curveId)) continue;
        const auId = Number(curveId);
        const bindings = this.config.auToBones[auId] || [];
        const curve = curves[curveId];
        if (!curve || curve.length === 0) continue;

        for (const binding of bindings) {
          if (binding.channel !== 'tx' && binding.channel !== 'ty' && binding.channel !== 'tz') continue;
          const entry = this.bones[binding.node as BoneKey];
          if (!entry || binding.maxUnits === undefined) continue;

          const axisIndex: 'x' | 'y' | 'z' = binding.channel === 'tx' ? 'x' : binding.channel === 'ty' ? 'y' : 'z';
          const basePos = entry.basePos[axisIndex];
          const values: number[] = [];

          for (const t of keyframeTimes) {
            const v = sampleCurve(curveId, t);
            const delta = v * binding.maxUnits * binding.scale;
            values.push(basePos + delta);
          }

          // Use UUID to avoid issues with dots in bone names
          const trackName = `${(entry.obj as any).uuid}.position[${axisIndex}]`;
          tracks.push(new NumberKeyframeTrack(trackName, keyframeTimes, values));
        }
      }
    }

    if (tracks.length === 0) {
      console.warn(`[Loom3] snippetToClip: No tracks created for "${clipName}"`);
      return null;
    }

    // Create the clip with calculated duration
    const clip = new AnimationClip(clipName, maxTime, tracks);
    console.log(`[Loom3] snippetToClip: Created clip "${clipName}" with ${tracks.length} tracks, duration ${maxTime.toFixed(2)}s`);

    return clip;
  }

  /**
   * Add NumberKeyframeTrack(s) for a morph target across all meshes that have it.
   */
  private addMorphTracks(
    tracks: Array<NumberKeyframeTrack | QuaternionKeyframeTrack>,
    morphKey: string,
    keyframes: Array<{ time: number; intensity: number }>,
    intensityScale: number
  ): void {
    const targetMeshNames = this.config.morphToMesh?.face || [];
    const targetMeshes = targetMeshNames.length
      ? targetMeshNames.map((name) => this.meshByName.get(name)).filter(Boolean) as Mesh[]
      : this.meshes;
    let added = false;

    const addTrackForMesh = (mesh: Mesh) => {
      const dict = mesh.morphTargetDictionary;
      if (!dict || dict[morphKey] === undefined) return;

      const morphIndex = dict[morphKey];

      // Build times and values arrays
      const times: number[] = [];
      const values: number[] = [];

      for (const kf of keyframes) {
        times.push(kf.time);
        values.push(Math.max(0, Math.min(2, kf.intensity * intensityScale)));
      }

      // Create the track with the proper path format for morph targets
      // Use UUID to avoid issues with dots in mesh names (PropertyBinding uses dots as path separators)
      const trackName = `${(mesh as any).uuid}.morphTargetInfluences[${morphIndex}]`;
      const track = new NumberKeyframeTrack(trackName, times, values);

      tracks.push(track);
      added = true;
    };

    for (const mesh of targetMeshes) {
      addTrackForMesh(mesh);
    }

    // Fallback: if target mesh list didn't contain this morph, try all meshes.
    if (!added && targetMeshes !== this.meshes) {
      for (const mesh of this.meshes) {
        addTrackForMesh(mesh);
      }
    }
  }

  /**
   * Play a pre-built AnimationClip via the mixer.
   *
   * @param clip - The AnimationClip to play
   * @param options - Playback options
   * @returns ClipHandle for controlling playback, or null if mixer not ready
   */
  playClip(clip: AnimationClip, options?: ClipOptions): ClipHandle | null {
    // Ensure mixer exists (create if needed)
    this.ensureMixer();

    if (!this.animationMixer) {
      console.warn('[Loom3] playClip: No model loaded, cannot create mixer');
      return null;
    }

    const {
      loop = false,
      loopMode,
      reverse = false,
      playbackRate = 1.0,
      mixerWeight,
    } = options || {};

    // Reuse existing action if present; otherwise create a new one.
    let action = this.clipActions.get(clip.name);
    let actionId = action ? (this.actionIds.get(action) || (action as any).__actionId) : undefined;
    // Ensure every tracked action has a stable id (even if it was created before we added ids)
    if (action && !actionId) {
      actionId = makeActionId();
      this.actionIds.set(action, actionId);
      this.actionIdToClip.set(actionId, clip.name);
      (action as any).__actionId = actionId;
    }
    if (!action) {
      action = this.animationMixer.clipAction(clip);
      actionId = makeActionId();
      this.actionIds.set(action, actionId);
      this.actionIdToClip.set(actionId, clip.name);
      (action as any).__actionId = actionId;
    }

    // Track this clip in the baked list so playAnimation can reuse it
    const existingClip = this.animationClips.find(c => c.name === clip.name);
    if (!existingClip) {
      this.animationClips.push(clip);
    }

    // Configure action
    const timeScale = reverse ? -playbackRate : playbackRate;
    action.setEffectiveTimeScale(timeScale);
    // Mixer weight controls overall contribution; default to 1.0 when unspecified
    const weight = typeof mixerWeight === 'number' ? mixerWeight : 1.0;
    action.setEffectiveWeight(weight);
    const mode = loopMode || (loop ? 'repeat' : 'once');
    action.clampWhenFinished = mode === 'once';

    // Set loop mode
    if (mode === 'pingpong') {
      action.setLoop(LoopPingPong, Infinity);
    } else if (mode === 'once') {
      action.setLoop(LoopOnce, 1);
    } else {
      action.setLoop(LoopRepeat, Infinity);
    }

    // Track for finished callback
    let resolveFinished: () => void;
    let rejectFinished: (reason?: any) => void;
    const finishedPromise = new Promise<void>((resolve, reject) => {
      resolveFinished = resolve;
      rejectFinished = reject;
    });

    const cleanup = () => {
      // Keep actions/handles; just pause so params can still target it.
      try { this.animationFinishedCallbacks.delete(clip.name); } catch {}
      try { action.paused = true; } catch {}
    };

    // Always register a finished callback; for looping clips it will only fire if loop mode is later changed to 'once'.
    this.animationFinishedCallbacks.set(clip.name, () => {
      resolveFinished();
      cleanup();
    });
    finishedPromise.catch(() => cleanup());

    // Reset and play
    action.reset();
    action.play();

    this.clipActions.set(clip.name, action);
    // Also mirror into animationActions so all clips (baked or built) share one update surface
    this.animationActions.set(clip.name, action);
    console.log(`[Loom3] playClip: Playing "${clip.name}" (rate: ${playbackRate}, loop: ${loop}, actionId: ${actionId})`);

    // Build ClipHandle
    const handle: ClipHandle = {
      clipName: clip.name,
      actionId,

      play: () => {
        action.reset();
        action.play();
      },

      stop: () => {
        action.stop();
        this.animationFinishedCallbacks.delete(clip.name);
        resolveFinished();
        cleanup();
      },

      pause: () => {
        action.paused = true;
      },

      resume: () => {
        action.paused = false;
      },

      setWeight: (w: number) => {
        action.setEffectiveWeight(typeof w === 'number' && Number.isFinite(w) ? w : 1.0);
      },

      setPlaybackRate: (r: number) => {
        const rate = Number.isFinite(r) ? r : 1.0;
        action.setEffectiveTimeScale(rate);
      },

      setLoop: (mode: 'once' | 'repeat' | 'pingpong') => {
        if (mode === 'pingpong') {
          action.setLoop(LoopPingPong, Infinity);
        } else if (mode === 'once') {
          action.setLoop(LoopOnce, 1);
        } else {
          action.setLoop(LoopRepeat, Infinity);
        }
      },

      getTime: () => action.time,

      getDuration: () => clip.duration,

      finished: finishedPromise,
    };
    // Track handle by clip name for scheduler-driven param updates
    this.clipHandles.set(clip.name, handle);

    return handle;
  }

  /**
   * Play a snippet directly by converting it to a clip and playing.
   *
   * This is a convenience method that combines snippetToClip + playClip.
   *
   * @param snippet - The snippet to play (or just name + curves)
   * @param options - Playback options
   * @returns ClipHandle for controlling playback, or null if failed
   *
   * TODO: Currently returns null - implement when snippetToClip is ready
   */
  playSnippet(
    snippet: Snippet | { name: string; curves: CurvesMap },
    options?: ClipOptions
  ): ClipHandle | null {
    const clip = this.snippetToClip(snippet.name, snippet.curves, options);
    if (!clip) {
      return null;
    }
    return this.playClip(clip, options);
  }

  /**
   * Build a clip from curves and return a handle (for scheduler compatibility).
   *
   * This is the method that the animation scheduler looks for.
   * When available, the scheduler uses this instead of per-keyframe transitions.
   *
   * Note: This handles MORPH TARGET animations via the Three.js mixer.
   * Bone rotations are still handled by the RAF-based transition system
   * since converting AU curves to quaternion keyframes is complex.
   *
   * @param clipName - Unique name for the clip
   * @param curves - Map of curve IDs to keyframe arrays
   * @param options - Playback options
   * @returns ClipHandle or null if no morph tracks could be created
   */
  buildClip(
    clipName: string,
    curves: CurvesMap,
    options?: ClipOptions
  ): ClipHandle | null {
    const clip = this.snippetToClip(clipName, curves, options);
    if (!clip) {
      return null;
    }
    return this.playClip(clip, options);
  }

  /**
   * Cleanup any mixer actions/clips associated with a snippet name.
   * Called by the animation scheduler when snippets are removed.
   */
  cleanupSnippet(name: string) {
    if (!this.animationMixer || !this.model) return;
    // Soft cleanup: pause actions but keep mappings so updates can still target them (parity with baked clips).
    for (const [clipName, action] of Array.from(this.clipActions.entries())) {
      if (clipName === name || clipName.startsWith(`${name}_`)) {
        try { action.paused = true; } catch {}
      }
    }
  }

  /**
   * Live-update mixer action params for a snippet.
   */
  updateClipParams(name: string, params: { weight?: number; rate?: number; loop?: boolean; loopMode?: 'once' | 'repeat' | 'pingpong'; reverse?: boolean; actionId?: string }): boolean {
    let updated = false;
    const matches = (clipName: string, action?: AnimationAction | null) => {
      if (params.actionId) {
        const aid = action ? this.actionIds.get(action) : this.actionIdToClip.get(params.actionId);
        if (aid && aid === params.actionId) return true;
      }
      return clipName === name || clipName.startsWith(`${name}_`) || clipName.includes(name);
    };

    const debugSnapshot = () => ({
      target: name,
      params,
      clipActions: Array.from(this.clipActions.entries()).map(([k, a]) => ({ name: k, actionId: this.actionIds.get(a) || (a as any).__actionId })),
      animationActions: Array.from(this.animationActions.entries()).map(([k, a]) => ({ name: k, actionId: this.actionIds.get(a) || (a as any).__actionId })),
      clipHandles: Array.from(this.clipHandles.entries()).map(([k, h]) => ({ name: k, actionId: h.actionId })),
      mixerActions: ((this.animationMixer as any)?._actions || []).map((a: any) => ({ name: a?.getClip?.()?.name || '', actionId: this.actionIds.get(a) || (a as any).__actionId })),
    });

    console.log('[Loom3] updateClipParams start', debugSnapshot());

    const apply = (action: AnimationAction | null | undefined) => {
      if (!action) return;
      try { action.paused = false; } catch {}
      if (typeof params.weight === 'number' && Number.isFinite(params.weight)) {
        action.setEffectiveWeight(params.weight);
        updated = true;
      }
      if (typeof params.rate === 'number' && Number.isFinite(params.rate)) {
        const signedRate = params.reverse ? -params.rate : params.rate;
        action.setEffectiveTimeScale(signedRate);
        updated = true;
      } else if (typeof params.reverse === 'boolean') {
        const current = action.getEffectiveTimeScale?.() ?? 1;
        const magnitude = Math.abs(current) || 1;
        const signedRate = params.reverse ? -magnitude : magnitude;
        action.setEffectiveTimeScale(signedRate);
        updated = true;
      }
      const mode = params.loopMode || (typeof params.loop === 'boolean' ? (params.loop ? 'repeat' : 'once') : undefined);
      if (mode) {
        if (mode === 'pingpong') {
          action.setLoop(LoopPingPong, Infinity);
        } else if (mode === 'once') {
          action.setLoop(LoopOnce, 1);
        } else {
          action.setLoop(LoopRepeat, Infinity);
        }
        updated = true;
      }
    };

    // Use tracked actions first
    if (this.animationMixer && this.model) {
      for (const [clipName, action] of Array.from(this.clipActions.entries())) {
        if (matches(clipName, action)) {
          apply(action);
        }
      }
      // Also update baked/preloaded actions
      for (const [clipName, action] of Array.from(this.animationActions.entries())) {
        if (matches(clipName, action)) {
          apply(action);
        }
      }

      // Fallback: scan mixer actions
      const mixer: any = this.animationMixer as any;
      const actions: any[] = mixer?._actions || [];
      for (const action of actions) {
        try {
          const clip = action.getClip?.();
          if (!clip) continue;
          const clipName = clip.name || '';
          if (matches(clipName, action)) {
            apply(action);
          }
        } catch {}
      }

      // Last resort: ask mixer for an action by name (covers untracked actions)
      try {
        const clipAsset = this.animationClips.find(c => c.name === name);
        const direct = this.animationMixer.clipAction((clipAsset as any) ?? (name as any), this.model as any);
        if (direct && clipAsset) {
          const aid = params.actionId || this.actionIds.get(direct) || (direct as any).__actionId || makeActionId();
          this.actionIds.set(direct, aid);
          this.actionIdToClip.set(aid, clipAsset.name);
          (direct as any).__actionId = aid;
          this.clipActions.set(clipAsset.name, direct);
          this.animationActions.set(clipAsset.name, direct);
        }
        apply(direct);
      } catch {}
    }

    // Fallback: update via cached clip handles when actions are not yet tracked
    for (const [clipName, handle] of Array.from(this.clipHandles.entries())) {
      if (!matches(clipName)) continue;
      if (typeof params.weight === 'number' && handle.setWeight) {
        try { handle.setWeight(params.weight); updated = true; } catch {}
      }
      if (typeof params.rate === 'number' && handle.setPlaybackRate) {
        const signedRate = params.reverse ? -params.rate : params.rate;
        try { handle.setPlaybackRate(signedRate); updated = true; } catch {}
      } else if (typeof params.reverse === 'boolean' && handle.setPlaybackRate) {
        try {
          const signedRate = params.reverse ? -1 : 1;
          handle.setPlaybackRate(signedRate);
          updated = true;
        } catch {}
      }
      const mode = params.loopMode || (typeof params.loop === 'boolean' ? (params.loop ? 'repeat' : 'once') : undefined);
      if (mode && (handle as any).setLoop) {
        try { (handle as any).setLoop(mode as any); updated = true; } catch {}
      }

      // If we have a handle but no live action, rehydrate an action from the cached clip
      if (!updated && this.animationMixer) {
        const clipAsset = this.animationClips.find(c => c.name === clipName);
        if (clipAsset) {
          try {
            const newAction = this.animationMixer.clipAction(clipAsset);
            const aid = handle.actionId || makeActionId();
            this.actionIds.set(newAction, aid);
            this.actionIdToClip.set(aid, clipAsset.name);
            (newAction as any).__actionId = aid;
            this.clipActions.set(clipAsset.name, newAction);
            this.animationActions.set(clipAsset.name, newAction);
            const applyNew = () => apply(newAction);
            applyNew();
            updated = true;
            console.log('[Loom3] rehydrated action from cached clip', { clip: clipAsset.name, actionId: aid });
          } catch {}
        }
      }
    }

    if (!updated) {
      console.warn(`[Loom3] updateClipParams: no action matched "${name}"`, debugSnapshot());
    } else {
      console.log('[Loom3] updateClipParams applied', { target: name, actionId: params.actionId });
    }

    return updated;
  }

  /**
   * Check if curves can be played through buildClip.
   * Returns false if curves contain bone-only AUs that can't be baked to morph tracks.
   */
  supportsClipCurves(
    curves: Record<string, Array<{ time: number; intensity: number; inherit?: boolean }>>
  ): boolean {
    // Currently all curve-based playback is supported - bone AUs are handled via
    // quaternion tracks in the generated clip
    return Object.keys(curves).length > 0;
  }
}

/**
 * Helper function to collect meshes with morph targets from a scene.
 */
export function collectMorphMeshes(root: Object3D): Mesh[] {
  const meshes: Mesh[] = [];
  root.traverse((obj: any) => {
    if (obj.isMesh) {
      const dict = obj.morphTargetDictionary;
      const infl = obj.morphTargetInfluences;
      if ((dict && Object.keys(dict).length > 0) || (Array.isArray(infl) && infl.length > 0)) {
        meshes.push(obj);
      }
    }
  });
  return meshes;
}
