import * as THREE from 'three';

import type { Region } from './types';
import { findFaceCenter } from '../validation/geometryHelpers';

export interface BoneResolutionProfile {
  bonePrefix?: string;
  boneSuffix?: string;
  boneNodes?: Record<string, string>;
  suffixPattern?: string;
}

export interface ResolvedFaceCenter {
  center: THREE.Vector3;
  method: string;
  debugInfo: string[];
}

function normalizeLooseName(value: string): string {
  return value.replace(/\./g, '');
}

function resolveBoneNameCandidates(semanticName: string, profile?: BoneResolutionProfile): string[] {
  if (!profile) return [semanticName];

  const { bonePrefix, boneSuffix, boneNodes } = profile;
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

export function resolveBoneName(semanticName: string, profile?: BoneResolutionProfile): string {
  return resolveBoneNameCandidates(semanticName, profile)[0] ?? semanticName;
}

export function resolveBoneNames(
  names: string[] | undefined,
  profile?: BoneResolutionProfile
): string[] {
  if (!names || names.length === 0) return [];
  return Array.from(
    new Set(
      names.flatMap((name) => resolveBoneNameCandidates(name, profile))
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
  profile?: BoneResolutionProfile
): ResolvedFaceCenter {
  const resolvedBones = resolveBoneNames(region.bones, profile);
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
