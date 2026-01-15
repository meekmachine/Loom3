/**
 * Loom3 - Preset Exports
 *
 * All AU presets are exported from here.
 * Frontend passes a presetType string and loom3 resolves the preset internally.
 */

// CC4 preset (default for humanoid characters)
export { CC4_PRESET, default } from './cc4';
export * from './cc4';
export { mergePreset } from './mergePreset';

import type { AUMappingConfig } from '../mappings/types';
import { mergePreset } from './mergePreset';

// Betta fish preset (skeletal animation, no morphs)
import { AU_MAPPING_CONFIG } from './bettaFish';
export { BETTA_FISH_PRESET, AU_MAPPING_CONFIG as FISH_AU_MAPPING_CONFIG } from './bettaFish';

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

// Import CC4_PRESET at module level for resolvePreset
import { CC4_PRESET } from './cc4';

/**
 * Resolve a preset by type name.
 * This allows frontend to pass a string instead of importing the full preset.
 */
export function resolvePreset(presetType: PresetType | string | undefined) {
  switch (presetType) {
    case 'fish':
    case 'skeletal':
      return AU_MAPPING_CONFIG;
    case 'cc4':
    case 'custom':
    default:
      return CC4_PRESET;
  }
}

/**
 * Resolve a preset and merge optional overrides.
 */
export function resolvePresetWithOverrides(
  presetType: PresetType | string | undefined,
  overrides?: Partial<AUMappingConfig>
): AUMappingConfig {
  const base = resolvePreset(presetType);
  return overrides ? mergePreset(base, overrides) : base;
}
