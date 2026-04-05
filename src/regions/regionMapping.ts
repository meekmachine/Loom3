import * as THREE from 'three';

import type { CharacterConfig, Region } from '../characters/types';
import { findFaceCenter } from '../validation/geometryHelpers';

export interface ResolvedFaceCenter {
  center: THREE.Vector3;
  method: string;
  debugInfo: string[];
}

function normalizeLooseName(value: string): string {
  return value.replace(/\./g, '');
}

function resolveBoneNameCandidates(semanticName: string, config?: CharacterConfig): string[] {
  if (!config) return [semanticName];

  const { bonePrefix, boneSuffix, boneNodes } = config;
  if (!boneNodes || !boneNodes[semanticName]) {
    return [semanticName];
  }

  const baseName = boneNodes[semanticName];
  const prefix = bonePrefix || '';
  const suffix = boneSuffix || '';

  if (!prefix && !suffix) {
    return [baseName];
  }

  const prefixedBase = prefix && baseName.startsWith(prefix) ? baseName : prefix + baseName;
  const fullyAffixed = suffix && !prefixedBase.endsWith(suffix) ? `${prefixedBase}${suffix}` : prefixedBase;

  return Array.from(new Set([fullyAffixed, baseName]));
}

export function resolveBoneName(semanticName: string, config?: CharacterConfig): string {
  return resolveBoneNameCandidates(semanticName, config)[0] ?? semanticName;
}

export function resolveBoneNames(
  names: string[] | undefined,
  config?: CharacterConfig
): string[] {
  if (!names || names.length === 0) return [];
  return Array.from(
    new Set(
      names.flatMap((name) => resolveBoneNameCandidates(name, config))
    )
  );
}

export function fuzzyNameMatch(
  objectName: string,
  targetName: string,
  suffixPattern?: string
): boolean {
  if (objectName === targetName) return true;
  if (normalizeLooseName(objectName) === normalizeLooseName(targetName)) return true;
  if (!objectName.startsWith(targetName)) return false;
  const suffix = objectName.slice(targetName.length);
  if (suffix === '') return true;
  const regex = suffixPattern ? new RegExp(suffixPattern) : /^[_\.]\d+$/;
  return regex.test(suffix);
}

export function resolveFaceCenter(
  model: THREE.Object3D,
  region: Region,
  config?: CharacterConfig
): ResolvedFaceCenter {
  const resolvedBones = resolveBoneNames(region.bones, config);
  const headBoneNames = resolvedBones.filter((name) => name.toLowerCase().includes('head'));

  const result = findFaceCenter(model, {
    headBoneNames: headBoneNames.length > 0 ? headBoneNames : undefined,
    faceMeshNames: region.meshes && region.meshes.length > 0 ? region.meshes : undefined,
  });

  return {
    center: result.center,
    method: result.method,
    debugInfo: result.debugInfo,
  };
}
