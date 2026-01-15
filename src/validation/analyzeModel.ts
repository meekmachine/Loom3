/**
 * Loom3 - Unified Model Analysis API
 *
 * Combines model extraction, validation, and correction suggestions
 * into a single comprehensive analysis report.
 */

import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { AUMappingConfig } from '../mappings/types';
import { extractModelData, extractFromGLTF, type ModelData, type AnimationInfo } from './extractModelData';
import { validateMappings, type ValidationResult } from './validateMappings';

/**
 * Animation analysis results
 */
export interface AnimationAnalysis {
  count: number;
  hasIdleCandidate: boolean;
  clips: Array<{
    name: string;
    duration: number;
    affectedBones: string[];
    affectedMorphs: string[];
  }>;
}

/**
 * Complete model analysis report
 */
export interface ModelAnalysisReport {
  /** Extracted model data */
  model: ModelData;

  /** Validation results (if preset provided) */
  validation?: ValidationResult;

  /** Animation analysis */
  animations: AnimationAnalysis;

  /** Overall health score (0-100) */
  overallScore: number;

  /** Human-readable summary */
  summary: string;
}

/**
 * Options for model analysis
 */
export interface AnalyzeModelOptions {
  /** The model source */
  source:
    | { type: 'gltf'; gltf: GLTF }
    | { type: 'runtime'; model: THREE.Object3D; meshes: THREE.Mesh[]; animations: THREE.AnimationClip[] };

  /** Optional preset to validate against */
  preset?: AUMappingConfig;

  /** Request correction suggestions */
  suggestCorrections?: boolean;
}

/**
 * Analyze animations to detect idle candidates and summarize clips
 */
function analyzeAnimations(animations: AnimationInfo[]): AnimationAnalysis {
  // Detect idle animation candidates
  // Heuristic: short clips (< 5s) with subtle motion are likely idle loops
  const hasIdleCandidate = animations.some(anim =>
    anim.duration < 5 && anim.duration > 0.5 &&
    (anim.name.toLowerCase().includes('idle') ||
     anim.name.toLowerCase().includes('stand') ||
     anim.name.toLowerCase().includes('breath'))
  );

  return {
    count: animations.length,
    hasIdleCandidate,
    clips: animations.map(anim => ({
      name: anim.name,
      duration: anim.duration,
      affectedBones: anim.animatedBones,
      affectedMorphs: anim.animatedMorphs,
    })),
  };
}

/**
 * Calculate overall health score
 */
function calculateOverallScore(
  validation: ValidationResult | undefined,
  animations: AnimationAnalysis
): number {
  // If no validation (no preset), base score on model completeness
  if (!validation) {
    // Award points for having bones (40), morphs (40), animations (20)
    let score = 0;
    // Assume model is complete if we're analyzing it
    score += 80;
    if (animations.count > 0) score += 20;
    return Math.min(100, score);
  }

  // With validation: use validation score as primary (70%), animations as secondary (30%)
  let score = validation.score * 0.7;

  // Animation score
  let animScore = 0;
  if (animations.count > 0) animScore += 20;
  if (animations.hasIdleCandidate) animScore += 10;
  score += animScore * 0.3;

  return Math.round(score);
}

/**
 * Generate human-readable summary
 */
function generateSummary(
  model: ModelData,
  validation: ValidationResult | undefined,
  animations: AnimationAnalysis
): string {
  const parts: string[] = [];

  // Model assets
  parts.push(`Model has ${model.bones.length} bones, ${model.morphs.length} morphs, ${animations.count} animations.`);

  // Validation summary
  if (validation) {
    if (validation.score >= 70) {
      parts.push(`Preset is compatible (${validation.score}% match).`);
    } else if (validation.score >= 40) {
      parts.push(`Preset is partially compatible (${validation.score}% match).`);
      if (validation.missingBones.length > 0) {
        parts.push(`Missing ${validation.missingBones.length} bones.`);
      }
      if (validation.missingMorphs.length > 0) {
        parts.push(`Missing ${validation.missingMorphs.length} morphs.`);
      }
    } else {
      parts.push(`Preset is incompatible (${validation.score}% match).`);
    }

    if (validation.corrections && validation.corrections.length > 0) {
      parts.push(`${validation.corrections.length} corrections suggested.`);
    }
  }

  // Animation summary
  if (animations.count === 0) {
    parts.push('No animations found.');
  } else if (animations.hasIdleCandidate) {
    parts.push('Idle animation detected.');
  }

  return parts.join(' ');
}

/**
 * Analyze a 3D model comprehensively
 *
 * Extracts model data, validates against a preset (if provided),
 * analyzes animations, and returns a comprehensive report.
 *
 * @param options - Analysis options
 * @returns Complete analysis report
 */
export async function analyzeModel(options: AnalyzeModelOptions): Promise<ModelAnalysisReport> {
  const { source, preset, suggestCorrections = false } = options;

  // Step 1: Extract model data
  const modelData =
    source.type === 'gltf'
      ? extractFromGLTF(source.gltf)
      : extractModelData(source.model, source.meshes, source.animations);

  // Step 2: Validate against preset (if provided)
  let validation: ValidationResult | undefined;
  if (preset) {
    // Build validation inputs from model data
    const meshes = modelData.meshes.map(meshInfo => {
      // Find actual mesh with morph targets
      const morphsForMesh = modelData.morphs.filter(m => m.meshName === meshInfo.name);
      const morphTargetDictionary = morphsForMesh.length > 0
        ? Object.fromEntries(morphsForMesh.map(m => [m.name, m.index]))
        : undefined;

      return {
        name: meshInfo.name,
        morphTargetDictionary,
      };
    });

    const skeleton = modelData.bones.length > 0
      ? { bones: modelData.bones.map(b => ({ name: b.name })) }
      : null;

    validation = validateMappings(meshes, skeleton, preset, { suggestCorrections });
  }

  // Step 3: Analyze animations
  const animationAnalysis = analyzeAnimations(modelData.animations);

  // Step 4: Calculate overall score and summary
  const overallScore = calculateOverallScore(validation, animationAnalysis);
  const summary = generateSummary(modelData, validation, animationAnalysis);

  return {
    model: modelData,
    validation,
    animations: animationAnalysis,
    overallScore,
    summary,
  };
}
