export function clampBalance(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-1, Math.min(1, value));
}

export function getSideScale(
  balance: number,
  side?: 'left' | 'right'
): number {
  if (side !== 'left' && side !== 'right') return 1;

  const clamped = clampBalance(balance);
  if (side === 'left') {
    return clamped > 0 ? 1 - clamped : 1;
  }
  return clamped < 0 ? 1 + clamped : 1;
}

export function resolveCurveBalance(
  curveId: string,
  globalBalance: number,
  balanceMap?: Record<string, number>
): number {
  if (balanceMap && Object.prototype.hasOwnProperty.call(balanceMap, curveId)) {
    return clampBalance(Number(balanceMap[curveId]));
  }
  return clampBalance(globalBalance);
}
