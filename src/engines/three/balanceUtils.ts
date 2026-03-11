export function clampBalance(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-1, Math.min(1, value));
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
