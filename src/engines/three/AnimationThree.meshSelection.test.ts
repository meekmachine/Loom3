import { describe, expect, it } from 'vitest';
import { BufferGeometry, Mesh, MeshBasicMaterial, Object3D } from 'three';
import type { Profile } from '../../mappings/types';
import { getMeshNamesForAUProfile, getMeshNamesForVisemeProfile } from '../../mappings/visemeSystem';
import { BakedAnimationController, type BakedAnimationHost } from './AnimationThree';

function makeMorphMesh(name: string, dictionary: Record<string, number>): Mesh {
  const mesh = new Mesh(new BufferGeometry(), new MeshBasicMaterial());
  mesh.name = name;
  (mesh as any).morphTargetDictionary = dictionary;
  const maxIndex = Object.values(dictionary).length > 0 ? Math.max(...Object.values(dictionary)) : -1;
  (mesh as any).morphTargetInfluences = maxIndex >= 0 ? new Array(maxIndex + 1).fill(0) : [];
  return mesh;
}

function getMeshNamesForAU(profile: Profile, auId: number): string[] {
  return getMeshNamesForAUProfile(profile, auId);
}

function getMeshNamesForViseme(profile: Profile): string[] {
  return getMeshNamesForVisemeProfile(profile);
}

function makeHost(profile: Profile, meshes: Mesh[]): BakedAnimationHost {
  const meshMap = new Map(meshes.map((mesh) => [mesh.name, mesh]));
  return {
    getModel: () => new Object3D(),
    getMeshes: () => meshes,
    getMeshByName: (name: string) => meshMap.get(name),
    getMeshNamesForAU: (auId: number) => getMeshNamesForAU(profile, auId),
    getMeshNamesForViseme: () => getMeshNamesForViseme(profile),
    getBones: () => ({} as any),
    getConfig: () => profile,
    getCompositeRotations: () => [],
    computeSideValues: (base: number) => ({ left: base, right: base }),
    getAUMixWeight: () => 1,
    isMixedAU: () => false,
  };
}

describe('BakedAnimationController mesh selection', () => {
  it('routes AU clip tracks using AU mesh mapping (eye AUs stay on eye meshes)', () => {
    const faceMesh = makeMorphMesh('FaceMesh', { Eye_Look_Left: 0 });
    const eyeMesh = makeMorphMesh('EyeMesh', { Eye_Look_Left: 0 });

    const profile: Profile = {
      auToMorphs: {
        61: { left: ['Eye_Look_Left'], right: [], center: [] },
      },
      auToBones: {},
      boneNodes: {},
      morphToMesh: { face: ['FaceMesh'], eye: ['EyeMesh'] },
      visemeKeys: [],
      auFacePartToMeshCategory: { Eye: 'eye' },
      auInfo: {
        '61': { id: '61', name: 'Eye Left', facePart: 'Eye' },
      },
    };

    const host = makeHost(profile, [faceMesh, eyeMesh]);
    const controller = new BakedAnimationController(host);
    const clip = controller.snippetToClip(
      'eye-au-routing',
      { '61': [{ time: 0, intensity: 0 }, { time: 1, intensity: 1 }] }
    );

    expect(clip).toBeTruthy();
    const trackNames = clip!.tracks.map((track) => track.name);
    expect(trackNames.some((name) => name.includes((eyeMesh as any).uuid))).toBe(true);
    expect(trackNames.some((name) => name.includes((faceMesh as any).uuid))).toBe(false);
  });

  it('does not fall back to all meshes when selected AU meshes have no matching morph', () => {
    const faceMesh = makeMorphMesh('FaceMesh', { Mouth_Open: 0 });
    const accessoryMesh = makeMorphMesh('AccessoryMesh', { Brow_Raise: 0 });

    const profile: Profile = {
      auToMorphs: {
        1: { left: ['Brow_Raise'], right: [], center: [] },
      },
      auToBones: {},
      boneNodes: {},
      morphToMesh: { face: ['FaceMesh'] },
      visemeKeys: [],
    };

    const host = makeHost(profile, [faceMesh, accessoryMesh]);
    const controller = new BakedAnimationController(host);
    const clip = controller.snippetToClip(
      'no-all-mesh-fallback',
      { '1': [{ time: 0, intensity: 0 }, { time: 1, intensity: 1 }] }
    );

    expect(clip).toBeNull();
  });

  it('routes viseme clip tracks using configurable viseme mesh category', () => {
    const faceMesh = makeMorphMesh('FaceMesh', { Viseme_AA: 0 });
    const visemeMesh = makeMorphMesh('VisemeMesh', { Viseme_AA: 0 });

    const profile: Profile = {
      auToMorphs: {},
      auToBones: {},
      boneNodes: {},
      morphToMesh: { face: ['FaceMesh'], viseme: ['VisemeMesh'] },
      visemeKeys: ['Viseme_AA'],
      visemeMeshCategory: 'viseme',
    };

    const host = makeHost(profile, [faceMesh, visemeMesh]);
    const controller = new BakedAnimationController(host);
    const clip = controller.snippetToClip(
      'viseme-routing',
      { '0': [{ time: 0, intensity: 0 }, { time: 1, intensity: 1 }] },
      { snippetCategory: 'visemeSnippet' }
    );

    expect(clip).toBeTruthy();
    const trackNames = clip!.tracks.map((track) => track.name);
    expect(trackNames.some((name) => name.includes((visemeMesh as any).uuid))).toBe(true);
    expect(trackNames.some((name) => name.includes((faceMesh as any).uuid))).toBe(false);
  });

  it('does not fall back to face when the explicit viseme mesh category is empty', () => {
    const faceMesh = makeMorphMesh('FaceMesh', { Viseme_AA: 0 });

    const profile: Profile = {
      auToMorphs: {},
      auToBones: {},
      boneNodes: {},
      morphToMesh: { face: ['FaceMesh'], viseme: [] },
      visemeKeys: ['Viseme_AA'],
      visemeMeshCategory: 'viseme',
    };

    const host = makeHost(profile, [faceMesh]);
    const controller = new BakedAnimationController(host);
    const clip = controller.snippetToClip(
      'viseme-empty-routing',
      { '0': [{ time: 0, intensity: 0 }, { time: 1, intensity: 1 }] },
      { snippetCategory: 'visemeSnippet' }
    );

    expect(clip).toBeNull();
  });
});
