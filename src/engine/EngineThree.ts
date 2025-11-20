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

export class EngineThree {
  private auValues: Record<number, number> = {};
  private transitions: Array<{
    kind: 'au'|'morph'; id: number|string; key?: string;
    from: number; to: number; elapsed: number; dur: number;
    ease: (t:number)=>number
  }> = [];

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

  /** Advance all active transitions by delta time (called from external RAF loop) */
  private advanceTransitionsByMs = (dtMs: number) => {
    if (!this.transitions.length || this.isPaused) return;

    this.transitions = this.transitions.filter(tr => {
      tr.elapsed += dtMs;
      const p = Math.min(1, Math.max(0, tr.elapsed / Math.max(1, tr.dur)));
      const v = tr.from + (tr.to - tr.from) * tr.ease(p);

      if (tr.kind === 'au') this.setAU(tr.id, v);
      else if (tr.kind === 'morph' && tr.key) this.setMorph(tr.key, v);

      return p < 1; // Keep transition if not complete
    });
  };
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
  transitionAU = (id: number|string, to: number, durationMs = 200) => {
    // Cancel any existing transition for this AU to prevent conflicts
    this.transitions = this.transitions.filter(t => !(t.kind === 'au' && t.id === id));

    const from = typeof id === 'string' ? (this.auValues[Number(id.replace(/[^\d]/g,''))] ?? 0) : (this.auValues[id] ?? 0);
    this.transitions.push({
      kind:'au',
      id,
      from: clamp01(from),
      to: clamp01(to),
      dur: durationMs,
      elapsed: 0,
      ease: this.easeInOutQuad
    });
  };

  /** Smoothly tween a morph to a target value */
  transitionMorph = (key: string, to: number, durationMs = 120) => {
    // Cancel any existing transition for this morph to prevent conflicts
    this.transitions = this.transitions.filter(t => !(t.kind === 'morph' && t.key === key));

    const from = this.getMorphValue(key);
    this.transitions.push({
      kind:'morph',
      id:key,
      key,
      from: clamp01(from),
      to: clamp01(to),
      dur: durationMs,
      elapsed: 0,
      ease: this.easeInOutQuad
    });
  };
  /** Advance internal transition tweens by deltaSeconds (called from ThreeProvider RAF loop). */
  update(deltaSeconds: number) {
    const dtMs = Math.max(0, (deltaSeconds || 0) * 1000);
    if (dtMs <= 0) return;
    this.advanceTransitionsByMs(dtMs);
  }

  /** Clear all running transitions (used when playback rate changes to prevent timing conflicts). */
  clearTransitions() {
    this.transitions = [];
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
    return this.transitions.length;
  }
  private meshes: THREE.Mesh[] = [];
  private model: THREE.Object3D | null = null;
  private bones: ResolvedBones = {};

  // --- Mix weight system ---
  private mixWeights: Record<number, number> = {};

  setAUMixWeight = (id: number, weight: number) => {
    this.mixWeights[id] = clamp01(weight);
    // Re-apply composites so the new mix takes effect immediately
    this.reapplyComposites();
  };

  getAUMixWeight = (id: number): number => {
    return this.mixWeights[id] ?? 1.0; // default 1.0 = full bone
  };

  /** Re-evaluate and apply head/eye composites from current AU values (used after mix changes). */
  reapplyComposites = () => {
    // Use tracked state variables instead of auValues to preserve current positions
    this.applyHeadComposite(this.currentHeadYaw, this.currentHeadPitch, this.currentHeadRoll);
    this.applyEyeComposite(this.currentEyeYaw, this.currentEyePitch);
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
      console.log(`[EngineThree] Composite AU ${id} = ${v.toFixed(2)} (axis: ${compositeInfo.axis}, nodes: ${compositeInfo.nodes.join(', ')})`);

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
          console.log(`    ${nodeKey}.${compositeInfo.axis}: AU${axisConfig.negative}(${negValue.toFixed(2)}) - AU${axisConfig.positive}(${posValue.toFixed(2)}) = ${axisValue.toFixed(2)}`);
        } else if (axisConfig.aus.length > 1) {
          // Multiple AUs affect same axis (e.g., jaw drop has AU 25, 26, 27)
          // Use the maximum value among all AUs for this axis
          axisValue = Math.max(...axisConfig.aus.map(auId => this.auValues[auId] ?? 0));
          console.log(`    ${nodeKey}.${compositeInfo.axis}: max of AUs ${axisConfig.aus.join(', ')} = ${axisValue.toFixed(2)}`);
        } else {
          // Single AU controls this axis
          axisValue = v;
          console.log(`    ${nodeKey}.${compositeInfo.axis}: direct value = ${axisValue.toFixed(2)}`);
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
  };

  /** Eyes — vertical continuum: down(64) ⟷ up(63) — positive = up */
  setEyesVertical = (v: number) => {
    const y = Math.max(-1, Math.min(1, v ?? 0));
    this.currentEyePitch = y;
    // Use composite motion to update both bones and blendshapes, preserving horizontal
    this.applyEyeComposite(this.currentEyeYaw, this.currentEyePitch);
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
  };

  /** Head — vertical continuum: down(54) ⟷ up(33) — positive = up */
  setHeadVertical = (v: number) => {
    const y = Math.max(-1, Math.min(1, v ?? 0));
    this.currentHeadPitch = y;
    // Use composite motion to update both bones and blendshapes, preserving other axes
    this.applyHeadComposite(this.currentHeadYaw, this.currentHeadPitch, this.currentHeadRoll);
  };

  /** Head — tilt/roll continuum: left(55) ⟷ right(56) — positive = right tilt */
  setHeadTilt = (v: number) => {
    const r = Math.max(-1, Math.min(1, v ?? 0));
    this.currentHeadRoll = r;
    // Use composite motion to update both bones and blendshapes, preserving other axes
    this.applyHeadComposite(this.currentHeadYaw, this.currentHeadPitch, this.currentHeadRoll);
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

  /** Unified composite handler for head and eyes with full pitch/yaw combination (+optional tilt/roll) */
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

    // --- Bones: compose yaw + pitch (+ roll) in a single pass per node to avoid axis stomping ---
    this.applyBoneComposite(
      { leftId, rightId, upId, downId, tiltLeftId, tiltRightId },
      { yaw: yawBone, pitch, roll: rollVal }
    );

    // --- Morphs: keep existing polarity (no reversal) ---
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
  private applyBothSides = (id: number, v: number) => {
    // For head and eye AUs that aren't left/right split, apply all keys directly
    const globalAUs = new Set([31, 32, 33, 54, 61, 62, 63, 64]);
    const keys = AU_TO_MORPHS[id] || [];

    // For mixed AUs (both morph and bone), scale morph intensity by mix weight
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
      if (!entry) console.warn(`[EngineThree] applyCompositeRotation: No bone entry for ${nodeKey}`);
      return;
    }

    const { obj, basePos, baseQuat } = entry;
    const rotState = this.boneRotations[nodeKey];

    console.log(`[EngineThree] applyCompositeRotation(${nodeKey}) - rotState:`, rotState);

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
        console.log(`  → Yaw: ${rotState.yaw.toFixed(2)} * ${binding.maxDegrees}° * ${binding.scale} = ${(radians * 180 / Math.PI).toFixed(1)}°`);
        const deltaQ = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, radians);
        compositeQ.multiply(deltaQ);
      }
    }

    if (config.pitch && rotState.pitch !== 0) {
      const binding = getBindingForAxis(config.pitch);
      if (binding?.maxDegrees) {
        const radians = deg2rad(binding.maxDegrees) * rotState.pitch * binding.scale;
        const axis = config.pitch.axis === 'rx' ? X_AXIS : config.pitch.axis === 'ry' ? Y_AXIS : Z_AXIS;
        console.log(`  → Pitch (${config.pitch.axis}): ${rotState.pitch.toFixed(2)} * ${binding.maxDegrees}° * ${binding.scale} = ${(radians * 180 / Math.PI).toFixed(1)}°`);
        const deltaQ = new THREE.Quaternion().setFromAxisAngle(axis, radians);
        compositeQ.multiply(deltaQ);
      }
    }

    if (config.roll && rotState.roll !== 0) {
      const binding = getBindingForAxis(config.roll);
      if (binding?.maxDegrees) {
        const radians = deg2rad(binding.maxDegrees) * rotState.roll * binding.scale;
        console.log(`  → Roll: ${rotState.roll.toFixed(2)} * ${binding.maxDegrees}° * ${binding.scale} = ${(radians * 180 / Math.PI).toFixed(1)}°`);
        const deltaQ = new THREE.Quaternion().setFromAxisAngle(Z_AXIS, radians);
        compositeQ.multiply(deltaQ);
      }
    }

    // Apply composite rotation
    obj.position.copy(basePos);
    obj.quaternion.copy(compositeQ);
    obj.updateMatrixWorld(false);
    this.model.updateMatrixWorld(true);
    console.log(`  → Applied composite rotation to ${nodeKey} bone`);
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

  /** Resolve bones: prioritize skeleton bones by exact name, then pattern, then fallback to mesh nodes. Enhanced logging marks Bone/Node. **/
  private resolveBones = (root: THREE.Object3D): ResolvedBones => {
    const resolved: ResolvedBones = {};

    // Collect skeleton bones and index by lowercase name
    const bones = this.collectSkeletonBones(root);
    const boneByName = new Map<string, THREE.Bone>();
    bones.forEach(b => boneByName.set((b.name || '').toLowerCase(), b));

    const getBoneExact = (cands: string[]): THREE.Bone | null => {
      for (const c of cands) {
        const b = boneByName.get(c.toLowerCase());
        if (b) return b;
      }
      return null;
    };

    const byPattern = (must: string[], anyOf: string[] = []) => {
      const lc = (s: string) => s.toLowerCase();
      for (const b of bones) {
        const name = lc(b.name || '');
        if (must.every(m => name.includes(lc(m))) && (anyOf.length === 0 || anyOf.some(a => name.includes(lc(a))))) return b;
      }
      return null;
    };

    const pickFirstExistingNode = (candidates: string[]) => {
      for (const n of candidates) {
        const o = root.getObjectByName(n);
        if (o) return o;
      }
      return null;
    };

    const snapshot = (obj: THREE.Object3D): NodeBase => ({
      obj,
      basePos: obj.position.clone(),
      baseQuat: obj.quaternion.clone(),
      baseEuler: new THREE.Euler().setFromQuaternion(obj.quaternion.clone(), obj.rotation.order),
    });

    // Eyes: prefer exact bone, then pattern bone, then mesh node
    const eyeLBone = getBoneExact(EYE_BONE_CANDIDATES_LEFT)  || byPattern(['eye'], ['l','left']);
    const eyeRBone = getBoneExact(EYE_BONE_CANDIDATES_RIGHT) || byPattern(['eye'], ['r','right']);
    const eyeLNode = eyeLBone || pickFirstExistingNode(EYE_MESH_CANDIDATES_LEFT);
    const eyeRNode = eyeRBone || pickFirstExistingNode(EYE_MESH_CANDIDATES_RIGHT);
    if (eyeLNode) resolved.EYE_L = snapshot(eyeLNode);
    if (eyeRNode) resolved.EYE_R = snapshot(eyeRNode);

    // Jaw: prefer exact bone, then pattern
    const jawBone = getBoneExact(JAW_BONE_CANDIDATES) || byPattern(['jaw']);
    if (jawBone) {
      resolved.JAW = snapshot(jawBone);
      // eslint-disable-next-line no-console
      console.log('[EngineThree] JAW bone resolved:', jawBone.name);
    }

    // Neck: prefer exact bone, then pattern
    const neckBone = getBoneExact(NECK_BONE_CANDIDATES) || byPattern(['neck']);
    if (neckBone) resolved.NECK = snapshot(neckBone);
    // Find secondary neck twist (e.g., CC_Base_NeckTwist02)
    const neck2 = bones.find(b => /necktwist02/i.test(b.name));
    if (neck2) (resolved as any).NECK2 = snapshot(neck2);

    // Head: prefer exact bone, then head control node, then pattern bone, then neck-descendant
    const headBone = getBoneExact(HEAD_BONE_CANDIDATES) || byPattern(['head']);
    const headNode = headBone || pickFirstExistingNode(HEAD_CTRL_CANDIDATES);
    let headFinal: THREE.Object3D | null = headNode;
    if (!headFinal && neckBone) {
      const lc = (s: string) => s.toLowerCase();
      let hit: THREE.Object3D | null = null;
      (neckBone as THREE.Object3D).traverse(o => {
        if (hit) return;
        const nm = lc(o.name || '');
        if (nm.includes('head')) hit = o;
      });
      headFinal = hit;
    }
    if (headFinal) resolved.HEAD = snapshot(headFinal);

    // Tongue: prefer exact bone, then pattern
    const tongueBone = getBoneExact(TONGUE_BONE_CANDIDATES) || byPattern(['tongue']);
    if (tongueBone) resolved.TONGUE = snapshot(tongueBone);

    return resolved;
  };

  // ========================================
  // Hair & Eyebrow Color Control
  // ========================================

  /**
   * Apply color to a hair or eyebrow mesh
   */
  setHairColor(mesh: THREE.Mesh, baseColor: string, emissive: string, emissiveIntensity: number) {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    materials.forEach((mat) => {
      const standardMat = mat as THREE.MeshStandardMaterial;

      // Set base color
      if (standardMat.color !== undefined) {
        standardMat.color = new THREE.Color(baseColor);
      }

      // Set emissive glow
      if (standardMat.emissive !== undefined) {
        standardMat.emissive = new THREE.Color(emissive);
        standardMat.emissiveIntensity = emissiveIntensity;
      }
    });
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
   * Set render order for hair/eyebrow objects to ensure they render on top of face
   * Hair should render AFTER the face to avoid Z-fighting
   *
   * Typical render order values:
   * - Face/body: 0 (default)
   * - Eyebrows: 1 (render after face)
   * - Hair: 2 (render after eyebrows)
   */
  setHairRenderOrder(object: THREE.Object3D, isEyebrow: boolean) {
    // Set render order for this object and all its children
    const renderOrder = isEyebrow ? 1 : 2;

    object.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.renderOrder = renderOrder;

        // Also ensure material has proper depth settings
        const mesh = child as THREE.Mesh;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

        materials.forEach((mat) => {
          // Enable depth write and depth test to ensure proper sorting
          mat.depthWrite = true;
          mat.depthTest = true;
        });
      }
    });
  }

  // ========================================
  // End Hair & Eyebrow Control
  // ========================================

  private collectSkeletonBones = (root: THREE.Object3D): THREE.Bone[] => {
    const out: THREE.Bone[] = [];
    root.traverse((obj) => {
      const anyObj = obj as any;
      if (anyObj.isSkinnedMesh && anyObj.skeleton) {
        const sk: THREE.Skeleton = anyObj.skeleton as THREE.Skeleton;
        if (sk && Array.isArray(sk.bones)) out.push(...sk.bones);
      }
    });
    return out;
  };

  private logResolvedOnce = (_bones: ResolvedBones) => {
    // Reserved for future debug logging
  };

  // Filter L/R morph keys for an AU by suffix (e.g., *_L, *_R)
  private keysForSide(au: number, side: 'L' | 'R'): string[] {
    const keys = AU_TO_MORPHS[au] || [];
    const suffix = side === 'L' ? /(^|_)L$/ : /(^|_)R$/;
    return keys.filter(k => suffix.test(k));
  }
}

function clamp01(x: number) { return x < 0 ? 0 : x > 1 ? 1 : x; }