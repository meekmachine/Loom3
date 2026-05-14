import { describe, expect, it } from 'vitest';
import { BufferGeometry, Mesh, MeshBasicMaterial, Object3D } from 'three';
import type { Profile } from '../../mappings/types';
import { Loom3 } from './Loom3';

function makeMorphMesh(name: string, dictionary: Record<string, number>): Mesh {
  const mesh = new Mesh(new BufferGeometry(), new MeshBasicMaterial());
  mesh.name = name;
  (mesh as any).morphTargetDictionary = dictionary;
  const maxIndex = Object.values(dictionary).length > 0 ? Math.max(...Object.values(dictionary)) : -1;
  (mesh as any).morphTargetInfluences = maxIndex >= 0 ? new Array(maxIndex + 1).fill(0) : [];
  return mesh;
}

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    auToMorphs: {},
    auToBones: {
      26: [{ node: 'JAW', channel: 'rz', scale: 1, maxDegrees: 30 }],
    },
    boneNodes: { JAW: 'Jaw' },
    morphToMesh: { face: [], viseme: ['VisemeMesh'] },
    visemeKeys: ['Viseme_AA', 'Viseme_BMP'],
    visemeSlots: [
      { id: 'aa', label: 'AA', order: 0, defaultJawAmount: 0.8 },
      { id: 'bmp', label: 'B/M/P', order: 1, defaultJawAmount: 0.2 },
    ],
    visemeMeshCategory: 'viseme',
    visemeJawAmounts: [0.8, 0.2],
    compositeRotations: [
      {
        node: 'JAW',
        pitch: { aus: [26], axis: 'rz' },
        yaw: null,
        roll: null,
      },
    ],
    ...overrides,
  };
}

function makeEngine(profile: Profile, mesh: Mesh): Loom3 {
  const model = new Object3D();
  const jaw = new Object3D();
  jaw.name = 'Jaw';
  model.add(jaw, mesh);
  const engine = new Loom3({ profile });
  engine.onReady({ model, meshes: [mesh] });
  return engine;
}

function jawRoll(engine: Loom3): number {
  engine.update(1 / 60);
  return Math.abs(engine.getBones().JAW.rotation[2]);
}

describe('Loom3 live viseme runtime', () => {
  it('closes the jaw when a live viseme is set back to zero', () => {
    const mesh = makeMorphMesh('VisemeMesh', { Viseme_AA: 0 });
    const engine = makeEngine(makeProfile({ visemeKeys: ['Viseme_AA'], visemeJawAmounts: [0.8] }), mesh);

    engine.setViseme(0, 1);
    expect(jawRoll(engine)).toBeGreaterThan(20);

    engine.setViseme(0, 0);
    expect(jawRoll(engine)).toBeLessThan(0.001);
    expect(mesh.morphTargetInfluences?.[0]).toBe(0);
  });

  it('transitions the jaw back to neutral when a live viseme target is zero', () => {
    const mesh = makeMorphMesh('VisemeMesh', { Viseme_AA: 0 });
    const engine = makeEngine(makeProfile({ visemeKeys: ['Viseme_AA'], visemeJawAmounts: [0.8] }), mesh);

    engine.transitionViseme(0, 1, 0);
    expect(jawRoll(engine)).toBeGreaterThan(20);

    engine.transitionViseme(0, 0, 0);
    expect(jawRoll(engine)).toBeLessThan(0.001);
    expect(mesh.morphTargetInfluences?.[0]).toBe(0);
  });

  it('keeps jaw driven by the strongest active viseme contribution', () => {
    const mesh = makeMorphMesh('VisemeMesh', { Viseme_AA: 0, Viseme_BMP: 1 });
    const engine = makeEngine(makeProfile(), mesh);

    engine.setViseme(0, 1);
    const openJaw = jawRoll(engine);

    engine.setViseme(1, 1);
    expect(jawRoll(engine)).toBeCloseTo(openJaw, 4);
    expect(mesh.morphTargetInfluences?.[0]).toBe(1);
    expect(mesh.morphTargetInfluences?.[1]).toBe(1);

    engine.setViseme(0, 0);
    expect(jawRoll(engine)).toBeLessThan(openJaw);
    expect(jawRoll(engine)).toBeGreaterThan(5);
  });

  it('drives one-to-many weighted viseme bindings by slot id', () => {
    const mesh = makeMorphMesh('VisemeMesh', { Mouth_Aah: 0, Mouth_Wide: 1 });
    const engine = makeEngine(makeProfile({
      visemeKeys: ['Legacy_AA'],
      visemeSlots: [{ id: 'aa', label: 'AA', order: 0, defaultJawAmount: 0.8 }],
      visemeBindings: {
        aa: {
          targets: [
            { morph: 'Mouth_Aah' },
            { morph: 'Mouth_Wide', weight: 0.5 },
          ],
        },
      },
    }), mesh);

    engine.setVisemeById('aa', 0.8);

    expect(mesh.morphTargetInfluences?.[0]).toBeCloseTo(0.8);
    expect(mesh.morphTargetInfluences?.[1]).toBeCloseTo(0.4);
  });

  it('supports many-to-one bindings without letting the last slot overwrite stronger active values', () => {
    const mesh = makeMorphMesh('VisemeMesh', { Shared_Mouth: 0 });
    const engine = makeEngine(makeProfile({
      visemeKeys: ['Legacy_AA', 'Legacy_BMP'],
      visemeSlots: [
        { id: 'aa', label: 'AA', order: 0, defaultJawAmount: 0.8 },
        { id: 'bmp', label: 'B/M/P', order: 1, defaultJawAmount: 0.2 },
      ],
      visemeBindings: {
        aa: { targets: [{ morph: 'Shared_Mouth' }] },
        bmp: { targets: [{ morph: 'Shared_Mouth', weight: 0.5 }] },
      },
    }), mesh);

    engine.setVisemeById('aa', 0.3);
    expect(mesh.morphTargetInfluences?.[0]).toBeCloseTo(0.3);

    engine.setVisemeById('bmp', 1);
    expect(mesh.morphTargetInfluences?.[0]).toBeCloseTo(0.5);

    engine.setVisemeById('bmp', 0);
    expect(mesh.morphTargetInfluences?.[0]).toBeCloseTo(0.3);
  });

  it('plays raw provider viseme timing through a Loom3-owned mixer sequence', () => {
    const mesh = makeMorphMesh('VisemeMesh', { Viseme_AA: 0, Viseme_BMP: 1 });
    const engine = makeEngine(makeProfile({
      visemeSlots: [
        { id: 'aa', label: 'AA', order: 0, providerIds: { azure: [1] }, defaultJawAmount: 0.8 },
        { id: 'bmp', label: 'B/M/P', order: 1, providerIds: { azure: [21] }, defaultJawAmount: 0 },
      ],
    }), mesh);

    const handle = engine.lipsyncSequence([
      { visemeId: 1, time: 0, duration: 0.12 },
      { visemeId: 21, time: 0.12, duration: 0.08 },
    ], {
      sourceProvider: 'microsoft',
      rampMs: 10,
      neutralPadMs: 0,
      name: 'raw-provider-visemes',
    });

    expect(handle).toBeTruthy();

    engine.update(0.02);
    expect(mesh.morphTargetInfluences?.[0]).toBeGreaterThan(0.5);
    expect(jawRoll(engine)).toBeGreaterThan(10);

    engine.update(0.12);
    expect(mesh.morphTargetInfluences?.[1]).toBeGreaterThan(0.5);
  });
});
