/**
 * Loom3 - Geometry Helpers
 *
 * Helper functions for finding face positions, annotation centers,
 * and other geometry-related calculations for character models.
 */

import * as THREE from 'three';

/**
 * Result of finding a face center position
 */
export interface FaceCenterResult {
  /** The calculated face center position in world space */
  center: THREE.Vector3;
  /** The head bone position (if found) */
  headBonePosition?: THREE.Vector3;
  /** How the center was determined */
  method: 'head-bone-offset' | 'bone-average' | 'mesh-center' | 'fallback';
  /** Debug info about what was found */
  debugInfo: string[];
}

/**
 * Options for finding face center
 */
export interface FindFaceCenterOptions {
  /** Names of bones to search for head bone (e.g., ['CC_Base_Head']) */
  headBoneNames?: string[];
  /** Names of face meshes - when provided, uses mesh bounding box center for positioning */
  faceMeshNames?: string[];
  /** Forward offset from head bone to face surface (default: 0.08 = 8cm) */
  forwardOffset?: number;
  /** Reference model height for scaling (default: 1.8m) */
  referenceHeight?: number;
}

const DEFAULT_HEAD_BONE_NAMES = ['CC_Base_Head', 'Head', 'head', 'Bip01_Head'];
const DEFAULT_REFERENCE_HEIGHT = 1.8;
const DEFAULT_FORWARD_OFFSET = 0.08; // 8cm forward from head bone

// Eye bone names for detecting forward direction
const EYE_BONE_NAMES = {
  left: ['CC_Base_L_Eye', 'LeftEye', 'Eye_L', 'L_Eye'],
  right: ['CC_Base_R_Eye', 'RightEye', 'Eye_R', 'R_Eye'],
};

/**
 * Find the center position of a character's face.
 *
 * Strategy:
 * 1. If face mesh names provided and they're face-only meshes, use mesh center
 * 2. Otherwise find head bone and use EYE positions to determine forward direction
 *    (Eyes are reliably IN FRONT of the head bone, unlike jaw which is below)
 *
 * @param model - The root Object3D of the character model
 * @param options - Configuration options
 * @returns FaceCenterResult with the calculated position
 */
export function findFaceCenter(
  model: THREE.Object3D,
  options: FindFaceCenterOptions = {}
): FaceCenterResult {
  const {
    headBoneNames = DEFAULT_HEAD_BONE_NAMES,
    faceMeshNames,
    forwardOffset = DEFAULT_FORWARD_OFFSET,
    referenceHeight = DEFAULT_REFERENCE_HEIGHT,
  } = options;

  const debugInfo: string[] = [];

  // Calculate model size for scaling
  const boundingBox = new THREE.Box3().setFromObject(model);
  const modelSize = new THREE.Vector3();
  boundingBox.getSize(modelSize);
  const scale = modelSize.y / referenceHeight;

  debugInfo.push(`Model height: ${modelSize.y.toFixed(2)}m, scale factor: ${scale.toFixed(2)}`);

  // Helper to find head bone
  const findHeadBone = (): THREE.Vector3 | null => {
    let headPos: THREE.Vector3 | null = null;
    model.traverse((obj) => {
      if (headPos) return;
      const objName = obj.name.toLowerCase();
      for (const boneName of headBoneNames) {
        if (objName === boneName.toLowerCase() || objName.includes(boneName.toLowerCase())) {
          headPos = new THREE.Vector3();
          obj.getWorldPosition(headPos);
          debugInfo.push(`Found head bone "${obj.name}" at (${headPos.x.toFixed(3)}, ${headPos.y.toFixed(3)}, ${headPos.z.toFixed(3)})`);
          return;
        }
      }
    });
    return headPos;
  };

  // Helper to find eye positions - eyes are IN FRONT of head bone
  const findEyes = (): { left: THREE.Vector3 | null; right: THREE.Vector3 | null } => {
    const eyes: { left: THREE.Vector3 | null; right: THREE.Vector3 | null } = {
      left: null,
      right: null,
    };

    model.traverse((obj) => {
      const objName = obj.name;

      if (!eyes.left) {
        for (const name of EYE_BONE_NAMES.left) {
          if (objName.includes(name)) {
            eyes.left = new THREE.Vector3();
            obj.getWorldPosition(eyes.left);
            debugInfo.push(`Found left eye "${obj.name}" at (${eyes.left.x.toFixed(3)}, ${eyes.left.y.toFixed(3)}, ${eyes.left.z.toFixed(3)})`);
            break;
          }
        }
      }

      if (!eyes.right) {
        for (const name of EYE_BONE_NAMES.right) {
          if (objName.includes(name)) {
            eyes.right = new THREE.Vector3();
            obj.getWorldPosition(eyes.right);
            debugInfo.push(`Found right eye "${obj.name}" at (${eyes.right.x.toFixed(3)}, ${eyes.right.y.toFixed(3)}, ${eyes.right.z.toFixed(3)})`);
            break;
          }
        }
      }
    });

    return eyes;
  };

  // PRIORITY 1: If face mesh names are provided, check if it's a face-only mesh
  if (faceMeshNames && faceMeshNames.length > 0) {
    debugInfo.push(`Looking for face meshes: ${faceMeshNames.join(', ')}`);

    const meshBox = new THREE.Box3();
    let foundMesh = false;

    model.traverse((obj) => {
      const isMesh = (obj as THREE.Mesh).isMesh;
      if (!isMesh) return;

      for (const meshName of faceMeshNames) {
        if (obj.name === meshName || obj.name.includes(meshName)) {
          const mesh = obj as THREE.Mesh;
          const tempBox = new THREE.Box3().setFromObject(mesh);
          meshBox.union(tempBox);
          foundMesh = true;
          debugInfo.push(`Found mesh: "${obj.name}"`);
          break;
        }
      }
    });

    if (foundMesh && !meshBox.isEmpty()) {
      const meshBoundsSize = new THREE.Vector3();
      meshBox.getSize(meshBoundsSize);

      // Check if this is a full-body mesh
      const isFullBodyMesh = meshBoundsSize.y > modelSize.y * 0.7;

      if (!isFullBodyMesh) {
        // Face-only mesh - use its center
        const meshCenter = new THREE.Vector3();
        meshBox.getCenter(meshCenter);
        debugInfo.push(`Using face mesh center: (${meshCenter.x.toFixed(3)}, ${meshCenter.y.toFixed(3)}, ${meshCenter.z.toFixed(3)})`);

        return {
          center: meshCenter,
          method: 'mesh-center',
          debugInfo,
        };
      }

      debugInfo.push(`Mesh is full-body (${meshBoundsSize.y.toFixed(2)}m), using eye-based direction instead`);
    }
  }

  // PRIORITY 2: Use eye positions to find face center
  // The midpoint between the eyes IS the face center (no offset needed)
  const eyes = findEyes();
  if (eyes.left && eyes.right) {
    const eyeCenter = new THREE.Vector3()
      .addVectors(eyes.left, eyes.right)
      .multiplyScalar(0.5);

    debugInfo.push(`Eye center (face position): (${eyeCenter.x.toFixed(3)}, ${eyeCenter.y.toFixed(3)}, ${eyeCenter.z.toFixed(3)})`);

    // Find head bone for reference
    const headPos = findHeadBone();

    return {
      center: eyeCenter,
      headBonePosition: headPos || undefined,
      method: 'head-bone-offset',
      debugInfo,
    };
  }

  // PRIORITY 3: Use head bone with default forward (+Z)
  const headPos = findHeadBone();
  if (headPos) {
    debugInfo.push('No eyes found, using head bone + default forward (+Z)');
    const scaledOffset = forwardOffset * scale;
    const faceCenter = headPos.clone();
    faceCenter.z += scaledOffset;

    debugInfo.push(`Face center: (${faceCenter.x.toFixed(3)}, ${faceCenter.y.toFixed(3)}, ${faceCenter.z.toFixed(3)})`);

    return {
      center: faceCenter,
      headBonePosition: headPos.clone(),
      method: 'head-bone-offset',
      debugInfo,
    };
  }

  // Fallback: use model bounding box center, offset upward for face
  debugInfo.push('No head bone found, using model center fallback');
  const modelCenter = new THREE.Vector3();
  boundingBox.getCenter(modelCenter);

  const headHeight = boundingBox.min.y + modelSize.y * 0.9;
  const fallbackCenter = new THREE.Vector3(modelCenter.x, headHeight, modelCenter.z);

  debugInfo.push(`Fallback center: (${fallbackCenter.x.toFixed(3)}, ${fallbackCenter.y.toFixed(3)}, ${fallbackCenter.z.toFixed(3)})`);

  return {
    center: fallbackCenter,
    method: 'fallback',
    debugInfo,
  };
}

/**
 * Get the forward direction of a model in world space.
 * Assumes the model's local forward is positive Z.
 *
 * @param model - The model to get forward direction for
 * @returns Normalized forward direction vector in world space
 */
export function getModelForwardDirection(model: THREE.Object3D): THREE.Vector3 {
  const forward = new THREE.Vector3(0, 0, 1);
  forward.applyQuaternion(model.quaternion);
  return forward.normalize();
}

/**
 * Check if a character model is facing forward (toward camera at origin).
 * Uses head/eye bone positions to determine facing direction.
 *
 * @param model - The character model
 * @param eyeBoneNames - Names of eye bones to search for
 * @returns 'forward' if facing camera, 'backward' if facing away, 'unknown' if can't determine
 */
export function detectFacingDirection(
  model: THREE.Object3D,
  eyeBoneNames: { left: string[]; right: string[] } = {
    left: ['CC_Base_L_Eye', 'LeftEye', 'Eye_L'],
    right: ['CC_Base_R_Eye', 'RightEye', 'Eye_R'],
  }
): 'forward' | 'backward' | 'unknown' {
  const eyes: { left: THREE.Vector3 | null; right: THREE.Vector3 | null } = {
    left: null,
    right: null,
  };

  model.traverse((obj) => {
    const objName = obj.name;

    if (!eyes.left) {
      for (const name of eyeBoneNames.left) {
        if (objName.includes(name)) {
          eyes.left = new THREE.Vector3();
          obj.getWorldPosition(eyes.left);
          break;
        }
      }
    }

    if (!eyes.right) {
      for (const name of eyeBoneNames.right) {
        if (objName.includes(name)) {
          eyes.right = new THREE.Vector3();
          obj.getWorldPosition(eyes.right);
          break;
        }
      }
    }
  });

  if (!eyes.left || !eyes.right) {
    return 'unknown';
  }

  // In a forward-facing model, left eye should have smaller X than right eye
  const eyeXDiff = eyes.left.x - eyes.right.x;

  if (Math.abs(eyeXDiff) < 0.001) {
    return 'unknown';
  }

  return eyeXDiff < 0 ? 'forward' : 'backward';
}
