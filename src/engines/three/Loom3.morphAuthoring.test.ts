import { describe, expect, it, vi } from 'vitest';
import { BufferAttribute, BufferGeometry, Mesh, MeshBasicMaterial, Object3D } from 'three';
import { Loom3, collectMorphMeshes } from './Loom3';
import { analyzeModel } from '../../validation/analyzeModel';

function makeGeometry(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([
    0, 0, 0,
    1, 0, 0,
    0, 1, 0,
  ]), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array([
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
  ]), 3));
  return geometry;
}

function makeMesh(name: string, morphs: Record<string, Float32Array> = {}): Mesh {
  const geometry = makeGeometry();
  const mesh = new Mesh(geometry, new MeshBasicMaterial());
  mesh.name = name;

  const entries = Object.entries(morphs);
  if (entries.length > 0) {
    geometry.morphAttributes.position = entries.map(([morphName, values]) => {
      const attribute = new BufferAttribute(values, 3);
      (attribute as any).name = morphName;
      return attribute;
    });
    geometry.morphTargetsRelative = true;
    mesh.morphTargetDictionary = Object.fromEntries(entries.map(([morphName], index) => [morphName, index]));
    mesh.morphTargetInfluences = new Array(entries.length).fill(0);
  }

  return mesh;
}

const smileDelta = new Float32Array([
  0, 0.1, 0,
  0, 0.1, 0,
  0, 0.1, 0,
]);

const bodyDelta = new Float32Array([
  0.1, 0, 0,
  0.1, 0, 0,
  0.1, 0, 0,
]);

describe('Loom3 runtime morph target authoring', () => {
  it('adds a named morph target and drives it by key and influence index', () => {
    const face = makeMesh('FaceMesh', { ExistingSmile: smileDelta });
    const model = new Object3D();
    model.add(face);

    const engine = new Loom3({
      presetType: 'cc4',
      profile: { morphToMesh: { face: ['FaceMesh'] } },
    });
    engine.onReady({ model, meshes: [face] });

    const index = engine.addMorphTarget({
      meshName: 'FaceMesh',
      name: 'CustomSmile',
      position: bodyDelta,
    }, { forceGeometryReplacement: false });

    expect(index).toBe(1);
    expect(face.morphTargetDictionary?.CustomSmile).toBe(1);
    expect(face.morphTargetInfluences).toEqual([0, 0]);

    engine.setMorph('CustomSmile', 0.75, ['FaceMesh']);
    expect(face.morphTargetInfluences?.[1]).toBe(0.75);

    engine.setMorphInfluence(1, 0.25, ['FaceMesh']);
    expect(face.morphTargetInfluences?.[1]).toBe(0.25);
  });

  it('uses geometry replacement by default for post-render-safe mutation', () => {
    const face = makeMesh('FaceMesh', { ExistingSmile: smileDelta });
    const oldGeometry = face.geometry;
    const dispose = vi.spyOn(oldGeometry, 'dispose');
    const model = new Object3D();
    model.add(face);

    const engine = new Loom3({
      presetType: 'cc4',
      profile: { morphToMesh: { face: ['FaceMesh'] } },
    });
    engine.onReady({ model, meshes: [face] });

    engine.addMorphTarget({
      meshName: 'FaceMesh',
      name: 'AfterRenderMorph',
      position: bodyDelta,
    });

    expect(face.geometry).not.toBe(oldGeometry);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(face.morphTargetDictionary?.AfterRenderMorph).toBe(1);
    expect(face.morphTargetInfluences).toEqual([0, 0]);
  });

  it('keeps existing morph attribute streams aligned for position-only targets', () => {
    const face = makeMesh('FaceMesh', { ExistingSmile: smileDelta });
    face.geometry.morphAttributes.normal = [
      new BufferAttribute(new Float32Array([
        0, 0, 0.1,
        0, 0, 0.1,
        0, 0, 0.1,
      ]), 3),
    ];
    const model = new Object3D();
    model.add(face);

    const engine = new Loom3({
      presetType: 'cc4',
      profile: { morphToMesh: { face: ['FaceMesh'] } },
    });
    engine.onReady({ model, meshes: [face] });

    engine.addMorphTarget({
      meshName: 'FaceMesh',
      name: 'BodyWidth',
      position: bodyDelta,
    });

    const normalMorphs = face.geometry.morphAttributes.normal;
    expect(normalMorphs).toHaveLength(2);
    expect(normalMorphs?.[1]?.array).toEqual(new Float32Array(9));
  });

  it('creates the first morph influence slot on a static mesh', async () => {
    const body = makeMesh('BodyMesh');
    const model = new Object3D();
    model.add(body);

    const engine = new Loom3({
      presetType: 'cc4',
      profile: { morphToMesh: { face: ['BodyMesh'] } },
    });
    engine.onReady({ model, meshes: [] });

    const index = engine.ensureMorphInfluence('BodyMesh', 'BodyType_Muscular');
    expect(index).toBe(0);

    engine.setMorph('BodyType_Muscular', 1, ['BodyMesh']);
    expect(body.morphTargetInfluences?.[0]).toBe(1);
    expect(collectMorphMeshes(model)).toEqual([body]);

    const report = await analyzeModel({
      source: { type: 'runtime', model, meshes: collectMorphMeshes(model), animations: [] },
    });
    expect(report.model.morphNames).toContain('BodyType_Muscular');
  });

  it('rebuilds AU morph caches after adding a previously missing target', () => {
    const face = makeMesh('FaceMesh');
    const model = new Object3D();
    model.add(face);

    const engine = new Loom3({
      presetType: 'cc4',
      profile: {
        morphToMesh: { face: ['FaceMesh'] },
        auToMorphs: { 999: { left: [], right: [], center: ['GeneratedAU999'] } },
      },
    });
    engine.onReady({ model, meshes: [] });
    engine.setAU(999, 1);

    engine.addMorphTarget({
      meshName: 'FaceMesh',
      name: 'GeneratedAU999',
      position: bodyDelta,
    });

    expect(face.morphTargetInfluences?.[0]).toBe(1);
  });

  it('rejects morph deltas with the wrong vertex count', () => {
    const face = makeMesh('FaceMesh');
    const model = new Object3D();
    model.add(face);

    const engine = new Loom3({
      presetType: 'cc4',
      profile: { morphToMesh: { face: ['FaceMesh'] } },
    });
    engine.onReady({ model, meshes: [] });

    expect(() => engine.addMorphTarget({
      meshName: 'FaceMesh',
      name: 'BadMorph',
      position: new Float32Array([0, 1, 2]),
    })).toThrow(/expected 9/);
  });
});
