export interface RegionTreeNode {
  name: string;
  parent?: string;
  children?: string[];
}

function normalizeDisabledNames(disabledNames?: string[]): Set<string> {
  return new Set((disabledNames ?? []).filter((name): name is string => Boolean(name)));
}

export function normalizeRegionTree<T extends RegionTreeNode>(
  regions?: T[],
  disabledNames?: string[]
): T[] | undefined {
  if (!regions) return undefined;

  const disabled = normalizeDisabledNames(disabledNames);
  const nextRegions = regions
    .filter((region) => !disabled.has(region.name))
    .map((region) => ({
      ...region,
      children: region.children ? [...region.children] : undefined,
    }));

  const remainingNames = new Set(nextRegions.map((region) => region.name));

  return nextRegions.map((region) => {
    const nextChildren = region.children?.filter((child) => remainingNames.has(child));
    const nextParent = region.parent && remainingNames.has(region.parent)
      ? region.parent
      : undefined;

    return {
      ...region,
      parent: nextParent,
      children: nextChildren && nextChildren.length > 0 ? nextChildren : undefined,
    };
  });
}
