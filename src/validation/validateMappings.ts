/**
 * LoomLarge - Mapping Validation
 *
 * Validates that AU mapping presets are compatible with a loaded character model.
 * Checks that bones, morph targets, and meshes referenced in the preset exist in the model.
 */

import type { AUMappingConfig } from '../mappings/types';

/**
 * Result of validating a preset against a model
 */
export interface ValidationResult {
  /** Overall validity - true if essential mappings are found */
  valid: boolean;

  /** Compatibility score from 0-100 */
  score: number;

  /** Morph targets referenced in preset but not found in model */
  missingMorphs: string[];

  /** Bones referenced in preset but not found in model */
  missingBones: string[];

  /** Morph targets successfully matched */
  foundMorphs: string[];

  /** Bones successfully matched */
  foundBones: string[];

  /** Morph targets in model not used by preset */
  unmappedMorphs: string[];

  /** Bones in model not used by preset */
  unmappedBones: string[];

  /** Non-fatal warnings and suggestions */
  warnings: string[];
}

/**
 * Interface for mesh with morph targets (compatible with Three.js Mesh)
 */
interface MorphMesh {
  name: string;
  morphTargetDictionary?: Record<string, number>;
  morphTargetInfluences?: number[];
}

/**
 * Interface for skeleton (compatible with Three.js Skeleton)
 */
interface Skeleton {
  bones: Array<{ name: string }>;
}

/**
 * Check if a target name matches using fuzzy matching with suffix pattern
 */
function fuzzyMatch(
  targetName: string,
  candidateName: string,
  prefix: string,
  suffixPattern: RegExp | null
): boolean {
  const fullTarget = prefix + targetName;

  // Exact match
  if (candidateName === fullTarget) {
    return true;
  }

  // Fuzzy match with suffix
  if (suffixPattern && candidateName.startsWith(fullTarget)) {
    const suffix = candidateName.slice(fullTarget.length);
    return suffix === '' || suffixPattern.test(suffix);
  }

  return false;
}

/**
 * Find all matching names in a set using fuzzy matching
 */
function findMatches(
  targetNames: string[],
  candidateNames: Set<string>,
  prefix: string,
  suffixPattern: RegExp | null
): { found: string[]; missing: string[] } {
  const found: string[] = [];
  const missing: string[] = [];

  for (const target of targetNames) {
    let matched = false;
    for (const candidate of candidateNames) {
      if (fuzzyMatch(target, candidate, prefix, suffixPattern)) {
        found.push(target);
        matched = true;
        break;
      }
    }
    if (!matched) {
      missing.push(target);
    }
  }

  return { found, missing };
}

/**
 * Validate that a preset's mappings exist on the loaded model.
 *
 * @param meshes - Array of meshes with morph targets from the model
 * @param skeleton - Model skeleton (or null if no skeleton)
 * @param config - AU mapping preset to validate against
 * @returns ValidationResult with detailed compatibility info
 */
export function validateMappings(
  meshes: MorphMesh[],
  skeleton: Skeleton | null,
  config: AUMappingConfig
): ValidationResult {
  const warnings: string[] = [];

  // Build suffix regex if pattern provided
  const suffixPattern = config.suffixPattern
    ? new RegExp(config.suffixPattern)
    : null;

  const bonePrefix = config.bonePrefix || '';
  const morphPrefix = config.morphPrefix || '';

  // Collect all morph target names from meshes
  const modelMorphs = new Set<string>();
  for (const mesh of meshes) {
    if (mesh.morphTargetDictionary) {
      for (const morphName of Object.keys(mesh.morphTargetDictionary)) {
        modelMorphs.add(morphName);
      }
    }
  }

  // Collect all bone names from skeleton
  const modelBones = new Set<string>();
  if (skeleton?.bones) {
    for (const bone of skeleton.bones) {
      if (bone.name) {
        modelBones.add(bone.name);
      }
    }
  }

  // Get all unique morph targets referenced in preset
  const presetMorphs = new Set<string>();
  for (const morphList of Object.values(config.auToMorphs)) {
    for (const morph of morphList) {
      presetMorphs.add(morph);
    }
  }
  for (const viseme of config.visemeKeys) {
    presetMorphs.add(viseme);
  }

  // Get all unique bone names referenced in preset
  const presetBones = new Set<string>(Object.values(config.boneNodes));

  // Validate morphs
  const morphResult = findMatches(
    Array.from(presetMorphs),
    modelMorphs,
    morphPrefix,
    suffixPattern
  );

  // Validate bones
  const boneResult = findMatches(
    Array.from(presetBones),
    modelBones,
    bonePrefix,
    suffixPattern
  );

  // Find unmapped model assets
  const unmappedMorphs: string[] = [];
  for (const morph of modelMorphs) {
    let isUsed = false;
    for (const target of presetMorphs) {
      if (fuzzyMatch(target, morph, morphPrefix, suffixPattern)) {
        isUsed = true;
        break;
      }
    }
    if (!isUsed) {
      unmappedMorphs.push(morph);
    }
  }

  const unmappedBones: string[] = [];
  for (const bone of modelBones) {
    let isUsed = false;
    for (const target of presetBones) {
      if (fuzzyMatch(target, bone, bonePrefix, suffixPattern)) {
        isUsed = true;
        break;
      }
    }
    if (!isUsed) {
      unmappedBones.push(bone);
    }
  }

  // Generate warnings
  if (presetMorphs.size > 0 && modelMorphs.size === 0) {
    warnings.push('Model has no morph targets - blend shape animations will not work');
  }

  if (presetBones.size > 0 && modelBones.size === 0) {
    warnings.push('Model has no skeleton - bone-based animations will not work');
  }

  if (morphResult.missing.length > 0 && morphResult.found.length === 0) {
    warnings.push(`No morph targets matched - preset may be incompatible with this model`);
  }

  if (boneResult.missing.length > 0 && boneResult.found.length === 0) {
    warnings.push(`No bones matched - preset may be incompatible with this model`);
  }

  // Calculate compatibility score
  let score = 0;

  // Morph score (60% weight if preset uses morphs)
  if (presetMorphs.size > 0) {
    const morphScore = (morphResult.found.length / presetMorphs.size) * 60;
    score += morphScore;
  } else {
    // No morphs in preset - give full morph points
    score += 60;
  }

  // Bone score (40% weight if preset uses bones)
  if (presetBones.size > 0) {
    const boneScore = (boneResult.found.length / presetBones.size) * 40;
    score += boneScore;
  } else {
    // No bones in preset - give full bone points
    score += 40;
  }

  score = Math.round(score);

  // Determine overall validity
  // Valid if at least some essential mappings are found
  const hasMorphSupport = presetMorphs.size === 0 || morphResult.found.length > 0;
  const hasBoneSupport = presetBones.size === 0 || boneResult.found.length > 0;
  const valid = hasMorphSupport || hasBoneSupport;

  return {
    valid,
    score,
    missingMorphs: morphResult.missing,
    missingBones: boneResult.missing,
    foundMorphs: morphResult.found,
    foundBones: boneResult.found,
    unmappedMorphs,
    unmappedBones,
    warnings,
  };
}

/**
 * Quick check if a preset is compatible with a model.
 * Returns true if at least 50% of mappings are found.
 */
export function isPresetCompatible(
  meshes: MorphMesh[],
  skeleton: Skeleton | null,
  config: AUMappingConfig
): boolean {
  const result = validateMappings(meshes, skeleton, config);
  return result.score >= 50;
}

/**
 * Suggest the best preset from a list based on validation scores.
 */
export function suggestBestPreset<T extends AUMappingConfig>(
  meshes: MorphMesh[],
  skeleton: Skeleton | null,
  presets: T[]
): { preset: T; score: number } | null {
  let bestPreset: T | null = null;
  let bestScore = -1;

  for (const preset of presets) {
    const result = validateMappings(meshes, skeleton, preset);
    if (result.score > bestScore) {
      bestScore = result.score;
      bestPreset = preset;
    }
  }

  return bestPreset ? { preset: bestPreset, score: bestScore } : null;
}
