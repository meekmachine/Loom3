import * as THREE from 'three';
import { fuzzyNameMatch, resolveBoneNames } from '../regions/regionMapping';
import type { BoneResolutionProfile } from '../regions/regionMapping';
import type { Region } from '../regions/types';

type SemanticSide = 'left' | 'right';

export interface AnnotationLaterality {
  leftSideX: 1 | -1;
  confidence: number;
  evidence: string[];
}

type LateralityRegion = Pick<Region, 'name' | 'cameraAngle' | 'parent'>;

const DEFAULT_LATERALITY: AnnotationLaterality = {
  leftSideX: -1,
  confidence: 0,
  evidence: ['default:left=-X'],
};

const SIDE_TOKEN_PATTERN = /(^|[_\s-])(left|right)(?=$|[_\s-])/i;
const MIN_LATERAL_SEPARATION = 1e-3;

function invertHorizontalSign(sign: 1 | -1): 1 | -1 {
  return sign === 1 ? -1 : 1;
}

function averagePoints(points: THREE.Vector3[]): THREE.Vector3 | null {
  if (points.length === 0) return null;

  const center = new THREE.Vector3();
  for (const point of points) {
    center.add(point);
  }
  return center.divideScalar(points.length);
}

function replaceSemanticSideToken(name: string, replacement: SemanticSide): string | null {
  const match = SIDE_TOKEN_PATTERN.exec(name);
  if (!match) return null;

  const [fullMatch, prefix] = match;
  const start = match.index;
  const end = start + fullMatch.length;
  return `${name.slice(0, start)}${prefix}${replacement}${name.slice(end)}`;
}

function collectMatchedPoints(
  model: THREE.Object3D,
  targetNames: string[],
  matcher: (obj: THREE.Object3D, targetName: string) => boolean,
  extractor: (obj: THREE.Object3D) => THREE.Vector3 | null
): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];

  for (const targetName of targetNames) {
    model.traverse((obj) => {
      if (!matcher(obj, targetName)) return;
      const point = extractor(obj);
      if (point) {
        points.push(point);
      }
    });
  }

  return points;
}

function getRegionWorldCenter(
  model: THREE.Object3D,
  region: Region,
  characterConfig: BoneResolutionProfile | null
): THREE.Vector3 | null {
  if (region.customPosition) {
    return new THREE.Vector3(
      region.customPosition.x,
      region.customPosition.y,
      region.customPosition.z
    );
  }

  if (region.objects?.includes('*')) {
    return null;
  }

  const suffixPattern = characterConfig?.suffixPattern;
  const points: THREE.Vector3[] = [];

  if (region.bones?.length) {
    const boneNames = resolveBoneNames(region.bones, characterConfig ?? undefined);
    points.push(
      ...collectMatchedPoints(
        model,
        boneNames,
        (obj, targetName) => fuzzyNameMatch(obj.name, targetName, suffixPattern),
        (obj) => {
          const worldPos = new THREE.Vector3();
          obj.getWorldPosition(worldPos);
          return worldPos;
        }
      )
    );
  }

  if (region.meshes?.length) {
    points.push(
      ...collectMatchedPoints(
        model,
        region.meshes,
        (obj, targetName) =>
          (obj as THREE.Mesh).isMesh && fuzzyNameMatch(obj.name, targetName, suffixPattern),
        (obj) => {
          const box = new THREE.Box3().setFromObject(obj);
          if (box.isEmpty()) {
            return null;
          }
          return box.getCenter(new THREE.Vector3());
        }
      )
    );
  }

  if (region.objects?.length) {
    const objectTargets = region.objects.filter((target) => target !== '*');
    points.push(
      ...collectMatchedPoints(
        model,
        objectTargets,
        (obj, targetName) => fuzzyNameMatch(obj.name, targetName, suffixPattern),
        (obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const box = new THREE.Box3().setFromObject(obj);
            if (!box.isEmpty()) {
              return box.getCenter(new THREE.Vector3());
            }
          }

          const worldPos = new THREE.Vector3();
          obj.getWorldPosition(worldPos);
          return worldPos;
        }
      )
    );
  }

  return averagePoints(points);
}

function getRegionLocalCenter(
  model: THREE.Object3D,
  region: Region,
  characterConfig: BoneResolutionProfile | null
): THREE.Vector3 | null {
  const worldCenter = getRegionWorldCenter(model, region, characterConfig);
  return worldCenter ? model.worldToLocal(worldCenter.clone()) : null;
}

function cloneLaterality(value: AnnotationLaterality): AnnotationLaterality {
  return {
    leftSideX: value.leftSideX,
    confidence: value.confidence,
    evidence: [...value.evidence],
  };
}

export function getDefaultAnnotationLaterality(): AnnotationLaterality {
  return cloneLaterality(DEFAULT_LATERALITY);
}

export function normalizeCameraAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

export function getRegionSemanticSide(regionName?: string): SemanticSide | null {
  if (!regionName) return null;
  const match = SIDE_TOKEN_PATTERN.exec(regionName);
  if (!match) return null;
  return match[2].toLowerCase() === 'left' ? 'left' : 'right';
}

export function getSemanticHorizontalSign(
  regionName: string,
  laterality: AnnotationLaterality
): 1 | -1 | null {
  const side = getRegionSemanticSide(regionName);
  if (side === 'left') return laterality.leftSideX;
  if (side === 'right') return invertHorizontalSign(laterality.leftSideX);
  return null;
}

export function getSemanticHorizontalSignForSide(
  side: SemanticSide,
  laterality: AnnotationLaterality
): 1 | -1 {
  return side === 'left' ? laterality.leftSideX : invertHorizontalSign(laterality.leftSideX);
}

export function detectAnnotationLaterality(
  model: THREE.Object3D | null,
  regions: Region[],
  characterConfig: BoneResolutionProfile | null
): AnnotationLaterality {
  if (!model || regions.length === 0) {
    return getDefaultAnnotationLaterality();
  }

  model.updateMatrixWorld(true);

  const regionsByName = new Map(
    regions.map((region) => [region.name.toLowerCase(), region])
  );

  const votes: Array<{ sign: 1 | -1; weight: number; evidence: string }> = [];
  const pairedKeys = new Set<string>();

  for (const region of regions) {
    if (getRegionSemanticSide(region.name) !== 'left') continue;

    const mirroredName = replaceSemanticSideToken(region.name, 'right');
    if (!mirroredName) continue;

    const other = regionsByName.get(mirroredName.toLowerCase());
    if (!other) continue;

    const pairKey = [region.name.toLowerCase(), other.name.toLowerCase()].sort().join('|');
    if (pairedKeys.has(pairKey)) continue;
    pairedKeys.add(pairKey);

    const leftCenter = getRegionLocalCenter(model, region, characterConfig);
    const rightCenter = getRegionLocalCenter(model, other, characterConfig);
    if (!leftCenter || !rightCenter) continue;

    const separation = Math.abs(leftCenter.x - rightCenter.x);
    if (separation < MIN_LATERAL_SEPARATION) continue;

    votes.push({
      sign: leftCenter.x > rightCenter.x ? 1 : -1,
      weight: separation,
      evidence: `pair:${region.name}/${other.name}:${leftCenter.x.toFixed(3)}/${rightCenter.x.toFixed(3)}`,
    });
  }

  if (votes.length === 0) {
    for (const region of regions) {
      const side = getRegionSemanticSide(region.name);
      if (!side) continue;

      const center = getRegionLocalCenter(model, region, characterConfig);
      if (!center || Math.abs(center.x) < MIN_LATERAL_SEPARATION) continue;

      const sign = side === 'left'
        ? (center.x > 0 ? 1 : -1)
        : (center.x > 0 ? -1 : 1);

      votes.push({
        sign,
        weight: Math.abs(center.x),
        evidence: `single:${region.name}:${center.x.toFixed(3)}`,
      });
    }
  }

  if (votes.length === 0) {
    return getDefaultAnnotationLaterality();
  }

  let signedWeight = 0;
  let totalWeight = 0;
  for (const vote of votes) {
    signedWeight += vote.sign * vote.weight;
    totalWeight += vote.weight;
  }

  if (Math.abs(signedWeight) < MIN_LATERAL_SEPARATION) {
    return getDefaultAnnotationLaterality();
  }

  return {
    leftSideX: signedWeight > 0 ? 1 : -1,
    confidence: totalWeight > 0 ? Math.abs(signedWeight) / totalWeight : 0,
    evidence: votes.map((vote) => vote.evidence),
  };
}

export function resolveRegionCameraAngle(
  region: LateralityRegion,
  laterality: AnnotationLaterality
): number | undefined {
  if (region.cameraAngle === undefined) {
    return undefined;
  }

  const normalizedAngle = normalizeCameraAngle(region.cameraAngle);
  const side = getRegionSemanticSide(region.name);

  if (side && (normalizedAngle === 90 || normalizedAngle === 270)) {
    return side === 'left'
      ? (laterality.leftSideX > 0 ? 90 : 270)
      : (laterality.leftSideX > 0 ? 270 : 90);
  }

  return normalizedAngle;
}

export function resolveRegionVisibilityCameraAngle(
  region: LateralityRegion,
  laterality: AnnotationLaterality
): number | undefined {
  const explicitAngle = resolveRegionCameraAngle(region, laterality);
  if (explicitAngle !== undefined) {
    return explicitAngle;
  }

  if (!region.parent) {
    return undefined;
  }

  const side = getRegionSemanticSide(region.name);
  if (!side) {
    return undefined;
  }

  return side === 'left'
    ? (laterality.leftSideX > 0 ? 90 : 270)
    : (laterality.leftSideX > 0 ? 270 : 90);
}

export function toWorldDirection(
  model: THREE.Object3D | null,
  localDirection: THREE.Vector3
): THREE.Vector3 {
  const worldDirection = localDirection.clone();

  if (model) {
    model.updateMatrixWorld(true);
    const worldQuaternion = new THREE.Quaternion();
    model.getWorldQuaternion(worldQuaternion);
    worldDirection.applyQuaternion(worldQuaternion);
  }

  return worldDirection.normalize();
}

export function toModelLocalDirection(
  model: THREE.Object3D | null,
  worldDirection: THREE.Vector3
): THREE.Vector3 {
  const localDirection = worldDirection.clone();

  if (model) {
    model.updateMatrixWorld(true);
    const worldQuaternion = new THREE.Quaternion();
    model.getWorldQuaternion(worldQuaternion);
    localDirection.applyQuaternion(worldQuaternion.invert());
  }

  return localDirection.normalize();
}

export function getWorldDirectionForCameraAngle(
  model: THREE.Object3D | null,
  cameraAngle: number
): THREE.Vector3 {
  const angleRad = (normalizeCameraAngle(cameraAngle) * Math.PI) / 180;
  return toWorldDirection(
    model,
    new THREE.Vector3(Math.sin(angleRad), 0, Math.cos(angleRad))
  );
}

export function getModelLocalOrbitAngle(
  model: THREE.Object3D | null,
  modelCenter: THREE.Vector3,
  worldPosition: THREE.Vector3
): number {
  const worldOffset = new THREE.Vector3().subVectors(worldPosition, modelCenter);
  const localOffset = toModelLocalDirection(model, worldOffset);
  return normalizeCameraAngle(Math.atan2(localOffset.x, localOffset.z) * (180 / Math.PI));
}

export function passesMarkerCameraAngleGate(params: {
  markerAngle?: number;
  currentCameraAngle?: number;
  rangeDegrees?: number;
}): boolean {
  const { markerAngle, currentCameraAngle, rangeDegrees = 90 } = params;
  if (markerAngle === undefined || markerAngle === 0 || currentCameraAngle === undefined) {
    return true;
  }

  let diff = Math.abs(currentCameraAngle - markerAngle);
  if (diff > 180) diff = 360 - diff;
  return diff <= rangeDegrees;
}
