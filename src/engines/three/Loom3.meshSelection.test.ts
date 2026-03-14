import { describe, expect, it } from 'vitest';
import { BufferGeometry, Mesh, MeshBasicMaterial, Object3D } from 'three';
import { Loom3 } from './Loom3';

function makeMorphMesh(name: string, morphKeys: string[]): Mesh {
  const mesh = new Mesh(new BufferGeometry(), new MeshBasicMaterial());
  mesh.name = name;
  (mesh as any).morphTargetDictionary = Object.fromEntries(morphKeys.map((key, index) => [key, index]));
  (mesh as any).morphTargetInfluences = new Array(morphKeys.length).fill(0);
  return mesh;
}

describe('Loom3 face mesh fallback selection', () => {
  it('seeds morphToMesh.face from resolved face meshes (not all morph meshes)', () => {
    const face = makeMorphMesh('FaceMesh', ['Brow_Drop_L']);
    const hair = makeMorphMesh('HairMesh', ['Brow_Drop_L']);

    const model = new Object3D();
    model.add(face, hair);

    const engine = new Loom3({
      presetType: 'cc4',
      profile: {
        morphToMesh: { face: [] },
        auToMorphs: { 999: { left: [], right: [], center: ['Brow_Drop_L'] } },
      },
    });

    engine.onReady({ model, meshes: [face, hair] });

    const profile = engine.getProfile();
    expect(profile.morphToMesh.face).toEqual(['FaceMesh']);
  });

  it('transitionAU applies only to selected face mesh mapping by default', () => {
    const face = makeMorphMesh('FaceMesh', ['Brow_Drop_L']);
    const hair = makeMorphMesh('HairMesh', ['Brow_Drop_L']);

    const model = new Object3D();
    model.add(face, hair);

    const engine = new Loom3({
      presetType: 'cc4',
      profile: {
        morphToMesh: { face: [] },
        auToMorphs: { 999: { left: [], right: [], center: ['Brow_Drop_L'] } },
      },
    });

    engine.onReady({ model, meshes: [face, hair] });
    engine.transitionAU(999, 1, 0);

    const faceIndex = face.morphTargetDictionary?.['Brow_Drop_L'];
    const hairIndex = hair.morphTargetDictionary?.['Brow_Drop_L'];
    expect(faceIndex).toBeTypeOf('number');
    expect(hairIndex).toBeTypeOf('number');

    expect(face.morphTargetInfluences?.[faceIndex as number]).toBe(1);
    expect(hair.morphTargetInfluences?.[hairIndex as number]).toBe(0);
  });
});
