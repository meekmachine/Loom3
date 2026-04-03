import type { Profile, AnnotationRegion, HairPhysicsProfileConfig } from './types';

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

const mergeAnnotationRegion = (
  base: AnnotationRegion,
  override: AnnotationRegion
): AnnotationRegion => {
  const merged: AnnotationRegion = {
    ...base,
    ...override,
  };

  merged.bones = override.bones ? [...override.bones] : base.bones ? [...base.bones] : undefined;
  merged.meshes = override.meshes ? [...override.meshes] : base.meshes ? [...base.meshes] : undefined;
  merged.objects = override.objects ? [...override.objects] : base.objects ? [...base.objects] : undefined;
  merged.children = override.children ? [...override.children] : base.children ? [...base.children] : undefined;
  merged.cameraOffset = override.cameraOffset
    ? { ...override.cameraOffset }
    : base.cameraOffset
      ? { ...base.cameraOffset }
      : undefined;
  merged.style = override.style
    ? {
        ...base.style,
        ...override.style,
        line: override.style.line
          ? { ...base.style?.line, ...override.style.line }
          : base.style?.line
            ? { ...base.style.line }
            : undefined,
      }
    : base.style
      ? { ...base.style, line: base.style.line ? { ...base.style.line } : undefined }
      : undefined;

  return merged;
};

const mergeAnnotationRegions = (
  base?: AnnotationRegion[],
  override?: AnnotationRegion[]
): AnnotationRegion[] | undefined => {
  if (!base && !override) return undefined;
  if (!base) return override ? override.map((region) => mergeAnnotationRegion(region, region)) : undefined;
  const regionMap = new Map<string, AnnotationRegion>();
  for (const region of base) {
    regionMap.set(region.name, mergeAnnotationRegion(region, region));
  }
  if (override) {
    for (const region of override) {
      const existing = regionMap.get(region.name);
      regionMap.set(region.name, existing ? mergeAnnotationRegion(existing, region) : mergeAnnotationRegion(region, region));
    }
  }
  return Array.from(regionMap.values());
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
 * Merge a base preset with a profile override.
 *
 * Rules:
 * - Scalars: override if provided.
 * - Maps: shallow-merged by key (override wins), values cloned.
 * - Arrays: replaced when override is provided (except annotationRegions).
 * - annotationRegions: merged by region name, shallow field merge (override wins).
 */
export function resolveProfile(base: Profile, override: Partial<Profile>): Profile {
  return {
    ...base,
    ...override,
    auToMorphs: mergeRecord(base.auToMorphs, override.auToMorphs),
    auToBones: mergeRecord(base.auToBones, override.auToBones),
    boneNodes: mergeRecord(base.boneNodes, override.boneNodes),
    morphToMesh: mergeRecord(base.morphToMesh, override.morphToMesh),
    auFacePartToMeshCategory: base.auFacePartToMeshCategory || override.auFacePartToMeshCategory
      ? mergeRecord(base.auFacePartToMeshCategory || {}, override.auFacePartToMeshCategory || {})
      : undefined,
    visemeKeys: override.visemeKeys ? [...override.visemeKeys] : [...base.visemeKeys],
    visemeMeshCategory: override.visemeMeshCategory ?? base.visemeMeshCategory,
    auMixDefaults: base.auMixDefaults || override.auMixDefaults
      ? mergeRecord(base.auMixDefaults || {}, override.auMixDefaults || {})
      : undefined,
    auInfo: base.auInfo || override.auInfo
      ? mergeRecord(base.auInfo || {}, override.auInfo || {})
      : undefined,
    eyeMeshNodes: override.eyeMeshNodes ?? base.eyeMeshNodes,
    compositeRotations: override.compositeRotations ?? base.compositeRotations,
    meshes: base.meshes || override.meshes
      ? mergeRecord(base.meshes || {}, override.meshes || {})
      : undefined,
    continuumPairs: base.continuumPairs || override.continuumPairs
      ? mergeRecord(base.continuumPairs || {}, override.continuumPairs || {})
      : undefined,
    continuumLabels: base.continuumLabels || override.continuumLabels
      ? mergeRecord(base.continuumLabels || {}, override.continuumLabels || {})
      : undefined,
    annotationRegions: mergeAnnotationRegions(base.annotationRegions, override.annotationRegions),
    hairPhysics: mergeHairPhysicsConfig(base.hairPhysics, override.hairPhysics),
  };
}

/**
 * Explicit helper for the common operation: start with a preset, then apply a
 * profile override on top. This is the preferred name at call sites where the
 * distinction between preset and profile should stay obvious.
 */
export function applyProfileToPreset(base: Profile, override?: Partial<Profile>): Profile {
  return override ? resolveProfile(base, override) : base;
}
