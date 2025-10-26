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
  EYE_AXIS
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
  private meshes: THREE.Mesh[] = [];
  private model: THREE.Object3D | null = null;
  private bones: ResolvedBones = {};

  // --- Mix weight system ---
  private mixWeights: Record<number, number> = {};

  setAUMixWeight = (id: number, weight: number) => {
    this.mixWeights[id] = clamp01(weight);
  };

  getAUMixWeight = (id: number): number => {
    return this.mixWeights[id] ?? 1.0; // default 1.0 = full bone
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
      // DEBUG: Dump model tree, bones, and morph keys for mapping inspection
      try {
        // Log top-level model
        // eslint-disable-next-line no-console
        console.log('[EngineThree] GLB model root:', this.model);

        // Log all skeleton bones (names)
        const allBones: string[] = [];
        this.collectSkeletonBones(model).forEach(b => allBones.push(b.name || '(unnamed)'));
        // eslint-disable-next-line no-console
        console.log('[EngineThree] Skeleton bones:', allBones);

        // Log per-mesh morph target keys
        (this.meshes || []).forEach((m, i) => {
          const dict: any = (m as any).morphTargetDictionary;
          if (dict) {
            // eslint-disable-next-line no-console
            console.log(`[EngineThree] Mesh[${i}] ${m.name} morphs:`, Object.keys(dict));
          }
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[EngineThree] Debug dump failed:', e);
      }
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
    for (const m of this.meshes) {
      const name = (m.name || '').toLowerCase();
      if (name.includes('occlusion') || name.includes('tearline')) continue;
      const dict: any = (m as any).morphTargetDictionary;
      const infl: any = (m as any).morphTargetInfluences;
      if (!dict || !infl) continue;
      for (const k of keys) {
        let idx = dict[k];
        if (idx === undefined && MORPH_VARIANTS[k]) {
          for (const alt of MORPH_VARIANTS[k]) {
            if (dict[alt] !== undefined) { idx = dict[alt]; break; }
          }
        }
        if (idx !== undefined) infl[idx] = val;
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
        this.auValues = this.auValues || {};
        this.auValues[au] = v;
        return;
      }
      const n = Number(id);
      if (!Number.isNaN(n)) this.applyBothSides(n, v);
      return;
    }

    // Store last AU values for composite computation
    this.auValues = this.auValues || {};
    this.auValues[id] = v;

    // Handle composites for head and eyes
    const yawHead   = (this.auValues[32] ?? 0) - (this.auValues[31] ?? 0);
    const pitchHead = (this.auValues[33] ?? 0) - (this.auValues[54] ?? 0);
    const yawEye    = (this.auValues[62] ?? 0) - (this.auValues[61] ?? 0);
    const pitchEye  = (this.auValues[63] ?? 0) - (this.auValues[64] ?? 0);

    this.applyHeadComposite(yawHead, pitchHead);
    this.applyEyeComposite(yawEye, pitchEye);
  };

  /** Unified composite handler for head and eyes with full pitch/yaw combination */
  private applyCompositeMotion(
    baseYawId: number,
    basePitchId: number,
    yaw: number,
    pitch: number,
    downIdOverride?: number,
    reverseYaw?: boolean
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

    // --- Bones: compose yaw + pitch in a single pass per node to avoid axis stomping ---
    this.applyBoneComposite(
      { leftId, rightId, upId, downId },
      { yaw: yawBone, pitch }
    );

    // --- Morphs: keep existing polarity (no reversal) ---
    this.applyMorphs(AU_TO_MORPHS[leftId] || [], yaw < 0 ? Math.abs(yaw) * yawMix : 0);
    this.applyMorphs(AU_TO_MORPHS[rightId] || [], yaw > 0 ? Math.abs(yaw) * yawMix : 0);
    this.applyMorphs(AU_TO_MORPHS[downId] || [], pitch < 0 ? pitchAbs * pitchMix : 0);
    this.applyMorphs(AU_TO_MORPHS[upId] || [], pitch > 0 ? pitchAbs * pitchMix : 0);

    this.model?.updateMatrixWorld(true);
  }

  /**
   * Compose bone rotations for yaw + pitch in a single write per affected node.
   * Avoids the prior issue where sequential calls (yaw then pitch) overwrote each other.
   */
  private applyBoneComposite(
    ids: { leftId: number; rightId: number; upId: number; downId: number },
    vals: { yaw: number; pitch: number }
  ) {
    if (!this.model) return;

    // Determine which AU ids are active by sign
    const yawId = vals.yaw < 0 ? ids.leftId : vals.yaw > 0 ? ids.rightId : null;
    const pitchId = vals.pitch < 0 ? ids.downId : vals.pitch > 0 ? ids.upId : null;

    // Nothing to do
    if (!yawId && !pitchId) return;

    // Gather bindings for active ids
    const selected: Array<{ id: number; v: number; bindings: any[] }> = [];
    if (yawId) selected.push({ id: yawId, v: Math.abs(vals.yaw), bindings: BONE_AU_TO_BINDINGS[yawId] || [] });
    if (pitchId) selected.push({ id: pitchId, v: Math.abs(vals.pitch), bindings: BONE_AU_TO_BINDINGS[pitchId] || [] });

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

  /** Apply composite head rotation/morphs for both axes */
  private applyHeadComposite(yaw: number, pitch: number) {
    // Head turn should use ry (horizontal yaw) and rx (vertical pitch)
    this.applyCompositeMotion(31, 33, yaw, pitch, 54);
  }

  /** Apply composite eye rotation/morphs for both axes */
  private applyEyeComposite(yaw: number, pitch: number) {
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
    if (globalAUs.has(id)) {
      this.applyMorphs(keys, v);
    } else {
      const leftKeys = keys.filter(k => /(_L|Left)$/.test(k));
      const rightKeys = keys.filter(k => /(_R|Right)$/.test(k));
      if (leftKeys.length || rightKeys.length) {
        this.applyMorphs(leftKeys, v);
        this.applyMorphs(rightKeys, v);
      } else if (keys.length) {
        this.applyMorphs(keys, v);
      }
    }
  };

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

      // Blend a portion into neck for rigs that weight head motion to neck twist bones
      if ((id >= 31 && id <= 33) || (id >= 51 && id <= 58)) {
        if (bones.NECK) {
          const neckEntry = bones.NECK as NodeBase;
          this.applySingleBinding(neckEntry, { ...binding, node: 'NECK' as const }, val * 0.4);
        }
        // Secondary neck twist support if present
        const neck2 = (bones as any).NECK2 as NodeBase;
        if (neck2) {
          this.applySingleBinding(neck2, { ...binding, node: 'NECK2' as const }, val * 0.25);
        }
      }
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
    if (jawBone) resolved.JAW = snapshot(jawBone);

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

  private logResolvedOnce = (bones: ResolvedBones) => {
    if (!this.model) return;
    const table: Record<string, string> = {};
    (['EYE_L','EYE_R','HEAD','NECK','JAW','TONGUE'] as BoneKeys[]).forEach(k => {
      const e = bones[k];
      if (!e) { table[k] = 'NOT FOUND'; return; }
      const isBone = (e.obj as any).isBone === true;
      table[k] = `${e.obj.name}${isBone ? ' (Bone)' : ' (Node)'}`;
    });
    // eslint-disable-next-line no-console
    console.table(table);
    // eslint-disable-next-line no-console
    console.log('[EngineThree] If any NOT FOUND above, consider adding its actual name to ShapeDict candidate arrays.');
  };

  // Filter L/R morph keys for an AU by suffix (e.g., *_L, *_R)
  private keysForSide(au: number, side: 'L' | 'R'): string[] {
    const keys = AU_TO_MORPHS[au] || [];
    const suffix = side === 'L' ? /(^|_)L$/ : /(^|_)R$/;
    return keys.filter(k => suffix.test(k));
  }
}

function clamp01(x: number) { return x < 0 ? 0 : x > 1 ? 1 : x; }