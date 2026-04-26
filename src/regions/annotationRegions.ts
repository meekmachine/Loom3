import type { AnnotationRegion } from '../mappings/types';

type AnnotationVector = { x?: number; y?: number; z?: number };
type AnnotationPoint = { x: number; y: number; z: number };

export type AnnotationValidationCode =
  | 'duplicate-region-name'
  | 'missing-parent'
  | 'missing-child'
  | 'inconsistent-parent-child'
  | 'cycle-detected'
  | 'unknown-disabled-region'
  | 'invalid-camera-offset'
  | 'invalid-custom-position'
  | 'invalid-line-direction'
  | 'fallback-without-group';

export interface AnnotationValidationIssue {
  code: AnnotationValidationCode;
  message: string;
  regionName?: string;
  relatedRegionName?: string;
}

function cloneStringArray(value?: string[]): string[] | undefined {
  return value ? [...value] : undefined;
}

function cloneVector3(value?: AnnotationVector): AnnotationVector | undefined {
  return value ? { ...value } : undefined;
}

function clonePoint3(value?: AnnotationPoint): AnnotationPoint | undefined {
  return value ? { ...value } : undefined;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isFiniteVector3(
  value: AnnotationVector | undefined,
  requiredKeys: ReadonlyArray<'x' | 'y' | 'z'>
): boolean {
  if (!value) return false;

  return requiredKeys.every((key) => isFiniteNumber(value[key]));
}

function getChildGraph(regions: AnnotationRegion[]): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();

  for (const region of regions) {
    if (!graph.has(region.name)) {
      graph.set(region.name, new Set());
    }
  }

  for (const region of regions) {
    const children = graph.get(region.name)!;

    for (const child of region.children ?? []) {
      children.add(child);
    }

    if (region.parent) {
      const parentChildren = graph.get(region.parent) ?? new Set<string>();
      parentChildren.add(region.name);
      graph.set(region.parent, parentChildren);
    }
  }

  return graph;
}

export function cloneAnnotationRegion<T extends AnnotationRegion>(region: T): T {
  return {
    ...region,
    bones: cloneStringArray(region.bones),
    meshes: cloneStringArray(region.meshes),
    objects: cloneStringArray(region.objects),
    children: cloneStringArray(region.children),
    cameraOffset: cloneVector3(region.cameraOffset),
    customPosition: clonePoint3(region.customPosition),
    style: region.style
      ? {
          ...region.style,
          line: region.style.line ? { ...region.style.line } : undefined,
        }
      : undefined,
  };
}

export function mergeAnnotationRegion<T extends AnnotationRegion>(base: T, override: T): T {
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

export function mergeAnnotationRegionsByName<T extends AnnotationRegion>(
  base?: T[],
  override?: T[]
): T[] | undefined {
  if (!base && !override) return undefined;

  const merged = new Map<string, T>();

  for (const region of base ?? []) {
    merged.set(region.name, cloneAnnotationRegion(region));
  }

  for (const region of override ?? []) {
    const existing = merged.get(region.name);
    merged.set(region.name, existing ? mergeAnnotationRegion(existing, region) : cloneAnnotationRegion(region));
  }

  return Array.from(merged.values());
}

export function removeAnnotationRegionByName<T extends AnnotationRegion>(
  regions: T[] | undefined,
  regionName: string
): T[] | undefined {
  if (!regions) return undefined;

  return regions
    .filter((region) => region.name !== regionName)
    .map((region) => cloneAnnotationRegion(region));
}

export function reorderAnnotationRegions<T extends AnnotationRegion>(
  regions: T[] | undefined,
  orderedNames: readonly string[]
): T[] | undefined {
  if (!regions) return undefined;

  const regionMap = new Map(regions.map((region) => [region.name, cloneAnnotationRegion(region)]));
  const seen = new Set<string>();
  const next: T[] = [];

  for (const name of orderedNames) {
    const region = regionMap.get(name);
    if (!region || seen.has(name)) continue;
    seen.add(name);
    next.push(region);
  }

  for (const region of regions) {
    if (seen.has(region.name)) continue;
    seen.add(region.name);
    next.push(cloneAnnotationRegion(region));
  }

  return next;
}

export function resetAnnotationRegionByName<T extends AnnotationRegion>(
  regions: T[] | undefined,
  baseRegions: T[] | undefined,
  regionName: string
): T[] | undefined {
  const current = regions ?? [];
  const baseRegion = baseRegions?.find((region) => region.name === regionName);
  const currentIndex = current.findIndex((region) => region.name === regionName);

  if (!baseRegion) {
    return removeAnnotationRegionByName(current, regionName);
  }

  const next = current.map((region) => cloneAnnotationRegion(region));
  if (currentIndex >= 0) {
    next[currentIndex] = cloneAnnotationRegion(baseRegion);
    return next;
  }

  next.push(cloneAnnotationRegion(baseRegion));
  return next;
}

export function validateAnnotationRegions(
  regions?: AnnotationRegion[],
  options?: { disabledRegions?: string[] }
): AnnotationValidationIssue[] {
  if (!regions || regions.length === 0) return [];

  const issues: AnnotationValidationIssue[] = [];
  const counts = new Map<string, number>();

  for (const region of regions) {
    counts.set(region.name, (counts.get(region.name) ?? 0) + 1);
  }

  const duplicateNames = new Set(
    Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .map(([name]) => name)
  );

  for (const name of duplicateNames) {
    issues.push({
      code: 'duplicate-region-name',
      regionName: name,
      message: `Annotation region "${name}" is defined more than once.`,
    });
  }

  for (const region of regions) {
    if (region.cameraOffset) {
      const invalidCameraOffset = ['x', 'y', 'z'].some((key) => {
        const value = region.cameraOffset?.[key as keyof AnnotationVector];
        return value !== undefined && !isFiniteNumber(value);
      });
      if (invalidCameraOffset) {
        issues.push({
          code: 'invalid-camera-offset',
          regionName: region.name,
          message: `Annotation region "${region.name}" has a non-finite cameraOffset value.`,
        });
      }
    }

    if (region.customPosition && !isFiniteVector3(region.customPosition, ['x', 'y', 'z'])) {
      issues.push({
        code: 'invalid-custom-position',
        regionName: region.name,
        message: `Annotation region "${region.name}" has an invalid customPosition vector.`,
      });
    }

    const explicitLineDirection = region.style?.lineDirection;
    if (
      explicitLineDirection &&
      typeof explicitLineDirection === 'object' &&
      !isFiniteVector3(explicitLineDirection, ['x', 'y', 'z'])
    ) {
      issues.push({
        code: 'invalid-line-direction',
        regionName: region.name,
        message: `Annotation region "${region.name}" has an invalid explicit lineDirection vector.`,
      });
    }

    if (region.isFallback && !region.groupId) {
      issues.push({
        code: 'fallback-without-group',
        regionName: region.name,
        message: `Annotation region "${region.name}" is marked as a fallback but has no groupId.`,
      });
    }
  }

  const uniqueRegions = regions.filter((region, index) => regions.findIndex((entry) => entry.name === region.name) === index);
  const regionMap = new Map(uniqueRegions.map((region) => [region.name, region]));

  for (const region of uniqueRegions) {
    if (region.parent && !regionMap.has(region.parent)) {
      issues.push({
        code: 'missing-parent',
        regionName: region.name,
        relatedRegionName: region.parent,
        message: `Annotation region "${region.name}" references missing parent "${region.parent}".`,
      });
    }

    for (const childName of region.children ?? []) {
      const child = regionMap.get(childName);
      if (!child) {
        issues.push({
          code: 'missing-child',
          regionName: region.name,
          relatedRegionName: childName,
          message: `Annotation region "${region.name}" references missing child "${childName}".`,
        });
        continue;
      }

      if (child.parent !== region.name) {
        issues.push({
          code: 'inconsistent-parent-child',
          regionName: region.name,
          relatedRegionName: childName,
          message: `Annotation region "${region.name}" lists "${childName}" as a child, but the child points to "${child.parent ?? 'no parent'}".`,
        });
      }
    }
  }

  const graph = getChildGraph(uniqueRegions);
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const visit = (name: string, path: string[]) => {
    if (visiting.has(name)) {
      const cycleStart = path.indexOf(name);
      const cyclePath = cycleStart >= 0 ? path.slice(cycleStart).concat(name) : path.concat(name);
      issues.push({
        code: 'cycle-detected',
        regionName: name,
        message: `Annotation region hierarchy contains a cycle: ${cyclePath.join(' -> ')}.`,
      });
      return;
    }

    if (visited.has(name)) return;
    visiting.add(name);
    const nextPath = [...path, name];
    for (const childName of graph.get(name) ?? []) {
      if (regionMap.has(childName)) {
        visit(childName, nextPath);
      }
    }
    visiting.delete(name);
    visited.add(name);
  };

  for (const name of graph.keys()) {
    visit(name, []);
  }

  const knownNames = new Set(uniqueRegions.map((region) => region.name));
  for (const disabledName of options?.disabledRegions ?? []) {
    if (!knownNames.has(disabledName)) {
      issues.push({
        code: 'unknown-disabled-region',
        relatedRegionName: disabledName,
        message: `disabledRegions references unknown annotation region "${disabledName}".`,
      });
    }
  }

  return issues;
}
