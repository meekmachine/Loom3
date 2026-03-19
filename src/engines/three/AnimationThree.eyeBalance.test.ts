import { describe, expect, it } from 'vitest';
import { Object3D, Quaternion } from 'three';
import type { Profile } from '../../mappings/types';
import { BakedAnimationController, type BakedAnimationHost } from './AnimationThree';

function makeEyeBoneHost(): {
  controller: BakedAnimationController;
  eyeL: Object3D;
  eyeR: Object3D;
} {
  const eyeL = new Object3D();
  eyeL.name = 'LeftEye';
  const eyeR = new Object3D();
  eyeR.name = 'RightEye';

  const compositeRotations = [
    {
      node: 'EYE_L',
      pitch: null,
      yaw: { aus: [61, 62], axis: 'rz', negative: 61, positive: 62 },
      roll: null,
    },
    {
      node: 'EYE_R',
      pitch: null,
      yaw: { aus: [61, 62], axis: 'rz', negative: 61, positive: 62 },
      roll: null,
    },
  ] as const;

  const profile: Profile = {
    auToMorphs: {},
    auToBones: {
      61: [
        { node: 'EYE_L', channel: 'rz', scale: 1, maxDegrees: 25, side: 'left' },
        { node: 'EYE_R', channel: 'rz', scale: 1, maxDegrees: 25, side: 'right' },
      ],
      62: [
        { node: 'EYE_L', channel: 'rz', scale: -1, maxDegrees: 25, side: 'left' },
        { node: 'EYE_R', channel: 'rz', scale: -1, maxDegrees: 25, side: 'right' },
      ],
    },
    boneNodes: {
      EYE_L: 'LeftEye',
      EYE_R: 'RightEye',
    },
    morphToMesh: { face: [] },
    visemeKeys: [],
    compositeRotations: compositeRotations as any,
  };

  const host: BakedAnimationHost = {
    getModel: () => new Object3D(),
    getMeshes: () => [],
    getMeshByName: () => undefined,
    getBones: () => ({
      EYE_L: {
        obj: eyeL,
        basePos: { x: 0, y: 0, z: 0 },
        baseQuat: new Quaternion(),
        baseEuler: { x: 0, y: 0, z: 0, order: 'XYZ' },
      },
      EYE_R: {
        obj: eyeR,
        basePos: { x: 0, y: 0, z: 0 },
        baseQuat: new Quaternion(),
        baseEuler: { x: 0, y: 0, z: 0, order: 'XYZ' },
      },
    }),
    getConfig: () => profile,
    getCompositeRotations: () => compositeRotations as any,
    computeSideValues: (base: number, balance = 0) => {
      if (balance === 0) return { left: base, right: base };
      if (balance < 0) return { left: base, right: base * (1 + balance) };
      return { left: base * (1 - balance), right: base };
    },
    getAUMixWeight: () => 1,
    isMixedAU: () => false,
  };

  return {
    controller: new BakedAnimationController(host),
    eyeL,
    eyeR,
  };
}

function getLastQuaternionValues(clip: any, obj: Object3D): number[] {
  const track = clip.tracks.find((t: any) => typeof t?.name === 'string' && t.name.includes(obj.uuid));
  expect(track, `Missing quaternion track for ${obj.name}`).toBeTruthy();
  return Array.from(track.values.slice(-4) as ArrayLike<number>);
}

describe('BakedAnimationController eye balance', () => {
  it('applies snippet balance to bilateral eye bone tracks', () => {
    const { controller, eyeL, eyeR } = makeEyeBoneHost();

    const clip = controller.snippetToClip(
      'eye-balance-left-only',
      {
        '61': [
          { time: 0, intensity: 0 },
          { time: 1, intensity: 1 },
        ],
      },
      { balance: -1 }
    );

    expect(clip).toBeTruthy();

    const leftValues = getLastQuaternionValues(clip, eyeL);
    const rightValues = getLastQuaternionValues(clip, eyeR);

    expect(leftValues).not.toEqual([0, 0, 0, 1]);
    expect(rightValues).toEqual([0, 0, 0, 1]);
  });
});
