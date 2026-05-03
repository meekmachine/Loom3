import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { computeCameraRelativeGazeOffset } from './cameraRelativeGaze';

function createModel(rotationYDegrees = 0): THREE.Group {
  const model = new THREE.Group();
  model.rotation.y = THREE.MathUtils.degToRad(rotationYDegrees);
  model.updateMatrixWorld(true);
  return model;
}

describe('cameraRelativeGaze', () => {
  it('returns a neutral offset when the camera is directly in front', () => {
    const model = createModel();
    const offset = computeCameraRelativeGazeOffset(
      model,
      new THREE.Vector3(0, 1, 3),
      new THREE.Vector3(0, 1, 0)
    );

    expect(offset.x).toBeCloseTo(0, 5);
    expect(offset.y).toBeCloseTo(0, 5);
  });

  it('returns a positive yaw offset when the camera moves to the model right side', () => {
    const model = createModel();
    const offset = computeCameraRelativeGazeOffset(
      model,
      new THREE.Vector3(3, 1, 3),
      new THREE.Vector3(0, 1, 0)
    );

    expect(offset.x).toBeGreaterThan(0.1);
  });

  it('respects the model orientation when converting camera position to local gaze offset', () => {
    const model = createModel(180);
    const offset = computeCameraRelativeGazeOffset(
      model,
      new THREE.Vector3(-3, 1, 3),
      new THREE.Vector3(0, 1, 0)
    );

    expect(offset.x).toBeGreaterThan(0.1);
  });
});
