/**
 * Betta Fish Preset - Skeletal Animation Mappings
 *
 * Bone mappings for the betta fish model from Sketchfab.
 * This fish has 53 bones and 1 embedded animation ("Take 01" swimming).
 * No morph targets/blend shapes - all animation is skeletal.
 *
 * Bone structure (inferred from hierarchy):
 * - Armature_rootJoint: Root
 *   - Bone_Armature: Main body root
 *     - Bone.001_Armature: Head/Front body
 *       - Bone.009-017: Likely eyes/gills area (left/right symmetry)
 *     - Bone.002_Armature: Body spine chain
 *       - Bone.003 → 004 → 005: Body to tail
 *         - Bone.018-045: Tail fins (multiple branching chains)
 *     - Bone.046/047: Pectoral fins (left/right)
 *   - Bone.006_Armature: Dorsal fin area
 *     - Bone.007/008: Dorsal fin bones
 */

import type { BoneBinding, AUInfo, CompositeRotation } from '../core/types';
import type { MeshInfo, MeshCategory } from '../mappings/types';

// ============================================================================
// BONE NAMES - All 53 bones in the fish skeleton
// ============================================================================

export const FISH_BONES = [
  "Armature_rootJoint",
  "Bone_Armature",
  "Bone001_Armature",
  "Bone009_Armature",
  "Bone027_Armature",
  "Bone029_Armature",
  "Bone031_Armature",
  "Bone028_Armature",
  "Bone030_Armature",
  "Bone032_Armature",
  "Bone010_Armature",
  "Bone012_Armature",
  "Bone014_Armature",
  "Bone016_Armature",
  "Bone011_Armature",
  "Bone013_Armature",
  "Bone015_Armature",
  "Bone017_Armature",
  "Bone002_Armature",
  "Bone003_Armature",
  "Bone004_Armature",
  "Bone005_Armature",
  "Bone020_Armature",
  "Bone025_Armature",
  "Bone026_Armature",
  "Bone039_Armature",
  "Bone040_Armature",
  "Bone041_Armature",
  "Bone042_Armature",
  "Bone043_Armature",
  "Bone044_Armature",
  "Bone045_Armature",
  "Bone019_Armature",
  "Bone023_Armature",
  "Bone024_Armature",
  "Bone034_Armature",
  "Bone036_Armature",
  "Bone038_Armature",
  "Bone018_Armature",
  "Bone021_Armature",
  "Bone022_Armature",
  "Bone033_Armature",
  "Bone035_Armature",
  "Bone037_Armature",
  "Bone046_Armature",
  "Bone048_Armature",
  "Bone050_Armature",
  "Bone047_Armature",
  "Bone049_Armature",
  "Bone051_Armature",
  "Bone006_Armature",
  "Bone007_Armature",
  "Bone008_Armature"
] as const;

// ============================================================================
// SEMANTIC BONE MAPPINGS - Human-readable names for key bones
// ============================================================================

export const FISH_BONE_NODES = {
  // Root and body spine
  ROOT: 'Armature_rootJoint',
  BODY_ROOT: 'Bone_Armature',
  HEAD: 'Bone001_Armature',
  BODY_FRONT: 'Bone002_Armature',
  BODY_MID: 'Bone003_Armature',
  BODY_BACK: 'Bone004_Armature',
  TAIL_BASE: 'Bone005_Armature',

  // GILLS (operculum + branchiostegal membrane) - bilateral
  // Fish have gills on BOTH sides - bones 046-051 are left/right pairs
  // Even numbers (046, 048, 050) = LEFT side
  // Odd numbers (047, 049, 051) = RIGHT side
  GILL_L: 'Bone046_Armature',
  GILL_L_MID: 'Bone048_Armature',
  GILL_L_TIP: 'Bone050_Armature',
  GILL_R: 'Bone047_Armature',
  GILL_R_MID: 'Bone049_Armature',
  GILL_R_TIP: 'Bone051_Armature',

  // Dorsal fin (top fin) - sibling of BODY_ROOT
  DORSAL_ROOT: 'Bone006_Armature',
  DORSAL_L: 'Bone007_Armature',
  DORSAL_R: 'Bone008_Armature',

  // Ventral fins (under body mid) - these look like the front belly fins
  // Bone018/033 are children of BODY_MID, likely ventral/pelvic fins
  VENTRAL_L: 'Bone018_Armature',
  VENTRAL_L_MID: 'Bone021_Armature',
  VENTRAL_L_TIP: 'Bone022_Armature',
  VENTRAL_R: 'Bone033_Armature',
  VENTRAL_R_MID: 'Bone035_Armature',
  VENTRAL_R_TIP: 'Bone037_Armature',

  // PECTORAL FINS (front fins on head) - these are the decorative head fins
  // User confirmed: "Gill flare L moves the front most bottom fin"
  // So these head-attached bones (009-017) are actually pectoral/front fins
  // Left side chain: Bone009 → Bone027 → Bone029 → Bone031
  //                          → Bone028 → Bone030 → Bone032
  PECTORAL_L_ROOT: 'Bone009_Armature',
  PECTORAL_L_CHAIN1: 'Bone027_Armature',
  PECTORAL_L_CHAIN1_MID: 'Bone029_Armature',
  PECTORAL_L_CHAIN1_TIP: 'Bone031_Armature',
  PECTORAL_L_CHAIN2: 'Bone028_Armature',
  PECTORAL_L_CHAIN2_MID: 'Bone030_Armature',
  PECTORAL_L_CHAIN2_TIP: 'Bone032_Armature',

  // Right side chain: Bone010 → Bone012 → Bone014, Bone016
  PECTORAL_R_ROOT: 'Bone010_Armature',
  PECTORAL_R_CHAIN1: 'Bone012_Armature',
  PECTORAL_R_CHAIN1_A: 'Bone014_Armature',
  PECTORAL_R_CHAIN1_B: 'Bone016_Armature',

  // Another front fin chain: Bone011 → Bone013 → Bone015, Bone017
  PECTORAL_R_ROOT2: 'Bone011_Armature',
  PECTORAL_R_CHAIN2: 'Bone013_Armature',
  PECTORAL_R_CHAIN2_A: 'Bone015_Armature',
  PECTORAL_R_CHAIN2_B: 'Bone017_Armature',

  // Eyes - The fish has EYES_0 skinned mesh
  // In Three.js, SkinnedMesh transform is applied AFTER skinning,
  // so rotating the mesh object should rotate the final result
  EYE_L: 'EYES_0',
  EYE_R: 'EYES_0',

  // Main tail fins (children of TAIL_BASE = Bone005)
  // Chain 1: Bone020 → Bone025 → Bone026
  TAIL_TOP: 'Bone020_Armature',
  TAIL_TOP_MID: 'Bone025_Armature',
  TAIL_TOP_TIP: 'Bone026_Armature',

  // Chain 2: Bone039 → multiple sub-chains (main tail fan)
  TAIL_MID: 'Bone039_Armature',
  TAIL_MID_A: 'Bone040_Armature',
  TAIL_MID_A_TIP: 'Bone041_Armature',
  TAIL_MID_B: 'Bone042_Armature',
  TAIL_MID_B_TIP: 'Bone043_Armature',
  TAIL_MID_C: 'Bone044_Armature',
  TAIL_MID_C_TIP: 'Bone045_Armature',

  // Side tail chains (children of BODY_BACK = Bone004)
  // Bone019 → Bone023 → Bone024
  TAIL_SIDE_L: 'Bone019_Armature',
  TAIL_SIDE_L_MID: 'Bone023_Armature',
  TAIL_SIDE_L_TIP: 'Bone024_Armature',

  // Bone034 → Bone036 → Bone038
  TAIL_SIDE_R: 'Bone034_Armature',
  TAIL_SIDE_R_MID: 'Bone036_Armature',
  TAIL_SIDE_R_TIP: 'Bone038_Armature',
} as const;

// ============================================================================
// CUSTOM ACTION MAPPINGS - Fish-specific "Action Units"
// These are analogous to FACS AUs but for fish body movements
// ============================================================================

/** Fish Action Units - custom IDs for fish movements */
export enum FishAction {
  // Body orientation (like human head pose)
  TURN_LEFT = 2,      // Turn head/body left
  TURN_RIGHT = 3,     // Turn head/body right
  PITCH_UP = 4,       // Nose up
  PITCH_DOWN = 5,     // Nose down
  ROLL_LEFT = 6,      // Roll body left
  ROLL_RIGHT = 7,     // Roll body right

  // Tail movements
  TAIL_SWEEP_LEFT = 12,   // Tail sweep left (yaw)
  TAIL_SWEEP_RIGHT = 13,  // Tail sweep right (yaw)
  TAIL_FIN_SPREAD = 14,   // Tail fins spread out
  TAIL_FIN_CLOSE = 15,    // Tail fins close together

  // Pectoral fins (side fins) - these are the main swimming fins
  PECTORAL_L_UP = 20,
  PECTORAL_L_DOWN = 21,
  PECTORAL_R_UP = 22,
  PECTORAL_R_DOWN = 23,
  PECTORAL_L_FORWARD = 24,
  PECTORAL_L_BACK = 25,
  PECTORAL_R_FORWARD = 26,
  PECTORAL_R_BACK = 27,

  // Ventral fins (belly fins under body mid) - what you called "gullet"
  VENTRAL_L_UP = 30,
  VENTRAL_L_DOWN = 31,
  VENTRAL_R_UP = 32,
  VENTRAL_R_DOWN = 33,

  // Dorsal fin (top fin - erect/fold)
  DORSAL_ERECT = 40,
  DORSAL_FOLD = 41,

  // Gills - separate L/R controls (single AU per side, not a continuum)
  // Each side has one AU controlling flare intensity (0=closed, 1=flared)
  GILLS_L = 50,
  GILLS_R = 51,

  // Eye rotation (like human AU 61-64)
  EYE_LEFT = 61,
  EYE_RIGHT = 62,
  EYE_UP = 63,
  EYE_DOWN = 64,
}

// ============================================================================
// BONE BINDINGS - Map FishActions to bone rotations
// ============================================================================

export const FISH_BONE_BINDINGS: Record<number, BoneBinding[]> = {
  // ========== BODY ORIENTATION ==========
  [FishAction.TURN_LEFT]: [
    { node: 'HEAD', channel: 'ry', scale: 1, maxDegrees: 30 },
    { node: 'BODY_FRONT', channel: 'ry', scale: 1, maxDegrees: 14 },
    { node: 'BODY_MID', channel: 'ry', scale: 1, maxDegrees: 5 },
  ],
  [FishAction.TURN_RIGHT]: [
    { node: 'HEAD', channel: 'ry', scale: -1, maxDegrees: 30 },
    { node: 'BODY_FRONT', channel: 'ry', scale: -1, maxDegrees: 14 },
    { node: 'BODY_MID', channel: 'ry', scale: -1, maxDegrees: 5 },
  ],
  [FishAction.PITCH_UP]: [
    { node: 'HEAD', channel: 'rx', scale: -1, maxDegrees: 20 },
    { node: 'BODY_FRONT', channel: 'rx', scale: -1, maxDegrees: 5 },
  ],
  [FishAction.PITCH_DOWN]: [
    { node: 'HEAD', channel: 'rx', scale: 1, maxDegrees: 20 },
    { node: 'BODY_FRONT', channel: 'rx', scale: 1, maxDegrees: 5 },
  ],
  [FishAction.ROLL_LEFT]: [
    { node: 'BODY_ROOT', channel: 'rz', scale: -1, maxDegrees: 25 },
  ],
  [FishAction.ROLL_RIGHT]: [
    { node: 'BODY_ROOT', channel: 'rz', scale: 1, maxDegrees: 25 },
  ],

  // ========== TAIL ==========
  // Tail sweep uses rz (roll axis) to sweep left/right in fish's local space
  [FishAction.TAIL_SWEEP_LEFT]: [
    { node: 'BODY_BACK', channel: 'rz', scale: 1, maxDegrees: 15 },
    { node: 'TAIL_BASE', channel: 'rz', scale: 1, maxDegrees: 30 },
    { node: 'TAIL_TOP', channel: 'rz', scale: 1, maxDegrees: 20 },
    { node: 'TAIL_MID', channel: 'rz', scale: 1, maxDegrees: 20 },
  ],
  [FishAction.TAIL_SWEEP_RIGHT]: [
    { node: 'BODY_BACK', channel: 'rz', scale: -1, maxDegrees: 15 },
    { node: 'TAIL_BASE', channel: 'rz', scale: -1, maxDegrees: 30 },
    { node: 'TAIL_TOP', channel: 'rz', scale: -1, maxDegrees: 20 },
    { node: 'TAIL_MID', channel: 'rz', scale: -1, maxDegrees: 20 },
  ],
  // Tail fin spread/close (fan motion)
  [FishAction.TAIL_FIN_SPREAD]: [
    { node: 'TAIL_TOP', channel: 'rx', scale: -1, maxDegrees: 20 },
    { node: 'TAIL_SIDE_L', channel: 'rx', scale: 1, maxDegrees: 15 },
    { node: 'TAIL_SIDE_R', channel: 'rx', scale: -1, maxDegrees: 15 },
  ],
  [FishAction.TAIL_FIN_CLOSE]: [
    { node: 'TAIL_TOP', channel: 'rx', scale: 1, maxDegrees: 15 },
    { node: 'TAIL_SIDE_L', channel: 'rx', scale: -1, maxDegrees: 12 },
    { node: 'TAIL_SIDE_R', channel: 'rx', scale: 1, maxDegrees: 12 },
  ],

  // ========== PECTORAL FINS (front/head fins) ==========
  // These are the decorative fins attached to the head (bones 009-017)
  [FishAction.PECTORAL_L_UP]: [
    { node: 'PECTORAL_L_ROOT', channel: 'rz', scale: 1, maxDegrees: 40 },
    { node: 'PECTORAL_L_CHAIN1', channel: 'rz', scale: 1, maxDegrees: 20 },
    { node: 'PECTORAL_L_CHAIN2', channel: 'rz', scale: 1, maxDegrees: 20 },
  ],
  [FishAction.PECTORAL_L_DOWN]: [
    { node: 'PECTORAL_L_ROOT', channel: 'rz', scale: -1, maxDegrees: 40 },
    { node: 'PECTORAL_L_CHAIN1', channel: 'rz', scale: -1, maxDegrees: 20 },
    { node: 'PECTORAL_L_CHAIN2', channel: 'rz', scale: -1, maxDegrees: 20 },
  ],
  [FishAction.PECTORAL_R_UP]: [
    { node: 'PECTORAL_R_ROOT', channel: 'rz', scale: -1, maxDegrees: 40 },
    { node: 'PECTORAL_R_CHAIN1', channel: 'rz', scale: -1, maxDegrees: 20 },
    { node: 'PECTORAL_R_ROOT2', channel: 'rz', scale: -1, maxDegrees: 40 },
  ],
  [FishAction.PECTORAL_R_DOWN]: [
    { node: 'PECTORAL_R_ROOT', channel: 'rz', scale: 1, maxDegrees: 40 },
    { node: 'PECTORAL_R_CHAIN1', channel: 'rz', scale: 1, maxDegrees: 20 },
    { node: 'PECTORAL_R_ROOT2', channel: 'rz', scale: 1, maxDegrees: 40 },
  ],
  [FishAction.PECTORAL_L_FORWARD]: [
    { node: 'PECTORAL_L_ROOT', channel: 'ry', scale: 1, maxDegrees: 30 },
  ],
  [FishAction.PECTORAL_L_BACK]: [
    { node: 'PECTORAL_L_ROOT', channel: 'ry', scale: -1, maxDegrees: 30 },
  ],
  [FishAction.PECTORAL_R_FORWARD]: [
    { node: 'PECTORAL_R_ROOT', channel: 'ry', scale: -1, maxDegrees: 30 },
  ],
  [FishAction.PECTORAL_R_BACK]: [
    { node: 'PECTORAL_R_ROOT', channel: 'ry', scale: 1, maxDegrees: 30 },
  ],

  // ========== VENTRAL FINS (belly fins - what moves the "gullet") ==========
  [FishAction.VENTRAL_L_UP]: [
    { node: 'VENTRAL_L', channel: 'rz', scale: 1, maxDegrees: 30 },
    { node: 'VENTRAL_L_MID', channel: 'rz', scale: 1, maxDegrees: 15 },
  ],
  [FishAction.VENTRAL_L_DOWN]: [
    { node: 'VENTRAL_L', channel: 'rz', scale: -1, maxDegrees: 30 },
    { node: 'VENTRAL_L_MID', channel: 'rz', scale: -1, maxDegrees: 15 },
  ],
  [FishAction.VENTRAL_R_UP]: [
    { node: 'VENTRAL_R', channel: 'rz', scale: -1, maxDegrees: 30 },
    { node: 'VENTRAL_R_MID', channel: 'rz', scale: -1, maxDegrees: 15 },
  ],
  [FishAction.VENTRAL_R_DOWN]: [
    { node: 'VENTRAL_R', channel: 'rz', scale: 1, maxDegrees: 30 },
    { node: 'VENTRAL_R_MID', channel: 'rz', scale: 1, maxDegrees: 15 },
  ],

  // ========== DORSAL FIN (top fin - erect/fold) ==========
  [FishAction.DORSAL_ERECT]: [
    { node: 'DORSAL_ROOT', channel: 'rx', scale: -1, maxDegrees: 25 },
    { node: 'DORSAL_L', channel: 'rx', scale: -1, maxDegrees: 15 },
    { node: 'DORSAL_R', channel: 'rx', scale: -1, maxDegrees: 15 },
  ],
  [FishAction.DORSAL_FOLD]: [
    { node: 'DORSAL_ROOT', channel: 'rx', scale: 1, maxDegrees: 25 },
    { node: 'DORSAL_L', channel: 'rx', scale: 1, maxDegrees: 15 },
    { node: 'DORSAL_R', channel: 'rx', scale: 1, maxDegrees: 15 },
  ],

  // ========== GILLS (separate L/R, single AU per side - 0=closed, 1=flared) ==========
  [FishAction.GILLS_L]: [
    { node: 'GILL_L', channel: 'rz', scale: 1, maxDegrees: 40 },
    { node: 'GILL_L_MID', channel: 'rz', scale: 1, maxDegrees: 20 },
  ],
  [FishAction.GILLS_R]: [
    { node: 'GILL_R', channel: 'rz', scale: -1, maxDegrees: 40 },
    { node: 'GILL_R_MID', channel: 'rz', scale: -1, maxDegrees: 20 },
  ],

  // ========== EYES (rotate the EYES_0 mesh) ==========
  // Fish has a single combined eyes mesh - both eyes rotate together
  [FishAction.EYE_LEFT]: [
    { node: 'EYE_L', channel: 'ry', scale: 1, maxDegrees: 25 },  // Look left (yaw)
  ],
  [FishAction.EYE_RIGHT]: [
    { node: 'EYE_L', channel: 'ry', scale: -1, maxDegrees: 25 }, // Look right (yaw)
  ],
  [FishAction.EYE_UP]: [
    { node: 'EYE_L', channel: 'rx', scale: -1, maxDegrees: 20 }, // Look up (pitch)
  ],
  [FishAction.EYE_DOWN]: [
    { node: 'EYE_L', channel: 'rx', scale: 1, maxDegrees: 20 },  // Look down (pitch)
  ],
};

// ============================================================================
// FISH AU INFO - Metadata for each action (compatible with loomlarge AUInfo)
// facePart is used to group controls in the UI
// ============================================================================

export const FISH_AU_INFO: Record<string, AUInfo> = {
  // Body Orientation
  '2': { id: '2', name: 'Turn Left', facePart: 'Body Orientation', muscularBasis: 'Myomere muscles', links: ['https://en.wikipedia.org/wiki/Myomere'] },
  '3': { id: '3', name: 'Turn Right', facePart: 'Body Orientation', muscularBasis: 'Myomere muscles', links: ['https://en.wikipedia.org/wiki/Myomere'] },
  '4': { id: '4', name: 'Pitch Up', facePart: 'Body Orientation', muscularBasis: 'Epaxial muscles', links: ['https://en.wikipedia.org/wiki/Epaxial_muscles'] },
  '5': { id: '5', name: 'Pitch Down', facePart: 'Body Orientation', muscularBasis: 'Hypaxial muscles', links: ['https://en.wikipedia.org/wiki/Hypaxial_muscles'] },
  '6': { id: '6', name: 'Roll Left', facePart: 'Body Orientation', muscularBasis: 'Lateral body muscles', links: ['https://en.wikipedia.org/wiki/Fish_locomotion'] },
  '7': { id: '7', name: 'Roll Right', facePart: 'Body Orientation', muscularBasis: 'Lateral body muscles', links: ['https://en.wikipedia.org/wiki/Fish_locomotion'] },

  // Tail (Caudal fin)
  '12': { id: '12', name: 'Tail Sweep Left', facePart: 'Caudal Fin', muscularBasis: 'Caudal fin muscles', links: ['https://en.wikipedia.org/wiki/Fish_fin#Caudal_fin'] },
  '13': { id: '13', name: 'Tail Sweep Right', facePart: 'Caudal Fin', muscularBasis: 'Caudal fin muscles', links: ['https://en.wikipedia.org/wiki/Fish_fin#Caudal_fin'] },
  '14': { id: '14', name: 'Tail Fin Spread', facePart: 'Caudal Fin', muscularBasis: 'Fin ray muscles', links: ['https://en.wikipedia.org/wiki/Fish_fin#Caudal_fin'] },
  '15': { id: '15', name: 'Tail Fin Close', facePart: 'Caudal Fin', muscularBasis: 'Fin ray muscles', links: ['https://en.wikipedia.org/wiki/Fish_fin#Caudal_fin'] },

  // Pectoral Fins (side fins for steering and braking)
  '20': { id: '20', name: 'Pectoral L Up', facePart: 'Pectoral Fins', muscularBasis: 'Pectoral fin muscles', links: ['https://en.wikipedia.org/wiki/Fish_fin#Pectoral_fins'] },
  '21': { id: '21', name: 'Pectoral L Down', facePart: 'Pectoral Fins', muscularBasis: 'Pectoral fin muscles', links: ['https://en.wikipedia.org/wiki/Fish_fin#Pectoral_fins'] },
  '22': { id: '22', name: 'Pectoral R Up', facePart: 'Pectoral Fins', muscularBasis: 'Pectoral fin muscles', links: ['https://en.wikipedia.org/wiki/Fish_fin#Pectoral_fins'] },
  '23': { id: '23', name: 'Pectoral R Down', facePart: 'Pectoral Fins', muscularBasis: 'Pectoral fin muscles', links: ['https://en.wikipedia.org/wiki/Fish_fin#Pectoral_fins'] },
  '24': { id: '24', name: 'Pectoral L Forward', facePart: 'Pectoral Fins', muscularBasis: 'Pectoral fin muscles', links: ['https://en.wikipedia.org/wiki/Fish_fin#Pectoral_fins'] },
  '25': { id: '25', name: 'Pectoral L Back', facePart: 'Pectoral Fins', muscularBasis: 'Pectoral fin muscles', links: ['https://en.wikipedia.org/wiki/Fish_fin#Pectoral_fins'] },
  '26': { id: '26', name: 'Pectoral R Forward', facePart: 'Pectoral Fins', muscularBasis: 'Pectoral fin muscles', links: ['https://en.wikipedia.org/wiki/Fish_fin#Pectoral_fins'] },
  '27': { id: '27', name: 'Pectoral R Back', facePart: 'Pectoral Fins', muscularBasis: 'Pectoral fin muscles', links: ['https://en.wikipedia.org/wiki/Fish_fin#Pectoral_fins'] },

  // Ventral/Pelvic Fins (belly fins for stability)
  '30': { id: '30', name: 'Ventral L Up', facePart: 'Pelvic Fins', muscularBasis: 'Pelvic fin muscles', links: ['https://en.wikipedia.org/wiki/Fish_fin#Pelvic_fins'] },
  '31': { id: '31', name: 'Ventral L Down', facePart: 'Pelvic Fins', muscularBasis: 'Pelvic fin muscles', links: ['https://en.wikipedia.org/wiki/Fish_fin#Pelvic_fins'] },
  '32': { id: '32', name: 'Ventral R Up', facePart: 'Pelvic Fins', muscularBasis: 'Pelvic fin muscles', links: ['https://en.wikipedia.org/wiki/Fish_fin#Pelvic_fins'] },
  '33': { id: '33', name: 'Ventral R Down', facePart: 'Pelvic Fins', muscularBasis: 'Pelvic fin muscles', links: ['https://en.wikipedia.org/wiki/Fish_fin#Pelvic_fins'] },

  // Dorsal Fin (top fin)
  '40': { id: '40', name: 'Dorsal Erect', facePart: 'Dorsal Fin', muscularBasis: 'Dorsal fin erector muscles', links: ['https://en.wikipedia.org/wiki/Fish_fin#Dorsal_fins'] },
  '41': { id: '41', name: 'Dorsal Fold', facePart: 'Dorsal Fin', muscularBasis: 'Dorsal fin depressor muscles', links: ['https://en.wikipedia.org/wiki/Fish_fin#Dorsal_fins'] },

  // Gills (separate L/R - single AU per side, 0=closed, 1=flared)
  '50': { id: '50', name: 'Gill L', facePart: 'Gills', muscularBasis: 'Opercular muscles', links: ['https://en.wikipedia.org/wiki/Operculum_(fish)'] },
  '51': { id: '51', name: 'Gill R', facePart: 'Gills', muscularBasis: 'Opercular muscles', links: ['https://en.wikipedia.org/wiki/Operculum_(fish)'] },

  // Eye movement (similar to human AU 61-64)
  '61': { id: '61', name: 'Eyes Left', facePart: 'Eyes', muscularBasis: 'Extraocular muscles', links: ['https://en.wikipedia.org/wiki/Extraocular_muscles'] },
  '62': { id: '62', name: 'Eyes Right', facePart: 'Eyes', muscularBasis: 'Extraocular muscles', links: ['https://en.wikipedia.org/wiki/Extraocular_muscles'] },
  '63': { id: '63', name: 'Eyes Up', facePart: 'Eyes', muscularBasis: 'Superior rectus', links: ['https://en.wikipedia.org/wiki/Superior_rectus_muscle'] },
  '64': { id: '64', name: 'Eyes Down', facePart: 'Eyes', muscularBasis: 'Inferior rectus', links: ['https://en.wikipedia.org/wiki/Inferior_rectus_muscle'] },
};

// ============================================================================
// CONTINUUM PAIRS - Define which AUs form bidirectional pairs for sliders
// ============================================================================

/**
 * Fish continuum pairs - maps AU ID to its partner for bidirectional sliders
 * Format matches loomlarge's CONTINUUM_PAIRS_MAP
 */
export const FISH_CONTINUUM_PAIRS_MAP: Record<number, {
  pairId: number;
  isNegative: boolean;
  axis: 'pitch' | 'yaw' | 'roll';
  node: string;
}> = {
  // Body Orientation
  [FishAction.TURN_LEFT]: { pairId: FishAction.TURN_RIGHT, isNegative: true, axis: 'yaw', node: 'HEAD' },
  [FishAction.TURN_RIGHT]: { pairId: FishAction.TURN_LEFT, isNegative: false, axis: 'yaw', node: 'HEAD' },
  [FishAction.PITCH_DOWN]: { pairId: FishAction.PITCH_UP, isNegative: true, axis: 'pitch', node: 'HEAD' },
  [FishAction.PITCH_UP]: { pairId: FishAction.PITCH_DOWN, isNegative: false, axis: 'pitch', node: 'HEAD' },
  [FishAction.ROLL_LEFT]: { pairId: FishAction.ROLL_RIGHT, isNegative: true, axis: 'roll', node: 'BODY_ROOT' },
  [FishAction.ROLL_RIGHT]: { pairId: FishAction.ROLL_LEFT, isNegative: false, axis: 'roll', node: 'BODY_ROOT' },

  // Tail
  [FishAction.TAIL_SWEEP_LEFT]: { pairId: FishAction.TAIL_SWEEP_RIGHT, isNegative: true, axis: 'roll', node: 'TAIL_BASE' },
  [FishAction.TAIL_SWEEP_RIGHT]: { pairId: FishAction.TAIL_SWEEP_LEFT, isNegative: false, axis: 'roll', node: 'TAIL_BASE' },
  [FishAction.TAIL_FIN_CLOSE]: { pairId: FishAction.TAIL_FIN_SPREAD, isNegative: true, axis: 'pitch', node: 'TAIL_TOP' },
  [FishAction.TAIL_FIN_SPREAD]: { pairId: FishAction.TAIL_FIN_CLOSE, isNegative: false, axis: 'pitch', node: 'TAIL_TOP' },

  // Pectoral Fins (head-attached decorative fins)
  [FishAction.PECTORAL_L_DOWN]: { pairId: FishAction.PECTORAL_L_UP, isNegative: true, axis: 'roll', node: 'PECTORAL_L_ROOT' },
  [FishAction.PECTORAL_L_UP]: { pairId: FishAction.PECTORAL_L_DOWN, isNegative: false, axis: 'roll', node: 'PECTORAL_L_ROOT' },
  [FishAction.PECTORAL_L_BACK]: { pairId: FishAction.PECTORAL_L_FORWARD, isNegative: true, axis: 'yaw', node: 'PECTORAL_L_ROOT' },
  [FishAction.PECTORAL_L_FORWARD]: { pairId: FishAction.PECTORAL_L_BACK, isNegative: false, axis: 'yaw', node: 'PECTORAL_L_ROOT' },
  [FishAction.PECTORAL_R_DOWN]: { pairId: FishAction.PECTORAL_R_UP, isNegative: true, axis: 'roll', node: 'PECTORAL_R_ROOT' },
  [FishAction.PECTORAL_R_UP]: { pairId: FishAction.PECTORAL_R_DOWN, isNegative: false, axis: 'roll', node: 'PECTORAL_R_ROOT' },
  [FishAction.PECTORAL_R_BACK]: { pairId: FishAction.PECTORAL_R_FORWARD, isNegative: true, axis: 'yaw', node: 'PECTORAL_R_ROOT' },
  [FishAction.PECTORAL_R_FORWARD]: { pairId: FishAction.PECTORAL_R_BACK, isNegative: false, axis: 'yaw', node: 'PECTORAL_R_ROOT' },

  // Ventral Fins
  [FishAction.VENTRAL_L_DOWN]: { pairId: FishAction.VENTRAL_L_UP, isNegative: true, axis: 'roll', node: 'VENTRAL_L' },
  [FishAction.VENTRAL_L_UP]: { pairId: FishAction.VENTRAL_L_DOWN, isNegative: false, axis: 'roll', node: 'VENTRAL_L' },
  [FishAction.VENTRAL_R_DOWN]: { pairId: FishAction.VENTRAL_R_UP, isNegative: true, axis: 'roll', node: 'VENTRAL_R' },
  [FishAction.VENTRAL_R_UP]: { pairId: FishAction.VENTRAL_R_DOWN, isNegative: false, axis: 'roll', node: 'VENTRAL_R' },

  // Dorsal Fin
  [FishAction.DORSAL_FOLD]: { pairId: FishAction.DORSAL_ERECT, isNegative: true, axis: 'pitch', node: 'DORSAL_ROOT' },
  [FishAction.DORSAL_ERECT]: { pairId: FishAction.DORSAL_FOLD, isNegative: false, axis: 'pitch', node: 'DORSAL_ROOT' },

  // Gills are NOT in continuum - they're single AUs (0=closed, 1=flared)
  // GILLS_L and GILLS_R are independent sliders, not paired opposites

  // Eye movement (like human AU 61-64)
  [FishAction.EYE_LEFT]: { pairId: FishAction.EYE_RIGHT, isNegative: true, axis: 'yaw', node: 'HEAD' },
  [FishAction.EYE_RIGHT]: { pairId: FishAction.EYE_LEFT, isNegative: false, axis: 'yaw', node: 'HEAD' },
  [FishAction.EYE_DOWN]: { pairId: FishAction.EYE_UP, isNegative: true, axis: 'pitch', node: 'HEAD' },
  [FishAction.EYE_UP]: { pairId: FishAction.EYE_DOWN, isNegative: false, axis: 'pitch', node: 'HEAD' },
};

/**
 * Human-readable labels for fish continuum pairs
 * Key format: "negativeAU-positiveAU"
 */
export const FISH_CONTINUUM_LABELS: Record<string, string> = {
  // Body Orientation
  '2-3': 'Turn — Left ↔ Right',
  '5-4': 'Pitch — Down ↔ Up',
  '6-7': 'Roll — Left ↔ Right',

  // Tail
  '12-13': 'Tail Sweep — Left ↔ Right',
  '15-14': 'Tail Fins — Close ↔ Spread',

  // Pectoral Fins
  '21-20': 'Pectoral L — Down ↔ Up',
  '25-24': 'Pectoral L — Back ↔ Forward',
  '23-22': 'Pectoral R — Down ↔ Up',
  '27-26': 'Pectoral R — Back ↔ Forward',

  // Ventral Fins
  '31-30': 'Ventral L — Down ↔ Up',
  '33-32': 'Ventral R — Down ↔ Up',

  // Dorsal Fin
  '41-40': 'Dorsal Fin — Fold ↔ Erect',

  // Gills are NOT continuum pairs - they're independent single AUs

  // Eyes
  '61-62': 'Eyes — Left ↔ Right',
  '64-63': 'Eyes — Down ↔ Up',
};

// ============================================================================
// COMPOSITE ROTATIONS - Defines how AUs map to bone rotation axes
// This is required for the engine to properly apply bone rotations
// Uses FishAction enum values for AU IDs
// ============================================================================

export const FISH_COMPOSITE_ROTATIONS: CompositeRotation[] = [
  // ========== BODY ORIENTATION ==========
  {
    node: 'HEAD',
    pitch: { aus: [FishAction.PITCH_UP, FishAction.PITCH_DOWN], axis: 'rx', negative: FishAction.PITCH_DOWN, positive: FishAction.PITCH_UP },
    yaw: { aus: [FishAction.TURN_LEFT, FishAction.TURN_RIGHT], axis: 'ry', negative: FishAction.TURN_LEFT, positive: FishAction.TURN_RIGHT },
    roll: null,
  },
  {
    node: 'BODY_FRONT',
    pitch: { aus: [FishAction.PITCH_UP, FishAction.PITCH_DOWN], axis: 'rx', negative: FishAction.PITCH_DOWN, positive: FishAction.PITCH_UP },
    yaw: { aus: [FishAction.TURN_LEFT, FishAction.TURN_RIGHT], axis: 'ry', negative: FishAction.TURN_LEFT, positive: FishAction.TURN_RIGHT },
    roll: null,
  },
  {
    node: 'BODY_MID',
    pitch: null,
    yaw: { aus: [FishAction.TURN_LEFT, FishAction.TURN_RIGHT], axis: 'ry', negative: FishAction.TURN_LEFT, positive: FishAction.TURN_RIGHT },
    roll: null,
  },
  {
    node: 'BODY_ROOT',
    pitch: null,
    yaw: null,
    roll: { aus: [FishAction.ROLL_LEFT, FishAction.ROLL_RIGHT], axis: 'rz', negative: FishAction.ROLL_LEFT, positive: FishAction.ROLL_RIGHT },
  },

  // ========== TAIL ==========
  // Tail sweep uses rz (roll axis) to sweep left/right in fish's local space
  {
    node: 'TAIL_BASE',
    pitch: null,
    yaw: null,
    roll: { aus: [FishAction.TAIL_SWEEP_LEFT, FishAction.TAIL_SWEEP_RIGHT], axis: 'rz', negative: FishAction.TAIL_SWEEP_RIGHT, positive: FishAction.TAIL_SWEEP_LEFT },
  },
  {
    node: 'BODY_BACK',
    pitch: null,
    yaw: null,
    roll: { aus: [FishAction.TAIL_SWEEP_LEFT, FishAction.TAIL_SWEEP_RIGHT], axis: 'rz', negative: FishAction.TAIL_SWEEP_RIGHT, positive: FishAction.TAIL_SWEEP_LEFT },
  },
  {
    node: 'TAIL_TOP',
    pitch: { aus: [FishAction.TAIL_FIN_SPREAD, FishAction.TAIL_FIN_CLOSE], axis: 'rx', negative: FishAction.TAIL_FIN_CLOSE, positive: FishAction.TAIL_FIN_SPREAD },
    yaw: null,
    roll: { aus: [FishAction.TAIL_SWEEP_LEFT, FishAction.TAIL_SWEEP_RIGHT], axis: 'rz', negative: FishAction.TAIL_SWEEP_RIGHT, positive: FishAction.TAIL_SWEEP_LEFT },
  },
  {
    node: 'TAIL_MID',
    pitch: null,
    yaw: null,
    roll: { aus: [FishAction.TAIL_SWEEP_LEFT, FishAction.TAIL_SWEEP_RIGHT], axis: 'rz', negative: FishAction.TAIL_SWEEP_RIGHT, positive: FishAction.TAIL_SWEEP_LEFT },
  },
  // Side tail fins for spread/close
  {
    node: 'TAIL_SIDE_L',
    pitch: { aus: [FishAction.TAIL_FIN_SPREAD, FishAction.TAIL_FIN_CLOSE], axis: 'rx', negative: FishAction.TAIL_FIN_CLOSE, positive: FishAction.TAIL_FIN_SPREAD },
    yaw: null,
    roll: null,
  },
  {
    node: 'TAIL_SIDE_R',
    pitch: { aus: [FishAction.TAIL_FIN_SPREAD, FishAction.TAIL_FIN_CLOSE], axis: 'rx', negative: FishAction.TAIL_FIN_CLOSE, positive: FishAction.TAIL_FIN_SPREAD },
    yaw: null,
    roll: null,
  },

  // ========== PECTORAL FINS (head-attached decorative fins) ==========
  {
    node: 'PECTORAL_L_ROOT',
    pitch: null,
    yaw: { aus: [FishAction.PECTORAL_L_FORWARD, FishAction.PECTORAL_L_BACK], axis: 'ry', negative: FishAction.PECTORAL_L_BACK, positive: FishAction.PECTORAL_L_FORWARD },
    roll: { aus: [FishAction.PECTORAL_L_UP, FishAction.PECTORAL_L_DOWN], axis: 'rz', negative: FishAction.PECTORAL_L_DOWN, positive: FishAction.PECTORAL_L_UP },
  },
  {
    node: 'PECTORAL_L_CHAIN1',
    pitch: null,
    yaw: null,
    roll: { aus: [FishAction.PECTORAL_L_UP, FishAction.PECTORAL_L_DOWN], axis: 'rz', negative: FishAction.PECTORAL_L_DOWN, positive: FishAction.PECTORAL_L_UP },
  },
  {
    node: 'PECTORAL_L_CHAIN2',
    pitch: null,
    yaw: null,
    roll: { aus: [FishAction.PECTORAL_L_UP, FishAction.PECTORAL_L_DOWN], axis: 'rz', negative: FishAction.PECTORAL_L_DOWN, positive: FishAction.PECTORAL_L_UP },
  },
  {
    node: 'PECTORAL_R_ROOT',
    pitch: null,
    yaw: { aus: [FishAction.PECTORAL_R_FORWARD, FishAction.PECTORAL_R_BACK], axis: 'ry', negative: FishAction.PECTORAL_R_BACK, positive: FishAction.PECTORAL_R_FORWARD },
    roll: { aus: [FishAction.PECTORAL_R_UP, FishAction.PECTORAL_R_DOWN], axis: 'rz', negative: FishAction.PECTORAL_R_DOWN, positive: FishAction.PECTORAL_R_UP },
  },
  {
    node: 'PECTORAL_R_ROOT2',
    pitch: null,
    yaw: null,
    roll: { aus: [FishAction.PECTORAL_R_UP, FishAction.PECTORAL_R_DOWN], axis: 'rz', negative: FishAction.PECTORAL_R_DOWN, positive: FishAction.PECTORAL_R_UP },
  },
  {
    node: 'PECTORAL_R_CHAIN1',
    pitch: null,
    yaw: null,
    roll: { aus: [FishAction.PECTORAL_R_UP, FishAction.PECTORAL_R_DOWN], axis: 'rz', negative: FishAction.PECTORAL_R_DOWN, positive: FishAction.PECTORAL_R_UP },
  },

  // ========== VENTRAL FINS (belly fins) ==========
  {
    node: 'VENTRAL_L',
    pitch: null,
    yaw: null,
    roll: { aus: [FishAction.VENTRAL_L_UP, FishAction.VENTRAL_L_DOWN], axis: 'rz', negative: FishAction.VENTRAL_L_DOWN, positive: FishAction.VENTRAL_L_UP },
  },
  {
    node: 'VENTRAL_L_MID',
    pitch: null,
    yaw: null,
    roll: { aus: [FishAction.VENTRAL_L_UP, FishAction.VENTRAL_L_DOWN], axis: 'rz', negative: FishAction.VENTRAL_L_DOWN, positive: FishAction.VENTRAL_L_UP },
  },
  {
    node: 'VENTRAL_R',
    pitch: null,
    yaw: null,
    roll: { aus: [FishAction.VENTRAL_R_UP, FishAction.VENTRAL_R_DOWN], axis: 'rz', negative: FishAction.VENTRAL_R_DOWN, positive: FishAction.VENTRAL_R_UP },
  },
  {
    node: 'VENTRAL_R_MID',
    pitch: null,
    yaw: null,
    roll: { aus: [FishAction.VENTRAL_R_UP, FishAction.VENTRAL_R_DOWN], axis: 'rz', negative: FishAction.VENTRAL_R_DOWN, positive: FishAction.VENTRAL_R_UP },
  },

  // ========== DORSAL FIN (erect/fold) ==========
  {
    node: 'DORSAL_ROOT',
    pitch: { aus: [FishAction.DORSAL_ERECT, FishAction.DORSAL_FOLD], axis: 'rx', negative: FishAction.DORSAL_FOLD, positive: FishAction.DORSAL_ERECT },
    yaw: null,
    roll: null,
  },
  {
    node: 'DORSAL_L',
    pitch: { aus: [FishAction.DORSAL_ERECT, FishAction.DORSAL_FOLD], axis: 'rx', negative: FishAction.DORSAL_FOLD, positive: FishAction.DORSAL_ERECT },
    yaw: null,
    roll: null,
  },
  {
    node: 'DORSAL_R',
    pitch: { aus: [FishAction.DORSAL_ERECT, FishAction.DORSAL_FOLD], axis: 'rx', negative: FishAction.DORSAL_FOLD, positive: FishAction.DORSAL_ERECT },
    yaw: null,
    roll: null,
  },

  // ========== GILLS (separate L/R - single AU per side, not continuum) ==========
  // GILLS_L controls left side only, GILLS_R controls right side only
  // These are intensity-only AUs (0=closed, 1=flared) - no negative partner
  {
    node: 'GILL_L',
    pitch: null,
    yaw: null,
    roll: { aus: [FishAction.GILLS_L], axis: 'rz', negative: undefined, positive: FishAction.GILLS_L },
  },
  {
    node: 'GILL_L_MID',
    pitch: null,
    yaw: null,
    roll: { aus: [FishAction.GILLS_L], axis: 'rz', negative: undefined, positive: FishAction.GILLS_L },
  },
  {
    node: 'GILL_R',
    pitch: null,
    yaw: null,
    roll: { aus: [FishAction.GILLS_R], axis: 'rz', negative: undefined, positive: FishAction.GILLS_R },
  },
  {
    node: 'GILL_R_MID',
    pitch: null,
    yaw: null,
    roll: { aus: [FishAction.GILLS_R], axis: 'rz', negative: undefined, positive: FishAction.GILLS_R },
  },

  // ========== EYES ==========
  // Single EYES_0 mesh rotates both fish eyes together
  {
    node: 'EYE_L',
    pitch: { aus: [FishAction.EYE_UP, FishAction.EYE_DOWN], axis: 'rx', negative: FishAction.EYE_DOWN, positive: FishAction.EYE_UP },
    yaw: { aus: [FishAction.EYE_LEFT, FishAction.EYE_RIGHT], axis: 'ry', negative: FishAction.EYE_RIGHT, positive: FishAction.EYE_LEFT },
    roll: null,
  },
];

// Legacy format for backwards compatibility
export const FISH_ACTION_INFO = FISH_AU_INFO;

// ============================================================================
// EYE MESH NODES - Fallback for eye rotation when no bone exists
// Fish has a single combined EYES_0 mesh for both eyes
// ============================================================================

export const FISH_EYE_MESH_NODES = {
  LEFT: 'EYES_0',
  RIGHT: 'EYES_0',  // Same mesh, both eyes rotate together
} as const;

// ============================================================================
// MESH SETTINGS - Material settings for fish meshes (depthWrite, blending, etc.)
// ============================================================================

export const FISH_MESHES: Record<string, MeshInfo> = {
  // Body mesh - main fish body with proper depth and blending
  'BODY_0': {
    category: 'body' as MeshCategory,
    morphCount: 0,  // Fish model has no morphs
    material: {
      depthWrite: true,
      depthTest: true,
      blending: 'Normal',
    },
  },
  // Eyes mesh - render behind body with proper transparency support
  'EYES_0': {
    category: 'eye' as MeshCategory,
    morphCount: 0,
    material: {
      renderOrder: -10,  // Render early (behind body)
      depthWrite: true,
      depthTest: true,
      blending: 'Normal',
    },
  },
};

// ============================================================================
// PRESET EXPORT
// ============================================================================

export const BETTA_FISH_PRESET = {
  name: 'Betta Fish',
  animalType: 'fish',
  emoji: '🐟',
  bones: FISH_BONES,
  boneNodes: FISH_BONE_NODES,
  boneBindings: FISH_BONE_BINDINGS,
  actionInfo: FISH_ACTION_INFO,
  eyeMeshNodes: FISH_EYE_MESH_NODES,
  // No morph targets in this model
  auToMorphs: {} as Record<number, string[]>,
  morphToMesh: {} as Record<string, string[]>,
  visemeKeys: [] as string[],
};

// Engine-compatible config format for LoomLargeThree
export const FISH_AU_MAPPING_CONFIG = {
  name: 'Betta Fish',
  animalType: 'fish',
  emoji: '🐟',
  auToBones: FISH_BONE_BINDINGS,
  boneNodes: FISH_BONE_NODES,
  auToMorphs: {} as Record<number, string[]>,
  morphToMesh: {} as Record<string, string[]>,
  visemeKeys: [] as string[],
  auInfo: FISH_AU_INFO,
  compositeRotations: FISH_COMPOSITE_ROTATIONS,
  eyeMeshNodes: FISH_EYE_MESH_NODES,
  meshes: FISH_MESHES,
  auMixDefaults: {} as Record<number, number>,  // Fish has no mixed AUs (morph+bone)
  continuumPairs: FISH_CONTINUUM_PAIRS_MAP,
};

/**
 * Check if a fish AU has bilateral bone bindings (L and R nodes)
 * Used to determine if a balance slider should be shown
 */
export const fishHasLeftRightBones = (auId: number): boolean => {
  const bindings = FISH_BONE_BINDINGS[auId];
  if (!bindings || bindings.length === 0) return false;

  // Check if bindings include both L and R nodes
  const nodes = bindings.map(b => b.node);
  const hasLeft = nodes.some(n => /_L$|_L_/.test(n) || /^GILL_L$/.test(n));
  const hasRight = nodes.some(n => /_R$|_R_/.test(n) || /^GILL_R$/.test(n));

  return hasLeft && hasRight;
};

export default BETTA_FISH_PRESET;
