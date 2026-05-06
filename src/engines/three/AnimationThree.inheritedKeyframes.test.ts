import { describe, expect, it } from 'vitest';
import { BufferGeometry, Mesh, MeshBasicMaterial, Object3D, Quaternion, Vector3 } from 'three';
import type { Profile } from '../../mappings/types';
import type { ResolvedBones } from './types';
import { BakedAnimationController, type BakedAnimationHost } from './AnimationThree';

function makeMorphMesh(name: string, dictionary: Record<string, number>): Mesh {
  const mesh = new Mesh(new BufferGeometry(), new MeshBasicMaterial());
  mesh.name = name;
  (mesh as any).morphTargetDictionary = dictionary;
  const maxIndex = Object.values(dictionary).length > 0 ? Math.max(...Object.values(dictionary)) : -1;
  (mesh as any).morphTargetInfluences = maxIndex >= 0 ? new Array(maxIndex + 1).fill(0) : [];
  return mesh;
}

function makeBone(name = 'Head') {
  const obj = new Object3D();
  obj.name = name;
  return {
    obj,
    basePos: { x: 0, y: 0, z: 0 },
    baseQuat: new Quaternion(),
    baseEuler: { x: 0, y: 0, z: 0, order: 'XYZ' as const },
  };
}

function makeHost({
  profile,
  meshes = [],
  bones = {},
  auValues = {},
  visemeValues = [],
}: {
  profile: Profile;
  meshes?: Mesh[];
  bones?: ResolvedBones;
  auValues?: Record<number, number>;
  visemeValues?: number[];
}): BakedAnimationHost {
  const model = new Object3D();
  for (const mesh of meshes) model.add(mesh);
  for (const bone of Object.values(bones)) {
    if (bone) model.add(bone.obj);
  }
  const meshMap = new Map(meshes.map((mesh) => [mesh.name, mesh]));

  const readMorph = (morphKey: string, meshNames?: string[]) => {
    const names = meshNames ?? profile.morphToMesh?.face ?? [];
    for (const name of names) {
      const mesh = meshMap.get(name);
      const dict = mesh?.morphTargetDictionary;
      const infl = mesh?.morphTargetInfluences;
      if (!dict || !infl || dict[morphKey] === undefined) continue;
      return infl[dict[morphKey]] ?? 0;
    }
    return 0;
  };

  const readMorphIndex = (morphIndex: number, meshNames?: string[]) => {
    const names = meshNames ?? profile.morphToMesh?.face ?? [];
    for (const name of names) {
      const infl = meshMap.get(name)?.morphTargetInfluences;
      if (!infl || morphIndex < 0 || morphIndex >= infl.length) continue;
      return infl[morphIndex] ?? 0;
    }
    return 0;
  };

  return {
    getModel: () => model,
    getMeshes: () => meshes,
    getMeshByName: (name: string) => meshMap.get(name),
    getCurrentAUValue: (auId: number) => auValues[auId] ?? 0,
    getCurrentVisemeValue: (visemeIndex: number) => visemeValues[visemeIndex] ?? 0,
    getCurrentMorphValue: readMorph,
    getCurrentMorphIndexValue: readMorphIndex,
    getCurrentBoneQuaternion: (nodeKey: string) => bones[nodeKey]?.obj.quaternion.clone() ?? null,
    getCurrentBonePositionValue: (nodeKey: string, axis: 'x' | 'y' | 'z') => bones[nodeKey]?.obj.position[axis] ?? null,
    getBones: () => bones,
    getConfig: () => profile,
    getCompositeRotations: () => profile.compositeRotations || [],
    computeSideValues: (base: number) => ({ left: base, right: base }),
    getAUMixWeight: () => 1,
    isMixedAU: () => false,
  };
}

function getNumberTrackValues(clip: NonNullable<ReturnType<BakedAnimationController['snippetToClip']>>, trackNamePart: string): number[] {
  const track = clip.tracks.find((entry) => entry.name.includes(trackNamePart));
  expect(track).toBeTruthy();
  return Array.from(track!.values as ArrayLike<number>);
}

function getQuaternionTrackValues(clip: NonNullable<ReturnType<BakedAnimationController['snippetToClip']>>, obj: Object3D): number[] {
  const track = clip.tracks.find((entry) => entry.name === `${(obj as any).uuid}.quaternion`);
  expect(track).toBeTruthy();
  return Array.from(track!.values as ArrayLike<number>);
}

describe('BakedAnimationController inherited first keyframes', () => {
  it('anchors direct morph curves to the current morph value', () => {
    const mesh = makeMorphMesh('Face', { Smile: 0 });
    mesh.morphTargetInfluences![0] = 0.42;
    const profile: Profile = {
      auToMorphs: {},
      auToBones: {},
      boneNodes: {},
      morphToMesh: { face: ['Face'] },
      visemeKeys: [],
    };
    const controller = new BakedAnimationController(makeHost({ profile, meshes: [mesh] }));

    const clip = controller.snippetToClip('direct-inherit', {
      Smile: [
        { time: 0, intensity: 0, inherit: true },
        { time: 0.5, intensity: 1 },
      ],
    });

    expect(clip).toBeTruthy();
    const values = getNumberTrackValues(clip!, `${(mesh as any).uuid}.morphTargetInfluences[0]`);
    expect(values[0]).toBeCloseTo(0.42);
    expect(values[1]).toBeCloseTo(1);
  });

  it('keeps non-inherited direct morph curves absolute', () => {
    const mesh = makeMorphMesh('Face', { Smile: 0 });
    mesh.morphTargetInfluences![0] = 0.42;
    const profile: Profile = {
      auToMorphs: {},
      auToBones: {},
      boneNodes: {},
      morphToMesh: { face: ['Face'] },
      visemeKeys: [],
    };
    const controller = new BakedAnimationController(makeHost({ profile, meshes: [mesh] }));

    const clip = controller.snippetToClip('direct-absolute', {
      Smile: [
        { time: 0, intensity: 0 },
        { time: 0.5, intensity: 1 },
      ],
    });

    expect(clip).toBeTruthy();
    const values = getNumberTrackValues(clip!, `${(mesh as any).uuid}.morphTargetInfluences[0]`);
    expect(values).toEqual([0, 1]);
  });

  it('anchors AU-to-morph tracks to the current target morph value', () => {
    const mesh = makeMorphMesh('Face', { Smile: 0 });
    mesh.morphTargetInfluences![0] = 0.55;
    const profile: Profile = {
      auToMorphs: {
        12: { left: [], right: [], center: ['Smile'] },
      },
      auToBones: {},
      boneNodes: {},
      morphToMesh: { face: ['Face'] },
      visemeKeys: [],
    };
    const controller = new BakedAnimationController(makeHost({ profile, meshes: [mesh], auValues: { 12: 0.55 } }));

    const clip = controller.snippetToClip('au-morph-inherit', {
      12: [
        { time: 0, intensity: 0, inherit: true },
        { time: 0.5, intensity: 0.8 },
      ],
    });

    expect(clip).toBeTruthy();
    const values = getNumberTrackValues(clip!, `${(mesh as any).uuid}.morphTargetInfluences[0]`);
    expect(values[0]).toBeCloseTo(0.55);
    expect(values[1]).toBeCloseTo(0.8);
  });

  it('anchors auto viseme jaw tracks to the current jaw quaternion', () => {
    const jaw = makeBone('Jaw');
    jaw.obj.quaternion.copy(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 0.4));
    const profile: Profile = {
      auToMorphs: {},
      auToBones: {
        26: [{ node: 'JAW', channel: 'rz', scale: 1, maxDegrees: 30 }],
      },
      boneNodes: { JAW: 'Jaw' },
      morphToMesh: {},
      visemeKeys: ['AA'],
      visemeJawAmounts: [1],
    };
    const controller = new BakedAnimationController(makeHost({
      profile,
      bones: { JAW: jaw },
      visemeValues: [0.7],
    }));

    const clip = controller.snippetToClip(
      'viseme-jaw-inherit',
      {
        0: [
          { time: 0, intensity: 0, inherit: true },
          { time: 0.16, intensity: 0 },
        ],
      },
      { snippetCategory: 'visemeSnippet', autoVisemeJaw: true }
    );

    expect(clip).toBeTruthy();
    const values = getQuaternionTrackValues(clip!, jaw.obj);
    expect(values[0]).toBeCloseTo(jaw.obj.quaternion.x);
    expect(values[1]).toBeCloseTo(jaw.obj.quaternion.y);
    expect(values[2]).toBeCloseTo(jaw.obj.quaternion.z);
    expect(values[3]).toBeCloseTo(jaw.obj.quaternion.w);
    expect(values[4]).toBeCloseTo(jaw.baseQuat.x);
    expect(values[5]).toBeCloseTo(jaw.baseQuat.y);
    expect(values[6]).toBeCloseTo(jaw.baseQuat.z);
    expect(values[7]).toBeCloseTo(jaw.baseQuat.w);
  });

  it('anchors composite bone rotations to the current bone quaternion', () => {
    const head = makeBone('Head');
    head.obj.quaternion.copy(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.25));
    const profile: Profile = {
      auToMorphs: {},
      auToBones: {
        1: [{ node: 'HEAD', channel: 'ry', scale: 1, maxDegrees: 30 }],
      },
      boneNodes: { HEAD: 'Head' },
      morphToMesh: {},
      visemeKeys: [],
      compositeRotations: [
        {
          node: 'HEAD',
          pitch: null,
          yaw: { aus: [1], axis: 'ry', negative: [], positive: [1] },
          roll: null,
        },
      ],
    };
    const controller = new BakedAnimationController(makeHost({
      profile,
      bones: { HEAD: head },
      auValues: { 1: 0.5 },
    }));

    const clip = controller.snippetToClip('composite-inherit', {
      1: [
        { time: 0, intensity: 0, inherit: true },
        { time: 0.5, intensity: 1 },
      ],
    });

    expect(clip).toBeTruthy();
    const values = getQuaternionTrackValues(clip!, head.obj);
    expect(values[0]).toBeCloseTo(head.obj.quaternion.x);
    expect(values[1]).toBeCloseTo(head.obj.quaternion.y);
    expect(values[2]).toBeCloseTo(head.obj.quaternion.z);
    expect(values[3]).toBeCloseTo(head.obj.quaternion.w);
    expect(Math.abs(values[5])).toBeGreaterThan(1e-4);
  });

  it('anchors bone translation tracks to the current bone position', () => {
    const head = makeBone('Head');
    head.obj.position.x = 0.75;
    const profile: Profile = {
      auToMorphs: {},
      auToBones: {
        90: [{ node: 'HEAD', channel: 'tx', scale: 1, maxUnits: 2 }],
      },
      boneNodes: { HEAD: 'Head' },
      morphToMesh: {},
      visemeKeys: [],
    };
    const controller = new BakedAnimationController(makeHost({
      profile,
      bones: { HEAD: head },
      auValues: { 90: 0.375 },
    }));

    const clip = controller.snippetToClip('translation-inherit', {
      90: [
        { time: 0, intensity: 0, inherit: true },
        { time: 0.5, intensity: 1 },
      ],
    });

    expect(clip).toBeTruthy();
    const values = getNumberTrackValues(clip!, `${(head.obj as any).uuid}.position[x]`);
    expect(values).toEqual([0.75, 2]);
  });

  it('re-resolves inherited starts when a clip is played and replayed', () => {
    const mesh = makeMorphMesh('Face', { Smile: 0 });
    mesh.morphTargetInfluences![0] = 0.2;
    const profile: Profile = {
      auToMorphs: {},
      auToBones: {},
      boneNodes: {},
      morphToMesh: { face: ['Face'] },
      visemeKeys: [],
    };
    const controller = new BakedAnimationController(makeHost({ profile, meshes: [mesh] }));

    const clip = controller.snippetToClip('direct-replay-inherit', {
      Smile: [
        { time: 0, intensity: 0, inherit: true },
        { time: 0.5, intensity: 1 },
      ],
    });
    expect(clip).toBeTruthy();

    mesh.morphTargetInfluences![0] = 0.6;
    const handle = controller.playClip(clip!);
    expect(handle).toBeTruthy();
    handle!.setTime?.(0);
    expect(mesh.morphTargetInfluences![0]).toBeCloseTo(0.6);

    mesh.morphTargetInfluences![0] = 0.8;
    handle!.play();
    handle!.setTime?.(0);
    expect(mesh.morphTargetInfluences![0]).toBeCloseTo(0.8);

    mesh.morphTargetInfluences![0] = 0.9;
    const nextHandle = controller.playClip(clip!);
    expect(nextHandle).toBeTruthy();
    nextHandle!.setTime?.(0);
    expect(mesh.morphTargetInfluences![0]).toBeCloseTo(0.9);
  });
});
