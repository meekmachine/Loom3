import { describe, expect, it } from 'vitest';
import { BufferGeometry, Mesh, MeshBasicMaterial, Object3D } from 'three';
import type { Profile } from '../../mappings/types';
import { Loom3 } from './Loom3';

function makeMorphMesh(name: string, morphKeys: string[]): Mesh {
  const mesh = new Mesh(new BufferGeometry(), new MeshBasicMaterial());
  mesh.name = name;
  (mesh as any).morphTargetDictionary = Object.fromEntries(
    morphKeys.map((key, index) => [key, index])
  );
  (mesh as any).morphTargetInfluences = new Array(morphKeys.length).fill(0);
  return mesh;
}

describe('Loom3 morph target resolution', () => {
  it('resolves morphPrefix/morphSuffix and numbered suffix variants at runtime', () => {
    const face = makeMorphMesh('FaceMesh', ['CC_Smile_geo', 'CC_Frown_geo_001']);
    const model = new Object3D();
    model.add(face);

    const profile: Profile = {
      auToMorphs: {
        1: { left: [], right: [], center: ['Smile'] },
        2: { left: [], right: [], center: ['Frown'] },
      },
      auToBones: {},
      boneNodes: {},
      morphPrefix: 'CC_',
      morphSuffix: '_geo',
      suffixPattern: '_\\d+$',
      morphToMesh: { face: ['FaceMesh'] },
      visemeKeys: [],
    };

    const engine = new Loom3({ profile });
    engine.onReady({ model, meshes: [face] });

    engine.setMorph('Smile', 1);
    engine.setMorph('Frown', 0.5);

    const dict = face.morphTargetDictionary as Record<string, number>;
    expect(face.morphTargetInfluences?.[dict.CC_Smile_geo]).toBe(1);
    expect(face.morphTargetInfluences?.[dict.CC_Frown_geo_001]).toBe(0.5);
  });
});
