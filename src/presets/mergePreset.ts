import type { AUMappingConfig, AnnotationRegion, MorphTargetsBySide } from '../mappings/types';
import type { BoneBinding } from '../core/types';

type RecordValue = string | number | boolean | object | null | undefined;
type RecordKey = string | number;

const cloneArray = <T>(value: T[]): T[] => value.map((item) => {
  if (item && typeof item === 'object') {
    return { ...(item as Record<string, unknown>) } as T;
  }
  return item;
});

const cloneValue = <T extends RecordValue>(value: T): T => {
  if (Array.isArray(value)) {
    return cloneArray(value as unknown[]) as T;
  }
  if (value && typeof value === 'object') {
    return { ...(value as Record<string, unknown>) } as T;
  }
  return value;
};

const mergeRecord = <T extends RecordValue>(
  base: Record<RecordKey, T>,
  override?: Record<RecordKey, T>
): Record<RecordKey, T> => {
  if (!override) {
    const next: Record<string, T> = {};
    for (const [key, value] of Object.entries(base)) {
      next[key] = cloneValue(value as T);
    }
    return next;
  }
  const next: Record<string, T> = {};
  for (const [key, value] of Object.entries(base)) {
    next[key] = cloneValue(value as T);
  }
  for (const [key, value] of Object.entries(override)) {
    next[key] = cloneValue(value as T);
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

/**
 * Merge a base preset with a profile override.
 *
 * Rules:
 * - Scalars: override if provided.
 * - Maps: shallow-merged by key (override wins), values cloned.
 * - Arrays: replaced when override is provided (except annotationRegions).
 * - annotationRegions: merged by region name, shallow field merge (override wins).
 */
export function mergePreset(base: AUMappingConfig, override: Partial<AUMappingConfig>): AUMappingConfig {
  return {
    ...base,
    ...override,
    auToMorphs: mergeRecord(base.auToMorphs, override.auToMorphs) as Record<number, MorphTargetsBySide>,
    auToBones: mergeRecord(base.auToBones, override.auToBones) as Record<number, BoneBinding[]>,
    boneNodes: mergeRecord(base.boneNodes, override.boneNodes),
    morphToMesh: mergeRecord(base.morphToMesh, override.morphToMesh),
    visemeKeys: override.visemeKeys ? [...override.visemeKeys] : [...base.visemeKeys],
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
  };
}
