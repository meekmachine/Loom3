import { describe, expect, it } from 'vitest';
import {
  AnimationClip,
  Mesh,
  MeshBasicMaterial,
  NumberKeyframeTrack,
  Object3D,
  BufferGeometry,
} from 'three';
import type { Profile } from '../../mappings/types';
import { BakedAnimationController, type BakedAnimationHost } from './AnimationThree';

function makeHost(): { controller: BakedAnimationController; model: Object3D } {
  const model = new Object3D();
  const mesh = new Mesh(new BufferGeometry(), new MeshBasicMaterial());
  mesh.name = 'FaceMesh';
  model.add(mesh);

  const profile: Profile = {
    auToMorphs: {},
    auToBones: {},
    boneNodes: {},
    morphToMesh: { face: ['FaceMesh'] },
    visemeKeys: [],
  };

  const host: BakedAnimationHost = {
    getModel: () => model,
    getMeshes: () => [mesh],
    getMeshByName: (name: string) => (name === 'FaceMesh' ? mesh : undefined),
    getBones: () => ({} as any),
    getConfig: () => profile,
    getCompositeRotations: () => [],
    computeSideValues: (base: number) => ({ left: base, right: base }),
    getAUMixWeight: () => 1,
    isMixedAU: () => false,
  };

  return { controller: new BakedAnimationController(host), model };
}

function makeClip(model: Object3D, name: string): AnimationClip {
  return new AnimationClip(name, 1, [
    new NumberKeyframeTrack(`${model.uuid}.position[x]`, [0, 1], [0, 1]),
  ]);
}

describe('BakedAnimationController playback state normalization', () => {
  it('normalizes baked clip options into the shared animation state surface', () => {
    const { controller, model } = makeHost();
    controller.loadAnimationClips([makeClip(model, 'Idle')]);

    const handle = controller.playAnimation('Idle', {
      playbackRate: 1.5,
      weight: 1.6,
      reverse: true,
      loopMode: 'pingpong',
      repeatCount: 3,
      blendMode: 'additive',
      balance: 0.25,
      easing: 'easeInOut',
    });

    expect(handle).toBeTruthy();
    controller.seekAnimation('Idle', 0.7);
    const state = controller.getAnimationState('Idle');

    expect(state).toMatchObject({
      name: 'Idle',
      source: 'baked',
      playbackRate: 1.5,
      speed: 1.5,
      reverse: true,
      weight: 1.6,
      loop: true,
      loopMode: 'pingpong',
      repeatCount: 3,
      blendMode: 'additive',
      balance: 0.25,
      easing: 'easeInOut',
    });
    expect(state?.actionId).toBeTruthy();
    expect(state?.time).toBeCloseTo(0.7, 5);
    expect(controller.getAnimationClips()[0]?.source).toBe('baked');
  });

  it('applies the same normalized aliases to clip-backed playback', () => {
    const { controller, model } = makeHost();
    const clip = makeClip(model, 'Wave');

    const handle = controller.playClip(clip, {
      source: 'snippet',
      speed: 2,
      weight: 1.25,
      reverse: false,
      loopMode: 'once',
    });

    expect(handle).toBeTruthy();
    const state = controller.getAnimationState('Wave');

    expect(state).toMatchObject({
      name: 'Wave',
      source: 'snippet',
      playbackRate: 2,
      speed: 2,
      reverse: false,
      weight: 1.25,
      loop: false,
      loopMode: 'once',
    });
  });
});
