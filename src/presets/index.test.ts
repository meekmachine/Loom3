import { describe, expect, it } from 'vitest';
import { BETTA_FISH_PRESET, FISH_AU_MAPPING_CONFIG, resolvePreset } from './index';

describe('resolvePreset', () => {
  it('returns the single Betta fish preset object for fish aliases', () => {
    expect(resolvePreset('fish')).toBe(BETTA_FISH_PRESET);
    expect(resolvePreset('skeletal')).toBe(BETTA_FISH_PRESET);
  });

  it('keeps the legacy fish mapping alias pointed at the real fish preset', () => {
    expect(FISH_AU_MAPPING_CONFIG).toBe(BETTA_FISH_PRESET);
  });
});
