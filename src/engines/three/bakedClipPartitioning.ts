import {
  AnimationClip,
  KeyframeTrack,
  Object3D,
  PropertyBinding,
} from 'three';
import type {
  AnimationBlendMode,
  BakedClipChannel,
  BakedClipChannelInfo,
} from '../../core/types';
import type { ResolvedBones } from './types';

const RUNTIME_CLIP_PREFIX = '__loom3_baked_partition__/';
const FACE_SAFE_TARGET_RE = /(head|neck|jaw|eye|brow|lid|mouth|lip|face|cheek|nose|tongue|teeth)/i;
const BODY_LIKE_TARGET_RE = /(root|armature|hips?|pelvis|spine|waist|chest|torso|shoulder|arm|forearm|hand|finger|leg|thigh|calf|knee|foot|toe|tail|wing|fin|body|abdomen|clavicle)/i;
const SCENE_LIKE_TARGET_RE = /(camera|cam|scene|world|global|origin|pivot|cube)/i;
const CHANNEL_ORDER: BakedClipChannel[] = ['face', 'body', 'scene'];

export interface PartitionedBakedRuntimeClip {
  channel: BakedClipChannel;
  clip: AnimationClip;
}

export interface PartitionedBakedClip {
  sourceClip: AnimationClip;
  channels: BakedClipChannelInfo[];
  runtimeClips: PartitionedBakedRuntimeClip[];
}

type ParsedTrackTarget = {
  propertyName: string;
  target: Object3D | null;
  targetName: string;
};

function getRuntimeClipName(sourceClipName: string, channel: BakedClipChannel): string {
  return `${RUNTIME_CLIP_PREFIX}${sourceClipName}/${channel}`;
}

function parseTrackTarget(trackName: string, model: Object3D): ParsedTrackTarget | null {
  let parsed: ReturnType<typeof PropertyBinding.parseTrackName>;

  try {
    parsed = PropertyBinding.parseTrackName(trackName);
  } catch {
    return null;
  }

  const targetKey = parsed.objectName === 'bones' && parsed.objectIndex
    ? String(parsed.objectIndex)
    : parsed.nodeName;
  const target = targetKey
    ? model.getObjectByProperty('uuid', targetKey) ?? PropertyBinding.findNode(model, targetKey)
    : null;

  return {
    propertyName: parsed.propertyName,
    target,
    targetName: target?.name ?? parsed.nodeName ?? '',
  };
}

function isSceneTrackTarget(target: Object3D | null, targetName: string): boolean {
  if (!target) return true;
  if ((target as { isCamera?: boolean }).isCamera) return true;
  return SCENE_LIKE_TARGET_RE.test(targetName);
}

function isFaceSafeTransformTarget(
  target: Object3D | null,
  targetName: string,
  safeTransformTargets: Set<Object3D>
): boolean {
  if (target && safeTransformTargets.has(target)) {
    return true;
  }
  if (!targetName) {
    return false;
  }
  if (BODY_LIKE_TARGET_RE.test(targetName) || SCENE_LIKE_TARGET_RE.test(targetName)) {
    return false;
  }
  return FACE_SAFE_TARGET_RE.test(targetName);
}

export function classifyBakedTrack(
  track: KeyframeTrack,
  model: Object3D,
  bones: ResolvedBones
): BakedClipChannel {
  const parsed = parseTrackTarget(track.name, model);
  if (!parsed) {
    return 'scene';
  }

  if (parsed.propertyName === 'morphTargetInfluences' || parsed.propertyName === 'weights') {
    return 'face';
  }

  if (isSceneTrackTarget(parsed.target, parsed.targetName)) {
    return 'scene';
  }

  if (parsed.propertyName === 'quaternion') {
    const safeTransformTargets = new Set(
      Object.values(bones)
        .map((entry) => entry?.obj)
        .filter((entry): entry is Object3D => !!entry)
    );

    if (isFaceSafeTransformTarget(parsed.target, parsed.targetName, safeTransformTargets)) {
      return 'face';
    }
  }

  return 'body';
}

export function resolveBakedChannelBlendMode(
  channel: BakedClipChannel,
  requestedBlendMode: AnimationBlendMode
): AnimationBlendMode | undefined {
  if (channel === 'face') {
    return requestedBlendMode === 'additive' ? 'additive' : 'replace';
  }
  if (channel === 'body') {
    return 'replace';
  }
  return undefined;
}

export function resolveBakedAggregateBlendMode(
  channels: BakedClipChannelInfo[],
  requestedBlendMode: AnimationBlendMode
): AnimationBlendMode {
  if (requestedBlendMode !== 'additive') {
    return 'replace';
  }

  return channels.some((channel) => (
    channel.channel === 'face'
    && channel.playable
    && channel.trackCount > 0
  ))
    ? 'additive'
    : 'replace';
}

export function partitionBakedClip(
  clip: AnimationClip,
  model: Object3D,
  bones: ResolvedBones
): PartitionedBakedClip {
  const tracksByChannel = new Map<BakedClipChannel, KeyframeTrack[]>(
    CHANNEL_ORDER.map((channel) => [channel, []])
  );

  for (const track of clip.tracks) {
    const channel = classifyBakedTrack(track, model, bones);
    tracksByChannel.get(channel)?.push(track.clone());
  }

  const runtimeClips: PartitionedBakedRuntimeClip[] = [];
  const channels: BakedClipChannelInfo[] = [];

  for (const channel of CHANNEL_ORDER) {
    const tracks = tracksByChannel.get(channel) ?? [];
    if (tracks.length === 0) {
      continue;
    }

    const playable = channel !== 'scene';
    const blendMode = resolveBakedChannelBlendMode(channel, 'additive');
    channels.push({
      channel,
      trackCount: tracks.length,
      playable,
      blendMode,
    });

    if (!playable) {
      continue;
    }

    runtimeClips.push({
      channel,
      clip: new AnimationClip(getRuntimeClipName(clip.name, channel), clip.duration, tracks),
    });
  }

  return {
    sourceClip: clip,
    channels,
    runtimeClips,
  };
}
