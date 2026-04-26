import { describe, expect, it } from 'vitest';
import { Object3D, Quaternion } from 'three';
import type { Profile } from '../../mappings/types';
import { BONE_AU_TO_BINDINGS, COMPOSITE_ROTATIONS } from '../../presets/cc4';
import type { ResolvedBones } from './types';
import { BakedAnimationController, type BakedAnimationHost } from './AnimationThree';

function snapshot(obj: Object3D) {
  return {
    obj,
    basePos: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
    baseQuat: new Quaternion().copy(obj.quaternion),
    baseEuler: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z, order: obj.rotation.order },
  };
}

function makeHost(): BakedAnimationHost {
  const model = new Object3D();
  const leftEye = new Object3D();
  leftEye.name = 'CC_Base_L_Eye';
  model.add(leftEye);

  const bones: ResolvedBones = {
    EYE_L: snapshot(leftEye),
  };

  const profile: Profile = {
    auToMorphs: {},
    auToBones: BONE_AU_TO_BINDINGS,
    boneNodes: { EYE_L: 'L_Eye' },
    morphToMesh: {},
    visemeKeys: [],
  };

  return {
    getModel: () => model,
    getMeshes: () => [],
    getMeshByName: () => undefined,
    getBones: () => bones,
    getConfig: () => profile,
    getCompositeRotations: () => COMPOSITE_ROTATIONS,
    computeSideValues: (base: number) => ({ left: base, right: base }),
    getAUMixWeight: () => 1,
    isMixedAU: () => false,
  };
}

describe('BakedAnimationController clip events', () => {
  it('emits keyframe and completion events from mixer updates', () => {
    const controller = new BakedAnimationController(makeHost());
    const clip = controller.snippetToClip('eye-event-clip', {
      61: [
        { time: 0, intensity: 0 },
        { time: 0.5, intensity: 1 },
        { time: 1, intensity: 0 },
      ],
    });

    expect(clip).toBeTruthy();
    if (!clip) {
      throw new Error('Expected snippetToClip to return a clip');
    }

    const handle = controller.playClip(clip, { loopMode: 'once' });
    expect(handle).toBeTruthy();
    if (!handle?.subscribe) {
      throw new Error('Expected playClip to return a subscribable handle');
    }

    const events: Array<any> = [];
    handle.subscribe((event) => {
      events.push(event);
    });

    controller.update(0.5);
    controller.update(0.5);

    expect(events).toEqual([
      expect.objectContaining({
        type: 'keyframe',
        clipName: 'eye-event-clip',
        keyframeIndex: 1,
        currentTime: 0.5,
        totalKeyframes: 3,
      }),
      expect.objectContaining({
        type: 'keyframe',
        clipName: 'eye-event-clip',
        keyframeIndex: 2,
        currentTime: 1,
        totalKeyframes: 3,
      }),
      expect.objectContaining({
        type: 'completed',
        clipName: 'eye-event-clip',
        currentTime: 1,
      }),
    ]);
  });

  it('emits seek events when the playhead is scrubbed directly', () => {
    const controller = new BakedAnimationController(makeHost());
    const clip = controller.snippetToClip('seek-event-clip', {
      61: [
        { time: 0, intensity: 0 },
        { time: 1, intensity: 1 },
      ],
    });

    expect(clip).toBeTruthy();
    if (!clip) {
      throw new Error('Expected snippetToClip to return a clip');
    }

    const handle = controller.playClip(clip, { loopMode: 'once' });
    expect(handle).toBeTruthy();
    if (!handle?.subscribe || !handle.setTime) {
      throw new Error('Expected playClip to return a clip handle with subscribe/setTime');
    }

    const events: Array<any> = [];
    handle.subscribe((event) => {
      events.push(event);
    });

    handle.setTime(0.75);

    expect(events).toEqual([
      expect.objectContaining({
        type: 'seek',
        clipName: 'seek-event-clip',
        currentTime: 0.75,
      }),
    ]);
  });
});
