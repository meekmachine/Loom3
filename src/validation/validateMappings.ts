/**
 * Loom3 - Mapping Validation
 *
 * Validates that AU mapping presets are compatible with a loaded character model.
 * Checks that bones, morph targets, and meshes referenced in the preset exist in the model.
 */

import type { Profile, MorphTargetsBySide, MorphTargetRef } from '../mappings/types';
import type { MappingCorrection, MappingCorrectionOptions } from './generateMappingCorrections';
import { generateMappingCorrections } from './generateMappingCorrections';

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

  /** Meshes referenced by morphToMesh but not found in model */
  missingMeshes: string[];

  /** Meshes referenced by morphToMesh and found in model */
  foundMeshes: string[];

  /** Meshes in model not referenced by morphToMesh */
  unmappedMeshes: string[];

  /** Non-fatal warnings and suggestions */
  warnings: string[];

  /** Optional: corrected config when suggestions are requested */
  suggestedConfig?: Profile;

  /** Optional: corrections applied or suggested */
  corrections?: MappingCorrection[];

  /** Optional: unresolved mappings that could not be corrected */
  unresolved?: MappingCorrection[];
}

export type IssueSeverity = 'error' | 'warning';

export interface MappingIssue {
  code: string;
  severity: IssueSeverity;
  message: string;
  data?: Record<string, unknown>;
}

export interface MappingConsistencyResult {
  valid: boolean;
  errors: MappingIssue[];
  warnings: MappingIssue[];
  issues: MappingIssue[];
}

export interface ValidateMappingOptions extends MappingCorrectionOptions {
  suggestCorrections?: boolean;
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
  suffix: string,
  suffixPattern: RegExp | null
): boolean {
  const fullTarget = prefix + targetName + suffix;

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
  suffix: string,
  suffixPattern: RegExp | null
): { found: string[]; missing: string[] } {
  const found: string[] = [];
  const missing: string[] = [];

  for (const target of targetNames) {
    let matched = false;
    for (const candidate of candidateNames) {
      if (fuzzyMatch(target, candidate, prefix, suffix, suffixPattern)) {
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

function collectAxisConfigs(axisConfigs: Array<{ axis: 'pitch' | 'yaw' | 'roll'; config: any }>) {
  return axisConfigs.filter((entry) => entry.config);
}

function isEyeNodeKey(nodeKey: string) {
  return nodeKey === 'EYE_L' || nodeKey === 'EYE_R';
}

/**
 * Validate that the mapping dictionaries are internally consistent.
 */
export function validateMappingConfig(config: Profile): MappingConsistencyResult {
  const errors: MappingIssue[] = [];
  const warnings: MappingIssue[] = [];

  const push = (severity: IssueSeverity, code: string, message: string, data?: Record<string, unknown>) => {
    const issue = { severity, code, message, data };
    if (severity === 'error') {
      errors.push(issue);
    } else {
      warnings.push(issue);
    }
  };

  const boneNodeKeys = new Set(Object.keys(config.boneNodes || {}));
  const hasEyeMeshNodes = !!config.eyeMeshNodes;

  const isNodeResolvable = (nodeKey: string) => {
    if (boneNodeKeys.has(nodeKey)) return true;
    if (isEyeNodeKey(nodeKey) && hasEyeMeshNodes) return true;
    return false;
  };

  // Validate bone bindings reference known nodes
  for (const [auIdStr, bindings] of Object.entries(config.auToBones || {})) {
    for (const binding of bindings) {
      if (!isNodeResolvable(binding.node)) {
        push(
          'error',
          'BONE_NODE_MISSING',
          `AU ${auIdStr} references bone node "${binding.node}" not present in boneNodes`,
          { auId: Number(auIdStr), node: binding.node }
        );
      }
    }
  }

  // Validate composite rotations
  const composites = config.compositeRotations || [];
  const compositeNodes = new Set<string>();

  for (const composite of composites) {
    if (compositeNodes.has(composite.node)) {
      push(
        'warning',
        'COMPOSITE_NODE_DUPLICATE',
        `Composite rotation node "${composite.node}" is defined more than once`,
        { node: composite.node }
      );
    }
    compositeNodes.add(composite.node);

    if (!isNodeResolvable(composite.node)) {
      push(
        'error',
        'COMPOSITE_NODE_MISSING',
        `Composite rotation node "${composite.node}" is not present in boneNodes`,
        { node: composite.node }
      );
    }

    const axisEntries = collectAxisConfigs([
      { axis: 'pitch', config: composite.pitch },
      { axis: 'yaw', config: composite.yaw },
      { axis: 'roll', config: composite.roll },
    ]);

    for (const { config: axisConfig } of axisEntries) {
      if (!axisConfig.aus || axisConfig.aus.length === 0) {
        push(
          'error',
          'COMPOSITE_AUS_EMPTY',
          `Composite axis for "${composite.node}" has no AU list`,
          { node: composite.node }
        );
        continue;
      }

      if (axisConfig.negative !== undefined && !axisConfig.aus.includes(axisConfig.negative)) {
        push(
          'error',
          'COMPOSITE_AU_MISSING',
          `Composite axis for "${composite.node}" is missing negative AU ${axisConfig.negative} in aus list`,
          { node: composite.node, auId: axisConfig.negative }
        );
      }

      if (axisConfig.positive !== undefined && !axisConfig.aus.includes(axisConfig.positive)) {
        push(
          'error',
          'COMPOSITE_AU_MISSING',
          `Composite axis for "${composite.node}" is missing positive AU ${axisConfig.positive} in aus list`,
          { node: composite.node, auId: axisConfig.positive }
        );
      }

      if (
        axisConfig.negative !== undefined &&
        axisConfig.positive !== undefined &&
        axisConfig.negative === axisConfig.positive
      ) {
        push(
          'error',
          'COMPOSITE_AU_DUPLICATE',
          `Composite axis for "${composite.node}" has identical negative/positive AU ${axisConfig.negative}`,
          { node: composite.node, auId: axisConfig.negative }
        );
      }
    }
  }

  // Validate continuum pairs
  const continuumPairs = config.continuumPairs || {};
  for (const [auIdStr, info] of Object.entries(continuumPairs)) {
    const auId = Number(auIdStr);
    if (info.pairId === auId) {
      push(
        'error',
        'CONTINUUM_PAIR_INVALID',
        `Continuum AU ${auId} pairs with itself`,
        { auId }
      );
      continue;
    }

    const reciprocal = continuumPairs[info.pairId];
    if (!reciprocal) {
      push(
        'error',
        'CONTINUUM_PAIR_MISSING',
        `Continuum AU ${auId} is missing reciprocal pair ${info.pairId}`,
        { auId, pairId: info.pairId }
      );
      continue;
    }

    if (reciprocal.pairId !== auId) {
      push(
        'error',
        'CONTINUUM_PAIR_MISMATCH',
        `Continuum AU ${auId} pair ${info.pairId} does not point back`,
        { auId, pairId: info.pairId }
      );
    }

    if (reciprocal.isNegative === info.isNegative) {
      push(
        'error',
        'CONTINUUM_SIGN_MISMATCH',
        `Continuum AU ${auId} and ${info.pairId} share the same isNegative flag`,
        { auId, pairId: info.pairId }
      );
    }

    if (reciprocal.axis !== info.axis) {
      push(
        'error',
        'CONTINUUM_AXIS_MISMATCH',
        `Continuum AU ${auId} and ${info.pairId} disagree on axis`,
        { auId, pairId: info.pairId }
      );
    }

    if (reciprocal.node !== info.node) {
      push(
        'error',
        'CONTINUUM_NODE_MISMATCH',
        `Continuum AU ${auId} and ${info.pairId} disagree on node`,
        { auId, pairId: info.pairId }
      );
    }

    if (!isNodeResolvable(info.node)) {
      push(
        'error',
        'CONTINUUM_NODE_MISSING',
        `Continuum AU ${auId} references node "${info.node}" not present in boneNodes`,
        { auId, node: info.node }
      );
    }
  }

  // Cross-check continuum pairs against composite rotations (if present)
  if (composites.length > 0) {
    for (const [auIdStr, info] of Object.entries(continuumPairs)) {
      const composite = composites.find((c) => c.node === info.node);
      if (!composite) {
        push(
          'warning',
          'CONTINUUM_COMPOSITE_MISSING',
          `Continuum AU ${auIdStr} references node "${info.node}" without a composite rotation`,
          { auId: Number(auIdStr), node: info.node }
        );
        continue;
      }

      const axisConfig = composite[info.axis];
      if (!axisConfig || axisConfig.negative === undefined || axisConfig.positive === undefined) {
        push(
          'warning',
          'CONTINUUM_COMPOSITE_MISMATCH',
          `Continuum AU ${auIdStr} axis ${info.axis} is not configured as a negative/positive pair in composites`,
          { auId: Number(auIdStr), node: info.node }
        );
        continue;
      }

      const expectedNeg = axisConfig.negative;
      const expectedPos = axisConfig.positive;
      const negId = info.isNegative ? Number(auIdStr) : info.pairId;
      const posId = info.isNegative ? info.pairId : Number(auIdStr);
      if (negId !== expectedNeg || posId !== expectedPos) {
        push(
          'warning',
          'CONTINUUM_COMPOSITE_MISMATCH',
          `Continuum AU ${auIdStr} does not match composite negative/positive mapping for ${info.node}`,
          { auId: Number(auIdStr), node: info.node }
        );
      }
    }
  }

  // Validate AU info coverage
  if (config.auInfo) {
    const referencedAUs = new Set<number>();
    Object.keys(config.auToBones || {}).forEach((key) => referencedAUs.add(Number(key)));
    Object.keys(config.auToMorphs || {}).forEach((key) => referencedAUs.add(Number(key)));
    Object.keys(continuumPairs).forEach((key) => referencedAUs.add(Number(key)));
    composites.forEach((composite) => {
      [composite.pitch, composite.yaw, composite.roll].forEach((axis) => {
        if (!axis) return;
        axis.aus.forEach((auId) => referencedAUs.add(auId));
      });
    });

    for (const auId of referencedAUs) {
      if (!config.auInfo[String(auId)]) {
        push(
          'warning',
          'AU_INFO_MISSING',
          `AU ${auId} is referenced but missing from auInfo`,
          { auId }
        );
      }
    }
  }

  // Validate viseme keys (duplicates or blanks)
  const visemeSeen = new Set<string>();
  for (const key of config.visemeKeys || []) {
    if (typeof key !== 'string') continue;
    if (!key) {
      push('warning', 'VISEME_EMPTY', 'Viseme key is empty');
      continue;
    }
    if (visemeSeen.has(key)) {
      push('warning', 'VISEME_DUPLICATE', `Viseme key "${key}" is duplicated`, { key });
    }
    visemeSeen.add(key);
  }

  // Validate auMixDefaults
  if (config.auMixDefaults) {
    for (const key of Object.keys(config.auMixDefaults)) {
      const auId = Number(key);
      if (
        Number.isNaN(auId) ||
        (!config.auToBones?.[auId] && !collectMorphs(config.auToMorphs?.[auId]).length && !continuumPairs[auId])
      ) {
        push(
          'warning',
          'AU_MIX_DEFAULT_UNUSED',
          `auMixDefaults includes AU ${key} not present in auToBones/auToMorphs`,
          { auId: key }
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    issues: [...errors, ...warnings],
  };
}

/**
 * Validate that a preset's mappings exist on the loaded model.
 *
 * @param meshes - Array of meshes with morph targets from the model
 * @param skeleton - Model skeleton (or null if no skeleton)
 * @param config - AU mapping preset to validate against
 * @returns ValidationResult with detailed compatibility info
 */
const isStringMorph = (key: MorphTargetRef): key is string => typeof key === 'string';

const collectMorphs = (entry?: MorphTargetsBySide) =>
  [
    ...(entry?.left ?? []),
    ...(entry?.right ?? []),
    ...(entry?.center ?? []),
  ].filter(isStringMorph);

export function validateMappings(
  meshes: MorphMesh[],
  skeleton: Skeleton | null,
  config: Profile,
  options: ValidateMappingOptions = {}
): ValidationResult {
  const warnings: string[] = [];

  // Build suffix regex if pattern provided
  const suffixPattern = config.suffixPattern
    ? new RegExp(config.suffixPattern)
    : null;

  const bonePrefix = config.bonePrefix || '';
  const boneSuffix = config.boneSuffix || '';
  const morphPrefix = config.morphPrefix || '';
  const morphSuffix = config.morphSuffix || '';

  // Collect all morph target names from meshes
  const modelMorphs = new Set<string>();
  const modelMeshes = new Set<string>();
  for (const mesh of meshes) {
    if (mesh.name) {
      modelMeshes.add(mesh.name);
    }
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
  for (const entry of Object.values(config.auToMorphs)) {
    for (const morph of collectMorphs(entry)) {
      presetMorphs.add(morph);
    }
  }
  for (const viseme of config.visemeKeys) {
    if (typeof viseme === 'string') {
      presetMorphs.add(viseme);
    }
  }

  // Get all unique bone names referenced in preset
  const presetBones = new Set<string>(Object.values(config.boneNodes));

  // Validate morphs
  const morphResult = findMatches(
    Array.from(presetMorphs),
    modelMorphs,
    morphPrefix,
    morphSuffix,
    suffixPattern
  );

  // Validate bones
  const boneResult = findMatches(
    Array.from(presetBones),
    modelBones,
    bonePrefix,
    boneSuffix,
    suffixPattern
  );

  // Find unmapped model assets
  const unmappedMorphs: string[] = [];
  for (const morph of modelMorphs) {
    let isUsed = false;
    for (const target of presetMorphs) {
      if (fuzzyMatch(target, morph, morphPrefix, morphSuffix, suffixPattern)) {
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
      if (fuzzyMatch(target, bone, bonePrefix, boneSuffix, suffixPattern)) {
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

  // Validate morphToMesh references
  const referencedMeshes = new Set<string>();
  for (const meshList of Object.values(config.morphToMesh || {})) {
    for (const meshName of meshList) {
      referencedMeshes.add(meshName);
    }
  }

  const missingMeshes: string[] = [];
  const foundMeshes: string[] = [];
  for (const meshName of referencedMeshes) {
    if (modelMeshes.has(meshName)) {
      foundMeshes.push(meshName);
    } else {
      missingMeshes.push(meshName);
    }
  }

  const unmappedMeshes: string[] = [];
  for (const meshName of modelMeshes) {
    if (!referencedMeshes.has(meshName)) {
      unmappedMeshes.push(meshName);
    }
  }

  if (missingMeshes.length > 0) {
    warnings.push(`Some morphToMesh entries were not found on the model`);
  }

  // Validate eye mesh nodes if provided
  if (config.eyeMeshNodes) {
    const left = config.eyeMeshNodes.LEFT;
    const right = config.eyeMeshNodes.RIGHT;
    const leftOk = modelMeshes.has(left) || modelBones.has(left);
    const rightOk = modelMeshes.has(right) || modelBones.has(right);
    if (!leftOk) {
      warnings.push(`Eye mesh node LEFT ("${left}") was not found on the model`);
    }
    if (!rightOk) {
      warnings.push(`Eye mesh node RIGHT ("${right}") was not found on the model`);
    }
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

  const result: ValidationResult = {
    valid,
    score,
    missingMorphs: morphResult.missing,
    missingBones: boneResult.missing,
    foundMorphs: morphResult.found,
    foundBones: boneResult.found,
    unmappedMorphs,
    unmappedBones,
    missingMeshes,
    foundMeshes,
    unmappedMeshes,
    warnings,
  };

  if (options.suggestCorrections) {
    const correctionResult = generateMappingCorrections(
      meshes,
      skeleton,
      config,
      options
    );
    result.suggestedConfig = correctionResult.correctedConfig;
    result.corrections = correctionResult.corrections;
    result.unresolved = correctionResult.unresolved;
  }

  return result;
}

/**
 * Quick check if a preset is compatible with a model.
 * Returns true if at least 50% of mappings are found.
 */
export function isPresetCompatible(
  meshes: MorphMesh[],
  skeleton: Skeleton | null,
  config: Profile
): boolean {
  const result = validateMappings(meshes, skeleton, config);
  return result.score >= 50;
}

/**
 * Suggest the best preset from a list based on validation scores.
 */
export function suggestBestPreset<T extends Profile>(
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
