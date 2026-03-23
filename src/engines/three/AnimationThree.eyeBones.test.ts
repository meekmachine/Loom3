import { describe, expect, it } from 'vitest';
import { Object3D, Quaternion } from 'three';
import type { Profile } from '../../mappings/types';
import { BONE_AU_TO_BINDINGS, COMPOSITE_ROTATIONS } from '../../presets/cc4';
import type { ResolvedBones } from './types';
import { BakedAnimationController, type BakedAnimationHost } from './AnimationThree';

const INDEPENDENT_EYE_CASES = [
  { auId: 65, trackNode: 'EYE_L', otherNode: 'EYE_R', label: 'left-eye yaw' },
  { auId: 67, trackNode: 'EYE_L', otherNode: 'EYE_R', label: 'left-eye pitch' },
  { auId: 70, trackNode: 'EYE_R', otherNode: 'EYE_L', label: 'right-eye yaw' },
  { auId: 72, trackNode: 'EYE_R', otherNode: 'EYE_L', label: 'right-eye pitch' },
] as const;

function snapshot(obj: Object3D) {
  return {
    obj,
    basePos: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
    baseQuat: new Quaternion().copy(obj.quaternion),
    baseEuler: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z, order: obj.rotation.order },
  };
}

function makeHost(): { host: BakedAnimationHost; bones: ResolvedBones } {
  const model = new Object3D();
  const leftEye = new Object3D();
  const rightEye = new Object3D();

  leftEye.name = 'CC_Base_L_Eye';
  rightEye.name = 'CC_Base_R_Eye';
  model.add(leftEye, rightEye);

  const bones: ResolvedBones = {
    EYE_L: snapshot(leftEye),
    EYE_R: snapshot(rightEye),
  };

  const profile: Profile = {
    auToMorphs: {},
    auToBones: BONE_AU_TO_BINDINGS,
    boneNodes: { EYE_L: 'L_Eye', EYE_R: 'R_Eye' },
    morphToMesh: {},
    visemeKeys: [],
  };

  const host: BakedAnimationHost = {
    getModel: () => model,
    getMeshes: () => [],
    getMeshByName: () => undefined,
    getBones: () => bones,
    getConfig: () => profile,
    getCompositeRotations: () => COMPOSITE_ROTATIONS,
    computeSideValues: (base: number) => ({ left: base, right: base }),
    getAUMixWeight: () => 1,
    isMixedAU: () => false,
  };

  return { host, bones };
}

describe('BakedAnimationController independent eye bone rotations', () => {
  it.each(INDEPENDENT_EYE_CASES)('emits only the intended eye quaternion track for $label', ({ auId, trackNode, otherNode }) => {
    const { host, bones } = makeHost();
    const controller = new BakedAnimationController(host);

    const clip = controller.snippetToClip(`eye-${auId}`, {
      [auId]: [
        { time: 0, intensity: 0 },
        { time: 1, intensity: 1 },
      ],
    });
    expect(clip).toBeTruthy();
    if (!clip) {
      throw new Error('Expected snippetToClip to return a clip');
    }

    const targetTrackName = `${(bones[trackNode]!.obj as any).uuid}.quaternion`;
    const otherTrackName = `${(bones[otherNode]!.obj as any).uuid}.quaternion`;

    const targetTrack = clip.tracks.find((track) => track.name === targetTrackName);
    const otherTrack = clip.tracks.find((track) => track.name === otherTrackName);

    expect(targetTrack).toBeTruthy();
    expect(otherTrack).toBeFalsy();
    expect(Array.from(targetTrack!.values as ArrayLike<number>).some((value, index) => index >= 4 && Math.abs(value) > 1e-4)).toBe(true);
  });

  it('keeps shared eye AUs driving both eye quaternion tracks', () => {
    const { host, bones } = makeHost();
    const controller = new BakedAnimationController(host);

    const clip = controller.snippetToClip('shared-eyes', {
      61: [
        { time: 0, intensity: 0 },
        { time: 1, intensity: 1 },
      ],
    });

    expect(clip).toBeTruthy();
    if (!clip) {
      throw new Error('Expected snippetToClip to return a clip');
    }

    const leftTrackName = `${(bones.EYE_L!.obj as any).uuid}.quaternion`;
    const rightTrackName = `${(bones.EYE_R!.obj as any).uuid}.quaternion`;

    expect(clip.tracks.some((track) => track.name === leftTrackName)).toBe(true);
    expect(clip.tracks.some((track) => track.name === rightTrackName)).toBe(true);
  });
});
