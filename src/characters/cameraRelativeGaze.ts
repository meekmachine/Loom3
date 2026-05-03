import * as THREE from 'three';

export type CameraRelativeGazeOffset = { x: number; y: number };

export interface CameraRelativeGazeOptions {
  yawWeight?: number;
  pitchWeight?: number;
  epsilon?: number;
}

const DEFAULT_EPSILON = 1e-4;
const DEFAULT_YAW_WEIGHT = 0.35;
const DEFAULT_PITCH_WEIGHT = 0.2;
const ZERO_OFFSET: CameraRelativeGazeOffset = { x: 0, y: 0 };

function clampOffset(value: number): number {
  return THREE.MathUtils.clamp(value, -1, 1);
}

function toModelLocalDirection(
  model: THREE.Object3D,
  worldDirection: THREE.Vector3
): THREE.Vector3 {
  const localDirection = worldDirection.clone();

  model.updateWorldMatrix(true, false);
  const worldQuaternion = new THREE.Quaternion();
  model.getWorldQuaternion(worldQuaternion);
  localDirection.applyQuaternion(worldQuaternion.invert());

  return localDirection.normalize();
}

/**
 * Convert the current camera position into a normalized gaze offset in model-local space.
 * This is intentionally pure so apps can cache or subscribe to camera changes however they want.
 */
export function computeCameraRelativeGazeOffset(
  model: THREE.Object3D | null,
  cameraPosition: THREE.Vector3,
  targetPosition: THREE.Vector3,
  options: CameraRelativeGazeOptions = {}
): CameraRelativeGazeOffset {
  if (!model) {
    return ZERO_OFFSET;
  }

  const epsilon = options.epsilon ?? DEFAULT_EPSILON;
  const yawWeight = options.yawWeight ?? DEFAULT_YAW_WEIGHT;
  const pitchWeight = options.pitchWeight ?? DEFAULT_PITCH_WEIGHT;

  const worldOffset = new THREE.Vector3().subVectors(cameraPosition, targetPosition);
  if (worldOffset.lengthSq() < epsilon) {
    return ZERO_OFFSET;
  }

  const localDirection = toModelLocalDirection(model, worldOffset.normalize());
  const yawAngle = Math.atan2(localDirection.x, localDirection.z);
  const pitchAngle = Math.atan2(
    localDirection.y,
    Math.max(Math.hypot(localDirection.x, localDirection.z), epsilon)
  );

  return {
    x: clampOffset(yawAngle / (Math.PI / 2)) * yawWeight,
    y: clampOffset(pitchAngle / (Math.PI / 3)) * pitchWeight,
  };
}
