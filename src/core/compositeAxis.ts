import type { AUSelector, BoneBinding, RotationAxis } from './types';

export function toAUList(value?: AUSelector): number[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function findBoneBindingForNode(
  auToBones: Record<number, BoneBinding[]>,
  auId: number,
  nodeKey: string
): BoneBinding | null {
  return auToBones[auId]?.find((candidate) => candidate.node === nodeKey) ?? null;
}

export function getCompositeAxisValue(
  axisConfig: RotationAxis | null | undefined,
  getValue: (auId: number) => number
): number {
  if (!axisConfig) return 0;

  const negativeAUs = toAUList(axisConfig.negative);
  const positiveAUs = toAUList(axisConfig.positive);

  if (negativeAUs.length > 0 && positiveAUs.length > 0) {
    const negativeValue = Math.max(...negativeAUs.map(getValue), 0);
    const positiveValue = Math.max(...positiveAUs.map(getValue), 0);
    return positiveValue - negativeValue;
  }

  if (axisConfig.aus.length > 1) {
    return Math.max(...axisConfig.aus.map(getValue), 0);
  }

  return getValue(axisConfig.aus[0]);
}

export function getCompositeAxisBinding(
  nodeKey: string,
  axisConfig: RotationAxis | null | undefined,
  direction: number,
  getValue: (auId: number) => number,
  auToBones: Record<number, BoneBinding[]>
): BoneBinding | null {
  if (!axisConfig) return null;

  const directionalAUs = direction < 0 ? toAUList(axisConfig.negative) : toAUList(axisConfig.positive);
  const candidates = directionalAUs.length > 0 ? directionalAUs : axisConfig.aus;
  const ranked = [...candidates].sort((a, b) => getValue(b) - getValue(a));

  for (const auId of ranked) {
    const binding = findBoneBindingForNode(auToBones, auId, nodeKey);
    if (binding) return binding;
  }

  return null;
}
