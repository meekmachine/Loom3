import { describe, expect, it, vi } from 'vitest';
import {
  AnimationClip,
  Quaternion,
  Vector3,
  Mesh,
  MeshBasicMaterial,
  NumberKeyframeTrack,
  Object3D,
  QuaternionKeyframeTrack,
  BufferGeometry,
} from 'three';
import type { Profile } from '../../mappings/types';
import { BakedAnimationController, type BakedAnimationHost } from './AnimationThree';

const Z_AXIS = new Vector3(0, 0, 1);

function makeHost(options: {
  includeHeadBone?: boolean;
  includeHipBone?: boolean;
  includeJawBone?: boolean;
  includeFootBone?: boolean;
  reapplyProceduralState?: () => void;
} = {}): {
  controller: BakedAnimationController;
  model: Object3D;
  mesh: Mesh;
  head: Object3D | null;
  hip: Object3D | null;
  jaw: Object3D | null;
  foot: Object3D | null;
} {
  const model = new Object3D();
  const mesh = new Mesh(new BufferGeometry(), new MeshBasicMaterial());
  mesh.name = 'FaceMesh';
  (mesh as any).morphTargetInfluences = [0];
  (mesh as any).morphTargetDictionary = { smile: 0 };
  model.add(mesh);
  const head = options.includeHeadBone ? new Object3D() : null;
  if (head) {
    head.name = 'Head';
    model.add(head);
  }
  const hip = options.includeHipBone ? new Object3D() : null;
  if (hip) {
    hip.name = 'CC_Base_Hip';
    model.add(hip);
  }
  const jaw = options.includeJawBone ? new Object3D() : null;
  if (jaw) {
    jaw.name = 'Jaw';
    model.add(jaw);
  }
  const foot = options.includeFootBone ? new Object3D() : null;
  if (foot) {
    foot.name = 'L_Foot';
    model.add(foot);
  }

  const bones = {
    ...(head
      ? {
        HEAD: {
          obj: head,
          basePos: { x: head.position.x, y: head.position.y, z: head.position.z },
          baseQuat: head.quaternion.clone(),
          baseEuler: { x: head.rotation.x, y: head.rotation.y, z: head.rotation.z, order: head.rotation.order },
        },
      }
      : {}),
    ...(hip
      ? {
        HIPS: {
          obj: hip,
          basePos: { x: hip.position.x, y: hip.position.y, z: hip.position.z },
          baseQuat: hip.quaternion.clone(),
          baseEuler: { x: hip.rotation.x, y: hip.rotation.y, z: hip.rotation.z, order: hip.rotation.order },
        },
      }
      : {}),
    ...(jaw
      ? {
        JAW: {
          obj: jaw,
          basePos: { x: jaw.position.x, y: jaw.position.y, z: jaw.position.z },
          baseQuat: jaw.quaternion.clone(),
          baseEuler: { x: jaw.rotation.x, y: jaw.rotation.y, z: jaw.rotation.z, order: jaw.rotation.order },
        },
      }
      : {}),
    ...(foot
      ? {
        FOOT_L: {
          obj: foot,
          basePos: { x: foot.position.x, y: foot.position.y, z: foot.position.z },
          baseQuat: foot.quaternion.clone(),
          baseEuler: { x: foot.rotation.x, y: foot.rotation.y, z: foot.rotation.z, order: foot.rotation.order },
        },
      }
      : {}),
  };

  const profile: Profile = {
    auToMorphs: {},
    auToBones: {},
    boneNodes: {
      ...(head ? { HEAD: 'Head' } : {}),
      ...(hip ? { HIPS: 'CC_Base_Hip' } : {}),
      ...(jaw ? { JAW: 'Jaw' } : {}),
      ...(foot ? { FOOT_L: 'L_Foot' } : {}),
    },
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
    reapplyProceduralState: options.reapplyProceduralState,
  };

  return { controller: new BakedAnimationController(host), model, mesh, head, hip, jaw, foot };
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

function makeMorphPoseClip(name: string, start: number, end: number): AnimationClip {
  return new AnimationClip(name, 1, [
    new NumberKeyframeTrack('FaceMesh.morphTargetInfluences[0]', [0, 1], [start, end]),
  ]);
}

function makeSafeBoneClip(head: Object3D, name: string): AnimationClip {
  return new AnimationClip(name, 1, [
    new QuaternionKeyframeTrack(`${head.uuid}.quaternion`, [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]),
  ]);
}

function makeQuaternionPoseClip(target: Object3D, name: string, startDeg: number, endDeg: number): AnimationClip {
  const start = new Quaternion().setFromAxisAngle(Z_AXIS, (startDeg * Math.PI) / 180);
  const end = new Quaternion().setFromAxisAngle(Z_AXIS, (endDeg * Math.PI) / 180);
  return new AnimationClip(name, 1, [
    new QuaternionKeyframeTrack(
      `${target.uuid}.quaternion`,
      [0, 1],
      [start.x, start.y, start.z, start.w, end.x, end.y, end.z, end.w]
    ),
  ]);
}

function makeBonePositionClip(target: Object3D, name: string): AnimationClip {
  return new AnimationClip(name, 1, [
    new NumberKeyframeTrack(`${target.uuid}.position[x]`, [0, 1], [0, 1]),
  ]);
}

function makeBoneQuaternionClip(target: Object3D, name: string): AnimationClip {
  return new AnimationClip(name, 1, [
    new QuaternionKeyframeTrack(`${target.uuid}.quaternion`, [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]),
  ]);
}

function makeJawQuaternionClip(target: Object3D, name: string, startDeg: number, endDeg: number): AnimationClip {
  return makeQuaternionPoseClip(target, name, startDeg, endDeg);
}

function makeMixedMorphJawClip(target: Object3D, name: string, startDeg: number, endDeg: number): AnimationClip {
  return makeMixedMorphQuaternionClip(target, name, startDeg, endDeg);
}

function makeMixedMorphQuaternionClip(target: Object3D, name: string, startDeg: number, endDeg: number): AnimationClip {
  const start = new Quaternion().setFromAxisAngle(Z_AXIS, (startDeg * Math.PI) / 180);
  const end = new Quaternion().setFromAxisAngle(Z_AXIS, (endDeg * Math.PI) / 180);
  return new AnimationClip(name, 1, [
    new NumberKeyframeTrack('FaceMesh.morphTargetInfluences[0]', [0, 1], [0, 1]),
    new QuaternionKeyframeTrack(
      `${target.uuid}.quaternion`,
      [0, 1],
      [start.x, start.y, start.z, start.w, end.x, end.y, end.z, end.w]
    ),
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
      supportsAdditive: true,
      balance: 0.25,
      easing: 'easeInOut',
    });
    expect(state?.actionId).toBeTruthy();
    expect(state?.time).toBeCloseTo(0.7, 5);
    expect(controller.getAnimationClips()[0]?.source).toBe('baked');
    expect(controller.getAnimationClips()[0]?.supportsAdditive).toBe(true);
  });

  it('falls back to replace for resolved head bone rotation tracks', () => {
    const { controller, head } = makeHost({ includeHeadBone: true });
    expect(head).toBeTruthy();
    controller.loadAnimationClips([makeSafeBoneClip(head!, 'HeadNod')]);

    const handle = controller.playAnimation('HeadNod', {
      blendMode: 'additive',
    });

    expect(handle).toBeTruthy();
    expect(controller.getAnimationState('HeadNod')).toMatchObject({
      name: 'HeadNod',
      requestedBlendMode: 'additive',
      blendMode: 'replace',
      supportsAdditive: false,
      additiveModeReason: 'unsafe_baked_additive_tracks',
    });
    expect(controller.getAnimationClips()[0]).toMatchObject({
      name: 'HeadNod',
      supportsAdditive: false,
      additiveModeReason: 'unsafe_baked_additive_tracks',
    });
  });

  it('falls back to replace for resolved bone position tracks even when the bone is whitelisted', () => {
    const { controller, head } = makeHost({ includeHeadBone: true });
    expect(head).toBeTruthy();
    controller.loadAnimationClips([makeBonePositionClip(head!, 'HeadShift')]);

    const handle = controller.playAnimation('HeadShift', {
      blendMode: 'additive',
    });

    expect(handle).toBeTruthy();
    expect(controller.getAnimationState('HeadShift')).toMatchObject({
      name: 'HeadShift',
      requestedBlendMode: 'additive',
      blendMode: 'replace',
      supportsAdditive: false,
      additiveModeReason: 'unsafe_baked_additive_tracks',
    });
  });

  it('falls back to replace for root-like bone rotation tracks even when they resolve as bones', () => {
    const { controller, hip } = makeHost({ includeHipBone: true });
    expect(hip).toBeTruthy();
    controller.loadAnimationClips([makeBoneQuaternionClip(hip!, 'HipTurn')]);

    const handle = controller.playAnimation('HipTurn', {
      blendMode: 'additive',
    });

    expect(handle).toBeTruthy();
    expect(controller.getAnimationState('HipTurn')).toMatchObject({
      name: 'HipTurn',
      requestedBlendMode: 'additive',
      blendMode: 'replace',
      supportsAdditive: false,
      additiveModeReason: 'unsafe_baked_additive_tracks',
    });
  });

  it('falls back to replace for resolved foot bone rotation tracks', () => {
    const { controller, foot } = makeHost({ includeFootBone: true });
    expect(foot).toBeTruthy();
    controller.loadAnimationClips([makeBoneQuaternionClip(foot!, 'FootLift')]);

    const handle = controller.playAnimation('FootLift', {
      blendMode: 'additive',
    });

    expect(handle).toBeTruthy();
    expect(controller.getAnimationState('FootLift')).toMatchObject({
      name: 'FootLift',
      requestedBlendMode: 'additive',
      blendMode: 'replace',
      supportsAdditive: false,
      additiveModeReason: 'unsafe_baked_additive_tracks',
    });
  });

  it('keeps safe morph tracks additive while filtering jaw rotation tracks', () => {
    const { controller, mesh, jaw } = makeHost({ includeJawBone: true });
    expect(jaw).toBeTruthy();
    jaw!.rotation.z = (5 * Math.PI) / 180;
    controller.loadAnimationClips([makeMixedMorphJawClip(jaw!, 'SmileWithJaw', 10, 20)]);

    const handle = controller.playAnimation('SmileWithJaw', {
      blendMode: 'additive',
    });

    expect(handle).toBeTruthy();
    controller.seekAnimation('SmileWithJaw', 1);
    expect((jaw!.rotation.z * 180) / Math.PI).toBeCloseTo(5, 3);
    expect(mesh.morphTargetInfluences?.[0]).toBeCloseTo(1, 3);
    expect(controller.getAnimationState('SmileWithJaw')).toMatchObject({
      name: 'SmileWithJaw',
      requestedBlendMode: 'additive',
      blendMode: 'additive',
      supportsAdditive: true,
    });
  });

  it('applies additive morph tracks relative to the neutral mesh state instead of the clip start pose', () => {
    const { controller, mesh } = makeHost();
    controller.loadAnimationClips([makeMorphPoseClip('SmilePose', 0.4, 1)]);

    const handle = controller.playAnimation('SmilePose', {
      blendMode: 'additive',
    });

    expect(handle).toBeTruthy();
    controller.seekAnimation('SmilePose', 0);
    expect(mesh.morphTargetInfluences?.[0]).toBeCloseTo(0.4, 3);
    controller.seekAnimation('SmilePose', 1);
    expect(mesh.morphTargetInfluences?.[0]).toBeCloseTo(1, 3);
    expect(controller.getAnimationState('SmilePose')).toMatchObject({
      name: 'SmilePose',
      requestedBlendMode: 'additive',
      blendMode: 'additive',
      supportsAdditive: true,
    });
  });

  it('keeps morph tracks additive while filtering head bone rotation tracks', () => {
    const { controller, mesh, head } = makeHost({ includeHeadBone: true });
    expect(head).toBeTruthy();
    head!.rotation.z = (5 * Math.PI) / 180;
    controller.loadAnimationClips([makeMixedMorphQuaternionClip(head!, 'SmileWithHeadTurn', 10, 20)]);

    const handle = controller.playAnimation('SmileWithHeadTurn', {
      blendMode: 'additive',
    });

    expect(handle).toBeTruthy();
    controller.seekAnimation('SmileWithHeadTurn', 1);
    expect((head!.rotation.z * 180) / Math.PI).toBeCloseTo(5, 3);
    expect(mesh.morphTargetInfluences?.[0]).toBeCloseTo(1, 3);
    expect(controller.getAnimationState('SmileWithHeadTurn')).toMatchObject({
      name: 'SmileWithHeadTurn',
      requestedBlendMode: 'additive',
      blendMode: 'additive',
      supportsAdditive: true,
    });
  });

  it('keeps morph tracks additive while filtering foot bone rotation tracks', () => {
    const { controller, mesh, foot } = makeHost({ includeFootBone: true });
    expect(foot).toBeTruthy();
    foot!.rotation.z = (5 * Math.PI) / 180;
    controller.loadAnimationClips([makeMixedMorphQuaternionClip(foot!, 'SmileWithFootLift', 10, 20)]);

    const handle = controller.playAnimation('SmileWithFootLift', {
      blendMode: 'additive',
    });

    expect(handle).toBeTruthy();
    controller.seekAnimation('SmileWithFootLift', 0);
    expect((foot!.rotation.z * 180) / Math.PI).toBeCloseTo(5, 3);
    controller.seekAnimation('SmileWithFootLift', 1);
    expect((foot!.rotation.z * 180) / Math.PI).toBeCloseTo(5, 3);
    expect(mesh.morphTargetInfluences?.[0]).toBeCloseTo(1, 3);
    expect(controller.getAnimationState('SmileWithFootLift')).toMatchObject({
      name: 'SmileWithFootLift',
      requestedBlendMode: 'additive',
      blendMode: 'additive',
      supportsAdditive: true,
    });
  });

  it('reapplies procedural state after additive baked mixer updates', () => {
    const reapplyProceduralState = vi.fn();
    const { controller } = makeHost({ reapplyProceduralState });
    controller.loadAnimationClips([makeMorphClip('Smile')]);

    controller.playAnimation('Smile', { blendMode: 'additive' });
    controller.update(1 / 60);

    expect(reapplyProceduralState).toHaveBeenCalledTimes(1);

    reapplyProceduralState.mockClear();
    controller.stopAnimation('Smile');
    controller.playAnimation('Smile', { blendMode: 'replace' });
    controller.update(1 / 60);

    expect(reapplyProceduralState).not.toHaveBeenCalled();
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
    });
  });

  it('respects baked startTime and replays after stop without losing the action', () => {
    const { controller, model } = makeHost();
    controller.loadAnimationClips([makeTransformClip(model, 'Idle')]);

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
    const { controller, model } = makeHost();
    controller.loadAnimationClips([
      makeTransformClip(model, 'Idle'),
      makeTransformClip(model, 'Wave'),
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
    controller.loadAnimationClips([makeTransformClip(model, 'Idle')]);

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

  it('falls back to replace when additive is requested for baked transform clips', () => {
    const { controller, model } = makeHost();
    controller.loadAnimationClips([makeTransformClip(model, 'Idle')]);

    const handle = controller.playAnimation('Idle', {
      blendMode: 'additive',
    });

    expect(handle).toBeTruthy();
    expect(controller.getAnimationState('Idle')).toMatchObject({
      name: 'Idle',
      requestedBlendMode: 'additive',
      blendMode: 'replace',
      supportsAdditive: false,
      additiveModeReason: 'unsafe_baked_additive_tracks',
    });
    expect(controller.getAnimationClips()[0]).toMatchObject({
      name: 'Idle',
      supportsAdditive: false,
      additiveModeReason: 'unsafe_baked_additive_tracks',
    });
  });

  it('switches mixed baked clips to filtered additive playback when toggled after playback starts', () => {
    const { controller, mesh, jaw } = makeHost({ includeJawBone: true });
    expect(jaw).toBeTruthy();
    jaw!.rotation.z = (5 * Math.PI) / 180;
    controller.loadAnimationClips([makeMixedMorphJawClip(jaw!, 'SmileWithJaw', 10, 20)]);

    controller.playAnimation('SmileWithJaw');
    const replaceActionId = controller.getAnimationState('SmileWithJaw')?.actionId;

    controller.setAnimationBlendMode('SmileWithJaw', 'additive');
    jaw!.rotation.z = (5 * Math.PI) / 180;
    controller.seekAnimation('SmileWithJaw', 1);

    expect(controller.getAnimationState('SmileWithJaw')).toMatchObject({
      name: 'SmileWithJaw',
      requestedBlendMode: 'additive',
      blendMode: 'additive',
      supportsAdditive: true,
    });
    expect(controller.getAnimationState('SmileWithJaw')?.actionId).not.toBe(replaceActionId);
    expect((jaw!.rotation.z * 180) / Math.PI).toBeCloseTo(5, 3);
    expect(mesh.morphTargetInfluences?.[0]).toBeCloseTo(1, 3);
  });

  it('clears filtered additive caches when a baked clip is removed and reloaded', () => {
    const { controller, model, jaw } = makeHost({ includeJawBone: true });
    expect(jaw).toBeTruthy();
    controller.loadAnimationClips([makeMixedMorphJawClip(jaw!, 'SmileWithJaw', 10, 20)]);

    controller.playAnimation('SmileWithJaw', {
      blendMode: 'additive',
    });
    expect(controller.getAnimationState('SmileWithJaw')).toMatchObject({
      blendMode: 'additive',
      supportsAdditive: true,
    });

    expect(controller.removeAnimationClip('SmileWithJaw')).toBe(true);
    controller.loadAnimationClips([makeTransformClip(model, 'SmileWithJaw')]);

    const handle = controller.playAnimation('SmileWithJaw', {
      blendMode: 'additive',
    });
    expect(handle).toBeTruthy();
    expect(controller.getAnimationState('SmileWithJaw')).toMatchObject({
      name: 'SmileWithJaw',
      requestedBlendMode: 'additive',
      blendMode: 'replace',
      supportsAdditive: false,
      additiveModeReason: 'unsafe_baked_additive_tracks',
    });
  });
});
