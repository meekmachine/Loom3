import * as THREE from 'three';
import {
  AU_TO_MORPHS,
  MORPH_VARIANTS,
  BONE_AU_TO_BINDINGS,
  EYE_BONE_CANDIDATES_LEFT,
  EYE_BONE_CANDIDATES_RIGHT,
  JAW_BONE_CANDIDATES,
  HEAD_BONE_CANDIDATES,
  NECK_BONE_CANDIDATES,
  TONGUE_BONE_CANDIDATES,
  EYE_MESH_CANDIDATES_LEFT,
  EYE_MESH_CANDIDATES_RIGHT,
  HEAD_CTRL_CANDIDATES,
  BONE_DRIVEN_AUS,
  EYE_AXIS,
  MIXED_AUS,
  AU_TO_COMPOSITE_MAP,
  COMPOSITE_ROTATIONS
} from './arkit/shapeDict';

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const deg2rad = (d: number) => (d * Math.PI) / 180;

type BoneKeys = 'EYE_L' | 'EYE_R' | 'JAW' | 'HEAD' | 'NECK' | 'TONGUE';

type NodeBase = {
  obj: THREE.Object3D;
  basePos: THREE.Vector3;
  baseQuat: THREE.Quaternion;
  baseEuler: THREE.Euler;
};

type ResolvedBones = Partial<Record<BoneKeys, NodeBase>>;

/**
 * EngineFour - React Three Fiber compatible engine
 * Implements the same Engine interface as EngineThree but designed to work
 * with React Three Fiber's reactive model and hooks system
 */
export class EngineFour {
  private auValues: Record<number, number> = {};
  private transitions: Array<{
    kind: 'au' | 'morph';
    id: number | string;
    key?: string;
    from: number;
    to: number;
    elapsed: number;
    dur: number;
    ease: (t: number) => number;
  }> = [];

  // Unified rotation state tracking for composite bones
  private boneRotations = {
    JAW: { pitch: 0, yaw: 0, roll: 0 },
    HEAD: { pitch: 0, yaw: 0, roll: 0 },
    EYE_L: { pitch: 0, yaw: 0, roll: 0 },
    EYE_R: { pitch: 0, yaw: 0, roll: 0 },
    TONGUE: { pitch: 0, yaw: 0, roll: 0 }
  };

  // Track current eye and head positions for composite motion
  private currentEyeYaw: number = 0;
  private currentEyePitch: number = 0;
  private currentHeadYaw: number = 0;
  private currentHeadPitch: number = 0;
  private currentHeadRoll: number = 0;
  private isPaused: boolean = false;
  private easeInOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

  private meshes: THREE.Mesh[] = [];
  private model: THREE.Object3D | null = null;
  private bones: ResolvedBones = {};
  private mixWeights: Record<number, number> = {};

  // Callback for external state updates (React state, etc.)
  private onStateChange?: () => void;

  constructor(onStateChange?: () => void) {
    this.onStateChange = onStateChange;
  }

  /** Advance all active transitions by delta time (called from external RAF loop or useFrame) */
  private advanceTransitionsByMs = (dtMs: number) => {
    if (!this.transitions.length || this.isPaused) return;

    this.transitions = this.transitions.filter((tr) => {
      tr.elapsed += dtMs;
      const p = Math.min(1, Math.max(0, tr.elapsed / Math.max(1, tr.dur)));
      const v = tr.from + (tr.to - tr.from) * tr.ease(p);

      if (tr.kind === 'au') this.setAU(tr.id, v);
      else if (tr.kind === 'morph' && tr.key) this.setMorph(tr.key, v);

      return p < 1; // Keep transition if not complete
    });

    // Notify external listeners of state change
    this.onStateChange?.();
  };

  private getMorphValue(key: string): number {
    for (const m of this.meshes) {
      const dict: any = (m as any).morphTargetDictionary;
      const infl: any = (m as any).morphTargetInfluences;
      if (!dict || !infl) continue;
      let idx = dict[key];
      if (idx === undefined && MORPH_VARIANTS[key]) {
        for (const alt of MORPH_VARIANTS[key]) {
          if (dict[alt] !== undefined) {
            idx = dict[alt];
            break;
          }
        }
      }
      if (idx !== undefined) return infl[idx] ?? 0;
    }
    return 0;
  }

  /** Smoothly tween an AU to a target value */
  transitionAU = (id: number | string, to: number, durationMs = 200) => {
    // Cancel any existing transition for this AU to prevent conflicts
    this.transitions = this.transitions.filter((t) => !(t.kind === 'au' && t.id === id));

    const from =
      typeof id === 'string'
        ? this.auValues[Number(id.replace(/[^\d]/g, ''))] ?? 0
        : this.auValues[id] ?? 0;

    this.transitions.push({
      kind: 'au',
      id,
      from,
      to,
      elapsed: 0,
      dur: Math.max(1, durationMs),
      ease: this.easeInOutQuad
    });

    this.onStateChange?.();
  };

  /** Smoothly tween a morph target */
  transitionMorph = (key: string, to: number, durationMs = 200) => {
    this.transitions = this.transitions.filter((t) => !(t.kind === 'morph' && t.key === key));

    const from = this.getMorphValue(key);
    this.transitions.push({
      kind: 'morph',
      id: key,
      key,
      from,
      to,
      elapsed: 0,
      dur: Math.max(1, durationMs),
      ease: this.easeInOutQuad
    });

    this.onStateChange?.();
  };

  /** Set AU immediately without transition */
  setAU = (id: number | string, value: number) => {
    const numId = typeof id === 'string' ? Number(id.replace(/[^\d]/g, '')) : id;
    this.auValues[numId] = value;
    this.applyAU(numId, value);
    this.onStateChange?.();
  };

  /** Apply AU to model (main logic) */
  applyAU = (id: number, value: number) => {
    // 1) If AU has composite mapping, update boneRotations and apply composite
    const compMap = AU_TO_COMPOSITE_MAP[id];
    if (compMap && COMPOSITE_ROTATIONS[compMap.boneName]) {
      const rotState = this.boneRotations[compMap.boneName as BoneKeys];
      if (rotState && compMap.axis in rotState) {
        (rotState as any)[compMap.axis] = value;
        this.applyCompositeBone(compMap.boneName as BoneKeys);
      }
    }

    // 2) Check mix weight
    const mixWeight = this.mixWeights[id] ?? 0.5;

    // 3) Apply morph component
    const morphNames = AU_TO_MORPHS[id];
    if (morphNames && morphNames.length > 0) {
      const morphVal = value * (1 - mixWeight);
      morphNames.forEach((mName) => this.setMorph(mName, morphVal));
    }

    // 4) Apply bone component
    const boneBindings = BONE_AU_TO_BINDINGS[id];
    if (boneBindings && boneBindings.length > 0) {
      const boneVal = value * mixWeight;
      boneBindings.forEach((b) => {
        const bone = this.bones[b.node as BoneKeys];
        if (!bone) return;

        // Eye axis override for CC rigs (same logic as EngineThree)
        let binding = { ...b };
        if (id >= 61 && id <= 62) {
          binding = { ...binding, channel: EYE_AXIS.yaw };
        } else if (id >= 63 && id <= 64) {
          binding = { ...binding, channel: EYE_AXIS.pitch };
        }

        const absVal = Math.abs(boneVal);
        const sign = boneVal >= 0 ? 1 : -1;

        // Apply rotation or translation based on channel
        if (binding.channel.startsWith('r')) {
          // Rotation channel
          const maxDeg = binding.maxDegrees || 30;
          const radians = deg2rad(maxDeg) * absVal * binding.scale * sign;
          const axis =
            binding.channel === 'rx' ? X_AXIS : binding.channel === 'ry' ? Y_AXIS : Z_AXIS;
          const q = new THREE.Quaternion().setFromAxisAngle(axis, radians);
          bone.obj.quaternion.copy(bone.baseQuat).multiply(q);
        } else if (binding.channel.startsWith('t')) {
          // Translation channel
          const maxUnits = binding.maxUnits || 1;
          const offset = maxUnits * absVal * binding.scale * sign;
          const vec = new THREE.Vector3();
          if (binding.channel === 'tx') vec.x = offset;
          else if (binding.channel === 'ty') vec.y = offset;
          else if (binding.channel === 'tz') vec.z = offset;
          bone.obj.position.copy(bone.basePos).add(vec);
        }
      });
    }
  };

  /** Apply composite bone rotation (pitch, yaw, roll) */
  private applyCompositeBone = (boneName: BoneKeys) => {
    const bone = this.bones[boneName];
    if (!bone) return;

    const rotState = this.boneRotations[boneName];
    const rotConfig = COMPOSITE_ROTATIONS[boneName];
    if (!rotConfig) return;

    const euler = new THREE.Euler(
      deg2rad(rotState.pitch * rotConfig.pitch.scale * (rotConfig.pitch.flip ? -1 : 1)),
      deg2rad(rotState.yaw * rotConfig.yaw.scale * (rotConfig.yaw.flip ? -1 : 1)),
      deg2rad(rotState.roll * rotConfig.roll.scale * (rotConfig.roll.flip ? -1 : 1)),
      rotConfig.order
    );

    const q = new THREE.Quaternion().setFromEuler(euler);
    bone.obj.quaternion.copy(bone.baseQuat).multiply(q);
  };

  /** Set morph target directly */
  setMorph = (name: string, value: number) => {
    for (const m of this.meshes) {
      const dict: any = (m as any).morphTargetDictionary;
      const infl: any = (m as any).morphTargetInfluences;
      if (!dict || !infl) continue;

      let idx = dict[name];
      if (idx === undefined && MORPH_VARIANTS[name]) {
        for (const alt of MORPH_VARIANTS[name]) {
          if (dict[alt] !== undefined) {
            idx = dict[alt];
            break;
          }
        }
      }
      if (idx !== undefined) {
        infl[idx] = Math.max(0, Math.min(1, value));
      }
    }
  };

  /** Initialize engine with loaded model */
  onReady = ({ meshes, model }: { meshes: THREE.Mesh[]; model: THREE.Object3D }) => {
    this.meshes = meshes;
    this.model = model;
    this.bones = this.resolveBones(model);
    console.log('[EngineFour] Initialized with', meshes.length, 'meshes and bones:', this.bones);
    this.onStateChange?.();
  };

  /** Resolve bones from model */
  private resolveBones(model: THREE.Object3D): ResolvedBones {
    const result: ResolvedBones = {};

    const findBone = (candidates: string[]): THREE.Object3D | undefined => {
      for (const pattern of candidates) {
        const found = model.getObjectByName(pattern);
        if (found) return found;
      }
      return undefined;
    };

    const register = (key: BoneKeys, candidates: string[]) => {
      const obj = findBone(candidates);
      if (obj) {
        result[key] = {
          obj,
          basePos: obj.position.clone(),
          baseQuat: obj.quaternion.clone(),
          baseEuler: obj.rotation.clone()
        };
      }
    };

    register('EYE_L', EYE_BONE_CANDIDATES_LEFT);
    register('EYE_R', EYE_BONE_CANDIDATES_RIGHT);
    register('JAW', JAW_BONE_CANDIDATES);
    register('HEAD', HEAD_BONE_CANDIDATES);
    register('NECK', NECK_BONE_CANDIDATES);
    register('TONGUE', TONGUE_BONE_CANDIDATES);

    return result;
  }

  /** Update engine (called from useFrame or RAF) */
  update = (deltaSeconds: number) => {
    this.advanceTransitionsByMs(deltaSeconds * 1000);
  };

  /** Pause all transitions */
  pause = () => {
    this.isPaused = true;
  };

  /** Resume transitions */
  resume = () => {
    this.isPaused = false;
  };

  /** Clear all active transitions */
  clearTransitions = () => {
    this.transitions = [];
    this.onStateChange?.();
  };

  /** Get active transition count */
  getActiveTransitionCount = () => this.transitions.length;

  // Composite continuum helpers
  setEyesHorizontal = (value: number) => {
    this.boneRotations.EYE_L.yaw = value;
    this.boneRotations.EYE_R.yaw = value;
    this.applyCompositeBone('EYE_L');
    this.applyCompositeBone('EYE_R');
  };

  setEyesVertical = (value: number) => {
    this.boneRotations.EYE_L.pitch = value;
    this.boneRotations.EYE_R.pitch = value;
    this.applyCompositeBone('EYE_L');
    this.applyCompositeBone('EYE_R');
  };

  setHeadHorizontal = (value: number) => {
    this.boneRotations.HEAD.yaw = value;
    this.applyCompositeBone('HEAD');
  };

  setHeadVertical = (value: number) => {
    this.boneRotations.HEAD.pitch = value;
    this.applyCompositeBone('HEAD');
  };

  setHeadTilt = (value: number) => {
    this.boneRotations.HEAD.roll = value;
    this.applyCompositeBone('HEAD');
  };

  setJawHorizontal = (value: number) => {
    this.boneRotations.JAW.yaw = value;
    this.applyCompositeBone('JAW');
  };

  setTongueHorizontal = (value: number) => {
    this.boneRotations.TONGUE.yaw = value;
    this.applyCompositeBone('TONGUE');
  };

  setTongueVertical = (value: number) => {
    this.boneRotations.TONGUE.pitch = value;
    this.applyCompositeBone('TONGUE');
  };

  /** Set AU mix weight (0 = all morph, 1 = all bone) */
  setAUMixWeight = (id: number, weight: number) => {
    this.mixWeights[id] = Math.max(0, Math.min(1, weight));
    // Re-apply current value with new mix
    const currentVal = this.auValues[id] ?? 0;
    this.applyAU(id, currentVal);
  };

  getAUMixWeight = (id: number): number => {
    return this.mixWeights[id] ?? 0.5;
  };

  /** Apply composite head rotation */
  applyHeadComposite = (yaw: number, pitch: number, roll: number) => {
    this.boneRotations.HEAD.yaw = yaw;
    this.boneRotations.HEAD.pitch = pitch;
    this.boneRotations.HEAD.roll = roll;
    this.applyCompositeBone('HEAD');
  };

  /** Apply composite eye rotation */
  applyEyeComposite = (yaw: number, pitch: number) => {
    this.boneRotations.EYE_L.yaw = yaw;
    this.boneRotations.EYE_L.pitch = pitch;
    this.boneRotations.EYE_R.yaw = yaw;
    this.boneRotations.EYE_R.pitch = pitch;
    this.applyCompositeBone('EYE_L');
    this.applyCompositeBone('EYE_R');
  };
}
