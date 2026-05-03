import { describe, expect, it } from 'vitest';
import { BufferGeometry, Mesh, MeshBasicMaterial, Object3D } from 'three';
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

function makeMorphMesh(name: string, dictionary: Record<string, number>): Mesh {
  const mesh = new Mesh(new BufferGeometry(), new MeshBasicMaterial());
  mesh.name = name;
  (mesh as any).morphTargetDictionary = dictionary;
  const maxIndex = Object.values(dictionary).length > 0 ? Math.max(...Object.values(dictionary)) : -1;
  (mesh as any).morphTargetInfluences = maxIndex >= 0 ? new Array(maxIndex + 1).fill(0) : [];
  return mesh;
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

  it('clears stale AU morph targets when an active AU remaps to different meshes', () => {
    const model = new Object3D();
    const faceMesh = makeMorphMesh('FaceMesh', { Smile: 0 });
    const altMesh = makeMorphMesh('AltMesh', { Smile: 0 });
    model.add(faceMesh, altMesh);

    const engine = new Loom3({
      profile: makeProfile({
        auToMorphs: {
          1: { left: [], right: [], center: ['Smile'] },
        },
        morphToMesh: { face: ['FaceMesh'], alt: ['AltMesh'] },
      }),
    });

    engine.onReady({ model, meshes: [faceMesh, altMesh] });
    engine.setAU(1, 1);

    expect(faceMesh.morphTargetInfluences?.[0]).toBe(1);
    expect(altMesh.morphTargetInfluences?.[0]).toBe(0);

    engine.setProfile(makeProfile({
      auToMorphs: {
        1: { left: [], right: [], center: ['Smile'] },
      },
      morphToMesh: { face: ['AltMesh'], alt: ['FaceMesh'] },
    }));

    expect(faceMesh.morphTargetInfluences?.[0]).toBe(0);
    expect(altMesh.morphTargetInfluences?.[0]).toBe(1);
  });

  it('reapplies active viseme morphs and jaw rotation after a profile hot-swap', () => {
    const { model } = makeHeadJawRig();
    const faceMesh = makeMorphMesh('FaceMesh', { Viseme_AA: 0 });
    const visemeMesh = makeMorphMesh('VisemeMesh', { Viseme_AA: 0 });
    model.add(faceMesh, visemeMesh);

    const engine = new Loom3({
      profile: makeProfile({
        auToBones: {
          26: [{ node: 'JAW', channel: 'rz', scale: 1, maxDegrees: 30 }],
        },
        boneNodes: { JAW: 'Jaw' },
        morphToMesh: { face: ['FaceMesh'], viseme: ['VisemeMesh'] },
        visemeKeys: ['Viseme_AA'],
        visemeMeshCategory: 'face',
        visemeJawAmounts: [0.2],
        compositeRotations: [
          {
            node: 'JAW',
            pitch: { aus: [26], axis: 'rz' },
            yaw: null,
            roll: null,
          },
        ],
      }),
    });

    engine.onReady({ model, meshes: [faceMesh, visemeMesh] });
    engine.setViseme(0, 1, 0.5);
    engine.update(1 / 60);

    expect(faceMesh.morphTargetInfluences?.[0]).toBe(1);
    expect(visemeMesh.morphTargetInfluences?.[0]).toBe(0);
    expect(Math.abs(engine.getBones().JAW.rotation[2])).toBeGreaterThan(2.5);

    engine.setProfile(makeProfile({
      auToBones: {
        26: [{ node: 'JAW', channel: 'rz', scale: 1, maxDegrees: 30 }],
      },
      boneNodes: { JAW: 'Jaw' },
      morphToMesh: { face: ['FaceMesh'], viseme: ['VisemeMesh'] },
      visemeKeys: ['Viseme_AA'],
      visemeMeshCategory: 'viseme',
      visemeJawAmounts: [0.6],
      compositeRotations: [
        {
          node: 'JAW',
          pitch: { aus: [26], axis: 'rz' },
          yaw: null,
          roll: null,
        },
      ],
    }));
    engine.update(1 / 60);

    expect(faceMesh.morphTargetInfluences?.[0]).toBe(0);
    expect(visemeMesh.morphTargetInfluences?.[0]).toBe(1);
    expect(Math.abs(engine.getBones().JAW.rotation[2])).toBeGreaterThan(8.5);
  });

  it('drives profile-defined viseme slots by id', () => {
    const { model } = makeHeadJawRig();
    const visemeMesh = makeMorphMesh('VisemeMesh', { Mouth_Aah: 0 });
    model.add(visemeMesh);

    const engine = new Loom3({
      profile: makeProfile({
        auToBones: {
          26: [{ node: 'JAW', channel: 'rz', scale: 1, maxDegrees: 30 }],
        },
        boneNodes: { JAW: 'Jaw' },
        morphToMesh: { face: [], viseme: ['VisemeMesh'] },
        visemeKeys: ['Mouth_Aah'],
        visemeMeshCategory: 'viseme',
        visemeSlots: [{ id: 'aa', label: 'AA', order: 0, defaultJawAmount: 0.5 }],
        compositeRotations: [
          {
            node: 'JAW',
            pitch: { aus: [], axis: 'rz' },
            yaw: null,
            roll: null,
          },
        ],
      }),
    });

    engine.onReady({ model, meshes: [visemeMesh] });
    engine.setVisemeById('aa', 1);
    engine.setVisemeById('missing', 1);
    engine.update(1 / 60);

    expect(visemeMesh.morphTargetInfluences?.[0]).toBe(1);
  });
});
