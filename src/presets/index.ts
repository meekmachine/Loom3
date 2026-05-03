/**
 * Loom3 - Preset Exports
 *
 * All AU presets are exported from here.
 * Frontend passes a presetType string and Loom3 looks up or extends the preset internally.
 */

// CC4 preset (default for humanoid characters)
export { CC4_PRESET, default } from './cc4';
export * from './cc4';

import type { Profile } from '../mappings/types';
import { extendPresetWithProfile } from '../mappings/extendPresetWithProfile';
export { extendPresetWithProfile } from '../mappings/extendPresetWithProfile';

// Betta fish preset (skeletal animation, no morphs)
import { BETTA_FISH_PRESET } from './bettaFish';
export { BETTA_FISH_PRESET, AU_MAPPING_CONFIG, FISH_AU_MAPPING_CONFIG } from './bettaFish';

// Re-export fish-specific items with FISH_ prefix to avoid conflicts
export {
  BONE_NODES as FISH_BONE_NODES,
  BONE_BINDINGS as FISH_BONE_BINDINGS,
  COMPOSITE_ROTATIONS as FISH_COMPOSITE_ROTATIONS,
  EYE_MESH_NODES as FISH_EYE_MESH_NODES,
} from './bettaFish';

/**
 * Preset types that can be passed to Loom3
 */
export type PresetType = 'cc4' | 'skeletal' | 'fish' | 'custom';

// Import CC4_PRESET at module level for getPreset
import { CC4_PRESET } from './cc4';

/**
 * Get a preset by type name.
 * This allows frontend to pass a string instead of importing the full preset.
 */
export function getPreset(presetType: PresetType | string | undefined) {
  switch (presetType) {
    case 'fish':
    case 'skeletal':
      return BETTA_FISH_PRESET;
    case 'cc4':
    case 'custom':
    default:
      return CC4_PRESET;
  }
}

// Backwards-compatible lookup alias retained for LoomLarge consumers.
export const resolvePreset = getPreset;

/**
 * Get a preset, then extend it with an optional profile.
 */
export function getPresetWithProfile(
  presetType: PresetType | string | undefined,
  profile?: Partial<Profile>
): Profile {
  return extendPresetWithProfile(getPreset(presetType), profile);
}

// Backwards-compatible extension alias retained for LoomLarge consumers.
export const resolvePresetWithOverrides = getPresetWithProfile;
