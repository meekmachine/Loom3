import { describe, expect, it } from 'vitest';
import {
  AnimationClip,
  NumberKeyframeTrack,
  Object3D,
  QuaternionKeyframeTrack,
} from 'three';
import type { ResolvedBones } from './types';
import {
  partitionBakedClip,
  resolveBakedAggregateBlendMode,
  resolveBakedChannelBlendMode,
} from './bakedClipPartitioning';

function makeModel(): {
  model: Object3D;
  head: Object3D;
  hip: Object3D;
  camera: Object3D;
  bones: ResolvedBones;
} {
  const model = new Object3D();

  const head = new Object3D();
  head.name = 'CC_Base_Head';
  model.add(head);

  const hip = new Object3D();
  hip.name = 'CC_Base_Hip';
  model.add(hip);

  const camera = new Object3D();
  camera.name = 'PreviewCamera';
  (camera as { isCamera?: boolean }).isCamera = true;
  model.add(camera);

  return {
    model,
    head,
    hip,
    camera,
    bones: {
      HEAD: {
        obj: head,
        basePos: { x: 0, y: 0, z: 0 },
        baseQuat: head.quaternion.clone(),
        baseEuler: { x: 0, y: 0, z: 0, order: head.rotation.order },
      },
    },
  };
}

describe('bakedClipPartitioning', () => {
  it('partitions mixed baked tracks into face, body, and scene channels', () => {
    const { model, head, hip, camera, bones } = makeModel();
    const clip = new AnimationClip('Mixed', 1, [
      new NumberKeyframeTrack('FaceMesh.morphTargetInfluences[0]', [0, 1], [0, 1]),
      new QuaternionKeyframeTrack(`${head.uuid}.quaternion`, [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]),
      new NumberKeyframeTrack(`${hip.uuid}.position[x]`, [0, 1], [0, 1]),
      new NumberKeyframeTrack(`${camera.uuid}.position[x]`, [0, 1], [0, 1]),
    ]);

    const partitioned = partitionBakedClip(clip, model, bones);

    expect(partitioned.channels).toEqual([
      { channel: 'face', trackCount: 2, playable: true, blendMode: 'additive' },
      { channel: 'body', trackCount: 1, playable: true, blendMode: 'replace' },
      { channel: 'scene', trackCount: 1, playable: false, blendMode: undefined },
    ]);
    expect(partitioned.runtimeClips.map((entry) => entry.channel)).toEqual(['face', 'body']);
    expect(partitioned.runtimeClips[0]?.clip.tracks.map((track) => track.name)).toEqual([
      'FaceMesh.morphTargetInfluences[0]',
      `${head.uuid}.quaternion`,
    ]);
    expect(partitioned.runtimeClips[1]?.clip.tracks.map((track) => track.name)).toEqual([
      `${hip.uuid}.position[x]`,
    ]);
  });

  it('keeps aggregate additive mode only when a face channel exists', () => {
    expect(resolveBakedChannelBlendMode('face', 'additive')).toBe('additive');
    expect(resolveBakedChannelBlendMode('body', 'additive')).toBe('replace');
    expect(resolveBakedAggregateBlendMode([
      { channel: 'body', trackCount: 4, playable: true, blendMode: 'replace' },
    ], 'additive')).toBe('replace');
    expect(resolveBakedAggregateBlendMode([
      { channel: 'face', trackCount: 2, playable: true, blendMode: 'additive' },
      { channel: 'body', trackCount: 4, playable: true, blendMode: 'replace' },
    ], 'additive')).toBe('additive');
  });
});
