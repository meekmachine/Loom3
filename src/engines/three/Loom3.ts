/**
 * Loom3 - Three.js Implementation
 *
 * Default implementation of the LoomLarge interface for Three.js.
 * Controls 3D character facial animation using Action Units (AUs),
 * morph targets, visemes, and bone transformations.
 */

import {
  Quaternion,
  Vector3,
  Box3,
  Clock,
} from 'three';
import type { Mesh, Object3D, AnimationClip } from 'three';
import type {
  LoomLarge,
  ReadyPayload,
  LoomLargeConfig,
} from '../../interfaces/LoomLarge';
import type { MeshInfo, MorphTargetRef, Profile, HairPhysicsProfileConfig } from '../../mappings/types';
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
import { AnimationThree, BakedAnimationController } from './AnimationThree';
import { HairPhysicsController, type HairPhysicsConfig, type HairPhysicsConfigUpdate, type HairPhysicsDirectionConfig, type HairMorphTargets } from './hair/HairPhysicsController';
import { CC4_PRESET, CC4_MESHES, COMPOSITE_ROTATIONS as CC4_COMPOSITE_ROTATIONS } from '../../presets/cc4';
import { resolvePreset } from '../../presets';
import { resolveProfile } from '../../mappings/resolveProfile';
import type { CompositeRotation, BoneBinding } from '../../core/types';
import type { NodeBase, ResolvedBones } from './types';

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

type MorphTargetHandle = { infl: number[]; idx: number };
type ResolvedMorphTargetsBySide = {
  left: MorphTargetHandle[];
  right: MorphTargetHandle[];
  center: MorphTargetHandle[];
};

export class Loom3 implements LoomLarge {
  // Optional hook for animation schedulers.
  onSnippetEnd?: (name: string) => void;

  // Configuration
  private config: Profile;

  // Animation driver (injectable)
  private animation: {
    tick(dtSeconds: number): void;
    addTransition(
      key: string,
      from: number,
      to: number,
      durationMs: number,
      apply: (value: number) => void,
      easing?: (t: number) => number
    ): TransitionHandle;
    clearTransitions(): void;
    getActiveTransitionCount(): number;
  };

  // Composite rotation mappings (built from config or default CC4)
  private compositeRotations: CompositeRotation[];
  private auToCompositeMap: Map<number, { nodes: string[]; axis: 'pitch' | 'yaw' | 'roll' }>;

  // State
  private auValues: Record<number, number> = {};
  private auBalances: Record<number, number> = {};  // Balance values per AU (-1 to 1)
  private rigReady = false;
  private missingBoneWarnings = new Set<string>();

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
  private morphKeyCache = new Map<string, MorphTargetHandle[]>();
  private morphIndexCache = new Map<string, MorphTargetHandle[]>();
  private resolvedAUMorphTargets = new Map<number, ResolvedMorphTargetsBySide>();
  private resolvedVisemeTargets: MorphTargetHandle[][] = [];

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

  private bakedAnimations: BakedAnimationController;
  private hairPhysics: HairPhysicsController;

  // Internal animation loop
  private clock = new Clock(false); // Don't auto-start
  private animationFrameId: number | null = null;
  private isRunning = false;

  constructor(
    config: LoomLargeConfig = {},
    animation?: {
      tick(dtSeconds: number): void;
      addTransition(
        key: string,
        from: number,
        to: number,
        durationMs: number,
        apply: (value: number) => void,
        easing?: (t: number) => number
      ): TransitionHandle;
      clearTransitions(): void;
      getActiveTransitionCount(): number;
    }
  ) {
    const basePreset = config.presetType ? resolvePreset(config.presetType) : CC4_PRESET;
    this.config = config.profile ? resolveProfile(basePreset, config.profile) : basePreset;
    this.mixWeights = { ...this.config.auMixDefaults };
    this.animation = animation || new AnimationThree();

    // Use config's composite rotations or default to CC4
    this.compositeRotations = this.config.compositeRotations || CC4_COMPOSITE_ROTATIONS;
    this.auToCompositeMap = buildAUToCompositeMap(this.compositeRotations);

    this.hairPhysics = new HairPhysicsController({
      getMeshByName: (name) => this.meshByName.get(name),
      buildClip: (clipName, curves, options) => this.buildClip(clipName, curves, options),
      cleanupSnippet: (name) => this.cleanupSnippet(name),
    });

    this.bakedAnimations = new BakedAnimationController({
      getModel: () => this.model,
      getMeshes: () => this.meshes,
      getMeshByName: (name) => this.meshByName.get(name),
      getBones: () => this.bones,
      getConfig: () => this.config,
      getCompositeRotations: () => this.compositeRotations,
      computeSideValues: (base, balance) => this.computeSideValues(base, balance),
      getAUMixWeight: (auId) => this.getAUMixWeight(auId),
      isMixedAU: (auId) => this.isMixedAU(auId),
    });

    this.applyHairPhysicsProfileConfig();
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
    this.morphKeyCache.clear();
    this.morphIndexCache.clear();

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

    // Auto-detect face morph meshes only if preset/profile doesn't define them.
    // When morphToMesh.face is already configured (e.g., CC4 preset specifies
    // body + eyebrows + occlusion + tear lines), trust that configuration.
    if (!this.config.morphToMesh?.face || this.config.morphToMesh.face.length === 0) {
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
    }

    this.rebuildMorphTargetsCache();

    if (this.resolvedFaceMeshes.length > 0) {
      for (const faceName of this.resolvedFaceMeshes) {
        const faceMesh = this.meshByName.get(faceName);
        const morphKeys = faceMesh?.morphTargetDictionary
          ? Object.keys(faceMesh.morphTargetDictionary)
          : [];
        console.log('[Loom3] Face mesh resolved:', faceName);
        console.log('[Loom3] Face mesh morphs:', morphKeys);
      }
    } else {
      console.log('[Loom3] No face mesh resolved from morph targets.');
    }

    // Apply render order and material settings from CC4_MESHES
    this.applyMeshMaterialSettings(model);
  }

  private rebuildMorphTargetsCache(): void {
    this.morphKeyCache.clear();
    this.morphIndexCache.clear();
    this.resolvedAUMorphTargets.clear();
    this.resolvedVisemeTargets = [];

    if (!this.meshes.length) return;

    const resolveTargetsForKeys = (keys: MorphTargetRef[], meshNames: string[]): MorphTargetHandle[] => {
      if (!keys || keys.length === 0) return [];
      const targets: MorphTargetHandle[] = [];
      for (const key of keys) {
        const resolved = typeof key === 'number'
          ? this.resolveMorphTargetsByIndex(key, meshNames)
          : this.resolveMorphTargets(key, meshNames);
        if (resolved.length > 0) {
          targets.push(...resolved);
        }
      }
      return targets;
    };

    for (const [auIdStr, entry] of Object.entries(this.config.auToMorphs || {})) {
      const auId = Number(auIdStr);
      if (Number.isNaN(auId) || !entry) continue;
      const meshNames = this.getMeshNamesForAU(auId);
      const resolved: ResolvedMorphTargetsBySide = {
        left: resolveTargetsForKeys(entry.left, meshNames),
        right: resolveTargetsForKeys(entry.right, meshNames),
        center: resolveTargetsForKeys(entry.center, meshNames),
      };
      this.resolvedAUMorphTargets.set(auId, resolved);
    }

    for (let i = 0; i < (this.config.visemeKeys || []).length; i += 1) {
      const key = this.config.visemeKeys[i];
      const targets = typeof key === 'number'
        ? this.resolveMorphTargetsByIndex(key)
        : this.resolveMorphTargets(key);
      this.resolvedVisemeTargets[i] = targets;
    }
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

    this.bakedAnimations.update(dtSeconds);
    this.hairPhysics.update(dtSeconds);
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
    this.bakedAnimations.dispose();
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
    // If v < 0 and this AU has a continuum pair, forward to setContinuum
    if (v < 0 && this.config.continuumPairs) {
      const pairInfo = this.config.continuumPairs[id];
      if (pairInfo) {
        const negAU = pairInfo.isNegative ? id : pairInfo.pairId;
        const posAU = pairInfo.isNegative ? pairInfo.pairId : id;
        const continuumValue = pairInfo.isNegative ? -v : v;
        this.setContinuum(negAU, posAU, continuumValue, balance);
        return;
      }
    }

    this.auValues[id] = v;
    // Store balance for this AU (used by bilateral bone AUs like fish gills)
    if (balance !== undefined) {
      this.auBalances[id] = balance;
    }

    const resolvedMorphTargets = this.resolvedAUMorphTargets.get(id);
    const { left: leftKeys, right: rightKeys, center: centerKeys } = this.getAUMorphsBySide(id);

    if (resolvedMorphTargets) {
      const mixWeight = this.isMixedAU(id) ? this.getAUMixWeight(id) : 1.0;
      const base = clamp01(v) * mixWeight;
      const { left: leftVal, right: rightVal } = this.computeSideValues(base, balance);

      if (resolvedMorphTargets.left.length || resolvedMorphTargets.right.length) {
        for (const t of resolvedMorphTargets.left) {
          t.infl[t.idx] = leftVal;
        }
        for (const t of resolvedMorphTargets.right) {
          t.infl[t.idx] = rightVal;
        }
      }

      for (const t of resolvedMorphTargets.center) {
        t.infl[t.idx] = base;
      }
    } else if (leftKeys.length || rightKeys.length || centerKeys.length) {
      const mixWeight = this.isMixedAU(id) ? this.getAUMixWeight(id) : 1.0;
      const base = clamp01(v) * mixWeight;
      const meshNames = this.getMeshNamesForAU(id);

      const { left: leftVal, right: rightVal } = this.computeSideValues(base, balance);

      if (leftKeys.length || rightKeys.length) {
        for (const k of leftKeys) {
          if (typeof k === 'number') this.setMorphInfluence(k, leftVal, meshNames);
          else this.setMorph(k, leftVal, meshNames);
        }
        for (const k of rightKeys) {
          if (typeof k === 'number') this.setMorphInfluence(k, rightVal, meshNames);
          else this.setMorph(k, rightVal, meshNames);
        }
      }

      for (const k of centerKeys) {
        if (typeof k === 'number') this.setMorphInfluence(k, base, meshNames);
        else this.setMorph(k, base, meshNames);
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

        // Apply balance based on mapping-provided side hints, not name heuristics.
        const auBoneBindings = this.config.auToBones[id] || [];
        const sideByNode = new Map<string, 'left' | 'right'>();
        for (const binding of auBoneBindings) {
          if (binding.side === 'left' || binding.side === 'right') {
            sideByNode.set(binding.node, binding.side);
          }
        }
        const side = sideByNode.get(nodeKey);
        if (side) {
          const baseValue = clamp01(v);
          const balanceValue = side === 'left' ? leftVal : rightVal;
          const denom = baseValue > 0 ? baseValue : 1;
          axisValue = axisValue * (balanceValue / denom);
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
    // If to < 0 and this AU has a continuum pair, forward to transitionContinuum
    if (to < 0 && this.config.continuumPairs) {
      const pairInfo = this.config.continuumPairs[numId];
      if (pairInfo) {
        const negAU = pairInfo.isNegative ? numId : pairInfo.pairId;
        const posAU = pairInfo.isNegative ? pairInfo.pairId : numId;
        const continuumValue = pairInfo.isNegative ? -to : to;
        return this.transitionContinuum(negAU, posAU, continuumValue, durationMs, balance);
      }
    }

    const target = clamp01(to);

    const { left: leftKeys, right: rightKeys, center: centerKeys } = this.getAUMorphsBySide(numId);
    const bindings = this.config.auToBones[numId] || [];

    const mixWeight = this.isMixedAU(numId) ? this.getAUMixWeight(numId) : 1.0;
    const base = target * mixWeight;

    const { left: leftVal, right: rightVal } = this.computeSideValues(base, balance);

    this.auValues[numId] = target;

    const handles: TransitionHandle[] = [];
    const meshNames = this.getMeshNamesForAU(numId);

    if (leftKeys.length || rightKeys.length) {
      for (const k of leftKeys) {
        handles.push(
          typeof k === 'number'
            ? this.transitionMorphInfluence(k, leftVal, durationMs, meshNames)
            : this.transitionMorph(k, leftVal, durationMs, meshNames)
        );
      }
      for (const k of rightKeys) {
        handles.push(
          typeof k === 'number'
            ? this.transitionMorphInfluence(k, rightVal, durationMs, meshNames)
            : this.transitionMorph(k, rightVal, durationMs, meshNames)
        );
      }
    }

    for (const k of centerKeys) {
      handles.push(
        typeof k === 'number'
          ? this.transitionMorphInfluence(k, base, durationMs, meshNames)
          : this.transitionMorph(k, base, durationMs, meshNames)
      );
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
   * @param balance - Optional L/R balance for bilateral morphs
   */
  setContinuum(negAU: number, posAU: number, continuumValue: number, balance?: number): void {
    const value = Math.max(-1, Math.min(1, continuumValue));

    if (value < 0) {
      this.setAU(posAU, 0, balance);
      this.setAU(negAU, Math.abs(value), balance);
      return;
    }
    if (value > 0) {
      this.setAU(negAU, 0, balance);
      this.setAU(posAU, value, balance);
      return;
    }

    this.setAU(negAU, 0, balance);
    this.setAU(posAU, 0, balance);
  }

  /**
   * Smoothly transition a continuum AU pair (e.g., eyes left/right, head up/down).
   * Takes a continuum value from -1 to +1 and internally manages both AU values.
   *
   * @param negAU - AU ID for negative direction (e.g., 61 for eyes left)
   * @param posAU - AU ID for positive direction (e.g., 62 for eyes right)
   * @param continuumValue - Target value from -1 (full negative) to +1 (full positive)
   * @param durationMs - Transition duration in milliseconds
   * @param balance - Optional L/R balance for bilateral morphs
   */
  transitionContinuum(negAU: number, posAU: number, continuumValue: number, durationMs = 200, balance?: number): TransitionHandle {
    const target = Math.max(-1, Math.min(1, continuumValue));
    const driverKey = `continuum_${negAU}_${posAU}`;

    // Get current continuum value: positive if posAU active, negative if negAU active
    const currentNeg = this.auValues[negAU] ?? 0;
    const currentPos = this.auValues[posAU] ?? 0;
    const currentContinuum = currentPos - currentNeg;

    return this.animation.addTransition(driverKey, currentContinuum, target, durationMs, (value) => this.setContinuum(negAU, posAU, value, balance));
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
  setMorph(
    key: string,
    v: number,
    meshNamesOrTargets?: string[] | { infl: number[]; idx: number }[]
  ): void {
    const val = clamp01(v);

    // Fast path: pre-resolved targets array (from transitionMorph)
    if (Array.isArray(meshNamesOrTargets) && meshNamesOrTargets.length > 0 && typeof meshNamesOrTargets[0] === 'object' && 'infl' in meshNamesOrTargets[0]) {
      const targets = meshNamesOrTargets as { infl: number[]; idx: number }[];
      this.applyMorphTargets(targets, val);
      return;
    }

    const meshNames = meshNamesOrTargets as string[] | undefined;
    const targets = this.resolveMorphTargets(key, meshNames);
    if (targets.length === 0) return;
    this.applyMorphTargets(targets, val);
  }

  setMorphInfluence(index: number, v: number, meshNames?: string[]): void {
    const val = clamp01(v);
    const targets = this.resolveMorphTargetsByIndex(index, meshNames);
    if (targets.length === 0) return;
    this.applyMorphTargets(targets, val);
  }

  /**
   * Resolve morph key to direct targets for ultra-fast repeated access.
   * Use this when you need to set the same morph many times (e.g., in animation loops).
   */
  resolveMorphTargets(key: string, meshNames?: string[]): { infl: number[]; idx: number }[] {
    // Cache key includes mesh names to avoid conflicts between face and hair morphs
    const targetMeshes = meshNames || this.config.morphToMesh?.face || [];
    const cacheKey = this.getMorphKeyCacheKey(key, meshNames);

    // Check cache first
    const cached = this.morphKeyCache.get(cacheKey);
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
      this.morphKeyCache.set(cacheKey, targets);
    }
    return targets;
  }

  resolveMorphTargetsByIndex(index: number, meshNames?: string[]): { infl: number[]; idx: number }[] {
    const idx = Number.isInteger(index) && index >= 0 ? index : null;
    if (idx === null) return [];
    const targetMeshes = meshNames || this.config.morphToMesh?.face || [];
    const cacheKey = this.getMorphIndexCacheKey(idx, meshNames);

    const cached = this.morphIndexCache.get(cacheKey);
    if (cached) return cached;

    const targets: { infl: number[]; idx: number }[] = [];

    if (targetMeshes.length) {
      for (const name of targetMeshes) {
        const mesh = this.meshByName.get(name);
        if (!mesh) continue;
        const infl = mesh.morphTargetInfluences;
        if (!infl || idx >= infl.length) continue;
        targets.push({ infl, idx });
      }
    } else {
      for (const mesh of this.meshes) {
        const infl = mesh.morphTargetInfluences;
        if (!infl || idx >= infl.length) continue;
        targets.push({ infl, idx });
      }
    }

    if (targets.length > 0) {
      this.morphIndexCache.set(cacheKey, targets);
    }
    return targets;
  }

  transitionMorph(key: string, to: number, durationMs = 120, meshNames?: string[]): TransitionHandle {
    const transitionKey = meshNames?.length
      ? `morph_${this.getMorphKeyCacheKey(key, meshNames)}`
      : `morph_${this.getMorphKeyCacheKey(key)}`;
    const target = clamp01(to);

    // Pre-resolve targets once, then use direct access during animation
    const targets = this.resolveMorphTargets(key, meshNames);

    // Get "from" value from the resolved targets (more accurate for hair meshes)
    const from = targets.length > 0 ? (targets[0].infl[targets[0].idx] ?? 0) : this.getMorphValue(key);

    return this.animation.addTransition(transitionKey, from, target, durationMs, (value) => {
      // Ultra-fast path: direct array access, no lookups
      const val = clamp01(value);
      this.applyMorphTargets(targets, val);
    });
  }

  transitionMorphInfluence(index: number, to: number, durationMs = 120, meshNames?: string[]): TransitionHandle {
    const transitionKey = meshNames?.length
      ? `morph_${this.getMorphIndexCacheKey(index, meshNames)}`
      : `morph_${this.getMorphIndexCacheKey(index)}`;
    const target = clamp01(to);

    const targets = this.resolveMorphTargetsByIndex(index, meshNames);
    const from = targets.length > 0 ? (targets[0].infl[targets[0].idx] ?? 0) : this.getMorphValueByIndex(index);

    return this.animation.addTransition(transitionKey, from, target, durationMs, (value) => {
      const val = clamp01(value);
      this.applyMorphTargets(targets, val);
    });
  }

  // ============================================================================
  // VISEME CONTROL
  // ============================================================================

  setViseme(visemeIndex: number, value: number, jawScale = 1.0): void {
    if (visemeIndex < 0 || visemeIndex >= this.config.visemeKeys.length) return;

    const val = clamp01(value);
    this.visemeValues[visemeIndex] = val;

    const targets = this.resolvedVisemeTargets[visemeIndex];
    if (targets && targets.length > 0) {
      this.applyMorphTargets(targets, val);
    } else {
      const morphKey = this.config.visemeKeys[visemeIndex];
      if (typeof morphKey === 'number') {
        this.setMorphInfluence(morphKey, val);
      } else if (typeof morphKey === 'string') {
        this.setMorph(morphKey, val);
      }
    }

    const jawAmount = Loom3.VISEME_JAW_AMOUNTS[visemeIndex] * val * jawScale;
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

    const morphHandle = typeof morphKey === 'number'
      ? this.transitionMorphInfluence(morphKey, target, durationMs)
      : this.transitionMorph(morphKey, target, durationMs);

    const jawAmount = Loom3.VISEME_JAW_AMOUNTS[visemeIndex] * target * jawScale;
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
   * Check if an AU has bilateral bone bindings (left + right side hints).
   * Used to determine if a balance slider should be shown for bone-only bilateral AUs.
   */
  hasLeftRightBones(auId: number): boolean {
    const bindings = this.config.auToBones[auId] || [];
    const hasLeft = bindings.some((binding) => binding.side === 'left');
    const hasRight = bindings.some((binding) => binding.side === 'right');
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

  /** Get morph target indices mapped to labels for each mesh */
  getMorphTargetIndices(): Record<string, { index: number; name: string }[]> {
    const result: Record<string, { index: number; name: string }[]> = {};
    for (const mesh of this.meshes) {
      const dict = mesh.morphTargetDictionary;
      if (!dict) continue;

      const entries = Object.entries(dict).map(([name, index]) => ({
        name,
        index,
      }));

      entries.sort((a, b) => a.index - b.index);
      result[mesh.name] = entries;
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
    let result: ReturnType<Loom3['getMeshMaterialConfig']> = null;

    this.model.traverse((obj: any) => {
      if (obj.isMesh && obj.name === meshName) {
        const mat = obj.material;
        if (mat) {
          // Reverse lookup blending mode name
          let blendingName = 'Normal';
          for (const [name, value] of Object.entries(Loom3.BLENDING_MODES)) {
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
            const blendValue = Loom3.BLENDING_MODES[config.blending];
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

  private applyHairPhysicsProfileConfig(): void {
    const hairConfig: HairPhysicsProfileConfig | undefined = this.config.hairPhysics;
    if (!hairConfig) return;

    const runtimeConfig: HairPhysicsConfigUpdate = {};
    const numericKeys: Array<keyof HairPhysicsProfileConfig> = [
      'stiffness',
      'damping',
      'inertia',
      'gravity',
      'responseScale',
      'idleSwayAmount',
      'idleSwaySpeed',
      'windStrength',
      'windDirectionX',
      'windDirectionZ',
      'windTurbulence',
      'windFrequency',
      'idleClipDuration',
      'impulseClipDuration',
    ];

    for (const key of numericKeys) {
      const value = hairConfig[key];
      if (value !== undefined) {
        (runtimeConfig as Record<string, unknown>)[key] = value;
      }
    }

    if (hairConfig.direction) {
      runtimeConfig.direction = { ...hairConfig.direction } as HairPhysicsDirectionConfig;
    }

    if (hairConfig.morphTargets) {
      const morphTargets: Partial<HairMorphTargets> = {};
      if (hairConfig.morphTargets.swayLeft) morphTargets.swayLeft = hairConfig.morphTargets.swayLeft.key;
      if (hairConfig.morphTargets.swayRight) morphTargets.swayRight = hairConfig.morphTargets.swayRight.key;
      if (hairConfig.morphTargets.swayFront) morphTargets.swayFront = hairConfig.morphTargets.swayFront.key;
      if (hairConfig.morphTargets.fluffRight) morphTargets.fluffRight = hairConfig.morphTargets.fluffRight.key;
      if (hairConfig.morphTargets.fluffBottom) morphTargets.fluffBottom = hairConfig.morphTargets.fluffBottom.key;

      if (hairConfig.morphTargets.headUp) {
        const headUp: Record<string, number> = {};
        for (const [key, value] of Object.entries(hairConfig.morphTargets.headUp)) {
          if (value && typeof value.value === 'number') {
            headUp[key] = value.value;
          }
        }
        if (Object.keys(headUp).length > 0) morphTargets.headUp = headUp;
      }

      if (hairConfig.morphTargets.headDown) {
        const headDown: Record<string, number> = {};
        for (const [key, value] of Object.entries(hairConfig.morphTargets.headDown)) {
          if (value && typeof value.value === 'number') {
            headDown[key] = value.value;
          }
        }
        if (Object.keys(headDown).length > 0) morphTargets.headDown = headDown;
      }

      if (Object.keys(morphTargets).length > 0) {
        runtimeConfig.morphTargets = morphTargets as HairMorphTargets;
      }
    }

    this.hairPhysics.setHairPhysicsConfig(runtimeConfig);
  }

  setProfile(profile: Profile): void {
    this.config = profile;
    this.mixWeights = { ...profile.auMixDefaults };
    if (this.model) {
      this.rebuildMorphTargetsCache();
    }
    this.applyHairPhysicsProfileConfig();
  }

  getProfile(): Profile { return this.config; }

  /**
   * Get the mesh names that should receive morph influences for a given AU.
   * Routes by facePart: face AUs → face + eyebrow + occlusion + tearLine meshes,
   * Tongue → tongue, Eye → eye, etc. This ensures auxiliary meshes (eyebrows,
   * occlusion, tear lines) also receive morph influences from face AUs.
   */
  getMeshNamesForAU(auId: number): string[] {
    const m = this.config.morphToMesh;
    const info = this.config.auInfo?.[String(auId)];
    if (!info?.facePart) return m?.face || [];
    switch (info.facePart) {
      case 'Tongue': return m?.tongue || [];
      case 'Eye': return m?.eye || [];
      default: {
        // Face AUs target the body mesh plus all auxiliary face meshes
        // (eyebrows, occlusion, tear lines) that share morph target names.
        const face = m?.face || [];
        const eyebrow = m?.eyebrow || [];
        const eyeOcclusion = m?.eyeOcclusion || [];
        const tearLine = m?.tearLine || [];
        return [...face, ...eyebrow, ...eyeOcclusion, ...tearLine];
      }
    }
  }

  // ============================================================================
  // HAIR PHYSICS
  // ============================================================================

  registerHairObjects(objects: Object3D[]): Array<{ name: string; isMesh: boolean; isEyebrow: boolean }> {
    return this.hairPhysics.registerHairObjects(objects);
  }

  getRegisteredHairObjects(): Mesh[] {
    return this.hairPhysics.getRegisteredHairObjects();
  }

  setHairPhysicsEnabled(enabled: boolean): void {
    this.hairPhysics.setHairPhysicsEnabled(enabled);
    if (enabled) {
      const head = this.getHeadRotation();
      this.hairPhysics.onHeadRotationChanged(head.yaw, head.pitch);
    }
  }

  isHairPhysicsEnabled(): boolean {
    return this.hairPhysics.isHairPhysicsEnabled();
  }

  setHairPhysicsConfig(config: HairPhysicsConfigUpdate): void {
    this.hairPhysics.setHairPhysicsConfig(config);
  }

  getHairPhysicsConfig(): HairPhysicsConfig {
    return this.hairPhysics.getHairPhysicsConfig();
  }

  validateHairMorphTargets(): string[] {
    return this.hairPhysics.validateHairMorphTargets();
  }

  /** Get head rotation values for hair physics (range -1 to 1) */
  getHeadRotation(): { yaw: number; pitch: number; roll: number } {
    return {
      yaw: this.rotations.HEAD?.yaw ?? 0,
      pitch: this.rotations.HEAD?.pitch ?? 0,
      roll: this.rotations.HEAD?.roll ?? 0,
    };
  }

  updateHairPhysics(dt: number): void {
    this.hairPhysics.update(dt);
  }

  getHairMorphTargets(meshName?: string): string[] {
    return this.hairPhysics.getHairMorphTargets(meshName);
  }

  setMorphOnMeshes(meshNames: string[], morphKey: string, value: number): void {
    this.hairPhysics.setMorphOnMeshes(meshNames, morphKey, value);
  }

  applyHairStateToObject(objectName: string, state: {
    color?: { baseColor: string; emissive: string; emissiveIntensity: number };
    outline?: { show: boolean; color: string; opacity: number };
    visible?: boolean;
    scale?: { x: number; y: number; z: number };
    position?: { x: number; y: number; z: number };
    isEyebrow?: boolean;
  }): void {
    this.hairPhysics.applyHairStateToObject(objectName, state);
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

  private getAUMorphsBySide(
    auId: number
  ): { left: MorphTargetRef[]; right: MorphTargetRef[]; center: MorphTargetRef[] } {
    const entry = this.config.auToMorphs[auId];
    return {
      left: entry ? [...entry.left] : [],
      right: entry ? [...entry.right] : [],
      center: entry ? [...entry.center] : [],
    };
  }

  private applyMorphTargets(targets: MorphTargetHandle[], val: number): void {
    for (const target of targets) {
      target.infl[target.idx] = val;
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

  private getMorphValueByIndex(index: number): number {
    const idx = Number.isInteger(index) && index >= 0 ? index : null;
    if (idx === null) return 0;
    if (this.faceMesh) {
      const infl = this.faceMesh.morphTargetInfluences;
      if (infl && idx < infl.length) {
        return infl[idx] ?? 0;
      }
      return 0;
    }
    for (const mesh of this.meshes) {
      const infl = mesh.morphTargetInfluences;
      if (!infl) continue;
      if (idx < infl.length) return infl[idx] ?? 0;
    }
    return 0;
  }

  private getMorphKeyCacheKey(key: string, meshNames?: string[]): string {
    return meshNames?.length ? `key:${key}@${meshNames.join(',')}` : `key:${key}`;
  }

  private getMorphIndexCacheKey(index: number, meshNames?: string[]): string {
    return meshNames?.length ? `idx:${index}@${meshNames.join(',')}` : `idx:${index}`;
  }

  private isMixedAU(id: number): boolean {
    const morphs = this.config.auToMorphs[id];
    const hasMorphs = !!(morphs?.left?.length || morphs?.right?.length || morphs?.center?.length);
    return !!(hasMorphs && this.config.auToBones[id]?.length);
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
    if (headChanged && this.hairPhysics.isHairPhysicsEnabled()) {
      this.hairPhysics.onHeadRotationChanged(
        this.rotations.HEAD?.yaw ?? 0,
        this.rotations.HEAD?.pitch ?? 0
      );
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
    this.hairPhysics.clearRegisteredHairObjects();

    root.traverse((obj: any) => {
      if (!obj.isMesh || !obj.name) return;

      // Try config.meshes first, then fall back to CC4_MESHES for backwards compatibility.
      // No name-based inference here; presets should provide any fallback mapping.
      const meshInfo = this.config.meshes?.[obj.name] ?? CC4_MESHES[obj.name];
      const category = meshInfo?.category;

      // Auto-register hair and eyebrow meshes for hair physics
      if (category === 'hair' || category === 'eyebrow') {
        this.hairPhysics.autoRegisterHairMesh(obj as Mesh, category);
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
          const blendValue = Loom3.BLENDING_MODES[settings.blending];
          if (blendValue !== undefined) {
            obj.material.blending = blendValue;
          }
        }
        obj.material.needsUpdate = true;
      }
    });

  }

  // ===========wha=================================================================
  // BAKED ANIMATION CONTROL (Three.js AnimationMixer)
  // ============================================================================

  loadAnimationClips(clips: unknown[]): void {
    this.bakedAnimations.loadAnimationClips(clips);
  }

  getAnimationClips(): AnimationClipInfo[] {
    return this.bakedAnimations.getAnimationClips();
  }

  playAnimation(clipName: string, options: AnimationPlayOptions = {}): AnimationActionHandle | null {
    return this.bakedAnimations.playAnimation(clipName, options);
  }

  stopAnimation(clipName: string): void {
    this.bakedAnimations.stopAnimation(clipName);
  }

  stopAllAnimations(): void {
    this.bakedAnimations.stopAllAnimations();
  }

  pauseAnimation(clipName: string): void {
    this.bakedAnimations.pauseAnimation(clipName);
  }

  resumeAnimation(clipName: string): void {
    this.bakedAnimations.resumeAnimation(clipName);
  }

  pauseAllAnimations(): void {
    this.bakedAnimations.pauseAllAnimations();
  }

  resumeAllAnimations(): void {
    this.bakedAnimations.resumeAllAnimations();
  }

  setAnimationSpeed(clipName: string, speed: number): void {
    this.bakedAnimations.setAnimationSpeed(clipName, speed);
  }

  setAnimationIntensity(clipName: string, intensity: number): void {
    this.bakedAnimations.setAnimationIntensity(clipName, intensity);
  }

  setAnimationTimeScale(timeScale: number): void {
    this.bakedAnimations.setAnimationTimeScale(timeScale);
  }

  getAnimationState(clipName: string): AnimationState | null {
    return this.bakedAnimations.getAnimationState(clipName);
  }

  getPlayingAnimations(): AnimationState[] {
    return this.bakedAnimations.getPlayingAnimations();
  }

  crossfadeTo(clipName: string, duration = 0.3, options: AnimationPlayOptions = {}): AnimationActionHandle | null {
    return this.bakedAnimations.crossfadeTo(clipName, duration, options);
  }

  snippetToClip(
    clipName: string,
    curves: CurvesMap,
    options?: ClipOptions
  ): AnimationClip | null {
    return this.bakedAnimations.snippetToClip(clipName, curves, options);
  }

  playClip(clip: AnimationClip, options?: ClipOptions): ClipHandle | null {
    return this.bakedAnimations.playClip(clip, options);
  }

  playSnippet(
    snippet: Snippet | { name: string; curves: CurvesMap },
    options?: ClipOptions
  ): ClipHandle | null {
    return this.bakedAnimations.playSnippet(snippet, options);
  }

  buildClip(
    clipName: string,
    curves: CurvesMap,
    options?: ClipOptions
  ): ClipHandle | null {
    return this.bakedAnimations.buildClip(clipName, curves, options);
  }

  cleanupSnippet(name: string) {
    this.bakedAnimations.cleanupSnippet(name);
  }

  updateClipParams(
    name: string,
    params: { weight?: number; rate?: number; loop?: boolean; loopMode?: 'once' | 'repeat' | 'pingpong'; repeatCount?: number; reverse?: boolean; actionId?: string }
  ): boolean {
    return this.bakedAnimations.updateClipParams(name, params);
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
