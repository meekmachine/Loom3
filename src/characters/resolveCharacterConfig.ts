import { resolvePresetWithOverrides } from '../presets';
import type { CharacterConfig, Region } from './types';

function cloneVector3(
  value?: { x?: number; y?: number; z?: number }
): { x?: number; y?: number; z?: number } | undefined {
  return value ? { ...value } : undefined;
}

function cloneRegion(region: Region): Region {
  return {
    ...region,
    bones: region.bones ? [...region.bones] : undefined,
    meshes: region.meshes ? [...region.meshes] : undefined,
    objects: region.objects ? [...region.objects] : undefined,
    children: region.children ? [...region.children] : undefined,
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

function mergeStringRecord(
  base?: Record<string, string>,
  override?: Record<string, string>
): Record<string, string> | undefined {
  if (!base && !override) return undefined;
  return {
    ...(base ? { ...base } : {}),
    ...(override ? { ...override } : {}),
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

function orderResolvedRegions(
  resolvedRegions: Region[] | undefined,
  prioritizedLists: Array<Region[] | undefined>
): Region[] | undefined {
  if (!resolvedRegions) return undefined;

  const resolvedByName = new Map(resolvedRegions.map((region) => [region.name, region]));
  const orderedNames: string[] = [];
  const seen = new Set<string>();

  for (const regions of prioritizedLists) {
    for (const region of regions ?? []) {
      if (seen.has(region.name)) continue;
      seen.add(region.name);
      orderedNames.push(region.name);
    }
  }

  for (const region of resolvedRegions) {
    if (seen.has(region.name)) continue;
    seen.add(region.name);
    orderedNames.push(region.name);
  }

  return orderedNames
    .map((name) => resolvedByName.get(name))
    .filter((region): region is Region => Boolean(region));
}

/**
 * Resolve a saved character config into the runtime shape DPthree and similar
 * tools should consume.
 *
 * Precedence:
 * 1. preset defaults
 * 2. `config.profile` overrides
 * 3. top-level saved `config.regions` overrides by region name
 * 4. top-level saved bone naming fields remain compatibility overrides
 */
export function resolveCharacterConfig(config: CharacterConfig): CharacterConfig {
  const presetType = config.auPresetType;
  if (!presetType || presetType === 'custom') {
    return config;
  }

  const profileAnnotationRegions = config.profile?.annotationRegions as Region[] | undefined;
  const presetResolvedProfile = resolvePresetWithOverrides(presetType, {
    ...(config.profile ?? {}),
    annotationRegions: profileAnnotationRegions,
  });
  const presetRegions = presetResolvedProfile.annotationRegions as Region[] | undefined;
  const mergedRegions = mergeRegionsByName(presetRegions, config.regions);
  const resolvedRegions = orderResolvedRegions(
    mergedRegions,
    [config.regions, profileAnnotationRegions, presetRegions]
  );

  return {
    ...config,
    bonePrefix: config.bonePrefix ?? presetResolvedProfile.bonePrefix,
    boneSuffix: config.boneSuffix ?? presetResolvedProfile.boneSuffix,
    boneNodes: mergeStringRecord(presetResolvedProfile.boneNodes, config.boneNodes),
    suffixPattern: config.suffixPattern ?? presetResolvedProfile.suffixPattern,
    regions: resolvedRegions ?? config.regions,
  };
}
