import type { Profile, AnnotationRegion, HairPhysicsProfileConfig } from './types';
import { mergeAnnotationRegionsByName } from '../regions/annotationRegions';

type RecordValue = string | number | boolean | object | null | undefined;
type RecordKey = string | number;

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const cloneValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item));
  }
  if (isPlainObject(value)) {
    return { ...value };
  }
  return value;
};

const mergeRecord = <K extends RecordKey, T extends RecordValue>(
  base: Record<K, T>,
  override?: Partial<Record<K, T>>
): Record<K, T> => {
  const next = {} as Record<K, T>;

  for (const [key, value] of Object.entries(base)) {
    next[key as K] = cloneValue(value) as T;
  }

  if (override) {
    for (const [key, value] of Object.entries(override)) {
      if (value !== undefined) {
        next[key as K] = cloneValue(value) as T;
      }
    }
  }

  return next;
};

const mergeHairPhysicsConfig = (
  base?: HairPhysicsProfileConfig,
  override?: HairPhysicsProfileConfig
): HairPhysicsProfileConfig | undefined => {
  if (!base && !override) return undefined;
  const merged: HairPhysicsProfileConfig = {
    ...base,
    ...override,
  };

  if (base?.direction || override?.direction) {
    merged.direction = {
      ...base?.direction,
      ...override?.direction,
    };
  }

  if (base?.morphTargets || override?.morphTargets) {
    const nextMorphTargets = {
      ...base?.morphTargets,
      ...override?.morphTargets,
    };
    if (base?.morphTargets?.headUp || override?.morphTargets?.headUp) {
      nextMorphTargets.headUp = mergeRecord(
        base?.morphTargets?.headUp || {},
        override?.morphTargets?.headUp || {}
      );
    }
    if (base?.morphTargets?.headDown || override?.morphTargets?.headDown) {
      nextMorphTargets.headDown = mergeRecord(
        base?.morphTargets?.headDown || {},
        override?.morphTargets?.headDown || {}
      );
    }
    merged.morphTargets = nextMorphTargets;
  }

  return merged;
};

/**
 * Extend a base preset with a profile extension.
 *
 * Rules:
 * - Scalars: extension wins when provided.
 * - Maps: shallow-merged by key, values cloned.
 * - Arrays: replaced when the extension provides them (except annotationRegions).
 * - annotationRegions: merged by region name, shallow field merge (extension wins).
 */
export function extendPresetWithProfile(base: Profile, extension?: Partial<Profile>): Profile {
  if (!extension) {
    return base;
  }

  const disabledRegions = extension.disabledRegions
    ? [...extension.disabledRegions]
    : base.disabledRegions
      ? [...base.disabledRegions]
      : undefined;

  return {
    ...base,
    ...extension,
    auToMorphs: mergeRecord(base.auToMorphs, extension.auToMorphs),
    auToBones: mergeRecord(base.auToBones, extension.auToBones),
    boneNodes: mergeRecord(base.boneNodes, extension.boneNodes),
    morphToMesh: mergeRecord(base.morphToMesh, extension.morphToMesh),
    auFacePartToMeshCategory: base.auFacePartToMeshCategory || extension.auFacePartToMeshCategory
      ? mergeRecord(base.auFacePartToMeshCategory || {}, extension.auFacePartToMeshCategory || {})
      : undefined,
    visemeKeys: extension.visemeKeys ? [...extension.visemeKeys] : [...base.visemeKeys],
    visemeMeshCategory: extension.visemeMeshCategory ?? base.visemeMeshCategory,
    auMixDefaults: base.auMixDefaults || extension.auMixDefaults
      ? mergeRecord(base.auMixDefaults || {}, extension.auMixDefaults || {})
      : undefined,
    auInfo: base.auInfo || extension.auInfo
      ? mergeRecord(base.auInfo || {}, extension.auInfo || {})
      : undefined,
    eyeMeshNodes: extension.eyeMeshNodes ?? base.eyeMeshNodes,
    compositeRotations: extension.compositeRotations ?? base.compositeRotations,
    meshes: base.meshes || extension.meshes
      ? mergeRecord(base.meshes || {}, extension.meshes || {})
      : undefined,
    continuumPairs: base.continuumPairs || extension.continuumPairs
      ? mergeRecord(base.continuumPairs || {}, extension.continuumPairs || {})
      : undefined,
    continuumLabels: base.continuumLabels || extension.continuumLabels
      ? mergeRecord(base.continuumLabels || {}, extension.continuumLabels || {})
      : undefined,
    annotationRegions: mergeAnnotationRegionsByName(base.annotationRegions, extension.annotationRegions),
    disabledRegions,
    hairPhysics: mergeHairPhysicsConfig(base.hairPhysics, extension.hairPhysics),
  };
}
