import { describe, it, expect } from 'vitest';
import {
  CANONICAL_VISEME_IDS,
  CANONICAL_VISEME_JAW_AMOUNTS,
  compileVisemeJawAmounts,
  compileVisemeKeys,
  createVisemeBindingsFromKeys,
  resolveVisemeBindings,
} from './visemes';

describe('viseme helpers', () => {
  it('keeps the canonical 15-slot order even when bindings are sparse', () => {
    const bindings = {
      EE: { morph: 'viseme_ee', jawAmount: 0.2 },
      Ah: { morph: 'viseme_ah', jawAmount: 0.8 },
      R: { morph: 'viseme_r', jawAmount: 0.35 },
    };

    const compiledKeys = compileVisemeKeys(bindings, [], []);
    const compiledJawAmounts = compileVisemeJawAmounts(bindings, [], []);

    expect(CANONICAL_VISEME_IDS).toHaveLength(15);
    expect(compiledKeys).toHaveLength(15);
    expect(compiledJawAmounts).toHaveLength(15);
    expect(compiledKeys[0]).toBe('viseme_ee');
    expect(compiledKeys[1]).toBe('viseme_ah');
    expect(compiledKeys[2]).toBeUndefined();
    expect(compiledKeys[14]).toBe('viseme_r');
    expect(compiledJawAmounts[2]).toBeCloseTo(CANONICAL_VISEME_JAW_AMOUNTS[2], 2);
  });

  it('round-trips a compiled legacy array into explicit bindings', () => {
    const legacy = [
      'viseme_ee',
      'viseme_ah',
      undefined,
      'viseme_oo',
    ];

    const bindings = createVisemeBindingsFromKeys(legacy);
    const resolved = resolveVisemeBindings(bindings, legacy, []);

    expect(bindings.EE?.morph).toBe('viseme_ee');
    expect(bindings.Ah?.morph).toBe('viseme_ah');
    expect(resolved[0].morph).toBe('viseme_ee');
    expect(resolved[2].morph).toBeUndefined();
    expect(resolved).toHaveLength(15);
  });
});
