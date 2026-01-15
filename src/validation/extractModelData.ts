/**
 * Loom3 - Model Data Extraction
 *
 * Extracts bones, morph targets, meshes, and animations from 3D models.
 * Works with both GLTF files and runtime Three.js models.
 */

import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Bone information extracted from skeleton
 */
export interface BoneInfo {
  name: string;
  parent: string | null;
  children: string[];
  worldPosition: { x: number; y: number; z: number };
  /** Depth in hierarchy (0 = root) */
  depth: number;
}

/**
 * Morph target information
 */
export interface MorphInfo {
  name: string;
  meshName: string;
  index: number;
}

/**
 * Model mesh information (from extraction)
 */
export interface ModelMeshInfo {
  name: string;
  hasMorphTargets: boolean;
  morphCount: number;
}

/**
 * Animation track information
 */
export interface TrackInfo {
  name: string;
  targetName: string;
  property: string;
  type: 'position' | 'rotation' | 'scale' | 'morph' | 'unknown';
  keyframeCount: number;
  valueRange?: { min: number[]; max: number[] };
}

/**
 * Animation clip information
 */
export interface AnimationInfo {
  name: string;
  duration: number;
  tracks: TrackInfo[];
  animatedBones: string[];
  animatedMorphs: string[];
}

/**
 * Complete model data extraction result
 */
export interface ModelData {
  bones: BoneInfo[];
  morphs: MorphInfo[];
  meshes: ModelMeshInfo[];
  animations: AnimationInfo[];
  /** Quick lookups */
  boneNames: string[];
  morphNames: string[];
  meshNames: string[];
}

/**
 * Extract bone hierarchy from a Three.js object
 */
function extractBones(root: THREE.Object3D): BoneInfo[] {
  const bones: BoneInfo[] = [];
  const boneDepths = new Map<string, number>();

  // First pass: find all bones and calculate depths
  root.traverse((obj) => {
    if (obj instanceof THREE.Bone || obj.type === 'Bone') {
      const worldPos = new THREE.Vector3();
      obj.getWorldPosition(worldPos);

      // Calculate depth by walking up the parent chain
      let depth = 0;
      let parent = obj.parent;
      while (parent) {
        if (parent instanceof THREE.Bone || parent.type === 'Bone') {
          depth++;
        }
        parent = parent.parent;
      }
      boneDepths.set(obj.name, depth);

      const parentBone = obj.parent instanceof THREE.Bone || obj.parent?.type === 'Bone'
        ? obj.parent.name
        : null;

      bones.push({
        name: obj.name,
        parent: parentBone,
        children: [], // Will be filled in second pass
        worldPosition: { x: worldPos.x, y: worldPos.y, z: worldPos.z },
        depth,
      });
    }
  });

  // Second pass: fill in children
  for (const bone of bones) {
    bone.children = bones
      .filter(b => b.parent === bone.name)
      .map(b => b.name);
  }

  // Sort by depth, then alphabetically
  bones.sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth;
    return a.name.localeCompare(b.name);
  });

  return bones;
}

/**
 * Extract morph targets from meshes
 */
function extractMorphs(meshes: THREE.Mesh[]): MorphInfo[] {
  const morphs: MorphInfo[] = [];

  for (const mesh of meshes) {
    const geo = mesh.geometry;
    if (!geo.morphAttributes) continue;

    // Get morph target dictionary if available
    const dict = (geo as any).morphTargetDictionary as Record<string, number> | undefined;

    if (dict) {
      for (const [name, index] of Object.entries(dict)) {
        morphs.push({
          name,
          meshName: mesh.name,
          index,
        });
      }
    } else if (mesh.morphTargetInfluences && mesh.morphTargetInfluences.length > 0) {
      // Fallback: no dictionary, just numbered morphs
      for (let i = 0; i < mesh.morphTargetInfluences.length; i++) {
        morphs.push({
          name: `morph_${i}`,
          meshName: mesh.name,
          index: i,
        });
      }
    }
  }

  return morphs;
}

/**
 * Extract mesh information
 */
function extractMeshes(meshes: THREE.Mesh[]): ModelMeshInfo[] {
  return meshes.map(mesh => ({
    name: mesh.name,
    hasMorphTargets: !!(mesh.morphTargetDictionary && Object.keys(mesh.morphTargetDictionary).length > 0) ||
                      !!(mesh.morphTargetInfluences && mesh.morphTargetInfluences.length > 0),
    morphCount: mesh.morphTargetInfluences?.length || 0,
  }));
}

/**
 * Parse animation track to extract info
 */
function parseTrack(track: THREE.KeyframeTrack): TrackInfo {
  // Track name format: "objectName.property" or "objectName.property[index]"
  const parts = track.name.split('.');
  const targetName = parts[0];
  const property = parts.slice(1).join('.');

  let type: TrackInfo['type'] = 'unknown';
  if (property.includes('position')) type = 'position';
  else if (property.includes('quaternion') || property.includes('rotation')) type = 'rotation';
  else if (property.includes('scale')) type = 'scale';
  else if (property.includes('morphTargetInfluences')) type = 'morph';

  // Calculate value ranges
  const values = track.values;
  const valueSize = track.getValueSize();
  let min: number[] = [];
  let max: number[] = [];

  if (values.length > 0) {
    min = Array(valueSize).fill(Infinity);
    max = Array(valueSize).fill(-Infinity);

    for (let i = 0; i < values.length; i += valueSize) {
      for (let j = 0; j < valueSize; j++) {
        const v = values[i + j];
        if (v < min[j]) min[j] = v;
        if (v > max[j]) max[j] = v;
      }
    }
  }

  return {
    name: track.name,
    targetName,
    property,
    type,
    keyframeCount: track.times.length,
    valueRange: min.length > 0 ? { min, max } : undefined,
  };
}

/**
 * Extract animation information
 */
function extractAnimations(animations: THREE.AnimationClip[]): AnimationInfo[] {
  return animations.map(clip => {
    const tracks = clip.tracks.map(parseTrack);

    const animatedBones = new Set<string>();
    const animatedMorphs = new Set<string>();

    for (const track of tracks) {
      if (track.type === 'rotation' || track.type === 'position') {
        animatedBones.add(track.targetName);
      } else if (track.type === 'morph') {
        animatedMorphs.add(track.name);
      }
    }

    return {
      name: clip.name,
      duration: clip.duration,
      tracks,
      animatedBones: Array.from(animatedBones),
      animatedMorphs: Array.from(animatedMorphs),
    };
  });
}

/**
 * Collect all meshes from a scene
 */
function collectMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      meshes.push(obj as THREE.Mesh);
    }
  });
  return meshes;
}

/**
 * Extract all data from a runtime Three.js model
 *
 * @param model - The root Object3D of the loaded model
 * @param meshes - Array of meshes with morph targets (optional, will be collected if not provided)
 * @param animations - Array of AnimationClips from the GLTF (optional)
 */
export function extractModelData(
  model: THREE.Object3D,
  meshes?: THREE.Mesh[],
  animations?: THREE.AnimationClip[]
): ModelData {
  const actualMeshes = meshes || collectMeshes(model);
  const actualAnimations = animations || [];

  const bones = extractBones(model);
  const morphs = extractMorphs(actualMeshes);
  const meshInfos = extractMeshes(actualMeshes);
  const animationInfos = extractAnimations(actualAnimations);

  return {
    bones,
    morphs,
    meshes: meshInfos,
    animations: animationInfos,
    boneNames: bones.map(b => b.name),
    morphNames: morphs.map(m => m.name),
    meshNames: meshInfos.map(m => m.name),
  };
}

/**
 * Extract all data from a GLTF file
 *
 * @param gltf - The loaded GLTF object
 */
export function extractFromGLTF(gltf: GLTF): ModelData {
  const meshes = collectMeshes(gltf.scene);
  return extractModelData(gltf.scene, meshes, gltf.animations);
}
