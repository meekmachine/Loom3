import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AnimationClip,
  Bone,
  Object3D,
  Quaternion,
  QuaternionKeyframeTrack,
  Vector3,
  VectorKeyframeTrack,
} from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import type { Profile } from '../../mappings/types';
import { BakedAnimationController, type BakedAnimationHost } from './AnimationThree';
import { retargetFbxAnimationClips } from './fbxAnimationImport';

type TargetRig = {
  model: Object3D;
  hip: Bone;
  head: Bone;
  leftArm: Bone;
};

function makeBone(name: string, y = 0): Bone {
  const bone = new Bone();
  bone.name = name;
  bone.position.set(0, y, 0);
  return bone;
}

function makeTargetRig(): TargetRig {
  const model = new Object3D();

  const hip = makeBone('CC_Base_Hip_02', 10);
  const waist = makeBone('CC_Base_Waist_033', 8);
  const spine = makeBone('CC_Base_Spine01_040', 8);
  const spine2 = makeBone('CC_Base_Spine02_041', 8);
  const neck = makeBone('CC_Base_NeckTwist01_048', 4);
  const head = makeBone('CC_Base_Head_049', 4);
  const leftShoulder = makeBone('CC_Base_L_Clavicle_050', 2);
  const leftArm = makeBone('CC_Base_L_Upperarm_051', 6);
  const leftForearm = makeBone('CC_Base_L_Forearm_052', 6);
  const leftHand = makeBone('CC_Base_L_Hand_053', 4);

  model.add(hip);
  hip.add(waist);
  waist.add(spine);
  spine.add(spine2);
  spine2.add(neck);
  neck.add(head);
  spine2.add(leftShoulder);
  leftShoulder.add(leftArm);
  leftArm.add(leftForearm);
  leftForearm.add(leftHand);
  model.updateMatrixWorld(true);

  return { model, hip, head, leftArm };
}

function makeSourceScene(): Object3D & { animations: AnimationClip[] } {
  const scene = new Object3D() as Object3D & { animations: AnimationClip[] };

  const hips = makeBone('mixamorig:Hips', 10);
  const spine = makeBone('mixamorig:Spine', 8);
  const spine1 = makeBone('mixamorig:Spine1', 8);
  const spine2 = makeBone('mixamorig:Spine2', 8);
  const neck = makeBone('mixamorig:Neck', 4);
  const head = makeBone('mixamorig:Head', 4);
  const leftShoulder = makeBone('mixamorig:LeftShoulder', 2);
  const leftArm = makeBone('mixamorig:LeftArm', 6);
  const leftForeArm = makeBone('mixamorig:LeftForeArm', 6);
  const leftHand = makeBone('mixamorig:LeftHand', 4);

  scene.add(hips);
  hips.add(spine);
  spine.add(spine1);
  spine1.add(spine2);
  spine2.add(neck);
  neck.add(head);
  spine2.add(leftShoulder);
  leftShoulder.add(leftArm);
  leftArm.add(leftForeArm);
  leftForeArm.add(leftHand);

  const identity = new Quaternion();
  const raisedHead = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 6);
  const raisedArm = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -Math.PI / 4);

  scene.animations = [
    new AnimationClip('Mixamo Wave', 1, [
      new VectorKeyframeTrack('mixamorig:Hips.position', [0, 1], [20, 12, 5, 28, 18, 9]),
      new QuaternionKeyframeTrack(
        'mixamorig:Head.quaternion',
        [0, 1],
        [identity.x, identity.y, identity.z, identity.w, raisedHead.x, raisedHead.y, raisedHead.z, raisedHead.w]
      ),
      new QuaternionKeyframeTrack(
        'mixamorig:LeftArm.quaternion',
        [0, 1],
        [identity.x, identity.y, identity.z, identity.w, raisedArm.x, raisedArm.y, raisedArm.z, raisedArm.w]
      ),
      new VectorKeyframeTrack('Camera.position', [0, 1], [100, 100, 100, 120, 120, 120]),
    ]),
  ];
  scene.updateMatrixWorld(true);

  return scene;
}

function makeController(model: Object3D): BakedAnimationController {
  const profile: Profile = {
    auToMorphs: {},
    auToBones: {},
    boneNodes: {},
    morphToMesh: { face: [] },
    visemeKeys: [],
  };

  const host: BakedAnimationHost = {
    getModel: () => model,
    getMeshes: () => [],
    getMeshByName: () => undefined,
    getBones: () => ({} as any),
    getConfig: () => profile,
    getCompositeRotations: () => [],
    computeSideValues: (base: number) => ({ left: base, right: base }),
    getAUMixWeight: () => 1,
    isMixedAU: () => false,
  };

  return new BakedAnimationController(host);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('FBX animation import', () => {
  it('retargets Mixamo clips onto suffixed CC4 bones and strips root-position noise', async () => {
    const { model, hip, head, leftArm } = makeTargetRig();
    const originalHipPosition = hip.position.clone();
    const originalHipQuaternion = hip.quaternion.clone();
    const originalHeadQuaternion = head.quaternion.clone();

    vi.spyOn(FBXLoader.prototype, 'parse').mockImplementation(() => makeSourceScene() as any);

    const result = await retargetFbxAnimationClips(model, new ArrayBuffer(8));
    expect(result.sourceClipCount).toBe(1);
    expect(result.matchedBoneCount).toBeGreaterThanOrEqual(6);
    expect(result.clips).toHaveLength(1);

    const clip = result.clips[0]!;
    const trackNames = clip.tracks.map((track) => track.name);
    const headTrack = clip.tracks.find((track) => track.name === `${head.uuid}.quaternion`) as QuaternionKeyframeTrack | undefined;
    const armTrack = clip.tracks.find((track) => track.name === `${leftArm.uuid}.quaternion`) as QuaternionKeyframeTrack | undefined;

    expect(clip.name).toBe('Mixamo Wave');
    expect(trackNames).toContain(`${head.uuid}.quaternion`);
    expect(trackNames).toContain(`${leftArm.uuid}.quaternion`);
    expect(trackNames.some((name) => name.includes('Camera'))).toBe(false);
    expect(trackNames.some((name) => name.includes('.bones['))).toBe(false);
    expect(trackNames.some((name) => name.startsWith(`${hip.uuid}.position`))).toBe(false);
    expect(Array.from(headTrack?.values.slice(0, 4) ?? [])).not.toEqual(Array.from(headTrack?.values.slice(4, 8) ?? []));
    expect(Array.from(armTrack?.values.slice(0, 4) ?? [])).not.toEqual(Array.from(armTrack?.values.slice(4, 8) ?? []));

    expect(hip.position.toArray()).toEqual(originalHipPosition.toArray());
    expect(hip.quaternion.toArray()).toEqual(originalHipQuaternion.toArray());
    expect(head.quaternion.toArray()).toEqual(originalHeadQuaternion.toArray());
  });

  it('appends imported FBX clips by default and can replace the baked registry on request', async () => {
    const { model } = makeTargetRig();
    const controller = makeController(model);

    controller.loadAnimationClips([
      new AnimationClip('Idle', 1, []),
    ]);

    vi.spyOn(FBXLoader.prototype, 'parse').mockImplementation(() => makeSourceScene() as any);

    const appended = await controller.loadAnimationClipsFromFBX(new ArrayBuffer(8));
    expect(appended.loadedClips.map((clip) => clip.name)).toEqual(['Mixamo Wave']);
    expect(controller.getAnimationClips().map((clip) => clip.name)).toEqual(['Idle', 'Mixamo Wave']);

    const replaced = await controller.loadAnimationClipsFromFBX(new ArrayBuffer(8), {
      append: false,
      clipName: 'Imported Wave',
    });
    expect(replaced.loadedClips.map((clip) => clip.name)).toEqual(['Imported Wave']);
    expect(controller.getAnimationClips().map((clip) => clip.name)).toEqual(['Imported Wave']);
  });
});
