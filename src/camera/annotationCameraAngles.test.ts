import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  detectAnnotationLaterality,
  getModelLocalOrbitAngle,
  getWorldDirectionForCameraAngle,
  passesMarkerCameraAngleGate,
  resolveRegionCameraAngle,
  resolveRegionVisibilityCameraAngle,
} from './annotationCameraAngles';
import type { Region } from '../regions/types';

function createModel(rotationYDegrees = 0): THREE.Group {
  const model = new THREE.Group();
  model.rotation.y = THREE.MathUtils.degToRad(rotationYDegrees);
  model.updateMatrixWorld(true);
  return model;
}

describe('annotationCameraAngles', () => {
  it('detects semantic laterality from paired region custom positions', () => {
    const regions: Region[] = [
      { name: 'left_eye', customPosition: { x: 1, y: 0, z: 0 } },
      { name: 'right_eye', customPosition: { x: -1, y: 0, z: 0 } },
    ];

    const laterality = detectAnnotationLaterality(createModel(), regions, null);

    expect(laterality.leftSideX).toBe(1);
    expect(laterality.confidence).toBeGreaterThan(0);
  });

  it('resolves side camera angles through detected laterality', () => {
    const laterality = { leftSideX: 1 as const, confidence: 1, evidence: [] };

    expect(resolveRegionCameraAngle({ name: 'left_hand', cameraAngle: 270 }, laterality)).toBe(90);
    expect(resolveRegionCameraAngle({ name: 'right_hand', cameraAngle: 90 }, laterality)).toBe(270);
    expect(resolveRegionCameraAngle({ name: 'back', cameraAngle: 180 }, laterality)).toBe(180);
  });

  it('infers visibility angles for nested side regions', () => {
    const laterality = { leftSideX: -1 as const, confidence: 1, evidence: [] };

    expect(resolveRegionVisibilityCameraAngle({ name: 'left_eye', parent: 'head' }, laterality)).toBe(270);
    expect(resolveRegionVisibilityCameraAngle({ name: 'right_eye', parent: 'head' }, laterality)).toBe(90);
    expect(resolveRegionVisibilityCameraAngle({ name: 'left_eye' }, laterality)).toBeUndefined();
  });

  it('converts model-local camera angles to world directions', () => {
    const model = createModel(180);
    const direction = getWorldDirectionForCameraAngle(model, 90);

    expect(direction.x).toBeCloseTo(-1, 5);
    expect(direction.z).toBeCloseTo(0, 5);
  });

  it('computes local orbit angle from world camera position', () => {
    const model = createModel(180);
    const angle = getModelLocalOrbitAngle(model, new THREE.Vector3(0, 0, 0), new THREE.Vector3(-1, 0, 0));

    expect(angle).toBeCloseTo(90, 5);
  });

  it('gates marker visibility by angular range', () => {
    expect(passesMarkerCameraAngleGate({ markerAngle: 45, currentCameraAngle: 45 })).toBe(true);
    expect(passesMarkerCameraAngleGate({ markerAngle: 45, currentCameraAngle: 200 })).toBe(false);
    expect(passesMarkerCameraAngleGate({ markerAngle: undefined, currentCameraAngle: 200 })).toBe(true);
  });
});
