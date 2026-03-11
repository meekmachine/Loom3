import { describe, expect, it } from 'vitest';
import { BufferGeometry, Mesh, MeshBasicMaterial, Object3D } from 'three';
import type { Profile } from '../../mappings/types';
import { BakedAnimationController, type BakedAnimationHost } from './AnimationThree';

function makeHost(): { host: BakedAnimationHost; mesh: Mesh } {
  const mesh = new Mesh(new BufferGeometry(), new MeshBasicMaterial());
  mesh.name = 'FaceMesh';
  (mesh as any).morphTargetDictionary = {
    Eye_Blink_L: 0,
    Eye_Blink_R: 1,
    Mouth_Smile_L: 2,
    Mouth_Smile_R: 3,
  };
  (mesh as any).morphTargetInfluences = [0, 0, 0, 0];

  const profile: Profile = {
    auToMorphs: {
      12: { left: ['Mouth_Smile_L'], right: ['Mouth_Smile_R'], center: [] },
      43: { left: ['Eye_Blink_L'], right: ['Eye_Blink_R'], center: [] },
    },
    auToBones: {},
    boneNodes: {},
    morphToMesh: { face: ['FaceMesh'] },
    visemeKeys: [],
  };

  const host: BakedAnimationHost = {
    getModel: () => new Object3D(),
    getMeshes: () => [mesh],
    getMeshByName: (name: string) => (name === 'FaceMesh' ? mesh : undefined),
    getBones: () => ({} as any),
    getConfig: () => profile,
    getCompositeRotations: () => [],
    computeSideValues: (base: number) => ({ left: base, right: base }),
    getAUMixWeight: () => 1,
    isMixedAU: () => false,
  };

  return { host, mesh };
}

function getTrackValues(clip: any, morphIndex: number): number[] {
  const track = clip.tracks.find((t: any) => typeof t?.name === 'string' && t.name.includes(`[${morphIndex}]`));
  expect(track, `Missing track for morph index ${morphIndex}`).toBeTruthy();
  return Array.from(track.values as ArrayLike<number>);
}

describe('BakedAnimationController snippetToClip balanceMap', () => {
  it('applies per-AU balance overrides while preserving global fallback', () => {
    const { host } = makeHost();
    const controller = new BakedAnimationController(host);
    const curves = {
      12: [
        { time: 0, intensity: 0 },
        { time: 1, intensity: 1 },
      ],
      43: [
        { time: 0, intensity: 0 },
        { time: 1, intensity: 1 },
      ],
    };

    const clip = controller.snippetToClip('balance-map-test', curves, {
      balance: 0,
      balanceMap: { '43': 1 },
    });

    expect(clip).toBeTruthy();
    const blinkLeftValues = getTrackValues(clip, 0);
    const blinkRightValues = getTrackValues(clip, 1);
    const smileLeftValues = getTrackValues(clip, 2);
    const smileRightValues = getTrackValues(clip, 3);

    expect(Math.max(...blinkLeftValues)).toBe(0);
    expect(Math.max(...blinkRightValues)).toBeGreaterThan(0.9);
    expect(Math.max(...smileLeftValues)).toBeGreaterThan(0.9);
    expect(Math.max(...smileRightValues)).toBeGreaterThan(0.9);
  });
});
