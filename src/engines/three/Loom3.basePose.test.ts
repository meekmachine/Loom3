import { describe, expect, it } from 'vitest';
import { Bone, BufferGeometry, Mesh, Object3D } from 'three';
import { Loom3 } from './Loom3';

function makeRig() {
  const model = new Object3D();
  const root = new Bone();
  root.name = 'Root';
  const head = new Bone();
  head.name = 'Head';
  head.position.set(0, 1, 0);
  root.add(head);
  model.add(root);

  const face = new Mesh(new BufferGeometry());
  face.name = 'Face';
  face.morphTargetDictionary = { Smile: 0 };
  face.morphTargetInfluences = [0.2];
  model.add(face);

  return { model, root, head, face };
}

describe('Loom3 base pose', () => {
  it('captures the imported rest pose and can reset back to it', () => {
    const { model, head, face } = makeRig();
    const engine = new Loom3({ presetType: 'cc4' });

    engine.onReady({ model, meshes: [face] });
    head.position.set(4, 5, 6);
    face.morphTargetInfluences![0] = 0.9;

    engine.resetToImportedRestPose();

    expect(head.position.toArray()).toEqual([0, 1, 0]);
    expect(face.morphTargetInfluences![0]).toBeCloseTo(0.2);
  });

  it('sets and resets to a user-authored base pose', () => {
    const { model, head, face } = makeRig();
    const engine = new Loom3({ presetType: 'cc4' });

    engine.onReady({ model, meshes: [face] });
    head.position.set(2, 3, 4);
    face.morphTargetInfluences![0] = 0.5;
    const basePose = engine.capturePose({ id: 'base', name: 'Base', kind: 'base', includeExpression: true });

    engine.setBasePose(basePose);
    head.position.set(9, 9, 9);
    face.morphTargetInfluences![0] = 0;
    engine.resetToBasePose();

    expect(head.position.toArray()).toEqual([2, 3, 4]);
    expect(face.morphTargetInfluences![0]).toBeCloseTo(0.5);
  });

  it('turns FACS AU base expressions into resolved morph parts in the base pose', () => {
    const { model, face } = makeRig();
    const engine = new Loom3({
      presetType: 'cc4',
      profile: {
        morphToMesh: { face: ['Face'] },
        auToMorphs: {
          12: { left: [], right: [], center: ['Smile'] },
        },
        auInfo: {
          12: { id: '12', name: 'Smile' },
        },
      },
    });

    engine.onReady({ model, meshes: [face] });
    const basePose = engine.setBaseExpression({ 12: 0.6 });

    expect(basePose?.aus?.['12']).toBeCloseTo(0.6);
    expect(basePose?.morphs?.Face?.Smile).toBeCloseTo(0.6);

    face.morphTargetInfluences![0] = 0;
    engine.resetToBasePose();

    expect(engine.getAU(12)).toBeCloseTo(0.6);
    expect(face.morphTargetInfluences![0]).toBeCloseTo(0.6);
  });
});
