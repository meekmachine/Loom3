import type { Profile } from '../mappings/types';
import { extendPresetWithProfile } from '../mappings/extendPresetWithProfile';
import { getPreset } from '../presets';
import { resolveCharacterProfileOverrides } from '../presets/characterOverrides';
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

function cloneArray<T>(value: T[] | undefined): T[] | undefined {
  return value ? value.map((entry) => cloneValue(entry) as T) : undefined;
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

function cloneVector3(
  value?: { x?: number; y?: number; z?: number }
): { x?: number; y?: number; z?: number } | undefined {
  return value ? { ...value } : undefined;
}

function cloneRegion(region: Region): Region {
  return {
    ...region,
    bones: cloneArray(region.bones),
    meshes: cloneArray(region.meshes),
    objects: cloneArray(region.objects),
    children: cloneArray(region.children),
    cameraOffset: cloneVector3(region.cameraOffset),
    customPosition: region.customPosition ? { ...region.customPosition } : undefined,
    style: region.style
      ? {
          ...region.style,
          line: region.style.line ? { ...region.style.line } : undefined,
        }
      : undefined,
  };
}

function mergeRegion(base: Region, override: Region): Region {
  return {
    ...base,
    ...override,
    bones: override.bones !== undefined ? [...override.bones] : base.bones ? [...base.bones] : undefined,
    meshes: override.meshes !== undefined ? [...override.meshes] : base.meshes ? [...base.meshes] : undefined,
    objects: override.objects !== undefined ? [...override.objects] : base.objects ? [...base.objects] : undefined,
    children: override.children !== undefined ? [...override.children] : base.children ? [...base.children] : undefined,
    cameraOffset: override.cameraOffset
      ? { ...base.cameraOffset, ...override.cameraOffset }
      : cloneVector3(base.cameraOffset),
    customPosition: override.customPosition
      ? { ...override.customPosition }
      : base.customPosition
        ? { ...base.customPosition }
        : undefined,
    style: override.style
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
        ? {
            ...base.style,
            line: base.style.line ? { ...base.style.line } : undefined,
          }
        : undefined,
  };
}

export function mergeRegionsByName(base?: Region[], override?: Region[]): Region[] | undefined {
  if (!base && !override) return undefined;

  const merged = new Map<string, Region>();

  for (const region of base ?? []) {
    merged.set(region.name, cloneRegion(region));
  }

  for (const region of override ?? []) {
    const existing = merged.get(region.name);
    merged.set(region.name, existing ? mergeRegion(existing, region) : cloneRegion(region));
  }

  return Array.from(merged.values());
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
        overrides.annotationRegions = regions.map((region) => cloneRegion(region));
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

  const presetWithCharacterDefaults = extendPresetWithProfile(
    getPreset(presetType),
    resolveCharacterProfileOverrides(config.characterId)
  );

  return extendPresetWithProfile(presetWithCharacterDefaults, extractProfileOverrides(config));
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
 * 2. Loom3 character-specific preset overrides
 * 3. flattened top-level profile overrides
 * 4. legacy nested `config.profile` overrides (compatibility only)
 * 5. top-level saved `config.regions` overrides by region name
 * 6. top-level saved bone naming fields remain compatibility overrides
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
