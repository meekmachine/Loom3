import { describe, expect, it } from 'vitest';
import {
  AnimationClip,
  BufferGeometry,
  Mesh,
  MeshBasicMaterial,
  NumberKeyframeTrack,
  Object3D,
  QuaternionKeyframeTrack,
} from 'three';
import type { Profile } from '../../mappings/types';
import { BakedAnimationController, type BakedAnimationHost } from './AnimationThree';

function makeHost(options: { includeHeadBone?: boolean; includeCamera?: boolean } = {}): {
  controller: BakedAnimationController;
  model: Object3D;
  head: Object3D | null;
  camera: Object3D | null;
} {
  const model = new Object3D();
  const mesh = new Mesh(new BufferGeometry(), new MeshBasicMaterial());
  mesh.name = 'FaceMesh';
  (mesh as { morphTargetInfluences?: number[] }).morphTargetInfluences = [0];
  (mesh as { morphTargetDictionary?: Record<string, number> }).morphTargetDictionary = { smile: 0 };
  model.add(mesh);

  const head = options.includeHeadBone ? new Object3D() : null;
  if (head) {
    head.name = 'Head';
    model.add(head);
  }

  const camera = options.includeCamera ? new Object3D() : null;
  if (camera) {
    camera.name = 'PreviewCamera';
    (camera as { isCamera?: boolean }).isCamera = true;
    model.add(camera);
  }

  const bones = head
    ? {
        HEAD: {
          obj: head,
          basePos: { x: head.position.x, y: head.position.y, z: head.position.z },
          baseQuat: head.quaternion.clone(),
          baseEuler: { x: head.rotation.x, y: head.rotation.y, z: head.rotation.z, order: head.rotation.order },
        },
      }
    : {};

  const profile: Profile = {
    auToMorphs: {},
    auToBones: {},
    boneNodes: head ? { HEAD: 'Head' } : {},
    morphToMesh: { face: ['FaceMesh'] },
    visemeKeys: [],
  };

  const host: BakedAnimationHost = {
    getModel: () => model,
    getMeshes: () => [mesh],
    getMeshByName: (name: string) => (name === 'FaceMesh' ? mesh : undefined),
    getBones: () => bones as any,
    getConfig: () => profile,
    getCompositeRotations: () => [],
    computeSideValues: (base: number) => ({ left: base, right: base }),
    getAUMixWeight: () => 1,
    isMixedAU: () => false,
  };

  return { controller: new BakedAnimationController(host), model, head, camera };
}

function makeTransformClip(model: Object3D, name: string): AnimationClip {
  return new AnimationClip(name, 1, [
    new NumberKeyframeTrack(`${model.uuid}.position[x]`, [0, 1], [0, 1]),
  ]);
}

function makeMorphClip(name: string): AnimationClip {
  return new AnimationClip(name, 1, [
    new NumberKeyframeTrack('FaceMesh.morphTargetInfluences[0]', [0, 1], [0, 1]),
  ]);
}

function makeMixedClip(model: Object3D, head: Object3D, name: string): AnimationClip {
  return new AnimationClip(name, 1, [
    new NumberKeyframeTrack('FaceMesh.morphTargetInfluences[0]', [0, 1], [0, 1]),
    new QuaternionKeyframeTrack(`${head.uuid}.quaternion`, [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]),
    new NumberKeyframeTrack(`${model.uuid}.position[x]`, [0, 1], [0, 1]),
  ]);
}

function makeSceneClip(camera: Object3D, name: string): AnimationClip {
  return new AnimationClip(name, 1, [
    new NumberKeyframeTrack(`${camera.uuid}.position[x]`, [0, 1], [0, 1]),
  ]);
}

describe('BakedAnimationController playback state normalization', () => {
  it('normalizes baked clip options into the shared animation state surface', () => {
    const { controller } = makeHost();
    controller.loadAnimationClips([makeMorphClip('Idle')]);

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
      requestedBlendMode: 'additive',
      blendMode: 'additive',
      balance: 0.25,
      easing: 'easeInOut',
      channels: [
        { channel: 'face', trackCount: 1, playable: true, blendMode: 'additive' },
      ],
    });
    expect(state?.actionId).toBeTruthy();
    expect(state?.time).toBeCloseTo(0.7, 5);
    expect(controller.getAnimationClips()[0]).toMatchObject({
      source: 'baked',
      channels: [
        { channel: 'face', trackCount: 1, playable: true, blendMode: 'additive' },
      ],
    });
  });

  it('partitions mixed baked clips into face and body runtime channels', () => {
    const { controller, model, head } = makeHost({ includeHeadBone: true });
    expect(head).toBeTruthy();
    controller.loadAnimationClips([makeMixedClip(model, head!, 'HeadAndBody')]);

    const handle = controller.playAnimation('HeadAndBody', {
      blendMode: 'additive',
    });

    expect(handle).toBeTruthy();
    expect(controller.getAnimationClips()[0]).toMatchObject({
      name: 'HeadAndBody',
      channels: [
        { channel: 'face', trackCount: 2, playable: true, blendMode: 'additive' },
        { channel: 'body', trackCount: 1, playable: true, blendMode: 'replace' },
      ],
    });
    expect(controller.getAnimationState('HeadAndBody')).toMatchObject({
      name: 'HeadAndBody',
      requestedBlendMode: 'additive',
      blendMode: 'additive',
      channels: [
        { channel: 'face', trackCount: 2, playable: true, blendMode: 'additive' },
        { channel: 'body', trackCount: 1, playable: true, blendMode: 'replace' },
      ],
    });
  });

  it('surfaces scene-only partitions without creating a Loom3-playable action', () => {
    const { controller, camera } = makeHost({ includeCamera: true });
    expect(camera).toBeTruthy();
    controller.loadAnimationClips([makeSceneClip(camera!, 'SceneOnly')]);

    expect(controller.getAnimationClips()[0]).toMatchObject({
      name: 'SceneOnly',
      channels: [
        { channel: 'scene', trackCount: 1, playable: false, blendMode: undefined },
      ],
    });
    expect(controller.playAnimation('SceneOnly')).toBeNull();
  });

  it('applies the same normalized aliases to clip-backed playback', () => {
    const { controller, model } = makeHost();
    const clip = makeTransformClip(model, 'Wave');

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
      requestedBlendMode: 'replace',
    });
  });

  it('keeps body-only baked clips on replace when additive is requested', () => {
    const { controller, model } = makeHost();
    controller.loadAnimationClips([makeTransformClip(model, 'BodyOnly')]);

    controller.playAnimation('BodyOnly', { blendMode: 'additive' });

    expect(controller.getAnimationState('BodyOnly')).toMatchObject({
      name: 'BodyOnly',
      requestedBlendMode: 'additive',
      blendMode: 'replace',
      channels: [
        { channel: 'body', trackCount: 1, playable: true, blendMode: 'replace' },
      ],
    });
  });

  it('respects baked startTime and replays after stop without losing the source-level state', () => {
    const { controller } = makeHost();
    controller.loadAnimationClips([makeMorphClip('Idle')]);

    const firstHandle = controller.playAnimation('Idle', { startTime: 0.7 });
    expect(firstHandle).toBeTruthy();
    expect(controller.getAnimationState('Idle')?.time).toBeCloseTo(0.7, 5);

    controller.stopAnimation('Idle');
    expect(controller.getAnimationState('Idle')).toMatchObject({
      name: 'Idle',
      isPlaying: false,
      time: 0,
    });

    const replayHandle = controller.playAnimation('Idle');
    expect(replayHandle).toBeTruthy();
    expect(controller.getAnimationState('Idle')?.time).toBeCloseTo(0, 5);
  });

  it('removes baked clips from subsequent list and playback queries', () => {
    const { controller } = makeHost();
    controller.loadAnimationClips([
      makeMorphClip('Idle'),
      makeMorphClip('Wave'),
    ]);

    const handle = controller.playAnimation('Idle');
    expect(handle).toBeTruthy();

    expect(controller.removeAnimationClip('Idle')).toBe(true);
    expect(controller.getAnimationClips().map((clip) => clip.name)).toEqual(['Wave']);
    expect(controller.getAnimationState('Idle')).toBeNull();
    expect(controller.playAnimation('Idle')).toBeNull();
    expect(controller.removeAnimationClip('Idle')).toBe(false);
  });

  it('starts reverse once playback from the clip end for baked and clip-backed actions', () => {
    const { controller, model } = makeHost();
    const clip = makeTransformClip(model, 'Wave');
    controller.loadAnimationClips([makeMorphClip('Idle')]);

    controller.playAnimation('Idle', {
      loopMode: 'once',
      reverse: true,
    });
    expect(controller.getAnimationState('Idle')).toMatchObject({
      loopMode: 'once',
      reverse: true,
      time: 1,
    });

    const handle = controller.playClip(clip, {
      source: 'snippet',
      loopMode: 'once',
      reverse: true,
    });
    expect(handle).toBeTruthy();
    expect(controller.getAnimationState('Wave')).toMatchObject({
      loopMode: 'once',
      reverse: true,
      time: 1,
    });

    handle?.play();
    expect(controller.getAnimationState('Wave')?.time).toBeCloseTo(1, 5);
  });
});
