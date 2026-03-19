import { describe, expect, it } from 'vitest';
import { Object3D } from 'three';
import type { Profile } from '../../mappings/types';
import { Loom3 } from './Loom3';

function makeEyeEngine(): {
  engine: Loom3;
  leftEye: Object3D;
  rightEye: Object3D;
} {
  const model = new Object3D();
  const leftEye = new Object3D();
  leftEye.name = 'LeftEye';
  const rightEye = new Object3D();
  rightEye.name = 'RightEye';
  model.add(leftEye, rightEye);

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
    compositeRotations: [
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
    ],
  };

  const engine = new Loom3({ profile });
  engine.onReady({ model, meshes: [] });

  return { engine, leftEye, rightEye };
}

describe('Loom3 eye balance', () => {
  it('applies stored balance when transitioning bilateral eye bones', () => {
    const { engine, leftEye, rightEye } = makeEyeEngine();

    engine.transitionAU(61, 1, 0, -1);
    engine.update(1 / 60);

    expect(leftEye.quaternion.toArray()).not.toEqual([0, 0, 0, 1]);
    expect(rightEye.quaternion.toArray()).toEqual([0, 0, 0, 1]);
  });
});
