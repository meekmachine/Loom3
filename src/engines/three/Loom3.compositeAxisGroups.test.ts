import { describe, expect, it } from 'vitest';
import { Object3D } from 'three';
import type { Profile } from '../../mappings/types';
import { Loom3 } from './Loom3';

function makeEngine(): Loom3 {
  const profile: Profile = {
    auToMorphs: {},
    auToBones: {
      1: [{ node: 'HEAD', channel: 'ry', scale: 1, maxDegrees: 30 }],
      2: [{ node: 'HEAD', channel: 'ry', scale: -1, maxDegrees: 30 }],
      3: [{ node: 'HEAD', channel: 'ry', scale: 1, maxDegrees: 30 }],
      4: [{ node: 'HEAD', channel: 'ry', scale: -1, maxDegrees: 30 }],
    },
    boneNodes: { HEAD: 'Head' },
    morphToMesh: { face: [] },
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

  const model = new Object3D();
  const head = new Object3D();
  head.name = 'Head';
  model.add(head);

  const engine = new Loom3({ profile });
  engine.onReady({ model, meshes: [] });
  return engine;
}

describe('Loom3 grouped composite rotation axes', () => {
  it('treats grouped negative/positive AUs as one semantic axis', () => {
    const engine = makeEngine();

    engine.setAU(3, 1);
    engine.update(1 / 60);
    const negativeRotation = engine.getBones().HEAD.rotation[1];

    engine.setAU(3, 0);
    engine.setAU(4, 1);
    engine.update(1 / 60);
    const positiveRotation = engine.getBones().HEAD.rotation[1];

    expect(Math.abs(negativeRotation)).toBeGreaterThan(5);
    expect(Math.abs(positiveRotation)).toBeGreaterThan(5);
    expect(Math.sign(negativeRotation)).toBe(-Math.sign(positiveRotation));
  });
});
