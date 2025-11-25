import * as THREE from 'three';
import {
  AU_TO_MORPHS,
  MORPH_VARIANTS,
  BONE_AU_TO_BINDINGS,
  BONE_DRIVEN_AUS,
  EYE_AXIS,
  MIXED_AUS,
  AU_TO_COMPOSITE_MAP,
  COMPOSITE_ROTATIONS,
  AU_MIX_DEFAULTS,
  classifyHairObject,
  CC4_BONE_NODES,
  CC4_EYE_MESH_NODES
} from './arkit/shapeDict';

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

type DriverEntry = {
  driver: THREE.Object3D;
  apply: (value: number) => void;
  lastValue: number;
  action: THREE.AnimationAction | null;
};

export class EngineThree {
  private auValues: Record<number, number> = {};
  private mixerRoot: THREE.Object3D;
  private mixer: THREE.AnimationMixer;
  private driverEntries: Map<string, DriverEntry> = new Map();
  private driverApplying = false;
  private rigReady = false;
  private missingBoneWarnings = new Set<string>();

  // Unified rotation state tracking for composite bones
  // Each bone maintains its complete 3D rotation (pitch/yaw/roll) to prevent overwriting
  private boneRotations = {
    JAW: { pitch: 0, yaw: 0, roll: 0 },
    HEAD: { pitch: 0, yaw: 0, roll: 0 },
    EYE_L: { pitch: 0, yaw: 0, roll: 0 },
    EYE_R: { pitch: 0, yaw: 0, roll: 0 },
    TONGUE: { pitch: 0, yaw: 0, roll: 0 }
  };

  // Track current eye and head positions for composite motion (legacy - will be replaced by boneRotations)
  private currentEyeYaw: number = 0;
  private currentEyePitch: number = 0;
  private currentHeadYaw: number = 0;
  private currentHeadPitch: number = 0;
  private currentHeadRoll: number = 0;
  private isPaused: boolean = false;
  private easeInOutQuad = (t:number) => (t<0.5? 2*t*t : -1+(4-2*t)*t);

  constructor() {
    this.mixerRoot = new THREE.Object3D();
    this.mixerRoot.name = 'EngineThreeMixerRoot';
    this.mixer = new THREE.AnimationMixer(this.mixerRoot);

    this.registerDriver('headYaw', this.currentHeadYaw, (value) => this.setHeadHorizontal(value));
    this.registerDriver('headPitch', this.currentHeadPitch, (value) => this.setHeadVertical(value));
    this.registerDriver('headRoll', this.currentHeadRoll, (value) => this.setHeadRoll(value));
    this.registerDriver('eyeYaw', this.currentEyeYaw, (value) => this.setEyesHorizontal(value));
    this.registerDriver('eyePitch', this.currentEyePitch, (value) => this.setEyesVertical(value));
  }

  private getMorphValue(key: string): number {
    for (const m of this.meshes) {
      const dict: any = (m as any).morphTargetDictionary;
      const infl: any = (m as any).morphTargetInfluences;
      if (!dict || !infl) continue;
      let idx = dict[key];
      if (idx === undefined && MORPH_VARIANTS[key]) {
        for (const alt of MORPH_VARIANTS[key]) {
          if (dict[alt] !== undefined) { idx = dict[alt]; break; }
        }
      }
      if (idx !== undefined) return infl[idx] ?? 0;
    }
    return 0;
  }
  /** Smoothly tween an AU to a target value */
  transitionAU = (id: number | string, to: number, durationMs = 200) => {
    const numId = typeof id === 'string' ? Number(id.replace(/[^\d]/g, '')) : id;
    const driverKey = this.getAUDriverKey(numId);
    const entry = this.ensureDriver(
      driverKey,
      this.auValues[numId] ?? 0,
      (value) => this.setAU(numId, clamp01(value))
    );
    this.queueDriverTween(driverKey, clamp01(to), durationMs, entry);
  };

  /** Smoothly tween a morph to a target value */
  transitionMorph = (key: string, to: number, durationMs = 120) => {
    const driverKey = this.getMorphDriverKey(key);
    this.ensureDriver(
      driverKey,
      this.getMorphValue(key),
      (value) => this.setMorph(key, clamp01(value))
    );
    const entry = this.ensureDriver(
      driverKey,
      this.getMorphValue(key),
      (value) => this.setMorph(key, clamp01(value))
    );
    this.queueDriverTween(driverKey, clamp01(to), durationMs, entry);
  };
  /** Advance internal transition tweens by deltaSeconds (called from ThreeProvider RAF loop). */
  update(deltaSeconds: number) {
    const dtSeconds = Math.max(0, deltaSeconds || 0);
    if (dtSeconds <= 0 || this.isPaused) return;
    this.mixer.update(dtSeconds);
    if (!this.rigReady) return;
    this.applyDriverValues();
  }

  /** Clear all running transitions (used when playback rate changes to prevent timing conflicts). */
  clearTransitions() {
    this.driverEntries.forEach((entry) => {
      if (entry.action) {
        entry.action.stop();
        this.mixer.uncacheAction(entry.action.getClip(), entry.driver);
        entry.action = null;
      }
    });
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
    let active = 0;
    this.driverEntries.forEach((entry) => {
      if (entry.action && entry.action.isRunning()) active += 1;
    });
    return active;
  }

  private registerDriver(key: string, initialValue: number, apply: (value: number) => void): DriverEntry {
    const driver = new THREE.Object3D();
    driver.name = key;
    driver.position.x = initialValue;
    this.mixerRoot.add(driver);
    const entry: DriverEntry = {
      driver,
      apply,
      lastValue: initialValue,
      action: null,
    };
    this.driverEntries.set(key, entry);
    return entry;
  }

  private ensureDriver(key: string, initialValue: number, apply: (value: number) => void): DriverEntry {
    let entry = this.driverEntries.get(key);
    if (!entry) {
      entry = this.registerDriver(key, initialValue, apply);
    }
    return entry;
  }

  private stopDriverAction(entry: DriverEntry) {
    if (entry.action) {
      entry.action.stop();
      this.mixer.uncacheAction(entry.action.getClip(), entry.driver);
      entry.action = null;
    }
  }

  private queueDriverTween(key: string, targetValue: number, durationMs: number, entry?: DriverEntry) {
    const targetEntry = entry ?? this.driverEntries.get(key);
    if (!targetEntry) return;
    const driver = targetEntry.driver;
    const from = driver.position.x;
    const target = targetValue;
    const durationSec = Math.max(durationMs, 0) / 1000;
    if (durationSec === 0 || Math.abs(target - from) < 1e-6) {
      this.setDriverInstant(key, target);
      return;
    }

    this.stopDriverAction(targetEntry);
    const track = new THREE.NumberKeyframeTrack('.position[x]', [0, durationSec], [from, target]);
    const clip = new THREE.AnimationClip(`${driver.name}_clip_${Date.now()}`, durationSec, [track]);
    const action = this.mixer.clipAction(clip, driver);
    action.clampWhenFinished = true;
    action.setLoop(THREE.LoopOnce, 0);
    action.reset();
    action.play();
    targetEntry.action = action;
  }

  private setDriverInstant(key: string, value: number) {
    const entry = this.driverEntries.get(key);
    if (!entry) return;
    this.stopDriverAction(entry);
    entry.driver.position.x = value;
    entry.lastValue = value;
    if (!this.rigReady) return;
    this.driverApplying = true;
    entry.apply(value);
    this.driverApplying = false;
  }

  private syncDriverValue(key: string, value: number) {
    if (this.driverApplying) return;
    const entry = this.driverEntries.get(key);
    if (!entry) return;
    entry.driver.position.x = value;
    entry.lastValue = value;
    if (!this.rigReady) return;
    this.stopDriverAction(entry);
  }

  private applyDriverValues() {
    this.driverEntries.forEach((entry) => {
      const current = entry.driver.position.x;
      if (Math.abs(current - entry.lastValue) > 1e-4) {
        entry.lastValue = current;
        this.driverApplying = true;
        entry.apply(current);
        this.driverApplying = false;
      }
    });
  }

  private getAUDriverKey(id: number) {
    return `au_${id}`;
  }

  private getMorphDriverKey(key: string) {
    return `morph_${key}`;
  }
  private meshes: THREE.Mesh[] = [];
  private model: THREE.Object3D | null = null;
  private bones: ResolvedBones = {};

  // --- Mix weight system ---
  // Initialize with defaults from shapeDict (0 = morph only, 1 = bone only)
  private mixWeights: Record<number, number> = { ...AU_MIX_DEFAULTS };

  setAUMixWeight = (id: number, weight: number) => {
    this.mixWeights[id] = clamp01(weight);
    // Re-apply composites so the new mix takes effect immediately
    this.reapplyComposites();
  };

  getAUMixWeight = (id: number): number => {
    // Return stored mix weight, or default from AU_MIX_DEFAULTS, or 1.0 (full bone)
    return this.mixWeights[id] ?? AU_MIX_DEFAULTS[id] ?? 1.0;
  };

  /** Re-evaluate and apply head/eye composites from current AU values (used after mix changes). */
  reapplyComposites = () => {
    // Use tracked state variables instead of auValues to preserve current positions
    this.applyHeadComposite(this.currentHeadYaw, this.currentHeadPitch, this.currentHeadRoll);
    this.applyEyeComposite(this.currentEyeYaw, this.currentEyePitch);
  };

  /**
   * Reset all facial animation to neutral state.
   * This resets both blend shapes (morphs) AND bone rotations.
   */
  resetToNeutral = () => {
    // 1. Clear all AU values
    this.auValues = {};

    // 2. Reset all composite bone rotation state
    this.boneRotations = {
      JAW: { pitch: 0, yaw: 0, roll: 0 },
      HEAD: { pitch: 0, yaw: 0, roll: 0 },
      EYE_L: { pitch: 0, yaw: 0, roll: 0 },
      EYE_R: { pitch: 0, yaw: 0, roll: 0 },
      TONGUE: { pitch: 0, yaw: 0, roll: 0 }
    };

    // 3. Reset tracked composite positions
    this.currentEyeYaw = 0;
    this.currentEyePitch = 0;
    this.currentHeadYaw = 0;
    this.currentHeadPitch = 0;
    this.currentHeadRoll = 0;

    // 4. Clear all active transitions
    this.clearTransitions();

    // 5. Apply neutral composites (zeros out both morphs and bones)
    this.applyHeadComposite(0, 0, 0);
    this.applyEyeComposite(0, 0);

    // 6. Zero out all morphs directly (catches any non-composite morphs)
    for (const m of this.meshes) {
      const infl: any = (m as any).morphTargetInfluences;
      if (!infl) continue;
      for (let i = 0; i < infl.length; i++) {
        infl[i] = 0;
      }
    }

    // 7. Reset all bones to their base transforms
    Object.values(this.bones).forEach((entry) => {
      if (!entry) return;
      entry.obj.position.copy(entry.basePos);
      entry.obj.quaternion.copy(entry.baseQuat);
    });

    // 8. Sync driver state
    ['headYaw','headPitch','headRoll','eyeYaw','eyePitch'].forEach((key) => this.syncDriverValue(key, 0));
  };

  hasBoneBinding = (id: number) => {
    return !!BONE_AU_TO_BINDINGS[id];
  };

  onReady = ({ meshes, model }: { meshes: THREE.Mesh[]; model?: THREE.Object3D }) => {
    this.meshes = meshes;
    if (model) {
      this.model = model;
      this.bones = this.resolveBones(model);
      this.logResolvedOnce(this.bones);
      this.rigReady = true;
      this.missingBoneWarnings.clear();
      this.applyDriverValues();
    }
  };

  /** Morphs **/
  setMorph = (key: string, v: number) => {
    const val = clamp01(v);
    for (const m of this.meshes) {
      const name = (m.name || '').toLowerCase();
      if (name.includes('occlusion') || name.includes('tearline')) continue;
      const dict: any = (m as any).morphTargetDictionary;
      const infl: any = (m as any).morphTargetInfluences;
      if (!dict || !infl) continue;
      let idx = dict[key];
      if (idx === undefined && MORPH_VARIANTS[key]) {
        for (const alt of MORPH_VARIANTS[key]) {
          if (dict[alt] !== undefined) { idx = dict[alt]; break; }
        }
      }
      if (idx !== undefined) infl[idx] = val;
    }
    this.syncDriverValue(this.getMorphDriverKey(key), val);
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
        let idx = dict[k];
        let foundKey = k;
        if (idx === undefined && MORPH_VARIANTS[k]) {
          for (const alt of MORPH_VARIANTS[k]) {
            if (dict[alt] !== undefined) {
              idx = dict[alt];
              foundKey = alt;
              break;
            }
          }
        }
        if (idx !== undefined) {
          infl[idx] = val;
          if (!foundMorphs.includes(foundKey)) foundMorphs.push(foundKey);
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
      // console.log(`[EngineThree] Composite AU ${id} = ${v.toFixed(2)} (axis: ${compositeInfo.axis}, nodes: ${compositeInfo.nodes.join(', ')})`);

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

        // Apply the complete composite rotation
        this.applyCompositeRotation(nodeKey);
      }
    } else {
      // Non-composite AU: apply directly to both morphs and bones
      this.applyBothSides(id, v);
      if (this.hasBoneBinding(id)) {
        this.applyBones(id, v);
      }
    }
    this.syncDriverValue(this.getAUDriverKey(id), this.auValues[id]);
  };

  /** --- High-level continuum helpers (UI-agnostic) ---
   *  Values are in -1..1; we map to underlying AU pairs.
   *  These functions keep EngineThree independent of React/Chakra/etc.
   */

  /** Eyes — horizontal continuum: left(61) ⟷ right(62) */
  setEyesHorizontal = (v: number) => {
    const x = Math.max(-1, Math.min(1, v ?? 0));
    this.currentEyeYaw = x;
    // Use composite motion to update both bones and blendshapes, preserving vertical
    this.applyEyeComposite(this.currentEyeYaw, this.currentEyePitch);
    this.syncDriverValue('eyeYaw', this.currentEyeYaw);
  };

  /** Eyes — vertical continuum: down(64) ⟷ up(63) — positive = up */
  setEyesVertical = (v: number) => {
    const y = Math.max(-1, Math.min(1, v ?? 0));
    this.currentEyePitch = y;
    // Use composite motion to update both bones and blendshapes, preserving horizontal
    this.applyEyeComposite(this.currentEyeYaw, this.currentEyePitch);
    this.syncDriverValue('eyePitch', this.currentEyePitch);
  };

  /** Left eye only — horizontal: 61L ⟷ 62L */
  setLeftEyeHorizontal = (v: number) => {
    const x = Math.max(-1, Math.min(1, v ?? 0));
    if (x >= 0) { this.setAU('61L', 0); this.setAU('62L', x); }
    else        { this.setAU('62L', 0); this.setAU('61L', -x); }
  };

  /** Left eye only — vertical: 64L ⟷ 63L — positive = up */
  setLeftEyeVertical = (v: number) => {
    const y = Math.max(-1, Math.min(1, v ?? 0));
    if (y >= 0) { this.setAU('64L', 0); this.setAU('63L', y); }
    else        { this.setAU('63L', 0); this.setAU('64L', -y); }
  };

  /** Right eye only — horizontal: 61R ⟷ 62R */
  setRightEyeHorizontal = (v: number) => {
    const x = Math.max(-1, Math.min(1, v ?? 0));
    if (x >= 0) { this.setAU('61R', 0); this.setAU('62R', x); }
    else        { this.setAU('62R', 0); this.setAU('61R', -x); }
  };

  /** Right eye only — vertical: 64R ⟷ 63R — positive = up */
  setRightEyeVertical = (v: number) => {
    const y = Math.max(-1, Math.min(1, v ?? 0));
    if (y >= 0) { this.setAU('64R', 0); this.setAU('63R', y); }
    else        { this.setAU('63R', 0); this.setAU('64R', -y); }
  };

  /** Head — horizontal continuum: left(31) ⟷ right(32) */
  setHeadHorizontal = (v: number) => {
    const x = Math.max(-1, Math.min(1, v ?? 0));
    this.currentHeadYaw = x;
    // Use composite motion to update both bones and blendshapes, preserving other axes
    this.applyHeadComposite(this.currentHeadYaw, this.currentHeadPitch, this.currentHeadRoll);
    this.syncDriverValue('headYaw', this.currentHeadYaw);
  };

  /** Head — vertical continuum: down(54) ⟷ up(33) — positive = up */
  setHeadVertical = (v: number) => {
    const y = Math.max(-1, Math.min(1, v ?? 0));
    this.currentHeadPitch = y;
    // Use composite motion to update both bones and blendshapes, preserving other axes
    this.applyHeadComposite(this.currentHeadYaw, this.currentHeadPitch, this.currentHeadRoll);
    this.syncDriverValue('headPitch', this.currentHeadPitch);
  };

  /** Head — tilt/roll continuum: left(55) ⟷ right(56) — positive = right tilt */
  setHeadTilt = (v: number) => {
    const r = Math.max(-1, Math.min(1, v ?? 0));
    this.currentHeadRoll = r;
    // Use composite motion to update both bones and blendshapes, preserving other axes
    this.applyHeadComposite(this.currentHeadYaw, this.currentHeadPitch, this.currentHeadRoll);
    this.syncDriverValue('headRoll', this.currentHeadRoll);
  };

  /** Alias for setHeadTilt for consistency with BoneControls naming */
  setHeadRoll = (v: number) => {
    this.setHeadTilt(v);
  };

  /** Jaw — horizontal continuum: left(30) ⟷ right(35) */
  setJawHorizontal = (v: number) => {
    const x = Math.max(-1, Math.min(1, v ?? 0));
    // Update yaw rotation state and apply composite
    this.updateBoneRotation('JAW', 'yaw', x);
    this.applyCompositeRotation('JAW');
    // Also update AU values for UI sync
    if (x >= 0) {
      this.auValues[35] = x;
      this.auValues[30] = 0;
    } else {
      this.auValues[30] = -x;
      this.auValues[35] = 0;
    }
    // Apply morphs
    this.applyBothSides(x >= 0 ? 35 : 30, Math.abs(x));
  };

  /** Tongue — horizontal continuum: left(39) ⟷ right(40) */
  setTongueHorizontal = (v: number) => {
    const x = Math.max(-1, Math.min(1, v ?? 0));
    // Update yaw rotation state and apply composite
    this.updateBoneRotation('TONGUE', 'yaw', x);
    this.applyCompositeRotation('TONGUE');
    // Also update AU values for UI sync
    if (x >= 0) {
      this.auValues[40] = x;
      this.auValues[39] = 0;
    } else {
      this.auValues[39] = -x;
      this.auValues[40] = 0;
    }
    // Apply morphs
    this.applyBothSides(x >= 0 ? 40 : 39, Math.abs(x));
  };

  /** Tongue — vertical continuum: down(38) ⟷ up(37) — positive = up */
  setTongueVertical = (v: number) => {
    const y = Math.max(-1, Math.min(1, v ?? 0));
    // Update pitch rotation state and apply composite
    this.updateBoneRotation('TONGUE', 'pitch', y);
    this.applyCompositeRotation('TONGUE');
    // Also update AU values for UI sync
    if (y >= 0) {
      this.auValues[37] = y;
      this.auValues[38] = 0;
    } else {
      this.auValues[38] = -y;
      this.auValues[37] = 0;
    }
    // Apply morphs
    this.applyBothSides(y >= 0 ? 37 : 38, Math.abs(y));
  };

  /**
   * Transition methods for continuum axes - smooth animated versions
   * These call the instant set methods to ensure proper composite handling
   */

  /** Smoothly transition eyes horizontal (yaw) over duration */
  transitionEyesHorizontal = (targetValue: number, durationMs: number = 200) => {
    const target = Math.max(-1, Math.min(1, targetValue ?? 0));
    this.queueDriverTween('eyeYaw', target, durationMs);
  };

  /** Smoothly transition eyes vertical (pitch) over duration */
  transitionEyesVertical = (targetValue: number, durationMs: number = 200) => {
    const target = Math.max(-1, Math.min(1, targetValue ?? 0));
    this.queueDriverTween('eyePitch', target, durationMs);
  };

  /** Smoothly transition head horizontal (yaw) over duration */
  transitionHeadHorizontal = (targetValue: number, durationMs: number = 300) => {
    const target = Math.max(-1, Math.min(1, targetValue ?? 0));
    this.queueDriverTween('headYaw', target, durationMs);
  };

  /** Smoothly transition head vertical (pitch) over duration */
  transitionHeadVertical = (targetValue: number, durationMs: number = 300) => {
    const target = Math.max(-1, Math.min(1, targetValue ?? 0));
    this.queueDriverTween('headPitch', target, durationMs);
  };

  /** Smoothly transition head roll/tilt over duration */
  transitionHeadRoll = (targetValue: number, durationMs: number = 300) => {
    const target = Math.max(-1, Math.min(1, targetValue ?? 0));
    this.queueDriverTween('headRoll', target, durationMs);
  };

  /** Smoothly transition jaw horizontal (yaw) over duration */
  transitionJawHorizontal = (targetValue: number, durationMs: number = 200) => {
    const target = Math.max(-1, Math.min(1, targetValue ?? 0));
    if (target >= 0) {
      this.transitionAU(35, target, durationMs);
      this.transitionAU(30, 0, durationMs);
    } else {
      this.transitionAU(30, -target, durationMs);
      this.transitionAU(35, 0, durationMs);
    }
  };

  /** Smoothly transition tongue horizontal (yaw) over duration */
  transitionTongueHorizontal = (targetValue: number, durationMs: number = 200) => {
    const target = Math.max(-1, Math.min(1, targetValue ?? 0));
    if (target >= 0) {
      this.transitionAU(40, target, durationMs);
      this.transitionAU(39, 0, durationMs);
    } else {
      this.transitionAU(39, -target, durationMs);
      this.transitionAU(40, 0, durationMs);
    }
  };

  /** Smoothly transition tongue vertical (pitch) over duration */
  transitionTongueVertical = (targetValue: number, durationMs: number = 200) => {
    const target = Math.max(-1, Math.min(1, targetValue ?? 0));
    if (target >= 0) {
      this.transitionAU(37, target, durationMs);
      this.transitionAU(38, 0, durationMs);
    } else {
      this.transitionAU(38, -target, durationMs);
      this.transitionAU(37, 0, durationMs);
    }
  };

  /** Unified composite handler for head and eyes with full pitch/yaw combination (+optional tilt/roll) */
  /**
   * Apply composite motion (bones + morphs) for multi-axis movements.
   *
   * ⚠️ CRITICAL MIX WEIGHT BEHAVIOR - READ BEFORE MODIFYING:
   * - Bones: ALWAYS applied at full intensity (NOT scaled by mix weight)
   * - Morphs: Scaled by mix weight (0 = no morph, 1 = full morph)
   *
   * Example with mixWeight = 0.5:
   *   Bone rotation: 100% intensity (eyeball rotates fully)
   *   Morph overlay: 50% intensity (eyelid follows partially)
   *
   * See: MIX_WEIGHT_SYSTEM.md for detailed explanation
   * See: COMPOSITE_MOTION_GUIDE.md for architecture overview
   *
   * @param baseYawId - Base AU for horizontal axis (e.g., 61 for eyes left)
   * @param basePitchId - Base AU for vertical axis (e.g., 63 for eyes up)
   * @param yaw - Horizontal value [-1, 1] (negative = left, positive = right)
   * @param pitch - Vertical value [-1, 1] (negative = down, positive = up)
   * @param downIdOverride - Optional override for down AU (default: basePitchId + 21)
   * @param reverseYaw - Unused (kept for backwards compatibility)
   * @param tiltIds - Optional roll/tilt AU pair (e.g., {left: 55, right: 56} for head)
   * @param roll - Roll value [-1, 1] (negative = left tilt, positive = right tilt)
   */
  private applyCompositeMotion(
    baseYawId: number,
    basePitchId: number,
    yaw: number,
    pitch: number,
    downIdOverride?: number,
    reverseYaw?: boolean,
    tiltIds?: { left: number; right: number },
    roll?: number
  ) {
    const yawMix = this.getAUMixWeight(baseYawId);
    const pitchMix = this.getAUMixWeight(basePitchId);

    const leftId = baseYawId;
    const rightId = baseYawId + 1;
    const upId = basePitchId;
    const downId = downIdOverride ?? basePitchId + 21; // 33->54 (head), 63->64 (eyes)

    // --- Reverse yaw for bones only to match morph direction ---
    const yawBone = -yaw;
    const yawAbs = Math.abs(yawBone);
    const pitchAbs = Math.abs(pitch);

    // --- Tilt/Roll axis ---
    const rollVal = roll ?? 0;
    const rollAbs = Math.abs(rollVal);
    const tiltLeftId = tiltIds?.left;
    const tiltRightId = tiltIds?.right;

    // ============================================================================
    // BONES: ALWAYS FULL INTENSITY (NOT SCALED BY MIX WEIGHT)
    // ============================================================================
    // ⚠️ DO NOT multiply by yawMix/pitchMix here - bones always apply at 100%
    // The mix weight ONLY affects morphs (see below)
    this.applyBoneComposite(
      { leftId, rightId, upId, downId, tiltLeftId, tiltRightId },
      { yaw: yawBone, pitch, roll: rollVal }  // ← Full intensity values
    );

    // ============================================================================
    // MORPHS: SCALED BY MIX WEIGHT
    // ============================================================================
    // ⚠️ DO multiply by yawMix/pitchMix here - morphs are the overlay
    // mixWeight = 0.0 → no morph (pure bone)
    // mixWeight = 1.0 → full morph (bone + morph)
    this.applyMorphs(AU_TO_MORPHS[leftId] || [], yaw < 0 ? Math.abs(yaw) * yawMix : 0);
    this.applyMorphs(AU_TO_MORPHS[rightId] || [], yaw > 0 ? Math.abs(yaw) * yawMix : 0);
    this.applyMorphs(AU_TO_MORPHS[downId] || [], pitch < 0 ? pitchAbs * pitchMix : 0);
    this.applyMorphs(AU_TO_MORPHS[upId] || [], pitch > 0 ? pitchAbs * pitchMix : 0);
    if (tiltLeftId && tiltRightId) {
      this.applyMorphs(AU_TO_MORPHS[tiltLeftId] || [], rollVal < 0 ? rollAbs * this.getAUMixWeight(tiltLeftId) : 0);
      this.applyMorphs(AU_TO_MORPHS[tiltRightId] || [], rollVal > 0 ? rollAbs * this.getAUMixWeight(tiltRightId) : 0);
    }
    this.model?.updateMatrixWorld(true);
  }

  /**
   * Compose bone rotations for yaw + pitch (+roll/tilt) in a single write per affected node.
   * Avoids the prior issue where sequential calls (yaw then pitch) overwrote each other.
   */
  private applyBoneComposite(
    ids: { leftId: number; rightId: number; upId: number; downId: number; tiltLeftId?: number; tiltRightId?: number },
    vals: { yaw: number; pitch: number; roll?: number }
  ) {
    if (!this.model) return;

    // Determine which AU ids are active by sign
    const yawId = vals.yaw < 0 ? ids.leftId : vals.yaw > 0 ? ids.rightId : null;
    const pitchId = vals.pitch < 0 ? ids.downId : vals.pitch > 0 ? ids.upId : null;
    const roll = vals.roll ?? 0;
    const tiltId = roll < 0 ? ids.tiltLeftId : roll > 0 ? ids.tiltRightId : null;

    // Nothing to do
    if (!yawId && !pitchId && !tiltId) return;

    // Gather bindings for active ids
    const selected: Array<{ id: number; v: number; bindings: any[] }> = [];
    if (yawId) selected.push({ id: yawId, v: Math.abs(vals.yaw), bindings: BONE_AU_TO_BINDINGS[yawId] || [] });
    if (pitchId) selected.push({ id: pitchId, v: Math.abs(vals.pitch), bindings: BONE_AU_TO_BINDINGS[pitchId] || [] });
    if (tiltId) selected.push({ id: tiltId, v: Math.abs(roll), bindings: BONE_AU_TO_BINDINGS[tiltId] || [] });

    if (!selected.length) return;

    // Group intended channel deltas by resolved node
    type R = { rx?: number; ry?: number; rz?: number; tx?: number; ty?: number; tz?: number; base: NodeBase };
    const perNode = new Map<THREE.Object3D, R>();

    for (const sel of selected) {
      for (const raw of sel.bindings) {
        // Clone to allow eye-axis overrides
        const b = { ...raw };

        // Eye axis overrides for CC rigs (match behavior of applyBones)
        if (sel.id >= 61 && sel.id <= 62) {
          b.channel = EYE_AXIS.yaw;
        } else if (sel.id >= 63 && sel.id <= 64) {
          b.channel = EYE_AXIS.pitch;
        }

        // Resolve node
        const entry = this.bones[b.node as keyof ResolvedBones];
        if (!entry) continue;

        // Compute signed scalar in natural [-1, 1]
        const signed = Math.min(1, Math.max(-1, sel.v * (b.scale ?? 1)));

        // Convert to radians/units
        const radians = b.maxDegrees ? deg2rad(b.maxDegrees) * signed : 0;
        const units = b.maxUnits ? b.maxUnits * signed : 0;

        // Accumulate per node/channel
        let agg = perNode.get(entry.obj);
        if (!agg) {
          agg = { base: entry };
          perNode.set(entry.obj, agg);
        }
        if (b.channel === 'rx' || b.channel === 'ry' || b.channel === 'rz') {
          agg[b.channel] = (agg[b.channel] ?? 0) + radians;
        } else {
          agg[b.channel] = (agg[b.channel] ?? 0) + units;
        }
      }
    }

    // Now, for each node, write a single transform relative to its base
    perNode.forEach((agg, obj) => {
      const { base } = agg;

      // Position: reset to base and apply any translations
      obj.position.copy(base.basePos);
      if (agg.tx || agg.ty || agg.tz) {
        const dir = new THREE.Vector3(
          agg.tx ?? 0,
          agg.ty ?? 0,
          agg.tz ?? 0
        );
        // Translate in the node's local axes oriented by base quaternion
        dir.applyQuaternion(base.baseQuat);
        obj.position.add(dir);
      }

      // Rotation: compose in a stable order (yaw→pitch→roll for head/eyes)
      const q = new THREE.Quaternion();
      const qx = new THREE.Quaternion();
      const qy = new THREE.Quaternion();
      const qz = new THREE.Quaternion();

      qx.setFromAxisAngle(X_AXIS, agg.rx ?? 0);
      qy.setFromAxisAngle(Y_AXIS, agg.ry ?? 0);
      qz.setFromAxisAngle(Z_AXIS, agg.rz ?? 0);

      // Start at base orientation, then apply Y, then X, then Z to match common rigs
      q.copy(base.baseQuat).multiply(qy).multiply(qx).multiply(qz);
      obj.quaternion.copy(q);

      obj.updateMatrixWorld(false);
    });
  }

  /** Apply composite head rotation/morphs for both axes + tilt/roll */
  public applyHeadComposite(yaw: number, pitch: number, roll: number = 0) {
    // Head turn should use ry (horizontal yaw), rx (vertical pitch), and rz (roll/tilt)
    this.applyCompositeMotion(31, 33, yaw, pitch, 54, undefined, { left: 55, right: 56 }, roll);
  }

  /** Apply composite eye rotation/morphs for both axes */
  public applyEyeComposite(yaw: number, pitch: number) {
    // Eyes turn should use rz (horizontal yaw) and rx (vertical pitch)
    this.applyCompositeMotion(61, 63, yaw, pitch, 64);
  }

  /**
   * Smoothly transition eye composite to target yaw/pitch over duration
   * This creates a smooth animated transition for eye tracking return-to-neutral
   */
  public transitionEyeComposite(targetYaw: number, targetPitch: number, durationMs: number = 800) {
    const startYaw = this.currentEyeYaw;
    const startPitch = this.currentEyePitch;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / durationMs, 1.0);
      const easedProgress = this.easeInOutQuad(progress);

      // Interpolate between start and target
      const currentYaw = startYaw + (targetYaw - startYaw) * easedProgress;
      const currentPitch = startPitch + (targetPitch - startPitch) * easedProgress;

      // Apply the interpolated values
      this.currentEyeYaw = currentYaw;
      this.currentEyePitch = currentPitch;
      this.applyEyeComposite(currentYaw, currentPitch);

      // Continue animation if not complete
      if (progress < 1.0) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * Smoothly transition head composite to target yaw/pitch/roll over duration
   * This creates a smooth animated transition for head tracking return-to-neutral
   */
  public transitionHeadComposite(targetYaw: number, targetPitch: number, targetRoll: number = 0, durationMs: number = 800) {
    const startYaw = this.currentHeadYaw;
    const startPitch = this.currentHeadPitch;
    const startRoll = this.currentHeadRoll;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / durationMs, 1.0);
      const easedProgress = this.easeInOutQuad(progress);

      // Interpolate between start and target
      const currentYaw = startYaw + (targetYaw - startYaw) * easedProgress;
      const currentPitch = startPitch + (targetPitch - startPitch) * easedProgress;
      const currentRoll = startRoll + (targetRoll - startRoll) * easedProgress;

      // Apply the interpolated values
      this.currentHeadYaw = currentYaw;
      this.currentHeadPitch = currentPitch;
      this.currentHeadRoll = currentRoll;
      this.applyHeadComposite(currentYaw, currentPitch, currentRoll);

      // Continue animation if not complete
      if (progress < 1.0) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }

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
    this.boneRotations[nodeKey][axis] = Math.max(-1, Math.min(1, value));
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
    const rotState = this.boneRotations[nodeKey];

    // console.log(`[EngineThree] applyCompositeRotation(${nodeKey}) - rotState:`, rotState);

    // Find the composite rotation config for this node
    const config = COMPOSITE_ROTATIONS.find(c => c.node === nodeKey);
    if (!config) return;

    // Helper to get binding from the most active AU for an axis
    const getBindingForAxis = (axisConfig: typeof config.pitch | typeof config.yaw | typeof config.roll) => {
      if (!axisConfig) return null;

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
        return BONE_AU_TO_BINDINGS[maxAU]?.[0];
      }

      // Single AU or continuum pair - use first AU
      return BONE_AU_TO_BINDINGS[axisConfig.aus[0]]?.[0];
    };

    // Build composite quaternion from individual axes
    const compositeQ = new THREE.Quaternion().copy(baseQuat);

    // Apply rotations in order: yaw (Y), pitch (X), roll (Z) - standard Euler order
    if (config.yaw && rotState.yaw !== 0) {
      const binding = getBindingForAxis(config.yaw);
      if (binding?.maxDegrees) {
        const radians = deg2rad(binding.maxDegrees) * rotState.yaw * binding.scale;
        // console.log(`  → Yaw: ${rotState.yaw.toFixed(2)} * ${binding.maxDegrees}° * ${binding.scale} = ${(radians * 180 / Math.PI).toFixed(1)}°`);
        const deltaQ = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, radians);
        compositeQ.multiply(deltaQ);
      }
    }

    if (config.pitch && rotState.pitch !== 0) {
      const binding = getBindingForAxis(config.pitch);
      if (binding?.maxDegrees) {
        const radians = deg2rad(binding.maxDegrees) * rotState.pitch * binding.scale;
        const axis = config.pitch.axis === 'rx' ? X_AXIS : config.pitch.axis === 'ry' ? Y_AXIS : Z_AXIS;
        // console.log(`  → Pitch (${config.pitch.axis}): ${rotState.pitch.toFixed(2)} * ${binding.maxDegrees}° * ${binding.scale} = ${(radians * 180 / Math.PI).toFixed(1)}°`);
        const deltaQ = new THREE.Quaternion().setFromAxisAngle(axis, radians);
        compositeQ.multiply(deltaQ);
      }
    }

    if (config.roll && rotState.roll !== 0) {
      const binding = getBindingForAxis(config.roll);
      if (binding?.maxDegrees) {
        const radians = deg2rad(binding.maxDegrees) * rotState.roll * binding.scale;
        // console.log(`  → Roll: ${rotState.roll.toFixed(2)} * ${binding.maxDegrees}° * ${binding.scale} = ${(radians * 180 / Math.PI).toFixed(1)}°`);
        const deltaQ = new THREE.Quaternion().setFromAxisAngle(Z_AXIS, radians);
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

    // Set renderOrder: hair renders after eyebrows (higher value = later)
    // This ensures hair can properly layer over eyebrows
    mesh.renderOrder = isEyebrow ? 0 : 1;
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
   * Register hair objects and return engine-agnostic metadata
   * This method handles all Three.js-specific operations for hair registration
   */
  registerHairObjects(objects: THREE.Object3D[]): Array<{
    name: string;
    isEyebrow: boolean;
    isMesh: boolean;
  }> {
    const metadata = objects.map((obj) => {
      const isMesh = (obj as THREE.Mesh).isMesh || false;

      // Classify using shapeDict
      const classification = classifyHairObject(obj.name);
      const isEyebrow = classification === 'eyebrow';

      // Set render order immediately during registration
      // Eyebrows: renderOrder = 0 (renders first/underneath)
      // Hair: renderOrder = 1 (renders after/on top)
      if (isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.renderOrder = isEyebrow ? 0 : 1;
      }

      return {
        name: obj.name,
        isEyebrow,
        isMesh,
      };
    });

    return metadata;
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
}

function clamp01(x: number) { return x < 0 ? 0 : x > 1 ? 1 : x; }
