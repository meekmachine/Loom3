import { describe, expect, it } from 'vitest';
import { Object3D, Quaternion } from 'three';
import type { Profile } from '../../mappings/types';
import type { ResolvedBones } from './types';
import { BakedAnimationController, type BakedAnimationHost } from './AnimationThree';

function makeHost(): { controller: BakedAnimationController; bones: ResolvedBones } {
  const head = new Object3D();
  head.name = 'Head';

  const bones: ResolvedBones = {
    HEAD: {
      obj: head,
      basePos: { x: 0, y: 0, z: 0 },
      baseQuat: new Quaternion(),
      baseEuler: { x: 0, y: 0, z: 0, order: 'XYZ' },
    },
  };

  const profile: Profile = {
    auToMorphs: {},
    auToBones: {
      1: [{ node: 'HEAD', channel: 'ry', scale: 1, maxDegrees: 30 }],
      2: [{ node: 'HEAD', channel: 'ry', scale: -1, maxDegrees: 30 }],
      3: [{ node: 'HEAD', channel: 'ry', scale: 1, maxDegrees: 30 }],
      4: [{ node: 'HEAD', channel: 'ry', scale: -1, maxDegrees: 30 }],
    },
    boneNodes: { HEAD: 'Head' },
    morphToMesh: {},
    visemeKeys: [],
    compositeRotations: [
      {
        node: 'HEAD',
        pitch: null,
        yaw: { aus: [1, 2, 3, 4], axis: 'ry', negative: [1, 3], positive: [2, 4] },
        roll: null,
      },
    ],
  };

  const host: BakedAnimationHost = {
    getModel: () => new Object3D(),
    getMeshes: () => [],
    getMeshByName: () => undefined,
    getBones: () => bones,
    getConfig: () => profile,
    getCompositeRotations: () => profile.compositeRotations || [],
    computeSideValues: (base: number) => ({ left: base, right: base }),
    getAUMixWeight: () => 1,
    isMixedAU: () => false,
  };

  return { controller: new BakedAnimationController(host), bones };
}

function getTrackComponent(clip: NonNullable<ReturnType<BakedAnimationController['snippetToClip']>>, obj: Object3D, componentIndex: number) {
  const track = clip.tracks.find((entry) => entry.name === `${(obj as any).uuid}.quaternion`);
  expect(track).toBeTruthy();
  return Array.from((track!.values as ArrayLike<number>)).slice(-4)[componentIndex];
}

describe('BakedAnimationController grouped composite rotation axes', () => {
  it('uses grouped negative/positive AUs when baking quaternion tracks', () => {
    const negative = makeHost();
    const negativeClip = negative.controller.snippetToClip('grouped-negative', {
      3: [
        { time: 0, intensity: 0 },
        { time: 1, intensity: 1 },
      ],
    });
    expect(negativeClip).toBeTruthy();
    if (!negativeClip) {
      throw new Error('Expected grouped-negative clip');
    }

    const positive = makeHost();
    const positiveClip = positive.controller.snippetToClip('grouped-positive', {
      4: [
        { time: 0, intensity: 0 },
        { time: 1, intensity: 1 },
      ],
    });
    expect(positiveClip).toBeTruthy();
    if (!positiveClip) {
      throw new Error('Expected grouped-positive clip');
    }

    const negativeY = getTrackComponent(negativeClip, negative.bones.HEAD!.obj, 1);
    const positiveY = getTrackComponent(positiveClip, positive.bones.HEAD!.obj, 1);

    expect(Math.abs(negativeY)).toBeGreaterThan(1e-4);
    expect(Math.abs(positiveY)).toBeGreaterThan(1e-4);
    expect(Math.sign(negativeY)).toBe(-Math.sign(positiveY));
  });
});
