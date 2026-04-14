import { describe, expect, it } from 'vitest';
import { Object3D } from 'three';
import type { Profile } from '../../mappings/types';
import { Loom3 } from './Loom3';

function makeProfile(overrides: Partial<Profile>): Profile {
  return {
    auToMorphs: {},
    auToBones: {},
    boneNodes: {},
    morphToMesh: { face: [] },
    visemeKeys: [],
    ...overrides,
  };
}

function makeHeadJawRig() {
  const model = new Object3D();
  const head = new Object3D();
  head.name = 'Head';
  const jaw = new Object3D();
  jaw.name = 'Jaw';
  model.add(head, jaw);
  return { model };
}

describe('Loom3 setProfile runtime refresh', () => {
  it('registers newly added composite bone mappings after a profile hot-swap', () => {
    const { model } = makeHeadJawRig();
    const engine = new Loom3({
      profile: makeProfile({
        auToBones: {
          1: [{ node: 'HEAD', channel: 'ry', scale: 1, maxDegrees: 30 }],
        },
        boneNodes: { HEAD: 'Head' },
        compositeRotations: [
          {
            node: 'HEAD',
            pitch: null,
            yaw: { aus: [1], axis: 'ry' },
            roll: null,
          },
        ],
      }),
    });

    engine.onReady({ model, meshes: [] });

    engine.setProfile(makeProfile({
      auToBones: {
        1: [{ node: 'HEAD', channel: 'ry', scale: 1, maxDegrees: 30 }],
        80: [{ node: 'JAW', channel: 'rz', scale: 1, maxDegrees: 24 }],
      },
      boneNodes: {
        HEAD: 'Head',
        JAW: 'Jaw',
      },
      compositeRotations: [
        {
          node: 'HEAD',
          pitch: null,
          yaw: { aus: [1], axis: 'ry' },
          roll: null,
        },
        {
          node: 'JAW',
          pitch: { aus: [80], axis: 'rz' },
          yaw: null,
          roll: null,
        },
      ],
    }));

    engine.setAU(80, 1);
    engine.update(1 / 60);

    const bones = engine.getBones();
    expect(Math.abs(bones.JAW.rotation[2])).toBeGreaterThan(5);
    expect(Math.abs(bones.HEAD.rotation[1])).toBeLessThan(0.001);
  });

  it('reapplies active AU state when the profile remaps a composite axis', () => {
    const { model } = makeHeadJawRig();
    const engine = new Loom3({
      profile: makeProfile({
        auToBones: {
          1: [{ node: 'HEAD', channel: 'ry', scale: 1, maxDegrees: 30 }],
        },
        boneNodes: { HEAD: 'Head' },
        compositeRotations: [
          {
            node: 'HEAD',
            pitch: null,
            yaw: { aus: [1], axis: 'ry' },
            roll: null,
          },
        ],
      }),
    });

    engine.onReady({ model, meshes: [] });
    engine.setAU(1, 1);
    engine.update(1 / 60);

    const before = engine.getBones().HEAD.rotation;
    expect(Math.abs(before[1])).toBeGreaterThan(20);
    expect(Math.abs(before[0])).toBeLessThan(0.001);

    engine.setProfile(makeProfile({
      auToBones: {
        1: [{ node: 'HEAD', channel: 'rx', scale: 1, maxDegrees: 12 }],
      },
      boneNodes: { HEAD: 'Head' },
      compositeRotations: [
        {
          node: 'HEAD',
          pitch: { aus: [1], axis: 'rx' },
          yaw: null,
          roll: null,
        },
      ],
    }));
    engine.update(1 / 60);

    const after = engine.getBones().HEAD.rotation;
    expect(Math.abs(after[0])).toBeGreaterThan(8);
    expect(Math.abs(after[1])).toBeLessThan(0.001);
  });
});
