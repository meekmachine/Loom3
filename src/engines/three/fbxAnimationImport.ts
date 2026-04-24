import {
  AnimationClip,
  Bone,
  Object3D,
  Skeleton,
  Vector3,
} from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { clone, retargetClip } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { FBXAnimationImportOptions, FBXAnimationInput } from '../../core/types';

const FBX_LOADER = new FBXLoader();
const MIXAMO_PREFIX_PATTERN = /^mixamorig[:_]?/i;
const CC4_PREFIX_PATTERN = /^CC_Base_/i;
const TRAILING_EXPORT_SUFFIX_PATTERN = /(?:[_\.]\d+)+$/;

const CC4_TO_MIXAMO_BONE_CANDIDATES = new Map<string, string[]>([
  ['hip', ['Hips']],
  ['waist', ['Spine']],
  ['spine01', ['Spine1']],
  ['spine02', ['Spine2']],
  ['necktwist01', ['Neck']],
  ['head', ['Head']],
  ['jawroot', ['Jaw']],
  ['leye', ['LeftEye']],
  ['reye', ['RightEye']],
  ['lclavicle', ['LeftShoulder']],
  ['rclavicle', ['RightShoulder']],
  ['lupperarm', ['LeftArm']],
  ['rupperarm', ['RightArm']],
  ['lforearm', ['LeftForeArm']],
  ['rforearm', ['RightForeArm']],
  ['lhand', ['LeftHand']],
  ['rhand', ['RightHand']],
  ['lthigh', ['LeftUpLeg']],
  ['rthigh', ['RightUpLeg']],
  ['lcalf', ['LeftLeg']],
  ['rcalf', ['RightLeg']],
  ['lfoot', ['LeftFoot']],
  ['rfoot', ['RightFoot']],
  ['ltoebase', ['LeftToeBase']],
  ['rtoebase', ['RightToeBase']],
]);

const CC4_DIGIT_TO_MIXAMO_DIGIT: Record<string, string> = {
  thumb: 'Thumb',
  index: 'Index',
  middle: 'Middle',
  mid: 'Middle',
  ring: 'Ring',
  pinky: 'Pinky',
};

type SkeletonBinding = {
  root: Object3D & { skeleton: Skeleton };
  bones: Bone[];
  bonesByName: Map<string, Bone | null>;
};

export type RetargetedFbxClipsResult = {
  clips: AnimationClip[];
  matchedBoneCount: number;
  sourceClipCount: number;
};

function canonicalizeBoneName(name: string): string {
  return name
    .trim()
    .replace(/^.*:/, '')
    .replace(MIXAMO_PREFIX_PATTERN, '')
    .replace(CC4_PREFIX_PATTERN, '')
    .replace(TRAILING_EXPORT_SUFFIX_PATTERN, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function stripCc4Decorators(name: string): string {
  return name
    .trim()
    .replace(/^.*:/, '')
    .replace(TRAILING_EXPORT_SUFFIX_PATTERN, '')
    .replace(CC4_PREFIX_PATTERN, '');
}

function buildUniqueCanonicalIndex(names: Iterable<string>): Map<string, string | null> {
  const index = new Map<string, string | null>();

  for (const name of names) {
    const key = canonicalizeBoneName(name);
    if (!key) continue;

    const existing = index.get(key);
    if (existing === undefined) {
      index.set(key, name);
      continue;
    }

    if (existing !== name) {
      index.set(key, null);
    }
  }

  return index;
}

function buildUniqueBoneIndex(root: Object3D): Map<string, Bone | null> {
  const index = new Map<string, Bone | null>();

  root.traverse((obj) => {
    if (!(obj instanceof Bone) || !obj.name) return;

    const existing = index.get(obj.name);
    if (existing === undefined) {
      index.set(obj.name, obj);
      return;
    }

    if (existing !== obj) {
      index.set(obj.name, null);
    }
  });

  return index;
}

function collectBones(root: Object3D): Bone[] {
  const bones: Bone[] = [];
  root.traverse((obj) => {
    if (obj instanceof Bone) {
      bones.push(obj);
    }
  });
  return bones;
}

function findTopmostBone(bones: Bone[]): Bone | null {
  let fallback: Bone | null = bones[0] ?? null;

  for (const bone of bones) {
    let current: Object3D | null = bone.parent;
    let hasBoneAncestor = false;
    while (current) {
      if (current instanceof Bone) {
        hasBoneAncestor = true;
        break;
      }
      current = current.parent;
    }

    if (!hasBoneAncestor) {
      return bone;
    }

    fallback ??= bone;
  }

  return fallback;
}

function createSkeletonBinding(root: Object3D): SkeletonBinding {
  let skeletonFromSkin: Skeleton | null = null;

  root.traverse((obj: any) => {
    if (skeletonFromSkin || !obj?.isSkinnedMesh || !obj.skeleton?.bones?.length) return;
    skeletonFromSkin = obj.skeleton;
  });

  const existingSkeleton = skeletonFromSkin;
  if (existingSkeleton) {
    const boundRoot = root as Object3D & { skeleton: Skeleton };
    const resolvedSkeleton = existingSkeleton as Skeleton;
    boundRoot.skeleton = resolvedSkeleton;
    return {
      root: boundRoot,
      bones: resolvedSkeleton.bones.slice(),
      bonesByName: buildUniqueBoneIndex(root),
    };
  }

  const bones = collectBones(root);
  if (!bones.length) {
    throw new Error('FBX import requires a skeleton with at least one bone');
  }

  const rootBone = findTopmostBone(bones);
  if (!rootBone) {
    throw new Error('FBX import could not determine the skeleton root bone');
  }

  const boundRoot = root as Object3D & { skeleton: Skeleton };
  boundRoot.skeleton = new Skeleton(bones);

  return {
    root: boundRoot,
    bones,
    bonesByName: buildUniqueBoneIndex(root),
  };
}

function resolveSourceBoneNameCandidate(
  sourceBonesByCanonical: Map<string, string | null>,
  candidate: string | null | undefined
): string | null {
  if (!candidate) return null;
  const key = canonicalizeBoneName(candidate);
  const resolved = sourceBonesByCanonical.get(key);
  return typeof resolved === 'string' ? resolved : null;
}

function getDefaultSourceBoneCandidates(targetBoneName: string): string[] {
  const candidates = new Set<string>();
  const stripped = stripCc4Decorators(targetBoneName);
  const directCandidate = stripped || targetBoneName;
  const canonicalTarget = canonicalizeBoneName(directCandidate);

  if (directCandidate) {
    candidates.add(directCandidate);
  }

  const mapped = CC4_TO_MIXAMO_BONE_CANDIDATES.get(canonicalTarget);
  mapped?.forEach((candidate) => candidates.add(candidate));

  const fingerMatch = stripped.match(/^(L|R)_(Thumb|Index|Middle|Mid|Ring|Pinky)(\d+)$/i);
  if (fingerMatch) {
    const [, side, digit, segment] = fingerMatch;
    const mixamoDigit = CC4_DIGIT_TO_MIXAMO_DIGIT[digit.toLowerCase()];
    const mixamoSide = side.toUpperCase() === 'L' ? 'Left' : 'Right';
    if (mixamoDigit) {
      candidates.add(`${mixamoSide}Hand${mixamoDigit}${segment}`);
    }
  }

  return Array.from(candidates);
}

function buildSourceBoneNameResolver(
  sourceBonesByCanonical: Map<string, string | null>,
  options: FBXAnimationImportOptions | undefined
): (targetBoneName: string) => string | null {
  return (targetBoneName: string) => {
    const customResolved = resolveSourceBoneNameCandidate(
      sourceBonesByCanonical,
      options?.resolveSourceBoneName?.(targetBoneName) ?? null
    );
    if (customResolved) {
      return customResolved;
    }

    for (const candidate of getDefaultSourceBoneCandidates(targetBoneName)) {
      const resolved = resolveSourceBoneNameCandidate(sourceBonesByCanonical, candidate);
      if (resolved) {
        return resolved;
      }
    }

    return null;
  };
}

function normalizeClipName(clip: AnimationClip, options: FBXAnimationImportOptions | undefined, index: number, total: number): string {
  const baseName = options?.clipName?.trim() || clip.name.trim() || 'Imported Animation';
  if (total <= 1) {
    return baseName;
  }
  return `${baseName} ${index + 1}`;
}

function splitTrackName(trackName: string): { targetName: string; propertyPath: string } {
  const dotIndex = trackName.indexOf('.');
  if (dotIndex < 0) {
    return { targetName: trackName, propertyPath: '' };
  }

  return {
    targetName: trackName.slice(0, dotIndex),
    propertyPath: trackName.slice(dotIndex),
  };
}

function makeSafeBindingName(name: string, usedNames: Set<string>): string {
  const baseName = name
    .trim()
    .replace(/[^A-Za-z0-9_]/g, '_')
    .replace(/^_+|_+$/g, '') || 'Bone';

  if (!usedNames.has(baseName)) {
    usedNames.add(baseName);
    return baseName;
  }

  let suffix = 2;
  let candidate = `${baseName}_${suffix}`;
  while (usedNames.has(candidate)) {
    suffix += 1;
    candidate = `${baseName}_${suffix}`;
  }

  usedNames.add(candidate);
  return candidate;
}

function normalizeSourceSceneForRetarget(sourceScene: Object3D & { animations?: AnimationClip[] }): void {
  const usedBoneNames = new Set<string>();
  const renamedBones = new Map<string, string>();

  sourceScene.traverse((obj) => {
    if (!(obj instanceof Bone) || !obj.name) return;
    const safeName = makeSafeBindingName(obj.name, usedBoneNames);
    renamedBones.set(obj.name, safeName);
    obj.name = safeName;
  });

  sourceScene.animations = (sourceScene.animations ?? []).map((clip) => {
    const renamedTracks = clip.tracks.flatMap((track) => {
      const { targetName, propertyPath } = splitTrackName(track.name);
      const safeTargetName = renamedBones.get(targetName);
      if (!safeTargetName || !propertyPath) {
        return [];
      }

      const clonedTrack = track.clone();
      clonedTrack.name = `${safeTargetName}${propertyPath}`;
      return [clonedTrack];
    });

    return new AnimationClip(clip.name, clip.duration, renamedTracks);
  });
}

function sliceArrayBuffer(view: ArrayBufferView): ArrayBuffer {
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
}

async function readInputBuffer(source: FBXAnimationInput): Promise<ArrayBuffer> {
  if (source instanceof ArrayBuffer) {
    return source.slice(0);
  }

  if (ArrayBuffer.isView(source)) {
    return sliceArrayBuffer(source);
  }

  if (source instanceof Blob) {
    return source.arrayBuffer();
  }

  throw new Error('Unsupported FBX animation input type');
}

function findHipBoneMapping(
  targetBones: Bone[],
  resolveSourceBoneName: (targetBoneName: string) => string | null
): { targetBoneName: string | null; sourceBoneName: string | null } {
  for (const bone of targetBones) {
    const sourceBoneName = resolveSourceBoneName(bone.name);
    if (!sourceBoneName) continue;

    if (canonicalizeBoneName(bone.name) === 'hip' || canonicalizeBoneName(sourceBoneName) === 'hips') {
      return {
        targetBoneName: bone.name,
        sourceBoneName,
      };
    }
  }

  return {
    targetBoneName: null,
    sourceBoneName: null,
  };
}

function renameTrackToTargetBoneUuid(
  trackName: string,
  targetBonesByName: Map<string, Bone | null>
): { boneName: string; renamedTrackName: string } | null {
  const match = trackName.match(/^\.bones\[(.+?)\](\..+)$/);
  if (!match) return null;

  const [, boneName, propertyPath] = match;
  const targetBone = targetBonesByName.get(boneName);
  if (!targetBone) return null;

  return {
    boneName,
    renamedTrackName: `${targetBone.uuid}${propertyPath}`,
  };
}

function normalizeRetargetedClip(
  clip: AnimationClip,
  targetBonesByName: Map<string, Bone | null>,
  hipBoneName: string | null,
  inPlace: boolean
): AnimationClip {
  const normalizedTracks = clip.tracks.flatMap((track) => {
    const renamed = renameTrackToTargetBoneUuid(track.name, targetBonesByName);
    if (!renamed) return [];

    if (inPlace && hipBoneName && renamed.boneName === hipBoneName && renamed.renamedTrackName.endsWith('.position')) {
      return [];
    }

    const clonedTrack = track.clone();
    clonedTrack.name = renamed.renamedTrackName;
    return [clonedTrack];
  });

  const normalizedClip = new AnimationClip(clip.name, clip.duration, normalizedTracks);
  normalizedClip.resetDuration();
  return normalizedClip;
}

export async function retargetFbxAnimationClips(
  model: Object3D,
  source: FBXAnimationInput,
  options: FBXAnimationImportOptions = {}
): Promise<RetargetedFbxClipsResult> {
  const modelClone = clone(model);
  const sourceBuffer = await readInputBuffer(source);
  const sourceScene = FBX_LOADER.parse(sourceBuffer, '');
  normalizeSourceSceneForRetarget(sourceScene as Object3D & { animations?: AnimationClip[] });

  if (!sourceScene.animations?.length) {
    throw new Error('FBX import did not find any animation clips');
  }

  modelClone.updateMatrixWorld(true);
  sourceScene.updateMatrixWorld(true);

  const targetBinding = createSkeletonBinding(modelClone);
  const sourceBinding = createSkeletonBinding(sourceScene);
  const sourceBonesByCanonical = buildUniqueCanonicalIndex(sourceBinding.bones.map((bone) => bone.name));
  const resolveSourceBoneName = buildSourceBoneNameResolver(sourceBonesByCanonical, options);
  const matchedBoneCount = targetBinding.bones.reduce((count, bone) => {
    return resolveSourceBoneName(bone.name) ? count + 1 : count;
  }, 0);

  if (matchedBoneCount === 0) {
    throw new Error('FBX import could not match any source bones to the current rig');
  }

  const actualTargetBonesByName = buildUniqueBoneIndex(model);
  const hipBone = findHipBoneMapping(targetBinding.bones, resolveSourceBoneName);
  const importedClips = sourceScene.animations.map((sourceClip, index, clips) => {
    const retargeted = retargetClip(targetBinding.root, sourceBinding.root, sourceClip, {
      fps: options.fps,
      useFirstFramePosition: options.useFirstFramePosition ?? false,
      hip: hipBone.sourceBoneName ?? 'Hips',
      hipInfluence: options.inPlace === false ? new Vector3(1, 1, 1) : new Vector3(0, 0, 0),
      hipPosition: options.inPlace === false ? undefined : new Vector3(),
      getBoneName: (bone: Bone) => resolveSourceBoneName(bone.name) ?? bone.name,
    });
    retargeted.name = normalizeClipName(sourceClip, options, index, clips.length);
    return normalizeRetargetedClip(retargeted, actualTargetBonesByName, hipBone.targetBoneName, options.inPlace !== false);
  }).filter((clip) => clip.tracks.length > 0);

  if (!importedClips.length) {
    throw new Error('FBX import produced no compatible animation tracks for the current rig');
  }

  return {
    clips: importedClips,
    matchedBoneCount,
    sourceClipCount: sourceScene.animations.length,
  };
}
