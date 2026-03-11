import { describe, expect, it } from 'vitest';
import { clampBalance, resolveCurveBalance } from './balanceUtils';

describe('balance utils', () => {
  it('clamps to [-1, 1]', () => {
    expect(clampBalance(-2)).toBe(-1);
    expect(clampBalance(2)).toBe(1);
    expect(clampBalance(0.25)).toBe(0.25);
  });

  it('normalizes non-finite values to 0', () => {
    expect(clampBalance(Number.NaN)).toBe(0);
    expect(clampBalance(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clampBalance(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it('prefers per-curve override over global balance', () => {
    const balanceMap = { '43': 1, '12': -0.3 };
    expect(resolveCurveBalance('43', 0, balanceMap)).toBe(1);
    expect(resolveCurveBalance('12', 0.8, balanceMap)).toBe(-0.3);
  });

  it('falls back to global balance when no curve override exists', () => {
    const balanceMap = { '43': 1 };
    expect(resolveCurveBalance('12', -0.4, balanceMap)).toBe(-0.4);
    expect(resolveCurveBalance('12', 0.2)).toBe(0.2);
  });
});
