/**
 * LoomLarge - Mapping Corrections
 *
 * Attempts to generate a corrected mapping configuration using fuzzy matching.
 * This is a best-effort helper that can be layered on top of validation.
 */

import type { AUMappingConfig } from '../mappings/types';

interface MorphMesh {
  name: string;
  morphTargetDictionary?: Record<string, number>;
  morphTargetInfluences?: number[];
}

interface Skeleton {
  bones: Array<{ name: string }>;
}

export interface MappingCorrection {
  type: 'bone' | 'morph' | 'viseme' | 'mesh';
  source: string;
  target: string;
  confidence: number;
  reason: string;
  applied: boolean;
  auId?: number;
  key?: string;
}

export interface MappingCorrectionResult {
  correctedConfig: AUMappingConfig;
  corrections: MappingCorrection[];
  unresolved: MappingCorrection[];
}

export interface MappingCorrectionOptions {
  minConfidence?: number;
  /**
   * When true, normalize names to resolved full names and clear prefix/suffix.
   * This is useful when target names don't follow the prefix/suffix pattern.
   */
  useResolvedNames?: boolean;
}

const DEFAULT_MIN_CONFIDENCE = 0.6;

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  const aLen = a.length;
  const bLen = b.length;

  for (let i = 0; i <= bLen; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= aLen; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= bLen; i++) {
    for (let j = 1; j <= aLen; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[bLen][aLen];
}

function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  return 1 - distance / maxLen;
}

function scoreCandidate(
  targetBase: string,
  candidate: string,
  fullTarget: string,
  suffixPattern: RegExp | null
): { score: number; reason: string } {
  if (candidate === fullTarget) {
    return { score: 1, reason: 'exact match' };
  }

  if (suffixPattern && candidate.startsWith(fullTarget)) {
    const suffix = candidate.slice(fullTarget.length);
    if (suffix === '' || suffixPattern.test(suffix)) {
      return { score: 0.95, reason: 'suffix match' };
    }
  }

  const fullScore = stringSimilarity(candidate, fullTarget);
  const baseScore = stringSimilarity(candidate, targetBase);
  const score = Math.max(fullScore, baseScore);
  const reason = fullScore >= baseScore ? 'similar full name' : 'similar base name';
  return { score, reason };
}

function deriveBaseName(candidate: string, prefix: string, suffix: string): string | null {
  const hasPrefix = prefix && candidate.startsWith(prefix);
  const hasSuffix = suffix && candidate.endsWith(suffix);
  if (hasPrefix && hasSuffix) {
    return candidate.slice(prefix.length, candidate.length - suffix.length);
  }
  if (prefix === '' && suffix === '') {
    return candidate;
  }
  return null;
}

function findBestMatch(
  targetBase: string,
  candidates: Set<string>,
  prefix: string,
  suffix: string,
  suffixPattern: RegExp | null
): { candidate: string; confidence: number; reason: string } | null {
  const fullTarget = prefix + targetBase + suffix;
  let best: { candidate: string; confidence: number; reason: string } | null = null;

  for (const candidate of candidates) {
    const { score, reason } = scoreCandidate(targetBase, candidate, fullTarget, suffixPattern);
    if (!best || score > best.confidence) {
      best = { candidate, confidence: score, reason };
    }
  }

  return best;
}

function collectModelAssets(meshes: MorphMesh[], skeleton: Skeleton | null) {
  const modelMorphs = new Set<string>();
  const modelMeshes = new Set<string>();
  for (const mesh of meshes) {
    if (mesh.name) modelMeshes.add(mesh.name);
    if (mesh.morphTargetDictionary) {
      for (const morphName of Object.keys(mesh.morphTargetDictionary)) {
        modelMorphs.add(morphName);
      }
    }
  }

  const modelBones = new Set<string>();
  if (skeleton?.bones) {
    for (const bone of skeleton.bones) {
      if (bone.name) modelBones.add(bone.name);
    }
  }

  return { modelMorphs, modelMeshes, modelBones };
}

export function generateMappingCorrections(
  meshes: MorphMesh[],
  skeleton: Skeleton | null,
  config: AUMappingConfig,
  options: MappingCorrectionOptions = {}
): MappingCorrectionResult {
  const { minConfidence = DEFAULT_MIN_CONFIDENCE, useResolvedNames = false } = options;
  const suffixPattern = config.suffixPattern ? new RegExp(config.suffixPattern) : null;
  const bonePrefix = config.bonePrefix || '';
  const boneSuffix = config.boneSuffix || '';
  const morphPrefix = config.morphPrefix || '';
  const morphSuffix = config.morphSuffix || '';

  const { modelMorphs, modelMeshes, modelBones } = collectModelAssets(meshes, skeleton);

  const corrections: MappingCorrection[] = [];
  const unresolved: MappingCorrection[] = [];

  const correctedConfig: AUMappingConfig = {
    ...config,
    boneNodes: { ...config.boneNodes },
    auToMorphs: { ...config.auToMorphs },
    morphToMesh: { ...config.morphToMesh },
    visemeKeys: [...config.visemeKeys],
  };

  if (useResolvedNames) {
    correctedConfig.bonePrefix = '';
    correctedConfig.boneSuffix = '';
    correctedConfig.morphPrefix = '';
    correctedConfig.morphSuffix = '';
  }

  // Bone nodes corrections
  for (const [semanticKey, baseName] of Object.entries(config.boneNodes)) {
    const match = findBestMatch(baseName, modelBones, bonePrefix, boneSuffix, suffixPattern);
    if (!match || match.confidence < minConfidence) {
      unresolved.push({
        type: 'bone',
        source: baseName,
        target: baseName,
        confidence: match?.confidence ?? 0,
        reason: match?.reason ?? 'no match',
        applied: false,
        key: semanticKey,
      });
      continue;
    }

    const derivedBase = deriveBaseName(match.candidate, bonePrefix, boneSuffix);
    const resolvedName = useResolvedNames || !derivedBase ? match.candidate : derivedBase;
    const canApply = useResolvedNames || derivedBase !== null;

    if (canApply && resolvedName !== baseName) {
      correctedConfig.boneNodes[semanticKey] = resolvedName;
    }

    corrections.push({
      type: 'bone',
      source: baseName,
      target: match.candidate,
      confidence: match.confidence,
      reason: match.reason,
      applied: canApply && resolvedName !== baseName,
      key: semanticKey,
    });
  }

  // Morph corrections (AU morphs + visemes)
  const updateMorphList = (items: string[], auId?: number): string[] => {
    return items.map((morphName) => {
      if (modelMorphs.has(morphName)) return morphName;

      const match = findBestMatch(morphName, modelMorphs, morphPrefix, morphSuffix, suffixPattern);
      if (!match || match.confidence < minConfidence) {
        unresolved.push({
          type: 'morph',
          source: morphName,
          target: morphName,
          confidence: match?.confidence ?? 0,
          reason: match?.reason ?? 'no match',
          applied: false,
          auId,
        });
        return morphName;
      }

      const derivedBase = deriveBaseName(match.candidate, morphPrefix, morphSuffix);
      const resolvedName = useResolvedNames || !derivedBase ? match.candidate : derivedBase;
      const canApply = useResolvedNames || derivedBase !== null;

      corrections.push({
        type: 'morph',
        source: morphName,
        target: match.candidate,
        confidence: match.confidence,
        reason: match.reason,
        applied: canApply && resolvedName !== morphName,
        auId,
      });

      return canApply ? resolvedName : morphName;
    });
  };

  for (const [auIdStr, morphs] of Object.entries(config.auToMorphs)) {
    const auId = Number(auIdStr);
    correctedConfig.auToMorphs[auId] = updateMorphList(morphs, auId);
  }

  correctedConfig.visemeKeys = updateMorphList(config.visemeKeys);

  // morphToMesh corrections
  for (const [category, meshList] of Object.entries(config.morphToMesh || {})) {
    correctedConfig.morphToMesh[category] = meshList.map((meshName) => {
      if (modelMeshes.has(meshName)) return meshName;

      const match = findBestMatch(meshName, modelMeshes, '', '', suffixPattern);
      if (!match || match.confidence < minConfidence) {
        unresolved.push({
          type: 'mesh',
          source: meshName,
          target: meshName,
          confidence: match?.confidence ?? 0,
          reason: match?.reason ?? 'no match',
          applied: false,
          key: category,
        });
        return meshName;
      }

      corrections.push({
        type: 'mesh',
        source: meshName,
        target: match.candidate,
        confidence: match.confidence,
        reason: match.reason,
        applied: match.candidate !== meshName,
        key: category,
      });

      return match.candidate;
    });
  }

  return {
    correctedConfig,
    corrections,
    unresolved,
  };
}
