import type { Profile } from '../mappings/types';
import { extendPresetWithProfile } from '../mappings/extendPresetWithProfile';
import { getPreset } from '../presets';
import {
  cloneAnnotationRegion,
  mergeAnnotationRegionsByName,
} from '../regions/annotationRegions';
import { normalizeRegionTree } from '../regions/normalizeRegionTree';
import type { CharacterConfig, Region } from './types';

const PROFILE_OVERRIDE_KEYS = [
  'name',
  'animalType',
  'emoji',
  'auToMorphs',
  'auToBones',
  'boneNodes',
  'bonePrefix',
  'boneSuffix',
  'morphPrefix',
  'morphSuffix',
  'suffixPattern',
  'leftMorphSuffixes',
  'rightMorphSuffixes',
  'morphToMesh',
  'auFacePartToMeshCategory',
  'visemeKeys',
  'visemeMeshCategory',
  'visemeJawAmounts',
  'auMixDefaults',
  'auInfo',
  'eyeMeshNodes',
  'compositeRotations',
  'meshes',
  'continuumPairs',
  'continuumLabels',
  'annotationRegions',
  'disabledRegions',
  'hairPhysics',
] as const satisfies readonly (keyof Profile)[];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneValue(entry)) as T;
  }
  if (isPlainObject(value)) {
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      next[key] = cloneValue(entry);
    }
    return next as T;
  }
  return value;
}

function mergeProfileOverrideValue<T>(base: T | undefined, override: T | undefined): T | undefined {
  if (override === undefined) {
    return base === undefined ? undefined : cloneValue(base);
  }

  if (Array.isArray(override)) {
    return cloneValue(override);
  }

  if (isPlainObject(base) && isPlainObject(override)) {
    return {
      ...cloneValue(base),
      ...cloneValue(override),
    } as T;
  }

  return cloneValue(override);
}

export function mergeRegionsByName(base?: Region[], override?: Region[]): Region[] | undefined {
  return mergeAnnotationRegionsByName(base, override);
}

export function extractProfileOverrides(config: CharacterConfig): Partial<Profile> {
  const topLevelConfig = config as unknown as Record<string, unknown>;
  const legacyNestedOverrides = isPlainObject(config.profile)
    ? config.profile as Record<string, unknown>
    : {};
  const overrides: Partial<Profile> = {};

  for (const key of PROFILE_OVERRIDE_KEYS) {
    if (key === 'annotationRegions') {
      const topLevelAnnotationRegions = Array.isArray(topLevelConfig.annotationRegions)
        ? topLevelConfig.annotationRegions as Region[]
        : undefined;
      const legacyAnnotationRegions = Array.isArray(legacyNestedOverrides.annotationRegions)
        ? legacyNestedOverrides.annotationRegions as Region[]
        : undefined;
      const presetOverrideRegions = mergeRegionsByName(legacyAnnotationRegions, topLevelAnnotationRegions);
      const regions = mergeRegionsByName(
        presetOverrideRegions,
        Array.isArray(config.regions) && config.regions.length > 0 ? config.regions : undefined
      );

      if (regions) {
        overrides.annotationRegions = regions.map((region) => cloneAnnotationRegion(region));
      }
      continue;
    }

    const topLevelValue = topLevelConfig[key];
    const legacyValue = legacyNestedOverrides[key];
    const mergedValue = mergeProfileOverrideValue(legacyValue, topLevelValue);
    if (mergedValue !== undefined) {
      (overrides as Record<string, unknown>)[key] = mergedValue;
    }
  }

  return overrides;
}

export function applyCharacterProfileToPreset(config: CharacterConfig): Profile | null {
  const presetType = config.auPresetType;
  if (!presetType) {
    return null;
  }

  return extendPresetWithProfile(getPreset(presetType), extractProfileOverrides(config));
}

function orderExtendedRegions(
  extendedRegions: Region[] | undefined,
  prioritizedLists: Array<Region[] | undefined>
): Region[] | undefined {
  if (!extendedRegions) return undefined;

  const extendedByName = new Map(extendedRegions.map((region) => [region.name, region]));
  const orderedNames: string[] = [];
  const seen = new Set<string>();

  for (const regions of prioritizedLists) {
    for (const region of regions ?? []) {
      if (seen.has(region.name)) continue;
      seen.add(region.name);
      orderedNames.push(region.name);
    }
  }

  for (const region of extendedRegions) {
    if (seen.has(region.name)) continue;
    seen.add(region.name);
    orderedNames.push(region.name);
  }

  return orderedNames
    .map((name) => extendedByName.get(name))
    .filter((region): region is Region => Boolean(region));
}

/**
 * Extend a saved character config with its selected preset so callers get one
 * canonical runtime object.
 *
 * Precedence:
 * 1. preset defaults
 * 2. flattened top-level profile overrides
 * 3. legacy nested `config.profile` overrides (compatibility only)
 * 4. top-level saved `config.regions` overrides by region name
 */
export function extendCharacterConfigWithPreset(config: CharacterConfig): CharacterConfig {
  const presetType = config.auPresetType;
  if (!presetType || presetType === 'custom') {
    return config;
  }

  const profileOverrides = extractProfileOverrides(config);
  const extendedPresetProfile = applyCharacterProfileToPreset(config);
  if (!extendedPresetProfile) {
    return config;
  }
  const presetRegions = extendedPresetProfile.annotationRegions as Region[] | undefined;
  const mergedRegions = mergeRegionsByName(presetRegions, config.regions);
  const normalizedRegions = normalizeRegionTree(
    mergedRegions,
    profileOverrides.disabledRegions,
  );
  const extendedRegions = orderExtendedRegions(
    normalizedRegions,
    [config.regions, profileOverrides.annotationRegions as Region[] | undefined, presetRegions]
  );

  return {
    ...config,
    ...extendedPresetProfile,
    regions: extendedRegions ?? config.regions,
  };
}
